/* ============================================================
   59 CÉZANNE — contact.js
   Form validation & submission
   ============================================================ */

'use strict';

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
      // Scroll to first error
      const firstError = form.querySelector('.form-group.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Show loading state
    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;width:18px;height:18px;"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="30"/></svg>&nbsp; Envoi en cours...';
    submitBtn.disabled = true;

    // Add spinner CSS if not already added
    if (!document.getElementById('spin-style')) {
      const style = document.createElement('style');
      style.id = 'spin-style';
      style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    // Track conversion before native submit
    if (typeof gtag === 'function') {
      gtag('event', 'form_submit', {
        event_category: 'Contact',
        event_label: '59 Cézanne Contact Form'
      });
    }

    // Native Netlify Forms submission → redirects to action URL (merci.html)
    form.submit();
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
