# services/vectoplan-editor/routes/__init__.py
"""
Zentrale Blueprint-Registrierung für den Microservice `vectoplan-editor`.

Diese Datei ist die zentrale HTTP-Routing-Verdrahtung des Editor-Backends.

Aufgaben:
- Route-Module defensiv importieren
- Flask-Blueprints genau einmal registrieren
- optionale Routen kontrolliert überspringen
- erforderliche Editor-Routen hart prüfen
- Routing-Metadaten in app.extensions["vectoplan_editor"] speichern
- Health-/Debug-Ausgaben für den aktuellen Routing-Stand ermöglichen

Wichtige Architekturentscheidungen:

1. `routes.chunk.chunk_bp` besitzt seinen Prefix bereits selbst:

       /editor/api/chunk

   Deshalb wird `chunk_bp` hier ohne zusätzlichen `url_prefix` registriert.
   Sonst entstünde ein falscher Pfad wie:

       /editor/api/chunk/editor/api/chunk

2. `routes.inventory.inventory_bp` besitzt lokal nur die Route:

       /inventory

   Deshalb wird `inventory_bp` hier mit:

       url_prefix="/editor/api"

   registriert. Der externe Pfad ist damit:

       /editor/api/inventory

3. `/editor/api/inventory` ist ab jetzt keine alte Platzhalterroute mehr,
   sondern der zentrale serverseitige Editor-Inventory-Adapter zu
   `vectoplan-library`.

4. Der Browser soll nicht direkt `vectoplan-library` aufrufen. Er spricht über:

       /editor/api/inventory

Diese Datei enthält keine:
- Business-Logik
- HTML-Erzeugung
- Chunk-Fachlogik
- Library-Fachlogik
- Inventory-Payload-Building
- Editor-Runtime-Logik
- Proxy-Implementierung

Sie verdrahtet nur Flask-Routen.
"""

from __future__ import annotations

import importlib
import os
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from functools import lru_cache
from types import ModuleType
from typing import Any, Final

from flask import Blueprint, Flask


# =============================================================================
# Modulkonstanten
# =============================================================================

ROUTES_MODULE_NAME: Final[str] = "routes"
ROUTES_MODULE_VERSION: Final[str] = "0.7.0"

HEALTH_BLUEPRINT_MODULE_NAME: Final[str] = "routes.health"
HEALTH_BLUEPRINT_ATTRIBUTE_NAME: Final[str] = "health_bp"

CHUNK_BLUEPRINT_MODULE_NAME: Final[str] = "routes.chunk"
CHUNK_BLUEPRINT_ATTRIBUTE_NAME: Final[str] = "chunk_bp"
CHUNK_BLUEPRINT_PUBLIC_PREFIX: Final[str] = "/editor/api/chunk"

INVENTORY_BLUEPRINT_MODULE_NAME: Final[str] = "routes.inventory"
INVENTORY_BLUEPRINT_ATTRIBUTE_NAME: Final[str] = "inventory_bp"
INVENTORY_BLUEPRINT_URL_PREFIX: Final[str] = "/editor/api"
INVENTORY_BLUEPRINT_PUBLIC_PATH: Final[str] = "/editor/api/inventory"
REALTIME_BLUEPRINT_MODULE_NAME: Final[str] = "routes.realtime"
REALTIME_BLUEPRINT_ATTRIBUTE_NAME: Final[str] = "realtime_bp"
REALTIME_BLUEPRINT_PUBLIC_PATH: Final[str] = "/editor/api/realtime/_status"


EDITOR_BLUEPRINT_MODULE_NAME: Final[str] = "routes.editor"
EDITOR_BLUEPRINT_ATTRIBUTE_NAME: Final[str] = "editor_bp"
EDITOR_BLUEPRINT_PUBLIC_PATH: Final[str] = "/editor"


# =============================================================================
# Blueprint-Spezifikation
# =============================================================================

