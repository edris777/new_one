/* ============================================================
   PickleMarawi — club data
   Every venue is pinned on a verified Marawi City (Lanao del
   Sur, Philippines) landmark, and the barangay label is the one
   OpenStreetMap / Nominatim reports for that coordinate.
   Venue names are club brands, not place names.
   ============================================================ */

const CLUB = {
  name: 'PickleMarawi',
  full: 'Marawi City Pickleball Club',
  city: 'Marawi City',
  province: 'Lanao del Sur',
  country: 'Philippines',
  lat: 8.0013,
  lng: 124.2845,
  tz: 'Asia/Manila (GMT+8)',
  founded: 2023,
  members: 593,
  courts: 24,
  phone: '+63 64 555 0143',
  email: 'play@piklemarawi.ph',
  address: 'Cadre Road, Brgy. Bito Buadi Parba, Marawi City, Lanao del Sur 9700'
};

/* ---------------- sidebar (icon rail) ---------------- */
const NAV = [
  { g: 'Play', items: [
    { id: 'dashboard',   label: 'Dashboard',        icon: 'home' },
    { id: 'courts',      label: 'Courts',           icon: 'court' },
    { id: 'booking',     label: 'Book a Court',     icon: 'calendar' },
    { id: 'schedule',    label: 'Schedule',         icon: 'clock' },
    { id: 'matches',     label: 'Matches',          icon: 'paddle' },
    { id: 'tournaments', label: 'Tournaments',      icon: 'trophy' },
    { id: 'leagues',     label: 'Leagues & Ladder', icon: 'ladder' }
  ]},
  { g: 'Club', items: [
    { id: 'members',    label: 'Players',        icon: 'users' },
    { id: 'rankings',   label: 'Rankings',       icon: 'medal' },
    { id: 'training',   label: 'Clinics',        icon: 'book' },
    { id: 'drills',     label: 'Daily Drills',   icon: 'dumbbell' },
    { id: 'library',    label: 'Shot Library',   icon: 'library' },
    { id: 'messages',   label: 'Messages',       icon: 'message', badge: 4 },
    { id: 'events',     label: 'Events',         icon: 'megaphone' },
    { id: 'notes',      label: 'Court Notes',    icon: 'notebook' }
  ]},
  { g: 'Marawi', items: [
    { id: 'map',     label: 'City Map',      icon: 'map-pin' },
    { id: 'tour',    label: 'Court Tour',    icon: 'video' },
    { id: 'venues',  label: 'Venues',        icon: 'globe' },
    { id: 'weather', label: 'Court Weather', icon: 'wind' }
  ]},
  { g: 'Business', items: [
    { id: 'payments',  label: 'Payments',  icon: 'wallet' },
    { id: 'proshop',   label: 'Pro Shop',  icon: 'cart' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
    { id: 'reports',   label: 'Reports',   icon: 'clipboard' }
  ]},
  { g: 'System', items: [
    { id: 'notifications', label: 'Notifications', icon: 'bell', badge: 0 },
    { id: 'settings',      label: 'Settings',      icon: 'settings' },
    { id: 'profile',       label: 'My Profile',    icon: 'user' },
    { id: 'help',          label: 'Help Centre',   icon: 'help' }
  ]}
];

/* top pill nav — mirrors the six tabs in the reference clip */
const TOP_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'courts',    label: 'Courts' },
  { id: 'members',   label: 'Players' },
  { id: 'booking',   label: 'Bookings' },
  { id: 'schedule',  label: 'Court Schedule' },
  { id: 'payments',  label: 'Payments' }
];

/* ---------------- venues around Marawi City ----------------
   lat/lng = verified landmark · barangay = OSM place for that point
   x/y = matching position on the stylised dashboard mini-map     */
