/* ============================================================
   Play module — Match management + Leagues & Ladder.

   Registers the `matches` and `leagues` routes. Everything on
   screen is read through Store.sel.* or computed over
   Store.list(...); every write happens in an event handler,
   never inside render().
   ============================================================ */

const PLAY = (function () {
  const MATCH_TYPES = ["Men's Doubles", "Women's Doubles", "Mixed Doubles", 'Singles'];
  const QUICK = ['Today', 'Next 7 days', 'Results', 'All'];

  /* page-local UI state — not store state, survives re-renders */
  const ui = {
    quick: 'All',
    history: '',
    league: null,
    div: '',
    lstatus: '',
    lq: ''
  };

  /* ---------------- shared helpers ---------------- */
  function teamLabel(t) {
    if (Array.isArray(t)) return t.filter(Boolean).join(' / ');
    return String(t === null || t === undefined ? '' : t);
  }

  function scoreText(m) {
    return m.scoreA === null || m.scoreB === null || m.scoreA === undefined ? '—' : m.scoreA + ' – ' + m.scoreB;
  }

  function decide(a, b) { return a < b ? 1 : a > b ? -1 : 0; }

  /* ============================================================
     MATCHES
     ============================================================ */
  function matchesRows() {
    const ms = Store.list('matches').slice();
    const d0 = Store.today();
    if (ui.quick === 'Today') return ms.filter(m => m.date === d0);
    if (ui.quick === 'Next 7 days') return ms.filter(m => m.date >= d0 && m.date <= Store.addDays(d0, 7));
    if (ui.quick === 'Results') return ms.filter(m => m.status === 'completed');
    return ms;
  }

  function uniqueCourts() {
    const seen = {};
    Store.list('matches').forEach(m => { if (m.courtId && !seen[m.courtId]) seen[m.courtId] = Store.sel.courtName(m.courtId); });
    return Object.keys(seen).map(id => ({ value: id, label: seen[id] })).sort((a, b) => a.label.localeCompare(b.label));
  }

  function uniqueTypes() {
    const seen = {};
    Store.list('matches').forEach(m => { if (m.type) seen[m.type] = 1; });
    return Object.keys(seen).map(t => ({ value: t, label: t }));
  }

  function kpiStrip() {
    const s = Store.sel.stats();
    const ms = Store.list('matches');
    const cut = Store.addDays(Store.today(), -13);
    const fortnight = ms.filter(m => m.status === 'completed' && m.date >= cut && m.date <= Store.today()).length;
    const winsA = ms.filter(m => m.status === 'completed' && m.winner === 'A').length;
    const winsB = ms.filter(m => m.status === 'completed' && m.winner === 'B').length;
    return '<div class="kpi-grid">' +
      UI.kpi({ icon: 'calendar', label: 'Upcoming', value: s.upcomingMatches, sub: 'matches still to be played' }) +
      UI.kpi({ icon: 'paddle', label: 'Live now', value: s.liveMatches, sub: 'results being scored on court' }) +
      UI.kpi({ icon: 'trophy', label: 'Completed this fortnight', value: fortnight, sub: 'final results logged in the last 14 days' }) +
      UI.kpi({ icon: 'medal', label: 'Win–loss tally', value: winsA + ' – ' + winsB, sub: 'Team A vs Team B across all decided matches' }) +
      '</div>';
  }

  function teamsCell(m) {
    const a = teamLabel(m.teamA), b = teamLabel(m.teamB);
    const win = m.status === 'completed' || m.status === 'live';
    return '<div class="who" style="flex-direction:column;align-items:flex-start;gap:1px">' +
      '<b' + (win && m.winner === 'A' ? ' style="color:var(--accent)"' : '') + '>' + UI.esc(a) + '</b>' +
      '<em>vs</em>' +
      '<b' + (win && m.winner === 'B' ? ' style="color:var(--accent)"' : '') + '>' + UI.esc(b) + '</b></div>';
  }

  function matchTableCfg() {
    return {
      id: 'play-matches',
      rows: matchesRows,
      rowId: m => m.id,
      per: 10,
      search: true,
      searchLabel: 'Search teams, round, code…',
      searchKeys: [
        m => teamLabel(m.teamA),
        m => teamLabel(m.teamB),
        m => m.round || '',
        m => m.code || ''
      ],
      columns: [
        {
          key: 'code', label: 'Code · round', width: '150px',
          render: m => '<b class="mono">' + UI.esc(m.code) + '</b><div class="dim" style="font-size:12px">' + UI.esc(m.round) + '</div>',
          sortValue: m => m.code, filterValue: m => m.code
        },
        { key: 'type', label: 'Type', render: m => UI.esc(m.type), sortValue: m => m.type },
        { key: 'teams', label: 'Fixture', render: teamsCell },
        {
          key: 'court', label: 'Court', sortable: true,
          render: m => UI.esc(Store.sel.courtName(m.courtId)),
          sortValue: m => Store.sel.courtName(m.courtId),
          filterValue: m => m.courtId
        },
        {
          key: 'date', label: 'When', sortable: true,
          render: m => Store.sel.fmtDate(m.date) + ' <span class="dim">' + UI.esc(m.time) + '</span>',
          sortValue: m => m.date + ' ' + m.time
        },
        {
          key: 'score', label: 'Score', align: 'center', sortable: true,
          render: m => '<span class="mono"><b>' + scoreText(m) + '</b></span>',
          sortValue: m => m.scoreA === null || m.scoreA === undefined ? -1 : Number(m.scoreA) + Number(m.scoreB)
        },
        {
          key: 'winner', label: 'Winner',
          render: m => !m.winner ? '<span class="dim">—</span>'
            : '<span style="font-weight:700">' + icon('trophy', 13) + ' ' + UI.esc(teamLabel(m.winner === 'A' ? m.teamA : m.teamB)) + '</span>',
          sortValue: m => m.winner ? teamLabel(m.winner === 'A' ? m.teamA : m.teamB) : ''
        },
        { key: 'status', label: 'Status', render: m => UI.badge(m.status) }
      ],
      filters: [
        { key: 'status', label: 'All statuses', options: [{ value: 'live', label: 'Live' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }] },
        { key: 'court', label: 'All courts', options: uniqueCourts() },
        { key: 'type', label: 'All formats', options: uniqueTypes() }
      ],
      rowActions: m =>
        UI.actionBtn('score', m.status === 'completed' ? 'Update score' : 'Enter score', 'accent', 'target') +
        UI.actionBtn('edit', 'Edit match', '', 'pen') +
        UI.actionBtn('del', 'Cancel & delete match', 'danger', 'trash'),
      onAction: (act, m) => {
        if (!m) return;
        if (act === 'score') openScoreModal(m);
        else if (act === 'edit') openMatchForm(m);
        else if (act === 'del') removeMatch(m);
      },
      emptyTitle: 'No matches in this window.',
      emptySub: 'Change the quick filter, clear a filter, or schedule a match.'
    };
  }

  function historyDefault() {
    const done = Store.list('matches').filter(m => m.status === 'completed');
    if (done.length) return 'court:' + done.slice().sort((a, b) => decide(a.date, b.date))[0].courtId;
    const c = Store.list('courts')[0];
    return c ? 'court:' + c.id : '';
  }

  function historyRows() {
    const sel = ui.history || historyDefault();
    const sep = sel.indexOf(':');
    const kind = sel.slice(0, sep), val = sel.slice(sep + 1);
    let rows = Store.list('matches').filter(m => m.status === 'completed');
    rows = kind === 'court'
      ? rows.filter(m => m.courtId === val)
      : rows.filter(m => (m.teamAIds || []).indexOf(val) > -1 || (m.teamBIds || []).indexOf(val) > -1);
    return rows.sort((a, b) => decide(a.date, b.date) || decide(a.time, b.time));
  }

  function historyOptionsHtml() {
    const sel = ui.history || historyDefault();
    const courts = Store.list('courts').slice().sort((a, b) => a.name.localeCompare(b.name));
    const players = Store.list('players').slice().sort((a, b) => a.name.localeCompare(b.name));
    const opt = (v, l) => '<option value="' + UI.esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + UI.esc(l) + '</option>';
    return '<optgroup label="Courts">' + courts.map(c => opt('court:' + c.id, c.name)).join('') +
      '</optgroup><optgroup label="Players">' + players.map(p => opt('player:' + p.id, p.name)).join('') + '</optgroup>';
  }

  function historyListHtml() {
    const rows = historyRows();
    if (!rows.length) return UI.empty('paddle', 'No completed matches for this selection.', 'Once a result is entered it will appear here, newest first.');
    return '<div class="day-list">' + rows.slice(0, 10).map(m =>
      '<div class="day-row" data-mp-match="' + UI.esc(m.id) + '">' +
      '<time>' + Store.sel.fmtDate(m.date) + '<em>' + UI.esc(m.time) + '</em></time>' +
      '<div><b>' + UI.esc(teamLabel(m.teamA)) + ' vs ' + UI.esc(teamLabel(m.teamB)) + '</b>' +
      '<em>' + UI.esc(Store.sel.courtName(m.courtId)) + ' · ' + UI.esc(m.round) + '</em></div>' +
      UI.badge('confirmed', (m.winner === 'A' ? teamLabel(m.teamA) : teamLabel(m.teamB)) + ' won ' + scoreText(m)) +
      '</div>').join('') + '</div>' +
      (rows.length > 10 ? '<p class="dim" style="margin:12px 0 0;font-size:12.5px">' + (rows.length - 10) + ' older result(s) hidden.</p>' : '');
  }

  function fixturesHtml() {
    const evs = Store.sel.eventsOn(Store.today()).filter(ev => ev.kind === 'Match');
    if (!evs.length) return UI.empty('calendar', 'No match fixtures on any court today.', 'Scheduled matches for today are grouped by court here.');
    const byCourt = {};
    evs.forEach(ev => { (byCourt[ev.courtId] = byCourt[ev.courtId] || []).push(ev); });
    return Object.keys(byCourt).map(courtId =>
      '<div class="section-title" style="margin:18px 0 10px">' + icon('court', 14) + ' ' + UI.esc(Store.sel.courtName(courtId)) + '</div>' +
      '<div class="day-list">' + byCourt[courtId].map(ev => {
        const m = Store.get('matches', ev.id);
        if (!m) return '';
        return '<div class="day-row" data-mp-match="' + UI.esc(m.id) + '">' +
          '<time>' + UI.esc(ev.at) + '</time>' +
          '<div><b>' + UI.esc(teamLabel(m.teamA)) + ' vs ' + UI.esc(teamLabel(m.teamB)) + '</b>' +
          '<em>' + UI.esc(m.round) + ' · ' + UI.esc(m.type) + '</em></div>' +
          UI.badge(m.status) + '</div>';
      }).join('') + '</div>').join('');
  }

  /* ---------------- match workflows ---------------- */
  function openMatchForm(m) {
    const edit = !!m;
    UI.formModal({
      title: edit ? 'Edit match ' + m.code : 'Schedule a match',
      sub: edit ? 'Move or re-book the fixture — the result stays as logged.' : 'Pick a free court slot — clashes with a booking are rejected.',
      wide: true,
      fields: [
        { name: 'teamA', label: 'Team A', col: 1, required: true, value: edit ? teamLabel(m.teamA) : '', placeholder: 'Amina / Soraya' },
        { name: 'teamB', label: 'Team B', col: 1, required: true, value: edit ? teamLabel(m.teamB) : '', placeholder: 'Josef / Emil' },
        { name: 'type', label: 'Match type', type: 'select', col: 1, value: edit ? m.type : MATCH_TYPES[2], options: MATCH_TYPES.map(t => ({ value: t, label: t })) },
        { name: 'round', label: 'Section / round', col: 1, required: true, value: edit ? m.round : '', placeholder: 'Ranao Lake League · MD' },
        { name: 'courtId', label: 'Court', type: 'select', col: 1, required: true, value: edit ? m.courtId : '', placeholder: 'Choose a court…', options: UI.courtOptions() },
        { name: 'date', label: 'Date', type: 'date', col: 1, required: true, value: edit ? m.date : Store.today() },
        { name: 'time', label: 'Start time', type: 'time', col: 1, required: true, value: edit ? m.time : '09:00' },
        { name: 'gameTo', label: 'Game to', type: 'number', col: 1, value: edit ? m.gameTo : 11, min: 5, max: 21, help: 'Points to win a game; deuce applies at the ceiling.' }
      ],
      submitLabel: edit ? 'Save changes' : 'Schedule match',
      onSubmit: v => (edit ? Store.ops.updateMatch(m.id, v) : Store.ops.scheduleMatch(v)),
      onDone: res => {
        if (!edit && res.ok && res.match) UI.toast(res.match.code + ' scheduled on ' + Store.sel.courtName(res.match.courtId) + ', ' + Store.sel.fmtDate(res.match.date) + ' ' + res.match.time);
        if (edit && res.ok) UI.toast(m.code + ' updated');
      }
    });
  }

  function openScoreModal(m) {
    UI.formModal({
      title: (m.status === 'completed' ? 'Update score · ' : 'Enter score · ') + m.code,
      sub: 'Type only the two scores — the winner is derived, never picked.',
      footerNote: 'Games are played to ' + (m.gameTo || 11) + ' and must be won by two at the ceiling. Ladder points move when the result is saved.',
      fields: [
        { type: 'static', label: 'Team A', value: teamLabel(m.teamA), col: 1 },
        { type: 'static', label: 'Team B', value: teamLabel(m.teamB), col: 1 },
        { name: 'scoreA', label: 'Score · Team A', type: 'number', col: 1, min: 0, max: 30, value: m.scoreA === null || m.scoreA === undefined ? '' : String(m.scoreA) },
        { name: 'scoreB', label: 'Score · Team B', type: 'number', col: 1, min: 0, max: 30, value: m.scoreB === null || m.scoreB === undefined ? '' : String(m.scoreB) }
      ],
      submitLabel: m.status === 'completed' ? 'Update result' : 'Confirm result',
      onSubmit: v => {
        const res = Store.ops.enterScore(m.id, v.scoreA, v.scoreB);
        if (res && !res.ok && res.errors && res.errors.score) {
          return { ok: false, errors: { scoreA: res.errors.score, scoreB: res.errors.score } };
        }
        return res;
      },
      onDone: res => {
        /* m is the live store row — enterScore has already written the final scores onto it */
        if (res.ok) UI.toast(teamLabel(res.winner) + ' win ' + scoreText(m) + ' — ladder points updated');
      }
    });
  }

  function removeMatch(m) {
    UI.confirm({
      title: 'Cancel & delete match?',
      body: teamLabel(m.teamA) + ' vs ' + teamLabel(m.teamB) + ' (' + m.code + ') will be removed from the draw.',
      detail: m.status === 'completed' ? 'The logged result ' + scoreText(m) + ' is deleted too.' : 'The court slot is released.',
      okLabel: 'Delete match', danger: true
    }).then(ok => {
      if (!ok) return;
      const res = Store.ops.deleteMatch(m.id);
      if (!res.ok) { UI.toast((res.errors && res.errors.id) || 'Match could not be deleted.', 'err'); return; }
      UI.toast(m.code + ' removed from the draw', 'info');
    });
  }

  function playersHtml(ids, fallback) {
    const real = (ids || []).map(id => Store.sel.playerById(id)).filter(Boolean);
    if (!real.length) return '<b>' + UI.esc(fallback) + '</b>';
    return real.map(p => '<button class="linkish" data-mp-player="' + UI.esc(p.id) + '">' + UI.esc(p.name) + '</button>').join(' + ');
  }

  function openMatchDetail(m) {
    const court = Store.get('courts', m.courtId);
    UI.modal({
      title: m.code + ' · ' + m.round,
      sub: m.type + ' · game to ' + (m.gameTo || 11),
      body: '<dl class="kv">' +
        '<dt>Team A</dt><dd>' + playersHtml(m.teamAIds, teamLabel(m.teamA)) + (m.winner === 'A' ? ' ' + UI.badge('confirmed', 'Winner') : '') + '</dd>' +
        '<dt>Team B</dt><dd>' + playersHtml(m.teamBIds, teamLabel(m.teamB)) + (m.winner === 'B' ? ' ' + UI.badge('confirmed', 'Winner') : '') + '</dd>' +
        '<dt>Court</dt><dd>' + UI.esc(Store.sel.courtName(m.courtId)) + ' <span class="dim">· ' + UI.esc(court ? Store.sel.venueName(court.venueId) : '—') + '</span></dd>' +
        '<dt>When</dt><dd>' + Store.sel.fmtDate(m.date) + ' at ' + UI.esc(m.time) + '</dd>' +
        '<dt>Status</dt><dd>' + UI.badge(m.status) + '</dd>' +
        '<dt>Score</dt><dd class="mono">' + scoreText(m) + '</dd>' +
        '</dl>',
      actions: [{ id: 'score', label: m.status === 'completed' ? 'Update score' : 'Enter score', cls: 'primary' }],
      onAction: id => {
        /* returning undefined lets the modal close itself once the score form is up */
        if (id === 'score') openScoreModal(m);
      },
      onOpen: (scope, done) => {
        scope.addEventListener('click', e => {
          const p = e.target.closest('[data-mp-player]');
          if (!p) return;
          done();
          go('members', p.dataset.mpPlayer);
        });
      }
    });
  }

  /* ---------------- matches page ---------------- */
  function renderMatches(host) {
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="page-head"><div><h2>Match Management</h2><p>Fixtures, live scoring and results across every ' + UI.esc(Store.settings.club.city) + ' court. Winners are always derived from the score.</p></div>' +
      '<div class="page-tools"><button class="pill-btn primary" data-mp-new>' + icon('plus', 16) + ' Schedule match</button></div></div>' +
      kpiStrip() +
      '<section class="panel" style="margin-top:22px">' +
      '<div class="panel-head"><div><h3>Fixtures &amp; results</h3><p>Click a row for full match detail.</p></div>' +
      UI.seg(QUICK, ui.quick, 'data-mp-quick') + '</div>' +
      '<div id="playMatchTable"></div></section>' +
      '<div class="split" style="margin-top:22px;grid-template-columns:minmax(0,1fr) minmax(0,1fr)">' +
      '<section class="panel"><div class="panel-head"><div><h3>Fixtures by court · today</h3><p>' + Store.sel.fmtDate(Store.today()) + '</p></div></div>' +
      '<div id="playFixtures">' + fixturesHtml() + '</div></section>' +
      '<section class="panel"><div class="panel-head"><div><h3>Match history</h3><p>Completed results, newest first.</p></div>' +
      '<select data-mp-history style="padding:9px 13px;border-radius:12px;border:1px solid var(--card-brd);background:var(--card-solid);color:var(--ink-2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer">' + historyOptionsHtml() + '</select></div>' +
      '<div id="playHistory">' + historyListHtml() + '</div></section></div>';
    host.appendChild(wrap);

    const table = UI.table(wrap.querySelector('#playMatchTable'), matchTableCfg());

    wrap.addEventListener('click', e => {
      const quick = e.target.closest('[data-mp-quick]');
      if (quick) {
        ui.quick = quick.dataset.mpQuick;
        Array.from(quick.parentNode.children).forEach(b => b.classList.remove('is-active'));
        quick.classList.add('is-active');
        table.state.page = 1;
        table.draw();
        return;
      }
      if (e.target.closest('[data-mp-new]')) return openMatchForm(null);
      const link = e.target.closest('[data-mp-match]');
      if (link) { const lm = Store.get('matches', link.dataset.mpMatch); if (lm) return openMatchDetail(lm); }
      if (e.target.closest('[data-row-act]')) return;
      const tr = e.target.closest('tr[data-row]');
      if (tr) { const m = Store.get('matches', tr.dataset.row); if (m) openMatchDetail(m); }
    });
    wrap.addEventListener('change', e => {
      const h = e.target.closest('[data-mp-history]');
      if (h) { ui.history = h.value; wrap.querySelector('#playHistory').innerHTML = historyListHtml(); }
    });

    const st = PMSTATE();
    if (st.focus === 'new') { st.focus = null; openMatchForm(null); }
    else if (st.focus) {
      const fm = Store.get('matches', st.focus);
      if (fm) { st.focus = null; openMatchDetail(fm); }
    }
  }

  /* ============================================================
     LEAGUES & LADDER
     ============================================================ */
  function leagueMatches(l) {
    const needle = String(l.name).toLowerCase();
    return Store.list('matches').filter(m => String(m.round || '').toLowerCase().indexOf(needle) > -1);
  }

  function standingsFor(l) {
    const table = {};
    leagueMatches(l).filter(m => m.status === 'completed' && m.winner).forEach(m => {
      const a = teamLabel(m.teamA), b = teamLabel(m.teamB);
      table[a] = table[a] || { name: a, played: 0, won: 0, lost: 0, pts: 0, gd: 0 };
      table[b] = table[b] || { name: b, played: 0, won: 0, lost: 0, pts: 0, gd: 0 };
      table[a].played++; table[b].played++;
      const diff = Number(m.scoreA) - Number(m.scoreB);
      table[a].gd += diff; table[b].gd -= diff;
      if (m.winner === 'A') { table[a].won++; table[a].pts += 3; table[b].lost++; }
      else { table[b].won++; table[b].pts += 3; table[a].lost++; }
    });
    return Object.keys(table).map(k => table[k]).sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.won - x.won || x.name.localeCompare(y.name));
  }

  function filteredLeagues() {
    const q = ui.lq.trim().toLowerCase();
    return Store.list('leagues').filter(l => {
      if (ui.div && l.div !== ui.div) return false;
      if (ui.lstatus && l.status !== ui.lstatus) return false;
      if (!q) return true;
      if (String(l.name).toLowerCase().indexOf(q) > -1 || String(l.div).toLowerCase().indexOf(q) > -1) return true;
      return leagueMatches(l).some(m => teamLabel(m.teamA).toLowerCase().indexOf(q) > -1 || teamLabel(m.teamB).toLowerCase().indexOf(q) > -1);
    });
  }

  function leagueCard(l) {
    const ms = leagueMatches(l);
    const done = ms.filter(m => m.status === 'completed').length;
    const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
    const sel = ui.league === l.id;
    return '<article class="card kpi-card">' +
      '<div class="kpi-top"><span class="kpi-slab">' + icon('ladder', 22) + '</span>' + UI.badge(l.status) + '</div>' +
      '<b style="font-size:18px;letter-spacing:-.02em">' + UI.esc(l.name) + '</b>' +
      '<span class="kpi-label">' + UI.esc(l.div) + '</span>' +
      '<div class="tiles">' +
      '<div class="tile"><span>Teams</span><b>' + l.teams + '</b></div>' +
      '<div class="tile"><span>Played</span><b>' + done + '</b></div>' +
      '<div class="tile"><span>Prize pool</span><b class="mono" style="font-size:15px">' + money(l.pot) + '</b></div>' +
      '</div>' +
      '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
      '<span class="kpi-sub">' + (ms.length ? done + ' of ' + ms.length + ' published fixtures decided' : 'No fixtures published yet') + ' · ends ' + UI.esc(l.ends) + '</span>' +
      '<div style="margin-top:6px"><button class="pill-btn sm ' + (sel ? 'primary' : 'ghost') + '" data-mp-league="' + UI.esc(l.id) + '">' +
      (sel ? 'Viewing standings' : 'View standings') + '</button></div></article>';
  }

  function standingsHtml() {
    const l = ui.league ? Store.get('leagues', ui.league) : null;
    if (!l) return UI.empty('ladder', 'Pick a league to see its standings.', 'Select one of the competitions above.');
    const rows = standingsFor(l);
    const head = '<div class="panel-head"><div><h3>' + UI.esc(l.name) + ' · standings</h3><p>' + UI.esc(l.div) + ' — tallied from completed matches in this league. Win = 3 points.</p></div></div>';
    if (!rows.length) return head + UI.empty('calendar', 'Fixtures have not been published yet.', 'No league matches for “' + UI.esc(l.name) + '” in the draw — standings appear as soon as results are logged.');
    return head + '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th style="width:44px">#</th><th>Team</th><th class="ta-c">P</th><th class="ta-c">W</th><th class="ta-c">L</th><th class="ta-c">Pts</th><th class="ta-c">GD</th>' +
      '</tr></thead><tbody>' + rows.map((r, i) =>
        '<tr><td class="mono">' + (i + 1) + '</td><td><b>' + UI.esc(r.name) + '</b></td>' +
        '<td class="ta-c mono">' + r.played + '</td><td class="ta-c mono">' + r.won + '</td><td class="ta-c mono">' + r.lost + '</td>' +
        '<td class="ta-c mono"><b>' + r.pts + '</b></td>' +
        '<td class="ta-c mono">' + (r.gd > 0 ? '+' : '') + r.gd + '</td></tr>').join('') +
      '</tbody></table></div>';
  }

  function ladderHtml() {
    const rows = Store.sel.leaderboard(15);
    if (!rows.length) return UI.empty('users', 'No ranked players yet.', 'Active members appear here once they have ladder points.');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th style="width:44px">#</th><th>Player</th><th class="ta-c">Played</th><th class="ta-c">Record</th><th class="ta-c">Points</th><th class="ta-c">Level</th>' +
      '</tr></thead><tbody>' + rows.map(r => {
        return '<tr><td class="mono"><b>' + r.rank + '</b></td>' +
          '<td><div class="who">' + UI.avatar(r.name, '#6b7cff', 'sm') +
          '<div><b><button class="linkish" data-mp-player="' + UI.esc(r.id) + '">' + UI.esc(r.name) + '</button></b>' +
          '<em>' + UI.esc(r.venue) + '</em></div></div></td>' +
          '<td class="ta-c mono">' + r.played + '</td>' +
          '<td class="ta-c mono"><span class="kpi-delta is-' + (r.won >= r.lost ? 'up' : 'down') + '">' + r.won + '–' + r.lost + '</span></td>' +
          '<td class="ta-c mono">' + nf.format(r.rating) + '</td>' +
          '<td class="ta-c mono">' + r.level.toFixed(1) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function drawLeagueSection(wrap) {
    if (ui.league && !Store.get('leagues', ui.league)) ui.league = null;
    const leagues = filteredLeagues();
    wrap.querySelector('#playLeagueCards').innerHTML = leagues.length
      ? '<div class="kpi-grid">' + leagues.map(leagueCard).join('') + '</div>'
      : UI.empty('search', 'No leagues match those filters.', 'Clear the search or pick another division.',
        '<button class="pill-btn ghost" data-mp-clearl>Clear filters</button>');
    wrap.querySelector('#playStandings').innerHTML = standingsHtml();
    wrap.querySelector('#playLadder').innerHTML = ladderHtml();
  }

  function renderLeagues(host) {
    const leagues = Store.list('leagues');
    if (!ui.league && leagues.length) ui.league = leagues[0].id;
    const divs = {}; leagues.forEach(l => { divs[l.div] = 1; });
    const statuses = {}; leagues.forEach(l => { statuses[l.status] = 1; });

    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="page-head"><div><h2>Leagues &amp; Ladder</h2><p>' + leagues.length + ' competitions running across ' + UI.esc(Store.settings.club.city) + '. Standings are tallied from real match results — nothing here is hardcoded.</p></div>' +
      '<div class="page-tools"><button class="pill-btn ghost" data-mp-lcsv>' + icon('download', 16) + ' Export ladder CSV</button></div></div>' +
      '<div class="dt-bar">' +
      '<label class="dt-search">' + icon('search', 16) + '<input type="search" data-mp-lq placeholder="Search league or team…" value="' + UI.esc(ui.lq) + '"></label>' +
      '<select data-mp-div><option value="">All divisions</option>' + Object.keys(divs).map(d => '<option value="' + UI.esc(d) + '"' + (ui.div === d ? ' selected' : '') + '>' + UI.esc(d) + '</option>').join('') + '</select>' +
      '<select data-mp-lstatus><option value="">All statuses</option>' + Object.keys(statuses).map(s => '<option value="' + UI.esc(s) + '"' + (ui.lstatus === s ? ' selected' : '') + '>' + UI.esc(s) + '</option>').join('') + '</select>' +
      '<span class="dt-count">' + leagues.length + ' competitions</span></div>' +
      '<div id="playLeagueCards" style="margin-top:6px"></div>' +
      '<section class="panel" id="playStandings" style="margin-top:22px"></section>' +
      '<section class="panel" style="margin-top:22px"><div class="panel-head"><div><h3>Club ladder · top 15</h3><p>Points and rating are maintained by the store as results are entered.</p></div>' +
      '<button class="pill-btn sm ghost" data-mp-lcsv>' + icon('download', 14) + ' CSV</button></div>' +
      '<div id="playLadder"></div></section>';
    host.appendChild(wrap);
    drawLeagueSection(wrap);

    wrap.addEventListener('click', e => {
      const card = e.target.closest('[data-mp-league]');
      if (card) { ui.league = card.dataset.mpLeague; drawLeagueSection(wrap); wrap.querySelector('#playStandings').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (e.target.closest('[data-mp-clearl]')) { ui.div = ''; ui.lstatus = ''; ui.lq = ''; wrap.querySelector('[data-mp-lq]').value = ''; drawLeagueSection(wrap); return; }
      if (e.target.closest('[data-mp-lcsv]')) {
        const rows = Store.sel.leaderboard(15);
        const n = UI.csv('marawi-ladder-top15.csv', [
          { label: 'Rank', key: 'rank' },
          { label: 'Player', key: 'name' },
          { label: 'Home venue', key: 'venue' },
          { label: 'Points', key: 'rating' },
          { label: 'Movement', key: 'delta' },
          { label: 'Level', key: 'level' }
        ], rows);
        UI.toast(n + ' ladder rows exported');
        return;
      }
      const p = e.target.closest('[data-mp-player]');
      if (p) go('members', p.dataset.mpPlayer);
    });
    wrap.addEventListener('input', e => {
      const q = e.target.closest('[data-mp-lq]');
      if (q) { ui.lq = q.value; drawLeagueSection(wrap); }
    });
    wrap.addEventListener('change', e => {
      if (e.target.closest('[data-mp-div]')) { ui.div = e.target.value; drawLeagueSection(wrap); }
      if (e.target.closest('[data-mp-lstatus]')) { ui.lstatus = e.target.value; drawLeagueSection(wrap); }
    });

    const st = PMSTATE();
    if (st.focus && Store.get('leagues', st.focus)) { ui.league = st.focus; st.focus = null; drawLeagueSection(wrap); }
    else if (st.focus === 'new') st.focus = null;
  }

  return {
    matches: { live: true, render: renderMatches },
    leagues: { live: true, render: renderLeagues }
  };
})();

Object.assign(PAGES, PLAY);
