/* 59 Cézanne — visite 3D : matériaux et textures procédurales (dessinées sur canvas au chargement, aucun fichier image à télécharger).
   Direction artistique reprise des images du graphiste : parquet chêne miel satiné, murs blancs, menuiseries anthracite,
   cuisine anthracite et chêne clair, velours terracotta, bouclé gris, cuir cognac, marbre blanc veiné, laiton brossé, lin taupe.

   Les cartes de relief et de rugosité sont regroupées dans une seule texture linéaire (rouge : relief, vert : rugosité) :
   une seule image à envoyer au processeur graphique au lieu de deux, et des joints qui restent alignés avec la couleur. */
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
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = (t) => t * t * (3 - 2 * t);
function shade([r, g, b], k) { return [Math.max(0, Math.min(255, r * k)), Math.max(0, Math.min(255, g * k)), Math.max(0, Math.min(255, b * k))]; }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ── Bruits ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

/* Bruit de valeur périodique (il se raccorde de lui-même) en plusieurs octaves : Float32Array S×S dans [0, 1].
   cx, cy : nombre de cellules par côté à la première octave (inégaux : motif étiré, comme les bandes d'un travertin). */
function field(S, cx, cy, oct, seed, gain = 0.5) {
  const out = new Float32Array(S * S), R = rng(seed), xi = new Int32Array(S), xj = new Int32Array(S), xt = new Float32Array(S);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const nx = cx << o, ny = cy << o, L = new Float32Array(nx * ny);
    for (let i = 0; i < L.length; i++) L[i] = R();
    for (let x = 0; x < S; x++) { const fx = x / S * nx, x0 = Math.floor(fx); xi[x] = x0 % nx; xj[x] = (x0 + 1) % nx; xt[x] = smooth(fx - x0); }
    for (let y = 0; y < S; y++) {
      const fy = y / S * ny, y0 = Math.floor(fy), r0 = (y0 % ny) * nx, r1 = ((y0 + 1) % ny) * nx, ty = smooth(fy - y0), row = y * S;
      for (let x = 0; x < S; x++) {
        const t = xt[x], a0 = L[r0 + xi[x]], b0 = L[r1 + xi[x]];
        const a = a0 + (L[r0 + xj[x]] - a0) * t, b = b0 + (L[r1 + xj[x]] - b0) * t;
        out[row + x] += (a + (b - a) * ty) * amp;
      }
    }
    tot += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
/* Peint un canvas S×S pixel par pixel : fn(i, d, p) écrit d[p..p+2] (i : indice du pixel). */
function paint(S, fn) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { alpha: false }), im = g.createImageData(S, S), d = im.data;
  for (let i = 0, p = 0, n = S * S; i < n; i++, p += 4) { fn(i, d, p); d[p + 3] = 255; }
  g.putImageData(im, 0, 0);
  return c;
}
/* Nuance de gris à partir d'un champ de bruit (contraste c autour du gris moyen) : sert de calque de fusion. */
const noiseCache = new Map();
function noiseCanvas(S, cx, cy, oct, seed, c = 2.2) {
  const key = [S, cx, cy, oct, seed, c].join(); let n = noiseCache.get(key);
  if (!n) { const f = field(S, cx, cy, oct, seed); n = paint(S, (i, d, p) => { d[p] = d[p + 1] = d[p + 2] = 128 + (f[i] - 0.5) * 255 * c; }); noiseCache.set(key, n); }
  return n;
}
function lay(g, S, c, alpha, mode = 'soft-light') {
  g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = mode; g.drawImage(c, 0, 0, S, S); g.restore();
}
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
/* Regroupe relief (rouge) et rugosité (vert) dans une seule image : B et Q sont des canvas en niveaux de gris, Q peut être plus petit. */
function pack(B, Q) {
  const S = B.width, gb = B.getContext('2d');
  gb.globalCompositeOperation = 'multiply'; gb.fillStyle = '#ff0000'; gb.fillRect(0, 0, S, S);
  const O = canvas(S, (g) => { g.drawImage(Q, 0, 0, S, S); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#00ff00'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'lighter'; g.drawImage(B, 0, 0); });
  return O;
}
const flat = (S, v) => canvas(S, (g, s) => { g.fillStyle = grey(v); g.fillRect(0, 0, s, s); });

/* ── Bois ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

/* Fil du bois dans le rectangle (x, y, w, h), tracé dans la carte de couleur gc et, plus discrètement, dans celle de relief gb.
   Les lignes s'écartent autour d'une « cathédrale » (tangente au cœur de la planche) et des nœuds, comme un vrai débit sur dosse.
   u : échelle de finesse (1 = 316 px par mètre). */
function grain(gc, gb, R, x, y, w, h, { u = 1, dark = 1, lines, cath = 1, knots = [], per = w, wrapY = 0, wav = h * 0.035 } = {}) {
  const nl = lines || Math.round(h / (1.5 * u)), step = Math.max(8, 20 * u), n = Math.ceil(w / step) + 2;
  const cx = x + w * (0.2 + R() * 0.6), cy = y + h * (0.2 + R() * 0.6), wc = w * (0.1 + R() * 0.2), sc = (R() - 0.5) * 1.5 * cath;
  const k1 = 1 + ((R() * 3) | 0), k2 = 2 + ((R() * 4) | 0), p1 = R() * 6.28, p2 = R() * 6.28;
  for (let i = 0; i < nl; i++) {
    const yy = y + R() * h, dk = R() < 0.62, a = (0.04 + R() * 0.12) * dark, lw = (0.5 + R() * 1.6) * u, ph = R() * 6.28, am = wav * R();
    const pts = [];
    for (let t = 0; t < n; t++) {
      const xx = x - step + t * step;
      let dy = am * Math.sin(6.2832 * k1 * (xx - x) / per + p1) + am * 0.6 * Math.sin(6.2832 * k2 * (xx - x) / per + p2 + ph);
      dy += sc * (yy - cy) * Math.exp(-(((xx - cx) / wc) ** 2));
      for (const [kx, ky, kr] of knots) dy += (yy >= ky ? 1 : -1) * kr * 1.9 * Math.exp(-(((xx - kx) / (kr * 3.6)) ** 2)) * Math.exp(-(((yy - ky) / (kr * 2.4)) ** 2));
      pts.push(xx, yy + dy);
    }
    for (const off of wrapY ? [0, wrapY, -wrapY] : [0]) {
      if (off && (yy + off < -h * 0.1 || yy + off > y + h + h * 0.1)) continue;
      const col = dk ? rgb(70, 36, 14, a) : rgb(255, 228, 184, a * 0.75);
      gc.strokeStyle = col; gc.lineWidth = lw; gc.beginPath();
      for (let t = 0; t < n; t++) { if (t) gc.lineTo(pts[2 * t], pts[2 * t + 1] + off); else gc.moveTo(pts[0], pts[1] + off); } gc.stroke();
      if (gb && a > 0.06) { gb.strokeStyle = dk ? grey(50, a * 1.5) : grey(215, a); gb.lineWidth = Math.max(0.7, lw * 0.8); gb.beginPath(); for (let t = 0; t < n; t++) { if (t) gb.lineTo(pts[2 * t], pts[2 * t + 1] + off); else gb.moveTo(pts[0], pts[1] + off); } gb.stroke(); }
    }
  }
}
/* Pores du chêne : petits traits sombres dans le sens du fil. */
function pores(g, R, x, y, w, h, u, a = 0.16) {
  const n = Math.round(w * h / (150 * u * u));
  for (let i = 0; i < n; i++) { g.fillStyle = rgb(60, 30, 10, 0.05 + R() * a); g.fillRect(x + R() * w, y + R() * h, (1.2 + R() * 3.5) * u, Math.max(0.6, (0.4 + R() * 0.4) * u)); }
}
/* Nœud : anneaux concentriques, étirés dans le sens du fil. */
function knot(g, kx, ky, kr, u) {
  const gr = g.createRadialGradient(kx, ky, kr * 0.2, kx, ky, kr * 3.2); gr.addColorStop(0, rgb(60, 30, 12, 0.34)); gr.addColorStop(1, rgb(60, 30, 12, 0));
  g.save(); g.translate(kx, ky); g.scale(2.4, 1); g.translate(-kx, -ky); g.fillStyle = gr; g.beginPath(); g.arc(kx, ky, kr * 3.2, 0, 7); g.fill(); g.restore();
  for (let j = 5; j > 0; j--) { g.strokeStyle = rgb(58, 30, 12, 0.12 + j * 0.035); g.lineWidth = Math.max(0.7, u); g.beginPath(); g.ellipse(kx, ky, kr * j * 0.72, kr * j * 0.34, 0, 0, 7); g.stroke(); }
  g.fillStyle = rgb(44, 22, 8, 0.7); g.beginPath(); g.ellipse(kx, ky, kr * 0.55, kr * 0.28, 0, 0, 7); g.fill();
}

/* Parquet : lames de 18 cm posées à joints décalés, sur un carreau de 6,48 m (36 rangs) pour que le motif ne se répète pas à l'échelle d'une pièce.
   Toute la disposition (longueurs, fil, nœuds) vient d'une seule graine : les finitions ne diffèrent que par la teinte et gardent les mêmes joints.
   Renvoie la couleur et, si full, la carte relief + rugosité (rouge, vert). */
function parquetSet(base, S, { plank = 0.18, tile = 6.48, vary = 0.1, seed = 11, full = true } = {}) {
  const pm = S / tile, u = pm / 316, rows = Math.round(tile / plank), ph = S / rows, jw = Math.max(1.3, 1.25 * u), q = 0.25;
  const C = canvas(S, () => { }), gc = C.getContext('2d');
  const B = full && canvas(S, (g) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, S, S); }), gb = full && B.getContext('2d');
  const Q = full && flat(S >> 2, 112), gq = full && Q.getContext('2d');
  const R = rng(seed);
  const drawPlank = (x, y0, len, p) => {
    const R2 = rng(p.seed), c = shade(base, p.tone), w = p.warm, c0 = [c[0] + w, c[1] + w * 0.3, c[2] - w * 0.5];
    gc.save(); gc.beginPath(); gc.rect(x, y0, len, ph); gc.clip();
    const gd = gc.createLinearGradient(x, 0, x + len, 0); gd.addColorStop(0, rgb(...shade(c0, 1 + p.g0))); gd.addColorStop(1, rgb(...shade(c0, 1 + p.g1)));
    gc.fillStyle = gd; gc.fillRect(x, y0, len, ph);
    const gv = gc.createLinearGradient(0, y0, 0, y0 + ph); gv.addColorStop(0, rgb(255, 226, 180, p.sap)); gv.addColorStop(0.5, rgb(255, 226, 180, 0)); gv.addColorStop(1, rgb(60, 30, 10, p.sap * 0.6));
    gc.fillStyle = gv; gc.fillRect(x, y0, len, ph);
    for (let i = 0; i < 4; i++) { gc.strokeStyle = R2() < 0.5 ? rgb(70, 36, 14, 0.04) : rgb(255, 230, 190, 0.05); gc.lineWidth = (4 + R2() * 10) * u; const yy = y0 + R2() * ph; gc.beginPath(); gc.moveTo(x, yy); gc.bezierCurveTo(x + len * 0.3, yy + (R2() - 0.5) * ph * 0.4, x + len * 0.7, yy + (R2() - 0.5) * ph * 0.4, x + len, yy); gc.stroke(); }
    const kn = R2() < 0.12 ? [[x + len * (0.15 + R2() * 0.7), y0 + ph * (0.3 + R2() * 0.4), ph * (0.06 + R2() * 0.07)]] : [];
    if (full) { gb.save(); gb.beginPath(); gb.rect(x, y0, len, ph); gb.clip(); gb.fillStyle = grey(p.h); gb.fillRect(x, y0, len, ph); gq.fillStyle = grey(p.r); gq.fillRect(x * q, y0 * q, len * q, ph * q); }
    grain(gc, full && gb, R2, x, y0, len, ph, { u, knots: kn, per: len });
    pores(gc, R2, x, y0, len, ph, u);
    for (const [kx, ky, kr] of kn) { knot(gc, kx, ky, kr, u); if (full) { gb.fillStyle = grey(70, 0.5); gb.beginPath(); gb.ellipse(kx, ky, kr * 0.9, kr * 0.45, 0, 0, 7); gb.fill(); } }
    gc.restore(); if (full) gb.restore();
    // joint bout à bout : fente sombre, arête vive éclairée sur la lame suivante
    gc.fillStyle = rgb(30, 15, 6, 0.6); gc.fillRect(x + len - jw, y0, jw, ph);
    gc.fillStyle = rgb(30, 15, 6, 0.1); gc.fillRect(x + len - jw * 3, y0, jw * 2, ph);
    gc.fillStyle = rgb(255, 232, 196, 0.2); gc.fillRect(x, y0, Math.max(1, u), ph);
    if (full) { gb.fillStyle = grey(96); gb.fillRect(x + len - jw * 2.2, y0, jw * 1.2, ph); gb.fillStyle = grey(22); gb.fillRect(x + len - jw, y0, jw, ph); gq.fillStyle = grey(210); gq.fillRect((x + len - jw) * q, y0 * q, Math.max(1, jw * q), ph * q); }
  };
  for (let r = 0; r < rows; r++) {
    const y0 = r * ph, lens = []; let sum = 0;
    while (sum < S - pm * 0.4) { const l = pm * (0.9 + R() * 1.5); lens.push(l); sum += l; }
    const kk = S / sum, ox = R() * S; let cum = 0;
    for (const l0 of lens) {
      const len = l0 * kk, p = { seed: (R() * 4294967296) >>> 0, tone: 1 - vary / 2 + R() * vary, warm: (R() - 0.5) * 8, g0: (R() - 0.5) * 0.06, g1: (R() - 0.5) * 0.06, sap: R() * 0.06, h: 122 + R() * 14, r: 255 * (0.35 + R() * 0.14) };
      const x = (ox + cum) % S; cum += len;
      drawPlank(x, y0, len, p); if (x + len > S) drawPlank(x - S, y0, len, p);
    }
    gc.fillStyle = rgb(30, 15, 6, 0.55); gc.fillRect(0, y0 + ph - jw, S, jw);
    gc.fillStyle = rgb(255, 232, 196, 0.16); gc.fillRect(0, y0, S, Math.max(1, u));
    if (full) { gb.fillStyle = grey(96); gb.fillRect(0, y0 + ph - jw * 2.2, S, jw * 1.2); gb.fillStyle = grey(22); gb.fillRect(0, y0 + ph - jw, S, jw); gq.fillStyle = grey(210); gq.fillRect(0, (y0 + ph - jw) * q, S * q, Math.max(1, jw * q)); }
  }
  lay(gc, S, noiseCanvas(512, 6, 6, 4, 71, 1.6), 0.22);                 // marbrures douces, légères différences de teinte sur plusieurs mètres
  speckle(gc, S, R, S * 3, 0.03, 1.5 * u);
  if (!full) return { map: C };
  lay(gq, S >> 2, noiseCanvas(256, 4, 4, 4, 72, 1.6), 0.3);           // zones d'usure : le vernis se ternit par plages
  return { map: C, pk: pack(B, Q) };
}

