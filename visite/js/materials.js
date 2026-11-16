/* 59 Cézanne — visite 3D : matériaux et textures procédurales (dessinées sur canvas au chargement, aucun fichier image à télécharger).
   Direction artistique reprise des images du graphiste : parquet chêne miel satiné, murs blancs, menuiseries anthracite,
   cuisine anthracite et chêne clair, velours terracotta, bouclé gris, cuir cognac, marbre blanc veiné, laiton brossé, lin taupe. */
import * as THREE from 'three';
import { rng } from 'v3d/geo';

function canvas(size, draw, alpha = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d', { alpha }), size);
  return c;
}
function tex(c, { srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const grey = (v, a = 1) => rgb(v, v, v, a);
function shade([r, g, b], k) { return [Math.max(0, Math.min(255, r * k)), Math.max(0, Math.min(255, g * k)), Math.max(0, Math.min(255, b * k))]; }

/* Grain fin : petites taches translucides claires et sombres. */
function speckle(g, S, R, n, amp = 0.06, size = 2.2) {
  for (let i = 0; i < n; i++) {
    const v = R() < 0.5 ? 0 : 255;
    g.fillStyle = rgb(v, v, v, R() * amp);
    const s = 0.6 + R() * size;
    g.fillRect(R() * S, R() * S, s, s);
  }
}
/* Nuages doux : grandes taches très diffuses, pour casser l'aplat (raccord sur les bords). */
function clouds(g, S, R, n, amp, rad) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = rad * (0.4 + R());
    const v = R() < 0.5 ? 0 : 255;
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, rgb(v, v, v, amp * R())); gr.addColorStop(1, rgb(v, v, v, 0));
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    }
  }
}

/* Parquet : lames larges de 18 cm, longueurs variables. Trois cartes dessinées ensemble : couleur, relief (joints, fil du bois), brillance par lame. */
function parquetSet(base, seed, S, { plank = 0.18, tile = 3.24, vary = 0.1 } = {}) {
  const H = S >> 1, k = 0.5, px = S / 1024;
  const C = canvas(S, () => { }), B = canvas(H, (g) => { g.fillStyle = '#868686'; g.fillRect(0, 0, H, H); }), Q = canvas(H, (g) => { g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, H, H); });
  const g = C.getContext('2d'), gb = B.getContext('2d'), gq = Q.getContext('2d');
  const R = rng(seed), rows = Math.round(tile / plank), ph = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = -R() * S * 0.55; const y0 = r * ph;
    while (x < S) {
      const len = S * (0.36 + R() * 0.3), c = shade(base, 1 - vary / 2 + R() * vary), warm = (R() - 0.5) * 7;
      const gd = g.createLinearGradient(x, 0, x + len, 0);
      gd.addColorStop(0, rgb(c[0] + warm, c[1] + warm * 0.3, c[2] - warm * 0.5)); gd.addColorStop(1, rgb(...shade([c[0] + warm, c[1] + warm * 0.3, c[2] - warm * 0.5], 0.95 + R() * 0.1)));
      g.fillStyle = gd; g.fillRect(x, y0, len + 1, ph + 1);
      gq.fillStyle = grey(96 + R() * 44); gq.fillRect(x * k, y0 * k, len * k + 1, ph * k + 1);
      g.save(); g.beginPath(); g.rect(x, y0, len, ph); g.clip(); gb.save(); gb.beginPath(); gb.rect(x * k, y0 * k, len * k, ph * k); gb.clip();
      const cy = y0 + ph * (0.15 + R() * 0.7), n = 30 + ((R() * 22) | 0), flame = R() < 0.45;
      for (let i = 0; i < n; i++) {
        const yy = y0 + R() * ph, a = 0.05 + R() * 0.11, dk = R() < 0.62, lw = (0.5 + R() * 1.7) * px;
        const bend = flame ? (yy - cy) * (0.5 + R() * 0.9) : (R() - 0.5) * ph * 0.1, mx = x + len * (0.3 + R() * 0.4);
        const path = (q, s) => { q.beginPath(); q.moveTo((x - 4) * s, yy * s); q.quadraticCurveTo(mx * s, (yy + bend) * s, (x + len + 4) * s, (yy + (R() - 0.5) * ph * 0.06) * s); q.stroke(); };
        g.strokeStyle = dk ? rgb(70, 36, 14, a) : rgb(255, 226, 180, a * 0.75); g.lineWidth = lw; path(g, 1);
        gb.strokeStyle = dk ? grey(40, a * 1.5) : grey(210, a); gb.lineWidth = Math.max(0.6, lw * k); path(gb, k);
      }
      if (R() < 0.1) {                                               // nœud
        const kx = x + len * (0.2 + R() * 0.6), ky = y0 + ph * (0.3 + R() * 0.4), kr = ph * (0.07 + R() * 0.08);
        for (let j = 5; j > 0; j--) { g.strokeStyle = rgb(58, 30, 12, 0.1 + j * 0.03); g.lineWidth = px; g.beginPath(); g.ellipse(kx, ky, kr * j * 0.7, kr * j * 0.36, 0, 0, 7); g.stroke(); }
        g.fillStyle = rgb(50, 26, 10, 0.55); g.beginPath(); g.ellipse(kx, ky, kr * 0.6, kr * 0.34, 0, 0, 7); g.fill();
      }
      g.restore(); gb.restore();
      g.fillStyle = rgb(36, 18, 8, 0.62); g.fillRect(x + len - px, y0, Math.max(1.2, 1.3 * px), ph);
      gb.fillStyle = '#2c2c2c'; gb.fillRect((x + len - px) * k, y0 * k, Math.max(1.2, px), ph * k);
      x += len;
    }
    g.fillStyle = rgb(36, 18, 8, 0.55); g.fillRect(0, y0, S, Math.max(1.2, 1.3 * px));
    gb.fillStyle = '#2c2c2c'; gb.fillRect(0, y0 * k, H, Math.max(1.2, px));
  }
  speckle(g, S, R, S * 5, 0.03, 1.5 * px);
  return { map: C, bump: B, rough: Q };
}

