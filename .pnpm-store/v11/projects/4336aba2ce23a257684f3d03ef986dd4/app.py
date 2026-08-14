# services/vectoplan-editor/app.py
"""
Flask-App-Factory für den Service `vectoplan-editor`.

Diese Datei ist bewusst robust aufgebaut, obwohl die erste Produktstufe noch
klein ist. Ziel ist ein stabiler Startpunkt, der die aktuelle Editor-Runtime,
den Chunk-Proxy, die Library-/Inventory-Schicht und die iframe-Einbettung in
`vectoplan-app` sauber zusammenführt.

Verantwortung dieser Datei:
- .env-Datei defensiv und gecacht laden
- passende Konfigurationsklasse auflösen
- Flask-App mit korrekten Template-/Static-Pfaden erzeugen
- Konfiguration anwenden
- optionale Konfigurationsvalidierung ausführen
- Blueprints registrieren
- globale Security-Header setzen, ohne /editor?embed=1 zu blockieren
- optionale Startup-Hooks ausführen
- kleine Service-Metadaten am App-Objekt hinterlegen

Wichtig:
- Keine Business-Logik in dieser Datei
- Keine fachliche Editorlogik in dieser Datei
- Keine harte Abhängigkeit auf noch nicht vollständig implementierte Module
  über starre Top-Level-Imports
- /editor?embed=1 muss in http://localhost:5103 geframed werden können
- /editor ohne embed bleibt gegen fremdes Framing geschützt
"""

from __future__ import annotations

import importlib
import json
import logging
import os
import re
import sys
from functools import lru_cache
from pathlib import Path
from types import ModuleType
from typing import Any
from urllib.parse import urlsplit

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request

from config import BaseConfig, Config, get_config_class


# -----------------------------------------------------------------------------
# Interne Konstanten
# -----------------------------------------------------------------------------

_TRUE_VALUES = {"1", "true", "t", "yes", "y", "on", "enabled", "ja"}
_FALSE_VALUES = {"0", "false", "f", "no", "n", "off", "disabled", "nein"}

_SPLIT_RE = re.compile(r"[\s,;]+")

_DEFAULT_STARTUP_MODULE_CANDIDATES = (
    "src.bootstrap.startup",
    "bootstrap.startup",
)

_ROUTE_MODULE_NAME = "routes"

_DEFAULT_APP_PUBLIC_URL = "http://localhost:5103"
_DEFAULT_EDITOR_FRAME_ANCESTORS = (
    "http://localhost:5103",
    "http://127.0.0.1:5103",
    "http://localhost:5101",
    "http://127.0.0.1:5101",
)

_EDITOR_EMBED_QUERY_FALLBACKS = (
    "embed",
    "allow_embed",
    "iframe",
)


# -----------------------------------------------------------------------------
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

def _normalize_text(value: Any, default: str | None = None) -> str | None:
    """
    Normalisiert Texteingaben defensiv.

    Verhalten:
    - None -> Default
    - String -> trim
    - sonst -> str(value).strip()
    - leerer String -> Default
    """
    if value is None:
        return default

    if isinstance(value, str):
        normalized = value.strip()
        return normalized or default

    try:
        normalized = str(value).strip()
        return normalized or default
    except Exception:
        return default


def _as_bool(value: Any, default: bool = False) -> bool:
    """
    Konvertiert unterschiedliche Bool-Darstellungen defensiv.
    """
    if isinstance(value, bool):
        return bool(value)

    if isinstance(value, int) and not isinstance(value, bool):
        return value != 0

    normalized = _normalize_text(value)
    if normalized is None:
        return default

    lowered = normalized.lower()

    if lowered in _TRUE_VALUES:
        return True

    if lowered in _FALSE_VALUES:
        return False

    return default


def _env_flag(name: str, default: bool = False) -> bool:
    """
    Liest eine Bool-Umgebungsvariable defensiv aus.

    Ungültige oder fehlende Werte fallen auf den Default zurück.
    """
    try:
        raw_value = os.getenv(name)
    except Exception:
        return default

    return _as_bool(raw_value, default)


def _safe_log_debug(app: Flask, message: str, *args: Any) -> None:
    try:
        app.logger.debug(message, *args)
    except Exception:
        pass


def _safe_log_info(app: Flask, message: str, *args: Any) -> None:
    try:
        app.logger.info(message, *args)
    except Exception:
        pass


