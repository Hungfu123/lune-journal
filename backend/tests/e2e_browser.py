"""Browser-Test der kompletten App (Handy + Desktop) gegen das echte Backend.

Ablauf:
  1. Backend mit leerem DATA_DIR starten:   uvicorn app.main:app --port 8000
  2. Frontend bauen und starten:            cd ../frontend && npm run build && npx vite preview --port 4173
  3. Testnutzer anlegen und Test starten:   python tests/e2e_browser.py
Voraussetzung: pip install playwright pytest && playwright install chromium
"""
import os
import json, io, time, base64, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from playwright.sync_api import sync_playwright, expect
from tests.conftest import jpeg  # nur die Hilfsfunktion
URL='http://127.0.0.1:4173'
DATA=os.environ['DATA_DIR']
from sqlmodel import Session, select
from app.db import engine, init_db
from app.models import User
from app.security import new_session
init_db()
with Session(engine) as _db:
    _users = {u.email: u for u in _db.exec(select(User)).all()}
    for _email, _name in (("hung@example.com", "Hung"), ("lea@example.com", "Lea")):
        if _email not in _users:
            _users[_email] = User(email=_email, name=_name); _db.add(_users[_email]); _db.commit(); _db.refresh(_users[_email])
    tok = {"hung": new_session(_db, _users["hung@example.com"], "e2e"), "lea": new_session(_db, _users["lea@example.com"], "e2e")}
open(DATA+'/feb.jpg','wb').write(jpeg(taken="2026:02:14 18:42:00"))
open(DATA+'/now.jpg','wb').write(jpeg(taken=None, gps=False))
results=[]; errors=[]
def check(name, fn):
    try: fn(); results.append(('OK',name))
    except Exception as e: results.append(('FAIL',name+': '+str(e).splitlines()[0][:160]))
def media(route):
    f=DATA+'/media/'+route.request.url.split('/media/')[1].split('?')[0]
    try: route.fulfill(path=f)
    except Exception: route.fulfill(status=404)
def ctx_for(b, user, w, h):
    c=b.new_context(viewport={'width':w,'height':h}, service_workers='block', has_touch=w<600)
    c.add_cookies([{'name':'tb_session','value':tok[user],'url':URL}])
    c.route('**/media/**', media)
    c.route('https://accounts.google.com/**', lambda r: r.fulfill(body='', content_type='text/javascript'))
    p=c.new_page()
    p.on('pageerror', lambda e: errors.append(f'{user}:{w} pageerror {e}'))
    p.on('console', lambda m: m.type=='error' and 'favicon' not in m.text and errors.append(f'{user}:{w} console {m.text[:140]}'))
    return c,p

