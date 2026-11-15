/* 59 Cézanne — visite 3D des deux logements disponibles.
   Trois façons de regarder : la maquette (vue plongeante, murs coupés), la visite libre (à hauteur d'œil) et le plan.
   Aucune dépendance en dehors de three.js, servi depuis /vendor/three. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Batch } from 'v3d/geo';
import { makeMaterials, FLOOR_FINISHES, setFloorFinish } from 'v3d/materials';
import { buildLevel, buildStair, buildLift, buildNav } from 'v3d/build';
import { APARTMENTS } from 'v3d/plans';
import { Environment } from 'v3d/env';
import { cellFree, nearestFree, findPath } from 'v3d/nav';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rad = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const EYE = 1.62, FOV_WALK = 70, FOV_ORBIT = 34, FOV_PLAN = 17;
const params = new URLSearchParams(location.search);
const lang = () => (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
const T = {
  loadTex: { fr: 'Préparation des matériaux…', en: 'Preparing materials…' },
  loadGeo: { fr: 'Construction du logement…', en: 'Building the home…' },
  loadEnv: { fr: 'Mise en lumière…', en: 'Setting the light…' },
  hintWalk: { fr: 'Glissez pour regarder autour de vous · cliquez au sol pour avancer', en: 'Drag to look around · click the floor to walk' },
  hintWalkTouch: { fr: 'Glissez pour regarder · touchez le sol pour avancer', en: 'Drag to look · tap the floor to walk' },
  hintOrbit: { fr: 'Cliquez sur une pièce pour y entrer · glissez pour tourner la maquette', en: 'Click a room to step inside · drag to rotate the model' },
  hintPlan: { fr: 'Glissez pour déplacer le plan · cliquez sur une pièce pour y entrer', en: 'Drag to move the plan · click a room to step inside' },
  hintLift: { fr: 'Entrez dans la cabine pour changer de niveau', en: 'Step into the lift to change level' },
  lift: { fr: 'Ascenseur', en: 'Lift' },
  tourPlay: { fr: 'Visite guidée', en: 'Guided tour' }, tourStop: { fr: 'Arrêter la visite', en: 'Stop the tour' },
  outside: { fr: 'Extérieur', en: 'Outside' },
  nogl: { fr: 'La visite 3D a besoin de WebGL, que ce navigateur ne propose pas.', en: 'The 3D tour needs WebGL, which this browser does not provide.' },
};
const tr = (k) => T[k][lang()];

/* ── Qualité selon l'appareil ───────────────────────────────────────────── */
const touch = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 820;
const qName = params.get('q') || (touch && small ? 'low' : touch ? 'mid' : 'high');
const QUALITIES = {
  low: { shadow: 2048, aniso: 4, ao: false, bloom: false, lights: 4, dpr: 1.5, trees: 22, forest: 380 },
  mid: { shadow: 2048, aniso: 8, ao: false, bloom: true, lights: 6, dpr: 1.75, trees: 34, forest: 700 },
  high: { shadow: 4096, aniso: 8, ao: true, bloom: true, lights: 8, dpr: 2, trees: 46, forest: 1300 },
  test: { shadow: 2048, aniso: 4, ao: true, bloom: true, lights: 8, dpr: 1, trees: 40, forest: 1100 },
};
const QUALITY = QUALITIES[qName] || QUALITIES.high;

const root = $('#v3d');
const canvas = $('#v3d-canvas');
const ui = { loader: $('#v3d-loader'), loaderText: $('#v3d-loader-text'), labels: $('#v3d-labels'), hud: $('#v3d-hud'), hint: $('#v3d-hint'), map: $('#v3d-map'), fade: $('#v3d-fade') };

