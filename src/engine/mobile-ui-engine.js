export const MOBILE_BREAKPOINT = 500;

/** True when viewport width ≤ 500px. */
export function isMobileUi() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

/** Blur any focused input/textarea/select to close the mobile keyboard. */
export function blurActiveInput() {
  const el = document.activeElement;
  if (!el) return;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    el.blur();
  }
}

/** Reset scroll and position properties on html/body to restore viewport after keyboard. */
export function resetViewportStyles() {
  blurActiveInput();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  ['height', 'position', 'top', 'overflow', 'width'].forEach((p) => {
    document.documentElement.style.removeProperty(p);
    document.body.style.removeProperty(p);
  });
}

/**
 * Detect if mobile keyboard is open by comparing innerHeight vs visualViewport height.
 * Keyboard is considered open if the gap is > 120px.
 * @param {VisualViewport | null} vp
 */
export function isKeyboardOpen(vp) {
  if (!vp) return false;
  return window.innerHeight - vp.height > 120;
}

/**
 * Detect if the viewport has scrolled or shifted (e.g. by soft keyboard).
 * @param {VisualViewport | null} vp
 */
export function isViewportShifted(vp) {
  const scrolled = window.scrollY > 8;
  const offsetShifted = vp && vp.offsetTop > 8;
  return scrolled || offsetShifted;
}

/**
 * Determine if the viewport restore button should be visible.
 * @param {VisualViewport | null} vp
 */
export function shouldShowViewportRestoreBtn(vp) {
  return isKeyboardOpen(vp) || isViewportShifted(vp);
}
