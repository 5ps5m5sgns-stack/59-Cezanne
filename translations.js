/* ============================================================
   59 CÉZANNE — translations.js
   Bilingual FR / EN support via data-lang-* attributes
   ============================================================ */

window.setLang = function(lang) {
  // 1. innerHTML replacement via data-lang-* attributes
  document.querySelectorAll('[data-lang-' + lang + ']').forEach(el => {
    el.innerHTML = el.getAttribute('data-lang-' + lang);
  });

  // 2. Placeholder replacement for inputs/textareas
  document.querySelectorAll('[data-placeholder-' + lang + ']').forEach(el => {
    el.placeholder = el.getAttribute('data-placeholder-' + lang);
  });

  // 3. Update html[lang] attribute
  document.documentElement.lang = lang === 'fr' ? 'fr' : 'en';

  // 4. Update active lang button
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes("'" + lang + "'"));
  });

  // 5. Save preference for this session only
  try { sessionStorage.setItem('59cezanne-lang', lang); } catch(e) {}
};

/* Restore saved language across pages within the same session */
document.addEventListener('DOMContentLoaded', function() {
  try {
    const saved = sessionStorage.getItem('59cezanne-lang');
    if (saved && saved !== 'fr') window.setLang(saved);
  } catch(e) {}
});
