/* ============================================================
   Pickle — the bridge between DinkHub's screens and Pickleball.

   Pickleball (served from /pickleball/) owns the club's data: its
   Store reads and writes localStorage key `piklemarawi-db`, and that
   is now the only place venues, courts and bookings live. SQLite
   keeps accounts and uploaded images.

   Rather than re-implement that data, this module loads Pickleball's
   own data.js + store.js inside a throwaway scope, so `window.Store =
   Store` lands on a dummy object and DinkHub's globals stay intact.
   Every /api call for venues, courts, bookings or dashboards is then
   answered from that shared store, in exactly the JSON shape the
   Django port used to return from server/models.js.
   ============================================================ */

const Pickle = (function () {
  const CLUB_FALLBACK = { city: 'Marawi City', province: 'Lanao del Sur', phone: '+63 64 555 0143', email: 'play@piklemarawi.ph' };

  let S = null;            /* Pickleball's Store, evaluated in a private scope */
  let REF = null;          /* { Store, VENUES, CLUB } from that scope */
  let HOUSE = null;        /* the account that answers for the club's own venues */
  let loading = null;
  let facilityCache = null;

  /* ---------- load ---------- */

  function text(url) {
    return fetch(url).then(response => {
      if (!response.ok) throw new Error('Could not load ' + url);
      return response.text();
    });
  }

  function load() {
    if (loading) return loading;
    loading = Promise.all([text('/pickleball/js/data.js'), text('/pickleball/js/store.js'),
      Api.server('GET', '/api/house-owner').catch(() => ({ owner: null }))])
      .then(parts => {
        const dummyWindow = {};
        const factory = new Function('window',
          parts[0] + '\n' + parts[1] + '\nreturn { Store: Store, VENUES: VENUES, CLUB: CLUB };');
        REF = factory(dummyWindow);
        S = REF.Store;
        HOUSE = parts[2] && parts[2].owner ? parts[2].owner : null;
        syncVenues();
        return REF;
      })
      .catch(err => { loading = null; throw err; });
    return loading;
  }

  /* Pickleball keeps a second handle on the venue list (the global VENUES
     that its map, tour and court screens iterate). store.js only re-points
     it while hydrating, so the bridge does the same after a write. */
  function syncVenues() {
    if (!S || !REF) return;
    REF.VENUES.length = 0;
    S.list('venues').forEach(v => REF.VENUES.push(v));
  }

  function commit(reason) {
    syncVenues();
    S.emit(reason);
  }

  /* ---------- helpers that mirror server/models.js ---------- */

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-');
  }

  function uniqueSlug(name, selfId) {
    const base = slugify(name) || 'venue';
    let slug = base, n = 2;
    for (;;) {
      const clash = venueBySlug(slug);
      if (!clash || clash.id === selfId) return slug;
      slug = base + '-' + n;
      n += 1;
    }
  }

  function rateDisplay(rate) {
    if (rate == null || rate === '') return 'Rate on request';
    return '₱' + Math.round(rate).toLocaleString('en-PH') + '/hour';
  }

  const SETTING_LABELS = { indoor: 'Indoor', outdoor: 'Outdoor', both: 'Indoor & outdoor' };
  const SURFACE_LABELS = { acrylic: 'Acrylic', concrete: 'Concrete', asphalt: 'Asphalt', cushioned: 'Cushioned', clay: 'Clay' };
  const STATUS_LABELS = { draft: 'Draft', pending: 'Awaiting review', approved: 'Approved', rejected: 'Rejected' };
  const VENUE_TONE = { approved: 'ok', pending: 'warn', rejected: 'bad', draft: 'muted' };
  const BOOKING_TONE = { approved: 'ok', pending: 'warn', rejected: 'bad', cancelled: 'muted' };

  /* Pickleball has no "rejected" booking; the verdict is remembered alongside. */
  const STATUS_FROM_PIK = { confirmed: 'approved', pending: 'pending', cancelled: 'cancelled', completed: 'approved' };

  function toMinutes(value) {
    const parts = String(value || '00:00').split(':');
    return Number(parts[0]) * 60 + Number(parts[1] || 0);
  }

  function fromMinutes(total) {
    const h = Math.floor(total / 60) % 24, m = total % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function timeLabel(start, end) {
    return DATA.ampm(start) + ' – ' + DATA.ampm(end);
  }

  function displayName(user) {
    const full = ((user.first_name || '') + ' ' + (user.last_name || '')).trim();
    return full || user.username || '';
  }

  function isAdmin(user) {
    return !!user && user.role === 'admin';
  }

  /* ---------- venue + court views ---------- */

  function venues() { return S.list('venues'); }
  function venueBySlug(slug) { return venues().find(v => slugOf(v) === slug) || null; }
  function venueById(id) { return S.get('venues', id) || venues().find(v => v.id === id) || null; }

  function meta(v) { return v.dk || {}; }
  function slugOf(v) { return meta(v).slug || slugify(v.name); }

  /* a listing submitted on DinkHub carries its owner; one that came from
     Pickleball belongs to the club, whose account answers its requests */
  function ownerIdOf(v) {
    const id = meta(v).ownerId;
    if (id != null) return id;
    return HOUSE ? HOUSE.id : null;
  }
  function ownerNameOf(v) {
    const extra = meta(v);
    if (extra.ownerName) return extra.ownerName;
    return HOUSE ? HOUSE.display_name : (REF ? REF.CLUB.full : 'PickleMarawi');
  }
  function isOwnedBy(v, user) {
    return !!user && ownerIdOf(v) === user.id;
  }

  /* a booking belongs to the account behind the player card, not the card id */
  function samePlayer(player, user) {
    if (!player || !user) return false;
    if (player.dk && player.dk.account) return player.dk.account === user.username;
    if (player.email && user.email) {
      return String(player.email).toLowerCase() === String(user.email).toLowerCase();
    }
    return false;
  }

  function reviewStatus(v) { return meta(v).status || 'approved'; }
  function isListed(v) {
    const active = meta(v).active;
    if (active !== undefined) return !!active;
    return v.status !== 'closed' && v.status !== 'soon';
  }

  function hoursFor(v) {
    const open = String(v.open || ''), close = String(v.close || '');
    if (!open || !close || open === '—' || close === '—') {
      return { opens: meta(v).opening || '06:00', closes: meta(v).closing || '22:00', closed: true };
    }
    return { opens: open, closes: close, closed: false };
  }

  function courtsOf(venueId, onlyActive) {
    return S.list('courts')
      .filter(c => c.venueId === venueId && (!onlyActive || c.status !== 'maintenance'))
      .slice()
      .sort((a, b) => (a.number - b.number) || String(a.name).localeCompare(String(b.name)));
  }

  function surfaceOf(court) {
    const type = String(court.type || '').toLowerCase();
    if (type.indexOf('acrylic') > -1) return 'acrylic';
    if (type.indexOf('cushion') > -1) return 'cushioned';
    if (type.indexOf('clay') > -1) return 'clay';
    if (type.indexOf('asphalt') > -1) return 'asphalt';
    return 'concrete';
  }

  /* A Pickleball court row carries everything DinkHub needs, so the mapping
     is one-directional and an edit writes straight back onto the same fields. */
  function dinkCourt(court) {
    const surface = surfaceOf(court);
    return Object.assign({}, court, {
      venue_id: court.venueId,
      surface: surface,
      surface_display: SURFACE_LABELS[surface] || surface,
      is_indoor: /indoor/i.test(court.type || ''),
      is_active: court.status !== 'maintenance',
      hourly_rate: court.pricePerHour,
      notes: court.note || '',
      effective_rate: court.pricePerHour,
      rate_display: rateDisplay(court.pricePerHour)
    });
  }

  function startingRate(v) {
    const rates = courtsOf(v.id, true).map(c => c.pricePerHour).filter(r => r != null);
    if (rates.length) return Math.min.apply(null, rates);
    return v.price || null;
  }

  function facilitySlugs(v) {
    const stored = meta(v).facilities;
    if (Array.isArray(stored)) return stored;
    const derived = ['parking', 'drinking-water'];
    if (v.indoor) derived.push('covered-court');
    if (courtsOf(v.id, false).some(c => c.floodlit)) derived.push('night-lights');
    return derived;
  }

  function facilitiesCatalog() {
    if (!facilityCache) {
      facilityCache = Api.server('GET', '/api/facilities')
        .then(res => (res.facilities || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))));
    }
    return facilityCache;
  }

  function publicVenueRow(v) {
    const extra = meta(v);
    const courts = courtsOf(v.id, true);
    const rate = startingRate(v);
    const hours = hoursFor(v);
    const city = extra.city || CLUB_FALLBACK.city;
    const province = extra.province || CLUB_FALLBACK.province;
    return {
      id: v.id,
      name: v.name,
      slug: slugOf(v),
      tagline: extra.tagline || v.note || '',
      city: city,
      province: province,
      barangay: extra.address ? (v.barangay || '') : '',
      address: extra.address || (v.barangay ? 'Brgy. ' + v.barangay : ''),
      setting: extra.setting || (v.indoor ? 'indoor' : 'outdoor'),
      setting_display: SETTING_LABELS[extra.setting || (v.indoor ? 'indoor' : 'outdoor')] || 'Outdoor',
      cover: extra.cover || null,
      is_demo: !!extra.isDemo,
      rate: rate,
      rate_display: rateDisplay(rate),
      court_count: courts.length,
      location_label: province ? city + ', ' + province : city,
      map_query: [extra.address, v.barangay, city, province].filter(Boolean).join(', '),
      latitude: v.lat != null ? v.lat : null,
      longitude: v.lng != null ? v.lng : null,
      opening_time: hours.opens,
      closing_time: hours.closes,
      status: reviewStatus(v),
      status_display: STATUS_LABELS[reviewStatus(v)] || reviewStatus(v),
      status_tone: VENUE_TONE[reviewStatus(v)] || 'muted',
      is_active: isListed(v),
      hours: hours.closed ? 'Closed today' : hours.opens + ' - ' + hours.closes,
      facility_list: []
    };
  }

  function venueDetail(v) {
    const extra = meta(v);
    const row = publicVenueRow(v);
    const courts = courtsOf(v.id, false).map(court => {
      const mapped = dinkCourt(court);
      mapped.effective_rate = mapped.hourly_rate == null ? v.price : mapped.hourly_rate;
      mapped.rate_display = rateDisplay(mapped.effective_rate);
      return mapped;
    });
    return Object.assign({}, row, {
      owner_id: ownerIdOf(v),
      owner_name: ownerNameOf(v),
      owner_email: extra.ownerEmail || (HOUSE ? HOUSE.email : '') || (REF ? REF.CLUB.email : ''),
      description: extra.description || v.note || '',
      review_note: extra.reviewNote || '',
      contact_phone: extra.phone || (REF ? REF.CLUB.phone : ''),
      contact_email: extra.email || (REF ? REF.CLUB.email : ''),
      starting_rate: row.rate,
      is_verified: reviewStatus(v) === 'approved',
      photos: (extra.photos || []).slice(),
      courts: courts,
      schedule: []
    });
  }

  /* the facility names come from the SQLite catalog, so they are filled in
     once that read resolves rather than blocking the venue mapping itself */
  function withFacilities(row, v) {
    return facilitiesCatalog().then(catalog => {
      const slugs = facilitySlugs(v);
      row.facility_list = catalog.filter(f => slugs.indexOf(f.slug) > -1);
      return row;
    });
  }

  const PUBLIC = v => reviewStatus(v) === 'approved' && isListed(v);

  /* ---------- booking views ---------- */

  function bookingStatus(b) {
    if (b.dk && b.dk.dinkStatus) return b.dk.dinkStatus;
    return STATUS_FROM_PIK[b.status] || b.status;
  }

  function bookingById(id) {
    return S.list('bookings').find(b => b.id === id) || null;
  }

  function bookingContext(b) {
    const court = S.get('courts', b.courtId) || {};
    const venue = venueById(court.venueId) || {};
    const player = S.get('players', b.playerId) || {};
    return { court: court, venue: venue, player: player };
  }

  function bookingJson(b, includeVenue) {
    const ctx = bookingContext(b);
    const status = bookingStatus(b);
    const extra = b.dk || {};
    const row = {
      id: b.id,
      reference: b.id,
      date: b.date,
      start_time: b.start,
      end_time: b.end,
      status: status,
      status_tone: BOOKING_TONE[status] || 'muted',
      note: b.note || '',
      total_amount: b.amount,
      duration_hours: Math.round(((toMinutes(b.end) - toMinutes(b.start)) / 60) * 100) / 100,
      time_label: timeLabel(b.start, b.end),
      can_cancel: status === 'pending' || status === 'approved',
      created_at: b.createdAt,
      decided_at: extra.decidedAt || null,
      decision_note: extra.decisionNote || '',
      decided_by_name: extra.decidedByName || '',
      court_id: ctx.court.id,
      court_name: ctx.court.name,
      court_rate_display: rateDisplay(ctx.court.pricePerHour),
      venue_id: ctx.venue.id,
      venue_name: ctx.venue.name,
      venue_slug: ctx.venue.id ? slugOf(ctx.venue) : '',
      venue_cover: ctx.venue.id ? meta(ctx.venue).cover || null : null,
      owner_id: ctx.venue.id ? ownerIdOf(ctx.venue) : null,
      player_id: ctx.player.id,
      player_name: ctx.player.name || ''
    };
    if (includeVenue && ctx.venue.id) row.venue = venueDetail(ctx.venue);
    return row;
  }

  /* ---------- the signed-in account inside Pickleball's roster ---------- */

  function playerFor(user) {
    const players = S.list('players');
    const linked = players.find(p => p.dk && p.dk.account === user.username) ||
      (user.email ? players.find(p => String(p.email || '').toLowerCase() === String(user.email).toLowerCase()) : null);
    if (linked) return linked;

    const name = displayName(user);
    const created = S.add('players', {
      name: name,
      ini: DATA.initials(name) || 'DH',
      gender: '—',
      level: 2.5,
      membership: 'starter',
      venue: venues().length ? venues()[0].name : CLUB_FALLBACK.city,
      play: 'Doubles',
      rating: 1000,
      streak: 0,
      status: 'active',
      email: user.email || '',
      phone: user.phone || '',
      dob: '2000-01-01',
      address: (user.city || CLUB_FALLBACK.city) + ', ' + CLUB_FALLBACK.province,
      emergency: { name: '', phone: '' },
      joined: S.today(),
      photo: null,
      dk: { account: user.username, accountId: user.id }
    });
    commit('player:link');
    return created;
  }

  /* ---------- shared rules, ported from the Django layer ---------- */

  function validateVenue(body) {
    const errors = {};
    const all = [];
    const missing = field => !String(body[field] || '').trim();
    ['name', 'description', 'address', 'contact_phone'].forEach(field => {
      if (missing(field)) errors[field] = ['This field is required.'];
    });
    if (body.rate_per_hour !== '' && body.rate_per_hour != null && Number(body.rate_per_hour) < 0) {
      all.push('The hourly rate cannot be negative.');
    }
    const opening = String(body.opening_time || '06:00');
    const closing = String(body.closing_time || '22:00');
    if (toMinutes(closing) <= toMinutes(opening)) all.push('Closing time must be later than the opening time.');
    const lat = body.latitude, lng = body.longitude;
    if (lat != null && lat !== '' && (Number(lat) < -90 || Number(lat) > 90)) {
      errors.latitude = ['Latitude must be between -90 and 90.'];
    }
    if (lng != null && lng !== '' && (Number(lng) < -180 || Number(lng) > 180)) {
      errors.longitude = ['Longitude must be between -180 and 180.'];
    }
    if (all.length) errors.__all__ = all;
    return errors;
  }

  function applyCourts(venueId, rows) {
    const list = Array.isArray(rows) ? rows : [];
    const existing = S.list('courts').filter(c => c.venueId === venueId);
    const keep = [];

    list.forEach(row => {
      if (row.delete) return;
      const name = String(row.name || '').trim();
      if (!name) return;
      const rate = row.hourly_rate === '' || row.hourly_rate == null ? null : Number(row.hourly_rate);
      const patch = {
        name: name,
        type: (row.is_indoor ? 'Indoor ' : 'Outdoor ') + (SURFACE_LABELS[row.surface] || 'Acrylic'),
        pricePerHour: rate,
        note: String(row.notes || ''),
        status: row.is_active === false ? 'maintenance' : 'available'
      };
      const found = row.id ? S.get('courts', row.id) : null;
      if (found && found.venueId === venueId) {
        Object.assign(found, patch);
        keep.push(found.id);
      } else {
        const created = S.add('courts', Object.assign({
          venueId: venueId,
          number: S.list('courts').filter(c => c.venueId === venueId).length + 1,
          location: 'Brgy. ' + (venueById(venueId) || {}).barangay + ', ' + CLUB_FALLBACK.city,
          floodlit: false,
          status: 'available'
        }, patch));
        keep.push(created.id);
      }
    });

    existing.forEach(court => {
      if (keep.indexOf(court.id) > -1) return;
      /* Django's on_delete=PROTECT: a court with a booking history stays. */
      if (S.list('bookings').some(b => b.courtId === court.id)) return;
      S.del('courts', court.id);
    });
  }

  function writeVenueFields(v, body) {
    v.name = String(body.name).trim();
    v.barangay = String(body.barangay || '');
    v.indoor = body.setting === 'indoor' || body.setting === 'both';
    v.open = body.opening_time || '06:00';
    v.close = body.closing_time || '22:00';
    v.price = body.rate_per_hour === '' || body.rate_per_hour == null ? 0 : Number(body.rate_per_hour);
    v.note = String(body.tagline || '');
    if (body.latitude !== '' && body.latitude != null) v.lat = Number(body.latitude);
    if (body.longitude !== '' && body.longitude != null) v.lng = Number(body.longitude);

    v.dk = Object.assign({}, v.dk, {
      tagline: String(body.tagline || ''),
      description: String(body.description || ''),
      address: String(body.address || ''),
      city: String(body.city || CLUB_FALLBACK.city),
      province: String(body.province || CLUB_FALLBACK.province),
      setting: body.setting || 'outdoor',
      phone: String(body.contact_phone || ''),
      email: String(body.contact_email || ''),
      facilities: Array.isArray(body.facilities) ? body.facilities.slice() : [],
      updatedAt: stamp()
    });
  }

  /* Cover and gallery uploads become files on the server, then only the URL
     is kept in Pickleball's row — a photo is far too large for localStorage. */
  function uploadImage(payload) {
    if (!payload || !payload.data) return Promise.resolve(null);
    return Api.server('POST', '/api/media', payload).then(res => (res.ok ? res.url : null));
  }

  function uploadImages(payloads) {
    return Promise.all((Array.isArray(payloads) ? payloads : []).map(uploadImage));
  }

  /* ---------- availability ---------- */

  function slotChoices(v, date) {
    const hours = hoursFor(v);
    if (hours.closed) return { closed: true, opens: hours.opens, closes: hours.closes, slots: [] };
    const slots = [];
    for (let m = toMinutes(hours.opens); m < toMinutes(hours.closes); m += 30) {
      slots.push({ value: fromMinutes(m), label: DATA.ampm(fromMinutes(m)) });
    }
    return { closed: false, opens: hours.opens, closes: hours.closes, slots: slots };
  }

  function bookedIntervals(courtId, date) {
    return S.list('bookings')
      .filter(b => b.courtId === courtId && b.date === date &&
        (b.status === 'pending' || b.status === 'confirmed'))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
      .map(b => ({ start: b.start, end: b.end, status: bookingStatus(b) }));
  }

  /* DinkHub's own wording, checked before Pickleball validates the same slot */
  function requestProblem(user, court, venue, date, start, end) {
    const today = S.today();
    const maxDate = S.addDays(today, 90);
    if (!court) return 'Select a court to book.';
    if (court.status === 'maintenance') return 'This court is not accepting bookings right now.';
    if (!venue || !venue.id || reviewStatus(venue) !== 'approved' || !isListed(venue)) {
      return 'This venue is not available for public booking.';
    }
    if (user.role === 'owner' && isOwnedBy(venue, user)) {
      return 'You cannot book a court in your own venue.';
    }
    if (isAdmin(user)) return 'Administrator accounts cannot create player bookings.';
    if (date < today) return 'Choose today or a future date.';
    if (date > maxDate) return 'Bookings can be requested up to 90 days ahead.';
    if (end <= start) return 'The end time must be later than the start time.';
    const length = toMinutes(end) - toMinutes(start);
    if (length < 30) return 'Book at least 30 minutes of court time.';
    if (length > 360) return 'A single request cannot exceed 6 hours. Split longer sessions.';
    const hours = hoursFor(venue);
    if (hours.closed) return 'The venue is closed on this day.';
    if (start < hours.opens || end > hours.closes) {
      return 'This venue accepts play between ' + DATA.ampm(hours.opens) + ' and ' + DATA.ampm(hours.closes) + '.';
    }
    if (date === today && toMinutes(start) <= clockMinutes()) {
      return 'That start time has already passed. Choose a later slot.';
    }
    const clash = S.ops.conflictFor(court.id, date, start, Math.max(1, length / 60));
    if (clash) {
      return court.name + ' is already reserved from ' + timeLabel(clash.start, clash.end) + ' on this date.';
    }
    return null;
  }

  function clockMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /* Pickleball keys its errors on its own field names; the DinkHub form
     paints errors by its own, so the two are translated here. */
  function translateErrors(errors) {
    const map = { start: 'start_time', duration: 'end_time', courtId: 'court', playerId: 'court' };
    const out = {};
    Object.keys(errors || {}).forEach(key => { out[map[key] || key] = errors[key]; });
    return out;
  }

  /* ---------- responses ---------- */

  function ok(payload, status) {
    return Object.assign({ ok: true, status: status || 200 }, payload);
  }

  function fail(status, payload) {
    return Object.assign({ ok: false, status: status }, payload);
  }

  const UNAUTHORISED = () => fail(401, { login: true, error: 'Sign in required.' });

  /* ============================================================
     Endpoint handlers — the same paths the Django port answered
     ============================================================ */

  const handlers = {

    'GET /api/home': function () {
      /* testimonials, FAQs and the facility copy are editorial content that
         still lives in SQLite; everything numeric comes from the club store */
      return Api.server('GET', '/api/home').then(base => {
        const rows = venues().filter(PUBLIC);
        const byCreated = (a, b) => String(meta(b).createdAt || '').localeCompare(String(meta(a).createdAt || ''));
        const locations = {};
        rows.forEach(v => {
          const row = publicVenueRow(v);
          const key = row.city + '|' + row.province;
          locations[key] = locations[key] || { city: row.city, province: row.province, total: 0 };
          locations[key].total += 1;
        });
        const bookings = S.list('bookings');
        const playerStat = (base.stats || []).filter(s => s.label === 'Registered players')[0];
        const stats = [
          { value: rows.length, label: 'Approved venues', icon: 'pin' },
          { value: rows.reduce((sum, v) => sum + courtsOf(v.id, true).length, 0), label: 'Bookable courts', icon: 'paddle' },
          { value: bookings.filter(b => b.status === 'confirmed').length, label: 'Confirmed bookings', icon: 'calendar' },
          playerStat || { value: S.list('players').length, label: 'Registered players', icon: 'users' }
        ].filter(s => s.value);

        return Promise.all(rows.slice().sort(byCreated).slice(0, 3).map(v => withFacilities(publicVenueRow(v), v)))
          .then(featured => Object.assign({}, base, {
            ok: true, status: 200,
            featured_venues: featured,
            locations: Object.keys(locations).map(k => locations[k])
              .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city)).slice(0, 6),
            stats: stats
          }));
      });
    },

    'GET /api/about': function () {
      const rows = venues().filter(PUBLIC);
      return ok({
        venue_total: rows.length,
        court_total: rows.reduce((sum, v) => sum + courtsOf(v.id, true).length, 0)
      });
    },

    'GET /api/venues': function (ctx, params, query) {
      const q = String(query.q || '').trim().toLowerCase();
      const city = String(query.city || '').trim();
      const setting = String(query.setting || '').trim();
      const facility = String(query.facility || '').trim();
      const sort = { recommended: 1, newest: 1, name: 1, price_low: 1, price_high: 1 }[query.sort] ? query.sort : 'recommended';

      let rows = venues().filter(PUBLIC);
      if (q) {
        rows = rows.filter(v => {
          const row = publicVenueRow(v);
          return ['name', 'city', 'province', 'address', 'barangay', 'tagline']
            .some(field => String(row[field] || '').toLowerCase().indexOf(q) > -1);
        });
      }
      if (city) rows = rows.filter(v => String(publicVenueRow(v).city).toLowerCase() === city.toLowerCase());
      if (setting === 'indoor' || setting === 'outdoor') {
        rows = rows.filter(v => {
          const value = publicVenueRow(v).setting;
          return value === setting || value === 'both';
        });
      }
      if (facility) rows = rows.filter(v => facilitySlugs(v).indexOf(facility) > -1);

      const rateOf = v => { const r = startingRate(v); return r == null ? null : r; };
      const SORTS = {
        recommended: (a, b) => (publicVenueRow(b).is_demo - publicVenueRow(a).is_demo) || a.name.localeCompare(b.name),
        newest: (a, b) => String(meta(b).createdAt || '').localeCompare(String(meta(a).createdAt || '')),
        name: (a, b) => a.name.localeCompare(b.name),
        price_low: (a, b) => (rateOf(a) == null ? 1e12 : rateOf(a)) - (rateOf(b) == null ? 1e12 : rateOf(b)),
        price_high: (a, b) => (rateOf(b) == null ? -1 : rateOf(b)) - (rateOf(a) == null ? -1 : rateOf(a))
      };
      rows = rows.slice().sort(SORTS[sort]);

      const perPage = 9;
      const total = rows.length;
      const pages = Math.max(1, Math.ceil(total / perPage));
      const current = Math.min(Math.max(1, Number(query.page) || 1), pages);
      const slice = rows.slice((current - 1) * perPage, current * perPage);

      return Promise.all([
        Promise.all(slice.map(v => withFacilities(publicVenueRow(v), v))),
        facilitiesCatalog()
      ]).then(parts => ok({
        venues: parts[0],
        total: total,
        page: current,
        pages: pages,
        per_page: perPage,
        cities: [...new Set(venues().filter(PUBLIC).map(v => publicVenueRow(v).city))].sort(),
        facilities: parts[1],
        date: String(query.date || ''),
        filters: { q: query.q || '', city: city, setting: setting, facility: facility, date: query.date || '' },
        has_filters: !!(q || city || setting || facility)
      }));
    },

    'GET /api/venues/:slug': function (ctx, params) {
      const v = venueBySlug(params.slug);
      if (!v) return fail(404, { error: 'Venue not found.' });
      const verified = reviewStatus(v) === 'approved';
      const canPreview = !!ctx.user && (isAdmin(ctx.user) || isOwnedBy(v, ctx.user));
      if (!verified && !canPreview) return fail(404, { error: 'not_public', venue: venueDetail(v) });
      return withFacilities(venueDetail(v), v).then(detail =>
        ok({ venue: detail, can_preview: canPreview && !verified, can_manage: canPreview }));
    },

    'POST /api/venues': function (ctx, params, query, body) {
      const user = ctx.user;
      if (!user) return UNAUTHORISED();
      if (!(user.role === 'owner' || isAdmin(user))) return ok({ redirect: '/courts/owner/join', error: 'Owner tools are not enabled yet.' });

      const errors = validateVenue(body);
      if (Object.keys(errors).length) return fail(422, { errors: errors });

      return uploadImage(body.cover).then(cover => {
        const created = S.add('venues', {
          name: String(body.name).trim(),
          barangay: String(body.barangay || ''),
          courts: 0,
          indoor: body.setting === 'indoor' || body.setting === 'both',
          open: body.opening_time || '06:00',
          close: body.closing_time || '22:00',
          rating: 0,
          x: 500, y: 350,
          lat: body.latitude === '' ? null : Number(body.latitude),
          lng: body.longitude === '' ? null : Number(body.longitude),
          status: 'open',
          price: body.rate_per_hour === '' || body.rate_per_hour == null ? 0 : Number(body.rate_per_hour),
          note: String(body.tagline || '')
        });
        created.dk = {
          slug: uniqueSlug(created.name, created.id),
          status: 'pending',
          active: 1,
          ownerId: user.id,
          ownerName: displayName(user),
          ownerEmail: user.email || '',
          isDemo: false,
          cover: cover || null,
          photos: [],
          facilities: Array.isArray(body.facilities) ? body.facilities.slice() : [],
          createdAt: stamp(),
          updatedAt: stamp()
        };
        writeVenueFields(created, body);
        created.dk.slug = uniqueSlug(created.name, created.id);
        applyCourts(created.id, body.courts);
        commit('venue:create');
        return ok({ venue: venueDetail(created) });
      });
    },

    'PUT /api/venues/:slug': function (ctx, params, query, body) {
      const user = ctx.user;
      if (!user) return UNAUTHORISED();
      const v = venueBySlug(params.slug);
      if (!v) return fail(404, { error: 'Venue not found.' });
      if (!(isOwnedBy(v, user) || isAdmin(user))) {
        return fail(403, { error: 'You can only manage your own venues.' });
      }

      const errors = validateVenue(body);
      if (Object.keys(errors).length) return fail(422, { errors: errors });

      /* an owner edit on an approved listing sends it back for re-check */
      const resubmit = !isAdmin(user) && reviewStatus(v) === 'approved';
      const extra = Object.assign({}, v.dk);
      if (resubmit) {
        extra.status = 'pending';
        extra.reviewNote = '';
        extra.reviewedAt = null;
        extra.reviewedBy = null;
      }

      return uploadImages(body.photos).then(urls => uploadImage(body.cover).then(coverUrl => {
        const photos = (extra.photos || []).slice();
        urls.filter(Boolean).forEach((url, i) => {
          photos.push({ id: 'ph-' + Date.now().toString(36) + '-' + i, image: url, caption: '', sort_order: photos.length });
        });
        extra.photos = photos;
        if (coverUrl) extra.cover = coverUrl;
        v.dk = extra;
        writeVenueFields(v, body);
        applyCourts(v.id, body.courts);
        commit('venue:update');
        return ok({ venue: venueDetail(v) });
      }));
    },

    'POST /api/venues/:slug/toggle': function (ctx, params) {
      const user = ctx.user;
      if (!user) return UNAUTHORISED();
      const v = venueBySlug(params.slug);
      if (!v) return fail(404, { error: 'Venue not found.' });
      if (!(isOwnedBy(v, user) || isAdmin(user))) return fail(403, { error: 'Not allowed.' });

      const next = isListed(v) ? 0 : 1;
      v.dk = Object.assign({}, v.dk, { active: next, updatedAt: stamp() });
      commit('venue:toggle');
      const detail = venueDetail(v);
      return ok({
        is_active: !!next,
        venue: detail,
        message: detail.name + ' is now ' + (next ? 'listed' : 'paused') + '.'
      });
    },

    'DELETE /api/venues/photos/:pk': function (ctx, params) {
      const user = ctx.user;
      if (!user) return UNAUTHORISED();
      const v = venues().find(venue => (meta(venue).photos || []).some(p => String(p.id) === params.pk));
      if (!v) return fail(404, { error: 'Photo not found.' });
      if (!(isOwnedBy(v, user) || isAdmin(user))) return fail(403, { error: 'Not allowed.' });
      v.dk = Object.assign({}, v.dk, {
        photos: (meta(v).photos || []).filter(p => String(p.id) !== params.pk)
      });
      commit('photo:delete');
      return ok({ slug: slugOf(v) });
    },

    'GET /api/courts/:id/availability': function (ctx, params, query) {
      const court = S.get('courts', params.id);
      if (!court) return fail(404, { error: 'Court not found.' });
      const v = venueById(court.venueId);
      const date = query.date || S.today();
      const hours = hoursFor(v);
      return ok({
        court: court.id,
        date: date,
        closed: hours.closed,
        opens: hours.opens,
        closes: hours.closes,
        slots: slotChoices(v, date).slots,
        intervals: bookedIntervals(court.id, date)
      });
    },

    'GET /api/courts/:id/booking': function (ctx, params) {
      if (!ctx.user) return UNAUTHORISED();
      const court = S.get('courts', params.id);
      if (!court) return fail(404, { error: 'Court not found.' });
      const v = venueById(court.venueId);
      if (court.status === 'maintenance' || reviewStatus(v) !== 'approved' || !isListed(v)) {
        return ok({ redirect: '/courts', error: 'That court is not open for public booking.' });
      }
      const today = S.today();
      const day = slotChoices(v, today);
      const detail = venueDetail(v);
      const mapped = dinkCourt(court);
      return ok({
        court: mapped,
        venue: detail,
        today: today,
        max_date: S.addDays(today, 90),
        slots: day.slots,
        opens: day.opens,
        closes: day.closes,
        closed: day.closed,
        booked: bookedIntervals(court.id, today)
      });
    },

    'POST /api/bookings': function (ctx, params, query, body) {
      const user = ctx.user;
      if (!user) return UNAUTHORISED();
      const court = S.get('courts', body.court_id);
      if (!court) return fail(422, { errors: { court: ['Select a court to book.'] } });

      const errors = {};
      if (!body.date) errors.date = ['This field is required.'];
      if (!body.start_time) errors.start_time = ['This field is required.'];
      if (!body.end_time) errors.end_time = ['This field is required.'];
      if (String(body.note || '').length > 280) errors.note = ['Ensure this value has at most 280 characters.'];
      if (Object.keys(errors).length) return fail(422, { errors: errors });

      const problem = requestProblem(user, court, venueById(court.venueId), body.date, body.start_time, body.end_time);
      if (problem) return fail(422, { errors: { __all__: [problem] } });

      const player = playerFor(user);
      const duration = Math.max(1, Math.round((toMinutes(body.end_time) - toMinutes(body.start_time)) / 60));
      const result = S.ops.createBooking({
        playerId: player.id,
        courtId: court.id,
        date: body.date,
        start: body.start_time,
        duration: duration,
        format: 'Doubles',
        players: 4,
        method: 'At the venue',
        note: String(body.note || ''),
        status: 'pending'
      });
      if (!result.ok) return fail(422, { errors: translateErrors(result.errors) });

      commit('booking:create');
      return ok({
        booking: bookingJson(result.booking),
        redirect: '/dashboard/player',
        message: 'Request sent. The venue owner will review it - you will see the status in your dashboard.'
      });
    },

    'GET /api/bookings/:reference': function (ctx, params) {
      if (!ctx.user) return UNAUTHORISED();
      const b = bookingById(params.reference);
      if (!b) return fail(404, { error: 'Booking not found.' });
      const ctx2 = bookingContext(b);
      const allowed = samePlayer(ctx2.player, ctx.user) ||
        isOwnedBy(ctx2.venue, ctx.user) || isAdmin(ctx.user);
      if (!allowed) return fail(403, { error: 'Not allowed.' });
      return ok({ booking: bookingJson(b, true), venue: venueDetail(ctx2.venue), court: dinkCourt(ctx2.court) });
    },

    'POST /api/bookings/:reference/cancel': function (ctx, params) {
      const user = ctx.user;
      if (!user) return UNAUTHORISED();
      const b = bookingById(params.reference);
      if (!b) return fail(404, { error: 'Booking not found.' });
      const context = bookingContext(b);
      if (!samePlayer(context.player, user) && !isAdmin(user)) {
        return fail(422, { errors: { __all__: ['You can only cancel your own bookings.'] } });
      }
      const status = bookingStatus(b);
      if (status !== 'pending' && status !== 'approved') {
        return fail(422, { errors: { __all__: ['This booking can no longer be cancelled.'] } });
      }
      if (b.date < S.today()) return fail(422, { errors: { __all__: ['Past bookings cannot be cancelled.'] } });

      const done = S.ops.cancelBooking(b.id, 'Cancelled from DinkHub.');
      if (!done.ok) return fail(422, { errors: translateErrors(done.errors) });
      commit('booking:cancel');
      return ok({
        booking: bookingJson(b),
        redirect: '/dashboard/player',
        message: 'Booking ' + params.reference + ' cancelled.'
      });
    },

    'POST /api/bookings/:reference/approve': function (ctx, params, query, body) {
      return decide(ctx, params, body, 'approved');
    },

    'POST /api/bookings/:reference/reject': function (ctx, params, query, body) {
      return decide(ctx, params, body, 'rejected');
    },

    'GET /api/dashboard/redirect': function (ctx) {
      if (!ctx.user) return UNAUTHORISED();
      return ok({ redirect: ctx.user.dashboard_url });
    },

    'GET /api/dashboard/player': function (ctx) {
      const gate = roleGate(ctx, 'player');
      if (gate) return gate;
      const player = playerFor(ctx.user);
      const today = S.today();
      const rows = S.list('bookings')
        .filter(b => b.playerId === player.id)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || toMinutes(b.start) - toMinutes(a.start));
      const active = b => bookingStatus(b) !== 'cancelled';
      const upcoming = rows.filter(b => b.date >= today && active(b));
      const history = rows.filter(b => b.date < today || !active(b));
      return ok({
        upcoming: upcoming.map(b => bookingJson(b)),
        history: history.map(b => bookingJson(b)),
        counts: {
          pending: rows.filter(b => bookingStatus(b) === 'pending').length,
          approved: rows.filter(b => bookingStatus(b) === 'approved' && b.date >= today).length,
          total: rows.length
        }
      });
    },

    'GET /api/dashboard/owner': function (ctx) {
      const gate = roleGate(ctx, 'owner');
      if (gate) return gate;
      const today = S.today();
      const owned = venues().filter(v => isOwnedBy(v, ctx.user))
        .sort((a, b) => String(meta(b).createdAt || '').localeCompare(String(meta(a).createdAt || '')));
      const courtIds = {};
      owned.forEach(v => courtsOf(v.id, false).forEach(c => { courtIds[c.id] = v.id; }));
      const mine = S.list('bookings').filter(b => courtIds[b.courtId] !== undefined);

      const requests = mine.filter(b => bookingStatus(b) === 'pending')
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || toMinutes(a.start) - toMinutes(b.start));
      const approvedUpcoming = mine.filter(b => bookingStatus(b) === 'approved' && b.date >= today)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || toMinutes(a.start) - toMinutes(b.start));

      return Promise.all(owned.map(v => withFacilities(venueDetail(v), v).then(detail => Object.assign(detail, {
        court_count: courtsOf(v.id, true).length,
        is_active: isListed(v)
      })))).then(rows => ok({
        venues: rows,
        requests: requests.map(b => bookingJson(b)),
        schedule: approvedUpcoming.slice(0, 12).map(b => bookingJson(b)),
        counts: {
          court_total: Object.keys(courtIds).filter(id => S.get('courts', id).status !== 'maintenance').length,
          approved_count: mine.filter(b => bookingStatus(b) === 'approved').length,
          pending_count: requests.length
        },
        revenue: approvedUpcoming.reduce((sum, b) => sum + (b.amount || 0), 0)
      }));
    },

    'GET /api/dashboard/admin': function (ctx) {
      const gate = roleGate(ctx, 'admin');
      if (gate) return gate;
      const rows = venues();
      const pendingVenues = rows.filter(v => reviewStatus(v) === 'pending')
        .sort((a, b) => String(meta(a).createdAt || '').localeCompare(String(meta(b).createdAt || '')));
      const allVenues = rows.slice()
        .sort((a, b) => String(meta(b).createdAt || '').localeCompare(String(meta(a).createdAt || '')))
        .slice(0, 12);
      const bookings = S.list('bookings');

      /* players and owners are accounts, so SQLite still answers for them */
      return Api.server('GET', '/api/dashboard/admin').then(base => Promise.all([
        Promise.all(pendingVenues.map(v => withFacilities(venueDetail(v), v))),
        Promise.all(allVenues.map(v => withFacilities(venueDetail(v), v)))
      ]).then(parts => ok({
        pending_venues: parts[0],
        all_venues: parts[1],
        recent_bookings: bookings.slice(0, 10).map(b => bookingJson(b)),
        stats: {
          pending: pendingVenues.length,
          venues: rows.length,
          approved: rows.filter(v => reviewStatus(v) === 'approved').length,
          players: base.stats ? base.stats.players : 0,
          owners: base.stats ? base.stats.owners : 0,
          bookings: bookings.length,
          approved_bookings: bookings.filter(b => bookingStatus(b) === 'approved').length
        },
        venue_stats: base.venue_stats || []
      })));
    },

    'GET /api/dashboard/users': function (ctx) {
      const gate = roleGate(ctx, 'admin');
      if (gate) return gate;
      return Api.server('GET', '/api/dashboard/users').then(res => {
        if (!res.ok) return res;
        const players = S.list('players');
        const bookings = S.list('bookings');
        const accountOf = p => (p.dk && p.dk.account) || String(p.email || '').toLowerCase();
        return ok({
          users: res.users.map(account => Object.assign({}, account, {
            venue_total: venues().filter(v => isOwnedBy(v, account)).length,
            booking_total: bookings.filter(b => {
              const p = players.find(row => row.id === b.playerId);
              if (!p) return false;
              const link = accountOf(p);
              return link === account.username || link === String(account.email || '').toLowerCase();
            }).length
          }))
        });
      });
    },

    'POST /api/dashboard/admin/venues/:slug/review': function (ctx, params, query, body) {
      const gate = roleGate(ctx, 'admin');
      if (gate) return gate;
      const v = venueBySlug(params.slug);
      if (!v) return fail(404, { error: 'Venue not found.' });

      const action = body.action;
      const note = String(body.note || '').trim();
      const extra = Object.assign({}, v.dk);
      let message = '';
      let level = 'success';

      if (action === 'approve') {
        extra.status = 'approved'; extra.active = 1; extra.reviewNote = note;
        message = v.name + ' approved and published.';
      } else if (action === 'reject') {
        extra.status = 'rejected';
        extra.reviewNote = note || 'The submission did not pass review.';
        message = v.name + ' rejected. The owner can edit and resubmit.';
        level = 'warning';
      } else if (action === 'pause') {
        extra.active = 0; message = v.name + ' paused.'; level = 'info';
      } else if (action === 'resume') {
        extra.active = 1; message = v.name + ' resumed.'; level = 'info';
      } else {
        return fail(422, { error: 'Unknown action.' });
      }

      extra.reviewedBy = ctx.user.id;
      extra.reviewedAt = stamp();
      extra.updatedAt = stamp();
      v.dk = extra;
      commit('venue:review');
      return ok({ message: message, level: level, venue: venueDetail(v) });
    },

    'GET /api/booking-window': function () {
      const today = S.today();
      return facilitiesCatalog().then(catalog => ok({
        today: today,
        max: S.addDays(today, 90),
        facilities: catalog
      }));
    }
  };

  function roleGate(ctx, role) {
    if (!ctx.user) return UNAUTHORISED();
    if (isAdmin(ctx.user) || ctx.user.role === role) return null;
    return ok({
      error: 'That dashboard is not available for your account type.',
      redirect: ctx.user.dashboard_url || '/'
    }, 200);
  }

  function decide(ctx, params, body, verdict) {
    const user = ctx.user;
    if (!user) return UNAUTHORISED();
    const b = bookingById(params.reference);
    if (!b) return fail(404, { error: 'Booking not found.' });
    const context = bookingContext(b);
    if (!(isAdmin(user) || isOwnedBy(context.venue, user))) {
      return fail(403, { error: 'You can only decide on requests for your own venues.' });
    }
    if (bookingStatus(b) !== 'pending') {
      return fail(422, { errors: { __all__: ['Only pending requests can be ' + (verdict === 'approved' ? 'approved' : 'rejected') + '.'] } });
    }

    const extra = Object.assign({}, b.dk, {
      dinkStatus: verdict,
      decidedAt: stamp(),
      decidedBy: user.id,
      decidedByName: displayName(user),
      decisionNote: String(body.note || '')
    });

    if (verdict === 'approved') {
      const clash = S.ops.conflictFor(b.courtId, b.date, b.start, b.duration, b.id);
      if (clash) {
        return fail(422, {
          errors: {
            __all__: [context.court.name + ' is already approved for ' + timeLabel(clash.start, clash.end) +
              ' on ' + b.date + '. Reject this request or ask the player to rebook.']
          }
        });
      }
      b.status = 'confirmed';
      b.method = b.method === '—' ? 'At the venue' : b.method;
      extra.amount = Math.round((context.court.pricePerHour || 0) * (Number(b.duration) || 1) * 100) / 100;
      b.amount = extra.amount;
      /* Pickleball often already holds the unpaid invoice for a pending
         request — settle that one instead of raising a second. */
      const bill = S.list('payments').find(p => p.refId === b.id && p.status !== 'paid' && p.status !== 'refunded');
      if (bill) {
        bill.status = 'paid';
        bill.amount = b.amount;
        bill.method = b.method;
        bill.date = S.today();
      } else {
        S.add('payments', {
          playerId: b.playerId,
          who: context.player.name,
          kind: 'Court booking',
          refId: b.id,
          item: context.court.name + ' · ' + S.fmtDate(b.date) + ' ' + b.start + '–' + b.end,
          amount: b.amount,
          method: b.method,
          status: 'paid',
          date: S.today(),
          ref: 'DH' + Math.floor(100000 + Math.random() * 899999)
        });
      }
    } else {
      b.status = 'cancelled';
      b.note = String(body.note || '') || b.note;
    }

    b.dk = extra;
    commit('booking:' + verdict);
    return ok({
      booking: bookingJson(b),
      redirect: '/dashboard/owner',
      message: params.reference + (verdict === 'approved' ? ' approved.' : ' rejected.')
    });
  }

  /* ============================================================
     Routing
     ============================================================ */

  const PATTERNS = Object.keys(handlers).map(key => {
    const parts = key.split(' ');
    return {
      method: parts[0],
      source: parts[1].replace(/:[A-Za-z_]+/g, '([^/]+)'),
      keys: (parts[1].match(/:[A-Za-z_]+/g) || []).map(k => k.slice(1)),
      handler: handlers[key]
    };
  });

  function match(method, pathname) {
    for (let i = 0; i < PATTERNS.length; i++) {
      const p = PATTERNS[i];
      if (p.method !== method) continue;
      const hit = new RegExp('^' + p.source + '$').exec(pathname);
      if (!hit) continue;
      const params = {};
      p.keys.forEach((key, index) => { params[key] = decodeURIComponent(hit[index + 1]); });
      return { handler: p.handler, params: params };
    }
    return null;
  }

  function handle(method, url, body) {
    const split = url.indexOf('?');
    const pathname = split === -1 ? url : url.slice(0, split);
    if (pathname.indexOf('/api/') !== 0) return null;
    const found = match(method, pathname);
    if (!found) return null;

    const query = {};
    new URLSearchParams(split === -1 ? '' : url.slice(split + 1)).forEach((value, key) => { query[key] = value; });

    return load().then(() => {
      const ctx = { user: Store.sel.user() };
      return Promise.resolve(found.handler(ctx, found.params, query, body || {}));
    }).then(payload => {
      const out = payload || ok({});
      out.call = 0;
      if (out.status === 401 && out.login !== false) out.login = true;
      return out;
    }).catch(err => {
      console.error(err);
      return fail(500, { error: String((err && err.message) || err) });
    });
  }

  /* A second tab running Pickleball writes the same localStorage key. */
  window.addEventListener('storage', event => {
    if (event.key !== 'piklemarawi-db') return;
    loading = null;
    load().then(() => { if (window.reloadRoute) window.reloadRoute(); }).catch(() => {});
  });

  Api.use(handle);

  return {
    load: load,
    handle: handle,
    get store() { return S; },
    venueDetail: venueDetail,
    bookingJson: bookingJson,
    playerFor: playerFor
  };
})();

window.Pickle = Pickle;