@dataclass(frozen=True, slots=True)
class BlueprintSpec:
    """
    Beschreibt, wie ein Blueprint geladen und registriert wird.

    url_prefix:
        None bedeutet:
        - Blueprint wird mit seinem eigenen Prefix registriert
        - oder ohne Prefix, wenn der Blueprint keinen eigenen Prefix besitzt

    required:
        True:
        - fehlendes Modul oder fehlender Blueprint ist ein Startup-Fehler,
          sofern die Spec nicht per Config/ENV deaktiviert wurde

        False:
        - fehlendes Modul wird sauber übersprungen

    default_enabled:
        Default, wenn keine der `enabled_config_keys` gesetzt ist.

    enabled_config_keys:
        Optionaler Satz von Config-/ENV-Namen.
        Wenn einer davon explizit false ist, wird der Blueprint übersprungen.
        Wenn einer davon explizit true ist, wird er registriert.
    """

    module_name: str
    attribute_name: str
    url_prefix: str | None = None
    required: bool = True
    default_enabled: bool = True
    description: str | None = None
    public_path: str | None = None
    enabled_config_keys: tuple[str, ...] = ()


# =============================================================================
# Kleine robuste Hilfsfunktionen
# =============================================================================

def _normalize_text(value: Any, default: str | None = None) -> str | None:
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


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, int) and not isinstance(value, bool):
        return bool(value)

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in {"1", "true", "t", "yes", "y", "on", "enabled"}:
            return True

        if normalized in {"0", "false", "f", "no", "n", "off", "disabled"}:
            return False

    return default


def _safe_utc_timestamp() -> str:
    try:
        return datetime.now(UTC).isoformat()
    except Exception:
        try:
            return datetime.utcnow().isoformat() + "Z"
        except Exception:
            return "1970-01-01T00:00:00Z"


def _safe_get_logger(app: Flask) -> Any | None:
    try:
        return app.logger
    except Exception:
        return None


def _safe_log_debug(app: Flask, message: str, *args: Any) -> None:
    logger = _safe_get_logger(app)
    if logger is None:
        return

    try:
        logger.debug(message, *args)
    except Exception:
        pass


def _safe_log_info(app: Flask, message: str, *args: Any) -> None:
    logger = _safe_get_logger(app)
    if logger is None:
        return

    try:
        logger.info(message, *args)
    except Exception:
        pass


def _safe_log_warning(app: Flask, message: str, *args: Any) -> None:
    logger = _safe_get_logger(app)
    if logger is None:
        return

    try:
        logger.warning(message, *args)
    except Exception:
        pass


def _safe_log_exception(app: Flask, message: str, *args: Any) -> None:
    logger = _safe_get_logger(app)
    if logger is None:
        return

    try:
        logger.exception(message, *args)
    except Exception:
        pass


def _is_flask_app(app: object) -> bool:
    if isinstance(app, Flask):
        return True

    required_attributes = ("register_blueprint", "blueprints", "extensions", "url_map")
    for attribute_name in required_attributes:
        try:
            if not hasattr(app, attribute_name):
                return False
        except Exception:
            return False

    return True


def _read_app_or_env_bool(
    app: Flask,
    keys: tuple[str, ...],
    *,
    default: bool,
) -> bool:
    for key in keys:
        try:
            value = app.config.get(key)
            if value not in {None, ""}:
                return _coerce_bool(value, default)
        except Exception:
            pass

    for key in keys:
        try:
            value = os.environ.get(key)
            if value not in {None, ""}:
                return _coerce_bool(value, default)
        except Exception:
            pass

    return default


def _safe_rule_strings(app: Flask) -> list[str]:
    try:
        url_map = getattr(app, "url_map", None)
        if url_map is None or not hasattr(url_map, "iter_rules"):
            return []

        return sorted(str(rule.rule) for rule in url_map.iter_rules())
    except Exception:
        return []


def _safe_endpoint_strings(app: Flask) -> list[str]:
    try:
        url_map = getattr(app, "url_map", None)
        if url_map is None or not hasattr(url_map, "iter_rules"):
            return []

        return sorted(str(rule.endpoint) for rule in url_map.iter_rules())
    except Exception:
        return []


def _route_exists(app: Flask, route_path: str) -> bool:
    normalized_route = _normalize_text(route_path)
    if not normalized_route:
        return False

    try:
        for rule in app.url_map.iter_rules():
            if str(rule.rule) == normalized_route:
                return True
    except Exception:
        return False

    return False


# =============================================================================
# Extension-Registry / Tracking
# =============================================================================

