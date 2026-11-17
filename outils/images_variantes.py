"""Complète les jeux d'images adaptatives : là où un srcset saute de 1200w (ou moins) à 2000w et plus, ajoute un candidat 1600w ;
là où il saute de 1600w à 2400w, ajoute un candidat 2000w. Les fichiers manquants sont fabriqués à partir du plus grand candidat,
dans le même format (WebP ou AVIF). Sans argument : liste ce qui serait fait. Avec « appliquer » : écrit images et pages.
python3 outils/images_variantes.py [appliquer]"""
import os, re, sys, glob, urllib.parse
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
APPLY = len(sys.argv) > 1 and sys.argv[1] == 'appliquer'
pages = glob.glob(R + '*.html') + glob.glob(R + 'en/*.html') + glob.glob(R + 'blog/*.html')
ATTR = re.compile(r'((?:srcset|imagesrcset)=")([^"]+)(")')
made, changed, skipped = {}, 0, set()

def local(url):
    u = url.split('?')[0]
    if u.startswith('https://59-cezanne.com'): u = u[len('https://59-cezanne.com'):]
    return R + urllib.parse.unquote(u).lstrip('/') if u.startswith('/') else None

def variant(url, big_url, w):
    """URL du candidat de largeur w, fabriqué au besoin à partir du plus grand fichier du jeu."""
    m = re.match(r'(.*?)(?:-\d+w)?(\.(?:webp|avif))$', url)
    new = m.group(1) + '-%dw' % w + m.group(2)
    path, src = local(new), local(big_url)
    if path is None or src is None or not os.path.isfile(src): return None
    if not os.path.isfile(path):
        if path not in made:
            im = Image.open(src)
            if im.width < w * 1.1: skipped.add(os.path.basename(src)); return None
            made[path] = (src, w)
            if APPLY:
                im = im.convert('RGB').resize((w, round(im.height * w / im.width)), Image.LANCZOS)
                if path.endswith('.avif'): im.save(path, quality=58, speed=4)
                else: im.save(path, quality=80, method=6)
    return new

def fix(m):
    global changed
    cands = []
    for part in m.group(2).split(','):
        q = part.split()
        if len(q) != 2 or not q[1].endswith('w'): return m.group(0)
        cands.append([q[0], int(q[1][:-1])])
    cands.sort(key=lambda c: c[1]); big = cands[-1]; out = list(cands)
    for a, b in zip(cands, cands[1:]):
        w = 1600 if (a[1] <= 1300 and b[1] >= 2000) else 2000 if (a[1] == 1600 and b[1] >= 2400) else None
        if w:
            u = variant(a[0], big[0], w)
            if u: out.append([u, w])
    if len(out) == len(cands): return m.group(0)
    out.sort(key=lambda c: c[1]); changed += 1
    return m.group(1) + ', '.join('%s %dw' % (u, w) for u, w in out) + m.group(3)

for p in sorted(pages):
    if p.endswith('visite-3d.html'): continue
    s = open(p, encoding='utf-8').read(); t = ATTR.sub(fix, s)
    if t != s and APPLY: open(p, 'w', encoding='utf-8').write(t)
print('jeux d\'images complétés :', changed, '| fichiers', 'créés' if APPLY else 'à créer', ':', len(made))
for path, (src, w) in sorted(made.items()):
    print('  %s (%s)' % (os.path.relpath(path, R), ('%d Ko' % (os.path.getsize(path) // 1024)) if os.path.isfile(path) else 'depuis ' + os.path.basename(src)))
if skipped: print('sources trop petites, laissées telles quelles :', ', '.join(sorted(skipped)))
