(() => {
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduce) return;

  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const setNativeHScroll = () => {
    const native = window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;
    document.querySelectorAll('#prodotti-home .ke-hscroll, #ambiti .ke-hscroll').forEach(w => {
      if (native) w.classList.add('ke-hscroll--native');
      else w.classList.remove('ke-hscroll--native');
    });
  };
  setNativeHScroll();
  window.addEventListener('resize', setNativeHScroll);


  // Reveal
  gsap.utils.toArray(".ke-reveal").forEach((el, i) => {
    const isHeading = /^H[1-3]$/.test(el.tagName);
    const fromVars = {
      scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
      opacity: 0,
      duration: 0.95,
      ease: "power3.out"
    };

    // Headings + key copy slide in from sides; cards/blocks rise from below
    if (isHeading) {
      fromVars.x = (i % 2 === 0) ? -90 : 90;
    } else if (el.matches("p, .ke-btn, .ke-small")) {
      fromVars.x = (i % 2 === 0) ? 70 : -70;
    } else {
      fromVars.y = 50;
    }

    gsap.from(el, fromVars);
  });


  
  function mapDeadzoneProgress(p, dead = 0.14){
    // deadzone at start & end so first/last cards stay readable
    const d = Math.max(0, Math.min(0.3, dead));
    const span = 1 - 2*d;
    if (span <= 0) return 0;
    const t = (p - d) / span;
    return Math.max(0, Math.min(1, t));
  }

  
  function applyHScrollAmbiti(track, amount, p){
    // Ambiti: much longer pause at start/end
    const mp = mapDeadzoneProgress(p, 0.28); // 28% deadzone
    gsap.set(track, { x: -amount * mp });
  }

function applyHScroll(track, amount, p){
    const mp = mapDeadzoneProgress(p);
    gsap.set(track, { x: -amount * mp });
  }

  function refreshAfterImages(scope){
    const imgs = Array.from(scope.querySelectorAll('img'));
    let pending = imgs.filter(img => !img.complete);
    if (pending.length === 0) { ScrollTrigger.refresh(); return; }
    pending.forEach(img => img.addEventListener('load', () => ScrollTrigger.refresh(), { once:true }));
  }

  function initPinnedHScroll(sectionSel, applyFn, initKey){
    const section = document.querySelector(sectionSel);
    if (!section) return () => {};

    const key = initKey || ("kePinnedInit" + sectionSel.replace(/[^a-z0-9]/gi, ""));
    if (section.dataset && section.dataset[key] === "1") return () => {};
    if (section.dataset) section.dataset[key] = "1";

    const wrap = section.querySelector(".ke-hscroll");
    const track = section.querySelector(".ke-hscroll__track");
    if (!wrap || !track) return () => {};

    const getScrollAmount = () => Math.max(0, track.scrollWidth - wrap.clientWidth);
    if (getScrollAmount() <= 0) return () => {};

    // Pin the whole section so the wheel drives horizontal movement
    wrap.style.overflow = "hidden";
    track.style.willChange = "transform";
    gsap.set(track, { x: 0 });

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => "+=" + (getScrollAmount() + window.innerHeight),
      scrub: 1,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: self => {
        const amount = getScrollAmount();
        applyFn(track, amount, self.progress);
      },
      onRefresh: self => {
        const amount = getScrollAmount();
        applyFn(track, amount, self.progress);
      }
    });

    refreshAfterImages(section);

    return () => {
      try{ st && st.kill(); }catch(e){}
      if (section.dataset) delete section.dataset[key];
      gsap.set(track, { clearProps: "transform" });
    };
  }

  function initAmbiti(){
    return initPinnedHScroll("#ambiti", applyHScrollAmbiti, "kePinnedInitAmbiti");
  }

  function initProducts(){
    return initPinnedHScroll("#prodotti-home", applyHScroll, "kePinnedInitProdotti");
  }

  window.addEventListener("load", () => {
    const ok = ScrollTrigger.matchMedia({
      "(min-width: 1024px)": () => {
        const cleanAmbiti = initAmbiti();
        const cleanProducts = initProducts();
        window.addEventListener("load", () => ScrollTrigger.refresh(), { once:true });
        return () => { cleanAmbiti && cleanAmbiti(); cleanProducts && cleanProducts(); };
      }
    });

    // Hide fallback ONLY if pin is active (desktop)
    if (ok) document.documentElement.classList.add("js");
    ScrollTrigger.refresh();
  });
  window.addEventListener("resize", () => ScrollTrigger.refresh());
})();