def _safe_log_warning(app: Flask, message: str, *args: Any) -> None:
    try:
        app.logger.warning(message, *args)
    except Exception:
        pass


def _safe_log_exception(app: Flask, message: str, *args: Any) -> None:
    try:
        app.logger.exception(message, *args)
    except Exception:
        pass


def _json_safe(value: Any, *, depth: int = 0) -> Any:
    """
    Best-effort JSON-safe Normalisierung für Diagnose-Payloads.
    """
    if depth > 8:
        return None

    try:
        if value is None or isinstance(value, (str, int, float, bool)):
            return value

        if isinstance(value, dict):
            return {str(key): _json_safe(item, depth=depth + 1) for key, item in value.items()}

        if isinstance(value, (list, tuple, set)):
            return [_json_safe(item, depth=depth + 1) for item in value]

        if isinstance(value, Path):
            return str(value)

        return str(value)

    except Exception:
        return None


# -----------------------------------------------------------------------------
# Pfad- und Import-Helfer
# -----------------------------------------------------------------------------

def _resolve_service_root() -> Path:
    """
    Liefert robust das Root-Verzeichnis des Services.

    Normalfall:
    app.py liegt direkt im Service-Root.

    Fallback:
    aktuelles Arbeitsverzeichnis.
    """
    try:
        return Path(__file__).resolve().parent
    except Exception:
        return Path(".").resolve()


SERVICE_ROOT = _resolve_service_root()
SRC_ROOT = SERVICE_ROOT / "src"


@lru_cache(maxsize=1)
def _ensure_service_root_on_sys_path() -> bool:
    """
    Stellt sicher, dass das Service-Root im Python-Pfad vorhanden ist.

    Warum das hilfreich ist:
    - stabile Importe von `routes`
    - stabile Importe von `src.bootstrap.startup`
    - robusteres Verhalten in lokalen Starts, Tests und WSGI-Kontexten
    """
    try:
        service_root_str = str(SERVICE_ROOT)
    except Exception:
        return False

    if not service_root_str:
        return False

    try:
        if service_root_str not in sys.path:
            sys.path.insert(0, service_root_str)
        return True
    except Exception:
        return False


def _safe_path_from_config(value: Any, fallback_name: str) -> str:
    """
    Wandelt einen konfigurierten Pfad robust in einen String um.

    Bei ungültigen oder fehlenden Werten wird auf einen sinnvollen Default
    relativ zum Service-Root zurückgefallen.
    """
    try:
        if isinstance(value, Path):
            return str(value)

        if isinstance(value, str) and value.strip():
            return value.strip()
    except Exception:
        pass

    try:
        return str(SERVICE_ROOT / fallback_name)
    except Exception:
        return fallback_name


@lru_cache(maxsize=1)
def _load_environment_file() -> bool:
    """
    Lädt eine .env-Datei defensiv und nur einmal pro Prozess.

    Warum Cache?
    - create_app() kann in Tests mehrfach aufgerufen werden
    - .env muss nicht bei jeder App-Erzeugung erneut gelesen werden
    - reduziert unnötige Wiederholung und macht den Bootstrap stabiler

    Suchreihenfolge:
    1. .env im Service-Root
    2. .env im aktuellen Arbeitsverzeichnis
    3. generischer load_dotenv-Fallback

    Rückgabe:
    - True, wenn irgendein Ladevorgang durchgeführt werden konnte
    - False, wenn kein Ladevorgang erfolgreich war
    """
    _ensure_service_root_on_sys_path()

    candidate_paths: list[Path] = []

    try:
        candidate_paths.append(SERVICE_ROOT / ".env")
    except Exception:
        pass

    try:
        candidate_paths.append(Path.cwd() / ".env")
    except Exception:
        pass

    for candidate in candidate_paths:
        try:
            if candidate.is_file():
                load_dotenv(dotenv_path=candidate, override=False)
                return True
        except Exception:
            continue

    try:
        load_dotenv(override=False)
        return True
    except Exception:
        return False


@lru_cache(maxsize=32)
def _import_module(module_name: str) -> ModuleType:
    """
    Importiert ein Modul gecacht.

    Hinweis:
    - Exceptions werden nicht gecacht
    - erfolgreiche Modulimporte werden pro Prozess wiederverwendet
    """
    return importlib.import_module(module_name)


