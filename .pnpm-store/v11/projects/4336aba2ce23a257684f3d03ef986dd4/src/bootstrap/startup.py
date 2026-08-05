# services/vectoplan-editor/src/bootstrap/startup.py
"""
Startup-Hooks für den Service `vectoplan-editor`.

Wichtig:
- Diese Datei liegt bewusst unter `src/bootstrap/startup.py`, weil du diesen
  Pfad jetzt so festgelegt hast.
- Sie enthält robuste Startprüfungen, Metadaten-Erfassung und die
  Initialisierung des internen Extension-Registries.
- Sie soll in der frühen Phase helfen, den Service stabil und nachvollziehbar
  hochzufahren, ohne bereits unnötig viel Fachlogik einzubauen.

Verantwortung dieser Datei:
- Startup-Metadaten im App-Namespace erfassen
- interne Extensions initialisieren
- grundlegende Struktur- und Dateiprüfungen durchführen
- Route `/editor` als Kerninvariante prüfen
- Warnungen und Fehler sauber protokollieren
- sowohl idempotent als auch fail-safe arbeiten

Diese Datei enthält bewusst:
- defensive try/except-Blöcke
- Caching für stabile Check-Spezifikationen
- keine Business-Logik
- keine Core-/Library-Integration
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Final

from flask import Flask

from extensions import (
    get_extension_summary,
    init_extensions,
    mark_extension_failed,
    mark_extension_initialized,
    mark_extension_warning,
    register_extension,
)


# -----------------------------------------------------------------------------
# Konstanten
# -----------------------------------------------------------------------------

EDITOR_NAMESPACE: Final[str] = "vectoplan_editor"
STARTUP_STATE_KEY: Final[str] = "startup"

DEFAULT_EDITOR_ROUTE: Final[str] = "/editor"
DEFAULT_EDITOR_TEMPLATE: Final[str] = "editor/index.html"


# -----------------------------------------------------------------------------
# Datenstrukturen
# -----------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class PathCheckSpec:
    """
    Beschreibt eine Verzeichnisprüfung im Startup.
    """

    name: str
    config_key: str
    fallback_relative_path: str
    required: bool
    description: str


@dataclass(frozen=True, slots=True)
class FileCheckSpec:
    """
    Beschreibt eine Dateiprüfung im Startup.
    """

    name: str
    fallback_relative_path: str
    required: bool
    description: str


# -----------------------------------------------------------------------------
# Zeit / Logging / Primitive Hilfen
# -----------------------------------------------------------------------------

def _utc_now_iso() -> str:
    """
    Liefert einen UTC-Zeitstempel als ISO-String.
    """
    try:
        return datetime.now(timezone.utc).isoformat()
    except Exception:
        return "1970-01-01T00:00:00+00:00"


def _safe_log_debug(app: Flask, message: str) -> None:
    try:
        app.logger.debug(message)
    except Exception:
        pass


def _safe_log_info(app: Flask, message: str) -> None:
    try:
        app.logger.info(message)
    except Exception:
        pass


def _safe_log_warning(app: Flask, message: str) -> None:
    try:
        app.logger.warning(message)
    except Exception:
        pass


def _safe_log_exception(app: Flask, message: str) -> None:
    try:
        app.logger.exception(message)
    except Exception:
        pass


def _safe_get_config(app: Flask, key: str, default: Any = None) -> Any:
    """
    Liest einen Konfigurationswert defensiv aus der Flask-App.
    """
    try:
        return app.config.get(key, default)
    except Exception:
        return default


def _safe_str(value: Any, default: str = "") -> str:
    """
    Normalisiert einen beliebigen Wert zu einem brauchbaren String.
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


def _safe_bool(value: Any, default: bool = False) -> bool:
    """
    Normalisiert booleans robust.
    """
    if isinstance(value, bool):
        return value

    text = _safe_str(value, "")
    if not text:
        return default

    return text.lower() in {"1", "true", "t", "yes", "y", "on"}


