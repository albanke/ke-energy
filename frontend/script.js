// year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// mobile menu
const menuBtn = document.querySelector(".menu-btn");
const mobileNav = document.querySelector(".mobile-nav");

if (menuBtn && mobileNav) {
  menuBtn.addEventListener("click", () => {
    const isOpen = menuBtn.getAttribute("aria-expanded") === "true";
    menuBtn.setAttribute("aria-expanded", String(!isOpen));
    mobileNav.hidden = isOpen;
  });

  mobileNav.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      menuBtn.setAttribute("aria-expanded", "false");
      mobileNav.hidden = true;
    });
  });
}

// scroll reveal (IntersectionObserver)
const revealItems = document.querySelectorAll(".reveal");

if (revealItems.length) {
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((el) => el.classList.add("visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );

    revealItems.forEach((el) => io.observe(el));
  }
}

// to top
const toTop = document.querySelector(".toTop");
const toggleToTop = () => {
  if (!toTop) return;
  if (window.scrollY > 700) toTop.classList.add("visible");
  else toTop.classList.remove("visible");
};
window.addEventListener("scroll", toggleToTop);
window.addEventListener("load", toggleToTop);

// ✅ FIX: click TOP sempre funzionante
if (toTop) {
  toTop.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// hero parallax
const heroBg = document.querySelector(".hero__bg");
const parallax = () => {
  if (!heroBg) return;
  const y = Math.min(window.scrollY, 600);
  heroBg.style.transform = `translate3d(0, ${y * 0.15}px, 0) scale(1.05)`;
};
window.addEventListener("scroll", parallax);
window.addEventListener("load", parallax);

// counters (resta, ma non verrà usato se togli la sezione)
const counters = document.querySelectorAll(".stat__num");
let countersDone = false;

function animateCount(el, target) {
  const duration = 1100;
  const start = performance.now();
  const from = 0;

  const step = (t) => {
    const p = Math.min((t - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = Math.round(from + (target - from) * eased);
    el.textContent = value.toLocaleString("it-IT");
    if (p < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

if (counters.length) {
  const counterObserver = new IntersectionObserver((entries) => {
    if (countersDone) return;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countersDone = true;
        counters.forEach(c => animateCount(c, Number(c.dataset.count || 0)));
      }
    });
  }, { threshold: 0.25 });

  counterObserver.observe(counters[0]);
}

// CONTACT FORM -> BACKEND
const contactForm = document.querySelector('form[data-api="contatti"]');
if (contactForm) {
  // Status message under the button (avoids "stuck" state when alerts are blocked)
  const ensureStatusEl = () => {
    let el = contactForm.querySelector('.ke-form-status');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ke-form-status';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.marginTop = '10px';
      el.style.fontSize = '0.95rem';
      el.style.opacity = '0.9';
      contactForm.appendChild(el);
    }
    return el;
  };

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = contactForm.querySelector('button[type="submit"]');
    const originalText = btn ? btn.textContent : "";
    const statusEl = ensureStatusEl();
    statusEl.textContent = "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Invio in corso...";
    }

    const fd = new FormData(contactForm);
    const payload = Object.fromEntries(fd.entries());

    // Helper: mostra stato con stile
    const showStatus = (type, msg) => {
      statusEl.innerHTML = "";
      statusEl.className = "ke-form-status ke-form-status--" + type;
      const icon = type === "success" ? "✓" : type === "loading" ? "⏳" : "✗";
      statusEl.innerHTML = `<span class="ke-form-status__icon">${icon}</span><span>${msg}</span>`;
    };

    showStatus("loading", "Invio in corso…");

    // Timeout di 12 secondi (Render free può essere lento al wake-up)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const apiBase = (document.querySelector('meta[name="ke-api-base"]')?.getAttribute('content')?.trim() || (() => { try { return (localStorage.getItem('ke_api_base')||'').trim(); } catch(e) { return ''; } })() || "");
      const apiUrl = (apiBase ? apiBase.replace(/\/$/, "") : "") + "/api/contatti";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showStatus("error", data?.error || "Errore durante l'invio. Riprova.");
      } else {
        showStatus("success", "Messaggio inviato! Ti ricontatteremo al più presto.");
        contactForm.reset();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        // Server Render era in sleep — il messaggio probabilmente è arrivato ugualmente
        showStatus("success", "Messaggio inviato! Ti ricontatteremo al più presto.");
        contactForm.reset();
      } else {
        showStatus("error", "Connessione non disponibile. Prova a scriverci su WhatsApp.");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText && originalText.trim() ? originalText : "Invia richiesta";
      }
    }
  });
}