@lru_cache(maxsize=16)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    """
    Liefert alle zulässigen `ModuleNotFoundError.name`-Werte für einen Modulpfad.

    Beispiel:
    `src.bootstrap.startup` -> (`src`, `src.bootstrap`, `src.bootstrap.startup`)
    """
    parts = module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_candidate_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    """
    Prüft, ob ein ModuleNotFoundError wirklich bedeutet, dass das gewünschte
    Zielmodul selbst fehlt und nicht eine tieferliegende Abhängigkeit.
    """
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=1)
def _get_startup_module_candidates() -> tuple[str, ...]:
    """
    Liefert die zu prüfenden Startup-Module in Prioritätsreihenfolge.

    Priorität:
    1. optionaler ENV-Override `VECTOPLAN_EDITOR_STARTUP_MODULE`
    2. `src.bootstrap.startup`
    3. `bootstrap.startup` als Fallback
    """
    candidates: list[str] = []

    env_candidate = _normalize_text(os.getenv("VECTOPLAN_EDITOR_STARTUP_MODULE"))
    if env_candidate:
        candidates.append(env_candidate)

    for default_candidate in _DEFAULT_STARTUP_MODULE_CANDIDATES:
        if default_candidate not in candidates:
            candidates.append(default_candidate)

    return tuple(candidates)


# -----------------------------------------------------------------------------
# Konfigurationsauflösung und Validierung
# -----------------------------------------------------------------------------

def _resolve_config_class(config_object: type[BaseConfig] | str | None) -> type[BaseConfig]:
    """
    Löst robust die zu verwendende Konfigurationsklasse auf.

    Unterstützte Eingaben:
    - None: Default-Auflösung über get_config_class()
    - str: Name einer Konfiguration wie "development", "testing", "production"
    - Klassenobjekt: direkte Nutzung

    Fallback:
    - Config
    """
    if config_object is None:
        try:
            return get_config_class()
        except Exception:
            return Config

    if isinstance(config_object, str):
        try:
            return get_config_class(config_object)
        except Exception:
            return Config

    if isinstance(config_object, type):
        return config_object

    return Config


def _validate_config(config_class: type[BaseConfig], logger: logging.Logger) -> None:
    """
    Führt optionale Konfigurationsvalidierung aus.

    Verhalten:
    - wenn `validate()` existiert, werden Fehlermeldungen gesammelt
    - standardmäßig werden Fehler geloggt, aber die App startet weiter
    - mit ENV `VECTOPLAN_EDITOR_FAIL_FAST_CONFIG=true` wird hart abgebrochen
    """
    validator = getattr(config_class, "validate", None)
    if not callable(validator):
        return

    try:
        errors = validator()
    except Exception as exc:
        errors = [f"Konfigurationsvalidierung ist mit einem Fehler abgebrochen: {exc!r}"]

    if not errors:
        return

    message = " | ".join(str(error) for error in errors if error)

    if _env_flag("VECTOPLAN_EDITOR_FAIL_FAST_CONFIG", default=False):
        raise RuntimeError(f"Ungültige Konfiguration für vectoplan-editor: {message}")

    try:
        logger.warning("Konfigurationswarnung für vectoplan-editor: %s", message)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Security-Header-Helfer
# -----------------------------------------------------------------------------

def _split_source_list(value: Any, default: tuple[str, ...]) -> tuple[str, ...]:
    """
    Robuster Source-/Origin-Parser.

    Unterstützt:
    - Liste/Tuple/Set
    - JSON-Array
    - Komma/Semikolon/Whitespace-getrennte Strings
    """
    try:
        if isinstance(value, (list, tuple, set)):
            result: list[str] = []
            for item in value:
                text = _normalize_text(item)
                if text and text not in result:
                    result.append(text)
            return tuple(result) or default

        text = _normalize_text(value)
        if not text:
            return default

        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                result = []
                for item in parsed:
                    item_text = _normalize_text(item)
                    if item_text and item_text not in result:
                        result.append(item_text)
                return tuple(result) or default
        except Exception:
            pass

        result = []
        for part in _SPLIT_RE.split(text):
            part_text = _normalize_text(part)
            if part_text and part_text not in result:
                result.append(part_text)

        return tuple(result) or default

    except Exception:
        return default


