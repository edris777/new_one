/* ============================================================
   UI helpers — every one emits DinkHub's existing class names so
   templates/partials markup and css/app.css keep working unchanged.
   ============================================================ */

const UI = (function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* status -> the badge--* modifier the models exposed as status_tone */
  function badge(tone, label) {
    return '<span class="badge badge--' + esc(tone || 'muted') + '">' + esc(label) + '</span>';
  }

  /* ---------- building blocks reused across pages ---------- */

  function eyebrow(text, light) {
    return '<span class="eyebrow' + (light ? ' eyebrow--light' : '') + '">' + esc(text) + '</span>';
  }

  function sectionHead(title, sub, opts) {
    const config = opts || {};
    return '<div class="section-head' + (config.center ? ' section-head--center' : '') +
      (config.split ? ' section-head--split' : '') + '">' +
      (config.eyebrow ? eyebrow(config.eyebrow, config.light) : '') +
      '<h2 class="h2' + (config.light ? ' h2--light' : '') + '">' + title + '</h2>' +
      (sub ? '<p class="section-head__sub' + (config.light ? ' voices__sub' : '') + '">' + esc(sub) + '</p>' : '') +
      '</div>';
  }

  /* .btn with the rotating .btn__orb arrow from partials/navbar.html */
  function button(label, opts) {
    const config = opts || {};
    const classes = ['btn'];
    classes.push(config.variant ? 'btn--' + config.variant : 'btn--dark');
    if (config.small) classes.push('btn--sm');
    if (config.block) classes.push('btn--block');
    if (config.className) classes.push(config.className);
    const orb = config.orb === false ? '' :
      '<span class="btn__orb">' + icon(config.orbIcon || 'arrow-up-right') + '</span>';
    const inner = esc(label) + orb;
    if (config.href) {
      return '<a class="' + classes.join(' ') + '" href="' + esc(config.href) + '"' +
        (config.attrs || '') + '>' + inner + '</a>';
    }
    return '<button type="' + (config.type || 'button') + '" class="' + classes.join(' ') + '"' +
      (config.attrs || '') + '>' + inner + '</button>';
  }

  function linkPill(label, href) {
    return '<a class="link-pill" href="' + esc(href) + '">' + esc(label) + icon('arrow-right') + '</a>';
  }

  function linkArrow(label, href) {
    return '<a class="link-arrow" href="' + esc(href) + '">' + esc(label) + icon('arrow-right') + '</a>';
  }

  /* .stat tiles with data-count so Motion's count-up still fires.
     Markup matches templates/pages/home.html exactly. */
  function statBand(stats) {
    return stats.map((s, i) =>
      '<div class="stat" data-reveal style="--delay:' + (i * 10) + 'ms">' +
      '<span class="stat__ico">' + icon(s.icon) + '</span>' +
      '<p class="stat__num" data-count="' + esc(s.value) + '">' + esc(DATA.nf.format(Number(s.value))) + '</p>' +
      '<p class="stat__label">' + esc(s.label) + '</p></div>').join('');
  }

  /* The court card from pages/home.html and venues/browse.html.
     `delay` adds the staggered --delay the featured grid used; `limit`
     matches the |slice:"3" / |slice:"4" on the facility chips. */
  function courtCard(venue, opts) {
    const config = opts || {};
    const href = '/courts/' + venue.slug;
    const fallback = venue.setting === 'indoor' ? 'img/court-indoor.jpg' : 'img/court-outdoor.jpg';
    const chips = (venue.facility_list || []).slice(0, config.limit || 4).map(f => f && f.name ? f.name : f);

    return '<article class="court-card" data-reveal' +
      (config.delay ? ' style="--delay:' + config.delay + '"' : '') + '>' +
      '<a class="court-card__media" href="' + esc(href) + '">' +
        '<img src="' + esc(venue.cover || '/' + fallback) + '" alt="' + esc(venue.name) + '" loading="lazy">' +
        '<span class="court-card__tag">' + esc(venue.setting_display || venue.setting) + '</span>' +
        (venue.is_demo ? '<span class="court-card__demo">Sample listing</span>' : '') +
      '</a>' +
      '<div class="court-card__body">' +
        '<div class="court-card__top">' +
          '<h3><a href="' + esc(href) + '">' + esc(venue.name) + '</a></h3>' +
          '<span class="court-card__rate">' + esc(venue.rate_display) + '</span>' +
        '</div>' +
        '<p class="court-card__loc">' + icon('pin') + esc(venue.address + ', ' + venue.location_label) + '</p>' +
        '<div class="court-card__facts">' +
          '<span>' + icon('paddle') + esc(venue.court_count) + ' court' +
            (venue.court_count === 1 ? '' : 's') + '</span>' +
          '<span>' + icon('clock') + esc(DATA.ampm(venue.opening_time) + '–' + DATA.ampm(venue.closing_time)) + '</span>' +
        '</div>' +
        (chips.length ? '<div class="chip-row">' + chips.map(chip).join('') + '</div>' : '') +
        '<a class="court-card__cta" href="' + esc(href) + '">View court ' + icon('arrow-right') + '</a>' +
      '</div></article>';
  }

  function courtGrid(venues, opts) {
    const config = opts || {};
    return '<div class="' + (config.className || 'court-grid') + '">' +
      venues.map((v, i) => courtCard(v, {
        limit: config.limit,
        delay: config.stagger ? (config.staggerMs || (i * 100)) + 'ms' : ''
      })).join('') + '</div>';
  }

  /* section wrappers used by more than one page */
  function pageHero(breadcrumb, eyebrowText, title, lead) {
    return '<section class="page-hero"><div class="shell page-hero__inner">' +
      '<nav class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span><span>' +
      esc(breadcrumb) + '</span></nav>' +
      eyebrow(eyebrowText) + '<h1>' + esc(title) + '</h1>' +
      (lead ? '<p>' + esc(lead) + '</p>' : '') + '</div></section>';
  }

  function statCards(cards) {
    return '<div class="stat-cards">' + cards.map(c =>
      '<div class="stat-card' + (c.accent ? ' stat-card--accent' : '') + '">' +
      '<span>' + esc(c.label) + '</span><strong>' + esc(c.value) + '</strong>' +
      (c.sub ? '<p class="muted">' + esc(c.sub) + '</p>' : '') + '</div>').join('') + '</div>';
  }

  function emptyPanel(iconName, title, body, actionHtml) {
    return '<div class="empty-panel" data-reveal>' +
      '<span class="empty-panel__ico">' + icon(iconName || 'paddle') + '</span>' +
      '<h3>' + esc(title) + '</h3>' +
      (body ? '<p>' + esc(body) + '</p>' : '') +
      (actionHtml || '') + '</div>';
  }

  function chip(text) {
    return '<span class="chip">' + esc(text) + '</span>';
  }

  function facilityPill(facility) {
    return '<span class="facility-pill">' + icon(facility.icon || 'check') + esc(facility.name) + '</span>';
  }

  /* ---------- forms ---------- */
  /* .form-row + .form-control are Django's markup; errors render as .form-error */
  function field(config) {
    const name = esc(config.name);
    const id = 'f-' + name;
    const value = config.value == null ? '' : config.value;
    let input;

    if (config.type === 'select') {
      input = '<select class="form-select form-control" id="' + id + '" name="' + name + '"' +
        (config.attrs || '') + '>' +
        (config.placeholder ? '<option value="">' + esc(config.placeholder) + '</option>' : '') +
        (config.options || []).map(o => {
          const selected = String(o.value) === String(value) ? ' selected' : '';
          return '<option value="' + esc(o.value) + '"' + selected + '>' + esc(o.label) + '</option>';
        }).join('') + '</select>';
    } else if (config.type === 'textarea') {
      input = '<textarea class="form-control" id="' + id + '" name="' + name + '" rows="' +
        (config.rows || 4) + '"' + (config.attrs || '') + '>' + esc(value) + '</textarea>';
    } else if (config.type === 'checkbox') {
      return '<div class="form-check"><input type="checkbox" id="' + id + '" name="' + name + '"' +
        (value ? ' checked' : '') + (config.attrs || '') + '>' +
        '<label for="' + id + '">' + esc(config.label) + '</label></div>';
    } else {
      input = '<input class="form-control" type="' + (config.type || 'text') + '" id="' + id +
        '" name="' + name + '" value="' + esc(value) + '"' +
        (config.autofocus ? ' autofocus' : '') + (config.attrs || '') + '>';
    }

    return '<div class="form-row' + (config.full ? ' form-row--full' : '') + '">' +
      '<label for="' + id + '">' + esc(config.label) + (config.required ? ' *' : '') + '</label>' +
      input +
      (config.help ? '<span class="form-text">' + esc(config.help) + '</span>' : '') +
      '<span class="form-error" data-error="' + name + '"></span></div>';
  }

  /* Radio cards use .radio-option / :has(input:checked) from app.css */
  function radioCards(name, options, current, opts) {
    const config = opts || {};
    return '<div class="radio-group">' + options.map(o =>
      '<label class="radio-option"><input type="radio" name="' + esc(name) + '" value="' + esc(o.value) + '"' +
      (String(o.value) === String(current) ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>').join('') +
      '</div>';
  }

  /* .facility-checklist pills, checked state driven by CSS :has() */
  function facilityChecklist(facilities, selected) {
    const chosen = selected || [];
    return '<ul class="facility-checklist">' + facilities.map(f =>
      '<li><label><input type="checkbox" name="facilities" value="' + esc(f.slug) + '"' +
      (chosen.indexOf(f.slug) > -1 ? ' checked' : '') + '>' + icon(f.icon || 'check') + esc(f.name) +
      '</label></li>').join('') + '</ul>';
  }

  function formErrors(errors) {
    if (!errors) return '';
    const list = errors.__all__ || [];
    if (!list.length) return '';
    return '<div class="form-errors">' + list.map(esc).join('<br>') + '</div>';
  }

  function readForm(scope) {
    const values = {};
    $$('input, select, textarea', scope).forEach(el => {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (el.name === 'facilities') {
          values.facilities = values.facilities || [];
          if (el.checked) values.facilities.push(el.value);
        } else {
          values[el.name] = el.checked;
        }
        return;
      }
      if (el.type === 'radio') {
        /* an unchecked radio must not overwrite the group with its own value */
        if (el.checked) values[el.name] = el.value;
        return;
      }
      if (el.type === 'file') { values[el.name] = el.files; return; }
      if (el.multiple) {
        values[el.name] = Array.from(el.selectedOptions).map(o => o.value);
        return;
      }
      values[el.name] = el.value;
    });
    return values;
  }

  /* Django's form.as_* error placement: one .form-error under the field */
  function paintErrors(scope, errors) {
    $$('[data-error]', scope).forEach(node => { node.textContent = ''; });
    Object.keys(errors || {}).forEach(name => {
      if (name === '__all__') return;
      const node = $('[data-error="' + name + '"]', scope);
      if (node) node.textContent = (errors[name] || []).join(' ');
    });
  }

  /* ---------- tables ---------- */
  /* table.data + .table-wrap are already styled in app.css */
  function table(columns, rows, opts) {
    const config = opts || {};
    return '<div class="table-wrap"><table class="data">' +
      '<thead><tr>' + columns.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + (rows.length ? rows.join('') :
        '<tr><td colspan="' + columns.length + '" class="muted">' + esc(config.empty || 'Nothing to show yet.') + '</td></tr>') +
      '</tbody></table></div>';
  }

  function row(cells) {
    return '<tr>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
  }

  /* ---------- pagination ---------- */
  /* Django's page_range chain: current, then first/last/|n-current|<=2 as
     links, and a single gap marker at exactly distance 3. */
  function pagination(current, pages, hrefFor, opts) {
    const config = opts || {};
    if (pages <= 1 && !config.prev && !config.next) return '';
    let out = '<nav class="pagination" aria-label="Pagination">';
    if (current > 1) out += '<a href="' + esc(config.prev || hrefFor(current - 1)) + '">Prev</a>';
    for (let n = 1; n <= pages; n++) {
      if (n === current) {
        out += '<span class="is-current" aria-current="page">' + n + '</span>';
      } else if (n === 1 || n === pages || (n > current - 3 && n < current + 3)) {
        out += '<a href="' + esc(hrefFor(n)) + '">' + n + '</a>';
      } else if (n === current - 3 || n === current + 3) {
        out += '<span class="is-gap">\u2026</span>';
      }
    }
    if (current < pages) out += '<a href="' + esc(config.next || hrefFor(current + 1)) + '">Next</a>';
    return out + '</nav>';
  }

  /* ---------- modal ---------- */
  /* Not in the Django design system; styled in css/components.css using the
     same tokens so it reads as DinkHub. Entrance reuses the toast easing. */
  function modal(config) {
    const backdrop = $('#modalBackdrop');
    const node = document.createElement('div');
    node.className = 'modal';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.innerHTML =
      '<div class="modal__card">' +
        '<div class="modal__head"><h2>' + esc(config.title) + '</h2>' +
        (config.sub ? '<p>' + esc(config.sub) + '</p>' : '') +
        '<button type="button" class="modal__x" aria-label="Close">' + icon('close') + '</button></div>' +
        '<div class="modal__body">' + (config.body || '') + '</div>' +
        '<div class="modal__foot">' + (config.actions || '') + '</div>' +
      '</div>';

    if (backdrop) { backdrop.hidden = false; backdrop.classList.add('is-open'); }
    document.body.appendChild(node);

    function close() {
      node.remove();
      if (backdrop) { backdrop.classList.remove('is-open'); backdrop.hidden = true; }
    }

    node.querySelector('.modal__x').addEventListener('click', close);
    node.addEventListener('click', event => {
      const action = event.target.closest('[data-modal-action]');
      if (!action) return;
      if (action.dataset.modalAction === 'close') return close();
      if (config.onAction) config.onAction(action.dataset.modalAction, node, close);
    });
    if (config.onOpen) config.onOpen(node, close);
    return { el: node, close: close };
  }

  function confirm(config) {
    return new Promise(resolve => {
      const handle = modal({
        title: config.title,
        sub: config.sub,
        body: '<p class="muted">' + esc(config.body || 'This cannot be undone.') + '</p>',
        actions: '<button type="button" class="btn btn--outline btn--sm" data-modal-action="cancel">' +
          esc(config.cancelLabel || 'Keep it') + '</button>' +
          '<button type="button" class="btn btn--sm" data-modal-action="ok">' +
          esc(config.okLabel || 'Confirm') + '</button>'
      });
      handle.el.addEventListener('click', event => {
        if (event.target.closest('[data-modal-action="cancel"]')) { handle.close(); resolve(false); }
        if (event.target.closest('[data-modal-action="ok"]')) { handle.close(); resolve(true); }
      });
    });
  }

  function loading(message) {
    return '<section class="section"><div class="shell"><p class="muted">' + esc(message || 'Loading...') + '</p></div></section>';
  }

  function notFound(title, body, actionHtml) {
    return '<section class="page-hero"><div class="shell"><div class="page-hero__inner">' +
      eyebrow('Not available') + '<h1 class="h2">' + esc(title) + '</h1>' +
      '<p>' + esc(body) + '</p>' + (actionHtml || '') + '</div></div></section>';
  }

  /* file input -> dataURL, so image uploads need no multipart parser */
  function readImage(file) {
    return new Promise(resolve => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ data: String(reader.result), name: file.name });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  return {
    $, $$, esc, badge, eyebrow, sectionHead, button, linkPill, linkArrow, statBand, statCards,
    courtCard, courtGrid, pageHero,
    emptyPanel, chip, facilityPill, field, radioCards, facilityChecklist, formErrors, readForm,
    paintErrors, table, row, pagination, modal, confirm, loading, notFound, readImage,
    /* motion.js loads after this file, so reach for it only when a toast is asked for */
    toast: (text, tags) => Motion.toast(text, tags)
  };
})();

window.UI = UI;
