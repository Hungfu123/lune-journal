"""Prüft gegen die laufende Seite, ob Chrome auf Android die App installierbar
nennt — und sie damit ins Teilen-Menü aufnimmt. Aufruf: python deploy/pwa-pruefen.py

Prüft die Bedingungen, unter denen Chrome auf Android eine App installierbar nennt —
und damit ins Teilen-Menü aufnimmt."""
import json, sys, urllib.request

BASIS = "https://lune-journal.duckdns.org"
def hole(pfad, binaer=False):
    with urllib.request.urlopen(BASIS + pfad, timeout=20) as r:
        return (r.read(), r.status, dict(r.headers))

m_roh, status, _ = hole("/manifest.webmanifest")
m = json.loads(m_roh)
pruefungen = []
pruefungen.append(("Manifest erreichbar", status == 200))
pruefungen.append(("name gesetzt", bool(m.get("name"))))
pruefungen.append(("short_name gesetzt", bool(m.get("short_name"))))
pruefungen.append(("start_url gesetzt", bool(m.get("start_url"))))
pruefungen.append(("display standalone", m.get("display") in ("standalone", "fullscreen", "minimal-ui")))
icons = m.get("icons", [])
groessen = {i.get("sizes") for i in icons}
pruefungen.append(("Symbol 192 px", any("192" in (s or "") for s in groessen)))
pruefungen.append(("Symbol 512 px", any("512" in (s or "") for s in groessen)))
pruefungen.append(("maskierbares Symbol", any("maskable" in (i.get("purpose") or "") for i in icons)))
pruefungen.append(("Teilen-Ziel", m.get("share_target", {}).get("action") == "/share"))
pruefungen.append(("nimmt Bilder an", "image/*" in (m.get("share_target", {}).get("params", {}).get("files", [{}])[0].get("accept") or [])))

for i in icons:
    daten, st, kopf = hole(i["src"])
    pruefungen.append((f"Symbol {i['src']} lädt", st == 200 and len(daten) > 100))

sw, st, _ = hole("/sw.js")
pruefungen.append(("Service Worker lädt", st == 200))
pruefungen.append(("Service Worker fängt /share ab", b"/share" in sw))

seite, st, kopf = hole("/")
pruefungen.append(("Seite über HTTPS", st == 200))

for name, ok in pruefungen:
    print(f"  {'OK  ' if ok else 'FEHLT'} {name}")
print("\nAlles erfüllt:", all(ok for _, ok in pruefungen))
sys.exit(0 if all(ok for _, ok in pruefungen) else 1)
