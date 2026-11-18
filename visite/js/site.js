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
import { buildPool } from 'v3d/pool';

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
/* Profil (z, y) extrudé selon x et centré, arêtes adoucies : carrosseries des voitures. */
function extrudeProfile(pts, depth, bevel) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6 });
  g.rotateY(Math.PI / 2); g.translate(-(depth - 2 * bevel) / 2, 0, 0); return g;
}
const wheelArch = (zc, r, y0) => { const p = []; for (let k = 0; k <= 10; k++) { const a = Math.PI - (Math.PI * k) / 10; p.push([zc + r * Math.cos(a), y0 + r * Math.sin(a)]); } return p; };

/* Voiture en stationnement : berline compacte sans marque (caisse profilée, pavillon vitré, passages de roue, jantes). */
function car(b, M, x, y, z, rot, paint) {
  b.push(x, y, z, rot);
  const body = [[-2.12, 0.27], ...wheelArch(-1.32, 0.39, 0.27), ...wheelArch(1.32, 0.39, 0.27), [2.1, 0.27], [2.2, 0.4], [2.21, 0.6], [2.12, 0.74], [1.0, 0.88], [-1.86, 0.9], [-2.1, 0.85], [-2.19, 0.7], [-2.19, 0.44]];
  const cabin = [[0.98, 0.84], [0.16, 1.35], [-1.2, 1.37], [-1.84, 0.93], [-1.86, 0.84]];
  const top = [[0.1, 1.335], [-1.22, 1.355], [-1.18, 1.41], [0.05, 1.39]];
  b.geo(M[paint], extrudeProfile(body, 1.8, 0.06)); b.geo(M.glassDark, extrudeProfile(cabin, 1.54, 0.04)); b.geo(M[paint], extrudeProfile(top, 1.4, 0.03));
  for (const sx of [-1, 1]) {
    for (const sz of [-1.32, 1.32]) {
      b.geo(M.black, new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20), sx * 0.79, 0.33, sz, 0, 0, Math.PI / 2);
      b.geo(M.steel, new THREE.CylinderGeometry(0.21, 0.21, 0.02, 16), sx * 0.915, 0.33, sz, 0, 0, Math.PI / 2);
    }
    b.box(M.black, sx * 0.905 - 0.005, 0.86, -0.66, sx * 0.905 + 0.005, 1.33, -0.56);            // montant central
    b.box(M.black, sx * 0.93 - 0.06, 0.86, 0.72, sx * 0.93 + 0.06, 0.96, 0.84);                  // rétroviseur
  }
  b.box(M.black, -0.6, 0.36, 2.2, 0.6, 0.56, 2.225); b.box(M.black, -0.8, 0.27, -2.21, 0.8, 0.4, -2.17);   // calandre, bouclier arrière
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

/* ── Cotes du plan de masse (indice E) et du niveau 0, ramenées dans le repère de l'immeuble ──────────────────────────────
   Le plan est tourné de 8,7° par rapport à l'immeuble : il a été redressé sur l'emprise de la toiture et le bassin, à l'échelle graphique
   (34,7 px/m). Niveaux : y = NGF − 289,6. */
const COUR = -3.3;                                         // cour d'accès, voie interne et garage : 286,30
const TERR = -1.3;                                         // terrasse de la piscine et espace commun : 288,30
const LIM_E = 39.7;                                        // limite de propriété le long de l'avenue
const GATE_X = 28.67, GATE_Z = [3.25, 7.42];               // portail entre deux piliers enduits (plan du niveau 0)
const LANE_Z = 5.33, DOOR = { x: 17.39 + 0.053, y0: -3.28, y1: -0.75, z0: 2.95, z1: 7.65 };
/* Avenue Paul-Cézanne : TN relevés le long de la limite (284,66 au Nord, 285,00 face à l'entrée, 285,41 … 285,92 au Sud). */
const yAv = (z) => -4.6 + 0.029 * (z - 4);
const ROAD = [40.6, 46.4];                                 // bordures de la chaussée ; trottoir existant de 0,9 m côté résidence
/* Accès véhicules en enrobé, pente 11,4 % (< 15 %) de la chaussée au portail ; au-delà, voie interne quasi plane (< 2 %). */
const RAMP_S = (yAv(LANE_Z) + 0.02 - COUR) / (LIM_E - GATE_X);
const yRamp = (x) => (x <= GATE_X ? COUR : x >= LIM_E ? yAv(LANE_Z) + 0.02 : COUR + (x - GATE_X) * RAMP_S);
/* Accès piéton « trottoir à créer » : 5 % du trottoir de l'avenue jusqu'au hall, au pied de la tour. */
const PED0 = yAv(9) + 0.12, PED_X = 18.94;
const yPed = (x) => (x <= PED_X ? COUR : PED0 + (LIM_E - Math.min(LIM_E, x)) * ((COUR - PED0) / (LIM_E - PED_X)));
/* Limite Sud (clôture existante doublée d'une haie vive) : oblique dans le repère de l'immeuble. */
const zS = (x) => 38.7 - (x - 16) * 0.1366;
/* Limite Ouest (murets de soutènement existants) : s'écarte de la façade vers le Sud. */
const xW = (z) => (z < 9.2 ? -8.40 - 0.217 * z : -10.40 - 0.17 * (z - 9.2));        // nu du muret Ouest du jardin n°8 (raccord avec plans.js), puis la limite

/* Dalle polygonale [[x, z], …] dont le dessus suit y = yf(x, z) (linéaire sur le polygone : rampes, trottoirs, chaussée), épaisse de t. */
function surf(b, mat, pts, yf, t = 0.3) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 1, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), top = P.getY(i) > 0.5; P.setY(i, yf(x, z) - (top ? 0 : t)); }
  g.computeVertexNormals(); b.add(mat, g, null, true);
}
/* Mur suivant une polyligne [[x, z], …], épaisseur th centrée, entre y0 et y1 (ou y1(x, z) pour un chaperon qui suit le terrain). */
function wallPath(b, mat, pts, th, y0, y1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [cx, cz] = pts[i + 1], len = Math.hypot(cx - ax, cz - az), e0 = i ? th / 2 : 0, e1 = i < pts.length - 2 ? th / 2 : 0;
    const top = typeof y1 === 'function' ? y1((ax + cx) / 2, (az + cz) / 2) : y1;
    b.push(ax, 0, az, Math.atan2(-(cz - az), cx - ax)); b.box(mat, -e0, y0, -th / 2, len + e1, top, th / 2); b.pop();
  }
}
/* Clôture en panneaux de grillage rigide (fils verticaux soudés, plis horizontaux) sur poteaux, le long d'une polyligne. */
function fence(b, M, pts, yf, h = 1.5) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [cx, cz] = pts[i + 1], len = Math.hypot(cx - ax, cz - az), n = Math.max(1, Math.ceil(len / 2.5));
    b.push(ax, 0, az, Math.atan2(-(cz - az), cx - ax));
    for (let k = 0; k < n; k++) {
      const u0 = (len / n) * k, u1 = (len / n) * (k + 1), y = yf(ax + ((cx - ax) * (u0 + u1)) / 2 / len, az + ((cz - az) * (u0 + u1)) / 2 / len);
      b.box(M.cadre, u0 - 0.03, y - 0.3, -0.03, u0 + 0.03, y + h + 0.05, 0.03);                                   // poteau
      for (const yy of [0.08, h * 0.45, h - 0.02]) b.box(M.cadre, u0 + 0.03, y + yy - 0.004, -0.004, u1 - 0.03, y + yy + 0.004, 0.004);
      b.box(M.cadre, u0 + 0.03, y + h * 0.45 - 0.05, 0.004, u1 - 0.03, y + h * 0.45 - 0.042, 0.03);              // pli de rigidité
      for (let u = u0 + 0.15; u < u1 - 0.05; u += 0.25) b.box(M.cadre, u - 0.003, y + 0.06, -0.003, u + 0.003, y + h, 0.003);
    }
    if (i === pts.length - 2) { const y = yf(cx, cz); b.box(M.cadre, len - 0.03, y - 0.3, -0.03, len + 0.03, y + h + 0.05, 0.03); }
    b.pop();
  }
}