def _normalize_origin(value: Any, default: str | None = None) -> str:
    """
    Normalisiert eine Origin für CSP.

    - self/'self' wird zu 'self'
    - '*' wird verworfen
    - http(s)-URLs werden auf scheme://host[:port] reduziert
    """
    raw = _normalize_text(value)

    if raw is None:
        return default or ""

    try:
        if raw in {"self", "'self'"}:
            return "'self'"

        if raw == "*":
            return ""

        if not (raw.startswith("http://") or raw.startswith("https://")):
            return default or ""

        parsed = urlsplit(raw)

        if not parsed.scheme or not parsed.netloc:
            return default or ""

        return f"{parsed.scheme}://{parsed.netloc}"

    except Exception:
        return default or ""


def _normalize_origin_tuple(values: tuple[str, ...], default: tuple[str, ...]) -> tuple[str, ...]:
    try:
        result: list[str] = []

        for value in values:
            origin = _normalize_origin(value)
            if not origin:
                continue
            if origin not in result:
                result.append(origin)

        return tuple(result) or default

    except Exception:
        return default


def _csp_join(values: tuple[str, ...], *, include_self: bool = False) -> str:
    try:
        result: list[str] = []

        if include_self:
            result.append("'self'")

        for value in values:
            source = _normalize_origin(value)
            if not source:
                continue
            if source not in result:
                result.append(source)

        return " ".join(result)

    except Exception:
        return "'self'" if include_self else ""


def _config_value(app: Flask, key: str, default: Any = None) -> Any:
    try:
        value = app.config.get(key)
        return value if value not in {None, ""} else default
    except Exception:
        return default


def _config_first(app: Flask, default: Any, *keys: str) -> Any:
    for key in keys:
        value = _config_value(app, key, None)
        if value not in {None, ""}:
            return value
    return default


def _is_editor_page_request() -> bool:
    try:
        path = str(request.path or "").rstrip("/")
        return path in {
            "/editor",
            "/editor/test-generator",
            "/editor/generator-preview",
        }
    except Exception:
        return False


def _embed_query_param_name(app: Flask) -> str:
    return _normalize_text(
        _config_first(
            app,
            "embed",
            "VECTOPLAN_EDITOR_EMBED_QUERY_PARAM",
            "EDITOR_EMBED_QUERY_PARAM",
        ),
        "embed",
    ) or "embed"


def _embed_true_values(app: Flask) -> set[str]:
    raw = _config_first(
        app,
        ("1", "true", "yes", "on"),
        "VECTOPLAN_EDITOR_EMBED_QUERY_TRUE_VALUES",
        "EDITOR_EMBED_QUERY_TRUE_VALUES",
    )

    values = _split_source_list(raw, ("1", "true", "yes", "on"))
    result = {str(value).strip().lower() for value in values if str(value).strip()}
    return result or {"1", "true", "yes", "on"}


def _editor_embed_enabled(app: Flask) -> bool:
    return _as_bool(
        _config_first(
            app,
            True,
            "VECTOPLAN_EDITOR_EMBED_ENABLED",
            "EDITOR_EMBED_ENABLED",
        ),
        True,
    )


def _is_embed_request(app: Flask) -> bool:
    """
    Erkennt /editor iframe-Anfragen.

    Unterstützt:
    - ?embed=1
    - ?embed=true
    - ?allow_embed=1
    - ?iframe=1
    """
    try:
        if not _editor_embed_enabled(app):
            return False

        true_values = _embed_true_values(app)
        primary_param = _embed_query_param_name(app)

        query_param_names: list[str] = [primary_param]
        for fallback_name in _EDITOR_EMBED_QUERY_FALLBACKS:
            if fallback_name not in query_param_names:
                query_param_names.append(fallback_name)

        for name in query_param_names:
            value = request.args.get(name)
            if value is None:
                continue

            text = str(value).strip().lower()
            if text in true_values:
                return True

            if _as_bool(text, False):
                return True

        return False

    except Exception:
        return False


