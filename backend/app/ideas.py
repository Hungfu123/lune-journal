"""Frage-Ideen in Kategorien.

once=True: hat eine feste Antwort, wird nach dem Stellen nie wieder vorgeschlagen.
once=False: darf nach REPEAT_AFTER Tagen wiederkommen.
both=True: macht am meisten Spaß, wenn ihr beide antwortet (Schalter wird vorausgewählt).
"""
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

REPEAT_AFTER = timedelta(days=90)
SEASON_REPEAT_AFTER = timedelta(days=300)


@dataclass(frozen=True)
class Idea:
    category: str
    text: str
    once: bool = False
    both: bool = False


LABELS = {
    "leicht": "Leicht",
    "lustig": "Lustig",
    "entweder": "Entweder-oder",
    "uns": "Über uns",
    "zukunft": "Zukunft",
    "erinnerung": "Erinnerung",
    "saison": "Passend zur Jahreszeit",
}

IDEAS: list[Idea] = [
    # Leicht: geht jede Woche
    Idea("leicht", "Was war diese Woche dein schönster Moment mit mir?"),
    Idea("leicht", "Worüber hast du zuletzt so richtig gelacht?"),
    Idea("leicht", "Welches Essen war diesen Monat das beste?"),
    Idea("leicht", "Wann hast du heute an mich gedacht?"),
    Idea("leicht", "Was hat dich diese Woche überrascht?"),
    Idea("leicht", "Worauf freust du dich gerade am meisten?"),
    Idea("leicht", "Was war das Beste an deinem Wochenende?"),
    Idea("leicht", "Was hat dich heute genervt, und was hat es wieder gut gemacht?"),
    Idea("leicht", "Welcher Moment heute hätte ein Foto verdient?"),
    Idea("leicht", "Was war heute dein kleiner Erfolg?"),
    Idea("leicht", "Was hast du gegessen, das ich unbedingt probieren muss?"),
    Idea("leicht", "Mit welchem Wort würdest du deine Woche beschreiben?", both=True),
    # Lustig
    Idea("lustig", "Welches Tier wäre ich und warum?", once=True),
    Idea("lustig", "Was ist mein peinlichster Spruch?"),
    Idea("lustig", "Wer von uns würde in einem Horrorfilm zuerst sterben?", once=True, both=True),
    Idea("lustig", "Welchen Filmtitel hätte unser letztes Wochenende?", both=True),
    Idea("lustig", "Wenn ich ein Gericht wäre, welches wäre ich?", once=True),
    Idea("lustig", "Was wäre mein Spezialgebiet in einer Quizshow?", once=True),
    Idea("lustig", "Welches Geräusch mache ich, ohne es zu merken?", once=True),
    Idea("lustig", "Welche drei Emojis beschreiben mich gerade?"),
    Idea("lustig", "Wie wäre mein Name als Wrestler?", once=True),
    Idea("lustig", "Wer von uns hat den schlechteren Musikgeschmack?", once=True, both=True),
    Idea("lustig", "Wenn unser Leben eine Serie wäre, worum ginge es in der aktuellen Folge?", both=True),
    Idea("lustig", "Was würde ich mit einer Million Euro als Erstes Unvernünftiges kaufen?", once=True),
    # Entweder-oder: am besten beide antworten
    Idea("entweder", "Grillen oder Pizza bestellen?", once=True, both=True),
    Idea("entweder", "Joggen am Morgen oder am Abend?", once=True, both=True),
    Idea("entweder", "Berge oder Meer?", once=True, both=True),
    Idea("entweder", "Frühstück im Bett oder im Café?", once=True, both=True),
    Idea("entweder", "Städtetrip oder Hütte im Wald?", once=True, both=True),
    Idea("entweder", "Serie durchschauen oder Spieleabend?", once=True, both=True),
    Idea("entweder", "Sonnenaufgang oder Sonnenuntergang?", once=True, both=True),
    Idea("entweder", "Süß oder salzig?", once=True, both=True),
    Idea("entweder", "Zu früh am Bahnhof oder auf den letzten Drücker?", once=True, both=True),
    Idea("entweder", "Wandern mit Picknick oder mit Einkehr?", once=True, both=True),
    Idea("entweder", "Sommer oder Winter?", once=True, both=True),
    Idea("entweder", "Neues Restaurant ausprobieren oder ins Lieblingsrestaurant?", once=True, both=True),
    # Über uns
    Idea("uns", "Was kann ich, was du nicht kannst?"),
    Idea("uns", "Wer von uns gibt beim Wandern zuerst auf?", once=True, both=True),
    Idea("uns", "Was ist eine Kleinigkeit, die ich mache und die du magst?"),
    Idea("uns", "Was sollten wir mal wieder machen?"),
    Idea("uns", "Was würdest du gern öfter mit mir machen?"),
    Idea("uns", "Wobei sind wir ein richtig gutes Team?", both=True),
    Idea("uns", "Welche Gewohnheit hast du von mir übernommen?"),
    Idea("uns", "Was ist unser bester Insider-Witz?", once=True, both=True),
    # Zukunft
    Idea("zukunft", "Was möchtest du nächsten Monat unbedingt mit mir machen?"),
    Idea("zukunft", "Welche Tour sollen wir als Nächstes laufen oder wandern?"),
    Idea("zukunft", "Wo sind wir in fünf Jahren an einem Sonntag?", once=True, both=True),
    Idea("zukunft", "Welche Reise machen wir, wenn Geld egal wäre?", once=True, both=True),
    Idea("zukunft", "Wenn wir morgen frei hätten, was würdest du planen?"),
    Idea("zukunft", "Was wollen wir bis Jahresende noch zusammen erleben?", both=True),
    Idea("zukunft", "Welches neue Hobby sollten wir zusammen ausprobieren?", both=True),
    Idea("zukunft", "Was darf in unserem nächsten Urlaub auf keinen Fall fehlen?", both=True),
    # Erinnerung
    Idea("erinnerung", "Was war dein erster Gedanke, als du mich kennengelernt hast?", once=True),
    Idea("erinnerung", "Welches Foto von uns magst du am liebsten und warum?", once=True),
    Idea("erinnerung", "Was war dein Lieblingsmoment im letzten Urlaub?"),
    Idea("erinnerung", "Welcher Song erinnert dich an uns?", once=True),
    Idea("erinnerung", "Welcher Ort, an dem wir zusammen waren, fehlt dir gerade?"),
    Idea("erinnerung", "Was war unser lustigstes Missgeschick?", once=True, both=True),
    Idea("erinnerung", "An welchen Tag mit mir denkst du am liebsten zurück?", once=True),
    Idea("erinnerung", "Wann wusstest du, dass es mit uns was Ernstes ist?", once=True),
]