const VENUES = [
  { id: 'v1', name: 'Ranao Lake Courts',      barangay: 'Patani',             courts: 6, indoor: true,  open: '05:00', close: '22:00', rating: 4.9, x: 735, y: 335, lat: 8.0059, lng: 124.3166, status: 'busy',   price: 120, note: 'Flagship club — 6 pro courts on the Lanao Lake shore' },
  { id: 'v2', name: 'MSU Marawi Center',      barangay: 'Bacong (MSU)',       courts: 4, indoor: true,  open: '06:00', close: '21:00', rating: 4.7, x: 230, y: 425, lat: 7.9968, lng: 124.2606, status: 'open',   price: 80,  note: 'Campus courts on Marawi Resort Drive, student rate applies' },
  { id: 'v3', name: 'Balindog Grand Courts',  barangay: 'Pangarungan Village',courts: 4, indoor: false, open: '05:30', close: '19:00', rating: 4.6, x: 527, y: 392, lat: 8.0006, lng: 124.2933, status: 'open',   price: 100, note: 'Beside the Jameo Grand Mosque, flood-lit night play' },
  { id: 'v4', name: 'Agus River Courts',      barangay: 'Matampay',           courts: 3, indoor: false, open: '06:00', close: '18:00', rating: 4.4, x: 556, y: 330, lat: 8.0051, lng: 124.2935, status: 'closed', price: 70,  note: 'Creekside decks at Mapandi Bridge, close in heavy rain' },
  { id: 'v5', name: 'Mapandi Community Court',barangay: 'Rorogagus',          courts: 2, indoor: false, open: '06:00', close: '20:00', rating: 4.3, x: 500, y: 292, lat: 8.0073, lng: 124.2919, status: 'busy',   price: 60,  note: 'Free beginner sessions every Saturday' },
  { id: 'v6', name: 'Lamai Riverside Courts', barangay: 'Bito Buadi Itowa',   courts: 3, indoor: false, open: '05:00', close: '19:30', rating: 4.5, x: 361, y: 201, lat: 8.0186, lng: 124.2751, status: 'open',   price: 90,  note: 'North-west terraces, best light before 08:00' },
  { id: 'v7', name: 'Madayaan Hilltop',       barangay: 'Mipaga Proper',      courts: 2, indoor: true,  open: '07:00', close: '21:00', rating: 4.2, x: 387, y: 115, lat: 8.0268, lng: 124.2780, status: 'open',   price: 110, note: 'City limit terraces toward Bubong, coolest air in Marawi' },
  { id: 'v8', name: 'Buntong Market Courts',  barangay: 'Barrio Green',       courts: 0, indoor: false, open: '—',     close: '—',     rating: 0,   x: 434, y: 383, lat: 8.0013, lng: 124.2845, status: 'soon',   price: 0,   note: 'Opening February 2027 — 4 decks above the Barrio Market' }
];

/* ---------------- programs (mirrors the 3 pastel course cards) ---------------- */
const PROGRAMS = [
  { id: 'p1', tone: 't-lilac', title: 'Dink Like a Pro',
    desc: 'Control the soft game at the kitchen line with patient third-shot drops.',
    date: '27 Apr 2026', level: 'Intermediate', coaches: ['FA', 'SP'], spots: 8, enrolled: 6, icon: 'target' },
  { id: 'p2', tone: 't-sky', title: 'Master the Basics',
    desc: 'Build a strong foundation with essential serves, footwork and scoring.',
    date: '30 Apr 2026', level: 'Beginner', coaches: ['MA', 'JD'], spots: 12, enrolled: 11, icon: 'book' },
  { id: 'p3', tone: 't-mint', title: 'Reset & Recover',
    desc: 'Learn the reset drop, defensive stacking and how to turn a lost point around.',
    date: '05 May 2026', level: 'Advanced', coaches: ['AB', 'RS'], spots: 6, enrolled: 4, icon: 'shield' },
  { id: 'p4', tone: 't-peach', title: 'Around The Post Attack',
    desc: 'Set up and finish ATPs, speedups and put-aways with clean paddle angles.',
    date: '12 May 2026', level: 'Advanced', coaches: ['SP'], spots: 8, enrolled: 3, icon: 'zap' }
];

/* ---------------- daily drills (mirrors "Homework") ---------------- */
const DRILLS = [
  { title: 'Hit 30 consecutive dinks',        sub: 'Kitchen line · Ranao Lake C3', pct: 55, icon: 'target' },
  { title: 'Do 1 serve-return set (12 pts)',  sub: 'Baseline · MSU Center C1',     pct: 39, icon: 'refresh' },
  { title: 'Watch: Third-Shot Drop clinic',   sub: '12 min · Coach Fatima',        pct: 27, icon: 'video' },
  { title: 'Review footwork ladder drill',    sub: 'Recovery steps · 8 reps',      pct: 68, icon: 'activity' },
  { title: 'Log today’s match score',         sub: 'Doubles · Partner Abdul',      pct: 12, icon: 'clipboard' }
];

