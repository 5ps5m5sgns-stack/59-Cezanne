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
import { makeMaterialsAsync, FLOOR_FINISHES, setFloorFinish } from 'v3d/materials';
import { buildLevel, buildStair, buildLift, buildNav } from 'v3d/build';
import { APARTMENTS } from 'v3d/plans';
import { SITE, makeArrival } from 'v3d/site';
import { Environment, makeGradePass } from 'v3d/env';
import { cellFree, nearestFree, findPath, pathLength } from 'v3d/nav';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rad = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const EYE = 1.62, FOV_ORBIT = 24, FOV_PLAN = 17;
const params = new URLSearchParams(location.search);
const lang = () => (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
const T = {
  loadTex: { fr: 'Préparation des matériaux…', en: 'Preparing materials…' },
  loadGeo: { fr: 'Construction du logement…', en: 'Building the home…' },
  loadEnv: { fr: 'Mise en lumière…', en: 'Setting the light…' },
  hintWalk: { fr: 'Glissez pour regarder · cliquez là où vous voulez aller · molette pour avancer', en: 'Drag to look · click where you want to go · scroll to move forward' },
  hintWalkTouch: { fr: 'Glissez pour regarder · touchez là où vous voulez aller · écartez deux doigts pour avancer', en: 'Drag to look · tap where you want to go · spread two fingers to move forward' },
  hintOrbit: { fr: 'Cliquez sur une pièce pour y entrer · glissez pour tourner la maquette', en: 'Click a room to step inside · drag to rotate the model' },
  hintPlan: { fr: 'Glissez pour déplacer le plan · cliquez sur une pièce pour y entrer', en: 'Drag to move the plan · click a room to step inside' },
  hintSite: { fr: 'Glissez pour tourner autour de la résidence · cliquez sur un logement pour l\'ouvrir', en: 'Drag to orbit the residence · click a home to open it' },
  lotVilla: { fr: 'Dernier étage · 138 m² · jardin', en: 'Top floor · 138 m² · garden' }, lotDuplex: { fr: 'Deux niveaux · 206 m² · ascenseur privatif', en: 'Two levels · 206 m² · private lift' },
  lotHere: { fr: 'Voir la maquette', en: 'See the model' },
  hintLift: { fr: 'Entrez dans la cabine pour changer de niveau', en: 'Step into the lift to change level' },
  lift: { fr: 'Ascenseur', en: 'Lift' },
  tourPlay: { fr: 'Visite guidée', en: 'Guided tour' }, tourStop: { fr: 'Arrêter la visite', en: 'Stop the tour' },
  outside: { fr: 'Extérieur', en: 'Outside' },
  lost: { fr: 'La carte graphique a interrompu l\'affichage. Reprise de la visite…', en: 'The graphics card interrupted the display. Resuming the tour…' },
  lostReload: { fr: 'La carte graphique n\'a pas pu reprendre l\'affichage.', en: 'The graphics card could not resume the display.' },
  reload: { fr: 'Recharger la visite', en: 'Reload the tour' },
  nogl: { fr: 'La visite 3D a besoin de WebGL, que ce navigateur ne propose pas.', en: 'The 3D tour needs WebGL, which this browser does not provide.' },
};
const tr = (k) => T[k][lang()];

/* ── Qualité selon l'appareil ─────────────────────────────────────────────
   Choisie une fois, au chargement, pour ce qui ne peut plus changer ensuite sans recompiler ni réallouer : taille de la carte
   d'ombres, nombre de lumières d'appoint, passes de post-traitement, taille des textures. Le reste (résolution, occlusion
   pendant le mouvement) s'adapte en continu à la machine (voir « Résolution dynamique »).
   ?q=low|mid|std|high|test impose un niveau ; ?gpu=<nom de carte> simule une carte pour éprouver la détection. */
const touch = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 820;
const QUALITIES = {
  low: { shadow: 2048, aniso: 4, ao: false, bloom: false, lights: 4, dpr: 1.5, trees: 22, forest: 380, tex: 1024 },
  mid: { shadow: 2048, aniso: 8, ao: false, bloom: true, lights: 6, dpr: 2, trees: 34, forest: 700, tex: 1024 },
  // ordinateurs modestes (puce graphique intégrée, peu de cœurs ou de mémoire) : mêmes passes que « high » (l'image arrêtée garde
  // son occlusion et son halo), mais ombres, textures et lumières d'appoint à la mesure d'une mémoire partagée
  std: { shadow: 2048, aniso: 4, ao: true, bloom: true, lights: 6, dpr: 1.5, trees: 34, forest: 900, tex: 1024 },
  high: { shadow: 4096, aniso: 16, ao: true, bloom: true, lights: 8, dpr: 2, trees: 46, forest: 1300, tex: 2048 },
  test: { shadow: 2048, aniso: 4, ao: true, bloom: true, lights: 8, dpr: 1, trees: 40, forest: 1100, tex: 1024 },
  soft: { shadow: 2048, aniso: 1, ao: false, bloom: false, lights: 4, dpr: 1, trees: 22, forest: 380, tex: 1024 },     // rendu logiciel, sans carte graphique
};
let qName = 'high', QUALITY = QUALITIES.high, GPU = { name: '', kind: 'unknown' };
const PIXEL_BUDGET = { high: 8.4e6, test: 4e6, std: 3.3e6, mid: 3.3e6 };       // pixels dessinés au plus ; absent = pas de plafond (téléphones, rendu logiciel)
/* Nature de la carte graphique d'après le nom que donne le pilote : logiciel, intégrée (mémoire partagée), dédiée, inconnue. */
function gpuKind(name) {
  const n = name.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|microsoft basic|mesa offscreen/.test(n)) return 'soft';
  if (/nvidia|geforce|quadro|rtx|gtx|radeon (rx|pro|r9|hd [5-8]\d{3})|\brx \d{3,4}|firepro|arc\(tm\) a\d|apple m\d/.test(n)) return 'dgpu';     // puces Apple : intégrées mais assez puissantes
  if (/intel|uhd|iris|hd graphics|radeon\(tm\)[^,]*graphics|radeon graphics|radeon \d{3}m|vega \d|mali|adreno|powervr|videocore|tegra/.test(n)) return 'igpu';
  return 'unknown';
}
function pickQuality(gl) {
  try { const d = gl.getExtension('WEBGL_debug_renderer_info'); GPU.name = params.get('gpu') || (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || ''; } catch (e) { GPU.name = params.get('gpu') || ''; }
  GPU.kind = gpuKind(GPU.name);
  const forced = params.get('q');
  if (forced && QUALITIES[forced]) return forced;
  if (GPU.kind === 'soft') return 'soft';
  if (touch) return small ? 'low' : 'mid';
  const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
  if (cores <= 2 || mem <= 2) return 'mid';
  if (GPU.kind === 'dgpu') return 'high';
  if (GPU.kind === 'igpu' || cores <= 4 || mem <= 4) return 'std';
  return 'high';                                             // carte inconnue (nom masqué) : la résolution dynamique protège la fluidité
}

const root = $('#v3d');
const canvas = $('#v3d-canvas');
const ui = { bar: $('#v3d-loader-bar'), lots: $('#v3d-lots'), spots: $('#v3d-spots'), loader: $('#v3d-loader'), loaderText: $('#v3d-loader-text'), labels: $('#v3d-labels'), hud: $('#v3d-hud'), hint: $('#v3d-hint'), map: $('#v3d-map'), fade: $('#v3d-fade') };

/* Priorité entre surfaces confondues. Quand deux faces de matériaux différents tombent dans le même plan (un mur de pierre et le
   talus qu'il retient, une couvertine et le mur, une plinthe et la cloison, un joint creux et l'enduit…), la carte graphique
   choisit l'une ou l'autre pixel par pixel, différemment à chaque mouvement : la surface « grouille ». Chaque matériau reçoit
   un rang, et un léger décalage de profondeur (sans effet ailleurs, aucun nouveau programme de rendu) fait toujours gagner le
   plus haut : masses et terrain (0) < revêtements (1) < menuiseries, finitions, mobilier (2) < joints et sources lumineuses (3). */
const DEPTH_RANK = {
  earth: 0, grass: 0, socle: 0, massing: 0, stucco: 0, plaster: 0, concrete: 1, road: 0, paving: 0, terrace: 0, glassDark: 0, wallCut: 0,
  floor: 1, tile: 1, wallTile: 1, stone: 1, stuccoDark: 1, roof: 1, hexPaving: 1,
  ceiling: 0.5, skirt: 1.5,                                   // la plinthe passe derrière les meubles et les huisseries qui la touchent
  black: 2.5, steel: 2.5, cadre: 2.5,                         // poignées, profils et cadres devant les façades et les lames
  seam: 3, led: 3, liftLight: 3,
};
function depthPriority(M) {
  for (const [k, m] of Object.entries(M)) {
    if (!m || !m.isMaterial || m.transparent || m.polygonOffset) continue;      // tapis et carrelages ont déjà leur propre décalage (materials.js)
    const r = DEPTH_RANK[k] ?? 2; if (!r) continue;
    m.polygonOffset = true; m.polygonOffsetFactor = -0.4 * r; m.polygonOffsetUnits = -2 * r;
  }
}

/* ── Ombres de contact précalculées ──────────────────────────────────────────
   Sans occlusion ambiante à l'écran (téléphones), les meubles semblaient flotter et les angles étaient plats. Au chargement, chaque
   niveau est rendu une fois vu de dessus (caméra orthographique coupée à 1 m du sol) : ce qui couvre le sol y est noté, meubles d'un
   côté, murs de l'autre, puis flouté. La carte obtenue assombrit la lumière indirecte au pied des meubles et des murs, dans les angles
   mur-sol et mur-plafond, et au bas des meubles eux-mêmes. Elle est fixe : aucun bruit, rien ne bouge quand la vue bouge, coût nul ensuite.
   Un seul programme par matériau (les modes passent par des uniformes) ; tout est compilé au préchauffage. */
const AO_MODE = { floor: 1, wall: 2, ceiling: 3 };        // les autres matériaux : objets (0)
const FLOOR_MATS = ['floor', 'tile', 'terrace', 'hexPaving', 'paving', 'grass', 'earth', 'rug', 'rugDark', 'road', 'travertine', 'gravel', 'mulch', 'asphaltLight'];
const WALL_MATS = ['plaster', 'wallTile', 'stucco', 'stone', 'skirt', 'ashlar', 'stuccoDark', 'rendering'];
const AOU = {                                              // uniformes partagés par tous les matériaux
  uAoMap: { value: null }, uAoK: { value: 0 }, uAoSplit: { value: 1e9 },
  uAoT0: { value: new THREE.Vector4() }, uAoT1: { value: new THREE.Vector4() }, uAoA: { value: new THREE.Vector4(1, 0, 1, 0) },     // emprise de chaque niveau, place dans l'atlas
  uAoLv: { value: new THREE.Vector4(0, 2.6, 0, 2.6) },    // cote et hauteur sous plafond des deux niveaux
  uAoMap2: { value: null }, uAoDay: { value: 1 }, uAoNight: { value: 0 }, uAoCf: { value: 0.3 },
  uAoWarm: { value: new THREE.Color(1.16, 1.0, 0.8) }, uAoLamp: { value: new THREE.Color(1.0, 0.62, 0.3) },
};
const AO_VERT = `#include <worldpos_vertex>
	vAoW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vAoN = normalize( mat3( modelMatrix ) * objectNormal );`;
const AO_PARS = `varying vec3 vAoW; varying vec3 vAoN;
uniform sampler2D uAoMap, uAoMap2; uniform vec4 uAoT0, uAoT1, uAoA, uAoLv; uniform float uAoK, uAoSplit, uAoMode, uAoDay, uAoNight, uAoCf; uniform vec3 uAoWarm, uAoLamp;
vec3 aoTint = vec3( 1.0 ); float aoLamp = 0.0;
float aoContact() {
	if ( uAoK <= 0.0 ) return 1.0;
	bool up = vAoW.y > uAoSplit; vec4 T = up ? uAoT1 : uAoT0; float fy = up ? uAoLv.z : uAoLv.x, fh = up ? uAoLv.w : uAoLv.y, h = vAoW.y - fy;
	if ( h < -0.25 || h > fh + 0.3 ) return 1.0;
	vec3 n = normalize( vAoN );
	vec2 q = ( vAoW.xz + ( uAoMode == 1.0 || uAoMode == 3.0 ? vec2( 0.0 ) : n.xz * 0.05 ) - T.xy ) * T.zw;      // les faces verticales lisent la carte juste devant elles
	if ( q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 ) return 1.0;
	vec2 uv = vec2( q.x, ( up ? uAoA.w : uAoA.y ) + q.y * ( up ? uAoA.z : uAoA.x ) );
	vec4 s = texture2D( uAoMap, uv );     // r : meubles (large), g : murs (large), b : contact serré
	vec4 l = texture2D( uAoMap2, uv );    // r : jour venu des baies, g : lampes, b : murs (serré, pour les angles)
	float occ, lo = exp( -max( h, 0.0 ) / 0.7 );
	if ( uAoMode == 1.0 ) occ = 0.5 * s.r + 0.45 * s.g + 0.5 * s.b;
	else if ( uAoMode == 3.0 ) occ = 0.34 * s.g * smoothstep( fh - 0.5, fh - 0.02, h );
	else if ( uAoMode == 2.0 ) occ = ( 0.4 * s.r + 0.25 * s.b ) * exp( -max( h, 0.0 ) / 0.3 ) + 0.16 * exp( -max( h, 0.0 ) / 0.07 ) + 0.13 * exp( -max( fh - h, 0.0 ) / 0.1 ) + 0.32 * smoothstep( uAoCf + 0.03, uAoCf + 0.3, l.b );
	else occ = ( 0.32 * s.r + 0.22 * s.g + 0.3 * s.b ) * ( 1.0 - smoothstep( 0.0, 0.32, h ) ) * ( 0.55 + 0.45 * max( -n.y, 0.0 ) + 0.45 * ( 1.0 - abs( n.y ) ) );
	// lumière du jour : plus vive près des baies, plus sourde au fond ; le parquet ensoleillé réchauffe le bas des murs et le plafond
	float f = mix( 1.0, 0.62 + 0.62 * l.r, uAoDay );
	float warm = ( uAoMode == 2.0 ? 0.55 * lo : uAoMode == 3.0 ? 0.45 : uAoMode == 1.0 ? 0.0 : 0.25 * lo ) * l.r * uAoDay;
	aoTint = f * mix( vec3( 1.0 ), uAoWarm, warm );
	// le soir : halo doux des lampes sur les murs et le sol, plus marqué à hauteur de lampe
	aoLamp = l.g * uAoNight * ( uAoMode == 3.0 ? 0.55 : uAoMode == 2.0 ? 0.6 + 0.4 * exp( -abs( h - 1.1 ) / 0.9 ) : 0.8 );
	return clamp( 1.0 - uAoK * occ, 0.35, 1.0 );
}`;
/* ── Reflets des pièces ──────────────────────────────────────────────────────
   Au chargement, quelques pièces (séjour, cuisine, salles de bains) sont photographiées une fois dans les six directions depuis leur
   centre ; chaque prise est filtrée (PMREM) et rangée dans un atlas. Miroirs, inox, marbres, sols vernis et laques y lisent la pièce
   où ils se trouvent, corrigée par la boîte de la pièce (le reflet se place sur les vrais murs au lieu d'être à l'infini). Ailleurs, ils
   gardent l'intérieur neutre d'avant. Image fixe : aucun rendu supplémentaire pendant la visite. */
const NZ = 6;                                              // au plus six prises (quatre en qualité basse)
const ZU = {
  uZAtlas: { value: null }, uZn: { value: 0 }, uZK: { value: 1 },
  uZClamp: { value: 6e4 },                                // plafond de luminance, abaissé pendant les prises : un reflet de soleil sur un chrome dépasse ce que tient un demi-flottant et noircirait le flou
  uZg: { value: new THREE.Vector4(2, 2, 1 / 384, 1 / 512) }, uZmip: { value: 7 },      // colonnes, rangées, 1 / taille d'une case, niveau de détail maximal
  uZb: { value: Array.from({ length: NZ }, () => new THREE.Vector4()) }, uZy: { value: Array.from({ length: NZ }, () => new THREE.Vector4()) }, uZc: { value: Array.from({ length: NZ }, () => new THREE.Vector4()) },
};
const ZONE_PARS = `uniform sampler2D uZAtlas; uniform vec4 uZg, uZb[ ${NZ} ], uZy[ ${NZ} ], uZc[ ${NZ} ]; uniform float uZn, uZK, uZmip, uZon;
vec3 zBilinear( vec3 direction, float mipInt, vec2 cell ) {
	float face = getFace( direction );
	float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
	mipInt = max( mipInt, cubeUV_minMipLevel );
	float faceSize = exp2( mipInt );
	highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
	if ( face > 2.0 ) { uv.y += faceSize; face -= 3.0; }
	uv.x += face * faceSize; uv.x += filterInt * 3.0 * cubeUV_minTileSize; uv.y += 4.0 * ( exp2( uZmip ) - faceSize );
	uv *= uZg.zw;
	return textureLod( uZAtlas, ( uv + cell ) / uZg.xy, 0.0 ).rgb;      // niveau explicite : l'échantillonnage a lieu dans une boucle, sans dérivées fiables
}
vec4 zoneCubeUV( vec3 dir, float roughness, bool proj ) {
	if ( uZon > 0.5 ) for ( int i = 0; i < ${NZ}; i ++ ) {
		if ( float( i ) >= uZn ) break;
		vec4 b = uZb[ i ], yy = uZy[ i ];
		if ( vAoW.x < b.x || vAoW.x > b.z || vAoW.z < b.y || vAoW.z > b.w || vAoW.y < yy.x - 0.05 || vAoW.y > yy.y + 0.05 ) continue;
		vec3 d = dir;
		if ( proj ) {                                    // projection sur la boîte de la pièce
			vec3 bmin = vec3( b.x, yy.x, b.y ), bmax = vec3( b.z, yy.y, b.w ), P = clamp( vAoW, bmin + 0.02, bmax - 0.02 );
			vec3 tf = max( ( bmax - P ) / d, ( bmin - P ) / d ); d = P + d * min( min( tf.x, tf.y ), tf.z ) - uZc[ i ].xyz;
		}
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, uZmip ), mipF = fract( mip ), mipInt = floor( mip );
		vec2 cell = vec2( mod( float( i ), uZg.x ), floor( float( i ) / uZg.x ) );
		vec3 c0 = zBilinear( d, mipInt, cell );
		if ( mipF > 0.0 ) c0 = mix( c0, zBilinear( d, mipInt + 1.0, cell ), mipF );
		return vec4( c0 * uZK, 1.0 );
	}
	return textureCubeUV( envMap, dir, roughness );
}`;
const ENV_PARS = THREE.ShaderChunk.envmap_physical_pars_fragment
  .replace('vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );', 'vec4 envMapColor = zoneCubeUV( envMapRotation * reflectVec, roughness, true );')
  .replace('#ifdef USE_ENVMAP', '#ifdef USE_ENVMAP\n#ifdef ENVMAP_TYPE_CUBE_UV\n' + ZONE_PARS + '\n#endif');

function patchAO(shader) {
  Object.assign(shader.uniforms, AOU, ZU, { uAoMode: { value: this.userData.aoMode || 0 }, uZon: { value: this.userData.zone ? 1 : 0 } });
  shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>', ENV_PARS);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAoW; varying vec3 vAoN;').replace('#include <worldpos_vertex>', AO_VERT);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + AO_PARS)
    .replace('#include <lights_fragment_begin>', 'float aoC = aoContact();\n' + THREE.ShaderChunk.lights_fragment_begin.replace('getPointLightInfo( pointLight, geometryPosition, directLight );', 'getPointLightInfo( pointLight, geometryPosition, directLight ); directLight.color *= aoC;'))   // les lampes d'appoint figurent un rebond : occultées comme lui
    .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= aoC * aoTint; reflectedLight.indirectDiffuse += diffuseColor.rgb * uAoLamp * aoLamp; reflectedLight.indirectSpecular *= mix( 1.0, aoC, 0.7 ); reflectedLight.directDiffuse *= mix( 1.0, aoC, 0.4 );');
  patchClamp.call(this, shader);
}
function patchClamp(shader) {
  shader.uniforms.uZClamp = ZU.uZClamp;
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uZClamp;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb = min( gl_FragColor.rgb, vec3( uZClamp ) );');
}
/* Vitrage : ni les lampes d'appoint posées près des baies ni le soleil ne doivent s'y refléter en disque blanc (le reflet
   s'ajoutait à chaque épaisseur : double vitrage, vantaux superposés). On retire donc l'éclat direct des lumières et on plafonne
   le reflet du ciel, qui contient le soleil ; le voile du ciel en vue rasante reste. */
