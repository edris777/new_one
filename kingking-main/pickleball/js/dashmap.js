/* ============================================================
   Dashboard "Marawi courts at a glance" — a live mini map
   (Street / Satellite / Dark, all keyless) beside the venue
   board. Pins, counts, utilisation and revenue all come from
   the store; the venue select on the availability board and
   the city map follow whatever is picked here.
   ============================================================ */

const DASHMAP = (function () {

  const KEY = 'piklemarawi-dashmap';
  const esc = UI.esc;
  const STATUS_COLOR = { open: '#2fb37c', busy: '#f4a036', closed: '#e0607e', soon: '#6b7cff' };

  let map = null;
  let host = null;
  let pins = [];
  let dead = false;

  const st = load();

  function load() {
    let s = { base: 'street', labels: true };
    try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* first run */ }
    s.base = MAPTILES.normalize(s.base);
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function state() { return window.PMSTATE ? PMSTATE() : { venue: 'v1' }; }
  function rows() { return Store.sel.dashboardVenueLoad(); }

  function picked(list) {
    const want = state().venue;
    return list.filter(v => v.id === want)[0] || list[0] || null;
  }

  /* ---------------- markup ---------------- */
  function head(list) {
    const hits = list.reduce((s, v) => s + v.hits, 0);
    const free = list.reduce((s, v) => s + v.free, 0);
    const cash = list.reduce((s, v) => s + v.revenue, 0);
    return '<div class="card-head"><div><h3>Marawi courts at a glance</h3>' +
      '<p>' + list.length + ' venue(s) in play · ' + hits + ' booking(s) today · ' +
      free + ' court-slot(s) still free · ' + money(cash) + ' taken</p></div>' +
      '<div class="card-tools">' +
      '<div class="cmd-seg" role="group" aria-label="Base map">' +
      '<button data-dashbase="street"' + (st.base === 'street' ? ' class="on"' : '') + '>Street</button>' +
      '<button data-dashbase="satellite"' + (st.base === 'satellite' ? ' class="on"' : '') + '>Satellite</button>' +
      '<button data-dashbase="dark"' + (st.base === 'dark' ? ' class="on"' : '') + '>Dark</button></div>' +
      '<button class="pill-btn primary" data-goto="map">' + icon('navigation', 15) + 'Open city map</button>' +
      '</div></div>';
  }

  function spot(v) {
    if (!v) return UI.empty('globe', 'No venue has decks on file yet.',
      'Add one under Venues and it lands on this map straight away.');
    const tone = v.status === 'open' ? 'tg-open' : v.status === 'busy' ? 'tg-busy' : v.status === 'soon' ? 'tg-soon' : 'tg-neutral';
    return '<div class="glance-spot" style="--pin:' + (STATUS_COLOR[v.status] || '#6b7cff') + '">' +
      '<div class="glance-spot-top"><b>' + esc(v.name) + '</b>' +
      '<span class="tagline ' + tone + '">' + v.status + '</span></div>' +
      '<div class="pop-coord">' + icon('map-pin', 12) + ' Brgy. ' + esc(v.barangay) + ' · ' +
      v.lat.toFixed(4) + '° N, ' + v.lng.toFixed(4) + '° E</div>' +
      '<div class="pop-grid">' +
      '<span>Decks</span><b>' + v.courts + (v.down ? ' · ' + v.down + ' down' : '') + '</b>' +
      '<span>Rate</span><b>' + (v.price ? money(v.price) + '/hr' : '—') + '</b>' +
      '<span>Hours</span><b>' + esc(v.open) + ' – ' + esc(v.close) + '</b>' +
      '<span>Booked today</span><b>' + (v.capacity ? v.booked + ' / ' + v.capacity + ' slots' : 'no sellable decks') + '</b>' +
      '<span>Free today</span><b>' + (v.capacity ? v.free : '—') + '</b>' +
      '<span>Revenue today</span><b>' + money(v.revenue) + '</b></div>' +
      '<div class="pop-act">' +
      '<button class="pill-btn primary" data-book="' + v.id + '">' + icon('calendar', 14) + 'Book here</button>' +
      '<button class="pill-btn ghost" data-pin="' + v.id + '">' + icon('navigation', 14) + 'Full map</button>' +
      '<button class="pill-btn ghost" data-dashdetail="' + v.id + '">' + icon('info', 14) + 'Details</button>' +
      '</div></div>';
  }

  function listHTML(list) {
    return list.map(v => {
      const on = picked(list) && picked(list).id === v.id;
      return '<button class="row glance-row' + (on ? ' is-active' : '') + '" data-dashvenue="' + v.id + '">' +
        '<span class="slab" style="background:' + (STATUS_COLOR[v.status] || '#6b7cff') + '22;color:' + (STATUS_COLOR[v.status] || '#6b7cff') + '">' +
        icon('ball', 16) + '</span>' +
        '<div class="grow"><div class="t1">' + esc(v.name) + '</div>' +
        '<div class="bar"><i style="width:' + v.util + '%"></i></div>' +
        '<div class="t2">' + (v.capacity
          ? v.booked + ' of ' + v.capacity + ' slots · ' + v.free + ' free · ' + money(v.revenue)
          : 'All ' + v.courts + ' deck(s) down · ' + money(v.revenue)) + '</div></div>' +
        '<span class="glance-util">' + v.util + '%</span></button>';
    }).join('');
  }

  function stage() {
    return '<div class="glance-mapwrap">' +
      '<div id="dashGlanceMap" class="glance-map"></div>' +
      '<div class="glance-tools">' +
      '<button class="mini-btn dark" data-dashcmd="zin" aria-label="Zoom in">' + icon('plus', 15) + '</button>' +
      '<button class="mini-btn dark" data-dashcmd="zout" aria-label="Zoom out">' + icon('minus', 15) + '</button>' +
      '<button class="mini-btn dark" data-dashcmd="reset" aria-label="Recentre on ' + esc(CLUB.city) + '">' + icon('navigation', 15) + '</button>' +
      '<button class="mini-btn dark' + (st.labels ? ' is-on' : '') + '" data-dashcmd="labels" aria-label="Toggle place labels" title="Place labels">' + icon('layers', 15) + '</button>' +
      '</div>' +
      '<div class="glance-legend">' +
      Object.keys(STATUS_COLOR).map(k => '<span><i style="background:' + STATUS_COLOR[k] + '"></i>' +
        k[0].toUpperCase() + k.slice(1) + '</span>').join('') + '</div>' +
      '<div class="glance-src" id="dashGlanceSrc">' + sourceNote() + '</div>' +
      '</div>';
  }

  function sourceNote() {
    const c = MAPTILES.current(st.base);
    if (dead || c.dead) return 'Drawn club map · no tile service answered';
    return MAPTILES.name(st.base, c.index) + ' · live tiles, no API key';
  }

  function paintSrc() {
    const src = document.getElementById('dashGlanceSrc');
    if (src) src.textContent = sourceNote();
    /* the label layer only exists for bases that ship without printed names */
    const btn = host && host.querySelector('[data-dashcmd="labels"]');
    if (btn) {
      const can = MAPTILES.hasLabels(st.base);
      btn.classList.toggle('is-on', can && st.labels);
      btn.title = can ? 'Place labels over the imagery' : 'Street tiles print their own place names';
    }
  }

  function card() {
    const list = rows();
    return '<section class="card sp2 dash-glance">' + head(list) +
      '<div class="glance-grid">' + stage() +
      '<div class="glance-side">' + spot(picked(list)) +
      '<div class="glance-rows" id="dashGlanceRows">' + listHTML(list) + '</div>' +
      '</div></div></section>';
  }

  /* ---------------- map ---------------- */
  function markerEl(v, active) {
    const b = document.createElement('button');
    b.className = 'cmd-pin cmd-mark' + (active ? ' is-active' : '');
    b.style.setProperty('--pin', STATUS_COLOR[v.status] || '#6b7cff');
    b.innerHTML = '<span class="cmd-dot">' + icon('ball', 13) + '</span>';
    b.title = v.name;
    b.setAttribute('aria-label', v.name + ' — ' + v.booked + ' slot(s) booked today');
    b.dataset.dashvenue = v.id;
    return b;
  }

  function attach() {
    if (!map) return;
    pins.forEach(p => p.remove());
    pins = [];
    const list = rows();
    const sel = picked(list);
    list.forEach(v => {
      const el = markerEl(v, sel && sel.id === v.id);
      pins.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([v.lng, v.lat]).addTo(map));
    });
  }

  function applyStyle() {
    if (!map) return;
    map.setStyle(MAPTILES.style(st.base, { labels: st.labels }));
    paintSrc();
    attach();
  }

  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  /* empty the surface and drop any previous map before drawing a new one */
  function resetSurface() {
    if (map) { map.remove(); map = null; pins = []; }
    const el = host ? host.querySelector('#dashGlanceMap') : null;
    if (!el) return null;
    el.innerHTML = '';
    return el;
  }

  function build() {
    const el = host ? host.querySelector('#dashGlanceMap') : null;
    if (!el || typeof maplibregl === 'undefined') return false;
    map = new maplibregl.Map({
      container: el, style: MAPTILES.style(st.base, { labels: st.labels }),
      center: [CLUB.lng, CLUB.lat], zoom: 12.7,
      attributionControl: { compact: true }, maxZoom: 19, minZoom: 9
    });
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.on('error', e => { if (window.console) console.warn('dashboard tile', e && e.error && e.error.message); });
    MAPTILES.guard(map, {
      base: () => st.base,
      swap: () => applyStyle(),
      offline: () => { dead = true; paintStageFallback(); }
    });
    attach();
    paintSrc();
    return true;
  }

  /* no engine or no answering tiles: draw the club map instead of a grey box */
  function paintStageFallback() {
    const el = host ? host.querySelector('#dashGlanceMap') : null;
    if (!el) return;
    el.innerHTML = '<div class="glance-offline">' + CITYMAP.svg({ active: (picked(rows()) || {}).id }) +
      '<div class="off-note">' + icon('info', 15) + ' ' +
      (dead ? 'None of the public tile services answered.' : 'The map engine is unavailable.') +
      ' Showing the drawn club map — ' +
      '<button class="link-btn" data-dashcmd="retry">Retry the live tiles</button></div></div>';
    const seg = host ? host.querySelectorAll('[data-dashbase]') : [];
    Array.prototype.forEach.call(seg, b => b.classList.toggle('on', b.dataset.dashbase === st.base));
    paintSrc();
  }

  function focus(v, opts) {
    const o = opts || {};
    if (!v) return;
    state().venue = v.id;
    if (map) {
      map.flyTo({ center: [v.lng, v.lat], zoom: 15.2, duration: 1100, curve: 1.5 });
      if (o.popup) {
        new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 24, className: 'cmd-pop' })
          .setLngLat([v.lng, v.lat]).setHTML(popup(v)).addTo(map);
      }
    }
    repaint();
    /* the availability board listens for its own select changing */
    const sel = document.getElementById('dashVenue');
    if (sel) {
      const has = Array.prototype.some.call(sel.options, x => x.value === v.id);
      if (has && sel.value !== v.id) {
        sel.value = v.id;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  function popup(v) {
    return '<div class="pop">' +
      '<div class="pop-top" style="--pin:' + (STATUS_COLOR[v.status] || '#6b7cff') + '"><b>' + esc(v.name) + '</b>' +
      '<span class="tagline ' + (v.status === 'open' ? 'tg-open' : v.status === 'busy' ? 'tg-busy' : v.status === 'soon' ? 'tg-soon' : 'tg-neutral') + '">' + v.status + '</span></div>' +
      '<div class="pop-coord">' + icon('map-pin', 12) + ' Brgy. ' + esc(v.barangay) + ' · ' + v.lat.toFixed(4) + '° N, ' + v.lng.toFixed(4) + '° E</div>' +
      '<div class="pop-grid"><span>Decks</span><b>' + v.courts + '</b>' +
      '<span>Booked today</span><b>' + v.booked + ' / ' + v.capacity + '</b>' +
      '<span>Free now</span><b>' + v.free + '</b>' +
      '<span>Taken today</span><b>' + money(v.revenue) + '</b></div>' +
      '<div class="pop-act"><button class="pill-btn primary" data-book="' + v.id + '">' + icon('calendar', 14) + 'Book</button>' +
      '<button class="pill-btn ghost" data-goto="map">' + icon('navigation', 14) + 'City map</button></div></div>';
  }

  /* ---------------- repaint ---------------- */
  function repaint() {
    if (!host) return;
    const list = rows();
    const sub = host.querySelector('.dash-glance .card-head p');
    if (sub) {
      const hits = list.reduce((s, v) => s + v.hits, 0);
      const free = list.reduce((s, v) => s + v.free, 0);
      const cash = list.reduce((s, v) => s + v.revenue, 0);
      sub.textContent = list.length + ' venue(s) in play · ' + hits + ' booking(s) today · ' +
        free + ' court-slot(s) still free · ' + money(cash) + ' taken';
    }
    const side = host.querySelector('.glance-side');
    if (side) {
      side.innerHTML = spot(picked(list)) +
        '<div class="glance-rows" id="dashGlanceRows">' + listHTML(list) + '</div>';
    }
    paintActive();
  }

  function paintActive() {
    if (!host) return;
    const sel = picked(rows());
    pins.forEach(p => {
      const el = p.getElement ? p.getElement() : null;
      if (el) el.classList.toggle('is-active', !!sel && el.dataset.dashvenue === sel.id);
    });
    host.querySelectorAll('[data-dashvenue]').forEach(b => {
      if (b.tagName !== 'BUTTON' || !b.classList.contains('glance-row')) return;
      b.classList.toggle('is-active', !!sel && b.dataset.dashvenue === sel.id);
    });
  }

  /* ---------------- events ---------------- */
  function onClick(e) {
    if (!host) return;
    const t = e.target;

    const base = t.closest('[data-dashbase]');
    if (base) {
      st.base = MAPTILES.normalize(base.dataset.dashbase);
      dead = false; save();
      host.querySelectorAll('[data-dashbase]').forEach(b => b.classList.toggle('on', MAPTILES.normalize(b.dataset.dashbase) === st.base));
      MAPTILES.select(st.base).then(res => {
        if (!host || st.base !== res.base) return;
        if (res.dead) { dead = true; paintStageFallback(); return UI.toast('No tile service answered the ' + cap(st.base) + ' view — showing the drawn club map.', 'warn'); }
        const surface = host.querySelector('#dashGlanceMap');
        if (map && surface && !surface.querySelector('.glance-offline')) applyStyle();
        else { resetSurface(); if (!build()) return paintStageFallback(); }
        const v = picked(rows());
        if (v && map) map.flyTo({ center: [v.lng, v.lat], zoom: map.getZoom(), duration: 400 });
        UI.toast(cap(st.base) + ' view · ' + MAPTILES.name(st.base, res.index) + ' (no key needed)');
      });
      return;
    }

    const detail = t.closest('[data-dashdetail]');
    if (detail) {
      const v = Store.get('venues', detail.dataset.dashdetail);
      return v && window.PAGES && PAGES.venues ? PAGES.venues.detail(v.id) : UI.toast('Venue detail unavailable', 'err');
    }

    const cmd = t.closest('[data-dashcmd]');
    if (cmd) {
      const a = cmd.dataset.dashcmd;
      if (a === 'zin' && map) return map.zoomIn();
      if (a === 'zout' && map) return map.zoomOut();
      if (a === 'reset' && map) return map.flyTo({ center: [CLUB.lng, CLUB.lat], zoom: 12.7, duration: 900 });
      if (a === 'labels') {
        if (!MAPTILES.hasLabels(st.base)) {
          return UI.toast('Street tiles print their own place names — the label layer applies to Satellite and Dark.', 'warn');
        }
        st.labels = !st.labels; save();
        cmd.classList.toggle('is-on', st.labels);
        if (map && !document.querySelector('.glance-offline')) applyStyle();
        return UI.toast('Place labels ' + (st.labels ? 'on' : 'off'));
      }
      if (a === 'retry') {
        dead = false;
        return MAPTILES.select(st.base, { force: true }).then(res => {
          if (!host) return;
          if (res.dead) { dead = true; paintStageFallback(); return UI.toast('Still no answer from the tile services — check the connection.', 'err'); }
          resetSurface();
          if (!build()) { dead = true; return paintStageFallback(); }
          UI.toast('Live tiles restored · ' + MAPTILES.name(st.base, res.index) + ' (no key needed)');
        });
      }
      return;
    }

    const pin = t.closest('[data-dashvenue]');
    if (pin) {
      const v = rows().filter(x => x.id === pin.dataset.dashvenue)[0];
      if (v) return focus(v, { popup: !!map });
    }
  }

  /* ---------------- lifecycle ---------------- */
  function mount(el) {
    host = el;
    dead = false;
    const box = el.querySelector ? el.querySelector('.dash-glance') : null;
    if (!box) return;
    if (typeof maplibregl === 'undefined') { paintStageFallback(); return; }
    MAPTILES.select(st.base).then(res => {
      if (!host) return;
      dead = res.dead;
      if (res.dead) return paintStageFallback();
      if (!build()) paintStageFallback();
    });
  }

  function destroy() {
    if (map) { map.remove(); map = null; }
    pins = [];
    dead = false;
    host = null;
  }

  document.addEventListener('click', onClick);

  return { mount, destroy, repaint, focus, card };
})();

/* const bindings are script-scoped, not window props */
window.DASHMAP = DASHMAP;
