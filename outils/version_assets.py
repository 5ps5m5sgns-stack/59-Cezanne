"""Met à jour les empreintes ?v=<8 hex> des CSS/JS référencés par les pages (empreinte = 8 premiers caractères du md5 du fichier),
puis aligne les <lastmod> du sitemap sur la date de modification déclarée par chaque page (JSON-LD dateModified), à défaut sur la date du jour
pour les pages modifiées dans l'arbre de travail. À lancer depuis n'importe où : python3 outils/version_assets.py"""
import re, hashlib, glob, os, subprocess, datetime, json
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'       # racine du dépôt
pages = [f for f in glob.glob(R + '*.html') + glob.glob(R + 'en/*.html') + glob.glob(R + 'blog/*.html')]
cache = {}
def md5(path):
    if path not in cache: cache[path] = hashlib.md5(open(path, 'rb').read()).hexdigest()[:8] if os.path.isfile(path) else None
    return cache[path]
changed = 0
for p in pages:
    if p.endswith('visite-3d.html'): continue                    # régénérée par son script (empreinte propre aux modules de /visite)
    s = open(p, encoding='utf-8').read()
    def sub(m):
        h = md5(R + m.group(1).lstrip('/'))
        return m.group(0) if h is None else m.group(1) + '?v=' + h
    t = re.sub(r'(/[A-Za-z0-9_./-]+\.(?:css|js))\?v=[0-9a-f]{8}', sub, s)
    if t != s: open(p, 'w', encoding='utf-8').write(t); changed += 1
print('empreintes mises à jour dans', changed, 'pages')

# ── sitemap ──
today = datetime.date.today().isoformat()
dirty = set(l[3:].strip().strip('"') for l in subprocess.run(['git', '-C', R, 'status', '--porcelain'], capture_output=True, text=True).stdout.splitlines())
sm = open(R + 'sitemap.xml', encoding='utf-8').read()
def page_of(url):
    path = url.replace('https://59-cezanne.com', '').strip('/')
    return 'index.html' if path == '' else path + '.html'
n = 0
def fix(m):
    global n
    url, old = m.group(1), m.group(2); f = page_of(url); new = old
    if os.path.isfile(R + f):
        s = open(R + f, encoding='utf-8').read()
        dates = re.findall(r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})', s)
        if dates: new = max(dates)
        elif f in dirty: new = today
        if f in dirty and not dates: new = today
    if new != old: n += 1
    return m.group(0).replace('<lastmod>' + old + '</lastmod>', '<lastmod>' + new + '</lastmod>')
sm2 = re.sub(r'<loc>([^<]+)</loc>(?:(?!</url>).)*?<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>', fix, sm, flags=re.S)
open(R + 'sitemap.xml', 'w', encoding='utf-8').write(sm2)
print('sitemap : dates corrigées pour', n, 'URL')
