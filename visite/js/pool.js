/* 59 Cézanne — visite 3D : le bassin de la résidence (piscine enterrée de 6 × 12,3 m, plan de masse indice E) et son eau.

   La cuve n'est pas modélisée sous la terrasse : elle passerait dans le remblai et au-dessus des locaux, et chaque vue devrait
   la cacher. L'eau est un seul plan, au niveau de l'eau, dont le programme de rendu « regarde » dans une cuve virtuelle :
   le rayon de vue est réfracté par la surface ridée, puis coupé avec les parois, le fond en pente, la plage immergée et ses
   marches, l'échelle ; le point touché reçoit son carrelage, ses pièces à sceller (skimmers, buses, projecteurs, bonde),
   le soleil réfracté avec ses caustiques et l'ombre des parois, la lumière du ciel, puis l'eau l'absorbe selon la longueur
   parcourue (le rouge d'abord : le turquoise vient de la profondeur, pas d'une couleur peinte). En surface, le reflet suit
   l'angle de vue (Fresnel) : le ciel de l'environnement, et quelques volumes simplifiés des alentours (façade Est et toiture,
   mur des jardins, oliviers du talus, pins, jardinière) éclairés par le soleil du moment. Deux triangles, aucun rendu de plus.

   Rendu à la demande : l'eau est belle à l'arrêt. Les rides n'avancent que lorsqu'une image est de toute façon rendue parce
   que la vue bouge ; en qualité basse elles restent figées. Le soir, les projecteurs immergés éclairent la cuve et l'eau
   diffuse leur lumière : c'est une émission calculée dans ce même programme, sans lumière supplémentaire dans la scène. */
import * as THREE from 'three';
import { F } from 'v3d/furniture';

const OFF = 1000;                     // les UV du plan d'eau portent les coordonnées du site + OFF : le bassin se reconnaît, quel que soit le logement chargé

/* ── Textures précalculées ─────────────────────────────────────────────────────────────────────────────────────── */

function rand(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Mosaïque de pâte de verre 5 × 5 cm, camaïeu blanc bleuté, joints clairs : un mètre de paroi par texture. */
function tileCanvas(S) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), r = rand(71), n = 20, p = S / n, j = Math.max(1, S / 320);
  g.fillStyle = 'rgb(205,212,212)'; g.fillRect(0, 0, S, S);
  const tones = [[214, 232, 236], [196, 222, 231], [224, 238, 240], [182, 214, 228], [206, 228, 238]];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const t = tones[Math.floor(r() * r() * tones.length * 1.6) % tones.length], k = 0.95 + r() * 0.08;
    const grd = g.createLinearGradient(x * p, y * p, (x + 1) * p, (y + 1) * p);
    grd.addColorStop(0, `rgb(${t[0] * k + 6 | 0},${t[1] * k + 5 | 0},${t[2] * k + 4 | 0})`); grd.addColorStop(1, `rgb(${t[0] * k - 6 | 0},${t[1] * k - 5 | 0},${t[2] * k - 3 | 0})`);
    g.fillStyle = grd; g.fillRect(x * p + j, y * p + j, p - 2 * j, p - 2 * j);
  }
  return c;
}

/* Caustiques : réseau de filets lumineux (lignes où une somme d'ondes s'annule), raccordable sur ses bords. Renvoie aussi la
   moyenne du produit de deux lectures décalées, pour que l'éclairement moyen du fond reste celui d'une eau plane. */
function causticCanvas(S) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data, r = rand(37);
  const W = [[3, 2], [-2, 4], [5, -3], [-4, -5], [6, 1], [1, 6]], ph = W.map(() => r() * 6.283), T = 6.2832 / S;
  const v = new Float32Array(S * S); let m = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wx = 9 * Math.sin(T * (2 * x + y) + 1.3) + 6 * Math.sin(T * (-x + 3 * y) + 0.4), wy = 9 * Math.sin(T * (x - 2 * y) + 2.1) + 6 * Math.sin(T * (3 * x + y) + 5.2);
    let s = 0; for (let k = 0; k < 6; k++) s += Math.sin(T * (W[k][0] * (x + wx) + W[k][1] * (y + wy)) + ph[k]);
    const e = Math.pow(Math.max(0, 1 - Math.abs(s / 6) * 2.4), 5);
    v[y * S + x] = e; m += e;
  }
  m /= S * S; let m2 = 0;
  for (let i = 0; i < S * S; i++) { const e = Math.min(1, v[i] * 0.3 / m); v[i] = e; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = e * 255; d[i * 4 + 3] = 255; }
  for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) m2 += v[y * S + x] * v[((y * 3 + 101) % S) * S + ((x * 2 + 57) % S)];
  g.putImageData(im, 0, 0);
  return { c, m2: m2 / (S * S / 4) };
}

