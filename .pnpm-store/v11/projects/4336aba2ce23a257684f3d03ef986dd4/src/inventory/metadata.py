# services/vectoplan-editor/src/inventory/metadata.py
"""
Metadaten- und Diagnosemodul für das serverseitige Editor-Inventar.

Zweck:
- zentrale Diagnoseinformationen für `src.inventory` bereitstellen
- verfügbare Inventar-Submodule robust erkennen
- Library-Client-Status sichtbar machen
- Route-/Payload-/Fallback-Fähigkeiten maschinenlesbar dokumentieren
- Cache-Clear für Entwicklungsreloads und Tests bereitstellen

Import-Richtung:

    src.inventory.__init__
      -> src.inventory.metadata.get_editor_inventory_package_metadata(...)

Diese Datei enthält bewusst:
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine direkte Chunk-/BlockWorld-Mutation
- keine DB-Logik
- keine produktiven Inventaritems

Öffentliche Funktionen:
- get_editor_inventory_metadata()
- get_editor_inventory_package_metadata()
- get_editor_inventory_metadata_health()
- clear_editor_inventory_metadata_caches()

Grundregel:
- Dieses Modul darf fehlende Submodule nicht hart crashen lassen.
- Diagnose soll auch dann funktionieren, wenn `payload.py`, `fallback.py`
  oder `src.clients.library_client` temporär fehlen.
"""

from __future__ import annotations

import dataclasses
import importlib
import os
import platform
import sys
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from datetime import UTC, datetime
from functools import lru_cache
from types import ModuleType
from typing import Any, Final


# -----------------------------------------------------------------------------
# Modulkonstanten
# -----------------------------------------------------------------------------

INVENTORY_METADATA_MODULE_NAME: Final[str] = "src.inventory.metadata"
INVENTORY_METADATA_MODULE_VERSION: Final[str] = "0.1.0"

INVENTORY_PACKAGE_NAME: Final[str] = "src.inventory"
INVENTORY_PACKAGE_VERSION: Final[str] = "0.2.0"

INVENTORY_PAYLOAD_MODULE_NAME: Final[str] = "src.inventory.payload"
INVENTORY_FALLBACK_MODULE_NAME: Final[str] = "src.inventory.fallback"
LIBRARY_CLIENT_MODULE_NAME: Final[str] = "src.clients.library_client"

INVENTORY_KIND: Final[str] = "editor-inventory"
INVENTORY_SCHEMA_VERSION: Final[str] = "editor-inventory.v1"

DEFAULT_ROUTE_PATH: Final[str] = "/editor/api/inventory"
DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0

GET_PAYLOAD_METADATA_FUNCTION_NAME: Final[str] = "get_editor_inventory_payload_metadata"
GET_FALLBACK_METADATA_FUNCTION_NAME: Final[str] = "get_editor_inventory_fallback_metadata"
GET_LIBRARY_CLIENT_METADATA_FUNCTION_NAME: Final[str] = "get_library_client_module_metadata"
GET_LIBRARY_CLIENT_HEALTH_FUNCTION_NAME: Final[str] = "get_library_client_health"

CLEAR_PAYLOAD_CACHES_FUNCTION_NAME: Final[str] = "clear_editor_inventory_payload_caches"
CLEAR_FALLBACK_CACHES_FUNCTION_NAME: Final[str] = "clear_editor_inventory_fallback_caches"
CLEAR_LIBRARY_CLIENT_CACHES_FUNCTION_NAME: Final[str] = "clear_library_client_caches"

CONFIG_LIBRARY_BASE_URL_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_BASE_URL",
    "VECTOPLAN_LIBRARY_URL",
    "VECTOPLAN_LIBRARY_SERVICE_URL",
    "VECTOPLAN_EDITOR_LIBRARY_BASE_URL",
)

CONFIG_LIBRARY_API_PREFIX_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_API_PREFIX",
    "VECTOPLAN_EDITOR_LIBRARY_API_PREFIX",
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
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

def _normalize_text(value: Any, default: str | None = None) -> str | None:
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


def _coerce_text(value: Any, default: str) -> str:
    """
    Erzwingt einen String mit Fallback.
    """
    normalized = _normalize_text(value, default)
    return normalized if normalized is not None else default


