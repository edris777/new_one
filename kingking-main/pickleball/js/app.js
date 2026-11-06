/* ============================================================
   Shell, router and global interactions
   ============================================================ */

(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const root = document.documentElement;

  const state = {
    route: 'dashboard',
    variant: 'court',
    theme: 'light',
    rail: 'auto',
    program: 'p1',
    venue: 'v1',
    range: 'Week',
    focus: null,
    tab: null
  };

  let lastMini = false;
  let wasMini = false;
  let pageDirty = true;

  /* full-bleed views that own their own DOM and lifecycle */
  const IMMERSIVE = {
    tour: { mount: el => { if (window.TOURVIEW) TOURVIEW.mount(el); } }
  };

  /* pages that render as markup but need a live widget wired in afterwards */
  const HOOKS = {
    map: el => { if (window.LIVEMAP) LIVEMAP.mount(el); }
  };

  try {
    Object.assign(state, JSON.parse(localStorage.getItem('piklemarawi') || '{}'));
    state.focus = null;
  } catch (e) { /* first run */ }

  /* read-only view of the router state for modules that render inside a page */
  window.PMSTATE = () => state;

  function save() {
    try { localStorage.setItem('piklemarawi', JSON.stringify(Object.assign({}, state, { focus: null }))); } catch (e) {}
  }

  function isMini() {
    return state.rail === 'mini' || (state.rail === 'auto' && window.innerWidth < 1240);
  }

  function apply() {
    root.dataset.variant = state.variant;
    root.dataset.theme = state.theme;
    lastMini = isMini();
    $('#appShell').classList.toggle('rail-mini', lastMini);
    return lastMini;
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) $('#appShell').classList.remove('rail-open');
    if (apply() !== wasMini) renderRail();
    wasMini = lastMini;
  });

  /* ---------------- rail ---------------- */
  function renderRail() {
    const unread = Store.sel.unreadCount();
    const groups = NAV.map(g =>
      '<div class="rail-group">' +
        '<span>' + g.g + '</span>' +
        '<i class="rail-group-line"></i>' +
        '<em>' + g.items.length + '</em>' +
      '</div>' +
      g.items.map(it =>
        '<button class="rail-btn' + (state.route === it.id ? ' is-active' : '') + '" ' +
        'data-goto="' + it.id + '" data-tip="' + it.label + '" aria-label="' + it.label + '"' +
        (state.route === it.id ? ' aria-current="page"' : '') + '>' +
        '<span class="rail-ico">' + icon(it.icon, 21) + '</span>' +
        '<span class="rail-label">' + it.label + '</span>' +
        (it.id === 'notifications' && unread ? '<span class="rail-badge">' + unread + '</span>' : it.badge ? '<span class="rail-badge">' + it.badge + '</span>' : '') +
        '</button>'
      ).join('')
    ).join('');

    const user = Store.settings.user;

    $('#rail').innerHTML =
      '<div class="rail-brand">' +
        '<span class="rail-logo">' + icon('ball', 22) + '</span>' +
        '<span class="rail-txt"><b>' + Store.settings.club.name + '</b><span>Club Operations</span></span>' +
        '<button class="rail-close" data-action="close-drawer" aria-label="Close menu">' + icon('x', 18) + '</button>' +
      '</div>' +
      '<div class="rail-scroll">' + groups + '</div>' +
      '<div class="rail-foot">' +
        '<button class="rail-btn" data-action="theme" data-tip="' + (state.theme === 'light' ? 'Dark mode' : 'Light mode') + '" aria-label="Toggle theme">' +
          '<span class="rail-ico">' + icon(state.theme === 'light' ? 'moon' : 'sun', 21) + '</span>' +
          '<span class="rail-label">' + (state.theme === 'light' ? 'Dark mode' : 'Light mode') + '</span>' +
        '</button>' +
        '<button class="rail-user" data-goto="profile" data-tip="My profile" aria-label="My profile">' +
          '<span class="rail-ava">' + initials(user.name) + '</span>' +
          '<span class="rail-txt"><b>' + user.name + '</b><span>' + user.role + '</span></span>' +
          '<span class="rail-ico">' + icon('chevron-right', 17) + '</span>' +
        '</button>' +
        '<button class="rail-collapse" data-action="expand-rail" data-tip="' + (isMini() ? 'Expand menu' : 'Collapse menu') + '" aria-label="Toggle menu width">' +
          icon(isMini() ? 'chevron-right' : 'chevron-left', 16) +
          '<span>' + (isMini() ? 'Expand menu' : 'Collapse menu') + '</span>' +
        '</button>' +
      '</div>';
  }

  /* ---------------- topbar ---------------- */
  function renderTop() {
    const unread = Store.sel.unreadCount();
    $('#topbar').innerHTML =
      '<button class="icon-btn menu-btn" data-action="toggle-drawer" aria-label="Open menu">' + icon('menu', 20) + '</button>' +
      '<div class="brand"><span class="brand-mark">' + icon(railIcon(), 26) + '</span>' +
      '<span class="brand-txt"><b>' + labelOf(state.route) + '</b>' +
      '<span>' + groupOf(state.route) + ' · ' + CLUB.city + '</span></span></div>' +
      '<nav class="nav-pill" aria-label="Sections">' +
      TOP_TABS.map(t => '<button data-goto="' + t.id + '" class="' + (state.route === t.id ? 'is-active' : '') + '">' + t.label + '</button>').join('') +
      '</nav>' +
      '<div class="top-actions">' +
        '<div class="search-shell">' +
          '<label class="search-box">' + icon('search', 16) +
            '<input id="globalSearch" type="search" autocomplete="off" placeholder="Search players, courts, invoices…" aria-label="Global search">' +
            '<kbd>/</kbd></label>' +
          '<div class="search-pop" id="searchPop" hidden></div>' +
        '</div>' +
        '<button class="icon-btn solid" data-action="quick-add" aria-label="New booking">' + icon('plus', 19) + '</button>' +
        '<button class="icon-btn" data-goto="notifications" aria-label="Notifications">' +
          (unread ? '<span class="dot">' + unread + '</span>' : '<span class="dot"></span>') + icon('bell', 19) + '</button>' +
        '<button class="icon-btn" data-goto="settings" aria-label="Settings">' + icon('settings', 19) + '</button>' +
        '<button class="avatar" data-goto="profile" aria-label="My profile">' + initials(Store.settings.user.name) + '</button>' +
      '</div>';
  }

  function groupOf(id) {
    const g = NAV.find(x => x.items.some(i => i.id === id));
    return g ? g.g : 'Play';
  }
  function railIcon() {
    for (const g of NAV) { const f = g.items.find(i => i.id === state.route); if (f) return f.icon; }
    return 'paddle';
  }

  /* ---------------- switcher ---------------- */
  function renderSwitcher() {
    const opts = [
      { id: 'court', label: 'Court', icon: 'ball' },
      { id: 'clay', label: 'Clay', icon: 'flame' }
    ];
    $('#switcher').innerHTML = opts.map(o =>
      '<button data-variant="' + o.id + '" class="' + (state.variant === o.id ? 'is-active' : '') + '">' +
      '<span class="lamp"></span>' + icon(o.icon, 14) + o.label + '</button>'
    ).join('');
  }

  /* ---------------- view ---------------- */
  let renderToken = 0;

  function render() {
    apply();
    renderRail();
    renderTop();
    renderSwitcher();
    mount();
    save();
  }

  function mount() {
    const token = ++renderToken;
    apply();
    const v = $('#view');
    if (window.TOURVIEW) TOURVIEW.destroy();
    if (window.LIVEMAP) LIVEMAP.destroy();
    if (window.DASHMAP) DASHMAP.destroy();

    const immersive = !!IMMERSIVE[state.route];
    v.className = 'view' + (immersive ? ' is-immersive' : '');
    $('#viewport').classList.toggle('immersive', immersive);

    if (immersive) {
      v.innerHTML = '';
      IMMERSIVE[state.route].mount(v);
      document.title = labelOf(state.route) + ' · ' + Store.settings.club.name;
      return;
    }

    const page = PAGES[state.route];
    const known = !!page;

    /* data pages get a real loading state, then draw */
    if (known && page && page.render) {
      v.innerHTML = '<div class="page-load">' + UI.skeleton(6, 5) + '</div>';
      setTimeout(() => {
        if (token !== renderToken) return;
        v.innerHTML = '';
        try {
          page.render(v);
        } catch (err) {
          console.error(err);
          v.innerHTML = UI.empty('alert', 'This page could not be drawn.', String(err.message || err),
            '<button class="pill-btn ghost" data-goto="dashboard">Back to dashboard</button>');
        }
        if (HOOKS[state.route]) HOOKS[state.route](v);
        $('#viewport').scrollTop = 0;
      }, page.instant ? 0 : 90);
      document.title = labelOf(state.route) + ' · ' + Store.settings.club.name;
      return;
    }

    let html;
    if (typeof page === 'function') html = page();
    else if (page && page.html) html = page.html();
    else html = UI.empty('help', 'That page is not wired up yet.', '“' + state.route + '” has no module behind it.',
      '<button class="pill-btn ghost" data-goto="dashboard">Back to dashboard</button>');

    v.innerHTML = html;
    if (HOOKS[state.route]) HOOKS[state.route](v);
    $('#viewport').scrollTop = 0;
    document.title = labelOf(state.route) + ' · ' + Store.settings.club.name;
    save();
  }

  function labelOf(id) {
    for (const g of NAV) { const f = g.items.find(i => i.id === id); if (f) return f.label; }
    const t = TOP_TABS.find(i => i.id === id);
    return t ? t.label : 'Dashboard';
  }

  function go(id, focus) {
    if (!NAV.some(g => g.items.some(i => i.id === id)) && !TOP_TABS.some(t => t.id === id)) return;
    state.route = id;
    state.focus = focus || null;
    state.tab = null;
    $('#appShell').classList.remove('rail-open');
    renderToken++;
    apply();
    renderRail();
    renderTop();
    mount();
    save();
  }
  window.go = go;

  /* the store is the source of truth — when it changes, the shell follows */
  Store.subscribe(reason => {
    if (reason === 'reset') return render();
    renderRail();
    renderTop();
    if (IMMERSIVE[state.route] || HOOKS[state.route]) return;
    const page = PAGES[state.route];
    if (page && page.render && page.live !== false) mount();
  });

  /* ---------------- global search ---------------- */
  function searchPop(query) {
    const pop = $('#searchPop');
    if (!pop) return;
    const q = String(query || '').trim();
    if (q.length < 2) { pop.hidden = true; pop.innerHTML = ''; return; }
    const hits = Store.sel.search(q);
    pop.hidden = false;
    if (!hits.length) {
      pop.innerHTML = '<div class="sp-empty">' + icon('search', 18) + '<span>No records match “' + UI.esc(q) + '”.</span></div>';
      return;
    }
    const groups = {};
    hits.forEach(h => { (groups[h.group] = groups[h.group] || []).push(h); });
    pop.innerHTML = Object.keys(groups).map(g =>
      '<div class="sp-group"><span>' + g + '</span>' +
      groups[g].map(h =>
        '<button class="sp-row" data-search-go="' + h.route + '" data-focus="' + UI.esc(h.id) + '">' +
        '<span class="sp-ico">' + icon(h.icon, 16) + '</span>' +
        '<span class="sp-main"><b>' + UI.esc(h.label) + '</b><em>' + UI.esc(h.sub) + '</em></span>' +
        icon('chevron-right', 15) + '</button>').join('') + '</div>'
    ).join('') + '<div class="sp-foot">' + hits.length + ' result(s) across the club · Enter to open the first</div>';
  }

  document.addEventListener('input', e => {
    if (e.target.id === 'globalSearch') searchPop(e.target.value);
  });

  /* ---------------- toast (kept for legacy call sites) ---------------- */
  function toast(msg, type) { UI.toast(msg, type); }
  window.toast = toast;
  window.modal = cfg => UI.modal(cfg);

  /* ---------------- quick add ---------------- */
  function quickAdd() {
    UI.modal({
      title: 'Quick actions',
      sub: 'Everything an admin reaches for most',
      body: '<div class="quick-grid">' + [
        ['booking', 'New court booking', 'calendar'],
        ['members', 'Add a player', 'users'],
        ['payments', 'Record a payment', 'wallet'],
        ['matches', 'Schedule a match', 'paddle'],
        ['tournaments', 'Create a tournament', 'trophy'],
        ['courts', 'Change a court status', 'court']
      ].map(q => '<button class="quick-item" data-goto="' + q[0] + '" data-quick="' + q[0] + '">' +
        '<span>' + icon(q[2], 20) + '</span><b>' + q[1] + '</b></button>').join('') + '</div>',
      dismiss: true,
      onAction() {}
    });
  }

  /* ---------------- interactions ---------------- */
  document.addEventListener('click', e => {
    const t = e.target;

    const sgo = t.closest('[data-search-go]');
    if (sgo) {
      const pop = $('#searchPop');
      if (pop) { pop.hidden = true; pop.innerHTML = ''; }
      const box = $('#globalSearch');
      if (box) box.value = '';
      return go(sgo.dataset.searchGo, sgo.dataset.focus);
    }

    const goto = t.closest('[data-goto]');
    if (goto) {
      const quick = t.closest('[data-quick]');
      go(goto.dataset.goto, goto.dataset.focus || (quick ? 'new' : null));
      return;
    }

    const variant = t.closest('#switcher [data-variant]');
    if (variant) { state.variant = variant.dataset.variant; state.route = 'dashboard'; return render(); }

    const prog = t.closest('[data-program]');
    if (prog) {
      $$('[data-program]').forEach(p => p.classList.remove('is-active'));
      prog.classList.add('is-active');
      state.program = prog.dataset.program;
      const p = PROGRAMS.find(x => x.id === state.program);
      return toast(p.title + ' selected', 'info');
    }

    const pin = t.closest('[data-pin]');
    if (pin) {
      state.venue = pin.dataset.pin;
      const v = VENUES.find(x => x.id === state.venue);
      if (state.route === 'map' && window.LIVEMAP) return LIVEMAP.focus(v);
      save();
      go('map');
      return toast('Showing ' + v.name + ' · Brgy. ' + v.barangay, 'info');
    }

    const book = t.closest('[data-book]');
    if (book) { state.venue = book.dataset.book; return go('booking', 'new'); }

    const enroll = t.closest('[data-enroll]');
    if (enroll) {
      const r = Store.ops.enrollProgram(enroll.dataset.enroll);
      return toast(r.ok ? 'Seat reserved — ' + (r.left || 0) + ' places left' : r.errors.id, r.ok ? 'ok' : 'err');
    }

    const cart = t.closest('[data-cart]');
    if (cart) {
      const r = Store.ops.cartAdd(cart.dataset.cart);
      return toast(cart.dataset.cart + ' added · ' + r.items + ' item(s) in cart');
    }

    const rsvp = t.closest('[data-rsvp]');
    if (rsvp) {
      const r = Store.ops.rsvpEvent(rsvp.dataset.rsvp);
      return toast(r.ok ? 'RSVP confirmed · ' + r.left + ' spots left' : r.errors.id, r.ok ? 'ok' : 'err');
    }

    const act = t.closest('[data-action]');
    if (!act) return;
    const a = act.dataset.action;

    if (a === 'theme') {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      Store.ops.saveSettings('user', Object.assign({}, Store.settings.user, { theme: state.theme }));
      return render();
    }
    if (a === 'expand-rail') { state.rail = state.rail === 'mini' ? 'full' : 'mini'; return render(); }
    if (a === 'toggle-drawer') { $('#appShell').classList.toggle('rail-open'); return; }
    if (a === 'close-drawer') { return $('#appShell').classList.remove('rail-open'); }
    if (a === 'quick-add') return quickAdd();
    if (a === 'read-all') { Store.ops.markAllRead(); return toast('All notifications marked as read'); }
    if (a === 'go-booking') return go('booking', 'new');
    if (a === 'dismiss-hero') { act.closest('.hero-card').remove(); return toast('Booking card hidden', 'info'); }
    if (a === 'dismiss-upcoming') { act.closest('.upcoming').remove(); return toast('Upcoming match hidden', 'info'); }
    if (a === 'global-search') {
      const q = $('#globalSearch').value.trim();
      searchPop(q);
      return q ? null : toast('Type at least two characters to search', 'warn');
    }
    if (a === 'search-programs') {
      const q = ($('#progSearch') || {}).value || '';
      return q ? null : toast('Filtering the clinic list', 'info');
    }
    if (a === 'mute') { const item = act.closest('[data-mutable]'); if (item) item.remove(); return toast('Muted this thread', 'info'); }
    if (a === 'share' || a === 'share-club') return PAGES.venues.share();
    if (a === 'add-venue') return PAGES.venues.openForm();
    if (a === 'download') { toast('Export started — check the downloads folder'); return; }
    if (a === 'voice') { return toast('Voice check-in opened', 'info'); }
    if (a === 'quick-note') {
      return UI.formModal({
        title: 'Quick note', sub: 'Logged straight to the court notes board',
        fields: [
          { name: 'title', label: 'Note', type: 'textarea', rows: 4, col: 2, required: true, placeholder: 'C3 needs a line repaint before Saturday…' },
          { name: 'tag', label: 'Tag', type: 'select', col: 1, value: 'Maintenance', options: ['League', 'Maintenance', 'Pro Shop', 'Venues', 'General'].map(x => ({ value: x, label: x })) }
        ],
        submitLabel: 'Save note',
        onSubmit(vals) { return Store.ops.addNote(vals.title, vals.tag); }
      });
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) {
      if (e.target.id === 'globalSearch') {
        if (e.key === 'Escape') { e.target.value = ''; searchPop(''); e.target.blur(); }
        if (e.key === 'Enter') {
          const first = $('#searchPop [data-search-go]');
          if (first) first.click();
        }
      }
      return;
    }
    if (openModalCount()) return;
    if (e.key === '/') { e.preventDefault(); const s = $('#globalSearch'); if (s) s.focus(); return; }
    if (e.key.toLowerCase() === 't') { state.theme = state.theme === 'light' ? 'dark' : 'light'; return render(); }
    if (e.key.toLowerCase() === 'v' && state.route === 'dashboard') {
      state.variant = state.variant === 'court' ? 'clay' : 'court';
      return render();
    }
    if (e.key >= '1' && e.key <= '7') go(NAV[0].items[+e.key - 1].id);
  });

  function openModalCount() { return document.querySelectorAll('.modal').length; }

  /* live clock in the location chip */
  setInterval(() => {
    const el = $('.loc-chip .live');
    if (el) el.parentNode.lastChild.textContent = ' ' + new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }) + ' · Manila';
  }, 30000);

  render();
})();