/* Bois de mobilier : fil continu, sans joints, tuilable. Renvoie [couleur, relief + rugosité]. */
function woodSet(base, seed, dark = 0.1, S = 1024) {
  const R = rng(seed), u = S / 1024 * 2.4;
  const B = canvas(S, (g) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, S, S); }), gb = B.getContext('2d');
  const C = canvas(S, (g) => {
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    clouds(g, S, R, 12, 0.06, S * 0.3);
    grain(g, gb, R, 0, 0, S, S, { u, dark: dark / 0.1, lines: Math.round(400 * S / 1024), per: S, wrapY: S, cath: 0.12, wav: S * 0.004 });
    pores(g, R, 0, 0, S, S, u * 0.9, 0.22);
    speckle(g, S, R, 5000, 0.03, 1.4);
  });
  const Q = flat(S >> 2, 128); lay(Q.getContext('2d'), S >> 2, noiseCanvas(256, 8, 8, 3, seed + 5, 2.2), 0.45);
  return [C, pack(B, Q)];
}

/* ── Pierres, carrelages ────────────────────────────────────────────────────────────────────────────────────────── */

/* Dalles de pierre ou de grès (travertin, calcaire…) : bandes étirées, petites cavités, légères différences de teinte d'une dalle à l'autre,
   joints creux avec arête éclairée. nx × ny dalles par carreau. Renvoie la couleur et la carte relief + rugosité (joints mats, dalle selon rs).
   Les bruits sont calculés en 256 puis agrandis : la pierre est douce, ce sont les joints et les cavités qui portent la netteté. */
