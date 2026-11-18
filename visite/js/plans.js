/* 59 Cézanne — visite 3D : données des deux logements.
   Unité : le mètre. Repère de plan : x vers la droite, y vers le bas (comme sur un plan vu de dessus) ; l'origine est
   l'angle intérieur du logement. `north` donne la rotation à appliquer pour retrouver l'orientation réelle
   (la Sainte-Victoire est à l'Est).

   Sources : les deux plans de vente de l'architecte, et eux seuls.
   - Appartement-villa : « Logement 08, niveau 1 », indice C du 29/04/2024 (137,9 m², jardin 82,1 m²). Chambres 1 et 2 et bureau
     à l'Ouest sur le jardin, suite avec dressing et salle de bains, séjour à l'Est sur le balcon.
   - Duplex : « Logement 02 - V4 » (niveau 1 : entrée, séjours, cuisine, arrière-cuisine, buanderie, WC ; niveau 2 : trois chambres,
     deux salles de bains, WC), escalier balancé au centre, ascenseur privatif au centre de la moitié Sud.
   Les cotes imprimées sur les plans sont reportées telles quelles (en centimètres sur les plans, en mètres ici) ; ce qui n'est pas
   coté est mesuré sur le plan. Surfaces des pièces = tableau du plan (indicatives).
   Illustrations non contractuelles. */
import * as THREE from 'three';
import { V } from 'v3d/furniture';
import 'v3d/decor';                               // objets de vie (types ajoutés au catalogue F avant la construction)
import { railing } from 'v3d/build';
import { buildSite } from 'v3d/site';

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

/* ── Jardins privatifs : petits outils ─────────────────────────────────────────────────────── */
/* Mur ou bande rectiligne le long du segment (ax, az) → (bx, bz), d'épaisseur |t| portée à droite du segment vu de dessus
   (vers +x pour un segment orienté vers +z), à gauche si t < 0 : murets en biais, bordures. */
function seg(b, mat, ax, az, bx, bz, t, y0, y1) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = dz / L, nz = -dx / L;
  b.geo(mat, new THREE.BoxGeometry(L, y1 - y0, Math.abs(t)), (ax + bx) / 2 + (nx * t) / 2, (y0 + y1) / 2, (az + bz) / 2 + (nz * t) / 2, 0, Math.atan2(-dz, dx), 0);
}
/* Bordure acier de 6 mm entre dallage et pelouse ou massif : 3 mm au-dessus du dallage, jamais dans son plan. */
const edge = (b, M, x0, z0, x1, z1) => b.box(M.frame, x0, -0.08, z0, x1, -0.012, z1);
/* Bande au pied d'une façade, entre xa et xb, de z0 à z1 : caniveau à grille devant chaque baie (seuils sans ressaut : l'eau de la
   terrasse ne doit pas atteindre les menuiseries), dallage ailleurs. bays = [[z0, z1], …] des baies. */
function facadeStrip(b, M, dal, xa, xb, z0, z1, bays) {
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb); let z = z0;
  for (const [a0, a1] of bays) {
    const c0 = Math.max(z, a0 - 0.1), c1 = Math.min(z1, a1 + 0.1);
    if (c0 > z) b.box(dal, x0, -0.07, z, x1, -0.015, c0);
    b.box(M.frame, x0, -0.07, c0, x1, -0.045, c1);                                   // fond du caniveau, dans l'ombre des barreaux
    for (let k = c0 + 0.02; k < c1 - 0.02; k += 0.04) b.box(M.frame, x0 + 0.012, -0.045, k, x1 - 0.012, -0.017, k + 0.012);
    b.box(M.frame, x0, -0.045, c0, x0 + 0.012, -0.016, c1); b.box(M.frame, x1 - 0.012, -0.045, c0, x1, -0.016, c1);
    z = c1;
  }
  if (z1 > z) b.box(dal, x0, -0.07, z, x1, -0.015, z1);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
   1. APPARTEMENT-VILLA — plan « Logement 08, niveau 1 », indice C du 29/04/2024 : T4, 3 chambres, 2 salles de bains,
      137,9 m², jardin 82,1 m².
   x : de la face intérieure de la façade Ouest sur le jardin (0) à celle de la façade Est (16,68) ;
   y : de la face intérieure de la façade Nord (0) à celle du mur Sud (8,67). Nord en haut, la Sainte-Victoire à droite.
   Cotes imprimées reportées telles quelles : 326 / 8 / 312 / 8 / 180 / 10 / 824 au Nord ; 29 / 297 / 10 / 139 / 111 / 147 / 58 / 150 / 8
   le long du couloir ; 326 / 10 / 240 / 10 / 287 / 8 / 736 / 51 au Sud ; 342 / 8 / 181 / 10 / 326 à l'Ouest ; couloir de 96,
   placards de 60, dressing de 288, salle de bains 2 de 174, WC de 90. Le reste est mesuré sur le plan.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const VW = 16.68, VD = 8.67, T = 0.08, CN = 4.15, CS = 5.11;      // CN, CS : rives Nord et Sud du couloir (96 cm)
