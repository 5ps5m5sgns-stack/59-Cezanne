/* 59 Cézanne — visite 3D : matériaux et textures procédurales (dessinées sur canvas au chargement, aucun fichier image à télécharger).
   Palette reprise des rendus du graphiste et de la charte du site : chêne miel, enduit sable, menuiseries bronze, cuir terracotta, travertin. */
import * as THREE from 'three';
import { rng } from 'v3d/geo';

function canvas(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}
function tex(c, { srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
function shade([r, g, b], k) { return [Math.max(0, Math.min(255, r * k)), Math.max(0, Math.min(255, g * k)), Math.max(0, Math.min(255, b * k))]; }

/* Grain fin : petites taches translucides claires et sombres. */
function speckle(g, S, R, n, amp = 0.06, size = 2.2) {
  for (let i = 0; i < n; i++) {
    const v = R() < 0.5 ? 0 : 255;
    g.fillStyle = rgb(v, v, v, R() * amp);
    const s = 0.6 + R() * size;
    g.fillRect(R() * S, R() * S, s, s);
  }
}
/* Nuages doux : grandes taches très diffuses, pour casser l'aplat. */
function clouds(g, S, R, n, amp, rad) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = rad * (0.4 + R());
    const v = R() < 0.5 ? 0 : 255;
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, rgb(v, v, v, amp * R())); gr.addColorStop(1, rgb(v, v, v, 0));
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    }
  }
}

/* Parquet : lames de 14 cm, longueurs variables, sur un carreau de 2,4 m. */
function parquet(base, seed, { plank = 0.14, tile = 2.4, vary = 0.13 } = {}) {
  return canvas(1024, (g, S) => {
    const R = rng(seed), rows = Math.round(tile / plank), ph = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -R() * S * 0.5;
      while (x < S) {
        const len = S * (0.42 + R() * 0.5), k = 1 - vary / 2 + R() * vary;
        const c = shade(base, k);
        g.fillStyle = rgb(c[0] + (R() - 0.5) * 6, c[1], c[2] - R() * 4);
        g.fillRect(x, r * ph, len, ph);
        // veinage dans le sens de la lame
        for (let i = 0; i < 26; i++) {
          const yy = r * ph + R() * ph, a = 0.03 + R() * 0.07;
          g.strokeStyle = R() < 0.6 ? rgb(70, 40, 20, a) : rgb(255, 235, 200, a);
          g.lineWidth = 0.5 + R() * 1.2;
          g.beginPath(); g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (R() - 0.5) * 5, x + len * 0.6, yy + (R() - 0.5) * 5, x + len, yy + (R() - 0.5) * 3);
          g.stroke();
        }
        g.fillStyle = rgb(40, 22, 10, 0.5); g.fillRect(x + len - 1, r * ph, 1.2, ph);
        x += len;
      }
      g.fillStyle = rgb(40, 22, 10, 0.42); g.fillRect(0, r * ph, S, 1.1);
    }
    speckle(g, S, R, 5000, 0.035, 1.5);
  });
}

/* Bois de mobilier : veinage continu, sans joints. */
function woodGrain(base, seed, dark = 0.1) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const y = R() * S;
      g.strokeStyle = R() < 0.65 ? rgb(40, 22, 8, R() * dark) : rgb(255, 240, 215, R() * dark * 0.8);
      g.lineWidth = 0.6 + R() * 2.4;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(S * 0.3, y + (R() - 0.5) * 14, S * 0.7, y + (R() - 0.5) * 14, S, y);
      g.stroke();
    }
    clouds(g, S, R, 10, 0.07, 150);
  });
}

