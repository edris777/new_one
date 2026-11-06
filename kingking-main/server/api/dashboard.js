/* ============================================================
   /api/dashboard — dashboard/views.py (player, owner, admin, users)
   ============================================================ */

const store = require('../db');
const clock = require('../clock');
const M = require('../models');
const { json } = require('../http-kit');

/* role_required(): administrators may open any dashboard, everyone else is bounced. */
function allowed(user, role) {
  return !!user && (M.isAdministrator(user) || user.role === role);
}

function denied(res, user) {
  if (!user) return json(res, 401, { ok: false, login: true });
  return json(res, 200, {
    ok: false,
    redirect: user ? M.dashboardUrl(user) : '/',
    error: 'That dashboard is not available for your account type.'
  });
}

function attach(router) {
  router.get('/api/dashboard/redirect', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, login: true });
    json(res, 200, { ok: true, redirect: M.dashboardUrl(req.user) });
  });

  router.get('/api/dashboard/player', (req, res) => {
    if (!allowed(req.user, 'player')) return denied(res, req.user);
    const today = clock.today();
    const rows = store.all("SELECT * FROM bookings WHERE player_id = ? ORDER BY date DESC, start_time DESC", req.user.id);
    const upcoming = rows.filter(b => b.date >= today && b.status !== 'cancelled');
    const history = rows.filter(b => b.date < today || b.status === 'cancelled');
    json(res, 200, {
      ok: true,
      upcoming: upcoming.map(b => M.bookingJson(b)),
      history: history.map(b => M.bookingJson(b)),
      counts: {
        pending: rows.filter(b => b.status === 'pending').length,
        approved: rows.filter(b => b.status === 'approved' && b.date >= today).length,
        total: rows.length
      }
    });
  });

  router.get('/api/dashboard/owner', (req, res) => {
    if (!allowed(req.user, 'owner')) return denied(res, req.user);
    const venues = store.all('SELECT * FROM venues WHERE owner_id = ? ORDER BY created_at DESC', req.user.id);
    const ids = venues.map(v => v.id);
    const today = clock.today();
    const holders = ids.length ? ids : [-1];
    const where = 'court_id IN (SELECT id FROM courts WHERE venue_id IN (' + holders.map(() => '?').join(',') + '))';

    const requests = store.all(
      'SELECT * FROM bookings WHERE ' + where + " AND status = 'pending' ORDER BY date, start_time", ...holders);
    const approvedUpcoming = store.all(
      'SELECT * FROM bookings WHERE ' + where + " AND status = 'approved' AND date >= ? ORDER BY date, start_time",
      ...holders, today);
    const approvedAll = store.all('SELECT * FROM bookings WHERE ' + where + " AND status = 'approved'", ...holders);
    const revenue = approvedUpcoming.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    json(res, 200, {
      ok: true,
      venues: venues.map(v => Object.assign(M.venueDetail(v), {
        court_count: store.scalar('SELECT COUNT(*) FROM courts WHERE venue_id = ? AND is_active = 1', v.id),
        is_active: !!v.is_active
      })),
      requests: requests.map(b => M.bookingJson(b)),
      schedule: approvedUpcoming.slice(0, 12).map(b => M.bookingJson(b)),
      counts: {
        court_total: store.scalar(
          'SELECT COUNT(*) FROM courts WHERE venue_id IN (' + holders.map(() => '?').join(',') + ') AND is_active = 1',
          ...holders),
        approved_count: approvedAll.length,
        pending_count: requests.length
      },
      revenue: revenue
    });
  });

  router.get('/api/dashboard/admin', (req, res) => {
    if (!allowed(req.user, 'admin')) return denied(res, req.user);
    const pendingVenues = store.all("SELECT * FROM venues WHERE status = 'pending' ORDER BY created_at");
    const venueStats = store.all('SELECT status, COUNT(*) AS total FROM venues GROUP BY status');
    json(res, 200, {
      ok: true,
      pending_venues: pendingVenues.map(v => M.venueDetail(v)),
      all_venues: store.all('SELECT * FROM venues ORDER BY created_at DESC LIMIT 12').map(v => M.venueDetail(v)),
      recent_bookings: store.all('SELECT * FROM bookings ORDER BY id DESC LIMIT 10').map(b => M.bookingJson(b)),
      stats: {
        pending: pendingVenues.length,
        venues: store.scalar('SELECT COUNT(*) FROM venues'),
        approved: store.scalar("SELECT COUNT(*) FROM venues WHERE status = 'approved'"),
        players: store.scalar("SELECT COUNT(*) FROM users WHERE role = 'player'"),
        owners: store.scalar("SELECT COUNT(*) FROM users WHERE role = 'owner'"),
        bookings: store.scalar('SELECT COUNT(*) FROM bookings'),
        approved_bookings: store.scalar("SELECT COUNT(*) FROM bookings WHERE status = 'approved'")
      },
      venue_stats: venueStats
    });
  });

  /* dashboard:users — the accounts table, venues and bookings per person */
  router.get('/api/dashboard/users', (req, res) => {
    if (!allowed(req.user, 'admin')) return denied(res, req.user);
    const rows = store.all('SELECT * FROM users ORDER BY date_joined DESC LIMIT 100');
    json(res, 200, {
      ok: true,
      users: rows.map(u => Object.assign(M.userJson(u), {
        venue_total: store.scalar('SELECT COUNT(*) FROM venues WHERE owner_id = ?', u.id),
        booking_total: store.scalar('SELECT COUNT(*) FROM bookings WHERE player_id = ?', u.id)
      }))
    });
  });

  /* dashboard:review_venue — approve | reject | pause | resume */
  router.post('/api/dashboard/admin/venues/:slug/review', (req, res) => {
    if (!allowed(req.user, 'admin')) return denied(res, req.user);
    const venue = store.get('SELECT * FROM venues WHERE slug = ?', req.params.slug);
    if (!venue) return json(res, 404, { ok: false, error: 'Venue not found.' });

    const action = req.body.action;
    const note = String(req.body.note || '').trim();
    let status = venue.status;
    let isActive = venue.is_active;
    let reviewNote = venue.review_note;
    let message = '';
    /* Django's message levels decide the toast dot colour. */
    let level = 'success';

    if (action === 'approve') {
      status = 'approved'; isActive = 1; reviewNote = note;
      message = venue.name + ' approved and published.';
    } else if (action === 'reject') {
      status = 'rejected'; reviewNote = note || 'The submission did not pass review.';
      message = venue.name + ' rejected. The owner can edit and resubmit.';
      level = 'warning';
    } else if (action === 'pause') {
      isActive = 0; message = venue.name + ' paused.'; level = 'info';
    } else if (action === 'resume') {
      isActive = 1; message = venue.name + ' resumed.'; level = 'info';
    } else {
      return json(res, 422, { ok: false, error: 'Unknown action.' });
    }

    store.run('UPDATE venues SET status = ?, is_active = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?',
      status, isActive, reviewNote, req.user.id, clock.stamp(), clock.stamp(), venue.id);
    json(res, 200, { ok: true, message, level, venue: M.venueDetail(store.get('SELECT * FROM venues WHERE id = ?', venue.id)) });
  });
}

module.exports = { attach };