/* Bois de mobilier : fil continu, sans joints. Renvoie [couleur, relief]. */
function woodSet(base, seed, dark = 0.1, S = 1024) {
  const H = S >> 1, B = canvas(H, (g) => { g.fillStyle = '#888'; g.fillRect(0, 0, H, H); }), gb = B.getContext('2d');
  const C = canvas(S, (g) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    clouds(g, S, R, 12, 0.06, S * 0.3);
    for (let i = 0; i < 620; i++) {
      const y = R() * S, dk = R() < 0.64, a = R() * dark, lw = 0.5 + R() * 2.2, b1 = (R() - 0.5) * 22, b2 = (R() - 0.5) * 22;
      g.strokeStyle = dk ? rgb(46, 24, 8, a) : rgb(255, 238, 208, a * 0.8); g.lineWidth = lw;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + b1, S * 0.7, y + b2, S, y); g.stroke();
      gb.strokeStyle = dk ? grey(50, a * 2.2) : grey(205, a * 1.4); gb.lineWidth = Math.max(0.6, lw / 2);
      gb.beginPath(); gb.moveTo(0, y / 2); gb.bezierCurveTo(H * 0.3, (y + b1) / 2, H * 0.7, (y + b2) / 2, H, y / 2); gb.stroke();
    }
    speckle(g, S, R, 5000, 0.03, 1.4);
  });
  return [C, B];
}

/* Pierre en dalles (travertin, grès cérame) : veines douces + joints. nx × ny dalles par carreau de texture. */
function stoneTiles(base, seed, nx, { ny = nx, joint = 3, veins = 0.5, jointCol = [150, 138, 120], S = 1024, shift = 0 } = {}) {
  return canvas(S, (g) => {
    const R = rng(seed), tw = S / nx, th = S / ny;
    for (let j = 0; j < ny; j++) for (let i = -1; i < nx; i++) {
      const ox = i * tw + (j % 2 ? shift * tw : 0), oy = j * th;
      const c = shade(base, 0.955 + R() * 0.09);
      g.fillStyle = rgb(...c); g.fillRect(ox, oy, tw, th);
      g.save(); g.beginPath(); g.rect(ox, oy, tw, th); g.clip();
      for (let k = 0; k < 40 * veins; k++) {
        const y = oy + R() * th;
        g.strokeStyle = R() < 0.55 ? rgb(120, 98, 70, 0.04 + R() * 0.07) : rgb(255, 250, 240, 0.05 + R() * 0.1);
        g.lineWidth = 1 + R() * 6;
        g.beginPath(); g.moveTo(ox, y); g.bezierCurveTo(ox + tw * 0.3, y + (R() - 0.5) * 22, ox + tw * 0.7, y + (R() - 0.5) * 22, ox + tw, y + (R() - 0.5) * 10); g.stroke();
      }
      for (let k = 0; k < 46 * veins; k++) { g.fillStyle = rgb(110, 92, 70, 0.07 + R() * 0.11); g.beginPath(); g.ellipse(ox + R() * tw, oy + R() * th, 1 + R() * 4, 0.6 + R() * 1.4, 0, 0, 7); g.fill(); }
      g.restore();
      g.fillStyle = rgb(...jointCol); g.fillRect(ox - joint / 2, oy, joint, th); g.fillRect(ox, oy - joint / 2, tw, joint);
    }
    speckle(g, S, R, 9000, 0.03, 1.6);
  });
}

/* Aplat légèrement vivant (enduit, plâtre). */
function plain(base, seed, { grain = 0.05, cloud = 0.05 } = {}) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    if (cloud) clouds(g, S, R, 14, cloud, 170);
    speckle(g, S, R, 9000, grain, 2);
  });
}

