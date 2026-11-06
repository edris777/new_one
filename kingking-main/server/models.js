/* ============================================================
   Model helpers — the Django @property / manager methods ported
   so the JSON each endpoint returns matches what the templates
   used to receive from view context.
   ============================================================ */

const store = require('./db');
const clock = require('./clock');

/* ---------- venues ---------- */

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
  let slug = base;
  let n = 2;
  for (;;) {
    const clash = store.get('SELECT id FROM venues WHERE slug = ?', slug);
    if (!clash || clash.id === selfId) return slug;
    slug = base + '-' + n;
    n += 1;
  }
}

function facilitiesOf(venueId) {
  return store.all(
    'SELECT f.* FROM facilities f JOIN venue_facilities vf ON vf.facility_id = f.id ' +
    'WHERE vf.venue_id = ? ORDER BY f.name', venueId);
}

function courtsOf(venueId, onlyActive) {
  return store.all(
    'SELECT * FROM courts WHERE venue_id = ?' + (onlyActive ? ' AND is_active = 1' : '') +
    ' ORDER BY id', venueId);
}

function hoursFor(venue, weekday) {
  const entry = store.get('SELECT * FROM opening_hours WHERE venue_id = ? AND weekday = ?', venue.id, weekday);
  if (!entry) return { opens: venue.opening_time, closes: venue.closing_time, closed: false };
  return { opens: entry.opens, closes: entry.closes, closed: !!entry.is_closed };
}

/* Venue.starting_rate — the cheapest court rate, falling back to the venue rate. */
function startingRate(venue) {
  const rates = courtsOf(venue.id, true)
    .map(c => (c.hourly_rate == null ? venue.rate_per_hour : c.hourly_rate))
    .filter(r => r != null);
  if (rates.length) return Math.min.apply(null, rates);
  return venue.rate_per_hour;
}

/* Venue.rate_display — "₱350/hour" or "Rate on request". */
function rateDisplay(rate) {
  if (rate == null) return 'Rate on request';
  return '\u20B1' + Math.round(rate).toLocaleString('en-PH') + '/hour';
}

function courtEffectiveRate(court, venue) {
  return court.hourly_rate == null ? venue.rate_per_hour : court.hourly_rate;
}

const VENUE_TONE = { approved: 'ok', pending: 'warn', rejected: 'bad', draft: 'muted' };

/* Venue.Setting / Court.Surface / Venue.Status .label values from venues/models.py */
const SETTING_LABELS = { indoor: 'Indoor', outdoor: 'Outdoor', both: 'Indoor & outdoor' };
const SURFACE_LABELS = { acrylic: 'Acrylic', concrete: 'Concrete', asphalt: 'Asphalt', cushioned: 'Cushioned', clay: 'Clay' };
const STATUS_LABELS = { draft: 'Draft', pending: 'Awaiting review', approved: 'Approved', rejected: 'Rejected' };

function publicVenueRow(venue) {
  const courts = courtsOf(venue.id, true);
  const rate = startingRate(venue);
  const weekday = clock.weekdayOf(clock.today());
  const hours = hoursFor(venue, weekday);
  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    tagline: venue.tagline,
    city: venue.city,
    province: venue.province,
    barangay: venue.barangay,
    address: venue.address,
    setting: venue.setting,
    setting_display: SETTING_LABELS[venue.setting] || venue.setting,
    cover: venue.cover,
    is_demo: !!venue.is_demo,
    rate: rate,
    rate_display: rateDisplay(rate),
    court_count: courts.length,
    location_label: venue.province ? venue.city + ', ' + venue.province : venue.city,
    map_query: [venue.address, venue.barangay, venue.city, venue.province].filter(Boolean).join(', '),
    latitude: venue.latitude,
    longitude: venue.longitude,
    opening_time: venue.opening_time,
    closing_time: venue.closing_time,
    status: venue.status,
    status_display: STATUS_LABELS[venue.status] || venue.status,
    status_tone: VENUE_TONE[venue.status] || 'muted',
    is_active: !!venue.is_active,
    hours: hours.closed ? 'Closed today' : hours.opens + ' - ' + hours.closes,
    facility_list: facilitiesOf(venue.id)
  };
}

