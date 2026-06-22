/**
 * KE Group Energy – Cookie Banner
 * GDPR / ePrivacy compliant (Italia)
 * Gestisce: consenso tecnico (sempre attivo), analytics, marketing
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'ke_cookie_consent';
  var banner, prefsPanel;

  /* ---- Legge/scrive il consenso ---- */
  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveConsent(analytics, marketing) {
    var consent = {
      v: 1,
      date: new Date().toISOString(),
      analytics: !!analytics,
      marketing: !!marketing
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch (e) {}
    applyConsent(consent);
  }

  /* ---- Applica il consenso (es. attiva GA se accettato) ---- */
  function applyConsent(consent) {
    // Esempio: se in futuro aggiungi Google Analytics con id G-XXXXXXXX,
    // decommentare e sostituire G-XXXXXXXX con il tuo ID:
    //
    // if (consent.analytics && typeof gtag === 'undefined') {
    //   var s = document.createElement('script');
    //   s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX';
    //   s.async = true;
    //   document.head.appendChild(s);
    //   window.dataLayer = window.dataLayer || [];
    //   window.gtag = function(){ window.dataLayer.push(arguments); };
    //   gtag('js', new Date());
    //   gtag('config', 'G-XXXXXXXX');
    // }

    // Evento custom per integrazioni future
    document.dispatchEvent(new CustomEvent('ke:consent', { detail: consent }));
  }

  /* ---- Mostra / nasconde il banner ---- */
  function showBanner() {
    if (!banner) return;
    banner.removeAttribute('hidden');
    // piccolo ritardo per animazione
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.remove('ke-cookie--hide');
      });
    });
  }

  function hideBanner() {
    if (!banner) return;
    banner.classList.add('ke-cookie--hide');
    banner.addEventListener('transitionend', function handler() {
      banner.setAttribute('hidden', '');
      banner.removeEventListener('transitionend', handler);
    }, { once: true });
  }

  /* ---- Costruisce il DOM del banner ---- */
  function buildBanner() {
    banner = document.createElement('div');
    banner.id = 'ke-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Impostazioni cookie');
    banner.setAttribute('hidden', '');
    banner.classList.add('ke-cookie--hide');

    banner.innerHTML =
      '<div class="ke-cookie__inner">' +
        '<div class="ke-cookie__text">' +
          '<strong>Utilizziamo i cookie 🍪</strong>' +
          'Questo sito usa cookie tecnici necessari al funzionamento e, previo tuo consenso, cookie analitici per migliorare la navigazione. ' +
          'Nessun dato viene venduto a terzi. ' +
          '<a href="privacy-cookie.html">Leggi l\'informativa completa</a>.' +
        '</div>' +

        '<!-- Pannello preferenze (nascosto di default) -->' +
        '<div class="ke-cookie__prefs" id="ke-cookie-prefs" aria-expanded="false">' +

          '<div class="ke-cookie__pref-row">' +
            '<div class="ke-cookie__pref-label">' +
              '<strong>Cookie tecnici</strong>' +
              '<span>Necessari per il corretto funzionamento del sito. Non richiedono consenso.</span>' +
            '</div>' +
            '<label class="ke-cookie__toggle" aria-label="Cookie tecnici (sempre attivi)">' +
              '<input type="checkbox" checked disabled>' +
              '<span class="ke-cookie__toggle-track"></span>' +
            '</label>' +
          '</div>' +

          '<div class="ke-cookie__pref-row">' +
            '<div class="ke-cookie__pref-label">' +
              '<strong>Cookie analitici</strong>' +
              '<span>Ci aiutano a capire come viene usato il sito (es. Google Analytics). Dati aggregati e anonimi.</span>' +
            '</div>' +
            '<label class="ke-cookie__toggle" aria-label="Cookie analitici">' +
              '<input type="checkbox" id="ke-pref-analytics">' +
              '<span class="ke-cookie__toggle-track"></span>' +
            '</label>' +
          '</div>' +

          '<div class="ke-cookie__pref-row">' +
            '<div class="ke-cookie__pref-label">' +
              '<strong>Cookie di marketing</strong>' +
              '<span>Utilizzati per mostrare annunci personalizzati e misurare le campagne pubblicitarie.</span>' +
            '</div>' +
            '<label class="ke-cookie__toggle" aria-label="Cookie di marketing">' +
              '<input type="checkbox" id="ke-pref-marketing">' +
              '<span class="ke-cookie__toggle-track"></span>' +
            '</label>' +
          '</div>' +

        '</div>' +
        '<!-- /preferenze -->' +

        '<div class="ke-cookie__actions">' +
          '<button class="ke-cookie__btn ke-cookie__btn--accept" id="ke-cookie-accept">Accetta tutti</button>' +
          '<button class="ke-cookie__btn ke-cookie__btn--reject" id="ke-cookie-reject">Solo necessari</button>' +
          '<button class="ke-cookie__btn ke-cookie__btn--settings" id="ke-cookie-settings">Personalizza</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(banner);
    prefsPanel = document.getElementById('ke-cookie-prefs');

    /* --- Event listeners --- */
    document.getElementById('ke-cookie-accept').addEventListener('click', function () {
      saveConsent(true, true);
      hideBanner();
    });

    document.getElementById('ke-cookie-reject').addEventListener('click', function () {
      saveConsent(false, false);
      hideBanner();
    });

    document.getElementById('ke-cookie-settings').addEventListener('click', function () {
      var isOpen = prefsPanel.classList.toggle('is-open');
      prefsPanel.setAttribute('aria-expanded', String(isOpen));
      this.textContent = isOpen ? 'Salva preferenze' : 'Personalizza';
      if (!isOpen) {
        // Salva con i valori dei toggle
        var analytics = document.getElementById('ke-pref-analytics').checked;
        var marketing = document.getElementById('ke-pref-marketing').checked;
        saveConsent(analytics, marketing);
        hideBanner();
      }
    });
  }

  /* ---- Init ---- */
  function init() {
    var existing = getConsent();

    if (existing) {
      // Consenso già dato: applica silenziosamente
      applyConsent(existing);
      return;
    }

    // Nessun consenso: costruisci e mostra il banner
    buildBanner();

    // Mostra dopo un breve delay (pagina caricata)
    var delay = document.readyState === 'complete' ? 800 : 1200;
    setTimeout(showBanner, delay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