const villa = {
  id: 'villa', bien: '138', north: 0, groundY: -8.7, hour: 9.5, site: { key: 'villa', o: [0.35, 2.9, 0.35] },
  name: { fr: 'Appartement-villa', en: 'Villa-style apartment' },
  facts: { fr: '4 pièces · 138 m² · jardin de 82 m²', en: '4 rooms · 138 m² · 82 m² garden' },
  pitch: { fr: 'Au premier et dernier étage : un séjour de 46 m² tourné vers la Sainte-Victoire, deux chambres et un bureau de plain-pied avec le jardin, une suite avec dressing et salle de bains.', en: 'On the first and top floor: a 46 m² living room facing the Sainte-Victoire, two bedrooms and a study level with the garden, a suite with dressing room and bathroom.' },
  levels: [{
    id: 'n1', name: { fr: 'Niveau 1', en: 'Level 1' }, y: 0, h: 2.6,
    bounds: [-11.6, -1.3, 18.0, 9.6], walkable: [[-8.6, -0.25, VW, VD + 0.25]],
    floors: [['floor', 0, 0, VW, VD], ['tile', 6.54, 0, 8.34, 2.19], ['tile', 6.54, 2.29, 8.34, CN - T], ['tile', 5.86, 5.99, 7.33, VD], ['tile', 7.33, 6.13, 8.73, VD],
      ['tile', 7.91, CS + 0.04, 9.41, 6.05], ['tile', 8.81, 6.05, 9.41, 6.59]],
    slabs: [[-E, -E, VW + E, VD + E, 0.3]],
    ceilings: [[0, 0, VW, VD]],
    walls: [
      // façades : trois portes-fenêtres sur le jardin (Ouest) ; au Nord, chambre 3, buanderie, cuisine et baie du séjour sur le balcon ;
      // à l'Est, baie coulissante de 3,97 m et porte-fenêtre du séjour ; porte palière au Sud
      wv(-E / 2, 0, VD, E, -1, [op(1.08, 2.34, 'french', { rail: false, head: 2.3 }), op(3.68, 4.97, 'french', { rail: false, head: 2.3 }), op(6.32, 7.6, 'french', { rail: false, head: 2.3 })]),
      wh(-E / 2, -E, VW + E, E, -1, [op(4.68, 5.92, 'french', { rail: false, head: 2.3 }), op(7.25, 7.79, 'french', { rail: false, head: 2.3 }), op(9.16, 10.43, 'french', { rail: false, head: 2.3 }),
        op(13.29, 15.7, 'bay', { panels: 2, head: 2.35 })]),
      wv(VW + E / 2, 0, VD, E, 1, [op(0.67, 4.64, 'bay', { panels: 3, open: true, head: 2.35 }), op(5.99, 7.25, 'french', { rail: false, head: 2.3 })]),
      wh(VD + E / 2, -E, VW + E, E, 1, [op(9.57, 10.46, 'entry', { head: 2.15 })]),
      // chambre 2 (porte sur le bureau), chambre 3, buanderie et salle de bains 2, cuisine
      wv(3.3, 0, CN - T, T), wv(6.5, 0, CN - T, T), wv(8.39, 0, 3.33, 0.1, 0, [op(0.05, 0.86, 'door', { hinge: 'a0', swing: -1, open: 90 })]),
      wh(3.46, 0, 3.26, T, 0, [op(0.04, 0.82, 'door', { hinge: 'a0', swing: -1, open: 90 })]), wh(2.24, 6.54, 8.34, 0.1),
      // rive Nord du couloir : portes de la chambre 3 et de la salle de bains 2, niche du tableau électrique
      wh(CN - T / 2, 3.26, 8.33, T, 0, [op(3.41, 4.22, 'door', { hinge: 'a0', swing: -1, open: 90 }), op(6.6, 7.35, 'door', { hinge: 'a0', swing: -1, open: 90 })]),
      wh(3.83, 8.81, 9.49, T), wv(9.45, 3.79, CN, T),
      // bureau et chambre 1
      wh(5.36, 0.29, 3.26, 0.1),
      // suite : cloisons de la chambre 1, du dressing et de la salle de bains 1, portes coulissantes
      wv(3.31, CS, VD, 0.1, 0, [op(7.03, 7.9, 'slide', { to: 'a0', side: 1 })]), wv(5.81, CS, VD, 0.1, 0, [op(7.05, 7.88, 'slide', { to: 'a0', side: -1 })]),
      // rive Sud du couloir : placards de 60 de part et d'autre de la porte du dressing
      wh(5.75, 3.36, 4.75, T), wh(5.85, 5.86, 7.33, 0.28), wv(4.79, CS, 5.79, T), wh(CS + 0.04, 4.83, 5.76, T, 0, [op(4.87, 5.65, 'door', { hinge: 'a1', swing: 1, open: 90 })]),
      // WC : porte coulissante sur le couloir, lave-mains en alcôve ; placard de l'entrée dessous
      wh(CS + 0.04, 7.91, 9.41, T, 0, [op(8.54, 9.38, 'slide', { to: 'a0', side: -1 })]), wv(9.45, CS, 6.67, T), wh(6.09, 7.91, 8.81, T), wh(6.63, 8.73, 9.49, T), wv(8.77, 6.13, VD, T),
    ],
    rails: [[VW + E + 0.47, -E - 0.47, VW + E + 0.47, 7.33], [VW + E, 7.33, VW + E + 0.47, 7.33], [4.57, -E - 0.47, VW + E + 0.47, -E - 0.47], [4.57, -E, 4.57, -E - 0.47]],
    items: [
      // 1 — entrée : placard à portes pliantes, meuble bas en limite du séjour
      ['wardrobe', 9.135, 7.67, 90, { w: 2.0, d: 0.65, mat: 'lacquer' }], ['sideboard', 11.1, 7.795, 270, { w: 1.65, d: 0.34, h: 0.85, mat: 'walnut' }],
      // 2 — séjour : table de huit au Nord, canapé face au meuble TV du mur Sud, fauteuil, table basse
      ['diningTable', 14.3, 2.27, 0, { w: 2.35, d: 1.13, n: 3, ends: true }], ['pendant', 14.3, 2.27, 0, { kind: 'rail', n: 5, span: 0.42, drop: 1.0 }],
      ['rug', 14.13, 6.89, 0, { w: 3.27, d: 2.46 }], ['sofa', 14.0, 5.44, 0, { w: 2.21, d: 1.02 }], ['armchair', 12.32, 7.14, 90, { mat: 'walnut' }],
      ['coffeeRect', 14.12, 7.1, 0, { w: 1.15, d: 0.69, oval: false }], ['dresser', 14.13, 8.44, 180, { w: 1.7, d: 0.46, h: 0.5, mat: 'walnut' }], ['duct', 16.425, 8.48, 0, { w: 0.51, d: 0.38 }],
      ['curtain', VW - 0.1, 0.38, 270, { w: 0.5 }], ['curtain', VW - 0.1, 4.95, 270, { w: 0.5 }],
      // 3 — cuisine : évier double et réfrigérateur côté buanderie, îlot avec plaque et trois tabourets côté séjour
      ['kitchenRun', 8.755, 1.755, 90, { w: 1.67, d: 0.63, sink: 0, upper: true, splash: true, deco: false }], ['fridge', 8.79, 2.945, 90, { w: 0.7, d: 0.7 }],
      ['island', 11.19, 2.535, 90, { w: 2.63, d: 1.08, over: 0.46, hob: 0, stools: 3 }], ['pendant', 11.0, 2.535, 90, { kind: 'cone', n: 3, span: 0.75, drop: 0.85 }],
      ['duct', 8.57, 3.7, 0, { w: 0.48, d: 0.74 }], ['wardrobe', 9.13, 4.01, 0, { w: 0.6, d: 0.26, h: 2.1, mat: 'lacquer' }], ['duct', 10.96, 3.955, 0, { w: 0.62, d: 0.33 }],
      // 4 — buanderie : lave-linge et sèche-linge au Sud, chauffe-eau dans l'angle
      ['washer', 7.215, 1.87, 180, { n: 2 }], ['boiler', 8.06, 1.88, 0, {}],
      // 13 — salle de bains 2 : douche dans l'angle Nord-Est, vasque à l'Est
      ['shower', 7.94, 2.69, 0, { w: 0.8, d: 0.78, glass: ['left'] }], ['vanity', 8.115, 3.68, 270, { w: 0.55, d: 0.45, double: false, mirrorH: 0.7 }],
      // 11 — chambre 2 : lit d'une personne le long du mur Nord, penderie au Sud
      ['bed', 2.13, 0.5, 270, { w: 0.9, l: 2.0, nights: false, hw: 0.06, throwMat: 'sage' }], ['sideTable', 2.98, 1.2, 0, { r: 0.2, h: 0.5, mat: 'oak' }], ['wardrobe', 2.285, 3.115, 180, { w: 1.89, d: 0.61 }],
      // 12 — chambre 3 : lit d'une personne tête à l'Est, penderie au Sud
      ['bed', 5.4, 1.45, 270, { w: 0.9, l: 2.0, nights: false, hw: 0.06, throwMat: 'ochre' }], ['sideTable', 6.28, 2.15, 0, { r: 0.16, h: 0.5, mat: 'oak' }], ['wardrobe', 5.41, 3.765, 180, { w: 2.0, d: 0.61 }],
      // 6 — bureau : plan de travail de 2,05 m contre la chambre 2, deux assises ; gaine dans l'angle
      ['desk', 2.255, 3.795, 0, { w: 2.05, d: 0.55, top: 'oak', chair: 'greige' }], ['stool', 1.55, 4.3, 0, { mat: 'greige', h: 0.46 }], ['duct', 0.145, 5.395, 0, { w: 0.29, d: 0.65 }],
      // 5 — couloir : deux placards
      ['wardrobe', 4.055, CS + 0.3, 180, { w: 1.39, d: 0.6, mat: 'lacquer', open: false }], ['wardrobe', 6.595, CS + 0.3, 180, { w: 1.47, d: 0.6, mat: 'lacquer', open: false }], ['duct', 7.62, 5.62, 0, { w: 0.58, d: 1.02 }],
      // 7 — chambre 1 : lit de 140 tête au Nord
      ['bed', 1.62, 6.5, 0, { w: 1.4, l: 2.0, hw: 0.4 }],
      // 8 — dressing : coiffeuse au Nord, penderie de 2,40 m au Sud
      ['vanityTable', 4.09, 6.03, 0, { w: 1.45, d: 0.48 }], ['wardrobe', 4.56, 8.385, 180, { w: 2.4, d: 0.57 }],
      // 9 — salle de bains 1 : WC et sèche-serviettes au Nord, douche sous le WC du couloir, baignoire à l'Est, double vasque au Sud
      ['toilet', 6.27, 6.32, 0, {}], ['towelRail', 6.93, 6.0, 0, {}], ['shower', 8.17, 6.54, 0, { w: 1.12, d: 0.78, glass: ['front'] }],
      ['bathtub', 8.36, 7.85, 0, { w: 0.72, l: 1.62 }], ['vanity', 6.63, 8.425, 180, { w: 1.57, d: 0.49, double: true }],
      // 10 — WC : cuvette contre la gaine, lave-mains en alcôve
      ['toilet', 8.24, 5.6, 90, {}], ['basin', 9.11, 6.44, 180, { w: 0.42 }],
      // objets de vie (ajouts d'ameublement, hors plan) : rien au sol dans les passages ni devant les portes et les baies
      // entrée : console et miroir sur la cloison du WC, patères au bout, parapluies à côté de la porte palière
      ['console', 9.49, 5.72, 90, { w: 0.9, d: 0.3 }], ['hooks', 9.49, 6.42, 90, { w: 0.42, y: 1.75, coats: ['taupe', 'cream'] }],
      ['shoes', 9.49, 6.42, 90, { set: [[-0.1, 0.17, 0.15, 'taupe'], [0.13, 0.16, -0.1, 'cream']] }], ['umbrella', 10.68, 8.5, 0, {}],
      // séjour : grande toile et lampadaire au-dessus du fauteuil, corbeille à plaids, plantes dans les angles, enceinte sur le meuble TV
      ['frames', 12.35, VD, 180, { set: [[0, 1.5, 0.9, 1.1, 'art2', 'oak']] }], ['floorLamp', 11.65, 8.25, 0, {}], ['basket', 12.95, 7.95, 0, {}],
      ['fig', 16.33, 5.6, 0, { h: 1.7 }], ['fig', 15.7, 8.33, 0, { h: 1.35, seed: 4, dark: true }], ['fig', 12.25, 0.35, 0, { h: 1.8, pot: 0.24, seed: 21 }],
      ['objs', 14.13, 8.44, 180, { y: 0.5, set: [['speaker', 0.74, 0.02, 0]] }],
      // cuisine : machine à expresso côté réfrigérateur, huile et vinaigre près de l'évier, sansevière près de la porte-fenêtre
      ['objs', 8.755, 1.755, 90, { y: 0.91, set: [['coffee', -0.6, -0.12, 0], ['bottles', 0.72, -0.2, 0]] }], ['plant', 10.85, 0.32, 0, { kind: 'snake', h: 0.9, pot: 0.18 }],
      // buanderie : étagère à linge au-dessus des machines, planche à repasser, panier
      ['wallShelf', 7.2, 2.19, 180, { w: 1.1, d: 0.25, ys: [1.55], kind: 'laundry' }], ['ironing', 6.54, 0.75, 90, {}], ['hamper', 6.85, 1.25, 0, {}],
      // salle de bains 2
      ['bathMat', 7.7, 3.3, 0, { w: 0.6, d: 0.4 }], ['hamper', 6.8, 2.6, 0, { r: 0.17, h: 0.5 }], ['frames', 6.54, 2.8, 90, { set: [[0, 1.5, 0.35, 0.45, 'art4', 'oak']] }],
      // couloir : trois cadres entre les portes
      ['frames', 5.4, CN, 0, { set: [[-0.65, 1.5, 0.45, 0.6, 'art4', 'black'], [0, 1.5, 0.45, 0.6, 'art2', 'black'], [0.65, 1.5, 0.45, 0.6, 'art4', 'black']] }],
      // bureau : étagères au-dessus du plan de travail, tableau d'affichage et cadre en face
      ['wallShelf', 2.35, 3.5, 0, { w: 1.5, ys: [1.45, 1.8], seed: 2 }], ['pinboard', 2.0, 5.31, 180, {}], ['frames', 0.9, 5.31, 180, { set: [[0, 1.5, 0.45, 0.6, 'art4', 'oak']] }],
      // chambre 2
      ['frames', 3.26, 0.5, 270, { set: [[0, 1.55, 0.7, 0.5, 'art4', 'oak']] }], ['frames', 1.6, 0, 0, { set: [[-0.25, 1.45, 0.3, 0.4, 'art2', 'black'], [0.2, 1.5, 0.4, 0.5, 'art4', 'black']] }],
      ['basket', 0.35, 0.4, 0, { fill: 'linen' }], ['floorMirror', 3.26, 2.25, 270, {}], ['objs', 2.98, 1.2, 0, { y: 0.5, set: [['vase', 0.05, -0.04, 0], ['candle', -0.09, 0.07, 0]] }],
      ['objs', 1.45, 0.5, 0, { y: 0.645, set: [['sweater', 0, 0, 0.3]] }],
      // chambre 3
      ['frames', 6.46, 1.45, 270, { set: [[0, 1.55, 0.8, 0.55, 'art2', 'black']] }], ['fig', 3.62, 0.36, 0, { h: 1.4, seed: 5 }], ['floorMirror', 3.34, 2.2, 90, { frame: 'oak' }],
      ['objs', 6.28, 2.15, 0, { y: 0.5, set: [['candle', 0, 0, 0]] }], ['objs', 4.68, 1.45, 0, { y: 0.645, set: [['plaid', 0, 0, 1.4]] }],
      // chambre 1
      ['frames', 1.62, 5.41, 0, { set: [[0, 1.6, 1.0, 0.6, 'art4', 'oak']] }], ['fig', 0.35, 8.3, 0, { h: 1.6, seed: 7 }],
      ['objs', 1.85, 7.25, 0, { y: 0.645, set: [['sweater', 0, 0, 0.2]] }],
      // dressing : miroir sur pied
      ['floorMirror', 5.76, 6.55, 270, { w: 0.6, h: 1.8 }],
      // salle de bains 1 : tapis le long de la baignoire, tabouret, panier à linge
      ['bathMat', 7.72, 7.85, 90, { w: 0.8, d: 0.45 }], ['bathStool', 7.7, 8.45, 0, {}], ['hamper', 7.35, 6.27, 0, { r: 0.17, h: 0.5 }],
      // WC
      ['frames', 8.35, 6.05, 180, { set: [[0, 1.5, 0.3, 0.4, 'art2', 'oak']] }],
    ],
    rooms: [
      { id: 'entree', fr: 'Entrée', en: 'Entrance', m2: 9.5, rs: [[9.49, CN, 11.27, VD]], at: [10.4, 6.2], cam: { p: [10.05, 7.9], t: [12.6, 3.6] } },
      { id: 'sejour', fr: 'Séjour', en: 'Living room', m2: 46.1, rs: [[11.27, 0, VW, VD]], at: [14.0, 4.2], cam: { p: [11.9, 4.45], t: [16.6, 2.6] } },
      { id: 'cuisine', fr: 'Cuisine', en: 'Kitchen', m2: 11.2, rs: [[8.44, 0, 11.27, CN - T]], at: [9.85, 2.4], cam: { p: [9.85, 3.45], t: [9.9, 0.2] } },
      { id: 'buanderie', fr: 'Buanderie', en: 'Laundry', m2: 3.9, rs: [[6.54, 0, 8.34, 2.19]], at: [7.4, 0.9], cam: { p: [7.9, 0.55], t: [7.0, 2.0], pitch: -0.3 }, minor: true },
      { id: 'couloir', fr: 'Couloir', en: 'Hallway', m2: 7.6, rs: [[3.36, CN, 9.49, CS]], at: [6.9, 4.63], cam: { p: [9.2, 4.63], t: [3.4, 4.63] }, minor: true },
      { id: 'bureau', fr: 'Bureau', en: 'Study', m2: 5.8, rs: [[0, 3.5, 3.26, 5.31], [3.26, CN, 3.36, CS]], at: [1.3, 4.75], cam: { p: [3.0, 4.75], t: [0.2, 4.2] } },
      { id: 'ch1', fr: 'Chambre 1', en: 'Bedroom 1', m2: 10.3, rs: [[0, 5.41, 3.26, VD]], at: [1.6, 7.9], cam: { p: [2.85, 8.2], t: [0.7, 6.0] } },
      { id: 'dressing', fr: 'Dressing', en: 'Dressing room', m2: 7.5, rs: [[3.36, 5.79, 5.76, VD], [4.83, CS + 0.08, 5.76, 5.79]], at: [4.6, 7.2], cam: { p: [5.3, 6.35], t: [3.8, 8.5] } },
      { id: 'sdb1', fr: 'Salle de bains 1', en: 'Bathroom 1', m2: 7.7, rs: [[5.86, 5.99, 7.33, VD], [7.33, 6.13, 8.73, VD]], at: [6.9, 7.3], cam: { p: [6.25, 7.45], t: [8.5, 7.7], pitch: -0.25 } },
      { id: 'wc', fr: 'WC', en: 'WC', m2: 1.6, rs: [[7.91, CS + 0.08, 9.41, 6.05], [8.81, 6.05, 9.41, 6.59]], at: [8.9, 5.6], cam: { p: [9.05, 5.6], t: [8.0, 5.6], pitch: -0.3 }, minor: true },
      { id: 'ch2', fr: 'Chambre 2', en: 'Bedroom 2', m2: 11.1, rs: [[0, 0, 3.26, 3.42]], at: [1.5, 2.0], cam: { p: [0.6, 2.85], t: [2.7, 0.5] } },
      { id: 'ch3', fr: 'Chambre 3', en: 'Bedroom 3', m2: 12.5, rs: [[3.34, 0, 6.46, CN - T]], at: [4.9, 2.7], cam: { p: [3.85, 3.2], t: [6.0, 1.0] } },
      { id: 'sdb2', fr: 'Salle de bains 2', en: 'Bathroom 2', m2: 3.1, rs: [[6.54, 2.29, 8.34, CN - T]], at: [7.3, 3.3], cam: { p: [6.9, 3.7], t: [8.1, 2.6], pitch: -0.22 }, minor: true },
      { id: 'jardin', fr: 'Jardin', en: 'Garden', m2: 82.1, rs: [[-10.9, -E, -E, VD + E]], at: [-3.4, 4.3], cam: { p: [-4.6, 5.9], t: [0.5, 4.2] } },
    ],
    tour: ['entree', 'sejour', 'cuisine', 'ch3', 'bureau', 'ch2', 'jardin', 'ch1', 'dressing', 'sdb1'],
  }],
  start: { room: 'sejour' },
  orbit: { target: [4.6, 0, 4.3], dist: 35 },
  /* Jardin n° 8 (plan de masse indice E et plan du niveau 2) : mobilier hors plan, à l'échelle, tourné vers la maison.
     Table de quatre sur la terrasse entre chambre 2 et bureau, bains de soleil et parasol sur la pelouse au Sud, à l'ombre de l'olivier ;
     bornes basses le long de la terrasse, robinet de puisage et unité extérieure de la PAC en façade (façade Ouest, à la limite 8/7). */
  garden: [['parasol', -6.3, 7.75, 0, { r: 1.5 }], ['lounger', -5.85, 6.1, 160, {}], ['lounger', -6.75, 6.35, 160, {}],
    ['outdoorTable', -2.5, 3.0, 90, { w: 1.8, d: 0.9, n: 2 }], ['plant', -0.75, 5.65, 0, { kind: 'olive', h: 1.5, pot: 0.26 }],
    ['lantern', -0.6, 2.75, 0, { h: 0.55 }], ['lantern', -0.62, 3.2, 0, { h: 0.4 }], ['wateringCan', -4.45, 0.75, 30, {}], ['bbq', -3.6, 7.75, 0, {}],
    ['acUnit', -0.56, 7.98, 270, { w: 0.7 }], ['gardenTap', -E, 0.55, 270, {}],
    ['gardenLight', -4.3, 1.15, 0, {}], ['gardenLight', -4.3, 4.6, 0, {}], ['gardenLight', -4.3, 7.95, 0, {}]],
  /* Relevé (plan du niveau 2 redressé à l'échelle, repère du site = repère du logement + 0,35 m en x et en z) :
     - limite Nord : muret de soutènement en pierre sèche calcaire au droit de la façade Nord (8,7 m de long), surmonté d'une grille
       métallique à barreaudage de 1,05 m, piliers enduits à 3,6 et 8,5 m de la façade (façade Nord : grille sur mur de pierre) ;
     - limite Ouest : muret en biais, nu intérieur à 8,8 m de la façade au Nord et 10,75 m au Sud (cote 7,6 de la limite de propriété) ;
     - limite Sud avec le jardin n° 7 : clôture doublée d'une haie vive, dans l'axe du mur mitoyen (façade Ouest : jardin de 9,0 m) ;
     - terrasse dallée de 3,7 × 7,4 m devant les trois portes-fenêtres, pelouse au-delà ;
     - amandier et olivier « à planter », deux massifs fleuris à l'angle Nord-Ouest (plan de masse). */
  exterior(b, M, lv) {
    const dal = M.travertine || M.terrace, mur = M.drystone || M.stone, grav = M.gravel || M.paving, paillis = M.mulch || M.earth, shrub = V.shrub || V.oleander;
    const wX = (z) => -8.83 - 0.217 * z;                         // nu intérieur du muret Ouest
    const OW = -E, zN = 0, zF = VD + E / 2, zH = zF - 0.5, TX = -4.05, TZ0 = 0.78, TZ1 = 8.18, BED = 0.9;
    b.on('ext');
    b.prism(M.socle, [[wX(-E), -E], [OW, -E], [OW, zF], [wX(zF), zF]], -0.32, -0.1);
    // terrasse : dallage hexagonal (plan du logement 08), bande de graviers côté pelouse (« Pelouse / Graviers » du plan du niveau 2),
    // caniveau à grille continu au pied de la façade (seuils des portes-fenêtres à 1,5 cm), bordures acier
    b.box(M.hexPaving, TX + 0.4, -0.07, TZ0, -0.5, -0.015, TZ1); b.box(grav, TX, -0.08, TZ0, TX + 0.4, -0.03, TZ1);
    facadeStrip(b, M, M.hexPaving, -0.5, OW, TZ0, TZ1, [[TZ0 + 0.1, TZ1 - 0.1]]);
    edge(b, M, TX - 0.006, TZ0 - 0.006, TX, TZ1 + 0.006); edge(b, M, TX + 0.4, TZ0, TX + 0.406, TZ1);
    edge(b, M, TX, TZ0 - 0.006, -0.65, TZ0); edge(b, M, TX, TZ1, -0.65, TZ1 + 0.006);
    // bande de gravier au pied de la façade hors terrasse (rejaillissement), pelouse, massifs paillés le long des murets
    b.box(grav, -0.65, -0.08, zN, OW, -0.03, TZ0); b.box(grav, -0.65, -0.08, TZ1, OW, -0.03, zH);
    b.prism(M.grass, [[wX(0.5) + BED, 0.5], [TX, 0.5], [TX, zH], [wX(zH) + BED, zH]], -0.1, -0.02);
    b.box(M.grass, TX, -0.1, zN, -0.65, -0.02, TZ0); b.box(M.grass, TX, -0.1, TZ1, -0.65, -0.02, zH);
    b.prism(paillis, [[wX(zN), zN], [wX(zN) + BED, zN], [wX(zH) + BED, zH], [wX(zH), zH]], -0.1, -0.035);
    b.prism(paillis, [[wX(zN) + BED, zN], [TX, zN], [TX, 0.5], [wX(0.5) + BED, 0.5]], -0.1, -0.035);
    b.prism(paillis, [[wX(zH), zH], [OW, zH], [OW, zF], [wX(zF), zF]], -0.1, -0.035);
    seg(b, M.frame, wX(0.5) + BED, 0.5, wX(zH) + BED, zH, 0.006, -0.08, -0.012); edge(b, M, wX(0.5) + BED, 0.5 - 0.006, TX, 0.5);
    // limite Nord : muret de soutènement (le pied est au niveau du jardin n° 1, 2,9 m plus bas), couvertine, grille et piliers
    b.box(mur, wX(-E), -0.32, -E, OW, 0, zN); b.box(dal, wX(-E) - 0.02, 0, -E - 0.03, OW, 0.05, zN + 0.03);
    railing(b, M, wX(-E / 2) + 0.3, -E / 2, OW, -E / 2, 0.05, 1.05);
    for (const x of [wX(-E / 2) + 0.15, -3.95]) { b.box(M.stucco, x - 0.15, 0.05, -E / 2 - 0.15, x + 0.15, 1.2, -E / 2 + 0.15); b.box(dal, x - 0.18, 1.2, -E / 2 - 0.18, x + 0.18, 1.24, -E / 2 + 0.18); }   // chapeaux de piliers
    lv.blocks.push([wX(-E), -E - 0.03, OW, zN + 0.03]);
    // limite Ouest : muret bas en pierre sèche (le terrain voisin est plus haut), couvertine
    seg(b, mur, wX(-E), -E, wX(zF), zF, -0.3, -0.32, 0.4); seg(b, dal, wX(-E) + 0.02, -E, wX(zF) + 0.02, zF, -0.34, 0.4, 0.45);
    // limite Sud : grillage souple gris de 1,50 m dans l'axe du mur mitoyen, doublé d'une haie vive (la haie côté n° 7 est dessinée avec le site)
    lv.blocks.push(V.hedge(b, M, wX(zH) + 0.25, zH, OW - 0.03, zF - 0.06, { h: 1.5, y: -0.035 }));
    { const x0 = wX(zF) + 0.05, n = Math.ceil((OW - x0) / 2.5);
      for (let i = 0; i <= n; i++) { const x = x0 + ((OW - 0.05 - x0) / n) * i; b.box(M.frame, x - 0.02, -0.035, zF - 0.02, x + 0.02, 1.5, zF + 0.02); }
      for (const y of [0.1, 0.8, 1.48]) b.rod(M.frame, [x0, y, zF], [OW - 0.05, y, zF], 0.003, 4); }
    b.on('ctx'); b.box(mur, wX(-E), -2.9, -E, OW, -0.32, zN); b.on('ext');
    // plantations « à planter » du plan de masse : amandier au Nord, olivier au milieu de la limite Ouest, massifs fleuris à l'angle
    lv.blocks.push(V.tree(b, M, -6.45, 1.95, { kind: 'almond', h: 4.6, r: 1.9, seed: 12 }));
    lv.blocks.push(V.tree(b, M, -8.35, 5.65, { kind: 'olive', h: 4.4, r: 1.8, seed: 4 }));
    lv.blocks.push(V.oleander(b, M, -8.15, 0.5, { r: 0.65, seed: 3 })); lv.blocks.push(V.oleander(b, M, -7.85, 2.45, { r: 0.6, seed: 9 }));
    for (const [z, kind, r, s] of [[3.5, 'rosemary', 0.45, 2], [4.4, 'pittosporum', 0.55, 5], [7.1, 'rosemary', 0.45, 7], [7.85, 'pittosporum', 0.5, 8]]) lv.blocks.push(shrub(b, M, wX(z) + 0.45, z, { kind, r, h: kind === 'rosemary' ? 0.8 : 1.4, seed: s }));
    V.lavender(b, M, -7.5, 0.25, -4.45, 0.25, { seed: 2 });
    if (V.groundcover) for (let z = zN; z < zH - 0.3; z += 1) { const z1 = Math.min(zH, z + 1); V.groundcover(b, M, wX(z) + 0.05, z, wX(z1) + BED - 0.05, z1, { y: -0.035, seed: 6 + z }); }
    if (V.climber) V.climber(b, M, -3.75, 0.05, -E / 2 + 0.03, -0.55, 1.05, -E / 2 + 0.03, { seed: 3, density: 0.5 });
    // balcon filant : façade Est côté Sainte-Victoire, retour le long de la façade Nord jusqu'à la chambre 3
    const bx = VW + E, bz = -E;
    b.box(dal, bx, -0.04, bz - 0.5, bx + 0.5, 0, 7.33); b.box(M.stucco, bx, -0.3, bz - 0.5, bx + 0.5, -0.04, 7.33);
    b.box(dal, 4.57, -0.04, bz - 0.5, bx, 0, bz); b.box(M.stucco, 4.57, -0.3, bz - 0.5, bx, -0.04, bz);
    // le reste de l'immeuble et ses abords (site.js)
    buildSite(b, M, { o: villa.site.o, skip: ['villa'] });
    b.on('ext:top');
    b.box(M.stucco, -E, 2.66, -E, VW + E, 2.92, VD + E);        // au-dessus du plafond, jamais dans le même plan que lui
  },
  trees: [],
};