def _safe_int(value: Any, default: int = 0, minimum: int | None = None, maximum: int | None = None) -> int:
    """
    Normalisiert Integer-Werte robust.
    """
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default

    if minimum is not None:
        result = max(minimum, result)

    if maximum is not None:
        result = min(maximum, result)

    return result


def _is_flask_app(app: object) -> bool:
    """
    Prüft defensiv, ob das Objekt wie eine Flask-App verwendbar ist.
    """
    if isinstance(app, Flask):
        return True

    required_attributes = ("extensions", "config", "logger", "url_map")
    try:
        return all(hasattr(app, attr_name) for attr_name in required_attributes)
    except Exception:
        return False


def _resolve_service_root_from_file() -> Path:
    """
    Ermittelt das Service-Root relativ zu dieser Datei.

    Erwarteter Pfad:
    services/vectoplan-editor/src/bootstrap/startup.py

    parents[0] -> bootstrap
    parents[1] -> src
    parents[2] -> vectoplan-editor
    """
    try:
        return Path(__file__).resolve().parents[2]
    except Exception:
        try:
            return Path(".").resolve()
        except Exception:
            return Path(".")


def _safe_path_exists(path: Path) -> bool:
    try:
        return path.exists()
    except Exception:
        return False


def _safe_is_dir(path: Path) -> bool:
    try:
        return path.is_dir()
    except Exception:
        return False


def _safe_is_file(path: Path) -> bool:
    try:
        return path.is_file()
    except Exception:
        return False


def _safe_path_to_string(path: Path | None) -> str:
    if path is None:
        return ""
    try:
        return str(path)
    except Exception:
        return ""


# -----------------------------------------------------------------------------
# Startup-Registry / Namespace
# -----------------------------------------------------------------------------

def _ensure_editor_namespace(app: Flask) -> dict[str, Any]:
    """
    Stellt den Namespace `app.extensions['vectoplan_editor']` sicher.
    """
    if not _is_flask_app(app):
        raise TypeError("Startup-Hooks erwarten eine Flask-App oder ein kompatibles Objekt.")

    try:
        if not isinstance(app.extensions, dict):
            raise TypeError("app.extensions ist kein Dictionary.")
    except Exception as exc:
        raise RuntimeError("Die Flask-App besitzt keinen nutzbaren extensions-Container.") from exc

    try:
        namespace = app.extensions.setdefault(EDITOR_NAMESPACE, {})
    except Exception as exc:
        raise RuntimeError("Der Editor-Namespace konnte in app.extensions nicht erzeugt werden.") from exc

    if not isinstance(namespace, dict):
        raise RuntimeError(f"app.extensions['{EDITOR_NAMESPACE}'] ist kein Dictionary.")

    return namespace


def _ensure_startup_state(app: Flask) -> dict[str, Any]:
    """
    Stellt den Startup-Zustandscontainer sicher.
    """
    namespace = _ensure_editor_namespace(app)

    startup_state = namespace.get(STARTUP_STATE_KEY)
    if not isinstance(startup_state, dict):
        startup_state = {
            "status": "idle",
            "started_at": None,
            "completed_at": None,
            "run_count": 0,
            "strict_mode": False,
            "warnings": [],
            "errors": [],
            "checks": {
                "paths": [],
                "files": [],
                "routes": [],
            },
            "metadata": {},
            "route_summary": {
                "count": 0,
                "has_editor_route": False,
                "editor_route_path": DEFAULT_EDITOR_ROUTE,
            },
        }
        namespace[STARTUP_STATE_KEY] = startup_state

    startup_state.setdefault("status", "idle")
    startup_state.setdefault("started_at", None)
    startup_state.setdefault("completed_at", None)
    startup_state.setdefault("run_count", 0)
    startup_state.setdefault("strict_mode", False)
    startup_state.setdefault("warnings", [])
    startup_state.setdefault("errors", [])
    startup_state.setdefault("checks", {})
    startup_state.setdefault("metadata", {})
    startup_state.setdefault("route_summary", {})

    if not isinstance(startup_state["warnings"], list):
        startup_state["warnings"] = []

    if not isinstance(startup_state["errors"], list):
        startup_state["errors"] = []

    if not isinstance(startup_state["checks"], dict):
        startup_state["checks"] = {}

    startup_state["checks"].setdefault("paths", [])
    startup_state["checks"].setdefault("files", [])
    startup_state["checks"].setdefault("routes", [])

    if not isinstance(startup_state["checks"]["paths"], list):
        startup_state["checks"]["paths"] = []

    if not isinstance(startup_state["checks"]["files"], list):
        startup_state["checks"]["files"] = []

    if not isinstance(startup_state["checks"]["routes"], list):
        startup_state["checks"]["routes"] = []

    if not isinstance(startup_state["metadata"], dict):
        startup_state["metadata"] = {}

    if not isinstance(startup_state["route_summary"], dict):
        startup_state["route_summary"] = {}

    startup_state["route_summary"].setdefault("count", 0)
    startup_state["route_summary"].setdefault("has_editor_route", False)
    startup_state["route_summary"].setdefault("editor_route_path", DEFAULT_EDITOR_ROUTE)

    return startup_state


