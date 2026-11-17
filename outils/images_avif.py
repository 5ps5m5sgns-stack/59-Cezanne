"""Ajoute une source AVIF aux images WebP adaptatives qui n'en ont pas : pour chaque <img srcset="….webp …"> hors <picture>,
fabrique les fichiers AVIF de même largeur (à partir du WebP correspondant) puis enveloppe l'image dans
<picture><source type="image/avif" srcset="…" sizes="…"><img …></picture>. Le navigateur qui ne lit pas l'AVIF garde le WebP.
Sans argument : liste ce qui serait fait. Avec « appliquer » : écrit images et pages.
Pages traitées : celles passées après « appliquer » (chemins relatifs à la racine), sinon les pages principales FR et EN.
python3 outils/images_avif.py [appliquer] [page.html …]"""
import os, re, sys, urllib.parse
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
APPLY = len(sys.argv) > 1 and sys.argv[1] == 'appliquer'
args = [a for a in sys.argv[1:] if a != 'appliquer']
pages = args or ['index.html', 'logements.html', 'localisation.html', 'contact.html',
                 'en.html', 'en/logements.html', 'en/localisation.html', 'en/contact.html']
QUALITE = 58          # même réglage que outils/images_variantes.py
IMG = re.compile(r'<img\b[^>]*>')

def local(url):
    u = urllib.parse.unquote(url.split('?')[0])
    return R + u.lstrip('/') if u.startswith('/') else None

made = {}
total_webp = total_avif = 0
for page in pages:
    s = open(R + page, encoding='utf-8').read()
    out, pos, n = [], 0, 0
    for m in IMG.finditer(s):
        tag = m.group(0)
        before = s[:m.start()]
        if before.rfind('<picture') > before.rfind('</picture>'): continue          # déjà dans un <picture>
        ss = re.search(r'\ssrcset="([^"]+)"', tag); sz = re.search(r'\ssizes="([^"]+)"', tag)
        if not ss or not sz: continue
        cands = [c.split() for c in ss.group(1).split(',')]
        if not all(len(c) == 2 and c[0].endswith('.webp') for c in cands): continue
        avif = []
        for url, w in cands:
            src = local(url); dst = src[:-5] + '.avif' if src else None
            if not src or not os.path.isfile(src): avif = None; break
            if not os.path.isfile(dst) and dst not in made:
                made[dst] = src
                if APPLY: Image.open(src).convert('RGB').save(dst, quality=QUALITE, speed=4)
            if APPLY and os.path.isfile(dst):
                total_webp += os.path.getsize(src); total_avif += os.path.getsize(dst)
            avif.append(url[:-5] + '.avif ' + w)
        if not avif: continue
        # indentation de la ligne de l'image, pour garder un balisage lisible
        out.append(s[pos:m.start()])
        out.append('<picture><source type="image/avif" srcset="%s" sizes="%s">%s</picture>' % (', '.join(avif), sz.group(1), tag))
        pos = m.end(); n += 1
    out.append(s[pos:])
    if n:
        print(page, ':', n, 'image(s) enveloppée(s)')
        if APPLY: open(R + page, 'w', encoding='utf-8').write(''.join(out))
print(len(made), 'fichier(s) AVIF', 'fabriqué(s)' if APPLY else 'à fabriquer')
if APPLY and total_webp: print('poids des candidats : WebP %d Ko, AVIF %d Ko' % (total_webp // 1024, total_avif // 1024))
