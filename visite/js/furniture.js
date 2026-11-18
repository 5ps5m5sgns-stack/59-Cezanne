/* 59 Cézanne — visite 3D : mobilier et végétaux.
   Cotes réelles (assise 46 cm, table 75 cm, plan de travail 91 cm, lit 55 cm…) et modèles repris des images du graphiste :
   canapé bouclé gris, chaises coque en velours terracotta, table ronde en verre fumé, lustres à anneaux laiton,
   cuisine anthracite et chêne, mur TV en marbre, lit capitonné sable, oliviers en pot.
   Chaque fonction dessine dans le repère local courant du Batch : origine au centre de l'emprise, au sol,
   « face avant » tournée vers +z. Elle renvoie l'emprise [largeur, profondeur] servant aux collisions (ou null).

   Détail : aucun chant vif. Les boiseries et façades ont un chanfrein de 1 à 4 mm (cb/bb), les tissus sont des volumes
   souples (soft) à rayon de 3 à 8 cm, avec affaissement et plis calculés sur les sommets, normales recalculées. Les jeux entre
   façades (2 à 3 mm) laissent voir le caisson sombre. Les géométries de base sont mises en cache puis copiées par le Batch. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from 'v3d/geo';

const PI = Math.PI, TAU = PI * 2;
const Y = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3();
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const rbox = (w, h, d, r, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ── Boîte chanfreinée : 44 triangles au lieu de 12, mais un chant qui accroche la lumière (6 faces, 12 chants, 8 coins) ── */
const chCache = new Map();
function chamGeo(w, h, d, c) {
  const key = [w, h, d, c].map((v) => Math.round(v * 10000)).join('/');
  let g = chCache.get(key);
  if (!g) {
    const H = [w / 2, h / 2, d / 2], pos = [], nor = [], uv = [];
    c = Math.min(c, H[0] * 0.98, H[1] * 0.98, H[2] * 0.98);
    for (let sx = -1; sx <= 1; sx++) for (let sy = -1; sy <= 1; sy++) for (let sz = -1; sz <= 1; sz++) {
      const s = [sx, sy, sz], nz = s.filter((v) => v).length; if (!nz) continue;
      const n = new THREE.Vector3(sx, sy, sz).normalize(); let pts = [];
      if (nz === 1) {
        const a = s.findIndex((v) => v), [u, v] = [(a + 1) % 3, (a + 2) % 3];
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[a] = s[a] * H[a]; p[u] = su * (H[u] - c); p[v] = sv * (H[v] - c); pts.push(p); }
      } else if (nz === 2) {
        const ax = [0, 1, 2].filter((i) => s[i]), z0 = [0, 1, 2].find((i) => !s[i]), [a, bb] = ax;
        for (const sz0 of [-1, 1]) {
          const p1 = [0, 0, 0], p2 = [0, 0, 0]; p1[a] = s[a] * H[a]; p1[bb] = s[bb] * (H[bb] - c); p2[a] = s[a] * (H[a] - c); p2[bb] = s[bb] * H[bb]; p1[z0] = p2[z0] = sz0 * (H[z0] - c);
          pts.push(sz0 < 0 ? p1 : p2, sz0 < 0 ? p2 : p1);
        }
      } else {
        for (let i = 0; i < 3; i++) { const p = [0, 0, 0]; for (let k = 0; k < 3; k++) p[k] = s[k] * (k === i ? H[k] : H[k] - c); pts.push(p); }
      }
      const tri = (A, B, C) => {
        _v.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); _w.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
        if (_v.cross(_w).dot(n) < 0) { const t = B; B = C; C = t; }
        for (const p of [A, B, C]) { pos.push(...p); nor.push(n.x, n.y, n.z); uv.push(p[0] + p[2], p[1] + p[2] * 0.5); }
      };
      if (pts.length === 3) tri(pts[0], pts[1], pts[2]); else { tri(pts[0], pts[1], pts[2]); tri(pts[0], pts[2], pts[3]); }
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    chCache.set(key, g);
  }
  return g.clone();
}
/* Boîte chanfreinée centrée en (cx, cz), posée à la hauteur y0 (comme Batch.cbox), pivotée de rot autour de la verticale.
   Un panneau mince (moins de 3 cm) n'a pas de face de coupe : sciée à 1,25 m par la maquette, cette face horizontale cachée
   dans l'épaisseur, vue de biais, recevait du décalage de profondeur de son matériau (main.js, proportionnel à la pente) de quoi
   passer devant la façade : c'était une partie de la ligne claire à hauteur de coupe. */
const cb = (b, mat, cx, y0, cz, w, h, d, c = 0.003, rot = 0) => {
  if (c * 2.2 > Math.min(w, h, d)) c = Math.min(w, h, d) / 2.4;
  const M = new THREE.Matrix4().compose(_v.set(cx, y0 + h / 2, cz), _q.setFromAxisAngle(Y, rot), ONE);
  return b.add(mat, c > 0.0005 ? chamGeo(w, h, d, c) : new THREE.BoxGeometry(w, h, d), M, Math.min(w, d) > 0.03);
};
/* Idem par coins opposés (comme Batch.box). */
const bb = (b, mat, x0, y0, z0, x1, y1, z1, c = 0.003) => {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0); if (w < 1e-4 || h < 1e-4 || d < 1e-4) return b;
  return cb(b, mat, (x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2, w, h, d, c);
};

/* ── Volume souple : boîte aux arêtes arrondies (rayon r, nr facettes par arête), grilles de ni[x,y,z] points sur les faces plates,
   puis déformation D(x, y, z) → [dx, dy, dz] (coordonnées centrées). Les normales suivent la déformation (jacobienne numérique). ── */
function softGeo(w, h, d, r, ni = [3, 2, 3], nr = 1, D = null) {
  const H = [w / 2, h / 2, d / 2]; r = Math.min(r, H[0] * 0.98, H[1] * 0.98, H[2] * 0.98);
  const st = (a) => {
    const inner = H[a] - r, out = [];
    for (let k = nr; k >= 1; k--) out.push({ p: -inner, t: -k / nr });
    for (let i = 0; i < ni[a]; i++) out.push({ p: -inner + (2 * inner * i) / (ni[a] - 1), t: 0 });
    for (let k = 1; k <= nr; k++) out.push({ p: inner, t: k / nr });
    return out;
  };
  const S = [st(0), st(1), st(2)], pos = [], nor = [], uv = [], indices = [], eps = 1e-3;
  const dfm = (p) => { if (!D) return p; const o = D(p[0], p[1], p[2]); return [p[0] + o[0], p[1] + o[1], p[2] + o[2]]; };
  const J = (p, n) => {                                     // n' = normalisée( J^-T n ), J = I + dD/dP
    if (!D) return n;
    const cols = [];
    for (let i = 0; i < 3; i++) { const q = p.slice(); q[i] += eps; const a = dfm(q), q2 = p.slice(); q2[i] -= eps; const c = dfm(q2); cols.push([(a[0] - c[0]) / (2 * eps), (a[1] - c[1]) / (2 * eps), (a[2] - c[2]) / (2 * eps)]); }
    const m = new THREE.Matrix3().set(cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]);
    const det = m.determinant(); if (Math.abs(det) < 1e-9) return n;
    return _v.set(n[0], n[1], n[2]).applyMatrix3(m.invert().transpose()).normalize().toArray();
  };
  for (let f = 0; f < 3; f++) for (const sf of [-1, 1]) {
    const u = (f + 1) % 3, v = (f + 2) % 3, SU = S[u], SV = S[v], nu = SU.length, nv = SV.length, base = pos.length / 3;
    const P = [], N = [];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const n0 = [0, 0, 0]; n0[f] = sf; n0[u] = SU[i].t; n0[v] = SV[j].t;
      const l = Math.hypot(n0[0], n0[1], n0[2]), n = n0.map((x) => x / l), p = [0, 0, 0];
      p[f] = sf * (H[f] - r) + r * n[f]; p[u] = SU[i].p + r * n[u]; p[v] = SV[j].p + r * n[v];
      P.push(dfm(p)); N.push(J(p, n));
    }
    for (let k = 0; k < P.length; k++) { pos.push(...P[k]); nor.push(...N[k]); uv.push(P[k][u], P[k][v]); }
    for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
      const a = base + i * nv + j, b2 = a + nv, c = b2 + 1, e = a + 1;
      if (sf > 0) indices.push(a, b2, c, a, c, e); else indices.push(a, c, b2, a, e, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices);
  return g;
}
/* Place un volume souple (centre en cx, y0 + h/2, cz ; rotations rx, ry, rz). */
const soft = (b, mat, cx, y0, cz, w, h, d, r, o = {}) => {
  const g = softGeo(w, h, d, r, o.ni || [3, 2, 3], o.nr || 1, o.D || null);
  return b.geo(mat, g, cx, y0 + h / 2, cz, o.rx || 0, o.ry || 0, o.rz || 0);
};
/* Bruit de plis à basse fréquence (somme de sinusoïdes de phases tirées de la graine). */
const folds = (seed) => { const R = rng(seed), P = Array.from({ length: 5 }, () => [R() * TAU, R() * TAU, 0.6 + R() * 1.4, 0.6 + R() * 1.4]); return (x, z) => P.reduce((s, [a, c, fx, fz]) => s + Math.sin(x * fx * 7 + a + z * fz * 3.3) * Math.cos(z * fz * 6.1 + c - x * fx * 2.1), 0) / 5; };

/* Coussin décoratif : volume carré aux coins pincés, bombé sur les deux faces, légère dépression centrale (≈ 220 triangles). */
function pillowGeo(w, h, d, n = 8, seed = 1) {
  const R = rng(seed), ph = R() * TAU, k = n > 8 ? 5 : 4, fl = folds(seed + 11);
  return softGeo(w, h, d, h * 0.42, [k, 2, k], 1, (x, y, z) => {
    const ax = x / (w / 2), az = z / (d / 2), bu = Math.max(0, (1 - ax * ax) * (1 - az * az)), s = Math.sign(y) || 1, corner = ax * ax * az * az;
    return [-x * 0.06 * corner - x * 0.03 * az * az, s * (h * 0.3 * bu - (s > 0 ? h * 0.1 * Math.exp(-(ax * ax + az * az) * 4) : 0) + fl(x, z) * h * 0.06 + 0.004 * Math.sin(ax * 5 + ph)), -z * 0.06 * corner - z * 0.03 * ax * ax];
  });
}
const pillow = (b, mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0, seed = 1, n = 8) => b.geo(mat, pillowGeo(w, h, d, n, seed), x, y, z, rx, ry, rz);

/* Coque enveloppante (chaises, fauteuils, tabourets) : dossier cintré plus haut au centre qu'aux accoudoirs.
   r = rayon au niveau de l'assise, flare = évasement vers le haut, half = demi-ouverture (radians), dos tourné vers -z. */
