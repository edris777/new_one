/* ============================================================
   Static pages — templates/pages/{about,how_it_works,guide,
   developers,contact}.html
   Copy, class names, data-reveal flags and --delay values are taken
   straight from the templates so the reveal motion is identical.
   ============================================================ */

(function () {
  const esc = UI.esc;

  /* page-hero with the raw title: two of these headings carry a <br> */
  function hero(breadcrumb, eyebrowText, titleHtml, lead) {
    return '<section class="page-hero"><div class="shell page-hero__inner">' +
      '<nav class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><span>' +
        esc(breadcrumb) + '</span></nav>' +
      '<p class="eyebrow">' + esc(eyebrowText) + '</p>' +
      '<h1>' + titleHtml + '</h1>' +
      (lead ? '<p>' + esc(lead) + '</p>' : '') +
      '</div></section>';
  }

  function sectionHead(eyebrowText, title, classes) {
    return '<div class="section-head' + (classes ? ' ' + classes : '') + '" data-reveal>' +
      '<p class="eyebrow">' + esc(eyebrowText) + '</p>' +
      '<h2 class="h2">' + esc(title) + '</h2></div>';
  }

  function arch(image, alt, className) {
    return '<figure class="' + className + '">' +
      '<img src="/img/' + image + '" alt="' + esc(alt) + '" loading="lazy"></figure>';
  }

  function step(num, title, body) {
    return '<div class="step-item"><span class="step-item__num">' + num + '</span>' +
      '<div><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></div></div>';
  }

  /* ---------- about ---------- */

  function aboutMarkup(data) {
    return hero('About', 'Our story', 'Built in Marawi,<br>for the way we play.',
      'DinkHub started with a simple problem: pickleball is growing fast in Marawi City, but finding ' +
      'a court still depends on group chats and word of mouth. This platform gives players one honest ' +
      'place to look — and gives court owners a simple way to manage requests.') +

      '<section class="section"><div class="shell split">' +
        '<div class="prose" data-reveal>' +
          '<p class="eyebrow">The problem</p>' +
          '<h2 class="h2">Courts were there. Finding them was not.</h2>' +
          '<p>A player who wants to play on Saturday currently has to ask around, message three ' +
            'different people, and still arrive unsure whether the court is free. Owners, meanwhile, ' +
            'juggle requests across chat threads and sometimes approve the same slot twice.</p>' +
          '<p>DinkHub replaces that with a shared directory and a booking record both sides can see. ' +
            'Every venue is submitted by its owner, reviewed by an administrator, and shown with the ' +
            'details that owner actually provided.</p>' +
          '<h2 class="h2" style="margin-top:26px">What we are building</h2>' +
          '<ul>' +
            '<li><strong>A truthful directory.</strong> Only approved, active venues appear publicly.</li>' +
            '<li><strong>A real booking trail.</strong> Requests are stored, reviewed, and never ' +
              'silently confirmed.</li>' +
            '<li><strong>A local-first service area.</strong> Marawi City first, with room to grow ' +
              'across Lanao del Sur.</li>' +
          '</ul>' +
        '</div>' +
        '<div class="media-stack" data-reveal style="--delay:.1s">' +
          arch('about-players.jpg', 'Pickleball players rallying', 'arch arch--tall') +
          arch('court-rooftop.jpg', 'Covered court at dusk', 'arch arch--small') +
        '</div>' +
      '</div></section>' +

      '<section class="section" style="background:var(--cream-2);"><div class="shell">' +
        sectionHead('Principles', 'How DinkHub stays honest', 'section-head--center') +
        '<div class="voices__grid" style="--tw:1;">' +
          principle('No invented venues',
            'Listings come from owners, not from a template. If no venue is approved in a city, ' +
            'that city simply has no results.', '') +
          principle('No fake availability',
            'Slots are checked against real booking records on the server, at request time and again ' +
            'at approval time.', '--delay:.08s') +
          principle('No invented reviews',
            'Player feedback appears only when it is genuine and the player has consented to publish it.',
            '--delay:.16s') +
        '</div>' +
        '<div class="stats" style="background:transparent;border:0;padding:56px 0 0;">' +
          '<div class="stats__grid">' +
            aboutStat(data.venue_total, 'Approved venues') +
            aboutStat(data.court_total, 'Bookable courts') +
            aboutStat(1, 'City at launch — Marawi') +
          '</div>' +
        '</div>' +
      '</div></section>' +

      '<section class="section"><div class="shell split">' +
        '<div class="callout" data-reveal>' +
          '<p class="eyebrow eyebrow--light">For owners</p>' +
          '<h3>You keep control of your court.</h3>' +
          '<p>Set your own rate, publish your own photos, and approve only the requests that work for you.</p>' +
          '<a class="btn btn--light btn--sm" href="/courts/new">List your venue' +
            '<span class="btn__orb btn__orb--dark">' + icon('arrow-up-right') + '</span></a>' +
        '</div>' +
        '<div class="prose" data-reveal style="--delay:.1s">' +
          '<p class="eyebrow">For players</p>' +
          '<h2 class="h2">One request. Clear answer.</h2>' +
          '<p>Send a booking request with a date and time that suits you. The owner approves or ' +
            'rejects it, and your dashboard always shows the current status. Only an approved request ' +
            'counts as reserved court time.</p>' +
          '<a class="btn btn--dark" href="/courts">Browse courts' +
            '<span class="btn__orb">' + icon('arrow-right') + '</span></a>' +
        '</div>' +
      '</div></section>';
  }

  function principle(title, body, delay) {
    return '<article class="team-card" data-reveal' + (delay ? ' style="' + delay + '"' : '') + '>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p style="color:var(--ink-soft);font-size:.9rem;">' + esc(body) + '</p></article>';
  }

  /* the about page prints plain numbers — no data-count, no count-up */
  function aboutStat(value, label) {
    return '<div class="stat"><p class="stat__num">' + esc(value) + '</p>' +
      '<p class="stat__label">' + esc(label) + '</p></div>';
  }

  /* ---------- how it works ---------- */

  function howItWorksMarkup() {
    return hero('How it works', 'Two journeys, one system', 'How booking works',
      'A request is not a reservation. The venue owner reviews every request, and DinkHub checks for ' +
      'conflicts on the server before anything is confirmed.') +

      '<section class="section"><div class="shell split">' +
        '<div data-reveal>' +
          '<p class="eyebrow">For players</p>' +
          '<h2 class="h2" style="margin-bottom:22px;">From search to confirmed court</h2>' +
          '<div class="step-list">' +
            step('01', 'Find a venue', 'Search by city, court type, or facility. Only approved and active venues appear.') +
            step('02', 'Pick a court and a slot', 'Open the venue, choose one of its active courts, then select a future date, start, and end time.') +
            step('03', 'Sign in and send the request', 'Your chosen court is kept while you log in or register, then you land back on the booking form.') +
            step('04', 'Wait for approval', 'The request is stored as Pending. The owner approves or rejects it, and the status updates in your dashboard.') +
            step('05', 'Play', 'Only an approved booking is a confirmed reservation. Court fees are settled with the venue — DinkHub does not take online payments yet.') +
          '</div>' +
        '</div>' +
        '<div class="booking-aside" data-reveal style="--delay:.1s">' +
          '<div class="booking-aside__rate"><strong>Pending</strong><span>→ approved</span></div>' +
          '<p class="booking-aside__note">' + icon('shield') +
            'Two approved bookings can never overlap on the same court. The check runs when you ' +
            'request and again inside a database transaction when the owner approves.</p>' +
          '<div class="divider"></div>' +
          '<div class="booking-aside__list">' +
            '<span><em>Overlap rule</em></span>' +
            '<span>existing start &lt; new end</span>' +
            '<span>and existing end &gt; new start</span>' +
          '</div>' +
          '<a class="btn btn--dark btn--block" href="/courts">Find a court' +
            '<span class="btn__orb">' + icon('arrow-right') + '</span></a>' +
        '</div>' +
      '</div></section>' +

      '<section class="section" id="owners" style="background:var(--cream-2);">' +
        '<div class="shell split">' +
          '<div class="media-stack" data-reveal>' +
            arch('owner-cta.jpg', 'Empty court at sunrise', 'arch arch--wide') +
            arch('court-indoor.jpg', 'Indoor courts', 'arch arch--small') +
          '</div>' +
          '<div data-reveal style="--delay:.08s">' +
            '<p class="eyebrow">For venue owners</p>' +
            '<h2 class="h2" style="margin-bottom:22px;">From submission to approved listing</h2>' +
            '<div class="step-list">' +
              step('01', 'Create an owner account', 'Register as a venue owner, or switch an existing player account from the For Venue Owners page.') +
              step('02', 'Submit your venue', 'Add the address, courts, surface, facilities, opening hours, and your own rate. Upload photos you have the right to use.') +
              step('03', 'Administrator review', 'The listing is checked for complete and truthful information. Unreviewed listings are never shown as verified.') +
              step('04', 'Manage requests', 'Approve or reject incoming requests from your dashboard. You only ever see bookings for your own venues.') +
            '</div>' +
            '<a class="btn btn--dark" href="/courts/new" style="margin-top:20px;">List your court' +
              '<span class="btn__orb">' + icon('arrow-up-right') + '</span></a>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section"><div class="shell">' +
        sectionHead('Roles', 'Who can see what', 'section-head--center') +
        '<div class="step-list" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">' +
          roleStep(icon('user'), 'Player', 'Own bookings and statuses only. Cannot open owner or administrator pages.', '') +
          roleStep(icon('paddle'), 'Venue owner', "Own venues, courts, and incoming requests. Cannot decide on another owner's bookings.", '--delay:.06s') +
          roleStep(icon('shield'), 'Administrator', 'Reviews venue submissions, oversees accounts, and moderates booking records.', '--delay:.12s') +
        '</div>' +
      '</div></section>';
  }

  function roleStep(badgeHtml, title, body, delay) {
    return '<div class="step-item" data-reveal' + (delay ? ' style="' + delay + '"' : '') + '>' +
      '<span class="step-item__num">' + badgeHtml + '</span>' +
      '<div><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></div></div>';
  }

  /* ---------- guide ---------- */

  function guideMarkup() {
    return hero('Guide', 'Start here', 'The DinkHub pickleball guide',
      'New to the sport? These are the basics worth knowing before your first booking — rules, court ' +
      'manners, and how to prepare for a slot.') +

      '<section class="section" id="beginner"><div class="shell split">' +
        '<figure class="arch arch--wide" data-reveal>' +
          '<img src="/img/court-outdoor.jpg" alt="Outdoor pickleball court" loading="lazy"></figure>' +
        '<div class="prose" data-reveal style="--delay:.08s">' +
          '<p class="eyebrow">Beginner rules</p>' +
          '<h2 class="h2">Five things to know before you play</h2>' +
          '<ol>' +
            '<li><strong>Serve underhand, below the waist.</strong> The serve is diagonal, into the opposite service box.</li>' +
            '<li><strong>Double bounce.</strong> The ball must bounce once on each side before volleys are allowed.</li>' +
            '<li><strong>Stay out of the kitchen.</strong> You cannot volley while standing inside the non-volley zone near the net.</li>' +
            '<li><strong>Games go to 11, win by 2.</strong> Only the serving side scores in traditional scoring.</li>' +
            '<li><strong>The ball matters.</strong> Pickleballs are hollow with holes — a tennis ball will not behave the same way.</li>' +
          '</ol>' +
          '<p>Courts in Marawi are mostly outdoor hard courts, so bring water, a cap, and shoes with grip.</p>' +
        '</div>' +
      '</div></section>' +

      '<section class="section" id="etiquette" style="background:var(--cream-2);">' +
        '<div class="shell split">' +
          '<div class="prose" data-reveal>' +
            '<p class="eyebrow">Court etiquette</p>' +
            '<h2 class="h2">Share the court well</h2>' +
            '<ul>' +
              '<li>Arrive on time and leave the court at the end of your slot — the next booking may already be approved.</li>' +
              '<li>Call the score before serving, and call lines honestly, including your own.</li>' +
              '<li>Return stray balls to neighbouring courts between points, not during a rally.</li>' +
              '<li>Keep bags and bottles off the playing surface.</li>' +
              '<li>If you must cancel, do it early so the owner can release the slot.</li>' +
            '</ul>' +
          '</div>' +
          '<figure class="arch arch--wide" data-reveal style="--delay:.08s">' +
            '<img src="/img/court-indoor.jpg" alt="Indoor pickleball courts" loading="lazy"></figure>' +
        '</div></section>' +

      '<section class="section" id="booking"><div class="shell">' +
        '<div class="section-head section-head--split" data-reveal>' +
          '<div><p class="eyebrow">Booking tips</p><h2 class="h2">Prepare for your slot</h2></div>' +
        '</div>' +
        '<div class="guide-grid">' +
          guideCard('court-outdoor.jpg', 'Before booking', 'Check the details',
            'Read the venue\'s courts, surface, facilities, and rate. If the rate says "on request", ' +
            'ask the owner before you play.', '') +
          guideCard('court-rooftop.jpg', 'When requesting', 'Be specific',
            'Choose a realistic start and end time and add a short note — number of players, whether ' +
            'you need lights, or if you are a beginner.', '--delay:.08s') +
          guideCard('about-players.jpg', 'On the day', 'Bring the basics',
            'Paddles, balls, water, and a towel. Confirm the venue address before travelling, and ' +
            'arrive a few minutes early.', '--delay:.16s') +
        '</div>' +
      '</div></section>' +

      '<section class="section" style="padding-top:0;"><div class="shell">' +
        '<div class="callout" style="flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;">' +
          '<div><h3>Ready to try it?</h3><p>Find an approved court near you and send your first request.</p></div>' +
          '<a class="btn btn--light" href="/courts">Browse courts' +
            '<span class="btn__orb btn__orb--dark">' + icon('arrow-up-right') + '</span></a>' +
        '</div>' +
      '</div></section>';
  }

  function guideCard(image, tag, title, body, delay) {
    return '<article class="guide-card" data-reveal' + (delay ? ' style="' + delay + '"' : '') + '>' +
      '<div class="guide-card__media"><img src="/img/' + image + '" alt="" loading="lazy"></div>' +
      '<div class="guide-card__body">' +
        '<span class="guide-card__tag">' + esc(tag) + '</span>' +
        '<h3>' + esc(title) + '</h3>' +
        '<p>' + esc(body) + '</p>' +
      '</div></article>';
  }

  /* ---------- developers ---------- */

  function developersMarkup(team) {
    const head = hero('Developers', 'Project team', 'The people behind DinkHub',
      'Team identities are managed in the database so that only real members are published — nothing ' +
      'is written into the template.');

    if (!team.length) {
      return head + '<section class="section"><div class="shell">' +
        '<div class="empty-panel">' +
          '<span class="empty-panel__ico">' + icon('users') + '</span>' +
          '<h3>No team members published yet</h3>' +
          '<p>Add the actual project members and their contributions in the administrator panel ' +
            '(Pages → Team members). This page never invents names or photos.</p>' +
        '</div></div></section>';
    }

    return head + '<section class="section"><div class="shell"><div class="team-grid">' +
      team.map(member => {
        const initials = esc(String(member.name || '').slice(0, 2).toUpperCase());
        return '<article class="team-card" data-reveal>' +
          '<div class="team-card__avatar">' +
            (member.photo
              ? '<img src="' + esc(member.photo) + '" alt="' + esc(member.name) + '">'
              : initials) +
          '</div>' +
          '<h3>' + esc(member.name) + '</h3>' +
          '<p style="font-size:.82rem;color:var(--ink-mute);">' + esc(member.role) +
            (member.is_leader ? ' · Team leader' : '') + '</p>' +
          (member.contribution
            ? '<p style="font-size:.88rem;color:var(--ink-soft);">' + esc(member.contribution) + '</p>'
            : '') +
          '</article>';
      }).join('') +
      '</div></div></section>';
  }

  /* ---------- contact ---------- */

  function contactMarkup() {
    return hero('Contact', 'Say hello', 'Contact DinkHub',
      'Questions about a booking, a listing, or the platform itself? Send a message and it will be ' +
      'recorded for the team.') +

      '<section class="section"><div class="shell two-col">' +
        '<div class="form-card" data-reveal>' +
          '<h2 class="h2" style="font-size:1.7rem;margin-bottom:18px;">Send us a message</h2>' +
          '<form data-contact-form novalidate>' +
            '<div class="form-errors" data-nonfield-errors hidden></div>' +
            '<div class="form-grid">' +
              UI.field({ name: 'name', label: 'Name', attrs: ' placeholder="Your name"' }) +
              UI.field({ name: 'email', label: 'Email', type: 'email',
                attrs: ' placeholder="you@example.com"' }) +
              UI.field({ name: 'subject', label: 'Subject', full: true,
                attrs: ' placeholder="What is this about?"' }) +
              UI.field({ name: 'message', label: 'Message', type: 'textarea', full: true, rows: 5,
                attrs: ' placeholder="Tell us how we can help."' }) +
            '</div>' +
            '<div class="form-actions">' +
              '<button class="btn btn--dark" type="submit">Send message' +
                '<span class="btn__orb">' + icon('arrow-right') + '</span></button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<aside class="form-aside" data-reveal style="--delay:.08s">' +
          '<p class="eyebrow eyebrow--light">Details</p>' +
          '<h3>Where to find us</h3>' +
          '<ul>' +
            '<li>' + icon('pin') + '<span>Service area: Marawi City, Lanao del Sur, Philippines</span></li>' +
            '<li>' + icon('clock') + '<span>Replies: Monday to Saturday, 8:00 AM – 6:00 PM</span></li>' +
            '<li>' + icon('shield') + '<span>For venue concerns, include your venue name and booking reference.</span></li>' +
          '</ul>' +
          '<div class="divider" style="background:rgba(255,255,255,.15)"></div>' +
          '<p style="font-size:.84rem;color:rgba(255,253,249,.7);">Messages submitted here are stored ' +
            'in the DinkHub database so the team can follow up. No phone number or email address is ' +
            'invented for display on this site.</p>' +
        '</aside>' +
      '</div></section>';
  }

  Object.assign(PAGES, {
    about: {
      render(host) {
        return Api.get('/api/about').then(res => {
          host.innerHTML = aboutMarkup(res.ok ? res : { venue_total: 0, court_total: 0 });
          return undefined;
        });
      }
    },

    how_it_works: {
      render(host) {
        host.innerHTML = howItWorksMarkup();
        return undefined;
      }
    },

    guide: {
      render(host) {
        host.innerHTML = guideMarkup();
        return undefined;
      }
    },

    developers: {
      render(host) {
        return Api.get('/api/team').then(res => {
          host.innerHTML = developersMarkup((res && res.team) || []);
          return undefined;
        });
      }
    },

    contact: {
      render(host) {
        host.innerHTML = contactMarkup();
        const form = host.querySelector('[data-contact-form]');

        form.addEventListener('submit', event => {
          event.preventDefault();
          Api.post('/api/contact', UI.readForm(form)).then(res => {
            if (!res.ok) {
              UI.paintErrors(form, res.errors);
              const all = (res.errors && res.errors.__all__) || [];
              const nonField = form.querySelector('[data-nonfield-errors]');
              nonField.hidden = !all.length;
              nonField.innerHTML = all.map(esc).join('<br>');
              return;
            }
            /* ContactForm saved and redirected back to itself with a message. */
            Store.flash(res.message);
            form.reset();
            reloadRoute();
          });
        });
        return undefined;
      }
    }
  });
})();
