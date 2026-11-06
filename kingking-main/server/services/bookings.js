/* ============================================================
   Booking rules — port of bookings/services.py

   The overlap rule is evaluated on the server twice:
     1. when a player submits a request, and
     2. again inside a transaction when an owner approves it.

   Conflict condition:
       existing.start_time < requested_end AND existing.end_time > requested_start
   Adjacent slots (10:00-11:00 and 11:00-12:00) do not conflict.
   ============================================================ */

const store = require('../db');
const clock = require('../clock');
const rules = require('../config');
const M = require('../models');

/* ValidationError equivalent: the message becomes the field-less API error. */
class BookingError extends Error {}
class BookingConflict extends BookingError {}

const ACTIVE = "('pending','approved')";

function overlappingApproved(courtId, date, start, end, excludeId) {
  return store.get(
    "SELECT * FROM bookings WHERE court_id = ? AND date = ? AND status = 'approved' " +
    'AND start_time < ? AND end_time > ? AND id <> ? LIMIT 1',
    courtId, date, end, start, excludeId || 0);
}

function bookedIntervals(courtId, date) {
  return store.all(
    'SELECT start_time, end_time, status FROM bookings ' +
    `WHERE court_id = ? AND date = ? AND status IN ${ACTIVE} ORDER BY start_time`,
    courtId, date).map(b => ({ start: b.start_time, end: b.end_time, status: b.status }));
}

/* Full server-side validation before a Pending record is created. */
function validateRequest(player, court, date, start, end) {
  if (!court) throw new BookingError('Select a court to book.');
  const venue = store.get('SELECT * FROM venues WHERE id = ?', court.venue_id);

  if (!court.is_active) throw new BookingError('This court is not accepting bookings right now.');
  if (!venue || venue.status !== 'approved' || !venue.is_active) {
    throw new BookingError('This venue is not available for public booking.');
  }
  if (player.role === 'owner' && venue.owner_id === player.id) {
    throw new BookingError('You cannot book a court in your own venue.');
  }
  if (M.isAdministrator(player)) {
    throw new BookingError('Administrator accounts cannot create player bookings.');
  }

  const today = clock.today();
  if (date < today) throw new BookingError('Choose today or a future date.');
  if (date > clock.addDays(today, rules.BOOKING_MAX_ADVANCE_DAYS)) {
    throw new BookingError('Bookings can be requested up to ' + rules.BOOKING_MAX_ADVANCE_DAYS + ' days ahead.');
  }

  if (end <= start) throw new BookingError('The end time must be later than the start time.');

  const mins = clock.toMinutes(end) - clock.toMinutes(start);
  if (mins < 30) throw new BookingError('Book at least 30 minutes of court time.');
  if (mins > 360) throw new BookingError('A single request cannot exceed 6 hours. Split longer sessions.');

  const hours = M.hoursFor(venue, clock.weekdayOf(date));
  if (hours.closed) throw new BookingError('The venue is closed on this day.');
  if (start < hours.opens || end > hours.closes) {
    throw new BookingError('This venue accepts play between ' + clock.ampm(hours.opens) +
      ' and ' + clock.ampm(hours.closes) + '.');
  }

  const today2 = clock.today();
  if (date === today2) {
    const earliest = clock.toMinutes(start) - rules.BOOKING_MIN_NOTICE_HOURS * 60;
    if (earliest <= clock.toMinutes(clock.nowTime())) {
      throw new BookingError('That start time has already passed. Choose a later slot.');
    }
  }

  const conflict = overlappingApproved(court.id, date, start, end);
  if (conflict) {
    throw new BookingError(court.name + ' is already reserved from ' + M.timeLabel(conflict) + ' on this date.');
  }
  return true;
}

/* Booking.calculate_total — effective court rate x hours, or null when unpriced. */
function calculateTotal(court, date, start, end) {
  const venue = store.get('SELECT * FROM venues WHERE id = ?', court.venue_id);
  const rate = M.courtEffectiveRate(court, venue);
  if (rate == null) return null;
  const hours = (clock.toMinutes(end) - clock.toMinutes(start)) / 60;
  return Math.round(rate * hours * 100) / 100;
}