class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.dpr));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.shadowMap.autoUpdate = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV_ORBIT, 1, 0.08, 3200);
    this.camera.rotation.order = 'YXZ';
    this.env = new Environment(this.scene, this.renderer, QUALITY);
    this.M = null; this.built = new Map();
    this.apt = null; this.mode = 'orbit'; this.viewLevel = 0; this.hour = Number(params.get('h')) || 11; this.night = 0;
    this.walk = { level: 0, x: 0, z: 0, yaw: 0, pitch: 0, path: null, look: null, climbing: null, dragAt: 0, onArrive: null };
    this.keys = new Set(); this.fly = null; this.tour = null; this.dirty = true; this.clock = new THREE.Clock();
    this.pool = []; this.lightAt = new THREE.Vector3(1e9, 0, 0);
    this.labelEls = []; this.ready = false;
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.44, minDistance: 5, maxDistance: 70, zoomSpeed: 0.9, rotateSpeed: 0.7, screenSpacePanning: false });
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 40), new THREE.MeshBasicMaterial({ color: 0xb86248, transparent: true, opacity: 0.85, depthTest: false }));
    this.reticle.rotation.x = -Math.PI / 2; this.reticle.renderOrder = 20; this.reticle.visible = false;
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    this.hl = new THREE.Group(); this.hl.visible = false; this.hlRoom = null;
    const hm = new THREE.MeshBasicMaterial({ color: 0xb86248, transparent: true, opacity: 0.3, depthTest: false, toneMapped: false });
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hm); m.rotation.x = -Math.PI / 2; m.renderOrder = 15; this.hl.add(m); }
    this.setupComposer(); this.bind();
    new ResizeObserver(() => this.resize()).observe(root); this.resize();
  }

  setupComposer() {
    if (!QUALITY.ao && !QUALITY.bloom) { this.composer = null; return; }
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (QUALITY.ao) {
      this.ao = new GTAOPass(this.scene, this.camera, 4, 4);
      this.ao.updateGtaoMaterial({ radius: 0.42, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 12 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    }
    if (QUALITY.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.0, 0.5, 0.98); this.composer.addPass(this.bloom); }
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = Math.max(2, root.clientWidth), h = Math.max(2, root.clientHeight);
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
  }

  /* ── Construction d'un logement (une seule fois, puis mis en cache) ──────── */
  build(apt) {
    if (this.built.has(apt.id)) return this.built.get(apt.id);
    const group = new THREE.Group(); group.name = apt.id;      // l'orientation réelle est donnée au paysage et au soleil (env.js)
    const b = new Batch(), lv0 = apt.levels[0];
    lv0.items = lv0.items.concat((apt.garden || []).map(([t, x, z, r, o]) => [t, x, z, r, { ...o, layer: 'ext', y0: -0.015 }]));
    apt.levels.forEach((lv, i) => buildLevel(b, this.M, lv, i));
    if (apt.stair) buildStair(b, this.M, apt.stair, lv0);
    if (apt.lift) buildLift(b, this.M, apt.lift, apt.levels);
    apt.exterior(b, this.M, lv0, apt.levels[1]);
    const layers = b.build(group);
    apt.levels.forEach((lv) => buildNav(lv));
    const lamps = b.lights.map((l) => ({ pos: l.pos, power: l.power, level: /^L(\d)/.test(l.layer) ? +l.layer[1] : 0, day: false }));
    const days = apt.levels.flatMap((lv, i) => lv.dayLights.map((l) => ({ pos: l.pos, power: l.power, level: i, day: true })));
    // fond de maquette : un plan qui ne montre que l'ombre portée du logement
    const bb = lv0.bounds, catcher = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ opacity: 0.2 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.set((bb[0] + bb[2]) / 2, -0.34, (bb[1] + bb[3]) / 2); catcher.receiveShadow = true; catcher.visible = false; group.add(catcher);
    // repères au sol de la visite libre : un anneau par pièce, là où l'on se place pour la regarder
    const pucks = new THREE.Group(); pucks.visible = false; group.add(pucks);
    const ring = new THREE.RingGeometry(0.15, 0.21, 40), dot = new THREE.CircleGeometry(0.05, 20), pm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, toneMapped: false });
    apt.levels.forEach((lv, i) => lv.rooms.forEach((room) => { if (!room.cam) return; const g = new THREE.Group(); g.add(new THREE.Mesh(ring, pm), new THREE.Mesh(dot, pm)); g.rotation.x = -Math.PI / 2; g.position.set(room.cam.p[0], lv.y + 0.02, room.cam.p[1]); g.userData = { room, level: i }; pucks.add(g); }));
    const out = { group, layers, lights: lamps.concat(days), catcher, pucks };
    this.built.set(apt.id, out);
    return out;
  }

  async load(apt, opts = {}) {
    this.stopTour(); this.fly = null; this.ready = false;
    ui.loader.hidden = false; ui.loaderText.textContent = tr(this.M ? 'loadGeo' : 'loadTex');
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    if (!this.M) {
      this.M = makeMaterials(QUALITY);
      // miroirs et métaux reflètent un intérieur neutre plutôt que le ciel
      const room = this.env.pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      for (const k of ['mirror', 'steel', 'brass']) { this.M[k].envMap = room; this.M[k].envMapIntensity = k === 'mirror' ? 1.5 : 1; }
      ui.loaderText.textContent = tr('loadGeo'); await new Promise((r) => setTimeout(r, 30));
    }
    const prev = this.apt && this.built.get(this.apt.id);
    const cur = this.build(apt);
    if (prev) this.scene.remove(prev.group);
    this.scene.add(cur.group); cur.group.add(this.camera, this.reticle, this.hl);
    this.apt = apt; this.cur = cur; this.viewLevel = 0;
    // lumières d'appoint : un petit nombre de sources, réattribuées aux lampes ou aux baies les plus proches
    for (const p of this.pool) p.removeFromParent();
    this.pool = Array.from({ length: QUALITY.lights }, () => { const p = new THREE.PointLight(0xffffff, 0, 9, 1.6); cur.group.add(p); return p; });
    this.lightAt.set(1e9, 0, 0);
    ui.loaderText.textContent = tr('loadEnv'); await new Promise((r) => setTimeout(r, 30));
    cur.group.updateMatrixWorld(true);
    const lv = apt.levels[0], bb = lv.bounds;
    const c = cur.group.localToWorld(new THREE.Vector3((bb[0] + bb[2]) / 2, 1.5, (bb[1] + bb[3]) / 2));
    this.env.setSite(apt, this.M, c, Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 3);
    this.setHour(this.hour, true);
    this.fillUI();
    const room = opts.room && this.findRoom(opts.room);
    if (opts.mode === 'walk' || room) { const r = room || this.findRoom(apt.start.room); this.enterWalk(r.room, r.level, true); }
    else if (opts.mode === 'plan') this.setMode('plan', true);
    else this.setMode('orbit', true);
    this.ready = true; ui.loader.hidden = true; root.classList.add('is-ready'); this.dirty = true;
    window.__v3dReady = true;
  }

  findRoom(id) { for (let i = 0; i < this.apt.levels.length; i++) { const room = this.apt.levels[i].rooms.find((r) => r.id === id); if (room) return { room, level: i }; } return null; }
  roomAt(level, x, z) { return this.apt.levels[level].rooms.find((r) => r.rs.some((q) => x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3])); }

  /* ── Calques visibles : en maquette et en plan, on coupe le niveau regardé et on masque ce qui est au-dessus ── */
  applyView(cut) {
    for (const [name, g] of Object.entries(this.cur.layers)) {
      const m = /^L(\d)(:top)?$/.exec(name); let vis = true;
      if (cut) { if (m) { const i = +m[1]; vis = i < this.viewLevel || (i === this.viewLevel && !m[2]); } else if (name === 'ext:top' || name === 'ctx') vis = false; }
      g.visible = vis;
    }
    this.cur.catcher.visible = cut; this.cur.pucks.visible = !cut; this.env.setStudio(cut, !!this.composer);
    if (this.hl) this.hl.visible = false;
    this.cutView = cut; this.renderer.shadowMap.needsUpdate = true; this.lightAt.set(1e9, 0, 0); this.dirty = true;
  }

  orbitPose(plan) {
    const a = this.apt, lv = a.levels[this.viewLevel], bb = lv.bounds, y = lv.y;
    if (plan) { const cx = (bb[0] + bb[2]) / 2, cz = (bb[1] + bb[3]) / 2, span = Math.max(bb[2] - bb[0], (bb[3] - bb[1]) * this.camera.aspect * 1.05) / this.camera.aspect; const d = (span / 2) / Math.tan(rad(FOV_PLAN) / 2) * 1.12; return { target: new THREE.Vector3(cx, y, cz), pos: new THREE.Vector3(cx, y + d, cz + 0.01) }; }
    const t = new THREE.Vector3(...a.orbit.target); t.y += y;
    const dist = a.orbit.dist * (this.camera.aspect < 1 ? 1.55 : this.camera.aspect < 1.5 ? 1.2 : 1);
    return { target: t, pos: t.clone().add(new THREE.Vector3(0.25, 0.866, 0.433).multiplyScalar(dist)) };   // même point de vue que les axonométries du graphiste
  }

  setMode(mode, instant) {
    if (mode === 'walk') { const r = this.findRoom(this.apt.start.room); return this.enterWalk(this.lastRoom || r.room, this.lastRoom ? this.lastLevel : r.level, instant); }
    this.stopTour(); this.walk.path = null; this.walk.climbing = null;
    if (this.mode === 'walk') this.viewLevel = this.walk.level;
    this.mode = mode; this.applyView(true); this.syncUI();
    const pose = this.orbitPose(mode === 'plan');
    const done = () => {
      this.controls.target.copy(pose.target); this.controls.enabled = true;
      this.controls.enableRotate = mode === 'orbit'; this.controls.minPolarAngle = mode === 'plan' ? 0 : 0.05; this.controls.maxPolarAngle = mode === 'plan' ? 0.001 : 1.44;
      this.controls.minDistance = mode === 'plan' ? 14 : 5; this.controls.maxDistance = mode === 'plan' ? 150 : 70;
      this.controls.mouseButtons.LEFT = mode === 'plan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; this.controls.touches.ONE = mode === 'plan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
      this.controls.update(); this.dirty = true;
    };
    this.controls.enabled = false;
    this.flyTo({ pos: pose.pos, look: pose.target, fov: mode === 'plan' ? FOV_PLAN : FOV_ORBIT, dur: instant ? 0 : 1.5, done });
    this.showHint(mode === 'plan' ? 'hintPlan' : 'hintOrbit');
  }

  /* Entre dans une pièce à hauteur d'œil. */
  enterWalk(room, level, instant, at) {
    this.stopTour(); this.controls.enabled = false;
    const lv = this.apt.levels[level];
    let cam = room.cam || { p: room.at, t: [room.at[0] + 1, room.at[1]] };
    if (at && Math.hypot(at[0] - room.at[0], at[1] - room.at[1]) > 0.9) cam = { p: at, t: room.at };      // on entre là où l'on a cliqué, tourné vers le centre de la pièce
    const p = nearestFree(lv.nav, cam.p[0], cam.p[1], 2) || cam.p;
    this.lastRoom = room; this.lastLevel = level;
    const w = this.walk; Object.assign(w, { level, x: p[0], z: p[1], path: null, look: null, climbing: null, onArrive: null, riding: null, spin: null, floorY: undefined, liftLock: true });
    w.yaw = Math.atan2(p[0] - cam.t[0], p[1] - cam.t[1]); w.pitch = -0.04;
    const pos = new THREE.Vector3(p[0], lv.y + EYE, p[1]);
    const wasCut = this.mode !== 'walk';
    this.mode = 'walk'; this.viewLevel = level; this.syncUI();
    if (!wasCut || instant) this.applyView(false);
    this.flyTo({ pos, yaw: w.yaw, pitch: w.pitch, fov: FOV_WALK, dur: instant ? 0 : 1.7,
      step: () => { if (this.cutView && this.camera.position.y < lv.y + lv.h - 0.25) this.applyView(false); },
      done: () => { if (this.cutView) this.applyView(false); this.placeCamera(); this.updateHud(); if (!instant && !this.tour) this.lookAround(); } });
    this.showHint(room.id === 'ascenseur' ? 'hintLift' : touch ? 'hintWalkTouch' : 'hintWalk');
  }

  /* Transition de caméra : position, orientation (cible ou lacet/tangage) et focale. */
  flyTo({ pos, look, yaw, pitch, fov, dur = 1.4, step, done }) {
    const cam = this.camera, q0 = cam.quaternion.clone(), p0 = cam.position.clone(), f0 = cam.fov;
    const q1 = new THREE.Quaternion();
    if (look) { const m = new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)); q1.setFromRotationMatrix(m); }
    else q1.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    const apply = (t) => { const k = ease(t); cam.position.lerpVectors(p0, pos, k); cam.quaternion.slerpQuaternions(q0, q1, k); cam.fov = f0 + (fov - f0) * k; cam.updateProjectionMatrix(); if (step) step(); this.dirty = true; };
    if (dur <= 0) { apply(1); this.fly = null; if (done) done(); return; }
    this.fly = { t: 0, dur, apply, done };
  }

  placeCamera() {
    const w = this.walk, lv = this.apt.levels[w.level];
    this.camera.position.set(w.x, (w.floorY !== undefined ? w.floorY : lv.y) + EYE, w.z);
    this.camera.rotation.set(w.pitch, w.yaw, 0, 'YXZ'); this.dirty = true;
  }

  /* ── Lumière ─────────────────────────────────────────────────────────────── */
  setHour(h, force) {
    this.hour = h;
    this.night = this.env.setHour(h);
    const n = this.night, M = this.M;
    M.lampShade.emissiveIntensity = n * 1.25; M.led.emissiveIntensity = n * 1.5;
    M.glass.opacity = 0.07 + n * 0.1;
    if (this.bloom) this.bloom.strength = 0.06 + n * 0.16;
    this.lightAt.set(1e9, 0, 0); this.dirty = true;
    const out = $('#v3d-time-out'); if (out) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); out.textContent = `${hh} h ${String(mm).padStart(2, '0')}`; }
    const range = $('#v3d-time'); if (range && Number(range.value) !== h) range.value = h;
    $$('[data-hour]').forEach((b) => b.classList.toggle('is-on', Math.abs(Number(b.dataset.hour) - h) < 0.26));
  }

  /* Réattribue les sources d'appoint aux lampes (le soir) ou aux baies (le jour) les plus proches du regard. */
  updateLights() {
    const focus = this.mode === 'walk' ? this.camera.position : this.controls.target;
    if (focus.distanceToSquared(this.lightAt) < 0.36) return;
    this.lightAt.copy(focus);
    const n = this.night, lvl = this.mode === 'walk' ? this.walk.level : this.viewLevel, wide = this.mode !== 'walk';
    const dayK = (1 - n) * clamp(this.env.dir.y * 3 + 0.25, 0.25, 1), list = [];
    for (const l of this.cur.lights) {
      if (this.cutView && l.level > this.viewLevel) continue;
      const k = l.day ? dayK * 3 : n * 4.2; if (k < 0.05) continue;
      const d2 = l.pos.distanceToSquared(focus) + (l.level === lvl ? 0 : 60);
      list.push({ l, s: (l.power * k) / (1 + d2 / (wide ? 900 : 30)), k });
    }
    list.sort((a, b) => b.s - a.s);
    this.pool.forEach((p, i) => {
      const it = list[i];
      if (!it) { p.intensity = 0; return; }
      p.position.copy(it.l.pos); p.intensity = it.l.power * it.k; p.distance = it.l.day ? 9 : 7.5;
      p.color.set(it.l.day ? 0xfff4e2 : 0xffc98a);
    });
  }

  /* ── Déplacements à hauteur d'œil ───────────────────────────────────────── */
  walkTo(x, z, look, onArrive) {
    const w = this.walk, nav = this.apt.levels[w.level].nav;
    const path = findPath(nav, [w.x, w.z], [x, z]);
    if (!path) return false;
    w.path = path.slice(1); w.look = look || null; w.onArrive = onArrive || null; return true;
  }

  /* Va dans une pièce, en empruntant l'escalier si elle est à l'autre niveau. */
  goToRoom(room, level, onArrive) {
    if (this.mode !== 'walk') { this.enterWalk(room, level); if (onArrive) this.walk.onArrive = onArrive; this.lastRoom = room; this.lastLevel = level; return; }
    const w = this.walk, cam = room.cam || { p: room.at, t: room.at };
    this.lastRoom = room; this.lastLevel = level;
    const end = () => { if (onArrive) onArrive(); else if (!this.tour) this.lookAround(); };
    const arrive = () => { if (!this.walkTo(cam.p[0], cam.p[1], cam.t, end)) { Object.assign(w, { x: cam.p[0], z: cam.p[1] }); this.placeCamera(); end(); } };
    w.spin = null;
    if (w.climbing) return;
    if (level === w.level) return arrive();
    const st = this.apt.stair, up = level > w.level, foot = up ? st.path[0] : st.path[st.path.length - 1];
    if (!this.walkTo(foot[0], foot[1], null, () => this.climb(up, arrive))) this.climb(up, arrive);
  }

  /* Tour d'horizon : la vue pivote doucement d'un tour complet ; le moindre geste l'arrête. */
  lookAround() { const w = this.walk; if (this.mode !== 'walk' || w.climbing || w.riding) return; w.path = null; w.look = null; w.spin = { left: Math.PI * 2 }; }

  /* Ascenseur : fondu, changement de niveau, sortie de la cabine. */
  ride() {
    const w = this.walk, to = w.level ? 0 : 1; w.path = null; w.look = null; w.spin = null; w.riding = { t: 0, to, done: false };
    ui.fade.classList.add('is-on'); const c = $('#v3d-caption'); c.hidden = false; c.textContent = tr('lift') + ' · ' + this.apt.levels[to].name[lang()]; c.classList.remove('is-in'); void c.offsetWidth; c.classList.add('is-in');
  }

  climb(up, then) {
    const st = this.apt.stair, pts = up ? st.path : st.path.slice().reverse(), base = this.apt.levels[0].y;
    const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const w = this.walk; w.path = null; w.look = null;
    w.climbing = { pts, len, d: 0, base, then, to: up ? 1 : 0 };
  }

  updateWalk(dt) {
    const w = this.walk, lv = this.apt.levels[w.level], nav = lv.nav;
    let moved = false;
    const turnTo = (yaw, rate) => { let d = yaw - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * rate); if (Math.abs(d) > 1e-3) moved = true; };
    const idle = performance.now() - w.dragAt > 1400;
    if (w.riding) {
      const r = w.riding; r.t += dt;
      if (!r.done && r.t > 0.6) { r.done = true; w.level = r.to; w.floorY = undefined; w.yaw = 0; w.pitch = -0.03; this.viewLevel = w.level; this.syncUI(); this.lightAt.set(1e9, 0, 0); this.placeCamera(); ui.fade.classList.remove('is-on'); }
      if (r.t > 1.25) { w.riding = null; w.liftLock = true; const e = this.apt.lift.exits[w.level]; this.walkTo(e[0], e[1]); }
      this.dirty = true; return;
    }
    if (w.spin && !w.path && !w.climbing) { if (!idle) w.spin = null; else { const a = Math.min(w.spin.left, dt * 0.4); w.yaw -= a; w.spin.left -= a; w.pitch += (-0.04 - w.pitch) * Math.min(1, dt * 2); moved = true; if (w.spin.left <= 0) w.spin = null; } }
    if (w.climbing) {
      const c = w.climbing; c.d = Math.min(c.len[c.len.length - 1], c.d + dt * 1.7);
      let i = 1; while (i < c.len.length - 1 && c.len[i] < c.d) i++;
      const t = (c.d - c.len[i - 1]) / Math.max(1e-4, c.len[i] - c.len[i - 1]), a = c.pts[i - 1], b = c.pts[i];
      w.x = a[0] + (b[0] - a[0]) * t; w.z = a[1] + (b[1] - a[1]) * t; w.floorY = c.base + a[2] + (b[2] - a[2]) * t;
      if (idle) { turnTo(Math.atan2(a[0] - b[0], a[1] - b[1]), 4); w.pitch += ((b[2] > a[2] ? 0.16 : b[2] < a[2] ? -0.3 : -0.04) - w.pitch) * Math.min(1, dt * 3); }
      moved = true;
      if (c.d >= c.len[c.len.length - 1]) { w.level = c.to; w.floorY = undefined; w.climbing = null; this.viewLevel = w.level; this.syncUI(); this.lightAt.set(1e9, 0, 0); if (c.then) c.then(); }
    } else if (w.path && w.path.length) {
      const tgt = w.path[0], dx = tgt[0] - w.x, dz = tgt[1] - w.z, d = Math.hypot(dx, dz), stepLen = dt * (this.tour ? 1.9 : 2.5);
      if (d <= stepLen) { w.x = tgt[0]; w.z = tgt[1]; w.path.shift(); } else { w.x += (dx / d) * stepLen; w.z += (dz / d) * stepLen; }
      if (idle && d > 0.05) { turnTo(Math.atan2(-dx, -dz), 3.2); w.pitch += (-0.04 - w.pitch) * Math.min(1, dt * 2); }
      moved = true;
      if (!w.path.length) { w.path = null; if (!w.look && w.onArrive) { const f = w.onArrive; w.onArrive = null; f(); } }
    } else if (w.look) {
      const yaw = Math.atan2(w.x - w.look[0], w.z - w.look[1]); let d = yaw - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (!idle || Math.abs(d) < 0.01) { w.look = null; if (w.onArrive) { const f = w.onArrive; w.onArrive = null; f(); } } else { turnTo(yaw, 2.6); w.pitch += (-0.05 - w.pitch) * Math.min(1, dt * 2); }
    }
    // clavier
    if (!w.climbing && this.keys.size) {
      let f = 0, s = 0, r = 0;
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) f += 1; if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) f -= 1;
      if (this.keys.has('KeyA')) s -= 1; if (this.keys.has('KeyD')) s += 1;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyQ')) r += 1; if (this.keys.has('ArrowRight') || this.keys.has('KeyE')) r -= 1;
      if (f || s || r) {
        this.stopTour(); w.path = null; w.look = null; w.onArrive = null; w.spin = null;
        w.yaw += r * dt * 1.7;
        const sp = dt * (this.keys.has('ShiftLeft') ? 3.6 : 2.2), fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw);
        const nx = w.x + (fx * f - fz * s) * sp, nz = w.z + (fz * f + fx * s) * sp;
        if (cellFree(nav, nx, nz)) { w.x = nx; w.z = nz; } else if (cellFree(nav, nx, w.z)) w.x = nx; else if (cellFree(nav, w.x, nz)) w.z = nz;
        moved = true;
      }
    }
    // pied de l'escalier : on monte ou on descend en marchant dessus
    const st = this.apt.stair;
    if (st && !w.climbing && !this.fly) {
      const m = w.level === 0 ? st.m0 : st.m1;
      if (w.x > m[0] && w.x < m[1] && w.z < m[2]) { const then = w.onArrive; w.onArrive = null; this.climb(w.level === 0, then); }
    }
    // cabine de l'ascenseur : y entrer change de niveau
    const lf = this.apt.lift;
    if (lf && !w.climbing && !this.fly) {
      const inside = w.x > lf.x0 && w.x < lf.x1 && w.z > lf.y0 + 0.35 && w.z < lf.y1;
      if (!inside) w.liftLock = false; else if (!w.liftLock && !w.path) { this.stopTour(); this.ride(); }
    }
    if (moved) { this.placeCamera(); this.updateHud(); }
  }

  updateHud() {
    const w = this.walk, r = this.roomAt(w.level, w.x, w.z), name = r ? r[lang()] : tr('outside');
    if (ui.hud.dataset.v !== name) { ui.hud.dataset.v = name; ui.hud.textContent = name; $$('#v3d-rooms [data-room]').forEach((b) => b.classList.toggle('is-here', !!r && b.dataset.room === r.id && +b.dataset.level === w.level)); }
    for (const g of this.cur.pucks.children) g.visible = g.userData.level === w.level && g.userData.room !== r && Math.hypot(g.position.x - w.x, g.position.z - w.z) > 0.9;
    this.drawMap();
  }

  /* ── Visite guidée : enchaîne les pièces principales, niveau par niveau ── */
  startTour() {
    const stops = []; this.apt.levels.forEach((lv, i) => (lv.tour || []).forEach((id) => { const room = lv.rooms.find((r) => r.id === id); if (room) stops.push({ room, level: i }); }));
    this.tour = { stops, i: -1, wait: 0 }; root.classList.add('is-touring'); this.syncUI();
    const next = () => {
      if (!this.tour) return; this.tour.i++;
      if (this.tour.i >= stops.length) return this.stopTour();
      const s = stops[this.tour.i]; this.showCaption(s.room);
      this.goToRoom(s.room, s.level, () => { if (this.tour) this.tour.wait = 3.4; });
    };
    this.tour.next = next;
    if (this.mode !== 'walk') { const s = stops[0]; this.tour.i = 0; this.showCaption(s.room); this.enterWalk(s.room, s.level); this.tour = { stops, i: 0, wait: 5.2, next }; root.classList.add('is-touring'); this.syncUI(); } else next();
  }
  stopTour() { if (!this.tour) return; this.tour = null; root.classList.remove('is-touring'); $('#v3d-caption').hidden = true; this.syncUI(); }
  showCaption(room) { const c = $('#v3d-caption'); c.hidden = false; c.textContent = room[lang()]; c.classList.remove('is-in'); void c.offsetWidth; c.classList.add('is-in'); }

  /* ── Mini-plan (visite libre) ───────────────────────────────────────────── */
  drawMap() {
    const cv = ui.map; if (!cv || this.mode !== 'walk') return;
    const lv = this.apt.levels[this.walk.level], bb = lv.bounds, W = cv.width, H = cv.height, g = cv.getContext('2d');
    const s = Math.min(W / (bb[2] - bb[0]), H / (bb[3] - bb[1])) * 0.94, ox = (W - (bb[2] - bb[0]) * s) / 2 - bb[0] * s, oy = (H - (bb[3] - bb[1]) * s) / 2 - bb[1] * s;
    this.mapT = { s, ox, oy };
    g.clearRect(0, 0, W, H);
    const cur = this.roomAt(this.walk.level, this.walk.x, this.walk.z);
    for (const r of lv.rooms) { g.fillStyle = r === cur ? 'rgba(184,98,72,0.34)' : r.id === 'jardin' ? 'rgba(107,124,69,0.28)' : 'rgba(249,245,236,0.92)'; for (const q of r.rs) g.fillRect(ox + q[0] * s, oy + q[1] * s, (q[2] - q[0]) * s, (q[3] - q[1]) * s); }
    g.fillStyle = '#7b4538';
    for (const w of lv.walls) {
      let a = w.a0; const seg = (a0, a1) => { if (a1 - a0 < 0.01) return; if (w.k === 'h') g.fillRect(ox + a0 * s, oy + (w.c - w.t / 2) * s, (a1 - a0) * s, Math.max(1.5, w.t * s)); else g.fillRect(ox + (w.c - w.t / 2) * s, oy + a0 * s, Math.max(1.5, w.t * s), (a1 - a0) * s); };
      for (const o of (w.ops || []).slice().sort((p, q) => p.a0 - q.a0)) { seg(a, o.a0); a = o.a1; } seg(a, w.a1);
    }
    const px = ox + this.walk.x * s, pz = oy + this.walk.z * s, yaw = this.walk.yaw;
    g.fillStyle = 'rgba(184,98,72,0.25)'; g.beginPath(); g.moveTo(px, pz); g.arc(px, pz, 26, -Math.PI / 2 - yaw - 0.6, -Math.PI / 2 - yaw + 0.6); g.closePath(); g.fill();
    g.fillStyle = '#b86248'; g.beginPath(); g.arc(px, pz, 4.5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
  }

  /* ── Étiquettes des pièces (maquette et plan) ───────────────────────────── */
  makeLabels() {
    ui.labels.textContent = ''; this.labelEls = [];
    this.apt.levels.forEach((lv, i) => lv.rooms.forEach((room) => {
      if (room.hidden) return;
      const el = document.createElement('button'); el.type = 'button'; el.className = 'v3d-label' + (room.minor ? ' is-minor' : ''); el.textContent = room[lang()];
      if (room.m2) { const sm = document.createElement('small'); sm.textContent = room.m2.toLocaleString(lang() === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: 1 }) + ' m²'; el.appendChild(sm); }
      el.addEventListener('click', () => this.goToRoom(room, i));
      ui.labels.appendChild(el); this.labelEls.push({ el, room, level: i, v: new THREE.Vector3(room.at[0], lv.y + 0.9, room.at[1]) });
    }));
  }
  updateLabels() {
    const show = this.mode !== 'walk' && !this.fly; ui.labels.hidden = !show; if (!show) return;
    const w = root.clientWidth, h = root.clientHeight, v = new THREE.Vector3();
    for (const L of this.labelEls) {
      if (L.level !== this.viewLevel) { L.el.hidden = true; continue; }
      v.copy(L.v); this.cur.group.localToWorld(v); v.project(this.camera);
      const ok = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05; L.el.hidden = !ok;
      if (ok) L.el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px)`;
    }
  }

  /* ── Interface ──────────────────────────────────────────────────────────── */
  fillUI() {
    const a = this.apt, L = lang();
    const cta = $('#v3d-cta'); if (cta) cta.href = (L === 'en' ? '/en/contact' : '/contact') + '?bien=' + a.bien;
    const lvBox = $('#v3d-levels'); lvBox.textContent = ''; lvBox.hidden = a.levels.length < 2;
    a.levels.forEach((lv, i) => { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = lv.name[L]; bt.dataset.level = i; bt.addEventListener('click', () => this.setLevel(i)); lvBox.appendChild(bt); });
    $$('[data-apt]').forEach((b) => { const on = b.dataset.apt === a.id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    root.dataset.levels = a.levels.length;
    this.roomsLevel = -1; this.makeLabels(); this.syncUI();
  }
  /* Bandeau des pièces : une pastille par pièce du niveau affiché ; un clic y fait entrer. */
  fillRooms(level) {
    const L = lang(), box = $('#v3d-rooms'); box.textContent = ''; this.roomsLevel = level;
    this.apt.levels[level].rooms.forEach((room) => {
      const bt = document.createElement('button'); bt.type = 'button'; bt.dataset.room = room.id; bt.dataset.level = level; bt.textContent = room[L];
      if (room.m2) { const sm = document.createElement('small'); sm.textContent = room.m2.toLocaleString(L === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: 1 }) + ' m²'; bt.appendChild(sm); }
      bt.addEventListener('click', () => { this.stopTour(); this.goToRoom(room, level); });
      bt.addEventListener('pointerenter', () => { if (this.mode !== 'walk') this.highlight(room, level); }); bt.addEventListener('pointerleave', () => this.highlight(null));
      box.appendChild(bt);
    });
  }
  highlight(room, level) {
    if (room === this.hlRoom) return; this.hlRoom = room; this.dirty = true;
    for (const L of this.labelEls) L.el.classList.toggle('is-hover', !!room && L.room === room);
    if (!room || this.mode === 'walk' || level !== this.viewLevel) { this.hl.visible = false; canvas.style.cursor = ''; return; }
    const y = this.apt.levels[level].y + 0.035;
    this.hl.children.forEach((m, i) => { const q = room.rs[i]; m.visible = !!q; if (q) { m.position.set((q[0] + q[2]) / 2, y, (q[1] + q[3]) / 2); m.scale.set(q[2] - q[0], q[3] - q[1], 1); } });
    this.hl.visible = true; canvas.style.cursor = 'pointer';
  }
  setLevel(i) {
    if (this.mode === 'walk') { const lv = this.apt.levels[i], room = lv.rooms.find((r) => r.id === (i ? 'palier' : this.apt.start.room)) || lv.rooms[0]; this.stopTour(); return this.goToRoom(room, i); }
    this.viewLevel = i; this.setMode(this.mode);
  }
  syncUI() {
    $$('[data-mode]').forEach((b) => { const on = b.dataset.mode === this.mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    $$('#v3d-levels button').forEach((b) => { const on = +b.dataset.level === (this.mode === 'walk' ? this.walk.level : this.viewLevel); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    root.dataset.mode = this.mode;
    const lvNow = this.mode === 'walk' ? this.walk.level : this.viewLevel; if (this.apt && this.roomsLevel !== lvNow) this.fillRooms(lvNow);
    const tb = $('#v3d-tour'); if (tb) { tb.classList.toggle('is-on', !!this.tour); $('span', tb).textContent = tr(this.tour ? 'tourStop' : 'tourPlay'); }
    if (this.mode === 'walk') this.updateHud();
  }
  showHint(key) { ui.hint.textContent = tr(key); ui.hint.classList.remove('is-in'); void ui.hint.offsetWidth; ui.hint.classList.add('is-in'); }

  bind() {
    const w = this.walk; let down = null;
    const local = (e) => { const r = canvas.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const floorHit = (e) => {                                   // point du sol visé, sur le niveau courant
      local(e); this.ray.setFromCamera(this.ptr, this.camera);
      const lv = this.apt.levels[w.level], o = this.cur.group.worldToLocal(this.ray.ray.origin.clone()), d = this.ray.ray.direction.clone().transformDirection(this.cur.group.matrixWorld.clone().invert());
      if (d.y > -0.02) return null; const t = (lv.y - o.y) / d.y; if (t < 0 || t > 16) return null;
      const p = nearestFree(lv.nav, o.x + d.x * t, o.z + d.z * t, 0.5); return p ? { p, y: lv.y } : null;
    };
    let od = null;
    const pick = (e) => {                                        // pièce visée sur la maquette ou le plan
      if (!this.apt || this.fly) return null; local(e); this.ray.setFromCamera(this.ptr, this.camera);
      const lv = this.apt.levels[this.viewLevel], o = this.ray.ray.origin, d = this.ray.ray.direction; if (d.y > -0.01) return null;
      const t = (lv.y - o.y) / d.y, x = o.x + d.x * t, z = o.z + d.z * t, room = this.roomAt(this.viewLevel, x, z);
      return room ? { room, p: [x, z] } : null;
    };
    canvas.addEventListener('pointerdown', (e) => { if (this.mode !== 'walk') { od = { x: e.clientX, y: e.clientY }; return; } w.spin = null; canvas.setPointerCapture(e.pointerId); down = { x: e.clientX, y: e.clientY, yaw: w.yaw, pitch: w.pitch, moved: false, id: e.pointerId }; });
    canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'walk') { if (!e.buttons && !touch) { const h = pick(e); this.highlight(h ? h.room : null, this.viewLevel); } return; }
      if (down && down.id === e.pointerId) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
        if (down.moved) { const k = (this.camera.fov / 70) * 0.0042; w.yaw = down.yaw + dx * k; w.pitch = clamp(down.pitch + dy * k, -1.1, 1.0); w.dragAt = performance.now(); w.look = null; this.reticle.visible = false; this.placeCamera(); }
      } else if (!touch && !w.climbing) { const h = floorHit(e); this.reticle.visible = !!h; if (h) this.reticle.position.set(h.p[0], h.y + 0.02, h.p[1]); this.dirty = true; }
    });
    const up = (e) => {
      if (this.mode !== 'walk') { const o = od; od = null; if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) < 7) { const h = pick(e); if (h) { this.highlight(null); this.enterWalk(h.room, this.viewLevel, false, h.p); } } return; }
      if (!down || down.id !== e.pointerId) return; const d = down; down = null;
      if (this.mode !== 'walk' || d.moved || w.climbing) return;
      const h = floorHit(e); if (h) { this.stopTour(); this.walkTo(h.p[0], h.p[1]); }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { down = null; });
    canvas.addEventListener('pointerleave', () => { this.reticle.visible = false; this.highlight(null); this.dirty = true; });
    canvas.addEventListener('wheel', (e) => { if (this.mode !== 'walk') return; e.preventDefault(); this.camera.fov = clamp(this.camera.fov + e.deltaY * 0.03, 38, 84); this.camera.updateProjectionMatrix(); this.dirty = true; }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      const rect = root.getBoundingClientRect(); if (rect.bottom < 80 || rect.top > innerHeight - 80) return;
      if (this.mode === 'walk' && /^(Arrow|Key[WASDQE])/.test(e.code)) { this.keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); }   // e.code = position physique : ZQSD sur un clavier AZERTY
      if (e.code === 'ShiftLeft') this.keys.add('ShiftLeft');
      if (e.key === 'Escape') { this.stopTour(); if (document.fullscreenElement) document.exitFullscreen(); }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    addEventListener('blur', () => this.keys.clear());
    // commandes
    $$('[data-mode]').forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode)));
    $$('[data-apt]').forEach((b) => b.addEventListener('click', () => { const a = APARTMENTS.find((x) => x.id === b.dataset.apt); if (a && a !== this.apt) { this.lastRoom = null; this.load(a); } }));
    $('#v3d-tour').addEventListener('click', () => (this.tour ? this.stopTour() : this.startTour()));
    $('#v3d-time').addEventListener('input', (e) => this.setHour(Number(e.target.value)));
    $$('[data-hour]').forEach((b) => b.addEventListener('click', () => this.animHour(Number(b.dataset.hour))));
    const fl = $('#v3d-floors');
    FLOOR_FINISHES.forEach((f, i) => { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'v3d-swatch' + (i ? '' : ' is-on'); bt.style.setProperty('--sw', f.sw); bt.dataset.floor = f.id; bt.title = f[lang()]; bt.setAttribute('aria-label', f[lang()]); bt.addEventListener('click', () => { setFloorFinish(this.M, f.id); $$('.v3d-swatch').forEach((x) => x.classList.toggle('is-on', x === bt)); $('#v3d-floor-out').textContent = f[lang()]; this.dirty = true; }); fl.appendChild(bt); });
    $('#v3d-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen(); else root.classList.toggle('is-fake-full'); });
    $('#v3d-look').addEventListener('click', () => this.lookAround());
    $('#v3d-panel-toggle').addEventListener('click', () => root.classList.toggle('is-panel-open'));
    ui.map.addEventListener('click', (e) => { if (!this.mapT) return; const r = ui.map.getBoundingClientRect(), k = ui.map.width / r.width, x = ((e.clientX - r.left) * k - this.mapT.ox) / this.mapT.s, z = ((e.clientY - r.top) * k - this.mapT.oy) / this.mapT.s; this.stopTour(); this.walkTo(x, z); });
    document.addEventListener('59c:langchange', () => { if (!this.apt) return; this.fillUI(); if (this.mode === 'walk') this.updateHud(); $$('.v3d-swatch').forEach((b) => { const f = FLOOR_FINISHES.find((x) => x.id === b.dataset.floor); b.title = f[lang()]; b.setAttribute('aria-label', f[lang()]); if (b.classList.contains('is-on')) $('#v3d-floor-out').textContent = f[lang()]; }); });
    document.addEventListener('visibilitychange', () => { this.clock.getDelta(); });
  }
  animHour(to) { const from = this.hour, t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / 1400); this.setHour(from + (to - from) * ease(k)); if (k < 1) requestAnimationFrame(step); }; step(); }

  /* Avance la simulation de dt secondes (transitions de caméra, marche, visite guidée). */
  tick(dt) {
    if (this.fly) { const f = this.fly; f.t += dt / f.dur; f.apply(Math.min(1, f.t)); if (f.t >= 1) { this.fly = null; if (f.done) f.done(); } }
    else if (this.mode === 'walk') {
      this.updateWalk(dt);
      if (this.tour && this.tour.wait > 0 && !this.walk.path && !this.walk.look && !this.walk.climbing) { this.tour.wait -= dt; this.walk.yaw += dt * 0.07; this.placeCamera(); if (this.tour.wait <= 0) this.tour.next(); }
    } else this.controls.update();
  }

  frame() {
    requestAnimationFrame(() => this.frame());
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.ready || document.hidden) return;
    this.tick(dt);
    if (!this.dirty) return; this.dirty = false;
    this.updateLights(); this.updateLabels();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}

/* ── Démarrage ────────────────────────────────────────────────────────────── */
function start() {
  window.__v3dBoot = true;
  // lien venant des pages anglaises (?lang=en) : translations.js, chargé avant ce module, fournit setLang()
  if (params.get('lang') === 'en' && window.setLang) window.setLang('en');
  let app;
  try { app = new App(); } catch (err) {
    console.error(err); ui.loader.hidden = true; const f = $('#v3d-fallback'); f.hidden = false; $('p', f).textContent = tr('nogl'); root.classList.add('is-nogl'); return;
  }
  window.__v3d = app;
  const bien = params.get('bien') || '', apt = APARTMENTS.find((a) => a.bien === bien || a.id === bien) || APARTMENTS[0];
  const mode = { visite: 'walk', walk: 'walk', plan: 'plan' }[params.get('mode') || ''];
  app.load(apt, { mode, room: params.get('piece') }).catch((e) => { console.error(e); ui.loaderText.textContent = String(e.message || e); });
  app.frame();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
