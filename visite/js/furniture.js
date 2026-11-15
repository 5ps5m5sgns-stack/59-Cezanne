/* 59 Cézanne — visite 3D : mobilier et végétaux, modélisés à partir de volumes simples.
   Chaque fonction dessine dans le repère local courant du Batch : origine au centre de l'emprise, au sol,
   « face avant » tournée vers +z. Elle renvoie l'emprise [largeur, profondeur] servant aux collisions (ou null). */
import * as THREE from 'three';
import { rng } from 'v3d/geo';

const PI = Math.PI;
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const torus = (R, r) => new THREE.TorusGeometry(R, r, 8, 28);

export const F = {

  /* ── Séjour ─────────────────────────────────────────────────────────── */
  sofa(b, M, { w = 2.6, d = 1.0, mat = 'linen', chaise = null, cl = 1.9, cw = 1.2, pillows = ['sage', 'ochre'] }) {
    const m = M[mat], arm = 0.2, back = 0.24;
    b.cbox(m, 0, 0.1, 0, w, 0.3, d, 0.05);                               // assise basse
    b.cbox(m, 0, 0.36, -d / 2 + back / 2, w, 0.44, back, 0.08);          // dossier
    b.cbox(m, -w / 2 + arm / 2, 0.3, 0.02, arm, 0.34, d - 0.04, 0.07);   // accoudoirs
    b.cbox(m, w / 2 - arm / 2, 0.3, 0.02, arm, 0.34, d - 0.04, 0.07);
    const n = Math.max(2, Math.round((w - 2 * arm) / 0.85)), sw = (w - 2 * arm) / n;
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + arm + sw * (i + 0.5);
      b.cbox(m, cx, 0.38, 0.08, sw - 0.03, 0.14, d - back - 0.12, 0.06);        // coussins d'assise
      b.cbox(m, cx, 0.5, -d / 2 + back + 0.07, sw - 0.06, 0.34, 0.16, 0.07);     // coussins de dossier
    }
    if (chaise) {
      const s = chaise === 'R' ? 1 : -1, cx = s * (w / 2 - cw / 2);
      b.cbox(m, cx, 0.1, d / 2 + cl / 2 - 0.02, cw, 0.3, cl, 0.05);
      b.cbox(m, cx, 0.38, d / 2 + cl / 2 - 0.02, cw - 0.06, 0.14, cl - 0.06, 0.06);
    }
    pillows.forEach((p, i) => b.cbox(M[p], (i ? 1 : -1) * (w / 2 - arm - 0.3), 0.52, -d / 2 + back + 0.24, 0.42, 0.4, 0.14, 0.06, (i ? -1 : 1) * 0.25));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cbox(M.black, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), 0.04, 0.1, 0.04);
    return chaise ? [w, d, chaise === 'R' ? [w / 2 - cw, d / 2, w / 2, d / 2 + cl] : [-w / 2, d / 2, -w / 2 + cw, d / 2 + cl]] : [w, d];
  },
  armchair(b, M, { mat = 'cognac' }) {
    // fauteuil coque sur piètement fin
    b.cbox(M[mat], 0, 0.36, 0.02, 0.62, 0.1, 0.6, 0.045);
    b.geo(M[mat], new THREE.BoxGeometry(0.66, 0.5, 0.07), 0, 0.66, -0.3, -0.22, 0, 0);
    b.cbox(M[mat], -0.34, 0.4, 0.0, 0.06, 0.24, 0.52, 0.03); b.cbox(M[mat], 0.34, 0.4, 0.0, 0.06, 0.24, 0.52, 0.03);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.geo(M.black, new THREE.CylinderGeometry(0.014, 0.014, 0.38, 6), sx * 0.26, 0.19, sz * 0.24, sz * 0.12, 0, -sx * 0.12);
    return [0.74, 0.7];
  },
  coffeeRound(b, M, { r = 0.5, mat = 'marbleDark', h = 0.36 }) {
    b.cyl(M[mat], 0, h - 0.04, 0, r, 0.04, 40); b.cyl(M.black, 0, 0, 0, r * 0.32, h - 0.04, 18, r * 0.2);
    return [2 * r, 2 * r];
  },
  coffeeRect(b, M, { w = 1.2, d = 0.65, mat = 'oak' }) {
    b.cbox(M[mat], 0, 0.3, 0, w, 0.05, d, 0.012);
    for (const sx of [-1, 1]) b.cbox(M.black, sx * (w / 2 - 0.08), 0, 0, 0.03, 0.3, d - 0.16);
    return [w, d];
  },
  rug(b, M, { w = 3, d = 2, mat = 'rug' }) { b.cbox(M[mat], 0, 0, 0, w, 0.014, d, 0.006); return null; },
  /* Mur TV : panneautage bois, niche, écran, console suspendue. */
  tvWall(b, M, { w = 4.6, h = 2.45, tv = 1.6 }) {
    b.box(M.oak, -w / 2, 0, -0.0, w / 2, h, 0.05);
    const sw = Math.min(1.1, w * 0.24);
    b.box(M.walnut, -w / 2, 0, 0.05, -w / 2 + sw, h, 0.4);
    for (let i = 0; i < 4; i++) { const y = 0.55 + i * 0.47; b.box(M.black, -w / 2 + 0.07, y, 0.39, -w / 2 + sw - 0.07, y + 0.36, 0.405); b.box(M.led, -w / 2 + 0.09, y + 0.34, 0.4, -w / 2 + sw - 0.09, y + 0.352, 0.41); }
    const cx = sw / 2;
    b.box(M.screen, cx - tv / 2, 0.98, 0.05, cx + tv / 2, 0.98 + tv * 0.5625, 0.085);
    b.cbox(M.anthracite, cx, 0.28, 0.26, w - sw - 0.5, 0.34, 0.42, 0.01);
    b.box(M.led, cx - (w - sw - 0.5) / 2, 0.26, 0.06, cx + (w - sw - 0.5) / 2, 0.275, 0.4);
    b.light(cx, 0.2, 0.5, 0.5);
    return [w, 0.94];
  },
  sideboard(b, M, { w = 2.2, d = 0.45, h = 0.8, mat = 'anthracite', top = null }) {
    b.cbox(M[mat], 0, 0.08, 0, w, h - 0.08, d, 0.008);
    if (top) b.cbox(M[top], 0, h, 0, w + 0.02, 0.025, d + 0.02);
    const n = Math.max(2, Math.round(w / 0.55));
    for (let i = 1; i < n; i++) b.box(M.seam, -w / 2 + (w / n) * i - 0.005, 0.1, d / 2, -w / 2 + (w / n) * i + 0.005, h - 0.02, d / 2 + 0.005);
    b.box(M.black, -w / 2 + 0.06, 0, -d / 2 + 0.05, w / 2 - 0.06, 0.08, d / 2 - 0.05);
    return [w, d];
  },
  bookcase(b, M, { w = 2.4, h = 2.3, d = 0.34, mat = 'walnut' }) {
    b.box(M[mat], -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.02);
    const cols = Math.round(w / 0.8), rows = 5, R = rng(77 + Math.round(w * 10));
    for (let i = 0; i <= cols; i++) b.box(M[mat], -w / 2 + (w / cols) * i - 0.012, 0, -d / 2, -w / 2 + (w / cols) * i + 0.012, h, d / 2);
    for (let j = 0; j <= rows; j++) b.box(M[mat], -w / 2, (h / rows) * j - (j ? 0.024 : 0), -d / 2, w / 2, (h / rows) * j + (j ? 0 : 0.024), d / 2);
    const cols2 = ['cream', 'terra', 'charcoal', 'sage', 'linen', 'ochre', 'navy'];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (R() < 0.18) continue;
      let x = -w / 2 + (w / cols) * i + 0.03; const y = (h / rows) * j + 0.024, xe = -w / 2 + (w / cols) * (i + 1) - 0.03 - R() * 0.3;
      while (x < xe) { const t = 0.022 + R() * 0.03, bh = 0.2 + R() * 0.1; b.box(M[cols2[(R() * cols2.length) | 0]], x, y, -d / 2 + 0.05, x + t, y + bh, d / 2 - 0.04 - R() * 0.04); x += t + 0.002; }
    }
    return [w, d];
  },
  picture(b, M, { w = 0.9, h = 1.1, y = 1.55, mat = 'art1' }) {
    b.box(M.oak, -w / 2 - 0.02, y - h / 2 - 0.02, 0, w / 2 + 0.02, y + h / 2 + 0.02, 0.03);
    b.box(M[mat], -w / 2, y - h / 2, 0.03, w / 2, y + h / 2, 0.034);
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
  curtain(b, M, { w = 0.7, h = 2.45, mat = 'linen' }) {
    const n = Math.max(3, Math.round(w / 0.085));
    for (let i = 0; i < n; i++) b.cbox(M[mat], -w / 2 + (w / n) * (i + 0.5), 0.02, (i % 2) * 0.03, w / n + 0.012, h, 0.05, 0.022);
    b.box(M.black, -w / 2 - 0.05, h + 0.02, 0.0, w / 2 + 0.05, h + 0.04, 0.03);
    return null;
  },

  /* ── Repas ───────────────────────────────────────────────────────────── */
  chair(b, M, { mat = 'greige' }) {
    b.cbox(M[mat], 0, 0.42, 0, 0.5, 0.08, 0.5, 0.035);
    b.geo(M[mat], new THREE.BoxGeometry(0.5, 0.42, 0.06), 0, 0.68, -0.25, -0.14, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.geo(M.black, new THREE.CylinderGeometry(0.012, 0.016, 0.44, 6), sx * 0.2, 0.22, sz * 0.2, sz * 0.07, 0, -sx * 0.07);
    return null;
  },
  /* Table + chaises disposées autour ; n = nombre de chaises par grand côté, ends = chaises en bout. */
  diningTable(b, M, { w = 2.0, d = 1.0, top = 'marble', n = 3, ends = true, chairMat = 'greige', leg = 'black' }) {
    b.cbox(M[top], 0, 0.72, 0, w, 0.04, d, 0.012);
    b.cbox(M[leg], -w * 0.3, 0, 0, 0.08, 0.72, d * 0.62); b.cbox(M[leg], w * 0.3, 0, 0, 0.08, 0.72, d * 0.62);
    b.cbox(M[leg], 0, 0.64, 0, w * 0.6, 0.08, 0.06);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      b.push(x, 0, -d / 2 - 0.12, 0); F.chair(b, M, { mat: chairMat }); b.pop();
      b.push(x, 0, d / 2 + 0.12, PI); F.chair(b, M, { mat: chairMat }); b.pop();
    }
    if (ends) {
      b.push(-w / 2 - 0.14, 0, 0, PI / 2); F.chair(b, M, { mat: chairMat }); b.pop();
      b.push(w / 2 + 0.14, 0, 0, -PI / 2); F.chair(b, M, { mat: chairMat }); b.pop();
    }
    // centre de table
    b.cyl(M.pot, 0, 0.76, 0, 0.09, 0.2, 14, 0.06); b.sph(M.leafOlive, 0, 1.08, 0, 0.17, 1, 1.1, 1);
    return [w + 0.1, d + 0.5];
  },
  stool(b, M, { mat = 'greige', h = 0.66 }) {
    b.cbox(M[mat], 0, h, 0, 0.42, 0.07, 0.4, 0.03);
    b.geo(M[mat], new THREE.BoxGeometry(0.42, 0.22, 0.05), 0, h + 0.17, -0.19, -0.12, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.black, sx * 0.17, 0, sz * 0.16, 0.012, h, 6);
    b.box(M.black, -0.17, 0.25, 0.15, 0.17, 0.262, 0.17);
    return null;
  },

  /* ── Cuisine ─────────────────────────────────────────────────────────── */
  /* Linéaire bas : w le long de x, façades vers +z. options : sink / hob = abscisse du centre ; upper = meubles hauts. */
  kitchenRun(b, M, { w = 3, d = 0.63, front = 'navy', top = 'marble', sink = null, hob = null, upper = false, splash = false }) {
    b.box(M.black, -w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.1, d / 2 - 0.06);
    b.box(M[front], -w / 2, 0.1, -d / 2, w / 2, 0.87, d / 2 - 0.02);
    const n = Math.max(1, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w / n) * i + 0.004, x1 = -w / 2 + (w / n) * (i + 1) - 0.004;
      b.box(M[front], x0, 0.105, d / 2 - 0.02, x1, 0.865, d / 2);
      b.box(M.brass, x0 + 0.05, 0.8, d / 2, x1 - 0.05, 0.812, d / 2 + 0.012);
    }
    b.box(M[top], -w / 2 - 0.01, 0.87, -d / 2, w / 2 + 0.01, 0.91, d / 2 + 0.02);
    if (sink !== null) {
      b.box(M.steel, sink - 0.36, 0.905, -0.2, sink + 0.36, 0.912, 0.2); b.box(M.black, sink - 0.33, 0.9, -0.17, sink + 0.33, 0.914, 0.17);
      b.cyl(M.brass, sink, 0.91, -0.25, 0.016, 0.3, 8); b.geo(M.brass, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), sink, 1.2, -0.16, PI / 2, 0, 0);
    }
    if (hob !== null) F._hob(b, M, hob, 0.912, 0);
    if (splash) b.box(M[top], -w / 2, 0.91, -d / 2, w / 2, 1.5, -d / 2 + 0.02);
    if (upper) {
      b.box(M.oak, -w / 2, 1.5, -d / 2, w / 2, 2.3, -d / 2 + 0.36);
      for (let i = 1; i < n; i++) b.box(M.seam, -w / 2 + (w / n) * i - 0.005, 1.5, -d / 2 + 0.36, -w / 2 + (w / n) * i + 0.005, 2.3, -d / 2 + 0.363);
      b.box(M.led, -w / 2 + 0.03, 1.49, -d / 2 + 0.05, w / 2 - 0.03, 1.5, -d / 2 + 0.08);
      b.light(0, 1.42, -d / 2 + 0.2, 0.6);
    }
    return [w, d];
  },
  _hob(b, M, x, y, z) {
    b.box(M.screen, x - 0.3, y, z - 0.26, x + 0.3, y + 0.008, z + 0.26);
    for (const [dx, dz] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) b.geo(M.steel, torus(0.075, 0.004), x + dx, y + 0.009, z + dz, PI / 2, 0, 0);
  },
  /* Colonnes hautes : réfrigérateur intégré et fours. */
  kitchenTall(b, M, { w = 1.8, d = 0.63, h = 2.25, front = 'oak' }) {
    b.box(M[front], -w / 2, 0.1, -d / 2, w / 2, h, d / 2); b.box(M.black, -w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.1, d / 2 - 0.06);
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 1; i < n; i++) b.box(M.seam, -w / 2 + (w / n) * i - 0.005, 0.1, d / 2, -w / 2 + (w / n) * i + 0.005, h, d / 2 + 0.005);
    const x0 = w / 2 - w / n + 0.03, x1 = w / 2 - 0.03;       // dernière colonne : fours
    b.box(M.screen, x0, 0.75, d / 2, x1, 1.3, d / 2 + 0.012); b.box(M.screen, x0, 1.36, d / 2, x1, 1.8, d / 2 + 0.012);
    b.box(M.steel, x0 + 0.04, 1.26, d / 2 + 0.012, x1 - 0.04, 1.275, d / 2 + 0.04); b.box(M.steel, x0 + 0.04, 1.76, d / 2 + 0.012, x1 - 0.04, 1.775, d / 2 + 0.04);
    for (let i = 0; i < n - 1; i++) b.box(M.brass, -w / 2 + (w / n) * (i + 1) - 0.05, 0.9, d / 2, -w / 2 + (w / n) * (i + 1) - 0.035, 1.5, d / 2 + 0.03);
    return [w, d];
  },
  /* Îlot : plan en pierre débordant côté tabourets (+z). */
  island(b, M, { w = 3.0, d = 1.1, front = 'navy', top = 'marble', hob = null, sink = null, stools = 0, stoolMat = 'cognac', over = 0.28 }) {
    const dz = -over / 2;
    b.box(M.black, -w / 2 + 0.04, 0, -d / 2 + 0.04, w / 2 - 0.04, 0.1, d / 2 - over - 0.04);
    b.box(M[front], -w / 2, 0.1, -d / 2, w / 2, 0.87, d / 2 - over);
    const n = Math.max(1, Math.round(w / 0.6));
    for (let i = 1; i < n; i++) b.box(M.seam, -w / 2 + (w / n) * i - 0.005, 0.1, -d / 2 - 0.005, -w / 2 + (w / n) * i + 0.005, 0.87, -d / 2);
    b.cbox(M[top], 0, 0.87, 0, w + 0.06, 0.05, d + 0.04, 0.006);
    b.box(M[top], -w / 2 - 0.03, 0, d / 2 - 0.03, -w / 2 + 0.02, 0.87, d / 2 + 0.02); b.box(M[top], w / 2 - 0.02, 0, d / 2 - 0.03, w / 2 + 0.03, 0.87, d / 2 + 0.02);
    if (hob !== null) F._hob(b, M, hob, 0.921, dz);
    if (sink !== null) { b.box(M.black, sink - 0.3, 0.915, dz - 0.17, sink + 0.3, 0.923, dz + 0.17); b.cyl(M.brass, sink, 0.92, dz - 0.24, 0.016, 0.3, 8); }
    for (let i = 0; i < stools; i++) { b.push(-w / 2 + (w / stools) * (i + 0.5), 0, d / 2 + 0.1, PI); F.stool(b, M, { mat: stoolMat }); b.pop(); }
    return [w + 0.06, d + 0.04];
  },
  barTable(b, M, { w = 1.6, d = 0.9, top = 'oak', stools = 2, stoolMat = 'greige' }) {
    b.cbox(M[top], 0, 0.86, 0, w, 0.05, d, 0.03);
    b.cbox(M.black, -w / 2 + 0.12, 0, 0, 0.06, 0.86, d - 0.3); b.cbox(M.black, w / 2 - 0.12, 0, 0, 0.06, 0.86, d - 0.3);
    for (let i = 0; i < stools; i++) {
      const x = -w / 2 + (w / stools) * (i + 0.5);
      b.push(x, 0, -d / 2 - 0.08, 0); F.stool(b, M, { mat: stoolMat }); b.pop();
      b.push(x, 0, d / 2 + 0.08, PI); F.stool(b, M, { mat: stoolMat }); b.pop();
    }
    b.cyl(M.pot, w * 0.3, 0.91, 0, 0.06, 0.16, 12, 0.045); b.sph(M.leafOlive, w * 0.3, 1.2, 0, 0.14, 1, 1.2, 1);
    return [w, d + 0.3];
  },

  /* ── Chambres ────────────────────────────────────────────────────────── */
  /* Lit : tête côté -z, pied vers +z. */
  bed(b, M, { w = 1.6, l = 2.0, linen = 'cream', throwMat = 'greige', head = 'greige', hw = 0.5, nights = true }) {
    b.cbox(M[head], 0, 0, -l / 2 - 0.05, w + hw, 1.15, 0.1, 0.04);
    b.cbox(M[head], 0, 0.06, 0, w + 0.08, 0.26, l + 0.06, 0.03);
    b.cbox(M.cream, 0, 0.32, 0.0, w, 0.2, l, 0.07);
    b.cbox(M[linen], 0, 0.44, l * 0.17, w + 0.05, 0.12, l * 0.66, 0.055);
    b.cbox(M[throwMat], 0, 0.5, l * 0.36, w + 0.09, 0.075, l * 0.26, 0.035);
    for (const sx of [-1, 1]) { b.cbox(M.white, sx * w * 0.24, 0.5, -l / 2 + 0.3, w * 0.42, 0.14, 0.44, 0.06); b.cbox(M[throwMat], sx * w * 0.24, 0.58, -l / 2 + 0.5, w * 0.3, 0.12, 0.3, 0.055, sx * 0.1); }
    if (nights) for (const sx of [-1, 1]) {
      const x = sx * (w / 2 + 0.3);
      b.cbox(M.walnut, x, 0.16, -l / 2 + 0.24, 0.46, 0.3, 0.4, 0.012);
      b.cyl(M.brass, x, 0.46, -l / 2 + 0.2, 0.05, 0.02, 12); b.cyl(M.brass, x, 0.48, -l / 2 + 0.2, 0.008, 0.2, 6);
      b.cyl(M.lampShade, x, 0.66, -l / 2 + 0.2, 0.085, 0.14, 16, 0.065); b.light(x, 0.8, -l / 2 + 0.24, 0.45);
    }
    return [w + 0.1, l + 0.16];
  },
  wardrobe(b, M, { w = 2.2, d = 0.6, h = 2.35, mat = 'oak' }) {
    b.box(M[mat], -w / 2, 0.06, -d / 2, w / 2, h, d / 2 - 0.02); b.box(M.black, -w / 2 + 0.02, 0, -d / 2 + 0.02, w / 2 - 0.02, 0.06, d / 2 - 0.05);
    const n = Math.max(2, Math.round(w / 0.52));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w / n) * i + 0.003, x1 = -w / 2 + (w / n) * (i + 1) - 0.003;
      b.box(M[mat], x0, 0.065, d / 2 - 0.02, x1, h - 0.005, d / 2);
      const hx = i % 2 ? x0 + 0.035 : x1 - 0.047;
      b.box(M.brass, hx, 0.95, d / 2, hx + 0.012, 1.3, d / 2 + 0.025);
    }
    return [w, d];
  },
  dresser(b, M, { w = 1.9, d = 0.45, h = 0.72, mat = 'walnut', tv = true }) {
    b.cbox(M[mat], 0, 0.1, 0, w, h - 0.1, d, 0.008);
    for (let i = 1; i < 4; i++) b.box(M.seam, -w / 2 + (w / 4) * i - 0.005, 0.12, d / 2, -w / 2 + (w / 4) * i + 0.005, h - 0.02, d / 2 + 0.005);
    b.box(M.black, -w / 2, h * 0.52, d / 2, w / 2, h * 0.52 + 0.005, d / 2 + 0.003);
    for (const sx of [-1, 1]) b.cbox(M.black, sx * (w / 2 - 0.1), 0, 0, 0.04, 0.1, d - 0.1);
    if (tv) { b.box(M.screen, -0.6, h + 0.08, -0.04, 0.6, h + 0.76, -0.01); b.box(M.black, -0.18, h, -0.1, 0.18, h + 0.02, 0.06); b.box(M.black, -0.03, h, -0.05, 0.03, h + 0.1, -0.02); }
    return [w, d];
  },
  desk(b, M, { w = 1.6, d = 0.65, top = 'marbleDark', leg = 'black', chair = 'cream', lamp = true }) {
    b.cbox(M[top], 0, 0.72, 0, w, 0.035, d, 0.006);
    for (const sx of [-1, 1]) { b.cbox(M[leg], sx * (w / 2 - 0.06), 0, 0, 0.03, 0.72, d - 0.1); }
    b.cbox(M[leg], 0, 0.6, -d / 2 + 0.1, w - 0.14, 0.1, 0.02);
    b.box(M.steel, -0.17, 0.757, -0.11, 0.17, 0.765, 0.12); b.geo(M.screen, new THREE.BoxGeometry(0.34, 0.22, 0.008), 0, 0.875, -0.14, -0.22, 0, 0);
    if (lamp) { b.cyl(M.black, w * 0.36, 0.755, -d * 0.2, 0.06, 0.012, 12); b.cyl(M.black, w * 0.36, 0.76, -d * 0.2, 0.007, 0.34, 6); b.cyl(M.lampShade, w * 0.36, 1.08, -d * 0.2, 0.09, 0.1, 14, 0.05); b.light(w * 0.36, 1.05, -d * 0.1, 0.4); }
    if (chair) { b.push(0, 0, d / 2 + 0.22, PI); F.officeChair(b, M, { mat: chair }); b.pop(); }
    return [w, d + (chair ? 0.3 : 0)];
  },
  officeChair(b, M, { mat = 'cream' }) {
    b.cbox(M[mat], 0, 0.42, 0, 0.5, 0.09, 0.5, 0.04); b.geo(M[mat], new THREE.BoxGeometry(0.48, 0.46, 0.07), 0, 0.72, -0.24, -0.16, 0, 0);
    b.cyl(M.steel, 0, 0.06, 0, 0.022, 0.36, 8);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 2 * PI; b.geo(M.steel, new THREE.BoxGeometry(0.3, 0.025, 0.035), Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15, 0, -a, 0); }
    return null;
  },
  vanityTable(b, M, { w = 1.3, d = 0.42 }) {
    b.cbox(M.marbleDark, 0, 0.72, 0, w, 0.03, d, 0.006);
    for (const sx of [-1, 1]) b.cbox(M.brass, sx * (w / 2 - 0.05), 0, 0, 0.025, 0.72, d - 0.08);
    b.cyl(M.brass, w * 0.25, 0.75, -0.05, 0.05, 0.012, 12); b.geo(M.mirror, new THREE.CylinderGeometry(0.17, 0.17, 0.012, 28), w * 0.25, 1.0, -0.05, PI / 2, 0, 0);
    b.push(0, 0, d / 2 + 0.2, PI); F.pouf(b, M, { mat: 'cream' }); b.pop();
    return [w, d + 0.2];
  },
  pouf(b, M, { mat = 'cream', r = 0.24 }) { b.sph(M[mat], 0, 0.22, 0, r, 1, 0.9, 1); return null; },
  bench(b, M, { w = 1.4, d = 0.42, mat = 'greige' }) {
    b.cbox(M[mat], 0, 0.3, 0, w, 0.14, d, 0.05);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.brass, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.07), 0.014, 0.3, 6);
    return [w, d];
  },

  /* ── Pièces d'eau ────────────────────────────────────────────────────── */
  bathtub(b, M, { w = 0.82, l = 1.78, free = false }) {
    if (free) {
      b.sph(M.ceramic, 0, 0.33, 0, 0.5, w / 1.0, 0.62, l / 1.0, 22); b.sph(M.tubIn, 0, 0.62, 0, 0.5, (w - 0.12), 0.06, (l - 0.14), 22);
      b.cyl(M.brass, w / 2 + 0.08, 0, -l * 0.18, 0.018, 0.95, 8); b.geo(M.brass, new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), w / 2 - 0.04, 0.95, -l * 0.18, 0, 0, PI / 2);
      return [w + 0.2, l];
    }
    b.cbox(M.ceramic, 0, 0, 0, w, 0.58, l, 0.03);
    b.cbox(M.tubIn, 0, 0.5, 0, w - 0.14, 0.085, l - 0.16, 0.04);
    b.cyl(M.brass, w * 0.25, 0.58, -l / 2 + 0.1, 0.016, 0.16, 8); b.geo(M.brass, new THREE.CylinderGeometry(0.013, 0.013, 0.16, 8), w * 0.25, 0.72, -l / 2 + 0.17, PI / 2, 0, 0);
    return [w, l];
  },
  /* Meuble vasque suspendu, miroir rétro-éclairé au mur (-z). */
  vanity(b, M, { w = 1.5, d = 0.5, double = true, mat = 'oak', mirrorH = 0.95 }) {
    b.cbox(M[mat], 0, 0.36, 0, w, 0.46, d, 0.006);
    b.box(M.black, -w / 2, 0.585, d / 2, w / 2, 0.59, d / 2 + 0.003);
    b.box(M.marble, -w / 2 - 0.01, 0.82, -d / 2, w / 2 + 0.01, 0.85, d / 2 + 0.01);
    const xs = double ? [-w * 0.25, w * 0.25] : [0];
    for (const x of xs) {
      b.cbox(M.ceramic, x, 0.85, 0.02, 0.44, 0.11, 0.32, 0.045); b.cbox(M.tubIn, x, 0.93, 0.02, 0.36, 0.035, 0.24, 0.015);
      b.cyl(M.brass, x, 0.85, -d / 2 + 0.07, 0.014, 0.26, 8); b.geo(M.brass, new THREE.CylinderGeometry(0.011, 0.011, 0.14, 8), x, 1.1, -d / 2 + 0.13, PI / 2, 0, 0);
    }
    b.box(M.led, -w / 2 + 0.03, 1.1, -d / 2, w / 2 - 0.03, 1.1 + mirrorH + 0.06, -d / 2 + 0.012);
    b.box(M.mirror, -w / 2 + 0.06, 1.13, -d / 2 + 0.012, w / 2 - 0.06, 1.1 + mirrorH + 0.03, -d / 2 + 0.02);
    b.light(0, 1.6, 0.1, 0.7);
    return [w, d];
  },
  toilet(b, M, { }) {
    b.cbox(M.ceramic, 0, 0.14, 0.02, 0.37, 0.27, 0.54, 0.09); b.cbox(M.white, 0, 0.41, 0.03, 0.37, 0.025, 0.5, 0.01);
    b.box(M.wallTile, -0.45, 0, -0.33, 0.45, 1.15, -0.25); b.box(M.steel, -0.12, 0.92, -0.25, 0.12, 1.07, -0.243);
    return [0.5, 0.62];
  },
  basin(b, M, { w = 0.45 }) {
    b.cbox(M.oak, 0, 0.5, 0, w, 0.32, 0.26, 0.006); b.cbox(M.ceramic, 0, 0.82, 0, w - 0.04, 0.08, 0.24, 0.03);
    b.cyl(M.brass, w * 0.3, 0.9, -0.05, 0.012, 0.16, 8);
    b.box(M.mirror, -w / 2, 1.15, -0.13, w / 2, 1.85, -0.122);
    return [w, 0.3];
  },
  /* Douche à l'italienne : receveur carrelé, paroi(s) vitrée(s), ciel de pluie. glass = côtés fermés par une paroi. */
  shower(b, M, { w = 1.2, d = 0.95, glass = ['front'] }) {
    b.box(M.wallTile, -w / 2, 0.0, -d / 2, w / 2, 0.012, d / 2);
    b.box(M.wallTile, -w / 2, 0, -d / 2, w / 2, 2.2, -d / 2 + 0.015);
    for (const g of glass) {
      if (g === 'front') { b.box(M.glass, -w / 2, 0.01, d / 2 - 0.012, w / 2 - 0.55, 2.05, d / 2); b.box(M.brass, -w / 2, 2.05, d / 2 - 0.014, w / 2, 2.07, d / 2 + 0.002); }
      if (g === 'left') b.box(M.glass, -w / 2, 0.01, -d / 2, -w / 2 + 0.012, 2.05, d / 2);
      if (g === 'right') b.box(M.glass, w / 2 - 0.012, 0.01, -d / 2, w / 2, 2.05, d / 2);
    }
    b.cyl(M.brass, 0, 1.05, -d / 2 + 0.03, 0.012, 1.1, 8); b.geo(M.brass, new THREE.CylinderGeometry(0.01, 0.01, 0.34, 8), 0, 2.15, -d / 2 + 0.2, PI / 2, 0, 0);
    b.cyl(M.brass, 0, 2.11, -d / 2 + 0.37, 0.13, 0.014, 20);
    return null;
  },
  towelRail(b, M, { w = 0.5, h = 1.2 }) {
    for (const sx of [-1, 1]) b.cyl(M.steel, sx * w / 2, 0.6, 0.04, 0.012, h, 6);
    for (let i = 0; i < 9; i++) b.geo(M.steel, new THREE.CylinderGeometry(0.009, 0.009, w, 6), 0, 0.68 + i * (h - 0.16) / 8, 0.04, 0, 0, PI / 2);
    b.cbox(M.cream, 0, 1.2, 0.07, w - 0.08, 0.5, 0.03, 0.012);
    return null;
  },
  washer(b, M, { n = 2 }) {
    for (let i = 0; i < n; i++) {
      const x = -(n * 0.6) / 2 + 0.3 + i * 0.6;
      b.cbox(M.white, x, 0.02, 0, 0.595, 0.84, 0.58, 0.012); b.geo(M.screen, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), x, 0.42, 0.295, PI / 2, 0, 0);
      b.geo(M.steel, torus(0.18, 0.012), x, 0.42, 0.3, 0, 0, 0);
    }
    b.box(M.oak, -(n * 0.6) / 2 - 0.01, 0.87, -0.31, (n * 0.6) / 2 + 0.01, 0.9, 0.31);
    return [n * 0.6, 0.62];
  },
  shelves(b, M, { w = 1.2, d = 0.4, h = 2.0, mat = 'oak' }) {
    for (let i = 0; i < 5; i++) b.box(M[mat], -w / 2, 0.1 + i * (h - 0.1) / 4 - 0.02, -d / 2, w / 2, 0.1 + i * (h - 0.1) / 4, d / 2);
    for (const sx of [-1, 1]) b.box(M.black, sx * w / 2 - 0.012, 0, -d / 2, sx * w / 2 + 0.012, h, d / 2);
    const R = rng(91);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) if (R() < 0.75) b.cbox(M[['cream', 'linen', 'rattan', 'pot'][(R() * 4) | 0]], -w / 2 + 0.22 + k * (w - 0.44) / 2, 0.1 + i * (h - 0.1) / 4, 0, 0.3, 0.2 + R() * 0.12, d - 0.1, 0.02);
    return [w, d];
  },

  /* ── Décor et luminaires ─────────────────────────────────────────────── */
  plant(b, M, { h = 1.6, kind = 'olive', pot = 0.24 }) {
    b.cyl(M.pot, 0, 0, 0, pot * 0.72, pot * 1.5, 18, pot);
    b.cyl(M.bark, 0, pot * 1.4, 0, 0.02, h * 0.5, 6, 0.014);
    const R = rng(Math.round(h * 100) + (kind === 'olive' ? 3 : 9)), m = kind === 'olive' ? M.leafOlive : M.leafPine;
    for (let i = 0; i < 7; i++) b.sph(m, (R() - 0.5) * 0.5, h * (0.62 + R() * 0.36), (R() - 0.5) * 0.5, 0.2 + R() * 0.16, 1, 0.85, 1, 9);
    return [pot * 2, pot * 2];
  },
  pampas(b, M, { h = 1.5 }) {
    b.cyl(M.pot, 0, 0, 0, 0.1, 0.5, 14, 0.13);
    const R = rng(5);
    for (let i = 0; i < 9; i++) b.geo(M.rattan, cone(0.03, h - 0.5, 5), (R() - 0.5) * 0.3, 0.5 + (h - 0.5) / 2, (R() - 0.5) * 0.3, (R() - 0.5) * 0.35, 0, (R() - 0.5) * 0.35);
    return [0.3, 0.3];
  },
  floorLamp(b, M, { h = 1.65 }) {
    b.cyl(M.brass, 0, 0, 0, 0.15, 0.02, 20); b.cyl(M.brass, 0, 0.02, 0, 0.012, h - 0.3, 8);
    b.cyl(M.lampShade, 0, h - 0.34, 0, 0.21, 0.32, 24, 0.17); b.light(0, h - 0.1, 0, 0.9);
    return [0.3, 0.3];
  },
  tableLamp(b, M, { y = 0.8 }) {
    b.sph(M.pot, 0, y + 0.1, 0, 0.09, 1, 1.15, 1); b.cyl(M.lampShade, 0, y + 0.24, 0, 0.14, 0.18, 20, 0.1); b.light(0, y + 0.45, 0, 0.6);
    return null;
  },
  /* Suspension : `drop` = hauteur sous plafond du luminaire ; kind = 'globe' | 'ring' | 'cone'. */
  pendant(b, M, { ceil = 2.6, drop = 0.9, kind = 'globe', n = 1, span = 0.6 }) {
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? -span * (n - 1) / 2 + i * span : 0, y = ceil - drop - (i % 2) * 0.12;
      b.cyl(M.black, x, y, 0, 0.004, ceil - y, 4);
      if (kind === 'globe') b.sph(M.lampShade, x, y, 0, 0.14, 1, 1, 1, 18);
      else if (kind === 'cone') { b.cyl(M.brass, x, y - 0.2, 0, 0.11, 0.22, 18, 0.03); b.cyl(M.led, x, y - 0.2, 0, 0.1, 0.01, 18); }
      else { b.geo(M.brass, torus(0.34, 0.012), x, y, 0, PI / 2, 0, 0); b.geo(M.led, torus(0.34, 0.008), x, y - 0.012, 0, PI / 2, 0, 0); }
      b.light(x, y - 0.25, 0, 1.0 / Math.sqrt(n));
    }
    return null;
  },

  /* ── Extérieur ───────────────────────────────────────────────────────── */
  lounger(b, M, { }) {
    b.cbox(M.oak, 0, 0.16, 0, 0.72, 0.06, 1.95, 0.01);
    for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) b.cbox(M.oak, sx * 0.3, 0, sz, 0.05, 0.16, 0.05);
    b.cbox(M.cream, 0, 0.22, 0.3, 0.66, 0.09, 1.28, 0.04);
    b.geo(M.cream, new THREE.BoxGeometry(0.66, 0.09, 0.7), 0, 0.42, -0.62, 0.5, 0, 0);
    return [0.75, 1.95];
  },
  sideTable(b, M, { r = 0.22, h = 0.42, mat = 'oak' }) { b.cyl(M[mat], 0, h - 0.03, 0, r, 0.03, 18); b.cyl(M.black, 0, 0, 0, r * 0.25, h - 0.03, 10); return [2 * r, 2 * r]; },
  outdoorSofa(b, M, { w = 2.1, d = 0.9 }) {
    b.cbox(M.rattan, 0, 0.08, 0, w, 0.22, d, 0.03); b.cbox(M.cream, 0, 0.3, 0.04, w - 0.1, 0.14, d - 0.14, 0.06);
    b.cbox(M.rattan, 0, 0.3, -d / 2 + 0.06, w, 0.38, 0.1, 0.03); b.cbox(M.cream, 0, 0.42, -d / 2 + 0.2, w - 0.16, 0.3, 0.16, 0.07);
    for (const sx of [-1, 1]) b.cbox(M.rattan, sx * (w / 2 - 0.05), 0.3, 0, 0.1, 0.24, d, 0.03);
    return [w, d];
  },
  outdoorTable(b, M, { w = 2.4, d = 1.0, n = 4, ends = false }) {
    b.cbox(M.anthracite, 0, 0.72, 0, w, 0.035, d, 0.01);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cbox(M.anthracite, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), 0.06, 0.72, 0.06);
    const ch = (x, z, r) => { b.push(x, 0, z, r); b.cbox(M.rattan, 0, 0.1, 0, 0.58, 0.3, 0.58, 0.03); b.cbox(M.charcoal, 0, 0.4, 0.02, 0.5, 0.08, 0.5, 0.03); b.cbox(M.rattan, 0, 0.4, -0.25, 0.58, 0.36, 0.08, 0.03); b.pop(); };
    for (let i = 0; i < n; i++) { const x = -w / 2 + (w / n) * (i + 0.5); ch(x, -d / 2 - 0.22, 0); ch(x, d / 2 + 0.22, PI); }
    if (ends) { ch(-w / 2 - 0.26, 0, PI / 2); ch(w / 2 + 0.26, 0, -PI / 2); }
    return [w + 0.3, d + 0.9];
  },
  parasol(b, M, { r = 1.5, h = 2.5 }) {
    b.cyl(M.oak, 0, 0, 0, 0.03, h, 8); b.cyl(M.concrete, 0, 0, 0, 0.3, 0.07, 16);
    b.geo(M.cream, cone(r * 1.25, 0.5, 4), 0, h - 0.2, 0, 0, PI / 4, 0);
    return [0.5, 0.5];
  },
  planter(b, M, { w = 1.2, d = 0.4, h = 0.5, plant = 'lavender' }) {
    b.cbox(M.concrete, 0, 0, 0, w, h, d, 0.02);
    const R = rng(Math.round(w * 37));
    for (let x = -w / 2 + 0.16; x < w / 2 - 0.1; x += 0.24) { b.sph(M.leafOlive, x, h + 0.1, 0, 0.16, 1, 0.9, 1, 8); if (plant === 'lavender') for (let i = 0; i < 5; i++) b.geo(M.lavender, cone(0.022, 0.22, 5), x + (R() - 0.5) * 0.2, h + 0.3, (R() - 0.5) * 0.2, (R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4); }
    return [w, d];
  },
};

