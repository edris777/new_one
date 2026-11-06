/* ============================================================
   Court Tour — a Mapinlay-style cinematic waypoint tour over
   live Marawi City satellite imagery (MapLibre GL + Esri World
   Imagery), with an editor panel and a tour playback bar.
   ============================================================ */

const TOURVIEW = (function () {

  const KEY = 'piklemarawi-tour';
  let map = null;
  let markers = [];
  let timer = null;
  let host = null;
  let live = false;
  let dead = false;

  const st = load();

  function load() {
    let s = { mode: 'tour', idx: 0, playing: false, loop: true, muted: true, panel: true, base: 'satellite', features: { pins: true, route: true, labels: true, places: true }, waypoints: null };
    try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* first run */ }
    s.base = MAPTILES.normalize(s.base);
    if (!s.waypoints) s.waypoints = TOUR.waypoints.map(w => JSON.parse(JSON.stringify(w)));
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  const wp = () => st.waypoints[st.idx] || st.waypoints[0];
  const venueOf = w => VENUES.find(v => v.id === w.venue) || VENUES[0];
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  /* overlays are the single source of truth; the first one also feeds the
     legacy w.heading / w.caption fields the tour data is seeded with */
  function overlays(w) {
    if (!w.overlays || !w.overlays.length) w.overlays = [{ heading: w.heading || '', caption: w.caption || '' }];
    return w.overlays;
  }
  function syncOverlays(w) {
    const first = overlays(w)[0];
    w.heading = first.heading;
    w.caption = first.caption;
  }

  /* ---------------- map ---------------- */
  /* street / satellite / dark from the keyless public tile catalogue; the
     place-label overlay rides on the "Place labels" feature toggle and only
     exists for the bases that ship without printed names */
  function tourStyle() {
    return MAPTILES.style(st.base, { labels: st.features.places });
  }

  function offlineNote() {
    const engine = typeof maplibregl !== 'undefined';
    return '<div class="tour-offline">' + CITYMAP.svg({ active: venueOf(wp()).id }) +
      '<div class="off-note">' + icon('info', 15) + ' ' +
      (engine ? 'None of the public tile services answered — showing the drawn ' + CLUB.city + ' map. ' +
        '<button class="link-btn" data-tp="retrytiles">Retry the live tiles</button>'
        : 'The map engine could not load, so ' + CLUB.city + ' is drawn below.') +
      '</div></div>';
  }

  function showOffline() {
    const el = document.getElementById('tourMap');
    if (el) el.innerHTML = offlineNote();
    paintSrc();
  }

  function pinSVG(color) {
    return '<svg viewBox="0 0 24 32" width="26" height="34" aria-hidden="true">' +
      '<path d="M12 31C12 31 22 18.6 22 11.5A10 10 0 1 0 2 11.5C2 18.6 12 31 12 31Z" fill="' + color + '" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="12" cy="11.4" r="3.6" fill="#fff" opacity=".92"/></svg>';
  }

  function routeGeo() {
    return {
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: st.waypoints.map(w => [w.cam.lng, w.cam.lat]) }
    };
  }

  function addMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
    if (!map || !st.features.pins) return;
    st.waypoints.forEach((w, i) => {
      const el = document.createElement('button');
      el.className = 'tour-pin' + (i === st.idx ? ' is-active' : '');
      el.innerHTML = pinSVG(w.color || '#f4a036');
      el.title = venueOf(w).name;
      el.addEventListener('click', () => jump(i));
      new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([w.cam.lng, w.cam.lat]).addTo(map);
      markers.push({ el: el, remove: () => el.remove() });
    });
  }

  function syncRoute() {
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('tourroute');
    if (st.features.route && !src) {
      map.addSource('tourroute', { type: 'geojson', data: routeGeo() });
      map.addLayer({
        id: 'tourroute-line', type: 'line', source: 'tourroute',
        paint: { 'line-color': '#f4c430', 'line-width': 2.4, 'line-dasharray': [2, 1.6] }
      });
    } else if (src) {
      src.setData(routeGeo());
      map.setLayoutProperty('tourroute-line', 'visibility', st.features.route ? 'visible' : 'none');
    }
    if (map.getLayer('l')) map.setLayoutProperty('l', 'visibility', st.features.places ? 'visible' : 'none');
  }

  function srcLabel() {
    return dead ? 'Drawn club map · no tile service answered'
      : MAPTILES.name(st.base, MAPTILES.current(st.base).index) + ' · no API key';
  }

  function paintSrc() {
    const src = document.querySelector('.tour-src');
    if (src) src.textContent = srcLabel();
  }

  function applyTourStyle() {
    if (!map) return;
    map.setStyle(tourStyle());
    addMarkers();
    paintSrc();
  }

  function buildMap() {
    const el = document.getElementById('tourMap');
    if (!el || typeof maplibregl === 'undefined') return false;
    live = true;
    map = new maplibregl.Map({
      container: el, style: tourStyle(),
      center: [wp().cam.lng, wp().cam.lat], zoom: wp().cam.zoom,
      bearing: wp().cam.bearing, pitch: wp().cam.pitch,
      attributionControl: { compact: true }, maxPitch: 80
    });
    map.dragRotate.disable();
    /* DOM pins place themselves from the camera, so they show before the tiles do;
       the route line is a style layer and has to wait for the style to parse */
    addMarkers();
    map.on('styledata', onStyleReady);
    map.on('load', onStyleReady);
    map.on('move', () => { if (st.mode === 'edit') paintCameraReadout(); });
    map.on('error', e => { if (window.console) console.warn('tour tile', e && e.error && e.error.message); });
    MAPTILES.guard(map, {
      base: () => st.base,
      swap: () => applyTourStyle(),
      offline: () => { dead = true; showOffline(); }
    });
    paintSrc();
    return true;
  }

  function onStyleReady() {
    if (!map || !map.isStyleLoaded()) return;
    syncRoute();
  }

  function fly(w) {
    if (!map) return;
    map.flyTo({
      center: [w.cam.lng, w.cam.lat], zoom: w.cam.zoom,
      bearing: w.cam.bearing, pitch: w.cam.pitch,
      duration: st.mode === 'tour' ? 3400 : 900, curve: 1.42, easeLinearity: .2
    });
  }

  /* ---------------- markup ---------------- */
  function stepper(label, key, unit, min, max, step) {
    return '<div class="cam-field"><span>' + label + '</span>' +
      '<div class="cam-step">' +
      '<button class="mini-btn" data-cam="' + key + '" data-delta="-' + step + '">−</button>' +
      '<input type="number" data-camset="' + key + '" value="' + wp().cam[key] + '" min="' + min + '" max="' + max + '" step="' + step + '" />' +
      '<button class="mini-btn" data-cam="' + key + '" data-delta="' + step + '">+</button>' +
      '</div>' + (unit ? '<i>' + unit + '</i>' : '') + '</div>';
  }

  function editorPanel() {
    const w = wp(), v = venueOf(w);
    const ov = overlays(w);
    return '<div class="tp-head"><button class="mini-btn" data-tp="back">' + icon('chevron-left', 18) + '</button>' +
      '<span class="tp-num">' + (st.idx + 1) + '</span><b>Waypoint ' + (st.idx + 1) + '</b></div>' +
      '<input class="tp-name" data-tpname value="' + w.title.replace(/"/g, '&quot;') + '" />' +

      '<details class="tp-sec" open><summary>' + icon('sparkles', 16) + 'Text Overlays <i>(' + ov.length + ')</i></summary>' +
      ov.map((o, i) => '<div class="tp-row"><span>' + (i + 1) + ' ' + esc(o.heading).slice(0, 22) + '</span>' +
        '<button class="mini-btn" data-tpedit="' + i + '" aria-label="Edit overlay ' + (i + 1) + '">' + icon('pen', 14) + '</button>' +
        '<button class="mini-btn" data-tpdel="' + i + '" aria-label="Delete overlay ' + (i + 1) + '">' + icon('x', 14) + '</button></div>').join('') +
      '<button class="tp-add" data-tp="addtext">+ Add Text <i>(' + ov.length + '/3)</i></button>' +
      '<div class="tp-note">Shift + Enter for new line</div>' +
      '<div class="tp-box">' + ov.map(o => esc(o.heading) + ' — ' + esc(o.caption)).join('<br>') + '</div></details>' +

      '<details class="tp-sec"><summary>' + icon('image', 16) + 'Media <i>(' + (w.media || []).length + ')</i></summary>' +
      (w.media || []).map((m, i) => '<div class="tp-row"><span>' + (m.shape === 'circle' ? 'Circle' : 'Card') + ' · ' + m.src.split('/').pop() + '</span>' +
        '<button class="mini-btn" data-tpmedel="' + i + '">' + icon('x', 14) + '</button></div>').join('') +
      '<button class="tp-add" data-tp="addmedia">+ Add Media</button></details>' +

      '<details class="tp-sec" open><summary>' + icon('map-pin', 16) + 'Location &amp; Camera</summary>' +
      '<div class="tp-search">' + icon('search', 15) + '<input id="tourSearch" placeholder="Search a place…" />' +
      '<button class="mini-btn" data-tp="search">' + icon('chevron-right', 15) + '</button></div>' +
      '<button class="tp-use" data-tp="useview">Use Current View</button>' +
      '<div class="cam-pair"><div class="cam-field"><span>Longitude</span><input type="number" data-camset="lng" step="0.0001" value="' + w.cam.lng + '"></div>' +
      '<div class="cam-field"><span>Latitude</span><input type="number" data-camset="lat" step="0.0001" value="' + w.cam.lat + '"></div></div>' +
      stepper('Zoom', 'zoom', '', 3, 19, .5) +
      stepper('Rotate', 'bearing', '', -180, 180, 10) +
      stepper('Tilt', 'pitch', '', 0, 80, 5) +
      '<p class="tp-hint">Recommended zoom: 3–6 for regions, 10–14 for cities, 15–18 for streets. Higher zoom loads more tiles and may be slower.</p></details>' +

      '<details class="tp-sec"><summary>' + icon('activity', 16) + 'Animations</summary>' +
      '<div class="tp-row"><span>Camera move duration</span><b>' + (w.secs || 6) + 's</b>' +
      '<button class="mini-btn" data-tp="secs-">−</button><button class="mini-btn" data-tp="secs+">+</button></div></details>' +

      '<details class="tp-sec"><summary>' + icon('ball', 16) + 'Marker Style</summary>' +
      '<div class="swatches">' + ['#f4a036', '#6b7cff', '#2fb37c', '#e0607e', '#14161d'].map(c =>
        '<button class="sw' + (w.color === c ? ' is-active' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>').join('') +
      '</div></details>' +

      '<details class="tp-sec"><summary>' + icon('layers', 16) + 'Map Features</summary>' +
      [['pins', 'Waypoint pins'], ['route', 'Route line'], ['places', 'Place labels']].map(f =>
        '<label class="tp-check"><input type="checkbox" data-feat="' + f[0] + '"' + (st.features[f[0]] ? ' checked' : '') + '> ' + f[1] + '</label>').join('') +
      '</details>' +

      '<div class="tp-foot"><button class="mini-btn" data-tp="prev">' + icon('arrow-up', 15) + '</button>' +
      '<b>' + (st.idx + 1) + '/' + st.waypoints.length + '</b>' +
      '<button class="mini-btn" data-tp="next">' + icon('arrow-down', 15) + '</button>' +
      '<button class="mini-btn" data-tp="dup">' + icon('copy', 15) + '</button>' +
      '<button class="mini-btn danger" data-tp="del">' + icon('trash', 15) + '</button>' +
      '<button class="pill-btn primary" data-tp="done">' + icon('check', 15) + 'Done</button></div>';
  }

  function tourPanel() {
    return '<div class="tp-head"><span class="tp-badge">' + icon('ball', 16) + '</span><b>' + TOUR.name + '</b>' +
      '<button class="mini-btn" style="margin-left:auto" data-tp="share">' + icon('share', 15) + '</button></div>' +
      '<div class="wp-list">' + st.waypoints.map((w, i) => {
        const v = venueOf(w);
        return '<article class="wp' + (i === st.idx ? ' is-active' : '') + '" data-wp="' + i + '">' +
          '<div class="wp-k">Waypoint ' + (i + 1) + '</div>' +
          '<div class="wp-thumbs">' + (w.media || []).slice(0, 2).map(m =>
            '<img src="' + m.src + '" alt="' + w.title + '" loading="lazy">').join('') +
          (w.media && w.media.length ? '' : '<span class="wp-noimg">' + icon('map-pin', 20) + '</span>') + '</div>' +
          '<div class="wp-title">' + w.title + '</div>' +
          '<div class="wp-sub">' + w.sub + '</div>' +
          (i === st.idx ? '<div class="wp-next">Next stop: ' + esc((st.waypoints[i + 1] || st.waypoints[0]).title) + ' →</div>' : '') +
          '</article>';
      }).join('') + '</div>' +
      '<div class="tp-foot"><b>' + (st.idx + 1) + '/' + st.waypoints.length + '</b>' +
      '<button class="pill-btn ghost" data-tp="mode-edit" style="margin-left:auto">' + icon('pen', 14) + 'Edit tour</button></div>';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function overlayHTML() {
    const w = wp();
    return '<div class="tour-title"><h2>' + esc(w.title) + '</h2><p>' + esc(w.sub) + '</p></div>' +
      overlays(w).map((o, i) =>
        '<div class="tour-head" style="top:calc(34% + ' + (i * 104) + 'px)">' + esc(o.heading) + '</div>' +
        '<div class="tour-cap" style="top:calc(34% + ' + (54 + i * 104) + 'px)">' + esc(o.caption) + '</div>').join('') +
      (w.media || []).map((m, i) => '<img class="tour-media ' + (m.shape === 'circle' ? 'round' : 'card') +
        '" style="transform:translate(' + (i * 26) + 'px,' + (i * -22) + 'px);z-index:' + (10 - i) + '" src="' + m.src + '" alt="' + esc(w.title) + '">').join('');
  }

  function timeline() {
    return '<div class="tour-timeline">' + st.waypoints.map((w, i) =>
      '<span class="seg' + (i === st.idx ? ' is-active' : '') + (i < st.idx ? ' is-done' : '') + '" data-wp="' + i + '"></span>').join('') + '</div>';
  }

  function bar() {
    return '<div class="tour-bar">' +
      '<button class="tb" data-tp="mute" aria-label="Sound">' + icon(st.muted ? 'mute' : 'volume', 17) + '</button>' +
      '<button class="tb play' + (st.playing ? ' on' : '') + '" data-tp="play" aria-label="Play">' + icon(st.playing ? 'pause' : 'play', 17) + '</button>' +
      '<button class="tb chip" data-tp="mode-tour">DI</button>' +
      '<span class="tb-count">' + (st.idx + 1) + '/' + st.waypoints.length + '</span>' +
      '<button class="tb" data-tp="prev">' + icon('chevron-left', 17) + '</button>' +
      '<button class="tb" data-tp="next" aria-label="Next waypoint">' + icon('chevron-right', 17) + '</button>' +
      '<button class="tb' + (st.loop ? ' on' : '') + '" data-tp="loop">' + icon('loop', 17) + '</button>' +
      '<button class="tb" data-tp="share">' + icon('share', 17) + '</button>' +
      '<button class="tb" data-tp="layout">' + icon('layout', 17) + '</button>' +
      '</div>';
  }

  function baseSwitch() {
    return '<div class="tour-bases"><div class="cmd-seg" role="group" aria-label="Base map">' +
      MAPTILES.BASES.map(b =>
        '<button class="' + (st.base === b ? 'on' : '') + '" data-tp="base-' + b + '">' + cap(b) + '</button>').join('') +
      '</div><span class="tour-src">' + srcLabel() + '</span></div>';
  }

  function html() {
    const surface = typeof maplibregl === 'undefined' ? offlineNote() : '<div id="tourMap"></div>';
    return '<div class="tour' + (st.panel ? '' : ' no-panel') + '">' +
      '<aside class="tour-panel">' + (st.mode === 'edit' ? editorPanel() : tourPanel()) + '</aside>' +
      '<button class="tour-collapse" data-tp="panel">' + icon(st.panel ? 'chevron-left' : 'chevron-right', 16) + '</button>' +
      '<div class="tour-stage">' + surface + baseSwitch() + timeline() +
      '<div class="tour-overlay">' + overlayHTML() + '</div>' +
      '<div class="tour-ctl">' +
      '<button class="mini-btn solid" data-tp="zin">+</button>' +
      '<span class="tc-zoom">' + wp().cam.zoom.toFixed(1) + '</span>' +
      '<button class="mini-btn solid" data-tp="zout">−</button>' +
      '<button class="mini-btn solid" data-tp="north">' + icon('navigation', 15) + '</button>' +
      '<button class="mini-btn solid" data-tp="feat">' + icon('settings', 15) + '</button>' +
      '<button class="mini-btn solid" data-tp="mode-toggle">' + icon('layers', 15) + '</button>' +
      '</div>' + bar() + '</div></div>';
  }

  /* ---------------- behaviour ---------------- */
  function paint() {
    if (!host) return;
    host.innerHTML = html();
    mountMap();
  }

  function mountMap() {
    if (map) { map.remove(); map = null; live = false; }
    if (typeof maplibregl === 'undefined') return;
    MAPTILES.select(st.base).then(res => {
      dead = res.dead;
      if (!host) return;
      if (res.dead) return showOffline();
      if (!buildMap()) showOffline();
    });
  }

  /* switch the base (or retry the tiles) without tearing the tour down */
  function ensureTour(announce, force) {
    MAPTILES.select(st.base, { force: !!force }).then(res => {
      if (!host) return;
      host.querySelectorAll('[data-tp]').forEach(b => {
        if (b.dataset.tp.indexOf('base-') === 0) b.classList.toggle('on', b.dataset.tp === 'base-' + st.base);
      });
      if (res.dead) {
        dead = true; showOffline();
        if (announce) toast('No tile service answered the ' + cap(st.base) + ' view — the drawn club map is below.', 'warn');
        return;
      }
      dead = false;
      const el = document.getElementById('tourMap');
      if (!el) return paint();
      /* only a drawn-map fallback is cleared — wiping the container would
         delete the live canvas MapLibre is rendering into */
      if (el.querySelector('.tour-offline')) el.innerHTML = '';
      if (!map) { if (!buildMap()) return; } else applyTourStyle();
      if (announce) toast(cap(st.base) + ' view · ' +
        MAPTILES.name(st.base, res.index) + ' · no API key needed');
    });
  }

  function paintCameraReadout() {
    const c = document.querySelector('.tc-zoom');
    if (c && map) c.textContent = map.getZoom().toFixed(1);
  }

  function setIdx(i, play) {
    st.idx = (i + st.waypoints.length) % st.waypoints.length;
    save();
    if (st.mode === 'edit') { paint(); } else { refreshTour(); }
    fly(wp());
    if (play !== false) schedule();
  }

  function refreshTour() {
    const ov = document.querySelector('.tour-overlay');
    if (ov) ov.innerHTML = overlayHTML();
    const tl = document.querySelector('.tour-timeline');
    if (tl) tl.outerHTML = timeline();
    const cnt = document.querySelector('.tb-count');
    if (cnt) cnt.textContent = (st.idx + 1) + '/' + st.waypoints.length;
    const foot = document.querySelector('.tp-foot b');
    if (foot && st.mode === 'tour') foot.textContent = (st.idx + 1) + '/' + st.waypoints.length;
    document.querySelectorAll('.wp').forEach((n, i) => n.classList.toggle('is-active', i === st.idx));
    markers.forEach((m, i) => m.el.classList.toggle('is-active', i === st.idx));
  }

  function schedule() {
    clearTimeout(timer);
    if (!st.playing) return;
    timer = setTimeout(() => {
      if (st.idx === st.waypoints.length - 1 && !st.loop) { st.playing = false; save(); refreshTour(); return; }
      setIdx(st.idx + 1);
    }, (wp().secs || 6) * 1000);
  }

  function togglePlay() {
    st.playing = !st.playing; save();
    const b = document.querySelector('.tb.play');
    if (b) { b.classList.toggle('on', st.playing); b.innerHTML = icon(st.playing ? 'pause' : 'play', 17); }
    schedule();
  }

  function setCam(key, val) {
    const w = wp();
    w.cam[key] = val;
    save();
    if (map) map.easeTo({ center: [w.cam.lng, w.cam.lat], zoom: w.cam.zoom, bearing: w.cam.bearing, pitch: w.cam.pitch, duration: 500 });
    syncRoute();
    const inp = document.querySelector('[data-camset="' + key + '"]');
    if (inp && document.activeElement !== inp) inp.value = val;
  }

  /* ---------------- events ---------------- */
  function onClick(e) {
    if (!host) return;
    const t = e.target;

    const wpCard = t.closest('[data-wp]');
    if (wpCard) return setIdx(+wpCard.dataset.wp);

    const cam = t.closest('[data-cam]');
    if (cam) {
      const k = cam.dataset.cam;
      return setCam(k, +(wp().cam[k] + parseFloat(cam.dataset.delta)).toFixed(4));
    }

    const col = t.closest('[data-color]');
    if (col) { wp().color = col.dataset.color; save(); paint(); return; }

    const edit = t.closest('[data-tpedit]');
    if (edit) {
      const w = wp();
      const i = +edit.dataset.tpedit;
      const o = overlays(w)[i];
      if (!o) return;
      return UI.modal({
        title: 'Overlay text ' + (i + 1),
        sub: 'This copy is laid over the tour stage at waypoint ' + (st.idx + 1) + '.',
        size: 'sm',
        body: '<div class="field"><label>Heading</label><input id="ovH" maxlength="60" value="' + esc(o.heading) + '"></div>' +
          '<div class="field"><label>Caption</label><textarea id="ovC" rows="3" maxlength="140">' + esc(o.caption) + '</textarea></div>',
        actions: [{ id: 'ok', label: 'Save overlay', cls: 'accent' }],
        onAction(id, scope) {
          if (id !== 'ok') return;
          const h = scope.querySelector('#ovH').value.trim();
          const c = scope.querySelector('#ovC').value.trim();
          if (!h) { UI.toast('Give the overlay a heading.', 'err'); return false; }
          o.heading = h; o.caption = c;
          syncOverlays(w); save(); paint();
          window.toast('Overlay ' + (i + 1) + ' saved');
        }
      });
    }

    const del = t.closest('[data-tpdel]');
    if (del) {
      const w = wp();
      const list = overlays(w);
      if (list.length <= 1) return toast('A waypoint keeps at least one overlay');
      const gone = list.splice(+del.dataset.tpdel, 1)[0];
      syncOverlays(w); save(); paint();
      return toast('Overlay “' + (gone ? gone.heading : '') + '” removed');
    }

    const medel = t.closest('[data-tpmedel]');
    if (medel) { wp().media.splice(+medel.dataset.tpmedel, 1); save(); paint(); return; }

    const act = t.closest('[data-tp]');
    if (!act) return;
    const a = act.dataset.tp;

    if (a === 'play') return togglePlay();
    if (a === 'prev') return setIdx(st.idx - 1);
    if (a === 'next') return setIdx(st.idx + 1);
    if (a === 'loop') { st.loop = !st.loop; save(); act.classList.toggle('on', st.loop); return; }
    if (a === 'mute') { st.muted = !st.muted; save(); act.innerHTML = icon(st.muted ? 'mute' : 'volume', 17); return toast(st.muted ? 'Sound off' : 'Sound on'); }
    if (a === 'panel') { st.panel = !st.panel; save(); paint(); return; }
    if (a === 'mode-edit') { st.mode = 'edit'; save(); paint(); return; }
    if (a === 'mode-tour' || a === 'done' || a === 'back') { st.mode = 'tour'; save(); paint(); return; }
    if (a === 'mode-toggle') { st.mode = st.mode === 'tour' ? 'edit' : 'tour'; save(); paint(); return; }
    if (a === 'zin') return setCam('zoom', Math.min(19, wp().cam.zoom + .5));
    if (a === 'zout') return setCam('zoom', Math.max(3, wp().cam.zoom - .5));
    if (a === 'north') return setCam('bearing', 0);
    if (a === 'feat') {
      if (!MAPTILES.hasLabels(st.base)) {
        return toast('Street tiles print their own place names — the label layer applies to Satellite and Dark.', 'warn');
      }
      st.features.places = !st.features.places; save();
      const box = document.querySelector('[data-feat="places"]');
      if (box) box.checked = st.features.places;
      applyTourStyle();
      return toast('Place labels ' + (st.features.places ? 'on' : 'off'));
    }
    if (a.indexOf('base-') === 0) {
      st.base = MAPTILES.normalize(a.slice(5)); dead = false; save();
      return ensureTour(true);
    }
    if (a === 'retrytiles') { dead = false; return ensureTour(true, true); }
    if (a === 'share') return shareTour();
    if (a === 'layout') { st.panel = !st.panel; save(); paint(); return; }
    if (a === 'useview') {
      if (!map) return toast('The live view is offline — pan the map first, or retry the tiles.');
      const c = map.getCenter(), z = map.getZoom(), b = map.getBearing(), p = map.getPitch();
      wp().cam = { lng: +c.lng.toFixed(4), lat: +c.lat.toFixed(4), zoom: +z.toFixed(1), bearing: +b.toFixed(0), pitch: +p.toFixed(0) };
      save(); paint(); return toast('Camera captured from the live view');
    }
    if (a === 'search') {
      const q = (document.getElementById('tourSearch') || {}).value || '';
      const hit = st.waypoints.findIndex(w => (w.title + ' ' + w.sub + ' ' + venueOf(w).name).toLowerCase().includes(q.toLowerCase()));
      if (hit < 0) return toast(q ? 'No waypoint matches “' + q + '”' : 'Type a place to search');
      return setIdx(hit);
    }
    if (a === 'addtext') {
      const w = wp();
      const list = overlays(w);
      if (list.length >= 3) return toast('Three overlays is the limit for a waypoint');
      list.push({ heading: 'New overlay', caption: 'Add your line of copy' });
      syncOverlays(w); save(); paint();
      return toast('Overlay ' + list.length + ' added — edit it to write your copy');
    }
    if (a === 'addmedia') {
      const pool = ['img/tour-1.png', 'img/tour-2.png', 'img/tour-3.png'];
      const src = pool[(wp().media || []).length % pool.length];
      wp().media = (wp().media || []).concat([{ src: src, shape: (wp().media || []).length % 2 ? 'card' : 'circle' }]);
      save(); paint(); return toast('Media added to waypoint ' + (st.idx + 1));
    }
    if (a === 'secs-') { wp().secs = Math.max(2, (wp().secs || 6) - 1); save(); paint(); schedule(); return; }
    if (a === 'secs+') { wp().secs = Math.min(20, (wp().secs || 6) + 1); save(); paint(); schedule(); return; }
    if (a === 'dup') {
      const copy = JSON.parse(JSON.stringify(wp()));
      copy.id = 'w' + (st.waypoints.length + 1);
      st.waypoints.splice(st.idx + 1, 0, copy);
      save(); paint(); return toast('Waypoint duplicated');
    }
    if (a === 'del') {
      if (st.waypoints.length <= 1) return toast('Keep at least one waypoint');
      st.waypoints.splice(st.idx, 1);
      st.idx = Math.min(st.idx, st.waypoints.length - 1);
      save(); paint(); fly(wp()); return toast('Waypoint deleted');
    }
  }

  /* the share button puts the real itinerary on the clipboard; offline
     file:// pages still allow execCommand, and the modal is the fallback */
  function tourText() {
    return 'PickleMarawi court tour — ' + CLUB.city + '\n' +
      st.waypoints.map((w, i) =>
        (i + 1) + '. ' + w.title + ' · ' + venueOf(w).name + ' (Brgy. ' + venueOf(w).barangay + ') · ' +
        w.cam.lat.toFixed(4) + '° N, ' + w.cam.lng.toFixed(4) + '° E · ' + (w.secs || 6) + 's').join('\n');
  }

  function copyText(txt) {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-1200px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  function shareTour() {
    const txt = tourText();
    if (copyText(txt)) return toast('Tour copied — ' + st.waypoints.length + ' stops on the clipboard');
    UI.modal({
      title: 'Share this tour',
      sub: 'Copy the itinerary text and paste it anywhere.',
      body: '<div class="field"><label>Tour itinerary</label><textarea id="tourShare" rows="8" readonly>' + esc(txt) + '</textarea></div>',
      actions: [{ id: 'sel', label: 'Select all', cls: 'ghost' }],
      onAction(id, scope) {
        const ta = scope.querySelector('#tourShare');
        if (ta) { ta.focus(); ta.select(); }
        return false;
      }
    });
  }

  function onChange(e) {
    if (!host) return;
    const t = e.target;

    const feat = t.closest('[data-feat]');
    if (feat) {
      st.features[feat.dataset.feat] = feat.checked; save();
      if (feat.dataset.feat === 'places') applyTourStyle(); else { addMarkers(); syncRoute(); }
      return;
    }

    if (t.matches('[data-camset]')) {
      const k = t.dataset.camset;
      let v = parseFloat(t.value);
      if (isNaN(v)) return;
      if (k === 'zoom') v = Math.min(19, Math.max(3, v));
      if (k === 'pitch') v = Math.min(80, Math.max(0, v));
      return setCam(k, v);
    }
    if (t.matches('[data-tpname]')) { wp().title = t.value; save(); refreshTour(); }
  }

  /* ---------------- lifecycle ---------------- */
  function mount(el) {
    host = el;
    paint();
    if (st.playing) schedule();
  }

  function destroy() {
    clearTimeout(timer);
    if (map) { map.remove(); map = null; }
    live = false;
    dead = false;
    host = null;
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', e => { if (host && e.target.matches('[data-tpname]')) { wp().title = e.target.value; } });

  return { mount, destroy, isLive: () => live };
})();

/* const bindings are script-scoped, not window props — the router probes window.TOURVIEW */
window.TOURVIEW = TOURVIEW;
