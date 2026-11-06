/* ============================================================
   Browse courts — templates/venues/browse.html
   Filters and sort stay in the URL exactly like Django's GET form,
   so the back button, deep links and the reveal animation on the
   filter panel all behave the same way.
   ============================================================ */

(function () {
  const esc = UI.esc;

  const FILTER_KEYS = ['q', 'city', 'setting', 'facility', 'date'];

  function buildQuery(filters, page) {
    const params = new URLSearchParams();
    FILTER_KEYS.forEach(key => {
      if (filters[key]) params.set(key, filters[key]);
    });
    const sort = filters.sort || 'recommended';
    if (sort !== 'recommended') params.set('sort', sort);
    if (page && page > 1) params.set('page', page);
    const tail = params.toString();
    return '/courts' + (tail ? '?' + tail : '');
  }

  Object.assign(PAGES, {
    browse: {
      render(host, params, query) {
        const filters = {};
        FILTER_KEYS.forEach(key => { filters[key] = query[key] || ''; });
        filters.sort = query.sort || 'recommended';
        filters.page = Number(query.page) || 1;

        return Api.get('/api/venues', filters).then(data => {
          document.title = 'Browse pickleball courts — DinkHub';
          host.innerHTML = [
            pageHero(data),
            '<section class="browse"><div class="shell">' + bar(data, filters) +
              '<div class="browse__layout">' + filterPanel(data, filters) +
              '<div>' + results(data, filters) + '</div></div></div></section>'
          ].join('');

          const filterForm = host.querySelector('[data-filter-form]');

          function submitFilters(event) {
            event.preventDefault();
            go(buildQuery(UI.readForm(filterForm), 1));
          }

          filterForm.addEventListener('submit', submitFilters);
          host.querySelector('[data-sort-form]').addEventListener('change', event => {
            const values = UI.readForm(filterForm);
            values.sort = event.target.value;
            go(buildQuery(values, 1));
          });
        });
      }
    }
  });

  function pageHero(data) {
    return '<section class="page-hero"><div class="shell page-hero__inner">' +
      '<nav class="breadcrumbs"><a href="/">Home</a><span class="sep">/</span>' +
      '<span>Browse courts</span></nav>' +
      '<p class="eyebrow">Court directory</p><h1>Find a court in Marawi</h1>' +
      '<p>Every listing below was submitted by its owner and approved by an administrator.' +
        ' If a city has no approved venue, it will not appear here.</p>' +
      '</div></section>';
  }

  function bar(data, filters) {
    const plural = data.total === 1 ? '' : 's';
    const options = DATA.SORT_OPTIONS.map(option =>
      '<option value="' + esc(option.value) + '"' +
      (option.value === filters.sort ? ' selected' : '') + '>' + esc(option.label) + '</option>').join('');

    return '<div class="browse__bar">' +
      '<p class="browse__count"><strong>' + data.total + '</strong> court venue' + plural +
        ' available' + (filters.city ? ' in ' + esc(filters.city) : '') + '</p>' +
      '<form data-sort-form class="browse__sort">' +
        '<label for="sortSelect">Sort</label>' +
        '<select id="sortSelect" name="sort">' + options + '</select>' +
      '</form></div>';
  }

  function filterPanel(data, filters) {
    const cities = (data.cities || []).map(city =>
      '<option value="' + esc(city) + '"' + (city === filters.city ? ' selected' : '') + '>' +
      esc(city) + '</option>').join('');

    const facilities = (data.facilities || []).map(facility =>
      '<option value="' + esc(facility.slug) + '"' + (facility.slug === filters.facility ? ' selected' : '') + '>' +
      esc(facility.name) + '</option>').join('');

    const radio = (value, label) =>
      '<label class="filter-option"><input type="radio" name="setting" value="' + esc(value) + '"' +
      ((filters.setting || '') === value ? ' checked' : '') + '> ' + esc(label) + '</label>';

    return '<form class="filters" data-filter-form data-reveal>' +
      '<div class="filters__head"><h2>Filters</h2>' +
        (data.has_filters ? '<a class="filters__clear" href="/courts">Clear all</a>' : '') +
      '</div>' +
      '<div class="filter-group"><label for="filterQ">Search</label>' +
        '<input id="filterQ" class="form-control" type="search" name="q" value="' + esc(filters.q) + '"' +
        ' placeholder="Venue, street, barangay"></div>' +
      '<div class="filter-group"><label for="filterCity">City / municipality</label>' +
        '<select id="filterCity" class="form-select" name="city"><option value="">All locations</option>' +
        cities + '</select></div>' +
      '<div class="filter-group"><span class="filter-group__label">Court type</span>' +
        radio('', 'Any') + radio('indoor', 'Indoor') + radio('outdoor', 'Outdoor') + '</div>' +
      (facilities ?
        '<div class="filter-group"><label for="filterFacility">Facility</label>' +
        '<select id="filterFacility" class="form-select" name="facility">' +
        '<option value="">Any facility</option>' + facilities + '</select></div>' : '') +
      '<div class="filter-group"><label for="filterDate">Play date (for your reference)</label>' +
        '<input id="filterDate" class="form-control" type="date" name="date" value="' + esc(filters.date) + '">' +
        '<p class="form-text">Availability is confirmed on the venue page when you choose a court.</p></div>' +
      '<button class="btn btn--dark btn--block" type="submit">Apply filters' +
        '<span class="btn__orb">' + icon('search') + '</span></button>' +
    '</form>';
  }

  function results(data, filters) {
    if (!data.venues || !data.venues.length) {
      return '<div class="browse__empty">' +
        '<span class="empty-panel__ico">' + icon('search') + '</span>' +
        '<h3>No courts match those filters</h3>' +
        '<p>DinkHub only lists approved venues, so a quiet result usually means nothing has been' +
          ' published in that area yet.</p>' +
        '<div class="btn-row" style="justify-content:center;">' +
          '<a class="btn btn--dark btn--sm" href="/courts">Clear filters</a>' +
          '<a class="btn btn--outline btn--sm" href="/courts/new">List your venue</a>' +
        '</div></div>';
    }

    const hrefFor = page => buildQuery(filters, page);
    const pager = data.pages > 1
      ? UI.pagination(data.page, data.pages, hrefFor, {
          prev: hrefFor(data.page - 1), next: hrefFor(data.page + 1)
        })
      : '';

    return UI.courtGrid(data.venues, { className: 'browse__results', limit: 4 }) + pager;
  }
})();
