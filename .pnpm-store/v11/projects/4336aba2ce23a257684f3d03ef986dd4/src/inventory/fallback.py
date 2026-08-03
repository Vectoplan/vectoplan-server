# services/vectoplan-editor/src/inventory/fallback.py
"""
Dedizierter Fallback-Payload für das Editor-Inventar.

Zweck:
- Diese Datei baut eine robuste, leere Inventar-Antwort, wenn die primäre
  Library-basierte Payload-Erzeugung fehlschlägt.
- Der Fallback darf keine fachlich platzierbaren Items erzeugen.
- Insbesondere dürfen hier keine `debug_grass` / `debug_dirt`-Slots entstehen.
- Dadurch bleibt die neue Regel stabil:
  Nur Items aus `vectoplan-library` / VPLIB dürfen im Editor platzierbar sein.

Import-Richtung:

    src.inventory.__init__
      -> src.inventory.fallback.build_fallback_editor_inventory_payload(...)

Diese Datei enthält bewusst:
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine direkte Chunk-/BlockWorld-Mutation
- keine Datenbanklogik
- keine Library-HTTP-Requests
- keine produktiven Inventaritems

Öffentliche Funktionen:
- build_fallback_editor_inventory_payload(...)
- get_editor_inventory_fallback_metadata()
- clear_editor_inventory_fallback_caches()

Payload-Grundsatz:
- `ok=False`
- `source="fallback"`
- `allowPlaceAction=False`
- alle Slots sind leer
- die Response bleibt strukturell kompatibel zur normalen Inventory-Payload
"""

from __future__ import annotations

import dataclasses
from collections.abc import Mapping, MutableMapping, Sequence
from copy import deepcopy
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any, Final


# -----------------------------------------------------------------------------
# Modulkonstanten
# -----------------------------------------------------------------------------

INVENTORY_FALLBACK_MODULE_NAME: Final[str] = "src.inventory.fallback"
INVENTORY_FALLBACK_MODULE_VERSION: Final[str] = "0.1.0"

INVENTORY_KIND: Final[str] = "editor-inventory"
INVENTORY_SCHEMA_VERSION: Final[str] = "editor-inventory.v1"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0
DEFAULT_ROUTE_PATH: Final[str] = "/editor/api/inventory"

DEFAULT_FALLBACK_SOURCE: Final[str] = "fallback"
DEFAULT_FALLBACK_SOURCE_DETAIL: Final[str] = "empty-no-library-items"

DEFAULT_SCROLL_WRAP: Final[bool] = True
DEFAULT_ALLOW_BREAK_ACTION: Final[bool] = True
DEFAULT_ICON_ONLY: Final[bool] = False

# Harte Sicherheitsregel:
# Fallback darf nie platzierbare Items anbieten.
FALLBACK_ALLOW_PLACE_ACTION: Final[bool] = False
FALLBACK_SUPPORTS_PLACEABLE_ITEMS: Final[bool] = False
FALLBACK_SUPPORTS_DEBUG_BLOCKS: Final[bool] = False


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


def _safe_deepcopy(value: Any) -> Any:
    """
    Kopiert Daten defensiv.
    """
    try:
        return deepcopy(value)
    except Exception:
        return value


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
        return _exception_payload(value)

    return _normalize_text(value)


# -----------------------------------------------------------------------------
# Config-/Request-Normalisierung
# -----------------------------------------------------------------------------

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

    return _coerce_int(value, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=64)


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

    Auch im Fallback bleibt Inventory enabled, damit die UI die leeren Slots
    anzeigen kann. Platzieren bleibt trotzdem deaktiviert.
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
    """
    Löst robust auf, ob Hotbar-Scrollen umbrechen darf.
    """
    value = _read_config_value(
        config_source,
        "EDITOR_INVENTORY_SCROLL_WRAP",
        "INVENTORY_SCROLL_WRAP",
        "VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP",
        default=DEFAULT_SCROLL_WRAP,
    )
    return _coerce_bool(value, DEFAULT_SCROLL_WRAP)