def _ensure_extension_registry(app: Flask) -> dict[str, Any]:
    try:
        app.extensions.setdefault("vectoplan_editor", {})
        registry = app.extensions["vectoplan_editor"]

        if not isinstance(registry, dict):
            raise TypeError("app.extensions['vectoplan_editor'] ist kein Dictionary.")

        return registry
    except Exception as exc:
        raise RuntimeError(
            "Der Extension-Registry-Bereich für `vectoplan_editor` konnte nicht erstellt werden."
        ) from exc


def _ensure_blueprint_tracking(app: Flask) -> set[str]:
    registry = _ensure_extension_registry(app)

    try:
        existing = registry.get("registered_blueprint_names")

        if isinstance(existing, set):
            return existing

        if isinstance(existing, list):
            restored = {str(item) for item in existing}
            registry["registered_blueprint_names"] = restored
            return restored

        tracking: set[str] = set()
        registry["registered_blueprint_names"] = tracking
        return tracking
    except Exception as exc:
        raise RuntimeError(
            "Blueprint-Tracking für `vectoplan-editor` konnte nicht initialisiert werden."
        ) from exc


def _ensure_registration_events(app: Flask) -> list[dict[str, Any]]:
    registry = _ensure_extension_registry(app)

    try:
        existing = registry.get("blueprint_registration_events")

        if isinstance(existing, list):
            return existing

        events: list[dict[str, Any]] = []
        registry["blueprint_registration_events"] = events
        return events
    except Exception as exc:
        raise RuntimeError(
            "Das Registrierungsevent-Log für `vectoplan-editor` konnte nicht initialisiert werden."
        ) from exc


def _store_registration_event(
    app: Flask,
    *,
    spec: BlueprintSpec,
    blueprint_name: str | None,
    status: str,
    error: str | None = None,
) -> None:
    try:
        events = _ensure_registration_events(app)
        events.append(
            {
                "timestampUtc": _safe_utc_timestamp(),
                "moduleName": spec.module_name,
                "attributeName": spec.attribute_name,
                "urlPrefix": spec.url_prefix,
                "required": spec.required,
                "defaultEnabled": spec.default_enabled,
                "description": spec.description,
                "publicPath": spec.public_path,
                "enabledConfigKeys": list(spec.enabled_config_keys),
                "blueprintName": _normalize_text(blueprint_name),
                "status": status,
                "error": _normalize_text(error),
            }
        )
    except Exception:
        pass


# =============================================================================
# Import-Helfer
# =============================================================================

@lru_cache(maxsize=64)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    normalized_module_name = _normalize_text(module_name, "")
    if not normalized_module_name:
        return ()

    parts = normalized_module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_target_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=64)
def _import_module(module_name: str) -> ModuleType:
    return importlib.import_module(module_name)


def _load_route_module(spec: BlueprintSpec) -> ModuleType | None:
    try:
        return _import_module(spec.module_name)
    except ModuleNotFoundError as exc:
        if _is_missing_target_module(exc, spec.module_name):
            if not spec.required:
                return None

            raise RuntimeError(
                f"Das erforderliche Route-Modul `{spec.module_name}` konnte nicht importiert werden."
            ) from exc

        raise RuntimeError(
            f"Das Route-Modul `{spec.module_name}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Route-Modul `{spec.module_name}` konnte nicht importiert werden."
        ) from exc


def _resolve_blueprint(spec: BlueprintSpec) -> Blueprint | None:
    module = _load_route_module(spec)
    if module is None:
        return None

    try:
        candidate = getattr(module, spec.attribute_name)
    except AttributeError as exc:
        raise RuntimeError(
            f"Im Modul `{spec.module_name}` fehlt das erwartete Attribut "
            f"`{spec.attribute_name}`."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Attribut `{spec.attribute_name}` aus `{spec.module_name}` konnte nicht gelesen werden."
        ) from exc

    if not isinstance(candidate, Blueprint):
        raise RuntimeError(
            f"Das Attribut `{spec.attribute_name}` aus `{spec.module_name}` "
            "ist kein Flask-Blueprint."
        )

    return candidate


# =============================================================================
# Blueprint-Spezifikationen
# =============================================================================