function slabSet(base, seed, nx, { ny = nx, joint = 3, veins = 0.5, jointCol = [150, 138, 120], S = 1024, shift = 0, pit = 1, rs = 0.5, bump = 1, cloud = 0.14 } = {}) {
  const R = rng(seed), tw = S / nx, th = S / ny, W = 256;
  const F1 = field(W, 2, 10, 4, seed + 1), F2 = field(W, 18, 18, 3, seed + 2);
  const C = canvas(S, (g) => g.drawImage(paint(W, (i, d, p) => {
    const k = 1 + (F1[i] - 0.5) * 0.3 * veins + (F2[i] - 0.5) * cloud;
    d[p] = clamp(base[0] * k, 0, 255); d[p + 1] = clamp(base[1] * k, 0, 255); d[p + 2] = clamp(base[2] * k, 0, 255);
  }), 0, 0, S, S));
  const B = canvas(S, (g) => g.drawImage(paint(W, (i, d, p) => { d[p] = d[p + 1] = d[p + 2] = 196 + (F2[i] - 0.5) * 36 * bump; }), 0, 0, S, S));
  const Q = flat(S >> 2, rs * 255), gc = C.getContext('2d'), gb = B.getContext('2d'), gq = Q.getContext('2d'), jq = Math.max(1, joint / 4);
  const pc = new Path2D(), pb = new Path2D(), np = Math.round(1500 * pit * (S / 1024) ** 2);
  for (let i = 0; i < np; i++) {                                       // cavités du travertin : petites, étirées dans le sens des bandes
    const x = R() * S, y = R() * S, rx = 2 + R() * R() * 8, ry = 0.7 + R() * 1.4;
    for (const P of [pc, pb]) { P.moveTo(x + rx, y); P.ellipse(x, y, rx, ry, 0, 0, 7); P.closePath(); }
  }
  gc.fillStyle = rgb(base[0] * 0.5, base[1] * 0.45, base[2] * 0.38, 0.24); gc.fill(pc); gb.fillStyle = grey(96, 0.8); gb.fill(pb);
  for (let j = 0; j <= ny; j++) for (let i = -1; i <= nx; i++) {
    const ox = i * tw + (j % 2 ? shift * tw : 0), oy = j * th, t = R() < 0.5 ? 0 : 255;
    gc.fillStyle = rgb(t, t, t * 0.97, 0.02 + R() * 0.05); gc.fillRect(ox, oy, tw, th);       // chaque dalle a sa teinte
    gc.fillStyle = rgb(255, 255, 250, 0.16); gc.fillRect(ox + joint / 2, oy + joint / 2, tw - joint, 1.2); gc.fillRect(ox + joint / 2, oy + joint / 2, 1.2, th - joint);
    gc.fillStyle = rgb(0, 0, 0, 0.07); gc.fillRect(ox + joint / 2, oy + th - joint / 2 - 1.2, tw - joint, 1.2); gc.fillRect(ox + tw - joint / 2 - 1.2, oy + joint / 2, 1.2, th - joint);
  }
  for (let j = 0; j <= ny; j++) for (let i = -1; i <= nx; i++) {
    const ox = i * tw + (j % 2 ? shift * tw : 0), oy = j * th;
    gc.fillStyle = rgb(...jointCol); gc.fillRect(ox - joint / 2, oy, joint, th); gc.fillRect(ox, oy - joint / 2, tw, joint);
    gb.fillStyle = grey(46); gb.fillRect(ox - joint / 2, oy, joint, th); gb.fillRect(ox, oy - joint / 2, tw, joint);
    gb.fillStyle = grey(120); gb.fillRect(ox + joint / 2, oy, 1.5, th); gb.fillRect(ox, oy + joint / 2, tw, 1.5);
    gq.fillStyle = grey(235); gq.fillRect((ox - joint / 2) * 0.25, oy * 0.25, jq, th * 0.25); gq.fillRect(ox * 0.25, (oy - joint / 2) * 0.25, tw * 0.25, jq);
  }
  speckle(gc, S, R, 4000, 0.03, 1.6);
  return { map: C, pk: pack(B, Q) };
}

/* Dallage en petits hexagones clairs (terrasse du duplex, comme sur son plan) : motif raccordable, kx périodes en largeur, ky en hauteur. */
function hexTiles(base, seed, kx = 7, ky = 12, S = 1024) {
  const R = rng(seed), a = S / (3 * kx), h = S / (2 * ky), k = 0.935;       // a : côté de l'hexagone ; h : sa demi-hauteur
  const tone = (i, j) => { const n = Math.sin(((i % (2 * kx)) + 2 * kx) % (2 * kx) * 127.1 + ((j % ky) + ky) % ky * 311.7 + seed) * 43758.5453; return n - Math.floor(n); };
  const C = canvas(S, (g) => { g.fillStyle = rgb(176, 160, 140); g.fillRect(0, 0, S, S); });
  const B = canvas(S, (g) => { g.fillStyle = grey(40); g.fillRect(0, 0, S, S); });
  const gc = C.getContext('2d'), gb = B.getContext('2d');
  const hex = (g, cx, cy, kk) => { g.beginPath(); for (const [dx, dy] of [[1, 0], [0.5, 1], [-0.5, 1], [-1, 0], [-0.5, -1], [0.5, -1]]) g.lineTo(cx + dx * a * kk, cy + dy * h * kk); g.closePath(); g.fill(); };
  for (let i = -1; i <= 2 * kx; i++) for (let j = -1; j <= ky; j++) {
    const cx = i * 1.5 * a, cy = (2 * j + (i & 1)) * h, t = tone(i, j);
    gc.fillStyle = rgb(...shade(base, 0.93 + t * 0.12)); hex(gc, cx, cy, k);
    gb.fillStyle = grey(150); hex(gb, cx, cy, k); gb.fillStyle = grey(200); hex(gb, cx, cy, k * 0.9);
  }
  lay(gc, S, noiseCanvas(512, 5, 5, 4, seed + 1, 1.6), 0.3); lay(gc, S, noiseCanvas(512, 40, 40, 2, seed + 2, 1.8), 0.25);
  speckle(gc, S, R, 7000, 0.03, 1.5);
  lay(gb, S, noiseCanvas(512, 40, 40, 2, seed + 3, 2.0), 0.3);
  return { map: C, pk: pack(B, flat(S >> 2, 0.8 * 255)) };
}

/* Surface minérale ou enduite : teinte qui varie à peine sur plusieurs mètres, grain fin, micro-relief. Renvoie [couleur, relief].
   Les variations ne font qu'assombrir (multiplication) : un mur blanc reste blanc, il ne devient jamais plus clair que sa teinte de base. */
const devCache = new Map(), RANDOM = { S: 0, c: null };
function dev(S, cx, oct, seed, lo, c = 2) {
  const key = [S, cx, oct, seed, lo, c].join(); let n = devCache.get(key);
  if (!n) { const f = field(S, cx, cx, oct, seed); n = paint(S, (i, d, p) => { d[p] = d[p + 1] = d[p + 2] = 255 * (lo + (1 - lo) * clamp(0.5 + (f[i] - 0.5) * c)); }); devCache.set(key, n); }
  return n;
}
function randomCanvas(S) {                                           // bruit de pixels, partagé
  if (RANDOM.S !== S) { const R = rng(7); RANDOM.S = S; RANDOM.c = paint(S, (i, d, p) => { d[p] = d[p + 1] = d[p + 2] = 255 * R(); }); }
  return RANDOM.c;
}
function grainSet(base, seed, S, { tone = 0.025, grain = 0.02, rel = 14, cx = 3, fine = 90 } = {}) {
  const k = 1 / (1 - (tone * 2 + grain) / 2), Rn = randomCanvas(S);
  const C = canvas(S, (g) => {
    g.fillStyle = rgb(base[0] * k, base[1] * k, base[2] * k); g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'multiply'; g.drawImage(dev(256, cx, 3, seed, 1 - tone * 2, 2.4), 0, 0, S, S); g.drawImage(dev(512, fine >> 1, 2, seed + 1, 1 - grain, 2.4), 0, 0, S, S);
    g.globalAlpha = Math.min(1, grain * 8); g.globalCompositeOperation = 'soft-light'; g.drawImage(Rn, 0, 0);
  });
  const B = canvas(S, (g) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    g.globalAlpha = clamp(rel / 28); g.drawImage(noiseCanvas(512, fine >> 1, fine >> 1, 2, seed + 1, 2.4), 0, 0, S, S);
    g.globalAlpha = clamp(rel / 50); g.drawImage(Rn, 0, 0);
  });
  return [C, B];
}

/* Marbre : le veinage vient d'un bruit « en arête » déformé par un second bruit (veines ramifiées, plus ou moins profondes), puis quelques traits nets par-dessus.
   Les bruits de base sont partagés entre les marbres ; chacun les lit avec un décalage et un sens différents. */
