/* 59 Cézanne — visite 3D : photographies de matières extérieures (domaine public, voir visite/licences/flore.md).
   La construction de la scène est synchrone : les images doivent être décodées avant que materials.js ne crée ses textures.
   Ce module les charge lui-même, à son évaluation, et la suspend (attente de premier niveau) jusqu'à ce qu'elles soient prêtes,
   avec un délai maximal : main.js, qui l'importe indirectement, ne démarre qu'ensuite, l'écran de chargement déjà affiché.
   Une image absente, illisible ou trop lente laisse simplement sa place au dessin procédural (IMG[nom] reste indéfini). */

const FILES = ['pierre-seche', 'pierre-seche-r', 'tuiles', 'tuiles-r', 'travertin', 'gravillons', 'gravillons-r', 'enrobe', 'enrobe-r', 'ecorce', 'ecorce-r'];
export const IMG = {};

function load(name) {
  return new Promise((ok) => {
    if (typeof Image === 'undefined') return ok();
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).then(() => { IMG[name] = im; ok(); }, () => ok()); };
    im.onerror = () => ok();
    im.src = new URL('../assets/flore/' + name + '.webp', import.meta.url).href;
  });
}

/* Promesse exportée : résolue quand toutes les images sont prêtes ou abandonnées (jamais rejetée). */
export const floraReady = Promise.race([Promise.all(FILES.map(load)), new Promise((r) => setTimeout(r, 4000))]).then(() => IMG);
await floraReady;
