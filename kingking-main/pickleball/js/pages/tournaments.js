/* ============================================================
   Tournaments & brackets
   Registration, seed, draw and results all live in the store, so
   entering a score is the only way a team advances — there is no
   winner field to type.
   ============================================================ */

(function () {
  const esc = s => UI.esc(s);

  const T_STATUS = {
    registration: 'Registration open',
    upcoming: 'Upcoming',
    ongoing: 'Ongoing',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  const EVENTS = ['Mixed Doubles', "Men's Doubles", "Women's Doubles", 'Singles'];
  const FORMATS = ['Single Elimination', 'Round Robin'];

  const isDoubles = t => String(t.event).toLowerCase().indexOf('singles') < 0;
  const canRegister = t => ['registration', 'upcoming'].indexOf(t.status) > -1;

  /* entry fees actually collected for one tournament */
  function collected(t) {
    return Store.list('payments')
      .filter(p => p.kind === 'Tournament entry' && p.refId === t.id && p.status === 'paid')
      .reduce((s, p) => s + p.amount, 0);
  }

  /* how far through the draw a tournament is */
  function progressOf(t) {
    if (t.bracket) {
      const slots = t.bracket.rounds.reduce((n, r) => n + r.slots.length, 0);
      const decided = t.bracket.rounds.reduce((n, r) => n + r.slots.filter(s => s.winner).length, 0);
      return { done: decided, total: slots, label: t.bracket.rounds.filter(r => r.slots.some(s => !s.winner && (s.teamA || s.teamB)))[0] };
    }
    if (t.standings) {
      const rows = Store.list('matches').filter(m => m.tournamentId === t.id);
      return { done: rows.filter(m => m.status === 'completed').length, total: rows.length, label: null };
    }
    return { done: 0, total: 0, label: null };
  }

  function matchesOf(t) {
    return Store.list('matches').filter(m => m.tournamentId === t.id);
  }

  function teamNames(t) {
    return t.teams.map(x => x.name.toLowerCase());
  }

  function playerChip(id) {
    const p = Store.get('players', id);
    if (!p) return '<span class="dim">Empty seat</span>';
    return '<button class="linkish" data-player="' + esc(p.id) + '">' + esc(p.name) + '</button>';
  }

  function feePaid(t, team) {
    return Store.list('payments').some(p =>
      p.kind === 'Tournament entry' && p.refId === t.id && p.status === 'paid' &&
      String(p.item).toLowerCase().indexOf(team.name.toLowerCase()) > -1);
  }

  /* ============================================================
     forms
     ============================================================ */

  function tournamentFields(t) {
    t = t || {};
    return [
      { name: 'name', label: 'Tournament name', type: 'text', col: 2, required: true, placeholder: 'Marawi Open 2027', value: t.name || '' },
      { name: 'event', label: 'Event', type: 'select', col: 1, required: true, placeholder: 'Select event…', options: EVENTS.map(x => ({ value: x, label: x })), value: t.event },
      { name: 'format', label: 'Format', type: 'select', col: 1, required: true, placeholder: 'Select format…', options: FORMATS.map(x => ({ value: x, label: x })), value: t.format },
      { name: 'venueId', label: 'Host venue', type: 'select', col: 1, required: true, placeholder: 'Select venue…', options: UI.venueOptions().filter(o => !/no decks yet/.test(o.label)), value: t.venueId },
      { name: 'status', label: 'Status', type: 'select', col: 1, options: Object.keys(T_STATUS).map(k => ({ value: k, label: T_STATUS[k] })), value: t.status || 'registration' },
      { name: 'start', label: 'Starts', type: 'date', col: 1, required: true, value: t.start || Store.addDays(Store.today(), 14) },
      { name: 'end', label: 'Ends', type: 'date', col: 1, required: true, value: t.end || Store.addDays(Store.today(), 15) },
      { name: 'entryFee', label: 'Entry fee (₱)', type: 'number', col: 1, required: true, min: 0, step: 50, value: t.entryFee === undefined ? 500 : t.entryFee },
      { name: 'maxTeams', label: 'Maximum teams', type: 'number', col: 1, required: true, min: 2, max: 128, value: t.maxTeams === undefined ? 16 : t.maxTeams },
      { name: 'prizePool', label: 'Prize pool (₱)', type: 'number', col: 2, min: 0, step: 500, value: t.prizePool === undefined ? 15000 : t.prizePool }
    ];
  }

  function tournamentFormModal(t, onDone) {
    UI.formModal({
      title: t ? 'Edit ' + t.name : 'Create a tournament',
      sub: t ? 'Changes apply to registration and the draw board straight away.' : 'Registration opens as soon as the tournament is saved.',
      fields: tournamentFields(t),
      submitLabel: t ? 'Save changes' : 'Create tournament',
      footerNote: 'Rounds are built automatically from the number of teams that register.',
      onSubmit(v) {
        const res = t ? Store.ops.updateTournament(t.id, v) : Store.ops.createTournament(v);
        if (res.ok) res.message = (t ? 'Tournament updated' : res.tournament.name + ' created · registration is open');
        return res;
      },
      onDone(res) { if (onDone) onDone(res); }
    });
  }

  function registerModal(t) {
    const taken = [];
    t.teams.forEach(x => x.playerIds.forEach(p => taken.push(p)));
    const opts = Store.list('players')
      .filter(p => p.status === 'active' && taken.indexOf(p.id) < 0)
      .sort((a, b) => b.rating - a.rating)
      .map(p => ({ value: p.id, label: p.name + ' · ' + Store.tierName(p.membership) + ' · ' + p.rating + ' pts' }));

    const fields = [
      { name: 'team', label: isDoubles(t) ? 'Team name' : 'Player entry name', type: 'text', col: 2, required: true,
        placeholder: isDoubles(t) ? 'Ranao Twins' : 'Entry name', value: '' },
      { name: 'playerA', label: 'Player 1', type: 'select', col: 1, required: true, placeholder: 'Select a member…', options: opts },
      { name: 'playerB', label: 'Player 2', type: 'select', col: 1, required: isDoubles(t), placeholder: 'Select partner…', options: opts }
    ];
    if (!isDoubles(t)) fields.splice(2, 1);

    UI.formModal({
      title: 'Register for ' + t.name,
      sub: t.event + ' · ' + money(t.entryFee) + ' entry fee · ' + t.teams.length + ' of ' + t.maxTeams + ' teams in',
      fields: fields,
      submitLabel: 'Register and charge entry',
      footerNote: 'The entry fee is posted to the payments ledger the moment the team is accepted.',
      onSubmit(v) {
        const res = Store.ops.registerTeam(t.id, v.team, v.playerA, isDoubles(t) ? v.playerB : '');
        if (res.ok) res.message = (v.team || 'Team') + ' entered ' + t.name + ' · ' + money(t.entryFee) + ' collected';
        return res;
      }
    });
  }

  /* ============================================================
     score entry — the bracket advances from here
     ============================================================ */

  function scoreModal(m, after) {
    UI.modal({
      size: 'sm', sticky: true,
      title: m.code + ' · ' + m.round,
      sub: m.teamA + ' vs ' + m.teamB + ' · games to ' + (m.gameTo || 11),
      body: UI.formHtml([
        { name: 'scoreA', label: m.teamA, type: 'number', col: 1, min: 0, max: 30, value: m.scoreA === null || m.scoreA === undefined ? '' : m.scoreA },
        { name: 'scoreB', label: m.teamB, type: 'number', col: 1, min: 0, max: 30, value: m.scoreB === null || m.scoreB === undefined ? '' : m.scoreB },
        { name: 'note', label: 'Winner', type: 'static', col: 2,
          html: '<div class="static-val dim">' + (m.winner ? esc(m.winner === 'A' ? m.teamA : m.teamB) + ' advances' : 'Set by the scores — cannot be typed') + '</div>' }
      ]),
      actions: [{ id: 'save', label: m.scoreA === null ? 'Save result' : 'Update result', cls: 'accent' }],
      onAction(id, scope, done) {
        if (id !== 'save') return;
        const v = UI.readForm(scope);
        const res = Store.ops.enterScore(m.id, v.scoreA, v.scoreB);
        if (!res.ok) {
          const e = { scoreA: res.errors.score, scoreB: res.errors.score };
          if (res.errors.id) e.scoreA = res.errors.id;
          UI.paintErrors(scope, e);
          UI.toast(res.errors.score || res.errors.id || 'Result rejected', 'err');
          return false;
        }
        done();
        UI.toast(res.winner + ' won ' + Math.max(m.scoreA, m.scoreB) + '–' + Math.min(m.scoreA, m.scoreB) +
          (m.bracket ? ' and advances' : ' — standings updated'), 'ok');
        if (after) after();
        return undefined;
      }
    });
  }

  /* ============================================================
     bracket + standings rendering
     ============================================================ */

  function bracketHtml(t) {
    return '<div class="bracket">' + t.bracket.rounds.map(round =>
      '<div class="br-round"><h4>' + esc(round.name) + '</h4>' + round.slots.map(slot => {
        const m = slot.matchId ? Store.get('matches', slot.matchId) : null;
        const playable = m && !m.winner && slot.teamA && slot.teamB;
        const score = m && m.winner !== null && m.winner !== undefined ? m.scoreA + '–' + m.scoreB : '';
        const line = (teamId, key) => {
          if (!teamId) return '<div class="br-team is-tbd"><span>Winner of ' + esc(round.name) + '</span></div>';
          const win = slot.winner === key;
          return '<div class="br-team' + (win ? ' is-win' : '') + '"><span>' + esc(teamNameOf(t, teamId)) + '</span>' +
            (win && score ? '<small>' + esc(score) + '</small>' : '') +
            (win ? icon('check', 15) : '') + '</div>';
        };
        return '<div class="br-match' + (playable ? ' is-clickable' : '') + '"' +
          (m ? ' data-score="' + esc(m.id) + '" title="' + (playable ? 'Enter this result' : 'Match detail') + '"' : '') + '>' +
          line(slot.teamA, 'A') + line(slot.teamB, 'B') +
          (playable ? '<div class="br-foot">Tap to enter score</div>' : '') +
          (m ? '<div class="br-when">' + esc(Store.fmtDate(m.date)) + ' · ' + esc(m.time) + ' · ' + esc(Store.sel.courtName(m.courtId)) + '</div>' : '') +
          '</div>';
      }).join('') + '</div>').join('') + '</div>';
  }

  const teamNameOf = (t, id) => { const x = t.teams.find(y => y.id === id); return x ? x.name : 'TBD'; };

  function standingsHtml(t) {
    const rows = Store.sel.standings(t.id);
    if (!rows.length) return UI.empty('trophy', 'No standings yet.', 'The schedule is published once the draw is built.');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Team</th><th class="ta-c">P</th><th class="ta-c">W</th><th class="ta-c">L</th><th class="ta-r">Pts</th></tr></thead><tbody>' +
      rows.map((s, i) => '<tr><td class="mono">' + (i + 1) + '</td><td><b>' + esc(s.name) + '</b></td>' +
        '<td class="ta-c mono">' + s.played + '</td><td class="ta-c mono">' + s.won + '</td><td class="ta-c mono">' + s.lost + '</td>' +
        '<td class="ta-r mono"><b>' + s.pts + '</b></td></tr>').join('') + '</tbody></table></div>';
  }

  function fixturesHtml(t) {
    const rows = matchesOf(t).slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    if (!rows.length) return '';
    return '<div class="section-title" style="margin-top:24px">Fixtures</div><div class="day-list">' +
      rows.map(m => '<div class="day-row"><div class="day-time mono">' + esc(Store.fmtDate(m.date).slice(0, 6)) + '<br>' + esc(m.time) + '</div>' +
        '<div class="who"><div style="min-width:0"><b>' + esc(m.teamA) + '</b><em class="dim">vs ' + esc(m.teamB) + '</em></div></div>' +
        '<div class="ta-r" style="flex:1"><span class="mono">' + (m.scoreA === null || m.scoreA === undefined ? '—' : m.scoreA + ' – ' + m.scoreB) + '</span> ' +
        (m.winner ? UI.badge('completed', (m.winner === 'A' ? m.teamA : m.teamB) + ' win') :
          '<button class="pill-btn ghost sm" data-score="' + esc(m.id) + '">Enter score</button>') + '</div></div>').join('') + '</div>';
  }

  function teamsHtml(t) {
    if (!t.teams.length)
      return UI.empty('users', 'No teams registered yet.', canRegister(t) ? 'Use “Register team” to open the entry list.' : 'Registration for this tournament is closed.');
    return '<div class="team-list">' + t.teams.map(team =>
      '<div class="team-line"><span class="ava">' + icon('users', 15) + '</span>' +
      '<div class="tl-main"><b>' + esc(team.name) + '</b><em>' + team.playerIds.map(playerChip).join('<span class="dim"> · </span>') + '</em></div>' +
      '<div class="tl-side">' + (feePaid(t, team) ? UI.badge('paid', 'Fee paid') : UI.badge('pending', 'Fee due')) +
      (!t.bracket && !t.standings && canRegister(t) ? '<button class="pill-btn ghost sm" data-withdraw="' + esc(team.id) + '">Withdraw</button>' : '') +
      '</div></div>').join('') + '</div>';
  }

  /* ============================================================
     detail modal (live: redraws itself after every write)
     ============================================================ */

  function tournamentModal(t) {
    const id = t.id;
    let unsubscribe = null;
    const m = UI.modal({
      title: t.name,
      sub: t.event + ' · ' + t.format + ' · ' + Store.sel.venueName(t.venueId),
      wide: true,
      body: '<div id="tdWrap"></div>',
      actions: [
        { id: 'reg', label: 'Register team', cls: 'ghost' },
        { id: 'draw', label: 'Build the draw', cls: 'accent' },
        { id: 'edit', label: 'Edit', cls: 'ghost' }
      ],
      onClose() { if (unsubscribe) { unsubscribe(); unsubscribe = null; } },
      onAction(act, scope, done) {
        const cur = Store.get('tournaments', id);
        if (!cur) { done(); UI.toast('That tournament no longer exists.', 'err'); return; }
        if (act === 'reg') { if (!canRegister(cur)) return UI.toast('Registration is ' + T_STATUS[cur.status].toLowerCase() + '.', 'warn'); registerModal(cur); return false; }
        if (act === 'edit') { done(); tournamentFormModal(cur); return; }
        if (act === 'draw') {
          drawConfirm(cur, () => { done(); tournamentModal(Store.get('tournaments', id)); });
          return false;
        }
        return undefined;
      },
      onOpen(scope) {
        function draw() {
          const cur = Store.get('tournaments', id);
          const wrap = scope.querySelector('#tdWrap');
          if (!cur || !wrap) return;
          const prog = progressOf(cur);
          const open = canRegister(cur);
          const drawReady = !cur.bracket && !cur.standings && cur.teams.length >= 2 && cur.status !== 'cancelled';
          const footBtns = scope.querySelectorAll('[data-act]');
          const setBtn = (actId, on) => {
            for (let i = 0; i < footBtns.length; i++) {
              if (footBtns[i].dataset.act === actId) footBtns[i].style.display = on ? '' : 'none';
            }
          };
          setBtn('reg', open);
          setBtn('draw', drawReady);

          wrap.innerHTML =
            '<dl class="kv">' +
            '<dt>Status</dt><dd>' + UI.badge(cur.status, T_STATUS[cur.status] || cur.status) + '</dd>' +
            '<dt>Dates</dt><dd>' + esc(Store.fmtDate(cur.start)) + ' – ' + esc(Store.fmtDate(cur.end)) + '</dd>' +
            '<dt>Venue</dt><dd>' + esc(Store.sel.venueName(cur.venueId)) + '</dd>' +
            '<dt>Entry fee</dt><dd class="mono">' + money(cur.entryFee) + '</dd>' +
            '<dt>Collected</dt><dd class="mono">' + money(collected(cur)) + '</dd>' +
            '<dt>Prize pool</dt><dd class="mono">' + money(cur.prizePool) + '</dd>' +
            '<dt>Teams</dt><dd>' + cur.teams.length + ' of ' + cur.maxTeams +
            ' <div class="progress" style="margin-top:6px"><i style="width:' +
            Math.min(100, Math.round(cur.teams.length / Math.max(1, cur.maxTeams) * 100)) + '%"></i></div></dd>' +
            (cur.champion ? '<dt>Champion</dt><dd>' + icon('trophy', 16) + ' <b>' + esc(cur.champion) + '</b></dd>' : '') +
            '</dl>' +

            '<div class="section-title" style="margin-top:24px">Entries (' + cur.teams.length + ')</div>' +
            teamsHtml(cur) +

            (cur.champion ? '<div class="champion-strip">' + icon('trophy', 20) + '<div><b>' + esc(cur.champion) + '</b>' +
              '<em>' + esc(cur.name) + ' champions</em></div></div>' : '') +

            (cur.bracket ? '<div class="section-title" style="margin-top:24px">Draw board · ' + prog.done + ' of ' + prog.total + ' decided</div>' + bracketHtml(cur) : '') +

            (cur.standings ? '<div class="section-title" style="margin-top:24px">Pool standings</div>' + standingsHtml(cur) + fixturesHtml(cur) : '') +

            (!cur.bracket && !cur.standings ? '<div class="panel" style="margin-top:24px;background:rgba(127,127,160,.06)">' +
              (open ? '<div class="empty">' + icon('ladder', 40) +
                '<div class="empty-t">The ' + esc(cur.format).toLowerCase() + ' draw builds itself</div>' +
                '<div class="empty-s">' + cur.teams.length + ' team' + (cur.teams.length === 1 ? '' : 's') + ' registered. Once you build it, every first-round match appears on the schedule and results push winners through automatically.</div>' +
                (drawReady ? '<div class="empty-a"><button class="pill-btn accent" data-draw-now>Build the draw now</button></div>' :
                  '<div class="empty-a"><button class="pill-btn ghost" data-reg-now>Register a team first</button></div>') +
                '</div>'
                : '<p class="dim">No draw has been published for this tournament.</p>') + '</div>' : '');

          wrap.querySelectorAll('[data-player]').forEach(b => b.addEventListener('click', () => { m.close(); go('members', b.dataset.player); }));
          wrap.querySelectorAll('[data-withdraw]').forEach(b => b.addEventListener('click', () => {
            const team = cur.teams.find(x => x.id === b.dataset.withdraw);
            UI.confirm({
              title: 'Withdraw ' + (team ? team.name : 'this team') + '?',
              body: 'The seat opens up for another entry.',
              detail: 'The ' + money(cur.entryFee) + ' entry fee stays on the ledger — refund it from Payments if you owe it back.',
              okLabel: 'Withdraw team', danger: true
            }).then(yes => {
              if (!yes) return;
              const r = Store.ops.withdrawTeam(id, b.dataset.withdraw);
              UI.toast(r.ok ? 'Team withdrawn' : (r.errors && r.errors.id) || 'Could not withdraw.', r.ok ? 'ok' : 'err');
              draw();
            });
          }));
          wrap.querySelectorAll('[data-score]').forEach(el => el.addEventListener('click', () => {
            const mm = Store.get('matches', el.dataset.score);
            if (!mm) return UI.toast('That match is no longer on the board.', 'err');
            scoreModal(mm, draw);
          }));
          const now = wrap.querySelector('[data-draw-now]');
          if (now) now.addEventListener('click', () => drawConfirm(cur, () => draw()));
          const regNow = wrap.querySelector('[data-reg-now]');
          if (regNow) regNow.addEventListener('click', () => registerModal(cur));
        }

        draw();
        unsubscribe = Store.subscribe(() => {
          if (document.body.contains(scope)) draw();
        });
      }
    });
  }

  function drawConfirm(t, after) {
    if (t.bracket || t.standings) return UI.toast('The draw is already published.', 'warn');
    if (t.teams.length < 2) return UI.toast('At least 2 teams must register first.', 'err');
    UI.confirm({
      title: 'Publish the ' + (t.format === 'Round Robin' ? 'fixture list' : 'elimination draw') + ' for ' + t.name + '?',
      body: t.format === 'Round Robin'
        ? 'Every team plays every other team and one match per pairing is added to the schedule.'
        : 'Seeding places the top entries against the tail and byes are resolved instantly.',
      detail: 'The tournament flips to Ongoing and matches land on the schedule and the courts.',
      okLabel: 'Publish draw'
    }).then(yes => {
      if (!yes) return;
      const r = Store.ops.drawBracket(t.id);
      if (!r.ok) return UI.toast((r.errors && r.errors.id) || 'Draw could not be built.', 'err');
      UI.toast(r.mode === 'round-robin' ? 'Round-robin fixtures published' : 'Bracket published — results now advance automatically', 'ok');
      if (after) after();
    });
  }

  /* ============================================================
     page
     ============================================================ */

  const tournamentsPage = {
    render(host) {
      const stats = Store.sel.stats();
      const all = Store.list('tournaments').slice().sort((a, b) => a.start.localeCompare(b.start));
      const active = all.filter(t => ['registration', 'upcoming', 'ongoing'].indexOf(t.status) > -1);
      const totalTeams = all.reduce((s, t) => s + t.teams.length, 0);
      const entryTotal = Store.list('payments').filter(p => p.kind === 'Tournament entry' && p.status === 'paid').reduce((s, p) => s + p.amount, 0);

      host.innerHTML =
        '<div class="page-head"><div><h2>Tournaments</h2>' +
        '<p>' + active.length + ' tournament' + (active.length === 1 ? '' : 's') + ' in flight · ' + totalTeams + ' entries on the books. ' +
        'Registration, the draw and every result run through the live store.</p></div>' +
        '<div class="page-tools">' +
        '<button class="pill-btn ghost" id="tvCsv">' + icon('download', 16) + 'Export entries</button>' +
        '<button class="pill-btn primary" id="tvAdd">' + icon('plus', 16) + 'New tournament</button></div></div>' +

        '<div class="kpi-grid">' +
        UI.kpi({ icon: 'trophy', label: 'Active tournaments', value: stats.activeTournaments, sub: 'registration, upcoming or ongoing' }) +
        UI.kpi({ icon: 'users', label: 'Open registrations', value: stats.openRegistrations, sub: 'entries still being accepted' }) +
        UI.kpi({ icon: 'ladder', label: 'Teams entered', value: totalTeams, sub: 'across every tournament' }) +
        UI.kpi({ icon: 'wallet', label: 'Entry fees collected', value: money(entryTotal), sub: 'posted straight to the ledger' }) +
        '</div>' +

        '<div class="section-title">On the board now</div>' +
        (active.length ? '<div class="tour-cards">' + active.map(t => {
          const prog = progressOf(t);
          const pct = t.maxTeams ? Math.min(100, Math.round(t.teams.length / t.maxTeams * 100)) : 0;
          return '<article class="card tour-card">' +
            '<header><div><b>' + esc(t.name) + '</b><em>' + esc(t.event) + ' · ' + esc(t.format) + '</em></div>' +
            UI.badge(t.status, T_STATUS[t.status] || t.status) + '</header>' +
            '<div class="tour-meta"><span>' + icon('calendar', 15) + esc(Store.fmtDate(t.start)) + '</span>' +
            '<span>' + icon('map-pin', 15) + esc(Store.sel.venueName(t.venueId)) + '</span>' +
            '<span>' + icon('wallet', 15) + money(t.entryFee) + ' entry</span></div>' +
            '<div class="tour-seats"><div class="ts-line"><span>Entries</span><b class="mono">' + t.teams.length + ' / ' + t.maxTeams + '</b></div>' +
            '<div class="progress"><i style="width:' + pct + '%"></i></div></div>' +
            (prog.total ? '<p class="dim ts-prog">' + prog.done + ' of ' + prog.total + ' matches decided</p>' :
              '<p class="dim ts-prog">' + money(collected(t)) + ' collected</p>') +
            '<footer><button class="pill-btn ghost sm" data-open="' + esc(t.id) + '">Open draw board</button>' +
            (canRegister(t) ? '<button class="pill-btn accent sm" data-reg="' + esc(t.id) + '">Register team</button>' : '') +
            (!t.bracket && !t.standings && t.teams.length >= 2 ? '<button class="pill-btn primary sm" data-drawbtn="' + esc(t.id) + '">Build draw</button>' : '') +
            '</footer></article>';
        }).join('') + '</div>'
          : '<div class="panel">' + UI.empty('trophy', 'No tournaments running.', 'Create one to open registration and build a draw.').replace(/\n/g, '') + '</div>') +

        '<div class="section-title">All tournaments</div>' +
        '<div class="panel"><div id="tvTable"></div></div>';

      UI.table(host.querySelector('#tvTable'), {
        id: 'tournaments',
        columns: [
          { key: 'name', label: 'Tournament', sortable: true, render: t => '<div class="who"><span class="ava" style="background:#f4a036">' +
            icon('trophy', 16) + '</span><div><b>' + esc(t.name) + '</b><em>' + esc(t.event) + '</em></div></div>' },
          { key: 'venueId', label: 'Venue', sortable: true, sortValue: t => Store.sel.venueName(t.venueId), render: t => esc(Store.sel.venueName(t.venueId)) },
          { key: 'start', label: 'Window', sortable: true, render: t => '<div class="mono">' + esc(Store.fmtDate(t.start)) + '</div><em class="dim">to ' + esc(Store.fmtDate(t.end)) + '</em>' },
          { key: 'format', label: 'Format', sortable: true, render: t => '<span class="dim">' + esc(t.format) + '</span>' },
          { key: 'teams', label: 'Entries', sortable: true, sortValue: t => t.teams.length / Math.max(1, t.maxTeams), filterValue: t => (t.teams.length >= t.maxTeams ? 'full' : t.teams.length ? 'open' : 'empty'),
            render: t => '<div style="min-width:120px"><div class="ts-line"><span class="mono">' + t.teams.length + ' / ' + t.maxTeams + '</span>' +
              '<em class="dim">' + (t.bracket ? 'drawn' : t.standings ? 'pool' : 'unseeded') + '</em></div>' +
              '<div class="progress"><i style="width:' + Math.min(100, Math.round(t.teams.length / Math.max(1, t.maxTeams) * 100)) + '%"></i></div></div>' },
          { key: 'entryFee', label: 'Fee', sortable: true, align: 'right', render: t => '<span class="mono">' + money(t.entryFee) + '</span>' },
          { key: 'collected', label: 'Collected', sortable: true, align: 'right', sortValue: t => collected(t), render: t => '<span class="mono">' + money(collected(t)) + '</span>' },
          { key: 'status', label: 'Status', sortable: true, filterValue: t => t.status, render: t => UI.badge(t.status, T_STATUS[t.status] || t.status) }
        ],
        rows: () => Store.list('tournaments').slice().sort((a, b) => a.start.localeCompare(b.start)),
        searchKeys: ['name', 'event', 'format'], searchLabel: 'Search tournaments, events or formats…',
        filters: [
          { key: 'status', label: 'Any status', options: Object.keys(T_STATUS).map(k => ({ value: k, label: T_STATUS[k] })) },
          { key: 'format', label: 'Any format', options: FORMATS.map(x => ({ value: x, label: x })) },
          { key: 'teams', label: 'Any entry state', options: [{ value: 'open', label: 'Seats still free' }, { value: 'full', label: 'Draw full' }, { value: 'empty', label: 'No entries yet' }] }
        ],
        per: 10,
        sig: 'tournaments',
        rowActions: t => UI.actionBtn('open', 'Draw board', '', 'trophy') +
          (canRegister(t) ? UI.actionBtn('reg', 'Register team', '', 'users') : '') +
          UI.actionBtn('edit', 'Edit', '', 'pen') +
          UI.actionBtn('del', 'Delete', 'danger', 'trash'),
        onAction(act, t, redraw) {
          if (!t) return;
          if (act === 'open') return tournamentModal(t);
          if (act === 'reg') { if (!canRegister(t)) return UI.toast('Registration is closed for this tournament.', 'warn'); return registerModal(t); }
          if (act === 'edit') return tournamentFormModal(t, redraw);
          if (act === 'del') {
            UI.confirm({
              title: 'Delete ' + t.name + '?',
              body: 'The tournament and every match drawn from it are removed.',
              detail: t.teams.length ? t.teams.length + ' registered team(s) and ' + money(collected(t)) + ' of collected entry fees stay on the ledger.' : 'No entries are affected.',
              okLabel: 'Delete tournament', danger: true
            }).then(yes => {
              if (!yes) return;
              const r = Store.ops.deleteTournament(t.id);
              UI.toast(r.ok ? t.name + ' deleted' : 'Delete failed.', r.ok ? 'ok' : 'err');
              redraw();
            });
          }
        }
      });

      const cards = host.querySelector('.tour-cards');
      if (cards) cards.addEventListener('click', e => {
        const open = e.target.closest('[data-open]');
        if (open) { const t = Store.get('tournaments', open.dataset.open); if (t) tournamentModal(t); return; }
        const reg = e.target.closest('[data-reg]');
        if (reg) { const t = Store.get('tournaments', reg.dataset.reg); if (t) registerModal(t); return; }
        const db = e.target.closest('[data-drawbtn]');
        if (db) { const t = Store.get('tournaments', db.dataset.drawbtn); if (t) drawConfirm(t, () => tournamentModal(Store.get('tournaments', t.id))); }
      });

      host.querySelector('#tvAdd').addEventListener('click', () => tournamentFormModal(null));
      host.querySelector('#tvCsv').addEventListener('click', () => {
        const rows = [];
        Store.list('tournaments').forEach(t => t.teams.forEach(team => rows.push({
          tournament: t.name, event: t.event, format: t.format, venue: Store.sel.venueName(t.venueId),
          team: team.name, players: team.playerIds.map(p => Store.sel.playerName(p)).join(' / '),
          fee: t.entryFee, status: T_STATUS[t.status] || t.status, paid: feePaid(t, team) ? 'Paid' : 'Due', start: t.start
        })));
        if (!rows.length) return UI.toast('No entries to export yet.', 'warn');
        const n = UI.csv('piklemarawi-entries-' + Store.today() + '.csv', [
          { label: 'Tournament', key: 'tournament' }, { label: 'Event', key: 'event' }, { label: 'Format', key: 'format' },
          { label: 'Venue', key: 'venue' }, { label: 'Team', key: 'team' }, { label: 'Players', key: 'players' },
          { label: 'Entry fee', key: 'fee' }, { label: 'Fee status', key: 'paid' }, { label: 'Status', key: 'status' },
          { label: 'Starts', key: 'start' }
        ], rows);
        UI.toast(n + ' entries exported');
      });

      const st = PMSTATE();
      if (st.focus) {
        const id = st.focus;
        st.focus = null;
        if (id === 'new') tournamentFormModal(null);
        else { const t = Store.get('tournaments', id); if (t) tournamentModal(t); }
      }
    }
  };

  Object.assign(PAGES, { tournaments: tournamentsPage });
})();
