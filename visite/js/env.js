/* 59 Cézanne — visite 3D : ciel, soleil, lumière selon l'heure, paysage lointain (collines, Sainte-Victoire à l'Est) et étalonnage final.
   Repère du monde : +x = Est, +z = Sud, y = altitude. */
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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
const Y = new THREE.Vector3(0, 1, 0);

/* ── Brouillard avant la courbe de tons ───────────────────────────────────────
   Par défaut, three.js applique le brouillard après la courbe de tons (donc sans exposition ni contraste) quand on rend à l'écran, et avant
   quand on passe par la chaîne de post-traitement : le même paysage n'aurait pas le même voile selon la qualité. On l'applique toujours
   avant, dans l'espace linéaire, comme le ciel : les collines se fondent dans l'horizon quelle que soit la chaîne. */
THREE.ShaderChunk.tonemapping_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogF = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogF = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogF );
#endif
#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`;
THREE.ShaderChunk.fog_fragment = '';

/* ── Palette du ciel selon la hauteur du soleil (degrés) : zénith, ciel moyen, horizon ─────────── */
const hex = (s) => new THREE.Color(s);
const SKY_STOPS = [
  [-18, '#04070e', '#070c18', '#0d1426'],
  [-10, '#0b132b', '#17224a', '#2f3560'],
  [-4, '#1f3366', '#4a5f96', '#c97c78'],
  [2, '#2f528f', '#6f8cbf', '#f0a877'],
  [9, '#386ab4', '#82a8d8', '#f1cba0'],
  [22, '#3774c6', '#8ab4e6', '#d3e2f0'],
  [45, '#2a6ac4', '#80b2e8', '#c6dcf0'],
].map(([a, z, m, h]) => [a, hex(z), hex(m), hex(h)]);
const SUN_STOPS = [[-3, '#ff6a2e'], [3, '#ff9448'], [9, '#ffbb78'], [18, '#ffd9aa'], [32, '#fff0dc'], [60, '#fff6ea']].map(([a, c]) => [a, hex(c)]);

function ramp(stops, a, i0, out) {                          // interpolation par morceaux, adoucie, entre les paliers
  let k = 0; while (k < stops.length - 2 && a > stops[k + 1][0]) k++;
  const t = smooth(stops[k][0], stops[k + 1][0], a);
  return out.copy(stops[k][i0]).lerp(stops[k + 1][i0], t);
}

