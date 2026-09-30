/* GENERATED FILE — jangan edit langsung. Sumber: shared/src/core/*.js (npm run build:core) */
var __adfreeCoreApi = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // shared/src/core/index.js
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default,
    initAdFree: () => initAdFree
  });

  // shared/src/core/utils.js
  var $ = (sel, el) => (el || document).querySelector(sel);
  var $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  var firstOf = (sels) => {
    for (const s of sels) {
      const e = $(s);
      if (e) return e;
    }
    return null;
  };
  var mainVideo = () => firstOf(["#movie_player video", "ytmusic-player video", "video"]);
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of children) if (c != null) el.append(c);
    return el;
  }
  function icon(d) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "currentColor");
    svg.append(p);
    return svg;
  }
  var ICON_MUSIC = "M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z";
  var ICON_VIDEO = "M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z";
  var ICON_LYRICS = "M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4zm13-2.5v5l4-2.5z";
  var ICON_CLOSE = "M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 19 19 17.6 13.4 12z";

  // shared/src/core/track-utils.js
  var JUNK = /\b(official|video|audio|lyrics?|lirik|mv|m\/v|visuali[sz]er|hd|hq|4k|remaster(ed)?|explicit|clean|color coded|performance)\b/i;
  function cleanTitle(t) {
    return t.replace(/[(\[[\u3010][^)\]\u3011]*[)\]\u3011]/g, (m) => JUNK.test(m) ? "" : m).replace(/\s+(ft\.?|feat\.?|featuring)\s.*$/i, "").replace(/\s*\|.*$/, "").replace(/\s{2,}/g, " ").trim();
  }
  function cleanArtist(a) {
    return a.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").replace(/\s+(ft\.?|feat\.?)\s.*$/i, "").trim();
  }
  function parseLrc(text) {
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const tags = [...raw.matchAll(/\[(\d+):(\d+(?:[.,:]\d+)?)\]/g)];
      if (!tags.length) continue;
      const words = raw.replace(/\[[^\]]*\]/g, "").trim();
      for (const t of tags) out.push({ t: +t[1] * 60 + parseFloat(t[2].replace(/[:,]/, ".")), text: words });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  var LRCLIB = "https://lrclib.net/api";
  async function findLyrics(fetchJson, track) {
    const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    const firstArtist = track.artist.split(/\s*(?:,|&| x | and | dan )\s*/i)[0];
    if (track.artist) {
      const exact = await fetchJson(`${LRCLIB}/get?` + q({ track_name: track.title, artist_name: track.artist, duration: track.duration }));
      if (exact && (exact.syncedLyrics || exact.plainLyrics)) return exact;
    }
    const results = await fetchJson(`${LRCLIB}/search?` + q({ track_name: track.title, artist_name: firstArtist })) || [];
    let list = Array.isArray(results) ? results : [];
    if (!list.length) {
      const loose = await fetchJson(`${LRCLIB}/search?` + q({ q: `${track.title} ${firstArtist}`.trim() }));
      list = Array.isArray(loose) ? loose : [];
    }
    const diff = (r) => track.duration && r.duration ? Math.abs(r.duration - track.duration) : 0;
    const synced = list.filter((r) => r.syncedLyrics && diff(r) <= 6).sort((a, b) => diff(a) - diff(b));
    return synced[0] || list.find((r) => r.syncedLyrics && !track.duration) || list.find((r) => r.plainLyrics) || null;
  }

  // shared/src/core/ad-prune.js
  function pruneAds() {
    if (window.__adfreePrune) return;
    window.__adfreePrune = true;
    const AD_KEYS = ["adPlacements", "adSlots", "playerAds", "adBreakHeartbeatParams"];
    const prune = (o) => {
      if (o && typeof o === "object") {
        for (const k of AD_KEYS) if (k in o) delete o[k];
        if (o.playerResponse) prune(o.playerResponse);
      }
      return o;
    };
    const origParse = JSON.parse;
    JSON.parse = function() {
      return prune(origParse.apply(this, arguments));
    };
    const origJson = Response.prototype.json;
    Response.prototype.json = function() {
      return origJson.apply(this, arguments).then(prune);
    };
    let initialPR;
    try {
      Object.defineProperty(window, "ytInitialPlayerResponse", {
        configurable: true,
        get: () => initialPR,
        set: (v) => {
          initialPR = prune(v);
        }
      });
    } catch (e) {
    }
  }

  // shared/src/core/ad-skip.js
  function createSkipper(deps) {
    const { $: $2, $$: $$2, firstOf: firstOf2, mainVideo: mainVideo2, isAdblockOn } = deps;
    const SKIP = ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot button, .ytp-ad-skip-button-container button";
    let mutedByUs = false;
    return function skipAds() {
      if (!isAdblockOn()) return;
      const player = $2("#movie_player") || $2(".html5-video-player");
      const video = mainVideo2();
      if (player && video) {
        if (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting")) {
          if (!video.muted) {
            video.muted = true;
            mutedByUs = true;
          }
          video.playbackRate = 16;
          if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration;
          $$2(SKIP).forEach((b) => b.click());
        } else if (mutedByUs) {
          video.muted = false;
          video.playbackRate = 1;
          mutedByUs = false;
        }
      }
      const enforcement = $$2("ytd-enforcement-message-view-model");
      if (enforcement.length) {
        enforcement.forEach((el) => (el.closest("tp-yt-paper-dialog") || el).remove());
        $$2("tp-yt-iron-overlay-backdrop").forEach((b) => b.remove());
        if (video && video.paused) video.play();
      }
      const stillThere = firstOf2(["ytmusic-you-there-renderer button", "yt-confirm-dialog-renderer #confirm-button button"]);
      if (stillThere && $2("ytmusic-you-there-renderer, yt-confirm-dialog-renderer")) stillThere.click();
    };
  }

  // shared/src/core/player.js
  function createPlayer(deps) {
    const { $: $2, firstOf: firstOf2, mainVideo: mainVideo2, onState } = deps;
    function clickFirst(sels) {
      const el = firstOf2(sels);
      if (el) el.click();
      return !!el;
    }
    function control(action) {
      const video = mainVideo2();
      if (action === "play" && video) video.play();
      if (action === "pause" && video) video.pause();
      if (action === "toggle" && video) video.paused ? video.play() : video.pause();
      if (action === "next") {
        clickFirst([
          "ytmusic-player-bar .next-button",
          ".ytp-next-button",
          ".player-controls-next-button button",
          '[aria-label="Next"]',
          '[aria-label="Next video"]',
          '[aria-label="Berikutnya"]',
          '[aria-label="Video berikutnya"]'
        ]);
      }
      if (action === "prev") {
        const done = clickFirst([
          "ytmusic-player-bar .previous-button",
          '.ytp-prev-button:not([style*="none"])',
          ".player-controls-prev-button button",
          '[aria-label="Previous"]',
          '[aria-label="Sebelumnya"]'
        ]);
        if (!done && video) video.currentTime = 0;
      }
    }
    function rawTrack() {
      const md = navigator.mediaSession && navigator.mediaSession.metadata;
      const bar = $2("ytmusic-player-bar");
      const title = md && md.title || bar && $2(".title", bar)?.textContent.trim() || "";
      const artist = md && md.artist || bar && $2(".byline", bar)?.textContent.split("\u2022")[0].trim() || "";
      const art = md && md.artwork && md.artwork.length && md.artwork[md.artwork.length - 1].src || "";
      return { title, artist, art };
    }
    let lastState = "";
    function reportState() {
      const { title, artist, art } = rawTrack();
      const video = mainVideo2();
      const playing = !!video && !video.paused && !video.ended;
      const state = JSON.stringify([title, artist, art, playing]);
      if (state !== lastState && title) {
        lastState = state;
        onState(title, artist, art, playing);
      }
    }
    return { control, rawTrack, reportState };
  }

  // shared/src/core/lyrics.js
  function createLyricsPanel(deps) {
    const {
      $: $2,
      $$: $$2,
      h: h2,
      icon: icon2,
      ICON_LYRICS: ICON_LYRICS2,
      ICON_VIDEO: ICON_VIDEO2,
      ICON_MUSIC: ICON_MUSIC2,
      ICON_CLOSE: ICON_CLOSE2,
      mainVideo: mainVideo2,
      isMusic,
      tv,
      fetchJson,
      cleanTitle: cleanTitle2,
      cleanArtist: cleanArtist2,
      MUSIC_URL: MUSIC_URL2,
      YT_URL,
      HIDE: HIDE2,
      CSS: CSS2
    } = deps;
    const lyr = {
      open: false,
      key: "",
      lines: null,
      plain: null,
      status: "",
      offset: 0,
      active: -1,
      loadSeq: 0,
      userScrollUntil: 0,
      cache: /* @__PURE__ */ new Map()
    };
    let ui = null;
    function currentTrack() {
      let { title, artist } = rawTrack();
      if (!title) return null;
      if (!isMusic) {
        const m = title.match(/^(.+?)\s+[-\u2013\u2014]\s+(.+)$/);
        if (m) {
          artist = m[1];
          title = m[2];
        }
      }
      const video = mainVideo2();
      const duration = video && Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      return { title: cleanTitle2(title), artist: cleanArtist2(artist), duration };
    }
    function rawTrack() {
      const md = navigator.mediaSession && navigator.mediaSession.metadata;
      const bar = $2("ytmusic-player-bar");
      const title = md && md.title || bar && $2(".title", bar)?.textContent.trim() || "";
      const artist = md && md.artist || bar && $2(".byline", bar)?.textContent.split("\u2022")[0].trim() || "";
      const art = md && md.artwork && md.artwork.length && md.artwork[md.artwork.length - 1].src || "";
      return { title, artist, art };
    }
    async function loadLyrics(track) {
      const key = track.title + "|" + track.artist;
      lyr.key = key;
      lyr.offset = 0;
      lyr.active = -1;
      const seq = ++lyr.loadSeq;
      let res = lyr.cache.get(key);
      if (!res) {
        lyr.lines = lyr.plain = null;
        lyr.status = "Mencari lirik\u2026";
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
      lyr.status = res.none ? "Lirik untuk lagu ini belum tersedia." : "";
      render(track);
    }
    function mount() {
      const style = h2("style", { id: "adfree-style" });
      style.textContent = HIDE2 + "\n" + CSS2;
      (document.head || document.documentElement).append(style);
      const siteClass = isMusic ? "adfree-music" : "adfree-yt";
      const switchBtn = h2("button", {
        class: "adfree-fab",
        title: isMusic ? "Buka YouTube" : "Buka YouTube Music",
        onclick: () => {
          if (!dock.dragged) location.href = isMusic ? YT_URL : MUSIC_URL2;
        }
      }, icon2(isMusic ? ICON_VIDEO2 : ICON_MUSIC2));
      const lyricsBtn = h2("button", {
        id: "adfree-lyrics-btn",
        class: "adfree-fab",
        title: "Lirik real-time",
        onclick: () => {
          if (!dock.dragged) toggleLyrics();
        }
      }, icon2(ICON_LYRICS2));
      const dock = h2("div", { id: "adfree-dock", class: siteClass + (tv ? " adfree-tv" : "") }, lyricsBtn, switchBtn);
      const posKey = "adfree-dock-top-" + (isMusic ? "music" : "yt");
      try {
        const saved = localStorage.getItem(posKey);
        if (saved) {
          dock.style.top = saved;
          dock.style.bottom = "auto";
        }
      } catch (e) {
      }
      dock.addEventListener("pointerdown", (e) => {
        const startY = e.clientY, startTop = dock.getBoundingClientRect().top;
        dock.dragged = false;
        const move = (ev) => {
          const dy = ev.clientY - startY;
          if (Math.abs(dy) > 6) dock.dragged = true;
          if (!dock.dragged) return;
          const top = Math.min(Math.max(8, startTop + dy), window.innerHeight - dock.offsetHeight - 8);
          dock.style.top = top + "px";
          dock.style.bottom = "auto";
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          if (dock.dragged) {
            try {
              localStorage.setItem(posKey, dock.style.top);
            } catch (e2) {
            }
          }
          setTimeout(() => dock.dragged = false, 0);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
      const title = h2("div", { class: "adfree-lh-title" });
      const artist = h2("div", { class: "adfree-lh-artist" });
      const offsetLabel = h2("span");
      const shift = (d) => {
        lyr.offset = Math.round((lyr.offset + d) * 10) / 10;
        lyr.active = -1;
        updateOffset();
      };
      const offset = h2(
        "div",
        { class: "adfree-offset", title: "Geser waktu lirik kalau tidak pas" },
        h2("button", { class: "adfree-btn", onclick: () => shift(-0.5) }, "\u2212"),
        offsetLabel,
        h2("button", { class: "adfree-btn", onclick: () => shift(0.5) }, "+")
      );
      const close = h2("button", { class: "adfree-btn", title: "Tutup", onclick: () => toggleLyrics(false) }, icon2(ICON_CLOSE2));
      const body = h2("div", { class: "adfree-lbody" });
      const markScroll = () => lyr.userScrollUntil = Date.now() + 3500;
      body.addEventListener("wheel", markScroll, { passive: true });
      body.addEventListener("touchmove", markScroll, { passive: true });
      const panel = h2(
        "div",
        { id: "adfree-lyrics", class: siteClass + (tv ? " adfree-tv" : "") + " adfree-hidden" },
        h2("div", { class: "adfree-lh" }, h2("div", { class: "adfree-lh-text" }, title, artist), offset, close),
        body,
        h2("div", { class: "adfree-lf" }, tv ? "Lirik dari LRCLIB (lrclib.net) \xB7 \u25C0 \u25B6 geser waktu lirik \xB7 Back untuk menutup" : "Lirik dari LRCLIB (lrclib.net) \xB7 ketuk baris untuk lompat")
      );
      document.body.append(dock, panel);
      function updateOffset() {
        offsetLabel.textContent = (lyr.offset > 0 ? "+" : "") + lyr.offset.toFixed(1) + "s";
      }
      updateOffset();
      ui = { dock, panel, lyricsBtn, title, artist, body, offset, updateOffset };
      return ui;
    }
    function render(track) {
      if (!ui) return;
      ui.title.textContent = track ? track.title : "";
      ui.artist.textContent = track ? track.artist : "";
      ui.updateOffset();
      ui.offset.style.display = lyr.lines ? "" : "none";
      ui.body.replaceChildren();
      ui.body.classList.toggle("adfree-plain", !lyr.lines);
      if (lyr.status) {
        ui.body.append(h2("div", { class: "adfree-status" }, lyr.status));
      } else if (lyr.lines) {
        lyr.lines.forEach((line, i) => {
          ui.body.append(h2("p", {
            class: "adfree-line",
            "data-i": String(i),
            onclick: () => {
              const v = mainVideo2();
              if (v) {
                v.currentTime = Math.max(0, line.t - lyr.offset + 0.05);
                lyr.userScrollUntil = 0;
              }
            }
          }, line.text || "\u266A"));
        });
      } else if (lyr.plain) {
        lyr.plain.forEach((l) => ui.body.append(h2("p", { class: "adfree-line" }, l || " ")));
      }
      ui.body.scrollTop = 0;
    }
    function syncLyrics() {
      if (!lyr.open || !lyr.lines || !ui) return;
      const v = mainVideo2();
      if (!v) return;
      const t = v.currentTime + lyr.offset + 0.15;
      let i = -1;
      for (let lo = 0, hi = lyr.lines.length - 1; lo <= hi; ) {
        const mid = lo + hi >> 1;
        if (lyr.lines[mid].t <= t) {
          i = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (i === lyr.active) return;
      lyr.active = i;
      const els = ui.body.children;
      for (let k = 0; k < els.length; k++) {
        els[k].classList.toggle("adfree-now", k === i);
        els[k].classList.toggle("adfree-past", k < i);
      }
      if (i >= 0 && Date.now() > lyr.userScrollUntil) {
        const el = els[i];
        ui.body.scrollTop = el.offsetTop - ui.body.clientHeight / 2 + el.offsetHeight / 2;
      }
    }
    function toggleLyrics(force) {
      lyr.open = typeof force === "boolean" ? force : !lyr.open;
      ui.panel.classList.toggle("adfree-hidden", !lyr.open);
      ui.lyricsBtn.classList.toggle("adfree-active", lyr.open);
      if (lyr.open) {
        const track = currentTrack();
        if (!track) {
          lyr.status = "Putar lagu dulu, lalu buka lirik.";
          lyr.key = "";
          render(null);
        } else if (track.title + "|" + track.artist !== lyr.key || !lyr.cache.has(lyr.key)) {
          loadLyrics(track);
        } else {
          lyr.active = -1;
        }
      }
    }
    function tickUi({ onWatch, fullscreen }) {
      if (!ui) return;
      ui.dock.classList.toggle("adfree-hidden", fullscreen);
      ui.lyricsBtn.classList.toggle("adfree-hidden", !onWatch);
      if (!onWatch && lyr.open) toggleLyrics(false);
      if (lyr.open) {
        const track = currentTrack();
        if (track && track.title + "|" + track.artist !== lyr.key) loadLyrics(track);
      }
    }
    function backIfOpen() {
      if (lyr.open) {
        toggleLyrics(false);
        return true;
      }
      return false;
    }
    return { lyr, ui: () => ui, mount, render, syncLyrics, toggleLyrics, currentTrack, tickUi, backIfOpen };
  }

  // shared/src/core/tv.js
  function createTvNav(deps) {
    const { $$: $$2, firstOf: firstOf2, isMusic, panel } = deps;
    const FOCUSABLE = 'a[href], button, input, textarea, [role="button"], [role="link"], [role="tab"], [role="option"], [role="menuitem"], [role="checkbox"], [role="slider"], tp-yt-paper-icon-button, tp-yt-paper-item, [tabindex]:not([tabindex="-1"])';
    const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    let focused = null;
    function setFocus(el) {
      if (focused) focused.classList.remove("adfree-tv-focus");
      focused = el;
      el.classList.add("adfree-tv-focus");
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
    function isShown(el) {
      if (el.closest('[hidden], [aria-hidden="true"]')) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && cs.pointerEvents !== "none";
    }
    function moveFocus(dir) {
      const current = focused && focused.isConnected ? focused : null;
      const items = $$2(FOCUSABLE).filter((el) => el !== current && !(current && (current.contains(el) || el.contains(current))));
      const c = current ? current.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
      const scored = [];
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        let main, cross;
        if (dir === "down") {
          if (r.top < c.bottom - 4 && y <= cy + 4) continue;
          main = y - cy;
          cross = r.right < c.left ? c.left - r.right : r.left > c.right ? r.left - c.right : 0;
        }
        if (dir === "up") {
          if (r.bottom > c.top + 4 && y >= cy - 4) continue;
          main = cy - y;
          cross = r.right < c.left ? c.left - r.right : r.left > c.right ? r.left - c.right : 0;
        }
        if (dir === "right") {
          if (r.left < c.right - 4 && x <= cx + 4) continue;
          main = x - cx;
          cross = r.bottom < c.top ? c.top - r.bottom : r.top > c.bottom ? r.top - c.bottom : 0;
        }
        if (dir === "left") {
          if (r.right > c.left + 4 && x >= cx - 4) continue;
          main = cx - x;
          cross = r.bottom < c.top ? c.top - r.bottom : r.top > c.bottom ? r.top - c.bottom : 0;
        }
        if (!current) {
          main = Math.abs(y);
          cross = Math.abs(x);
          if (r.bottom < 0 || r.top > innerHeight) continue;
        }
        if (main <= 0) continue;
        scored.push({ el, score: main + cross * 3 });
      }
      scored.sort((a, b) => a.score - b.score);
      const best = scored.slice(0, 25).find((s) => isShown(s.el));
      if (best) setFocus(best.el);
      else if (current && (dir === "down" || dir === "up")) window.scrollBy({ top: dir === "down" ? 300 : -300, behavior: "smooth" });
    }
    function onTvKey(e) {
      const lyr = panel.lyr;
      if (lyr.open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        lyr.offset = Math.round((lyr.offset + (e.key === "ArrowRight" ? 0.5 : -0.5)) * 10) / 10;
        lyr.active = -1;
        panel.ui().updateOffset();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (!isMusic) return;
      const dir = DIRS[e.key];
      const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (dir) {
        if (typing && (dir === "left" || dir === "right")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        moveFocus(dir);
      } else if (e.key === "Enter" && focused && focused.isConnected && !typing) {
        if (!/^(A|BUTTON)$/.test(focused.tagName)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          focused.click();
        }
      }
    }
    return { onTvKey };
  }

  // shared/src/core/styles.js
  var HIDE = [
    // YouTube Music
    "ytmusic-mealbar-promo-renderer",
    "ytmusic-statement-banner-renderer",
    "ytmusic-popup-container tp-yt-paper-dialog:has(ytmusic-mealbar-promo-renderer)",
    // Pemutar
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-image-overlay",
    ".ytp-ad-text-overlay",
    "#player-ads",
    ".video-ads",
    // YouTube desktop: beranda, pencarian, halaman tonton, Shorts
    "#masthead-ad",
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-banner-promo-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-display-ad-renderer",
    "ytd-companion-slot-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "ytd-statement-banner-renderer",
    "ytd-merch-shelf-renderer",
    "ytd-search-pyv-renderer",
    "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
    "ytd-rich-section-renderer:has(ytd-statement-banner-renderer)",
    "ytd-reel-video-renderer:has(.ytd-ad-slot-renderer)",
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    // YouTube mobile (m.youtube.com)
    "ad-slot-renderer",
    "ytm-promoted-sparkles-web-renderer",
    "ytm-promoted-video-renderer",
    "ytm-companion-ad-renderer",
    "ytm-rich-item-renderer:has(ad-slot-renderer)",
    "ytm-banner-promo-renderer",
    "ytm-statement-banner-renderer",
    "ytm-promoted-sparkles-text-search-renderer",
    "ytm-item-section-renderer:has(ad-slot-renderer)",
    "ytm-reel-item-renderer:has(ad-slot-renderer)",
    "ytm-mealbar-promo-renderer"
  ].join(",\n") + " { display: none !important; }";
  var CSS = `
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

  // shared/src/core/index.js
  var MUSIC_URL = "https://music.youtube.com/";
  function initAdFree(env) {
    const host = location.hostname;
    if (!/(^|\.)youtube\.com$/.test(host)) return { control() {
    } };
    const isMusic = host === "music.youtube.com";
    const YT_URL = env.platform === "android" ? "https://m.youtube.com/" : "https://www.youtube.com/";
    const panel = createLyricsPanel({
      $,
      $$,
      h,
      icon,
      ICON_LYRICS,
      ICON_VIDEO,
      ICON_MUSIC,
      ICON_CLOSE,
      mainVideo,
      isMusic,
      tv: !!env.tv,
      fetchJson: env.fetchJson,
      cleanTitle,
      cleanArtist,
      MUSIC_URL,
      YT_URL,
      HIDE,
      CSS
    });
    const skipAds = createSkipper({ $, $$, firstOf, mainVideo, isAdblockOn: env.isAdblockOn });
    const player = createPlayer({ $, firstOf, mainVideo, onState: env.onState });
    window.__adfreeControl = player.control;
    if (env.tv) {
      const tvNav = createTvNav({ $$, firstOf, isMusic, panel });
      window.addEventListener("keydown", tvNav.onTvKey, true);
    }
    window.__adfreeUi = {
      toggleLyrics: () => panel.ui() && panel.toggleLyrics(),
      back: () => panel.backIfOpen()
    };
    function tick() {
      skipAds();
      player.reportState();
      if (!panel.ui()) return;
      const onWatch = isMusic || location.pathname === "/watch" || location.hash.startsWith("#/watch");
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
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      setInterval(tick, 400);
      requestAnimationFrame(frame);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
    return { control: player.control };
  }
  var api = {
    pruneAds,
    initAdFree,
    _internal: { cleanTitle, cleanArtist, parseLrc, findLyrics }
  };
  var index_default = api;
  return __toCommonJS(index_exports);
})();
const __adfreeApi = __adfreeCoreApi.default || __adfreeCoreApi;
if (typeof module !== "undefined" && module.exports) {
  module.exports = __adfreeApi;
} else {
  window.__adfreeCore = __adfreeApi;
}