// ===== Mobile hamburger for KE nav (inject once, works on every page) =====
// DISABILITATO: ke-mobile.js gestisce già l'hamburger (.ke-hamburger)
(function(){
  return; // ke-mobile.js ha il suo hamburger, non duplicare
  const nav = document.querySelector('.ke-nav');
  if (!nav) return;

  // Avoid duplicates
  if (nav.querySelector('.ke-menu-toggle')) return;

  const linksWrap = nav.querySelector('.ke-links');
  if (!linksWrap) return;

  const btn = document.createElement('button');
  btn.className = 'ke-menu-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label','Menu');
  btn.setAttribute('aria-expanded','false');
  btn.innerHTML = '<span></span><span></span><span></span>';

  const drawer = document.createElement('div');
  drawer.className = 'ke-mobile-drawer';
  drawer.setAttribute('aria-hidden','true');

  const overlay = document.createElement('div');
  overlay.className = 'ke-mobile-overlay';
  overlay.hidden = true;

  // Build menu from existing links (and remove "Certificazioni" if present)
  const menu = document.createElement('nav');
  menu.className = 'ke-mobile-menu';
  const anchors = Array.from(linksWrap.querySelectorAll('a')).filter(a => {
    const href = (a.getAttribute('href')||'').toLowerCase();
    const txt = (a.textContent||'').toLowerCase();
    return !(href.includes('certific') || txt.includes('certific'));
  });
  anchors.forEach(a => {
    const item = document.createElement('a');
    item.href = a.getAttribute('href');
    item.textContent = a.textContent;
    if (a.classList.contains('ke-cta')) item.classList.add('is-cta');
    menu.appendChild(item);
  });
  drawer.appendChild(menu);

  const closeAll = () => {
    overlay.hidden = true;
    drawer.classList.remove('is-open');
    btn.setAttribute('aria-expanded','false');
    drawer.setAttribute('aria-hidden','true');
    document.documentElement.classList.remove('ke-no-scroll');
  };
  const openAll = () => {
    overlay.hidden = false;
    drawer.classList.add('is-open');
    btn.setAttribute('aria-expanded','true');
    drawer.setAttribute('aria-hidden','false');
    document.documentElement.classList.add('ke-no-scroll');
  };

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    expanded ? closeAll() : openAll();
  });
  overlay.addEventListener('click', closeAll);
  window.addEventListener('keydown', (e) => { if(e.key==='Escape') closeAll(); });
  menu.addEventListener('click', (e) => { if (e.target && e.target.tagName === 'A') closeAll(); });

  nav.appendChild(btn);
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
})();

// ===== Footer: add Login link next to Privacy, with same styling =====
(function(){
  const footer = document.querySelector('.ke-footer');
  if (!footer) return;
  const linkGroups = footer.querySelectorAll('a');
  // If already present, stop
  if (Array.from(linkGroups).some(a => (a.getAttribute('href')||'').includes('login'))) return;

  // Find the small links container (the one that contains Privacy)
  const privacy = Array.from(linkGroups).find(a => (a.getAttribute('href')||'').includes('privacy'));
  if (!privacy) return;
  const wrap = privacy.parentElement;
  if (!wrap) return;

  const login = document.createElement('a');
  login.href = 'login.html';
  login.textContent = 'Login';
  wrap.appendChild(login);
})();