def _allowed_frame_ancestors(app: Flask) -> tuple[str, ...]:
    raw = _config_first(
        app,
        _DEFAULT_EDITOR_FRAME_ANCESTORS,
        "VECTOPLAN_EDITOR_FRAME_ANCESTORS",
        "VECTOPLAN_EDITOR_ALLOWED_FRAME_PARENTS",
        "VECTOPLAN_ALLOWED_FRAME_PARENTS",
        "FRAME_ANCESTORS",
    )

    parsed = _split_source_list(raw, _DEFAULT_EDITOR_FRAME_ANCESTORS)
    ancestors = _normalize_origin_tuple(parsed, _DEFAULT_EDITOR_FRAME_ANCESTORS)

    app_public_url = _config_first(
        app,
        _DEFAULT_APP_PUBLIC_URL,
        "VECTOPLAN_APP_PUBLIC_URL",
        "VECTOPLAN_APP_PUBLIC_BASE_URL",
        "APP_PUBLIC_URL",
    )
    app_origin = _normalize_origin(app_public_url)

    result: list[str] = []

    for value in (app_origin, *ancestors):
        if not value:
            continue
        if value not in result:
            result.append(value)

    return tuple(result) or _DEFAULT_EDITOR_FRAME_ANCESTORS


def _frame_ancestors_csp(app: Flask) -> str:
    explicit = _normalize_text(
        _config_first(
            app,
            "",
            "VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP",
            "EDITOR_FRAME_ANCESTORS_CSP",
        )
    )

    if explicit and "*" not in explicit:
        return explicit

    return _csp_join(_allowed_frame_ancestors(app), include_self=True)


def _x_frame_options_default(app: Flask) -> str:
    value = _normalize_text(
        _config_first(
            app,
            "SAMEORIGIN",
            "VECTOPLAN_EDITOR_X_FRAME_OPTIONS_DEFAULT",
            "EDITOR_X_FRAME_OPTIONS_DEFAULT",
        ),
        "SAMEORIGIN",
    ) or "SAMEORIGIN"

    normalized = value.upper()
    if normalized in {"DENY", "SAMEORIGIN"}:
        return normalized

    return "SAMEORIGIN"


def _merge_or_set_frame_ancestors(existing_csp: str, frame_ancestors: str) -> str:
    """
    Ersetzt vorhandene frame-ancestors-Direktive oder fügt sie hinzu.
    """
    try:
        directives = []
        replaced = False

        for raw_directive in str(existing_csp or "").split(";"):
            directive = raw_directive.strip()
            if not directive:
                continue

            if directive.lower().startswith("frame-ancestors "):
                directives.append(f"frame-ancestors {frame_ancestors}")
                replaced = True
            else:
                directives.append(directive)

        if not replaced:
            directives.append(f"frame-ancestors {frame_ancestors}")

        return "; ".join(directives)

    except Exception:
        return f"frame-ancestors {frame_ancestors}"


def _apply_global_security_headers(app: Flask, response: Response) -> Response:
    """
    Zentrale Security-Header-Policy.

    Kritisches Verhalten:
    - /editor ohne embed: X-Frame-Options:SAMEORIGIN
    - /editor?embed=1: X-Frame-Options wird entfernt und frame-ancestors
      erlaubt die App-Origin http://localhost:5103
    - API-/Static-Antworten bekommen nur defensive Basisheader
    """
    try:
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
    except Exception:
        return response

    try:
        if not _is_editor_page_request():
            return response

        embed = _is_embed_request(app)
        frame_ancestors = _frame_ancestors_csp(app)

        existing_csp = response.headers.get("Content-Security-Policy", "")
        if existing_csp:
            response.headers["Content-Security-Policy"] = _merge_or_set_frame_ancestors(
                existing_csp,
                frame_ancestors if embed else "'self'",
            )
        else:
            response.headers["Content-Security-Policy"] = (
                f"frame-ancestors {frame_ancestors if embed else "'self'"}"
            )

        if embed:
            if _as_bool(
                _config_first(
                    app,
                    True,
                    "VECTOPLAN_EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED",
                    "EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED",
                ),
                True,
            ):
                try:
                    response.headers.pop("X-Frame-Options", None)
                except Exception:
                    pass
            else:
                response.headers["X-Frame-Options"] = _x_frame_options_default(app)
        else:
            response.headers["X-Frame-Options"] = _x_frame_options_default(app)

        response.headers["X-VECTOPLAN-Editor-Embed"] = "true" if embed else "false"
        response.headers["X-VECTOPLAN-Editor-Frame-Ancestors"] = frame_ancestors

    except Exception:
        pass

    return response