function patchGlass(shader) {
  patchClamp.call(this, shader);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3( 0.0 );')
    .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb = min( gl_FragColor.rgb, vec3( 0.07 ) );');
}
function aoPatchMaterials(M) {
  for (const [k, m] of Object.entries(M)) {
    if (!m || !m.isMeshStandardMaterial) continue;
    if (m.transparent || m.alphaTest > 0) { m.onBeforeCompile = k === 'glass' ? patchGlass : patchClamp; continue; }
    m.userData.aoMode = FLOOR_MATS.includes(k) ? AO_MODE.floor : WALL_MATS.includes(k) ? AO_MODE.wall : k === 'ceiling' ? AO_MODE.ceiling : 0;
    m.onBeforeCompile = patchAO;
  }
}
/* Précalculs découpés en tranches : au-delà de 40 ms de calcul d'affilée, on rend la main au navigateur (la barre de chargement
   avance, l'onglet reste réactif). Sur une machine rapide, presque aucune pause : le chargement n'est pas allongé. */
let sliceAt = 0;
const slice = async (force) => { const t = performance.now(); if (force || t - sliceAt > 40) { await new Promise((r) => setTimeout(r, 0)); sliceAt = performance.now(); } };
/* Flou par boîtes (trois passes ≈ gaussienne), séparable, sur un canal W×H. */
function boxBlur(a, W, H, r, passes = 3) {
  const t = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) { const o = y * W; let s = 0; for (let x = -r; x <= r; x++) s += a[o + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { t[o + x] = s / (2 * r + 1); s += a[o + Math.min(W - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { a[y * W + x] = s / (2 * r + 1); s += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } }
  }
  return a;
}
/* Lumière précalculée, sur une grille de 20 cm par niveau : le jour qui entre par les baies et la lueur des lampes se diffusent de
   proche en proche dans les pièces (les murs l'arrêtent, les portes la laissent passer, elle s'éteint avec la distance), puis la
   grille est agrandie à la taille de la carte d'ombres. Troisième canal : les murs à peine floutés, qui révèlent les angles rentrants. */
async function bakeLight(lvs, ext, sz, W, HT, px, Graw, lights, r) {
  const data = new Uint8Array(W * HT * 4), cell = 0.2, outdoor = /jardin|balcon|terrasse/;
  const Gs = boxBlur(Float32Array.from(Graw), W, HT, r(0.12));
  // valeur de ce flou à 5 cm d'un mur droit : au-delà, on est dans un angle
  const n1 = 400, line = new Float32Array(n1); for (let i = 0; i < n1 / 2; i++) line[i] = 1; boxBlur(line, n1, 1, r(0.12));
  const cf = line[n1 / 2 + Math.round(0.05 / px)];
  let row0 = 0;
  await slice();
  for (const [li, lv] of lvs.entries()) {
    const e = ext[li], H = sz.H[li], gw = Math.ceil(W * px / cell), gh = Math.ceil(H * px / cell), N = gw * gh;
    const wall = new Uint8Array(N), inside = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Graw[(row0 + y) * W + x] > 0.5) wall[Math.min(gh - 1, Math.floor(y * px / cell)) * gw + Math.min(gw - 1, Math.floor(x * px / cell))] = 1;
    for (const room of lv.rooms) if (!outdoor.test(room.id)) for (const q of room.rs) {
      for (let j = Math.max(0, Math.floor((q[1] - e[1]) / cell)); j < Math.min(gh, Math.ceil((q[3] - e[1]) / cell)); j++) for (let i = Math.max(0, Math.floor((q[0] - e[0]) / cell)); i < Math.min(gw, Math.ceil((q[2] - e[0]) / cell)); i++) inside[j * gw + i] = 1;
    }
    const diffuse = async (src, decay, iters) => {
      let L = Float32Array.from(src), T = new Float32Array(N);
      for (let k = 0; k < iters; k++) {
        if (!(k & 31)) await slice();
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
          const c = j * gw + i; if (wall[c]) { T[c] = src[c]; continue; }
          const m = (L[c - 1 >= j * gw ? c - 1 : c] + L[i + 1 < gw ? c + 1 : c] + L[j > 0 ? c - gw : c] + L[j + 1 < gh ? c + gw : c]) * 0.25;
          T[c] = Math.max(src[c], m * decay);
        }
        [L, T] = [T, L];
      }
      return L;
    };
    const splat = (src, x, z, rad, v) => { for (let j = Math.floor((z - rad - e[1]) / cell); j <= Math.ceil((z + rad - e[1]) / cell); j++) for (let i = Math.floor((x - rad - e[0]) / cell); i <= Math.ceil((x + rad - e[0]) / cell); i++) { if (i < 0 || j < 0 || i >= gw || j >= gh) continue; const d = Math.hypot((i + 0.5) * cell + e[0] - x, (j + 0.5) * cell + e[1] - z); if (d < rad) src[j * gw + i] = Math.max(src[j * gw + i], v * (1 - d / rad * 0.3)); } };
    const sd = new Float32Array(N), sl = new Float32Array(N);
    for (const l of lights) {
      if (l.level !== li) continue; const hy = l.pos.y - lv.y;
      if (l.day && hy < 1.5) splat(sd, l.pos.x, l.pos.z, 0.7, Math.min(1, l.power / 1.6));          // baies (les appoints de pièce, à 2 m, n'en sont pas)
      else if (!l.day) splat(sl, l.pos.x, l.pos.z, 0.3, Math.min(1, l.power / 0.9));
    }
    // portée : environ 2,4 m pour le jour (d = 1 / (1 + 1 / (4 λ²)), λ en cellules), 1,2 m pour les lampes
    const D = await diffuse(sd, 0.99827, 700), Lm = await diffuse(sl, 0.9931, 260);
    // agrandissement bilinéaire de la grille vers la carte
    const at = (A, fx, fy) => { const x0 = Math.max(0, Math.min(gw - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(gh - 1, Math.floor(fy))), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0)); return (A[y0 * gw + x0] * (1 - tx) + A[y0 * gw + x1] * tx) * (1 - ty) + (A[y1 * gw + x0] * (1 - tx) + A[y1 * gw + x1] * tx) * ty; };
    const In = Float32Array.from(inside);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) * px / cell - 0.5, fy = (y + 0.5) * px / cell - 0.5, o = ((row0 + y) * W + x) * 4, ins = at(In, fx, fy);
      const day = 1 - Math.exp(-4 * at(D, fx, fy));
      data[o] = 255 * (day * ins + 0.613 * (1 - ins));                                  // dehors : aucun effet (0,613 ↔ facteur 1)
      data[o + 1] = 255 * Math.min(1, at(Lm, fx, fy) * 2.2) * ins;
      data[o + 2] = 255 * Math.min(1, Gs[(row0 + y) * W + x]); data[o + 3] = 255;
    }
    row0 += H;
    await slice();
  }
  const tex = new THREE.DataTexture(data, W, HT, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return { tex, cf };
}
/* Rend la carte d'ombres de contact d'un logement (tous ses niveaux dans un atlas). Renvoie { tex, t0, t1, a, lv, split }. */
async function bakeContact(renderer, scene, group, apt, M, maxTex, lights = []) {
  const lvs = apt.levels.slice(0, 2), pad = 0.6;
  const ext = lvs.map((lv) => { const b = lv.bounds; return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad]; });
  let px = 0.025; const fit = () => ({ W: Math.max(...ext.map((e) => Math.ceil((e[2] - e[0]) / px))), H: ext.map((e) => Math.ceil((e[3] - e[1]) / px)) });
  let sz = fit(); while (sz.W > maxTex || sz.H.reduce((s, h) => s + h, 0) > maxTex) { px *= 1.1; sz = fit(); }
  const W = sz.W, HT = sz.H.reduce((s, h) => s + h, 0);
  const vs = 'varying float vY; void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }';
  const fs = 'uniform float uY, uWall; varying float vY; void main() { float h = clamp( vY - uY, 0.0, 1.0 ); gl_FragColor = uWall > 0.5 ? vec4( 0.0, 1.0, 0.0, 1.0 ) : vec4( 1.0 - 0.45 * h, 0.0, 0.0, 1.0 ); }';
  const uY = { value: 0 }, mk = (wall) => new THREE.ShaderMaterial({ uniforms: { uY, uWall: { value: wall } }, vertexShader: vs, fragmentShader: fs, side: THREE.DoubleSide });
  const ovObj = mk(0), ovWall = mk(1), wallSet = new Set(WALL_MATS.map((k) => M[k])), skip = new Set([...FLOOR_MATS, 'ceiling'].map((k) => M[k]));
  // seuls les maillages du logement comptent ; ciel, paysage et brouillard sont écartés le temps du rendu
  const saved = [], hidden = [];
  for (const o of scene.children) if (o !== group && o.visible && !o.isLight) { hidden.push(o); o.visible = false; }
  group.traverse((o) => {
    if (o.isGroup && /:cap$/.test(o.name) && o.visible) { hidden.push(o); o.visible = false; }
    if (o.isGroup && !o.visible && !/:cap$/.test(o.name) && o.parent === group) { saved.push([o, 'visible', false]); o.visible = true; }
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    const m = o.material;
    if (!o.isMesh || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent || m.alphaTest > 0 || skip.has(m)) { if (o.visible) { hidden.push(o); o.visible = false; } return; }
    saved.push([o, 'material', m]); o.material = wallSet.has(m) ? ovWall : ovObj;
  });
  const fog = scene.fog, bg = scene.background; scene.fog = null; scene.background = null;
  const sh = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = false;
  const prevRT = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  const R = new Float32Array(W * HT), G = new Float32Array(W * HT);
  const out = { t0: new THREE.Vector4(), t1: new THREE.Vector4(), a: new THREE.Vector4(1, 0, 1, 0), lv: new THREE.Vector4(lvs[0].y, lvs[0].h, (lvs[1] || lvs[0]).y, (lvs[1] || lvs[0]).h), split: lvs[1] ? lvs[1].y - 0.12 : 1e9 };
  let row0 = 0;
  for (const [li, lv] of lvs.entries()) {
    if (li) await slice(true);                              // un niveau par tâche (premier envoi de toute la géométrie, lecture bloquante)
    const e = ext[li], H = sz.H[li], w = W * px, hgt = H * px;
    const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true });
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, hgt / 2, -hgt / 2, 0.0, 1.0 - 0.025);
    cam.position.set(e[0] + w / 2, lv.y + 1.0, e[1] + hgt / 2); cam.up.set(0, 0, -1); cam.lookAt(e[0] + w / 2, lv.y - 5, e[1] + hgt / 2); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    uY.value = lv.y;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
    const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); rt.dispose();
    // ligne 0 lue = bas de l'image = z le plus grand : on remet les lignes dans l'ordre des z croissants
    for (let y = 0; y < H; y++) { const src = (H - 1 - y) * W * 4, dst = (row0 + y) * W; for (let x = 0; x < W; x++) { R[dst + x] = buf[src + x * 4] / 255; G[dst + x] = buf[src + x * 4 + 1] / 255; } }
    const T = li ? out.t1 : out.t0; T.set(e[0], e[1], 1 / w, 1 / hgt);
    if (li) out.a.z = H / HT, out.a.w = row0 / HT; else out.a.x = H / HT, out.a.y = 0;
    if (!lvs[1]) out.t1.copy(out.t0);
    row0 += H;
  }
  // deux échelles : un contact serré (4 cm) et un voile large (meubles 22 cm, murs 30 cm)
  const r = (m) => Math.max(1, Math.round(m / px / 2.2));
  const C = new Float32Array(W * HT); for (let i = 0; i < C.length; i++) C[i] = Math.max(R[i], G[i]);
  // la scène retrouve son état avant les calculs (pendant les pauses, rien d'autre ne doit la voir modifiée)
  for (const [o, k, v] of saved) o[k] = v; for (const o of hidden) o.visible = true;
  scene.fog = fog; scene.background = bg; renderer.shadowMap.needsUpdate = sh; renderer.setRenderTarget(prevRT); renderer.setClearColor(cc, ca);
  ovObj.dispose(); ovWall.dispose();
  const lightTex = await bakeLight(lvs, ext, sz, W, HT, px, G, lights, r);
  boxBlur(C, W, HT, r(0.05)); await slice(); boxBlur(R, W, HT, r(0.24)); await slice(); boxBlur(G, W, HT, r(0.32)); await slice();
  const data = new Uint8Array(W * HT * 4);
  for (let i = 0; i < W * HT; i++) { data[i * 4] = Math.min(255, R[i] * 255 * 1.15); data[i * 4 + 1] = Math.min(255, G[i] * 255); data[i * 4 + 2] = Math.min(255, C[i] * 255); data[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, W, HT, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  out.tex = tex; renderer.initTexture(tex); out.tex2 = lightTex.tex; out.cf = lightTex.cf; renderer.initTexture(lightTex.tex);
  return out;
}

/* Pièces photographiées pour les reflets : séjour, cuisine, salles de bains d'abord. */
const ZONE_RANK = (id) => (/^sejour|^salon/.test(id) ? 6 : /^cuisine/.test(id) ? 5 : /^sdb1|^sdbs/.test(id) ? 4 : /^sdb|^sde/.test(id) ? 3 : /^suite|^ch1/.test(id) ? 1 : /^ch\d/.test(id) ? 0.5 : 0);
async function captureZones(app, apt, size, nz) {
  const { renderer, scene } = app, list = [];
  apt.levels.forEach((lv, li) => lv.rooms.forEach((r) => { if (r.cam && ZONE_RANK(r.id) > 0) list.push({ r, lv, li, k: ZONE_RANK(r.id) }); }));
  list.sort((a, b) => b.k - a.k); const zones = list.slice(0, nz);
  // les petites pièces d'abord : une salle de bains comprise dans la boîte d'un grand séjour en L garde sa propre prise
  const area = (z) => { const b = box(z.r); return (b[2] - b[0]) * (b[3] - b[1]); }, box = (r) => r.rs.reduce((q, s) => [Math.min(q[0], s[0]), Math.min(q[1], s[1]), Math.max(q[2], s[2]), Math.max(q[3], s[3])], [1e9, 1e9, -1e9, -1e9]);
  zones.sort((a, b) => area(a) - area(b));
  const nc = zones.length > 4 ? 3 : 2, nr = Math.ceil(zones.length / nc), cw = 3 * Math.max(size, 112), ch = 4 * size;
  const atlas = new THREE.WebGLRenderTarget(cw * nc, ch * nr, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, colorSpace: THREE.LinearSRGBColorSpace });
  const cube = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cc = new THREE.CubeCamera(0.05, 1500, cube);
  const uOff = { value: new THREE.Vector2() }, uSrc = { value: null };
  const blit = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uSrc, uOff, uCell: { value: new THREE.Vector2(cw, ch) }, uAtlas: { value: new THREE.Vector2(cw * nc, ch * nr) } }, depthTest: false, depthWrite: false,
    vertexShader: 'uniform vec2 uOff, uCell, uAtlas; void main() { vec2 p = ( position.xy * 0.5 + 0.5 ) * uCell + uOff; gl_Position = vec4( p / uAtlas * 2.0 - 1.0, 0.0, 1.0 ); }',
    fragmentShader: 'uniform sampler2D uSrc; uniform vec2 uOff; void main() { gl_FragColor = texelFetch( uSrc, ivec2( gl_FragCoord.xy - uOff ), 0 ); }',
  }));
  blit.frustumCulled = false; const bs = new THREE.Scene(); bs.add(blit); const bc = new THREE.Camera();
  const vis = [app.cur.pucks, app.reticle, app.hl].map((o) => [o, o.visible]); for (const [o] of vis) o.visible = false;
  const mode = app.mode, wl = app.walk.level, prevRT = renderer.getRenderTarget(), ac = renderer.autoClear, ccol = renderer.getClearColor(new THREE.Color()), calpha = renderer.getClearAlpha();
  renderer.setRenderTarget(atlas); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.setRenderTarget(prevRT);
  ZU.uZClamp.value = 24;
  const out = { atlas, n: zones.length, nc, cw, ch, mip: Math.log2(size), b: [], y: [], c: [] };
  for (const [i, z] of zones.entries()) {
    await slice(true);                                      // une prise = six rendus et un filtrage : la main revient au navigateur entre deux
    const b = box(z.r), p = new THREE.Vector3(z.r.at[0], z.lv.y + 1.45, z.r.at[1]);
    // lampes d'appoint réglées comme si l'on se tenait au centre de la pièce
    app.mode = 'walk'; app.walk.level = z.li; app.camera.position.copy(p); app.lightAt.set(1e9, 0, 0); for (let k = 0; k < 4; k++) app.updateLights(10);
    cc.position.copy(p); cc.updateMatrixWorld(); cc.update(renderer, scene);
    const pm = app.env.pmrem.fromCubemap(cube.texture);
    uSrc.value = pm.texture; uOff.value.set((i % nc) * cw, Math.floor(i / nc) * ch);
    renderer.autoClear = false; renderer.setRenderTarget(atlas); renderer.render(bs, bc); renderer.autoClear = ac; renderer.setRenderTarget(prevRT);
    pm.dispose();
    out.b.push(new THREE.Vector4(b[0], b[1], b[2], b[3])); out.y.push(new THREE.Vector4(z.lv.y, z.lv.y + z.lv.h, 0, 0)); out.c.push(new THREE.Vector4(p.x, p.y, p.z, 0));
  }
  ZU.uZClamp.value = 6e4;
  app.mode = mode; app.walk.level = wl; app.lightAt.set(1e9, 0, 0); renderer.setClearColor(ccol, calpha); for (const [o, v] of vis) o.visible = v;
  cube.dispose(); blit.geometry.dispose(); blit.material.dispose();
  return out;
}

