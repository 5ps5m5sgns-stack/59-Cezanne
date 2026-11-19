"""Génère visite-3d.html : reprend le menu et le pied de page de logements.html, calcule l'empreinte des modules de /visite
et écrit la carte d'import. À relancer après toute modification de visite/** ou du menu : python3 outils/mkpage.py
puis python3 outils/version_assets.py."""
# Assemble /visite-3d.html : en-tête, navigation et pied de page repris tels quels de logements.html.
import re, hashlib, glob, io
import os
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+'/'       # racine du dépôt
src=open(R+'logements.html',encoding='utf-8').read()
# la visite 3D n'a pas de page anglaise : son sélecteur de langue reste une bascule sur place
src=src.replace('<a href="/en/logements" hreflang="en" lang="en" class="lang-btn">EN</a>','<button type="button" class="lang-btn" lang="en" aria-pressed="false" onclick="setLang(\'en\')">EN</button>')
nav=src[src.index('<a class="skip-link"'):src.index('<main id="contenu">')]
nav=nav.replace(' class="active" aria-current="page"',' class="active"')
# dans le menu, c'est l'entrée « Visite 3D » qui est la page courante
nav=nav.replace(' class="active"','')
nav=nav.replace('<a href="/visite-3d" ','<a href="/visite-3d" class="active" aria-current="page" ')
foot=src[src.index('<!-- ─── Footer'):src.index('<script src="/animations.js')]
def stamp(name):
    m=re.search(r'/%s\?v=([0-9a-f]+)'%re.escape(name),src); return m.group(1)
h=hashlib.md5()
for f in sorted(glob.glob(R+'visite/**/*',recursive=True)):
    if f.endswith(('.js','.css')): h.update(open(f,'rb').read())
V=h.hexdigest()[:8]
mods=['geo','flora','materials','furniture','build','pool','site','decor','plans','env','nav','main']
imap='{"imports":{"three":"/vendor/three/three.module.min.js?v=r170","three/addons/":"/vendor/three/addons/",'+','.join('"v3d/%s":"/visite/js/%s.js?v=%s"'%(m,m,V) for m in mods)+'}}'
def t(fr,en,tag='span',cls=''):
    c=(' class="%s"'%cls) if cls else ''
    return '<%s%s data-lang-fr="%s" data-lang-en="%s">%s</%s>'%(tag,c,fr.replace('"','&quot;'),en.replace('"','&quot;'),fr,tag)