def _coerce_bool(value: Any, default: bool = False) -> bool:
    """
    Wandelt typische Werte robust in bool um.
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


def _safe_utc_timestamp() -> str:
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


def _to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    """
    Wandelt typische Python-Objekte defensiv in JSON-kompatible Strukturen um.
    """
    if depth > 24:
        return _normalize_text(value, "<max-depth>")

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if dataclasses.is_dataclass(value):
        try:
            return _to_json_compatible(dataclasses.asdict(value), depth=depth + 1)
        except Exception:
            return _normalize_text(value)

    if isinstance(value, Mapping):
        result: dict[str, Any] = {}

        for key, item in value.items():
            safe_key = _coerce_text(key, "unknown")
            result[safe_key] = _to_json_compatible(item, depth=depth + 1)

        return result

    if isinstance(value, set):
        try:
            return [_to_json_compatible(item, depth=depth + 1) for item in sorted(value)]
        except Exception:
            return [_to_json_compatible(item, depth=depth + 1) for item in value]

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_to_json_compatible(item, depth=depth + 1) for item in value]

    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8")
        except Exception:
            return "<bytes>"

    if isinstance(value, BaseException):
        return {
            "type": value.__class__.__name__,
            "message": _coerce_text(value, "Unbekannter Fehler."),
        }

    return _normalize_text(value)


def _exception_payload(error: Any) -> Any:
    """
    Wandelt Fehlerdaten robust in JSON-kompatible Diagnoseform um.
    """
    if error is None:
        return None

    if isinstance(error, BaseException):
        return {
            "type": error.__class__.__name__,
            "message": _coerce_text(error, "Unbekannter Fehler."),
        }

    if isinstance(error, str):
        return {
            "type": "Error",
            "message": error,
        }

    return _to_json_compatible(error)


def _safe_mapping(value: Any) -> dict[str, Any]:
    """
    Wandelt Mapping-artige Werte robust in ein Dictionary um.
    """
    if isinstance(value, dict):
        return value

    if isinstance(value, Mapping):
        try:
            return dict(value)
        except Exception:
            return {}

    return {}


def _read_mapping_any(
    mapping: Mapping[str, Any] | MutableMapping[str, Any] | None,
    keys: Sequence[str],
    default: Any = None,
) -> Any:
    """
    Liest den ersten vorhandenen Wert aus einem Mapping.
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


def _read_config_value(config_source: Any, *keys: str, default: Any = None) -> Any:
    """
    Liest den ersten gesetzten Wert aus Flask-Config, Mapping oder Environment.
    """
    for key in keys:
        clean_key = _normalize_text(key)
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


def _safe_get_flask_config() -> Mapping[str, Any] | None:
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


# -----------------------------------------------------------------------------
# Lazy Import / Modulauflösung
# -----------------------------------------------------------------------------

@lru_cache(maxsize=64)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    """
    Liefert alle zulässigen `ModuleNotFoundError.name`-Werte für einen Modulpfad.
    """
    normalized_module_name = _normalize_text(module_name, "")
    if not normalized_module_name:
        return ()

    parts = normalized_module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_target_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    """
    Prüft, ob ein ModuleNotFoundError das Zielmodul selbst betrifft.
    """
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=16)
def _load_optional_module(module_name: str) -> ModuleType | None:
    """
    Lädt ein optionales Modul lazy und gecacht.

    Verhalten:
    - Zielmodul fehlt -> None
    - innere Abhängigkeit fehlt -> RuntimeError
    - sonst -> Modul
    """
    normalized_module_name = _coerce_text(module_name, "")
    if not normalized_module_name:
        return None

    try:
        return importlib.import_module(normalized_module_name)
    except ModuleNotFoundError as exc:
        if _is_missing_target_module(exc, normalized_module_name):
            return None

        raise RuntimeError(
            f"Das Modul `{normalized_module_name}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Modul `{normalized_module_name}` konnte nicht importiert werden."
        ) from exc


def _safe_get_callable(module: ModuleType | None, attribute_name: str) -> Callable[..., Any] | None:
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


