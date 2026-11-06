/* ============================================================
   Stylised Marawi City map — Lake Lanao to the south, the Agus
   River draining north, and the club venues across the barangays.
   ============================================================ */

const CITYMAP = (function () {

  /* Lanao Lake fills the south and climbs the eastern bay toward
     Patani; the Agus leaves that bay and runs north. */
  const SHORE = 'M0 470 C120 446 220 488 340 470 C450 454 540 470 620 448 ' +
    'C690 428 720 392 762 366 C812 336 860 322 900 314';
  const AGUS = 'M800 348 C778 300 796 254 764 210 C738 174 756 128 726 92 C712 76 712 58 706 42';

  const ROADS = [
    /* Marawi–Iligan arterial (west–east, north side) */
    'M40 130 C180 108 320 150 470 140 C620 130 760 168 866 150',
    /* Lanuza Avenue (through the centre) */
    'M60 262 C200 246 330 288 470 272 C610 256 740 300 866 282',
    /* Governor Adiong road hugging the lake shore */
    'M70 398 C230 372 360 418 500 396 C576 384 610 360 640 332',
    /* vertical spines */
    'M186 60 C196 180 168 300 200 430',
    'M392 54 C382 190 420 320 388 452',
    'M612 62 C628 180 596 300 636 420',
    'M768 74 C756 190 792 300 760 400',
    /* diagonals */
    'M120 200 L300 330', 'M520 180 L700 300', 'M300 120 L470 240'
  ];

  const BLOCKS = [
    [232, 176, 74, 46], [330, 196, 58, 40], [430, 170, 86, 52], [540, 208, 62, 44],
    [652, 176, 78, 48], [742, 214, 60, 40], [186, 300, 70, 44], [300, 316, 84, 50],
    [420, 306, 66, 42], [520, 330, 80, 46], [646, 322, 72, 44], [744, 348, 58, 38],
    [252, 84, 66, 40], [468, 88, 78, 42], [676, 96, 64, 40]
  ];

  function lake() {
    return '<path d="' + SHORE + ' L900 560 L0 560 Z" fill="url(#lakeG)" stroke="none"/>' +
      '<path d="' + SHORE + '" fill="none" stroke="rgba(107,124,255,.4)" stroke-width="2"/>' +
      '<text x="300" y="524" text-anchor="middle" style="font-size:15px;font-weight:800;fill:#6b7cff;opacity:.75;letter-spacing:.14em">LANAO LAKE</text>';
  }

  function river() {
    /* Agus River leaving Lanao Lake at the Patani bay and running north */
    return '<path d="' + AGUS + '" fill="none" stroke="rgba(107,124,255,.42)" stroke-width="9" stroke-linecap="round"/>' +
      '<text x="752" y="196" style="font-size:11px;font-weight:800;fill:#6b7cff;opacity:.7;letter-spacing:.1em" transform="rotate(-72 752 196)">AGUS RIVER</text>';
  }

  function svg(opts) {
    const o = opts || {};
    const active = o.active || null;
    const pins = VENUES.map(v => {
      const col = v.status === 'closed' ? '#8b93a7' : v.status === 'soon' ? '#c3c8d4' : v.status === 'busy' ? '#ef7c33' : '#2fb37c';
      const isActive = active === v.id;
      return '<g class="map-pin' + (isActive ? ' is-active' : '') + '" data-pin="' + v.id + '" tabindex="0" role="button" aria-label="' + v.name + '">' +
        (isActive ? '<circle class="ring" cx="' + v.x + '" cy="' + v.y + '" r="10" fill="none" stroke="' + col + '" stroke-width="2" opacity=".7"/>' : '') +
        '<path d="M' + v.x + ' ' + (v.y + 20) + ' C' + (v.x - 13) + ' ' + (v.y + 4) + ' ' + (v.x - 12) + ' ' + (v.y - 10) + ' ' + v.x + ' ' + (v.y - 12) +
        ' C' + (v.x + 12) + ' ' + (v.y - 10) + ' ' + (v.x + 13) + ' ' + (v.y + 4) + ' ' + v.x + ' ' + (v.y + 20) + ' Z" ' +
        'fill="' + col + '" stroke="var(--card-solid)" stroke-width="2.5"/>' +
        '<circle cx="' + v.x + '" cy="' + (v.y - 3) + '" r="4.6" fill="#fff" opacity=".92"/>' +
        (isActive ? '<text x="' + v.x + '" y="' + (v.y - 22) + '" text-anchor="middle" style="font-size:12px;font-weight:800;fill:var(--ink)">' + v.name + '</text>' : '') +
        '<title>' + v.name + ' — ' + v.barangay + (v.courts ? ' · ' + v.courts + ' courts' : ' · coming soon') + '</title>' +
        '</g>';
    }).join('');

    const labels = [
      [690, 302, 'Patani'], [176, 452, 'Bacong'], [614, 418, 'Pangarungan'], [618, 302, 'Matampay'],
      [448, 266, 'Rorogagus'], [286, 170, 'B. Buadi Itowa'], [322, 82, 'Mipaga Proper'], [392, 414, 'Barrio Green']
    ].map(l => '<text x="' + l[0] + '" y="' + l[1] + '" text-anchor="middle" style="font-size:10.5px;font-weight:700;fill:var(--ink-3);opacity:.85;letter-spacing:.05em">' + l[2].toUpperCase() + '</text>').join('');

    return '<svg viewBox="0 0 900 560" role="img" aria-label="Map of Marawi City club venues">' +
      '<defs>' +
      '<linearGradient id="lakeG" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="rgba(107,124,255,.30)"/><stop offset="100%" stop-color="rgba(107,124,255,.10)"/></linearGradient>' +
      '<pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
      '<line x1="0" y1="0" x2="0" y2="8" stroke="rgba(127,127,160,.14)" stroke-width="2"/></pattern>' +
      '</defs>' +
      '<rect width="900" height="560" fill="url(#hatch)"/>' +
      /* city extent */
      '<path d="M70 40 C260 12 470 34 640 22 C790 12 878 46 884 96 C890 180 866 300 838 400 C812 494 700 540 520 536 C330 532 150 508 92 430 C40 360 46 200 70 40 Z" ' +
      'fill="rgba(255,255,255,.28)" stroke="rgba(127,127,160,.22)" stroke-width="1.5" stroke-dasharray="6 7"/>' +
      BLOCKS.map(b => '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="7" fill="rgba(127,127,160,.13)"/>').join('') +
      ROADS.map(d => '<path d="' + d + '" fill="none" stroke="var(--card-solid)" stroke-width="7" stroke-linecap="round" opacity=".9"/>').join('') +
      ROADS.map(d => '<path d="' + d + '" fill="none" stroke="rgba(127,127,160,.35)" stroke-width="1.4" stroke-dasharray="4 8"/>').join('') +
      river() + lake() + labels + pins +
      /* compass */
      '<g transform="translate(846 62)" opacity=".75">' +
      '<circle r="20" fill="var(--card-solid)" opacity=".8"/>' +
      '<path d="M0 -13 L5 3 L0 -1 L-5 3 Z" fill="#ef4b56"/>' +
      '<text y="-16" text-anchor="middle" style="font-size:9px;font-weight:800;fill:var(--ink-3)">N</text></g>' +
      /* scale */
      '<g transform="translate(40 534)">' +
      '<path d="M0 0 H70" stroke="var(--ink-3)" stroke-width="2"/>' +
      '<path d="M0 -4 V4 M70 -4 V4" stroke="var(--ink-3)" stroke-width="2"/>' +
      '<text x="35" y="-8" text-anchor="middle" style="font-size:9.5px;font-weight:800;fill:var(--ink-3)">2 km</text></g>' +
      '</svg>';
  }

  /* compact map used inside the dashboard card (mirrors "Most Clients by Country") */
  function mini(activeId) {
    const v = VENUES.find(x => x.id === activeId) || VENUES[0];
    return '<svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Marawi City court map">' +
      '<defs><linearGradient id="lakeM" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="rgba(107,124,255,.22)"/><stop offset="100%" stop-color="rgba(107,124,255,.06)"/></linearGradient></defs>' +
      BLOCKS.map(b => '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="7" fill="rgba(127,127,160,.10)"/>').join('') +
      ROADS.map(d => '<path d="' + d + '" fill="none" stroke="var(--card-solid)" stroke-width="9" stroke-linecap="round" opacity=".85"/>').join('') +
      '<path d="' + AGUS + '" fill="none" stroke="rgba(107,124,255,.35)" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="' + SHORE + ' L900 560 L0 560 Z" fill="url(#lakeM)"/>' +
      VENUES.map(x => '<circle cx="' + x.x + '" cy="' + x.y + '" r="5" fill="rgba(127,127,160,.45)"/>').join('') +
      '<g class="map-pin is-active" transform="translate(' + (v.x - 470) + ',' + (v.y - 280) + ')">' +
      '<circle class="ring" cx="470" cy="280" r="10" fill="none" stroke="#ef7c33" stroke-width="2.5" opacity=".7"/>' +
      '<circle cx="470" cy="280" r="13" fill="#ef7c33" stroke="var(--card-solid)" stroke-width="3"/>' +
      '<circle cx="470" cy="280" r="5" fill="#fff"/></g>' +
      '</svg>';
  }

  return { svg, mini };
})();
