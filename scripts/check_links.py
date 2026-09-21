#!/usr/bin/env python3
"""Comprueba enlaces rotos en las páginas del sitio.
Uso:  python3 scripts/check_links.py [--internal-only]
Sale con código 1 si hay enlaces rotos (así GitHub avisa por email)."""
import glob, os, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

INTERNAL_ONLY = "--internal-only" in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SKIP = ("schema.org", "w3.org", "fonts.g", "googletagmanager", "google-analytics", "api.github.com",
        "cdn.jsdelivr", "tailwindcss.com", "localhost", "example.com")
# Se ignoran los enlaces de carpetas privadas o internas
PAGES = [f for f in glob.glob("*.html") if not f.startswith(("tarifas-", "monitor-", "subir-fotos", "calculadora-", "drapsaten-"))]
# Las redes sociales rechazan a los robots (400/403/999) aunque el enlace funcione: se cuentan como "no verificables"
SOCIAL = ("facebook.com", "instagram.com", "linkedin.com", "pinterest.", "twitter.com", "x.com", "tiktok.com")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

def text(f): return open(f, encoding="utf-8", errors="ignore").read()

# ---- internos ----
internal_bad = []
for f in PAGES:
    s = text(f)
    refs = re.findall(r'''(?:href|src)\s*=\s*["']([^"'\s]+)["']''', s)
    refs += re.findall(r'''["'`](\./[^"'`\s]+\.(?:pdf|html|jpg|jpeg|png|webp|mp4|json|js|css|woff2))["'`]''', s)
    for u in set(refs):
        if u.startswith(("http", "mailto:", "tel:", "data:", "#", "javascript:", "//")) or "${" in u:
            continue
        p = u.split("#")[0].split("?")[0]
        if not p: continue
        path = p.lstrip("/") if p.startswith("/") else os.path.normpath(os.path.join(os.path.dirname(f), p))
        if not os.path.exists(path): internal_bad.append((f, u))

# ---- externos ----
urls = set()
if not INTERNAL_ONLY:
    for f in PAGES:
        for u in re.findall(r'''https?://[^\s"'`<>)\\]+''', text(f)):
            u = u.rstrip(".,;")
            if any(k in u for k in SKIP) or "${" in u or "wa.me" in u: continue
            urls.add(u)

def check(u):
    last = None
    for attempt in range(2):
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(u, method=method, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=25) as r:
                    return u, r.status, "OK"
            except urllib.error.HTTPError as e:
                last = e.code
                if e.code in (401, 403, 405, 429, 999) or (e.code == 400 and any(d in u for d in SOCIAL)):
                    if method == "GET": return u, e.code, "WARN"
                    continue
                if method == "GET": return u, e.code, "FAIL"
            except Exception as e:
                last = str(e)[:80]
        time.sleep(2)
    return u, last, "FAIL"

results = []
if urls:
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(check, sorted(urls)))

fails = [r for r in results if r[2] == "FAIL"]
warns = [r for r in results if r[2] == "WARN"]
print(f"Internos rotos: {len(internal_bad)}")
for f, u in internal_bad: print(f"  [INTERNO] {f} -> {u}")
if not INTERNAL_ONLY:
    print(f"Externos comprobados: {len(results)} | rotos: {len(fails)} | no verificables (bloquean bots): {len(warns)}")
    for u, c, _ in fails: print(f"  [ROTO {c}] {u}")
    for u, c, _ in warns: print(f"  [AVISO {c}] {u}")
sys.exit(1 if (internal_bad or fails) else 0)
