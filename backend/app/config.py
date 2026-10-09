from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


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
        return {e.strip().lower() for e in self.allowed_emails.split(",") if e.strip()}

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    @property
    def originals_dir(self) -> Path:
        return self.data_dir / "originals"


settings = Settings()
