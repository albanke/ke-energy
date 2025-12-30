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

// scroll reveal
const revealItems = document.querySelectorAll(".reveal");
const revealOnScroll = () => {
  const trigger = window.innerHeight * 0.86;
  revealItems.forEach(el => {
    const top = el.getBoundingClientRect().top;
    if (top < trigger) el.classList.add("visible");
  });
};
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);

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
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = contactForm.querySelector('button[type="submit"]');
    const originalText = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Invio in corso...";
    }

    const fd = new FormData(contactForm);
    const payload = Object.fromEntries(fd.entries());

    try {
      const res = await fetch("/api/contatti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || "Errore durante l'invio. Riprova.";
        alert(msg);
      } else {
        alert("Messaggio inviato correttamente. Ti ricontatteremo al più presto.");
        contactForm.reset();
      }
    } catch {
      alert("Connessione non disponibile. Riprova tra poco.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });
}
