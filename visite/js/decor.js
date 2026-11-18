/* 59 Cézanne — visite 3D : objets de vie (décor léger).
   Ces types complètent le catalogue F de furniture.js sans en refaire les meubles : cadres, étagères murales, patères et manteaux,
   console d'entrée, porte-parapluies, chaussures, paniers, miroir sur pied, plante à grandes feuilles, linge, objets posés sur
   les plans de travail et les meubles, accessoires de bain et de buanderie, lanternes et barbecue du jardin.
   Mêmes conventions que furniture.js : repère local au centre de l'emprise, au sol, face avant vers +z ; pour un objet mural,
   l'origine est sur le nu du mur et l'objet se développe vers +z. La valeur de retour est l'emprise [largeur, profondeur] qui
   sert d'obstacle à la navigation : tout ce qui est accroché au mur ou posé sur un meuble renvoie null pour ne pas fermer
   les passages. Tout est déterministe (graines fixes) et sobre en triangles : segments réduits, boîtes simples.
   Sobre aussi en appels de dessin : le Batch fusionne par (calque, matériau), si bien que chaque matériau nouveau dans un calque
   coûte un appel. Les objets reprennent donc les matériaux déjà présents (au-dessus de la coupe de 1,25 m surtout : cadres,
   étagères, manteaux), et chaque logement n'emploie que deux toiles. */
import * as THREE from 'three';
import { F } from 'v3d/furniture';
import { rng } from 'v3d/geo';

const PI = Math.PI;
const E = 0.002;                                   // jeu sous les objets : jamais de face dans le plan du sol ou du meuble porteur

