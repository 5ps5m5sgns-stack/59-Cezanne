/* ============================================================
   59 CÉZANNE — contact.js
   Formulaire de contact (envoi JSON vers Formspree) :
   - validation tolérante (téléphone international), erreurs annoncées (aria-invalid,
     aria-describedby, récapitulatif en zone vivante, focus sur le premier problème) ;
   - consentement RGPD transmis avec la demande (case non pré-cochée, texte et date) ;
   - anti-spam : champ piège « _gotcha » + délai minimal avant envoi ;
   - contexte transmis : page d'origine, page de contact, langue, type de projet ;
   - /contact?bien=138 ou ?bien=duplex-216 : présélectionne le bien et préremplit le message
     (aucune donnée personnelle dans l'URL ; toute autre valeur est ignorée) ;
   - événement de succès (generate_lead) UNIQUEMENT si un outil de mesure a déjà été
     chargé après consentement (window.gtag) : ce script ne charge rien lui-même.
   Sans JavaScript, le <form action="https://formspree.io/f/…" method="POST"> du HTML
   prend le relais (voir contact.html).
   ============================================================ */

(function () {
  'use strict';

  /* Ne pas modifier l'adresse : même formulaire Formspree que celui de l'action HTML. */
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xpqybwkw';
  var THANKS_URL = '/merci';
  var MIN_FILL_MS = 3000;          // délai minimal entre le chargement de la page et l'envoi
  var REQUEST_TIMEOUT_MS = 20000;  // abandon de la requête au-delà
  var REDIRECT_DELAY_MS = 700;     // laisse le temps d'annoncer le succès et d'envoyer la mesure
  var CONSENT_VERSION = 'mentions-legales-2026-10';

  /* Biens proposés dans le sélecteur (valeur de l'option → message poli, FR et EN). */
  var BIENS = {
    '138': {
      fr: 'Bonjour, je souhaite visiter le 4 pièces de 138 m². Pourriez-vous me recontacter pour convenir d\u2019un rendez-vous ? Merci.',
      en: 'Hello, I would like to visit the 4-room, 138 m\u00b2 apartment. Could you please get back to me to arrange an appointment? Thank you.'
    },
    'duplex-216': {
      fr: 'Bonjour, je souhaite visiter le duplex 4 pièces de 216 m². Pourriez-vous me recontacter pour convenir d\u2019un rendez-vous ? Merci.',
      en: 'Hello, I would like to visit the 4-room, 216 m\u00b2 duplex. Could you please get back to me to arrange an appointment? Thank you.'
    }
  };

  function hasBien(key) {
    return Object.prototype.hasOwnProperty.call(BIENS, key);
  }

  /* ─── Utilitaires ────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }

  function lang() {
    if (typeof window.getLang === 'function') return window.getLang();
    return String(document.documentElement.lang || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'fr';
  }

  /* Affiche un message dans une zone vivante, en le rendant traduisible (data-lang-*) :
     si l'utilisateur change de langue, translations.js le remplace tout seul. */
  function say(el, state, fr, en) {
    if (!el) return;
    el.setAttribute('data-lang-fr', fr);
    el.setAttribute('data-lang-en', en);
    el.setAttribute('data-state', state);
    el.textContent = lang() === 'en' ? en : fr;
  }

  function wipe(el) {
    if (!el) return;
    el.removeAttribute('data-lang-fr');
    el.removeAttribute('data-lang-en');
    el.removeAttribute('data-state');
    el.textContent = '';
  }

  function addDescribedBy(input, id) {
    var ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (ids.indexOf(id) === -1) ids.push(id);
    input.setAttribute('aria-describedby', ids.join(' '));
  }

  function removeDescribedBy(input, id) {
    var ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== id; });
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  }

  /* ─── Validation ─────────────────────────────────────────── */
  function validName(v) {
    v = v.trim();
    return v.length >= 1 && v.length <= 80;
  }

  function validEmail(v) {
    v = v.trim();
    return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  /* Téléphone tolérant (E.164 et formats nationaux étrangers) :
     chiffres, espaces, points, tirets, parenthèses, barre oblique ; « + » seulement en tête ;
     préfixe international « 00 » accepté ; 7 à 15 chiffres (maximum E.164). */
  function validPhone(v) {
    v = v.trim();
    if (!/^[+()0-9][0-9\s().\-\/+]*$/.test(v)) return false;
    if (v.indexOf('+', 1) !== -1) return false;
    var compact = v.replace(/[\s().\-\/]/g, '');
    var digits = compact.replace(/\D/g, '');
    if (compact.indexOf('00') === 0) digits = digits.slice(2);
    return digits.length >= 7 && digits.length <= 15;
  }

  var FIELDS = [
    { id: 'nom',    group: 'fg-nom',    err: 'err-nom',    label: 'lbl-nom',    test: validName },
    { id: 'prenom', group: 'fg-prenom', err: 'err-prenom', label: 'lbl-prenom', test: validName },
    { id: 'email',  group: 'fg-email',  err: 'err-email',  label: 'lbl-email',  test: validEmail },
    { id: 'tel',    group: 'fg-tel',    err: 'err-tel',    label: 'lbl-tel',    test: validPhone },
    { id: 'rgpd',   group: 'fg-rgpd',   err: 'err-rgpd',   label: 'rgpd-text',  test: function () { return $('rgpd').checked; }, checkbox: true }
  ];

  function fieldValue(f) {
    var el = $(f.id);
    return f.checkbox ? (el.checked ? 'oui' : '') : el.value;
  }

  function setFieldError(f, on) {
    var group = $(f.group);
    var input = $(f.id);
    if (!group || !input) return;
    group.classList.toggle('error', on);
    if (on) {
      input.setAttribute('aria-invalid', 'true');
      addDescribedBy(input, f.err);
    } else {
      input.removeAttribute('aria-invalid');
      removeDescribedBy(input, f.err);
    }
  }

  /* ─── Bien concerné : /contact?bien=138 ou ?bien=duplex-216 ──────
     Présélectionne l'option du sélecteur et préremplit poliment le message. Seules les clés de BIENS
     sont reconnues ; toute autre valeur est ignorée. Le message n'est jamais écrasé s'il a été modifié. */
  function initBien() {
    var select = $('typology');
    var message = $('message');
    if (!select || !message) return;

    var prefill = '';   // dernier texte posé par ce script

    function textFor(key) {
      return hasBien(key) ? BIENS[key][lang()] : '';
    }

    function apply(key) {
      if (message.value.trim() !== '' && message.value !== prefill) return;   // saisie de la personne : on n'y touche pas
      prefill = textFor(key);
      message.value = prefill;
    }

    var wanted = '';
    try {
      wanted = (new URLSearchParams(window.location.search).get('bien') || '').trim().toLowerCase();
    } catch (e) { wanted = ''; }

    if (hasBien(wanted)) {
      select.value = wanted;
      apply(wanted);
    }

    select.addEventListener('change', function () { apply(select.value); });

    // Changement de langue : le préremplissage suit, tant qu'il n'a pas été modifié
    document.addEventListener('59c:langchange', function () {
      if (prefill && message.value === prefill) {
        prefill = textFor(select.value);
        message.value = prefill;
      }
    });
  }

  /* ─── Initialisation ─────────────────────────────────────── */
  function init() {
    var form = $('contactForm');
    if (!form) return;

    form.noValidate = true; // JS actif : validation maison ; sans JS, les attributs « required » restent actifs

    var summary = $('errSummary');
    var statusEl = $('formStatus');
    var failEl = $('formFail');
    var submitBtn = $('ct-submit');
    var submitLabel = $('ct-submit-label');
    var honeypot = form.querySelector('[name="_gotcha"]');
    var originField = $('page_origine');

    var startedAt = Date.now();
    var sending = false;
    var attempted = false;

    if (originField) originField.value = document.referrer || '';

    /* — Validation en direct (sans punir le simple passage au clavier) — */
    FIELDS.forEach(function (f) {
      var el = $(f.id);
      if (!el) return;
      if (!f.checkbox) {
        el.addEventListener('blur', function () {
          if (attempted || el.value.trim() !== '') setFieldError(f, !f.test(el.value));
        });
        el.addEventListener('input', function () {
          if ($(f.group).classList.contains('error') && f.test(el.value)) setFieldError(f, false);
        });
      } else {
        el.addEventListener('change', function () {
          if (el.checked) setFieldError(f, false);
        });
      }
    });

    /* — Récapitulatif des erreurs : zone vivante + focus — */
    function showSummary(errors) {
      var n = errors.length;
      var fr = 'Le formulaire contient ' + n + (n > 1 ? ' erreurs' : ' erreur') + '. Veuillez corriger :';
      var en = 'The form contains ' + n + (n > 1 ? ' errors' : ' error') + '. Please correct:';
      summary.textContent = '';
      var p = document.createElement('p');
      p.setAttribute('data-lang-fr', fr);
      p.setAttribute('data-lang-en', en);
      p.textContent = lang() === 'en' ? en : fr;
      var ul = document.createElement('ul');
      errors.forEach(function (f) {
        var src = $(f.label);
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + f.id;
        var labelFr = src.getAttribute('data-lang-fr') || src.textContent;
        var labelEn = src.getAttribute('data-lang-en') || src.textContent;
        if (f.checkbox) { labelFr = 'Consentement'; labelEn = 'Consent'; }
        a.setAttribute('data-lang-fr', labelFr);
        a.setAttribute('data-lang-en', labelEn);
        a.textContent = lang() === 'en' ? labelEn : labelFr;
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          focusField(f.id);
        });
        li.appendChild(a);
        ul.appendChild(li);
      });
      summary.appendChild(p);
      summary.appendChild(ul);
      summary.focus();
    }

    function hideSummary() {
      summary.textContent = '';
    }

    function focusField(id) {
      var el = $(id);
      if (!el) return;
      try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* ancien navigateur */ }
      el.focus({ preventScroll: true });
    }

    function validateAll() {
      var errors = [];
      FIELDS.forEach(function (f) {
        var ok = f.test($(f.id).value);
        setFieldError(f, !ok);
        if (!ok) errors.push(f);
      });
      return errors;
    }

    /* — Données envoyées — */
    function selectLabelFr(id) {
      var sel = $(id);
      if (!sel || !sel.value) return '';
      var opt = sel.options[sel.selectedIndex];
      return (opt && (opt.getAttribute('data-lang-fr') || opt.textContent) || '').trim();
    }

    function buildPayload() {
      var consent = ($('rgpd-text').textContent || '').replace(/\s+/g, ' ').trim();
      var subject = form.querySelector('[name="_subject"]');
      return {
        nom: $('nom').value.trim(),
        prenom: $('prenom').value.trim(),
        email: $('email').value.trim(),
        tel: $('tel').value.trim(),
        projet: selectLabelFr('projet'),
        typology: selectLabelFr('typology'),
        message: ($('message').value || '').trim(),
        consentement_rgpd: 'oui',
        consentement_texte: consent,
        consentement_date: new Date().toISOString(),
        consentement_version: CONSENT_VERSION,
        langue: lang(),
        page_origine: document.referrer || '(accès direct ou page précédente inconnue)',
        page_url: window.location.href,
        _subject: subject ? subject.value : 'Demande d\'information — 59 Cézanne',
        _gotcha: honeypot ? honeypot.value : ''
      };
    }

    /* — Mesure : seulement si un outil a déjà été activé après consentement — */
    function trackLead(payload) {
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'generate_lead', {
            form_id: 'contact',
            typology: payload.typology || '',
            project_type: payload.projet || '',
            transport_type: 'beacon'
          });
        }
      } catch (e) { /* la mesure ne doit jamais bloquer la demande */ }
    }

    /* — États du bouton — */
    function setSending(on) {
      sending = on;
      submitBtn.setAttribute('aria-disabled', on ? 'true' : 'false');
      if (on) {
        submitLabel.textContent = lang() === 'en' ? 'Sending…' : 'Envoi en cours…';
      } else {
        submitLabel.textContent = submitLabel.getAttribute('data-lang-' + lang()) || 'Envoyer ma demande';
      }
    }

    function onSuccess(payload) {
      trackLead(payload);
      wipe(failEl);
      say(statusEl, 'ok',
        'Merci, votre demande a bien été envoyée. Vous allez être redirigé(e) vers la page de confirmation.',
        'Thank you, your enquiry has been sent. You are being redirected to the confirmation page.');
      form.classList.add('is-sent');
      window.setTimeout(function () { window.location.assign(THANKS_URL); }, REDIRECT_DELAY_MS);
    }

    function onFailure(data) {
      setSending(false);
      wipe(statusEl);
      var emailRejected = false;
      if (data && data.errors && data.errors.length) {
        for (var i = 0; i < data.errors.length; i++) {
          if (data.errors[i] && data.errors[i].field === 'email') emailRejected = true;
        }
      }
      if (emailRejected) {
        setFieldError(FIELDS[2], true);
        showSummary([FIELDS[2]]);
        return;
      }
      say(failEl, 'error',
        'Votre demande n\'a pas pu être envoyée. Veuillez réessayer dans un instant ou nous joindre par téléphone ou par e-mail (coordonnées sur cette page).',
        'Your enquiry could not be sent. Please try again in a moment, or reach us by phone or email (details on this page).');
    }

    /* — Soumission — */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      attempted = true;
      wipe(failEl);
      wipe(statusEl);

      // Champ piège rempli : c'est un robot. Faux succès, aucun envoi, aucune redirection.
      if (honeypot && honeypot.value) {
        say(statusEl, 'ok',
          'Merci, votre demande a bien été envoyée.',
          'Thank you, your enquiry has been sent.');
        return;
      }

      var errors = validateAll();
      if (errors.length) {
        showSummary(errors);
        return;
      }
      hideSummary();

      // Délai minimal : un humain met plus de quelques secondes à remplir le formulaire.
      if (Date.now() - startedAt < MIN_FILL_MS) {
        say(failEl, 'error',
          'Votre demande n\'a pas été envoyée : le formulaire a été validé trop rapidement. Merci de patienter quelques secondes, puis de réessayer.',
          'Your enquiry was not sent: the form was submitted too quickly. Please wait a few seconds and try again.');
        return;
      }

      var payload = buildPayload();
      setSending(true);
      say(statusEl, 'info', 'Envoi de votre demande en cours…', 'Sending your enquiry…');

      var controller = ('AbortController' in window) ? new AbortController() : null;
      var timer = window.setTimeout(function () { if (controller) controller.abort(); }, REQUEST_TIMEOUT_MS);

      fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          window.clearTimeout(timer);
          if (res.ok) {
            onSuccess(payload);
            return null;
          }
          return res.json().then(function (d) { return d; }, function () { return null; }).then(onFailure);
        })
        .catch(function () {
          window.clearTimeout(timer);
          onFailure(null);
        });
    });

    /* Retour arrière depuis /merci (cache de navigation) : formulaire de nouveau utilisable */
    window.addEventListener('pageshow', function (ev) {
      if (ev.persisted) {
        form.classList.remove('is-sent');
        wipe(statusEl);
        wipe(failEl);
        setSending(false);
        startedAt = Date.now() - MIN_FILL_MS;
      }
    });

    initBien();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