/* ---------------- leaderboard (mirrors "Friends Score") ---------------- */
const LEADERS = [
  { name: 'Amina Mangunsong', sub: 'Ranao Lake · 3.8 rating', score: 9596, ini: 'AM', tone: '#6b7cff', delta: '+120' },
  { name: 'Josef Alonto',     sub: 'MSU Center · 3.6 rating', score: 8770, ini: 'JA', tone: '#2fb37c', delta: '+64'  },
  { name: 'Soraya Macarambon',sub: 'Lamai · 3.5 rating',      score: 7786, ini: 'SM', tone: '#e0607e', delta: '-18'  },
  { name: 'Emil Cadar',       sub: 'Balindog · 3.4 rating',   score: 6472, ini: 'EC', tone: '#f4a036', delta: '+202' },
  { name: 'Fatima Pangandaman',sub: 'Madayaan · 3.3 rating',  score: 5890, ini: 'FP', tone: '#8b7cf6', delta: '+41'  }
];

/* ---------------- members ---------------- */
const MEMBERS = [
  { name: 'Amina Mangunsong', ini: 'AM', tone: '#6b7cff', level: 3.8, play: 'Doubles', venue: 'Ranao Lake', pts: 9596, streak: 14, status: 'Gold' },
  { name: 'Josef Alonto',     ini: 'JA', tone: '#2fb37c', level: 3.6, play: 'Singles', venue: 'MSU Center', pts: 8770, streak: 9,  status: 'Gold' },
  { name: 'Soraya Macarambon',ini: 'SM', tone: '#e0607e', level: 3.5, play: 'Mixed',   venue: 'Lamai',      pts: 7786, streak: 6,  status: 'Silver' },
  { name: 'Emil Cadar',       ini: 'EC', tone: '#f4a036', level: 3.4, play: 'Doubles', venue: 'Balindog',   pts: 6472, streak: 11, status: 'Silver' },
  { name: 'Fatima Pangandaman',ini:'FP', tone: '#8b7cf6', level: 3.3, play: 'Singles', venue: 'Madayaan',   pts: 5890, streak: 4,  status: 'Silver' },
  { name: 'Abdul Dimalantan', ini: 'AD', tone: '#3aa9e0', level: 3.2, play: 'Doubles', venue: 'Ranao Lake', pts: 5310, streak: 7,  status: 'Bronze' },
  { name: 'Marites Usman',    ini: 'MU', tone: '#d9649c', level: 3.1, play: 'Mixed',   venue: 'Pantar',     pts: 4865, streak: 2,  status: 'Bronze' },
  { name: 'Sharif Bagalsan',  ini: 'SB', tone: '#5f7ae0', level: 3.0, play: 'Singles', venue: 'MSU Center', pts: 4420, streak: 5,  status: 'Bronze' },
  { name: 'Norma Marohom',    ini: 'NM', tone: '#c98a3c', level: 2.8, play: 'Doubles', venue: 'Lamai',      pts: 3980, streak: 3,  status: 'Starter' },
  { name: 'Yasmien Ampuan',   ini: 'YA', tone: '#2fb37c', level: 2.7, play: 'Mixed',   venue: 'Balindog',   pts: 3610, streak: 8,  status: 'Starter' }
];

/* ---------------- matches ---------------- */
const MATCHES = [
  { round: 'Ranao League · MD', a: 'Amina / Soraya', b: 'Josef / Emil',  time: 'Today 16:30', court: 'Ranao Lake C2', state: 'live',    score: '9 – 7' },
  { round: 'Ranao League · WD', a: 'Fatima / Marites', b: 'Yasmien / Norma', time: 'Today 18:00', court: 'Ranao Lake C1', state: 'soon', score: '—' },
  { round: 'Marawi Open · QF',  a: 'Abdul / Sharif',   b: 'Rico / Dan',   time: 'Tomorrow 07:00', court: 'MSU C3', state: 'upcoming', score: '—' },
  { round: 'Ladder Div. 2',     a: 'Emil / Rico',      b: 'Sharif / Toto',time: 'Yesterday 17:00', court: 'Balindog C2', state: 'done', score: '11 – 8' },
  { round: 'Beginner Mixer',    a: 'Norma / Kim',      b: 'Yasmien / Ana',time: 'Yesterday 15:30', court: 'Mapandi C1', state: 'done',  score: '11 – 5' }
];

