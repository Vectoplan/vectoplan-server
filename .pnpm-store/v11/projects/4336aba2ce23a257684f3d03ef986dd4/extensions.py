# services/vectoplan-editor/extensions.py
"""
Interne Extension-Initialisierung für den Service `vectoplan-editor`.

Wichtig für diese erste Ausbaustufe:
- Es gibt hier bewusst noch keine schweren Flask-Erweiterungen wie Datenbank,
  Cache, CORS oder Socket-Server.
- Trotzdem legen wir bereits eine saubere, robuste Initialisierungsstruktur an.
- Diese Datei verwaltet den internen Namespace in `app.extensions` und schafft
  einen stabilen Platz für spätere Erweiterungen.

Ziele:
- konsistente Initialisierung eines Editor-spezifischen Extension-Registries
- defensive, idempotente Initialisierung
- klare Status- und Metadatenstruktur pro Extension/Subsystem
- spätere Erweiterbarkeit ohne Strukturbruch

Diese Datei ist absichtlich robuster als für die Minimalversion zwingend nötig,
damit spätere Integrationen nicht chaotisch an `app.py` oder einzelne Blueprints
angehängt werden müssen.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Final

from flask import Flask


# -----------------------------------------------------------------------------
# Konstanten
# -----------------------------------------------------------------------------

EDITOR_EXTENSION_NAMESPACE: Final[str] = "vectoplan_editor"
EDITOR_EXTENSION_REGISTRY_KEY: Final[str] = "extensions"
EDITOR_EXTENSION_REGISTRY_VERSION: Final[int] = 1


# -----------------------------------------------------------------------------
# Datenstrukturen
# -----------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class ExtensionSpec:
    """
    Beschreibt eine interne oder externe Editor-Erweiterung/Subkomponente.

    In der ersten Ausbaustufe sind das vor allem interne Zustandscontainer, die
    später mit echten Erweiterungen oder Service-Clients befüllt werden können.
    """

    name: str
    category: str
    description: str
    required: bool = False


# -----------------------------------------------------------------------------
# Kleine Hilfsfunktionen
# -----------------------------------------------------------------------------

def _utc_now_iso() -> str:
    """
    Liefert einen UTC-Zeitstempel im ISO-Format.

    Fallback:
    Falls unerwartet etwas schiefgeht, wird ein stabiler Ersatzwert geliefert.
    """
    try:
        return datetime.now(timezone.utc).isoformat()
    except Exception:
        return "1970-01-01T00:00:00+00:00"


def _is_flask_app(app: object) -> bool:
    """
    Prüft defensiv, ob das Objekt wie eine Flask-App verwendet werden kann.
    """
    if isinstance(app, Flask):
        return True

    required_attributes = ("extensions", "config", "logger")
    try:
        return all(hasattr(app, attribute_name) for attribute_name in required_attributes)
    except Exception:
        return False


def _safe_log_debug(app: Flask, message: str) -> None:
    """
    Loggt defensiv auf Debug-Level.
    """
    try:
        app.logger.debug(message)
    except Exception:
        pass


def _safe_log_info(app: Flask, message: str) -> None:
    """
    Loggt defensiv auf Info-Level.
    """
    try:
        app.logger.info(message)
    except Exception:
        pass


def _safe_log_warning(app: Flask, message: str) -> None:
    """
    Loggt defensiv auf Warning-Level.
    """
    try:
        app.logger.warning(message)
    except Exception:
        pass


def _safe_log_exception(app: Flask, message: str) -> None:
    """
    Loggt defensiv eine Exception im aktiven Ausnahme-Kontext.
    """
    try:
        app.logger.exception(message)
    except Exception:
        pass


def _safe_getattr(obj: Any, attribute_name: str, default: Any = None) -> Any:
    """
    Liest ein Attribut defensiv aus.
    """
    try:
        return getattr(obj, attribute_name, default)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0, minimum: int | None = None) -> int:
    """
    Wandelt einen Wert robust in einen Integer um.
    """
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default

    if minimum is not None:
        result = max(minimum, result)

    return result


def _normalize_extension_name(name: Any) -> str:
    """
    Normalisiert einen Extension-Namen defensiv.
    """
    if name is None:
        return ""

    if isinstance(name, str):
        return name.strip()

    try:
        return str(name).strip()
    except Exception:
        return ""


def _deepcopy_safe(value: Any) -> Any:
    """
    Führt defensiv eine tiefe Kopie aus.

    Falls deepcopy fehlschlägt, wird der Originalwert zurückgegeben.
    """
    try:
        return deepcopy(value)
    except Exception:
        return value


# -----------------------------------------------------------------------------
# Default-Extension-Spezifikation
# -----------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_default_extension_specs() -> tuple[ExtensionSpec, ...]:
    """
    Liefert die Standard-Extension-Spezifikation für den Editor.

    Warum Cache?
    - Die Spezifikationen sind pro Prozess stabil.
    - Mehrfaches Initialisieren oder Testen muss die Liste nicht neu bauen.
    """
    return (
        ExtensionSpec(
            name="registry",
            category="internal",
            description="Interner Registry-Bereich unter app.extensions['vectoplan_editor'].",
            required=True,
        ),
        ExtensionSpec(
            name="templates",
            category="delivery",
            description="Template-Auslieferung für die serverseitige Editor-Shell.",
            required=True,
        ),
        ExtensionSpec(
            name="static_assets",
            category="delivery",
            description="Auslieferung statischer CSS- und JavaScript-Dateien des Editors.",
            required=True,
        ),
        ExtensionSpec(
            name="frontend_bridge",
            category="frontend",
            description="Brücke zwischen Flask-Shell und späterer Frontend-Runtime.",
            required=False,
        ),
        ExtensionSpec(
            name="future_integrations",
            category="integration",
            description="Reservierter Zustand für spätere Service-Clients und Integrationen.",
            required=False,
        ),
    )


# -----------------------------------------------------------------------------
# Registry-Aufbau
# -----------------------------------------------------------------------------

def _ensure_extensions_container(app: Flask) -> dict[str, Any]:
    """
    Stellt sicher, dass `app.extensions` nutzbar ist.
    """
    if not _is_flask_app(app):
        raise TypeError("`extensions.py` erwartet eine Flask-App oder ein kompatibles Objekt.")

    try:
        container = app.extensions
    except Exception as exc:
        raise RuntimeError("Die Flask-App besitzt keinen nutzbaren `extensions`-Container.") from exc

    if not isinstance(container, dict):
        raise RuntimeError("`app.extensions` ist kein Dictionary und kann nicht verwendet werden.")

    return container


def _ensure_editor_namespace(app: Flask) -> dict[str, Any]:
    """
    Stellt den Editor-Namespace unter `app.extensions['vectoplan_editor']` sicher.
    """
    extensions_container = _ensure_extensions_container(app)

    try:
        namespace = extensions_container.setdefault(EDITOR_EXTENSION_NAMESPACE, {})
    except Exception as exc:
        raise RuntimeError(
            "Der Editor-Namespace in `app.extensions` konnte nicht initialisiert werden."
        ) from exc

    if not isinstance(namespace, dict):
        raise RuntimeError(
            f"`app.extensions['{EDITOR_EXTENSION_NAMESPACE}']` ist kein Dictionary."
        )

    namespace.setdefault("namespace", EDITOR_EXTENSION_NAMESPACE)
    namespace.setdefault("extension_registry_version", EDITOR_EXTENSION_REGISTRY_VERSION)
    namespace.setdefault("extensions_initialized", False)
    namespace.setdefault("extensions_initialized_at", None)
    namespace.setdefault("extensions_init_count", 0)
    namespace.setdefault("service_name", app.config.get("APP_NAME", "vectoplan-editor"))
    namespace.setdefault("service_display_name", app.config.get("APP_DISPLAY_NAME", "VECTOPLAN Editor"))
    namespace.setdefault("extension_errors", [])
    namespace.setdefault("extension_warnings", [])
    namespace.setdefault(EDITOR_EXTENSION_REGISTRY_KEY, {})

    if not isinstance(namespace[EDITOR_EXTENSION_REGISTRY_KEY], dict):
        namespace[EDITOR_EXTENSION_REGISTRY_KEY] = {}

    if not isinstance(namespace["extension_errors"], list):
        namespace["extension_errors"] = []

    if not isinstance(namespace["extension_warnings"], list):
        namespace["extension_warnings"] = []

    return namespace


def _new_extension_state(spec: ExtensionSpec) -> dict[str, Any]:
    """
    Erstellt den initialen Zustandscontainer für eine Extension/Subkomponente.
    """
    timestamp = _utc_now_iso()

    return {
        "name": spec.name,
        "category": spec.category,
        "description": spec.description,
        "required": bool(spec.required),
        "registered": True,
        "initialized": False,
        "status": "registered",
        "created_at": timestamp,
        "last_initialized_at": None,
        "last_updated_at": timestamp,
        "init_count": 0,
        "error_count": 0,
        "warning_count": 0,
        "metadata": {},
        "last_error": None,
        "last_warning": None,
    }


def _ensure_extension_registry(app: Flask) -> dict[str, dict[str, Any]]:
    """
    Stellt das eigentliche Extension-Registry-Dictionary sicher.
    """
    namespace = _ensure_editor_namespace(app)

    registry = namespace.get(EDITOR_EXTENSION_REGISTRY_KEY)
    if not isinstance(registry, dict):
        registry = {}
        namespace[EDITOR_EXTENSION_REGISTRY_KEY] = registry

    return registry


def _register_spec_if_missing(app: Flask, spec: ExtensionSpec) -> dict[str, Any]:
    """
    Registriert eine ExtensionSpec idempotent im Registry.
    """
    registry = _ensure_extension_registry(app)
    key = _normalize_extension_name(spec.name)

    if not key:
        raise ValueError("Eine ExtensionSpec ohne gültigen Namen kann nicht registriert werden.")

    entry = registry.get(key)
    if isinstance(entry, dict):
        # Bereits vorhanden -> defensiv aktualisieren, aber nichts zerstören.
        entry.setdefault("name", spec.name)
        entry.setdefault("category", spec.category)
        entry.setdefault("description", spec.description)
        entry.setdefault("required", bool(spec.required))
        entry.setdefault("registered", True)
        entry.setdefault("initialized", False)
        entry.setdefault("status", "registered")
        entry.setdefault("created_at", _utc_now_iso())
        entry.setdefault("last_initialized_at", None)
        entry.setdefault("last_updated_at", _utc_now_iso())
        entry.setdefault("init_count", 0)
        entry.setdefault("error_count", 0)
        entry.setdefault("warning_count", 0)
        entry.setdefault("metadata", {})
        entry.setdefault("last_error", None)
        entry.setdefault("last_warning", None)

        if not isinstance(entry.get("metadata"), dict):
            entry["metadata"] = {}

        return entry

    entry = _new_extension_state(spec)
    registry[key] = entry
    return entry


def _append_warning(app: Flask, message: str) -> None:
    """
    Fügt dem Namespace eine Warnung hinzu.
    """
    namespace = _ensure_editor_namespace(app)

    try:
        namespace["extension_warnings"].append(
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
    Fügt dem Namespace einen Fehler hinzu.
    """
    namespace = _ensure_editor_namespace(app)

    try:
        namespace["extension_errors"].append(
            {
                "message": message,
                "timestamp": _utc_now_iso(),
            }
        )
    except Exception:
        pass

    _safe_log_warning(app, message)