/* Pierre en dalles (travertin, grès) : veines horizontales douces + joints. n = nombre de dalles par côté. */
function stoneTiles(base, seed, n, { joint = 3, veins = 0.5, jointCol = [150, 138, 120] } = {}) {
  return canvas(1024, (g, S) => {
    const R = rng(seed), t = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = shade(base, 0.955 + R() * 0.09);
      g.fillStyle = rgb(...c); g.fillRect(i * t, j * t, t, t);
      g.save(); g.beginPath(); g.rect(i * t, j * t, t, t); g.clip();
      for (let k = 0; k < 34 * veins; k++) {
        const y = j * t + R() * t;
        g.strokeStyle = R() < 0.55 ? rgb(120, 96, 66, 0.04 + R() * 0.07) : rgb(255, 250, 240, 0.05 + R() * 0.1);
        g.lineWidth = 1 + R() * 5;
        g.beginPath(); g.moveTo(i * t, y);
        g.bezierCurveTo(i * t + t * 0.3, y + (R() - 0.5) * 16, i * t + t * 0.7, y + (R() - 0.5) * 16, (i + 1) * t, y + (R() - 0.5) * 8);
        g.stroke();
      }
      for (let k = 0; k < 40 * veins; k++) { g.fillStyle = rgb(110, 90, 66, 0.08 + R() * 0.12); g.beginPath(); g.ellipse(i * t + R() * t, j * t + R() * t, 1 + R() * 3.5, 0.6 + R() * 1.3, 0, 0, 7); g.fill(); }
      g.restore();
    }
    g.fillStyle = rgb(...jointCol);
    for (let i = 0; i <= n; i++) { g.fillRect(i * t - joint / 2, 0, joint, S); g.fillRect(0, i * t - joint / 2, S, joint); }
    speckle(g, S, R, 7000, 0.03, 1.6);
  });
}

/* Aplat légèrement vivant (enduit, plâtre, tissu). */
function plain(base, seed, { grain = 0.05, cloud = 0.05, weave = 0 } = {}) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    if (cloud) clouds(g, S, R, 14, cloud, 170);
    speckle(g, S, R, 9000, grain, 2);
    if (weave) {
      g.globalAlpha = weave;
      for (let i = 0; i < S; i += 4) { g.fillStyle = i % 8 ? '#000' : '#fff'; g.fillRect(i, 0, 1, S); g.fillRect(0, i, S, 1); }
      g.globalAlpha = 1;
    }
  });
}

/* Marbre : fond uni + veines ramifiées. */
function marble(base, vein, seed, n = 16) {
  return canvas(1024, (g, S) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    clouds(g, S, R, 16, 0.07, 220);
    for (let i = 0; i < n; i++) {
      let x = R() * S, y = R() * S, a = R() * 6.28;
      g.strokeStyle = rgb(vein[0], vein[1], vein[2], 0.25 + R() * 0.45); g.lineWidth = 0.6 + R() * 2.6;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 26; k++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 34; y += Math.sin(a) * 34; g.lineTo(x, y); }
      g.stroke();
    }
    speckle(g, S, R, 4000, 0.03, 1.4);
  });
}

/* Mur en pierre sèche : assises irrégulières. */
function dryStone(seed) {
  return canvas(1024, (g, S) => {
    const R = rng(seed);
    g.fillStyle = '#6b5d4c'; g.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 46 + R() * 42; let x = -R() * 80;
      while (x < S) {
        const w = 70 + R() * 150, c = shade([203, 184, 152], 0.78 + R() * 0.34);
        g.fillStyle = rgb(c[0], c[1], c[2] - R() * 10);
        g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, h - 6, 9); g.fill();
        g.fillStyle = rgb(255, 250, 235, 0.10); g.fillRect(x + 6, y + 5, w - 12, 5);
        x += w;
      }
      y += h;
    }
    speckle(g, S, R, 12000, 0.07, 2.5);
  });
}

/* Tuiles canal : rangs ondulés terre cuite. */
function roofTiles(seed) {
  return canvas(512, (g, S) => {
    const R = rng(seed), cols = 12, rows = 8, cw = S / cols, rh = S / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const col = shade([196, 124, 86], 0.8 + R() * 0.38);
      const gr = g.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
      gr.addColorStop(0, rgb(...shade(col, 0.62))); gr.addColorStop(0.5, rgb(...col)); gr.addColorStop(1, rgb(...shade(col, 0.66)));
      g.fillStyle = gr; g.fillRect(c * cw, r * rh, cw, rh);
      g.fillStyle = rgb(60, 30, 18, 0.35); g.fillRect(c * cw, (r + 1) * rh - 3, cw, 3);
    }
    speckle(g, S, R, 5000, 0.06, 2);
  });
}

