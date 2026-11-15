/* 59 Cézanne — visite 3D : construction de l'architecture à partir des données de plan (plans.js).
   Murs orthogonaux avec ouvertures, menuiseries, garde-corps, volets lattés, escalier, ascenseur, sols et plafonds.
   Les murs sont découpés à CUT mètres : la partie basse reste visible en vue « maquette », la partie haute
   et les plafonds partent dans le calque « :top », masqué quand on regarde le logement de dessus. */
import * as THREE from 'three';
import { F } from 'v3d/furniture';

export const CUT = 1.25;
const PI = Math.PI;

/* Garde-corps à barreaudage vertical entre deux points du plan. */
export function railing(b, M, x0, z0, x1, z1, y = 0, h = 1.02, mat = 'frame') {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0);
  b.push(x0, y, z0, ang);
  b.box(M[mat], 0, h - 0.045, -0.025, len, h, 0.025);
  b.box(M[mat], 0, 0.08, -0.012, len, 0.105, 0.012);
  const n = Math.max(1, Math.round(len / 0.11));
  for (let i = 0; i <= n; i++) { const x = (len / n) * i; b.box(M[mat], x - 0.007, 0.08, -0.007, x + 0.007, h - 0.04, 0.007); }
  for (let i = 0, k = Math.max(1, Math.round(len / 1.4)); i <= k; i++) { const x = (len / k) * i; b.box(M[mat], x - 0.02, 0, -0.02, x + 0.02, h, 0.02); }
  b.pop();
}

/* Panneau de volet coulissant à lames verticales (cadre + lattes bois), posé en façade. */
function shutter(b, M, x0, x1, y0, y1, z) {
  b.box(M.frame, x0, y0, z, x1, y0 + 0.04, z + 0.045); b.box(M.frame, x0, y1 - 0.04, z, x1, y1, z + 0.045);
  b.box(M.frame, x0, y0, z, x0 + 0.04, y1, z + 0.045); b.box(M.frame, x1 - 0.04, y0, z, x1, y1, z + 0.045);
  for (let x = x0 + 0.06; x < x1 - 0.06; x += 0.062) b.box(M.slat, x, y0 + 0.04, z + 0.006, x + 0.036, y1 - 0.04, z + 0.04);
}

/* Vitrage : cadre périphérique + montants + verre, dans le plan z = 0 (repère local du mur, +z vers l'extérieur). */
function glazing(b, M, x0, x1, y0, y1, n = 1, z = 0, fr = 0.05) {
  b.box(M.frame, x0, y0, z - 0.035, x1, y0 + fr, z + 0.035); b.box(M.frame, x0, y1 - fr, z - 0.035, x1, y1, z + 0.035);
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) / n) * i, a = i === 0 ? 0 : i === n ? -fr : -fr / 2; b.box(M.frame, x + a, y0, z - 0.035, x + a + fr, y1, z + 0.035); }
  b.box(M.glass, x0 + fr, y0 + fr, z - 0.008, x1 - fr, y1 - fr, z + 0.008);
}

