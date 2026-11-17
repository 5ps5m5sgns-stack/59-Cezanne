/* 59 Cézanne — visite 3D : construction de l'architecture à partir des données de plan (plans.js).
   Murs orthogonaux avec ouvertures, menuiseries, garde-corps, volets lattés, escalier, ascenseur, sols et plafonds.
   Les murs sont découpés à CUT mètres : la partie basse reste visible en vue « maquette », la partie haute
   et les plafonds partent dans le calque « :top », masqué quand on regarde le logement de dessus. */
import * as THREE from 'three';
import { F } from 'v3d/furniture';

export const CUT = 1.25;
const PI = Math.PI;

/* Profils (u : saillie hors du mur ou de la menuiserie, v : hauteur ou largeur), en mètres. */
const SKIRT = [[0, 0.007], [0.013, 0.007], [0.013, 0.079], [0.0085, 0.092], [0, 0.092]];   // plinthe laquée : léger décollement du sol et chanfrein
const SKIRT_GAP = [[0, 0], [0.009, 0], [0.009, 0.009], [0, 0.009]];                          // joint creux sous la plinthe
const CEIL_GAP = [[0, 0], [0.005, 0], [0.005, 0.014], [0, 0.014]];                           // joint creux plafond-mur
const CASING = [[-0.012, 0], [0.058, 0], [0.058, 0.011], [0.05, 0.019], [-0.012, 0.019]];    // chambranle : tableau de 7 cm, arête chanfreinée

/* Extrusion le long d'une face de mur : k 'h' (le long de x) ou 'v' (le long de z), face à la coordonnée c, la pièce étant du côté dir (±1). */
function wallRun(b, mat, prof, k, a0, a1, c, dir, y) {
  const [p, q] = k === 'h' ? (dir > 0 ? [[a1, c], [a0, c]] : [[a0, c], [a1, c]]) : (dir > 0 ? [[c, a0], [c, a1]] : [[c, a1], [c, a0]]);
  b.sweep(mat, prof, [p[0], y, p[1]], [q[0], y, q[1]]);
}

/* Appareillage en applique, repère local : +z hors du mur. La saillie reste inférieure à 2 cm : le plan fixe la position, pas le volume. */
function fixture(b, M, type, x, y, z, rot) {
  b.push(x, y, z, rot);
  if (type === 'sw') {                                          // interrupteur : platine 80 × 80, bascule, repère lumineux
    b.box(M.skirt, -0.04, -0.04, 0, 0.04, 0.04, 0.009); b.box(M.white, -0.017, -0.024, 0.009, 0.017, 0.024, 0.0125); b.box(M.led, -0.0012, 0.016, 0.0125, 0.0012, 0.019, 0.0132);
  } else if (type === 'sock') {                                 // prise 2P+T : platine, collerette ronde, deux alvéoles
    b.box(M.skirt, -0.04, -0.04, 0, 0.04, 0.04, 0.009); b.geo(M.white, new THREE.CylinderGeometry(0.026, 0.026, 0.004, 12), 0, 0, 0.011, PI / 2, 0, 0);
    for (const sx of [-1, 1]) b.box(M.black, sx * 0.0095 - 0.0016, -0.003, 0.013, sx * 0.0095 + 0.0016, 0.003, 0.0136);
  } else if (type === 'thermo') {                               // thermostat d'ambiance
    b.box(M.skirt, -0.04, -0.04, 0, 0.04, 0.04, 0.009); b.box(M.screen, -0.026, -0.016, 0.009, 0.026, 0.02, 0.0115); b.box(M.led, -0.016, 0.0, 0.0115, 0.016, 0.01, 0.012);
  } else if (type === 'visio') {                                // visiophone : combiné, écran, deux touches
    b.box(M.skirt, -0.06, -0.1, 0, 0.06, 0.1, 0.018); b.box(M.screen, -0.044, 0.0, 0.018, 0.044, 0.08, 0.0205);
    for (const sx of [-1, 1]) b.box(M.black, sx * 0.03 - 0.012, -0.075, 0.018, sx * 0.03 + 0.012, -0.055, 0.02);
  }
  b.pop();
}

/* Garde-corps à barreaudage vertical entre deux points du plan. */
export function railing(b, M, x0, z0, x1, z1, y = 0, h = 1.02, mat = 'frame') {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0);
  b.push(x0, y, z0, ang);
  b.rod(M[mat], [0, h - 0.022, 0], [len, h - 0.022, 0], 0.022, 10);                          // main courante ronde
  b.box(M[mat], 0, 0.08, -0.012, len, 0.105, 0.012);
  const n = Math.max(1, Math.round(len / 0.11));
  for (let i = 0; i <= n; i++) { const x = (len / n) * i; b.box(M[mat], x - 0.009, 0.08, -0.009, x + 0.009, h - 0.04, 0.009); }
  for (let i = 0, k = Math.max(1, Math.round(len / 1.4)); i <= k; i++) { const x = (len / k) * i; b.box(M[mat], x - 0.02, 0.006, -0.02, x + 0.02, h - 0.03, 0.02); b.box(M[mat], x - 0.045, 0, -0.045, x + 0.045, 0.006, 0.045); }   // montant sur platine
  b.pop();
}

/* Panneau de volet coulissant à lames verticales (cadre + lattes bois), posé en façade, suspendu à un rail noir. */
function shutter(b, M, x0, x1, y0, y1, z) {
  b.box(M.frame, x0, y0, z, x1, y0 + 0.04, z + 0.045); b.box(M.frame, x0, y1 - 0.04, z, x1, y1, z + 0.045);
  b.box(M.frame, x0, y0, z, x0 + 0.04, y1, z + 0.045); b.box(M.frame, x1 - 0.04, y0, z, x1, y1, z + 0.045);
  for (let x = x0 + 0.06; x < x1 - 0.06; x += 0.062) b.box(M.slat, x, y0 + 0.04, z + 0.006, x + 0.036, y1 - 0.04, z + 0.04);
  b.box(M.black, x0 - 0.03, y1, z - 0.01, x1 + 0.03, y1 + 0.035, z + 0.05);                 // rail de suspension
}