# -----------------------------------------------------------------------------
# Status-Updates pro Extension
# -----------------------------------------------------------------------------

def register_extension(
    app: Flask,
    name: str,
    *,
    category: str = "custom",
    description: str = "",
    required: bool = False,
) -> dict[str, Any]:
    """
    Registriert eine zusätzliche Extension/Subkomponente.

    Diese Funktion ist für spätere Erweiterungen gedacht, falls z. B. neue
    interne Clients oder echte Flask-Extensions hinzukommen.
    """
    spec = ExtensionSpec(
        name=_normalize_extension_name(name),
        category=category.strip() if isinstance(category, str) else "custom",
        description=description.strip() if isinstance(description, str) else "",
        required=bool(required),
    )

    if not spec.name:
        raise ValueError("`register_extension()` benötigt einen gültigen Extension-Namen.")

    entry = _register_spec_if_missing(app, spec)
    entry["last_updated_at"] = _utc_now_iso()
    return entry


def mark_extension_initialized(
    app: Flask,
    name: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Markiert eine Extension/Subkomponente als initialisiert.
    """
    normalized_name = _normalize_extension_name(name)
    if not normalized_name:
        raise ValueError("`mark_extension_initialized()` benötigt einen gültigen Extension-Namen.")

    entry = register_extension(app, normalized_name)

    entry["initialized"] = True
    entry["status"] = "initialized"
    entry["init_count"] = _safe_int(entry.get("init_count"), default=0, minimum=0) + 1
    entry["last_initialized_at"] = _utc_now_iso()
    entry["last_updated_at"] = entry["last_initialized_at"]
    entry["last_error"] = None

    if isinstance(metadata, dict) and metadata:
        current_metadata = entry.get("metadata")
        if not isinstance(current_metadata, dict):
            current_metadata = {}
            entry["metadata"] = current_metadata

        try:
            current_metadata.update(metadata)
        except Exception:
            # Fallback: ersetze bei unerwartet problematischen Metadaten das Objekt defensiv.
            entry["metadata"] = _deepcopy_safe(metadata)

    return entry


def mark_extension_warning(
    app: Flask,
    name: str,
    warning_message: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Markiert eine Extension/Subkomponente mit Warnstatus.
    """
    normalized_name = _normalize_extension_name(name)
    if not normalized_name:
        raise ValueError("`mark_extension_warning()` benötigt einen gültigen Extension-Namen.")

    entry = register_extension(app, normalized_name)
    timestamp = _utc_now_iso()

    entry["status"] = "warning"
    entry["warning_count"] = _safe_int(entry.get("warning_count"), default=0, minimum=0) + 1
    entry["last_warning"] = {
        "message": warning_message,
        "timestamp": timestamp,
    }
    entry["last_updated_at"] = timestamp

    if isinstance(metadata, dict) and metadata:
        current_metadata = entry.get("metadata")
        if not isinstance(current_metadata, dict):
            current_metadata = {}
            entry["metadata"] = current_metadata

        try:
            current_metadata.update(metadata)
        except Exception:
            entry["metadata"] = _deepcopy_safe(metadata)

    _append_warning(app, f"Extension-Warnung [{normalized_name}]: {warning_message}")
    return entry


def mark_extension_failed(
    app: Flask,
    name: str,
    error_message: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Markiert eine Extension/Subkomponente als fehlerhaft.
    """
    normalized_name = _normalize_extension_name(name)
    if not normalized_name:
        raise ValueError("`mark_extension_failed()` benötigt einen gültigen Extension-Namen.")

    entry = register_extension(app, normalized_name)
    timestamp = _utc_now_iso()

    entry["initialized"] = False
    entry["status"] = "failed"
    entry["error_count"] = _safe_int(entry.get("error_count"), default=0, minimum=0) + 1
    entry["last_error"] = {
        "message": error_message,
        "timestamp": timestamp,
    }
    entry["last_updated_at"] = timestamp

    if isinstance(metadata, dict) and metadata:
        current_metadata = entry.get("metadata")
        if not isinstance(current_metadata, dict):
            current_metadata = {}
            entry["metadata"] = current_metadata

        try:
            current_metadata.update(metadata)
        except Exception:
            entry["metadata"] = _deepcopy_safe(metadata)

    _append_error(app, f"Extension-Fehler [{normalized_name}]: {error_message}")
    return entry


# -----------------------------------------------------------------------------
# Initialisierung
# -----------------------------------------------------------------------------

def _seed_default_specs(app: Flask) -> None:
    """
    Legt die Standard-Extension-Spezifikation im Registry an.
    """
    for spec in get_default_extension_specs():
        _register_spec_if_missing(app, spec)


def _initialize_builtin_states(app: Flask) -> None:
    """
    Leitet aus der vorhandenen Flask-App erste Initialisierungszustände ab.

    Diese Funktion initialisiert nur das, was in der Minimalversion bereits
    objektiv vorhanden ist.
    """
    # Registry selbst
    mark_extension_initialized(
        app,
        "registry",
        metadata={
            "namespace": EDITOR_EXTENSION_NAMESPACE,
            "registry_version": EDITOR_EXTENSION_REGISTRY_VERSION,
        },
    )

    # Template-Auslieferung
    template_folder = _safe_getattr(app, "template_folder", None)
    if template_folder:
        mark_extension_initialized(
            app,
            "templates",
            metadata={
                "template_folder": template_folder,
            },
        )
    else:
        mark_extension_warning(
            app,
            "templates",
            "Kein Template-Ordner an der Flask-App erkannt.",
        )

    # Static Assets
    static_folder = _safe_getattr(app, "static_folder", None)
    static_url_path = _safe_getattr(app, "static_url_path", None)
    if static_folder:
        mark_extension_initialized(
            app,
            "static_assets",
            metadata={
                "static_folder": static_folder,
                "static_url_path": static_url_path,
            },
        )
    else:
        mark_extension_warning(
            app,
            "static_assets",
            "Kein Static-Ordner an der Flask-App erkannt.",
        )

    # Frontend-Brücke ist in dieser Stufe nur vorbereitet
    register_extension(
        app,
        "frontend_bridge",
        category="frontend",
        description="Brücke zwischen Flask-Shell und späterer Frontend-Runtime.",
        required=False,
    )

    # Spätere Integrationen sind bewusst noch nicht initialisiert
    register_extension(
        app,
        "future_integrations",
        category="integration",
        description="Reservierter Zustand für spätere Service-Clients und Integrationen.",
        required=False,
    )


def init_extensions(app: Flask) -> Flask:
    """
    Initialisiert die interne Extension-Struktur des Editors idempotent.

    Diese Funktion kann mehrfach aufgerufen werden:
    - sie zerstört keine bestehenden Einträge
    - sie ergänzt nur fehlende Standardstrukturen
    - sie aktualisiert den Initialisierungszeitpunkt und Zähler kontrolliert
    """
    namespace = _ensure_editor_namespace(app)
    _seed_default_specs(app)

    try:
        _initialize_builtin_states(app)
    except Exception as exc:
        _safe_log_exception(app, "Fehler beim Initialisieren der eingebauten Editor-Extensions.")
        _append_error(app, f"Initialisierung eingebauter Editor-Extensions fehlgeschlagen: {exc!r}")
        raise

    namespace["extensions_initialized"] = True
    namespace["extensions_initialized_at"] = _utc_now_iso()
    namespace["extensions_init_count"] = _safe_int(
        namespace.get("extensions_init_count"),
        default=0,
        minimum=0,
    ) + 1

    _safe_log_info(
        app,
        "Interne Extension-Struktur für `vectoplan-editor` wurde initialisiert.",
    )
    return app


# -----------------------------------------------------------------------------
# Lesezugriffe / Debug-Helfer
# -----------------------------------------------------------------------------

def get_extension_registry(app: Flask) -> dict[str, dict[str, Any]]:
    """
    Liefert das vollständige Extension-Registry als sichere Kopie zurück.
    """
    registry = _ensure_extension_registry(app)
    return _deepcopy_safe(registry)


def get_extension_state(app: Flask, name: str) -> dict[str, Any] | None:
    """
    Liefert den Zustand einer einzelnen Extension als Kopie zurück.
    """
    normalized_name = _normalize_extension_name(name)
    if not normalized_name:
        return None

    registry = _ensure_extension_registry(app)
    entry = registry.get(normalized_name)

    if not isinstance(entry, dict):
        return None

    return _deepcopy_safe(entry)


def list_extension_states(app: Flask) -> list[dict[str, Any]]:
    """
    Liefert alle Extension-Zustände sortiert als Liste sicherer Kopien zurück.
    """
    registry = _ensure_extension_registry(app)
    result: list[dict[str, Any]] = []

    for name in sorted(registry.keys()):
        entry = registry.get(name)
        if isinstance(entry, dict):
            result.append(_deepcopy_safe(entry))

    return result


def get_extension_summary(app: Flask) -> dict[str, Any]:
    """
    Liefert eine kompakte Zusammenfassung des aktuellen Extension-Zustands.
    """
    namespace = _ensure_editor_namespace(app)
    registry = _ensure_extension_registry(app)

    total_count = 0
    initialized_count = 0
    warning_count = 0
    failed_count = 0

    for entry in registry.values():
        if not isinstance(entry, dict):
            continue

        total_count += 1

        if bool(entry.get("initialized")):
            initialized_count += 1

        status = entry.get("status")
        if status == "warning":
            warning_count += 1
        elif status == "failed":
            failed_count += 1

    return {
        "namespace": namespace.get("namespace", EDITOR_EXTENSION_NAMESPACE),
        "registry_version": namespace.get(
            "extension_registry_version",
            EDITOR_EXTENSION_REGISTRY_VERSION,
        ),
        "extensions_initialized": bool(namespace.get("extensions_initialized")),
        "extensions_initialized_at": namespace.get("extensions_initialized_at"),
        "extensions_init_count": _safe_int(namespace.get("extensions_init_count"), default=0, minimum=0),
        "total_extensions": total_count,
        "initialized_extensions": initialized_count,
        "warning_extensions": warning_count,
        "failed_extensions": failed_count,
        "warning_log_count": len(namespace.get("extension_warnings", []) or []),
        "error_log_count": len(namespace.get("extension_errors", []) or []),
    }


def get_default_extension_spec_data() -> list[dict[str, Any]]:
    """
    Liefert die Default-Spezifikationen als serialisierbare Dicts zurück.
    """
    return [asdict(spec) for spec in get_default_extension_specs()]


__all__ = [
    "EDITOR_EXTENSION_NAMESPACE",
    "EDITOR_EXTENSION_REGISTRY_KEY",
    "EDITOR_EXTENSION_REGISTRY_VERSION",
    "ExtensionSpec",
    "get_default_extension_specs",
    "get_default_extension_spec_data",
    "register_extension",
    "mark_extension_initialized",
    "mark_extension_warning",
    "mark_extension_failed",
    "init_extensions",
    "get_extension_registry",
    "get_extension_state",
    "list_extension_states",
    "get_extension_summary",
]