with sync_playwright() as pw:
    b=pw.chromium.launch()
    # ---------------- Handy ----------------
    c,p=ctx_for(b,'hung',390,844); p.goto(URL); 
    check('Timeline lädt', lambda: expect(p.locator('.brand')).to_have_text('Lune Journal', timeout=5000))
    check('Leere Timeline zeigt Einladung', lambda: expect(p.locator('.empty')).to_be_visible())
    def post_mobile():
        p.click('.fab'); expect(p.locator('.sheet-bar-title')).to_be_visible()
        p.fill('textarea.input-hand', 'Kirschblüten am Rhein!')
        p.locator('input[type=file][multiple]').set_input_files(DATA+'/feb.jpg')
        expect(p.locator('.suggest')).to_be_visible(timeout=5000)
        p.click('.suggest >> text=Ja'); expect(p.locator('.chip')).to_contain_text('14. Feb')
        p.click('button.mood >> text=super')
        p.click('.sheet-bar >> text=Posten')
        expect(p.locator('.card-hand', has_text='Kirschblüten')).to_be_visible(timeout=5000)
        expect(p.locator('.month-btn')).to_contain_text('Februar')
    check('Handy: Eintrag mit Foto, Datumsvorschlag, Stimmung posten', post_mobile)
    check('Foto im Eintrag sichtbar', lambda: expect(p.locator('.card img.is-loaded')).to_have_count(1, timeout=5000))
    def heart():
        p.click('.card .pill'); expect(p.locator('.card .pill')).to_contain_text('1')
    check('Herz geben', heart)
    def lightbox():
        p.click('.card .photo-btn'); expect(p.locator('.lb')).to_be_visible(); p.click('.lb-close'); expect(p.locator('.lb')).to_have_count(0)
    check('Foto groß ansehen (Handy)', lightbox)
    def month_sheet():
        p.click('.month-btn'); p.wait_for_timeout(700); expect(p.locator('.month-tile[aria-pressed=true]')).to_contain_text('Feb')
        expect(p.locator('.month-tile >> nth=1')).to_contain_text('1 Einträge'); p.keyboard.press('Escape')
        p.click('text=Zurück zu heute'); expect(p.locator('.empty')).to_be_visible()
    check('Monatsübersicht und zurück zu heute', month_sheet)
    def ask():
        p.click('text=Frage an Lea stellen'); p.fill('textarea.input-question', 'Berge oder Meer?')
        p.click('label.switch-row'); p.click('.sheet >> text=Frage stellen')
        expect(p.locator('.ask-card')).to_contain_text('Deine Frage, ihr antwortet beide')
    check('Frage stellen (beide antworten)', ask)
    def ideas():
        p.click('text=Frage an Lea stellen'); p.click('text=Ideen zeigen'); expect(p.locator('.idea')).to_have_count(3); p.keyboard.press('Escape')
    check('Frage-Ideen laden', ideas)
    c2,p2=ctx_for(b,'lea',390,844); p2.goto(URL)
    def lea_answers():
        expect(p2.locator('.ask-card')).to_contain_text('Berge oder Meer?', timeout=5000)
        p2.fill('textarea.input-answer','Meer!'); p2.get_by_role('button', name='Antworten', exact=True).click()
        expect(p2.locator('.waiting')).to_contain_text('Wartet auf Hung')
    check('Lea antwortet, Antwort bleibt verdeckt', lea_answers)
    def hung_reveals():
        p.reload(); expect(p.locator('.ask-card')).to_contain_text('Lea hat schon geantwortet', timeout=5000)
        p.fill('textarea.input-answer','Berge!'); p.get_by_role('button', name='Antwort aufdecken').click()
        expect(p.locator('.qa')).to_contain_text('Meer!'); expect(p.locator('.qa')).to_contain_text('Berge!')
    check('Hung deckt auf, beide Antworten in der Timeline', hung_reveals)
    def delete_hold():
        p.click('.month-btn'); p.wait_for_timeout(700)  # Sheet fertig aufgeklappt
        p.click('.month-tile >> nth=1'); expect(p.locator('.month-btn')).to_contain_text('Februar')
        expect(p.locator('[data-vaul-drawer]')).to_have_count(0, timeout=3000); p.wait_for_timeout(400)
        p.locator('.card', has_text='Kirschblüten').locator('button[aria-label=Optionen]').click(); p.wait_for_timeout(700); hold=p.locator('button.hold'); expect(hold).to_be_visible()
        box=hold.bounding_box(); p.mouse.move(box['x']+20, box['y']+20); p.mouse.down(); p.wait_for_timeout(2300); p.mouse.up()
        expect(p.locator('.card-hand')).to_have_count(0, timeout=3000)
    check('Eintrag per Gedrückthalten löschen', delete_hold)
    def theme():
        p.click('button[aria-label=Einstellungen]'); p.click('.theme-tile >> text=Kino'); p.wait_for_timeout(800)
        p.keyboard.press('Escape'); p.reload(); expect(p.locator('html')).to_have_attribute('data-theme','kino', timeout=5000)
    check('Theme wechseln bleibt nach Neuladen', theme)
    def book():
        # Eintrag fürs Buch
        p.click('.fab'); p.fill('textarea.input-hand','Buchtest'); p.click('.sheet-bar >> text=Posten'); expect(p.locator('.card-hand', has_text='Buchtest')).to_be_visible(timeout=5000)
        p.click('button[aria-label="Buch erstellen"]'); p.click('.book-sheet >> text=Buch erstellen')
        expect(p.locator('.bv')).to_be_visible(timeout=15000); expect(p.locator('.bv-count')).to_contain_text('Seite 1 von')
        stage=p.locator('.bv-stage').bounding_box(); p.mouse.click(stage['x']+stage['width']*0.85, stage['y']+stage['height']/2)
        expect(p.locator('.bv-count')).to_contain_text('Seite 2 von', timeout=3000)
        # Wischen zurück
        p.mouse.move(stage['x']+40, stage['y']+300); p.mouse.down(); p.mouse.move(stage['x']+300, stage['y']+300, steps=6); p.mouse.up()
        expect(p.locator('.bv-count')).to_contain_text('Seite 1 von', timeout=3000)
        p.click('button[aria-label=Schließen]'); expect(p.locator('.book-sheet')).to_be_visible()
    check('Buch erstellen, durchblättern (Tippen und Wischen)', book)
    c.close(); c2.close()

    # ---------------- Desktop ----------------
    c,p=ctx_for(b,'lea',1440,900); p.goto(URL)
    check('Desktop: Seitenleiste und Schreibtisch', lambda: (expect(p.locator('.side-cal')).to_be_visible(timeout=5000), expect(p.locator('.desk')).to_be_visible()))
    def desk_post():
        p.click('.desk-text'); p.keyboard.type('Vom Laptop geschrieben.'); p.keyboard.press('Control+Enter')
        expect(p.locator('.card-hand', has_text='Vom Laptop')).to_be_visible(timeout=5000)
    check('Desktop: tippen und Strg+Enter postet', desk_post)
    def drop():
        data=base64.b64encode(open(DATA+'/now.jpg','rb').read()).decode()
        p.evaluate("""(b64) => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const dt = new DataTransfer();
            dt.items.add(new File([bin], 'drop.jpg', {type: 'image/jpeg'}));
            window.dispatchEvent(new DragEvent('dragenter', {dataTransfer: dt}));
            window.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, cancelable: true})); }""", data)
        expect(p.locator('.desk .upload[data-status=done]')).to_have_count(1, timeout=5000)
        p.locator('.desk').get_by_role('button', name='Posten', exact=True).click()
        expect(p.locator('.card img')).to_have_count(1, timeout=5000)
    check('Desktop: Foto ins Fenster ziehen und posten', drop)
    def focus():
        p.click('.desk-text'); p.keyboard.type('Langer Tag'); p.click('button[aria-label=Fokus-Modus]'); expect(p.locator('.focus')).to_be_visible()
        p.keyboard.type(', viel erlebt.'); p.keyboard.press('Escape'); expect(p.locator('.desk-text')).to_have_value('Langer Tag, viel erlebt.')
    check('Desktop: Fokus-Modus behält Text', focus)
    def keys():
        p.click('.feed-heading'); p.keyboard.press('ArrowLeft'); expect(p.locator('.feed-heading h2')).to_contain_text('September', timeout=3000)
        p.keyboard.press('ArrowRight'); expect(p.locator('.feed-heading h2')).to_contain_text('Oktober', timeout=3000)
    check('Desktop: Pfeiltasten wechseln Monat', keys)
    def panel():
        p.click('button[aria-label=Einstellungen]'); box=p.locator('.sheet').bounding_box(); assert box['x']>900, box; p.keyboard.press('Escape')
    check('Desktop: Einstellungen als Panel rechts', panel)
    def spread():
        p.locator('.feed-heading').click(); p.keyboard.press('b'); p.click('.book-sheet >> text=Buch erstellen'); expect(p.locator('.bv-stage.is-spread')).to_be_visible(timeout=15000)
        p.keyboard.press('ArrowRight'); expect(p.locator('.bv-count')).to_contain_text('Seite 2–3', timeout=3000); p.keyboard.press('Escape')
    check('Desktop: Buch als Doppelseite, Pfeiltasten', spread)
    c.close(); b.close()

for s,n in results: print(s, n)
print('\nFehler in der Konsole:' if errors else '\nKeine Fehler in der Konsole.')
for e in dict.fromkeys(errors): print(' ', e)