/* Poignée verticale sur platine, des deux côtés d'un montant (sd = ±1 : face). */
function grip(b, M, x, y, zc, sd, half = 0.035) {
  b.box(M.black, x - 0.014, y - 0.075, zc + sd * half, x + 0.014, y + 0.075, zc + sd * (half + 0.006));
  const z1 = zc + sd * (half + 0.006), z2 = zc + sd * (half + 0.034);
  b.rod(M.black, [x, y + 0.055, z1], [x, y + 0.055, z2], 0.007, 6); b.rod(M.black, [x, y - 0.055, z1], [x, y - 0.055, z2], 0.007, 6);
  b.rod(M.black, [x, y + 0.062, z2], [x, y - 0.062, z2], 0.0085, 8);
}

/* Vitrage : dormant noir + ouvrants plus fins en retrait + verre, dans le plan z = 0 (repère local du mur, +z vers l'extérieur). */
function glazing(b, M, x0, x1, y0, y1, n = 1, z = 0, fr = 0.05) {
  b.box(M.frame, x0, y0, z - 0.035, x1, y0 + fr, z + 0.035); b.box(M.frame, x0, y1 - fr, z - 0.035, x1, y1, z + 0.035);
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) / n) * i, a = i === 0 ? 0 : i === n ? -fr : -fr / 2; b.box(M.frame, x + a, y0, z - 0.035, x + a + fr, y1, z + 0.035); }
  b.box(M.glass, x0 + fr, y0 + fr, z - 0.008, x1 - fr, y1 - fr, z + 0.008);
  const cw = (x1 - x0) / n, q = Math.min(0.024, fr * 0.5);
  for (let i = 0; i < n; i++) {                                 // ouvrant : liseré noir qui encadre le verre, en retrait du dormant
    const a = x0 + cw * i + (i === 0 ? fr : fr / 2), c = x0 + cw * (i + 1) - (i === n - 1 ? fr : fr / 2);
    b.box(M.frame, a, y0 + fr, z - 0.026, c, y0 + fr + q, z + 0.026); b.box(M.frame, a, y1 - fr - q, z - 0.026, c, y1 - fr, z + 0.026);
    b.box(M.frame, a, y0 + fr + q, z - 0.026, a + q, y1 - fr - q, z + 0.026); b.box(M.frame, c - q, y0 + fr + q, z - 0.026, c, y1 - fr - q, z + 0.026);
  }
}

/* Chambranle profilé d'une porte, du côté sz (±1) : deux montants et une traverse, tableau de 7 cm. */
function casing(b, mat, w, H, t, sz) {
  const zb = sz * t / 2;
  for (const xd of [-1, 1]) b.sweep(mat, CASING.map(([a, e]) => [-sz * xd * a, e]), [xd * w / 2, 0, zb], [xd * w / 2, H + 0.058, zb], [-sz, 0, 0]);
  b.sweep(mat, CASING.map(([a, e]) => [-sz * e, a + 0.012]), [-w / 2 + 0.012, H - 0.012, zb], [w / 2 - 0.012, H - 0.012, zb]);
}

