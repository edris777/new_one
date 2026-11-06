/* ============================================================
   Partials — templates/partials/navbar.html and footer.html
   Markup and class names kept identical so app.css styling and the
   sticky/reveal motion behave exactly as in the Django build.
   ============================================================ */

const Partials = (function () {
  const { esc } = UI;

  /* base.html picks nav--solid for every page except pages:home */
  function navbar(routeKey, isHome) {
    const user = Store.sel.user();
    const link = MAIN_LINKS.map(item =>
      '<a href="' + esc(item.href) + '" class="nav__link' +
      (routeKey === item.key ? ' is-active' : '') + '">' + esc(item.label) + '</a>').join('');

    const actions = user
      ? '<a class="nav__ghost" href="' + esc(user.dashboard_url) + '">' + icon('grid') + '<span>Dashboard</span></a>'
      : '<a class="nav__ghost" href="/accounts/login">Log in</a>';

    const menuLinks = MOBILE_LINKS.map(item =>
      '<a href="' + esc(item.href) + '">' + esc(item.label) + ' ' + icon('arrow-up-right') + '</a>').join('');

    const foot = user
      ? '<a class="btn btn--dark btn--block" href="' + esc(user.dashboard_url) + '">Open dashboard</a>'
      : '<a class="btn btn--dark btn--block" href="/accounts/login">Log in</a>' +
        '<a class="btn btn--outline btn--block" href="/accounts/register">Create account</a>';

    return '<header class="nav' + (isHome ? '' : ' nav--solid') + '" id="siteNav" data-nav>' +
      '<div class="nav__inner">' +
        '<a class="brand" href="/" aria-label="DinkHub home">' + brandMark() +
          '<span class="brand__text">Dink<span>Hub</span></span></a>' +
        '<nav class="nav__links" aria-label="Main navigation">' + link + '</nav>' +
        '<div class="nav__actions">' + actions +
          '<a class="btn btn--light btn--sm" href="/courts">Book a court' +
            '<span class="btn__orb">' + icon('arrow-up-right') + '</span></a>' +
          '<button class="nav__burger" type="button" aria-label="Open menu" aria-expanded="false" data-menu-toggle>' +
            icon('menu') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="mobile-menu" data-mobile-menu hidden>' +
        '<div class="mobile-menu__head">' +
          '<span class="brand__text brand__text--dark">Dink<span>Hub</span></span>' +
          '<button class="nav__burger" type="button" aria-label="Close menu" data-menu-close>' +
            icon('close') + '</button></div>' +
        '<nav class="mobile-menu__links" aria-label="Mobile navigation">' + menuLinks + '</nav>' +
        '<div class="mobile-menu__foot">' + foot + '</div>' +
      '</div>' +
    '</header>';
  }

  function footer() {
    const year = new Date().getFullYear();
    const contact = (iconName, title, body) =>
      '<div class="footer__contact"><span class="footer__ico">' + icon(iconName) + '</span>' +
      '<div><strong>' + esc(title) + '</strong><p>' + body + '</p></div></div>';

    return '<footer class="footer"><div class="shell"><div class="footer__grid">' +
      '<div class="footer__brand">' +
        '<a class="brand brand--footer" href="/">' + brandMark() +
        '<span class="brand__text brand__text--dark">Dink<span>Hub</span></span></a>' +
        '<p class="footer__blurb">A pickleball court marketplace built for Marawi City and nearby ' +
          'communities. Discover real courts, request a slot, and play.</p>' +
        '<a class="footer__cta" href="/courts">Find a court ' + icon('arrow-right') + '</a>' +
      '</div>' +
      '<div class="footer__col"><h3>Explore</h3>' +
        '<a href="/">Home</a><a href="/courts">Browse courts</a><a href="/how-it-works">How it works</a>' +
        '<a href="/guide">Pickleball guide</a><a href="/about">About DinkHub</a></div>' +
      '<div class="footer__col"><h3>For venue owners</h3>' +
        '<a href="/courts/new">List your court</a><a href="/dashboard/owner">Owner dashboard</a>' +
        '<a href="/how-it-works#owners">Review process</a><a href="/accounts/register">Create an account</a>' +
        '<a href="/developers">Developers</a></div>' +
      '<div class="footer__col footer__col--contact"><h3>Contact</h3>' +
        contact('pin', 'Service area', 'Marawi City, Lanao del Sur, Philippines') +
        contact('mail', 'Email', '<a href="/contact">Send us a message</a>') +
        contact('clock', 'Support hours', 'Mon-Sat, 8:00 AM - 6:00 PM') +
      '</div></div>' +
      '<div class="footer__bar"><p>&copy; ' + year + ' DinkHub. All rights reserved.</p>' +
        '<div class="footer__legal"><a href="/contact">Privacy</a><a href="/contact">Terms</a>' +
        '<a href="/contact">Booking policy</a></div></div>' +
    '</div></footer>';
  }

  function renderChrome(routeKey, isHome) {
    const header = document.getElementById('siteHeader');
    const footerNode = document.getElementById('siteFooter');
    if (header) header.innerHTML = navbar(routeKey, isHome);
    if (footerNode) footerNode.innerHTML = footer();
    Motion.syncNav();
  }

  /* Django's messages.render() + base.html toast-stack */
  function drainFlash() {
    Store.takeFlash().forEach(message => Motion.toast(message.text, message.tags));
  }

  return { navbar, footer, renderChrome, drainFlash };
})();

window.Partials = Partials;