/* ── Programme de rendu de l'eau ───────────────────────────────────────────────────────────────────────────────── */

const PARS = /* glsl */`
varying vec2 vPoolUv; varying vec3 vPoolW; varying vec3 vPoolN;
uniform sampler2D uPoolTile, uPoolCaus;
uniform vec4 uPoolBox, uPoolDim, uStepZ, uStepD;
uniform vec2 uLampZ;
uniform float uPoolT, uPoolNight;
const vec3 PSIG = vec3( 0.40, 0.072, 0.048 );                // absorption de l'eau (1/m) : le rouge s'éteint le premier
const vec3 PLAMP = vec3( 0.78, 0.92, 1.0 );                  // projecteurs à diodes, blanc froid
float pwFres( float c ) { float f = 1.0 - clamp( c, 0.0, 1.0 ); return 0.02 + 0.98 * f * f * f * f * f; }
float pwHash( float x ) { return fract( sin( x * 12.9898 ) * 43758.545 ); }

/* Normale de la surface : quelques trains d'ondes courtes, plus calmes au loin (une onde plus fine que le pixel s'efface au lieu de scintiller). */
vec3 pwWaves( vec2 p, float fw ) {
	const vec4 W[ 6 ] = vec4[ 6 ]( vec4( 0.8, 0.6, 3.1, 0.014 ), vec4( -0.45, 0.89, 1.7, 0.013 ), vec4( 0.95, -0.31, 0.93, 0.012 ),
		vec4( -0.71, -0.7, 0.53, 0.011 ), vec4( 0.2, 0.98, 0.31, 0.009 ), vec4( 0.99, 0.12, 0.19, 0.007 ) );
	vec2 g = vec2( 0.0 );
	for ( int i = 0; i < PW_NW; i ++ ) {
		vec2 d = W[ i ].xy; float L = W[ i ].z, k = 6.2832 / L, ph = dot( d, p ) * k + sqrt( 9.81 * k ) * uPoolT * 0.5 + float( i ) * 1.7;
		g += d * ( W[ i ].w * ( 1.0 - smoothstep( 0.12 * L, 0.45 * L, fw ) ) * cos( ph ) );
	}
	return normalize( vec3( -g.x, 1.0, -g.y ) );
}
vec3 pwSky( vec3 R ) {
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		return textureCubeUV( envMap, envMapRotation * R, 0.05 ).rgb;
	#else
		return vec3( 0.5, 0.65, 0.85 );
	#endif
}
/* Feuillage vu en reflet : vert sourd, plus clair côté soleil, crevé de quelques trous. */
vec3 pwLeaf( vec3 R, vec3 L, vec3 sun, vec3 Ei, float v ) {
	vec3 nf = normalize( vec3( -R.x, 0.35, -R.z ) );
	return vec3( 0.045, 0.06, 0.028 ) * ( 0.75 + 0.5 * v ) * ( sun * ( 0.25 + 0.75 * max( dot( nf, L ), 0.0 ) ) + Ei * 0.9 );
}
/* Reflet : volumes simplifiés des alentours, sinon le ciel. Repère du site (x Est, z Sud). */
vec3 pwRefl( vec3 P, vec3 R, vec3 L, vec3 sun, vec3 Ei ) {
	vec3 sky = pwSky( R );
	if ( R.x < -0.03 ) {                                                  // vers l'Ouest : mur des jardins, façade Est, toiture
		float tw = ( 22.55 - P.x ) / R.x; vec3 q = P + R * tw;
		if ( q.z > 13.15 && q.z < 36.0 ) {
			if ( q.y < 0.0 ) return vec3( 0.36, 0.31, 0.24 ) * ( sun * max( L.x, 0.0 ) + Ei * 0.8 );          // pierre sèche
			if ( q.y < 1.5 && q.z > 25.6 ) return pwLeaf( R, L, sun, Ei, pwHash( floor( q.z * 2.0 ) ) );   // haie du jardin n°4
		}
		float tb = ( 17.39 - P.x ) / R.x; q = P + R * tb;
		if ( q.z > 0.0 && q.z < 32.2 && q.y > -0.4 ) {
			if ( q.y < 5.62 ) {
				float bay = fract( ( q.z - 13.15 ) / 4.35 ), lv = q.y < 2.9 ? q.y - 0.12 : q.y - 3.02;
				vec3 st = vec3( 0.52, 0.44, 0.33 ) * ( sun * max( L.x, 0.0 ) + Ei * 0.8 );
				if ( bay > 0.13 && bay < 0.87 && lv > 0.0 && lv < 2.3 ) return pwSky( reflect( R, vec3( 1.0, 0.0, 0.0 ) ) ) * 0.12 + st * 0.06;   // baies vitrées
				return st;
			}
			if ( q.y < 5.82 ) return vec3( 0.45, 0.42, 0.38 ) * ( sun * max( L.x, 0.0 ) + Ei * 0.8 );      // débord de toiture en béton
			float sy = R.y / -R.x, dx = ( q.y - 5.82 ) / max( 0.316 - sy, 1e-3 );
			if ( sy < 0.316 && dx < 8.7 ) return vec3( 0.30, 0.12, 0.065 ) * ( sun * max( dot( vec3( 0.3, 0.95, 0.0 ), L ), 0.0 ) + Ei * 0.9 );   // tuiles
			return sky;
		}
	}
	float h = length( R.xz ), te = R.y / max( h, 1e-3 );
	if ( R.x > 0.05 ) {                                                    // vers l'Est : oliviers et pittosporums du talus
		float td = ( 36.4 - P.x ) / R.x; vec3 q = P + R * td;
		float zc = 12.9 + 3.75 * floor( ( q.z - 12.9 ) / 3.75 + 0.5 ), u = ( q.z - zc ) / 1.95;
		float top = max( -0.25 + 3.3 * sqrt( max( 0.0, 1.0 - u * u ) ) * ( 0.88 + 0.24 * pwHash( zc ) ), 0.2 );
		if ( q.y < top && q.z > 9.5 && q.z < 33.0 ) return pwLeaf( R, L, sun, Ei, pwHash( floor( q.y * 3.0 ) + floor( q.z * 3.0 ) * 7.0 ) );
	}
	if ( R.z > 0.05 ) {                                                    // vers le Sud : pins parasols, haie de la clôture
		float td = ( 33.6 - P.z ) / R.z; vec3 q = P + R * td;
		if ( q.y < 0.4 ) return pwLeaf( R, L, sun, Ei, 0.4 );
		for ( int i = 0; i < 3; i ++ ) {
			vec3 c = i == 0 ? vec3( 34.6, 6.0, 32.6 ) : i == 1 ? vec3( 29.75, 5.6, 33.6 ) : vec3( 19.6, 6.4, 36.1 );
			float tc = ( c.z - P.z ) / R.z; vec3 w = P + R * tc;
			if ( abs( w.x - c.x ) < 3.3 * ( 1.0 - 0.25 * ( w.y - c.y ) ) && w.y > c.y - 0.9 && w.y < c.y + 1.4 ) return pwLeaf( R, L, sun, Ei, pwHash( floor( w.x * 2.0 ) ) );
			if ( abs( w.x - c.x ) < 0.18 && w.y < c.y ) return vec3( 0.12, 0.08, 0.05 ) * ( sun * 0.3 + Ei * 0.8 );   // tronc
		}
	}
	if ( R.z < -0.05 ) {                                                   // vers le Nord : jardinière plantée au bord de la terrasse
		float td = ( 10.65 - P.z ) / R.z; vec3 q = P + R * td;
		if ( q.x > 19.3 && q.x < 32.2 ) { if ( q.y < -0.8 ) return vec3( 0.32, 0.31, 0.29 ) * ( sun * 0.4 + Ei * 0.8 ); if ( q.y < -0.2 + 0.25 * pwHash( floor( q.x * 1.6 ) ) ) return pwLeaf( R, L, sun, Ei, pwHash( floor( q.x * 3.0 ) ) ); }
	}
	return sky;
}

/* Rayon réfracté dans la cuve : renvoie la lumière qui en ressort sous la surface, à l'aplomb de P. */
vec3 pwTank( vec3 P, vec3 V, vec3 n, vec3 L, vec3 sunR, float vis, vec3 Ei ) {
	vec4 B = uPoolBox; float YW = uPoolDim.x, s = uPoolDim.z, yF0 = YW - uPoolDim.y;
	P.xz = clamp( P.xz, B.xy + 0.003, B.zw - 0.003 );
	vec3 d = refract( V, n, 0.7519 ); d.x = abs( d.x ) < 1e-5 ? 1e-5 : d.x; d.z = abs( d.z ) < 1e-5 ? 1e-5 : d.z;
	vec3 id = 1.0 / d;
	// parois
	float tx = ( ( d.x > 0.0 ? B.z : B.x ) - P.x ) * id.x, tz = ( ( d.z > 0.0 ? B.w : B.y ) - P.z ) * id.z;
	float t = min( tx, tz ), k = 0.0, sz = 0.0, sd = 0.0;
	vec3 nh = tx < tz ? vec3( -sign( d.x ), 0.0, 0.0 ) : vec3( 0.0, 0.0, -sign( d.z ) );
	// fond en pente douce, de 1,60 m au Nord à 1,20 m au pied des marches
	float den = d.y - s * d.z;
	if ( den < 0.0 ) { float tf = ( yF0 + s * ( P.z - B.y ) - P.y ) / den; if ( tf > 0.0 && tf < t ) { t = tf; k = 1.0; nh = normalize( vec3( 0.0, 1.0, -s ) ); } }
	// plage immergée et marches, sur toute la largeur du petit côté Sud
	for ( int i = 0; i < 4; i ++ ) {
		float za = uStepZ[ i ], dp = uStepD[ i ], yt = YW - dp, tt = ( yt - P.y ) / d.y;
		if ( tt > 0.0 && tt < t && P.z + d.z * tt >= za ) { t = tt; k = 2.0; nh = vec3( 0.0, 1.0, 0.0 ); sz = za; sd = dp; }
		if ( d.z > 0.0 ) { float tf = ( za - P.z ) * id.z; if ( tf > 0.0 && tf < t && P.y + d.y * tf <= yt ) { t = tf; k = 3.0; nh = vec3( 0.0, 0.0, -1.0 ); sz = za; sd = dp; } }
	}
	#ifndef POOL_LOW
	{	// échelle inox : montants, retour au pied contre la paroi, trois marches
		float zc = uPoolDim.w;
		for ( int i = 0; i < 7; i ++ ) {
			vec3 a, b;
			if ( i < 2 ) { float z = zc + ( i == 0 ? -0.25 : 0.25 ); a = vec3( B.x + 0.15, YW - 1.05, z - 0.021 ); b = vec3( B.x + 0.192, YW, z + 0.021 ); }
			else if ( i < 4 ) { float z = zc + ( i == 2 ? -0.25 : 0.25 ); a = vec3( B.x, YW - 1.09, z - 0.021 ); b = vec3( B.x + 0.192, YW - 1.048, z + 0.021 ); }
			else { float y = YW - 0.3 - 0.27 * float( i - 4 ); a = vec3( B.x + 0.07, y - 0.03, zc - 0.23 ); b = vec3( B.x + 0.19, y, zc + 0.23 ); }
			vec3 t0 = ( a - P ) * id, t1 = ( b - P ) * id, tn = min( t0, t1 ), tf = max( t0, t1 );
			float e = max( max( tn.x, tn.y ), tn.z ), f = min( min( tf.x, tf.y ), tf.z );
			if ( e > 0.0 && e < f && e < t ) { t = e; k = i < 4 ? 4.0 : 5.0; nh = e == tn.x ? vec3( -sign( d.x ), 0.0, 0.0 ) : e == tn.y ? vec3( 0.0, -sign( d.y ), 0.0 ) : vec3( 0.0, 0.0, -sign( d.z ) ); }
		}
	}
	#endif
	vec3 h = P + d * t; float depth = YW - h.y;
	// revêtement : mosaïque, frise de ligne d'eau, nez de marche contrastés, pièces à sceller
	vec2 uv = ( k == 1.0 || k == 2.0 ) ? h.xz : abs( nh.x ) > 0.5 ? h.zy : h.xy;
	vec3 alb = texture( uPoolTile, uv ).rgb, em = vec3( 0.0 );
	if ( k == 0.0 && depth < 0.15 ) alb *= vec3( 0.36, 0.56, 0.76 );
	if ( ( k == 2.0 && h.z - sz < 0.05 ) || ( k == 3.0 && depth - sd < 0.05 ) ) alb *= vec3( 0.32, 0.45, 0.6 );
	if ( k == 0.0 ) {
		if ( nh.z > 0.5 ) for ( int j = 0; j < 2; j ++ ) {                 // skimmers dans la paroi Nord
			vec2 q = abs( vec2( h.x - ( j == 0 ? B.x + 1.2 : B.z - 1.2 ), h.y - YW + 0.02 ) );
			if ( q.x < 0.14 && q.y < 0.1 ) alb = q.x < 0.12 && q.y < 0.08 ? vec3( 0.03, 0.035, 0.04 ) : vec3( 0.78 );
		}
		if ( nh.x < -0.5 ) for ( int j = 0; j < 3; j ++ ) {                // buses de refoulement dans la paroi Est
			float r = length( vec2( h.z - B.y - 2.3 - 2.9 * float( j ), depth - 0.4 ) );
			if ( r < 0.042 ) alb = r < 0.017 ? vec3( 0.06 ) : vec3( 0.8 );
		}
		if ( nh.x > 0.5 ) for ( int j = 0; j < 2; j ++ ) {                 // projecteurs dans la paroi Ouest
			float r = length( vec2( h.z - uLampZ[ j ], depth - 0.55 ) );
			if ( r < 0.14 ) { alb = r > 0.118 ? vec3( 0.85 ) : vec3( 0.52, 0.58, 0.6 ); if ( r < 0.118 ) em = PLAMP * ( 7.0 - 3.0 * r / 0.118 ) * uPoolNight; }
		}
	}
	if ( k == 1.0 ) { vec2 q = abs( h.xz - vec2( 0.5 * ( B.x + B.z ), B.y + 1.4 ) ); float m = max( q.x, q.y );     // bonde de fond
		if ( m < 0.14 ) alb = m > 0.12 || fract( h.x * 33.0 ) < 0.45 ? vec3( 0.72 ) : vec3( 0.05 ); }
	if ( k == 4.0 ) alb = vec3( 0.55, 0.58, 0.6 );
	if ( k == 5.0 ) alb = vec3( 0.8, 0.82, 0.82 );
	// arêtes : le pied des parois et les angles sont arrondis (gorge) et reçoivent moins de lumière
	float fd = h.z < uStepZ.w ? YW - ( yF0 + s * ( h.z - B.y ) ) : h.z >= uStepZ.x ? uStepD.x : h.z >= uStepZ.y ? uStepD.y : h.z >= uStepZ.z ? uStepD.z : uStepD.w;
	float dx = min( h.x - B.x, B.z - h.x ), dz = min( h.z - B.y, B.w - h.z ), dy = fd - depth;
	float de = k == 0.0 ? min( abs( nh.x ) > 0.5 ? dz : dx, dy ) : k == 3.0 ? min( dx, depth - sd ) : min( dx, dz );
	float occ = 1.0 - 0.3 * exp( -max( de, 0.0 ) / 0.08 );
	// soleil réfracté : ombre des parois, caustiques projetées depuis la surface, absorption sur le trajet
	vec3 Lw = -refract( -L, vec3( 0.0, 1.0, 0.0 ), 0.7519 );
	float sl = depth / max( Lw.y, 0.08 ); vec3 S = h + Lw * sl;
	float wallSh = smoothstep( -0.02, 0.03, min( min( S.x - B.x, B.z - S.x ), min( S.z - B.y, B.w - S.z ) ) );
	float caus = 1.0;
	#ifndef POOL_LOW
		vec2 dr = vec2( 0.031, 0.017 ) * uPoolT;
		float c1 = texture( uPoolCaus, S.xz * 1.05 + dr, sl * 0.9 ).r, c2 = texture( uPoolCaus, mat2( 0.8, 0.6, -0.6, 0.8 ) * S.xz * 1.37 - dr * 1.4, sl * 0.9 ).r;
		caus = mix( 1.0, c1 * c2 / PW_CM, clamp( 0.85 - 0.25 * sl, 0.25, 0.85 ) );
	#else
		caus = mix( 1.0, texture( uPoolCaus, S.xz * 1.05, sl * 0.9 ).r / PW_CL, 0.6 );
	#endif
	vec3 direct = sunR * vis * max( dot( nh, Lw ), 0.0 ) * wallSh * caus * exp( -PSIG * sl ) * ( 1.0 - pwFres( max( L.y, 0.0 ) ) );
	vec3 amb = Ei * occ * exp( -PSIG * depth * 1.2 ) * ( nh.y > 0.5 ? 1.0 : 0.8 );
	// projecteurs immergés le soir : éclairage de la cuve et halo diffusé dans l'eau
	vec3 lamp = vec3( 0.0 ), glow = vec3( 0.0 );
	if ( uPoolNight > 0.005 ) {
		for ( int j = 0; j < 2; j ++ ) {
			vec3 Lp = vec3( B.x + 0.04, YW - 0.55, uLampZ[ j ] ), v = h - Lp; float dd = dot( v, v ), dl = sqrt( dd ); vec3 u = v / max( dl, 1e-3 );
			lamp += smoothstep( -0.2, 0.7, u.x ) * max( dot( nh, -u ), 0.0 ) / ( 0.25 + dd ) * exp( -PSIG * dl );
			#ifndef POOL_LOW
				vec3 w = Lp - P; float s0 = dot( w, d ), hh = length( w - d * s0 ) + 0.08;
				glow += ( atan( ( t - s0 ) / hh ) - atan( -s0 / hh ) ) / hh * exp( -PSIG * length( w ) * 0.7 );
			#endif
		}
		lamp = PLAMP * ( lamp * 7.0 + 0.05 ) * uPoolNight; glow *= vec3( 0.25, 0.75, 0.9 ) * PLAMP * 0.045 * uPoolNight;
	}
	vec3 Tv = exp( -PSIG * t );
	vec3 scat = vec3( 0.012, 0.075, 0.095 ) * ( Ei * 2.0 + sunR * vis * 0.12 ) * ( 1.0 - exp( -0.6 * t ) );   // voile bleu de la profondeur
	return ( alb * ( direct + amb + lamp ) + em ) * Tv + scat + glow;
}

/* Bassin d'un voisin (plan d'eau sans cuve) : fond uniforme à 1,3 m. */
vec3 pwFlat( vec3 V, vec3 n, vec3 L, vec3 sunR, float vis, vec3 Ei ) {
	vec3 d = refract( V, n, 0.7519 ); float t = 1.3 / max( -d.y, 0.1 );
	vec3 Lw = -refract( -L, vec3( 0.0, 1.0, 0.0 ), 0.7519 );
	vec3 alb = vec3( 0.6, 0.72, 0.76 ), c = alb * ( sunR * vis * max( Lw.y, 0.0 ) * exp( -PSIG * 1.3 / max( Lw.y, 0.1 ) ) + Ei * exp( -PSIG * 1.5 ) );
	return c * exp( -PSIG * t ) + vec3( 0.012, 0.075, 0.095 ) * Ei * 2.0 * ( 1.0 - exp( -0.6 * t ) );
}

vec3 pwShade( vec3 Ed, vec3 Ei ) {
	bool mainPool = vPoolUv.x > 500.0;
	vec3 P = mainPool ? vec3( vPoolUv.x - ${OFF.toFixed(1)}, uPoolDim.x, vPoolUv.y - ${OFF.toFixed(1)} ) : vPoolW;
	vec3 E = cameraPosition + ( P - vPoolW ), V = normalize( P - E );
	vec3 L = vec3( 0.0, 1.0, 0.0 ), sunC = vec3( 0.0 );
	#if NUM_DIR_LIGHTS > 0
		L = normalize( inverseTransformDirection( directionalLights[ 0 ].direction, viewMatrix ) ); sunC = directionalLights[ 0 ].color;
	#endif
	vec3 sunR = sunC * RECIPROCAL_PI;
	// part du soleil qui atteint la surface (ombres portées des parasols, de l'immeuble) : relue dans l'éclairage calculé pour un plan blanc
	float sl = dot( sunR, vec3( 0.3333 ) ) * max( L.y, 0.0 ), vis = sl > 1e-5 ? clamp( dot( Ed, vec3( 0.3333 ) ) / sl, 0.0, 1.0 ) : 0.0;
	if ( vPoolN.y < 0.5 ) return vec3( 0.6, 0.72, 0.76 ) * Ei * 0.6;            // flancs d'un bassin voisin
	float fw = length( fwidth( vPoolW ) );
	vec3 n = pwWaves( P.xz, fw );
	if ( dot( -V, n ) < 0.02 ) n = normalize( n + V * ( dot( -V, n ) - 0.02 ) );   // jamais une ride vue par en dessous en vue rasante
	float F = pwFres( dot( -V, n ) );
	vec3 R = reflect( V, n ); R.y = max( R.y, 0.015 ); R = normalize( R );
	vec3 refl = pwRefl( P, R, L, sunR, Ei );
	vec3 H = normalize( L - V ); float nh = max( dot( n, H ), 0.0 );
	vec3 glint = sunC * vis * max( dot( n, L ), 0.0 ) * pwFres( max( dot( L, H ), 0.0 ) ) * ( 9.0 * pow( nh, 900.0 ) + 0.5 * pow( nh, 90.0 ) );
	glint = min( glint, vec3( 5.0 ) );                                           // reflets du soleil adoucis : pas de point brûlé
	vec3 inside = mainPool ? pwTank( P, V, n, L, sunR, vis, Ei ) : pwFlat( V, n, L, sunR, vis, Ei );
	return mix( inside, refl, F ) + glint;
}
`;