const LEAGUES = [
  { name: 'Ranao Lake League',    div: 'Division 1 · Mixed Doubles', teams: 16, played: 42, ends: 'Nov 28, 2026', pot: 45000, tone: 't-lilac' },
  { name: 'MSU Collegiate Cup',   div: 'Division 2 · Men’s Doubles', teams: 24, played: 61, ends: 'Dec 12, 2026', pot: 28000, tone: 't-sky' },
  { name: 'Agus River Singles',   div: 'Open · Singles',             teams: 32, played: 88, ends: 'Nov 15, 2026', pot: 36000, tone: 't-mint' },
  { name: 'Buntong Winter Ladder',div: 'Social · Doubles',           teams: 40, played: 12, ends: 'Jan 30, 2027', pot: 15000, tone: 't-peach' }
];

/* ---------------- court notes (mirrors "Meeting Notes") ---------------- */
const NOTES = [
  { when: '2h ago', title: 'Brainstorming doubles rotation for the Ranao League final', tag: 'League', tone: '#ef4b56' },
  { when: '5h ago', title: 'Resurface C3 — crack near the left sideline', tag: 'Maintenance', tone: '#f4a036' },
  { when: 'Yesterday', title: 'New ball quota: 4 jugs ordered for Saturday clinic', tag: 'Pro Shop', tone: '#6b7cff' },
  { when: '2d ago', title: 'Rain cover requested for Agus River decks', tag: 'Venues', tone: '#2fb37c' }
];

/* ---------------- integrations (mirrors "Integrations Tools") ---------------- */
const INTEGRATIONS = [
  { name: 'WhatsApp', icon: 'phone',   badge: 30 },
  { name: 'Telegram', icon: 'navigation', badge: 45 },
  { name: 'Discord',  icon: 'chat',    badge: 4 },
  { name: 'GCash',    icon: 'wallet',  badge: 0 },
  { name: 'Email',    icon: 'mail',    badge: 0 }
];

/* ---------------- pro shop ---------------- */
const SHOP = [
  { name: 'Fiberline 16mm Control Paddle', cat: 'Paddles', price: 6450, stock: 18, rating: 4.8, tone: 't-lilac', icon: 'paddle' },
  { name: 'Ranao Lake Pickleballs (4-pack)', cat: 'Balls', price: 520, stock: 96, rating: 4.7, tone: 't-mint', icon: 'ball' },
  { name: 'Agus Court Shoes — Men', cat: 'Footwear', price: 3180, stock: 24, rating: 4.6, tone: 't-sky', icon: 'hand' },
  { name: 'Marawi Kitchen-Line Paddle Cover', cat: 'Gear', price: 890, stock: 41, rating: 4.4, tone: 't-peach', icon: 'shield' },
  { name: 'Lanao Performance Polo', cat: 'Apparel', price: 1450, stock: 33, rating: 4.5, tone: 't-rose', icon: 'star' },
  { name: 'Portable Net System 6.6m', cat: 'Courts', price: 18900, stock: 5, rating: 4.9, tone: 't-sun', icon: 'court' },
  { name: 'Grip Enhancer Towel', cat: 'Gear', price: 340, stock: 120, rating: 4.2, tone: 't-sky', icon: 'droplet' },
  { name: 'Court Side Ball Caddy', cat: 'Courts', price: 2750, stock: 9, rating: 4.6, tone: 't-lilac', icon: 'box' }
];

/* ---------------- payments ---------------- */
const PAYMENTS = [
  { id: 'INV-2041', who: 'Amina Mangunsong', item: 'Gold membership · Q4', amount: 4500, method: 'GCash',  state: 'Paid',      date: '01 Nov 2026' },
  { id: 'INV-2040', who: 'Josef Alonto',     item: 'Court booking · 2h',   amount: 240,  method: 'Cash',   state: 'Paid',      date: '01 Nov 2026' },
  { id: 'INV-2039', who: 'MSU Team',         item: 'Collegiate Cup entry', amount: 3200, method: 'Bank',   state: 'Pending',   date: '31 Oct 2026' },
  { id: 'INV-2038', who: 'Soraya Macarambon',item: 'Pro shop · paddle',    amount: 6450, method: 'Card',   state: 'Paid',      date: '30 Oct 2026' },
  { id: 'INV-2037', who: 'Balindog CC',      item: 'Venue rental · Sat',   amount: 1800, method: 'GCash',  state: 'Overdue',   date: '28 Oct 2026' },
  { id: 'INV-2036', who: 'Emil Cadar',       item: 'Ladder registration',  amount: 750,  method: 'GCash',  state: 'Paid',      date: '27 Oct 2026' }
];