@lru_cache(maxsize=1)
def get_blueprint_specs() -> tuple[BlueprintSpec, ...]:
    """
    Liefert die Blueprint-Spezifikationen.

    Reihenfolge:
    1. Health / Diagnose
    2. Chunk-Proxy unter /editor/api/chunk
    3. Inventory-API unter /editor/api/inventory
    4. Realtime-Diagnose unter /editor/api/realtime/_status
    5. sichtbare Editor-Seite unter /editor

    Wichtig:
    - Chunk bekommt hier KEIN zusätzliches url_prefix.
      Der Prefix sitzt bereits in routes.chunk.chunk_bp.
    - Inventory bekommt hier url_prefix="/editor/api".
      Die lokale Route in routes.inventory ist /inventory.
    """
    return (
        BlueprintSpec(
            module_name=HEALTH_BLUEPRINT_MODULE_NAME,
            attribute_name=HEALTH_BLUEPRINT_ATTRIBUTE_NAME,
            url_prefix=None,
            required=True,
            default_enabled=True,
            description="Health- und Diagnoseendpunkte",
            public_path=None,
            enabled_config_keys=(
                "EDITOR_HEALTH_ROUTES_ENABLED",
                "VECTOPLAN_EDITOR_HEALTH_ROUTES_ENABLED",
            ),
        ),
        BlueprintSpec(
            module_name=CHUNK_BLUEPRINT_MODULE_NAME,
            attribute_name=CHUNK_BLUEPRINT_ATTRIBUTE_NAME,
            url_prefix=None,
            required=True,
            default_enabled=True,
            description="Editor-seitige Chunk-Proxy-API unter /editor/api/chunk",
            public_path=CHUNK_BLUEPRINT_PUBLIC_PREFIX,
            enabled_config_keys=(
                "EDITOR_CHUNK_ROUTES_ENABLED",
                "VECTOPLAN_EDITOR_CHUNK_ROUTES_ENABLED",
                "EDITOR_CHUNK_SERVICE_ENABLED",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED",
            ),
        ),
        BlueprintSpec(
            module_name=INVENTORY_BLUEPRINT_MODULE_NAME,
            attribute_name=INVENTORY_BLUEPRINT_ATTRIBUTE_NAME,
            url_prefix=INVENTORY_BLUEPRINT_URL_PREFIX,
            required=True,
            default_enabled=True,
            description="Editor-Inventory-API unter /editor/api/inventory; Adapter zu vectoplan-library",
            public_path=INVENTORY_BLUEPRINT_PUBLIC_PATH,
            enabled_config_keys=(
                "EDITOR_INVENTORY_ROUTES_ENABLED",
                "VECTOPLAN_EDITOR_INVENTORY_ROUTES_ENABLED",
                "EDITOR_INVENTORY_ENABLED",
                "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
            ),
        ),
        BlueprintSpec(
            module_name=REALTIME_BLUEPRINT_MODULE_NAME,
            attribute_name=REALTIME_BLUEPRINT_ATTRIBUTE_NAME,
            url_prefix=None,
            required=True,
            default_enabled=True,
            description="Status endpoint for the editor realtime system",
            public_path=REALTIME_BLUEPRINT_PUBLIC_PATH,
            enabled_config_keys=(
                "EDITOR_REALTIME_ENABLED",
                "VECTOPLAN_EDITOR_REALTIME_ENABLED",
            ),
        ),
        BlueprintSpec(
            module_name=EDITOR_BLUEPRINT_MODULE_NAME,
            attribute_name=EDITOR_BLUEPRINT_ATTRIBUTE_NAME,
            url_prefix=None,
            required=True,
            default_enabled=True,
            description="Sichtbare Editor-Seite und HTML-Shell",
            public_path=EDITOR_BLUEPRINT_PUBLIC_PATH,
            enabled_config_keys=(
                "EDITOR_PAGE_ROUTES_ENABLED",
                "VECTOPLAN_EDITOR_PAGE_ROUTES_ENABLED",
            ),
        ),
    )


def describe_blueprint_specs() -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []

    for spec in get_blueprint_specs():
        try:
            result.append(asdict(spec))
        except Exception:
            result.append(
                {
                    "moduleName": spec.module_name,
                    "attributeName": spec.attribute_name,
                    "urlPrefix": spec.url_prefix,
                    "required": spec.required,
                    "defaultEnabled": spec.default_enabled,
                    "description": spec.description,
                    "publicPath": spec.public_path,
                    "enabledConfigKeys": list(spec.enabled_config_keys),
                }
            )

    return result