function newReference() {
  for (;;) {
    const ref = 'DH-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!store.get('SELECT id FROM bookings WHERE reference = ?', ref)) return ref;
  }
}

function createBooking(player, court, date, start, end, note) {
  return store.tx(() => {
    validateRequest(player, court, date, start, end);
    const now = clock.stamp();
    const id = store.insert(
      'INSERT INTO bookings (reference, player_id, court_id, date, start_time, end_time, status, ' +
      'note, total_amount, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      newReference(), player.id, court.id, date, start, end, 'pending', note || '',
      calculateTotal(court, date, start, end), now, now);
    return store.get('SELECT * FROM bookings WHERE id = ?', id);
  });
}

function ownerCanManage(user, booking) {
  const court = store.get('SELECT * FROM courts WHERE id = ?', booking.court_id);
  const venue = court && store.get('SELECT * FROM venues WHERE id = ?', court.venue_id);
  return !!user && (M.isAdministrator(user) || (venue && venue.owner_id === user.id));
}

/* Re-check availability inside the transaction to avoid double approval. */
function approveBooking(booking, byUser, note) {
  return store.tx(() => {
    if (!ownerCanManage(byUser, booking)) {
      throw new BookingError('You can only decide on requests for your own venues.');
    }
    if (booking.status !== 'pending') throw new BookingError('Only pending requests can be approved.');

    const court = store.get('SELECT * FROM courts WHERE id = ?', booking.court_id);
    const conflict = overlappingApproved(court.id, booking.date, booking.start_time, booking.end_time, booking.id);
    if (conflict) {
      throw new BookingConflict(court.name + ' is already approved for ' + M.timeLabel(conflict) +
        ' on ' + booking.date + '. Reject this request or ask the player to rebook.');
    }

    store.run('UPDATE bookings SET status = ?, decided_at = ?, decided_by = ?, decision_note = ?, ' +
      'total_amount = ?, updated_at = ? WHERE id = ?',
      'approved', clock.stamp(), byUser.id, note || '', calculateTotal(court, booking.date, booking.start_time, booking.end_time),
      clock.stamp(), booking.id);
    return store.get('SELECT * FROM bookings WHERE id = ?', booking.id);
  });
}

function rejectBooking(booking, byUser, note) {
  return store.tx(() => {
    if (!ownerCanManage(byUser, booking)) {
      throw new BookingError('You can only decide on requests for your own venues.');
    }
    if (booking.status !== 'pending') throw new BookingError('Only pending requests can be rejected.');
    store.run('UPDATE bookings SET status = ?, decided_at = ?, decided_by = ?, decision_note = ?, updated_at = ? WHERE id = ?',
      'rejected', clock.stamp(), byUser.id, note || '', clock.stamp(), booking.id);
    return store.get('SELECT * FROM bookings WHERE id = ?', booking.id);
  });
}

function cancelBooking(booking, byUser) {
  if (booking.player_id !== byUser.id && !M.isAdministrator(byUser)) {
    throw new BookingError('You can only cancel your own bookings.');
  }
  if (booking.status !== 'pending' && booking.status !== 'approved') {
    throw new BookingError('This booking can no longer be cancelled.');
  }
  if (booking.date < clock.today()) throw new BookingError('Past bookings cannot be cancelled.');
  store.run('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?', 'cancelled', clock.stamp(), booking.id);
  return store.get('SELECT * FROM bookings WHERE id = ?', booking.id);
}

/* venues/forms.py slot list: 30-minute steps, opening time up to closing time. */
function slotChoices(venue, date) {
  const hours = M.hoursFor(venue, clock.weekdayOf(date));
  if (hours.closed) return { closed: true, opens: hours.opens, closes: hours.closes, slots: [] };
  const slots = [];
  for (let m = clock.toMinutes(hours.opens); m < clock.toMinutes(hours.closes); m += 30) {
    const value = clock.fromMinutes(m);
    slots.push({ value, label: clock.ampm(value) });
  }
  return { closed: false, opens: hours.opens, closes: hours.closes, slots };
}

module.exports = {
  BookingError, BookingConflict,
  overlappingApproved, bookedIntervals, validateRequest, calculateTotal,
  createBooking, ownerCanManage, approveBooking, rejectBooking, cancelBooking, slotChoices
};
