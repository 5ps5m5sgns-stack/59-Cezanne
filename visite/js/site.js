/* 59 Cézanne — visite 3D : la résidence et ses abords, d'après le dossier de plans (plan de masse, niveaux 0 à 2, quatre façades).
   Repère de l'immeuble : x de la façade Ouest (0) à la façade Est (17,39 m), z de la façade Nord (0) à la façade Sud (32,2 m),
   y = 0 au plancher du rez-de-jardin (289,6 NGF). Étage à +2,9 m, égout de toiture à +5,8 m, terrasse de la piscine à −1,3 m,
   cour d'accès et garage à −3,3 m. L'avenue Paul-Cézanne longe la parcelle à l'Est, la Sainte-Victoire est dans cet axe.
   Seuls les deux logements à vendre sont détaillés (plans.js) ; le reste de l'immeuble est traité en volumes fidèles aux façades :
   enduit grège, cadres métalliques gris, volets coulissants taupe, garde-corps à barreaudage, tour de circulation en pierre, tuiles. */
import * as THREE from 'three';
import { F, V } from 'v3d/furniture';
import { railing } from 'v3d/build';
import { Batch } from 'v3d/geo';

export const SITE = {
  W: 17.39, L: 32.2, FH: 2.9, EAVE: 5.82, RISE: 2.75,
  center: [9.5, 1.6, 15.5],
  /* Emprise des deux logements à vendre, pour les repérer sur la vue d'ensemble : [x0, y0, z0, x1, y1, z1]. */
  lots: {
    villa: { boxes: [[0, 2.9, 0, 17.39, 5.82, 9.37]], at: [8.7, 6.4, 4.7] },
    duplex: { boxes: [[5.06, 0, 13.15, 17.39, 2.9, 25.88], [9.05, 2.9, 13.15, 17.39, 5.82, 25.88]], at: [14.6, 6.4, 19.4] },
  },
};

/* Toiture à quatre pentes (faîtage dans le sens de la longueur). */
function hip(b, mat, x0, z0, x1, z1, y, rise) {
  const k = (x1 - x0) / 2, A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], D = [x0, y, z1], R1 = [x0 + k, y + rise, z0 + k], R2 = [x0 + k, y + rise, z1 - k];
  const tris = [A, R1, B, B, R1, R2, B, R2, C, C, R2, D, D, R2, R1, D, R1, A];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3)); g.computeVertexNormals();
  const n = g.attributes.normal; let up = 0; for (let i = 0; i < n.count; i++) up += n.getY(i);
  if (up < 0) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let q = 0; q < 3; q++) { const t = p[i + 3 + q]; p[i + 3 + q] = p[i + 6 + q]; p[i + 6 + q] = t; } g.computeVertexNormals(); }
  b.add(mat, g);
  b.rod(mat, R1, R2, 0.085, 6);                                  // faîtage et arêtiers : tuiles faîtières posées sur les lignes de rencontre des pans
  for (const [p, q] of [[A, R1], [B, R1], [C, R2], [D, R2]]) b.rod(mat, p, q, 0.07, 6);
}

/* Voiture stationnée : caisse arrondie, pavillon vitré, quatre roues. */
function car(b, M, x, y, z, rot, paint) {
  b.push(x, y, z, rot);
  b.cbox(M[paint], 0, 0.3, 0, 1.82, 0.62, 4.5, 0.2, 0, 3); b.cbox(M.glassDark, 0, 0.86, -0.15, 1.6, 0.52, 2.5, 0.22, 0, 3);
  for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) b.geo(M.black, new THREE.CylinderGeometry(0.33, 0.33, 0.24, 18), sx * 0.82, 0.33, sz, 0, 0, Math.PI / 2);
  b.pop();
}

/* Maison voisine : volume enduit, baies sombres, toit de tuiles à quatre pentes. */
function house(b, M, x, y, z, w, d, rot, h = 5.6, tint = 'stucco') {
  b.push(x, y, z, rot);
  b.box(M[tint], -w / 2, 0, -d / 2, w / 2, h, d / 2);
  for (const lv of h > 4 ? [0.3, 3.1] : [0.3]) for (let i = 0; i < Math.round(w / 3.2); i++) { const a = -w / 2 + (w / Math.round(w / 3.2)) * (i + 0.5); for (const s of [-1, 1]) { b.box(M.glassDark, a - 0.7, lv, s > 0 ? d / 2 : -d / 2 - 0.03, a + 0.7, lv + 2.1, s > 0 ? d / 2 + 0.03 : -d / 2); for (const e of [-1, 1]) b.box(M.shutter, a + e * 0.95 - 0.25, lv, s > 0 ? d / 2 : -d / 2 - 0.045, a + e * 0.95 + 0.25, lv + 2.1, s > 0 ? d / 2 + 0.045 : -d / 2); } }
  if (w >= d) { b.push(0, 0, 0, Math.PI / 2); hip(b, M.roof, -d / 2 - 0.5, -w / 2 - 0.5, d / 2 + 0.5, w / 2 + 0.5, h, Math.min(w, d) * 0.19); b.pop(); } else hip(b, M.roof, -w / 2 - 0.5, -d / 2 - 0.5, w / 2 + 0.5, d / 2 + 0.5, h, Math.min(w, d) * 0.19);
  b.box(M.stuccoDark, -w / 2 - 0.5, h - 0.14, -d / 2 - 0.5, w / 2 + 0.5, h, d / 2 + 0.5);
  const rz = Math.min(w, d) * 0.19, cx = w >= d ? w * 0.18 : 0, cz = w >= d ? 0 : d * 0.18;                // souche de cheminée sur le faîtage
  b.box(M.stucco, cx - 0.3, h + rz - 0.45, cz - 0.3, cx + 0.3, h + rz + 0.75, cz + 0.3); b.box(M.stuccoDark, cx - 0.36, h + rz + 0.75, cz - 0.36, cx + 0.36, h + rz + 0.83, cz + 0.36);
  b.pop();
}

