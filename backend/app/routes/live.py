import asyncio

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..live import subscribe, unsubscribe
from ..models import User
from ..security import current_user

router = APIRouter(prefix="/api", tags=["live"])

# Ohne regelmäßiges Lebenszeichen schließen Proxys die stille Verbindung
PING_SECONDS = 20


@router.get("/stream")
async def stream(user: User = Depends(current_user)):
    """Server-Sent Events: meldet Änderungen, damit die App nichts verpasst."""
    q = subscribe()

    async def events():
        try:
            yield ": verbunden\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=PING_SECONDS)
                except TimeoutError:
                    yield ": ping\n\n"
                    continue
                yield f"data: {payload}\n\n"
        finally:
            unsubscribe(q)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            # Nginx puffert sonst, bis die Antwort fertig ist — und die wird nie fertig
            "X-Accel-Buffering": "no",
        },
    )