function venueDetail(venue) {
  const courts = courtsOf(venue.id, false);
  const rate = startingRate(venue);
  const owner = store.get('SELECT * FROM users WHERE id = ?', venue.owner_id) || {};
  return Object.assign({}, publicVenueRow(venue), {
    owner_id: venue.owner_id,
    owner_name: owner.id ? displayName(owner) : 'DinkHub',
    owner_email: owner.email || '',
    description: venue.description,
    review_note: venue.review_note,
    contact_phone: venue.contact_phone,
    contact_email: venue.contact_email,
    status: venue.status,
    status_display: STATUS_LABELS[venue.status] || venue.status,
    status_tone: VENUE_TONE[venue.status] || 'muted',
    starting_rate: rate,
    is_active: !!venue.is_active,
    opening_time: venue.opening_time,
    closing_time: venue.closing_time,
    /* Django's Venue.is_verified: the review status only, never is_active. */
    is_verified: venue.status === 'approved',
    photos: store.all('SELECT * FROM venue_images WHERE venue_id = ? ORDER BY sort_order, id', venue.id),
    courts: courts.map(c => Object.assign({}, c, {
      is_indoor: !!c.is_indoor,
      is_active: !!c.is_active,
      surface_display: SURFACE_LABELS[c.surface] || c.surface,
      effective_rate: courtEffectiveRate(c, venue),
      rate_display: rateDisplay(courtEffectiveRate(c, venue))
    })),
    schedule: store.all('SELECT * FROM opening_hours WHERE venue_id = ? ORDER BY weekday', venue.id)
      .map(h => Object.assign({}, h, { is_closed: !!h.is_closed }))
  });
}

/* ---------- users ---------- */

function displayName(user) {
  const full = ((user.first_name || '') + ' ' + (user.last_name || '')).trim();
  return full || user.username || '';
}

function initialsOf(user) {
  const a = (user.first_name || ' ').trim().charAt(0);
  const b = (user.last_name || ' ').trim().charAt(0);
  const text = (a + b).trim().toUpperCase();
  return text || String(user.username || '?').slice(0, 2).toUpperCase();
}

function isAdministrator(user) {
  return !!user && (user.role === 'admin' || !!user.is_superuser);
}

function dashboardUrl(user) {
  if (isAdministrator(user)) return '/dashboard/admin';
  if (user.role === 'owner') return '/dashboard/owner';
  return '/dashboard/player';
}

function userJson(user) {
  return {
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
    city: user.city,
    role: user.role,
    display_name: displayName(user),
    initials: initialsOf(user),
    is_player: user.role === 'player',
    is_owner: user.role === 'owner',
    is_administrator: isAdministrator(user),
    is_active: !!user.is_active,
    date_joined: user.date_joined,
    dashboard_url: dashboardUrl(user)
  };
}

/* ---------- bookings ---------- */

const BOOKING_TONE = { approved: 'ok', pending: 'warn', rejected: 'bad', cancelled: 'muted' };

function durationHours(booking) {
  const mins = clock.toMinutes(booking.end_time) - clock.toMinutes(booking.start_time);
  return Math.round((mins / 60) * 100) / 100;
}

function timeLabel(booking) {
  return clock.ampm(booking.start_time) + ' \u2013 ' + clock.ampm(booking.end_time);
}

function bookingJson(booking, includeVenue) {
  const court = store.get('SELECT * FROM courts WHERE id = ?', booking.court_id) || {};
  const venue = store.get('SELECT * FROM venues WHERE id = ?', court.venue_id) || {};
  const player = store.get('SELECT * FROM users WHERE id = ?', booking.player_id) || {};
  const decider = booking.decided_by ? store.get('SELECT * FROM users WHERE id = ?', booking.decided_by) : null;
  const row = {
    id: booking.id,
    reference: booking.reference,
    date: booking.date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    status: booking.status,
    status_tone: BOOKING_TONE[booking.status] || 'muted',
    note: booking.note,
    total_amount: booking.total_amount,
    duration_hours: durationHours(booking),
    time_label: timeLabel(booking),
    can_cancel: booking.status === 'pending' || booking.status === 'approved',
    created_at: booking.created_at,
    decided_at: booking.decided_at,
    decision_note: booking.decision_note,
    decided_by_name: decider ? displayName(decider) : '',
    court_id: court.id,
    court_name: court.name,
    /* {{ booking.court.rate_display }} — the owner dashboard prints it on the request row */
    court_rate_display: rateDisplay(courtEffectiveRate(court, venue)),
    venue_id: venue.id,
    venue_name: venue.name,
    venue_slug: venue.slug,
    venue_cover: venue.cover,
    owner_id: venue.owner_id,
    player_id: player.id,
    player_name: displayName(player)
  };
  if (includeVenue) row.venue = publicVenueRow(venue);
  return row;
}

module.exports = {
  slugify, uniqueSlug, facilitiesOf, courtsOf, hoursFor, startingRate, rateDisplay,
  courtEffectiveRate, publicVenueRow, venueDetail, VENUE_TONE,
  displayName, initialsOf, isAdministrator, dashboardUrl, userJson,
  durationHours, timeLabel, bookingJson, BOOKING_TONE,
  SETTING_LABELS, SURFACE_LABELS, STATUS_LABELS
};
