/* 59 Cézanne — visite 3D : déplacements du visiteur (recherche de chemin sur la grille d'un niveau). */

export function cellFree(nav, x, z) {
  const i = Math.floor((x - nav.x0) / nav.cell), j = Math.floor((z - nav.z0) / nav.cell);
  return i >= 0 && j >= 0 && i < nav.nx && j < nav.nz && nav.g[j * nav.nx + i] === 1;
}

/* Cellule libre la plus proche d'un point (recherche en spirale, rayon max en mètres). */
export function nearestFree(nav, x, z, maxR = 1.2) {
  if (cellFree(nav, x, z)) return [x, z];
  const c = nav.cell, n = Math.ceil(maxR / c);
  let best = null, bd = Infinity;
  for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) {
    const px = x + di * c, pz = z + dj * c, d = di * di + dj * dj;
    if (d < bd && cellFree(nav, px, pz)) { bd = d; best = [px, pz]; }
  }
  return best;
}

function lineFree(nav, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / (nav.cell * 0.5)));
  for (let i = 0; i <= n; i++) { const t = i / n; if (!cellFree(nav, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
  return true;
}

/* A* à huit voisins ; renvoie une liste de points [x, z] lissée, ou null si la destination est inaccessible. */
export function findPath(nav, from, to) {
  const s = nearestFree(nav, from[0], from[1], 1.5), e = nearestFree(nav, to[0], to[1], 1.5);
  if (!s || !e) return null;
  if (lineFree(nav, s, e)) return [s, e];
  const { nx, nz, cell, x0, z0, g } = nav;
  const idx = (p) => Math.floor((p[1] - z0) / cell) * nx + Math.floor((p[0] - x0) / cell);
  const S = idx(s), T = idx(e), N = nx * nz;
  const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], hp = [];                                           // tas binaire (indice, priorité)
  const push = (i, p) => { let k = heap.length; heap.push(i); hp.push(p); while (k > 0) { const q = (k - 1) >> 1; if (hp[q] <= hp[k]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; [hp[q], hp[k]] = [hp[k], hp[q]]; k = q; } };
  const pop = () => { const top = heap[0], li = heap.pop(), lp = hp.pop(); if (heap.length) { heap[0] = li; hp[0] = lp; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && hp[l] < hp[m]) m = l; if (r < heap.length && hp[r] < hp[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hp[m], hp[k]] = [hp[k], hp[m]]; k = m; } } return top; };
  const tx = T % nx, tz = (T / nx) | 0, h = (i) => Math.hypot((i % nx) - tx, ((i / nx) | 0) - tz);
  gs[S] = 0; push(S, h(S));
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  let found = false;
  while (heap.length) {
    const c = pop(); if (closed[c]) continue; closed[c] = 1;
    if (c === T) { found = true; break; }
    const cx = c % nx, cz = (c / nx) | 0;
    for (const [dx, dz, w] of D) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
      const n = z * nx + x; if (!g[n] || closed[n]) continue;
      if (dx && dz && (!g[cz * nx + x] || !g[z * nx + cx])) continue;   // pas de coupe en diagonale au ras d'un angle
      const ng = gs[c] + w;
      if (ng < gs[n]) { gs[n] = ng; came[n] = c; push(n, ng + h(n)); }
    }
  }
  if (!found) return null;
  const pts = [];
  for (let c = T; c !== -1; c = came[c]) pts.push([x0 + ((c % nx) + 0.5) * cell, z0 + (((c / nx) | 0) + 0.5) * cell]);
  pts.reverse(); pts[0] = s; pts[pts.length - 1] = e;
  // lissage : on saute les points intermédiaires tant que la ligne droite reste libre
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) {
    let j = Math.min(pts.length - 1, i + 60);
    while (j > i + 1 && !lineFree(nav, pts[i], pts[j])) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}

export function pathLength(p) { let d = 0; for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return d; }