/* Touffe de feuilles en petites cartes (même principe que furniture.js, en plus économe). */
function cards(b, mat, x, y, z, rad, n, size, R, squash = 1) {
  const pos = [], nor = [], uv = [], ax = new THREE.Vector3(), ay = new THREE.Vector3(), c = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * 6.283, rr = rad * Math.cbrt(0.15 + 0.85 * R()), s = Math.sqrt(1 - u * u);
    const dx = s * Math.cos(a), dy = u, dz = s * Math.sin(a);
    c.set(x + dx * rr, y + dy * rr * squash, z + dz * rr);
    ax.set(R() - 0.5, R() - 0.5, R() - 0.5).normalize(); ay.set(R() - 0.5, R() - 0.5, R() - 0.5).cross(ax).normalize();
    const h = size * (0.7 + R() * 0.6) / 2, nx = dx, ny = dy * 0.6 + 0.55, nz = dz, nl = Math.hypot(nx, ny, nz) || 1;
    const corner = (sx, sy) => { q.copy(c).addScaledVector(ax, sx * h).addScaledVector(ay, sy * h); pos.push(q.x, q.y, q.z); nor.push(nx / nl, ny / nl, nz / nl); uv.push((sx + 1) / 2, (sy + 1) / 2); };
    corner(-1, -1); corner(1, -1); corner(1, 1); corner(-1, -1); corner(1, 1); corner(-1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  b.add(mat, g);
}

/* Grande feuille (ficus lyrata) : losange légèrement creusé, deux faces, orienté selon (yaw, pitch). */
const leafGeo = (() => {
  const L = 1, W = 0.62, pts = [[0, 0, 0], [W * 0.5, 0.35 * L, 0.04], [W * 0.42, 0.75 * L, 0.02], [0, L, 0], [-W * 0.42, 0.75 * L, 0.02], [-W * 0.5, 0.35 * L, 0.04], [0, 0.5 * L, -0.03]];
  const t = [[0, 1, 6], [1, 2, 6], [2, 3, 6], [3, 4, 6], [4, 5, 6], [5, 0, 6]], pos = [];
  for (const [a, c, d] of t) pos.push(...pts[a], ...pts[c], ...pts[d]);
  for (const [a, c, d] of t) pos.push(...pts[a], ...pts[d], ...pts[c]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2); for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = pos[i * 3] + 0.5; uv[i * 2 + 1] = pos[i * 3 + 1]; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
})();
const bigLeaf = (b, mat, x, y, z, s, yaw, pitch) => b.geo(mat, leafGeo.clone(), x, y, z, pitch, yaw, 0, s, s, s);

/* Livres debout serrés entre x0 et x1, dos vers +z ; renvoie l'abscisse de fin. */
function bookRow(b, M, x0, x1, y, z, d, R) {
  const cols = ['cream', 'taupe', 'white', 'black', 'walnut'];      // reliures dans les matériaux déjà présents en partie haute
  let x = x0;
  while (x < x1 - 0.02) { const t = 0.018 + R() * 0.022, h = 0.17 + R() * 0.08; if (x + t > x1) break; b.box(M[cols[(R() * cols.length) | 0]], x, y, z - d / 2, x + t, y + h, z + d / 2 - R() * 0.02); x += t + 0.001; }
  return x;
}
/* Pile de livres à plat. */
function bookStack(b, M, x, y, z, n, w, d, R, rot = 0, cols = ['cream', 'charcoal', 'greige', 'sage']) {
  let yy = y;
  for (let i = 0; i < n; i++) { const th = 0.02 + R() * 0.015; b.cbox(M[cols[(R() * cols.length) | 0]], x, yy, z, w - i * 0.015, th, d - i * 0.01, 0, rot + (R() - 0.5) * 0.2); yy += th; }
  return yy;
}
/* Petit vase à col étroit. */
const vase = (b, m, x, y, z, s = 1) => b.lathe(m, x, y, z, [[0.035 * s, 0], [0.06 * s, 0.03 * s], [0.065 * s, 0.1 * s], [0.04 * s, 0.17 * s], [0.022 * s, 0.2 * s], [0.026 * s, 0.22 * s], [0.018 * s, 0.22 * s]], 12);
/* Coupe basse. */
const bowl = (b, m, x, y, z, r = 0.12) => b.lathe(m, x, y, z, [[r * 0.4, 0], [r * 0.8, r * 0.18], [r, r * 0.45], [r * 0.93, r * 0.45], [r * 0.72, r * 0.22], [0.001, r * 0.12]], 16);
/* Rameaux d'olivier dans un vase. */
function branches(b, M, x, y, z, h, R) {
  for (let i = 0; i < 4; i++) { const a = R() * 6.283, t = 0.2 + R() * 0.35, ex = x + Math.cos(a) * Math.sin(t) * h, ez = z + Math.sin(a) * Math.sin(t) * h, ey = y + Math.cos(t) * h; b.rod(M.walnut, [x, y, z], [ex, ey, ez], 0.003, 3); cards(b, M.leafOlive, (x + ex) / 2 + (ex - x) * 0.3, (y + ey) / 2 + (ey - y) * 0.3, (z + ez) / 2 + (ez - z) * 0.3, 0.07, 5, 0.12, R, 1.2); }
}

/* Petits objets posés : chaque genre dessine au point (0, 0, 0) du repère courant, posé à plat. */
const SMALL = {           // (b, M, mat) : mat = matériau principal facultatif
  /* machine à expresso : corps noir, façade inox, groupe, bac, deux tasses */
  coffee(b, M) {
    b.box(M.black, -0.13, E, -0.17, 0.13, 0.34, 0.115); b.box(M.steel, -0.125, 0.04, 0.119, 0.125, 0.33, 0.124);
    b.box(M.steel, -0.12, E, 0.1, 0.12, 0.03, 0.2); b.cyl(M.steel, 0, 0.21, 0.16, 0.035, 0.035, 10); b.rod(M.black, [0, 0.225, 0.19], [0, 0.23, 0.29], 0.008, 5);
    for (const sx of [-0.05, 0.05]) b.lathe(M.ceramic, sx, 0.032, 0.16, [[0.022, 0], [0.03, 0.006], [0.032, 0.05], [0.029, 0.05], [0.001, 0.008]], 10);
    b.cyl(M.steel, -0.07, 0.34, -0.05, 0.045, 0.015, 10);
  },
  /* trois bocaux en verre : pâtes, lentilles, café ; couvercles en chêne */
  jars(b, M) {
    for (const [x, h, fill] of [[-0.11, 0.24, 'cream'], [0, 0.19, 'ochre'], [0.1, 0.15, 'potDark']]) {
      b.cyl(M[fill], x, E + 0.004, 0, 0.044, h * 0.7, 10); b.cyl(M.crystal, x, E, 0, 0.05, h, 12); b.cyl(M.oak, x, E + h, 0, 0.052, 0.025, 12);
    }
  },
  /* coupe de fruits */
  fruit(b, M) {
    bowl(b, M.ceramic, 0, E, 0, 0.15);
    const R = rng(12); for (const [dx, dz, c, r] of [[-0.04, 0, 'ochre', 0.04], [0.05, 0.03, 'terra', 0.037], [0, -0.05, 'ochre', 0.038], [0.02, 0.06, 'sage', 0.034], [-0.03, 0.05, 'ochre', 0.035]]) b.sph(M[c], dx, 0.07 + R() * 0.012, dz, r, 1, 0.95, 1, 7);
  },
  /* planches à découper adossées au mur (z < 0), et un torchon plié */
  board(b, M) {
    b.geo(M.oak, new THREE.BoxGeometry(0.3, 0.42, 0.02), 0, 0.21 + E, -0.06, -0.12, 0, 0); b.geo(M.walnut, new THREE.BoxGeometry(0.22, 0.3, 0.018), 0.1, 0.15 + E, -0.03, -0.1, 0.05, 0);
    b.box(M.linen, -0.24, E, 0.02, -0.08, 0.02, 0.14);
  },
  /* huile d'olive et vinaigre sur un petit plateau */
  bottles(b, M) {
    b.cyl(M.oak, 0, E, 0, 0.11, 0.012, 14);
    b.lathe(M.crystal, -0.04, 0.014, 0, [[0.03, 0], [0.03, 0.17], [0.012, 0.22], [0.011, 0.26], [0.001, 0.26]], 10); b.cyl(M.ochre, -0.04, 0.018, 0, 0.026, 0.12, 8);
    b.lathe(M.potDark, 0.045, 0.014, 0.01, [[0.026, 0], [0.026, 0.13], [0.01, 0.18], [0.009, 0.21], [0.001, 0.21]], 10);
  },
  /* pile de livres d'art */
  books(b, M) { bookStack(b, M, 0, E, 0, 3, 0.3, 0.23, rng(5)); },
  /* vase céramique et rameaux d'olivier */
  vase(b, M) { vase(b, M.pot, 0, E, 0, 1.15); branches(b, M, 0, 0.22, 0, 0.32, rng(8)); },
  /* aromatiques en pot */
  herbs(b, M) { const R = rng(21); for (const x of [-0.07, 0.07]) { b.lathe(M.pot, x, E, 0, [[0.045, 0], [0.06, 0.1], [0.055, 0.1], [0.001, 0.09]], 10); cards(b, M.leafOlive, x, 0.16, 0, 0.07, 9, 0.07, R, 0.8); } },
  /* bougie dans un photophore en verre */
  candle(b, M) { b.cyl(M.cream, 0, E, 0, 0.032, 0.07, 10); b.cyl(M.led, 0, 0.072, 0, 0.002, 0.008, 3); b.lathe(M.crystal, 0, E, 0, [[0.045, 0], [0.05, 0.1], [0.046, 0.1], [0.001, 0.004]], 12); },
  /* vide-poche en céramique sombre, clés, lunettes */
  keys(b, M) {
    b.lathe(M.potDark, 0, E, 0, [[0.06, 0], [0.11, 0.012], [0.12, 0.03], [0.113, 0.03], [0.001, 0.014]], 16);
    b.ring(M.steel, -0.02, 0.022, 0.01, 0.014, 0.0025, 0, 0, 10, 3); b.box(M.steel, -0.005, 0.017, 0.0, 0.045, 0.021, 0.012); b.box(M.black, 0.01, 0.017, -0.05, 0.04, 0.023, -0.03);
    b.ring(M.black, 0.1, 0.012, 0.06, 0.022, 0.003, 0, 0, 10, 3); b.ring(M.black, 0.15, 0.012, 0.06, 0.022, 0.003, 0, 0, 10, 3); b.rod(M.black, [0.122, 0.012, 0.06], [0.128, 0.012, 0.06], 0.002, 3);
  },
  /* petite enceinte en tissu */
  speaker(b, M) { b.cbox(M.charcoal, 0, E, 0, 0.14, 0.2, 0.12, 0.02, 0, 1); b.cyl(M.black, 0, 0.2, 0, 0.03, 0.003, 8); },
  /* serviettes de toilette pliées */
  towels(b, M) { let y = E; for (const c of ['white', 'cream', 'white', 'cream']) { b.cbox(M[c], 0, y, 0, 0.3, 0.045, 0.22, 0.014, 0, 1); y += 0.047; } },
  /* flacons de soin */
  soap(b, M) { b.lathe(M.potDark, -0.03, E, 0, [[0.028, 0], [0.028, 0.13], [0.012, 0.15], [0.001, 0.15]], 10); b.cyl(M.black, -0.03, 0.15, 0, 0.006, 0.04, 5); b.lathe(M.pot, 0.04, E, 0.01, [[0.025, 0], [0.025, 0.1], [0.012, 0.12], [0.001, 0.12]], 10); },
  /* pull plié */
  sweater(b, M) { b.cbox(M.greige, 0, E, 0, 0.32, 0.05, 0.26, 0.022, 0, 1); b.cbox(M.sage, 0.02, 0.05, 0.01, 0.3, 0.04, 0.24, 0.018, 0.08, 1); },
  /* plaid plié en quatre */
  plaid(b, M, mat = 'throw') { b.cbox(M[mat], 0, E, 0, 0.42, 0.06, 0.3, 0.024, 0, 1); },
  /* cadre photo posé, légèrement incliné vers l'arrière */
  photo(b, M, mat = 'art4') { b.geo(M.brass, new THREE.BoxGeometry(0.16, 0.21, 0.012), 0, 0.105 + E, 0, -0.14, 0, 0); b.geo(M[mat], new THREE.BoxGeometry(0.12, 0.16, 0.004), 0, 0.107 + E, 0.0075, -0.14, 0, 0); },
  /* plateau laiton, carafe et verre */
  tray(b, M) { b.lathe(M.brass, 0, E, 0, [[0.001, 0], [0.15, 0], [0.155, 0.018], [0.148, 0.018], [0.001, 0.006]], 18); b.lathe(M.crystal, -0.04, 0.008, 0, [[0.05, 0], [0.055, 0.12], [0.022, 0.2], [0.024, 0.24], [0.001, 0.24]], 12); b.lathe(M.crystal, 0.07, 0.008, 0.03, [[0.028, 0], [0.032, 0.09], [0.001, 0.09]], 10); },
  /* rouleau de papier sur un support noir (WC) */
  paper(b, M) { b.box(M.black, -0.01, -0.06, 0, 0.01, 0.0, 0.04); b.rod(M.black, [0, -0.03, 0.04], [0.14, -0.03, 0.04], 0.004, 5); b.geo(M.white, new THREE.CylinderGeometry(0.055, 0.055, 0.1, 12), 0.08, -0.03, 0.065, 0, 0, PI / 2); },
};

Object.assign(F, {
  /* ── Murs ───────────────────────────────────────────────────────────── */
  /* Accrochage de cadres : set = [[x, y, l, h, toile, baguette], …] (centres sur le mur, en mètres). Baguette de 2 cm, marie-louise
     blanche, toile en avant de 4 mm : jamais deux faces de matériaux différents à moins de 3 mm. */
  frames(b, M, { set = [[0, 1.5, 0.6, 0.8, 'art1', 'black']] }) {
    for (const [x, y, w, h, art = 'art1', frame = 'black'] of set) {
      const f = 0.02, X = w / 2 + f, Z = h / 2 + f, z0 = 0.002, z1 = 0.034;
      b.box(M[frame], x - X, y - Z, z0, x + X, y - Z + f, z1); b.box(M[frame], x - X, y + Z - f, z0, x + X, y + Z, z1);
      b.box(M[frame], x - X, y - Z + f, z0, x - X + f, y + Z - f, z1); b.box(M[frame], x + X - f, y - Z + f, z0, x + X, y + Z - f, z1);
      b.box(M.white, x - w / 2, y - h / 2, 0.006, x + w / 2, y + h / 2, 0.024);
      const m = Math.min(0.05, w * 0.1);
      b.box(M[art], x - w / 2 + m, y - h / 2 + m, 0.028, x + w / 2 - m, y + h / 2 - m, 0.03);
    }
    return null;
  },
  /* Étagères murales flottantes en chêne : rangées de livres, vases, cadre posé ; kind = 'books' | 'laundry'. */
  wallShelf(b, M, { w = 1.2, d = 0.22, ys = [1.45, 1.8], mat = 'oak', kind = 'books', seed = 1, art = 'art4' }) {
    const R = rng(seed * 31 + Math.round(w * 10));
    ys.forEach((y, j) => {
      b.box(M[mat], -w / 2, y - 0.03, 0.002, w / 2, y, d);
      const top = y + E;
      if (kind === 'laundry') {                                                         // lessive, linge plié, panier
        for (let k = 0; k < 2; k++) b.lathe(k ? M.white : M.black, -w / 2 + 0.1 + k * 0.1, top, d / 2, [[0.04, 0], [0.042, 0.2], [0.03, 0.23], [0.015, 0.24], [0.015, 0.27], [0.001, 0.27]], 10);
        let yy = top; for (const c of ['white', 'taupe', 'white']) { b.box(M[c], -0.12, yy, 0.03, 0.18, yy + 0.05, d - 0.02); yy += 0.052; }
        if (w > 0.8) { yy = top; for (const c of ['taupe', 'white']) { b.box(M[c], w / 2 - 0.3, yy, 0.03, w / 2 - 0.05, yy + 0.06, d - 0.02); yy += 0.062; } }
        return;
      }
      const x1 = bookRow(b, M, -w / 2 + 0.03 + (j % 2) * 0.25, -w / 2 + w * (0.48 + R() * 0.12), top, d / 2, d - 0.05, R);
      if ((j + seed) % 2) { vase(b, R() < 0.5 ? M.white : M.black, x1 + 0.14, top, d / 2, 0.8); bookStack(b, M, w / 2 - 0.17, top, d / 2, 2, 0.22, 0.16, R, 0, ['cream', 'taupe', 'white']); }
      else { b.push(x1 + 0.17, top, 0.05, 0); SMALL.photo(b, M, art); b.pop(); b.lathe(M.white, w / 2 - 0.14, top, d / 2, [[0.05, 0], [0.065, 0.11], [0.06, 0.11], [0.001, 0.1]], 10); cards(b, M.leafCypress, w / 2 - 0.14, top + 0.17, d / 2, 0.08, 10, 0.08, R, 0.9); }
    });
    return null;
  },
  /* Tableau d'affichage tendu de lin, baguette de chêne, notes et photos punaisées. */
  pinboard(b, M, { w = 0.9, h = 0.6, y = 1.5, cloth = 'cream', art = 'art2' }) {
    b.box(M.oak, -w / 2 - 0.02, y - h / 2 - 0.02, 0.002, w / 2 + 0.02, y + h / 2 + 0.02, 0.022);
    b.box(M[cloth], -w / 2, y - h / 2, 0.022, w / 2, y + h / 2, 0.026);
    const R = rng(41);
    for (let i = 0; i < 7; i++) {
      const pw = 0.08 + R() * 0.1, ph = 0.06 + R() * 0.1, px = (R() - 0.5) * (w - pw - 0.05), py = y + (R() - 0.5) * (h - ph - 0.05), m = [M.white, M[art], M.white, M.taupe, M.white][i % 5];
      b.geo(m, new THREE.BoxGeometry(pw, ph, 0.001), px, py, 0.03 + (i % 2) * 0.0035, 0, 0, (R() - 0.5) * 0.15);
      b.sph(M.brass, px, py + ph / 2 - 0.012, 0.033 + (i % 2) * 0.0035, 0.006, 1, 1, 1, 5);
    }
    return null;
  },
  /* Patères en chêne : manteaux, sac de cuir. */
  hooks(b, M, { w = 0.8, y = 1.72, coats = ['taupe', 'taupe'], bag = false, bagMat = 'walnut' }) {
    b.box(M.oak, -w / 2, y - 0.05, 0.002, w / 2, y + 0.05, 0.024);
    const n = Math.max(3, Math.round(w / 0.18));
    for (let i = 0; i < n; i++) { const x = -w / 2 + 0.08 + ((w - 0.16) / (n - 1)) * i; b.rod(M.black, [x, y, 0.024], [x, y + 0.03, 0.09], 0.008, 6); }
    coats.forEach((c, i) => {                                                           // manteau : épaules arrondies, tombé évasé, col
      const x = -w / 2 + 0.08 + ((w - 0.16) / (n - 1)) * (i * 2 % n);
      b.geo(M[c], new THREE.CylinderGeometry(0.15, 0.24, 0.92, 12, 1), x, y - 0.56, 0.13, 0.05, 0, 0, 1, 1, 0.42);
      b.sph(M[c], x, y - 0.1, 0.12, 0.16, 1.05, 0.35, 0.5, 10);
      b.geo(M[c], new THREE.CylinderGeometry(0.05, 0.075, 0.08, 10, 1), x, y - 0.05, 0.1, 0, 0, 0, 1, 1, 0.6);
    });
    if (bag) { const x = w / 2 - 0.08; b.cbox(M[bagMat], x, y - 0.5, 0.06, 0.32, 0.3, 0.08, 0.02, 0, 1); b.tube(M[bagMat], [[x - 0.09, y - 0.2, 0.06], [x - 0.04, y + 0.0, 0.07], [x + 0.04, y + 0.0, 0.07], [x + 0.09, y - 0.2, 0.06]], 0.006, 4); }
    return null;
  },
  /* Chaussures rangées au pied d'un mur : set = [[x, z, rotation, matière], …] (une paire chacune). */
  shoes(b, M, { set = [[0, 0.15, 0, 'taupe']] }) {
    for (const [x, z, r, m] of set) {
      b.push(x, 0, z, r);
      for (const sx of [-0.055, 0.055]) { b.box(m === 'cream' ? M.white : M.black, sx - 0.04, E, -0.13, sx + 0.04, 0.02, 0.13); b.sph(M[m], sx, 0.035, -0.01, 0.05, 0.85, 0.55, 2.4, 8); b.sph(M[m], sx, 0.05, -0.08, 0.042, 0.95, 0.9, 1.1, 8); }
      b.pop();
    }
    return null;
  },

  /* ── Entrée ─────────────────────────────────────────────────────────── */
  /* Console murale en chêne à tiroir, vide-poche, lampe, livres ; miroir rond laiton au-dessus (mirror). */
  console(b, M, { w = 1.0, d = 0.3, h = 0.82, mat = 'oak', mirror = true, lamp = true }) {
    b.box(M[mat], -w / 2, h - 0.03, 0.002, w / 2, h, d);
    b.box(M[mat], -w / 2 + 0.02, h - 0.15, 0.002, w / 2 - 0.02, h - 0.03, d - 0.02); b.box(M.seam, -w / 2 + 0.03, h - 0.142, d - 0.0195, w / 2 - 0.03, h - 0.138, d - 0.018);
    for (const sx of [-1, 1]) b.box(M.black, sx * (w / 2 - 0.05) - 0.012, E, d - 0.07, sx * (w / 2 - 0.05) + 0.012, h - 0.15, d - 0.046);
    b.push(-w * 0.22, h, d * 0.55, 0.3); SMALL.keys(b, M); b.pop();
    if (lamp) { b.push(w * 0.3, 0, d * 0.5, 0); F.tableLamp(b, M, { y: h }); b.pop(); } else { b.push(w * 0.3, h, d * 0.5, 0); SMALL.vase(b, M); b.pop(); }
    bookStack(b, M, 0.02, h + E, d * 0.5, 2, 0.24, 0.18, rng(3), 0.2);
    if (mirror) { const r = Math.min(0.38, w * 0.4), my = h + 0.34 + r; b.geo(M.mirror, new THREE.CylinderGeometry(r, r, 0.008, 36), 0, my, 0.012, PI / 2, 0, 0); b.ring(M.brass, 0, my, 0.012, r, 0.01, PI / 2, 0, 36, 5); }
    return [w, d];
  },
  /* Porte-parapluies en métal sombre, deux parapluies. */
  umbrella(b, M, { }) {
    b.lathe(M.potDark, 0, 0, 0, [[0.1, 0], [0.11, 0.01], [0.11, 0.5], [0.105, 0.5], [0.105, 0.03], [0.001, 0.03]], 14);
    for (const [dx, dz, m, t] of [[-0.03, 0.02, 'black', 0.1], [0.035, -0.02, 'charcoal', -0.12]]) {
      b.geo(M[m], new THREE.ConeGeometry(0.035, 0.66, 8), dx + t * 0.3, 0.38, dz, 0, 0, t + PI);
      b.rod(M.black, [dx + t * 0.65, 0.7, dz], [dx + t * 0.75, 0.86, dz], 0.005, 4); b.tube(M.walnut, [[dx + t * 0.75, 0.86, dz], [dx + t * 0.75, 0.93, dz], [dx + t * 0.75 + 0.04, 0.95, dz], [dx + t * 0.75 + 0.06, 0.91, dz]], 0.009, 5);
    }
    return [0.24, 0.24];
  },

  /* ── Séjour, chambres ───────────────────────────────────────────────── */
  /* Ficus lyrata en pot : tige, grandes feuilles vernissées étagées. */
  fig(b, M, { h = 1.5, pot = 0.22, seed = 3, dark = false }) {
    const R = rng(seed), ph = pot * 1.4;
    b.lathe(dark ? M.potDark : M.pot, 0, 0, 0, [[pot * 0.7, 0], [pot * 0.9, 0.01], [pot, ph * 0.5], [pot, ph], [pot * 0.92, ph], [pot * 0.92, ph - 0.03], [0.001, ph - 0.03]], 16);
    b.cyl(M.potDark, 0, ph - 0.028, 0, pot * 0.9, 0.004, 14);
    const top = h - 0.1; b.tube(M.leafCypress, [[0, ph - 0.03, 0], [0.02, ph + (top - ph) * 0.4, 0.01], [-0.01, top, -0.02]], 0.014, 5);
    const n = Math.round(14 + h * 6);
    for (let i = 0; i < n; i++) {
      const t = 0.25 + 0.75 * (i / n), y = ph + (top - ph) * t, a = i * 2.4 + R() * 0.5, s = 0.2 + R() * 0.09, sp = 0.02 + (1 - t) * 0.05;
      bigLeaf(b, M.leafCypress, Math.cos(a) * sp, y, Math.sin(a) * sp, s, -a + PI / 2, 0.5 + R() * 0.7 + (1 - t) * 0.4);
    }
    return [pot * 2, pot * 2];
  },
  /* Panier en rotin : plaid roulé (fill 'throw'), linge ('linen') ou vide. */
  basket(b, M, { r = 0.21, h = 0.36, fill = 'throw' }) {
    b.lathe(M.rattan, 0, 0, 0, [[r * 0.85, 0], [r, h * 0.15], [r * 1.04, h], [r * 0.98, h], [r * 0.95, h * 0.2], [r * 0.82, 0.015], [0.001, 0.015]], 16);
    for (const sx of [-1, 1]) b.rod(M.rattan, [sx * r * 1.0, h - 0.03, 0], [sx * r * 1.0, h + 0.002, 0], 0.012, 4);
    if (fill === 'throw') { b.geo(M.throw, new THREE.CylinderGeometry(0.075, 0.075, r * 1.6, 12), -0.03, h + 0.02, 0.02, 0.35, 0.4, PI / 2 - 0.5); b.geo(M.greige, new THREE.CylinderGeometry(0.065, 0.065, r * 1.5, 12), 0.06, h - 0.01, -0.05, 0.1, -0.5, PI / 2 + 0.4); }
    else if (fill === 'linen') b.sph(M.white, 0, h - 0.02, 0, r * 0.9, 1, 0.45, 0.9, 10);
    return [2 * r + 0.04, 2 * r + 0.04];
  },
  /* Miroir sur pied posé contre le mur, cadre fin (chêne ou noir). */
  floorMirror(b, M, { w = 0.55, h = 1.75, frame = 'black' }) {
    const tilt = 0.07, base = h * Math.sin(tilt) + 0.04;
    b.push(0, 0, base, 0);
    const f = 0.025;
    for (const [x0, x1, y0, y1] of [[-w / 2, w / 2, 0, f], [-w / 2, w / 2, h - f, h], [-w / 2, -w / 2 + f, 0, h], [w / 2 - f, w / 2, 0, h]]) b.geo(M[frame], new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.03), (x0 + x1) / 2, (y0 + y1) / 2 * Math.cos(tilt) + E, -(y0 + y1) / 2 * Math.sin(tilt), -tilt, 0, 0);
    b.geo(M.mirror, new THREE.BoxGeometry(w - 2 * f, h - 2 * f, 0.006), 0, h / 2 * Math.cos(tilt) + E, -h / 2 * Math.sin(tilt) + 0.006, -tilt, 0, 0);
    b.pop();
    return [w + 0.04, 0.24];
  },
  /* Enceinte colonne en tissu sombre. */
  speakerTower(b, M, { h = 1.0 }) {
    b.box(M.walnut, -0.1, E, -0.12, 0.1, h, 0.11); b.box(M.charcoal, -0.095, 0.06, 0.11, 0.095, h - 0.02, 0.118);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.black, sx * 0.08, 0, sz * 0.09, 0.012, 0.012, 6);
    return [0.22, 0.25];
  },
  /* Objets posés sur un meuble ou un plan : set = [[genre, x, z, rotation], …] à la hauteur y (genres : voir SMALL). */
  objs(b, M, { y = 0.91, set = [] }) {
    for (const [k, x = 0, z = 0, r = 0, mat] of set) { const fn = SMALL[k]; if (!fn) continue; b.push(x, y, z, r); fn(b, M, mat); b.pop(); }
    return null;
  },

  /* ── Pièces d'eau, buanderie ────────────────────────────────────────── */
  /* Tapis de bain en coton bouclé, coins arrondis. */
  bathMat(b, M, { w = 0.8, d = 0.5, mat = 'cream' }) { b.cbox(M[mat], 0, 0.006, 0, w, 0.012, d, 0.005, 0, 1); return null; },
  /* Panier à linge en rotin à couvercle. */
  hamper(b, M, { r = 0.19, h = 0.55 }) {
    b.lathe(M.rattan, 0, 0, 0, [[r * 0.85, 0], [r, h * 0.2], [r, h], [r * 0.96, h], [r * 0.9, 0.015], [0.001, 0.015]], 14);
    b.lathe(M.rattan, 0, h, 0, [[r * 1.04, 0], [r * 1.04, 0.025], [r * 0.6, 0.045], [0.001, 0.05]], 14); b.cyl(M.oak, 0, h + 0.045, 0, 0.025, 0.02, 8);
    return [2 * r + 0.04, 2 * r + 0.04];
  },
  /* Tabouret de bain en teck à lattes. */
  bathStool(b, M, { h = 0.45 }) {
    for (let i = 0; i < 5; i++) b.box(M.oak, -0.17 + i * 0.07, h - 0.025, -0.15, -0.12 + i * 0.07, h, 0.15);
    for (const sx of [-1, 1]) { b.box(M.oak, sx * 0.15 - 0.02, E, -0.15, sx * 0.15 + 0.02, h - 0.025, -0.11); b.box(M.oak, sx * 0.15 - 0.02, E, 0.11, sx * 0.15 + 0.02, h - 0.025, 0.15); b.box(M.oak, sx * 0.15 - 0.015, 0.12, -0.11, sx * 0.15 + 0.015, 0.15, 0.11); }
    b.cbox(M.white, 0.02, h + E, 0, 0.26, 0.05, 0.2, 0.012, 0.15, 1);
    return [0.36, 0.32];
  },
  /* Planche à repasser repliée, adossée au mur. */
  ironing(b, M, { }) {
    const t = 0.08, L = 1.2;                                                       // reste sous la coupe de 1,25 m
    b.geo(M.linen, new THREE.BoxGeometry(0.36, L - 0.2, 0.03), 0, L / 2 - 0.1, 0.06, -t, 0, 0);
    b.geo(M.linen, new THREE.CylinderGeometry(0.18, 0.18, 0.03, 14, 1, false, -PI / 2, PI), 0, L - 0.2, 0.06 - (L - 0.2) * t * 0.5, PI / 2 - t, 0, 0, 1, 1, 0.9);
    for (const sx of [-1, 1]) b.rod(M.steel, [sx * 0.12, E, 0.12], [sx * 0.1, L - 0.25, 0.05], 0.009, 5);
    return [0.42, 0.18];
  },

  /* ── Jardin, terrasses ──────────────────────────────────────────────── */
  /* Lanterne en métal sombre ajouré, grosse bougie blanche (pas de vitrage : un matériau de moins dans le calque du jardin). */
  lantern(b, M, { h = 0.5 }) {
    const s = 0.11;
    b.box(M.frame, -s, E, -s, s, 0.03, s); b.box(M.frame, -s - 0.01, h - 0.04, -s - 0.01, s + 0.01, h - 0.02, s + 0.01);
    b.geo(M.frame, new THREE.ConeGeometry(s * 1.35, 0.08, 4), 0, h + 0.02, 0, 0, PI / 4, 0); b.ring(M.frame, 0, h + 0.1, 0, 0.03, 0.005, PI / 2, 0, 10, 3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.frame, sx * s - 0.008, 0.03, sz * s - 0.008, sx * s + 0.008, h - 0.04, sz * s + 0.008);
    for (const y of [0.03, h - 0.06]) for (const sz of [-1, 1]) { b.box(M.frame, -s, y, sz * s - 0.006, s, y + 0.012, sz * s + 0.006); b.box(M.frame, sz * s - 0.006, y, -s, sz * s + 0.006, y + 0.012, s); }
    b.cyl(M.white, 0, 0.03, 0, 0.05, 0.16, 12);
    return [0.25, 0.25];
  },
  /* Arrosoir en aluminium sombre. */
  wateringCan(b, M, { }) {
    b.cyl(M.frame, 0, E, 0, 0.1, 0.24, 14, 0.085);
    b.rod(M.frame, [0.07, 0.06, 0], [0.32, 0.3, 0], 0.012, 6, 0.008); b.cyl(M.frame, 0.32, 0.3, 0, 0.022, 0.02, 8);
    b.tube(M.frame, [[-0.08, 0.2, 0], [-0.09, 0.33, 0], [0.04, 0.34, 0], [0.06, 0.24, 0]], 0.009, 5);
    return null;
  },
  /* Barbecue à couvercle sur trépied, noir mat. */
  bbq(b, M, { }) {
    b.geo(M.frame, new THREE.SphereGeometry(0.29, 16, 6, 0, PI * 2, PI / 2, PI / 2), 0, 0.72, 0);
    b.geo(M.frame, new THREE.SphereGeometry(0.295, 16, 6, 0, PI * 2, 0, PI / 2.3), 0, 0.73, 0, 0.05, 0, 0); b.cyl(M.teak, 0, 1.0, 0.0, 0.03, 0.03, 8);
    b.ring(M.frame, 0, 0.72, 0, 0.3, 0.006, 0, 0, 24, 3);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; b.rod(M.frame, [Math.sin(a) * 0.15, 0.5, Math.cos(a) * 0.15], [Math.sin(a) * 0.3, 0.02, Math.cos(a) * 0.3], 0.012, 5); }
    b.geo(M.frame, new THREE.CylinderGeometry(0.2, 0.2, 0.01, 3), 0, 0.22, 0, 0, 0.5, 0);
    return [0.62, 0.62];
  },
});

export const DECOR = Object.keys(SMALL);
