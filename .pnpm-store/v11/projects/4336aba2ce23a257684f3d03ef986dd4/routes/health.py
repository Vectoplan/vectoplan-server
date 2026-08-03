# services/vectoplan-editor/routes/health.py
"""
Health- und Diagnose-Route für den Service `vectoplan-editor`.

Ziel dieser Datei:
- einen leichten, stabilen und Docker-/Compose-tauglichen Health-Endpoint
  bereitstellen
- kleine, sichere Laufzeitdiagnose für App-Initialisierung und Bootstrap-
  Zustand ausliefern
- `app.py` und `Dockerfile` von der sichtbaren Benutzerroute `/editor`
  entkoppeln
- auch bei teilweisen Initialisierungsfehlern noch eine kontrollierte Antwort
  liefern

Wichtig:
- keine Business-Logik
- keine Editor-Fachlogik
- keine Core-/Library-Integration
- nur HTTP-Adapter + Laufzeitdiagnose

Robustheitsprinzipien:
- defensive Auswertung von `current_app`, `app.config` und `app.extensions`
- optionale Lazy-Imports für `editor_bootstrap`
- JSON-Safe-Normalisierung für komplexe Objekte
- kontrollierte Fallback-Antwort bei internen Fehlern
- mehrere Alias-Routen (`/health`, `/healthz`)
"""

from __future__ import annotations

import importlib
import json
from datetime import UTC, datetime
from functools import lru_cache
from http import HTTPStatus
from pathlib import Path
from types import ModuleType
from typing import Any, Final

from flask import Blueprint, Response, current_app, has_app_context, make_response


# -----------------------------------------------------------------------------
# Blueprint-Konstanten
# -----------------------------------------------------------------------------

HEALTH_BLUEPRINT_NAME: Final[str] = "health"
HEALTH_ROUTE_PATH: Final[str] = "/health"
HEALTH_ROUTE_ALIAS_PATH: Final[str] = "/healthz"

health_bp = Blueprint(HEALTH_BLUEPRINT_NAME, __name__)


# -----------------------------------------------------------------------------
# Service-/Diagnose-Konstanten
# -----------------------------------------------------------------------------

SERVICE_NAME_FALLBACK: Final[str] = "vectoplan-editor"
SERVICE_DISPLAY_NAME_FALLBACK: Final[str] = "VECTOPLAN Editor"

DEFAULT_HEALTH_STATUS: Final[str] = "ok"
DEFAULT_HEALTH_MESSAGE: Final[str] = "Service betriebsbereit"
DEFAULT_HEALTH_ERROR_STATUS: Final[str] = "error"
DEFAULT_HEALTH_ERROR_MESSAGE: Final[str] = "Health-Status konnte nicht vollständig erzeugt werden"

_EDITOR_BOOTSTRAP_MODULE_NAME: Final[str] = "editor_bootstrap"


# -----------------------------------------------------------------------------
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

