// Peloncat iklan (lapisan cadangan): mute + percepat + klik skip + buang dialog
// anti-adblock / "masih menonton?". deps = { $, $$, firstOf, mainVideo, isAdblockOn }.
export function createSkipper(deps) {
  const { $, $$, firstOf, mainVideo, isAdblockOn } = deps;

  const SKIP = '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot button, .ytp-ad-skip-button-container button';
  let mutedByUs = false;

  return function skipAds() {
    if (!isAdblockOn()) return;
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
  };
}