let MF = null;
function marble(base, veins, seed, { sharp = 1, S = 1024, cloud = 0.06, off = [0, 0], swap = false, vk = 1 } = {}) {
  const W = 512; MF = MF || [3, 2, 2, 5, 3].map((c, i) => field(W, c, c, 4, 301 + i));
  const [N1, WX, WY, N2, N3] = MF, ox = off[0], oy = off[1];
  const at = (A, x, y) => (swap ? A[(((x + ox) & (W - 1)) * W) + ((y + oy) & (W - 1))] : A[(((y + oy) & (W - 1)) * W) + ((x + ox) & (W - 1))]);
  const small = paint(W, (i, d, p) => {
    const x = i & (W - 1), y = i >> 9, wx = (at(WX, x, y) - 0.5) * 150, wy = (at(WY, x, y) - 0.5) * 150;
    const r1 = 1 - Math.abs(2 * at(N1, x + wx, y + wy) - 1), r2 = 1 - Math.abs(2 * at(N2, x - wy * 0.7, y + wx * 0.7) - 1), r3 = 1 - Math.abs(2 * at(N3, x + wy, y - wx) - 1);
    const v1 = Math.pow(r1, 46 / sharp) * 0.8 + Math.pow(r1, 12) * 0.08, v2 = Math.pow(r2, 70 / sharp) * 0.55, v3 = Math.pow(r3, 22) * 0.18;
    const cl = (at(N1, x, y) - 0.5) * cloud * 2;
    let r = base[0] * (1 + cl), g = base[1] * (1 + cl), b = base[2] * (1 + cl);
    for (const [v, c] of [[v1, veins[0]], [v2, veins[1] || veins[0]], [v3, veins[2] || veins[0]]]) { const t = clamp(v * vk); r += (c[0] - r) * t; g += (c[1] - g) * t; b += (c[2] - b) * t; }
    d[p] = r; d[p + 1] = g; d[p + 2] = b;
  });
  return canvas(S, (g) => {
    g.drawImage(small, 0, 0, S, S);
    const R = rng(seed + 9);
    for (let i = 0; i < 5; i++) {                                   // quelques veinules nettes et fines
      let x = R() * S, y = R() * S, a = R() * 6.28; const v = veins[(R() * veins.length) | 0];
      g.strokeStyle = rgb(v[0], v[1], v[2], 0.25 + R() * 0.3); g.lineWidth = 0.6 + R() * 0.8; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 40; k++) { a += (R() - 0.5) * 0.7; x += Math.cos(a) * S / 45; y += Math.sin(a) * S / 45; g.lineTo(x, y); } g.stroke();
    }
    speckle(g, S, R, 3000, 0.02, 1.2);
  });
}

/* Mur en pierre sèche de Provence : assises irrégulières, pierres bombées (éclairées par le haut), joints profonds, lichens ; renvoie [couleur, relief]. */
function dryStoneSet(seed) {
  const S = 1024, B = canvas(S, (g) => { g.fillStyle = '#161616'; g.fillRect(0, 0, S, S); }), gb = B.getContext('2d');
  const C = canvas(S, (g) => {
    const R = rng(seed);
    g.fillStyle = '#4a3f33'; g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 44 + R() * 44; let x = -R() * 80;
      while (x < S) {
        const w = 66 + R() * 150, c = shade([210, 190, 154], 0.8 + R() * 0.4), tint = R() < 0.25 ? [-8, -4, 6] : R() < 0.3 ? [10, 2, -10] : [0, 0, 0];
        const gd = g.createLinearGradient(0, y, 0, y + h);
        gd.addColorStop(0, rgb(c[0] * 1.1 + tint[0], c[1] * 1.1 + tint[1], c[2] * 1.1 + tint[2])); gd.addColorStop(0.55, rgb(c[0] + tint[0], c[1] + tint[1], c[2] + tint[2])); gd.addColorStop(1, rgb(c[0] * 0.68, c[1] * 0.66, c[2] * 0.62));
        g.fillStyle = gd; g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, 8 + R() * 10); g.fill();
        g.fillStyle = rgb(255, 248, 230, 0.14); g.fillRect(x + 9, y + 5, w - 18, 3);
        g.fillStyle = rgb(30, 22, 14, 0.2); g.fillRect(x + 8, y + h - 9, w - 16, 5);
        if (R() < 0.18) { g.fillStyle = rgb(176, 170, 100, 0.2 + R() * 0.2); g.beginPath(); g.ellipse(x + w * R(), y + h * (0.3 + R() * 0.4), 4 + R() * 12, 3 + R() * 7, 0, 0, 7); g.fill(); }
        if (R() < 0.12) { g.fillStyle = rgb(244, 240, 228, 0.25); g.beginPath(); g.ellipse(x + w * R(), y + h * R(), 3 + R() * 8, 2 + R() * 5, 0, 0, 7); g.fill(); }
        const gr = gb.createRadialGradient(x + w / 2, y + h * 0.45, 2, x + w / 2, y + h / 2, w * 0.55); gr.addColorStop(0, grey(235)); gr.addColorStop(1, grey(120));
        gb.fillStyle = gr; gb.beginPath(); gb.roundRect(x + 4, y + 4, w - 8, h - 8, 9); gb.fill();
        x += w;
      }
      y += h;
    }
    lay(g, S, noiseCanvas(512, 8, 8, 4, seed + 1, 1.6), 0.3); lay(g, S, noiseCanvas(512, 60, 60, 2, seed + 2, 1.8), 0.3);
    speckle(g, S, R, 12000, 0.07, 2.4);
  });
  lay(gb, S, noiseCanvas(512, 48, 48, 3, seed + 3, 2.0), 0.4);
  return [C, B];
}

/* Tuiles canal sur un carreau de 1,6 m : 8 files de 20 cm, tuiles de 32 cm recouvertes les unes sur les autres.
   Chaque file a son propre décalage ; patine (calcaire, suie, mousse), ombre portée de chaque tuile sur la suivante. Renvoie [couleur, relief]. */
function roofSet(seed, S) {
  const R = rng(seed), cols = 8, rows = 5, cw = S / cols, rh = S / rows;
  const B = canvas(S, (g) => { g.fillStyle = grey(60); g.fillRect(0, 0, S, S); }), gb = B.getContext('2d');
  const C = canvas(S, (g) => {
    g.fillStyle = rgb(90, 44, 28); g.fillRect(0, 0, S, S);
    for (let c = 0; c < cols; c++) {
      const yoff = R() * rh, x0 = c * cw;
      for (let r = rows - 1; r >= -1; r--) {
        const k = shade([196, 120, 82], 0.78 + R() * 0.4), tint = R() < 0.2 ? [-14, -4, 4] : [0, 0, 0], y0 = r * rh + yoff, sd = R(), mo = R() < 0.1, moss = R() < 0.1;
        const tileAt = (yy) => {
          const gr = g.createLinearGradient(x0, 0, x0 + cw, 0);
          gr.addColorStop(0, rgb(...shade(k, 0.55))); gr.addColorStop(0.22, rgb(...shade(k, 0.92))); gr.addColorStop(0.5, rgb(k[0] * 1.08 + tint[0], k[1] * 1.04 + tint[1], k[2] + tint[2])); gr.addColorStop(0.8, rgb(...shade(k, 0.9))); gr.addColorStop(1, rgb(...shade(k, 0.58)));
          g.fillStyle = gr; g.fillRect(x0 + 1, yy, cw - 2, rh + 1);
          const gl = g.createLinearGradient(0, yy, 0, yy + rh);                     // tête de tuile plus sombre (sous la précédente), pied clair
          gl.addColorStop(0, rgb(40, 18, 10, 0.34)); gl.addColorStop(0.3, rgb(40, 18, 10, 0)); gl.addColorStop(0.92, rgb(255, 200, 150, 0.08)); gl.addColorStop(1, rgb(255, 220, 170, 0.26));
          g.fillStyle = gl; g.fillRect(x0 + 1, yy, cw - 2, rh);
          if (mo || sd < 0.3) { g.fillStyle = rgb(230, 222, 204, 0.12 + R() * 0.16); g.beginPath(); g.ellipse(x0 + cw * (0.3 + R() * 0.4), yy + rh * (0.3 + R() * 0.5), cw * 0.1, rh * 0.03, 0, 0, 7); g.fill(); }
          if (moss) { g.fillStyle = rgb(92, 104, 52, 0.28); g.beginPath(); g.ellipse(x0 + cw * 0.5, yy + rh * 0.75, cw * 0.28, rh * 0.1, 0, 0, 7); g.fill(); }
          const sh = g.createLinearGradient(0, yy + rh, 0, yy + rh + rh * 0.2); sh.addColorStop(0, rgb(30, 12, 6, 0.5)); sh.addColorStop(1, rgb(30, 12, 6, 0));   // ombre portée sur la tuile du dessous
          g.fillStyle = sh; g.fillRect(x0 + 1, yy + rh, cw - 2, rh * 0.2);
          const hb = gb.createLinearGradient(x0, 0, x0 + cw, 0); hb.addColorStop(0, grey(50)); hb.addColorStop(0.5, grey(238)); hb.addColorStop(1, grey(50));
          gb.fillStyle = hb; gb.fillRect(x0 + 1, yy, cw - 2, rh);
          const vb = gb.createLinearGradient(0, yy, 0, yy + rh); vb.addColorStop(0, rgb(0, 0, 0, 0.5)); vb.addColorStop(0.25, rgb(0, 0, 0, 0)); vb.addColorStop(1, rgb(0, 0, 0, 0)); gb.fillStyle = vb; gb.fillRect(x0 + 1, yy, cw - 2, rh);
          const sb = gb.createLinearGradient(0, yy + rh, 0, yy + rh * 1.2); sb.addColorStop(0, rgb(0, 0, 0, 0.7)); sb.addColorStop(1, rgb(0, 0, 0, 0)); gb.fillStyle = sb; gb.fillRect(x0 + 1, yy + rh, cw - 2, rh * 0.2);
        };
        tileAt(y0); if (y0 < 0 || y0 + rh * 1.2 > S) tileAt(y0 + (y0 < 0 ? S : -S));
      }
    }
    lay(g, S, noiseCanvas(512, 6, 6, 4, seed + 1, 1.6), 0.3);
    for (let c = 0; c < cols; c++) if (R() < 0.4) { const gs = g.createLinearGradient(0, 0, 0, S); gs.addColorStop(0, rgb(40, 28, 20, 0)); gs.addColorStop(0.5, rgb(40, 28, 20, 0.12)); gs.addColorStop(1, rgb(40, 28, 20, 0)); g.fillStyle = gs; g.fillRect(c * cw + cw * 0.3, 0, cw * 0.4, S); }   // coulures de ruissellement
    speckle(g, S, R, 7000, 0.07, 2);
  });
  return [C, B];
}

