/* ============================================================
   Page registry
   Each module in js/pages/ adds its own screens with
   Object.assign(PAGES, ...) — the same contract Pickleball uses.
   A page is { render(host, params, query), auth?, roles?, title? }.
   ============================================================ */

const PAGES = (function () {
  return {};
})();

window.PAGES = PAGES;
