// Berjalan di halaman YouTube / YouTube Music (isolated world).
// Semua logika ada di shared/adfree-core.js (dipakai juga oleh aplikasi Android).
const { ipcRenderer, contextBridge, webFrame } = require('electron');
const { pruneAds, initAdFree } = require('../shared/adfree-core.js');

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
