/* ============================================================
   SQLite schema — the Django models ported to tables
   accounts.User, venues.{Facility,Venue,Court,VenueImage,OpeningHours},
   bookings.Booking, pages.{Testimonial,ContactMessage,TeamMember}
   ============================================================ */

const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { DB_FILE } = require('./config');

let sqlite;
try {
  sqlite = { DatabaseSync };
} catch (e) {
  sqlite = null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  password TEXT NOT NULL,
  last_login TEXT,
  is_superuser INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  is_staff INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  date_joined TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','owner','admin')),
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Marawi City'
);

CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'check'
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  barangay TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Marawi City',
  province TEXT NOT NULL DEFAULT 'Lanao del Sur',
  latitude TEXT,
  longitude TEXT,
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  setting TEXT NOT NULL DEFAULT 'outdoor' CHECK (setting IN ('indoor','outdoor','both')),
  rate_per_hour REAL,
  opening_time TEXT NOT NULL DEFAULT '06:00',
  closing_time TEXT NOT NULL DEFAULT '22:00',
  cover TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','approved','rejected')),
  is_active INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS venues_status_idx ON venues (status, is_active);

CREATE TABLE IF NOT EXISTS venue_facilities (
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, facility_id)
);

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surface TEXT NOT NULL DEFAULT 'acrylic' CHECK (surface IN ('acrylic','concrete','asphalt','cushioned','clay')),
  is_indoor INTEGER NOT NULL DEFAULT 0,
  hourly_rate REAL,
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS venue_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS opening_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens TEXT NOT NULL DEFAULT '06:00',
  closes TEXT NOT NULL DEFAULT '22:00',
  is_closed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (venue_id, weekday)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  note TEXT NOT NULL DEFAULT '',
  total_amount REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT NOT NULL DEFAULT '',
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS bookings_slot_idx ON bookings (court_id, date, status);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  has_consent INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  is_handled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  contribution TEXT NOT NULL DEFAULT '',
  photo TEXT,
  is_leader INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
`;

let db = null;

function open() {
  if (db) return db;
  if (!sqlite) {
    throw new Error(
      'node:sqlite is unavailable. Run this app on Node 22.13+ or 24+ ' +
      '(older builds need the --experimental-sqlite flag).'
    );
  }
  if (!fs.existsSync(require('./config').UPLOAD_DIR)) {
    fs.mkdirSync(require('./config').UPLOAD_DIR, { recursive: true });
  }
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/* Prepared-statement cache: node:sqlite recompiles on every prepare(). */
const statements = new Map();

function prep(sql) {
  let stmt = statements.get(sql);
  if (!stmt) {
    stmt = open().prepare(sql);
    statements.set(sql, stmt);
  }
  return stmt;
}

const all = (sql, ...args) => prep(sql).all(...args);
const get = (sql, ...args) => prep(sql).get(...args) || null;
const run = (sql, ...args) => prep(sql).run(...args);
const insert = (sql, ...args) => Number(run(sql, ...args).lastInsertRowid);
const scalar = (sql, ...args) => {
  const row = get(sql, ...args);
  return row ? Object.values(row)[0] : null;
};

/* node:sqlite has no transaction helper, so emit the BEGIN/COMMIT pair. */
function tx(fn) {
  const handle = open();
  handle.exec('BEGIN IMMEDIATE');
  try {
    const value = fn();
    handle.exec('COMMIT');
    return value;
  } catch (err) {
    handle.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { open, all, get, run, insert, scalar, tx, DB_FILE };
