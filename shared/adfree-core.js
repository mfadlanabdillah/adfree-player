/*
 * AdFree core — dipakai bersama oleh aplikasi desktop (preload Electron) dan Android (inject WebView).
 * Berisi: pemangkas iklan, penyembunyi/peloncat iklan, kontrol pemutar, tombol pindah
 * YouTube <-> YouTube Music, dan panel lirik real-time (sumber: LRCLIB).
 * Catatan: YouTube memakai Trusted Types, jadi TIDAK boleh ada innerHTML di file ini.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1) Pemangkas iklan: harus jalan di main world SEBELUM script YouTube.
  //    Fungsi ini self-contained (diserialisasi oleh Electron executeInMainWorld).
  // ---------------------------------------------------------------------------
  function pruneAds() {
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

  // ---------------------------------------------------------------------------
  // 1b) Helper murni (tanpa DOM) — dipakai initAdFree dan diekspor untuk unit test.
  // ---------------------------------------------------------------------------
  const JUNK = /\b(official|video|audio|lyrics?|lirik|mv|m\/v|visuali[sz]er|hd|hq|4k|remaster(ed)?|explicit|clean|color coded|performance)\b/i;
  function cleanTitle(t) {
    return t
      .replace(/[(\[【][^)\]】]*[)\]】]/g, (m) => (JUNK.test(m) ? '' : m))
      .replace(/\s+(ft\.?|feat\.?|featuring)\s.*$/i, '')
      .replace(/\s*\|.*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  function cleanArtist(a) {
    return a.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/\s+(ft\.?|feat\.?)\s.*$/i, '').trim();
  }
  function parseLrc(text) {
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      // Fraksi desimal boleh titik, koma, atau titik dua (beda-beda tiap generator LRC).
      const tags = [...raw.matchAll(/\[(\d+):(\d+(?:[.,:]\d+)?)\]/g)];
      if (!tags.length) continue;
      const words = raw.replace(/\[[^\]]*\]/g, '').trim();
      // Normalisasi desimal: koma atau titik dua (mis. [00:12,5] / [00:12:5]) -> titik.
      for (const t of tags) out.push({ t: +t[1] * 60 + parseFloat(t[2].replace(/[:,]/, '.')), text: words });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  const LRCLIB = 'https://lrclib.net/api';
  // fetchJson dilempar sebagai argumen (dari env) supaya fungsi murni dan mudah dites.
  async function findLyrics(fetchJson, track) {
    const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    const firstArtist = track.artist.split(/\s*(?:,|&| x | and | dan )\s*/i)[0];
    if (track.artist) {
      const exact = await fetchJson(`${LRCLIB}/get?` + q({ track_name: track.title, artist_name: track.artist, duration: track.duration }));
      if (exact && (exact.syncedLyrics || exact.plainLyrics)) return exact;
    }
    const results = (await fetchJson(`${LRCLIB}/search?` + q({ track_name: track.title, artist_name: firstArtist }))) || [];
    let list = Array.isArray(results) ? results : [];
    if (!list.length) {
      const loose = await fetchJson(`${LRCLIB}/search?` + q({ q: `${track.title} ${firstArtist}`.trim() }));
      list = Array.isArray(loose) ? loose : [];
    }
    const diff = (r) => (track.duration && r.duration ? Math.abs(r.duration - track.duration) : 0);
    const synced = list.filter((r) => r.syncedLyrics && diff(r) <= 6).sort((a, b) => diff(a) - diff(b));
    return synced[0] || list.find((r) => r.syncedLyrics && !track.duration) || list.find((r) => r.plainLyrics) || null;
  }

  // ---------------------------------------------------------------------------
  // 2) Semua fitur DOM. env = {
  //      platform: 'desktop' | 'android',
  //      isAdblockOn(): boolean,
  //      fetchJson(url): Promise<object|null>,
  //      onState(title, artist, artUrl, playing),
  //    }
  // ---------------------------------------------------------------------------
  function initAdFree(env) {
    const host = location.hostname;
    if (!/(^|\.)youtube\.com$/.test(host)) return { control() {} };
    const isMusic = host === 'music.youtube.com';
    const MUSIC_URL = 'https://music.youtube.com/';
    const YT_URL = env.platform === 'android' ? 'https://m.youtube.com/' : 'https://www.youtube.com/';

    const HIDE = [
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

    const SKIP = '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot button, .ytp-ad-skip-button-container button';

    const $ = (sel, el) => (el || document).querySelector(sel);
    const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
    const firstOf = (sels) => { for (const s of sels) { const e = $(s); if (e) return e; } return null; };
    const mainVideo = () => firstOf(['#movie_player video', 'ytmusic-player video', 'video']);

    // ---- Peloncat iklan (lapisan cadangan) ---------------------------------
    let mutedByUs = false;
    function skipAds() {
      if (!env.isAdblockOn()) return;
      const player = $('#movie_player') || $('.html5-video-player');
      const video = mainVideo();
      if (player && video) {
        if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) {
          if (!video.muted) { video.muted = true; mutedByUs = true; }
          video.playbackRate = 16;
          if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration;
          $$(SKIP).forEach((b) => b.click());
        } else if (mutedByUs) {
          video.muted = false;
          video.playbackRate = 1;
          mutedByUs = false;
        }
      }
      // Pop-up "Ad blockers are not allowed on YouTube" -> buang & lanjutkan video.
      const enforcement = $$('ytd-enforcement-message-view-model');
      if (enforcement.length) {
        enforcement.forEach((el) => (el.closest('tp-yt-paper-dialog') || el).remove());
        $$('tp-yt-iron-overlay-backdrop').forEach((b) => b.remove());
        if (video && video.paused) video.play();
      }
      // "Masih mendengarkan/menonton?" -> lanjut otomatis.
      const stillThere = firstOf(['ytmusic-you-there-renderer button', 'yt-confirm-dialog-renderer #confirm-button button']);
      if (stillThere && $('ytmusic-you-there-renderer, yt-confirm-dialog-renderer')) stillThere.click();
    }

    // ---- Kontrol pemutar (notifikasi, tray, lockscreen) ---------------------
    function clickFirst(sels) {
      const el = firstOf(sels);
      if (el) el.click();
      return !!el;
    }
    function control(action) {
      const video = mainVideo();
      if (action === 'play' && video) video.play();
      if (action === 'pause' && video) video.pause();
      if (action === 'toggle' && video) video.paused ? video.play() : video.pause();
      if (action === 'next') {
        clickFirst(['ytmusic-player-bar .next-button', '.ytp-next-button', '.player-controls-next-button button',
          '[aria-label="Next"]', '[aria-label="Next video"]', '[aria-label="Berikutnya"]', '[aria-label="Video berikutnya"]']);
      }
      if (action === 'prev') {
        const done = clickFirst(['ytmusic-player-bar .previous-button', '.ytp-prev-button:not([style*="none"])',
          '.player-controls-prev-button button', '[aria-label="Previous"]', '[aria-label="Sebelumnya"]']);
        if (!done && video) video.currentTime = 0;
      }
    }
    root.__adfreeControl = control;

    // ---- Info lagu / video ---------------------------------------------------
    function rawTrack() {
      const md = navigator.mediaSession && navigator.mediaSession.metadata;
      const bar = $('ytmusic-player-bar');
      const title = (md && md.title) || (bar && $('.title', bar)?.textContent.trim()) || '';
      const artist = (md && md.artist) || (bar && $('.byline', bar)?.textContent.split('•')[0].trim()) || '';
      const art = (md && md.artwork && md.artwork.length && md.artwork[md.artwork.length - 1].src) || '';
      return { title, artist, art };
    }

    let lastState = '';
    function reportState() {
      const { title, artist, art } = rawTrack();
      const video = mainVideo();
      const playing = !!video && !video.paused && !video.ended;
      const state = JSON.stringify([title, artist, art, playing]);
      if (state !== lastState && title) {
        lastState = state;
        env.onState(title, artist, art, playing);
      }
    }

    // ---- Helper DOM tanpa innerHTML -----------------------------------------
    function h(tag, props, ...children) {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(props || {})) {
        if (k === 'class') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v);
      }
      for (const c of children) if (c != null) el.append(c);
      return el;
    }
    function icon(d) {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '22');
      svg.setAttribute('height', '22');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'currentColor');
      svg.append(p);
      return svg;
    }
    const ICON_MUSIC = 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z';
    const ICON_VIDEO = 'M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z';
    const ICON_LYRICS = 'M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4zm13-2.5v5l4-2.5z';
    const ICON_CLOSE = 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z';

    const CSS = `
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

    // ---- Lirik real-time -----------------------------------------------------
    const lyr = {
      open: false, key: '', lines: null, plain: null, status: '', offset: 0, active: -1,
      loadSeq: 0, userScrollUntil: 0, cache: new Map(),
    };
    let ui = null;

    function currentTrack() {
      let { title, artist } = rawTrack();
      if (!title) return null;
      if (!isMusic) {
        // Video YouTube biasanya berjudul "Artis - Lagu (Official Video)".
        const m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
        if (m) { artist = m[1]; title = m[2]; }
      }
      const video = mainVideo();
      const duration = video && Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      return { title: cleanTitle(title), artist: cleanArtist(artist), duration };
    }

    async function loadLyrics(track) {
      const key = track.title + '|' + track.artist;
      lyr.key = key;
      lyr.offset = 0;
      lyr.active = -1;
      const seq = ++lyr.loadSeq;
      let res = lyr.cache.get(key);
      if (!res) {
        lyr.lines = lyr.plain = null;
        lyr.status = 'Mencari lirik…';
        render(track);
        try {
          res = await findLyrics(env.fetchJson, track);
        } catch (e) {
          res = null;
        }
        res = res || { none: true };
        if (!res.none || navigator.onLine) lyr.cache.set(key, res);
      }
      if (seq !== lyr.loadSeq) return;
      lyr.lines = res.syncedLyrics ? parseLrc(res.syncedLyrics) : null;
      lyr.plain = !lyr.lines && res.plainLyrics ? res.plainLyrics.split(/\r?\n/) : null;
      lyr.status = res.none ? 'Lirik untuk lagu ini belum tersedia.' : '';
      render(track);
    }

    function buildUi() {
      const style = h('style', { id: 'adfree-style' });
      style.textContent = HIDE + '\n' + CSS;
      (document.head || document.documentElement).append(style);

      const siteClass = isMusic ? 'adfree-music' : 'adfree-yt';
      const switchBtn = h('button', {
        class: 'adfree-fab', title: isMusic ? 'Buka YouTube' : 'Buka YouTube Music',
        onclick: () => { if (!dock.dragged) location.href = isMusic ? YT_URL : MUSIC_URL; },
      }, icon(isMusic ? ICON_VIDEO : ICON_MUSIC));
      const lyricsBtn = h('button', {
        id: 'adfree-lyrics-btn', class: 'adfree-fab', title: 'Lirik real-time',
        onclick: () => { if (!dock.dragged) toggleLyrics(); },
      }, icon(ICON_LYRICS));
      const dock = h('div', { id: 'adfree-dock', class: siteClass + (env.tv ? ' adfree-tv' : '') }, lyricsBtn, switchBtn);

      // Dock bisa digeser naik/turun; posisinya diingat.
      const posKey = 'adfree-dock-top-' + (isMusic ? 'music' : 'yt');
      try {
        const saved = localStorage.getItem(posKey);
        if (saved) { dock.style.top = saved; dock.style.bottom = 'auto'; }
      } catch (e) {}
      dock.addEventListener('pointerdown', (e) => {
        const startY = e.clientY, startTop = dock.getBoundingClientRect().top;
        dock.dragged = false;
        const move = (ev) => {
          const dy = ev.clientY - startY;
          if (Math.abs(dy) > 6) dock.dragged = true;
          if (!dock.dragged) return;
          const top = Math.min(Math.max(8, startTop + dy), window.innerHeight - dock.offsetHeight - 8);
          dock.style.top = top + 'px';
          dock.style.bottom = 'auto';
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (dock.dragged) { try { localStorage.setItem(posKey, dock.style.top); } catch (e) {} }
          setTimeout(() => (dock.dragged = false), 0);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      const title = h('div', { class: 'adfree-lh-title' });
      const artist = h('div', { class: 'adfree-lh-artist' });
      const offsetLabel = h('span');
      const shift = (d) => { lyr.offset = Math.round((lyr.offset + d) * 10) / 10; lyr.active = -1; updateOffset(); };
      const offset = h('div', { class: 'adfree-offset', title: 'Geser waktu lirik kalau tidak pas' },
        h('button', { class: 'adfree-btn', onclick: () => shift(-0.5) }, '−'),
        offsetLabel,
        h('button', { class: 'adfree-btn', onclick: () => shift(0.5) }, '+'));
      const close = h('button', { class: 'adfree-btn', title: 'Tutup', onclick: () => toggleLyrics(false) }, icon(ICON_CLOSE));
      const body = h('div', { class: 'adfree-lbody' });
      const markScroll = () => (lyr.userScrollUntil = Date.now() + 3500);
      body.addEventListener('wheel', markScroll, { passive: true });
      body.addEventListener('touchmove', markScroll, { passive: true });
      const panel = h('div', { id: 'adfree-lyrics', class: siteClass + (env.tv ? ' adfree-tv' : '') + ' adfree-hidden' },
        h('div', { class: 'adfree-lh' }, h('div', { class: 'adfree-lh-text' }, title, artist), offset, close),
        body,
        h('div', { class: 'adfree-lf' }, env.tv
          ? 'Lirik dari LRCLIB (lrclib.net) · ◀ ▶ geser waktu lirik · Back untuk menutup'
          : 'Lirik dari LRCLIB (lrclib.net) · ketuk baris untuk lompat'));

      document.body.append(dock, panel);
      function updateOffset() { offsetLabel.textContent = (lyr.offset > 0 ? '+' : '') + lyr.offset.toFixed(1) + 's'; }
      updateOffset();
      return { dock, panel, lyricsBtn, title, artist, body, offset, updateOffset };
    }

    function render(track) {
      if (!ui) return;
      ui.title.textContent = track ? track.title : '';
      ui.artist.textContent = track ? track.artist : '';
      ui.updateOffset();
      ui.offset.style.display = lyr.lines ? '' : 'none';
      ui.body.replaceChildren();
      ui.body.classList.toggle('adfree-plain', !lyr.lines);
      if (lyr.status) {
        ui.body.append(h('div', { class: 'adfree-status' }, lyr.status));
      } else if (lyr.lines) {
        lyr.lines.forEach((line, i) => {
          ui.body.append(h('p', {
            class: 'adfree-line', 'data-i': String(i),
            onclick: () => {
              const v = mainVideo();
              if (v) { v.currentTime = Math.max(0, line.t - lyr.offset + 0.05); lyr.userScrollUntil = 0; }
            },
          }, line.text || '♪'));
        });
      } else if (lyr.plain) {
        lyr.plain.forEach((l) => ui.body.append(h('p', { class: 'adfree-line' }, l || ' ')));
      }
      ui.body.scrollTop = 0;
    }

    function syncLyrics() {
      if (!lyr.open || !lyr.lines || !ui) return;
      const v = mainVideo();
      if (!v) return;
      const t = v.currentTime + lyr.offset + 0.15;
      let i = -1;
      for (let lo = 0, hi = lyr.lines.length - 1; lo <= hi;) {
        const mid = (lo + hi) >> 1;
        if (lyr.lines[mid].t <= t) { i = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (i === lyr.active) return;
      lyr.active = i;
      const els = ui.body.children;
      for (let k = 0; k < els.length; k++) {
        els[k].classList.toggle('adfree-now', k === i);
        els[k].classList.toggle('adfree-past', k < i);
      }
      if (i >= 0 && Date.now() > lyr.userScrollUntil) {
        const el = els[i];
        ui.body.scrollTop = el.offsetTop - ui.body.clientHeight / 2 + el.offsetHeight / 2;
      }
    }

    function toggleLyrics(force) {
      lyr.open = typeof force === 'boolean' ? force : !lyr.open;
      ui.panel.classList.toggle('adfree-hidden', !lyr.open);
      ui.lyricsBtn.classList.toggle('adfree-active', lyr.open);
      if (lyr.open) {
        const track = currentTrack();
        if (!track) {
          lyr.status = 'Putar lagu dulu, lalu buka lirik.';
          lyr.key = '';
          render(null);
        } else if (track.title + '|' + track.artist !== lyr.key || !lyr.cache.has(lyr.key)) {
          loadLyrics(track);
        } else {
          lyr.active = -1;
        }
      }
    }

    function frame() {
      syncLyrics();
      requestAnimationFrame(frame);
    }

    // ---- Android TV: remote / D-pad ---------------------------------------
    // Dipanggil dari aplikasi (menu TV & tombol Back).
    root.__adfreeUi = {
      toggleLyrics: () => ui && toggleLyrics(),
      back() {
        if (lyr.open) { toggleLyrics(false); return true; }
        return false;
      },
    };

    const FOCUSABLE = 'a[href], button, input, textarea, [role="button"], [role="link"], [role="tab"], [role="option"], ' +
      '[role="menuitem"], [role="checkbox"], [role="slider"], tp-yt-paper-icon-button, tp-yt-paper-item, [tabindex]:not([tabindex="-1"])';
    const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    let focused = null;

    function setFocus(el) {
      if (focused) focused.classList.remove('adfree-tv-focus');
      focused = el;
      el.classList.add('adfree-tv-focus');
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }

    function isShown(el) {
      if (el.closest('[hidden], [aria-hidden="true"]')) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none';
    }

    // Pilih elemen terdekat ke arah panah (navigasi spasial sederhana).
    function moveFocus(dir) {
      const current = focused && focused.isConnected ? focused : null;
      const items = $$(FOCUSABLE).filter((el) => el !== current && !(current && (current.contains(el) || el.contains(current))));
      const c = current ? current.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
      const scored = [];
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        let main, cross;
        if (dir === 'down') { if (r.top < c.bottom - 4 && y <= cy + 4) continue; main = y - cy; cross = r.right < c.left ? c.left - r.right : r.left > c.right ? r.left - c.right : 0; }
        if (dir === 'up') { if (r.bottom > c.top + 4 && y >= cy - 4) continue; main = cy - y; cross = r.right < c.left ? c.left - r.right : r.left > c.right ? r.left - c.right : 0; }
        if (dir === 'right') { if (r.left < c.right - 4 && x <= cx + 4) continue; main = x - cx; cross = r.bottom < c.top ? c.top - r.bottom : r.top > c.bottom ? r.top - c.bottom : 0; }
        if (dir === 'left') { if (r.right > c.left + 4 && x >= cx - 4) continue; main = cx - x; cross = r.bottom < c.top ? c.top - r.bottom : r.top > c.bottom ? r.top - c.bottom : 0; }
        if (!current) { main = Math.abs(y); cross = Math.abs(x); if (r.bottom < 0 || r.top > innerHeight) continue; }
        if (main <= 0) continue;
        scored.push({ el, score: main + cross * 3 });
      }
      scored.sort((a, b) => a.score - b.score);
      const best = scored.slice(0, 25).find((s) => isShown(s.el));
      if (best) setFocus(best.el);
      else if (current && (dir === 'down' || dir === 'up')) window.scrollBy({ top: dir === 'down' ? 300 : -300, behavior: 'smooth' });
    }

    function onTvKey(e) {
      // Panel lirik terbuka: kiri/kanan menggeser waktu lirik.
      if (lyr.open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        lyr.offset = Math.round((lyr.offset + (e.key === 'ArrowRight' ? 0.5 : -0.5)) * 10) / 10;
        lyr.active = -1;
        ui.updateOffset();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      // YouTube (tampilan TV) sudah punya navigasi remote sendiri; D-pad buatan hanya untuk YouTube Music.
      if (!isMusic) return;
      const dir = DIRS[e.key];
      const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (dir) {
        if (typing && (dir === 'left' || dir === 'right')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        moveFocus(dir);
      } else if (e.key === 'Enter' && focused && focused.isConnected && !typing) {
        if (!/^(A|BUTTON)$/.test(focused.tagName)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          focused.click();
        }
      }
    }
    if (env.tv) window.addEventListener('keydown', onTvKey, true);

    // ---- Loop utama ------------------------------------------------------
    function tick() {
      skipAds();
      reportState();
      if (!ui) return;
      const onWatch = isMusic || location.pathname === '/watch' || location.hash.startsWith('#/watch');
      const fullscreen = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      ui.dock.classList.toggle('adfree-hidden', fullscreen);
      ui.lyricsBtn.classList.toggle('adfree-hidden', !onWatch);
      if (!onWatch && lyr.open) toggleLyrics(false);
      if (lyr.open) {
        const track = currentTrack();
        if (track && track.title + '|' + track.artist !== lyr.key) loadLyrics(track);
      }
    }

    function start() {
      ui = buildUi();
      new MutationObserver(skipAds).observe(document.documentElement, {
        subtree: true, childList: true, attributes: true, attributeFilter: ['class'],
      });
      setInterval(tick, 400);
      requestAnimationFrame(frame);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    return { control };
  }

  const api = { pruneAds, initAdFree, _internal: { cleanTitle, cleanArtist, parseLrc, findLyrics } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.__adfreeCore = api;
})(typeof window !== 'undefined' ? window : this);
