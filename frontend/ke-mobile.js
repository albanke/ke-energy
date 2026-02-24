/* ke-mobile.js - KE Group Energy Mobile Enhancements */
(function () {
  'use strict';

  function initHamburger() {
    var nav = document.querySelector('.ke-nav');
    if (!nav) return;
    if (document.querySelector('.ke-hamburger')) return;

    var btn = document.createElement('button');
    btn.className = 'ke-hamburger';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(btn);

    var overlay = document.createElement('div');
    overlay.className = 'ke-nav-overlay';
    document.body.appendChild(overlay);

    var drawer = document.createElement('nav');
    drawer.className = 'ke-nav-drawer';
    drawer.setAttribute('aria-label', 'Menu principale');

    var origLinks = document.querySelector('.ke-links');
    var linksHTML = '';
    if (origLinks) {
      origLinks.querySelectorAll('a').forEach(function (a) {
        var isCta = a.classList.contains('ke-cta');
        linksHTML += '<a href="' + a.getAttribute('href') + '"' + (isCta ? ' class="is-cta"' : '') + '>' + a.textContent.trim() + '</a>';
      });
    }

    drawer.innerHTML =
      '<div class="ke-nav-drawer__header">' +
        '<a class="ke-nav-drawer__logo" href="index.html">' +
          '<img src="assets/img/logo-energy.png" alt="KE Group Energy" />' +
          '<span>KE Energy</span>' +
        '</a>' +
        '<button class="ke-nav-drawer__close" aria-label="Chiudi menu">x</button>' +
      '</div>' +
      '<div class="ke-nav-drawer__links">' + linksHTML + '</div>' +
      '<div class="ke-nav-drawer__footer">' +
        '<a href="preventivo.html">Richiedi preventivo gratuito</a>' +
      '</div>';

    document.body.appendChild(drawer);

    function openMenu() {
      btn.classList.add('is-open');
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      btn.classList.remove('is-open');
      overlay.classList.remove('is-open');
      drawer.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    btn.addEventListener('click', function () {
      if (drawer.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    overlay.addEventListener('click', closeMenu);
    drawer.querySelector('.ke-nav-drawer__close').addEventListener('click', closeMenu);

    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });

    function checkSize() {
      if (window.innerWidth > 980) closeMenu();
    }

    window.addEventListener('resize', checkSize);
  }

  function initFAB() {
    var group = null;
    var scrollBound = false;

    function removeFab() {
      if (group && group.parentNode) {
        group.parentNode.removeChild(group);
      }
      group = null;
      document.body.classList.remove('has-mobile-fab');
    }

    function bindScroll() {
      if (scrollBound) return;
      scrollBound = true;

      var lastScroll = 0;
      var ticking = false;

      window.addEventListener('scroll', function () {
        if (!group) return;
        if (!ticking) {
          requestAnimationFrame(function () {
            var current = window.scrollY;
            if (current < 100) {
              group.style.transform = 'translateY(0)';
              group.style.opacity = '1';
            } else if (current > lastScroll + 10) {
              group.style.transform = 'translateY(120%)';
              group.style.opacity = '0';
            } else if (current < lastScroll - 5) {
              group.style.transform = 'translateY(0)';
              group.style.opacity = '1';
            }
            lastScroll = current;
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    }

    function createFab() {
      if (group) return;

      group = document.createElement('div');
      group.className = 'ke-fab-group';
      group.innerHTML =
        '<a class="ke-fab ke-fab--wa" href="https://wa.me/393408043834" target="_blank" rel="noopener" aria-label="Contattaci su WhatsApp">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>' +
          'WhatsApp' +
        '</a>' +
        '<a class="ke-fab ke-fab--cta" href="preventivo.html" aria-label="Richiedi preventivo">Preventivo</a>';

      document.body.appendChild(group);
      document.body.classList.add('has-mobile-fab');
      group.style.transition = 'transform .3s cubic-bezier(.32,.72,0,1), opacity .3s';
      bindScroll();
    }

    function syncFabVisibility() {
      var canShow = window.innerWidth <= 768 && !document.querySelector('.login-screen, .page-login');
      if (canShow) createFab();
      else removeFab();
    }

    syncFabVisibility();
    window.addEventListener('resize', syncFabVisibility);
  }

  function initNavScroll() {
    var nav = document.querySelector('.ke-nav');
    if (!nav) return;

    var ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(function () {
          if (window.scrollY > 60) {
            nav.style.background = 'rgba(3,3,3,.92)';
            nav.style.backdropFilter = 'blur(16px)';
            nav.style.boxShadow = '0 1px 0 rgba(255,255,255,.06)';
          } else {
            nav.style.background = '';
            nav.style.backdropFilter = '';
            nav.style.boxShadow = '';
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initHscroll() {
    document.querySelectorAll('.ke-hscroll').forEach(function (el) {
      el.style.overflowX = 'auto';
      el.style.webkitOverflowScrolling = 'touch';
      el.style.scrollSnapType = 'x mandatory';
      el.querySelectorAll('.ke-slide').forEach(function (slide) {
        slide.style.scrollSnapAlign = 'start';
      });
    });
  }

  function enhanceContacts() {
    if (window.innerWidth > 768) return;

    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      if (!a.querySelector('svg') && !a.closest('.ke-fab-group')) {
        a.insertAdjacentHTML(
          'afterbegin',
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.4 2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.17 6.17l1.27-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
        );
      }
    });
  }

  function init() {
    initHamburger();
    initFAB();
    initNavScroll();
    initHscroll();
    enhanceContacts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