/* ── Tissus ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

/* Cellules de Voronoï périodiques (cuir) : renvoie, par pixel, l'écart entre les deux centres les plus proches et un ton propre à chaque cellule. */
function cells(S, n, seed) {
  const R = rng(seed), fx = new Float32Array(n * n), fy = new Float32Array(n * n), tn = new Float32Array(n * n), edge = new Float32Array(S * S), id = new Float32Array(S * S), cs = S / n;
  for (let i = 0; i < n * n; i++) { fx[i] = 0.1 + R() * 0.8; fy[i] = 0.1 + R() * 0.8; tn[i] = R(); }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const gx = x / cs, gy = y / cs, ix = Math.floor(gx), iy = Math.floor(gy); let d1 = 9, d2 = 9, t = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const bx = ix + di, by = iy + dj, w = ((bx % n) + n) % n + (((by % n) + n) % n) * n, ex = bx + fx[w] - gx, ey = by + fy[w] - gy, dd = Math.sqrt(ex * ex + ey * ey);
      if (dd < d1) { d2 = d1; d1 = dd; t = tn[w]; } else if (dd < d2) d2 = dd;
    }
    edge[y * S + x] = d2 - d1; id[y * S + x] = t;
  }
  return { edge, id };
}

/* Trames de tissu en niveaux de gris clairs : servent à la fois de carte de couleur (multipliée par la teinte) et de relief. */
function weave(seed, kind) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, S, S);
    if (kind === 'linen') {                                           // toile : fils de chaîne et de trame qui passent dessus-dessous, nœuds et irrégularités
      const t = 4;
      for (let y = 0; y < S; y += t) { g.fillStyle = grey(206 + R() * 49); g.fillRect(0, y, S, t - 1); }
      for (let j = 0; j < S / t; j++) for (let i = 0; i < S / t; i++) if ((i + j) & 1) { g.fillStyle = grey(186 + R() * 69, 0.92); g.fillRect(i * t, j * t - 0.5, t - 1, t + 0.5); }
      g.fillStyle = grey(70, 0.34); for (let y = 0; y < S; y += t) g.fillRect(0, y + t - 1, S, 1); for (let x = 0; x < S; x += t) g.fillRect(x + t - 1, 0, 1, S);
      for (let i = 0; i < 260; i++) { g.fillStyle = grey(R() < 0.5 ? 150 : 255, 0.3); g.fillRect(R() * S, R() * S, 8 + R() * 50, 1.2); }
      for (let i = 0; i < 70; i++) { g.fillStyle = grey(R() < 0.5 ? 170 : 255, 0.35); g.fillRect(R() * S, R() * S, 1.5, 6 + R() * 30); }
    } else if (kind === 'boucle') {                                   // bouclette : petites boucles serrées, ombre sous chaque boucle
      g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 11000; i++) {
        const x = R() * S, y = R() * S, r = 2.4 + R() * 3.6, a = R() * 6.28, b = a + 2.4 + R() * 2.6;
        g.strokeStyle = grey(90, 0.35); g.lineWidth = 1.6 + R() * 1.2; g.beginPath(); g.arc(x + 0.8, y + 1, r, a, b); g.stroke();
        g.strokeStyle = grey(R() < 0.5 ? 196 + R() * 40 : 255, 0.62); g.lineWidth = 1 + R() * 1.2; g.beginPath(); g.arc(x, y, r, a, b); g.stroke();
      }
    } else if (kind === 'velvet') {                                   // velours : poil couché, reflets doux
      clouds(g, S, R, 26, 0.16, 120);
      for (let i = 0; i < 24000; i++) { g.fillStyle = grey(R() < 0.5 ? 120 : 255, R() * 0.16); g.fillRect(R() * S, R() * S, 1, 2 + R() * 3); }
    } else if (kind === 'leather') {                                  // cuir : grain en cellules, plis entre elles
      const { edge, id } = cells(256, 56, seed + 3);
      const c = paint(256, (i, d, p) => { const v = 222 * (0.93 + id[i] * 0.1) * (0.5 + 0.5 * clamp(edge[i] * 1.9)); d[p] = d[p + 1] = d[p + 2] = v; });
      g.drawImage(c, 0, 0, S, S); clouds(g, S, R, 18, 0.1, 150);
    } else if (kind === 'rug') {                                      // tapis tissé : côtes, fibres et chiné
      for (let y = 0; y < S; y += 4) { g.fillStyle = grey(160 + R() * 95, 0.78); g.fillRect(0, y, S, 2.6); }
      for (let i = 0; i < 4200; i++) { g.fillStyle = grey(R() < 0.6 ? 100 : 255, R() * 0.32); g.fillRect(R() * S, R() * S, 5 + R() * 34, 1.6); }
      for (let i = 0; i < 4500; i++) { g.strokeStyle = grey(R() < 0.5 ? 90 : 255, 0.16 + R() * 0.12); g.lineWidth = 0.8; const x = R() * S, y = R() * S, a = (R() - 0.5) * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8 + 2); g.stroke(); }
    }
    speckle(g, S, R, 7000, 0.05, 1.6);
  });
}

/* Pied-de-poule (plaid du canapé), avec une trame de laine. */
function houndstooth() {
  return canvas(256, (g, S) => {
    g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, S, S); g.fillStyle = '#4a4f58';
    const u = S / 16;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i + j) % 2 === 0) {
      const x = i * u, y = j * u;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + u, y); g.lineTo(x + u * 1.5, y - u / 2); g.lineTo(x + u * 1.5, y); g.lineTo(x + u, y + u / 2); g.lineTo(x + u, y + u); g.lineTo(x + u / 2, y + u * 1.5); g.lineTo(x, y + u * 1.5); g.lineTo(x + u / 2, y + u); g.lineTo(x, y + u); g.closePath(); g.fill();
    }
    const R = rng(77); g.fillStyle = grey(0, 0.1); for (let y = 0; y < S; y += 2) g.fillRect(0, y, S, 1);
    for (let x = 0; x < S; x += 2) { g.fillStyle = grey(255, 0.06); g.fillRect(x, 0, 1, S); }
    speckle(g, S, R, 3000, 0.07, 1.4);
  });
}

/* Métal brossé : fines stries dans le sens de u, qui font varier la rugosité (anisotropie simulée) et le relief. Renvoie la carte relief + rugosité. */
function brushed(seed, lo, hi, S = 512) {
  const R = rng(seed);
  const Q = canvas(S, (g) => {
    g.fillStyle = grey((lo + hi) * 127.5); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { const v = (lo + R() * (hi - lo)) * 255, y = R() * S, x = R() * S, l = 30 + R() * 260; g.fillStyle = grey(v, 0.25 + R() * 0.4); g.fillRect(x, y, l, 0.8 + R() * 1.2); if (x + l > S) g.fillRect(x - S, y, l, 1); }
  });
  const B = canvas(S, (g) => { g.drawImage(Q, 0, 0); g.globalCompositeOperation = 'source-over'; });
  return pack(B, Q);
}

/* ── Végétaux ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/* Végétal en aplat : gazon (touffes de brins, plages sèches, trèfles) et masses de feuillage (feuilles superposées, creux d'ombre).
   Les traits d'une même teinte sont regroupés en un seul tracé : des dizaines de milliers de brins pour quelques dizaines d'appels. */
