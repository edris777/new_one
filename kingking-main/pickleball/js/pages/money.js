/* ============================================================
   Money pages — payments ledger, reports, analytics, pro shop.

   Reads only through Store.sel.* and Store.list.*, writes only
   through Store.ops.* inside event handlers. Every figure on
   screen is asked from the store at draw time, so settling an
   invoice moves the ledger, the receipts, the reports and the
   dashboard in the same breath.
   ============================================================ */

(function () {
  const esc = UI.esc;

  /* Shared per-page view state (router state is persisted by the shell). */
  const view = {
    from: Store.addDays(Store.today(), -29),
    to: Store.today(),
    reportTab: 'booking',
    range: 14,
    shopCat: 'all',
    shopSort: 'price-desc'
  };

  const STATUS = [
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'failed', label: 'Failed' }
  ];
  const MARK = {
    paid: { label: 'Mark paid', icon: 'check' },
    pending: { label: 'Mark pending', icon: 'clock' },
    failed: { label: 'Mark failed', icon: 'alert' },
    refunded: { label: 'Mark refunded', icon: 'refresh' }
  };
  const PALETTE = ['#6b7cff', '#2fb37c', '#f4a036', '#e0607e', '#8b7cf6', '#3aa9e0', '#c98a3c', '#5f7ae0'];

  /* ---------------- small shared helpers ---------------- */
  function tone(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 3)) % 9973;
    return PALETTE[h % PALETTE.length];
  }
  function whoCell(name, sub) {
    return '<div class="who">' + UI.avatar(name, tone(name)) +
      '<div><b>' + esc(name) + '</b><em>' + esc(sub || '') + '</em></div></div>';
  }
  function moneyText(n) { return String(Number(n) || 0); }
  function moneyCell(n) { return '<span class="mono">' + money(Number(n) || 0) + '</span>'; }
  function share(part, total) { return total > 0 ? Math.round((part / total) * 100) : 0; }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function sum(arr, get) { return arr.reduce((s, x) => s + (Number(get(x)) || 0), 0); }
  function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
  function levelText(p) {
    const lvl = Number((p || {}).level);
    return isNaN(lvl) ? '—' : lvl.toFixed(1);
  }
  function playerLabel(p) {
    if (!p) return '';
    return Store.tierName(p.membership) + ' · ' + levelText(p) + ' rated';
  }
  function panel(title, sub, body, tools) {
    return '<section class="panel">' +
      '<div class="panel-head"><div><h3>' + esc(title) + '</h3>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (tools || '') + '</div>' + body + '</section>';
  }
  function pageHead(title, sub, tools) {
    return '<div class="page-head"><div><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div>' +
      '<div class="page-tools">' + (tools || '') + '</div></div>';
  }
  function pill(act, label, iconName, cls) {
    return '<button class="pill-btn ' + (cls || 'ghost') + '" data-mp-act="' + esc(act) + '">' +
      (iconName ? icon(iconName, 15) : '') + esc(label) + '</button>';
  }
  function rangeText(from, to) {
    const days = Math.max(1, Store.dayDiff(from, to) + 1);
    return Store.sel.fmtDate(from) + ' – ' + Store.sel.fmtDate(to) + ' · ' + days + ' day(s)';
  }
  function tiles(items) {
    return '<div class="tiles">' + items.map(t =>
      '<div class="tile"><span>' + esc(t.label) + '</span><b>' + esc(t.value) + '</b>' +
      (t.sub ? '<div class="dim" style="margin-top:6px">' + esc(t.sub) + '</div>' : '') + '</div>').join('') + '</div>';
  }
  function kpiPrint(items) {
    return '<div class="kpi">' + items.map(k =>
      '<div><span>' + esc(k.label) + '</span><b>' + esc(k.value) + '</b></div>').join('') + '</div>';
  }
  function dataTable(cols, rows, opts) {
    const o = opts || {};
    if (!rows.length) return UI.empty(o.emptyIcon || 'search', o.emptyTitle || 'Nothing to show for this range.',
      o.emptySub || 'Widen the date range or clear a filter.', o.emptyAction || '');
    const head = '<tr>' + cols.map(c => '<th' + (c.align === 'right' ? ' class="ta-r"' : '') + '>' + esc(c.label) + '</th>').join('') + '</tr>';
    const body = rows.map(r => '<tr>' + cols.map(c =>
      '<td' + (c.align === 'right' ? ' class="ta-r"' : '') + '>' + (c.html ? c.html(r) : esc(c.text(r))) + '</td>').join('') + '</tr>').join('');
    return '<div class="tbl-wrap"' + (o.scroll ? ' style="max-height:' + o.scroll + 'px;overflow:auto"' : '') + '>' +
      '<table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function csvOf(cols) { return cols.map(c => ({ label: c.label, value: c.text })); }
  /* The print window ships its own bare stylesheet, so the exported document
     uses the plain text cell of each column instead of the on-screen markup. */
  function printOf(cols, rows, title) {
    return '<h2>' + esc(title) + '</h2><table><thead><tr>' +
      cols.map(c => '<th' + (c.align === 'right' ? ' style="text-align:right"' : '') + '>' + esc(c.label) + '</th>').join('') +
      '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + cols.map(c => '<td' + (c.align === 'right' ? ' style="text-align:right"' : '') + '>' +
        esc(c.text(r)) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table>';
  }
  function thinLabels(labels, max) {
    const step = Math.max(1, Math.ceil(labels.length / max));
    return labels.map((l, i) => (i % step === 0 ? l : ''));
  }

  /* #view is one shared element for every page module: the stored wrapper is
     replaced on re-render and the route guard stops a stale page handler from
     painting over the page that is actually on screen. */
  const bound = {};
  function on(host, type, key, route, fn) {
    if (bound[key]) host.removeEventListener(type, bound[key]);
    const wrapped = function (e) { if (PMSTATE().route !== route) return; fn(e); };
    bound[key] = wrapped;
    host.addEventListener(type, wrapped);
  }

  /* ---------------- ledger helpers ---------------- */
  function ledgerKinds() {
    const out = [];
    Store.list('payments').forEach(p => { if (p.kind && out.indexOf(p.kind) < 0) out.push(p.kind); });
    ['Court booking', 'Membership', 'Tournament entry', 'Pro shop', 'Manual invoice'].forEach(k => {
      if (out.indexOf(k) < 0) out.push(k);
    });
    return out.sort().map(k => ({ value: k, label: k }));
  }
  function bookingOf(row) {
    if (!row.refId || String(row.kind || '').toLowerCase().indexOf('booking') < 0) return null;
    return Store.get('bookings', row.refId);
  }
  function settleNote(row) {
    const b = bookingOf(row);
    if (!b || b.status !== 'pending') return '';
    const c = Store.get('courts', b.courtId) || {};
    return 'Settling this invoice also auto-confirms the pending booking ' + b.id +
      ' (' + (c.name || 'Court') + ' · ' + Store.sel.fmtDate(b.date) + ' ' + b.start + ') — that slot becomes unavailable to others.';
  }
  function invoiceLines(row) {
    const b = bookingOf(row);
    if (!b) return [{ label: row.item, amount: Number(row.amount) || 0 }];
    const c = Store.get('courts', b.courtId) || {};
    const out = [{
      label: (c.name || 'Court') + ' · ' + b.duration + (b.duration === 1 ? ' hour' : ' hours') + ' · ' + b.start + '–' + b.end,
      amount: Number(b.subtotal || b.amount) || 0
    }];
    const disc = Number(b.discount || 0);
    if (disc > 0) {
      const p = Store.get('players', b.playerId);
      out.push({ label: (p ? Store.tierName(p.membership) : 'Membership') + ' member discount', amount: -disc });
    }
    const tax = Number(b.tax || 0);
    if (tax > 0) out.push({ label: 'VAT ' + Store.settings.booking.taxPct + '%', amount: tax });
    return out;
  }
  function receiptHtml(row) {
    const club = Store.settings.club;
    const b = bookingOf(row);
    const lines = invoiceLines(row);
    const player = Store.get('players', row.playerId);
    return '<div class="receipt">' +
      '<div class="dim" style="font-size:12px">' + esc(club.full) + '<br>' + esc(club.address) + '<br>' +
      esc(club.phone) + ' · ' + esc(club.email) + '</div>' +
      '<div style="margin-top:16px">' + whoCell(row.who, playerLabel(player)) + '</div>' +
      '<dl class="kv" style="margin-top:18px">' +
      '<dt>Invoice</dt><dd class="mono">' + esc(row.id) + '</dd>' +
      '<dt>Status</dt><dd>' + UI.badge(row.status) + '</dd>' +
      '<dt>Category</dt><dd>' + esc(row.kind || 'Manual invoice') + '</dd>' +
      '<dt>Method</dt><dd>' + esc(row.method || '—') + '</dd>' +
      '<dt>Date</dt><dd>' + esc(Store.sel.fmtDate(row.date)) + ' <span class="dim mono">' + esc(row.date) + '</span></dd>' +
      '<dt>Reference</dt><dd class="mono">' + esc(row.ref || '—') + '</dd>' +
      (b ? '<dt>Booking</dt><dd class="mono">' + esc(b.id) + ' · ' + esc(b.format) + ' · ' + b.players + ' players</dd>' : '') +
      '</dl>' +
      '<div class="section-title" style="margin:22px 0 10px">Invoice lines</div>' +
      '<div class="tbl-wrap"><table class="tbl"><tbody>' +
      lines.map(l => '<tr><td>' + esc(l.label) + '</td><td class="ta-r">' + moneyCell(l.amount) + '</td></tr>').join('') +
      '<tr><td><b>Total</b></td><td class="ta-r"><b>' + moneyCell(row.amount) + '</b></td></tr>' +
      '</tbody></table></div>' +
      '<div class="dim" style="margin-top:16px;font-size:12px">' +
      (row.status === 'paid' ? 'Received with thanks — logged to the club ledger.'
        : row.status === 'pending' ? 'Not yet collected — mark it paid to settle it and free the booking.'
          : row.status === 'refunded' ? 'Returned to the member.' : 'Collection failed — retry or raise a new invoice.') +
      '</div></div>';
  }
  function receiptModal(row) {
    UI.modal({
      title: 'Receipt · ' + row.id,
      sub: row.who + ' · ' + money(row.amount) + ' · ' + row.status,
      body: receiptHtml(row),
      wide: true,
      actions: [{ id: 'print', label: 'Print receipt', cls: 'ghost' }],
      onAction(id) {
        if (id === 'print') {
          if (UI.printReceipt(row)) UI.toast('Receipt ' + row.id + ' opened in a print-ready window.', 'info');
          return false;
        }
      }
    });
  }
  function changeStatus(row, status) {
    if (row.status === status) { UI.toast(row.id + ' is already ' + status + '.', 'info'); return; }
    UI.confirm({
      title: 'Mark ' + row.id + ' as ' + status + '?',
      body: money(row.amount) + ' from ' + row.who + ' — currently ' + row.status + ' (' + (row.kind || 'invoice') + ').',
      detail: status === 'paid' ? settleNote(row) : '',
      okLabel: 'Mark ' + status,
      cancelLabel: 'Keep as ' + row.status
    }).then(ok => {
      if (!ok) return;
      const res = Store.ops.setPaymentStatus(row.id, status);
      if (res && res.ok) {
        UI.toast(row.id + ' is now ' + status + ' · collected this month ' + money(Store.sel.stats().monthlyRevenue));
      } else if (res && res.errors && res.errors.id) {
        UI.toast(res.errors.id, 'err');
      } else {
        UI.toast('That invoice is no longer in the ledger.', 'err');
      }
    });
  }
  function removePayment(row) {
    UI.confirm({
      title: 'Delete invoice ' + row.id + '?',
      body: money(row.amount) + ' from ' + row.who + ' leaves the ledger permanently.',
      detail: 'Booking invoices cannot be deleted here — cancel the booking instead so the refund is recorded.',
      okLabel: 'Delete invoice',
      cancelLabel: 'Keep invoice',
      danger: true
    }).then(ok => {
      if (!ok) return;
      const res = Store.ops.deletePayment(row.id);
      if (res && res.ok) UI.toast(row.id + ' removed · ' + money(Store.sel.stats().monthlyRevenue) + ' still collected this month');
      else UI.toast((res && res.errors && res.errors.id) || 'That invoice could not be deleted.', 'err');
    });
  }
  function recordForm() {
    UI.formModal({
      title: 'Record a payment',
      sub: 'Writes a real invoice to the ledger',
      wide: true,
      fields: [
        { name: 'playerId', label: 'Member', type: 'select', options: UI.playerOptions(), placeholder: 'Select a member', required: true, col: 1 },
        { name: 'amount', label: 'Amount', type: 'number', col: 1, required: true, min: 1, step: 1, placeholder: '1200' },
        { name: 'method', label: 'Method', type: 'select', options: UI.methodOptions, col: 1, value: 'GCash' },
        { name: 'date', label: 'Payment date', type: 'date', col: 1, value: Store.today(), required: true },
        { name: 'kind', label: 'Category', type: 'select', options: ledgerKinds(), col: 1, value: 'Manual invoice' },
        { name: 'status', label: 'Status', type: 'select', options: STATUS, col: 1, value: 'paid' },
        { name: 'item', label: 'What is this for?', col: 2, required: true, placeholder: 'Silver membership · monthly renewal', maxlength: 120 },
        { name: 'ref', label: 'Reference', col: 1, placeholder: 'GCash / trail number', help: 'Optional — auto-generated when left blank.' }
      ],
      submitLabel: 'Record payment',
      onSubmit(vals) { return Store.ops.recordPayment(vals); },
      onDone(res) {
        if (!res || !res.ok) return;
        UI.toast('Payment ' + res.id + ' recorded · ' + money(Store.sel.stats().monthlyRevenue) + ' collected this month');
      }
    });
  }

  /* ============================================================
     PAYMENTS
     ============================================================ */
  function paymentsMarkup() {
    const st = Store.sel.stats();
    const kinds = Store.sel.revenueByKind();
    const kindTotal = sum(kinds, k => k.amount);
    const monthKey = Store.today().slice(0, 7);
    const todayPaid = Store.list('payments').filter(p => p.date === Store.today() && p.status === 'paid').length;
    const monthPaid = Store.list('payments').filter(p => String(p.date).slice(0, 7) === monthKey && p.status === 'paid').length;
    const ms = Store.sel.monthlySeries(2);
    const lastIdx = ms.revenue.length - 1;
    const prevMonth = lastIdx > 0 ? ms.revenue[lastIdx - 1] : 0;
    const curMonth = ms.revenue[lastIdx] || 0;
    const delta = prevMonth > 0
      ? { delta: (curMonth >= prevMonth ? '+' : '') + share(curMonth - prevMonth, prevMonth) + '%', deltaDir: curMonth >= prevMonth ? 'up' : 'down' }
      : {};
    const mix = kinds.length
      ? '<div class="tiles">' + kinds.map(k =>
        '<div class="tile"><span>' + esc(k.kind) + '</span><b>' + money(k.amount) + '</b>' +
        '<div class="progress" style="margin-top:9px"><i style="width:' + share(k.amount, kindTotal) + '%"></i></div>' +
        '<div class="dim" style="margin-top:6px">' + share(k.amount, kindTotal) + '% of collected</div></div>').join('') + '</div>'
      : UI.empty('wallet', 'No collected revenue yet.', 'Record a payment or settle a pending invoice to build the revenue mix.',
        pill('record', 'Record payment', 'plus', 'primary'));

    return pageHead('Payments', 'Every membership, court fee, tournament entry and pro-shop order the club has collected.',
      pill('record', 'Record payment', 'plus', 'primary')) +
      '<div class="kpi-grid">' +
      UI.kpi(Object.assign({
        icon: 'wallet', label: 'Collected this month', value: money(st.monthlyRevenue),
        sub: Store.monthLabel(Store.today()) + ' · ' + monthPaid + ' settled invoice(s)'
      }, delta)) +
      UI.kpi({
        icon: 'clock', label: 'Outstanding', value: money(st.pendingPayments),
        sub: st.pendingCount + ' invoice(s) awaiting settlement'
      }) +
      UI.kpi({
        icon: 'refresh', label: 'Refunded', value: money(st.refunded),
        sub: Store.list('payments').filter(p => p.status === 'refunded').length + ' invoice(s) returned · ' +
          st.failedCount + ' failed collection(s)'
      }) +
      UI.kpi({
        icon: 'sun', label: 'Collected today', value: money(st.todayRevenue),
        sub: todayPaid + ' invoice(s) settled today'
      }) +
      '</div>' +
      '<div class="section-title">Revenue mix by category</div>' + mix +
      panel('Invoice ledger', Store.list('payments').length + ' invoices across bookings, memberships, tournaments and the pro shop',
        '<div id="moneyPayTable"></div>');
  }

  function paymentsTable(host) {
    const mount = host.querySelector('#moneyPayTable');
    if (!mount) return;
    UI.table(mount, {
      id: 'money-payments',
      columns: [
        { key: 'id', label: 'Invoice', sortable: true, width: '132px', render: r => '<b class="mono">' + esc(r.id) + '</b>' },
        {
          key: 'who', label: 'Member', sortable: true, width: '210px',
          render: r => whoCell(r.who, playerLabel(Store.get('players', r.playerId)))
        },
        { key: 'item', label: 'Item', sortable: true, render: r => esc(r.item) },
        { key: 'kind', label: 'Category', sortable: true, width: '150px', render: r => '<span class="dim">' + esc(r.kind || '—') + '</span>' },
        { key: 'amount', label: 'Amount', sortable: true, align: 'right', width: '120px', render: r => moneyCell(r.amount), sortValue: r => Number(r.amount) || 0 },
        { key: 'method', label: 'Method', sortable: true, width: '104px', render: r => esc(r.method || '—') },
        { key: 'date', label: 'Date', sortable: true, width: '132px', render: r => esc(Store.sel.fmtDate(r.date)) + ' <span class="dim mono">' + esc(r.date) + '</span>' },
        { key: 'status', label: 'Status', sortable: true, width: '128px', render: r => UI.badge(r.status) }
      ],
      rows: () => Store.list('payments'),
      rowId: r => r.id,
      search: true,
      searchLabel: 'Search invoice, member, item or reference…',
      searchKeys: ['id', 'who', 'item', 'ref'],
      filters: [
        { key: 'status', label: 'All statuses', options: STATUS },
        { key: 'kind', label: 'All categories', options: ledgerKinds() },
        { key: 'method', label: 'All methods', options: UI.methodOptions }
      ],
      per: 10,
      emptyTitle: 'No invoices match those filters.',
      emptySub: 'Change the search text, or clear the status, category or method filter.',
      rowActions: r => {
        let out = UI.actionBtn('view', 'View receipt', '', 'eye');
        Object.keys(MARK).forEach(s => {
          if (s !== r.status) out += UI.actionBtn('mark:' + s, MARK[s].label, '', MARK[s].icon);
        });
        return out + UI.actionBtn('del', 'Delete invoice', 'danger', 'trash');
      },
      onAction(act, row) {
        if (!row) return;
        if (act === 'view') return receiptModal(row);
        if (act === 'del') return removePayment(row);
        if (String(act).indexOf('mark:') === 0) return changeStatus(row, act.slice(5));
      }
    });
  }

  function initPayments(host) {
    on(host, 'click', 'pay.click', 'payments', e => {
      const act = e.target.closest('[data-mp-act]');
      if (!act) return;
      if (act.dataset.mpAct === 'record') recordForm();
    });

    host.innerHTML = paymentsMarkup();
    paymentsTable(host);

    const st = PMSTATE();
    const focus = st.focus;
    if (focus === 'new') {
      st.focus = null;
      recordForm();
    } else if (focus) {
      st.focus = null;
      const row = Store.get('payments', focus);
      if (row) receiptModal(row);
      else UI.toast('Invoice ' + focus + ' is no longer in the ledger.', 'warn');
    }
  }

  /* ============================================================
     REPORTS
     ============================================================ */
  function bookingsInRange() {
    return Store.list('bookings')
      .filter(b => b.date >= view.from && b.date <= view.to)
      .sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.start < b.start ? -1 : 1);
  }
  function paymentsInRange() {
    return Store.sel.revenueBetween(view.from, view.to)
      .slice()
      .sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  }
  function statusIn(which) {
    return Store.list('payments').filter(p => p.status === which && p.date >= view.from && p.date <= view.to);
  }
  function daysIn() { return Math.max(1, Store.dayDiff(view.from, view.to) + 1); }

  /* Store.sel.bookingTrend always walks back from today, so a report scoped to
     an older window needs its own day-by-day series built from the rows. */
  function trendBetween(from, to) {
    const labels = [], counts = [], revenue = [], hours = [];
    const rows = Store.list('bookings');
    const span = daysIn();
    for (let i = 0; i < span; i++) {
      const d = Store.addDays(from, i);
      const hits = rows.filter(b => b.date === d && b.status !== 'cancelled');
      labels.push(d.slice(8) + ' ' + Store.MONTH_NAMES[+d.slice(5, 7) - 1]);
      counts.push(hits.length);
      revenue.push(sum(hits, b => b.amount));
      hours.push(sum(hits, b => b.duration));
    }
    return { labels, counts, revenue, hours };
  }

  const REPORTS = {
    booking: {
      label: 'Booking',
      slug: 'bookings',
      title: 'Booking report',
      hint: 'Bookings, court use and peak demand',
      kpis() {
        const rows = bookingsInRange();
        const f = Store.sel.bookingFunnel();
        return [
          { label: 'Bookings in range', value: nf.format(rows.length), sub: 'of ' + f.total + ' all time' },
          { label: 'Confirmed', value: nf.format(rows.filter(b => b.status === 'confirmed').length) },
          { label: 'Completed', value: nf.format(rows.filter(b => b.status === 'completed').length) },
          { label: 'Cancelled', value: nf.format(rows.filter(b => b.status === 'cancelled').length), sub: 'club-wide rate ' + f.cancelRate + '%' },
          { label: 'Court hours', value: nf.format(sum(rows, b => b.duration)) + ' h' },
          { label: 'Billed', value: money(sum(rows, b => b.amount)) }
        ];
      },
      charts() {
        const f = Store.sel.bookingFunnel();
        const t = trendBetween(view.from, view.to);
        const courts = Store.sel.courtUtilization(10);
        const peaks = Store.sel.peakHours();
        const funnelRow = (label, value) =>
          '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">' +
          '<span class="dim" style="flex:0 0 116px">' + esc(label) + '</span>' +
          '<div class="progress" style="flex:1"><i style="width:' + share(value, f.total) + '%"></i></div>' +
          '<b class="mono" style="flex:0 0 64px;text-align:right">' + nf.format(value) + '</b></div>';
        return '<div class="split">' +
          panel('Booking funnel', 'Every booking the club has ever taken · cancellation rate ' + f.cancelRate + '%',
            funnelRow('Total', f.total) + funnelRow('Confirmed', f.confirmed) + funnelRow('Pending', f.pending) +
            funnelRow('Completed', f.completed) + funnelRow('Cancelled', f.cancelled)) +
          panel('Peak hours', 'All bookings by start hour — where the demand actually sits',
            CH.bars({
              labels: thinLabels(peaks.labels, 12), data: peaks.data, color: '#6b7cff', h: 230,
              hot: peaks.data.indexOf(Math.max.apply(null, peaks.data))
            })) +
          '</div>' +
          '<div class="section-title">Bookings per day in range</div>' +
          panel('Trend', t.labels.length + ' day(s) · ' + nf.format(sum(t.counts, x => x)) + ' bookings, ' +
            nf.format(sum(t.hours, x => x)) + ' court hours, ' + money(sum(t.revenue, x => x)) + ' billed',
            CH.area({ series: [{ key: 'Bookings', color: '#2fb37c', data: t.counts }], labels: thinLabels(t.labels, 14), h: 240, alt: 'Bookings per day in range' })) +
          '<div class="section-title">Court utilisation this month</div>' +
          panel('Top courts', courts.length ? 'Booked hours per court, current month' : 'Nothing booked in the current month yet.',
            courts.length ? CH.hbars(courts)
              : UI.empty('court', 'No court hours booked yet this month.', 'The chart fills as soon as bookings land in the current month.')) +
          '<div class="section-title">Booking rows in range</div>' +
          panel('Booking detail', 'This is exactly what the CSV and the printable report contain',
            dataTable(REPORTS.booking.columns(), REPORTS.booking.rows(), {
              scroll: 460,
              emptyTitle: 'No bookings inside this range.',
              emptySub: 'Pick a wider range or a different preset above.'
            }));
      },
      columns() {
        return [
          { label: 'Booking', text: r => r.id, html: r => '<b class="mono">' + esc(r.id) + '</b>' },
          { label: 'Date', text: r => r.date, html: r => esc(r.date) },
          { label: 'Start', text: r => r.start, html: r => '<span class="mono">' + esc(r.start) + '</span>' },
          { label: 'End', text: r => r.end || '', html: r => '<span class="mono">' + esc(r.end || '—') + '</span>' },
          { label: 'Court', text: r => Store.sel.courtName(r.courtId), html: r => esc(Store.sel.courtName(r.courtId)) },
          {
            label: 'Venue',
            text: r => Store.sel.venueName((Store.get('courts', r.courtId) || {}).venueId),
            html: r => '<span class="dim">' + esc(Store.sel.venueName((Store.get('courts', r.courtId) || {}).venueId)) + '</span>'
          },
          { label: 'Player', text: r => Store.sel.playerName(r.playerId), html: r => esc(Store.sel.playerName(r.playerId)) },
          { label: 'Format', text: r => r.format || '', html: r => esc(r.format || '—') },
          { label: 'Hours', align: 'right', text: r => String(r.duration || 0), html: r => '<span class="mono">' + (r.duration || 0) + '</span>' },
          { label: 'Amount', align: 'right', text: r => moneyText(r.amount), html: r => moneyCell(r.amount) },
          { label: 'Status', text: r => r.status, html: r => esc(cap(r.status)) }
        ];
      },
      rows() { return bookingsInRange(); }
    },

    financial: {
      label: 'Financial',
      slug: 'financial',
      title: 'Financial report',
      hint: 'Collected revenue and invoice detail',
      kpis() {
        const rows = paymentsInRange();
        const st = Store.sel.stats();
        const total = sum(rows, p => p.amount);
        const kinds = Store.sel.revenueByKind();
        const refund = sum(statusIn('refunded'), p => p.amount);
        const pend = sum(statusIn('pending'), p => p.amount);
        return [
          { label: 'Collected in range', value: money(total), sub: rows.length + ' invoice(s)' },
          { label: 'Average ticket', value: money(rows.length ? Math.round(total / rows.length) : 0) },
          { label: 'Refunded in range', value: money(refund) },
          { label: 'Outstanding in range', value: money(pend) },
          { label: 'Month to date', value: money(st.monthlyRevenue), sub: Store.monthLabel(Store.today()) },
          { label: 'Top category', value: kinds.length ? kinds[0].kind : '—', sub: kinds.length ? money(kinds[0].amount) + ' collected' : 'Nothing collected yet' }
        ];
      },
      charts() {
        const ms = Store.sel.monthlySeries(6);
        const kinds = Store.sel.revenueByKind();
        const total = sum(kinds, k => k.amount);
        const donut = kinds.map((k, i) => ({ name: k.kind, value: k.amount, color: PALETTE[i % PALETTE.length] }));
        return '<div class="split">' +
          panel('Revenue and bookings by month', 'Last ' + ms.labels.length + ' months · revenue is settled invoices, bookings are kept reservations',
            '<div class="dim" style="margin-bottom:10px">Collected (₱)</div>' +
            CH.area({ series: [{ key: 'Collected', color: '#6b7cff', data: ms.revenue }], labels: ms.labels, h: 210, alt: 'Monthly collected revenue' }) +
            '<div class="dim" style="margin:16px 0 10px">Bookings</div>' +
            CH.area({ series: [{ key: 'Bookings', color: '#2fb37c', data: ms.bookings }], labels: ms.labels, h: 170, alt: 'Monthly bookings' })) +
          panel('Revenue by category', 'All time · ' + money(total) + ' collected',
            donut.length
              ? CH.donut({ data: donut, caption: '₱ collected' }) +
              '<div class="legend" style="justify-content:center;margin-top:14px">' + donut.map(d =>
                '<span><i style="background:' + d.color + '"></i>' + esc(d.name) + '</span>').join('') + '</div>'
              : UI.empty('wallet', 'No revenue to split yet.', 'Settle an invoice and the donut fills in.')) +
          '</div>' +
          '<div class="section-title">Collected invoices in range</div>' +
          panel('Revenue detail', 'Every settled invoice between ' + view.from + ' and ' + view.to,
            dataTable(REPORTS.financial.columns(), REPORTS.financial.rows(), {
              scroll: 460,
              emptyTitle: 'Nothing collected in this range.',
              emptySub: 'Try a 90-day window, or widen the dates above.'
            }));
      },
      columns() {
        return [
          { label: 'Invoice', text: r => r.id, html: r => '<b class="mono">' + esc(r.id) + '</b>' },
          { label: 'Date', text: r => r.date, html: r => esc(r.date) },
          { label: 'Member', text: r => r.who, html: r => esc(r.who) },
          { label: 'Category', text: r => r.kind || '', html: r => esc(r.kind || '—') },
          { label: 'Item', text: r => r.item, html: r => '<span class="dim">' + esc(r.item) + '</span>' },
          { label: 'Method', text: r => r.method || '', html: r => esc(r.method || '—') },
          { label: 'Reference', text: r => r.ref || '', html: r => '<span class="mono">' + esc(r.ref || '—') + '</span>' },
          { label: 'Amount', align: 'right', text: r => moneyText(r.amount), html: r => moneyCell(r.amount) }
        ];
      },
      rows() { return paymentsInRange(); }
    },

    player: {
      label: 'Player',
      slug: 'players',
      title: 'Player report',
      hint: 'Membership and participation',
      kpis() {
        const st = Store.sel.stats();
        const joined = Store.list('players').filter(p => p.joined >= view.from && p.joined <= view.to);
        const top = Store.sel.topPlayers(1)[0];
        const active = Store.sel.mostActive(1)[0];
        return [
          { label: 'Members', value: nf.format(st.players), sub: st.activeMembers + ' in good standing' },
          { label: 'New in range', value: nf.format(joined.length), sub: 'joined ' + rangeText(view.from, view.to) },
          { label: 'New this month', value: nf.format(st.newThisMonth), sub: Store.monthLabel(Store.today()) },
          { label: 'Top rating', value: top ? nf.format(top.rating) : '—', sub: top ? top.name : 'No rated players yet' },
          { label: 'Most sessions', value: active ? nf.format(active.count) : '—', sub: active ? active.player.name + ' · all-time ledger' : 'No bookings recorded' },
          { label: '3.5+ players', value: nf.format((Store.sel.levelSplit().find(l => l.name === '3.5+') || {}).value || 0) }
        ];
      },
      charts() {
        const ms = Store.sel.monthlySeries();
        const levels = Store.sel.levelSplit();
        return '<div class="split">' +
          panel('New members per month', 'Signups across the last ' + ms.labels.length + ' months',
            CH.bars({ labels: ms.labels, data: ms.signups, color: '#2fb37c', h: 230, hot: ms.signups.indexOf(Math.max.apply(null, ms.signups)) })) +
          panel('Skill split', 'Rating buckets across the roster',
            CH.donut({ data: levels, caption: 'members' }) +
            '<div class="legend" style="justify-content:center;margin-top:14px">' + levels.map(l =>
              '<span><i style="background:' + l.color + '"></i>' + esc(l.name) + ' · ' + l.value + '</span>').join('') + '</div>') +
          '</div>' +
          '<div class="section-title">Ranked by rating</div>' +
          panel('Top players', 'Sessions, court hours and collected revenue inside the selected range — the rows the committee reads',
            dataTable(REPORTS.player.columns(), REPORTS.player.rows(), {
              emptyTitle: 'No players on the roster yet.',
              emptySub: 'Add a member and this report populates itself.'
            })) +
          '<div class="section-title">Most active members</div>' +
          panel('Session count', 'All-time bookings kept, cancellations excluded — club-wide ranking, not range scoped',
            dataTable([
              { label: 'Player', text: r => r.player.name, html: r => whoCell(r.player.name, playerLabel(r.player)) },
              { label: 'Venue', text: r => r.player.venue || '', html: r => '<span class="dim">' + esc(r.player.venue || '—') + '</span>' },
              { label: 'Play style', text: r => r.player.play || '', html: r => esc(r.player.play || '—') },
              { label: 'Sessions', align: 'right', text: r => String(r.count), html: r => '<b class="mono">' + nf.format(r.count) + '</b>' }
            ], Store.sel.mostActive(10), {
              emptyTitle: 'No sessions logged yet.',
              emptySub: 'Once bookings are completed this list fills up.'
            }));
      },
      columns() {
        /* Sessions and spend are counted inside the selected range, so moving the
           dates re-scopes this report the same way it re-scopes the other two. */
        const sessions = {}, courtHrs = {}, spent = {};
        Store.list('bookings').forEach(b => {
          if (b.status === 'cancelled' || b.date < view.from || b.date > view.to) return;
          sessions[b.playerId] = (sessions[b.playerId] || 0) + 1;
          courtHrs[b.playerId] = (courtHrs[b.playerId] || 0) + (Number(b.duration) || 0);
        });
        Store.list('payments').forEach(p => {
          if (p.status !== 'paid' || p.date < view.from || p.date > view.to) return;
          spent[p.playerId] = (spent[p.playerId] || 0) + Number(p.amount || 0);
        });
        return [
          { label: 'Rank', text: r => String(r.rank), html: r => '<b class="mono">' + r.rank + '</b>' },
          { label: 'Player', text: r => r.name, html: r => whoCell(r.name, playerLabel(r)) },
          { label: 'Tier', text: r => Store.tierName(r.membership), html: r => '<span class="dim">' + esc(Store.tierName(r.membership)) + '</span>' },
          { label: 'Level', text: r => levelText(r), html: r => '<span class="mono">' + levelText(r) + '</span>' },
          { label: 'Rating', align: 'right', text: r => String(Number(r.rating) || 0), html: r => '<b class="mono">' + nf.format(Number(r.rating) || 0) + '</b>' },
          { label: 'Sessions in range', align: 'right', text: r => String(sessions[r.id] || 0), html: r => '<span class="mono">' + nf.format(sessions[r.id] || 0) + '</span>' },
          { label: 'Court hours in range', align: 'right', text: r => String(courtHrs[r.id] || 0), html: r => '<span class="mono">' + nf.format(courtHrs[r.id] || 0) + '</span>' },
          { label: 'Collected in range', align: 'right', text: r => moneyText(spent[r.id] || 0), html: r => moneyCell(spent[r.id] || 0) },
          { label: 'Status', text: r => r.status, html: r => esc(cap(r.status)) },
          { label: 'Joined', text: r => r.joined, html: r => esc(Store.sel.fmtDate(r.joined)) + ' <span class="dim mono">' + esc(r.joined) + '</span>' }
        ];
      },
      rows() {
        return Store.sel.topPlayers(10).map((p, i) => Object.assign({}, p, { rank: i + 1 }));
      }
    }
  };

  function activeReport() { return REPORTS[view.reportTab] || REPORTS.booking; }

  function reportsMarkup() {
    const rep = activeReport();
    const tabs = UI.seg(['booking', 'financial', 'player'].map(id => ({ id, label: REPORTS[id].label })), view.reportTab, 'data-mp-tab');
    const activePreset = ['7', '30', '90'].indexOf(String(daysIn())) > -1 ? String(daysIn()) : '';

    const rangeBar = '<section class="panel">' +
      '<div class="panel-head"><div><h3>Report range</h3><p>Every scoped figure below is rebuilt from these dates.</p></div>' +
      UI.seg([{ id: '7', label: '7d' }, { id: '30', label: '30d' }, { id: '90', label: '90d' }], activePreset, 'data-mp-days') + '</div>' +
      '<div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));align-items:end">' +
      '<div class="field span-1"><label for="mpFrom">From</label>' +
      '<input type="date" id="mpFrom" data-mp-range="from" value="' + esc(view.from) + '" max="' + esc(view.to) + '"></div>' +
      '<div class="field span-1"><label for="mpTo">To</label>' +
      '<input type="date" id="mpTo" data-mp-range="to" value="' + esc(view.to) + '" min="' + esc(view.from) + '"></div>' +
      '<div class="field span-1"><label>Scope</label><div class="static-val">' + esc(rangeText(view.from, view.to)) + '</div></div>' +
      '</div></section>';

    const rows = rep.rows();
    const cols = rep.columns();
    const tools = '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      pill('csv', 'Export CSV', 'download', 'ghost') +
      pill('print', 'Print / PDF', 'clipboard', 'accent') + '</div>';

    return pageHead('Reports', 'Committee-ready bookings, financial and player reports. Exported straight from the live ledger.', tabs) +
      rangeBar +
      '<div class="section-title">' + esc(rep.title + ' · ' + rep.hint) + '</div>' +
      panel(rep.title, rangeText(view.from, view.to) + ' · ' + rows.length + ' row(s) in scope · ' + cols.length + ' columns · every figure pulled from the store at draw time',
        tiles(rep.kpis()) + rep.charts(), tools) +
      '<div class="section-title">Print and export</div>' +
      panel('One document, three formats', 'The CSV, the printable report and this table are built from the same rows.',
        '<div class="dim">Use Export CSV for the spreadsheet, or Print / PDF for the committee pack — both include the KPI block above and the ' +
        rows.length + ' scoped row(s).</div>');
  }

  function exportCsv() {
    const rep = activeReport();
    const rows = rep.rows();
    if (!rows.length) return UI.toast('There is nothing in this range to export.', 'warn');
    const name = 'piklemarawi-' + rep.slug + '-' + Store.today() + '.csv';
    const n = UI.csv(name, csvOf(rep.columns()), rows);
    UI.toast(n + ' row(s) written to ' + name);
  }
  function exportPrint() {
    const rep = activeReport();
    const rows = rep.rows();
    if (!rows.length) return UI.toast('This range has no rows to print.', 'warn');
    const html = kpiPrint(rep.kpis()) +
      '<h2>Scope</h2><p class="sub">' + esc(rep.title + ' · ' + rangeText(view.from, view.to)) + '</p>' +
      printOf(rep.columns(), rows, rep.title) +
      '<h2>Note</h2><p class="sub">Figures are derived live from the ' + esc(Store.settings.club.full) + ' ledger and booking records.</p>';
    if (UI.print(rep.title + ' · ' + Store.today(), html)) {
      UI.toast(rep.title + ' opened — use Print in the new window to save a PDF.', 'info');
    }
  }

  function initReports(host) {
    on(host, 'click', 'rep.click', 'reports', e => {
      const tab = e.target.closest('[data-mp-tab]');
      if (tab) { view.reportTab = tab.dataset.mpTab; host.innerHTML = reportsMarkup(); return; }
      const preset = e.target.closest('[data-mp-days]');
      if (preset) {
        const n = Number(preset.dataset.mpDays);
        view.to = Store.today();
        view.from = Store.addDays(Store.today(), -(n - 1));
        host.innerHTML = reportsMarkup();
        return;
      }
      const act = e.target.closest('[data-mp-act]');
      if (!act) return;
      if (act.dataset.mpAct === 'csv') exportCsv();
      if (act.dataset.mpAct === 'print') exportPrint();
    });
    on(host, 'change', 'rep.change', 'reports', e => {
      const input = e.target.closest('[data-mp-range]');
      if (!input) return;
      const value = input.value;
      if (!Store.isDate(value)) {
        UI.toast('Pick a valid ' + input.dataset.mpRange + ' date — the report keeps its current range.', 'err');
        host.innerHTML = reportsMarkup();
        return;
      }
      if (input.dataset.mpRange === 'from') view.from = value; else view.to = value;
      if (view.from > view.to) {
        const swap = view.from;
        view.from = view.to;
        view.to = swap;
        UI.toast('Range flipped so the earlier date comes first.', 'info');
      }
      host.innerHTML = reportsMarkup();
    });
    host.innerHTML = reportsMarkup();
  }

  /* ============================================================
     ANALYTICS
     ============================================================ */
  function effRange() {
    const r = String(PMSTATE().range);
    return r === '7' || r === '14' || r === '30' ? Number(r) : view.range;
  }
  function analyticsMarkup() {
    const days = effRange();
    const from = Store.addDays(Store.today(), -(days - 1));
    const st = Store.sel.stats();
    const funnel = Store.sel.bookingFunnel();
    const t = Store.sel.bookingTrend(days);
    const labels = thinLabels(t.labels, 12);
    const courts = Store.sel.courtUtilization(8);
    const peaks = Store.sel.peakHours();
    const venues = Store.sel.venueSplit();
    const membership = Store.sel.membershipSplit();
    const inRange = Store.list('bookings').filter(b => b.date >= from && b.date <= Store.today() && b.status !== 'cancelled');
    const collected = Store.sel.revenueBetween(from, Store.today());
    const peakMax = Math.max.apply(null, peaks.data);
    const venueMax = venues.length ? venues[0].value : 0;

    const trendPanel = panel('Bookings and revenue trend', days + ' day(s) ending ' + Store.sel.fmtDate(Store.today()) +
      ' · ' + nf.format(sum(t.counts, x => x)) + ' bookings, ' + money(sum(t.revenue, x => x)) + ' billed',
      '<div class="dim" style="margin-bottom:10px">Revenue billed per day</div>' +
      CH.area({ series: [{ key: 'Revenue billed', color: '#6b7cff', data: t.revenue }], labels: labels, h: 230, alt: 'Revenue billed per day' }) +
      '<div class="dim" style="margin:18px 0 10px">Bookings per day</div>' +
      CH.area({ series: [{ key: 'Bookings', color: '#2fb37c', data: t.counts }], labels: labels, h: 200, alt: 'Bookings per day' }));

    const courtPanel = panel('Court load', 'Booked hours per court this month · top ' + courts.length,
      courts.length
        ? CH.bars({
          labels: courts.map(c => c.name), data: courts.map(c => c.hrs), color: '#8b7cf6', h: 240,
          hot: courts.map(c => c.hrs).indexOf(Math.max.apply(null, courts.map(c => c.hrs)))
        })
        : UI.empty('court', 'No hours booked this month yet.', 'Court load appears as soon as the first booking lands.'));

    const mixPanel = panel('Membership mix', nf.format(sum(membership, m => m.value)) + ' members across ' + membership.length + ' tiers',
      sum(membership, m => m.value)
        ? CH.donut({ data: membership, caption: 'members' }) +
        '<div class="legend" style="justify-content:center;margin-top:14px">' + membership.map(m =>
          '<span><i style="background:' + m.color + '"></i>' + esc(m.name) + ' · ' + m.value + '</span>').join('') + '</div>'
        : UI.empty('users', 'No members to split yet.', 'Add players and the tiers fill in.'));

    const peakIdx = peaks.data.indexOf(peakMax);
    const peakPanel = panel('Peak hours', peakMax ? 'All bookings by start hour · busiest at ' +
      peaks.labels[peakIdx] + ' with ' + peakMax + ' booking(s)' : 'All bookings by start hour · nothing booked yet',
      CH.bars({ labels: thinLabels(peaks.labels, 12), data: peaks.data, color: '#f4a036', h: 240, hot: peakMax ? peakIdx : -1 }));

    const utilPanel = panel('Court utilisation', 'Live courts in play against the fleet at ' + Store.sel.fmtDate(Store.today()),
      '<div style="text-align:center">' + CH.gauge({ value: clamp01(st.utilization / 100), w: 250, h: 150, alt: 'Court utilisation ' + st.utilization + '%' }) + '</div>' +
      tiles([
        { label: 'Utilisation now', value: st.utilization + '%', sub: st.inPlayNow + ' of ' + st.courts + ' courts in play' },
        { label: 'Cancellation rate', value: funnel.cancelRate + '%', sub: nf.format(funnel.cancelled) + ' of ' + nf.format(funnel.total) + ' bookings' },
        { label: 'Courts available', value: nf.format(st.courtsAvailable) + ' / ' + nf.format(st.courts), sub: 'derived from today’s live bookings' }
      ]));

    const venuePanel = panel('Venue load', 'Bookings kept per venue across the club',
      venues.length
        ? venues.map(v =>
          '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">' +
          '<span class="dim" style="flex:0 0 180px">' + esc(v.name) + '</span>' +
          '<div class="progress" style="flex:1"><i style="width:' + share(v.value, venueMax) + '%"></i></div>' +
          '<b class="mono" style="flex:0 0 64px;text-align:right">' + nf.format(v.value) + '</b></div>').join('')
        : UI.empty('globe', 'No venue bookings yet.', 'Venue load tracks the booking ledger.'));

    return pageHead('Analytics', 'Participation, utilisation and revenue signals — recomputed from the ledger, never stored figures.',
      UI.seg([{ id: '7', label: '7 days' }, { id: '14', label: '14 days' }, { id: '30', label: '30 days' }], String(days), 'data-mp-days')) +
      tiles([
        { label: 'Bookings in range', value: nf.format(inRange.length), sub: nf.format(sum(inRange, b => b.duration)) + ' court hours' },
        { label: 'Billed in range', value: money(sum(inRange, b => b.amount)), sub: 'booking invoices' },
        { label: 'Collected in range', value: money(sum(collected, p => p.amount)), sub: nf.format(collected.length) + ' settled invoice(s)' },
        { label: 'Avg per day', value: money(Math.round(sum(t.revenue, x => x) / Math.max(1, t.labels.length))), sub: 'across ' + days + ' day(s)' },
        { label: 'Pending invoices', value: nf.format(st.pendingCount), sub: money(st.pendingPayments) + ' outstanding' },
        { label: 'Active members', value: nf.format(st.activeMembers), sub: nf.format(st.newThisMonth) + ' joined this month' }
      ]) +
      '<div class="section-title">Trend · last ' + days + ' days</div>' + trendPanel +
      '<div class="split" style="margin-top:22px">' + courtPanel + mixPanel + '</div>' +
      '<div style="margin-top:22px">' + peakPanel + '</div>' +
      '<div class="split" style="margin-top:22px">' + utilPanel + venuePanel + '</div>';
  }

  function initAnalytics(host) {
    on(host, 'click', 'ana.click', 'analytics', e => {
      const seg = e.target.closest('[data-mp-days]');
      if (!seg) return;
      const days = Number(seg.dataset.mpDays);
      if (days !== 7 && days !== 14 && days !== 30) return;
      view.range = days;
      PMSTATE().range = String(days);
      host.innerHTML = analyticsMarkup();
      UI.toast('Analytics scoped to the last ' + days + ' days.', 'info');
    });
    host.innerHTML = analyticsMarkup();
  }

  /* ============================================================
     PRO SHOP
     ============================================================ */
  function shopCategories() {
    const out = [{ value: 'all', label: 'All categories' }];
    SHOP.forEach(p => { if (!out.some(c => c.value === p.cat)) out.push({ value: p.cat, label: p.cat }); });
    return out;
  }
  const SHOP_SORTS = [
    { value: 'featured', label: 'Featured' },
    { value: 'price-asc', label: 'Price: low to high' },
    { value: 'price-desc', label: 'Price: high to low' },
    { value: 'stock', label: 'Most in stock' },
    { value: 'rating', label: 'Highest rated' }
  ];
  /* Shelf thresholds come from the catalogue itself — the deepest stock level
     scales the bar, a quarter of the average is what counts as low stock. */
  const stockMax = Math.max(1, SHOP.length ? Math.max.apply(null, SHOP.map(p => Number(p.stock) || 0)) : 1);
  const lowWater = SHOP.length ? Math.max(1, Math.round(sum(SHOP, p => Number(p.stock) || 0) / SHOP.length / 4)) : 1;

  function shopRows() {
    const list = SHOP.filter(p => view.shopCat === 'all' || p.cat === view.shopCat).slice();
    const s = view.shopSort;
    list.sort((a, b) =>
      s === 'price-asc' ? a.price - b.price :
        s === 'price-desc' ? b.price - a.price :
          s === 'stock' ? b.stock - a.stock :
            s === 'rating' ? b.rating - a.rating : 0);
    return list;
  }
  function cartLines() {
    return Store.cart.map(c => {
      const product = SHOP.find(p => p.name === c.name);
      if (!product) return null;
      const qty = Number(c.qty) || 0;
      return { name: product.name, price: product.price, qty, total: product.price * qty };
    }).filter(l => l && l.qty > 0);
  }

  function productCard(p) {
    return '<article class="card">' +
      '<div class="panel-head" style="margin-bottom:14px">' +
      '<span class="kpi-slab">' + icon(p.icon, 22) + '</span>' +
      UI.badge(p.stock <= lowWater ? 'pending' : 'available', p.stock <= lowWater ? 'Low stock' : 'In stock') +
      '</div>' +
      '<div class="dim" style="font-size:11.5px;letter-spacing:.06em;text-transform:uppercase">' + esc(p.cat) + '</div>' +
      '<h3 style="margin:6px 0 10px;font-size:16px;font-weight:700;line-height:1.3">' + esc(p.name) + '</h3>' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">' +
      '<b class="mono" style="font-size:21px">' + money(p.price) + '</b>' +
      '<span class="dim">' + p.rating.toFixed(1) + ' ★</span></div>' +
      '<div class="progress" style="margin:14px 0 8px"><i style="width:' + clamp01(p.stock / stockMax) * 100 + '%"></i></div>' +
      '<div class="dim">' + nf.format(p.stock) + ' units on the shelf</div>' +
      '<button class="pill-btn primary" style="margin-top:16px;width:100%;justify-content:center" data-cart="' + esc(p.name) + '">' +
      icon('cart', 15) + 'Add to cart</button>' +
      '</article>';
  }

  function cartPanel() {
    const lines = cartLines();
    const total = sum(lines, l => l.total);
    const items = sum(lines, l => l.qty);
    const body = lines.length
      ? '<div class="tbl-wrap"><table class="tbl"><tbody>' +
      lines.map(l => '<tr><td><b>' + esc(l.name) + '</b><div class="dim">' + nf.format(l.qty) + ' × ' + money(l.price) + '</div></td>' +
        '<td class="ta-r">' + moneyCell(l.total) + '</td></tr>').join('') +
      '<tr><td><b>Grand total</b><div class="dim">' + nf.format(items) + ' item(s) · ' + lines.length + ' line(s)</div></td>' +
      '<td class="ta-r"><b>' + moneyCell(total) + '</b></td></tr>' +
      '</tbody></table></div>' +
      '<div style="display:flex;gap:9px;margin-top:18px;flex-wrap:wrap">' +
      pill('checkout', 'Checkout · ' + money(total), 'wallet', 'primary') +
      pill('cart-clear', 'Clear cart', 'trash', 'ghost') + '</div>'
      : UI.empty('cart', 'The cart is empty.', 'Add gear from the catalogue — checkout posts one real invoice per line to the ledger.', '');
    return panel('Order cart', lines.length ? lines.length + ' line(s) ready to charge' : 'Nothing selected yet', body);
  }

  function proshopMarkup() {
    const rows = shopRows();
    const filters = '<section class="panel">' +
      '<div class="panel-head"><div><h3>Catalogue</h3><p>' + rows.length + ' of ' + SHOP.length + ' products shown · prices are shelf prices, sales are posted as invoices</p></div>' +
      '<div class="dim">' + nf.format(sum(Store.cart, c => c.qty)) + ' item(s) in the cart</div></div>' +
      '<div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' +
      '<div class="field span-1"><label for="mpCat">Category</label><select id="mpCat" data-mp-cat>' +
      shopCategories().map(c => '<option value="' + esc(c.value) + '"' + (view.shopCat === c.value ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') +
      '</select></div>' +
      '<div class="field span-1"><label for="mpSort">Sort by</label><select id="mpSort" data-mp-sort>' +
      SHOP_SORTS.map(o => '<option value="' + esc(o.value) + '"' + (view.shopSort === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
      '</select></div>' +
      '<div class="field span-1"><label>Shelf</label><div class="static-val">' + nf.format(SHOP.length) + ' products · ' +
      nf.format(sum(SHOP, p => p.stock)) + ' units</div></div>' +
      '</div></section>';

    const grid = rows.length
      ? '<div class="kpi-grid">' + rows.map(productCard).join('') + '</div>'
      : UI.empty('cart', 'No gear in that category.', 'Choose another category, or show everything again.',
        pill('show-all', 'Show all categories', 'refresh', 'primary'));

    return pageHead('Pro Shop', 'Paddles, balls and court gear — the cart charges members through the same ledger as every other invoice.') +
      filters +
      '<div class="split" style="margin-top:22px;grid-template-columns:minmax(0,2fr) minmax(280px,1fr)">' +
      '<div>' + grid + '</div>' + cartPanel() + '</div>';
  }

  function checkout() {
    const lines = cartLines();
    if (!lines.length) return UI.toast('The cart is empty — add gear before checking out.', 'warn');
    const total = sum(lines, l => l.total);
    UI.formModal({
      title: 'Checkout pro shop order',
      sub: lines.length + ' line(s) · ' + money(total) + ' total',
      fields: [
        { name: 'playerId', label: 'Charged to member', type: 'select', options: UI.playerOptions(), placeholder: 'Select a member', required: true, col: 1 },
        { name: 'method', label: 'Method', type: 'select', options: UI.methodOptions, col: 1, value: 'GCash' },
        { name: 'date', label: 'Date', type: 'date', col: 1, value: Store.today(), required: true },
        { name: 'ref', label: 'Reference', col: 1, placeholder: 'Optional trail number' },
        {
          name: 'lines', label: 'Order lines', type: 'static', col: 2,
          html: '<div class="dim">' + lines.map(l => esc(l.name) + ' × ' + nf.format(l.qty) + ' — ' + money(l.total)).join('<br>') + '</div>'
        }
      ],
      submitLabel: 'Charge ' + money(total),
      onSubmit(vals) {
        /* Everything is validated up-front because one invoice is posted per cart
           line: a mid-loop rejection would leave a half-charged order. */
        if (!Store.get('players', vals.playerId)) return { ok: false, errors: { playerId: 'Select the member being charged.' } };
        if (!Store.isDate(vals.date)) return { ok: false, errors: { date: 'Pick a valid sale date.' } };
        if (!vals.method) return { ok: false, errors: { method: 'Select a payment method.' } };
        if (!lines.every(l => l.total > 0)) return { ok: false, errors: { lines: 'Every cart line needs a price before checkout.' } };
        if (lines.some(l => l.total > 500000)) return { ok: false, errors: { lines: 'One line is above the 500,000 invoice cap — split the order first.' } };
        let posted = 0;
        for (let i = 0; i < lines.length; i++) {
          const res = Store.ops.recordPayment({
            playerId: vals.playerId,
            amount: lines[i].total,
            method: vals.method,
            date: vals.date,
            status: 'paid',
            kind: 'Pro shop',
            item: lines[i].name + ' × ' + nf.format(lines[i].qty),
            ref: vals.ref
          });
          if (!res.ok) {
            const why = Object.keys(res.errors || {}).map(k => res.errors[k])[0] || 'That line could not be charged.';
            return { ok: false, errors: { lines: why + (posted ? ' ' + posted + ' invoice(s) were already recorded — the cart was kept.' : ' Nothing was charged.') } };
          }
          posted++;
        }
        Store.ops.cartClear();
        UI.toast(money(total) + ' collected across ' + lines.length + ' invoice(s) · ' +
          money(Store.sel.stats().monthlyRevenue) + ' collected this month');
        return { ok: true };
      }
    });
  }

  function initProshop(host) {
    on(host, 'click', 'shop.click', 'proshop', e => {
      const act = e.target.closest('[data-mp-act]');
      if (!act) return;
      const a = act.dataset.mpAct;
      if (a === 'checkout') checkout();
      if (a === 'show-all') { view.shopCat = 'all'; host.innerHTML = proshopMarkup(); }
      if (a === 'cart-clear') {
        const count = sum(Store.cart, c => c.qty);
        UI.confirm({
          title: 'Clear the cart?',
          body: count + ' item(s) will be dropped from this order.',
          detail: 'Nothing has been charged — the ledger is untouched.',
          okLabel: 'Clear cart',
          cancelLabel: 'Keep order',
          danger: true
        }).then(ok => { if (ok) { Store.ops.cartClear(); UI.toast('Cart cleared.', 'info'); } });
      }
    });
    on(host, 'change', 'shop.change', 'proshop', e => {
      const cat = e.target.closest('[data-mp-cat]');
      const sort = e.target.closest('[data-mp-sort]');
      if (cat) view.shopCat = cat.value;
      else if (sort) view.shopSort = sort.value;
      else return;
      host.innerHTML = proshopMarkup();
    });
    host.innerHTML = proshopMarkup();
  }

  Object.assign(PAGES, {
    payments: { live: true, render: initPayments },
    reports: { live: true, render: initReports },
    analytics: { live: true, render: initAnalytics },
    proshop: { live: true, render: initProshop }
  });
})();
