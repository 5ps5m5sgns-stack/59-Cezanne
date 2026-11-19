/* 59 Cézanne — visite 3D : assemblage de la géométrie.
   Toutes les pièces statiques passent par un « Batch » : une géométrie fusionnée par couple (calque, matériau),
   pour garder peu d'appels de dessin. Les coordonnées de plan (x, y) deviennent (x, z) en 3D, y vers le haut. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function clean(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  return g;
}

/* UV « monde » : la texture se répète tous les `scale` mètres, quelle que soit la taille de la pièce. */
function worldUV(geo, scale, swap) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    if (swap) uv.setXY(i, v / scale, u / scale); else uv.setXY(i, u / scale, v / scale);
  }
  uv.needsUpdate = true;
}

/* Réindexation après fusion : les primitives arrivent dé-indexées (trois sommets par triangle, pour pouvoir les couper et les
   fusionner librement) ; ici, les sommets strictement identiques (position, normale et coordonnées de texture au bit près) sont
   mis en commun. Mêmes triangles, dans le même ordre, mêmes valeurs : l'image ne change pas, mais la carte graphique transforme
   deux à trois fois moins de sommets et la mémoire des géométries diminue d'autant. Table de hachage ouverte sur les bits des
   huit flottants : quelques dizaines de millisecondes pour un logement entier, là où une clé texte par sommet en coûterait des centaines. */
export function weld(geo) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv.array, n = P.length / 3;
  if (n < 6 || !(P instanceof Float32Array && N instanceof Float32Array && U instanceof Float32Array)) return geo;
  const pb = new Uint32Array(P.buffer, P.byteOffset, n * 3), nb = new Uint32Array(N.buffer, N.byteOffset, n * 3), ub = new Uint32Array(U.buffer, U.byteOffset, n * 2);
  let cap = 1024; while (cap < n * 2) cap *= 2;
  const mask = cap - 1, table = new Int32Array(cap).fill(-1), first = new Uint32Array(n), index = new Uint32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const a = i * 3, c = i * 2;
    let h = 0x811c9dc5;
    h = Math.imul(h ^ pb[a], 0x01000193); h = Math.imul(h ^ pb[a + 1], 0x01000193); h = Math.imul(h ^ pb[a + 2], 0x01000193);
    h = Math.imul(h ^ nb[a], 0x01000193); h = Math.imul(h ^ nb[a + 1], 0x01000193); h = Math.imul(h ^ nb[a + 2], 0x01000193);
    h = Math.imul(h ^ ub[c], 0x01000193); h = Math.imul(h ^ ub[c + 1], 0x01000193);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    let s = h & mask, j;
    for (;;) {
      j = table[s];
      if (j < 0) { table[s] = m; first[m] = i; index[i] = m++; break; }
      const f = first[j], fa = f * 3, fc = f * 2;
      if (pb[fa] === pb[a] && pb[fa + 1] === pb[a + 1] && pb[fa + 2] === pb[a + 2] && nb[fa] === nb[a] && nb[fa + 1] === nb[a + 1] && nb[fa + 2] === nb[a + 2] && ub[fc] === ub[c] && ub[fc + 1] === ub[c + 1]) { index[i] = j; break; }
      s = (s + 1) & mask;
    }
  }
  if (m > n * 0.9) return geo;                                    // presque rien à mettre en commun : on garde la forme simple
  const p2 = new Float32Array(m * 3), n2 = new Float32Array(m * 3), u2 = new Float32Array(m * 2);
  for (let k = 0; k < m; k++) { const f = first[k]; p2.set(P.subarray(f * 3, f * 3 + 3), k * 3); n2.set(N.subarray(f * 3, f * 3 + 3), k * 3); u2.set(U.subarray(f * 2, f * 2 + 2), k * 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p2, 3)); g.setAttribute('normal', new THREE.BufferAttribute(n2, 3)); g.setAttribute('uv', new THREE.BufferAttribute(u2, 2));
  g.setIndex(new THREE.BufferAttribute(m > 65535 ? index : Uint16Array.from(index), 1));
  return g;
}

/* Coupe horizontale d'une géométrie à la cote y : renvoie [dessous, dessus, face de coupe]. Les triangles traversés sont recoupés ;
   un solide convexe (boîte, cylindre, coussin…) reçoit une face de coupe pleine, comme une maquette sciée net. */