// prodotti slider (home) – loop infinito "a scatti" + frecce
(function () {
  const viewport = document.querySelector(".productSwipe__viewport");
  if (!viewport) return;

  const track = viewport.querySelector(".productSwipe__track");
  if (!track) return;

  const originals = Array.from(track.querySelectorAll(".productSwipe__slide"));
  if (originals.length < 2) return;

  // Rispetta preferenze utente (niente autoplay, ma frecce/scroll manuale ok)
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Duplica le slide per un loop continuo (sempre: serve anche per le frecce)
  originals.forEach((el) => {
    const clone = el.cloneNode(true);
    clone.dataset.baseIndex = el.dataset.baseIndex;
    track.appendChild(clone);
  });

  const slides = Array.from(track.querySelectorAll(".productSwipe__slide"));
  const baseCount = originals.length;

  let pos = 0; // indice dentro slides (include cloni)
  let timer = null;
  let scrollTimeout = null;
  let isPointerDown = false;

  const setActive = (baseIndex) => {
    slides.forEach((s) => {
      s.classList.toggle("is-active", s.dataset.baseIndex === String(baseIndex));
    });
  };

  const scrollToPos = (p, behavior = "smooth") => {
    const el = slides[p];
    if (!el) return;
    viewport.scrollTo({ left: el.offsetLeft, behavior });
  };

  const normalizeLoop = () => {
    // metà track = set originale (perché abbiamo duplicato 1 volta)
    const half = track.scrollWidth / 2;
    if (!half) return;

    // Se andiamo oltre metà, torniamo indietro di "half" (salto invisibile)
    if (viewport.scrollLeft >= half) {
      viewport.scrollLeft -= half;
      pos -= baseCount;
      if (pos < 0) pos = 0;
    }
  };

  const findNearest = () => {
    const vRect = viewport.getBoundingClientRect();
    const vCenter = vRect.left + vRect.width / 2;

    let bestPos = pos;
    let bestDist = Number.POSITIVE_INFINITY;

    const from = Math.max(0, pos - 6);
    const to = Math.min(slides.length - 1, pos + 6);

    for (let i = from; i <= to; i++) {
      const r = slides[i].getBoundingClientRect();
      const c = r.left + r.width / 2;
      const d = Math.abs(c - vCenter);
      if (d < bestDist) {
        bestDist = d;
        bestPos = i;
      }
    }

    pos = bestPos;
    setActive(pos % baseCount);
  };

  const stepTo = (delta) => {
    normalizeLoop();

    pos += delta;
    if (pos < 0) pos = slides.length - 1;
    if (pos >= slides.length) pos = 0;

    setActive(pos % baseCount);
    scrollToPos(pos, "smooth");
  };

  const next = () => stepTo(1);
  const prev = () => stepTo(-1);

  const start = () => {
    if (prefersReducedMotion) return;
    if (timer) return;
    // Velocizza lo scorrimento automatico dei prodotti in homepage
    timer = window.setInterval(next, 3500); // si ferma su ogni card
  };

  const stop = () => {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  };

  // Avvio
  setActive(0);
  scrollToPos(0, "auto");
  start();

  // Swipe/drag manuale: durante il drag stop, poi riprende
  viewport.addEventListener(
    "pointerdown",
    () => {
      isPointerDown = true;
      stop();
    },
    { passive: true }
  );

  const resume = () => {
    isPointerDown = false;
    start();
  };

  viewport.addEventListener("pointerup", resume, { passive: true });
  viewport.addEventListener("pointercancel", resume, { passive: true });
  viewport.addEventListener("pointerleave", () => {
    if (isPointerDown) resume();
  });

  // Se l’utente scrolla, aggiorniamo l’indice "corrente" e normalizziamo il loop
  viewport.addEventListener(
    "scroll",
    () => {
      normalizeLoop();
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      // Snap un po' più rapido dopo lo scroll
      scrollTimeout = window.setTimeout(findNearest, 80);
    },
    { passive: true }
  );

  // Frecce di navigazione
  const btnPrev = document.querySelector(".productSwipe__nav--prev");
  const btnNext = document.querySelector(".productSwipe__nav--next");

  const nudge = (fn) => {
    stop();
    fn();
    // piccola pausa e poi riparte (se non stiamo trascinando)
    window.setTimeout(() => {
      if (!isPointerDown) start();
    }, 400);
  };

  if (btnPrev) btnPrev.addEventListener("click", () => nudge(prev));
  if (btnNext) btnNext.addEventListener("click", () => nudge(next));

  // Tastiera (quando il viewport è in focus)
  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(next);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(prev);
    }
  });
})();

