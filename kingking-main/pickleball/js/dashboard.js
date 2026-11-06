/* ============================================================
   Dashboard layout scraps shared by the shell pages.
   The dashboard itself lives in js/pages/home.js and reads every
   number from the store — nothing in here renders data.
   ============================================================ */

const DASH = (function () {

  function head(title, sub) {
    const club = (window.Store && Store.settings && Store.settings.club) || CLUB;
    return '<div class="page-head">' +
      '<div><h1 class="page-title">' + title + '</h1>' +
      '<p class="page-sub">' + sub + '</p></div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span class="loc-chip">' + icon('map-pin', 16) + club.city + ', ' + club.province + '</span>' +
      '<span class="loc-chip"><i class="live"></i>Manila GMT+8</span>' +
      '</div></div>';
  }

  function tools(list) {
    return '<div class="card-tools">' + list.map(t =>
      '<button class="mini-btn round" data-action="' + t + '" aria-label="' + t + '">' +
      icon(t === 'download' ? 'download' : t === 'plus' ? 'plus' : 'expand', 15) + '</button>'
    ).join('') + '</div>';
  }

  function legend(series) {
    return '<div class="legend">' + series.map(s =>
      '<span><i style="background:' + s.color + '"></i>' + s.key + '</span>').join('') + '</div>';
  }

  function faces(list, tone) {
    const tones = ['#6b7cff', '#2fb37c', '#e0607e', '#f4a036', '#8b7cf6'];
    return '<div class="who">' + list.map((f, i) =>
      '<i style="background:' + (tone || tones[i % tones.length]) + '">' + f + '</i>').join('') + '</div>';
  }

  return { head, tools, legend, faces };
})();
