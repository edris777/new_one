/* ============================================================
   Venue screens — templates/venues/detail.html, owner_join.html
   and not_public.html
   ============================================================ */

(function () {
  const esc = UI.esc;
  const FALLBACK_COVER = '/img/court-outdoor.jpg';

  /* {{ venue.description|linebreaksbr }} */
  function paragraph(text) {
    return esc(text).replace(/\n/g, '<br>');
  }

  function hoursLabel(venue) {
    return DATA.ampm(venue.opening_time) + ' \u2013 ' + DATA.ampm(venue.closing_time);
  }

  function fullAddress(venue) {
    return [venue.address, venue.barangay, venue.city, venue.province]
      .filter(Boolean).join(', ');
  }

  Object.assign(PAGES, {
    venueDetail: {
      render(host, params) {
        return Api.get('/api/venues/' + encodeURIComponent(params.slug)).then(res => {
          if (res.status === 404 && res.error === 'not_public') {
            host.innerHTML = notPublicView(res.venue);
            return undefined;
          }
          if (!res.ok) {
            host.innerHTML = UI.notFound('Venue not found.', 'No listing matches that address.');
            return undefined;
          }
          const venue = res.venue;
          host.innerHTML = head(venue, res) + body(venue);
          return { title: venue.name + ' — DinkHub' };
        });
      }
    },

    ownerJoin: {
      render(host) {
        host.innerHTML = join();
        host.querySelector('[data-join-form]').addEventListener('submit', event => {
          event.preventDefault();
          Store.ops.becomeOwner().then(res => {
            if (!res.ok) return UI.toast(res.error || 'Sign in to continue.', 'error');
            Store.flash('Your account can now manage venue listings.');
            go('/courts/new');
          });
        });
      }
    }
  });

  /* ---------- detail ---------- */

  function head(venue, res) {
    const cover = venue.cover || FALLBACK_COVER;
    const photos = (venue.photos || []).slice(0, 2);
    const galleryPhotos = photos.length
      ? photos.map(photo =>
          '<a href="' + esc(photo.image) + '"><img src="' + esc(photo.image) + '"' +
          ' alt="' + esc(photo.caption || venue.name) + '" loading="lazy"></a>').join('')
      : '<a href="/img/court-indoor.jpg"><img src="/img/court-indoor.jpg" alt="' + esc(venue.name) +
        ' courts" loading="lazy"></a>' +
        '<a href="/img/court-rooftop.jpg"><img src="/img/court-rooftop.jpg" alt="' + esc(venue.name) +
        ' courts" loading="lazy"></a>';

    const courts = (venue.courts || []).filter(court => court.is_active);

    return '<section class="venue-head"><div class="shell">' +
      '<nav class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span>' +
        '<a href="/courts">Browse courts</a><span class="sep">/</span>' +
        '<span>' + esc(venue.name) + '</span></nav>' +
      (res.can_preview
        ? '<div class="form-errors" style="margin-top:16px;background:rgba(181,115,22,.1);' +
          'border-color:rgba(181,115,22,.3);color:var(--warn);">Preview — this venue is <strong>' +
          esc(venue.status_display.toLowerCase()) + '</strong> and is not visible to the public yet.</div>'
        : '') +
      '<div class="venue-head__top"><div>' +
        '<div class="chip-row" style="margin-bottom:10px;">' +
          (venue.is_verified
            ? '<span class="badge badge--ok">' + icon('shield') + 'Reviewed</span>' : '') +
          '<span class="badge badge--muted">' + esc(venue.setting_display) + '</span>' +
          (venue.is_demo ? '<span class="badge badge--demo">Sample listing</span>' : '') +
        '</div>' +
        '<h1>' + esc(venue.name) + '</h1>' +
        (venue.tagline ? '<p style="color:var(--ink-soft);margin-top:6px;">' + esc(venue.tagline) + '</p>' : '') +
        '<div class="venue-head__meta">' +
          '<span>' + icon('pin') + esc(venue.address + (venue.barangay ? ', ' + venue.barangay : '') +
            ', ' + venue.location_label) + '</span>' +
          '<span>' + icon('clock') + esc(hoursLabel(venue)) + '</span>' +
          '<span>' + icon('paddle') + courts.length + ' active court' + (courts.length === 1 ? '' : 's') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="venue-actions">' +
        '<a class="btn btn--outline btn--sm" href="tel:' + esc(venue.contact_phone) + '">' +
          icon('phone') + esc(venue.contact_phone) + '</a>' +
        (courts.length
          ? '<a class="btn btn--dark btn--sm" href="#courts">Book a court' +
            '<span class="btn__orb">' + icon('arrow-right') + '</span></a>' : '') +
      '</div></div>' +
      '<div class="venue-gallery">' +
        '<a href="' + esc(cover) + '"><img src="' + esc(cover) + '" alt="' + esc(venue.name) + '"></a>' +
        galleryPhotos +
      '</div>' +
    '</div></section>';
  }

  function body(venue, res) {
    const courts = (venue.courts || []).filter(court => court.is_active);
    const user = Store.sel.user();
    const canManage = !!user && (user.id === venue.owner_id || user.is_administrator);

    const courtRows = courts.length
      ? '<div class="court-list">' + courts.map(court =>
          '<div class="court-row"><div>' +
            '<p class="court-row__name">' + esc(court.name) + '</p>' +
            '<p class="court-row__meta">' + esc(court.surface_display) +
              (court.is_indoor ? ' · indoor' : ' · outdoor') +
              (court.notes ? ' · ' + esc(court.notes) : '') + '</p>' +
          '</div>' +
          '<span class="court-row__rate">' + esc(court.rate_display) + '</span>' +
          '<a class="btn btn--dark btn--sm" href="/bookings/court/' + court.id + '/new">Book' +
            '<span class="btn__orb">' + icon('arrow-up-right') + '</span></a></div>').join('') + '</div>'
      : '<p>This venue has no active courts at the moment. Contact the owner for availability.</p>';

    const facts = [
      ['Court type', venue.setting_display],
      ['Opening hours', hoursLabel(venue)],
      ['Starting rate', venue.rate_display],
      ['City', venue.city],
      ['Province', venue.province],
      ['Contact', venue.contact_phone]
    ].map(fact =>
      '<div class="fact"><span>' + esc(fact[0]) + '</span><strong>' + esc(fact[1]) + '</strong></div>').join('');

    const map = (venue.latitude && venue.longitude)
      ? '<a class="link-arrow" style="margin-top:10px;" target="_blank" rel="noopener" href="' +
        'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(venue.latitude + ',' + venue.longitude) +
        '">Open verified coordinates in maps ' + icon('arrow-up-right') + '</a>'
      : '<p class="form-text" style="margin-top:8px;">This owner has not supplied verified map coordinates,' +
        ' so no map pin is shown. Use the address and phone number above.</p>';

    return '<section class="venue-body shell"><div class="venue-main">' +
      '<div class="venue-section" data-reveal><h2>About this venue</h2><p>' +
        paragraph(venue.description) + '</p></div>' +
      (canManage
        ? '<div class="venue-section" data-reveal><div class="btn-row">' +
          '<a class="btn btn--outline btn--sm" href="/courts/' + esc(venue.slug) + '/edit">Edit listing</a>' +
          '</div></div>'
        : '') +
      '<div class="venue-section" data-reveal><h2>The details</h2>' +
        '<div class="venue-facts">' + facts + '</div></div>' +
      (venue.facility_list && venue.facility_list.length
        ? '<div class="venue-section" data-reveal><h2>Facilities</h2><div class="facility-grid">' +
          venue.facility_list.map(f =>
            '<span class="facility-pill">' + icon(f.icon || 'check') + esc(f.name) + '</span>').join('') +
          '</div></div>' : '') +
      '<div class="venue-section" id="courts" data-reveal><h2>Courts</h2>' + courtRows + '</div>' +
      '<div class="venue-section" data-reveal><h2>Location</h2><p>' + esc(fullAddress(venue)) + '</p>' +
        map + '</div>' +
    '</div>' +
    '<aside class="booking-aside" data-reveal style="--delay:.08s">' +
      '<div class="booking-aside__rate"><strong>' +
        esc(venue.rate_display.replace('/hour', '')) + '</strong><span>' +
        (venue.starting_rate ? '/ hour' : '') + '</span></div>' +
      '<p class="booking-aside__note">' + icon('shield') +
        ' Send a request and the owner will approve or reject it. DinkHub does not take payment online.</p>' +
      '<div class="divider"></div>' +
      '<div class="booking-aside__list">' +
        '<span><em>Owner</em><em>' + esc(venue.owner_name) + '</em></span>' +
        '<span><em>Contact</em><em>' + esc(venue.contact_phone) + '</em></span>' +
        '<span><em>Courts</em><em>' + courts.length + '</em></span>' +
      '</div>' +
      (courts.length
        ? '<a class="btn btn--dark btn--block" href="/bookings/court/' + courts[0].id + '/new">' +
          'Request a booking<span class="btn__orb">' + icon('arrow-right') + '</span></a>' : '') +
      '<p class="form-text">Choose a specific court in the booking form after this step.</p>' +
    '</aside></section>';
  }

  /* templates/venues/not_public.html — the 404 DinkHub serves for an
     unapproved or paused listing a visitor is not allowed to preview. */
  function notPublicView(venue) {
    document.title = 'Venue not available — DinkHub';
    const name = venue && venue.name ? venue.name : 'That venue';
    return '<section class="section"><div class="shell">' +
      UI.emptyPanel('shield', 'This venue is not published',
        '\u201C' + name + '\u201D has either not completed review or is currently paused by its owner.' +
        ' DinkHub only shows approved and active listings to visitors.',
        '<a class="btn btn--dark" href="/courts">Browse available courts</a>') +
      '</div></section>';
  }

  /* ---------- owner join ---------- */

  function join() {
    return '<section class="page-hero"><div class="shell page-hero__inner">' +
      '<nav class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span>' +
      '<span>For venue owners</span></nav>' +
      '<p class="eyebrow">One small step</p><h1>Switch to a venue owner account</h1>' +
      '<p>Your account is currently set up as a player. Enabling owner tools lets you submit a venue' +
        ' and manage booking requests. You can keep booking courts as a player too.</p>' +
      '</div></section>' +
      '<section class="section"><div class="shell split">' +
        '<div class="prose" data-reveal>' +
          '<h2 class="h2">What changes</h2><ul>' +
            '<li>You can submit venues for administrator review.</li>' +
            '<li>You can add courts, rates, and opening hours.</li>' +
            '<li>You will see booking requests for your own venues only.</li>' +
          '</ul>' +
          '<p class="form-text">Nothing is published until an administrator approves your listing.</p>' +
          '<form data-join-form><div class="form-actions">' +
            '<button class="btn btn--dark" type="submit">Enable owner tools' +
              '<span class="btn__orb">' + icon('arrow-right') + '</span></button>' +
            '<a class="btn btn--ghost" href="/dashboard/player">Not now</a>' +
          '</div></form>' +
        '</div>' +
        '<figure class="arch arch--wide" data-reveal style="--delay:.08s">' +
          '<img src="/img/owner-cta.jpg" alt="Court at sunrise" loading="lazy">' +
        '</figure>' +
      '</div></section>';
  }
})();