/* Trames de tissu en niveaux de gris clairs : servent à la fois de carte de couleur (multipliée par la teinte) et de relief. */
function weave(seed, kind) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, S, S);
    if (kind === 'linen') {                                           // toile : fils irréguliers dans les deux sens
      for (let y = 0; y < S; y += 3) { g.fillStyle = grey(190 + R() * 65, 0.55); g.fillRect(0, y, S, 1.6 + R()); }
      for (let x = 0; x < S; x += 3) { g.fillStyle = grey(180 + R() * 75, 0.5); g.fillRect(x, 0, 1.5 + R(), S); }
      for (let i = 0; i < 260; i++) { g.fillStyle = grey(R() < 0.5 ? 150 : 255, 0.3); g.fillRect(R() * S, R() * S, 8 + R() * 50, 1.2); }
    } else if (kind === 'boucle') {                                   // bouclette : petites boucles serrées
      for (let i = 0; i < 15000; i++) {
        const x = R() * S, y = R() * S, r = 2 + R() * 3.4, a = R() * 6.28;
        g.strokeStyle = grey(R() < 0.5 ? 176 + R() * 40 : 255, 0.5); g.lineWidth = 1 + R() * 1.2;
        g.beginPath(); g.arc(x, y, r, a, a + 2.4 + R() * 2.6); g.stroke();
      }
    } else if (kind === 'velvet') {                                   // velours : poil couché, reflets doux
      clouds(g, S, R, 26, 0.16, 120);
      for (let i = 0; i < 22000; i++) { g.fillStyle = grey(R() < 0.5 ? 120 : 255, R() * 0.16); g.fillRect(R() * S, R() * S, 1, 2 + R() * 3); }
    } else if (kind === 'leather') {                                  // cuir : grain en cellules
      clouds(g, S, R, 18, 0.1, 150);
      for (let i = 0; i < 9000; i++) { g.strokeStyle = grey(110, 0.1 + R() * 0.14); g.lineWidth = 0.8; g.beginPath(); g.ellipse(R() * S, R() * S, 2 + R() * 4, 1.6 + R() * 3, R() * 3, 0, 7); g.stroke(); }
    } else if (kind === 'rug') {                                      // tapis tissé : côtes et chiné
      for (let y = 0; y < S; y += 4) { g.fillStyle = grey(165 + R() * 90, 0.75); g.fillRect(0, y, S, 2.6); }
      for (let i = 0; i < 3600; i++) { g.fillStyle = grey(R() < 0.6 ? 110 : 255, R() * 0.3); g.fillRect(R() * S, R() * S, 5 + R() * 34, 1.6); }
    }
    speckle(g, S, R, 7000, 0.05, 1.6);
  });
}

/* Pied-de-poule (plaid du canapé). */
function houndstooth() {
  return canvas(256, (g, S) => {
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, S, S); g.fillStyle = '#4a4f58';
    const u = S / 16;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i + j) % 2 === 0) {
      const x = i * u, y = j * u;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + u, y); g.lineTo(x + u * 1.5, y - u / 2); g.lineTo(x + u * 1.5, y); g.lineTo(x + u, y + u / 2); g.lineTo(x + u, y + u); g.lineTo(x + u / 2, y + u * 1.5); g.lineTo(x, y + u * 1.5); g.lineTo(x + u / 2, y + u); g.lineTo(x, y + u); g.closePath(); g.fill();
    }
  });
}

/* Marbre : fond clair nuagé + veines ramifiées (grises et dorées pour le marbre blanc). */
function marble(base, veins, seed, n = 16, S = 1024) {
  return canvas(S, (g) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    clouds(g, S, R, 22, 0.08, S * 0.22);
    for (let i = 0; i < n; i++) {
      let x = R() * S, y = R() * S, a = R() * 6.28; const v = veins[(R() * veins.length) | 0], main = R() < 0.4;
      const pts = [[x, y]]; for (let k = 0; k < 30; k++) { a += (R() - 0.5) * 0.85; x += Math.cos(a) * S / 30; y += Math.sin(a) * S / 30; pts.push([x, y]); }
      for (const [w0, al] of main ? [[14, 0.07], [6, 0.16], [1.6, 0.6]] : [[5, 0.08], [1.1, 0.5]]) {
        g.strokeStyle = rgb(v[0], v[1], v[2], al * (0.6 + R() * 0.5)); g.lineWidth = w0 * (0.6 + R() * 0.8) * S / 1024; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
      }
      if (main) for (let b = 0; b < 3; b++) {                         // ramifications
        const p = pts[(R() * pts.length) | 0]; let bx = p[0], by = p[1], ba = a + (R() - 0.5) * 2.4;
        g.strokeStyle = rgb(v[0], v[1], v[2], 0.3); g.lineWidth = 0.9; g.beginPath(); g.moveTo(bx, by);
        for (let k = 0; k < 9; k++) { ba += (R() - 0.5) * 0.9; bx += Math.cos(ba) * S / 40; by += Math.sin(ba) * S / 40; g.lineTo(bx, by); } g.stroke();
      }
    }
    speckle(g, S, R, 4000, 0.025, 1.4);
  });
}

