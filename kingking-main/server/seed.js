/* ============================================================
   Demo data — port of pages/management/commands/seed_demo.py

   The v1.2 specification forbids inventing real venues, rates, or
   reviews. Every venue here is flagged is_demo and badged
   "Sample listing" in the UI, exactly like the Django seed.
   ============================================================ */

const store = require('./db');
const clock = require('./clock');
const auth = require('./auth');
const M = require('./models');
const bookingRules = require('./services/bookings');

const PASSWORD = 'DinkHub2026!';

const FACILITIES = [
  ['Restrooms', 'shower'], ['Parking', 'parking'], ['Night lights', 'light'],
  ['Drinking water', 'water'], ['Free Wi-Fi', 'wifi'], ['Covered court', 'shield']
];

const VENUES = [
  {
    name: 'Lakeview Demo Courts',
    tagline: 'Two outdoor courts with sunset views over the lake',
    description: 'A sample two-court outdoor facility used to demonstrate DinkHub. Replace this record with a real venue submission before launch. Acrylic surface, lights until closing, and parking beside the gate.',
    address: 'Sample address, Barangay Poblacion',
    barangay: 'Poblacion',
    setting: 'outdoor',
    rate: 350,
    courts: [['Court 1', 'acrylic', 0], ['Court 2', 'acrylic', 0]],
    facilities: ['Parking', 'Night lights', 'Drinking water'],
    cover: 'hero-court.jpg'
  },
  {
    name: 'DinkHub Demo Arena',
    tagline: 'Indoor courts for all-weather play',
    description: 'A sample indoor facility with cushioned flooring and three courts. Demonstration data only - not an operating business.',
    address: 'Sample address, Barangay Bubong',
    barangay: 'Bubong',
    setting: 'indoor',
    rate: 500,
    courts: [['Court A', 'cushioned', 1], ['Court B', 'cushioned', 1], ['Court C', 'cushioned', 1]],
    facilities: ['Restrooms', 'Parking', 'Drinking water', 'Free Wi-Fi'],
    cover: 'court-indoor.jpg'
  },
  {
    name: 'Riverside Demo Pickleball',
    tagline: 'Community courts beside the river',
    description: 'Sample listing for a neighbourhood court with a concrete surface. Used to demonstrate filters, court lists, and booking requests.',
    address: 'Sample address, Barangay Sabala',
    barangay: 'Sabala',
    setting: 'outdoor',
    rate: 250,
    courts: [['Main court', 'concrete', 0]],
    facilities: ['Parking', 'Drinking water'],
    cover: 'court-outdoor.jpg'
  },
  {
    name: 'Rooftop Demo Club',
    tagline: 'Covered rooftop courts with evening lights',
    description: 'Sample covered rooftop venue for demonstration. Two courts, lights, and a small waiting area. Not a real business.',
    address: 'Sample address, Barangay Marina',
    barangay: 'Marina',
    setting: 'both',
    rate: 450,
    courts: [['Rooftop 1', 'acrylic', 0], ['Rooftop 2', 'acrylic', 0]],
    facilities: ['Restrooms', 'Night lights', 'Covered court', 'Parking'],
    cover: 'court-rooftop.jpg'
  }
];

function ensureUser(spec) {
  const existing = store.get('SELECT * FROM users WHERE username = ?', spec.username);
  if (existing) return existing;
  const id = store.insert(
    'INSERT INTO users (password, username, first_name, last_name, email, phone, city, role, ' +
    'is_staff, is_superuser, is_active, date_joined) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    auth.hashPassword(PASSWORD), spec.username, spec.first_name, spec.last_name, spec.email,
    spec.phone || '', 'Marawi City', spec.role, spec.is_staff ? 1 : 0, spec.is_superuser ? 1 : 0, 1, clock.stamp());
  return store.get('SELECT * FROM users WHERE id = ?', id);
}

function reset() {
  store.run("DELETE FROM bookings WHERE note LIKE '[demo]%'");
  store.run('DELETE FROM venues WHERE is_demo = 1');
  store.run('DELETE FROM testimonials WHERE is_demo = 1');
}