/* Matériau de l'eau. M : les matériaux (le degré de nuit est relu sur les rubans LED, que la visite règle avec l'heure). */
export function poolWater(quality, M) {
  const low = !quality.ao && !quality.bloom, S = 512;
  const tile = new THREE.CanvasTexture(tileCanvas(S)); tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.colorSpace = THREE.SRGBColorSpace; tile.anisotropy = quality.aniso || 4;
  const cs = causticCanvas(low ? 256 : 512), caus = new THREE.CanvasTexture(cs.c); caus.wrapS = caus.wrapT = THREE.RepeatWrapping;
  const U = {
    uPoolTile: { value: tile }, uPoolCaus: { value: caus },
    uPoolBox: { value: new THREE.Vector4() }, uPoolDim: { value: new THREE.Vector4() }, uStepZ: { value: new THREE.Vector4() }, uStepD: { value: new THREE.Vector4() },
    uLampZ: { value: new THREE.Vector2() }, uPoolT: { value: 7.3 }, uPoolNight: { value: 0 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.userData = { cast: false, pool: U };
  // rang des revêtements (1) : l'eau passe devant le remblai de la terrasse, à 5 mm sous elle
  Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -0.4, polygonOffsetUnits: -2 });
  let inner = null;
  const patch = function (sh, r) {
    if (inner) inner.call(this, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPoolUv; varying vec3 vPoolW; varying vec3 vPoolN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvPoolUv = uv; vPoolW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vPoolN = normalize( mat3( modelMatrix ) * objectNormal );');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `#define PW_NW ${low ? 3 : 6}\n#define PW_CM ${cs.m2.toFixed(4)}\n#define PW_CL 0.3\n${low ? '#define POOL_LOW\n' : ''}${PARS}\nvoid main() {`)
      .replace('#include <opaque_fragment>', 'outgoingLight = pwShade( reflectedLight.directDiffuse, reflectedLight.indirectDiffuse );\n#include <opaque_fragment>');
  };
  // la visite pose ensuite son propre complément (occlusion, plafond de luminance) : il est chaîné avant celui-ci
  Object.defineProperty(m, 'onBeforeCompile', { configurable: true, get: () => patch, set: (f) => { inner = f; } });
  m.customProgramCacheKey = () => 'pool|' + (low ? 1 : 0) + '|' + (inner ? inner.name : '');
  // rides : elles n'avancent que si la vue a bougé depuis l'image précédente (aucune image n'est rendue pour elles seules)
  const last = new Float32Array(16); let t0 = 0;
  m.onBeforeRender = (renderer, scene, camera) => {
    const led = M.led; U.uPoolNight.value = led ? THREE.MathUtils.clamp((led.emissiveIntensity - 1) / 0.8, 0, 1) : 0;
    if (low) return;
    const e = camera.matrixWorld.elements, now = performance.now(); let moved = false;
    for (let i = 0; i < 16; i++) if (Math.abs(e[i] - last[i]) > 1e-6) { moved = true; last[i] = e[i]; }
    if (moved && t0) U.uPoolT.value += Math.min(0.05, (now - t0) / 1000);
    t0 = now;
  };
  return m;
}

/* ── Le bassin dans le site ────────────────────────────────────────────────────────────────────────────────────── */

/* Bassin de PX0..PX1 × PZ0..PZ1 (repère de l'immeuble), terrasse à la cote y. Margelles de 30 cm en travertin à nez arrondi,
   eau 7 cm sous leur dessus (le remblai de la terrasse est 5 mm plus bas), plage immergée et marches au Sud, échelle au Nord. */
export function buildPool(b, M, { PX0, PX1, PZ0, PZ1, y: TERR }) {
  const trav = M.travertine || M.terrace, MW = 0.3, R = 0.0375, X0 = PX0 + MW, X1 = PX1 - MW, Z0 = PZ0 + MW, Z1 = PZ1 - MW, YW = TERR - 0.035;
  const LADDER_Z = Z0 + 1.3;
  // plan d'eau : glissé de 2 cm sous les margelles ; ses UV portent la position dans le site (voir poolWater)
  const g = new THREE.BufferGeometry(), e = 0.02, xa = X0 - e, xb = X1 + e, za = Z0 - e, zb = Z1 + e;
  g.setAttribute('position', new THREE.Float32BufferAttribute([xa, YW, za, xa, YW, zb, xb, YW, zb, xa, YW, za, xb, YW, zb, xb, YW, za], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([xa, za, xa, zb, xb, zb, xa, za, xb, zb, xb, za].map((v) => v + OFF), 2));
  b.add(M.water, g);
  const U = M.water.userData && M.water.userData.pool;
  if (U) {                                                    // le même pour les deux logements : la cuve est décrite dans le repère du site
    U.uPoolBox.value.set(X0, Z0, X1, Z1);
    U.uPoolDim.value.set(YW, 1.6, 0.4 / (Z1 - 3.05 - Z0), LADDER_Z);
    U.uStepZ.value.set(Z1 - 2.0, Z1 - 2.35, Z1 - 2.7, Z1 - 3.05); U.uStepD.value.set(0.3, 0.525, 0.75, 0.975);
    U.uLampZ.value.set(Z0 + 4.4, Z0 + 8.0);
  }
  // margelles : dalles de 30 cm, nez demi-rond de 7,5 cm au droit de la paroi
  const y0 = TERR - 0.04, y1 = TERR + 0.035, yc = (y0 + y1) / 2;
  b.box(trav, PX0, y0, PZ0, PX1, y1, Z0 - R); b.box(trav, PX0, y0, Z1 + R, PX1, y1, PZ1);
  b.box(trav, PX0, y0, Z0 - R, X0 - R, y1, Z1 + R); b.box(trav, X1 + R, y0, Z0 - R, PX1, y1, Z1 + R);
  b.rod(trav, [X0 - R, yc, Z0 - R], [X1 + R, yc, Z0 - R], R, 12); b.rod(trav, [X0 - R, yc, Z1 + R], [X1 + R, yc, Z1 + R], R, 12);
  b.rod(trav, [X0 - R, yc, Z0 - R], [X0 - R, yc, Z1 + R], R, 12); b.rod(trav, [X1 + R, yc, Z0 - R], [X1 + R, yc, Z1 + R], R, 12);
  // couvercles des deux skimmers, sur la plage Nord derrière la margelle
  for (const x of [X0 + 1.2, X1 - 1.2]) b.cyl(M.concrete, x, TERR, PZ0 - 0.24, 0.155, 0.006, 20);
  // transats et parasols sur la plage Ouest
  for (let i = 0; i < 5; i++) { b.push(24.6, TERR, 14.6 + i * 2.15, Math.PI / 2); F.lounger(b, M, {}); b.pop(); if (i % 2 === 0) { b.push(23.35, TERR, 15.65 + i * 2.15, 0); F.parasol(b, M, { r: 1.5, h: 2.4 }); b.pop(); } }
  // échelle inox au grand bain : mains courantes scellées dans la plage, descente à 17 cm de la paroi (la partie immergée est dessinée par l'eau)
  for (const dz of [-0.25, 0.25]) { const z = LADDER_Z + dz; b.tube(M.steel, [[PX0 - 0.14, TERR, z], [PX0 - 0.12, TERR + 0.55, z], [PX0 + 0.06, TERR + 0.84, z], [X0 + 0.1, TERR + 0.66, z], [X0 + 0.171, TERR + 0.25, z], [X0 + 0.171, YW - 0.06, z]], 0.021, 8); }
  // douche de plage
  { const x = 23.2, z = 13.7; b.rod(M.steel, [x, TERR + 0.007, z], [x, TERR + 2.25, z], 0.04, 10); b.rod(M.steel, [x, TERR + 2.2, z], [x + 0.3, TERR + 2.25, z], 0.02, 8); b.cyl(M.steel, x + 0.32, TERR + 2.17, z, 0.09, 0.03, 14, 0.06);
    b.rod(M.steel, [x, TERR + 1.2, z], [x + 0.15, TERR + 1.2, z], 0.012, 6); b.box(M.cadre, x - 0.3, TERR + 0.001, z - 0.3, x + 0.3, TERR + 0.006, z + 0.3); }
}
