/* 59 Cézanne — visite 3D : ciel, soleil, lumière selon l'heure, et paysage lointain (collines, Sainte-Victoire à l'Est).
   Repère du monde : +x = Est, +z = Sud, y = altitude. */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Batch, rng } from 'v3d/geo';
import { V } from 'v3d/furniture';

const LAT = 43.53 * Math.PI / 180;           // Aix-en-Provence
const DECL = 14 * Math.PI / 180;             // déclinaison solaire d'une belle journée de mai ou d'août

/* Direction du soleil à l'heure légale d'été h (0-24) : à Aix, le midi solaire tombe vers 13 h 40. */
export function sunDirection(h, out = new THREE.Vector3()) {
  const H = (h - 13.65) * 15 * Math.PI / 180;
  const sinAlt = Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  // azimut compté depuis le Sud, positif vers l'Ouest
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(DECL) * Math.cos(LAT));
  out.set(-Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt));
  out.userData = { alt };
  return out;
}

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/* Profil de la Sainte-Victoire vue depuis Aix (de l'Ouest) : longue échine, sommet, falaise côté Sud. */
const SV = [[-1, 0.03], [-0.82, 0.07], [-0.66, 0.13], [-0.52, 0.2], [-0.4, 0.3], [-0.3, 0.44], [-0.22, 0.6], [-0.15, 0.76], [-0.09, 0.9], [-0.04, 0.975], [0, 1], [0.045, 0.95], [0.09, 0.93], [0.15, 0.86], [0.22, 0.8], [0.3, 0.7], [0.38, 0.6], [0.47, 0.52], [0.57, 0.43], [0.68, 0.33], [0.8, 0.22], [0.9, 0.12], [1, 0.04]];

/* Ruban vertical dont la crête suit un profil : une ligne de relief. */
function ridge(profile, { dist, width, height, base, color, seed = 1, rough = 0.12, center = 0 }) {
  const R = rng(seed), pts = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [x0, h0] = profile[i], [x1, h1] = profile[i + 1], n = 6;
    for (let k = 0; k < n; k++) { const t = k / n; pts.push([x0 + (x1 - x0) * t, h0 + (h1 - h0) * t + (R() - 0.5) * rough * 0.2]); }
  }
  pts.push(profile[profile.length - 1]);
  const pos = [], col = [], c = new THREE.Color(color), lo = c.clone().multiplyScalar(0.8);
  const P = (u, h) => [dist, base + h * height, center + u * width / 2];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = P(pts[i][0], pts[i][1]), b2 = P(pts[i + 1][0], pts[i + 1][1]), a0 = [a[0], base - 60, a[2]], b0 = [b2[0], base - 60, b2[2]];
    pos.push(...a0, ...b0, ...b2, ...a0, ...b2, ...a);
    for (const top of [0, 0, 1, 0, 1, 1]) { const k = top ? c : lo; col.push(k.r, k.g, k.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide }));
  m.userData.base = color;
  return m;
}
function hills(seed, n, amp) { const R = rng(seed), p = []; let h = 0.4 + R() * 0.3; for (let i = 0; i <= n; i++) { h = Math.min(1, Math.max(0.12, h + (R() - 0.5) * amp)); p.push([-1 + (2 * i) / n, h]); } return p; }

