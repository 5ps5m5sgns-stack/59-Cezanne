/* ============================================================
   59 CÉZANNE — cookie.js
   Consentement aux traceurs de mesure d'audience (Google Analytics 4, facultatif).

   ── CE QUE FAIT CE FICHIER ────────────────────────────────────────────────
   • Aucun traceur, aucun script ni aucune ressource tierce n'est chargé AVANT le choix du
     visiteur. Google Analytics 4 ne se charge QUE si (1) l'ID ci-dessous est un vrai ID de
     mesure GA4 ET (2) le visiteur a cliqué « Tout accepter » (ou l'a fait il y a moins de 6 mois).
   • Le placeholder « G-XXXXXXXXXX » ne déclenche JAMAIS de requête réseau.
   • Bandeau bilingue FR/EN (langue = <html lang>, suit le sélecteur FR/EN), accessible :
     role="dialog" non modal, aria-labelledby/aria-describedby, focus géré, boutons
     « Tout refuser » et « Tout accepter » de même poids visuel (CNIL : refuser aussi simple
     qu'accepter).
   • Choix mémorisé dans localStorage (clé '59cezanne-cookie-consent', try/catch), 6 mois
     maximum (182 jours), puis le choix est redemandé. Les anciennes valeurs de ce site
     ('accepted' / 'refused', sans date) sont considérées expirées.
   • window.openCookieSettings() : rouvre le choix (bouton « Gérer les cookies » du pied de
     page) ; « Tout refuser » retire le consentement : désactive GA4 et supprime ses cookies
     (_ga, _ga_*, _gid, _gat*, _gcl_*).
   • Événement document « 59c:consent » ({detail:{analytics:true|false}}) à chaque choix ;
     window.gtag n'existe QU'APRÈS consentement (contact.js teste typeof gtag === 'function').
   • Aucun autre traceur n'est ajouté. Styles du bandeau : style.css (section « Bandeau de
     consentement »), pas de <style> injecté (compatible CSP stricte).

   ── COMMENT BRANCHER GOOGLE ANALYTICS 4 ───────────────────────────────────
   1. analytics.google.com → Admin → Créer une propriété GA4 → Flux de données → Web →
      URL https://59-cezanne.com → copier l'« ID de mesure » (forme G-ABCDE12345).
   2. Le coller dans GA_ID ci-dessous (et nulle part ailleurs : pas de balise gtag.js dans
      les pages). Déployer. Le bandeau apparaît alors à la première visite.
   3. Dans GA4 : désactiver la collecte Google Signals et le partage de données avancés
      (Admin → Paramètres des données). Durée de conservation : 2 mois (minimum).
   4. En-têtes (_headers, Content-Security-Policy) : autoriser
        script-src  https://www.googletagmanager.com
        connect-src https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com
        img-src     https://*.google-analytics.com https://*.googletagmanager.com
   5. Compléter la section « Cookies » des mentions légales (finalité : mesure d'audience ;
      durée de vie des cookies _ga/_ga_* : 13 mois maximum ; durée du consentement : 6 mois ;
      tiers : Google LLC, transfert hors UE).
   6. Suivi de conversion (formulaire) : dans contact.js, APRÈS une réponse OK du serveur :
        if (typeof gtag === 'function') gtag('event', 'generate_lead', { form_id: 'contact' });
      (rien ne part si le visiteur a refusé : gtag n'existe pas).

   ── COMMENT BRANCHER SEARCH CONSOLE (sans cookie, sans consentement) ───────
   Search Console et Bing Webmaster Tools ne posent aucun traceur chez le visiteur : ils ne
   passent pas par ce fichier. Créer une propriété « Domaine » (enregistrement TXT dans le DNS
   Cloudflare du domaine 59-cezanne.com), puis soumettre https://59-cezanne.com/sitemap.xml.
   La balise <meta name="google-site-verification"> de l'accueil peut rester en complément.

   ── ALTERNATIVE SANS BANDEAU ───────────────────────────────────────────────
   Une mesure sans cookie (ex. Cloudflare Web Analytics, activable dans le projet Pages) ne
   passe pas par ce fichier : laisser GA_ID = placeholder. Vérifier l'éligibilité à
   l'exemption de consentement auprès de la CNIL avant de retirer tout bandeau.
   ============================================================ */

