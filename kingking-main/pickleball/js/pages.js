/* ============================================================
   Feature pages reached from the icon rail — everything the
   reference clip does not show, built in the same design system.
   ============================================================ */

const PAGES = (function () {
  const H = (t, s, extra) => DASH.head(t, s) + (extra ? '<div style="margin:-8px 0 20px">' + extra + '</div>' : '');
  const card = (title, sub, body, tools, style) =>
    '<section class="card"' + (style ? ' style="' + style + '"' : '') + '>' +
    '<div class="card-head"><div><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
    (tools ? '<div class="card-tools">' + tools + '</div>' : '') + '</div>' + body + '</section>';
  const btn = (label, act, cls) => '<button class="pill-btn ' + (cls || 'primary') + '" data-action="' + act + '">' + label + '</button>';

  /* ---------------- Courts ---------------- */
  function courts() {
    const body = '<div class="grid g-3">' + VENUES.map(v => {
      const tag = v.status === 'open' ? 'tg-open' : v.status === 'busy' ? 'tg-busy' : v.status === 'soon' ? 'tg-soon' : 'tg-neutral';
      const txt = v.status === 'soon' ? 'Opening soon' : v.status[0].toUpperCase() + v.status.slice(1);
      return '<article class="card" style="padding:20px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">' +
        '<span class="stat"><span class="icon-slab">' + icon('court', 22) + '</span></span>' +
        '<span class="tagline ' + tag + '">' + txt + '</span></div>' +
        '<h3 style="margin:0 0 4px;font-size:17px;font-weight:700">' + v.name + '</h3>' +
        '<p style="margin:0 0 14px;font-size:12px;color:var(--ink-3);font-weight:600">' + icon('map-pin', 12) + ' Brgy. ' + v.barangay + '</p>' +
        '<div class="row" style="padding:8px 0"><span class="t2" style="flex:1">Courts</span><b style="font-size:13px">' + (v.courts || '—') + '</b></div>' +
        '<div class="row" style="padding:8px 0"><span class="t2" style="flex:1">Indoor</span><b style="font-size:13px">' + (v.indoor ? 'Yes' : 'Open air') + '</b></div>' +
        '<div class="row" style="padding:8px 0"><span class="t2" style="flex:1">Hours</span><b style="font-size:13px">' + v.open + ' – ' + v.close + '</b></div>' +
        '<div class="row" style="padding:8px 0"><span class="t2" style="flex:1">Rate / hour</span><b style="font-size:13px">' + (v.price ? money(v.price) : '—') + '</b></div>' +
        '<div style="font-size:11.5px;color:var(--ink-3);margin:10px 0 14px;line-height:1.5">' + v.note + '</div>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="pill-btn primary" style="flex:1;justify-content:center" data-book="' + v.id + '">' + icon('calendar', 14) + 'Book</button>' +
        '<button class="pill-btn ghost" data-pin="' + v.id + '">' + icon('navigation', 14) + '</button></div>' +
        '</article>';
    }).join('') + '</div>';
    return H('Courts', VENUES.length + ' venues across ' + CLUB.city + ' · ' + CLUB.courts + ' registered courts') + body;
  }

  /* ---------------- Booking ---------------- */
  function booking() {
    const days = dayStrip(10);
    const grid = '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);gap:20px" class="bookwrap">' +
      card('Pick a slot', 'Ranao Lake Courts · today',
        '<div class="daystrip">' + days.map((d, i) =>
          '<button class="day' + (d.isToday ? ' is-active' : '') + '" data-day="' + i + '">' + d.label + '</button>').join('') + '</div>' +
        '<div style="display:grid;grid-template-columns:62px repeat(6,minmax(0,1fr));gap:8px;margin-top:18px">' +
        ['6 AM', '8 AM', '10 AM', '12 NN', '2 PM', '4 PM', '6 PM', '8 PM'].map((t, r) =>
          '<span class="time">' + t + '</span>' +
          [1, 2, 3, 4, 5, 6].map(c => {
            const seed = (r * 6 + c * 3) % 7;
            const st = seed === 0 ? 'busy' : seed === 4 ? 'mine' : seed === 2 ? 'half' : '';
            return '<button class="slot ' + st + '" data-slot="b' + r + c + '" title="Court ' + c + ' · ' + t + '"></button>';
          }).join('')).join('') + '</div>' +
        '<div class="legend" style="margin-top:16px"><span><i style="background:rgba(127,127,160,.3)"></i>Free</span>' +
        '<span><i style="background:#ef7c33"></i>Booked</span><span><i style="background:#6b7cff"></i>Yours</span></div>') +
      card('Your booking', 'Complete the details',
        '<div class="stack" style="gap:14px">' +
        [['Venue', 'Ranao Lake Courts'], ['Court', 'Court 2 — indoor'], ['Date', new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long' })],
         ['Time', '16:00 – 18:00 (2 hours)'], ['Players', '4 · Doubles'], ['Rate', money(120 * 2) + ' / hour × 2']]
          .map(r => '<div class="row"><span class="slab tint">' + icon('check', 16) + '</span>' +
            '<div class="grow"><div class="t2">' + r[0] + '</div><div class="t1">' + r[1] + '</div></div></div>').join('') +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:18px;border-top:1px solid var(--line)">' +
        '<span style="font-size:12px;color:var(--ink-3);font-weight:700">Total due</span>' +
        '<span style="font-size:28px;font-weight:800;letter-spacing:-.03em">' + money(480) + '</span></div>' +
        '<div style="display:flex;gap:10px;margin-top:18px">' + btn('Confirm & pay GCash', 'confirm-booking', 'accent') + btn('Save draft', 'draft', 'ghost') + '</div>') +
      '</div>';
    return H('Book a Court', 'Reserve a slot at any ' + CLUB.city + ' venue') + grid;
  }

  /* ---------------- Matches ---------------- */
  function matches() {
    const rows = MATCHES.map(m => {
      const tag = m.state === 'live' ? 'tg-busy' : m.state === 'soon' ? 'tg-soon' : m.state === 'done' ? 'tg-neutral' : 'tg-open';
      return '<tr><td>' + m.round + '</td><td><b>' + m.a + '</b><div class="t2">vs</div>' + m.b + '</td>' +
        '<td>' + m.court + '</td><td>' + m.time + '</td><td style="font-weight:800">' + m.score + '</td>' +
        '<td><span class="tagline ' + tag + '">' + m.state + '</span></td></tr>';
    }).join('');
    const live = '<div class="grid g-3" style="margin-bottom:20px">' +
      card('Live now', 'Ranao Lake C2', '<div style="display:flex;align-items:center;gap:16px">' +
        '<span style="font-size:46px;font-weight:800;letter-spacing:-.04em">9 – 7</span>' +
        '<div><div style="font-size:13px;font-weight:700">Amina / Soraya</div><div class="t2">vs Josef / Emil</div>' +
        '<span class="tagline tg-busy" style="margin-top:8px">Game 2 · to 11</span></div></div>' +
        CH.spark([4, 6, 5, 9, 8, 11, 9], '#ef7c33')) +
      card('Match of the week', 'Marawi Open · SF', '<div class="stack" style="gap:12px">' +
        ['Amina Mangunsong', 'Josef Alonto', 'Soraya Macarambon', 'Emil Cadar'].map((n, i) =>
          '<div class="row" style="padding:6px 0"><span class="avatar" style="width:34px;height:34px;font-size:11px;background:' +
          ['#6b7cff', '#2fb37c', '#e0607e', '#f4a036'][i] + '">' + initials(n) + '</span>' +
          '<div class="grow"><div class="t1">' + n + '</div></div><span class="t2">3.' + (8 - i) + '</span></div>').join('') + '</div>') +
      card('Open challenges', 'Post a result and climb', '<div class="chips">' +
        ['Doubles · 3.5', 'Singles · 3.0', 'Mixed · 3.2', 'Beginner · 2.5', 'Anyone · 6 PM'].map(c => '<span class="chip">' + c + '</span>').join('') +
        '</div>' + '<div style="margin-top:16px">' + btn('Start a challenge', 'challenge') + '</div>') + '</div>';
    return H('Matches', 'Live scores, fixtures and results') + live +
      card('Fixtures & results', MATCHES.length + ' matches', '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        '<th>Round</th><th>Players</th><th>Court</th><th>When</th><th>Score</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  /* ---------------- Leagues ---------------- */
  function leagues() {
    const cards = '<div class="grid g-4" style="margin-bottom:20px">' + LEAGUES.map(l =>
      '<article class="prog ' + l.tone + '" style="cursor:default">' +
      '<h4>' + l.name + '</h4><p>' + l.div + '</p>' +
      '<div class="foot"><span class="date">' + icon('trophy', 14) + l.teams + ' teams</span>' +
      '<span class="date">' + icon('wallet', 14) + money(l.pot) + '</span></div>' +
      '<div class="bar" style="margin-top:14px;background:rgba(255,255,255,.5)"><i style="width:' + Math.min(100, (l.played / 90) * 100) + '%"></i></div>' +
      '<div style="font-size:11px;font-weight:700;color:rgba(34,29,58,.6);margin-top:8px">' + l.played + ' matches played · ends ' + l.ends + '</div>' +
      '</article>').join('') + '</div>';

    const table = '<tr><td>1</td><td><b>Amina Mangunsong</b></td><td>Ranao Lake</td><td>18–2</td><td>+16</td><td>' + money(45000) + '</td></tr>' +
      '<tr><td>2</td><td><b>Josef Alonto</b></td><td>MSU Center</td><td>16–4</td><td>+9</td><td>' + money(28000) + '</td></tr>' +
      '<tr><td>3</td><td><b>Soraya Macarambon</b></td><td>Lamai</td><td>15–5</td><td>+4</td><td>' + money(18000) + '</td></tr>' +
      '<tr><td>4</td><td><b>Emil Cadar</b></td><td>Balindog</td><td>13–7</td><td>-3</td><td>' + money(9000) + '</td></tr>' +
      '<tr><td>5</td><td><b>Abdul Dimalantan</b></td><td>Ranao Lake</td><td>12–8</td><td>+2</td><td>' + money(4500) + '</td></tr>';

    return H('Leagues & Ladder', 'Four competitions running across Marawi City') + cards +
      card('Ranao Lake League · Division 1', 'Standings after 42 matches',
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>Home venue</th><th>W–L</th><th>Form</th><th>Prize</th></tr></thead><tbody>' + table + '</tbody></table></div>' +
        '<div style="margin-top:18px;display:flex;gap:10px">' + btn('Register a team', 'register-team') + btn('Download draw sheet', 'draw', 'ghost') + '</div>');
  }

  /* ---------------- Schedule ---------------- */
  function schedule() {
    const days = dayStrip(14);
    return H('Schedule', 'Clinics, matches and court blocks for the next two weeks') +
      card('Week view', monthLabel(),
        '<div class="daystrip">' + days.map(d => '<button class="day' + (d.isToday ? ' is-active' : '') + '">' + d.label + '</button>').join('') + '</div>' +
        '<div style="margin-top:22px" class="stack">' +
        [['06:00', 'Sunrise Doubles Social', 'Lamai Riverside', 'Social', 'tg-open'],
         ['08:30', 'Beginner clinic — Master the Basics', 'Mapandi Community', 'Clinic', 'tg-soon'],
         ['11:00', 'Court maintenance C3 (resurface)', 'Ranao Lake', 'Ops', 'tg-neutral'],
         ['16:30', 'Ranao League · MD semifinal', 'Ranao Lake C2', 'Match', 'tg-busy'],
         ['19:00', 'Ladder Division 2 challenge', 'Balindog C1', 'Match', 'tg-busy']]
          .map(r => '<div class="row"><span class="slab" style="background:var(--card-solid);color:var(--ink);border:1px solid var(--line)">' + r[0] + '</span>' +
            '<div class="grow"><div class="t1">' + r[1] + '</div><div class="t2">' + r[2] + '</div></div>' +
            '<span class="tagline ' + r[4] + '">' + r[3] + '</span></div>').join('') + '</div>');
  }

  /* ---------------- Members ---------------- */
  function members() {
    const rows = MEMBERS.map(m =>
      '<tr><td><div style="display:flex;align-items:center;gap:12px">' +
      '<span class="avatar" style="width:38px;height:38px;font-size:12px;background:' + m.tone + '">' + m.ini + '</span>' +
      '<div><div style="font-weight:700">' + m.name + '</div><div class="t2">' + m.venue + '</div></div></div></td>' +
      '<td>' + m.level.toFixed(1) + '</td><td>' + m.play + '</td><td>' + nf.format(m.pts) + '</td>' +
      '<td>' + m.streak + ' d</td><td><span class="tagline ' + (m.status === 'Gold' ? 'tg-soon' : m.status === 'Silver' ? 'tg-neutral' : 'tg-open') + '">' + m.status + '</span></td>' +
      '<td><button class="mini-btn round" data-action="message">' + icon('message', 14) + '</button></td></tr>').join('');
    return H('Members', nf.format(CLUB.members) + ' registered players in ' + CLUB.city) +
      '<div class="grid g-4" style="margin-bottom:20px">' +
      [['New this month', '12', 'up', '+4'], ['Active weekly', '248', 'up', '+21'], ['At risk', '17', 'down', '-3'], ['Avg. rating', '3.1', 'up', '+0.1']]
        .map(s => '<section class="card stat"><span class="label">' + s[0] + '</span><span class="value">' + s[1] +
          '<span class="trend ' + s[2] + '">' + icon(s[2] === 'up' ? 'arrow-up-right' : 'arrow-down', 13) + s[3] + '</span></span></section>').join('') + '</div>' +
      card('Member directory', 'Sorted by club points',
        '<div class="chips" style="margin-bottom:16px">' + ['All', 'Gold', 'Silver', 'Bronze', 'Doubles', 'Singles', 'Mixed'].map((c, i) =>
          '<button class="chip' + (i === 0 ? ' is-active' : '') + '">' + c + '</button>').join('') + '</div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th>Rating</th><th>Plays</th><th>Points</th><th>Streak</th><th>Tier</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  /* ---------------- Rankings ---------------- */
  function rankings() {
    const podium = '<div class="grid g-3" style="margin-bottom:20px">' + LEADERS.slice(0, 3).map((l, i) =>
      '<section class="card" style="text-align:center">' +
      '<span class="avatar" style="width:74px;height:74px;font-size:22px;margin:-6px auto 14px;display:grid;background:' + l.tone + '">' + l.ini + '</span>' +
      '<div style="font-size:12px;font-weight:800;color:var(--ink-3)">#' + (i + 1) + ' · ' + ['Champion', 'Runner-up', 'Third place'][i] + '</div>' +
      '<h3 style="margin:8px 0 2px;font-size:19px;font-weight:700">' + l.name + '</h3>' +
      '<p style="margin:0 0 14px;font-size:12px;color:var(--ink-3);font-weight:600">' + l.sub + '</p>' +
      '<div style="font-size:40px;font-weight:800;letter-spacing:-.04em">' + nf.format(l.score) + '</div>' +
      '<span class="trend ' + (l.delta[0] === '+' ? 'up' : 'down') + '" style="margin-top:8px">' + icon(l.delta[0] === '+' ? 'arrow-up-right' : 'arrow-down', 13) + l.delta + '</span>' +
      '</section>').join('') + '</div>';
    const rows = MEMBERS.map((m, i) => '<tr><td class="rank">' + (i + 1) + '</td>' +
      '<td><b>' + m.name + '</b></td><td>' + m.venue + '</td><td>' + m.level.toFixed(1) + '</td>' +
      '<td>' + nf.format(m.pts) + '</td><td>' + CH.spark([3, 5, 4, 7, 6, 8, m.streak], m.tone) + '</td></tr>').join('');
    return H('Rankings', 'Marawi club ladder · updated live') + podium +
      card('Full ladder', MEMBERS.length + ' ranked players',
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>Home venue</th><th>Rating</th><th>Points</th><th>Form</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  /* ---------------- Training / clinics ---------------- */
  function training() {
    return H('Clinics & Programs', 'Learn, drill and grade up with the Marawi coaching staff') +
      '<div class="grid g-2">' + PROGRAMS.map(p =>
        '<article class="prog ' + p.tone + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<h4 style="max-width:70%">' + p.title + '</h4><span class="date">' + p.level + '</span></div>' +
        '<p>' + p.desc + '</p>' +
        '<div class="bar" style="background:rgba(255,255,255,.55)"><i style="width:' + ((p.enrolled / p.spots) * 100) + '%"></i></div>' +
        '<div style="font-size:11.5px;font-weight:700;color:rgba(34,29,58,.65);margin:8px 0 14px">' + p.enrolled + ' / ' + p.spots + ' enrolled · starts ' + p.date + '</div>' +
        '<div class="foot"><span class="date">' + icon('users', 14) + p.coaches.join(' · ') + '</span>' +
        '<button class="white-btn pill-btn" style="background:rgba(255,255,255,.75);color:#3a3358" data-enroll="' + p.id + '">' + icon('plus', 14) + 'Enroll</button></div>' +
        '</article>').join('') + '</div>';
  }

  /* ---------------- Shot library (mirrors "Word library") ---------------- */
  function library() {
    return H('Shot Library', 'The vocabulary of the game — tap a card for the drill') +
      '<div class="chips" style="margin-bottom:20px">' + ['All', 'Shot', 'Zone', 'Tactic', 'Rule', 'Style'].map((c, i) =>
        '<button class="chip' + (i === 0 ? ' is-active' : '') + '">' + c + '</button>').join('') + '</div>' +
      '<div class="wordgrid">' + SHOTS.map(s =>
        '<article class="wordcard ' + s.tone + '">' +
        '<button class="go">' + icon('arrow-up-right', 14) + '</button>' +
        '<span class="kind">' + s.kind + '</span>' +
        '<h4>' + s.term + '</h4><p>' + s.def + '</p>' +
        '</article>').join('') + '</div>';
  }

  /* ---------------- Drills ---------------- */
  function drills() {
    return H('Daily Drills', 'Small habits, big rating jumps') +
      '<div class="grid g-2">' +
      card('Today’s checklist', DRILLS.filter(d => d.pct < 100).length + ' of ' + DRILLS.length + ' to go',
        DRILLS.map(d => '<div class="row"><span class="slab">' + icon(d.icon, 18) + '</span>' +
          '<div class="grow"><div class="t1">' + d.title + '</div><div class="t2">' + d.sub + '</div>' +
          '<div class="bar"><i style="width:' + d.pct + '%"></i></div></div>' +
          '<span class="pct">' + d.pct + '%</span></div>').join('')) +
      card('Weekly volume', 'Reps logged across the club',
        CH.bars({ data: [180, 240, 205, 320, 280, 410, 260], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hot: 5, h: 240 }) +
        '<div class="chips" style="margin-top:16px">' + ['Dinks', 'Third drops', 'Volleys', 'Speedups', 'Footwork'].map(c => '<span class="chip">' + c + '</span>').join('') + '</div>') +
      '</div>';
  }

  /* ---------------- Messages ---------------- */
  function messages() {
    return H('Messages', 'League captains, coaches and court ops') +
      '<div style="display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:20px" class="msgwrap">' +
      card('Inbox', THREADS.length + ' conversations',
        '<div class="stack" style="gap:6px">' + THREADS.map(t =>
          '<div class="row" style="padding:12px 8px;border-radius:14px" data-thread="' + t.who + '">' +
          '<span class="avatar" style="width:42px;height:42px;font-size:13px;background:' + t.tone + '">' + t.ini + '</span>' +
          '<div class="grow"><div class="t1">' + t.who + '</div><div class="t2">' + t.last + '</div></div>' +
          (t.unread ? '<span class="tagline tg-busy">' + t.unread + '</span>' : '<span class="t2">' + t.time + '</span>') +
          '</div>').join('') + '</div>') +
      card('Ranao League Captains', '12 members · Marawi City',
        '<div class="stack" style="gap:12px">' +
        [['Abdul', 'AD', 'Draw sheet is up — check your slot.', true],
         ['Coach Fatima', 'FA', 'Bring 4-ball jugs Saturday.', false],
         ['Emil', 'EC', 'Can we push C2 to 17:00?', false],
         ['Amina', 'AM', 'Confirmed. See you at the lake.', true]]
          .map(m => '<div style="display:flex;gap:12px;align-items:flex-end;' + (m[3] ? 'justify-content:flex-end' : '') + '">' +
            (m[3] ? '' : '<span class="avatar" style="width:34px;height:34px;font-size:11px;background:' + ['#6b7cff', '#2fb37c', '#f4a036', '#e0607e'][0] + '">' + m[1] + '</span>') +
            '<div style="max-width:70%;padding:14px 16px;border-radius:18px;background:' + (m[3] ? 'var(--ink);color:#fff' : 'rgba(127,127,160,.12)') + ';font-size:13px;font-weight:600;line-height:1.5">' + m[2] + '</div></div>').join('') +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:20px">' +
        '<input placeholder="Message the captains…" style="flex:1;padding:14px 18px;border-radius:999px;border:1px solid var(--line);background:rgba(127,127,160,.08);outline:none;font-weight:600">' +
        '<button class="round-solid">' + icon('navigation', 18) + '</button></div>') +
      '</div>';
  }

  /* ---------------- Events ---------------- */
  function events() {
    return H('Events', 'What’s happening around ' + CLUB.city) +
      '<div class="grid g-3">' + EVENTS.map(e =>
        '<article class="prog ' + e.tone + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<span class="date">' + icon('calendar', 14) + e.date + '</span><span class="date">' + e.kind + '</span></div>' +
        '<h4 style="margin-top:14px">' + e.title + '</h4>' +
        '<p>' + icon('map-pin', 12) + ' ' + e.venue + '</p>' +
        '<div class="foot"><span class="date">' + icon('users', 14) + e.spots + ' spots left</span>' +
        '<button class="pill-btn" style="background:rgba(255,255,255,.7);color:#3a3358" data-rsvp="' + e.title + '">RSVP</button></div>' +
        '</article>').join('') + '</div>';
  }

  /* ---------------- City map ---------------- */
  function map() {
    return H('Marawi City Map', CLUB.address + ' · ' + CLUB.lat.toFixed(4) + '° N, ' + CLUB.lng.toFixed(4) + '° E',
             '<button class="pill-btn ghost" data-goto="tour">' + icon('video', 15) + 'Court tour</button>' +
             btn('Add a venue', 'add-venue', 'primary') + btn('Share location', 'share', 'ghost')) +
      LIVEMAP.html();
  }

  /* ---------------- Venues page — real CRUD over the store ---------------- */
  const VENUE_STATUS = ['open', 'busy', 'closed', 'soon'];
  const venueTone = v => v.status === 'open' ? 'tg-open' : v.status === 'busy' ? 'tg-busy'
    : v.status === 'soon' ? 'tg-soon' : 'tg-neutral';

  function venueFields(v) {
    v = v || {};
    return [
      { name: 'name', label: 'Venue name', type: 'text', col: 1, required: true, placeholder: 'Ranao Lake Courts', value: v.name },
      { name: 'barangay', label: 'Barangay', type: 'text', col: 1, required: true, placeholder: 'Patani', value: v.barangay },
      { name: 'status', label: 'Status', type: 'select', col: 1, required: true, value: v.status || 'open',
        options: VENUE_STATUS.map(s => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })) },
      { name: 'courts', label: 'Decks', type: 'number', col: 1, min: 0, max: 40, value: v.courts == null ? 2 : v.courts,
        help: 'Raising this opens matching courts in the booking engine; lowering it never retires a deck by itself.' },
      { name: 'price', label: 'Rate per hour', type: 'number', col: 1, min: 0, step: 10, value: v.price == null ? 100 : v.price,
        help: 'New decks open at this rate — decks already on file keep their own price.' },
      { name: 'rating', label: 'Rating', type: 'number', col: 1, min: 0, max: 5, step: .1, value: v.rating == null ? 4.5 : v.rating },
      { name: 'open', label: 'Opens at', type: 'time', col: 1, value: v.open || '06:00' },
      { name: 'close', label: 'Closes at', type: 'time', col: 1, value: v.close || '20:00' },
      { name: 'indoor', label: 'Indoor decks', type: 'checkbox', col: 1, value: !!v.indoor },
      { name: 'lat', label: 'Latitude', type: 'number', col: 1, step: .0001, min: -90, max: 90, required: true,
        value: v.lat == null ? 8.0 : v.lat, help: 'Marawi runs 7.97–8.06° N.' },
      { name: 'lng', label: 'Longitude', type: 'number', col: 1, step: .0001, min: -180, max: 180, required: true,
        value: v.lng == null ? 124.28 : v.lng, help: 'Marawi runs 124.23–124.34° E.' },
      { name: 'note', label: 'Note for the desk', type: 'textarea', col: 2, rows: 2,
        placeholder: 'Flood-lit until 21:00, parking in front…', value: v.note || '' }
    ];
  }

  function venueFormModal(seed) {
    const v = seed || {};
    const isEdit = !!v.id;
    UI.formModal({
      title: isEdit ? 'Edit ' + v.name : 'Add a venue',
      sub: isEdit ? 'Coordinates, decks, hours and rates — the map, the booking engine and the tour all read this row.'
        : 'The venue lands on the city map, the booking engine and the availability board straight away.',
      wide: true,
      submitLabel: isEdit ? 'Save changes' : 'Create venue',
      fields: venueFields(v),
      onSubmit(vals) {
        return Store.ops.saveVenue(Object.assign({}, vals, { id: isEdit ? v.id : null }));
      },
      onDone(res) {
        if (!res || !res.venue) return;
        UI.toast((isEdit ? res.venue.name + ' updated' : res.venue.name + ' added to the club map') +
          ' · ' + res.venue.courts + ' deck(s) at Brgy. ' + res.venue.barangay);
        if (res.kept) {
          UI.toast(res.kept + ' deck(s) on file were kept — retire them on the Courts page.', 'warn');
        }
      }
    });
  }

  function venueDetail(v) {
    const courts = Store.sel.venuesForVenue(v.id);
    const month = Store.monthLabel(Store.today());
    const rows = Store.list('bookings').filter(b => b.status !== 'cancelled' &&
      b.date.slice(0, 7) === Store.today().slice(0, 7) && courts.some(c => c.id === b.courtId));
    const revenue = rows.reduce((s, b) => s + (b.amount || 0), 0);
    UI.modal({
      title: v.name,
      sub: 'Brgy. ' + v.barangay + ', ' + CLUB.city + ' · ' + v.lat.toFixed(5) + '° N, ' + v.lng.toFixed(5) + '° E',
      wide: true,
      body: '<div class="grid g-3" style="gap:14px;margin-bottom:18px">' +
        ['Decks', 'This month', 'Revenue ' + month].map((l, i) =>
          '<div style="padding:14px;border-radius:15px;background:rgba(127,127,160,.09)">' +
          '<div class="t2">' + l + '</div><div style="font-size:19px;font-weight:800;margin-top:4px">' +
          (i === 0 ? (courts.length || '—') : i === 1 ? rows.length + ' booking(s)' : money(revenue)) +
          '</div></div>').join('') + '</div>' +
        '<dl class="kv">' +
        '<div><dt>Status</dt><dd>' + v.status + '</dd></div>' +
        '<div><dt>Hours</dt><dd>' + v.open + ' – ' + v.close + '</dd></div>' +
        '<div><dt>Rate</dt><dd>' + (v.price ? money(v.price) + '/hr' : 'Free play') + '</dd></div>' +
        '<div><dt>Surface</dt><dd>' + (v.indoor ? 'Indoor' : 'Outdoor') + '</dd></div>' +
        '<div><dt>Rating</dt><dd>' + (v.rating ? v.rating + ' ★' : 'Not rated') + '</dd></div>' +
        '<div><dt>Courts</dt><dd>' + (courts.length ? courts.map(c => c.name).join(', ') : 'none set up yet') + '</dd></div>' +
        '<div style="grid-column:1/-1"><dt>Note</dt><dd>' + UI.esc(v.note || '—') + '</dd></div></dl>',
      actions: [
        courts.length ? { id: 'book', label: 'Book here', cls: 'accent' } : { id: 'courts', label: 'Add courts', cls: 'accent' },
        { id: 'map', label: 'Show on map', cls: 'ghost' },
        { id: 'edit', label: 'Edit venue', cls: 'ghost' },
        { id: 'del', label: 'Delete venue', cls: 'danger' }
      ],
      onAction(id) {
        const st = PMSTATE();
        if (id === 'book') { st.venue = v.id; go('booking', 'new'); }
        if (id === 'map') { st.venue = v.id; go('map'); }
        if (id === 'courts') { st.newCourt = { id: v.id, at: Date.now() }; go('courts'); }
        if (id === 'edit') venueFormModal(v);
        if (id === 'del') {
          UI.confirm({
            title: 'Delete ' + v.name + '?',
            sub: 'The venue comes off the city map, the booking engine and the tour.',
            danger: true, okLabel: 'Delete venue', cancelLabel: 'Keep it',
            body: 'Empty decks go with it. Decks that hold a booking history stay until you retire them yourself.',
            detail: courts.length ? 'Its ' + courts.length + ' court record(s) are listed here: ' +
              courts.map(c => c.name).join(', ') + '.' : 'No court records are filed under it yet.'
          }).then(ok => {
            if (!ok) return;
            const r = Store.ops.deleteVenue(v.id);
            if (!r.ok) { UI.toast((r.errors && r.errors.id) || 'Venue not deleted.', 'err'); return; }
            UI.toast(v.name + ' removed from the map' + (r.courts ? ' with ' + r.courts + ' deck(s)' : ''));
          });
        }
      }
    });
  }

  const venuesPage = {
    live: true,
    /* the city map header reaches these through the shell click router */
    openForm: () => venueFormModal(null),
    share: () => shareClubLocation(),
    detail: id => { const v = Store.get('venues', id); if (v) venueDetail(v); },
    render(host) {
      const st = PMSTATE();
      const term = st.q || '';
      const venues = Store.venues.filter(v =>
        !term || (v.name + ' ' + v.barangay + ' ' + (v.note || '')).toLowerCase().includes(term.toLowerCase()));
      const cards = '<div class="grid g-2">' + (venues.length
        ? venues.map(v => {
        const courts = Store.sel.venuesForVenue(v.id);
        return '<section class="card"><div style="display:flex;gap:16px;align-items:flex-start">' +
          '<span class="avatar" style="width:56px;height:56px;font-size:16px;background:linear-gradient(140deg,#f4a036,#e0607e)">' + initials(v.name) + '</span>' +
          '<div style="flex:1;min-width:0"><h3 style="margin:0;font-size:18px;font-weight:700;cursor:pointer" data-action="venue-detail" data-id="' + v.id + '">' +
          UI.esc(v.name) + '</h3>' +
          '<p style="margin:4px 0 0;font-size:12px;color:var(--ink-3);font-weight:600">Brgy. ' + UI.esc(v.barangay) + ', ' + CLUB.city + ' · ' + CLUB.province + ' 9700</p>' +
          '<p class="v-coord">' + icon('map-pin', 12) + ' ' + v.lat.toFixed(5) + '° N, ' + v.lng.toFixed(5) + '° E</p></div>' +
          '<span class="tagline ' + venueTone(v) + '">' + (courts.length ? v.rating + ' ★' : 'coming soon') + '</span></div>' +
          '<div class="grid g-3" style="margin-top:18px;gap:12px">' +
          [['Courts', courts.length || '—'], ['Surface', v.indoor ? 'Indoor' : 'Outdoor'], ['Rate', v.price ? money(v.price) + '/h' : '—']]
            .map(s => '<div style="padding:12px;border-radius:14px;background:rgba(127,127,160,.09)">' +
              '<div class="t2">' + s[0] + '</div><div style="font-size:15px;font-weight:800;margin-top:3px">' + s[1] + '</div></div>').join('') + '</div>' +
          '<div style="font-size:12px;color:var(--ink-3);margin-top:14px;line-height:1.6">' + UI.esc(v.note || 'No desk note yet.') + ' · Open ' + v.open + ' – ' + v.close + '</div>' +
          '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">' +
          (courts.length ? '<button class="pill-btn primary" data-book="' + v.id + '">' + icon('calendar', 14) + 'Book here</button>'
            : '<button class="pill-btn ghost" data-action="add-courts" data-id="' + v.id + '">Add decks</button>') +          '<button class="pill-btn ghost" data-pin="' + v.id + '">' + icon('navigation', 14) + 'Show on map</button>' +
          '<button class="pill-btn ghost" data-action="venue-edit" data-id="' + v.id + '">' + icon('pen', 14) + 'Edit</button>' +
          '<a class="pill-btn ghost" href="https://www.google.com/maps/dir/?api=1&destination=' + v.lat + ',' + v.lng +
          '" target="_blank" rel="noopener">' + icon('external', 14) + 'Directions</a></div>' +
          '</section>';
      }).join('') : UI.empty('globe', 'No venue matches “' + term + '”.', 'Clear the search or add the next address on the map.',
        btn('Add a venue', 'add-venue', 'primary'))) + '</div>';

      /* a fresh wrapper per render: #view lives across routes, so a listener
         bound there would fire once per re-render */
      const wrap = document.createElement('div');
      wrap.className = 'vn-root';
      wrap.innerHTML =
        H('Venues', Store.venues.length + ' facilities around ' + CLUB.city + ' — every card is live data',
          '<div class="tp-search" style="width:min(320px,100%)">' + icon('search', 15) +
          '<input type="search" id="vnSearch" placeholder="Search venues or barangays…" value="' + UI.esc(term) + '"></div>' +
          btn('Add a venue', 'add-venue', 'primary') + btn('Share location', 'share-club', 'ghost')) +
        cards;
      host.innerHTML = '';
      host.appendChild(wrap);

      const search = wrap.querySelector('#vnSearch');
      if (search) search.addEventListener('input', () => {
        st.q = search.value;
        venuesPage.render(host);
        const again = host.querySelector('#vnSearch');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });

      /* deep links: global search opens the venue card, 'new' opens the form */
      if (st.focus === 'new') { st.focus = null; venueFormModal(null); }
      else if (st.focus) {
        const hit = Store.get('venues', st.focus);
        st.focus = null;
        if (hit) venueDetail(hit);
      }

      wrap.addEventListener('click', e => {
        const t = e.target.closest('[data-action]');
        if (!t) return;
        const a = t.dataset.action;
        /* add-venue and share-club are routed by the shell so the city map
           header can use the very same actions */
        if (a === 'venue-edit' || a === 'venue-detail') {
          const v = Store.get('venues', t.dataset.id);
          if (!v) return UI.toast('Venue not found.', 'err');
          return a === 'venue-edit' ? venueFormModal(v) : venueDetail(v);
        }
        if (a === 'add-courts') { PMSTATE().newCourt = { id: t.dataset.id, at: Date.now() }; go('courts'); return; }
      });
    }
  };

  function shareClubLocation() {
    const c = Store.settings.club;
    const addr = String(c.address || '').trim();
    const tail = addr.toLowerCase().indexOf(String(c.city).toLowerCase()) > -1 ? '' : ', ' + c.city;
    const text = c.name + ' — ' + addr + tail + ' · ' +
      CLUB.lat.toFixed(5) + '° N, ' + CLUB.lng.toFixed(5) + '° E · ' +
      'https://maps.google.com/?q=' + CLUB.lat + ',' + CLUB.lng + ' · ' + c.phone;
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-1200px;top:0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch (err) { /* clipboard blocked — fall back to the modal */ }
    if (ok) return UI.toast('Club address copied to the clipboard');
    UI.modal({
      title: 'Club location',
      sub: 'Copy this and paste it into any chat or map app.',
      size: 'sm',
      body: '<div class="field"><label>Address + coordinates</label><textarea id="shareLoc" rows="4" readonly>' +
        UI.esc(text) + '</textarea></div>',
      actions: [{ id: 'sel', label: 'Select all', cls: 'ghost' }],
      onAction(id, scope) {
        const ta = scope.querySelector('#shareLoc');
        if (ta) { ta.focus(); ta.select(); }
        return false;
      }
    });
  }

  /* ---------------- Weather ---------------- */
  function weather() {
    const w = WEATHER;
    return H('Court Weather', 'Open-air play across ' + CLUB.city + ' · ' + w.today.cond) +
      '<div class="grid g-4" style="margin-bottom:20px">' +
      [['Now', w.today.temp + '°C', 'thermometer'], ['Wind', w.today.wind + ' km/h', 'wind'],
       ['Humidity', w.today.hum + '%', 'droplet'], ['UV index', w.today.uv, 'sun']]
        .map(s => '<section class="card stat"><span class="icon-slab">' + icon(s[2] === 'thermometer' ? 'droplet' : s[2], 22) + '</span>' +
          '<span class="label">' + s[0] + '</span><span class="value" style="font-size:32px">' + s[1] + '</span></section>').join('') + '</div>' +
      card('7-day outlook', 'Rain probability vs temperature', CH.weather({ labels: w.labels, high: w.high, low: w.low, rain: w.rain })) +
      '<div class="grid g-2" style="margin-top:20px">' +
      card('Playability by venue', 'Outdoor decks close above 60% rain chance',
        VENUES.filter(v => !v.indoor).map(v => {
          const risk = v.id === 'v4' ? 62 : v.id === 'v6' ? 28 : v.id === 'v5' ? 34 : 22;
          return '<div class="row"><span class="slab tint">' + icon('cloud', 18) + '</span>' +
            '<div class="grow"><div class="t1">' + v.name + '</div><div class="t2">Brgy. ' + v.barangay + '</div>' +
            '<div class="bar ' + (risk > 50 ? 'warm' : '') + '"><i style="width:' + risk + '%"></i></div></div>' +
            '<span class="pct">' + risk + '%</span></div>';
        }).join('')) +
      card('Best windows this week', 'When the lake breeze is calmest',
        '<div class="stack">' + [['Mon–Wed', '05:30 – 08:00', 'Clear, cool air off Lanao'],
          ['Thu', '16:00 – 18:00', 'Post-rain, dry decks'], ['Fri–Sun', '06:00 – 10:00', 'Ideal for clinics']]
          .map(r => '<div class="row"><span class="slab">' + icon('clock', 18) + '</span>' +
            '<div class="grow"><div class="t1">' + r[1] + '</div><div class="t2">' + r[2] + '</div></div>' +
            '<span class="tagline tg-open">' + r[0] + '</span></div>').join('') + '</div>') +
      '</div>';
  }

  /* ---------------- Pro shop ---------------- */
  function proshop() {
    return H('Pro Shop', 'Paddles, balls and court gear — pick up at any venue') +
      '<div class="grid g-4">' + SHOP.map(p =>
        '<article class="card" style="padding:18px">' +
        '<div class="prog ' + p.tone + '" style="height:120px;display:grid;place-items:center;margin-bottom:14px">' +
        '<span style="color:#3a3358">' + icon(p.icon, 40) + '</span></div>' +
        '<div class="t2" style="text-transform:uppercase;letter-spacing:.06em;font-size:10px;font-weight:800">' + p.cat + '</div>' +
        '<h3 style="margin:6px 0 8px;font-size:15px;font-weight:700;line-height:1.3">' + p.name + '</h3>' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<span style="font-size:19px;font-weight:800">' + money(p.price) + '</span>' +
        '<span class="tagline tg-neutral">' + p.rating + ' ★</span></div>' +
        '<div style="font-size:11.5px;color:var(--ink-3);font-weight:700;margin:8px 0 14px">' + (p.stock > 10 ? 'In stock' : 'Low stock') + ' · ' + p.stock + ' units</div>' +
        '<button class="pill-btn primary" style="width:100%;justify-content:center" data-cart="' + p.name + '">' + icon('cart', 14) + 'Add to cart</button>' +
        '</article>').join('') + '</div>';
  }

  /* ---------------- Payments ---------------- */
  function payments() {
    const rows = PAYMENTS.map(p => {
      const tag = p.state === 'Paid' ? 'tg-open' : p.state === 'Pending' ? 'tg-soon' : 'tg-busy';
      return '<tr><td><b>' + p.id + '</b></td><td>' + p.who + '</td><td class="t2" style="font-weight:600">' + p.item + '</td>' +
        '<td>' + p.method + '</td><td>' + p.date + '</td><td style="font-weight:800">' + money(p.amount) + '</td>' +
        '<td><span class="tagline ' + tag + '">' + p.state + '</span></td></tr>';
    }).join('');
    return H('Payments', 'Memberships, court fees and pro-shop orders') +
      '<div class="grid g-4" style="margin-bottom:20px">' +
      [['Collected (Nov)', money(184300)], ['Outstanding', money(12450)], ['Refunds', money(2100)], ['Avg. ticket', money(940)]]
        .map((s, i) => '<section class="card stat"><span class="icon-slab" style="' + (i === 1 ? 'background:rgba(239,75,86,.14);color:#e0475a' : '') + '">' +
          icon(['wallet', 'clock', 'refresh', 'percent'][i], 22) + '</span>' +
          '<span class="label">' + s[0] + '</span><span class="value" style="font-size:30px">' + s[1] + '</span></section>').join('') + '</div>' +
      card('Invoices', PAYMENTS.length + ' recent', '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Invoice</th><th>Member</th><th>Item</th><th>Method</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div style="margin-top:18px;display:flex;gap:10px">' + btn('New invoice', 'invoice') + btn('Export CSV', 'export', 'ghost') + '</div>');
  }

  /* ---------------- Analytics ---------------- */
  function analytics() {
    return H('Analytics', 'Court usage, participation and revenue signals') +
      '<div class="grid g-4" style="margin-bottom:20px">' +
      [['Court hours', '1 074', '+12%'], ['Sessions', '2 486', '+8%'], ['Fill rate', '78%', '+5%'], ['No-shows', '3.2%', '-1.1%']]
        .map((s, i) => '<section class="card stat"><span class="label">' + s[0] + '</span>' +
          '<span class="value" style="font-size:32px">' + s[1] + '</span>' +
          '<span class="trend up" style="align-self:flex-start;margin-top:8px">' + icon('arrow-up-right', 13) + s[2] + '</span>' +
          '<div style="margin-top:10px">' + CH.spark([4, 6, 5, 8, 7, 9, 11 + i], ['#6b7cff', '#2fb37c', '#f4a036', '#e0607e'][i]) + '</div></section>').join('') + '</div>' +
      '<div class="grid g-2">' +
      card('Hours played per court', 'October 2026', CH.hbars(COURT_USE)) +
      card('Membership by level', 'Player ratings across the club',
        CH.donut({ data: LEVEL_SPLIT, caption: 'members' }) +
        '<div class="legend" style="justify-content:center;margin-top:14px">' + LEVEL_SPLIT.map(l =>
          '<span><i style="background:' + l.color + '"></i>' + l.name + '</span>').join('') + '</div>') +
      '</div>' +
      '<div style="margin-top:20px">' +
      card('Bookings vs weather', 'Rain suppresses outdoor decks after 3 PM',
        CH.area({ series: [{ key: 'Bookings', color: '#6b7cff', data: [62, 71, 68, 84, 92, 76, 58] },
                           { key: 'Rainfall', color: '#e0607e', data: [12, 8, 22, 55, 40, 18, 6] }],
                  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], h: 250 })) + '</div>';
  }

  /* ---------------- Reports ---------------- */
  function reports() {
    const items = [
      ['Monthly court utilisation', 'Nov 2026', 'PDF', 'bar-chart'],
      ['League financial statement', 'Oct 2026', 'XLSX', 'wallet'],
      ['Member growth report', 'Q4 2026', 'PDF', 'users'],
      ['Venue condition audit', 'Oct 2026', 'DOC', 'shield'],
      ['Pro-shop sell-through', 'Oct 2026', 'XLSX', 'cart'],
      ['Incident log', 'YTD', 'PDF', 'info']
    ];
    return H('Reports', 'Generated for the ' + CLUB.full + ' committee') +
      '<div class="grid g-3">' + items.map(r =>
        '<section class="card" style="display:flex;gap:16px;align-items:center">' +
        '<span class="stat"><span class="icon-slab">' + icon(r[3], 22) + '</span></span>' +
        '<div style="flex:1"><div style="font-weight:700;font-size:14.5px">' + r[0] + '</div>' +
        '<div class="t2">' + r[1] + ' · ' + r[2] + '</div></div>' +
        '<button class="mini-btn round" data-action="download" title="Download">' + icon('download', 15) + '</button>' +
        '</section>').join('') + '</div>';
  }

  /* ---------------- Notifications ---------------- */
  function notifications() {
    const kindIcon = { match: 'paddle', book: 'calendar', rank: 'trophy', pay: 'wallet', event: 'megaphone', weather: 'wind', shop: 'cart', club: 'users' };
    return H('Notifications', NOTIFS.filter(n => n.unread).length + ' unread') +
      card('Activity', 'Everything the club sent you',
        '<div class="stack">' + NOTIFS.map(n =>
          '<div class="row" style="padding:14px 6px">' +
          '<span class="slab' + (n.unread ? ' tint' : '') + '">' + icon(kindIcon[n.kind] || 'info', 18) + '</span>' +
          '<div class="grow"><div class="t1" style="white-space:normal">' + n.text + '</div>' +
          '<div class="t2">' + n.time + ' ago</div></div>' +
          (n.unread ? '<span class="tagline tg-busy">new</span>' : '') + '</div>').join('') + '</div>' +
        '<div style="margin-top:18px;display:flex;gap:10px">' + btn('Mark all read', 'read-all') + btn('Mute for 2h', 'mute', 'ghost') + '</div>');
  }

  /* ---------------- Notes ---------------- */
  function notes() {
    return H('Notes', 'Court ops, league and maintenance notes') +
      '<div class="grid g-3">' + NOTES.concat(NOTES).map(n =>
        '<article class="note" style="background:var(--card-solid)"><div class="grip"></div>' +
        '<span class="when">' + icon('clock', 12) + n.when + '</span>' +
        '<h4>' + n.title + '</h4>' +
        '<span class="tag"><i style="background:' + n.tone + '"></i>' + n.tag + '</span></article>').join('') + '</div>' +
      '<div style="margin-top:22px">' + btn('New note', 'new-note') + '</div>';
  }

  /* ---------------- Settings ---------------- */
  function settings() {
    const row = (label, hint, ctl) =>
      '<div class="row"><div class="grow"><div class="t1">' + label + '</div><div class="t2">' + hint + '</div></div>' + ctl + '</div>';
    const toggle = on => '<span style="width:52px;height:30px;border-radius:99px;padding:3px;display:inline-flex;justify-content:' +
      (on ? 'flex-end' : 'flex-start') + ';background:' + (on ? 'var(--court-b)' : 'rgba(127,127,160,.3)') + ';transition:.2s">' +
      '<i style="width:24px;height:24px;border-radius:50%;background:#fff;display:block;box-shadow:0 3px 6px rgba(0,0,0,.25)"></i></span>';
    return H('Settings', 'Club profile, preferences and integrations') +
      '<div class="grid g-2">' +
      card('Club profile', 'Shown on public listings',
        row('Club name', CLUB.full, '<button class="pill-btn ghost">' + icon('pen', 14) + 'Edit</button>') +
        row('Location', CLUB.city + ', ' + CLUB.province, '<button class="pill-btn ghost">' + icon('map-pin', 14) + 'Change</button>') +
        row('Address', CLUB.address, '<button class="pill-btn ghost">' + icon('pen', 14) + 'Edit</button>') +
        row('Contact', CLUB.phone + ' · ' + CLUB.email, '<button class="pill-btn ghost">' + icon('pen', 14) + 'Edit</button>')) +
      card('Preferences', 'How the dashboard behaves',
        row('Dark theme', 'Switch the whole shell', toggle(false)) +
        row('Clay layout by default', 'Open the warm dashboard first', toggle(true)) +
        row('Auto-confirm bookings', 'Skip the payment step for members', toggle(false)) +
        row('Rain alerts', 'Notify when outdoor decks may close', toggle(true)) +
        row('Reduced motion', 'Trim chart animations', toggle(false))) +
      card('Integrations', 'Where bookings arrive',
        INTEGRATIONS.map(t => row(t.name, t.badge ? t.badge + ' unread messages' : 'Connected',
          '<button class="pill-btn ghost">' + icon('settings', 14) + 'Manage</button>')).join('')) +
      card('Access & security', 'Roles, sessions and data',
        row('Roles', 'Admin · Coach · Member', '<span class="tagline tg-neutral">3 roles</span>') +
        row('Two-factor', 'Required for payments', toggle(true)) +
        row('Active sessions', 'Marawi · Iligal · CDO', '<span class="tagline tg-open">3 devices</span>') +
        row('Data export', 'Members and invoices', '<button class="pill-btn ghost">' + icon('download', 14) + 'Export</button>')) +
      '</div>';
  }

  /* ---------------- Profile ---------------- */
  function profile() {
    const me = MEMBERS[5];
    return H('My Profile', 'Player card · ' + CLUB.city) +
      '<div style="display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:20px" class="profwrap">' +
      '<section class="card" style="text-align:center">' +
      '<span class="avatar" style="width:104px;height:104px;font-size:32px;margin:0 auto 16px;display:grid;background:' + me.tone + '">' + me.ini + '</span>' +
      '<h3 style="margin:0;font-size:22px;font-weight:700">' + me.name + '</h3>' +
      '<p style="margin:6px 0 18px;font-size:12.5px;color:var(--ink-3);font-weight:600">' + me.venue + ' · ' + CLUB.city + '</p>' +
      '<div class="grid g-3" style="gap:10px">' +
      [['Rating', me.level.toFixed(1)], ['Points', nf.format(me.pts)], ['Streak', me.streak + 'd']]
        .map(s => '<div style="padding:12px 6px;border-radius:14px;background:rgba(127,127,160,.1)">' +
          '<div class="t2">' + s[0] + '</div><div style="font-size:16px;font-weight:800;margin-top:2px">' + s[1] + '</div></div>').join('') + '</div>' +
      '<div class="chips" style="justify-content:center;margin-top:18px">' + ['Doubles', 'Right-handed', 'One-handed backhand', '3.2 ladder'].map(c => '<span class="chip">' + c + '</span>').join('') + '</div>' +
      '<div style="margin-top:18px;display:flex;gap:10px">' + btn('Edit profile', 'edit') + btn('Share card', 'share', 'ghost') + '</div>' +
      '</section>' +
      '<div class="grid" style="gap:20px">' +
      card('Recent form', 'Last 7 results',
        '<div class="stack">' + MATCHES.slice(0, 4).map(m =>
          '<div class="row"><span class="slab">' + icon('paddle', 18) + '</span>' +
          '<div class="grow"><div class="t1">' + m.a + ' vs ' + m.b + '</div><div class="t2">' + m.court + ' · ' + m.time + '</div></div>' +
          '<span class="num" style="font-size:17px">' + m.score + '</span></div>').join('') + '</div>') +
      card('Weekly activity', 'Hours on court', CH.bars({ data: [1.5, 2, 1, 2.5, 3, 2, 0.5], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], hot: 4, h: 200 })) +
      card('Achievements', 'Badges earned', '<div class="grid g-4" style="gap:14px">' +
        [['First win', 'trophy'], ['10-streak', 'flame'], ['League finalist', 'medal'], ['Clean play', 'shield'],
         ['Clinic grad', 'book'], ['Night owl', 'moon'], ['Lake regular', 'droplet'], ['MVP', 'star']]
          .map(b => '<div style="text-align:center;padding:14px 8px;border-radius:16px;background:rgba(127,127,160,.09)">' +
            '<span style="color:var(--accent)">' + icon(b[1], 22) + '</span>' +
            '<div style="font-size:11px;font-weight:800;margin-top:8px">' + b[0] + '</div></div>').join('') + '</div>') +
      '</div></div>';
  }

  /* ---------------- Help ---------------- */
  function help() {
    const faq = [
      ['How do I book a court?', 'Open Book a Court, pick a slot on the grid, then confirm with GCash or at the desk.'],
      ['What is the kitchen rule?', 'You may not volley inside the 7-foot non-volley zone. Step on the line and it is a fault.'],
      ['How does the ladder work?', 'Every league match moves your points. Beat a higher seed and you swap positions.'],
      ['Are the river courts closed in rain?', 'Agus River and Lamai decks close above a 60% rain chance — the weather page shows live risk.'],
      ['Can I bring guests?', 'Members bring two guests per session. Guests pay ' + money(150) + ' at the desk.']
    ];
    return H('Help Centre', 'Rules, booking and club life in ' + CLUB.city) +
      '<div class="grid g-2">' +
      card('Frequently asked', 'Tap to expand',
        '<div class="stack">' + faq.map(f =>
          '<details style="border-bottom:1px solid var(--line);padding:14px 0">' +
          '<summary style="cursor:pointer;font-weight:700;font-size:14px;list-style:none;display:flex;justify-content:space-between;gap:12px">' +
          f[0] + '<span style="color:var(--ink-3)">' + icon('chevron-down', 16) + '</span></summary>' +
          '<p style="margin:12px 0 0;font-size:13px;line-height:1.65;color:var(--ink-2)">' + f[1] + '</p></details>').join('') + '</div>') +
      card('Contact the club', CLUB.tz,
        '<div class="stack">' +
        [['phone', CLUB.phone], ['mail', CLUB.email], ['map-pin', CLUB.address], ['globe', 'piklemarawi.ph']]
          .map(c => '<div class="row"><span class="slab tint">' + icon(c[0], 18) + '</span>' +
            '<div class="grow"><div class="t1">' + c[1] + '</div></div>' +
            '<button class="mini-btn round">' + icon('arrow-up-right', 14) + '</button></div>').join('') + '</div>' +
        '<div style="margin-top:18px">' + btn('Message the committee', 'contact') + '</div>') +
      '</div>';
  }

  return {
    courts, booking, matches, leagues, schedule, members, rankings, training,
    library, drills, messages, events, map, venues: venuesPage, weather, proshop,
    payments, analytics, reports, notifications, settings, profile, help, notes
  };
})();