/* Mur en pierre sèche de Provence : assises irrégulières ; renvoie [couleur, relief]. */
function dryStoneSet(seed) {
  const S = 1024, B = canvas(S / 2, (g) => { g.fillStyle = '#202020'; g.fillRect(0, 0, S / 2, S / 2); }), gb = B.getContext('2d');
  const C = canvas(S, (g) => {
    const R = rng(seed);
    g.fillStyle = '#5f5242'; g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 44 + R() * 44; let x = -R() * 80;
      while (x < S) {
        const w = 66 + R() * 150, c = shade([206, 184, 148], 0.76 + R() * 0.36);
        g.fillStyle = rgb(c[0], c[1], c[2] - R() * 12);
        g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, 8 + R() * 8); g.fill();
        g.fillStyle = rgb(255, 248, 230, 0.12); g.fillRect(x + 7, y + 5, w - 14, 5);
        g.fillStyle = rgb(60, 44, 28, 0.16); g.fillRect(x + 6, y + h - 10, w - 12, 5);
        gb.fillStyle = grey(150 + R() * 100); gb.beginPath(); gb.roundRect((x + 4) / 2, (y + 4) / 2, (w - 8) / 2, (h - 8) / 2, 5); gb.fill();
        x += w;
      }
      y += h;
    }
    speckle(g, S, R, 14000, 0.08, 2.6);
  });
  return [C, B];
}

/* Tuiles canal : rangs ondulés terre cuite. */
function roofTiles(seed) {
  return canvas(512, (g, S) => {
    const R = rng(seed), cols = 12, rows = 8, cw = S / cols, rh = S / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const col = shade([196, 124, 86], 0.8 + R() * 0.38);
      const gr = g.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
      gr.addColorStop(0, rgb(...shade(col, 0.62))); gr.addColorStop(0.5, rgb(...col)); gr.addColorStop(1, rgb(...shade(col, 0.66)));
      g.fillStyle = gr; g.fillRect(c * cw, r * rh, cw, rh);
      g.fillStyle = rgb(60, 30, 18, 0.35); g.fillRect(c * cw, (r + 1) * rh - 3, cw, 3);
    }
    speckle(g, S, R, 5000, 0.06, 2);
  });
}

/* Végétal en aplat : gazon (brins) et masses de feuillage. */
function foliage(base, seed, { blades = false, S = 1024 } = {}) {
  return canvas(S, (g) => {
    const R = rng(seed);
    g.fillStyle = rgb(...shade(base, 0.72)); g.fillRect(0, 0, S, S);
    clouds(g, S, R, 26, 0.12, S * 0.2);
    for (let i = 0; i < (blades ? 52000 : 16000); i++) {
      const c = shade(base, 0.55 + R() * 0.85);
      g.fillStyle = rgb(c[0] + R() * 20, c[1] + R() * 14, c[2], 0.55);
      if (blades) { const x = R() * S, y = R() * S; g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.9); g.fillRect(0, 0, 1 + R() * 0.8, 3 + R() * 7); g.restore(); }
      else { g.beginPath(); g.ellipse(R() * S, R() * S, 3 + R() * 7, 1.6 + R() * 3.6, R() * 3.2, 0, 7); g.fill(); }
    }
  });
}

/* Touffe de feuilles sur fond transparent : plaquée sur de petites cartes pour donner un vrai feuillage aux arbres et aux plantes. */
function leafCard(base, seed, { n = 46, len = 0.2, wid = 0.045, needles = false } = {}) {
  return canvas(256, (g, S) => {
    const R = rng(seed); g.clearRect(0, 0, S, S);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = R() * S * 0.3, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, l = S * len * (0.6 + R() * 0.7), w = S * wid * (0.6 + R() * 0.7);
      const c = shade(base, 0.6 + R() * 0.75);
      g.save(); g.translate(x, y); g.rotate(a + (R() - 0.5) * 1.3);
      g.fillStyle = rgb(c[0] + R() * 14, c[1] + R() * 10, c[2]);
      if (needles) { for (let k = 0; k < 9; k++) { g.rotate(0.14); g.fillRect(0, -0.8, l, 1.6); } }
      else { g.beginPath(); g.ellipse(l / 2, 0, l / 2, w / 2, 0, 0, 7); g.fill(); g.strokeStyle = rgb(...shade(c, 0.7), 0.6); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(l, 0); g.stroke(); }
      g.restore();
    }
  }, true);
}

/* Eau du bassin. */
function waterTex(seed) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = '#2f9bb0'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 130; i++) {
      g.strokeStyle = rgb(210, 250, 255, 0.10 + R() * 0.16); g.lineWidth = 1 + R() * 2.5;
      const x = R() * S, y = R() * S;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 16 + R() * 32, x + 60, y - 16 + R() * 32, x + 90, y + (R() - 0.5) * 20); g.stroke();
    }
  });
}

