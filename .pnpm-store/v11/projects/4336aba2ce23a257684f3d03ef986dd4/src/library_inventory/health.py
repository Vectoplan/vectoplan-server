# services/vectoplan-editor/src/library_inventory/health.py
"""
Health- und Diagnosemodul für `src.library_inventory`.

Zweck:
- Verfügbarkeit der editorseitigen Library-Inventory-Adapter-Schicht prüfen
- Submodule `models`, `mapper`, `normalizer` robust diagnostizieren
- optional den serverseitigen `src.clients.library_client` prüfen
- optional einen Remote-Health-Check gegen `vectoplan-library` ausführen
- keine harte Laufzeitabhängigkeit beim Import erzeugen
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine direkte Chunk-/BlockWorld-Mutation
- keine Datenbanklogik

Import-Richtung:

    src.library_inventory.__init__
      -> src.library_inventory.health.get_library_inventory_health(...)

Diese Datei ist bewusst defensiv:
- fehlende Submodule führen zu `degraded`, nicht zu Import-Crash
- innere Importfehler werden sichtbar gemacht
- Health kann mit oder ohne Flask-App-Kontext laufen
- Remote-Health ist optional und standardmäßig aus
- Caches können für Tests/Dev-Reloads geleert werden

Wichtige Regel:
- `src.library_inventory` darf nie debug_grass/debug_dirt als fachlich
  placebare Items erzeugen.
- Placebare Items müssen aus `vectoplan-library` / VPLIB stammen.
"""

from __future__ import annotations

import dataclasses
import importlib
import inspect
import os
import platform
import sys
import time
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from datetime import UTC, datetime
from functools import lru_cache
from types import ModuleType
from typing import Any, Final


# -----------------------------------------------------------------------------
# Modulkonstanten
# -----------------------------------------------------------------------------

LIBRARY_INVENTORY_HEALTH_MODULE_NAME: Final[str] = "src.library_inventory.health"
LIBRARY_INVENTORY_HEALTH_MODULE_VERSION: Final[str] = "0.1.0"

LIBRARY_INVENTORY_PACKAGE_NAME: Final[str] = "src.library_inventory"
LIBRARY_INVENTORY_PACKAGE_VERSION: Final[str] = "0.1.0"

MODELS_MODULE_NAME: Final[str] = "src.library_inventory.models"
MAPPER_MODULE_NAME: Final[str] = "src.library_inventory.mapper"
NORMALIZER_MODULE_NAME: Final[str] = "src.library_inventory.normalizer"
LIBRARY_CLIENT_MODULE_NAME: Final[str] = "src.clients.library_client"

GET_MODELS_METADATA_FUNCTION_NAME: Final[str] = "get_library_inventory_models_metadata"
GET_MAPPER_METADATA_FUNCTION_NAME: Final[str] = "get_library_inventory_mapper_metadata"
GET_NORMALIZER_METADATA_FUNCTION_NAME: Final[str] = "get_library_inventory_normalizer_metadata"

CLEAR_MODELS_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_models_caches"
CLEAR_MAPPER_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_mapper_caches"
CLEAR_NORMALIZER_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_normalizer_caches"

GET_LIBRARY_CLIENT_METADATA_FUNCTION_NAME: Final[str] = "get_library_client_module_metadata"
GET_LIBRARY_CLIENT_HEALTH_FUNCTION_NAME: Final[str] = "get_library_client_health"
CLEAR_LIBRARY_CLIENT_CACHES_FUNCTION_NAME: Final[str] = "clear_library_client_caches"

NORMALIZE_LIBRARY_ITEM_FUNCTION_NAME: Final[str] = "normalize_library_item"
NORMALIZE_LIBRARY_SLOT_FUNCTION_NAME: Final[str] = "normalize_library_slot"
NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME: Final[str] = "normalize_library_inventory"
BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME: Final[str] = "build_editor_inventory_from_library"
MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "map_library_item_to_editor_slot"
BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "build_empty_editor_slot"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0

CONFIG_LIBRARY_BASE_URL_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_BASE_URL",
    "VECTOPLAN_LIBRARY_URL",
    "VECTOPLAN_LIBRARY_SERVICE_URL",
    "VECTOPLAN_EDITOR_LIBRARY_BASE_URL",
)

CONFIG_INVENTORY_SOURCE_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_EDITOR_INVENTORY_SOURCE",
    "VECTOPLAN_LIBRARY_INVENTORY_SOURCE",
)

CONFIG_ALLOW_CHUNK_FALLBACK_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK",
    "VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
)


# -----------------------------------------------------------------------------
# Dataclasses
# -----------------------------------------------------------------------------

