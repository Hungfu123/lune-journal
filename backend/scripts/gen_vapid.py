"""Erzeugt einmalig das VAPID-Schlüsselpaar für Push.
Aufruf: docker compose run --rm api python scripts/gen_vapid.py
Den ausgegebenen Public Key als VAPID_PUBLIC_KEY in die .env eintragen."""
import base64
import sys
from pathlib import Path

# Direkt aufgerufen liegt nur scripts/ im Importpfad — app/ fehlt sonst.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from py_vapid import Vapid01

from app.config import settings

path: Path = settings.vapid_private_key_path
if path.exists():
    raise SystemExit(f"{path} existiert schon – nicht überschreiben, sonst verfallen alle Push-Abos.")
v = Vapid01()
# Nicht v.generate_keys(): py-vapid 1.9.2 reicht dort die Kurven-Klasse statt
# einer Instanz weiter, was neuere cryptography-Versionen ablehnen.
v.private_key = ec.generate_private_key(ec.SECP256R1())
v.save_key(str(path))
raw = v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print("VAPID_PUBLIC_KEY=" + base64.urlsafe_b64encode(raw).decode().rstrip("="))