function splitY(g, y, solid) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, n = P.length / 9;
  const lo = [[], [], []], hi = [[], [], []], cap = [[], [], []], ring = [];
  const V = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], U[i * 2], U[i * 2 + 1]];
  /* Point de coupe d'une arête, toujours calculé depuis la même extrémité (la plus basse) : deux triangles voisins parcourent
     leur arête commune en sens inverse et, sans cela, obtiendraient deux points différents au dernier bit près — une fente
     d'un pixel s'ouvrait entre le dessous et le dessus, et laissait voir la face de coupe éclairée par-dessus. */
  const mix = (a, b) => { if (a[1] > b[1] || (a[1] === b[1] && (a[0] > b[0] || (a[0] === b[0] && a[2] > b[2])))) [a, b] = [b, a]; const t = (y - a[1]) / (b[1] - a[1]), r = a.map((v, k) => v + (b[k] - v) * t); r[1] = y; return r; };
  const emit = (dst, poly) => { for (let k = 1; k < poly.length - 1; k++) for (const v of [poly[0], poly[k], poly[k + 1]]) { dst[0].push(v[0], v[1], v[2]); dst[1].push(v[3], v[4], v[5]); dst[2].push(v[6], v[7]); } };
  for (let t = 0; t < n; t++) {
    const tri = [V(t * 3), V(t * 3 + 1), V(t * 3 + 2)], up = tri.map((v) => v[1] > y), c = up[0] + up[1] + up[2];
    if (c === 0) { emit(lo, tri); continue; }
    if (c === 3) { emit(hi, tri); continue; }
    const pl = [], ph = [];
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      (up[k] ? ph : pl).push(a);
      if (up[k] !== up[(k + 1) % 3]) { const m = mix(a, b); pl.push(m); ph.push(m); ring.push(m); }
    }
    emit(lo, pl); emit(hi, ph);
  }
  if (solid && ring.length >= 3) {                                // face de coupe : éventail autour du centre du contour
    let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[2]; } cx /= ring.length; cz /= ring.length;
    ring.sort((a, b) => Math.atan2(a[2] - cz, a[0] - cx) - Math.atan2(b[2] - cz, b[0] - cx));
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      cap[0].push(cx, y, cz, b[0], y, b[2], a[0], y, a[2]); cap[1].push(0, 1, 0, 0, 1, 0, 0, 1, 0); cap[2].push(0.5, 0.5, b[6], b[7], a[6], a[7]);
    }
  }
  const mk = (d) => { if (!d[0].length) return null; const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(d[0], 3)); q.setAttribute('normal', new THREE.Float32BufferAttribute(d[1], 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(d[2], 2)); return q; };
  return [mk(lo), mk(hi), mk(cap)];
}

/* Tuiles d'un grand maillage étalé sur tout le site (abords vus des baies) : les triangles sont regroupés par cases de `size` mètres
   (les cases trop maigres rejoignent leur voisine la plus proche), chaque case devenant une plage contiguë du maillage.
   Renvoie les plages [{ start, count }] en triangles, ou null s'il n'y a qu'une case. La géométrie est réordonnée sur place. */