@dataclasses.dataclass(frozen=True)
class HealthCheckResult:
    """
    Einheitliches Ergebnis eines Health-Teilchecks.
    """

    name: str
    ok: bool
    status: str
    required: bool = True
    duration_ms: float | None = None
    details: dict[str, Any] = dataclasses.field(default_factory=dict)
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "ok": self.ok,
            "status": self.status,
            "required": self.required,
            "durationMs": self.duration_ms,
            "details": to_json_compatible(self.details),
            "error": to_json_compatible(self.error),
        }


@dataclasses.dataclass(frozen=True)
class LibraryInventoryHealthPayload:
    """
    Root-Health-Payload für `src.library_inventory`.
    """

    ok: bool
    status: str
    generated_at_utc: str
    package_name: str
    package_version: str
    module_name: str
    module_version: str
    checks: list[HealthCheckResult] = dataclasses.field(default_factory=list)
    metadata: dict[str, Any] = dataclasses.field(default_factory=dict)
    config: dict[str, Any] = dataclasses.field(default_factory=dict)
    diagnostics: dict[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "status": self.status,
            "generatedAtUtc": self.generated_at_utc,
            "packageName": self.package_name,
            "packageVersion": self.package_version,
            "moduleName": self.module_name,
            "moduleVersion": self.module_version,
            "checks": [check.to_dict() for check in self.checks],
            "summary": build_health_summary(self.checks),
            "metadata": to_json_compatible(self.metadata),
            "config": to_json_compatible(self.config),
            "diagnostics": to_json_compatible(self.diagnostics),
        }


# -----------------------------------------------------------------------------
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