const JOINERY = {
  door(b, M, L, w, t, o, lv) {
    const H = o.head, s = L.s, hx = (o.hinge === 'a1' ? 1 : -1) * s * (w / 2 - 0.045), sw = (o.swing || 1) * L.z, ang = THREE.MathUtils.degToRad(o.open === undefined ? 86 : o.open);
    b.box(M.door, -w / 2, 0, -t / 2 - 0.004, -w / 2 + 0.045, H, t / 2 + 0.004); b.box(M.door, w / 2 - 0.045, 0, -t / 2 - 0.004, w / 2, H, t / 2 + 0.004);
    b.box(M.door, -w / 2, H - 0.045, -t / 2 - 0.004, w / 2, H, t / 2 + 0.004);
    b.box(M.steel, -w / 2 + 0.045, -0.03, -t / 2, w / 2 - 0.045, 0.007, t / 2);                 // barre de seuil
    for (const sz of [-1, 1]) {                                   // chambranles profilés des deux côtés
      casing(b, M.door, w, H, t, sz);
      const lx = (hx < 0 ? 1 : -1) * (w / 2 + 0.16);              // interrupteur côté béquille, à 1,10 m
      fixture(b, M, 'sw', lx, 1.1, sz * t / 2, sz > 0 ? 0 : PI);
    }
    const dir = hx < 0 ? 1 : -1, lw = w - 0.1;
    b.push(hx, 0, sw * (t / 2), dir * -ang * sw);
    b.box(M.door, 0, 0.008, -0.02, dir * lw, H - 0.05, 0.02);
    for (const sz of [-1, 1]) {                                   // béquille noire sur rosace, des deux côtés
      b.geo(M.black, new THREE.CylinderGeometry(0.026, 0.026, 0.008, 16), dir * (lw - 0.07), 1.02, sz * 0.024, Math.PI / 2, 0, 0);
      b.rod(M.black, [dir * (lw - 0.07), 1.02, sz * 0.024], [dir * (lw - 0.07), 1.02, sz * 0.06], 0.009, 8); b.rod(M.black, [dir * (lw - 0.07), 1.02, sz * 0.055], [dir * (lw - 0.2), 1.02, sz * 0.055], 0.009, 8);
      b.box(M.black, dir * (lw - 0.07) - 0.011, 0.9, sz * 0.02 - 0.0015, dir * (lw - 0.07) + 0.011, 0.97, sz * 0.02 + 0.0015);   // plaque de la serrure sur la tranche
    }
    for (const hy of [0.22, 1.05, H - 0.28]) b.cyl(M.black, 0, hy, 0, 0.009, 0.09, 8);   // paumelles
    b.pop();
  },
  entry(b, M, L, w, t, o) {
    const H = o.head;
    b.box(M.frame, -w / 2, 0, -t / 2, -w / 2 + 0.06, H, t / 2 - 0.1); b.box(M.frame, w / 2 - 0.06, 0, -t / 2, w / 2, H, t / 2 - 0.1); b.box(M.frame, -w / 2, H - 0.06, -t / 2, w / 2, H, t / 2 - 0.1);
    b.box(M.walnut, -w / 2 + 0.06, 0.005, -t / 2 + 0.03, w / 2 - 0.06, H - 0.06, -t / 2 + 0.09);
    for (let i = 1; i < 6; i++) b.box(M.black, -w / 2 + 0.06, (H / 6) * i, -t / 2 + 0.026, w / 2 - 0.06, (H / 6) * i + 0.006, -t / 2 + 0.03);
    b.box(M.brass, w / 2 - 0.2, 0.95, -t / 2 - 0.02, w / 2 - 0.17, 1.4, -t / 2 + 0.03);
    b.box(M.steel, -w / 2 + 0.06, -0.03, -t / 2, w / 2 - 0.06, 0.012, t / 2 - 0.1);             // seuil
    b.rod(M.brass, [0, 1.6, -t / 2 + 0.03], [0, 1.6, -t / 2 + 0.012], 0.011, 10); b.rod(M.steel, [0, 1.6, -t / 2 + 0.09], [0, 1.6, -t / 2 + 0.094], 0.007, 8);   // judas
  },
  french(b, M, L, w, t, o) {
    glazing(b, M, -w / 2, w / 2, o.sill, o.head, 2, t / 2 - 0.12);
    if (o.sill < 0.05) b.box(M.steel, -w / 2, -0.03, -t / 2, w / 2, 0.01, t / 2 - 0.03);        // seuil à rupture de pont thermique
    for (const sd of [-1, 1]) grip(b, M, 0, o.sill + 1.02, t / 2 - 0.12, sd);
    if (o.rail !== false) railing(b, M, -w / 2, t / 2 + 0.03, w / 2, t / 2 + 0.03, o.sill, 1.02);
    if (o.shutter) { const sd = (o.shutter === 'a1' ? 1 : -1) * L.s; shutter(b, M, sd > 0 ? w / 2 + 0.02 : -w / 2 - 0.02 - w, sd > 0 ? w / 2 + 0.02 + w : -w / 2 - 0.02, o.sill, o.head, t / 2 + 0.07); }
  },
  bay(b, M, L, w, t, o) {
    const n = o.panels || 3, pw = w / n, z = t / 2 - 0.13, y0 = o.sill, y1 = o.head;
    b.box(M.frame, -w / 2, y0, z - 0.07, w / 2, y0 + 0.03, z + 0.07); b.box(M.frame, -w / 2, y1 - 0.05, z - 0.07, w / 2, y1, z + 0.07);
    b.box(M.frame, -w / 2, y0, z - 0.07, -w / 2 + 0.05, y1, z + 0.07); b.box(M.frame, w / 2 - 0.05, y0, z - 0.07, w / 2, y1, z + 0.07);
    if (y0 < 0.05) b.box(M.steel, -w / 2, -0.03, -t / 2, w / 2, 0.01, t / 2 - 0.03);            // seuil
    for (let i = 0; i < n; i++) {
      let x0 = -w / 2 + i * pw; const zz = z + (i % 2 ? 0.03 : -0.03);
      if (o.open && i === n - 1) x0 -= pw * 0.86;                 // dernier vantail glissé : la baie est ouverte
      glazing(b, M, x0 + 0.01, x0 + pw - 0.01, y0 + 0.03, y1 - 0.05, 1, zz, 0.045);
      if (i === n - 1 || i === 0) for (const sd of [-1, 1]) b.box(M.black, x0 + (i ? 0.02 : pw - 0.075), y0 + 0.95, zz + sd * 0.036, x0 + (i ? 0.05 : pw - 0.045), y0 + 1.2, zz + sd * 0.043);   // cuvette-poignée
    }
    if (o.rail) railing(b, M, -w / 2, t / 2 + 0.03, w / 2, t / 2 + 0.03, o.sill, 1.02);
    if (o.shutter) { const sd = (o.shutter === 'a1' ? 1 : -1) * L.s, sw = Math.min(1.3, w / 2); shutter(b, M, sd > 0 ? w / 2 - sw : -w / 2, sd > 0 ? w / 2 : -w / 2 + sw, o.sill, o.head, t / 2 + 0.07); }
  },
  window(b, M, L, w, t, o) {
    glazing(b, M, -w / 2, w / 2, o.sill, o.head, w > 1 ? 2 : 1, t / 2 - 0.12);
    b.box(M.stucco, -w / 2 - 0.04, o.sill - 0.04, t / 2 - 0.1, w / 2 + 0.04, o.sill, t / 2 + 0.05);
    b.box(M.lacquer, -w / 2, o.sill - 0.02, -t / 2 - 0.02, w / 2, o.sill, t / 2 - 0.15);
    for (const sd of [-1, 1]) grip(b, M, w > 1 ? 0 : w / 2 - 0.08, o.sill + (o.head - o.sill) * 0.5, t / 2 - 0.12, sd);
  },
  glass(b, M, L, w, t, o) { glazing(b, M, -w / 2, w / 2, o.sill, o.head, Math.max(1, Math.round(w / 1.2)), 0, 0.03); },
  lift(b, M, L, w, t, o) {
    const H = o.head, z = -t / 2 * (o.face || 1);
    b.box(M.steel, -w / 2, 0, -t / 2, w / 2, H, t / 2);
    b.box(M.black, -0.004, 0, z - 0.004, 0.004, H, z + 0.004);
    b.box(M.frame, -w / 2 - 0.06, 0, z - 0.02, -w / 2, H + 0.06, z + 0.02); b.box(M.frame, w / 2, 0, z - 0.02, w / 2 + 0.06, H + 0.06, z + 0.02); b.box(M.frame, -w / 2 - 0.06, H, z - 0.02, w / 2 + 0.06, H + 0.06, z + 0.02);
    b.box(M.steel, w / 2 + 0.14, 1.0, z - 0.012, w / 2 + 0.22, 1.2, z + 0.012); b.box(M.led, w / 2 + 0.16, 1.12, z - 0.016, w / 2 + 0.2, 1.16, z + 0.016);
    b.box(M.screen, -0.14, H + 0.1, z - 0.012, 0.14, H + 0.2, z + 0.012);
  },
  /* Porte palière d'ascenseur, vantaux ouverts : on voit la cabine. */
  liftdoor(b, M, L, w, t, o) {
    const H = o.head;
    b.box(M.steel, -w / 2 - 0.07, 0, -t / 2 - 0.015, -w / 2, H + 0.07, t / 2 + 0.015); b.box(M.steel, w / 2, 0, -t / 2 - 0.015, w / 2 + 0.07, H + 0.07, t / 2 + 0.015); b.box(M.steel, -w / 2 - 0.07, H, -t / 2 - 0.015, w / 2 + 0.07, H + 0.07, t / 2 + 0.015);
    b.box(M.steel, -w / 2, 0, -0.012, -w / 2 + 0.1, H, 0.012); b.box(M.steel, w / 2 - 0.1, 0, -0.012, w / 2, H, 0.012);
    b.box(M.black, -w / 2 + 0.1, 0, -0.006, -w / 2 + 0.104, H, 0.006); b.box(M.black, w / 2 - 0.104, 0, -0.006, w / 2 - 0.1, H, 0.006);   // chants des vantaux
    b.box(M.steel, -w / 2, -0.03, -t / 2, w / 2, 0.006, t / 2);                                  // seuil
    for (const sz of [-1, 1]) {
      const z = sz * t / 2;
      b.box(M.steel, w / 2 + 0.12, 1.0, Math.min(z, z + sz * 0.012), w / 2 + 0.2, 1.2, Math.max(z, z + sz * 0.012));         // platine d'appel
      for (const by of [1.08, 1.13]) b.geo(M.led, new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 10), w / 2 + 0.16, by, z + sz * 0.014, PI / 2, 0, 0);
      b.box(M.screen, -0.14, H + 0.1, Math.min(z, z + sz * 0.012), 0.14, H + 0.19, Math.max(z, z + sz * 0.012));
    }
  },
  /* Porte coulissante en applique, dessinée ouverte : le vantail est rangé devant le mur, du côté `to` ('a0' | 'a1') de la baie,
     sur la face `side` (+1 : vers les coordonnées croissantes). Rail noir en tête, habillage chêne de la baie. */
  slide(b, M, L, w, t, o) {
    const H = o.head, dir = (o.to === 'a1' ? 1 : -1) * L.s, z = (o.side || 1) * L.z * (t / 2 + 0.024), xc = dir * (w - 0.04);
    b.box(M.door, -w / 2, 0, -t / 2 - 0.004, -w / 2 + 0.03, H, t / 2 + 0.004); b.box(M.door, w / 2 - 0.03, 0, -t / 2 - 0.004, w / 2, H, t / 2 + 0.004); b.box(M.door, -w / 2, H - 0.03, -t / 2 - 0.004, w / 2, H, t / 2 + 0.004);
    b.box(M.steel, -w / 2 + 0.03, -0.03, -t / 2, w / 2 - 0.03, 0.007, t / 2);                    // barre de seuil
    b.box(M.door, xc - w / 2 - 0.03, 0.01, z - 0.02, xc + w / 2 + 0.03, H + 0.02, z + 0.02);
    b.box(M.black, Math.min(-w / 2, xc - w / 2) - 0.05, H + 0.02, z - 0.025, Math.max(w / 2, xc + w / 2) + 0.05, H + 0.07, z + 0.025);
    const hx = xc - dir * (w / 2 - 0.06); for (const s of [-1, 1]) b.box(M.black, hx - 0.012, 0.9, z + s * 0.02 - 0.003, hx + 0.012, 1.15, z + s * 0.02 + 0.003);
  },
  pass() { },
};
const PASSABLE = (o) => o.kind === 'door' || o.kind === 'slide' || o.kind === 'pass' || o.kind === 'liftdoor' || (o.kind === 'bay' && !o.rail) || (o.kind === 'french' && o.rail === false);

