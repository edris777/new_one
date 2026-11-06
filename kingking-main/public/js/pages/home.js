/* ============================================================
   Home — templates/pages/home.html
   Every section, class name, data-reveal flag and inline --delay is
   copied from the Django template, so the reveal stagger, the
   count-up statistics and the pulse/scroll-dot animations run exactly
   as before. Only the {% static %} and {% url %} tags become paths.
   ============================================================ */

(function () {
  const esc = UI.esc;

  Object.assign(PAGES, {
  home: {
    render(host) {
      return Api.get('/api/home').then(data => {
        host.innerHTML = [
          hero(),
          searchCard(data),
          about(),
          services(),
          featured(data.featured_venues),
          locations(data.locations),
          stats(data.stats),
          voices(data.testimonials),
          guides(),
          ownerCta(),
          faq(data.faqs)
        ].join('');

        host.querySelector('[data-search-form]').addEventListener('submit', event => {
          event.preventDefault();
          const values = UI.readForm(event.target);
          const params = new URLSearchParams();
          if (values.city) params.set('city', values.city);
          if (values.date) params.set('date', values.date);
          if (values.setting) params.set('setting', values.setting);
          const tail = params.toString();
          go('/courts' + (tail ? '/?' + tail : ''));
        });
      });
    }
  }
});

function hero() {
  return '<section class="hero">' +
    '<div class="hero__bg">' +
      '<img src="/img/hero-court.jpg" alt="Outdoor pickleball courts at golden hour in Marawi City">' +
    '</div>' +
    '<div class="hero__inner shell">' +
      '<p class="hero__eyebrow" data-reveal><span class="pulse"></span>' +
        'Pickleball court booking · Marawi City, Lanao del Sur</p>' +
      '<h1 class="hero__title" data-reveal style="--delay:.08s">' +
        'Find your court.<br><span class="scribble">Book your game.</span></h1>' +
      '<p class="hero__sub" data-reveal style="--delay:.16s">' +
        'Real courts across Marawi and nearby towns. Pick a slot, send a request,' +
        ' and play once the venue owner approves it.</p>' +
      '<div class="hero__actions" data-reveal style="--delay:.24s">' +
        '<a class="btn btn--light" href="/courts">Browse courts' +
          '<span class="btn__orb btn__orb--dark">' + icon('arrow-up-right') + '</span></a>' +
        '<a class="btn btn--glass" href="/courts/new">List your court</a>' +
      '</div>' +
      '<ul class="hero__meta" data-reveal style="--delay:.3s">' +
        '<li>' + icon('shield') + ' Admin-reviewed listings</li>' +
        '<li>' + icon('clock') + ' Owner-approved slots</li>' +
        '<li>' + icon('check') + ' No online payment required</li>' +
      '</ul>' +
    '</div>' +
    '<div class="hero__scroll" aria-hidden="true"><span></span></div>' +
  '</section>';
}

function searchCard(data) {
  const options = ['Marawi City'].concat((data.locations || []).map(place => place.city))
    .filter((city, index, all) => all.indexOf(city) === index)
    .map(city => '<option value="' + UI.esc(city) + '"></option>').join('');

  return '<section class="search-wrap"><div class="shell">' +
    '<form class="search-card" data-search-form role="search" data-reveal>' +
      '<div class="search-field">' +
        '<span class="search-field__ico">' + icon('pin') + '</span>' +
        '<div class="search-field__body">' +
          '<label for="searchCity">Location</label>' +
          '<input id="searchCity" name="city" list="cityOptions" placeholder="Marawi City" autocomplete="off">' +
          '<datalist id="cityOptions">' + options + '</datalist>' +
        '</div>' +
      '</div>' +
      '<div class="search-field">' +
        '<span class="search-field__ico">' + icon('calendar') + '</span>' +
        '<div class="search-field__body">' +
          '<label for="searchDate">Play date</label>' +
          '<input id="searchDate" type="date" name="date" min="' + esc(data.today) +
            '" max="' + esc(data.max_date) + '">' +
        '</div>' +
      '</div>' +
      '<div class="search-field">' +
        '<span class="search-field__ico">' + icon('paddle') + '</span>' +
        '<div class="search-field__body">' +
          '<label for="searchSetting">Court type</label>' +
          '<select id="searchSetting" name="setting">' +
            '<option value="">Indoor or outdoor</option>' +
            '<option value="indoor">Indoor courts</option>' +
            '<option value="outdoor">Outdoor courts</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn--dark search-card__btn" type="submit">Search courts' +
        '<span class="btn__orb">' + icon('search') + '</span></button>' +
    '</form></div></section>';
}

function about() {
  return '<section class="section about" id="about">' +
    '<div class="shell about__grid">' +
      '<div class="about__text" data-reveal>' +
        '<p class="eyebrow">Who we are</p>' +
        '<h2 class="h2">A local home court for <span class="accent">every player</span> in Marawi.</h2>' +
        '<p class="lead">DinkHub connects players with independent court owners around Marawi City.' +
          ' Every listing is submitted by its owner and reviewed by an administrator before it appears' +
          ' here — no made-up venues, no fake availability.</p>' +
        '<div class="about__card"><div>' +
          '<p class="about__card-eyebrow">Ready to play?</p>' +
          '<p class="about__card-title">Find a court near you and send a request in under a minute.</p>' +
        '</div>' +
        '<a class="btn btn--light btn--sm" href="/courts">Explore courts' +
          '<span class="btn__orb btn__orb--dark">' + icon('arrow-up-right') + '</span></a></div>' +
      '</div>' +
      '<div class="about__media" data-reveal style="--delay:.1s">' +
        '<figure class="arch arch--tall">' +
          '<img src="/img/about-players.jpg" alt="Two players rallying on a pickleball court" loading="lazy">' +
        '</figure>' +
        '<div class="about__note">' +
          '<span class="about__note-ico">' + icon('shield') + '</span>' +
          '<div><strong>Verified only</strong><p>Listings must pass review before going live.</p></div>' +
        '</div>' +
      '</div>' +
    '</div></section>';
}

const SERVICE_CARDS = [
  { num: '01', href: '/courts', image: 'img/court-outdoor.jpg', alt: 'Outdoor pickleball court',
    title: 'Discover courts', copy: 'Search by city, court type, and facilities across Marawi.', cta: 'Browse' },
  { num: '02', href: '/how-it-works', image: 'img/court-indoor.jpg', alt: 'Indoor pickleball courts',
    title: 'Request a booking', copy: 'Choose a date and time, then send a request to the owner.', cta: 'How it works' },
  { num: '03', href: '/dashboard', image: 'img/court-rooftop.jpg', alt: 'Covered rooftop pickleball court at dusk',
    title: 'Manage reservations', copy: 'Track pending, approved, and cancelled games in one place.', cta: 'Dashboard' },
  { num: '04', href: '/courts/new', image: 'img/owner-cta.jpg', alt: 'Empty pickleball court at sunrise',
    title: 'List your venue', copy: 'Publish courts, rates, and schedules, then manage requests.', cta: 'For owners' }
];

function services() {
  const delays = ['', '.06s', '.12s', '.18s'];
  return '<section class="section services"><div class="shell">' +
    '<header class="section-head section-head--split" data-reveal><div>' +
      '<p class="eyebrow">What DinkHub does</p>' +
      '<h2 class="h2">Everything you need to get on court</h2></div>' +
      '<p class="section-head__sub">From finding a court you can trust to keeping your reservations' +
        ' organised — built for players and for the people who run the courts.</p></header>' +
    '<div class="service-grid">' +
      SERVICE_CARDS.map((card, i) =>
        '<a class="service-card" href="' + esc(card.href) + '" data-reveal' +
          (delays[i] ? ' style="--delay:' + delays[i] + '"' : '') + '>' +
          '<img src="/' + card.image + '" alt="' + esc(card.alt) + '" loading="lazy">' +
          '<div class="service-card__overlay"></div>' +
          '<div class="service-card__body">' +
            '<span class="service-card__num">' + card.num + '</span>' +
            '<h3>' + esc(card.title) + '</h3><p>' + esc(card.copy) + '</p>' +
            '<span class="service-card__cta">' + esc(card.cta) + ' ' + icon('arrow-up-right') + '</span>' +
          '</div></a>').join('') +
    '</div></div></section>';
}

function featured(venues) {
  const body = (venues || []).length
    ? UI.courtGrid(venues, { limit: 3, stagger: true })
    : UI.emptyPanel('paddle', 'No approved venues yet',
        'DinkHub only shows listings that an administrator has reviewed. If you own a court in' +
        ' Marawi City, you can be the first listing.',
        '<a class="btn btn--dark" href="/courts/new">List your court</a>');

  return '<section class="section featured" id="featured"><div class="shell">' +
    '<header class="section-head section-head--split" data-reveal><div>' +
      '<p class="eyebrow">Featured listings</p><h2 class="h2">Courts near you</h2></div>' +
      '<a class="link-pill" href="/courts">View all courts ' + icon('arrow-right') + '</a></header>' +
    body + '</div></section>';
}

function locations(places) {
  if (!places || !places.length) return '';
  return '<section class="section locations"><div class="shell">' +
    '<header class="section-head section-head--center" data-reveal>' +
      '<p class="eyebrow">Where we play</p><h2 class="h2">Explore playing locations</h2>' +
      '<p class="section-head__sub">Location filters, not claims. Each city below appears because' +
        ' an approved venue is listed there.</p></header>' +
    '<div class="location-row">' + places.map((place, i) =>
      '<a class="location-card" href="/courts?city=' + encodeURIComponent(place.city) +
        '" data-reveal style="--delay:' + (i * 10) + 'ms">' +
        '<span class="location-card__ico">' + icon('pin') + '</span>' +
        '<span class="location-card__name">' + esc(place.city) + '</span>' +
        '<span class="location-card__meta">' + place.total + ' venue' + (place.total === 1 ? '' : 's') + '</span>' +
        icon('arrow-up-right', 'location-card__arrow') +
      '</a>').join('') +
    '</div></div></section>';
}

function stats(items) {
  if (!items || !items.length) return '';
  return '<section class="stats"><div class="shell">' +
    '<div class="stats__grid">' + UI.statBand(items) + '</div>' +
    '<p class="stats__note">Counted live from DinkHub records — nothing here is a placeholder figure.</p>' +
    '</div></section>';
}

function voices(testimonials) {
  const list = testimonials || [];
  const head = list.length
    ? { title: 'Loved by local players, recommended across Marawi',
        sub: 'Feedback from players who booked through DinkHub — published only with their consent.' }
    : { title: 'Built for local pickleball players',
        sub: 'DinkHub is new in Marawi City. Instead of inventing reviews, here is what the platform' +
             ' actually guarantees from day one.' };

  const PROMISES = [
    { icon: 'shield', delay: '', title: 'Every listing is reviewed',
      copy: 'Venue details, courts, and rates are submitted by the owner and approved by an administrator before publishing.' },
    { icon: 'clock', delay: '.08s', title: 'No double bookings',
      copy: 'The server blocks overlapping approved reservations on the same court, and re-checks again at approval.' },
    { icon: 'users', delay: '.16s', title: 'Local, not generic',
      copy: 'Built around Marawi City courts and the people who actually run them — players and owners in one place.' }
  ];

  const grid = list.length
    ? list.map((item, i) =>
        '<article class="quote-card" data-reveal style="--delay:' + (i * 10) + 'ms">' +
          '<div class="quote-card__stars" aria-label="' + item.rating + ' out of 5">' +
            Array.from({ length: Number(item.rating) || 0 }).map(() => icon('star')).join('') +
          '</div>' +
          '<p class="quote-card__text">\u201C' + esc(item.quote) + '\u201D</p>' +
          '<div class="quote-card__author">' +
            '<span class="avatar">' + esc(item.initials) + '</span>' +
            '<div><strong>' + esc(item.name) + '</strong><p>' + esc(item.location) + '</p></div>' +
          '</div></article>').join('')
    : PROMISES.map(p =>
        '<article class="promise-card" data-reveal' + (p.delay ? ' style="--delay:' + p.delay + '"' : '') + '>' +
          '<span class="promise-card__ico">' + icon(p.icon) + '</span>' +
          '<h3>' + esc(p.title) + '</h3><p>' + esc(p.copy) + '</p></article>').join('');

  return '<section class="section voices">' +
    '<div class="voices__bg"><img src="/img/hero-court.jpg" alt="" aria-hidden="true" loading="lazy"></div>' +
    '<div class="shell voices__inner">' +
      '<header class="voices__head" data-reveal>' +
        '<p class="eyebrow eyebrow--light">Player experiences</p>' +
        '<h2 class="h2 h2--light">' + esc(head.title) + '</h2>' +
        '<p class="voices__sub">' + esc(head.sub) + '</p>' +
      '</header>' +
      '<div class="voices__grid">' + grid + '</div>' +
    '</div></section>';
}

const GUIDE_CARDS = [
  { tag: 'Beginner', image: 'img/court-outdoor.jpg', title: 'Your first game, explained',
    copy: 'Scoring, the kitchen line, and the two-bounce rule in plain language.', anchor: '#beginner', delay: '' },
  { tag: 'Etiquette', image: 'img/court-indoor.jpg', title: 'Court manners that matter',
    copy: 'Sharing courts, calling lines honestly, and leaving the surface clean.', anchor: '#etiquette', delay: '.08s' },
  { tag: 'Booking', image: 'img/court-rooftop.jpg', title: 'Prepare for your slot',
    copy: 'What to send the owner, what to bring, and when to arrive.', anchor: '#booking', delay: '.16s' }
];

function guides() {
  return '<section class="section guides"><div class="shell">' +
    '<header class="section-head section-head--split" data-reveal><div>' +
      '<p class="eyebrow">Pickleball notes</p><h2 class="h2">Tips before your first game</h2></div>' +
      '<a class="link-pill" href="/guide">Read the guide ' + icon('arrow-right') + '</a></header>' +
    '<div class="guide-grid">' + GUIDE_CARDS.map(card =>
      '<a class="guide-card" href="/guide' + card.anchor + '" data-reveal' +
        (card.delay ? ' style="--delay:' + card.delay + '"' : '') + '>' +
        '<div class="guide-card__media"><img src="/' + card.image + '" alt="" loading="lazy"></div>' +
        '<div class="guide-card__body">' +
          '<span class="guide-card__tag">' + esc(card.tag) + '</span>' +
          '<h3>' + esc(card.title) + '</h3><p>' + esc(card.copy) + '</p>' +
        '</div></a>').join('') +
    '</div></div></section>';
}

function ownerCta() {
  return '<section class="owner-cta">' +
    '<div class="owner-cta__bg">' +
      '<img src="/img/owner-cta.jpg" alt="Empty pickleball court at sunrise" loading="lazy">' +
    '</div>' +
    '<div class="shell owner-cta__inner"><div class="owner-cta__copy" data-reveal>' +
      '<p class="eyebrow eyebrow--light">For venue owners</p>' +
      '<h2 class="h2 h2--light">Own a pickleball court?<br>List it on DinkHub.</h2>' +
      '<p>Publish your courts, set your own rates, and receive booking requests from players in' +
        ' Marawi City. You decide which requests to approve.</p>' +
      '<ol class="owner-steps">' +
        '<li><span>01</span> Submit your venue details, courts, and photos</li>' +
        '<li><span>02</span> An administrator reviews the submission</li>' +
        '<li><span>03</span> Go live and manage requests from your dashboard</li>' +
      '</ol>' +
      '<div class="owner-cta__actions">' +
        '<a class="btn btn--light" href="/courts/new">List your court' +
          '<span class="btn__orb btn__orb--dark">' + icon('arrow-up-right') + '</span></a>' +
        '<a class="btn btn--glass" href="/how-it-works#owners">See the review process</a>' +
      '</div>' +
    '</div></div></section>';
}

function faq(faqs) {
  return '<section class="section faq"><div class="shell faq__grid">' +
    '<div class="faq__intro" data-reveal>' +
      '<p class="eyebrow">Questions</p><h2 class="h2">Good to know before you book</h2>' +
      '<p class="section-head__sub">Short answers about requests, approval, cancellations, and listing' +
        ' a venue. Still unsure? <a href="/contact">Send us a message</a>.</p>' +
    '</div>' +
    '<div class="faq__list" data-reveal style="--delay:.08s">' +
      (faqs || []).map((item, i) =>
        '<details class="faq-item"' + (i === 0 ? ' open' : '') + '>' +
          '<summary><span>' + esc(item.q) + '</span>' +
          '<span class="faq-item__sign">' + icon('plus') + '</span></summary>' +
          '<p>' + esc(item.a) + '</p></details>').join('') +
    '</div></div></section>';
}
})();
