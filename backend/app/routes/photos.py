from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import UnidentifiedImageError
from sqlmodel import Session

from ..db import get_db
from ..geocode import fill_place
from ..images import MAX_UPLOAD, process_upload
from ..models import Photo, User
from ..security import current_user
from .serialize import photo_out

router = APIRouter(prefix="/api/photos", tags=["photos"])


@router.post("")
async def upload(file: UploadFile, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Das Foto ist zu groß (max. 40 MB).")
    try:
        # Bildverarbeitung im Thread, damit die App währenddessen weiter antwortet
        info = await run_in_threadpool(process_upload, data)
    except UnidentifiedImageError:
        raise HTTPException(415, "Diese Datei ist kein Foto, das die App lesen kann.")
    photo = Photo(user_id=user.id, **info)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    if photo.lat is not None:
        bg.add_task(fill_place, photo.id)
    return photo_out(photo)
