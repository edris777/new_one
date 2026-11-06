/* ============================================================
   DinkHub front-end interactions — port of static/js/main.js
     - sticky navigation on scroll
     - working mobile menu
     - scroll reveal + count-up statistics
     - toasts
   All motion respects prefers-reduced-motion.

   Behaviour is deliberately unchanged from the Django build. The
   only addition is scan()/syncNav(): the original ran once on a full
   page load, and an SPA swaps markup without reloading, so the same
   observers are re-armed for newly inserted elements. Thresholds,
   durations, easings and the 250ms/7000ms timings are the originals.
   ============================================================ */

const Motion = (function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const observedReveal = new WeakSet();
  const observedCount = new WeakSet();

  /* ---------- sticky nav ---------- */
  function syncNav() {
    const nav = document.querySelector('[data-nav]');
    if (!nav) return;
    const floating = !nav.classList.contains('nav--solid');
    if (!floating) { nav.classList.remove('is-stuck'); return; }
    nav.classList.toggle('is-stuck', window.scrollY > 60);
  }

  function onScroll() { syncNav(); }

  /* ---------- mobile menu ---------- */
  let menuTimer = null;

  function openMenu() {
    const menu = document.querySelector('[data-mobile-menu]');
    const toggle = document.querySelector('[data-menu-toggle]');
    if (!menu) return;
    if (menuTimer) { window.clearTimeout(menuTimer); menuTimer = null; }
    menu.hidden = false;
    requestAnimationFrame(function () { menu.classList.add('is-open'); });
    document.body.classList.add('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    const menu = document.querySelector('[data-mobile-menu]');
    const toggle = document.querySelector('[data-menu-toggle]');
    if (!menu) return;
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    window.setTimeout(function () { menu.hidden = true; }, 250);
  }

  /* ---------- scroll reveal ---------- */
  let revealObserver = null;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  }

  function armReveal(root) {
    const items = (root || document).querySelectorAll('[data-reveal]');
    Array.prototype.forEach.call(items, function (el) {
      if (observedReveal.has(el)) return;
      observedReveal.add(el);
      if (!revealObserver) { el.classList.add('is-visible'); return; }
      revealObserver.observe(el);
    });
  }

  /* ---------- count-up ---------- */
  function countUp(el) {
    const target = parseInt(el.getAttribute('data-count'), 10) || 0;
    if (reduceMotion) { el.textContent = target.toLocaleString(); return; }
    const duration = 1400;
    let start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  let countObserver = null;
  if ('IntersectionObserver' in window) {
    countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          countUp(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
  }

  function armCounters(root) {
    const counters = (root || document).querySelectorAll('[data-count]');
    Array.prototype.forEach.call(counters, function (el) {
      if (observedCount.has(el)) return;
      observedCount.add(el);
      if (!countObserver) { countUp(el); return; }
      countObserver.observe(el);
    });
  }

  /* ---------- toasts ---------- */
  /* Markup and timings copied from templates/base.html + main.js so the
     toastIn animation and the 7000ms auto-dismiss behave as before. */
  function toast(text, tags) {
    const stack = document.getElementById('toastStack');
    if (!stack) return null;
    const node = document.createElement('div');
    node.className = 'toast toast--' + (tags || 'success');
    node.innerHTML = '<span class="toast__dot"></span><p></p>' +
      '<button type="button" class="toast__close" aria-label="Dismiss">' + icon('close') + '</button>';
    node.querySelector('p').textContent = String(text);
    stack.appendChild(node);

    const dismiss = function () {
      if (!node.isConnected) return;
      node.style.opacity = '0';
      node.style.transform = 'translateY(-6px)';
      window.setTimeout(function () { node.remove(); }, 250);
    };
    node.querySelector('.toast__close').addEventListener('click', dismiss);
    window.setTimeout(dismiss, 7000);
    return node;
  }

  function clearToasts() {
    const stack = document.getElementById('toastStack');
    if (stack) stack.innerHTML = '';
  }

  /* called by the shell after every page render */
  function scan(root) {
    armReveal(root);
    armCounters(root);
    syncNav();
  }

  function init() {
    window.addEventListener('scroll', onScroll, { passive: true });

    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-menu-toggle]')) { event.preventDefault(); return openMenu(); }
      if (event.target.closest('[data-menu-close]')) { event.preventDefault(); return closeMenu(); }
      if (event.target.closest('[data-mobile-menu] a')) return closeMenu();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });

    syncNav();
    armReveal(document);
    armCounters(document);
  }

  return {
    init, scan, syncNav, openMenu, closeMenu, toast, clearToasts, countUp,
    reduceMotion: reduceMotion
  };
})();

window.Motion = Motion;