def _append_warning(app: Flask, message: str) -> None:
    """
    Hängt eine Startup-Warnung an.
    """
    state = _ensure_startup_state(app)

    try:
        state["warnings"].append(
            {
                "message": message,
                "timestamp": _utc_now_iso(),
            }
        )
    except Exception:
        pass

    _safe_log_warning(app, message)


def _append_error(app: Flask, message: str) -> None:
    """
    Hängt einen Startup-Fehler an.
    """
    state = _ensure_startup_state(app)

    try:
        state["errors"].append(
            {
                "message": message,
                "timestamp": _utc_now_iso(),
            }
        )
    except Exception:
        pass

    _safe_log_warning(app, message)


# -----------------------------------------------------------------------------
# Strict Mode
# -----------------------------------------------------------------------------

def _is_strict_startup_enabled(app: Flask) -> bool:
    """
    Ermittelt, ob Startup-Prüfungen streng behandelt werden sollen.

    Quellen:
    - app.config['EDITOR_STARTUP_STRICT']
    - app.config['VECTOPLAN_EDITOR_STARTUP_STRICT']
    - ENV VECTOPLAN_EDITOR_STARTUP_STRICT
    """
    config_value = _safe_get_config(app, "EDITOR_STARTUP_STRICT", None)
    if config_value is None:
        config_value = _safe_get_config(app, "VECTOPLAN_EDITOR_STARTUP_STRICT", None)

    if config_value is None:
        try:
            config_value = os.getenv("VECTOPLAN_EDITOR_STARTUP_STRICT")
        except Exception:
            config_value = None

    return _safe_bool(config_value, default=False)


def _maybe_raise_in_strict_mode(app: Flask, message: str) -> None:
    """
    Hebt in Strict Mode harte Fehler an, ansonsten nur Warnung.
    """
    if _is_strict_startup_enabled(app):
        raise RuntimeError(message)

    _append_warning(app, message)


# -----------------------------------------------------------------------------
# Check-Spezifikationen (gecacht)
# -----------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_default_path_check_specs() -> tuple[PathCheckSpec, ...]:
    """
    Liefert die Standard-Verzeichnisprüfungen gecacht zurück.
    """
    return (
        PathCheckSpec(
            name="service_root",
            config_key="SERVICE_ROOT",
            fallback_relative_path=".",
            required=True,
            description="Root-Verzeichnis des Services.",
        ),
        PathCheckSpec(
            name="routes_root",
            config_key="ROUTES_ROOT",
            fallback_relative_path="routes",
            required=True,
            description="Verzeichnis für HTTP-Routen.",
        ),
        PathCheckSpec(
            name="templates_root",
            config_key="TEMPLATES_ROOT",
            fallback_relative_path="templates",
            required=True,
            description="Verzeichnis für Jinja-Templates.",
        ),
        PathCheckSpec(
            name="static_root",
            config_key="STATIC_ROOT",
            fallback_relative_path="static",
            required=True,
            description="Verzeichnis für statische Dateien.",
        ),
        PathCheckSpec(
            name="frontend_root",
            config_key="FRONTEND_ROOT",
            fallback_relative_path="frontend",
            required=False,
            description="Reservierter Bereich für spätere Frontend-Runtime.",
        ),
        PathCheckSpec(
            name="tests_root",
            config_key="TESTS_ROOT",
            fallback_relative_path="tests",
            required=False,
            description="Testverzeichnis des Services.",
        ),
    )