const JOINERY = {
  door(b, M, L, w, t, o, lv) {
    const H = o.head, s = L.s, hx = (o.hinge === 'a1' ? 1 : -1) * s * (w / 2 - 0.045), sw = (o.swing || 1) * L.z, ang = THREE.MathUtils.degToRad(o.open === undefined ? 86 : o.open);
    b.box(M.door, -w / 2, 0, -t / 2 - 0.012, -w / 2 + 0.045, H, t / 2 + 0.012); b.box(M.door, w / 2 - 0.045, 0, -t / 2 - 0.012, w / 2, H, t / 2 + 0.012);
    b.box(M.door, -w / 2, H - 0.045, -t / 2 - 0.012, w / 2, H, t / 2 + 0.012);
    const dir = hx < 0 ? 1 : -1, lw = w - 0.1;
    b.push(hx, 0, sw * (t / 2), dir * -ang * sw);
    b.box(M.door, 0, 0.008, -0.02, dir * lw, H - 0.05, 0.02);
    b.box(M.brass, dir * (lw - 0.13), 1.0, -0.05, dir * (lw - 0.03), 1.02, 0.05);
    b.pop();
  },
  entry(b, M, L, w, t, o) {
    const H = o.head;
    b.box(M.frame, -w / 2, 0, -t / 2, -w / 2 + 0.06, H, t / 2 - 0.1); b.box(M.frame, w / 2 - 0.06, 0, -t / 2, w / 2, H, t / 2 - 0.1); b.box(M.frame, -w / 2, H - 0.06, -t / 2, w / 2, H, t / 2 - 0.1);
    b.box(M.walnut, -w / 2 + 0.06, 0.005, -t / 2 + 0.03, w / 2 - 0.06, H - 0.06, -t / 2 + 0.09);
    for (let i = 1; i < 6; i++) b.box(M.black, -w / 2 + 0.06, (H / 6) * i, -t / 2 + 0.026, w / 2 - 0.06, (H / 6) * i + 0.006, -t / 2 + 0.03);
    b.box(M.brass, w / 2 - 0.2, 0.95, -t / 2 - 0.02, w / 2 - 0.17, 1.4, -t / 2 + 0.03);
  },
  french(b, M, L, w, t, o) {
    glazing(b, M, -w / 2, w / 2, o.sill, o.head, 2, t / 2 - 0.12);
    if (o.rail !== false) railing(b, M, -w / 2, t / 2 + 0.03, w / 2, t / 2 + 0.03, o.sill, 1.02);
    if (o.shutter) { const sd = (o.shutter === 'a1' ? 1 : -1) * L.s; shutter(b, M, sd > 0 ? w / 2 + 0.02 : -w / 2 - 0.02 - w, sd > 0 ? w / 2 + 0.02 + w : -w / 2 - 0.02, o.sill, o.head, t / 2 + 0.07); }
  },
  bay(b, M, L, w, t, o) {
    const n = o.panels || 3, pw = w / n, z = t / 2 - 0.13, y0 = o.sill, y1 = o.head;
    b.box(M.frame, -w / 2, y0, z - 0.07, w / 2, y0 + 0.03, z + 0.07); b.box(M.frame, -w / 2, y1 - 0.05, z - 0.07, w / 2, y1, z + 0.07);
    b.box(M.frame, -w / 2, y0, z - 0.07, -w / 2 + 0.05, y1, z + 0.07); b.box(M.frame, w / 2 - 0.05, y0, z - 0.07, w / 2, y1, z + 0.07);
    for (let i = 0; i < n; i++) {
      let x0 = -w / 2 + i * pw; const zz = z + (i % 2 ? 0.03 : -0.03);
      if (o.open && i === n - 1) x0 -= pw * 0.86;                 // dernier vantail glissé : la baie est ouverte
      glazing(b, M, x0 + 0.01, x0 + pw - 0.01, y0 + 0.03, y1 - 0.05, 1, zz, 0.045);
    }
    if (o.rail) railing(b, M, -w / 2, t / 2 + 0.03, w / 2, t / 2 + 0.03, o.sill, 1.02);
    if (o.shutter) { const sd = (o.shutter === 'a1' ? 1 : -1) * L.s, sw = Math.min(1.3, w / 2); shutter(b, M, sd > 0 ? w / 2 - sw : -w / 2, sd > 0 ? w / 2 : -w / 2 + sw, o.sill, o.head, t / 2 + 0.07); }
  },
  window(b, M, L, w, t, o) {
    glazing(b, M, -w / 2, w / 2, o.sill, o.head, w > 1 ? 2 : 1, t / 2 - 0.12);
    b.box(M.stucco, -w / 2 - 0.04, o.sill - 0.04, t / 2 - 0.1, w / 2 + 0.04, o.sill, t / 2 + 0.05);
    b.box(M.lacquer, -w / 2, o.sill - 0.02, -t / 2 - 0.02, w / 2, o.sill, t / 2 - 0.15);
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
    for (const z of [-t / 2 - 0.02, t / 2 + 0.008]) { b.box(M.steel, w / 2 + 0.12, 1.0, z, w / 2 + 0.2, 1.2, z + 0.012); b.box(M.led, w / 2 + 0.14, 1.11, z - 0.003, w / 2 + 0.18, 1.15, z + 0.015); b.box(M.screen, -0.14, H + 0.1, z, 0.14, H + 0.19, z + 0.012); }
  },
  pass() { },
};
const PASSABLE = (o) => o.kind === 'door' || o.kind === 'pass' || o.kind === 'liftdoor' || (o.kind === 'bay' && !o.rail) || (o.kind === 'french' && o.rail === false);

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
        const inner = w.c - zs * t / 2, mid = inner + zs * 0.1, outer = w.c + zs * t / 2;
        put(M[w.lining || 'plaster'], Math.min(inner, mid), Math.max(inner, mid)); put(M[w.skin || 'stucco'], Math.min(mid, outer), Math.max(mid, outer));
      } else put(M[w.mat || 'plaster'], w.c - t / 2, w.c + t / 2);
    };
    seg(L, ya, Math.min(yb, cut)); seg(top, Math.max(ya, cut), yb);
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
  const n = st.steps.length + 1, rise = st.H / n, y0 = lv0.y, c = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
  st.steps.forEach((r, i) => {
    const h = (i + 1) * rise, low = h <= CUT + 0.02;
    b.on(low ? lv0.layer : lv0.layer + ':top');
    b.box(M.plaster, r[0], y0 + (low ? 0 : h - rise - 0.1), r[1], r[2], y0 + h - 0.04, r[3]);
    b.box(M.oak, r[0] - 0.012, y0 + h - 0.04, r[1] - 0.012, r[2] + 0.012, y0 + h, r[3] + 0.012);
  });
  st.path = [[...st.foot, 0], [...st.trig0, 0], ...st.steps.map((r, i) => [...c(r), (i + 1) * rise]), [...st.trig1, st.H], [...st.head, st.H]];
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
    b.box(M.brass, x0 + 0.06, y + 0.9, y1 - 0.09, x1 - 0.06, y + 0.93, y1 - 0.06);
    b.box(M.screen, x1 - 0.03, y + 0.95, y0 + 0.25, x1 - 0.021, y + 1.2, y0 + 0.45);
    b.on(lv.layer + ':top');
    b.box(M.mirror, x0 + 0.12, y + CUT, y1 - 0.03, x1 - 0.12, y + 2.0, y1 - 0.021);
    b.box(M.steel, x0, y + hc, y0, x1, y + hc + 0.04, y1); b.box(M.liftLight, x0 + 0.2, y + hc - 0.012, y0 + 0.3, x1 - 0.2, y + hc, y1 - 0.3);
    b.on(lv.layer); b.light((x0 + x1) / 2, y + 1.9, (y0 + y1) / 2, 0.7);
    lv.dayLights.push({ pos: new THREE.Vector3((x0 + x1) / 2, y + 1.8, (y0 + y1) / 2), power: 1.5, layer: lv.layer });
  });
}

