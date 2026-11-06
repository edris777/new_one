/* ============================================================
   Shell + router
   Django resolved URL -> view -> template on every request. The port
   keeps the exact same paths and the same access rules, but resolves
   them against PAGES on the client and pushes history entries, so
   links, the back button and deep links all still work.
   ============================================================ */

(function () {
  const { esc } = UI;

  /* config/urls.py + each app's urls.py, in match order. */
  const ROUTES = [
    { path: '/', page: 'home', nav: 'home', home: true, title: 'DinkHub - Find your court. Book your game.' },
    { path: '/about', page: 'about', nav: 'about', title: 'About DinkHub' },
    { path: '/how-it-works', page: 'how_it_works', nav: 'how_it_works', title: 'How DinkHub works' },
    { path: '/guide', page: 'guide', nav: '', title: 'Pickleball guide' },
    { path: '/developers', page: 'developers', nav: '', title: 'Built by developers' },
    { path: '/contact', page: 'contact', nav: 'contact', title: 'Contact DinkHub' },

    { path: '/accounts/login', page: 'login', title: 'Log in to DinkHub' },
    { path: '/accounts/register', page: 'register', title: 'Create a DinkHub account' },
    { path: '/accounts/profile', page: 'profile', auth: true, title: 'My profile' },

    { path: '/courts', page: 'browse', nav: 'browse', title: 'Browse courts' },
    { path: '/courts/new', page: 'venueCreate', auth: true, title: 'List a venue' },
    { path: '/courts/owner/join', page: 'ownerJoin', auth: true, title: 'Become a venue owner' },
    { path: '/courts/:slug/edit', page: 'venueEdit', auth: true, title: 'Edit venue' },
    { path: '/courts/:slug', page: 'venueDetail', title: 'Venue' },

    { path: '/bookings/court/:courtId/new', page: 'bookingCreate', auth: true, title: 'Request a booking' },
    { path: '/bookings/:reference', page: 'receipt', auth: true, title: 'Booking receipt' },

    { path: '/dashboard', page: 'dashboardRedirect', auth: true, title: 'Dashboard' },
    { path: '/dashboard/player', page: 'playerDashboard', auth: true, roles: ['player'], title: 'Player dashboard' },
    { path: '/dashboard/owner', page: 'ownerDashboard', auth: true, roles: ['owner'], title: 'Owner dashboard' },
    { path: '/dashboard/admin/users', page: 'usersDashboard', auth: true, roles: ['admin'], title: 'Accounts' },
    { path: '/dashboard/admin', page: 'adminDashboard', auth: true, roles: ['admin'], title: 'Admin dashboard' }
  ];

  function compile(pattern) {
    const keys = [];
    const source = pattern.replace(/:[A-Za-z_]+/g, match => {
      keys.push(match.slice(1));
      return '([^/]+)';
    });
    return { keys, regex: new RegExp('^' + source + '$') };
  }
  ROUTES.forEach(route => { route.match = compile(route.path); });

  function resolve(pathname) {
    /* Django's URLs carried a trailing slash; accept either form here. */
    const clean = pathname.length > 1 && pathname.charAt(pathname.length - 1) === '/'
      ? pathname.slice(0, -1) : pathname;
    for (const route of ROUTES) {
      const hit = route.match.regex.exec(clean);
      if (!hit) continue;
      const params = {};
      route.match.keys.forEach((key, i) => { params[key] = decodeURIComponent(hit[i + 1]); });
      return { route, params };
    }
    return null;
  }

  function query() {
    return Object.fromEntries(new URLSearchParams(window.location.search).entries());
  }

  /* ---------- navigation ---------- */
  let renderToken = 0;

  function go(path, replace) {
    if (replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    /* Django loaded a fresh page at the top; an SPA has to say so. */
    window.scrollTo(0, 0);
    render();
  }
  window.go = go;

  function refreshChrome(route) {
    const isHome = !!route.home;
    Partials.renderChrome(route.nav || '', isHome);
    document.body.classList.toggle('home-page', isHome);
  }

  function titleFor(route, extra) {
    document.title = extra || route.title || 'DinkHub';
  }

  /* mirrors @login_required and the role_required decorator */
  function gate(route) {
    const user = Store.sel.user();
    if (route.auth && !user) {
      go('/accounts/login/?next=' + encodeURIComponent(window.location.pathname));
      return false;
    }
    if (route.roles && user && !Store.sel.isAdmin()) {
      if (route.roles.indexOf(user.role) === -1) {
        Motion.toast('That dashboard is not available for your account type.', 'error');
        go(user.dashboard_url);
        return false;
      }
    }
    return true;
  }

  function host() {
    return document.getElementById('main');
  }

  function render() {
    const token = ++renderToken;
    const found = resolve(window.location.pathname);
    const target = host();
    if (!target) return;

    if (!found) {
      titleFor({ title: 'Page not found | DinkHub' });
      refreshChrome({});
      target.innerHTML = UI.notFound('That page has moved.',
        'The address ' + window.location.pathname + ' does not match a DinkHub screen.',
        UI.button('Back to home', { href: '/', variant: 'dark', small: true }));
      Motion.scan(target);
      return;
    }

    const route = found.route;
    const page = PAGES[route.page];
    refreshChrome(route);

    if (!page) {
      target.innerHTML = UI.notFound('Screen not wired up.', route.page + ' has no module behind it yet.');
      Motion.scan(target);
      return;
    }

    if (!gate(route)) return;

    titleFor(route);
    target.innerHTML = '<div class="route-loading">Loading</div>';

    Promise.resolve(page.render(target, found.params, query())).then(result => {
      if (token !== renderToken) return;
      Motion.scan(target);
      Partials.drainFlash();
      titleFor(route, result && result.title);
      if (result && result.redirect) go(result.redirect, true);
    }).catch(err => {
      console.error(err);
      if (token !== renderToken) return;
      target.innerHTML = UI.notFound('Something went wrong.', String((err && err.message) || err));
      Motion.scan(target);
    });
  }

  /* Pages that change data re-enter here the way a Django redirect would. */
  function reload() {
    return render();
  }
  window.reloadRoute = reload;

  /* ---------- link handling ---------- */
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.charAt(0) !== '/' ) return;
    if (anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    go(href);
  });

  window.addEventListener('popstate', render);

  /* pages ask for a login the same way Django redirected to accounts:login */
  function requireLogin() {
    go('/accounts/login/?next=' + encodeURIComponent(window.location.pathname));
  }
  window.requireLogin = requireLogin;

  /* ---------- boot ---------- */
  Store.ops.bootstrap().then(() => {
    render();
    /* one-time listeners: sticky nav, mobile menu, Escape (Django's main.js) */
    Motion.init();
    Partials.drainFlash();
  });
})();