@lru_cache(maxsize=1)
def get_default_file_check_specs() -> tuple[FileCheckSpec, ...]:
    """
    Liefert die Standard-Dateiprüfungen gecacht zurück.

    In der frühen Stufe werden nur Dateien geprüft, die für den Minimalstart
    bereits relevant sind. Template/CSS/JS bleiben bewusst Warnungen, da die
    Route bereits Fallback-Mechanismen besitzt.
    """
    return (
        FileCheckSpec(
            name="app_factory",
            fallback_relative_path="app.py",
            required=True,
            description="Flask-App-Factory.",
        ),
        FileCheckSpec(
            name="wsgi_entrypoint",
            fallback_relative_path="wsgi.py",
            required=True,
            description="WSGI-Einstiegspunkt.",
        ),
        FileCheckSpec(
            name="service_config",
            fallback_relative_path="config.py",
            required=True,
            description="Zentrale Service-Konfiguration.",
        ),
        FileCheckSpec(
            name="editor_route_module",
            fallback_relative_path="routes/editor.py",
            required=True,
            description="Modul für die erste Editor-Route.",
        ),
        FileCheckSpec(
            name="editor_template",
            fallback_relative_path="templates/editor/index.html",
            required=False,
            description="Template der Editor-Shell.",
        ),
        FileCheckSpec(
            name="editor_css",
            fallback_relative_path="static/editor/css/editor.css",
            required=False,
            description="CSS der Editor-Shell.",
        ),
        FileCheckSpec(
            name="editor_js",
            fallback_relative_path="static/editor/js/main.js",
            required=False,
            description="JS-Bootstrap der Editor-Shell.",
        ),
    )


def get_default_path_check_spec_data() -> list[dict[str, Any]]:
    """
    Serialisierbare Darstellung der PathCheck-Spezifikationen.
    """
    return [asdict(spec) for spec in get_default_path_check_specs()]


def get_default_file_check_spec_data() -> list[dict[str, Any]]:
    """
    Serialisierbare Darstellung der FileCheck-Spezifikationen.
    """
    return [asdict(spec) for spec in get_default_file_check_specs()]


# -----------------------------------------------------------------------------
# Pfad- und Datei-Checks
# -----------------------------------------------------------------------------

def _resolve_configured_path(app: Flask, config_key: str, fallback_relative_path: str) -> Path:
    """
    Löst einen Pfad aus der Konfiguration auf.

    Priorität:
    1. app.config[config_key]
    2. service_root / fallback_relative_path
    """
    configured_value = _safe_get_config(app, config_key, None)
    if isinstance(configured_value, Path):
        return configured_value

    if isinstance(configured_value, str):
        stripped = configured_value.strip()
        if stripped:
            try:
                return Path(stripped)
            except Exception:
                pass

    service_root = _safe_get_config(app, "SERVICE_ROOT", None)
    if isinstance(service_root, Path):
        base_root = service_root
    elif isinstance(service_root, str) and service_root.strip():
        try:
            base_root = Path(service_root.strip())
        except Exception:
            base_root = _resolve_service_root_from_file()
    else:
        base_root = _resolve_service_root_from_file()

    try:
        return base_root.joinpath(fallback_relative_path)
    except Exception:
        return base_root


