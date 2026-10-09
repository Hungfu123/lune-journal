import io
import os
import tempfile

import pytest

_DATA = tempfile.mkdtemp(prefix="tagebuch-test-")
os.environ.update(
    GOOGLE_CLIENT_ID="test-client",
    ALLOWED_EMAILS="hung@example.com,lea@example.com",
    MEDIA_SECRET="x" * 40,
    DATA_DIR=_DATA,
    COOKIE_SECURE="false",
    PUBLIC_URL="http://testserver",
)

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.security import COOKIE, new_session  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def users(client):
    with Session(engine) as db:
        hung = User(email="hung@example.com", name="Hung")
        lea = User(email="lea@example.com", name="Lea")
        db.add(hung)
        db.add(lea)
        db.commit()
        db.refresh(hung)
        db.refresh(lea)
        return {"hung": (hung.id, new_session(db, hung, "pytest")), "lea": (lea.id, new_session(db, lea, "pytest"))}


@pytest.fixture
def as_user(client, users):
    def switch(name: str | None):
        client.cookies.clear()
        if name:
            client.cookies.set(COOKIE, users[name][1])
        return client
    yield switch
    client.cookies.clear()


def jpeg(taken: str | None = "2026:02:14 18:42:00", gps: bool = True, size=(1200, 900)) -> bytes:
    img = Image.new("RGB", size, (180, 120, 90))
    exif = Image.Exif()
    if taken:
        exif[0x8769] = {36867: taken, 36881: "+01:00"}
    if gps:
        exif[0x8825] = {1: "N", 2: (51.0, 12.0, 36.0), 3: "E", 4: (6.0, 46.0, 48.0)}
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Keine echten Anfragen an OpenStreetMap oder Push-Dienste."""
    import app.geocode as geocode
    import app.push as push

    monkeypatch.setattr(geocode, "reverse", lambda db, lat, lon: "Rheinufer, Düsseldorf")
    sent = []
    monkeypatch.setattr(push, "_send", lambda cond, payload: sent.append(payload))
    yield sent