function shellGeo(r, flare, y0, hBack, hArm, half, thick = 0.035, nu = 18, nv = 5) {
  const pos = [], idx = [];
  const H = (u) => hArm + (hBack - hArm) * Math.pow(Math.cos((u / half) * PI / 2), 0.8);
  const P = (u, v, inner) => { const rr = r + flare * v - (inner ? thick : 0), a = PI + u; return [Math.sin(a) * rr, y0 + v * H(u), Math.cos(a) * rr]; };
  const grid = (inner) => {
    const base = pos.length / 3;
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) pos.push(...P(-half + (2 * half * i) / nu, j / nv, inner));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = base + i * (nv + 1) + j, c = a + nv + 1;
      if (inner) idx.push(a, a + 1, c, c, a + 1, c + 1); else idx.push(a, c, a + 1, c, c + 1, a + 1);
    }
  };
  grid(false); grid(true);
  const strip = (pa, pb) => {                                     // ruban entre deux lignes de points (chant de la coque)
    const base = pos.length / 3, n = pa.length;
    for (let i = 0; i < n; i++) pos.push(...pa[i], ...pb[i]);
    for (let i = 0; i < n - 1; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  };
  const us = Array.from({ length: nu + 1 }, (_, i) => -half + (2 * half * i) / nu), vs = Array.from({ length: nv + 1 }, (_, j) => j / nv);
  strip(us.map((u) => P(u, 1, true)), us.map((u) => P(u, 1, false)));          // chant supérieur
  strip(us.map((u) => P(u, 0, false)), us.map((u) => P(u, 0, true)));          // chant inférieur
  strip(vs.map((v) => P(-half, v, false)), vs.map((v) => P(-half, v, true)));  // extrémités
  strip(vs.map((v) => P(half, v, true)), vs.map((v) => P(half, v, false)));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2); for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = Math.atan2(pos[i * 3], -pos[i * 3 + 2]) * r * 2; uv[i * 2 + 1] = pos[i * 3 + 1] * 2; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* Tombé de rideau : ruban plissé (deux faces), de la tringle au sol. Les plis (ondes à l'italienne) sont réguliers, un peu
   moins profonds vers le bas, avec un ourlet qui reste droit. */
function drapeGeo(w, h, pleat = 0.075, amp = 0.032, y0 = 0.015) {
  const n = Math.max(8, Math.round(w / pleat) * 5), m = 3, pos = [], uv = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = -w / 2 + w * t;
      for (let j = 0; j <= m; j++) {
        const s = j / m, a = amp * (1 - 0.35 * s) * (0.92 + 0.16 * Math.sin(t * 17 + s * 2)), z = Math.sin(t * (w / pleat) * 2 * PI + s * 0.35) * a + side * 0.0025;
        pos.push(x, y0 + h * s, z); uv.push(t * w * 2, s * h * 2);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = base + i * (m + 1) + j, c = a + m + 1;
      if (side > 0) idx.push(a, c, a + 1, c, c + 1, a + 1); else idx.push(a, a + 1, c, c, a + 1, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* Touffe de feuilles : n petites cartes texturées orientées au hasard dans une boule, normales tournées vers l'extérieur (éclairage doux). */
function leaves(b, mat, x, y, z, rad, n, size, R, squash = 1) {
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

/* ── Petits objets de décor ─────────────────────────────────────────────── */
const vase = (b, m, x, y, z, s = 1) => b.lathe(m, x, y, z, [[0.04 * s, 0], [0.07 * s, 0.012 * s], [0.092 * s, 0.07 * s], [0.092 * s, 0.15 * s], [0.058 * s, 0.25 * s], [0.036 * s, 0.295 * s], [0.045 * s, 0.33 * s], [0.032 * s, 0.33 * s], [0.02 * s, 0.26 * s]], 16);
const bowl = (b, m, x, y, z, r = 0.14) => b.lathe(m, x, y, z, [[r * 0.35, 0], [r * 0.45, 0.012], [r * 0.8, r * 0.2], [r * 0.96, r * 0.42], [r, r * 0.5], [r * 0.95, r * 0.5], [r * 0.9, r * 0.44], [r * 0.7, r * 0.2], [r * 0.4, r * 0.1], [0.001, r * 0.09]], 22);
const bottle = (b, m, x, y, z) => b.lathe(m, x, y, z, [[0.035, 0], [0.041, 0.012], [0.041, 0.18], [0.034, 0.215], [0.015, 0.255], [0.0155, 0.32], [0.001, 0.32]], 10);
const glass = (b, M, x, y, z) => { b.cyl(M.crystal, x, y, z, 0.03, 0.004, 10); b.cyl(M.crystal, x, y + 0.004, z, 0.004, 0.075, 5); b.lathe(M.crystal, x, y + 0.08, z, [[0.006, 0], [0.026, 0.018], [0.038, 0.055], [0.029, 0.112]], 10); };
/* Livre : couvertures colorées (2 mm), bloc de pages crème en retrait de 4 mm sur trois côtés ; dos côté -z local. */
const book = (b, M, mat, x, y, z, w, th, d, rot = 0) => {
  cb(b, M[mat], x, y, z, w, th, d, 0.0012, rot);
  const c = Math.cos(rot), s = Math.sin(rot), ox = 0.004 * s, oz = 0.004 * c;
  cb(b, M.cream, x + ox, y + 0.0022, z + oz, w - 0.008, th - 0.0044, d - 0.006, 0, rot);
};
const books = (b, M, x, y, z, n = 3, w = 0.26, d = 0.19) => { let yy = y; for (let i = 0; i < n; i++) { const th = 0.022 + (i % 3) * 0.004; book(b, M, ['cream', 'charcoal', 'terra', 'greige', 'sage'][i % 5], x + (i % 2) * 0.012, yy, z, w - i * 0.02, th, d - i * 0.012, i * 0.12); yy += th; } return yy; };
/* Plumeaux de pampa dans un vase. */
function plumes(b, M, x, y, z, h, n, R) {
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, t = 0.12 + R() * 0.26, ex = x + Math.cos(a) * Math.sin(t) * h, ez = z + Math.sin(a) * Math.sin(t) * h, ey = y + Math.cos(t) * h;
    b.rod(M.pampas, [x, y, z], [ex, ey, ez], 0.0035, 4);
    b.geo(M.pampas, new THREE.SphereGeometry(0.035, 6, 4), x + (ex - x) * 0.84, y + (ey - y) * 0.84, z + (ez - z) * 0.84, Math.sin(a) * t, 0, -Math.cos(a) * t, 0.85 + R() * 0.3, h * (4.8 + R() * 1.6), 0.85 + R() * 0.3);
  }
}
/* Bougie dans un photophore. */
const candle = (b, M, x, y, z, s = 1) => { b.lathe(M.ceramic, x, y, z, [[0.032 * s, 0], [0.036 * s, 0.006], [0.036 * s, 0.06 * s], [0.03 * s, 0.06 * s], [0.03 * s, 0.01]], 10); b.cyl(M.cream, x, y + 0.008, z, 0.026 * s, 0.045 * s, 10); b.cyl(M.led, x, y + 0.053 * s, z, 0.002, 0.008, 3); };
/* Tasse (lathe + anse). */
const cup = (b, m, x, y, z, s = 1, rot = 0) => { b.lathe(m, x, y, z, [[0.025 * s, 0], [0.034 * s, 0.003], [0.04 * s, 0.045 * s], [0.042 * s, 0.062 * s], [0.039 * s, 0.062 * s], [0.034 * s, 0.05 * s], [0.001, 0.008]], 14); b.tube(m, [[x + Math.cos(rot) * 0.04 * s, y + 0.05 * s, z - Math.sin(rot) * 0.04 * s], [x + Math.cos(rot) * 0.062 * s, y + 0.04 * s, z - Math.sin(rot) * 0.062 * s], [x + Math.cos(rot) * 0.04 * s, y + 0.015 * s, z - Math.sin(rot) * 0.04 * s]], 0.004 * s, 4); };

/* ── Rangements : petits volumes économes (vêtements, chaussures, linge, boîtes) ────────────────────────────────────────
   Prisme droit sur un profil convexe pts = [[z, y], …], épaisseur t selon x. Un vêtement sur cintre ou une chaussure ne coûte
   ainsi qu'une vingtaine de triangles ; le profil est mis en cache et copié. */
const prCache = new Map();
function prismGeo(key, pts, t) {
  let g = prCache.get(key);
  if (!g) {
    const pos = [], nor = [], uv = [], n = pts.length, cz = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
    const tri = (A, B, C, nn) => {
      _v.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); _w.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
      if (_v.cross(_w).dot(_n.set(nn[0], nn[1], nn[2])) < 0) { const s = B; B = C; C = s; }
      for (const p of [A, B, C]) { pos.push(p[0], p[1], p[2]); nor.push(nn[0], nn[1], nn[2]); uv.push(p[2] * 2 + p[0] * 2, p[1] * 2); }
    };
    for (const s of [1, -1]) for (let i = 1; i < n - 1; i++) tri([s * t / 2, pts[0][1], pts[0][0]], [s * t / 2, pts[i][1], pts[i][0]], [s * t / 2, pts[i + 1][1], pts[i + 1][0]], [s, 0, 0]);
    for (let i = 0; i < n; i++) {
      const a = pts[i], c = pts[(i + 1) % n], dz = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dz, dy) || 1;
      let nz = dy / l, ny = -dz / l; if (nz * ((a[0] + c[0]) / 2 - cz) + ny * ((a[1] + c[1]) / 2 - cy) < 0) { nz = -nz; ny = -ny; }
      const A = [-t / 2, a[1], a[0]], B = [t / 2, a[1], a[0]], C = [t / 2, c[1], c[0]], D = [-t / 2, c[1], c[0]];
      tri(A, B, C, [0, ny, nz]); tri(A, C, D, [0, ny, nz]);
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    prCache.set(key, g);
  }
  return g.clone();
}
/* Profils de vêtements suspendus (z = largeur d'épaules, y = 0 au crochet du cintre, vers le bas) : chemise, veste, robe, manteau. */
const GARMENT = {
  shirt: [[-0.02, -0.03], [0.02, -0.03], [0.2, -0.075], [0.215, -0.13], [0.2, -1], [-0.2, -1], [-0.215, -0.13], [-0.2, -0.075]],
  coat: [[-0.025, -0.03], [0.025, -0.03], [0.215, -0.08], [0.23, -0.14], [0.235, -1], [-0.235, -1], [-0.23, -0.14], [-0.215, -0.08]],
  dress: [[-0.02, -0.035], [0.02, -0.035], [0.16, -0.08], [0.17, -0.13], [0.24, -1], [-0.24, -1], [-0.17, -0.13], [-0.16, -0.08]],
  pants: [[-0.17, -0.06], [0.17, -0.06], [0.17, -1], [-0.17, -1]],
};
/* Vêtement sur cintre, accroché à la tringle (x, yr, z) : crochet métallique, barre du cintre, puis le tombé. L = longueur, t = épaisseur. */
function garment(b, M, mat, kind, x, yr, z, L, t, tilt = 0) {
  const pts = GARMENT[kind].map(([u, v]) => [u, v < -0.5 ? -L : v]);
  b.geo(mat, prismGeo(kind + L.toFixed(2) + '/' + t.toFixed(3), pts, t), x, yr, z, 0, 0, tilt);
  b.box(M.steel, x - 0.002, yr - 0.032, z - 0.002, x + 0.002, yr + 0.012, z + 0.002);                       // crochet
  if (kind !== 'pants') b.box(M.oak, x - 0.006, yr - 0.05, z - 0.19, x + 0.006, yr - 0.032, z + 0.19);      // épaules du cintre
  else b.box(M.oak, x - 0.005, yr - 0.07, z - 0.19, x + 0.005, yr - 0.058, z + 0.19);
}
/* Chaussure : profil de côté (pointe vers +z), largeur 9 cm. */
const SHOE = [[0.13, 0], [0.135, 0.028], [0.09, 0.05], [-0.04, 0.085], [-0.13, 0.085], [-0.135, 0.02], [-0.13, 0]];
const BOOT = [[0.13, 0], [0.12, 0.05], [0.02, 0.26], [-0.12, 0.26], [-0.13, 0.02], [-0.12, 0]];
function shoes(b, M, x0, x1, y, z, R, n = 9) {
  const mats = ['black', 'terra', 'white', 'seam', 'black'];   // peu de matières : chacune coûte un appel de dessin par calque
  for (let x = x0 + 0.06; x < x1 - 0.1 && n-- > 0; x += 0.22 + R() * 0.04) {
    const m = M[mats[(R() * mats.length) | 0]], boot = R() < 0.18, g = boot ? BOOT : SHOE, k = boot ? 'boot' : 'shoe';
    for (const dx of [-0.05, 0.05]) b.geo(m, prismGeo(k, g, 0.085), x + dx + 0.06, y, z + (R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.12, 0);
  }
}
/* Pile de linge plié (serviettes, pulls, draps) : plis légèrement décalés, couleurs d'un même camaïeu. */
function linenPile(b, M, x, y, z, w, d, n, R, pal) {
  let yy = y;
  for (let k = 0; k < n; k++) { const th = 0.035 + R() * 0.03; cb(b, M[pal[(R() * pal.length) | 0]], x + (R() - 0.5) * 0.02, yy, z + (R() - 0.5) * 0.02, w - R() * 0.03, th, d - R() * 0.03, 0.01, (R() - 0.5) * 0.06); yy += th; }
  return yy;
}
/* Boîte de rangement (carton toilé, osier ou tissu) posée sur une étagère, avec sa découpe de préhension. */
function storeBox(b, M, mat, x, y, z, w, h, d) {
  cb(b, M[mat], x, y, z, w, h, d, 0.004);
  b.box(M.seam, x - 0.04, y + h - 0.05, z + d / 2, x + 0.04, y + h - 0.03, z + d / 2 + 0.002);
}

export const F = {

  /* ── Séjour ─────────────────────────────────────────────────────────── */
  /* Canapé bas à larges accoudoirs, coussins d'assise et de dossier, plaid ; chaise = 'L' | 'R' ajoute une méridienne. */
  sofa(b, M, { w = 2.6, d = 1.0, mat = 'boucle', chaise = null, cl = 1.9, cw = 1.2, pillows = ['greige', 'boucle'], plaid = true, shelf = false }) {
    const m = M[mat], arm = 0.22, back = 0.24, sh = 0.43, seed = Math.round(w * 77 + d * 13);
    cb(b, M.black, 0, 0, 0, w - 0.14, 0.05, d - 0.14, 0.002);                          // socle en retrait : le canapé flotte sur une ombre
    soft(b, m, 0, 0.05, 0, w, 0.2, d, 0.045, { ni: [4, 2, 3] });                        // caisson
    for (const sx of [-1, 1]) soft(b, m, sx * (w / 2 - arm / 2), 0.2, 0, arm, 0.4, d, 0.085, { ni: [2, 3, 4], nr: 2, D: (x, y, z) => [sx * 0.012 * smooth(-0.1, 0.2, y) * (1 - (2 * z / d) ** 2), 0, 0] });     // accoudoirs larges et bas (60 cm), légèrement bombés
    soft(b, m, 0, 0.2, -d / 2 + back / 2, w - 2 * arm + 0.04, 0.52, back, 0.085, { ni: [5, 3, 2], nr: 2 });          // dossier
    const n = Math.max(2, Math.round((w - 2 * arm) / 0.82)), sw = (w - 2 * arm) / n, sd = d - back - 0.02, zc = d / 2 - sd / 2 - 0.01;
    const crown = (x, z, sw0, sd0) => 0.014 * (1 - (2 * x / sw0) ** 2) * (1 - (2 * z / sd0) ** 2);
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + arm + sw * (i + 0.5), fl = folds(seed + i * 7);
      soft(b, m, cx, 0.25, zc, sw - 0.012, sh - 0.25, sd, 0.07, { ni: [4, 2, 4], nr: 2, D: (x, y, z) => { const t = smooth(-0.02, 0.09, y); return [0, t * (crown(x, z, sw, sd) + fl(x, z) * 0.004) + (z > sd * 0.3 ? -0.006 * t * smooth(0.3, 0.5, z / sd) : 0), 0]; } });       // coussin d'assise bombé
      soft(b, m, cx, 0.48, -d / 2 + back + 0.06, sw - 0.05, 0.44, 0.17, 0.075, { ni: [4, 3, 2], nr: 2, rx: -0.2, D: (x, y, z) => { const t = smooth(-0.1, 0.22, y), c = 1 - (2 * x / sw) ** 2; return [0, -0.015 * t * c, 0.022 * c * (1 - t * 0.4) * smooth(-0.05, 0.1, z)]; } });          // coussin de dossier, tassé
    }
    if (chaise) {
      const s = chaise === 'R' ? 1 : -1, cx = s * (w / 2 - cw / 2), cz = d / 2 + cl / 2 - 0.02, fl = folds(seed + 99);
      cb(b, M.black, cx, 0, cz, cw - 0.14, 0.05, cl - 0.14, 0.002);
      soft(b, m, cx, 0.05, cz, cw, 0.2, cl, 0.045, { ni: [3, 2, 4] });
      soft(b, m, cx, 0.25, cz, cw - 0.03, sh - 0.25, cl - 0.03, 0.07, { ni: [3, 2, 6], nr: 2, D: (x, y, z) => [0, smooth(-0.02, 0.09, y) * (crown(x, z, cw, cl) + fl(x, z) * 0.004), 0] });
    }
    pillows.forEach((p, i) => { const sx = i ? 1 : -1; pillow(b, M[p], sx * (w / 2 - arm - 0.3), 0.7, -d / 2 + back + 0.22, 0.46, 0.15, 0.44, PI / 2 - 0.3, 0, 0, seed + i); });
    if (plaid) {                                                                       // plaid jeté sur le coussin de droite, retombant sur le devant
      const px = w / 2 - arm - sw * 0.5, fl = folds(seed + 5), pw = sw * 0.62, pz = d / 2 - sd * 0.42, pl = sd * 0.8;
      soft(b, M.throw, px, sh + 0.006, pz + 0.012, pw, 0.03, pl + 0.024, 0.013, { ni: [5, 2, 6], D: (x, y, z) => [0, crown(x, z + pz - zc, sw, sd) + fl(x, z) * 0.006 + 0.002 * Math.sin(x * 40), 0] });
      soft(b, M.throw, px, 0.14, d / 2 + 0.016, pw, sh - 0.1, 0.022, 0.009, { ni: [5, 5, 2], D: (x, y, z) => { const t = smooth(-0.1, 0.2, -y); return [0.012 * Math.sin(y * 18 + x * 9) * t, 0, 0.01 * t * (1 + Math.sin(x * 33 + 1))]; } });
    }
    if (shelf) {                                                                       // étagère basse adossée au canapé (image du séjour d'étage)
      bb(b, M.walnut, -w / 2 + 0.25, 0.04, -d / 2 - 0.3, w / 2 - 0.25, 0.62, -d / 2 - 0.004, 0.003);
      for (const y of [0.1, 0.36]) b.box(M.black, -w / 2 + 0.28, y, -d / 2 - 0.302, w / 2 - 0.28, y + 0.22, -d / 2 - 0.28);
      books(b, M, -0.4, 0.36, -d / 2 - 0.17, 4); vase(b, M.pot, 0.3, 0.1, -d / 2 - 0.17, 0.6); bowl(b, M.pot, 0.75, 0.36, -d / 2 - 0.17, 0.09);
    }
    return chaise ? [w, d, chaise === 'R' ? [w / 2 - cw, d / 2, w / 2, d / 2 + cl] : [-w / 2, d / 2, -w / 2 + cw, d / 2 + cl]] : [w, d];
  },
  /* Fauteuil coque : mat 'walnut' = coque en noyer cintré et coussins sombres (fauteuil « coquillage » des images), sinon coque tapissée. */
  armchair(b, M, { mat = 'walnut' }) {
    const wood = mat === 'walnut' || mat === 'oak', sm = wood ? M.charcoal : M[mat];
    b.add(M[mat], shellGeo(0.36, 0.07, 0.3, 0.46, 0.24, 1.75, wood ? 0.02 : 0.05, 26, 7));
    b.lathe(sm, 0, 0.33, 0.03, [[0.001, 0.015], [0.1, 0.013], [0.24, 0.006], [0.3, 0], [0.335, 0.025], [0.33, 0.06], [0.3, 0.092], [0.2, 0.105], [0.1, 0.108], [0.001, 0.104]], 26);        // coussin d'assise rond, légèrement bombé
    if (wood) soft(b, sm, 0, 0.43, -0.3, 0.46, 0.3, 0.07, 0.03, { ni: [4, 3, 2], rx: -0.24, D: (x, y, z) => [0, 0, 0.012 * (1 - (2 * x / 0.46) ** 2)] });
    b.cyl(wood ? M[mat] : M.black, 0, 0.27, 0.02, 0.3, 0.06, 22);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { b.rod(wood ? M[mat] : M.black, [sx * 0.16, 0.29, sz * 0.14], [sx * 0.3, 0.012, sz * 0.28], 0.017, 8, 0.011); b.cyl(M.brass, sx * 0.3, 0, sz * 0.28, 0.0125, 0.014, 8); }
    return [0.8, 0.76];
  },
  /* Tables basses jumelles rondes (marbre noir). */
  coffeeRound(b, M, { r = 0.5, mat = 'marbleDark', h = 0.36 }) {
    b.lathe(M[mat], 0, h - 0.035, 0, [[0.001, 0], [r - 0.012, 0], [r - 0.003, 0.004], [r, 0.014], [r, 0.026], [r - 0.004, 0.033], [r - 0.012, 0.035], [0.001, 0.035]], 52);     // plateau à chant biseauté
    b.cyl(M.black, 0, h - 0.05, 0, r * 0.96, 0.016, 34);
    b.lathe(M.black, 0, 0, 0, [[r * 0.5, 0], [r * 0.5, 0.012], [r * 0.46, 0.02], [r * 0.24, 0.05], [r * 0.17, 0.09], [r * 0.16, h - 0.09], [r * 0.3, h - 0.06], [r * 0.4, h - 0.05]], 24);
    b.cyl(M.potDark, r * 0.18, h, -r * 0.1, 0.012, 0.0001, 8);
    books(b, M, -r * 0.25, h, r * 0.1, 3, 0.26, 0.2); bowl(b, M.pot, r * 0.15, h + 0.0, -r * 0.2, 0.09);
    return [2 * r, 2 * r];
  },
  /* Table basse : oval = plateau ovale en marbre sur socle sombre (image du séjour), garnie d'un plateau, de tasses et de revues. */
  coffeeRect(b, M, { w = 1.2, d = 0.65, mat = 'marble', oval = true, h = 0.36 }) {
    if (oval) {
      b.geo(M[mat], new THREE.LatheGeometry([[0.001, 0], [0.986, 0], [0.996, 0.12], [1, 0.3], [1, 0.58], [0.995, 0.86], [0.984, 1], [0.001, 1]].map(([r, y]) => new THREE.Vector2(r, y * 0.045)), 56), 0, h - 0.045, 0, 0, 0, 0, w / 2, 1, d / 2);
      b.geo(M.black, new THREE.CylinderGeometry(1, 1, h - 0.045, 40), 0, (h - 0.045) / 2, 0, 0, 0, 0, w / 2 - 0.1, 1, d / 2 - 0.1);
    } else {
      cb(b, M[mat], 0, h - 0.04, 0, w, 0.04, d, 0.006);
      for (const sx of [-1, 1]) cb(b, M.black, sx * (w / 2 - 0.06), 0, 0, 0.025, h - 0.04, d - 0.12, 0.002); cb(b, M.black, 0, 0, 0, w - 0.12, 0.02, 0.025, 0.002);
    }
    const tx = -w * 0.18;                                                             // plateau et gobelets en métal sombre
    b.lathe(M.potDark, tx, h, 0, [[0.001, 0.004], [0.18, 0.002], [0.19, 0.006], [0.194, 0.018], [0.186, 0.018], [0.182, 0.008], [0.001, 0.008]], 30);
    for (const [dx, dz, hh] of [[-0.06, -0.03, 0.11], [0.05, -0.06, 0.07], [0.03, 0.07, 0.07]]) b.lathe(M.potDark, tx + dx, h + 0.008, dz, [[0.026, 0], [0.034, hh], [0.031, hh], [0.001, 0.004]], 14);
    cb(b, M.cream, w * 0.2, h, 0.03, 0.22, 0.012, 0.29, 0.002, 0.35); cb(b, M.paper, w * 0.2 + 0.01, h + 0.012, 0.02, 0.21, 0.006, 0.28, 0.001, 0.2);
    cb(b, M.charcoal, w * 0.2 + 0.02, h + 0.018, 0.05, 0.19, 0.014, 0.25, 0.0015, 0.5); candle(b, M, w * 0.2 + 0.02, h + 0.032, 0.05, 0.8);
    return [w, d];
  },
  /* Tapis : bouclé épais, liseré tissé et franges aux deux bouts. */
  rug(b, M, { w = 3, d = 2, mat = 'rugDark' }) {
    cb(b, M[mat], 0, 0, 0, w, 0.014, d, 0.005);
    const band = mat === 'rug' ? M.cream : M.charcoal, bw = 0.012, i0 = 0.07;
    cb(b, band, 0, 0.0145, -d / 2 + i0, w - 2 * i0 + bw, 0.003, bw, 0.0008); cb(b, band, 0, 0.0145, d / 2 - i0, w - 2 * i0 + bw, 0.003, bw, 0.0008);
    cb(b, band, -w / 2 + i0, 0.0145, 0, bw, 0.003, d - 2 * i0 - bw, 0.0008); cb(b, band, w / 2 - i0, 0.0145, 0, bw, 0.003, d - 2 * i0 - bw, 0.0008);
    const R = rng(Math.round(w * 31 + d * 17)), pos = [], n = Math.round(w / 0.035), L = 0.06;            // franges : lanières posées à plat, deux triangles chacune
    for (const sz of [-1, 1]) for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.02 + ((w - 0.04) * (i + 0.5)) / n, k = (R() - 0.5) * 0.02, l = L * (0.85 + R() * 0.3), z0 = sz * (d / 2 - 0.004), z1 = sz * (d / 2 + l), y = 0.004;
      if (sz > 0) pos.push(x - 0.006, y, z0, x + 0.006, y, z0, x + k, y, z1); else pos.push(x + 0.006, y, z0, x - 0.006, y, z0, x + k, y, z1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); b.add(M[mat], g);
    return null;
  },
  /* Mur TV : fond en marbre veiné rétro-éclairé, étagères lumineuses, meubles laqués gris, console suspendue. */
  tvWall(b, M, { w = 4.6, h = 2.45, tv = 1.45 }) {
    const sw = Math.min(1.0, w * 0.26), cx = sw / 2, cw = w - sw, th = tv * 0.5625, ty = 1.02;
    bb(b, M.greyLacquer, -w / 2, 0, 0, w / 2, h, 0.03, 0);
    bb(b, M.marble, -w / 2 + sw, 0.62, 0.03, w / 2 - 0.04, 2.0, 0.045, 0);                // panneau de marbre derrière l'écran
    b.box(M.led, -w / 2 + sw, 1.995, 0.03, w / 2 - 0.04, 2.005, 0.06); b.box(M.glow, -w / 2 + sw, 1.35, 0.046, w / 2 - 0.04, 2.0, 0.048); b.light(cx, 1.9, 0.3, 0.45, 'led');
    bb(b, M.greyLacquer, -w / 2, 2.02, 0.03, w / 2, h, 0.36, 0.003);                   // meubles hauts
    const nu = Math.max(2, Math.round(w / 0.62)); for (let i = 1; i < nu; i++) b.box(M.seam, -w / 2 + (w / nu) * i - 0.0015, 2.03, 0.36, -w / 2 + (w / nu) * i + 0.0015, h, 0.362);
    b.box(M.seam, -w / 2 + 0.01, 2.03, 0.36, w / 2 - 0.01, 2.035, 0.362);              // gorge de préhension
    bb(b, M.marble, -w / 2 + 0.03, 0.62, 0.03, -w / 2 + sw - 0.03, 2.0, 0.04, 0);         // niche des étagères
    for (let i = 0; i < 3; i++) {
      const y = 0.95 + i * 0.36; bb(b, M.greyLacquer, -w / 2 + 0.03, y, 0.04, -w / 2 + sw - 0.03, y + 0.025, 0.3, 0.002); b.box(M.led, -w / 2 + 0.05, y - 0.006, 0.05, -w / 2 + sw - 0.05, y, 0.07);
      const ox = -w / 2 + sw * 0.3;
      if (i === 0) { vase(b, M.pot, ox, y + 0.025, 0.17, 0.7); books(b, M, ox + sw * 0.38, y + 0.025, 0.17, 3, 0.22, 0.16); }
      else if (i === 1) { bowl(b, M.ceramic, ox + sw * 0.3, y + 0.025, 0.17, 0.1); vase(b, M.potDark, ox - 0.05, y + 0.025, 0.17, 0.5); }
      else { b.sph(M.pot, ox, y + 0.115, 0.17, 0.09, 1, 1, 1, 12); b.lathe(M.ceramic, ox + sw * 0.36, y + 0.025, 0.17, [[0.035, 0], [0.05, 0.16], [0.001, 0.16]], 10); }
    }
    b.light(-w / 2 + sw / 2, 1.5, 0.35, 0.4, 'led');
    bb(b, M.greyLacquer, -w / 2, 0.24, 0.03, w / 2, 0.6, 0.44, 0.003);                 // console suspendue
    const nc = Math.max(2, Math.round(w / 0.9)); for (let i = 1; i < nc; i++) b.box(M.seam, -w / 2 + (w / nc) * i - 0.0015, 0.25, 0.44, -w / 2 + (w / nc) * i + 0.0015, 0.59, 0.442);
    b.box(M.seam, -w / 2 + 0.01, 0.585, 0.44, w / 2 - 0.01, 0.59, 0.442);
    b.box(M.led, -w / 2 + 0.05, 0.228, 0.06, w / 2 - 0.05, 0.24, 0.4);
    bb(b, M.black, cx - tv / 2 - 0.008, ty - 0.008, 0.045, cx + tv / 2 + 0.008, ty + th + 0.008, 0.07, 0.002); b.box(M.screen, cx - tv / 2, ty, 0.0705, cx + tv / 2, ty + th, 0.0745);
    cb(b, M.ceramic, cx + cw * 0.34, 0.6, 0.24, 0.07, 0.2, 0.07, 0.015); b.cyl(M.led, cx + cw * 0.34, 0.8, 0.24, 0.012, 0.02, 6);   // bougie
    candle(b, M, cx - cw * 0.3, 0.6, 0.2, 1);
    return [w, 0.94];
  },
  sideboard(b, M, { w = 2.2, d = 0.45, h = 0.8, mat = 'walnut', top = null }) {
    b.box(M.black, -w / 2 + 0.05, 0.02, -d / 2 + 0.03, w / 2 - 0.05, 0.14, d / 2 - 0.04);                     // retrait au sol
    cb(b, M.seam, 0, 0.14, 0, w - 0.004, h - 0.14, d - 0.004, 0.002);                                        // caisson sombre derrière les portes
    for (const sx of [-1, 1]) b.box(M[mat], sx > 0 ? w / 2 - 0.001 : -w / 2 - 0.002, 0.14, -d / 2, sx > 0 ? w / 2 + 0.002 : -w / 2 + 0.001, h - 0.012, d / 2 - 0.004);   // joues : le caisson sombre ne se voit pas de côté
    const n = Math.max(2, Math.round(w / 0.55)), dw = (w - 0.012 - (n - 1) * 0.003) / n;
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + 0.006 + dw / 2 + i * (dw + 0.003);
      cb(b, M[mat], cx, 0.145, d / 2 - 0.009, dw, h - 0.155, 0.019, 0.002);
      b.box(M.seam, cx - dw * 0.35, h - 0.045, d / 2 + 0.0095, cx + dw * 0.35, h - 0.035, d / 2 + 0.0105);           // gorge de préhension
    }
    cb(b, M[mat], 0, h - 0.012, 0, w + 0.004, 0.012, d + 0.004, 0.0015);
    if (top) cb(b, M[top], 0, h, 0, w + 0.02, 0.02, d + 0.02, 0.003);
    const ty = h + (top ? 0.02 : 0);
    vase(b, M.pot, -w * 0.3, ty, 0, 0.9); books(b, M, w * 0.22, ty, 0, 3); bowl(b, M.potDark, w * 0.4, ty, 0.02, 0.1); candle(b, M, w * 0.04, ty, 0.05, 0.9);
    return [w, d];
  },
  bookcase(b, M, { w = 2.4, h = 2.3, d = 0.34, mat = 'walnut' }) {
    bb(b, M[mat], -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.02, 0.002);
    const cols = Math.round(w / 0.8), rows = 5, R = rng(77 + Math.round(w * 10));
    for (let i = 0; i <= cols; i++) bb(b, M[mat], -w / 2 + (w / cols) * i - 0.012, 0, -d / 2 + 0.02, -w / 2 + (w / cols) * i + 0.012, h, d / 2, 0.002);
    for (let j = 0; j <= rows; j++) { const y = (h / rows) * j; bb(b, M[mat], -w / 2, y - (j ? 0.024 : 0), -d / 2 + 0.02, w / 2, y + (j ? 0 : 0.024), d / 2, 0.002); if (j && j < rows) b.box(M.led, -w / 2 + 0.03, y - 0.03, -d / 2 + 0.022, w / 2 - 0.03, y - 0.024, -d / 2 + 0.04); }
    const cols2 = ['cream', 'terra', 'charcoal', 'greige', 'linen', 'ochre', 'sand', 'sage', 'navy'];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const xa = -w / 2 + (w / cols) * i + 0.03, xb = -w / 2 + (w / cols) * (i + 1) - 0.03, y = (h / rows) * j + (j ? 0 : 0.024), k = R();
      if (k < 0.14) { vase(b, R() < 0.5 ? M.pot : M.potDark, (xa + xb) / 2, y, 0, 0.75); continue; }
      if (k < 0.22) { bowl(b, M.ceramic, (xa + xb) / 2, y, 0, 0.11); continue; }
      if (k < 0.3) { books(b, M, (xa + xb) / 2, y, 0, 3 + ((R() * 2) | 0), 0.26, 0.2); continue; }       // pile à plat
      let x = xa; const xe = xb - R() * 0.32;
      while (x < xe) {
        const t = 0.02 + R() * 0.03, bh = 0.2 + R() * 0.1, lean = R() < 0.06;
        if (lean) { b.geo(M[cols2[(R() * cols2.length) | 0]], new THREE.BoxGeometry(t, bh, 0.19), x + 0.03, y + bh / 2, 0, 0, 0, -0.2); x += t + 0.09; continue; }
        b.box(M[cols2[(R() * cols2.length) | 0]], x, y, -d / 2 + 0.05, x + t, y + bh, d / 2 - 0.04 - R() * 0.04); x += t + 0.002;
      }
    }
    b.light(0, h * 0.6, d / 2 + 0.2, 0.4, 'led');
    return [w, d];
  },
  /* Tableau : toile sur châssis, marie-louise claire, baguette fine chanfreinée (noire, ou laiton avec frame: 'brass'). */
  picture(b, M, { w = 0.9, h = 1.1, y = 1.55, mat = 'art1', frame = 'black' }) {
    const f = 0.022, X = w / 2 + 0.015, Z = h / 2 + 0.015;
    bb(b, M[frame], -X, y - Z, 0, X, y - Z + f, 0.032, 0.003); bb(b, M[frame], -X, y + Z - f, 0, X, y + Z, 0.032, 0.003);
    bb(b, M[frame], -X, y - Z + f, 0, -X + f, y + Z - f, 0.032, 0.003); bb(b, M[frame], X - f, y - Z + f, 0, X, y + Z - f, 0.032, 0.003);
    bb(b, M.white, -w / 2, y - h / 2, 0.004, w / 2, y + h / 2, 0.026, 0);
    b.box(M.white, -w / 2 + 0.004, y - h / 2 + 0.004, 0.026, w / 2 - 0.004, y + h / 2 - 0.004, 0.0275);
    b.box(M[mat], -w / 2 + 0.035, y - h / 2 + 0.035, 0.0275, w / 2 - 0.035, y + h / 2 - 0.035, 0.0295);
    return null;
  },
  mirror(b, M, { w = 0.9, h = 1.0, y = 1.55 }) {
    const f = 0.018, X = w / 2 + 0.012, Z = h / 2 + 0.012;
    bb(b, M.brass, -X, y - Z, 0, X, y - Z + f, 0.024, 0.003); bb(b, M.brass, -X, y + Z - f, 0, X, y + Z, 0.024, 0.003);
    bb(b, M.brass, -X, y - Z + f, 0, -X + f, y + Z - f, 0.024, 0.003); bb(b, M.brass, X - f, y - Z + f, 0, X, y + Z - f, 0.024, 0.003);
    bb(b, M.seam, -w / 2, y - h / 2, 0.003, w / 2, y + h / 2, 0.018, 0);                                 // fond du cadre
    cb(b, M.mirror, 0, y - h / 2 + 0.0005, 0.0225, w - 0.002, h - 0.001, 0.007, 0.0045);                 // glace biseautée
    return null;
  },
  /* Panneau mural mince (carrelage, crédence, tête de lit lattée…) : centré, plaqué contre le mur côté -z. */
  panel(b, M, { w = 2, h = 2.2, y = 0, t = 0.02, mat = 'wallTile', slats = false }) {
    if (!slats) { bb(b, M[mat], -w / 2, y, 0, w / 2, y + h, t, 0); return null; }
    bb(b, M.walnut, -w / 2, y, 0, w / 2, y + h, 0.012, 0);
    for (let x = -w / 2 + 0.02; x < w / 2 - 0.02; x += 0.055) bb(b, M[mat], x, y, 0.012, x + 0.032, y + h, 0.04, 0.003);
    return null;
  },
  /* Rideau plissé du sol au plafond sur rail noir ; sheer = largeur de voilage tiré à côté. */
  curtain(b, M, { w = 0.7, ceil = 2.6, h = ceil - 0.02, mat = 'taupe', sheer = 0, side = 1 }) {
    b.add(M[mat], drapeGeo(w, h - 0.05, 0.07, 0.035));
    if (sheer) b.geo(M.sheer, drapeGeo(sheer, h - 0.05, 0.11, 0.02), side * (w / 2 + sheer / 2), 0, -0.03);
    const x0 = Math.min(-w / 2, side * (w / 2 + sheer)) - 0.04, x1 = Math.max(w / 2, side * (w / 2 + sheer)) + 0.04;
    bb(b, M.black, x0, h - 0.03, -0.05, x1, h - 0.01, 0.05, 0.003);                                    // rail au plafond
    for (let x = x0 + 0.05; x < x1 - 0.03; x += 0.075) b.cyl(M.steel, x, h - 0.052, 0, 0.0045, 0.022, 6);   // glisseurs
    return null;
  },

  /* ── Repas ───────────────────────────────────────────────────────────── */
  /* Chaise coque tapissée sur quatre pieds fins évasés : assise à 47 cm, dossier à 80 cm. */
  chair(b, M, { mat = 'terra', leg = 'black' }) {
    b.add(M[mat], shellGeo(0.25, 0.045, 0.4, 0.4, 0.2, 1.7, 0.035, 18, 5));
    b.lathe(M[mat], 0, 0.392, 0.02, [[0.001, 0], [0.18, 0], [0.222, 0.01], [0.247, 0.034], [0.245, 0.062], [0.232, 0.073], [0.12, 0.079], [0.001, 0.078]], 20);          // assise bombée
    b.lathe(M.black, 0, 0.345, 0.01, [[0.15, 0], [0.15, 0.04], [0.125, 0.05], [0.001, 0.05]], 12);                       // platine sous l'assise
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.rod(M[leg], [sx * 0.13, 0.385, sz * 0.12], [sx * 0.225, 0.012, sz * 0.215], 0.0145, 6, 0.0085);                   // pied fuselé, évasé
      b.cyl(M.brass, sx * 0.225, 0, sz * 0.215, 0.0095, 0.014, 6);                                                         // sabot laiton
    }
    return null;
  },
  /* Table et ses chaises. round = table ronde en verre fumé sur piètement croisé (w = diamètre) ; sinon plateau de marbre sur piètement en U.
     n = nombre de chaises par grand côté (ou au total pour la ronde), ends = chaises en bout. La table est dressée. */
  diningTable(b, M, { w = 2.0, d = 1.0, top = 'marbleGrey', n = 3, ends = true, chairMat = 'greige', leg = 'black', round = false, dress = true }) {
    const R = rng(Math.round(w * 100) + n), seats = [];
    if (round) {
      const r = w / 2;
      b.lathe(M[top], 0, 0.7, 0, [[0.001, 0], [r - 0.01, 0], [r - 0.003, 0.004], [r, 0.014], [r - 0.003, 0.022], [r - 0.01, 0.025], [0.001, 0.025]], 60); b.cyl(M.black, 0, 0.68, 0, r * 0.55, 0.02, 30);
      for (const a of [PI / 4, -PI / 4]) { b.push(0, 0, 0, a); cb(b, M.black, 0, 0, 0, r * 1.2, 0.03, 0.05, 0.003); for (const sx of [-1, 1]) b.rod(M.black, [sx * r * 0.58, 0.02, 0], [sx * r * 0.2, 0.7, 0], 0.02, 6); b.pop(); }
      for (let i = 0; i < n; i++) { const a = (i / n) * 2 * PI + PI / n; seats.push([Math.sin(a) * (r + 0.1), Math.cos(a) * (r + 0.1), a + PI, Math.sin(a) * (r - 0.24), Math.cos(a) * (r - 0.24)]); }
    } else {
      cb(b, M[top], 0, 0.71, 0, w, 0.04, d, 0.008);
      cb(b, M.black, 0, 0.695, 0, w - 0.06, 0.016, d - 0.06, 0.002);                                                     // sous-plateau, laisse une ombre sous le marbre
      for (const sx of [-1, 1]) { const x = sx * w * 0.3; cb(b, M[leg], x, 0, 0, 0.08, 0.04, d * 0.72, 0.003); for (const sz of [-1, 1]) cb(b, M[leg], x, 0.04, sz * d * 0.36, 0.08, 0.655, 0.06, 0.003); cb(b, M[leg], x, 0.67, 0, 0.08, 0.04, d * 0.72, 0.003); }
      for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5); seats.push([x, -d / 2 - 0.13, 0, x, -d / 2 + 0.22], [x, d / 2 + 0.13, PI, x, d / 2 - 0.22]); }
      if (ends && ends !== 'b') seats.push([-w / 2 - 0.15, 0, PI / 2, -w / 2 + 0.22, 0]);      // ends : true = les deux bouts, 'a' = bout -x, 'b' = bout +x
      if (ends && ends !== 'a') seats.push([w / 2 + 0.15, 0, -PI / 2, w / 2 - 0.22, 0]);
    }
    for (const [x, z, rot, px, pz] of seats) {
      b.push(x, 0, z, rot); F.chair(b, M, { mat: chairMat }); b.pop();
      if (dress) {                                                                     // couvert : assiette plate et creuse, serviette, fourchette, couteau, verres
        const s = Math.sin(rot), c = Math.cos(rot);                                    // (s, c) : vers l'extérieur ; le côté droit du convive est (c, -s)
        b.lathe(M.ceramic, px, 0.75, pz, [[0.001, 0], [0.08, 0], [0.137, 0.017], [0.134, 0.019], [0.09, 0.007], [0.001, 0.007]], 16);
        b.lathe(M.ceramic, px, 0.757, pz, [[0.001, 0], [0.05, 0], [0.092, 0.012], [0.088, 0.013], [0.001, 0.007]], 12);
        cb(b, M.cream, px - c * 0.205 - s * 0.01, 0.75, pz + s * 0.205 - c * 0.01, 0.07, 0.006, 0.17, 0, rot);        // serviette pliée à gauche
        cb(b, M.steel, px + c * 0.17 + s * 0.1, 0.75, pz - s * 0.17 + c * 0.1, 0.012, 0.0035, 0.18, 0, rot);          // couteau
        glass(b, M, px + c * 0.11 - s * 0.19, 0.75, pz - s * 0.11 - c * 0.19);
        b.lathe(M.crystal, px + c * 0.2 - s * 0.17, 0.75, pz - s * 0.2 - c * 0.17, [[0.001, 0], [0.027, 0.001], [0.033, 0.09], [0.03, 0.092]], 10);   // verre à eau
      }
    }
    if (dress) {                                                                       // centre de table : chemin de lin, vase de pampas, carafe, bougies
      if (!round) cb(b, M.linen, 0, 0.75, 0, Math.min(0.34, d * 0.34), 0.004, w - 0.5, 0.001, PI / 2);
      vase(b, M.ceramic, 0, 0.75, 0, 0.8); plumes(b, M, 0, 0.99, 0, 0.42, 7, R);
      bottle(b, M.potDark, round ? 0.2 : w * 0.2, 0.75, 0.06); bottle(b, M.potDark, round ? -0.16 : -w * 0.22, 0.75, -0.1);
      candle(b, M, round ? 0.12 : w * 0.1, 0.75, round ? -0.2 : 0.1, 1); candle(b, M, round ? -0.22 : -w * 0.1, 0.75, round ? 0.08 : -0.12, 0.8);
    }
    return round ? [w + 0.5, w + 0.5] : [w + 0.1, d + 0.5];
  },
  /* Tabouret de bar : petite coque sur colonne et embase ronde, repose-pieds. h = hauteur d'assise (66 cm pour un plan à 91 cm). */
  stool(b, M, { mat = 'terra', h = 0.66 }) {
    b.add(M[mat], shellGeo(0.2, 0.03, h - 0.04, 0.26, 0.1, 1.65, 0.03, 18, 5));
    b.lathe(M[mat], 0, h - 0.04, 0.015, [[0.001, 0], [0.14, 0], [0.18, 0.01], [0.198, 0.03], [0.18, 0.062], [0.001, 0.065]], 18);
    b.cyl(M.black, 0, 0.015, 0, 0.022, h - 0.06, 10); b.lathe(M.black, 0, 0, 0, [[0.2, 0], [0.2, 0.01], [0.05, 0.03], [0.022, 0.05]], 20);
    b.ring(M.black, 0, 0.24, 0, 0.13, 0.008, 0, 0, 18, 4); b.rod(M.black, [0, 0.24, -0.13], [0, 0.24, 0.13], 0.006, 6);
    return null;
  },

  /* ── Cuisine ─────────────────────────────────────────────────────────── */
  /* Linéaire bas à gorge (gola) sans poignées : w le long de x, façades vers +z, plan de 4 cm à 91 cm. Les façades sont de vrais panneaux de 19 mm
     chanfreinés, séparés de 3 mm devant un caisson sombre ; le module de la plaque reçoit deux tiroirs, les autres des portes ou trois tiroirs.
     sink / hob = abscisse du centre ; upper = meubles hauts en chêne avec ruban LED ; splash = crédence. */
  kitchenRun(b, M, { w = 3, d = 0.63, front = 'anthracite', top = 'marbleDark', sink = null, hob = null, upper = false, splash = false, upperMat = 'oakV', splashMat = 'oak', deco = true }) {
    const wt = 0.87, y = wt + 0.04, fz = d / 2 - 0.019;
    b.box(M[front], -w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.1, d / 2 - 0.07);                         // socle en retrait, de la teinte des façades
    b.box(M.black, -w / 2 + 0.004, 0.1, -d / 2, w / 2 - 0.004, wt, fz);                                            // caisson (sombre : il fait les joints et la gorge)
    const n = Math.max(1, Math.round(w / 0.6)), mw = w / n, mod = (x) => (x === null ? -9 : Math.floor((x + w / 2) / mw));
    const si = mod(sink), dwi = sink === null ? -9 : (si + 1 < n && si + 1 !== mod(hob) ? si + 1 : si - 1 !== mod(hob) ? si - 1 : -9);   // lave-vaisselle à côté de l'évier
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + mw * i, cx = x0 + mw / 2, fw = mw - 0.003;
      const hasHob = hob !== null && Math.abs(hob - cx) < mw * 0.55, hasSink = sink !== null && Math.abs(sink - cx) < mw * 0.55;
      if (i === dwi) {                                                                                             // lave-vaisselle semi-intégré : bandeau de commande en verre noir
        cb(b, M[front], cx, 0.105, fz + 0.0095, fw, 0.6, 0.019, 0.0018); cb(b, M.screen, cx, 0.708, fz + 0.0095, fw, 0.097, 0.019, 0.0018);
        b.box(M.led, cx + fw * 0.18, 0.75, fz + 0.019, cx + fw * 0.3, 0.765, fz + 0.0195); for (let k = 0; k < 4; k++) b.box(M.steel, cx - fw * 0.3 + k * 0.04 - 0.006, 0.752, fz + 0.019, cx - fw * 0.3 + k * 0.04 + 0.006, 0.762, fz + 0.0198);
        continue;
      }
      const rows = hasHob ? [[0.105, 0.38], [0.383, 0.805]] : (!hasSink && i % 3 === 1) ? [[0.105, 0.3], [0.303, 0.55], [0.553, 0.805]] : [[0.105, 0.805]];
      for (const [ya, yb] of rows) cb(b, M[front], cx, ya, fz + 0.0095, fw, yb - ya - (rows.length > 1 || hasHob ? 0.003 : 0), 0.019, 0.0018);
    }
    const gx = dwi >= 0 ? -w / 2 + mw * (dwi + 0.5) : 0;                                                          // grille de ventilation du socle
    b.box(M.black, gx - 0.2, 0.025, d / 2 - 0.07, gx + 0.2, 0.075, d / 2 - 0.068); for (let k = 0; k < 4; k++) b.box(M.seam, gx - 0.19, 0.032 + k * 0.011, d / 2 - 0.068, gx + 0.19, 0.037 + k * 0.011, d / 2 - 0.0675);
    for (const sx of [-1, 1]) cb(b, M[front], sx * (w / 2 - 0.0095), 0.1, -0.01, 0.019, wt - 0.1, d - 0.02, 0.0015);   // joues d'extrémité
    cb(b, M[top], 0, wt, 0.0075, w + 0.01, 0.04, d + 0.015, 0.003);                                              // plan de travail, chant de 4 cm
    if (sink !== null) F._sink(b, M, sink, y, 0.02, -d / 2 + 0.07);
    if (hob !== null) F._hob(b, M, hob, y, 0.01);
    if (splash) {
      bb(b, M[splashMat], -w / 2, y, -d / 2, w / 2, 1.45, -d / 2 + 0.015, 0);
      for (const x of [-w / 2 + 0.45, w / 2 - 0.45, ...(w > 3 ? [0] : [])]) {                                       // prises doubles sur la crédence, loin de la plaque et de l'évier
        if ((hob !== null && Math.abs(x - hob) < 0.5) || (sink !== null && Math.abs(x - sink) < 0.45) || Math.abs(x) > w / 2 - 0.2) continue;
        cb(b, M.white, x, y + 0.2, -d / 2 + 0.015 + 0.005, 0.16, 0.085, 0.01, 0.002);
        for (const dx of [-0.038, 0.038]) { b.geo(M.ceramic, new THREE.CylinderGeometry(0.026, 0.026, 0.003, 12), x + dx, y + 0.2425, -d / 2 + 0.0265, PI / 2, 0, 0); for (const ex of [-0.0095, 0.0095]) b.box(M.black, x + dx + ex - 0.002, y + 0.24, -d / 2 + 0.027, x + dx + ex + 0.002, y + 0.244, -d / 2 + 0.0275); }
      }
    }
    if (upper) {
      const uz = -d / 2 + 0.35, nu = Math.max(1, Math.round(w / 0.6)), uw = w / nu;
      b.box(M.black, -w / 2 + 0.004, 1.452, -d / 2, w / 2 - 0.004, 2.248, uz - 0.019);                          // caissons hauts
      for (const sx of [-1, 1]) cb(b, M[upperMat], sx * (w / 2 - 0.0095), 1.45, -d / 2 + 0.175, 0.019, 0.8, 0.35, 0.0015);
      for (let i = 0; i < nu; i++) cb(b, M[upperMat], -w / 2 + uw * (i + 0.5), 1.452, uz - 0.0095, uw - 0.003, 0.796, 0.019, 0.0018);
      b.box(M.led, -w / 2 + 0.03, 1.442, -d / 2 + 0.04, w / 2 - 0.03, 1.45, -d / 2 + 0.07);
      b.box(M.glow, -w / 2 + 0.02, 0.95, -d / 2 + 0.017, w / 2 - 0.02, 1.45, -d / 2 + 0.019);
      b.light(0, 1.38, -d / 2 + 0.2, 0.6, 'led');
      if (hob !== null) {                                                                                      // hotte à tiroir intégrée sous le meuble haut
        cb(b, M.steel, hob, 1.428, -d / 2 + 0.2, 0.62, 0.022, 0.28, 0.003);
        for (let k = 0; k < 6; k++) b.box(M.black, hob - 0.26, 1.4265, -d / 2 + 0.09 + k * 0.034, hob + 0.26, 1.4285, -d / 2 + 0.1 + k * 0.034);
      }
    }
    if (deco) {                                                                        // bouilloire, machine à café, planche et ustensiles, là où le plan est libre
      const free = [-w / 2 + 0.32, w / 2 - 0.32, -w / 2 + 0.95, w / 2 - 0.95].filter((x) => Math.abs(x) < w / 2 - 0.2 && (sink === null || Math.abs(x - sink) > 0.62) && (hob === null || Math.abs(x - hob) > 0.6));
      const z = -d / 2 + 0.17;
      if (free.length > 0) {
        const x = free[0];
        cb(b, M.black, x, y, z, 0.2, 0.3, 0.26, 0.012); cb(b, M.steel, x, y + 0.095, z + 0.12, 0.14, 0.012, 0.09, 0.002); cup(b, M.ceramic, x, y + 0.1, z + 0.14, 0.9);
        b.cyl(M.steel, x, y + 0.3, z - 0.02, 0.05, 0.03, 12);
        b.lathe(M.steel, x + 0.26, y, z, [[0.07, 0], [0.078, 0.01], [0.082, 0.06], [0.062, 0.17], [0.03, 0.19], [0.026, 0.205], [0.001, 0.2]], 16); b.tube(M.black, [[x + 0.26 + 0.07, y + 0.15, z], [x + 0.26 + 0.1, y + 0.12, z], [x + 0.26 + 0.082, y + 0.05, z]], 0.007, 5);
      }
      if (free.length > 1) {
        const x = free[1];
        b.geo(M.oak, new THREE.BoxGeometry(0.28, 0.4, 0.018), x, y + 0.2, z - 0.09, -0.1, 0, 0); b.lathe(M.pot, x + 0.24, y, z, [[0.045, 0], [0.058, 0.14], [0.052, 0.14], [0.001, 0.01]], 14);
        for (let i = 0; i < 5; i++) b.rod(i % 2 ? M.steel : M.oak, [x + 0.24, y + 0.1, z], [x + 0.24 + (i - 2) * 0.022, y + 0.28 + (i % 3) * 0.02, z + (i % 2 - 0.5) * 0.03], 0.0055, 5);
        b.lathe(M.walnut, x - 0.2, y, z + 0.08, [[0.04, 0], [0.04, 0.2], [0.001, 0.2]], 8);
      }
      const jx = free.slice(2).flatMap((f) => [f + 0.3, f - 0.52]).find((x) => Math.abs(x) < w / 2 - 0.12 && Math.abs(x + 0.1) < w / 2 - 0.12 && (sink === null || Math.abs(x + 0.1 - sink) > 0.62) && (hob === null || Math.abs(x + 0.1 - hob) > 0.6));
      if (jx !== undefined) {                                                                                     // bocaux en verre à couvercle de chêne, contre la crédence
        const x = jx;
        for (let k = 0; k < 3; k++) { const hh = 0.13 + k * 0.05, xx = x + k * 0.1; b.cyl(M.crystal, xx, y, z - 0.07, 0.045, hh, 12); b.cyl([M.cream, M.terra, M.pot][k], xx, y + 0.004, z - 0.07, 0.04, hh * 0.65, 10); b.cyl(M.oak, xx, y + hh, z - 0.07, 0.047, 0.022, 12); }
      }
      if (free.length > 2) { const x = free[2]; bowl(b, M.ceramic, x, y, z + 0.1, 0.15); for (const [dx, dz] of [[-0.04, 0], [0.05, 0.03], [0, -0.05], [0.0, 0.05]]) b.sph(M.ochre, x + dx, y + 0.085, z + 0.1 + dz, 0.038, 1, 1, 1, 8); b.sph(M.sage, x + 0.01, y + 0.1, z + 0.1, 0.03, 1, 1.1, 1, 8); }
    }
    return [w, d];
  },
  _sink(b, M, x, y, z, zb) {                                                           // cuve noire sous plan à cadre inox + mitigeur noir col de cygne
    const sw = 0.72, sd = 0.42, f = 0.016;
    b.box(M.potDark, x - sw / 2, y, z - sd / 2, x + sw / 2, y + 0.003, z + sd / 2);
    for (const [ax, az, bx2, bz] of [[-sw / 2 - f, -sd / 2 - f, sw / 2 + f, -sd / 2], [-sw / 2 - f, sd / 2, sw / 2 + f, sd / 2 + f], [-sw / 2 - f, -sd / 2, -sw / 2, sd / 2], [sw / 2, -sd / 2, sw / 2 + f, sd / 2]]) bb(b, M.steel, x + ax, y, z + az, x + bx2, y + 0.006, z + bz, 0.0012);
    b.cyl(M.steel, x + 0.1, y + 0.003, z, 0.036, 0.003, 14); b.cyl(M.black, x + 0.1, y + 0.006, z, 0.012, 0.001, 8);
    for (let k = 0; k < 7; k++) b.box(M.black, x + sw / 2 + f + 0.05 + k * 0.03, y, z - 0.17, x + sw / 2 + f + 0.058 + k * 0.03, y + 0.003, z + 0.17);   // rainures d'égouttage
    b.lathe(M.black, x, y, zb, [[0.03, 0], [0.03, 0.008], [0.024, 0.014], [0.022, 0.04]], 14);
    b.tube(M.black, [[x, y + 0.03, zb], [x, y + 0.3, zb], [x, y + 0.38, zb + 0.05], [x, y + 0.38, zb + 0.15], [x, y + 0.32, zb + 0.19]], 0.0105, 10); b.cyl(M.black, x, y + 0.29, zb + 0.19, 0.014, 0.034, 10, 0.011);
    b.rod(M.black, [x + 0.022, y + 0.05, zb], [x + 0.09, y + 0.07, zb], 0.006, 6); b.lathe(M.black, x + 0.09, y + 0.07, zb, [[0.001, 0], [0.01, 0], [0.01, 0.012], [0.001, 0.012]], 8);
  },
  _hob(b, M, x, y, z) {                                                                // plaque à induction en verre noir, commandes tactiles
    cb(b, M.screen, x, y, z, 0.76, 0.006, 0.52, 0.0015);
    for (const [dx, dz, r] of [[-0.2, -0.1, 0.09], [0.18, -0.11, 0.075], [-0.2, 0.12, 0.075], [0.18, 0.11, 0.1]]) { b.ring(M.steel, x + dx, y + 0.0065, z + dz, r, 0.0022, 0, 0, 26, 4); b.ring(M.steel, x + dx, y + 0.0065, z + dz, r * 0.45, 0.0016, 0, 0, 18, 4); }
    for (let i = 0; i < 5; i++) b.box(M.steel, x - 0.12 + i * 0.06, y + 0.006, z + 0.235, x - 0.1 + i * 0.06, y + 0.0075, z + 0.24);
    b.box(M.led, x - 0.015, y + 0.006, z + 0.2, x + 0.015, y + 0.0072, z + 0.205);
  },
  /* Colonnes hautes, comme une cuisine équipée : à gauche le réfrigérateur-congélateur intégré (deux façades, grille au socle),
     à droite la colonne de cuisson à hauteur d'usage (tiroirs, four de 60 cm à 75 cm du sol, micro-ondes au-dessus, porte haute),
     entre les deux des armoires à provisions à deux portes. */
  kitchenTall(b, M, { w = 1.8, d = 0.63, h = 2.25, front = 'anthracite' }) {
    const fz = d / 2 - 0.019, F0 = M[front];
    b.box(F0, -w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.1, d / 2 - 0.07);                // socle en retrait, de la teinte des façades
    bb(b, F0, -w / 2 + 0.004, 0.1, -d / 2, w / 2 - 0.004, h - 0.004, fz - 0.004, 0);          // corps : visible de côté
    bb(b, M.black, -w / 2 + 0.006, 0.1, fz - 0.004, w / 2 - 0.006, h - 0.006, fz, 0);          // fond sombre des joints
    const n = Math.max(1, Math.round(w / 0.6)), door = (cx, fw, ya, yb) => cb(b, F0, cx, ya, fz + 0.0095, fw, yb - ya, 0.019, 0.0018);
    const grip = (x0, x1, left, ya, yb) => b.box(M.black, left ? x0 + 0.004 : x1 - 0.022, ya, d / 2 + 0.0005, left ? x0 + 0.022 : x1 - 0.004, yb, d / 2 + 0.0015);   // gorge verticale
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w / n) * i + 0.0015, x1 = -w / 2 + (w / n) * (i + 1) - 0.0015, cx = (x0 + x1) / 2, fw = x1 - x0;
      if (i === n - 1 && n > 1) {                                                      // colonne de cuisson
        door(cx, fw, 0.105, 0.415); door(cx, fw, 0.418, 0.728);
        for (const yb of [0.415, 0.728]) b.box(M.black, cx - fw * 0.35, yb - 0.03, d / 2 + 0.0005, cx + fw * 0.35, yb - 0.018, d / 2 + 0.0015);
        // four : bandeau de commande, porte vitrée sombre, poignée inox sur entretoises
        const oy = 0.731, oh = 0.595;
        cb(b, M.screen, cx, oy, fz + 0.0095, fw, oh, 0.019, 0.002);
        b.box(M.black, x0 + 0.04, oy + 0.05, fz + 0.0192, x1 - 0.04, oy + oh - 0.13, fz + 0.0198);
        b.box(M.led, cx - 0.035, oy + oh - 0.055, fz + 0.019, cx + 0.035, oy + oh - 0.04, fz + 0.0196);
        for (const kx of [x0 + 0.08, x1 - 0.08]) b.geo(M.steel, new THREE.CylinderGeometry(0.019, 0.019, 0.022, 14), kx, oy + oh - 0.048, d / 2 + 0.011, PI / 2, 0, 0);
        bb(b, M.steel, x0 + 0.05, oy + oh - 0.115, d / 2 + 0.022, x1 - 0.05, oy + oh - 0.1, d / 2 + 0.036, 0.003);
        for (const hx of [x0 + 0.07, x1 - 0.07]) b.box(M.steel, hx - 0.006, oy + oh - 0.115, d / 2, hx + 0.006, oy + oh - 0.1, d / 2 + 0.022);
        // micro-ondes encastré : hublot à gauche, afficheur et touches à droite
        const my = oy + oh + 0.003, mh = 0.445;
        cb(b, M.screen, cx, my, fz + 0.0095, fw, mh, 0.019, 0.002);
        b.box(M.black, x0 + 0.03, my + 0.08, fz + 0.0192, x1 - 0.16, my + mh - 0.08, fz + 0.0198);
        b.box(M.led, x1 - 0.12, my + mh - 0.1, fz + 0.019, x1 - 0.05, my + mh - 0.085, fz + 0.0196);
        for (let k = 0; k < 3; k++) b.box(M.steel, x1 - 0.1, my + 0.2 - k * 0.04, fz + 0.019, x1 - 0.07, my + 0.215 - k * 0.04, fz + 0.0196);
        door(cx, fw, my + mh + 0.003, h - 0.004); grip(x0, x1, false, my + mh + 0.05, h - 0.1);
      } else if (i === 0) {                                                            // réfrigérateur-congélateur intégré
        door(cx, fw, 0.105, 0.86); door(cx, fw, 0.863, h - 0.004);
        grip(x0, x1, true, 0.6, 0.84); grip(x0, x1, true, 0.9, 1.6);
        b.box(M.black, x0 + 0.08, 0.025, d / 2 - 0.07, x1 - 0.08, 0.075, d / 2 - 0.068); for (let k = 0; k < 4; k++) b.box(M.seam, x0 + 0.09, 0.032 + k * 0.011, d / 2 - 0.068, x1 - 0.09, 0.037 + k * 0.011, d / 2 - 0.0675);
      } else {
        door(cx, fw, 0.105, 1.0); door(cx, fw, 1.003, h - 0.004);
        grip(x0, x1, !!(i % 2), 0.2, h - 0.1);
      }
    }
    return [w, d];
  },
  /* Réfrigérateur posé, tel que repéré « R » sur les plans, (l'inox brossé clair, strié à grande échelle,
     faisait tôle), en laque anthracite mate comme les façades de cuisine : américain à deux portes et distributeur d'eau au-delà de 80 cm, combiné (congélateur en bas) en deçà. */
  fridge(b, M, { w = 0.85, d = 0.72, h = 1.92 }) {
    const body = M.anthracite, zf = d / 2 - 0.035;
    b.box(M.black, -w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.08, d / 2 - 0.06);
    cb(b, body, 0, 0.08, -0.0175, w - 0.006, h - 0.084, d - 0.035, 0.008);                    // carrosserie aux angles adoucis
    const pdoor = (x0, x1, y0, y1) => cb(b, body, (x0 + x1) / 2, y0, zf + 0.0155, x1 - x0, y1 - y0, 0.031, 0.006);
    const bar = (x, ya, yb) => { bb(b, M.steel, x - 0.009, ya, d / 2 + 0.014, x + 0.009, yb, d / 2 + 0.032, 0.006); for (const yy of [ya + 0.03, yb - 0.03]) b.box(M.steel, x - 0.006, yy - 0.008, d / 2 - 0.004, x + 0.006, yy + 0.008, d / 2 + 0.014); };
    if (w >= 0.8) {
      pdoor(-w / 2 + 0.003, -0.002, 0.085, h - 0.005); pdoor(0.002, w / 2 - 0.003, 0.085, h - 0.005);
      for (const sx of [-1, 1]) bar(sx * 0.04, 0.8, 1.5);
      cb(b, M.screen, -w / 4 - 0.01, 1.05, d / 2 - 0.002, 0.2, 0.32, 0.006, 0.003);                                  // distributeur d'eau et de glaçons
      b.box(M.black, -w / 4 - 0.07, 1.08, d / 2 + 0.001, -w / 4 + 0.05, 1.26, d / 2 + 0.004); b.box(M.led, -w / 4 - 0.05, 1.31, d / 2 + 0.001, -w / 4 + 0.03, 1.33, d / 2 + 0.0018);
    } else {
      pdoor(-w / 2 + 0.003, w / 2 - 0.003, 0.085, 0.8); pdoor(-w / 2 + 0.003, w / 2 - 0.003, 0.804, h - 0.005);
      bar(w / 2 - 0.06, 0.55, 0.76); bar(w / 2 - 0.06, 0.86, 1.25);
      b.box(M.led, -w / 2 + 0.08, 1.62, d / 2 + 0.0005, -w / 2 + 0.16, 1.64, d / 2 + 0.0012);
    }
    b.box(M.black, -w / 2 + 0.05, 0.02, d / 2 - 0.06, w / 2 - 0.05, 0.07, d / 2 - 0.058);                          // grille de ventilation du socle
    return [w, d];
  },
  /* Gaine technique maçonnée, toute hauteur (les rectangles barrés d'une croix sur les plans). */
  duct(b, M, { w = 0.6, d = 0.4, ceil = 2.6, h = ceil }) {
    b.box(M.plaster, -w / 2, 0, -d / 2, w / 2, h, d / 2);
    if (w >= 0.38) {                                                                   // trappe de visite au pied de la gaine : panneau peint affleurant, joint creux, serrure carrée
      const tw = Math.min(0.4, w - 0.12), ty = 0.18, th = 0.4;
      b.box(M.seam, -tw / 2 - 0.004, ty - 0.004, d / 2, tw / 2 + 0.004, ty + th + 0.004, d / 2 + 0.001);
      cb(b, M.white, 0, ty, d / 2 + 0.003, tw, th, 0.006, 0.0015); b.box(M.black, tw / 2 - 0.05, ty + th / 2 - 0.01, d / 2 + 0.006, tw / 2 - 0.03, ty + th / 2 + 0.01, d / 2 + 0.008);
    }
    return [w, d];
  },
  /* Îlot : plan épais débordant côté tabourets (+z), retombées en pierre aux deux bouts, niche éclairée. */
  island(b, M, { w = 3.0, d = 1.1, front = 'oakV', top = 'marble', hob = null, sink = null, stools = 0, stoolMat = 'greige', over = 0.28, deco = true }) {
    const dz = -over / 2, wt = 0.87, zf = d / 2 - over;
    b.box(M.black, -w / 2 + 0.06, 0, -d / 2 + 0.05, w / 2 - 0.06, 0.1, zf - 0.05);
    b.box(M.black, -w / 2 + 0.04, 0.1, -d / 2 + 0.019, w / 2 - 0.04, wt, zf - 0.019);
    const n = Math.max(1, Math.round(w / 0.6)), mw = (w - 0.08) / n;
    for (let i = 0; i < n; i++) {                                                                                  // façades côté cuisson (-z)
      const cx = -w / 2 + 0.04 + mw * (i + 0.5);
      for (const [ya, yb] of hob !== null && Math.abs(hob - cx) < mw * 0.55 ? [[0.105, 0.38], [0.383, 0.8]] : [[0.105, 0.8]]) cb(b, M[front], cx, ya, -d / 2 + 0.0095, mw - 0.003, yb - ya, 0.019, 0.0018);
    }
    cb(b, M[front], 0, 0.1, zf - 0.0095, w - 0.08, wt - 0.1, 0.019, 0.002);                                       // dos côté tabourets, en plein
    cb(b, M[top], 0, wt, 0, w, 0.04, d, 0.003);
    for (const sx of [-1, 1]) cb(b, M[top], sx * (w / 2 - 0.02), 0, 0, 0.04, wt, d, 0.003);                     // retombées de pierre aux bouts
    if (stools) { cb(b, M.walnut, 0, 0.42, zf + 0.0, w - 0.08, 0.3, 0.012, 0.002); b.box(M.led, -w / 2 + 0.06, 0.715, zf - 0.002, w / 2 - 0.06, 0.722, zf + 0.012); }
    if (stools) for (const sx of [-1, 0, 1]) if (sx !== 0 || w > 2) b.box(M.steel, sx * (w * 0.32) - 0.015, wt - 0.012, zf - 0.04, sx * (w * 0.32) + 0.015, wt, d / 2 - 0.02);    // équerres sous le porte-à-faux
    const y = wt + 0.04;
    if (hob !== null) {                                                                // plaque à hotte intégrée (aspiration centrale) : pas de hotte suspendue au-dessus de l'îlot
      F._hob(b, M, hob, y, dz); b.box(M.black, hob - 0.045, y + 0.006, dz - 0.21, hob + 0.045, y + 0.0068, dz + 0.21);
      for (let k = 0; k < 9; k++) b.box(M.steel, hob - 0.04, y + 0.0068, dz - 0.2 + k * 0.05, hob + 0.04, y + 0.0074, dz - 0.185 + k * 0.05);
    }
    if (sink !== null) F._sink(b, M, sink, y, dz + 0.03, dz - 0.2);
    for (let i = 0; i < stools; i++) { b.push(-w / 2 + (w / stools) * (i + 0.5), 0, d / 2 + 0.06, PI); F.stool(b, M, { mat: stoolMat }); b.pop(); }
    if (deco) {
      const x = w / 2 - 0.4, R = rng(31); vase(b, M.pot, x, y, dz, 0.9); plumes(b, M, x, y + 0.28, dz, 0.45, 6, R);
      const bx = -w / 2 + 0.45, bz = d / 2 - over * 0.8; bowl(b, M.ceramic, bx, y, bz, 0.14); for (const [ax, az, c] of [[-0.04, 0, 'ochre'], [0.05, 0.03, 'terra'], [0, -0.05, 'sage'], [0.01, 0.05, 'ochre']]) b.sph(M[c], bx + ax, y + 0.075, bz + az, 0.036, 1, 1, 1, 8);
      cb(b, M.oak, -w / 2 + 0.95, y, d / 2 - over * 0.55, 0.42, 0.022, 0.26, 0.004, 0.1);                         // planche à découper
    }
    return [w, d];
  },
  barTable(b, M, { w = 1.6, d = 0.9, top = 'marbleDark', stools = 2, stoolMat = 'terra' }) {
    cb(b, M[top], 0, 0.87, 0, w, 0.04, d, 0.008);
    for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.14); cb(b, M.black, x, 0.03, 0, 0.06, 0.84, d - 0.32, 0.003); cb(b, M.black, x, 0, 0, 0.1, 0.03, d - 0.2, 0.003); }
    for (let i = 0; i < stools; i++) {
      const x = -w / 2 + (w / stools) * (i + 0.5);
      b.push(x, 0, -d / 2 - 0.06, 0); F.stool(b, M, { mat: stoolMat }); b.pop();
      b.push(x, 0, d / 2 + 0.06, PI); F.stool(b, M, { mat: stoolMat }); b.pop();
    }
    vase(b, M.pot, w * 0.3, 0.91, 0, 0.8); plumes(b, M, w * 0.3, 1.15, 0, 0.36, 5, rng(9)); glass(b, M, -w * 0.2, 0.91, 0.08); glass(b, M, -w * 0.28, 0.91, -0.04);
    return [w, d + 0.3];
  },

  /* ── Chambres ────────────────────────────────────────────────────────── */
  /* Lit : tête côté -z, pied vers +z. Sommier tapissé, tête à panneaux bombés, matelas, couette aux plis souples avec rabat de drap, plaid plié au pied,
     oreillers froissés ; dessus de couette à 60 cm. */
  bed(b, M, { w = 1.6, l = 2.0, linen = 'cream', throwMat = 'greige', head = 'sand', hw = 0.5, nights = true }) {
    const hm = M[head], HW = w + hw, np = Math.max(2, Math.round(HW / 0.45)), seed = Math.round(w * 50 + l * 9), fl = folds(seed), fl2 = folds(seed + 3);
    for (let i = 0; i < np; i++) {
      const pw = HW / np - 0.008;
      soft(b, hm, -HW / 2 + (HW / np) * (i + 0.5), 0.05, -l / 2 - 0.045, pw, 1.07, 0.1, 0.035, { ni: [2, 4, 2], D: (x, y, z) => [0, 0, 0.016 * (1 - (2 * x / pw) ** 2) * (1 - (2 * y / 1.07) ** 2) * smooth(-0.02, 0.05, z)] });      // panneaux bombés
    }
    cb(b, M.black, 0, 0, 0, w - 0.12, 0.05, l - 0.12, 0.002);
    soft(b, hm, 0, 0.05, 0.01, w + 0.1, 0.26, l + 0.08, 0.04, { ni: [3, 2, 4] });                                  // sommier tapissé
    soft(b, M.white, 0, 0.3, 0.01, w, 0.22, l, 0.06, { ni: [3, 2, 4], nr: 2 });                                      // matelas
    const dl = l * 0.72 + 0.06, dz = l * 0.14 + 0.03;
    soft(b, M[linen], 0, 0.34, dz, w + 0.1, 0.26, dl, 0.07, { ni: [8, 3, 9], nr: 2, D: (x, y, z) => { const t = smooth(0, 0.13, y); return [(1 - t) * -Math.sign(x) * 0.012, t * (fl(x, z) * 0.016 + 0.012 * Math.exp(-((x * 1.6) ** 2) * 2.2)), t * (z > 0 ? 0.01 * smooth(0, dl / 2, z) : 0)]; } });   // couette
    soft(b, M.white, 0, 0.52, -l * 0.2, w + 0.06, 0.1, 0.32, 0.045, { ni: [8, 2, 3], nr: 2, D: (x, y, z) => [0, smooth(-0.02, 0.05, y) * (fl2(x, z) * 0.012 + 0.008 * Math.sin(x * 9)), 0] });          // rabat de drap
    const one = w < 1.2;
    const sa = w / 2 + 0.02, Rb = 0.04, drop = 0.3;                                                                  // plaid jeté en travers du pied : plat sur la couette, retombant de chaque côté
    const bend = (x, y, z) => { const u = Math.abs(x) - sa; if (u <= 0) return [0, smooth(-0.01, 0.025, y) * fl2(x, z) * 0.008, 0]; const k = Math.sign(x), th = Math.min(u / Rb, PI / 2), xx = sa + (u < Rb * PI / 2 ? Rb * Math.sin(th) : Rb + 0), yy = u < Rb * PI / 2 ? Rb * (Math.cos(th) - 1) : -(u - Rb * PI / 2) + Rb * -1 + Rb * 0; return [k * (xx - Math.abs(x)), yy + 0.006 * Math.sin(z * 22 + u * 14), 0]; };
    soft(b, M[throwMat], 0, 0.6, l * 0.36, w + 2 * (sa - w / 2 + Rb * 1.57 + drop - 0.02), 0.022, 0.46, 0.01, { ni: [26, 2, 3], D: bend });
    soft(b, M[throwMat], 0, 0.6225, l * 0.37, w * 0.7, 0.02, 0.3, 0.008, { ni: [8, 2, 3], D: (x, y, z) => [0, smooth(-0.01, 0.02, y) * fl(x, z) * 0.006, 0] });
    for (const [i, sx] of (one ? [0] : [-1, 1]).entries()) {
      const ex = one ? w * 0.72 : w * 0.44, ex2 = one ? w * 0.5 : w * 0.34;
      pillow(b, M.white, sx * w * 0.245, 0.83, -l / 2 + 0.17, ex, 0.17, 0.46, PI / 2 - 0.3, sx * 0.03, 0, seed + i, 10);                                        // oreiller dressé
      pillow(b, M.white, sx * w * 0.245, 0.67, -l / 2 + 0.43, ex * 0.9, 0.14, 0.34, PI / 2 - 1.0, -sx * 0.06, 0, seed + 9 + i, 8);                              // oreiller couché devant
      pillow(b, M[throwMat], sx * w * 0.23 + (one ? 0 : -sx * 0.03), 0.69, -l / 2 + 0.55, ex2, 0.12, 0.28, PI / 2 - 1.05, sx * 0.08, 0, seed + 20 + i, 7);          // petit coussin de couleur
    }
    if (nights) for (const sx of [-1, 1]) {                                            // chevets tambour en chêne à tiroir, lampe à pied céramique
      const x = sx * (w / 2 + 0.32), z = -l / 2 + 0.24;
      b.lathe(M.oak, x, 0, z, [[0.001, 0.0], [0.205, 0.0], [0.22, 0.012], [0.22, 0.366], [0.001, 0.366]], 22);
      b.cyl(M.black, x, 0.366, z, 0.2, 0.01, 22);
      b.lathe(M.oak, x, 0.374, z, [[0.001, 0], [0.205, 0], [0.22, 0.008], [0.22, 0.118], [0.214, 0.126], [0.001, 0.126]], 22);
      b.cyl(M.brass, x, 0.43, z + 0.22, 0.012, 0.012, 10); b.cyl(M.brass, x, 0.435, z + 0.23, 0.014, 0.014, 12);
      b.lathe(M.pot, x, 0.5, z - 0.03, [[0.05, 0], [0.075, 0.04], [0.065, 0.13], [0.025, 0.19], [0.012, 0.24]], 14);
      b.lathe(M.lampShade, x, 0.72, z - 0.03, [[0.12, 0], [0.095, 0.17], [0.09, 0.17], [0.114, 0]], 18); b.light(x, 0.85, z, 0.45);
      if (sx > 0) { const t = books(b, M, x + 0.02, 0.5, z + 0.1, 2, 0.19, 0.14); cup(b, M.ceramic, x + 0.0, t, z + 0.1, 0.8); }
    }
    return [w + 0.1, l + 0.16];
  },
  /* Placard toute hauteur, construit comme un placard sur mesure : joues finies de 19 mm du sol au fileur, fileur jusqu'au plafond,
     socle en retrait de 4 cm, façades au module de 45 à 60 cm séparées de 3 mm, caisson clair (fond, dessus, séparations).
     L'usage se lit dans les cotes des plans : chêne = chambre ou dressing (penderie, lingère, tiroirs, chaussures) ; laqué = entrée
     et couloir (manteaux, boîtes), 70 cm de fond = buanderie (aspirateur, planche à repasser, produits), plus de 80 cm = arrière-cuisine
     (provisions), moins de 50 cm = placard technique (tableau électrique, box) et rangement. Une porte entrouverte, une paire de
     portes pliantes à demi repliée ou un panneau coulissant poussé laissent voir l'intérieur ; derrière les portes fermées, seul
     ce qui reste visible dans la maquette coupée (sous 1,30 m) est garni. Tout est tiré d'une graine : même placard à chaque chargement. */
  wardrobe(b, M, { w = 2.2, d = 0.6, h = 2.35, mat = 'oak', ceil = 2.6 }) {
    // caisson intérieur peint en blanc (l'enduit des murs, déjà dessiné dans chaque calque), matériau sans décalage de profondeur
    // (rang 0 de main.js) : vues de biais à hauteur d'œil, des étagères d'un matériau décalé passaient devant les portes fermées
    // et y dessinaient des lignes claires
    const oak = mat === 'oak', m = M[oak ? 'oakV' : mat], inn = M.plaster, t = 0.019, pl = 0.08, gap = 0.003, R = rng(Math.round(w * 1000 + d * 77));
    const use = oak ? 'bed' : d < 0.35 ? 'tech' : d < 0.5 ? 'store' : d >= 0.8 ? 'pantry' : d >= 0.68 ? 'utility' : 'coats';
    const xi0 = -w / 2 + t, xi1 = w / 2 - t, wi = xi1 - xi0, slide = oak && w >= 2.6, fold = !oak && (use === 'coats' || use === 'utility' || use === 'pantry') && w >= 1.3;
    const zF = d / 2 - 0.001, zb = -d / 2 + 0.008, zf = slide ? d / 2 - 2 * t - 0.016 : d / 2 - t - 0.005, di = zf - zb, zc = (zb + zf) / 2, deck = pl + t;
    const hm = oak || slide ? M.black : M.brass;
    // caisson
    for (const sx of [-1, 1]) cb(b, m, sx * (w / 2 - t / 2), 0, 0, t, h, d, 0.0015);                         // joues finies, du sol au fileur
    cb(b, m, 0, 0, d / 2 - 0.04 - t / 2, wi, pl, t, 0.001);                                                    // socle en retrait
    bb(b, inn, xi0, pl, -d / 2, xi1, deck, zf, 0); bb(b, inn, xi0, h - t, -d / 2, xi1, h, zf, 0); bb(b, inn, xi0, deck, -d / 2, xi1, h - t, zb, 0);
    if (ceil - h > 0.01 && ceil - h < 0.7) cb(b, m, 0, h, d / 2 - 0.006 - t / 2, w, ceil - h - 0.003, t, 0.0015);   // fileur jusqu'au plafond, 5 mm en retrait des portes

    // façades : battantes (ou pliantes) au module, coulissantes au-delà de 2,60 m de chêne
    const n = slide ? 0 : Math.max(1, Math.round(wi / 0.52)), dw = n ? (wi - (n + 1) * gap) / n : 0;
    const handle = (lx) => { bb(b, hm, lx - 0.006, 0.9, 0.018, lx + 0.006, 1.22, 0.03, 0.002); for (const yy of [0.93, 1.19]) b.box(hm, lx - 0.004, yy - 0.006, 0, lx + 0.004, yy + 0.006, 0.018); };
    const leaf = (px, pz, rot, dir, hdl = true) => { b.push(px, 0, pz, rot); cb(b, m, dir * dw / 2, pl + gap, -t / 2, dw, h - pl - 2 * gap, t, 0.002); if (hdl) handle(dir * (dw - 0.04)); b.pop(); };
    let cols, oc, open;                                                                                         // colonnes intérieures, colonne ouverte, partie ouverte (x0, x1)
    if (slide) {
      const np = wi > 3 ? 3 : 2, ov = 0.03, pw = (wi + ov * (np - 1)) / np, zk = zF - t - 0.008, y0 = pl + 0.012, y1 = h - t - 0.032;
      for (let i = 0; i < np; i++) {
        const last = i === np - 1, x0 = last ? xi0 + (np - 2) * (pw - ov) + (i % 2 ? 0 : ov) : xi0 + i * (pw - ov), z = i % 2 ? zk : zF;   // le dernier panneau est poussé sur son voisin
        cb(b, m, x0 + pw / 2, y0, z - t / 2, pw, y1 - y0, t, 0.002);
        for (const ex of [x0 + 0.03, x0 + pw - 0.03]) b.box(M.black, ex - 0.007, 0.85, z, ex + 0.007, 1.25, z + 0.003);                     // tirettes encastrées
      }
      bb(b, M.black, xi0, y1 + 0.002, zk - t - 0.004, xi1, h, zF, 0.002); b.box(M.black, xi0, pl, zk - t - 0.004, xi1, deck + 0.008, zF - 0.002);   // rails haut et bas
      const nc = Math.max(2, Math.round(wi / 0.95)); cols = Array.from({ length: nc }, (_, i) => [xi0 + (wi * i) / nc, xi0 + (wi * (i + 1)) / nc]);
      open = np === 3 ? [xi0 + 2 * pw, xi1] : [xi0 + pw, xi1]; oc = nc - 1;
    } else {
      const x0 = (i) => xi0 + gap + i * (dw + gap);
      const ko = use === 'tech' || use === 'store' ? 0 : n >= 2 ? 1 : 0, ang = oak ? 1.15 : use === 'tech' ? 0.7 : 0.5;     // porte ouverte et son angle
      for (let i = 0; i < n; i++) {
        const single = n % 2 && i === n - 1, dir = !single && i % 2 === 0 ? 1 : -1, px = dir > 0 ? x0(i) : x0(i) + dw;
        if (fold && i === 0 && n >= 2) {                                                                       // paire pliante à demi repliée : V tourné vers la pièce
          const a = 0.87, L = dw + gap;
          leaf(px, zF, -a, 1, true); leaf(px + L * Math.cos(a) * 1, zF + L * Math.sin(a), a, 1, false); i++; continue;
        }
        leaf(px, zF, i === ko && !fold ? (dir > 0 ? -ang : ang) : 0, dir);
      }
      cols = []; for (let i = 0; i < n; i += 2) cols.push([x0(i) - gap, x0(Math.min(n, i + 2)) - gap]);
      cols[0][0] = xi0; cols[cols.length - 1][1] = xi1;
      oc = fold ? 0 : Math.floor(ko / 2); open = fold ? [xi0, x0(2) - gap] : [x0(ko), x0(ko) + dw];
    }
    for (let i = 1; i < cols.length; i++) cb(b, inn, cols[i][0], deck, zc, t, h - t - deck, di, 0.001);          // séparations

    // intérieur, colonne par colonne
    // palettes courtes, prises dans les tissus déjà présents dans le logement : chaque matière nouvelle coûterait un appel de dessin par calque
    const ys = h - t - 0.3, bedPal = ['cream', 'seam', 'taupe', 'terra', 'linen', 'seam', 'white'];
    const coatPal = ['seam', 'taupe', 'linen', 'seam'], linPal = ['white', 'cream', 'linen'];
    const shelf = (xa, xb, y) => b.box(inn, xa, y, zb, xb, y + t, zf - 0.01);
    const rail = (xa, xb, y) => { b.rod(M.steel, [xa, y, zc], [xb, y, zc], 0.011, 6); for (const x of [xa, xb]) b.box(M.steel, x - (x === xa ? 0 : 0.006), y - 0.015, zc - 0.012, x + (x === xa ? 0.006 : 0), y + 0.015, zc + 0.012); };
    const hang = (xa, xb, yr, pal, kinds, L0, L1, thick) => {
      for (let x = xa + 0.035; x < xb - 0.03;) { const tt = thick * (0.6 + R() * 0.8), k = kinds[(R() * kinds.length) | 0], L = (k === 'pants' ? 0.55 : L0 + R() * (L1 - L0)); x += tt / 2; if (x > xb - 0.03) break; garment(b, M, M[pal[(R() * pal.length) | 0]], k, x, yr, zc, Math.min(L, yr - deck - 0.05), tt, (R() - 0.5) * 0.05); x += tt / 2 + 0.008 + R() * 0.025; }
    };
    const top = (xa, xb, full, pal) => {                                                                          // étagère haute : boîtes et linge
      shelf(xa, xb, ys); if (!full) return;
      for (let x = xa + 0.02; x < xb - 0.2;) { const bw = 0.26 + R() * 0.12; if (x + bw > xb - 0.02) break; if (R() < 0.5) storeBox(b, M, ['linen', 'taupe'][(R() * 2) | 0], x + bw / 2, ys + t, zc + 0.02, bw, 0.18 + R() * 0.08, di - 0.08); else linenPile(b, M, x + bw / 2, ys + t, zc, bw, di * 0.7, 3 + ((R() * 3) | 0), R, pal); x += bw + 0.02 + R() * 0.05; }
    };
    const shelvesAt = (y0, y1, step) => { const out = []; for (let y = y0; y < y1 - 0.15; y += step) out.push(y); return out; };
    const bottles = (xa, xb, y, full) => { if (!full && y > 1.3) return; for (let x = xa + 0.05; x < xb - 0.05; x += 0.07 + R() * 0.05) { const r = 0.028 + R() * 0.02, hh = 0.14 + R() * 0.16, mm = [M.white, M.ceramic, M.terra][(R() * 3) | 0]; b.cyl(mm, x, y, zc + (R() - 0.3) * di * 0.4, r, hh, 8); b.cyl(M.white, x, y + hh, zc + 0, r * 0.45, 0.03, 6); } };
    const fill = (type, xa, xb, full) => {
      const cw = xb - xa, cx = (xa + xb) / 2;
      if (type === 'hang' || type === 'coats') {
        top(xa, xb, full, type === 'hang' ? linPal : coatPal); rail(xa, xb, ys - 0.05);
        if (type === 'hang') hang(xa, xb, ys - 0.05, bedPal, ['shirt', 'shirt', 'dress', 'coat'], 0.78, 1.15, 0.04);
        else hang(xa, xb, ys - 0.05, coatPal, ['coat', 'coat', 'shirt'], 0.9, 1.12, 0.07);
        shoes(b, M, xa, xb, deck, zc + di * 0.12, R, Math.round(cw / 0.26));
      } else if (type === 'double') {
        top(xa, xb, full, linPal); rail(xa, xb, ys - 0.05); rail(xa, xb, ys - 1.0);
        hang(xa, xb, ys - 0.05, bedPal, ['shirt'], 0.72, 0.8, 0.03); hang(xa, xb, ys - 1.0, ['seam', 'taupe', 'linen'], ['pants'], 0.55, 0.55, 0.035);
        shoes(b, M, xa, xb, deck, zc + di * 0.12, R, Math.round(cw / 0.26));
      } else if (type === 'shelves') {                                                                                // lingère : tiroirs à l'anglaise en bas, piles de linge
        const nd = 3, dh = (0.76 - deck) / nd;
        for (let k = 0; k < nd; k++) { const y = deck + k * dh + 0.003; cb(b, inn, cx, y, zf - 0.01, cw - 0.008, dh - 0.006, 0.018, 0.002); b.box(M.seam, cx - cw * 0.3, y + dh - 0.03, zf - 0.0005, cx + cw * 0.3, y + dh - 0.018, zf + 0.0005); }
        for (const y of [0.78, ...shelvesAt(1.12, ys, 0.32)]) { shelf(xa, xb, y); if (!full && y > 1.3) continue; const np = Math.max(1, Math.floor(cw / 0.3)); for (let k = 0; k < np; k++) linenPile(b, M, xa + (cw / np) * (k + 0.5), y + t, zc, Math.min(0.3, cw / np - 0.03), di * 0.75, 2 + ((R() * 4) | 0), R, k % 2 ? linPal : bedPal); }
        top(xa, xb, full, linPal);
      } else if (type === 'boxes' || type === 'products' || type === 'pantry') {
        const step = type === 'pantry' ? 0.34 : 0.4;
        for (const y of [deck, ...shelvesAt(deck + step, ys, step)]) {
          if (y > deck) shelf(xa, xb, y);
          const y1 = y + (y > deck ? t : 0); if (!full && y1 > 1.3) continue;
          if (type === 'boxes') { for (let x = xa + 0.02; x < xb - 0.2;) { const bw = 0.24 + R() * 0.14; if (x + bw > xb - 0.02) break; storeBox(b, M, ['linen', 'taupe', 'cream'][(R() * 3) | 0], x + bw / 2, y1, zc + 0.02, bw, 0.16 + R() * 0.12, Math.min(0.4, di - 0.06)); x += bw + 0.02 + R() * 0.06; } }
          else if (type === 'pantry' && R() < 0.5) { for (let x = xa + 0.04; x < xb - 0.12; x += 0.13 + R() * 0.04) { const hh = 0.2 + R() * 0.1; cb(b, M[['terra', 'cream', 'linen'][(R() * 3) | 0]], x + 0.05, y1, zc - di * 0.1, 0.1, hh, 0.07 + R() * 0.03, 0.002); } }
          else if (type === 'pantry') { for (let x = xa + 0.06; x < xb - 0.06; x += 0.12 + R() * 0.04) { const hh = 0.12 + R() * 0.08; b.cyl(R() < 0.5 ? M.ceramic : M.pot, x, y1, zc, 0.045, hh, 8); b.cyl(M.oak, x, y1 + hh, zc, 0.047, 0.02, 8); } }   // pots à couvercle de chêne
          else bottles(xa, xb, y1, full);
        }
        if (type === 'pantry') { b.lathe(M.rattan, cx, deck, zc, [[0.15, 0], [0.18, 0.2], [0.172, 0.2], [0.144, 0.01], [0.001, 0.01]], 14); for (const [ax, az] of [[-0.05, 0], [0.05, 0.03], [0, -0.06], [0.02, 0.06]]) b.sph(M.terra, cx + ax, deck + 0.05, zc + az, 0.04, 1, 1, 1, 8); }
      } else if (type === 'utility') {                                                                                // aspirateur balai, planche à repasser, balai, panier
        top(xa, xb, full, linPal);
        cb(b, M.white, xa + 0.06, deck, zc - di * 0.15, 0.028, 1.32, 0.38, 0.01, 0); b.rod(M.steel, [xa + 0.06, 0.3, zc + di * 0.1], [xa + 0.06, 1.45, zc + di * 0.12], 0.008, 6);   // planche repliée contre la joue
        const vx = xa + 0.25; b.rod(M.charcoal, [vx, deck + 0.03, zc + 0.05], [vx, 1.12, zc], 0.014, 8); cb(b, M.charcoal, vx, deck, zc + 0.08, 0.26, 0.05, 0.08, 0.01); b.cyl(M.charcoal, vx, 0.62, zc + 0.02, 0.05, 0.25, 12); b.cyl(M.charcoal, vx, 1.12, zc, 0.02, 0.12, 8);
        b.rod(M.oak, [xb - 0.1, deck + 0.1, zc - 0.05], [xb - 0.12, 1.5, zc - 0.12], 0.012, 6); cb(b, M.charcoal, xb - 0.1, deck, zc - 0.03, 0.08, 0.1, 0.3, 0.006);
        b.lathe(M.rattan, cx + 0.06, deck, zc + di * 0.18, [[0.15, 0], [0.18, 0.3], [0.172, 0.3], [0.144, 0.01], [0.001, 0.01]], 14); linenPile(b, M, cx + 0.06, deck + 0.24, zc + di * 0.18, 0.26, 0.24, 2, R, linPal);
      } else if (type === 'tech') {                                                                                   // gaine technique du logement : tableau électrique, coffret de communication, box
        const px = cx, pw = Math.min(0.46, cw - 0.06), zz = zb;
        cb(b, M.white, px, 1.0, zz + 0.05, pw, 0.62, 0.1, 0.004);                                                    // tableau, trois rangées de modules
        for (let r = 0; r < 3; r++) {
          const y = 1.08 + r * 0.17; b.box(M.plaster, px - pw / 2 + 0.03, y, zz + 0.1, px + pw / 2 - 0.03, y + 0.09, zz + 0.112);
          for (let k = 0; k < 12; k++) { const x = px - pw / 2 + 0.045 + k * ((pw - 0.09) / 11); b.box(k % 4 === 0 ? M.terra : M.black, x - 0.006, y + 0.038, zz + 0.112, x + 0.006, y + 0.056, zz + 0.122); }
        }
        b.box(M.seam, px - pw / 2 + 0.02, 1.0 + 0.6 - 0.02, zz + 0.1, px + pw / 2 - 0.02, 1.0 + 0.6, zz + 0.101);
        cb(b, M.white, px, 0.55, zz + 0.045, pw, 0.36, 0.09, 0.004); b.box(M.plaster, px - pw / 2 + 0.03, 0.6, zz + 0.09, px + pw / 2 - 0.03, 0.86, zz + 0.091);   // coffret de communication
        const sy = 0.42; shelf(xa, xb, sy); cb(b, M.white, px - 0.06, sy + t, zc, 0.2, 0.04, 0.15, 0.008); for (let k = 0; k < 4; k++) b.box(M.led, px - 0.12 + k * 0.025, sy + t + 0.02, zc + 0.075, px - 0.115 + k * 0.025, sy + t + 0.025, zc + 0.0755);   // box internet et ses voyants
        for (const dx of [-0.12, -0.04, 0.04, 0.12]) b.rod(M.charcoal, [px + dx, 1.0, zz + 0.03], [px + dx * 0.6, deck, zz + 0.03], 0.006, 4);   // gaines électriques
      }
    };
    const kinds = { bed: ['hang', 'shelves', 'double'], coats: ['coats', 'boxes'], utility: ['utility', 'products'], pantry: ['pantry'], tech: ['tech'], store: ['tech', 'boxes'] }[use];
    cols.forEach(([xa, xb], i) => {
      const type = use === 'store' || use === 'tech' ? kinds[Math.min(i, kinds.length - 1)] : kinds[(((i - oc) % kinds.length) + kinds.length) % kinds.length];
      const vis = open[1] > xa + 0.05 && open[0] < xb - 0.05;
      fill(type, xa + (i ? t / 2 : 0), xb - (i < cols.length - 1 ? t / 2 : 0), vis);
    });
    return [w, d];
  },
  dresser(b, M, { w = 1.9, d = 0.45, h = 0.72, mat = 'oak', tv = true }) {
    const fz = d / 2 - 0.019;
    b.box(M.black, -w / 2 + 0.02, 0.1, -d / 2 + 0.02, w / 2 - 0.02, h - 0.03, fz);
    cb(b, M[mat], 0, h - 0.03, 0, w, 0.03, d, 0.004);
    for (const sx of [-1, 1]) cb(b, M[mat], sx * (w / 2 - 0.009), 0.12, 0, 0.018, h - 0.15, d - 0.02, 0.002);
    const nd = 4, dw = (w - 0.036) / nd;
    for (let i = 0; i < nd; i++) for (const [ya, yb] of [[0.125, 0.4 * (h - 0.03) + 0.125 - 0.04], [0.4 * (h - 0.03) + 0.125, h - 0.034]]) {
      cb(b, M[mat], -w / 2 + 0.018 + dw * (i + 0.5), ya, fz + 0.0095, dw - 0.003, yb - ya, 0.019, 0.0018);
      b.box(M.black, -w / 2 + 0.018 + dw * (i + 0.5) - dw * 0.3, yb - 0.026, d / 2 + 0.0005, -w / 2 + 0.018 + dw * (i + 0.5) + dw * 0.3, yb - 0.014, d / 2 + 0.0012);     // gorge de préhension
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.rod(M.black, [sx * (w / 2 - 0.1), 0.125, sz * (d / 2 - 0.07)], [sx * (w / 2 - 0.07), 0.012, sz * (d / 2 - 0.05)], 0.014, 8, 0.009); b.cyl(M.brass, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.05), 0.0095, 0.014, 8); }
    if (tv) { bb(b, M.black, -0.63, h + 0.07, -0.05, 0.63, h + 0.8, -0.02, 0.003); b.box(M.screen, -0.62, h + 0.08, -0.02, 0.62, h + 0.79, -0.0165); cb(b, M.black, 0, h, -0.03, 0.4, 0.012, 0.16, 0.003); b.box(M.black, -0.03, h + 0.012, -0.06, 0.03, h + 0.1, -0.03); }
    for (let i = 0; i < 2; i++) bowl(b, M.pot, -w / 2 + 0.22 + i * 0.2, h, 0.02 + i * 0.05, 0.085 - i * 0.015);
    return [w, d];
  },
  desk(b, M, { w = 1.6, d = 0.65, top = 'walnut', leg = 'black', chair = 'greige', lamp = true }) {
    cb(b, M[top], 0, 0.68, 0, w, 0.035, d, 0.005);
    for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.06); cb(b, M[leg], x, 0, 0, 0.03, 0.03, d - 0.1, 0.002); for (const sz of [-1, 1]) cb(b, M[leg], x, 0.03, sz * (d / 2 - 0.065), 0.03, 0.65, 0.03, 0.002); cb(b, M[leg], x, 0.665, 0, 0.03, 0.015, d - 0.1, 0.002); }
    // écran de 27 pouces sur pied, clavier et souris ; ordinateur portable refermé à côté
    const ex = w > 1.2 ? -0.08 : 0, ez = -d / 2 + 0.17;
    cb(b, M.black, ex, 0.715, ez, 0.22, 0.008, 0.17, 0.003); b.box(M.black, ex - 0.02, 0.723, ez - 0.06, ex + 0.02, 1.0, ez - 0.035);
    cb(b, M.black, ex, 0.86, ez - 0.03, 0.62, 0.37, 0.022, 0.004); b.box(M.screen, ex - 0.3, 0.875, ez - 0.0185, ex + 0.3, 1.218, ez - 0.0175);
    cb(b, M.white, ex, 0.715, ez + 0.27, 0.42, 0.012, 0.13, 0.004); for (let r = 0; r < 4; r++) b.box(M.black, ex - 0.195, 0.727, ez + 0.218 + r * 0.027, ex + 0.195, 0.729, ez + 0.237 + r * 0.027);
    b.sph(M.white, ex + 0.3, 0.722, ez + 0.28, 0.03, 0.9, 0.35, 1.5, 10);
    if (w > 1.2) { cb(b, M.steel, ex + 0.55, 0.715, ez + 0.12, 0.31, 0.016, 0.22, 0.004, -0.15); }
    if (lamp) { const x = w * 0.36, z = -d * 0.2; b.lathe(M.black, x, 0.715, z, [[0.001, 0], [0.07, 0], [0.072, 0.012], [0.001, 0.012]], 18); b.tube(M.black, [[x, 0.726, z], [x, 0.99, z], [x - 0.04, 1.09, z + 0.03], [x - 0.14, 1.13, z + 0.1]], 0.008, 6); b.lathe(M.black, x - 0.17, 1.07, z + 0.12, [[0.075, 0], [0.03, 0.07], [0.02, 0.07], [0.068, 0]], 14); b.light(x - 0.17, 1.05, z + 0.12, 0.5); }
    const tb = books(b, M, -w * 0.34, 0.715, -d * 0.1, 3); cup(b, M.ceramic, -w * 0.34 + 0.05, tb, -d * 0.1, 0.8);
    if (w <= 1.2) cb(b, M.cream, -w * 0.15, 0.715, 0.12, 0.2, 0.012, 0.28, 0.002, 0.15); b.lathe(M.potDark, w * 0.2, 0.715, 0.12, [[0.03, 0], [0.034, 0.1], [0.03, 0.1], [0.001, 0.004]], 12);
    if (chair) { b.push(0, 0, d / 2 + 0.2, PI); F.officeChair(b, M, { mat: chair }); b.pop(); }
    return [w, d + (chair ? 0.3 : 0)];
  },
  officeChair(b, M, { mat = 'greige' }) {
    b.add(M[mat], shellGeo(0.25, 0.04, 0.42, 0.42, 0.2, 1.65, 0.035, 20, 6));
    b.lathe(M[mat], 0, 0.4, 0.02, [[0.001, 0], [0.18, 0], [0.222, 0.012], [0.245, 0.034], [0.243, 0.052], [0.228, 0.062], [0.12, 0.066], [0.001, 0.065]], 24);
    b.cyl(M.steel, 0, 0.06, 0, 0.024, 0.34, 10); b.cyl(M.black, 0, 0.35, 0, 0.1, 0.05, 16, 0.16);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 2 * PI; b.rod(M.steel, [0, 0.08, 0], [Math.sin(a) * 0.3, 0.045, Math.cos(a) * 0.3], 0.016, 6, 0.012); b.cyl(M.black, Math.sin(a) * 0.3, 0.0, Math.cos(a) * 0.3, 0.022, 0.045, 8); }
    return null;
  },
  vanityTable(b, M, { w = 1.3, d = 0.42 }) {
    cb(b, M.marble, 0, 0.72, 0, w, 0.03, d, 0.005);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod(M.brass, [sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05)], [sx * (w / 2 - 0.05), 0.72, sz * (d / 2 - 0.05)], 0.008, 8, 0.0135);
    b.geo(M.mirror, new THREE.CylinderGeometry(0.2, 0.2, 0.008, 36), 0, 1.02, -d / 2 + 0.05, PI / 2 - 0.1, 0, 0); b.ring(M.brass, 0, 1.02, -d / 2 + 0.05, 0.2, 0.008, PI / 2 - 0.1, 0, 36, 6);
    b.rod(M.brass, [0, 0.82, -d / 2 + 0.02], [0, 0.75, -d / 2 + 0.06], 0.006, 6);
    b.lathe(M.brass, -w * 0.3, 0.75, 0.0, [[0.001, 0], [0.09, 0], [0.095, 0.008], [0.09, 0.012], [0.001, 0.012]], 20);                                      // plateau laiton
    b.lathe(M.crystal, -w * 0.3 - 0.03, 0.762, 0.0, [[0.02, 0], [0.032, 0.03], [0.03, 0.07], [0.012, 0.09], [0.01, 0.11]], 12); b.lathe(M.ceramic, -w * 0.3 + 0.035, 0.762, -0.02, [[0.025, 0], [0.03, 0.06], [0.012, 0.09], [0.001, 0.09]], 12);
    vase(b, M.pot, w * 0.32, 0.75, -0.04, 0.55); candle(b, M, w * 0.1, 0.75, 0.05, 0.9);
    b.push(0, 0, d / 2 + 0.2, PI); F.pouf(b, M, { mat: 'sand' }); b.pop();
    return [w, d + 0.2];
  },
  pouf(b, M, { mat = 'sand', r = 0.24 }) {
    b.lathe(M[mat], 0, 0, 0, [[r * 0.7, 0], [r * 0.9, 0.012], [r, 0.07], [r * 1.02, 0.2], [r, 0.32], [r * 0.9, 0.395], [r * 0.7, 0.425], [r * 0.3, 0.435], [0.001, 0.437]], 26);
    b.lathe(M.cream, 0, 0.436, 0, [[0.001, 0.004], [0.012, 0.004], [0.012, 0], [0.001, 0]], 8);
    return null;
  },
  /* Banquette de pied de lit tapissée. */
  bench(b, M, { w = 1.4, d = 0.42, mat = 'sand' }) {
    soft(b, M[mat], 0, 0.14, 0, w, 0.3, d, 0.06, { ni: [5, 2, 3], nr: 2, D: (x, y, z) => [0, 0.012 * smooth(0.0, 0.15, y) * (1 - (2 * x / w) ** 2), 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.rod(M.black, [sx * (w / 2 - 0.09), 0.14, sz * (d / 2 - 0.08)], [sx * (w / 2 - 0.095), 0.012, sz * (d / 2 - 0.085)], 0.017, 8, 0.011); b.cyl(M.brass, sx * (w / 2 - 0.095), 0, sz * (d / 2 - 0.085), 0.012, 0.014, 8); }
    return [w, d];
  },

  /* ── Pièces d'eau ────────────────────────────────────────────────────── */
  /* Baignoire : free = îlot ovale à bord roulé avec mitigeur sur pied ; sinon encastrée dans un tablier carrelé. */
  bathtub(b, M, { w = 0.82, l = 1.78, free = false }) {
    if (free) {
      const pts = [[0.3, 0], [0.38, 0.008], [0.44, 0.04], [0.485, 0.2], [0.512, 0.4], [0.525, 0.545], [0.52, 0.575], [0.505, 0.588], [0.49, 0.585], [0.478, 0.565], [0.445, 0.3], [0.4, 0.17], [0.3, 0.115], [0.12, 0.105], [0.001, 0.104]].map(([r, y]) => new THREE.Vector2(r, y));
      b.geo(M.ceramic, new THREE.LatheGeometry(pts, 40), 0, 0, 0, 0, 0, 0, w / 1.04, 1, l / 1.04);
      b.cyl(M.steel, 0, 0.104, -l * 0.28, 0.03, 0.003, 14);                                                        // bonde
      const tx = w / 2 + 0.09, tz = -l * 0.18;
      b.lathe(M.black, tx, 0, tz, [[0.001, 0], [0.06, 0], [0.062, 0.012], [0.04, 0.02], [0.022, 0.04]], 16);
      b.tube(M.black, [[tx, 0.03, tz], [tx, 0.86, tz], [tx - 0.03, 0.95, tz], [tx - 0.2, 0.95, tz], [tx - 0.24, 0.9, tz]], 0.014, 10); b.cyl(M.black, tx - 0.24, 0.87, tz, 0.016, 0.03, 8, 0.012);
      b.rod(M.black, [tx, 0.7, tz], [tx, 0.7, tz + 0.08], 0.008, 6); b.rod(M.black, [tx, 0.62, tz], [tx, 0.62, tz - 0.08], 0.008, 6);
      b.rod(M.black, [tx, 0.78, tz], [tx + 0.05, 0.4, tz + 0.05], 0.004, 5);                                       // flexible de la douchette
      return [w + 0.2, l];
    }
    const t = 0.07;
    bb(b, M.wallTile, -w / 2, 0, -l / 2, w / 2, 0.56, -l / 2 + t, 0.003); bb(b, M.wallTile, -w / 2, 0, l / 2 - t, w / 2, 0.56, l / 2, 0.003); bb(b, M.wallTile, -w / 2, 0, -l / 2 + t, -w / 2 + t, 0.56, l / 2 - t, 0.003); bb(b, M.wallTile, w / 2 - t, 0, -l / 2 + t, w / 2, 0.56, l / 2 - t, 0.003);
    b.box(M.ceramic, -w / 2 + t, 0.1, -l / 2 + t, w / 2 - t, 0.13, l / 2 - t); b.box(M.ceramic, -w / 2 + t - 0.004, 0.13, -l / 2 + t - 0.004, w / 2 - t + 0.004, 0.555, -l / 2 + t); b.box(M.ceramic, -w / 2 + t - 0.004, 0.13, l / 2 - t, w / 2 - t + 0.004, 0.555, l / 2 - t + 0.004);
    b.cyl(M.steel, 0, 0.13, l * 0.3, 0.03, 0.003, 14);
    b.cyl(M.black, 0, 0.56, -l / 2 + 0.04, 0.022, 0.012, 10);
    b.tube(M.black, [[0, 0.57, -l / 2 + 0.04], [0, 0.7, -l / 2 + 0.04], [0, 0.72, -l / 2 + 0.16]], 0.012, 8); b.rod(M.black, [0.02, 0.62, -l / 2 + 0.04], [0.08, 0.64, -l / 2 + 0.04], 0.006, 6);
    return [w, l];
  },
  /* Meuble vasque suspendu en chêne, plan en pierre, vasques à poser, mitigeurs noirs, miroir rétro-éclairé au mur (-z). */
  vanity(b, M, { w = 1.5, d = 0.5, double = true, mat = 'oak', mirrorH = 0.9 }) {
    const fz = d / 2 - 0.018, nd = double ? 2 : 1;
    b.box(M.black, -w / 2, 0.4, -d / 2, w / 2, 0.82, fz);
    for (let i = 0; i < nd; i++) for (const [ya, yb] of [[0.403, 0.61], [0.613, 0.817]]) cb(b, M[mat], -w / 2 + (w / nd) * (i + 0.5), ya, fz + 0.009, w / nd - 0.004, yb - ya, 0.018, 0.0018);
    b.box(M.led, -w / 2 + 0.04, 0.392, -d / 2 + 0.05, w / 2 - 0.04, 0.4, d / 2 - 0.05);                                  // ruban sous le meuble
    cb(b, M.marble, 0, 0.82, 0.0025, w + 0.01, 0.03, d + 0.015, 0.003);
    const xs = double ? [-w * 0.25, w * 0.25] : [0];
    for (const x of xs) {
      b.lathe(M.ceramic, x, 0.85, 0.03, [[0.09, 0], [0.14, 0.015], [0.185, 0.07], [0.2, 0.125], [0.19, 0.13], [0.176, 0.075], [0.13, 0.04], [0.03, 0.03], [0.001, 0.03]], 28);
      b.lathe(M.black, x, 0.85, -d / 2 + 0.07, [[0.026, 0], [0.026, 0.008], [0.02, 0.014], [0.018, 0.03]], 12); b.tube(M.black, [[x, 0.86, -d / 2 + 0.07], [x, 1.1, -d / 2 + 0.07], [x, 1.13, -d / 2 + 0.1], [x, 1.12, -d / 2 + 0.2]], 0.01, 8); b.rod(M.black, [x + 0.018, 0.93, -d / 2 + 0.07], [x + 0.07, 0.95, -d / 2 + 0.07], 0.005, 6);
    }
    bb(b, M.led, -w / 2 + 0.02, 1.1, -d / 2 + 0.006, w / 2 - 0.02, 1.14 + mirrorH, -d / 2 + 0.02, 0);        // halo derrière le miroir
    cb(b, M.mirror, 0, 1.13, -d / 2 + 0.0235, w - 0.1, mirrorH - 0.02, 0.007, 0.004);
    const sx = w / 2 - 0.12;
    b.lathe(M.potDark, sx, 0.85, -0.1, [[0.028, 0], [0.028, 0.14], [0.001, 0.14]], 12); b.cyl(M.steel, sx, 0.99, -0.1, 0.008, 0.035, 6); b.rod(M.steel, [sx, 1.02, -0.1], [sx + 0.02, 1.03, -0.085], 0.004, 4);        // distributeur de savon
    cb(b, M.cream, double ? 0 : -w / 2 + 0.16, 0.85, 0.08, 0.2, 0.05, 0.28, 0.012); cb(b, M.white, double ? 0 : -w / 2 + 0.16, 0.9, 0.08, 0.19, 0.045, 0.27, 0.012);   // serviettes pliées
    const ex = double ? w * 0.4 : -w / 2 + 0.1, RR = rng(Math.round(w * 40));
    b.lathe(M.crystal, ex, 0.85, -0.15, [[0.01, 0], [0.04, 0.0], [0.04, 0.09], [0.035, 0.09]], 10);                    // verre et tiges d'eucalyptus
    for (let k = 0; k < 4; k++) b.rod(M.leafCypress, [ex, 0.9, -0.15], [ex + (k - 1.5) * 0.035, 1.1 + k * 0.025, -0.15 + (k % 2 - 0.5) * 0.05], 0.0028, 3);
    leaves(b, M.leafOlive, ex, 1.12, -0.15, 0.07, 9, 0.13, RR, 0.9);
    b.light(0, 1.6, 0.1, 0.7, 'led');
    return [w, d];
  },
  /* WC suspendu sur bâti-support carrelé : cuvette à 42 cm, abattant, plaque de commande à deux touches. */
  toilet(b, M, { }) {
    bb(b, M.wallTile, -0.45, 0, -0.33, 0.45, 1.15, -0.25, 0.003); bb(b, M.steel, -0.12, 0.92, -0.25, 0.12, 1.07, -0.243, 0.002);
    for (const sx of [-1, 1]) b.cyl(M.white, sx * 0.045, 0.99, -0.243, 0.02, 0.004, 14);
    b.geo(M.ceramic, new THREE.LatheGeometry([[0.001, 0], [0.08, 0.005], [0.13, 0.03], [0.17, 0.09], [0.185, 0.16], [0.186, 0.2], [0.18, 0.235], [0.17, 0.25]].map(([r, y]) => new THREE.Vector2(r, y)), 30), 0, 0.17, 0.021, 0, 0, 0, 1.0, 1, 1.45);
    cb(b, M.ceramic, 0, 0.2, -0.235, 0.3, 0.22, 0.03, 0.01);
    b.geo(M.white, new THREE.LatheGeometry([[0.19, 0], [0.19, 0.012], [0.184, 0.02], [0.15, 0.022], [0.001, 0.022]].map(([r, y]) => new THREE.Vector2(r, y)), 30), 0, 0.42, 0.021, 0, 0, 0, 0.985, 1, 1.43);
    for (const sx of [-1, 1]) b.cyl(M.steel, sx * 0.11, 0.436, -0.23, 0.012, 0.012, 8);
    // dérouleur noir et son rouleau sur le coffrage, balayette dans son pot au pied
    b.box(M.black, 0.33, 0.7, -0.25, 0.345, 0.73, -0.2); b.rod(M.black, [0.345, 0.715, -0.21], [0.24, 0.715, -0.21], 0.005, 6);
    b.geo(M.white, new THREE.CylinderGeometry(0.055, 0.055, 0.1, 16), 0.29, 0.715, -0.2, 0, 0, PI / 2); b.geo(M.cream, new THREE.CylinderGeometry(0.02, 0.02, 0.101, 10), 0.29, 0.715, -0.2, 0, 0, PI / 2);
    b.lathe(M.black, -0.33, 0, -0.17, [[0.001, 0], [0.045, 0], [0.048, 0.01], [0.046, 0.3], [0.04, 0.3], [0.04, 0.02], [0.001, 0.02]], 14); b.rod(M.black, [-0.33, 0.28, -0.17], [-0.33, 0.42, -0.17], 0.006, 6);
    return [0.5, 0.62];
  },
  /* Lave-mains : vasque murale, mitigeur noir, miroir rond. */
  basin(b, M, { w = 0.45 }) {
    b.geo(M.ceramic, rbox(w, 0.12, 0.28, 0.035, 3), 0, 0.82, 0.0); b.box(M.tubIn, -w / 2 + 0.04, 0.8815, -0.09, w / 2 - 0.04, 0.8845, 0.1);
    b.cyl(M.steel, 0, 0.8845, 0.02, 0.022, 0.003, 12);
    b.lathe(M.black, 0, 0.88, -0.11, [[0.022, 0], [0.022, 0.01], [0.015, 0.016], [0.013, 0.03]], 10); b.tube(M.black, [[0, 0.89, -0.11], [0, 1.0, -0.11], [0, 1.02, -0.08], [0, 1.0, -0.02]], 0.008, 8);
    b.geo(M.mirror, new THREE.CylinderGeometry(0.24, 0.24, 0.008, 38), 0, 1.5, -0.135, PI / 2, 0, 0); b.ring(M.black, 0, 1.5, -0.135, 0.24, 0.007, PI / 2, 0, 38, 6);
    b.lathe(M.steel, 0, 0.5, -0.1, [[0.02, 0], [0.02, 0.26], [0.001, 0.26]], 8);
    b.lathe(M.ceramic, w / 2 - 0.05, 0.88, 0.0, [[0.001, 0], [0.025, 0], [0.025, 0.07], [0.001, 0.07]], 10);
    return [w, 0.3];
  },
  /* Douche à l'italienne : receveur carrelé de plain-pied, paroi(s) vitrée(s) à profilés noirs, colonne avec ciel de pluie. glass = côtés fermés. */
  shower(b, M, { w = 1.2, d = 0.95, glass = ['front'] }) {
    b.box(M.wallTile, -w / 2, 0.0, -d / 2, w / 2, 0.012, d / 2); b.box(M.steel, -0.3, 0.012, -d / 2 + 0.08, 0.3, 0.014, -d / 2 + 0.14); b.box(M.potDark, -0.28, 0.014, -d / 2 + 0.1, 0.28, 0.0165, -d / 2 + 0.12);      // caniveau
    bb(b, M.wallTile, -w / 2, 0, -d / 2, w / 2, 2.2, -d / 2 + 0.015, 0);
    const pane = (x0, z0, x1, z1) => { b.box(M.glass, x0, 0.012, z0, x1, 2.05, z1); bb(b, M.black, x0 - 0.004, 2.05, z0 - 0.004, x1 + 0.004, 2.07, z1 + 0.004, 0.0015); bb(b, M.black, x0 - 0.004, 0.0, z0 - 0.004, x1 + 0.004, 0.018, z1 + 0.004, 0.0015); };
    for (const g of glass) {
      if (g === 'front') { pane(-w / 2, d / 2 - 0.01, w / 2 - 0.55, d / 2); bb(b, M.black, w / 2 - 0.555, 0, d / 2 - 0.012, w / 2 - 0.545, 2.07, d / 2 + 0.002, 0.0015); bb(b, M.black, -w / 2 - 0.004, 0, d / 2 - 0.014, -w / 2 + 0.008, 2.07, d / 2 + 0.004, 0.0015); b.rod(M.steel, [w / 2 - 0.62, 1.0, d / 2 + 0.02], [w / 2 - 0.62, 1.1, d / 2 + 0.02], 0.007, 6); }
      if (g === 'left') pane(-w / 2, -d / 2, -w / 2 + 0.01, d / 2);
      if (g === 'right') pane(w / 2 - 0.01, -d / 2, w / 2, d / 2);
    }
    const x = -w / 2 + 0.3, z = -d / 2 + 0.015;
    b.tube(M.black, [[x, 1.1, z + 0.01], [x, 2.12, z + 0.01], [x, 2.16, z + 0.05], [x, 2.16, z + 0.34]], 0.011, 10);
    b.lathe(M.black, x, 2.13, z + 0.34, [[0.001, 0], [0.13, 0], [0.135, 0.004], [0.13, 0.012], [0.001, 0.012]], 28);                                  // ciel de pluie
    b.cyl(M.steel, x, 2.128, z + 0.34, 0.11, 0.002, 24);
    b.geo(M.black, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 18), x, 1.1, z + 0.015, PI / 2, 0, 0); b.rod(M.black, [x, 1.1, z + 0.03], [x + 0.06, 1.1, z + 0.05], 0.006, 6);
    b.rod(M.black, [x + 0.22, 0.95, z + 0.03], [x + 0.22, 1.7, z + 0.03], 0.008, 6); b.geo(M.black, new THREE.CylinderGeometry(0.04, 0.03, 0.02, 14), x + 0.22, 1.62, z + 0.07, PI / 2 - 0.5, 0, 0);
    b.tube(M.black, [[x + 0.22, 1.55, z + 0.05], [x + 0.28, 1.2, z + 0.06], [x + 0.18, 0.9, z + 0.06]], 0.004, 5);                                    // flexible
    b.box(M.wallTile, w / 2 - 0.42, 1.1, -d / 2 + 0.015, w / 2 - 0.1, 1.4, -d / 2 + 0.018); for (let i = 0; i < 2; i++) b.lathe(i ? M.pot : M.potDark, w / 2 - 0.34 + i * 0.12, 1.1, -d / 2 + 0.05, [[0.025, 0], [0.027, 0.1], [0.018, 0.12], [0.012, 0.13], [0.012, 0.145], [0.001, 0.145]], 10);
    b.box(M.steel, w / 2 - 0.42, 1.098, -d / 2 + 0.015, w / 2 - 0.1, 1.1, -d / 2 + 0.12);
    return null;
  },
  /* Sèche-serviettes noir à barreaux, garni d'une serviette pliée sur le barreau. */
  towelRail(b, M, { w = 0.5, h = 1.2 }) {
    for (const sx of [-1, 1]) b.rod(M.black, [sx * w / 2, 0.75, 0.03], [sx * w / 2, 0.75 + h, 0.03], 0.012, 8);
    for (let i = 0; i < 9; i++) b.rod(M.black, [-w / 2, 0.8 + (h - 0.1) * (i / 8), 0.03], [w / 2, 0.8 + (h - 0.1) * (i / 8), 0.03], 0.008, 6);
    const fl = folds(5);
    soft(b, M.cream, 0, 1.15, 0.058, w - 0.1, 0.55, 0.03, 0.012, { ni: [4, 5, 2], D: (x, y, z) => [0, 0, 0.008 * Math.sin(y * 14 + x * 5) + fl(x, y) * 0.004] });
    soft(b, M.cream, 0, 1.23, 0.008, w - 0.1, 0.3, 0.02, 0.01, { ni: [4, 3, 2] });
    return null;
  },
  /* Lave-linge et sèche-linge sous un plan, hublots vitrés. */
  washer(b, M, { n = 2 }) {
    for (let i = 0; i < n; i++) {
      const x = -n * 0.3 + 0.3 + i * 0.6;
      cb(b, M.white, x, 0.01, 0, 0.595, 0.84, 0.58, 0.012);
      b.geo(M.steel, new THREE.TorusGeometry(0.17, 0.022, 8, 30), x, 0.42, 0.292); b.geo(M.black, new THREE.TorusGeometry(0.15, 0.012, 6, 28), x, 0.42, 0.296); b.geo(M.screen, new THREE.CylinderGeometry(0.16, 0.16, 0.01, 30), x, 0.42, 0.292, PI / 2, 0, 0);
      bb(b, M.potDark, x - 0.28, 0.74, 0.29, x + 0.28, 0.83, 0.294, 0.002); b.geo(M.steel, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), x + 0.18, 0.785, 0.3, PI / 2, 0, 0); b.box(M.led, x - 0.22, 0.775, 0.294, x - 0.08, 0.795, 0.2945);
      b.box(M.black, x - 0.28, 0.696, 0.29, x - 0.1, 0.706, 0.294);                                              // tiroir à lessive
      for (const sx of [-1, 1]) b.cyl(M.black, x + sx * 0.25, 0, 0.23, 0.02, 0.012, 8);
    }
    cb(b, M.oak, 0, 0.855, 0, n * 0.6 + 0.02, 0.03, 0.62, 0.004);
    soft(b, M.cream, -n * 0.3 + 0.3, 0.885, 0, 0.34, 0.12, 0.26, 0.04, { ni: [3, 2, 3], D: (x, y, z) => [0, 0.01 * (1 - (x / 0.17) ** 2) * smooth(0, 0.06, y), 0] }); b.lathe(M.rattan, n * 0.3 - 0.3, 0.885, 0, [[0.14, 0], [0.17, 0.2], [0.162, 0.2], [0.134, 0.01], [0.001, 0.01]], 18);
    return [n * 0.6, 0.62];
  },
  /* Chauffe-eau vertical sur trépied (« CE » des plans). */
  boiler(b, M, { r = 0.27, h = 1.5 }) {
    for (let i = 0; i < 3; i++) { const a = i * 2.094; b.cyl(M.steel, Math.sin(a) * r * 0.7, 0, Math.cos(a) * r * 0.7, 0.015, 0.26, 8); }
    b.cyl(M.steel, 0, 0.24, 0, r * 0.92, 0.04, 24);
    b.cyl(M.white, 0, 0.28, 0, r, h - 0.1, 32);
    b.lathe(M.white, 0, 0.28 + h - 0.1, 0, [[r, 0], [r * 0.9, 0.07], [r * 0.6, 0.12], [0.001, 0.145]], 32);
    for (const [sx, sy] of [[-0.06, 0], [0.06, 0]]) { b.cyl(M.steel, sx, 0.28 + h + 0.02, sy, 0.016, 0.07, 10); b.cyl(M.black, sx, 0.28 + h + 0.09, sy, 0.02, 0.02, 10); }
    b.cyl(M.potDark, 0, 0.9, r + 0.001, 0.045, 0.004, 14);
    return [2 * r, 2 * r];
  },
  /* Étagères ouvertes : linge plié, paniers. */
  shelves(b, M, { w = 1.2, d = 0.4, h = 2.0, mat = 'oak' }) {
    for (const sx of [-1, 1]) bb(b, M[mat], sx > 0 ? w / 2 - 0.02 : -w / 2, 0, -d / 2, sx > 0 ? w / 2 : -w / 2 + 0.02, h, d / 2, 0.002);
    const R = rng(Math.round(w * 53)), rows = 5;
    for (let j = 0; j <= rows; j++) {
      const y = 0.08 + ((h - 0.1) / rows) * j; bb(b, M[mat], -w / 2 + 0.02, y, -d / 2, w / 2 - 0.02, y + 0.022, d / 2, 0.002);
      if (j === rows) continue;
      if (j % 2 === 0) for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.34) b.lathe(M.rattan, x, y + 0.022, 0, [[0.11, 0], [0.13, 0.2], [0.122, 0.2], [0.104, 0.01], [0.001, 0.01]], 16);
      else for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.36) for (let k = 0; k < 3; k++) soft(b, M[['cream', 'greige', 'white', 'sand'][(R() * 4) | 0]], x, y + 0.022 + k * 0.05, 0, 0.28, 0.048, d - 0.1, 0.016, { ni: [3, 2, 3], D: (xx, yy, zz) => [0, 0, 0.006 * Math.sin(yy * 60 + k)] });
    }
    return [w, d];
  },

  /* ── Plantes et luminaires ───────────────────────────────────────────── */
  /* Plante en pot : 'olive' (olivier), 'snake' (sansevière), 'palm' (kentia). */
  plant(b, M, { h = 1.6, kind = 'olive', pot = 0.24 }) {
    const R = rng(Math.round(h * 100) + kind.length * 7), dark = kind === 'snake', ph = pot * (kind === 'snake' ? 1.3 : 1.5);
    b.lathe(dark ? M.potDark : M.pot, 0, 0, 0, [[pot * 0.6, 0], [pot * 0.8, 0.008], [pot * 0.95, pot * 0.3], [pot, ph * 0.7], [pot * 0.95, ph * 0.95], [pot * 0.86, ph], [pot * 0.78, ph], [pot * 0.74, ph - 0.012], [pot * 0.74, ph - 0.03], [0.001, ph - 0.03]], 26);
    b.cyl(M.bark, 0, ph - 0.027, 0, pot * 0.73, 0.004, 22);                                  // terreau
    for (let i = 0; i < 7; i++) { const a = R() * 6.283, rr = R() * pot * 0.6; b.sph(M.pot, Math.cos(a) * rr, ph - 0.022, Math.sin(a) * rr, 0.014 + R() * 0.01, 1, 0.6, 1, 6); }      // galets de surface
    if (dark) b.cyl(M.white, 0, ph * 0.55, 0, pot * 1.005, ph * 0.12, 22);
    if (kind === 'snake') {                                                            // feuilles en lames dressées
      for (let i = 0; i < 17; i++) { const a = R() * 6.283, rr = R() * pot * 0.5, lh = (h - ph) * (0.5 + R() * 0.5), t = 0.06 + R() * 0.16; b.geo(i % 3 ? M.leafCypress : M.sage, new THREE.ConeGeometry(0.03 + R() * 0.02, lh, 4), Math.cos(a) * (rr + Math.sin(t) * lh * 0.4), ph - 0.04 + lh / 2, Math.sin(a) * (rr + Math.sin(t) * lh * 0.4), Math.sin(a) * t, a, -Math.cos(a) * t, 1, 1, 0.26); }
    } else if (kind === 'palm') {                                                      // palmes arquées
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.283 + R() * 0.4, L = (h - ph) * (0.8 + R() * 0.35), up = 0.55 + R() * 0.3, pts = [];
        for (let k = 0; k <= 4; k++) { const t = k / 4, rr = Math.sin(t * 1.2) * L * 0.62; pts.push([Math.cos(a) * rr, ph + L * up * Math.sin(t * 1.9) * 0.9, Math.sin(a) * rr]); }
        b.tube(M.leafCypress, pts, 0.006, 4);
        for (let k = 1; k <= 4; k++) leaves(b, M.leafBroad, pts[k][0], pts[k][1], pts[k][2], 0.13, 7, 0.4, R, 0.5);
      }
    } else {                                                                           // olivier : tronc noueux à trois brins, charpentières, bouquets de feuilles argentées
      const th = (h - ph) * 0.45;
      for (let s = 0; s < 3; s++) {
        const a = s * 2.1 + 0.4, lean = 0.02 + s * 0.015, tw = (R() - 0.5) * 0.04;
        b.tube(M.bark, [[Math.cos(a) * 0.012, ph - 0.03, Math.sin(a) * 0.012], [Math.cos(a) * lean + tw, ph + th * 0.35, Math.sin(a) * lean - tw], [Math.cos(a) * lean * 1.6 - tw, ph + th * 0.7, Math.sin(a) * lean * 1.6 + tw], [Math.cos(a) * lean * 2, ph + th, Math.sin(a) * lean * 2]], 0.017 - s * 0.003, 6);
      }
      b.cyl(M.bark, 0, ph - 0.03, 0, 0.034, 0.05, 8, 0.024);                              // empattement
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + R(), rr = 0.1 + R() * 0.22, ty = ph + th + (h - ph - th) * (0.2 + R() * 0.65); b.rod(M.bark, [0, ph + th - 0.02, 0], [Math.cos(a) * rr, ty, Math.sin(a) * rr], 0.008, 4, 0.0035); leaves(b, M.leafOlive, Math.cos(a) * rr, ty, Math.sin(a) * rr, 0.2, 22, 0.32, R, 0.9); }
      leaves(b, M.leafOlive, 0, h - 0.16, 0, 0.22, 20, 0.32, R, 0.8);
    }
    return [pot * 2, pot * 2];
  },
  pampas(b, M, { h = 1.5 }) {
    b.lathe(M.pot, 0, 0, 0, [[0.08, 0], [0.12, 0.01], [0.14, 0.1], [0.15, 0.3], [0.09, 0.48], [0.06, 0.55], [0.07, 0.58], [0.05, 0.58], [0.04, 0.5]], 22);
    plumes(b, M, 0, 0.55, 0, h - 0.55, 14, rng(5));
    return [0.3, 0.3];
  },
  /* Lampadaire : pied de marbre, fût laiton, abat-jour en lin. */
  floorLamp(b, M, { h = 1.65 }) {
    b.lathe(M.marble, 0, 0, 0, [[0.001, 0], [0.15, 0], [0.16, 0.004], [0.16, 0.022], [0.14, 0.03], [0.001, 0.03]], 26);
    b.cyl(M.brass, 0, 0.03, 0, 0.011, h - 0.36, 10); b.cyl(M.brass, 0, 0.03, 0, 0.02, 0.05, 10, 0.012);
    b.lathe(M.lampShade, 0, h - 0.34, 0, [[0.21, 0], [0.19, 0.16], [0.17, 0.32], [0.163, 0.32], [0.183, 0.16], [0.203, 0]], 28); b.cyl(M.brass, 0, h - 0.345, 0, 0.03, 0.02, 10); b.light(0, h - 0.12, 0, 0.9);
    return [0.3, 0.3];
  },
  tableLamp(b, M, { y = 0.8 }) {
    b.lathe(M.pot, 0, y, 0, [[0.04, 0], [0.085, 0.05], [0.07, 0.15], [0.022, 0.21], [0.012, 0.25]], 18);
    b.lathe(M.lampShade, 0, y + 0.23, 0, [[0.14, 0], [0.12, 0.09], [0.105, 0.19], [0.1, 0.19], [0.115, 0.09], [0.134, 0]], 24); b.light(0, y + 0.45, 0, 0.6);
    return null;
  },
  /* Suspension : `drop` = hauteur sous plafond du luminaire. kind = 'ring' (grand lustre à anneaux LED en laiton), 'rings3' (trois anneaux verticaux
     entrelacés), 'cone' (cônes laiton), 'rail' (réglette noire à spots laiton), 'tubes' (tubes LED noirs croisés), 'globe' (opaline). */
  pendant(b, M, { ceil = 2.6, drop = 0.9, kind = 'globe', n = 1, span = 0.6 }) {
    const y = ceil - drop, cable = (x, yy, z) => { b.rod(M.black, [x, yy, z], [x, ceil, z], 0.0025, 4); b.cyl(M.black, x, ceil - 0.012, z, 0.018, 0.012, 10); };
    if (kind === 'ring') {
      b.cyl(M.brass, 0, ceil - 0.02, 0, 0.09, 0.02, 20);
      for (const [R0, dy, rx, rz, ox, oz] of [[0.52, 0, 0.2, 0.1, 0, 0], [0.4, -0.1, -0.22, -0.16, 0.14, 0.08], [0.3, 0.08, 0.1, 0.3, -0.16, -0.1]]) {
        b.ring(M.brass, ox, y + dy, oz, R0, 0.016, rx, rz, 56, 8); b.ring(M.led, ox, y + dy - 0.004, oz, R0 - 0.013, 0.009, rx, rz, 56, 6);
        for (const a of [0.6, 2.7, 4.8]) cable(ox + Math.cos(a) * R0 * 0.96, y + dy + Math.sin(a) * R0 * Math.sin(rx) * 0.9 - Math.cos(a) * R0 * Math.sin(rz) * 0.9, oz + Math.sin(a) * R0 * 0.96);
      }
      b.light(0, y - 0.25, 0, 1.3); return null;
    }
    if (kind === 'rings3') {
      b.cyl(M.brass, 0, ceil - 0.015, 0, 0.07, 0.015, 18);
      for (const [R0, ox, oy] of [[0.24, -0.1, 0], [0.17, 0.16, 0.08], [0.11, 0.1, -0.2]]) { b.ring(M.brass, ox, y + oy, 0, R0, 0.011, PI / 2, 0, 44, 8); b.ring(M.led, ox, y + oy, 0, R0 - 0.01, 0.006, PI / 2, 0, 44, 6); cable(ox, y + oy + R0, 0); }
      b.light(0, y - 0.2, 0.1, 0.9); return null;
    }
    if (kind === 'tubes') {
      b.cyl(M.black, 0, ceil - 0.015, 0, 0.07, 0.015, 18);
      for (const [a, dy, L] of [[0.25, 0, 1.5], [1.35, -0.05, 1.3], [2.4, 0.04, 1.4]]) { const c = Math.cos(a), s = Math.sin(a); b.rod(M.black, [-c * L / 2, y + dy, -s * L / 2], [c * L / 2, y + dy, s * L / 2], 0.017, 10); b.rod(M.led, [-c * L * 0.32, y + dy - 0.012, -s * L * 0.32], [c * L * 0.32, y + dy - 0.012, s * L * 0.32], 0.011, 8); cable(-c * L * 0.4, y + dy, -s * L * 0.4); cable(c * L * 0.4, y + dy, s * L * 0.4); }
      b.light(0, y - 0.25, 0, 1.2); return null;
    }
    if (kind === 'rail') {
      const L = span * Math.max(1, n - 1) + 0.3;
      bb(b, M.black, -L / 2, y + 0.3, -0.02, L / 2, y + 0.33, 0.02, 0.003); for (const sx of [-1, 1]) cable(sx * L * 0.42, y + 0.33, 0);
      for (let i = 0; i < n; i++) { const x = n > 1 ? -span * (n - 1) / 2 + i * span : 0, t = (i % 2 ? 0.3 : -0.25); b.geo(M.brass, new THREE.CylinderGeometry(0.035, 0.035, 0.17, 16), x + t * 0.1, y + 0.17, 0, 0, 0, t); b.geo(M.led, new THREE.CylinderGeometry(0.03, 0.03, 0.004, 14), x + t * 0.185, y + 0.088, 0, 0, 0, t); b.rod(M.black, [x, y + 0.3, 0], [x + t * 0.06, y + 0.25, 0], 0.006, 6); }
      b.light(0, y - 0.15, 0, 1.1); return null;
    }
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? -span * (n - 1) / 2 + i * span : 0, yy = y - (i % 2) * 0.12;
      cable(x, yy, 0);
      if (kind === 'globe') { b.sph(M.lampShade, x, yy - 0.13, 0, 0.14, 1, 1, 1, 20); b.cyl(M.brass, x, yy - 0.01, 0, 0.035, 0.04, 12, 0.02); }
      else { b.lathe(M.brass, x, yy - 0.24, 0, [[0.12, 0], [0.114, 0.01], [0.03, 0.2], [0.018, 0.24], [0.012, 0.24], [0.025, 0.2], [0.112, 0.004]], 24); b.cyl(M.led, x, yy - 0.2, 0, 0.05, 0.006, 14); b.cyl(M.brass, x, yy - 0.012, 0, 0.012, 0.02, 8); }
      b.light(x, yy - 0.3, 0, 1.0 / Math.sqrt(n));
    }
    return null;
  },

  /* ── Extérieur ───────────────────────────────────────────────────────── */
  /* Bain de soleil : châssis en teck à lattes, matelas blanc à coutures, dossier relevé. */
  lounger(b, M, { }) {
    for (const sx of [-1, 1]) {
      cb(b, M.teak, sx * 0.33, 0.14, 0, 0.05, 0.065, 1.95, 0.004);
      for (const sz of [-0.8, 0.8]) cb(b, M.teak, sx * 0.33, 0, sz, 0.05, 0.14, 0.06, 0.004);
    }
    for (let k = 0; k < 14; k++) b.box(M.teak, -0.31, 0.19, -0.95 + k * 0.141, 0.31, 0.206, -0.85 + k * 0.141);                // lattes d'assise
    soft(b, M.white, 0, 0.235, 0.32, 0.64, 0.09, 1.26, 0.04, { ni: [3, 2, 6], nr: 2, D: (x, y, z) => [0, 0.008 * (1 - (x / 0.32) ** 2) * smooth(0, 0.045, y), 0] });
    b.geo(M.teak, new THREE.BoxGeometry(0.68, 0.03, 0.74), 0, 0.42, -0.64, 0.55, 0, 0);
    soft(b, M.white, 0, 0.455, -0.62, 0.64, 0.09, 0.72, 0.04, { ni: [3, 2, 4], nr: 2, rx: 0.55 });
    soft(b, M.greige, 0, 0.6, -0.78, 0.4, 0.1, 0.22, 0.045, { ni: [3, 2, 3], nr: 2, rx: 0.55 });
    return [0.75, 1.95];
  },
  sideTable(b, M, { r = 0.22, h = 0.42, mat = 'teak' }) { b.lathe(M[mat], 0, h - 0.03, 0, [[0.001, 0], [r - 0.006, 0], [r, 0.008], [r, 0.022], [r - 0.004, 0.03], [0.001, 0.03]], 28); b.lathe(M.black, 0, 0, 0, [[r * 0.7, 0], [r * 0.7, 0.012], [0.03, 0.03], [0.02, h - 0.03]], 18); return [2 * r, 2 * r]; },
  outdoorSofa(b, M, { w = 2.1, d = 0.9 }) {
    cb(b, M.teak, 0, 0.1, 0, w, 0.16, d, 0.008); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cb(b, M.teak, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.06, 0.1, 0.06, 0.004);
    cb(b, M.teak, 0, 0.26, -d / 2 + 0.04, w, 0.42, 0.06, 0.006); for (const sx of [-1, 1]) cb(b, M.teak, sx * (w / 2 - 0.035), 0.26, 0, 0.06, 0.3, d, 0.006);
    const n = Math.max(2, Math.round(w / 0.75)), sw = (w - 0.14) / n, fl = folds(Math.round(w * 10));
    for (let i = 0; i < n; i++) { const x = -w / 2 + 0.07 + sw * (i + 0.5); soft(b, M.linen, x, 0.26, 0.03, sw - 0.02, 0.14, d - 0.16, 0.05, { ni: [4, 2, 4], nr: 2, D: (xx, y, z) => [0, smooth(0, 0.07, y) * (0.01 * (1 - (2 * xx / sw) ** 2) + fl(xx, z) * 0.003), 0] }); pillow(b, M.linen, x, 0.56, -d / 2 + 0.16, sw - 0.04, 0.14, 0.36, PI / 2 - 0.16, 0, 0, 40 + i, 6); }
    pillow(b, M.terra, -w / 2 + 0.35, 0.56, -d / 2 + 0.3, 0.4, 0.13, 0.38, PI / 2 - 0.25, 0.3, 0, 99, 6);
    return [w, d];
  },
  /* Table de jardin en aluminium noir à plateau latté et ses fauteuils. */
  outdoorTable(b, M, { w = 2.4, d = 1.0, n = 4, ends = false }) {
    for (let x = -w / 2; x < w / 2 - 0.01; x += 0.1) cb(b, M.frame, x + 0.05, 0.715, 0, 0.092, 0.025, d, 0.002);
    bb(b, M.frame, -w / 2, 0.68, -d / 2, w / 2, 0.715, -d / 2 + 0.05, 0.002); bb(b, M.frame, -w / 2, 0.68, d / 2 - 0.05, w / 2, 0.715, d / 2, 0.002);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cb(b, M.frame, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.06, 0.68, 0.06, 0.003);
    const ch = (x, z, r) => { b.push(x, 0, z, r); b.add(M.frame, shellGeo(0.27, 0.03, 0.4, 0.4, 0.26, 1.7, 0.025, 14, 4)); b.lathe(M.charcoal, 0, 0.395, 0.02, [[0.001, 0], [0.2, 0], [0.24, 0.015], [0.25, 0.05], [0.235, 0.066], [0.001, 0.07]], 20); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.rod(M.frame, [sx * 0.2, 0.4, sz * 0.2], [sx * 0.24, 0, sz * 0.24], 0.014, 6, 0.01); b.pop(); };
    for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5); ch(x, -d / 2 - 0.2, 0); ch(x, d / 2 + 0.2, PI); }
    if (ends) { ch(-w / 2 - 0.24, 0, PI / 2); ch(w / 2 + 0.24, 0, -PI / 2); }
    b.lathe(M.pot, 0, 0.74, 0, [[0.07, 0], [0.13, 0.07], [0.12, 0.07], [0.001, 0.005]], 16); leaves(b, M.leafOlive, 0, 0.9, 0, 0.12, 18, 0.2, rng(3), 0.8);
    return [w + 0.3, d + 0.9];
  },
  /* Parasol écru : toile à huit pans festonnés qui s'affaissent entre les baleines, mât bois, pied lesté. */
  parasol(b, M, { r = 1.5, h = 2.5 }) {
    b.cyl(M.teak, 0, 0, 0, 0.025, h + 0.12, 10); b.lathe(M.concrete, 0, 0, 0, [[0.001, 0], [0.28, 0], [0.28, 0.05], [0.12, 0.06], [0.03, 0.07]], 20);
    const NG = 8, SU = 3, SV = 4, mk = (inner) => {
      const pos = [], idx = [];
      for (let v = 0; v <= SV; v++) for (let u = 0; u <= NG * SU; u++) {
        const t = v / SV, a = (u / (NG * SU)) * 6.283, f = (u % SU) / SU, sag = Math.sin(f * PI), rr = r * (t * (1 - 0.05 * sag * t)), y = h + 0.13 - 0.42 * Math.pow(t, 1.35) - 0.035 * sag * t * t - (inner ? 0.004 : 0);
        pos.push(Math.sin(a) * rr, y, Math.cos(a) * rr);
      }
      const W = NG * SU + 1;
      for (let v = 0; v < SV; v++) for (let u = 0; u < NG * SU; u++) { const a = v * W + u, c = a + W; if (inner) idx.push(a, a + 1, c, a + 1, c + 1, c); else idx.push(a, c, a + 1, a + 1, c, c + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    b.add(M.linen, mk(false)); b.add(M.linen, mk(true));
    b.cyl(M.teak, 0, h + 0.1, 0, 0.012, 0.05, 6);
    for (let i = 0; i < NG; i++) { const a = (i / NG) * 6.283; b.rod(M.teak, [0, h - 0.04, 0], [Math.sin(a) * r * 0.97, h - 0.49, Math.cos(a) * r * 0.97], 0.007, 4); b.rod(M.teak, [0, h - 0.5, 0], [Math.sin(a) * r * 0.5, h - 0.2, Math.cos(a) * r * 0.5], 0.005, 4); }
    return [0.5, 0.5];
  },
  /* Unité extérieure de climatisation (« UNITÉ EXT. » des plans) : caisson clair, grille du ventilateur à anneaux et rayons, persiennes latérales, pieds. */
  acUnit(b, M, { w = 0.82, d = 0.32, h = 0.62 }) {
    for (const sx of [-1, 1]) cb(b, M.black, sx * (w / 2 - 0.14), 0, 0, 0.06, 0.06, d, 0.003);
    cb(b, M.white, 0, 0.06, 0, w, h, d, 0.012);
    const fx = -w * 0.14, fy = 0.06 + h / 2, fr = h * 0.4, fz = d / 2 + 0.002;
    b.geo(M.black, new THREE.CylinderGeometry(fr * 1.04, fr * 1.04, 0.012, 32), fx, fy, fz, PI / 2, 0, 0);
    for (let i = 1; i <= 3; i++) b.geo(M.steel, new THREE.TorusGeometry(fr * (i / 3.1), 0.0035, 3, 28), fx, fy, fz + 0.008);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * PI; b.rod(M.steel, [fx - Math.cos(a) * fr, fy - Math.sin(a) * fr, fz + 0.008], [fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, fz + 0.008], 0.0025, 3); }
    b.geo(M.black, new THREE.CylinderGeometry(0.035, 0.035, 0.014, 12), fx, fy, fz + 0.01, PI / 2, 0, 0);
    for (let k = 0; k < 9; k++) b.box(M.black, w * 0.32, 0.12 + k * 0.058, d / 2 - 0.0005, w * 0.46, 0.125 + k * 0.058, d / 2 + 0.0045);   // persiennes
    return [w, d];
  },
  planter(b, M, { w = 1.2, d = 0.4, h = 0.5, plant = 'lavender' }) {
    cb(b, M.concrete, 0, 0, 0, w, h, d, 0.012); cb(b, M.bark, 0, h - 0.002, 0, w - 0.08, 0.004, d - 0.08, 0.001);
    const R = rng(Math.round(w * 37));
    for (let x = -w / 2 + 0.16; x < w / 2 - 0.1; x += 0.24) { leaves(b, M.leafOlive, x, h + 0.1, 0, 0.15, 14, 0.2, R, 0.7); if (plant === 'lavender') for (let i = 0; i < 7; i++) b.geo(M.lavender, cone(0.02, 0.2, 5), x + (R() - 0.5) * 0.2, h + 0.3, (R() - 0.5) * 0.2, (R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4); }
    return [w, d];
  },
};

/* ── Végétaux de pleine terre (dessinés en coordonnées de plan ; renvoient l'emprise du tronc pour les collisions) ── */
const ico = new THREE.IcosahedronGeometry(1, 0);
export const V = {
  /* Arbre : 'olive' (tronc noueux, houppier argenté), 'pine' (pin parasol), 'oak' (feuillu). Le feuillage est fait de touffes de petites cartes. */
  tree(b, M, x, z, { kind = 'pine', h = 7, r = 2.6, seed = 1, y = 0 }) {
    const R = rng(seed * 131 + 7), pine = kind === 'pine', olive = kind === 'olive', th = h * (pine ? 0.62 : 0.38), lean = (R() - 0.5) * 0.22;
    const top = [x + lean * th, y + th, z + (R() - 0.5) * 0.2 * th * 0.3], tr = 0.09 + r * 0.035;
    if (olive) {                                                                          // olivier : tronc court et tourmenté qui se divise en trois charpentières
      const fy = y + th * 0.5;
      b.tube(M.bark, [[x, y - 0.1, z], [x + (R() - 0.5) * 0.14, y + th * 0.25, z + (R() - 0.5) * 0.14], [x + (R() - 0.5) * 0.1, fy, z + (R() - 0.5) * 0.1]], tr * 1.15, 8);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + R(), ex = top[0] + Math.cos(a) * r * 0.3, ez = top[2] + Math.sin(a) * r * 0.3; b.tube(M.bark, [[x, fy - 0.05, z], [x + Math.cos(a) * 0.18 + (R() - 0.5) * 0.1, fy + (y + th - fy) * 0.5, z + Math.sin(a) * 0.18], [ex, y + th, ez]], tr * 0.62, 6); }
    } else b.tube(M.bark, [[x, y - 0.1, z], [x + lean * th * 0.3 + (R() - 0.5) * 0.12, y + th * 0.45, z + (R() - 0.5) * 0.12], top], tr, 8);
    b.cyl(M.bark, x, y, z, tr * 1.7, 0.25, 9, tr * 1.05);
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + R() * 0.8, L = tr * (3.2 + R() * 1.5); b.rod(M.bark, [x + Math.cos(a) * tr * 0.5, y + tr * 1.1, z + Math.sin(a) * tr * 0.5], [x + Math.cos(a) * L, y - 0.04, z + Math.sin(a) * L], tr * 0.55, 5, tr * 0.12); }   // empattements
    const mat = pine ? M.leafPine : olive ? M.leafOlive : M.leafBroad, n = pine ? 9 : 8, cy = y + th + (pine ? r * 0.2 : r * 0.42), fl = pine ? 0.42 : 0.8;
    b.sph(M.hedge, top[0], cy, top[2], r * 0.5, 1, fl * 0.9, 1, 10);                      // cœur sombre du houppier
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + R() * 0.6, rr = r * (0.35 + R() * 0.35), bx = top[0] + Math.cos(a) * rr, bz = top[2] + Math.sin(a) * rr, by = cy + (R() - 0.5) * r * fl * 0.7;
      b.rod(M.bark, top, [bx, by - r * 0.1, bz], tr * 0.45, 5, tr * 0.15);
      leaves(b, mat, bx, by, bz, r * 0.5, Math.round(26 + r * 7), pine ? 0.95 : olive ? 0.6 : 0.8, R, fl);
    }
    leaves(b, mat, top[0], cy + r * fl * 0.35, top[2], r * 0.55, Math.round(30 + r * 8), pine ? 0.95 : olive ? 0.6 : 0.8, R, fl * 0.8);
    return [x - 0.25, z - 0.25, x + 0.25, z + 0.25];
  },
  /* Cyprès de Provence : fuseau, flammes de feuillage sombre en cartes posées à la surface du fuseau (silhouette irrégulière). */
  cypress(b, M, x, z, { h = 6, y = 0 }) {
    const w = 0.42 + h * 0.035, R = rng(Math.round(x * 31 + z * 17));
    b.cyl(M.bark, x, y, z, 0.07, h * 0.1, 6);
    const prof = [[0.1, 0], [w, h * 0.12], [w * 1.05, h * 0.3], [w * 0.92, h * 0.55], [w * 0.6, h * 0.78], [w * 0.22, h * 0.9], [0.001, h * 0.94]];
    b.lathe(M.leafCypress, x, y + h * 0.06, z, prof.map(([r, yy]) => [r * 0.9, yy]), 10);
    const rAt = (t) => { for (let i = 1; i < prof.length; i++) if (t <= prof[i][1]) { const k = (t - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * k; } return 0.001; };
    const n = Math.round(h * 30);
    for (let i = 0; i < n; i++) { const t = (0.05 + 0.88 * Math.pow(R(), 0.9)) * h * 0.9, a = R() * 6.283, rr = rAt(t) * (0.8 + R() * 0.3); leaves(b, M.leafPine, x + Math.cos(a) * rr, y + h * 0.06 + t, z + Math.sin(a) * rr, 0.1, 1, 0.5, R, 1); }
    return [x - 0.3, z - 0.3, x + 0.3, z + 0.3];
  },
  /* Haie taillée : volume plein habillé de feuilles sur le dessus et sur les deux grandes faces. */
  hedge(b, M, x0, z0, x1, z1, { h = 1.5, y = 0 }) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1), R = rng(Math.round(ax * 13 + az * 29 + h * 7));
    b.cbox(M.hedge, (ax + bx) / 2, y, (az + bz) / 2, bx - ax, h, bz - az, 0.1);
    const along = bx - ax > bz - az, len = Math.max(bx - ax, bz - az), wid = Math.min(bx - ax, bz - az), n = Math.round(len / 0.34);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, px = along ? ax + len * t : (ax + bx) / 2, pz = along ? (az + bz) / 2 : az + len * t;
      leaves(b, M.leafBroad, px, y + h - 0.12, pz, Math.max(0.22, wid * 0.55), 9, 0.34, R, 0.5);
      for (const s of [-1, 1]) {                                                         // feuilles sur les flancs
        const fx = along ? px : (s < 0 ? ax : bx), fz = along ? (s < 0 ? az : bz) : pz;
        leaves(b, M.leafBroad, fx, y + h * (0.35 + R() * 0.4), fz, 0.2, 4, 0.3, R, 0.8);
      }
    }
    return [ax, az, bx, bz];
  },
  /* Lavande : dôme de feuilles gris-vert, nombreuses hampes fines terminées par un épi violet. */
  lavender(b, M, x0, z0, x1, z1, { y = 0, seed = 3 }) {
    const R = rng(seed * 17 + 1), len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.55)), spike = new THREE.ConeGeometry(0.014, 0.14, 4, 1, true), stem = new THREE.ConeGeometry(0.005, 0.3, 4, 1, true);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      b.sph(M.hedge, x, y + 0.1, z, 0.26, 1, 0.55, 1, 6); leaves(b, M.leafOlive, x, y + 0.16, z, 0.27, 26, 0.26, R, 0.5);
      for (let k = 0; k < 24; k++) {
        const a = R() * 6.283, rr = Math.sqrt(R()) * 0.24, lean = 0.1 + rr * 1.6, sl = 0.28 + R() * 0.1, px = x + Math.cos(a) * rr * 0.6, pz = z + Math.sin(a) * rr * 0.6, tx = Math.sin(a) * lean, tz = -Math.cos(a) * lean;
        b.geo(M.leafCypress, stem, px + Math.cos(a) * Math.sin(lean) * sl * 0.5, y + 0.17 + Math.cos(lean) * sl * 0.5, pz + Math.sin(a) * Math.sin(lean) * sl * 0.5, tx, 0, tz, 1, sl / 0.3, 1);
        b.geo(M.lavender, spike, px + Math.cos(a) * Math.sin(lean) * (sl + 0.04), y + 0.17 + Math.cos(lean) * (sl + 0.04), pz + Math.sin(a) * Math.sin(lean) * (sl + 0.04), tx, 0, tz);
      }
    }
  },
  /* Laurier-rose en fleurs : touffe dense de feuilles longues, grappes de fleurs roses en surface. */
  oleander(b, M, x, z, { r = 0.9, y = 0, seed = 5 }) {
    const R = rng(seed * 29 + 3);
    b.sph(M.hedge, x, y + r * 0.6, z, r * 0.5, 1, 0.9, 1, 6);
    for (let i = 0; i < 14; i++) { const a = R() * 6.283, rr = R() * r * 0.5; leaves(b, M.leafBroad, x + Math.cos(a) * rr, y + r * (0.3 + R() * 0.85), z + Math.sin(a) * rr, r * 0.55, 18, 0.4, R, 0.9); }
    for (let i = 0; i < 26; i++) {                                                       // grappes : trois fleurs par bouquet
      const a = R() * 6.283, u = 0.2 + R() * 0.8, rr = Math.sqrt(1 - u * u * 0.55) * r * 0.82, yy = y + r * (0.55 + u * 0.75), cx = x + Math.cos(a) * rr, cz = z + Math.sin(a) * rr;
      for (let k = 0; k < 3; k++) b.geo(M.oleander, ico.clone(), cx + (R() - 0.5) * 0.09, yy + (R() - 0.5) * 0.07, cz + (R() - 0.5) * 0.09, R() * 3, R() * 3, 0, 0.042 + R() * 0.02, 0.042 + R() * 0.02, 0.042);
    }
    return [x - r * 0.6, z - r * 0.6, x + r * 0.6, z + r * 0.6];
  },
  palm(b, M, x, z, { r = 1.1, y = 0 }) {
    const R = rng(Math.round(x * 7 + z * 11));
    b.cyl(M.bark, x, y, z, 0.13, 0.5, 9, 0.1);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283 + R() * 0.3, up = 0.5 + R() * 0.5, pts = [];
      for (let k = 0; k <= 4; k++) { const t = k / 4, rr = Math.sin(t * 1.25) * r; pts.push([x + Math.cos(a) * rr, y + 0.5 + r * up * Math.sin(t * 2.0) * 0.8, z + Math.sin(a) * rr]); }
      b.tube(M.leafCypress, pts, 0.012, 4);
      for (let k = 1; k <= 4; k++) leaves(b, M.leafBroad, pts[k][0], pts[k][1], pts[k][2], 0.2, 5, 0.6, R, 0.5);
    }
    return [x - 0.3, z - 0.3, x + 0.3, z + 0.3];
  },
};