/* o = origine du logement courant dans le repère de l'immeuble ; skip = logements détaillés ailleurs ('villa', 'duplex'). */
export function buildSite(b, M, { o, skip }) {
  const { W, L, FH, EAVE, RISE } = SITE, has = (k) => !skip.includes(k), G = 0.012;
  b.push(-o[0], -o[1], -o[2]); b.on('ctx');
  const box = (m, x0, y0, z0, x1, y1, z1) => {
    b.box(M[m], x0, y0, z0, x1, y1, z1);
    if (m === 'stone' && y1 - y0 > 0.6 && Math.min(x1 - x0, z1 - z0) < 0.5) b.box(M.ashlar, x0 - 0.03, y1 - 0.05, z0 - 0.03, x1 + 0.03, y1 + 0.004, z1 + 0.03);   // couvertine : 4 mm au-dessus du mur, jamais dans son plan
  };

  // ── Volumes de l'immeuble (les logements détaillés sont laissés vides) ────────────────────────────
  // Les volumes s'arrêtent sous les planchers des logements détaillés : jamais deux surfaces dans le même plan (le parquet scintillerait).
  const y0 = -0.31, y1 = FH - 0.31;
  box('stucco', 0, y0, 0, W, y1, 9.37 - G); box('stucco', 9.6, y0, 9.37, W, y1, 11.4);                     // logement 01
  box('stucco', 0, y0, 9.37, 9.6, y1, 13.14); box('stucco', 0, y0, 13.14, 5.06 - G, y1, 25.89); box('stucco', 9.6, y0, 11.4, W, y1, 13.15 - G);   // caves, hall, escalier
  if (has('duplex')) box('stucco', 5.06, y0, 13.15, W, y1, 25.88);                                          // duplex 02 et 03
  box('stucco', 0, y0, 25.88 + G, W, y1, L);                                                                // logement 04
  if (has('villa')) box('stucco', 0, y1, 0, W, EAVE, 9.37);                                                 // logement 08
  box('stucco', 0, y1, 9.37 + G, 5.06 - G, EAVE, 25.89); box('stucco', 5.06 - G, y1, 9.37 + G, 9.05 - G, EAVE, 13.15 - G);   // logements 06 et 07
  box('stucco', 5.06 - G, has('duplex') ? y1 : FH - 0.02, 13.15 - G, 9.05 - G, EAVE, 25.89);               // …au-dessus du fond des duplex
  box('stucco', 9.05, y1, 9.37 + G, W, EAVE, 13.15 - G);                                                    // circulation
  if (has('duplex')) box('stucco', 9.05, y1, 13.15, W, EAVE, 25.88);
  box('stucco', 0, y1, 25.88 + G, W, EAVE, L);                                                              // logement 05
  box('socle', -0.02, -3.3, -0.02, W + 0.02, y0, L + 0.02);                                                 // soubassement (garage, caves)

  // ── Façades : un « cadre » métallique par logement, vitrage sombre, volets coulissants, garde-corps ──
  const P = { E: (a, d) => [W + d, a], W: (a, d) => [-d, a], N: (a, d) => [a, -d], S: (a, d) => [a, L + d] };
  const unit = (face, a0, a1, y, { depth = 0.55, rail = false, shut = 0.3, h = 2.42 } = {}) => {
    const fb = (m, s0, s1, d0, d1, ya, yb) => { const p = P[face](s0, d0), q = P[face](s1, d1); box(m, Math.min(p[0], q[0]), ya, Math.min(p[1], q[1]), Math.max(p[0], q[0]), yb, Math.max(p[1], q[1])); };
    fb('glassDark', a0 + 0.1, a1 - 0.1, -0.01, 0.03, y + 0.04, y + h);
    const n = Math.max(2, Math.round((a1 - a0) / 1.35));
    for (let i = 0; i <= n; i++) { const a = a0 + 0.1 + ((a1 - a0 - 0.2) / n) * i; fb('cadre', a - 0.03, a + 0.03, 0.03, 0.07, y + 0.04, y + h); }
    fb('cadre', a0 + 0.1, a1 - 0.1, 0.03, 0.07, y + h - 0.06, y + h); fb('cadre', a0 + 0.1, a1 - 0.1, 0.03, 0.07, y + 0.04, y + 0.1);
    for (let i = 0; i < n; i++) if ((i + Math.round(a0)) % 3 === 0 || shut > 0.5) { const a = a0 + 0.1 + ((a1 - a0 - 0.2) / n) * i; fb('shutter', a + 0.02, a + (a1 - a0 - 0.2) / n * Math.min(1, shut * 2.4), 0.1, 0.14, y + 0.06, y + h - 0.02); }
    fb('cadre', a0 - 0.12, a1 + 0.12, 0, depth, y + h + 0.06, y + h + 0.18); fb('cadre', a0 - 0.12, a1 + 0.12, 0, depth, y - 0.12, y);
    fb('cadre', a0 - 0.12, a0, 0, depth, y - 0.12, y + h + 0.18); fb('cadre', a1, a1 + 0.12, 0, depth, y - 0.12, y + h + 0.18);
    if (rail) { const p = P[face](a0, depth - 0.06), q = P[face](a1, depth - 0.06); railing(b, M, p[0], p[1], q[0], q[1], y, 1.02, 'cadre'); }
  };
  unit('E', 0.5, 8.6, 0.02, { rail: true, depth: 0.9 }); if (has('villa')) unit('E', 0.5, 8.6, FH + 0.02, { rail: true, depth: 0.9 });
  if (has('duplex')) for (const a of [13.75, 19.75]) { unit('E', a, a + 5.4, 0.02); unit('E', a, a + 5.4, FH + 0.02, { rail: true }); }
  unit('E', 25.95, 31.5, 0.02); unit('E', 25.95, 31.5, FH + 0.02, { rail: true });
  if (has('villa')) unit('W', 0.6, 8.7, FH + 0.02, { depth: 0.35 });
  unit('W', 9.7, 15.6, FH + 0.02, { depth: 0.35 }); unit('W', 16.3, 22.6, FH + 0.02, { depth: 0.35 }); unit('W', 23.3, 31.6, FH + 0.02, { depth: 0.35 });
  unit('N', 2.2, 15.4, 0.02, { depth: 0.35, shut: 0.4 }); if (has('villa')) unit('N', 2.2, 15.4, FH + 0.02, { depth: 0.35, rail: true, shut: 0.4 });
  unit('S', 2.0, 15.6, 0.02, { depth: 0.35, shut: 0.4 }); unit('S', 2.6, 15.0, FH + 0.02, { depth: 0.35, rail: true, shut: 0.4 });

  // ── Tour de circulation commune : pierre de taille, fente vitrée, couvertine ──
  box('ashlar', W, -3.3, 9.62, W + 1.55, EAVE + 0.9, 13.3); box('cadre', W - 0.02, EAVE + 0.9, 9.58, W + 1.59, EAVE + 0.96, 13.34);
  box('glassDark', W + 1.55, -1.25, 10.85, W + 1.58, EAVE - 0.3, 12.05); for (const z of [10.85, 12.05]) box('cadre', W + 1.55, -1.25, z - 0.03, W + 1.6, EAVE - 0.3, z + 0.03);
  for (const y of [-1.25, 1.05, FH + 0.1, EAVE - 0.3]) box('cadre', W + 1.55, y - 0.03, 10.85, W + 1.6, y + 0.03, 12.05);
  box('cadre', W + 1.55, 2.25, 10.4, W + 2.6, 2.35, 12.5);                                                 // auvent de l'entrée

  // ── Toiture : quatre pentes à 30 %, tuiles vieillies, débord formant chéneau, fenêtres de toit ──
  b.on('ext:top');
  hip(b, M.roof, -0.7, -0.7, W + 0.7, L + 0.7, EAVE + 0.02, RISE); box('cadre', -0.7, EAVE - 0.1, -0.7, W + 0.7, EAVE + 0.02, L + 0.7);
  box('stucco', -0.45, EAVE - 0.28, -0.45, W + 0.45, EAVE - 0.1, L + 0.45);
  for (const z of [7.5, 16, 24.5]) for (const s of [-1, 1]) b.geo(M.glassDark, new THREE.BoxGeometry(1.34, 0.05, 0.98), W / 2 + s * 4.6, EAVE + 0.02 + (W / 2 + 0.7 - 4.6) * 0.3 + 0.04, z, 0, 0, s * -0.29);
  const gy = EAVE + 0.0, gx0 = -0.76, gx1 = W + 0.76, gz0 = -0.76, gz1 = L + 0.76;                  // gouttières demi-rondes au bord du débord
  b.rod(M.cadre, [gx0, gy, gz0], [gx0, gy, gz1], 0.05, 8); b.rod(M.cadre, [gx1, gy, gz0], [gx1, gy, gz1], 0.05, 8); b.rod(M.cadre, [gx0, gy, gz0], [gx1, gy, gz0], 0.05, 8); b.rod(M.cadre, [gx0, gy, gz1], [gx1, gy, gz1], 0.05, 8);
  for (let x = -0.62; x < W + 0.7; x += 0.55) for (const z of [-0.7, L + 0.7]) box('oak', x, EAVE - 0.21, z < 0 ? z : z - 0.25, x + 0.07, EAVE - 0.09, z < 0 ? z + 0.25 : z);   // bouts de chevrons sous le débord
  for (let z = -0.62; z < L + 0.7; z += 0.55) for (const x of [-0.7, W + 0.7]) box('oak', x < 0 ? x : x - 0.25, EAVE - 0.21, z, x < 0 ? x + 0.25 : x, EAVE - 0.09, z + 0.07);
  for (const z of [12, 21]) { box('stucco', W / 2 - 0.35, EAVE + RISE - 0.5, z - 0.3, W / 2 + 0.35, EAVE + RISE + 0.85, z + 0.3); box('cadre', W / 2 - 0.42, EAVE + RISE + 0.85, z - 0.37, W / 2 + 0.42, EAVE + RISE + 0.93, z + 0.37); }   // souches sur le faîtage
  b.on('ctx');
  for (const [x, z] of [[0.18, -0.04], [W - 0.18, -0.04], [0.18, L + 0.04], [W - 0.18, L + 0.04]]) b.rod(M.cadre, [x, EAVE - 0.1, z], [x, -0.05, z], 0.04, 8);   // descentes d'eau pluviale aux angles

  // ── Jardins hauts à l'Ouest (logements 05 à 08), au niveau de l'étage ──
  const GW = -9.5, R = (s) => { let q = s; return () => { q = (q * 9301 + 49297) % 233280; return q / 233280; }; };
  box('earth', GW - 0.4, -3.4, -5.9, 0, FH - 0.32, 41.4);
  const garden = (z0, z1, seed, deco) => {
    box('socle', GW - 0.4, FH - 0.32, z0, 0, FH - 0.1, z1); box('grass', GW, FH - 0.1, z0, -3.2, FH - 0.02, z1); box('terrace', -3.2, FH - 0.1, z0, 0, FH - 0.015, z1);
    V.hedge(b, M, GW - 0.35, z0, GW + 0.3, z1, { h: 1.7, y: FH - 0.05 }); V.hedge(b, M, GW, z1 - 0.3, -3.4, z1 + 0.3, { h: 1.3, y: FH - 0.05 });
    if (deco === 'table') { b.push(-1.7, FH - 0.015, (z0 + z1) / 2, 90 * Math.PI / 180); F.outdoorTable(b, M, { w: 1.8, n: 3 }); b.pop(); }
    if (deco === 'sofa') { b.push(-1.5, FH - 0.015, (z0 + z1) / 2, Math.PI / 2); F.outdoorSofa(b, M, { w: 2.1 }); b.pop(); b.push(-6.3, FH - 0.02, z0 + 2.2, -Math.PI / 2); F.lounger(b, M, {}); b.pop(); b.push(-5.2, FH - 0.02, z0 + 1.2, 0); F.parasol(b, M, { r: 1.4 }); b.pop(); }
    V.tree(b, M, GW + 1.6, z0 + (z1 - z0) * (0.3 + R(seed)() * 0.4), { kind: seed % 2 ? 'olive' : 'oak', h: 4 + (seed % 3), r: 1.6 + (seed % 2) * 0.5, seed, y: FH - 0.05 });
    V.lavender(b, M, -3.5, z0 + 0.8, -3.5, z1 - 0.8, { y: FH - 0.05, seed });
  };
  if (has('villa')) garden(-0.4, 9.37, 3, 'table');
  garden(9.37, 15.9, 4, 'sofa'); garden(15.9, 22.9, 5, 'table'); garden(22.9, 41, 6, 'sofa');
  box('socle', GW - 0.4, FH - 0.32, -5.9, 0, FH - 0.1, -0.4); box('grass', GW - 0.4, FH - 0.1, -5.9, 0, FH - 0.02, -0.4);   // angle Nord-Ouest
  V.tree(b, M, -6.5, -3.4, { kind: 'pine', h: 9, r: 3.3, seed: 21, y: FH - 0.05 }); V.tree(b, M, -2.2, -4.3, { kind: 'oak', h: 6, r: 2.4, seed: 22, y: FH - 0.05 });
  box('stone', -0.4, -0.2, -5.9, 0, FH + 0.3, 0); box('stone', -0.4, -0.2, L, 0, FH + 0.3, 41.4);                                // soutènements en pierre sèche

  // ── Jardin du logement 01 au Nord, mur de pierre sèche conservé en limite ──
  box('socle', 0, -0.3, -5.9, W + 0.02, -0.08, 0); box('grass', 0, -0.08, -5.5, W, -0.02, -1.6); box('terrace', 0, -0.08, -1.6, W, -0.015, 0);
  box('stone', -0.4, -0.3, -5.9, W + 0.3, 1.15, -5.5); V.hedge(b, M, 0.4, -5.45, W - 0.4, -4.9, { h: 1.5, y: -0.03 });
  box('earth', 0, -3.4, -5.9, W, -0.3, 0); box('stone', W, -3.3, -5.9, W + 0.3, 0.1, 0); railing(b, M, W + 0.15, -5.5, W + 0.15, 0, 0.1, 0.9, 'cadre'); box('stone', W, -3.3, -5.9, 36.6, -1.4, -5.5);
  V.lavender(b, M, 2, -2.2, 15, -2.2, { y: -0.03, seed: 9 }); V.oleander(b, M, 13.5, -4.2, { r: 0.8, y: -0.03, seed: 3 });

  // ── Jardins des duplex à l'Est, puis terrasse de la piscine 1,30 m plus bas ──
  if (has('duplex')) {
    box('socle', W, -0.3, 13.15, 22.31, -0.1, 25.88); box('terrace', W, -0.1, 13.15, 20.0, -0.015, 25.88); box('grass', 20.0, -0.1, 13.15, 22.31, -0.02, 25.88);
    for (const z of [13.2, 19.39, 25.3]) V.hedge(b, M, W + 0.3, z - 0.25, 22.3, z + 0.25, { h: 1.5, y: -0.03 });
    box('stone', 22.31, -1.3, 13.15, 22.71, 0.45, 25.88); railing(b, M, 22.5, 13.2, 22.5, 25.6, 0.45, 0.6, 'cadre');
    for (const z of [16.3, 22.5]) { b.push(19.0, -0.015, z, 0); F.outdoorTable(b, M, { w: 1.5, d: 1.5, n: 2, ends: true }); b.pop(); }
  }
  box('socle', W, -0.3, 25.88, 22.71, -0.1, L + 0.02); box('terrace', W, -0.1, 25.88, 22.31, -0.015, L); box('stone', 22.31, -1.3, 25.88, 22.71, 0.45, 41.4);   // terrasse du logement 04
  box('stone', 22.31, -1.3, 9.62, 22.71, 0.45, 13.15); box('earth', W, -3.3, 9.6, 22.31, -0.3, 41.4); box('terrace', W, -0.3, 9.62, 22.31, -0.02, 13.15);   // parvis de l'entrée
  box('terrace', 22.71, -1.6, 9.62, 33.4, -1.3, 29.6);                                                                           // plage en travertin
  box('wallTile', 26.75, -1.3, 14.95, 33.25, -1.27, 27.75); box('water', 27.0, -1.36, 15.2, 33.0, -1.265, 27.5);
  for (const [x0, z0, x1, z1] of [[26.7, 14.9, 33.3, 15.23], [26.7, 27.47, 33.3, 27.8], [26.7, 15.23, 27.03, 27.47], [32.97, 15.23, 33.3, 27.47]]) box('ashlar', x0, -1.3, z0, x1, -1.245, z1);   // margelle en pierre autour du bassin                 // bassin de 6 × 12,3 m
  for (let i = 0; i < 6; i++) { b.push(24.7, -1.3, 15.9 + i * 2.05, Math.PI / 2); F.lounger(b, M, {}); b.pop(); if (i % 2 === 0) { b.push(24.0, -1.3, 16.9 + i * 2.05, 0); F.parasol(b, M, { r: 1.5, h: 2.4 }); b.pop(); } }
  box('earth', 22.71, -3.4, 9.6, 33.4, -1.6, 41.4); V.hedge(b, M, 33.4, 11.2, 34.0, 29.6, { h: 1.2, y: -1.3 });

  // ── Jardin du logement 04 au Sud et espace commun paysagé ──
  box('socle', 0, -0.3, L, 22.31, -0.1, 41.4); box('grass', 0, -0.1, L + 3.2, 22.31, -0.02, 41.0); box('terrace', 0, -0.1, L, 22.31, -0.015, L + 3.2);
  V.hedge(b, M, 0.2, 40.9, 35.5, 41.5, { h: 1.8, y: -1.2 });
  for (const [x, z, k, h, r] of [[3.5, 38.2, 'pine', 10, 3.6], [10.5, 38.6, 'pine', 11, 3.8], [17.5, 37.8, 'pine', 9.5, 3.4], [26, 37.6, 'pine', 10, 3.6], [31, 34, 'oak', 6, 2.4]]) V.tree(b, M, x, z, { kind: k, h, r, seed: Math.round(x * 3), y: x < 22.3 ? -0.05 : -1.33 });
  box('grass', 22.71, -1.38, 29.6, 33.4, -1.3, 41.4);

  // ── Talus planté d'oliviers entre la piscine et l'avenue, mur et grille en limite ──
  box('earth', 33.4, -3.4, 9.6, 36.2, -1.5, 41.4); box('grass', 33.4, -1.5, 9.6, 36.2, -1.42, 41.4);
  for (let i = 0; i < 5; i++) V.tree(b, M, 35.0, 12.5 + i * 4.3, { kind: 'olive', h: 4.4, r: 1.7, seed: 30 + i, y: -1.45 });
  box('stone', 36.2, -3.6, 9.6, 36.6, -0.9, 41.4); railing(b, M, 36.4, 9.7, 36.4, 41.3, -0.9, 0.9, 'cadre');

  // ── Cour d'accès au Nord-Est : stationnement sous pergola végétalisée, porte du garage, portail ──
  box('paving', W + 0.02, -3.36, -5.5, 36.6, -3.3, 9.6);
  box('stone', W, -3.3, 9.2, 22.71, 0.45, 9.62); box('stone', 22.71, -3.3, 9.2, 36.2, -0.85, 9.62); box('cadre', 24, -3.3, 9.17, 26.4, -1.5, 9.2); box('cadre', 28.2, -3.3, 9.17, 29.4, -1.3, 9.2);   // locaux vélos, technique, déchets
  // la porte du garage, les vantaux du portail et la voiture qui arrive sont animés : voir makeArrival() plus bas
  for (const x of [19.4, 24.4, 29.4]) for (const z of [-4.6, 1.4]) box('cadre', x - 0.06, -3.3, z - 0.06, x + 0.06, -0.85, z + 0.06);
  for (const z of [-4.6, 1.4]) box('cadre', 19.3, -0.85, z - 0.05, 29.5, -0.75, z + 0.05); for (let x = 19.4; x <= 29.41; x += 1.25) box('cadre', x - 0.02, -0.8, -4.7, x + 0.02, -0.75, 1.5);
  { const g = new THREE.BufferGeometry(), pos = [], nor = [], uv = [], rr = R(77);                                             // feuillage de la pergola
    for (let i = 0; i < 420; i++) { const x = 19.2 + rr() * 10.4, z = -4.8 + rr() * 6.4, y = -0.72 + rr() * 0.22, s = 0.28 + rr() * 0.22, a = rr() * 6.28, cx = Math.cos(a) * s, cz = Math.sin(a) * s;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(x + u * cx - v * cz, y + (u + v) * 0.03, z + u * cz + v * cx); nor.push(0, 1, 0); uv.push((u + 1) / 2, (v + 1) / 2); } }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); b.add(M.leafBroad, g); }
  car(b, M, 21.9, -3.3, -1.6, 0, 'carGrey'); car(b, M, 26.9, -3.3, -1.5, 0, 'white');      // l'allée vers le garage reste libre
  for (const z of [4.6, 8.9]) { box('stucco', 36.0, -3.4, z - 0.3, 36.7, -1.2, z + 0.3); box('stuccoDark', 35.9, -1.2, z - 0.4, 36.8, -1.05, z + 0.4); }      // piliers du portail
  box('stone', 36.2, -3.6, -5.9, 36.6, -1.6, 4.3); V.hedge(b, M, 30.5, -5.4, 36.0, -4.6, { h: 1.6, y: -3.3 });
  V.oleander(b, M, 33.5, -2.6, { r: 1.0, y: -3.3, seed: 5 }); V.oleander(b, M, 33.8, 1.6, { r: 0.8, y: -3.3, seed: 6 }); V.cypress(b, M, 32.4, -3.6, { h: 6.5, y: -3.3 });

  // ── Avenue Paul-Cézanne : chaussée en pente douce vers le Nord, trottoirs ──
  const slope = 0.05, z0 = 6, yAt = (z) => -3.3 + Math.max(0, z - z0) * slope;
  const road = (m, x0, x1, up) => { box(m, x0, -3.7, -80, x1, -3.3 + up, z0); b.geo(M[m], new THREE.BoxGeometry(x1 - x0, 0.4, 90), (x0 + x1) / 2, -3.3 + 45 * slope - 0.2 + up, z0 + 45, -Math.atan(slope), 0, 0); };
  road('road', 38.0, 44.6, 0); road('paving', 36.6, 38.0, 0.12); road('paving', 44.6, 46.0, 0.12); road('earth', 46.0, 130, 0.1);
  for (let z = -40; z < 80; z += 9) b.geo(M.white, new THREE.BoxGeometry(0.12, 0.02, 3), 41.3, yAt(z) + 0.012, z, z > z0 ? -Math.atan(slope) : 0, 0, 0);

  // ── Voisinage : maisons et jardins des parcelles alentour, arbres de haute tige ──
  house(b, M, 56, -3.25, 2, 13, 9, 0.12, 5.6); house(b, M, 58, yAt(30) - 0.05, 30, 11, 10, -0.1, 3.2, 'massing'); house(b, M, 55, -3.25, -24, 12, 9, 0.2, 5.6, 'massing');
  house(b, M, 9, -0.6, 58, 14, 9, 0.08, 5.6); box('wallTile', 20.5, -0.75, 53.5, 26.5, -0.7, 57.5); box('water', 20.8, -0.8, 53.8, 26.2, -0.68, 57.2);
  house(b, M, 6, 0.2, -24, 12, 9, -0.06, 5.6, 'massing'); house(b, M, -30, 2.6, 6, 10, 13, 0.1, 5.6); house(b, M, -34, 2.6, 34, 10, 12, -0.05, 3.2, 'massing');
  box('earth', -70, -3.4, -60, GW - 0.4, 2.55, 80); box('earth', GW - 0.4, -3.4, -60, 36.6, 0.1, -5.9); box('earth', GW - 0.4, -3.4, 41.4, 36.6, -0.7, 80);
  for (const [x, z, k, h, y] of [[-16, -13, 'pine', 11, 2.55], [-18, 17, 'pine', 10, 2.55], [-13, 27, 'oak', 8, 2.55], [-18, 38, 'pine', 12, 2.55], [-24, 22, 'cypress', 9, 2.55], [-12, 46, 'pine', 10, 2.55],
    [4, -11, 'pine', 12, 0.1], [14, -13, 'oak', 8, 0.1], [24, -12, 'pine', 10, 0.1], [-6, -14, 'cypress', 9, 0.1], [30, -16, 'olive', 5, 0.1],
    [5, 46, 'pine', 11, -0.7], [16, 47, 'oak', 7, -0.7], [30, 46, 'pine', 10, -0.7], [-4, 50, 'cypress', 9, -0.7],
    [49, -8, 'pine', 10, -3.25], [50, 14, 'olive', 5, yAt(14)], [51, 22, 'cypress', 9, yAt(22)], [49, 40, 'pine', 11, yAt(40)], [64, 12, 'pine', 12, yAt(12)], [66, 44, 'oak', 8, yAt(44)], [62, -14, 'cypress', 10, -3.25]]) {
    if (k === 'cypress') V.cypress(b, M, x, z, { h, y }); else V.tree(b, M, x, z, { kind: k, h, r: h * (k === 'pine' ? 0.34 : 0.4), seed: Math.round(x * 7 + z * 13), y });
  }
  V.hedge(b, M, 46.4, -40, 47.0, 5.5, { h: 1.8, y: -3.25 }); V.hedge(b, M, -10.5, -5.9, -9.9, 41.4, { h: 1.8, y: 2.55 });
  b.pop(); b.on('ext');
}