/* ════════════════════════════════════════════════════════════════════════════════════════════
   2. DUPLEX — plan « Logement 02 - V4 » : T4, 3 chambres, 2 salles de bains, accès direct au parking, ascenseur privatif
   x : de la face intérieure du mur Ouest (0) à celle de la façade Est sur jardin (11,64) ;
   y : de la face intérieure du mur Nord (0) à celle du mur Sud (12,03) : 589 + mur de 20 + 594.
   L'étage ne couvre que x >= 4,00 (772 de large). Cotes imprimées reportées telles quelles (1164, 589, 529 + 65, 223 × 292,
   229 / 127 / 178 / 190 / 441, 231, 140, 386, 69 + 161, 495 ; étage : 220 / 88 / 443, 291 / 290, 133 / 174 / 443, 227, 100, 259,
   133 / 182 / 8 / 90 / 353, 60 / 474 / 60) ; le reste est mesuré sur le plan.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const DW = 11.64, NH = 5.89, PW = 0.2, SH = NH + PW, DD = 12.03, UX = 4.0, FH = 2.9, P = 0.1;
/* Escalier balancé (emprise 223 × 292) : départ au Sud le long de la volée Est, quartier tournant au Nord, retour le long
   de la volée Ouest, second quartier tournant et arrivée vers l'Est sur le palier. 17 marches, 18 hauteurs. */
