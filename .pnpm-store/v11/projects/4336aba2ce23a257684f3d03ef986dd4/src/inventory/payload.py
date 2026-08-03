# services/vectoplan-editor/src/inventory/payload.py
"""
Serverseitiges Inventar-Payload-Building für den `vectoplan-editor`.

Zweck:
- `/editor/api/inventory` liefert echte Library-/VPLIB-Daten.
- Der Editor darf nicht mehr `debug_grass` / `debug_dirt` als fachliche Hotbar-
  Wahrheit verwenden.
- Platzierbar sind nur Items, die aus `vectoplan-library` kommen.
- Diese Datei lädt Library-Daten und delegiert Normalisierung/Mapping an
  `src.library_inventory`.

Datenfluss:

    routes/inventory.py
      -> src.inventory
      -> src.inventory.payload
      -> src.clients.library_client
      -> vectoplan-library

    Danach:
      -> src.library_inventory.normalize_library_inventory(...)
      -> src.library_inventory.normalizer / mapper / models

Quellen-Reihenfolge:
1. primär `vectoplan-library` Inventory-Route
2. fallback auf `vectoplan-library` Published Blocks
3. terminaler leerer Fallback ohne placebare Items

Diese Datei enthält bewusst:
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine direkte Chunk-/BlockWorld-Mutation
- keine DB-Logik
- keine debug_grass/debug_dirt-Items
- keine tiefe Library-Response-Normalisierung mehr

Öffentliche Funktionen:
- build_editor_inventory_payload(...)
- build_fallback_editor_inventory_payload(...)
- get_editor_inventory_payload_metadata()
- clear_editor_inventory_payload_caches()

Payload-Grundregel:
- `source="library"`
- belegte Slots haben `itemKind="vplib"`
- belegte Slots enthalten `vplibUid`, `familyId`, `variantId`
- `runtimeBlockTypeId` ist aktuell ein Übergangsadapter für den Chunk-/Runtime-
  Pfad und wird durch `src.library_inventory` erzeugt.
"""

from __future__ import annotations

import dataclasses
import importlib
import inspect
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from datetime import UTC, datetime
from functools import lru_cache
from types import ModuleType
from typing import Any, Final


# -----------------------------------------------------------------------------
# Modulkonstanten
# -----------------------------------------------------------------------------

INVENTORY_PAYLOAD_MODULE_NAME: Final[str] = "src.inventory.payload"
INVENTORY_PAYLOAD_MODULE_VERSION: Final[str] = "0.4.0"

INVENTORY_KIND: Final[str] = "editor-inventory"
INVENTORY_SCHEMA_VERSION: Final[str] = "editor-inventory.v1"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0

DEFAULT_INVENTORY_SOURCE: Final[str] = "vectoplan-user-inventory"
DEFAULT_LIBRARY_SOURCE: Final[str] = "db"
DEFAULT_ROUTE_PATH: Final[str] = "/editor/api/inventory"

DEFAULT_SCROLL_WRAP: Final[bool] = True
DEFAULT_ALLOW_BREAK_ACTION: Final[bool] = True
DEFAULT_ICON_ONLY: Final[bool] = False

DEFAULT_LIBRARY_ITEMS_LIMIT: Final[int] = 32
MAX_HOTBAR_SIZE: Final[int] = 64

LIBRARY_CLIENT_MODULE_NAME: Final[str] = "src.clients.library_client"
LIBRARY_INVENTORY_MODULE_NAME: Final[str] = "src.library_inventory"
INVENTORY_FALLBACK_MODULE_NAME: Final[str] = "src.inventory.fallback"

# Library Client API
GET_LIBRARY_CLIENT_FUNCTION_NAME: Final[str] = "get_library_client"
CLEAR_LIBRARY_CLIENT_CACHES_FUNCTION_NAME: Final[str] = "clear_library_client_caches"
EXTRACT_LIBRARY_ITEMS_FUNCTION_NAME: Final[str] = "extract_library_items"
EXTRACT_INVENTORY_SLOTS_FUNCTION_NAME: Final[str] = "extract_inventory_slots"

# Library Inventory Adapter API
NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME: Final[str] = "normalize_library_inventory"
BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME: Final[str] = "build_editor_inventory_from_library"
GET_LIBRARY_INVENTORY_METADATA_FUNCTION_NAME: Final[str] = "get_library_inventory_package_metadata"
GET_LIBRARY_INVENTORY_HEALTH_FUNCTION_NAME: Final[str] = "get_library_inventory_health"
CLEAR_LIBRARY_INVENTORY_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_package_caches"

# Fallback API
BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME: Final[str] = "build_fallback_editor_inventory_payload"
GET_EDITOR_INVENTORY_FALLBACK_METADATA_FUNCTION_NAME: Final[str] = "get_editor_inventory_fallback_metadata"
CLEAR_EDITOR_INVENTORY_FALLBACK_CACHES_FUNCTION_NAME: Final[str] = "clear_editor_inventory_fallback_caches"


# -----------------------------------------------------------------------------
# Interne Dataclasses
# -----------------------------------------------------------------------------

@dataclasses.dataclass(frozen=True)
class _LibraryLoadResult:
    """
    Interner Ladebefund aus `vectoplan-library`.
    """

    ok: bool
    source: str
    source_detail: str
    raw_payload: dict[str, Any] | None
    raw_slots: list[dict[str, Any]]
    raw_items: list[dict[str, Any]]
    errors: list[dict[str, Any]]
    from_cache: bool = False
    stale: bool = False

    def to_diagnostics(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "source": self.source,
            "sourceDetail": self.source_detail,
            "slotCount": len(self.raw_slots),
            "itemCount": len(self.raw_items),
            "errorCount": len(self.errors),
            "errors": self.errors,
            "fromCache": self.from_cache,
            "stale": self.stale,
        }


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


