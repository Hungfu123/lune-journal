from datetime import date

import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session

from ..book.render import BookOptions, preview_dir, render_pdf, render_preview
from ..book.themes import BOOK_THEMES
from ..db import get_db
from ..limiter import limiter
from ..models import User
from ..security import current_user
from fastapi import Request

router = APIRouter(prefix="/api/book", tags=["book"])


def _month(s: str) -> date:
    y, m = map(int, s.split("-"))
    return date(y, m, 1)


def _options(start: str, end: str, theme: str, fmt: str, quality: str, bleed: bool, title: str) -> tuple[BookOptions, str]:
    first, last = _month(start), _month(end)
    if last < first:
        raise HTTPException(422, "Der Zeitraum endet vor dem Anfang.")
    if (last.year - first.year) * 12 + last.month - first.month > 23:
        raise HTTPException(422, "Ein Buch umfasst höchstens 24 Monate.")
    stop = date(last.year + (last.month == 12), last.month % 12 + 1, 1)
    opts = BookOptions(start=first, end=stop, theme=theme if theme in BOOK_THEMES else "sunset",
                       fmt=fmt, quality=quality, bleed=bleed, title=title.strip())
    return opts, f"Lune-Journal-{start}{'' if start == end else '_' + end}.pdf"


@router.get("/preview")
@limiter.limit("12/hour")
async def preview(
    request: Request,
    start: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    end: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    theme: str = "sunset",
    fmt: str = Query("a5", pattern="^(a5|a4)$"),
    quality: str = Query("screen", pattern="^(screen|print)$"),
    bleed: bool = False,
    title: str = Query("", max_length=60),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Erzeugt das Buch und liefert Seitenbilder zum Durchblättern plus Link zum fertigen PDF."""
    opts, name = _options(start, end, theme, fmt, quality, bleed, title)
    info = await run_in_threadpool(render_preview, db, user, opts, name)
    base = f"/api/book/preview/{info['id']}"
    return {
        "id": info["id"], "name": name, "aspect": info["aspect"],
        "pages": [f"{base}/{i}.webp" for i in range(info["pages"])],
        "pdf": f"{base}/book.pdf",
    }


def _preview_file(preview_id: str, filename: str, user: User):
    if not preview_id.isalnum():
        raise HTTPException(404, "Nicht gefunden")
    d = preview_dir() / preview_id
    meta_file = d / "meta.json"
    if not meta_file.exists():
        raise HTTPException(404, "Die Vorschau ist abgelaufen. Erstell das Buch bitte neu.")
    meta = json.loads(meta_file.read_text())
    f = d / filename
    if not f.exists():
        raise HTTPException(404, "Nicht gefunden")
    return f, meta


@router.get("/preview/{preview_id}/book.pdf")
def preview_pdf(preview_id: str, user: User = Depends(current_user)):
    f, meta = _preview_file(preview_id, "book.pdf", user)
    return FileResponse(f, media_type="application/pdf", filename=meta["name"], headers={"Cache-Control": "private, max-age=86400"})


@router.get("/preview/{preview_id}/{page}.webp")
def preview_page(preview_id: str, page: int, user: User = Depends(current_user)):
    f, _ = _preview_file(preview_id, f"{page}.webp", user)
    return FileResponse(f, media_type="image/webp", headers={"Cache-Control": "private, max-age=86400"})


@router.get("")
@limiter.limit("6/hour")
async def book(
    request: Request,
    start: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    end: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    theme: str = "sunset",
    fmt: str = Query("a5", pattern="^(a5|a4)$"),
    quality: str = Query("screen", pattern="^(screen|print)$"),
    bleed: bool = False,
    title: str = Query("", max_length=60),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    opts, name = _options(start, end, theme, fmt, quality, bleed, title)
    pdf = await run_in_threadpool(render_pdf, db, user, opts)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})
