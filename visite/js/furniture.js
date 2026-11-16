/* 59 Cézanne — visite 3D : mobilier et végétaux.
   Cotes réelles (assise 46 cm, table 75 cm, plan de travail 91 cm, lit 55 cm…) et modèles repris des images du graphiste :
   canapé bouclé gris, chaises coque en velours terracotta, table ronde en verre fumé, lustres à anneaux laiton,
   cuisine anthracite et chêne, mur TV en marbre, lit capitonné sable, oliviers en pot.
   Chaque fonction dessine dans le repère local courant du Batch : origine au centre de l'emprise, au sol,
   « face avant » tournée vers +z. Elle renvoie l'emprise [largeur, profondeur] servant aux collisions (ou null). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from 'v3d/geo';

const PI = Math.PI;
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const rbox = (w, h, d, r, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

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

/* Tombé de rideau : ruban plissé (deux faces), de la tringle au sol. */
function drapeGeo(w, h, pleat = 0.075, amp = 0.032, y0 = 0.015) {
  const n = Math.max(8, Math.round(w / pleat) * 6), pos = [], uv = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = -w / 2 + w * t, z = Math.sin(t * (w / pleat) * 2 * PI) * amp + side * 0.003;
      pos.push(x, y0, z * 1.15, x, y0 + h, z * 0.8); uv.push(t * w * 2, 0, t * w * 2, h * 2);
    }
    for (let i = 0; i < n; i++) { const a = base + i * 2; if (side > 0) idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); else idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
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

/* Petits objets de décor. */
const vase = (b, m, x, y, z, s = 1) => b.lathe(m, x, y, z, [[0.045 * s, 0], [0.085 * s, 0.05 * s], [0.095 * s, 0.14 * s], [0.06 * s, 0.24 * s], [0.035 * s, 0.3 * s], [0.045 * s, 0.33 * s], [0.03 * s, 0.33 * s], [0.02 * s, 0.26 * s]], 16);
const bowl = (b, m, x, y, z, r = 0.14) => b.lathe(m, x, y, z, [[r * 0.35, 0], [r * 0.8, r * 0.22], [r, r * 0.5], [r * 0.94, r * 0.5], [r * 0.7, r * 0.2], [0.001, r * 0.12]], 18);
const bottle = (b, m, x, y, z) => b.lathe(m, x, y, z, [[0.038, 0], [0.04, 0.02], [0.04, 0.19], [0.016, 0.26], [0.014, 0.32], [0.001, 0.32]], 10);
const glass = (b, M, x, y, z) => { b.cyl(M.crystal, x, y, z, 0.03, 0.006, 10); b.cyl(M.crystal, x, y + 0.006, z, 0.004, 0.075, 6); b.lathe(M.crystal, x, y + 0.08, z, [[0.006, 0], [0.034, 0.03], [0.038, 0.075], [0.032, 0.11]], 10); };
const books = (b, M, x, y, z, n = 3, w = 0.26, d = 0.19) => { for (let i = 0; i < n; i++) b.cbox(M[['cream', 'charcoal', 'terra', 'greige'][i % 4]], x + (i % 2) * 0.012, y + i * 0.026, z, w - i * 0.02, 0.024, d - i * 0.012, 0, i * 0.12); };
/* Plumeaux de pampa dans un vase. */
function plumes(b, M, x, y, z, h, n, R) {
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, t = 0.12 + R() * 0.26, ex = x + Math.cos(a) * Math.sin(t) * h, ez = z + Math.sin(a) * Math.sin(t) * h, ey = y + Math.cos(t) * h;
    b.rod(M.pampas, [x, y, z], [ex, ey, ez], 0.004, 4);
    b.geo(M.pampas, new THREE.SphereGeometry(0.035, 6, 6), x + (ex - x) * 0.84, y + (ey - y) * 0.84, z + (ez - z) * 0.84, Math.sin(a) * t, 0, -Math.cos(a) * t, 1, h * 5.5, 1);
  }
}

