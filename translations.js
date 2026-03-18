/* ============================================================
   59 CÉZANNE — translations.js
   Bilingual FR / EN support
   ============================================================ */

const TRANS = {

  /* ── Shared nav & footer ─────────────────────────────────── */
  shared: [
    { sel: 'a[href="presentation.html"]',  fr: 'Présentation',    en: 'Presentation'   },
    { sel: 'a[href="logements.html"]',     fr: 'Logements',       en: 'Apartments'     },
    { sel: 'a[href="exterieurs.html"]',    fr: 'Espaces Communs', en: 'Common Areas'   },
    { sel: 'a[href="localisation.html"]',  fr: 'Localisation',    en: 'Location'       },
    { sel: 'a[href="promoteur.html"]',     fr: 'Le Promoteur',    en: 'The Developer'  },
    { sel: 'a[href="contact.html"]',       fr: 'Contact',         en: 'Contact'        },
    { sel: 'a[href="index.html"]',         fr: 'Accueil',         en: 'Home'           },
  ],

  /* ── index.html ─────────────────────────────────────────── */
  'index.html': [
    { sel: '.hero-eyebrow',   fr: 'Résidence Exclusive · Aix-en-Provence', en: 'Exclusive Residence · Aix-en-Provence' },
    { sel: '.hero-title',     fr: 'L\'harmonie parfaite entre<br><em>prestige, nature et confort</em>', en: 'The perfect harmony of<br><em>prestige, nature & comfort</em>' },
    { sel: '.hero-subtitle',  fr: '8 appartements d\'exception avec vue imprenable sur la Sainte-Victoire, au cœur d\'Aix-en-Provence.', en: '8 exceptional apartments with breathtaking views of the Sainte-Victoire, in the heart of Aix-en-Provence.' },
    { sel: '.hero-cta .btn-primary span', fr: 'Découvrir la résidence', en: 'Discover the residence' },
    { sel: '.hero-cta .btn-outline span', fr: 'Nous contacter', en: 'Contact us' },
    { sel: '.prestige-ribbon', fr: 'Piscine chauffée · Jardins privatifs · Double parking · Vue Sainte-Victoire garantie', en: 'Heated pool · Private gardens · Double parking · Guaranteed Sainte-Victoire view' },
  ],

  /* ── presentation.html ──────────────────────────────────── */
  'presentation.html': [
    { sel: '.hero-eyebrow',  fr: 'La Résidence',    en: 'The Residence'   },
    { sel: '.hero-title',    fr: '59 Cézanne — <em>Une adresse d\'exception</em>', en: '59 Cézanne — <em>An exceptional address</em>' },
    { sel: '.hero-subtitle', fr: 'Résidence exclusive de 8 appartements avec vue imprenable sur la Sainte-Victoire', en: 'Exclusive 8-apartment residence with breathtaking views of the Sainte-Victoire' },
    { sel: '.section-title', fr: 'Une résidence <em>confidentielle</em><br>au cœur de Provence', en: 'An <em>exclusive</em> residence<br>at the heart of Provence', idx: 0 },
    { sel: '.section-title', fr: 'Dans les pas<br>de <em>Paul Cézanne</em>', en: 'In the footsteps<br>of <em>Paul Cézanne</em>', idx: 1 },
    { sel: '.section-title', fr: 'Vues <em>extérieures</em>', en: '<em>Exterior</em> views', idx: 2 },
    { sel: '.section-title', fr: '<em>Aix-en-Provence</em>,<br>une ville de prestige', en: '<em>Aix-en-Provence</em>,<br>a city of prestige', idx: 3 },
    { sel: '.section-title', fr: 'Le charme <em>provençal</em><br>à chaque instant', en: 'The <em>Provençal</em> charm<br>at every moment', idx: 4 },
    { sel: '.section-title', fr: 'Votre horizon,<br>une <em>œuvre d\'art</em>', en: 'Your horizon,<br>a <em>work of art</em>', idx: 5 },
  ],

  /* ── logements.html ─────────────────────────────────────── */
  'logements.html': [
    { sel: '.hero-eyebrow',  fr: 'Nos appartements',    en: 'Our apartments'   },
    { sel: '.hero-title',    fr: '3 typologies, <em>8 appartements</em><br>d\'exception', en: '3 typologies, <em>8 exceptional</em><br>apartments' },
    { sel: '.hero-subtitle', fr: 'Chaque appartement est unique. Chaque vue, imprenable.', en: 'Every apartment is unique. Every view, breathtaking.' },
    { sel: '.prestige-ribbon', fr: 'Jardins privatifs de 30 à 312 m² · Double parking avec Wall Box EV · Cave privée 6 m² · Vue Sainte-Victoire garantie', en: 'Private gardens 30–312 m² · Double parking with EV Wall Box · Private cellar 6 m² · Guaranteed Sainte-Victoire view' },
    { sel: '.logement-tab-btn', fr: 'Appartements T4 — 4 unités', en: 'T4 Apartments — 4 units', idx: 0 },
    { sel: '.logement-tab-btn', fr: 'T3 Duplex — 2 unités',        en: 'T3 Duplex — 2 units',    idx: 1 },
    { sel: '.logement-tab-btn', fr: 'Appartements T2 — 2 unités',  en: 'T2 Apartments — 2 units', idx: 2 },
  ],

  /* ── exterieurs.html ────────────────────────────────────── */
  'exterieurs.html': [
    { sel: '.hero-eyebrow',  fr: 'Espaces Communs',    en: 'Common Areas'   },
    { sel: '.hero-title',    fr: 'Piscine, jardins<br>&amp; <em>solarium</em>', en: 'Pool, gardens<br>&amp; <em>solarium</em>' },
    { sel: '.hero-subtitle', fr: 'Des espaces de vie partagés d\'exception, au cœur de la résidence 59 Cézanne.', en: 'Exceptional shared living spaces at the heart of the 59 Cézanne residence.' },
    { sel: '.section-title', fr: 'La piscine <em>chauffée</em>', en: 'The <em>heated</em> pool', idx: 0 },
    { sel: '.section-title', fr: 'Les jardins <em>méditerranéens</em>', en: 'The <em>Mediterranean</em> gardens', idx: 1 },
    { sel: '.section-title', fr: 'Vues <em>aériennes</em>', en: '<em>Aerial</em> views', idx: 2 },
  ],

  /* ── localisation.html ──────────────────────────────────── */
  'localisation.html': [
    { sel: '.hero-eyebrow',  fr: 'Localisation',    en: 'Location'   },
    { sel: '.hero-title',    fr: 'Une situation<br><em>idéale</em>', en: 'An <em>ideal</em><br>location' },
    { sel: '.hero-subtitle', fr: '59 Avenue Paul Cézanne — Quartier des Lauves, 13100 Aix-en-Provence', en: '59 Avenue Paul Cézanne — Les Lauves district, 13100 Aix-en-Provence' },
    { sel: '.section-title', fr: '59 Avenue Paul Cézanne,<br><em>Aix-en-Provence</em>', en: '59 Avenue Paul Cézanne,<br><em>Aix-en-Provence</em>', idx: 0 },
    { sel: '.section-title', fr: 'Tout est <em>accessible</em>', en: 'Everything is <em>accessible</em>', idx: 1 },
    { sel: '.section-title', fr: 'Tout <em>à proximité</em>', en: 'Everything <em>nearby</em>', idx: 2 },
    { sel: '.section-title', fr: 'Connexions <em>exceptionnelles</em>', en: '<em>Exceptional</em> connections', idx: 3 },
  ],

  /* ── promoteur.html ─────────────────────────────────────── */
  'promoteur.html': [
    { sel: '.hero-eyebrow',  fr: 'Le Promoteur',    en: 'The Developer'   },
    { sel: '.hero-title',    fr: 'Ponthieu Développement<br><em>Holding</em>', en: 'Ponthieu Development<br><em>Holding</em>' },
    { sel: '.hero-subtitle', fr: 'Une maison d\'excellence fondée sur deux décennies d\'expertise immobilière dans le Sud de la France.', en: 'A house of excellence built on two decades of real estate expertise in the South of France.' },
    { sel: '.section-title', fr: 'Stéphane Ponthieu &<br><em>l\'excellence immobilière</em>', en: 'Stéphane Ponthieu &<br><em>real estate excellence</em>', idx: 0 },
    { sel: '.section-title', fr: 'Vos <em>garanties</em>', en: 'Your <em>guarantees</em>', idx: 1 },
  ],

  /* ── contact.html ───────────────────────────────────────── */
  'contact.html': [
    { sel: '.hero-eyebrow',  fr: 'Contact',    en: 'Contact'   },
    { sel: '.hero-title',    fr: 'Prenons <em>contact</em>', en: 'Get in <em>touch</em>' },
    { sel: '.hero-subtitle', fr: 'Notre équipe est à votre disposition pour répondre à toutes vos questions sur la résidence 59 Cézanne.', en: 'Our team is available to answer all your questions about the 59 Cézanne residence.' },
    { sel: '.btn-submit',    fr: 'Envoyer ma demande', en: 'Send my request' },
  ],
};

