/* 59 Cézanne — visite 3D : données des deux logements.
   Unité : le mètre. Repère de plan : x vers la droite, y vers le bas (comme sur un plan vu de dessus) ; l'origine est
   l'angle intérieur du logement. `north` donne la rotation à appliquer pour retrouver l'orientation réelle
   (la Sainte-Victoire est à l'Est).

   Source : plans de pré-commercialisation de l'architecte (dossier 050-APC, indice D, 17/02/2025), cotes en centimètres
   reportées telles quelles ; surfaces des pièces = tableau du plan (indicatives, tolérance de 5 %).
   - Appartement-villa (logement 08) : 137,5 m², jardin 82,1 m². Séjour à l'Ouest sur le jardin, chambres à l'Est.
   - Duplex de 206 m² : logements 02 (103,2 m²) et 03 (103,6 m²) réunis. Chaque moitié suit son plan ; le logement 03
     est le symétrique du 02. Seules adaptations, signalées dans la page : mur mitoyen ouvert entre les deux séjours,
     seconde cuisine remplacée par la salle à manger, second escalier remplacé par l'ascenseur privatif, les deux WC
     de l'étage ouverts en passage, une chambre recoupée en dressing et salle de bains de la suite parentale.
   Illustrations non contractuelles. */
import * as THREE from 'three';
import { V } from 'v3d/furniture';
import { railing } from 'v3d/build';

const wv = (c, a0, a1, t = 0.1, ext = 0, ops = [], more = {}) => ({ k: 'v', c, a0, a1, t, ext, ops, ...more });
const wh = (c, a0, a1, t = 0.1, ext = 0, ops = [], more = {}) => ({ k: 'h', c, a0, a1, t, ext, ops, ...more });
const op = (a0, a1, kind, o = {}) => ({ a0, a1, kind, ...o });
const E = 0.35;                                   // épaisseur des murs de façade et de refend

/* Toiture à quatre pans sur un rectangle (débord compris). */
function hipRoof(b, mat, x0, z0, x1, z1, y, rise) {
  const w = x1 - x0, d = z1 - z0, k = Math.min(w, d) / 2;
  const A = [x0, y, z0], B = [x1, y, z0], C = [x1, y, z1], D = [x0, y, z1];
  const R1 = w >= d ? [x0 + k, y + rise, z0 + k] : [x0 + k, y + rise, z0 + k], R2 = w >= d ? [x1 - k, y + rise, z0 + k] : [x0 + k, y + rise, z1 - k];
  const tris = w >= d ? [A, R1, R2, A, R2, B, B, R2, C, C, R2, R1, C, R1, D, D, R1, A] : [A, R1, B, B, R1, R2, B, R2, C, C, R2, D, D, R2, R1, D, R1, A];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
  g.computeVertexNormals();
  // la face doit regarder vers le haut
  const n = g.attributes.normal; let up = 0; for (let i = 0; i < n.count; i++) up += n.getY(i);
  if (up < 0) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 9) { for (let k2 = 0; k2 < 3; k2++) { const t = p[i + 3 + k2]; p[i + 3 + k2] = p[i + 6 + k2]; p[i + 6 + k2] = t; } } g.computeVertexNormals(); }
  b.add(mat, g);
  b.box(mat, x0, y - 0.16, z0, x1, y, z1);                       // rive et sous-face du débord
}

/* Bassin de la résidence, plage en pierre, bains de soleil et parasols. (x0,z0)-(x1,z1) = plan d'eau. */
function pool(b, M, x0, z0, x1, z1, y) {
  b.box(M.terrace, x0 - 3.2, y - 0.3, z0 - 2.2, x1 + 3.4, y, z1 + 2.2);
  b.box(M.wallTile, x0 - 0.25, y, z0 - 0.25, x1 + 0.25, y + 0.03, z1 + 0.25);
  b.box(M.water, x0, y - 0.05, z0, x1, y + 0.035, z1);
  const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    if (horiz) { b.push(x0 + (x1 - x0) * t, y, z1 + 1.3, 0); } else { b.push(x1 + 1.5, y, z0 + (z1 - z0) * t, Math.PI / 2); }
    b.cbox(M.oak, 0, 0.14, 0, 0.7, 0.06, 1.9, 0.01); b.cbox(M.cream, 0, 0.2, 0.2, 0.64, 0.09, 1.4, 0.04); b.geo(M.cream, new THREE.BoxGeometry(0.64, 0.09, 0.6), 0, 0.38, -0.6, 0.5, 0, 0);
    if (i % 2 === 0) { b.cyl(M.oak, 0.75, 0, -0.7, 0.03, 2.4, 8); b.geo(M.cream, new THREE.ConeGeometry(1.7, 0.45, 4), 0.75, 2.25, -0.7, 0, Math.PI / 4, 0); }
    b.pop();
  }
}

/* Marches d'un escalier tournant autour d'un vide : montée le long de x=[xa0,xa1] vers les y décroissants,
   retour le long du mur du fond, descente... en fait montée finale le long de x=[xb0,xb1] vers les y croissants.
   Si `flip` vaut D, l'escalier est retourné par symétrie (y -> D - y). */
