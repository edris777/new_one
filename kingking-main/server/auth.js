/* ============================================================
   Sessions and password hashing (no dependencies)
   Replaces Django's cookie-unsigned session + ModelBackend.
   ============================================================ */

const crypto = require('crypto');
const store = require('./db');
const clock = require('./clock');
const cfg = require('./config');

const COOKIE = 'dinkhub_session';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}

function checkPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const want = Buffer.from(parts[2], 'hex');
  const got = crypto.scryptSync(String(password), salt, 64);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + cfg.SESSION_TTL_DAYS * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  store.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)', token, userId, expires);
  store.run('DELETE FROM sessions WHERE expires_at < ?', clock.stamp());
  return token;
}

function readSession(req) {
  const raw = String(req.headers.cookie || '');
  const hit = raw.split(/;\s*/).find(pair => pair.indexOf(COOKIE + '=') === 0);
  if (!hit) return null;
  const token = hit.slice(COOKIE.length + 1);
  const row = store.get(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id ' +
    'WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1', token, clock.stamp());
  return row || null;
}

function setCookie(res, token) {
  const attrs = [COOKIE + '=' + token, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + cfg.SESSION_TTL_DAYS * 86400];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', [COOKIE + '=deleted', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'].join('; '));
}

function destroySession(req) {
  const raw = String(req.headers.cookie || '');
  const hit = raw.split(/;\s*/).find(pair => pair.indexOf(COOKIE + '=') === 0);
  if (hit) store.run('DELETE FROM sessions WHERE token = ?', hit.slice(COOKIE.length + 1));
}

/* Django's login() + the session cookie in one call. */
function createSessionAndCookie(req, res, user) {
  const row = store.get('SELECT * FROM users WHERE id = ?', user.id);
  store.run('UPDATE users SET last_login = ? WHERE id = ?', clock.stamp(), user.id);
  req.user = row;
  setCookie(res, createSession(user.id));
}

module.exports = {
  COOKIE, hashPassword, checkPassword, createSession, readSession,
  setCookie, clearCookie, destroySession, createSessionAndCookie
};
