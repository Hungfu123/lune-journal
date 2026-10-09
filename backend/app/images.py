import io
import uuid
from datetime import datetime

from PIL import ExifTags, Image, ImageOps

from .config import settings

SIZES = {"thumb": 480, "app": 1600, "print": 2500}
QUALITY = {"thumb": 78, "app": 82, "print": 90}
MAX_UPLOAD = 40 * 1024 * 1024


def media_path(photo_id: str, size: str) -> str:
    return f"/media/{photo_id}_{size}.webp"


def _deg(values, ref) -> float:
    d = float(values[0]) + float(values[1]) / 60 + float(values[2]) / 3600
    return -d if ref in ("S", "W") else d


def read_moment(img: Image.Image) -> dict:
    """Wann und wo wurde das Foto aufgenommen? Alles optional."""
    out: dict = {"taken_at": None, "tz_offset": None, "lat": None, "lon": None}
    try:
        exif = img.getexif()
        sub = exif.get_ifd(ExifTags.IFD.Exif)
        raw = sub.get(ExifTags.Base.DateTimeOriginal) or exif.get(ExifTags.Base.DateTime)
        if raw:
            out["taken_at"] = datetime.strptime(str(raw).strip(), "%Y:%m:%d %H:%M:%S")
        out["tz_offset"] = sub.get(ExifTags.Base.OffsetTimeOriginal) or None
        gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
        if 2 in gps and 4 in gps:
            lat, lon = _deg(gps[2], gps.get(1, "N")), _deg(gps[4], gps.get(3, "E"))
            if (lat, lon) != (0.0, 0.0):
                out["lat"], out["lon"] = round(lat, 6), round(lon, 6)
    except Exception:
        pass
    return out


def process_upload(data: bytes) -> dict:
    """Original behalten (für Druck, inkl. Ultra HDR), drei WebP-Größen ohne Metadaten erzeugen.

    Schnell auch bei 50-MP-Fotos: JPEGs werden direkt verkleinert dekodiert (draft),
    und jede Größe entsteht aus der nächstgrößeren statt jedes Mal aus dem Original.
    """
    photo_id = uuid.uuid4().hex
    img = Image.open(io.BytesIO(data))
    moment = read_moment(img)

    ext = (img.format or "jpg").lower().replace("jpeg", "jpg")
    (settings.originals_dir / f"{photo_id}.{ext}").write_bytes(data)

    if img.format == "JPEG":
        img.draft("RGB", (SIZES["print"], SIZES["print"]))
    current = ImageOps.exif_transpose(img).convert("RGB")
    width, height = current.size
    for name in ("print", "app", "thumb"):
        current.thumbnail((SIZES[name], SIZES[name]), Image.LANCZOS)
        # Ohne exif=… gespeichert: GPS landet nie in ausgelieferten Bildern
        current.save(settings.media_dir / f"{photo_id}_{name}.webp", "WEBP", quality=QUALITY[name], method=4)

    return {"id": photo_id, "width": width, "height": height, **moment}


def delete_files(photo_id: str) -> None:
    for name in SIZES:
        (settings.media_dir / f"{photo_id}_{name}.webp").unlink(missing_ok=True)
    for f in settings.originals_dir.glob(f"{photo_id}.*"):
        f.unlink(missing_ok=True)