# =============================================================================
# Registrierung
# =============================================================================

def _is_spec_enabled(app: Flask, spec: BlueprintSpec) -> bool:
    if not spec.enabled_config_keys:
        return spec.default_enabled

    return _read_app_or_env_bool(
        app,
        spec.enabled_config_keys,
        default=spec.default_enabled,
    )


def _register_single_blueprint(
    app: Flask,
    *,
    spec: BlueprintSpec,
    blueprint: Blueprint,
) -> None:
    blueprint_name = getattr(blueprint, "name", None)
    if not blueprint_name or not isinstance(blueprint_name, str):
        raise RuntimeError("Ein Blueprint ohne gültigen Namen kann nicht registriert werden.")

    tracked_names = _ensure_blueprint_tracking(app)

    if blueprint_name in tracked_names:
        _safe_log_debug(
            app,
            "Blueprint `%s` wurde bereits registriert und wird übersprungen.",
            blueprint_name,
        )
        _store_registration_event(
            app,
            spec=spec,
            blueprint_name=blueprint_name,
            status="skipped-already-tracked",
        )
        return

    try:
        if blueprint_name in app.blueprints:
            tracked_names.add(blueprint_name)
            _safe_log_debug(
                app,
                "Blueprint `%s` war bereits an der App vorhanden und wurde nur im Tracking ergänzt.",
                blueprint_name,
            )
            _store_registration_event(
                app,
                spec=spec,
                blueprint_name=blueprint_name,
                status="skipped-already-on-app",
            )
            return
    except Exception:
        pass

    try:
        if spec.url_prefix:
            app.register_blueprint(blueprint, url_prefix=spec.url_prefix)
        else:
            app.register_blueprint(blueprint)
    except Exception as exc:
        _store_registration_event(
            app,
            spec=spec,
            blueprint_name=blueprint_name,
            status="error-register",
            error=_normalize_text(exc, "Registrierung fehlgeschlagen"),
        )
        raise RuntimeError(
            f"Blueprint `{blueprint_name}` konnte nicht registriert werden."
        ) from exc

    tracked_names.add(blueprint_name)

    _safe_log_info(app, "Blueprint `%s` wurde erfolgreich registriert.", blueprint_name)
    _store_registration_event(
        app,
        spec=spec,
        blueprint_name=blueprint_name,
        status="registered",
    )


def _collect_known_rules(app: Flask) -> list[str]:
    return _safe_rule_strings(app)


def _collect_known_endpoints(app: Flask) -> list[str]:
    return _safe_endpoint_strings(app)


def _collect_route_presence(app: Flask) -> dict[str, bool]:
    return {
        "chunkPrefixPresent": any(
            rule.startswith(CHUNK_BLUEPRINT_PUBLIC_PREFIX)
            for rule in _safe_rule_strings(app)
        ),
        "inventoryRoutePresent": _route_exists(app, INVENTORY_BLUEPRINT_PUBLIC_PATH),
        "realtimeStatusRoutePresent": _route_exists(app, REALTIME_BLUEPRINT_PUBLIC_PATH),
        "editorRoutePresent": _route_exists(app, EDITOR_BLUEPRINT_PUBLIC_PATH),
    }


def _store_registration_metadata(app: Flask) -> None:
    registry = _ensure_extension_registry(app)

    try:
        registry["route_module"] = ROUTES_MODULE_NAME
        registry["route_module_version"] = ROUTES_MODULE_VERSION
        registry["blueprint_specs"] = describe_blueprint_specs()
        registry["routing_initialized"] = True
        registry["routing_last_updated_at"] = _safe_utc_timestamp()
        registry["registered_blueprints_snapshot"] = get_registered_blueprint_names(app)
        registry["known_rules"] = _collect_known_rules(app)
        registry["known_endpoints"] = _collect_known_endpoints(app)
        registry["route_presence"] = _collect_route_presence(app)
        registry["chunk_proxy_public_prefix"] = CHUNK_BLUEPRINT_PUBLIC_PREFIX
        registry["inventory_public_path"] = INVENTORY_BLUEPRINT_PUBLIC_PATH
        registry["realtime_status_public_path"] = REALTIME_BLUEPRINT_PUBLIC_PATH
        registry["editor_public_path"] = EDITOR_BLUEPRINT_PUBLIC_PATH
    except Exception as exc:
        raise RuntimeError(
            "Routing-Metadaten für `vectoplan-editor` konnten nicht gespeichert werden."
        ) from exc


