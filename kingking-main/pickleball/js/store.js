/* ============================================================
   Store — the single source of truth.

   Every module (dashboard, tables, calendar, charts, receipts)
   reads through Store.sel.* and writes through Store.ops.* or the
   generic Store.list/get/add/put/del. Nothing renders a number it
   has not asked the store for.

   Swapping in a real backend later means replacing `persist()`,
   `rehydrate()` and the body of the CRUD helpers — the API the
   pages use does not change.
   ============================================================ */

const Store = (function () {
  const KEY = 'piklemarawi-db';
  const SCHEMA = 8;
  /* the venues page owns venue rows, so keep the shipped catalog aside —
     VENUES itself is re-pointed at the store on every load */
  const VENUES_SEED = VENUES.map(v => Object.assign({}, v));

  /* ---------------- date + time helpers ---------------- */
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dstr(new Date());
  const parse = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2] || 1); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return dstr(d); };
  const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const mins = t => { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); };
  const hm = m => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  const nowISO = () => new Date().toISOString();
  const monthOf = s => String(s).slice(0, 7);
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = s => MONTH_NAMES[+String(s).slice(5, 7) - 1] + ' ' + String(s).slice(0, 4);
  const clockMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

  /* deterministic pseudo-random so the seeded week looks hand-made */
  let seed = 20261103;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  /* ---------------- collections ---------------- */
  const SPEC = {
    players:       { prefix: 'P',  num: 4600 },
    courts:        { prefix: 'C',  num: 2400 },
    bookings:      { prefix: 'B',  num: 7100 },
    matches:       { prefix: 'M',  num: 5300 },
    tournaments:   { prefix: 'T',  num: 900  },
    payments:      { prefix: 'INV', num: 2041 },
    notifications: { prefix: 'N',  num: 800  },
    activity:      { prefix: 'A',  num: 1200 },
    leagues:       { prefix: 'L',  num: 300  },
    venues:        { prefix: 'V',  num: 100  },
    events:        { prefix: 'E',  num: 6100 }
  };

  let db = null;

  function nextId(kind) {
    const s = SPEC[kind];
    db.counters[kind] = (db.counters[kind] || s.num) + 1;
    return s.prefix + '-' + db.counters[kind];
  }

  /* ---------------- settings ---------------- */
  const defaultSettings = () => ({
    club: {
      name: CLUB.name, full: CLUB.full, city: CLUB.city, province: CLUB.province,
      phone: CLUB.phone, email: CLUB.email, address: CLUB.address, founded: CLUB.founded
    },
    booking: {
      open: '05:00', close: '22:00', slotMinutes: 60, maxHours: 3, minHours: 1,
      cancelHours: 4, guestLimit: 2, holdMinutes: 15, taxPct: 12
    },
    memberships: [
      { id: 'starter', name: 'Starter',    price: 0,    term: 'Monthly', discount: 0,  benefits: ['Open play access', 'Community Saturday sessions'] },
      { id: 'silver',  name: 'Silver',     price: 1200, term: 'Monthly', discount: 5,  benefits: ['2 court hours free', 'League entry waived', 'Pro shop 5% off'] },
      { id: 'gold',    name: 'Gold',       price: 4500, term: 'Quarterly', discount: 12, benefits: ['8 court hours free', 'Priority booking window', 'Clinic seats reserved', 'Pro shop 12% off'] },
      { id: 'elite',   name: 'Elite',      price: 9800, term: 'Yearly', discount: 20, benefits: ['Unlimited league play', 'Guest passes (4)', 'Coached review monthly', 'Pro shop 20% off'] },
      { id: 'student', name: 'Student',    price: 600,  term: 'Monthly', discount: 10, benefits: ['MSU ID required', 'Off-peak courts only'] }
    ],
    user: {
      name: 'Ana Dimalantan', role: 'Club Administrator', email: 'admin@piklemarawi.ph',
      phone: '+63 64 555 0188', notifyBooking: true, notifyPayment: true,
      notifyMatch: true, notifyMarketing: false, theme: 'light'
    }
  });

  /* ---------------- seeds ---------------- */
  const PLAYER_SEED = [
    ['Amina Mangunsong', 'F', 3.8, 'gold',    'Ranao Lake',  'Doubles', 9596, 14, 'active'],
    ['Josef Alonto',     'M', 3.6, 'gold',    'MSU Center',  'Singles', 8770, 9,  'active'],
    ['Soraya Macarambon','F', 3.5, 'silver',  'Lamai',       'Mixed',   7786, 6,  'active'],
    ['Emil Cadar',       'M', 3.4, 'silver',  'Balindog',    'Doubles', 6472, 11, 'active'],
    ['Fatima Pangandaman','F',3.3, 'silver',  'Madayaan',    'Singles', 5890, 4,  'active'],
    ['Abdul Dimalantan', 'M', 3.2, 'gold',    'Ranao Lake',  'Doubles', 5310, 7,  'active'],
    ['Marites Usman',    'F', 3.1, 'bronze',  'Pantar',      'Mixed',   4865, 2,  'active'],
    ['Sharif Bagalsan',  'M', 3.0, 'bronze',  'MSU Center',  'Singles', 4420, 5,  'active'],
    ['Norma Marohom',    'F', 2.8, 'bronze',  'Lamai',       'Doubles', 3980, 3,  'active'],
    ['Yasmien Ampuan',   'F', 2.7, 'starter', 'Balindog',    'Mixed',   3610, 8,  'active'],
    ['Rico Laudin',      'M', 3.5, 'silver',  'Ranao Lake',  'Doubles', 7240, 6,  'active'],
    ['Danial Sangara',   'M', 2.9, 'starter', 'Mapandi',     'Singles', 3320, 1,  'active'],
    ['Halima Ampatuan',  'F', 3.4, 'gold',    'Madayaan',    'Mixed',   6150, 9,  'active'],
    ['Toto Abdullah',    'M', 2.6, 'student', 'MSU Center',  'Doubles', 2740, 2,  'active'],
    ['Kim Alcera',       'F', 2.5, 'starter', 'Buntong',     'Mixed',   2450, 4,  'active'],
    ['Ana Said',         'F', 3.2, 'silver',  'Ranao Lake',  'Doubles', 5080, 5,  'active'],
    ['Murad Macasing',   'M', 3.7, 'elite',   'Balindog',    'Singles', 8120, 12, 'active'],
    ['Zaira Papandre',   'F', 2.4, 'starter', 'Lamai',       'Doubles', 2110, 1,  'active'],
    ['Ghazali Dada',     'M', 3.1, 'silver',  'Agus River',  'Mixed',   4690, 3,  'active'],
    ['Nova Ibrahim',     'F', 2.8, 'bronze',  'Mapandi',     'Singles', 3870, 6,  'active'],
    ['Bilal Sangkapala', 'M', 2.2, 'starter', 'Buntong',     'Doubles', 1620, 1,  'suspended'],
    ['Layla Cambal',     'F', 3.3, 'gold',    'MSU Center',  'Mixed',   5940, 7,  'active'],
    ['Iqbalontong Maca', 'M', 2.9, 'bronze',  'Madayaan',    'Singles', 3410, 2,  'active'],
    ['Sitti Alawi',      'F', 3.6, 'elite',   'Ranao Lake',  'Doubles', 8450, 10, 'active'],
    ['Rashid Burnay',    'M', 2.7, 'student', 'Balindog',    'Mixed',   3050, 4,  'active'],
    ['Mimi Pacaloman',   'F', 2.3, 'starter', 'Lamai',       'Doubles', 1880, 1,  'active'],
    ['Taha Sarip',       'M', 3.0, 'silver',  'Agus River',  'Singles', 4310, 5,  'suspended'],
    ['Ummi Kadim',       'F', 3.9, 'elite',   'Ranao Lake',  'Mixed',   9980, 15, 'active']
  ];

  const slugDomain = n => n.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).join('.') + '@piklemarawi.ph';
  const phone = () => '+63 64 ' + between(550, 559) + ' ' + between(1000, 9999);
  const dob = () => (1988 + between(0, 22)) + '-' + pad(between(1, 12)) + '-' + pad(between(1, 28));
  const BARANGAYS = ['Patani', 'Bacong', 'Pangarungan Village', 'Matampay', 'Rorogagus', 'Bito Buadi Itowa', 'Mipaga Proper', 'Barrio Green', 'Pantar', 'Mapandi'];

  function seedPlayers() {
    const joined = [];
    for (let i = 0; i < 90; i++) joined.push(addDays(today(), -i * 4 - between(0, 3)));
    return PLAYER_SEED.map((p, i) => ({
      id: 'P-' + (4601 + i),
      name: p[0],
      ini: initials(p[0]),
      gender: p[1],
      level: p[2],
      membership: p[3],
      venue: p[4],
      play: p[5],
      rating: p[6],
      streak: p[7],
      status: p[8],
      email: slugDomain(p[0]),
      phone: phone(),
      dob: dob(),
      address: 'Brgy. ' + pick(BARANGAYS) + ', Marawi City',
      emergency: { name: pick(['Spouse', 'Parent', 'Sibling']) + ' ' + p[0].split(' ')[1], phone: phone() },
      joined: joined[i % joined.length],
      photo: null
    }));
  }

  function seedCourts() {
    const out = [];
    let n = 2401;
    VENUES.forEach(v => {
      for (let c = 1; c <= v.courts; c++) {
        const surface = v.id === 'v2' || v.id === 'v7' ? 'Indoor acrylic' : (v.indoor ? 'Indoor acrylic' : 'Outdoor concrete');
        out.push({
          id: 'C-' + (n++),
          number: c,
          name: v.name.split(' ')[0] + ' C' + c,
          venueId: v.id,
          location: 'Brgy. ' + v.barangay + ', Marawi City',
          type: surface,
          floodlit: c <= 2,
          status: v.id === 'v4' ? 'maintenance' : (v.status === 'busy' && c === 1 ? 'occupied' : 'available'),
          pricePerHour: v.price,
          note: ''
        });
      }
    });
    return out;
  }

  const METHODS = ['GCash', 'Cash', 'Card', 'Bank', 'Maya'];

  function seedBookings(courts, players) {
    const out = [];
    let n = 7101;
    const times = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    /* 16 days of history + 8 days ahead, ~4 per day */
    for (let d = -16; d <= 8; d++) {
      const date = addDays(today(), d);
      const count = d < 0 ? between(3, 5) : (d === 0 ? 5 : between(2, 4));
      const used = {};
      for (let i = 0; i < count; i++) {
        let court = pick(courts);
        let t = pick(times);
        let tries = 0;
        while (used[court.id + t] && tries < 14) { court = pick(courts); t = pick(times); tries++; }
        if (used[court.id + t]) continue;
        used[court.id + t] = 1;
        const dur = pick([1, 1, 2, 2, 3]);
        const player = pick(players.filter(p => p.status === 'active'));
        const price = court.pricePerHour * dur;
        let state = 'confirmed';
        if (d < 0) state = rnd() < .12 ? 'cancelled' : (rnd() < .1 ? 'pending' : 'completed');
        else if (d === 0) state = rnd() < .08 ? 'pending' : 'confirmed';
        else state = rnd() < .1 ? 'pending' : 'confirmed';
        out.push({
          id: 'B-' + (n++),
          playerId: player.id,
          courtId: court.id,
          date: date,
          start: t,
          duration: dur,
          end: hm(mins(t) + dur * 60),
          format: pick(['Doubles', 'Singles', 'Open play']),
          players: pick([2, 4, 4, 4]),
          status: state,
          method: state === 'cancelled' ? '—' : pick(METHODS),
          subtotal: price,
          amount: state === 'cancelled' ? 0 : price,
          note: '',
          createdAt: date + 'T08:00:00'
        });
      }
    }
    return out;
  }

  function seedMatches(courts, players) {
    const roundNames = ['Ranao League · MD', 'Ranao League · WD', 'Agus Singles · R16', 'Ladder Div. 2', 'MSU Collegiate · QF', 'Beginner Mixer'];
    const out = [];
    let n = 5301;
    const name = id => (players.find(p => p.id === id) || {}).name || id;
    for (let d = -9; d <= 6; d++) {
      const count = d > 0 ? between(1, 2) : between(2, 3);
      for (let i = 0; i < count; i++) {
        const a1 = pick(players), a2 = pick(players), b1 = pick(players), b2 = pick(players);
        const court = pick(courts);
        const done = d < 0;
        const live = d === 0 && i === 0;
        const sa = done || live ? between(6, 11) : null;
        const sb = done || live ? between(4, 11) : null;
        out.push({
          id: 'M-' + (n++),
          code: 'M' + (n - 5301),
          round: pick(roundNames),
          type: pick(["Men's Doubles", "Women's Doubles", 'Mixed Doubles', 'Singles']),
          teamA: shortName(a1.name) + ' / ' + a2.name.split(' ')[0],
          teamB: shortName(b1.name) + ' / ' + b2.name.split(' ')[0],
          teamAIds: [a1.id, a2.id],
          teamBIds: [b1.id, b2.id],
          courtId: court.id,
          date: addDays(today(), d),
          time: pick(['07:00', '09:00', '15:00', '16:30', '18:00']),
          gameTo: 11,
          scoreA: sa, scoreB: sb,
          winner: sa === null || sa === sb ? null : (sa > sb ? 'A' : 'B'),
          status: done ? 'completed' : (live ? 'live' : 'upcoming'),
          tournamentId: null,
          bracket: null
        });
      }
    }
    return out;
  }

  function seedPayments(bookings, players) {
    const out = [];
    let n = 2042;
    const stateOf = b => b.status === 'cancelled' ? 'refunded' : (b.status === 'pending' ? 'pending' : 'paid');
    bookings.forEach(b => {
      if (b.status === 'cancelled') return;
      const p = players.find(x => x.id === b.playerId);
      out.push({
        id: 'INV-' + (n++),
        playerId: b.playerId,
        who: p ? p.name : 'Member',
        kind: 'Court booking',
        refId: b.id,
        item: 'Court · ' + b.date + ' ' + b.start,
        amount: b.amount,
        method: b.method,
        status: stateOf(b),
        date: b.date,
        ref: 'TRX' + Math.floor(100000 + rnd() * 899999)
      });
    });
    /* membership + tournament + pro shop invoices round out the ledger */
    players.slice(0, 18).forEach(p => {
      const tier = memberships().find(m => m.id === p.membership) || { price: 0 };
      if (!tier.price) return;
      out.push({
        id: 'INV-' + (n++), playerId: p.id, who: p.name, kind: 'Membership', refId: p.id,
        item: tier.name + ' membership · ' + tier.term, amount: tier.price,
        method: pick(METHODS), status: rnd() < .82 ? 'paid' : 'pending',
        date: addDays(today(), -between(1, 40)), ref: 'MBR' + Math.floor(100000 + rnd() * 899999)
      });
    });
    ['Marawi Open', 'Kids Clinic', 'League Finals'].forEach((label, i) => {
      const p = players[i * 3];
      out.push({
        id: 'INV-' + (n++), playerId: p.id, who: p.name, kind: 'Pro shop', refId: '',
        item: label + ' gear order', amount: pick([890, 1450, 2750, 3180, 6450]),
        method: pick(METHODS), status: 'paid', date: addDays(today(), -between(2, 30)),
        ref: 'SHOP' + Math.floor(10000 + rnd() * 89999)
      });
    });
    return out.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  }

  const memberships = () => (db && db.settings.memberships) || defaultSettings().memberships;

  function seedTournaments(players) {
    const t = {
      id: 'T-901', name: 'Marawi Open 2026', event: "Mixed Doubles", format: 'Single Elimination',
      venueId: 'v1', start: addDays(today(), 5), end: addDays(today(), 7),
      entryFee: 800, maxTeams: 16, prizePool: 45000, status: 'registration',
      teams: [], bracket: null, createdAt: nowISO()
    };
    const pool = players.filter(p => p.status === 'active');
    for (let i = 0; i < 9; i++) {
      const a = pool[i * 2 % pool.length], b = pool[(i * 2 + 1) % pool.length];
      t.teams.push({ id: 'TM-' + (9100 + i), name: shortName(a.name) + ' / ' + shortName(b.name), playerIds: [a.id, b.id] });
    }
    const open = {
      id: 'T-902', name: 'Lanao Lake Doubles Cup', event: "Men's Doubles", format: 'Single Elimination',
      venueId: 'v3', start: addDays(today(), 18), end: addDays(today(), 19),
      entryFee: 600, maxTeams: 32, prizePool: 28000, status: 'upcoming', teams: [], bracket: null, createdAt: nowISO()
    };
    const live = {
      id: 'T-903', name: 'MSU Collegiate Sprint', event: 'Singles', format: 'Single Elimination',
      venueId: 'v2', start: addDays(today(), -3), end: addDays(today(), 1),
      entryFee: 300, maxTeams: 8, prizePool: 12000, status: 'ongoing', teams: [], bracket: null, createdAt: nowISO()
    };
    for (let i = 0; i < 8; i++) {
      const a = pool[(i + 4) % pool.length];
      live.teams.push({ id: 'TM-' + (9300 + i), name: shortName(a.name), playerIds: [a.id] });
    }
    const done = {
      id: 'T-904', name: 'Buntong Winter Ladder', event: 'Mixed Doubles', format: 'Round Robin',
      venueId: 'v8', start: addDays(today(), -40), end: addDays(today(), -20),
      entryFee: 500, maxTeams: 12, prizePool: 15000, status: 'completed', teams: [], bracket: null, createdAt: nowISO()
    };
    for (let i = 0; i < 6; i++) {
      const a = pool[(i + 10) % pool.length], b = pool[(i + 11) % pool.length];
      done.teams.push({ id: 'TM-' + (9500 + i), name: shortName(a.name) + ' / ' + shortName(b.name), playerIds: [a.id, b.id] });
    }
    return [t, live, open, done];
  }

  function shortName(n) { return n.split(' ')[0] + ' ' + (n.split(' ')[1] || '').slice(0, 1) + '.'; }

  function seedNotifications() {
    const mk = (kind, text, minsAgo, read) => ({ id: '', kind, text, at: new Date(Date.now() - minsAgo * 60000).toISOString(), read });
    return [
      mk('booking', 'New booking held for the Ranao Lake flagship courts.', 4, false),
      mk('payment', 'GCash payment cleared for a Gold membership renewal.', 22, false),
      mk('match', 'A scored match updated the Marawi ladder standings.', 55, false),
      mk('court', 'Agus River C1 is under maintenance until the resurface is done.', 130, false),
      mk('tournament', 'Marawi Open 2026 registration closes in 3 days.', 260, false),
      mk('member', '5 new members joined from Buntong this week.', 400, false),
      mk('weather', 'Rain expected 15:00 over Lanao — river courts may close.', 610, true),
      mk('shop', 'Restock: Ranao Lake Pickleballs (96 units).', 900, true)
    ].map((n, i) => ({ ...n, id: 'N-' + (801 + i) }));
  }

  function seedActivity() {
    const mk = (kind, text, minsAgo) => ({ id: 'A-' + text.length + minsAgo, kind, text, at: new Date(Date.now() - minsAgo * 60000).toISOString() });
    return [
      mk('booking', 'Court booking confirmed at Ranao Lake', 6),
      mk('payment', 'Payment received · GCash', 24),
      mk('member', 'New member registered', 70),
      mk('match', 'Match result recorded', 180),
      mk('court', 'Court status changed to maintenance', 320)
    ];
  }

  function seedLeagues() {
    return LEAGUES.map((l, i) => ({
      id: 'L-' + (301 + i), name: l.name, div: l.div, teams: l.teams, played: l.played,
      ends: l.ends, pot: l.pot, tone: l.tone, status: l.ends < today() ? 'completed' : 'active'
    }));
  }

  function seedEvents() {
    return EVENTS.map((e, i) => ({
      id: 'E-' + (6101 + i), title: e.title, date: e.date, venue: e.venue, kind: e.kind,
      tone: e.tone, spots: e.spots, booked: between(2, Math.max(2, e.spots - 1))
    }));
  }

  /* ---------------- build the fresh database ---------------- */
  function fresh() {
    seed = 20261103;
    const players = seedPlayers();
    const courts = seedCourts();
    const bookings = seedBookings(courts, players);
    const matches = seedMatches(courts, players);
    const payments = seedPayments(bookings, players);
    const tournaments = seedTournaments(players);
    const built = {
      schema: SCHEMA,
      builtAt: nowISO(),
      players: players, courts: courts, bookings: bookings, matches: matches, tournaments: tournaments,
      payments: payments,
      notifications: seedNotifications(),
      activity: seedActivity(),
      leagues: seedLeagues(),
      venues: VENUES_SEED.map(v => Object.assign({}, v)),
      events: seedEvents(),
      settings: defaultSettings(),
      counters: {}
    };
    /* the id counter always sits above the highest id actually used */
    Object.keys(SPEC).forEach(k => {
      const top = built[k].reduce((m, x) => Math.max(m, Number(String(x.id).split('-')[1]) || 0), SPEC[k].num);
      built.counters[k] = top;
    });
    return built;
  }

  /* ---------------- persistence ---------------- */
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { /* storage full or blocked — the session still works in memory */ }
  }

  /* The club has history: the in-flight sprint already played its quarter-finals
     and the winter ladder is a finished round robin with a champion. Written
     directly (no ops.enterScore) so seeding does not flood the notification feed. */
  function settle(m, a, b) {
    m.scoreA = a; m.scoreB = b; m.winner = a > b ? 'A' : 'B'; m.status = 'completed';
  }

  function postSeed() {
    const sprint = db.tournaments.find(t => t.id === 'T-903');
    if (sprint && !sprint.bracket && sprint.teams.length >= 2) {
      buildBracket(sprint);
      createBracketMatches(sprint);
      sprint.bracket.rounds[0].slots.forEach((slot, i) => {
        const m = slot.matchId ? get('matches', slot.matchId) : null;
        if (!m || !slot.teamA || !slot.teamB || slot.winner) return;
        settle(m, 11, 5 + (i % 5));
        slot.winner = m.winner;
        slot.score = m.scoreA + '–' + m.scoreB;
        propagate(sprint, slot);
      });
      createBracketMatches(sprint);
      sprint.status = 'ongoing';
    }
    const ladder = db.tournaments.find(t => t.id === 'T-904');
    if (ladder && !ladder.standings && ladder.teams.length >= 2) {
      ops.drawBracket(ladder.id);
      matchesOf(ladder).forEach((m, i) => {
        if (m.status === 'completed') return;
        settle(m, 11, i % 3 === 0 ? 4 : 9);
        syncStandings(ladder, m);
      });
      const top = sel.standings(ladder.id)[0];
      ladder.status = 'completed';
      if (top) ladder.champion = top.name;
    }
  }

  function matchesOf(t) {
    return db.matches.filter(m => m.tournamentId === t.id);
  }

  function rehydrate() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.schema === SCHEMA && Array.isArray(saved.players) && saved.counters) {
      db = saved;
      /* anything the admin did while we were away keeps its shape */
      db.settings = Object.assign(defaultSettings(), db.settings || {});
      Object.keys(SPEC).forEach(k => { if (db[k] === undefined) db[k] = []; });
      if (!db.venues.length) db.venues = VENUES_SEED.map(v => Object.assign({}, v));
    } else {
      db = fresh();
      postSeed();
      persist();
    }
    syncVenues();
  }

  /* VENUES is the array every map/tour/court screen reads — keep it pointed
     at the store so a new venue appears across the whole system at once */
  function syncVenues() {
    const rows = db && db.venues;
    if (!rows || !rows.length) return;
    VENUES.length = 0;
    rows.forEach(v => VENUES.push(v));
  }

  /* ---------------- pub/sub ---------------- */
  const listeners = [];
  let quiet = false;

  function emit(reason) {
    if (quiet) return;
    persist();
    listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error('store listener', e); } });
  }
  const subscribe = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; };
  const batch = fn => { quiet = true; try { fn(); } finally { quiet = false; emit('batch'); } };

  /* ---------------- generic CRUD ---------------- */
  const list = kind => db[kind] || [];
  const get = (kind, id) => list(kind).find(x => x.id === id) || null;

  function add(kind, obj) {
    const o = Object.assign({}, obj);
    if (!o.id) o.id = nextId(kind);
    db[kind].unshift(o);
    return o;
  }
  function put(kind, id, patch) {
    const o = get(kind, id);
    if (!o) return null;
    Object.assign(o, patch);
    return o;
  }
  function del(kind, id) {
    const arr = db[kind]; if (!arr) return false;
    const i = arr.findIndex(x => x.id === id);
    if (i < 0) return false;
    arr.splice(i, 1);
    return true;
  }

  /* ---------------- logging ---------------- */
  const KIND_ICON = { booking: 'calendar', payment: 'wallet', member: 'users', court: 'court',
    venue: 'map-pin', match: 'paddle', tournament: 'trophy', shop: 'cart', club: 'globe', system: 'settings' };

  function log(kind, text) {
    add('activity', { kind, text, at: nowISO() });
    if (db.activity.length > 80) db.activity.length = 80;
  }
  function notify(kind, text) {
    add('notifications', { kind, text, at: nowISO(), read: false });
  }

  /* ---------------- validation ---------------- */
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
  const isPhone = s => /^[+0-9][0-9\s().-]{7,18}$/.test(String(s || '').trim());
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(parse(s) - 0);
  const isTime = s => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s || ''));

  /* ============================================================
     OPERATIONS
     ============================================================ */
  const ops = {};

  /* ---- venues ---- */
  ops.saveVenue = function (v) {
    const e = {};
    const name = String(v.name || '').trim();
    if (name.length < 3) e.name = 'Enter the venue name (at least 3 characters).';
    if (!String(v.barangay || '').trim()) e.barangay = 'Pick the barangay the courts sit in.';
    if (v.open && !isTime(v.open)) e.open = 'Opening time must be a 24-hour time, e.g. 06:00.';
    if (v.close && !isTime(v.close)) e.close = 'Closing time must be a 24-hour time, e.g. 20:00.';
    if (v.open && v.close && isTime(v.open) && isTime(v.close) && mins(v.open) >= mins(v.close)) {
      e.close = 'Closing time has to be after opening time.';
    }
    if (+v.courts < 0) e.courts = 'Court count cannot be negative.';
    if (+v.price < 0) e.price = 'Hourly rate cannot be negative.';
    if (+v.lat < -90 || +v.lat > 90 || String(v.lat).trim() === '') e.lat = 'Latitude must be between −90 and 90.';
    if (+v.lng < -180 || +v.lng > 180 || String(v.lng).trim() === '') e.lng = 'Longitude must be between −180 and 180.';
    const dupe = list('venues').find(x => x.id !== v.id &&
      String(x.name).toLowerCase() === name.toLowerCase());
    if (name && dupe) e.name = name + ' is already a venue.';
    if (Object.keys(e).length) return { ok: false, errors: e };

    const row = {
      name: name,
      barangay: String(v.barangay).trim(),
      courts: Math.max(0, Math.round(+v.courts || 0)),
      indoor: !!v.indoor,
      open: v.open || '06:00',
      close: v.close || '20:00',
      rating: Math.min(5, Math.max(0, +v.rating || 0)),
      lat: +v.lat, lng: +v.lng,
      status: v.status || 'open',
      price: Math.max(0, Math.round(+v.price || 0)),
      note: String(v.note || '')
    };
    let saved;
    if (v.id && get('venues', v.id)) {
      saved = put('venues', v.id, row);
      log('venue', saved.name + ' updated');
    } else {
      saved = add('venues', row);
      log('venue', saved.name + ' · Brgy. ' + saved.barangay + ' added with ' + saved.courts + ' court(s)');
      notify('venue', saved.name + ' is now bookable in ' + saved.barangay + ' (' + saved.courts + ' courts).');
    }
    /* the SVG city map places venues by hand-drawn coordinates */
    saved.x = Math.min(790, Math.max(50, Math.round((saved.lng - 124.2344) / 0.1052 * 800 + 50)));
    saved.y = Math.min(510, Math.max(40, Math.round(510 - (saved.lat - 7.9678) / 0.0926 * 480 - 40)));
    const made = ensureVenueCourts(saved);
    if (made.length) {
      log('court', made.map(c => c.name).join(', ') + ' opened at ' + saved.name);
      notify('court', made.length + ' new deck(s) bookable at ' + saved.name + '.');
    }
    const declared = saved.courts;
    syncDeckCount(saved.id);
    syncVenues();
    emit('venue:save');
    return { ok: true, venue: saved, made: made.length, kept: Math.max(0, saved.courts - declared) };
  };

  /* a deck count only means something once the booking engine can see the
     courts, so a new venue materialises the matching court rows (never the
     other way round — removing decks must not silently retire courts) */
  function syncDeckCount(venueId) {
    const v = get('venues', venueId);
    if (!v) return;
    const n = list('courts').filter(c => c.venueId === venueId).length;
    if (v.courts !== n) put('venues', venueId, { courts: n });
  }

  function ensureVenueCourts(v) {
    const have = list('courts').filter(c => c.venueId === v.id);
    const surface = v.indoor ? 'Indoor acrylic' : 'Outdoor concrete';
    let top = have.reduce((m, c) => Math.max(m, Number(c.number) || 0), 0);
    const made = [];
    for (let i = have.length; i < v.courts; i++) {
      const c = add('courts', {
        number: ++top,
        name: v.name.split(' ')[0] + ' C' + top,
        venueId: v.id,
        location: 'Brgy. ' + v.barangay + ', ' + CLUB.city + ', ' + CLUB.province,
        type: surface,
        floodlit: top <= 2,
        status: v.status === 'soon' ? 'maintenance' : 'available',
        pricePerHour: v.price,
        note: ''
      });
      made.push(c);
    }
    return made;
  }

  ops.deleteVenue = function (id) {
    const v = get('venues', id);
    if (!v) return { ok: false, errors: { id: 'Venue not found.' } };
    const open = list('bookings').filter(b => b.status !== 'cancelled' &&
      list('courts').some(c => c.id === b.courtId && c.venueId === id));
    if (open.length) {
      return { ok: false, errors: { id: v.name + ' still has ' + open.length + ' live booking(s). Cancel or reschedule them first.' } };
    }
    /* decks with a booking history are keepers — retiring the venue must not
       orphan the payments and reports that reference them */
    const decks = list('courts').filter(c => c.venueId === id);
    const dirty = decks.filter(c => list('bookings').some(b => b.courtId === c.id));
    if (dirty.length) {
      return { ok: false, errors: { id: v.name + ' still has ' + dirty.length +
        ' deck(s) with booking history. Retire them on the Courts page first.' } };
    }
    decks.forEach(c => del('courts', c.id));
    del('venues', id);
    log('venue', v.name + ' removed from the city map' + (decks.length ? ' with ' + decks.length + ' deck(s)' : ''));
    syncVenues();
    emit('venue:delete');
    return { ok: true, courts: decks.length };
  };

  /* ---- players ---- */
  function validatePlayer(v, id) {
    const e = {};
    if (!v.name || String(v.name).trim().length < 3) e.name = 'Enter the full name (at least 3 characters).';
    if (!isEmail(v.email)) e.email = 'Enter a valid email address.';
    if (!isPhone(v.phone)) e.phone = 'Enter a valid phone number.';
    if (!isDate(v.dob)) e.dob = 'Date of birth must be a valid date.';
    else if (parse(v.dob) > new Date()) e.dob = 'Date of birth cannot be in the future.';
    if (!String(v.address || '').trim()) e.address = 'Address is required.';
    if (!v.membership) e.membership = 'Choose a membership type.';
    const lvl = Number(v.level);
    if (isNaN(lvl) || lvl < 1 || lvl > 8) e.level = 'Skill level must be between 1.0 and 8.0.';
    if (!String(v.emergencyName || '').trim()) e.emergencyName = 'Emergency contact name is required.';
    if (!isPhone(v.emergencyPhone)) e.emergencyPhone = 'Emergency contact phone is invalid.';
    const dup = list('players').find(p => p.id !== id && p.email && p.email.toLowerCase() === String(v.email).toLowerCase());
    if (dup) e.email = 'Another player already uses this email.';
    return e;
  }

  ops.createPlayer = function (v) {
    const e = validatePlayer(v);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const p = add('players', {
      name: v.name.trim(), ini: initials(v.name.trim()), gender: v.gender || 'Other',
      level: Number(v.level), membership: v.membership, venue: v.venue || VENUES[0].name,
      play: v.play || 'Doubles', rating: Number(v.rating || 0), streak: 0, status: 'active',
      email: v.email.trim(), phone: v.phone.trim(), dob: v.dob, address: v.address.trim(),
      emergency: { name: v.emergencyName.trim(), phone: v.emergencyPhone.trim() },
      joined: today(), photo: v.photo || null
    });
    log('member', v.name.trim() + ' registered as a new ' + tierName(p.membership) + ' member');
    notify('member', 'New player added: ' + p.name);
    emit('player:create');
    return { ok: true, id: p.id, player: p };
  };

  ops.updatePlayer = function (id, v) {
    const e = validatePlayer(v, id);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const before = get('players', id);
    if (!before) return { ok: false, errors: { id: 'Player not found.' } };
    put('players', id, {
      name: v.name.trim(), ini: initials(v.name.trim()), gender: v.gender, level: Number(v.level),
      membership: v.membership, venue: v.venue, play: v.play, email: v.email.trim(), phone: v.phone.trim(),
      dob: v.dob, address: v.address.trim(), emergency: { name: v.emergencyName.trim(), phone: v.emergencyPhone.trim() }
    });
    log('member', before.name + '’s profile was updated');
    emit('player:update');
    return { ok: true, id: id };
  };

  ops.deletePlayer = function (id) {
    const p = get('players', id); if (!p) return { ok: false, errors: { id: 'Player not found.' } };
    const live = list('bookings').filter(b => b.playerId === id && ['confirmed', 'pending'].includes(b.status));
    if (live.length) return { ok: false, errors: { id: p.name + ' has ' + live.length + ' upcoming booking(s). Cancel them first.' } };
    del('players', id);
    log('member', p.name + ' was removed from the roster');
    emit('player:delete');
    return { ok: true };
  };

  ops.setPlayerStatus = function (id, status) {
    const p = put('players', id, { status });
    if (!p) return { ok: false };
    log('member', p.name + ' was ' + (status === 'active' ? 're-activated' : 'suspended'));
    notify('member', p.name + ' is now ' + status);
    emit('player:status');
    return { ok: true };
  };

  const tierName = id => (memberships().find(m => m.id === id) || {}).name || 'Starter';

  /* ---- courts ---- */
  function validateCourt(v, id) {
    const e = {};
    if (!String(v.name || '').trim()) e.name = 'Court name is required.';
    const num = Number(v.number);
    if (!num || num < 1) e.number = 'Court number must be 1 or higher.';
    if (!v.venueId) e.venueId = 'Pick a venue.';
    if (!String(v.type || '').trim()) e.type = 'Court type is required.';
    const price = Number(v.pricePerHour);
    if (isNaN(price) || price <= 0) e.pricePerHour = 'Price per hour must be a positive amount.';
    if (!['available', 'occupied', 'maintenance', 'reserved'].includes(v.status)) e.status = 'Pick a valid status.';
    const clash = list('courts').find(c => c.id !== id && c.venueId === v.venueId && Number(c.number) === num);
    if (clash) e.number = 'That court number already exists at this venue.';
    return e;
  }

  ops.createCourt = function (v) {
    const e = validateCourt(v);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const c = add('courts', {
      number: Number(v.number), name: v.name.trim(), venueId: v.venueId,
      location: v.location || ('Brgy. ' + (VENUES.find(x => x.id === v.venueId) || {}).barangay + ', Marawi City'),
      type: v.type, floodlit: !!v.floodlit, status: v.status, pricePerHour: Number(v.pricePerHour), note: v.note || ''
    });
    const vn = (VENUES.find(x => x.id === c.venueId) || {}).name || '';
    syncDeckCount(c.venueId);
    log('court', c.name + ' added at ' + vn);
    notify('court', 'New court live: ' + c.name);
    emit('court:create');
    return { ok: true, id: c.id, court: c };
  };

  ops.updateCourt = function (id, v) {
    const e = validateCourt(v, id);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const before = (get('courts', id) || {}).venueId;
    put('courts', id, {
      number: Number(v.number), name: v.name.trim(), venueId: v.venueId, location: v.location,
      type: v.type, floodlit: !!v.floodlit, status: v.status, pricePerHour: Number(v.pricePerHour), note: v.note || ''
    });
    syncDeckCount(v.venueId);
    if (before && before !== v.venueId) syncDeckCount(before);
    log('court', v.name + ' details updated');
    emit('court:update');
    return { ok: true };
  };

  ops.deleteCourt = function (id) {
    const c = get('courts', id); if (!c) return { ok: false };
    const upcoming = list('bookings').filter(b => b.courtId === id && b.date >= today() && ['confirmed', 'pending'].includes(b.status));
    if (upcoming.length) return { ok: false, errors: { id: c.name + ' has ' + upcoming.length + ' upcoming booking(s). Cancel or move them first.' } };
    del('courts', id);
    syncDeckCount(c.venueId);
    log('court', c.name + ' was retired');
    emit('court:delete');
    return { ok: true };
  };

  ops.setCourtStatus = function (id, status, note) {
    const c = put('courts', id, { status, note: note === undefined ? c_note(id) : note });
    if (!c) return { ok: false };
    if (status === 'maintenance') {
      const hit = list('bookings').filter(b => b.courtId === id && b.date >= today() && b.status === 'confirmed');
      if (hit.length) {
        hit.forEach(b => { b.status = 'cancelled'; b.note = 'Court moved to maintenance'; });
        log('court', c.name + ' set to maintenance — ' + hit.length + ' booking(s) released');
        notify('court', c.name + ' is under maintenance; ' + hit.length + ' booking(s) were released for rebooking.');
      } else {
        log('court', c.name + ' set to maintenance');
        notify('court', c.name + ' is now under maintenance.');
      }
    } else {
      log('court', c.name + ' status → ' + status);
      notify('court', c.name + ' is now ' + status + '.');
    }
    emit('court:status');
    return { ok: true };
  };
  const c_note = id => (get('courts', id) || {}).note || '';

  /* ---- bookings ---- */
  function overlap(a, b) {
    return a.courtId === b.courtId && a.date === b.date &&
           mins(a.start) < mins(b.start) + b.duration * 60 &&
           mins(b.start) < mins(a.start) + a.duration * 60;
  }

  ops.conflictFor = function (courtId, date, start, duration, exceptId) {
    const probe = { courtId, date, start, duration: Number(duration) };
    return list('bookings').find(b =>
      b.id !== exceptId && ['confirmed', 'pending'].includes(b.status) && overlap(probe, b)) || null;
  };

  function priceFor(court, player, duration) {
    const settings = db.settings;
    const gross = court.pricePerHour * duration;
    const tier = memberships().find(m => m.id === (player ? player.membership : '')) || { discount: 0 };
    const off = gross * (tier.discount / 100);
    const tax = (gross - off) * (settings.booking.taxPct / 100);
    return { gross, discount: Math.round(off), tax: Math.round(tax), total: Math.round(gross - off + tax) };
  }
  ops.quotePrice = priceFor;

  function validateBooking(v) {
    const e = {};
    const s = db.settings.booking;
    if (!v.playerId) e.playerId = 'Select a player.';
    if (!v.courtId) e.courtId = 'Select a court.';
    if (!isDate(v.date)) e.date = 'Choose a valid date.';
    else if (dayDiff(today(), v.date) < 0) e.date = 'The date is in the past.';
    else if (dayDiff(today(), v.date) > 90) e.date = 'Bookings open 90 days ahead at most.';
    if (!isTime(v.start)) e.start = 'Choose a start time.';
    const dur = Number(v.duration);
    if (isNaN(dur) || dur < s.minHours || dur > s.maxHours) e.duration = 'Duration must be between ' + s.minHours + ' and ' + s.maxHours + ' hours.';
    if (!v.method) e.method = 'Select a payment method.';
    const court = v.courtId ? get('courts', v.courtId) : null;
    if (court) {
      if (court.status === 'maintenance') e.courtId = court.name + ' is under maintenance and cannot be booked.';
      if (isTime(v.start)) {
        const st = mins(v.start), en = st + (dur || 1) * 60;
        if (st < mins(s.open)) e.start = 'Courts open at ' + s.open + '.';
        else if (en > mins(s.close)) e.start = 'This run ends after closing time (' + s.close + ').';
        else {
          const hit = ops.conflictFor(court.id, v.date, v.start, dur);
          if (hit) e.start = 'Double booking: ' + hit.id + ' already holds ' + hit.start + '–' + hit.end + ' on that court.';
        }
      }
    }
    return e;
  }

  ops.createBooking = function (v) {
    const e = validateBooking(v);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const court = get('courts', v.courtId);
    const player = get('players', v.playerId);
    const price = priceFor(court, player, Number(v.duration));
    const status = v.status || 'confirmed';
    const b = add('bookings', {
      playerId: player.id, courtId: court.id, date: v.date, start: v.start,
      duration: Number(v.duration), end: hm(mins(v.start) + Number(v.duration) * 60),
      format: v.format || 'Doubles', players: Number(v.players) || 4, status,
      method: status === 'pending' ? '—' : v.method,
      subtotal: price.gross, discount: price.discount, tax: price.tax, amount: price.total,
      note: v.note || '', createdAt: nowISO()
    });
    if (status === 'confirmed') {
      add('payments', {
        playerId: player.id, who: player.name, kind: 'Court booking', refId: b.id,
        item: court.name + ' · ' + fmtDate(b.date) + ' ' + b.start + '–' + b.end,
        amount: b.amount, method: b.method, status: 'paid', date: today(),
        ref: 'TRX' + Math.floor(100000 + Math.random() * 899999)
      });
      log('booking', b.id + ' confirmed · ' + court.name + ' ' + fmtDate(b.date) + ' ' + b.start);
      notify('booking', 'Booking confirmed: ' + court.name + ', ' + fmtDate(b.date) + ' ' + b.start);
    } else {
      log('booking', 'Pending hold created for ' + court.name);
      notify('booking', 'Booking held (unpaid): ' + court.name + ' ' + fmtDate(b.date) + ' ' + b.start);
    }
    emit('booking:create');
    return { ok: true, id: b.id, booking: b, price: price };
  };

  ops.updateBooking = function (id, v) {
    const e = validateBooking(v);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const b = get('bookings', id);
    if (!b) return { ok: false, errors: { id: 'Booking not found.' } };
    const court = get('courts', v.courtId);
    const player = get('players', v.playerId);
    const price = priceFor(court, player, Number(v.duration));
    const moved = b.date !== v.date || b.start !== v.start || b.courtId !== v.courtId;
    Object.assign(b, {
      playerId: player.id, courtId: court.id, date: v.date, start: v.start,
      duration: Number(v.duration), end: hm(mins(v.start) + Number(v.duration) * 60),
      format: v.format, players: Number(v.players) || b.players, method: b.method || v.method,
      subtotal: price.gross, discount: price.discount, tax: price.tax, amount: price.total, note: v.note || ''
    });
    if (moved) {
      const pay = list('payments').find(p => p.refId === id);
      if (pay) pay.item = court.name + ' · ' + fmtDate(b.date) + ' ' + b.start + '–' + b.end;
      log('booking', id + ' rescheduled to ' + fmtDate(b.date) + ' ' + b.start + ' · ' + court.name);
      notify('booking', 'Booking ' + id + ' moved to ' + fmtDate(b.date) + ' ' + b.start);
    } else {
      log('booking', id + ' updated');
    }
    emit('booking:update');
    return { ok: true, id: id };
  };

  ops.cancelBooking = function (id, reason) {
    const b = get('bookings', id);
    if (!b) return { ok: false, errors: { id: 'Booking not found.' } };
    if (b.status === 'cancelled') return { ok: false, errors: { id: 'That booking is already cancelled.' } };
    b.status = 'cancelled';
    b.note = reason || b.note || 'Cancelled by admin';
    const court = get('courts', b.courtId);
    const pay = list('payments').find(p => p.refId === id && p.status === 'paid');
    let refunded = 0;
    if (pay) { pay.status = 'refunded'; refunded = pay.amount; }
    log('booking', (court ? court.name : 'Court') + ' ' + fmtDate(b.date) + ' ' + b.start + ' cancelled — slot released' + (refunded ? ' · ₱' + nf.format(refunded) + ' refunded' : ''));
    notify('booking', 'Booking ' + id + ' cancelled. ' + (court ? court.name : 'The court') + ' is free again at ' + b.start + '.');
    emit('booking:cancel');
    return { ok: true, released: true, refunded: refunded };
  };

  ops.completeBooking = function (id) {
    const b = get('bookings', id);
    if (!b) return { ok: false };
    b.status = 'completed';
    log('booking', b.id + ' marked completed');
    emit('booking:complete');
    return { ok: true };
  };

  /* ---- matches ---- */
  ops.scheduleMatch = function (v) {
    const e = {};
    if (!String(v.teamA || '').trim()) e.teamA = 'Team A is required.';
    if (!String(v.teamB || '').trim()) e.teamB = 'Team B is required.';
    if (String(v.teamA).trim().toLowerCase() === String(v.teamB).trim().toLowerCase()) e.teamB = 'Team A and Team B must differ.';
    if (!v.courtId) e.courtId = 'Pick a court.';
    if (!isDate(v.date)) e.date = 'Choose a valid date.';
    if (!isTime(v.time)) e.time = 'Choose a start time.';
    if (!String(v.round || '').trim()) e.round = 'Give the match a section or round.';
    if (e.teamA || e.teamB || e.date || e.time || e.courtId) return { ok: false, errors: e };
    if (v.courtId && ops.conflictFor(v.courtId, v.date, v.time, 1)) return { ok: false, errors: { courtId: 'That court is already booked at this time.' } };
    const m = add('matches', {
      code: 'M' + (db.matches.length + 1), round: v.round, type: v.type || 'Doubles',
      teamA: String(v.teamA).trim(), teamB: String(v.teamB).trim(),
      teamAIds: [], teamBIds: [], courtId: v.courtId, date: v.date, time: v.time,
      gameTo: Number(v.gameTo) || 11, scoreA: null, scoreB: null, winner: null,
      status: 'upcoming', tournamentId: v.tournamentId || null, bracket: null
    });
    log('match', 'Match scheduled: ' + m.teamA + ' vs ' + m.teamB + ' · ' + fmtDate(m.date));
    notify('match', 'Match scheduled for ' + fmtDate(m.date) + ' ' + m.time + ' — ' + m.teamA + ' vs ' + m.teamB);
    emit('match:create');
    return { ok: true, id: m.id, match: m };
  };

  ops.updateMatch = function (id, v) {
    const m = get('matches', id); if (!m) return { ok: false, errors: { id: 'Match not found.' } };
    const e = {};
    if (!String(v.teamA || '').trim()) e.teamA = 'Team A is required.';
    if (!String(v.teamB || '').trim()) e.teamB = 'Team B is required.';
    if (!isDate(v.date)) e.date = 'Invalid date.';
    if (!isTime(v.time)) e.time = 'Invalid time.';
    if (!v.courtId) e.courtId = 'Pick a court.';
    if (Object.keys(e).length) return { ok: false, errors: e };
    Object.assign(m, { round: v.round || m.round, type: v.type || m.type, teamA: v.teamA, teamB: v.teamB,
      courtId: v.courtId, date: v.date, time: v.time, gameTo: Number(v.gameTo) || m.gameTo });
    log('match', m.code + ' rescheduled');
    emit('match:update');
    return { ok: true };
  };

  /* Score entry — the winner is decided here, never typed. */
  ops.enterScore = function (id, scoreA, scoreB) {
    const m = get('matches', id);
    if (!m) return { ok: false, errors: { id: 'Match not found.' } };
    const a = Number(scoreA), b = Number(scoreB);
    const to = m.gameTo || 11;
    const e = {};
    if (isNaN(a) || isNaN(b)) e.score = 'Both scores must be numbers.';
    else if (a < 0 || b < 0) e.score = 'Scores cannot be negative.';
    else if (a > 30 || b > 30) e.score = 'Scores above 30 look wrong — check the sheet.';
    else if (a === b) e.score = 'A match cannot end tied. Play the point out.';
    else if (Math.max(a, b) < to - 1) e.score = 'Games are played to ' + to + ' — the winner needs at least ' + (to - 1) + '.';
    else if (Math.abs(a - b) === 1 && Math.max(a, b) >= to - 1 && Math.min(a, b) >= to - 2) e.score = 'Deuce: a game can only be won by 2 at the ceiling.';
    if (Object.keys(e).length) return { ok: false, errors: e };
    m.scoreA = a; m.scoreB = b;
    m.winner = a > b ? 'A' : 'B';
    m.status = 'completed';
    const winnerName = m.winner === 'A' ? m.teamA : m.teamB;
    log('match', 'Result logged · ' + m.teamA + ' ' + a + '–' + b + ' ' + m.teamB + ' — won by ' + winnerName);
    notify('match', winnerName + ' beat ' + (m.winner === 'A' ? m.teamB : m.teamA) + ' ' + Math.max(a, b) + '–' + Math.min(a, b) + ' in ' + m.round);
    /* ladder points: winner +120, loser +20 */
    bumpRating(m.teamAIds, m.winner === 'A' ? 120 : 20);
    bumpRating(m.teamBIds, m.winner === 'B' ? 120 : 20);
    if (m.tournamentId && m.bracket) advanceBracket(m);
    else if (m.tournamentId) {
      const t = get('tournaments', m.tournamentId);
      if (t) syncStandings(t, m);
    }
    emit('match:score');
    return { ok: true, winner: winnerName };
  };

  function bumpRating(ids, pts) {
    ids.forEach(pid => {
      const p = get('players', pid);
      if (p) p.rating += pts;
    });
  }

  ops.deleteMatch = function (id) {
    const m = get('matches', id);
    if (m && m.tournamentId) return { ok: false, errors: { id: 'Bracket matches are managed from the tournament page.' } };
    del('matches', id);
    if (m) log('match', m.code + ' removed from the draw');
    emit('match:delete');
    return { ok: true };
  };

  /* ---- tournaments + bracket ---- */
  const drawSize = n => { let s = 2; while (s < n) s *= 2; return Math.max(4, s); };

  function buildBracket(t) {
    const size = drawSize(t.teams.length);
    /* classic seed spread: 1 vs size, then halves keep the top seeds apart,
       so entries beyond the draw size fall out as byes instead of duplicating a team */
    let seeds = [1];
    while (seeds.length < size) {
      const n = seeds.length * 2;
      const next = [];
      seeds.forEach(s => { next.push(s); next.push(n + 1 - s); });
      seeds = next;
    }
    const order = seeds.map(s => t.teams[s - 1] ? t.teams[s - 1].id : null);
    const rounds = [];
    let n = size;
    let r = 1;
    const names = s => s === 2 ? 'Final' : s === 4 ? 'Semi-finals' : s === 8 ? 'Quarter-finals' : 'Round of ' + s;
    while (n >= 2) {
      rounds.push({ name: names(n), slots: Array.from({ length: n / 2 }, (_, i) => ({ idx: i, round: r, teamA: null, teamB: null, matchId: null, winner: null })) });
      n /= 2; r++;
    }
    rounds[0].slots.forEach((slot, i) => {
      slot.teamA = order[i * 2] || null;
      slot.teamB = order[i * 2 + 1] || null;
    });
    /* byes resolve instantly */
    const t0 = [];
    rounds[0].slots.forEach(slot => {
      if (slot.teamA && !slot.teamB) { slot.winner = 'A'; t0.push(slot); }
      if (slot.teamB && !slot.teamA) { slot.winner = 'B'; t0.push(slot); }
    });
    t.bracket = { size: size, rounds: rounds };
    t0.forEach(s => propagate(t, s));
    return t;
  }

  function propagate(t, slot) {
    const rounds = t.bracket.rounds;
    if (slot.round >= rounds.length) return;
    const next = rounds[slot.round].slots[Math.floor(slot.idx / 2)];
    const teamId = slot.winner === 'A' ? slot.teamA : slot.teamB;
    if (slot.idx % 2 === 0) next.teamA = teamId; else next.teamB = teamId;
  }

  function createBracketMatches(t) {
    /* remove any stale slots then re-issue one match per populated first-round slot */
    t.bracket.rounds.forEach(round => {
      round.slots.forEach(slot => {
        if (slot.matchId || (!slot.teamA && !slot.teamB) || slot.winner) return;
        const m = add('matches', {
          code: t.name.split(' ')[0] + '-' + slot.round + '.' + (slot.idx + 1),
          round: round.name, type: t.event,
          teamA: teamName(t, slot.teamA), teamB: teamName(t, slot.teamB),
          teamAIds: teamIds(t, slot.teamA), teamBIds: teamIds(t, slot.teamB),
          courtId: defaultCourt(t.venueId), date: addDays(t.start, slot.round - 1), time: slotTime(slot.idx),
          gameTo: 11, scoreA: null, scoreB: null, winner: null, status: 'upcoming',
          tournamentId: t.id, bracket: { round: slot.round, idx: slot.idx }
        });
        slot.matchId = m.id;
      });
    });
  }

  const teamName = (t, id) => { const x = t.teams.find(y => y.id === id); return x ? x.name : 'TBD'; };
  const teamIds = (t, id) => { const x = t.teams.find(y => y.id === id); return x ? x.playerIds.slice() : []; };
  const slotTime = i => ['08:00', '10:00', '13:00', '15:00', '17:00'][i % 5];
  function defaultCourt(venueId) {
    const c = list('courts').find(x => x.venueId === venueId) || list('courts')[0];
    return c ? c.id : null;
  }

  function advanceBracket(m) {
    const t = get('tournaments', m.tournamentId);
    if (!t || !t.bracket) return;
    const round = t.bracket.rounds[m.bracket.round - 1];
    if (!round) return;
    const slot = round.slots[m.bracket.idx];
    if (!slot) return;
    slot.winner = m.winner;
    slot.score = m.scoreA + '–' + m.scoreB;
    propagate(t, slot);
    log('tournament', t.name + ' · ' + (m.winner === 'A' ? m.teamA : m.teamB) + ' advances in ' + round.name);
    const final = m.bracket.round === t.bracket.rounds.length;
    if (final) {
      t.status = 'completed';
      t.champion = m.winner === 'A' ? m.teamA : m.teamB;
      notify('tournament', 'Champion crowned at ' + t.name + ': ' + t.champion);
      log('tournament', t.name + ' won by ' + t.champion);
    } else {
      createBracketMatches(t);
    }
  }

  function validateTournament(v) {
    const e = {};
    if (!String(v.name || '').trim()) e.name = 'Tournament name is required.';
    if (!String(v.event || '').trim()) e.event = 'Pick the event (e.g. Mixed Doubles).';
    if (!v.format) e.format = 'Choose a format.';
    const fee = Number(v.entryFee);
    if (isNaN(fee) || fee < 0) e.entryFee = 'Entry fee must be zero or positive.';
    const max = Number(v.maxTeams);
    if (isNaN(max) || max < 2) e.maxTeams = 'Maximum teams must be at least 2.';
    if (!isDate(v.start) || !isDate(v.end)) e.start = 'Start and end dates must be valid.';
    else if (parse(v.end) < parse(v.start)) e.end = 'The end date is before the start date.';
    if (!v.venueId) e.venueId = 'Choose the host venue.';
    const pot = Number(v.prizePool);
    if (isNaN(pot) || pot < 0) e.prizePool = 'Prize pool must be zero or positive.';
    return e;
  }

  ops.createTournament = function (v) {
    const e = validateTournament(v);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const t = add('tournaments', {
      name: v.name.trim(), event: v.event, format: v.format, venueId: v.venueId,
      start: v.start, end: v.end, entryFee: Number(v.entryFee), maxTeams: Number(v.maxTeams),
      prizePool: Number(v.prizePool) || 0, status: v.status || 'registration',
      teams: [], bracket: null, createdAt: nowISO()
    });
    log('tournament', t.name + ' created for ' + fmtDate(t.start));
    notify('tournament', 'New tournament open: ' + t.name + ' · ' + money(t.entryFee) + ' entry');
    emit('tournament:create');
    return { ok: true, id: t.id, tournament: t };
  };

  ops.updateTournament = function (id, v) {
    const e = validateTournament(v);
    if (Object.keys(e).length) return { ok: false, errors: e };
    put('tournaments', id, { name: v.name.trim(), event: v.event, format: v.format, venueId: v.venueId,
      start: v.start, end: v.end, entryFee: Number(v.entryFee), maxTeams: Number(v.maxTeams),
      prizePool: Number(v.prizePool) || 0, status: v.status });
    emit('tournament:update');
    return { ok: true };
  };

  ops.deleteTournament = function (id) {
    const t = get('tournaments', id); if (!t) return { ok: false };
    db.matches = db.matches.filter(m => m.tournamentId !== id);
    del('tournaments', id);
    log('tournament', t.name + ' was deleted');
    emit('tournament:delete');
    return { ok: true };
  };

  ops.registerTeam = function (tournamentId, teamNameInput, playerAId, playerBId) {
    const t = get('tournaments', tournamentId);
    if (!t) return { ok: false, errors: { id: 'Tournament not found.' } };
    if (!['registration', 'upcoming'].includes(t.status)) return { ok: false, errors: { id: t.name + ' is ' + t.status + ' — registration is closed.' } };
    if (t.teams.length >= t.maxTeams) return { ok: false, errors: { team: 'The draw is full (' + t.maxTeams + ' teams).' } };
    if (!String(teamNameInput || '').trim()) return { ok: false, errors: { team: 'Team name is required.' } };
    if (t.teams.some(x => x.name.toLowerCase() === String(teamNameInput).trim().toLowerCase()))
      return { ok: false, errors: { team: 'That team is already registered.' } };
    if (!playerAId) return { ok: false, errors: { playerA: 'Pick the first player.' } };
    if (t.event.toLowerCase().indexOf('singles') < 0 && !playerBId) return { ok: false, errors: { playerB: 'Doubles needs two players.' } };
    if (playerBId && playerBId === playerAId) return { ok: false, errors: { playerB: 'A player cannot partner themself.' } };
    const ids = playerBId ? [playerAId, playerBId] : [playerAId];
    if (t.teams.some(x => x.playerIds.some(p => ids.includes(p))))
      return { ok: false, errors: { playerA: 'One of these players is already on a registered team.' } };
    const team = { id: 'TM-' + (9600 + t.teams.length + db.tournaments.length * 40), name: String(teamNameInput).trim(), playerIds: ids };
    t.teams.push(team);
    add('payments', {
      playerId: playerAId, who: teamNameFor(playerAId), kind: 'Tournament entry', refId: t.id,
      item: t.name + ' · ' + team.name, amount: t.entryFee, method: 'GCash',
      status: 'paid', date: today(), ref: 'TP' + Math.floor(10000 + Math.random() * 89999)
    });
    log('tournament', team.name + ' registered for ' + t.name + ' (' + t.teams.length + '/' + t.maxTeams + ')');
    notify('tournament', team.name + ' entered ' + t.name + ' · ' + money(t.entryFee) + ' collected');
    emit('tournament:register');
    return { ok: true, team: team, seats: t.teams.length };
  };

  const teamNameFor = id => { const p = get('players', id); return p ? p.name : 'Member'; };

  ops.withdrawTeam = function (tournamentId, teamId) {
    const t = get('tournaments', tournamentId); if (!t) return { ok: false };
    const i = t.teams.findIndex(x => x.id === teamId); if (i < 0) return { ok: false };
    if (t.bracket) return { ok: false, errors: { id: 'The draw is already built — cancel that match instead.' } };
    const gone = t.teams.splice(i, 1)[0];
    log('tournament', gone.name + ' withdrew from ' + t.name);
    emit('tournament:withdraw');
    return { ok: true };
  };

  ops.drawBracket = function (tournamentId) {
    const t = get('tournaments', tournamentId);
    if (!t) return { ok: false, errors: { id: 'Tournament not found.' } };
    if (t.teams.length < 2) return { ok: false, errors: { id: 'At least 2 teams must register before the draw.' } };
    if (t.format === 'Round Robin') {
      t.status = 'ongoing';
      t.schedule = [];
      const ts = t.teams.slice();
      const half = ts.length / 2;
      for (let r = 0; r < ts.length - 1; r++) {
        for (let i = 0; i < half; i++) {
          const a = ts[i], b = ts[ts.length - 1 - i];
          if (!a || !b) continue;
          const m = add('matches', {
            code: 'RR' + (r + 1) + '.' + (i + 1), round: 'Pool · Matchday ' + (r + 1), type: t.event,
            teamA: a.name, teamB: b.name, teamAIds: a.playerIds.slice(), teamBIds: b.playerIds.slice(),
            courtId: defaultCourt(t.venueId), date: addDays(t.start, r % 7), time: slotTime(i),
            gameTo: 11, scoreA: null, scoreB: null, winner: null, status: 'upcoming',
            tournamentId: t.id, bracket: null
          });
          t.schedule.push(m.id);
        }
        ts.splice(1, 0, ts.pop());
      }
      t.standings = t.teams.map(x => ({ teamId: x.id, name: x.name, played: 0, won: 0, lost: 0, pts: 0 }));
      log('tournament', 'Round-robin schedule published for ' + t.name);
      notify('tournament', 'Fixtures are live for ' + t.name);
      emit('tournament:draw');
      return { ok: true, mode: 'round-robin' };
    }
    if (t.bracket) return { ok: false, errors: { id: 'The bracket is already drawn.' } };
    buildBracket(t);
    createBracketMatches(t);
    t.status = 'ongoing';
    log('tournament', 'Bracket drawn for ' + t.name + ' · ' + t.teams.length + ' teams into a ' + t.bracket.size + ' draw');
    notify('tournament', 'Bracket published for ' + t.name + ' (' + t.bracket.size + '-team draw)');
    emit('tournament:draw');
    return { ok: true, mode: 'bracket' };
  };

  /* keep round-robin standings in step with results */
  function syncStandings(t, m) {
    if (!t.standings) return;
    const a = t.standings.find(s => s.teamId === teamIdOf(t, m.teamA));
    const b = t.standings.find(s => s.teamId === teamIdOf(t, m.teamB));
    if (!a || !b) return;
    a.played++; b.played++;
    if (m.winner === 'A') { a.won++; a.pts += 3; b.lost++; }
    else { b.won++; b.pts += 3; a.lost++; }
  }
  const teamIdOf = (t, name) => { const x = t.teams.find(y => y.name === name); return x ? x.id : null; };

  /* ---- payments ---- */
  function validatePayment(v) {
    const e = {};
    if (!v.playerId) e.playerId = 'Select the paying member.';
    const amt = Number(v.amount);
    if (isNaN(amt) || amt <= 0) e.amount = 'Amount must be greater than zero.';
    if (amt > 500000) e.amount = 'Amount looks too large — check the figure.';
    if (!v.method) e.method = 'Select a payment method.';
    if (!isDate(v.date)) e.date = 'Payment date must be valid.';
    if (!['paid', 'pending', 'refunded', 'failed'].includes(v.status)) e.status = 'Pick a valid status.';
    if (!String(v.item || '').trim()) e.item = 'Describe what this payment is for.';
    return e;
  }

  ops.recordPayment = function (v) {
    const e = validatePayment(v);
    if (Object.keys(e).length) return { ok: false, errors: e };
    const p = get('players', v.playerId);
    const pay = add('payments', {
      playerId: p.id, who: p.name, kind: v.kind || 'Manual invoice', refId: v.refId || '',
      item: String(v.item).trim(), amount: Number(v.amount), method: v.method, status: v.status,
      date: v.date, ref: v.ref || ('TRX' + Math.floor(100000 + Math.random() * 899999))
    });
    if (pay.status === 'paid') {
      log('payment', money(pay.amount) + ' received · ' + pay.kind + ' · ' + p.name);
      notify('payment', 'Payment recorded: ' + money(pay.amount) + ' from ' + p.name + ' via ' + pay.method);
    } else {
      log('payment', money(pay.amount) + ' logged as ' + pay.status + ' for ' + p.name);
    }
    emit('payment:create');
    return { ok: true, id: pay.id, payment: pay };
  };

  ops.setPaymentStatus = function (id, status) {
    const p = get('payments', id); if (!p) return { ok: false };
    const was = p.status;
    p.status = status;
    if (status === 'paid' && was !== 'paid') {
      if (p.refId && (p.kind || '').indexOf('booking') > -1) {
        const b = get('bookings', p.refId);
        if (b && b.status === 'pending') { b.status = 'confirmed'; b.method = p.method; }
      }
      log('payment', p.id + ' settled · ' + money(p.amount) + ' from ' + p.who);
      notify('payment', 'Payment ' + p.id + ' cleared — ' + money(p.amount));
    } else {
      log('payment', p.id + ' marked ' + status);
      notify('payment', 'Payment ' + p.id + ' is now ' + status + '.');
    }
    emit('payment:status');
    return { ok: true };
  };

  ops.deletePayment = function (id) {
    const p = get('payments', id);
    if (!p) return { ok: false };
    if (p.kind === 'Court booking') return { ok: false, errors: { id: 'Booking invoices follow the booking — cancel the booking instead.' } };
    del('payments', id);
    log('payment', id + ' removed from the ledger');
    emit('payment:delete');
    return { ok: true };
  };

  /* ---- notifications ---- */
  ops.markRead = id => { const n = get('notifications', id); if (!n) return { ok: false }; n.read = true; emit('notif:read'); return { ok: true }; };
  ops.markUnread = id => { const n = get('notifications', id); if (!n) return { ok: false }; n.read = false; emit('notif:unread'); return { ok: true }; };
  ops.markAllRead = () => { list('notifications').forEach(n => n.read = true); emit('notif:readall'); return { ok: true }; };
  ops.clearRead = () => { const n = list('notifications').filter(x => x.read).length; db.notifications = db.notifications.filter(x => !x.read); log('system', n + ' read notification(s) cleared'); emit('notif:clear'); return { ok: true, removed: n }; };
  ops.clearAll = () => { db.notifications = []; emit('notif:clearall'); return { ok: true }; };
  ops.notify = (kind, text) => { notify(kind, text); emit('notif:new'); };

  /* ---- settings ---- */
  ops.saveSettings = function (group, values) {
    const e = {};
    if (group === 'club') {
      if (!String(values.name || '').trim()) e.name = 'Club name is required.';
      if (!isEmail(values.email)) e.email = 'A valid club email is required.';
      if (!isPhone(values.phone)) e.phone = 'A valid club phone is required.';
      if (!String(values.address || '').trim()) e.address = 'Address is required.';
    }
    if (group === 'booking') {
      if (!isTime(values.open)) e.open = 'Opening time is invalid.';
      if (!isTime(values.close)) e.close = 'Closing time is invalid.';
      else if (mins(values.close) <= mins(values.open)) e.close = 'Closing must be after opening.';
      const max = Number(values.maxHours);
      if (isNaN(max) || max < 1 || max > 12) e.maxHours = 'Maximum booking duration must be 1–12 hours.';
      const min = Number(values.minHours);
      if (isNaN(min) || min < 1 || min > max) e.minHours = 'Minimum duration must be at least 1 hour and no more than the maximum.';
      const cancel = Number(values.cancelHours);
      if (isNaN(cancel) || cancel < 0) e.cancelHours = 'Cancellation window cannot be negative.';
      const tax = Number(values.taxPct);
      if (isNaN(tax) || tax < 0 || tax > 50) e.taxPct = 'Tax must be between 0% and 50%.';
    }
    if (group === 'user') {
      if (!String(values.name || '').trim()) e.name = 'Your name is required.';
      if (!isEmail(values.email)) e.email = 'A valid email is required.';
      if (values.newPassword && String(values.newPassword).length < 8) e.newPassword = 'Password needs at least 8 characters.';
    }
    if (Object.keys(e).length) return { ok: false, errors: e };
    if (group === 'club') Object.assign(db.settings.club, values);
    if (group === 'booking') Object.assign(db.settings.booking, values);
    if (group === 'user') {
      const pw = values.newPassword;
      delete values.newPassword;
      Object.assign(db.settings.user, values);
      if (pw) { db.settings.user.passwordSet = nowISO(); log('system', 'Administrator password changed'); notify('system', 'Your account password was updated.'); }
    }
    if (group === 'memberships') db.settings.memberships = values;
    log('system', 'Settings saved · ' + group);
    emit('settings:save');
    return { ok: true };
  };

  ops.membershipUpsert = function (i, m) {
    const e = {};
    if (!String(m.name || '').trim()) e.name = 'Membership name is required.';
    const price = Number(m.price);
    if (isNaN(price) || price < 0) e.price = 'Price must be zero or positive.';
    const disc = Number(m.discount);
    if (isNaN(disc) || disc < 0 || disc > 90) e.discount = 'Discount must be between 0% and 90%.';
    if (!String(m.benefits || '').trim()) e.benefits = 'List at least one benefit.';
    if (Object.keys(e).length) return { ok: false, errors: e };
    const row = { id: m.id || ('tier' + Date.now().toString(36)), name: m.name.trim(), price, term: m.term, discount: disc,
      benefits: String(m.benefits).split('\n').map(s => s.trim()).filter(Boolean) };
    if (i === -1 || i === undefined) db.settings.memberships.push(row); else db.settings.memberships[i] = row;
    log('system', row.name + ' membership saved at ' + money(row.price));
    emit('settings:membership');
    return { ok: true };
  };
  ops.membershipRemove = function (i) {
    const m = db.settings.memberships[i];
    if (!m) return { ok: false };
    if (list('players').some(p => p.membership === m.id)) return { ok: false, errors: { id: m.name + ' still has members on it.' } };
    db.settings.memberships.splice(i, 1);
    emit('settings:membership');
    return { ok: true };
  };

  /* ---- events / clinic RSVP ---- */
  ops.rsvpEvent = function (id) {
    const e = get('events', id); if (!e) return { ok: false };
    if (e.booked >= e.spots) return { ok: false, errors: { id: e.title + ' is fully booked.' } };
    e.booked += 1;
    log('club', 'RSVP confirmed for ' + e.title);
    notify('event', 'RSVP confirmed for ' + e.title + ' — ' + (e.spots - e.booked) + ' spots left.');
    emit('event:rsvp');
    return { ok: true, left: e.spots - e.booked };
  };

  ops.enrollProgram = function (id) {
    const p = PROGRAMS.find(x => x.id === id); if (!p) return { ok: false };
    if (p.enrolled >= p.spots) return { ok: false, errors: { id: p.title + ' is full.' } };
    p.enrolled += 1;
    log('club', 'Enrolled in ' + p.title + ' (' + p.enrolled + '/' + p.spots + ')');
    notify('clinic', 'Enrolled in ' + p.title + ' · ' + (p.spots - p.enrolled) + ' seats left');
    emit('program:enroll');
    return { ok: true };
  };

  ops.cartAdd = function (itemName) {
    db.cart = db.cart || [];
    const found = db.cart.find(c => c.name === itemName);
    if (found) found.qty += 1; else db.cart.push({ name: itemName, qty: 1 });
    log('shop', itemName + ' added to the shop cart');
    emit('shop:cart');
    return { ok: true, items: db.cart.reduce((s, c) => s + c.qty, 0) };
  };
  ops.cartClear = () => { db.cart = []; emit('shop:cart'); return { ok: true }; };

  /* ---- notes / drills / threads ---- */
  ops.addNote = function (title, tag) {
    if (!String(title || '').trim()) return { ok: false, errors: { title: 'Write the note first.' } };
    add('activity', { kind: 'note', text: String(title).trim(), at: nowISO(), tag: tag || 'General' });
    log('note', 'Court note saved');
    emit('note:add');
    return { ok: true };
  };

  ops.toggleDrill = function (title) {
    db.drills = db.drills || DRILLS.map(d => Object.assign({ done: false }, d));
    const d = db.drills.find(x => x.title === title);
    if (!d) return { ok: false };
    d.done = !d.done;
    log('drill', d.title + (d.done ? ' completed' : ' reopened'));
    emit('drill:toggle');
    return { ok: true, done: d.done };
  };

  ops.sendMessage = function (who, text) {
    if (!String(text || '').trim()) return { ok: false, errors: { text: 'Nothing to send.' } };
    db.threads = db.threads || THREADS.map(t => Object.assign({ messages: [{ text: t.last, at: nowISO(), mine: false }] }, t));
    const th = db.threads.find(t => t.who === who) || db.threads[0];
    th.messages.push({ text: String(text).trim(), at: nowISO(), mine: true });
    th.last = String(text).trim();
    th.time = 'now';
    log('message', 'Message sent to ' + th.who);
    emit('message:send');
    return { ok: true };
  };

  /* ============================================================
     SELECTORS — every number the UI prints
     ============================================================ */
  const sel = {};

  sel.playerById = id => get('players', id);
  sel.courtById = id => get('courts', id);
  sel.venueById = id => get('venues', id) || VENUES.find(v => v.id === id) || null;

  sel.venueName = id => { const v = sel.venueById(id); return v ? v.name : '—'; };

  sel.venuesForVenue = venueId => list('courts').filter(c => c.venueId === venueId);
  sel.courtName = id => { const c = get('courts', id); return c ? c.name : '—'; };
  sel.playerName = id => { const p = get('players', id); return p ? p.name : '—'; };

  /* availability of a court, honouring maintenance + bookings */
  sel.isCourtFree = (courtId, date, start, duration, exceptId) => {
    const c = get('courts', courtId);
    if (!c || c.status === 'maintenance') return false;
    return !ops.conflictFor(courtId, date, start, duration, exceptId);
  };

  sel.courtStatusNow = function (court) {
    if (court.status === 'maintenance') return 'maintenance';
    const d = today(), now = clockMins();
    const live = list('bookings').find(b => b.courtId === court.id && b.date === d &&
      ['confirmed', 'pending'].includes(b.status) && mins(b.start) <= now && now < mins(b.start) + b.duration * 60);
    if (live) return 'occupied';
    const next = list('bookings').some(b => b.courtId === court.id && b.date === d &&
      ['confirmed', 'pending'].includes(b.status) && mins(b.start) > now);
    return next ? 'reserved' : (court.status === 'occupied' ? 'available' : court.status);
  };

  sel.bookingsOn = date => list('bookings').filter(b => b.date === date && b.status !== 'cancelled')
    .sort((a, b) => mins(a.start) - mins(b.start));

  sel.bookingsFor = (courtId, date) => list('bookings').filter(b => b.courtId === courtId && b.date === date && b.status !== 'cancelled');

  sel.gridFor = function (date) {
    const s = db.settings.booking;
    const times = [];
    for (let m = mins(s.open); m + s.slotMinutes <= mins(s.close); m += s.slotMinutes) times.push(m);
    const rows = list('courts').map(c => {
      const cells = times.map(tm => {
        if (c.status === 'maintenance') return 3;
        const hit = list('bookings').find(b => b.courtId === c.id && b.date === date &&
          ['confirmed', 'pending'].includes(b.status) && mins(b.start) <= tm && tm < mins(b.start) + b.duration * 60);
        return hit ? (hit.status === 'pending' ? 3 : 1) : 0;
      });
      return { court: c, cells: cells };
    });
    return { times: times.map(hm), rows: rows };
  };

  sel.eventsOn = function (date) {
    const out = [];
    list('bookings').filter(b => b.date === date && b.status !== 'cancelled').forEach(b =>
      out.push({ kind: 'Booking', id: b.id, at: b.start, end: b.end, courtId: b.courtId,
        title: sel.playerName(b.playerId) + ' · ' + sel.courtName(b.courtId), body: b.format + ' · ' + b.duration + 'h · ' + money(b.amount) }));
    list('matches').filter(m => m.date === date).forEach(m =>
      out.push({ kind: m.tournamentId ? 'Tournament' : 'Match', id: m.id, at: m.time, end: hm(mins(m.time) + 60), courtId: m.courtId,
        title: m.teamA + ' vs ' + m.teamB, body: m.round + (m.scoreA !== null ? ' · ' + m.scoreA + '–' + m.scoreB : '') }));
    list('tournaments').filter(t => t.start <= date && t.end >= date).forEach(t =>
      out.push({ kind: 'Tournament', id: t.id, at: '07:00', end: '21:00', courtId: null, title: t.name, body: t.status + ' · ' + sel.venueName(t.venueId) }));
    if (date === today()) list('courts').filter(c => c.status === 'maintenance').forEach(c =>
      out.push({ kind: 'Maintenance', id: c.id, at: db.settings.booking.open, end: db.settings.booking.close, courtId: c.id,
        title: c.name + ' closed', body: c.note || 'Resurfacing and line repaint' }));
    return out.sort((a, b) => mins(a.at) - mins(b.at));
  };

  /* ---- overview cards ---- */
  sel.stats = function () {
    const d = today(), month = monthOf(d);
    const live = list('bookings').filter(b => b.date === d && b.status !== 'cancelled');
    const now = clockMins();
    const pays = list('payments');
    return {
      players: list('players').length,
      activeMembers: list('players').filter(p => p.status === 'active').length,
      courts: list('courts').length,
      courtsAvailable: list('courts').filter(c => sel.courtStatusNow(c) === 'available').length,
      todayBookings: live.length,
      inPlayNow: live.filter(b => now >= mins(b.start) && now < mins(b.start) + b.duration * 60).length,
      upcomingMatches: list('matches').filter(m => m.status === 'upcoming' && (m.date > d || (m.date === d && mins(m.time) > now))).length,
      liveMatches: list('matches').filter(m => m.status === 'live').length,
      monthlyRevenue: pays.filter(p => p.status === 'paid' && monthOf(p.date) === month).reduce((s, p) => s + p.amount, 0),
      todayRevenue: pays.filter(p => p.status === 'paid' && p.date === d).reduce((s, p) => s + p.amount, 0),
      pendingPayments: pays.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
      pendingCount: pays.filter(p => p.status === 'pending').length,
      failedCount: pays.filter(p => p.status === 'failed').length,
      refunded: pays.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0),
      activeTournaments: list('tournaments').filter(t => ['registration', 'upcoming', 'ongoing'].includes(t.status)).length,
      openRegistrations: list('tournaments').filter(t => t.status === 'registration').length,
      unread: list('notifications').filter(n => !n.read).length,
      newThisMonth: list('players').filter(p => monthOf(p.joined) === month).length,
      utilization: Math.round(live.filter(b => mins(b.start) >= now - 120).length / Math.max(1, list('courts').length) * 100)
    };
  };

  /* ---- chart series built from real rows ---- */
  sel.bookingTrend = function (days) {
    const n = days || 14;
    const labels = [], counts = [], revenue = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(today(), -i);
      const rows = list('bookings').filter(b => b.date === d && b.status !== 'cancelled');
      labels.push(d.slice(8) + ' ' + MONTH_NAMES[+d.slice(5, 7) - 1]);
      counts.push(rows.length);
      revenue.push(rows.reduce((s, b) => s + b.amount, 0));
    }
    return { labels: labels, counts: counts, revenue: revenue };
  };

  sel.monthlySeries = function (months) {
    const n = months || 6;
    const labels = [], bookings = [], revenue = [], signups = [], matches = [];
    const base = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
      labels.push(MONTH_NAMES[d.getMonth()]);
      const bs = list('bookings').filter(b => monthOf(b.date) === key && b.status !== 'cancelled');
      bookings.push(bs.length);
      revenue.push(list('payments').filter(p => p.status === 'paid' && monthOf(p.date) === key).reduce((s, p) => s + p.amount, 0));
      signups.push(list('players').filter(p => monthOf(p.joined) === key).length);
      matches.push(list('matches').filter(m => monthOf(m.date) === key).length);
    }
    return { labels: labels, bookings: bookings, revenue: revenue, signups: signups, matches: matches };
  };

  sel.courtUtilization = function (limit) {
    const month = monthOf(today());
    const rows = list('courts').map(c => {
      const hrs = list('bookings').filter(b => b.courtId === c.id && monthOf(b.date) === month && b.status !== 'cancelled')
        .reduce((s, b) => s + b.duration, 0);
      return { name: c.name, hrs: hrs, venueId: c.venueId };
    }).filter(r => r.hrs > 0).sort((a, b) => b.hrs - a.hrs);
    return rows.slice(0, limit || 8);
  };

  sel.peakHours = function () {
    const labels = [], data = [];
    for (let h = 5; h <= 21; h++) {
      labels.push(pad(h) + ':00');
      data.push(list('bookings').filter(b => b.status !== 'cancelled' && +b.start.slice(0, 2) === h).length);
    }
    return { labels: labels, data: data };
  };

  sel.levelSplit = function () {
    const buckets = [
      { name: '3.5+', test: l => l >= 3.5, color: '#6b7cff' },
      { name: '3.0–3.4', test: l => l >= 3 && l < 3.5, color: '#2fb37c' },
      { name: '2.5–2.9', test: l => l >= 2.5 && l < 3, color: '#f4a036' },
      { name: 'Under 2.5', test: l => l < 2.5, color: '#e0607e' }
    ];
    return buckets.map(b => ({ name: b.name, color: b.color, value: list('players').filter(p => b.test(p.level)).length }));
  };

  sel.membershipSplit = function () {
    const colors = ['#6b7cff', '#2fb37c', '#f4a036', '#e0607e', '#8b7cf6', '#3aa9e0'];
    return memberships().map((m, i) => ({
      name: m.name, color: colors[i % colors.length], value: list('players').filter(p => p.membership === m.id).length, price: m.price
    }));
  };

  sel.venueSplit = function () {
    return VENUES.map(v => ({
      name: v.name, value: list('courts').filter(c => c.venueId === v.id).reduce((s, c) =>
        s + list('bookings').filter(b => b.courtId === c.id && b.status !== 'cancelled').length, 0)
    })).filter(r => r.value).sort((a, b) => b.value - a.value);
  };

  sel.topPlayers = function (limit) {
    return list('players').slice().sort((a, b) => b.rating - a.rating).slice(0, limit || 8);
  };

  sel.mostActive = function (limit) {
    const tally = {};
    list('bookings').filter(b => b.status !== 'cancelled').forEach(b => { tally[b.playerId] = (tally[b.playerId] || 0) + 1; });
    return Object.keys(tally).map(id => ({ player: get('players', id), count: tally[id] }))
      .filter(r => r.player).sort((a, b) => b.count - a.count).slice(0, limit || 6);
  };

  sel.revenueByKind = function () {
    const out = {};
    list('payments').filter(p => p.status === 'paid').forEach(p => { out[p.kind] = (out[p.kind] || 0) + p.amount; });
    return Object.keys(out).map(k => ({ kind: k, amount: out[k] })).sort((a, b) => b.amount - a.amount);
  };

  sel.bookingFunnel = function () {
    const c = list('bookings');
    return {
      total: c.length,
      confirmed: c.filter(b => b.status === 'confirmed').length,
      pending: c.filter(b => b.status === 'pending').length,
      completed: c.filter(b => b.status === 'completed').length,
      cancelled: c.filter(b => b.status === 'cancelled').length,
      cancelRate: c.length ? Math.round(c.filter(b => b.status === 'cancelled').length / c.length * 100) : 0
    };
  };

  sel.revenueBetween = function (from, to) {
    return list('payments').filter(p => p.status === 'paid' && p.date >= from && p.date <= to);
  };

  sel.recentActivity = function (limit) {
    return list('activity').slice(0, limit || 8);
  };

  sel.unreadCount = () => list('notifications').filter(n => !n.read).length;

  sel.leaderboard = function (limit) {
    return list('players').filter(p => p.status === 'active')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit || 10)
      .map((p, i) => {
        /* played/won are counted from finished matches this player actually appeared in */
        let played = 0, won = 0;
        list('matches').filter(m => m.status === 'completed').forEach(m => {
          const inA = m.teamAIds.indexOf(p.id) > -1, inB = m.teamBIds.indexOf(p.id) > -1;
          if (!inA && !inB) return;
          played++;
          if ((inA && m.winner === 'A') || (inB && m.winner === 'B')) won++;
        });
        return Object.assign({}, p, { rank: i + 1, played: played, won: won, lost: played - won });
      });
  };

  sel.standings = function (tournamentId) {
    const t = get('tournaments', tournamentId);
    if (!t || !t.standings) return [];
    return t.standings.slice().sort((a, b) => b.pts - a.pts || (b.won - b.lost) - (a.won - a.lost));
  };

  /* Venue load for the dashboard map card. Capacity comes from each venue's
     own posted hours divided by the desk's slot length, and a booking counts
     as the number of slots its hours cover — decks under maintenance sell
     nothing, so they hold no capacity. Nothing here is invented. */
  sel.dashboardVenueLoad = function (dateStr) {
    const d = dateStr || today();
    const s = db.settings.booking;
    const slotMin = Math.max(15, Number(s.slotMinutes) || 60);
    const dayMin = Math.max(60, mins(s.close) - mins(s.open));
    return VENUES.map(v => {
      const cs = list('courts').filter(c => c.venueId === v.id);
      const sellable = cs.filter(c => c.status !== 'maintenance');
      const rows = cs.reduce((acc, c) => acc.concat(sel.bookingsFor(c.id, d)), []);
      const perCourt = Math.max(1, Math.round(((mins(v.close) - mins(v.open)) || dayMin) / slotMin));
      const capacity = sellable.length * perCourt;
      const used = rows.reduce((sum, b) =>
        sum + Math.min(perCourt, Math.max(1, Math.round((Number(b.duration) || 1) * 60 / slotMin))), 0);
      return {
        id: v.id, name: v.name, barangay: v.barangay, status: v.status, price: v.price,
        open: v.open, close: v.close, indoor: v.indoor, lat: v.lat, lng: v.lng,
        courts: cs.length, down: cs.length - sellable.length,
        slotMinutes: slotMin, slotsPerDay: perCourt, capacity: capacity, booked: used, hits: rows.length,
        free: Math.max(0, capacity - used),
        revenue: rows.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
        util: capacity ? Math.min(100, Math.round(used / capacity * 100)) : 0
      };
    }).filter(v => v.courts);
  };

  /* ---- global search across every entity ---- */
  sel.search = function (q) {
    const needle = String(q || '').trim().toLowerCase();
    if (needle.length < 2) return [];
    const has = s => String(s || '').toLowerCase().indexOf(needle) > -1;
    const out = [];
    const push = (group, label, sub, route, id, iconKind) => out.push({ group, label, sub, route, id, icon: iconKind });
    list('players').filter(p => has(p.name) || has(p.email) || has(p.phone)).slice(0, 6)
      .forEach(p => push('Players', p.name, tierName(p.membership) + ' · ' + p.level.toFixed(1) + ' rating', 'members', p.id, 'users'));
    list('venues').filter(v => has(v.name) || has(v.barangay) || has(v.note)).slice(0, 4)
      .forEach(v => push('Venues', v.name, 'Brgy. ' + v.barangay + ' · ' + (v.courts ? v.courts + ' deck(s) · ' + money(v.price) + '/hr' : 'opening soon'), 'venues', v.id, 'globe'));
    list('courts').filter(c => has(c.name) || has(c.location) || has(c.type)).slice(0, 5)
      .forEach(c => push('Courts', c.name, sel.venueName(c.venueId) + ' · ' + money(c.pricePerHour) + '/hr', 'courts', c.id, 'court'));
    list('bookings').filter(b => has(b.id) || has(sel.playerName(b.playerId)) || has(sel.courtName(b.courtId)) || has(b.date)).slice(0, 5)
      .forEach(b => push('Bookings', b.id + ' · ' + sel.courtName(b.courtId), fmtDate(b.date) + ' ' + b.start + ' · ' + sel.playerName(b.playerId), 'booking', b.id, 'calendar'));
    list('matches').filter(m => has(m.teamA) || has(m.teamB) || has(m.round) || has(m.code)).slice(0, 5)
      .forEach(m => push('Matches', m.code + ' · ' + m.round, m.teamA + ' vs ' + m.teamB, 'matches', m.id, 'paddle'));
    list('tournaments').filter(t => has(t.name) || has(t.event)).slice(0, 4)
      .forEach(t => push('Tournaments', t.name, t.teams.length + '/' + t.maxTeams + ' teams · ' + fmtDate(t.start), 'tournaments', t.id, 'trophy'));
    list('payments').filter(p => has(p.id) || has(p.who) || has(p.item) || has(p.ref)).slice(0, 5)
      .forEach(p => push('Payments', p.id + ' · ' + money(p.amount), p.who + ' · ' + p.status, 'payments', p.id, 'wallet'));
    return out;
  };

  /* ---------------- formatting ---------------- */
  function fmtDate(s) {
    if (!isDate(s)) return s || '—';
    const d = parse(s);
    const diff = dayDiff(today(), s);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return pad(d.getDate()) + ' ' + MONTH_NAMES[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  sel.fmtDate = fmtDate;
  sel.fmtDateTime = function (iso) {
    const d = new Date(iso);
    return pad(d.getDate()) + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };

  /* ---------------- exports ---------------- */
  const api = {
    get db() { return db; },
    get settings() { return db.settings; },
    get venues() { return db.venues || []; },
    get cart() { return db.cart || []; },
    list: list, get: get, add: add, put: put, del: del,
    ops: ops, sel: sel,
    subscribe: subscribe, emit: emit, batch: batch,
    today: today, addDays: addDays, dayDiff: dayDiff, parseDate: parse, isDate: isDate, isTime: isTime,
    mins: mins, hm: hm, monthLabel: monthLabel, MONTH_NAMES: MONTH_NAMES, fmtDate: fmtDate,
    tierName: tierName,
    KIND_ICON: KIND_ICON,
    reset: function () { db = fresh(); syncVenues(); persist(); emit('reset'); return db; }
  };

  rehydrate();
  return api;
})();

window.Store = Store;
