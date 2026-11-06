/* ============================================================
   Roster area — Player management, Ladder & Rankings, My Profile.

   Registers the `members`, `rankings` and `profile` routes.
   Reads go through Store.sel.* / Store.list(...), writes go
   through Store.ops.* inside event handlers only, so render()
   stays idempotent and can be replayed by the shell on every
   store change.
   ============================================================ */

(function () {
  /* ---------- shared vocabulary ---------- */

  const AVA_TONES = ['#6b7cff', '#2fb37c', '#e0607e', '#f4a036', '#8b7cf6', '#3aa9e0', '#ef7c33'];
  const PODIUM_TITLES = ['Club champion', 'Runner-up', 'Third place'];
  const PLAY_BASELINE = ['Singles', 'Doubles', 'Mixed', 'Open play'];
  const GENDERS = [{ value: 'F', label: 'Female' }, { value: 'M', label: 'Male' }, { value: 'Other', label: 'Other' }];
  const BANDS = [
    { label: '3.5+', test: l => l >= 3.5 },
    { label: '3.0–3.4', test: l => l >= 3 && l < 3.5 },
    { label: '2.5–2.9', test: l => l >= 2.5 && l < 3 },
    { label: 'Under 2.5', test: l => l < 2.5 }
  ];
  const NOTIFY_ITEMS = [
    { key: 'notifyBooking', label: 'Court bookings', hint: 'New holds, confirmations and cancellations' },
    { key: 'notifyPayment', label: 'Payments', hint: 'Settled invoices, failures and refunds' },
    { key: 'notifyMatch', label: 'Matches & ladder', hint: 'Results that move the standings' },
    { key: 'notifyMarketing', label: 'Club announcements', hint: 'Events, clinics and pro shop news' }
  ];

  const esc = UI.esc;
  const uniq = list => list.filter((v, i) => v && list.indexOf(v) === i);
  const toOpts = values => values.map(v => ({ value: v, label: v }));
  const bandOf = level => {
    const n = Number(level) || 0;
    const hit = BANDS.find(b => b.test(n));
    return hit ? hit.label : 'Under 2.5';
  };
  const toneFor = name => {
    const s = String(name || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return AVA_TONES[h % AVA_TONES.length];
  };
  const baseName = f => String(f || '').split(/[/\\]/).pop().trim();
  const firstError = errors => {
    const k = Object.keys(errors || {});
    return k.length ? errors[k[0]] : 'The store refused that change.';
  };
  const tierOf = id => Store.settings.memberships.find(m => m.id === id) || null;
  const thisMonthKey = () => Store.today().slice(0, 7);
  const prevMonthKey = () => Store.addDays(Store.today().slice(0, 8) + '01', -1).slice(0, 7);
  const joinedIn = key => Store.list('players').filter(p => String(p.joined || '').slice(0, 7) === key).length;
  const rosterSize = () => Store.list('players').length;

  const membershipOpts = () => uniq(Store.list('players').map(p => p.membership)).map(id => {
    const t = tierOf(id);
    return { value: id, label: t ? t.name : Store.tierName(id) + ' · retired (' + id + ')' };
  });
  const statusOpts = () => toOpts(uniq(Store.list('players').map(p => p.status)));
  const bandOpts = () => toOpts(BANDS.map(b => b.label));
  const playOpts = () => toOpts(uniq(
    PLAY_BASELINE.concat(Store.list('players').map(p => p.play), Store.list('bookings').map(b => b.format))
  ));

  /* Player records carry short venue words (“Lamai”) while VENUES carries the
     full name (“Lamai Riverside Courts”), so every value already on file stays
     selectable — otherwise editing a player would silently rewrite the venue. */
  function venueOpts() {
    const onFile = uniq(Store.list('players').map(p => p.venue));
    const values = onFile.concat(VENUES.map(v => v.name).filter(n => onFile.indexOf(n) < 0));
    return values.map(name => {
      const v = VENUES.find(x => x.name === name || x.name.split(' ')[0] === String(name).split(' ')[0]);
      return { value: name, label: v ? name + ' · Brgy. ' + v.barangay : name };
    });
  }

  function ageOf(dob) {
    if (!Store.isDate(dob)) return null;
    const b = Store.parseDate(dob);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const drift = now.getMonth() - b.getMonth();
    if (drift < 0 || (drift === 0 && now.getDate() < b.getDate())) age--;
    return age >= 0 && age < 120 ? age : null;
  }

  /* ---------- derived records ---------- */

  function recordOf(playerId) {
    const out = { played: 0, won: 0, lost: 0, results: [] };
    Store.list('matches').forEach(m => {
      if (m.status !== 'completed') return;
      const inA = (m.teamAIds || []).indexOf(playerId) > -1;
      const inB = (m.teamBIds || []).indexOf(playerId) > -1;
      if (!inA && !inB) return;
      const won = m.winner === (inA ? 'A' : 'B');
      out.played++;
      if (won) out.won++; else out.lost++;
      out.results.push({
        id: m.id, won: won,
        pairing: inA ? m.teamA + ' vs ' + m.teamB : m.teamB + ' vs ' + m.teamA,
        score: m.scoreA + '–' + m.scoreB, round: m.round, date: m.date
      });
    });
    out.results.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }

  function seasonOf(playerId) {
    const rows = Store.list('bookings').filter(b => b.playerId === playerId);
    const upcoming = rows.filter(b => ['confirmed', 'pending'].indexOf(b.status) > -1)
      .sort((a, b) => String(a.date + a.start).localeCompare(String(b.date + b.start)));
    const kept = rows.filter(b => b.status !== 'cancelled');
    return {
      total: rows.length,
      upcoming: upcoming,
      completed: rows.filter(b => b.status === 'completed').length,
      cancelled: rows.filter(b => b.status === 'cancelled').length,
      hours: kept.reduce((s, b) => s + (Number(b.duration) || 0), 0),
      spend: Store.list('payments').filter(p => p.playerId === playerId && p.status === 'paid')
        .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    };
  }

  /* ---------- markup atoms ---------- */

  const sub = text => '<em class="dim" style="display:block;font-style:normal;font-size:12px">' + esc(text) + '</em>';
  const tile = (label, value) => '<div class="tile"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  const kv = (label, value) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>';
  const btn = (act, label, iconName, cls) =>
    '<button type="button" class="pill-btn ' + (cls || 'ghost') + '" data-rs="' + act + '">' +
    (iconName ? icon(iconName, 16) : '') + esc(label) + '</button>';
  const idBtn = (act, id, label, iconName, cls) =>
    '<button type="button" class="' + (cls || 'linkish') + '" data-rs="' + act + '" data-rs-id="' + esc(id) + '">' +
    (iconName ? icon(iconName, 15) : '') + esc(label) + '</button>';

  function pageHead(title, subText, tools) {
    return '<div class="page-head"><div><h2>' + esc(title) + '</h2><p>' + subText + '</p></div>' +
      '<div class="page-tools">' + (tools || '') + '</div></div>';
  }

  function panelHead(title, subText, tools) {
    return '<div class="panel-head"><div><h3>' + esc(title) + '</h3>' +
      (subText ? '<p>' + subText + '</p>' : '') + '</div>' +
      (tools ? '<div class="page-tools">' + tools + '</div>' : '') + '</div>';
  }

  const formGrid = (name, fields) =>
    '<form class="form-grid" data-rs-form="' + name + '" novalidate>' + fields.map(UI.field).join('') + '</form>';

  const recordNote = playerId => {
    const r = recordOf(playerId);
    return sub(r.played ? r.won + '–' + r.lost + ' W–L over ' + r.played + ' matches' : 'no results logged yet');
  };

  const whoCell = row =>
    '<div class="who">' + UI.avatar(row.name, toneFor(row.name)) +
    '<div><b>' + idBtn('detail', row.id, row.name) + '</b><em>' + esc(row.email || 'no email on file') + '</em></div></div>';

  /* ---------- player create / edit ---------- */

  function playerFields(p) {
    const tiers = Store.settings.memberships.map(m => ({
      value: m.id, label: m.name + ' — ' + money(m.price) + ' · ' + m.term
    }));
    const venues = venueOpts();
    const em = (p && p.emergency) || {};
    if (p && !tierOf(p.membership)) {
      tiers.unshift({ value: p.membership, label: '“' + p.membership + '” · retired tier — re-pick to move them' });
    }
    const fields = [
      { name: 'name', label: 'Full Name', col: 2, required: true, maxlength: 60, value: p ? p.name : '', placeholder: 'e.g. Amina Mangunsong' },
      { name: 'email', label: 'Email', col: 1, type: 'email', required: true, value: p ? p.email : '', placeholder: 'player@piklemarawi.ph' },
      { name: 'phone', label: 'Phone', col: 1, type: 'tel', required: true, value: p ? p.phone : '', placeholder: '+63 64 555 1234' },
      { name: 'dob', label: 'Date of Birth', col: 1, type: 'date', required: true, max: Store.today(), value: p ? p.dob : '', help: 'Drives age-group clinics and junior tiers.' },
      { name: 'gender', label: 'Gender', col: 1, type: 'select', options: GENDERS, value: p ? p.gender : '', placeholder: p ? '' : 'Choose…' },
      { name: 'address', label: 'Address', col: 2, type: 'textarea', rows: 2, required: true, value: p ? p.address : '', placeholder: 'Brgy. Patani, Marawi City, Lanao del Sur' },
      { name: 'membership', label: 'Membership Type', col: 1, type: 'select', required: true, options: tiers, value: p ? p.membership : (tiers[0] || {}).value, placeholder: 'Choose a tier…' },
      { name: 'level', label: 'Skill Level', col: 1, type: 'number', required: true, min: 1, max: 8, step: 0.1, value: p ? p.level : '3.0', help: 'Club rating between 1.0 and 8.0.' },
      { name: 'play', label: 'Preferred Format', col: 1, type: 'select', options: playOpts(), value: p ? p.play : 'Doubles' },
      { name: 'venue', label: 'Home Venue', col: 1, type: 'select', options: venues, value: p ? p.venue : VENUES[0].name },
      { name: 'emergencyName', label: 'Emergency Contact Name', col: 1, required: true, maxlength: 60, value: em.name || '', placeholder: 'Spouse, parent or sibling' },
      { name: 'emergencyPhone', label: 'Emergency Contact Phone', col: 1, type: 'tel', required: true, value: em.phone || '', placeholder: '+63 64 555 0000' }
    ];
    fields.push(p
      ? { name: 'photo', label: 'Replace Profile Photo', col: 1, type: 'file', help: p.photo ? 'On file: ' + p.photo + ' — pick a new file to change it.' : 'No photo on file yet.' }
      : { name: 'photo', label: 'Profile Photo', col: 1, type: 'file', help: 'The file name is stored on the player record.' });
    return fields;
  }

  function openPlayerForm(id) {
    const p = id ? Store.get('players', id) : null;
    UI.formModal({
      title: p ? 'Edit player — ' + p.name : 'Add a player',
      sub: p ? 'Record ' + p.id + ' · ' + Store.tierName(p.membership) + ' · joined ' + Store.fmtDate(p.joined)
        : 'The registry needs every field below before a member can book a court.',
      wide: true,
      fields: playerFields(p),
      submitLabel: p ? 'Save player' : 'Add player',
      onSubmit(values) {
        const photo = baseName(values.photo);
        const v = Object.assign({}, values, { photo });
        if (!p) return Store.ops.createPlayer(v);
        const res = Store.ops.updatePlayer(p.id, v);
        if (res.ok && photo && photo !== p.photo) {
          Store.put('players', p.id, { photo: photo });
          Store.emit('player:photo');
        }
        return res;
      },
      onDone(res) {
        const saved = Store.get('players', res.id);
        const name = saved ? saved.name : 'Player';
        UI.toast(p ? name + '’s record is saved.' : name + ' joined the roster as a ' +
          (saved ? Store.tierName(saved.membership) : 'member') + '.');
      }
    });
  }

  /* ---------- player status / delete ---------- */

  function toggleStatus(id) {
    const p = Store.get('players', id);
    if (!p) { UI.toast('That player is no longer on the roster.', 'warn'); return; }
    const next = p.status === 'active' ? 'suspended' : 'active';
    const res = Store.ops.setPlayerStatus(p.id, next);
    if (!res.ok) { UI.toast('Could not set ' + p.name + ' to ' + next + '.', 'err'); return; }
    UI.toast(p.name + (next === 'active' ? ' can book courts again.' : ' is suspended — new bookings are blocked.'),
      next === 'active' ? 'ok' : 'warn');
  }

  function removePlayer(id) {
    const p = Store.get('players', id);
    if (!p) { UI.toast('That player is no longer on the roster.', 'warn'); return; }
    UI.confirm({
      title: 'Delete ' + p.name + '?',
      body: 'The roster record ' + p.id + ' is removed from ' + Store.settings.club.name + '.',
      detail: 'Past invoices and match results stay in the ledger. A player with live bookings cannot be deleted until those bookings are cancelled.',
      okLabel: 'Delete player',
      cancelLabel: 'Keep player',
      danger: true
    }).then(confirmed => {
      if (!confirmed) { UI.toast(p.name + ' stays on the roster.', 'info'); return; }
      const res = Store.ops.deletePlayer(p.id);
      if (!res.ok) { UI.toast(res.errors.id, 'err'); return; }
      UI.toast(p.name + ' was removed from the roster.');
    });
  }

  /* ---------- exports ---------- */

  const PLAYER_CSV = [
    { label: 'Player ID', key: 'id' },
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Membership', value: r => Store.tierName(r.membership) },
    { label: 'Skill level', key: 'level' },
    { label: 'Preferred format', key: 'play' },
    { label: 'Home venue', key: 'venue' },
    { label: 'Points', key: 'rating' },
    { label: 'Status', key: 'status' },
    { label: 'Registered', key: 'joined' },
    { label: 'Wins', value: r => recordOf(r.id).won },
    { label: 'Losses', value: r => recordOf(r.id).lost },
    { label: 'Court hours', value: r => seasonOf(r.id).hours },
    { label: 'Paid to date', value: r => seasonOf(r.id).spend }
  ];

  const LADDER_CSV = [
    { label: 'Rank', key: 'rank' },
    { label: 'Player', key: 'name' },
    { label: 'Points', key: 'rating' },
    { label: 'Skill level', key: 'level' },
    { label: 'Band', value: r => bandOf(r.level) },
    { label: 'Format', key: 'play' },
    { label: 'Won', value: r => recordOf(r.id).won },
    { label: 'Lost', value: r => recordOf(r.id).lost },
    { label: 'Streak (days)', key: 'streak' },
    { label: 'Membership', value: r => Store.tierName(r.membership) },
    { label: 'Home venue', key: 'venue' }
  ];

  function exportPlayers(ids, note) {
    const rows = ids.map(id => Store.get('players', id)).filter(Boolean);
    if (!rows.length) { UI.toast('Pick at least one player to export.', 'warn'); return false; }
    const n = UI.csv('players-' + Store.today() + '.csv', PLAYER_CSV, rows);
    UI.toast(n + ' player row(s) exported' + (note ? ' · ' + note : '') + '.');
    return false;
  }

  function exportLadder() {
    const rows = Store.sel.leaderboard(rosterSize());
    if (!rows.length) { UI.toast('The ladder has no active players yet.', 'warn'); return; }
    const n = UI.csv('ladder-' + Store.today() + '.csv', LADDER_CSV, rows);
    UI.toast(n + ' ladder row(s) exported.');
  }

  function bulkStatus(ids, status) {
    if (!ids.length) { UI.toast('Select at least one player first.', 'warn'); return false; }
    Store.batch(() => ids.forEach(id => Store.ops.setPlayerStatus(id, status)));
    UI.toast(ids.length + ' player(s) set to ' + status + '.', status === 'active' ? 'ok' : 'warn');
    return true;
  }

  /* ---------- shared player card ---------- */

  function openPlayerDetail(id) {
    const p = Store.get('players', id);
    if (!p) { UI.toast('That player is no longer on the roster.', 'warn'); return; }
    const tier = tierOf(p.membership);
    const rec = recordOf(p.id);
    const sea = seasonOf(p.id);
    const em = p.emergency || {};
    const age = ageOf(p.dob);
    const next = sea.upcoming[0] || null;
    const nextEnd = next ? (next.end || Store.hm(Store.mins(next.start) + (Number(next.duration) || 0) * 60)) : '';

    const membershipBlock = tier
      ? '<dl class="kv">' +
        kv('Tier', Store.tierName(tier.id)) +
        kv('Price', money(tier.price) + ' · ' + tier.term) +
        kv('Court discount', tier.discount + '%') +
        kv('Members on tier', String(Store.list('players').filter(x => x.membership === tier.id).length)) +
        '</dl>' +
        ((tier.benefits || []).length
          ? '<div class="chips" style="margin-top:14px">' + tier.benefits.map(b => '<span class="chip">' + esc(b) + '</span>').join('') + '</div>'
          : '')
      : '<p class="dim" style="margin:0">This record points at “' + esc(p.membership) + '”, a tier that is no longer configured. Edit the player onto a live membership.</p>';

    const seasonBlock = '<div class="tiles" style="margin-top:4px">' +
      tile('Bookings on record', nf.format(sea.total)) +
      tile('Sessions played', nf.format(sea.completed)) +
      tile('Hours on court', nf.format(sea.hours)) +
      tile('Paid to date', money(sea.spend)) +
      '</div>' +
      '<div class="tile" style="margin-top:14px"><span>Next on court</span><b>' +
      esc(next ? Store.fmtDate(next.date) + ' · ' + next.start + '–' + nextEnd : 'Nothing booked') + '</b></div>' +
      (next ? sub(next.format + ' · ' + Store.sel.courtName(next.courtId) + ' · ' + next.status)
        : sub('Open the booking screen to find them a slot.'));

    const resultsBlock = rec.results.length
      ? '<div class="detail-list">' + rec.results.slice(0, 5).map(r =>
        '<div class="who"><span class="sp-ico">' + icon(r.won ? 'trophy' : 'flag', 16) + '</span>' +
        '<div><b>' + esc(r.pairing) + '</b><em>' + esc(r.round) + ' · ' + Store.fmtDate(r.date) + '</em></div>' +
        '<span class="mono" style="margin-left:auto">' + esc(r.score) + ' ' + UI.badge(r.won ? 'confirmed' : 'cancelled', r.won ? 'W' : 'L') + '</span></div>').join('') +
        '</div>' + (rec.results.length > 5 ? sub('+' + (rec.results.length - 5) + ' earlier results on the match page.') : '')
      : '<p class="dim" style="margin:0">No completed matches yet — the season record fills in as results are logged.</p>';

    UI.modal({
      title: p.name,
      sub: Store.tierName(p.membership) + ' member · ' + p.id + ' · registered ' + Store.fmtDate(p.joined),
      wide: true,
      cancelLabel: 'Close',
      body:
        '<div class="who">' + UI.avatar(p.name, toneFor(p.name)) +
        '<div><b>' + esc(p.name) + '</b><em>' + esc(p.email || 'no email') + ' · ' + esc(p.phone || 'no phone') + '</em></div>' +
        '<span style="margin-left:auto">' + UI.badge(p.status) + '</span></div>' +

        '<div class="tiles" style="margin-top:18px">' +
        tile('Ladder points', nf.format(Number(p.rating) || 0)) +
        tile('Skill rating', (Number(p.level) || 0).toFixed(1) + ' · ' + bandOf(p.level)) +
        tile('Season record', rec.played ? rec.won + '–' + rec.lost : 'No matches yet') +
        tile('Streak', nf.format(Number(p.streak) || 0) + ' d') +
        '</div>' +

        '<div class="section-title">Membership</div>' + membershipBlock +

        '<div class="section-title">Contact &amp; registry</div>' +
        '<dl class="kv">' +
        kv('Phone', p.phone || '—') +
        kv('Email', p.email || '—') +
        kv('Date of birth', p.dob ? p.dob + (age !== null ? ' · ' + age + ' yrs' : '') : '—') +
        kv('Gender', p.gender === 'F' ? 'Female' : p.gender === 'M' ? 'Male' : (p.gender || '—')) +
        kv('Address', p.address || '—') +
        kv('Home venue', p.venue || '—') +
        kv('Preferred format', p.play || '—') +
        kv('Emergency contact', (em.name ? em.name + ' · ' + (em.phone || 'no phone') : 'none on file')) +
        kv('Profile photo', p.photo || 'none on file') +
        '</dl>' +

        '<div class="section-title">Season on court</div>' + seasonBlock +
        '<p class="dim" style="margin:2px 0 0">' + esc(Store.tierName(p.membership)) + ' · ' + esc(p.venue || 'no home venue') + '</p>' +

        '<div class="section-title">Last results</div>' + resultsBlock,
      actions: [
        { id: 'bookings', label: 'View their bookings', cls: 'primary' },
        { id: 'edit', label: 'Edit player', cls: 'ghost' },
        { id: 'status', label: p.status === 'active' ? 'Suspend' : 'Activate', cls: 'ghost' },
        { id: 'export', label: 'Export record (CSV)', cls: 'ghost' }
      ],
      onAction(act) {
        if (act === 'bookings') go('booking', p.id);
        else if (act === 'edit') openPlayerForm(p.id);
        else if (act === 'status') toggleStatus(p.id);
        else if (act === 'export') exportPlayers([p.id], p.name + '’s record');
      }
    });
  }

  /* ---------- router focus ---------- */

  function takeFocus() {
    const st = PMSTATE();
    const f = st.focus;
    if (f) st.focus = null;
    return f;
  }

  function consumeFocus(focus) {
    if (!focus) return;
    if (focus === 'new') return openPlayerForm(null);
    if (Store.get('players', focus)) openPlayerDetail(focus);
  }

  /* ---------- page: player management ---------- */

  const PLAYER_COLUMNS = [
    { key: 'player', label: 'Player', width: '240px', sortable: true, sortValue: r => r.name, render: whoCell },
    {
      key: 'phone', label: 'Contact', sortable: true, sortValue: r => r.phone,
      render: r => '<span class="mono">' + esc(r.phone || '—') + '</span>' +
        sub(ageOf(r.dob) !== null ? ageOf(r.dob) + ' yrs · ' + r.dob : (r.dob || 'no birth date'))
    },
    {
      key: 'membership', label: 'Membership', width: '170px', sortable: true, sortValue: r => Store.tierName(r.membership),
      filterValue: r => r.membership,
      render: r => {
        const t = tierOf(r.membership);
        return '<b>' + esc(Store.tierName(r.membership)) + '</b>' +
          sub(t ? money(t.price) + ' · ' + t.term : 'tier no longer configured');
      }
    },
    {
      key: 'level', label: 'Skill', width: '110px', align: 'right', sortable: true, sortValue: r => Number(r.level) || 0,
      filterValue: r => bandOf(r.level),
      render: r => '<b class="mono">' + (Number(r.level) || 0).toFixed(1) + '</b>' + sub(bandOf(r.level))
    },
    {
      key: 'play', label: 'Plays · home', width: '170px', sortable: true, sortValue: r => r.play,
      render: r => '<b>' + esc(r.play || '—') + '</b>' + sub(r.venue || 'no home venue')
    },
    {
      key: 'rating', label: 'Points', width: '120px', align: 'right', sortable: true, sortValue: r => Number(r.rating) || 0,
      render: r => '<b class="mono">' + nf.format(Number(r.rating) || 0) + '</b>' + recordNote(r.id)
    },
    {
      key: 'status', label: 'Status', width: '120px', align: 'center', sortable: true, sortValue: r => r.status,
      filterValue: r => r.status, render: r => UI.badge(r.status)
    },
    {
      key: 'joined', label: 'Registered', width: '140px', sortable: true, sortValue: r => r.joined,
      render: r => '<span class="mono">' + esc(Store.fmtDate(r.joined)) + '</span>' + sub(UI.relTime(r.joined))
    }
  ];

  function playersTable(mount) {
    UI.table(mount, {
      id: 'roster-players',
      rows: () => Store.list('players'),
      rowId: r => r.id,
      sort: 'rating', dir: 'desc',
      per: 10, perPage: true,
      search: true, searchLabel: 'Search name, email or phone…', searchKeys: ['name', 'email', 'phone'],
      filters: [
        { key: 'membership', label: 'All tiers', options: membershipOpts() },
        { key: 'status', label: 'Any status', options: statusOpts() },
        { key: 'level', label: 'Any skill band', options: bandOpts() }
      ],
      columns: PLAYER_COLUMNS,
      bulk: [
        { id: 'activate', label: 'Activate selected', run: ids => bulkStatus(ids, 'active') },
        { id: 'suspend', label: 'Suspend selected', run: ids => bulkStatus(ids, 'suspended') },
        { id: 'export', label: 'Export selected (CSV)', run: ids => exportPlayers(ids, 'selection') }
      ],
      rowActions: row =>
        UI.actionBtn('detail', 'View player', '', 'eye') +
        UI.actionBtn('edit', 'Edit player', '', 'pen') +
        UI.actionBtn('status', row.status === 'active' ? 'Suspend player' : 'Activate player', '',
          row.status === 'active' ? 'ban' : 'check') +
        UI.actionBtn('delete', 'Delete player', 'danger', 'trash'),
      onAction(act, row) {
        if (!row) return;
        if (act === 'detail') openPlayerDetail(row.id);
        else if (act === 'edit') openPlayerForm(row.id);
        else if (act === 'status') toggleStatus(row.id);
        else if (act === 'delete') removePlayer(row.id);
      },
      emptyTitle: 'No player matches those filters.',
      emptySub: 'Loosen the search text or clear a filter to see the rest of the roster.'
    });
  }

  function renderMembers(host) {
    const focus = takeFocus();
    const s = Store.sel.stats();
    const players = Store.list('players');
    const suspended = players.filter(p => p.status === 'suspended').length;
    const lastMonth = joinedIn(prevMonthKey());
    const drift = s.newThisMonth - lastMonth;

    const tools =
      btn('export-roster', 'Export roster (CSV)', 'download') +
      btn('add', 'Add player', 'plus', 'primary');

    const kpis = '<section class="kpi-grid">' +
      UI.kpi({
        icon: 'users', label: 'Total players', value: nf.format(s.players),
        sub: 'registered with ' + Store.settings.club.name,
        delta: s.newThisMonth ? '+' + nf.format(s.newThisMonth) + ' this month' : 'no joins yet',
        deltaDir: s.newThisMonth ? 'up' : 'down'
      }) +
      UI.kpi({
        icon: 'shield', label: 'Active members', value: nf.format(s.activeMembers),
        sub: 'cleared to book courts'
      }) +
      UI.kpi({
        icon: 'ban', label: 'Suspended', value: nf.format(suspended),
        sub: suspended ? 'blocked from new bookings' : 'everyone in good standing',
        delta: suspended ? 'needs a follow-up' : 'all clear', deltaDir: suspended ? 'down' : 'up'
      }) +
      UI.kpi({
        icon: 'star', label: 'Joined this month', value: nf.format(s.newThisMonth),
        sub: Store.monthLabel(thisMonthKey()) + ' · ' + Store.monthLabel(prevMonthKey()) + ' closed with ' + nf.format(lastMonth),
        delta: (drift >= 0 ? '+' : '−') + nf.format(Math.abs(drift)) + ' vs last month',
        deltaDir: drift >= 0 ? 'up' : 'down'
      }) +
      '</section>';

    const body = players.length
      ? '<section class="panel">' +
        panelHead('Player management',
          esc(nf.format(players.length)) + ' roster record(s) for ' + esc(Store.settings.club.full) +
          ' — search, filter, sort, bulk-action and export.') +
        '<div data-rs-table="players"></div></section>'
      : UI.empty('users', 'No players on the roster yet.',
        'Add your first member and the ladder, calendar and billing all light up.',
        btn('add', 'Add the first player', 'plus', 'primary'));

    host.innerHTML =
      pageHead('Players',
        'The club roster, live from the store — ' + esc(nf.format(s.activeMembers)) + ' of ' +
        esc(nf.format(s.players)) + ' members can book right now.', tools) +
      kpis +
      '<div style="margin-top:22px">' + body + '</div>';

    if (players.length) playersTable(host.querySelector('[data-rs-table="players"]'));
    consumeFocus(focus);
  }

  /* ---------- page: ladder & rankings ---------- */

  const LADDER_COLUMNS = [
    {
      key: 'rank', label: '#', width: '58px', align: 'center', sortable: true, sortValue: r => r.rank,
      render: r => '<b class="mono">' + r.rank + '</b>'
    },
    { key: 'name', label: 'Player', width: '230px', sortable: true, sortValue: r => r.name, render: whoCell },
    {
      key: 'rating', label: 'Points', width: '110px', align: 'right', sortable: true, sortValue: r => Number(r.rating) || 0,
      render: r => '<b class="mono">' + nf.format(Number(r.rating) || 0) + '</b>'
    },
    {
      key: 'record', label: 'Win record', width: '150px', sortable: true, sortValue: r => recordOf(r.id).won,
      render: r => {
        const rec = recordOf(r.id);
        const pct = rec.played ? Math.round((rec.won / rec.played) * 100) : 0;
        return '<b class="mono">' + (rec.played ? rec.won + '–' + rec.lost : '0–0') + '</b>' +
          '<div class="progress" style="margin-top:6px"><i style="width:' + pct + '%"></i></div>' +
          sub(rec.played ? pct + '% of ' + rec.played + ' completed matches' : 'no completed matches');
      }
    },
    {
      key: 'streak', label: 'Streak', width: '96px', align: 'right', sortable: true, sortValue: r => Number(r.streak) || 0,
      render: r => '<b class="mono">' + nf.format(Number(r.streak) || 0) + '</b>' + sub('days')
    },
    {
      key: 'level', label: 'Skill band', width: '130px', sortable: true, sortValue: r => Number(r.level) || 0,
      filterValue: r => bandOf(r.level),
      render: r => '<b class="mono">' + (Number(r.level) || 0).toFixed(1) + '</b>' + sub(bandOf(r.level))
    },
    {
      key: 'play', label: 'Format', width: '120px', sortable: true, sortValue: r => r.play, filterValue: r => r.play,
      render: r => esc(r.play || '—')
    },
    {
      key: 'tier', label: 'Tier', width: '140px', sortable: true, sortValue: r => Store.tierName(r.membership),
      render: r => {
        const t = tierOf(r.membership);
        return '<b>' + esc(Store.tierName(r.membership)) + '</b>' + sub(t ? money(t.price) : 'tier retired');
      }
    }
  ];

  function ladderTable(mount) {
    UI.table(mount, {
      id: 'roster-ladder',
      rows: () => Store.sel.leaderboard(rosterSize()),
      rowId: r => r.id,
      sort: 'rank', dir: 'asc',
      per: 25, perPage: true,
      search: true, searchLabel: 'Find a player on the ladder…', searchKeys: ['name', 'venue'],
      filters: [
        { key: 'level', label: 'Any skill band', options: bandOpts() },
        { key: 'play', label: 'Any format', options: playOpts() }
      ],
      columns: LADDER_COLUMNS,
      rowActions: row => UI.actionBtn('detail', 'Open player card', '', 'eye') + UI.actionBtn('edit', 'Edit player', '', 'pen'),
      onAction(act, row) {
        if (!row) return;
        if (act === 'detail') openPlayerDetail(row.id);
        else if (act === 'edit') openPlayerForm(row.id);
      },
      emptyTitle: 'Nobody is on the ladder yet.',
      emptySub: 'The ladder ranks active members only — check the roster or clear a filter.'
    });
  }

  function podiumCard(p, i, leader) {
    const rec = recordOf(p.id);
    const share = leader > 0 ? Math.round(((Number(p.rating) || 0) / leader) * 100) : 0;
    return '<div class="tile" style="padding:18px">' +
      '<span>#' + (i + 1) + ' · ' + esc(PODIUM_TITLES[i] || 'Ranked') + '</span>' +
      '<div class="who" style="margin:12px 0 10px">' + UI.avatar(p.name, toneFor(p.name)) +
      '<div><b>' + esc(p.name) + '</b><em>' + esc(Store.tierName(p.membership)) + ' · ' + esc(p.venue || 'no home venue') + '</em></div></div>' +
      '<b class="mono" style="font-size:26px;display:block">' + nf.format(Number(p.rating) || 0) + '</b>' +
      '<div class="progress" style="margin:10px 0 8px"><i style="width:' + share + '%"></i></div>' +
      '<div class="dim" style="font-size:12px">' +
      esc(rec.played ? rec.won + '–' + rec.lost + ' · ' + rec.played + ' played' : 'no completed matches yet') + '</div>' +
      '<div class="dim" style="font-size:12px">' + esc((Number(p.level) || 0).toFixed(1) + ' rating · ' + bandOf(p.level)) + '</div>' +
      '<div style="margin-top:12px">' + idBtn('detail', p.id, 'Open player card', 'eye', 'pill-btn ghost sm') + '</div>' +
      '</div>';
  }

  function spreadPanel() {
    const bands = Store.sel.levelSplit();
    const total = bands.reduce((s, b) => s + (Number(b.value) || 0), 0);
    return '<section class="panel">' +
      panelHead('Skill spread', 'Every rating band on the roster, live from ' + esc(nf.format(Store.list('players').length)) + ' records.') +
      (total
        ? CH.donut({ data: bands, caption: 'players', size: 200 }) +
          '<div class="chips" style="margin-top:16px">' +
          bands.map(b => '<span class="chip">' + esc(b.name) + ' · ' + nf.format(b.value) + '</span>').join('') + '</div>'
        : UI.empty('pie-chart', 'No rated players yet.', 'Set a skill level on each player to build the spread.')) +
      '</section>';
  }

  function formatPanel() {
    const tally = {};
    Store.list('players').forEach(p => {
      const k = p.play || 'Unset';
      tally[k] = (tally[k] || 0) + 1;
    });
    const rows = Object.keys(tally).map(k => ({ name: k, value: tally[k] })).sort((a, b) => b.value - a.value);
    const total = Store.list('players').length;
    if (!rows.length || !total) {
      return '<section class="panel">' + panelHead('Preferred format', 'What the roster plays.') +
        UI.empty('paddle', 'No formats recorded yet.', 'Set a preferred format on the player form.') + '</section>';
    }
    return '<section class="panel">' +
      panelHead('Preferred format', nf.format(total) + ' player(s) across ' + nf.format(rows.length) + ' format(s).') +
      '<div class="detail-list">' + rows.map(r =>
        '<div class="who"><div style="flex:1;min-width:0"><b>' + esc(r.name) + '</b>' +
        sub(nf.format(r.value) + ' player(s) · ' + Math.round((r.value / total) * 100) + '% of the roster') + '</div>' +
        '<div class="progress" style="width:110px"><i style="width:' + Math.round((r.value / total) * 100) + '%"></i></div></div>').join('') +
      '</div></section>';
  }

  function renderRankings(host) {
    const focus = takeFocus();
    const players = Store.list('players');
    const tools = '<button type="button" class="pill-btn ghost" data-goto="members">' +
      icon('users', 16) + 'Player management</button>';

    if (!players.length) {
      host.innerHTML = pageHead('Ladder & Rankings',
        'Points, win records and streaks build themselves from logged results.', tools) +
        UI.empty('medal', 'The ladder is empty.',
          'Players appear here the moment they join the roster and start collecting points.',
          '<button type="button" class="pill-btn primary" data-goto="members">' + icon('users', 16) + 'Open player management</button>');
      consumeFocus(focus);
      return;
    }

    const top = Store.sel.leaderboard(3);
    const leader = top.length ? Number(top[0].rating) || 0 : 0;
    const active = Store.sel.stats().activeMembers;

    const podium = '<section class="panel">' +
      panelHead('Podium', 'Top ' + nf.format(top.length) + ' of ' + nf.format(active) +
        ' ranked member(s), by current ladder points.') +
      (top.length
        ? '<div class="grid g-3">' + top.map((p, i) => podiumCard(p, i, leader)).join('') + '</div>'
        : UI.empty('shield', 'No active members to rank.', 'Suspended players leave the ladder until they are re-activated.')) +
      '</section>';

    host.innerHTML =
      pageHead('Ladder & Rankings',
        'Every position below is computed from ' + nf.format(players.length) +
        ' roster record(s) and ' + nf.format(Store.list('matches').length) + ' stored match(es).', tools) +
      '<div class="split">' +
        '<div class="grid">' + podium +
          '<section class="panel">' +
          panelHead('Full ladder', 'Click any player for their card, results and membership.',
            btn('export-ladder', 'Export ladder (CSV)', 'download')) +
          '<div data-rs-table="ladder"></div></section>' +
        '</div>' +
        '<div class="grid">' + spreadPanel() + formatPanel() + '</div>' +
      '</div>';

    ladderTable(host.querySelector('[data-rs-table="ladder"]'));
    consumeFocus(focus);
  }

  /* ---------- page: my profile ---------- */

  const accountFields = u => [
    { name: 'name', label: 'Full Name', col: 1, required: true, maxlength: 60, value: u.name },
    { name: 'role', label: 'Role', col: 1, maxlength: 40, value: u.role, placeholder: 'Club Administrator' },
    { name: 'email', label: 'Sign-in Email', col: 1, type: 'email', required: true, value: u.email },
    { name: 'phone', label: 'Phone', col: 1, type: 'tel', value: u.phone, help: 'Shown on receipts and club notices.' }
  ];

  const PASSWORD_FIELDS = [
    { name: 'newPassword', label: 'New Password', col: 1, type: 'password', required: true, maxlength: 40, placeholder: 'At least 8 characters', help: 'The store refuses anything under 8 characters.' },
    { name: 'confirmPassword', label: 'Confirm Password', col: 1, type: 'password', required: true, maxlength: 40, placeholder: 'Type it once more' }
  ];

  function identityCard(u) {
    const alertsOn = NOTIFY_ITEMS.filter(i => u[i.key]).length;
    return '<section class="panel">' +
      '<div class="who">' +
      '<span class="ava" style="width:78px;height:78px;font-size:24px;background:' + toneFor(u.name) + '">' + esc(initials(u.name)) + '</span>' +
      '<div><b style="font-size:22px">' + esc(u.name) + '</b><em>' + esc(u.role || 'Club Administrator') +
      ' · ' + esc(Store.settings.club.city) + '</em></div>' +
      '<span style="margin-left:auto">' + UI.badge('active', alertsOn + ' of ' + NOTIFY_ITEMS.length + ' alerts on') + '</span></div>' +
      '<dl class="kv" style="margin-top:18px">' +
      kv('Sign-in email', u.email) +
      kv('Phone', u.phone || 'not provided') +
      kv('Club', Store.settings.club.full) +
      kv('Password changed', u.passwordSet ? UI.relTime(u.passwordSet) + ' · ' + UI.clock(u.passwordSet) : 'not since setup') +
      kv('Unread alerts', nf.format(Store.sel.unreadCount())) +
      '</dl>' +
      '<div class="section-title">Theme</div>' +
      UI.seg([{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }], u.theme, 'data-rs-theme') +
      '<p class="dim" style="margin:12px 0 0;font-size:12.5px">The choice is saved on your account, so it follows you back on the next sign-in.</p>' +
      '</section>';
  }

  function notifyPanel(u) {
    return '<section class="panel">' +
      panelHead('Notification preferences', 'What this console pushes to the bell.',
        btn('save-notify', 'Save preferences', 'check', 'primary')) +
      '<form data-rs-form="notify"><dl class="kv">' +
      NOTIFY_ITEMS.map(i =>
        '<dt>' + esc(i.label) + '</dt>' +
        '<dd><label class="switch"><input type="checkbox" name="' + i.key + '"' + (u[i.key] ? ' checked' : '') + '>' +
        '<i></i><span>' + (u[i.key] ? 'On' : 'Off') + '</span></label>' +
        '<div class="dim" style="font-size:12px;margin-top:5px">' + esc(i.hint) + '</div></dd>').join('') +
      '</dl></form></section>';
  }

  function activityPanel() {
    const acts = Store.sel.recentActivity(12);
    return '<section class="panel">' +
      panelHead('My recent entries', nf.format(acts.length) +
        ' latest action(s) recorded from this administrator console.') +
      (acts.length
        ? '<div class="detail-list">' + acts.map(a =>
          '<div class="who"><span class="sp-ico">' + icon(Store.KIND_ICON[a.kind] || 'info', 16) + '</span>' +
          '<div><b>' + esc(a.text) + '</b><em>' + esc(a.kind) + ' · ' + UI.relTime(a.at) + ' at ' + UI.clock(a.at) + '</em></div></div>').join('') +
          '</div>'
        : UI.empty('activity', 'Nothing logged yet.', 'Bookings, payments, roster edits and results all land here.')) +
      '</section>';
  }

  function renderProfile(host) {
    const focus = takeFocus();
    const u = Store.settings.user;

    host.innerHTML =
      pageHead('My Profile',
        esc(u.name) + ' · ' + esc(u.role || 'Club Administrator') + ' — this account signs in to ' +
        esc(Store.settings.club.name) + '.',
        btn('add-note', 'Log a note', 'plus', 'ghost')) +

      '<div class="split">' + identityCard(u) +
        '<div class="grid">' +
          '<section class="panel">' +
          panelHead('Account details', 'Name, role and contact kept on your administrator record.',
            btn('save-account', 'Save changes', 'check', 'primary')) +
          formGrid('account', accountFields(u)) +
          '</section>' +
          '<section class="panel">' +
          panelHead('Password', 'Eight characters minimum — validated by the store before it is written.') +
          formGrid('password', PASSWORD_FIELDS) +
          '<div style="margin-top:16px;display:flex;justify-content:flex-end">' +
          btn('save-password', 'Update password', 'lock', 'accent') + '</div>' +
          '</section>' +
        '</div>' +
      '</div>' +

      '<div class="section-title">Alerts</div>' + notifyPanel(u) +

      '<div class="section-title">Personal snapshot</div>' + activityPanel();

    consumeFocus(focus);
  }

  /* ---------- inline profile writes ---------- */

  const saveScoped = (host, name) => host.querySelector('[data-rs-form="' + name + '"]');

  function saveAccount(host) {
    const scope = saveScoped(host, 'account');
    if (!scope) return;
    const v = UI.readForm(scope);
    const res = Store.ops.saveSettings('user', {
      name: v.name, role: String(v.role || '').trim() || 'Club Administrator',
      email: v.email, phone: String(v.phone || '').trim()
    });
    if (!res.ok) {
      UI.paintErrors(scope, res.errors || {});
      UI.toast(firstError(res.errors), 'err');
      return;
    }
    UI.paintErrors(scope, {});
    UI.toast('Account details saved for ' + Store.settings.user.name + '.');
  }

  function saveNotify(host) {
    const scope = saveScoped(host, 'notify');
    if (!scope) return;
    const v = UI.readForm(scope);
    const payload = Object.assign({}, Store.settings.user);
    NOTIFY_ITEMS.forEach(i => { payload[i.key] = !!v[i.key]; });
    const res = Store.ops.saveSettings('user', payload);
    if (!res.ok) { UI.toast(firstError(res.errors), 'err'); return; }
    const on = NOTIFY_ITEMS.filter(i => payload[i.key]).length;
    UI.toast('Notification preferences saved · ' + on + ' of ' + NOTIFY_ITEMS.length + ' alert types on.');
  }

  function savePassword(host) {
    const scope = saveScoped(host, 'password');
    if (!scope) return;
    const v = UI.readForm(scope);
    if (!String(v.newPassword || '').trim()) {
      UI.paintErrors(scope, { newPassword: 'Type the new password first.' });
      UI.toast('Type the new password first.', 'warn');
      return;
    }
    if (v.newPassword !== v.confirmPassword) {
      UI.paintErrors(scope, { confirmPassword: 'The two entries do not match.' });
      UI.toast('The two passwords do not match.', 'err');
      return;
    }
    const res = Store.ops.saveSettings('user', Object.assign({}, Store.settings.user, { newPassword: v.newPassword }));
    if (!res.ok) {
      UI.paintErrors(scope, res.errors || {});
      UI.toast(firstError(res.errors), 'err');
      return;
    }
    UI.paintErrors(scope, {});
    const stamp = Store.settings.user.passwordSet;
    UI.toast('Password updated' + (stamp ? ' · ' + UI.relTime(stamp) : '') + '.');
  }

  function setTheme(theme) {
    const st = PMSTATE();
    if (Store.settings.user.theme === theme && st.theme === theme) {
      UI.toast('You are already on the ' + (theme === 'dark' ? 'dark' : 'light') + ' theme.', 'info');
      return;
    }
    st.theme = theme;
    const res = Store.ops.saveSettings('user', Object.assign({}, Store.settings.user, { theme: theme }));
    if (!res.ok) { UI.toast(firstError(res.errors), 'err'); return; }
    UI.toast(theme === 'dark' ? 'Dark theme applied and saved to your account.' : 'Light theme applied and saved.');
  }

  function logNote() {
    UI.formModal({
      title: 'Log a note',
      sub: 'Saved to the club activity feed from your account.',
      fields: [
        { name: 'title', label: 'Note', col: 2, type: 'textarea', rows: 3, required: true, placeholder: 'Amina’s Gold renewal is settled — photo still missing.' },
        { name: 'tag', label: 'Tag', col: 1, type: 'select', value: 'General', options: toOpts(['Roster', 'Ladder', 'Bookings', 'Payments', 'General']) }
      ],
      submitLabel: 'Save note',
      onSubmit: v => Store.ops.addNote(v.title, v.tag),
      onDone: () => UI.toast('Note added to your activity feed.')
    });
  }

  /* ---------- delegated interaction ---------- */

  function onHostClick(e) {
    const host = e.currentTarget;
    const theme = e.target.closest('[data-rs-theme]');
    if (theme) return setTheme(theme.dataset.rsTheme);

    const el = e.target.closest('[data-rs]');
    if (el) {
      const act = el.dataset.rs;
      const id = el.dataset.rsId;
      if (act === 'add') return openPlayerForm(null);
      if (act === 'detail' && id) return openPlayerDetail(id);
      if (act === 'edit' && id) return openPlayerForm(id);
      if (act === 'status' && id) return toggleStatus(id);
      if (act === 'delete' && id) return removePlayer(id);
      if (act === 'export-roster') return exportPlayers(Store.list('players').map(p => p.id), 'full roster');
      if (act === 'export-ladder') return exportLadder();
      if (act === 'save-account') return saveAccount(host);
      if (act === 'save-notify') return saveNotify(host);
      if (act === 'save-password') return savePassword(host);
      if (act === 'add-note') return logNote();
      return;
    }

    const tr = e.target.closest('tr[data-row]');
    if (!tr) return;
    const mount = tr.closest('[data-rs-table="ladder"]');
    if (mount) openPlayerDetail(tr.dataset.row);
  }

  /* `host` is the persistent <main> element — the same function
     reference means re-binding on each render is a no-op. */
  function bind(host) {
    host.addEventListener('click', onHostClick);
  }

  function withBinding(render) {
    return function (host) {
      bind(host);
      render(host);
    };
  }

  Object.assign(PAGES, {
    members: { live: true, instant: true, render: withBinding(renderMembers) },
    rankings: { live: true, instant: true, render: withBinding(renderRankings) },
    profile: { live: true, instant: true, render: withBinding(renderProfile) }
  });
})();
