# config.py  – liegt direkt im Projekt-Root (neben app/, docker-compose.yml etc.)
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


# ────────────────────────────────────────────────────────────────
# Helper: baue eine sinnvolle Default-URI für Postgres-Container
# ────────────────────────────────────────────────────────────────
def _default_postgres_uri() -> str:
    """
    Liefert eine URI wie
      postgresql://postgres:postgres@db:5432/postgres
    wobei die Einzelteile aus ENV überschrieben werden können.
    """
    host     = os.getenv("POSTGRES_HOST",     "db")          # Service-Name aus docker-compose
    user     = os.getenv("POSTGRES_USER",     "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    dbname   = os.getenv("POSTGRES_DB",       "postgres")
    return f"postgresql://{user}:{password}@{host}:5432/{dbname}"


# ────────────────────────────────────────────────────────────────
# Basis-Konfiguration (wird von Dev/Prod erbt)
# ────────────────────────────────────────────────────────────────
class Config:
    # ───────────── Flask ─────────────
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-change-me")

    # ────────── SQLAlchemy ───────────
    #
    #  1. Erst schauen wir, ob eine voll­ständige DATABASE_URL in der
    #     Umgebung gesetzt ist  (z. B. Heroku, Railway, Render …).
    #  2. Falls nicht, nehmen wir eine Postgres-URI für den
    #     Docker-Container („db“ heißt der Service in compose).
    #  3. Als letztes Fallback noch eine lokale SQLite-Datei.
    #
    SQLALCHEMY_DATABASE_URI = (
        os.getenv("DATABASE_URL")
        or _default_postgres_uri()
        or f"sqlite:///{BASE_DIR / 'dev.db'}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = True  # Flask-WTF / CSRF-Schutz

    # ───────── Weitere Settings (Mail, Logging, Uploads …) ─────────
    # MAIL_SERVER = os.getenv("MAIL_SERVER", "localhost")
    # UPLOAD_FOLDER = BASE_DIR / "uploads"
    # LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


# ────────────────────────────────────────────────────────────────
# Entwicklungs- und Produktions-Konfigs
# ────────────────────────────────────────────────────────────────
class DevConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = True          # SQL-Statements in der Konsole


class ProdConfig(Config):
    DEBUG = False
    SQLALCHEMY_ECHO = False