SEASON: dict[int, Idea] = {
    1: Idea("saison", "Was nehmen wir uns für dieses Jahr zusammen vor?", both=True),
    2: Idea("saison", "Was hilft dir am besten durch den grauen Februar?"),
    3: Idea("saison", "Worauf freust du dich im Frühling am meisten?"),
    4: Idea("saison", "Welcher Ausflug gehört diesen Frühling unbedingt dazu?"),
    5: Idea("saison", "Wann eröffnen wir die Grillsaison?"),
    6: Idea("saison", "Was muss diesen Sommer noch passieren?", both=True),
    7: Idea("saison", "Wie sieht dein perfekter Sommerabend aus?"),
    8: Idea("saison", "Was war bisher das Beste an diesem Sommer?", both=True),
    9: Idea("saison", "Was nimmst du aus dem Sommer mit in den Herbst?"),
    10: Idea("saison", "Was ist für dich das Gemütlichste am Herbst?"),
    11: Idea("saison", "Was wünschst du dir für die Weihnachtszeit mit mir?"),
    12: Idea("saison", "Was war dein Highlight des Jahres?", both=True),
}


def _available(idea: Idea, asked: dict[str, datetime], now: datetime, wait: timedelta) -> bool:
    last = asked.get(idea.text)
    if last is None:
        return True
    return not idea.once and now - last > wait


def suggest(asked: dict[str, datetime], month: int, count: int = 3) -> list[dict]:
    """Drei Ideen aus verschiedenen Kategorien, ohne bereits gestellte. Die Jahreszeit-Frage hat Vorrang."""
    now = datetime.now(timezone.utc)
    picks: list[Idea] = []
    season = SEASON.get(month)
    if season and _available(season, asked, now, SEASON_REPEAT_AFTER):
        picks.append(season)

    by_cat: dict[str, list[Idea]] = {}
    for idea in IDEAS:
        if _available(idea, asked, now, REPEAT_AFTER):
            by_cat.setdefault(idea.category, []).append(idea)
    cats = list(by_cat)
    random.shuffle(cats)
    for cat in cats:
        if len(picks) >= count:
            break
        picks.append(random.choice(by_cat[cat]))
    # Falls fast alles schon gestellt wurde: mit Wiederholbaren auffüllen
    rest = [i for i in IDEAS if not i.once and i not in picks]
    while len(picks) < count and rest:
        picks.append(rest.pop(random.randrange(len(rest))))

    return [{"text": i.text, "category": i.category, "label": LABELS[i.category], "both": i.both} for i in picks]
