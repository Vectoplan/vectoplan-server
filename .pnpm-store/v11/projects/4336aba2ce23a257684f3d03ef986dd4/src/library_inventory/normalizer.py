# services/vectoplan-editor/src/library_inventory/normalizer.py
"""
Normalisierung für `vectoplan-library`-Inventory-/Published-Responses in
editorfreundliche Inventory-/Hotbar-Strukturen.

Zweck:
- `vectoplan-library` wird sich weiterentwickeln.
- Diese Datei nimmt unterschiedliche Response-Shapes tolerant an:
    - `/inventory`
    - `/blocks?source=db`
    - direkte `slots`
    - direkte `items`
    - verschachtelte `inventory.slots`
    - verschachtelte `data.items`
    - künftige Payload-Varianten
- Die Ausgabe bleibt stabil für den Editor:
    - vollständige Hotbar-Slots
    - nur VPLIB-/Library-Items sind placeable
    - leere Slots bleiben explizit erhalten
    - keine `debug_grass` / `debug_dirt`-Inventarwahrheit

Import-Richtung:

    src.inventory.payload
      -> src.library_inventory.normalizer
      -> src.library_inventory.mapper
      -> src.library_inventory.models

Diese Datei enthält bewusst:
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine HTTP-Requests
- keine direkte Chunk-/BlockWorld-Mutation
- keine Datenbanklogik

Wichtig:
- `runtimeBlockTypeId` ist ein Übergangsadapter für den aktuellen Runtime-/Chunk-
  Pfad.
- Fachlich maßgeblich sind `vplibUid`, `familyId`, `variantId`, `revisionHash`
  und `libraryRef`.
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

LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME: Final[str] = "src.library_inventory.normalizer"
LIBRARY_INVENTORY_NORMALIZER_MODULE_VERSION: Final[str] = "0.1.0"

MODELS_MODULE_NAME: Final[str] = "src.library_inventory.models"
MAPPER_MODULE_NAME: Final[str] = "src.library_inventory.mapper"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0
DEFAULT_SOURCE: Final[str] = "library"
DEFAULT_SOURCE_DETAIL_INVENTORY: Final[str] = "library-inventory"
DEFAULT_SOURCE_DETAIL_BLOCKS: Final[str] = "library-published-blocks"
DEFAULT_SOURCE_DETAIL_DIRECT: Final[str] = "direct-library-records"

MAX_HOTBAR_SIZE: Final[int] = 64

# Mapper-Funktionsnamen
BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "build_empty_editor_slot"
MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "map_library_item_to_editor_slot"
MAP_LIBRARY_SLOT_TO_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "map_library_slot_to_editor_slot"
MAP_LIBRARY_ITEMS_TO_EDITOR_SLOTS_FUNCTION_NAME: Final[str] = "map_library_items_to_editor_slots"
MAP_LIBRARY_SLOTS_TO_EDITOR_SLOTS_FUNCTION_NAME: Final[str] = "map_library_slots_to_editor_slots"
BUILD_EDITOR_INVENTORY_FROM_MAPPED_SLOTS_FUNCTION_NAME: Final[str] = "build_editor_inventory_from_mapped_slots"

# Models-Funktions-/Klassennamen
EDITOR_INVENTORY_ITEM_CLASS_NAME: Final[str] = "EditorInventoryItem"
EDITOR_INVENTORY_SLOT_CLASS_NAME: Final[str] = "EditorInventorySlot"
EDITOR_INVENTORY_STATE_CLASS_NAME: Final[str] = "EditorInventoryState"
EDITOR_INVENTORY_PAYLOAD_CLASS_NAME: Final[str] = "EditorInventoryPayload"


# -----------------------------------------------------------------------------
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

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


def _coerce_text(value: Any, default: str) -> str:
    normalized = _normalize_text(value, default)
    return normalized if normalized is not None else default


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


def _coerce_int(
    value: Any,
    default: int,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
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
    try:
        return datetime.now(UTC).isoformat()
    except Exception:
        try:
            return datetime.utcnow().isoformat() + "Z"
        except Exception:
            return "1970-01-01T00:00:00Z"


def _safe_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    if isinstance(value, Mapping):
        try:
            return dict(value)
        except Exception:
            return {}

    return {}


def _safe_sequence(value: Any) -> list[Any]:
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

    if isinstance(value, BaseException):
        return {
            "type": value.__class__.__name__,
            "message": _coerce_text(value, "Unbekannter Fehler."),
        }

    return _normalize_text(value)


def _exception_payload(exc: BaseException | str | None) -> dict[str, Any] | None:
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


def _model_to_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    if hasattr(value, "to_dict") and callable(value.to_dict):
        try:
            converted = value.to_dict()
            if isinstance(converted, dict):
                return converted
        except Exception:
            pass

    if dataclasses.is_dataclass(value):
        converted = _to_json_compatible(value)
        if isinstance(converted, dict):
            return converted

    if isinstance(value, Mapping):
        return dict(value)

    return {}


# -----------------------------------------------------------------------------
# Lazy Import / API-Auflösung
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


def _safe_get_attribute(module: ModuleType | None, attribute_name: str) -> Any:
    if module is None:
        return None

    try:
        return getattr(module, attribute_name, None)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _resolve_mapper_api() -> dict[str, Any]:
    mapper_module = _load_optional_module(MAPPER_MODULE_NAME)

    return {
        "module_available": mapper_module is not None,
        "module": mapper_module,
        "build_empty_slot": _safe_get_callable(mapper_module, BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME),
        "map_item_to_slot": _safe_get_callable(mapper_module, MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME),
        "map_slot_to_slot": _safe_get_callable(mapper_module, MAP_LIBRARY_SLOT_TO_EDITOR_SLOT_FUNCTION_NAME),
        "map_items_to_slots": _safe_get_callable(mapper_module, MAP_LIBRARY_ITEMS_TO_EDITOR_SLOTS_FUNCTION_NAME),
        "map_slots_to_slots": _safe_get_callable(mapper_module, MAP_LIBRARY_SLOTS_TO_EDITOR_SLOTS_FUNCTION_NAME),
        "build_inventory_from_slots": _safe_get_callable(mapper_module, BUILD_EDITOR_INVENTORY_FROM_MAPPED_SLOTS_FUNCTION_NAME),
    }


@lru_cache(maxsize=1)
def _resolve_models_api() -> dict[str, Any]:
    models_module = _load_optional_module(MODELS_MODULE_NAME)

    return {
        "module_available": models_module is not None,
        "module": models_module,
        "EditorInventoryItem": _safe_get_attribute(models_module, EDITOR_INVENTORY_ITEM_CLASS_NAME),
        "EditorInventorySlot": _safe_get_attribute(models_module, EDITOR_INVENTORY_SLOT_CLASS_NAME),
        "EditorInventoryState": _safe_get_attribute(models_module, EDITOR_INVENTORY_STATE_CLASS_NAME),
        "EditorInventoryPayload": _safe_get_attribute(models_module, EDITOR_INVENTORY_PAYLOAD_CLASS_NAME),
    }


def _call_with_supported_kwargs(
    callback: Callable[..., Any],
    kwargs: Mapping[str, Any],
) -> Any:
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
# Payload-Shape-Extraktion
# -----------------------------------------------------------------------------

INVENTORY_SLOT_PATHS: Final[tuple[tuple[str, ...], ...]] = (
    ("inventory", "slots"),
    ("slots",),
    ("data", "inventory", "slots"),
    ("data", "slots"),
    ("result", "inventory", "slots"),
    ("result", "slots"),
)

PUBLISHED_ITEM_PATHS: Final[tuple[tuple[str, ...], ...]] = (
    ("items",),
    ("blocks",),
    ("data", "items"),
    ("data", "blocks"),
    ("result", "items"),
    ("result", "blocks"),
    ("library", "items"),
    ("inventory", "items"),
)


def extract_inventory_slots(payload: Mapping[str, Any] | Any) -> list[dict[str, Any]]:
    """
    Extrahiert rohe Inventory-Slots aus diversen Library-Response-Shapes.
    """
    mapping = _safe_mapping(payload)
    if not mapping:
        return []

    for path in INVENTORY_SLOT_PATHS:
        value = _deep_get(mapping, path, None)
        slots = _safe_list_of_mappings(value)
        if slots:
            return slots

    return []


def extract_published_items(payload: Mapping[str, Any] | Any) -> list[dict[str, Any]]:
    """
    Extrahiert rohe Published-Library-Items aus diversen Response-Shapes.
    """
    mapping = _safe_mapping(payload)
    if not mapping:
        return []

    for path in PUBLISHED_ITEM_PATHS:
        value = _deep_get(mapping, path, None)
        items = _safe_list_of_mappings(value)
        if items:
            return items

    return []


def detect_library_payload_kind(payload: Mapping[str, Any] | Any) -> str:
    """
    Erkennt grob den Library-Payload-Typ.
    """
    mapping = _safe_mapping(payload)
    if not mapping:
        return "empty"

    if extract_inventory_slots(mapping):
        return "inventory"

    if extract_published_items(mapping):
        return "published-items"

    if _safe_list_of_mappings(mapping.get("slots")):
        return "slots"

    if _safe_list_of_mappings(mapping.get("items")):
        return "items"

    return "unknown"


# -----------------------------------------------------------------------------
# Normalisierung einzelner Records
# -----------------------------------------------------------------------------

def normalize_library_item(record: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> dict[str, Any]:
    """
    Normalisiert ein einzelnes Library-Item in ein editorfreundliches Item-Dict.
    """
    models_api = _resolve_models_api()
    item_cls = models_api.get("EditorInventoryItem")
    mapping = _safe_mapping(record)

    if item_cls is not None:
        try:
            if isinstance(record, item_cls):
                return _model_to_dict(record)
        except Exception:
            pass

        try:
            if hasattr(item_cls, "from_library_record"):
                return _model_to_dict(item_cls.from_library_record(mapping))
        except Exception:
            pass

        try:
            if hasattr(item_cls, "from_mapping"):
                return _model_to_dict(item_cls.from_mapping(mapping))
        except Exception:
            pass

    # Fallback über Mapper als Slot und daraus Itemanteile extrahieren.
    mapper_api = _resolve_mapper_api()
    map_item = mapper_api.get("map_item_to_slot")

    if callable(map_item):
        try:
            slot = _call_with_supported_kwargs(
                map_item,
                {
                    "record": mapping,
                    "item": mapping,
                    "slot_index": 0,
                    "slotIndex": 0,
                    "selected_slot": 0,
                    "selectedSlot": 0,
                    "icon_only": False,
                    "iconOnly": False,
                },
            )
            slot_dict = _model_to_dict(slot)
            if slot_dict:
                return _item_dict_from_slot_dict(slot_dict)
        except Exception:
            pass

    return _minimal_item_from_mapping(mapping)


def normalize_library_slot(record: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> dict[str, Any]:
    """
    Normalisiert einen Library-Inventory-Slot in ein editorfreundliches Slot-Dict.
    """
    models_api = _resolve_models_api()
    slot_cls = models_api.get("EditorInventorySlot")
    mapping = _safe_mapping(record)

    if slot_cls is not None:
        try:
            if isinstance(record, slot_cls):
                return _model_to_dict(record)
        except Exception:
            pass

        try:
            if hasattr(slot_cls, "from_mapping"):
                return _model_to_dict(slot_cls.from_mapping(mapping))
        except Exception:
            pass

    mapper_api = _resolve_mapper_api()
    map_slot = mapper_api.get("map_slot_to_slot")

    if callable(map_slot):
        try:
            slot = _call_with_supported_kwargs(
                map_slot,
                {
                    "record": mapping,
                    "slot": mapping,
                    "slot_index": _slot_index_from_record(mapping, 0),
                    "slotIndex": _slot_index_from_record(mapping, 0),
                    "selected_slot": 0,
                    "selectedSlot": 0,
                    "icon_only": False,
                    "iconOnly": False,
                },
            )
            slot_dict = _model_to_dict(slot)
            if slot_dict:
                return slot_dict
        except Exception:
            pass

    return _minimal_slot_from_mapping(mapping)


def _slot_index_from_record(record: Mapping[str, Any], fallback_index: int) -> int:
    value = _read_mapping_any(
        record,
        ("slotIndex", "slot_index", "index", "slot", "slotId", "slot_id"),
        fallback_index,
    )
    return _coerce_int(value, fallback_index, minimum=0, maximum=MAX_HOTBAR_SIZE - 1)


def _minimal_item_from_mapping(mapping: Mapping[str, Any]) -> dict[str, Any]:
    """
    Minimaler Item-Fallback ohne Model-/Mapper-Abhängigkeit.
    """
    family_id = _normalize_text(mapping.get("familyId") or mapping.get("family_id") or mapping.get("id"))
    vplib_uid = _normalize_text(mapping.get("vplibUid") or mapping.get("vplib_uid"))
    variant_id = _coerce_text(mapping.get("variantId") or mapping.get("variant_id") or mapping.get("defaultVariantId") or mapping.get("default_variant_id"), "default")
    runtime_block_type_id = _normalize_text(
        mapping.get("runtimeBlockTypeId")
        or mapping.get("runtime_block_type_id")
        or mapping.get("blockTypeId")
        or mapping.get("block_type_id")
        or family_id
        or (f"vplib:{vplib_uid}:{variant_id}" if vplib_uid else None)
    )
    item_id = _coerce_text(
        mapping.get("itemId")
        or mapping.get("item_id")
        or mapping.get("libraryItemId")
        or mapping.get("library_item_id")
        or family_id
        or vplib_uid
        or runtime_block_type_id,
        "library-item",
    )
    label = _coerce_text(mapping.get("label") or mapping.get("name") or family_id or vplib_uid, "VPLIB Item")

    return {
        "itemId": item_id,
        "itemKind": "vplib",
        "kind": "vplib",
        "source": "library",
        "label": label,
        "familyId": family_id,
        "packageId": _normalize_text(mapping.get("packageId") or mapping.get("package_id")),
        "vplibUid": vplib_uid,
        "variantId": variant_id,
        "revisionHash": _normalize_text(mapping.get("revisionHash") or mapping.get("revision_hash")),
        "objectKind": _coerce_text(mapping.get("objectKind") or mapping.get("object_kind"), "library_item"),
        "runtimeBlockTypeId": runtime_block_type_id,
        "blockTypeId": runtime_block_type_id,
        "placeable": bool(runtime_block_type_id and (family_id or vplib_uid)),
        "raw": _to_json_compatible(mapping),
    }


def _minimal_slot_from_mapping(mapping: Mapping[str, Any]) -> dict[str, Any]:
    """
    Minimaler Slot-Fallback ohne Model-/Mapper-Abhängigkeit.
    """
    item = _minimal_item_from_mapping(mapping)
    slot_index = _slot_index_from_record(mapping, 0)

    if not _coerce_bool(item.get("placeable"), False):
        return _empty_slot(slot_index, selected_slot=0)

    label = _coerce_text(item.get("label"), "VPLIB Item")
    runtime_block_type_id = _normalize_text(item.get("runtimeBlockTypeId"))
    icon_key = f"vplib-{_coerce_text(item.get('familyId') or item.get('objectKind') or item.get('itemId'), 'item').replace('.', '-').replace(':', '-').replace('/', '-')}"

    library_ref = {
        "source": "vectoplan-library",
        "kind": "vplib",
        "libraryItemId": item.get("itemId"),
        "familyId": item.get("familyId"),
        "packageId": item.get("packageId"),
        "vplibUid": item.get("vplibUid"),
        "variantId": item.get("variantId"),
        "revisionHash": item.get("revisionHash"),
        "objectKind": item.get("objectKind"),
    }

    placement_command = {
        "kind": "PlaceLibraryItem",
        "source": "vectoplan-library",
        "runtimeBlockTypeId": runtime_block_type_id,
        "blockTypeId": runtime_block_type_id,
        "libraryRef": library_ref,
    }

    return {
        "slotIndex": slot_index,
        "slotKey": f"hotbar-{slot_index}",
        "empty": False,
        "enabled": True,
        "selected": False,
        "source": "library",
        "sourceKind": "vplib",
        "itemId": item.get("itemId"),
        "itemKind": "vplib",
        "kind": "vplib",
        "type": item.get("objectKind"),
        "blockTypeId": runtime_block_type_id,
        "runtimeBlockTypeId": runtime_block_type_id,
        "placeable": True,
        "breakable": False,
        "iconKey": icon_key,
        "iconKind": "library-item",
        "iconUrl": None,
        "icon": {
            "key": icon_key,
            "kind": "library-item",
            "url": None,
            "placeholder": True,
            "cssClass": f"editor-hotbar-slot-icon--{icon_key}",
            "ariaHidden": False,
        },
        "label": label,
        "displayLabel": label,
        "visibleLabel": True,
        "ariaLabel": f"Inventar-Slot {slot_index + 1}: {label}",
        "title": label,
        "familyId": item.get("familyId"),
        "packageId": item.get("packageId"),
        "vplibUid": item.get("vplibUid"),
        "variantId": item.get("variantId"),
        "revisionHash": item.get("revisionHash"),
        "objectKind": item.get("objectKind"),
        "libraryRef": library_ref,
        "placementCommand": placement_command,
        "metadata": {
            "source": "vectoplan-library",
            "vplib": True,
        },
    }


def _item_dict_from_slot_dict(slot: Mapping[str, Any]) -> dict[str, Any]:
    """
    Extrahiert ein Item-Dict aus einem Slot-Dict.
    """
    return {
        "itemId": _normalize_text(slot.get("itemId")),
        "itemKind": _coerce_text(slot.get("itemKind"), "vplib"),
        "kind": _coerce_text(slot.get("kind"), "vplib"),
        "source": _coerce_text(slot.get("source"), "library"),
        "label": _coerce_text(slot.get("label"), "VPLIB Item"),
        "description": _normalize_text(slot.get("description"), ""),
        "familyId": _normalize_text(slot.get("familyId")),
        "packageId": _normalize_text(slot.get("packageId")),
        "vplibUid": _normalize_text(slot.get("vplibUid")),
        "variantId": _coerce_text(slot.get("variantId"), "default"),
        "revisionHash": _normalize_text(slot.get("revisionHash")),
        "objectKind": _coerce_text(slot.get("objectKind"), "library_item"),
        "runtimeBlockTypeId": _normalize_text(slot.get("runtimeBlockTypeId") or slot.get("blockTypeId")),
        "blockTypeId": _normalize_text(slot.get("blockTypeId") or slot.get("runtimeBlockTypeId")),
        "placeable": _coerce_bool(slot.get("placeable"), False),
        "libraryRef": _to_json_compatible(slot.get("libraryRef")),
        "placementCommand": _to_json_compatible(slot.get("placementCommand")),
        "metadata": _to_json_compatible(_safe_mapping(slot.get("metadata"))),
    }


def _empty_slot(slot_index: int, *, selected_slot: int) -> dict[str, Any]:
    safe_index = _coerce_int(slot_index, 0, minimum=0)

    return {
        "slotIndex": safe_index,
        "slotKey": f"hotbar-{safe_index}",
        "empty": True,
        "enabled": True,
        "selected": safe_index == selected_slot,
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
        "label": "",
        "displayLabel": "",
        "visibleLabel": False,
        "libraryRef": None,
        "placementCommand": None,
        "metadata": {},
    }


# -----------------------------------------------------------------------------
# Inventory-Builder
# -----------------------------------------------------------------------------

def build_editor_inventory_from_library(
    *,
    raw_slots: Sequence[Mapping[str, Any]] | None = None,
    raw_items: Sequence[Mapping[str, Any]] | None = None,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
    source: str = DEFAULT_SOURCE,
    source_detail: str | None = None,
) -> dict[str, Any]:
    """
    Baut eine vollständige editorfreundliche Inventory-Struktur aus rohen
    Library-Slots oder Library-Items.
    """
    safe_hotbar_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
    safe_selected_slot = _coerce_int(
        selected_slot,
        DEFAULT_SELECTED_SLOT,
        minimum=0,
        maximum=max(0, safe_hotbar_size - 1),
    )

    mapper_api = _resolve_mapper_api()

    if raw_slots:
        mapper = mapper_api.get("map_slots_to_slots")
        if callable(mapper):
            try:
                slots = _call_with_supported_kwargs(
                    mapper,
                    {
                        "records": raw_slots,
                        "raw_slots": raw_slots,
                        "hotbar_size": safe_hotbar_size,
                        "hotbarSize": safe_hotbar_size,
                        "selected_slot": safe_selected_slot,
                        "selectedSlot": safe_selected_slot,
                        "icon_only": icon_only,
                        "iconOnly": icon_only,
                    },
                )
                slots_list = _safe_list_of_mappings(slots)
                if slots_list:
                    return _build_inventory_from_slots(
                        slots_list,
                        hotbar_size=safe_hotbar_size,
                        selected_slot=safe_selected_slot,
                        source=source,
                        source_detail=source_detail or DEFAULT_SOURCE_DETAIL_INVENTORY,
                        icon_only=icon_only,
                    )
            except Exception:
                pass

        mapped_slots = [
            normalize_library_slot(slot)
            for slot in _safe_list_of_mappings(raw_slots)
        ]
        return _build_inventory_from_slots(
            mapped_slots,
            hotbar_size=safe_hotbar_size,
            selected_slot=safe_selected_slot,
            source=source,
            source_detail=source_detail or DEFAULT_SOURCE_DETAIL_INVENTORY,
            icon_only=icon_only,
        )

    if raw_items:
        mapper = mapper_api.get("map_items_to_slots")
        if callable(mapper):
            try:
                slots = _call_with_supported_kwargs(
                    mapper,
                    {
                        "records": raw_items,
                        "raw_items": raw_items,
                        "hotbar_size": safe_hotbar_size,
                        "hotbarSize": safe_hotbar_size,
                        "selected_slot": safe_selected_slot,
                        "selectedSlot": safe_selected_slot,
                        "icon_only": icon_only,
                        "iconOnly": icon_only,
                    },
                )
                slots_list = _safe_list_of_mappings(slots)
                if slots_list:
                    return _build_inventory_from_slots(
                        slots_list,
                        hotbar_size=safe_hotbar_size,
                        selected_slot=safe_selected_slot,
                        source=source,
                        source_detail=source_detail or DEFAULT_SOURCE_DETAIL_BLOCKS,
                        icon_only=icon_only,
                    )
            except Exception:
                pass

        mapper = mapper_api.get("map_item_to_slot")
        mapped_slots: list[dict[str, Any]] = []
        for index, item in enumerate(_safe_list_of_mappings(raw_items)[:safe_hotbar_size]):
            mapped = None
            if callable(mapper):
                try:
                    mapped = _call_with_supported_kwargs(
                        mapper,
                        {
                            "record": item,
                            "item": item,
                            "slot_index": index,
                            "slotIndex": index,
                            "selected_slot": safe_selected_slot,
                            "selectedSlot": safe_selected_slot,
                            "hotbar_size": safe_hotbar_size,
                            "hotbarSize": safe_hotbar_size,
                            "icon_only": icon_only,
                            "iconOnly": icon_only,
                        },
                    )
                except Exception:
                    mapped = None

            mapped_dict = _model_to_dict(mapped) if mapped is not None else None
            if not mapped_dict:
                mapped_dict = _minimal_slot_from_mapping(item)

            if mapped_dict:
                mapped_slots.append(mapped_dict)

        return _build_inventory_from_slots(
            mapped_slots,
            hotbar_size=safe_hotbar_size,
            selected_slot=safe_selected_slot,
            source=source,
            source_detail=source_detail or DEFAULT_SOURCE_DETAIL_BLOCKS,
            icon_only=icon_only,
        )

    return _build_inventory_from_slots(
        [],
        hotbar_size=safe_hotbar_size,
        selected_slot=safe_selected_slot,
        source=source,
        source_detail=source_detail or "empty",
        icon_only=icon_only,
    )


def _build_inventory_from_slots(
    slots: Sequence[Mapping[str, Any]] | Any,
    *,
    hotbar_size: int,
    selected_slot: int,
    source: str,
    source_detail: str,
    icon_only: bool,
) -> dict[str, Any]:
    """
    Baut finale Inventory-Struktur aus Slot-Dicts.
    """
    safe_hotbar_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
    safe_selected_slot = _coerce_int(selected_slot, DEFAULT_SELECTED_SLOT, minimum=0, maximum=max(0, safe_hotbar_size - 1))

    mapper_api = _resolve_mapper_api()
    builder = mapper_api.get("build_inventory_from_slots")

    if callable(builder):
        try:
            inventory = _call_with_supported_kwargs(
                builder,
                {
                    "slots": slots,
                    "hotbar_size": safe_hotbar_size,
                    "hotbarSize": safe_hotbar_size,
                    "selected_slot": safe_selected_slot,
                    "selectedSlot": safe_selected_slot,
                    "source": source,
                    "source_detail": source_detail,
                    "sourceDetail": source_detail,
                    "icon_only": icon_only,
                    "iconOnly": icon_only,
                },
            )
            inventory_dict = _model_to_dict(inventory)
            if inventory_dict:
                return inventory_dict
        except Exception:
            pass

    slot_list = _safe_list_of_mappings(slots)
    by_index: dict[int, dict[str, Any]] = {}

    for fallback_index, slot in enumerate(slot_list):
        slot_index = _slot_index_from_record(slot, fallback_index)
        if 0 <= slot_index < safe_hotbar_size:
            slot_copy = dict(slot)
            slot_copy["slotIndex"] = slot_index
            slot_copy["selected"] = slot_index == safe_selected_slot
            by_index[slot_index] = slot_copy

    normalized_slots = [
        by_index.get(index) or _empty_slot(index, selected_slot=safe_selected_slot)
        for index in range(safe_hotbar_size)
    ]

    items: list[dict[str, Any]] = []
    seen_item_ids: set[str] = set()

    for slot in normalized_slots:
        if _coerce_bool(slot.get("empty"), True):
            continue

        item = _item_dict_from_slot_dict(slot)
        item_id = _normalize_text(item.get("itemId"))

        if not item_id or item_id in seen_item_ids:
            continue

        seen_item_ids.add(item_id)
        items.append(item)

    filled_count = sum(1 for slot in normalized_slots if not _coerce_bool(slot.get("empty"), True))
    placeable_count = sum(1 for slot in normalized_slots if _coerce_bool(slot.get("placeable"), False))

    return {
        "enabled": True,
        "source": source,
        "sourceDetail": source_detail,
        "hotbarSize": safe_hotbar_size,
        "defaultSelectedSlot": safe_selected_slot,
        "selectedSlot": safe_selected_slot,
        "scrollWrap": True,
        "allowPlaceAction": placeable_count > 0,
        "allowBreakAction": True,
        "iconOnly": icon_only,
        "items": items,
        "slots": normalized_slots,
        "emptySlotCount": safe_hotbar_size - filled_count,
        "filledSlotCount": filled_count,
        "placeableSlotCount": placeable_count,
        "hasPlaceableItems": placeable_count > 0,
    }


# -----------------------------------------------------------------------------
# Root-Payload-Normalisierung
# -----------------------------------------------------------------------------

def normalize_library_inventory(
    payload: Mapping[str, Any] | Any = None,
    *,
    raw_slots: Sequence[Mapping[str, Any]] | None = None,
    raw_items: Sequence[Mapping[str, Any]] | None = None,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
    source: str = DEFAULT_SOURCE,
    source_detail: str | None = None,
    include_empty_slots: bool = True,
    route: str = "/editor/api/inventory",
    generated_at_utc: str | None = None,
    diagnostics: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Normalisiert eine komplette Library-Response oder direkte Slots/Items in
    eine editorfreundliche Inventory-Root-Struktur.
    """
    mapping = _safe_mapping(payload)

    resolved_slots = list(raw_slots or [])
    resolved_items = list(raw_items or [])
    detected_kind = "explicit"

    if mapping and not resolved_slots and not resolved_items:
        detected_kind = detect_library_payload_kind(mapping)

        if detected_kind in {"inventory", "slots"}:
            resolved_slots = extract_inventory_slots(mapping)

        if not resolved_slots:
            resolved_items = extract_published_items(mapping)

    if resolved_slots:
        resolved_source_detail = source_detail or DEFAULT_SOURCE_DETAIL_INVENTORY
    elif resolved_items:
        resolved_source_detail = source_detail or DEFAULT_SOURCE_DETAIL_BLOCKS
    else:
        resolved_source_detail = source_detail or "empty"

    inventory = build_editor_inventory_from_library(
        raw_slots=resolved_slots,
        raw_items=resolved_items,
        hotbar_size=hotbar_size,
        selected_slot=selected_slot,
        icon_only=icon_only,
        source=source,
        source_detail=resolved_source_detail,
    )

    if not include_empty_slots:
        slots = [
            slot
            for slot in _safe_list_of_mappings(inventory.get("slots"))
            if not _coerce_bool(slot.get("empty"), True)
        ]
        inventory = dict(inventory)
        inventory["slots"] = slots

    placeable_count = _coerce_int(inventory.get("placeableSlotCount"), 0, minimum=0)
    if placeable_count <= 0:
        placeable_count = sum(
            1
            for slot in _safe_list_of_mappings(inventory.get("slots"))
            if _coerce_bool(slot.get("placeable"), False)
        )

    root_diagnostics = {
        "normalizer": {
            "moduleName": LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME,
            "moduleVersion": LIBRARY_INVENTORY_NORMALIZER_MODULE_VERSION,
            "detectedPayloadKind": detected_kind,
            "rawSlotCount": len(resolved_slots),
            "rawItemCount": len(resolved_items),
        }
    }
    if diagnostics:
        root_diagnostics.update(_to_json_compatible(diagnostics))

    return {
        "ok": placeable_count > 0,
        "kind": "editor-inventory",
        "schemaVersion": "editor-inventory.v1",
        "source": source,
        "sourceDetail": resolved_source_detail,
        "generatedAtUtc": _normalize_text(generated_at_utc) or _safe_utc_timestamp(),
        "route": route,
        "inventory": inventory,
        "capabilities": {
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
        },
        "fallback": {
            "active": placeable_count <= 0,
            "reason": None if placeable_count > 0 else "no-placeable-library-items",
        },
        "diagnostics": root_diagnostics,
    }


