/* ============================================================
   UI — reusable widgets every management page is built from.

   DataTable · Modal · ConfirmDialog · Forms + validation ·
   StatusBadge · Toast · EmptyState · Skeleton · CSV · Print

   Nothing here knows what a pickleball is; pages pass plain
   column/field descriptors and get working, wired components.
   ============================================================ */

const UI = (function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------------- relative time ---------------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function relTime(input) {
    const then = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
      ? new Date(input + 'T00:00:00') : new Date(input);
    if (isNaN(then - 0)) return '—';
    const diff = Math.round((Date.now() - then.getTime()) / 1000);
    if (diff < 45) return 'just now';
    if (diff < 3600) return Math.round(diff / 60) + ' minutes ago';
    if (diff < 7200) return '1 hour ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 172800) return 'Yesterday';
    if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';
    return pad2(then.getDate()) + ' ' + MONTHS[then.getMonth()] + (then.getFullYear() !== new Date().getFullYear() ? ' ' + then.getFullYear() : '');
  }
  const pad2 = n => String(n).padStart(2, '0');
  const clock = t => { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

  /* ---------------- toast ---------------- */
  const TOAST_ICON = { ok: 'check', err: 'alert', warn: 'alert', info: 'info' };
  function toast(msg, type) {
    const kind = type || 'ok';
    const host = $('#toastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast is-' + kind;
    el.innerHTML = icon(TOAST_ICON[kind] || 'check', 17) + '<span>' + esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 320);
    }, kind === 'err' ? 4200 : 2600);
  }

  /* ---------------- status badges ---------------- */
  const TONE = {
    active: 'ok', confirmed: 'ok', paid: 'ok', open: 'ok', available: 'ok', completed: 'ok', live: 'live',
    pending: 'warn', reserved: 'warn', maintenance: 'warn', soon: 'warn', half: 'warn', 'registration': 'warn',
    ongoing: 'live',
    cancelled: 'bad', overdue: 'bad', failed: 'bad', closed: 'bad', suspended: 'bad', error: 'bad',
    refunded: 'info', upcoming: 'info', draft: 'info', paused: 'info', 'on': 'ok', 'off': 'bad'
  };
  const badge = (status, label) =>
    '<span class="badge is-' + (TONE[String(status).toLowerCase()] || 'neutral') + '">' + esc(label || String(status)) + '</span>';

  /* ---------------- modal ---------------- */
  let openModals = [];
  function modal(cfg) {
    const back = $('#sheetBackdrop');
    back.hidden = false;
    const m = document.createElement('section');
    m.className = 'modal' + (cfg.wide ? ' is-wide' : '') + (cfg.size === 'sm' ? ' is-sm' : '');
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML =
      '<header class="modal-head"><div><h3>' + esc(cfg.title || '') + '</h3>' +
      (cfg.sub ? '<p>' + esc(cfg.sub) + '</p>' : '') + '</div>' +
      '<button class="icon-btn" data-x aria-label="Close">' + icon('x', 18) + '</button></header>' +
      '<div class="modal-body">' + (cfg.body || '') + '</div>' +
      '<footer class="actions">' +
      (cfg.dismiss === false ? '' : '<button class="pill-btn ghost" data-close>' + esc(cfg.cancelLabel || 'Close') + '</button>') +
      (cfg.actions || []).map(a =>
        '<button class="pill-btn ' + (a.cls || 'primary') + '" data-act="' + esc(a.id) + '"' +
        (a.disabled ? ' disabled' : '') + '>' + esc(a.label) + '</button>').join('') +
      '</footer>';
    document.body.appendChild(m);
    openModals.push(m);

    const done = () => {
      openModals = openModals.filter(x => x !== m);
      m.remove();
      if (!openModals.length) back.hidden = true;
      if (cfg.onClose) cfg.onClose();
      syncKey();
    };
    m.addEventListener('click', e => {
      if (e.target.closest('[data-x]') || e.target.closest('[data-close]')) return done();
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const r = cfg.onAction ? cfg.onAction(act.dataset.act, m, done) : undefined;
      if (r !== false) done();
    });
    back.onclick = () => { if (cfg.sticky) return; while (openModals.length) { const x = openModals[openModals.length - 1]; x.remove(); openModals.pop(); } back.hidden = true; syncKey(); };
    if (cfg.onOpen) cfg.onOpen(m, done);
    syncKey();
    const first = m.querySelector('input:not([type=hidden]), select, textarea');
    if (first) setTimeout(() => first.focus(), 40);
    return { el: m, close: done };
  }

  function syncKey() {
    document.onkeydown = e => {
      if (e.key === 'Escape' && openModals.length) {
        const m = openModals[openModals.length - 1];
        m.remove(); openModals.pop();
        if (!openModals.length) $('#sheetBackdrop').hidden = true;
        syncKey();
      }
    };
  }

  function confirm(cfg) {
    return new Promise(resolve => {
      let settled = false;
      const m = modal({
        size: 'sm', sticky: false, title: cfg.title || 'Are you sure?',
        sub: cfg.sub || '',
        body: '<p class="confirm-copy">' + esc(cfg.body || '') + '</p>' +
          (cfg.detail ? '<p class="confirm-detail">' + esc(cfg.detail) + '</p>' : ''),
        dismiss: false,
        actions: [
          { id: 'no', label: cfg.cancelLabel || 'Keep it', cls: 'ghost' },
          { id: 'yes', label: cfg.okLabel || 'Confirm', cls: cfg.danger ? 'danger' : 'primary' }
        ],
        onAction(id, el, done) { settled = true; done(); resolve(id === 'yes'); },
        onClose() { if (!settled) resolve(false); }
      });
      void m;
    });
  }

  /* ---------------- forms ---------------- */
  function fieldHtml(f) {
    const id = 'f-' + f.name;
    const req = f.required ? ' required' : '';
    let val = f.value === undefined || f.value === null ? '' : f.value;
    /* native date/time inputs reject display strings like '—' — blank them
       out instead of shipping an input the browser refuses to fill */
    const SHAPE = { time: /^\d{2}:\d{2}$/, date: /^\d{4}-\d{2}-\d{2}$/, month: /^\d{4}-\d{2}$/,
      week: /^\d{4}-W\d{2}$/, 'datetime-local': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ };
    if (SHAPE[f.type] && !SHAPE[f.type].test(String(val))) val = '';
    let input;
    if (f.type === 'select') {
      input = '<select id="' + id + '" name="' + f.name + '"' + req + (f.disabled ? ' disabled' : '') + '>' +
        (f.placeholder ? '<option value="">' + esc(f.placeholder) + '</option>' : '') +
        (f.options || []).map(o => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(val) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
        '</select>';
    } else if (f.type === 'textarea') {
      input = '<textarea id="' + id + '" name="' + f.name + '" rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || '') + '"' + req + '>' + esc(val) + '</textarea>';
    } else if (f.type === 'checkbox') {
      return '<div class="field is-check span-' + (f.col || 2) + '" data-field="' + f.name + '"><label class="check-line"><input type="checkbox" id="' + id + '" name="' + f.name + '"' + (val ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>' +
        (f.help ? '<em>' + esc(f.help) + '</em>' : '') + '<b class="err" hidden></b></div>';
    } else if (f.type === 'static') {
      return '<div class="field span-' + (f.col || 2) + '" data-field="' + f.name + '"><label>' + esc(f.label) + '</label><div class="static-val">' + (f.html || esc(val)) + '</div><b class="err" hidden></b></div>';
    } else {
      input = '<input type="' + (f.type || 'text') + '" id="' + id + '" name="' + f.name + '" value="' + esc(val) + '"' + req +
        (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
        (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') +
        (f.step ? ' step="' + f.step + '"' : '') + (f.readonly ? ' readonly' : '') +
        (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + '>';
    }
    return '<div class="field span-' + (f.col || 2) + '" data-field="' + f.name + '">' +
      '<label for="' + id + '">' + esc(f.label) + (f.required ? ' <i>*</i>' : '') + '</label>' +
      input + (f.help ? '<em>' + esc(f.help) + '</em>' : '') + '<b class="err" hidden></b></div>';
  }
  function fmaxlength(f) { return f.maxlength; }

  function formHtml(fields) {
    return '<form class="form-grid" id="uiForm" novalidate>' + fields.map(fieldHtml).join('') + '</form>';
  }

  function readForm(scope) {
    const out = {};
    scope.querySelectorAll('[name]').forEach(el => {
      out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }

  function paintErrors(scope, errors) {
    scope.querySelectorAll('.err').forEach(e => { e.hidden = true; e.textContent = ''; });
    scope.querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
    Object.keys(errors || {}).forEach(k => {
      const field = scope.querySelector('[data-field="' + k + '"]');
      if (!field) return;
      field.classList.add('has-error');
      const err = field.querySelector('.err');
      if (err) { err.textContent = errors[k]; err.hidden = false; }
    });
  }

  /* a modal whose submit runs through a validator returning {ok, errors} */
  function formModal(cfg) {
    const fields = cfg.fields;
    const m = modal({
      title: cfg.title, sub: cfg.sub, wide: cfg.wide, sticky: true,
      body: formHtml(fields) + (cfg.footerNote ? '<p class="modal-note">' + esc(cfg.footerNote) + '</p>' : ''),
      actions: [{ id: 'save', label: cfg.submitLabel || 'Save', cls: cfg.danger ? 'danger' : 'accent' }],
      onAction(id, scope, done) {
        if (id !== 'save') return;
        const vals = readForm(scope);
        const res = cfg.onSubmit ? cfg.onSubmit(vals) : { ok: true };
        if (res && res.ok === false) {
          paintErrors(scope, res.errors || {});
          const firstMsg = Object.values(res.errors || {})[0];
          if (firstMsg) toast(firstMsg, 'err');
          return false;
        }
        done();
        if (cfg.onDone) cfg.onDone(res || {});
        if (res && res.message) toast(res.message, res.type || 'ok');
        return false;
      }
    });
    return m;
  }

  /* ---------------- data table ---------------- */
  const state = {};

  function table(host, cfg) {
    const key = cfg.id || host.id || 'tbl';
    const s = state[key] || (state[key] = { q: '', sort: cfg.sort || null, dir: cfg.dir || 'asc', page: 1, per: cfg.per || 10, sel: [], filter: {} });
    const cfgs = { per: 10, perPage: true, search: true, actions: true, bulk: false, dense: false };
    Object.keys(cfgs).forEach(k => { if (cfg[k] === undefined) cfg[k] = cfgs[k]; });

    function snapshot() { host.dataset.sig = JSON.stringify({ n: (cfg.rows() || []).length, f: cfg.sig || '' }); }

    function filtered() {
      let rows = cfg.rows().slice();
      if (cfg.search && s.q) {
        const q = s.q.toLowerCase();
        rows = rows.filter(r => (cfg.searchKeys || cfg.columns.map(c => c.key))
          .some(k => String(typeof k === 'function' ? k(r) : r[k] || '').toLowerCase().indexOf(q) > -1));
      }
      Object.keys(s.filter).forEach(k => {
        if (!s.filter[k]) return;
        const col = cfg.columns.find(c => c.key === k);
        rows = rows.filter(r => (col && col.filterValue ? col.filterValue(r) : String(r[k])) === s.filter[k]);
      });
      if (s.sort) {
        const col = cfg.columns.find(c => c.key === s.sort);
        const get = col && col.sortValue ? col.sortValue : (r => r[s.sort]);
        rows.sort((a, b) => {
          const x = get(a), y = get(b);
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * (s.dir === 'asc' ? 1 : -1);
          return String(x).localeCompare(String(y)) * (s.dir === 'asc' ? 1 : -1);
        });
      }
      return rows;
    }

    function draw() {
      const rows = filtered();
      const total = rows.length;
      const pages = Math.max(1, Math.ceil(total / s.per));
      if (s.page > pages) s.page = pages;
      const slice = rows.slice((s.page - 1) * s.per, (s.page - 1) * s.per + s.per);
      const filtersOn = Object.keys(s.filter).filter(k => s.filter[k]).length;

      const selBar = cfg.bulk ? '<div class="dt-bulk' + (s.sel.length ? ' is-on' : ' is-off') + '">' +
        '<span><b>' + s.sel.length + '</b> selected</span>' +
        '<div>' + cfg.bulk.map(b => '<button class="pill-btn ghost sm" data-bulk="' + esc(b.id) + '">' + esc(b.label) + '</button>').join('') +
        '<button class="pill-btn ghost sm" data-bulk="__clear">Clear</button></div></div>' : '';

      const toolbar = (cfg.search || cfg.filters) ? '<div class="dt-bar">' +
        (cfg.search ? '<label class="dt-search">' + icon('search', 16) +
          '<input type="search" data-q placeholder="' + esc(cfg.searchLabel || 'Search…') + '" value="' + esc(s.q) + '"></label>' : '') +
        (cfg.filters || []).map(f => '<select data-filter="' + esc(f.key) + '">' +
          '<option value="">' + esc(f.label) + '</option>' +
          (f.options || []).map(o => '<option value="' + esc(o.value) + '"' + (s.filter[f.key] === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') +
          '</select>').join('') +
        (filtersOn ? '<button class="chip is-off" data-clear-filters>Clear filters ' + icon('x', 13) + '</button>' : '') +
        '<span class="dt-count">' + total + (total === 1 ? ' row' : ' rows') + '</span>' +
        (cfg.perPage && cfg.pages !== false ? '<select data-per><option value="10"' + (s.per === 10 ? ' selected' : '') + '>10 / page</option>' +
          '<option value="25"' + (s.per === 25 ? ' selected' : '') + '>25 / page</option>' +
          '<option value="50"' + (s.per === 50 ? ' selected' : '') + '>50 / page</option></select>' : '') +
        (cfg.toolbarExtra || '') +
        '</div>' : '';

      const head = '<tr>' +
        (cfg.bulk ? '<th class="dt-check"><input type="checkbox" data-sel-all' + (slice.length && s.sel.length === rows.length ? ' checked' : '') + '></th>' : '') +
        cfg.columns.map(c => '<th' + (c.sortable ? ' class="is-sort" data-sort="' + esc(c.key) + '"' : '') +
          (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) +
          (s.sort === c.key ? ' <i class="caret">' + (s.dir === 'asc' ? '↑' : '↓') + '</i>' : '') + '</th>').join('') +
        (cfg.actions ? '<th class="dt-act"></th>' : '') + '</tr>';

      const body = slice.length ? slice.map(r => {
        const id = cfg.rowId ? cfg.rowId(r) : r.id;
        return '<tr data-row="' + esc(id) + '"' + (s.sel.indexOf(id) > -1 ? ' class="is-sel"' : '') + '>' +
          (cfg.bulk ? '<td class="dt-check"><input type="checkbox" data-sel="' + esc(id) + '"' + (s.sel.indexOf(id) > -1 ? ' checked' : '') + '></td>' : '') +
          cfg.columns.map(c => '<td' + (c.align === 'right' ? ' class="ta-r"' : c.align === 'center' ? ' class="ta-c"' : '') + '>' +
            (c.render ? c.render(r) : esc(r[c.key] === undefined || r[c.key] === null || r[c.key] === '' ? '—' : r[c.key])) + '</td>').join('') +
          (cfg.actions ? '<td class="dt-act">' + (cfg.rowActions ? cfg.rowActions(r) : '') + '</td>' : '') +
          '</tr>';
      }).join('') : '<tr class="dt-none"><td colspan="' + (cfg.columns.length + 2) + '">' +
        empty('search', cfg.emptyTitle || 'No rows match those filters.', cfg.emptySub || 'Adjust the search text or clear a filter.').replace(/\n/g, '') + '</td></tr>';

      const pager = pages > 1 ? '<div class="dt-pager"><span>Page ' + s.page + ' of ' + pages + '</span><div>' +
        '<button class="pill-btn ghost sm" data-page="prev"' + (s.page === 1 ? ' disabled' : '') + '>Previous</button>' +
        Array.from({ length: pages }, (_, i) => i + 1).filter(p => p === 1 || p === pages || Math.abs(p - s.page) <= 1)
          .map((p, i, arr) => (i && p - arr[i - 1] > 1 ? '<span class="dt-dots">…</span>' : '') +
            '<button class="pill-btn sm ' + (p === s.page ? 'primary' : 'ghost') + '" data-page="' + p + '">' + p + '</button>').join('') +
        '<button class="pill-btn ghost sm" data-page="next"' + (s.page === pages ? ' disabled' : '') + '>Next</button>' +
        '</div></div>' : '';

      host.innerHTML = toolbar + selBar +
        '<div class="tbl-wrap"><table class="tbl dt"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' + pager;
      snapshot();
    }

    host.addEventListener('input', e => {
      const q = e.target.closest('[data-q]');
      if (q) { s.q = q.value; s.page = 1; draw(); return; }
    });
    host.addEventListener('change', e => {
      const f = e.target.closest('[data-filter]');
      if (f) { s.filter[f.dataset.filter] = f.value; s.page = 1; draw(); return; }
      const per = e.target.closest('[data-per]');
      if (per) { s.per = +per.value; s.page = 1; draw(); return; }
      const one = e.target.closest('[data-sel]');
      if (one) {
        const id = one.dataset.sel;
        if (one.checked) { if (s.sel.indexOf(id) < 0) s.sel.push(id); }
        else s.sel = s.sel.filter(x => x !== id);
        draw(); return;
      }
      const all = e.target.closest('[data-sel-all]');
      if (all) {
        const rows = filtered();
        s.sel = all.checked ? rows.map(r => cfg.rowId ? cfg.rowId(r) : r.id) : [];
        draw(); return;
      }
    });
    host.addEventListener('click', e => {
      const col = e.target.closest('[data-sort]');
      if (col) {
        const k = col.dataset.sort;
        if (s.sort === k) s.dir = s.dir === 'asc' ? 'desc' : 'asc'; else { s.sort = k; s.dir = 'asc'; }
        draw(); return;
      }
      const p = e.target.closest('[data-page]');
      if (p) {
        const total = filtered().length;
        const pages = Math.max(1, Math.ceil(total / s.per));
        if (p.dataset.page === 'prev') s.page = Math.max(1, s.page - 1);
        else if (p.dataset.page === 'next') s.page = Math.min(pages, s.page + 1);
        else s.page = +p.dataset.page;
        draw(); return;
      }
      if (e.target.closest('[data-clear-filters]')) { Object.keys(s.filter).forEach(k => s.filter[k] = ''); s.page = 1; draw(); return; }
      const bulk = e.target.closest('[data-bulk]');
      if (bulk) {
        if (bulk.dataset.bulk === '__clear') { s.sel = []; return draw(); }
        const b = (cfg.bulk || []).find(x => x.id === bulk.dataset.bulk);
        if (b) { const res = b.run(s.sel.slice()); if (res === false) return draw(); }
        s.sel = [];
        draw(); return;
      }
      const act = e.target.closest('[data-row-act]');
      if (act) {
        const row = act.closest('[data-row]');
        const id = row && row.dataset.row;
        const r = cfg.rows().find(x => (cfg.rowId ? cfg.rowId(x) : x.id) === id);
        if (cfg.onAction) cfg.onAction(act.dataset.rowAct, r, draw);
      }
    });

    draw();
    return { draw: draw, state: s, rows: filtered };
  }

  /* ---------------- empty / skeleton ---------------- */
  function empty(iconName, title, sub, action) {
    return '<div class="empty">' + icon(iconName || 'help', 40) +
      '<div class="empty-t">' + esc(title || 'Nothing here yet.') + '</div>' +
      (sub ? '<div class="empty-s">' + esc(sub) + '</div>' : '') +
      (action ? '<div class="empty-a">' + action + '</div>' : '') + '</div>';
  }

  function skeleton(rows, cols) {
    const r = rows || 5, c = cols || 5;
    return '<div class="skel-wrap">' + Array.from({ length: r }, () =>
      '<div class="skel-row">' + Array.from({ length: c }, (_, i) =>
        '<span class="skel skel-' + (i === 0 ? 'ava' : 'line') + '"' + (i === 0 ? '' : ' style="flex:' + (1 + (i % 3)) + '"') + '></span>').join('') + '</div>').join('') + '</div>';
  }

  /* ---------------- export ---------------- */
  function csv(filename, columns, rows) {
    const cell = v => {
      const s = String(v === null || v === undefined ? '' : v).replace(/<[^>]+>/g, '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [columns.map(c => cell(c.label)).join(',')];
    rows.forEach(r => lines.push(columns.map(c =>
      cell(c.value ? c.value(r) : r[c.key])).join(',')));
    const blob = new Blob(['' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return lines.length - 1;
  }

  function print(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=1024,height=768');
    if (!w) { toast('Your browser blocked the print window — allow pop-ups for this page.', 'err'); return false; }
    w.document.write('<!doctype html><html><head><title>' + esc(title) + '</title>' +
      '<meta charset="utf-8"><style>' +
      'body{font:14px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif;color:#171922;padding:32px}' +
      'h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:26px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#6b6f86}' +
      '.sub{color:#6b6f86;margin:0 0 22px;font-size:13px}' +
      'table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #dcdfe9;padding:8px 10px;text-align:left;font-size:13px}' +
      'th{background:#f3f4fa;text-transform:uppercase;font-size:10.5px;letter-spacing:.05em}' +
      '.kpi{display:flex;gap:14px;flex-wrap:wrap}.kpi div{border:1px solid #dcdfe9;border-radius:10px;padding:10px 14px;min-width:150px}' +
      '.kpi b{display:block;font-size:20px}.kpi span{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b6f86}' +
      '@media print{body{padding:0}.noprint{display:none}}</style></head><body>' +
      '<h1>' + esc(title) + '</h1>' +
      '<p class="sub">' + esc((window.Store ? Store.settings.club.full : 'PickleMarawi')) + ' · generated ' +
      new Date().toLocaleString('en-PH') + '</p>' + bodyHtml +
      '<div class="noprint" style="margin-top:30px"><button onclick="window.print()" style="padding:10px 18px;border-radius:9px;border:1px solid #c9ccdb;background:#171922;color:#fff;font-weight:700;cursor:pointer">Print</button> ' +
      '<button onclick="window.close()" style="padding:10px 18px;border-radius:9px;border:1px solid #c9ccdb;background:#fff;color:#171922;font-weight:700;cursor:pointer">Close</button></div>' +
      '</body></html>');
    w.document.close();
    w.focus();
    return true;
  }

  /* receipt-style printable document */
  function printReceipt(payment) {
    const s = Store.sel, st = Store.settings;
    return print('Receipt ' + payment.id,
      '<div class="kpi"><div><span>Amount</span><b>' + money(payment.amount) + '</b></div>' +
      '<div><span>Status</span><b>' + esc(payment.status) + '</b></div>' +
      '<div><span>Method</span><b>' + esc(payment.method) + '</b></div></div>' +
      '<h2>Invoice</h2><table><tr><th>Reference</th><td>' + esc(payment.id) + '</td></tr>' +
      '<tr><th>Transaction</th><td>' + esc(payment.ref) + '</td></tr>' +
      '<tr><th>Billed to</th><td>' + esc(payment.who) + '</td></tr>' +
      '<tr><th>Item</th><td>' + esc(payment.item) + '</td></tr>' +
      '<tr><th>Category</th><td>' + esc(payment.kind) + '</td></tr>' +
      '<tr><th>Date</th><td>' + esc(s.fmtDate(payment.date)) + '</td></tr></table>' +
      '<h2>Club</h2><table><tr><td>' + esc(st.full) + '<br>' + esc(st.address) + '<br>' + esc(st.phone) + ' · ' + esc(st.email) + '</td></tr></table>');
  }

  /* ---------------- odds and ends ---------------- */
  const avatar = (name, tone, size) => '<span class="ava" style="background:' + (tone || '#6b7cff') + '"' +
    (size ? ' data-s="' + size + '"' : '') + '>' + esc(initials(name)) + '</span>';

  const link = (label, route) => '<button class="linkish" data-goto="' + route + '">' + esc(label) + '</button>';

  function seg(items, active, attr) {
    return '<div class="seg" role="tablist">' + items.map(i =>
      '<button ' + (attr || 'data-seg') + '="' + esc(typeof i === 'string' ? i : i.id) + '" class="' +
      (String(active) === String(typeof i === 'string' ? i : i.id) ? 'is-active' : '') + '">' +
      esc(typeof i === 'string' ? i : i.label) + '</button>').join('') + '</div>';
  }

  function kpi(cfg) {
    const link = cfg.go ? ' data-goto="' + esc(cfg.go) + '"' +
      (cfg.focus ? ' data-focus="' + esc(cfg.focus) + '"' : '') +
      ' tabindex="0" role="link" aria-label="Open ' + esc(cfg.label) + '"' : '';
    return '<article class="card kpi-card' + (cfg.go ? ' is-link' : '') + '"' + link + '>' +
      '<div class="kpi-top"><span class="kpi-slab">' + icon(cfg.icon, 22) + '</span>' +
      (cfg.delta ? '<span class="kpi-delta is-' + (cfg.deltaDir || 'up') + '">' + esc(cfg.delta) + '</span>' : '') + '</div>' +
      '<span class="kpi-label">' + esc(cfg.label) + '</span>' +
      '<b class="kpi-value">' + esc(cfg.value) + '</b>' +
      '<span class="kpi-sub">' + esc(cfg.sub || '') + '</span></article>';
  }

  function loading(host, rows) {
    if (typeof host === 'string') host = $(host);
    if (host) host.innerHTML = skeleton(rows || 6, 5);
  }

  function actionBtn(act, label, cls, iconName) {
    return '<button class="row-act ' + (cls || '') + '" data-row-act="' + esc(act) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
      icon(iconName || act, 16) + '</button>';
  }

  /* select option helpers built from the store */
  const playerOptions = () => Store.list('players').slice().sort((a, b) => a.name.localeCompare(b.name))
    .map(p => ({ value: p.id, label: p.name + ' · ' + Store.tierName(p.membership) }));
  const courtOptions = () => Store.list('courts').slice().sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ value: c.id, label: c.name + ' · ' + money(c.pricePerHour) + '/hr' }));
  const venueOptions = () => VENUES.map(v => {
    const decks = Store.sel.venuesForVenue(v.id).length;
    return { value: v.id, label: v.name + (decks ? ' · ' + decks + ' deck' + (decks > 1 ? 's' : '') : ' · no decks yet') };
  });
  const methodOptions = ['GCash', 'Cash', 'Card', 'Bank', 'Maya'].map(m => ({ value: m, label: m }));

  return {
    $: $, esc: esc, relTime: relTime, clock: clock, toast: toast, badge: badge,
    modal: modal, confirm: confirm, formHtml: formHtml, formModal: formModal, readForm: readForm, paintErrors: paintErrors,
    table: table, empty: empty, skeleton: skeleton, loading: loading,
    csv: csv, print: print, printReceipt: printReceipt,
    avatar: avatar, link: link, seg: seg, kpi: kpi, actionBtn: actionBtn,
    playerOptions: playerOptions, courtOptions: courtOptions, venueOptions: venueOptions, methodOptions: methodOptions,
    field: fieldHtml
  };
})();

window.UI = UI;