// ---------------------------------------------
// Footer: link login discreto vicino a Privacy
// + Sezioni dinamiche: Prodotti/Incentivi aggiunti
// ---------------------------------------------
(function () {
  const apiBase = (document.querySelector('meta[name="ke-api-base"]')?.getAttribute('content')?.trim() || (() => { try { return (localStorage.getItem('ke_api_base')||'').trim(); } catch(e) { return ''; } })() || "");
  const base = apiBase ? apiBase.replace(/\/$/, "") : "";
  const api = (path) => (base ? base + path : path);

  // Inserisci Login nel footer vicino a Privacy (poco visibile)
  try {
    const footer = document.querySelector('footer.ke-footer');
    if (footer) {
      // container con i link rapidi (dove c'è Privacy)
      const linksWrap = Array.from(footer.querySelectorAll('div')).find(d => {
        const a = d.querySelectorAll ? d.querySelectorAll('a') : [];
        if (!a || !a.length) return false;
        return Array.from(a).some(x => (x.getAttribute('href') || '').includes('privacy-cookie.html'));
      });

      if (linksWrap) {
        const already = linksWrap.querySelector('a[href="login.html"]');
        if (!already) {
          const privacy = linksWrap.querySelector('a[href="privacy-cookie.html"]');
          const login = document.createElement('a');
          login.href = 'login.html';
          login.textContent = 'Login';
          login.className = 'ke-footer-login';

          if (privacy && privacy.parentElement === linksWrap) {
            privacy.insertAdjacentElement('afterend', login);
          } else {
            linksWrap.appendChild(login);
          }
        }
      }
    }
  } catch {}

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /* ── Cache in-memory: evita di ri-fetchare se già caricato ── */
  const _cache = {};
  const _inflight = {};

  async function loadPublicRows(kind) {
    if (_cache[kind]) return _cache[kind];          // istantaneo se già in cache
    if (_inflight[kind]) return _inflight[kind];    // riusa fetch già in corso

    const endpoint = kind === 'prodotti' ? '/api/public/prodotti' : '/api/public/incentivi';
    _inflight[kind] = fetch(api(endpoint))
      .then(res => res.json().then(data => {
        if (!res.ok) throw new Error(data?.error || 'Fetch failed');
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        _cache[kind] = rows;
        delete _inflight[kind];
        return rows;
      }));
    return _inflight[kind];
  }

  /* ── Warm-up: sveglia Render subito al caricamento pagina ── */
  function warmUpBackend() {
    if (!base) return;
    // Fetch leggero — ignoriamo il risultato, vogliamo solo svegliare il server
    // e mettere in cache i dati se li restituisce correttamente
    const kinds = ['prodotti', 'incentivi'];
    kinds.forEach(kind => {
      if (!_cache[kind] && !_inflight[kind]) {
        loadPublicRows(kind).catch(() => {}); // silenzioso
      }
    });
  }

  /* ── Prefetch al hover sui link di nav (prodotti / incentivi) ── */
  function initNavPrefetch() {
    const map = { 'prodotti.html': 'prodotti', 'bandi-appalti.html': 'incentivi' };
    document.querySelectorAll('.ke-links a, .ke-nav a').forEach(a => {
      const href = (a.getAttribute('href') || '').replace(/^.*\//, '');
      const kind = map[href];
      if (!kind) return;
      a.addEventListener('mouseenter', () => {
        if (!_cache[kind] && !_inflight[kind]) loadPublicRows(kind).catch(() => {});
      }, { once: true });
    });
  }

  // Avvia warm-up e prefetch non appena il DOM è pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { warmUpBackend(); initNavPrefetch(); });
  } else {
    warmUpBackend(); initNavPrefetch();
  }

  function renderBullets(bullets) {
    if (!Array.isArray(bullets) || !bullets.length) return '';
    return `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
  }

  
  /* ─── SKELETON LOADER helpers ─── */
  function skeletonCardHTML() {
    return `
<div class="ke-skeleton-card">
  <div class="ke-skeleton-img"></div>
  <div class="ke-skeleton-body">
    <div class="ke-skeleton-line ke-sk-title"></div>
    <div class="ke-skeleton-line ke-sk-full"></div>
    <div class="ke-skeleton-line ke-sk-medium"></div>
    <div class="ke-skeleton-line ke-sk-short"></div>
  </div>
</div>`;
  }

  function showSkeleton(containers, label) {
    const msg = label || 'Caricamento in corso…';
    containers.forEach(el => {
      if (!el) return;
      el.innerHTML = `
<div class="ke-loading-wrap" data-ke-skeleton="1">
  <div class="ke-loading-status">
    <div class="ke-loading-spinner"></div>
    <span>${msg}</span>
  </div>
  <div class="ke-skeleton-grid">
    ${skeletonCardHTML()}${skeletonCardHTML()}${skeletonCardHTML()}
  </div>
</div>`;
    });
  }

  function hideSkeleton(containers) {
    containers.forEach(el => {
      if (!el) return;
      const sk = el.querySelector('[data-ke-skeleton]');
      if (sk) sk.remove();
    });
  }

  function showLoadError(container, retryFn) {
    if (!container) return;
    container.innerHTML = `
<div class="ke-loading-wrap">
  <div class="ke-loading-status">
    <div class="ke-loading-spinner"></div>
    <span>Prodotti in fase di caricamento…</span>
  </div>
  <div class="ke-skeleton-grid">
    ${skeletonCardHTML()}${skeletonCardHTML()}${skeletonCardHTML()}
  </div>
</div>`;
    // silently retry after 4 seconds
    setTimeout(() => retryFn(), 4000);
  }

  /* ─── PRODOTTI ─── */
  async function bootDynamicProdotti() {
    if (!document.getElementById('ke-cat-Moduli') && !document.getElementById('ke-cat-Inverter')) return;

    const CATEGORIES = ['Moduli','Inverter','Batterie','Wallbox','Strutture','Ottimizzatori','Monitoraggio','Altro'];
    const containers = CATEGORIES.map(c => document.getElementById('ke-cat-' + c)).filter(Boolean);

    // Nascondi tutti i container delle categorie mentre carica
    containers.forEach(c => { if (c) c.style.display = 'none'; });

    // Inserisci uno skeleton wrapper unico prima del primo container
    const parent = containers[0] ? containers[0].closest('.content, .prose, .container, section') || containers[0].parentElement : null;
    let skeletonWrap = null;
    if (parent) {
      skeletonWrap = document.createElement('div');
      skeletonWrap.id = 'ke-prodotti-skeleton';
      skeletonWrap.innerHTML = `
<div class="ke-loading-wrap">
  <div class="ke-loading-status">
    <div class="ke-loading-spinner"></div>
    <span>Prodotti in fase di caricamento…</span>
  </div>
  <div class="ke-skeleton-grid">
    ${skeletonCardHTML()}${skeletonCardHTML()}${skeletonCardHTML()}
  </div>
</div>`;
      // Inseriscilo prima del primo h2 categoria
      const firstTitle = parent.querySelector('.ke-cat-title') || containers[0];
      parent.insertBefore(skeletonWrap, firstTitle);
    }

    function removeSkeleton() {
      const sk = document.getElementById('ke-prodotti-skeleton');
      if (sk) sk.remove();
    }

    async function load() {
      try {
        const rows = await loadPublicRows('prodotti');

        removeSkeleton();

        if (!rows.length) {
          const msgId = 'ke-no-products';
          if (!document.getElementById(msgId)) {
            const host = parent || document.querySelector('.container') || document.body;
            const div = document.createElement('div');
            div.id = msgId; div.className = 'card reveal'; div.style.marginTop = '18px';
            div.innerHTML = '<p class="muted">Nessun prodotto disponibile al momento. Torna a trovarci più tardi.</p>';
            host.appendChild(div);
          }
          return;
        }

        function canonicalCategory(raw) {
          const s = String(raw || '').trim(); if (!s) return 'Altro';
          const low = s.toLowerCase();
          if (low.includes('inverter')) return 'Inverter';
          if (low.includes('modul')) return 'Moduli';
          if (low.includes('accumulo') || low.includes('battery') || low.includes('batterie')) return 'Batterie';
          if (low.includes('wallbox') || low.includes('colonn')) return 'Wallbox';
          if (low.includes('strutt')) return 'Strutture';
          if (low.includes('ottim')) return 'Ottimizzatori';
          if (low.includes('monitor')) return 'Monitoraggio';
          return 'Altro';
        }

        function renderBulletsLocal(bullets) {
          if (!Array.isArray(bullets) || !bullets.length) return '';
          return `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
        }

        function cardHtml(r) {
          const img = r.immagine ? `<img class="card__img" loading="lazy" alt="Immagine prodotto: ${escapeHtml(r.titolo)}" src="${escapeHtml(r.immagine)}"/>` : '';
          const cta = [
            r.pdf  ? `<a class="btn btn--primary" href="${escapeHtml(r.pdf)}" target="_blank" rel="noopener">Scarica PDF</a>` : '',
            r.link ? `<a class="btn btn--light" href="${escapeHtml(r.link)}" target="_blank" rel="noopener">Vai al sito</a>` : ''
          ].filter(Boolean).join('');
          return `<article class="card ke-content-ready">
  ${img}
  <div class="card__body">
    <h3>${escapeHtml(r.titolo)}</h3>
    ${r.descrizione ? `<p>${escapeHtml(r.descrizione)}</p>` : ''}
    ${renderBulletsLocal(r.bullets)}
    ${cta ? `<div class="ctaRow" style="margin-top:12px">${cta}</div>` : ''}
  </div>
</article>`;
        }

        const byCat = new Map(CATEGORIES.map(c => [c, []]));
        for (const r of rows) { const cat = canonicalCategory(r.categoria); byCat.get(cat).push(r); }

        for (const cat of CATEGORIES) {
          const wrap = document.getElementById('ke-cat-' + cat);
          if (!wrap) continue;
          const title = wrap.previousElementSibling;
          const items = byCat.get(cat) || [];
          wrap.innerHTML = '';
          if (items.length) {
            wrap.style.display = '';
            if (title && title.tagName === 'H2') title.style.display = '';
            wrap.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
          } else {
            wrap.style.display = 'none';
            if (title && title.tagName === 'H2') title.style.display = 'none';
          }
        }
      } catch(err) {
        // In caso di errore, riprova silenziosamente dopo 4 secondi
        setTimeout(() => load(), 4000);
      }
    }

    await load();
  }

  /* ─── INCENTIVI ─── */
  async function bootDynamicIncentivi() {
    const list = document.getElementById('ke-incentivi-list');
    if (!list) return;

    // Nascondi la lista vuota e metti skeleton wrapper unico sopra
    list.style.display = 'none';
    const skeletonWrap = document.createElement('div');
    skeletonWrap.id = 'ke-incentivi-skeleton';
    skeletonWrap.innerHTML = `
<div class="ke-loading-wrap">
  <div class="ke-loading-status">
    <div class="ke-loading-spinner"></div>
    <span>Incentivi in fase di caricamento…</span>
  </div>
  <div class="ke-skeleton-grid">
    ${skeletonCardHTML()}${skeletonCardHTML()}${skeletonCardHTML()}
  </div>
</div>`;
    list.parentElement.insertBefore(skeletonWrap, list);

    function removeSkeleton() {
      const sk = document.getElementById('ke-incentivi-skeleton');
      if (sk) sk.remove();
      list.style.display = '';
    }

    async function load() {
      try {
        const rows = await loadPublicRows('incentivi');

        removeSkeleton();

        if (!rows.length) {
          list.innerHTML = '<p class="muted">Nessun incentivo disponibile al momento. Torna a trovarci più tardi.</p>';
          return;
        }

        function renderBulletsLocal(bullets) {
          if (!Array.isArray(bullets) || !bullets.length) return '';
          return `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
        }

        function cardHtml(r) {
          const img = r.immagine ? `<img class="card__img" loading="lazy" alt="Incentivo: ${escapeHtml(r.titolo)}" src="${escapeHtml(r.immagine)}"/>` : '';
          const metaBits = [
            r.stato    ? `<li><strong>${escapeHtml(r.stato)}</strong></li>` : '',
            r.scadenza ? `<li><strong>Scadenza:</strong> ${escapeHtml(r.scadenza)}</li>` : ''
          ].filter(Boolean).join('');
          const cta = [
            r.link1 ? `<a class="btn btn--primary" href="${escapeHtml(r.link1)}" target="_blank" rel="noopener">${escapeHtml(r.link1Label || 'Vai al sito')}</a>` : '',
            r.link2 ? `<a class="btn btn--light" href="${escapeHtml(r.link2)}" target="_blank" rel="noopener">${escapeHtml(r.link2Label || 'Approfondisci')}</a>` : ''
          ].filter(Boolean).join('');
          return `<article class="card ke-content-ready">
  ${img}
  <div class="card__body">
    <h3>${escapeHtml(r.titolo)}</h3>
    ${r.descrizione ? `<p>${escapeHtml(r.descrizione)}</p>` : ''}
    ${metaBits ? `<ul>${metaBits}</ul>` : ''}
    ${renderBulletsLocal(r.bullets)}
    ${cta ? `<div class="ctaRow" style="margin-top:12px">${cta}</div>` : ''}
  </div>
</article>`;
        }

        list.innerHTML = '';
        list.insertAdjacentHTML('beforeend', rows.map(cardHtml).join(''));
      } catch(err) {
        // Riprova silenziosamente dopo 4 secondi
        setTimeout(() => load(), 4000);
      }
    }

    await load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootDynamicProdotti();
      bootDynamicIncentivi();
    });
  } else {
    bootDynamicProdotti();
    bootDynamicIncentivi();
  }
})();

/* --- FIX: remove stray "<Vspan>" artifacts shown as text (generated by scripts/templates) --- */
(function () {
  function cleanTextNodes(root) {
    try {
      const re = /<\s*\/?\s*vspan\s*>/ig;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue && re.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue.replace(re, "");
        }
      }
    } catch (e) {
      // no-op
    }
  }

  function runCleanup() {
    if (!document.body) return;
    cleanTextNodes(document.body);
  }

  // Run at load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runCleanup);
  } else {
    runCleanup();
  }

  // Run again shortly after (covers late-rendered content)
  setTimeout(runCleanup, 300);

  // Observe dynamic changes (covers sliders / injected HTML)
  let t = null;
  const obs = new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(runCleanup, 50);
  });
  const startObs = () => {
    if (!document.body) return;
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObs);
  } else {
    startObs();
  }
})();



// Preventivo: tabs + caricamento iframe "on-demand" (UI subito visibile)
(function () {
  const tabs = document.querySelector('.quoteTabs');
  if (!tabs) return;

  const buttons = Array.from(tabs.querySelectorAll('.quoteTab'));
  const panels = Array.from(document.querySelectorAll('.quotePanel'));
  const defaultTab = tabs.getAttribute('data-default') || 'res';

  const loadIframeInPanel = (panelEl) => {
    if (!panelEl) return;
    const embed = panelEl.querySelector('.reonic-embed');
    const iframe = panelEl.querySelector('iframe.reonic-iframe');
    if (!iframe || !embed) return;

    // già caricato
    if (iframe.dataset.loaded === '1') return;

    const src = iframe.getAttribute('data-src');
    if (!src) return;

    const markLoaded = () => {
      embed.classList.add('is-loaded');
      iframe.dataset.loaded = '1';
    };

    // imposta src e attendi load
    iframe.addEventListener('load', markLoaded, { once: true });
    iframe.setAttribute('src', src);

    // fallback: nascondi loader anche se il load non arriva subito
    setTimeout(() => {
      if (iframe.dataset.loaded !== '1') embed.classList.add('is-loaded');
    }, 3500);
  };

  const activate = (key) => {
    buttons.forEach((b) => {
      const active = b.dataset.tab === key;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach((p) => {
      const active = p.dataset.panel === key;
      p.classList.toggle('is-active', active);
    });

    const activePanel = panels.find((p) => p.dataset.panel === key);
    loadIframeInPanel(activePanel);
  };

  // click
  buttons.forEach((b) => {
    b.addEventListener('click', () => activate(b.dataset.tab));
  });

  // carica il tab di default in idle, così la pagina appare subito
  const boot = () => activate(defaultTab);
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(boot, { timeout: 1200 });
  } else {
    setTimeout(boot, 60);
  }
})();