def _assert_required_routes_present(app: Flask) -> None:
    """
    Prüft kritische Routen nach Registrierung.

    Diese Prüfung ist bewusst schmal:
    - Chunk-Blueprint hat mehrere Unterrouten; daher nur Prefix-Prüfung.
    - Inventory muss exakt /editor/api/inventory enthalten.
    - Realtime muss exakt /editor/api/realtime/_status enthalten.
    - Editor-Seite muss exakt /editor enthalten.
    """
    presence = _collect_route_presence(app)
    errors: list[str] = []

    if not presence.get("chunkPrefixPresent"):
        errors.append(f"Keine Route unter `{CHUNK_BLUEPRINT_PUBLIC_PREFIX}` gefunden.")

    inventory_enabled = _read_app_or_env_bool(
        app,
        (
            "EDITOR_INVENTORY_ENABLED",
            "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
            "EDITOR_INVENTORY_ROUTES_ENABLED",
            "VECTOPLAN_EDITOR_INVENTORY_ROUTES_ENABLED",
        ),
        default=True,
    )
    if inventory_enabled and not presence.get("inventoryRoutePresent"):
        errors.append(f"Erforderliche Inventory-Route `{INVENTORY_BLUEPRINT_PUBLIC_PATH}` fehlt.")

    realtime_enabled = _read_app_or_env_bool(
        app,
        (
            "EDITOR_REALTIME_ENABLED",
            "VECTOPLAN_EDITOR_REALTIME_ENABLED",
        ),
        default=True,
    )
    if realtime_enabled and not presence.get("realtimeStatusRoutePresent"):
        errors.append(f"Erforderliche Realtime-Route `{REALTIME_BLUEPRINT_PUBLIC_PATH}` fehlt.")

    if not presence.get("editorRoutePresent"):
        errors.append(f"Erforderliche Editor-Route `{EDITOR_BLUEPRINT_PUBLIC_PATH}` fehlt.")

    if errors:
        raise RuntimeError("Routing-Validierung fehlgeschlagen: " + " ".join(errors))


# =============================================================================
# Öffentliche API
# =============================================================================

def register_blueprints(app: Flask) -> Flask:
    """
    Registriert alle vorgesehenen Blueprints an der Flask-App.

    Diese Funktion ist idempotent gemeint:
    - bereits registrierte Blueprints werden übersprungen
    - der aktuelle Routing-Stand wird in app.extensions dokumentiert
    - kritische Routen werden nach Registrierung validiert
    """

    if not _is_flask_app(app):
        raise TypeError(
            "`register_blueprints(app)` erwartet eine Flask-App oder ein kompatibles Objekt."
        )

    registry = _ensure_extension_registry(app)
    registry["routing_registration_attempted_at"] = _safe_utc_timestamp()

    specs = get_blueprint_specs()
    if not specs:
        _safe_log_warning(
            app,
            "Keine Blueprint-Spezifikationen gefunden; es wurden keine Routen registriert.",
        )
        _store_registration_metadata(app)
        return app

    for spec in specs:
        blueprint_name: str | None = None

        try:
            if not _is_spec_enabled(app, spec):
                _safe_log_info(
                    app,
                    "Blueprint-Spec `%s` ist per Config/ENV deaktiviert und wird übersprungen.",
                    spec.module_name,
                )
                _store_registration_event(
                    app,
                    spec=spec,
                    blueprint_name=None,
                    status="skipped-disabled",
                )
                continue

            blueprint = _resolve_blueprint(spec)
            if blueprint is None:
                if spec.required:
                    raise RuntimeError(
                        f"Erforderliches Route-Modul `{spec.module_name}` ist nicht vorhanden."
                    )

                _safe_log_warning(
                    app,
                    "Optionales Route-Modul `%s` ist nicht vorhanden und wird übersprungen.",
                    spec.module_name,
                )
                _store_registration_event(
                    app,
                    spec=spec,
                    blueprint_name=None,
                    status="skipped-missing-optional-module",
                )
                continue

            blueprint_name = getattr(blueprint, "name", None)
            _register_single_blueprint(
                app=app,
                spec=spec,
                blueprint=blueprint,
            )
        except Exception as exc:
            _safe_log_exception(
                app,
                "Fehler bei der Registrierung des Blueprints aus `%s`: %r",
                spec.module_name,
                exc,
            )
            _store_registration_event(
                app,
                spec=spec,
                blueprint_name=blueprint_name,
                status="error",
                error=_normalize_text(exc, "Unbekannter Registrierungsfehler"),
            )
            raise

    _store_registration_metadata(app)
    _assert_required_routes_present(app)
    _store_registration_metadata(app)
    return app