/* Toiles abstraites dans l'esprit des tableaux des images du graphiste : ors, ocres, terracotta, formes minérales. */
function painting(seed, kind) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    if (kind === 'gold') {                                            // coulées verticales or et ocre sur fond blanc
      g.fillStyle = '#f3efe6'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 90; i++) {
        const x = S * (0.25 + R() * 0.5) + (R() - 0.5) * S * 0.3, y = S * (0.08 + R() * 0.5), w = 6 + R() * 46, h = S * (0.15 + R() * 0.5);
        const gd = g.createLinearGradient(0, y, 0, y + h); const c = [['#c8923a', '#e8c98a'], ['#b06a32', '#e2b071'], ['#8a5a34', '#c9a06a'], ['#e9dcc2', '#f5eede']][(R() * 4) | 0];
        gd.addColorStop(0, c[0]); gd.addColorStop(1, c[1]); g.globalAlpha = 0.25 + R() * 0.5; g.fillStyle = gd; g.fillRect(x, y, w, h);
      }
      g.globalAlpha = 1;
    } else if (kind === 'forms') {                                    // formes organiques cernées d'or
      g.fillStyle = '#ece5d8'; g.fillRect(0, 0, S, S);
      const pal = ['#c9a25e', '#8a5a44', '#e8dcc6', '#b86248', '#d9c7a6', '#6f4a3c', '#f4eee2'];
      for (let i = 0; i < 9; i++) {
        const x = S * (0.15 + R() * 0.7), y = S * (0.12 + R() * 0.76), r = S * (0.09 + R() * 0.17);
        g.fillStyle = pal[(R() * pal.length) | 0]; g.globalAlpha = 0.78;
        g.beginPath(); for (let k = 0; k <= 12; k++) { const a = (k / 12) * 6.283, rr = r * (0.72 + R() * 0.5); g.lineTo(x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr); } g.closePath(); g.fill();
        g.globalAlpha = 1; g.strokeStyle = '#c9a25e'; g.lineWidth = 2.2; g.stroke();
      }
    } else if (kind === 'stone') {                                    // panneau minéral beige (chambre)
      g.fillStyle = '#e3d3bc'; g.fillRect(0, 0, S, S); clouds(g, S, R, 30, 0.14, 190);
      for (let i = 0; i < 7; i++) { let x = R() * S, y = R() * S, a = R() * 6.28; g.strokeStyle = rgb(150, 116, 84, 0.3 + R() * 0.3); g.lineWidth = 0.8 + R() * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 22; k++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 26; y += Math.sin(a) * 26; g.lineTo(x, y); } g.stroke(); }
    } else {                                                          // paysage : la Sainte-Victoire en aplats
      const sky = g.createLinearGradient(0, 0, 0, S * 0.6); sky.addColorStop(0, '#e9dfcc'); sky.addColorStop(1, '#f3e7d2'); g.fillStyle = sky; g.fillRect(0, 0, S, S);
      g.fillStyle = '#c9c0bd'; g.beginPath(); g.moveTo(0, S * 0.5); g.lineTo(S * 0.28, S * 0.36); g.lineTo(S * 0.5, S * 0.2); g.lineTo(S * 0.6, S * 0.27); g.lineTo(S, S * 0.46); g.lineTo(S, S * 0.6); g.lineTo(0, S * 0.6); g.fill();
      for (let i = 0; i < 60; i++) { g.fillStyle = ['#b86248', '#c98a52', '#7b8a54', '#d9b98a', '#8a5a44'][(R() * 5) | 0]; g.globalAlpha = 0.35 + R() * 0.45; g.beginPath(); g.ellipse(R() * S, S * (0.56 + R() * 0.42), 20 + R() * 80, 8 + R() * 26, (R() - 0.5) * 0.6, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    }
    speckle(g, S, R, 5000, 0.04, 2);
  });
}

/* Couverture de magazine posée sur la table basse. */
function magazine(seed) {
  return canvas(256, (g, S) => {
    const R = rng(seed); g.fillStyle = '#1d1c1e'; g.fillRect(0, 0, S, S);
    const gd = g.createRadialGradient(S * 0.55, S * 0.45, 10, S * 0.55, S * 0.5, S * 0.6); gd.addColorStop(0, '#c9a98c'); gd.addColorStop(1, '#2a2526'); g.fillStyle = gd; g.fillRect(0, 0, S, S);
    g.fillStyle = '#f4efe6'; g.font = '700 54px Georgia, serif'; g.fillText('MAISON', 14, 62);
    g.font = '600 15px Georgia, serif'; for (let i = 0; i < 4; i++) g.fillText(['AIX-EN-PROVENCE', 'LUMIÈRE', 'MATIÈRES', 'JARDINS'][i], 16, 150 + i * 24 + R() * 4);
  });
}

function std(o) { const u = o.userData; delete o.userData; const m = new THREE.MeshStandardMaterial(o); if (u) m.userData = u; return m; }
function phys(o) { const u = o.userData; delete o.userData; const m = new THREE.MeshPhysicalMaterial(o); if (u) m.userData = u; return m; }

