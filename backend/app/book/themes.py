"""Druck-Paletten pro Theme. Dunkle App-Themes bekommen eine helle Papier-Variante mit denselben Schriften,
weil dunkle Seiten im Druck teuer, matschig und schlecht lesbar werden."""

DISPLAY = {
    "bricolage": ("Bricolage-Bold.ttf", "-0.02em"),
    "wald": ("Fraunces-Wald.ttf", "-0.01em"),
    "lavendel": ("Fraunces-Lavendel.ttf", "0"),
    "retro": ("Fraunces-Retro.ttf", "-0.02em"),
    "kino": ("DMSerifDisplay-Regular.ttf", "0"),
    "bonbon": ("Fredoka-SemiBold.ttf", "0"),
    "polaroid": ("Manrope-Bold.ttf", "-0.025em"),
}

BOOK_THEMES = {
    "sunset":   dict(name="Sonnenuntergang", display="bricolage", paper="#FFFAF6", ink="#2A1712", muted="#6E4E42", line="#F1DCCF", soft="#FCE6DA", me="#C8432C", her="#7A3E9D", radius="5mm"),
    "ocean":    dict(name="Ozean", display="bricolage", paper="#FAFDFD", ink="#0E252C", muted="#47636B", line="#D3E5E8", soft="#E3F1F3", me="#0B6F78", her="#B4501A", radius="5mm"),
    "night":    dict(name="Nacht", display="bricolage", paper="#FBFAFF", ink="#1E1A2E", muted="#5E5775", line="#E4DFF2", soft="#F0ECFA", me="#5B44A8", her="#B8336A", radius="5mm"),
    "zitrone":  dict(name="Zitrone", display="bricolage", paper="#FFFDF2", ink="#18203D", muted="#515A76", line="#F2E6A6", soft="#FFF3B8", me="#1F44B8", her="#B8420A", radius="4.5mm"),
    "tiefsee":  dict(name="Tiefsee", display="bricolage", paper="#F8FBFD", ink="#0D2333", muted="#4E6779", line="#D6E4EE", soft="#E8F1F7", me="#0E7C74", her="#A85A00", radius="5mm"),
    "wald":     dict(name="Wald", display="wald", paper="#FAFBF5", ink="#1F2A1C", muted="#55604E", line="#DAE1CF", soft="#E8EEDD", me="#3E6B35", her="#9A5B14", radius="4mm"),
    "lavendel": dict(name="Lavendel", display="lavendel", paper="#FCFBFE", ink="#2A2440", muted="#605879", line="#E5DFF3", soft="#F0EBFA", me="#6A4FB3", her="#3D7A5C", radius="5.5mm"),
    "retro":    dict(name="Retro", display="retro", paper="#FFF8EC", ink="#3A2213", muted="#76563F", line="#E6CFAF", soft="#F4E2C6", me="#B83F0C", her="#246A64", radius="3.5mm"),
    "kino":     dict(name="Kino", display="kino", paper="#FFFBF6", ink="#2A1418", muted="#6E5550", line="#EADBD2", soft="#F6ECE4", me="#8A5A00", her="#B23A55", radius="3mm"),
    "bonbon":   dict(name="Bonbon", display="bonbon", paper="#FFF8FB", ink="#2B1030", muted="#6D4870", line="#FFD3E6", soft="#FFE6F0", me="#C81E63", her="#16707F", radius="7mm"),
    "puder":    dict(name="Puder", display="lavendel", paper="#FFFBFC", ink="#2C1F26", muted="#6B5460", line="#F0DDE6", soft="#F8EBF1", me="#A83F67", her="#45688A", radius="6mm"),
    "himmel":   dict(name="Himmel", display="polaroid", paper="#FBFCFF", ink="#17202E", muted="#52637C", line="#DAE3F1", soft="#EAF0FA", me="#3A5CA6", her="#A8552F", radius="4mm"),
    "mandel":   dict(name="Mandel", display="bonbon", paper="#FFFCF6", ink="#2A2018", muted="#6A5847", line="#EADBC8", soft="#F5EADC", me="#9B5340", her="#4F6E58", radius="5mm"),
    "polaroid": dict(name="Polaroid", display="polaroid", paper="#FFFFFF", ink="#1A1A1A", muted="#666661", line="#E2E2DE", soft="#F1F1EE", me="#D1401F", her="#2563C9", radius="1mm"),
}


def book_theme(key: str) -> dict:
    t = dict(BOOK_THEMES.get(key, BOOK_THEMES["sunset"]))
    t["display_file"], t["display_tracking"] = DISPLAY[t["display"]]
    t["key"] = key if key in BOOK_THEMES else "sunset"
    return t
