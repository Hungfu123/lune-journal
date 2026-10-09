"""Live-Kanal: sagt den offenen Browsern Bescheid, dass sich etwas geändert hat.

Verschickt werden nur winzige Hinweise ("es gibt neue Einträge"), nie Inhalte —
die holt sich der Browser danach ganz normal über die API, mit seiner eigenen
Sitzung. So kann hier nichts an der Zugangsprüfung vorbeirutschen.

Die Routen laufen im Threadpool (FastAPI führt `def`-Endpunkte dort aus), der
Stream dagegen im Event-Loop. Deshalb wird jede Zustellung über
`call_soon_threadsafe` in den Loop zurückgereicht.
"""
import asyncio
import json
import logging

log = logging.getLogger("live")

# Pro offenem Browser-Tab eine Warteschlange
_subscribers: set[asyncio.Queue[str]] = set()
_loop: asyncio.AbstractEventLoop | None = None

# Kurz genug, dass eine volle Schlange nur bei einem toten Tab entsteht
QUEUE_SIZE = 20


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def subscribe() -> asyncio.Queue[str]:
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=QUEUE_SIZE)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue[str]) -> None:
    _subscribers.discard(q)


def publish(kind: str, by_user_id: int | None = None) -> None:
    """Meldet eine Änderung an alle offenen Tabs. `by_user_id` ist der Auslöser,
    damit ein Tab seine eigene Änderung überspringen kann."""
    if _loop is None or not _subscribers:
        return
    payload = json.dumps({"kind": kind, "by": by_user_id})
    for q in list(_subscribers):
        _loop.call_soon_threadsafe(_offer, q, payload)


def _offer(q: "asyncio.Queue[str]", payload: str) -> None:
    try:
        q.put_nowait(payload)
    except asyncio.QueueFull:
        # Tab hängt oder liest nicht mehr: lieber einen Hinweis verlieren als Speicher
        log.warning("Live-Warteschlange voll, Hinweis verworfen")