def _run_path_checks(app: Flask) -> None:
    """
    Führt Verzeichnisprüfungen aus und schreibt die Ergebnisse in den Startup-State.
    """
    state = _ensure_startup_state(app)
    results: list[dict[str, Any]] = []

    for spec in get_default_path_check_specs():
        resolved_path = _resolve_configured_path(app, spec.config_key, spec.fallback_relative_path)
        exists = _safe_path_exists(resolved_path)
        is_dir = _safe_is_dir(resolved_path)

        result = {
            "name": spec.name,
            "config_key": spec.config_key,
            "description": spec.description,
            "required": bool(spec.required),
            "path": _safe_path_to_string(resolved_path),
            "exists": exists,
            "is_dir": is_dir,
            "status": "ok" if exists and is_dir else ("missing" if not exists else "invalid-type"),
        }
        results.append(result)

        if spec.required and not exists:
            _maybe_raise_in_strict_mode(
                app,
                f"Startup-Pflichtverzeichnis fehlt: {spec.name} ({result['path']})",
            )
        elif spec.required and exists and not is_dir:
            _maybe_raise_in_strict_mode(
                app,
                f"Startup-Pflichtpfad ist kein Verzeichnis: {spec.name} ({result['path']})",
            )
        elif not spec.required and (not exists or not is_dir):
            _append_warning(
                app,
                f"Optionales Startup-Verzeichnis nicht vollständig verfügbar: {spec.name} ({result['path']})",
            )

    state["checks"]["paths"] = results


def _run_file_checks(app: Flask) -> None:
    """
    Führt Dateiprüfungen aus und schreibt die Ergebnisse in den Startup-State.
    """
    state = _ensure_startup_state(app)
    service_root = _resolve_configured_path(app, "SERVICE_ROOT", ".")
    results: list[dict[str, Any]] = []

    for spec in get_default_file_check_specs():
        try:
            file_path = service_root.joinpath(spec.fallback_relative_path)
        except Exception:
            file_path = _resolve_service_root_from_file().joinpath(spec.fallback_relative_path)

        exists = _safe_path_exists(file_path)
        is_file = _safe_is_file(file_path)

        result = {
            "name": spec.name,
            "description": spec.description,
            "required": bool(spec.required),
            "path": _safe_path_to_string(file_path),
            "exists": exists,
            "is_file": is_file,
            "status": "ok" if exists and is_file else ("missing" if not exists else "invalid-type"),
        }
        results.append(result)

        if spec.required and not exists:
            _maybe_raise_in_strict_mode(
                app,
                f"Startup-Pflichtdatei fehlt: {spec.name} ({result['path']})",
            )
        elif spec.required and exists and not is_file:
            _maybe_raise_in_strict_mode(
                app,
                f"Startup-Pflichtpfad ist keine Datei: {spec.name} ({result['path']})",
            )
        elif not spec.required and (not exists or not is_file):
            _append_warning(
                app,
                f"Optionale Startup-Datei nicht vollständig verfügbar: {spec.name} ({result['path']})",
            )

    state["checks"]["files"] = results


# -----------------------------------------------------------------------------
# Route-Checks
# -----------------------------------------------------------------------------

def _collect_route_rules(app: Flask) -> list[str]:
    """
    Sammelt alle Route-Regeln der App defensiv.
    """
    try:
        return sorted(str(rule) for rule in app.url_map.iter_rules())
    except Exception:
        return []


def _run_route_checks(app: Flask) -> None:
    """
    Prüft die vorhandenen Routen und stellt sicher, dass `/editor` existiert.
    """
    state = _ensure_startup_state(app)
    route_rules = _collect_route_rules(app)

    configured_editor_route = _safe_str(
        _safe_get_config(app, "EDITOR_ROUTE_PATH", DEFAULT_EDITOR_ROUTE),
        DEFAULT_EDITOR_ROUTE,
    )

    state["checks"]["routes"] = [{"rule": rule} for rule in route_rules]
    state["route_summary"] = {
        "count": len(route_rules),
        "has_editor_route": configured_editor_route in route_rules,
        "editor_route_path": configured_editor_route,
    }

    if configured_editor_route not in route_rules:
        raise RuntimeError(
            f"Die Kernroute des Editors fehlt: {configured_editor_route!r}. "
            "Der Service muss in der Minimalversion mindestens /editor bereitstellen."
        )