def _resolve_allow_break_action(config_source: Any = None) -> bool:
    """
    Löst robust auf, ob Break-Aktionen grundsätzlich erlaubt bleiben.

    Entfernen/Brechen ist nicht an ein platzierbares Inventory-Item gebunden.
    Deshalb kann es im Fallback aktiv bleiben.
    """
    value = _read_config_value(
        config_source,
        "EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
        "INVENTORY_ALLOW_BREAK_ACTION",
        "VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
        default=DEFAULT_ALLOW_BREAK_ACTION,
    )
    return _coerce_bool(value, DEFAULT_ALLOW_BREAK_ACTION)


def _resolve_icon_only(config_source: Any = None) -> bool:
    """
    Löst robust auf, ob die Hotbar nur Icons zeigen soll.
    """
    value = _read_config_value(
        config_source,
        "EDITOR_INVENTORY_ICON_ONLY",
        "INVENTORY_ICON_ONLY",
        "VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY",
        default=DEFAULT_ICON_ONLY,
    )
    return _coerce_bool(value, DEFAULT_ICON_ONLY)


def _resolve_include_empty_slots(request_args: Any = None, default: bool = True) -> bool:
    """
    Löst robust auf, ob leere Slots explizit enthalten sein sollen.
    """
    args = _safe_mapping(request_args)
    value = _read_mapping_any(
        args,
        ("includeEmptySlots", "include_empty_slots", "emptySlots", "empty_slots"),
        default,
    )
    return _coerce_bool(value, default)


# -----------------------------------------------------------------------------
# Slot-/Payload-Builder
# -----------------------------------------------------------------------------

def _build_empty_slot(slot_index: int, *, selected_slot: int) -> dict[str, Any]:
    """
    Baut einen explizit leeren Hotbar-Slot.
    """
    safe_slot_index = _coerce_int(slot_index, 0, minimum=0)

    return {
        "slotIndex": safe_slot_index,
        "slotKey": f"hotbar-{safe_slot_index}",
        "empty": True,
        "enabled": True,
        "selected": safe_slot_index == selected_slot,

        # Quelle / Semantik
        "source": "empty",
        "sourceKind": "empty",
        "itemId": None,
        "itemKind": "empty",
        "kind": "empty",
        "type": "empty",

        # Harte Platzierungsregel:
        # Fallback-Slots sind niemals placeable.
        "blockTypeId": None,
        "runtimeBlockTypeId": None,
        "placeable": False,
        "breakable": False,

        # Darstellung
        "iconKey": None,
        "iconKind": None,
        "iconUrl": None,
        "icon": None,
        "label": "",
        "displayLabel": "",
        "visibleLabel": False,
        "ariaLabel": f"Inventar-Slot {safe_slot_index + 1}: leer",
        "title": "",

        # Stack / Meta
        "stackSize": 0,
        "maxStackSize": 0,
        "familyId": None,
        "packageId": None,
        "vplibUid": None,
        "variantId": None,
        "revisionHash": None,
        "objectKind": None,
        "domain": None,
        "category": None,
        "subcategory": None,
        "libraryRef": None,
        "placementCommand": None,
        "metadata": {
            "fallback": True,
            "placeable": False,
        },
    }


@lru_cache(maxsize=128)
def _build_empty_slots_cached(
    hotbar_size: int,
    selected_slot: int,
) -> tuple[dict[str, Any], ...]:
    """
    Baut leere Slots und cached sie pro `(hotbar_size, selected_slot)`.

    Rückgabe ist intern ein Tuple; öffentliche Payloads erhalten Deepcopies.
    """
    safe_hotbar_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=64)
    safe_selected_slot = _coerce_int(
        selected_slot,
        DEFAULT_SELECTED_SLOT,
        minimum=0,
        maximum=max(0, safe_hotbar_size - 1),
    )

    return tuple(
        _build_empty_slot(slot_index, selected_slot=safe_selected_slot)
        for slot_index in range(safe_hotbar_size)
    )