/* Un mur : k = 'v' (le long de y, à l'abscisse c) ou 'h' (le long de x, à l'ordonnée c). ext = ±1 : côté extérieur. */
function buildWall(b, M, lv, w) {
  const y0 = lv.y, H = w.h || lv.h, t = w.t, L = lv.layer, top = L + ':top';
  const cut = Math.min(CUT, H);
  // repère local : x le long du mur, +z vers l'extérieur (ou vers les coordonnées croissantes pour une cloison)
  const zs = w.ext < 0 ? -1 : 1;
  const rot = w.k === 'h' ? (zs > 0 ? 0 : PI) : (zs > 0 ? PI / 2 : -PI / 2);
  const s = w.k === 'h' ? zs : -zs;                         // sens de x local par rapport à l'axe du plan
  const piece = (a0, a1, ya, yb) => {                       // boîte de mur entre deux abscisses et deux hauteurs
    if (a1 - a0 < 1e-3 || yb - ya < 1e-3) return;
    const seg = (lay, u0, u1) => {
      if (u1 - u0 < 1e-3) return;
      b.on(lay);
      const put = (mat, c0, c1) => { if (w.k === 'h') b.box(mat, a0, y0 + u0, c0, a1, y0 + u1, c1); else b.box(mat, c0, y0 + u0, a0, c1, y0 + u1, a1); };
      if (w.ext) {
        const inner = w.c - zs * t / 2, outer = w.c + zs * t / 2, mid = outer - zs * Math.max(0.02, Math.min(0.12, t - 0.1));   // enduit de 12 cm côté rue : les tableaux et les appuis intérieurs sont en plâtre
        put(M[w.lining || 'plaster'], Math.min(inner, mid), Math.max(inner, mid)); put(M[w.skin || 'stucco'], Math.min(mid, outer), Math.max(mid, outer));
      } else put(M[w.mat || 'plaster'], w.c - t / 2, w.c + t / 2);
    };
    seg(L, ya, Math.min(yb, cut)); seg(top, Math.max(ya, cut), yb);
    if (ya < cut && yb > cut) { b.on(L + ':cap'); if (w.k === 'h') b.box(M.wallCut, a0, y0 + cut, w.c - t / 2, a1, y0 + cut + 0.003, w.c + t / 2); else b.box(M.wallCut, w.c - t / 2, y0 + cut, a0, w.c + t / 2, y0 + cut + 0.003, a1); }
    const faces = w.ext ? [[w.c - zs * t / 2, -zs]] : [[w.c - t / 2, -1], [w.c + t / 2, 1]];            // faces vues : [coordonnée, côté de la pièce]
    if (ya === 0 && !w.mat && !w.noSkirt && a1 - a0 > 0.06) {
      b.on(L);
      for (const [c, d] of faces) { wallRun(b, M.skirt, SKIRT, w.k, a0, a1, c, d, y0); wallRun(b, M.seam, SKIRT_GAP, w.k, a0, a1, c, d, y0); lv.faces.push([w.k, c, d, a0, a1]); }
    }
    if (yb === H && H === lv.h && a1 - a0 > 0.02) {                                                  // joint creux en rive de plafond
      b.on(top);
      for (const [c, d] of faces) wallRun(b, M.concrete, CEIL_GAP, w.k, a0, a1, c, d, y0 + H - 0.014);
    }
  };
  const ops = (w.ops || []).slice().sort((p, q) => p.a0 - q.a0);
  let a = w.a0;
  for (const o of ops) {
    const sill = o.sill || 0, head = Math.min(o.head === undefined ? 2.15 : o.head, H);
    piece(a, o.a0, 0, H);
    piece(o.a0, o.a1, 0, sill); piece(o.a0, o.a1, head, H);
    a = o.a1;
    const mid = (o.a0 + o.a1) / 2, ww = o.a1 - o.a0;
    b.on(L);
    if (w.k === 'h') b.push(mid, y0, w.c, rot); else b.push(w.c, y0, mid, rot);
    if (o.kind === 'entry') lv.entries.push({ w, o, c: w.c - zs * t / 2, dir: -zs });
    (JOINERY[o.kind] || JOINERY.pass)(b, M, { s, z: zs }, ww, t, { ...o, sill, head }, lv);
    b.pop();
    if (!PASSABLE(o)) lv.blocks.push(w.k === 'h' ? [o.a0, w.c - t / 2, o.a1, w.c + t / 2] : [w.c - t / 2, o.a0, w.c + t / 2, o.a1]);
    if (w.ext && o.kind !== 'entry' && o.kind !== 'lift') {  // lumière du jour entrant par l'ouverture
      const inx = w.c - zs * (t / 2 + 0.55), p = w.k === 'h' ? [mid, inx] : [inx, mid];
      lv.dayLights.push({ pos: new THREE.Vector3(p[0], y0 + Math.min(head, 2.1) * 0.62, p[1]), power: Math.min(2.2, 0.5 + ww * (head - sill) * 0.2), layer: L });
    }
  }
  piece(a, w.a1, 0, H);
  // emprises pleines pour les collisions
  let p = w.a0;
  for (const o of ops) { if (o.a0 > p) lv.blocks.push(w.k === 'h' ? [p, w.c - t / 2, o.a0, w.c + t / 2] : [w.c - t / 2, p, w.c + t / 2, o.a0]); p = o.a1; }
  if (w.a1 > p) lv.blocks.push(w.k === 'h' ? [p, w.c - t / 2, w.a1, w.c + t / 2] : [w.c - t / 2, p, w.c + t / 2, w.a1]);
}

