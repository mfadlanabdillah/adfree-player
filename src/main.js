const { app, BrowserWindow, Menu, Tray, session, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

const MUSIC_URL = 'https://music.youtube.com/';
const YOUTUBE_URL = 'https://www.youtube.com/';
// UA Chrome yang SINKRON dengan Chromium asli Electron (process.versions.chrome).
// Google membandingkan tiga sumber identitas saat login — string UA, header
// Sec-CH-UA, dan navigator.userAgentData di JS. Kalau versinya tidak cocok
// (mis. UA klaim Chrome 140 tapi Chromium asli 144), login ditolak
// "This browser or app may not be secure".
const CHROME_VERSION = process.versions.chrome;
const CHROME_UA =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

const statePath = () => path.join(app.getPath('userData'), 'window-state.json');
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

let win = null;
let tray = null;
let blocker = null;
let blockedCount = 0;
let settings = { adblock: true, closeToTray: true, lastSite: MUSIC_URL };
let nowPlaying = { title: '', artist: '', playing: false };

async function readJson(file, fallback) {
  try {
    return { ...fallback, ...JSON.parse(await fs.readFile(file, 'utf8')) };
  } catch {
    return fallback;
  }
}

const writeJson = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2)).catch(() => {});

// Tulis file dengan debounce: event resize/move bisa tembakan puluhan kali per detik.
function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = () => {
    clearTimeout(t);
    fn();
  };
  return wrapped;
}

async function setupAdblock(ses) {
  const cachePath = path.join(app.getPath('userData'), 'adblock-engine.bin');
  blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
    path: cachePath,
    read: fs.readFile,
    write: fs.writeFile,
  });
  blocker.on('request-blocked', () => {
    blockedCount++;
    updateTitle();
  });
  if (settings.adblock) blocker.enableBlockingInSession(ses);
}

function setAdblock(enabled) {
  settings.adblock = enabled;
  writeJson(settingsPath(), settings);
  const ses = win.webContents.session;
  if (!blocker) return;
  if (enabled && !blocker.isBlockingEnabled(ses)) blocker.enableBlockingInSession(ses);
  if (!enabled && blocker.isBlockingEnabled(ses)) blocker.disableBlockingInSession(ses);
  win.webContents.send('player:adblock', enabled);
  win.webContents.reload();
  buildMenu();
}

function updateTitle() {
  if (!win) return;
  const song = nowPlaying.title ? `${nowPlaying.title} — ${nowPlaying.artist}  ·  ` : '';
  const shield = settings.adblock ? `🛡 ${blockedCount} diblokir` : 'Adblock mati';
  win.setTitle(`${song}AdFree Music  ·  ${shield}`);
  if (tray) tray.setToolTip(nowPlaying.title ? `${nowPlaying.title} — ${nowPlaying.artist}` : 'AdFree Music');
}

const control = (action) => win && win.webContents.send('player:control', action);

function buildMenu() {
  const template = [
    {
      label: 'Navigasi',
      submenu: [
        { label: 'YouTube Music', accelerator: 'Alt+1', click: () => win.loadURL(MUSIC_URL) },
        { label: 'YouTube', accelerator: 'Alt+2', click: () => win.loadURL(YOUTUBE_URL) },
        { label: 'Kembali', accelerator: 'Alt+Left', click: () => win.webContents.navigationHistory.goBack() },
        { label: 'Maju', accelerator: 'Alt+Right', click: () => win.webContents.navigationHistory.goForward() },
        { type: 'separator' },
        { role: 'reload', label: 'Muat ulang' },
        { role: 'forceReload', label: 'Muat ulang paksa' },
        { type: 'separator' },
        { role: 'quit', label: 'Keluar' },
      ],
    },
    {
      label: 'Pemutar',
      submenu: [
        { label: 'Putar / Jeda', accelerator: 'CmdOrCtrl+Space', click: () => control('toggle') },
        { label: 'Lagu berikutnya', accelerator: 'CmdOrCtrl+Right', click: () => control('next') },
        { label: 'Lagu sebelumnya', accelerator: 'CmdOrCtrl+Left', click: () => control('prev') },
      ],
    },
    {
      label: 'Perlindungan',
      submenu: [
        {
          label: 'Blokir iklan & pelacak',
          type: 'checkbox',
          checked: settings.adblock,
          click: (item) => setAdblock(item.checked),
        },
        {
          label: 'Tutup ke tray (tetap memutar)',
          type: 'checkbox',
          checked: settings.closeToTray,
          click: (item) => {
            settings.closeToTray = item.checked;
            writeJson(settingsPath(), settings);
          },
        },
        { type: 'separator' },
        {
          label: 'Bersihkan data login & cache',
          click: async () => {
            // Google kadang menempel penanda "klien tidak aman" di cookie setelah
            // beberapa penolakan login; bersihkan sesi + cache lalu muat ulang.
            const ses = win.webContents.session;
            await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] });
            await ses.clearCache();
            win.loadURL(settings.lastSite === YOUTUBE_URL ? YOUTUBE_URL : MUSIC_URL);
          },
        },
      ],
    },
    {
      label: 'Tampilan',
      submenu: [
        { role: 'zoomIn', label: 'Perbesar' },
        { role: 'zoomOut', label: 'Perkecil' },
        { role: 'resetZoom', label: 'Ukuran normal' },
        { role: 'togglefullscreen', label: 'Layar penuh' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Developer tools' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupIpc() {
  // Pengambil lirik untuk panel lirik real-time; hanya boleh ke lrclib.net.
  ipcMain.handle('net:json', async (_e, url) => {
    try {
      if (new URL(url).hostname !== 'lrclib.net') return null;
      const res = await fetch(url, { headers: { 'User-Agent': `AdFreeMusic/${app.getVersion()} (personal player)` } });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  });
  ipcMain.on('player:adblock-enabled', (e) => (e.returnValue = settings.adblock));
  ipcMain.on('player:state', (_e, state) => {
    const changed = state.playing !== nowPlaying.playing;
    nowPlaying = state;
    updateTitle();
    if (changed && tray) refreshTray();
  });
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Tampilkan', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      { label: nowPlaying.playing ? 'Jeda' : 'Putar', click: () => control('toggle') },
      { label: 'Berikutnya', click: () => control('next') },
      { label: 'Sebelumnya', click: () => control('prev') },
      { type: 'separator' },
      { label: 'Keluar', click: () => { app.isQuitting = true; app.quit(); } },
    ])
  );
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  refreshTray();
  tray.on('click', () => (win.isVisible() ? win.hide() : win.show()));
}

