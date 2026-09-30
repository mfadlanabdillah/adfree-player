// Berjalan di halaman YouTube / YouTube Music (isolated world).
// Semua logika ada di shared/adfree-core.js (dipakai juga oleh aplikasi Android).
const { ipcRenderer, contextBridge, webFrame } = require('electron');
const { pruneAds, initAdFree } = require('../shared/adfree-core.js');

// Versi Chromium Electron (dikirim main process via additionalArguments) untuk
// menyamarkan navigator.userAgentData agar konsisten dengan UA palsu.
const chromeArg = process.argv.find((a) => a.startsWith('--adfree-chrome='));
const CHROME_VERSION = chromeArg ? chromeArg.split('=')[1] : '';

// userAgentData & sinyal anti-bot lain hanya bisa diubah di main world
// (properti di prototype halaman). Berlaku juga untuk accounts.google.com —
// di situlah Google menjalankan challenge "browser tidak aman".
// Patch: 1) userAgentData konsisten, 2) window.chrome (tidak ada di Electron),
// 3) navigator.plugins (Electron kosong = sinyal bot), 4) mismatch
// Notification.permission vs permissions.query (trik deteksi Google),
// 5) navigator.webdriver.
if (CHROME_VERSION) {
  const patchIdentity = `
    (function () {
      try {
        var v = '${CHROME_VERSION}';
        if (navigator.userAgentData) {
          var brands = [{ brand: 'Google Chrome', version: v }, { brand: 'Chromium', version: v }, { brand: 'Not?A_Brand', version: '24' }];
          Object.defineProperty(Navigator.prototype, 'userAgentData', {
            configurable: true,
            get: function () {
              return {
                brands: brands, mobile: false,
                getHighEntropyValues: function () {
                  return Promise.resolve({ architecture: 'x86', bitness: '64', model: '', platformVersion: '19.0.0',
                    uaFullVersion: v, fullVersionList: brands, platform: 'Windows', wow64: false, formFactors: ['Desktop'] });
                },
              };
            },
          });
        }
        if (!window.chrome) window.chrome = {};
        if (!window.chrome.app) {
          window.chrome.app = { isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
            getDetails: function () {}, getIsInstalled: function () { return false; } };
        }
        if (!window.chrome.runtime) {
          window.chrome.runtime = {
            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
            connect: function () {}, sendMessage: function () {} };
        }
        window.chrome.csi = function () { return { startE: Date.now(), onloadT: Date.now(), pageT: 1000, tran: 15 }; };
        window.chrome.loadTimes = function () { var now = Date.now() / 1000;
          return { requestTime: now, startLoadTime: now, commitLoadTime: now, finishDocumentLoadTime: now, finishLoadTime: now,
            firstPaintTime: now, firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true,
            wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' }; };
        if (navigator.plugins && navigator.plugins.length === 0) {
          var mk = function (name) {
            var mime = { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' };
            return { 0: mime, length: 1, item: function (i) { return i === 0 ? mime : null; },
              namedItem: function (n) { return n === 'type' ? mime : null; },
              name: name, filename: 'internal-pdf-viewer', description: 'Portable Document Format' };
          };
          var plugins = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'].map(mk);
          plugins.item = function (i) { return plugins[i] || null; };
          plugins.namedItem = function (n) { for (var i = 0; i < plugins.length; i++) if (plugins[i].name === n) return plugins[i]; return null; };
          plugins.refresh = function () {};
          Object.defineProperty(navigator, 'plugins', { get: function () { return plugins; }, configurable: true });
          Object.defineProperty(navigator, 'mimeTypes', { get: function () { return plugins; }, configurable: true });
        }
        var origQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = function (desc) {
          if (desc && desc.name === 'notifications') {
            var state = (window.Notification && Notification.permission) === 'granted' ? 'granted' : 'prompt';
            return Promise.resolve({ state: state, name: 'notifications', onchange: null });
          }
          return origQuery(desc);
        };
        try { Object.defineProperty(navigator, 'webdriver', { get: function () { return false; }, configurable: true }); } catch (e) {}
      } catch (e) {}
    })();
  `;
  try {
    contextBridge.executeInMainWorld({ func: new Function(patchIdentity) });
  } catch {
    webFrame.executeJavaScript(patchIdentity);
  }
}

let adblockOn = ipcRenderer.sendSync('player:adblock-enabled');
ipcRenderer.on('player:adblock', (_e, on) => (adblockOn = on));

if (/(^|\.)youtube\.com$/.test(location.hostname)) {
  // Pemangkas iklan harus jalan di main world sebelum script YouTube.
  if (adblockOn) {
    try {
      contextBridge.executeInMainWorld({ func: pruneAds });
    } catch {
      webFrame.executeJavaScript(`(${pruneAds})()`);
    }
  }

  const player = initAdFree({
    platform: 'desktop',
    isAdblockOn: () => adblockOn,
    fetchJson: (url) => ipcRenderer.invoke('net:json', url),
    onState: (title, artist, art, playing) => ipcRenderer.send('player:state', { title, artist, playing }),
  });
  ipcRenderer.on('player:control', (_e, action) => player.control(action));
}
