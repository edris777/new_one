/* ============================================================
   Manila clock helpers
   Django renders this app on TIME_ZONE = "Asia/Manila", so every
   "today" comparison must use that zone rather than the host clock.
   ============================================================ */

const { TIME_ZONE } = require('./config');

const DAY_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});
const TIME_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false
});
const WEEKday_PARTS = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' });

const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/* "YYYY-MM-DD" in Manila — the same string form Django's DateField uses. */
function today(at) {
  return DAY_PARTS.format(at || new Date());
}

/* "HH:MM" in Manila. */
function nowTime(at) {
  return TIME_PARTS.format(at || new Date());
}

/* Python's date.weekday(): Monday is 0, Sunday is 6. */
function weekdayOf(dateStr) {
  const probe = new Date(dateStr + 'T12:00:00Z');
  const name = WEEKday_PARTS.formatToParts(probe).find(p => p.type === 'weekday').value;
  return WEEKDAY_INDEX[name];
}

/* Minutes since midnight for a "HH:MM" string — makes range maths cheap. */
function toMinutes(hhmm) {
  const parts = String(hhmm || '00:00').split(':');
  return Number(parts[0]) * 60 + Number(parts[1] || 0);
}

function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function addDays(dateStr, days) {
  const base = new Date(dateStr + 'T12:00:00Z');
  base.setUTCDate(base.getUTCDate() + days);
  return DAY_PARTS.format(base);
}

/* "10:00 AM" the way Django's "%I:%M %p".lstrip("0") renders it. */
function ampm(hhmm) {
  const minutes = toMinutes(hhmm);
  const h24 = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return h12 + ':' + m + ' ' + suffix;
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { today, nowTime, weekdayOf, toMinutes, fromMinutes, addDays, ampm, stamp, TIME_ZONE };