class App {
  constructor() {
    // La qualité se lit sur un contexte jetable : l'anticrénelage du canevas se fixe à la création du vrai. Avec la chaîne de
    // post-traitement, la scène est dessinée dans ses propres tampons et le canevas ne reçoit qu'un rectangle plein : son
    // anticrénelage (4 échantillons par pixel, en pleine résolution) ne servirait à rien et coûterait jusqu'à 150 Mo.
    { let pg = null; try { pg = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); } catch (e) { pg = null; }
      qName = pickQuality(pg); const lc = pg && pg.getExtension && pg.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext(); }
    QUALITY = QUALITIES[qName]; this.qName = qName; this.gpu = GPU;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !(QUALITY.ao || QUALITY.bloom), powerPreference: 'high-performance' });
    this.dprBase = this.capDpr(Math.max(2, root.clientWidth), Math.max(2, root.clientHeight));
    this.renderer.setPixelRatio(this.dprBase);
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
    this.labelEls = []; this.spotEls = []; this.ready = false; this.aoK = 0; this.movedAt = 0; this.swapping = false;
    this.camP = new THREE.Vector3(); this.camQ = new THREE.Quaternion(); this.camF = 0;
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.44, minDistance: 5, maxDistance: 70, zoomSpeed: 0.9, rotateSpeed: 0.7, screenSpacePanning: false });
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 40), new THREE.MeshBasicMaterial({ color: 0xb86248, transparent: true, opacity: 0.85, depthTest: false }));
    this.reticle.rotation.x = -Math.PI / 2; this.reticle.renderOrder = 20; this.reticle.visible = false;
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    this.hl = new THREE.Group(); this.hl.visible = false; this.hlRoom = null;
    const hm = new THREE.MeshBasicMaterial({ color: 0xb86248, transparent: true, opacity: 0.3, depthTest: false, toneMapped: false });
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hm); m.rotation.x = -Math.PI / 2; m.renderOrder = 15; this.hl.add(m); }
    this.setupComposer(); this.initDyn(); this.bind();
    new ResizeObserver(() => this.resize()).observe(root); this.resize();
    // scène sortie de l'écran (page défilée vers le bas) : plus aucun rendu tant qu'elle n'est pas revenue
    this.onScreen = true;
    if (window.IntersectionObserver) new IntersectionObserver((es) => { const v = es[es.length - 1].isIntersecting; if (v && !this.onScreen) this.dirty = true; this.onScreen = v; }).observe(root);
  }

  /* Budget de pixels : sur un écran à forte densité, la mémoire des tampons croît comme le carré du rapport de pixels (une image
     de 1920 × 1080 à 2 pixels par point pèse près d'un gigaoctet avec l'occlusion et le halo). On plafonne donc le nombre total de
     pixels dessinés selon le niveau de qualité ; un écran ordinaire (1 pixel par point) n'est jamais touché. */
  capDpr(w, h) {
    const px = PIXEL_BUDGET[this.qName]; let d = Math.min(devicePixelRatio || 1, QUALITY.dpr);
    if (px) d = Math.min(d, Math.max(1, Math.sqrt(px / (w * h))));
    return d;
  }
  /* Échantillons de l'anticrénelage matériel du tampon principal, selon le nombre de pixels : 4 jusqu'à 1,6 million de pixels,
     2 jusqu'à 3,5, aucun au-delà (à cette densité, les marches d'escalier ne se voient plus). Seul ce tampon reçoit la scène :
     le second (celui des passes suivantes) n'a besoin ni d'échantillons ni de profondeur. */
  samplesFor(px) { return qName === 'high' ? (px <= 4.5e6 ? 4 : 2) : px <= 1.6e6 ? 4 : px <= 3.5e6 ? 2 : 0; }
  syncSamples() {
    const c = this.composer; if (!c) return;
    const px = root.clientWidth * root.clientHeight * this.dprBase * this.dprBase, s = this.samplesFor(px);
    if (c.renderTarget2.samples !== s) { c.renderTarget2.samples = s; c.renderTarget2.dispose(); this.renderer.initRenderTarget(c.renderTarget2); }
  }
  setupComposer() {
    if (!QUALITY.ao && !QUALITY.bloom) { this.composer = null; return; }
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    // la scène est toujours dessinée dans renderTarget2 (voir frame) : le premier tampon ne porte que des rectangles pleins
    this.composer.renderTarget1.samples = 0; this.composer.renderTarget1.depthBuffer = false;
    this.syncSamples();
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (QUALITY.ao) {
      this.ao = new GTAOPass(this.scene, this.camera, 4, 4);
      this.ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.5, samples: 12 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      this.ao.blendIntensity = 0.85;
      // machines modestes : l'occlusion d'écran se calcule à demi-résolution (le quart des pixels, y compris sa passe de profondeur et de
      // normales), puis se mélange à l'image en pleine résolution ; c'est un effet de grande échelle, le contact fin est dans la carte précalculée
      if (qName === 'std') { const set = this.ao.setSize.bind(this.ao); this.ao.setSize = (w, h) => set(Math.max(2, w >> 1), Math.max(2, h >> 1)); }
      // la passe de profondeur ignore la transparence : cartes de feuillage, vitres et voilages y seraient des plans pleins (carrés sombres dans le ciel, voile sur le paysage vu à travers les baies) ; le paysage lointain y serait assombri en silhouette. On les écarte
      const ro = this.ao.renderOverride.bind(this.ao);
      this.ao.renderOverride = (...args) => {
        const hid = []; this.scene.traverseVisible((o) => { const m = o.isMesh && o.material; if (m && (m.alphaTest > 0 || m.transparent)) { hid.push(o); o.visible = false; } });
        for (const o of this.env.far) if (o.visible) { hid.push(o); o.visible = false; }
        ro(...args); for (const o of hid) o.visible = true;
      };
      this.composer.addPass(this.ao);
    }
    if (QUALITY.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.1, 0.55, 2.6); this.composer.addPass(this.bloom);
      // pas de « lucioles » : un point minuscule et très lumineux (pastille d'un spot, reflet sur une poignée) tombe tantôt sur un pixel,
      // tantôt entre deux selon la position de l'œil ; le halo l'amplifiait en une lueur qui clignotait au moindre mouvement.
      // La lumière confiée au halo est donc plafonnée un peu au-dessus du seuil.
      const hp = this.bloom.materialHighPassFilter;
      hp.fragmentShader = hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = texture2D( tDiffuse, vUv ); texel.rgb *= min( 1.0, ( luminosityThreshold + 2.0 ) / max( luminance( texel.rgb ), 1e-4 ) );');
      hp.needsUpdate = true;
    }
    this.grade = makeGradePass(); this.composer.addPass(this.grade);       // étalonnage : contraste, saturation, vignettage, netteté (env.js)
    this.composer.addPass(new OutputPass());
    this.env.attachPost({ bloom: this.bloom, grade: this.grade });
    // premier rendu avec toutes les passes actives : leurs programmes sont compilés tout de suite, pas au moment où l'une d'elles s'allume (AO en entrant dans une pièce, lueur la nuit)
    const render = this.composer.render.bind(this.composer); let warm = false;
    this.composer.render = (dt) => {
      const c = this.composer, fix = () => { if (c.readBuffer !== c.renderTarget2) c.swapBuffers(); };      // la scène est toujours dessinée dans renderTarget2, le seul à porter l'anticrénelage
      if (!warm) { warm = true; const st = c.passes.map((p) => p.enabled); c.passes.forEach((p) => { p.enabled = true; }); fix(); render(dt); c.passes.forEach((p, i) => { p.enabled = st[i]; }); }
      fix(); render(dt);
    };
  }

  /* Occlusion ambiante : constante pendant la promenade. Atténuée pendant le déplacement et renforcée à l'arrêt, elle faisait
     « respirer » les angles et le pied des meubles à chaque pas ; seule la vue d'ensemble de la résidence s'en passe. Renvoie true tant qu'elle évolue. */
  updateAO(dt) {
    if (!this.ao) return false;
    const goal = this.mode === 'site' ? 0 : 0.8;
    let busy = false;
    if (Math.abs(goal - this.aoK) >= 0.004) {
      this.aoK += (goal - this.aoK) * (1 - Math.exp(-dt * (goal > this.aoK ? 2.6 : 3.2)));
      if (Math.abs(goal - this.aoK) < 0.004) this.aoK = goal;
      busy = true;
    }
    // palier de mouvement sans occlusion d'écran (machine lente) : la carte d'ombres de contact reprend le plein effet qu'elle a
    // sans elle (comme en qualité téléphone), les angles et le pied des meubles ne s'éclaircissent pas pendant le déplacement
    const k = this.aoDrop ? 0 : this.aoK;
    this.ao.blendIntensity = k; this.ao.enabled = k > 0.004;
    AOU.uAoK.value = 0.8 + 0.7 * (this.aoK - k) / 0.8;
    return busy;
  }

  /* ── Résolution dynamique ──────────────────────────────────────────────────
     L'œil juge la fluidité sur le mouvement et la qualité sur l'image arrêtée. Pendant un déplacement, si les images dépassent
     la cible (36 ms, soit moins de 28 images par seconde), la résolution baisse par paliers, et sur une machine lente l'occlusion
     d'écran s'efface ; elle remonte dès que c'est fluide. Trois dixièmes de seconde après l'arrêt de la vue, une image pleine qualité
     est rendue (pleine résolution, occlusion, halo). Seuls des réglages qui ne créent aucun programme de rendu sont employés :
     taille de l'image et activation d'une passe compilée au préchauffage. ?palier=N impose un palier, ?dyn=0 désactive. */
  initDyn() {
    const S = this.ao ? [[1, 1], [0.85, 1], [0.85, 0], [0.72, 0], [0.6, 0], [0.5, 0]] : [[1, 1], [0.85, 1], [0.72, 1], [0.6, 1], [0.5, 1]];
    const steps = S.filter(([s], i) => !i || this.dprBase * s >= 0.5 - 1e-6);
    const forced = params.get('palier'), auto = params.get('dyn') !== '0' && forced === null;
    this.dyn = { steps, auto, step: forced !== null ? clamp(Math.round(+forced) || 0, 0, steps.length - 1) : 0, floor: steps.length - 1, mode: 'still', run: 0, lastMove: 0, last: 0, prev: false, samples: [], n: 0, hold: 40, upAt: -1e9, check: 0, scale: 1 };
    this.aoDrop = false;
  }
  /* Taille de l'image : le canevas et les cibles du post-traitement sont redimensionnés, puis réalloués aussitôt (et non à la
     première passe qui s'en sert), pour que rien ne manque ni ne se crée au milieu d'une image. */
  setScale(s) { this.dyn.scale = s; this.applyPR(this.dprBase * s); }
  applyPR(pr) {
    if (Math.abs(pr - this.renderer.getPixelRatio()) < 1e-4) return;
    this.renderer.setPixelRatio(pr);
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      const rts = [this.composer.renderTarget1, this.composer.renderTarget2];
      for (const p of this.composer.passes) for (const v of Object.values(p)) { if (v && v.isWebGLRenderTarget) rts.push(v); else if (Array.isArray(v)) for (const t of v) if (t && t.isWebGLRenderTarget) rts.push(t); }
      for (const t of rts) this.renderer.initRenderTarget(t);
    }
    this.dirty = true;
  }
  /* Avant le rendu : en mouvement ou à l'arrêt ? Le mouvement, c'est la caméra qui bouge, une transition, la voiture qui arrive,
     l'heure qu'on fait glisser ; une lampe d'appoint qui s'allume lentement, vue immobile, garde l'image pleine qualité. */
  dynBefore(now, moving) {
    const d = this.dyn;
    if (moving) { d.run++; d.lastMove = now; } else d.run = 0;
    let mode = d.mode;
    if (moving && d.run >= 2) mode = 'move';                              // un seul pas isolé (survol, clic) reste en pleine qualité
    else if (!moving && mode === 'move' && now - d.lastMove > 300) mode = 'still';
    if (mode !== d.mode) { d.mode = mode; d.prev = false; d.samples.length = 0; d.n = 0; this.dirty = true; }
    const [s, ao] = mode === 'move' ? d.steps[d.step] : [1, 1];
    if (this.aoDrop !== !ao) { this.aoDrop = !ao; this.dirty = true; }
    if (s !== d.scale) { this.setScale(s); d.prev = false; }
  }
  /* Après le rendu : intervalle entre deux images consécutives du mouvement, et décision de palier. */
  dynAfter(now, rendered) {
    const d = this.dyn;
    if (!rendered || d.mode !== 'move') { d.prev = false; return; }
    const dt = now - d.last; d.last = now;
    if (!d.prev) { d.prev = true; return; }
    if (!d.auto) return;
    d.samples.push(dt); if (d.samples.length > 16) d.samples.shift(); d.n++;
    const med = (k) => { const a = d.samples.slice(-k).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
    const go = (step) => {
      if (step > d.step && now - d.upAt < 3000) d.hold = Math.min(d.hold * 2, 640);     // remonté puis redescendu aussitôt : on attend plus longtemps avant de remonter
      if (step < d.step) d.upAt = now;
      d.step = step; d.samples.length = 0; d.n = 0; d.prev = false;
    };
    // palier qui n'a rien fait gagner (la machine bute sur le processeur, pas sur la carte graphique) : on y renonce
    if (d.check && d.n >= 4) { const m = med(4), was = d.check; d.check = 0; if (m > 36 && m > was * 0.9) { d.floor = Math.max(0, d.step - 1); go(d.floor); return; } }
    if (d.step < d.floor && ((d.n >= 3 && med(3) > 72) || (d.n >= 6 && med(6) > 36))) {
      const m = med(Math.min(d.n, 6)); go(Math.min(d.floor, d.step + (m > 90 ? 2 : 1))); d.check = m; return;
    }
    if (d.step > 0 && d.n >= d.hold && med(d.samples.length) < 21) go(d.step - 1);
  }
  /* Palier de départ, d'après le temps d'une image pleine qualité mesuré à la fin du chargement : la première promenade
     n'a pas à le chercher. Le coût suit à peu près le nombre de pixels ; sans occlusion d'écran, environ deux tiers. */
  dynProbe() {
    const d = this.dyn; if (!d.auto) return;
    if (GPU.kind === 'soft') { d.step = d.floor; return; }        // rendu logiciel : le palier le plus léger d'emblée, sans payer la mesure
    // mesurée en demi-résolution (un quart des pixels) pour ne pas allonger le chargement d'une machine lente ; ×3 pour la pleine
    this.applyPR(this.dprBase * 0.5);
    const gl = this.renderer.getContext(), px = new Uint8Array(4), t = performance.now();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const ms = (performance.now() - t) * 3; d.probe = Math.round(ms);
    this.applyPR(this.dprBase * d.scale);
    let i = 0; while (i < d.steps.length - 1 && ms * d.steps[i][0] ** 2 * (d.steps[i][1] || !this.ao ? 1 : 0.65) > 30) i++;
    d.step = i;
  }

  resize() {
    const w = Math.max(2, root.clientWidth), h = Math.max(2, root.clientHeight);
    const nb = this.capDpr(w, h);
    if (Math.abs(nb - this.dprBase) > 1e-3) { this.dprBase = nb; if (this.dyn) this.renderer.setPixelRatio(nb * this.dyn.scale); }
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); this.syncSamples(); }
    this.camera.aspect = w / h; if (this.mode === 'walk' && !this.fly) this.camera.fov = this.walkFov(); this.camera.updateProjectionMatrix(); this.dirty = true;
  }

  /* Champ de vision à hauteur d'œil : celui d'un objectif d'architecture (78° à l'horizontale sur un écran large). Plus large, les pièces et les meubles paraissent étirés. */
  walkFov() { return clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(rad(100) / 2) / this.camera.aspect)), 55, 82); }

  /* ── Construction d'un logement (une seule fois, puis mis en cache) ──────── */
  /* Construction découpée en quelques tâches (niveaux, abords, fusion) : la page ne se fige pas d'un bloc ; un second appel pendant
     la construction attend la même. */
  build(apt) {
    if (this.built.has(apt.id)) return this.built.get(apt.id);
    this.building = this.building || new Map();
    if (!this.building.has(apt.id)) this.building.set(apt.id, this.buildNow(apt));
    return this.building.get(apt.id);
  }
  async buildNow(apt) {
    const group = new THREE.Group(); group.name = apt.id;      // l'orientation réelle est donnée au paysage et au soleil (env.js)
    const b = new Batch(), lv0 = apt.levels[0];
    lv0.items = lv0.items.concat((apt.garden || []).map(([t, x, z, r, o]) => [t, x, z, r, { ...o, layer: 'ext', y0: -0.015 }]));
    for (const [i, lv] of apt.levels.entries()) { buildLevel(b, this.M, lv, i); await slice(true); }
    if (apt.stair) buildStair(b, this.M, apt.stair, lv0);
    if (apt.lift) buildLift(b, this.M, apt.lift, apt.levels);
    apt.exterior(b, this.M, lv0, apt.levels[1]); await slice(true);
    const layers = b.build(group);
    // arrivée animée à la résidence (voiture, portail, porte du garage) : rangée avec le décor du site, visible avec lui
    const arrival = apt.site && layers.ctx ? makeArrival(this.M, apt.site.o) : null; if (arrival) layers.ctx.add(arrival.group);
    apt.levels.forEach((lv, i) => { const st = i === 0 && lv.rooms.find((r) => r.id === apt.start.room); buildNav(lv, ((st && st.cam) || lv.rooms.find((r) => r.cam).cam).p); });
    const lamps = b.lights.map((l) => ({ pos: l.pos, power: l.power, level: /^L(\d)/.test(l.layer) ? +l.layer[1] : 0, day: false }));
    const days = apt.levels.flatMap((lv, i) => lv.dayLights.map((l) => ({ pos: l.pos, power: l.power, level: i, day: true })));
    // fond de maquette : un plan qui ne montre que l'ombre portée du logement
    const bb = lv0.bounds, catcher = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ opacity: 0.2 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.set((bb[0] + bb[2]) / 2, -0.34, (bb[1] + bb[3]) / 2); catcher.receiveShadow = true; catcher.visible = false; group.add(catcher);
    // repères au sol de la visite libre : un anneau par pièce, là où l'on se place pour la regarder
    const pucks = new THREE.Group(); pucks.visible = false; group.add(pucks);
    const ring = new THREE.RingGeometry(0.15, 0.21, 40), dot = new THREE.CircleGeometry(0.05, 20), pm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, toneMapped: false });
    apt.levels.forEach((lv, i) => lv.rooms.forEach((room) => { if (!room.cam) return; const g = new THREE.Group(); g.add(new THREE.Mesh(ring, pm), new THREE.Mesh(dot, pm)); g.rotation.x = -Math.PI / 2; g.position.set(room.cam.p[0], lv.y + 0.02, room.cam.p[1]); g.userData = { room, level: i }; pucks.add(g); }));
    const out = { group, layers, lights: lamps.concat(days), catcher, pucks, arrival };
    this.built.set(apt.id, out);
    return out;
  }

  async load(apt, opts = {}) {
    this.uncull(); this.stopTour(); this.fly = null; this.ready = false;
    ui.loader.hidden = false; ui.loaderText.textContent = tr(this.M ? 'loadGeo' : 'loadTex'); this.progress(0.03);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    // textures dessinées par tranches, la page reste vivante ; un second chargement lancé entre-temps (autre logement choisi)
    // attend la même fabrication au lieu d'en commencer une autre
    if (!this.M && !this.matP) { performance.mark('v3d:mat0'); let n = 0; this.matP = makeMaterialsAsync(QUALITY, () => { this.progress(0.03 + 0.27 * Math.min(1, ++n / 130)); return slice(); }); }
    const fresh = !this.M && await this.matP;
    if (fresh && !this.M) {
      this.M = fresh; performance.mark('v3d:mat1');
      depthPriority(this.M); aoPatchMaterials(this.M);
      // miroirs et métaux reflètent un intérieur neutre plutôt que le ciel
      const room = this.env.pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      this.roomMats = ['mirror', 'steel', 'brass', 'floor', 'tile', 'wallTile', 'marble', 'marbleDark', 'marbleGrey', 'ceramic', 'tubIn', 'glassSmoke', 'screen', 'lacquer', 'greyLacquer', 'anthracite', 'black', 'potDark', 'crystal', 'oak', 'oakV', 'walnut', 'door', 'frame', 'skirt', 'cognac'];
      for (const k of this.roomMats) { const m = this.M[k]; m.envMap = room; m.userData.zone = true; m.userData.envK = k === 'mirror' ? 1.5 : k === 'floor' ? 0.75 : k === 'steel' || k === 'brass' ? 1 : (m.envMapIntensity || 1) * 0.6; m.envMapIntensity = m.userData.envK; }
      ui.loaderText.textContent = tr('loadGeo'); this.progress(0.3); await new Promise((r) => setTimeout(r, 30));
    }
    const prev = this.apt && this.built.get(this.apt.id);
    const cur = await this.build(apt); performance.mark('v3d:build'); this.progress(0.5); await slice(true);
    if (prev) this.scene.remove(prev.group);
    this.scene.add(cur.group); cur.group.add(this.camera, this.reticle, this.hl);
    // ombres de contact : calculées une fois par logement, au premier chargement
    if (!cur.ao) { cur.group.updateMatrixWorld(true); cur.ao = await bakeContact(this.renderer, this.scene, cur.group, apt, this.M, QUALITY.tex, cur.lights); performance.mark('v3d:bake'); }
    AOU.uAoMap.value = cur.ao.tex; AOU.uAoT0.value.copy(cur.ao.t0); AOU.uAoT1.value.copy(cur.ao.t1); AOU.uAoA.value.copy(cur.ao.a); AOU.uAoLv.value.copy(cur.ao.lv); AOU.uAoSplit.value = cur.ao.split; AOU.uAoMap2.value = cur.ao.tex2; AOU.uAoCf.value = cur.ao.cf;
    AOU.uAoK.value = QUALITY.ao ? 0.8 : 1.5;              // avec l'occlusion d'écran (qualités hautes), la carte ne fait plus que le voile large
    this.apt = apt; this.cur = cur; this.viewLevel = 0; this.mode = 'orbit'; this.lastRoom = null; this.hourBack = undefined;
    Object.assign(this.walk, { level: 0, path: null, look: null, climbing: null, riding: null, spin: null, onArrive: null, floorY: undefined });
    // lumières d'appoint : un petit nombre de sources, réattribuées aux lampes ou aux baies les plus proches
    for (const p of this.pool) p.removeFromParent();
    this.pool = Array.from({ length: QUALITY.lights }, () => { const p = new THREE.PointLight(0xffffff, 0, 9, 1.6); p.userData = { src: null, goal: 0, next: null }; cur.group.add(p); return p; });
    this.lightAt.set(1e9, 0, 0);
    ui.loaderText.textContent = tr('loadEnv'); this.progress(0.62); await new Promise((r) => setTimeout(r, 30));
    cur.group.updateMatrixWorld(true);
    const lv = apt.levels[0], bb = lv.bounds;
    const c = cur.group.localToWorld(new THREE.Vector3((bb[0] + bb[2]) / 2, 1.5, (bb[1] + bb[3]) / 2));
    this.env.setSite(apt, this.M, c, Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 3);
    // Ordre de dessin : l'intérieur d'abord, l'extérieur (abords, plantations, paysage) ensuite, le ciel en dernier. Les cartes graphiques
    // écartent alors, avant même de les ombrer, les pixels d'extérieur cachés derrière les murs : feuillages et haies, très
    // coûteux par pixel, ne sont plus ombrés que là où une baie les montre.
    for (const g of [this.env.land, this.env.near, cur.layers.ctx, cur.layers.ext, cur.layers['ext:top']]) if (g) g.traverse((o) => { if (o.isMesh && o.renderOrder < 1) o.renderOrder = 1; });
    this.setHour(Number(params.get('h')) || apt.hour || 11, true);      // l'heure où le soleil entre dans le séjour
    this.fillUI(); performance.mark('v3d:env');
    ui.loaderText.textContent = tr('loadEnv'); this.progress(0.7); await new Promise((r) => setTimeout(r, 30));
    if (!cur.zones) {                                         // reflets des pièces : photographiées de jour, une fois par logement
      const h0 = this.hour, dark = this.night > 0.3;
      this.applyView(false);
      // les prises de vue compileraient d'un bloc, au premier rendu, tous les programmes de la scène : on les compile d'abord en
      // parallèle (hors du fil principal quand le navigateur le permet)
      try { await this.compileScene(); } catch (e) { /* compilées au rendu */ }
      if (dark) { this.setHour(12, true); this.env.updateEnvMap(this.env.envK); }
      cur.zones = await captureZones(this, apt, 128, qName === 'low' || qName === 'soft' ? 4 : 6);      // hors téléphones, les chambres principales ont aussi leur prise (atlas 1152 × 1024)
      if (dark) { this.setHour(h0, true); this.env.updateEnvMap(this.env.envK); }
    }
    performance.mark('v3d:zones'); this.useZones(cur.zones); this.progress(0.85);
    await this.warmUp(); performance.mark('v3d:warm');
    const room = opts.room && this.findRoom(opts.room);
    if (opts.mode === 'walk' || room) { const r = room || this.findRoom(apt.start.room); this.enterWalk(r.room, r.level, true); }
    else if (opts.mode === 'plan') this.setMode('plan', true);
    else if (opts.mode === 'site') { this.setMode('orbit', true); this.setMode('site', true); }
    else this.setMode('orbit', true);
    this.dynProbe(); this.progress(1);
    this.ready = true; ui.loader.hidden = true; root.classList.add('is-ready'); this.dirty = true; setTimeout(() => root.classList.add('is-seen'), 1200);
    window.__v3dReady = true;
  }

  /* Préchauffage : tout ce que le visiteur verra plus tard est préparé ici, pendant le chargement. Sans lui, la première
     entrée dans une pièce compilait une quinzaine de programmes de rendu et envoyait des centaines de géométries et de
     textures à la carte graphique en une seule image : l'écran se figeait plus d'une seconde. */
  async warmUp() {
    this.uncull();
    const c = this.cur, layers = Object.values(c.layers), was = layers.map((g) => g.visible), cw = c.catcher.visible, pw = c.pucks.visible;
    for (const g of layers) g.visible = true; c.catcher.visible = true; c.pucks.visible = true;
    // envoi des textures une à une (le dessin des canvas peut n'être achevé qu'à cet envoi) : la main revient au navigateur entre deux
    const texs = new Set(); for (const m of Object.values(this.M)) for (const k of ['map', 'bumpMap', 'roughnessMap', 'normalMap', 'alphaMap', 'emissiveMap', 'aoMap']) if (m && m[k] && m[k].isTexture) texs.add(m[k]);
    for (const t of texs) { this.renderer.initTexture(t); await slice(); }
    // un objet hors du champ de la caméra n'est envoyé à la carte graphique qu'à sa première apparition : on désactive l'élimination
    // hors champ le temps de ce rendu, pour que tout soit prêt avant la première promenade
    const culled = []; this.scene.traverse((o) => { if (o.isMesh && o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    // le soleil reste allumé jour et nuit (la lune prend son relais) : le nombre de lumières ne change pas, seuls la promenade
    // et le mode maquette (ciel et paysage masqués, passes différentes) demandent chacun leurs programmes
    // compilation parallèle quand le navigateur la permet (les programmes se compilent hors du fil principal, la page ne se fige pas) ;
    // les rendus de préchauffage se font sur une vignette : programmes, textures et géométries sont prêts de la même façon, sans
    // payer deux images pleine taille (plusieurs secondes sur une machine lente)
    const pr = this.renderer.getPixelRatio(); this.applyPR(Math.min(pr, 96 / Math.max(96, root.clientWidth)));
    try {
      for (const studio of [false, true]) {
        this.env.setStudio(studio, !!this.composer);
        await this.compileScene();
        this.progress(studio ? 0.97 : 0.92);
        if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
        await slice(true);
      }
    } catch (e) { console.warn('préchauffage', e); }
    this.applyPR(pr);
    for (const o of culled) o.frustumCulled = true;
    layers.forEach((g, i) => { g.visible = was[i]; }); c.catcher.visible = cw; c.pucks.visible = pw;
    this.renderer.shadowMap.needsUpdate = true; this.dirty = true;
  }

  /* Compilation des programmes de rendu de toute la scène, objet par objet, la main rendue au navigateur entre deux tranches : sans
     compilation parallèle (rendu logiciel, certains pilotes), compiler d'un bloc figeait la page plus de vingt secondes.
     Avec la chaîne de post-traitement, la scène est toujours dessinée dans ses tampons (lumière linéaire, courbe de tons appliquée
     à la fin) : c'est cette variante qu'il faut compiler. Compilée pour l'écran, elle ne servait jamais et doublait les programmes. */
  async compileScene() {
    const r = this.renderer, rt = this.composer ? this.composer.renderTarget1 : null, prev = r.getRenderTarget(), objs = [];
    this.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) objs.push(o); });
    for (const o of objs) { r.setRenderTarget(rt); try { r.compile(o, this.camera, this.scene); } finally { r.setRenderTarget(prev); } await slice(); }
    // compilation parallèle (cartes graphiques qui la proposent) : on attend que tout soit prêt ; rien n'est recompilé ici
    r.setRenderTarget(rt); let done; try { done = r.compileAsync(this.scene, this.camera); } finally { r.setRenderTarget(prev); }
    await done;
  }

  progress(f) { if (ui.bar) ui.bar.style.transform = `scaleX(${f.toFixed(3)})`; }

  useZones(z) {
    ZU.uZAtlas.value = z.atlas.texture; ZU.uZn.value = z.n; ZU.uZg.value.set(z.nc, Math.ceil(z.n / z.nc), 1 / z.cw, 1 / z.ch); ZU.uZmip.value = z.mip;
    for (let i = 0; i < NZ; i++) { ZU.uZb.value[i].copy(z.b[i] || ZU.uZb.value[i]); ZU.uZy.value[i].copy(z.y[i] || ZU.uZy.value[i]); ZU.uZc.value[i].copy(z.c[i] || ZU.uZc.value[i]); }
  }

  findRoom(id) { for (let i = 0; i < this.apt.levels.length; i++) { const room = this.apt.levels[i].rooms.find((r) => r.id === id); if (room) return { room, level: i }; } return null; }
  roomAt(level, x, z) { return this.apt.levels[level].rooms.find((r) => r.rs.some((q) => x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3])); }

  /* ── Extérieur invisible : on ne le dessine pas ──────────────────────────────────────────────────────────────────────
     Depuis l'intérieur, le ciel, le paysage, les abords et les plantations ne se voient que par les baies et les fenêtres. Tant
     qu'aucune ouverture de façade n'est dans le champ de la caméra (regard vers un mur, un couloir, une salle de bains), tout cela
     est masqué : c'est près de la moitié du coût d'une image depuis un séjour. Rien n'est créé ni compilé : seule la visibilité
     change, et l'image est strictement la même, puisque ces objets seraient cachés derrière les murs. Les ouvertures, élargies
     de 30 cm, sont relevées une fois par logement. ?cull=0 désactive. */
  portals() {
    const cur = this.cur; if (cur.portals) return cur.portals;
    cur.group.updateMatrixWorld(true); const P = [], pad = 0.5, apt = this.apt;
    // murs qui arrêtent le regard (les parapets et cloisons basses ne comptent pas), avec leurs ouvertures
    const walls = apt.levels.map((lv) => lv.walls.filter((w) => (w.h ?? lv.h) >= 1.9).map((w) => ({ k: w.k, c: w.c, a0: w.a0, a1: w.a1, gaps: (w.ops || []).map((o) => [o.a0 - 0.02, o.a1 + 0.02]) })));
    apt.levels.forEach((lv, li) => lv.walls.forEach((w) => {
      if (!w.ext) return; const t = (w.t || 0.3) / 2, zs = w.ext < 0 ? -1 : 1;      // ext : côté extérieur du mur (±1 sur son axe normal)
      for (const o of w.ops || []) {
        const y0 = lv.y + (o.sill ?? 0) - 0.1, y1 = lv.y + (o.head ?? lv.h) + 0.1;
        const lo = w.k === 'h' ? new THREE.Vector3(o.a0 - pad, y0, w.c - t - pad) : new THREE.Vector3(w.c - t - pad, y0, o.a0 - pad);
        const hi = w.k === 'h' ? new THREE.Vector3(o.a1 + pad, y1, w.c + t + pad) : new THREE.Vector3(w.c + t + pad, y1, o.a1 + pad);
        P.push({ li, k: w.k, c: w.c, zs, t, a0: o.a0 - 0.25, a1: o.a1 + 0.25, box: new THREE.Box3(lo, hi).applyMatrix4(cur.group.matrixWorld) });
      }
    }));
    // trémies par où l'on voit un autre niveau : l'escalier et la gaine de l'ascenseur
    const voids = [];
    if (apt.stair && apt.stair.steps) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const st of apt.stair.steps) for (const [x, z] of st) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } voids.push([x0 - 1, z0 - 1, x1 + 1, z1 + 1]); }
    if (apt.lift) voids.push([apt.lift.x0 - 0.6, apt.lift.y0 - 0.6, apt.lift.x1 + 0.6, apt.lift.y1 + 0.6]);
    const yTop = Math.max(...apt.levels.map((lv) => lv.y + lv.h)) + 0.3, yBot = Math.min(...apt.levels.map((lv) => lv.y)) - 0.3;
    const vbox = voids.map((v) => new THREE.Box3(new THREE.Vector3(v[0], yBot, v[1]), new THREE.Vector3(v[2], yTop, v[3])).applyMatrix4(cur.group.matrixWorld));
    return (cur.portals = { P, walls, voids, vbox });
  }
  /* Que voit-on d'ici ? Renvoie { out, other } : l'extérieur d'une part, les niveaux autres que celui de la caméra d'autre part.
     L'extérieur est visible si une ouverture de façade est dans le champ de la caméra ET joignable en ligne droite, sur le plan,
     sans traverser un mur (les portes et passages sont comptés ouverts, par prudence). Un autre niveau n'est visible que par une
     trémie (escalier, gaine d'ascenseur) dans le champ et joignable de même ; une baie d'un autre niveau, que par une trémie.
     Les cibles balaient les ouvertures tous les 6 cm, élargies de 25 cm : un coin de baie entrevu par une porte étroite compte. */
  view() {
    const all = { out: true, other: true }, w = this.walk;
    if (this.mode !== 'walk' || params.get('cull') === '0' || this.renderer.shadowMap.needsUpdate || w.climbing || w.riding || this.fly) return all;
    const r = this.lastRoom; if (!r) return all;
    const cam = this.camera; cam.updateMatrixWorld();
    this._fr = this._fr || new THREE.Frustum(); this._m = this._m || new THREE.Matrix4(); this._mi = this._mi || new THREE.Matrix4();
    // champ élargi d'un dixième : une ouverture qui n'effleure que le bord de l'image compte, rien n'apparaît ni ne disparaît à l'arête
    this._pm = (this._pm || new THREE.Matrix4()).copy(cam.projectionMatrix); this._pm.elements[0] *= 0.9; this._pm.elements[5] *= 0.9;
    this._fr.setFromProjectionMatrix(this._m.multiplyMatrices(this._pm, this._mi.copy(cam.matrixWorld).invert()));
    const { P, walls, voids, vbox } = this.portals(), px = cam.position.x, pz = cam.position.z, lv = w.level ?? 0;
    const blocked = (W, qx, qz) => {
      for (const wl of W) {
        const h = wl.k === 'h', d0 = (h ? pz : px) - wl.c, d1 = (h ? qz : qx) - wl.c; if (d0 * d1 >= 0) continue;
        const u = d0 / (d0 - d1), x = h ? px + (qx - px) * u : pz + (qz - pz) * u;      // abscisse du croisement le long du mur
        if (x < wl.a0 || x > wl.a1) continue; let gap = false; for (const g of wl.gaps) if (x >= g[0] && x <= g[1]) { gap = true; break; }
        if (!gap) return true;
      }
      return false;
    };
    const throughVoid = (qx, qz) => { for (const v of voids) for (let i = 0; i <= 12; i++) { const x = px + (qx - px) * i / 12, z = pz + (qz - pz) * i / 12; if (x >= v[0] && x <= v[2] && z >= v[1] && z <= v[3]) return true; } return false; };
    // autres niveaux : une trémie dans le champ, dont un point (coins, centre, bords) est joignable
    let other = false;
    for (let i = 0; i < voids.length && !other; i++) {
      if (!this._fr.intersectsBox(vbox[i])) continue; const v = voids[i];
      if (px >= v[0] && px <= v[2] && pz >= v[1] && pz <= v[3]) { other = true; break; }                  // la caméra est dans la trémie
      for (let a = 0; a <= 4 && !other; a++) for (let b = 0; b <= 4; b++) if (!blocked(walls[lv], v[0] + (v[2] - v[0]) * a / 4, v[1] + (v[3] - v[1]) * b / 4)) { other = true; break; }
    }
    if (/jardin|balcon|terrasse/.test(r.id)) return all;                  // dehors, on voit la façade entière, tous niveaux
    let out = false;
    for (const q of P) {
      if (!this._fr.intersectsBox(q.box)) continue;
      const n = Math.max(1, Math.ceil((q.a1 - q.a0) / 0.06)), off = q.c - q.zs * (q.t + 0.05);
      for (let i = 0; i <= n && !out; i++) {
        const a = q.a0 + (q.a1 - q.a0) * i / n, qx = q.k === 'h' ? a : off, qz = q.k === 'h' ? off : a;
        if (q.li === lv ? !blocked(walls[lv], qx, qz) : throughVoid(qx, qz)) out = true;
      }
      if (out) break;
    }
    return { out, other };
  }
  hiddenSet(v) {
    const L = this.cur.layers, lv = this.walk.level ?? 0, set = [];
    if (!v.out) set.push(this.env.sky, this.env.land, this.env.near, L.ctx, L.ext, L['ext:top']);
    if (!v.other) for (const [name, g] of Object.entries(L)) { const m = /^L(\d)(:top)?$/.exec(name); if (m && +m[1] !== lv) set.push(g); }
    return set.filter(Boolean);
  }
  cullOutdoor() {
    const v = this.view(), st = this.cullStats || (this.cullStats = { frames: 0, out: 0, other: 0 });
    if (this.mode === 'walk') { st.frames++; if (!v.out) st.out++; if (!v.other) st.other++; }
    this.uncull(); if (v.out && v.other) return;
    this.culled = this.hiddenSet(v).map((o) => [o, o.visible]); for (const [o] of this.culled) o.visible = false;
  }
  uncull() { if (!this.culled) return; for (const [o, vis] of this.culled) o.visible = vis; this.culled = null; }

  /* ── Calques visibles : en maquette et en plan, on coupe le niveau regardé et on masque ce qui est au-dessus ── */
  applyView(cut) {
    this.uncull();
    for (const [name, g] of Object.entries(this.cur.layers)) {
      const m = /^L(\d)(:top|:cap)?$/.exec(name); let vis = true;
      if (cut) { if (m) { const i = +m[1]; vis = m[2] === ':cap' ? i === this.viewLevel : i < this.viewLevel || (i === this.viewLevel && !m[2]); } else if (name === 'ext:top' || name === 'ctx') vis = false; }
      else if (m && m[2] === ':cap') vis = false;
      g.visible = vis;
    }
    this.cur.catcher.visible = cut; this.cur.pucks.visible = !cut; this.env.setStudio(cut, !!this.composer);
    if (this.hl) this.hl.visible = false;
    this.cutView = cut; this.renderer.shadowMap.needsUpdate = true; this.lightAt.set(1e9, 0, 0); this.dirty = true;
    this.dyn.floor = this.dyn.steps.length - 1;                // autre vue, autre charge : la résolution dynamique peut de nouveau tout essayer
  }

  orbitPose(plan) {
    const a = this.apt, lv = a.levels[this.viewLevel], bb = lv.bounds, y = lv.y;
    if (plan) { const cx = (bb[0] + bb[2]) / 2, cz = (bb[1] + bb[3]) / 2, span = Math.max(bb[2] - bb[0], (bb[3] - bb[1]) * this.camera.aspect * 1.05) / this.camera.aspect; const d = (span / 2) / Math.tan(rad(FOV_PLAN) / 2) * 1.12; return { target: new THREE.Vector3(cx, y, cz), pos: new THREE.Vector3(cx, y + d, cz + 0.01) }; }
    const cut = Math.min(1.25, lv.h), t = new THREE.Vector3((bb[0] + bb[2]) / 2, y + cut * 0.4, (bb[1] + bb[3]) / 2);
    const dir = new THREE.Vector3(0.2, 0.777, 0.596).normalize(), fwd = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const tv = Math.tan(rad(FOV_ORBIT) / 2), th = tv * this.camera.aspect, H = root.clientHeight || 600, mx = 0.95, my = Math.max(0.6, 1 - 118 / H);   // marges : barres d'outils en haut et en bas
    let dist = 8; const p = new THREE.Vector3();
    for (const cx of [bb[0], bb[2]]) for (const cz of [bb[1], bb[3]]) for (const cy of [y, y + cut]) {
      p.set(cx, cy, cz).sub(t); const px = Math.abs(p.dot(right)), py = Math.abs(p.dot(up)), pz = p.dot(fwd);
      dist = Math.max(dist, px / (th * mx) - pz, py / (tv * my) - pz);
    }
    return { target: t, pos: t.clone().addScaledVector(dir, dist) };
  }

  /* Fondu enchaîné : l'image se voile, la vue change à couvert, puis elle revient. Aucune géométrie ne « saute » à l'écran. */
  fadeSwap(fn) {
    if (this.swapping) { fn(); return; }
    this.swapping = true; ui.fade.classList.add('is-light', 'is-on');
    setTimeout(() => { fn(); this.dirty = true; setTimeout(() => { ui.fade.classList.remove('is-on'); this.swapping = false; }, 90); }, 270);
  }

  setMode(mode, instant) {
    if (mode === 'site') return this.enterSite(instant);
    if (mode === 'walk') { this.stopTour(); const r = this.findRoom(this.apt.start.room); return this.enterWalk(this.lastRoom || r.room, this.lastRoom ? this.lastLevel : r.level, instant); }
    if (this.mode === 'walk' && !instant) return this.fadeSwap(() => this.setMode(mode, true));
    this.stopTour(); Object.assign(this.walk, { path: null, climbing: null, riding: null, spin: null });
    if (this.mode === 'walk') this.viewLevel = Math.min(this.walk.level, this.apt.levels.length - 1);
    if (this.mode === 'site') this.leaveSite();
    this.mode = mode; this.applyView(true); this.syncUI();
    this.camera.near = 1.2; this.camera.far = 700; this.camera.updateProjectionMatrix();      // vue lointaine : tampon de profondeur resserré, pas de surfaces qui se chevauchent à l'œil
    const plan = mode === 'plan', pose = this.orbitPose(plan), c = this.controls;
    const done = () => {
      c.target.copy(pose.target); c.enabled = true; c.enableRotate = !plan;
      c.minPolarAngle = plan ? 0.02 : 0.05; c.maxPolarAngle = plan ? 0.02 : 1.44;
      c.minAzimuthAngle = plan ? 0 : -Infinity; c.maxAzimuthAngle = plan ? 0 : Infinity;      // en plan, l'orientation est verrouillée
      c.minDistance = plan ? 14 : 6; c.maxDistance = plan ? 150 : 170;
      c.mouseButtons.LEFT = plan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; c.touches.ONE = plan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
      c.update(); this.dirty = true;
    };
    c.enabled = false;
    this.flyTo({ pos: pose.pos, look: pose.target, fov: plan ? FOV_PLAN : FOV_ORBIT, dur: instant ? 0 : 1.1, done });
    this.showHint(plan ? 'hintPlan' : 'hintOrbit');
  }

  /* ── Vue d'ensemble : l'immeuble dans son site, d'après le plan de masse et les façades ; les deux logements à vendre y sont repérés ── */
  enterSite(instant) {
    if (this.mode === 'walk' && !instant) return this.fadeSwap(() => this.enterSite(true));
    this.stopTour(); Object.assign(this.walk, { path: null, climbing: null, riding: null, spin: null });
    if (this.mode === 'walk') this.viewLevel = Math.min(this.walk.level, this.apt.levels.length - 1);
    if (this.mode !== 'site') { this.hourBack = this.hour; this.setHour(10.5, true); }       // soleil du matin sur la façade Est, côté avenue
    this.mode = 'site'; this.applyView(false); this.cur.pucks.visible = false; this.lotMarks.visible = true; this.syncUI();
    const o = this.apt.site.o, c = this.controls, t = new THREE.Vector3(SITE.center[0] - o[0], SITE.center[1] - o[1], SITE.center[2] - o[2]);
    this.env.focus(t, 56);
    this.camera.near = 1.5; this.camera.far = 3200; this.camera.updateProjectionMatrix();
    const pos = t.clone().add(new THREE.Vector3(0.8, 0.34, -0.5).normalize().multiplyScalar(this.camera.aspect < 1 ? 118 : 78));
    const done = () => {
      c.target.copy(t); c.enabled = true; c.enableRotate = true; c.minPolarAngle = 0.25; c.maxPolarAngle = 1.5; c.minAzimuthAngle = -Infinity; c.maxAzimuthAngle = Infinity;
      c.minDistance = 28; c.maxDistance = 170; c.mouseButtons.LEFT = THREE.MOUSE.ROTATE; c.touches.ONE = THREE.TOUCH.ROTATE; c.update(); this.dirty = true;
      if (this.mode === 'site' && this.cur.arrival && !this.cur.arrival.active) this.cur.arrival.start();      // la voiture arrive par l'avenue
    };
    c.enabled = false;
    this.flyTo({ pos, look: t, fov: 32, dur: instant ? 0 : 1.2, done });
    this.showHint('hintSite');
  }
  leaveSite() {
    if (this.cur.arrival) this.cur.arrival.reset();
    if (this.hourBack !== undefined) { const h = this.hourBack; this.hourBack = undefined; this.setHour(h, true); }
    this.lotMarks.visible = false;
    const bb = this.apt.levels[0].bounds; this.env.focus(this.cur.group.localToWorld(new THREE.Vector3((bb[0] + bb[2]) / 2, 1.5, (bb[1] + bb[3]) / 2)), Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 3);
  }
  /* Volumes des deux logements à vendre, teintés par transparence dans l'immeuble, et leurs étiquettes. */
  makeLots() {
    if (this.lotMarks) this.lotMarks.removeFromParent();
    this.lotMarks = new THREE.Group(); this.lotMarks.visible = this.mode === 'site'; this.cur.group.add(this.lotMarks);
    const o = this.apt.site.o, fill = new THREE.MeshBasicMaterial({ color: 0xb86248, transparent: true, opacity: 0.2, depthTest: false, toneMapped: false }), edge = new THREE.LineBasicMaterial({ color: 0xb86248, depthTest: false, toneMapped: false });
    ui.lots.textContent = ''; this.lotEls = [];
    for (const [key, lot] of Object.entries(SITE.lots)) {
      for (const q of lot.boxes) {
        const g = new THREE.BoxGeometry(q[3] - q[0] + 0.5, q[4] - q[1] + 0.3, q[5] - q[2] + 0.5), m = new THREE.Mesh(g, fill), l = new THREE.LineSegments(new THREE.EdgesGeometry(g), edge);
        for (const x of [m, l]) { x.position.set((q[0] + q[3]) / 2 - o[0], (q[1] + q[4]) / 2 - o[1], (q[2] + q[5]) / 2 - o[2]); x.renderOrder = 12; this.lotMarks.add(x); }
      }
      const apt = APARTMENTS.find((a) => a.site.key === key), here = apt === this.apt, el = document.createElement('button');
      el.type = 'button'; el.className = 'v3d-label v3d-lot' + (here ? ' is-here' : ''); el.textContent = apt.name[lang()];
      const sm = document.createElement('small'); sm.textContent = tr(key === 'villa' ? 'lotVilla' : 'lotDuplex'); el.appendChild(sm);
      el.addEventListener('click', () => { if (here) this.setMode('orbit'); else { this.lastRoom = null; this.load(apt); } });
      ui.lots.appendChild(el); this.lotEls.push({ el, v: new THREE.Vector3(lot.at[0] - o[0], lot.at[1] - o[1], lot.at[2] - o[2]) });
    }
  }
  updateLots() {
    const show = this.mode === 'site' && !this.fly; if (ui.lots.hidden === show) ui.lots.hidden = !show; if (!show) return;
    const w = root.clientWidth, h = root.clientHeight, v = new THREE.Vector3();
    for (const L of this.lotEls) { v.copy(L.v); this.cur.group.localToWorld(v); v.project(this.camera); const ok = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05; L.el.hidden = !ok; if (ok) L.el.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2 * w).toFixed(1)}px,${((1 - v.y) / 2 * h).toFixed(1)}px)`; }
  }

  /* Entre dans une pièce à hauteur d'œil. */
  enterWalk(room, level, instant, at) {
    if (!instant && this.mode !== 'walk') return this.fadeSwap(() => { this.enterWalk(room, level, true, at); if (!this.tour && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.lookAround(); });
    if (this.mode === 'site') this.leaveSite();
    this.controls.enabled = false; this.fly = null;
    const lv = this.apt.levels[level];
    let cam = room.cam || { p: room.at, t: [room.at[0] + 1, room.at[1]] };
    if (at && Math.hypot(at[0] - room.at[0], at[1] - room.at[1]) > 0.9) cam = { p: at, t: room.at };      // on entre là où l'on a cliqué, tourné vers le centre de la pièce
    const p = nearestFree(lv.nav, cam.p[0], cam.p[1], 2) || cam.p;
    this.lastRoom = room; this.lastLevel = level; this.spotSnap = true;
    const w = this.walk; Object.assign(w, { level, x: p[0], z: p[1], path: null, look: null, climbing: null, onArrive: null, riding: null, spin: null, floorY: undefined, liftLock: true });
    w.yaw = Math.atan2(p[0] - cam.t[0], p[1] - cam.t[1]); w.pitch = cam.pitch === undefined ? -0.1 : cam.pitch;
    this.mode = 'walk'; this.viewLevel = level;
    this.camera.near = 0.08; this.camera.far = 3200; this.camera.fov = this.walkFov(); this.camera.updateProjectionMatrix();
    this.applyView(false); this.syncUI(); this.placeCamera(); this.updateHud();
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
    this.hour = h; if (!force) this.hourMovedAt = performance.now();      // l'heure qui glisse (curseur, boutons) compte comme un mouvement
    this.night = this.env.setHour(h);
    const n = this.night, M = this.M;
    M.lampShade.emissiveIntensity = n * 1.25; M.led.emissiveIntensity = 1.0 + n * 0.8;      // rubans LED et lustres allumés même de jour, comme sur les images
    M.glass.opacity = 0.1 + n * 0.08;
    AOU.uAoDay.value = (1 - n) * clamp(this.env.dir.y * 3 + 0.35, 0.35, 1); AOU.uAoNight.value = n * 0.5;      // carte de lumière : jour des baies, lueur des lampes
    if (this.roomMats) for (const k of this.roomMats) M[k].envMapIntensity = M[k].userData.envK * (1 - n * 0.8);
    this.lightAt.set(1e9, 0, 0); this.dirty = true;
    const out = $('#v3d-time-out'); if (out) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); out.textContent = `${hh} h ${String(mm).padStart(2, '0')}`; }
    const range = $('#v3d-time'); if (range && Number(range.value) !== h) range.value = h;
    $$('[data-hour]').forEach((b) => b.classList.toggle('is-on', Math.abs(Number(b.dataset.hour) - h) < 0.26));
  }

  /* Réattribue les sources d'appoint aux lampes (le soir) ou aux baies (le jour) les plus proches du regard. */
  updateLights(dt = 0.016) {
    const focus = this.mode === 'walk' ? this.camera.position : this.controls.target, set = (p, l) => { p.position.copy(l.pos); if (l.day) p.color.copy(this.env.bounce); else p.color.set(0xffc98a); p.distance = l.day ? 9 : 7.5; };
    if (focus.distanceToSquared(this.lightAt) > 0.25) {
      this.lightAt.copy(focus);
      const n = this.night, lvl = this.mode === 'walk' ? this.walk.level : this.viewLevel, wide = this.mode !== 'walk';
      const dayK = (1 - n) * clamp(this.env.dir.y * 3 + 0.25, 0.25, 1), list = [];
      for (const l of this.cur.lights) {
        if (this.cutView && l.level > this.viewLevel) continue;
        const k = l.day ? dayK * 2.1 : n * 4.2; if (k < 0.05) continue;
        const d2 = l.pos.distanceToSquared(focus) + (l.level === lvl ? 0 : 60);
        list.push({ l, I: l.power * k, s: (l.power * k) / (1 + d2 / (wide ? 900 : 30)) });
      }
      list.sort((a, b) => b.s - a.s);
      const want = new Map(list.slice(0, this.pool.length).map((it) => [it.l, it.I]));
      for (const p of this.pool) { const u = p.userData; if (u.src && !want.has(u.src)) u.goal = 0; u.next = null; }
      for (const [l, I] of want) {
        let p = this.pool.find((q) => q.userData.src === l);
        if (!p) { p = this.pool.find((q) => !q.userData.src); if (p) { p.userData.src = l; p.intensity = 0; set(p, l); } else { p = this.pool.find((q) => q.userData.goal === 0 && !q.userData.next); if (p) p.userData.next = { l, I }; continue; } }
        p.userData.goal = I;
      }
    }
    let busy = false;
    for (const p of this.pool) {
      const u = p.userData, d = u.goal - p.intensity;
      if (u.src && u.src.day) p.color.copy(this.env.bounce);      // le rebond des baies suit la couleur du ciel, même quand l'heure glisse
      if (Math.abs(d) > 0.02) { p.intensity += d * Math.min(1, dt * 1.6); busy = true; }      // relais lent entre lampes d'appoint : rien ne s'allume d'un coup en marchant
      else { p.intensity = u.goal; if (u.goal === 0 && u.src) { u.src = null; if (u.next) { u.src = u.next.l; u.goal = u.next.I; u.next = null; set(p, u.src); busy = true; } } }
    }
    if (busy) this.dirty = true;
  }

  /* ── Déplacements à hauteur d'œil ───────────────────────────────────────── */
  /* Avance en ligne droite de (x0,z0) vers (x1,z1) tant que le sol est libre ; renvoie le dernier point libre. */
  march(x0, z0, x1, z1) {
    const nav = this.apt.levels[this.walk.level].nav, d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.05); let best = null;
    for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (!cellFree(nav, x, z)) break; best = [x, z]; }
    return best && Math.hypot(best[0] - x0, best[1] - z0) > 0.2 ? best : null;
  }
  /* follow = la vue se tourne dans le sens de la marche (trajets vers une pièce) ; sinon on garde son regard. */
  walkTo(x, z, look, onArrive, follow = true) {
    const w = this.walk, nav = this.apt.levels[w.level].nav;
    let path = findPath(nav, [w.x, w.z], [x, z]);
    if (!path) { const e = this.march(w.x, w.z, x, z); if (!e) return false; path = [[w.x, w.z], e]; }
    w.path = path.slice(1); w.look = look || null; w.onArrive = onArrive || null; w.follow = follow; w.spin = null; return true;
  }
  /* Quelques pas dans l'axe du regard (molette, croix directionnelle). */
  advance(dist) {
    const w = this.walk; if (w.climbing || w.riding) return;
    const s = Math.sign(dist), e = this.march(w.x, w.z, w.x - Math.sin(w.yaw) * dist, w.z - Math.cos(w.yaw) * dist);
    if (e) { w.path = [e]; w.look = null; w.onArrive = null; w.follow = false; w.spin = null; this.stopTour(); }
    return s;
  }

  /* Va dans une pièce. À pied si elle est proche ; sinon par un fondu (la visite guidée, elle, marche toujours, escalier compris). */
  goToRoom(room, level, onArrive, walk = false) {
    this.lastRoom = room; this.lastLevel = level;
    if (this.mode !== 'walk') return this.enterWalk(room, level);
    const w = this.walk, cam = room.cam || { p: room.at, t: room.at };
    if (w.climbing || w.riding) return; w.spin = null;
    const end = () => { if (onArrive) onArrive(); else if (!this.tour && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.lookAround(); };
    const arrive = () => { if (!this.walkTo(cam.p[0], cam.p[1], cam.t, end)) { Object.assign(w, { x: cam.p[0], z: cam.p[1] }); this.placeCamera(); end(); } };
    if (!walk) {
      const path = level === w.level ? findPath(this.apt.levels[level].nav, [w.x, w.z], cam.p) : null;
      if (!path || pathLength(path) > 11) return this.fadeSwap(() => { this.enterWalk(room, level, true); end(); });
    }
    if (level === w.level) return arrive();
    const st = this.apt.stair, up = level > w.level, foot = up ? st.path[0] : st.path[st.path.length - 1];
    if (!this.walkTo(foot[0], foot[1], null, () => this.climb(up, arrive))) this.climb(up, arrive);
  }

  /* Tour d'horizon : la vue pivote doucement d'un tour complet ; le moindre geste l'arrête. */
  lookAround() { const w = this.walk; if (this.mode !== 'walk' || w.climbing || w.riding) return; w.path = null; w.look = null; w.spin = { left: Math.PI * 2 }; }

  /* Ascenseur : fondu, changement de niveau, sortie de la cabine. */
  ride() {
    const w = this.walk, to = w.level ? 0 : 1; w.path = null; w.look = null; w.spin = null; w.riding = { t: 0, to, done: false };
    ui.fade.classList.remove('is-light'); ui.fade.classList.add('is-on'); const c = $('#v3d-caption'); c.hidden = false; c.textContent = tr('lift') + ' · ' + this.apt.levels[to].name[lang()]; c.classList.remove('is-in'); void c.offsetWidth; c.classList.add('is-in');
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
    if (w.spin && !w.path && !w.climbing) { if (!idle) w.spin = null; else { const a = Math.min(w.spin.left, dt * 0.5); w.yaw -= a; w.spin.left -= a; w.pitch += (-0.1 - w.pitch) * Math.min(1, dt * 2); moved = true; if (w.spin.left <= 0) w.spin = null; } }
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
      if (idle && d > 0.05) { const want = Math.atan2(-dx, -dz); let off = want - w.yaw; off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off))); if (w.follow) { turnTo(want, 3.2); w.pitch += (-0.1 - w.pitch) * Math.min(1, dt * 2); } else if (off > 1.9) turnTo(want, 2.4); }   // sans suivi : on ne se retourne que si la cible est dans le dos
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
      if (w.x > m[0] && w.z > m[1] && w.x < m[2] && w.z < m[3]) { const then = w.onArrive; w.onArrive = null; this.climb(w.level === 0, then); }
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
    this.updateSpots();
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
      this.goToRoom(s.room, s.level, () => { if (this.tour) this.tour.wait = 3.4; }, true);
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

  /* ── Repères vers les pièces visibles : une pastille au-dessus de chaque anneau, un clic y conduit ── */
  makeSpots() {
    ui.spots.textContent = ''; this.spotEls = [];
    for (const g of this.cur.pucks.children) {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'v3d-spot'; el.textContent = g.userData.room[lang()]; el.hidden = true;
      el.addEventListener('click', () => { this.stopTour(); this.goToRoom(g.userData.room, g.userData.level, null, true); });
      ui.spots.appendChild(el); this.spotEls.push({ el, g, w: el.textContent.length * 6.6 + 26, clear: false, shown: false, since: 0, tf: '' });
    }
  }
  /* Aucun mur entre deux points du plan ? (les portes et les baies sont des vides) */
  wallClear(x0, z0, x1, z1, lv) {
    for (let i = 0; i < lv.nWall; i++) {
      const q = lv.blocks[i]; let t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0; let hit = true;
      for (const [o, d, lo, hi] of [[x0, dx, q[0], q[2]], [z0, dz, q[1], q[3]]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { hit = false; break; } } else { let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { hit = false; break; } }
      }
      if (hit) return false;
    }
    return true;
  }
  updateSpots() {
    const show = this.mode === 'walk' && !this.tour && !this.walk.climbing && !this.walk.riding && !this.swapping; if (ui.spots.hidden === show) ui.spots.hidden = !show; if (!show) return;
    const w = this.walk, lv = this.apt.levels[w.level], W = root.clientWidth, H = root.clientHeight, v = new THREE.Vector3(), here = this.roomAt(w.level, w.x, w.z), now = performance.now();
    const snap = this.spotSnap; this.spotSnap = false;          // arrivée dans une pièce : état appliqué sans délai
    this.camera.updateMatrixWorld();
    const cand = [];
    for (const S of this.spotEls) {
      const g = S.g, d = Math.hypot(g.position.x - w.x, g.position.z - w.z);
      const near = g.userData.level === w.level && g.userData.room !== here && d > 1.2 && d < 12;
      const clear = near && this.wallClear(w.x, w.z, g.position.x, g.position.z, lv);
      if (clear !== S.clear) { S.clear = clear; S.since = now; }
      // on longe un mur, on passe une porte : le repère ne change d'état qu'après 0,22 s de stabilité — il ne clignote pas
      if (snap || !near || now - S.since > 220) S.shown = clear;
      let ok = S.shown && near;
      if (ok) { v.set(g.position.x, lv.y + 0.32, g.position.z).project(this.camera); ok = v.z < 1 && Math.abs(v.x) < 0.92 && v.y > -0.8 && v.y < 0.8; }
      if (ok) { S.x = (v.x + 1) / 2 * W; S.y = (1 - v.y) / 2 * H; S.d = d; cand.push(S); } else if (!S.el.hidden) S.el.hidden = true;
    }
    // deux repères ne se recouvrent jamais : le plus proche l'emporte
    cand.sort((a, b) => a.d - b.d); const kept = [];
    for (const S of cand) {
      const hit = kept.some((K) => Math.abs(K.x - S.x) < (K.w + S.w) / 2 + 6 && Math.abs(K.y - S.y) < 30);
      if (hit) { if (!S.el.hidden) S.el.hidden = true; continue; }
      kept.push(S);
      const tf = `translate(-50%,-100%) translate(${S.x.toFixed(1)}px,${S.y.toFixed(1)}px)`;
      if (tf !== S.tf) { S.tf = tf; S.el.style.transform = tf; }
      if (S.el.hidden) S.el.hidden = false;
    }
  }

  /* ── Étiquettes des pièces (maquette et plan) ───────────────────────────── */
  makeLabels() {
    ui.labels.textContent = ''; this.labelEls = [];
    this.apt.levels.forEach((lv, i) => lv.rooms.forEach((room) => {
      if (room.hidden) return;
      const el = document.createElement('button'); el.type = 'button'; el.className = 'v3d-label' + (room.minor ? ' is-minor' : ''); el.textContent = room[lang()];
      if (room.m2) { const sm = document.createElement('small'); sm.textContent = room.m2.toLocaleString(lang() === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: 1 }) + ' m²'; el.appendChild(sm); }
      el.addEventListener('click', () => { this.stopTour(); this.goToRoom(room, i); });
      ui.labels.appendChild(el); this.labelEls.push({ el, room, level: i, v: new THREE.Vector3(room.at[0], lv.y + 0.9, room.at[1]) });
    }));
  }
  updateLabels() {
    const show = (this.mode === 'orbit' || this.mode === 'plan') && !this.fly; ui.labels.hidden = !show; if (!show) return;
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
    this.roomsLevel = -1; this.makeLabels(); this.makeSpots(); this.makeLots(); this.syncUI();
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
    if (this.mode === 'walk') { const lv = this.apt.levels[i], room = lv.rooms.find((r) => r.id === (i ? 'palier' : this.apt.start.room)) || lv.rooms[0]; this.stopTour(); return this.goToRoom(room, i); }   // l'autre niveau : fondu (l'escalier et l'ascenseur restent praticables)
    this.viewLevel = i; this.setMode(this.mode);
  }
  syncUI() {
    $$('button[data-mode]').forEach((b) => { const on = b.dataset.mode === this.mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
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
      const p = nearestFree(lv.nav, o.x + d.x * t, o.z + d.z * t, 0.5); return p && this.wallClear(w.x, w.z, p[0], p[1], lv) ? { p, y: lv.y } : null;
    };
    let od = null;
    const pick = (e) => {                                        // pièce visée sur la maquette ou le plan
      if (!this.apt || this.fly) return null; local(e); this.ray.setFromCamera(this.ptr, this.camera);
      const lv = this.apt.levels[this.viewLevel], o = this.ray.ray.origin, d = this.ray.ray.direction; if (d.y > -0.01) return null;
      const t = (lv.y - o.y) / d.y, x = o.x + d.x * t, z = o.z + d.z * t, room = this.roomAt(this.viewLevel, x, z);
      return room ? { room, p: [x, z] } : null;
    };
    const pts = new Map(); let pinch = 0;
    const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const lift = (e) => {                                        // un doigt quitte l'écran : le doigt restant reprend la main sans à-coup
      if (!pts.delete(e.pointerId) || this.mode !== 'walk' || pts.size !== 1) return;
      const [id, q] = [...pts.entries()][0]; down = { x: q.x, y: q.y, yaw: w.yaw, pitch: w.pitch, moved: true, id };
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'walk') { od = { x: e.clientX, y: e.clientY }; return; }
      w.spin = null; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { pinch = gap(); if (down) down.moved = true; return; }
      if (pts.size > 2) return;
      down = { x: e.clientX, y: e.clientY, yaw: w.yaw, pitch: w.pitch, moved: false, id: e.pointerId };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'walk') { if (this.mode !== 'site' && !e.buttons && !touch) { const h = pick(e); this.highlight(h ? h.room : null, this.viewLevel); } return; }
      if (pts.has(e.pointerId)) { const q = pts.get(e.pointerId); q.x = e.clientX; q.y = e.clientY; }
      if (pts.size >= 2) { if (pts.size === 2) { const g = gap(); if (Math.abs(g - pinch) > 44) { this.stopTour(); this.advance(g > pinch ? 0.9 : -0.9); pinch = g; } } return; }
      if (down && down.id === e.pointerId) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
        if (down.moved) { const k = (this.camera.fov / 55) * 0.0036; w.yaw = down.yaw + dx * k; w.pitch = clamp(down.pitch + dy * k, -1.1, 1.0); w.dragAt = performance.now(); w.look = null; this.reticle.visible = false; this.placeCamera(); }
      } else if (!touch && !w.climbing) { const h = floorHit(e); this.reticle.visible = !!h; if (h) this.reticle.position.set(h.p[0], h.y + 0.02, h.p[1]); this.dirty = true; }
    });
    const up = (e) => {
      if (this.mode !== 'walk') { pts.clear(); const o = od; od = null; if (this.mode === 'site') return; if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) < 7) { const h = pick(e); if (h) { this.highlight(null); this.stopTour(); this.enterWalk(h.room, this.viewLevel, false, h.p); } } return; }
      const multi = pts.size > 1; lift(e); if (multi) return;
      if (!down || down.id !== e.pointerId) return; const d = down; down = null;
      if (this.mode !== 'walk' || d.moved || w.climbing) return;
      this.stopTour();
      const h = floorHit(e); if (h && this.walkTo(h.p[0], h.p[1], null, null, false)) return;
      // pas de sol libre sous le pointeur (meuble, mur, horizon) : on avance dans cette direction autant que possible
      local(e); this.ray.setFromCamera(this.ptr, this.camera); const dr = this.ray.ray.direction, k = Math.hypot(dr.x, dr.z) || 1;
      const a0 = Math.atan2(dr.x / k, dr.z / k); let best = null, bd = 0;
      for (const off of [0, 0.3, -0.3, 0.6, -0.6, 0.95, -0.95]) { const t = this.march(w.x, w.z, w.x + Math.sin(a0 + off) * 3.2, w.z + Math.cos(a0 + off) * 3.2); const d = t ? Math.hypot(t[0] - w.x, t[1] - w.z) : 0; if (d > bd + (best ? 0.6 : 0)) { best = t; bd = d; } if (bd > 1.5) break; }
      if (best) return void this.walkTo(best[0], best[1], null, null, false);
      // coincé entre deux meubles : on contourne pour rejoindre le sol libre le plus proche dans l'axe visé
      const lv = this.apt.levels[w.level];
      for (const dist of [1.8, 2.6, 1.2]) {
        const q = nearestFree(lv.nav, w.x + Math.sin(a0) * dist, w.z + Math.cos(a0) * dist, 0.8);
        if (!q || Math.hypot(q[0] - w.x, q[1] - w.z) < 0.5 || !this.wallClear(w.x, w.z, q[0], q[1], lv)) continue;
        const path = findPath(lv.nav, [w.x, w.z], q);
        if (path && pathLength(path) < 8) { this.walkTo(q[0], q[1], null, null, false); break; }
      }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { const multi = pts.size > 1; lift(e); if (!multi) down = null; });
    canvas.addEventListener('pointerleave', () => { this.reticle.visible = false; this.highlight(null); this.dirty = true; });
    canvas.addEventListener('wheel', (e) => { if (this.mode !== 'walk') return; e.preventDefault(); this.advance(e.deltaY < 0 ? 0.9 : -0.9); }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      const rect = root.getBoundingClientRect(); if (rect.bottom < 80 || rect.top > innerHeight - 80) return;
      if (this.mode === 'walk' && /^(Arrow|Key[WASDQE])/.test(e.code)) { this.keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); }   // e.code = position physique : ZQSD sur un clavier AZERTY
      if (e.code === 'ShiftLeft') this.keys.add('ShiftLeft');
      if (e.key === 'Escape') { if (this.tour) this.stopTour(); else if (document.fullscreenElement) document.exitFullscreen(); else if (this.mode === 'walk') this.setMode('orbit'); }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    addEventListener('blur', () => this.keys.clear());
    // commandes
    $$('button[data-mode]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode !== this.mode) this.setMode(b.dataset.mode); }));
    $$('[data-apt]').forEach((b) => b.addEventListener('click', () => { const a = APARTMENTS.find((x) => x.id === b.dataset.apt); if (a && a !== this.apt) { this.lastRoom = null; this.load(a); } }));
    $('#v3d-tour').addEventListener('click', () => (this.tour ? this.stopTour() : this.startTour()));
    $('#v3d-time').addEventListener('input', (e) => this.setHour(Number(e.target.value)));
    $$('[data-hour]').forEach((b) => b.addEventListener('click', () => this.animHour(Number(b.dataset.hour))));
    const fl = $('#v3d-floors');
    FLOOR_FINISHES.forEach((f, i) => { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'v3d-swatch' + (i ? '' : ' is-on'); bt.style.setProperty('--sw', f.sw); bt.dataset.floor = f.id; bt.title = f[lang()]; bt.setAttribute('aria-label', f[lang()]); bt.addEventListener('click', () => { setFloorFinish(this.M, f.id); $$('.v3d-swatch').forEach((x) => x.classList.toggle('is-on', x === bt)); $('#v3d-floor-out').textContent = f[lang()]; this.dirty = true; }); fl.appendChild(bt); });
    $('#v3d-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen(); else root.classList.toggle('is-fake-full'); });
    $('#v3d-look').addEventListener('click', () => this.lookAround());
    $$('[data-key]').forEach((b) => {                              // croix directionnelle (écrans tactiles) : appui maintenu
      const on = (e) => { e.preventDefault(); this.keys.add(b.dataset.key); }, off = () => this.keys.delete(b.dataset.key);
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    $('#v3d-panel-toggle').addEventListener('click', () => root.classList.toggle('is-panel-open'));
    ui.map.addEventListener('click', (e) => { if (!this.mapT) return; const r = ui.map.getBoundingClientRect(), k = ui.map.width / r.width, x = ((e.clientX - r.left) * k - this.mapT.ox) / this.mapT.s, z = ((e.clientY - r.top) * k - this.mapT.oy) / this.mapT.s; this.stopTour(); this.walkTo(x, z); });
    document.addEventListener('59c:langchange', () => { if (!this.apt) return; this.fillUI(); if (this.mode === 'walk') this.updateHud(); this.dirty = true; $$('.v3d-swatch').forEach((b) => { const f = FLOOR_FINISHES.find((x) => x.id === b.dataset.floor); b.title = f[lang()]; b.setAttribute('aria-label', f[lang()]); if (b.classList.contains('is-on')) $('#v3d-floor-out').textContent = f[lang()]; }); });
    document.addEventListener('visibilitychange', () => { this.clock.getDelta(); if (!document.hidden) this.dirty = true; });
    /* Perte du contexte graphique (pilote réinitialisé, mémoire de la carte saturée, mise en veille) : sans preventDefault le
       navigateur ne le rend jamais et l'écran reste noir. On suspend le rendu, on prévient, on reprend quand il revient ; s'il ne
       revient pas, ou s'il se perd à nouveau, un bouton recharge la visite au même endroit, un niveau de qualité plus bas. */
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); this.lost = (this.lost || 0) + 1; this.lostN = (this.lostN || 0) + 1;
      ui.loader.hidden = false; ui.loaderText.textContent = tr('lost');
      clearTimeout(this.lostT); this.lostT = setTimeout(() => this.offerReload(), this.lostN > 1 ? 0 : 5000);
    });
    canvas.addEventListener('webglcontextrestored', () => setTimeout(() => {
      clearTimeout(this.lostT); this.lost = 0;
      if (this.lostN > 1) return this.offerReload();
      if (this.ready) ui.loader.hidden = true;
      if (!this.M) return;
      const room = this.env.pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      for (const k of this.roomMats) this.M[k].envMap = room;
      ZU.uZn.value = 0;                                       // les prises des pièces sont perdues avec le contexte : reflets neutres d'avant
      this.env.envRT = null; this.env.envDirty = true; this.env.flushEnv();
      this.renderer.shadowMap.needsUpdate = true; this.resize(); this.dirty = true;
    }, 60));
  }
  /* Recharge la page au même endroit (logement, vue, pièce), un cran de qualité plus bas. */
  offerReload() {
    ui.loader.hidden = false; ui.loaderText.textContent = tr('lostReload');
    if (ui.loader.querySelector('.v3d-reload')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-primary v3d-reload'; b.textContent = tr('reload');
    b.addEventListener('click', () => {
      const u = new URLSearchParams(location.search), down = { high: 'std', test: 'std', std: 'mid', mid: 'low', low: 'low', soft: 'soft' };
      u.set('q', down[qName] || 'low');
      if (this.apt) u.set('bien', this.apt.bien || this.apt.id);
      u.delete('mode'); u.delete('piece');
      if (this.mode === 'walk' && this.lastRoom) { u.set('mode', 'visite'); u.set('piece', this.lastRoom.id); } else if (this.mode === 'site') u.set('mode', 'residence'); else if (this.mode === 'plan') u.set('mode', 'plan');
      location.search = u.toString();
    });
    ui.loader.appendChild(b);
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
    const raw = this.clock.getDelta(), dt = Math.min(0.1, raw), slow = Math.min(0.2, raw), now = performance.now();
    if (!this.ready || document.hidden || this.lost) { this.dyn.prev = false; return; }
    this.tick(dt); this.updateLights(dt);
    if (this.env.flushEnv(now)) this.dirty = true;
    const cam = this.camera; let moving = !!this.fly || now - (this.hourMovedAt || -1e9) < 120;
    if (!this.camP.equals(cam.position) || !this.camQ.equals(cam.quaternion) || this.camF !== cam.fov) { this.camP.copy(cam.position); this.camQ.copy(cam.quaternion); this.camF = cam.fov; this.movedAt = now; moving = true; }
    if (this.mode === 'site' && this.cur.arrival && this.cur.arrival.update(dt)) { this.dirty = true; moving = true; }
    if (!this.onScreen) { this.dyn.prev = false; return; }    // la visite continue (visite guidée, voiture), mais rien n'est dessiné hors de la vue
    this.dynBefore(now, moving);
    const refine = this.updateAO(slow);
    this.updateSpots();                                        // repères : suivis à chaque image, même sans nouveau rendu (leur hystérésis est temporelle)
    if (!this.dirty && !refine) { this.dynAfter(now, false); return; } this.dirty = false;
    this.updateLabels(); this.updateLots(); this.cullOutdoor();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.dynAfter(now, true);
    if (params.get('perf') === '1') this.perfTick(now);
  }
  /* ?perf=1 : petit relevé en bas à gauche (niveau de qualité, carte graphique, pixels, cadence, éléments masqués), pour diagnostiquer une machine */
  perfTick(now) {
    const P = this._perf || (this._perf = { t: 0, ds: [], el: null, shown: 0 });
    if (P.t && now - P.t < 400) { P.ds.push(now - P.t); if (P.ds.length > 30) P.ds.shift(); } P.t = now;
    if (now - P.shown < 500) return; P.shown = now;
    if (!P.el) { P.el = document.createElement('pre'); P.el.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:30;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.6);border-radius:6px;pointer-events:none;white-space:pre'; root.appendChild(P.el); }
    const d = P.ds.slice().sort((x, y) => x - y), med = d.length ? d[d.length >> 1] : 0, c = this.canvas || canvas, st = this.cullStats || { frames: 0, out: 0, other: 0 }, r = this.renderer.info;
    P.el.textContent = `niveau ${this.qName}  ·  ${GPU.kind}  ·  ${String(GPU.name).slice(0, 48)}\n` +
      `image ${c.width}×${c.height} (×${this.renderer.getPixelRatio().toFixed(2)})  ·  paliers ${this.dyn ? this.dyn.step : '-'}/${this.dyn ? this.dyn.steps.length - 1 : '-'}\n` +
      `cadence ${med ? Math.round(1000 / med) + ' i/s (' + Math.round(med) + ' ms)' : 'à l\'arrêt'}  ·  ${r.memory.textures} textures, ${r.memory.geometries} géométries, ${r.programs ? r.programs.length : 0} programmes\n` +
      `extérieur masqué ${st.frames ? Math.round(100 * st.out / st.frames) : 0} %` + (this.apt && this.apt.levels.length > 1 ? `  ·  autre niveau masqué ${st.frames ? Math.round(100 * st.other / st.frames) : 0} %` : '');
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
  const mode = { visite: 'walk', walk: 'walk', plan: 'plan', residence: 'site', site: 'site' }[params.get('mode') || ''];
  app.load(apt, { mode, room: params.get('piece') }).catch((e) => { console.error(e); ui.loaderText.textContent = String(e.message || e); });
  app.frame();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
