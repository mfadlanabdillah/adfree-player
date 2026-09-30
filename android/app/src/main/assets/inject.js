// Bagian khusus Android. Dijalankan setelah adfree-core.js (digabung oleh MainActivity),
// di main world, sebelum script YouTube berjalan.
(function () {
  if (window.__adfree) return;
  window.__adfree = true;
  const core = window.__adfreeCore;

  // Tetap memutar saat app di latar belakang / layar mati:
  // halaman selalu mengira dirinya sedang terlihat.
  try {
    const def = (obj, key, val) => Object.defineProperty(obj, key, { get: () => val, configurable: true });
    def(Document.prototype, 'hidden', false);
    def(Document.prototype, 'webkitHidden', false);
    def(Document.prototype, 'visibilityState', 'visible');
    def(Document.prototype, 'webkitVisibilityState', 'visible');
    const stop = (e) => e.stopImmediatePropagation();
    ['visibilitychange', 'webkitvisibilitychange', 'pagehide', 'freeze'].forEach((t) => {
      document.addEventListener(t, stop, true);
      window.addEventListener(t, stop, true);
    });
  } catch (e) {}

  core.pruneAds();

  // Request lirik lewat Java (tidak terkena CSP halaman YouTube).
  const callbacks = {};
  let seq = 0;
  window.__adfreeCb = function (id, text) {
    const cb = callbacks[id];
    delete callbacks[id];
    if (cb) cb(text);
  };
  function fetchJson(url) {
    return new Promise((resolve) => {
      if (!window.AdFree) return resolve(null);
      const id = String(++seq);
      const timer = setTimeout(() => window.__adfreeCb(id, null), 15000);
      callbacks[id] = (text) => {
        clearTimeout(timer);
        try { resolve(text ? JSON.parse(text) : null); } catch (e) { resolve(null); }
      };
      window.AdFree.fetchText(id, url);
    });
  }

  const tv = !!window.__adfreeTv;
  if (tv) {
    // YouTube versi TV memanggil window.close() saat pengguna ingin keluar -> tampilkan menu aplikasi.
    window.close = function () { if (window.AdFree) window.AdFree.exitRequested(); };
  }

  core.initAdFree({
    platform: 'android',
    tv,
    isAdblockOn: () => true,
    fetchJson,
    onState: (title, artist, art, playing) => window.AdFree && window.AdFree.onState(title, artist, art, playing),
  });
})();
