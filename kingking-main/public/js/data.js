/* ============================================================
   Shared constants and formatters
   Values here come from Django model choices and view context so
   labels stay identical to the original templates.
   ============================================================ */

const BRAND = { name: 'DinkHub', city: 'Marawi City', province: 'Lanao del Sur' };

/* partials/navbar.html */
const MAIN_LINKS = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/courts', label: 'Browse Courts', key: 'browse' },
  { href: '/how-it-works', label: 'How It Works', key: 'how_it_works' },
  { href: '/about', label: 'About', key: 'about' },
  { href: '/contact', label: 'Contact', key: 'contact' }
];

/* partials/navbar.html mobile drawer — same links plus guide and owner join */
const MOBILE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/courts', label: 'Browse Courts' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/about', label: 'About DinkHub' },
  { href: '/guide', label: 'Pickleball Guide' },
  { href: '/courts/new', label: 'For Venue Owners' },
  { href: '/contact', label: 'Contact' }
];

/* SORT_OPTIONS from venues/views.py, label order preserved */
const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'price_low', label: 'Lowest rate' },
  { value: 'price_high', label: 'Highest rate' }
];

const SETTING_LABELS = { indoor: 'Indoor', outdoor: 'Outdoor', both: 'Indoor & outdoor' };
const SURFACE_LABELS = { acrylic: 'Acrylic', concrete: 'Concrete', asphalt: 'Asphalt', cushioned: 'Cushioned', clay: 'Clay' };
const ROLE_LABELS = { player: 'Player', owner: 'Venue Owner', admin: 'Administrator' };

/* venues.Venue.status_tone / bookings.Booking.status_tone already arrive from the API. */
const BOOKING_STATUS_LABELS = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled'
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* ---------- formatters ---------- */

const nf = new Intl.NumberFormat('en-PH');

function money(value) {
  return '\u20B1' + nf.format(Math.round(Number(value)));
}

/* Venue.rate_display — "₱350/hour" or "Rate on request". */
function rateText(rate) {
  return rate == null || rate === '' ? 'Rate on request' : money(rate) + '/hour';
}

/* Booking.time_label: "10:00 AM - 11:00 AM" */
function ampm(hhmm) {
  const parts = String(hhmm || '00:00').split(':');
  const h24 = Number(parts[0]);
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return h12 + ':' + String(parts[1] || '00').padStart(2, '0') + ' ' + suffix;
}

function timeRange(start, end) {
  return ampm(start) + ' \u2013 ' + ampm(end);
}

function durationLabel(start, end) {
  const mins = (Number(String(end).split(':')[0]) * 60 + Number(String(end).split(':')[1])) -
    (Number(String(start).split(':')[0]) * 60 + Number(String(start).split(':')[1]));
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours && rest) return hours + 'h ' + rest + 'min';
  if (hours) return mins === 60 ? '1 hour' : hours + ' hours';
  return rest + ' min';
}

/* "12 November 2026" — the way the receipt and dashboards print a date. */
function longDate(iso) {
  const d = new Date(String(iso) + 'T12:00:00');
  if (isNaN(d)) return String(iso || '');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(iso) {
  const d = new Date(String(iso) + 'T12:00:00');
  if (isNaN(d)) return String(iso || '');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* {{ booking.date|date:"l, F j, Y" }} — "Friday, November 6, 2026" */
function fullDate(iso) {
  const d = new Date(String(iso) + 'T12:00:00');
  if (isNaN(d)) return String(iso || '');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/* {{ booking.date|date:"D, M j, Y" }} — "Fri, Nov 6, 2026" */
function compactDate(iso) {
  const d = new Date(String(iso) + 'T12:00:00');
  if (isNaN(d)) return String(iso || '');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* {{ value|date:"M j, Y" }} on an ISO date or a stored "YYYY-MM-DD HH:MM:SS" */
function monthDayYear(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return String(value || '');
  return MONTHS[Number(match[2]) - 1] + ' ' + Number(match[3]) + ', ' + match[1];
}

/* {{ booking.decided_at|date:"M j, Y g:i A" }} on the stored "YYYY-MM-DD HH:MM:SS" */
function stampLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2])[T ](\d{2}):(\d{2})/.exec(String(value || ''));
  if (!match) return String(value || '');
  return monthDayYear(value) + ' ' + ampm(match[4] + ':' + match[5]);
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDaysISO(iso, days) {
  const d = new Date(String(iso) + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part.charAt(0).toUpperCase()).join('');
}

window.DATA = {
  BRAND, MAIN_LINKS, MOBILE_LINKS, SORT_OPTIONS, SETTING_LABELS, SURFACE_LABELS,
  ROLE_LABELS, BOOKING_STATUS_LABELS, WEEKDAYS, nf, money, rateText, ampm, timeRange,
  durationLabel, longDate, shortDate, fullDate, compactDate, monthDayYear, stampLabel,
  todayISO, addDaysISO, initials
};