/* ── Arrivée à la résidence : un SUV sombre remonte l'avenue, tourne vers le portail, attend qu'il s'ouvre, traverse la cour,
   attend la porte du garage et y entre ; portail et porte se referment derrière lui. Ce sont des objets à part (pas fusionnés
   avec le décor) : la voiture, ses roues, les deux vantaux et la porte bougent. Ils ne projettent pas d'ombre (la carte d'ombre
   du site n'est pas recalculée à chaque image) : une ombre de contact douce suit la voiture. Tout est créé au chargement. */
const GATE_X = 36.35, GATE_Z = [4.95, 8.55], LANE_Z = 6.75, DOOR = { x: 17.39 + 0.053, y0: -3.28, y1: -0.75, z0: 3.4, z1: 8.3 };

/* SUV de luxe (5 × 2 m) : caisse aux passages de roues découpés, vitrage sombre, pavillon couleur caisse, barres de toit,
   feux avant à LED, bandeau de feux arrière sur toute la largeur, jantes à cinq branches qui tournent. Avant vers +z. */
function makeSuv(M) {
  const paint = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.26, metalness: 0.55 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0x9c9fa3, roughness: 0.32, metalness: 0.85 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x2a0503, roughness: 0.4, emissive: 0xff2414, emissiveIntensity: 0.9 });
  const ext = (pts, depth, bevel) => {                     // profil (z, y) extrudé selon x et centré
    const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 6 });
    g.rotateY(Math.PI / 2); g.translate(-(depth - 2 * bevel) / 2, 0, 0); return g;
  };
  const arch = (zc) => { const p = []; for (let k = 0; k <= 12; k++) { const a = Math.PI - (Math.PI * k) / 12; p.push([zc + 0.43 * Math.cos(a), 0.3 + 0.43 * Math.sin(a)]); } return p; };
  const body = [[-2.38, 0.3], ...arch(-1.45), ...arch(1.45), [2.36, 0.3], [2.46, 0.44], [2.47, 0.68], [2.41, 0.86], [2.24, 0.97], [0.98, 1.07], [-2.14, 1.07], [-2.37, 1.02], [-2.45, 0.85], [-2.45, 0.5]];
  const glass = [[0.97, 1.0], [0.04, 1.57], [-1.62, 1.6], [-2.16, 1.1], [-2.18, 1.0]];
  const roof = [[0.12, 1.555], [-1.66, 1.585], [-1.62, 1.655], [0.06, 1.625]];
  const parts = new Map(); const put = (m, g) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(g); };
  put(paint, ext(body, 1.96, 0.06)); put(M.glassDark, ext(glass, 1.66, 0.04)); put(paint, ext(roof, 1.52, 0.03));
  const box = (m, x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); put(m, g); };
  const rod = (m, a, c, r) => { const d = new THREE.Vector3(...c).sub(new THREE.Vector3(...a)), g = new THREE.CylinderGeometry(r, r, d.length(), 8); g.translate(0, d.length() / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); g.translate(...a); put(m, g); };
  for (const s of [-1, 1]) {
    box(M.black, s * 0.862, 1.06, -0.62, s * 0.872, 1.56, -0.5);                                 // montant central
    rod(M.black, [s * 0.8, 1.05, 0.96], [s * 0.76, 1.57, 0.06], 0.028);                          // montants de pare-brise
    rod(M.cadre, [s * 0.66, 1.69, 0.0], [s * 0.66, 1.69, -1.55], 0.018);                          // barres de toit
    box(M.black, s * 0.98, 1.05, 0.78, s * 1.08, 1.16, 0.9);                                       // rétroviseurs
    box(M.led, s * 0.42, 0.8, 2.46, s * 0.86, 0.845, 2.5);                                         // feux avant
    box(M.black, s * 0.99, 0.32, -0.98, s * 1.0, 0.42, 0.98);                                      // bas de caisse
  }
  box(M.black, -0.55, 0.42, 2.49, 0.55, 0.68, 2.51); box(M.black, -0.95, 0.3, 2.42, 0.95, 0.4, 2.52);   // calandre, bouclier
  box(tail, -0.9, 0.93, -2.478, 0.9, 0.975, -2.462);                                              // bandeau des feux arrière
  box(M.black, -0.85, 0.3, -2.49, 0.85, 0.44, -2.4);
  const car = new THREE.Group();
  for (const [m, gs] of parts) { const mesh = new THREE.Mesh(mergeAll(gs), m); mesh.castShadow = false; mesh.receiveShadow = true; car.add(mesh); }
  // roues : pneu, jante à cinq branches ; les roues avant braquent
  const tire = new THREE.CylinderGeometry(0.37, 0.37, 0.27, 26); tire.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const sz of [-1.45, 1.45]) for (const sx of [-1, 1]) {
    const steer = new THREE.Group(); steer.position.set(sx * 0.86, 0.37, sz); car.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    spin.add(new THREE.Mesh(tire, M.black));
    const rg = [new THREE.CylinderGeometry(0.255, 0.255, 0.02, 24).rotateZ(Math.PI / 2).translate(sx * 0.13, 0, 0)];
    for (let k = 0; k < 5; k++) { const g = new THREE.BoxGeometry(0.02, 0.05, 0.24); g.translate(sx * 0.142, 0, 0.12); g.rotateX((k * 2 * Math.PI) / 5); rg.push(g); }
    spin.add(new THREE.Mesh(mergeAll(rg.slice(0, 1)), rimM), new THREE.Mesh(mergeAll(rg.slice(1)), M.black));
    spin.children.forEach((m) => { m.castShadow = false; m.receiveShadow = true; });
    wheels.push({ steer, spin, front: sz > 0 });
  }
  // ombre de contact : dégradé doux sous la caisse
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g2 = c.getContext('2d');
  const grd = g2.createRadialGradient(32, 64, 6, 32, 64, 62); grd.addColorStop(0, 'rgba(0,0,0,0.62)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.42)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g2.setTransform(1, 0, 0, 2, 0, -64); g2.fillStyle = grd; g2.fillRect(0, 0, 64, 128);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false, color: 0xffffff }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.025; sh.renderOrder = 2; car.add(sh);
  return { car, wheels, tail };
}
function mergeAll(gs) {
  if (gs.length === 1) return gs[0];
  const pos = [], nor = [], uv = [];
  for (const g of gs) { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); if (n.attributes.uv) uv.push(...n.attributes.uv.array); else for (let i = 0; i < n.attributes.position.count; i++) uv.push(0, 0); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  m.computeBoundingSphere(); return m;
}