/* ---------------- events ---------------- */
const EVENTS = [
  { date: '08 Nov', title: 'Marawi Open 2026 — Main Draw', venue: 'Ranao Lake Courts', kind: 'Tournament', tone: 't-lilac', spots: 12 },
  { date: '12 Nov', title: 'Sunrise Doubles Social',        venue: 'Lamai Riverside',   kind: 'Social',     tone: 't-mint',  spots: 24 },
  { date: '16 Nov', title: 'Kids Clinic (ages 9–14)',       venue: 'Mapandi Community', kind: 'Training',   tone: 't-sky',   spots: 6 },
  { date: '22 Nov', title: 'League Finals + Watch Party',   venue: 'MSU Center',        kind: 'League',     tone: 't-peach', spots: 80 },
  { date: '29 Nov', title: 'Lanao Lake Cleanup Drive',      venue: 'Agus River Deck',   kind: 'Community',  tone: 't-rose',  spots: 40 }
];

/* ---------------- messages ---------------- */
const THREADS = [
  { who: 'Ranao League Captains', ini: 'RL', tone: '#6b7cff', last: 'Draw sheet is up — check your slot.', time: '2m',  unread: 6 },
  { who: 'Coach Fatima',          ini: 'FA', tone: '#2fb37c', last: 'Bring 4-ball jugs Saturday.',        time: '24m', unread: 2 },
  { who: 'Court Maintenance',     ini: 'CM', tone: '#f4a036', last: 'C3 resurface done, line repainted.', time: '1h',  unread: 0 },
  { who: 'Abdul Dimalantan',      ini: 'AD', tone: '#e0607e', last: 'Rematch tomorrow 6AM?',              time: '3h',  unread: 1 },
  { who: 'Pro Shop',              ini: 'PS', tone: '#8b7cf6', last: 'Your paddle is ready to pick up.',   time: '5h',  unread: 0 }
];

/* ---------------- notifications ---------------- */
const NOTIFS = [
  { kind: 'match',  text: 'Amina / Soraya vs Josef / Emil starts in 40 min — Ranao Lake C2', time: '2m',  unread: true },
  { kind: 'book',   text: 'Booking confirmed: MSU Center C1, tomorrow 07:00', time: '18m', unread: true },
  { kind: 'rank',   text: 'You climbed 3 places on the Marawi ladder (now #7)', time: '1h', unread: true },
  { kind: 'pay',    text: 'Invoice INV-2037 is overdue — Balindog CC', time: '3h', unread: true },
  { kind: 'event',  text: 'Marawi Open 2026 registration closes Friday', time: '6h', unread: false },
  { kind: 'weather',text: 'Rain expected 15:00 over Lanao — river courts may close', time: '8h', unread: true },
  { kind: 'shop',   text: 'Restock: Ranao Lake Pickleballs (96 units)', time: '1d', unread: true },
  { kind: 'club',   text: 'Welcome 12 new members from Buntong this month', time: '1d', unread: false }
];

/* ---------------- shot library (mirrors "Word library") ---------------- */
const SHOTS = [
  { term: 'Kitchen',    kind: 'Zone',    def: 'The 7-foot non-volley area on both sides of the net.', tone: 'w-lilac' },
  { term: 'Dink',       kind: 'Shot',    def: 'A soft shot that lands in the opponent’s kitchen.', tone: 'w-mint' },
  { term: 'Erne',       kind: 'Shot',    def: 'Attacking around the non-volley zone from outside it.', tone: 'w-sky' },
  { term: 'Reset',      kind: 'Shot',    def: 'A high soft drop used to regain the net from defence.', tone: 'w-peach' },
  { term: 'ATP',        kind: 'Shot',    def: 'Around The Post — the ball returns around the net post.', tone: 'w-rose' },
  { term: 'Volley',     kind: 'Shot',    def: 'Striking the ball before it bounces, in the air.', tone: 'w-sun' },
  { term: 'Third Shot', kind: 'Shot',    def: 'The drop that gets the serving team to the kitchen.', tone: 'w-lilac' },
  { term: 'Speedup',    kind: 'Shot',    def: 'A sudden flat drive from the kitchen line.', tone: 'w-mint' },
  { term: 'Stacking',   kind: 'Tactic',  def: 'Partners start on one side, then split to their strong halves.', tone: 'w-sky' },
  { term: 'Banger',     kind: 'Style',   def: 'Power-first play built on hard drives and put-aways.', tone: 'w-peach' },
  { term: 'Nasty Nick', kind: 'Shot',    def: 'A ball that clips the net and drops unpredictably.', tone: 'w-rose' },
  { term: 'Sideline',   kind: 'Rule',    def: 'Out if it lands wholly outside the boundary line.', tone: 'w-sun' }
];