def _install_security_headers(app: Flask) -> None:
    """
    Registriert globale Security-Header.

    Wichtig:
    Diese Funktion darf /editor?embed=1 nicht nachträglich durch
    X-Frame-Options:SAMEORIGIN blockieren.
    """
    try:
        if app.extensions.get("vectoplan_editor", {}).get("security_headers_installed"):
            return
    except Exception:
        pass

    @app.after_request
    def _vectoplan_editor_after_request(response: Response) -> Response:
        return _apply_global_security_headers(app, response)

    try:
        app.extensions.setdefault("vectoplan_editor", {})
        app.extensions["vectoplan_editor"]["security_headers_installed"] = True
        app.extensions["vectoplan_editor"]["frame_ancestors"] = list(_allowed_frame_ancestors(app))
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Flask-Erzeugung und Basiskonfiguration
# -----------------------------------------------------------------------------

def _create_flask_app(config_class: type[BaseConfig]) -> Flask:
    """
    Erzeugt die Flask-Anwendung mit robust aufgelösten Pfaden.

    Template- und Static-Verzeichnisse werden explizit gesetzt, damit die
    Verzeichnisstruktur klar und stabil bleibt.
    """
    template_folder = _safe_path_from_config(
        getattr(config_class, "TEMPLATES_ROOT", None),
        "templates",
    )
    static_folder = _safe_path_from_config(
        getattr(config_class, "STATIC_ROOT", None),
        "static",
    )

    try:
        app = Flask(
            __name__,
            template_folder=template_folder,
            static_folder=static_folder,
            static_url_path="/static",
        )
    except Exception as exc:
        raise RuntimeError(
            "Flask-App konnte nicht erstellt werden. "
            f"template_folder={template_folder!r}, static_folder={static_folder!r}"
        ) from exc

    return app


def _apply_config(app: Flask, config_class: type[BaseConfig]) -> None:
    """
    Wendet die Konfiguration auf die Flask-App an.

    Zusätzliche Metadaten werden in app.extensions hinterlegt, damit spätere
    Komponenten kontrolliert auf Service-Infos zugreifen können.
    """
    try:
        app.config.from_object(config_class)
    except Exception as exc:
        raise RuntimeError(
            f"Konfigurationsklasse {config_class.__name__} konnte nicht geladen werden."
        ) from exc

    app.extensions.setdefault("vectoplan_editor", {})
    metadata = app.extensions["vectoplan_editor"]

    metadata["service_name"] = app.config.get("APP_NAME", "vectoplan-editor")
    metadata["service_display_name"] = app.config.get("APP_DISPLAY_NAME", "VECTOPLAN Editor")
    metadata["config_class_name"] = config_class.__name__
    metadata["service_root"] = str(SERVICE_ROOT)
    metadata["src_root"] = str(SRC_ROOT)
    metadata["service_root_on_sys_path"] = _ensure_service_root_on_sys_path()
    metadata["dotenv_loaded"] = _load_environment_file()
    metadata["startup_completed"] = False
    metadata["startup_attempted"] = False
    metadata["startup_module_name"] = None
    metadata["startup_hook_name"] = None
    metadata["startup_skipped"] = False
    metadata["blueprints_registered"] = False
    metadata["security_headers_installed"] = False


def _configure_app_defaults(app: Flask) -> None:
    """
    Setzt kleine, sinnvolle App-Defaults.

    Diese Einstellungen sind bewusst zurückhaltend und zielen auf sauberes
    Verhalten im lokalen Minimalbetrieb.
    """
    try:
        app.json.sort_keys = False
    except Exception:
        pass

    try:
        app.url_map.strict_slashes = False
    except Exception:
        pass


def _configure_logger(app: Flask) -> None:
    """
    Stellt sicher, dass die App einen brauchbaren Logger-Zustand hat.

    Flask bringt bereits Logging mit. Diese Funktion sorgt nur dafür, dass
    das Level zur aktuellen Umgebung passt und keine harte Exception entsteht.
    """
    try:
        if app.debug:
            app.logger.setLevel(logging.DEBUG)
        else:
            app.logger.setLevel(logging.INFO)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Built-in Health Routes
# -----------------------------------------------------------------------------

def _route_exists(app: Flask, rule: str) -> bool:
    try:
        return any(str(item.rule) == rule for item in app.url_map.iter_rules())
    except Exception:
        return False


