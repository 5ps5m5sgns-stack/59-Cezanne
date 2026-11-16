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

export class Batch {
  constructor() { this.items = new Map(); this.layer = 'L0'; this.frame = new THREE.Matrix4(); this.stack = []; this.lights = []; }

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

  add(mat, geo, local) {
    const g = clean(geo);
    const M = local ? this.frame.clone().multiply(local) : this.frame;
    g.applyMatrix4(M);
    const key = this.layer + '|' + mat.uuid;
    let it = this.items.get(key);
    if (!it) { it = { layer: this.layer, mat, geos: [] }; this.items.set(key, it); }
    it.geos.push(g);
    return this;
  }

  /* Boîte par ses coins opposés (repère local). */
  box(mat, x0, y0, z0, x1, y1, z1) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    if (w < 1e-4 || h < 1e-4 || d < 1e-4) return this;
    _m.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mat, new THREE.BoxGeometry(w, h, d), _m.clone());
  }
  /* Boîte centrée en (cx, cz), posée à la hauteur y0, de dimensions (w, h, d) ; r = rayon d'arrondi. */
  cbox(mat, cx, y0, cz, w, h, d, r = 0, rot = 0, seg = 2) {
    const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)) : new THREE.BoxGeometry(w, h, d);
    const M = new THREE.Matrix4().compose(new THREE.Vector3(cx, y0 + h / 2, cz), new THREE.Quaternion().setFromAxisAngle(Y, rot), new THREE.Vector3(1, 1, 1));
    return this.add(mat, geo, M);
  }
  cyl(mat, cx, y0, cz, r, h, seg = 20, rTop = r) {
    _m.makeTranslation(cx, y0 + h / 2, cz);
    return this.add(mat, new THREE.CylinderGeometry(rTop, r, h, seg), _m.clone());
  }
  sph(mat, cx, cy, cz, r, sx = 1, sy = 1, sz = 1, seg = 14) {
    const M = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    return this.add(mat, new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), M);
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
    return this.add(mat, new THREE.CylinderGeometry(r2, r, len, seg), M);
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
    return this.add(mat, geo, M);
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