export const F = {

  /* ── Séjour ─────────────────────────────────────────────────────────── */
  /* Canapé bas à larges accoudoirs, coussins d'assise et de dossier, plaid ; chaise = 'L' | 'R' ajoute une méridienne. */
  sofa(b, M, { w = 2.6, d = 1.0, mat = 'boucle', chaise = null, cl = 1.9, cw = 1.2, pillows = ['greige', 'boucle'], plaid = true, shelf = false }) {
    const m = M[mat], arm = 0.22, back = 0.24, sh = 0.43;
    b.cbox(M.black, 0, 0, 0, w - 0.1, 0.06, d - 0.1);                                  // socle en retrait
    b.cbox(m, 0, 0.06, 0, w, 0.2, d, 0.045, 0, 3);
    for (const sx of [-1, 1]) b.cbox(m, sx * (w / 2 - arm / 2), 0.2, 0, arm, 0.4, d, 0.085, 0, 3);        // accoudoirs larges et bas (60 cm)
    b.cbox(m, 0, 0.2, -d / 2 + back / 2, w - 2 * arm + 0.04, 0.52, back, 0.085, 0, 3);                    // dossier
    const n = Math.max(2, Math.round((w - 2 * arm) / 0.82)), sw = (w - 2 * arm) / n, sd = d - back - 0.02;
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + arm + sw * (i + 0.5);
      b.cbox(m, cx, 0.25, d / 2 - sd / 2 - 0.01, sw - 0.012, sh - 0.25, sd, 0.07, 0, 3);                  // coussin d'assise
      b.geo(m, rbox(sw - 0.05, 0.44, 0.17, 0.08, 3), cx, 0.66, -d / 2 + back + 0.06, -0.2, 0, 0);         // coussin de dossier incliné
    }
    if (chaise) {
      const s = chaise === 'R' ? 1 : -1, cx = s * (w / 2 - cw / 2);
      b.cbox(M.black, cx, 0, d / 2 + cl / 2 - 0.02, cw - 0.1, 0.06, cl - 0.1);
      b.cbox(m, cx, 0.06, d / 2 + cl / 2 - 0.02, cw, 0.2, cl, 0.045, 0, 3);
      b.cbox(m, cx, 0.25, d / 2 + cl / 2 - 0.02, cw - 0.03, sh - 0.25, cl - 0.03, 0.07, 0, 3);
    }
    pillows.forEach((p, i) => { const sx = i ? 1 : -1; b.geo(M[p], rbox(0.46, 0.44, 0.15, 0.07, 3), sx * (w / 2 - arm - 0.3), 0.66, -d / 2 + back + 0.22, -0.28, sx * -0.3, 0); });
    if (plaid) { const px = w / 2 - arm - sw * 0.5; b.cbox(M.throw, px, sh - 0.005, d / 2 - sd * 0.45, sw * 0.62, 0.022, sd * 0.8, 0.01); b.cbox(M.throw, px, 0.12, d / 2 + 0.006, sw * 0.62, sh - 0.11, 0.02, 0.009); }
    if (shelf) {                                                                       // étagère basse adossée au canapé (image du séjour d'étage)
      b.box(M.walnut, -w / 2 + 0.25, 0.04, -d / 2 - 0.3, w / 2 - 0.25, 0.62, -d / 2 - 0.004);
      for (const y of [0.1, 0.36]) b.box(M.black, -w / 2 + 0.28, y, -d / 2 - 0.302, w / 2 - 0.28, y + 0.22, -d / 2 - 0.28);
      books(b, M, -0.4, 0.36, -d / 2 - 0.17, 4); vase(b, M.pot, 0.3, 0.1, -d / 2 - 0.17, 0.6); bowl(b, M.pot, 0.75, 0.36, -d / 2 - 0.17, 0.09);
    }
    return chaise ? [w, d, chaise === 'R' ? [w / 2 - cw, d / 2, w / 2, d / 2 + cl] : [-w / 2, d / 2, -w / 2 + cw, d / 2 + cl]] : [w, d];
  },
  /* Fauteuil coque : mat 'walnut' = coque en noyer cintré et coussins sombres (fauteuil « coquillage » des images), sinon coque tapissée. */
  armchair(b, M, { mat = 'walnut' }) {
    const wood = mat === 'walnut' || mat === 'oak', sm = wood ? M.charcoal : M[mat];
    b.add(M[mat], shellGeo(0.36, 0.07, 0.3, 0.46, 0.24, 1.75, wood ? 0.02 : 0.05, 22, 6));
    b.geo(sm, new THREE.CylinderGeometry(0.33, 0.3, 0.1, 22), 0, 0.38, 0.03, 0, 0, 0, 1, 1, 0.95);
    if (wood) b.geo(sm, rbox(0.46, 0.3, 0.06, 0.03), 0, 0.58, -0.3, -0.24, 0, 0);
    b.cyl(wood ? M[mat] : M.black, 0, 0.27, 0.02, 0.3, 0.06, 20);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.rod(wood ? M[mat] : M.black, [sx * 0.16, 0.29, sz * 0.14], [sx * 0.3, 0, sz * 0.28], 0.016, 8, 0.011);
    return [0.8, 0.76];
  },
  /* Tables basses jumelles rondes (marbre noir). */
  coffeeRound(b, M, { r = 0.5, mat = 'marbleDark', h = 0.36 }) {
    b.cyl(M[mat], 0, h - 0.03, 0, r, 0.03, 44); b.cyl(M.black, 0, h - 0.05, 0, r * 0.96, 0.02, 30);
    b.lathe(M.black, 0, 0, 0, [[r * 0.5, 0], [r * 0.5, 0.015], [r * 0.2, 0.05], [r * 0.16, h - 0.08], [r * 0.4, h - 0.05]], 20);
    return [2 * r, 2 * r];
  },
  /* Table basse : oval = plateau ovale en marbre sur socle sombre (image du séjour), garnie d'un plateau, de tasses et de revues. */
  coffeeRect(b, M, { w = 1.2, d = 0.65, mat = 'marble', oval = true, h = 0.36 }) {
    if (oval) {
      b.geo(M[mat], new THREE.CylinderGeometry(1, 1, 0.045, 48), 0, h - 0.0225, 0, 0, 0, 0, w / 2, 1, d / 2);
      b.geo(M.black, new THREE.CylinderGeometry(1, 1, h - 0.045, 40), 0, (h - 0.045) / 2, 0, 0, 0, 0, w / 2 - 0.1, 1, d / 2 - 0.1);
    } else {
      b.cbox(M[mat], 0, h - 0.04, 0, w, 0.04, d, 0.01);
      for (const sx of [-1, 1]) { b.cbox(M.black, sx * (w / 2 - 0.06), 0, 0, 0.025, h - 0.04, d - 0.12); } b.cbox(M.black, 0, 0, 0, w - 0.12, 0.02, 0.025);
    }
    const tx = -w * 0.18;                                                             // plateau et gobelets en métal sombre
    b.cyl(M.potDark, tx, h, 0, 0.19, 0.008, 28); b.ring(M.potDark, tx, h + 0.012, 0, 0.19, 0.007, 0, 0, 30, 6);
    for (const [dx, dz, hh] of [[-0.06, -0.03, 0.11], [0.05, -0.06, 0.07], [0.03, 0.07, 0.07]]) b.cyl(M.potDark, tx + dx, h + 0.008, dz, 0.03, hh, 14, 0.034);
    b.cbox(M.cream, w * 0.2, h, 0.03, 0.22, 0.012, 0.29, 0, 0.35); b.cbox(M.paper, w * 0.2 + 0.01, h + 0.012, 0.02, 0.21, 0.006, 0.28, 0, 0.2);
    return [w, d];
  },
  rug(b, M, { w = 3, d = 2, mat = 'rugDark' }) { b.cbox(M[mat], 0, 0, 0, w, 0.014, d, 0.006); return null; },
  /* Mur TV : fond en marbre veiné rétro-éclairé, étagères lumineuses, meubles laqués gris, console suspendue. */
  tvWall(b, M, { w = 4.6, h = 2.45, tv = 1.45 }) {
    const sw = Math.min(1.0, w * 0.26), cx = sw / 2, cw = w - sw, th = tv * 0.5625, ty = 1.02;
    b.box(M.greyLacquer, -w / 2, 0, 0, w / 2, h, 0.03);
    b.box(M.marble, -w / 2 + sw, 0.62, 0.03, w / 2 - 0.04, 2.0, 0.045);                // panneau de marbre derrière l'écran
    b.box(M.led, -w / 2 + sw, 1.995, 0.03, w / 2 - 0.04, 2.005, 0.06); b.box(M.glow, -w / 2 + sw, 1.35, 0.046, w / 2 - 0.04, 2.0, 0.048); b.light(cx, 1.9, 0.3, 0.45, 'led');
    b.box(M.greyLacquer, -w / 2, 2.02, 0.03, w / 2, h, 0.36);                          // meubles hauts
    const nu = Math.max(2, Math.round(w / 0.62)); for (let i = 1; i < nu; i++) b.box(M.seam, -w / 2 + (w / nu) * i - 0.002, 2.03, 0.36, -w / 2 + (w / nu) * i + 0.002, h, 0.362);
    b.box(M.marble, -w / 2 + 0.03, 0.62, 0.03, -w / 2 + sw - 0.03, 2.0, 0.04);         // niche des étagères
    for (let i = 0; i < 3; i++) {
      const y = 0.95 + i * 0.36; b.box(M.greyLacquer, -w / 2 + 0.03, y, 0.04, -w / 2 + sw - 0.03, y + 0.025, 0.3); b.box(M.led, -w / 2 + 0.05, y - 0.006, 0.05, -w / 2 + sw - 0.05, y, 0.07);
      const ox = -w / 2 + sw * 0.3;
      if (i === 0) { vase(b, M.pot, ox, y + 0.025, 0.17, 0.7); books(b, M, ox + sw * 0.38, y + 0.025, 0.17, 3, 0.22, 0.16); }
      else if (i === 1) { bowl(b, M.ceramic, ox + sw * 0.3, y + 0.025, 0.17, 0.1); vase(b, M.potDark, ox - 0.05, y + 0.025, 0.17, 0.5); }
      else { b.sph(M.pot, ox, y + 0.115, 0.17, 0.09, 1, 1, 1, 12); b.cyl(M.ceramic, ox + sw * 0.36, y + 0.025, 0.17, 0.035, 0.16, 10, 0.05); }
    }
    b.light(-w / 2 + sw / 2, 1.5, 0.35, 0.4, 'led');
    b.box(M.greyLacquer, -w / 2, 0.24, 0.03, w / 2, 0.6, 0.44);                        // console suspendue
    const nc = Math.max(2, Math.round(w / 0.9)); for (let i = 1; i < nc; i++) b.box(M.seam, -w / 2 + (w / nc) * i - 0.002, 0.25, 0.44, -w / 2 + (w / nc) * i + 0.002, 0.59, 0.442);
    b.box(M.led, -w / 2 + 0.05, 0.228, 0.06, w / 2 - 0.05, 0.24, 0.4);
    b.box(M.black, cx - tv / 2 - 0.008, ty - 0.008, 0.045, cx + tv / 2 + 0.008, ty + th + 0.008, 0.07); b.box(M.screen, cx - tv / 2, ty, 0.07, cx + tv / 2, ty + th, 0.074);
    b.cbox(M.ceramic, cx + cw * 0.34, 0.6, 0.24, 0.07, 0.2, 0.07, 0.02); b.cyl(M.led, cx + cw * 0.34, 0.8, 0.24, 0.012, 0.02, 6);   // bougie
    return [w, 0.94];
  },
  sideboard(b, M, { w = 2.2, d = 0.45, h = 0.8, mat = 'walnut', top = null }) {
    b.cbox(M[mat], 0, 0.14, 0, w, h - 0.14, d, 0.006);
    if (top) b.cbox(M[top], 0, h, 0, w + 0.02, 0.02, d + 0.02);
    const n = Math.max(2, Math.round(w / 0.55));
    for (let i = 1; i < n; i++) b.box(M.seam, -w / 2 + (w / n) * i - 0.002, 0.15, d / 2, -w / 2 + (w / n) * i + 0.002, h - 0.01, d / 2 + 0.003);
    for (const sx of [-1, 1]) { b.box(M.black, sx * (w / 2 - 0.1) - 0.012, 0, -d / 2 + 0.05, sx * (w / 2 - 0.1) + 0.012, 0.14, d / 2 - 0.05); }
    const ty = h + (top ? 0.02 : 0);
    vase(b, M.pot, -w * 0.3, ty, 0, 0.9); books(b, M, w * 0.22, ty, 0, 3); bowl(b, M.potDark, w * 0.4, ty, 0.02, 0.1);
    return [w, d];
  },
  bookcase(b, M, { w = 2.4, h = 2.3, d = 0.34, mat = 'walnut' }) {
    b.box(M[mat], -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.02);
    const cols = Math.round(w / 0.8), rows = 5, R = rng(77 + Math.round(w * 10));
    for (let i = 0; i <= cols; i++) b.box(M[mat], -w / 2 + (w / cols) * i - 0.012, 0, -d / 2, -w / 2 + (w / cols) * i + 0.012, h, d / 2);
    for (let j = 0; j <= rows; j++) { const y = (h / rows) * j; b.box(M[mat], -w / 2, y - (j ? 0.024 : 0), -d / 2, w / 2, y + (j ? 0 : 0.024), d / 2); if (j && j < rows) b.box(M.led, -w / 2 + 0.03, y - 0.03, -d / 2 + 0.022, w / 2 - 0.03, y - 0.024, -d / 2 + 0.04); }
    const cols2 = ['cream', 'terra', 'charcoal', 'greige', 'linen', 'ochre', 'sand'];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const xa = -w / 2 + (w / cols) * i + 0.03, xb = -w / 2 + (w / cols) * (i + 1) - 0.03, y = (h / rows) * j + (j ? 0 : 0.024), k = R();
      if (k < 0.2) { vase(b, R() < 0.5 ? M.pot : M.potDark, (xa + xb) / 2, y, 0, 0.75); continue; }
      if (k < 0.32) { bowl(b, M.ceramic, (xa + xb) / 2, y, 0, 0.11); continue; }
      let x = xa; const xe = xb - R() * 0.32;
      while (x < xe) { const t = 0.02 + R() * 0.03, bh = 0.2 + R() * 0.1; b.box(M[cols2[(R() * cols2.length) | 0]], x, y, -d / 2 + 0.05, x + t, y + bh, d / 2 - 0.04 - R() * 0.04); x += t + 0.002; }
    }
    b.light(0, h * 0.6, d / 2 + 0.2, 0.4, 'led');
    return [w, d];
  },
  /* Tableau : toile, marie-louise claire, baguette fine (noire, ou laiton avec frame: 'brass'). */
  picture(b, M, { w = 0.9, h = 1.1, y = 1.55, mat = 'art1', frame = 'black' }) {
    b.box(M[frame], -w / 2 - 0.015, y - h / 2 - 0.015, 0, w / 2 + 0.015, y + h / 2 + 0.015, 0.03);
    b.box(M.white, -w / 2, y - h / 2, 0.03, w / 2, y + h / 2, 0.032);
    b.box(M[mat], -w / 2 + 0.035, y - h / 2 + 0.035, 0.032, w / 2 - 0.035, y + h / 2 - 0.035, 0.034);
    return null;
  },
  mirror(b, M, { w = 0.9, h = 1.0, y = 1.55 }) {
    b.box(M.brass, -w / 2 - 0.012, y - h / 2 - 0.012, 0, w / 2 + 0.012, y + h / 2 + 0.012, 0.022);
    b.box(M.mirror, -w / 2, y - h / 2, 0.022, w / 2, y + h / 2, 0.026);
    return null;
  },
  /* Panneau mural mince (carrelage, crédence, tête de lit lattée…) : centré, plaqué contre le mur côté -z. */
  panel(b, M, { w = 2, h = 2.2, y = 0, t = 0.02, mat = 'wallTile', slats = false }) {
    if (!slats) { b.box(M[mat], -w / 2, y, 0, w / 2, y + h, t); return null; }
    b.box(M.walnut, -w / 2, y, 0, w / 2, y + h, 0.012);
    for (let x = -w / 2 + 0.02; x < w / 2 - 0.02; x += 0.055) b.box(M[mat], x, y, 0.012, x + 0.032, y + h, 0.04);
    return null;
  },
  /* Rideau plissé du sol au plafond sur rail noir ; sheer = largeur de voilage tiré à côté. */
  curtain(b, M, { w = 0.7, ceil = 2.6, h = ceil - 0.02, mat = 'taupe', sheer = 0, side = 1 }) {
    b.add(M[mat], drapeGeo(w, h - 0.05, 0.07, 0.035));
    if (sheer) b.geo(M.sheer, drapeGeo(sheer, h - 0.05, 0.11, 0.02), side * (w / 2 + sheer / 2), 0, -0.03);
    b.box(M.black, Math.min(-w / 2, side * (w / 2 + sheer)) - 0.04, h - 0.03, -0.05, Math.max(w / 2, side * (w / 2 + sheer)) + 0.04, h - 0.01, 0.05);
    return null;
  },

  /* ── Repas ───────────────────────────────────────────────────────────── */
  /* Chaise coque tapissée sur quatre pieds fins évasés : assise à 47 cm, dossier à 80 cm. */
  chair(b, M, { mat = 'terra', leg = 'black' }) {
    b.add(M[mat], shellGeo(0.25, 0.045, 0.4, 0.4, 0.2, 1.7, 0.035, 18, 5));
    b.geo(M[mat], new THREE.CylinderGeometry(0.245, 0.225, 0.075, 22), 0, 0.432, 0.02, 0, 0, 0, 1, 1, 0.98);
    b.cyl(M[mat], 0, 0.36, 0.01, 0.14, 0.045, 18, 0.2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.rod(M[leg], [sx * 0.13, 0.385, sz * 0.12], [sx * 0.225, 0, sz * 0.215], 0.014, 8, 0.009);
    return null;
  },
  /* Table et ses chaises. round = table ronde en verre fumé sur piètement croisé (w = diamètre) ; sinon plateau de marbre sur piètement en U.
     n = nombre de chaises par grand côté (ou au total pour la ronde), ends = chaises en bout. La table est dressée. */
  diningTable(b, M, { w = 2.0, d = 1.0, top = 'marbleGrey', n = 3, ends = true, chairMat = 'greige', leg = 'black', round = false, dress = true }) {
    const R = rng(Math.round(w * 100) + n), seats = [];
    if (round) {
      const r = w / 2;
      b.cyl(M[top], 0, 0.725, 0, r, 0.025, 56); b.cyl(M.black, 0, 0.7, 0, r * 0.55, 0.025, 30);
      for (const a of [PI / 4, -PI / 4]) { b.push(0, 0, 0, a); b.geo(M.black, new THREE.BoxGeometry(r * 1.2, 0.03, 0.05), 0, 0.015, 0); for (const sx of [-1, 1]) b.rod(M.black, [sx * r * 0.58, 0.02, 0], [sx * r * 0.2, 0.7, 0], 0.02, 6); b.pop(); }
      for (let i = 0; i < n; i++) { const a = (i / n) * 2 * PI + PI / n; seats.push([Math.sin(a) * (r + 0.1), Math.cos(a) * (r + 0.1), a + PI, Math.sin(a) * (r - 0.24), Math.cos(a) * (r - 0.24)]); }
    } else {
      b.cbox(M[top], 0, 0.71, 0, w, 0.04, d, 0.008);
      for (const sx of [-1, 1]) { const x = sx * w * 0.3; b.box(M[leg], x - 0.04, 0, -d * 0.36, x + 0.04, 0.04, d * 0.36); for (const sz of [-1, 1]) b.box(M[leg], x - 0.04, 0.04, sz * d * 0.36 - 0.03, x + 0.04, 0.71, sz * d * 0.36 + 0.03); b.box(M[leg], x - 0.04, 0.67, -d * 0.36, x + 0.04, 0.71, d * 0.36); }
      for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5); seats.push([x, -d / 2 - 0.13, 0, x, -d / 2 + 0.22], [x, d / 2 + 0.13, PI, x, d / 2 - 0.22]); }
      if (ends) seats.push([-w / 2 - 0.15, 0, PI / 2, -w / 2 + 0.22, 0], [w / 2 + 0.15, 0, -PI / 2, w / 2 - 0.22, 0]);
    }
    for (const [x, z, rot, px, pz] of seats) {
      b.push(x, 0, z, rot); F.chair(b, M, { mat: chairMat }); b.pop();
      if (dress) { b.cyl(M.ceramic, px, 0.75, pz, 0.09, 0.012, 22, 0.135); b.cyl(M.ceramic, px, 0.762, pz, 0.06, 0.008, 18, 0.09); const s = Math.sin(rot + PI / 2), c = Math.cos(rot + PI / 2); glass(b, M, px + s * 0.17 + Math.sin(rot) * 0.1, 0.75, pz + c * 0.17 + Math.cos(rot) * 0.1); }
    }
    if (dress) {                                                                       // centre de table : vase de pampas, bouteilles, bougie
      vase(b, M.ceramic, 0, 0.75, 0, 0.8); plumes(b, M, 0, 0.99, 0, 0.42, 7, R);
      bottle(b, M.potDark, round ? 0.2 : w * 0.2, 0.75, 0.06); bottle(b, M.potDark, round ? -0.16 : -w * 0.22, 0.75, -0.1);
    }
    return round ? [w + 0.5, w + 0.5] : [w + 0.1, d + 0.5];
  },
  /* Tabouret de bar : petite coque sur colonne et embase ronde, repose-pieds. h = hauteur d'assise (66 cm pour un plan à 91 cm). */
  stool(b, M, { mat = 'terra', h = 0.66 }) {
    b.add(M[mat], shellGeo(0.2, 0.03, h - 0.04, 0.26, 0.1, 1.65, 0.03, 16, 4));
    b.geo(M[mat], new THREE.CylinderGeometry(0.195, 0.17, 0.07, 20), 0, h - 0.015, 0.015);
    b.cyl(M.black, 0, 0.015, 0, 0.022, h - 0.06, 10); b.lathe(M.black, 0, 0, 0, [[0.2, 0], [0.2, 0.012], [0.05, 0.03], [0.022, 0.05]], 22);
    b.ring(M.black, 0, 0.24, 0, 0.13, 0.008, 0, 0, 22, 6); b.rod(M.black, [0, 0.24, -0.13], [0, 0.24, 0.13], 0.006, 6);
    return null;
  },

  /* ── Cuisine ─────────────────────────────────────────────────────────── */
  /* Linéaire bas sans poignées (gorge sombre sous le plan) : w le long de x, façades vers +z, plan à 91 cm.
     sink / hob = abscisse du centre ; upper = meubles hauts en chêne avec ruban LED ; splash = crédence. */
  kitchenRun(b, M, { w = 3, d = 0.63, front = 'anthracite', top = 'marbleDark', sink = null, hob = null, upper = false, splash = false, upperMat = 'oakV', splashMat = 'oak', deco = true }) {
    const wt = 0.89;
    b.box(M.black, -w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.1, d / 2 - 0.07);
    b.box(M[front], -w / 2, 0.1, -d / 2, w / 2, 0.855, d / 2 - 0.02);
    b.box(M.black, -w / 2, 0.855, -d / 2, w / 2, wt, d / 2 - 0.04);
    const n = Math.max(1, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) b.box(M[front], -w / 2 + (w / n) * i + 0.0015, 0.105, d / 2 - 0.02, -w / 2 + (w / n) * (i + 1) - 0.0015, 0.852, d / 2);
    b.box(M[top], -w / 2 - 0.005, wt, -d / 2, w / 2 + 0.005, wt + 0.02, d / 2 + 0.015);
    const y = wt + 0.02;
    if (sink !== null) F._sink(b, M, sink, y, 0.02, -d / 2 + 0.07);
    if (hob !== null) F._hob(b, M, hob, y, 0.01);
    if (splash) b.box(M[splashMat], -w / 2, y, -d / 2, w / 2, 1.45, -d / 2 + 0.015);
    if (upper) {
      b.box(M[upperMat], -w / 2, 1.45, -d / 2, w / 2, 2.25, -d / 2 + 0.35);
      for (let i = 1; i < n; i++) b.box(M.seam, -w / 2 + (w / n) * i - 0.0015, 1.452, -d / 2 + 0.35, -w / 2 + (w / n) * i + 0.0015, 2.25, -d / 2 + 0.352);
      b.box(M.led, -w / 2 + 0.03, 1.442, -d / 2 + 0.04, w / 2 - 0.03, 1.45, -d / 2 + 0.07);
      b.box(M.glow, -w / 2 + 0.02, 0.95, -d / 2 + 0.017, w / 2 - 0.02, 1.45, -d / 2 + 0.019);
      b.light(0, 1.38, -d / 2 + 0.2, 0.6, 'led');
    }
    if (deco) {                                                                        // bouilloire, machine à café, planche et ustensiles, là où le plan est libre
      const free = [-w / 2 + 0.32, w / 2 - 0.32, -w / 2 + 0.95, w / 2 - 0.95].filter((x) => Math.abs(x) < w / 2 - 0.2 && (sink === null || Math.abs(x - sink) > 0.62) && (hob === null || Math.abs(x - hob) > 0.6));
      const z = -d / 2 + 0.17;
      if (free.length > 0) { const x = free[0]; b.cbox(M.black, x, y, z, 0.2, 0.3, 0.26, 0.02); b.box(M.steel, x - 0.07, y + 0.1, z + 0.13, x + 0.07, y + 0.115, z + 0.19); b.cyl(M.steel, x, y + 0.3, z - 0.02, 0.05, 0.03, 12); b.lathe(M.steel, x + 0.26, y, z, [[0.07, 0], [0.08, 0.06], [0.06, 0.17], [0.03, 0.19], [0.001, 0.2]], 14); }
      if (free.length > 1) { const x = free[1]; b.geo(M.oak, new THREE.BoxGeometry(0.28, 0.4, 0.018), x, y + 0.2, z - 0.09, -0.1, 0, 0); b.cyl(M.pot, x + 0.24, y, z, 0.05, 0.14, 12, 0.058); for (let i = 0; i < 4; i++) b.rod(M.oak, [x + 0.24, y + 0.1, z], [x + 0.24 + (i - 1.5) * 0.025, y + 0.32, z + (i % 2 - 0.5) * 0.03], 0.006, 5); }
      if (free.length > 2) { const x = free[2]; bowl(b, M.ceramic, x, y, z + 0.1, 0.15); for (const [dx, dz] of [[-0.04, 0], [0.05, 0.03], [0, -0.05]]) b.sph(M.ochre, x + dx, y + 0.085, z + 0.1 + dz, 0.038, 1, 1, 1, 8); }
    }
    return [w, d];
  },
  _sink(b, M, x, y, z, zb) {                                                           // cuve inox sous plan + mitigeur noir col de cygne
    b.box(M.steel, x - 0.37, y, z - 0.21, x + 0.37, y + 0.002, z + 0.21); b.box(M.potDark, x - 0.35, y + 0.001, z - 0.19, x + 0.35, y + 0.004, z + 0.19); b.cyl(M.steel, x + 0.1, y + 0.004, z, 0.035, 0.002, 12);
    b.cyl(M.black, x, y, zb, 0.022, 0.04, 10); b.tube(M.black, [[x, y + 0.03, zb], [x, y + 0.3, zb], [x, y + 0.38, zb + 0.05], [x, y + 0.38, zb + 0.15], [x, y + 0.32, zb + 0.19]], 0.011, 8);
    b.rod(M.black, [x + 0.022, y + 0.05, zb], [x + 0.09, y + 0.07, zb], 0.006, 6);
  },
  _hob(b, M, x, y, z) {                                                                // plaque à induction en verre noir
    b.box(M.screen, x - 0.38, y, z - 0.26, x + 0.38, y + 0.006, z + 0.26);
    for (const [dx, dz, r] of [[-0.2, -0.1, 0.09], [0.18, -0.11, 0.075], [-0.2, 0.12, 0.075], [0.18, 0.11, 0.1]]) b.ring(M.steel, x + dx, y + 0.0065, z + dz, r, 0.0025, 0, 0, 26, 4);
  },
  /* Colonnes hautes : réfrigérateur intégré et fours en verre noir. */
  kitchenTall(b, M, { w = 1.8, d = 0.63, h = 2.25, front = 'anthracite' }) {
    b.box(M.black, -w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.1, d / 2 - 0.07);
    b.box(M[front], -w / 2, 0.1, -d / 2, w / 2, h, d / 2 - 0.02);
    const n = Math.max(1, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w / n) * i + 0.0015, x1 = -w / 2 + (w / n) * (i + 1) - 0.0015;
      if (i === n - 1) {                                                               // colonne fours
        b.box(M[front], x0, 0.105, d / 2 - 0.02, x1, 0.6, d / 2); b.box(M[front], x0, 1.83, d / 2 - 0.02, x1, h, d / 2);
        for (const [ya, yb] of [[0.62, 1.2], [1.22, 1.81]]) { b.box(M.screen, x0, ya, d / 2 - 0.02, x1, yb, d / 2 + 0.004); b.box(M.steel, x0 + 0.04, yb - 0.075, d / 2 + 0.02, x1 - 0.04, yb - 0.06, d / 2 + 0.035); for (const hx of [x0 + 0.06, x1 - 0.06]) b.box(M.steel, hx - 0.006, yb - 0.075, d / 2 + 0.004, hx + 0.006, yb - 0.06, d / 2 + 0.03); b.box(M.led, x0 + 0.2, yb - 0.035, d / 2 + 0.004, x1 - 0.2, yb - 0.02, d / 2 + 0.0045); }
      } else { b.box(M[front], x0, 0.105, d / 2 - 0.02, x1, 1.0, d / 2); b.box(M[front], x0, 1.003, d / 2 - 0.02, x1, h, d / 2); b.box(M.black, i % 2 ? x0 : x1 - 0.018, 0.105, d / 2 - 0.004, i % 2 ? x0 + 0.018 : x1, h, d / 2 + 0.001); }
    }
    return [w, d];
  },
  /* Îlot : plan épais débordant côté tabourets (+z), retombées en pierre aux deux bouts, niche éclairée. */
  island(b, M, { w = 3.0, d = 1.1, front = 'oakV', top = 'marble', hob = null, sink = null, stools = 0, stoolMat = 'greige', over = 0.28, deco = true }) {
    const dz = -over / 2, wt = 0.87;
    b.box(M.black, -w / 2 + 0.06, 0, -d / 2 + 0.05, w / 2 - 0.06, 0.1, d / 2 - over - 0.05);
    b.box(M[front], -w / 2 + 0.04, 0.1, -d / 2 + 0.01, w / 2 - 0.04, wt, d / 2 - over);
    const n = Math.max(1, Math.round(w / 0.6));
    for (let i = 1; i < n; i++) b.box(M.seam, -w / 2 + (w / n) * i - 0.0015, 0.1, -d / 2 + 0.007, -w / 2 + (w / n) * i + 0.0015, wt - 0.035, -d / 2 + 0.01);
    b.box(M.black, -w / 2 + 0.04, wt - 0.035, -d / 2 + 0.006, w / 2 - 0.04, wt, -d / 2 + 0.01);
    b.box(M[top], -w / 2, wt, -d / 2, w / 2, wt + 0.04, d / 2);
    for (const sx of [-1, 1]) b.box(M[top], sx > 0 ? w / 2 - 0.04 : -w / 2, 0, -d / 2, sx > 0 ? w / 2 : -w / 2 + 0.04, wt, d / 2);
    if (stools) { b.box(M.walnut, -w / 2 + 0.04, 0.42, d / 2 - over - 0.002, w / 2 - 0.04, 0.72, d / 2 - over + 0.002); b.box(M.led, -w / 2 + 0.06, 0.715, d / 2 - over, w / 2 - 0.06, 0.722, d / 2 - over + 0.012); }
    const y = wt + 0.04;
    if (hob !== null) F._hob(b, M, hob, y, dz);
    if (sink !== null) F._sink(b, M, sink, y, dz + 0.03, dz - 0.2);
    for (let i = 0; i < stools; i++) { b.push(-w / 2 + (w / stools) * (i + 0.5), 0, d / 2 + 0.06, PI); F.stool(b, M, { mat: stoolMat }); b.pop(); }
    if (deco) { const x = w / 2 - 0.4, R = rng(31); vase(b, M.pot, x, y, dz, 0.9); plumes(b, M, x, y + 0.28, dz, 0.45, 6, R); bowl(b, M.ceramic, -w / 2 + 0.45, y, d / 2 - over * 0.8, 0.14); }
    return [w, d];
  },
  barTable(b, M, { w = 1.6, d = 0.9, top = 'marbleDark', stools = 2, stoolMat = 'terra' }) {
    b.cbox(M[top], 0, 0.87, 0, w, 0.04, d, 0.008);
    for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.14); b.box(M.black, x - 0.03, 0.03, -d / 2 + 0.16, x + 0.03, 0.87, d / 2 - 0.16); b.box(M.black, x - 0.05, 0, -d / 2 + 0.1, x + 0.05, 0.03, d / 2 - 0.1); }
    for (let i = 0; i < stools; i++) {
      const x = -w / 2 + (w / stools) * (i + 0.5);
      b.push(x, 0, -d / 2 - 0.06, 0); F.stool(b, M, { mat: stoolMat }); b.pop();
      b.push(x, 0, d / 2 + 0.06, PI); F.stool(b, M, { mat: stoolMat }); b.pop();
    }
    vase(b, M.pot, w * 0.3, 0.91, 0, 0.8); plumes(b, M, w * 0.3, 1.15, 0, 0.36, 5, rng(9)); glass(b, M, -w * 0.2, 0.91, 0.08); glass(b, M, -w * 0.28, 0.91, -0.04);
    return [w, d + 0.3];
  },

  /* ── Chambres ────────────────────────────────────────────────────────── */
  /* Lit : tête côté -z, pied vers +z. Sommier tapissé, tête capitonnée à panneaux, couette, jeté de lit, quatre oreillers ; dessus de couette à 58 cm. */
  bed(b, M, { w = 1.6, l = 2.0, linen = 'cream', throwMat = 'greige', head = 'sand', hw = 0.5, nights = true }) {
    const hm = M[head], HW = w + hw, np = Math.max(2, Math.round(HW / 0.45));
    for (let i = 0; i < np; i++) b.cbox(hm, -HW / 2 + (HW / np) * (i + 0.5), 0.05, -l / 2 - 0.045, HW / np - 0.008, 1.07, 0.1, 0.035);
    b.cbox(M.black, 0, 0, 0, w - 0.12, 0.05, l - 0.12);
    b.cbox(hm, 0, 0.05, 0.01, w + 0.1, 0.26, l + 0.08, 0.04);
    b.cbox(M.white, 0, 0.3, 0.01, w, 0.22, l, 0.06, 0, 3);
    b.cbox(M[linen], 0, 0.44, l * 0.14, w + 0.08, 0.14, l * 0.72, 0.065, 0, 3);
    b.cbox(M[linen], 0, 0.5, -l * 0.2, w + 0.06, 0.09, 0.3, 0.04, 0, 3);              // rabat de la couette
    b.cbox(M[throwMat], 0, 0.455, l * 0.33, w + 0.12, 0.135, l * 0.28, 0.05, 0, 3);
    const one = w < 1.2;
    for (const sx of one ? [0] : [-1, 1]) {
      b.geo(M.white, rbox(one ? w * 0.72 : w * 0.44, 0.4, 0.17, 0.08, 3), sx * w * 0.245, 0.72, -l / 2 + 0.16, -0.3, 0, 0);
      b.geo(M[throwMat], rbox(one ? w * 0.5 : w * 0.34, 0.3, 0.14, 0.065, 3), sx * w * 0.23, 0.68, -l / 2 + 0.34, -0.42, sx * 0.08, 0);
    }
    if (nights) for (const sx of [-1, 1]) {                                            // chevets tambour en chêne, lampe à pied céramique
      const x = sx * (w / 2 + 0.32), z = -l / 2 + 0.24;
      b.cyl(M.oak, x, 0, z, 0.22, 0.5, 26); b.cyl(M.black, x, 0, z, 0.2, 0.012, 20);
      b.lathe(M.pot, x, 0.5, z - 0.03, [[0.05, 0], [0.075, 0.04], [0.06, 0.13], [0.02, 0.19], [0.012, 0.24]], 14);
      b.lathe(M.lampShade, x, 0.72, z - 0.03, [[0.12, 0], [0.095, 0.17], [0.09, 0.17], [0.114, 0]], 20); b.light(x, 0.85, z, 0.45);
      if (sx > 0) books(b, M, x + 0.02, 0.5, z + 0.1, 2, 0.19, 0.14);
    }
    return [w + 0.1, l + 0.16];
  },
  /* Placard toute hauteur : portes plaquées, fines poignées noires, joint creux en tête. */
  wardrobe(b, M, { w = 2.2, d = 0.6, h = 2.35, mat = 'oak' }) {
    const m = M[mat === 'oak' ? 'oakV' : mat];
    b.box(M.black, -w / 2 + 0.02, 0, -d / 2 + 0.02, w / 2 - 0.02, 0.07, d / 2 - 0.05);
    b.box(m, -w / 2, 0.07, -d / 2, w / 2, h, d / 2 - 0.02);
    const n = Math.max(2, Math.round(w / 0.5));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w / n) * i + 0.0015, x1 = -w / 2 + (w / n) * (i + 1) - 0.0015;
      b.box(m, x0, 0.075, d / 2 - 0.02, x1, h - 0.004, d / 2);
      const hx = i % 2 ? x0 + 0.04 : x1 - 0.04;
      b.box(M.black, hx - 0.005, 0.95, d / 2 + 0.014, hx + 0.005, 1.25, d / 2 + 0.024); for (const yy of [0.97, 1.23]) b.box(M.black, hx - 0.004, yy - 0.004, d / 2, hx + 0.004, yy + 0.004, d / 2 + 0.018);
    }
    return [w, d];
  },
  dresser(b, M, { w = 1.9, d = 0.45, h = 0.72, mat = 'oak', tv = true }) {
    b.cbox(M[mat], 0, 0.12, 0, w, h - 0.12, d, 0.006);
    for (let i = 1; i < 4; i++) b.box(M.seam, -w / 2 + (w / 4) * i - 0.002, 0.13, d / 2, -w / 2 + (w / 4) * i + 0.002, h - 0.01, d / 2 + 0.003);
    b.box(M.seam, -w / 2 + 0.01, (h + 0.12) / 2 - 0.002, d / 2, w / 2 - 0.01, (h + 0.12) / 2 + 0.002, d / 2 + 0.003);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod(M.black, [sx * (w / 2 - 0.1), 0.12, sz * (d / 2 - 0.07)], [sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.05)], 0.014, 6, 0.009);
    if (tv) { b.box(M.black, -0.63, h + 0.07, -0.05, 0.63, h + 0.8, -0.02); b.box(M.screen, -0.62, h + 0.08, -0.02, 0.62, h + 0.79, -0.017); b.box(M.black, -0.2, h, -0.12, 0.2, h + 0.015, 0.05); b.box(M.black, -0.03, h, -0.06, 0.03, h + 0.1, -0.03); }
    for (let i = 0; i < 2; i++) bowl(b, M.pot, -w / 2 + 0.22 + i * 0.2, h, 0.02 + i * 0.05, 0.085 - i * 0.015);
    return [w, d];
  },
  desk(b, M, { w = 1.6, d = 0.65, top = 'walnut', leg = 'black', chair = 'greige', lamp = true }) {
    b.cbox(M[top], 0, 0.715, 0, w, 0.035, d, 0.006);
    for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.06); b.box(M[leg], x - 0.015, 0, -d / 2 + 0.05, x + 0.015, 0.03, d / 2 - 0.05); b.box(M[leg], x - 0.015, 0.685, -d / 2 + 0.05, x + 0.015, 0.715, d / 2 - 0.05); for (const sz of [-1, 1]) b.box(M[leg], x - 0.015, 0.03, sz * (d / 2 - 0.065) - 0.015, x + 0.015, 0.685, sz * (d / 2 - 0.065) + 0.015); }
    b.box(M.steel, -0.17, 0.75, -0.06, 0.17, 0.762, 0.17); b.geo(M.screen, new THREE.BoxGeometry(0.34, 0.22, 0.008), 0, 0.865, -0.085, -0.25, 0, 0);    // ordinateur portable
    if (lamp) { const x = w * 0.36, z = -d * 0.2; b.cyl(M.black, x, 0.75, z, 0.07, 0.012, 16); b.tube(M.black, [[x, 0.76, z], [x, 1.02, z], [x - 0.04, 1.12, z + 0.03], [x - 0.14, 1.16, z + 0.1]], 0.008, 6); b.lathe(M.black, x - 0.17, 1.1, z + 0.12, [[0.075, 0], [0.03, 0.07], [0.02, 0.07], [0.068, 0]], 14); b.light(x - 0.17, 1.05, z + 0.12, 0.5); }
    books(b, M, -w * 0.34, 0.75, -d * 0.1, 3);
    if (chair) { b.push(0, 0, d / 2 + 0.2, PI); F.officeChair(b, M, { mat: chair }); b.pop(); }
    return [w, d + (chair ? 0.3 : 0)];
  },
  officeChair(b, M, { mat = 'greige' }) {
    b.add(M[mat], shellGeo(0.25, 0.04, 0.42, 0.42, 0.2, 1.65, 0.035, 18, 5));
    b.geo(M[mat], new THREE.CylinderGeometry(0.245, 0.22, 0.075, 22), 0, 0.452, 0.02);
    b.cyl(M.steel, 0, 0.06, 0, 0.024, 0.36, 10);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 2 * PI; b.rod(M.steel, [0, 0.08, 0], [Math.sin(a) * 0.3, 0.035, Math.cos(a) * 0.3], 0.016, 6, 0.012); b.sph(M.black, Math.sin(a) * 0.3, 0.025, Math.cos(a) * 0.3, 0.025, 1, 1, 1, 6); }
    return null;
  },
  vanityTable(b, M, { w = 1.3, d = 0.42 }) {
    b.cbox(M.marble, 0, 0.72, 0, w, 0.03, d, 0.006);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod(M.brass, [sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05)], [sx * (w / 2 - 0.05), 0.72, sz * (d / 2 - 0.05)], 0.011, 8);
    b.geo(M.mirror, new THREE.CylinderGeometry(0.2, 0.2, 0.008, 30), 0, 1.02, -d / 2 + 0.05, PI / 2 - 0.1, 0, 0); b.ring(M.brass, 0, 1.02, -d / 2 + 0.05, 0.2, 0.008, PI / 2 - 0.1, 0, 30, 6);
    b.push(0, 0, d / 2 + 0.2, PI); F.pouf(b, M, { mat: 'sand' }); b.pop();
    return [w, d + 0.2];
  },
  pouf(b, M, { mat = 'sand', r = 0.24 }) { b.lathe(M[mat], 0, 0, 0, [[r * 0.7, 0], [r, 0.06], [r, 0.36], [r * 0.82, 0.42], [0.001, 0.43]], 22); return null; },
  /* Banquette de pied de lit tapissée. */
  bench(b, M, { w = 1.4, d = 0.42, mat = 'sand' }) {
    b.cbox(M[mat], 0, 0.14, 0, w, 0.3, d, 0.06, 0, 3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.black, sx * (w / 2 - 0.09), 0, sz * (d / 2 - 0.08), 0.016, 0.14, 8);
    return [w, d];
  },

  /* ── Pièces d'eau ────────────────────────────────────────────────────── */
  /* Baignoire : free = îlot ovale avec mitigeur sur pied ; sinon encastrée dans un tablier carrelé. */
  bathtub(b, M, { w = 0.82, l = 1.78, free = false }) {
    if (free) {
      const pts = [[0.36, 0], [0.43, 0.02], [0.49, 0.3], [0.52, 0.57], [0.5, 0.585], [0.465, 0.56], [0.42, 0.22], [0.3, 0.13], [0.001, 0.11]].map(([r, y]) => new THREE.Vector2(r, y));
      b.geo(M.ceramic, new THREE.LatheGeometry(pts, 36), 0, 0, 0, 0, 0, 0, w / 1.04, 1, l / 1.04);
      const tx = w / 2 + 0.09, tz = -l * 0.18;
      b.cyl(M.black, tx, 0, tz, 0.045, 0.01, 12); b.tube(M.black, [[tx, 0, tz], [tx, 0.86, tz], [tx - 0.03, 0.95, tz], [tx - 0.2, 0.95, tz], [tx - 0.24, 0.9, tz]], 0.014, 8); b.rod(M.black, [tx, 0.7, tz], [tx, 0.7, tz + 0.08], 0.008, 6);
      return [w + 0.2, l];
    }
    const t = 0.07;
    b.box(M.wallTile, -w / 2, 0, -l / 2, w / 2, 0.56, -l / 2 + t); b.box(M.wallTile, -w / 2, 0, l / 2 - t, w / 2, 0.56, l / 2); b.box(M.wallTile, -w / 2, 0, -l / 2 + t, -w / 2 + t, 0.56, l / 2 - t); b.box(M.wallTile, w / 2 - t, 0, -l / 2 + t, w / 2, 0.56, l / 2 - t);
    b.box(M.ceramic, -w / 2 + t, 0.1, -l / 2 + t, w / 2 - t, 0.13, l / 2 - t); b.box(M.ceramic, -w / 2 + t - 0.004, 0.13, -l / 2 + t - 0.004, w / 2 - t + 0.004, 0.555, -l / 2 + t); b.box(M.ceramic, -w / 2 + t - 0.004, 0.13, l / 2 - t, w / 2 - t + 0.004, 0.555, l / 2 - t + 0.004);
    b.tube(M.black, [[0, 0.56, -l / 2 + 0.04], [0, 0.7, -l / 2 + 0.04], [0, 0.72, -l / 2 + 0.16]], 0.012, 6);
    return [w, l];
  },
  /* Meuble vasque suspendu en chêne, plan en pierre, vasques à poser, mitigeurs noirs, miroir rétro-éclairé au mur (-z). */
  vanity(b, M, { w = 1.5, d = 0.5, double = true, mat = 'oak', mirrorH = 0.9 }) {
    b.box(M[mat], -w / 2, 0.4, -d / 2, w / 2, 0.83, d / 2 - 0.018);
    const nd = double ? 2 : 1;
    for (let i = 0; i < nd; i++) for (const [ya, yb] of [[0.403, 0.612], [0.616, 0.827]]) b.box(M[mat], -w / 2 + (w / nd) * i + 0.002, ya, d / 2 - 0.018, -w / 2 + (w / nd) * (i + 1) - 0.002, yb, d / 2);
    b.box(M.marble, -w / 2 - 0.005, 0.83, -d / 2, w / 2 + 0.005, 0.85, d / 2 + 0.01);
    const xs = double ? [-w * 0.25, w * 0.25] : [0];
    for (const x of xs) {
      b.lathe(M.ceramic, x, 0.85, 0.03, [[0.1, 0], [0.17, 0.03], [0.2, 0.12], [0.185, 0.125], [0.15, 0.05], [0.02, 0.03]], 26);
      b.cyl(M.black, x, 0.85, -d / 2 + 0.07, 0.02, 0.02, 10); b.tube(M.black, [[x, 0.86, -d / 2 + 0.07], [x, 1.1, -d / 2 + 0.07], [x, 1.13, -d / 2 + 0.1], [x, 1.12, -d / 2 + 0.2]], 0.01, 8); b.rod(M.black, [x + 0.02, 0.93, -d / 2 + 0.07], [x + 0.07, 0.95, -d / 2 + 0.07], 0.005, 6);
    }
    b.box(M.led, -w / 2 + 0.02, 1.1, -d / 2 + 0.006, w / 2 - 0.02, 1.14 + mirrorH, -d / 2 + 0.02);        // halo derrière le miroir
    b.box(M.mirror, -w / 2 + 0.05, 1.13, -d / 2 + 0.02, w / 2 - 0.05, 1.11 + mirrorH, -d / 2 + 0.028);
    b.cyl(M.potDark, w / 2 - 0.12, 0.85, -0.1, 0.028, 0.15, 10); b.cyl(M.steel, w / 2 - 0.12, 1.0, -0.1, 0.008, 0.035, 6);        // flacon
    b.cbox(M.cream, double ? 0 : -w / 2 + 0.16, 0.85, 0.08, 0.2, 0.05, 0.28, 0.012);                    // serviettes pliées
    b.light(0, 1.6, 0.1, 0.7, 'led');
    return [w, d];
  },
  /* WC suspendu sur bâti-support carrelé : cuvette à 42 cm, plaque de commande. */
  toilet(b, M, { }) {
    b.box(M.wallTile, -0.45, 0, -0.33, 0.45, 1.15, -0.25); b.box(M.steel, -0.12, 0.92, -0.25, 0.12, 1.07, -0.243);
    b.geo(M.ceramic, rbox(0.36, 0.26, 0.52, 0.11, 3), 0, 0.29, 0.01); b.geo(M.ceramic, rbox(0.37, 0.03, 0.46, 0.014, 2), 0, 0.432, 0.035);
    return [0.5, 0.62];
  },
  /* Lave-mains : vasque murale, mitigeur noir, miroir rond. */
  basin(b, M, { w = 0.45 }) {
    b.geo(M.ceramic, rbox(w, 0.12, 0.28, 0.035, 2), 0, 0.82, 0.0); b.box(M.tubIn, -w / 2 + 0.04, 0.878, -0.09, w / 2 - 0.04, 0.881, 0.1);
    b.tube(M.black, [[0, 0.88, -0.11], [0, 1.0, -0.11], [0, 1.02, -0.08], [0, 1.0, -0.02]], 0.009, 6);
    b.geo(M.mirror, new THREE.CylinderGeometry(0.24, 0.24, 0.008, 34), 0, 1.5, -0.135, PI / 2, 0, 0); b.ring(M.black, 0, 1.5, -0.135, 0.24, 0.007, PI / 2, 0, 34, 6);
    b.cyl(M.steel, 0, 0.5, -0.1, 0.02, 0.26, 8);
    return [w, 0.3];
  },
  /* Douche à l'italienne : receveur carrelé de plain-pied, paroi(s) vitrée(s) à profilés noirs, colonne avec ciel de pluie. glass = côtés fermés. */
  shower(b, M, { w = 1.2, d = 0.95, glass = ['front'] }) {
    b.box(M.wallTile, -w / 2, 0.0, -d / 2, w / 2, 0.012, d / 2); b.box(M.steel, -0.3, 0.012, -d / 2 + 0.08, 0.3, 0.014, -d / 2 + 0.14);      // caniveau
    b.box(M.wallTile, -w / 2, 0, -d / 2, w / 2, 2.2, -d / 2 + 0.015);
    const pane = (x0, z0, x1, z1) => { b.box(M.glass, x0, 0.012, z0, x1, 2.05, z1); b.box(M.black, x0 - 0.004, 2.05, z0 - 0.004, x1 + 0.004, 2.07, z1 + 0.004); b.box(M.black, x0 - 0.004, 0.0, z0 - 0.004, x1 + 0.004, 0.018, z1 + 0.004); };
    for (const g of glass) {
      if (g === 'front') { pane(-w / 2, d / 2 - 0.01, w / 2 - 0.55, d / 2); b.box(M.black, w / 2 - 0.555, 0, d / 2 - 0.012, w / 2 - 0.545, 2.07, d / 2 + 0.002); }
      if (g === 'left') pane(-w / 2, -d / 2, -w / 2 + 0.01, d / 2);
      if (g === 'right') pane(w / 2 - 0.01, -d / 2, w / 2, d / 2);
    }
    const x = -w / 2 + 0.3, z = -d / 2 + 0.015;
    b.tube(M.black, [[x, 1.1, z + 0.01], [x, 2.12, z + 0.01], [x, 2.16, z + 0.05], [x, 2.16, z + 0.34]], 0.011, 8); b.cyl(M.black, x, 2.13, z + 0.34, 0.13, 0.012, 24);
    b.geo(M.black, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), x, 1.1, z + 0.015, PI / 2, 0, 0); b.rod(M.black, [x, 1.1, z + 0.03], [x + 0.06, 1.1, z + 0.05], 0.006, 6);
    b.rod(M.black, [x + 0.22, 0.95, z + 0.03], [x + 0.22, 1.7, z + 0.03], 0.008, 6); b.geo(M.black, new THREE.CylinderGeometry(0.04, 0.03, 0.02, 12), x + 0.22, 1.62, z + 0.07, PI / 2 - 0.5, 0, 0);
    b.box(M.wallTile, w / 2 - 0.42, 1.1, -d / 2 + 0.015, w / 2 - 0.1, 1.4, -d / 2 + 0.018); for (let i = 0; i < 2; i++) b.cyl(i ? M.pot : M.potDark, w / 2 - 0.34 + i * 0.12, 1.1, -d / 2 + 0.05, 0.025, 0.14, 8);
    return null;
  },
  /* Sèche-serviettes noir à barreaux, garni d'une serviette. */
  towelRail(b, M, { w = 0.5, h = 1.2 }) {
    for (const sx of [-1, 1]) b.rod(M.black, [sx * w / 2, 0.75, 0.03], [sx * w / 2, 0.75 + h, 0.03], 0.012, 8);
    for (let i = 0; i < 9; i++) b.rod(M.black, [-w / 2, 0.8 + (h - 0.1) * (i / 8), 0.03], [w / 2, 0.8 + (h - 0.1) * (i / 8), 0.03], 0.008, 6);
    b.cbox(M.cream, 0, 1.25, 0.05, w - 0.1, 0.5, 0.03, 0.012);
    return null;
  },
  /* Lave-linge et sèche-linge sous un plan, hublots vitrés. */
  washer(b, M, { n = 2 }) {
    for (let i = 0; i < n; i++) {
      const x = -n * 0.3 + 0.3 + i * 0.6;
      b.cbox(M.white, x, 0.01, 0, 0.595, 0.84, 0.58, 0.012);
      b.geo(M.steel, new THREE.TorusGeometry(0.17, 0.022, 8, 30), x, 0.42, 0.292); b.geo(M.screen, new THREE.CylinderGeometry(0.16, 0.16, 0.01, 28), x, 0.42, 0.292, PI / 2, 0, 0);
      b.box(M.potDark, x - 0.28, 0.74, 0.29, x + 0.28, 0.83, 0.293); b.geo(M.steel, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14), x + 0.18, 0.785, 0.3, PI / 2, 0, 0); b.box(M.led, x - 0.22, 0.775, 0.293, x - 0.08, 0.795, 0.2935);
    }
    b.box(M.oak, -n * 0.3 - 0.01, 0.855, -0.31, n * 0.3 + 0.01, 0.885, 0.31);
    b.cbox(M.cream, -n * 0.3 + 0.3, 0.885, 0, 0.34, 0.12, 0.26, 0.03); b.cyl(M.rattan, n * 0.3 - 0.3, 0.885, 0, 0.14, 0.2, 16, 0.17);
    return [n * 0.6, 0.62];
  },
  /* Étagères ouvertes : linge plié, paniers. */
  shelves(b, M, { w = 1.2, d = 0.4, h = 2.0, mat = 'oak' }) {
    for (const sx of [-1, 1]) b.box(M[mat], sx > 0 ? w / 2 - 0.02 : -w / 2, 0, -d / 2, sx > 0 ? w / 2 : -w / 2 + 0.02, h, d / 2);
    const R = rng(Math.round(w * 53)), rows = 5;
    for (let j = 0; j <= rows; j++) {
      const y = 0.08 + ((h - 0.1) / rows) * j; b.box(M[mat], -w / 2 + 0.02, y, -d / 2, w / 2 - 0.02, y + 0.022, d / 2);
      if (j === rows) continue;
      if (j % 2 === 0) for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.34) b.cyl(M.rattan, x, y + 0.022, 0, 0.11, 0.2, 14, 0.13);
      else for (let x = -w / 2 + 0.2; x < w / 2 - 0.15; x += 0.36) for (let k = 0; k < 3; k++) b.cbox(M[['cream', 'greige', 'white', 'sand'][(R() * 4) | 0]], x, y + 0.022 + k * 0.05, 0, 0.28, 0.048, d - 0.1, 0.014);
    }
    return [w, d];
  },

  /* ── Plantes et luminaires ───────────────────────────────────────────── */
  /* Plante en pot : 'olive' (olivier), 'snake' (sansevière), 'palm' (kentia). */
  plant(b, M, { h = 1.6, kind = 'olive', pot = 0.24 }) {
    const R = rng(Math.round(h * 100) + kind.length * 7), dark = kind === 'snake', ph = pot * (kind === 'snake' ? 1.3 : 1.5);
    b.lathe(dark ? M.potDark : M.pot, 0, 0, 0, [[pot * 0.6, 0], [pot * 0.95, pot * 0.3], [pot, ph * 0.7], [pot * 0.82, ph], [pot * 0.74, ph], [pot * 0.74, ph - 0.03], [0.001, ph - 0.03]], 22);
    if (dark) b.cyl(M.white, 0, ph * 0.55, 0, pot * 1.005, ph * 0.12, 22);
    if (kind === 'snake') {                                                            // feuilles en lames dressées
      for (let i = 0; i < 13; i++) { const a = R() * 6.283, rr = R() * pot * 0.5, lh = (h - ph) * (0.55 + R() * 0.45), t = 0.1 + R() * 0.16; b.geo(i % 3 ? M.leafCypress : M.sage, new THREE.ConeGeometry(0.035 + R() * 0.02, lh, 4), Math.cos(a) * (rr + Math.sin(t) * lh * 0.4), ph - 0.04 + lh / 2, Math.sin(a) * (rr + Math.sin(t) * lh * 0.4), Math.sin(a) * t, a, -Math.cos(a) * t, 1, 1, 0.28); }
    } else if (kind === 'palm') {                                                      // palmes arquées
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.283 + R() * 0.4, L = (h - ph) * (0.8 + R() * 0.35), up = 0.55 + R() * 0.3, pts = [];
        for (let k = 0; k <= 4; k++) { const t = k / 4, rr = Math.sin(t * 1.2) * L * 0.62; pts.push([Math.cos(a) * rr, ph + L * up * Math.sin(t * 1.9) * 0.9, Math.sin(a) * rr]); }
        b.tube(M.leafCypress, pts, 0.006, 4);
        for (let k = 1; k <= 4; k++) leaves(b, M.leafBroad, pts[k][0], pts[k][1], pts[k][2], 0.12, 5, 0.42, R, 0.5);
      }
    } else {                                                                           // olivier : tronc fin, charpentières, bouquets de feuilles argentées
      const th = (h - ph) * 0.45; b.tube(M.bark, [[0, ph - 0.04, 0], [0.02, ph + th * 0.5, 0.01], [-0.01, ph + th, 0]], 0.016, 6);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + R(), rr = 0.12 + R() * 0.2, ty = ph + th + (h - ph - th) * (0.25 + R() * 0.6); b.rod(M.bark, [0, ph + th - 0.02, 0], [Math.cos(a) * rr, ty, Math.sin(a) * rr], 0.008, 4, 0.004); leaves(b, M.leafOlive, Math.cos(a) * rr, ty, Math.sin(a) * rr, 0.2, 13, 0.34, R, 0.9); }
      leaves(b, M.leafOlive, 0, h - 0.18, 0, 0.2, 12, 0.34, R, 0.8);
    }
    return [pot * 2, pot * 2];
  },
  pampas(b, M, { h = 1.5 }) {
    b.lathe(M.pot, 0, 0, 0, [[0.08, 0], [0.14, 0.1], [0.15, 0.3], [0.09, 0.48], [0.06, 0.55], [0.07, 0.58], [0.05, 0.58], [0.04, 0.5]], 18);
    plumes(b, M, 0, 0.55, 0, h - 0.55, 10, rng(5));
    return [0.3, 0.3];
  },
  /* Lampadaire arc : pied laiton, abat-jour en lin. */
  floorLamp(b, M, { h = 1.65 }) {
    b.cyl(M.brass, 0, 0, 0, 0.16, 0.018, 24); b.cyl(M.brass, 0, 0.018, 0, 0.011, h - 0.32, 8);
    b.lathe(M.lampShade, 0, h - 0.34, 0, [[0.21, 0], [0.17, 0.32], [0.163, 0.32], [0.203, 0]], 26); b.light(0, h - 0.12, 0, 0.9);
    return [0.3, 0.3];
  },
  tableLamp(b, M, { y = 0.8 }) {
    b.lathe(M.pot, 0, y, 0, [[0.05, 0], [0.085, 0.05], [0.07, 0.15], [0.022, 0.21], [0.012, 0.25]], 16);
    b.lathe(M.lampShade, 0, y + 0.23, 0, [[0.14, 0], [0.105, 0.19], [0.1, 0.19], [0.134, 0]], 22); b.light(0, y + 0.45, 0, 0.6);
    return null;
  },
  /* Suspension : `drop` = hauteur sous plafond du luminaire. kind = 'ring' (grand lustre à anneaux LED en laiton), 'rings3' (trois anneaux verticaux
     entrelacés), 'cone' (cônes laiton), 'rail' (réglette noire à spots laiton), 'tubes' (tubes LED noirs croisés), 'globe' (opaline). */
  pendant(b, M, { ceil = 2.6, drop = 0.9, kind = 'globe', n = 1, span = 0.6 }) {
    const y = ceil - drop, cable = (x, yy, z) => b.rod(M.black, [x, yy, z], [x, ceil, z], 0.0025, 4);
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
      b.box(M.black, -L / 2, y + 0.3, -0.02, L / 2, y + 0.33, 0.02); for (const sx of [-1, 1]) cable(sx * L * 0.42, y + 0.33, 0);
      for (let i = 0; i < n; i++) { const x = n > 1 ? -span * (n - 1) / 2 + i * span : 0, t = (i % 2 ? 0.3 : -0.25); b.geo(M.brass, new THREE.CylinderGeometry(0.035, 0.035, 0.17, 14), x + t * 0.1, y + 0.17, 0, 0, 0, t); b.geo(M.led, new THREE.CylinderGeometry(0.03, 0.03, 0.004, 12), x + t * 0.185, y + 0.088, 0, 0, 0, t); b.rod(M.black, [x, y + 0.3, 0], [x + t * 0.06, y + 0.25, 0], 0.006, 6); }
      b.light(0, y - 0.15, 0, 1.1); return null;
    }
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? -span * (n - 1) / 2 + i * span : 0, yy = y - (i % 2) * 0.12;
      cable(x, yy, 0);
      if (kind === 'globe') { b.sph(M.lampShade, x, yy - 0.13, 0, 0.14, 1, 1, 1, 20); b.cyl(M.brass, x, yy - 0.01, 0, 0.035, 0.04, 12, 0.02); }
      else { b.lathe(M.brass, x, yy - 0.24, 0, [[0.12, 0], [0.03, 0.2], [0.018, 0.24], [0.012, 0.24], [0.025, 0.2], [0.112, 0.004]], 22); b.cyl(M.led, x, yy - 0.2, 0, 0.05, 0.006, 14); }
      b.light(x, yy - 0.3, 0, 1.0 / Math.sqrt(n));
    }
    return null;
  },

  /* ── Extérieur ───────────────────────────────────────────────────────── */
  /* Bain de soleil : châssis en teck, matelas blanc, dossier relevé. */
  lounger(b, M, { }) {
    b.cbox(M.teak, 0, 0.2, 0, 0.7, 0.05, 1.95, 0.008);
    for (const sx of [-1, 1]) { b.box(M.teak, sx * 0.33 - 0.025, 0.14, -0.975, sx * 0.33 + 0.025, 0.2, 0.975); for (const sz of [-0.8, 0.8]) b.box(M.teak, sx * 0.33 - 0.025, 0, sz - 0.03, sx * 0.33 + 0.025, 0.14, sz + 0.03); }
    b.cbox(M.white, 0, 0.25, 0.32, 0.64, 0.09, 1.26, 0.04, 0, 3);
    b.geo(M.white, rbox(0.64, 0.09, 0.72, 0.04, 3), 0, 0.47, -0.62, 0.55, 0, 0); b.geo(M.teak, new THREE.BoxGeometry(0.68, 0.03, 0.74), 0, 0.42, -0.64, 0.55, 0, 0);
    b.geo(M.greige, rbox(0.4, 0.1, 0.22, 0.045, 3), 0, 0.62, -0.78, 0.55, 0, 0);
    return [0.75, 1.95];
  },
  sideTable(b, M, { r = 0.22, h = 0.42, mat = 'teak' }) { b.cyl(M[mat], 0, h - 0.03, 0, r, 0.03, 24); b.lathe(M.black, 0, 0, 0, [[r * 0.7, 0], [r * 0.7, 0.012], [0.03, 0.03], [0.02, h - 0.03]], 16); return [2 * r, 2 * r]; },
  outdoorSofa(b, M, { w = 2.1, d = 0.9 }) {
    b.cbox(M.teak, 0, 0.1, 0, w, 0.16, d, 0.01); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.teak, sx * (w / 2 - 0.06) - 0.03, 0, sz * (d / 2 - 0.06) - 0.03, sx * (w / 2 - 0.06) + 0.03, 0.1, sz * (d / 2 - 0.06) + 0.03);
    b.cbox(M.teak, 0, 0.26, -d / 2 + 0.04, w, 0.42, 0.06, 0.01); for (const sx of [-1, 1]) b.cbox(M.teak, sx * (w / 2 - 0.035), 0.26, 0, 0.06, 0.3, d, 0.01);
    const n = Math.max(2, Math.round(w / 0.75)), sw = (w - 0.14) / n;
    for (let i = 0; i < n; i++) { const x = -w / 2 + 0.07 + sw * (i + 0.5); b.cbox(M.linen, x, 0.26, 0.03, sw - 0.02, 0.14, d - 0.16, 0.05, 0, 3); b.geo(M.linen, rbox(sw - 0.04, 0.36, 0.14, 0.06, 3), x, 0.56, -d / 2 + 0.16, -0.16, 0, 0); }
    b.geo(M.terra, rbox(0.4, 0.38, 0.13, 0.06, 3), -w / 2 + 0.35, 0.56, -d / 2 + 0.3, -0.25, 0.3, 0);
    return [w, d];
  },
  /* Table de jardin en aluminium noir à plateau latté et ses fauteuils. */
  outdoorTable(b, M, { w = 2.4, d = 1.0, n = 4, ends = false }) {
    for (let x = -w / 2; x < w / 2 - 0.01; x += 0.1) b.box(M.frame, x + 0.004, 0.715, -d / 2, x + 0.096, 0.74, d / 2);
    b.box(M.frame, -w / 2, 0.68, -d / 2, w / 2, 0.715, -d / 2 + 0.05); b.box(M.frame, -w / 2, 0.68, d / 2 - 0.05, w / 2, 0.715, d / 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.frame, sx * (w / 2 - 0.06) - 0.03, 0, sz * (d / 2 - 0.06) - 0.03, sx * (w / 2 - 0.06) + 0.03, 0.68, sz * (d / 2 - 0.06) + 0.03);
    const ch = (x, z, r) => { b.push(x, 0, z, r); b.add(M.frame, shellGeo(0.27, 0.03, 0.4, 0.4, 0.26, 1.7, 0.025, 14, 4)); b.geo(M.charcoal, new THREE.CylinderGeometry(0.25, 0.24, 0.07, 18), 0, 0.43, 0.02); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.rod(M.frame, [sx * 0.2, 0.4, sz * 0.2], [sx * 0.24, 0, sz * 0.24], 0.014, 6); b.pop(); };
    for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5); ch(x, -d / 2 - 0.2, 0); ch(x, d / 2 + 0.2, PI); }
    if (ends) { ch(-w / 2 - 0.24, 0, PI / 2); ch(w / 2 + 0.24, 0, -PI / 2); }
    b.cyl(M.pot, 0, 0.74, 0, 0.1, 0.07, 16, 0.13); leaves(b, M.leafOlive, 0, 0.9, 0, 0.12, 14, 0.2, rng(3), 0.8);
    return [w + 0.3, d + 0.9];
  },
  /* Parasol écru à huit pans, mât bois, pied lesté. */
  parasol(b, M, { r = 1.5, h = 2.5 }) {
    b.cyl(M.teak, 0, 0, 0, 0.025, h + 0.12, 10); b.cyl(M.concrete, 0, 0, 0, 0.28, 0.06, 20);
    b.geo(M.linen, new THREE.ConeGeometry(r, 0.42, 8, 1, true), 0, h - 0.08, 0, 0, PI / 8, 0); b.geo(M.linen, new THREE.ConeGeometry(r * 0.995, 0.418, 8, 1, true), 0, h - 0.083, 0, PI, PI / 8, 0, 1, -1, 1);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; b.rod(M.teak, [0, h + 0.1, 0], [Math.sin(a) * r * 0.98, h - 0.29, Math.cos(a) * r * 0.98], 0.008, 4); b.rod(M.teak, [0, h - 0.5, 0], [Math.sin(a) * r * 0.5, h - 0.1, Math.cos(a) * r * 0.5], 0.006, 4); }
    return [0.5, 0.5];
  },
  planter(b, M, { w = 1.2, d = 0.4, h = 0.5, plant = 'lavender' }) {
    b.cbox(M.concrete, 0, 0, 0, w, h, d, 0.02);
    const R = rng(Math.round(w * 37));
    for (let x = -w / 2 + 0.16; x < w / 2 - 0.1; x += 0.24) { leaves(b, M.leafOlive, x, h + 0.1, 0, 0.15, 12, 0.2, R, 0.7); if (plant === 'lavender') for (let i = 0; i < 6; i++) b.geo(M.lavender, cone(0.02, 0.2, 5), x + (R() - 0.5) * 0.2, h + 0.3, (R() - 0.5) * 0.2, (R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4); }
    return [w, d];
  },
};

