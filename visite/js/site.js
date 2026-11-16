/* 59 Cézanne — visite 3D : la résidence et ses abords, d'après le dossier de plans (plan de masse, niveaux 0 à 2, quatre façades).
   Repère de l'immeuble : x de la façade Ouest (0) à la façade Est (17,39 m), z de la façade Nord (0) à la façade Sud (32,2 m),
   y = 0 au plancher du rez-de-jardin (289,6 NGF). Étage à +2,9 m, égout de toiture à +5,8 m, terrasse de la piscine à −1,3 m,
   cour d'accès et garage à −3,3 m. L'avenue Paul-Cézanne longe la parcelle à l'Est, la Sainte-Victoire est dans cet axe.
   Seuls les deux logements à vendre sont détaillés (plans.js) ; le reste de l'immeuble est traité en volumes fidèles aux façades :
   enduit grège, cadres métalliques gris, volets coulissants taupe, garde-corps à barreaudage, tour de circulation en pierre, tuiles. */
import * as THREE from 'three';
import { F, V } from 'v3d/furniture';
import { railing } from 'v3d/build';

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
  for (const lv of h > 4 ? [0.3, 3.1] : [0.3]) for (let i = 0; i < Math.round(w / 3.2); i++) { const a = -w / 2 + (w / Math.round(w / 3.2)) * (i + 0.5); for (const s of [-1, 1]) b.box(M.glassDark, a - 0.7, lv, s > 0 ? d / 2 : -d / 2 - 0.03, a + 0.7, lv + 2.1, s > 0 ? d / 2 + 0.03 : -d / 2); }
  if (w >= d) { b.push(0, 0, 0, Math.PI / 2); hip(b, M.roof, -d / 2 - 0.5, -w / 2 - 0.5, d / 2 + 0.5, w / 2 + 0.5, h, Math.min(w, d) * 0.19); b.pop(); } else hip(b, M.roof, -w / 2 - 0.5, -d / 2 - 0.5, w / 2 + 0.5, d / 2 + 0.5, h, Math.min(w, d) * 0.19);
  b.box(M.stuccoDark, -w / 2 - 0.5, h - 0.14, -d / 2 - 0.5, w / 2 + 0.5, h, d / 2 + 0.5);
  b.pop();
}

/* o = origine du logement courant dans le repère de l'immeuble ; skip = logements détaillés ailleurs ('villa', 'duplex'). */
export function buildSite(b, M, { o, skip }) {
  const { W, L, FH, EAVE, RISE } = SITE, has = (k) => !skip.includes(k), G = 0.012;
  b.push(-o[0], -o[1], -o[2]); b.on('ctx');
  const box = (m, x0, y0, z0, x1, y1, z1) => b.box(M[m], x0, y0, z0, x1, y1, z1);

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
  b.on('ctx');

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
  box('wallTile', 26.75, -1.3, 14.95, 33.25, -1.27, 27.75); box('water', 27.0, -1.36, 15.2, 33.0, -1.265, 27.5);                 // bassin de 6 × 12,3 m
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
  box('garage', W + 0.02, -3.28, 3.4, W + 0.06, -0.75, 8.3);                                                                     // porte du garage
  for (const x of [19.4, 24.4, 29.4]) for (const z of [-4.6, 1.4]) box('cadre', x - 0.06, -3.3, z - 0.06, x + 0.06, -0.85, z + 0.06);
  for (const z of [-4.6, 1.4]) box('cadre', 19.3, -0.85, z - 0.05, 29.5, -0.75, z + 0.05); for (let x = 19.4; x <= 29.41; x += 1.25) box('cadre', x - 0.02, -0.8, -4.7, x + 0.02, -0.75, 1.5);
  { const g = new THREE.BufferGeometry(), pos = [], nor = [], uv = [], rr = R(77);                                             // feuillage de la pergola
    for (let i = 0; i < 420; i++) { const x = 19.2 + rr() * 10.4, z = -4.8 + rr() * 6.4, y = -0.72 + rr() * 0.22, s = 0.28 + rr() * 0.22, a = rr() * 6.28, cx = Math.cos(a) * s, cz = Math.sin(a) * s;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(x + u * cx - v * cz, y + (u + v) * 0.03, z + u * cz + v * cx); nor.push(0, 1, 0); uv.push((u + 1) / 2, (v + 1) / 2); } }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); b.add(M.leafBroad, g); }
  car(b, M, 21.9, -3.3, -1.6, 0, 'carGrey'); car(b, M, 26.9, -3.3, -1.5, 0, 'white'); car(b, M, 31.5, -3.3, 6.4, 1.3, 'carDark');
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
