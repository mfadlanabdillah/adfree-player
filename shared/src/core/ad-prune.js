// Pemangkas iklan: harus jalan di main world SEBELUM script YouTube.
//
// KERAS: fungsi ini self-contained — diserialisasi oleh Electron
// contextBridge.executeInMainWorld, jadi TIDAK BOLEH menutup variabel
// (closure) dari modul lain. Semua yang dibutuhkan harus ada di dalam.
export function pruneAds() {
  if (window.__adfreePrune) return;
  window.__adfreePrune = true;
  const AD_KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];
  const prune = (o) => {
    if (o && typeof o === 'object') {
      for (const k of AD_KEYS) if (k in o) delete o[k];
      if (o.playerResponse) prune(o.playerResponse);
    }
    return o;
  };
  const origParse = JSON.parse;
  JSON.parse = function () { return prune(origParse.apply(this, arguments)); };
  const origJson = Response.prototype.json;
  Response.prototype.json = function () { return origJson.apply(this, arguments).then(prune); };
  let initialPR;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get: () => initialPR,
      set: (v) => { initialPR = prune(v); },
    });
  } catch (e) {}
}