function run(options) {
  const settings = options || {};
  if (settings.reset) reset();

  store.open();
  for (const [name, icon] of FACILITIES) {
    if (!store.get('SELECT id FROM facilities WHERE name = ?', name)) {
      store.insert('INSERT INTO facilities (name, slug, icon) VALUES (?,?,?)', name, M.slugify(name), icon);
    }
  }

  const admin = ensureUser({
    username: 'dinkadmin', email: 'admin@dinkhub.local', first_name: 'DinkHub', last_name: 'Admin',
    role: 'admin', is_staff: true, is_superuser: true
  });
  const owner = ensureUser({
    username: 'owner_demo', email: 'owner@dinkhub.local', first_name: 'Amina', last_name: 'Macapaar',
    role: 'owner', phone: '+63 900 000 0000'
  });
  const player = ensureUser({
    username: 'player_demo', email: 'player@dinkhub.local', first_name: 'Jamil', last_name: 'Sultan',
    role: 'player', phone: '+63 900 000 0001'
  });

  const today = clock.today();
  const made = [];

  for (const spec of VENUES) {
    const existing = store.get('SELECT * FROM venues WHERE name = ?', spec.name);
    if (existing) { made.push(existing); continue; }

    const id = store.insert(
      'INSERT INTO venues (owner_id, name, slug, tagline, description, address, barangay, city, province, ' +
      'contact_phone, setting, rate_per_hour, opening_time, closing_time, cover, status, is_active, is_demo, ' +
      'reviewed_by, reviewed_at, created_at, updated_at) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      owner.id, spec.name, M.uniqueSlug(spec.name), spec.tagline, spec.description, spec.address,
      spec.barangay, 'Marawi City', 'Lanao del Sur', '+63 900 000 0000', spec.setting, spec.rate,
      '06:00', '22:00', '/img/' + spec.cover, 'approved', 1, 1, admin.id, clock.stamp(), clock.stamp(), clock.stamp());

    const venue = store.get('SELECT * FROM venues WHERE id = ?', id);
    for (const facilityName of spec.facilities) {
      const facility = store.get('SELECT id FROM facilities WHERE name = ?', facilityName);
      if (facility) store.run('INSERT OR IGNORE INTO venue_facilities (venue_id, facility_id) VALUES (?,?)', id, facility.id);
    }
    for (const [courtName, surface, indoor] of spec.courts) {
      store.insert('INSERT INTO courts (venue_id, name, surface, is_indoor, is_active, created_at) VALUES (?,?,?,?,?,?)',
        id, courtName, surface, indoor, 1, clock.stamp());
    }
    made.push(venue);
  }

  /* a couple of bookings so the dashboards are not empty */
  if (made.length && settings.bookings !== false) {
    seedBooking(player, made[0], clock.addDays(today, 2), '18:00', '19:00', 'pending', '[demo] Sample request', owner);
    if (made.length > 1) {
      seedBooking(player, made[1], clock.addDays(today, 3), '09:00', '10:30', 'approved', '[demo] Sample confirmed game', owner);
    }
  }

  const courtCount = store.scalar("SELECT COUNT(*) FROM courts WHERE venue_id IN (SELECT id FROM venues WHERE is_demo = 1)");
  return { venues: made.length, courts: courtCount, accounts: ['dinkadmin', 'owner_demo', 'player_demo'], password: PASSWORD };
}

function seedBooking(player, venue, date, start, end, status, note, owner) {
  const court = store.get('SELECT * FROM courts WHERE venue_id = ? ORDER BY id LIMIT 1', venue.id);
  if (!court) return;
  const clash = store.get('SELECT id FROM bookings WHERE player_id = ? AND court_id = ? AND date = ? AND start_time = ?',
    player.id, court.id, date, start);
  if (clash) return;
  const now = clock.stamp();
  const total = bookingRules.calculateTotal(court, date, start, end);
  store.insert(
    'INSERT INTO bookings (reference, player_id, court_id, date, start_time, end_time, status, note, ' +
    'total_amount, created_at, updated_at, decided_at, decided_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    'DH-' + Math.random().toString(36).slice(2, 8).toUpperCase(), player.id, court.id, date, start, end,
    status, note, status === 'approved' ? total : null, now, now,
    status === 'approved' ? now : null, status === 'approved' ? owner.id : null);
}

module.exports = { run, reset, PASSWORD, FACILITIES, VENUES };

if (require.main === module) {
  const out = run({ reset: process.argv.includes('--reset') });
  process.stdout.write('Demo data ready: ' + out.venues + ' venues, ' + out.courts + ' courts.\n' +
    'Accounts: ' + out.accounts.join(' / ') + ' - password ' + out.password + '\n');
}
