// Berjalan di halaman YouTube / YouTube Music (isolated world).
// Semua logika ada di shared/adfree-core.js (dipakai juga oleh aplikasi Android).
const { ipcRenderer, contextBridge, webFrame } = require('electron');
const { pruneAds, initAdFree } = require('../shared/adfree-core.js');

// Versi Chromium Electron (dikirim main process via additionalArguments) untuk
// menyamarkan navigator.userAgentData agar konsisten dengan UA palsu.
const chromeArg = process.argv.find((a) => a.startsWith('--adfree-chrome='));
const CHROME_VERSION = chromeArg ? chromeArg.split('=')[1] : '';

// userAgentData hanya bisa diubah di main world (properti di prototype halaman).
// Penting untuk login Google: alamat accounts.google.com juga di-preload.
if (CHROME_VERSION) {
  const patchUACH = `
    (function () {
      try {
        if (!navigator.userAgentData) return;
        const v = '${CHROME_VERSION}';
        const brands = [{ brand: 'Google Chrome', version: v }, { brand: 'Chromium', version: v }, { brand: 'Not?A_Brand', version: '24' }];
        Object.defineProperty(Navigator.prototype, 'userAgentData', {
          configurable: true,
          get: () => ({
            brands,
            mobile: false,
            getHighEntropyValues: async (hints) => ({
              architecture: 'x86', bitness: '64', model: '', platformVersion: '19.0.0',
              uaFullVersion: v, fullVersionList: brands, platform: 'Windows',
              wow64: false, formFactors: ['Desktop'],
            }),
          }),
        });
      } catch (e) {}
    })();
  `;
  try {
    contextBridge.executeInMainWorld({ func: new Function(patchUACH) });
  } catch {
    webFrame.executeJavaScript(patchUACH);
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