function foliage(base, seed, { blades = false, S = 1024, soft = false, gain = 1 } = {}) {
  return canvas(S, (g) => {
    const R = rng(seed), u = S / 1024, NB = 7;
    g.fillStyle = rgb(...shade(base, blades ? 0.62 : 0.85)); g.fillRect(0, 0, S, S);
    clouds(g, S, R, blades ? 24 : 22, blades ? 0.09 : 0.1, S * 0.2);
    const layers = blades ? [[0.9, 3600], [1.1, 3600], [1.3, 2800]] : [[0.98, 3600], [1.15, 3200], [1.32, 2200]];
    for (const [k0, n0] of layers) {
      const k = (soft ? 1.04 + (k0 - 1.15) * 0.3 : k0) * gain, bins = Array.from({ length: NB }, () => new Path2D()), n = Math.round(n0 * u * u);
      for (let i = 0; i < n; i++) {
        const x = R() * S, y = R() * S;
        if (blades) {
          const nb = 5 + ((R() * 5) | 0);
          for (let b = 0; b < nb; b++) {
            const a = -Math.PI / 2 + (R() - 0.5) * 1.5, l = (4 + R() * 9) * u, P = bins[(R() * NB) | 0];
            P.moveTo(x, y); P.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l + (R() - 0.5) * 4 * u, y + Math.sin(a) * l);
          }
        } else {
          const a = R() * 3.2, l = (4.5 + R() * 9) * u, P = bins[(R() * NB) | 0];
          P.moveTo(x + Math.cos(a) * l, y + Math.sin(a) * l); P.ellipse(x, y, l, l * 0.42, a, 0, 7); P.closePath();
        }
      }
      bins.forEach((P, bi) => {
        const t = bi / (NB - 1), dry = blades && bi === NB - 1, c = dry ? [150, 150, 72] : shade(base, k * (0.82 + t * 0.36));
        if (blades) { g.strokeStyle = rgb(c[0] + t * 14, c[1] + (1 - t) * 8, c[2], 0.85); g.lineWidth = 1.2 * u; g.stroke(P); } else { g.fillStyle = rgb(c[0] + t * 18, c[1] + t * 10, c[2], 0.88); g.fill(P); }
      });
      if (blades && k0 === 0.85) clouds(g, S, R, 10, 0.1, S * 0.12);
    }
    if (blades) for (let i = 0; i < 260 * u * u; i++) {               // trèfles et pâquerettes
      const x = R() * S, y = R() * S;
      if (R() < 0.7) { g.fillStyle = rgb(70, 118, 56, 0.55); for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (k - 1) * 2.2 * u, y + (k % 2) * 1.5 * u, 1.9 * u, 0, 7); g.fill(); } }
      else { g.fillStyle = rgb(244, 240, 226, 0.7); g.beginPath(); g.arc(x, y, 1.3 * u, 0, 7); g.fill(); }
    }
    lay(g, S, noiseCanvas(512, blades ? 4 : 6, blades ? 4 : 6, 4, seed + 3, 1.6), 0.22);
  });
}

/* Touffe de feuilles sur fond transparent : plaquée sur de petites cartes pour donner un vrai feuillage aux arbres et aux plantes.
   Trois couches (fond sombre, milieu, pointes claires), nervure centrale et nervures latérales, face dessus plus foncée que le dessous. */
function leafCard(base, seed, { n = 46, len = 0.2, wid = 0.045, needles = false, silver = 0, S = 256 } = {}) {
  return canvas(S, (g) => {
    const R = rng(seed); g.clearRect(0, 0, S, S);
    for (let i = 0; i < n; i++) {
      const layer = i < n * 0.4 ? 0 : i < n * 0.8 ? 1 : 2, a = R() * 6.28, d = R() * S * (0.12 + 0.18 * layer), x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      const l = S * len * (0.6 + R() * 0.7), w = S * wid * (0.6 + R() * 0.7);
      let c = shade(base, [0.55, 0.85, 1.12][layer] * (0.85 + R() * 0.3)); c = [c[0] + R() * 14, c[1] + R() * 10, c[2] + R() * 6];
      const under = R() < silver; if (under) c = mix(c, [180, 190, 172], 0.4);          // revers argenté (olivier)
      g.save(); g.translate(x, y); g.rotate(a + (R() - 0.5) * 1.3);
      if (needles) {
        g.lineWidth = Math.max(1.2, S / 190); for (let k = 0; k < 9; k++) { const ang = (R() - 0.5) * 0.32; const cc = shade(c, 0.85 + R() * 0.35); g.strokeStyle = rgb(cc[0], cc[1], cc[2]); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang) * l * 0.8, Math.sin(ang) * l * 0.8); g.stroke(); }
      } else {
        const gd = g.createLinearGradient(0, -w / 2, 0, w / 2); gd.addColorStop(0, rgb(...shade(c, 1.14))); gd.addColorStop(1, rgb(...shade(c, 0.84)));
        g.fillStyle = gd; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.35, -w * 0.9, l, 0); g.quadraticCurveTo(l * 0.35, w * 0.9, 0, 0); g.fill();
        g.strokeStyle = rgb(...shade(c, 0.62), 0.5); g.lineWidth = Math.max(0.6, S / 400); g.stroke();
        g.strokeStyle = rgb(...shade(c, 1.3), 0.55); g.lineWidth = Math.max(0.8, S / 280); g.beginPath(); g.moveTo(0, 0); g.lineTo(l * 0.96, 0); g.stroke();
        if (w > S * 0.07) { g.strokeStyle = rgb(...shade(c, 1.22), 0.32); g.lineWidth = Math.max(0.5, S / 450); for (let k = 1; k < 6; k++) { const px = l * k / 6.5, ww = w * 0.3 * Math.sin(Math.PI * k / 6.5); g.beginPath(); g.moveTo(px, 0); g.lineTo(px + ww * 0.6, -ww); g.moveTo(px, 0); g.lineTo(px + ww * 0.6, ww); g.stroke(); } }
      }
      g.restore();
    }
  }, true);
}

/* Écorce : fissures verticales, plaques et mousse claire ; renvoie [couleur, relief]. */
function barkSet(seed) {
  const S = 512, R = rng(seed), B = canvas(S, (g) => { g.fillStyle = grey(170); g.fillRect(0, 0, S, S); }), gb = B.getContext('2d');
  const C = canvas(S, (g) => {
    g.fillStyle = rgb(112, 90, 70); g.fillRect(0, 0, S, S); clouds(g, S, R, 14, 0.1, 140);
    for (let i = 0; i < 300; i++) {
      const x = R() * S, y = R() * S, l = 40 + R() * 180, w = 1 + R() * 3.4, dx = (R() - 0.5) * 14, a = 0.25 + R() * 0.4;
      for (const off of [0, -S, S]) {
        if (y + off + l < 0 || y + off > S) continue;
        for (const [gg, col, ww] of [[g, rgb(36, 26, 18, a), w], [gb, grey(30, a + 0.2), w * 1.2], [g, rgb(176, 150, 120, a * 0.45), 1], [gb, grey(235, a * 0.6), 1]]) {
          gg.strokeStyle = col; gg.lineWidth = ww; gg.beginPath(); gg.moveTo(x + (ww === 1 ? w * 0.9 : 0), y + off); gg.bezierCurveTo(x + dx, y + off + l * 0.3, x - dx, y + off + l * 0.7, x + dx * 0.4, y + off + l); gg.stroke();
        }
      }
    }
    lay(g, S, noiseCanvas(256, 8, 8, 3, seed + 1, 1.8), 0.4); speckle(g, S, R, 5000, 0.06, 1.8);
  });
  return [C, B];
}

