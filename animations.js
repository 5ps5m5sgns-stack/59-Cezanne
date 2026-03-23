/* ============================================================
   59 CÉZANNE — animations.js
   Global animations, loader, nav, scroll, lightbox, counters
   ============================================================ */

'use strict';

/* ─── Loader ────────────────────────────────────────────────── */
(function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;

  const minDuration = 1200; // ms
  const start = Date.now();

  function hideLoader() {
    const elapsed = Date.now() - start;
    const delay = Math.max(0, minDuration - elapsed);
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.classList.remove('no-scroll');
      triggerHeroAnim();
    }, delay);
  }

  document.body.classList.add('no-scroll');

  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
  }
})();

/* ─── Hero animation trigger ────────────────────────────────── */
function triggerHeroAnim() {
  const hero = document.querySelector('.hero');
  if (hero) hero.classList.add('hero-loaded');
}

/* ─── Scroll Progress Bar ───────────────────────────────────── */
(function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  function updateProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + '%';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
})();

/* ─── Navbar ────────────────────────────────────────────────── */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const SCROLL_THRESHOLD = 60;

  function updateNav() {
    const scrolled = window.pageYOffset > SCROLL_THRESHOLD;
    if (scrolled) {
      navbar.classList.add('scrolled');
      navbar.classList.remove('transparent');
    } else {
      navbar.classList.remove('scrolled');
      navbar.classList.add('transparent');
    }
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
})();

/* ─── Mobile Menu ───────────────────────────────────────────── */
function toggleMobile() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobileMenu');
  if (!burger || !menu) return;

  const isOpen = menu.classList.contains('open');

  if (isOpen) {
    menu.classList.remove('open');
    burger.classList.remove('open');
    document.body.classList.remove('no-scroll');
  } else {
    menu.classList.add('open');
    burger.classList.add('open');
    document.body.classList.add('no-scroll');
  }
}

// Close menu on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const menu = document.getElementById('mobileMenu');
    const burger = document.getElementById('burger');
    if (menu && menu.classList.contains('open')) {
      menu.classList.remove('open');
      burger && burger.classList.remove('open');
      document.body.classList.remove('no-scroll');
    }
    closeLightbox();
  }
});

/* ─── Scroll Reveal (Intersection Observer) ─────────────────── */
(function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
})();

/* ─── Animated Counters ─────────────────────────────────────── */
(function initCounters() {
  const counters = document.querySelectorAll('.counter[data-target]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.getAttribute('data-target'), 10);
      if (isNaN(target)) return;

      animateCounter(el, target);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
})();

function animateCounter(el, target) {
  const duration = 1800;
  const start = performance.now();
  const startVal = 0;

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuart(progress);
    const current = Math.round(startVal + eased * (target - startVal));

    el.textContent = current.toLocaleString('fr-FR');

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = target.toLocaleString('fr-FR');
    }
  }

  requestAnimationFrame(tick);
}

/* ─── Parallax (light, CSS transform-based) ─────────────────── */
(function initParallax() {
  const images = document.querySelectorAll('[id^="parallax-img"]');
  if (!images.length) return;

  function updateParallax() {
    const scrollY = window.pageYOffset;

    images.forEach(img => {
      const parent = img.closest('section, .full-img-section');
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const viewH = window.innerHeight;

      if (rect.bottom < 0 || rect.top > viewH) return;

      const relScroll = (scrollY - (parent.offsetTop - viewH)) / (parent.offsetHeight + viewH);
      const offset = (relScroll - 0.5) * 80; // max ±40px

      img.style.transform = `translateY(${offset}px) scale(1.08)`;
    });
  }

  window.addEventListener('scroll', updateParallax, { passive: true });
  updateParallax();
})();

/* ─── Lightbox ──────────────────────────────────────────────── */
let lightboxImages = [];
let lightboxIndex = 0;

function openLightbox(el, idx) {
  // Walk up the DOM to find the tightest container that holds multiple [data-src] items.
  // We stop before reaching containers that are inactive tabs (to avoid mixing tab galleries).
  const GALLERY_SELECTORS = [
    '.logement-gallery',
    '.gallery-grid',
    '.solarium-grid',
    '.photo-row',
    '[id^="gallery-"]',
    '.plan-images',
    '.logement-tab-panel.active', // only active tab panels
    '.plan-tab-panel.active'
  ];

  let container = null;
  let node = el.parentElement;

  while (node && node !== document.body) {
    // Skip inactive tab panels — images there should not be navigable
    if (node.classList.contains('logement-tab-panel') && !node.classList.contains('active')) {
      break;
    }
    const hasSrcs = node.querySelectorAll(':scope > [data-src], :scope [data-src]');
    // Prefer specific gallery wrappers; accept any node with ≥2 data-src children
    const isGalleryWrapper = GALLERY_SELECTORS.some(sel => node.matches(sel));
    if (isGalleryWrapper || hasSrcs.length >= 2) {
      container = node;
      // Keep climbing only if we haven't reached a gallery wrapper yet
      if (isGalleryWrapper) break;
    }
    node = node.parentElement;
  }

  // Collect only direct [data-src] items from the resolved container
  let items = container ? container.querySelectorAll('[data-src]') : null;

  if (items && items.length > 0) {
    lightboxImages = Array.from(items).map(item => ({
      src: item.getAttribute('data-src') || item.querySelector('img')?.src || '',
      caption: item.getAttribute('data-caption') || item.querySelector('img')?.alt || ''
    }));
    lightboxIndex = Array.from(items).indexOf(el);
    if (lightboxIndex < 0) lightboxIndex = (typeof idx === 'number') ? idx : 0;
  } else {
    // Fallback: single image
    const src = el.getAttribute('data-src') || el.querySelector('img')?.src || '';
    const caption = el.getAttribute('data-caption') || el.querySelector('img')?.alt || '';
    lightboxImages = [{ src, caption }];
    lightboxIndex = 0;
  }

  showLightboxImage(lightboxIndex);
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.add('open');
  document.body.classList.add('no-scroll');
}

