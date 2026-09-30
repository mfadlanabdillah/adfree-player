// Kontrol pemutar + pelaporan status lagu ke host (tray/notifikasi/lockscreen).
// deps = { $, firstOf, mainVideo, onState } — onState dari env initAdFree.
export function createPlayer(deps) {
  const { $, firstOf, mainVideo, onState } = deps;

  function clickFirst(sels) {
    const el = firstOf(sels);
    if (el) el.click();
    return !!el;
  }

  // Dipanggil host (tray desktop, notifikasi Android, media key).
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

  function rawTrack() {
    const md = navigator.mediaSession && navigator.mediaSession.metadata;
    const bar = $('ytmusic-player-bar');
    const title = (md && md.title) || (bar && $('.title', bar)?.textContent.trim()) || '';
    const artist = (md && md.artist) || (bar && $('.byline', bar)?.textContent.split('\u2022')[0].trim()) || '';
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
      onState(title, artist, art, playing);
    }
  }

  return { control, rawTrack, reportState };
}