/* ── Ciel : dégradé, diffusion autour du soleil, nuages doux, lune ───────────────────────────── */
const SKY_VERT = `varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 ); gl_Position = p.xyww; }`;
const SKY_FRAG = `varying vec3 vDir;
uniform vec3 uSun, uMoon, uZen, uMid, uHor, uGnd, uSunCol, uGlow, uCloudLit, uCloudShade;
uniform float uNight, uGain, uCloudAmt, uWarm;
uniform sampler2D uCloud;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
void main() {
	vec3 d = normalize( vDir );
	float h = max( d.y, 0.0 ), mu = max( dot( d, uSun ), 0.0 );
	vec3 col = mix( uHor, uMid, smoothstep( 0.0, 0.2, h ) );
	col = mix( col, uZen, smoothstep( 0.16, 0.95, h ) );
	// côté du soleil : l'horizon rougit (diffusion à bas angle)
	vec2 hs = normalize( uSun.xz + 1e-5 ), hd = normalize( d.xz + 1e-5 );
	col += uGlow * uWarm * 0.55 * pow( max( dot( hs, hd ), 0.0 ), 3.0 ) * pow( 1.0 - h, 6.0 );
	// halo de diffusion avant (Mie) autour du soleil
	float g = 0.78, hg = ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * mu, 1.5 );
	col += uGlow * ( 0.012 * hg + 0.16 * pow( mu, 4.0 ) ) * ( 1.0 - uNight );
#ifdef ENV
	col = mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, 0.55 );     // rebonds multiples : l'éclairage de ciel dans une pièce est bien moins bleu que le ciel lui-même
	col = mix( col, uGnd, smoothstep( 0.0, -0.12, d.y ) );
#else
	col = mix( col, uHor, smoothstep( 0.0, -0.03, d.y ) );
	// nuages : couche plane projetée, ombrée côté soleil, estompée vers l'horizon
	if ( d.y > 0.01 && uCloudAmt > 0.01 ) {
		vec2 q = d.xz / ( d.y + 0.14 ) * 0.2 + vec2( 0.31, 0.47 );
		float n = texture2D( uCloud, q ).r * 0.7 + texture2D( uCloud, q * 2.7 + 0.13 ).r * 0.3;
		float cov = smoothstep( 1.0 - uCloudAmt, 1.0 - uCloudAmt + 0.2, n );
		#ifdef CLOUD_LIT
			vec2 sq = q + uSun.xz * 0.012;
			float ns = texture2D( uCloud, sq ).r * 0.7 + texture2D( uCloud, sq * 2.7 + 0.13 ).r * 0.3;
			float lit = clamp( 0.62 + ( n - ns ) * 6.0, 0.0, 1.0 );
		#else
			float lit = 0.7;
		#endif
		vec3 cc = mix( uCloudShade, uCloudLit, lit ) + uGlow * pow( mu, 6.0 ) * 0.5 * ( 1.0 - cov * 0.4 );
		col = mix( col, cc, cov * smoothstep( 0.01, 0.2, d.y ) * ( 1.0 - 0.92 * uNight ) );
	}
	// disque solaire, lune
	col += uSunCol * smoothstep( 0.99997, 0.999993, mu ) * ( 1.0 - uNight );
	float mm = dot( d, uMoon );
	col += vec3( 0.55, 0.62, 0.8 ) * ( smoothstep( 0.99988, 0.99993, mm ) * 1.6 + 0.05 * pow( max( mm, 0.0 ), 60.0 ) ) * uNight;
#endif
	col *= uGain;
#ifndef ENV
	col *= 1.0 + ( hash( gl_FragCoord.xy ) - 0.5 ) * 0.012;          // quelques niveaux de bruit : pas de bandes dans le dégradé
#endif
	gl_FragColor = vec4( col, 1.0 );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

function skyMaterial(env, cloudTex, lite) {
  const defines = env ? { ENV: '' } : lite ? {} : { CLOUD_LIT: '' };
  const u = {
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, 1, 0) },
    uZen: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color(0x6a5a44) },
    uSunCol: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() },
    uNight: { value: 0 }, uGain: { value: 2 }, uCloudAmt: { value: 0.4 }, uWarm: { value: 0 }, uCloud: { value: cloudTex },
  };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, defines, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false });
  m.depthFunc = THREE.LessEqualDepth;
  return m;
}

/* Texture de nuages : bruit de valeur à plusieurs octaves, qui se raccorde sur lui-même (aucun raccord visible). */
function cloudTexture(S = 256) {
  const R = rng(4242), octs = [], data = new Uint8Array(S * S * 4);
  for (let o = 0; o < 5; o++) { const P = 4 << o, g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = R(); octs.push([P, g]); }
  const f = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0, a = 0.5, tot = 0;
    for (const [P, g] of octs) {
      const fx = (x / S) * P, fy = (y / S) * P, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = f(fx - x0), ty = f(fy - y0), x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
      v += a * (g[y0 % P * P + x0 % P] * (1 - tx) * (1 - ty) + g[y0 % P * P + x1] * tx * (1 - ty) + g[y1 * P + x0 % P] * (1 - tx) * ty + g[y1 * P + x1] * tx * ty); tot += a; a *= 0.52;
    }
    v = Math.min(1, Math.max(0, ((v / tot) - 0.28) * 2.1));
    const k = (y * S + x) * 4; data[k] = data[k + 1] = data[k + 2] = Math.round(v * 255); data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

/* Sol lointain : mosaïque de forêts sombres, de prés et de champs ocre, en vue d'oiseau (le sol des collines n'est jamais vu de près). */
function groundTexture(S = 128) {
  const R = rng(909), data = new Uint8Array(S * S * 4), pts = [];
  const pal = [[74, 98, 60], [64, 88, 52], [88, 112, 66], [98, 120, 70], [120, 128, 78], [148, 138, 88], [58, 80, 50], [70, 94, 56]];
  for (let i = 0; i < 40; i++) pts.push([R() * S, R() * S, pal[(R() * pal.length) | 0], 0.8 + R() * 0.4]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let best = 1e9, c = pal[0], k = 1;
    for (const [px, py, col, s] of pts) { let dx = Math.abs(x - px), dy = Math.abs(y - py); dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy); const d = dx * dx + dy * dy; if (d < best) { best = d; c = col; k = s; } }
    const n = 0.88 + 0.24 * ((Math.sin(x * 0.9) * Math.sin(y * 1.3) + Math.sin(x * 0.37 + y * 0.21) + 2) / 4 + R() * 0.3), i = (y * S + x) * 4;
    data[i] = c[0] * k * n; data[i + 1] = c[1] * k * n; data[i + 2] = c[2] * k * n; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

/* ── Relief lointain ─────────────────────────────────────────────────────────────────────────── */
/* Profil de la Sainte-Victoire vue depuis Aix (de l'Ouest) : longue échine, sommet, falaise côté Sud. */
const SV = [[-1, 0.03], [-0.82, 0.07], [-0.66, 0.13], [-0.52, 0.2], [-0.4, 0.3], [-0.3, 0.44], [-0.22, 0.6], [-0.15, 0.76], [-0.09, 0.9], [-0.04, 0.975], [0, 1], [0.045, 0.95], [0.09, 0.93], [0.15, 0.86], [0.22, 0.8], [0.3, 0.7], [0.38, 0.6], [0.47, 0.52], [0.57, 0.43], [0.68, 0.33], [0.8, 0.22], [0.9, 0.12], [1, 0.04]];

const RIDGE_VERT = `attribute float aTop; varying float vTop; varying vec3 vP; uniform float uFogScale;
#include <fog_pars_vertex>
void main() { vTop = aTop; vP = position; vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
	vFogDepth *= uFogScale;
}`;
const RIDGE_FRAG = `varying float vTop; varying vec3 vP;
uniform vec3 uTop, uLow, uLight; uniform float uCell, uRock; uniform sampler2D uNoise;
#include <fog_pars_fragment>
void main() {
	vec2 p = vP.zy / ( uCell * 14.0 );
	float n = texture2D( uNoise, p ).r * 0.65 + texture2D( uNoise, p * 3.1 + 0.4 ).r * 0.35;        // houppiers : taches douces (texture filtrée), jamais plus fines que quelques pixels
	float cres = pow( vTop, 1.3 );
	vec3 c = mix( uLow, uTop, cres ) * ( 0.8 + 0.4 * n );
	c = mix( c, c * vec3( 1.12, 1.0, 0.9 ), uRock * smoothstep( 0.35, 0.9, vTop ) * n );             // falaise calcaire : plus claire, plus chaude
	gl_FragColor = vec4( c * uLight, 1.0 );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

/* Ruban vertical dont la crête suit un profil : une ligne de relief. */
function ridge(profile, noise, { dist, width, height, base, color, seed = 1, rough = 0.12, center = 0, cell = 18, rock = 0, fogScale = 1 }) {
  const R = rng(seed), pts = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [x0, h0] = profile[i], [x1, h1] = profile[i + 1], n = 6;
    for (let k = 0; k < n; k++) { const t = k / n; pts.push([x0 + (x1 - x0) * t, h0 + (h1 - h0) * t + (R() - 0.5) * rough * 0.2]); }
  }
  pts.push(profile[profile.length - 1]);
  const pos = [], top = [];
  const P = (u, h) => [dist, base + h * height, center + u * width / 2];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = P(pts[i][0], pts[i][1]), b2 = P(pts[i + 1][0], pts[i + 1][1]), a0 = [a[0], base - 60, a[2]], b0 = [b2[0], base - 60, b2[2]];
    pos.push(...a0, ...b0, ...b2, ...a0, ...b2, ...a);
    top.push(0, 0, 1, 0, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  const c = new THREE.Color(color);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTop: { value: c.clone() }, uLow: { value: c.clone().multiplyScalar(0.72) }, uLight: { value: new THREE.Color(1, 1, 1) }, uCell: { value: cell }, uRock: { value: rock }, uNoise: { value: noise }, uFogScale: { value: fogScale } }]),
    vertexShader: RIDGE_VERT, fragmentShader: RIDGE_FRAG, fog: true, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat);
  m.userData.base = color; m.frustumCulled = false;
  return m;
}
/* Houppier : sphère aux bords irréguliers (les normales restent celles de la sphère : ombrage doux, silhouette en touffes). */
function lumpyBlob(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.17 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.sin(v.z * 4.7 - v.x * 2.1) + 0.08 * Math.sin(v.y * 9.3 + v.z * 7.7);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  return g;
}
function hills(seed, n, amp) { const R = rng(seed), p = []; let h = 0.4 + R() * 0.3; for (let i = 0; i <= n; i++) { h = Math.min(1, Math.max(0.12, h + (R() - 0.5) * amp)); p.push([-1 + (2 * i) / n, h]); } return p; }