function sortTiles(geo, size) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv.array, n = P.length / 9;
  const cell = new Int32Array(n), keys = new Map();
  for (let t = 0; t < n; t++) {
    const o = t * 9, cx = Math.floor((P[o] + P[o + 3] + P[o + 6]) / 3 / size), cz = Math.floor((P[o + 2] + P[o + 5] + P[o + 8]) / 3 / size), k = cx * 4096 + cz;
    let c = keys.get(k); if (!c) keys.set(k, (c = { k, x: cx, z: cz, n: 0 })); c.n++; cell[t] = k;
  }
  if (keys.size < 2) return null;
  const all = [...keys.values()], big = all.filter((c) => c.n >= Math.max(300, n * 0.04));
  if (big.length < 2) return null;
  const to = new Map(); for (const c of all) to.set(c.k, c.n >= Math.max(300, n * 0.04) ? c : big.reduce((a, b) => ((b.x - c.x) ** 2 + (b.z - c.z) ** 2 < (a.x - c.x) ** 2 + (a.z - c.z) ** 2 ? b : a)));
  big.sort((a, b) => a.x - b.x || a.z - b.z); big.forEach((c, i) => { c.i = i; c.m = 0; });
  for (let t = 0; t < n; t++) to.get(cell[t]).m++;
  const at = new Int32Array(big.length); let acc = 0; const ranges = big.map((c, i) => { at[i] = acc; const r = { start: acc, count: c.m }; acc += c.m; return r; });
  const P2 = new Float32Array(P.length), N2 = new Float32Array(N.length), U2 = new Float32Array(U.length);
  for (let t = 0; t < n; t++) { const d = at[to.get(cell[t]).i]++; P2.set(P.subarray(t * 9, t * 9 + 9), d * 9); N2.set(N.subarray(t * 9, t * 9 + 9), d * 9); U2.set(U.subarray(t * 6, t * 6 + 6), d * 6); }
  P.set(P2); N.set(N2); U.set(U2);
  return ranges;
}
/* Sphère englobante d'une plage de triangles (indices start·3 à (start + count)·3). */
function rangeSphere(geo, start, count) {
  const P = geo.attributes.position, I = geo.index, box = new THREE.Box3(), v = new THREE.Vector3();
  const vi = (k) => (I ? I.getX(k) : k);
  for (let k = start * 3; k < (start + count) * 3; k++) box.expandByPoint(v.fromBufferAttribute(P, vi(k)));
  const sp = new THREE.Sphere(); box.getCenter(sp.center); let r2 = 0;
  for (let k = start * 3; k < (start + count) * 3; k++) r2 = Math.max(r2, sp.center.distanceToSquared(v.fromBufferAttribute(P, vi(k))));
  sp.radius = Math.sqrt(r2); return sp;
}

export class Batch {
  /* cuts : calque → cote de coupe. Tout ce qui est ajouté à ce calque est partagé à cette cote : le dessous y reste, le dessus va dans « calque:top ». */
  constructor() { this.items = new Map(); this.layer = 'L0'; this.frame = new THREE.Matrix4(); this.stack = []; this.lights = []; this.cuts = {}; this.tiles = {}; }
  /* tiles : calque → { size, min } ; ses maillages d'au moins `min` triangles reçoivent en plus des tuiles (voir build). */

  /* Point lumineux (lampe, suspension, ruban LED) : mémorisé en coordonnées de l'appartement, allumé le soir. */
  light(x, y, z, power = 1, kind = 'lamp') {
    this.lights.push({ pos: new THREE.Vector3(x, y, z).applyMatrix4(this.frame), power, kind, layer: this.layer });
    return this;
  }

