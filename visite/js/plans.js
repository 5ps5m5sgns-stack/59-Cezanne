/* 59 Cézanne — visite 3D : données des deux logements.
   Unité : le mètre. Repère de plan : x vers la droite, y vers le bas (comme sur un plan vu de dessus) ; l'origine est
   l'angle intérieur du logement. `north` donne la rotation à appliquer pour retrouver l'orientation réelle
   (la Sainte-Victoire est à l'Est).

   Sources :
   - Appartement-villa de 138 m² (lot 8) : relevé à l'échelle de l'axonométrie du graphiste (LOGEMENT_08_3D),
     calée sur la surface habitable annoncée ; le jardin fait environ 82 m².
   - Duplex de 206 m² : réunion des deux duplex d'origine (lots 2 et 3). Trame, façades, cuisine et jardin repris de
     l'axonométrie du lot 2 (LOGEMENT_02_3D) et du carnet de façades ; la distribution du logement réuni
     (réception, suite parentale, ascenseur) est une proposition d'aménagement, à ajuster sur le plan d'architecte.
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

/* ════════════════════════════════════════════════════════════════════════════════════════════
   1. APPARTEMENT-VILLA — 4 pièces, 138 m², jardin de 82 m² (lot 8, premier et dernier étage)
   x : de la façade Est (0) vers le jardin à l'Ouest (16,45) ; y : du mur mitoyen Sud (0) vers la façade Nord (8,8).
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const VW = 16.45, VD = 8.8;
const villa = {
  id: 'villa', bien: '138', north: 180, groundY: -6.75,
  name: { fr: 'Appartement-villa', en: 'Villa-style apartment' },
  facts: { fr: '4 pièces · 138 m² · jardin de 82 m²', en: '4 rooms · 138 m² · 82 m² garden' },
  pitch: { fr: 'Au premier et dernier étage, de plain-pied avec son jardin, la Sainte-Victoire à l\'Est.', en: 'On the first and top floor, level with its garden, the Sainte-Victoire to the east.' },
  levels: [{
    id: 'n1', name: { fr: 'Niveau unique', en: 'Single level' }, y: 0, h: 2.6,
    bounds: [-1.4, -0.4, 26, 9.3], walkable: [[-1.25, 0, 25.5, 9.1]],
    floors: [['floor', 0, 0, VW, VD], ['tile', 8.1, 0, 11.05, 2.6], ['tile', 9.6, 2.6, 11.05, 3.3], ['tile', 7.55, 2.65, 9.1, 3.9], ['tile', 8.5, 4.9, 10.15, 6.55], ['tile', 8.5, 6.65, 10.15, VD]],
    slabs: [[-1.3, -E, VW + E, VD + E, 0.3]],
    ceilings: [[0, 0, VW, VD]],
    walls: [
      // façades et mitoyen
      wv(-E / 2, -E, VD + E, E, -1, [op(1.5, 2.75, 'french', { rail: false, head: 2.3 }), op(4.2, 8.3, 'bay', { panels: 3, open: true, head: 2.35 })]),
      wh(VD + E / 2, -E, VW + E, E, 1, [op(1.2, 3.6, 'bay', { panels: 2, rail: true, head: 2.35 }), op(6.35, 7.6, 'french', { head: 2.3, shutter: 'a0' }), op(8.9, 9.5, 'window', { sill: 1.0, head: 2.2 }), op(10.75, 12.05, 'french', { head: 2.3, shutter: 'a1' })]),
      wh(-E / 2, -E, VW + E, E, -1, [op(6.05, 7.0, 'entry', { head: 2.15 })]),
      wv(VW + E / 2, -E, VD + E, E, 1, [op(1.25, 2.6, 'french', { rail: false, head: 2.3 }), op(3.8, 5.1, 'french', { rail: false, head: 2.3, shutter: 'a1' }), op(6.2, 7.55, 'french', { rail: false, head: 2.3 })]),
      // noyau : placard d'entrée, WC, salle de bains
      wv(8.05, 0, 2.6), wh(2.6, 7.5, 9.6), wv(7.5, 2.6, 4.0, 0.1, 0, [op(2.95, 3.75, 'door', { hinge: 'a1', swing: -1 })]),
      wv(9.35, 2.65, 3.95, 0.5), wh(3.95, 7.5, 9.65), wh(3.3, 9.6, 11.1),
      wv(11.1, 0, 3.95, 0.1, 0, [op(0.85, 1.65, 'door', { hinge: 'a1', swing: 1 })]),
      // suite parentale : dressing, chambre
      wh(3.3, 11.1, 13.4, 0.1, 0, [op(11.2, 12.05, 'door', { hinge: 'a0', swing: -1 })]),
      wv(13.4, 0, 3.95, 0.1, 0, [op(0.95, 1.8, 'door', { hinge: 'a1', swing: -1 })]),
      wh(3.5, 13.45, VW),
      // côté Nord : cuisine, salle d'eau, buanderie, chambres
      wh(4.85, 7.45, 13.45, 0.1, 0, [op(9.4, 10.15, 'door', { hinge: 'a1', swing: 1 }), op(12.55, 13.4, 'door', { hinge: 'a1', swing: 1 })]),
      wv(8.45, 4.85, VD, 0.1, 0, [op(7.8, 8.6, 'door', { hinge: 'a0', swing: 1 })]),
      wh(6.6, 8.5, 10.2), wv(10.2, 4.85, VD), wv(13.5, 4.85, VD),
      wh(5.15, 13.55, VW, 0.1, 0, [op(15.55, 16.4, 'door', { hinge: 'a1', swing: 1 })]),
      wv(5.95, 4.85, 5.25, 0.7),
    ],
    rails: [[-1.2, -E, -1.2, VD + E], [-1.2, -E, -E, -E], [-1.2, VD + E, -E, VD + E]],
    items: [
      // séjour
      ['tvWall', 3.0, 0, 0, { w: 4.8 }], ['rug', 3.05, 3.2, 0, { w: 4.3, d: 3.5 }],
      ['sofa', 2.95, 4.35, 180, { w: 3.9, d: 1.05, mat: 'cream', chaise: 'R', cl: 1.9, cw: 1.2 }],
      ['coffeeRound', 3.8, 2.25, 0, { r: 0.52 }], ['coffeeRound', 3.1, 2.8, 0, { r: 0.4, h: 0.3 }],
      ['sideboard', 5.92, 1.7, 270, { w: 2.2, d: 0.5, h: 0.82, mat: 'anthracite', top: 'walnut' }], ['tableLamp', 5.92, 0.85, 0, { y: 0.845 }],
      ['pampas', 0.38, 0.42, 0, {}], ['picture', 0.0, 3.48, 90, { w: 0.8, h: 1.0, mat: 'art1' }], ['floorLamp', 0.45, 8.4, 0, {}],
      ['curtain', 0.1, 3.98, 90, { w: 0.4 }], ['curtain', 0.1, 8.55, 90, { w: 0.4 }],
      // repas
      ['diningTable', 2.25, 7.0, 90, { w: 1.9, d: 1.0, top: 'marbleDark', n: 3, ends: false, chairMat: 'greige' }], ['pendant', 2.25, 7.0, 90, { kind: 'ring', drop: 0.95 }],
      // entrée
      ['wardrobe', 7.68, 1.2, 270, { w: 2.3, d: 0.6, mat: 'lacquer' }],
      // cuisine
      ['kitchenRun', 5.93, 6.9, 90, { w: 3.2, front: 'navy', top: 'marble', hob: 0.5 }],
      ['barTable', 4.83, 7.65, 0, { w: 1.5, d: 0.9, top: 'oak', stools: 2 }], ['pendant', 4.83, 7.65, 0, { kind: 'cone', n: 2, span: 0.6, drop: 0.8 }],
      ['kitchenTall', 8.08, 5.4, 270, { w: 1.0, front: 'oak' }],
      ['kitchenRun', 8.08, 6.85, 270, { w: 1.9, front: 'navy', top: 'marble', sink: 0, upper: true, splash: true }],
      // WC
      ['toilet', 8.77, 3.28, 270, {}], ['basin', 7.9, 3.75, 180, { w: 0.42 }],
      // salle de bains
      ['panel', 8.105, 1.05, 90, { w: 2.1, h: 2.2 }], ['panel', 9.58, 0.005, 0, { w: 2.9, h: 2.2 }],
      ['bathtub', 8.53, 1.07, 0, { w: 0.82, l: 1.8 }], ['vanity', 10.1, 0.27, 0, { w: 1.5 }],
      ['toilet', 10.55, 2.96, 180, {}], ['towelRail', 11.045, 2.4, 270, {}],
      // dressing et chambre parentale
      ['wardrobe', 12.3, 0.32, 0, { w: 2.1, d: 0.6 }], ['vanityTable', 12.65, 3.03, 180, { w: 1.3 }], ['mirror', 12.65, 3.245, 180, { w: 0.8, h: 0.9 }],
      ['wardrobe', 10.35, 3.65, 0, { w: 1.4, d: 0.6, mat: 'lacquer' }], ['wardrobe', 12.75, 3.65, 0, { w: 1.3, d: 0.6, mat: 'lacquer' }],
      ['bed', 15.0, 2.35, 180, { w: 1.6, l: 2.0 }], ['dresser', 15.2, 0.26, 0, { w: 1.9 }], ['rug', 15.0, 1.75, 0, { w: 2.7, d: 1.5 }],
      ['curtain', 16.34, 0.98, 270, { w: 0.45 }], ['curtain', 16.34, 2.9, 270, { w: 0.45 }],
      // bureau
      ['panel', 14.95, 3.555, 0, { w: 2.95, h: 2.6, slats: true, mat: 'slat' }],
      ['desk', 14.55, 4.78, 180, { w: 1.9, d: 0.6, top: 'marbleDark', chair: 'cream' }],
      // chambre 2
      ['wardrobe', 14.55, 5.52, 0, { w: 1.9, d: 0.6 }], ['bed', 14.72, 7.93, 90, { w: 1.6, l: 2.0, nights: false, hw: 0.1, throwMat: 'charcoal' }],
      ['armchair', 14.2, 6.45, 200, { mat: 'charcoal' }], ['rug', 15.1, 7.3, 0, { w: 2.5, d: 2.6, mat: 'rugDark' }],
      // chambre 3
      ['wardrobe', 11.35, 5.22, 0, { w: 2.1, d: 0.6 }], ['desk', 10.57, 7.15, 90, { w: 1.7, d: 0.6, top: 'lacquer', chair: 'greige' }],
      ['bed', 12.95, 7.72, 0, { w: 0.9, l: 2.0, nights: false, hw: 0.06, throwMat: 'sage' }],
      // salle d'eau et buanderie
      ['vanity', 8.75, 5.75, 90, { w: 1.0, double: false, d: 0.46 }], ['shower', 9.65, 6.07, 180, { w: 1.0, d: 0.95, glass: ['right'] }], ['towelRail', 10.145, 5.3, 270, {}],
      ['washer', 9.84, 7.45, 270, { n: 2 }], ['shelves', 8.71, 7.15, 90, { w: 0.9, d: 0.36 }],
      // balcon
      ['planter', -0.78, 0.5, 90, { w: 1.2, d: 0.36 }], ['planter', -0.78, 8.6, 90, { w: 1.0, d: 0.36 }],
    ],
    rooms: [
      { id: 'entree', fr: 'Entrée', en: 'Entrance', r: [5.6, 0, 7.5, 4.85], at: [6.6, 2.6], cam: { p: [6.6, 0.95], t: [3.6, 4.6] } },
      { id: 'sejour', fr: 'Séjour', en: 'Living room', r: [0, 0, 5.6, 5.9], at: [2.9, 2.6], cam: { p: [4.95, 5.6], t: [1.0, 2.6] } },
      { id: 'repas', fr: 'Salle à manger', en: 'Dining area', r: [0, 5.9, 5.6, VD], at: [2.3, 7.0], cam: { p: [4.0, 6.2], t: [0.6, 7.6] } },
      { id: 'cuisine', fr: 'Cuisine ouverte', en: 'Open kitchen', r: [5.6, 4.85, 8.45, VD], at: [7.0, 6.9], cam: { p: [7.0, 5.55], t: [7.0, 9.4] } },
      { id: 'balcon', fr: 'Balcon', en: 'Balcony', r: [-1.25, -E, 0, VD + E], at: [-0.75, 6.2], cam: { p: [-0.75, 6.3], t: [-40, 5.2] } },
      { id: 'dressing', fr: 'Dressing', en: 'Dressing room', r: [11.15, 0, 13.4, 3.3], at: [12.3, 1.7], cam: { p: [11.65, 2.2], t: [13.2, 0.9] } },
      { id: 'suite', fr: 'Chambre parentale', en: 'Master bedroom', r: [13.45, 0, VW, 3.5], at: [15.0, 1.9], cam: { p: [13.85, 0.95], t: [16.2, 2.7] } },
      { id: 'sdb', fr: 'Salle de bains', en: 'Bathroom', r: [8.1, 0, 11.05, 3.3], at: [9.7, 1.5], cam: { p: [10.6, 1.75], t: [8.5, 0.5] } },
      { id: 'bureau', fr: 'Bureau', en: 'Study', r: [13.45, 3.55, VW, 5.15], at: [15.0, 4.3], cam: { p: [16.05, 4.15], t: [14.0, 4.7] } },
      { id: 'ch2', fr: 'Chambre 2', en: 'Bedroom 2', r: [13.55, 5.2, VW, VD], at: [15.0, 7.2], cam: { p: [16.0, 6.05], t: [14.2, 8.2] } },
      { id: 'ch3', fr: 'Chambre 3', en: 'Bedroom 3', r: [10.25, 4.9, 13.45, VD], at: [11.9, 7.0], cam: { p: [12.9, 5.75], t: [11.0, 8.2] } },
      { id: 'sde', fr: 'Salle d\'eau', en: 'Shower room', r: [8.5, 4.9, 10.15, 6.55], at: [9.35, 5.7], cam: { p: [9.75, 5.25], t: [9.0, 6.4] } },
      { id: 'buanderie', fr: 'Buanderie', en: 'Laundry', r: [8.5, 6.65, 10.15, VD], at: [9.35, 7.8], cam: { p: [9.1, 8.25], t: [9.9, 7.0] } },
      { id: 'wc', fr: 'WC', en: 'WC', r: [7.55, 2.65, 9.1, 3.9], at: [8.3, 3.25], cam: { p: [7.95, 3.2], t: [9.0, 3.3] }, minor: true },
      { id: 'degagement', fr: 'Dégagement', en: 'Hallway', r: [7.5, 3.95, 13.45, 4.85], at: [10.4, 4.4], minor: true, hidden: true },
      { id: 'jardin', fr: 'Jardin privatif', en: 'Private garden', r: [VW + E, -E, 25.6, VD + E], at: [21.3, 4.5], cam: { p: [18.3, 4.45], t: [24, 4.6] } },
    ],
    tour: ['entree', 'sejour', 'balcon', 'repas', 'cuisine', 'suite', 'sdb', 'bureau', 'ch2', 'jardin'],
  }],
  start: { room: 'sejour' },
  orbit: { target: [11.4, 0, 4.6], dist: 33 },
  exterior(b, M, lv) {
    const gx0 = VW + E, gx1 = 25.55, gz0 = -E, gz1 = VD + E;
    b.on('ext');
    // balcon filant côté Sainte-Victoire
    b.box(M.terrace, -1.25, -0.04, -E, -E, 0, VD + E); b.box(M.stucco, -1.3, -0.32, -E - 0.05, -E, -0.04, VD + E + 0.05);
    // jardin de plain-pied : terrasse en pierre puis pelouse
    b.box(M.terrace, gx0, -0.06, gz0, 19.3, -0.015, gz1); b.box(M.grass, 19.3, -0.1, gz0, gx1, -0.02, gz1); b.box(M.earth, gx0, -1.2, gz0, gx1 + 0.4, -0.1, gz1);
    lv.blocks.push(V.hedge(b, M, gx0, gz0, gx1, gz0 + 0.75, { h: 1.65 }));
    b.box(M.stone, gx1, -1.2, gz0 - 0.1, gx1 + 0.42, 1.45, gz1 + 0.1); lv.blocks.push([gx1, gz0, gx1 + 0.42, gz1]);
    railing(b, M, gx0, gz1 - 0.04, gx1, gz1 - 0.04, -0.02, 1.1); lv.blocks.push([gx0, gz1 - 0.1, gx1, gz1 + 0.1]);
    b.box(M.stone, gx0, -3.2, gz1, gx1 + 0.42, -0.02, gz1 + 0.35);
    lv.blocks.push(V.tree(b, M, 23.9, 3.3, { kind: 'pine', h: 6.2, r: 2.7, seed: 4 }));
    lv.blocks.push(V.cypress(b, M, 24.9, 1.2, { h: 5.5 }));
    lv.blocks.push(V.oleander(b, M, 24.6, 7.7, { r: 0.85 }));
    lv.blocks.push(V.palm(b, M, 18.0, 1.25, { r: 1.0 }));
    V.lavender(b, M, 25.2, 2.4, 25.2, 6.6, { seed: 2 });
    // volumes de la résidence, en maquette claire : rez-de-chaussée sous le logement et reste du bâtiment au Sud
    b.on('ctx');
    b.box(M.massing, -E, -3.15, -E, VW + E, -0.32, VD + E);
    b.box(M.massing, -E, -3.15, -22.4, VW + E, 1.25, -E - 0.01);
    b.on('L0:top'); b.box(M.massing, -E, 1.25, -22.4, VW + E, 2.9, -E - 0.01); b.on('ctx');
    b.box(M.earth, VW + E, -3.2, -40, 60, -0.12, gz0);                    // terrain haut, côté Ouest
    b.box(M.earth, gx1 + 0.42, -3.2, gz0, 60, -0.12, gz1 + 0.35);
    pool(b, M, -13.5, -19.5, -8.3, -7.4, -6.7);
    b.box(M.stone, -6.3, -6.7, -24, -5.9, -3.2, 12); b.box(M.grass, -5.9, -3.3, -24, -E, -3.16, 12);   // jardins du rez-de-chaussée
    b.on('ext:top');
    hipRoof(b, M.roof, -1.5, -23, VW + 0.95, VD + 0.95, 2.92, 2.2);
    b.box(M.stucco, -E, 2.6, -E, VW + E, 2.92, VD + E);
  },
  trees: [[-11, 4, 'olive', 5], [-15, 9, 'pine', 8], [-21, 1, 'cypress', 8], [-24, 9, 'pine', 9], [-13, -2, 'cypress', 7], [-27, -4, 'olive', 5], [-30, 5, 'pine', 10], [-19, 14, 'olive', 5], [-9, 18, 'pine', 9], [-17, 6, 'olive', 5], [-20, -10, 'pine', 10], [6, 17, 'pine', 9], [16, 20, 'cypress', 8], [31, 2, 'pine', 9], [33, -9, 'cypress', 9], [29, 13, 'olive', 5], [-22, -24, 'cypress', 9], [-3, -30, 'pine', 9]],
};

/* ════════════════════════════════════════════════════════════════════════════════════════════
   2. DUPLEX — 4 pièces, 206 m², terrasse et jardin d'environ 56 m², ascenseur privatif
   x : du fond (Ouest, 0) vers la façade sur jardin à l'Est (11) ; y : du Nord (0) au Sud (11,8).
   L'étage ne couvre que les 7,8 m côté façade (x de 3,2 à 11).
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const DW = 11.0, DD = 11.8, UX = 3.2, FH = 2.9;
const stair = { xa: [3.2, 4.2], xb: [4.25, 5.25], yFoot: 2.85, tread: 0.265, n: 8, H: FH, yWall: 0 };
const duplex = {
  id: 'duplex', bien: 'duplex-206', north: 0, groundY: -3.55,
  name: { fr: 'Duplex', en: 'Duplex' },
  facts: { fr: '4 pièces · 206 m² · terrasse et jardin d\'environ 56 m²', en: '4 rooms · 206 m² · terrace and garden of about 56 m²' },
  pitch: { fr: 'Les volumes d\'une maison : plus de 100 m² de réception et un ascenseur privatif depuis le sous-sol.', en: 'The volumes of a house: over 100 m² of reception space and a private lift from the basement.' },
  stair,
  lift: { at: [[6.17, 2.3], [6.17, 2.35]] },
  levels: [{
    id: 'rdc', name: { fr: 'Rez-de-jardin', en: 'Garden level' }, y: 0, h: 2.6,
    bounds: [-0.4, -0.4, 16.6, 12.2], walkable: [[0, 0, 16.1, DD]],
    floors: [['floor', 0, 0, DW, DD], ['tile', 0, 0, 1.9, 2.2], ['tile', 2.0, 0, 3.1, 2.2]],
    slabs: [[-E, -E, DW + E, DD + E, 0.3]],
    ceilings: [[0, 0, 3.15, DD], [3.15, 2.85, DW, DD], [7.1, 0, DW, 2.85], [5.3, 1.8, 7.1, 2.85]],
    walls: [
      wv(-E / 2, -E, DD + E, E, -1, [op(2.45, 3.4, 'entry', { head: 2.15 })]),
      wh(-E / 2, -E, DW + E, E, -1), wh(DD + E / 2, -E, DW + E, E, 1),
      wv(DW + E / 2, -E, DD + E, E, 1, [op(0.9, 4.9, 'bay', { panels: 3, open: true, head: 2.4 }), op(6.9, 10.9, 'bay', { panels: 3, open: true, head: 2.4 })]),
      // buanderie et WC
      wv(1.95, 0, 2.25), wh(2.25, 0, 3.15, 0.1, 0, [op(1.0, 1.8, 'door', { hinge: 'a1', swing: -1 }), op(2.15, 2.95, 'door', { hinge: 'a0', swing: -1 })]),
      // cage d'escalier et ascenseur
      wv(3.15, 0, 2.85, 0.1, 0, [], { h: FH }), wv(5.3, 0, 2.85, 0.1, 0, [], { h: FH }), wv(4.225, 0.95, 2.85, 0.06, 0, [], { h: FH }),
      wh(2.85, 4.25, 5.35), wv(7.1, 0, 1.8), wh(1.8, 5.3, 7.15, 0.1, 0, [op(5.75, 6.6, 'lift', { head: 2.1, face: -1 })]),
      // entrée
      wh(4.35, 0, 2.0),
    ],
    blockers: [[3.2, 0, 4.25, 2.78], [5.35, 0, 7.1, 1.8]],
    items: [
      ['wardrobe', 1.0, 4.0, 180, { w: 1.9, d: 0.6, mat: 'lacquer' }], ['pendant', 1.6, 3.3, 0, { kind: 'globe', drop: 0.6 }],
      ['washer', 0.95, 0.34, 0, { n: 2 }], ['toilet', 2.55, 0.34, 0, {}], ['basin', 2.96, 1.5, 270, { w: 0.4 }],
      // cuisine
      ['kitchenTall', 0.335, 8.6, 90, { w: 2.4, front: 'oak' }], ['kitchenRun', 0.335, 10.75, 90, { w: 1.9, front: 'navy', top: 'marble' }],
      ['kitchenRun', 3.0, 11.465, 180, { w: 4.6, front: 'navy', top: 'marble', sink: -0.3, upper: true, splash: true }],
      ['island', 3.3, 9.15, 180, { w: 3.2, d: 1.15, front: 'navy', top: 'marble', hob: 0.4, stools: 4, stoolMat: 'cognac' }],
      ['pendant', 3.3, 9.0, 0, { kind: 'cone', n: 3, span: 0.9, drop: 0.85 }],
      // bureau-bibliothèque
      ['bookcase', 0.19, 5.85, 90, { w: 2.6, h: 2.3 }], ['desk', 1.6, 5.85, 270, { w: 1.8, d: 0.75, top: 'walnut', chair: 'cognac' }], ['rug', 1.75, 5.85, 0, { w: 2.7, d: 2.5, mat: 'rugDark' }],
      // salon
      ['tvWall', 9.0, 0, 0, { w: 3.6, tv: 1.5 }], ['rug', 8.9, 2.7, 0, { w: 4.0, d: 3.7 }],
      ['sofa', 8.95, 4.05, 180, { w: 3.4, d: 1.05, mat: 'linen', chaise: 'L', cl: 1.7, cw: 1.15, pillows: ['terra', 'sage'] }],
      ['coffeeRect', 8.55, 2.3, 0, { w: 1.3, d: 0.7, mat: 'marble' }], ['armchair', 7.72, 2.35, 90, { mat: 'cognac' }],
      ['plant', 10.55, 5.9, 0, { h: 1.9 }], ['curtain', 10.9, 5.1, 270, { w: 0.5 }], ['curtain', 10.9, 6.7, 270, { w: 0.5 }],
      ['sideboard', 4.8, 3.11, 0, { w: 1.0, d: 0.36, h: 0.8, mat: 'oak' }], ['mirror', 4.8, 2.905, 0, { w: 0.7, h: 0.9 }], ['tableLamp', 4.5, 3.11, 0, { y: 0.8 }],
      // repas
      ['diningTable', 8.0, 8.85, 0, { w: 3.0, d: 1.1, top: 'marble', n: 4, ends: true, chairMat: 'terra' }], ['pendant', 8.0, 8.85, 0, { kind: 'globe', n: 3, span: 0.9, drop: 0.9 }],
      ['sideboard', 8.0, 11.52, 180, { w: 2.4, d: 0.48, h: 0.8, mat: 'walnut', top: 'marbleDark' }], ['picture', 8.0, DD, 180, { w: 1.3, h: 0.9, mat: 'art2' }], ['tableLamp', 7.1, 11.52, 0, { y: 0.83 }],
      ['plant', 10.5, 11.3, 0, { h: 1.7, kind: 'ficus' }],
    ],
    rooms: [
      { id: 'entree', fr: 'Entrée', en: 'Entrance', r: [0, 2.3, 3.15, 4.3], at: [1.6, 3.2], cam: { p: [2.7, 3.3], t: [8.5, 6.2] } },
      { id: 'sejour', fr: 'Salon', en: 'Living room', r: [5.3, 0, DW, 5.9], at: [8.6, 2.6], cam: { p: [6.2, 3.3], t: [9.8, 0.9] } },
      { id: 'repas', fr: 'Salle à manger', en: 'Dining room', r: [5.3, 5.9, DW, DD], at: [8.0, 8.9], cam: { p: [5.9, 6.9], t: [9.2, 9.6] } },
      { id: 'cuisine', fr: 'Cuisine', en: 'Kitchen', r: [0, 7.3, 5.3, DD], at: [3.0, 10.3], cam: { p: [4.7, 7.6], t: [2.4, 10.8] } },
      { id: 'bureau', fr: 'Bureau-bibliothèque', en: 'Study and library', r: [0, 4.4, 3.2, 7.3], at: [1.7, 5.9], cam: { p: [3.5, 4.9], t: [0.4, 6.3] } },
      { id: 'buanderie', fr: 'Buanderie', en: 'Laundry', r: [0, 0, 1.9, 2.2], at: [0.95, 1.2], cam: { p: [1.3, 1.6], t: [0.6, 0.2] }, minor: true },
      { id: 'wc', fr: 'WC', en: 'WC', r: [2.0, 0, 3.1, 2.2], at: [2.55, 1.2], cam: { p: [2.5, 1.7], t: [2.6, 0.2] }, minor: true },
      { id: 'jardin', fr: 'Terrasse et jardin', en: 'Terrace and garden', r: [DW + E, 0, 16.1, DD], at: [13.7, 5.9], cam: { p: [12.4, 5.9], t: [30, 5.6] } },
    ],
    tour: ['entree', 'sejour', 'jardin', 'repas', 'cuisine'],
  }, {
    id: 'etage', name: { fr: 'Étage', en: 'Upper floor' }, y: FH, h: 2.5,
    bounds: [2.8, -0.4, 11.4, 12.2], walkable: [[UX, 0, DW, DD]],
    floors: [['floor', UX, 2.85, DW, DD], ['floor', 7.1, 0, DW, 2.85], ['floor', 5.3, 1.8, 7.1, 2.85], ['tile', UX, 4.15, 5.9, 5.85], ['tile', UX, 8.5, 7.05, DD]],
    ceilings: [[UX, 0, DW, DD]],
    walls: [
      wv(UX - E / 2, -E, DD + E, E, -1), wh(-E / 2, UX - E, DW + E, E, -1), wh(DD + E / 2, UX - E, DW + E, E, 1),
      wv(DW + E / 2, -E, DD + E, E, 1, [op(0.9, 2.1, 'french', { head: 2.25, shutter: 'a1' }), op(3.75, 4.95, 'french', { head: 2.25, shutter: 'a0' }), op(6.85, 8.05, 'french', { head: 2.25, shutter: 'a1' }), op(9.7, 10.9, 'french', { head: 2.25, shutter: 'a0' })]),
      // ascenseur, garde-corps de la trémie
      wv(5.3, 0, 1.8), wh(1.8, 5.3, 7.15, 0.1, 0, [op(5.75, 6.6, 'lift', { head: 2.1, face: -1 })]), wv(4.225, 0.95, 2.85, 0.06, 0, [], { h: 1.05 }),
      // chambres 2 et 3, suite
      wv(7.1, 0, DD, 0.1, 0, [op(1.95, 2.8, 'door', { hinge: 'a0', swing: 1 }), op(3.15, 4.0, 'door', { hinge: 'a1', swing: 1 }), op(6.2, 7.2, 'pass', { head: 2.2 })]),
      wh(2.95, 7.1, DW),
      wh(5.9, UX, DW, 0.1, 0, [op(6.15, 7.0, 'door', { hinge: 'a1', swing: 1 })]),
      wh(4.1, UX, 5.95, 0.1, 0, [op(5.05, 5.85, 'door', { hinge: 'a0', swing: 1 })]), wv(5.95, 4.1, 5.9),
      wh(8.45, UX, 7.1, 0.1, 0, [op(4.6, 5.45, 'door', { hinge: 'a0', swing: 1 })]),
    ],
    rails: [[3.2, 2.87, 4.2, 2.87], [5.28, 1.85, 5.28, 2.85]],
    blockers: [[3.2, 0, 5.3, 2.8], [5.35, 0, 7.1, 1.8]],
    items: [
      ['sideboard', 4.1, 3.87, 180, { w: 1.4, d: 0.34, h: 0.8, mat: 'oak' }], ['picture', 4.1, 4.05, 180, { w: 1.0, h: 0.8, mat: 'art1' }], ['pendant', 6.2, 3.5, 0, { kind: 'globe', drop: 0.55 }],
      // chambres 2 et 3
      ['wardrobe', 7.47, 0.95, 90, { w: 1.8, d: 0.6 }], ['bed', 9.45, 1.1, 0, { w: 1.4, l: 2.0, hw: 0.3, throwMat: 'sage' }], ['rug', 9.45, 1.6, 0, { w: 2.6, d: 1.6 }],
      ['wardrobe', 7.47, 4.95, 90, { w: 1.7, d: 0.6 }], ['bed', 9.45, 4.75, 180, { w: 1.4, l: 2.0, hw: 0.3, throwMat: 'ochre' }], ['rug', 9.45, 4.2, 0, { w: 2.6, d: 1.6, mat: 'rugDark' }],
      // salle d'eau
      ['vanity', 3.95, 4.39, 0, { w: 1.1, double: false, d: 0.46 }], ['shower', 3.75, 5.39, 180, { w: 1.05, d: 0.9, glass: ['left'] }], ['toilet', 5.0, 5.52, 180, {}],
      // suite : dressing
      ['wardrobe', 3.52, 7.17, 90, { w: 2.4, d: 0.6 }], ['wardrobe', 4.95, 6.27, 0, { w: 2.2, d: 0.6 }], ['bench', 5.3, 7.55, 0, { w: 1.3 }], ['mirror', 6.4, 8.395, 180, { w: 0.7, h: 1.7, y: 1.1 }],
      // suite : salle de bains
      ['vanity', 3.455, 9.75, 90, { w: 1.8, double: true }], ['bathtub', 4.6, 11.2, 90, { free: true, w: 0.85, l: 1.75 }],
      ['shower', 6.5, 11.05, 270, { w: 1.5, d: 1.1, glass: ['left', 'front'] }], ['toilet', 6.72, 9.2, 270, {}], ['towelRail', 3.21, 11.25, 90, {}],
      // suite : chambre
      ['panel', 7.155, 9.5, 90, { w: 4.2, h: 2.5, slats: true, mat: 'slat' }],
      ['bed', 8.27, 9.5, 90, { w: 1.8, l: 2.0, hw: 0.9, throwMat: 'terra' }], ['bench', 9.6, 9.5, 90, { w: 1.5 }], ['rug', 8.95, 9.5, 0, { w: 3.5, d: 3.3 }],
      ['armchair', 10.15, 6.55, 235, { mat: 'cream' }], ['sideTable', 10.5, 7.25, 0, { r: 0.2, h: 0.5, mat: 'marble' }], ['dresser', 10.74, 8.88, 270, { w: 1.5, tv: false }],
    ],
    rooms: [
      { id: 'palier', fr: 'Palier', en: 'Landing', r: [UX, 1.85, 7.1, 4.05], at: [5.2, 3.5], cam: { p: [5.9, 3.5], t: [3.6, 1.2] } },
      { id: 'ch2', fr: 'Chambre 2', en: 'Bedroom 2', r: [7.15, 0, DW, 2.9], at: [9.2, 1.5], cam: { p: [7.9, 2.45], t: [10.6, 0.9] } },
      { id: 'ch3', fr: 'Chambre 3', en: 'Bedroom 3', r: [7.15, 3.0, DW, 5.85], at: [9.2, 4.4], cam: { p: [7.8, 3.5], t: [10.5, 5.2] } },
      { id: 'sde', fr: 'Salle d\'eau', en: 'Shower room', r: [UX, 4.15, 5.9, 5.85], at: [4.6, 5.0], cam: { p: [5.45, 4.75], t: [3.6, 5.5] }, minor: true },
      { id: 'degagement', fr: 'Dégagement', en: 'Hallway', r: [6.0, 4.1, 7.1, 5.85], at: [6.5, 5.0], minor: true, hidden: true },
      { id: 'dressing', fr: 'Dressing', en: 'Dressing room', r: [UX, 5.95, 7.05, 8.4], at: [5.2, 7.2], cam: { p: [6.55, 7.5], t: [3.8, 6.6] } },
      { id: 'suite', fr: 'Suite parentale', en: 'Master suite', r: [7.15, 5.95, DW, DD], at: [9.1, 8.9], cam: { p: [7.85, 6.7], t: [10.6, 10.6] } },
      { id: 'sdb', fr: 'Salle de bains', en: 'Bathroom', r: [UX, 8.5, 7.05, DD], at: [5.1, 10.1], cam: { p: [5.05, 9.2], t: [4.5, 11.5] } },
    ],
    tour: ['palier', 'ch2', 'suite', 'sdb', 'dressing'],
  }],
  start: { room: 'sejour' },
  orbit: { target: [7.9, 0, 6.2], dist: 27 },
  exterior(b, M, lv, lv1) {
    const gx0 = DW + E, gx1 = 16.1;
    b.on('ext');
    b.box(M.terrace, gx0, -0.06, -E, 14.0, -0.015, DD + E); b.box(M.grass, 14.0, -0.1, -E, gx1, -0.02, DD + E); b.box(M.earth, gx0, -1.0, -E, gx1 + 0.4, -0.1, DD + E);
    lv.blocks.push(V.hedge(b, M, gx0, -E, gx1, 0.3, { h: 1.6 })); lv.blocks.push(V.hedge(b, M, gx0, DD - 0.3, gx1, DD + E, { h: 1.6 }));
    b.box(M.stone, gx1, -3.6, -E, gx1 + 0.4, 0.45, DD + E); lv.blocks.push(V.hedge(b, M, gx1 - 0.5, 0.3, gx1, DD - 0.3, { h: 0.95 }));
    lv.blocks.push([gx1 - 0.1, -E, gx1 + 0.4, DD + E]);
    b.box(M.frame, DW + 0.2, 2.42, 0.7, DW + E + 0.02, 2.5, 5.1); b.box(M.frame, DW + 0.2, 2.42, 6.7, DW + E + 0.02, 2.5, 11.1);
    lv.blocks.push(V.cypress(b, M, 15.3, 0.85, { h: 5 })); lv.blocks.push(V.cypress(b, M, 15.3, DD - 0.85, { h: 5 }));
    lv.blocks.push(V.oleander(b, M, 15.1, 5.9, { r: 0.7, seed: 8 }));
    V.lavender(b, M, 14.25, 1.2, 14.25, 4.4, { seed: 5 }); V.lavender(b, M, 14.25, 7.4, 14.25, 10.6, { seed: 6 });
    // volumes de la résidence, en maquette claire
    b.on('ctx');
    // découpés aux mêmes hauteurs que le logement, pour suivre la coupe de la maquette à chaque niveau
    for (const [lay, ya, yb] of [['ctx', 0, 1.25], ['L0:top', 1.25, FH], ['L1', FH, FH + 1.25], ['L1:top', FH + 1.25, 5.72]]) {
      b.on(lay);
      b.box(M.massing, -6.6, ya, -9.8, DW + E, yb, -E - 0.01); b.box(M.massing, -6.6, ya, DD + E + 0.01, DW + E, yb, 21.4);
      b.box(M.massing, -6.6, ya, -E, -E - 0.01, yb, DD + E);
      if (ya >= FH) b.box(M.massing, -E, ya, -E, UX - E - 0.01, yb, DD + E);          // logements voisins au-dessus du fond du rez-de-jardin
    }
    b.on('ctx');
    b.box(M.earth, -40, 0, -40, -6.6, 2.85, 50);                                   // terrain haut, à l'arrière
    b.box(M.grass, gx0, -0.1, -9.8, gx1, -0.02, -E); b.box(M.grass, gx0, -0.1, DD + E, gx1, -0.02, 21.4); b.box(M.stone, gx1, -3.6, -9.8, gx1 + 0.4, 0.45, 21.4);
    pool(b, M, 21.5, -0.2, 26.7, 11.9, -3.5);
    b.on('L0:top');
    // dalle entre les deux niveaux, trémies de l'escalier et de l'ascenseur réservées
    for (const s of [[-E, -E, UX, DD + E], [UX, 2.85, DW + E, DD + E], [7.1, -E, DW + E, 2.85], [5.3, 1.8, 7.1, 2.85]]) b.box(M.concrete, s[0], 2.65, s[1], s[2], FH - 0.03, s[3]);
    b.on('ext:top');
    hipRoof(b, M.roof, -7.3, -10.5, DW + 1.0, 22.1, 5.74, 2.2);
    b.box(M.stucco, UX - E, FH + 2.5, -E, DW + E, 5.74, DD + E);
  },
  garden: [
    ['outdoorSofa', 12.15, 2.3, 90, { w: 2.2 }], ['sideTable', 12.9, 3.7, 0, { r: 0.3, h: 0.4 }], ['lounger', 15.0, 2.6, 270, {}], ['lounger', 15.0, 3.6, 270, {}],
    ['outdoorTable', 12.75, 8.9, 90, { w: 2.2, n: 3 }], ['parasol', 13.95, 8.9, 0, { r: 1.6 }], ['planter', 11.75, 5.9, 90, { w: 1.4, d: 0.4 }],
  ],
  trees: [[31, 3, 'olive', 5], [33, 9, 'cypress', 8], [37, -2, 'pine', 9], [40, 12, 'pine', 10], [30, 16, 'olive', 5], [44, 2, 'cypress', 9], [36, -14, 'olive', 5], [34, -8, 'pine', 9], [36, 20, 'olive', 5], [31, 26, 'cypress', 9], [24, -16, 'pine', 10], [19, 28, 'pine', 9], [42, 6, 'cypress', 8], [-12, -22, 'pine', 10], [-16, 30, 'pine', 9]],
};

villa.garden = [
  ['outdoorTable', 20.75, 3.45, 90, { w: 2.5, n: 3, ends: true }], ['lounger', 20.0, 7.75, 0, {}], ['lounger', 20.95, 7.75, 0, {}], ['lounger', 22.25, 7.75, 0, {}],
  ['sideTable', 21.6, 8.35, 0, {}], ['outdoorSofa', 17.75, 7.4, 90, { w: 2.0 }], ['sideTable', 18.6, 7.4, 0, { r: 0.32, h: 0.36 }], ['planter', 17.2, 3.25, 90, { w: 1.0, d: 0.36 }], ['planter', 17.2, 5.65, 90, { w: 0.9, d: 0.36 }],
];

export const APARTMENTS = [villa, duplex];
