// Navigasi D-pad Android TV: pilih elemen terdekat ke arah panah, klik dengan Enter,
// dan geser offset lirik dengan kiri/kanan saat panel terbuka. Hanya aktif untuk
// YouTube Music (tampilan TV YouTube punya navigasi remote sendiri).
//
// deps = { $$, firstOf, isMusic, panel } — panel untuk offset & status lirik.
export function createTvNav(deps) {
  const { $$, firstOf, isMusic, panel } = deps;

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
    const lyr = panel.lyr;
    // Panel lirik terbuka: kiri/kanan menggeser waktu lirik.
    if (lyr.open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      lyr.offset = Math.round((lyr.offset + (e.key === 'ArrowRight' ? 0.5 : -0.5)) * 10) / 10;
      lyr.active = -1;
      panel.ui().updateOffset();
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

  return { onTvKey };
}