function windingStair(xa0, xa1, xb0, xb1, yFoot, yBack, H) {
  const steps = [], w = yFoot - (yBack + (xa1 - xa0)), ta = w / 4, tb = (xb0 - xa1) / 5, yc = yBack + (xa1 - xa0);
  for (let i = 0; i < 4; i++) steps.push([xa0, yFoot - (i + 1) * ta, xa1, yFoot - i * ta]);
  steps.push([xa0, yBack, xa1, yc]);
  for (let i = 0; i < 5; i++) steps.push([xa1 + i * tb, yBack, xa1 + (i + 1) * tb, yc]);
  steps.push([xb0, yBack, xb1, yc]);
  for (let i = 0; i < 4; i++) steps.push([xb0, yc + i * ta, xb1, yc + (i + 1) * ta]);
  const xa = (xa0 + xa1) / 2, xb = (xb0 + xb1) / 2;
  return { steps, H, foot: [xa, yFoot + 0.75], trig0: [xa, yFoot], trig1: [xb, yFoot], head: [xb, yFoot + 0.8], m0: [xa0 + 0.08, xa1 - 0.08, yFoot - 0.04], m1: [xb0 + 0.08, xb1 - 0.08, yFoot - 0.04] };
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
   1. APPARTEMENT-VILLA — logement 08, niveau 1 : T4, 3 chambres, 2 salles de bains, 137,5 m², jardin 82,1 m²
   x : de la façade Ouest sur le jardin (0) à la façade Est (16,69) ; y : de la façade Nord (0) au mur Sud (8,67).
   Le plan est orienté comme celui de l'architecte : Nord en haut, la Sainte-Victoire à droite.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const VW = 16.69, VD = 8.67, T = 0.08;
const villa = {
  id: 'villa', bien: '138', north: 0, groundY: -6.75,
  name: { fr: 'Appartement-villa', en: 'Villa-style apartment' },
  facts: { fr: '4 pièces · 138 m² · jardin de 82 m²', en: '4 rooms · 138 m² · 82 m² garden' },
  pitch: { fr: 'Au premier et dernier étage : le séjour de plain-pied avec le jardin, la chambre parentale face à la Sainte-Victoire.', en: 'On the first and top floor: the living room level with the garden, the master bedroom facing the Sainte-Victoire.' },
  levels: [{
    id: 'n1', name: { fr: 'Niveau 1', en: 'Level 1' }, y: 0, h: 2.6,
    bounds: [-9.6, -0.9, 17.9, 9.4], walkable: [[-9.1, -0.3, VW, VD + 0.3]],
    floors: [['floor', 0, 0, VW, VD], ['tile', 4.88, 5.78, 7.38, VD], ['tile', 9.33, 6.41, 10.28, VD], ['tile', 10.48, 6.4, 13.86, VD], ['tile', 13.94, 6.44, VW, VD], ['tile', 15.01, 5.4, VW, 6.44], ['tile', 12.84, 6.4, 13.94, 7.41]],
    slabs: [[-E, -E, VW + E + 0.6, VD + E, 0.3]],
    ceilings: [[0, 0, VW, VD]],
    walls: [
      // façades : baie du séjour et porte de la cuisine sur le jardin (Ouest), quatre portes-fenêtres au Nord, baie de la chambre 1 et porte-fenêtre de la salle de bains à l'Est
      wv(-E / 2, -E, VD + E, E, -1, [op(1.1, 5.05, 'bay', { panels: 3, open: true, head: 2.35 }), op(6.75, 7.7, 'french', { rail: false, head: 2.3 })]),
      wh(-E / 2, -E, VW + E, E, -1, [op(2.71, 3.99, 'french', { head: 2.3 }), op(5.31, 6.59, 'french', { head: 2.3 }), op(7.91, 9.19, 'french', { head: 2.3 }), op(11.76, 13.04, 'french', { head: 2.3 })]),
      wv(VW + E / 2, -E, VD + E, E, 1, [op(0.65, 4.6, 'bay', { panels: 3, rail: true, head: 2.35 }), op(5.95, 7.2, 'french', { head: 2.3 })]),
      wh(VD + E / 2, -E, VW + E, E, 1, [op(8.16, 9.12, 'entry', { head: 2.15 })]),
      // chambres 3 et 2
      wv(7.24, 0, 4.59, T), wh(4.55, 7.2, 10.28, T, 0, [op(9.36, 10.2, 'door', { hinge: 'a1', swing: -1 })]),
      wv(10.38, 0, 4.59, 0.2), wh(4.55, 10.48, 11.5, T, 0, [op(10.58, 11.42, 'door', { hinge: 'a0', swing: -1 })]),
      wh(3.79, 11.5, 13.56, T), wv(13.52, 0, 3.83, T),
      // suite parentale : porte, passage-dressing, penderie, salle de bains
      wv(11.54, 3.75, 6.4, T, 0, [op(4.72, 5.62, 'door', { hinge: 'a1', swing: 1 })]),
      wv(13.94, 3.79, 4.45, T), wv(13.94, 5.7, 6.4, T), wv(14.97, 4.7, 6.44, T), wh(4.72, 14.97, VW, T), wh(5.36, 14.97, VW, T),
      wh(6.4, 13.9, 15.0, T, 0, [op(14.06, 14.9, 'door', { hinge: 'a0', swing: 1 })]),
      wv(12.8, 6.36, 7.45, T), wh(7.45, 12.8, 13.94, T), wv(13.9, 7.45, VD, T),
      // salle d'eau, WC, entrée, buanderie
      wh(6.36, 10.48, 13.94, T, 0, [op(10.6, 11.4, 'door', { hinge: 'a0', swing: 1 })]),
      wv(10.38, 5.7, VD, 0.2), wh(6.37, 9.33, 10.28, T), wv(9.28, 5.7, VD, 0.1, 0, [op(7.45, 8.3, 'door', { hinge: 'a0', swing: 1, open: 88 })]),
      wv(7.43, 5.74, VD, 0.1, 0, [op(7.45, 8.3, 'door', { hinge: 'a0', swing: -1, open: 88 })]), wh(5.74, 4.78, 7.48, T), wv(7.65, 5.7, 6.15, 0.5),
      wv(4.83, 5.7, VD, 0.1, 0, [op(7.45, 8.3, 'door', { hinge: 'a0', swing: 1, open: 88 })]),
    ],
    rails: [[VW + E + 0.55, -0.6, VW + E + 0.55, 7.35], [VW + E, 7.35, VW + E + 0.55, 7.35], [VW + E, -0.6, VW + E + 0.55, -0.6]],
    items: [
      // séjour (40,7 m²)
      ['diningTable', 1.5, 3.16, 90, { w: 2.2, d: 1.0, top: 'marbleDark', n: 3, ends: true, chairMat: 'greige' }], ['pendant', 1.5, 3.16, 90, { kind: 'ring', drop: 0.95 }],
      ['rug', 4.95, 2.4, 0, { w: 2.5, d: 3.0 }], ['sofa', 3.73, 2.92, 90, { w: 2.85, d: 0.85, mat: 'cream', chaise: 'L', cl: 0.72, cw: 0.83 }],
      ['coffeeRect', 5.02, 2.5, 90, { w: 1.15, d: 0.67, mat: 'marbleDark' }], ['armchair', 5.65, 3.85, 315, { mat: 'cognac' }],
      ['tvWall', 7.2, 2.48, 270, { w: 2.6, tv: 1.4 }], ['floorLamp', 6.75, 0.5, 0, {}], ['plant', 0.5, 0.55, 0, { h: 1.8 }],
      ['curtain', 0.1, 0.85, 90, { w: 0.45 }], ['curtain', 0.1, 5.3, 90, { w: 0.45 }], ['picture', 5.6, 5.695, 180, { w: 1.2, h: 0.85, mat: 'art1' }],
      // cuisine (13,3 m²) : linéaire au Sud, retour avec évier double côté séjour
      ['kitchenRun', 1.95, 8.35, 180, { w: 3.9, front: 'navy', top: 'marble', hob: 0.45, upper: true, splash: true }], ['kitchenTall', 4.33, 8.35, 180, { w: 0.86, front: 'oak' }],
      ['kitchenRun', 1.87, 6.12, 0, { w: 3.15, d: 0.67, front: 'navy', top: 'marble', sink: -0.35 }], ['pendant', 1.87, 6.12, 0, { kind: 'cone', n: 2, span: 0.9, drop: 0.85 }],
      // buanderie (7,2 m²) et entrée (10,4 m²)
      ['wardrobe', 6.13, 6.09, 0, { w: 2.4, d: 0.58, mat: 'lacquer' }], ['washer', 5.55, 8.36, 180, { n: 2 }], ['shelves', 6.75, 8.45, 180, { w: 1.0, d: 0.36 }],
      ['wardrobe', 9.8, 6.03, 180, { w: 0.92, d: 0.6, mat: 'lacquer' }], ['pendant', 8.55, 6.9, 0, { kind: 'globe', drop: 0.5 }],
      // WC (2,2 m²)
      ['toilet', 9.8, 8.33, 180, {}], ['basin', 9.85, 6.56, 0, { w: 0.4 }],
      // salle d'eau (6,5 m²)
      ['vanity', 11.25, 8.42, 180, { w: 1.4, double: true }], ['toilet', 12.47, 6.95, 270, {}], ['shower', 13.38, 8.08, 270, { w: 1.14, d: 0.95, glass: ['front'] }], ['towelRail', 12.0, 6.41, 0, {}],
      // chambre 1 — suite parentale (22,7 m² avec son passage-dressing)
      ['bed', 14.62, 1.89, 90, { w: 1.8, l: 2.0, hw: 0.7, throwMat: 'terra' }], ['rug', 15.3, 1.9, 0, { w: 2.2, d: 2.9 }], ['armchair', 15.95, 4.1, 205, { mat: 'cream' }],
      ['curtain', 16.6, 0.42, 270, { w: 0.4 }], ['wardrobe', 15.85, 5.04, 180, { w: 1.66, d: 0.58 }],
      ['wardrobe', 12.75, 4.14, 0, { w: 2.3, d: 0.6 }], ['wardrobe', 12.75, 6.03, 180, { w: 2.3, d: 0.58 }],
      // salle de bains (9,2 m²)
      ['vanity', 15.85, 5.66, 0, { w: 1.5, double: true }], ['bathtub', 15.55, 8.15, 90, { free: true, w: 0.8, l: 1.75 }], ['shower', 13.36, 6.9, 90, { w: 1.0, d: 1.0, glass: ['front'] }], ['towelRail', 13.99, 7.9, 90, {}],
      // chambres 2 (12,0 m²) et 3 (13,3 m²)
      ['bed', 12.5, 1.75, 270, { w: 0.9, l: 2.0, nights: false, hw: 0.06, throwMat: 'sage' }], ['wardrobe', 12.5, 3.45, 180, { w: 1.95, d: 0.58 }],
      ['bed', 8.31, 1.75, 90, { w: 0.9, l: 2.0, nights: false, hw: 0.06, throwMat: 'ochre' }], ['wardrobe', 8.2, 4.19, 180, { w: 1.8, d: 0.62 }],
    ],
    rooms: [
      { id: 'entree', fr: 'Entrée', en: 'Entrance', m2: 10.4, rs: [[7.48, 5.78, 9.23, VD], [7.28, 4.59, 11.5, 5.7]], at: [8.55, 5.2], cam: { p: [9.0, 5.15], t: [2.5, 2.6] } },
      { id: 'sejour', fr: 'Séjour', en: 'Living room', m2: 40.7, rs: [[0, 0, 7.2, 5.72]], at: [3.6, 2.8], cam: { p: [6.3, 4.9], t: [1.2, 1.6] } },
      { id: 'cuisine', fr: 'Cuisine', en: 'Kitchen', m2: 13.3, rs: [[0, 5.72, 4.78, VD]], at: [2.3, 7.3], cam: { p: [4.2, 7.25], t: [0.8, 7.5] } },
      { id: 'buanderie', fr: 'Buanderie', en: 'Laundry', m2: 7.2, rs: [[4.88, 5.78, 7.38, VD]], at: [6.1, 7.2], cam: { p: [6.6, 7.3], t: [5.3, 8.0] }, minor: true },
      { id: 'wc', fr: 'WC', en: 'WC', m2: 2.2, rs: [[9.33, 6.41, 10.28, VD]], at: [9.8, 7.5], cam: { p: [9.8, 7.3], t: [9.8, 8.6] }, minor: true },
      { id: 'sde', fr: 'Salle d\'eau', en: 'Shower room', m2: 6.5, rs: [[10.48, 6.4, 12.8, VD], [12.8, 7.45, 13.86, VD]], at: [11.6, 7.5], cam: { p: [11.3, 7.2], t: [13.0, 8.3] } },
      { id: 'suite', fr: 'Chambre 1', en: 'Bedroom 1', m2: 22.7, rs: [[13.56, 0, VW, 4.7], [11.58, 4.45, 14.97, 5.7]], at: [15.1, 2.4], cam: { p: [14.45, 4.25], t: [16.7, 1.9] } },
      { id: 'sdb', fr: 'Salle de bains', en: 'Bathroom', m2: 9.2, rs: [[13.94, 6.44, VW, VD], [15.01, 5.4, VW, 6.44], [12.84, 6.4, 13.9, 7.41]], at: [15.3, 7.4], cam: { p: [14.3, 6.85], t: [16.69, 7.35] } },
      { id: 'ch2', fr: 'Chambre 2', en: 'Bedroom 2', m2: 12.0, rs: [[10.48, 0, 13.48, 3.75], [10.48, 3.75, 11.5, 4.55]], at: [12.0, 1.9], cam: { p: [10.95, 3.9], t: [12.9, 0.7] } },
      { id: 'ch3', fr: 'Chambre 3', en: 'Bedroom 3', m2: 13.3, rs: [[7.28, 0, 10.28, 3.75], [9.3, 3.75, 10.28, 4.55]], at: [8.8, 1.9], cam: { p: [9.8, 3.9], t: [7.9, 0.7] } },
      { id: 'jardin', fr: 'Jardin', en: 'Garden', m2: 82.1, rs: [[-9.15, -E, -E, VD + E]], at: [-4.6, 4.3], cam: { p: [-4.9, 3.1], t: [0.5, 3.1] } },
    ],
    tour: ['entree', 'sejour', 'jardin', 'cuisine', 'ch3', 'ch2', 'suite', 'sdb'],
  }],
  start: { room: 'sejour' },
  orbit: { target: [4.6, 0, 4.3], dist: 35 },
  garden: [
    ['outdoorSofa', -2.3, 1.75, 90, { w: 2.2 }], ['sideTable', -1.45, 3.15, 0, { r: 0.32, h: 0.38 }], ['outdoorTable', -2.6, 6.55, 0, { w: 2.2, n: 3 }], ['parasol', -3.95, 6.55, 0, { r: 1.5 }],
    ['lounger', -6.6, 2.7, 270, {}], ['lounger', -6.6, 3.7, 270, {}], ['planter', -0.72, 5.75, 90, { w: 1.1, d: 0.36 }],
  ],
  exterior(b, M, lv) {
    const gx0 = -9.15, gz0 = -E, gz1 = VD + E;
    b.on('ext');
    // jardin de plain-pied : terrasse dallée devant le séjour, puis pelouse
    b.box(M.terrace, -4.95, -0.06, gz0, -E, -0.015, gz1); b.box(M.grass, gx0, -0.1, gz0, -4.95, -0.02, gz1); b.box(M.earth, gx0 - 0.4, -1.2, gz0 - 0.4, -E, -0.1, gz1 + 0.05);
    lv.blocks.push(V.hedge(b, M, gx0, gz0 - 0.4, -E - 0.05, gz0 + 0.3, { h: 1.6 })); lv.blocks.push(V.hedge(b, M, gx0 - 0.4, gz0 - 0.4, gx0 + 0.25, gz1, { h: 1.6 }));
    lv.blocks.push(V.hedge(b, M, gx0, gz1 - 0.55, -E - 0.05, gz1 + 0.05, { h: 1.2 }));
    lv.blocks.push(V.tree(b, M, -8.0, 1.5, { kind: 'olive', h: 4.2, r: 1.7, seed: 4 })); lv.blocks.push(V.tree(b, M, -7.9, 7.0, { kind: 'pine', h: 6.0, r: 2.4, seed: 9 }));
    lv.blocks.push(V.oleander(b, M, -5.7, 8.05, { r: 0.7 })); V.lavender(b, M, -8.3, 3.2, -8.3, 5.6, { seed: 2 });
    // balcon filant de la façade Est, côté Sainte-Victoire
    b.box(M.terrace, VW + E, -0.04, -0.6, VW + E + 0.6, 0, 7.35); b.box(M.stucco, VW + E, -0.3, -0.65, VW + E + 0.65, -0.04, 7.4);
    // volumes de la résidence, en maquette claire : rez-de-chaussée sous le logement, suite du bâtiment au Sud
    b.on('ctx');
    b.box(M.massing, -E, -3.15, -E, VW + E, -0.32, VD + E);
    b.box(M.massing, -E, -3.15, VD + E + 0.01, VW + E, 2.9, 31);
    b.box(M.earth, -60, -3.2, -40, gx0 - 0.4, -0.12, 60); b.box(M.earth, gx0 - 0.4, -3.2, gz1 + 0.05, -E, -0.12, 60); b.box(M.earth, gx0 - 0.4, -3.2, -40, VW + E, -0.12, gz0 - 0.4);   // terrain haut à l'Ouest et au Nord
    pool(b, M, 23.5, 12.5, 29.0, 24.6, -6.7);
    b.box(M.stone, VW + E + 4.6, -6.7, -8, VW + E + 5.0, -3.2, 34); b.box(M.grass, VW + E, -3.3, -8, VW + E + 4.6, -3.16, 34);
    b.on('ext:top');
    hipRoof(b, M.roof, -1.3, -1.3, VW + 1.5, 31.8, 2.92, 2.2);
    b.box(M.stucco, -E, 2.6, -E, VW + E, 2.92, VD + E);
  },
  trees: [[22, -6, 'pine', 9], [27, 4, 'cypress', 8], [31, -3, 'olive', 5], [36, 8, 'pine', 10], [24, 30, 'olive', 5], [34, 28, 'pine', 9], [-16, -8, 'pine', 9], [-20, 6, 'cypress', 8], [-14, 16, 'pine', 9], [4, -14, 'pine', 10], [14, -12, 'olive', 5]],
};

/* ════════════════════════════════════════════════════════════════════════════════════════════
   2. DUPLEX — logements 02 et 03 réunis : 206 m², terrasse et jardin d'environ 56 m², ascenseur privatif
   x : du fond côté couloir (0) à la façade Est sur jardin (11,63) ; y : du Nord (0) au Sud (11,78).
   Moitié Nord = logement 02 tel que dessiné ; moitié Sud = logement 03, son symétrique. L'étage ne couvre que x >= 4.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const DW = 11.63, HD = 5.79, PW = 0.2, DD = 2 * HD + PW, UX = 4.0, FH = 2.9, MY = (y) => DD - y;
const stair = windingStair(4.05, 4.95, 6.1, 7.0, 1.9, 0.05, FH);
const LIFT = { x0: 4.2, y0: 10.3, x1: 5.4, y1: 11.7 };
const duplex = {
  id: 'duplex', bien: 'duplex-206', north: 0, groundY: -3.55,
  name: { fr: 'Duplex', en: 'Duplex' },
  facts: { fr: '4 pièces · 206 m² · terrasse et jardin d\'environ 56 m²', en: '4 rooms · 206 m² · terrace and garden of about 56 m²' },
  pitch: { fr: 'Deux duplex réunis : plus de 100 m² de réception en rez-de-jardin, trois chambres à l\'étage, un ascenseur privatif.', en: 'Two duplexes combined: over 100 m² of reception space at garden level, three bedrooms upstairs, a private lift.' },
  stair,
  lift: { ...LIFT, door: [4.8, 10.25], exits: [[4.8, 9.6], [4.8, 9.45]] },
  levels: [{
    id: 'rdc', name: { fr: 'Rez-de-jardin', en: 'Garden level' }, y: 0, h: 2.6,
    bounds: [-0.4, -0.4, 17.4, DD + 0.4], walkable: [[0, 0, 16.85, DD]],
    floors: [['floor', 0, 0, DW, DD], ['tile', 0, 0, 3.92, 1.91], ['tile', 0, MY(1.91), 3.92, DD]],
    slabs: [[-E, -E, DW + E, DD + E, 0.3]],
    ceilings: [[0, 1.95, DW, MY(1.95)], [0, 0, 4.0, 1.95], [7.1, 0, DW, 1.95], [0, MY(1.95), 4.0, DD], [5.5, MY(1.95), DW, DD], [4.0, MY(1.95), 5.5, LIFT.y0 - 0.1]],
    walls: [
      wv(-E / 2, -E, DD + E, E, -1, [op(2.15, 3.05, 'entry', { head: 2.15 }), op(MY(3.05), MY(2.15), 'entry', { head: 2.15 })]),
      wh(-E / 2, -E, DW + E, E, -1), wh(DD + E / 2, -E, DW + E, E, 1),
      wv(DW + E / 2, -E, DD + E, E, 1, [op(0.95, 5.2, 'bay', { panels: 3, open: true, head: 2.4 }), op(MY(5.2), MY(0.95), 'bay', { panels: 3, open: true, head: 2.4 })]),
      // mur mitoyen : conservé derrière la cuisine et derrière le meuble du salon, ouvert entre les deux séjours
      wh(HD + PW / 2, 0, 6.3, PW), wh(HD + PW / 2, 8.9, DW, PW), wv(5.93, 5.13, HD, 0.36), wv(5.93, HD + PW, MY(5.13), 0.36),
      // logement 02 : salle d'eau-buanderie, cage d'escalier
      wh(1.95, 0, 4.0, T, 0, [op(1.7, 2.55, 'door', { hinge: 'a0', swing: -1, open: 88 })]), wv(3.96, 0, 1.95, T),
      wv(7.06, 0, 1.95, T, 0, [], { h: FH }), wh(1.94, 4.95, 7.1, T),
      // logement 03 (symétrique) : salle d'eau-buanderie, ascenseur dans la trémie de l'escalier
      wh(MY(1.95), 0, 4.0, T, 0, [op(1.7, 2.55, 'door', { hinge: 'a0', swing: 1, open: 88 })]), wv(3.96, MY(1.95), DD, T),
      wv(LIFT.x0 - 0.07, LIFT.y0 - 0.1, DD, 0.1, 0, [], { h: FH }), wv(LIFT.x1 + 0.07, LIFT.y0 - 0.1, DD, 0.1, 0, [], { h: FH }),
      wh(LIFT.y0 - 0.05, LIFT.x0 - 0.12, LIFT.x1 + 0.12, 0.1, 0, [op(4.35, 5.25, 'liftdoor', { head: 2.1 })], { h: FH }),
      wv(7.06, MY(1.95), DD, T), wh(MY(1.94), 5.5, 7.1, T, 0, [op(5.75, 6.65, 'door', { hinge: 'a0', swing: 1, open: 88 })]),
    ],
    blockers: [[4.95, 0, 7.02, 1.9], [4.0, 0, 4.95, 1.42]],
    items: [
      // logement 02 — salle d'eau-buanderie (7,3 m²)
      ['washer', 0.34, 0.45, 90, { n: 1 }], ['vanity', 0.27, 1.25, 90, { w: 0.8, double: false, d: 0.46 }], ['toilet', 2.5, 0.34, 0, {}], ['shower', 3.42, 0.5, 0, { w: 0.92, d: 0.92, glass: ['left'] }],
      // cuisine (18,1 m²) : colonnes à l'Ouest, linéaire contre le mitoyen, îlot central
      ['kitchenTall', 0.335, 4.12, 90, { w: 1.45, front: 'oak' }], ['kitchenRun', 2.9, 5.47, 180, { w: 5.65, front: 'navy', top: 'marble', sink: -0.3, hob: 1.3, upper: true, splash: true }],
      ['island', 3.77, 3.6, 180, { w: 3.6, d: 0.95, front: 'navy', top: 'marble', stools: 4, stoolMat: 'cognac', over: 0.22 }], ['pendant', 3.77, 3.55, 0, { kind: 'cone', n: 3, span: 1.0, drop: 0.85 }],
      // séjour (41,0 m²)
      ['desk', 9.55, 1.44, 180, { w: 2.0, d: 0.6, top: 'walnut', chair: 'cognac' }], ['sofa', 9.38, 2.82, 0, { w: 2.8, d: 0.85, mat: 'linen', chaise: 'R', cl: 0.72, cw: 0.8, pillows: ['terra', 'sage'] }],
      ['rug', 9.15, 4.08, 0, { w: 3.5, d: 2.3 }], ['coffeeRect', 8.95, 4.13, 0, { w: 1.1, d: 0.65, mat: 'marble' }], ['armchair', 7.57, 4.17, 90, { mat: 'cognac' }], ['armchair', 10.3, 4.72, 320, { mat: 'cognac' }],
      ['tvWall', 10.2, HD, 180, { w: 2.5, tv: 1.4 }], ['curtain', DW - 0.1, 0.62, 270, { w: 0.5 }], ['picture', 9.4, 0.005, 0, { w: 1.2, h: 0.85, mat: 'art2' }],
      // logement 03 — salle d'eau-buanderie
      ['washer', 0.34, MY(0.45), 90, { n: 1 }], ['vanity', 0.27, MY(1.25), 90, { w: 0.8, double: false, d: 0.46 }], ['toilet', 2.5, MY(0.34), 180, {}], ['shower', 3.42, MY(0.5), 180, { w: 0.92, d: 0.92, glass: ['right'] }],
      // salle à manger, à l'emplacement de la cuisine du logement 03
      ['diningTable', 3.77, MY(3.6), 0, { w: 3.0, d: 1.1, top: 'marble', n: 4, ends: true, chairMat: 'terra' }], ['pendant', 3.77, MY(3.6), 0, { kind: 'globe', n: 3, span: 0.9, drop: 0.9 }],
      ['sideboard', 2.9, HD + PW + 0.26, 0, { w: 3.4, d: 0.48, h: 0.82, mat: 'walnut', top: 'marbleDark' }], ['picture', 2.9, HD + PW + 0.005, 0, { w: 1.5, h: 0.95, mat: 'art1' }], ['tableLamp', 1.6, HD + PW + 0.26, 0, { y: 0.845 }],
      ['bookcase', 0.19, MY(4.12), 90, { w: 1.45, h: 2.3 }],
      // second salon (symétrique du séjour)
      ['sofa', 9.38, MY(2.82), 180, { w: 2.8, d: 0.85, mat: 'cream', chaise: 'L', cl: 0.72, cw: 0.8, pillows: ['ochre', 'sage'] }], ['rug', 9.15, MY(4.08), 0, { w: 3.5, d: 2.3, mat: 'rugDark' }],
      ['coffeeRound', 8.95, MY(4.13), 0, { r: 0.5 }], ['armchair', 7.57, MY(4.17), 90, { mat: 'charcoal' }], ['armchair', 10.3, MY(4.72), 220, { mat: 'charcoal' }],
      ['bookcase', 10.2, HD + PW + 0.18, 0, { w: 2.5, h: 2.3 }], ['shelves', 6.28, 11.57, 180, { w: 1.3, d: 0.36 }], ['desk', 9.55, MY(1.44), 0, { w: 2.0, d: 0.6, top: 'marbleDark', chair: 'cream' }], ['curtain', DW - 0.1, MY(0.62), 270, { w: 0.5 }],
    ],
    rooms: [
      { id: 'entree', fr: 'Entrée', en: 'Entrance', rs: [[0, 1.99, 2.2, 3.35]], at: [1.1, 2.65], cam: { p: [0.9, 2.6], t: [7, 3.3] }, minor: true },
      { id: 'cuisine', fr: 'Cuisine', en: 'Kitchen', rs: [[0, 3.0, 6.2, HD], [2.2, 1.99, 4.0, 3.0]], at: [3.2, 4.6], cam: { p: [6.05, 4.45], t: [2.2, 4.9] } },
      { id: 'sejour', fr: 'Séjour', en: 'Living room', rs: [[6.2, 0, DW, HD], [4.95, 1.95, 6.2, 3.0]], at: [9.3, 3.6], cam: { p: [7.3, 3.4], t: [11.8, 3.1] } },
      { id: 'escalier', fr: 'Escalier', en: 'Stairs', rs: [[4.0, 0, 7.02, 1.95], [4.0, 1.95, 4.95, 3.0]], at: [5.5, 1.0], cam: { p: [4.5, 2.75], t: [4.5, 0.4] }, minor: true },
      { id: 'sde', fr: 'Salle d\'eau', en: 'Shower room', rs: [[0, 0, 3.92, 1.91]], at: [1.9, 1.0], cam: { p: [1.9, 1.35], t: [3.6, 0.3] }, minor: true },
      { id: 'repas', fr: 'Salle à manger', en: 'Dining room', rs: [[0, HD + PW, 6.2, 9.25], [0, 9.25, 4.0, MY(1.99)]], at: [3.2, 8.2], cam: { p: [6.0, 7.1], t: [2.2, 8.6] } },
      { id: 'salon', fr: 'Salon', en: 'Lounge', rs: [[6.2, HD + PW, DW, DD]], at: [9.3, 8.3], cam: { p: [7.3, 8.4], t: [11.8, 8.7] } },
      { id: 'ascenseur', fr: 'Ascenseur privatif', en: 'Private lift', rs: [[LIFT.x0, LIFT.y0, LIFT.x1, LIFT.y1], [4.0, 9.25, 5.6, LIFT.y0]], at: [4.8, 11.0], cam: { p: [4.8, 9.5], t: [4.8, 11.3] } },
      { id: 'sde2', fr: 'Salle d\'eau 2', en: 'Shower room 2', rs: [[0, MY(1.91), 3.92, DD]], at: [1.9, 10.8], cam: { p: [1.9, 10.45], t: [3.6, 11.5] }, minor: true },
      { id: 'jardin', fr: 'Terrasse et jardin', en: 'Terrace and garden', rs: [[DW + E, 0, 16.9, DD]], at: [14.4, 5.9], cam: { p: [13.4, 5.9], t: [22, 5.9] } },
    ],
    tour: ['entree', 'cuisine', 'sejour', 'jardin', 'salon', 'repas', 'ascenseur'],
  }, {
    id: 'etage', name: { fr: 'Étage', en: 'Upper floor' }, y: FH, h: 2.5,
    bounds: [3.6, -0.4, 12.1, DD + 0.4], walkable: [[UX, 0, DW, DD]],
    floors: [['floor', UX, 1.9, DW, DD], ['floor', 7.02, 0, DW, 1.9], ['tile', 4.1, 3.4, 6.23, HD], ['tile', 4.1, HD + PW, 6.23, MY(3.4)], ['tile', 9.2, HD + PW, DW, 8.89]],
    ceilings: [[UX, 0, DW, DD]],
    walls: [
      wv(UX - E / 2, -E, DD + E, E, -1, [op(1.9, 2.8, 'entry', { head: 2.1 }), op(MY(2.8), MY(1.9), 'entry', { head: 2.1 })]),
      wh(-E / 2, UX - E, DW + E, E, -1), wh(DD + E / 2, UX - E, DW + E, E, 1),
      wv(DW + E / 2, -E, DD + E, E, 1, [op(1.05, 2.3, 'french', { head: 2.25, shutter: 'a1' }), op(3.95, 5.2, 'french', { head: 2.25, shutter: 'a0' }), op(MY(5.2), MY(3.95), 'french', { head: 2.25, shutter: 'a1' }), op(MY(2.3), MY(1.05), 'french', { head: 2.25, shutter: 'a0' })]),
      // mitoyen : ouvert au droit des deux WC, transformés en passage
      wh(HD + PW / 2, UX, 6.33, PW), wh(HD + PW / 2, 7.02, DW, PW),
      // logement 02 : chambres, salle de bains, passage
      wv(7.06, 0, HD, T, 0, [op(1.95, 2.75, 'door', { hinge: 'a1', swing: 1 }), op(3.0, 3.8, 'door', { hinge: 'a0', swing: 1 })]), wh(2.85, 7.1, DW, T),
      wh(3.36, UX, 6.31, T, 0, [op(4.9, 5.75, 'door', { hinge: 'a0', swing: 1, open: 88 })]), wv(6.27, 3.36, HD, T),
      // logement 03 : suite parentale (chambre, dressing, salle de bains), salle d'eau, palier de l'ascenseur
      wv(7.06, HD + PW, DD, T, 0, [op(MY(2.75), MY(1.95), 'door', { hinge: 'a0', swing: 1 })]), wh(MY(2.85), 7.1, DW, T, 0, [op(7.4, 8.3, 'door', { hinge: 'a0', swing: -1 })]),
      wv(9.15, HD + PW, MY(2.89), T, 0, [op(7.0, 7.85, 'door', { hinge: 'a1', swing: 1 })]),
      wh(MY(3.36), UX, 6.31, T, 0, [op(4.9, 5.75, 'door', { hinge: 'a0', swing: -1, open: 88 })]), wv(6.27, HD + PW, MY(3.36), T),
      wv(LIFT.x0 - 0.07, LIFT.y0 - 0.1, DD, 0.1), wv(LIFT.x1 + 0.07, LIFT.y0 - 0.1, DD, 0.1), wh(LIFT.y0 - 0.05, LIFT.x0 - 0.12, LIFT.x1 + 0.12, 0.1, 0, [op(4.35, 5.25, 'liftdoor', { head: 2.1 })]),
      wv(5.5, MY(1.95), DD, T),
    ],
    rails: [[4.0, 1.92, 6.1, 1.92]],
    blockers: [[4.0, 0, 6.1, 1.9], [6.1, 0, 7.02, 1.42]],
    items: [
      // logement 02 : chambres (12,7 et 12,8 m²), salle de bains (4,4 m²)
      ['wardrobe', 7.42, 0.95, 90, { w: 1.75, d: 0.6 }], ['bed', 9.67, 1.03, 0, { w: 1.4, l: 1.9, hw: 0.3, throwMat: 'sage' }],
      ['wardrobe', 7.42, 4.9, 90, { w: 1.72, d: 0.6 }], ['bed', 9.67, 4.78, 180, { w: 1.4, l: 1.9, hw: 0.3, throwMat: 'ochre' }],
      ['bathtub', 5.05, 5.4, 90, { w: 0.72, l: 1.75 }], ['vanity', 6.0, 4.1, 270, { w: 1.3, double: true, d: 0.46 }], ['towelRail', 4.11, 4.2, 90, {}],
      ['pendant', 5.4, 2.6, 0, { kind: 'globe', drop: 0.5 }], ['picture', 4.005, 3.05, 90, { w: 0.5, h: 0.7, mat: 'art1' }],
      // logement 03 : salle d'eau (douche, vasque, WC)
      ['shower', 4.9, HD + PW + 0.46, 0, { w: 1.5, d: 0.9, glass: ['front'] }], ['vanity', 6.0, MY(4.1), 270, { w: 1.1, double: false, d: 0.46 }], ['toilet', 4.43, 7.5, 90, {}],
      // suite parentale : chambre, dressing, salle de bains
      ['bed', 9.67, MY(1.03), 180, { w: 1.6, l: 1.9, hw: 0.7, throwMat: 'terra' }], ['wardrobe', 7.42, MY(0.95), 90, { w: 1.75, d: 0.6 }], ['armchair', 10.9, MY(2.45), 250, { mat: 'cream' }],
      ['wardrobe', 7.42, 7.42, 90, { w: 1.5, d: 0.6 }], ['wardrobe', 8.1, HD + PW + 0.31, 0, { w: 1.9, d: 0.6 }], ['mirror', 9.105, 8.3, 270, { w: 0.6, h: 1.7, y: 1.1 }],
      ['bathtub', 10.25, HD + PW + 0.48, 90, { free: true, w: 0.78, l: 1.6 }], ['toilet', 11.35, HD + PW + 0.34, 0, {}], ['vanity', 10.9, 8.63, 180, { w: 1.3, double: true }], ['shower', 9.67, 8.42, 180, { w: 0.9, d: 0.9, glass: ['left'] }],
    ],
    rooms: [
      { id: 'palier', fr: 'Palier', en: 'Landing', rs: [[UX, 1.9, 7.02, 3.32], [6.33, 3.32, 7.02, MY(3.32)]], at: [5.3, 2.6], cam: { p: [5.2, 2.75], t: [6.7, 5.6] } },
      { id: 'ch2', fr: 'Chambre 2', en: 'Bedroom 2', rs: [[7.1, 0, DW, 2.81]], at: [9.4, 1.4], cam: { p: [7.6, 2.35], t: [10.9, 0.9] } },
      { id: 'ch3', fr: 'Chambre 3', en: 'Bedroom 3', rs: [[7.1, 2.89, DW, HD]], at: [9.4, 4.3], cam: { p: [7.6, 3.4], t: [10.9, 4.9] } },
      { id: 'sdb2', fr: 'Salle de bains', en: 'Bathroom', rs: [[4.1, 3.4, 6.23, HD]], at: [5.1, 4.6], cam: { p: [5.3, 3.85], t: [4.5, 5.5] }, minor: true },
      { id: 'suite', fr: 'Suite parentale', en: 'Master suite', rs: [[7.1, MY(2.81), DW, DD]], at: [9.4, 10.4], cam: { p: [7.65, 9.4], t: [11.2, 10.6] } },
      { id: 'dressing', fr: 'Dressing', en: 'Dressing room', rs: [[7.1, HD + PW, 9.11, 8.89]], at: [8.1, 7.4], cam: { p: [8.55, 8.3], t: [7.7, 6.5] } },
      { id: 'sdbs', fr: 'Salle de bains de la suite', en: 'En-suite bathroom', rs: [[9.19, HD + PW, DW, 8.89]], at: [10.4, 7.4], cam: { p: [9.75, 7.45], t: [11.2, 6.6] } },
      { id: 'sde', fr: 'Salle d\'eau', en: 'Shower room', rs: [[4.1, HD + PW, 6.23, MY(3.4)]], at: [5.1, 7.2], cam: { p: [5.3, 7.95], t: [4.5, 6.3] }, minor: true },
      { id: 'ascenseur', fr: 'Ascenseur privatif', en: 'Private lift', rs: [[LIFT.x0, LIFT.y0, LIFT.x1, LIFT.y1], [UX, MY(3.32), 7.02, LIFT.y0]], at: [4.8, 11.0], cam: { p: [5.6, 9.0], t: [4.8, 11.3] } },
    ],
    tour: ['palier', 'ch2', 'ch3', 'suite', 'dressing', 'sdbs'],
  }],
  start: { room: 'sejour' },
  orbit: { target: [8.3, 0, 5.9], dist: 30 },
  garden: [
    ['outdoorTable', 14.2, 2.0, 0, { w: 1.5, d: 1.5, n: 2, ends: true }], ['outdoorSofa', 12.7, 8.9, 90, { w: 2.2 }], ['sideTable', 13.55, 8.9, 0, { r: 0.32, h: 0.38 }],
    ['lounger', 15.55, 8.2, 270, {}], ['lounger', 15.55, 9.3, 270, {}], ['planter', 12.2, 5.89, 90, { w: 1.2, d: 0.4 }],
  ],
  exterior(b, M, lv) {
    const gx0 = DW + E, gx1 = 16.9;
    b.on('ext');
    // jardin : 4,9 m de profondeur sur toute la largeur, dallage devant les baies
    b.box(M.terrace, gx0, -0.06, -E, 14.6, -0.015, DD + E); b.box(M.grass, 14.6, -0.1, -E, gx1, -0.02, DD + E); b.box(M.earth, gx0, -1.0, -E, gx1 + 0.4, -0.1, DD + E);
    lv.blocks.push(V.hedge(b, M, gx0, -E, gx1, 0.3, { h: 1.6 })); lv.blocks.push(V.hedge(b, M, gx0, DD - 0.3, gx1, DD + E, { h: 1.6 }));
    b.box(M.stone, gx1, -3.6, -E, gx1 + 0.4, 0.45, DD + E); lv.blocks.push(V.hedge(b, M, gx1 - 0.5, 0.3, gx1, DD - 0.3, { h: 0.95 })); lv.blocks.push([gx1 - 0.1, -E, gx1 + 0.4, DD + E]);
    b.box(M.frame, DW + 0.2, 2.42, 0.75, DW + E + 0.02, 2.5, 5.4); b.box(M.frame, DW + 0.2, 2.42, MY(5.4), DW + E + 0.02, 2.5, MY(0.75));
    lv.blocks.push(V.cypress(b, M, 16.2, 0.85, { h: 5 })); lv.blocks.push(V.cypress(b, M, 16.2, DD - 0.85, { h: 5 })); lv.blocks.push(V.oleander(b, M, 15.9, 5.9, { r: 0.7, seed: 8 }));
    V.lavender(b, M, 14.85, 3.6, 14.85, 5.2, { seed: 5 }); V.lavender(b, M, 14.85, 6.6, 14.85, 7.4, { seed: 6 });
    // volumes de la résidence, découpés aux mêmes hauteurs que le logement
    b.on('ctx');
    b.box(M.massing, -6.2, 0, -9.6, DW + E, 5.72, -E - 0.01); b.box(M.massing, -6.2, 0, DD + E + 0.01, DW + E, 5.72, 21.6); b.box(M.massing, -6.2, 0, -E, -E - 0.01, 5.72, DD + E);
    b.box(M.massing, -E, FH, -E, UX - E - 0.01, 5.72, DD + E);                       // logements voisins au-dessus du fond du rez-de-jardin
    b.box(M.earth, -40, 0, -40, -6.2, 2.85, 50);
    b.box(M.grass, gx0, -0.1, -9.6, gx1, -0.02, -E); b.box(M.grass, gx0, -0.1, DD + E, gx1, -0.02, 21.6); b.box(M.stone, gx1, -3.6, -9.6, gx1 + 0.4, 0.45, 21.6);
    pool(b, M, 22.3, -0.3, 27.8, 11.8, -3.5);
    // dalle entre les deux niveaux : trémies de l'escalier (logement 02) et de l'ascenseur (logement 03)
    b.on('L0:top');
    for (const s of [[-E, -E, UX, DD + E], [UX, 1.95, DW + E, MY(1.95)], [7.02, -E, DW + E, 1.95], [5.5, MY(1.95), DW + E, DD + E], [UX, MY(1.95), 5.5, LIFT.y0 - 0.1]]) b.box(M.concrete, s[0], 2.65, s[1], s[2], FH - 0.03, s[3]);
    b.box(M.plaster, UX, 2.6, -E, 7.02, FH, 0);                                      // bandeau du mur Nord dans la cage d'escalier
    b.on('ext:top');
    hipRoof(b, M.roof, -6.9, -10.3, DW + 1.0, 22.3, 5.74, 2.2);
    b.box(M.stucco, UX - E, FH + 2.5, -E, DW + E, 5.74, DD + E);
  },
  trees: [[31, 3, 'olive', 5], [33, 9, 'cypress', 8], [37, -2, 'pine', 9], [40, 12, 'pine', 10], [30, 16, 'olive', 5], [44, 2, 'cypress', 9], [36, -14, 'olive', 5], [34, -8, 'pine', 9], [36, 20, 'olive', 5], [31, 26, 'cypress', 9], [24, -16, 'pine', 10], [19, 28, 'pine', 9], [-12, -22, 'pine', 10], [-16, 30, 'pine', 9]],
};

export const APARTMENTS = [villa, duplex];