  /* Repère local : translation (x, y, z) puis rotation autour de la verticale (radians, sens trigonométrique vu de dessus). */
  push(x = 0, y = 0, z = 0, rot = 0) {
    this.stack.push(this.frame.clone());
    _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(Y, rot), _s.set(1, 1, 1));
    this.frame.multiply(_m);
    return this;
  }
  pop() { this.frame.copy(this.stack.pop()); return this; }
  on(layer) { this.layer = layer; return this; }

  add(mat, geo, local, solid = false) {
    const g = clean(geo);
    const M = local ? this.frame.clone().multiply(local) : this.frame;
    g.applyMatrix4(M);
    const cy = this.cuts[this.layer];
    if (cy !== undefined) {
      g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
      if (y0 >= cy - 1e-4) return this.put(this.layer + ':top', mat, g);
      if (y1 > cy + 1e-4) {
        if (cy - y0 < 0.3 && cy - y0 < 0.35 * (y1 - y0)) return this.put(this.layer + ':top', mat, g);   // il n'en resterait qu'un moignon (tableau, miroir, écran) : tout passe au-dessus
        const [lo, hi, cap] = splitY(g, cy, solid && !mat.transparent);   // pas de face de coupe dans un vitrage : elle se verrait par transparence
        if (lo) this.put(this.layer, mat, lo);
        if (hi) this.put(this.layer + ':top', mat, hi);
        /* La face de coupe ne sert qu'à la maquette sciée : rangée dans « calque:cap », affiché seulement quand le dessus est masqué.
           Laissée avec le dessous, elle restait dessinée en promenade, à fleur de l'arête de coupe : un trait clair (face horizontale
           éclairée d'en haut) apparaissait à 1,25 m sur les portes et les meubles hauts. */
        if (cap) this.put(this.layer + ':cap', mat, cap);
        return this;
      }
    }
    return this.put(this.layer, mat, g);
  }
  put(layer, mat, g) {
    const key = layer + '|' + mat.uuid;
    let it = this.items.get(key);
    if (!it) { it = { layer, mat, geos: [] }; this.items.set(key, it); }
    it.geos.push(g);
    return this;
  }

  /* Boîte par ses coins opposés (repère local). */
  /* skip : 'top' et/ou 'bottom' pour omettre la face haute ou basse (faces internes d'un empilement, qui marquaient le joint d'ombres). */
  box(mat, x0, y0, z0, x1, y1, z1, skip = '') {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    if (w < 1e-4 || h < 1e-4 || d < 1e-4) return this;
    /* Sommets posés exactement sur les cotes demandées (et non centre ± demi-côté) : deux boîtes empilées, comme le bas et le haut
       d'un mur scié à la cote de coupe, partagent alors leur arête au bit près, sans fente claire entre elles. */
    const g = new THREE.BoxGeometry(w, h, d), P = g.attributes.position;
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1), za = Math.min(z0, z1), zb = Math.max(z0, z1);
    for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) < 0 ? xa : xb, P.getY(i) < 0 ? ya : yb, P.getZ(i) < 0 ? za : zb);
    if (skip) { const I = g.index.array, keep = []; for (const gr of g.groups) if (!((gr.materialIndex === 2 && skip.includes('top')) || (gr.materialIndex === 3 && skip.includes('bottom')))) for (let k = gr.start; k < gr.start + gr.count; k++) keep.push(I[k]); g.setIndex(keep); }
    return this.add(mat, g, null, !skip);
  }
  /* Boîte centrée en (cx, cz), posée à la hauteur y0, de dimensions (w, h, d) ; r = rayon d'arrondi. */
  cbox(mat, cx, y0, cz, w, h, d, r = 0, rot = 0, seg = 2) {
    const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)) : new THREE.BoxGeometry(w, h, d);
    const M = new THREE.Matrix4().compose(new THREE.Vector3(cx, y0 + h / 2, cz), new THREE.Quaternion().setFromAxisAngle(Y, rot), new THREE.Vector3(1, 1, 1));
    return this.add(mat, geo, M, true);
  }
  cyl(mat, cx, y0, cz, r, h, seg = 20, rTop = r) {
    _m.makeTranslation(cx, y0 + h / 2, cz);
    return this.add(mat, new THREE.CylinderGeometry(rTop, r, h, seg), _m.clone(), true);
  }
  sph(mat, cx, cy, cz, r, sx = 1, sy = 1, sz = 1, seg = 14) {
    const M = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    return this.add(mat, new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), M, true);
  }
  /* Solide de révolution autour de la verticale : pts = [[rayon, hauteur], …] du bas vers le haut (faces tournées vers l'extérieur). */
  lathe(mat, cx, y0, cz, pts, seg = 20, a0 = 0, len = Math.PI * 2) {
    _m.makeTranslation(cx, y0, cz);
    return this.add(mat, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg, a0, len), _m.clone());
  }
  /* Barre droite entre deux points (pieds, montants, câbles) ; r2 = rayon à l'arrivée. */
  rod(mat, a, c, r = 0.01, seg = 8, r2 = r) {
    const va = new THREE.Vector3(...a), vc = new THREE.Vector3(...c), d = vc.clone().sub(va), len = d.length();
    if (len < 1e-4) return this;
    const M = new THREE.Matrix4().compose(va.clone().add(vc).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), new THREE.Vector3(1, 1, 1));
    return this.add(mat, new THREE.CylinderGeometry(r2, r, len, seg), M, true);
  }
  /* Tube le long d'une courbe lissée passant par pts = [[x, y, z], …]. */
  tube(mat, pts, r = 0.01, seg = 6, closed = false) {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), closed, 'catmullrom', 0.5);
    return this.add(mat, new THREE.TubeGeometry(curve, Math.max(4, pts.length * 5), r, seg, closed));
  }
  /* Anneau (tore) : à plat par défaut ; rx, rz = inclinaisons. */
  ring(mat, cx, cy, cz, R, r, rx = 0, rz = 0, seg = 44, tube = 8) {
    const M = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + rx, 0, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    return this.add(mat, new THREE.TorusGeometry(R, r, tube, seg), M);
  }
  /* Géométrie quelconque avec matrice locale. */
  geo(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const M = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    return this.add(mat, geo, M, /^(Box|Cylinder|Sphere)Geometry$/.test(geo.type) && !(geo.parameters && geo.parameters.openEnded));
  }
  /* Prisme droit sur un polygone de plan pts = [[x, z], …], entre les cotes y0 et y1 (marches balancées, dallages biais). */
  prism(mat, pts, y0, y1) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: y1 - y0, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    return this.add(mat, g, null, true);
  }
  /* Profil extrudé : le polygone pts = [[u, v], …] est balayé le long du segment a → c ([x, y, z] dans le repère local).
     u va vers `n` (perpendiculaire au segment, par défaut à droite dans le plan horizontal), v vers d × n : vers le haut quand le
     segment est horizontal. Sert aux plinthes chanfreinées, chambranles, moulures et nez de marche. `solid` : face de coupe pleine (profil convexe). */
  sweep(mat, pts, a, c, n = null, solid = true) {
    const va = new THREE.Vector3(...a), d = new THREE.Vector3(...c).sub(va), len = d.length();
    if (len < 1e-4) return this;
    d.normalize();
    const nn = n ? new THREE.Vector3(...n) : (Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(d.z, 0, -d.x));
    nn.addScaledVector(d, -nn.dot(d)).normalize();
    const v = new THREE.Vector3().crossVectors(d, nn);
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u, w]) => new THREE.Vector2(u, w))), { depth: len, bevelEnabled: false });
    return this.add(mat, g, new THREE.Matrix4().makeBasis(nn, v, d).setPosition(va), solid);
  }
  /* Dalle horizontale mince (sol, plafond) sur le rectangle de plan [x0,z0,x1,z1], face supérieure à la cote y. */
  slab(mat, x0, z0, x1, z1, y, t = 0.02) { return this.box(mat, x0, y - t, z0, x1, y, z1); }

  /* Fabrique les maillages fusionnés, rangés par calque. Renvoie { nomDuCalque: Group }. */
  build(parent) {
    const layers = {};
    for (const it of this.items.values()) {
      let geo = mergeGeometries(it.geos, false);
      it.geos.length = 0;
      const ud = it.mat.userData || {};
      if (ud.wuv) worldUV(geo, ud.wuv, ud.wuvSwap);
      const tl = this.tiles[it.layer], ranges = tl && !it.mat.transparent && geo.attributes.position.count >= tl.min * 3 ? sortTiles(geo, tl.size) : null;   // un vitrage garde son ordre
      geo = weld(geo);
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mk = (gg) => {
        const mesh = new THREE.Mesh(gg, it.mat);
        mesh.castShadow = ud.cast !== false;
        mesh.receiveShadow = ud.receive !== false;
        if (ud.order) mesh.renderOrder = ud.order;
        return mesh;
      };
      let g = layers[it.layer];
      if (!g) { g = layers[it.layer] = new THREE.Group(); g.name = it.layer; parent.add(g); }
      const mesh = mk(geo); g.add(mesh);
      /* Tuiles : mêmes tampons de sommets et d'indices (rien de plus à envoyer à la carte graphique), une plage et une sphère
         englobante chacune. La promenade dessine les tuiles (celles qui sont hors du champ sont écartées), les vues d'ensemble
         le maillage entier (un seul appel de dessin) ; main.js bascule de l'un à l'autre. */
      if (ranges) {
        mesh.userData.tiled = true;
        for (const r of ranges) {
          const tg = new THREE.BufferGeometry();
          for (const k of ['position', 'normal', 'uv']) tg.setAttribute(k, geo.attributes[k]);
          if (geo.index) tg.setIndex(geo.index);
          tg.setDrawRange(r.start * 3, r.count * 3); tg.boundingSphere = rangeSphere(geo, r.start, r.count);
          const tm = mk(tg); tm.userData.tile = true; tm.visible = false; g.add(tm);
        }
      }
    }
    this.items.clear();
    return layers;
  }
}

/* Générateur pseudo-aléatoire reproductible (mêmes plantes, mêmes veinages à chaque chargement). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
