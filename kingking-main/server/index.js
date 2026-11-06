/* ============================================================
   DinkHub server — `manage.py runserver`, ported to Node
     node server/index.js              start (seeds on first run)
     node server/index.js --seed       wipe demo rows and reseed
     node server/index.js --port=8080  choose a port
   No dependencies: node:http + node:sqlite only.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const store = require('./db');
const auth = require('./auth');
const kit = require('./http-kit');
const clock = require('./clock');
const seed = require('./seed');

const api = kit.Router();
require('./api/accounts').attach(api);
require('./api/venues').attach(api);
require('./api/bookings').attach(api);
require('./api/dashboard').attach(api);
require('./api/pages').attach(api);

/* ----- boot: create tables, then seed when the database is brand new ----- */
store.open();
if (process.argv.includes('--seed') || !store.scalar('SELECT COUNT(*) FROM users')) {
  seed.run({ reset: process.argv.includes('--seed') });
}
if (process.argv.includes('--seed-only')) process.exit(0);

/* Django rendered every page server-side; the port serves one shell and lets
   public/js/shell.js route, so unknown GET paths fall back to index.html. */
const SHELL = path.join(cfg.PUBLIC_DIR, 'index.html');
if (!fs.existsSync(SHELL)) {
  console.error('public/index.html is missing — run this from the project root.');
  process.exit(1);
}

function session(req, res, next) {
  req.user = auth.readSession(req);
  next();
}

const statics = kit.staticServer([
  { dir: cfg.PUBLIC_DIR, prefix: '/' },
  { dir: cfg.UPLOAD_DIR, prefix: cfg.MEDIA_URL },
  { dir: cfg.PICKLEBALL_DIR, prefix: '/pickleball' }
]);

const portFlag = process.argv.find(a => a.indexOf('--port=') === 0);
const PORT = portFlag ? Number(portFlag.split('=')[1]) : cfg.PORT;

if (require.main === module) {
  kit.serve(api, [session], { statics: statics, shell: SHELL }).listen(PORT, () => {
    const counts = {
      venues: store.scalar('SELECT COUNT(*) FROM venues'),
      courts: store.scalar('SELECT COUNT(*) FROM courts'),
      bookings: store.scalar('SELECT COUNT(*) FROM bookings')
    };
    process.stdout.write(
      '\n  DinkHub is running  ->  http://localhost:' + PORT + '\n' +
      '  Pickleball club   ->  http://localhost:' + PORT + '/pickleball/\n' +
      '  Clock ' + clock.today() + ' ' + clock.nowTime() + ' (Asia/Manila)\n' +
      '  ' + counts.venues + ' venues / ' + counts.courts + ' courts / ' + counts.bookings + ' bookings\n' +
      '  Demo accounts: dinkadmin, owner_demo, player_demo  -  password DinkHub2026!\n\n');
  });
}

module.exports = api;