(function () {
  'use strict';

  if (window.__cookieJsLoaded) return;   // protège contre un double chargement
  window.__cookieJsLoaded = true;

  /* ═══ CONFIGURATION ═══════════════════════════════════════════════════════ */
  var GA_ID = 'G-XXXXXXXXXX';                    // ← ID de mesure GA4 (voir l'en-tête)
  var POLICY_URL = '/mentions-legales';          // politique de confidentialité
  var STORAGE_KEY = '59cezanne-cookie-consent';
  var CONSENT_MAX_DAYS = 182;                    // 6 mois maximum
  var CONSENT_VERSION = 1;
  // true  : tant qu'aucun vrai ID GA4 n'est configuré, il n'y a rien à consentir → pas de bandeau
  //         automatique (le bouton « Gérer les cookies » ouvre une fenêtre d'information).
  // false : bandeau affiché dès la première visite même sans outil de mesure.
  var BANNER_ONLY_IF_GA_CONFIGURED = true;
  /* ═════════════════════════════════════════════════════════════════════════ */

  var doc = document;
  var GA_CONFIGURED = /^G-[A-Z0-9]{6,14}$/.test(GA_ID) && !/^G-X+$/i.test(GA_ID);

  var TEXTS = {
    fr: {
      title: 'Vos choix concernant les cookies',
      desc: "Avec votre accord, nous mesurons l'audience du site (Google Analytics) pour l'améliorer. Sans votre accord, aucun traceur de mesure n'est déposé. Votre choix est conservé 6 mois ; vous pouvez le modifier à tout moment via « Gérer les cookies » en bas de page.",
      policy: 'Politique de confidentialité',
      refuse: 'Tout refuser',
      accept: 'Tout accepter',
      dismiss: 'Fermer sans modifier',
      close: 'Fermer',
      statusNone: 'Aucun choix enregistré pour le moment.',
      statusYes: 'Choix actuel : mesure d’audience acceptée.',
      statusNo: 'Choix actuel : mesure d’audience refusée.',
      infoTitle: 'Cookies et traceurs',
      infoDesc: "Ce site ne dépose actuellement aucun traceur de mesure d'audience ni de publicité. Si un outil de mesure devait être activé, il ne le serait qu'avec votre accord, que vous pourriez retirer à tout moment ici. Certains contenus intégrés de tiers (par exemple une carte) peuvent appliquer leurs propres règles : voir la politique de confidentialité.",
      savedYes: 'Préférences enregistrées : mesure d’audience acceptée.',
      savedNo: 'Préférences enregistrées : mesure d’audience refusée.'
    },
    en: {
      title: 'Your cookie choices',
      desc: 'With your consent, we measure site audience (Google Analytics) to improve the site. Without your consent, no measurement tracker is set. Your choice is kept for 6 months; you can change it at any time via “Cookie settings” at the bottom of the page.',
      policy: 'Privacy policy',
      refuse: 'Reject all',
      accept: 'Accept all',
      dismiss: 'Close without changes',
      close: 'Close',
      statusNone: 'No choice saved yet.',
      statusYes: 'Current choice: audience measurement accepted.',
      statusNo: 'Current choice: audience measurement rejected.',
      infoTitle: 'Cookies and trackers',
      infoDesc: 'This site currently sets no audience-measurement or advertising tracker. If a measurement tool were ever enabled, it would only be with your consent, which you could withdraw at any time here. Some embedded third-party content (for example a map) may apply its own rules: see the privacy policy.',
      savedYes: 'Preferences saved: audience measurement accepted.',
      savedNo: 'Preferences saved: audience measurement rejected.'
    }
  };

  function lang() {
    return String(doc.documentElement.getAttribute('lang') || 'fr').toLowerCase().indexOf('en') === 0 ? 'en' : 'fr';
  }
  function T() { return TEXTS[lang()]; }

  /* ─── Stockage du consentement (jamais d'exception non rattrapée) ─── */
  var memoryRecord = null;     // repli si localStorage est bloqué : valable pour la page en cours

  function readConsent() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    var rec = null;
    if (raw) {
      try { rec = JSON.parse(raw); } catch (e) { rec = null; }
    } else {
      rec = memoryRecord;
    }
    var maxAge = CONSENT_MAX_DAYS * 86400000;
    var valid = rec && typeof rec === 'object' && rec.v === CONSENT_VERSION &&
      typeof rec.analytics === 'boolean' && typeof rec.ts === 'number' &&
      rec.ts <= Date.now() + 60000 && (Date.now() - rec.ts) <= maxAge;
    if (!valid) {
      if (raw) { try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignoré */ } }  // périmé / ancien format
      return null;
    }
    return rec;
  }

  function writeConsent(analytics) {
    var rec = { v: CONSENT_VERSION, analytics: !!analytics, ts: Date.now() };
    memoryRecord = rec;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch (e) { /* stockage bloqué : repli mémoire */ }
    return rec;
  }

  /* ─── Google Analytics 4 : uniquement avec consentement ET ID valide ─── */
  var gaLoaded = false;

  function loadGA() {
    if (!GA_CONFIGURED) return;                      // le placeholder ne fait jamais de requête
    window['ga-disable-' + GA_ID] = false;
    if (gaLoaded) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      allow_google_signals: false,                   // pas de recoupement publicitaire
      allow_ad_personalization_signals: false
    });
    var s = doc.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    doc.head.appendChild(s);
  }

  function purgeAnalyticsCookies() {
    var names = (doc.cookie || '').split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return /^(_ga(_.*)?|_gid|_gat(_.*)?|_gcl_.*)$/.test(n); });
    if (!names.length) return;
    var host = window.location.hostname;
    var domains = [''];
    if (host.indexOf('.') > -1 && !/^\d+(\.\d+){3}$/.test(host)) {
      var parts = host.split('.');
      for (var i = 0; i < parts.length - 1; i++) domains.push('; domain=.' + parts.slice(i).join('.'));
    }
    names.forEach(function (name) {
      domains.forEach(function (d) {
        doc.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
  }

  function disableGA() {
    if (GA_CONFIGURED) window['ga-disable-' + GA_ID] = true;
    purgeAnalyticsCookies();
  }

  /* ─── Annonce vocale du choix (la fenêtre disparaît, on confirme) ─── */
  function announce(message) {
    var live = doc.getElementById('cookie-live');
    if (!live) {
      live = doc.createElement('div');
      live.id = 'cookie-live';
      live.className = 'visually-hidden';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      doc.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = message; }, 50);
  }

  /* ─── Fenêtre de choix ─── */
  var banner = null;
  var mode = null;            // 'auto' | 'settings' | 'info'
  var opener = null;          // élément à qui rendre le focus à la fermeture
  var els = {};

  function make(tag, className, attrs) {
    var el = doc.createElement(tag);
    if (className) el.className = className;
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function build() {
    banner = make('div', '', {
      id: 'cookie-banner',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'cookie-title',
      'aria-describedby': 'cookie-desc',
      tabindex: '-1'
    });
    var inner = make('div', 'cookie-inner');
    var text = make('div', 'cookie-text');
    els.title = make('p', 'cookie-title', { id: 'cookie-title' });
    els.desc = make('p', '', { id: 'cookie-desc' });
    els.descText = doc.createTextNode('');
    els.policy = make('a', '', { href: POLICY_URL });
    els.desc.appendChild(els.descText);
    els.desc.appendChild(doc.createTextNode(' '));
    els.desc.appendChild(els.policy);
    els.status = make('p', 'cookie-status');
    text.appendChild(els.title);
    text.appendChild(els.desc);
    text.appendChild(els.status);

    var btns = make('div', 'cookie-btns');
    els.refuse = make('button', 'cookie-btn cookie-btn-refuse', { type: 'button' });
    els.accept = make('button', 'cookie-btn cookie-btn-accept', { type: 'button' });
    els.dismiss = make('button', 'cookie-dismiss', { type: 'button' });
    btns.appendChild(els.refuse);
    btns.appendChild(els.accept);
    btns.appendChild(els.dismiss);

    inner.appendChild(text);
    inner.appendChild(btns);
    banner.appendChild(inner);

    els.refuse.addEventListener('click', function () { choose(false); });
    els.accept.addEventListener('click', function () { choose(true); });
    els.dismiss.addEventListener('click', function () { hide(true); });
    banner.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { e.stopPropagation(); hide(true); }
    });
  }

  function render() {
    if (!banner) return;
    var tx = T();
    var info = mode === 'info';
    els.title.textContent = info ? tx.infoTitle : tx.title;
    els.descText.nodeValue = info ? tx.infoDesc : tx.desc;
    els.policy.textContent = tx.policy;
    els.refuse.textContent = tx.refuse;
    els.accept.textContent = tx.accept;
    els.dismiss.textContent = info ? tx.close : tx.dismiss;

    els.refuse.hidden = info;
    els.accept.hidden = info;
    // « Fermer » seulement quand la fenêtre a été ouverte à la demande (ou en mode info)
    els.dismiss.hidden = mode === 'auto';

    var rec = readConsent();
    if (mode === 'settings') {
      els.status.hidden = false;
      els.status.textContent = rec ? (rec.analytics ? tx.statusYes : tx.statusNo) : tx.statusNone;
    } else {
      els.status.hidden = true;
      els.status.textContent = '';
    }
  }

  function show(newMode) {
    mode = newMode;
    if (!banner) build();
    render();
    if (!banner.parentNode) {
      // En tête du <body> : premier dans l'ordre de tabulation et de lecture, alors que le
      // bandeau est positionné en bas de l'écran par style.css.
      doc.body.insertBefore(banner, doc.body.firstChild);
    }
    banner.hidden = false;
    banner.focus({ preventScroll: true });
  }

  function hide(restoreFocus) {
    if (!banner || !banner.parentNode) return;
    banner.parentNode.removeChild(banner);
    var target = opener;
    opener = null;
    if (restoreFocus && target && doc.contains(target) && typeof target.focus === 'function') target.focus();
  }

  function choose(analytics) {
    var wasAccepted = !!(readConsent() || {}).analytics;
    writeConsent(analytics);
    if (analytics) {
      loadGA();
    } else if (wasAccepted || gaLoaded) {
      disableGA();                                   // retrait du consentement : GA coupé + cookies supprimés
    }
    hide(true);
    announce(analytics ? T().savedYes : T().savedNo);
    try {
      doc.dispatchEvent(new CustomEvent('59c:consent', { detail: { analytics: analytics } }));
    } catch (e) { /* CustomEvent indisponible : sans conséquence */ }
  }

  /* ─── API publique : bouton « Gérer les cookies » du pied de page ─── */
  function openCookieSettings() {
    var active = doc.activeElement;
    opener = (active && active !== doc.body) ? active : null;
    show(GA_CONFIGURED ? 'settings' : 'info');
  }
  window.openCookieSettings = openCookieSettings;

  /* ─── Initialisation ─── */
  function init() {
    var rec = readConsent();
    if (rec && rec.analytics) loadGA();
    if (!rec && (GA_CONFIGURED || !BANNER_ONLY_IF_GA_CONFIGURED)) show('auto');
  }

  // Bandeau et textes suivent la langue choisie dans l'en-tête
  doc.addEventListener('59c:langchange', render);

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
