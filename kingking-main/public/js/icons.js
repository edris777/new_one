/* ============================================================
   Icons — DinkHub's SVG sprite, called the Pickleball way
   The <symbol> set lives in index.html so every path stays
   byte-identical; this only produces the <use> reference.
   ============================================================ */

const ICONS = (function () {
  const NAMES = [
    'pin', 'calendar', 'users', 'paddle', 'search', 'arrow-right', 'arrow-up-right', 'check',
    'shield', 'clock', 'parking', 'shower', 'light', 'wifi', 'water', 'star', 'plus', 'menu',
    'close', 'phone', 'mail', 'grid', 'user', 'logout', 'chevron', 'bolt', 'list', 'trophy'
  ];

  /* Matches templates markup: <svg class="ico"><use href="#i-pin"></use></svg> */
  function icon(name, extraClass) {
    const key = NAMES.indexOf(name) === -1 ? 'check' : name;
    return '<svg class="ico' + (extraClass ? ' ' + extraClass : '') +
      '"><use href="#i-' + key + '"></use></svg>';
  }

  function has(name) {
    return NAMES.indexOf(name) !== -1;
  }

  /* The brand mark from partials/navbar.html — inline, not part of the sprite. */
  function brandMark() {
    return '<span class="brand__mark" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32" fill="none">' +
      '<circle cx="16" cy="16" r="15" stroke="currentColor" stroke-width="1.6" opacity=".55"/>' +
      '<path d="M11 22c-2.6-2.6-2.4-7.6.6-10.6S19.4 8.4 22 11s2.4 7.6-.6 10.6S13.6 24.6 11 22Z" fill="currentColor" opacity=".9"/>' +
      '<path d="M12.6 20.4 20.4 12.6" stroke="#F6F2E9" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="23.4" cy="23.4" r="1.7" fill="#E4692B"/>' +
      '</svg></span>';
  }

  return { icon: icon, has: has, brandMark: brandMark, names: NAMES };
})();

window.icon = ICONS.icon;
window.brandMark = ICONS.brandMark;
window.ICONS = ICONS;
