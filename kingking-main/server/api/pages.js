/* ============================================================
   /api/pages — pages/views.py (home context, about, developers,
   contact) including the FAQ copy that lived in views.py
   ============================================================ */

const store = require('../db');
const clock = require('../clock');
const M = require('../models');
const { json } = require('../http-kit');
const { BOOKING_MAX_ADVANCE_DAYS } = require('../config');

/* pages/views.py FAQS — order and wording preserved. */
const FAQS = [
  {
    q: 'How does a booking work on DinkHub?',
    a: 'Pick a court, choose a date and time, and send a request. The venue owner reviews it and either approves or rejects it. Only an approved request counts as a confirmed reservation.'
  },
  {
    q: 'Do I pay online?',
    a: 'No. DinkHub does not process payments yet. You settle the court fee directly with the venue owner when you play. Any rate shown on a listing is entered by that owner.'
  },
  {
    q: 'Can I book the same court for back-to-back hours?',
    a: 'Yes. Adjacent slots such as 10:00-11:00 and 11:00-12:00 are allowed. DinkHub only blocks requests that actually overlap an approved reservation on the same court.'
  },
  {
    q: 'How do I cancel a request?',
    a: 'Open your player dashboard and cancel the booking while it is still pending or approved. Past bookings can no longer be cancelled.'
  },
  {
    q: 'How does a venue get listed?',
    a: 'A venue owner submits the details, courts, rates, and photos. An administrator reviews the submission before it becomes visible in Browse Courts. Unreviewed listings are never shown as verified.'
  },
  {
    q: 'What if my venue is outside Marawi City?',
    a: 'DinkHub starts in Marawi City, Lanao del Sur, but locations are stored per venue. New cities appear in the Browse Courts filter as soon as an approved venue exists there.'
  },
  {
    q: 'Who can see my booking history?',
    a: 'Only you. Venue owners see requests for their own venues, and administrators can review records for moderation.'
  }
];

const PUBLIC = "status = 'approved' AND is_active = 1";

function attach(router) {
  router.get('/api/home', (req, res) => {
    const featured = store.all('SELECT * FROM venues WHERE ' + PUBLIC + ' ORDER BY is_demo, created_at DESC LIMIT 3');

    const locations = store.all('SELECT city, province, COUNT(*) AS total FROM venues WHERE ' + PUBLIC +
      ' GROUP BY city, province ORDER BY total DESC, city LIMIT 6');

    const stats = [
      { value: store.scalar('SELECT COUNT(*) FROM venues WHERE ' + PUBLIC), label: 'Approved venues', icon: 'pin' },
      { value: store.scalar('SELECT COUNT(*) FROM courts WHERE is_active = 1 AND venue_id IN (SELECT id FROM venues WHERE ' + PUBLIC + ')'), label: 'Bookable courts', icon: 'paddle' },
      { value: store.scalar("SELECT COUNT(*) FROM bookings WHERE status = 'approved'"), label: 'Confirmed bookings', icon: 'calendar' },
      { value: store.scalar("SELECT COUNT(*) FROM users WHERE role = 'player' AND is_active = 1"), label: 'Registered players', icon: 'users' }
    ].filter(s => s.value);

    const today = clock.today();
    json(res, 200, {
      ok: true,
      featured_venues: featured.map(M.publicVenueRow),
      locations,
      stats,
      testimonials: store.all('SELECT * FROM testimonials WHERE is_published = 1 AND has_consent = 1 LIMIT 3'),
      faqs: FAQS,
      today,
      max_date: clock.addDays(today, BOOKING_MAX_ADVANCE_DAYS),
      facilities: store.all('SELECT * FROM facilities ORDER BY id LIMIT 8')
    });
  });

  router.get('/api/about', (req, res) => {
    json(res, 200, {
      ok: true,
      venue_total: store.scalar('SELECT COUNT(*) FROM venues WHERE ' + PUBLIC),
      court_total: store.scalar("SELECT COUNT(*) FROM courts WHERE is_active = 1 AND venue_id IN (SELECT id FROM venues WHERE status = 'approved')")
    });
  });

  router.get('/api/team', (req, res) => {
    json(res, 200, { ok: true, team: store.all('SELECT * FROM team_members ORDER BY is_leader DESC, sort_order') });
  });

  /* pages:contact — ContactForm saves then redirects back to itself with a message. */
  router.post('/api/contact', (req, res) => {
    const errors = {};
    if (!String(req.body.name || '').trim()) errors.name = ['This field is required.'];
    if (!String(req.body.email || '').trim()) errors.email = ['This field is required.'];
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(req.body.email).trim())) errors.email = ['Enter a valid email address.'];
    if (!String(req.body.message || '').trim()) errors.message = ['This field is required.'];
    if (Object.keys(errors).length) return json(res, 422, { ok: false, errors });

    store.insert('INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES (?,?,?,?,?)',
      String(req.body.name).trim(), String(req.body.email).trim(), String(req.body.subject || '').trim(),
      String(req.body.message).trim(), clock.stamp());
    json(res, 200, { ok: true, message: 'Message sent. The DinkHub team will get back to you.' });
  });
}

module.exports = { attach, FAQS };