/* Végétal : gazon et feuillage. */
function foliage(base, seed, { blades = false } = {}) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    clouds(g, S, R, 22, 0.10, 120);
    for (let i = 0; i < (blades ? 16000 : 5200); i++) {
      const c = shade(base, 0.6 + R() * 0.75);
      g.fillStyle = rgb(c[0] + R() * 18, c[1] + R() * 12, c[2], 0.5);
      if (blades) g.fillRect(R() * S, R() * S, 1 + R(), 2 + R() * 4);
      else { g.beginPath(); g.ellipse(R() * S, R() * S, 2 + R() * 6, 1.5 + R() * 4, R() * 3, 0, 7); g.fill(); }
    }
  });
}

/* Tapis : trame chinée à rayures discrètes. */
function rugTex(base, seed) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = rgb(...base); g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 3) { g.fillStyle = rgb(...shade(base, 0.86 + R() * 0.26), 0.7); g.fillRect(0, y, S, 2); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = rgb(60, 50, 44, R() * 0.16); g.fillRect(R() * S, R() * S, 6 + R() * 40, 1.5); }
    speckle(g, S, R, 6000, 0.05, 2);
  });
}

/* Eau du bassin. */
function waterTex(seed) {
  return canvas(512, (g, S) => {
    const R = rng(seed);
    g.fillStyle = '#2f9bb0'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 130; i++) {
      g.strokeStyle = rgb(210, 250, 255, 0.10 + R() * 0.16); g.lineWidth = 1 + R() * 2.5;
      const x = R() * S, y = R() * S;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 16 + R() * 32, x + 60, y - 16 + R() * 32, x + 90, y + (R() - 0.5) * 20); g.stroke();
    }
  });
}

/* Toile abstraite pour les tableaux (clin d'œil aux ocres de Cézanne). */
function painting(seed) {
  return canvas(256, (g, S) => {
    const R = rng(seed), pal = ['#b86248', '#e4d6bd', '#7b4538', '#c98a52', '#6B7C45', '#7BA7BC', '#f6f1e7', '#b07642'];
    g.fillStyle = '#efe6d4'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = pal[(R() * pal.length) | 0]; g.globalAlpha = 0.35 + R() * 0.5;
      g.beginPath(); g.ellipse(R() * S, S * (0.25 + R() * 0.7), 14 + R() * 60, 6 + R() * 26, (R() - 0.5) * 1.2, 0, 7); g.fill();
    }
    g.globalAlpha = 0.9; g.fillStyle = '#c9c0bd';
    g.beginPath(); g.moveTo(0, S * 0.42); g.lineTo(S * 0.3, S * 0.3); g.lineTo(S * 0.52, S * 0.12); g.lineTo(S * 0.62, S * 0.2); g.lineTo(S, S * 0.4); g.lineTo(S, S * 0.5); g.lineTo(0, S * 0.5); g.fill();
    g.globalAlpha = 1;
  });
}

function std(o) { const u = o.userData; delete o.userData; const m = new THREE.MeshStandardMaterial(o); if (u) m.userData = u; return m; }