def _build_empty_slots(
    *,
    hotbar_size: int,
    selected_slot: int,
    include_empty_slots: bool = True,
) -> list[dict[str, Any]]:
    """
    Liefert leere Slots als frische Kopie.
    """
    if not include_empty_slots:
        return []

    cached = _build_empty_slots_cached(hotbar_size, selected_slot)
    return [_safe_deepcopy(slot) for slot in cached]


def _build_capabilities() -> dict[str, Any]:
    """
    Liefert Fallback-Fähigkeiten.
    """
    return {
        "serverDriven": True,
        "source": "fallback",
        "supportsEmptySlots": True,
        "supportsLibraryItems": False,
        "supportsVplib": False,
        "supportsFamilyId": False,
        "supportsVplibUid": False,
        "supportsVariantId": False,
        "supportsRuntimeBlockTypeId": False,
        "supportsPlacementCommand": False,
        "supportsRemoteAssets": False,
        "supportsChunkDebugFallback": False,
        "allowsDebugGrassDirt": False,
        "allowsPlaceAction": FALLBACK_ALLOW_PLACE_ACTION,
        "supportsPlaceableItems": FALLBACK_SUPPORTS_PLACEABLE_ITEMS,
    }


def _build_fallback_details(
    *,
    reason: Any = None,
    source_error: Any = None,
    source_error_message: Any = None,
) -> dict[str, Any]:
    """
    Baut den `fallback`-Block der Response.
    """
    normalized_reason = _coerce_text(reason, "fallback-active")

    error_value = source_error
    if error_value is None:
        error_value = source_error_message

    return {
        "active": True,
        "reason": normalized_reason,
        "sourceError": _exception_payload(error_value)
        if isinstance(error_value, BaseException)
        else _to_json_compatible(error_value),
    }


