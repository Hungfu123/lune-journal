import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .db import init_db
from .limiter import limiter
from .live import set_loop
from .reminders import reminder_loop
from .routes import auth, book, comments, entries, gphotos, live, photos, push, questions


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    # Der Live-Kanal stellt aus dem Threadpool in diesen Loop zu
    set_loop(asyncio.get_running_loop())
    task = asyncio.create_task(reminder_loop())
    yield
    task.cancel()


# Keine öffentliche API-Doku: die App ist privat
app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def no_index(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["Cache-Control"] = response.headers.get("Cache-Control", "no-store")
    return response


for r in (auth.router, entries.router, photos.router, push.router, questions.router, book.router, gphotos.router, live.router, comments.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True}