/* Escalier défini par la liste de ses marches (rectangles de plan, dans l'ordre de la montée).
   La dernière contremarche arrive au niveau supérieur. Les marches basses sont pleines, les hautes sont en console. */
export function buildStair(b, M, st, lv0) {
  const n = st.steps.length + 1, rise = st.H / n, y0 = lv0.y;
  const rect = (r) => typeof r[0] === 'number';                 // marche droite [x0, z0, x1, z1] ou marche balancée [[x, z], …]
  const c = (r) => rect(r) ? [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2] : [r.reduce((s, q) => s + q[0], 0) / r.length, r.reduce((s, q) => s + q[1], 0) / r.length];
  const poly = st.steps.map((r) => rect(r) ? [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]] : r);
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.012, edges = (pl) => pl.map((p, k) => [p, pl[(k + 1) % pl.length]]);
  const same = ([p, q], [r, s2]) => (near(p, r) && near(q, s2)) || (near(p, s2) && near(q, r));
  /* Arête avant (côté de la marche inférieure) : celle que la marche partage avec la précédente ; pour la première, l'arête opposée à celle qu'elle partage avec la suivante. */
  const front = (i) => {
    const pl = poly[i];
    if (i > 0) return edges(pl).find((e) => edges(poly[i - 1]).some((f) => same(e, f)));
    const back = edges(pl).find((e) => edges(poly[1]).some((f) => same(e, f)));
    if (!back) return null;
    const mx = (back[0][0] + back[1][0]) / 2, mz = (back[0][1] + back[1][1]) / 2;
    return edges(pl).reduce((best, e) => Math.hypot((e[0][0] + e[1][0]) / 2 - mx, (e[0][1] + e[1][1]) / 2 - mz) > Math.hypot((best[0][0] + best[1][0]) / 2 - mx, (best[0][1] + best[1][1]) / 2 - mz) ? e : best);
  };
  /* Polygone rogné de `d` mètres le long de l'arête e (demi-plan côté intérieur de la marche). */
  const inset = (pl, e, d) => {
    const [p, q] = e, L = Math.hypot(q[0] - p[0], q[1] - p[1]), cx = pl.reduce((a, v) => a + v[0], 0) / pl.length, cz = pl.reduce((a, v) => a + v[1], 0) / pl.length;
    let nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L; if ((cx - p[0]) * nx + (cz - p[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const dist = (v) => (v[0] - p[0]) * nx + (v[1] - p[1]) * nz - d, out = [];
    for (let k = 0; k < pl.length; k++) {
      const a = pl[k], bb = pl[(k + 1) % pl.length], da = dist(a), db = dist(bb);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t]); }
    }
    return { pts: out, nx, nz };
  };
  st.steps.forEach((r, i) => {
    const h = (i + 1) * rise, low = h <= CUT + 0.02, ya = y0 + (low ? 0 : h - rise - 0.1), e = front(i);
    b.on(low ? lv0.layer : lv0.layer + ':top');
    const ins = e && inset(poly[i], e, 0.015);                  // contremarche en retrait de 1,5 cm : le nez de la marche fait ombre
    if (ins && ins.pts.length >= 3) b.prism(M.plaster, ins.pts.map(([x, z]) => [x, z]), ya, y0 + h - 0.04);
    else if (rect(r)) b.box(M.plaster, r[0], ya, r[1], r[2], y0 + h - 0.04, r[3]); else b.prism(M.plaster, r, ya, y0 + h - 0.04);
    if (rect(r)) b.box(M.oak, r[0] - 0.012, y0 + h - 0.04, r[1] - 0.012, r[2] + 0.012, y0 + h, r[3] + 0.012); else b.prism(M.oak, r, y0 + h - 0.04, y0 + h);
    if (ins && ins.pts.length >= 3) {                           // ruban LED sous le nez, en saillie de 4 mm sur la contremarche
      const [p, q] = e, L = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L, a = 0.03, k = L - 0.03, d0 = 0.011, d1 = 0.015;
      const P = (u, d) => [p[0] + ux * u + ins.nx * d, p[1] + uz * u + ins.nz * d];
      if (k > a + 0.05) b.prism(M.led, [P(a, d0), P(k, d0), P(k, d1), P(a, d1)], y0 + h - 0.052, y0 + h - 0.045);
    }
  });
  /* Main courante fine sur le bord libre de l'escalier : un poteau noir au milieu de l'arête ouverte de chaque marche (rentré de 4,5 cm dans l'emprise), une lisse qui les relie. */
  const wallRects = (lv0.walls || []).map((w) => w.k === 'h' ? [w.a0, w.c - w.t / 2, w.a1, w.c + w.t / 2] : [w.c - w.t / 2, w.a0, w.c + w.t / 2, w.a1]).concat(st.core ? [st.core] : []);
  const inWall = (x, z) => wallRects.some((q) => x > q[0] - 0.12 && x < q[2] + 0.12 && z > q[1] - 0.12 && z < q[3] + 0.12);
  const posts = poly.map((pl, i) => {
    let best = null;
    for (const e of edges(pl)) {
      if ([i - 1, i + 1].some((j) => poly[j] && edges(poly[j]).some((f) => same(e, f)))) continue;
      const mx = (e[0][0] + e[1][0]) / 2, mz = (e[0][1] + e[1][1]) / 2, L = Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]);
      if (L < 0.3 || inWall(mx, mz) || (best && best.L >= L)) continue;
      best = { mx, mz, L, e };
    }
    if (!best) return null;
    const cx = pl.reduce((a, v) => a + v[0], 0) / pl.length, cz = pl.reduce((a, v) => a + v[1], 0) / pl.length, d = Math.hypot(cx - best.mx, cz - best.mz) || 1;
    return [best.mx + (cx - best.mx) / d * 0.045, best.mz + (cz - best.mz) / d * 0.045];
  });
  b.on(lv0.layer);
  const run = [];
  posts.forEach((p, i) => {
    if (!p || i > 7) return;
    const h = y0 + (i + 1) * rise;
    if (i % 2 === 0 || i === 7) b.rod(M.black, [p[0], h, p[1]], [p[0], h + 0.88, p[1]], 0.011, 6);
    run.push([p[0], h + 0.9, p[1]]);
  });
  if (run.length > 2) b.tube(M.black, run, 0.019, 8);
  if (st.core) {                                                // mur d'échiffre entre les volées, prolongé en garde-corps plein à l'étage
    const k = st.core;
    b.on(lv0.layer); b.box(M.plaster, k[0], y0, k[1], k[2], y0 + st.H, k[3]);
    for (const [kk, a0, a1, c, d] of [['h', k[0], k[2], k[1], -1], ['h', k[0], k[2], k[3], 1], ['v', k[1], k[3], k[0], -1], ['v', k[1], k[3], k[2], 1]]) { wallRun(b, M.skirt, SKIRT, kk, a0, a1, c, d, y0); wallRun(b, M.seam, SKIRT_GAP, kk, a0, a1, c, d, y0); }   // plinthe au pied du mur d'échiffre
    b.on('L1'); b.box(M.plaster, k[0], y0 + st.H, k[1], k[2], y0 + st.H + 1.0, k[3]); b.box(M.oak, k[0] - 0.01, y0 + st.H + 1.0, k[1] - 0.01, k[2] + 0.01, y0 + st.H + 1.03, k[3] + 0.01);
  }
  st.path = [[...st.foot, 0], [...st.trig0, 0], ...(st.line || st.steps.map(c)).map((p, i) => [p[0], p[1], (i + 1) * rise]), [...st.trig1, st.H], [...st.head, st.H]];
}

