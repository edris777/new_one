/* ============================================================
   Account screens — templates/accounts/login.html, register.html
   and profile.html
   ============================================================ */

(function () {
  const esc = UI.esc;

  const ROLE_CHOICES = [
    { value: 'player', label: 'I am a player — I want to book courts' },
    { value: 'owner', label: 'I am a venue owner — I want to list courts' }
  ];

  function shell(inner) {
    return '<section class="auth"><div class="auth__panel"><div class="auth__card">' +
      inner + '</div></div>';
  }

  function media(image, alt, quote) {
    return '<div class="auth__media">' +
      '<img src="/img/' + image + '" alt="' + esc(alt) + '">' +
      '<div class="auth__quote"><p>' + esc(quote) + '</p>' +
      '<span>DinkHub · Marawi City</span></div></div></section>';
  }

  function showErrors(form, res) {
    UI.paintErrors(form, res.errors);
    const nonField = form.querySelector('[data-nonfield-errors]');
    const all = (res.errors && res.errors.__all__) || [];
    nonField.hidden = !all.length;
    nonField.innerHTML = all.map(esc).join('<br>');
  }

  function nextFrom(query) {
    return query.next || '';
  }

  Object.assign(PAGES, {
    login: {
      render(host, params, query) {
        const next = nextFrom(query);
        host.innerHTML = shell(
          '<p class="eyebrow">Welcome back</p><h1>Log in to DinkHub</h1>' +
          '<p>Players track requests, owners manage courts, administrators review listings.</p>' +
          '<form data-login-form novalidate>' +
            '<div class="form-errors" data-nonfield-errors hidden></div>' +
            '<input type="hidden" name="next" value="' + esc(next) + '">' +
            UI.field({ name: 'username', label: 'Username', autofocus: true,
              attrs: ' placeholder="Username" autocomplete="username"' }) +
            UI.field({ name: 'password', label: 'Password', type: 'password',
              attrs: ' placeholder="Password" autocomplete="current-password"' }) +
            '<div class="form-actions">' +
              '<button class="btn btn--dark btn--block" type="submit">Log in' +
                '<span class="btn__orb">' + icon('arrow-right') + '</span></button>' +
            '</div>' +
          '</form>' +
          '<p class="auth__switch">New to DinkHub? <a href="/accounts/register' +
            (next ? '/?next=' + encodeURIComponent(next) : '') + '">Create an account</a></p>' +
          '<div class="auth__hint">Accounts are role-based. Players book courts, venue owners manage' +
            ' listings, administrators are created by the project team.</div>'
        ) + media('hero-court.jpg', 'Pickleball court at sunset',
          'Your next game is one approved request away.');

        const form = host.querySelector('[data-login-form]');
        form.addEventListener('submit', event => {
          event.preventDefault();
          const values = UI.readForm(form);
          Store.ops.login(values.username, values.password, values.next).then(res => {
            if (!res.ok) return showErrors(form, res);
            Store.flash(res.message);
            Partials.renderChrome('', false);
            go(res.redirect || Store.sel.dashboardUrl());
          });
        });
      }
    },

    register: {
      render(host, params, query) {
        const next = nextFrom(query);
        host.innerHTML = shell(
          '<p class="eyebrow">Join DinkHub</p><h1>Create your account</h1>' +
          '<p>Choose how you want to use DinkHub. You can enable owner tools later from your dashboard.</p>' +
          '<form data-register-form novalidate>' +
            '<input type="hidden" name="next" value="' + esc(next) + '">' +
            '<div class="form-errors" data-nonfield-errors hidden></div>' +
            '<div class="form-grid">' +
              UI.field({ name: 'first_name', label: 'First name' }) +
              UI.field({ name: 'last_name', label: 'Last name' }) +
              UI.field({ name: 'username', label: 'Username', attrs: ' placeholder="Choose a username"' }) +
              UI.field({ name: 'email', label: 'Email', type: 'email', attrs: ' placeholder="you@example.com"' }) +
              UI.field({ name: 'phone', label: 'Mobile number (optional)', full: true,
                attrs: ' placeholder="+63 9XX XXX XXXX"' }) +
              UI.field({ name: 'password1', label: 'Password', type: 'password', full: true,
                attrs: ' autocomplete="new-password"', help: 'At least 8 characters.' }) +
              UI.field({ name: 'password2', label: 'Confirm password', type: 'password', full: true,
                attrs: ' autocomplete="new-password"' }) +
            '</div>' +
            '<div class="form-row form-row--full"><label>Account type</label>' +
              UI.radioCards('role', ROLE_CHOICES, 'player') +
              '<span class="form-error" data-error="role"></span></div>' +
            '<div class="form-actions">' +
              '<button class="btn btn--dark btn--block" type="submit">Create account' +
                '<span class="btn__orb">' + icon('arrow-right') + '</span></button>' +
            '</div>' +
          '</form>' +
          '<p class="auth__switch">Already have an account? <a href="/accounts/login">Log in</a></p>'
        ) + media('about-players.jpg', 'Players on court', 'Find your court. Book your game.');

        const form = host.querySelector('[data-register-form]');
        form.addEventListener('submit', event => {
          event.preventDefault();
          const values = UI.readForm(form);
          Store.ops.register({
            first_name: values.first_name, last_name: values.last_name, username: values.username,
            email: values.email, phone: values.phone, role: values.role,
            password1: values.password1, password2: values.password2, next: values.next
          }).then(res => {
            if (!res.ok) return showErrors(form, res);
            Store.flash(res.message);
            Partials.renderChrome('', false);
            go(res.redirect || Store.sel.dashboardUrl());
          });
        });
      }
    },

    profile: {
      render(host) {
        const user = Store.sel.user();
        host.innerHTML = '<section class="dash"><div class="shell">' +
          '<div class="dash__head"><div><p class="eyebrow">Account</p><h1>Profile</h1>' +
            '<p>' + esc(user.display_name) + ' · ' + esc(DATA.ROLE_LABELS[user.role]) + '</p></div>' +
            '<a class="btn btn--outline btn--sm" href="' + esc(user.dashboard_url) + '">Back to dashboard</a>' +
          '</div><div class="two-col">' +
            '<div class="form-card"><form data-profile-form novalidate>' +
              '<div class="form-grid">' +
                UI.field({ name: 'first_name', label: 'First name', value: user.first_name }) +
                UI.field({ name: 'last_name', label: 'Last name', value: user.last_name }) +
                UI.field({ name: 'email', label: 'Email', type: 'email', value: user.email }) +
                UI.field({ name: 'phone', label: 'Mobile number', value: user.phone }) +
                UI.field({ name: 'city', label: 'City', value: user.city }) +
              '</div>' +
              '<div class="form-actions"><button class="btn btn--dark" type="submit">Save profile' +
                '<span class="btn__orb">' + icon('check') + '</span></button></div>' +
            '</form></div>' +
            '<aside class="form-aside"><p class="eyebrow eyebrow--light">Account</p>' +
              '<h3>' + esc(user.username) + '</h3><ul>' +
                '<li>' + icon('user') + '<span>Role: ' + esc(DATA.ROLE_LABELS[user.role]) + '</span></li>' +
                '<li>' + icon('calendar') + '<span>Joined ' + esc(DATA.monthDayYear(user.date_joined)) + '</span></li>' +
                '<li>' + icon('shield') + '<span>Passwords are stored as salted hashes and never in plain text.</span></li>' +
              '</ul></aside>' +
          '</div></div></section>';

        const form = host.querySelector('[data-profile-form]');
        form.addEventListener('submit', event => {
          event.preventDefault();
          const values = UI.readForm(form);
          Store.ops.saveProfile({
            first_name: values.first_name, last_name: values.last_name, email: values.email,
            phone: values.phone, city: values.city
          }).then(res => {
            if (!res.ok) {
              UI.paintErrors(form, res.errors);
              return;
            }
            Store.flash(res.message);
            go('/accounts/profile', true);
          });
        });
      }
    }
  });
})();
