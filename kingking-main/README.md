# DinkHub

A pickleball court rental marketplace for Marawi City: players browse approved venues and send
booking requests, venue owners manage listings and decide on requests, and an administrator reviews
every venue before it goes public.

This is the **vanilla-JS port** of the original Django project. The design system, markup, class
names, copy and — most importantly — all transitions, reveal animations and counters are unchanged;
only the language and the wiring moved.

## What changed from the Django build

| Django original | This port |
| --- | --- |
| `.py` views, models, forms, templates | `server/*.js` JSON API + `public/js/**` page modules |
| Django ORM + SQLite via `manage.py` | `node:sqlite` (`DatabaseSync`) — same schema, same columns |
| `{% url %}` links, server-rendered pages | path router in `public/js/shell.js` with the **same URLs** |
| Django messages framework | `Store.flash()` + the same toast stack |
| CSRF token + multipart uploads | session cookie + JSON body, images as data URLs written to `media/` |
| `/admin/` site | removed — no equivalent in the port (the admin *dashboard page* is intact) |
| `npm install`, bundlers, frameworks | **nothing**: zero dependencies, ordered `<script>` tags |

The stylesheet `public/css/app.css` is a byte-for-byte copy of `static/css/style.css`.
`public/css/components.css` only adds rules for the handful of elements that did not exist in the
Django templates (modal, toast-stack helpers); it does not restyle anything.

## Requirements

Node.js **23.4 or newer** (24 LTS recommended) — `node:sqlite` works without a flag there.
On Node 22.5 – 23.3 start the server with `npm run start:legacy`, which passes `--experimental-sqlite`.
No Python, no `npm install`, no build step.

## Run it

```bash
node server/index.js            # http://localhost:3000  (creates and seeds dinkhub.sqlite3 on first run)
node server/index.js --seed     # wipe the demo rows and reseed
node server/index.js --port=8080
npm start                       # same as the first command
npm run dev                     # node --watch
```

The database file is `dinkhub.sqlite3` and uploads go to `media/`; both are created on boot.
`DINKHUB_DB`, `DINKHUB_MEDIA` and `PORT` override their defaults.

### Demo accounts

Seeded from the original `seed_demo.py` — password `DinkHub2026!` for all three.

| Username | Role | Dashboard |
| --- | --- | --- |
| `dinkadmin` | Administrator | `/dashboard/admin` |
| `owner_demo` | Venue owner | `/dashboard/owner` |
| `player_demo` | Player | `/dashboard/player` |

Three sample venues, their courts and a few bookings are seeded so browse, booking and the
dashboards all have data to show. The venue pages mark them with the original "Sample listing" badge.

## Layout

```
server/
  index.js        boot + static file serving + SPA fallback (manage.py runserver equivalent)
  http-kit.js     tiny router, JSON body parsing, cookie/session plumbing
  db.js           node:sqlite connection and the full CREATE TABLE schema
  models.js       the Django @property layer: rate_display, time_label, status_tone, ...
  clock.js        Asia/Manila today/now/weekday helpers used by the booking rules
  auth.js         scrypt password hashing, sessions, readSession()
  services/
    bookings.js   overlap checks, min notice, approve/reject/cancel transactions
  api/            accounts.js, venues.js, bookings.js, dashboard.js, pages.js
public/
  index.html      the single shell: sprite, #siteHeader, #main, #siteFooter, script tags
  css/app.css     DinkHub's design system, copied verbatim
  css/components.css   additive rules only
  js/
    icons.js data.js api.js store.js ui.js motion.js partials.js pages.js shell.js
    pages/       home, browse, venue, venueForm, booking, receipt, accounts, dashboards, info
```

Each page module registers itself with `Object.assign(PAGES, { ... })`, exactly like the
Pickleball codebase this port follows: one IIFE per file, plain string concatenation for markup,
`UI.esc()` on every dynamic value, and one delegated listener bound to the node it just rendered.

## Motion, kept on purpose

- `data-reveal` elements are observed by `IntersectionObserver` with the original
  `threshold: 0.12` and `rootMargin: '0px 0px -40px 0px'`, and `Motion.scan()` re-arms the
  observer after each route swap.
- The home stats still carry `data-count`, so the 1400 ms cubic count-up runs as before.
- The nav turns solid past `scrollY > 60`, the mobile drawer keeps its rAF open and the
  250 ms close, and toasts still fade on a 7 s timer.
- `prefers-reduced-motion` disables all of it, and each page does `window.scrollTo(0, 0)` on
  navigation because Django loaded a fresh page instead of animating between screens.

## Notes

- DinkHub does not take payments. Rates are entered by owners and an approved request is the
  confirmation; the fee is settled with the venue.
- `/developers` reads team identities from `team_members`, which the seed leaves empty on purpose —
  the page shows the original "No team members published yet" panel rather than inventing names.