/* Cabine de l'ascenseur privatif, dessinée à chaque niveau : sol en pierre sombre, parois inox, miroir, main courante, plafonnier. */
export function buildLift(b, M, lift, levels) {
  const { x0, y0, x1, y1 } = lift;
  levels.forEach((lv) => {
    const y = lv.y, hc = 2.2;
    b.on(lv.layer);
    b.box(M.marbleDark, x0, y + 0.004, y0, x1, y + 0.016, y1);
    for (const [ax, az, bx, bz] of [[x0, y0, x0 + 0.02, y1], [x1 - 0.02, y0, x1, y1], [x0, y1 - 0.02, x1, y1]]) { b.box(M.steel, ax, y, az, bx, y + Math.min(hc, CUT), bz); b.on(lv.layer + ':top'); b.box(M.steel, ax, y + CUT, az, bx, y + hc, bz); b.on(lv.layer); }
    b.box(M.mirror, x0 + 0.12, y + 0.95, y1 - 0.03, x1 - 0.12, y + CUT, y1 - 0.021);
    // main courante en laiton sur trois parois, à 5 cm des parois
    const hy = y + 0.9, rr = 0.016, of = 0.07, zb = y1 - of, xa = x0 + of, xb = x1 - of;
    b.rod(M.brass, [xa - rr, hy, zb], [xb + rr, hy, zb], rr, 10); b.rod(M.brass, [xa, hy, zb], [xa, hy, y0 + 0.5], rr, 10); b.rod(M.brass, [xb, hy, zb], [xb, hy, y0 + 0.5], rr, 10);
    for (const [bx, bz] of [[xa, y0 + 0.5], [xb, y0 + 0.5], [(xa + xb) / 2, zb]]) b.rod(M.brass, [bx, hy, bz], [bx + (bx === xa ? -1 : bx === xb ? 1 : 0) * (of - 0.02), hy, bz + (bx !== xa && bx !== xb ? 1 : 0) * (of - 0.02)], 0.007, 6);
    // colonne de manœuvre : platine noire, afficheur, six boutons chromés à repère lumineux
    b.box(M.black, x1 - 0.026, y + 0.8, y0 + 0.06, x1 - 0.02, y + 1.46, y0 + 0.3); b.box(M.screen, x1 - 0.0285, y + 1.3, y0 + 0.09, x1 - 0.026, y + 1.42, y0 + 0.27);
    for (let i = 0; i < 6; i++) { const by = y + 1.18 - Math.floor(i / 2) * 0.12, bz = y0 + 0.12 + (i % 2) * 0.12; b.geo(M.steel, new THREE.CylinderGeometry(0.0105, 0.0105, 0.004, 10), x1 - 0.0285, by, bz, 0, 0, PI / 2); b.geo(M.led, new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 6), x1 - 0.0305, by, bz, 0, 0, PI / 2); }
    if (lift.door) b.box(M.steel, lift.door[0] - 0.45, y - 0.03, lift.door[1] + 0.1, lift.door[0] + 0.45, y + 0.006, y0);   // seuil entre la porte palière et la cabine
    b.on(lv.layer + ':top');
    b.box(M.mirror, x0 + 0.12, y + CUT, y1 - 0.03, x1 - 0.12, y + 2.0, y1 - 0.021);
    b.box(M.steel, x0, y + hc, y0, x1, y + hc + 0.04, y1); b.box(M.liftLight, x0 + 0.2, y + hc - 0.012, y0 + 0.3, x1 - 0.2, y + hc, y1 - 0.3);
    b.on(lv.layer); b.light((x0 + x1) / 2, y + 1.9, (y0 + y1) / 2, 0.7);
    lv.dayLights.push({ pos: new THREE.Vector3((x0 + x1) / 2, y + 1.8, (y0 + y1) / 2), power: 1.5, layer: lv.layer });
  });
}

