/* ============================================================
   Booking receipt — templates/bookings/receipt.html
   The printable record page a player, the venue owner or an
   administrator may open.
   ============================================================ */

(function () {
  const esc = UI.esc;

  Object.assign(PAGES, {
    receipt: {
      render(host, params) {
        return Api.get('/api/bookings/' + encodeURIComponent(params.reference)).then(res => {
          if (res.status === 403 || res.status === 404) {
            host.innerHTML = UI.notFound(res.status === 403 ? 'Not allowed.' : 'Booking not found.',
              res.error || 'This receipt belongs to another account.');
            return undefined;
          }
          const booking = res.booking;
          document.title = 'Booking ' + booking.reference + ' — DinkHub';
          host.innerHTML = '<div class="shell">' + card(booking) + '</div>';
          return { title: 'Booking ' + booking.reference + ' — DinkHub' };
        });
      }
    }
  });

  function line(label, value) {
    return '<div class="receipt__row"><span>' + esc(label) + '</span><strong>' + value + '</strong></div>';
  }

  function card(booking) {
    const note = booking.status === 'approved'
      ? 'This is a confirmed reservation. Please settle the court fee directly with the venue.'
      : booking.status === 'pending'
        ? 'This request is waiting for the venue owner. It is not a confirmed reservation yet.'
        : 'This booking is ' + DATA.BOOKING_STATUS_LABELS[booking.status].toLowerCase() + '.';

    const rows = [
      line('Venue', esc(booking.venue_name)),
      line('Court', esc(booking.court_name)),
      line('Date', esc(DATA.fullDate(booking.date))),
      line('Time', esc(booking.time_label)),
      line('Duration', esc(booking.duration_hours) + ' hour(s)'),
      line('Player', esc(booking.player_name))
    ];
    if (booking.total_amount) {
      rows.push(line('Estimated total', '\u20B1' + Number(booking.total_amount).toFixed(2)));
    }
    if (booking.decided_at) {
      rows.push(line('Decision', esc(DATA.stampLabel(booking.decided_at) +
        (booking.decided_by_name ? ' by ' + booking.decided_by_name : ''))));
    }
    if (booking.decision_note) rows.push(line('Owner note', esc(booking.decision_note)));

    return '<article class="receipt">' +
      '<p class="eyebrow">Booking record</p>' +
      '<h1>' + esc(booking.reference) + '</h1>' +
      '<p style="color:var(--ink-soft);margin-bottom:18px;">' +
        UI.badge(booking.status_tone, DATA.BOOKING_STATUS_LABELS[booking.status]) + '</p>' +
      rows.join('') +
      '<p class="form-text" style="margin-top:18px;">' + esc(note) + '</p>' +
      '<div class="form-actions">' +
        '<a class="btn btn--dark btn--sm" href="' + esc(Store.sel.dashboardUrl()) + '">Back to dashboard</a>' +
        '<a class="btn btn--ghost btn--sm" href="/courts/' + esc(booking.venue_slug) + '">View venue</a>' +
      '</div></article>';
  }
})();