# -----------------------------------------------------------------------------
# Metadaten / Cache
# -----------------------------------------------------------------------------

def get_library_inventory_normalizer_metadata() -> dict[str, Any]:
    try:
        mapper_api = _resolve_mapper_api()
        mapper_available = _coerce_bool(mapper_api.get("module_available"), False)
        mapper_error = None
    except Exception as exc:
        mapper_available = False
        mapper_error = exc

    try:
        models_api = _resolve_models_api()
        models_available = _coerce_bool(models_api.get("module_available"), False)
        models_error = None
    except Exception as exc:
        models_available = False
        models_error = exc

    return {
        "moduleName": LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME,
        "moduleVersion": LIBRARY_INVENTORY_NORMALIZER_MODULE_VERSION,
        "generatedAtUtc": _safe_utc_timestamp(),
        "modelsModuleName": MODELS_MODULE_NAME,
        "mapperModuleName": MAPPER_MODULE_NAME,
        "modelsAvailable": models_available,
        "mapperAvailable": mapper_available,
        "modelsError": _to_json_compatible(models_error),
        "mapperError": _to_json_compatible(mapper_error),
        "supportedPayloadShapes": {
            "inventorySlots": ["/inventory/slots", "/slots", "/data/inventory/slots"],
            "publishedItems": ["/items", "/blocks", "/data/items", "/data/blocks"],
        },
        "rules": {
            "debugGrassDirtGenerated": False,
            "onlyLibraryItemsPlaceable": True,
            "runtimeBlockTypeIdIsTemporaryAdapter": True,
            "unknownFieldsPreservedViaModels": models_available,
        },
    }


def clear_library_inventory_normalizer_caches() -> None:
    cache_clearers = (
        _candidate_missing_names,
        _load_optional_module,
        _resolve_mapper_api,
        _resolve_models_api,
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
    "LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME",
    "LIBRARY_INVENTORY_NORMALIZER_MODULE_VERSION",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "DEFAULT_SOURCE",
    "DEFAULT_SOURCE_DETAIL_INVENTORY",
    "DEFAULT_SOURCE_DETAIL_BLOCKS",
    "extract_inventory_slots",
    "extract_published_items",
    "detect_library_payload_kind",
    "normalize_library_item",
    "normalize_library_slot",
    "build_editor_inventory_from_library",
    "normalize_library_inventory",
    "get_library_inventory_normalizer_metadata",
    "clear_library_inventory_normalizer_caches",
]