/* Un niveau complet. Renvoie les informations de navigation (obstacles, pièces). */
export function buildLevel(b, M, lv, index) {
  lv.layer = 'L' + index; lv.blocks = []; lv.dayLights = []; lv.faces = []; lv.entries = [];
  const y0 = lv.y;
  b.cuts[lv.layer] = y0 + Math.min(CUT, lv.h);                 // menuiseries et mobilier sont sciés à la même cote que les murs
  b.on(lv.layer);
  for (const [mat, x0, z0, x1, z1] of lv.floors) b.slab(M[mat], x0, z0, x1, z1, y0 + (mat === 'floor' ? 0 : 0.004), mat === 'floor' ? 0.03 : 0.012);
  for (const s of lv.slabs || []) b.box(M.socle, s[0], y0 - (s[4] || 0.28), s[1], s[2], y0 - 0.03, s[3]);
  for (const w of lv.walls) buildWall(b, M, lv, w);
  lv.nWall = lv.blocks.length;                                  // les premiers obstacles sont les murs (utile aux contrôles)
  b.on(lv.layer + ':top');
  const spots = [];
  for (const c of lv.ceilings || []) {
    b.box(M.ceiling, c[0], y0 + lv.h, c[1], c[2], y0 + lv.h + 0.05, c[3]);
    // spots encastrés : collerette à bord tombé, source en retrait de 3 mm
    const nx = Math.max(1, Math.round((c[2] - c[0]) / 1.7)), nz = Math.max(1, Math.round((c[3] - c[1]) / 1.7));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const sx = c[0] + ((c[2] - c[0]) / nx) * (i + 0.5), sz = c[1] + ((c[3] - c[1]) / nz) * (j + 0.5); spots.push([sx, sz]);
      b.lathe(M.skirt, sx, y0 + lv.h, sz, [[0.037, -0.004], [0.037, -0.007], [0.057, -0.007], [0.057, 0]], 12); b.geo(M.led, new THREE.CircleGeometry(0.037, 12), sx, y0 + lv.h - 0.004, sz, PI / 2, 0, 0);
    }
  }
  // bouches de ventilation dans les pièces d'eau et la cuisine, détecteurs de fumée dans les dégagements : jamais sous un spot
  const inCeil = (x, z) => (lv.ceilings || []).some((c) => x > c[0] + 0.25 && x < c[2] - 0.25 && z > c[1] + 0.25 && z < c[3] - 0.25);
  for (const r of lv.rooms || []) {
    if (!r.at) continue;
    if (/^(couloir|buanderie|arriere|palier)$/.test(r.id)) {     // trappe de visite 40 × 40 : cadre en saillie de 3 mm, vantail en retrait de 4 mm de plus
      for (const [dx, dz] of [[-0.7, 0.55], [0.7, -0.55], [-0.7, -0.55], [0.7, 0.55], [0, 0.7], [0, -0.7]]) {
        const x = r.at[0] + dx, z = r.at[1] + dz;
        if (!inCeil(x, z) || !r.rs.some((q) => x > q[0] + 0.35 && x < q[2] - 0.35 && z > q[1] + 0.35 && z < q[3] - 0.35) || spots.some(([a, c]) => Math.hypot(a - x, c - z) < 0.45)) continue;
        b.box(M.concrete, x - 0.22, y0 + lv.h - 0.003, z - 0.22, x + 0.22, y0 + lv.h, z + 0.22); b.box(M.ceiling, x - 0.2, y0 + lv.h - 0.007, z - 0.2, x + 0.2, y0 + lv.h - 0.003, z + 0.2);
        break;
      }
    }
    const vent = /^(sdb|sde|wc|cuisine|arriere|buanderie|dressing)/.test(r.id), smoke = /^(couloir|entree|palier)$/.test(r.id);
    if (!vent && !smoke) continue;
    for (const [dx, dz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]]) {
      const x = r.at[0] + dx, z = r.at[1] + dz;
      if (!inCeil(x, z) || !r.rs.some((q) => x > q[0] + 0.3 && x < q[2] - 0.3 && z > q[1] + 0.3 && z < q[3] - 0.3) || spots.some(([a, c]) => Math.hypot(a - x, c - z) < 0.36)) continue;
      if (vent) { b.lathe(M.skirt, x, y0 + lv.h, z, [[1e-4, -0.012], [0.07, -0.012], [0.07, 0]], 14); b.geo(M.concrete, new THREE.CircleGeometry(0.048, 14), x, y0 + lv.h - 0.017, z, PI / 2, 0, 0); b.cyl(M.concrete, x, y0 + lv.h - 0.017, z, 0.006, 0.005, 6); }
      else { b.lathe(M.white, x, y0 + lv.h, z, [[1e-4, -0.03], [0.03, -0.028], [0.052, -0.012], [0.052, 0]], 14); b.cyl(M.led, x + 0.026, y0 + lv.h - 0.034, z, 0.0035, 0.004, 6); }
      break;
    }
  }
  for (const r of lv.rails || []) { b.on(r[5] ? lv.layer + ':top' : lv.layer); railing(b, M, r[0], r[1], r[2], r[3], y0 + (r[4] || 0)); lv.blocks.push([Math.min(r[0], r[2]) - 0.04, Math.min(r[1], r[3]) - 0.04, Math.max(r[0], r[2]) + 0.04, Math.max(r[1], r[3]) + 0.04]); }
  // mobilier : [type, x, y, rotation en degrés, options]
  const tall = [];                                              // meubles hauts (armoires, gaines, colonnes) : ils masquent un appareillage à 1,45 m
  for (const it of lv.items || []) {
    const [type, x, z, deg = 0, opt = {}] = it;
    const fn = F[type]; if (!fn) { console.warn('mobilier inconnu', type); continue; }
    b.on(opt.layer || (opt.high ? lv.layer + ':top' : lv.layer));
    const rot = THREE.MathUtils.degToRad(deg);
    b.push(x, y0 + (opt.y0 || 0), z, rot);
    const foot = fn(b, M, { ceil: lv.h, ...opt });
    b.pop();
    if (foot && !opt.ghost) {
      const rects = [[-foot[0] / 2, -foot[1] / 2, foot[0] / 2, foot[1] / 2]]; if (foot[2]) rects.push(foot[2]);
      const c = Math.cos(rot), sn = Math.sin(rot);
      for (const r of rects) {
        let ax = Infinity, az = Infinity, bx = -Infinity, bz = -Infinity;
        for (const [px, pz] of [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]]]) { const wx = x + px * c + pz * sn, wz = z - px * sn + pz * c; ax = Math.min(ax, wx); bx = Math.max(bx, wx); az = Math.min(az, wz); bz = Math.max(bz, wz); }
        lv.blocks.push([ax, az, bx, bz]);
        if (/^(wardrobe|duct|kitchenTall|kitchenRun|fridge|tvWall|shelves|boiler|acUnit)$/.test(type)) tall.push([ax, az, bx, bz]);
      }
    }
  }
  for (const r of lv.blockers || []) lv.blocks.push(r);
  // prises à 30 cm, une par pan de mur dégagé (jamais derrière un meuble relevé sur plan), thermostat dans le séjour
  { const solid = lv.blocks.slice(lv.nWall), free = (x, z, m) => !solid.some((q) => x > q[0] - m && x < q[2] + m && z > q[1] - m && z < q[3] + m);
    let therm = false;
    const clear = (x, z, m) => !tall.some((q) => x > q[0] - m && x < q[2] + m && z > q[1] - m && z < q[3] + m);
    for (const { w, o, c, dir } of lv.entries) {                // visiophone à côté de la porte palière, sur un pan de mur libre
      const mid = (o.a0 + o.a1) / 2, hw = (o.a1 - o.a0) / 2;
      for (const a of [mid + hw + 0.2, mid - hw - 0.2]) {
        const ok = a - 0.1 > w.a0 && a + 0.1 < w.a1 && !(w.ops || []).some((q) => a + 0.1 > q.a0 && a - 0.1 < q.a1), px = w.k === 'h' ? a : c + dir * 0.1, pz = w.k === 'h' ? c + dir * 0.1 : a;
        if (!ok || !clear(px, pz, 0.12)) continue;
        b.on(lv.layer); fixture(b, M, 'visio', w.k === 'h' ? a : c, y0 + 1.45, w.k === 'h' ? c : a, w.k === 'h' ? (dir > 0 ? 0 : PI) : (dir > 0 ? PI / 2 : -PI / 2));
        break;
      }
    }
    lv.faces.forEach(([k, c, d, a0, a1], i) => {
      const L = a1 - a0; if (L < 1.2) return;
      const a = a0 + L * (i % 2 ? 0.3 : 0.68), px = k === 'h' ? a : c + d * 0.1, pz = k === 'h' ? c + d * 0.1 : a, rot = k === 'h' ? (d > 0 ? 0 : PI) : (d > 0 ? PI / 2 : -PI / 2);
      if (!free(px, pz, 0.06)) return;
      b.on(lv.layer); fixture(b, M, 'sock', k === 'h' ? a : c, y0 + 0.3, k === 'h' ? c : a, rot);
      if (!therm && L > 1.6 && clear(px, pz, 0.1) && (lv.rooms || []).some((r) => /^(sejour|salon)$/.test(r.id) && r.rs.some((q) => px > q[0] && px < q[2] && pz > q[1] && pz < q[3]))) { therm = true; fixture(b, M, 'thermo', k === 'h' ? a : c, y0 + 1.45, k === 'h' ? c : a, rot); }
    });
  }
  // éclairage d'appoint de chaque pièce (spots allumés, comme sur les images) : plus soutenu dans les pièces sans fenêtre
  for (const r of lv.rooms || []) {
    if (r.id === 'jardin' || !r.at) continue;
    const lit = lv.dayLights.some((l) => r.rs.some((q) => l.pos.x > q[0] - 0.8 && l.pos.x < q[2] + 0.8 && l.pos.z > q[1] - 0.8 && l.pos.z < q[3] + 0.8));
    lv.dayLights.push({ pos: new THREE.Vector3(r.at[0], y0 + 2.0, r.at[1]), power: lit ? 0.8 : 2.2, layer: lv.layer });
  }
  b.on(lv.layer);
}