const _warm = new THREE.Color(1, 0.96, 0.9), _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color();

export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene; this.renderer = renderer; this.quality = quality;
    // ombres : 17 échantillons avec rayon en haute définition (pénombre de 1 à 2 cm, comme un vrai soleil), filtre bilinéaire sinon
    const hi = quality.shadow >= 4096;
    renderer.shadowMap.type = hi ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    const lite = !quality.ao && !quality.bloom;      // le plus léger (téléphones) : nuages sans ombrage propre, texture plus petite
    this.cloudTex = cloudTexture(lite ? 128 : 256);
    this.sky = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), skyMaterial(false, this.cloudTex, lite)); this.sky.frustumCulled = false; this.sky.renderOrder = 10;      // dessiné après le décor : seuls les pixels restés vides le paient
    scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const S = quality.shadow; this.sun.shadow.mapSize.set(S, S);
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = hi ? 0.02 : 0.03; this.sun.shadow.radius = hi ? 1.6 : 1;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xdfeaf5, 0xb8a888, 0.6); scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0xcfdbe6, 0.0008); scene.fog = this.fog;
    this.fog.color.getRGB = function (t) { t.r = this.r; t.g = this.g; t.b = this.b; return t; };      // couleur de brouillard fournie en linéaire (voir plus haut)
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene(); this.envSky = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), skyMaterial(true, this.cloudTex, lite)); this.envSky.frustumCulled = false; this.envScene.add(this.envSky);
    this.envRT = null; this.dir = new THREE.Vector3(); this.lightDir = new THREE.Vector3(); this.hour = 10; this.night = 0;
    this.moonDir = new THREE.Vector3(0.5, 0.66, 0.56).normalize();
    this.land = new THREE.Group(); this.near = new THREE.Group(); scene.add(this.land, this.near); this.theta = 0;
    this.ridges = [];
    this.center = new THREE.Vector3(); this.radius = 14;
    this.exposure = 0.55; this.post = {}; this.far = []; this.shadowDir = new THREE.Vector3(); this.envAlt = 99;
  }

  /* Paysage autour d'un logement : sol lointain, lignes de collines, Sainte-Victoire plein Est, arbres proches. */
  setSite(apt, M, center, radius) {
    this.center.copy(center); this.radius = radius;
    for (const g of [this.land, this.near]) for (const c of [...g.children]) { g.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.ridges.length = 0; this.far = [];
    // le plan du logement est tourné de `north` degrés par rapport au terrain : on fait pivoter le paysage et le soleil, pas le logement
    this.theta = THREE.MathUtils.degToRad(apt.north);
    this.land.position.set(center.x, 0, center.z); this.land.rotation.y = -this.theta;
    const gy = apt.groundY;
    const gtex = this.groundTex || (this.groundTex = groundTexture()); gtex.repeat.set(7, 7);
    const ground = this.ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 48), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, gy - 0.3, 0); ground.receiveShadow = false; ground.frustumCulled = false; this.land.add(ground);      // jamais écartés : texture, programme et géométrie sont envoyés dès la première image, pas quand on regarde dehors pour la première fois
    const near = new THREE.Mesh(new THREE.CircleGeometry(95, 40), M.earth.clone());
    near.material.map = M.earth.map.clone(); near.material.map.repeat.set(26, 26); near.material.map.needsUpdate = true;
    near.rotation.x = -Math.PI / 2; near.position.set(0, gy - 0.02, 0); near.receiveShadow = true; near.frustumCulled = false; this.land.add(near);
    this.renderer.initTexture(gtex); this.renderer.initTexture(this.cloudTex); this.renderer.initTexture(near.material.map);
    const add = (m, n) => { this.land.add(m); this.ridges.push(m); m.userData.n = n || new THREE.Vector3(-1, 0, 0); return m; };
    // de l'arrière-plan vers l'avant : massif, puis collines boisées de plus en plus proches
    add(ridge(SV, this.cloudTex, { dist: 1150, width: 700, height: 92, base: gy + 12, color: 0xb8b4cc, seed: 3, rough: 0.16, center: -40, cell: 46, rock: 1, fogScale: 0.62 })).userData.k = 1;
    add(ridge(hills(11, 22, 0.16), this.cloudTex, { dist: 1000, width: 2600, height: 46, base: gy + 4, color: 0x8fa294, seed: 5, cell: 60 }));
    add(ridge(hills(12, 30, 0.2), this.cloudTex, { dist: 640, width: 2000, height: 30, base: gy + 2, color: 0x6c8560, seed: 6, cell: 30 }));
    add(ridge(hills(13, 36, 0.24), this.cloudTex, { dist: 330, width: 1300, height: 17, base: gy + 1, color: 0x52713b, seed: 7, cell: 12 }));
    for (const [rot, s] of [[Math.PI / 2, 21], [Math.PI, 22], [-Math.PI / 2, 23]]) {       // horizon boisé sur les trois autres côtés
      const m = ridge(hills(s, 30, 0.22), this.cloudTex, { dist: 420, width: 1700, height: 26, base: gy + 1, color: 0x5a7544, seed: s, cell: 16 });
      m.rotation.y = rot; add(m, new THREE.Vector3(-Math.cos(rot), 0, Math.sin(rot)));
    }
    // arbres et toits du voisinage
    const b = new Batch(); b.on('land');
    const R = rng(apt.id.length * 97 + 5);
    const place = (x, z, kind, h) => {
      if (kind === 'cypress') V.cypress(b, M, x, z, { h, y: gy }); else V.tree(b, M, x, z, { kind, h, r: h * (kind === 'pine' ? 0.36 : 0.42), seed: Math.round(x * 7 + z * 13), y: gy });
    };
    for (const [px, pz, kind, h] of apt.trees || []) place(px, pz, kind, h);
    for (let i = 0; i < this.quality.trees; i++) {
      const a = R() * 6.283, d = 86 + R() * 120, x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, k = R();
      place(x, z, k < 0.55 ? 'pine' : k < 0.8 ? 'cypress' : 'olive', 6 + R() * 6);
    }
    for (let i = 0; i < 42; i++) {                                                          // maisons du quartier, toits de tuiles
      const a = R() * 6.283, d = 96 + Math.pow(R(), 0.8) * 330, x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, w = 9 + R() * 7, dd = 7 + R() * 5, rot = R() * 3;
      b.push(x, gy, z, rot); b.box(M.massing, -w / 2, 0, -dd / 2, w / 2, 5.5, dd / 2); b.geo(M.roof, new THREE.ConeGeometry(Math.max(w, dd) * 0.78, 2, 4), 0, 6.5, 0, 0, Math.PI / 4, 0, 1, 1, dd / w); b.pop();
    }
    const L = b.build(this.near);
    if (L.land) L.land.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    // la « mer d'arbres » du pays d'Aix : houppiers instanciés jusqu'aux premières collines. Les plus proches ont plus de facettes,
    // les lointains 80 triangles ; les pins parasols ont un tronc (sans lui, le houppier flotterait)
    const N = this.quality.forest, items = [];
    const pal = [0x8fae7c, 0x7a9c6c, 0xa3b88a, 0x6f8f62, 0xb4bf98, 0x86a674];      // teintes claires : elles multiplient la texture de feuillage
    for (let i = 0; i < N; i++) {
      const a = R() * 6.283, d = 98 + Math.pow(R(), 0.62) * 540, s = 2.4 + R() * 3.4, pine = R() < 0.6, rot = R() * 6.283, c = pal[(R() * pal.length) | 0], k = 0.8 + R() * 0.45;
      items.push({ d, x: center.x + Math.cos(a) * d, z: center.z + Math.sin(a) * d, s, pine, rot, c, k });
    }
    items.sort((p, q) => p.d - q.d);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), sc = new THREE.Vector3();
    const leaf = new THREE.MeshStandardMaterial({ roughness: 1, map: M.hedge.map, emissive: 0x22341a });      // un peu d'émission : le dessous des houppiers reçoit la lumière du sol, il ne tombe pas au noir
    const mk = (list, detail) => {
      const mesh = new THREE.InstancedMesh(lumpyBlob(detail), leaf, list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, t.rot); pos.set(t.x, gy + t.s * (t.pine ? 1.5 : 0.8), t.z); sc.set(t.s * (t.pine ? 1.35 : 1), t.s * (t.pine ? 0.6 : 0.95), t.s * (t.pine ? 1.35 : 1));
        mesh.setMatrixAt(i, m4.compose(pos, q, sc)); mesh.setColorAt(i, col.setHex(t.c).multiplyScalar(t.k));
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
      return mesh;
    };
    const cut = Math.round(N * 0.35);
    const fl = [mk(items.slice(0, cut), 2), mk(items.slice(cut), 1)]; this.near.add(...fl);
    const pines = items.filter((t) => t.pine);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 5, 1, true), new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 1 }), pines.length);
    pines.forEach((t, i) => { pos.set(t.x, gy + t.s * 0.75, t.z); sc.set(t.s * 0.5, t.s * 1.5, t.s * 0.5); trunks.setMatrixAt(i, m4.compose(pos, q.identity(), sc)); });
    trunks.instanceMatrix.needsUpdate = true; trunks.frustumCulled = false; this.near.add(trunks);
    this.far = [...this.ridges, ground, trunks, ...fl];      // décor lointain : écarté de la passe d'occlusion ambiante (il y deviendrait un voile sombre)
  }

  /* Branche les passes de post-traitement : leurs réglages suivent l'heure et l'exposition. */
  attachPost(post) { this.post = post || {}; this.applyExposure(this.exposure); }
  applyExposure(e) {
    this.exposure = e; this.renderer.toneMappingExposure = e;
    if (this.post.grade) this.post.grade.uniforms.uExp.value = e;
  }

  /* Heure du jour → soleil (ou lune), ciel, brouillard, ambiance. Renvoie le degré de « nuit » (0 = jour, 1 = nuit). */
  setHour(h) {
    this.hour = h;
    const d = sunDirection(h, this.dir), alt = d.userData.alt, deg = alt * 180 / Math.PI;
    const dLand = d.clone();                                        // direction dans le repère du paysage (celui des collines)
    d.applyAxisAngle(Y, -this.theta);
    const day = smooth(-4, 8, deg), golden = 1 - smooth(4, 28, deg), night = 1 - smooth(-9, 1, deg);
    this.night = night;
    const zen = ramp(SKY_STOPS, deg, 1, _c1).clone(), mid = ramp(SKY_STOPS, deg, 2, _c2).clone(), hor = ramp(SKY_STOPS, deg, 3, _c3).clone();
    const sunCol = ramp(SUN_STOPS, deg, 1, new THREE.Color());
    const sunI = 5.6 * smooth(-1.2, 7, deg) * lerp(0.8, 1, smooth(4, 30, deg));      // extinction atmosphérique : soleil bas plus faible
    const moonI = 0.85 * smooth(-4, -12, deg);
    const gain = lerp(2.1, 1.3, night);                                // rayonnement du ciel, en unités de la scène
    // ciel (visible) et ciel de l'environnement : mêmes couleurs
    const glow = sunCol.clone().multiplyScalar(lerp(0.9, 1.3, golden));
    const cloudLit = sunCol.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(lerp(1.15, 0.9, golden));
    const cloudShade = mid.clone().lerp(hor, 0.35).multiplyScalar(0.62);
    const sd = d.clone(); if (sd.y < -0.05) sd.y = -0.05;
    const moon = this.moonDir.clone().applyAxisAngle(Y, -this.theta);
    for (const m of [this.sky.material, this.envSky.material]) {
      const u = m.uniforms;
      u.uSun.value.copy(sd).normalize(); u.uMoon.value.copy(moon); u.uZen.value.copy(zen); u.uMid.value.copy(mid); u.uHor.value.copy(hor);
      u.uSunCol.value.copy(sunCol).multiplyScalar(60); u.uGlow.value.copy(glow); u.uNight.value = night; u.uGain.value = gain; u.uWarm.value = golden * day + (1 - day) * 0.4;
      u.uCloudLit.value.copy(cloudLit); u.uCloudShade.value.copy(cloudShade); u.uCloudAmt.value = lerp(0.42, 0.5, golden);
    }
    this.envSky.material.uniforms.uGnd.value.set(0xc6bdb0).multiplyScalar(lerp(0.9, 0.05, night) * lerp(1, 0.7, golden) * gain / 2);
    // lumière directe : le soleil, puis la lune quand il est couché (même projecteur, même ombre : rien ne traverse les murs)
    const moonOn = deg < -1.5;
    this.lightDir.copy(moonOn ? moon : d);
    if (moonOn) { this.sun.color.setRGB(0.62, 0.72, 1.0); this.sun.intensity = moonI; }
    else { this.sun.color.copy(sunCol); this.sun.intensity = sunI; }
    this.bounce = (this.bounce || new THREE.Color()).set(0xfff4e6).lerp(sunCol, 0.45 * golden);      // couleur du rebond des baies (utilisée par les lumières d'appoint)
    // lumière d'ambiance : le ciel au-dessus, le sol éclairé en dessous (rebond)
    const hs = zen.clone().lerp(hor, 0.55).lerp(new THREE.Color(1, 1, 1), lerp(0.82, 0.55, golden)), hg = new THREE.Color(0xe6ddd2).lerp(sunCol, 0.3 * golden).multiplyScalar(lerp(0.85, 0.3, night));
    this.hemi.color.copy(hs).multiply(_warm).lerp(new THREE.Color(0x1a2238), night); this.hemi.groundColor.copy(hg);
    this.hemi.intensity = lerp(0.14, 0.45, day) * lerp(1, 0.9, golden);
    // brouillard : celui de l'horizon, plus dense quand le soleil est bas
    this.fog.color.copy(hor).multiplyScalar(gain);
    this.fog.density = lerp(0.0011, 0.0015, golden);
    // relief : éclairé par le soleil selon son orientation (la Sainte-Victoire, vue de l'Ouest, est à contre-jour le matin et rose l'après-midi)
    for (const m of this.ridges) {
      const n = m.userData.n, lit = THREE.MathUtils.clamp(dLand.x * n.x + dLand.z * n.z, 0, 1) * smooth(-2, 10, deg), u = m.material.uniforms;
      u.uLight.value.copy(sunCol).multiplyScalar(0.62 * lit * lerp(1, 1.1, golden)).add(_c1.copy(mid).lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(0.5 * lerp(1, 0.16, night))).multiplyScalar(2.1);
    }
    // exposition : un peu plus ouverte quand la lumière baisse
    this.exposureTarget = lerp(0.92, 0.95, golden) + 0.06 * night;
    if (!this.studio) this.applyExposure(this.exposureTarget);
    // post-traitement : lueur discrète sur les points très lumineux, plus ample le soir
    const P = this.post;
    if (P.bloom) { P.bloom.strength = lerp(0.1, 0.24, night); P.bloom.threshold = lerp(2.6, 0.85, night); P.bloom.enabled = true; }
    if (P.grade) P.grade.uniforms.uVig.value = lerp(0.2, 0.32, night);
    this.placeSun();
    this.envK = lerp(1, 0.16, night); this.envDirty = true; this.envPending = true; this.envAlt = deg; this.hourAt = performance.now();
    if (!this.envRT) this.flushEnv();
    if (this.studio) this.studioLook();
    return night;
  }

  /* Fond de maquette : ni ciel ni paysage, un aplat pierre comme sur les planches du graphiste.
     Avec la chaîne de post-traitement, le fond passe par la courbe ACES : on la compense pour retrouver la teinte voulue. */
  setStudio(on, composer) {
    const was = this.studio; this.studio = on; this.studioComposer = composer;
    this.sky.visible = !on; this.land.visible = !on; this.near.visible = !on;
    this.scene.fog = on ? null : this.fog;
    if (this.post.grade) this.post.grade.enabled = !on;       // la maquette garde son rendu de graphiste : ni vignettage ni étalonnage
    if (!on) { this.scene.background = null; if (was) this.setHour(this.hour); return; }
    this.studioLook();
  }
  /* Lumière de maquette : soleil fixe venu du haut à gauche de l'image, ombres courtes et douces, ambiance claire ; le soir, elle baisse et les lampes prennent le relais. */
  studioLook() {
    const n = this.night || 0, composer = this.studioComposer;
    this.sun.visible = true; this.sun.color.setRGB(1 - n * 0.3, 0.975 - n * 0.2, 0.94 + n * 0.06); this.sun.intensity = 2.3 * (1 - n * 0.62);
    this.hemi.color.set(0xffffff).lerp(new THREE.Color(0x8a93b4), n * 0.7); this.hemi.groundColor.set(0xe9dcc8).lerp(new THREE.Color(0x4a4038), n * 0.7); this.hemi.intensity = 0.92 * (1 - n * 0.5);
    this.applyExposure(0.52);
    const bl = this.post.bloom; if (bl) { bl.enabled = n > 0.03; bl.strength = n * 0.2; bl.threshold = 0.98; }      // maquette : lueur des lampes le soir seulement, le fond reste celui du graphiste
    this.placeSun(this.studioDir || (this.studioDir = new THREE.Vector3(-0.25, 0.8, 0.33).normalize()));
    const target = new THREE.Color(0xf3ece0).lerp(new THREE.Color(0x3a322d), n * 0.85), e = this.renderer.toneMappingExposure / 0.6;
    const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
    const inv = (L) => { let lo = 0, hi = 40; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fit(m * e) < L) lo = m; else hi = m; } return lo; };
    this.scene.background = composer ? new THREE.Color(inv(target.r), inv(target.g), inv(target.b)) : target;
  }

  /* Recalcul différé de la carte d'environnement ; renvoie true si elle vient d'être refaite.
     Elle ne change que lentement (la couleur du ciel). Pendant que l'heure glisse, on n'en refait une qu'au plus toutes les 0,8 s et si le soleil
     a bougé de plus de 5° ; une fois l'heure posée (0,2 s sans changement), on la met à jour d'un coup. Entre deux, seule son intensité suit
     l'heure, à chaque image, sans coût : le changement d'heure ne déclenche donc qu'une ou deux régénérations, jamais une par image. */
  flushEnv(now = performance.now()) {
    if (this.envPending) { this.scene.environmentIntensity = 0.25 * this.envK + 0.02; this.envPending = false; }
    if (!this.envDirty) return false;
    const first = !this.envRT, dAlt = Math.abs(this.envAlt - (this.envBuiltAlt ?? 99)), dNight = Math.round(this.night * 8) !== this.envBuiltNight;
    if (!first && dAlt < 0.6 && !dNight) { this.envDirty = false; return false; }
    const since = now - (this.envAt || 0), idle = now - (this.hourAt || 0);
    if (!first && !(idle > 200 && since > 240) && !(since > 800 && dAlt > 5)) return false;
    this.envDirty = false; this.envAt = now; this.envBuiltAlt = this.envAlt; this.envBuiltNight = Math.round(this.night * 8); this.updateEnvMap(this.envK); return true;
  }

  /* Recentre les ombres portées : sur le logement (visite), ou sur toute la résidence (vue d'ensemble). */
  focus(center, radius) { this.center.copy(center); this.radius = radius; this.placeSun(this.studio && this.studioDir ? this.studioDir : this.lightDir, true); }

  placeSun(dir = this.lightDir, force) {
    const r = this.radius, c = this.center;
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(dir, r * 3);
    const cam = this.sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = r * 0.4; cam.far = r * 4.6; cam.updateProjectionMatrix();
    // l'ombre n'est redessinée que si le soleil a réellement tourné (glisser l'heure ne redessine pas 4096 × 4096 pixels à chaque image)
    if (force || this.shadowDir.dot(dir) < 0.99999 || !this.shadowC || this.shadowC.distanceToSquared(c) > 1e-4 || this.shadowR !== r) {
      this.shadowDir.copy(dir); this.shadowC = (this.shadowC || new THREE.Vector3()).copy(c); this.shadowR = r; this.renderer.shadowMap.needsUpdate = true;
    }
  }

  updateEnvMap(intensity) {
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.25 * intensity + 0.02;
  }
}

