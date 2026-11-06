/* ============================================================
   Dashboards — templates/dashboard/{player,owner,admin,users}.html
   Django's @login_required + role_required are handled by the shell
   gate and by the API's own denied() response, so a page only ever
   renders data the account is allowed to see.
   ============================================================ */

(function () {
  const esc = UI.esc;

  /* {{ user.first_name|default:user.username }} */
  function firstName() {
    const user = Store.sel.user();
    if (!user) return '';
    return user.first_name || user.username;
  }

  function bookingLabel(booking) {
    return DATA.BOOKING_STATUS_LABELS[booking.status] || booking.status;
  }

  /* .dash__head exactly as the four templates write it */
  function dashHead(eyebrowText, title, sub, actions) {
    return '<div class="dash__head"><div>' +
      '<p class="eyebrow">' + esc(eyebrowText) + '</p>' +
      '<h1>' + esc(title) + '</h1>' +
      '<p>' + esc(sub) + '</p></div>' +
      (actions ? '<div class="btn-row">' + actions + '</div>' : '') +
      '</div>';
  }

  /* .stat-cards — `style` carries the inline font-size the accent tiles use */
  function statCard(label, value, opts) {
    const config = opts || {};
    return '<div class="stat-card' + (config.accent ? ' stat-card--accent' : '') + '">' +
      '<span>' + esc(label) + '</span>' +
      '<strong' + (config.style ? ' style="' + config.style + '"' : '') + '>' + value + '</strong></div>';
  }
  function statCards(cards) {
    return '<div class="stat-cards">' + cards.join('') + '</div>';
  }

  /* the dashed empty panel the dashboards fall back to */
  function emptyDash(title, body, actionHtml) {
    return '<div class="empty-panel" style="border-style:dashed;">' +
      '<h3>' + esc(title) + '</h3><p>' + esc(body) + '</p>' + (actionHtml || '') + '</div>';
  }

  function panel(title, sub, inner) {
    return '<div class="panel"><div class="panel__head"><div><h2>' + esc(title) + '</h2>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></div>' + inner + '</div>';
  }

  /* {{ venue.courts.count }} court{{ ...|pluralize }} */
  function courtCount(venue) {
    const n = (venue.courts || []).length;
    return n + ' court' + (n === 1 ? '' : 's');
  }

  /* {{ value|yesno:"Yes,No" }} */
  function yesNo(value) {
    return value ? 'Yes' : 'No';
  }

  /* {{ text|truncatewords:32 }} */
  function truncateWords(text, length) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (words.length <= length) return words.join(' ');
    return words.slice(0, length).join(' ') + ' ...';
  }

  /* role_required() bounced the request: honour the redirect Django would issue */
  function denied(res) {
    if (res.login) return { redirect: '/accounts/login/?next=' + encodeURIComponent(window.location.pathname) };
    if (res.error) Store.flash(res.error, 'error');
    return { redirect: res.redirect || '/' };
  }

  /* ---------- player ---------- */

  function playerItem(booking) {
    return '<div class="booking-item"><div>' +
      '<p class="booking-item__title">' + esc(booking.venue_name) + ' · ' + esc(booking.court_name) + ' ' +
        UI.badge(booking.status_tone, bookingLabel(booking)) + '</p>' +
      '<p class="booking-item__meta">' + esc(DATA.compactDate(booking.date)) + ' · ' + esc(booking.time_label) +
        ' · ' + esc(booking.reference) +
        (booking.total_amount ? ' · \u20B1' + Math.round(booking.total_amount) + ' est.' : '') + '</p>' +
      '</div><div class="booking-item__side">' +
        '<a class="btn-mini" href="/bookings/' + esc(booking.reference) + '">Details</a>' +
        '<form data-cancel="' + esc(booking.reference) + '">' +
          '<button class="btn-mini btn-mini--bad" type="submit">Cancel</button></form>' +
      '</div></div>';
  }

  function playerHost(host, res) {
    const upcoming = res.upcoming.length
      ? '<div class="booking-list">' + res.upcoming.map(playerItem).join('') + '</div>'
      : emptyDash('No upcoming bookings', 'Browse approved courts in Marawi and send your first request.',
          '<a class="btn btn--dark btn--sm" href="/courts">Find a court</a>');

    const historyRows = res.history.map(b => UI.row([
      '<a href="/bookings/' + esc(b.reference) + '"><strong>' + esc(b.reference) + '</strong></a>',
      esc(b.venue_name), esc(b.court_name), esc(DATA.monthDayYear(b.date)),
      esc(b.time_label), UI.badge(b.status_tone, bookingLabel(b))
    ]));
    const historyTable = UI.table(['Reference', 'Venue', 'Court', 'Date', 'Time', 'Status'], historyRows);
    const history = res.history.length ? panel('History', 'Past dates and cancelled requests.', historyTable) : '';

    host.innerHTML = '<section class="dash"><div class="shell">' +
      dashHead('Player dashboard', 'Hi, ' + firstName(),
        'Your requests, approvals, and past games in one place.',
        '<a class="btn btn--outline btn--sm" href="/accounts/profile">Profile</a>' +
        '<a class="btn btn--dark btn--sm" href="/courts">Book another court' +
          '<span class="btn__orb">' + icon('arrow-right') + '</span></a>') +
      statCards([
        statCard('Pending', esc(res.counts.pending)),
        statCard('Approved & upcoming', esc(res.counts.approved)),
        statCard('All bookings', esc(res.counts.total)),
        statCard('Next step', esc('Wait for owner approval'),
          { accent: true, style: 'font-size:1rem;line-height:1.4;margin-top:8px;' })
      ]) +
      panel('Upcoming requests', 'Pending and approved games from today onward.', upcoming) +
      history +
      '</div></section>';

    /* listeners live on the freshly rendered section, never on #main,
       so a re-render cannot stack a second handler behind the first. */
    host.querySelector('.dash').addEventListener('submit', event => {
      const form = event.target.closest('[data-cancel]');
      if (!form) return;
      event.preventDefault();
      Api.post('/api/bookings/' + encodeURIComponent(form.getAttribute('data-cancel')) + '/cancel').then(out => {
        if (!out.ok) {
          Motion.toast((out.errors && out.errors.__all__) ? out.errors.__all__[0] : out.error, 'error');
          return;
        }
        Store.flash(out.message);
        reloadRoute();
      });
    });
  }

  /* ---------- owner ---------- */
  function requestItem(booking) {
    return '<div class="booking-item"><div>' +
      '<p class="booking-item__title">' + esc(booking.court_name) + ' · ' + esc(booking.player_name) + ' ' +
        '<span class="badge badge--warn">Pending</span></p>' +
      '<p class="booking-item__meta">' + esc(DATA.compactDate(booking.date)) + ' · ' + esc(booking.time_label) +
        ' · ' + esc(booking.reference) +
        (booking.note ? ' · \u201C' + esc(booking.note) + '\u201D' : '') + '</p>' +
      '<form class="review-form" data-decide="approve" data-reference="' + esc(booking.reference) + '">' +
        '<input type="text" name="note" placeholder="Optional note to the player">' +
        '<button class="btn-mini btn-mini--ok" type="submit">Approve</button></form>' +
      '<form class="review-form" data-decide="reject" data-reference="' + esc(booking.reference) + '">' +
        '<button class="btn-mini btn-mini--bad" type="submit">Reject</button></form>' +
      '</div><div class="booking-item__side">' +
        '<span class="court-row__rate">' + esc(booking.court_rate_display) + '</span>' +
      '</div></div>';
  }

  function venueMini(venue, opts) {
    const config = opts || {};
    const cover = venue.cover
      ? '<img src="' + esc(venue.cover) + '" alt="' + esc(venue.name) + '">'
      : '<div class="venue-mini__ph"></div>';
    const actions = config.admin
      ? '<a class="btn-mini" href="/courts/' + esc(venue.slug) + '">Preview</a>' +
        '<a class="btn-mini" href="/courts/' + esc(venue.slug) + '/edit">Open listing</a>'
      : '<a class="btn-mini" href="/courts/' + esc(venue.slug) + '/edit">Manage</a>' +
        (venue.is_verified
          ? '<a class="btn-mini" href="/courts/' + esc(venue.slug) + '">View public page</a>' +
            '<form data-toggle="' + esc(venue.slug) + '">' +
              '<button class="btn-mini" type="submit">' +
                (venue.is_active ? 'Pause listing' : 'Resume listing') + '</button></form>'
          : '');

    return '<div class="venue-mini"' + (config.align ? ' style="align-items:flex-start;"' : '') + '>' +
      cover +
      '<div class="venue-mini__body"><h3>' + esc(venue.name) + ' ' +
        UI.badge(venue.status_tone, venue.status_display) +
        (!venue.is_active && !config.admin ? '<span class="badge badge--muted">Paused</span>' : '') +
      '</h3>' +
      (config.admin
        ? '<p>' + esc(venue.address) + ', ' + esc(venue.location_label) + ' · ' + esc(venue.contact_phone) + '</p>' +
          '<p>Owner: ' + esc(venue.owner_name) + ' (' + esc(venue.owner_email || 'no email') + ') · ' +
            esc(courtCount(venue)) + ' · ' + esc(venue.rate_display) + '</p>' +
          '<p style="margin-top:6px;color:var(--ink-soft);font-size:.84rem;">' +
            esc(truncateWords(venue.description, 32)) + '</p>'
        : '<p>' + esc(venue.location_label) + ' · ' + esc(courtCount(venue)) + ' · ' + esc(venue.rate_display) + '</p>' +
          (venue.status === 'rejected' && venue.review_note
            ? '<p class="form-error" style="margin-top:4px;">Reviewer note: ' + esc(venue.review_note) + '</p>'
            : '')) +
      '<div class="venue-mini__actions">' + actions + '</div>' +
      (config.review
        ? '<div class="review-form"><form data-review="' + esc(venue.slug) + '"' +
            ' style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
            '<input type="text" name="note" placeholder="Reviewer note (required for rejection)">' +
            '<button class="btn-mini btn-mini--ok" type="submit" name="action" value="approve">Approve</button>' +
            '<button class="btn-mini btn-mini--bad" type="submit" name="action" value="reject">Reject</button>' +
          '</form></div>'
        : '') +
      '</div></div>';
  }

  function ownerHost(host, res) {
    const requests = res.requests.length
      ? '<div class="booking-list">' + res.requests.map(requestItem).join('') + '</div>'
      : '<p class="form-text">No pending requests right now.</p>';

    const venues = res.venues.length
      ? res.venues.map(venue => venueMini(venue)).join('')
      : emptyDash('No venues yet',
          'Submit your first venue and an administrator will review it before it goes live.',
          '<a class="btn btn--dark btn--sm" href="/courts/new">Add a venue</a>');

    const schedule = res.schedule.length
      ? panel('Approved schedule', 'Upcoming confirmed reservations.',
          UI.table(['Date', 'Time', 'Venue', 'Court', 'Player', 'Ref'],
            res.schedule.map(b => UI.row([
              esc(DATA.monthDayYear(b.date)), esc(b.time_label), esc(b.venue_name), esc(b.court_name),
              esc(b.player_name),
              '<a href="/bookings/' + esc(b.reference) + '">' + esc(b.reference) + '</a>']))))
      : '';

    host.innerHTML = '<section class="dash"><div class="shell">' +
      dashHead('Venue owner dashboard', firstName() + "'s venues",
        'Manage listings, courts, and incoming booking requests.',
        '<a class="btn btn--outline btn--sm" href="/dashboard/player">Player view</a>' +
        '<a class="btn btn--dark btn--sm" href="/courts/new">Add a venue' +
          '<span class="btn__orb">' + icon('plus') + '</span></a>') +
      statCards([
        statCard('Venues', esc(res.venues.length)),
        statCard('Active courts', esc(res.counts.court_total)),
        statCard('Pending requests', esc(res.counts.pending_count)),
        statCard('Approved revenue (upcoming)',
          '\u20B1' + Math.round(res.revenue || 0), { accent: true, style: 'font-size:1.5rem;' })
      ]) +
      panel('Booking requests', 'Only requests for your own venues appear here.', requests) +
      panel('Your venues', 'Status is set by an administrator after review.', venues) +
      schedule +
      '</div></section>';

    host.querySelector('.dash').addEventListener('submit', event => {
      const decide = event.target.closest('[data-decide]');
      if (decide) {
        event.preventDefault();
        const note = (decide.querySelector('input[name="note"]') || {}).value || '';
        Api.post('/api/bookings/' + encodeURIComponent(decide.getAttribute('data-reference')) + '/' +
          decide.getAttribute('data-decide'), { note }).then(out => {
            if (!out.ok) {
              Motion.toast((out.errors && out.errors.__all__) ? out.errors.__all__[0] : out.error, 'error');
              return;
            }
            Store.flash(out.message);
            reloadRoute();
          });
        return;
      }

      const toggle = event.target.closest('[data-toggle]');
      if (!toggle) return;
      event.preventDefault();
      Api.post('/api/venues/' + encodeURIComponent(toggle.getAttribute('data-toggle')) + '/toggle').then(out => {
        if (!out.ok) {
          Motion.toast(out.error || 'Not allowed.', 'error');
          return;
        }
        Store.flash(out.message);
        reloadRoute();
      });
    });
  }

  /* ---------- administrator ---------- */

  function adminHost(host, res) {
    const pending = res.pending_venues.length
      ? res.pending_venues.map(venue => venueMini(venue, { admin: true, align: true, review: true })).join('')
      : '<p class="form-text">Nothing is waiting for review.</p>';

    const allVenues = UI.table(
      ['Venue', 'Owner', 'City', 'Status', 'Active', ''],
      res.all_venues.map(venue => UI.row([
        '<strong>' + esc(venue.name) + '</strong>' +
          (venue.is_demo ? ' <span class="badge badge--demo">Demo</span>' : ''),
        esc(venue.owner_name), esc(venue.city),
        UI.badge(venue.status_tone, venue.status_display), esc(yesNo(venue.is_active)),
        '<form data-review="' + esc(venue.slug) + '"><input type="hidden" name="note" value="">' +
          '<button class="btn-mini" type="submit" name="action" value="' +
            (venue.is_active ? 'pause' : 'resume') + '">' +
            (venue.is_active ? 'Pause' : 'Resume') + '</button></form>'
      ])), { empty: 'No venues yet.' });

    const recent = UI.table(
      ['Ref', 'Player', 'Venue', 'Date', 'Time', 'Status'],
      res.recent_bookings.map(b => UI.row([
        '<a href="/bookings/' + esc(b.reference) + '">' + esc(b.reference) + '</a>',
        esc(b.player_name), esc(b.venue_name), esc(DATA.monthDayYear(b.date)),
        esc(b.time_label), UI.badge(b.status_tone, bookingLabel(b))
      ])), { empty: 'No bookings yet.' });

    host.innerHTML = '<section class="dash"><div class="shell">' +
      dashHead('Administrator', 'Marketplace oversight',
        'Review venue submissions, monitor accounts, and moderate bookings.',
        /* the Django admin link is gone: /admin/ only existed inside Django. */
        '<a class="btn btn--outline btn--sm" href="/dashboard/admin/users">Users</a>') +
      statCards([
        statCard('Pending review', esc(res.stats.pending)),
        statCard('Approved venues', esc(res.stats.approved)),
        statCard('Players / owners', esc(res.stats.players) + ' / ' + esc(res.stats.owners)),
        statCard('Bookings (approved)', esc(res.stats.bookings) + ' (' + esc(res.stats.approved_bookings) + ')')
      ]) +
      panel('Venue submissions awaiting review',
        'Approve only listings with complete, truthful information.', pending) +
      panel('All venues', 'Latest 12 submissions.', allVenues) +
      panel('Recent bookings', 'Latest activity across the platform.', recent) +
      '</div></section>';

    bindReview(host);
  }

  /* dashboard:review_venue — approve | reject | pause | resume.
     Django read the action from the clicked submit button's name/value;
     event.submitter is the same thing, the click handler is the fallback. */
  function bindReview(host) {
    const scope = host.querySelector('.dash');

    scope.addEventListener('click', event => {
      const button = event.target.closest('button[name="action"]');
      if (!button) return;
      const form = button.closest('form');
      if (form) form.dataset.action = button.value;
    });

    scope.addEventListener('submit', event => {
      const form = event.target.closest('[data-review]');
      if (!form) return;
      event.preventDefault();
      const action = event.submitter ? event.submitter.value : form.dataset.action;
      const note = (form.querySelector('input[name="note"]') || {}).value || '';
      Api.post('/api/dashboard/admin/venues/' + encodeURIComponent(form.getAttribute('data-review')) + '/review',
        { action: action, note: note }).then(out => {
          if (!out.ok) {
            Motion.toast(out.error || 'Review failed.', 'error');
            return;
          }
          Store.flash(out.message, out.level);
          reloadRoute();
        });
    });
  }

  /* ---------- accounts table ---------- */

  function usersHost(host, res) {
    const rows = res.users.map(account => UI.row([
      '<strong>' + esc(account.display_name) + '</strong><br><span class="form-text">' +
        esc(account.email || '') + '</span>',
      esc(account.username),
      '<span class="badge badge--muted">' + esc(DATA.ROLE_LABELS[account.role] || account.role) + '</span>',
      esc(account.venue_total), esc(account.booking_total),
      esc(DATA.monthDayYear(account.date_joined)), esc(yesNo(account.is_active))
    ]));

    host.innerHTML = '<section class="dash"><div class="shell">' +
      '<div class="dash__head"><div><p class="eyebrow">Administrator</p><h1>Accounts</h1>' +
        '<p>Players, venue owners, and administrators. Updated through the admin site.</p></div>' +
        '<a class="btn btn--outline btn--sm" href="/dashboard/admin">Back to overview</a></div>' +
      '<div class="panel">' + UI.table(
        ['Name', 'Username', 'Role', 'Venues', 'Bookings', 'Joined', 'Active'], rows) +
      '</div></div></section>';
  }

  Object.assign(PAGES, {
    dashboardRedirect: {
      render() {
        return Api.get('/api/dashboard/redirect').then(res =>
          ({ redirect: res.ok ? res.redirect : '/accounts/login' }));
      }
    },

    playerDashboard: {
      render(host) {
        return Api.get('/api/dashboard/player').then(res => {
          if (!res.ok) return denied(res);
          playerHost(host, res);
          return undefined;
        });
      }
    },

    ownerDashboard: {
      render(host) {
        return Api.get('/api/dashboard/owner').then(res => {
          if (!res.ok) return denied(res);
          ownerHost(host, res);
          return undefined;
        });
      }
    },

    adminDashboard: {
      render(host) {
        return Api.get('/api/dashboard/admin').then(res => {
          if (!res.ok) return denied(res);
          adminHost(host, res);
          return undefined;
        });
      }
    },

    usersDashboard: {
      render(host) {
        return Api.get('/api/dashboard/users').then(res => {
          if (!res.ok) return denied(res);
          usersHost(host, res);
          return undefined;
        });
      }
    }
  });
})();