def _normalize_text(value: Any, default: str | None = None) -> str | None:
    """
    Normalisiert Texte robust.
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


def _coerce_text(value: Any, default: str) -> str:
    normalized = _normalize_text(value, default)
    return normalized if normalized is not None else default


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    if isinstance(value, (int, float)):
        try:
            return bool(value)
        except Exception:
            return default

    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "t", "yes", "y", "on"}:
            return True
        if normalized in {"0", "false", "f", "no", "n", "off"}:
            return False

    return default


def _safe_has_app_context() -> bool:
    try:
        return bool(has_app_context())
    except Exception:
        return False


def _safe_log_warning(message: str, *args: Any) -> None:
    try:
        if _safe_has_app_context():
            current_app.logger.warning(message, *args)
    except Exception:
        pass


def _safe_log_exception(message: str, *args: Any) -> None:
    try:
        if _safe_has_app_context():
            current_app.logger.exception(message, *args)
    except Exception:
        pass


def _safe_utc_timestamp() -> str:
    """
    Liefert einen ISO-8601 UTC-Zeitstempel robust.
    """
    try:
        return datetime.now(UTC).isoformat()
    except Exception:
        try:
            return datetime.utcnow().isoformat() + "Z"
        except Exception:
            return "1970-01-01T00:00:00Z"


def _safe_json_dumps(value: Any, fallback: str = "{}") -> str:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=False)
    except Exception:
        return fallback


def _safe_current_app() -> Any | None:
    try:
        if _safe_has_app_context():
            return current_app
    except Exception:
        return None

    return None


def _safe_app_config_get(key: str, default: Any = None) -> Any:
    app = _safe_current_app()
    if app is None:
        return default

    try:
        return app.config.get(key, default)
    except Exception:
        return default


def _safe_app_extensions() -> dict[str, Any]:
    app = _safe_current_app()
    if app is None:
        return {}

    try:
        extensions = getattr(app, "extensions", None)
        if isinstance(extensions, dict):
            return extensions
    except Exception:
        pass

    return {}


def _safe_vectoplan_editor_extension() -> dict[str, Any]:
    extensions = _safe_app_extensions()

    try:
        extension = extensions.get("vectoplan_editor", {})
        if isinstance(extension, dict):
            return extension
    except Exception:
        pass

    return {}


# -----------------------------------------------------------------------------
# JSON-safe Konvertierung
# -----------------------------------------------------------------------------

def _json_safe(value: Any, *, _depth: int = 0, _max_depth: int = 6) -> Any:
    """
    Wandelt typische Python-Werte robust in JSON-kompatible Strukturen um.

    Regeln:
    - primitive Werte bleiben erhalten
    - Mapping -> dict mit String-Keys
    - list/tuple/set -> list
    - Path -> String
    - unbekannte Objekte -> String-Repräsentation
    - Tiefe wird begrenzt, damit Diagnose stabil bleibt
    """
    if _depth >= _max_depth:
        return _coerce_text(value, "<max-depth-reached>")

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            normalized_key = _coerce_text(key, "")
            if not normalized_key:
                continue
            result[normalized_key] = _json_safe(
                item,
                _depth=_depth + 1,
                _max_depth=_max_depth,
            )
        return result

    if isinstance(value, (list, tuple, set, frozenset)):
        try:
            iterable = list(value)
        except Exception:
            iterable = []

        normalized_list = [
            _json_safe(item, _depth=_depth + 1, _max_depth=_max_depth)
            for item in iterable
        ]

        try:
            return sorted(normalized_list) if isinstance(value, (set, frozenset)) else normalized_list
        except Exception:
            return normalized_list

    try:
        if hasattr(value, "__dict__"):
            return _json_safe(
                vars(value),
                _depth=_depth + 1,
                _max_depth=_max_depth,
            )
    except Exception:
        pass

    return _coerce_text(value, "<unserializable>")


# -----------------------------------------------------------------------------
# Optionale editor_bootstrap-Diagnose
# -----------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _load_editor_bootstrap_module() -> ModuleType | None:
    """
    Lädt `editor_bootstrap` lazy und gecacht.

    Verhalten:
    - fehlt das Modul komplett -> None
    - fehlt eine innere Abhängigkeit -> RuntimeError
    """
    try:
        return importlib.import_module(_EDITOR_BOOTSTRAP_MODULE_NAME)
    except ModuleNotFoundError as exc:
        missing_name = _normalize_text(getattr(exc, "name", None), "")
        if missing_name == _EDITOR_BOOTSTRAP_MODULE_NAME:
            return None

        raise RuntimeError(
            "Das Paket `editor_bootstrap` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {missing_name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            "Das Paket `editor_bootstrap` konnte nicht geladen werden."
        ) from exc


@lru_cache(maxsize=1)
def _resolve_editor_bootstrap_metadata_getter() -> Any | None:
    """
    Löst optional `get_editor_bootstrap_package_metadata()` aus dem Paket auf.
    """
    module = _load_editor_bootstrap_module()
    if module is None:
        return None

    try:
        candidate = getattr(module, "get_editor_bootstrap_package_metadata", None)
    except Exception:
        candidate = None

    return candidate if callable(candidate) else None


def _build_editor_bootstrap_diagnostics() -> dict[str, Any]:
    """
    Liefert Diagnoseinfos über das Paket `editor_bootstrap`.
    """
    try:
        metadata_getter = _resolve_editor_bootstrap_metadata_getter()
    except Exception as exc:
        return {
            "available": False,
            "error": _coerce_text(exc, "editor_bootstrap konnte nicht gelesen werden"),
        }

    if metadata_getter is None:
        return {
            "available": False,
            "error": None,
        }

    try:
        metadata = metadata_getter()
        return {
            "available": True,
            "metadata": _json_safe(metadata),
        }
    except Exception as exc:
        return {
            "available": False,
            "error": _coerce_text(exc, "editor_bootstrap-Metadaten konnten nicht gelesen werden"),
        }


# -----------------------------------------------------------------------------
# Laufzeitdiagnose
# -----------------------------------------------------------------------------

def _build_service_metadata() -> dict[str, Any]:
    extension = _safe_vectoplan_editor_extension()

    return {
        "name": _coerce_text(
            extension.get("service_name"),
            _coerce_text(
                _safe_app_config_get("APP_NAME", SERVICE_NAME_FALLBACK),
                SERVICE_NAME_FALLBACK,
            ),
        ),
        "display_name": _coerce_text(
            extension.get("service_display_name"),
            _coerce_text(
                _safe_app_config_get("APP_DISPLAY_NAME", SERVICE_DISPLAY_NAME_FALLBACK),
                SERVICE_DISPLAY_NAME_FALLBACK,
            ),
        ),
        "config_class_name": _coerce_text(
            extension.get("config_class_name"),
            "<unknown>",
        ),
    }


def _build_runtime_metadata() -> dict[str, Any]:
    extension = _safe_vectoplan_editor_extension()
    app = _safe_current_app()

    template_folder = None
    static_folder = None

    try:
        if app is not None:
            template_folder = getattr(app, "template_folder", None)
    except Exception:
        template_folder = None

    try:
        if app is not None:
            static_folder = getattr(app, "static_folder", None)
    except Exception:
        static_folder = None

    return {
        "startup_attempted": _coerce_bool(extension.get("startup_attempted"), False),
        "startup_completed": _coerce_bool(extension.get("startup_completed"), False),
        "startup_skipped": _coerce_bool(extension.get("startup_skipped"), False),
        "startup_module_name": _normalize_text(extension.get("startup_module_name")),
        "startup_hook_name": _normalize_text(extension.get("startup_hook_name")),
        "blueprints_registered": _coerce_bool(extension.get("blueprints_registered"), False),
        "routing_initialized": _coerce_bool(extension.get("routing_initialized"), False),
        "service_root": _normalize_text(extension.get("service_root")),
        "src_root": _normalize_text(extension.get("src_root")),
        "dotenv_loaded": _coerce_bool(extension.get("dotenv_loaded"), False),
        "service_root_on_sys_path": _coerce_bool(extension.get("service_root_on_sys_path"), False),
        "template_folder": _json_safe(template_folder),
        "static_folder": _json_safe(static_folder),
        "debug": _coerce_bool(_safe_app_config_get("DEBUG", False), False),
        "testing": _coerce_bool(_safe_app_config_get("TESTING", False), False),
    }


def _build_routes_metadata() -> dict[str, Any]:
    extension = _safe_vectoplan_editor_extension()
    app = _safe_current_app()

    registered_blueprints: list[str] = []
    url_rules: list[str] = []

    try:
        if app is not None:
            blueprints = getattr(app, "blueprints", {})
            if isinstance(blueprints, dict):
                registered_blueprints = sorted(str(name) for name in blueprints.keys())
    except Exception:
        registered_blueprints = []

    try:
        tracked = extension.get("registered_blueprint_names")
        if isinstance(tracked, set):
            tracked_blueprints = sorted(str(name) for name in tracked)
        elif isinstance(tracked, list):
            tracked_blueprints = sorted(str(name) for name in tracked)
        else:
            tracked_blueprints = []
    except Exception:
        tracked_blueprints = []

    try:
        if app is not None:
            url_map = getattr(app, "url_map", None)
            if url_map is not None and hasattr(url_map, "iter_rules"):
                url_rules = sorted(str(rule.rule) for rule in url_map.iter_rules())
    except Exception:
        url_rules = []

    return {
        "route_module": _normalize_text(extension.get("route_module")),
        "registered_blueprints": registered_blueprints,
        "tracked_blueprints": tracked_blueprints,
        "known_rules": url_rules,
        "expected_health_routes": [HEALTH_ROUTE_PATH, HEALTH_ROUTE_ALIAS_PATH],
    }


def _build_checks_metadata() -> dict[str, Any]:
    runtime_metadata = _build_runtime_metadata()
    routes_metadata = _build_routes_metadata()

    warnings: list[str] = []

    if not runtime_metadata.get("blueprints_registered", False):
        warnings.append("Blueprints sind nicht als registriert markiert.")

    if HEALTH_ROUTE_PATH not in routes_metadata.get("known_rules", []):
        warnings.append(f"Route {HEALTH_ROUTE_PATH!r} fehlt im URL-Map.")

    return {
        "app_context": _safe_has_app_context(),
        "blueprints_registered": _coerce_bool(runtime_metadata.get("blueprints_registered"), False),
        "routing_initialized": _coerce_bool(runtime_metadata.get("routing_initialized"), False),
        "health_route_present": HEALTH_ROUTE_PATH in routes_metadata.get("known_rules", []),
        "health_alias_route_present": HEALTH_ROUTE_ALIAS_PATH in routes_metadata.get("known_rules", []),
        "warnings": warnings,
    }


def build_health_payload() -> dict[str, Any]:
    """
    Baut den JSON-Payload für die Health-Antwort.

    Diese Funktion ist bewusst separat gehalten, damit sie:
    - testbar bleibt
    - später von Readiness-/Status-Endpunkten mitgenutzt werden kann
    """
    service_metadata = _build_service_metadata()
    runtime_metadata = _build_runtime_metadata()
    routes_metadata = _build_routes_metadata()
    checks_metadata = _build_checks_metadata()
    bootstrap_diagnostics = _build_editor_bootstrap_diagnostics()

    return {
        "status": DEFAULT_HEALTH_STATUS,
        "message": DEFAULT_HEALTH_MESSAGE,
        "timestamp_utc": _safe_utc_timestamp(),
        "service": service_metadata,
        "runtime": runtime_metadata,
        "routes": routes_metadata,
        "editor_bootstrap": bootstrap_diagnostics,
        "checks": checks_metadata,
    }


# -----------------------------------------------------------------------------
# Response-Bau
# -----------------------------------------------------------------------------

def _build_json_response(
    payload: dict[str, Any],
    *,
    status_code: int = HTTPStatus.OK,
) -> Response:
    """
    Baut eine Health-JSON-Antwort mit sicheren Standard-Headern.
    """
    response = make_response(
        _safe_json_dumps(_json_safe(payload), fallback=_DEFAULT_JSON_FALLBACK),
        int(status_code),
    )

    response.headers["Content-Type"] = "application/json; charset=utf-8"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["X-VECTOPLAN-Service"] = SERVICE_NAME_FALLBACK
    response.headers["X-VECTOPLAN-Health-Route"] = HEALTH_ROUTE_PATH

    return response


def _build_health_error_response(exc: Exception) -> Response:
    """
    Baut eine kontrollierte Fehlerantwort, falls selbst der Health-Payload
    intern scheitert.
    """
    payload = {
        "status": DEFAULT_HEALTH_ERROR_STATUS,
        "message": DEFAULT_HEALTH_ERROR_MESSAGE,
        "timestamp_utc": _safe_utc_timestamp(),
        "service": {
            "name": _coerce_text(
                _safe_app_config_get("APP_NAME", SERVICE_NAME_FALLBACK),
                SERVICE_NAME_FALLBACK,
            ),
            "display_name": _coerce_text(
                _safe_app_config_get("APP_DISPLAY_NAME", SERVICE_DISPLAY_NAME_FALLBACK),
                SERVICE_DISPLAY_NAME_FALLBACK,
            ),
        },
        "error": {
            "type": _coerce_text(type(exc).__name__, "RuntimeError"),
            "message": _coerce_text(exc, DEFAULT_HEALTH_ERROR_MESSAGE),
        },
    }

    response = _build_json_response(
        payload,
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
    )
    response.headers["X-VECTOPLAN-Health-Error"] = "true"
    return response


# -----------------------------------------------------------------------------
# Öffentliche Routen
# -----------------------------------------------------------------------------

@health_bp.route(HEALTH_ROUTE_PATH, methods=["GET", "HEAD"])
@health_bp.route(HEALTH_ROUTE_ALIAS_PATH, methods=["GET", "HEAD"])
def health_index() -> Response:
    """
    Liefert den Health-/Diagnosezustand des Services.

    Verhalten:
    - normal: HTTP 200 + JSON-Status
    - bei internem Fehler: HTTP 500 + minimaler Fehlerpayload
    """
    try:
        payload = build_health_payload()
        return _build_json_response(payload, status_code=HTTPStatus.OK)
    except Exception as exc:
        _safe_log_exception(
            "Fehler beim Erzeugen der Health-Antwort für `%s`: %r",
            HEALTH_ROUTE_PATH,
            exc,
        )
        return _build_health_error_response(exc)


# -----------------------------------------------------------------------------
# Diagnose / Cache-Clear
# -----------------------------------------------------------------------------

def get_health_module_metadata() -> dict[str, Any]:
    """
    Liefert kleine Laufzeitmetadaten dieses Moduls.
    """
    return {
        "module_name": "routes.health",
        "blueprint_name": HEALTH_BLUEPRINT_NAME,
        "health_route_path": HEALTH_ROUTE_PATH,
        "health_route_alias_path": HEALTH_ROUTE_ALIAS_PATH,
        "service_name_fallback": SERVICE_NAME_FALLBACK,
        "service_display_name_fallback": SERVICE_DISPLAY_NAME_FALLBACK,
    }


def clear_health_module_caches() -> None:
    """
    Löscht interne Modul-Caches.

    Nützlich für:
    - Tests
    - Entwicklungs-Reloads
    - spätere dynamische Paketergänzungen
    """
    cache_clearers = (
        _load_editor_bootstrap_module,
        _resolve_editor_bootstrap_metadata_getter,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


__all__ = [
    "HEALTH_BLUEPRINT_NAME",
    "HEALTH_ROUTE_PATH",
    "HEALTH_ROUTE_ALIAS_PATH",
    "health_bp",
    "build_health_payload",
    "get_health_module_metadata",
    "clear_health_module_caches",
    "health_index",
]