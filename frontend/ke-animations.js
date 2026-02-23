/* ke-animations.js — KE Energy Advanced Animations */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── PAGE LOADER ─── */
  function initLoader() {
    const loader = document.querySelector('.ke-page-loader');
    if (!loader) return;
    window.addEventListener('load', () => {
      setTimeout(() => loader.classList.add('ke-loaded'), 600);
    });
    // Fallback: remove after 2.5s regardless
    setTimeout(() => loader && loader.classList.add('ke-loaded'), 2500);
  }

  /* ─── SCROLL PROGRESS BAR ─── */
  function initScrollProgress() {
    const bar = document.querySelector('.ke-scroll-progress');
    if (!bar) return;
    window.addEventListener('scroll', () => {
      const s = document.documentElement.scrollTop;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (s / h) * 100 : 0) + '%';
    }, { passive: true });
  }

  /* ─── NAV SCROLL STATE ─── */
  function initNavScroll() {
    const nav = document.querySelector('.ke-nav');
    if (!nav) return;
    const toggle = () => {
      if (window.scrollY > 60) nav.classList.add('ke-nav--scrolled');
      else nav.classList.remove('ke-nav--scrolled');
    };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  /* ─── CUSTOM CURSOR ─── */
  function initCursor() {
    if (prefersReducedMotion) return;
    if ('ontouchstart' in window) return; // skip on touch

    const dot  = document.createElement('div');
    const ring = document.createElement('div');
    dot.className  = 'ke-cursor';
    ring.className = 'ke-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mx = 0, my = 0, rx = 0, ry = 0;
    let raf;

    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px';
      dot.style.top  = my + 'px';
    }, { passive: true });

    // Ring follows with lerp
    function lerp(a, b, t) { return a + (b - a) * t; }
    function tick() {
      rx = lerp(rx, mx, 0.14);
      ry = lerp(ry, my, 0.14);
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      raf = requestAnimationFrame(tick);
    }
    tick();

    // Scale on hoverable elements
    const hoverEls = 'a, button, .ke-btn, .ke-card, input, textarea';
    document.addEventListener('mouseover', e => {
      if (e.target.closest(hoverEls)) {
        dot.style.width  = '20px';
        dot.style.height = '20px';
        ring.style.width  = '52px';
        ring.style.height = '52px';
        ring.style.borderColor = 'rgba(74,222,128,0.7)';
      }
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest(hoverEls)) {
        dot.style.width  = '12px';
        dot.style.height = '12px';
        ring.style.width  = '36px';
        ring.style.height = '36px';
        ring.style.borderColor = 'rgba(74,222,128,0.45)';
      }
    });

    // Click burst
    document.addEventListener('click', e => {
      dot.style.transform  = 'translate(-50%,-50%) scale(2)';
      ring.style.transform = 'translate(-50%,-50%) scale(1.5)';
      ring.style.opacity   = '0.3';
      setTimeout(() => {
        dot.style.transform  = 'translate(-50%,-50%) scale(1)';
        ring.style.transform = 'translate(-50%,-50%) scale(1)';
        ring.style.opacity   = '1';
      }, 200);
    });
  }

  /* ─── NOISE OVERLAY ─── */
  function initNoise() {
    if (prefersReducedMotion) return;
    const noise = document.createElement('div');
    noise.className = 'ke-noise';
    document.body.appendChild(noise);
  }

  /* ─── SCROLL PROGRESS BAR (fixed top) ─── */
  function injectScrollBar() {
    const bar = document.createElement('div');
    bar.className = 'ke-scroll-progress';
    document.body.prepend(bar);
  }

  /* ─── PAGE LOADER INJECT ─── */
  function injectLoader() {
    const loader = document.createElement('div');
    loader.className = 'ke-page-loader';
    loader.innerHTML = `
      <div class="ke-loader-inner">
        <div class="ke-loader-logo">⚡ KE Group Energy</div>
        <div class="ke-loader-bar"></div>
      </div>`;
    document.body.prepend(loader);
  }

  /* ─── SCROLL HINT INJECT (hero only) ─── */
  function injectScrollHint() {
    const hero = document.querySelector('.ke-hero');
    if (!hero) return;
    const hint = document.createElement('div');
    hint.className = 'ke-scroll-hint';
    hint.innerHTML = `<span>Scorri</span><div class="ke-scroll-hint-arrow"></div>`;
    hero.appendChild(hint);
    // Hide on scroll
    const hide = () => { if (window.scrollY > 80) hint.style.opacity = '0'; else hint.style.opacity = '0.45'; };
    window.addEventListener('scroll', hide, { passive: true });
  }

  /* ─── PARTICLES (hero only) ─── */
  function initParticles() {
    if (prefersReducedMotion) return;
    const hero = document.querySelector('.ke-hero');
    if (!hero) return;
    const container = document.createElement('div');
    container.className = 'ke-particles';
    hero.appendChild(container);

    const count = 18;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'ke-particle';
      const size  = Math.random() * 4 + 1.5;
      const x     = Math.random() * 100;
      const dur   = Math.random() * 10 + 6;
      const delay = Math.random() * -12;
      const drift = (Math.random() - 0.5) * 120;
      p.style.cssText = `
        width:${size}px; height:${size}px;
        left:${x}%;
        bottom: -10px;
        --dur:${dur}s;
        --delay:${delay}s;
        --drift:${drift}px;
        opacity:0;
        animation-delay: ${delay}s;
      `;
      container.appendChild(p);
    }
  }

  /* ─── GLITCH TITLE ─── */
  function initGlitch() {
    if (prefersReducedMotion) return;
    const h1 = document.querySelector('.ke-hero h1');
    if (!h1) return;
    h1.setAttribute('data-text', h1.textContent);
    h1.classList.add('ke-glitch');
  }

  /* ─── INTERSECTION OBSERVER (scroll reveals) ─── */
  function initScrollObserver() {
    // h2 underline on reveal
    const headings = document.querySelectorAll('.ke-section h2, .ke-panel-inner h2');
    if ('IntersectionObserver' in window && headings.length) {
      const ho = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('ke-in-view');
          }
        });
      }, { threshold: 0.3 });
      headings.forEach(el => ho.observe(el));
    }

    // Generic fade-up for non-GSAP pages
    const revealEls = document.querySelectorAll('.ke-reveal-fade');
    if ('IntersectionObserver' in window && revealEls.length) {
      const ro = new IntersectionObserver(entries => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('ke-in-view'), i * 80);
            ro.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      revealEls.forEach(el => ro.observe(el));
    }

    // Footer
    const footer = document.querySelector('.ke-footer');
    if (footer && 'IntersectionObserver' in window) {
      const fo = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) footer.classList.add('ke-in-view');
      }, { threshold: 0.1 });
      fo.observe(footer);
    }
  }

  /* ─── BUTTON MOUSE GLOW ─── */
  function initButtonGlow() {
    document.querySelectorAll('.ke-btn').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width)  * 100 + '%';
        const y = ((e.clientY - r.top)  / r.height) * 100 + '%';
        btn.style.setProperty('--mx', x);
        btn.style.setProperty('--my', y);
      });
    });
  }

  /* ─── MAGNETIC BUTTONS ─── */
  function initMagnetic() {
    if (prefersReducedMotion) return;
    document.querySelectorAll('[data-magnetic], .ke-btn--accent').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r   = el.getBoundingClientRect();
        const cx  = r.left + r.width  / 2;
        const cy  = r.top  + r.height / 2;
        const dx  = (e.clientX - cx) * 0.25;
        const dy  = (e.clientY - cy) * 0.25;
        el.style.transform = `translate(${dx}px, ${dy}px) translateY(-2px) scale(1.02)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ─── NUMBER COUNTER ANIMATION ─── */
  function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;
    const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

    const animateCount = (el) => {
      const target = parseFloat(el.getAttribute('data-count'));
      const suffix = el.getAttribute('data-suffix') || '';
      const dur    = 1800;
      let   start  = null;

      const step = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const v = ease(p) * target;
        el.textContent = (Number.isInteger(target) ? Math.round(v) : v.toFixed(1)) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window) {
      const co = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            animateCount(e.target);
            co.unobserve(e.target);
          }
        });
      }, { threshold: 0.5 });
      counters.forEach(el => co.observe(el));
    }
  }

  /* ─── OUTLINE SHIMMER — add .ke-outline to bare text spans ─── */
  function initOutlineShimmer() {
    // Already handled by CSS; just ensure .ke-outline class is there
    document.querySelectorAll('.ke-outline').forEach(el => {
      el.style.willChange = 'background-position';
    });
  }

  /* ─── STAGGER CARD ANIMATION ─── */
  function initCardStagger() {
    if (prefersReducedMotion) return;
    const grids = document.querySelectorAll('.ke-grid');
    grids.forEach(grid => {
      const cards = grid.querySelectorAll('.ke-card');
      cards.forEach((card, i) => {
        card.style.transitionDelay = (i * 0.07) + 's';
      });
    });
  }

  /* ─── HERO VIDEO PARALLAX ─── */
  function initVideoParallax() {
    if (prefersReducedMotion) return;
    const video = document.querySelector('.ke-site-bg video');
    if (!video) return;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      video.style.transform = `translateY(${y * 0.25}px)`;
    }, { passive: true });
  }

  /* ─── BACKEND WARM-UP (sveglia Render su ogni pagina) ─── */
  function warmUpBackend() {
    const meta = document.querySelector('meta[name="ke-api-base"]');
    const base = meta ? meta.getAttribute('content').trim().replace(/\/$/, '') : '';
    if (!base) return;
    // Ping silenzioso — sveglia il server Render senza aspettare la risposta
    ['prodotti','incentivi'].forEach(kind => {
      const endpoint = kind === 'prodotti' ? '/api/public/prodotti' : '/api/public/incentivi';
      fetch(base + endpoint, { method: 'GET', priority: 'low' }).catch(() => {});
    });
  }


  /* ─── INIT ─── */
  function init() {
    warmUpBackend();
    injectLoader();
    injectScrollBar();
    initLoader();
    initScrollProgress();
    initNavScroll();
    initNoise();
    initCursor();
    initScrollHint();
    initParticles();
    initGlitch();
    initScrollObserver();
    initButtonGlow();
    initMagnetic();
    initCounters();
    initOutlineShimmer();
    initCardStagger();
    initVideoParallax();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