export function makeMaterials(quality) {
  const A = quality.aniso, FS = quality.tex || 1024;
  const T = (c, o) => tex(c, { aniso: A, ...o }), L = (c) => tex(c, { aniso: A, srgb: false });
  const M = {};

  // ── Sols : quatre finitions pour les pièces de vie (la carte de couleur des finitions non choisies n'est dessinée qu'à la demande)
  const oak = parquetSet([166, 106, 60], 11, FS), oakBump = L(oak.bump), oakRough = L(oak.rough);
  const floorDefs = {
    floorOak: () => ({ map: T(oak.map), bumpMap: oakBump, roughnessMap: oakRough, roughness: 0.92, bumpScale: 0.55 }),
    floorOakLight: () => ({ map: T(parquetSet([208, 178, 138], 12, FS).map), bumpMap: oakBump, roughnessMap: oakRough, roughness: 0.85, bumpScale: 0.55 }),
    floorOakDark: () => ({ map: T(parquetSet([112, 78, 54], 13, FS).map), bumpMap: oakBump, roughnessMap: oakRough, roughness: 0.7, bumpScale: 0.55 }),
    floorStone: () => ({ map: T(stoneTiles([222, 210, 190], 14, 3, { ny: 6, veins: 0.8, shift: 0.5 })), bumpMap: null, roughnessMap: null, roughness: 0.42, bumpScale: 0 }),
  };
  M.floorCache = {};
  M.floorDef = (id) => M.floorCache[id] || (M.floorCache[id] = floorDefs[id]());
  M.floor = std({ ...M.floorDef('floorOak'), metalness: 0, envMapIntensity: 1.15, userData: { wuv: 3.24, cast: false } });   // matériau courant des pièces de vie
  M.tile = std({ map: T(stoneTiles([214, 208, 198], 15, 2, { ny: 4, veins: 0.5, joint: 2.5, jointCol: [176, 170, 162], shift: 0.5 })), roughness: 0.3, userData: { wuv: 2.4, cast: false } });   // grès 60 × 120
  M.terrace = std({ map: T(stoneTiles([224, 208, 178], 16, 4, { veins: 1.1, joint: 4 })), roughness: 0.82, userData: { wuv: 2.4 } });
  M.concrete = std({ color: 0x8f8a84, roughness: 0.9 });
  M.socle = std({ color: 0xd8d0c2, roughness: 0.9 });
  M.wallCut = std({ color: 0xdcd6cb, roughness: 1 });               // tranche des murs coupés               // socle de la maquette

  // ── Murs et plafonds
  M.plaster = std({ map: T(plain([247, 244, 238], 21, { grain: 0.018, cloud: 0.02 })), roughness: 0.94, userData: { wuv: 3 } });
  M.ceiling = std({ color: 0xfcfbf8, roughness: 0.97, userData: { cast: true } });
  M.skirt = std({ color: 0xf6f4ef, roughness: 0.5 });                // plinthes et chambranles laqués
  M.stucco = std({ map: T(plain([226, 210, 182], 22, { grain: 0.07, cloud: 0.06 })), roughness: 0.95, userData: { wuv: 2.5 } });
  M.stuccoDark = std({ color: 0xb9a584, roughness: 0.95 });
  M.massing = std({ color: 0xe2d8c6, roughness: 0.95 });            // volumes de contexte, traités en maquette claire
  M.wallTile = std({ map: T(stoneTiles([234, 228, 216], 23, 2, { ny: 1, veins: 0.7, joint: 2, jointCol: [200, 194, 184] })), roughness: 0.28, userData: { wuv: 2.4 } });
  const [dsC, dsB] = dryStoneSet(24);
  M.stone = std({ map: T(dsC), bumpMap: L(dsB), bumpScale: 3, roughness: 0.95, userData: { wuv: 2.2 } });
  M.roof = std({ map: T(roofTiles(25)), roughness: 0.85, userData: { wuv: 1.6 } });

  // ── Menuiseries et métaux
  M.frame = std({ color: 0x2c2d30, roughness: 0.55, metalness: 0.4 });   // aluminium anthracite
  M.steel = std({ color: 0xb9b6b0, roughness: 0.4, metalness: 0.85 });
  M.brass = std({ color: 0xd2ab66, roughness: 0.3, metalness: 1 });      // laiton brossé (lustres, piètements)
  M.black = std({ color: 0x1b1a1a, roughness: 0.48, metalness: 0.35 });
  M.glass = phys({ color: 0xcfe0e2, roughness: 0.42, specularIntensity: 0.3, metalness: 0, transparent: true, opacity: 0.07, envMapIntensity: 0.55, depthWrite: false, userData: { cast: false, receive: false, order: 5 } });
  M.glassFrost = phys({ color: 0xf2f6f6, roughness: 0.25, transparent: true, opacity: 0.28, depthWrite: false, userData: { cast: false, receive: false, order: 5 } });
  M.glassSmoke = phys({ color: 0x1a1b1e, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.3, userData: { cast: true } });   // plateau en verre fumé
  M.crystal = phys({ color: 0xffffff, roughness: 0.3, specularIntensity: 0.4, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false, userData: { cast: false, receive: false, order: 6 } });
  M.mirror = std({ color: 0xf4f6f6, roughness: 0.05, metalness: 1 });
  const [okC, okB] = woodSet([204, 162, 112], 32, 0.12), [wnC, wnB] = woodSet([98, 66, 44], 33, 0.16), [slC, slB] = woodSet([150, 108, 70], 31, 0.18, 512);
  const okBump = L(okB), wnBump = L(wnB);
  M.door = std({ map: T(okC), bumpMap: okBump, bumpScale: 0.5, roughness: 0.5, userData: { wuv: 1.3, wuvSwap: true } });   // portes plaquées chêne
  M.slat = std({ map: T(slC), bumpMap: L(slB), bumpScale: 0.6, roughness: 0.7, userData: { wuv: 1.2, wuvSwap: true } });

  // ── Mobilier : bois, laques, pierres
  M.oak = std({ map: T(okC), bumpMap: okBump, bumpScale: 0.5, roughness: 0.5, userData: { wuv: 1.3 } });
  M.oakV = std({ map: M.oak.map, bumpMap: okBump, bumpScale: 0.5, roughness: 0.5, userData: { wuv: 1.3, wuvSwap: true } });   // fil vertical (façades)
  M.walnut = std({ map: T(wnC), bumpMap: wnBump, bumpScale: 0.5, roughness: 0.46, userData: { wuv: 1.3 } });
  M.lacquer = std({ color: 0xf2efe9, roughness: 0.32 });
  M.seam = std({ color: 0x4d4038, roughness: 0.85 });                 // joints entre façades
  M.anthracite = std({ color: 0x3a3d42, roughness: 0.62 });           // laque mate de la cuisine
  M.greyLacquer = std({ color: 0x8b8b88, roughness: 0.5 });           // meubles du mur TV
  M.navy = std({ color: 0x38465a, roughness: 0.5 });
  M.marble = std({ map: T(marble([242, 239, 234], [[122, 118, 116], [176, 142, 96], [150, 146, 142]], 34, 15)), roughness: 0.16, envMapIntensity: 1.2, userData: { wuv: 1.9 } });
  M.marbleDark = std({ map: T(marble([30, 29, 31], [[210, 200, 186], [150, 130, 100]], 35, 10)), roughness: 0.3, userData: { wuv: 1.6 } });
  M.marbleGrey = std({ map: T(marble([186, 184, 182], [[242, 240, 236], [110, 108, 108]], 36, 18)), roughness: 0.2, envMapIntensity: 1.2, userData: { wuv: 1.7 } });

  // ── Tissus et cuirs : une trame partagée (couleur × teinte, et relief)
  const W = {}; for (const [k, s] of [['linen', 61], ['boucle', 62], ['velvet', 63], ['leather', 64], ['rug', 65]]) { const c = weave(s, k); W[k] = [T(c), L(c)]; }
  const fab = (color, kind, rough, o = {}) => std({ color, map: W[kind][0], bumpMap: W[kind][1], bumpScale: o.bump || 1.4, roughness: rough, userData: { wuv: o.wuv || 0.5 } });
  M.linen = fab(0xefe9dd, 'linen', 0.96);                             // lin écru
  M.greige = fab(0xb7ab9c, 'velvet', 0.9);                            // velours taupe (chaises du duplex)
  M.taupe = fab(0xa59889, 'linen', 0.97, { wuv: 0.35 });              // rideaux
  M.sheer = std({ color: 0xfbf7ee, roughness: 1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, userData: { cast: false, order: 4 } });   // voilages
  M.cream = fab(0xf4eee2, 'linen', 0.97);
  M.boucle = fab(0xe3e1dc, 'boucle', 0.98, { bump: 2.2, wuv: 0.42 }); // bouclette gris clair du canapé
  M.sand = fab(0xdccdb6, 'boucle', 0.98, { bump: 1.8, wuv: 0.42 });   // tête de lit, banquette
  M.terra = phys({ color: 0xb4674c, map: W.velvet[0], bumpMap: W.velvet[1], bumpScale: 0.9, roughness: 0.78, sheen: 0.6, sheenRoughness: 0.5, sheenColor: 0xe6a184, userData: { wuv: 0.5 } });   // velours terracotta
  M.cognac = std({ color: 0xb06a3c, map: W.leather[0], bumpMap: W.leather[1], bumpScale: 0.8, roughness: 0.52, userData: { wuv: 0.45 } });   // cuir cognac
  M.sage = fab(0x8f9a78, 'linen', 0.95);
  M.ochre = fab(0xc9954f, 'velvet', 0.9);
  M.charcoal = fab(0x55545a, 'linen', 0.95);
  M.throw = std({ map: T(houndstooth()), roughness: 0.98, userData: { wuv: 0.34 } });
  M.white = std({ color: 0xffffff, roughness: 0.4 });
  M.ceramic = std({ color: 0xfbfbf9, roughness: 0.1, envMapIntensity: 1.2 });
  M.tubIn = std({ color: 0xe6eaea, roughness: 0.14 });
  M.rug = std({ color: 0xd9ccb8, map: W.rug[0], bumpMap: W.rug[1], bumpScale: 2.4, roughness: 1, userData: { wuv: 0.9, cast: false } });
  M.rugDark = std({ color: 0x716d6b, map: W.rug[0], bumpMap: W.rug[1], bumpScale: 2.4, roughness: 1, userData: { wuv: 0.9, cast: false } });
  M.screen = std({ color: 0x0b0c0f, roughness: 0.18, metalness: 0.4, envMapIntensity: 1.4 });
  M.art1 = std({ map: T(painting(41, 'gold')), roughness: 0.85 });
  M.art2 = std({ map: T(painting(42, 'forms')), roughness: 0.85 });
  M.art3 = std({ map: T(painting(43, 'stone')), roughness: 0.6 });
  M.art4 = std({ map: T(painting(44, 'land')), roughness: 0.85 });
  M.paper = std({ map: T(magazine(45)), roughness: 0.4 });
  M.pot = std({ color: 0xe4d9c6, roughness: 0.8 });                   // céramique sable
  M.potDark = std({ color: 0x232325, roughness: 0.35 });
  M.rattan = std({ map: T(slC), roughness: 0.8, userData: { wuv: 0.5 } });
  M.teak = std({ map: T(wnC), color: 0xd9b48a, roughness: 0.7, userData: { wuv: 1.2 } });   // bois des bains de soleil
  for (const k of ['tile', 'rug', 'rugDark']) Object.assign(M[k], { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // ── Lumières (émissifs : rubans LED et lustres restent allumés en journée, comme sur les images ; les abat-jour s'allument le soir)
  M.lampShade = std({ color: 0xf6ecd8, roughness: 0.9, emissive: 0xffd9a0, emissiveIntensity: 0, userData: { cast: false } });
  M.led = std({ color: 0xfff1d6, roughness: 0.6, emissive: 0xffdfae, emissiveIntensity: 0.9, userData: { cast: false } });
  M.liftLight = std({ color: 0xfff6e6, roughness: 0.6, emissive: 0xfff0d8, emissiveIntensity: 2.2, userData: { cast: false } });
  // nappe de lumière d'un ruban LED sur le mur (dégradé additif, du haut vers le bas)
  M.glow = new THREE.MeshBasicMaterial({ map: T(canvas(64, (g, S) => { const gd = g.createLinearGradient(0, 0, 0, S); gd.addColorStop(0, '#ffd08a'); gd.addColorStop(0.35, '#7a5a30'); gd.addColorStop(1, '#000'); g.fillStyle = gd; g.fillRect(0, 0, S, S); })), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  M.glow.userData = { cast: false, receive: false, order: 3 };

  // ── Extérieur
  M.grass = std({ map: T(foliage([104, 140, 62], 51, { blades: true })), roughness: 1, userData: { wuv: 2.2, cast: false } });
  M.hedge = std({ map: T(foliage([62, 98, 50], 52)), roughness: 1, userData: { wuv: 1.3 } });
  const card = (c, o) => std({ map: T(c), alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.95, ...o });      // bords de feuilles lissés par l'anticrénelage
  M.leafOlive = card(leafCard([122, 146, 98], 53, { n: 60, len: 0.2, wid: 0.04 }));
  M.leafPine = card(leafCard([70, 110, 62], 54, { n: 26, len: 0.3, needles: true }));
  M.leafBroad = card(leafCard([78, 122, 62], 55, { n: 34, len: 0.26, wid: 0.11 }));     // plantes d'intérieur, lauriers
  M.leafCypress = std({ map: T(foliage([46, 78, 48], 56, { S: 512 })), roughness: 1, userData: { wuv: 1.1 } });
  M.lavender = std({ color: 0x8a7bc0, roughness: 1 });
  M.oleander = std({ color: 0xe07a94, roughness: 1 });
  M.pampas = std({ color: 0xe6d6b8, roughness: 1 });
  M.bark = std({ color: 0x6f5a48, roughness: 1 });
  M.earth = std({ map: T(foliage([120, 128, 84], 57, { S: 512 })), roughness: 1, userData: { wuv: 6, cast: false } });
  M.water = phys({ map: T(waterTex(58)), roughness: 0.06, metalness: 0, transparent: true, opacity: 0.9, envMapIntensity: 1.4, userData: { wuv: 3, cast: false } });
  M.road = std({ color: 0x77736e, roughness: 0.95, userData: { cast: false } });
  return M;
}

/* Finitions de sol proposées dans la visite. */
export const FLOOR_FINISHES = [
  { id: 'floorOak', fr: 'Chêne miel', en: 'Honey oak', sw: '#b87e4c' },
  { id: 'floorOakLight', fr: 'Chêne clair', en: 'Light oak', sw: '#d0b28a' },
  { id: 'floorOakDark', fr: 'Chêne fumé', en: 'Smoked oak', sw: '#704e36' },
  { id: 'floorStone', fr: 'Pierre claire', en: 'Light stone', sw: '#e2d4bc' },
];
export function setFloorFinish(M, id) {
  if (!FLOOR_FINISHES.some((f) => f.id === id)) return;
  Object.assign(M.floor, M.floorDef(id)); M.floor.needsUpdate = true;
}
