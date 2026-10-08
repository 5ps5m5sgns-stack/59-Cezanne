/* ============================================================
   59 CÉZANNE — translations.js
   Bascule FR / EN via les attributs data-lang-* — UNIQUE définition de setLang().

   Contrat (ne pas redéfinir setLang ailleurs : ni dans animations.js, ni en ligne) :
   - data-lang-fr / data-lang-en       → innerHTML de l'élément
   - data-placeholder-fr / -en         → attribut placeholder
   - data-aria-label-fr / -en          → attribut aria-label (optionnel)
   - data-alt-fr / -en                 → attribut alt des images (optionnel)
   - <html lang> mis à jour ; boutons .lang-btn : classe .active + aria-pressed
   - langue mémorisée dans sessionStorage ('59cezanne-lang'), pour la session seulement
   - <html data-lang-lock> (pages de blog : français seul, ou anglais natif) :
       setLang() ne fait RIEN, la langue mémorisée est ignorée et jamais modifiée,
       et les boutons de langue éventuels sont masqués par style.css.
   - événement document « 59c:langchange » ({detail:{lang}}) pour les autres scripts
     (libellés ARIA de animations.js, bandeau de cookie.js).
   - window.getLang() renvoie 'fr' ou 'en' (langue courante de l'interface).
   Compatible avec <script defer> : ne dépend d'aucun ordre de chargement.
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = '59cezanne-lang';
  var root = document.documentElement;

  function isLocked() {
    return root.hasAttribute('data-lang-lock');
  }

  function normalize(lang) {
    return String(lang || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'fr';
  }

  function currentLang() {
    return normalize(root.getAttribute('lang'));
  }

  function readStored() {
    try { return sessionStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function writeStored(lang) {
    try { sessionStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* stockage indisponible : on ignore */ }
  }

  /* Langue portée par un bouton : data-set-lang, sinon lang="fr|en", sinon onclick="setLang('xx')" */
  function buttonLang(btn) {
    var l = btn.getAttribute('data-set-lang') || btn.getAttribute('lang');
    if (!l) {
      var m = /setLang\(\s*['"](\w+)['"]/.exec(btn.getAttribute('onclick') || '');
      l = m ? m[1] : '';
    }
    return l ? normalize(l) : '';
  }

  function syncButtons(lang) {
    var buttons = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < buttons.length; i++) {
      var bl = buttonLang(buttons[i]);
      if (!bl) continue;
      var on = bl === lang;
      buttons[i].classList.toggle('active', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function setLang(lang) {
    if (isLocked()) return false;          // pages de blog : langue figée
    lang = normalize(lang);

    // 1. Contenu : innerHTML
    var texts = document.querySelectorAll('[data-lang-' + lang + ']');
    for (var i = 0; i < texts.length; i++) {
      texts[i].innerHTML = texts[i].getAttribute('data-lang-' + lang);
    }

    // 2. Placeholders des champs
    var fields = document.querySelectorAll('[data-placeholder-' + lang + ']');
    for (var j = 0; j < fields.length; j++) {
      fields[j].setAttribute('placeholder', fields[j].getAttribute('data-placeholder-' + lang));
    }

    // 3. aria-label optionnels
    var labelled = document.querySelectorAll('[data-aria-label-' + lang + ']');
    for (var k = 0; k < labelled.length; k++) {
      labelled[k].setAttribute('aria-label', labelled[k].getAttribute('data-aria-label-' + lang));
    }

    // 3b. alt des images (data-alt-fr / data-alt-en) : le texte alternatif suit la langue de l'interface
    var alts = document.querySelectorAll('[data-alt-' + lang + ']');
    for (var m = 0; m < alts.length; m++) {
      alts[m].setAttribute('alt', alts[m].getAttribute('data-alt-' + lang));
    }

    // 4. <html lang>
    root.setAttribute('lang', lang);

    // 5. Boutons FR / EN
    syncButtons(lang);

    // 6. Préférence conservée pour la session uniquement
    writeStored(lang);

    // 7. Prévenir les autres scripts
    try {
      document.dispatchEvent(new CustomEvent('59c:langchange', { detail: { lang: lang } }));
    } catch (e) { /* CustomEvent indisponible : sans conséquence */ }
    return true;
  }

  window.setLang = setLang;
  window.getLang = currentLang;

  /* Restauration de la langue au chargement (même session, autres pages) */
  function init() {
    if (isLocked()) return;                // on ne lit ni n'écrit la langue mémorisée
    if (readStored() === 'en') {
      setLang('en');
    } else {
      syncButtons(currentLang());          // état initial FR : aria-pressed cohérent
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
