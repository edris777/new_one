/* ============================================================
   Courts · Booking engine · Schedule calendar
   Every write goes through Store.ops so the availability grid,
   the calendar, the ledger and the dashboard move together.
   ============================================================ */

(function () {
  const esc = s => UI.esc(s);
  const STATUS_LABEL = { available: 'Available', occupied: 'Occupied', maintenance: 'Maintenance', reserved: 'Reserved' };
  const KIND_LABEL = { Booking: 'Booking', Match: 'Match', Tournament: 'Tournament', Maintenance: 'Maintenance' };
  const KIND_ICON = { Booking: 'calendar', Match: 'paddle', Tournament: 'trophy', Maintenance: 'wrench' };

  const openCourts = () => Store.list('courts')
    .slice()
    .sort((a, b) => (a.venueId === b.venueId ? a.number - b.number : a.venueId.localeCompare(b.venueId)));

  const courtOptions = () => openCourts().map(c => ({
    value: c.id,
    label: c.name + ' · ' + Store.sel.venueName(c.venueId) + ' · ' + money(c.pricePerHour) + '/hr' +
      (c.status === 'maintenance' ? ' (maintenance)' : '')
  }));

  function slotTimes() {
    const s = Store.settings.booking;
    const out = [];
    for (let m = Store.mins(s.open); m + s.slotMinutes <= Store.mins(s.close); m += s.slotMinutes) out.push(m);
    return out;
  }

  /* ---------------- booking form (create + edit) ---------------- */
  function bookingFields(v) {
    v = v || {};
    const s = Store.settings.booking;
    const durs = [];
    for (let i = s.minHours; i <= s.maxHours; i++) durs.push({ value: i, label: i + (i === 1 ? ' hour' : ' hours') });
    return [
      { name: 'playerId', label: 'Player', type: 'select', col: 1, required: true, placeholder: 'Select a player…', options: UI.playerOptions(), value: v.playerId },
      { name: 'courtId', label: 'Court', type: 'select', col: 1, required: true, placeholder: 'Select a court…', options: courtOptions(), value: v.courtId },
      { name: 'date', label: 'Date', type: 'date', col: 1, required: true, value: v.date || Store.today(), min: Store.today(), max: Store.addDays(Store.today(), 90), help: 'Bookings open up to 90 days ahead.' },
      { name: 'duration', label: 'Duration', type: 'select', col: 1, required: true, options: durs, value: v.duration || s.minHours },
      { name: 'start', label: 'Start time', type: 'static', col: 2, html: '<div class="slot-strip" id="bkSlots">' +
        '<input type="hidden" name="start" id="bkStart" value="' + esc(v.start || '') + '">' +
        '<p class="dim">Pick a court and date to see what is free.</p></div>' },
      { name: 'format', label: 'Format', type: 'select', col: 1, options: ['Doubles', 'Singles', 'Open play'].map(x => ({ value: x, label: x })), value: v.format || 'Doubles' },
      { name: 'players', label: 'Players on court', type: 'number', col: 1, min: 2, max: 8, value: v.players || 4 },
      { name: 'method', label: 'Payment method', type: 'select', col: 1, required: true, options: UI.methodOptions, value: v.method },
      { name: 'total', label: 'Total due', type: 'static', col: 1, html: '<div id="bkPrice" class="static-val mono">—</div>' },
      { name: 'note', label: 'Note for the desk', type: 'textarea', col: 2, rows: 2, placeholder: 'Bringing 2 guests, needs a 4-ball jug…', value: v.note || '' }
    ];
  }

  function wireBookingForm(scope) {
    const read = () => UI.readForm(scope);

    function refreshSlots() {
      const v = read();
      const host = scope.querySelector('#bkSlots');
      if (!host) return;
      const current = scope.querySelector('#bkStart');
      /* the grid is rebuilt inside the field, so the picked time has to survive it */
      const keep = current ? current.value : (v.start || '');
      const hidden = '<input type="hidden" name="start" id="bkStart" value="' + esc(keep) + '">';
      const court = v.courtId ? Store.get('courts', v.courtId) : null;
      if (!court || !v.date) {
        host.innerHTML = hidden + '<p class="dim">Pick a court and date to see what is free.</p>';
        return;
      }
      const dur = Number(v.duration) || 1;
      const html = slotTimes().map(m => {
        const t = Store.hm(m);
        const end = Store.hm(m + dur * 60);
        const hit = Store.ops.conflictFor(court.id, v.date, t, dur);
        const down = court.status === 'maintenance';
        const cls = down ? 'slot is-down' : hit ? 'slot is-booked' : 'slot';
        const mine = hit && hit.playerId === v.playerId;
        return '<button type="button" class="' + cls + (mine ? ' is-mine' : '') + '" ' +
          'data-slot="' + t + '"' + (down || hit ? ' disabled title="' + (down ? 'Under maintenance' : 'Booked ' + hit.start + '–' + hit.end) + '"' : '') + '>' +
          '<span>' + t + '</span></button>';
      }).join('');
      host.innerHTML = hidden + html;
    }

    function refreshPrice() {
      const v = read();
      const box = scope.querySelector('#bkPrice');
      if (!box) return;
      const court = v.courtId ? Store.get('courts', v.courtId) : null;
      const player = v.playerId ? Store.get('players', v.playerId) : null;
      if (!court || !player) { box.textContent = '—'; return; }
      const p = Store.ops.quotePrice(court, player, Number(v.duration) || 1);
      box.innerHTML = money(p.total) +
        (p.discount ? ' <em class="dim" style="font-size:12px;font-style:normal">−' + money(p.discount) + ' ' + Store.tierName(player.membership) + '</em>' : '');
    }

    scope.addEventListener('click', e => {
      const s = e.target.closest('[data-slot]');
      if (!s || s.disabled) return;
      scope.querySelectorAll('[data-slot]').forEach(x => x.classList.remove('is-mine'));
      s.classList.add('is-mine');
      scope.querySelector('#bkStart').value = s.dataset.slot;
      refreshPrice();
    });
    scope.addEventListener('change', e => {
      if (['courtId', 'date', 'duration', 'playerId'].indexOf(e.target.name) > -1) {
        if (e.target.name !== 'playerId') {
          const h = scope.querySelector('#bkStart');
          if (h) h.value = '';
        }
        refreshSlots();
      }
      refreshPrice();
    });
    refreshSlots();
    refreshPrice();
  }

  function bookingModal(mode, seed) {
    const isEdit = mode === 'edit';
    const v = seed || {};
    UI.modal({
      title: isEdit ? 'Reschedule ' + v.id : 'Book a court',
      sub: isEdit ? 'Move or change this booking — the calendar and the invoice follow.' :
        'Availability, overlap, opening hours and membership pricing are all checked before the booking is written.',
      wide: true, sticky: true,
      body: UI.formHtml(bookingFields(v)),
      actions: isEdit ? [{ id: 'save', label: 'Save changes', cls: 'accent' }] :
        [{ id: 'hold', label: 'Hold as pending', cls: 'ghost' }, { id: 'save', label: 'Confirm & charge', cls: 'accent' }],
      onOpen(scope) { wireBookingForm(scope); },
      onAction(id, scope, done) {
        const vals = UI.readForm(scope);
        const payload = Object.assign({}, vals, {
          duration: Number(vals.duration), players: Number(vals.players) || 4,
          status: id === 'hold' ? 'pending' : 'confirmed'
        });
        if (!payload.start) {
          const errors = { start: 'Choose one of the free start times above.' };
          UI.paintErrors(scope, errors);
          UI.toast(errors.start, 'err');
          return false;
        }
        const res = isEdit ? Store.ops.updateBooking(v.id, payload) : Store.ops.createBooking(payload);
        if (!res.ok) {
          UI.paintErrors(scope, res.errors || {});
          UI.toast(Object.values(res.errors || {})[0] || 'That booking could not be saved.', 'err');
          return false;
        }
        done();
        UI.toast(isEdit ? 'Booking ' + v.id + ' moved to ' + Store.fmtDate(payload.date) + ' ' + payload.start
          : 'Booked · ' + money(res.booking.amount) + ' charged to ' + Store.sel.playerName(payload.playerId));
      }
    });
  }

  /* ---------------- booking detail ---------------- */
  function bookingDetail(b) {
    const court = Store.get('courts', b.courtId) || {};
    const venue = Store.sel.venueById(court.venueId) || {};
    const pay = Store.list('payments').find(p => p.refId === b.id);
    UI.modal({
      title: b.id,
      sub: Store.sel.playerName(b.playerId) + ' · ' + court.name,
      wide: true,
      body: '<dl class="kv">' +
        '<dt>Court</dt><dd>' + esc(court.name || '—') + ' · ' + esc(venue.name || '') + ' (Brgy. ' + esc(venue.barangay || '') + ')</dd>' +
        '<dt>Date</dt><dd>' + Store.fmtDate(b.date) + '</dd>' +
        '<dt>Time</dt><dd>' + b.start + ' – ' + b.end + ' (' + b.duration + 'h)</dd>' +
        '<dt>Format</dt><dd>' + esc(b.format) + ' · ' + b.players + ' players</dd>' +
        '<dt>Status</dt><dd>' + UI.badge(b.status) + '</dd>' +
        '<dt>Charge</dt><dd class="mono">' + money(b.amount) + (pay ? ' via ' + esc(pay.method) + ' · ' + esc(pay.id) : '') + '</dd>' +
        (b.note ? '<dt>Note</dt><dd>' + esc(b.note) + '</dd>' : '') +
        '</dl>' +
        (pay ? '<div class="actions" style="justify-content:flex-start;margin-top:18px"><button class="pill-btn ghost sm" data-receipt="' + esc(pay.id) + '">View receipt</button></div>' : ''),
      actions: b.status === 'cancelled' ? [] :
        [{ id: 'complete', label: 'Mark completed', cls: 'ghost' },
         { id: 'edit', label: 'Reschedule', cls: 'ghost' },
         { id: 'cancel', label: 'Cancel booking', cls: 'danger' }],
      onAction(id, scope, done) {
        const rec = scope.querySelector('[data-receipt]');
        if (id === 'close' || !id) return;
        if (id === 'complete') { Store.ops.completeBooking(b.id); done(); UI.toast(b.id + ' marked completed'); return; }
        if (id === 'edit') { done(); bookingModal('edit', Object.assign({}, b)); return; }
        if (id === 'cancel') {
          done();
          UI.confirm({
            title: 'Cancel ' + b.id + '?',
            body: 'This releases ' + court.name + ' at ' + b.start + ' on ' + Store.fmtDate(b.date) + ' so someone else can take it.',
            detail: pay && pay.status === 'paid' ? money(pay.amount) + ' (via ' + pay.method + ') will be marked refunded in the ledger.' : 'No payment is attached to this booking.',
            okLabel: 'Cancel booking', danger: true
          }).then(yes => {
            if (!yes) return UI.toast(b.id + ' kept', 'info');
            const r = Store.ops.cancelBooking(b.id, 'Cancelled from the booking detail');
            UI.toast(r.ok ? b.id + ' cancelled · slot released and availability updated' : r.errors.id, r.ok ? 'ok' : 'err');
          });
        }
        void rec;
      },
      onOpen(sc) {
        sc.addEventListener('click', e => {
          const t = e.target.closest('[data-receipt]');
          if (t) { const p = Store.get('payments', t.dataset.receipt); if (p) UI.printReceipt(p); }
        });
      }
    });
  }

  /* ---------------- court schedule modal ---------------- */
  function courtDayModal(court) {
    let date = Store.today();
    const m = UI.modal({
      title: court.name,
      sub: 'Hour-by-hour availability · ' + Store.sel.venueName(court.venueId),
      wide: true,
      body: '<div id="cdWrap"></div>',
      dismiss: true,
      actions: [{ id: 'book', label: 'Book this court', cls: 'accent' }],
      onAction(id, scope, done) {
        if (id !== 'book') return;
        done();
        bookingModal('new', { courtId: court.id, date: date });
      },
      onOpen(scope) {
        function draw() {
          const wrap = scope.querySelector('#cdWrap');
          const rows = Store.sel.bookingsFor(court.id, date);
          wrap.innerHTML = '<div class="cal-nav" style="margin-bottom:14px">' +
            '<button class="pill-btn ghost sm" data-cd="-1">Previous day</button>' +
            '<input type="date" id="cdDate" value="' + date + '">' +
            '<button class="pill-btn ghost sm" data-cd="1">Next day</button>' +
            '<span class="dim">' + rows.length + ' booking(s) · ' + money(court.pricePerHour) + '/hr</span></div>' +
            '<div class="slot-grid">' +
            slotTimes().map(tm => {
              const t = Store.hm(tm);
              const hit = rows.find(b => Store.mins(b.start) <= tm && tm < Store.mins(b.start) + b.duration * 60);
              return '<div class="slot-row" style="grid-template-columns:92px minmax(0,1fr) 150px">' +
                '<b>' + t + '</b>' +
                '<button type="button" class="slot ' + (hit ? 'is-booked' : '') + '" data-cell="' + t + '"' + (hit ? ' disabled' : '') + '></button>' +
                '<span class="dim">' + (hit ? esc(Store.sel.playerName(hit.playerId)) + ' · ' + hit.status : 'Free') + '</span></div>';
            }).join('') + '</div>';
          wrap.querySelector('#cdDate').addEventListener('change', e => { if (Store.isDate(e.target.value)) { date = e.target.value; draw(); } });
          wrap.querySelectorAll('[data-cd]').forEach(btn => btn.addEventListener('click', () => { date = Store.addDays(date, +btn.dataset.cd); draw(); }));
          wrap.querySelectorAll('[data-cell]:not([disabled])').forEach(cell => cell.addEventListener('click', () => {
            m.close();
            bookingModal('new', { courtId: court.id, date: date, start: cell.dataset.cell });
          }));
        }
        draw();
      }
    });
  }

  /* ---------------- event detail (calendar click) ---------------- */
  function eventDetail(ev) {
    if (ev.kind === 'Booking') {
      const b = Store.get('bookings', ev.id);
      return b ? bookingDetail(b) : UI.toast('That booking is no longer on file.', 'err');
    }
    if (ev.kind === 'Maintenance') {
      const c = Store.get('courts', ev.id);
      return c ? courtDetail(c) : null;
    }
    if (ev.kind === 'Tournament' && !ev.id.startsWith('M-')) {
      const t = Store.get('tournaments', ev.id);
      if (t) return UI.modal({ title: t.name, sub: t.event + ' · ' + Store.sel.venueName(t.venueId),
        body: '<dl class="kv"><dt>Status</dt><dd>' + UI.badge(t.status) + '</dd>' +
          '<dt>Dates</dt><dd>' + Store.fmtDate(t.start) + ' – ' + Store.fmtDate(t.end) + '</dd>' +
          '<dt>Format</dt><dd>' + esc(t.format) + '</dd>' +
          '<dt>Teams</dt><dd>' + t.teams.length + ' of ' + t.maxTeams + '</dd>' +
          '<dt>Entry</dt><dd>' + money(t.entryFee) + '</dd></dl>',
        actions: [{ id: 'open', label: 'Open tournaments', cls: 'ghost' }],
        onAction() { go('tournaments', t.id); } });
    }
    const m = Store.get('matches', ev.id);
    if (!m) return UI.toast('That record could not be found.', 'err');
    return UI.modal({
      title: m.code + ' · ' + m.round,
      sub: m.teamA + ' vs ' + m.teamB,
      body: '<dl class="kv"><dt>Event</dt><dd>' + esc(ev.title) + '</dd><dt>Where</dt><dd>' +
        esc(Store.sel.courtName(m.courtId)) + '</dd><dt>When</dt><dd>' + Store.fmtDate(m.date) + ' ' + m.time +
        '</dd><dt>Score</dt><dd>' + (m.scoreA === null ? 'not played' : m.scoreA + ' – ' + m.scoreB) + '</dd>' +
        '<dt>Winner</dt><dd>' + (m.winner ? esc(m.winner === 'A' ? m.teamA : m.teamB) : '—') + '</dd></dl>',
      actions: m.status === 'completed' ? [] : [{ id: 'score', label: 'Enter score', cls: 'accent' }],
      onAction(id, scope, done) {
        if (id !== 'score') return;
        done();
        scoreModal(m);
      }
    });
  }

  function scoreModal(m) {
    UI.modal({
      size: 'sm', sticky: true,
      title: 'Score · ' + m.code,
      sub: m.teamA + ' vs ' + m.teamB + ' · games to ' + m.gameTo,
      body: UI.formHtml([
        { name: 'scoreA', label: m.teamA, type: 'number', col: 1, min: 0, max: 30, value: m.scoreA === null ? '' : m.scoreA },
        { name: 'scoreB', label: m.teamB, type: 'number', col: 1, min: 0, max: 30, value: m.scoreB === null ? '' : m.scoreB },
        { name: 'note', label: 'Winner', type: 'static', col: 2, html: '<div class="static-val dim">Decided by the scores — there is no winner field.</div>' }
      ]),
      actions: [{ id: 'save', label: 'Save result', cls: 'accent' }],
      onAction(id, scope, done) {
        const res = Store.ops.enterScore(m.id, scope.querySelector('[name=scoreA]').value, scope.querySelector('[name=scoreB]').value);
        if (!res.ok) { UI.paintErrors(scope, res.errors); UI.toast(Object.values(res.errors)[0], 'err'); return false; }
        done();
        UI.toast(res.winner + ' wins — ladder points and the draw updated');
      }
    });
  }

  /* ---------------- court create/edit/detail ---------------- */
  function courtFields(c) {
    c = c || {};
    return [
      { name: 'name', label: 'Court name', col: 1, required: true, value: c.name, placeholder: 'Ranao Lake C3' },
      { name: 'number', label: 'Court number', type: 'number', col: 1, required: true, min: 1, max: 40, value: c.number || '' },
      { name: 'venueId', label: 'Venue', type: 'select', col: 1, required: true, placeholder: 'Select a venue…', options: UI.venueOptions(), value: c.venueId },
      { name: 'type', label: 'Surface / type', type: 'select', col: 1, value: c.type, options: ['Indoor acrylic', 'Outdoor concrete', 'Outdoor acrylic', 'Shaded concrete'].map(x => ({ value: x, label: x })) },
      { name: 'pricePerHour', label: 'Price per hour (₱)', type: 'number', col: 1, required: true, min: 1, max: 5000, value: c.pricePerHour || 80 },
      { name: 'status', label: 'Status', type: 'select', col: 1, value: c.status || 'available', options: Object.keys(STATUS_LABEL).map(k => ({ value: k, label: STATUS_LABEL[k] })) },
      { name: 'location', label: 'Location', col: 2, required: true, value: c.location, placeholder: 'Brgy. Patani, Marawi City' },
      { name: 'floodlit', label: 'Flood-lit for night play', type: 'checkbox', col: 1, value: !!c.floodlit },
      { name: 'note', label: 'Desk note', col: 1, value: c.note, placeholder: 'New nets fitted' }
    ];
  }

  function courtFormModal(c) {
    const isEdit = !!(c && c.id);
    UI.formModal({
      title: isEdit ? 'Edit ' + c.name : 'Add a court',
      sub: isEdit ? 'Pricing and status feed straight into availability and revenue.' : 'The court appears in the booking engine immediately.',
      fields: courtFields(c || { status: 'available' }),
      submitLabel: isEdit ? 'Save court' : 'Create court',
      onSubmit(v) {
        v.floodlit = !!v.floodlit;
        return isEdit ? Store.ops.updateCourt(c.id, v) : Store.ops.createCourt(v);
      },
      onDone(res) { UI.toast(isEdit ? 'Court updated' : 'Court ' + res.court.name + ' is bookable now'); }
    });
  }

  function courtDetail(c) {
    const today = Store.today();
    const month = today.slice(0, 7);
    const booked = Store.list('bookings').filter(b => b.courtId === c.id && b.status !== 'cancelled' && b.date.slice(0, 7) === month);
    const now = Store.sel.courtStatusNow(c);
    UI.modal({
      title: c.name,
      sub: Store.sel.venueName(c.venueId) + ' · ' + c.location,
      wide: true,
      body: '<div class="tiles" style="margin-bottom:18px">' +
        '<div class="tile"><span>Now</span><b style="font-size:16px">' + UI.badge(now, STATUS_LABEL[now]) + '</b></div>' +
        '<div class="tile"><span>Rate</span><b>' + money(c.pricePerHour) + '</b></div>' +
        '<div class="tile"><span>Hours booked this month</span><b>' + booked.reduce((s, b) => s + b.duration, 0) + 'h</b></div>' +
        '<div class="tile"><span>Bookings this month</span><b>' + booked.length + '</b></div></div>' +
        '<dl class="kv"><dt>Surface</dt><dd>' + esc(c.type) + '</dd>' +
        '<dt>Floodlit</dt><dd>' + (c.floodlit ? 'Yes — night play' : 'No') + '</dd>' +
        '<dt>Desk note</dt><dd>' + esc(c.note || '—') + '</dd></dl>' +
        '<div class="section-title">Today</div>' +
        '<div class="detail-list">' + (Store.sel.bookingsFor(c.id, today).map(b =>
          '<div class="day-row"><time>' + b.start + '</time><div><b>' + esc(Store.sel.playerName(b.playerId)) + '</b><em>' + b.duration + 'h · ' + esc(b.format) + '</em></div>' +
          UI.badge(b.status) + '</div>').join('') || UI.empty('calendar', 'No bookings today.', 'This court is wide open.')) + '</div>',
      actions: [{ id: 'grid', label: 'Full availability', cls: 'ghost' }, { id: 'status', label: 'Change status', cls: 'ghost' }, { id: 'book', label: 'Book it', cls: 'accent' }],
      onAction(id, scope, done) {
        if (id === 'grid') { done(); courtDayModal(c); return; }
        if (id === 'book') { done(); bookingModal('new', { courtId: c.id }); return; }
        if (id === 'status') {
          done();
          courtStatusModal(c);
        }
      }
    });
  }

  function courtStatusModal(c) {
    UI.formModal({
      title: 'Status · ' + c.name,
      sub: 'Availability, the booking engine and the calendar all read this immediately.',
      fields: [
        { name: 'status', label: 'New status', type: 'select', col: 2, value: c.status === 'occupied' ? 'available' : c.status, options: Object.keys(STATUS_LABEL).filter(k => k !== 'occupied').map(k => ({ value: k, label: STATUS_LABEL[k] })) },
        { name: 'note', label: 'Reason / note', col: 2, value: c.note, placeholder: 'Crack near the left sideline — awaiting resin' }
      ],
      submitLabel: 'Apply status',
      onSubmit(v) {
        if (v.status === 'maintenance') {
          const hits = Store.list('bookings').filter(b => b.courtId === c.id && b.date >= Store.today() && b.status === 'confirmed');
          if (hits.length && !v.confirmed) {
            v.note = v.note || 'Resurfacing';
            return UI.confirm({
              title: 'Take ' + c.name + ' off line?',
              body: 'Maintenance releases every upcoming booking on this court so members can rebook.',
              detail: hits.length + ' confirmed booking(s) will be cancelled and their invoices marked refunded.',
              okLabel: 'Yes, close the court', danger: true
            }).then(yes => yes ? Store.ops.setCourtStatus(c.id, 'maintenance', v.note) : { ok: false, errors: { status: 'Cancelled — no change made.' } });
          }
        }
        return Store.ops.setCourtStatus(c.id, v.status, v.note);
      },
      onDone() { UI.toast(c.name + ' status updated'); }
    });
  }

  /* ============================================================
     PAGES
     ============================================================ */

  const courtsPage = {
    render(host) {
      const stats = Store.sel.stats();
      const nowCounts = { available: 0, occupied: 0, maintenance: 0, reserved: 0 };
      Store.list('courts').forEach(c => { nowCounts[Store.sel.courtStatusNow(c)]++; });

      host.innerHTML =
        '<div class="page-head"><div><h2>Court management</h2>' +
        '<p>' + stats.courts + ' courts across ' + Store.sel.dashboardVenueLoad().length + ' Marawi venues. Status, pricing and surface drive availability, the booking engine and revenue.</p></div>' +
        '<div class="page-tools"><button class="pill-btn ghost" id="ctCsv">' + icon('download', 16) + 'Export CSV</button>' +
        '<button class="pill-btn primary" id="ctAdd">' + icon('plus', 16) + 'Add court</button></div></div>' +

        '<div class="kpi-grid">' +
        UI.kpi({ icon: 'court', label: 'Total courts', value: stats.courts, sub: 'across the club network' }) +
        UI.kpi({ icon: 'check', label: 'Available now', value: nowCounts.available, sub: 'free to book at this moment', delta: '+' + Math.round(nowCounts.available / Math.max(1, stats.courts) * 100) + '%', deltaDir: 'up' }) +
        UI.kpi({ icon: 'paddle', label: 'In play now', value: nowCounts.occupied, sub: 'courts with a live booking' }) +
        UI.kpi({ icon: 'wrench', label: 'Under maintenance', value: nowCounts.maintenance, sub: 'blocked in the booking engine', deltaDir: 'down' }) +
        '</div>' +

        '<div class="panel" style="margin-top:22px"><div id="ctTable"></div></div>';

      UI.table(host.querySelector('#ctTable'), {
        id: 'courts',
        columns: [
          { key: 'name', label: 'Court', sortable: true, render: c => '<div class="who"><span class="ava" style="background:' +
            (c.status === 'maintenance' ? '#f4a036' : '#6b7cff') + '">' + icon('court', 16) + '</span><div><b>' + esc(c.name) + '</b>' +
            '<em>' + esc(c.type) + (c.floodlit ? ' · flood-lit' : '') + '</em></div></div>' },
          { key: 'venueId', label: 'Venue', sortable: true, sortValue: c => Store.sel.venueName(c.venueId), render: c => '<div><b>' + esc(Store.sel.venueName(c.venueId)) + '</b><em class="dim">' + esc(c.location) + '</em></div>' },
          { key: 'status', label: 'Right now', sortable: true, sortValue: c => Store.sel.courtStatusNow(c), filterValue: c => Store.sel.courtStatusNow(c), render: c => UI.badge(Store.sel.courtStatusNow(c), STATUS_LABEL[Store.sel.courtStatusNow(c)]) },
          { key: 'pricePerHour', label: 'Rate / hr', sortable: true, align: 'right', render: c => '<span class="mono">' + money(c.pricePerHour) + '</span>' },
          { key: 'today', label: 'Booked today', sortable: true, align: 'right', sortValue: c => Store.sel.bookingsFor(c.id, Store.today()).length, render: c => {
            const t = Store.sel.bookingsFor(c.id, Store.today());
            const hrs = t.reduce((s, b) => s + b.duration, 0);
            return '<div class="mono">' + t.length + ' <em class="dim" style="font-size:12px;font-style:normal">/ ' + hrs + 'h</em></div>';
          } },
          { key: 'month', label: 'This month', sortable: true, align: 'right', sortValue: c => Store.list('bookings').filter(b => b.courtId === c.id && b.date.slice(0, 7) === Store.today().slice(0, 7)).length, render: c => {
            const rows = Store.list('bookings').filter(b => b.courtId === c.id && b.status !== 'cancelled' && b.date.slice(0, 7) === Store.today().slice(0, 7));
            return '<div class="mono">' + rows.length + ' <em class="dim" style="font-size:12px;font-style:normal">/ ' + money(rows.reduce((s, b) => s + b.amount, 0)) + '</em></div>';
          } }
        ],
        rows: openCourts,
        searchKeys: ['name', 'location', 'type'], searchLabel: 'Search courts, venues or surfaces…',
        filters: [
          { key: 'venueId', label: 'All venues', options: UI.venueOptions().filter(o => !/no decks yet/.test(o.label)) },
          { key: 'status', label: 'Any status', options: Object.keys(STATUS_LABEL).map(k => ({ value: k, label: STATUS_LABEL[k] })) },
          { key: 'type', label: 'Any surface', options: ['Indoor acrylic', 'Outdoor concrete', 'Outdoor acrylic', 'Shaded concrete'].map(x => ({ value: x, label: x })) }
        ],
        per: 10,
        rowActions: c => UI.actionBtn('grid', 'View schedule', '', 'grid') + UI.actionBtn('status', 'Change status', '', 'sliders') +
          UI.actionBtn('edit', 'Edit', '', 'pen') + UI.actionBtn('del', 'Delete', 'danger', 'trash'),
        onAction(act, c, redraw) {
          if (act === 'grid') return courtDayModal(c);
          if (act === 'status') return courtStatusModal(c);
          if (act === 'edit') return courtFormModal(c);
          if (act === 'del') {
            UI.confirm({
              title: 'Retire ' + c.name + '?',
              body: 'The court disappears from the booking engine and the availability grid.',
              detail: 'Upcoming bookings must be cancelled first — the club will tell you if any still hold this court.',
              okLabel: 'Retire court', danger: true
            }).then(yes => {
              if (!yes) return;
              const r = Store.ops.deleteCourt(c.id);
              UI.toast(r.ok ? c.name + ' retired' : (r.errors && r.errors.id) || 'Court could not be removed.', r.ok ? 'ok' : 'err');
              if (!r.ok) redraw();
            });
          }
        }
      });

      host.querySelector('#ctAdd').addEventListener('click', () => courtFormModal(null));
      host.querySelector('#ctCsv').addEventListener('click', () => {
        const n = UI.csv('piklemarawi-courts-' + Store.today() + '.csv', [
          { label: 'Court', key: 'name' }, { label: 'Venue', value: c => Store.sel.venueName(c.venueId) },
          { label: 'Location', key: 'location' }, { label: 'Surface', key: 'type' },
          { label: 'Status', value: c => Store.sel.courtStatusNow(c) }, { label: 'Price per hour', key: 'pricePerHour' }
        ], openCourts());
        UI.toast(n + ' courts exported');
      });

      /* deep links: a search hit opens the deck, a venue card's "Add decks"
         opens the form already pointed at that venue */
      const st = PMSTATE();
      if (st.focus && st.focus !== 'new') {
        const hit = Store.get('courts', st.focus);
        st.focus = null;
        if (hit) return courtDetail(hit);
      } else if (st.focus === 'new') {
        st.focus = null;
        return courtFormModal({ status: 'available' });
      }
      if (st.newCourt && Date.now() - st.newCourt.at < 20000) {
        const wanted = st.newCourt;
        st.newCourt = null;
        const v = Store.get('venues', wanted.id);
        if (!v) return;
        const decks = Store.sel.venuesForVenue(v.id);
        const next = decks.reduce((m, c) => Math.max(m, Number(c.number) || 0), 0) + 1;
        courtFormModal({
          venueId: v.id, number: next, status: 'available', pricePerHour: v.price,
          name: v.name.split(' ')[0] + ' C' + next,
          location: 'Brgy. ' + v.barangay + ', ' + CLUB.city,
          type: v.indoor ? 'Indoor acrylic' : 'Outdoor concrete'
        });
      }
    }
  };

  const bookingPage = {
    render(host) {
      const stats = Store.sel.stats();
      const st = PMSTATE();
      host.innerHTML =
        '<div class="page-head"><div><h2>Bookings</h2>' +
        '<p>' + stats.todayBookings + ' on the books today · ' + stats.inPlayNow + ' court(s) in play right now. ' +
        'The engine blocks double bookings, past dates, closed hours and courts taken off line.</p></div>' +
        '<div class="page-tools"><button class="pill-btn ghost" id="bkCsv">Export CSV</button>' +
        '<button class="pill-btn primary" id="bkNew">' + icon('plus', 16) + 'New booking</button></div></div>' +

        '<div class="kpi-grid">' +
        UI.kpi({ icon: 'calendar', label: 'Today', value: stats.todayBookings, sub: stats.inPlayNow + ' happening right now' }) +
        UI.kpi({ icon: 'clock', label: 'Pending payment', value: Store.sel.bookingFunnel().pending, sub: 'held but not charged yet' }) +
        UI.kpi({ icon: 'check', label: 'Completed', value: Store.sel.bookingFunnel().completed, sub: 'games played out' }) +
        UI.kpi({ icon: 'ban', label: 'Cancellation rate', value: Store.sel.bookingFunnel().cancelRate + '%', sub: Store.sel.bookingFunnel().cancelled + ' of ' + Store.sel.bookingFunnel().total + ' bookings' }) +
        '</div>' +

        '<div class="panel" style="margin-top:22px"><div id="bkTable"></div></div>';

      UI.table(host.querySelector('#bkTable'), {
        id: 'bookings',
        columns: [
          { key: 'id', label: 'Ref', sortable: true, width: '86px', render: b => '<span class="mono">' + b.id + '</span>' },
          { key: 'player', label: 'Player', sortable: true, sortValue: b => Store.sel.playerName(b.playerId), render: b => {
            const p = Store.get('players', b.playerId) || { name: 'Member' };
            return '<div class="who">' + UI.avatar(p.name, '#6b7cff') + '<div><b>' + esc(p.name) + '</b>' +
              '<em>' + Store.tierName(p.membership || 'starter') + '</em></div></div>';
          } },
          { key: 'court', label: 'Court', sortable: true, sortValue: b => Store.sel.courtName(b.courtId), render: b => '<div><b>' + esc(Store.sel.courtName(b.courtId)) + '</b>' +
            '<em class="dim">' + esc(Store.sel.venueName((Store.get('courts', b.courtId) || {}).venueId)) + '</em></div>' },
          { key: 'date', label: 'When', sortable: true, sortValue: b => b.date + b.start, render: b => '<div class="mono">' + Store.fmtDate(b.date) + '</div><em class="dim">' + b.start + '–' + b.end + ' · ' + b.duration + 'h</em>' },
          { key: 'amount', label: 'Amount', sortable: true, align: 'right', render: b => '<span class="mono">' + money(b.amount) + '</span>' },
          { key: 'method', label: 'Method', render: b => '<span class="dim">' + esc(b.method || '—') + '</span>' },
          { key: 'status', label: 'Status', sortable: true, render: b => UI.badge(b.status) }
        ],
        rows: () => Store.list('bookings').slice().sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)),
        searchKeys: ['id', b => Store.sel.playerName(b.playerId), b => Store.sel.courtName(b.courtId), 'date'],
        searchLabel: 'Search by player, court, ref or date…',
        filters: [
          { key: 'status', label: 'Any status', options: ['confirmed', 'pending', 'completed', 'cancelled'].map(s => ({ value: s, label: s })) },
          { key: 'court', label: 'Any court', options: courtOptions(), filterValue: b => b.courtId },
          { key: 'when', label: 'Any time', options: [{ value: 'today', label: 'Today' }, { value: 'up', label: 'Upcoming' }, { value: 'past', label: 'Past' }],
            filterValue: b => b.date === Store.today() ? 'today' : b.date > Store.today() ? 'up' : 'past' }
        ],
        per: 10,
        bulk: [
          { id: 'export', label: 'Export selection', run(ids) {
            const rows = Store.list('bookings').filter(b => ids.indexOf(b.id) > -1);
            UI.csv('piklemarawi-bookings-' + Store.today() + '.csv', [
              { label: 'Ref', key: 'id' }, { label: 'Player', value: b => Store.sel.playerName(b.playerId) },
              { label: 'Court', value: b => Store.sel.courtName(b.courtId) }, { label: 'Date', key: 'date' },
              { label: 'Start', key: 'start' }, { label: 'Hours', key: 'duration' }, { label: 'Amount', key: 'amount' },
              { label: 'Status', key: 'status' }], rows);
            UI.toast(rows.length + ' booking(s) exported');
          } }
        ],
        rowActions: b => UI.actionBtn('view', 'Details', '', 'eye') +
          (b.status === 'cancelled' ? '' : UI.actionBtn('edit', 'Reschedule', '', 'pen')) +
          (['confirmed', 'pending'].indexOf(b.status) < 0 ? '' :
            UI.actionBtn('done', 'Mark completed', '', 'check') + UI.actionBtn('cancel', 'Cancel', 'danger', 'ban')),
        onAction(act, b, redraw) {
          if (act === 'view') return bookingDetail(b);
          if (act === 'edit') return bookingModal('edit', Object.assign({}, b));
          if (act === 'done') { Store.ops.completeBooking(b.id); return UI.toast(b.id + ' marked completed'); }
          if (act === 'cancel') {
            UI.confirm({
              title: 'Cancel ' + b.id + '?',
              body: 'The court goes back on sale immediately and the calendar updates.',
              detail: 'Any paid invoice attached to it is marked refunded, which moves today’s revenue.',
              okLabel: 'Cancel booking', danger: true
            }).then(yes => {
              if (!yes) return;
              const r = Store.ops.cancelBooking(b.id);
              UI.toast(r.ok ? b.id + ' cancelled · slot released' + (r.refunded ? ' · ' + money(r.refunded) + ' refunded' : '') : r.errors.id, r.ok ? 'ok' : 'err');
              redraw();
            });
          }
          void st;
        }
      });

      host.querySelector('#bkNew').addEventListener('click', () => bookingModal('new', { venue: st.venue }));
      host.querySelector('#bkCsv').addEventListener('click', () => {
        const rows = Store.list('bookings');
        UI.csv('piklemarawi-bookings-' + Store.today() + '.csv', [
          { label: 'Ref', key: 'id' }, { label: 'Player', value: b => Store.sel.playerName(b.playerId) },
          { label: 'Court', value: b => Store.sel.courtName(b.courtId) }, { label: 'Date', key: 'date' },
          { label: 'Start', key: 'start' }, { label: 'End', key: 'end' }, { label: 'Hours', key: 'duration' },
          { label: 'Amount', key: 'amount' }, { label: 'Status', key: 'status' }, { label: 'Method', key: 'method' }], rows);
        UI.toast(rows.length + ' bookings exported');
      });

      if (st.focus === 'new') {
        st.focus = null;
        /* the dashboard availability board hands over a court, date and time;
           a "Book" button hands over only the venue, so pick its first court */
        const seed = st.seed || {};
        st.seed = null;
        const fromVenue = st.venue ? Store.list('courts').find(c => c.venueId === st.venue) : null;
        bookingModal('new', {
          courtId: seed.courtId || (fromVenue ? fromVenue.id : null),
          date: seed.date || Store.today(),
          start: seed.start || ''
        });
      }
      else if (st.focus) {
        const hit = Store.get('bookings', st.focus);
        st.focus = null;
        if (hit) bookingDetail(hit);
      }
    }
  };

  /* ---------------- schedule ---------------- */
  const KIND_TONE = { Booking: 'is-Booking', Match: 'is-Match', Tournament: 'is-Tournament', Maintenance: 'is-Maintenance' };

  const schedulePage = {
    render(host) {
      const st = PMSTATE();
      const view = st.sub || 'Month';
      let anchor = st.date || Store.today();

      host.innerHTML =
        '<div class="page-head"><div><h2>Court schedule</h2>' +
        '<p>Bookings, matches, tournaments and maintenance on one board. Pick any day for the hour-by-hour grid.</p></div>' +
        '<div class="page-tools">' +
        '<div class="seg" id="svSeg">' + ['Month', 'Week', 'Day'].map(v =>
          '<button data-v="' + v + '" class="' + (v === view ? 'is-active' : '') + '">' + v + '</button>').join('') + '</div>' +
        '<button class="pill-btn ghost" id="sPrev" aria-label="Previous">' + icon('chevron-left', 16) + '</button>' +
        '<button class="pill-btn ghost" id="sToday">Today</button>' +
        '<button class="pill-btn ghost" id="sNext" aria-label="Next">' + icon('chevron-right', 16) + '</button>' +
        '<input type="date" id="sDate" value="' + anchor + '">' +
        '<button class="pill-btn primary" id="sNew">' + icon('plus', 16) + 'Book a court</button></div></div>' +

        '<div class="legend-row">' + Object.keys(KIND_LABEL).map(k =>
          '<span class="cal-ev ' + KIND_TONE[k] + '" style="cursor:default">' + icon(KIND_ICON[k], 13) + ' ' + KIND_LABEL[k] + '</span>').join('') + '</div>' +

        '<div class="panel" id="schBody" style="margin-top:16px"></div>';

      const body = host.querySelector('#schBody');

      function dayEvents(d) { return Store.sel.eventsOn(d); }

      function drawMonth() {
        const first = anchor.slice(0, 8) + '01';
        const startDow = (Store.parseDate(first).getDay() + 6) % 7; /* Monday first */
        const start = Store.addDays(first, -startDow);
        const monthNum = anchor.slice(0, 7);
        let cells = '';
        for (let i = 0; i < 42; i++) {
          const d = Store.addDays(start, i);
          const evs = dayEvents(d);
          const out = d.slice(0, 7) !== monthNum;
          cells += '<div class="cal-cell' + (out ? ' is-out' : '') + (d === Store.today() ? ' is-today' : '') + '" data-d="' + d + '">' +
            '<div class="cal-day"><b>' + +d.slice(8, 10) + '</b><span>' + ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][i % 7] + '</span></div>' +
            evs.slice(0, 3).map(e => '<div class="cal-ev ' + KIND_TONE[e.kind] + '">' + e.at + ' ' + esc(e.title) + '</div>').join('') +
            (evs.length > 3 ? '<div class="cal-more">+' + (evs.length - 3) + ' more</div>' : '') +
            '</div>';
        }
        body.innerHTML = '<div class="panel-head"><h3>' + Store.monthLabel(monthNum) + '</h3>' +
          '<p>' + dayEvents(anchor).length + ' records on ' + Store.fmtDate(anchor) + '</p></div>' +
          '<div class="cal-dow">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => '<span>' + x + '</span>').join('') + '</div>' +
          '<div class="cal-grid">' + cells + '</div>';
        body.querySelectorAll('[data-d]').forEach(c => c.addEventListener('click', () => {
          anchor = c.dataset.d;
          st.sub = 'Day'; st.date = anchor;
          draw();
        }));
      }

      function drawWeek() {
        const dow = (Store.parseDate(anchor).getDay() + 6) % 7;
        const monday = Store.addDays(anchor, -dow);
        body.innerHTML = '<div class="panel-head"><h3>Week of ' + Store.fmtDate(monday) + '</h3>' +
          '<p>Click any record to open it · click a free day column header to book</p></div>' +
          '<div class="cal-grid week7">' + Array.from({ length: 7 }, (_, i) => {
            const d = Store.addDays(monday, i);
            const evs = dayEvents(d);
            return '<div class="cal-cell daycol' + (d === Store.today() ? ' is-today' : '') + '">' +
              '<div class="cal-day"><b>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] + ' ' + +d.slice(8, 10) + '</b>' +
              '<button class="pill-btn ghost sm" data-addday="' + d + '">' + icon('plus', 13) + '</button></div>' +
              (evs.length ? evs.map(e => '<div class="cal-ev ' + KIND_TONE[e.kind] + '" data-ev="' + esc(e.id) + '" data-kind="' + e.kind + '" data-day="' + d + '">' +
                e.at + ' ' + esc(e.title) + '</div>').join('') : '<p class="dim" style="font-size:12.5px">Nothing on</p>') +
              '</div>';
          }).join('') + '</div>';
        wireCells();
      }

      function drawDay() {
        const evs = dayEvents(anchor);
        const grid = Store.sel.gridFor(anchor);
        body.innerHTML = '<div class="panel-head"><h3>' + Store.fmtDate(anchor) + '</h3>' +
          '<p>' + evs.length + ' record(s) · ' + grid.rows.length + ' courts · open ' + Store.settings.booking.open + '–' + Store.settings.booking.close + '</p></div>' +
          '<div class="split"><div>' +
          (evs.length ? '<div class="day-list">' + evs.map(e =>
            '<div class="day-row" data-ev="' + esc(e.id) + '" data-kind="' + e.kind + '"><time>' + e.at + '</time>' +
            '<div><b>' + esc(e.title) + '</b><em>' + esc(e.body) + '</em></div>' +
            '<span class="cal-ev ' + KIND_TONE[e.kind] + '" style="cursor:default">' + e.kind + '</span></div>').join('') + '</div>'
            : UI.empty('calendar', 'Nothing scheduled.', 'This day is completely open across every court.',
              '<button class="pill-btn accent" data-addday="' + anchor + '">Book a court</button>')) +
          '</div><div>' +
          '<div class="section-title" style="margin-top:0">Availability · ' + Store.fmtDate(anchor) + '</div>' +
          '<div class="tbl-wrap"><div class="slot-grid" style="--slot-cols:' + grid.times.length + '">' +
          '<div class="slot-head"><span></span>' + grid.times.map(t => '<span>' + t.slice(0, 2) + '</span>').join('') + '</div>' +
          grid.rows.map(r => '<div class="slot-row"><b title="' + esc(r.court.name) + '">' + esc(r.court.name) + '</b>' +
            r.cells.map((cell, i) => '<button class="slot ' + (cell === 1 ? 'is-booked' : cell === 3 ? 'is-part' : '') + '" ' +
              (cell ? 'disabled title="' + (r.court.status === 'maintenance' ? 'Under maintenance' : 'Booked') + '"' : '') +
              ' data-free="' + esc(r.court.id) + '|' + grid.times[i] + '"></button>').join('') + '</div>').join('') +
          '</div></div>' +
          '</div></div>';
        wireCells();
        body.querySelectorAll('[data-free]').forEach(el => el.addEventListener('click', () => {
          const parts = el.dataset.free.split('|');
          bookingModal('new', { courtId: parts[0], date: anchor, start: parts[1] });
        }));
      }

      function wireCells() {
        body.querySelectorAll('[data-ev]').forEach(el => el.addEventListener('click', () => {
          const day = el.dataset.day || anchor;
          const ev = dayEvents(day).find(x => x.id === el.dataset.ev && x.kind === el.dataset.kind) ||
            { kind: el.dataset.kind, id: el.dataset.ev, title: '', body: '', date: day, at: '' };
          eventDetail(ev);
        }));
        body.querySelectorAll('[data-addday]').forEach(el => el.addEventListener('click', () => {
          bookingModal('new', { date: el.dataset.addday });
        }));
      }

      function draw() {
        const v = st.sub || 'Month';
        host.querySelectorAll('#svSeg [data-v]').forEach(b => b.classList.toggle('is-active', b.dataset.v === v));
        host.querySelector('#sDate').value = anchor;
        if (v === 'Month') drawMonth(); else if (v === 'Week') drawWeek(); else drawDay();
      }

      host.querySelectorAll('#svSeg [data-v]').forEach(b => b.addEventListener('click', () => { st.tab = 'schedule'; st.sub = b.dataset.v; draw(); }));
      const p2 = n => (n < 10 ? '0' : '') + n;
      const addMonths = (s, n) => {
        const d = Store.parseDate(s);
        const day = +s.slice(8, 10);
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, last));
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      };
      const shift = n => {
        const v = st.sub || 'Month';
        anchor = v === 'Month' ? addMonths(anchor, n) : Store.addDays(anchor, v === 'Week' ? (n * 7) : n);
        st.date = anchor;
        draw();
      };
      host.querySelector('#sPrev').addEventListener('click', () => shift(-1));
      host.querySelector('#sNext').addEventListener('click', () => shift(1));
      host.querySelector('#sToday').addEventListener('click', () => { anchor = Store.today(); st.date = anchor; draw(); });
      host.querySelector('#sDate').addEventListener('change', e => { if (Store.isDate(e.target.value)) { anchor = e.target.value; st.date = anchor; draw(); } });
      host.querySelector('#sNew').addEventListener('click', () => bookingModal('new', { date: anchor }));

      draw();

      if (st.focus === 'new') { st.focus = null; bookingModal('new', { date: anchor }); }
    }
  };

  Object.assign(PAGES, { courts: courtsPage, booking: bookingPage, schedule: schedulePage });
})();
