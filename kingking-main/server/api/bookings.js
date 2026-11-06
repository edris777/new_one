/* ============================================================
   /api/bookings — bookings/views.py
   ============================================================ */

const store = require('../db');
const clock = require('../clock');
const M = require('../models');
const { json } = require('../http-kit');
const rules = require('../services/bookings');
const { BOOKING_MAX_ADVANCE_DAYS } = require('../config');

function attach(router) {
  /* bookings:create renders the form; the SPA asks for the court header first. */
  router.get('/api/courts/:id/booking', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, login: true });
    const court = store.get('SELECT * FROM courts WHERE id = ?', Number(req.params.id));
    if (!court) return json(res, 404, { ok: false, error: 'Court not found.' });
    const venue = store.get('SELECT * FROM venues WHERE id = ?', court.venue_id);
    const verified = venue.status === 'approved';
    if (!court.is_active || !verified) {
      return json(res, 200, { ok: false, redirect: '/courts', error: 'That court is not open for public booking.' });
    }

    const today = clock.today();
    const day = rules.slotChoices(venue, today);
    json(res, 200, {
      ok: true,
      court: Object.assign({}, court, {
        is_indoor: !!court.is_indoor,
        surface_display: M.SURFACE_LABELS[court.surface] || court.surface,
        effective_rate: M.courtEffectiveRate(court, venue),
        rate_display: M.rateDisplay(M.courtEffectiveRate(court, venue))
      }),
      venue: M.venueDetail(venue),
      today,
      max_date: clock.addDays(today, BOOKING_MAX_ADVANCE_DAYS),
      slots: day.slots,
      opens: day.opens,
      closes: day.closes,
      closed: day.closed,
      booked: rules.bookedIntervals(court.id, today)
    });
  });

  /* POST create_booking — service errors come back as fieldless form errors. */
  router.post('/api/bookings', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, login: true });
    const court = store.get('SELECT * FROM courts WHERE id = ?', Number(req.body.court_id));
    if (!court) return json(res, 422, { ok: false, errors: { court: ['Select a court to book.'] } });

    const errors = {};
    if (!req.body.date) errors.date = ['This field is required.'];
    if (!req.body.start_time) errors.start_time = ['This field is required.'];
    if (!req.body.end_time) errors.end_time = ['This field is required.'];
    if (String(req.body.note || '').length > 280) errors.note = ['Ensure this value has at most 280 characters.'];
    if (Object.keys(errors).length) return json(res, 422, { ok: false, errors });

    try {
      const booking = rules.createBooking(req.user, court, req.body.date, req.body.start_time,
        req.body.end_time, req.body.note);
      return json(res, 200, {
        ok: true,
        booking: M.bookingJson(booking),
        redirect: '/dashboard/player',
        message: 'Request sent. The venue owner will review it - you will see the status in your dashboard.'
      });
    } catch (err) {
      if (err instanceof rules.BookingError) return json(res, 422, { ok: false, errors: { __all__: [err.message] } });
      throw err;
    }
  });

  /* bookings:cancel */
  router.post('/api/bookings/:reference/cancel', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, login: true });
    const booking = store.get('SELECT * FROM bookings WHERE reference = ?', req.params.reference);
    if (!booking) return json(res, 404, { ok: false, error: 'Booking not found.' });
    try {
      const done = rules.cancelBooking(booking, req.user);
      json(res, 200, { ok: true, booking: M.bookingJson(done), redirect: '/dashboard/player', message: 'Booking ' + req.params.reference + ' cancelled.' });
    } catch (err) {
      if (err instanceof rules.BookingError) return json(res, 422, { ok: false, errors: { __all__: [err.message] } });
      throw err;
    }
  });

  /* bookings:approve / bookings:reject — owner or admin only. */
  const decide = verdict => (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, login: true });
    const booking = store.get('SELECT * FROM bookings WHERE reference = ?', req.params.reference);
    if (!booking) return json(res, 404, { ok: false, error: 'Booking not found.' });
    if (!rules.ownerCanManage(req.user, booking)) {
      return json(res, 403, { ok: false, error: 'You can only decide on requests for your own venues.' });
    }
    const act = verdict === 'approved' ? rules.approveBooking : rules.rejectBooking;
    try {
      const done = act(booking, req.user, String(req.body.note || ''));
      json(res, 200, {
        ok: true,
        booking: M.bookingJson(done),
        redirect: '/dashboard/owner',
        message: req.params.reference + ' ' + (verdict === 'approved' ? 'approved.' : 'rejected.')
      });
    } catch (err) {
      if (err instanceof rules.BookingError) return json(res, 422, { ok: false, errors: { __all__: [err.message] } });
      throw err;
    }
  };
  router.post('/api/bookings/:reference/approve', decide('approved'));
  router.post('/api/bookings/:reference/reject', decide('rejected'));

  /* bookings:receipt — player, venue owner or admin. */
  router.get('/api/bookings/:reference', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, login: true });
    const booking = store.get('SELECT * FROM bookings WHERE reference = ?', req.params.reference);
    if (!booking) return json(res, 404, { ok: false, error: 'Booking not found.' });
    const court = store.get('SELECT * FROM courts WHERE id = ?', booking.court_id);
    const venue = store.get('SELECT * FROM venues WHERE id = ?', court.venue_id);
    const allowed = booking.player_id === req.user.id || venue.owner_id === req.user.id || M.isAdministrator(req.user);
    if (!allowed) return json(res, 403, { ok: false, error: 'Not allowed.' });
    json(res, 200, { ok: true, booking: M.bookingJson(booking, true), venue: M.venueDetail(venue), court });
  });
}

module.exports = { attach };
