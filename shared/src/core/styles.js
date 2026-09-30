// CSS panel lirik + daftar selector iklan yang disembunyikan. Dipisah dari logika
// agar modul panel fokus pada perilaku. Tidak ada innerHTML di seluruh core.
export const HIDE = [
  // YouTube Music
  'ytmusic-mealbar-promo-renderer', 'ytmusic-statement-banner-renderer',
  'ytmusic-popup-container tp-yt-paper-dialog:has(ytmusic-mealbar-promo-renderer)',
  // Pemutar
  '.ytp-ad-module', '.ytp-ad-overlay-container', '.ytp-ad-image-overlay', '.ytp-ad-text-overlay',
  '#player-ads', '.video-ads',
  // YouTube desktop: beranda, pencarian, halaman tonton, Shorts
  '#masthead-ad', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer',
  'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer', 'ytd-display-ad-renderer',
  'ytd-companion-slot-renderer', 'ytd-action-companion-ad-renderer', 'ytd-player-legacy-desktop-watch-ads-renderer',
  'ytd-statement-banner-renderer', 'ytd-merch-shelf-renderer', 'ytd-search-pyv-renderer',
  'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)', 'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
  'ytd-reel-video-renderer:has(.ytd-ad-slot-renderer)', 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
  // YouTube mobile (m.youtube.com)
  'ad-slot-renderer', 'ytm-promoted-sparkles-web-renderer', 'ytm-promoted-video-renderer', 'ytm-companion-ad-renderer',
  'ytm-rich-item-renderer:has(ad-slot-renderer)', 'ytm-banner-promo-renderer', 'ytm-statement-banner-renderer',
  'ytm-promoted-sparkles-text-search-renderer', 'ytm-item-section-renderer:has(ad-slot-renderer)',
  'ytm-reel-item-renderer:has(ad-slot-renderer)', 'ytm-mealbar-promo-renderer',
].join(',\n') + ' { display: none !important; }';

export const CSS = `
  #adfree-dock { position: fixed; right: 12px; bottom: var(--adfree-bottom, 24px); z-index: 2147483000;
    display: flex; flex-direction: column; gap: 8px; touch-action: none; user-select: none; }
  #adfree-dock.adfree-music { --adfree-bottom: 96px; }
  #adfree-dock.adfree-yt { --adfree-bottom: 24px; }
  @media (max-width: 700px) {
    #adfree-dock.adfree-music { --adfree-bottom: 150px; }
    #adfree-dock.adfree-yt { --adfree-bottom: 76px; }
  }
  #adfree-dock.adfree-hidden, #adfree-lyrics.adfree-hidden, #adfree-lyrics-btn.adfree-hidden { display: none !important; }
  .adfree-fab { width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,.12);
    background: rgba(28,28,28,.88); color: #fff; display: grid; place-items: center; cursor: pointer; padding: 0;
    box-shadow: 0 4px 14px rgba(0,0,0,.45); backdrop-filter: blur(8px); -webkit-tap-highlight-color: transparent; }
  .adfree-fab:hover { background: rgba(60,60,60,.95); }
  .adfree-fab.adfree-active { background: #ff0033; border-color: #ff0033; }

  #adfree-lyrics { position: fixed; z-index: 2147482999; right: 68px; top: 72px; bottom: 96px; width: 400px;
    display: flex; flex-direction: column; background: rgba(12,12,12,.94); color: #fff; border-radius: 16px;
    border: 1px solid rgba(255,255,255,.08); box-shadow: 0 12px 40px rgba(0,0,0,.6); backdrop-filter: blur(16px);
    font-family: Roboto, 'YouTube Sans', Arial, sans-serif; overflow: hidden; }
  #adfree-lyrics.adfree-yt { bottom: 24px; }
  @media (max-width: 700px) {
    #adfree-lyrics, #adfree-lyrics.adfree-yt { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 72vh;
      border-radius: 18px 18px 0 0; }
  }
  .adfree-lh { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px 18px;
    border-bottom: 1px solid rgba(255,255,255,.08); }
  .adfree-lh-text { flex: 1; min-width: 0; }
  .adfree-lh-title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .adfree-lh-artist { font-size: 13px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .adfree-btn { background: rgba(255,255,255,.08); color: #fff; border: 0; border-radius: 8px; height: 30px;
    min-width: 30px; padding: 0 8px; font-size: 13px; cursor: pointer; display: grid; place-items: center; }
  .adfree-btn:hover { background: rgba(255,255,255,.16); }
  .adfree-offset { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #aaa; }
  .adfree-offset span { min-width: 42px; text-align: center; font-variant-numeric: tabular-nums; }
  .adfree-lbody { flex: 1; overflow-y: auto; padding: 38% 22px; scroll-behavior: smooth; overscroll-behavior: contain; }
  .adfree-line { font-size: 22px; font-weight: 700; line-height: 1.35; margin: 0 0 16px; opacity: .38;
    transition: opacity .25s, transform .25s, color .25s; transform-origin: left center; cursor: pointer; }
  .adfree-line.adfree-past { opacity: .6; }
  .adfree-line.adfree-now { opacity: 1; transform: scale(1.04); }
  .adfree-line:hover { opacity: .85; }
  .adfree-plain .adfree-line { opacity: .9; font-size: 18px; font-weight: 500; cursor: default; transform: none; }
  .adfree-status { color: #aaa; font-size: 15px; text-align: center; margin-top: 20%; }
  .adfree-lf { padding: 8px 18px 12px; font-size: 11px; color: #777; border-top: 1px solid rgba(255,255,255,.06); }
  @media (max-width: 700px) { .adfree-line { font-size: 20px; } .adfree-lbody { padding: 30% 18px; } }

  /* Android TV: tanpa tombol melayang, panel lirik besar di kanan, cincin fokus D-pad. */
  #adfree-dock.adfree-tv { display: none !important; }
  #adfree-lyrics.adfree-tv { left: auto; right: 4vw; top: 6vh; bottom: 6vh; width: 40vw; height: auto; border-radius: 20px; }
  #adfree-lyrics.adfree-tv .adfree-line { font-size: 30px; }
  #adfree-lyrics.adfree-tv .adfree-lh-title { font-size: 22px; }
  #adfree-lyrics.adfree-tv .adfree-lh-artist { font-size: 18px; }
  #adfree-lyrics.adfree-tv .adfree-lf { font-size: 15px; }
  .adfree-tv-focus { outline: 3px solid #fff !important; outline-offset: 3px !important; border-radius: 8px;
    box-shadow: 0 0 0 6px rgba(255,0,51,.55) !important; }
`;
