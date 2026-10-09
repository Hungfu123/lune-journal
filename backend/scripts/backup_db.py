"""Konsistenter Schnappschuss der SQLite-Datenbank für das Backup (läuft auch während die App läuft)."""
import sqlite3
import sys
from pathlib import Path

# Direkt aufgerufen liegt nur scripts/ im Importpfad — app/ fehlt sonst.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings

src = sqlite3.connect(settings.data_dir / "app.db")
dst = sqlite3.connect(settings.data_dir / "app.backup.db")
with dst:
    src.backup(dst)
dst.close()
src.close()
print("ok")