def get_registered_blueprint_names(app: Flask) -> list[str]:
    tracked_names = _ensure_blueprint_tracking(app)

    try:
        return sorted(tracked_names)
    except Exception:
        return list(tracked_names)


def iter_blueprint_specs() -> tuple[BlueprintSpec, ...]:
    return get_blueprint_specs()


def get_routes_module_metadata(app: Flask | None = None) -> dict[str, Any]:
    base_metadata: dict[str, Any] = {
        "moduleName": ROUTES_MODULE_NAME,
        "moduleVersion": ROUTES_MODULE_VERSION,
        "health": {
            "moduleName": HEALTH_BLUEPRINT_MODULE_NAME,
            "attributeName": HEALTH_BLUEPRINT_ATTRIBUTE_NAME,
        },
        "chunkProxy": {
            "moduleName": CHUNK_BLUEPRINT_MODULE_NAME,
            "attributeName": CHUNK_BLUEPRINT_ATTRIBUTE_NAME,
            "publicPrefix": CHUNK_BLUEPRINT_PUBLIC_PREFIX,
            "prefixOwnedByBlueprint": True,
            "registerWithAdditionalUrlPrefix": False,
        },
        "inventoryApi": {
            "moduleName": INVENTORY_BLUEPRINT_MODULE_NAME,
            "attributeName": INVENTORY_BLUEPRINT_ATTRIBUTE_NAME,
            "urlPrefix": INVENTORY_BLUEPRINT_URL_PREFIX,
            "publicPath": INVENTORY_BLUEPRINT_PUBLIC_PATH,
            "required": True,
            "role": "serverseitiger Editor-Inventory-Adapter zu vectoplan-library",
            "browserUsesThisRoute": True,
            "browserShouldNotCallVectoplanLibraryDirectly": True,
        },
        "realtime": {
            "moduleName": REALTIME_BLUEPRINT_MODULE_NAME,
            "attributeName": REALTIME_BLUEPRINT_ATTRIBUTE_NAME,
            "statusPath": REALTIME_BLUEPRINT_PUBLIC_PATH,
            "socketPath": "/editor/realtime",
        },
        "editorPage": {
            "moduleName": EDITOR_BLUEPRINT_MODULE_NAME,
            "attributeName": EDITOR_BLUEPRINT_ATTRIBUTE_NAME,
            "publicPath": EDITOR_BLUEPRINT_PUBLIC_PATH,
        },
        "blueprintSpecs": describe_blueprint_specs(),
        "rules": {
            "chunkBlueprintRegisteredWithoutExtraPrefix": True,
            "inventoryBlueprintRegisteredWithEditorApiPrefix": True,
            "inventoryPath": INVENTORY_BLUEPRINT_PUBLIC_PATH,
            "onlyLibraryInventoryShouldBePlaceable": True,
        },
    }

    if app is None:
        return base_metadata

    try:
        base_metadata["registeredBlueprintNames"] = get_registered_blueprint_names(app)
    except Exception:
        base_metadata["registeredBlueprintNames"] = []

    try:
        base_metadata["knownRules"] = _collect_known_rules(app)
    except Exception:
        base_metadata["knownRules"] = []

    try:
        base_metadata["knownEndpoints"] = _collect_known_endpoints(app)
    except Exception:
        base_metadata["knownEndpoints"] = []

    try:
        base_metadata["routePresence"] = _collect_route_presence(app)
    except Exception:
        base_metadata["routePresence"] = {}

    try:
        registry = _ensure_extension_registry(app)
        base_metadata["routingInitialized"] = _coerce_bool(
            registry.get("routing_initialized"),
            False,
        )
        base_metadata["routingLastUpdatedAt"] = _normalize_text(
            registry.get("routing_last_updated_at"),
        )
        base_metadata["routingRegistrationAttemptedAt"] = _normalize_text(
            registry.get("routing_registration_attempted_at"),
        )
        base_metadata["registeredBlueprintsSnapshot"] = registry.get(
            "registered_blueprints_snapshot",
            [],
        )
        base_metadata["blueprintRegistrationEvents"] = registry.get(
            "blueprint_registration_events",
            [],
        )
        base_metadata["chunkProxyPublicPrefix"] = registry.get(
            "chunk_proxy_public_prefix",
            CHUNK_BLUEPRINT_PUBLIC_PREFIX,
        )
        base_metadata["inventoryPublicPath"] = registry.get(
            "inventory_public_path",
            INVENTORY_BLUEPRINT_PUBLIC_PATH,
        )
        base_metadata["editorPublicPath"] = registry.get(
            "editor_public_path",
            EDITOR_BLUEPRINT_PUBLIC_PATH,
        )
    except Exception:
        base_metadata["routingInitialized"] = False
        base_metadata["routingLastUpdatedAt"] = None
        base_metadata["routingRegistrationAttemptedAt"] = None
        base_metadata["registeredBlueprintsSnapshot"] = []
        base_metadata["blueprintRegistrationEvents"] = []
        base_metadata["chunkProxyPublicPrefix"] = CHUNK_BLUEPRINT_PUBLIC_PREFIX
        base_metadata["inventoryPublicPath"] = INVENTORY_BLUEPRINT_PUBLIC_PATH
        base_metadata["editorPublicPath"] = EDITOR_BLUEPRINT_PUBLIC_PATH

    return base_metadata