/* ── Végétaux de pleine terre (dessinés en coordonnées de plan ; renvoient l'emprise du tronc pour les collisions) ── */
export const V = {
  /* Arbre : 'olive' (tronc noueux, houppier argenté), 'pine' (pin parasol), 'oak' (feuillu). Le feuillage est fait de touffes de petites cartes. */
  tree(b, M, x, z, { kind = 'pine', h = 7, r = 2.6, seed = 1, y = 0 }) {
    const R = rng(seed * 131 + 7), pine = kind === 'pine', th = h * (pine ? 0.62 : 0.38), lean = (R() - 0.5) * 0.22;
    const top = [x + lean * th, y + th, z + (R() - 0.5) * 0.2 * th * 0.3], tr = 0.09 + r * 0.035;
    b.tube(M.bark, [[x, y - 0.1, z], [x + lean * th * 0.3 + (R() - 0.5) * 0.12, y + th * 0.45, z + (R() - 0.5) * 0.12], top], tr, 8);
    b.cyl(M.bark, x, y, z, tr * 1.7, 0.25, 9, tr * 1.05);
    const mat = pine ? M.leafPine : kind === 'olive' ? M.leafOlive : M.leafBroad, n = pine ? 9 : 8, cy = y + th + (pine ? r * 0.2 : r * 0.42), fl = pine ? 0.42 : 0.8;
    b.sph(M.hedge, top[0], cy, top[2], r * 0.5, 1, fl * 0.9, 1, 10);                      // cœur sombre du houppier
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + R() * 0.6, rr = r * (0.35 + R() * 0.35), bx = top[0] + Math.cos(a) * rr, bz = top[2] + Math.sin(a) * rr, by = cy + (R() - 0.5) * r * fl * 0.7;
      b.rod(M.bark, top, [bx, by - r * 0.1, bz], tr * 0.45, 5, tr * 0.15);
      leaves(b, mat, bx, by, bz, r * 0.5, Math.round(26 + r * 7), pine ? 0.95 : kind === 'olive' ? 0.6 : 0.8, R, fl);
    }
    leaves(b, mat, top[0], cy + r * fl * 0.35, top[2], r * 0.55, Math.round(30 + r * 8), pine ? 0.95 : kind === 'olive' ? 0.6 : 0.8, R, fl * 0.8);
    return [x - 0.25, z - 0.25, x + 0.25, z + 0.25];
  },
  /* Cyprès de Provence : fuseau. */
  cypress(b, M, x, z, { h = 6, y = 0 }) {
    const w = 0.42 + h * 0.035;
    b.cyl(M.bark, x, y, z, 0.07, h * 0.1, 6);
    b.lathe(M.leafCypress, x, y + h * 0.06, z, [[0.1, 0], [w, h * 0.12], [w * 1.05, h * 0.3], [w * 0.92, h * 0.55], [w * 0.6, h * 0.78], [w * 0.22, h * 0.9], [0.001, h * 0.94]], 12);
    leaves(b, M.leafPine, x, y + h * 0.45, z, w * 1.05, Math.round(h * 9), 0.5, rng(Math.round(x * 31 + z * 17)), h * 0.42 / (w * 1.05));
    return [x - 0.3, z - 0.3, x + 0.3, z + 0.3];
  },
  /* Haie taillée : volume plein habillé de feuilles sur le dessus et les arêtes. */
  hedge(b, M, x0, z0, x1, z1, { h = 1.5, y = 0 }) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), az = Math.min(z0, z1), bz = Math.max(z0, z1), R = rng(Math.round(ax * 13 + az * 29 + h * 7));
    b.cbox(M.hedge, (ax + bx) / 2, y, (az + bz) / 2, bx - ax, h, bz - az, 0.1);
    const along = bx - ax > bz - az, len = Math.max(bx - ax, bz - az), wid = Math.min(bx - ax, bz - az), n = Math.round(len / 0.34);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, px = along ? ax + len * t : (ax + bx) / 2, pz = along ? (az + bz) / 2 : az + len * t; leaves(b, M.leafBroad, px, y + h - 0.12, pz, Math.max(0.22, wid * 0.55), 9, 0.34, R, 0.5); }
    return [ax, az, bx, bz];
  },
  lavender(b, M, x0, z0, x1, z1, { y = 0, seed = 3 }) {
    const R = rng(seed * 17 + 1), len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.55));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      b.sph(M.hedge, x, y + 0.1, z, 0.22, 1, 0.7, 1, 8); leaves(b, M.leafOlive, x, y + 0.2, z, 0.26, 12, 0.24, R, 0.6);
      for (let k = 0; k < 14; k++) { const a = R() * 6.283, rr = R() * 0.24; b.geo(M.lavender, cone(0.02, 0.26, 5), x + Math.cos(a) * rr, y + 0.42, z + Math.sin(a) * rr, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
    }
  },
  /* Laurier-rose en fleurs. */
  oleander(b, M, x, z, { r = 0.9, y = 0, seed = 5 }) {
    const R = rng(seed * 29 + 3);
    b.sph(M.hedge, x, y + r * 0.6, z, r * 0.6, 1, 0.9, 1, 9);
    for (let i = 0; i < 6; i++) { const a = R() * 6.283, rr = R() * r * 0.5; leaves(b, M.leafBroad, x + Math.cos(a) * rr, y + r * (0.5 + R() * 0.5), z + Math.sin(a) * rr, r * 0.5, 16, 0.36, R, 0.9); }
    for (let i = 0; i < 46; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * r * 0.9, yy = y + r * (0.5 + R() * 0.8); b.sph(M.oleander, x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, 0.05, 1, 1, 1, 5); }
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