/* o = origine du logement courant dans le repère de l'immeuble ; skip = logements détaillés ailleurs ('villa', 'duplex'). */
export function buildSite(b, M, { o, skip }) {
  const { W, L, FH, EAVE, RISE } = SITE, has = (k) => !skip.includes(k), G = 0.012;
  /* Matériaux du catalogue végétal et minéral des abords, avec repli sur les matières existantes. */
  const MX = {
    travertine: M.travertine || M.terrace, gravel: M.gravel || M.paving, drystone: M.drystone || M.stone, asphaltLight: M.asphaltLight || M.paving,
    roofTile: M.roofTile || M.roof, rendering: M.rendering || M.stucco, mulch: M.mulch || M.earth,
  };
  const mat = (m) => (typeof m === 'string' ? MX[m] || M[m] : m);
  const ALMOND = V.shrub ? 'almond' : 'olive';                                      // l'amandier arrive avec le catalogue végétal enrichi
  /* Arbuste du catalogue végétal ; en son absence, une touffe sobre (laurier-rose pour les rosiers seulement : il est coûteux). */
  const shrub = (x, z, o2) => {
    if (V.shrub) return V.shrub(b, M, x, z, o2);
    const r = o2.r || 0.5, h = o2.h || r * 1.4, y = o2.y || 0;
    if (o2.kind === 'rose') return V.oleander(b, M, x, z, { r: Math.min(0.6, r), y, seed: o2.seed });
    b.sph(o2.kind === 'grass' ? M.leafCypress : M.hedge, x, y + h * 0.45, z, r, 1, (h * 0.55) / r, 1, 7);
  };
  b.push(-o[0], -o[1], -o[2]); b.on('ctx');
  const box = (m, x0, y0, z0, x1, y1, z1) => {
    b.box(mat(m), x0, y0, z0, x1, y1, z1);
    if (m === 'stone' && y1 - y0 > 0.6 && Math.min(x1 - x0, z1 - z0) < 0.5) b.box(M.ashlar, x0 - 0.03, y1 - 0.05, z0 - 0.03, x1 + 0.03, y1 + 0.004, z1 + 0.03);   // couvertine : 4 mm au-dessus du mur, jamais dans son plan
  };
  const S = (m, pts, yf, t) => surf(b, mat(m), pts, typeof yf === 'number' ? () => yf : yf, t);
  const R = (s) => { let q = s; return () => { q = (q * 9301 + 49297) % 233280; return q / 233280; }; };
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


  // ── Tour de circulation commune : pierre de taille, fente vitrée ; toit-terrasse inaccessible gravillonné (295,1) derrière l'acrotère (296,3) ──
  // Le plan de masse la montre de x = 15 à 18,94 : sa partie engagée dans l'immeuble émerge de la toiture (à partir de x = 16, là où
  // le pan passe sous la terrasse ; la toiture n'est pas évidée au-delà).
  box('ashlar', W, COUR, 9.62, W + 1.55, 6.5, 13.3); box('ashlar', 16.0, EAVE - 0.2, 9.62, W, 6.5, 13.1);
  for (const [x0, z0, x1, z1] of [[16.0, 9.62, W + 1.55, 9.82], [16.0, 13.1, W + 1.55, 13.3], [16.0, 9.82, 16.2, 13.1], [W + 1.35, 9.82, W + 1.55, 13.1]]) box('ashlar', x0, 6.5, z0, x1, 6.7, z1);
  box('cadre', 15.97, 6.7, 9.59, W + 1.58, 6.74, 13.33);                                                   // couvertine aluminium de l'acrotère
  box('gravel', 16.2, 6.5, 9.82, W + 1.35, 6.52, 13.1);                                                    // gravier ton sable
  box('glassDark', W + 1.55, -1.2, 10.85, W + 1.58, EAVE - 0.3, 12.05); for (const z of [10.85, 12.05]) box('cadre', W + 1.55, -1.2, z - 0.03, W + 1.6, EAVE - 0.3, z + 0.03);
  for (const y of [-1.2, 1.05, FH + 0.1, EAVE - 0.3]) box('cadre', W + 1.55, y - 0.03, 10.85, W + 1.6, y + 0.03, 12.05);
  // hall d'entrée au pied de la tour, au bout de l'accès piéton : façade vitrée à l'Est, auvent métallique éclairé par-dessous
  box('ashlar', W, COUR, 7.65, W + 1.55, -0.3, 7.95); box('ashlar', W, -0.62, 7.95, W + 1.55, -0.3, 9.62);
  box('glassDark', W + 1.48, COUR + 0.02, 7.95, W + 1.51, -0.62, 9.62);
  for (const z of [7.98, 8.75, 9.59]) box('cadre', W + 1.47, COUR, z - 0.03, W + 1.55, -0.62, z + 0.03);
  box('cadre', W + 1.47, -1.0, 7.95, W + 1.55, -0.94, 9.62); box('steel', W + 1.55, -2.35, 8.66, W + 1.58, -1.55, 8.69);   // imposte, bâton de tirage
  box('cadre', W + 1.55, -0.6, 7.75, W + 2.45, -0.5, 9.75); box('led', W + 1.62, -0.604, 8.0, W + 2.38, -0.6, 9.5);
  box('cadre', W + 1.55, COUR, 8.0, W + 2.3, COUR + 0.015, 9.5);                                            // tapis-brosse encastré

  // ── Toiture : quatre pentes à 30 %, tuiles romanes ton panaché vieilli, débord formant chéneau, six fenêtres de toit 100 × 140 ──
  b.on('ext:top');
  hip(b, mat('roofTile'), -0.7, -0.7, W + 0.7, L + 0.7, EAVE + 0.02, RISE); box('cadre', -0.7, EAVE - 0.1, -0.7, W + 0.7, EAVE + 0.02, L + 0.7);
  box('stucco', -0.45, EAVE - 0.28, -0.45, W + 0.45, EAVE - 0.1, L + 0.45);
  for (const z of [10.47, 15.47, 20.4]) for (const s of [-1, 1]) {                                          // de part et d'autre du faîtage (plan de masse)
    const x = W / 2 + s * 2.12, y = EAVE + 0.02 + (W / 2 + 0.7 - 2.12) * 0.3;
    b.geo(M.cadre, new THREE.BoxGeometry(1.46, 0.08, 1.06), x, y + 0.03, z, 0, 0, s * -0.2915); b.geo(M.glassDark, new THREE.BoxGeometry(1.34, 0.03, 0.94), x, y + 0.075, z, 0, 0, s * -0.2915);
  }
  const gy = EAVE + 0.0, gx0 = -0.76, gx1 = W + 0.76, gz0 = -0.76, gz1 = L + 0.76;                  // chéneau : bord arrondi du débord en béton
  b.rod(M.cadre, [gx0, gy, gz0], [gx0, gy, gz1], 0.05, 8); b.rod(M.cadre, [gx1, gy, gz0], [gx1, gy, gz1], 0.05, 8); b.rod(M.cadre, [gx0, gy, gz0], [gx1, gy, gz0], 0.05, 8); b.rod(M.cadre, [gx0, gy, gz1], [gx1, gy, gz1], 0.05, 8);
  for (const z of [12, 21]) { box('stucco', W / 2 - 0.35, EAVE + RISE - 0.5, z - 0.3, W / 2 + 0.35, EAVE + RISE + 0.85, z + 0.3); box('cadre', W / 2 - 0.42, EAVE + RISE + 0.85, z - 0.37, W / 2 + 0.42, EAVE + RISE + 0.93, z + 0.37); }   // souches sur le faîtage
  b.on('ctx');
  // descentes d'eau pluviale (aluminium RAL 7039) : aux angles et entre les logements de la façade Est
  for (const [x, z, y0] of [[0.18, -0.04, -0.05], [W - 0.18, -0.04, -0.05], [0.18, L + 0.04, -0.05], [W - 0.18, L + 0.04, -0.05], [W + 0.04, 19.45, -0.3], [W + 0.04, 25.55, -0.3]])
    b.rod(M.cadre, [x, EAVE - 0.1, z], [x, y0, z], 0.04, 8);
  // unités extérieures de pompe à chaleur à l'extrémité Ouest des façades Sud et Nord, sur plots, derrière une haie basse
  for (const x of [3.2, 4.4]) { box('white', x - 0.45, 0.05, L + 0.35, x + 0.45, 0.72, L + 0.7); box('cadre', x - 0.3, 0.12, L + 0.701, x + 0.3, 0.62, L + 0.704); box('concrete', x - 0.5, -0.1, L + 0.3, x + 0.5, 0.05, L + 0.75); }
  box('white', 0.9, 0.05, -0.7, 1.8, 0.72, -0.35); box('cadre', 1.05, 0.12, -0.704, 1.65, 0.62, -0.701); box('concrete', 0.85, -0.1, -0.75, 1.85, 0.05, -0.3);

  // ── Jardins hauts à l'Ouest (logements 05 à 08), au niveau de l'étage : quatre jardins séparés par des haies (9,37 · 16,27 · 23,27 · 29,4) ──
  S('earth', [[-14.5, 0.2], [-0.2, 0.2], [-0.2, zS(-0.2)], [-14.5, zS(-14.5)]], FH - 0.32, 6.0);
  const garden = (z0, z1, seed, deco) => {
    const gw = xW(z1) + 0.4;                                                                                  // le jardin s'élargit avec la limite Ouest
    box('socle', gw - 0.4, FH - 0.32, z0, 0, FH - 0.1, z1); box('grass', gw, FH - 0.1, z0, -3.2, FH - 0.02, z1); box('terrace', -3.2, FH - 0.1, z0, 0, FH - 0.015, z1);
    box('cadre', -3.206, FH - 0.08, z0, -3.2, FH - 0.004, z1);                                              // bordure acier entre pelouse et terrasse
    V.hedge(b, M, gw - 0.35, z0, gw + 0.3, z1, { h: 1.7, y: FH - 0.05 }); V.hedge(b, M, gw, z1 - 0.3, -3.4, z1 + 0.3, { h: 1.3, y: FH - 0.05 });
    if (deco === 'table') { b.push(-1.7, FH - 0.015, (z0 + z1) / 2, 90 * Math.PI / 180); F.outdoorTable(b, M, { w: 1.8, n: 3 }); b.pop(); }
    if (deco === 'sofa') { b.push(-1.5, FH - 0.015, (z0 + z1) / 2, Math.PI / 2); F.outdoorSofa(b, M, { w: 2.1 }); b.pop(); b.push(-6.3, FH - 0.02, z0 + 2.2, -Math.PI / 2); F.lounger(b, M, {}); b.pop(); b.push(-5.2, FH - 0.02, z0 + 1.2, 0); F.parasol(b, M, { r: 1.4 }); b.pop(); }
    V.lavender(b, M, -3.5, z0 + 0.8, -3.5, z1 - 0.8, { y: FH - 0.05, seed });
  };
  if (has('villa')) garden(-0.4, 9.37, 3, 'table');
  garden(9.2, 16.27, 4, 'sofa'); if (!has('villa')) V.hedge(b, M, xW(9.2) + 0.4, 9.25, -3.4, 9.75, { h: 1.3, y: FH - 0.05 });   // haie du n°7 le long du grillage du n°8
  garden(16.27, 23.27, 5, 'table'); garden(23.27, 29.4, 6, 'sofa');                     // façade Ouest : 9,0 · 6,9 · 7,0
  for (const z of [9.9, 23.8]) { box('white', -0.7, FH, z - 0.45, -0.35, FH + 0.67, z + 0.45); box('cadre', -0.704, FH + 0.07, z - 0.3, -0.701, FH + 0.57, z + 0.3); }   // unités extérieures de PAC (façade Ouest)
  // oliviers et amandiers « à planter » le long de la limite Ouest (plan de masse)
  for (const [x, z, k, h, r, sd] of [[-5.4, 4.0, ALMOND, 4.2, 1.7, 41], [-7.1, 6.6, 'olive', 4.4, 1.8, 42], [-9.2, 10.6, 'olive', 4.6, 1.9, 43], [-9.7, 13.6, ALMOND, 4.4, 1.8, 44],
    [-10.1, 17.6, 'olive', 4.8, 1.9, 45], [-10.8, 24.4, 'olive', 4.6, 1.9, 46], [-11.2, 28.2, ALMOND, 4.2, 1.7, 47]]) {
    if (z < 9.37 && !has('villa')) continue;                                                             // jardin n°8 : détaillé avec l'appartement-villa
    V.tree(b, M, x, z, { kind: k, h, r, seed: sd, y: FH - 0.05 });
  }
  // talus paysagés au Sud-Ouest, derrière le muret de soutènement (< 2 m) surmonté d'une grille qui ferme le jardin n°5
  S('grass', [[xW(29.4), 29.75], [-0.05, 29.75], [-0.05, zS(-0.05) - 0.05], [-14.45, zS(-14.45) - 0.05], [-14.45, 29.75]], FH - 0.24, 0.1);
  box('drystone', xW(29.4), 0.9, 29.4, -0.1, FH + 0.2, 29.75); railing(b, M, xW(29.4) + 0.2, 29.57, -0.2, 29.57, FH + 0.2, 0.9, 'cadre');
  for (const [x, z, sd] of [[-3.0, 31.5, 11], [-6.5, 33.0, 12], [-9.5, 31.2, 13], [-12.0, 34.5, 14]]) shrub(x, z, { kind: 'rosemary', r: 0.6, h: 0.7, y: FH - 0.26, seed: sd });
  V.lavender(b, M, -1.0, 30.6, -8.0, 30.6, { y: FH - 0.26, seed: 15 });
  // angle Nord-Ouest : prolongement du jardin n°1 (y = 0), puis talus paysagé qui remonte vers la parcelle voisine
  S('grass', [[-6, -5.6], [0, -5.6], [0, 0.1], [-6, 0.1]], -0.02, 3.3); S('grass', [[-14.5, -5.6], [-6, -5.6], [-6, 0.1], [-14.5, 0.1]], (x) => -0.02 + (-6 - x) * 0.3, 3.3);
  if (has('villa')) { box('drystone', -8.5, -0.3, 0.0, -0.03, FH + 0.4, 0.35); railing(b, M, -8.45, 0.175, -0.05, 0.175, FH + 0.4, 1.05, 'cadre'); }   // muret Nord du jardin n°8 (dessiné avec le logement quand il est détaillé)
  box('drystone', -14.45, -0.3, 0.0, -8.5, FH + 0.1, 0.35);
  wallPath(b, MX.drystone, [[xW(-5.9) - 1.3, -5.9], [xW(30) - 1.3, 30], [-14.2, zS(-14.2) - 0.3]], 0.4, 1.4, FH + 0.15);   // muret de soutènement existant (env. 1 m) en limite Ouest
  V.tree(b, M, -9.5, -3.4, { kind: 'pine', h: 9, r: 3.3, seed: 21, y: 1.0 }); V.tree(b, M, -2.2, -4.3, { kind: 'oak', h: 6, r: 2.4, seed: 22, y: -0.04 });
  box('stone', -0.4, -0.2, L, 0, FH + 0.3, zS(0));                                // soutènements en pierre sèche

  // ── Jardin du logement 01 au Nord, mur de pierre sèche conservé en limite ──
  box('socle', 0, -0.3, -5.35, W + 0.02, -0.08, 0); box('grass', 0, -0.08, -5.35, W, -0.02, -1.6); box('terrace', 0, -0.08, -1.6, W, -0.015, 0);
  box('drystone', -0.4, -0.3, -5.75, W + 0.3, 1.15, -5.35); V.hedge(b, M, 0.4, -5.3, W - 0.4, -4.75, { h: 1.5, y: -0.03 });
  box('earth', 0, -3.4, -5.9, W, -0.3, 0); box('stone', W, -3.3, -5.35, W + 0.3, 0.1, -2.45); railing(b, M, W + 0.15, -5.3, W + 0.15, -2.5, 0.1, 0.9, 'cadre');
  box('stone', W, -3.3, -2.45, W + 0.3, 0.1, 0); railing(b, M, W + 0.15, -2.45, W + 0.15, 0, 0.1, 0.9, 'cadre');
  V.lavender(b, M, 2, -2.2, 15, -2.2, { y: -0.03, seed: 9 }); shrub(13.5, -4.0, { kind: 'pittosporum', r: 0.8, h: 1.4, y: -0.03, seed: 3 });

  // ── Jardins des duplex (n°2 et n°3) puis terrasse de la piscine 1,30 m plus bas ──
  if (has('duplex')) {
    box('socle', W, -0.3, 13.15, 22.2, -0.1, 25.74); box('terrace', W, -0.1, 13.15, 20.0, -0.015, 25.74); box('grass', 20.0, -0.1, 13.15, 22.2, -0.02, 25.74);
    for (const z of [13.6, 19.39, 25.3]) V.hedge(b, M, W + 0.3, z - 0.25, 22.15, z + 0.25, { h: 1.5, y: -0.03 });
    box('stone', 22.2, -1.3, 13.15, 22.55, 0.0, 25.74); railing(b, M, 22.375, 13.2, 22.375, 25.6, 0.0, 1.04, 'cadre');
    for (const z of [16.3, 22.5]) { b.push(19.0, -0.015, z, 0); F.outdoorTable(b, M, { w: 1.5, d: 1.5, n: 2, ends: true }); b.pop(); }
  }
  // jardin du logement 04 (n°4) : terrasse au pied de la façade Sud, pelouse jusqu'à la clôture Sud ; muret de 1,3 m surmonté d'une grille côté piscine
  box('socle', W, -0.31, 25.74, 22.55, -0.1, L + 0.02); box('terrace', W, -0.1, 25.74, 22.2, -0.015, L);
  box('stone', 22.2, -1.3, 25.74, 22.55, 0.0, zS(22.4)); railing(b, M, 22.375, 25.8, 22.375, zS(22.4) - 0.1, 0.0, 1.04, 'cadre');
  S('socle', [[0, L], [22.2, L], [22.2, zS(22.2)], [0, zS(0)]], -0.1, 3.2);
  S('grass', [[0, L + 3.2], [22.2, L + 3.2], [22.2, zS(22.2) - 0.05], [0, zS(0) - 0.05]], -0.02, 0.05);
  box('terrace', 0, -0.1, L, 22.2, -0.015, L + 3.2);
  b.push(11.0, -0.015, L + 1.8, 0); F.outdoorTable(b, M, { w: 2.0, n: 3 }); b.pop();
  V.hedge(b, M, 0.6, L + 0.85, 8.0, L + 1.2, { h: 0.7, y: -0.02 });                                        // haie basse devant les unités de PAC
  // terrasse de la piscine en travertin (288,30) au-dessus des locaux, autour du bassin
  for (const [x0, z0, x1, z1] of [[18.94, 10.65, 31.1, 12.95], [18.94, 12.95, 22.55, 13.15], [22.55, 12.95, 26.34, 25.6], [32.34, 10.4, 33.3, 25.6], [26.34, 25.25, 32.34, 25.6], [32.2, 10.65, 32.34, 12.95]])
    box('travertine', x0, TERR - 0.04, z0, x1, TERR, z1);
  box('earth', 18.94, COUR - 0.1, 13.3, 33.3, TERR - 0.04, 25.6); box('drystone', 32.2, -4.1, 10.4, 33.3, TERR - 0.04, 13.3);
  // bassin enterré de 6 × 12,3 m, margelles en travertin, plage immergée, échelle, transats et douche (pool.js)
  buildPool(b, M, { PX0: 26.34, PX1: 32.34, PZ0: 12.95, PZ1: 25.25, y: TERR });
  // jardinière béton surélevée en rive de la terrasse, au-dessus des locaux : retour le long du local déchets
  for (const [x0, z0, x1, z1] of [[19.3, 9.95, 31.1, 10.65], [31.1, 9.95, 32.2, 12.95]]) {
    box('concrete', x0, TERR - 0.04, z0, x1, TERR + 0.5, z1); box('mulch', x0 + 0.1, TERR + 0.5, z0 + 0.1, x1 - 0.1, TERR + 0.52, z1 - 0.1);
  }
  { const r = R(91); for (let x = 19.8; x < 30.8; x += 1.1) { const k = Math.floor(r() * 3); if (k === 0) V.lavender(b, M, x - 0.3, 10.3, x + 0.3, 10.3, { y: TERR + 0.5, seed: Math.round(x * 3) }); else shrub(x, 10.3, { kind: k === 1 ? 'grass' : 'rosemary', r: 0.38, h: 0.6, y: TERR + 0.5, seed: Math.round(x * 7) }); }
    for (let z = 10.9; z < 12.8; z += 0.95) shrub(31.65, z, { kind: 'grass', r: 0.4, h: 0.7, y: TERR + 0.5, seed: Math.round(z * 11) });
    if (V.climber) V.climber(b, M, 19.4, TERR + 0.5, 9.94, 30.9, COUR + 0.2, 9.94, { seed: 93, density: 0.35 }); }   // retombées sur le mur des locaux

  // ── Espace commun paysagé, talus d'oliviers entre la piscine et l'avenue, mur de pierre conservé le long de l'avenue ──
  S('grass', [[22.55, 25.6], [33.3, 25.6], [33.3, zS(33.3) - 0.05], [22.55, zS(22.55) - 0.05]], TERR - 0.03, 1.3);
  const WALL_AV = [[32.2, 10.4], [35, 10.4], [36.85, 11.15], [38.35, 12.2], [39.15, 13.5], [39.42, 15], [39.42, zS(39.42) + 0.1]];
  const talus = (x) => TERR - 0.02 - (x - 33.3) * 0.067;                                                      // de 288,28 au bord de la terrasse à 287,90 derrière le mur
  S('grass', [[33.3, 10.62], [35, 10.62], [36.72, 11.35], [38.17, 12.37], [38.93, 13.6], [39.19, 15], [39.19, zS(39.19) - 0.05], [33.3, zS(33.3) - 0.05]], (x) => talus(x), 2.6);
  const wallTop = (x) => Math.max(-1.65, talus(Math.max(33.3, x)) + 0.1);                                    // arase 287,95, relevée là où le talus est plus haut
  wallPath(b, MX.drystone, WALL_AV, 0.45, -5.0, wallTop);
  fence(b, M, WALL_AV.slice(1), (x) => wallTop(x), 1.5);                                                      // clôture rigide de 1,5 m sur le mur
  for (const [x, z, k, h, r, sd] of [[37.1, 12.9, 'olive', 4.6, 1.8, 30], [37.2, 16.4, 'olive', 4.8, 1.9, 31], [37.2, 20.2, 'olive', 4.6, 1.8, 32], [37.2, 23.9, 'olive', 4.9, 1.9, 33], [37.1, 28.6, ALMOND, 4.6, 1.9, 34],
    [34.6, 32.6, 'pine', 9.5, 3.4, 35], [29.75, 33.6, 'pine', 9, 3.2, 36], [19.6, 36.1, 'pine', 10, 3.5, 37]]) V.tree(b, M, x, z, { kind: k, h, r, seed: sd, y: x > 33.3 ? talus(x) : x > 22.55 ? TERR - 0.03 : -0.02 });
  for (const [x, z, sd] of [[34.6, 14.5, 51], [35.0, 18.3, 52], [34.7, 22.1, 53], [35.1, 26.2, 54], [34.2, 29.8, 55]]) shrub(x, z, { kind: 'pittosporum', r: 0.7, h: 1.2, y: talus(x), seed: sd });
  V.lavender(b, M, 33.8, 13.2, 33.8, 25.2, { y: talus(33.8), seed: 56 });
  // pas japonais en travertin de la terrasse vers le banc sous les pins, banc en teck
  { const r = R(71); for (let k = 0; k < 7; k++) { const x = 27.2 + k * 0.55 + (r() - 0.5) * 0.15, z = 26.3 + k * 0.85; b.push(x, TERR - 0.03, z, 0.5 + r() * 0.4); b.box(MX.travertine, -0.3, -0.03, -0.22, 0.3, 0.012, 0.22); b.pop(); }
    b.push(31.4, TERR - 0.03, 32.3, -0.35); b.box(M.teak, -0.9, 0.42, -0.22, 0.9, 0.46, 0.22); for (const sx of [-0.75, 0.75]) b.box(M.cadre, sx - 0.03, 0, -0.2, sx + 0.03, 0.42, 0.2); b.pop(); }
  // clôture existante doublée d'une haie vive, en limite Sud (oblique)
  { const x0 = -12, x1 = 39.2, a = Math.atan2(-(zS(x1) - zS(x0)), x1 - x0), len = Math.hypot(x1 - x0, zS(x1) - zS(x0));
    for (let u = 0; u < len - 0.1; u += 2.2) { const x = x0 + (u / len) * (x1 - x0), yy = x < 0 ? FH - 0.27 : x < 22.55 ? -0.06 : TERR - 0.06; b.push(x, yy, zS(x) - 0.45, a); V.hedge(b, M, 0, -0.32, Math.min(2.3, len - u), 0.32, { h: 1.8 }); b.pop(); }
    fence(b, M, [[x0, zS(x0) + 0.05], [0, zS(0) + 0.05]], () => FH - 0.26, 1.5); fence(b, M, [[0, zS(0) + 0.05], [22.5, zS(22.5) + 0.05]], () => -0.04, 1.5); fence(b, M, [[22.9, zS(22.9) + 0.05], [x1, zS(x1) + 0.05]], () => TERR - 0.05, 1.5); }
  for (const [x, z, k, h, r] of [[4.0, 40.2, 'pine', 11, 3.7], [11.0, 39.4, 'pine', 10.5, 3.6], [25.5, 37.0, 'oak', 7, 2.8]]) V.tree(b, M, x, z, { kind: k, h, r, seed: Math.round(x * 3), y: x < 22.55 ? -0.04 : TERR - 0.05 });

  // ── Cour d'accès (286,30) : stationnement de 4 places dont 1 PMR, voie interne, pergola, muret de 1,6 m, massif conservé ──
  box('asphaltLight', W, COUR - 0.1, -2.15, GATE_X, COUR, 2.75);                                               // aire de stationnement : enrobé teinte claire
  box('road', W, COUR - 0.1, 2.75, GATE_X, COUR, 7.65);                                                        // voie interne en enrobé
  box('drystone', W, COUR - 0.1, -2.45, 28.97, -1.7, -2.15); box('drystone', GATE_X, COUR - 0.1, -2.15, 28.92, -1.7, 2.75);   // muret de soutènement h. 1,6 m, pierre sèche
  for (const x of [20.6, 23.1, 25.6]) box('white', x - 0.05, COUR, -2.05, x + 0.05, COUR + 0.004, 2.65);         // marquage des places
  for (let k = 0; k < 6; k++) { const z = -1.6 + k * 0.75; b.push(27.9, COUR + 0.002, z, -0.75); b.box(M.white, -0.6, 0, -0.04, 0.6, 0.004, 0.04); b.pop(); }   // zone de transfert de la place PMR
  box('white', 27.42, COUR, -2.05, 27.5, COUR + 0.004, 2.65); box('white', 25.9, COUR, 1.5, 26.9, COUR + 0.004, 2.4);   // pictogramme simplifié de la place PMR
  car(b, M, 21.85, COUR, 0.3, Math.PI, 'carGrey'); car(b, M, 19.0, COUR, 0.4, Math.PI, 'white');              // l'allée vers le garage reste libre
  // pergola : structure légère en acier (poteaux fins, traverses), câbles tendus support des grimpantes, le long de la façade
  { const PZ = [-2.0, 2.75, 7.6], top = -0.45;                                                                // au-dessus du coffre de la porte du garage
    for (const z of PZ) { box('cadre', 20.5, COUR, z - 0.05, 20.6, top, z + 0.05); box('concrete', 20.42, COUR, z - 0.12, 20.68, COUR + 0.12, z + 0.12); }
    box('cadre', 20.5, top - 0.18, -2.1, 20.6, top, 7.7); box('cadre', W + 0.06, top - 0.18, 0.05, W + 0.14, top, 7.7);       // poutres de rive (au Nord, appui sur le mur du jardin n°1)
    for (let z = -2.0; z <= 7.65; z += 1.21) box('cadre', z < 0.05 ? W + 0.3 : W + 0.06, top - 0.1, z - 0.03, 20.6, top, z + 0.03);   // traverses
    for (let x = 17.85; x < 20.5; x += 0.42) b.rod(M.steel, [x, top + 0.01, -2.05], [x, top + 0.01, 7.65], 0.004, 4);         // câbles inox tendus
    for (const z of PZ) b.rod(M.steel, [20.48, COUR + 0.2, z + 0.12], [20.48, top - 0.1, z + 0.12], 0.004, 4);
    if (V.climber) { V.climber(b, M, W + 0.1, top + 0.02, -2.05, 20.6, top + 0.02, 7.65, { seed: 77, density: 0.75 }); for (const z of PZ) V.climber(b, M, 20.48, COUR, z + 0.15, 20.5, top, z + 0.2, { seed: 78 + z, density: 0.6 }); }
    else { const g = new THREE.BufferGeometry(), pos = [], nor = [], uv = [], rr = R(77);                                       // feuillage de la pergola
      for (let i = 0; i < 520; i++) { const x = 17.4 + rr() * 3.3, z = -2.2 + rr() * 9.9, y = top + 0.02 + rr() * 0.2, s = 0.26 + rr() * 0.22, a = rr() * 6.28, cx = Math.cos(a) * s, cz = Math.sin(a) * s;
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(x + u * cx - v * cz, y + (u + v) * 0.03, z + u * cz + v * cx); nor.push(0, 1, 0); uv.push((u + 1) / 2, (v + 1) / 2); } }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); b.add(M.leafBroad, g); }
  }
  // massif arbustif existant conservé, toiletté et complété, au-dessus du muret, jusqu'à la clôture grillagée Nord
  const MASSIF = [[17.5, -6.1], [34.5, -6.1], [36.6, -5.2], [38.3, -2.9], [39.62, 1.45], [38.6, 2.5], [28.9, 2.5], [28.9, -2.3], [17.5, -2.3]];
  S('earth', MASSIF, -1.75, 2.6);
  wallPath(b, MX.drystone, [[34.5, -6.1], [36.6, -5.2], [38.3, -2.9], [39.62, 1.45]], 0.3, -5.4, -1.7);       // soutènement en limite, à l'angle de l'avenue
  fence(b, M, [[W + 0.3, -5.95], [34.5, -6.15], [36.6, -5.25], [38.3, -2.95], [39.62, 1.4]], () => -1.75, 1.5);
  { const r = R(61);
    for (const [x, z, k, rr] of [[19.5, -4.4, 'pittosporum', 0.9], [22.0, -3.6, 'rose', 0.6], [24.3, -4.8, 'rosemary', 0.7], [26.6, -3.7, 'pittosporum', 1.0], [29.2, -4.6, 'rose', 0.7], [31.0, -3.0, 'pittosporum', 0.9],
      [30.4, 0.6, 'rosemary', 0.7], [33.0, -1.2, 'rose', 0.6], [34.8, -4.2, 'pittosporum', 1.0], [35.6, 0.9, 'grass', 0.5], [37.4, -1.6, 'rosemary', 0.7], [32.6, 1.6, 'grass', 0.5]])
      shrub(x, z, { kind: k, r: rr, h: rr * 1.6, y: -1.77, seed: Math.round(r() * 100) });
    V.oleander(b, M, 27.8, -0.6, { r: 0.9, y: -1.77, seed: 5 }); V.oleander(b, M, 36.2, -2.6, { r: 0.8, y: -1.77, seed: 6 });
    V.tree(b, M, 34.2, -1.8, { kind: 'oak', h: 6.5, r: 2.4, seed: 63, y: -1.77 }); V.cypress(b, M, 23.2, -5.2, { h: 6.5, y: -1.77 });
    V.lavender(b, M, 18.2, -2.7, 27.8, -2.7, { y: -1.77, seed: 64 }); }
  // locaux vélos, technique piscine et déchets sous la terrasse : parement de pierre sèche, portes métalliques sur l'accès piéton
  box('drystone', PED_X - 0.04, -4.1, 9.95, 32.2, TERR - 0.04, 13.3);
  for (const [x0, x1] of [[19.4, 20.5], [27.35, 28.25], [29.9, 31.3]]) {
    const y = yPed((x0 + x1) / 2); box('cadre', x0 - 0.06, y, 9.92, x1 + 0.06, y + 2.18, 9.95); box('garage', x0, y + 0.02, 9.915, x1, y + 2.12, 9.92);
    box('steel', x1 - 0.2, y + 1.0, 9.89, x1 - 0.06, y + 1.03, 9.915);
  }
  box('concrete', 18.94, TERR - 0.06, 9.85, 32.25, TERR - 0.04, 9.95);                                          // nez de dalle au-dessus des portes
  // accès piéton : allée de 1,3 m en pente douce jusqu'au hall, longée par une jardinière béton surélevée (0,7 × 6,3 m)
  S('paving', [[PED_X, 7.95], [GATE_X, 7.95], [GATE_X, 9.97], [PED_X, 9.97]], (x) => yPed(x), 0.4);
  box('rendering', PED_X, COUR - 0.9, 7.7, GATE_X, COUR + 0.45, 7.95); box('concrete', PED_X, COUR + 0.45, 7.68, GATE_X, COUR + 0.48, 7.97);   // muret entre voie interne et allée
  box('concrete', 21.0, yPed(21.0) - 0.5, 9.25, 27.3, -2.95, 9.95); box('mulch', 21.08, -2.97, 9.33, 27.22, -2.955, 9.87);
  { for (let x = 21.4; x < 27.1; x += 0.75) { const k = Math.round(x * 4) % 4;
      if (k === 0) V.lavender(b, M, x - 0.2, 9.6, x + 0.2, 9.6, { y: -2.97, seed: Math.round(x * 5) }); else shrub(x, 9.6, { kind: k === 1 ? 'grass' : k === 2 ? 'rose' : 'rosemary', r: 0.3, h: k === 1 ? 0.7 : 0.55, y: -2.97, seed: Math.round(x * 9) }); } }
  // piliers enduits ton pierre, chaperons ; portail et portillon entre eux
  const PIL = [[GATE_X, 3.0, COUR + 0.4], [GATE_X, 7.67, yPed(GATE_X)], [GATE_X, 9.7, yPed(GATE_X)]];
  for (const [x, z, y] of PIL) { box('rendering', x - 0.25, y - 0.4, z - 0.25, x + 0.25, -1.15, z + 0.25); box('stuccoDark', x - 0.31, -1.15, z - 0.31, x + 0.31, -1.03, z + 0.31); box('led', x - 0.12, -1.03, z - 0.12, x + 0.12, -1.0, z + 0.12); }
  { const yp = yPed(GATE_X); railing(b, M, GATE_X, 7.95, GATE_X, 9.42, yp, 1.75, 'cadre'); box('black', GATE_X - 0.04, yp + 1.0, 9.2, GATE_X + 0.04, yp + 1.12, 9.3);
    box('cadre', GATE_X - 0.08, yp - 0.01, 7.92, GATE_X + 0.08, yp + 0.004, 9.45); }                         // portillon, serrure, seuil
  { // numéro « 59 » en chiffres découpés sur le pilier entre portail et portillon, côté rue ; boîtes aux lettres et visiophone sur le pilier du portillon
    const SEG = { 5: 'afgcd', 9: 'abcdfg' }, x = GATE_X + 0.25, w = 0.12, h = 0.22, e = 0.02, seg = (z0, y0, k) => {
      const r = { a: [0, h - e, w, h], b: [w - e, h / 2, w, h], c: [w - e, 0, w, h / 2], d: [0, 0, w, e], f: [0, h / 2, e, h], g: [0, h / 2 - e / 2, w, h / 2 + e / 2] }[k];
      box('cadre', x, y0 + r[1], z0 + r[0], x + 0.01, y0 + r[3], z0 + r[2]);
    };
    for (const [i, dgt] of ['5', '9'].entries()) for (const k of SEG[dgt]) seg(7.52 + i * 0.16, -1.75, k);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const z = 9.48 + i * 0.11, y = -2.6 + j * 0.3; box('cadre', x, y, z, x + 0.02, y + 0.27, z + 0.1); box('black', x + 0.02, y + 0.2, z + 0.012, x + 0.025, y + 0.212, z + 0.088); }
    box('cadre', x, -1.95, 9.55, x + 0.025, -1.65, 9.68); box('screen', x + 0.025, -1.84, 9.57, x + 0.03, -1.74, 9.66);
  }
  // murs d'entrée enduits ton pierre (arase 287,97) de part et d'autre de l'accès véhicules
  wallPath(b, MX.rendering, [[28.92, 2.6], [38.6, 2.6], [39.2, 2.15], [39.62, 1.5]], 0.3, -5.0, -1.63);
  wallPath(b, M.concrete, [[28.92, 2.6], [38.6, 2.6], [39.2, 2.15], [39.62, 1.5]], 0.36, -1.63, -1.6);       // chaperons béton
  // accès véhicules (pente 11 %) et trottoir à créer, du portail à l'avenue
  S('road', [[GATE_X, 2.75], [38.6, 2.75], [39.2, 2.3], [39.62, 1.65], [LIM_E, 1.65], [LIM_E, 7.8], [GATE_X, 7.8]], (x) => yRamp(x), 1.4);
  S('paving', [[GATE_X, 7.95], [LIM_E, 7.95], [LIM_E, 14.4], [39.36, 13.45], [38.53, 12.0], [36.95, 10.93], [35, 10.17], [32.2, 10.17], [32.2, 9.97], [GATE_X, 9.97]], (x) => yPed(x), 1.2);
  for (let k = 0; k < 11; k++) {                                                                               // bordure entre rampe et trottoir : suit le plus haut des deux
    const x0 = GATE_X + k, x1 = Math.min(LIM_E, x0 + 1), yt = (x) => Math.max(yRamp(x), yPed(x)) + 0.1;
    S('concrete', [[x0, 7.8], [x1, 7.8], [x1, 7.95], [x0, 7.95]], (x) => yt(x), 0.6);
  }
  box('cadre', 29.0, COUR - 0.02, 2.8, 29.25, COUR + 0.004, 7.4); for (let z = 2.85; z < 7.4; z += 0.08) box('black', 29.03, COUR - 0.01, z, 29.22, COUR + 0.009, z + 0.035);   // caniveau à grille au pied de la rampe
  for (const [x, z, y] of [[24.2, 5.3, COUR], [22.0, -0.8, COUR], [33.4, 9.0, yPed(33.4)]]) b.geo(M.cadre, new THREE.BoxGeometry(0.6, 0.012, 0.6), x, y + 0.004, z);   // regards de visite en fonte
  // éclairage extérieur : bornes basses le long des allées, appliques sur les piliers
  const borne = (x, y, z) => { b.cyl(M.cadre, x, y, z, 0.06, 0.48, 10); b.cyl(M.led, x, y + 0.44, z, 0.055, 0.04, 10); b.cyl(M.cadre, x, y + 0.48, z, 0.075, 0.03, 10); };
  for (const [x, z] of [[22.95, 14.2], [22.95, 19.0], [22.95, 24.0], [33.05, 14.5], [33.05, 24.5], [27.0, 25.45]]) borne(x, TERR, z);
  for (const x of [33.5, 36.5]) borne(x, yPed(x), 8.12);

  // ── Avenue Paul-Cézanne : chaussée en pente vers le Nord (TN 285,92 → 284,66), trottoirs, bateau devant l'accès ──
  // jupes épaisses sur le pourtour : le terrain se raccorde au sol lointain (env.js), plus bas que l'avenue
  S('road', [[ROAD[0], -45], [ROAD[1], -45], [ROAD[1], 90], [ROAD[0], 90]], (x, z) => yAv(z), 4.5);
  S('paving', [[LIM_E, -45], [ROAD[0], -45], [ROAD[0], 1.65], [LIM_E, 1.65]], (x, z) => yAv(z) + 0.12, 4.5);
  S('paving', [[LIM_E, 1.65], [ROAD[0], 1.65], [ROAD[0], 8.0], [LIM_E, 8.0]], (x, z) => yAv(z) + 0.025 + (x - LIM_E) * -0.004, 0.5);   // bateau abaissé
  S('paving', [[LIM_E, 8.0], [ROAD[0], 8.0], [ROAD[0], 90], [LIM_E, 90]], (x, z) => yAv(z) + 0.12, 4.5);
  S('paving', [[ROAD[1], -45], [ROAD[1] + 1.4, -45], [ROAD[1] + 1.4, 90], [ROAD[1], 90]], (x, z) => yAv(z) + 0.12, 4.5);
  S('earth', [[ROAD[1] + 1.4, -45], [130, -45], [130, 90], [ROAD[1] + 1.4, 90]], (x, z) => yAv(z) + 0.14, 4.5);
  S('earth', [[-14.5, -80], [W + 0.2, -80], [W + 0.2, -5.6], [-14.5, -5.6]], 0.1, 6.4);                          // parcelles au Nord
  S('earth', [[W + 0.2, -80], [30, -80], [30, -6.1], [W + 0.2, -6.1]], -1.6, 4.7);
  S('earth', [[30, -80], [LIM_E, -80], [LIM_E, 1.45], [39.62, 1.45], [38.3, -2.9], [36.6, -5.2], [34.5, -6.1], [30, -6.1]], (x, z) => -1.6 + (yAv(z) + 0.12 + 1.6) * Math.max(0, x - 30) / (LIM_E - 30), 5);
  const kerb = (x0, x1, za, zb) => S('concrete', [[x0, za], [x1, za], [x1, zb], [x0, zb]], (x, z) => yAv(z) + 0.13, 0.35);
  kerb(ROAD[0] - 0.14, ROAD[0], -45, 1.65); kerb(ROAD[0] - 0.14, ROAD[0], 8.0, 90); kerb(ROAD[1], ROAD[1] + 0.14, -45, 90);
  S('concrete', [[ROAD[0] - 0.14, 1.65], [ROAD[0], 1.65], [ROAD[0], 8.0], [ROAD[0] - 0.14, 8.0]], (x, z) => yAv(z) + 0.035, 0.35);   // bordure abaissée du bateau
  for (let z = -40; z < 80; z += 9) S('white', [[43.44, z - 1.5], [43.56, z - 1.5], [43.56, z + 1.5], [43.44, z + 1.5]], (x, zz) => yAv(zz) + 0.006, 0.01);   // axe discontinu
  for (let x = ROAD[0] + 0.3; x < ROAD[1] - 0.4; x += 1.0) S('white', [[x, -18], [x + 0.5, -18], [x + 0.5, -15], [x, -15]], (xx, z) => yAv(z) + 0.006, 0.01);   // passage piéton
  for (const z of [-34, -8, 24, 44]) b.geo(M.cadre, new THREE.CylinderGeometry(0.32, 0.32, 0.012, 16), 42.1, yAv(z) + 0.004, z, -Math.atan(0.029), 0, 0);   // plaques d'égout
  for (const z of [-30, -6, 18, 42]) {                                                                         // candélabres sur le trottoir d'en face : mât, crosse, lanterne
    const yy = yAv(z) + 0.12, x = ROAD[1] + 0.8; b.rod(M.cadre, [x, yy, z], [x, yy + 6.2, z], 0.07, 8, 0.05); b.rod(M.cadre, [x, yy + 6.1, z], [x - 0.8, yy + 6.3, z], 0.035, 6);
    b.box(M.cadre, x - 1.2, yy + 6.18, z - 0.16, x - 0.65, yy + 6.32, z + 0.16); b.box(M.led, x - 1.15, yy + 6.17, z - 0.12, x - 0.7, yy + 6.18, z + 0.12); b.cyl(M.cadre, x, yy, z, 0.12, 0.35, 8);
  }
  { const yy = yAv(-3) + 0.12; b.rod(M.cadre, [40.3, yy, -3], [40.3, yy + 2.5, -3], 0.03, 8); b.box(M.white, 40.28, yy + 1.95, -3.35, 40.3, yy + 2.45, -2.65); b.box(M.cadre, 40.3, yy + 1.95, -3.35, 40.32, yy + 2.45, -2.65); }   // panneau de voie
  // clôture et haie le long de l'avenue au Nord de l'accès (massif conservé)
  fence(b, M, [[39.62, 1.4], [LIM_E - 0.05, -40]], (x, z) => yAv(z) + 0.12, 1.5);

  // ── Voisinage : maisons et jardins des parcelles alentour, arbres de haute tige ──
  house(b, M, 55, yAv(2) + 0.14, 2, 13, 9, 0.12, 5.6); house(b, M, 57, yAv(30) + 0.1, 30, 11, 10, -0.1, 3.2, 'massing'); house(b, M, 55, yAv(-24) + 0.14, -24, 12, 9, 0.2, 5.6, 'massing');
  house(b, M, 9, -0.7, 58, 14, 9, 0.08, 5.6); box('wallTile', 20.5, -0.75, 53.5, 26.5, -0.7, 57.5); box('water', 20.8, -0.8, 53.8, 26.2, -0.68, 57.2);
  house(b, M, 6, 0.2, -24, 12, 9, -0.06, 5.6, 'massing'); house(b, M, -30, 2.6, 6, 10, 13, 0.1, 5.6); house(b, M, -34, 2.6, 34, 10, 12, -0.05, 3.2, 'massing');
  box('earth', -70, -6.3, -60, -14.5, 2.55, 80);
  S('earth', [[-14.5, zS(-14.5)], [30, zS(30)], [30, 80], [-14.5, 80]], -0.7, 5.6);                           // parcelles au Sud
  S('earth', [[30, zS(30)], [LIM_E, zS(LIM_E)], [LIM_E, 80], [30, 80]], (x) => -0.7 - (x - 30) * 0.1, 5.6);
  for (const [x, z, k, h, y] of [[-17, -13, 'pine', 11, 2.55], [-19, 17, 'pine', 10, 2.55], [-16, 27, 'oak', 8, 2.55], [-19, 38, 'pine', 12, 2.55], [-24, 22, 'cypress', 9, 2.55], [-12, 48, 'pine', 10, -0.7],
    [4, -11, 'pine', 12, 0.1], [14, -13, 'oak', 8, 0.1], [24, -12, 'pine', 10, -1.6], [-6, -14, 'cypress', 9, 0.1], [30, -16, 'olive', 5, -1.6],
    [5, 47, 'pine', 11, -0.7], [16, 47, 'oak', 7, -0.7], [30, 46, 'pine', 10, -0.7], [-4, 50, 'cypress', 9, -0.7],
    [50, -8, 'pine', 10, yAv(-8) + 0.14], [50, 14, 'olive', 5, yAv(14) + 0.14], [51, 22, 'cypress', 9, yAv(22) + 0.14], [50, 40, 'pine', 11, yAv(40) + 0.14], [64, 12, 'pine', 12, yAv(12) + 0.14], [66, 44, 'oak', 8, yAv(44) + 0.14], [62, -14, 'cypress', 10, yAv(-14) + 0.14]]) {
    if (k === 'cypress') V.cypress(b, M, x, z, { h, y }); else V.tree(b, M, x, z, { kind: k, h, r: h * (k === 'pine' ? 0.34 : 0.4), seed: Math.round(x * 7 + z * 13), y });
  }
  for (let z = -40; z < 6; z += 11.5) V.hedge(b, M, ROAD[1] + 1.6, z, ROAD[1] + 2.2, z + 11.55, { h: 1.8, y: yAv(z + 5.75) + 0.12 });
  b.pop(); b.on('ext');
}

