from ..images import media_path
from ..models import Photo


def photo_out(p: Photo) -> dict:
    return {
        "id": p.id,
        "thumb": media_path(p.id, "thumb"),
        "src": media_path(p.id, "app"),
        "print": media_path(p.id, "print"),
        "width": p.width,
        "height": p.height,
        "taken_at": p.taken_at.isoformat() if p.taken_at else None,
        "tz_offset": p.tz_offset,
        "place_name": p.place_name,
        "has_location": p.lat is not None,
    }