/* ── Végétaux de pleine terre (dessinés en coordonnées de plan, sans emprise de collision, sauf le tronc) ── */
export const V = {
  tree(b, M, x, z, { kind = 'pine', h = 7, r = 2.6, seed = 1, y = 0 }) {
    const R = rng(seed * 131 + 7);
    const lean = (R() - 0.5) * 0.14, th = h * (kind === 'pine' ? 0.66 : 0.42);
    b.geo(M.bark, new THREE.CylinderGeometry(0.1 + r * 0.02, 0.16 + r * 0.035, th, 9), x + lean * th * 0.5, y + th / 2, z, 0, 0, -lean);
    const m = kind === 'olive' ? M.leafOlive : M.leafPine, n = kind === 'pine' ? 11 : 9;
    const cx = x + lean * th, cy = y + th + (kind === 'pine' ? r * 0.12 : r * 0.35);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.283, rr = Math.sqrt(R()) * r * 0.72, s = r * (0.34 + R() * 0.3);
      b.sph(m, cx + Math.cos(a) * rr, cy + (R() - 0.5) * r * (kind === 'pine' ? 0.28 : 0.7), z + Math.sin(a) * rr, s, 1, kind === 'pine' ? 0.55 : 0.85, 1, 10);
    }
    if (kind === 'pine') for (let i = 0; i < 3; i++) { const a = R() * 6.283; b.geo(M.bark, new THREE.CylinderGeometry(0.04, 0.07, r * 0.9, 6), cx + Math.cos(a) * r * 0.3, cy - r * 0.2, z + Math.sin(a) * r * 0.3, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
    return [x - 0.25, z - 0.25, x + 0.25, z + 0.25];
  },
  cypress(b, M, x, z, { h = 6, y = 0 }) {
    b.cyl(M.bark, x, y, z, 0.07, h * 0.12, 6);
    b.sph(M.leafCypress, x, y + h * 0.52, z, 0.5, 0.9 + h * 0.03, h * 0.96, 0.9 + h * 0.03, 10);
    return [x - 0.3, z - 0.3, x + 0.3, z + 0.3];
  },
  hedge(b, M, x0, z0, x1, z1, { h = 1.5, y = 0 }) { b.cbox(M.hedge, (x0 + x1) / 2, y, (z0 + z1) / 2, Math.abs(x1 - x0), h, Math.abs(z1 - z0), 0.12); return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]; },
  lavender(b, M, x0, z0, x1, z1, { y = 0, seed = 3 }) {
    const R = rng(seed * 17 + 1), len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.55));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      b.sph(M.leafOlive, x, y + 0.14, z, 0.26, 1, 0.7, 1, 8);
      for (let k = 0; k < 12; k++) { const a = R() * 6.283, rr = R() * 0.22; b.geo(M.lavender, cone(0.022, 0.26, 5), x + Math.cos(a) * rr, y + 0.4, z + Math.sin(a) * rr, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
    }
  },
  oleander(b, M, x, z, { r = 0.9, y = 0, seed = 5 }) {
    const R = rng(seed * 29 + 3);
    for (let i = 0; i < 7; i++) { const a = R() * 6.283, rr = R() * r * 0.55; b.sph(M.leafPine, x + Math.cos(a) * rr, y + r * (0.45 + R() * 0.5), z + Math.sin(a) * rr, r * (0.36 + R() * 0.22), 1, 1, 1, 8); }
    for (let i = 0; i < 46; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * r * 0.9, yy = y + r * (0.5 + R() * 0.75); b.sph(M.oleander, x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, 0.055, 1, 1, 1, 5); }
    return [x - r * 0.6, z - r * 0.6, x + r * 0.6, z + r * 0.6];
  },
  palm(b, M, x, z, { r = 1.1, y = 0 }) {
    b.cyl(M.bark, x, y, z, 0.12, 0.45, 8);
    for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.283 + (i % 2) * 0.2, tilt = 0.5 + (i % 3) * 0.28; b.geo(M.leafPine, cone(0.055, r, 4), x + Math.cos(a) * Math.sin(tilt) * r * 0.5, y + 0.45 + Math.cos(tilt) * r * 0.5, z + Math.sin(a) * Math.sin(tilt) * r * 0.5, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt); }
    return [x - 0.3, z - 0.3, x + 0.3, z + 0.3];
  },
};
