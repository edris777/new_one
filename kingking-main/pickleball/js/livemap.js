/* ============================================================
   Marawi Live Court Map — a command-centre map in the style of
   the reference clip: real tiles over Marawi City, a Street /
   Satellite / Dark base switch (public tile services, no API
   key), status-coded venue pins, a live dispatch feed, legend,
   zoom + reset + full-screen controls and click-through popups.
   ============================================================ */

const LIVEMAP = (function () {

  const KEY = 'piklemarawi-map';
  let map = null;
  let host = null;
  let pins = [];
  let timer = null;
  let dead = false;

  const st = load();

  function load() {
    let s = { base: 'dark', feed: true, full: false, labels: true };
    try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* first run */ }
    s.base = MAPTILES.normalize(s.base);
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  /* ---------------- colour language ---------------- */
  const STATUS_COLOR = { open: '#2fb37c', busy: '#f4a036', closed: '#e0607e', soon: '#6b7cff' };
  const PRIO_COLOR = { Critical: '#e0475f', High: '#f4703a', Medium: '#f4c430', Low: '#2fb37c' };
  const KIND_COLOR = { Booking: '#2fb37c', Waitlist: '#f4c430', Closure: '#e0607e', Clinic: '#6b7cff', Match: '#f4a036', 'New venue': '#8b7cf6' };

  const elapsed = m => m < 60 ? m + 'm ago' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm ago';
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  /* ---------------- map ---------------- */
  function sourceNote() {
    const c = MAPTILES.current(st.base);
    return CLUB.city + ' · ' + CLUB.lat.toFixed(4) + '° N, ' + CLUB.lng.toFixed(4) + '° E — ' +
      MAPTILES.name(st.base, c.index) + (c.dead ? ' (tiles not answering)' : '') + ', no API key';
  }

  function paintSource() {
    const el = document.querySelector('.cmd-scale');
    if (el) el.textContent = sourceNote();
    /* the label layer only exists for bases that ship without printed names */
    const btn = document.querySelector('[data-cmd="labels"]');
    if (btn) {
      const can = MAPTILES.hasLabels(st.base);
      btn.classList.toggle('is-on', can && st.labels);
      btn.title = can ? 'Place labels over the imagery' : 'Street tiles print their own place names';
    }
  }

  function applyStyle() {
    if (!map) return;
    map.setStyle(MAPTILES.style(st.base, { labels: st.labels }));
    paintSource();
  }

  function build() {
    const el = document.getElementById('liveMap');
    if (!el || typeof maplibregl === 'undefined') return false;
    map = new maplibregl.Map({
      container: el, style: MAPTILES.style(st.base, { labels: st.labels }),
      center: [CLUB.lng, CLUB.lat], zoom: 13.2, pitch: 0,
      attributionControl: { compact: true }, maxZoom: 19, minZoom: 9
    });
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    /* DOM markers position from the camera, so they show before the tiles do */
    attach();
    map.on('styledata', attach);
    map.on('load', attach);
    map.on('error', e => { if (window.console) console.warn('city map tile', e && e.error && e.error.message); });
    MAPTILES.guard(map, {
      base: () => st.base,
      swap: () => applyStyle(),
      offline: () => { dead = true; paintOffline(); }
    });
    tick();
    paintSource();
    return true;
  }

  /* every public provider failed: draw the club map instead of a grey box */
  function paintOffline() {
    const stage = document.querySelector('.cmd-stage');
    if (!stage) return;
    const engine = typeof maplibregl !== 'undefined';
    stage.innerHTML = '<div class="cmd-offline">' + CITYMAP.svg({ active: state().venue }) +
      '<div class="off-note">' + icon('info', 15) + ' ' +
      (engine ? 'None of the public tile services answered — showing the drawn ' + CLUB.city + ' map. ' +
        '<button class="link-btn" data-cmd="retry">Retry the live tiles</button>'
        : 'The map engine could not load, so ' + CLUB.city + ' is drawn below.') +
      '</div></div>';
  }

  function restoreStage() {
    const stage = document.querySelector('.cmd-stage');
    if (!stage) return;
    stage.innerHTML = '<div id="liveMap"></div>' +
      '<div class="cmd-legend"><b>Legend</b>' +
      Object.keys(STATUS_COLOR).map(k => '<span><i style="background:' + STATUS_COLOR[k] + '"></i>' +
        k[0].toUpperCase() + k.slice(1) + '</span>').join('') +
      '<span class="cmd-legend-sep"></span>' +
      Object.keys(PRIO_COLOR).map(k => '<span><i class="dia" style="background:' + PRIO_COLOR[k] + '"></i>' + k + '</span>').join('') +
      '</div><div class="cmd-scale">' + sourceNote() + '</div>';
  }

  function markerEl(kind, color, label, active) {
    const b = document.createElement('button');
    b.className = 'cmd-pin cmd-mark' + (active ? ' is-active' : '');
    b.style.setProperty('--pin', color);
    b.innerHTML = kind === 'venue'
      ? '<span class="cmd-dot">' + icon('ball', 13) + '</span>'
      : '<span class="cmd-diamond"></span>';
    b.title = label;
    b.setAttribute('aria-label', label);
    return b;
  }

  function attach() {
    if (!map) return;
    pins.forEach(p => p.remove());
    pins = [];

    VENUES.forEach(v => {
      const el = markerEl('venue', STATUS_COLOR[v.status] || '#6b7cff', v.name, state().venue === v.id);
      el.dataset.cmdvenue = v.id;
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 26, className: 'cmd-pop' })
          .setLngLat([v.lng, v.lat])
          .setHTML(popupVenue(v))
          .addTo(map);
      });
      pins.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([v.lng, v.lat]).addTo(map));
    });

    if (st.feed) MAP_FEED.forEach(f => {
      const el = markerEl('feed', PRIO_COLOR[f.prio] || '#6b7cff', f.code, false);
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 20, className: 'cmd-pop' })
          .setLngLat([f.lng, f.lat])
          .setHTML(popupFeed(f))
          .addTo(map);
      });
      pins.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([f.lng, f.lat]).addTo(map));
    });
  }

  function popupVenue(v) {
    return '<div class="pop">' +
      '<div class="pop-top" style="--pin:' + (STATUS_COLOR[v.status] || '#6b7cff') + '"><b>' + v.name + '</b>' +
      '<span class="tagline ' + (v.status === 'open' ? 'tg-open' : v.status === 'busy' ? 'tg-busy' : v.status === 'soon' ? 'tg-soon' : 'tg-neutral') + '">' + v.status + '</span></div>' +
      '<div class="pop-coord">' + icon('map-pin', 12) + ' Brgy. ' + v.barangay + ' · ' + v.lat.toFixed(4) + '° N, ' + v.lng.toFixed(4) + '° E</div>' +
      '<div class="pop-grid"><span>Courts</span><b>' + (v.courts || '—') + '</b>' +
      '<span>Rate</span><b>' + (v.price ? money(v.price) + '/h' : '—') + '</b>' +
      '<span>Hours</span><b>' + v.open + ' – ' + v.close + '</b>' +
      '<span>Rating</span><b>' + (v.rating ? v.rating + ' ★' : '—') + '</b></div>' +
      '<div class="pop-act">' +
      '<button class="pill-btn primary" data-book="' + v.id + '">' + icon('calendar', 14) + 'Book</button>' +
      '<button class="pill-btn ghost" data-goto="tour">' + icon('video', 14) + 'Tour</button></div></div>';
  }

  function popupFeed(f) {
    return '<div class="pop">' +
      '<div class="pop-top" style="--pin:' + (PRIO_COLOR[f.prio] || '#6b7cff') + '"><b>' + f.kind + '</b>' +
      '<span class="tagline ' + (f.status === 'Closed' ? 'tg-neutral' : f.status === 'Running' || f.status === 'Active' ? 'tg-busy' : 'tg-open') + '">' + f.status + '</span></div>' +
      '<div class="pop-coord">' + f.code + ' · ' + f.lat.toFixed(4) + '° N, ' + f.lng.toFixed(4) + '° E</div>' +
      '<div class="pop-grid"><span>Venue</span><b>' + f.venue + '</b>' +
      '<span>Priority</span><b>' + f.prio + '</b>' +
      '<span>Owner</span><b>' + f.responder + '</b>' +
      '<span>Elapsed</span><b>' + elapsed(f.mins) + '</b></div></div>';
  }

  /* ---------------- live pulse ---------------- */
  function tick() {
    clearInterval(timer);
    const paint = () => {
      const el = document.querySelector('.cmd-clock');
      if (!el) return clearInterval(timer);
      el.textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    paint();
    timer = setInterval(paint, 1000);
  }

  /* ---------------- markup used by the page ---------------- */
  function shell() {
    return '<div class="cmd-mapwrap">' +
      '<section class="card flush cmd-card' + (st.full ? ' is-full' : '') + '">' +
      '<div class="cmd-head">' +
      '<div class="cmd-title"><h3>' + icon('map-pin', 18) + ' Marawi Live Court Map</h3>' +
      '<p>' + VENUES.filter(v => v.courts).length + ' operating venues · live bookings, closures and desk activity</p></div>' +
      '<div class="cmd-seg" role="group" aria-label="Base map">' +
      '<button class="' + (st.base === 'street' ? 'on' : '') + '" data-base="street" title="Street map">Street</button>' +
      '<button class="' + (st.base === 'satellite' ? 'on' : '') + '" data-base="satellite" title="Satellite imagery">Satellite</button>' +
      '<button class="' + (st.base === 'dark' ? 'on' : '') + '" data-base="dark" title="Dark command view">Dark</button></div>' +
      '<div class="tp-search cmd-search">' + icon('search', 15) +
      '<input id="cmdSearch" type="search" placeholder="Find a venue or barangay…" aria-label="Find a venue or barangay">' +
      '<button class="mini-btn dark" data-cmd="find" aria-label="Fly to the match">' + icon('chevron-right', 15) + '</button></div>' +
      '<span class="cmd-live"><i></i>LIVE <b class="cmd-clock">--:--:--</b></span>' +
      '<div class="cmd-tools">' +
      '<button class="mini-btn dark" data-cmd="zin" aria-label="Zoom in">' + icon('plus', 15) + '</button>' +
      '<button class="mini-btn dark" data-cmd="zout" aria-label="Zoom out">' + icon('minus', 15) + '</button>' +
      '<button class="mini-btn dark" data-cmd="reset" aria-label="Recentre on Marawi">' + icon('navigation', 15) + '</button>' +
      '<button class="mini-btn dark' + (st.labels ? ' is-on' : '') + '" data-cmd="labels" aria-label="Toggle place labels" title="Place labels over the imagery">' + icon('layers', 15) + '</button>' +
      '<button class="mini-btn dark' + (st.feed ? ' is-on' : '') + '" data-cmd="feed" aria-label="Toggle dispatch feed">' + icon('activity', 15) + '</button>' +
      '<button class="mini-btn dark" data-cmd="full" aria-label="Full screen">' + icon(st.full ? 'shrink' : 'expand', 15) + '</button>' +
      '</div></div>' +
      '<div class="cmd-stage">' +
      '<div id="liveMap"></div>' +
      '<div class="cmd-legend"><b>Legend</b>' +
      Object.keys(STATUS_COLOR).map(k => '<span><i style="background:' + STATUS_COLOR[k] + '"></i>' + k[0].toUpperCase() + k.slice(1) + '</span>').join('') +
      '<span class="cmd-legend-sep"></span>' +
      Object.keys(PRIO_COLOR).map(k => '<span><i class="dia" style="background:' + PRIO_COLOR[k] + '"></i>' + k + '</span>').join('') +
      '</div>' +
      '<div class="cmd-scale">' + sourceNote() + '</div>' +
      '</div></section>' +
      '<aside class="cmd-side">' +
      sideByType() + sideActivity() + sideVenues() +
      '</aside></div>';
  }

  function sideByType() {
    const counts = {};
    MAP_FEED.forEach(f => { counts[f.kind] = (counts[f.kind] || 0) + 1; });
    const data = Object.keys(counts).map(k => ({ name: k, value: counts[k], color: KIND_COLOR[k] || '#8b93a7' }));
    return '<section class="card"><div class="card-head"><div><h3>By Type</h3><p>Last 24 hours</p></div></div>' +
      CH.donut({ size: 190, data: data, caption: 'activity', alt: 'Court activity by type' }) +
      '<div class="cmd-key">' + data.map(d => '<span><i style="background:' + d.color + '"></i>' + d.name + ' <b>' + d.value + '</b></span>').join('') + '</div></section>';
  }

  function sideActivity() {
    const ph = (window.Store && Store.sel.peakHours) ? Store.sel.peakHours() : { labels: [], data: [] };
    const rows = ph.labels.map((l, i) => ({ label: l, value: ph.data[i] })).filter((r, i) => i % 2 === 0);
    let hot = 0;
    rows.forEach((r, i) => { if (r.value > rows[hot].value) hot = i; });
    const total = rows.reduce((s, r) => s + r.value, 0);
    const peakLabel = rows.length ? rows[hot].label : '—';
    return '<section class="card"><div class="card-head"><div><h3>Sessions by Hour</h3>' +
      '<p>Confirmed bookings grouped by start time · ' + total + ' sessions</p></div>' +
      '<span class="tagline tg-open">peak ' + peakLabel + '</span></div>' +
      (total ? CH.bars({ labels: rows.map(r => r.label), data: rows.map(r => r.value), hot: hot, h: 190,
        alt: 'Bookings per start hour, peaking at ' + peakLabel })
        : UI.empty('bar-chart', 'No bookings yet — the activity chart fills in as courts get booked.')) +
      '</section>';
  }

  function sideVenues() {
    return '<section class="card"><div class="card-head"><div><h3>Venue Status</h3><p>Tap to fly the map there</p></div></div>' +
      '<div class="stack" style="gap:2px">' + VENUES.map(v =>
        '<button class="row cmd-venue' + (state().venue === v.id ? ' is-active' : '') + '" data-cmdvenue="' + v.id + '">' +
        '<span class="slab" style="background:' + (STATUS_COLOR[v.status] || '#6b7cff') + '22;color:' + (STATUS_COLOR[v.status] || '#6b7cff') + '">' + icon('ball', 16) + '</span>' +
        '<div class="grow"><div class="t1">' + v.name + '</div><div class="t2">Brgy. ' + v.barangay + ' · ' + (Store.sel.venuesForVenue(v.id).length ? Store.sel.venuesForVenue(v.id).length + ' decks' : 'no decks yet') + '</div></div>' +
        '<span class="tagline ' + (v.status === 'open' ? 'tg-open' : v.status === 'busy' ? 'tg-busy' : v.status === 'soon' ? 'tg-soon' : 'tg-neutral') + '">' + v.status + '</span></button>').join('') +
      '</div>' +
      '<button class="pill-btn primary" data-goto="tour" style="margin-top:12px;width:100%;justify-content:center">' + icon('video', 15) + 'Play the satellite court tour</button></section>';
  }

  function feedTable() {
    return '<section class="card flush"><div class="card-head" style="padding:20px 22px 0">' +
      '<div><h3>Recent Activity</h3><p>Last 8 dispatch entries across ' + CLUB.city + '</p></div>' +
      '<button class="pill-btn ghost" data-cmd="fullqueue">' + icon('list', 14) + 'Full queue</button></div>' +
      '<div class="tbl-wrap"><table class="tbl cmd-tbl"><thead><tr>' +
      ['Code', 'Type', 'Priority', 'Location', 'Status', 'Venue', 'Owner', 'Time'].map(h => '<th>' + h + '</th>').join('') +
      '</tr></thead><tbody>' + MAP_FEED.map(f =>
        '<tr data-cmdrow="' + f.code + '"><td><b>' + f.code + '</b></td>' +
        '<td><span class="cmd-kind" style="--pin:' + (KIND_COLOR[f.kind] || '#8b93a7') + '">' + f.kind + '</span></td>' +
        '<td><span class="prio" style="--pin:' + (PRIO_COLOR[f.prio] || '#8b93a7') + '">' + f.prio + '</span></td>' +
        '<td>' + f.lat.toFixed(4) + ', ' + f.lng.toFixed(4) + '</td>' +
        '<td><span class="tagline ' + (f.status === 'Closed' ? 'tg-neutral' : f.status === 'Resolved' ? 'tg-open' : 'tg-busy') + '">' + f.status + '</span></td>' +
        '<td>' + f.venue + '</td><td>' + f.responder + '</td><td>' + elapsed(f.mins) + '</td></tr>').join('') +
      '</tbody></table></div></section>';
  }

  function html() {
    return shell() + feedTable();
  }

  /* ---------------- behaviour ---------------- */
  function state() { return window.PMSTATE ? PMSTATE() : { venue: 'v1' }; }

  function flyTo(v) {
    if (!map) return;
    map.flyTo({ center: [v.lng, v.lat], zoom: 15.4, duration: 1400, curve: 1.5 });
  }

  function focus(v, announce) {
    if (!v) return;
    document.querySelectorAll('[data-cmdvenue]').forEach(b => b.classList.toggle('is-active', b.dataset.cmdvenue === v.id));
    if (map && typeof maplibregl !== 'undefined') {
      flyTo(v);
      new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 26, className: 'cmd-pop' })
        .setLngLat([v.lng, v.lat]).setHTML(popupVenue(v)).addTo(map);
    }
    if (announce !== false && window.toast) {
      window.toast('Focused ' + v.name + ' · Brgy. ' + v.barangay);
    }
  }

  /* build or restyle the map on whichever public provider answers first */
  function ensureMap(announce, done, force) {
    MAPTILES.select(st.base, { force: !!force }).then(res => {
      if (!host) return done && done(false);
      if (res.dead) {
        dead = true; paintOffline();
        if (announce) window.toast('No public tile service answered the ' + cap(st.base).toLowerCase() + ' view — showing the drawn ' + CLUB.city + ' map.', 'warn');
        return done && done(false);
      }
      dead = false;
      const surface = document.getElementById('liveMap');
      if (map && surface) {
        applyStyle();
        if (announce) window.toast(cap(st.base) + ' view · ' + MAPTILES.name(st.base, res.index) + ' · no API key needed');
        return done && done(true);
      }
      /* the stage was replaced by the drawn fallback (or never built): start clean */
      if (map) { map.remove(); map = null; pins = []; }
      if (!surface) restoreStage();
      if (!build()) return done && done(false);
      if (announce) window.toast(cap(st.base) + ' view · ' + MAPTILES.name(st.base, res.index) + ' · no API key needed');
      done && done(true);
    });
  }

  function setBase(b) {
    const base = MAPTILES.normalize(b);
    st.base = base; save();
    document.querySelectorAll('[data-base]').forEach(x => x.classList.toggle('on', MAPTILES.normalize(x.dataset.base) === base));
    ensureMap(true);
  }

  function findVenue() {
    const inp = document.getElementById('cmdSearch');
    const q = String((inp || {}).value || '').trim().toLowerCase();
    if (!q) return window.toast('Type a venue name or barangay to fly there.', 'warn');
    const hit = VENUES.filter(v => (v.name + ' ' + v.barangay).toLowerCase().indexOf(q) > -1)[0];
    if (!hit) return window.toast('No venue or barangay matches “' + q + '”.', 'err');
    state().venue = hit.id;
    focus(hit);
  }

  function onClick(e) {
    if (!host) return;
    const t = e.target;

    const base = t.closest('[data-base]');
    if (base) return setBase(base.dataset.base);

    const cv = t.closest('[data-cmdvenue]');
    if (cv) return focus(VENUES.find(x => x.id === cv.dataset.cmdvenue));

    const row = t.closest('[data-cmdrow]');
    if (row) {
      const f = MAP_FEED.find(x => x.code === row.dataset.cmdrow);
      if (map) {
        map.flyTo({ center: [f.lng, f.lat], zoom: 15.8, duration: 1300 });
        new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 20, className: 'cmd-pop' })
          .setLngLat([f.lng, f.lat]).setHTML(popupFeed(f)).addTo(map);
      }
      return;
    }

    const cmd = t.closest('[data-cmd]');
    if (!cmd) return;
    const a = cmd.dataset.cmd;
    if (a === 'find') return findVenue();
    if (a === 'retry') return ensureMap(true, null, true);
    if (a === 'zin' && map) return map.zoomIn();
    if (a === 'zout' && map) return map.zoomOut();
    if (a === 'reset' && map) return map.flyTo({ center: [CLUB.lng, CLUB.lat], zoom: 13.2, duration: 1200 });
    if (a === 'labels') {
      if (!MAPTILES.hasLabels(st.base)) {
        return window.toast('Street tiles print their own place names — the label layer applies to Satellite and Dark.', 'warn');
      }
      st.labels = !st.labels; save();
      cmd.classList.toggle('is-on', st.labels);
      if (map) applyStyle();
      return window.toast('Place labels ' + (st.labels ? 'on' : 'off'));
    }
    if (a === 'feed') {
      st.feed = !st.feed; save();
      cmd.classList.toggle('is-on', st.feed);
      attach();
      return window.toast('Dispatch feed ' + (st.feed ? 'shown' : 'hidden'));
    }
    if (a === 'full') {
      st.full = !st.full; save();
      const card = document.querySelector('.cmd-card');
      if (card) card.classList.toggle('is-full', st.full);
      cmd.innerHTML = icon(st.full ? 'shrink' : 'expand', 15);
      if (map) setTimeout(() => map.resize(), 220);
      return;
    }
    if (a === 'fullqueue') return fullQueueModal();
  }

  function fullQueueModal() {
    if (!window.UI || !UI.modal) return window.toast('Full queue · ' + MAP_FEED.length + ' entries today');
    const open = MAP_FEED.filter(f => f.status !== 'Resolved').length;
    UI.modal({
      title: 'Full dispatch queue',
      sub: MAP_FEED.length + ' entries across ' + CLUB.city + ' · ' + open + ' still open',
      wide: true,
      body: '<div class="tbl-wrap"><table class="tbl cmd-tbl"><thead><tr>' +
        ['Code', 'Type', 'Priority', 'Location', 'Status', 'Venue', 'Owner', 'Time'].map(h => '<th>' + h + '</th>').join('') +
        '</tr></thead><tbody>' + MAP_FEED.map(f =>
          '<tr><td><b>' + f.code + '</b></td>' +
          '<td><span class="cmd-kind" style="--pin:' + (KIND_COLOR[f.kind] || '#8b93a7') + '">' + f.kind + '</span></td>' +
          '<td><span class="prio" style="--pin:' + (PRIO_COLOR[f.prio] || '#8b93a7') + '">' + f.prio + '</span></td>' +
          '<td>' + f.lat.toFixed(4) + ', ' + f.lng.toFixed(4) + '</td>' +
          '<td><span class="tagline ' + (f.status === 'Closed' ? 'tg-neutral' : f.status === 'Resolved' ? 'tg-open' : 'tg-busy') + '">' + f.status + '</span></td>' +
          '<td>' + f.venue + '</td><td>' + f.responder + '</td><td>' + elapsed(f.mins) + '</td></tr>').join('') +
        '</tbody></table></div>',
      actions: [{ id: 'csv', label: 'Download CSV', cls: 'ghost' }, { id: 'focus', label: 'Fly to newest', cls: 'primary' }],
      onAction(id) {
        if (id === 'csv') {
          return UI.csv('marawi-dispatch-queue.csv', [
            { label: 'Code', key: 'code' }, { label: 'Type', key: 'kind' }, { label: 'Priority', key: 'prio' },
            { label: 'Latitude', key: 'lat' }, { label: 'Longitude', key: 'lng' }, { label: 'Status', key: 'status' },
            { label: 'Venue', key: 'venue' }, { label: 'Owner', key: 'responder' }, { label: 'Minutes ago', key: 'mins' }
          ], MAP_FEED);
        }
        if (id === 'focus' && MAP_FEED.length && map) {
          const newest = MAP_FEED.reduce((n, f) => (f.mins < n.mins ? f : n), MAP_FEED[0]);
          map.flyTo({ center: [newest.lng, newest.lat], zoom: 15.8, duration: 1300 });
          new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 20, className: 'cmd-pop' })
            .setLngLat([newest.lng, newest.lat]).setHTML(popupFeed(newest)).addTo(map);
          window.toast('Centred on ' + newest.code + ' · ' + newest.kind);
        }
      }
    });
  }

  /* ---------------- lifecycle ---------------- */
  function mount(el) {
    host = el;
    if (typeof maplibregl === 'undefined') { paintOffline(); return; }
    const sel = VENUES.find(v => v.id === state().venue);
    ensureMap(false, live => {
      /* anything other than the default means the admin picked a court to inspect */
      if (live && sel && sel.id !== 'v1') flyTo(sel);
    });
  }

  function destroy() {
    clearInterval(timer);
    if (map) { map.remove(); map = null; }
    pins = [];
    host = null;
    dead = false;
  }

  function onKey(e) {
    if (!host || !e.target || e.target.id !== 'cmdSearch' || e.key !== 'Enter') return;
    e.preventDefault();
    findVenue();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  return { mount, destroy, html, shell, feedTable, focus };
})();

/* const bindings are script-scoped, not window props — the router probes window.LIVEMAP */
window.LIVEMAP = LIVEMAP;