def _register_builtin_health_routes(app: Flask) -> None:
    """
    Registriert minimale Health-Routen, falls keine entsprechenden Routen
    vorhanden sind.

    Diese Routen sind absichtlich klein und enthalten keine Fachlogik.
    """
    def _health_payload(kind: str) -> dict[str, Any]:
        try:
            metadata = app.extensions.get("vectoplan_editor", {})
        except Exception:
            metadata = {}

        return {
            "ok": True,
            "service": app.config.get("APP_NAME", "vectoplan-editor"),
            "kind": kind,
            "config": metadata.get("config_class_name"),
            "blueprints_registered": bool(metadata.get("blueprints_registered")),
            "startup_attempted": bool(metadata.get("startup_attempted")),
            "startup_completed": bool(metadata.get("startup_completed")),
            "startup_skipped": bool(metadata.get("startup_skipped")),
            "security_headers_installed": bool(metadata.get("security_headers_installed")),
        }

    if not _route_exists(app, "/health"):
        @app.get("/health")
        def _vectoplan_editor_health() -> Response:
            return jsonify(_health_payload("health"))

    if not _route_exists(app, "/health/live"):
        @app.get("/health/live")
        def _vectoplan_editor_health_live() -> Response:
            return jsonify(_health_payload("live"))

    if not _route_exists(app, "/health/ready"):
        @app.get("/health/ready")
        def _vectoplan_editor_health_ready() -> Response:
            return jsonify(_health_payload("ready"))

    if not _route_exists(app, "/ready"):
        @app.get("/ready")
        def _vectoplan_editor_ready() -> Response:
            return jsonify(_health_payload("ready"))


# -----------------------------------------------------------------------------
# Blueprint-Registrierung
# -----------------------------------------------------------------------------

def _register_blueprints(app: Flask) -> None:
    """
    Importiert die Routen defensiv und registriert sie.

    Wichtig:
    - kein Top-Level-Import von `routes`, damit app.py bereits existieren kann,
      bevor alle Dateien vollständig umgesetzt sind
    - klarer Fehlertext, falls `register_blueprints()` fehlt
    """
    _ensure_service_root_on_sys_path()

    try:
        routes_module = _import_module(_ROUTE_MODULE_NAME)
    except Exception as exc:
        raise RuntimeError(
            "Das Modul `routes` konnte nicht importiert werden. "
            "Prüfe, ob `services/vectoplan-editor/routes/__init__.py` existiert."
        ) from exc

    register_function = getattr(routes_module, "register_blueprints", None)
    if not callable(register_function):
        raise RuntimeError(
            "Im Modul `routes` fehlt eine aufrufbare Funktion `register_blueprints(app)`."
        )

    try:
        register_function(app)
    except Exception as exc:
        raise RuntimeError("Die Blueprint-Registrierung ist fehlgeschlagen.") from exc

    try:
        app.extensions["vectoplan_editor"]["blueprints_registered"] = True
    except Exception:
        pass

# -----------------------------------------------------------------------------
# Realtime-Transport
# -----------------------------------------------------------------------------

def _register_realtime_socket(app: Flask) -> None:
    """Register the WebSocket transport after the HTTP blueprints."""
    try:
        from routes.realtime import init_realtime_socket

        init_realtime_socket(app)
    except Exception as exc:
        raise RuntimeError(
            "Der Editor-Realtime-WebSocket konnte nicht registriert werden."
        ) from exc


# -----------------------------------------------------------------------------
# Optionale Startup-Hooks
# -----------------------------------------------------------------------------

def _resolve_startup_module(app: Flask) -> tuple[ModuleType | None, str | None]:
    """
    Löst das bevorzugte Startup-Modul robust auf.

    Reihenfolge:
    1. optionaler ENV-Override
    2. `src.bootstrap.startup`
    3. `bootstrap.startup`

    Verhalten:
    - fehlt ein Kandidat selbst, wird der nächste probiert
    - schlägt ein Kandidat wegen einer tieferen Importabhängigkeit fehl, wird
      hart abgebrochen, da das ein echter Fehler ist
    """
    _ensure_service_root_on_sys_path()

    candidates = _get_startup_module_candidates()

    try:
        app.extensions.setdefault("vectoplan_editor", {})
        app.extensions["vectoplan_editor"]["startup_module_candidates"] = list(candidates)
    except Exception:
        pass

    for module_name in candidates:
        try:
            module = _import_module(module_name)
            return module, module_name
        except ModuleNotFoundError as exc:
            if _is_missing_candidate_module(exc, module_name):
                _safe_log_debug(
                    app,
                    "Startup-Modul `%s` nicht gefunden; nächster Kandidat wird geprüft.",
                    module_name,
                )
                continue

            raise RuntimeError(
                f"Das Startup-Modul `{module_name}` konnte nicht geladen werden, "
                f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
            ) from exc
        except Exception as exc:
            raise RuntimeError(
                f"Das Startup-Modul `{module_name}` konnte nicht geladen werden."
            ) from exc

    return None, None