def _build_diagnostics(
    *,
    request_method: Any = None,
    request_path: Any = None,
    request_id: Any = None,
    request_args: Any = None,
    extra: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Baut Diagnoseinformationen.
    """
    diagnostics = {
        "moduleName": INVENTORY_FALLBACK_MODULE_NAME,
        "moduleVersion": INVENTORY_FALLBACK_MODULE_VERSION,
        "requestMethod": _normalize_text(request_method),
        "requestPath": _normalize_text(request_path),
        "requestId": _normalize_text(request_id),
        "requestArgs": _safe_mapping(request_args),
    }

    if extra:
        diagnostics["extra"] = _to_json_compatible(extra)

    return diagnostics


# -----------------------------------------------------------------------------
# Öffentliche Payload-API
# -----------------------------------------------------------------------------

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
    Baut einen strukturell stabilen, aber fachlich leeren Fallback-Payload.

    Sicherheitsinvariante:
    - `allowPlaceAction` ist immer False.
    - alle Slots sind leer.
    - es gibt keine `runtimeBlockTypeId`.
    - es gibt keine `blockTypeId`.
    - es gibt keine `libraryRef`.
    - es gibt keine `placementCommand`.
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

    include_empty = _coerce_bool(
        include_empty_slots,
        _resolve_include_empty_slots(request_args, default=True),
    )

    slots = _build_empty_slots(
        hotbar_size=hotbar_size,
        selected_slot=selected_slot,
        include_empty_slots=include_empty,
    )

    generated_timestamp = _normalize_text(generated_at_utc) or _safe_utc_timestamp()
    normalized_route_path = _normalize_text(route_path) or DEFAULT_ROUTE_PATH

    return {
        "ok": False,
        "kind": INVENTORY_KIND,
        "schemaVersion": INVENTORY_SCHEMA_VERSION,
        "source": DEFAULT_FALLBACK_SOURCE,
        "sourceDetail": DEFAULT_FALLBACK_SOURCE_DETAIL,
        "generatedAtUtc": generated_timestamp,
        "route": normalized_route_path,
        "inventory": {
            "enabled": _resolve_inventory_enabled(
                config_source=config_source,
                request_args=request_args,
            ),
            "source": DEFAULT_FALLBACK_SOURCE,
            "sourceDetail": DEFAULT_FALLBACK_SOURCE_DETAIL,
            "hotbarSize": hotbar_size,
            "defaultSelectedSlot": selected_slot,
            "selectedSlot": selected_slot,
            "scrollWrap": _resolve_scroll_wrap(config_source),
            "allowPlaceAction": FALLBACK_ALLOW_PLACE_ACTION,
            "allowBreakAction": _resolve_allow_break_action(config_source),
            "iconOnly": _resolve_icon_only(config_source),
            "items": [],
            "slots": slots,
            "emptySlotCount": hotbar_size if include_empty else 0,
            "filledSlotCount": 0,
        },
        "capabilities": _build_capabilities(),
        "fallback": _build_fallback_details(
            reason=reason,
            source_error=source_error,
            source_error_message=source_error_message,
        ),
        "diagnostics": _build_diagnostics(
            request_method=request_method,
            request_path=request_path,
            request_id=request_id,
            request_args=request_args,
            extra=diagnostics_extra,
        ),
    }


# -----------------------------------------------------------------------------
# Metadaten / Health / Cache
# -----------------------------------------------------------------------------

def get_editor_inventory_fallback_metadata() -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten dieses Fallback-Moduls.
    """
    return {
        "moduleName": INVENTORY_FALLBACK_MODULE_NAME,
        "moduleVersion": INVENTORY_FALLBACK_MODULE_VERSION,
        "inventoryKind": INVENTORY_KIND,
        "schemaVersion": INVENTORY_SCHEMA_VERSION,
        "defaultHotbarSize": DEFAULT_HOTBAR_SIZE,
        "defaultSelectedSlot": DEFAULT_SELECTED_SLOT,
        "defaultRoutePath": DEFAULT_ROUTE_PATH,
        "fallbackSource": DEFAULT_FALLBACK_SOURCE,
        "fallbackSourceDetail": DEFAULT_FALLBACK_SOURCE_DETAIL,
        "rules": {
            "allowPlaceAction": FALLBACK_ALLOW_PLACE_ACTION,
            "supportsPlaceableItems": FALLBACK_SUPPORTS_PLACEABLE_ITEMS,
            "supportsDebugBlocks": FALLBACK_SUPPORTS_DEBUG_BLOCKS,
            "allSlotsEmpty": True,
        },
        "capabilities": _build_capabilities(),
    }


def get_editor_inventory_fallback_health() -> dict[str, Any]:
    """
    Liefert eine kompakte Health-Diagnose.
    """
    return {
        "ok": True,
        "status": "ok",
        "generatedAtUtc": _safe_utc_timestamp(),
        "metadata": get_editor_inventory_fallback_metadata(),
    }


def clear_editor_inventory_fallback_caches() -> None:
    """
    Löscht interne Caches dieses Fallback-Moduls.
    """
    cache_clearers = (
        _build_empty_slots_cached,
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
    "INVENTORY_FALLBACK_MODULE_NAME",
    "INVENTORY_FALLBACK_MODULE_VERSION",
    "INVENTORY_KIND",
    "INVENTORY_SCHEMA_VERSION",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "DEFAULT_ROUTE_PATH",
    "DEFAULT_FALLBACK_SOURCE",
    "DEFAULT_FALLBACK_SOURCE_DETAIL",
    "FALLBACK_ALLOW_PLACE_ACTION",
    "FALLBACK_SUPPORTS_PLACEABLE_ITEMS",
    "FALLBACK_SUPPORTS_DEBUG_BLOCKS",
    "build_fallback_editor_inventory_payload",
    "get_editor_inventory_fallback_metadata",
    "get_editor_inventory_fallback_health",
    "clear_editor_inventory_fallback_caches",
]