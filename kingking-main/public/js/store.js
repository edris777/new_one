/* ============================================================
   Store — session state and flash messages
   Same shape as Pickleball's Store (ops / sel / subscribe) but the
   records themselves live in SQLite behind /api, exactly like the
   Django app. Only the signed-in user and queued messages are held
   here, so nothing the pages render is a stale copy of the database.
   ============================================================ */

const Store = (function () {
  const KEY = 'dinkhub-session-restore';

  let user = null;
  const listeners = [];
  const flashQueue = [];

  function emit(reason) {
    listeners.slice().forEach(fn => {
      try { fn(reason); } catch (e) { console.error(e); }
    });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const at = listeners.indexOf(fn);
      if (at > -1) listeners.splice(at, 1);
    };
  }

  /* Django's messages framework: queue here, the shell renders the toast stack. */
  function flash(text, tags) {
    flashQueue.push({ text: String(text), tags: tags || 'success' });
    return emit('flash');
  }

  function takeFlash() {
    return flashQueue.splice(0, flashQueue.length);
  }

  const ops = {};

  ops.bootstrap = () => Api.get('/api/who').then(res => {
    user = res.user || null;
    return user;
  });

  ops.login = (username, password, next) => Api.post('/api/login', { username, password, next }).then(res => {
    if (res.ok) { user = res.user; emit('login'); }
    return res;
  });

  ops.register = payload => Api.post('/api/register', payload).then(res => {
    if (res.ok) { user = res.user; emit('login'); }
    return res;
  });

  ops.logout = () => Api.post('/api/logout').then(res => {
    user = null;
    emit('logout');
    return res;
  });

  ops.saveProfile = payload => Api.post('/api/profile', payload).then(res => {
    if (res.ok) { user = res.user; emit('profile'); }
    return res;
  });

  ops.becomeOwner = () => Api.post('/api/become-owner').then(res => {
    if (res.ok) { user = res.user; emit('role'); }
    return res;
  });

  ops.setUser = value => { user = value || null; emit('user'); };

  const sel = {};

  sel.user = () => user;
  sel.isSignedIn = () => !!user;
  sel.isPlayer = () => !!user && user.role === 'player';
  sel.isOwner = () => !!user && user.role === 'owner';
  sel.isAdmin = () => !!(user && user.is_administrator);
  sel.role = () => (user ? user.role : 'guest');
  sel.dashboardUrl = () => (user ? user.dashboard_url : '/accounts/login');

  /* A guest bounced from a protected page comes back to where they were. */
  sel.nextFor = path => encodeURIComponent(path || window.location.pathname);

  const api = {
    get user() { return user; },
    ops,
    sel,
    flash,
    takeFlash,
    subscribe,
    emit,
    KEY
  };

  return api;
})();

window.Store = Store;
