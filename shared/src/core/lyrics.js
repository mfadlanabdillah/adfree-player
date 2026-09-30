// Panel lirik real-time: state, UI (dock FAB + panel), render, sinkronisasi waktu,
// dan pemuatan lirik LRCLIB dengan cache. Satu modul karena state `lyr` dipakai
// lintas fungsi-fungsi ini — dipecah lagi hanya menciptakan siklus dependency.
//
// deps = { $, $$, h, icon, ICON_LYRICS, ICON_VIDEO, ICON_MUSIC, ICON_CLOSE,
//          mainVideo, isMusic, tv, fetchJson, cleanTitle, cleanArtist,
//          MUSIC_URL, YT_URL, HIDE, CSS }
import { findLyrics, parseLrc } from './track-utils.js';

export function createLyricsPanel(deps) {
  const {
    $, $$, h, icon, ICON_LYRICS, ICON_VIDEO, ICON_MUSIC, ICON_CLOSE,
    mainVideo, isMusic, tv, fetchJson, cleanTitle, cleanArtist,
    MUSIC_URL, YT_URL, HIDE, CSS,
  } = deps;

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
      const m = title.match(/^(.+?)\s+[-\u2013\u2014]\s+(.+)$/);
      if (m) { artist = m[1]; title = m[2]; }
    }
    const video = mainVideo();
    const duration = video && Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
    return { title: cleanTitle(title), artist: cleanArtist(artist), duration };
  }

  function rawTrack() {
    const md = navigator.mediaSession && navigator.mediaSession.metadata;
    const bar = $('ytmusic-player-bar');
    const title = (md && md.title) || (bar && $('.title', bar)?.textContent.trim()) || '';
    const artist = (md && md.artist) || (bar && $('.byline', bar)?.textContent.split('\u2022')[0].trim()) || '';
    const art = (md && md.artwork && md.artwork.length && md.artwork[md.artwork.length - 1].src) || '';
    return { title, artist, art };
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
      lyr.status = 'Mencari lirik\u2026';
      render(track);
      try {
        res = await findLyrics(fetchJson, track);
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

  function mount() {
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
    const dock = h('div', { id: 'adfree-dock', class: siteClass + (tv ? ' adfree-tv' : '') }, lyricsBtn, switchBtn);

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
      h('button', { class: 'adfree-btn', onclick: () => shift(-0.5) }, '\u2212'),
      offsetLabel,
      h('button', { class: 'adfree-btn', onclick: () => shift(0.5) }, '+'));
    const close = h('button', { class: 'adfree-btn', title: 'Tutup', onclick: () => toggleLyrics(false) }, icon(ICON_CLOSE));
    const body = h('div', { class: 'adfree-lbody' });
    const markScroll = () => (lyr.userScrollUntil = Date.now() + 3500);
    body.addEventListener('wheel', markScroll, { passive: true });
    body.addEventListener('touchmove', markScroll, { passive: true });
    const panel = h('div', { id: 'adfree-lyrics', class: siteClass + (tv ? ' adfree-tv' : '') + ' adfree-hidden' },
      h('div', { class: 'adfree-lh' }, h('div', { class: 'adfree-lh-text' }, title, artist), offset, close),
      body,
      h('div', { class: 'adfree-lf' }, tv
        ? 'Lirik dari LRCLIB (lrclib.net) \u00b7 \u25c0 \u25b6 geser waktu lirik \u00b7 Back untuk menutup'
        : 'Lirik dari LRCLIB (lrclib.net) \u00b7 ketuk baris untuk lompat'));

    document.body.append(dock, panel);
    function updateOffset() { offsetLabel.textContent = (lyr.offset > 0 ? '+' : '') + lyr.offset.toFixed(1) + 's'; }
    updateOffset();
    ui = { dock, panel, lyricsBtn, title, artist, body, offset, updateOffset };
    return ui;
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
        }, line.text || '\u266a'));
      });
    } else if (lyr.plain) {
      lyr.plain.forEach((l) => ui.body.append(h('p', { class: 'adfree-line' }, l || ' ')));
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

  // Bagian tick yang menyangkut panel: sembunyikan saat fullscreen/non-watch,
  // tutup panel di luar halaman tonton, muat lirik saat lagu berganti.
  function tickUi({ onWatch, fullscreen }) {
    if (!ui) return;
    ui.dock.classList.toggle('adfree-hidden', fullscreen);
    ui.lyricsBtn.classList.toggle('adfree-hidden', !onWatch);
    if (!onWatch && lyr.open) toggleLyrics(false);
    if (lyr.open) {
      const track = currentTrack();
      if (track && track.title + '|' + track.artist !== lyr.key) loadLyrics(track);
    }
  }

  // Untuk tombol Back Android TV / menu TV (dipanggil lewat window.__adfreeUi).
  function backIfOpen() {
    if (lyr.open) { toggleLyrics(false); return true; }
    return false;
  }

  return { lyr, ui: () => ui, mount, render, syncLyrics, toggleLyrics, currentTrack, tickUi, backIfOpen };
}