/* ── Étalonnage final (avant la courbe de tons, en lumière linéaire) ─────────────────────────────
   contraste autour du gris moyen, saturation, ombres fraîches et lumières chaudes, vignettage, aberration chromatique
   quasi imperceptible en bordure, netteté bornée par le voisinage (pas de halo sur les blancs) et bruit fixe très léger
   contre les bandes dans les dégradés. */
export function makeGradePass() {
  const shader = {
    uniforms: {
      tDiffuse: { value: null }, uPx: { value: new THREE.Vector2(1 / 1024, 1 / 768) }, uExp: { value: 0.55 }, uContrast: { value: 1.08 }, uSat: { value: 1.1 },
      uVig: { value: 0.2 }, uCA: { value: 0.0014 }, uSharp: { value: 0.2 }, uGrain: { value: 0.012 },
      uShadow: { value: new THREE.Color(0.96, 0.985, 1.04) }, uHigh: { value: new THREE.Color(1.04, 1.0, 0.95) },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uPx; uniform vec3 uShadow, uHigh;
uniform float uExp, uContrast, uSat, uVig, uCA, uSharp, uGrain;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
void main() {
	vec2 c = vUv - 0.5; float r2 = dot( c, c );
	vec2 o = c * r2 * uCA;
	vec3 col = vec3( texture2D( tDiffuse, vUv + o ).r, texture2D( tDiffuse, vUv ).g, texture2D( tDiffuse, vUv - o ).b );
	vec3 n1 = texture2D( tDiffuse, vUv + vec2( uPx.x, 0.0 ) ).rgb, n2 = texture2D( tDiffuse, vUv - vec2( uPx.x, 0.0 ) ).rgb, n3 = texture2D( tDiffuse, vUv + vec2( 0.0, uPx.y ) ).rgb, n4 = texture2D( tDiffuse, vUv - vec2( 0.0, uPx.y ) ).rgb;
	vec3 lo = min( min( n1, n2 ), min( n3, n4 ) ), hi = max( max( n1, n2 ), max( n3, n4 ) );
	col = clamp( col + uSharp * ( col - 0.25 * ( n1 + n2 + n3 + n4 ) ), min( lo, col ), max( hi, col ) );
	vec3 e = col * uExp;
	e = 0.18 * pow( max( e, vec3( 1e-5 ) ) / 0.18, vec3( uContrast ) );
	float L = dot( e, vec3( 0.2126, 0.7152, 0.0722 ) );
	e = mix( vec3( L ), e, uSat );
	e *= mix( uShadow, uHigh, smoothstep( 0.02, 0.9, L ) );
	e *= 1.0 - uVig * smoothstep( 0.16, 0.5, r2 );
	e *= 1.0 + ( hash( gl_FragCoord.xy ) - 0.5 ) * uGrain;
	gl_FragColor = vec4( e / uExp, 1.0 );
}`,
  };
  const pass = new ShaderPass(shader);
  const rs = pass.setSize.bind(pass);
  pass.setSize = (w, h) => { rs(w, h); pass.uniforms.uPx.value.set(1 / w, 1 / h); };
  return pass;
}
