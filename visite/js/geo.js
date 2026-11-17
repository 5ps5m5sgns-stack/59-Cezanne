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

/* Coupe horizontale d'une géométrie à la cote y : renvoie [dessous, dessus]. Les triangles traversés sont recoupés ;
   un solide convexe (boîte, cylindre, coussin…) reçoit une face de coupe pleine, comme une maquette sciée net. */
function splitY(g, y, solid) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, n = P.length / 9;
  const lo = [[], [], []], hi = [[], [], []], ring = [];
  const V = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], U[i * 2], U[i * 2 + 1]];
  const mix = (a, b) => { const t = (y - a[1]) / (b[1] - a[1]), r = a.map((v, k) => v + (b[k] - v) * t); r[1] = y; return r; };
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
      lo[0].push(cx, y, cz, b[0], y, b[2], a[0], y, a[2]); lo[1].push(0, 1, 0, 0, 1, 0, 0, 1, 0); lo[2].push(0.5, 0.5, b[6], b[7], a[6], a[7]);
    }
  }
  const mk = (d) => { if (!d[0].length) return null; const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(d[0], 3)); q.setAttribute('normal', new THREE.Float32BufferAttribute(d[1], 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(d[2], 2)); return q; };
  return [mk(lo), mk(hi)];
}

export class Batch {
  /* cuts : calque → cote de coupe. Tout ce qui est ajouté à ce calque est partagé à cette cote : le dessous y reste, le dessus va dans « calque:top ». */
  constructor() { this.items = new Map(); this.layer = 'L0'; this.frame = new THREE.Matrix4(); this.stack = []; this.lights = []; this.cuts = {}; }

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
        const [lo, hi] = splitY(g, cy, solid && !mat.transparent);      // pas de face de coupe dans un vitrage : elle se verrait par transparence
        if (lo) this.put(this.layer, mat, lo);
        if (hi) this.put(this.layer + ':top', mat, hi);
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
  box(mat, x0, y0, z0, x1, y1, z1) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    if (w < 1e-4 || h < 1e-4 || d < 1e-4) return this;
    _m.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mat, new THREE.BoxGeometry(w, h, d), _m.clone(), true);
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
      const geo = mergeGeometries(it.geos, false);
      it.geos.length = 0;
      const ud = it.mat.userData || {};
      if (ud.wuv) worldUV(geo, ud.wuv, ud.wuvSwap);
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, it.mat);
      mesh.castShadow = ud.cast !== false;
      mesh.receiveShadow = ud.receive !== false;
      if (ud.order) mesh.renderOrder = ud.order;
      let g = layers[it.layer];
      if (!g) { g = layers[it.layer] = new THREE.Group(); g.name = it.layer; parent.add(g); }
      g.add(mesh);
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