# -----------------------------------------------------------------------------
# Metadaten-Erfassung
# -----------------------------------------------------------------------------

def _collect_startup_metadata(app: Flask) -> None:
    """
    Erfasst zentrale App- und Startup-Metadaten.
    """
    state = _ensure_startup_state(app)
    metadata = state["metadata"]

    template_folder = None
    static_folder = None
    static_url_path = None
    instance_path = None

    try:
        template_folder = app.template_folder
    except Exception:
        template_folder = None

    try:
        static_folder = app.static_folder
    except Exception:
        static_folder = None

    try:
        static_url_path = app.static_url_path
    except Exception:
        static_url_path = None

    try:
        instance_path = app.instance_path
    except Exception:
        instance_path = None

    metadata.update(
        {
            "app_name": _safe_str(_safe_get_config(app, "APP_NAME", "vectoplan-editor"), "vectoplan-editor"),
            "app_display_name": _safe_str(
                _safe_get_config(app, "APP_DISPLAY_NAME", "VECTOPLAN Editor"),
                "VECTOPLAN Editor",
            ),
            "app_env": _safe_str(_safe_get_config(app, "APP_ENV", "development"), "development"),
            "debug": _safe_bool(_safe_get_config(app, "DEBUG", False), False),
            "testing": _safe_bool(_safe_get_config(app, "TESTING", False), False),
            "strict_mode": _is_strict_startup_enabled(app),
            "service_root": _safe_path_to_string(_resolve_configured_path(app, "SERVICE_ROOT", ".")),
            "template_folder": _safe_str(template_folder, ""),
            "static_folder": _safe_str(static_folder, ""),
            "static_url_path": _safe_str(static_url_path, ""),
            "instance_path": _safe_str(instance_path, ""),
            "editor_template_name": _safe_str(
                _safe_get_config(app, "EDITOR_TEMPLATE_NAME", DEFAULT_EDITOR_TEMPLATE),
                DEFAULT_EDITOR_TEMPLATE,
            ),
            "editor_route_path": _safe_str(
                _safe_get_config(app, "EDITOR_ROUTE_PATH", DEFAULT_EDITOR_ROUTE),
                DEFAULT_EDITOR_ROUTE,
            ),
            "hotbar_slots": _safe_int(
                _safe_get_config(app, "EDITOR_HOTBAR_SLOTS", 5),
                default=5,
                minimum=1,
                maximum=20,
            ),
            "collected_at": _utc_now_iso(),
        }
    )


# -----------------------------------------------------------------------------
# Extension-Integration
# -----------------------------------------------------------------------------

def _initialize_extension_registry(app: Flask) -> None:
    """
    Initialisiert die interne Extension-Struktur und registriert den Startup-Hook
    selbst als eigene Subkomponente.
    """
    init_extensions(app)

    register_extension(
        app,
        "startup",
        category="internal",
        description="Startup-Hooks, Strukturchecks und Metadaten-Erfassung.",
        required=True,
    )


# -----------------------------------------------------------------------------
# Öffentliche Startup-Funktionen
# -----------------------------------------------------------------------------