/* Trajet : remontée de l'avenue dans la voie de droite, virage à gauche vers le portail, puis tout droit jusqu'au fond du garage. */
function arrivalPath() {
  const pts = [], add = (x, z) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(x - l[0], z - l[1]) > 1e-6) pts.push([x, z]); };
  const LX = 43.2, R = 5.4, cx = LX - R, cz = LANE_Z + R;
  for (let z = 58; z > cz; z -= 0.1) add(LX, z);
  for (let k = 0; k <= 90; k++) { const a = (-Math.PI / 2) * (k / 90); add(cx + R * Math.cos(a), cz + R * Math.sin(a)); }
  for (let x = cx - 0.1; x > 17.39 - 3.2; x -= 0.1) add(x, LANE_Z);
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, s, len: s[s.length - 1] };
}

export function makeArrival(M, o) {
  const group = new THREE.Group(); group.name = 'arrivee'; group.position.set(-o[0], -o[1], -o[2]);
  // ouverture du garage : un fond sombre derrière la porte (la voiture qui entre disparaît derrière lui, dans le volume du soubassement)
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.z1 - DOOR.z0 - 0.04, DOOR.y1 - DOOR.y0 - 0.02), new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 1 }));
  dark.rotation.y = Math.PI / 2; dark.position.set(17.39 + 0.027, (DOOR.y0 + DOOR.y1) / 2 - 0.01, (DOOR.z0 + DOOR.z1) / 2); group.add(dark);
  // porte de garage : se replie vers le haut (pivot sous le linteau)
  const door = new THREE.Group(); door.position.set(DOOR.x, DOOR.y1, (DOOR.z0 + DOOR.z1) / 2); group.add(door);
  { const b = new Batch(); b.box(M.garage, -0.019, DOOR.y0 - DOOR.y1, -(DOOR.z1 - DOOR.z0) / 2, 0.019, 0, (DOOR.z1 - DOOR.z0) / 2); b.build(door); }
  // portail : deux vantaux à barreaudage, pivotant sur les piliers vers l'intérieur de la cour
  const vanes = GATE_Z.map((zh, i) => {
    const p = new THREE.Group(); p.position.set(GATE_X, -3.3, zh); group.add(p);
    const b = new Batch(), L = Math.abs(GATE_Z[1] - GATE_Z[0]) / 2 - 0.03; railing(b, M, 0, 0, 0, i ? -L : L, 0, 1.75, 'cadre'); b.build(p);
    return { p, sign: i ? 1 : -1 };
  });
  const { car, wheels, tail } = makeSuv(M); group.add(car);
  group.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  const P = arrivalPath();
  const frontAt = (i) => { const [x, z] = P.pts[i], j = Math.min(i + 1, P.pts.length - 1), k = Math.max(i - 1, 0); const dx = P.pts[j][0] - P.pts[k][0], dz = P.pts[j][1] - P.pts[k][1], l = Math.hypot(dx, dz) || 1; return [x + (dx / l) * 2.5, z + (dz / l) * 2.5]; };
  const idx = (s) => { let lo = 0, hi = P.s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.s[m] < s) lo = m; else hi = m; } return lo; };
  let stopGate = P.len, stopDoor = P.len;
  for (let i = 0; i < P.pts.length; i++) { const f = frontAt(i); if (stopGate === P.len && f[0] <= GATE_X + 0.9) stopGate = P.s[i]; if (f[0] <= DOOR.x + 0.75) { stopDoor = P.s[i]; break; } }
  // hauteur du sol sous un point : avenue en pente douce au Sud, trottoir surélevé de 12 cm, cour à −3,30
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ground = (x, z) => { const road = -3.3 + Math.max(0, z - 6) * 0.05; const kerb = ss(36.45, 36.75, x) * (1 - ss(37.85, 38.15, x)) * 0.12; return -3.3 + (road + 3.3) * ss(36.45, 36.75, x) + kerb; };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const st = { s: 0, v: 0, phase: 'idle', t: 0, gate: 0, door: 0, roll: 0, active: false };

  function place() {
    const i = idx(st.s), j = Math.min(i + 1, P.pts.length - 1), f = P.s[j] > P.s[i] ? (st.s - P.s[i]) / (P.s[j] - P.s[i]) : 0;
    const x = P.pts[i][0] + (P.pts[j][0] - P.pts[i][0]) * f, z = P.pts[i][1] + (P.pts[j][1] - P.pts[i][1]) * f;
    const a = P.pts[Math.max(0, i - 3)], c = P.pts[Math.min(P.pts.length - 1, i + 3)], yaw = Math.atan2(c[0] - a[0], c[1] - a[1]);
    const dx = Math.sin(yaw), dz = Math.cos(yaw), yf = ground(x + dx * 1.45, z + dz * 1.45), yr = ground(x - dx * 1.45, z - dz * 1.45);
    car.position.set(x, (yf + yr) / 2, z); car.rotation.set(0, 0, 0); car.rotation.y = yaw; car.rotateX(-Math.atan2(yf - yr, 2.9));
    // braquage des roues avant : d'après la courbure du trajet
    const b0 = P.pts[Math.min(P.pts.length - 1, i + 8)], yaw2 = Math.atan2(b0[0] - c[0], b0[1] - c[1]); let dy = yaw2 - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    for (const w of wheels) { w.spin.rotation.x = st.roll; if (w.front) w.steer.rotation.y = Math.max(-0.5, Math.min(0.5, dy * 6)); }
    for (const v of vanes) v.p.rotation.y = v.sign * (Math.PI / 2) * ease(st.gate) * 0.97;
    door.scale.y = Math.max(0.02, 1 - ease(st.door) * 0.98);
  }
  function drive(dt, stop, vmax) {
    const rem = stop - st.s, vb = Math.sqrt(Math.max(0, 2 * 2.2 * rem)), cruise = car.position.z > LANE_Z + 8 ? vmax : Math.min(vmax, 3.2);          // allure de ville sur l'avenue, au pas dans le virage et la cour
    const v0 = st.v; st.v = Math.max(0, Math.min(st.v + 2.4 * dt, cruise, vb)); st.s = Math.min(stop, st.s + st.v * dt); st.roll += (st.v * dt) / 0.37;
    tail.emissiveIntensity = st.v < v0 - 1e-3 || st.v < 0.05 ? 2.6 : 0.9;                // feux stop au freinage et à l'arrêt
    return rem < 0.02;
  }
  const api = {
    group, car,
    reset() { Object.assign(st, { s: P.len, v: 0, phase: 'idle', t: 0, gate: 0, door: 0, active: false }); tail.emissiveIntensity = 0.9; place(); },
    start() { Object.assign(st, { s: 0, v: 7, phase: 'toGate', t: 0, gate: 0, door: 0, active: true }); place(); },
    get active() { return st.active; },
    /* Avance l'animation ; renvoie true tant que quelque chose bouge (l'image doit être redessinée). */
    update(dt) {
      if (!st.active) return false;
      st.t += dt;
      const gateBehind = car.position.x < GATE_X - 5.4;
      if (st.phase === 'toGate') { if (drive(dt, stopGate, 7.5)) { st.phase = 'gateOpen'; st.t = 0; } }
      else if (st.phase === 'gateOpen') { st.gate = Math.min(1, Math.max(0, (st.t - 0.5) / 3.4)); if (st.t > 4.2) { st.phase = 'toDoor'; st.t = 0; } }
      else if (st.phase === 'toDoor') { if (drive(dt, stopDoor, 3.4)) { st.phase = 'doorOpen'; st.t = 0; } }
      else if (st.phase === 'doorOpen') { st.door = Math.min(1, Math.max(0, (st.t - 0.4) / 3.6)); if (st.t > 4.3) { st.phase = 'inside'; st.t = 0; } }
      else if (st.phase === 'inside') { if (drive(dt, P.len, 2.2)) { st.phase = 'doorClose'; st.t = 0; } }
      else if (st.phase === 'doorClose') { st.door = Math.max(0, 1 - Math.max(0, st.t - 0.8) / 3.6); if (st.door <= 0 && st.gate <= 0) { st.active = false; tail.emissiveIntensity = 0.9; } }
      if (gateBehind && st.phase !== 'gateOpen' && st.phase !== 'toGate') st.gate = Math.max(0, st.gate - dt / 3.4);   // le portail se referme derrière la voiture
      place();
      return true;
    },
  };
  api.reset();
  return api;
}
