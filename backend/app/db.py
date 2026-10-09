from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from .config import settings

engine = create_engine(
    f"sqlite:///{settings.data_dir / 'app.db'}",
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(conn, _):
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def init_db() -> None:
    from . import models  # noqa: F401

    for d in (settings.data_dir, settings.media_dir, settings.originals_dir):
        d.mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


# Neue Spalten für bestehende Datenbanken nachrüsten (SQLite kann create_all nicht erweitern)
_USER_COLUMNS = {
    "reminder_enabled": "BOOLEAN NOT NULL DEFAULT 1",
    "reminder_weekday": "INTEGER NOT NULL DEFAULT 6",
    "reminder_hour": "INTEGER NOT NULL DEFAULT 19",
    "last_reminder_at": "DATETIME",
}


def _add_missing_columns() -> None:
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info('user')")}
        for name, ddl in _USER_COLUMNS.items():
            if name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE user ADD COLUMN {name} {ddl}")


def get_db():
    with Session(engine) as db:
        yield db
