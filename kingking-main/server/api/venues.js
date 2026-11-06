/* ============================================================
   /api/venues — venues/views.py (browse, detail, create, edit,
   toggle, photos) plus the venue part of the booking form.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const store = require('../db');
const clock = require('../clock');
const M = require('../models');
const { json } = require('../http-kit');
const { UPLOAD_DIR, MEDIA_URL, BOOKING_MAX_ADVANCE_DAYS } = require('../config');

/* SORT_OPTIONS from venues/views.py — recommended keeps demo rows last. */
const SORTS = {
  recommended: (a, b) => (b.is_demo - a.is_demo) || a.name.localeCompare(b.name),
  newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
  name: (a, b) => a.name.localeCompare(b.name),
  price_low: (a, b) => (a.rate_per_hour == null ? 1e12 : a.rate_per_hour) - (b.rate_per_hour == null ? 1e12 : b.rate_per_hour),
  price_high: (a, b) => (b.rate_per_hour == null ? -1 : b.rate_per_hour) - (a.rate_per_hour == null ? -1 : a.rate_per_hour)
};

const PER_PAGE = 9;

const PUBLIC = "status = 'approved' AND is_active = 1";

function isOwnerOrAdmin(user) {
  return !!user && (user.role === 'owner' || M.isAdministrator(user));
}

function venueOwner(venue, user) {
  return !!user && (user.id === venue.owner_id || M.isAdministrator(user));
}

/* VenueForm + Venue.clean(): the same messages Django raised. */
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
  if (opening && closing && clock.toMinutes(closing) <= clock.toMinutes(opening)) {
    all.push('Closing time must be later than the opening time.');
  }
  const lat = body.latitude;
  const lng = body.longitude;
  if (lat != null && lat !== '' && (Number(lat) < -90 || Number(lat) > 90)) errors.latitude = ['Latitude must be between -90 and 90.'];
  if (lng != null && lng !== '' && (Number(lng) < -180 || Number(lng) > 180)) errors.longitude = ['Longitude must be between -180 and 180.'];
  if (all.length) errors.__all__ = all;
  return errors;
}

function applyFacilities(venueId, slugs) {
  store.run('DELETE FROM venue_facilities WHERE venue_id = ?', venueId);
  (Array.isArray(slugs) ? slugs : []).forEach(slug => {
    const facility = store.get('SELECT id FROM facilities WHERE slug = ?', slug);
    if (facility) store.run('INSERT OR IGNORE INTO venue_facilities (venue_id, facility_id) VALUES (?,?)', venueId, facility.id);
  });
}

/* Courts arrive as an array, replacing the inline formset rows. */
function applyCourts(venueId, courts) {
  const keep = [];
  (Array.isArray(courts) ? courts : []).forEach(row => {
    if (row.delete) return;
    const name = String(row.name || '').trim();
    if (!name) return;
    const rate = row.hourly_rate === '' || row.hourly_rate == null ? null : Number(row.hourly_rate);
    if (row.id && store.get('SELECT id FROM courts WHERE id = ? AND venue_id = ?', row.id, venueId)) {
      store.run('UPDATE courts SET name = ?, surface = ?, is_indoor = ?, hourly_rate = ?, notes = ?, is_active = ? WHERE id = ?',
        name, row.surface || 'acrylic', row.is_indoor ? 1 : 0, rate, String(row.notes || ''), row.is_active === false ? 0 : 1, row.id);
      keep.push(row.id);
    } else {
      keep.push(store.insert(
        'INSERT INTO courts (venue_id, name, surface, is_indoor, hourly_rate, notes, is_active, created_at) VALUES (?,?,?,?,?,?,?,?)',
        venueId, name, row.surface || 'acrylic', row.is_indoor ? 1 : 0, rate, String(row.notes || ''),
        row.is_active === false ? 0 : 1, clock.stamp()));
    }
  });
  const rows = store.all('SELECT id FROM courts WHERE venue_id = ?', venueId);
  rows.forEach(r => {
    if (keep.includes(r.id)) return;
    /* Django's on_delete=PROTECT: a court with booking history cannot be removed. */
    if (store.scalar('SELECT COUNT(*) FROM bookings WHERE court_id = ?', r.id)) return;
    store.run('DELETE FROM courts WHERE id = ?', r.id);
  });
}