def _run_optional_startup_hooks(app: Flask) -> None:
    """
    Führt optional vorhandene Startup-Hooks aus.

    Unterstützte Funktionsnamen:
    - run_startup(app)
    - bootstrap_app(app)
    - initialize_app(app)

    Primärer Modulpfad:
    - src.bootstrap.startup

    Fallback-Modulpfad:
    - bootstrap.startup

    Verhalten:
    - wenn kein Modul gefunden wird, wird der Schritt still übersprungen
    - wenn das Modul existiert, aber keine bekannte Funktion enthält, wird nur
      ein Debug-Hinweis geloggt
    - wenn eine Startup-Funktion fehlschlägt, wird bewusst hart abgebrochen,
      damit inkonsistente Zustände vermieden werden
    """
    metadata = app.extensions.setdefault("vectoplan_editor", {})
    metadata["startup_attempted"] = True

    startup_module, module_name = _resolve_startup_module(app)

    if startup_module is None or module_name is None:
        metadata["startup_skipped"] = True
        _safe_log_debug(
            app,
            "Kein Startup-Modul gefunden; geprüfte Kandidaten: %s",
            ", ".join(_get_startup_module_candidates()),
        )
        return

    metadata["startup_module_name"] = module_name

    startup_function = None
    startup_function_name = None

    for function_name in ("run_startup", "bootstrap_app", "initialize_app"):
        candidate = getattr(startup_module, function_name, None)
        if callable(candidate):
            startup_function = candidate
            startup_function_name = function_name
            break

    if startup_function is None:
        metadata["startup_skipped"] = True
        _safe_log_debug(
            app,
            "Startup-Modul `%s` gefunden, aber keine bekannte Startup-Funktion definiert.",
            module_name,
        )
        return

    metadata["startup_hook_name"] = startup_function_name

    try:
        startup_function(app)
    except Exception as exc:
        raise RuntimeError(
            f"Startup-Hooks des Editors sind fehlgeschlagen (module={module_name}, hook={startup_function_name})."
        ) from exc

    try:
        metadata["startup_completed"] = True
        metadata["startup_skipped"] = False
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Öffentliche App-Factory
# -----------------------------------------------------------------------------

def create_app(config_object: type[BaseConfig] | str | None = None) -> Flask:
    """
    Öffentliche Flask-App-Factory.

    Beispiel:
        app = create_app()
        app = create_app("testing")
        app = create_app(TestingConfig)

    Ablauf:
    1. Service-Root in sys.path sicherstellen
    2. .env laden
    3. Konfigurationsklasse auflösen
    4. Flask-App erzeugen
    5. Konfiguration anwenden
    6. Logger/App-Defaults setzen
    7. Konfiguration validieren
    8. globale Security-Header installieren
    9. Blueprints registrieren
    10. Built-in Health-Routen ergänzen
    11. optionale Startup-Hooks ausführen

    Rückgabe:
    - vollständig erzeugte Flask-App
    """
    _ensure_service_root_on_sys_path()
    _load_environment_file()

    config_class = _resolve_config_class(config_object)
    app = _create_flask_app(config_class)

    _apply_config(app, config_class)
    _configure_app_defaults(app)
    _configure_logger(app)

    _validate_config(config_class, app.logger)

    _install_security_headers(app)
    _register_blueprints(app)
    _register_realtime_socket(app)
    _register_builtin_health_routes(app)

    with app.app_context():
        _run_optional_startup_hooks(app)

    _safe_log_info(
        app,
        "Flask-App `%s` wurde erfolgreich initialisiert (config=%s, startup_module=%s, frame_ancestors=%s).",
        app.config.get("APP_NAME", "vectoplan-editor"),
        config_class.__name__,
        app.extensions.get("vectoplan_editor", {}).get("startup_module_name"),
        app.extensions.get("vectoplan_editor", {}).get("frame_ancestors"),
    )

    from vectoplan_i18n import init_app as init_i18n
    init_i18n(app)
    return app


__all__ = ["create_app"]
