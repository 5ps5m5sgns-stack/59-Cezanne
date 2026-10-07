/* ============================================================
   59 CÉZANNE — animations.js
   Barre de navigation, menu mobile, révélations au défilement, compteurs,
   parallaxe légère, lightbox, accordéons FAQ.

   - Compatible <script defer> (ou en bas de <body>) ; aucune dépendance.
   - Fonctions globales conservées pour les attributs onclick des pages :
     toggleMobile(), openLightbox(el), closeLightbox(), lightboxNav(dir),
     showLightboxImage(i), animateCounter(el, n), triggerHeroAnim(), toggleFaq(el).
   - SANS setLang() : la bascule FR/EN vit uniquement dans translations.js
     (événement « 59c:langchange » écouté ici pour les libellés ARIA).
   - Tolérant à l'absence de #loader, #lightbox, #burger, #scroll-progress… :
     aucune erreur console quelle que soit la page.
   - Respecte prefers-reduced-motion (pas de parallaxe, compteurs instantanés,
     révélations immédiates) ; le CSS neutralise en plus les transitions.
   ============================================================ */

(function () {
  'use strict';

  var doc = document;
  var win = window;

  /* ─── Utilitaires ─────────────────────────────────────────── */
  function byId(id) { return doc.getElementById(id); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  var reduceMQ = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(reduceMQ && reduceMQ.matches); }

  /* Langue de l'interface = <html lang> (tenu à jour par translations.js) */
  function lang() {
    return String(doc.documentElement.getAttribute('lang') || 'fr').toLowerCase().indexOf('en') === 0 ? 'en' : 'fr';
  }

  var I18N = {
    fr: {
      menuOpen: 'Ouvrir le menu', menuClose: 'Fermer le menu',
      lbLabel: 'Galerie photos agrandie', lbClose: 'Fermer', lbPrev: 'Image précédente', lbNext: 'Image suivante',
      enlarge: "Agrandir l'image", enlarged: 'Image agrandie'
    },
    en: {
      menuOpen: 'Open menu', menuClose: 'Close menu',
      lbLabel: 'Enlarged photo gallery', lbClose: 'Close', lbPrev: 'Previous image', lbNext: 'Next image',
      enlarge: 'Enlarge image', enlarged: 'Enlarged image'
    }
  };
  function t(key) { return I18N[lang()][key]; }

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function visibleFocusables(container) {
    return $$(FOCUSABLE, container).filter(function (el) {
      return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
  }

  /* Le défilement de la page est bloqué tant que le menu mobile OU la lightbox est ouvert */
  function syncScrollLock() {
    if (!doc.body) return;
    var menu = byId('mobileMenu');
    var lb = byId('lightbox');
    var lock = (menu && menu.classList.contains('open')) || (lb && lb.classList.contains('open'));
    doc.body.classList.toggle('no-scroll', !!lock);
  }

  /* ─── Loader (facultatif : les pages le suppriment) ─────────── */
  /* S'il existe, il ne bloque JAMAIS plus de 400 ms et n'attend pas `load`. */
  function triggerHeroAnim() {
    var hero = doc.querySelector('.hero');
    if (hero) hero.classList.add('hero-loaded');   // compat : l'animation du hero est en CSS pur
  }

  (function initLoader() {
    var loader = byId('loader');
    var done = false;
    function hide() {
      if (done) return;
      done = true;
      if (loader) loader.classList.add('hidden');
      triggerHeroAnim();
    }
    if (!loader) {
      onReady(hide);
      return;
    }
    var failsafe = setTimeout(hide, 400);
    onReady(function () { clearTimeout(failsafe); hide(); });
  })();

  /* ─── Barre de progression, navbar, parallaxe : un seul écouteur de scroll ─── */
  var progressBar = null;
  var navbar = null;
  var navSolid = false;
  var parallaxImgs = [];
  var NAV_SCROLL_THRESHOLD = 60;

  function updateProgress() {
    if (!progressBar) return;
    var scrollTop = win.pageYOffset || doc.documentElement.scrollTop;
    var docHeight = doc.documentElement.scrollHeight - doc.documentElement.clientHeight;
    progressBar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + '%';
  }

  function updateNav() {
    if (!navbar || navSolid) return;
    var scrolled = win.pageYOffset > NAV_SCROLL_THRESHOLD;
    navbar.classList.toggle('scrolled', scrolled);
    navbar.classList.toggle('transparent', !scrolled);
  }

  function updateParallax() {
    if (!parallaxImgs.length) return;
    var scrollY = win.pageYOffset;
    var viewH = win.innerHeight;
    parallaxImgs.forEach(function (img) {
      var parent = img.closest('section, .full-img-section');
      if (!parent) return;
      var rect = parent.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewH) return;
      var relScroll = (scrollY - (parent.offsetTop - viewH)) / (parent.offsetHeight + viewH);
      var offset = (relScroll - 0.5) * 80; // max ±40 px
      img.style.transform = 'translateY(' + offset + 'px) scale(1.08)';
    });
  }

  var scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    win.requestAnimationFrame(function () {
      scrollTicking = false;
      updateNav();
      updateProgress();
      updateParallax();
    });
  }

  onReady(function () {
    progressBar = byId('scroll-progress');
    navbar = byId('navbar');
    // Barre déjà « scrolled » dès le départ (pages sans hero, blog) : elle reste pleine.
    navSolid = !!navbar && (navbar.hasAttribute('data-solid') ||
      (navbar.classList.contains('scrolled') && !navbar.classList.contains('transparent')));
    parallaxImgs = reducedMotion() ? [] : $$('[id^="parallax-img"]');

    if (progressBar || (navbar && !navSolid) || parallaxImgs.length) {
      win.addEventListener('scroll', onScroll, { passive: true });
      win.addEventListener('resize', onScroll, { passive: true });
    }
    updateNav();
    updateProgress();
    updateParallax();
  });

  /* ─── Menu mobile ───────────────────────────────────────────── */
  var INERT_WHEN_MENU_OPEN = 'main, body > footer, .site-footer, .floating-cta, .skip-link';

  function isMenuOpen() {
    var menu = byId('mobileMenu');
    return !!(menu && menu.classList.contains('open'));
  }

  function applyMenuState(open, returnFocus) {
    var burger = byId('burger');
    var menu = byId('mobileMenu');
    if (!burger || !menu) return;

    menu.classList.toggle('open', open);
    burger.classList.toggle('open', open);                         // compat CSS ancien balisage
    burger.setAttribute('aria-expanded', open ? 'true' : 'false'); // source de vérité (CSS : croix)
    burger.setAttribute('aria-label', t(open ? 'menuClose' : 'menuOpen'));

    // Pendant que le menu plein écran est ouvert, le reste de la page est inerte
    // (ni focus clavier, ni lecteur d'écran) : pas de tabulation « derrière » le menu.
    $$(INERT_WHEN_MENU_OPEN).forEach(function (el) {
      if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
    syncScrollLock();

    if (!open && returnFocus) burger.focus();
  }

  /* toggleMobile()      : bascule (appelé par le burger ET par les liens du menu via onclick)
     toggleMobile(true|false) : force l'état. Un clic sur un lien du menu ferme toujours. */
  function toggleMobile(force) {
    var open;
    var fromLink = false;
    if (typeof force === 'boolean') {
      open = force;
    } else {
      var ev = win.event;
      fromLink = !!(ev && ev.target && ev.target.closest && ev.target.closest('#mobileMenu a'));
      open = fromLink ? false : !isMenuOpen();
    }
    applyMenuState(open, !open && !fromLink);   // focus rendu au burger sauf navigation par lien
  }

  onReady(function () {
    var menu = byId('mobileMenu');
    var burger = byId('burger');
    if (!menu || !burger) return;

    // Valeurs ARIA initiales cohérentes, même si le balisage de la page est ancien
    if (burger.tagName !== 'BUTTON') {
      burger.setAttribute('role', 'button');
      burger.setAttribute('tabindex', '0');
      burger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMobile(); }
      });
    }
    burger.setAttribute('aria-controls', 'mobileMenu');
    burger.setAttribute('aria-expanded', isMenuOpen() ? 'true' : 'false');
    burger.setAttribute('aria-label', t(isMenuOpen() ? 'menuClose' : 'menuOpen'));

    // Clic sur un lien du menu : fermer (même si l'attribut onclick a été retiré de la page)
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a') && isMenuOpen()) applyMenuState(false, false);
    });

    // Passage en grand écran avec le menu ouvert : on le referme
    if (win.matchMedia) {
      var mq = win.matchMedia('(min-width: 769px)');
      var onChange = function (e) { if (e.matches && isMenuOpen()) applyMenuState(false, false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  });

  /* ─── Révélation au défilement (IntersectionObserver) ──────── */
  onReady(function () {
    var elements = $$('.reveal, .reveal-left, .reveal-right');
    if (!elements.length) return;

    if (reducedMotion() || !('IntersectionObserver' in win)) {
      elements.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(function (el) { observer.observe(el); });
  });

  /* ─── Compteurs animés ─────────────────────────────────────── */
  /* data-target="418" ; data-no-group (années, pas de séparateur de milliers) */
  function formatCounter(el, value) {
    if (el.hasAttribute('data-no-group')) return String(value);
    return value.toLocaleString(lang() === 'en' ? 'en-GB' : 'fr-FR');
  }

  function animateCounter(el, target) {
    if (reducedMotion()) {
      el.textContent = formatCounter(el, target);
      return;
    }
    var duration = 1800;
    var start = performance.now();

    function easeOutQuart(p) { return 1 - Math.pow(1 - p, 4); }

    function tick(now) {
      var progress = Math.min((now - start) / duration, 1);
      el.textContent = formatCounter(el, Math.round(easeOutQuart(progress) * target));
      if (progress < 1) win.requestAnimationFrame(tick);
      else el.textContent = formatCounter(el, target);
    }
    win.requestAnimationFrame(tick);
  }

  onReady(function () {
    var counters = $$('.counter[data-target]');
    if (!counters.length) return;

    if (reducedMotion() || !('IntersectionObserver' in win)) {
      counters.forEach(function (c) {
        var n = parseInt(c.getAttribute('data-target'), 10);
        if (!isNaN(n)) c.textContent = formatCounter(c, n);
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var n = parseInt(entry.target.getAttribute('data-target'), 10);
        if (!isNaN(n)) animateCounter(entry.target, n);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { observer.observe(c); });
  });

  /* ─── Lightbox ──────────────────────────────────────────────── */
  var lightboxImages = [];
  var lightboxIndex = 0;
  var lightboxTrigger = null;

  function lightboxEl() { return byId('lightbox'); }
  function isLightboxOpen() {
    var lb = lightboxEl();
    return !!(lb && lb.classList.contains('open'));
  }

  /* Rôle de dialogue modal, nom accessible, boutons étiquetés (idempotent ; relancé au changement de langue) */
  function setupLightboxA11y() {
    var lb = lightboxEl();
    if (!lb) return;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', t('lbLabel'));
    lb.setAttribute('tabindex', '-1');

    var close = lb.querySelector('.lightbox-close');
    var prev = lb.querySelector('.lightbox-prev');
    var next = lb.querySelector('.lightbox-next');
    if (close) { close.setAttribute('aria-label', t('lbClose')); close.setAttribute('type', 'button'); }
    if (prev)  { prev.setAttribute('aria-label', t('lbPrev'));   prev.setAttribute('type', 'button'); }
    if (next)  { next.setAttribute('aria-label', t('lbNext'));   next.setAttribute('type', 'button'); }

    // Le texte des boutons (✕ ‹ ›) est décoratif : le nom vient de aria-label
    [close, prev, next].forEach(function (b) { if (b) b.setAttribute('data-glyph', '1'); });

    var caption = byId('lightbox-caption');
    var counter = byId('lightbox-counter');
    if (caption) caption.setAttribute('aria-live', 'polite');
    if (counter) counter.setAttribute('aria-hidden', 'true');
  }

  /* Éléments de galerie activables au clavier : tout élément [data-src] qui ouvre la lightbox
     et qui n'est ni <a> ni <button> devient role="button" tabindex="0" avec un nom accessible. */
  function enhanceLightboxTriggers() {
    $$('[data-src]').forEach(function (item) {
      var oc = item.getAttribute('onclick') || '';
      if (!/openLightbox/.test(oc) && !item.hasAttribute('data-lightbox')) return;
      var tag = item.tagName;
      if (tag !== 'A' && tag !== 'BUTTON') {
        if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
        if (!item.hasAttribute('tabindex')) item.setAttribute('tabindex', '0');
        if (!item.__lbKey) {
          item.__lbKey = true;
          item.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && e.target === item) {
              e.preventDefault();
              item.click();
            }
          });
        }
      }
      // Nom accessible généré seulement si la page n'en fournit pas (et régénéré au changement de langue)
      if (!item.hasAttribute('aria-label') || item.hasAttribute('data-auto-label')) {
        var img = item.querySelector('img');
        var cap = item.getAttribute('data-caption') || (img && img.getAttribute('alt')) || '';
        item.setAttribute('aria-label', t('enlarge') + (cap ? ' : ' + cap : ''));
        item.setAttribute('data-auto-label', '1');
      }
    });
  }

  function openLightbox(el, idx) {
    // Remonte le DOM jusqu'au plus petit conteneur de galerie (≥ 2 éléments [data-src]).
    // On s'arrête avant les onglets inactifs pour ne pas mélanger les galeries.
    var GALLERY_SELECTORS = [
      '.logement-gallery',
      '.gallery-grid',
      '.solarium-grid',
      '.photo-row',
      '[id^="gallery-"]',
      '.plan-images',
      '.logement-tab-panel.active',
      '.plan-tab-panel.active'
    ];

    var container = null;
    var node = el.parentElement;

    while (node && node !== doc.body) {
      if (node.classList.contains('logement-tab-panel') && !node.classList.contains('active')) break;
      var hasSrcs = node.querySelectorAll('[data-src]');
      var isGalleryWrapper = GALLERY_SELECTORS.some(function (sel) { return node.matches(sel); });
      if (isGalleryWrapper || hasSrcs.length >= 2) {
        container = node;
        if (isGalleryWrapper) break;
      }
      node = node.parentElement;
    }

    var items = container ? container.querySelectorAll('[data-src]') : null;
    function srcOf(item) {
      var im = item.querySelector('img');
      return item.getAttribute('data-src') || (im && im.src) || '';
    }
    function captionOf(item) {
      var im = item.querySelector('img');
      return item.getAttribute('data-caption') || (im && im.alt) || '';
    }

    if (items && items.length > 0) {
      var list = Array.prototype.slice.call(items);
      lightboxImages = list.map(function (item) { return { src: srcOf(item), caption: captionOf(item) }; });
      lightboxIndex = list.indexOf(el);
      if (lightboxIndex < 0) lightboxIndex = (typeof idx === 'number') ? idx : 0;
    } else {
      lightboxImages = [{ src: srcOf(el), caption: captionOf(el) }];
      lightboxIndex = 0;
    }

    var active = doc.activeElement;
    lightboxTrigger = (active && active !== doc.body && active !== doc.documentElement) ? active : el;

    var lb = lightboxEl();
    if (!lb) return;
    setupLightboxA11y();
    showLightboxImage(lightboxIndex);
    lb.classList.add('open');
    syncScrollLock();

    // Focus dans la boîte de dialogue (bouton Fermer), sinon sur le dialogue lui-même.
    // Réessaie brièvement : tant que la transition de visibilité n'a pas démarré, focus() peut échouer.
    var closeBtn = lb.querySelector('.lightbox-close') || lb;
    var tries = 0;
    (function focusDialog() {
      closeBtn.focus();
      if (!lb.contains(doc.activeElement) && tries++ < 8 && lb.classList.contains('open')) setTimeout(focusDialog, 40);
    })();
  }

  function showLightboxImage(index) {
    if (!lightboxImages.length) return;
    lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;

    var imgEl = byId('lightbox-img');
    var captionEl = byId('lightbox-caption');
    var counterEl = byId('lightbox-counter');
    var current = lightboxImages[lightboxIndex];

    if (imgEl) {
      imgEl.style.opacity = '0';
      imgEl.style.transform = 'scale(0.96)';
      imgEl.onload = function () {
        imgEl.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        imgEl.style.opacity = '1';
        imgEl.style.transform = 'scale(1)';
      };
      imgEl.onerror = function () {
        imgEl.style.opacity = '1';
        imgEl.style.transform = 'scale(1)';
      };
      imgEl.alt = current.caption || t('enlarged');   // alt à jour pour chaque image affichée
      imgEl.src = current.src;
    }

    if (captionEl) captionEl.textContent = '';   /* pas de légende visible (demande du client) ; current.caption sert d'alt */

    if (counterEl) {
      if (lightboxImages.length > 1) {
        counterEl.textContent = (lightboxIndex + 1) + ' / ' + lightboxImages.length;
        counterEl.style.display = 'block';
      } else {
        counterEl.style.display = 'none';
      }
    }

    var prev = doc.querySelector('.lightbox-prev');
    var next = doc.querySelector('.lightbox-next');
    var showNav = lightboxImages.length > 1;
    if (prev) prev.style.display = showNav ? '' : 'none';
    if (next) next.style.display = showNav ? '' : 'none';
  }

  function lightboxNav(direction) {
    showLightboxImage(lightboxIndex + direction);
  }

  function closeLightbox() {
    var lb = lightboxEl();
    if (!lb) return;
    var wasOpen = lb.classList.contains('open');
    lb.classList.remove('open');
    syncScrollLock();
    // Le focus retourne à l'élément qui a ouvert la lightbox
    if (wasOpen && lightboxTrigger && doc.contains(lightboxTrigger) && typeof lightboxTrigger.focus === 'function') {
      lightboxTrigger.focus();
    }
    lightboxTrigger = null;
  }

  onReady(function () {
    var lb = lightboxEl();
    setupLightboxA11y();
    enhanceLightboxTriggers();
    if (lb) {
      // Clic sur le fond (hors image et boutons) : fermer
      lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    }
  });

  // Balayage tactile
  (function initLightboxSwipe() {
    var touchStartX = 0;
    doc.addEventListener('touchstart', function (e) {
      if (!isLightboxOpen()) return;
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    doc.addEventListener('touchend', function (e) {
      if (!isLightboxOpen()) return;
      var diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) lightboxNav(diff > 0 ? 1 : -1);
    }, { passive: true });
  })();

  /* ─── Clavier global : Échap, flèches, piège de focus de la lightbox ─── */
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (isLightboxOpen()) { closeLightbox(); return; }
      if (isMenuOpen()) applyMenuState(false, true);
      return;
    }

    if (!isLightboxOpen()) return;

    if (e.key === 'ArrowLeft')  { e.preventDefault(); lightboxNav(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); lightboxNav(1);  return; }

    if (e.key === 'Tab') {
      var lb = lightboxEl();
      var focusables = visibleFocusables(lb);
      if (!focusables.length) { e.preventDefault(); lb.focus(); return; }
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var activeEl = doc.activeElement;
      if (!lb.contains(activeEl)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (activeEl === first || activeEl === lb)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ─── FAQ (accordéons .faq-item) ───────────────────────────── */
  /* Les pages récentes utilisent <details>/<summary> (natif). Ce bloc ne sert qu'aux accordéons
     historiques .faq-item / .faq-question (div ou button) : aria-expanded, aria-controls,
     Entrée / Espace, état toujours synchronisé avec la classe .open. */
  function syncFaqAria() {
    $$('.faq-item').forEach(function (item) {
      var q = item.querySelector('.faq-question');
      if (!q) return;
      q.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    });
  }

  if (typeof win.toggleFaq === 'undefined') {
    win.toggleFaq = function (el) {
      var item = el.parentElement;
      var isOpen = item.classList.contains('open');
      $$('.faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!isOpen) item.classList.add('open');
      syncFaqAria();
    };
  }

  onReady(function () {
    var uid = 0;
    $$('.faq-item').forEach(function (item) {
      var q = item.querySelector('.faq-question');
      var a = item.querySelector('.faq-answer');
      if (!q) return;
      if (q.tagName !== 'BUTTON') {
        q.setAttribute('role', 'button');
        if (!q.hasAttribute('tabindex')) q.setAttribute('tabindex', '0');
      } else if (!q.hasAttribute('type')) {
        q.setAttribute('type', 'button');
      }
      if (a) {
        if (!a.id) a.id = 'faq-answer-' + (++uid);
        q.setAttribute('aria-controls', a.id);
      }
    });
    syncFaqAria();

    // Entrée / Espace sur les questions qui ne sont pas des <button>
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var q = e.target && e.target.closest ? e.target.closest('.faq-question') : null;
      if (q && q === e.target && q.tagName !== 'BUTTON') {
        e.preventDefault();
        q.click();
      }
    });

    // Quel que soit le gestionnaire de clic de la page, on resynchronise aria-expanded ensuite
    doc.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.faq-question')) {
        setTimeout(syncFaqAria, 0);
      }
    });
  });

  /* ─── Lien actif du menu : repli uniquement ────────────────────
     Les pages posent désormais class="active" aria-current="page" en dur. Ce repli ne s'applique
     QUE si aucun lien du menu n'est déjà marqué. Comparaison robuste aux URLs sans extension :
     /logements, /logements.html, /logements/ et index.html / « / » sont équivalents. */
  onReady(function () {
    var links = $$('.nav-links a, .nav-mobile a');
    if (!links.length) return;
    if (links.some(function (a) { return a.getAttribute('aria-current') === 'page'; })) return;

    function norm(path) {
      return String(path || '/')
        .replace(/\/index(\.html)?$/, '/')
        .replace(/\.html$/, '')
        .replace(/\/+$/, '') || '/';
    }
    var here = norm(win.location.pathname);
    links.forEach(function (a) {
      var url;
      try { url = new URL(a.getAttribute('href'), win.location.href); } catch (e) { return; }
      if (url.origin !== win.location.origin) return;
      if (norm(url.pathname) === here) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  });

  /* ─── Changement de langue : libellés ARIA (burger, lightbox, vignettes) ─── */
  function refreshA11yLabels() {
    var burger = byId('burger');
    if (burger) burger.setAttribute('aria-label', t(isMenuOpen() ? 'menuClose' : 'menuOpen'));
    setupLightboxA11y();
    enhanceLightboxTriggers();
  }
  doc.addEventListener('59c:langchange', refreshA11yLabels);

  /* ─── API globale (attributs onclick des pages) ─────────────── */
  win.toggleMobile = toggleMobile;
  win.openLightbox = openLightbox;
  win.closeLightbox = closeLightbox;
  win.lightboxNav = lightboxNav;
  win.showLightboxImage = showLightboxImage;
  win.animateCounter = animateCounter;
  win.triggerHeroAnim = triggerHeroAnim;
})();