/* Grille de navigation d'un niveau : cellules libres = intérieur de la zone praticable, hors obstacles (dilatés du rayon du visiteur). */
export function buildNav(lv, seed, cell = 0.1, radius = 0.17) {
  const [x0, z0, x1, z1] = lv.bounds, nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const g = new Uint8Array(nx * nz);                              // 1 = libre
  for (const a of lv.walkable) {
    const i0 = Math.max(0, Math.ceil((a[0] + radius - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((a[2] - radius - x0) / cell));
    const j0 = Math.max(0, Math.ceil((a[1] + radius - z0) / cell)), j1 = Math.min(nz - 1, Math.floor((a[3] - radius - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * nx + i] = 1;
  }
  // les passages (portes, baies) relient les zones : on les rouvre avant de retirer les obstacles
  for (const a of lv.links || []) {
    const i0 = Math.max(0, Math.floor((a[0] - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((a[2] - x0) / cell));
    const j0 = Math.max(0, Math.floor((a[1] - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((a[3] - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * nx + i] = 1;
  }
  for (const r of lv.blocks) {
    const i0 = Math.max(0, Math.floor((r[0] - radius - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((r[2] + radius - x0) / cell) - 1);
    const j0 = Math.max(0, Math.floor((r[1] - radius - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((r[3] + radius - z0) / cell) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * nx + i] = 0;
  }
  if (seed) {
    let si = Math.floor((seed[0] - x0) / cell), sj = Math.floor((seed[1] - z0) / cell);
    if (!g[sj * nx + si]) { let best = -1, bd = 1e9; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (g[j * nx + i]) { const d = (i - si) ** 2 + (j - sj) ** 2; if (d < bd) { bd = d; best = j * nx + i; } } si = best % nx; sj = (best / nx) | 0; }
    const seen = new Uint8Array(nx * nz), stack = [sj * nx + si]; seen[stack[0]] = 1;
    while (stack.length) { const c = stack.pop(), ci = c % nx, cj = (c / nx) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; const n = j * nx + i; if (g[n] && !seen[n]) { seen[n] = 1; stack.push(n); } } }
    for (let n = 0; n < g.length; n++) if (g[n] && !seen[n]) g[n] = 0;
  }
  lv.nav = { g, nx, nz, x0, z0, cell };
  return lv.nav;
}
