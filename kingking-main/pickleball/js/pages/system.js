/* ============================================================
   System + community pages
   Notifications · Settings · Help · Court weather · Notes
   Messages · Events · Shot library · Daily drills · Clinics

   Reads through Store.sel / Store.list, writes only through
   Store.ops (or the generic CRUD + an explicit emit), never
   during render.
   ============================================================ */

(function () {
  const esc = UI.esc;

  /* view-only state — filters and tabs are not club data */
  const vs = {
    notifFilter: 'all',
    notifKind: '',
    settingsTab: 'club',
    noteTag: '',
    eventKind: '',
    shotKind: '',
    threadWho: '',
    noteFocus: false,
    sendFocus: false
  };

  const num = function (v, d) { const n = Number(v); return isNaN(n) ? d : n; };

  /* ---------------- shared markup ---------------- */
  function head(title, sub, tools) {
    return '<div class="page-head"><div><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div>' +
      (tools ? '<div class="page-tools">' + tools + '</div>' : '') + '</div>';
  }

  function panel(title, sub, body, tools) {
    return '<div class="panel"><div class="panel-head"><div><h3>' + esc(title) + '</h3>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (tools ? '<div class="page-tools">' + tools + '</div>' : '') + '</div>' +
      body + '</div>';
  }

  function tile(label, value) {
    return '<div class="tile"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }

  function chip(act, id, label, active) {
    return '<button class="chip' + (active ? ' is-active' : '') + '" data-sy-act="' + act + '"' +
      (id === null || id === undefined ? '' : ' data-sy-id="' + esc(id) + '"') + '>' + esc(label) + '</button>';
  }

  function syBtn(act, label, cls, iconName, id) {
    return '<button class="pill-btn ' + (cls || 'ghost') + '" data-sy-act="' + act + '"' +
      (!id && id !== 0 ? '' : ' data-sy-id="' + esc(id) + '"') + '>' +
      (iconName ? icon(iconName, 15) : '') + esc(label) + '</button>';
  }

  function syIcon(act, id, label, iconName, cls) {
    return '<button class="row-act' + (cls ? ' ' + cls : '') + '" data-sy-act="' + act + '"' +
      ' data-sy-id="' + esc(id) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
      icon(iconName, 16) + '</button>';
  }

  function note(text) {
    return '<p class="modal-note">' + text + '</p>';
  }

  /* ---------------- store plumbing ---------------- */
  /* generic CRUD helpers do not emit — every write from a page fires once here */
  function bump(reason) { Store.emit('system:' + reason); }
  function removeRow(kind, id, reason) { const ok = Store.del(kind, id); if (ok) bump(reason); return ok; }
  function errText(res, fallback) {
    return (res && res.errors && (res.errors.id || Object.keys(res.errors).map(function (k) { return res.errors[k]; })[0])) || fallback;
  }

  /* host is the persistent <main class="view">: listeners live on a node
     rebuilt by every paint so they can never stack up across re-renders */
  function page(host, build, bind, after) {
    const paint = function () {
      host.innerHTML = '<div class="sy-root">' + build() + '</div>';
      const root = host.firstElementChild;
      root.addEventListener('click', function (e) { bind(e, root, paint); });
      if (after) after(root, paint);
      return root;
    };
    paint();
  }

  /* shell-owned hooks stay owned by the shell — a click that lands on one of
     them must not also fire the page action wrapped around it */
  const SHELL = '[data-goto],[data-pin],[data-book],[data-enroll],[data-rsvp],' +
    '[data-cart],[data-program],[data-search-go],[data-action]';

  function run(root, e, fn) {
    const hit = e.target.closest('[data-sy-act]');
    if (!hit || !root.contains(hit)) return false;
    if (e.target.closest(SHELL)) return false;
    e.preventDefault();
    fn(hit.dataset.syAct, hit.dataset.syId, hit);
    return true;
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */
  const N_ROUTE = {
    booking: 'booking', payment: 'payments', match: 'matches', tournament: 'tournaments',
    court: 'courts', member: 'members', event: 'events', clinic: 'training', weather: 'weather',
    shop: 'proshop', system: 'settings', club: 'events'
  };
  /* id prefix → [route, collection] so a row deep-links to the real record */
  const N_PREFIX = {
    B: ['booking', 'bookings'], INV: ['payments', 'payments'], M: ['matches', 'matches'],
    T: ['tournaments', 'tournaments'], C: ['courts', 'courts'], P: ['members', 'players'],
    E: ['events', 'events']
  };
  const N_IMPORTANT = ['booking', 'payment', 'match', 'tournament', 'court'];
  const N_ICON = { weather: 'wind', event: 'megaphone', clinic: 'book', note: 'notebook' };
  const N_VIEWS = [['all', 'All'], ['unread', 'Unread'], ['important', 'Important'], ['read', 'Read']];

  function notifIcon(kind) { return N_ICON[kind] || Store.KIND_ICON[kind] || 'bell'; }

  function notifTarget(n) {
    const m = String(n.text || '').match(/\b(B|INV|M|T|C|P|E)-\d+\b/);
    if (m && N_PREFIX[m[1]]) {
      const pair = N_PREFIX[m[1]];
      if (Store.get(pair[1], m[0])) return { route: pair[0], id: m[0], label: 'Open ' + m[0] };
    }
    return { route: N_ROUTE[n.kind] || 'notifications', id: null, label: 'Open ' + (N_ROUTE[n.kind] || 'the club log') };
  }

  function notifPasses(n) {
    if (vs.notifKind && n.kind !== vs.notifKind) return false;
    if (vs.notifFilter === 'unread') return !n.read;
    if (vs.notifFilter === 'read') return !!n.read;
    if (vs.notifFilter === 'important') return N_IMPORTANT.indexOf(n.kind) > -1;
    return true;
  }

  function notifRows() {
    return Store.list('notifications').filter(notifPasses)
      .slice().sort(function (a, b) { return String(a.at) < String(b.at) ? 1 : -1; });
  }

  function notifRow(n) {
    const important = N_IMPORTANT.indexOf(n.kind) > -1;
    const target = notifTarget(n);
    return '<div class="row" data-sy-act="open" data-sy-id="' + esc(n.id) + '" style="cursor:pointer"' +
      (n.read ? '' : ' data-unread="1"') + '>' +
      '<span class="slab' + (n.read ? '' : ' tint') + '">' + icon(notifIcon(n.kind), 18) + '</span>' +
      '<div class="grow"><div class="t1" style="white-space:normal' + (n.read ? '' : ';font-weight:800') + '">' + esc(n.text) + '</div>' +
      '<div class="t2">' + esc(UI.relTime(n.at)) + ' · ' + esc(n.kind) +
      (important ? ' · <span class="badge is-warn">Important</span>' : '') +
      (n.read ? '' : ' · <span class="badge is-info">Unread</span>') +
      (target.route === 'notifications' ? '' : ' · ' + esc(target.label)) + '</div></div>' +
      '<div style="display:flex;gap:6px;flex:0 0 auto">' +
      (n.read
        ? syIcon('unread', n.id, 'Mark as unread', 'eye')
        : syIcon('read', n.id, 'Mark as read', 'check')) +
      syIcon('dismiss', n.id, 'Dismiss this notification', 'trash', 'danger') +
      '</div></div>';
  }

  function notifHtml() {
    const all = Store.list('notifications');
    const unread = Store.sel.unreadCount();
    const rows = notifRows();
    const kinds = [];
    all.forEach(function (n) { if (kinds.indexOf(n.kind) < 0) kinds.push(n.kind); });
    kinds.sort();

    const tools = syBtn('read-all', 'Mark all read', 'primary', 'check') +
      syBtn('clear-read', 'Clear read', 'ghost', 'trash');

    const tiles = '<div class="tiles" style="margin-bottom:18px">' +
      tile('Unread', unread) +
      tile('Important', all.filter(function (n) { return N_IMPORTANT.indexOf(n.kind) > -1; }).length) +
      tile('Read', all.length - unread) +
      tile('In the inbox', all.length) + '</div>';

    const views = '<div class="chips" style="margin-bottom:10px">' + N_VIEWS.map(function (f) {
      const count = f[0] === 'all' ? all.length
        : f[0] === 'unread' ? unread
        : f[0] === 'read' ? all.length - unread
        : all.filter(function (n) { return N_IMPORTANT.indexOf(n.kind) > -1; }).length;
      return chip('filter', f[0], f[1] + ' · ' + count, vs.notifFilter === f[0]);
    }).join('') + '</div>';

    const kindRow = '<div class="chips">' +
      chip('kind', '', 'Every kind', vs.notifKind === '') +
      kinds.map(function (k) {
        return '<button class="chip' + (vs.notifKind === k ? ' is-active' : '') + '" data-sy-act="kind" data-sy-kind="' + esc(k) + '">' +
          icon(notifIcon(k), 14) + ' ' + esc(k) + '</button>';
      }).join('') + '</div>';

    const list = rows.length
      ? '<div class="stack" style="gap:0">' + rows.map(notifRow).join('') + '</div>'
      : UI.empty('bell', all.length ? 'Nothing matches those filters.' : 'The inbox is empty.',
        all.length ? 'Every notification that is read and dismissed lands here again once the club sends it.' : 'Bookings, payments, results and court calls all arrive in this inbox.',
        all.length ? '<button class="pill-btn ghost" data-sy-act="reset-filters">Show all notifications</button>' : '');

    return head('Notifications', 'Everything the club has sent you · ' + unread + ' unread right now', tools) +
      tiles +
      panel('Inbox', rows.length + ' of ' + all.length + ' shown', views + kindRow + '<div style="margin-top:14px">' + list + '</div>') +
      note('Read, dismissed or cleared rows are gone for good — nothing here is a demo flag.');
  }

  function notificationsPage(host) {
    page(host, notifHtml, function (e, root, repaint) {
      run(root, e, function (act, id, el) {
        if (act === 'filter') { vs.notifFilter = id || 'all'; return repaint(); }
        if (act === 'kind') { vs.notifKind = el.dataset.syKind || ''; return repaint(); }
        if (act === 'reset-filters') { vs.notifFilter = 'all'; vs.notifKind = ''; return repaint(); }
        if (act === 'read-all') {
          const res = Store.ops.markAllRead();
          return res.ok ? UI.toast('Every notification is marked as read.') : UI.toast('Could not update the inbox.', 'err');
        }
        if (act === 'clear-read') {
          const readCount = Store.list('notifications').filter(function (n) { return n.read; }).length;
          if (!readCount) return UI.toast('There are no read notifications to clear.', 'warn');
          return UI.confirm({
            title: 'Clear read notifications?',
            body: readCount + ' read notification(s) will be removed from the inbox.',
            detail: 'Anything still unread stays where it is.',
            okLabel: 'Clear them', cancelLabel: 'Keep them', danger: true
          }).then(function (ok) {
            if (!ok) return false;
            const res = Store.ops.clearRead();
            if (!res.ok) return UI.toast('Could not clear the inbox.', 'err');
            UI.toast(res.removed + ' read notification(s) cleared.');
          });
        }
        if (act === 'read' || act === 'unread') {
          const res = act === 'read' ? Store.ops.markRead(id) : Store.ops.markUnread(id);
          if (!res.ok) return UI.toast('That notification is already gone.', 'warn');
          return UI.toast(act === 'read' ? 'Marked as read.' : 'Back in the unread pile.', 'info');
        }
        if (act === 'dismiss') {
          const n = Store.get('notifications', id);
          if (!n) return UI.toast('That notification is already gone.', 'warn');
          return UI.confirm({
            title: 'Dismiss this notification?', body: 'It is removed from the inbox for good.',
            detail: n.text, okLabel: 'Dismiss', cancelLabel: 'Keep it', danger: true
          }).then(function (ok) {
            if (!ok) return false;
            if (removeRow('notifications', id, 'notif:dismiss')) UI.toast('Notification dismissed.', 'info');
          });
        }
        if (act === 'open') {
          const n = Store.get('notifications', id);
          if (!n) return UI.toast('That notification is already gone.', 'warn');
          const target = notifTarget(n);
          if (!n.read) Store.ops.markRead(id);
          if (target.route === 'notifications') return UI.toast('This kind has no record page.', 'info');
          return go(target.route, target.id);
        }
        return false;
      });
    });
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  const ST_TABS = [
    { id: 'club', label: 'Club information' },
    { id: 'booking', label: 'Booking settings' },
    { id: 'memberships', label: 'Memberships' },
    { id: 'user', label: 'Appearance & data' }
  ];

  const clubFields = function (c) {
    return [
      { name: 'name', label: 'Club name', col: 1, value: c.name, required: true, placeholder: 'PickleMarawi' },
      { name: 'full', label: 'Full club name', col: 1, value: c.full, placeholder: 'Marawi City Pickleball Club' },
      { name: 'city', label: 'City', col: 1, value: c.city },
      { name: 'province', label: 'Province', col: 1, value: c.province },
      { name: 'phone', label: 'Phone', col: 1, value: c.phone, required: true, placeholder: '+63 64 555 0143' },
      { name: 'email', label: 'Email', col: 1, value: c.email, required: true, placeholder: 'play@piklemarawi.ph' },
      { name: 'address', label: 'Address', col: 2, value: c.address, required: true, placeholder: 'Cadre Road, Brgy. …' },
      { name: 'founded', label: 'Founded', col: 1, type: 'number', value: c.founded, min: 1900, max: 2100 },
      { name: 'tz', label: 'Time zone', col: 1, type: 'static', value: CLUB.tz }
    ];
  };

  const bookingFields = function (b) {
    return [
      { name: 'open', label: 'Courts open', col: 1, type: 'time', value: b.open },
      { name: 'close', label: 'Courts close', col: 1, type: 'time', value: b.close },
      { name: 'slotMinutes', label: 'Slot length (minutes)', col: 1, type: 'number', value: b.slotMinutes, min: 15, max: 120, step: 5 },
      { name: 'minHours', label: 'Minimum booking (hours)', col: 1, type: 'number', value: b.minHours, min: 1, max: 12 },
      { name: 'maxHours', label: 'Maximum booking (hours)', col: 1, type: 'number', value: b.maxHours, min: 1, max: 12 },
      { name: 'cancelHours', label: 'Cancellation window (hours)', col: 1, type: 'number', value: b.cancelHours, min: 0, max: 168 },
      { name: 'guestLimit', label: 'Guests per member', col: 1, type: 'number', value: b.guestLimit, min: 0, max: 8 },
      { name: 'holdMinutes', label: 'Pending hold (minutes)', col: 1, type: 'number', value: b.holdMinutes, min: 0, max: 120 },
      { name: 'taxPct', label: 'Tax on every quote (%)', col: 1, type: 'number', value: b.taxPct, min: 0, max: 50, step: 0.5 }
    ];
  };

  function tierFields(m) {
    return [
      { name: 'name', label: 'Tier name', col: 1, value: m.name, required: true, placeholder: 'Gold' },
      { name: 'term', label: 'Billing term', col: 1, type: 'select', value: m.term || 'Monthly',
        options: ['Monthly', 'Quarterly', 'Yearly'].map(function (v) { return { value: v, label: v }; }) },
      { name: 'price', label: 'Price (₱)', col: 1, type: 'number', value: m.price, min: 0, step: 50, required: true },
      { name: 'discount', label: 'Court discount (%)', col: 1, type: 'number', value: m.discount, min: 0, max: 90 },
      { name: 'benefits', label: 'Benefits', col: 2, type: 'textarea', rows: 4, required: true,
        value: (m.benefits || []).join('\n'), help: 'One benefit per line — the list prints on the membership page.' }
    ];
  }

  const EXPORTS = {
    players: {
      label: 'Players', cols: [
        { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' }, { label: 'Level', key: 'level' },
        { label: 'Membership', value: function (r) { return Store.tierName(r.membership); } },
        { label: 'Venue', key: 'venue' }, { label: 'Status', key: 'status' },
        { label: 'Rating', key: 'rating' }, { label: 'Joined', key: 'joined' }
      ],
      rows: function () { return Store.list('players'); }
    },
    bookings: {
      label: 'Bookings', cols: [
        { label: 'ID', key: 'id' },
        { label: 'Player', value: function (r) { return Store.sel.playerName(r.playerId); } },
        { label: 'Court', value: function (r) { return Store.sel.courtName(r.courtId); } },
        { label: 'Venue', value: function (r) { const c = Store.get('courts', r.courtId); return c ? Store.sel.venueName(c.venueId) : ''; } },
        { label: 'Date', key: 'date' }, { label: 'Start', key: 'start' }, { label: 'End', key: 'end' },
        { label: 'Hours', key: 'duration' }, { label: 'Format', key: 'format' }, { label: 'Players', key: 'players' },
        { label: 'Status', key: 'status' }, { label: 'Method', key: 'method' }, { label: 'Amount', key: 'amount' }
      ],
      rows: function () { return Store.list('bookings'); }
    },
    payments: {
      label: 'Payments', cols: [
        { label: 'Invoice', key: 'id' }, { label: 'Date', key: 'date' }, { label: 'Member', key: 'who' },
        { label: 'Kind', key: 'kind' }, { label: 'Item', key: 'item' }, { label: 'Method', key: 'method' },
        { label: 'Status', key: 'status' }, { label: 'Amount', key: 'amount' }, { label: 'Reference', key: 'ref' }
      ],
      rows: function () { return Store.list('payments'); }
    }
  };

  function exportCsv(keys) {
    let total = 0;
    keys.forEach(function (k) {
      const cfg = EXPORTS[k];
      const rows = cfg.rows();
      const n = UI.csv('piklemarawi-' + k + '-' + Store.today() + '.csv', cfg.cols, rows);
      total += n;
    });
    return total;
  }

  function membershipsTable(root, paint) {
    const host = root.querySelector('[data-sy-table="tiers"]');
    if (!host) return;
    UI.table(host, {
      id: 'sy-memberships',
      columns: [
        { key: 'name', label: 'Tier', sortable: true,
          render: function (r) {
            return '<div class="who">' + UI.avatar(r.name, '#6b7cff') +
              '<div><b>' + esc(r.name) + '</b><em>' + esc(r.id) + '</em></div></div>';
          } },
        { key: 'term', label: 'Term', sortable: true },
        { key: 'price', label: 'Price', align: 'right', sortable: true, sortValue: function (r) { return r.price; },
          render: function (r) { return '<span class="mono">' + (r.price ? money(r.price) : 'Free') + '</span>'; } },
        { key: 'discount', label: 'Discount', align: 'right', sortable: true, sortValue: function (r) { return r.discount; },
          render: function (r) { return '<span class="mono">' + r.discount + '%</span>'; } },
        { key: 'benefits', label: 'Benefits', render: function (r) {
            const extra = r.benefits.length > 2 ? ' <span class="dim">+' + (r.benefits.length - 2) + ' more</span>' : '';
            return '<span class="dim">' + r.benefits.slice(0, 2).map(esc).join(' · ') + '</span>' + extra;
          }, sortValue: function (r) { return r.benefits.length; } },
        { key: 'members', label: 'Players', align: 'right', sortable: true, sortValue: function (r) { return r.members; },
          render: function (r) { return '<b class="mono">' + r.members + '</b>'; } }
      ],
      rows: function () {
        return Store.settings.memberships.map(function (m, i) {
          return Object.assign({}, m, {
            idx: i,
            benefits: Array.isArray(m.benefits) ? m.benefits : String(m.benefits || '').split('\n').filter(Boolean),
            members: Store.list('players').filter(function (p) { return p.membership === m.id; }).length
          });
        });
      },
      rowId: function (r) { return r.id; },
      search: true, searchLabel: 'Search tiers…', per: 10, pages: true,
      emptyTitle: 'No membership tiers.',
      emptySub: 'Add one — the booking engine uses its discount on every quote.',
      rowActions: function () {
        return UI.actionBtn('edit', 'Edit this tier', '', 'pen') + UI.actionBtn('del', 'Delete this tier', 'danger', 'trash');
      },
      onAction: function (act, row) {
        if (!row) return;
        if (act === 'edit') return openTierForm(row.idx);
        return UI.confirm({
          title: 'Delete ' + row.name + '?',
          body: 'The tier is removed from memberships and pricing.',
          detail: row.members + ' player(s) sit on it now — the club refuses the delete until they move to another tier.',
          okLabel: 'Delete tier', cancelLabel: 'Keep it', danger: true
        }).then(function (ok) {
          if (!ok) return false;
          const res = Store.ops.membershipRemove(row.idx);
          if (!res.ok) return UI.toast(errText(res, 'That tier could not be removed.'), 'err');
          UI.toast(row.name + ' membership removed.', 'info');
          paint();
        });
      }
    });
  }

  function openTierForm(index) {
    const tier = index === -1
      ? { id: '', name: '', price: 0, term: 'Monthly', discount: 0, benefits: [] }
      : Store.settings.memberships[index];
    if (!tier) return UI.toast('That membership tier is gone.', 'warn');
    UI.formModal({
      title: index === -1 ? 'New membership tier' : 'Edit ' + tier.name,
      sub: 'Price, discount and benefits used across bookings and receipts',
      fields: tierFields(tier),
      submitLabel: index === -1 ? 'Create tier' : 'Save tier',
      onSubmit: function (vals) {
        const res = Store.ops.membershipUpsert(index, {
          id: index === -1 ? '' : tier.id, name: vals.name, term: vals.term,
          price: num(vals.price, 0), discount: num(vals.discount, 0), benefits: vals.benefits
        });
        if (!res.ok) return res;
        return { ok: true, message: String(vals.name).trim() + (index === -1 ? ' tier created.' : ' membership saved.') };
      }
    });
  }

  function settingsTabBody() {
    const s = Store.settings;
    if (vs.settingsTab === 'club') {
      return panel('Club information', 'Printed on receipts, reports and the public listing',
        '<div data-sy-form="club">' + UI.formHtml(clubFields(s.club)) + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:18px">' +
        syBtn('save-club', 'Save club information', 'primary', 'check') +
        syBtn('revert', 'Discard changes', 'ghost', 'refresh') + '</div>' +
        note('Validation is enforced by the club record itself: the email and phone must be valid, the name and address cannot be blank.'));
    }

    if (vs.settingsTab === 'booking') {
      const b = s.booking;
      const slots = Math.max(0, Math.floor((Store.mins(b.close) - Store.mins(b.open)) / (num(b.slotMinutes, 60) || 60)));
      const court = Store.list('courts').slice().sort(function (x, y) { return y.pricePerHour - x.pricePerHour; })[0];
      const player = Store.list('players').find(function (p) { return p.membership && num((s.memberships.find(function (m) { return m.id === p.membership; }) || {}).price, 0) > 0; });
      const hours = Math.min(2, num(b.maxHours, 2));
      const quote = court ? Store.ops.quotePrice(court, player, hours) : null;
      const tier = player ? Store.tierName(player.membership) : 'Starter';
      const upcoming = Store.list('bookings').filter(function (x) { return x.date >= Store.today() && ['confirmed', 'pending'].indexOf(x.status) > -1; }).length;

      return panel('Booking settings', 'The rules every new booking is measured against',
        '<div data-sy-form="booking">' + UI.formHtml(bookingFields(b)) + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:18px">' +
        syBtn('save-booking', 'Save booking rules', 'primary', 'check') +
        syBtn('revert', 'Discard changes', 'ghost', 'refresh') + '</div>' +
        '<div class="tiles" style="margin-top:20px">' +
        tile('Bookable slots per court per day', slots) +
        tile('Longest single booking', num(b.maxHours, 3) + 'h') +
        tile('Tax added to every quote', num(b.taxPct, 0) + '%') +
        tile('Upcoming bookings held', upcoming) +
        '</div>' +
        note('<b>These are the rules the booking engine enforces.</b> When a slot is created the club checks the opening and closing time, the minimum and maximum duration, the court’s status and any double booking before it is accepted, then prices it with the tier discount and this tax. ' +
          (quote ? 'Right now ' + esc(court.name) + ' for ' + hours + 'h for a ' + esc(tier) + ' member quotes at ' +
            esc(money(quote.gross)) + ' − ' + esc(money(quote.discount)) + ' discount + ' + esc(money(quote.tax)) + ' tax = <b>' + esc(money(quote.total)) + '</b>. ' : '') +
          'Hold time, guest limit and the cancellation window are the desk policy members see when they book.'));
    }

    if (vs.settingsTab === 'memberships') {
      const tiers = s.memberships;
      const priced = tiers.filter(function (m) { return num(m.price, 0) > 0; }).length;
      return panel('Memberships', 'Tiers, prices and the discount applied to every court quote',
        '<div class="tiles" style="margin-bottom:18px">' +
        tile('Tiers', tiers.length) + tile('Paid tiers', priced) +
        tile('Players on a tier', Store.list('players').filter(function (p) { return !!p.membership; }).length) +
        '</div>' +
        '<div data-sy-table="tiers"></div>' +
        note('A tier that still has players on it cannot be deleted — move those members first. The discount on a tier is what every quote for its members is priced with.'),
        syBtn('add-tier', 'Add tier', 'primary', 'plus'));
    }

    const theme = (typeof PMSTATE === 'function' ? PMSTATE().theme : s.user.theme) || 'light';
    const prefs = [
      ['notifyBooking', 'Booking alerts', 'Every new or moved booking'],
      ['notifyPayment', 'Payment alerts', 'Settled, pending and refunded invoices'],
      ['notifyMatch', 'Match alerts', 'Results and ladder movement'],
      ['notifyMarketing', 'Club announcements', 'Events, clinics and outreach']
    ];
    return '<div class="grid">' +
      panel('Appearance', 'The theme the whole shell opens in',
        '<div class="page-tools">' + UI.seg([{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }], theme, 'data-sy-theme') + '</div>' +
        '<div class="stack" style="margin-top:18px">' + prefs.map(function (p) {
          return '<label class="switch"><input type="checkbox" data-sy-pref="' + p[0] + '"' + (s.user[p[0]] ? ' checked' : '') + '><i></i><span>' +
            esc(p[1]) + ' — ' + esc(p[2]) + '</span></label>';
        }).join('') + '</div>') +
      panel('Data', 'Export the ledger, or put the demo club back the way it shipped',
        '<div class="page-tools">' +
        syBtn('export', 'Export players (CSV)', 'ghost', 'download', 'players') +
        syBtn('export', 'Export bookings (CSV)', 'ghost', 'download', 'bookings') +
        syBtn('export', 'Export payments (CSV)', 'ghost', 'download', 'payments') +
        syBtn('export', 'Export everything (CSV)', 'accent', 'download', 'all') + '</div>' +
        '<div class="tiles" style="margin:18px 0">' +
        tile('Players', Store.list('players').length) +
        tile('Bookings', Store.list('bookings').length) +
        tile('Payments', Store.list('payments').length) +
        tile('Courts', Store.list('courts').length) + '</div>' +
        syBtn('reset', 'Reset demo data', 'danger', 'refresh') +
        note('Exports are live CSV files of exactly what the tables show. Resetting rebuilds every record from the club seed and clears the changes held in this browser.')) +
      '</div>';
  }

  function settingsHtml() {
    return head('Settings', 'Club profile, booking rules, memberships and data — everything here is stored, not displayed',
      syBtn('help', 'Help centre', 'ghost', 'help', null)) +
      '<div style="margin-bottom:18px">' + UI.seg(ST_TABS, vs.settingsTab, 'data-sy-tab') + '</div>' +
      settingsTabBody();
  }

  function settingsPage(host) {
    page(host, settingsHtml, function (e, root, repaint) {
      const tab = e.target.closest('[data-sy-tab]');
      if (tab) { vs.settingsTab = tab.dataset.syTab; return repaint(); }
      const themeBtn = e.target.closest('[data-sy-theme]');
      if (themeBtn) return applyTheme(themeBtn.dataset.syTheme, repaint);
      run(root, e, function (act, id) {
        if (act === 'help') return go('help');
        if (act === 'revert') { repaint(); return UI.toast('Form reset to what the club has saved.', 'info'); }
        if (act === 'save-club') return saveGroup('club', root, '[data-sy-form="club"]');
        if (act === 'save-booking') return saveGroup('booking', root, '[data-sy-form="booking"]');
        if (act === 'add-tier') return openTierForm(-1);
        if (act === 'export') {
          const keys = id === 'all' ? ['players', 'bookings', 'payments'] : [id];
          const total = exportCsv(keys);
          return UI.toast(total ? total + ' row(s) exported to ' + keys.length + ' CSV file(s).' : 'There is nothing to export yet.', total ? 'ok' : 'warn');
        }
        if (act === 'reset') {
          return UI.confirm({
            title: 'Reset the demo data?',
            body: 'Every player, booking, payment, match and notification is rebuilt from the club seed.',
            detail: 'Settings you changed here are reset too. This only touches this browser’s copy of the club.',
            okLabel: 'Reset everything', cancelLabel: 'Keep my data', danger: true
          }).then(function (ok) {
            if (!ok) return false;
            Store.reset();
            UI.toast('Demo data rebuilt from the club seed.', 'ok');
          });
        }
        return false;
      });
    }, function (root, paint) {
      if (vs.settingsTab === 'memberships') membershipsTable(root, paint);
      const form = root.querySelector('[data-sy-form]');
      if (form) form.addEventListener('change', function () {
        root.querySelectorAll('[data-sy-form] .err').forEach(function (b) { b.hidden = true; });
        root.querySelectorAll('[data-sy-form] .field').forEach(function (f) { f.classList.remove('has-error'); });
      });
      root.addEventListener('change', function (e) {
        const pref = e.target.closest('[data-sy-pref]');
        if (!pref) return;
        const patch = {};
        patch[pref.dataset.syPref] = pref.checked;
        const res = Store.ops.saveSettings('user', Object.assign({}, Store.settings.user, patch));
        UI.toast(res.ok ? 'Preference saved.' : errText(res, 'Could not save that preference.'), res.ok ? 'ok' : 'err');
      });
    });
  }

  function saveGroup(group, root, sel) {
    const form = root.querySelector(sel);
    if (!form) return;
    const raw = UI.readForm(form);
    let values = raw;
    if (group === 'club') values = Object.assign({}, raw, { founded: num(raw.founded, Store.settings.club.founded) });
    if (group === 'booking') {
      values = {
        open: raw.open, close: raw.close,
        slotMinutes: num(raw.slotMinutes, 60), minHours: num(raw.minHours, 1), maxHours: num(raw.maxHours, 3),
        cancelHours: num(raw.cancelHours, 0), guestLimit: num(raw.guestLimit, 0),
        holdMinutes: num(raw.holdMinutes, 15), taxPct: num(raw.taxPct, 0)
      };
    }
    const res = Store.ops.saveSettings(group, values);
    if (!res.ok) {
      UI.paintErrors(form, res.errors || {});
      return UI.toast(errText(res, 'Check the highlighted fields.'), 'err');
    }
    return UI.toast(group === 'club' ? 'Club information saved.' : 'Booking rules saved — the booking engine uses them from now on.');
  }

  /* the shell reads PMSTATE().theme on every apply(), so the router state moves
     first — otherwise the next paint would revert the theme */
  function applyTheme(next, repaint) {
    const shell = typeof PMSTATE === 'function' ? PMSTATE() : null;
    if (shell) shell.theme = next;
    document.documentElement.dataset.theme = next;
    const res = Store.ops.saveSettings('user', Object.assign({}, Store.settings.user, { theme: next }));
    if (!res.ok) {
      repaint();
      return UI.toast(errText(res, 'Theme changed for this session only — the club profile could not be saved.'), 'err');
    }
    return UI.toast(next === 'dark' ? 'Dark theme saved.' : 'Light theme saved.');
  }

  /* ============================================================
     HELP CENTRE
     ============================================================ */
  const FAQ = [
    { q: 'How does a court booking get made?', tag: 'Booking', route: 'booking',
      a: 'Open Book a Court, pick a free slot on the grid and confirm the player, court, date, start time and duration. The club checks the slot before it accepts anything: it must sit inside the opening and closing hours, be between the minimum and maximum duration, land on a court that is not under maintenance and not clash with a booking that is already confirmed or pending. A confirmed booking is charged and paid for in one step; a pending one holds the slot with an unpaid invoice.' },
    { q: 'What decides the price on a booking?', tag: 'Booking', route: 'settings',
      a: 'Court price per hour × hours, minus the member’s tier discount, plus the tax percentage from Settings → Booking settings. The same figure is written onto the booking and the invoice it creates, so the ledger and the grid can never disagree.' },
    { q: 'What happens when I cancel a booking?', tag: 'Booking', route: 'booking',
      a: 'The slot is released immediately, the linked paid invoice flips to refunded, the cancellation is written to the club activity log and a notification lands in the inbox. Booking invoices cannot be deleted from the Payments page — cancelling the booking is the only way to move that money.' },
    { q: 'Why did a court’s upcoming bookings disappear?', tag: 'Courts', route: 'courts',
      a: 'Setting a court to maintenance releases every upcoming confirmed booking on it so members can be rebooked elsewhere. That is deliberate: nobody should hold a slot on a court that cannot be played.' },
    { q: 'How are payments settled and checked?', tag: 'Money', route: 'payments',
      a: 'Every payment carries a status: paid, pending, refunded or failed. Settling a pending booking invoice also confirms the booking it belongs to, so an unpaid hold becomes a live court booking the moment the money clears. Receipts print from the Payments row.' },
    { q: 'How do brackets and draws work?', tag: 'Tournaments', route: 'tournaments',
      a: 'Register teams first — the club blocks a full draw, a duplicate team name and a player entered on two teams. Entry fees are collected as paid invoices. When you draw the bracket, a single-elimination event becomes a seeded draw with byes; a round robin becomes a full fixture list plus a standings table that updates itself from results.' },
    { q: 'Can I type who won a match?', tag: 'Matches', route: 'matches',
      a: 'No. You enter the two scores and the winner is derived, which keeps the bracket honest. The score must be a real game: played to the match’s game-to, never tied, and won by two points once the game reaches the ceiling. The winner then advances automatically and ladder points move (+120 for the winner, +20 for the loser).' },
    { q: 'Where do notifications come from?', tag: 'System', route: 'notifications',
      a: 'Every operation that changes the club writes one: bookings, payments, results, court status, registrations, memberships and settings. The bell in the top bar counts unread rows live, the inbox filters by unread, important or kind, and each row deep-links to the record it talks about.' },
    { q: 'Which settings actually change behaviour?', tag: 'System', route: 'settings',
      a: 'Booking hours and durations gate every new booking. The tax and tier discounts drive every quote. Club details print on receipts and reports. Membership tiers change what existing members pay next time they book. Everything is validated on save and rejected with the reason next to the field.' },
    { q: 'How do I get data out of the club?', tag: 'System', route: 'settings',
      a: 'Settings → Appearance & data exports players, bookings or payments as CSV, or all three at once. Reports print from their own page. Reset demo data rebuilds the whole club from the shipped seed.' },
    { q: 'When should outdoor decks be called off?', tag: 'Weather', route: 'weather',
      a: 'Court weather flags every outdoor deck whose rain probability for the day passes 50%. Indoor acrylic courts are unaffected. From that page you can flag a court for maintenance, which releases its upcoming bookings.' },
    { q: 'What is the difference between clinics and drills?', tag: 'Community', route: 'drills',
      a: 'Clinics are coached programs with limited seats you enrol members into. Daily drills are the homework list — ticking one records it against today only, and reset day clears the list for a new day.' }
  ];

  const SHORTCUTS = [
    ['/', 'Jump to the global search box'],
    ['t', 'Toggle the light and dark theme'],
    ['v', 'Switch the dashboard between the Court and Clay layouts'],
    ['1 – 7', 'Jump to the Play group: Dashboard, Courts, Book a Court, Schedule, Matches, Tournaments, Leagues'],
    ['Enter', 'In global search, open the first result · in a message thread, send'],
    ['Esc', 'Close the dialog in front']
  ];

  function faqItem(f) {
    return '<details style="border-bottom:1px solid var(--line);padding:14px 0">' +
      '<summary style="cursor:pointer;font-weight:700;font-size:14px;list-style:none;display:flex;justify-content:space-between;gap:12px">' +
      esc(f.q) + '<span class="dim">' + esc(f.tag) + ' ' + icon('chevron-down', 16) + '</span></summary>' +
      '<p style="margin:12px 0 0;font-size:13px;line-height:1.65;color:var(--ink-2)">' + esc(f.a) + '</p>' +
      '<div style="margin-top:12px"><button class="linkish" data-goto="' + f.route + '">Open ' + esc(labelFor(f.route)) + '</button></div>' +
      '</details>';
  }

  function labelFor(route) {
    let out = route;
    NAV.some(function (g) {
      const hit = g.items.find(function (i) { return i.id === route; });
      if (hit) { out = hit.label; return true; }
      return false;
    });
    return out;
  }

  function helpHtml() {
    const c = Store.settings.club;
    const u = Store.settings.user;
    const links = ['booking', 'courts', 'members', 'payments', 'tournaments', 'matches', 'notifications', 'settings', 'weather', 'drills'];
    const contact = '<dl class="kv">' +
      '<dt>Club</dt><dd>' + esc(c.full) + ' (' + esc(c.name) + ')</dd>' +
      '<dt>Where</dt><dd>' + esc(c.address) + '</dd>' +
      '<dt>City</dt><dd>' + esc(c.city) + ', ' + esc(c.province) + '</dd>' +
      '<dt>Phone</dt><dd>' + esc(c.phone) + '</dd>' +
      '<dt>Email</dt><dd>' + esc(c.email) + '</dd>' +
      '<dt>Founded</dt><dd>' + esc(c.founded) + '</dd>' +
      '<dt>Time zone</dt><dd>' + esc(CLUB.tz) + '</dd>' +
      '<dt>Your admin</dt><dd>' + esc(u.name) + ' · ' + esc(u.role) + '</dd>' +
      '</dl>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">' +
      '<a class="pill-btn primary" href="tel:' + esc(String(c.phone).replace(/\s/g, '')) + '">' + icon('phone', 15) + 'Call the club desk</a>' +
      '<a class="pill-btn ghost" href="mailto:' + esc(c.email) + '">' + icon('mail', 15) + 'Email ' + esc(c.email) + '</a>' +
      '</div>';

    const shortcuts = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:120px">Key</th><th>What it does</th></tr></thead><tbody>' +
      SHORTCUTS.map(function (s) {
        return '<tr><td><span class="mono">' + esc(s[0]) + '</span></td><td>' + esc(s[1]) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    return head('Help Centre', 'How booking, payments, brackets and notifications behave in this club',
      syBtn('message', 'Message the desk', 'ghost', 'message', null)) +
      '<div class="split">' +
      '<div class="grid">' +
      panel('Search the help centre', FAQ.length + ' answers, written for this club',
        '<label class="dt-search" style="margin-bottom:14px">' + icon('search', 16) +
        '<input type="search" data-sy-q placeholder="Search: bracket, refund, maintenance…" aria-label="Search help"></label>' +
        '<div data-sy-faq-list>' + FAQ.map(faqItem).join('') + '</div>' +
        '<div data-sy-faq-empty hidden>' + UI.empty('help', 'No answer matches that.', 'Try a shorter word — booking, payment, bracket, weather, settings.') + '</div>') +
      panel('Keyboard', 'The shell binds these anywhere outside a text field', shortcuts) +
      '</div>' +
      '<div class="grid">' +
      panel('Jump to', 'Straight to the page that does the job',
        '<div class="chips">' + links.map(function (r) {
          return '<button class="chip" data-goto="' + r + '">' + esc(labelFor(r)) + '</button>';
        }).join('') + '</div>') +
      panel('Contact the club', 'The details stored in Settings → Club information', contact) +
      panel('Still stuck?', 'Ask the committee',
        '<p class="dim" style="margin:0 0 14px;font-size:13.5px">Court notes are how the club writes things down for the next shift — leave the question there and it stays with the board.</p>' +
        syBtn('note', 'Write a court note', 'accent', 'notebook') + ' ' + syBtn('help-drills', 'How drills and clinics work', 'ghost', 'book', null)) +
      '</div>' +
      '</div>';
  }

  function helpPage(host) {
    page(host, helpHtml, function (e, root) {
      run(root, e, function (act) {
        if (act === 'note') return go('notes', 'new');
        if (act === 'message') return go('messages');
        if (act === 'help-drills') return go('drills');
        return false;
      });
    }, function (root) {
      const input = root.querySelector('[data-sy-q]');
      const list = root.querySelector('[data-sy-faq-list]');
      const empty = root.querySelector('[data-sy-faq-empty]');
      if (!input) return;
      const apply = function () {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        Array.prototype.forEach.call(list.children, function (node, i) {
          const f = FAQ[i];
          const hit = !q || (f.q + ' ' + f.a + ' ' + f.tag).toLowerCase().indexOf(q) > -1;
          node.style.display = hit ? '' : 'none';
          if (hit) { shown++; node.open = !!q; }
        });
        empty.hidden = shown > 0;
      };
      input.addEventListener('input', apply);
    });
  }

  /* ============================================================
     COURT WEATHER
     ============================================================ */
  const RAIN_LIMIT = 50;
  const COURT_LABEL = { available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance', reserved: 'Reserved' };

  function weatherTodayIndex() { return (new Date().getDay() + 6) % 7; }
  function isOutdoor(court) { return String(court.type || '').toLowerCase().indexOf('outdoor') > -1; }

  function courtRows() {
    const rain = WEATHER.rain[weatherTodayIndex()];
    return Store.list('courts').map(function (c) {
      const status = Store.sel.courtStatusNow(c);
      const outdoor = isOutdoor(c);
      return Object.assign({}, c, {
        statusNow: status,
        outdoor: outdoor,
        atRisk: outdoor && rain > RAIN_LIMIT,
        bookedToday: Store.sel.bookingsFor(c.id, Store.today()).length
      });
    });
  }

  function weatherHtml() {
    const courts = courtRows();
    const idx = weatherTodayIndex();
    const rainToday = WEATHER.rain[idx];
    const outdoor = courts.filter(function (c) { return c.outdoor; });
    const counts = { available: 0, occupied: 0, reserved: 0, maintenance: 0 };
    courts.forEach(function (c) { counts[c.statusNow] = (counts[c.statusNow] || 0) + 1; });
    const atRisk = outdoor.filter(function (c) { return c.atRisk; });

    const tiles = '<div class="tiles" style="margin-bottom:20px">' +
      tile('Open right now', counts.available) +
      tile('In play', counts.occupied) +
      tile('Held later today', counts.reserved) +
      tile('Under maintenance', counts.maintenance) +
      tile('Outdoor decks', outdoor.length) +
      tile('At rain risk', atRisk.length) + '</div>';

    const today = panel('Today over ' + Store.settings.club.city, WEATHER.today.cond,
      '<div class="split" style="align-items:center">' +
      '<div><div style="font-size:52px;font-weight:700;letter-spacing:-.04em">' + WEATHER.today.temp + '°C</div>' +
      '<div class="dim" style="font-size:13.5px">' + esc(WEATHER.labels[idx]) + ' · ' + rainToday + '% rain chance</div></div>' +
      '<dl class="kv">' +
      '<dt>Wind</dt><dd>' + WEATHER.today.wind + ' km/h</dd>' +
      '<dt>Humidity</dt><dd>' + WEATHER.today.hum + '%</dd>' +
      '<dt>UV index</dt><dd>' + WEATHER.today.uv + '</dd>' +
      '<dt>Air quality</dt><dd>' + WEATHER.today.air + ' AQI</dd>' +
      '<dt>High / low</dt><dd>' + WEATHER.high[idx] + '° / ' + WEATHER.low[idx] + '°</dd>' +
      '</dl></div>' +
      note(rainToday > RAIN_LIMIT
        ? '<b>' + outdoor.length + ' outdoor deck(s) are above the ' + RAIN_LIMIT + '% rain threshold.</b> Indoor acrylic courts are unaffected — move the sessions there or flag the wet courts for maintenance.'
        : 'Rain chance is under the ' + RAIN_LIMIT + '% threshold, so the open-air courts stay playable.'));

    const week = panel('Week ahead', 'Rain probability against the play threshold',
      CH.bars({ data: WEATHER.rain, labels: WEATHER.labels, hot: idx, h: 230 }) +
      '<div style="margin-top:14px">' + CH.weather({ labels: WEATHER.labels, high: WEATHER.high, low: WEATHER.low, rain: WEATHER.rain }) + '</div>' +
      note('Bars are the chance of rain each day; the highlighted bar is today. The line chart is the temperature envelope the decks dry inside.'));

    const byVenue = VENUES.map(function (v) {
      const cs = courts.filter(function (c) { return c.venueId === v.id; });
      if (!cs.length) return null;
      const openNow = cs.filter(function (c) { return c.statusNow === 'available'; }).length;
      const risky = cs.filter(function (c) { return c.atRisk; });
      return '<div class="row"><span class="slab' + (risky.length ? ' tint' : '') + '">' + icon(risky.length ? 'cloud' : 'court', 18) + '</span>' +
        '<div class="grow"><div class="t1">' + esc(v.name) + '</div>' +
        '<div class="t2">Brgy. ' + esc(v.barangay) + ' · ' + cs.length + ' court(s) · ' + openNow + ' free right now · ' +
        esc(v.indoor ? 'Indoor acrylic' : 'Open air') + '</div>' +
        '<div class="progress"><i style="width:' + Math.round(openNow / cs.length * 100) + '%"></i></div></div>' +
        '<div style="display:flex;gap:8px;align-items:center;flex:0 0 auto">' +
        UI.badge(risky.length ? 'pending' : 'available', risky.length ? risky.length + ' at risk' : 'Play on') +
        '<button class="linkish" data-goto="courts">Courts</button></div></div>';
    }).filter(Boolean).join('');

    const table = '<div data-sy-table="courts"></div>';

    return head('Court Weather', 'Play decisions for the open-air decks · ' + rainToday + '% rain chance today',
      syBtn('refresh', 'Re-check now', 'ghost', 'refresh', null)) +
      tiles +
      '<div class="split" style="margin-bottom:22px">' + today + week + '</div>' +
      '<div class="grid">' +
      panel('Venue by venue', 'Which venues have courts playable in this weather',
        byVenue || UI.empty('globe', 'No courts registered.', 'Add a court and it appears here with its live status.')) +
      panel('Court by court', 'Live status from the grid, with the rain call applied to outdoor decks', table) +
      '</div>';
  }

  function weatherCourtTable(root) {
    const host = root.querySelector('[data-sy-table="courts"]');
    if (!host) return;
    const rain = WEATHER.rain[weatherTodayIndex()];
    UI.table(host, {
      id: 'sy-weather-courts',
      columns: [
        { key: 'name', label: 'Court', sortable: true,
          render: function (r) { return '<b>' + esc(r.name) + '</b><div class="t2">Court ' + esc(r.number) + '</div>'; } },
        { key: 'venueId', label: 'Venue', sortable: true, sortValue: function (r) { return Store.sel.venueName(r.venueId); },
          render: function (r) { return '<span class="dim">' + esc(Store.sel.venueName(r.venueId)) + '</span>'; } },
        { key: 'type', label: 'Surface', sortable: true,
          render: function (r) { return esc(r.type) + (r.floodlit ? ' <span class="dim">· floodlit</span>' : ''); } },
        { key: 'statusNow', label: 'Right now', sortable: true,
          render: function (r) { return UI.badge(r.statusNow, COURT_LABEL[r.statusNow] || r.statusNow); } },
        { key: 'bookedToday', label: 'Booked today', align: 'right', sortable: true,
          render: function (r) { return '<span class="mono">' + r.bookedToday + '</span>'; } },
        { key: 'atRisk', label: 'Rain call', sortable: true, sortValue: function (r) { return r.atRisk ? 1 : 0; },
          render: function (r) {
            if (!r.outdoor) return '<span class="dim">Covered · ' + rain + '%</span>';
            return UI.badge(r.atRisk ? 'pending' : 'available', rain + '% rain · ' + (r.atRisk ? 'at risk' : 'playable'));
          } }
      ],
      rows: courtRows,
      rowId: function (r) { return r.id; },
      search: true, searchLabel: 'Search courts…', per: 10, pages: true,
      filters: [{ key: 'outdoor', label: 'Every surface', options: [{ value: 'true', label: 'Outdoor only' }, { value: 'false', label: 'Indoor only' }] }],
      emptyTitle: 'No courts match.',
      emptySub: 'Clear the surface filter to see the whole list.',
      rowActions: function (r) {
        return r.statusNow === 'maintenance'
          ? UI.actionBtn('reopen', 'Reopen this court', '', 'check')
          : UI.actionBtn('flag', 'Flag this court for maintenance', 'danger', 'wind');
      },
      onAction: function (act, row) {
        if (!row) return;
        if (act === 'flag') return flagCourt(row);
        return UI.confirm({
          title: 'Reopen ' + row.name + '?',
          body: 'The court goes back on the grid as available so members can book it again.',
          detail: 'Nothing is refunded or cancelled by reopening a court.',
          okLabel: 'Reopen court', cancelLabel: 'Leave it closed'
        }).then(function (ok) {
          if (!ok) return false;
          const res = Store.ops.setCourtStatus(row.id, 'available', 'Reopened — decks dry and lines checked');
          UI.toast(res.ok ? row.name + ' is bookable again.' : 'That court could not be reopened.', res.ok ? 'ok' : 'err');
        });
      }
    });
  }

  /* the store releases the court's upcoming confirmed bookings but does not
     refund them, so the confirm text only ever claims the slot is freed */
  function flagCourt(row) {
    const released = Store.list('bookings').filter(function (b) {
      return b.courtId === row.id && b.date >= Store.today() && b.status === 'confirmed';
    });
    UI.confirm({
      title: 'Flag ' + row.name + ' for maintenance?',
      body: 'The court leaves the grid immediately, so nobody can book it while it is wet or being worked on.',
      detail: 'This call releases ' + released.length + ' upcoming confirmed booking(s) on ' + row.name +
        ' — they are cancelled and the members can be rebooked on another court. ' +
        'Rain chance today is ' + WEATHER.rain[weatherTodayIndex()] + '%.',
      okLabel: 'Close the court', cancelLabel: 'Keep it open', danger: true
    }).then(function (ok) {
      if (!ok) return false;
      const res = Store.ops.setCourtStatus(row.id, 'maintenance', 'Rain risk — outdoor decks closed to dry and be checked');
      if (!res.ok) return UI.toast('That court could not be closed.', 'err');
      return UI.toast(row.name + ' is under maintenance · ' + released.length + ' booking(s) released.', 'warn');
    });
  }

  function weatherPage(host) {
    page(host, weatherHtml, function (e, root, repaint) {
      run(root, e, function (act) {
        if (act === 'refresh') { repaint(); return UI.toast('Weather and court status re-checked.', 'info'); }
        return false;
      });
    }, function (root) {
      weatherCourtTable(root);
    });
  }

  /* ============================================================
     COURT NOTES
     ============================================================ */
  const NOTE_TAGS = ['General', 'League', 'Maintenance', 'Pro Shop', 'Venues', 'Booking', 'Match', 'Community'];
  const TAG_TONE = {
    General: '#3aa9e0', League: '#ef4b56', Maintenance: '#f4a036', 'Pro Shop': '#6b7cff',
    Venues: '#2fb37c', Booking: '#e0607e', Match: '#8b7cf6', Community: '#5f7ae0'
  };
  /* the board shipped with the club as plain markup; it has no store ids, so it
     is kept as its own list until an admin imports a card onto the real board */
  const legacyNotes = NOTES.slice();

  function legacyAgo(when) {
    let minsAgo = 60;
    if (/yesterday/i.test(when)) minsAgo = 1440;
    else {
      const n = Number(String(when).replace(/[^0-9]/g, ''));
      if (/min/i.test(when)) minsAgo = n || 1;
      else if (/h/i.test(when)) minsAgo = (n || 1) * 60;
      else if (/d/i.test(when)) minsAgo = (n || 1) * 1440;
    }
    return new Date(Date.now() - minsAgo * 60000).toISOString();
  }

  /* store notes carry the tag the composer wrote; the activity log line
     addNote() also writes has no tag, so it stays off the board */
  function storeNotes() {
    return Store.list('activity').filter(function (a) { return a.kind === 'note' && !!a.tag; })
      .map(function (a) { return { id: a.id, title: a.text, tag: a.tag, at: a.at, stored: true }; });
  }

  function notesAll() {
    const mine = storeNotes();
    const seed = legacyNotes.map(function (n, i) {
      return { id: 'legacy-' + i, title: n.title, tag: n.tag, at: legacyAgo(n.when), tone: n.tone, stored: false };
    });
    return mine.concat(seed).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }

  function noteCard(n) {
    const tone = n.tone || TAG_TONE[n.tag] || '#6b7cff';
    return '<article class="note" style="background:var(--card-solid)">' +
      '<div class="grip"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<span class="when">' + icon('clock', 12) + esc(UI.relTime(n.at)) + '</span>' +
      '<div style="display:flex;gap:6px">' +
      (n.stored
        ? syIcon('del-note', n.id, 'Delete this note', 'trash', 'danger')
        : syIcon('import', n.id, 'Save this note to the board', 'bookmark') + syIcon('drop', n.id, 'Remove this old card', 'x', 'danger')) +
      '</div></div>' +
      '<h4>' + esc(n.title) + '</h4>' +
      '<span class="tag"><i style="background:' + tone + '"></i>' + esc(n.tag) + '</span>' +
      (n.stored ? '' : ' <span class="dim" style="font-size:11px">· old board</span>') +
      '</article>';
  }

  function notesHtml() {
    const all = notesAll();
    const stored = all.filter(function (n) { return n.stored; }).length;
    const tags = [];
    all.forEach(function (n) { if (tags.indexOf(n.tag) < 0) tags.push(n.tag); });
    const shown = vs.noteTag ? all.filter(function (n) { return n.tag === vs.noteTag; }) : all;

    const tagOptions = NOTE_TAGS.map(function (t) { return { value: t, label: t }; });
    const compose = '<div class="grid" style="grid-template-columns:minmax(0,1fr) 190px auto;gap:12px;align-items:end">' +
      '<div class="field span-2" style="grid-column:auto"><label for="sy-note">New court note</label>' +
      '<input id="sy-note" type="text" data-sy-note-input maxlength="160" placeholder="C3 needs a line repaint before the Saturday clinic…">' +
      '<em>Enter saves it straight to the board.</em></div>' +
      '<div class="field"><label for="sy-note-tag">Tag</label><select id="sy-note-tag">' +
      tagOptions.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>'; }).join('') +
      '</select></div>' +
      syBtn('add', 'Pin to board', 'primary', 'plus') + '</div>';

    const chips = '<div class="chips">' + chip('tag', '', 'Every tag', vs.noteTag === '') +
      tags.map(function (t) { return chip('tag', t, t, vs.noteTag === t); }).join('') + '</div>';

    const grid = shown.length
      ? '<div class="grid g-3">' + shown.map(noteCard).join('') + '</div>'
      : UI.empty('notebook', 'Nothing on the board with that tag.',
        'Write the first one above — notes are how the next shift knows what happened.',
        '<button class="pill-btn ghost" data-sy-act="tag" data-sy-id="">Show every tag</button>');

    return head('Court Notes', 'What the desk, the coaches and the grounds crew need to hand over',
      syBtn('quick', 'New note', 'primary', 'plus')) +
      '<div class="grid" style="margin-bottom:20px">' +
      panel('Compose', 'Notes are written to the club activity board, not a scratch pad', compose) +
      '</div>' +
      panel('The board', all.length + ' note(s) · ' + stored + ' on the club board, ' + (all.length - stored) + ' carried over from the old one',
        chips + '<div style="margin-top:16px">' + grid + '</div>' +
        note('Cards marked <b>old board</b> came with the club as static notes. Save one to the board and it becomes a real note you can delete, with the author and time kept.'));
  }

  /* carried-over cards are addressed by their position in legacyNotes, which is
     renumbered on every paint, so the id is only valid for the current draw */
  function legacyIndex(id) {
    const at = Number(String(id).replace('legacy-', ''));
    return isFinite(at) && at >= 0 && at < legacyNotes.length ? at : -1;
  }

  function notesPage(host) {
    page(host, notesHtml, function (e, root, repaint) {
      run(root, e, function (act, id) {
        if (act === 'tag') { vs.noteTag = id || ''; return repaint(); }
        if (act === 'quick') return openQuickNote();
        if (act === 'add') {
          const input = root.querySelector('[data-sy-note-input]');
          const tagSel = root.querySelector('#sy-note-tag');
          const res = Store.ops.addNote(input.value, tagSel.value);
          if (!res.ok) return UI.toast(errText(res, 'Write the note first.'), 'err');
          vs.noteFocus = true;
          return UI.toast('Note pinned to the board.');
        }
        if (act === 'del-note') {
          const row = Store.get('activity', id);
          return UI.confirm({
            title: 'Delete this note?', body: 'It comes off the court notes board.',
            detail: row ? row.text : '', okLabel: 'Delete note', cancelLabel: 'Keep it', danger: true
          }).then(function (ok) {
            if (!ok) return false;
            if (removeRow('activity', id, 'note:delete')) UI.toast('Note deleted.', 'info');
          });
        }
        if (act === 'import') {
          const at = legacyIndex(id);
          if (at < 0) return UI.toast('That card is already off the board.', 'warn');
          const n = legacyNotes[at];
          const res = Store.ops.addNote(n.title, n.tag);
          if (!res.ok) return UI.toast(errText(res, 'That note could not be saved.'), 'err');
          legacyNotes.splice(at, 1);
          return UI.toast('Imported to the club board — it is now a real note.');
        }
        if (act === 'drop') {
          const at = legacyIndex(id);
          if (at < 0) return UI.toast('That card is already off the board.', 'warn');
          const n = legacyNotes[at];
          return UI.confirm({
            title: 'Remove this old card?', body: 'It was never saved as a club note, so it only leaves this screen.',
            detail: n.title, okLabel: 'Remove it', cancelLabel: 'Keep it', danger: true
          }).then(function (ok) {
            if (!ok) return false;
            legacyNotes.splice(at, 1);
            repaint();
            UI.toast('Old card removed from the board.', 'info');
          });
        }
        return false;
      });
    }, function (root) {
      const input = root.querySelector('[data-sy-note-input]');
      if (!input) return;
      input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const btn = root.querySelector('[data-sy-act="add"]');
        if (btn) btn.click();
      });
      const st = PMSTATE();
      const deepLink = st.focus === 'new';
      if (deepLink) st.focus = null;
      /* the board repaints after every write, so the composer has to be
         handed back to whoever is still typing */
      if (deepLink || vs.noteFocus) {
        vs.noteFocus = false;
        setTimeout(function () { input.focus(); }, 40);
      }
    });
  }

  function openQuickNote() {
    UI.formModal({
      title: 'Court note', sub: 'Logged straight to the court notes board',
      fields: [
        { name: 'title', label: 'Note', type: 'textarea', rows: 4, col: 2, required: true, maxlength: 160, placeholder: 'Rain cover requested for the Agus River decks…' },
        { name: 'tag', label: 'Tag', col: 1, type: 'select', value: 'Maintenance', options: NOTE_TAGS.map(function (t) { return { value: t, label: t }; }) }
      ],
      submitLabel: 'Save note',
      onSubmit: function (vals) { return Store.ops.addNote(vals.title, vals.tag); },
      onDone: function () { UI.toast('Note saved to the board.'); }
    });
  }

  /* ============================================================
     MESSAGES
     ============================================================ */
  /* threads are seeded lazily by Store.ops.sendMessage; until then the
     board is read from the shipped conversations with real timestamps */
  function threadList() {
    if (Store.db.threads) return Store.db.threads;
    return THREADS.map(function (t) {
      return Object.assign({}, t, { messages: [{ text: t.last, at: threadAgo(t.time), mine: false }] });
    });
  }

  function threadAgo(label) {
    let mins = 5;
    if (label === 'now') mins = 0;
    else {
      const n = Number(String(label).replace(/[^0-9]/g, ''));
      if (/h/i.test(label)) mins = (n || 1) * 60;
      else if (/d/i.test(label)) mins = (n || 1) * 1440;
      else mins = n || 5;
    }
    return new Date(Date.now() - mins * 60000).toISOString();
  }

  function activeThread(list) {
    const st = PMSTATE();
    if (st.focus && st.focus !== 'new') {
      const wanted = list.find(function (t) { return t.who === st.focus; });
      st.focus = null;
      if (wanted) { vs.threadWho = wanted.who; return wanted; }
    }
    return list.find(function (t) { return t.who === vs.threadWho; }) || list[0] || null;
  }

  function messagesHtml() {
    const list = threadList();
    const open = activeThread(list);
    const unread = list.reduce(function (s, t) { return s + (t.unread || 0); }, 0);

    const rows = list.map(function (t, i) {
      const isOpen = open && open.who === t.who;
      return '<div class="row" style="cursor:pointer;padding:12px 10px;border-radius:14px' + (isOpen ? ';background:var(--accent-soft)' : '') + '" ' +
        'data-mutable data-sy-act="thread" data-sy-id="' + i + '">' +
        '<span class="ava" style="background:' + esc(t.tone) + '">' + esc(t.ini || initials(t.who)) + '</span>' +
        '<div class="grow"><div class="t1">' + esc(t.who) + '</div><div class="t2">' + esc(t.last) + '</div></div>' +
        (t.unread ? UI.badge('upcoming', t.unread + ' new') : '<span class="dim" style="font-size:11.5px">' + esc(UI.relTime(threadAgo(t.time))) + '</span>') +
        '<button class="row-act" data-action="mute" title="Mute this thread" aria-label="Mute this thread">' + icon('mute', 16) + '</button>' +
        '</div>';
    }).join('');

    const thread = open ? panel(open.who, (open.messages.length) + ' message(s) · last ' + UI.relTime(open.messages[open.messages.length - 1].at),
      '<div class="stack" style="gap:12px;max-height:360px;overflow:auto">' +
      open.messages.map(function (m) {
        return '<div style="display:flex;justify-content:' + (m.mine ? 'flex-end' : 'flex-start') + ';gap:10px;align-items:flex-end">' +
          (m.mine ? '' : '<span class="ava" style="width:30px;height:30px;font-size:11px;background:' + esc(open.tone) + '">' + esc(open.ini || initials(open.who)) + '</span>') +
          '<div style="max-width:70%"><div style="padding:14px 16px;border-radius:18px;font-size:13.5px;font-weight:600;line-height:1.5;background:' +
          (m.mine ? 'var(--ink);color:#fff' : 'rgba(127,127,160,.12)') + '">' + esc(m.text) + '</div>' +
          '<div class="dim" style="font-size:11px;margin-top:5px;text-align:' + (m.mine ? 'right' : 'left') + '">' + esc(UI.relTime(m.at)) + '</div></div>' +
          '</div>';
      }).join('') + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:18px">' +
      '<label class="dt-search" style="flex:1">' + icon('message', 16) +
      '<input type="text" data-sy-send maxlength="240" placeholder="Message ' + esc(open.who) + '…" aria-label="Message"></label>' +
      syBtn('send', 'Send', 'primary', 'send') + '</div>')
      : panel('Messages', 'Nothing to open', UI.empty('message', 'No conversations yet.', 'Send the first message and the thread becomes real.'));

    return head('Messages', 'League captains, coaches, grounds crew and the pro shop · ' + unread + ' unread',
      syBtn('compose', 'New message', 'primary', 'plus')) +
      '<div class="grid msgwrap" style="grid-template-columns:minmax(0,360px) minmax(0,1fr)">' +
      panel('Threads', list.length + ' conversation(s)', '<div class="stack" style="gap:4px">' + rows + '</div>') +
      thread + '</div>';
  }

  function messagesPage(host) {
    page(host, messagesHtml, function (e, root, repaint) {
      run(root, e, function (act, id) {
        const list = threadList();
        if (act === 'thread') {
          const t = list[Number(id)];
          if (!t) return UI.toast('That thread is gone.', 'warn');
          vs.threadWho = t.who;
          /* threads are keyed by person, not id, so the unread flag is cleared here */
          const stored = Store.db.threads && t.unread;
          if (stored) {
            t.unread = 0;
            bump('message:read');
          }
          /* the emit above already redraws the page — only a quiet pick needs one */
          if (!stored) repaint();
          return undefined;
        }
        if (act === 'send') return sendFrom(root, list);
        if (act === 'compose') return openCompose(list);
        return false;
      });
    }, function (root) {
      const input = root.querySelector('[data-sy-send]');
      if (!input) return;
      input.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        sendFrom(root, threadList());
      });
    });
  }

  function sendFrom(root, list) {
    const input = root.querySelector('[data-sy-send]');
    const open = activeThread(list);
    if (!input || !open) return UI.toast('Open a thread first.', 'warn');
    const res = Store.ops.sendMessage(open.who, input.value);
    if (!res.ok) return UI.toast(errText(res, 'Nothing to send.'), 'err');
    UI.toast('Sent to ' + open.who + '.');
  }

  function openCompose(list) {
    UI.formModal({
      title: 'New message', sub: 'Opens a thread with the captain, coach or crew',
      fields: [{ name: 'who', label: 'To', col: 2, type: 'select', value: (list[0] || {}).who,
        options: list.map(function (t) { return { value: t.who, label: t.who }; }) },
        { name: 'text', label: 'Message', col: 2, type: 'textarea', rows: 3, required: true, maxlength: 240, placeholder: 'Court 3 is free at 06:00 if you want to swap.' }],
      submitLabel: 'Send',
      onSubmit: function (vals) { return Store.ops.sendMessage(vals.who, vals.text); },
      onDone: function (res) { if (res.ok) UI.toast('Message sent.'); }
    });
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  const EVENT_KINDS = ['Tournament', 'Social', 'Training', 'League', 'Community'];
  const EVENT_TONES = ['t-lilac', 't-sky', 't-mint', 't-peach', 't-rose', 't-sun'];

  function eventWhen(d) { return Store.isDate(d) ? Store.sel.fmtDate(d) : d; }

  function eventCard(ev) {
    const left = Math.max(0, num(ev.spots, 0) - num(ev.booked, 0));
    const pct = ev.spots ? Math.min(100, Math.round(num(ev.booked, 0) / ev.spots * 100)) : 0;
    return '<article class="prog ' + esc(ev.tone || 't-lilac') + '" data-sy-card="' + esc(ev.id) + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
      '<span class="date">' + icon('calendar', 14) + esc(eventWhen(ev.date)) + '</span>' +
      '<span class="date">' + esc(ev.kind) + '</span></div>' +
      '<h4 style="margin-top:14px">' + esc(ev.title) + '</h4>' +
      '<p>' + icon('map-pin', 12) + ' ' + esc(ev.venue) + '</p>' +
      '<div class="bar" style="background:rgba(255,255,255,.55)"><i style="width:' + pct + '%"></i></div>' +
      '<div style="font-size:11.5px;font-weight:700;color:rgba(34,29,58,.65);margin:8px 0 14px">' +
      esc(num(ev.booked, 0)) + ' of ' + esc(num(ev.spots, 0)) + ' taken · ' +
      (left ? left + ' spot(s) left' : 'fully booked') + '</div>' +
      '<div class="foot"><span class="date">' + icon('users', 14) + esc(ev.id) + '</span>' +
      '<span style="display:flex;gap:8px">' +
      syBtn('rsvp', left ? 'RSVP' : 'Full', left ? 'primary' : 'ghost', left ? 'plus' : 'ban', ev.id) +
      syBtn('del-event', 'Remove', 'ghost', 'trash', ev.id) + '</span></div></article>';
  }

  function eventsHtml() {
    const all = Store.list('events');
    const kinds = [];
    all.forEach(function (e) { if (kinds.indexOf(e.kind) < 0) kinds.push(e.kind); });
    const shown = all.filter(function (e) {
      return !vs.eventKind || e.kind === vs.eventKind;
    });
    const spots = all.reduce(function (s, e) { return s + Math.max(0, num(e.spots, 0) - num(e.booked, 0)); }, 0);

    const chips = '<div class="chips" style="margin-bottom:18px">' +
      chip('kind', '', 'Every kind', !vs.eventKind) +
      kinds.map(function (k) { return chip('kind', k, k, vs.eventKind === k); }).join('') + '</div>';

    const grid = shown.length
      ? '<div class="grid g-3" data-sy-grid>' + shown.map(eventCard).join('') + '</div>'
      : UI.empty('megaphone', 'No events of that kind.', 'Publish one and it appears here with its real spot count.',
        '<button class="pill-btn primary" data-sy-act="new">Create an event</button>');

    return head('Events', 'What is happening around ' + Store.settings.club.city + ' · ' + spots + ' spots still open',
      syBtn('new', 'Create event', 'primary', 'plus')) +
      '<div class="tiles" style="margin-bottom:20px">' +
      tile('Events published', all.length) +
      tile('Spots still open', spots) +
      tile('Booked so far', all.reduce(function (s, e) { return s + num(e.booked, 0); }, 0)) +
      tile('Fully booked', all.filter(function (e) { return num(e.spots, 0) - num(e.booked, 0) <= 0; }).length) +
      '</div>' + chips + grid +
      note('RSVP takes a real seat: the club counts the spot, refuses when the event is full and writes the confirmation to the inbox.');
  }

  function openEventForm() {
    UI.formModal({
      title: 'Create an event', sub: 'Published straight to the club events board',
      fields: [
        { name: 'title', label: 'Event name', col: 2, required: true, maxlength: 80, placeholder: 'Sunrise Doubles Social' },
        { name: 'date', label: 'Date', col: 1, type: 'date', required: true, value: Store.addDays(Store.today(), 7) },
        { name: 'kind', label: 'Kind', col: 1, type: 'select', value: 'Social', options: EVENT_KINDS.map(function (k) { return { value: k, label: k }; }) },
        { name: 'venue', label: 'Venue', col: 1, type: 'select', value: VENUES[0].name, options: VENUES.map(function (v) { return { value: v.name, label: v.name }; }) },
        { name: 'spots', label: 'Spots', col: 1, type: 'number', value: 24, min: 1, max: 500, required: true, help: 'Seats the event can hold. Members are counted against it as they RSVP.' }
      ],
      submitLabel: 'Publish event',
      onSubmit: function (vals) {
        const e = {};
        if (!String(vals.title || '').trim()) e.title = 'Give the event a name.';
        if (!Store.isDate(vals.date)) e.date = 'Pick the day the event runs.';
        else if (Store.dayDiff(Store.today(), vals.date) < 0) e.date = 'That day has already passed.';
        const spots = Number(vals.spots);
        if (isNaN(spots) || spots < 1) e.spots = 'There must be at least one spot.';
        if (Object.keys(e).length) return { ok: false, errors: e };
        const row = Store.add('events', {
          title: String(vals.title).trim(), date: vals.date, venue: vals.venue, kind: vals.kind,
          tone: EVENT_TONES[Math.floor(Math.random() * EVENT_TONES.length)], spots: spots, booked: 0
        });
        bump('event:create');
        return { ok: true, message: row.title + ' is live with ' + spots + ' spots.' };
      }
    });
  }

  function eventDetail(id) {
    const ev = Store.get('events', id);
    if (!ev) return;
    const left = Math.max(0, num(ev.spots, 0) - num(ev.booked, 0));
    UI.modal({
      title: ev.title, sub: eventWhen(ev.date) + ' · ' + ev.venue,
      body: '<dl class="kv"><dt>Kind</dt><dd>' + esc(ev.kind) + '</dd>' +
        '<dt>When</dt><dd>' + esc(eventWhen(ev.date)) + '</dd>' +
        '<dt>Venue</dt><dd>' + esc(ev.venue) + '</dd>' +
        '<dt>Capacity</dt><dd>' + esc(num(ev.booked, 0)) + ' of ' + esc(num(ev.spots, 0)) + '</dd>' +
        '<dt>Open spots</dt><dd>' + esc(left) + '</dd></dl>',
      actions: [{ id: 'rsvp', label: left ? 'RSVP a seat' : 'Event is full', cls: left ? 'primary' : 'ghost' }],
      onAction: function (a) { if (a === 'rsvp') rsvp(id); }
    });
  }

  function rsvp(id) {
    const res = Store.ops.rsvpEvent(id);
    if (!res.ok) return UI.toast(errText(res, 'That seat could not be held.'), 'err');
    return UI.toast('Seat held · ' + res.left + ' spot(s) left.');
  }

  function eventsPage(host) {
    page(host, eventsHtml, function (e, root, repaint) {
      run(root, e, function (act, id) {
        if (act === 'kind') { vs.eventKind = id || ''; return repaint(); }
        if (act === 'new') return openEventForm();
        if (act === 'rsvp') return rsvp(id);
        if (act === 'del-event') {
          const ev = Store.get('events', id);
          if (!ev) return UI.toast('That event is gone.', 'warn');
          return UI.confirm({
            title: 'Remove ' + ev.title + '?', body: 'The event leaves the club board for good.',
            detail: ev.booked + ' RSVP(s) go with it.', okLabel: 'Remove event', cancelLabel: 'Keep it', danger: true
          }).then(function (ok) {
            if (!ok) return false;
            if (removeRow('events', id, 'event:delete')) UI.toast('Event removed.', 'info');
          });
        }
        return false;
      });
      const card = e.target.closest('[data-sy-card]');
      if (card && !e.target.closest('[data-sy-act]')) eventDetail(card.dataset.syCard);
    }, function (root) {
      const st = PMSTATE();
      const focus = st.focus;
      if (!focus) return;
      st.focus = null;
      if (focus === 'new') return openEventForm();
      if (Store.get('events', focus)) return eventDetail(focus);
    });
  }

  /* ============================================================
     SHOT LIBRARY
     ============================================================ */
  function shotCard(s) {
    return '<article class="wordcard ' + esc(s.tone || 'w-lilac') + '" data-sy-term="' + esc(s.term) + '" style="cursor:pointer">' +
      '<button class="go" aria-label="Open this term">' + icon('arrow-up-right', 14) + '</button>' +
      '<span class="kind">' + esc(s.kind) + '</span><h4>' + esc(s.term) + '</h4><p>' + esc(s.def) + '</p></article>';
  }

  function libraryHtml() {
    const kinds = [];
    SHOTS.forEach(function (s) { if (kinds.indexOf(s.kind) < 0) kinds.push(s.kind); });
    return head('Shot Library', 'The vocabulary the clinics and drills are written in · ' + SHOTS.length + ' terms',
      syBtn('drills', 'Today’s drills', 'ghost', 'dumbbell') + syBtn('clinics', 'Clinics', 'ghost', 'book')) +
      '<div class="dt-bar">' +
      '<label class="dt-search">' + icon('search', 16) +
      '<input type="search" data-sy-q placeholder="Search a term or its definition…" aria-label="Search the library"></label>' +
      '<div class="chips">' + chip('kind', '', 'Every kind', !vs.shotKind) +
      kinds.map(function (k) { return chip('kind', k, k, vs.shotKind === k); }).join('') + '</div>' +
      '<span class="dt-count" data-sy-count>' + SHOTS.length + ' terms</span></div>' +
      '<div class="wordgrid" data-sy-grid>' + SHOTS.map(shotCard).join('') + '</div>' +
      '<div data-sy-empty hidden>' + UI.empty('search', 'No term matches that.', 'Try dink, kitchen, reset or Erne.') + '</div>' +
      note('Terms are the club’s fixed glossary, so there is nothing to edit here — search and filter only.');
  }

  function libraryFilter(root) {
    const input = root.querySelector('[data-sy-q]');
    const grid = root.querySelector('[data-sy-grid]');
    const emptyHost = root.querySelector('[data-sy-empty]');
    const count = root.querySelector('[data-sy-count]');
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    Array.prototype.forEach.call(grid.children, function (node, i) {
      const s = SHOTS[i];
      const hit = (!q || (s.term + ' ' + s.def + ' ' + s.kind).toLowerCase().indexOf(q) > -1) &&
        (!vs.shotKind || s.kind === vs.shotKind);
      node.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    emptyHost.hidden = shown > 0;
    count.textContent = shown + (shown === 1 ? ' term' : ' terms');
  }

  function shotModal(term) {
    const s = SHOTS.find(function (x) { return x.term === term; });
    if (!s) return;
    const related = SHOTS.filter(function (x) { return x.kind === s.kind && x.term !== s.term; }).slice(0, 5);
    UI.modal({
      title: s.term, sub: s.kind + ' · club glossary',
      body: '<p class="confirm-copy">' + esc(s.def) + '</p>' +
        (related.length ? '<div class="section-title">Related ' + esc(s.kind.toLowerCase()) + ' terms</div><div class="chips">' +
          related.map(function (r) {
            return '<button class="chip" data-act="term:' + esc(r.term) + '">' + esc(r.term) + '</button>';
          }).join('') + '</div>' : ''),
      actions: [{ id: 'drills', label: 'Practise it in today’s drills', cls: 'primary' },
        { id: 'clinics', label: 'See the clinics', cls: 'ghost' }],
      onAction: function (a) {
        if (a.indexOf('term:') === 0) return shotModal(a.slice(5));
        if (a === 'drills') return go('drills');
        if (a === 'clinics') return go('training');
      }
    });
  }

  function libraryPage(host) {
    page(host, libraryHtml, function (e, root) {
      run(root, e, function (act, id) {
        if (act === 'kind') { vs.shotKind = id || ''; root.querySelectorAll('[data-sy-act="kind"]').forEach(function (c) {
            c.classList.toggle('is-active', (c.dataset.syId || '') === (vs.shotKind || ''));
          }); return libraryFilter(root); }
        if (act === 'drills') return go('drills');
        if (act === 'clinics') return go('training');
        return false;
      });
      const card = e.target.closest('[data-sy-term]');
      if (card) shotModal(card.dataset.syTerm);
    }, function (root) {
      const input = root.querySelector('[data-sy-q]');
      if (input) input.addEventListener('input', function () { libraryFilter(root); });
    });
  }

  /* ============================================================
     DAILY DRILLS
     ============================================================ */
  function drillRows() {
    return Store.db.drills || DRILLS.map(function (d) { return Object.assign({ done: false }, d); });
  }

  function drillsHtml() {
    const rows = drillRows();
    const done = rows.filter(function (d) { return d.done; }).length;
    const pct = rows.length ? Math.round(done / rows.length * 100) : 0;

    const list = rows.length ? '<div class="stack" style="gap:8px">' + rows.map(function (d, i) {
      return '<div class="row" style="padding:14px 0">' +
        '<span class="slab' + (d.done ? ' tint' : '') + '">' + icon(d.done ? 'check' : (d.icon || 'target'), 18) + '</span>' +
        '<div class="grow"><div class="t1" style="white-space:normal">' + esc(d.title) + '</div>' +
        '<div class="t2">' + esc(d.sub) + '</div></div>' +
        (d.done ? UI.badge('active', 'Done') : '<span class="badge is-neutral">To do</span>') +
        syBtn(d.done ? 'undo' : 'done', d.done ? 'Undo' : 'Mark done', d.done ? 'ghost' : 'primary', d.done ? 'refresh' : 'check', d.title) +
        '</div>';
    }).join('') + '</div>' : UI.empty('dumbbell', 'No drills set for today.', 'The club seed hands every member the same five habits.');

    return head('Daily Drills', 'Small habits, big rating jumps · ' + done + ' of ' + rows.length + ' done today',
      syBtn('reset-day', 'Reset day', 'ghost', 'refresh')) +
      '<div class="grid" style="margin-bottom:20px">' +
      panel('Today’s checklist', rows.length + ' drills · reset clears them for a new day',
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">' +
        '<div class="progress" style="flex:1"><i style="width:' + pct + '%"></i></div>' +
        '<b class="mono">' + pct + '%</b></div>' + list) +
      panel('Why this matters', 'What the club tracks',
        '<dl class="kv">' +
        '<dt>Done</dt><dd>' + done + '</dd>' +
        '<dt>Left today</dt><dd>' + (rows.length - done) + '</dd>' +
        '<dt>Logged in the club</dt><dd>' + Store.list('activity').filter(function (a) { return a.kind === 'drill'; }).length + '</dd>' +
        '<dt>Clinics running</dt><dd>' + PROGRAMS.length + '</dd></dl>' +
        note('Ticking a drill writes it to the club activity log, so the coach can see who actually did the work. Resetting the day reopens every drill that was ticked.')) +
      '</div>' +
      '<div class="page-tools">' + syBtn('to-library', 'Shot library', 'ghost', 'library') +
      syBtn('to-clinics', 'Clinics', 'ghost', 'book') + '</div>';
  }

  function drillsPage(host) {
    page(host, drillsHtml, function (e, root) {
      run(root, e, function (act, id) {
        if (act === 'done' || act === 'undo') {
          const res = Store.ops.toggleDrill(id);
          if (!res.ok) return UI.toast('That drill is not on today’s list.', 'err');
          return UI.toast(res.done ? 'Logged: ' + id : 'Reopened: ' + id, res.done ? 'ok' : 'info');
        }
        if (act === 'reset-day') {
          const open = drillRows().filter(function (d) { return d.done; });
          if (!open.length) return UI.toast('Nothing is ticked yet today.', 'warn');
          return UI.confirm({
            title: 'Reset today’s drills?', body: 'All ' + open.length + ' ticked drill(s) go back to to-do.',
            detail: 'The club keeps the activity log — only today’s checklist is cleared.',
            okLabel: 'Reset day', cancelLabel: 'Keep them ticked', danger: true
          }).then(function (ok) {
            if (!ok) return false;
            Store.batch(function () { open.forEach(function (d) { Store.ops.toggleDrill(d.title); }); });
            UI.toast('Drills reset for a new day.');
          });
        }
        if (act === 'to-library') return go('library');
        if (act === 'to-clinics') return go('training');
        return false;
      });
    });
  }

  /* ============================================================
     CLINICS (PROGRAMS)
     ============================================================ */
  function clinicCard(p) {
    const left = Math.max(0, num(p.spots, 0) - num(p.enrolled, 0));
    const pct = p.spots ? Math.min(100, Math.round(num(p.enrolled, 0) / p.spots * 100)) : 0;
    return '<article class="prog ' + esc(p.tone) + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
      '<h4 style="max-width:70%">' + esc(p.title) + '</h4><span class="date">' + esc(p.level) + '</span></div>' +
      '<p>' + esc(p.desc) + '</p>' +
      '<div class="bar" style="background:rgba(255,255,255,.55)"><i style="width:' + pct + '%"></i></div>' +
      '<div style="font-size:11.5px;font-weight:700;color:rgba(34,29,58,.65);margin:8px 0 14px">' +
      esc(num(p.enrolled, 0)) + ' of ' + esc(num(p.spots, 0)) + ' enrolled · ' + (left ? left + ' seat(s) left' : 'clinic is full') +
      ' · starts ' + esc(p.date) + '</div>' +
      '<div class="foot"><span class="date">' + icon('users', 14) +
      esc((p.coaches || []).join(' · ') || 'Coaching staff') + '</span>' +
      '<button class="pill-btn" style="background:rgba(255,255,255,.75);color:#3a3358" data-enroll="' + esc(p.id) + '">' +
      icon(left ? 'plus' : 'ban', 14) + (left ? 'Enrol' : 'Full') + '</button></div></article>';
  }

  function trainingHtml() {
    const seats = PROGRAMS.reduce(function (s, p) { return s + Math.max(0, num(p.spots, 0) - num(p.enrolled, 0)); }, 0);
    return head('Clinics & Programs', 'Learn, drill and grade up with the Marawi coaching staff · ' + seats + ' seats open',
      syBtn('drills', 'Daily drills', 'ghost', 'dumbbell') + syBtn('library', 'Shot library', 'ghost', 'library')) +
      '<div class="dt-bar"><label class="dt-search">' + icon('search', 16) +
      '<input type="search" data-sy-q placeholder="Search clinics by name, level or focus…" aria-label="Search clinics"></label>' +
      '<span class="dt-count" data-sy-count>' + PROGRAMS.length + ' clinic(s)</span></div>' +
      '<div class="grid g-2" data-sy-grid>' + PROGRAMS.map(clinicCard).join('') + '</div>' +
      '<div data-sy-empty hidden>' + UI.empty('book', 'No clinic matches that.', 'Try beginner, advanced, dink or reset.') + '</div>' +
      note('Enrolling takes a real seat from the program; the count on the card is read again after every enrolment.');
  }

  function trainingPage(host) {
    page(host, trainingHtml, function (e, root) {
      run(root, e, function (act) {
        if (act === 'drills') return go('drills');
        if (act === 'library') return go('library');
        return false;
      });
    }, function (root) {
      const input = root.querySelector('[data-sy-q]');
      const grid = root.querySelector('[data-sy-grid]');
      const emptyHost = root.querySelector('[data-sy-empty]');
      const count = root.querySelector('[data-sy-count]');
      if (!input) return;
      input.addEventListener('input', function () {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        Array.prototype.forEach.call(grid.children, function (node, i) {
          const p = PROGRAMS[i];
          const hit = !q || (p.title + ' ' + p.desc + ' ' + p.level + ' ' + p.date).toLowerCase().indexOf(q) > -1;
          node.style.display = hit ? '' : 'none';
          if (hit) shown++;
        });
        emptyHost.hidden = shown > 0;
        count.textContent = shown + (shown === 1 ? ' clinic' : ' clinics');
      });
    });
  }

  /* ============================================================
     register
     ============================================================ */
  Object.assign(PAGES, {
    notifications: { live: true, render: notificationsPage },
    settings: { live: true, instant: true, render: settingsPage },
    help: { live: true, instant: true, render: helpPage },
    weather: { live: true, render: weatherPage },
    notes: { live: true, render: notesPage },
    messages: { live: true, render: messagesPage },
    events: { live: true, render: eventsPage },
    library: { live: true, instant: true, render: libraryPage },
    drills: { live: true, render: drillsPage },
    training: { live: true, instant: true, render: trainingPage }
  });
})();
