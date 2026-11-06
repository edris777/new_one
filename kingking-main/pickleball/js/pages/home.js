/* ============================================================
   Dashboard — route "dashboard"
   Every number, chart, list and button here is read from (or
   written back through) the store. Nothing is hardcoded.
     variant court → pastel layout
     variant clay  → warm layout
   ============================================================ */

(function () {
  const sel = Store.sel;
  const esc = UI.esc;

  function st() { return PMSTATE(); }
  function today() { return Store.today(); }
  function nowMins() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function lastDays(n) {
    const a = [];
    for (let i = n - 1; i >= 0; i--) a.push(Store.addDays(today(), -i));
    return a;
  }
  function pctChange(cur, prev) {
    if (!prev) return null;
    const d = Math.round((cur - prev) / prev * 100);
    return d === 0 ? null : d;
  }
  function indexOfMax(arr) {
    let best = 0;
    arr.forEach((v, i) => { if (v > arr[best]) best = i; });
    return best;
  }
  function slotTimes() {
    const s = Store.settings.booking;
    const out = [];
    for (let m = Store.mins(s.open); m + s.slotMinutes <= Store.mins(s.close); m += s.slotMinutes) out.push(m);
    return out;
  }

  /* ---------- chart guards: an empty club draws an empty state, not a NaN line ---------- */
  function areaChart(data, h) {
    const total = data.series.reduce((s, x) => s + x.data.reduce((a, b) => a + (b || 0), 0), 0);
    if (!total) {
      return UI.empty('bar-chart', 'Nothing to plot in this window.',
        'Book a court or log a match and the line draws itself.');
    }
    return CH.area({ series: data.series, labels: data.labels, h: h || 260, alt: 'Club activity over time' });
  }

  function barChart(data, h) {
    if (!data.data.reduce((a, b) => a + b, 0)) {
      return UI.empty('bar-chart', 'No revenue booked in this window.',
        'Payments posted from the Payments page land here immediately.');
    }
    return CH.bars({ data: data.data, labels: data.labels, hot: data.hot, h: h || 250, alt: 'Revenue over time' });
  }

  /* ---------- activity window: Week / Month / Year, all from real rows ---------- */
  function perfSeries(range) {
    if (range === 'Year') {
      const ms = sel.monthlySeries(12);
      return {
        title: 'Last 12 months',
        labels: ms.labels,
        series: [
          { key: 'Bookings', color: '#6b7cff', data: ms.bookings },
          { key: 'Matches', color: '#e0607e', data: ms.matches },
          { key: 'New players', color: '#2fb37c', data: ms.signups }
        ],
        columns: [{ label: 'Month', key: 'm' }, { label: 'Bookings', key: 'b' },
          { label: 'Matches', key: 'x' }, { label: 'New players', key: 's' },
          { label: 'Collected', key: 'r' }],
        rows: ms.labels.map((l, i) => ({
          m: l, b: ms.bookings[i], x: ms.matches[i], s: ms.signups[i], r: ms.revenue[i]
        }))
      };
    }
    const n = range === 'Month' ? 30 : 7;
    const t = sel.bookingTrend(n);
    const days = lastDays(n);
    const matchCounts = days.map(d => Store.list('matches').filter(m => m.date === d).length);
    const every = n === 30 ? 5 : 1;
    return {
      title: range === 'Month' ? 'Last 30 days' : 'Last 7 days',
      labels: t.labels.map((l, i) => (i % every === 0 || i === n - 1 ? l : '')),
      series: [
        { key: 'Bookings', color: '#6b7cff', data: t.counts },
        { key: 'Matches', color: '#e0607e', data: matchCounts }
      ],
      columns: [{ label: 'Date', key: 'd' }, { label: 'Bookings', key: 'b' },
        { label: 'Billed', key: 'r' }, { label: 'Matches', key: 'x' }],
      rows: days.map((d, i) => ({ d: d, b: t.counts[i], r: t.revenue[i], x: matchCounts[i] }))
    };
  }

  function dealSeries(mode) {
    if (mode === 'days') {
      const t = sel.bookingTrend(30);
      return {
        labels: t.labels.map((l, i) => (i % 5 === 0 || i === t.labels.length - 1 ? l : '')),
        data: t.revenue,
        hot: indexOfMax(t.revenue),
        columns: [{ label: 'Date', key: 'd' }, { label: 'Bookings', key: 'b' }, { label: 'Billed', key: 'r' }],
        rows: lastDays(30).map((d, i) => ({ d: d, b: t.counts[i], r: t.revenue[i] }))
      };
    }
    const ms = sel.monthlySeries(7);
    return {
      labels: ms.labels,
      data: ms.revenue,
      hot: indexOfMax(ms.revenue),
      columns: [{ label: 'Month', key: 'm' }, { label: 'Collected', key: 'r' }, { label: 'Bookings', key: 'b' }],
      rows: ms.labels.map((l, i) => ({ m: l, r: ms.revenue[i], b: ms.bookings[i] }))
    };
  }

  /* ============================================================
     KPI row — the eight numbers the brief asks for, all derived
     ============================================================ */
  function kpiRow() {
    const s = sel.stats();
    const days = lastDays(2);
    const bookDelta = pctChange(sel.bookingsOn(days[1]).length, sel.bookingsOn(days[0]).length);
    const ms = sel.monthlySeries(2);
    const revDelta = pctChange(ms.revenue[1], ms.revenue[0]);
    const cards = [
      { icon: 'users', label: 'Total Players', value: nf.format(s.players),
        sub: '+' + s.newThisMonth + ' joined this month', go: 'members' },
      { icon: 'award', label: 'Active Members', value: nf.format(s.activeMembers),
        sub: Math.round(s.activeMembers / Math.max(1, s.players) * 100) + '% of the roster', go: 'members' },
      { icon: 'court', label: 'Total Courts', value: nf.format(s.courts),
        sub: s.courtsAvailable + ' free right now', delta: s.courtsAvailable + ' of ' + s.courts + ' open',
        deltaDir: s.courtsAvailable ? 'up' : 'down', go: 'courts' },
      { icon: 'calendar', label: "Today's Bookings", value: nf.format(s.todayBookings),
        sub: s.inPlayNow + ' in play at this minute',
        delta: bookDelta === null ? '' : (bookDelta >= 0 ? '+' : '') + bookDelta + '% vs yesterday',
        deltaDir: bookDelta === null ? 'up' : (bookDelta >= 0 ? 'up' : 'down'), go: 'booking' },
      { icon: 'paddle', label: 'Upcoming Matches', value: nf.format(s.upcomingMatches),
        sub: s.liveMatches ? s.liveMatches + ' match(es) live now' : 'No match in progress',
        deltaDir: 'up', go: 'matches' },
      { icon: 'wallet', label: 'Monthly Revenue', value: money(s.monthlyRevenue),
        sub: money(s.todayRevenue) + ' collected today',
        delta: revDelta === null ? '' : (revDelta >= 0 ? '+' : '') + revDelta + '% vs last month',
        deltaDir: revDelta === null ? 'up' : (revDelta >= 0 ? 'up' : 'down'), go: 'payments' },
      { icon: 'clock', label: 'Pending Payments', value: money(s.pendingPayments),
        sub: s.pendingCount + ' invoice(s) owed · ' + s.failedCount + ' failed',
        delta: s.pendingCount ? s.pendingCount + ' to chase' : '',
        deltaDir: 'down', go: 'payments' },
      { icon: 'trophy', label: 'Active Tournaments', value: nf.format(s.activeTournaments),
        sub: s.openRegistrations + ' open for entry', go: 'tournaments' }
    ];
    return '<div class="kpi-grid" style="margin-bottom:22px">' + cards.map(c => UI.kpi(c)).join('') + '</div>';
  }

  /* ============================================================
     Shared cards
     ============================================================ */
  function perfCard() {
    const range = st().range || 'Week';
    return '<section class="card sp2">' +
      '<div class="card-head"><div><h3>Performance Chart</h3>' +
      '<p>' + perfSeries(range).title + ' · straight from the booking and match records</p></div>' +
      '<div class="card-tools">' + UI.seg(['Week', 'Month', 'Year'], range, 'data-drange') +
      '<button class="mini-btn round" data-dexport="perf" title="Download this series as CSV" aria-label="Download chart data">' + icon('download', 15) + '</button>' +
      '<button class="mini-btn round" data-dexpand="perf" title="Enlarge" aria-label="Enlarge chart">' + icon('expand', 15) + '</button>' +
      '</div></div>' +
      '<div id="dashPerf">' + perfBody(range) + '</div></section>';
  }

  function perfBody(range) {
    const data = perfSeries(range);
    return DASH.legend(data.series) + areaChart(data, 280);
  }

  function todayCard() {
    const d = today();
    const evs = sel.eventsOn(d);
    const now = nowMins();
    const upcoming = evs.filter(e => Store.mins(e.at) >= now);
    const next = upcoming[0];
    const body = evs.length
      ? '<div class="stack" style="gap:0">' + evs.slice(0, 5).map(e => {
          const past = Store.mins(e.end) < now;
          const route = e.kind === 'Booking' ? 'booking' : e.kind === 'Maintenance' ? 'courts' : 'matches';
          return '<div class="row" data-goto="' + route + '" data-focus="' + esc(e.id) + '" tabindex="0" role="button" style="cursor:pointer">' +
            '<span class="slab' + (past ? '' : ' tint') + '">' + icon(e.kind === 'Booking' ? 'calendar' : e.kind === 'Match' ? 'paddle' : e.kind === 'Maintenance' ? 'settings' : 'trophy', 18) + '</span>' +
            '<div class="grow"><div class="t1">' + esc(e.title) + '</div>' +
            '<div class="t2">' + esc(e.at + '–' + e.end) + ' · ' + esc(e.body) + '</div></div>' +
            (past ? '<span class="tagline tg-neutral">Done</span>' : next && next.id === e.id ?
              '<span class="tagline tg-soon">Next up</span>' : UI.badge(e.kind === 'Maintenance' ? 'closed' : 'open', e.kind)) +
            '</div>';
        }).join('') + '</div>'
      : UI.empty('calendar', 'Nothing booked today.', 'The desk has an open court from ' +
        Store.settings.booking.open + ' to ' + Store.settings.booking.close + '.',
        '<button class="pill-btn primary" data-goto="booking" data-focus="new">' + icon('plus', 15) + 'Book a court</button>');
    return '<section class="card">' +
      '<div class="card-head"><div><h3>Today at ' + esc(Store.settings.club.name) + '</h3>' +
      '<p>' + new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' · ' + evs.length + ' item(s) on the board</p></div>' +
      '<button class="pill-btn ghost" data-goto="schedule">Calendar</button></div>' +
      body + '</section>';
  }

  function drillCard() {
    const rows = Store.db.drills || DRILLS.map(x => Object.assign({ done: false }, x));
    const done = rows.filter(r => r.done).length;
    return '<section class="card">' +
      '<div class="card-head"><div><h3>Daily Drills</h3>' +
      '<p>' + done + ' of ' + rows.length + ' ticked — tapping one saves it to your record</p></div>' +
      '<button class="pill-btn ghost" data-goto="drills">All drills</button></div>' +
      '<div class="stack" style="gap:0">' + rows.map(d =>
        '<div class="row" data-ddrill="' + esc(d.title) + '" tabindex="0" role="button" style="cursor:pointer">' +
        '<span class="slab' + (d.done ? ' tint' : '') + '">' + icon(d.done ? 'check' : d.icon, 18) + '</span>' +
        '<div class="grow"><div class="t1">' + esc(d.title) + '</div>' +
        '<div class="t2">' + esc(d.sub) + '</div></div>' +
        '<span class="pct">' + d.pct + '%</span></div>').join('') + '</div>' +
      '</section>';
  }

  function ladderCard() {
    const rows = sel.leaderboard(5);
    return '<section class="card">' +
      '<div class="card-head"><div><h3>Ladder — top 5</h3>' +
      '<p>Points and win/loss counted from completed matches</p></div>' +
      '<button class="pill-btn ghost" data-goto="rankings">Full ladder</button></div>' +
      (rows.length ? rows.map((r, i) =>
        '<div class="row" data-goto="members" data-focus="' + esc(r.id) + '" tabindex="0" role="button" style="cursor:pointer">' +
        '<span class="rank">' + (i + 1) + '</span>' +
        UI.avatar(r.name, '#6b7cff') +
        '<div class="grow"><div class="t1">' + esc(r.name) + '</div>' +
        '<div class="t2">' + esc(r.venue || Store.sel.venueName(r.venueId) || 'Marawi City') + ' · ' + r.level.toFixed(1) + ' rated</div></div>' +
        '<span class="num">' + nf.format(r.rating) + '</span>' +
        '<span class="tagline tg-neutral">' + r.won + '–' + r.lost + '</span></div>').join('')
        : UI.empty('users', 'No ranked players yet.', 'Members enter the ladder once they have ladder points.')) +
      '</section>';
  }

  function pendingCard() {
    const s = sel.stats();
    const rows = Store.list('payments').filter(p => p.status === 'pending').slice(0, 4);
    return '<section class="card">' +
      '<div class="card-head"><div><h3>Money owed</h3>' +
      '<p>' + money(s.pendingPayments) + ' across ' + s.pendingCount + ' invoice(s)</p></div>' +
      '<button class="pill-btn ghost" data-goto="payments">Ledger</button></div>' +
      (rows.length ? rows.map(p =>
        '<div class="row" data-goto="payments" data-focus="' + esc(p.id) + '" tabindex="0" role="button" style="cursor:pointer">' +
        '<span class="slab">' + icon(p.kind === 'Pro shop' ? 'cart' : p.kind === 'Membership' ? 'award' : 'court', 18) + '</span>' +
        '<div class="grow"><div class="t1">' + esc(p.who) + '</div>' +
        '<div class="t2">' + esc(p.id) + ' · ' + esc(p.item) + ' · ' + esc(sel.fmtDate(p.date)) + '</div></div>' +
        '<span class="num" style="font-size:18px">' + money(p.amount) + '</span></div>').join('')
        : UI.empty('check', 'Every invoice is settled.', 'Nothing is waiting on the desk right now.')) +
      '<button class="pill-btn accent" data-goto="payments" data-focus="new" style="margin-top:14px;width:100%;justify-content:center">' +
      icon('wallet', 15) + 'Record a payment</button>' +
      '</section>';
  }

  function activityCard() {
    const feed = sel.recentActivity(8);
    const unread = sel.unreadCount();
    return '<section class="card">' +
      '<div class="card-head"><div><h3>Recent activity</h3><p>Everything the club wrote today and before</p></div>' +
      (unread ? '<button class="pill-btn ghost" data-goto="notifications">' + unread + ' unread</button>' : '') +
      '</div>' +
      (feed.length ? feed.map(a =>
        '<div class="row">' +
        '<span class="slab">' + icon(Store.KIND_ICON[a.kind] || 'activity', 18) + '</span>' +
        '<div class="grow"><div class="t1">' + esc(a.text) + '</div>' +
        '<div class="t2">' + esc(UI.relTime(a.at)) + ' · ' + esc(a.kind) + '</div></div></div>').join('')
        : UI.empty('activity', 'No activity logged yet.', 'Bookings, payments and results appear here as they happen.')) +
      '</section>';
  }

  function programCard() {
    const prog = PROGRAMS.slice(0, 4);
    return '<section class="card rsp2">' +
      '<div class="card-head"><div><h3>Select a program</h3><p>Clinics with live seat counts</p></div></div>' +
      '<div style="display:flex;align-items:center;gap:10px;padding:6px 6px 6px 18px;border-radius:999px;background:rgba(127,127,160,.10);margin-bottom:18px">' +
      '<input id="dashProg" placeholder="Search clinics" aria-label="Search clinics" style="flex:1;min-width:0;border:0;background:transparent;outline:none;font-size:13.5px;font-weight:600">' +
      '<span class="round-solid" style="width:38px;height:38px;display:grid;place-items:center">' + icon('search', 16) + '</span></div>' +
      '<div class="stack" id="dashProgs">' + prog.map((p, i) =>
        '<article class="prog ' + p.tone + (i === 0 ? ' is-active' : '') + '" data-program="' + p.id + '" tabindex="0" ' +
        'data-prog-search="' + esc((p.title + ' ' + p.desc + ' ' + p.level).toLowerCase()) + '">' +
        '<h4>' + esc(p.title) + '</h4><p>' + esc(p.desc) + '</p>' +
        '<div class="foot"><span class="date">' + icon('calendar', 14) + esc(p.date) + '</span>' +
        '<button class="pill-btn sm ghost" data-enroll="' + p.id + '">Take a seat · ' + Math.max(0, p.spots - p.enrolled) + ' left</button></div>' +
        '</article>').join('') + '</div>' +
      '<button class="pill-btn ghost" data-goto="training" style="margin-top:16px;width:100%;justify-content:center">' +
      icon('book', 15) + 'All clinics</button>' +
      '</section>';
  }

  /* the live glance card lives in js/dashmap.js so the map, its base
     switch and the venue board are one component with one lifecycle */
  function mapCard() {
    return DASHMAP.card();
  }

  /* ---------- availability board (both variants) ---------- */
  function dashDate() {
    const s = st();
    if (!s.dashDate || !Store.isDate(s.dashDate)) s.dashDate = today();
    return s.dashDate;
  }

  function venueOptions() {
    return VENUES.filter(v => v.courts);
  }

  function availCard() {
    const s = st();
    const venues = venueOptions();
    if (!venues.some(v => v.id === s.venue)) s.venue = venues[0].id;
    const venue = venues.filter(v => v.id === s.venue)[0];
    const date = dashDate();
    const courts = Store.list('courts').filter(c => c.venueId === venue.id);
    const times = slotTimes();
    const now = nowMins();

    /* per-court slot board built from the live bookings */
    const board = courts.map(c => {
      const bs = sel.bookingsFor(c.id, date);
      const down = c.status === 'maintenance';
      const cells = times.map(m => {
        const hit = bs.filter(b => Store.mins(b.start) <= m && m < Store.mins(b.start) + b.duration * 60)[0];
        return { m: m, booking: hit, down: down, past: date === today() && m < now };
      });
      const status = sel.courtStatusNow(c);
      return { court: c, cells: cells, status: status };
    });
    const freeNow = board.filter(b => b.status === 'available').length;
    const down = board.filter(b => b.court.status === 'maintenance').length;

    const week = [];
    for (let i = -2; i <= 4; i++) week.push(Store.addDays(date, i));

    return '<section class="card sp2" id="dashAvail">' +
      '<div class="card-head"><div><h3>Court availability</h3>' +
      '<p>' + esc(sel.fmtDate(date)) + ' · ' + freeNow + ' of ' + board.length + ' courts free now' +
      (down ? ' · ' + down + ' under maintenance' : '') + '</p></div>' +
      '<div class="card-tools">' +
      '<label class="sel-lbl">Venue<select id="dashVenue" aria-label="Venue">' +
      venues.map(v => '<option value="' + v.id + '"' + (v.id === s.venue ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') +
      '</select></label>' +
      '<button class="pill-btn ghost" data-goto="schedule">Full schedule</button>' +
      '</div></div>' +
      '<div class="daystrip">' +
      '<button class="mini-btn" data-dstep="-1" aria-label="Earlier week">' + icon('chevron-left', 14) + '</button>' +
      week.map(d => '<button class="day' + (d === date ? ' is-active' : '') + '" data-ddate="' + d + '">' +
        d.slice(8) + ' ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d + 'T00:00:00').getDay()] + '</button>').join('') +
      '<button class="mini-btn" data-dstep="1" aria-label="Later week">' + icon('chevron-right', 14) + '</button>' +
      '<button class="mini-btn" data-ddate="' + today() + '" title="Jump to today">Today</button>' +
      '</div>' +
      '<div class="legend-row" style="margin-top:14px">' +
      '<span><i style="background:rgba(47,179,124,.5)"></i>Free — click to book</span>' +
      '<span><i style="background:rgba(224,96,126,.5)"></i>Booked — click to open</span>' +
      '<span><i style="background:rgba(127,127,160,.4)"></i>Maintenance</span></div>' +
      '<div class="slot-grid" style="--slot-cols:' + times.length + '">' +
      '<div class="slot-head"><span></span>' + times.map(m => '<span>' + Store.hm(m).slice(0, 2) + '</span>').join('') + '</div>' +
      board.map(row =>
        '<div class="slot-row"><b>' + esc(row.court.name) + '</b>' +
        row.cells.map(cell => {
          const b = cell.booking;
          if (cell.down) return '<span class="slot is-down" title="' + esc(row.court.name) + ' — under maintenance"></span>';
          if (b) return '<button class="slot is-booked" data-dbooked="' + esc(b.id) + '" ' +
            'title="' + esc(b.playerId ? sel.playerName(b.playerId) : b.id) + ' ' + esc(b.start + '–' + b.end) + ' — open booking"></button>';
          return '<button class="slot" data-dfree="' + esc(row.court.id + '|' + date + '|' + Store.hm(cell.m)) + '" ' +
            'title="Book ' + esc(row.court.name) + ' at ' + Store.hm(cell.m) + (cell.past ? ' (in the past)' : '') + '"></button>';
        }).join('') + '</div>').join('') +
      '</div>' +
      '<p class="dim" style="margin-top:12px;font-size:12.5px">' +
      'Hours ' + esc(Store.settings.booking.open) + '–' + esc(Store.settings.booking.close) +
      ' · ' + times.length + ' slot(s) a day · clicking a free cell opens the booking form with this court, date and time already filled in.</p>' +
      '</section>';
  }

  /* ============================================================
     Clay-variant cards
     ============================================================ */
  function searchCard() {
    return '<section class="card sp2">' +
      '<div class="searchbar"><input id="dashSearch" placeholder="Search players, courts, invoices, matches…" aria-label="Search the club">' +
      '<button class="round-solid" data-dsearch aria-label="Search">' + icon('search', 19) + '</button></div>' +
      '<div id="dashResults" style="margin-top:14px"></div>' +
      '<div class="chips" style="margin-top:6px">' + quickChips() + '</div>' +
      '</section>';
  }

  function quickChips() {
    const s = sel.stats();
    const chips = [];
    const load = sel.dashboardVenueLoad();
    if (load.length) chips.push({ label: load[0].name, go: 'venues', focus: load[0].id });
    const tour = Store.list('tournaments').filter(t => t.status !== 'completed' && t.status !== 'cancelled')[0];
    if (tour) chips.push({ label: tour.name, go: 'tournaments', focus: tour.id });
    const pend = Store.list('payments').filter(p => p.status === 'pending')[0];
    if (pend) chips.push({ label: pend.id + ' · ' + money(pend.amount), go: 'payments', focus: pend.id });
    const court = Store.list('courts').filter(c => sel.courtStatusNow(c) === 'available')[0];
    if (court) chips.push({ label: court.name + ' free', go: 'courts', focus: court.id });
    chips.push({ label: s.activeMembers + ' active members', go: 'members' });
    return chips.slice(0, 5).map(c =>
      '<button class="chip" data-goto="' + c.go + '"' + (c.focus ? ' data-focus="' + esc(c.focus) + '"' : '') + '>' +
      esc(c.label) + '</button>').join('');
  }

  function dashSearch(q) {
    const box = document.querySelector('#dashResults');
    if (!box) return;
    const needle = String(q || '').trim();
    if (needle.length < 2) {
      box.innerHTML = '<p class="dim" style="font-size:13px">Type two or more characters — players, courts, bookings, matches, tournaments and invoices are all searched.</p>';
      return;
    }
    const hits = sel.search(needle).slice(0, 8);
    box.innerHTML = hits.length ? hits.map(h =>
      '<div class="row" data-goto="' + h.route + '" data-focus="' + esc(h.id) + '" tabindex="0" role="button" style="cursor:pointer;padding:9px 0">' +
      '<span class="slab">' + icon(h.icon, 17) + '</span>' +
      '<div class="grow"><div class="t1">' + esc(h.label) + '</div><div class="t2">' + esc(h.sub) + '</div></div>' +
      '<span class="tagline tg-neutral">' + esc(h.group) + '</span></div>').join('')
      : UI.empty('search', 'No record matches “' + esc(needle) + '”.', 'Check the spelling or search a booking/invoice reference.');
  }

  function statCards() {
    const s = sel.stats();
    const week = lastDays(7).reduce((a, d) => a + sel.bookingsOn(d).length, 0);
    const prevWeek = Store.list('bookings').filter(b => b.status !== 'cancelled' &&
      b.date >= Store.addDays(today(), -14) && b.date <= Store.addDays(today(), -8)).length;
    const ms = sel.monthlySeries(2);
    const revDelta = pctChange(ms.revenue[1], ms.revenue[0]);
    const signupDelta = pctChange(ms.signups[1], ms.signups[0]);
    const stats = [
      { label: 'Bookings this week', value: nf.format(week),
        delta: pctChange(week, prevWeek), tag: 'vs the week before',
        sub: s.todayBookings + ' today · ' + s.inPlayNow + ' in play now' },
      { label: 'Active members', value: nf.format(s.activeMembers),
        delta: signupDelta, tag: 'signups vs last month',
        sub: s.newThisMonth + ' joined this month · ' + ms.signups[0] + ' last month' },
      { label: 'Collected this month', value: money(s.monthlyRevenue),
        delta: revDelta, tag: 'vs last month',
        sub: money(s.pendingPayments) + ' still owed' }
    ];
    return stats.map(x => {
      const up = x.delta === null || x.delta >= 0;
      return '<section class="card stat">' +
        '<span class="label">' + esc(x.label) + '</span>' +
        '<span class="value">' + esc(x.value) +
        (x.delta === null ? '' : '<span class="trend ' + (up ? 'up' : 'down') + '" title="' + esc(x.tag) + '">' +
          icon(up ? 'arrow-up-right' : 'arrow-down', 13) + (up ? '+' : '') + x.delta + '%</span>') + '</span>' +
        '<span class="dim" style="font-size:12.5px;font-weight:600">' + esc(x.sub) + '</span>' +
        '</section>';
    }).join('');
  }

  function moneyCard() {
    const s = sel.stats();
    const ms = sel.monthlySeries(2);
    const billed = ms.revenue[1] + s.pendingPayments;
    const kinds = sel.revenueByKind().slice(0, 5);
    const palette = ['#6b7cff', '#2fb37c', '#f4a036', '#e0607e', '#8b7cf6'];
    const donut = kinds.map((k, i) => ({ name: k.kind, value: k.amount, color: palette[i % palette.length] }));
    const unread = sel.unreadCount();
    return '<section class="card sp2">' +
      '<div class="card-head"><div><h3>Money in</h3><p>Collection rate, revenue mix and what is still owed</p></div>' +
      '<button class="pill-btn ghost" data-goto="reports">Full report</button></div>' +
      '<div style="display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:18px;align-items:center">' +
      '<div><span class="dim" style="font-size:11.5px;font-weight:700">Collected vs billed this month</span>' +
      '<div style="display:flex;align-items:center;gap:12px;margin-top:4px">' +
      '<span style="font-size:38px;font-weight:800;letter-spacing:-.04em">' + money(s.monthlyRevenue) + '</span>' +
      '<span class="trend ' + (s.pendingPayments ? 'down' : 'up') + '">' + icon(s.pendingPayments ? 'clock' : 'check', 13) +
      (s.pendingPayments ? money(s.pendingPayments) + ' owed' : 'All settled') + '</span></div>' +
      '<div class="bar"><i style="width:' + (billed ? Math.round(s.monthlyRevenue / billed * 100) : 0) + '%"></i></div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
      '<span class="tagline tg-open">' + Store.list('payments').filter(p => p.status === 'paid').length + ' paid</span>' +
      '<span class="tagline tg-soon">' + s.pendingCount + ' pending</span>' +
      '<span class="tagline tg-neutral">' + s.failedCount + ' failed · ' + money(s.refunded) + ' refunded</span></div>' +
      '<button class="pill-btn accent" data-goto="payments" data-focus="new" style="margin-top:14px">' +
      icon('wallet', 15) + 'Record a payment</button></div>' +
      '<div>' + CH.gauge({ value: billed ? Math.min(1, s.monthlyRevenue / billed) : 0, alt: 'Collection rate this month' }) +
      (donut.length ? CH.donut({ size: 180, data: donut, caption: '₱ collected', alt: 'Revenue by category' }) : '') +
      '</div></div>' +
      (donut.length ? DASH.legend(donut.map(d => ({ key: d.name + ' · ' + money(d.value), color: d.color }))) : '') +
      '<div class="notify-line" data-goto="notifications" tabindex="0" role="button" style="cursor:pointer">' +
      '<span class="logo">' + icon('chat', 20) + '</span>' +
      '<span class="txt"><b>Club notifications</b><span>' +
      (unread ? '<i></i>' + unread + ' unread' : 'Inbox is clear') + '</span></span></div>' +
      '</section>';
  }

  function heroCard() {
    const s = sel.stats();
    const week = lastDays(7).reduce((a, d) => a + sel.bookingsOn(d).length, 0);
    return '<section class="hero-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative">' +
      '<h3>Manage<br>Bookings</h3>' +
      '<button class="mini-btn round" data-drefresh="avail" aria-label="Reload the availability board" title="Reload the availability board">' + icon('refresh', 14) + '</button></div>' +
      '<button class="white-btn" data-goto="booking" data-focus="new">' + icon('plus', 15) + 'Create Now</button>' +
      '<div><div class="big">' + nf.format(week) + '</div>' +
      '<div class="cap">courts booked in the last 7 days · ' + s.inPlayNow + ' in play now</div></div>' +
      '</section>';
  }

  function notesCard() {
    /* only rows the desk actually wrote — the activity log also files kind:'note' entries without a tag */
    const notes = Store.list('activity').filter(a => a.kind === 'note' && a.tag && a.text).slice(0, 3);
    return '<section class="card">' +
      '<div class="card-head"><div><h3>Court Notes</h3><p>' + notes.length + ' pinned by the desk</p></div>' +
      '<button class="mini-btn round" data-action="quick-note" aria-label="Write a court note" title="Write a court note">' + icon('plus', 15) + '</button></div>' +
      (notes.length ? '<div class="stack">' + notes.map(n =>
        '<article class="note" data-goto="notes" tabindex="0" role="button" style="cursor:pointer">' +
        '<div class="grip"></div>' +
        '<span class="when">' + icon('clock', 12) + esc(UI.relTime(n.at)) + '</span>' +
        '<h4>' + esc(n.text) + '</h4>' +
        '<span class="tag"><i></i>' + esc(n.tag || 'General') + '</span></article>').join('') + '</div>'
        : UI.empty('notebook', 'No court notes yet.', 'Anything the desk writes lands here and on the notes board.',
          '<button class="pill-btn ghost" data-action="quick-note">' + icon('plus', 15) + 'Write a note</button>')) +
      '<button class="pill-btn ghost" data-goto="notes" style="margin-top:14px;width:100%;justify-content:center">All notes</button>' +
      '</section>';
  }

  function miniMapCard() {
    const s = sel.stats();
    const load = sel.dashboardVenueLoad();
    const barangays = {};
    VENUES.filter(v => v.courts).forEach(v => { barangays[v.barangay] = true; });
    const busiest = load.length ? load.reduce((a, b) => (b.booked > a.booked ? b : a)) : null;
    return '<section class="card">' +
      '<div class="card-head"><div><h3>Where the play is</h3><p>' + load.length + ' venues · tap to open the map</p></div></div>' +
      '<div class="map-wrap" style="min-height:210px" data-goto="map" tabindex="0" role="button">' +
      CITYMAP.mini(st().venue) +
      '<div class="map-card-float">' +
      '<span class="avatar" style="width:44px;height:44px;font-size:13px;background:linear-gradient(140deg,#f4a036,#e0607e);position:absolute;top:-24px;left:16px">' +
      esc((busiest ? busiest.name : 'MC').slice(0, 2).toUpperCase()) + '</span>' +
      '<div style="display:flex;align-items:center;gap:12px;margin-top:8px">' +
      '<span style="font-size:30px;font-weight:800;letter-spacing:-.04em">' + s.courtsAvailable + '</span>' +
      '<span style="font-size:11px;font-weight:700;color:var(--ink-3);line-height:1.25">Courts<br>free now</span>' +
      '<button class="round-solid" style="width:38px;height:38px;margin-left:auto" data-goto="map" aria-label="Open the city map">' + icon('arrow-up-right', 16) + '</button></div>' +
      '<div class="stats"><div>Barangays<b>' + Object.keys(barangays).length + '</b></div>' +
      '<div>Courts<b>' + s.courts + '</b></div></div>' +
      '</div></div></section>';
  }

  function dealsCard() {
    const mode = st().deal || 'months';
    return '<section class="card sp3">' +
      '<div class="card-head"><div style="display:flex;align-items:center;gap:10px"><h3>Revenue</h3>' +
      '<span class="tagline tg-neutral">' + esc(sel.fmtDate(Store.addDays(today(), -1))) + ' back to today counted</span></div>' +
      '<div class="card-tools"><div class="seg">' +
      [{ id: 'months', label: 'Last 7 months' }, { id: 'days', label: 'Last 30 days' }].map(x =>
        '<button data-ddeal="' + x.id + '" class="' + (mode === x.id ? 'is-active' : '') + '">' + x.label + '</button>').join('') +
      '</div><button class="mini-btn round" data-dexport="deal" title="Download as CSV" aria-label="Download revenue">' + icon('download', 15) + '</button></div></div>' +
      '<div id="dashDeal">' + dealBody(mode) + '</div></section>';
  }

  function dealBody(mode) {
    const d = dealSeries(mode);
    return barChart(d, 260);
  }

  /* ============================================================
     layouts
     ============================================================ */
  function court(variantHead) {
    return DASH.head(variantHead.title, variantHead.sub) +
      kpiRow() +
      '<div class="grid court-grid">' +
      programCard() + perfCard() + todayCard() + drillCard() + ladderCard() +
      pendingCard() + availCard() + mapCard() + activityCard() +
      '</div>';
  }

  function clay(variantHead) {
    return DASH.head(variantHead.title, variantHead.sub) +
      kpiRow() +
      '<div class="grid clay-grid">' +
      searchCard() + statCards() + moneyCard() + heroCard() + notesCard() + miniMapCard() +
      dealsCard() + availCard() + todayCard() + activityCard() + ladderCard() +
      '</div>';
  }

  /* ============================================================
     wiring — one delegated listener on the container this page
     just created, so nothing stacks up on re-render
     ============================================================ */
  function wire(root) {
    function redrawPerf() {
      const box = root.querySelector('#dashPerf');
      if (box) box.innerHTML = perfBody(st().range || 'Week');
    }
    function redrawDeal() {
      const box = root.querySelector('#dashDeal');
      if (box) box.innerHTML = dealBody(st().deal || 'months');
    }
    function redrawAvail() {
      const box = root.querySelector('#dashAvail');
      /* the card rewrites itself, so swap the element and re-find it */
      if (box) box.outerHTML = availCard();
    }

    root.addEventListener('click', e => {
      const t = e.target;

      const range = t.closest('[data-drange]');
      if (range) {
        st().range = range.dataset.drange;
        root.querySelectorAll('[data-drange]').forEach(b => b.classList.toggle('is-active', b === range));
        const head = root.querySelector('#dashPerf');
        const sub = head && head.closest('.card') ? head.closest('.card').querySelector('.card-head p') : null;
        if (sub) sub.textContent = perfSeries(st().range).title + ' · straight from the booking and match records';
        return redrawPerf();
      }

      const deal = t.closest('[data-ddeal]');
      if (deal) {
        st().deal = deal.dataset.dddeal;
        root.querySelectorAll('[data-ddeal]').forEach(b => b.classList.toggle('is-active', b === deal));
        return redrawDeal();
      }

      const exp = t.closest('[data-dexport]');
      if (exp) {
        if (exp.dataset.dexport === 'perf') {
          const d = perfSeries(st().range || 'Week');
          const n = UI.csv('club-activity-' + (st().range || 'Week').toLowerCase() + '.csv', d.columns, d.rows);
          return UI.toast(n + ' row(s) exported from the activity chart');
        }
        const d = dealSeries(st().deal || 'months');
        const n = UI.csv('revenue-' + (st().deal || 'months') + '.csv', d.columns, d.rows);
        return UI.toast(n + ' row(s) exported from the revenue chart');
      }

      const expand = t.closest('[data-dexpand]');
      if (expand && expand.dataset.dexpand === 'perf') {
        const range = st().range || 'Week';
        const data = perfSeries(range);
        return UI.modal({
          title: 'Club activity · ' + data.title,
          sub: 'The same rows behind the chart, ready to read or hand to the board',
          wide: true,
          body: '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
            data.columns.map(c => '<th>' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>' +
            data.rows.map(r => '<tr>' + data.columns.map(c => '<td class="mono">' + esc(String(r[c.key])) + '</td>').join('') + '</tr>').join('') +
            '</tbody></table></div>',
          actions: [{ id: 'csv', label: 'Download CSV', cls: 'ghost' }, { id: 'print', label: 'Print', cls: 'primary' }],
          onAction(id, scope, done) {
            if (id === 'csv') UI.csv('club-activity.csv', data.columns, data.rows);
            if (id === 'print') UI.print('Club activity · ' + data.title,
              '<table><tr><th>' + data.columns.map(c => c.label).join('</th><th>') + '</th></tr>' +
              data.rows.map(r => '<tr><td>' + data.columns.map(c => String(r[c.key])).join('</td><td>') + '</td></tr>').join('') + '</table>');
            done();
          }
        });
      }

      const drill = t.closest('[data-ddrill]');
      if (drill) {
        const res = Store.ops.toggleDrill(drill.dataset.ddrill);
        if (!res.ok) return UI.toast('That drill could not be updated.', 'err');
        return UI.toast(drill.dataset.ddrill + (res.done ? ' ticked off' : ' reopened'));
      }

      const day = t.closest('[data-ddate]');
      if (day) { st().dashDate = day.dataset.ddate; return redrawAvail(); }

      const step = t.closest('[data-dstep]');
      if (step) {
        st().dashDate = Store.addDays(dashDate(), Number(step.dataset.dstep) * 7);
        return redrawAvail();
      }

      const booked = t.closest('[data-dbooked]');
      if (booked) return go('booking', booked.dataset.dbooked);

      const free = t.closest('[data-dfree]');
      if (free) {
        const p = free.dataset.dfree.split('|');
        st().seed = { courtId: p[0], date: p[1], start: p[2] };
        return go('booking', 'new');
      }

      if (t.closest('[data-drefresh]')) { redrawAvail(); return UI.toast('Availability re-read from the booking records', 'info'); }

      const sbtn = t.closest('[data-dsearch]');
      if (sbtn) {
        const box = root.querySelector('#dashSearch');
        if (!box.value.trim()) return UI.toast('Type at least two characters to search.', 'warn');
        return dashSearch(box.value);
      }

      const prog = t.closest('[data-program]');
      if (prog && !t.closest('[data-enroll]')) {
        root.querySelectorAll('[data-program]').forEach(p => p.classList.remove('is-active'));
        prog.classList.add('is-active');
        return UI.toast(PROGRAMS.filter(x => x.id === prog.dataset.program)[0].title + ' selected', 'info');
      }
    });

    root.addEventListener('change', e => {
      if (e.target.id === 'dashVenue') { st().venue = e.target.value; return redrawAvail(); }
    });

    root.addEventListener('input', e => {
      if (e.target.id === 'dashSearch') return dashSearch(e.target.value);
      if (e.target.id === 'dashProg') {
        const q = e.target.value.trim().toLowerCase();
        root.querySelectorAll('[data-prog-search]').forEach(card => {
          card.hidden = !!q && card.dataset.progSearch.indexOf(q) === -1;
        });
      }
    });

    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'dashSearch') { e.preventDefault(); return dashSearch(e.target.value); }
      const act = e.target.closest('[data-goto],[data-pin],[data-ddrill],[data-dfree]');
      if (act) { e.preventDefault(); act.click(); }
    });
  }

  /* ============================================================
     page
     ============================================================ */
  const dashPage = {
    live: true,
    instant: true,
    render(host) {
      const variant = st().variant || 'court';
      const heads = {
        court: { title: 'Dashboard', sub: 'Welcome back to ' + Store.settings.club.full + ' — every card below reads the live club records.' },
        clay: { title: Store.settings.club.name + ' Operations', sub: 'Live operations · ' + Store.settings.club.address }
      };
      const wrap = document.createElement('div');
      wrap.className = 'dash-root';
      wrap.innerHTML = variant === 'court' ? court(heads.court) : clay(heads.clay);
      host.appendChild(wrap);
      wire(wrap);
      if (window.DASHMAP) DASHMAP.mount(wrap);

      /* keep the inline search panel from opening empty */
      const box = wrap.querySelector('#dashResults');
      if (box) dashSearch('');
    }
  };

  Object.assign(PAGES, { dashboard: dashPage });
})();
