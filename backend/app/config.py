from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

GOOGLE_DOMAINS = {"gmail.com", "googlemail.com"}


def normalize_email(adresse: str) -> str:
    """Vergleichsform einer Adresse.

    Google behandelt mehrere Schreibweisen als dasselbe Konto: googlemail.com
    und gmail.com sind identisch, Punkte im Namen zählen nicht, und alles nach
    einem Plus ist Beiwerk. Ohne das sperrt die Zugangsliste jemanden aus, nur
    weil auf dem Handy die alte Domain hinterlegt ist.
    """
    adresse = adresse.strip().lower()
    name, trenner, domain = adresse.partition("@")
    if not trenner:
        return adresse
    if domain in GOOGLE_DOMAINS:
        name = name.split("+", 1)[0].replace(".", "")
        domain = "gmail.com"
    return f"{name}@{domain}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_client_id: str
    allowed_emails: str  # kommagetrennt, nur diese Konten kommen rein
    media_secret: str  # zufälliger langer String, signiert Bild-Links für Benachrichtigungen
    public_url: str = "https://tagebuch.example.com"
    data_dir: Path = Path("/data")
    timezone: str = "Europe/Berlin"
    session_days: int = 90
    cookie_secure: bool = True

    vapid_public_key: str = ""
    vapid_private_key_path: Path = Path("/data/vapid_private.pem")
    vapid_subject: str = "mailto:admin@example.com"

    @cached_property
    def allowed(self) -> set[str]:
        """In Vergleichsform, damit anne.steinfort@googlemail.com genauso
        hereinkommt wie annesteinfort@gmail.com."""
        return {normalize_email(e) for e in self.allowed_emails.split(",") if e.strip()}

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    @property
    def originals_dir(self) -> Path:
        return self.data_dir / "originals"


settings = Settings()
