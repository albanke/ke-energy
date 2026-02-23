(() => {
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduce) return;

  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  /* ── Ottimizzazioni globali GSAP per eliminare il lag ── */
  gsap.config({ force3D: true });
  ScrollTrigger.config({ limitCallbacks: true, syncInterval: 40 });

  const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;

  /* ── Native hscroll su mobile ── */
  const setNativeHScroll = () => {
    document.querySelectorAll('#prodotti-home .ke-hscroll, #ambiti .ke-hscroll').forEach(w => {
      if (isMobile()) w.classList.add('ke-hscroll--native');
      else w.classList.remove('ke-hscroll--native');
    });
  };
  setNativeHScroll();
  window.addEventListener('resize', setNativeHScroll);

  /* ── Reveal animations ── */
  gsap.utils.toArray(".ke-reveal").forEach((el, i) => {
    const isHeading = /^H[1-3]$/.test(el.tagName);
    const fromVars = {
      scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
      opacity: 0,
      duration: 0.75,
      ease: "power3.out"
    };
    if (isHeading)                        { fromVars.x = (i % 2 === 0) ? -60 : 60; }
    else if (el.matches("p, .ke-btn"))    { fromVars.y = 24; }
    else                                  { fromVars.y = 36; }
    gsap.from(el, fromVars);
  });

  /* ── Deadzone helper ── */
  function mapDeadzone(p, dead = 0.10) {
    const span = 1 - 2 * dead;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(1, (p - dead) / span));
  }

  /* ── Generic pinned horizontal scroll ── */
  function initPinnedHScroll(sectionSel, deadzone, initKey) {
    const section = document.querySelector(sectionSel);
    if (!section) return () => {};

    const key = initKey || ('kePinnedInit_' + sectionSel.replace(/\W/g, ''));
    if (section.dataset[key] === '1') return () => {};
    section.dataset[key] = '1';

    const wrap  = section.querySelector('.ke-hscroll');
    const track = section.querySelector('.ke-hscroll__track');
    if (!wrap || !track) return () => {};

    /* Pre-warm GPU layer */
    wrap.style.overflow        = 'hidden';
    track.style.willChange     = 'transform';
    track.style.transform      = 'translateX(0px) translateZ(0)';
    section.style.willChange   = 'transform';

    const getAmount = () => Math.max(0, track.scrollWidth - wrap.clientWidth);

    /* Use scrub:true (=requestAnimationFrame sync) — zero added latency */
    const st = ScrollTrigger.create({
      trigger       : section,
      start         : 'top top',
      end           : () => '+=' + (getAmount() + window.innerHeight * 0.6),
      scrub         : true,          // <— frame-perfect, no damping lag
      pin           : true,
      pinSpacing    : true,
      anticipatePin : 1,
      invalidateOnRefresh: true,
      fastScrollEnd : true,
      onUpdate(self) {
        const tx = -getAmount() * mapDeadzone(self.progress, deadzone);
        gsap.set(track, { x: tx, force3D: true });
      },
      onRefresh(self) {
        const tx = -getAmount() * mapDeadzone(self.progress, deadzone);
        gsap.set(track, { x: tx, force3D: true });
      }
    });

    /* Refresh once all images are loaded */
    const imgs = Array.from(section.querySelectorAll('img'));
    const pending = imgs.filter(img => !img.complete);
    if (pending.length === 0) {
      ScrollTrigger.refresh();
    } else {
      let loaded = 0;
      pending.forEach(img => img.addEventListener('load', () => {
        if (++loaded === pending.length) ScrollTrigger.refresh();
      }, { once: true }));
    }

    return () => {
      try { st.kill(); } catch(e) {}
      delete section.dataset[key];
      gsap.set(track, { clearProps: 'transform,willChange' });
    };
  }

  window.addEventListener('load', () => {
    ScrollTrigger.matchMedia({
      '(min-width: 1024px)': () => {
        const cleanAmbiti   = initPinnedHScroll('#ambiti',       0.22, 'kePinnedAmbiti');
        const cleanProducts = initPinnedHScroll('#prodotti-home', 0.10, 'kePinnedProdotti');
        document.documentElement.classList.add('js');
        return () => {
          cleanAmbiti && cleanAmbiti();
          cleanProducts && cleanProducts();
          document.documentElement.classList.remove('js');
        };
      }
    });

    /* Single refresh after all assets ready */
    ScrollTrigger.refresh();
  });

  /* Debounced resize refresh */
  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => ScrollTrigger.refresh(), 120);
  });
})();