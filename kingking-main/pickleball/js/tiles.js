/* ============================================================
   Basemap catalogue — every source here is a public raster tile
   service: no account, no token, no API key. Each base keeps a
   failover chain, and before a map is built the chain is probed
   once with a real tile request so the imagery that actually
   answers is the imagery that gets drawn.

   CARTO's basemaps are deliberately absent: since they moved the
   public tiles behind a basemap key they answer anonymous requests
   with HTTP 200 and an "API KEY REQUIRED" watermark, which a status
   check cannot see. Esri and OpenStreetMap still serve real tiles to
   a browser that sends no credentials.
   ============================================================ */

const MAPTILES = (function () {

  function provider(name, tiles, attribution, maxzoom) {
    return { name, attribution, type: 'raster', tileSize: 256, maxzoom, tiles };
  }

  /* every endpoint below was fetched over Marawi with no credentials and
     returned real imagery; USGS and the Esri "Clarify" mirror were tried and
     404 for this part of the world, so they are not listed */
  const CHAINS = {
    street: [
      provider('Esri World Street Map', [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
        'Esri, HERE, Garmin, © OpenStreetMap contributors', 19),
      provider('OpenStreetMap', ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        '© OpenStreetMap contributors', 19),
      provider('Esri World Topographic', [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
        'Esri, HERE, Garmin, USGS, © OpenStreetMap contributors', 19)
    ],
    satellite: [
      provider('Esri World Imagery', [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        'Imagery © Maxar, Earthstar Geographics', 19)
    ],
    dark: [
      provider('Esri World Dark Gray Base', [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
        'Esri, HERE, Garmin, © OpenStreetMap contributors', 16)
    ]
  };

  /* reference overlays are keyed per base — a dark base needs light text */
  const LABELS = {
    satellite: provider('Place labels', [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      'Esri reference overlay', 19),
    dark: provider('Place labels', [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
      'Esri reference overlay', 16)
  };

  const BASES = ['street', 'satellite', 'dark'];
  /* keys written by older builds still in localStorage */
  const LEGACY = { streets: 'street', map: 'street', imagery: 'satellite', voyager: 'street', satellite: 'satellite', dark: 'dark' };

  function normalize(base) {
    if (BASES.indexOf(base) > -1) return base;
    return LEGACY[base] || 'dark';
  }

  function tileXY(lat, lng, z) {
    const n = Math.pow(2, z);
    const rad = lat * Math.PI / 180;
    return {
      x: Math.floor((lng + 180) / 360 * n),
      y: Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n)
    };
  }

  function urlAt(p, z, i) {
    const t = tileXY(CLUB.lat, CLUB.lng, z);
    return p.tiles[i || 0].replace('{z}', z).replace('{x}', t.x).replace('{y}', t.y);
  }

  function answers(url, ms) {
    return new Promise(resolve => {
      let settled = false;
      const done = ok => { if (!settled) { settled = true; resolve(ok); } };
      const timer = setTimeout(() => done(false), ms);
      try {
        const ctl = window.AbortController ? new AbortController() : null;
        fetch(url, { mode: 'cors', cache: 'default', signal: ctl ? ctl.signal : undefined })
          .then(res => { clearTimeout(timer); done(!!res.ok); })
          .catch(() => { clearTimeout(timer); done(false); });
        if (ctl) setTimeout(() => ctl.abort(), ms + 50);
      } catch (e) { clearTimeout(timer); done(false); }
    });
  }

  /* every host in a provider's own list is tried before it is set aside */
  function answersProvider(p, ms) {
    return p.tiles.reduce((walk, _, i) =>
      walk.then(hit => hit || answers(urlAt(p, 13, i), ms).then(ok => (ok ? true : null))),
      Promise.resolve(null)).then(hit => !!hit);
  }

  /* one probe per base every few minutes — a provider that goes away is
     picked up on the next map mount without re-hammering the services */
  const chosen = {};
  const TTL = 4 * 60 * 1000;
  const DEAD_TTL = 45 * 1000;

  function remember(rawBase, index, dead) {
    const base = normalize(rawBase);
    chosen[base] = { base, index, dead, at: Date.now() };
    return chosen[base];
  }

  function probe(rawBase) {
    const base = normalize(rawBase);
    return CHAINS[base].reduce((walk, p, i) =>
      walk.then(hit => hit || answersProvider(p, 3200).then(ok => (ok ? remember(base, i, false) : null))),
      Promise.resolve(null)
    ).then(hit => hit || remember(base, 0, true));
  }

  /* which provider the last probe settled on, without probing again */
  function current(rawBase) {
    const base = normalize(rawBase);
    const c = chosen[base];
    if (c) return c;
    return { base, index: 0, dead: false, pending: true };
  }

  /* opts.force re-runs the probe even inside the cache window — that is how
     the "Retry the live tiles" button can recover a link that just came back */
  function select(rawBase, opts) {
    const base = normalize(rawBase);
    const c = chosen[base];
    if (!(opts && opts.force) && c && Date.now() - c.at < (c.dead ? DEAD_TTL : TTL)) return Promise.resolve(c);
    return probe(base);
  }

  /* step to the next provider after a live failure; -1 when the chain is out */
  function advance(rawBase, fromIndex) {
    const base = normalize(rawBase);
    const next = (fromIndex || 0) + 1;
    if (next >= CHAINS[base].length) return -1;
    return remember(base, next, false).index;
  }

  function name(rawBase, index) {
    const p = CHAINS[normalize(rawBase)][index || 0];
    return p ? p.name : rawBase;
  }

  /* the style MapLibre draws: base raster + the reference overlay that suits
     it. Esri's street tiles already carry their own labels, so only imagery
     and the grey bases need the extra place-name layer. */
  function style(base, opts) {
    const o = opts || {};
    const b = normalize(base);
    const c = current(b);
    const sources = { b: CHAINS[b][c.index] };
    const layers = [{ id: 'b', type: 'raster', source: 'b' }];
    const wantLabels = o.labels === undefined ? !!LABELS[b] : !!o.labels;
    if (wantLabels && LABELS[b]) {
      sources.l = LABELS[b];
      layers.push({ id: 'l', type: 'raster', source: 'l', paint: { 'raster-opacity': .85 } });
    }
    return { version: 8, sources, layers };
  }

  function attribution(base) {
    const b = normalize(base);
    const c = current(b);
    return CHAINS[b][c.index].attribution + (LABELS[b] ? ' · Esri reference' : '');
  }

  /* live watchdog: a provider that starts erroring mid-session is swapped
     for the next one in the chain, and the map only gives up once the whole
     chain has failed. hooks.base() reads the current base, hooks.swap() and
     hooks.offline() rebuild or fall back. */
  function guard(map, hooks) {
    let errors = 0, loaded = false, cooling = 0;
    map.on('sourcedata', e => { if (e.isSourceLoaded) loaded = true; });
    map.on('load', () => { loaded = true; });
    map.on('error', () => {
      if (loaded || cooling > Date.now()) return;
      errors++;
      if (errors < 3) return;
      cooling = Date.now() + 4000;
      errors = 0;
      const base = normalize(hooks.base());
      const next = advance(base, current(base).index);
      if (next < 0) return hooks.offline();
      hooks.swap(next);
    });
  }

  return {
    BASES, normalize, select, style, attribution, name, advance, current, guard,
    hasLabels: base => !!LABELS[normalize(base)],
    chainLength: base => CHAINS[normalize(base)].length
  };
})();
