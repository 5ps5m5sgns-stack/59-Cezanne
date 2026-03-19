/* ============================================================
   59 CÉZANNE — contact.js
   Form validation & submission (Formspree)
   ============================================================ */

'use strict';

/* ── Replace FORMSPREE_ID with your actual Formspree form ID ── */
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xpqybwkw';

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  /* ─── Validation helpers ─────────────────────────────────── */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  function isValidPhone(phone) {
    const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    return /^(\+33|0033|0)[1-9](\d{8})$/.test(cleaned);
  }

  function setError(groupId, show) {
    const group = document.getElementById(groupId);
    if (!group) return;
    if (show) {
      group.classList.add('error');
    } else {
      group.classList.remove('error');
    }
  }

  /* ─── Real-time validation ──────────────────────────────── */
  function attachLiveValidation(inputId, groupId, validator) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('blur', () => {
      const valid = validator(input.value);
      setError(groupId, !valid);
    });
    input.addEventListener('input', () => {
      if (document.getElementById(groupId)?.classList.contains('error')) {
        const valid = validator(input.value);
        if (valid) setError(groupId, false);
      }
    });
  }

  attachLiveValidation('nom',    'fg-nom',    v => v.trim().length >= 2);
  attachLiveValidation('prenom', 'fg-prenom', v => v.trim().length >= 2);
  attachLiveValidation('email',  'fg-email',  v => isValidEmail(v));
  attachLiveValidation('tel',    'fg-tel',    v => isValidPhone(v));

  /* ─── Form submit ───────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Clear previous errors
    ['fg-nom', 'fg-prenom', 'fg-email', 'fg-tel'].forEach(id => setError(id, false));
    const rgpdError = document.getElementById('rgpd-error');
    if (rgpdError) rgpdError.style.display = 'none';

    const nom    = document.getElementById('nom');
    const prenom = document.getElementById('prenom');
    const email  = document.getElementById('email');
    const tel    = document.getElementById('tel');
    const rgpd   = document.getElementById('rgpd');

    let isValid = true;

    if (!nom || nom.value.trim().length < 2) {
      setError('fg-nom', true);
      isValid = false;
    }

    if (!prenom || prenom.value.trim().length < 2) {
      setError('fg-prenom', true);
      isValid = false;
    }

    if (!email || !isValidEmail(email.value)) {
      setError('fg-email', true);
      isValid = false;
    }

    if (!tel || !isValidPhone(tel.value)) {
      setError('fg-tel', true);
      isValid = false;
    }

    if (!rgpd || !rgpd.checked) {
      if (rgpdError) rgpdError.style.display = 'block';
      isValid = false;
    }

    if (!isValid) {
      const firstError = form.querySelector('.form-group.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Show loading state
    const submitBtn = form.querySelector('.btn-submit');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;width:18px;height:18px;"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="30"/></svg>&nbsp; Envoi en cours...';
    submitBtn.disabled = true;

    if (!document.getElementById('spin-style')) {
      const style = document.createElement('style');
      style.id = 'spin-style';
      style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    // Track conversion
    if (typeof gtag === 'function') {
      gtag('event', 'form_submit', {
        event_category: 'Contact',
        event_label: '59 Cézanne Contact Form'
      });
    }

    // Submit to Formspree
    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nom:      nom.value.trim(),
        prenom:   prenom.value.trim(),
        email:    email.value.trim(),
        tel:      tel.value.trim(),
        typology: (document.getElementById('typology') || {}).value || '',
        message:  ((document.getElementById('message') || {}).value || '').trim()
      })
    })
    .then(function (res) {
      if (res.ok) {
        window.location.href = 'merci.html';
      } else {
        return res.json().then(function (data) { throw data; });
      }
    })
    .catch(function () {
      submitBtn.innerHTML = originalBtnHtml;
      submitBtn.disabled = false;
      let errEl = document.getElementById('form-submit-error');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = 'form-submit-error';
        errEl.style.cssText = 'color:#c0392b;font-size:0.85rem;margin-top:0.8rem;text-align:center;';
        submitBtn.insertAdjacentElement('afterend', errEl);
      }
      errEl.textContent = 'Une erreur est survenue. Veuillez réessayer ou nous contacter par téléphone.';
    });
  });

});

/* ─── Callback button animation ────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const callbackBtn = document.querySelector('.callback-btn');
  if (!callbackBtn) return;

  callbackBtn.addEventListener('mouseenter', function () {
    this.style.transform = 'translateY(-3px)';
  });

  callbackBtn.addEventListener('mouseleave', function () {
    this.style.transform = 'translateY(0)';
  });
});