/* ---------------- weather across the week ---------------- */
const WEATHER = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  high:   [30, 31, 29, 28, 30, 31, 32],
  low:    [21, 22, 21, 20, 21, 22, 23],
  rain:   [10, 5, 35, 70, 45, 15, 5],
  today:  { temp: 29, cond: 'Partly cloudy over Lanao', wind: 11, hum: 74, uv: 7, air: 32 }
};

/* ---------------- analytics ---------------- */
const COURT_USE = [
  { name: 'Ranao Lake C1', hrs: 186 }, { name: 'Ranao Lake C2', hrs: 174 },
  { name: 'MSU Center C1', hrs: 158 }, { name: 'Balindog C1',   hrs: 141 },
  { name: 'Lamai C2',      hrs: 128 }, { name: 'Mapandi C1',    hrs: 96 },
  { name: 'Agus River C1', hrs: 74 }
];

const LEVEL_SPLIT = [
  { name: '3.5+', value: 148, color: '#6b7cff' },
  { name: '3.0–3.4', value: 212, color: '#2fb37c' },
  { name: '2.5–2.9', value: 156, color: '#f4a036' },
  { name: 'Under 2.5', value: 77, color: '#e0607e' }
];

/* ---------------- helpers ---------------- */
const nf = new Intl.NumberFormat('en-PH');
const money = n => '₱' + nf.format(n);
const initials = name => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

function dayStrip(count) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i - 2);
    out.push({
      label: d.toLocaleDateString('en-PH', { weekday: 'short' }) + ', ' + d.getDate(),
      isToday: i === 2,
      date: d
    });
  }
  return out;
}