def normalize_text(value: Any, default: str | None = None) -> str | None:
    """
    Normalisiert beliebige Werte zu einem nicht-leeren String oder `default`.
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


def coerce_text(value: Any, default: str) -> str:
    """
    Erzwingt einen String mit Fallback.
    """
    normalized = normalize_text(value, default)
    return normalized if normalized is not None else default


def coerce_bool(value: Any, default: bool = False) -> bool:
    """
    Wandelt typische Werte robust in bool.
    """
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


def coerce_int(
    value: Any,
    default: int,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    """
    Wandelt Werte robust in Integer und begrenzt optional.
    """
    try:
        if isinstance(value, bool):
            result = int(value)
        elif isinstance(value, int):
            result = value
        elif isinstance(value, float):
            result = int(value)
        elif isinstance(value, str):
            stripped = value.strip()
            result = int(float(stripped)) if stripped else default
        else:
            result = int(value)
    except Exception:
        result = default

    if minimum is not None and result < minimum:
        return minimum

    if maximum is not None and result > maximum:
        return maximum

    return result


def safe_utc_timestamp() -> str:
    """
    Liefert robust einen UTC-ISO-Zeitstempel.
    """
    try:
        return datetime.now(UTC).isoformat()
    except Exception:
        try:
            return datetime.utcnow().isoformat() + "Z"
        except Exception:
            return "1970-01-01T00:00:00Z"


def monotonic_ms() -> float:
    """
    Liefert monotone Zeit in Millisekunden.
    """
    try:
        return time.monotonic() * 1000.0
    except Exception:
        return time.time() * 1000.0


def safe_mapping(value: Any) -> dict[str, Any]:
    """
    Wandelt Mapping-artige Werte robust in dict.
    """
    if isinstance(value, dict):
        return value

    if isinstance(value, Mapping):
        try:
            return dict(value)
        except Exception:
            return {}

    return {}


def safe_sequence(value: Any) -> list[Any]:
    """
    Wandelt Sequenzen robust in list.
    """
    if isinstance(value, list):
        return value

    if isinstance(value, tuple):
        return list(value)

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        try:
            return list(value)
        except Exception:
            return []

    return []


def to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    """
    Wandelt Python-Objekte defensiv in JSON-kompatible Strukturen um.
    """
    if depth > 32:
        return normalize_text(value, "<max-depth>")

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if dataclasses.is_dataclass(value):
        try:
            return to_json_compatible(dataclasses.asdict(value), depth=depth + 1)
        except Exception:
            return normalize_text(value)

    if isinstance(value, Mapping):
        result: dict[str, Any] = {}

        for key, item in value.items():
            safe_key = coerce_text(key, "unknown")
            result[safe_key] = to_json_compatible(item, depth=depth + 1)

        return result

    if isinstance(value, set):
        try:
            return [to_json_compatible(item, depth=depth + 1) for item in sorted(value)]
        except Exception:
            return [to_json_compatible(item, depth=depth + 1) for item in value]

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [to_json_compatible(item, depth=depth + 1) for item in value]

    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8")
        except Exception:
            return "<bytes>"

    if isinstance(value, BaseException):
        return exception_payload(value)

    return normalize_text(value)


def exception_payload(error: Any) -> dict[str, Any] | None:
    """
    Wandelt Fehlerdaten robust in JSON-kompatible Diagnoseform.
    """
    if error is None:
        return None

    if isinstance(error, BaseException):
        return {
            "type": error.__class__.__name__,
            "message": coerce_text(error, "Unbekannter Fehler."),
        }

    if isinstance(error, str):
        return {
            "type": "Error",
            "message": error,
        }

    return {
        "type": "Error",
        "message": coerce_text(error, "Unbekannter Fehler."),
        "detail": to_json_compatible(error),
    }


def read_mapping_any(
    mapping: Mapping[str, Any] | MutableMapping[str, Any] | None,
    keys: Sequence[str],
    default: Any = None,
) -> Any:
    """
    Liest den ersten vorhandenen nicht-None-Wert aus einem Mapping.
    """
    if not isinstance(mapping, Mapping):
        return default

    for key in keys:
        try:
            if key in mapping:
                value = mapping.get(key)
                if value is not None:
                    return value
        except Exception:
            continue

    return default


def read_config_value(config_source: Any, *keys: str, default: Any = None) -> Any:
    """
    Liest den ersten gesetzten Wert aus Flask-Config, Mapping oder Environment.
    """
    for key in keys:
        clean_key = normalize_text(key)
        if not clean_key:
            continue

        try:
            if hasattr(config_source, "get"):
                value = config_source.get(clean_key, None)
                if value is not None:
                    return value
        except Exception:
            pass

        try:
            if isinstance(config_source, Mapping) and clean_key in config_source:
                value = config_source[clean_key]
                if value is not None:
                    return value
        except Exception:
            pass

        try:
            value = os.environ.get(clean_key)
            if value is not None:
                return value
        except Exception:
            pass

    return default


def safe_get_flask_config() -> Mapping[str, Any] | None:
    """
    Liefert Flask current_app.config, falls ein App-Kontext existiert.
    """
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            return current_app.config
    except Exception:
        return None

    return None


def safe_get_flask_logger() -> Any | None:
    """
    Liefert Flask current_app.logger, falls verfügbar.
    """
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            return current_app.logger
    except Exception:
        return None

    return None


def log_debug(message: str, *args: Any) -> None:
    logger = safe_get_flask_logger()
    if logger is None:
        return

    try:
        logger.debug(message, *args)
    except Exception:
        pass


def log_warning(message: str, *args: Any) -> None:
    logger = safe_get_flask_logger()
    if logger is None:
        return

    try:
        logger.warning(message, *args)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Lazy Import / Modulauflösung
# -----------------------------------------------------------------------------

@lru_cache(maxsize=64)
def candidate_missing_names(module_name: str) -> tuple[str, ...]:
    """
    Liefert alle zulässigen `ModuleNotFoundError.name`-Werte für einen Modulpfad.
    """
    normalized_module_name = normalize_text(module_name, "")
    if not normalized_module_name:
        return ()

    parts = normalized_module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def is_missing_target_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    """
    Prüft, ob ein ModuleNotFoundError das Zielmodul selbst betrifft.
    """
    missing_name = normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in candidate_missing_names(module_name)


@lru_cache(maxsize=16)
def load_optional_module(module_name: str) -> ModuleType | None:
    """
    Lädt ein optionales Modul lazy und gecacht.

    Verhalten:
    - Zielmodul fehlt -> None
    - innere Abhängigkeit fehlt -> RuntimeError
    - sonst -> Modul
    """
    normalized_module_name = coerce_text(module_name, "")
    if not normalized_module_name:
        return None

    try:
        return importlib.import_module(normalized_module_name)
    except ModuleNotFoundError as exc:
        if is_missing_target_module(exc, normalized_module_name):
            return None

        raise RuntimeError(
            f"Das Modul `{normalized_module_name}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Modul `{normalized_module_name}` konnte nicht importiert werden."
        ) from exc


def safe_get_callable(module: ModuleType | None, attribute_name: str) -> Callable[..., Any] | None:
    """
    Liest ein Attribut aus einem Modul und gibt es nur zurück, wenn es callable ist.
    """
    if module is None:
        return None

    try:
        candidate = getattr(module, attribute_name, None)
    except Exception:
        return None

    return candidate if callable(candidate) else None


def safe_get_attribute(module: ModuleType | None, attribute_name: str) -> Any:
    """
    Liest ein Attribut aus einem Modul.
    """
    if module is None:
        return None

    try:
        return getattr(module, attribute_name, None)
    except Exception:
        return None


@lru_cache(maxsize=1)
def resolve_health_api() -> dict[str, Any]:
    """
    Löst alle für Health relevanten optionalen Module und Funktionen auf.
    """
    models_module = load_optional_module(MODELS_MODULE_NAME)
    mapper_module = load_optional_module(MAPPER_MODULE_NAME)
    normalizer_module = load_optional_module(NORMALIZER_MODULE_NAME)
    library_client_module = load_optional_module(LIBRARY_CLIENT_MODULE_NAME)

    return {
        "models_module_available": models_module is not None,
        "mapper_module_available": mapper_module is not None,
        "normalizer_module_available": normalizer_module is not None,
        "library_client_module_available": library_client_module is not None,
        "models_module": models_module,
        "mapper_module": mapper_module,
        "normalizer_module": normalizer_module,
        "library_client_module": library_client_module,
        "models_metadata_getter": safe_get_callable(models_module, GET_MODELS_METADATA_FUNCTION_NAME),
        "mapper_metadata_getter": safe_get_callable(mapper_module, GET_MAPPER_METADATA_FUNCTION_NAME),
        "normalizer_metadata_getter": safe_get_callable(normalizer_module, GET_NORMALIZER_METADATA_FUNCTION_NAME),
        "library_client_metadata_getter": safe_get_callable(library_client_module, GET_LIBRARY_CLIENT_METADATA_FUNCTION_NAME),
        "library_client_health_getter": safe_get_callable(library_client_module, GET_LIBRARY_CLIENT_HEALTH_FUNCTION_NAME),
        "models_cache_clearer": safe_get_callable(models_module, CLEAR_MODELS_CACHES_FUNCTION_NAME),
        "mapper_cache_clearer": safe_get_callable(mapper_module, CLEAR_MAPPER_CACHES_FUNCTION_NAME),
        "normalizer_cache_clearer": safe_get_callable(normalizer_module, CLEAR_NORMALIZER_CACHES_FUNCTION_NAME),
        "library_client_cache_clearer": safe_get_callable(library_client_module, CLEAR_LIBRARY_CLIENT_CACHES_FUNCTION_NAME),
        "normalize_library_item": safe_get_callable(normalizer_module, NORMALIZE_LIBRARY_ITEM_FUNCTION_NAME),
        "normalize_library_slot": safe_get_callable(normalizer_module, NORMALIZE_LIBRARY_SLOT_FUNCTION_NAME),
        "normalize_library_inventory": safe_get_callable(normalizer_module, NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME),
        "build_editor_inventory_from_library": safe_get_callable(normalizer_module, BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME),
        "map_library_item_to_editor_slot": safe_get_callable(mapper_module, MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME),
        "build_empty_editor_slot": safe_get_callable(mapper_module, BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME),
    }


def call_with_supported_kwargs(
    callback: Callable[..., Any],
    kwargs: Mapping[str, Any],
) -> Any:
    """
    Ruft eine Funktion mit den Keyword-Argumenten auf, die sie unterstützt.
    """
    kwargs_dict = dict(kwargs)

    try:
        signature = inspect.signature(callback)
    except Exception:
        try:
            return callback(**kwargs_dict)
        except TypeError:
            return callback()

    parameters = signature.parameters
    accepts_var_kwargs = any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in parameters.values()
    )

    if accepts_var_kwargs:
        return callback(**kwargs_dict)

    supported_kwargs: dict[str, Any] = {}

    for name, parameter in parameters.items():
        if parameter.kind in {
            inspect.Parameter.KEYWORD_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        } and name in kwargs_dict:
            supported_kwargs[name] = kwargs_dict[name]

    return callback(**supported_kwargs)


def safe_call_getter(
    callback: Callable[..., Any] | None,
    *,
    kwargs: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """
    Ruft einen Metadaten-/Health-Getter defensiv auf.
    """
    if not callable(callback):
        return None

    try:
        value = call_with_supported_kwargs(callback, kwargs or {})
        if isinstance(value, dict):
            return value
        if isinstance(value, Mapping):
            return dict(value)

        converted = to_json_compatible(value)
        if isinstance(converted, dict):
            return converted

        return {"value": converted}
    except Exception as exc:
        return {"error": exception_payload(exc)}


# -----------------------------------------------------------------------------
# Config / Environment
# -----------------------------------------------------------------------------

def build_config_snapshot(config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None) -> dict[str, Any]:
    """
    Baut eine kleine Konfigurationsdiagnose ohne sensitive Werte.
    """
    source = config_source if config_source is not None else safe_get_flask_config()

    library_base_url = normalize_text(
        read_config_value(source, *CONFIG_LIBRARY_BASE_URL_KEYS, default=None)
    )
    inventory_source = normalize_text(
        read_config_value(source, *CONFIG_INVENTORY_SOURCE_KEYS, default="library"),
        "library",
    )
    allow_chunk_fallback = coerce_bool(
        read_config_value(source, *CONFIG_ALLOW_CHUNK_FALLBACK_KEYS, default=False),
        False,
    )

    return {
        "libraryBaseUrlConfigured": bool(library_base_url),
        "libraryBaseUrl": library_base_url,
        "inventorySource": inventory_source,
        "allowChunkPlaceableFallback": allow_chunk_fallback,
        "expectedHotbarSize": DEFAULT_HOTBAR_SIZE,
        "expectedSelectedSlot": DEFAULT_SELECTED_SLOT,
        "rules": {
            "onlyLibraryItemsPlaceable": True,
            "debugGrassDirtAllowed": False,
            "fallbackAllowsPlace": False,
        },
    }


def build_environment_snapshot() -> dict[str, Any]:
    """
    Liefert kleine Laufzeitdiagnose ohne sensitive Werte.
    """
    return {
        "pythonVersion": sys.version.split()[0] if sys.version else None,
        "platform": platform.platform(),
        "implementation": platform.python_implementation(),
        "module": __name__,
        "package": __package__,
    }


# -----------------------------------------------------------------------------
# Checks
# -----------------------------------------------------------------------------

def timed_check(
    name: str,
    callback: Callable[[], HealthCheckResult],
) -> HealthCheckResult:
    """
    Führt einen Check mit Laufzeitmessung aus.
    """
    started = monotonic_ms()

    try:
        result = callback()
        duration = monotonic_ms() - started
        return dataclasses.replace(result, duration_ms=duration)
    except Exception as exc:
        duration = monotonic_ms() - started
        return HealthCheckResult(
            name=name,
            ok=False,
            status="error",
            required=True,
            duration_ms=duration,
            error=exception_payload(exc),
        )


def check_module_available(
    *,
    name: str,
    module_name: str,
    required: bool,
) -> HealthCheckResult:
    """
    Prüft Importierbarkeit eines Moduls.
    """
    started = monotonic_ms()

    try:
        module = load_optional_module(module_name)
        duration = monotonic_ms() - started

        if module is None:
            return HealthCheckResult(
                name=name,
                ok=not required,
                status="missing" if required else "missing-optional",
                required=required,
                duration_ms=duration,
                details={
                    "moduleName": module_name,
                    "available": False,
                },
            )

        return HealthCheckResult(
            name=name,
            ok=True,
            status="ok",
            required=required,
            duration_ms=duration,
            details={
                "moduleName": module_name,
                "available": True,
                "file": normalize_text(getattr(module, "__file__", None)),
            },
        )
    except Exception as exc:
        duration = monotonic_ms() - started
        return HealthCheckResult(
            name=name,
            ok=False,
            status="error",
            required=required,
            duration_ms=duration,
            details={
                "moduleName": module_name,
            },
            error=exception_payload(exc),
        )


def check_required_functions() -> HealthCheckResult:
    """
    Prüft, ob die Kernfunktionen in Normalizer/Mapper vorhanden sind.
    """
    started = monotonic_ms()

    try:
        api = resolve_health_api()

        required = {
            "normalize_library_inventory": callable(api.get("normalize_library_inventory")),
            "build_editor_inventory_from_library": callable(api.get("build_editor_inventory_from_library")),
            "map_library_item_to_editor_slot": callable(api.get("map_library_item_to_editor_slot")),
            "build_empty_editor_slot": callable(api.get("build_empty_editor_slot")),
        }

        missing = [name for name, available in required.items() if not available]
        duration = monotonic_ms() - started

        return HealthCheckResult(
            name="required-functions",
            ok=not missing,
            status="ok" if not missing else "missing-functions",
            required=True,
            duration_ms=duration,
            details={
                "functions": required,
                "missing": missing,
            },
        )
    except Exception as exc:
        duration = monotonic_ms() - started
        return HealthCheckResult(
            name="required-functions",
            ok=False,
            status="error",
            required=True,
            duration_ms=duration,
            error=exception_payload(exc),
        )


def check_model_self_test() -> HealthCheckResult:
    """
    Prüft eine minimale Modell-/Mapping-Erzeugung ohne Remote-HTTP.
    """
    started = monotonic_ms()

    sample_item = {
        "family_id": "vp.health.sample.block",
        "package_id": "vplib.vp.health.sample.block",
        "vplib_uid": "00000000-0000-4000-8000-000000000001",
        "variant_id": "default",
        "label": "Health Sample Block",
        "object_kind": "cell_block",
        "domain": "health",
        "category": "diagnostics",
        "subcategory": "sample",
        "revision_hash": "health-revision",
    }

    try:
        api = resolve_health_api()
        mapper = api.get("map_library_item_to_editor_slot")
        normalizer = api.get("normalize_library_inventory")

        slot: Any = None

        if callable(mapper):
            slot = call_with_supported_kwargs(
                mapper,
                {
                    "record": sample_item,
                    "item": sample_item,
                    "slot_index": 0,
                    "slotIndex": 0,
                    "selected_slot": 0,
                    "selectedSlot": 0,
                    "hotbar_size": DEFAULT_HOTBAR_SIZE,
                    "hotbarSize": DEFAULT_HOTBAR_SIZE,
                    "icon_only": False,
                    "iconOnly": False,
                },
            )

        slot_dict = safe_mapping(slot)

        inventory: Any = None
        if callable(normalizer):
            inventory = call_with_supported_kwargs(
                normalizer,
                {
                    "raw_items": [sample_item],
                    "rawItems": [sample_item],
                    "hotbar_size": DEFAULT_HOTBAR_SIZE,
                    "hotbarSize": DEFAULT_HOTBAR_SIZE,
                    "selected_slot": 0,
                    "selectedSlot": 0,
                    "icon_only": False,
                    "iconOnly": False,
                },
            )

        inventory_dict = safe_mapping(inventory)
        duration = monotonic_ms() - started

        slot_placeable = coerce_bool(slot_dict.get("placeable"), False)
        inventory_ok = coerce_bool(inventory_dict.get("ok"), False)
        inventory_slots = safe_sequence(safe_mapping(inventory_dict.get("inventory")).get("slots"))

        ok = slot_placeable and inventory_ok and bool(inventory_slots)

        return HealthCheckResult(
            name="model-self-test",
            ok=ok,
            status="ok" if ok else "failed",
            required=True,
            duration_ms=duration,
            details={
                "slotPlaceable": slot_placeable,
                "inventoryOk": inventory_ok,
                "inventorySlotCount": len(inventory_slots),
                "sampleFamilyId": sample_item["family_id"],
                "debugGrassDirtGenerated": _contains_debug_grass_dirt(inventory_dict),
            },
        )
    except Exception as exc:
        duration = monotonic_ms() - started
        return HealthCheckResult(
            name="model-self-test",
            ok=False,
            status="error",
            required=True,
            duration_ms=duration,
            error=exception_payload(exc),
        )


def check_library_client_available() -> HealthCheckResult:
    """
    Prüft die lokale Verfügbarkeit des serverseitigen Library-Clients.
    """
    started = monotonic_ms()

    try:
        api = resolve_health_api()
        available = coerce_bool(api.get("library_client_module_available"), False)
        metadata = safe_call_getter(api.get("library_client_metadata_getter"))
        duration = monotonic_ms() - started

        return HealthCheckResult(
            name="library-client",
            ok=available,
            status="ok" if available else "missing",
            required=True,
            duration_ms=duration,
            details={
                "moduleName": LIBRARY_CLIENT_MODULE_NAME,
                "available": available,
                "metadata": metadata,
            },
        )
    except Exception as exc:
        duration = monotonic_ms() - started
        return HealthCheckResult(
            name="library-client",
            ok=False,
            status="error",
            required=True,
            duration_ms=duration,
            error=exception_payload(exc),
        )


def check_remote_library_health(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    force_refresh: bool = False,
) -> HealthCheckResult:
    """
    Führt optional einen Remote-Health-Check über `src.clients.library_client` aus.
    """
    started = monotonic_ms()

    try:
        api = resolve_health_api()
        health_getter = api.get("library_client_health_getter")

        if not callable(health_getter):
            duration = monotonic_ms() - started
            return HealthCheckResult(
                name="remote-library",
                ok=False,
                status="library-client-health-missing",
                required=False,
                duration_ms=duration,
                details={
                    "moduleName": LIBRARY_CLIENT_MODULE_NAME,
                },
            )

        health = call_with_supported_kwargs(
            health_getter,
            {
                "config_source": config_source,
                "include_remote": True,
                "force_refresh": force_refresh,
            },
        )

        health_mapping = safe_mapping(health)
        ok = coerce_bool(health_mapping.get("ok"), False)
        duration = monotonic_ms() - started

        return HealthCheckResult(
            name="remote-library",
            ok=ok,
            status="ok" if ok else coerce_text(health_mapping.get("status"), "remote-unavailable"),
            required=False,
            duration_ms=duration,
            details={
                "health": to_json_compatible(health_mapping),
            },
        )
    except Exception as exc:
        duration = monotonic_ms() - started
        return HealthCheckResult(
            name="remote-library",
            ok=False,
            status="error",
            required=False,
            duration_ms=duration,
            error=exception_payload(exc),
        )


def _contains_debug_grass_dirt(value: Any) -> bool:
    """
    Prüft, ob versehentlich debug_grass/debug_dirt in einer Payload auftaucht.
    """
    text = ""
    try:
        text = str(to_json_compatible(value))
    except Exception:
        text = str(value)

    return "debug_grass" in text or "debug_dirt" in text


# -----------------------------------------------------------------------------
# Health Summary
# -----------------------------------------------------------------------------

def build_health_summary(checks: Sequence[HealthCheckResult]) -> dict[str, Any]:
    """
    Baut eine kompakte Summary über alle Checks.
    """
    all_checks = list(checks)
    required_checks = [check for check in all_checks if check.required]
    optional_checks = [check for check in all_checks if not check.required]

    failed_required = [check.name for check in required_checks if not check.ok]
    failed_optional = [check.name for check in optional_checks if not check.ok]

    return {
        "total": len(all_checks),
        "required": len(required_checks),
        "optional": len(optional_checks),
        "passed": sum(1 for check in all_checks if check.ok),
        "failed": sum(1 for check in all_checks if not check.ok),
        "failedRequired": failed_required,
        "failedOptional": failed_optional,
        "ok": not failed_required,
    }


def determine_status(checks: Sequence[HealthCheckResult]) -> str:
    """
    Bestimmt Status aus Checks.
    """
    summary = build_health_summary(checks)

    if summary["failedRequired"]:
        return "error"

    if summary["failedOptional"]:
        return "degraded"

    return "ok"


# -----------------------------------------------------------------------------
# Metadaten
# -----------------------------------------------------------------------------

def build_metadata(
    *,
    include_submodule_metadata: bool = True,
) -> dict[str, Any]:
    """
    Baut Metadaten der Health-Schicht und optional der Submodule.
    """
    metadata: dict[str, Any] = {
        "packageName": LIBRARY_INVENTORY_PACKAGE_NAME,
        "packageVersion": LIBRARY_INVENTORY_PACKAGE_VERSION,
        "moduleName": LIBRARY_INVENTORY_HEALTH_MODULE_NAME,
        "moduleVersion": LIBRARY_INVENTORY_HEALTH_MODULE_VERSION,
        "generatedAtUtc": safe_utc_timestamp(),
        "modules": {
            "models": MODELS_MODULE_NAME,
            "mapper": MAPPER_MODULE_NAME,
            "normalizer": NORMALIZER_MODULE_NAME,
            "libraryClient": LIBRARY_CLIENT_MODULE_NAME,
        },
        "rules": {
            "onlyLibraryItemsPlaceable": True,
            "debugGrassDirtGenerated": False,
            "fallbackContainsNoPlaceableItems": True,
            "browserShouldUseEditorApiInventory": True,
            "browserShouldNotCallVectoplanLibraryDirectly": True,
            "runtimeBlockTypeIdIsTemporaryAdapter": True,
        },
    }

    if not include_submodule_metadata:
        return metadata

    try:
        api = resolve_health_api()
    except Exception as exc:
        metadata["submoduleResolutionError"] = exception_payload(exc)
        return metadata

    metadata["submodules"] = {
        "models": safe_call_getter(api.get("models_metadata_getter")),
        "mapper": safe_call_getter(api.get("mapper_metadata_getter")),
        "normalizer": safe_call_getter(api.get("normalizer_metadata_getter")),
        "libraryClient": safe_call_getter(api.get("library_client_metadata_getter")),
    }

    return metadata


# -----------------------------------------------------------------------------
# Öffentliche Health-API
# -----------------------------------------------------------------------------

def get_library_inventory_health(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    include_remote: bool = False,
    force_refresh: bool = False,
    include_submodule_metadata: bool = True,
    include_self_test: bool = True,
) -> dict[str, Any]:
    """
    Liefert Health-Diagnose für `src.library_inventory`.

    Parameter:
    - `include_remote`: führt zusätzlich Remote-Health gegen `vectoplan-library` aus
    - `force_refresh`: wird an den Library-Client-Health weitergereicht
    - `include_submodule_metadata`: liest Metadata aus models/mapper/normalizer
    - `include_self_test`: testet Mapping/Normalisierung mit synthetischem VPLIB-Item
    """
    checks: list[HealthCheckResult] = []

    checks.append(
        check_module_available(
            name="models-module",
            module_name=MODELS_MODULE_NAME,
            required=True,
        )
    )
    checks.append(
        check_module_available(
            name="mapper-module",
            module_name=MAPPER_MODULE_NAME,
            required=True,
        )
    )
    checks.append(
        check_module_available(
            name="normalizer-module",
            module_name=NORMALIZER_MODULE_NAME,
            required=True,
        )
    )
    checks.append(check_required_functions())
    checks.append(check_library_client_available())

    if include_self_test:
        checks.append(check_model_self_test())

    if include_remote:
        checks.append(
            check_remote_library_health(
                config_source=config_source,
                force_refresh=force_refresh,
            )
        )

    status = determine_status(checks)
    ok = status in {"ok", "degraded"}

    payload = LibraryInventoryHealthPayload(
        ok=ok,
        status=status,
        generated_at_utc=safe_utc_timestamp(),
        package_name=LIBRARY_INVENTORY_PACKAGE_NAME,
        package_version=LIBRARY_INVENTORY_PACKAGE_VERSION,
        module_name=LIBRARY_INVENTORY_HEALTH_MODULE_NAME,
        module_version=LIBRARY_INVENTORY_HEALTH_MODULE_VERSION,
        checks=checks,
        metadata=build_metadata(include_submodule_metadata=include_submodule_metadata),
        config=build_config_snapshot(config_source),
        diagnostics={
            "environment": build_environment_snapshot(),
            "remoteIncluded": include_remote,
            "selfTestIncluded": include_self_test,
            "forceRefresh": force_refresh,
        },
    )

    return payload.to_dict()


def get_library_inventory_health_metadata() -> dict[str, Any]:
    """
    Liefert reine Health-Modul-Metadaten.
    """
    return {
        "moduleName": LIBRARY_INVENTORY_HEALTH_MODULE_NAME,
        "moduleVersion": LIBRARY_INVENTORY_HEALTH_MODULE_VERSION,
        "packageName": LIBRARY_INVENTORY_PACKAGE_NAME,
        "packageVersion": LIBRARY_INVENTORY_PACKAGE_VERSION,
        "generatedAtUtc": safe_utc_timestamp(),
        "checks": [
            "models-module",
            "mapper-module",
            "normalizer-module",
            "required-functions",
            "library-client",
            "model-self-test",
            "remote-library",
        ],
        "defaults": {
            "hotbarSize": DEFAULT_HOTBAR_SIZE,
            "selectedSlot": DEFAULT_SELECTED_SLOT,
        },
    }


def clear_library_inventory_health_caches() -> None:
    """
    Löscht Health-Caches und, falls verfügbar, Submodul-Caches.
    """
    try:
        api = resolve_health_api()
    except Exception:
        api = {}

    for key in (
        "models_cache_clearer",
        "mapper_cache_clearer",
        "normalizer_cache_clearer",
        "library_client_cache_clearer",
    ):
        cache_clearer = api.get(key)
        if callable(cache_clearer):
            try:
                cache_clearer()
            except Exception:
                pass

    cache_clearers = (
        candidate_missing_names,
        load_optional_module,
        resolve_health_api,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


# -----------------------------------------------------------------------------
# Alias-Funktionen
# -----------------------------------------------------------------------------

def get_health(**kwargs: Any) -> dict[str, Any]:
    """
    Alias für generische Aufrufer.
    """
    return get_library_inventory_health(**kwargs)


def clear_caches() -> None:
    """
    Alias für generische Aufrufer.
    """
    clear_library_inventory_health_caches()


# -----------------------------------------------------------------------------
# Öffentliche Exporte
# -----------------------------------------------------------------------------

__all__ = [
    "LIBRARY_INVENTORY_HEALTH_MODULE_NAME",
    "LIBRARY_INVENTORY_HEALTH_MODULE_VERSION",
    "LIBRARY_INVENTORY_PACKAGE_NAME",
    "LIBRARY_INVENTORY_PACKAGE_VERSION",
    "MODELS_MODULE_NAME",
    "MAPPER_MODULE_NAME",
    "NORMALIZER_MODULE_NAME",
    "LIBRARY_CLIENT_MODULE_NAME",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "HealthCheckResult",
    "LibraryInventoryHealthPayload",
    "get_library_inventory_health",
    "get_library_inventory_health_metadata",
    "clear_library_inventory_health_caches",
    "get_health",
    "clear_caches",
]