def run_startup(app: Flask) -> Flask:
    """
    Führt den Startup-Ablauf für `vectoplan-editor` aus.

    Der Ablauf ist idempotent:
    - Mehrfaches Aufrufen zerstört keinen Zustand
    - `run_count` wird trotzdem mitgeführt
    - bestehende Metadaten werden ergänzt statt überschrieben

    Kritische Fehler:
    - fehlende Kernroute `/editor`
    - inkompatibles App-Objekt
    - grundlegende Initialisierungsfehler im Extension-Setup

    Nicht-kritische Fehler:
    - fehlende optionale Dateien/Verzeichnisse
    - weiche Strukturwarnungen außerhalb des Strict Mode
    """
    if not _is_flask_app(app):
        raise TypeError("run_startup(app) erwartet eine Flask-App oder ein kompatibles Objekt.")

    state = _ensure_startup_state(app)
    state["status"] = "running"
    state["started_at"] = _utc_now_iso()
    state["run_count"] = _safe_int(state.get("run_count"), default=0, minimum=0) + 1
    state["strict_mode"] = _is_strict_startup_enabled(app)

    _safe_log_info(app, "Startup-Hooks für `vectoplan-editor` werden ausgeführt.")

    try:
        _initialize_extension_registry(app)
        _collect_startup_metadata(app)
        _run_path_checks(app)
        _run_file_checks(app)
        _run_route_checks(app)

        extension_summary = get_extension_summary(app)
        state["metadata"]["extension_summary"] = extension_summary
        state["completed_at"] = _utc_now_iso()
        state["status"] = "completed"

        mark_extension_initialized(
            app,
            "startup",
            metadata={
                "status": state["status"],
                "run_count": state["run_count"],
                "strict_mode": state["strict_mode"],
                "route_count": state["route_summary"].get("count", 0),
                "has_editor_route": state["route_summary"].get("has_editor_route", False),
                "warning_count": len(state.get("warnings", []) or []),
                "error_count": len(state.get("errors", []) or []),
                "completed_at": state["completed_at"],
            },
        )

        _safe_log_info(app, "Startup-Hooks für `vectoplan-editor` erfolgreich abgeschlossen.")
        return app

    except Exception as exc:
        state["status"] = "failed"
        state["completed_at"] = _utc_now_iso()

        error_message = f"Startup von `vectoplan-editor` fehlgeschlagen: {exc!r}"
        _append_error(app, error_message)
        _safe_log_exception(app, error_message)

        try:
            mark_extension_failed(
                app,
                "startup",
                error_message,
                metadata={
                    "status": state["status"],
                    "run_count": state["run_count"],
                    "strict_mode": state["strict_mode"],
                    "completed_at": state["completed_at"],
                },
            )
        except Exception:
            # Der eigentliche Startup-Fehler soll nicht von einem Logging-/Registry-
            # Folgefehler verdeckt werden.
            pass

        raise


def bootstrap_app(app: Flask) -> Flask:
    """
    Alias für kompatible App-Bootstrap-Aufrufe.
    """
    return run_startup(app)


def initialize_app(app: Flask) -> Flask:
    """
    Alias für kompatible Initialisierungsaufrufe.
    """
    return run_startup(app)


# -----------------------------------------------------------------------------
# Lesefunktionen / Debugging
# -----------------------------------------------------------------------------

def get_startup_state(app: Flask) -> dict[str, Any]:
    """
    Liefert den aktuellen Startup-Zustand als defensive Kopie zurück.
    """
    state = _ensure_startup_state(app)

    try:
        import copy

        return copy.deepcopy(state)
    except Exception:
        return dict(state)


def get_startup_summary(app: Flask) -> dict[str, Any]:
    """
    Liefert eine kompakte Startup-Zusammenfassung zurück.
    """
    state = _ensure_startup_state(app)

    return {
        "status": _safe_str(state.get("status"), "unknown"),
        "started_at": state.get("started_at"),
        "completed_at": state.get("completed_at"),
        "run_count": _safe_int(state.get("run_count"), default=0, minimum=0),
        "strict_mode": _safe_bool(state.get("strict_mode"), False),
        "warning_count": len(state.get("warnings", []) or []),
        "error_count": len(state.get("errors", []) or []),
        "route_count": _safe_int(
            state.get("route_summary", {}).get("count", 0),
            default=0,
            minimum=0,
        ),
        "has_editor_route": _safe_bool(
            state.get("route_summary", {}).get("has_editor_route", False),
            False,
        ),
        "editor_route_path": _safe_str(
            state.get("route_summary", {}).get("editor_route_path"),
            DEFAULT_EDITOR_ROUTE,
        ),
    }


__all__ = [
    "PathCheckSpec",
    "FileCheckSpec",
    "get_default_path_check_specs",
    "get_default_file_check_specs",
    "get_default_path_check_spec_data",
    "get_default_file_check_spec_data",
    "run_startup",
    "bootstrap_app",
    "initialize_app",
    "get_startup_state",
    "get_startup_summary",
]