function monthLabel() {
  return new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

/* ============================================================
   Court Tour — the Mapinlay-style cinematic waypoint tour
   over real Marawi City satellite imagery.
   ============================================================ */
const TOUR = {
  name: 'demo',
  heading: 'The City on the Lake',
  sub: 'Marawi · Lanao del Sur',
  waypoints: [
    { id: 'w1', venue: 'v1', title: 'The Journey Begins', sub: 'Ranao Lake Courts · Brgy. Patani',
      heading: 'THE FLAGSHIP DECK', caption: 'Six pro courts on the shore of Lanao Lake',
      media: [{ src: 'img/tour-1.png', shape: 'circle' }],
      cam: { lng: 124.3166, lat: 8.0059, zoom: 15.6, bearing: -28, pitch: 64 }, secs: 6 },
    { id: 'w2', venue: 'v6', title: 'Sunrise on the Terraces', sub: 'Lamai Riverside Courts · Bito Buadi Itowa',
      heading: 'SUNRISE WINDOW', caption: 'Best light over the north-west ridges is 05:30 – 08:00',
      media: [{ src: 'img/tour-2.png', shape: 'card' }],
      cam: { lng: 124.2751, lat: 8.0186, zoom: 15.9, bearing: 42, pitch: 58 }, secs: 6 },
    { id: 'w3', venue: 'v2', title: 'The University Kings', sub: 'MSU Marawi Center · Bacong',
      heading: 'CAMPUS COURTS', caption: 'Four indoor decks on Marawi Resort Drive',
      media: [{ src: 'img/tour-3.png', shape: 'circle' }],
      cam: { lng: 124.2606, lat: 7.9968, zoom: 15.7, bearing: 112, pitch: 61 }, secs: 6 },
    { id: 'w4', venue: 'v5', title: 'First Racket', sub: 'Mapandi Community · Rorogagus',
      heading: 'FREE SATURDAYS', caption: 'Beginner clinic every Saturday, 06:00',
      media: [{ src: 'img/tour-3.png', shape: 'card' }],
      cam: { lng: 124.2919, lat: 8.0073, zoom: 16.2, bearing: -74, pitch: 55 }, secs: 6 },
    { id: 'w5', venue: 'v3', title: 'Floodlit Until Seven', sub: 'Balindog Grand Courts · Pangarungan',
      heading: 'NIGHT PLAY', caption: 'Four decks under the lights beside the Jameo Mosque',
      media: [{ src: 'img/tour-1.png', shape: 'circle' }],
      cam: { lng: 124.2933, lat: 8.0006, zoom: 15.8, bearing: 168, pitch: 60 }, secs: 6 },
    { id: 'w6', venue: 'v7', title: 'The Coolest Air', sub: 'Madayaan Hilltop · Mipaga Proper',
      heading: 'HILLTOP DECKS', caption: 'Two indoor courts at the Bubong city limit',
      media: [],
      cam: { lng: 124.2780, lat: 8.0268, zoom: 15.4, bearing: 24, pitch: 66 }, secs: 6 },
    { id: 'w7', venue: 'v4', title: 'Where the Water Runs', sub: 'Agus River Courts · Matampay',
      heading: 'WATERSIDE', caption: 'The crossing decides — decks close above 60% rain',
      media: [{ src: 'img/tour-2.png', shape: 'circle' }],
      cam: { lng: 124.2935, lat: 8.0051, zoom: 15.5, bearing: -140, pitch: 62 }, secs: 6 },
    { id: 'w8', venue: 'v8', title: 'Next Stop: Barrio Market', sub: 'Buntong Market Courts · Barrio Green',
      heading: 'COMING FEBRUARY 2027', caption: 'Four decks framed above the Barrio Market on Cadre Road',
      media: [],
      cam: { lng: 124.2845, lat: 8.0013, zoom: 16.0, bearing: 88, pitch: 57 }, secs: 6 }
  ]
};

/* ============================================================
   Live city map — the dispatch feed shown under the Marawi
   command map: code, kind, priority, coords, status, venue,
   responder, elapsed.
   ============================================================ */
const MAP_FEED = [
  { code: 'BK-20261103-0114', kind: 'Booking',   prio: 'Low',      lat: 8.0059, lng: 124.3166, status: 'Confirmed', venue: 'Ranao Lake Courts',       responder: 'Desk · Ana D.',  mins: 4 },
  { code: 'BK-20261103-0113', kind: 'Booking',   prio: 'Low',      lat: 8.0073, lng: 124.2919, status: 'Active',    venue: 'Mapandi Community Court', responder: 'Coach Farid',    mins: 12 },
  { code: 'WT-20261103-0031', kind: 'Waitlist',  prio: 'Medium',   lat: 7.9968, lng: 124.2606, status: 'Held',      venue: 'MSU Marawi Center',       responder: 'Desk · Ana D.',  mins: 21 },
  { code: 'CN-20261103-0007', kind: 'Closure',   prio: 'High',     lat: 8.0051, lng: 124.2935, status: 'Closed',    venue: 'Agus River Courts',       responder: 'Grounds · Yusa', mins: 38 },
  { code: 'CL-20261103-0002', kind: 'Clinic',    prio: 'Medium',   lat: 8.0268, lng: 124.2780, status: 'Running',   venue: 'Madayaan Hilltop',        responder: 'Coach Aisyah',   mins: 55 },
  { code: 'BK-20261103-0102', kind: 'Booking',   prio: 'Low',      lat: 8.0186, lng: 124.2751, status: 'Resolved',  venue: 'Lamai Riverside Courts',  responder: 'Desk · Menad',   mins: 74 },
  { code: 'MT-20261103-0009', kind: 'Match',     prio: 'High',     lat: 8.0006, lng: 124.2933, status: 'Running',   venue: 'Balindog Grand Courts',   responder: 'Ref · Lala',     mins: 96 },
  { code: 'NP-20261103-0001', kind: 'New venue', prio: 'Critical', lat: 8.0013, lng: 124.2845, status: 'Planned',   venue: 'Buntong Market Courts',   responder: 'Ops · Sultan',   mins: 130 }
];