ICON={
 'site':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 11l9-6 9 6"/><path d="M5 10v10h14V10"/><path d="M9 20v-5h6v5M9 12h1.5M13.5 12H15"/></svg>',
 'orbit':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
 'walk':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
 'plan':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 4h18v16H3zM3 11h9M12 4v10M12 17v3M16 11h5"/></svg>',
 'play':'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg>',
 'full':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
 'rooms':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
 'up':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6"/></svg>',
 'look':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>',
 'sun':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
}
def seg(mode,fr,en): return '<button type="button" class="v3d-seg" data-mode="%s" aria-pressed="false">%s%s</button>'%(mode,ICON[mode],t(fr,en))
TITLE='Visite 3D des appartements neufs à Aix | 59 Cézanne'
DESC="Visitez en 3D la résidence 59 Cézanne à Aix-en-Provence et ses deux derniers logements : l'appartement-villa de 138 m² et le duplex de 206 m²."
import datetime
TODAY=datetime.date.today().isoformat()
html=f'''<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{TITLE}</title>
  <meta name="description" content="{DESC}" />
  <link rel="canonical" href="https://59-cezanne.com/visite-3d" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="author" content="Ponthieu Développement Holding" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="59 Cézanne" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:title" content="Visite 3D : un appartement-villa de 138 m² et un duplex de 206 m² | 59 Cézanne" />
  <meta property="og:description" content="Parcourez en 3D les deux derniers logements de la résidence 59 Cézanne, avenue Paul Cézanne à Aix-en-Provence : maquette, visite libre, plan et lumière selon l'heure." />
  <meta property="og:url" content="https://59-cezanne.com/visite-3d" />
  <meta property="og:image" content="https://59-cezanne.com/og/og-visite-3d.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Image de synthèse non contractuelle : la résidence 59 Cézanne vue du ciel, sa piscine, ses jardins et l'avenue Paul Cézanne" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Visite 3D : un appartement-villa de 138 m² et un duplex de 206 m² | 59 Cézanne" />
  <meta name="twitter:description" content="La résidence 59 Cézanne et ses deux derniers logements en 3D : vue d'ensemble, maquette, visite libre, plan." />
  <meta name="twitter:image" content="https://59-cezanne.com/og/og-visite-3d.jpg" />

  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <link rel="stylesheet" href="/style.css?v={stamp('style.css')}" />
  <!-- Visite 3D : après toute modification d'un fichier de /visite, changer l'empreinte ?v= ci-dessous (feuille de style et carte d'import). -->
  <link rel="stylesheet" href="/visite/visite.css?v={V}" />
  <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/gilda-display-latin.woff2" />
  <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/jost-latin.woff2" />
  <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/whisper-400-latin.woff2" />
  <script type="importmap">{imap}</script>
  <link rel="modulepreload" href="/vendor/three/three.module.min.js?v=r170" />

  <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "WebPage",
      "@id": "https://59-cezanne.com/visite-3d#page",
      "url": "https://59-cezanne.com/visite-3d",
      "name": "{TITLE}",
      "description": "{DESC}",
      "inLanguage": "fr-FR",
      "dateModified": "{TODAY}",
      "isPartOf": {{ "@id": "https://59-cezanne.com/#website" }},
      "publisher": {{ "@id": "https://59-cezanne.com/#organization" }},
      "primaryImageOfPage": {{ "@type": "ImageObject", "url": "https://59-cezanne.com/og/og-visite-3d.jpg", "width": 1200, "height": 630 }},
      "about": {{ "@id": "https://59-cezanne.com/#residence" }}
    }},
    {{
      "@type": "BreadcrumbList",
      "itemListElement": [
        {{ "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://59-cezanne.com/" }},
        {{ "@type": "ListItem", "position": 2, "name": "Logements", "item": "https://59-cezanne.com/logements" }},
        {{ "@type": "ListItem", "position": 3, "name": "Visite 3D", "item": "https://59-cezanne.com/visite-3d" }}
      ]
    }}
  ]
}}
  </script>
</head>
<body>

{nav}
<main id="contenu" class="v3d-page">

  <!-- ─── Titre et choix du logement ─── -->
  <section class="v3d-head" aria-labelledby="titre-page">
    <div>
      <nav class="v3d-crumb" aria-label="Fil d'Ariane" data-aria-label-fr="Fil d'Ariane" data-aria-label-en="Breadcrumb">
        <ol>
          <li><a href="/" data-lang-fr="Accueil" data-lang-en="Home">Accueil</a></li>
          <li><a href="/logements" data-lang-fr="Logements" data-lang-en="Apartments">Logements</a></li>
          <li aria-current="page" data-lang-fr="Visite 3D" data-lang-en="3D tour">Visite 3D</li>
        </ol>
      </nav>
      {t("Comme si vous y étiez","As if you were there","p","script")}
      {t("Visite 3D des deux derniers logements","3D tour of the last two homes",'h1 id="titre-page"').replace('</h1 id="titre-page">','</h1>')}
    </div>
    <div class="v3d-apts" role="group" aria-label="Choix du logement" data-aria-label-fr="Choix du logement" data-aria-label-en="Choose a home">
      <button type="button" data-apt="villa" class="is-on" aria-pressed="true">{t("Appartement-villa","Villa-style apartment","strong")}{t("4 pièces · 138 m² · jardin","4 rooms · 138 m² · garden","small")}</button>
      <button type="button" data-apt="duplex" aria-pressed="false">{t("Duplex","Duplex","strong")}{t("4 pièces · 206 m² · ascenseur privatif","4 rooms · 206 m² · private lift","small")}</button>
    </div>
  </section>

  <!-- ─── Scène 3D ─── -->
  <section id="v3d" class="v3d" data-mode="orbit" aria-label="Visite 3D interactive" data-aria-label-fr="Visite 3D interactive" data-aria-label-en="Interactive 3D tour">
    <canvas id="v3d-canvas" tabindex="0" aria-label="Vue 3D du logement. Les pièces sont aussi accessibles par la liste « Pièces »." data-aria-label-fr="Vue 3D du logement. Les pièces sont aussi accessibles par la liste « Pièces »." data-aria-label-en="3D view of the home. Rooms can also be reached from the “Rooms” list."></canvas>
    <div id="v3d-labels"></div>
    <div id="v3d-lots" hidden></div>
    <div id="v3d-spots"></div>

    <div class="v3d-ui v3d-card v3d-modes" role="group" aria-label="Mode de vue" data-aria-label-fr="Mode de vue" data-aria-label-en="View mode">
      {seg('site','Résidence','Residence')}
      {seg('orbit','Maquette','Model')}
      {seg('walk','Visite libre','Walk')}
      {seg('plan','Plan','Plan')}
    </div>

    <div class="v3d-ui v3d-tools">
      <button type="button" class="v3d-seg" id="v3d-tour" aria-pressed="false">{ICON['play']}<span>Visite guidée</span></button>
      <button type="button" class="v3d-seg v3d-round" id="v3d-full" aria-label="Plein écran" data-aria-label-fr="Plein écran" data-aria-label-en="Full screen">{ICON['full']}</button>
    </div>

    <nav class="v3d-ui v3d-nav" aria-label="Pièces du logement" data-aria-label-fr="Pièces du logement" data-aria-label-en="Rooms of the home">
      <div class="v3d-card v3d-levels" id="v3d-levels" role="group" aria-label="Niveau" data-aria-label-fr="Niveau" data-aria-label-en="Level" hidden></div>
      <div class="v3d-card v3d-rooms" id="v3d-rooms"></div>
    </nav>

    <button type="button" class="v3d-ui v3d-seg v3d-round v3d-setbtn" id="v3d-panel-toggle" aria-label="Lumière et sols" data-aria-label-fr="Lumière et sols" data-aria-label-en="Light and floors">{ICON['sun']}</button>
    <div class="v3d-ui v3d-card v3d-panel">
      <div class="v3d-set">
        {t("Heure","Time")}
        <input type="range" id="v3d-time" min="6.5" max="21.5" step="0.25" value="11" aria-label="Heure du jour" data-aria-label-fr="Heure du jour" data-aria-label-en="Time of day" />
        <output id="v3d-time-out" for="v3d-time">11 h 00</output>
      </div>
      <div class="v3d-presets">
        <button type="button" data-hour="9.5">{t("Matin","Morning")}</button>
        <button type="button" data-hour="13.75">{t("Midi","Midday")}</button>
        <button type="button" data-hour="19.5">{t("Heure dorée","Golden hour")}</button>
        <button type="button" data-hour="21.5">{t("Soir","Evening")}</button>
      </div>
      <div class="v3d-set">
        {t("Sol","Floor")}
        <div id="v3d-floors" role="group" aria-label="Finition du sol" data-aria-label-fr="Finition du sol" data-aria-label-en="Floor finish"></div>
        <output id="v3d-floor-out">Chêne miel</output>
      </div>
    </div>

    <div class="v3d-ui v3d-pad" role="group" aria-label="Se déplacer" data-aria-label-fr="Se déplacer" data-aria-label-en="Move around">
      <button type="button" class="v3d-seg v3d-round" data-key="ArrowUp" aria-label="Avancer" data-aria-label-fr="Avancer" data-aria-label-en="Move forward">{ICON['up']}</button>
      <button type="button" class="v3d-seg v3d-round" data-key="ArrowLeft" aria-label="Tourner à gauche" data-aria-label-fr="Tourner à gauche" data-aria-label-en="Turn left">{ICON['up']}</button>
      <button type="button" class="v3d-seg v3d-round" data-key="ArrowDown" aria-label="Reculer" data-aria-label-fr="Reculer" data-aria-label-en="Move back">{ICON['up']}</button>
      <button type="button" class="v3d-seg v3d-round" data-key="ArrowRight" aria-label="Tourner à droite" data-aria-label-fr="Tourner à droite" data-aria-label-en="Turn right">{ICON['up']}</button>
    </div>
    <button type="button" class="v3d-ui v3d-seg v3d-round v3d-look" id="v3d-look" aria-label="Regarder autour de soi" data-aria-label-fr="Regarder autour de soi" data-aria-label-en="Look around">{ICON['look']}</button>
    <div class="v3d-ui v3d-card v3d-mapbox">
      <canvas id="v3d-map" width="440" height="230" aria-label="Mini-plan : cliquez pour vous déplacer" data-aria-label-fr="Mini-plan : cliquez pour vous déplacer" data-aria-label-en="Mini plan: click to move"></canvas>
      <p id="v3d-hud" aria-live="polite"></p>
    </div>
    <div id="v3d-fade" aria-hidden="true"></div>

    <p id="v3d-hint" aria-hidden="true"></p>
    <p id="v3d-caption" hidden></p>
    {t("Images de synthèse non contractuelles, d'après les plans de l'architecte. Mobilier indicatif.","Computer-generated images, not contractual, based on the architect's plans. Furniture for illustration.","p","v3d-note")}

    <div id="v3d-loader">
      <p class="script">59 Cézanne</p>
      <div class="v3d-spin" aria-hidden="true"></div>
      <p id="v3d-loader-text" role="status">Préparation de la visite…</p>
      <div class="v3d-bar" aria-hidden="true"><i id="v3d-loader-bar"></i></div>
    </div>
    <div id="v3d-fallback" hidden>
      <img src="/visite/img/maquette-appartement-villa-138m2.webp" srcset="/visite/img/maquette-appartement-villa-138m2-800w.webp 800w, /visite/img/maquette-appartement-villa-138m2.webp 1200w" sizes="(max-width: 900px) 100vw, 1200px" width="1200" height="756" alt="Maquette 3D de l'appartement de 138 m² : séjour tourné vers la Sainte-Victoire, trois chambres, jardin" data-alt-fr="Maquette 3D de l'appartement de 138 m² : séjour tourné vers la Sainte-Victoire, trois chambres, jardin" data-alt-en="3D model of the 138 m² apartment: living room facing the Sainte-Victoire, three bedrooms, garden" loading="lazy" decoding="async" />
      <p></p>
      <a class="btn btn-primary" href="/logements#disponibles">{t("Voir les deux logements","See the two homes")}</a>
    </div>
    <noscript><p style="position:absolute;inset:auto 1rem 1rem;z-index:7;background:#fff;padding:1rem;border-radius:12px">La visite 3D a besoin de JavaScript. Les deux logements sont présentés sur la page <a href="/logements">Logements</a>.</p></noscript>
  </section>

  <!-- ─── Les deux logements, le mode d'emploi, les mentions ─── -->
  <section class="v3d-info" aria-labelledby="t-v3d-biens">
    <div>
      {t("Deux façons d'habiter","Two ways to live","p","script")}
      {t("Un appartement-villa et un duplex, à parcourir pièce par pièce","A villa-style apartment and a duplex, to explore room by room",'h2 class="section-title" id="t-v3d-biens"').replace('</h2 class="section-title" id="t-v3d-biens">','</h2>')}
    </div>
    <div class="v3d-duo">
      <article class="v3d-bien">
        <h3>{t("Appartement-villa","Villa-style apartment","small")}{t("4 pièces, 138&nbsp;m²","4 rooms, 138&nbsp;m²")}</h3>
        <ul>
          <li {t("Séjour de 46&nbsp;m² et cuisine avec îlot, ouverts à l'Est sur le balcon et la Sainte-Victoire","46&nbsp;m² living room and kitchen with island, opening east onto the balcony and the Sainte-Victoire","x")[3:-4]}</li>
          <li {t("De plain-pied avec le jardin de 82&nbsp;m²&nbsp;: la chambre 1 avec dressing et salle de bains, la chambre 2 et le bureau","Level with the 82&nbsp;m² garden: bedroom 1 with dressing room and bathroom, bedroom 2 and the study","x")[3:-4]}</li>
          <li {t("Une troisième chambre, une seconde salle de bains, une buanderie","A third bedroom, a second bathroom, a laundry","x")[3:-4]}</li>
        </ul>
        <div class="dispo-cta">
          <button type="button" class="btn btn-primary" data-open="villa">{t("Ouvrir la visite 3D","Open the 3D tour")}</button>
          <a class="btn btn-outline-dark" href="/contact?bien=138">{t("Demander une visite","Request a visit")}</a>
        </div>
      </article>
      <article class="v3d-bien">
        <h3>{t("Duplex","Duplex","small")}{t("4 pièces, 206&nbsp;m²","4 rooms, 206&nbsp;m²")}</h3>
        <ul>
          <li {t("Près de 100&nbsp;m² de séjours et de cuisine ouverts sur le jardin, avec arrière-cuisine et buanderie","Nearly 100&nbsp;m² of living rooms and kitchen opening onto the garden, with scullery and laundry","x")[3:-4]}</li>
          <li {t("À l'étage, trois chambres, dont la chambre 1 avec ses placards et sa salle de bains, et une seconde salle de bains","Upstairs, three bedrooms, including bedroom 1 with its wardrobes and bathroom, and a second bathroom","x")[3:-4]}</li>
          <li {t("Ascenseur privatif, accès direct au parking, terrasse et jardin d'environ 56&nbsp;m²","Private lift, direct access to the car park, terrace and garden of about 56&nbsp;m²","x")[3:-4]}</li>
        </ul>
        <div class="dispo-cta">
          <button type="button" class="btn btn-primary" data-open="duplex">{t("Ouvrir la visite 3D","Open the 3D tour")}</button>
          <a class="btn btn-outline-dark" href="/contact?bien=duplex-206">{t("Demander une visite","Request a visit")}</a>
        </div>
      </article>
    </div>
    <div class="v3d-how">
      <div>{t("La maquette","The model","h3")}{t("La vue Résidence montre l'immeuble entier, la piscine et le quartier, avec les deux logements repérés. La maquette montre le logement vu de dessus, murs coupés&nbsp;: cliquez sur une pièce pour y entrer.","The Residence view shows the whole building, the pool and the neighbourhood, with the two homes marked. The model shows the home from above with the walls cut: click a room to step inside.","p")}</div>
      <div>{t("La visite libre","The walk-through","h3")}{t("À hauteur d'œil&nbsp;: glissez pour regarder, cliquez là où vous voulez aller, ou sur le nom d'une pièce voisine pour vous y rendre. La molette, ou deux doigts écartés sur un écran tactile, avance et recule. Dans le duplex, l'escalier et l'ascenseur mènent à l'étage.","At eye level: drag to look, click where you want to go, or on the name of a nearby room to walk there. The scroll wheel, or two fingers spread apart on a touch screen, moves you forward and back. In the duplex, the stairs and the lift take you upstairs.","p")}</div>
      <div>{t("La lumière et les sols","Light and floors","h3")}{t("Faites défiler la journée, du soleil du matin sur le séjour à la soirée éclairée, et comparez plusieurs finitions de sol.","Scroll through the day, from morning sun in the living room to a lamp-lit evening, and compare several floor finishes.","p")}</div>
    </div>
    <p class="v3d-legal" data-lang-fr="Images de synthèse non contractuelles, établies d'après les plans de vente de l'architecte&nbsp;: «&nbsp;Logement 08&nbsp;», indice C du 29 avril 2024, pour l'appartement-villa, et «&nbsp;Logement 02 - V4&nbsp;» pour le duplex. Les cotes imprimées sur ces plans sont reprises telles quelles&nbsp;; ce qui n'y est pas coté est mesuré sur le dessin. Les surfaces des pièces sont celles des plans, indicatives, avec une tolérance de 5&nbsp;%. L'immeuble et ses abords sont représentés d'après le plan de masse et les façades du dossier de l'architecte&nbsp;; les autres logements, les constructions voisines, la végétation et le paysage sont figurés de manière indicative. Le mobilier reprend la disposition dessinée sur les plans&nbsp;; ses formes, les matériaux et la décoration sont des illustrations d'ambiance. Seuls les plans et la notice descriptive remis lors de la réservation ont une valeur contractuelle." data-lang-en="Computer-generated images, not contractual, based on the architect's sales plans: “Logement 08”, revision C of 29 April 2024, for the villa-style apartment, and “Logement 02 - V4” for the duplex. The dimensions printed on these plans are used as they are; anything not dimensioned is measured from the drawing. Room areas are those of the plans, indicative, with a 5% tolerance. The building and its grounds follow the site plan and elevations of the architect's set; the other homes, neighbouring buildings, planting and landscape are indicative. The furniture follows the layout drawn on the plans; its shapes, the materials and the decoration are mood illustrations. Only the plans and descriptive notice provided at reservation are contractually binding.">Images de synthèse non contractuelles, établies d'après les plans de vente de l'architecte&nbsp;: «&nbsp;Logement 08&nbsp;», indice C du 29 avril 2024, pour l'appartement-villa, et «&nbsp;Logement 02 - V4&nbsp;» pour le duplex. Les cotes imprimées sur ces plans sont reprises telles quelles&nbsp;; ce qui n'y est pas coté est mesuré sur le dessin. Les surfaces des pièces sont celles des plans, indicatives, avec une tolérance de 5&nbsp;%. L'immeuble et ses abords sont représentés d'après le plan de masse et les façades du dossier de l'architecte&nbsp;; les autres logements, les constructions voisines, la végétation et le paysage sont figurés de manière indicative. Le mobilier reprend la disposition dessinée sur les plans&nbsp;; ses formes, les matériaux et la décoration sont des illustrations d'ambiance. Seuls les plans et la notice descriptive remis lors de la réservation ont une valeur contractuelle.</p>
  </section>

</main>

{foot}
<script src="/animations.js?v={stamp('animations.js')}" defer></script>
<script src="/translations.js?v={stamp('translations.js')}" defer></script>
<script src="/cookie.js?v={stamp('cookie.js')}" defer></script>
<script type="module">import 'v3d/main';</script>
<script>
/* Navigateur trop ancien (pas de carte d'import) ou module non chargé : on affiche le repli plutôt qu'un chargement sans fin. */
(function () {{
  function repli() {{
    if (window.__v3dBoot) return;
    var f = document.getElementById('v3d-fallback'), l = document.getElementById('v3d-loader'); if (!f) return;
    var en = (document.documentElement.lang || '').indexOf('en') === 0;
    f.querySelector('p').textContent = en ? 'The 3D tour needs a recent browser. The two homes are presented on the Apartments page.' : 'La visite 3D a besoin d’un navigateur récent. Les deux logements sont présentés sur la page Logements.';
    f.hidden = false; if (l) l.hidden = true;
  }}
  if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'))) window.addEventListener('load', repli);
  else window.addEventListener('load', function () {{ setTimeout(repli, 12000); }});
}})();
/* Boutons « Ouvrir la visite 3D » : sélectionnent le logement et remontent à la scène. */
document.addEventListener('click', function (e) {{
  var b = e.target.closest && e.target.closest('[data-open]'); if (!b) return;
  var tab = document.querySelector('[data-apt="' + b.getAttribute('data-open') + '"]'); if (tab) tab.click();
  document.getElementById('v3d').scrollIntoView({{ behavior: 'smooth', block: 'center' }});
}});
</script>
</body>
</html>
'''
html=html.replace('<li data-lang-fr','<li data-lang-fr')
open(R+'visite-3d.html','w',encoding='utf-8').write(html)
print('written', len(html), 'V=',V)