def validate_registered_routes(app: Flask) -> dict[str, Any]:
    """
    Öffentliche Diagnosefunktion für Tests/Health.
    """
    try:
        _assert_required_routes_present(app)
        ok = True
        errors: list[str] = []
    except Exception as exc:
        ok = False
        errors = [_normalize_text(exc, "Routing-Validierung fehlgeschlagen.") or "Routing-Validierung fehlgeschlagen."]

    return {
        "ok": ok,
        "errors": errors,
        "presence": _collect_route_presence(app),
        "knownRules": _collect_known_rules(app),
        "knownEndpoints": _collect_known_endpoints(app),
    }


def clear_routes_module_caches() -> None:
    cache_clearers = (
        _candidate_missing_names,
        _import_module,
        get_blueprint_specs,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


__all__ = [
    "BlueprintSpec",
    "ROUTES_MODULE_NAME",
    "ROUTES_MODULE_VERSION",
    "HEALTH_BLUEPRINT_MODULE_NAME",
    "HEALTH_BLUEPRINT_ATTRIBUTE_NAME",
    "CHUNK_BLUEPRINT_MODULE_NAME",
    "CHUNK_BLUEPRINT_ATTRIBUTE_NAME",
    "CHUNK_BLUEPRINT_PUBLIC_PREFIX",
    "INVENTORY_BLUEPRINT_MODULE_NAME",
    "INVENTORY_BLUEPRINT_ATTRIBUTE_NAME",
    "INVENTORY_BLUEPRINT_URL_PREFIX",
    "INVENTORY_BLUEPRINT_PUBLIC_PATH",
    "REALTIME_BLUEPRINT_MODULE_NAME",
    "REALTIME_BLUEPRINT_ATTRIBUTE_NAME",
    "REALTIME_BLUEPRINT_PUBLIC_PATH",
    "EDITOR_BLUEPRINT_MODULE_NAME",
    "EDITOR_BLUEPRINT_ATTRIBUTE_NAME",
    "EDITOR_BLUEPRINT_PUBLIC_PATH",
    "register_blueprints",
    "get_registered_blueprint_names",
    "iter_blueprint_specs",
    "describe_blueprint_specs",
    "get_routes_module_metadata",
    "validate_registered_routes",
    "clear_routes_module_caches",
]