# services/vectoplan-editor/wsgi.py
"""
WSGI-Einstiegspunkt für den Service `vectoplan-editor`.

Diese Datei hat eine sehr klare Verantwortung:
- die Flask-App für WSGI-Server wie Gunicorn bereitstellen
- eine stabile, wiederverwendbare `app`-Referenz exportieren
- optional einen lokalen Direktstart für Entwicklungszwecke ermöglichen

Warum diese Datei separat existiert:
- `app.py` bleibt die eigentliche App-Factory
- `wsgi.py` ist die standardisierte Eintrittsstelle für den Serverbetrieb
- neue Entwickler erkennen sofort, wie der Service gestartet wird

Robustheitsziele:
- defensive Verarbeitung optionaler Umgebungsvariablen
- klarer Fehlerkontext, falls die App-Erzeugung fehlschlägt
- gecachte App-Erzeugung innerhalb des Prozesses
- sowohl `app` als auch `application` exportieren
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Final

from app import create_app


# -----------------------------------------------------------------------------
# Hilfskonstanten
# -----------------------------------------------------------------------------

_TRUE_VALUES: Final[set[str]] = {"1", "true", "t", "yes", "y", "on"}


# -----------------------------------------------------------------------------
# Defensive Hilfsfunktionen für Umgebungsvariablen
# -----------------------------------------------------------------------------

def _safe_getenv(name: str, default: str | None = None) -> str | None:
    """
    Liest eine Umgebungsvariable defensiv aus.

    Falls der Zugriff auf die Umgebung aus irgendeinem Grund fehlschlägt,
    wird der angegebene Default zurückgegeben.
    """
    try:
        return os.getenv(name, default)
    except Exception:
        return default


def _normalize_text(value: str | None, default: str | None = None) -> str | None:
    """
    Normalisiert Texteingaben defensiv.

    Verhalten:
    - None -> Default
    - Strip von Whitespace
    - leerer String -> Default
    """
    if value is None:
        return default

    try:
        normalized = value.strip()
    except Exception:
        return default

    return normalized or default


def _read_bool_env(name: str, default: bool = False) -> bool:
    """
    Liest eine Bool-Umgebungsvariable robust aus.
    """
    raw_value = _normalize_text(_safe_getenv(name))
    if raw_value is None:
        return default

    try:
        return raw_value.lower() in _TRUE_VALUES
    except Exception:
        return default


def _read_int_env(
    name: str,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    """
    Liest eine Integer-Umgebungsvariable robust aus und begrenzt sie optional.
    """
    raw_value = _normalize_text(_safe_getenv(name))
    if raw_value is None:
        value = default
    else:
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


# -----------------------------------------------------------------------------
# Konfigurationsauflösung
# -----------------------------------------------------------------------------

def _resolve_config_name() -> str | None:
    """
    Ermittelt den gewünschten Konfigurationsnamen für die App-Factory.

    Priorität:
    1. VECTOPLAN_EDITOR_CONFIG
    2. None -> create_app() verwendet eigenen Default

    Beispiele:
    - development
    - testing
    - production
    """
    return _normalize_text(_safe_getenv("VECTOPLAN_EDITOR_CONFIG"), default=None)


# -----------------------------------------------------------------------------
# Gecachte App-Erzeugung
# -----------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _build_wsgi_app():
    """
    Erzeugt die Flask-App genau einmal pro Prozess.

    Warum Cache?
    - vermeidet unnötige Mehrfachinitialisierung innerhalb desselben Prozesses
    - sorgt für konsistentes Verhalten bei wiederholtem Zugriff
    - passt gut zum WSGI-Modell, bei dem die App pro Worker importiert wird

    Fehler werden mit zusätzlichem Kontext neu geworfen, damit ein fehlerhafter
    Bootstrap schnell nachvollziehbar ist.
    """
    config_name = _resolve_config_name()

    try:
        if config_name is not None:
            return create_app(config_name)

        return create_app()

    except Exception as exc:
        raise RuntimeError(
            "Die WSGI-Anwendung für `vectoplan-editor` konnte nicht erstellt werden. "
            f"Konfigurationsname: {config_name!r}"
        ) from exc


def get_wsgi_app():
    """
    Öffentlicher Zugriffspunkt für die WSGI-Anwendung.

    Diese Funktion ist nützlich, wenn andere Werkzeuge oder Tests bewusst
    über `wsgi.py` auf die bereits standardisierte App zugreifen sollen.
    """
    return _build_wsgi_app()


# -----------------------------------------------------------------------------
# WSGI-Exports
# -----------------------------------------------------------------------------

# Standardname, den viele WSGI-Server erwarten.
app = get_wsgi_app()

# Zusätzlicher Alias für maximale Kompatibilität mit manchen Deployments.
application = app


# -----------------------------------------------------------------------------
# Optionaler Direktstart für lokale Entwicklung
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    """
    Lokaler Fallback-Start.

    Dieser Block ist nicht der primäre Produktivstart, kann aber in der frühen
    Entwicklungsphase praktisch sein, wenn jemand direkt `python wsgi.py`
    ausführt.

    Für stabileren Betrieb bleibt Gunicorn weiterhin der bevorzugte Weg.
    """
    host = _normalize_text(_safe_getenv("VECTOPLAN_EDITOR_HOST"), default="127.0.0.1") or "127.0.0.1"
    port = _read_int_env("VECTOPLAN_EDITOR_PORT", default=5000, minimum=1, maximum=65535)
    debug = _read_bool_env("VECTOPLAN_EDITOR_DEBUG", default=False)

    try:
        app.run(host=host, port=port, debug=debug)
    except Exception as exc:
        raise RuntimeError(
            "Der lokale Direktstart von `vectoplan-editor` über wsgi.py ist fehlgeschlagen. "
            f"host={host!r}, port={port!r}, debug={debug!r}"
        ) from exc