/* ── Eau ────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/* Eau du bassin : turquoise plus profond au centre des nuages, réseau de caustiques (arêtes de sinusoïdes déformées), petites rides. Renvoie [couleur, relief]. */
function waterSet(seed) {
  const S = 512, R = rng(seed), F = field(S, 3, 3, 3, seed + 1), K = field(S, 2, 2, 2, seed + 2), ph = Array.from({ length: 6 }, () => R() * 6.28), T = 6.2832 / S;
  const waves = [[9, 6], [-6, 12], [15, -9], [-12, -15], [18, 3], [3, 18]];
  const Cm = paint(S, (i, d, p) => {
    const x = i & (S - 1), y = i >> 9, wx = (K[i] - 0.5) * 36, wy = (K[(i + 91) % (S * S)] - 0.5) * 36; let s = 0;
    for (let k = 0; k < 6; k++) s += Math.sin(T * (waves[k][0] * (x + wx) + waves[k][1] * (y + wy)) + ph[k]);
    const c = Math.pow(clamp(1 - Math.abs(s / 6) * 2.2), 7), t = clamp(c, 0, 1), dp = 0.9 + (F[i] - 0.5) * 0.3;
    d[p] = (38 * dp) + (200 - 38 * dp) * t * 0.42; d[p + 1] = (152 * dp) + (246 - 152 * dp) * t * 0.42; d[p + 2] = (176 * dp) + (250 - 176 * dp) * t * 0.38;
  });
  const Bm = paint(S, (i, d, p) => { const x = i & (S - 1), y = i >> 9; d[p] = d[p + 1] = d[p + 2] = 128 + 40 * (Math.sin(T * (21 * x + 9 * y) + ph[0]) + Math.sin(T * (-15 * x + 24 * y) + ph[1])) * (0.5 + F[i]); });
  return [Cm, Bm];
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
    for (let y = 0; y < S; y += 3) { g.fillStyle = grey(0, 0.03); g.fillRect(0, y, S, 1); }      // trame de la toile
    for (let x = 0; x < S; x += 3) { g.fillStyle = grey(255, 0.025); g.fillRect(x, 0, 1, S); }
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
  const A = quality.aniso, FS = quality.tex || 1024, GS = 1024;
  const T = (c, o) => tex(c, { aniso: A, ...o }), L = (c) => tex(c, { aniso: A, srgb: false });
  const M = {};

  // ── Sols : quatre finitions pour les pièces de vie (la carte de couleur des finitions non choisies n'est dessinée qu'à la demande)
  const TILE = 6.48;                                                  // un carreau de parquet = 36 rangs de lames de 18 cm
  const oak = parquetSet([166, 106, 60], FS), oakPk = L(oak.pk);       // relief et rugosité partagés par les trois chênes : mêmes joints
  const woodFloor = (map, r) => ({ map: T(map), bumpMap: oakPk, roughnessMap: oakPk, roughness: r, bumpScale: 0.6 });
    const floorDefs = {
    floorOak: () => woodFloor(oak.map, 1),
    floorOakLight: () => woodFloor(parquetSet([208, 178, 138], FS, { full: false }).map, 1),
    floorOakDark: () => woodFloor(parquetSet([112, 78, 54], FS, { full: false }).map, 0.9),
    floorStone: () => { const st = slabSet([222, 210, 190], 14, 6, { ny: 12, joint: 2.6, veins: 0.9, shift: 0.5, rs: 0.38, pit: 0.5 }), pk = L(st.pk); return { map: T(st.map), bumpMap: pk, roughnessMap: pk, roughness: 1, bumpScale: 0.5 }; },
  };
  M.floorCache = {};
  M.floorDef = (id) => M.floorCache[id] || (M.floorCache[id] = floorDefs[id]());
  M.floor = std({ ...M.floorDef('floorOak'), metalness: 0, envMapIntensity: 1.15, userData: { wuv: TILE, cast: false } });   // matériau courant des pièces de vie
  const tileSet = slabSet([214, 208, 198], 15, 2, { ny: 4, veins: 0.6, cloud: 0.04, joint: 2.5, jointCol: [172, 166, 158], shift: 0.5, rs: 0.3, pit: 0.1 }), tilePk = L(tileSet.pk);
  M.tile = std({ map: T(tileSet.map), bumpMap: tilePk, roughnessMap: tilePk, roughness: 1, bumpScale: 0.5, userData: { wuv: 2.4, cast: false } });   // grès 60 × 120
  const terr = slabSet([224, 208, 178], 16, 4, { veins: 0.8, joint: 4, rs: 0.8, pit: 0.9, bump: 1.4 }), terrPk = L(terr.pk);
  M.terrace = std({ map: T(terr.map), bumpMap: terrPk, roughnessMap: terrPk, roughness: 1, bumpScale: 0.8, userData: { wuv: 2.4 } });
  const hexs = hexTiles([230, 209, 188], 41), hexPk = L(hexs.pk);
  M.hexPaving = std({ map: T(hexs.map), bumpMap: hexPk, roughnessMap: hexPk, roughness: 1, bumpScale: 0.8, userData: { wuv: 1.2 } });
  const [coC, coB] = grainSet([143, 138, 132], 28, GS >> 1, { tone: 0.05, grain: 0.05, rel: 18, cx: 4, fine: 160 });
  M.concrete = std({ map: T(coC), bumpMap: L(coB), bumpScale: 1, roughness: 0.9, userData: { wuv: 2 } });
  M.socle = std({ color: 0xd8d0c2, roughness: 0.9 });
  M.wallCut = std({ color: 0xdcd6cb, roughness: 1 });               // tranche des murs coupés

  // ── Murs et plafonds : plâtre peint, grain à peine visible, micro-relief que la lumière rasante révèle
  const [plC, plB] = grainSet([252, 250, 245], 21, GS, { tone: 0.014, grain: 0.012, rel: 7, cx: 3, fine: 120 }), plBump = L(plB);
  M.plaster = std({ map: T(plC), bumpMap: plBump, bumpScale: 0.5, roughness: 0.94, userData: { wuv: 3 } });
  M.ceiling = std({ color: 0xfefdfb, bumpMap: plBump, bumpScale: 0.4, roughness: 0.97, userData: { wuv: 3, cast: true } });
  M.skirt = std({ color: 0xf6f4ef, roughness: 0.4 });                // plinthes et chambranles laqués satinés
  const [stC, stB] = grainSet([226, 210, 182], 22, GS >> 1, { tone: 0.02, grain: 0.06, rel: 22, cx: 6, fine: 220 });
  M.stucco = std({ map: T(stC), bumpMap: L(stB), bumpScale: 1.1, roughness: 0.95, userData: { wuv: 2.5 } });      // enduit de façade taloché
  M.stuccoDark = std({ color: 0xb9a584, roughness: 0.95 });
  M.massing = std({ color: 0xe2d8c6, roughness: 0.95 });            // volumes de contexte, traités en maquette claire
  const wt = slabSet([234, 228, 216], 23, 2, { ny: 1, veins: 0.7, cloud: 0.03, joint: 2, jointCol: [200, 194, 184], rs: 0.28, pit: 0 }), wtPk = L(wt.pk);
  M.wallTile = std({ map: T(wt.map), bumpMap: wtPk, roughnessMap: wtPk, roughness: 1, bumpScale: 0.4, userData: { wuv: 2.4 } });
  const [dsC, dsB] = dryStoneSet(24);
  M.stone = std({ map: T(dsC), bumpMap: L(dsB), bumpScale: 3.5, roughness: 0.95, userData: { wuv: 2.2 } });
  const [rfC, rfB] = roofSet(25, GS);
  M.roof = std({ map: T(rfC), bumpMap: L(rfB), bumpScale: 2, roughness: 0.82, userData: { wuv: 1.6 } });
  const ash = slabSet([226, 212, 186], 26, 2, { ny: 3, veins: 0.5, joint: 2, jointCol: [186, 172, 148], shift: 0.5, rs: 0.8, pit: 0.8 }), ashPk = L(ash.pk);
  M.ashlar = std({ map: T(ash.map), bumpMap: ashPk, roughnessMap: ashPk, roughness: 1, bumpScale: 0.9, userData: { wuv: 2.0 } });   // pierre de taille de la tour (70 × 100)
  M.cadre = std({ color: 0x6a665f, roughness: 0.6, metalness: 0.3 });   // cadres, garde-corps et menuiseries RAL 7039
  M.shutter = std({ map: T(canvas(128, (g, S) => { g.fillStyle = '#8f877b'; g.fillRect(0, 0, S, S); for (let x = 0; x < S; x += 8) { g.fillStyle = 'rgba(40,34,28,0.42)'; g.fillRect(x, 0, 2, S); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 2, 0, 1, S); } })), roughness: 0.8, userData: { wuv: 0.6 } });   // volets coulissants à lames verticales, taupe
  M.glassDark = std({ color: 0x1b2126, roughness: 0.08, metalness: 0.75, envMapIntensity: 1.6 });   // vitrages des autres logements
  const [pvC, pvB] = grainSet([196, 190, 180], 27, GS >> 1, { tone: 0.03, grain: 0.07, rel: 20, cx: 6, fine: 180 });
  M.paving = std({ map: T(pvC), bumpMap: L(pvB), bumpScale: 1, roughness: 0.95, userData: { wuv: 3, cast: false } });   // enrobé clair, trottoirs
  M.garage = std({ map: T(canvas(128, (g, S) => { g.fillStyle = '#6d6a66'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 16) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, S, 2); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, y + 2, S, 1); } })), roughness: 0.6, metalness: 0.3, userData: { wuv: 1 } });
  M.carGrey = std({ color: 0x8d9296, roughness: 0.3, metalness: 0.7 }); M.carDark = std({ color: 0x1c1e22, roughness: 0.25, metalness: 0.7 });

  // ── Menuiseries et métaux
  M.frame = std({ color: 0x2c2d30, roughness: 0.55, metalness: 0.4 });   // aluminium anthracite
  const brs = L(brushed(81, 0.22, 0.6)), brb = L(brushed(82, 0.3, 0.46));
  M.steel = std({ color: 0xb9b6b0, bumpMap: brs, roughnessMap: brs, bumpScale: 0.35, roughness: 1, metalness: 0.9, userData: { wuv: 0.5, wuvSwap: true } });   // inox brossé : stries dans le sens vertical
  M.brass = std({ color: 0xd2ab66, bumpMap: brb, roughnessMap: brb, bumpScale: 0.2, roughness: 0.85, metalness: 1, userData: { wuv: 0.35 } });      // laiton brossé (lustres, piètements)
  M.black = std({ color: 0x1b1a1a, roughness: 0.48, metalness: 0.35 });
  M.glass = phys({ color: 0xcfe0e2, roughness: 0.42, specularIntensity: 0.3, metalness: 0, transparent: true, opacity: 0.07, envMapIntensity: 0.4, depthWrite: false, userData: { cast: false, receive: false, order: 5 } });
  M.glassFrost = phys({ color: 0xf2f6f6, roughness: 0.25, transparent: true, opacity: 0.28, depthWrite: false, userData: { cast: false, receive: false, order: 5 } });
  M.glassSmoke = phys({ color: 0x1a1b1e, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.3, userData: { cast: true } });   // plateau en verre fumé
  M.crystal = phys({ color: 0xffffff, roughness: 0.3, specularIntensity: 0.4, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false, userData: { cast: false, receive: false, order: 6 } });
  M.mirror = std({ color: 0xf4f6f6, roughness: 0.05, metalness: 1 });
  const [okC, okP] = woodSet([204, 162, 112], 32, 0.12), [wnC, wnP] = woodSet([98, 66, 44], 33, 0.16), [slC, slP] = woodSet([150, 108, 70], 31, 0.18, 512);
  const okPk = L(okP), wnPk = L(wnP);
  M.door = std({ map: T(okC), bumpMap: okPk, roughnessMap: okPk, bumpScale: 0.5, roughness: 0.95, userData: { wuv: 1.3, wuvSwap: true } });   // portes plaquées chêne
  M.slat = std({ map: T(slC), bumpMap: L(slP), bumpScale: 0.6, roughness: 0.7, userData: { wuv: 1.2, wuvSwap: true } });

  // ── Mobilier : bois, laques, pierres
  M.oak = std({ map: T(okC), bumpMap: okPk, roughnessMap: okPk, bumpScale: 0.5, roughness: 0.95, userData: { wuv: 1.3 } });
  M.oakV = std({ map: M.oak.map, bumpMap: okPk, roughnessMap: okPk, bumpScale: 0.5, roughness: 0.95, userData: { wuv: 1.3, wuvSwap: true } });   // fil vertical (façades)
  M.walnut = std({ map: T(wnC), bumpMap: wnPk, roughnessMap: wnPk, bumpScale: 0.5, roughness: 0.9, userData: { wuv: 1.3 } });
  M.lacquer = std({ color: 0xf2efe9, roughness: 0.32 });
  M.seam = std({ color: 0x4d4038, roughness: 0.85 });                 // joints entre façades
  M.anthracite = std({ color: 0x3a3d42, roughness: 0.62 });           // laque mate de la cuisine
  M.greyLacquer = std({ color: 0x8b8b88, roughness: 0.5 });           // meubles du mur TV
  M.navy = std({ color: 0x38465a, roughness: 0.5 });
  M.marble = std({ map: T(marble([242, 239, 234], [[122, 118, 116], [176, 142, 96], [150, 146, 142]], 34)), roughness: 0.16, envMapIntensity: 1.2, userData: { wuv: 1.9 } });
  M.marbleDark = std({ map: T(marble([30, 29, 31], [[210, 200, 186], [150, 130, 100], [120, 116, 112]], 35, { sharp: 1.2, cloud: 0.4, off: [211, 97], swap: true, vk: 0.28 })), roughness: 0.3, userData: { wuv: 1.6 } });
  M.marbleGrey = std({ map: T(marble([186, 184, 182], [[242, 240, 236], [110, 108, 108], [150, 146, 140]], 36, { cloud: 0.12, off: [333, 401] })), roughness: 0.2, envMapIntensity: 1.2, userData: { wuv: 1.7 } });

  // ── Tissus et cuirs : une trame partagée (couleur × teinte, et relief)
  const W = {}; for (const [k, s] of [['linen', 61], ['boucle', 62], ['velvet', 63], ['leather', 64], ['rug', 65]]) { const c = weave(s, k); W[k] = [T(c), L(c)]; }
  const fab = (color, kind, rough, o = {}) => (o.sheen ? phys : std)({ color, map: W[kind][0], bumpMap: W[kind][1], bumpScale: o.bump || 1.4, roughness: rough, ...(o.sheen ? { sheen: o.sheen, sheenRoughness: 0.55, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5) } : {}), userData: { wuv: o.wuv || 0.5 } });
  M.linen = fab(0xefe9dd, 'linen', 0.96);                             // lin écru
  M.greige = fab(0xb7ab9c, 'velvet', 0.9, { sheen: 0.5 });            // velours taupe (chaises du duplex)
  M.taupe = fab(0xa59889, 'linen', 0.97, { wuv: 0.35 });              // rideaux
  M.sheer = std({ color: 0xfbf7ee, map: W.linen[0], roughness: 1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, userData: { wuv: 0.4, cast: false, order: 4 } });   // voilages
  M.cream = fab(0xf4eee2, 'linen', 0.97);
  M.boucle = fab(0xe3e1dc, 'boucle', 0.98, { bump: 2.2, wuv: 0.42, sheen: 0.4 }); // bouclette gris clair du canapé
  M.sand = fab(0xdccdb6, 'boucle', 0.98, { bump: 1.8, wuv: 0.42, sheen: 0.4 });   // tête de lit, banquette
  M.terra = phys({ color: 0xb4674c, map: W.velvet[0], bumpMap: W.velvet[1], bumpScale: 0.9, roughness: 0.78, sheen: 0.6, sheenRoughness: 0.5, sheenColor: 0xe6a184, userData: { wuv: 0.5 } });   // velours terracotta
  M.cognac = std({ color: 0xb06a3c, map: W.leather[0], bumpMap: W.leather[1], bumpScale: 1.1, roughness: 0.5, userData: { wuv: 0.45 } });   // cuir cognac
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
  M.hedge = std({ map: T(foliage([62, 98, 50], 52, { gain: 0.8 })), roughness: 1, userData: { wuv: 1.3 } });
  const CS = FS > 1024 ? 512 : 256;
  const card = (c, o) => std({ map: T(c), alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.95, ...o });      // bords de feuilles lissés par l'anticrénelage
  M.leafOlive = card(leafCard([112, 138, 90], 53, { n: 70, len: 0.2, wid: 0.045, silver: 0.25, S: CS }));
  M.leafPine = card(leafCard([70, 110, 62], 54, { n: 40, len: 0.34, needles: true, S: CS }));
  M.leafBroad = card(leafCard([78, 122, 62], 55, { n: 30, len: 0.26, wid: 0.12, S: CS }));     // plantes d'intérieur, lauriers
  M.leafCypress = std({ map: T(foliage([46, 78, 48], 56, { S: 512, gain: 1.2 })), roughness: 1, userData: { wuv: 1.1 } });
  M.lavender = std({ color: 0x8a7bc0, roughness: 1 });
  M.oleander = std({ color: 0xe07a94, roughness: 1 });
  M.pampas = std({ color: 0xe6d6b8, roughness: 1 });
  const [bkC, bkB] = barkSet(59);
  M.bark = std({ map: T(bkC), bumpMap: L(bkB), bumpScale: 2, color: 0xf0e4d8, roughness: 1, userData: { wuv: 0.6 } });
  M.earth = std({ map: T(foliage([120, 128, 84], 57, { S: 512, soft: true, gain: 1.18 })), roughness: 1, userData: { wuv: 6, cast: false } });
  const [wC, wB] = waterSet(58);
  M.water = phys({ map: T(wC), bumpMap: L(wB), bumpScale: 0.6, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.9, envMapIntensity: 1.4, userData: { wuv: 3, cast: false } });
  const [rdC, rdB] = grainSet([119, 115, 110], 29, GS >> 1, { tone: 0.05, grain: 0.1, rel: 30, cx: 4, fine: 200 });
  M.road = std({ map: T(rdC), bumpMap: L(rdB), bumpScale: 1.2, roughness: 0.95, userData: { wuv: 3, cast: false } });
  noiseCache.clear(); devCache.clear(); RANDOM.S = 0; RANDOM.c = null; MF = null;       // les bruits de travail ne servent plus : on libère la mémoire
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