const SX = 4.01, SZ = 2.98, sp = (...p) => p.map(([x, z]) => [SX + x / 100, SZ + z / 100]);
const stair = {
  H: FH,
  steps: [
    sp([132, 138], [223, 138], [223, 168], [132, 168]), sp([132, 108], [223, 108], [223, 138], [132, 138]), sp([132, 95], [223, 60], [223, 108], [132, 108]),
    sp([132, 90], [124, 90], [211, 0], [223, 0], [223, 60], [132, 95]), sp([116, 90], [146, 0], [211, 0], [124, 90]), sp([108, 90], [93.5, 0], [146, 0], [116, 90]),
    sp([99.5, 90], [36, 0], [93.5, 0], [108, 90]), sp([90, 90], [0, 42], [0, 0], [36, 0], [99.5, 90]), sp([0, 42], [90, 90], [90, 97], [0, 97]),
    sp([0, 97], [90, 97], [90, 128], [0, 128]), sp([0, 128], [90, 128], [90, 157], [0, 157]), sp([0, 157], [90, 157], [90, 187], [0, 187]),
    sp([0, 187], [90, 187], [90, 197], [0, 246]), sp([0, 246], [90, 197], [90, 199], [40, 290], [0, 290]), sp([90, 199], [96, 199], [96, 290], [40, 290]),
    sp([96, 199], [125, 199], [125, 290], [96, 290]), sp([125, 199], [157, 199], [157, 290], [125, 290]),
  ],
  line: sp([177, 153], [177, 123], [177, 92], [182, 45], [150, 42], [115, 40], [82, 42], [45, 45], [45, 82], [45, 112], [45, 142], [45, 172], [45, 205], [42, 248], [72, 250], [110, 245], [141, 245]),
  core: [SX + 0.9, SZ + 0.9, SX + 1.32, SZ + 1.99],
  foot: [5.79, 5.4], trig0: [5.79, 4.66], trig1: [5.61, 5.43], head: [6.45, 5.43], m0: [5.42, 4.2, 6.2, 4.62], m1: [5.2, 5.05, 5.6, 5.85],
};
/* Ascenseur : gaine de 190 × 200 hors tout au centre de la moitié Sud, porte au Nord. */
const SHAFT = [5.34, 7.46, 7.24, 9.46], LIFT = { x0: 5.64, y0: 7.76, x1: 6.95, y1: 9.14 };
const shaftWalls = () => [
  wv(SHAFT[0] + 0.1, SHAFT[1], SHAFT[3], 0.2, 0, [], { h: FH, noSkirt: true }), wv(SHAFT[2] - 0.1, SHAFT[1], SHAFT[3], 0.2, 0, [], { h: FH, noSkirt: true }),
  wh(SHAFT[3] - 0.1, SHAFT[0] + 0.2, SHAFT[2] - 0.2, 0.2, 0, [], { h: FH, noSkirt: true }),
  wh(SHAFT[1] + 0.1, SHAFT[0] + 0.2, SHAFT[2] - 0.2, 0.2, 0, [op(5.84, 6.74, 'liftdoor', { head: 2.1 })], { h: FH, noSkirt: true }),
];
const duplex = {
  id: 'duplex', bien: 'duplex-206', north: 0, groundY: -5.8, hour: 9.25, site: { key: 'duplex', o: [5.41, 0, 13.5] },
  name: { fr: 'Duplex', en: 'Duplex' },
  facts: { fr: '4 pièces · 206 m² · terrasse et jardin d\'environ 56 m²', en: '4 rooms · 206 m² · terrace and garden of about 56 m²' },
  pitch: { fr: 'Près de 100 m² de séjours et de cuisine ouverts sur le jardin, trois chambres à l\'étage, un ascenseur privatif et l\'accès direct au parking.', en: 'Nearly 100 m² of living space and kitchen opening onto the garden, three bedrooms upstairs, a private lift and direct access to the car park.' },
  stair,
  lift: { ...LIFT, door: [6.29, 7.56], exits: [[6.29, 6.8], [6.29, 6.8]] },
  levels: [{
    id: 'rdc', name: { fr: 'Niveau 1', en: 'Level 1' }, y: 0, h: 2.6,
    bounds: [-0.5, -0.6, 17.4, DD + 0.6], walkable: [[-0.09, 0, 16.6, DD]],
    floors: [['floor', -0.09, 0, DW, DD], ['tile', -0.09, 8.2, 2.22, DD], ['tile', 3.65, 7.56, 4.95, 9.36]],
    slabs: [[-E, -E, DW + E, DD + E, 0.3]],
    ceilings: [[0, 0, DW, SZ], [0, SZ, SX, NH], [6.25, SZ, DW, NH], [0, NH, DW, SHAFT[1]], [-0.09, SHAFT[1], SHAFT[0], DD], [SHAFT[2], SHAFT[1], DW, DD], [SHAFT[0], SHAFT[3], SHAFT[2], DD]],
    walls: [
      // murs extérieurs : porte palière à l'Ouest (accès direct au parking), deux baies coulissantes de 3,92 m à l'Est ; pas de doublage dans la buanderie
      wv(-E / 2, 0, 8.2, E, -1, [op(6.42, 7.39, 'entry', { head: 2.15 })]), wv(-0.09 - (E - 0.09) / 2, 8.2, DD, E - 0.09, -1),
      wh(-E / 2, -E, DW + E, E, -1), wh(DD + E / 2, -E, DW + E, E, 1),
      wv(DW + E / 2, 0, DD, E, 1, [op(1.02, 4.94, 'bay', { panels: 3, open: true, head: 2.4 }), op(7.11, 11.02, 'bay', { panels: 3, open: true, head: 2.4 })]),
      // refend médian : il n'en reste que trois tronçons, le reste est ouvert sous poutre
      wh(NH + PW / 2, 0, 0.42, PW), wh(NH + PW / 2, SX, 5.57, PW), wh(NH + PW / 2, 11.36, DW, PW),
      // niche du mur Nord : placard et gaine
      wv(4.05, 0, 0.43, P), wv(5.815, 0, 0.43, 0.09),
      // placard de l'entrée, buanderie
      wh(8.145, -0.09, 2.22, 0.11), wv(2.27, SHAFT[1], DD, P, 0, [op(10.3, 11.3, 'door', { hinge: 'a1', swing: 1, open: 23 })]),
      // WC PMR, adossé à la gaine de l'ascenseur ; sa cloison Ouest se prolonge en joue des placards de l'arrière-cuisine
      wh(SHAFT[1] + 0.05, 3.56, SHAFT[0], P), wv(3.605, SHAFT[1], 10.34, 0.09, 0, [op(8.04, 9.04, 'door', { hinge: 'a0', swing: -1, open: 23 })]), wh(9.41, 3.65, SHAFT[0], P),
      ...shaftWalls(),
    ],
    blockers: [[SX, SZ, 6.25, 4.2], [SX, 4.2, 5.33, NH]],
    items: [
      // 1 — entrée : placard à portes pliantes
      ['wardrobe', 1.11, 7.775, 180, { w: 2.22, d: 0.63, mat: 'lacquer', open: false }],
      // 2 — séjours : coin salon au Nord-Ouest (table ronde, trois fauteuils), canapé d'angle au Nord-Est face au mur TV
      ['rug', 2.175, 2.61, 0, { w: 3.21, d: 4.04, mat: 'rug' }], ['coffeeRound', 2.2, 2.5, 0, { r: 0.59, h: 0.42 }],
      ['armchair', 1.33, 1.48, 40, { mat: 'walnut' }], ['armchair', 3.03, 1.48, 321, { mat: 'walnut' }], ['armchair', 2.17, 3.91, 180, { mat: 'walnut' }],
      ['sideTable', 2.16, 0.95, 0, { r: 0.19, h: 0.45, mat: 'walnut' }], ['pouf', 1.21, 3.39, 0, { r: 0.27 }], ['pendant', 2.2, 2.5, 0, { kind: 'ring', drop: 0.7 }],
      ['wardrobe', 4.935, 0.215, 0, { w: 1.67, d: 0.43, mat: 'lacquer' }], ['duct', 6.26, 0.215, 0, { w: 0.8, d: 0.43 }],
      ['rug', 9.475, 3.135, 0, { w: 3.53, d: 3.09, mat: 'rugDark' }], ['sofa', 8.84, 4.79, 180, { w: 3.5, d: 0.98, chaise: 'R', cl: 1.79, cw: 1.0, pillows: ['terra', 'charcoal'] }],
      ['coffeeRect', 9.49, 2.975, 0, { w: 1.2, d: 1.17, oval: false, mat: 'marbleDark' }], ['tvWall', 9.53, 0, 0, { w: 2.6, tv: 1.5 }], ['pampas', 8.0, 0.24, 0, { h: 1.25 }],
      ['pendant', 9.5, 3.0, 0, { kind: 'tubes', drop: 0.5 }], ['curtain', DW - 0.1, 0.7, 270, { w: 0.5 }], ['curtain', DW - 0.1, 5.25, 270, { w: 0.5 }],
      // 3 — cuisine : linéaire Sud avec évier double et plaque, colonnes le long de la gaine, table de huit
      ['kitchenRun', 9.44, 11.705, 180, { w: 4.4, d: 0.65, sink: 0.92, hob: -0.84, upper: true, splash: true }],
      ['kitchenTall', 7.575, 8.9, 90, { w: 2.88, d: 0.63 }],
      ['diningTable', 9.63, 8.79, 90, { w: 2.8, d: 1.19, n: 4, ends: 'b' }], ['pendant', 9.63, 8.79, 90, { kind: 'rail', n: 5, span: 0.45, drop: 1.0 }],
      ['curtain', DW - 0.1, 6.8, 270, { w: 0.5 }], ['curtain', DW - 0.1, 11.35, 270, { w: 0.5 }],
      // 4 — arrière-cuisine : placards à portes pliantes et réfrigérateur contre la gaine, plan de travail le long du mur Sud
      ['wardrobe', 5.03, 9.9, 0, { w: 2.72, d: 0.88, mat: 'lacquer', open: false }], ['fridge', 6.815, 9.9, 0, { w: 0.85, d: 0.88 }],
      ['kitchenRun', 4.32, 11.705, 180, { w: 4.0, d: 0.65, upper: true, splash: true }], ['kitchenRun', 6.78, 11.705, 180, { w: 0.92, d: 0.65, deco: false }], ['duct', 6.78, 11.845, 0, { w: 0.92, d: 0.37 }],
      // 5 — buanderie : placards le long du mur Ouest, de part et d'autre d'une gaine
      ['wardrobe', 0.26, 9.09, 90, { w: 1.78, d: 0.7, mat: 'lacquer' }], ['duct', 0.26, 10.265, 90, { w: 0.57, d: 0.7 }], ['wardrobe', 0.26, 11.29, 90, { w: 1.48, d: 0.7, mat: 'lacquer' }],
      // 6 — WC PMR : plan vasque au Nord, cuvette contre la gaine
      ['vanity', 4.3, 7.77, 0, { w: 1.3, d: 0.42, double: false, mirrorH: 0.7 }], ['duct', 5.145, 8.46, 0, { w: 0.39, d: 1.8 }], ['toilet', 4.62, 8.9, 270, {}],
      // objets de vie (ajouts d'ameublement, hors plan) : rien au sol dans les passages ni devant les portes et les baies
      // entrée : console et miroir contre le refend, patères et chaussures en face, parapluies près de la porte palière
      ['console', 4.75, SH, 0, { w: 1.0, d: 0.3 }], ['hooks', 4.45, SHAFT[1], 180, { w: 0.7, bag: true }], ['umbrella', 0.28, 6.25, 0, {}],
      ['shoes', 4.45, SHAFT[1], 180, { set: [[-0.2, 0.16, 0.1, 'taupe'], [0.15, 0.17, -0.1, 'charcoal']] }],
      // séjours : grande toile au-dessus du coin salon, deux cadres et lampadaire, plantes dans les angles, corbeille à plaids
      ['frames', 2.2, 0, 0, { set: [[0, 1.55, 1.2, 0.8, 'art3', 'oak']] }], ['floorLamp', 0.45, 0.5, 0, {}],
      ['frames', 0, 2.6, 90, { set: [[-0.45, 1.5, 0.5, 0.7, 'art3', 'black'], [0.45, 1.5, 0.5, 0.7, 'art1', 'black']] }],
      ['fig', 0.4, 5.3, 0, { h: 1.8, seed: 11 }], ['basket', 0.45, 3.6, 0, {}], ['plant', 11.1, 0.35, 0, { kind: 'snake', h: 1.15, pot: 0.2 }], ['fig', 11.1, 6.45, 0, { h: 1.6, seed: 9, dark: true }],
      // buanderie : lave-linge et sèche-linge contre la cloison Est, étagère à linge au-dessus, planche à repasser au Sud (le Sud reste au visiteur)
      ['washer', 1.91, 8.85, 270, { n: 2 }], ['wallShelf', 2.22, 8.85, 270, { w: 1.2, ys: [1.5], kind: 'laundry' }], ['ironing', 1.9, DD, 180, {}],
      // WC
      ['frames', 4.3, 9.36, 180, { set: [[0, 1.5, 0.3, 0.4, 'art1', 'oak']] }],
    ],
    rooms: [
      { id: 'entree', fr: 'Entrée', en: 'Entrance', rs: [[0, SH, SHAFT[0], SHAFT[1]]], at: [1.9, 6.8], cam: { p: [0.75, 6.85], t: [8, 6.6] } },
      { id: 'sejour', fr: 'Séjours', en: 'Living rooms', rs: [[0, 0, DW, NH], [0.42, NH, 11.36, SH], [SHAFT[0], SH, 5.84, SHAFT[1]], [5.84, SH, 6.74, 6.2], [6.74, SH, DW, SHAFT[1]]], at: [7.3, 2.4], cam: { p: [6.75, 1.5], t: [10.4, 4.4] } },
      { id: 'cuisine', fr: 'Cuisine', en: 'Kitchen', rs: [[SHAFT[2], SHAFT[1], DW, DD]], at: [9.6, 10.4], cam: { p: [8.33, 7.8], t: [10.6, 11.7] } },
      { id: 'arriere', fr: 'Arrière-cuisine', en: 'Scullery', rs: [[2.32, SHAFT[1], 3.56, 10.34], [2.32, 10.34, SHAFT[2], DD]], at: [4.6, 10.85], cam: { p: [2.95, 10.8], t: [7.0, 10.9] } },
      { id: 'buanderie', fr: 'Buanderie', en: 'Laundry', rs: [[-0.09, 8.2, 2.22, DD]], at: [1.3, 10.0], cam: { p: [1.45, 11.3], t: [0.3, 8.8], pitch: -0.2 }, minor: true },
      { id: 'wc', fr: 'WC', en: 'WC', rs: [[3.65, 7.56, 4.95, 9.36]], at: [4.25, 8.6], cam: { p: [4.0, 9.0], t: [4.6, 7.6], pitch: -0.3 }, minor: true },
      { id: 'ascenseur', fr: 'Ascenseur privatif', en: 'Private lift', rs: [[LIFT.x0, SHAFT[1], LIFT.x1, LIFT.y1], [5.84, 6.2, 6.74, SHAFT[1]]], at: [6.29, 8.45], cam: { p: [6.29, 6.55], t: [6.29, 8.6] } },
      { id: 'jardin', fr: 'Terrasse et jardin', en: 'Terrace and garden', rs: [[DW + E, -0.2, 16.65, DD + 0.2]], at: [14.0, 4.3], cam: { p: [12.75, 3.9], t: [22, 3.0] } },
    ],
    tour: ['entree', 'sejour', 'jardin', 'cuisine', 'arriere', 'ascenseur'],
  }, {
    id: 'etage', name: { fr: 'Niveau 2', en: 'Level 2' }, y: FH, h: 2.5,
    bounds: [3.5, -0.6, 12.7, DD + 0.6], walkable: [[UX, 0, DW, DD]],
    floors: [['floor', UX, 0, DW, SZ], ['floor', 6.25, SZ, DW, NH], ['floor', 5.57, 4.98, 6.25, NH], ['floor', 5.57, NH, DW, SH], ['floor', UX, SH, DW, DD],
      ['tile', UX, 0, 6.2, 2.89], ['tile', 5.79, 0.75, 6.58, 1.81], ['tile', UX, SH, 5.34, 8.36], ['tile', UX, 8.45, 5.34, 9.46], ['tile', UX, 9.46, 7.15, DD]],
    ceilings: [[UX, 0, DW, DD]],
    walls: [
      // murs extérieurs : fenêtre de la salle de bains 1 à l'Ouest, quatre portes-fenêtres de 1,24 m à l'Est
      wv(UX - E / 2, 0, DD, E, -1, [op(10.45, 11.0, 'window', { sill: 1.25, head: 2.1 })]), wh(-E / 2, UX - E, DW + E, E, -1), wh(DD + E / 2, UX - E, DW + E, E, 1),
      wv(DW + E / 2, 0, DD, E, 1, [op(1.02, 2.25, 'french', { head: 2.25, rail: false, shutter: 'a1' }), op(3.69, 4.93, 'french', { head: 2.25, rail: false, shutter: 'a0' }),
        op(7.1, 8.35, 'french', { head: 2.25, rail: false, shutter: 'a1' }), op(9.8, 11.04, 'french', { head: 2.25, rail: false, shutter: 'a0' })]),
      // refend médian, ouvert sur 1,58 m entre le palier et le dégagement de l'ascenseur
      wh(NH + PW / 2, UX, 5.57, PW), wh(NH + PW / 2, 7.15, DW, PW),
      // salle de bains 2 : mur de la cage d'escalier, niche de la douche, porte sur le couloir
      wh(2.945, UX, 6.29, 0.11), wv(6.245, 1.92, 2.89, 0.09, 0, [op(2.01, 2.82, 'door', { hinge: 'a1', swing: -1, open: 90 })]), wh(1.865, 5.79, 7.25, 0.11), wv(5.76, 0, 0.75, 0.06), wv(6.62, 0, 1.81, 0.08),
      // cloison des chambres : portes des chambres 3 et 2 ; au Sud du refend, portes de la chambre 1 et de sa salle de bains
      wv(7.2, 1.92, NH, P, 0, [op(2.01, 2.82, 'door', { hinge: 'a1', swing: 1, open: 90 }), op(4.96, 5.77, 'door', { hinge: 'a1', swing: 1, open: 90 })]),
      wv(7.2, SH, SHAFT[1], P, 0, [op(6.58, 7.39, 'door', { hinge: 'a0', swing: 1, open: 90 })]), wv(7.2, SHAFT[3], DD, P, 0, [op(9.56, 10.37, 'door', { hinge: 'a0', swing: -1, open: 90 })]),
      wh(2.965, 7.25, DW, 0.09),
      // WC 2 et douche de la salle de bains 1, contre la gaine de l'ascenseur
      wv(5.39, SH, SHAFT[1], P, 0, [op(6.55, 7.4, 'door', { hinge: 'a0', swing: -1, open: 90 })]), wh(8.405, UX, SHAFT[0], 0.09),
      ...shaftWalls(),
      // tête de lit maçonnée de la chambre 1 : 90 cm de passage derrière, vers la salle de bains
      wv(8.225, 7.59, 10.6, 0.17, 0, [], { h: 1.25 }),
    ],
    rails: [[6.27, SZ, 6.27, 4.98], [5.57, 4.98, 6.27, 4.98]],
    blockers: [[UX, SZ, 6.25, 4.98], [UX, 4.98, 5.2, NH]],
    items: [
      // 13 — salle de bains 2 : baignoire au Nord, douche en niche, double vasque à l'Ouest
      ['bathtub', 4.905, 0.385, 90, { w: 0.75, l: 1.7 }], ['duct', 6.19, 0.375, 0, { w: 0.78, d: 0.75 }], ['shower', 6.185, 1.28, 270, { w: 1.06, d: 0.79, glass: ['front'] }],
      ['vanity', 4.23, 2.06, 90, { w: 1.4, d: 0.46, double: true }], ['towelRail', 4.71, 2.885, 180, {}],
      // 12 — chambre 3 : lit de 140 tête au Nord, placard à l'Ouest
      ['bed', 9.66, 1.06, 0, { w: 1.4, l: 1.9, hw: 0.2, throwMat: 'sage' }], ['wardrobe', 6.945, 0.905, 90, { w: 1.81, d: 0.57 }],
      // 11 — chambre 2 : lit de 140 tête au Nord, placard à l'Ouest
      ['bed', 9.66, 4.07, 0, { w: 1.4, l: 1.9, hw: 0.2, throwMat: 'ochre' }], ['wardrobe', 7.565, 3.935, 90, { w: 1.81, d: 0.63 }],
      // 8 — WC 2
      ['vanity', 4.665, 6.285, 0, { w: 1.33, d: 0.39, double: false, mirrorH: 0.7 }], ['toilet', 4.48, 8.03, 180, {}], ['duct', 5.145, 8.025, 0, { w: 0.39, d: 0.67 }],
      // 9 — salle de bains 1 : douche de 133 × 100, double vasque au Sud, WC contre la gaine
      ['shower', 4.665, 8.955, 0, { w: 1.33, d: 1.0, glass: ['front'] }], ['vanity', 5.12, 11.79, 180, { w: 2.24, d: 0.48, double: true }],
      ['duct', 6.75, 11.79, 0, { w: 0.84, d: 0.48 }], ['toilet', 6.77, 11.22, 180, {}], ['towelRail', 4.02, 9.95, 90, {}],
      // 10 — chambre 1 : placards au Nord et au Sud, lit de 160 adossé à la tête de lit, banc, tapis
      ['wardrobe', 9.955, 6.39, 0, { w: 3.41, d: 0.6 }], ['wardrobe', 9.895, 11.73, 180, { w: 3.53, d: 0.6 }], ['shelves', 7.68, 11.74, 180, { w: 0.86, d: 0.56, h: 2.3 }],
      ['rug', 10.135, 9.08, 0, { w: 1.93, d: 2.82, mat: 'rug' }], ['bed', 9.36, 9.1, 90, { w: 1.6, l: 1.9, hw: 0.9 }], ['bench', 10.485, 9.085, 90, { w: 1.21, d: 0.35 }],
      // objets de vie (ajouts d'ameublement, hors plan)
      // salle de bains 2 : tapis devant la baignoire (rien au sol : c'est là que se tient le visiteur)
      ['bathMat', 5.0, 1.05, 0, { w: 0.8, d: 0.45 }],
      // palier : deux cadres entre les portes des chambres
      ['frames', 7.15, 3.89, 270, { set: [[-0.45, 1.5, 0.5, 0.7, 'art1', 'black'], [0.45, 1.5, 0.5, 0.7, 'art3', 'black']] }],
      // chambre 3
      ['frames', 9.66, 0, 0, { set: [[0, 1.55, 0.9, 0.6, 'art3', 'oak']] }], ['fig', 11.3, 0.38, 0, { h: 1.5, seed: 13 }], ['objs', 9.9, 1.72, 0, { y: 0.645, set: [['sweater', 0, 0, -0.2]] }],
      // chambre 2
      ['frames', 9.66, 3.01, 0, { set: [[-0.3, 1.55, 0.4, 0.5, 'art3', 'black'], [0.3, 1.55, 0.4, 0.5, 'art1', 'black']] }], ['floorMirror', 10.95, NH, 180, {}],
      // chambre 1 : ficus entre les portes-fenêtres, plaid et livres sur le banc
      ['fig', 11.3, 9.08, 0, { h: 1.7, seed: 17 }], ['objs', 10.485, 9.085, 90, { y: 0.44, set: [['plaid', 0.25, 0, 0, 'ochre'], ['books', -0.3, 0, 0.2]] }],
      // salle de bains 1 : tapis devant la double vasque, tabouret
      ['bathMat', 5.12, 11.2, 0, { w: 1.1, d: 0.5 }], ['bathStool', 4.3, 10.75, 0, {}],
      // WC
      ['frames', UX, 7.2, 90, { set: [[0, 1.5, 0.3, 0.4, 'art3', 'oak']] }],
    ],
    rooms: [
      { id: 'palier', fr: 'Palier', en: 'Landing', rs: [[6.29, 1.92, 7.15, NH], [5.57, 4.98, 6.29, NH], [5.57, NH, 7.15, SH], [5.44, SH, 7.15, 6.2], [5.44, 6.2, 5.84, SHAFT[1]], [6.74, 6.2, 7.15, SHAFT[1]]], at: [6.72, 4.2], cam: { p: [6.72, 2.9], t: [6.4, 7.4] } },
      { id: 'ch3', fr: 'Chambre 3', en: 'Bedroom 3', rs: [[7.25, 0, DW, 2.92], [6.66, 0, 7.25, 1.81]], at: [9.5, 1.5], cam: { p: [7.75, 2.45], t: [10.6, 0.9] } },
      { id: 'ch2', fr: 'Chambre 2', en: 'Bedroom 2', rs: [[7.25, 3.01, DW, NH]], at: [9.5, 4.5], cam: { p: [8.25, 5.45], t: [10.6, 3.6] } },
      { id: 'sdb2', fr: 'Salle de bains 2', en: 'Bathroom 2', rs: [[UX, 0, 6.2, 2.89], [5.79, 0.75, 6.58, 1.81]], at: [5.1, 1.8], cam: { p: [5.55, 2.45], t: [4.4, 0.6], pitch: -0.3 }, minor: true },
      { id: 'wc2', fr: 'WC', en: 'WC', rs: [[UX, SH, 5.34, 8.36]], at: [4.6, 7.2], cam: { p: [4.75, 7.1], t: [4.4, 8.3], pitch: -0.35 }, minor: true },
      { id: 'ch1', fr: 'Chambre 1', en: 'Bedroom 1', rs: [[7.25, SH, DW, DD]], at: [9.9, 9.1], cam: { p: [10.9, 7.15], t: [8.9, 9.6] } },
      { id: 'sdb1', fr: 'Salle de bains 1', en: 'Bathroom 1', rs: [[UX, 9.46, 7.15, DD], [UX, 8.45, 5.34, 9.46]], at: [5.6, 10.6], cam: { p: [6.6, 10.0], t: [4.7, 11.6], pitch: -0.28 } },
      { id: 'ascenseur', fr: 'Ascenseur privatif', en: 'Private lift', rs: [[LIFT.x0, SHAFT[1], LIFT.x1, LIFT.y1], [5.84, 6.2, 6.74, SHAFT[1]]], at: [6.29, 8.45], cam: { p: [6.29, 6.55], t: [6.29, 8.6] } },
    ],
    tour: ['palier', 'ch3', 'ch2', 'ch1', 'sdb1'],
  }],
  start: { room: 'sejour' },
  orbit: { target: [8.3, 0, 6.0], dist: 30 },
  /* Jardins n° 2 et n° 3 : chaque plan de logement dessine sa table (n° 2 : table ronde et six chaises ; n° 3 : table de huit,
     dans l'axe Nord-Sud). Unités extérieures des PAC contre le mur Nord et en façade au Sud, olivier en pot et lanterne près des baies,
     barbecue et arrosoir côté n° 3, bornes basses dans les massifs, robinet de puisage entre les deux baies. */
  garden: [
    ['outdoorRound', 14.4, 2.05, 0, { r: 0.6, n: 6 }], ['outdoorTable', 13.95, 9.25, 90, { w: 2.2, d: 0.97, n: 3, ends: true }],
    ['acUnit', 12.86, 0.03, 0, {}], ['acUnit', 12.2, 11.82, 90, { w: 0.7 }],
    ['plant', 12.3, 0.5, 0, { kind: 'olive', h: 1.6, pot: 0.26 }], ['lantern', 12.25, 5.3, 0, { h: 0.6 }], ['bbq', 15.0, 7.4, 0, {}], ['wateringCan', 15.25, 11.35, 200, {}],
    ['gardenLight', 16.05, 3.6, 0, {}], ['gardenLight', 15.8, 8.35, 0, {}], ['gardenTap', DW + E, 5.45, 90, {}],
  ],
  /* Relevé (plans des niveaux 1 et 2 à l'échelle, plans des logements 02 et 03, façade Est) ; repère du site = logement + (5,41 ; 13,5) :
     - profondeur 4,8 m de la façade au nu intérieur du muret Est (cote du plan de masse) ;
     - jardin n° 2 de la façade Nord du duplex à l'axe du mur mitoyen 02/03 (6,0 m), jardin n° 3 de cet axe au mur Sud (6,2 m) ;
     - limite Est : muret de soutènement de 1,30 m (terrasse de la piscine à −1,30) en pierre calcaire, grille à barreaudage de 1,04 m,
       piliers aux deux extrémités et à la limite 02/03 (façade Est) ;
     - n° 2 : dallage hexagonal, bande plantée de 0,95 m le long du muret, bande de gravillons au Nord (plan de masse) ;
     - n° 3 : dallage en pierre, bande plantée de 1,3 m le long du muret, arbuste à l'angle Sud-Est ;
     - entre les deux : haie sur une bande plantée de 1,15 m ; au Sud : clôture doublée d'une haie vive. */
  exterior(b, M, lv) {
    const dal = M.travertine || M.terrace, mur = M.drystone || M.stone, grav = M.gravel || M.paving, paillis = M.mulch || M.earth, shrub = V.shrub || V.oleander;
    const FX = DW + E, EX = FX + 4.8, ZN = -0.15, ZS = DD + 0.17, Z23 = NH + PW / 2, H0 = Z23 - 0.6, H1 = Z23 + 0.45, B2 = EX - 0.95, B3 = EX - 1.3, PX = 13.1, GN = 13.1, ZB = 11.45;
    b.on('ext');
    b.box(M.socle, FX, -0.32, -E, EX + 0.35, -0.1, ZS + 0.04);
    // n° 2 : dallage hexagonal ; caniveau devant la baie du séjour ; gravillons au Nord ; bande plantée à l'Est
    facadeStrip(b, M, M.hexPaving, FX, FX + 0.15, ZN, H0, [[1.02, 4.94]]);
    b.box(M.hexPaving, FX + 0.15, -0.07, ZN, GN, -0.015, H0); b.box(M.hexPaving, GN, -0.07, 0.7, B2, -0.015, H0);
    b.box(grav, GN, -0.08, ZN, B2, -0.03, 0.7); b.box(paillis, B2, -0.1, ZN, EX, -0.035, H0);
    edge(b, M, GN, 0.7, B2, 0.706); edge(b, M, B2 - 0.006, 0.7, B2, H0);
    // passage entre les deux jardins le long de la façade (les deux logements sont réunis), bande plantée et haie mitoyenne
    facadeStrip(b, M, dal, FX, FX + 0.15, H0, H1, []); b.box(dal, FX + 0.15, -0.07, H0, PX, -0.015, H1);
    b.box(paillis, PX, -0.1, H0, EX, -0.035, H1); edge(b, M, PX - 0.006, H0, PX, H1);
    lv.blocks.push(V.hedge(b, M, PX + 0.25, Z23 - 0.5, EX - 0.1, Z23 + 0.32, { h: 1.25, y: -0.035 }));
    // n° 3 : dallage de pierre ; caniveau devant la baie de la cuisine ; bande plantée à l'Est et au Sud
    facadeStrip(b, M, dal, FX, FX + 0.15, H1, ZB, [[7.11, 11.02]]);
    b.box(dal, FX + 0.15, -0.07, H1, B3, -0.015, ZB); b.box(paillis, B3, -0.1, H1, EX, -0.035, ZB); b.box(paillis, FX, -0.1, ZB, EX, -0.035, ZS + 0.04);
    edge(b, M, B3 - 0.006, H1, B3, ZB); edge(b, M, FX + 0.15, ZB, B3, ZB + 0.006);
    // limite Nord : mur enduit entre le jardin et l'accès aux espaces communs
    b.box(M.stucco, FX, -0.32, -E, EX + 0.35, 1.8, ZN); b.box(dal, FX, 1.8, -E - 0.02, EX + 0.35, 1.84, ZN + 0.02); lv.blocks.push([FX, -E - 0.2, EX + 0.35, ZN]);
    // limite Sud : clôture à barreaudage doublée d'une haie vive
    railing(b, M, FX + 0.05, ZS + 0.02, EX, ZS + 0.02, -0.035, 1.2, 'cadre'); lv.blocks.push(V.hedge(b, M, FX + 0.6, ZB + 0.1, EX - 0.05, ZS - 0.03, { h: 1.6, y: -0.035 }));
    lv.blocks.push([FX, ZS - 0.05, EX + 0.35, ZS + 0.1]);
    // limite Est : muret de soutènement en pierre calcaire (pied sur la terrasse de la piscine), couvertine, grille et piliers
    b.box(mur, EX, -0.32, ZN, EX + 0.35, 0, ZS + 0.05); b.box(dal, EX - 0.03, 0, ZN, EX + 0.38, 0.05, ZS + 0.05);
    railing(b, M, EX + 0.175, ZN, EX + 0.175, ZS, 0.05, 1.04, 'cadre');
    for (const z of [ZN + 0.15, Z23, ZS - 0.1]) { b.box(M.stucco, EX + 0.025, 0.05, z - 0.15, EX + 0.325, 1.12, z + 0.15); b.box(dal, EX - 0.005, 1.12, z - 0.18, EX + 0.355, 1.16, z + 0.18); }
    lv.blocks.push([EX - 0.03, -E, EX + 0.38, ZS + 0.05]);
    b.on('ctx'); b.box(mur, EX, -1.3, -E, EX + 0.35, -0.32, ZS + 0.05); b.on('ext');
    // plantations relevées sur les plans des logements : petits oliviers aux angles Est, arbustes, graminées, lavandes
    lv.blocks.push(V.tree(b, M, 16.1, 0.55, { kind: 'olive', h: 3.0, r: 1.1, seed: 4 })); lv.blocks.push(V.tree(b, M, 16.05, 10.6, { kind: 'olive', h: 3.2, r: 1.2, seed: 6 }));
    lv.blocks.push(V.oleander(b, M, 14.99, 0.38, { r: 0.5, seed: 8 }));
    for (const [x, z, kind, r, s] of [[13.8, 0.35, 'grass', 0.32, 1], [16.3, 2.6, 'rosemary', 0.42, 3], [16.2, 4.45, 'grass', 0.35, 5], [16.2, 5.1, 'pittosporum', 0.4, 7],
      [16.15, 7.5, 'rosemary', 0.45, 9], [16.1, 9.3, 'pittosporum', 0.5, 11]]) lv.blocks.push(shrub(b, M, x, z, { kind, r, h: kind === 'pittosporum' ? 1.4 : 0.8, seed: s }));
    V.lavender(b, M, 16.3, 1.3, 16.3, 2.0, { seed: 5 }); V.lavender(b, M, 16.3, 3.2, 16.3, 3.9, { seed: 6 }); V.lavender(b, M, 16.1, 8.0, 16.1, 8.7, { seed: 7 });
    if (V.groundcover) { V.groundcover(b, M, B2 + 0.05, 0.05, EX - 0.05, H0 - 0.05, { y: -0.035, seed: 3 }); V.groundcover(b, M, B3 + 0.05, H1 + 0.05, EX - 0.05, ZB - 0.05, { y: -0.035, seed: 4 }); }
    if (V.climber) V.climber(b, M, FX + 0.4, 0.1, ZN - 0.01, GN - 0.1, 1.75, ZN - 0.01, { seed: 5, density: 0.6 });
    // le reste de l'immeuble et ses abords (site.js)
    buildSite(b, M, { o: duplex.site.o, skip: ['duplex'] });
    // balcons filants de l'étage au-dessus des deux baies
    b.on('L1'); const gx0 = FX;
    for (const [z0, z1] of [[0.87, 4.97], [6.98, 11.14]]) {
      b.box(M.stucco, gx0, FH - 0.2, z0, gx0 + 0.5, FH - 0.02, z1); b.box(M.terrace, gx0, FH - 0.02, z0, gx0 + 0.5, FH - 0.004, z1);
      railing(b, M, gx0 + 0.47, z0 + 0.03, gx0 + 0.47, z1 - 0.03, FH - 0.004); railing(b, M, gx0, z0 + 0.03, gx0 + 0.47, z0 + 0.03, FH - 0.004); railing(b, M, gx0, z1 - 0.03, gx0 + 0.47, z1 - 0.03, FH - 0.004);
    }
    // dalle entre les deux niveaux : trémies de l'escalier et de l'ascenseur
    b.on('L0:top');
    for (const s of [[-E, -E, UX, DD + E], [UX, -E, DW + E, SZ], [6.25, SZ, DW + E, NH], [5.57, 4.98, 6.25, NH], [UX, NH, DW + E, SHAFT[1] + 0.2], [UX, SHAFT[1] + 0.2, SHAFT[0] + 0.2, SHAFT[3] - 0.2],
      [SHAFT[2] - 0.2, SHAFT[1] + 0.2, DW + E, SHAFT[3] - 0.2], [UX, SHAFT[3] - 0.2, DW + E, DD + E]]) b.box(M.concrete, s[0], 2.65, s[1], s[2], FH - 0.03, s[3]);
    // habillage des rives de la trémie de l'escalier
    b.box(M.plaster, SX, 2.6, SZ - 0.02, 6.25, FH - 0.03, SZ); b.box(M.plaster, 6.25, 2.6, SZ, 6.27, FH - 0.03, 4.98); b.box(M.plaster, 5.57, 2.6, 4.96, 6.27, FH - 0.03, 4.98); b.box(M.plaster, SX - 0.02, 2.6, SZ, SX, FH - 0.03, NH);
    b.on('ext:top');
    b.box(M.stucco, UX - E, FH + 2.56, -E, DW + E, 5.74, DD + E);
  },
  trees: [],
};

export const APARTMENTS = [villa, duplex];