export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene; this.renderer = renderer; this.quality = quality;
    this.sky = new Sky(); this.sky.scale.setScalar(3000); this.sky.material.uniforms.up.value.set(0, 1, 0);
    scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const S = quality.shadow; this.sun.shadow.mapSize.set(S, S);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.035; this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xdfeaf5, 0xb8a888, 0.6); scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0xcfdbe6, 0.00045); scene.fog = this.fog;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);
    this.envRT = null; this.dir = new THREE.Vector3(); this.hour = 10; this.night = 0;
    this.land = new THREE.Group(); this.near = new THREE.Group(); scene.add(this.land, this.near); this.theta = 0;
    this.ridges = [];
    this.center = new THREE.Vector3(); this.radius = 14;
  }

  /* Paysage autour d'un logement : sol lointain, lignes de collines, Sainte-Victoire plein Est, arbres proches. */
  setSite(apt, M, center, radius) {
    this.center.copy(center); this.radius = radius;
    for (const g of [this.land, this.near]) for (const c of [...g.children]) { g.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.ridges.length = 0;
    // le plan du logement est tourné de `north` degrés par rapport au terrain : on fait pivoter le paysage et le soleil, pas le logement
    this.theta = THREE.MathUtils.degToRad(apt.north);
    this.land.position.set(center.x, 0, center.z); this.land.rotation.y = -this.theta;
    const gy = apt.groundY;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 48), new THREE.MeshStandardMaterial({ color: 0x5e7447, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, gy - 0.3, 0); ground.receiveShadow = false; this.land.add(ground);
    const near = new THREE.Mesh(new THREE.CircleGeometry(95, 40), M.earth.clone());
    near.material.map = M.earth.map.clone(); near.material.map.repeat.set(26, 26); near.material.map.needsUpdate = true;
    near.rotation.x = -Math.PI / 2; near.position.set(0, gy - 0.02, 0); near.receiveShadow = true; this.land.add(near);
    const add = (m) => { this.land.add(m); this.ridges.push(m); return m; };
    // de l'arrière-plan vers l'avant : massif, puis collines boisées de plus en plus proches
    add(ridge(SV, { dist: 1150, width: 700, height: 92, base: gy + 12, color: 0xc4bed0, seed: 3, rough: 0.16, center: -40 })).userData.k = 1.7;
    add(ridge(hills(11, 22, 0.16), { dist: 1000, width: 2600, height: 46, base: gy + 4, color: 0x8f9f97, seed: 5 }));
    add(ridge(hills(12, 30, 0.2), { dist: 640, width: 2000, height: 30, base: gy + 2, color: 0x6f8562, seed: 6 }));
    add(ridge(hills(13, 36, 0.24), { dist: 330, width: 1300, height: 17, base: gy + 1, color: 0x56743f, seed: 7 }));
    for (const [rot, s] of [[Math.PI / 2, 21], [Math.PI, 22], [-Math.PI / 2, 23]]) {       // horizon boisé sur les trois autres côtés
      const m = ridge(hills(s, 30, 0.22), { dist: 420, width: 1700, height: 26, base: gy + 1, color: 0x5d7847, seed: s });
      m.rotation.y = rot; add(m);
    }
    // arbres et toits du voisinage
    const b = new Batch(); b.on('land');
    const R = rng(apt.id.length * 97 + 5);
    const place = (x, z, kind, h) => {
      if (kind === 'cypress') V.cypress(b, M, x, z, { h, y: gy }); else V.tree(b, M, x, z, { kind, h, r: h * (kind === 'pine' ? 0.36 : 0.42), seed: Math.round(x * 7 + z * 13), y: gy });
    };
    for (const [px, pz, kind, h] of apt.trees || []) place(px, pz, kind, h);
    for (let i = 0; i < this.quality.trees; i++) {
      const a = R() * 6.283, d = 44 + R() * 120, x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, k = R();
      place(x, z, k < 0.55 ? 'pine' : k < 0.8 ? 'cypress' : 'olive', 6 + R() * 6);
    }
    for (let i = 0; i < 42; i++) {                                                          // maisons du quartier, toits de tuiles
      const a = R() * 6.283, d = 62 + Math.pow(R(), 0.8) * 330, x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, w = 9 + R() * 7, dd = 7 + R() * 5, rot = R() * 3;
      b.push(x, gy, z, rot); b.box(M.massing, -w / 2, 0, -dd / 2, w / 2, 5.5, dd / 2); b.geo(M.roof, new THREE.ConeGeometry(Math.max(w, dd) * 0.78, 2, 4), 0, 6.5, 0, 0, Math.PI / 4, 0, 1, 1, dd / w); b.pop();
    }
    const L = b.build(this.near);
    if (L.land) L.land.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    // la « mer d'arbres » du pays d'Aix : houppiers instanciés jusqu'aux premières collines
    const N = this.quality.forest, geo = new THREE.IcosahedronGeometry(1, 1);
    const forest = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), pal = [0x4c7743, 0x3f6a3a, 0x5a8249, 0x33592f, 0x748a5c, 0x486f3c];
    for (let i = 0; i < N; i++) {
      const a = R() * 6.283, d = 48 + Math.pow(R(), 0.62) * 540, s = 2.4 + R() * 3.4, pine = R() < 0.6;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.283);
      m4.compose(new THREE.Vector3(center.x + Math.cos(a) * d, gy + s * (pine ? 1.5 : 0.8), center.z + Math.sin(a) * d), q, new THREE.Vector3(s * (pine ? 1.35 : 1), s * (pine ? 0.6 : 0.95), s * (pine ? 1.35 : 1)));
      forest.setMatrixAt(i, m4); forest.setColorAt(i, col.setHex(pal[(R() * pal.length) | 0]).multiplyScalar(0.8 + R() * 0.45));
    }
    forest.instanceMatrix.needsUpdate = true; forest.instanceColor.needsUpdate = true; forest.castShadow = false; forest.receiveShadow = false; forest.frustumCulled = false;
    this.near.add(forest);
  }

  /* Heure du jour → soleil, ciel, brouillard, ambiance. Renvoie le degré de « nuit » (0 = jour, 1 = nuit). */
  setHour(h) {
    this.hour = h;
    const d = sunDirection(h, this.dir), alt = d.userData.alt, deg = alt * 180 / Math.PI;
    d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.theta);
    const day = smooth(-4, 8, deg), golden = 1 - smooth(4, 26, deg), night = 1 - smooth(-9, 1, deg);
    this.night = night;
    const u = this.sky.material.uniforms;
    u.turbidity.value = lerp(2.2, 7, golden); u.rayleigh.value = lerp(1.25, 2.6, golden); u.mieCoefficient.value = lerp(0.004, 0.012, golden); u.mieDirectionalG.value = 0.82;
    const sd = d.clone(); if (sd.y < -0.05) sd.y = -0.05;
    u.sunPosition.value.copy(sd);
    const e = this.envSky.material.uniforms; for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) e[k].value = u[k].value; e.sunPosition.value.copy(sd);
    // soleil : blanc chaud en journée, orangé à l'heure dorée
    const warm = new THREE.Color().setHSL(lerp(0.105, 0.07, golden), lerp(0.3, 0.85, golden), lerp(0.93, 0.62, golden));
    this.sun.color.copy(warm); this.sun.intensity = 3.1 * day * lerp(1, 0.75, golden);
    this.sun.visible = day > 0.01;
    const sky = new THREE.Color(0xfff3e2).lerp(new THREE.Color(0xffc48a), golden * 0.55).lerp(new THREE.Color(0x1a2238), night);
    const gnd = new THREE.Color(0xd9bf98).lerp(new THREE.Color(0x15161c), night);
    this.hemi.color.copy(sky); this.hemi.groundColor.copy(gnd); this.hemi.intensity = lerp(0.1, 0.62, day);
    const fogc = new THREE.Color().setHSL(lerp(0.58, 0.07, golden * 0.8), lerp(0.3, 0.5, golden), lerp(0.84, 0.72, golden)).lerp(new THREE.Color(0x0e1322), night);
    this.fog.color.copy(fogc); this.fog.density = lerp(0.00045, 0.0008, golden);
    for (const m of this.ridges) m.material.color.setScalar(m.userData.k || 1).lerp(new THREE.Color(0xffd2a8), golden * 0.35).multiplyScalar(lerp(1.5, 0.3, night) * lerp(1, 0.8, golden));   // relief non éclairé : compensé pour l'exposition
    this.sky.material.uniforms.rayleigh.value *= lerp(1, 0.25, night);
    this.renderer.toneMappingExposure = lerp(0.43, 0.4, golden) * lerp(1, 1.25, night);
    this.placeSun();
    this.updateEnvMap(lerp(1, 0.07, night));
    return night;
  }

  placeSun() {
    const r = this.radius, c = this.center;
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.dir, r * 3);
    const cam = this.sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = r * 0.5; cam.far = r * 6; cam.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
  }

  updateEnvMap(intensity) {
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.32 * intensity + 0.02;
  }
}