async function createWindow() {
  const bounds = await readJson(statePath(), { width: 1280, height: 820 });
  const ses = session.fromPartition('persist:ytmusic');
  ses.setUserAgent(CHROME_UA);
  // Fallback untuk request yang tidak lewat webContents (service worker,
  // redirect internal): tanpa ini identitas Electron bisa bocor di sini.
  app.userAgentFallback = CHROME_UA;

  // Samakan header client hints dengan UA palsu. Chromium asli mengirim brand
  // "Chromium" (bukan "Google Chrome") dengan versinya sendiri — Google
  // membandingkan ini dengan UA dan menolak yang tidak cocok.
  const SEC_CH_UA = `"Chromium";v="${CHROME_VERSION}", "Google Chrome";v="${CHROME_VERSION}", "Not?A_Brand";v="24"`;
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    for (const h of Object.keys(headers)) if (h.toLowerCase().startsWith('sec-ch-ua')) delete headers[h];
    headers['sec-ch-ua'] = SEC_CH_UA;
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = '"Windows"';
    headers['User-Agent'] = CHROME_UA;
    callback({ requestHeaders: headers });
  });

  win = new BrowserWindow({
    ...bounds,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#030303',
    icon: path.join(__dirname, 'icon.png'),
    title: 'AdFree Music',
    show: false,
    webPreferences: {
      session: ses,
      // Versi Chromium diteruskan ke preload untuk patch navigator.userAgentData
      // (preprocess tidak bisa membaca process.versions di sandbox).
      additionalArguments: ['--adfree-chrome=' + CHROME_VERSION],
      // preload sudah di-bundle dengan esbuild (npm run build:preload) sehingga
      // shared/adfree-core.js ikut ter-inline dan sandbox bisa tetap aktif.
      preload: path.join(__dirname, 'preload.bundle.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // musik tetap lancar saat jendela di belakang
    },
  });
  if (bounds.maximized) win.maximize();
  win.webContents.setUserAgent(CHROME_UA);
  win.on('page-title-updated', (e) => e.preventDefault());
  win.once('ready-to-show', () => win.show());

  // Hanya domain YouTube/Google yang dibuka di dalam app; link lain ke browser default.
  const internal = (url) => /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|google\.com|googleusercontent\.com|gstatic\.com)\//.test(url);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (internal(url)) win.loadURL(url);
    else shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!internal(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  const saveBounds = debounce(
    () => writeJson(statePath(), { ...win.getNormalBounds(), maximized: win.isMaximized() }),
    400
  );
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('close', (e) => {
    saveBounds.flush();
    if (settings.closeToTray && !app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  try {
    await setupAdblock(ses);
  } catch (err) {
    console.error('Gagal memuat daftar filter iklan:', err);
  }
  setupIpc();
  buildMenu();
  buildTray();
  updateTitle();
  win.webContents.on('did-navigate', (_e, url) => {
    const site = url.startsWith(MUSIC_URL) ? MUSIC_URL : url.startsWith(YOUTUBE_URL) ? YOUTUBE_URL : null;
    if (site && site !== settings.lastSite) {
      settings.lastSite = site;
      writeJson(settingsPath(), settings);
    }
  });
  win.loadURL(settings.lastSite === YOUTUBE_URL ? YOUTUBE_URL : MUSIC_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    win.show();
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on('before-quit', () => (app.isQuitting = true));
  app.whenReady().then(async () => {
    settings = await readJson(settingsPath(), settings);
    await createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
