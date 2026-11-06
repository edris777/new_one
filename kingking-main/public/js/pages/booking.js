/* ============================================================
   Booking request — templates/bookings/form.html
   The slot overlay (disable + "· taken") is the availability routine
   from static/js/main.js, unchanged: the option list is built once
   from the venue hours, and a date change only annotates it.
   ============================================================ */

(function () {
  const esc = UI.esc;

  Object.assign(PAGES, {
    bookingCreate: {
      render(host, params, query) {
        return Api.get('/api/courts/' + encodeURIComponent(params.courtId) + '/booking').then(res => {
          if (res.redirect) {
            Store.flash(res.error || 'That court is not open for public booking.', 'error');
            return { redirect: res.redirect };
          }
          if (!res.ok) {
            host.innerHTML = UI.notFound('Court not found.', 'No bookable court has that id.');
            return undefined;
          }

          const date = query.date || res.today;
          document.title = 'Request ' + res.court.name + ' — ' + res.venue.name + ' — DinkHub';
          host.innerHTML = page(res, date);
          wire(host, res, date);
          return undefined;
        });
      }
    }
  });

  function options(slots, selected) {
    return slots.map(slot =>
      '<option value="' + esc(slot.value) + '"' + (slot.value === selected ? ' selected' : '') + '>' +
      esc(slot.label) + '</option>').join('');
  }

  function page(res, date) {
    const court = res.court;
    const venue = res.venue;
    const slots = res.slots || [];
    const cover = venue.cover || '/img/court-outdoor.jpg';

    return '<section class="page-hero"><div class="shell page-hero__inner">' +
      '<nav class="breadcrumbs"><a href="/courts">Browse courts</a><span class="sep">/</span>' +
        '<a href="/courts/' + esc(venue.slug) + '">' + esc(venue.name) + '</a><span class="sep">/</span>' +
        '<span>Booking request</span></nav>' +
      '<p class="eyebrow">Booking request</p>' +
      '<h1>Reserve ' + esc(court.name) + '</h1>' +
      '<p>Pick a date and time that suits you. The owner reviews every request — a request is not' +
        ' yet a confirmed reservation.</p>' +
    '</div></section>' +
    '<section class="section" style="padding-top:34px;"><div class="shell two-col">' +
      '<div class="form-card" data-reveal>' +
        '<div class="booking-summary">' +
          '<img src="' + esc(cover) + '" alt="' + esc(venue.name) + '">' +
          '<div><h3>' + esc(venue.name) + ' · ' + esc(court.name) + '</h3>' +
            '<p>' + esc(venue.address + ', ' + venue.location_label) + '</p>' +
            '<p>' + esc(court.surface_display) + (court.is_indoor ? ' · indoor' : ' · outdoor') +
              ' · ' + esc(court.rate_display) + '</p></div>' +
        '</div>' +
        '<form class="booking-form" data-booking-form data-court="' + court.id + '" novalidate>' +
          '<div class="form-errors" data-nonfield-errors hidden></div>' +
          '<div class="form-grid">' +
            '<div class="form-row form-row--full"><label for="f-date">Date</label>' +
              '<input class="form-control" type="date" id="f-date" name="date" min="' + esc(res.today) +
              '" max="' + esc(res.max_date) + '" value="' + esc(date) + '">' +
              '<span class="form-error" data-error="date"></span></div>' +
            '<div class="form-row"><label for="f-start">Start time</label>' +
              '<select class="form-select" id="f-start" name="start_time">' +
              options(slots, slots.length ? slots[0].value : '') + '</select>' +
              '<span class="form-error" data-error="start_time"></span></div>' +
            '<div class="form-row"><label for="f-end">End time</label>' +
              '<select class="form-select" id="f-end" name="end_time">' +
              options(slots, slots.length > 1 ? slots[1].value : '') + '</select>' +
              '<span class="form-error" data-error="end_time"></span></div>' +
            '<div class="form-row form-row--full"><label for="f-note">Note for the owner (optional)</label>' +
              '<input class="form-control" id="f-note" name="note" placeholder="Optional note for the venue owner">' +
              '<span class="form-error" data-error="note"></span></div>' +
          '</div>' +
          '<p class="form-text" data-slot-note>Checking availability…</p>' +
          '<div class="divider" style="margin:18px 0;"></div>' +
          '<ul class="booking-aside__list">' +
            '<li style="display:flex;gap:8px;">' + icon('clock') +
              ' Venue hours: ' + esc(DATA.ampm(venue.opening_time) + ' – ' + DATA.ampm(venue.closing_time)) + '</li>' +
            '<li style="display:flex;gap:8px;">' + icon('shield') +
              ' Overlapping approved bookings are blocked on the server.</li>' +
            '<li style="display:flex;gap:8px;">' + icon('check') +
              ' Payment is settled with the venue — nothing is charged here.</li>' +
          '</ul>' +
          '<div class="form-actions">' +
            '<button class="btn btn--dark" type="submit">Send booking request' +
              '<span class="btn__orb">' + icon('arrow-right') + '</span></button>' +
            '<a class="btn btn--ghost" href="/courts/' + esc(venue.slug) + '">Back to venue</a>' +
          '</div>' +
        '</form>' +
      '</div>' +
      '<aside class="form-aside" data-reveal style="--delay:.08s">' +
        '<p class="eyebrow eyebrow--light">What happens next</p><h3>Request → review → play</h3><ul>' +
          '<li>' + icon('check') + '<span>Your request is saved as <strong style="color:#fff">Pending</strong>.</span></li>' +
          '<li>' + icon('check') + '<span>The venue owner approves or rejects it.</span></li>' +
          '<li>' + icon('check') + '<span>Approval re-checks availability before confirming.</span></li>' +
          '<li>' + icon('check') + '<span>Track the status in your player dashboard.</span></li>' +
        '</ul>' +
        '<div class="divider" style="background:rgba(255,255,255,.15)"></div>' +
        '<p style="font-size:.82rem;color:rgba(255,253,249,.72);">You can cancel a pending or approved' +
          ' booking from your dashboard as long as the date has not passed.</p>' +
      '</aside>' +
    '</div></section>';
  }

  function wire(host, res, date) {
    const form = host.querySelector('[data-booking-form]');
    const courtId = form.getAttribute('data-court');
    const dateInput = form.querySelector('[name="date"]');
    const startSelect = form.querySelector('[name="start_time"]');
    const endSelect = form.querySelector('[name="end_time"]');
    const note = host.querySelector('[data-slot-note]');

    function refreshAvailability() {
      if (!dateInput || !dateInput.value || !courtId) return;
      Api.get('/api/courts/' + courtId + '/availability', { date: dateInput.value })
        .then(data => {
          if (!data || !data.ok || !startSelect || !endSelect) return;
          [startSelect, endSelect].forEach(select => {
            Array.prototype.forEach.call(select.options, option => {
              option.disabled = false;
              option.textContent = option.textContent.replace(' · taken', '');
            });
          });
          const blocks = data.intervals || [];
          const summary = [];
          blocks.forEach(slot => {
            summary.push(slot.start + '–' + slot.end);
            [startSelect, endSelect].forEach(select => {
              Array.prototype.forEach.call(select.options, option => {
                if (option.value >= slot.start && option.value < slot.end) {
                  option.disabled = true;
                  if (option.textContent.indexOf('taken') === -1) {
                    option.textContent += ' · taken';
                  }
                }
              });
            });
          });
          if (note) {
            note.textContent = blocks.length
              ? 'Already taken on this date: ' + summary.join(', ')
              : 'Good news — nothing is booked yet on this date.';
          }
        })
        .catch(() => { /* availability is a hint; the server still validates */ });
    }

    dateInput.addEventListener('change', refreshAvailability);
    refreshAvailability();

    form.addEventListener('submit', event => {
      event.preventDefault();
      const values = UI.readForm(form);
      Api.post('/api/bookings', {
        court_id: courtId, date: values.date, start_time: values.start_time,
        end_time: values.end_time, note: values.note
      }).then(res2 => {
        if (res2.ok) {
          Store.flash(res2.message);
          go(res2.redirect || '/dashboard/player');
          return;
        }
        UI.paintErrors(form, res2.errors);
        const nonField = host.querySelector('[data-nonfield-errors]');
        const all = (res2.errors && res2.errors.__all__) || [];
        nonField.hidden = !all.length;
        nonField.innerHTML = all.map(esc).join('<br>');
      });
    });
  }
})();
