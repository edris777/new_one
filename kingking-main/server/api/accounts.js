/* ============================================================
   /api/accounts — accounts/views.py + accounts/forms.py
   ============================================================ */

const store = require('../db');
const auth = require('../auth');
const clock = require('../clock');
const M = require('../models');
const { json } = require('../http-kit');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* RegisterForm field validation, ported from accounts/forms.py. */
function validateRegister(body) {
  const errors = {};
  const first = String(body.first_name || '').trim();
  const last = String(body.last_name || '').trim();
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim();
  const p1 = String(body.password1 || '');
  const p2 = String(body.password2 || '');

  if (!first) errors.first_name = ['This field is required.'];
  if (!last) errors.last_name = ['This field is required.'];
  if (!username) errors.username = ['This field is required.'];
  if (username && /^\d/.test(username)) errors.username = ['Username must start with a letter.'];
  if (username && store.get('SELECT id FROM users WHERE username = ?', username)) {
    errors.username = ['A user with that username already exists.'];
  }
  if (!email) errors.email = ['This field is required.'];
  else if (!EMAIL_RE.test(email)) errors.email = ['Enter a valid email address.'];
  if (email && store.get('SELECT id FROM users WHERE email = ?', email)) {
    errors.email = ['A user is already registered with this email address.'];
  }
  if (p1.length < 8) errors.password1 = ['This password is too short. It must contain at least 8 characters.'];
  if (username && p1 && p1.toLowerCase().includes(username.toLowerCase())) {
    errors.password1 = ['The password is too similar to the username.'];
  }
  if (p1 !== p2) errors.password2 = ['The two password fields did not match.'];
  if (!['player', 'owner'].includes(body.role)) errors.role = ['Choose a valid option.'];
  return errors;
}

function attach(router) {
  router.get('/api/who', (req, res) => {
    json(res, 200, { ok: true, user: req.user ? M.userJson(req.user) : null });
  });

  /* Pickleball's house venues arrive without an owner record, but DinkHub
     still needs one account that can answer their booking requests. */
  router.get('/api/house-owner', (req, res) => {
    const owner = store.get(
      "SELECT * FROM users WHERE role = 'owner' AND is_active = 1 " +
      "ORDER BY (username = 'owner_demo') DESC, id LIMIT 1");
    json(res, 200, { ok: true, owner: owner ? M.userJson(owner) : null });
  });

  /* DinkHubLoginView: success goes to `next`, otherwise the role dashboard.
     The sign-in screen asks for an email, so either identifier is accepted. */
  router.post('/api/login', (req, res) => {
    const identifier = String(req.body.username || req.body.email || '').trim();
    const user = store.get(
      "SELECT * FROM users WHERE username = ? OR (email <> '' AND LOWER(email) = LOWER(?))",
      identifier, identifier);
    if (!user || !auth.checkPassword(req.body.password, user.password) || !user.is_active) {
      return json(res, 401, {
        ok: false,
        errors: { __all__: ['Your email or username and password do not match. Please try again.'] }
      });
    }
    auth.createSessionAndCookie(req, res, user);
    json(res, 200, {
      ok: true,
      user: M.userJson(user),
      message: 'Welcome back, ' + M.displayName(user) + '.',
      redirect: req.body.next || M.dashboardUrl(user)
    });
  });

  router.post('/api/logout', (req, res) => {
    auth.destroySession(req);
    auth.clearCookie(res);
    json(res, 200, { ok: true, redirect: '/' });
  });

  router.post('/api/register', (req, res) => {
    const errors = validateRegister(req.body);
    if (Object.keys(errors).length) return json(res, 422, { ok: false, errors });

    const id = store.insert(
      'INSERT INTO users (password, username, first_name, last_name, email, phone, city, role, date_joined) ' +
      'VALUES (?,?,?,?,?,?,?,?,?)',
      auth.hashPassword(req.body.password1), String(req.body.username).trim(), String(req.body.first_name).trim(),
      String(req.body.last_name).trim(), String(req.body.email || '').trim(), String(req.body.phone || '').trim(),
      String(req.body.city || 'Marawi City'), req.body.role, clock.stamp());
    const user = store.get('SELECT * FROM users WHERE id = ?', id);
    auth.createSessionAndCookie(req, res, user);
    json(res, 200, {
      ok: true,
      user: M.userJson(user),
      message: 'Your DinkHub account is ready.',
      redirect: req.body.next || M.dashboardUrl(user)
    });
  });

  /* ProfileForm — role is never editable from the profile page. */
  router.get('/api/profile', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    json(res, 200, { ok: true, user: M.userJson(req.user) });
  });

  router.post('/api/profile', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    const errors = {};
    if (!String(req.body.first_name || '').trim()) errors.first_name = ['This field is required.'];
    if (!String(req.body.last_name || '').trim()) errors.last_name = ['This field is required.'];
    const email = String(req.body.email || '').trim();
    if (email && !EMAIL_RE.test(email)) errors.email = ['Enter a valid email address.'];
    if (Object.keys(errors).length) return json(res, 422, { ok: false, errors });

    store.run('UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, city = ? WHERE id = ?',
      String(req.body.first_name).trim(), String(req.body.last_name).trim(), email,
      String(req.body.phone || '').trim(), String(req.body.city || '').trim(), req.user.id);
    const fresh = store.get('SELECT * FROM users WHERE id = ?', req.user.id);
    Object.assign(req.user, fresh);
    json(res, 200, { ok: true, user: M.userJson(fresh), message: 'Profile updated.', redirect: '/accounts/profile' });
  });

  /* venues/owner_join.html — a player opts in to becoming an owner. */
  router.post('/api/become-owner', (req, res) => {
    if (!req.user) return json(res, 401, { ok: false, error: 'Sign in required.' });
    if (req.user.role === 'player') store.run("UPDATE users SET role = 'owner' WHERE id = ?", req.user.id);
    req.user.role = 'owner';
    json(res, 200, { ok: true, user: M.userJson(req.user), redirect: '/courts/new' });
  });
}

module.exports = { attach, validateRegister };