/* ── Arrivée à la résidence : un SUV sombre remonte l'avenue, tourne vers le portail, attend qu'il s'ouvre, traverse la cour,
   attend la porte du garage et y entre ; portail et porte se referment derrière lui. Ce sont des objets à part (pas fusionnés
   avec le décor) : la voiture, ses roues, les deux vantaux et la porte bougent. Ils ne projettent pas d'ombre (la carte d'ombre
   du site n'est pas recalculée à chaque image) : une ombre de contact douce suit la voiture. Tout est créé au chargement. */

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
  const LX = 44.9, R = 5.4, cx = LX - R, cz = LANE_Z + R;               // voie montante de l'avenue, côté résidence
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
  { const b = new Batch(); b.box(M.garage, -0.019, DOOR.y0 - DOOR.y1, -(DOOR.z1 - DOOR.z0) / 2, 0.019, 0, (DOOR.z1 - DOOR.z0) / 2);
    b.box(M.cadre, 0.019, DOOR.y0 - DOOR.y1 + 0.02, -(DOOR.z1 - DOOR.z0) / 2 + 0.03, 0.024, DOOR.y0 - DOOR.y1 + 0.09, (DOOR.z1 - DOOR.z0) / 2 - 0.03);   // lisse basse
    b.build(door); }
  { const b = new Batch(), x0 = 17.39 + 0.004, x1 = 17.39 + 0.075;                        // dormant fixe autour de la baie du garage, coffre de l'enrouleur
    b.box(M.cadre, x0, DOOR.y0 - 0.02, DOOR.z0 - 0.09, x1, DOOR.y1 + 0.09, DOOR.z0 - 0.005); b.box(M.cadre, x0, DOOR.y0 - 0.02, DOOR.z1 + 0.005, x1, DOOR.y1 + 0.09, DOOR.z1 + 0.09);
    b.box(M.cadre, x0, DOOR.y1 + 0.005, DOOR.z0 - 0.005, x1, DOOR.y1 + 0.09, DOOR.z1 + 0.005);
    b.box(M.led, x1 + 0.005, DOOR.y1 + 0.2, (DOOR.z0 + DOOR.z1) / 2 - 0.25, x1 + 0.03, DOOR.y1 + 0.235, (DOOR.z0 + DOOR.z1) / 2 + 0.25);   // feu de signalisation de manœuvre
    b.build(group); }
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
  // hauteur du sol sous un point : chaussée de l'avenue, bateau, rampe d'accès jusqu'au portail, cour et garage à −3,30
  const ground = (x, z) => (x >= LIM_E ? yAv(z) + (x < ROAD[0] && (z < 1.65 || z > 8) ? 0.12 : 0) : yRamp(x));
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