/* dataURL -> media file; returns the public URL or null when the payload is unusable. */
function writeImage(stem, payload) {
  if (!payload || !payload.data) return null;
  const matches = /^data:([^;]+);base64,(.+)$/s.exec(String(payload.data));
  if (!matches) return null;
  const subtype = (matches[1].split('/')[1] || 'jpg').replace('+xml', '');
  const name = stem + '-' + Date.now().toString(36) + '-' +
    Math.random().toString(36).slice(2, 6) + '.' + subtype;
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(matches[2], 'base64'));
  return MEDIA_URL + name;
}

function saveImage(venueId, payload, order) {
  const url = writeImage('venue-' + venueId, payload);
  if (!url) return null;
  return store.insert('INSERT INTO venue_images (venue_id, image, caption, sort_order) VALUES (?,?,?,?)',
    venueId, url, String(payload.caption || ''), order);
}

function attach(router) {
  /* venues:browse — filters, sort, pagination, facets. */
  router.get('/api/venues', (req, res) => {
    const q = (req.query.q || '').trim();
    const city = (req.query.city || '').trim();
    const setting = (req.query.setting || '').trim();
    const facility = (req.query.facility || '').trim();
    const sort = SORTS[req.query.sort] ? req.query.sort : 'recommended';
    const date = (req.query.date || '').trim();

    let rows = store.all('SELECT * FROM venues WHERE ' + PUBLIC);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(v => ['name', 'city', 'province', 'address', 'barangay', 'tagline']
        .some(field => String(v[field] || '').toLowerCase().includes(needle)));
    }
    if (city) rows = rows.filter(v => String(v.city).toLowerCase() === city.toLowerCase());
    if (setting === 'indoor' || setting === 'outdoor') rows = rows.filter(v => v.setting === setting || v.setting === 'both');
    if (facility) {
      rows = rows.filter(v => store.get(
        'SELECT 1 AS hit FROM venue_facilities vf JOIN facilities f ON f.id = vf.facility_id ' +
        'WHERE vf.venue_id = ? AND f.slug = ?', v.id, facility));
    }
    rows.sort(SORTS[sort]);

    const page = Math.max(1, Number(req.query.page) || 1);
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const current = Math.min(page, pages);
    const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

    json(res, 200, {
      ok: true,
      venues: slice.map(M.publicVenueRow),
      total,
      page: current,
      pages,
      per_page: PER_PAGE,
      cities: [...new Set(store.all('SELECT city FROM venues WHERE ' + PUBLIC).map(v => v.city))].sort(),
      facilities: store.all('SELECT * FROM facilities ORDER BY name'),
      date,
      filters: { q, city, setting, facility, date },
      has_filters: !!(q || city || setting || facility)
    });
  });

  /* venues:detail — unverified venues are 404 unless owner/admin previews them. */
  router.get('/api/venues/:slug', (req, res) => {
    const venue = store.get('SELECT * FROM venues WHERE slug = ?', req.params.slug);
    if (!venue) return json(res, 404, { ok: false, error: 'Venue not found.' });
    const verified = venue.status === 'approved';
    const canPreview = venueOwner(venue, req.user);
    if (!verified && !canPreview) return json(res, 404, { ok: false, error: 'not_public', venue: M.venueDetail(venue) });
    json(res, 200, {
      ok: true,
      venue: M.venueDetail(venue),
      can_preview: canPreview && !verified,
      can_manage: canPreview
    });
  });

  /* venues:create — status is forced to pending for review. */
  router.post('/api/venues', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    if (!isOwnerOrAdmin(req.user)) return json(res, 200, { ok: false, redirect: '/courts/owner/join' });

    const errors = validateVenue(req.body);
    if (Object.keys(errors).length) return json(res, 422, { ok: false, errors });

    const id = store.insert(
      'INSERT INTO venues (owner_id, name, slug, tagline, description, address, barangay, city, province, ' +
      'latitude, longitude, contact_phone, contact_email, setting, rate_per_hour, opening_time, closing_time, ' +
      'cover, status, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      req.user.id, String(req.body.name).trim(), M.uniqueSlug(req.body.name), String(req.body.tagline || ''),
      String(req.body.description || ''), String(req.body.address || ''), String(req.body.barangay || ''),
      String(req.body.city || 'Marawi City'), String(req.body.province || 'Lanao del Sur'),
      req.body.latitude === '' ? null : req.body.latitude, req.body.longitude === '' ? null : req.body.longitude,
      String(req.body.contact_phone || ''), String(req.body.contact_email || ''), req.body.setting || 'outdoor',
      req.body.rate_per_hour === '' || req.body.rate_per_hour == null ? null : Number(req.body.rate_per_hour),
      req.body.opening_time || '06:00', req.body.closing_time || '22:00',
      null, 'pending', 1, clock.stamp(), clock.stamp());

    applyFacilities(id, req.body.facilities);
    applyCourts(id, req.body.courts);
    const cover = writeImage('venue-' + id, req.body.cover);
    if (cover) store.run('UPDATE venues SET cover = ? WHERE id = ?', cover, id);
    json(res, 200, { ok: true, venue: M.venueDetail(store.get('SELECT * FROM venues WHERE id = ?', id)) });
  });

  /* venues:edit — an owner edit on an approved venue sends it back for re-check. */
  router.put('/api/venues/:slug', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    const venue = store.get('SELECT * FROM venues WHERE slug = ?', req.params.slug);
    if (!venue) return json(res, 404, { ok: false, error: 'Venue not found.' });
    if (!venueOwner(venue, req.user)) return json(res, 403, { ok: false, error: 'You can only manage your own venues.' });

    const errors = validateVenue(req.body);
    if (Object.keys(errors).length) return json(res, 422, { ok: false, errors });

    let status = venue.status;
    let reviewNote = venue.review_note;
    let reviewedAt = venue.reviewed_at;
    let reviewedBy = venue.reviewed_by;
    if (!M.isAdministrator(req.user) && venue.status === 'approved') {
      status = 'pending';
      reviewNote = '';
      reviewedAt = null;
      reviewedBy = null;
    }

    store.run(
      'UPDATE venues SET name = ?, tagline = ?, description = ?, address = ?, barangay = ?, city = ?, ' +
      'province = ?, latitude = ?, longitude = ?, contact_phone = ?, contact_email = ?, setting = ?, ' +
      'rate_per_hour = ?, opening_time = ?, closing_time = ?, status = ?, review_note = ?, reviewed_at = ?, ' +
      'reviewed_by = ?, updated_at = ? WHERE id = ?',
      String(req.body.name).trim(), String(req.body.tagline || ''), String(req.body.description || ''),
      String(req.body.address || ''), String(req.body.barangay || ''), String(req.body.city || 'Marawi City'),
      String(req.body.province || 'Lanao del Sur'),
      req.body.latitude === '' ? null : req.body.latitude, req.body.longitude === '' ? null : req.body.longitude,
      String(req.body.contact_phone || ''), String(req.body.contact_email || ''), req.body.setting || 'outdoor',
      req.body.rate_per_hour === '' || req.body.rate_per_hour == null ? null : Number(req.body.rate_per_hour),
      req.body.opening_time || '06:00', req.body.closing_time || '22:00', status, reviewNote, reviewedAt,
      reviewedBy, clock.stamp(), venue.id);

    applyFacilities(venue.id, req.body.facilities);
    applyCourts(venue.id, req.body.courts);
    (Array.isArray(req.body.photos) ? req.body.photos : []).forEach((photo, i) => saveImage(venue.id, photo, i));
    if (req.body.cover) {
      const cover = writeImage('venue-' + venue.id, req.body.cover);
      if (cover) store.run('UPDATE venues SET cover = ? WHERE id = ?', cover, venue.id);
    }

    json(res, 200, { ok: true, venue: M.venueDetail(store.get('SELECT * FROM venues WHERE id = ?', venue.id)) });
  });

  /* venues:toggle — pause or resume without touching review state. */
  router.post('/api/venues/:slug/toggle', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    const venue = store.get('SELECT * FROM venues WHERE slug = ?', req.params.slug);
    if (!venue) return json(res, 404, { ok: false, error: 'Venue not found.' });
    if (!venueOwner(venue, req.user)) return json(res, 403, { ok: false, error: 'Not allowed.' });
    const next = venue.is_active ? 0 : 1;
    store.run('UPDATE venues SET is_active = ?, updated_at = ? WHERE id = ?', next, clock.stamp(), venue.id);
    const fresh = M.venueDetail(store.get('SELECT * FROM venues WHERE id = ?', venue.id));
    json(res, 200, {
      ok: true,
      is_active: !!next,
      venue: fresh,
      message: fresh.name + ' is now ' + (next ? 'listed' : 'paused') + '.'
    });
  });

  /* venues:delete_photo */
  router.delete('/api/venues/photos/:pk', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    const photo = store.get('SELECT * FROM venue_images WHERE id = ?', Number(req.params.pk));
    if (!photo) return json(res, 404, { ok: false, error: 'Photo not found.' });
    const venue = store.get('SELECT * FROM venues WHERE id = ?', photo.venue_id);
    if (!venueOwner(venue, req.user)) return json(res, 403, { ok: false, error: 'Not allowed.' });
    store.run('DELETE FROM venue_images WHERE id = ?', photo.id);
    json(res, 200, { ok: true, slug: venue.slug });
  });

  /* bookings:availability — a hint only; the create endpoint still validates. */
  router.get('/api/courts/:id/availability', (req, res) => {
    const court = store.get('SELECT * FROM courts WHERE id = ?', Number(req.params.id));
    if (!court) return json(res, 404, { ok: false, error: 'Court not found.' });
    const venue = store.get('SELECT * FROM venues WHERE id = ?', court.venue_id);
    const rules = require('../services/bookings');
    const date = req.query.date || clock.today();
    const day = M.hoursFor(venue, clock.weekdayOf(date));
    json(res, 200, {
      ok: true,
      court: court.id,
      date,
      closed: day.closed,
      opens: day.opens,
      closes: day.closes,
      slots: rules.slotChoices(venue, date).slots,
      intervals: rules.bookedIntervals(court.id, date)
    });
  });

  /* the Facility table, for the venue form checklist and browse facets */
  router.get('/api/facilities', (req, res) => {
    json(res, 200, { ok: true, facilities: store.all('SELECT * FROM facilities ORDER BY name') });
  });

  /* Venue rows live in Pickleball's store, so the venue form asks here for a
     home for the file itself — media stays on disk, never in localStorage. */
  router.post('/api/media', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    const url = writeImage('venue-owner-' + req.user.id, req.body);
    if (!url) return json(res, 422, { ok: false, error: 'That file could not be read as an image.' });
    json(res, 200, { ok: true, url: url });
  });

  /* shared constants the booking form needs for its min/max date inputs */
  router.get('/api/booking-window', (req, res) => {
    const today = clock.today();
    json(res, 200, { ok: true, today, max: clock.addDays(today, BOOKING_MAX_ADVANCE_DAYS), facilities: store.all('SELECT * FROM facilities ORDER BY name') });
  });
}

module.exports = { attach, validateVenue, isOwnerOrAdmin, venueOwner };
