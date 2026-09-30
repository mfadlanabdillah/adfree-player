// Entry point core AdFree. Wiring semua modul + loop utama + ekspor api.
// Sumber modul ESM; dibundel oleh shared/build-core.js menjadi shared/adfree-core.js
// yang dipakai tiga tempat: preload desktop (require), Android (script di WebView),
// dan unit test Node (module.exports) — guard di footer bundle yang memilih jalur.
import { $, $$, firstOf, mainVideo, h, icon, ICON_MUSIC, ICON_VIDEO, ICON_LYRICS, ICON_CLOSE } from './utils.js';
import { cleanTitle, cleanArtist, parseLrc, findLyrics } from './track-utils.js';
import { pruneAds } from './ad-prune.js';
import { createSkipper } from './ad-skip.js';
import { createPlayer } from './player.js';
import { createLyricsPanel } from './lyrics.js';
import { createTvNav } from './tv.js';
import { HIDE, CSS } from './styles.js';

const MUSIC_URL = 'https://music.youtube.com/';

// env = {
//   platform: 'desktop' | 'android',
//   tv: boolean (Android TV),
//   isAdblockOn(): boolean,
//   fetchJson(url): Promise<object|null>,
//   onState(title, artist, artUrl, playing),
// }
export function initAdFree(env) {
  const host = location.hostname;
  if (!/(^|\.)youtube\.com$/.test(host)) return { control() {} };
  const isMusic = host === 'music.youtube.com';
  const YT_URL = env.platform === 'android' ? 'https://m.youtube.com/' : 'https://www.youtube.com/';

  const panel = createLyricsPanel({
    $, $$, h, icon, ICON_LYRICS, ICON_VIDEO, ICON_MUSIC, ICON_CLOSE,
    mainVideo, isMusic, tv: !!env.tv, fetchJson: env.fetchJson,
    cleanTitle, cleanArtist, MUSIC_URL, YT_URL, HIDE, CSS,
  });

  const skipAds = createSkipper({ $, $$, firstOf, mainVideo, isAdblockOn: env.isAdblockOn });
  const player = createPlayer({ $, firstOf, mainVideo, onState: env.onState });
  window.__adfreeControl = player.control;

  if (env.tv) {
    const tvNav = createTvNav({ $$, firstOf, isMusic, panel });
    window.addEventListener('keydown', tvNav.onTvKey, true);
  }

  // Dipanggil dari aplikasi Android (menu TV & tombol Back).
  window.__adfreeUi = {
    toggleLyrics: () => panel.ui() && panel.toggleLyrics(),
    back: () => panel.backIfOpen(),
  };

  // ---- Loop utama ----------------------------------------------------------
  function tick() {
    skipAds();
    player.reportState();
    if (!panel.ui()) return;
    const onWatch = isMusic || location.pathname === '/watch' || location.hash.startsWith('#/watch');
    const fullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement;
    panel.tickUi({ onWatch, fullscreen });
  }

  function frame() {
    panel.syncLyrics();
    requestAnimationFrame(frame);
  }

  function start() {
    panel.mount();
    new MutationObserver(skipAds).observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class'],
    });
    setInterval(tick, 400);
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  return { control: player.control };
}

// Ekspor publik: pruneAds & initAdFree untuk host (preload/inject),
// _internal = helper murni untuk unit test (tests/adfree-core.test.js) — kontrak tetap.
const api = {
  pruneAds,
  initAdFree,
  _internal: { cleanTitle, cleanArtist, parseLrc, findLyrics },
};
export default api;