def _coerce_int(
    value: Any,
    default: int,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    """
    Wandelt Werte robust in Integer um und begrenzt optional.
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


def _safe_sequence(value: Any) -> list[Any]:
    """
    Wandelt sequenzartige Werte robust in eine Liste um.
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


def _safe_list_of_mappings(value: Any) -> list[dict[str, Any]]:
    """
    Wandelt eine Sequenz in eine Liste aus Dictionaries um.
    """
    result: list[dict[str, Any]] = []

    for item in _safe_sequence(value):
        mapping = _safe_mapping(item)
        if mapping:
            result.append(mapping)

    return result


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


def _deep_get(value: Any, path: Sequence[str], default: Any = None) -> Any:
    """
    Liest defensiv einen verschachtelten Mapping-Wert.
    """
    current = value

    for key in path:
        if not isinstance(current, Mapping):
            return default

        try:
            current = current.get(key)
        except Exception:
            return default

    return current if current is not None else default


def _to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    """
    Wandelt typische Python-Objekte defensiv in JSON-kompatible Strukturen um.
    """
    if depth > 32:
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
            result[_coerce_text(key, "unknown")] = _to_json_compatible(item, depth=depth + 1)
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


def _exception_payload(exc: Exception | BaseException | str | None) -> dict[str, Any] | None:
    """
    Liefert eine JSON-kompatible Fehlerbeschreibung.
    """
    if exc is None:
        return None

    if isinstance(exc, str):
        return {
            "type": "Error",
            "message": exc,
        }

    return {
        "type": exc.__class__.__name__,
        "message": _coerce_text(exc, "Unbekannter Fehler."),
    }


def _coerce_payload_dict(payload: Any, *, function_name: str) -> dict[str, Any]:
    """
    Erzwingt ein Dictionary als Rückgabewert.
    """
    if isinstance(payload, dict):
        return payload

    if dataclasses.is_dataclass(payload):
        converted = _to_json_compatible(payload)
        if isinstance(converted, dict):
            return converted

    if isinstance(payload, Mapping):
        return dict(payload)

    try:
        converted = dict(payload)
        if isinstance(converted, dict):
            return converted
    except Exception:
        pass

    raise TypeError(
        f"`{function_name}(...)` muss ein Dictionary oder mapping-artiges Objekt zurückgeben."
    )


# -----------------------------------------------------------------------------
# Config-/Request-Normalisierung
# -----------------------------------------------------------------------------

def _read_config_value(config_source: Any, *keys: str, default: Any = None) -> Any:
    """
    Liest den ersten gesetzten Wert aus Flask-Config, Mapping oder mappingähnlicher Quelle.
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

    return default


def _resolve_hotbar_size(config_source: Any = None, request_args: Any = None) -> int:
    """
    Löst die Hotbar-Größe robust auf.
    """
    args = _safe_mapping(request_args)

    value = _read_mapping_any(args, ("hotbarSize", "hotbar_size"), None)

    if value is None:
        value = _read_config_value(
            config_source,
            "EDITOR_INVENTORY_HOTBAR_SIZE",
            "INVENTORY_HOTBAR_SIZE",
            "VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE",
            default=DEFAULT_HOTBAR_SIZE,
        )

    return _coerce_int(value, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)


def _resolve_selected_slot(
    *,
    hotbar_size: int,
    config_source: Any = None,
    request_args: Any = None,
) -> int:
    """
    Löst den Default-/Selected-Slot robust auf.
    """
    args = _safe_mapping(request_args)

    value = _read_mapping_any(args, ("selectedSlot", "selected_slot"), None)

    if value is None:
        value = _read_config_value(
            config_source,
            "EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            "INVENTORY_DEFAULT_SELECTED_SLOT",
            "VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            default=DEFAULT_SELECTED_SLOT,
        )

    return _coerce_int(value, DEFAULT_SELECTED_SLOT, minimum=0, maximum=max(0, hotbar_size - 1))


def _resolve_inventory_enabled(config_source: Any = None, request_args: Any = None) -> bool:
    """
    Löst robust auf, ob das Inventar aktiv ist.
    """
    args = _safe_mapping(request_args)

    value = _read_mapping_any(args, ("enabled", "inventoryEnabled", "inventory_enabled"), None)

    if value is None:
        value = _read_config_value(
            config_source,
            "EDITOR_INVENTORY_ENABLED",
            "INVENTORY_ENABLED",
            "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
            default=True,
        )

    return _coerce_bool(value, True)


def _resolve_scroll_wrap(config_source: Any = None) -> bool:
    value = _read_config_value(
        config_source,
        "EDITOR_INVENTORY_SCROLL_WRAP",
        "INVENTORY_SCROLL_WRAP",
        "VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP",
        default=DEFAULT_SCROLL_WRAP,
    )
    return _coerce_bool(value, DEFAULT_SCROLL_WRAP)


def _resolve_allow_break_action(config_source: Any = None) -> bool:
    value = _read_config_value(
        config_source,
        "EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
        "INVENTORY_ALLOW_BREAK_ACTION",
        "VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
        default=DEFAULT_ALLOW_BREAK_ACTION,
    )
    return _coerce_bool(value, DEFAULT_ALLOW_BREAK_ACTION)


def _resolve_icon_only(config_source: Any = None) -> bool:
    value = _read_config_value(
        config_source,
        "EDITOR_INVENTORY_ICON_ONLY",
        "INVENTORY_ICON_ONLY",
        "VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY",
        default=DEFAULT_ICON_ONLY,
    )
    return _coerce_bool(value, DEFAULT_ICON_ONLY)


def _resolve_force_refresh(request_args: Any = None) -> bool:
    args = _safe_mapping(request_args)
    value = _read_mapping_any(
        args,
        ("forceRefresh", "force_refresh", "refresh", "noCache", "no_cache"),
        False,
    )
    return _coerce_bool(value, False)


def _resolve_library_items_limit(
    *,
    hotbar_size: int,
    config_source: Any = None,
    request_args: Any = None,
) -> int:
    args = _safe_mapping(request_args)

    value = _read_mapping_any(args, ("limit", "itemsLimit", "items_limit"), None)

    if value is None:
        value = _read_config_value(
            config_source,
            "EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
            "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
            default=max(DEFAULT_LIBRARY_ITEMS_LIMIT, hotbar_size),
        )

    return _coerce_int(value, max(DEFAULT_LIBRARY_ITEMS_LIMIT, hotbar_size), minimum=hotbar_size, maximum=512)


# -----------------------------------------------------------------------------
# Lazy Import / Modulauflösung
# -----------------------------------------------------------------------------

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


@lru_cache(maxsize=16)
def _load_optional_module(module_name: str) -> ModuleType | None:
    """
    Lädt ein optionales Modul lazy und gecacht.
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
    if module is None:
        return None

    try:
        candidate = getattr(module, attribute_name, None)
    except Exception:
        return None

    return candidate if callable(candidate) else None


@lru_cache(maxsize=1)
def _resolve_library_client_api() -> dict[str, Any]:
    module = _load_optional_module(LIBRARY_CLIENT_MODULE_NAME)

    return {
        "module_available": module is not None,
        "module": module,
        "get_library_client": _safe_get_callable(module, GET_LIBRARY_CLIENT_FUNCTION_NAME),
        "clear_caches": _safe_get_callable(module, CLEAR_LIBRARY_CLIENT_CACHES_FUNCTION_NAME),
        "extract_library_items": _safe_get_callable(module, EXTRACT_LIBRARY_ITEMS_FUNCTION_NAME),
        "extract_inventory_slots": _safe_get_callable(module, EXTRACT_INVENTORY_SLOTS_FUNCTION_NAME),
    }


@lru_cache(maxsize=1)
def _resolve_library_inventory_api() -> dict[str, Any]:
    module = _load_optional_module(LIBRARY_INVENTORY_MODULE_NAME)

    return {
        "module_available": module is not None,
        "module": module,
        "normalize_library_inventory": _safe_get_callable(module, NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME),
        "build_editor_inventory_from_library": _safe_get_callable(module, BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME),
        "metadata_getter": _safe_get_callable(module, GET_LIBRARY_INVENTORY_METADATA_FUNCTION_NAME),
        "health_getter": _safe_get_callable(module, GET_LIBRARY_INVENTORY_HEALTH_FUNCTION_NAME),
        "cache_clearer": _safe_get_callable(module, CLEAR_LIBRARY_INVENTORY_CACHES_FUNCTION_NAME),
    }


@lru_cache(maxsize=1)
def _resolve_fallback_api() -> dict[str, Any]:
    module = _load_optional_module(INVENTORY_FALLBACK_MODULE_NAME)

    return {
        "module_available": module is not None,
        "module": module,
        "build_fallback": _safe_get_callable(module, BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME),
        "metadata_getter": _safe_get_callable(module, GET_EDITOR_INVENTORY_FALLBACK_METADATA_FUNCTION_NAME),
        "cache_clearer": _safe_get_callable(module, CLEAR_EDITOR_INVENTORY_FALLBACK_CACHES_FUNCTION_NAME),
    }


def _call_with_supported_kwargs(
    callback: Callable[..., Any],
    kwargs: Mapping[str, Any],
) -> Any:
    """
    Ruft eine Funktion mit den von ihr unterstützten Keyword-Argumenten auf.
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


# -----------------------------------------------------------------------------
# Library Client
# -----------------------------------------------------------------------------

def _get_library_client(config_source: Any = None) -> Any:
    api = _resolve_library_client_api()
    getter = api.get("get_library_client")

    if not callable(getter):
        raise RuntimeError(
            f"`{LIBRARY_CLIENT_MODULE_NAME}.{GET_LIBRARY_CLIENT_FUNCTION_NAME}` ist nicht verfügbar."
        )

    return _call_with_supported_kwargs(
        getter,
        {
            "config_source": config_source,
        },
    )


def _safe_response_payload(response: Any) -> dict[str, Any] | None:
    """
    Extrahiert robust `.payload` oder `to_dict()["payload"]`.
    """
    try:
        payload = getattr(response, "payload", None)
        if isinstance(payload, Mapping):
            return dict(payload)
    except Exception:
        pass

    try:
        if hasattr(response, "to_dict"):
            response_dict = response.to_dict()
            payload = _safe_mapping(response_dict).get("payload")
            if isinstance(payload, Mapping):
                return dict(payload)
    except Exception:
        pass

    if isinstance(response, Mapping):
        return dict(response)

    return None


def _safe_response_ok(response: Any) -> bool:
    try:
        value = getattr(response, "ok", None)
        if value is not None:
            return _coerce_bool(value, False)
    except Exception:
        pass

    if isinstance(response, Mapping):
        return _coerce_bool(response.get("ok"), False)

    return False


def _safe_response_cache_flags(response: Any) -> tuple[bool, bool]:
    from_cache = False
    stale = False

    try:
        from_cache = _coerce_bool(getattr(response, "from_cache", False), False)
        stale = _coerce_bool(getattr(response, "stale", False), False)
        return from_cache, stale
    except Exception:
        pass

    if isinstance(response, Mapping):
        from_cache = _coerce_bool(response.get("fromCache", response.get("from_cache")), False)
        stale = _coerce_bool(response.get("stale"), False)

    return from_cache, stale


def _extract_library_items_from_payload(payload: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """
    Extrahiert Published-Library-Items aus verschiedenen Response-Shapes.
    """
    if not isinstance(payload, Mapping):
        return []

    api = _resolve_library_client_api()
    extractor = api.get("extract_library_items")

    if callable(extractor):
        try:
            items = extractor(payload)
            extracted = _safe_list_of_mappings(items)
            if extracted:
                return extracted
        except Exception:
            pass

    candidate_paths = (
        ("items",),
        ("blocks",),
        ("data", "items"),
        ("data", "blocks"),
        ("result", "items"),
        ("result", "blocks"),
        ("library", "items"),
        ("inventory", "items"),
    )

    for path in candidate_paths:
        items = _safe_list_of_mappings(_deep_get(payload, path, None))
        if items:
            return items

    return []


def _extract_inventory_slots_from_payload(payload: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """
    Extrahiert Inventory-Slots aus verschiedenen Response-Shapes.
    """
    if not isinstance(payload, Mapping):
        return []

    api = _resolve_library_client_api()
    extractor = api.get("extract_inventory_slots")

    if callable(extractor):
        try:
            slots = extractor(payload)
            extracted = _safe_list_of_mappings(slots)
            if extracted:
                return extracted
        except Exception:
            pass

    candidate_paths = (
        ("inventory", "slots"),
        ("slots",),
        ("data", "inventory", "slots"),
        ("data", "slots"),
        ("result", "inventory", "slots"),
        ("result", "slots"),
    )

    for path in candidate_paths:
        slots = _safe_list_of_mappings(_deep_get(payload, path, None))
        if slots:
            return slots

    return []


def _load_library_data(
    *,
    config_source: Any = None,
    hotbar_size: int,
    force_refresh: bool,
    request_args: Any = None,
) -> _LibraryLoadResult:
    """
    Lädt Library-Daten für das Editor-Inventory.

    Reihenfolge:
    1. `/inventory`
    2. `/blocks?source=db`
    """
    errors: list[dict[str, Any]] = []
    from_cache = False
    stale = False

    try:
        client = _get_library_client(config_source)
    except Exception as exc:
        return _LibraryLoadResult(
            ok=False,
            source="none",
            source_detail="library-client-unavailable",
            raw_payload=None,
            raw_slots=[],
            raw_items=[],
            errors=[
                {
                    "stage": "get-library-client",
                    "reason": "library-client-unavailable",
                    "error": _exception_payload(exc),
                }
            ],
        )

    # 1. Primär: Library Inventory
    try:
        inventory_response = client.get_inventory_response(force_refresh=force_refresh)
        inventory_payload = _safe_response_payload(inventory_response)
        response_from_cache, response_stale = _safe_response_cache_flags(inventory_response)
        from_cache = from_cache or response_from_cache
        stale = stale or response_stale

        if _safe_response_ok(inventory_response) and isinstance(inventory_payload, Mapping):
            raw_slots = _extract_inventory_slots_from_payload(inventory_payload)

            if raw_slots:
                return _LibraryLoadResult(
                    ok=True,
                    source="library",
                    source_detail="library-inventory",
                    raw_payload=dict(inventory_payload),
                    raw_slots=raw_slots,
                    raw_items=[],
                    errors=errors,
                    from_cache=from_cache,
                    stale=stale,
                )

            errors.append(
                {
                    "stage": "library-inventory",
                    "reason": "inventory-empty",
                    "message": "Library-Inventory enthielt keine Slots.",
                }
            )
        else:
            errors.append(
                {
                    "stage": "library-inventory",
                    "reason": "inventory-response-not-ok",
                    "message": "Library-Inventory-Response war nicht erfolgreich.",
                    "payload": _to_json_compatible(inventory_payload),
                }
            )

    except Exception as exc:
        errors.append(
            {
                "stage": "library-inventory",
                "reason": "inventory-request-error",
                "error": _exception_payload(exc),
            }
        )

    # 2. Fallback: Published Blocks
    try:
        limit = _resolve_library_items_limit(
            hotbar_size=hotbar_size,
            config_source=config_source,
            request_args=request_args,
        )

        blocks_response = client.get_published_blocks_response(
            source=DEFAULT_LIBRARY_SOURCE,
            limit=limit,
            force_refresh=force_refresh,
        )
        blocks_payload = _safe_response_payload(blocks_response)
        response_from_cache, response_stale = _safe_response_cache_flags(blocks_response)
        from_cache = from_cache or response_from_cache
        stale = stale or response_stale

        if _safe_response_ok(blocks_response) and isinstance(blocks_payload, Mapping):
            raw_items = _extract_library_items_from_payload(blocks_payload)

            if raw_items:
                return _LibraryLoadResult(
                    ok=True,
                    source="library",
                    source_detail="library-published-blocks",
                    raw_payload=dict(blocks_payload),
                    raw_slots=[],
                    raw_items=raw_items,
                    errors=errors,
                    from_cache=from_cache,
                    stale=stale,
                )

            errors.append(
                {
                    "stage": "library-published-blocks",
                    "reason": "blocks-empty",
                    "message": "Published Blocks enthielten keine Items.",
                }
            )
        else:
            errors.append(
                {
                    "stage": "library-published-blocks",
                    "reason": "blocks-response-not-ok",
                    "message": "Published-Blocks-Response war nicht erfolgreich.",
                    "payload": _to_json_compatible(blocks_payload),
                }
            )

    except Exception as exc:
        errors.append(
            {
                "stage": "library-published-blocks",
                "reason": "blocks-request-error",
                "error": _exception_payload(exc),
            }
        )

    return _LibraryLoadResult(
        ok=False,
        source="library",
        source_detail="library-empty-or-unavailable",
        raw_payload=None,
        raw_slots=[],
        raw_items=[],
        errors=errors,
        from_cache=from_cache,
        stale=stale,
    )


# -----------------------------------------------------------------------------
# Library Inventory Adapter
# -----------------------------------------------------------------------------

def _normalize_with_library_inventory(
    *,
    load_result: _LibraryLoadResult,
    hotbar_size: int,
    selected_slot: int,
    icon_only: bool,
    include_empty_slots: bool,
    route: str,
    generated_at_utc: str,
    diagnostics: Mapping[str, Any],
) -> dict[str, Any]:
    """
    Delegiert die eigentliche Normalisierung an `src.library_inventory`.
    """
    api = _resolve_library_inventory_api()
    normalizer = api.get("normalize_library_inventory")

    if not callable(normalizer):
        raise RuntimeError(
            f"`{LIBRARY_INVENTORY_MODULE_NAME}.{NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME}` ist nicht verfügbar."
        )

    payload = _call_with_supported_kwargs(
        normalizer,
        {
            "payload": load_result.raw_payload,
            "raw_slots": load_result.raw_slots,
            "rawSlots": load_result.raw_slots,
            "raw_items": load_result.raw_items,
            "rawItems": load_result.raw_items,
            "hotbar_size": hotbar_size,
            "hotbarSize": hotbar_size,
            "selected_slot": selected_slot,
            "selectedSlot": selected_slot,
            "icon_only": icon_only,
            "iconOnly": icon_only,
            "source": DEFAULT_INVENTORY_SOURCE,
            "source_detail": load_result.source_detail,
            "sourceDetail": load_result.source_detail,
            "include_empty_slots": include_empty_slots,
            "includeEmptySlots": include_empty_slots,
            "route": route,
            "generated_at_utc": generated_at_utc,
            "generatedAtUtc": generated_at_utc,
            "diagnostics": diagnostics,
        },
    )

    normalized = _coerce_payload_dict(
        payload,
        function_name=NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME,
    )

    return normalized


def _patch_inventory_runtime_flags(
    payload: dict[str, Any],
    *,
    inventory_enabled: bool,
    scroll_wrap: bool,
    allow_break_action: bool,
    icon_only: bool,
) -> dict[str, Any]:
    """
    Erzwingt runtime-relevante Inventory-Flags nach der Adapter-Normalisierung.
    """
    patched = dict(payload)
    inventory = _safe_mapping(patched.get("inventory"))

    inventory["enabled"] = inventory_enabled
    inventory["scrollWrap"] = scroll_wrap
    inventory["allowBreakAction"] = allow_break_action
    inventory["iconOnly"] = icon_only

    # Place darf nur aktiv sein, wenn wirklich placebare Slots vorhanden sind.
    slots = _safe_list_of_mappings(inventory.get("slots"))
    placeable_count = sum(1 for slot in slots if _coerce_bool(slot.get("placeable"), False))
    inventory["allowPlaceAction"] = placeable_count > 0
    inventory.setdefault("placeableSlotCount", placeable_count)
    inventory.setdefault("filledSlotCount", sum(1 for slot in slots if not _coerce_bool(slot.get("empty"), True)))
    inventory.setdefault("emptySlotCount", sum(1 for slot in slots if _coerce_bool(slot.get("empty"), True)))

    patched["inventory"] = inventory
    patched["ok"] = _coerce_bool(patched.get("ok"), placeable_count > 0) and placeable_count > 0

    fallback = _safe_mapping(patched.get("fallback"))
    if placeable_count > 0:
        fallback["active"] = False
        fallback.setdefault("reason", None)
    else:
        fallback["active"] = True
        fallback["reason"] = fallback.get("reason") or "no-placeable-library-items"

    patched["fallback"] = fallback

    return patched


# -----------------------------------------------------------------------------
# Fallback
# -----------------------------------------------------------------------------

def _build_local_empty_fallback_payload(
    *,
    reason: Any = None,
    source_error: Any = None,
    source_error_message: Any = None,
    config_source: Any = None,
    request_args: Any = None,
    request_method: Any = None,
    request_path: Any = None,
    request_id: Any = None,
    include_empty_slots: bool = True,
    route_path: str | None = None,
    generated_at_utc: str | None = None,
    diagnostics_extra: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Lokaler terminaler Fallback ohne placebare Items.
    """
    hotbar_size = _resolve_hotbar_size(
        config_source=config_source,
        request_args=request_args,
    )
    selected_slot = _resolve_selected_slot(
        hotbar_size=hotbar_size,
        config_source=config_source,
        request_args=request_args,
    )

    slots: list[dict[str, Any]] = []
    if _coerce_bool(include_empty_slots, True):
        slots = [
            {
                "slotIndex": index,
                "slotKey": f"hotbar-{index}",
                "empty": True,
                "enabled": True,
                "selected": index == selected_slot,
                "source": "empty",
                "sourceKind": "empty",
                "itemId": None,
                "itemKind": "empty",
                "kind": "empty",
                "type": "empty",
                "blockTypeId": None,
                "runtimeBlockTypeId": None,
                "placeable": False,
                "breakable": False,
                "iconKey": None,
                "iconKind": None,
                "iconUrl": None,
                "icon": None,
                "label": "",
                "displayLabel": "",
                "visibleLabel": False,
                "ariaLabel": f"Inventar-Slot {index + 1}: leer",
                "title": "",
                "stackSize": 0,
                "maxStackSize": 0,
                "libraryRef": None,
                "placementCommand": None,
                "metadata": {},
            }
            for index in range(hotbar_size)
        ]

    normalized_reason = _coerce_text(reason, "fallback-active")
    normalized_source_error = (
        _to_json_compatible(source_error)
        if source_error is not None
        else _normalize_text(source_error_message)
    )

    return {
        "ok": False,
        "kind": INVENTORY_KIND,
        "schemaVersion": INVENTORY_SCHEMA_VERSION,
        "source": "fallback",
        "sourceDetail": "empty-no-library-items",
        "generatedAtUtc": _normalize_text(generated_at_utc) or _safe_utc_timestamp(),
        "route": _normalize_text(route_path) or DEFAULT_ROUTE_PATH,
        "inventory": {
            "enabled": True,
            "source": "fallback",
            "sourceDetail": "empty-no-library-items",
            "hotbarSize": hotbar_size,
            "defaultSelectedSlot": selected_slot,
            "selectedSlot": selected_slot,
            "scrollWrap": _resolve_scroll_wrap(config_source),
            "allowPlaceAction": False,
            "allowBreakAction": _resolve_allow_break_action(config_source),
            "iconOnly": _resolve_icon_only(config_source),
            "items": [],
            "slots": slots,
            "emptySlotCount": hotbar_size if include_empty_slots else 0,
            "filledSlotCount": 0,
            "placeableSlotCount": 0,
        },
        "capabilities": _build_capabilities(),
        "fallback": {
            "active": True,
            "reason": normalized_reason,
            "sourceError": normalized_source_error,
        },
        "diagnostics": {
            "moduleName": INVENTORY_PAYLOAD_MODULE_NAME,
            "moduleVersion": INVENTORY_PAYLOAD_MODULE_VERSION,
            "requestMethod": _normalize_text(request_method),
            "requestPath": _normalize_text(request_path),
            "requestId": _normalize_text(request_id),
            "requestArgs": _safe_mapping(request_args),
            "extra": _to_json_compatible(diagnostics_extra),
        },
    }


def _build_fallback_via_module(**kwargs: Any) -> dict[str, Any] | None:
    """
    Delegiert Fallback an `src.inventory.fallback`, falls verfügbar.
    """
    try:
        api = _resolve_fallback_api()
        builder = api.get("build_fallback")
        if not callable(builder):
            return None

        payload = _call_with_supported_kwargs(builder, kwargs)
        return _coerce_payload_dict(
            payload,
            function_name=BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
        )
    except Exception:
        return None


# -----------------------------------------------------------------------------
# Capability / Diagnostics
# -----------------------------------------------------------------------------

def _build_capabilities() -> dict[str, Any]:
    return {
        "serverDriven": True,
        "source": "vectoplan-library",
        "supportsEmptySlots": True,
        "supportsLibraryItems": True,
        "supportsVplib": True,
        "supportsFamilyId": True,
        "supportsVplibUid": True,
        "supportsVariantId": True,
        "supportsRuntimeBlockTypeId": True,
        "supportsPlacementCommand": True,
        "supportsRemoteAssets": True,
        "supportsChunkDebugFallback": False,
        "allowsDebugGrassDirt": False,
        "normalizationDelegatedToLibraryInventory": True,
    }


def _build_diagnostics(
    *,
    request_method: Any = None,
    request_path: Any = None,
    request_id: Any = None,
    request_args: Any = None,
    load_result: _LibraryLoadResult | None = None,
) -> dict[str, Any]:
    return {
        "payload": {
            "moduleName": INVENTORY_PAYLOAD_MODULE_NAME,
            "moduleVersion": INVENTORY_PAYLOAD_MODULE_VERSION,
        },
        "requestMethod": _normalize_text(request_method),
        "requestPath": _normalize_text(request_path),
        "requestId": _normalize_text(request_id),
        "requestArgs": _safe_mapping(request_args),
        "library": load_result.to_diagnostics() if load_result is not None else None,
        "adapter": {
            "moduleName": LIBRARY_INVENTORY_MODULE_NAME,
            "normalizer": NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME,
        },
    }


# -----------------------------------------------------------------------------
# Öffentliche Payload-Builder
# -----------------------------------------------------------------------------

def build_editor_inventory_payload(
    *,
    config_source: Any = None,
    request_args: Any = None,
    request_method: Any = None,
    request_path: Any = None,
    request_id: Any = None,
    static_url_builder: Callable[[str], str] | None = None,
    include_empty_slots: bool = True,
    route_path: str | None = None,
    generated_at_utc: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    """
    Baut den produktiven Editor-Inventar-Payload aus `vectoplan-library`.

    Primärquelle:
        GET /api/v1/vplib/library/inventory

    Fallback:
        GET /api/v1/vplib/library/blocks?source=db

    Wenn beides keine Library-Items liefert, wird ein leerer Fallback-Payload
    mit `ok=False` zurückgegeben. Es werden keine debug_grass/debug_dirt-Slots
    erzeugt.
    """
    # Productive source: the persistent nine-slot user inventory from
    # vectoplan-library. The creative catalog adapter below remains available
    # for compatibility imports, but no longer fills the editor hotbar.
    from .user_inventory import build_editor_user_inventory_payload

    return build_editor_user_inventory_payload(
        config_source=config_source,
        request_args=request_args,
        include_empty_slots=include_empty_slots,
        route_path=_normalize_text(route_path) or DEFAULT_ROUTE_PATH,
        generated_at_utc=generated_at_utc,
    )

    hotbar_size = _resolve_hotbar_size(
        config_source=config_source,
        request_args=request_args,
    )
    selected_slot = _resolve_selected_slot(
        hotbar_size=hotbar_size,
        config_source=config_source,
        request_args=request_args,
    )
    inventory_enabled = _resolve_inventory_enabled(
        config_source=config_source,
        request_args=request_args,
    )
    scroll_wrap = _resolve_scroll_wrap(config_source)
    allow_break_action = _resolve_allow_break_action(config_source)
    icon_only = _resolve_icon_only(config_source)
    force_refresh = _resolve_force_refresh(request_args)

    generated_timestamp = _normalize_text(generated_at_utc) or _safe_utc_timestamp()
    normalized_route_path = _normalize_text(route_path) or DEFAULT_ROUTE_PATH

    load_result = _load_library_data(
        config_source=config_source,
        hotbar_size=hotbar_size,
        force_refresh=force_refresh,
        request_args=request_args,
    )

    if not load_result.ok:
        return build_fallback_editor_inventory_payload(
            reason="library-inventory-unavailable",
            source_error=load_result.errors,
            config_source=config_source,
            request_args=request_args,
            request_method=request_method,
            request_path=request_path,
            request_id=request_id,
            include_empty_slots=include_empty_slots,
            route_path=normalized_route_path,
            generated_at_utc=generated_timestamp,
            diagnostics_extra={
                "loadResult": load_result.to_diagnostics(),
            },
        )

    diagnostics = _build_diagnostics(
        request_method=request_method,
        request_path=request_path,
        request_id=request_id,
        request_args=request_args,
        load_result=load_result,
    )

    try:
        payload = _normalize_with_library_inventory(
            load_result=load_result,
            hotbar_size=hotbar_size,
            selected_slot=selected_slot,
            icon_only=icon_only,
            include_empty_slots=_coerce_bool(include_empty_slots, True),
            route=normalized_route_path,
            generated_at_utc=generated_timestamp,
            diagnostics=diagnostics,
        )

        payload = _patch_inventory_runtime_flags(
            payload,
            inventory_enabled=inventory_enabled,
            scroll_wrap=scroll_wrap,
            allow_break_action=allow_break_action,
            icon_only=icon_only,
        )

        # Sicherheit: Auch bei fehlerhaften Adaptern dürfen debug-IDs nicht als
        # Inventarwahrheit erscheinen.
        if _payload_contains_forbidden_debug_items(payload):
            return build_fallback_editor_inventory_payload(
                reason="forbidden-debug-items-detected",
                source_error="Library inventory payload contains debug_grass/debug_dirt.",
                config_source=config_source,
                request_args=request_args,
                request_method=request_method,
                request_path=request_path,
                request_id=request_id,
                include_empty_slots=include_empty_slots,
                route_path=normalized_route_path,
                generated_at_utc=generated_timestamp,
                diagnostics_extra={
                    "loadResult": load_result.to_diagnostics(),
                },
            )

        return payload

    except Exception as exc:
        return build_fallback_editor_inventory_payload(
            reason="library-inventory-normalization-error",
            source_error=exc,
            config_source=config_source,
            request_args=request_args,
            request_method=request_method,
            request_path=request_path,
            request_id=request_id,
            include_empty_slots=include_empty_slots,
            route_path=normalized_route_path,
            generated_at_utc=generated_timestamp,
            diagnostics_extra={
                "loadResult": load_result.to_diagnostics(),
            },
        )


def build_fallback_editor_inventory_payload(
    *,
    reason: Any = None,
    source_error: Any = None,
    source_error_message: Any = None,
    config_source: Any = None,
    request_args: Any = None,
    request_method: Any = None,
    request_path: Any = None,
    request_id: Any = None,
    include_empty_slots: bool = True,
    route_path: str | None = None,
    generated_at_utc: str | None = None,
    diagnostics_extra: Mapping[str, Any] | None = None,
    **_: Any,
) -> dict[str, Any]:
    """
    Baut einen leeren Fallback-Payload.

    Wichtig:
    - Keine debug_grass/debug_dirt-Slots.
    - Keine Place-Aktionen.
    - Der Editor darf dadurch nichts platzieren, wenn Library nicht verfügbar ist.
    """
    delegated = _build_fallback_via_module(
        reason=reason,
        source_error=source_error,
        source_error_message=source_error_message,
        config_source=config_source,
        request_args=request_args,
        request_method=request_method,
        request_path=request_path,
        request_id=request_id,
        include_empty_slots=include_empty_slots,
        route_path=route_path,
        generated_at_utc=generated_at_utc,
        diagnostics_extra=diagnostics_extra,
    )

    if delegated is not None:
        return delegated

    return _build_local_empty_fallback_payload(
        reason=reason,
        source_error=source_error,
        source_error_message=source_error_message,
        config_source=config_source,
        request_args=request_args,
        request_method=request_method,
        request_path=request_path,
        request_id=request_id,
        include_empty_slots=include_empty_slots,
        route_path=route_path,
        generated_at_utc=generated_at_utc,
        diagnostics_extra=diagnostics_extra,
    )


# -----------------------------------------------------------------------------
# Sicherheitsprüfung
# -----------------------------------------------------------------------------

def _payload_contains_forbidden_debug_items(payload: Any) -> bool:
    """
    Prüft, ob versehentlich alte Debug-Block-IDs im Inventory auftauchen.
    """
    try:
        text = str(_to_json_compatible(payload))
    except Exception:
        text = str(payload)

    return "debug_grass" in text or "debug_dirt" in text


# -----------------------------------------------------------------------------
# Metadaten / Cache
# -----------------------------------------------------------------------------

def get_editor_inventory_payload_metadata() -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten dieses Payload-Moduls.
    """
    try:
        client_api = _resolve_library_client_api()
        library_client_available = _coerce_bool(client_api.get("module_available"), False)
        library_client_error = None
    except Exception as exc:
        library_client_available = False
        library_client_error = exc

    try:
        adapter_api = _resolve_library_inventory_api()
        adapter_available = _coerce_bool(adapter_api.get("module_available"), False)
        adapter_error = None
        adapter_metadata = None

        metadata_getter = adapter_api.get("metadata_getter")
        if callable(metadata_getter):
            try:
                adapter_metadata = metadata_getter()
            except Exception as metadata_exc:
                adapter_metadata = {"error": _exception_payload(metadata_exc)}

    except Exception as exc:
        adapter_available = False
        adapter_error = exc
        adapter_metadata = None

    try:
        fallback_api = _resolve_fallback_api()
        fallback_available = _coerce_bool(fallback_api.get("module_available"), False)
        fallback_metadata = None

        metadata_getter = fallback_api.get("metadata_getter")
        if callable(metadata_getter):
            try:
                fallback_metadata = metadata_getter()
            except Exception as metadata_exc:
                fallback_metadata = {"error": _exception_payload(metadata_exc)}
    except Exception as exc:
        fallback_available = False
        fallback_metadata = {"error": _exception_payload(exc)}

    return {
        "moduleName": INVENTORY_PAYLOAD_MODULE_NAME,
        "moduleVersion": INVENTORY_PAYLOAD_MODULE_VERSION,
        "inventoryKind": INVENTORY_KIND,
        "schemaVersion": INVENTORY_SCHEMA_VERSION,
        "defaultHotbarSize": DEFAULT_HOTBAR_SIZE,
        "defaultSelectedSlot": DEFAULT_SELECTED_SLOT,
        "defaultInventorySource": DEFAULT_INVENTORY_SOURCE,
        "defaultLibrarySource": DEFAULT_LIBRARY_SOURCE,
        "capabilities": _build_capabilities(),
        "libraryClient": {
            "moduleName": LIBRARY_CLIENT_MODULE_NAME,
            "available": library_client_available,
            "error": _exception_payload(library_client_error),
        },
        "libraryInventoryAdapter": {
            "moduleName": LIBRARY_INVENTORY_MODULE_NAME,
            "available": adapter_available,
            "normalizerFunction": NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME,
            "metadata": _to_json_compatible(adapter_metadata),
            "error": _exception_payload(adapter_error),
        },
        "fallback": {
            "moduleName": INVENTORY_FALLBACK_MODULE_NAME,
            "available": fallback_available,
            "metadata": _to_json_compatible(fallback_metadata),
        },
        "notes": {
            "debugGrassDirtAllowed": False,
            "emptyFallbackAllowsPlace": False,
            "primarySource": "vectoplan-library inventory",
            "secondarySource": "vectoplan-library published blocks",
            "normalizationDelegatedTo": LIBRARY_INVENTORY_MODULE_NAME,
        },
    }


def clear_editor_inventory_payload_caches() -> None:
    """
    Löscht interne Caches dieses Payload-Moduls und, falls verfügbar,
    Library-Client-, Adapter- und Fallback-Caches.
    """
    try:
        client_api = _resolve_library_client_api()
        clear_library_caches = client_api.get("clear_caches")
        if callable(clear_library_caches):
            clear_library_caches()
    except Exception:
        pass

    try:
        adapter_api = _resolve_library_inventory_api()
        clear_adapter_caches = adapter_api.get("cache_clearer")
        if callable(clear_adapter_caches):
            clear_adapter_caches()
    except Exception:
        pass

    try:
        fallback_api = _resolve_fallback_api()
        clear_fallback_caches = fallback_api.get("cache_clearer")
        if callable(clear_fallback_caches):
            clear_fallback_caches()
    except Exception:
        pass

    cache_clearers = (
        _candidate_missing_names,
        _load_optional_module,
        _resolve_library_client_api,
        _resolve_library_inventory_api,
        _resolve_fallback_api,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


# -----------------------------------------------------------------------------
# Öffentliche Exporte
# -----------------------------------------------------------------------------

__all__ = [
    "INVENTORY_PAYLOAD_MODULE_NAME",
    "INVENTORY_PAYLOAD_MODULE_VERSION",
    "INVENTORY_KIND",
    "INVENTORY_SCHEMA_VERSION",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "DEFAULT_INVENTORY_SOURCE",
    "DEFAULT_LIBRARY_SOURCE",
    "LIBRARY_CLIENT_MODULE_NAME",
    "LIBRARY_INVENTORY_MODULE_NAME",
    "INVENTORY_FALLBACK_MODULE_NAME",
    "build_editor_inventory_payload",
    "build_fallback_editor_inventory_payload",
    "get_editor_inventory_payload_metadata",
    "clear_editor_inventory_payload_caches",
]