/* ── Apply translations ──────────────────────────────────────── */
function applyTranslations(lang) {
  const page  = window.location.pathname.split('/').pop() || 'index.html';
  const rules = [...(TRANS.shared || []), ...(TRANS[page] || [])];

  rules.forEach(rule => {
    const els = document.querySelectorAll(rule.sel);
    if (!els.length) return;

    if (rule.idx !== undefined) {
      // Target specific index when selector matches multiple elements
      if (els[rule.idx]) els[rule.idx].innerHTML = rule[lang];
    } else {
      els.forEach(el => {
        // Only apply if content matches (avoid overwriting wrong element)
        const currentFR = rule.fr.replace(/<[^>]+>/g, '').trim();
        const currentEl = el.innerHTML.replace(/<[^>]+>/g, '').trim();
        if (currentEl && currentFR && !currentEl.includes(currentFR.substring(0, 15))) return;
        el.innerHTML = rule[lang];
      });
    }
  });

  // Update <html lang> attribute
  document.documentElement.lang = lang;

  // Save preference
  try { localStorage.setItem('59cezanne-lang', lang); } catch(e) {}
}

/* ── Override setLang ────────────────────────────────────────── */
window.setLang = function(lang) {
  // Existing data-lang-* attribute system (backward compat)
  document.querySelectorAll('[data-lang-' + lang + ']').forEach(el => {
    el.innerHTML = el.getAttribute('data-lang-' + lang);
  });

  // New translation system
  applyTranslations(lang);

  // Update buttons
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${lang}'`));
  });
};

/* ── Restore saved preference on load ───────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  try {
    const saved = localStorage.getItem('59cezanne-lang');
    if (saved && saved !== 'fr') window.setLang(saved);
  } catch(e) {}
});