@lru_cache(maxsize=1)
def _resolve_metadata_api() -> dict[str, Any]:
    """
    Löst alle für Diagnose relevanten optionalen Module und Funktionen auf.
    """
    payload_module = _load_optional_module(INVENTORY_PAYLOAD_MODULE_NAME)
    fallback_module = _load_optional_module(INVENTORY_FALLBACK_MODULE_NAME)
    library_client_module = _load_optional_module(LIBRARY_CLIENT_MODULE_NAME)

    return {
        "payload_module_available": payload_module is not None,
        "fallback_module_available": fallback_module is not None,
        "library_client_module_available": library_client_module is not None,
        "payload_module": payload_module,
        "fallback_module": fallback_module,
        "library_client_module": library_client_module,
        "payload_metadata_getter": _safe_get_callable(
            payload_module,
            GET_PAYLOAD_METADATA_FUNCTION_NAME,
        ),
        "fallback_metadata_getter": _safe_get_callable(
            fallback_module,
            GET_FALLBACK_METADATA_FUNCTION_NAME,
        ),
        "library_client_metadata_getter": _safe_get_callable(
            library_client_module,
            GET_LIBRARY_CLIENT_METADATA_FUNCTION_NAME,
        ),
        "library_client_health_getter": _safe_get_callable(
            library_client_module,
            GET_LIBRARY_CLIENT_HEALTH_FUNCTION_NAME,
        ),
        "payload_cache_clearer": _safe_get_callable(
            payload_module,
            CLEAR_PAYLOAD_CACHES_FUNCTION_NAME,
        ),
        "fallback_cache_clearer": _safe_get_callable(
            fallback_module,
            CLEAR_FALLBACK_CACHES_FUNCTION_NAME,
        ),
        "library_client_cache_clearer": _safe_get_callable(
            library_client_module,
            CLEAR_LIBRARY_CLIENT_CACHES_FUNCTION_NAME,
        ),
    }


