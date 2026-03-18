/* ============================================================
   59 CÉZANNE — cookie.js
   Bandeau RGPD + Google Analytics
   ============================================================ */

const GA_ID = 'G-XXXXXXXXXX'; // ← Remplacer par ton vrai ID Google Analytics

(function () {
  'use strict';

  // ── Vérifier le consentement existant ─────────────────────
  const consent = localStorage.getItem('59cezanne-cookie-consent');
  if (consent === 'accepted') { loadGA(); return; }
  if (consent === 'refused')  { return; }

  // ── Créer le bandeau ──────────────────────────────────────
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML = `
    <div class="cookie-inner">
      <div class="cookie-text">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20" style="flex-shrink:0;color:var(--or)"><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm0-11v5m0-8v1"/></svg>
        <span>Nous utilisons des cookies pour analyser le trafic et améliorer votre expérience. Consultez notre <a href="mentions-legales.html">politique de confidentialité</a>.</span>
      </div>
      <div class="cookie-btns">
        <button id="cookie-refuse" class="cookie-btn cookie-btn-refuse">Refuser</button>
        <button id="cookie-accept" class="cookie-btn cookie-btn-accept">Accepter</button>
      </div>
    </div>
  `;

  // ── Styles ────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #cookie-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: rgba(18, 18, 16, 0.97);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(201, 169, 110, 0.25);
      padding: 1rem 1.5rem;
      animation: slideUp 0.4s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    .cookie-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .cookie-text {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      font-family: var(--font-sans, sans-serif);
      font-size: 0.82rem;
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
    }
    .cookie-text a {
      color: var(--or, #C9A96E);
      text-decoration: underline;
    }
    .cookie-btns {
      display: flex;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .cookie-btn {
      padding: 0.5rem 1.25rem;
      border-radius: 4px;
      font-family: var(--font-sans, sans-serif);
      font-size: 0.8rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      cursor: pointer;
      border: none;
      transition: opacity 0.2s;
    }
    .cookie-btn:hover { opacity: 0.85; }
    .cookie-btn-refuse {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.6);
    }
    .cookie-btn-accept {
      background: var(--or, #C9A96E);
      color: #1C1C1A;
    }
    @media (max-width: 600px) {
      .cookie-inner { flex-direction: column; align-items: flex-start; }
      .cookie-btns { width: 100%; }
      .cookie-btn { flex: 1; text-align: center; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(banner);

  // ── Événements ────────────────────────────────────────────
  document.getElementById('cookie-accept').addEventListener('click', function () {
    localStorage.setItem('59cezanne-cookie-consent', 'accepted');
    banner.style.animation = 'slideDown 0.3s ease forwards';
    setTimeout(() => banner.remove(), 300);
    loadGA();
  });

  document.getElementById('cookie-refuse').addEventListener('click', function () {
    localStorage.setItem('59cezanne-cookie-consent', 'refused');
    banner.style.animation = 'slideDown 0.3s ease forwards';
    setTimeout(() => banner.remove(), 300);
  });

  const sd = document.createElement('style');
  sd.textContent = '@keyframes slideDown { to { transform: translateY(100%); opacity:0; } }';
  document.head.appendChild(sd);

})();

// ── Charger Google Analytics ───────────────────────────────
function loadGA() {
  if (!GA_ID || GA_ID === 'G-XXXXXXXXXX') return;
  const s = document.createElement('script');
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  s.async = true;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });
}