/* Un niveau complet. Renvoie les informations de navigation (obstacles, pièces). */
export function buildLevel(b, M, lv, index) {
  lv.layer = 'L' + index; lv.blocks = []; lv.dayLights = [];
  const y0 = lv.y;
  b.on(lv.layer);
  for (const [mat, x0, z0, x1, z1] of lv.floors) b.slab(M[mat], x0, z0, x1, z1, y0 + (mat === 'floor' ? 0 : 0.004), mat === 'floor' ? 0.03 : 0.012);
  for (const s of lv.slabs || []) b.box(M.concrete, s[0], y0 - (s[4] || 0.28), s[1], s[2], y0 - 0.03, s[3]);
  for (const w of lv.walls) buildWall(b, M, lv, w);
  lv.nWall = lv.blocks.length;                                  // les premiers obstacles sont les murs (utile aux contrôles)
  b.on(lv.layer + ':top');
  for (const c of lv.ceilings || []) {
    b.box(M.ceiling, c[0], y0 + lv.h, c[1], c[2], y0 + lv.h + 0.05, c[3]);
    // spots encastrés
    const nx = Math.max(1, Math.round((c[2] - c[0]) / 1.7)), nz = Math.max(1, Math.round((c[3] - c[1]) / 1.7));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) b.cyl(M.led, c[0] + ((c[2] - c[0]) / nx) * (i + 0.5), y0 + lv.h - 0.006, c[1] + ((c[3] - c[1]) / nz) * (j + 0.5), 0.045, 0.008, 12);
  }
  for (const r of lv.rails || []) { b.on(r[5] ? lv.layer + ':top' : lv.layer); railing(b, M, r[0], r[1], r[2], r[3], y0 + (r[4] || 0)); lv.blocks.push([Math.min(r[0], r[2]) - 0.04, Math.min(r[1], r[3]) - 0.04, Math.max(r[0], r[2]) + 0.04, Math.max(r[1], r[3]) + 0.04]); }
  // mobilier : [type, x, y, rotation en degrés, options]
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
      }
    }
  }
  for (const r of lv.blockers || []) lv.blocks.push(r);
  b.on(lv.layer);
}

/* Grille de navigation d'un niveau : cellules libres = intérieur de la zone praticable, hors obstacles (dilatés du rayon du visiteur). */
export function buildNav(lv, cell = 0.1, radius = 0.17) {
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
  lv.nav = { g, nx, nz, x0, z0, cell };
  return lv.nav;
}