def _safe_call_getter(
    callback: Callable[..., Any] | None,
    *,
    kwargs: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """
    Ruft einen Metadaten-/Health-Getter defensiv auf.
    """
    if not callable(callback):
        return None

    call_kwargs = dict(kwargs or {})

    try:
        if call_kwargs:
            value = callback(**call_kwargs)
        else:
            value = callback()

        if isinstance(value, dict):
            return value

        if isinstance(value, Mapping):
            return dict(value)

        converted = _to_json_compatible(value)
        if isinstance(converted, dict):
            return converted

        return {"value": converted}

    except TypeError:
        try:
            value = callback()

            if isinstance(value, dict):
                return value

            if isinstance(value, Mapping):
                return dict(value)

            converted = _to_json_compatible(value)
            if isinstance(converted, dict):
                return converted

            return {"value": converted}

        except Exception as exc:
            return {"error": _exception_payload(exc)}

    except Exception as exc:
        return {"error": _exception_payload(exc)}


# -----------------------------------------------------------------------------
# Metadaten-Bausteine
# -----------------------------------------------------------------------------

def _build_config_metadata(config_source: Any = None) -> dict[str, Any]:
    """
    Baut eine kleine Konfigurationsdiagnose.

    Es werden nur nicht-sensitive Werte oder Wert-Verfügbarkeiten ausgegeben.
    """
    source = config_source if config_source is not None else _safe_get_flask_config()

    library_base_url = _normalize_text(
        _read_config_value(source, *CONFIG_LIBRARY_BASE_URL_KEYS, default=None)
    )
    library_api_prefix = _normalize_text(
        _read_config_value(source, *CONFIG_LIBRARY_API_PREFIX_KEYS, default=None)
    )
    inventory_source = _normalize_text(
        _read_config_value(source, *CONFIG_INVENTORY_SOURCE_KEYS, default="library"),
        "library",
    )
    allow_chunk_fallback = _coerce_bool(
        _read_config_value(source, *CONFIG_ALLOW_CHUNK_FALLBACK_KEYS, default=False),
        False,
    )

    return {
        "libraryBaseUrlConfigured": bool(library_base_url),
        "libraryBaseUrl": library_base_url,
        "libraryApiPrefixConfigured": bool(library_api_prefix),
        "libraryApiPrefix": library_api_prefix,
        "inventorySource": inventory_source,
        "allowChunkPlaceableFallback": allow_chunk_fallback,
        "expectedInventoryRoute": DEFAULT_ROUTE_PATH,
        "expectedHotbarSize": DEFAULT_HOTBAR_SIZE,
        "expectedSelectedSlot": DEFAULT_SELECTED_SLOT,
    }


def _build_runtime_rules_metadata() -> dict[str, Any]:
    """
    Dokumentiert harte Runtime-/Inventory-Regeln.
    """
    return {
        "onlyLibraryItemsArePlaceable": True,
        "debugGrassDirtAreNotInventoryTruth": True,
        "fallbackContainsNoPlaceableItems": True,
        "browserShouldUseEditorApiInventory": True,
        "browserShouldNotCallVectoplanLibraryDirectly": True,
        "chunkPlaceableBlocksAreDebugOnly": True,
        "placementRequiresLibraryRef": True,
        "placementRequiresRuntimeBlockTypeId": True,
        "libraryIdentityFields": [
            "vplibUid",
            "familyId",
            "packageId",
            "variantId",
            "revisionHash",
        ],
        "temporaryRuntimeFields": [
            "runtimeBlockTypeId",
            "blockTypeId",
        ],
    }


def _build_expected_payload_shape_metadata() -> dict[str, Any]:
    """
    Beschreibt die erwartete Payload-Struktur für Frontend und Tests.
    """
    return {
        "root": {
            "ok": "boolean",
            "kind": INVENTORY_KIND,
            "schemaVersion": INVENTORY_SCHEMA_VERSION,
            "source": "library | fallback",
            "sourceDetail": "string",
            "generatedAtUtc": "ISO timestamp",
            "route": DEFAULT_ROUTE_PATH,
        },
        "inventory": {
            "enabled": "boolean",
            "source": "library | fallback",
            "hotbarSize": "number",
            "selectedSlot": "number",
            "items": "array",
            "slots": "array",
            "allowPlaceAction": "boolean",
            "allowBreakAction": "boolean",
        },
        "slot": {
            "slotIndex": "number",
            "empty": "boolean",
            "source": "library | empty",
            "itemKind": "vplib | empty",
            "runtimeBlockTypeId": "string | null",
            "familyId": "string | null",
            "vplibUid": "string | null",
            "variantId": "string | null",
            "libraryRef": "object | null",
            "placementCommand": "object | null",
            "placeable": "boolean",
        },
    }


def _build_module_status(
    *,
    module_name: str,
    available: bool,
    metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Baut eine einheitliche Modulstatus-Struktur.
    """
    result = {
        "moduleName": module_name,
        "available": bool(available),
    }

    if metadata is not None:
        result["metadata"] = _to_json_compatible(metadata)

    return result


def _build_submodule_metadata(
    *,
    include_remote_health: bool,
    config_source: Any = None,
) -> dict[str, Any]:
    """
    Baut Metadaten der Inventar-Submodule.
    """
    try:
        api = _resolve_metadata_api()
        resolution_error = None
    except Exception as exc:
        api = {}
        resolution_error = exc

    payload_metadata = _safe_call_getter(api.get("payload_metadata_getter"))
    fallback_metadata = _safe_call_getter(api.get("fallback_metadata_getter"))
    library_client_metadata = _safe_call_getter(api.get("library_client_metadata_getter"))

    library_client_health = None
    if include_remote_health:
        library_client_health = _safe_call_getter(
            api.get("library_client_health_getter"),
            kwargs={
                "config_source": config_source,
                "include_remote": True,
                "force_refresh": False,
            },
        )

    return {
        "resolutionError": _exception_payload(resolution_error),
        "payload": _build_module_status(
            module_name=INVENTORY_PAYLOAD_MODULE_NAME,
            available=_coerce_bool(api.get("payload_module_available"), False),
            metadata=payload_metadata,
        ),
        "fallback": _build_module_status(
            module_name=INVENTORY_FALLBACK_MODULE_NAME,
            available=_coerce_bool(api.get("fallback_module_available"), False),
            metadata=fallback_metadata,
        ),
        "libraryClient": _build_module_status(
            module_name=LIBRARY_CLIENT_MODULE_NAME,
            available=_coerce_bool(api.get("library_client_module_available"), False),
            metadata=library_client_metadata,
        ),
        "libraryClientHealth": _to_json_compatible(library_client_health),
    }


def _build_environment_metadata() -> dict[str, Any]:
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
# Öffentliche Metadaten-API
# -----------------------------------------------------------------------------

def get_editor_inventory_metadata(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    include_submodule_metadata: bool = True,
    include_remote_health: bool = False,
) -> dict[str, Any]:
    """
    Liefert umfassende Metadaten für das Editor-Inventar.

    Parameter:
    - `include_submodule_metadata`: liest Metadaten aus payload/fallback/client
    - `include_remote_health`: führt zusätzlich einen remote Health-Aufruf über
      den Library-Client aus, falls verfügbar
    """
    generated_at = _safe_utc_timestamp()

    submodules = None
    if include_submodule_metadata:
        submodules = _build_submodule_metadata(
            include_remote_health=include_remote_health,
            config_source=config_source,
        )

    payload_available = False
    fallback_available = False
    library_client_available = False

    try:
        api = _resolve_metadata_api()
        payload_available = _coerce_bool(api.get("payload_module_available"), False)
        fallback_available = _coerce_bool(api.get("fallback_module_available"), False)
        library_client_available = _coerce_bool(api.get("library_client_module_available"), False)
    except Exception:
        pass

    return {
        "packageName": INVENTORY_PACKAGE_NAME,
        "packageVersion": INVENTORY_PACKAGE_VERSION,
        "moduleName": INVENTORY_METADATA_MODULE_NAME,
        "moduleVersion": INVENTORY_METADATA_MODULE_VERSION,
        "inventoryKind": INVENTORY_KIND,
        "schemaVersion": INVENTORY_SCHEMA_VERSION,
        "generatedAtUtc": generated_at,
        "route": {
            "expectedPath": DEFAULT_ROUTE_PATH,
            "externalConsumer": "routes/inventory.py",
        },
        "availability": {
            "payloadModuleAvailable": payload_available,
            "fallbackModuleAvailable": fallback_available,
            "libraryClientAvailable": library_client_available,
            "primaryPayloadAvailable": payload_available and library_client_available,
            "safeFallbackAvailable": fallback_available or True,
        },
        "config": _build_config_metadata(config_source),
        "rules": _build_runtime_rules_metadata(),
        "expectedPayloadShape": _build_expected_payload_shape_metadata(),
        "submodules": submodules,
        "environment": _build_environment_metadata(),
    }


def get_editor_inventory_package_metadata(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    include_submodule_metadata: bool = True,
    include_remote_health: bool = False,
) -> dict[str, Any]:
    """
    Alias mit dem Namen, den `src.inventory.__init__` erwartet.
    """
    return get_editor_inventory_metadata(
        config_source=config_source,
        include_submodule_metadata=include_submodule_metadata,
        include_remote_health=include_remote_health,
    )


def get_editor_inventory_metadata_health(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    include_remote_health: bool = False,
) -> dict[str, Any]:
    """
    Liefert eine kompakte Health-Antwort des Metadata-Moduls.
    """
    metadata = get_editor_inventory_metadata(
        config_source=config_source,
        include_submodule_metadata=True,
        include_remote_health=include_remote_health,
    )

    availability = _safe_mapping(metadata.get("availability"))
    payload_available = _coerce_bool(availability.get("payloadModuleAvailable"), False)
    library_client_available = _coerce_bool(availability.get("libraryClientAvailable"), False)

    ok = payload_available and library_client_available

    return {
        "ok": ok,
        "status": "ok" if ok else "degraded",
        "generatedAtUtc": _safe_utc_timestamp(),
        "moduleName": INVENTORY_METADATA_MODULE_NAME,
        "moduleVersion": INVENTORY_METADATA_MODULE_VERSION,
        "metadata": metadata,
    }


# -----------------------------------------------------------------------------
# Cache-Clear
# -----------------------------------------------------------------------------

def clear_editor_inventory_metadata_caches() -> None:
    """
    Löscht Caches dieses Metadata-Moduls und, falls verfügbar, Submodul-Caches.
    """
    try:
        api = _resolve_metadata_api()
    except Exception:
        api = {}

    for key in (
        "payload_cache_clearer",
        "fallback_cache_clearer",
        "library_client_cache_clearer",
    ):
        cache_clearer = api.get(key)
        if callable(cache_clearer):
            try:
                cache_clearer()
            except Exception:
                pass

    cache_clearers = (
        _candidate_missing_names,
        _load_optional_module,
        _resolve_metadata_api,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


# -----------------------------------------------------------------------------
# Rückwärtskompatible Alias-Funktionen
# -----------------------------------------------------------------------------

def get_editor_inventory_package_health() -> dict[str, Any]:
    """
    Alias für kompakte Health-Diagnose.
    """
    return get_editor_inventory_metadata_health()


def clear_editor_inventory_package_metadata_caches() -> None:
    """
    Alias für Cache-Clear.
    """
    clear_editor_inventory_metadata_caches()


# -----------------------------------------------------------------------------
# Öffentliche Exporte
# -----------------------------------------------------------------------------

__all__ = [
    "INVENTORY_METADATA_MODULE_NAME",
    "INVENTORY_METADATA_MODULE_VERSION",
    "INVENTORY_PACKAGE_NAME",
    "INVENTORY_PACKAGE_VERSION",
    "INVENTORY_PAYLOAD_MODULE_NAME",
    "INVENTORY_FALLBACK_MODULE_NAME",
    "LIBRARY_CLIENT_MODULE_NAME",
    "INVENTORY_KIND",
    "INVENTORY_SCHEMA_VERSION",
    "DEFAULT_ROUTE_PATH",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "get_editor_inventory_metadata",
    "get_editor_inventory_package_metadata",
    "get_editor_inventory_metadata_health",
    "get_editor_inventory_package_health",
    "clear_editor_inventory_metadata_caches",
    "clear_editor_inventory_package_metadata_caches",
]