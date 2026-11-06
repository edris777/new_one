/* ============================================================
   Venue form — templates/venues/form.html (create and edit modes)
   Django rendered an inline formset for the courts; here the same
   rows are plain DOM with one blank row extra, matching extra=1 in
   venues/forms.py CourtFormSet.
   ============================================================ */

(function () {
  const esc = UI.esc;

  const SETTINGS = [
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'indoor', label: 'Indoor' },
    { value: 'both', label: 'Indoor & outdoor' }
  ];

  const SURFACES = [
    { value: 'acrylic', label: 'Acrylic' },
    { value: 'concrete', label: 'Concrete' },
    { value: 'asphalt', label: 'Asphalt' },
    { value: 'cushioned', label: 'Cushioned' },
    { value: 'clay', label: 'Clay' }
  ];

  Object.assign(PAGES, {
    venueCreate: {
      render(host) {
        const user = Store.sel.user();
        if (user && !user.is_owner && !user.is_administrator) return { redirect: '/courts/owner/join' };
        return Api.get('/api/facilities').then(res => paint(host, {
          mode: 'create', venue: null, facilities: res.facilities || []
        }));
      }
    },

    venueEdit: {
      render(host, params) {
        return Api.get('/api/venues/' + encodeURIComponent(params.slug)).then(res => {
          if (res.status === 404 && res.error === 'not_public') {
            host.innerHTML = '<section class="section"><div class="shell">' +
              UI.emptyPanel('shield', 'This venue is not published',
                'Pause or resume it from the owner dashboard once it is approved.',
                '<a class="btn btn--dark" href="/dashboard/owner">Owner dashboard</a>') +
              '</div></section>';
            return undefined;
          }
          if (!res.ok) {
            host.innerHTML = UI.notFound('Venue not found.', 'No listing matches that address.');
            return undefined;
          }
          const user = Store.sel.user();
          if (user.id !== res.venue.owner_id && !user.is_administrator) {
            host.innerHTML = UI.notFound('Not your venue.', 'You can only manage listings you own.');
            return undefined;
          }
          return Api.get('/api/facilities').then(facets => paint(host, {
            mode: 'edit', venue: res.venue, facilities: facets.facilities || []
          }));
        });
      }
    }
  });

  /* ---------- form ---------- */

  function paint(host, config) {
    const venue = config.venue;
    const mode = config.mode;
    const selected = (venue && (venue.facility_list || []).map(f => f.slug)) || [];

    document.title = (mode === 'create' ? 'List your venue' : 'Manage ' + venue.name) + ' — DinkHub';
    host.innerHTML = hero(config) +
      '<section class="section" style="padding-top:34px;"><div class="shell two-col">' +
      '<form data-venue-form novalidate>' +
        formErrorsBlock(null) +
        infoCard(venue, config.facilities, selected) +
        courtsCard(venue) +
        (mode === 'edit' ? galleryCard(venue) : '') +
        '<div class="form-actions">' +
          '<button class="btn btn--dark" type="submit">' +
            (mode === 'create' ? 'Submit for review' : 'Save changes') +
            '<span class="btn__orb">' + icon('check') + '</span></button>' +
          '<a class="btn btn--ghost" href="/dashboard/owner">Cancel</a>' +
        '</div>' +
      '</form>' + aside(venue, mode) +
      '</div></section>';

    const form = host.querySelector('[data-venue-form]');
    const rows = host.querySelector('[data-court-rows]');

    host.querySelector('[data-add-court]').addEventListener('click', () => {
      addCourt(rows, null);
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      submit(form, rows, config);
    });

    if (mode === 'edit') {
      host.querySelectorAll('[data-delete-photo]').forEach(button => {
        button.addEventListener('click', () => {
          Api.del('/api/venues/photos/' + button.getAttribute('data-delete-photo')).then(res => {
            if (!res.ok) return UI.toast(res.error || 'Not allowed.', 'error');
            Store.flash('Photo removed.');
            go('/courts/' + venue.slug + '/edit', true);
          });
        });
      });
    }

    return undefined;
  }

  function hero(config) {
    const venue = config.venue;
    const create = config.mode === 'create';
    return '<section class="page-hero"><div class="shell page-hero__inner">' +
      '<nav class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span>' +
        '<a href="/dashboard/owner">Owner dashboard</a><span class="sep">/</span>' +
        '<span>' + esc(create ? 'New venue' : venue.name) + '</span></nav>' +
      '<p class="eyebrow">For venue owners</p>' +
      '<h1>' + (create ? 'List your pickleball venue' : 'Manage your venue') + '</h1>' +
      '<p>' + (create
        ? 'Tell us about the courts exactly as they are. An administrator reviews every submission' +
          ' before it appears in Browse Courts.'
        : 'Update your details, courts, and photos. Saving changes to an approved listing sends it' +
          ' back for a quick re-check.') + '</p>' +
      (venue && venue.status === 'rejected' && venue.review_note
        ? '<div class="form-errors">Reviewer note: ' + esc(venue.review_note) + '</div>' : '') +
    '</div></section>';
  }

  function formErrorsBlock(errors) {
    return '<div class="form-errors" data-nonfield-errors' +
      (errors && errors.__all__ ? '>' + errors.__all__.map(esc).join('<br>') : ' hidden>') +
      '</div>';
  }

  function infoCard(venue, facilities, selected) {
    const value = key => (venue ? venue[key] : '');
    return '<div class="form-card">' +
      '<h2 style="font-size:1.2rem;margin-bottom:18px;">Venue information</h2>' +
      '<div class="form-grid">' +
        UI.field({ name: 'name', label: 'Venue name', value: value('name'), full: true,
          attrs: ' placeholder="e.g. Lakeview Pickleball Courts"' }) +
        UI.field({ name: 'tagline', label: 'Short tagline', value: value('tagline'), full: true,
          attrs: ' placeholder="One short line about the venue"' }) +
        UI.field({ name: 'description', label: 'Description', type: 'textarea', value: value('description'),
          full: true, rows: 4,
          attrs: ' placeholder="Describe the courts, the surface, parking, and what players should expect."' }) +
        UI.field({ name: 'address', label: 'Street address', value: value('address'), full: true,
          attrs: ' placeholder="Street / landmark"' }) +
        UI.field({ name: 'barangay', label: 'Barangay', value: value('barangay') }) +
        UI.field({ name: 'city', label: 'City / municipality',
          value: venue ? venue.city : 'Marawi City' }) +
        UI.field({ name: 'province', label: 'Province',
          value: venue ? venue.province : 'Lanao del Sur' }) +
        UI.field({ name: 'setting', label: 'Court type', type: 'select', value: value('setting') || 'outdoor',
          options: SETTINGS }) +
        UI.field({ name: 'contact_phone', label: 'Contact number', value: value('contact_phone'),
          attrs: ' placeholder="+63 9XX XXX XXXX"' }) +
        UI.field({ name: 'contact_email', label: 'Contact email', type: 'email', value: value('contact_email') }) +
        UI.field({ name: 'rate_per_hour', label: 'Rate per hour (\u20B1)', type: 'number',
          value: venue && venue.rate_per_hour != null ? venue.rate_per_hour : '',
          attrs: ' step="0.01" min="0"', help: 'Leave blank if you prefer to quote on request.' }) +
        UI.field({ name: 'cover', label: 'Cover photo', type: 'file',
          attrs: ' accept="image/*" data-cover', help: 'Only upload images you have permission to publish.' }) +
        UI.field({ name: 'opening_time', label: 'Opens', type: 'time',
          value: value('opening_time') || '06:00' }) +
        UI.field({ name: 'closing_time', label: 'Closes', type: 'time',
          value: value('closing_time') || '22:00' }) +
      '</div>' +
      '<div class="form-row"><label>Facilities</label>' +
        UI.facilityChecklist(facilities, selected) +
        '<span class="form-error" data-error="facilities"></span></div>' +
    '</div>';
  }

  function courtsCard(venue) {
    const courts = venue ? venue.courts : [];
    return '<div class="form-card">' +
      '<h2 style="font-size:1.2rem;margin-bottom:6px;">Courts</h2>' +
      '<p class="form-text" style="margin-bottom:16px;">Add each playable court. Players book one court at a time.</p>' +
      '<div class="court-list" data-court-rows>' +
        courts.map(court => courtRow(court)).join('') +
        courtRow(null) +
      '</div>' +
      '<button class="btn btn--outline btn--sm" type="button" data-add-court>Add another court' +
        '<span class="btn__orb">' + icon('plus') + '</span></button>' +
    '</div>';
  }

  function courtRow(court) {
    const id = court ? court.id : '';
    const value = key => (court ? court[key] : '');
    return '<div class="court-row court-edit" data-court-index' +
      (court ? ' data-court-id="' + id + '"' : '') + ' style="grid-template-columns:1fr;gap:10px;">' +
      '<div class="form-grid">' +
        '<div class="form-row"><label>Court name</label>' +
          '<input class="form-control" data-field="name" value="' + esc(value('name')) +
          '" placeholder="Court 1"></div>' +
        '<div class="form-row"><label>Surface</label><select class="form-select" data-field="surface">' +
          SURFACES.map(option =>
            '<option value="' + option.value + '"' +
            ((value('surface') || 'acrylic') === option.value ? ' selected' : '') + '>' +
            option.label + '</option>').join('') +
        '</select></div>' +
        '<div class="form-row"><label>Hourly rate (optional)</label>' +
          '<input class="form-control" type="number" data-field="hourly_rate" step="0.01" min="0" value="' +
          esc(court && court.hourly_rate != null ? court.hourly_rate : '') + '"></div>' +
        '<div class="form-row"><label>Notes</label>' +
          '<input class="form-control" data-field="notes" value="' + esc(value('notes')) + '"></div>' +
        '<div class="form-row" style="flex-direction:row;gap:20px;align-items:center;">' +
          check('is_indoor', 'Indoor', court && court.is_indoor) +
          check('is_active', 'Active', court ? court.is_active !== false : true) +
          (court ? '<label class="form-check"><input type="checkbox" class="form-check-input"' +
            ' data-field="delete"> Remove</label>' : '') +
        '</div>' +
      '</div></div>';
  }

  function check(name, label, isChecked) {
    return '<label class="form-check"><input type="checkbox" class="form-check-input"' +
      ' data-field="' + name + '"' + (isChecked ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }

  function addCourt(rows) {
    rows.insertAdjacentHTML('beforeend', courtRow(null));
  }

  function galleryCard(venue) {
    const photos = venue.photos || [];
    return '<div class="form-card">' +
      '<h2 style="font-size:1.2rem;margin-bottom:6px;">Gallery photos</h2>' +
      '<p class="form-text" style="margin-bottom:14px;">Upload additional photos of the courts and facilities.</p>' +
      '<div class="form-row"><label for="photos">Add photos</label>' +
        '<input id="photos" class="form-control" type="file" data-photos multiple accept="image/*"></div>' +
      (photos.length
        ? '<div class="photo-strip">' + photos.map(photo =>
            '<figure class="photo-thumb"><img src="' + esc(photo.image) + '"' +
            ' alt="' + esc(photo.caption || 'Venue photo') + '">' +
            '<button class="photo-thumb__x" type="button" aria-label="Remove photo"' +
            ' data-delete-photo="' + photo.id + '">' + icon('close') + '</button></figure>').join('') +
          '</div>' : '') +
    '</div>';
  }

  function aside(venue, mode) {
    const checklist = [
      'Accurate address and contact details',
      'Courts that actually exist and are playable',
      'Rates you are willing to honour',
      'Photos you own or have permission to use',
      'No false "verified" or rating claims'
    ];
    return '<aside class="form-aside" data-reveal style="--delay:.08s">' +
      '<p class="eyebrow eyebrow--light">Review checklist</p><h3>What administrators check</h3><ul>' +
      checklist.map(item => '<li>' + icon('check') + '<span>' + esc(item) + '</span></li>').join('') +
      '</ul><div class="divider" style="background:rgba(255,255,255,.15)"></div>' +
      '<p style="font-size:.82rem;color:rgba(255,253,249,.7);">' +
        (mode === 'create'
          ? 'Your listing stays hidden until it is approved. You will see its status in the owner dashboard.'
          : 'Current status: <strong style="color:#fff;">' + esc(venue.status_display) + '</strong>') +
      '</p></aside>';
  }

  /* ---------- collecting and submitting ---------- */

  function collectCourts(rows) {
    return Array.from(rows.querySelectorAll('[data-court-index]')).map(scope => {
      const read = field => {
        const input = scope.querySelector('[data-field="' + field + '"]');
        return input || null;
      };
      const text = field => {
        const input = read(field);
        return input ? input.value : '';
      };
      const ticked = field => {
        const input = read(field);
        return !!(input && input.checked);
      };
      const idInput = scope.getAttribute('data-court-id');
      if (!text('name').trim() && !ticked('delete') && !idInput) return null;
      return {
        id: idInput || undefined,
        name: text('name'),
        surface: text('surface'),
        hourly_rate: text('hourly_rate'),
        notes: text('notes'),
        is_indoor: ticked('is_indoor'),
        is_active: ticked('is_active'),
        delete: ticked('delete')
      };
    }).filter(Boolean);
  }

  function submit(form, rows, config) {
    const values = UI.readForm(form);
    const payload = {
      name: values.name, tagline: values.tagline, description: values.description,
      address: values.address, barangay: values.barangay, city: values.city,
      province: values.province, setting: values.setting, contact_phone: values.contact_phone,
      contact_email: values.contact_email, rate_per_hour: values.rate_per_hour,
      opening_time: values.opening_time, closing_time: values.closing_time,
      facilities: values.facilities || [],
      courts: collectCourts(rows)
    };

    UI.readImage(form.querySelector('[data-cover]').files[0]).then(cover => {
      if (cover) payload.cover = cover;
      return config.mode === 'create' ? Promise.resolve(null) : readPhotos(form);
    }).then(photos => {
      if (photos) payload.photos = photos;
      const request = config.mode === 'create'
        ? Api.post('/api/venues', payload)
        : Api.put('/api/venues/' + encodeURIComponent(config.venue.slug), payload);

      request.then(res => {
        const nonField = form.querySelector('[data-nonfield-errors]');
        if (res.ok) {
          if (config.mode === 'create') {
            Store.flash('Venue submitted. An administrator will review the details before it appears publicly.');
            go('/dashboard/owner');
          } else {
            Store.flash('Venue updated.');
            go('/courts/' + res.venue.slug + '/edit', true);
          }
          return;
        }
        UI.paintErrors(form, res.errors);
        if (res.errors && res.errors.__all__) {
          nonField.hidden = false;
          nonField.innerHTML = res.errors.__all__.map(esc).join('<br>');
        } else {
          nonField.hidden = true;
          nonField.innerHTML = '';
        }
        if (res.redirect) go(res.redirect);
      });
    });
  }

  function readPhotos(form) {
    const input = form.querySelector('[data-photos]');
    if (!input || !input.files.length) return Promise.resolve(null);
    return Promise.all(Array.from(input.files).map(file => UI.readImage(file))).then(list =>
      list.filter(Boolean));
  }
})();