export function makeMaterials(quality) {
  const A = quality.aniso;
  const T = (c, o) => tex(c, { aniso: A, ...o });
  const M = {};
  // Sols — trois finitions au choix pour les pièces de vie
  M.floorOak = std({ map: T(parquet([178, 132, 88], 11)), roughness: 0.6, metalness: 0, userData: { wuv: 2.4, cast: false } });
  M.floorOakLight = std({ map: T(parquet([206, 180, 144], 12, { plank: 0.18 })), roughness: 0.62, userData: { wuv: 2.4, cast: false } });
  M.floorOakDark = std({ map: T(parquet([118, 84, 60], 13)), roughness: 0.55, userData: { wuv: 2.4, cast: false } });
  M.floorStone = std({ map: T(stoneTiles([222, 210, 190], 14, 2, { veins: 0.8 })), roughness: 0.5, userData: { wuv: 2.4, cast: false } });
  M.floor = M.floorOak.clone(); M.floor.userData = { wuv: 2.4, cast: false };           // matériau courant des pièces de vie
  M.tile = std({ map: T(stoneTiles([205, 200, 192], 15, 4, { veins: 0.35, jointCol: [168, 164, 158] })), roughness: 0.32, userData: { wuv: 2.4, cast: false } });
  M.terrace = std({ map: T(stoneTiles([222, 204, 172], 16, 3, { veins: 1, joint: 5 })), roughness: 0.8, userData: { wuv: 2.4 } });
  M.concrete = std({ color: 0x8f8a84, roughness: 0.9 });
  // Murs et plafonds
  M.plaster = std({ map: T(plain([246, 241, 232], 21, { grain: 0.02, cloud: 0.025 })), roughness: 0.93, userData: { wuv: 3 } });
  M.ceiling = std({ color: 0xfbf9f4, roughness: 0.96, userData: { cast: true } });
  M.stucco = std({ map: T(plain([222, 204, 172], 22, { grain: 0.06, cloud: 0.05 })), roughness: 0.95, userData: { wuv: 2.5 } });
  M.stuccoDark = std({ color: 0xb9a584, roughness: 0.95 });
  M.massing = std({ color: 0xd9cdb8, roughness: 0.95 });            // volumes de contexte, traités en maquette claire
  M.wallTile = std({ map: T(stoneTiles([232, 226, 214], 23, 2, { veins: 0.6 })), roughness: 0.3, userData: { wuv: 2.4 } });
  M.stone = std({ map: T(dryStone(24)), roughness: 0.95, userData: { wuv: 2.2 } });
  M.roof = std({ map: T(roofTiles(25)), roughness: 0.85, userData: { wuv: 1.6 } });
  // Menuiseries
  M.frame = std({ color: 0x3a332c, roughness: 0.45, metalness: 0.55 });
  M.steel = std({ color: 0xb9b6b0, roughness: 0.28, metalness: 0.9 });
  M.brass = std({ color: 0xc9a25e, roughness: 0.3, metalness: 0.95 });
  M.black = std({ color: 0x1d1b1a, roughness: 0.5, metalness: 0.3 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe0e2, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.07, envMapIntensity: 0.55, depthWrite: false });
  M.glass.userData = { cast: false, receive: false, order: 5 };
  M.glassFrost = new THREE.MeshPhysicalMaterial({ color: 0xf2f6f6, roughness: 0.25, transparent: true, opacity: 0.28, depthWrite: false });
  M.glassFrost.userData = { cast: false, receive: false, order: 5 };
  M.mirror = std({ color: 0xdfe6e8, roughness: 0.04, metalness: 1 });
  M.door = std({ color: 0xf3efe7, roughness: 0.55 });
  M.slat = std({ map: T(woodGrain([150, 108, 70], 31, 0.16)), roughness: 0.7, userData: { wuv: 1.2, wuvSwap: true } });
  // Mobilier
  M.oak = std({ map: T(woodGrain([186, 142, 96], 32)), roughness: 0.55, userData: { wuv: 1.4 } });
  M.walnut = std({ map: T(woodGrain([104, 70, 46], 33, 0.14)), roughness: 0.5, userData: { wuv: 1.4 } });
  M.lacquer = std({ color: 0xf2efe9, roughness: 0.35 });
  M.anthracite = std({ color: 0x35373b, roughness: 0.55 });
  M.navy = std({ color: 0x38465a, roughness: 0.5 });
  M.marble = std({ map: T(marble([238, 234, 228], [128, 122, 118], 34)), roughness: 0.18, userData: { wuv: 1.8 } });
  M.marbleDark = std({ map: T(marble([34, 32, 34], [214, 204, 190], 35, 11)), roughness: 0.38, userData: { wuv: 1.6 } });
  M.linen = std({ map: T(plain([226, 221, 211], 36, { grain: 0.05, cloud: 0.04, weave: 0.035 })), roughness: 0.95, userData: { wuv: 0.6 } });
  M.greige = std({ map: T(plain([176, 168, 156], 37, { grain: 0.06, cloud: 0.04, weave: 0.04 })), roughness: 0.95, userData: { wuv: 0.6 } });
  M.cream = std({ map: T(plain([240, 233, 220], 38, { grain: 0.04, cloud: 0.03, weave: 0.03 })), roughness: 0.97, userData: { wuv: 0.6 } });
  M.terra = std({ color: 0xb86248, roughness: 0.62 });                // cuir terracotta, couleur de la charte
  M.cognac = std({ color: 0x9a5a36, roughness: 0.5 });
  M.sage = std({ color: 0x8c9a72, roughness: 0.95 });
  M.ochre = std({ color: 0xd49a4e, roughness: 0.95 });
  M.charcoal = std({ color: 0x55524f, roughness: 0.95 });
  M.white = std({ color: 0xffffff, roughness: 0.4 });
  M.ceramic = std({ color: 0xfbfbf9, roughness: 0.12 });
  M.tubIn = std({ color: 0xdde3e4, roughness: 0.18 });
  M.rug = std({ map: T(rugTex([214, 204, 188], 39)), roughness: 1, userData: { wuv: 1.5, cast: false } });
  M.rugDark = std({ map: T(rugTex([96, 92, 90], 40)), roughness: 1, userData: { wuv: 1.5, cast: false } });
  M.screen = std({ color: 0x0c0d10, roughness: 0.32, metalness: 0.3 });
  M.art1 = std({ map: T(painting(41)), roughness: 0.8 });
  M.art2 = std({ map: T(painting(42)), roughness: 0.8 });
  M.pot = std({ color: 0xd9cdb8, roughness: 0.85 });
  M.rattan = std({ map: T(woodGrain([170, 128, 84], 43, 0.2)), roughness: 0.8, userData: { wuv: 0.5 } });
  // Lumières (émissifs : allumés à la tombée du jour)
  M.lampShade = std({ color: 0xf6ecd8, roughness: 0.9, emissive: 0xffd9a0, emissiveIntensity: 0 });
  M.led = std({ color: 0xfff1d6, roughness: 0.6, emissive: 0xffe2b0, emissiveIntensity: 0 });
  M.lampShade.userData = { cast: false }; M.led.userData = { cast: false };
  // Extérieur
  M.grass = std({ map: T(foliage([98, 124, 64], 51, { blades: true })), roughness: 1, userData: { wuv: 2.5, cast: false } });
  M.hedge = std({ map: T(foliage([58, 92, 48], 52)), roughness: 1, userData: { wuv: 1.4 } });
  M.leafOlive = std({ map: T(foliage([126, 142, 104], 53)), roughness: 1, userData: { wuv: 1.2 } });
  M.leafPine = std({ map: T(foliage([62, 104, 60], 54)), roughness: 1, userData: { wuv: 1.5 } });
  M.leafCypress = std({ map: T(foliage([44, 74, 46], 55)), roughness: 1, userData: { wuv: 1.1 } });
  M.lavender = std({ color: 0x8a7bc0, roughness: 1 });
  M.oleander = std({ color: 0xe07a94, roughness: 1 });
  M.bark = std({ color: 0x6f5a48, roughness: 1 });
  M.earth = std({ map: T(foliage([120, 128, 84], 56)), roughness: 1, userData: { wuv: 6, cast: false } });
  M.water = new THREE.MeshPhysicalMaterial({ map: T(waterTex(57)), roughness: 0.06, metalness: 0, transparent: true, opacity: 0.9, envMapIntensity: 1.4 });
  M.water.userData = { wuv: 3, cast: false };
  M.road = std({ color: 0x77736e, roughness: 0.95, userData: { cast: false } });
  return M;
}

/* Finitions de sol proposées dans la visite. */
export const FLOOR_FINISHES = [
  { id: 'floorOak', fr: 'Chêne miel', en: 'Honey oak', sw: '#be8a56' },
  { id: 'floorOakLight', fr: 'Chêne clair', en: 'Light oak', sw: '#d6b88e' },
  { id: 'floorOakDark', fr: 'Chêne fumé', en: 'Smoked oak', sw: '#7a5438' },
  { id: 'floorStone', fr: 'Pierre claire', en: 'Light stone', sw: '#e2d4bc' },
];
export function setFloorFinish(M, id) {
  const src = M[id]; if (!src) return;
  M.floor.map = src.map; M.floor.roughness = src.roughness; M.floor.needsUpdate = true;
}