function showLightboxImage(index) {
  if (!lightboxImages.length) return;
  lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;

  const imgEl = document.getElementById('lightbox-img');
  const captionEl = document.getElementById('lightbox-caption');
  const counterEl = document.getElementById('lightbox-counter');

  if (imgEl) {
    imgEl.style.opacity = '0';
    imgEl.style.transform = 'scale(0.96)';
    imgEl.src = lightboxImages[lightboxIndex].src;
    imgEl.onload = () => {
      imgEl.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      imgEl.style.opacity = '1';
      imgEl.style.transform = 'scale(1)';
    };
    // Also handle broken images gracefully
    imgEl.onerror = () => {
      imgEl.style.opacity = '1';
      imgEl.style.transform = 'scale(1)';
    };
  }

  if (captionEl) {
    captionEl.textContent = lightboxImages[lightboxIndex].caption || '';
  }

  // Update counter (only show when multiple images)
  if (counterEl) {
    if (lightboxImages.length > 1) {
      counterEl.textContent = (lightboxIndex + 1) + ' / ' + lightboxImages.length;
      counterEl.style.display = 'block';
    } else {
      counterEl.style.display = 'none';
    }
  }

  // Hide nav buttons when only one image
  const prev = document.querySelector('.lightbox-prev');
  const next = document.querySelector('.lightbox-next');
  const showNav = lightboxImages.length > 1;
  if (prev) prev.style.display = showNav ? '' : 'none';
  if (next) next.style.display = showNav ? '' : 'none';
}

function lightboxNav(direction) {
  showLightboxImage(lightboxIndex + direction);
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
  document.body.classList.remove('no-scroll');
}

// Close on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  const lb = document.getElementById('lightbox');
  if (lb) {
    lb.addEventListener('click', (e) => {
      if (e.target === lb) closeLightbox();
    });
  }
});

// Keyboard navigation for lightbox
document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (!lb || !lb.classList.contains('open')) return;

  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
});

// Touch swipe for lightbox
(function initLightboxSwipe() {
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => {
    const lb = document.getElementById('lightbox');
    if (!lb || !lb.classList.contains('open')) return;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const lb = document.getElementById('lightbox');
    if (!lb || !lb.classList.contains('open')) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      lightboxNav(diff > 0 ? 1 : -1);
    }
  }, { passive: true });
})();

/* ─── FAQ ───────────────────────────────────────────────────── */
// toggleFaq is defined inline in contact.html for page-specific use
// but can also be called from here for other pages
if (typeof window.toggleFaq === 'undefined') {
  window.toggleFaq = function(el) {
    const item = el.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  };
}

/* ─── Smooth Scroll for anchor links ────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 80;
      const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - navH - 20;

      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    });
  });
});

/* ─── Active Nav Link ───────────────────────────────────────── */
(function setActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ─── Image lazy loading fallback ──────────────────────────── */
(function initLazyFallback() {
  if ('loading' in HTMLImageElement.prototype) return; // native support

  const images = document.querySelectorAll('img[loading="lazy"]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.getAttribute('data-src');
        if (src) img.src = src;
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });

  images.forEach(img => observer.observe(img));
})();

/* ─── Language switch (global) ──────────────────────────────── */
function setLang(lang) {
  document.querySelectorAll('[data-lang-' + lang + ']').forEach(el => {
    el.innerHTML = el.getAttribute('data-lang-' + lang);
  });
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.lang-btn[onclick*="' + lang + '"]').forEach(b => b.classList.add('active'));
  // Store preference for this session only
  try { sessionStorage.setItem('59cezanne-lang', lang); } catch(e) {}
}

// Restore saved language preference within the same session
(function restoreLang() {
  try {
    const saved = sessionStorage.getItem('59cezanne-lang');
    if (saved && saved !== 'fr') setLang(saved);
  } catch(e) {}
})();
