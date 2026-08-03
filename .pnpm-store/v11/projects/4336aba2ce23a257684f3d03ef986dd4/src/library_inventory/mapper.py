# services/vectoplan-editor/src/library_inventory/mapper.py
"""
Mapping-Funktionen für `vectoplan-library`-Daten in editorfreundliche
Inventory-/Hotbar-Slots.

Zweck:
- `vectoplan-library` liefert Published Blocks, Inventory Slots, Families,
  Variants und künftig weitere Payload-Formen.
- Der Editor braucht stabile Hotbar-/Inventory-Slots.
- Dieses Modul bildet Library-Items und Library-Inventory-Slots auf
  `EditorInventorySlot` / JSON-kompatible Slot-Payloads ab.
- Nur Library-/VPLIB-Items dürfen placeable sein.
- Es werden keine `debug_grass` / `debug_dirt` Items erzeugt.

Import-Richtung:

    src.library_inventory.__init__
      -> src.library_inventory.mapper
      -> src.library_inventory.models

Diese Datei enthält bewusst:
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine HTTP-Requests
- keine direkte Chunk-/BlockWorld-Mutation
- keine Datenbanklogik

Wichtige Zukunftssicherheit:
- Unbekannte Library-Felder bleiben in `raw`, `extra` oder `metadata` erhalten.
- `runtimeBlockTypeId` ist ein temporärer Adapter für den aktuellen Runtime-/
  Chunk-Pfad. Fachlich maßgeblich bleiben `vplibUid`, `familyId`, `variantId`
  und `revisionHash`.
"""

from __future__ import annotations

import dataclasses
import importlib
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import UTC, datetime
from functools import lru_cache
from types import ModuleType
from typing import Any, Final


# -----------------------------------------------------------------------------
# Modulkonstanten
# -----------------------------------------------------------------------------

LIBRARY_INVENTORY_MAPPER_MODULE_NAME: Final[str] = "src.library_inventory.mapper"
LIBRARY_INVENTORY_MAPPER_MODULE_VERSION: Final[str] = "0.1.0"

MODELS_MODULE_NAME: Final[str] = "src.library_inventory.models"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0
DEFAULT_VARIANT_ID: Final[str] = "default"
DEFAULT_SOURCE: Final[str] = "library"
DEFAULT_LIBRARY_SOURCE_NAME: Final[str] = "vectoplan-library"
DEFAULT_ICON_KIND: Final[str] = "library-item"
DEFAULT_OBJECT_KIND: Final[str] = "library_item"
DEFAULT_PLACE_COMMAND_KIND: Final[str] = "PlaceLibraryItem"

MAX_HOTBAR_SIZE: Final[int] = 64


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


def _slug_from_text(value: Any, default: str = "item") -> str:
    text = _coerce_text(value, default).lower()
    result_chars: list[str] = []
    previous_dash = False

    for char in text:
        if char.isalnum():
            result_chars.append(char)
            previous_dash = False
        elif char in {"_", "-", ".", ":", "/", " "}:
            if not previous_dash:
                result_chars.append("-")
                previous_dash = True

    slug = "".join(result_chars).strip("-")
    return slug or default


# -----------------------------------------------------------------------------
# Lazy Models-Auflösung
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


@lru_cache(maxsize=1)
def _load_models_module() -> ModuleType | None:
    try:
        return importlib.import_module(MODELS_MODULE_NAME)
    except ModuleNotFoundError as exc:
        if _is_missing_target_module(exc, MODELS_MODULE_NAME):
            return None

        raise RuntimeError(
            f"Das Models-Modul `{MODELS_MODULE_NAME}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Models-Modul `{MODELS_MODULE_NAME}` konnte nicht importiert werden."
        ) from exc


@lru_cache(maxsize=1)
def _resolve_models_api() -> dict[str, Any]:
    module = _load_models_module()

    if module is None:
        return {
            "available": False,
            "module": None,
            "EditorInventoryItem": None,
            "EditorInventorySlot": None,
            "EditorInventoryState": None,
            "EditorInventoryPayload": None,
            "EditorLibraryRef": None,
            "EditorPlacementCommand": None,
        }

    def _get(name: str) -> Any:
        try:
            return getattr(module, name, None)
        except Exception:
            return None

    return {
        "available": True,
        "module": module,
        "EditorInventoryItem": _get("EditorInventoryItem"),
        "EditorInventorySlot": _get("EditorInventorySlot"),
        "EditorInventoryState": _get("EditorInventoryState"),
        "EditorInventoryPayload": _get("EditorInventoryPayload"),
        "EditorLibraryRef": _get("EditorLibraryRef"),
        "EditorPlacementCommand": _get("EditorPlacementCommand"),
        "to_json_compatible": _get("to_json_compatible"),
        "slug_from_text": _get("slug_from_text"),
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
# Slot-Index / Normalisierung
# -----------------------------------------------------------------------------

def normalize_slot_index(
    value: Any,
    *,
    fallback_index: int = 0,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
) -> int:
    """
    Normalisiert einen Slot-Index.
    """
    safe_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
    return _coerce_int(
        value,
        fallback_index,
        minimum=0,
        maximum=max(0, safe_size - 1),
    )


def extract_slot_index(
    record: Mapping[str, Any] | MutableMapping[str, Any] | Any,
    *,
    fallback_index: int = 0,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
) -> int:
    """
    Extrahiert einen Slot-Index aus einem Library-Inventory-Slot.
    """
    mapping = _safe_mapping(record)
    value = _read_mapping_any(
        mapping,
        (
            "slotIndex",
            "slot_index",
            "index",
            "slot",
            "slotId",
            "slot_id",
        ),
        fallback_index,
    )

    return normalize_slot_index(
        value,
        fallback_index=fallback_index,
        hotbar_size=hotbar_size,
    )


def _normalize_icon_only(value: Any = None, default: bool = False) -> bool:
    return _coerce_bool(value, default)


def _is_item_placeable(item_dict: Mapping[str, Any]) -> bool:
    runtime_block_type_id = _normalize_text(
        item_dict.get("runtimeBlockTypeId")
        or item_dict.get("runtime_block_type_id")
        or item_dict.get("blockTypeId")
        or item_dict.get("block_type_id")
    )
    family_id = _normalize_text(item_dict.get("familyId") or item_dict.get("family_id"))
    vplib_uid = _normalize_text(item_dict.get("vplibUid") or item_dict.get("vplib_uid"))

    return bool(runtime_block_type_id and (family_id or vplib_uid))


def _coerce_item_model(record: Any) -> Any | None:
    api = _resolve_models_api()
    item_cls = api.get("EditorInventoryItem")

    if item_cls is not None:
        try:
            if isinstance(record, item_cls):
                return record
        except Exception:
            pass

        try:
            if hasattr(item_cls, "from_library_record"):
                return item_cls.from_library_record(record)
        except Exception:
            pass

        try:
            if hasattr(item_cls, "from_mapping"):
                return item_cls.from_mapping(record)
        except Exception:
            pass

    return None


def _coerce_slot_model(
    value: Any,
    *,
    fallback_index: int,
    selected_slot: int,
) -> Any | None:
    api = _resolve_models_api()
    slot_cls = api.get("EditorInventorySlot")

    if slot_cls is not None:
        try:
            if isinstance(value, slot_cls):
                return value
        except Exception:
            pass

        try:
            if hasattr(slot_cls, "from_mapping"):
                return slot_cls.from_mapping(
                    value,
                    fallback_index=fallback_index,
                    selected_slot=selected_slot,
                )
        except Exception:
            pass

    return None


# -----------------------------------------------------------------------------
# Fallback-Mapping ohne Models-Abhängigkeit
# -----------------------------------------------------------------------------

def _fallback_normalize_library_item(record: Mapping[str, Any]) -> dict[str, Any]:
    """
    Minimale fallback-Normalisierung, falls `models.py` nicht verfügbar ist.
    """
    nested_item = _safe_mapping(
        record.get("item")
        or record.get("libraryItem")
        or record.get("library_item")
        or record.get("block")
        or record.get("family")
    )
    nested_variant = _safe_mapping(
        record.get("variant")
        or record.get("defaultVariant")
        or record.get("default_variant")
        or nested_item.get("variant")
        or nested_item.get("defaultVariant")
        or nested_item.get("default_variant")
    )

    def _first(*values: Any, default: str | None = None) -> str | None:
        for value in values:
            normalized = _normalize_text(value)
            if normalized:
                return normalized
        return default

    family_id = _first(
        record.get("familyId"),
        record.get("family_id"),
        record.get("id"),
        nested_item.get("familyId"),
        nested_item.get("family_id"),
        nested_item.get("id"),
    )
    package_id = _first(
        record.get("packageId"),
        record.get("package_id"),
        nested_item.get("packageId"),
        nested_item.get("package_id"),
    )
    vplib_uid = _first(
        record.get("vplibUid"),
        record.get("vplib_uid"),
        nested_item.get("vplibUid"),
        nested_item.get("vplib_uid"),
    )
    variant_id = _coerce_text(
        _first(
            record.get("variantId"),
            record.get("variant_id"),
            record.get("defaultVariantId"),
            record.get("default_variant_id"),
            nested_item.get("variantId"),
            nested_item.get("variant_id"),
            nested_item.get("defaultVariantId"),
            nested_item.get("default_variant_id"),
            nested_variant.get("variantId"),
            nested_variant.get("variant_id"),
            nested_variant.get("id"),
        ),
        DEFAULT_VARIANT_ID,
    )
    label = _coerce_text(
        _first(
            record.get("label"),
            record.get("name"),
            record.get("title"),
            nested_item.get("label"),
            nested_item.get("name"),
            nested_item.get("title"),
            family_id,
            vplib_uid,
        ),
        "VPLIB Item",
    )
    object_kind = _coerce_text(
        _first(
            record.get("objectKind"),
            record.get("object_kind"),
            nested_item.get("objectKind"),
            nested_item.get("object_kind"),
        ),
        DEFAULT_OBJECT_KIND,
    )
    runtime_block_type_id = _first(
        record.get("runtimeBlockTypeId"),
        record.get("runtime_block_type_id"),
        record.get("chunkBlockTypeId"),
        record.get("chunk_block_type_id"),
        record.get("blockTypeId"),
        record.get("block_type_id"),
        nested_item.get("runtimeBlockTypeId"),
        nested_item.get("runtime_block_type_id"),
        nested_item.get("chunkBlockTypeId"),
        nested_item.get("chunk_block_type_id"),
        nested_item.get("blockTypeId"),
        nested_item.get("block_type_id"),
    )
    if not runtime_block_type_id:
        runtime_block_type_id = family_id or (f"vplib:{vplib_uid}:{variant_id}" if vplib_uid else None)

    item_id = _coerce_text(
        _first(
            record.get("libraryItemId"),
            record.get("library_item_id"),
            record.get("itemId"),
            record.get("item_id"),
            nested_item.get("libraryItemId"),
            nested_item.get("library_item_id"),
            nested_item.get("itemId"),
            nested_item.get("item_id"),
            family_id,
            vplib_uid,
            runtime_block_type_id,
        ),
        "library-item",
    )

    return {
        "itemId": item_id,
        "itemKind": "vplib",
        "kind": "vplib",
        "source": "library",
        "label": label,
        "description": _coerce_text(record.get("description") or nested_item.get("description"), ""),
        "familyId": family_id,
        "packageId": package_id,
        "vplibUid": vplib_uid,
        "variantId": variant_id,
        "revisionHash": _normalize_text(
            record.get("revisionHash")
            or record.get("revision_hash")
            or record.get("currentRevisionHash")
            or record.get("current_revision_hash")
            or nested_item.get("revisionHash")
            or nested_item.get("revision_hash")
            or nested_item.get("currentRevisionHash")
            or nested_item.get("current_revision_hash")
        ),
        "objectKind": object_kind,
        "runtimeBlockTypeId": runtime_block_type_id,
        "blockTypeId": runtime_block_type_id,
        "domain": _normalize_text(record.get("domain") or nested_item.get("domain")),
        "category": _normalize_text(record.get("category") or nested_item.get("category")),
        "subcategory": _normalize_text(
            record.get("subcategory")
            or record.get("subCategory")
            or nested_item.get("subcategory")
            or nested_item.get("subCategory")
        ),
        "iconUrl": _normalize_text(
            record.get("iconUrl")
            or record.get("icon_url")
            or record.get("previewUrl")
            or record.get("preview_url")
            or nested_item.get("iconUrl")
            or nested_item.get("icon_url")
            or nested_item.get("previewUrl")
            or nested_item.get("preview_url")
        ),
        "raw": _to_json_compatible(record),
    }


def _fallback_build_empty_slot(
    slot_index: int,
    *,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
) -> dict[str, Any]:
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
        "iconKey": None,
        "iconKind": None,
        "iconUrl": None,
        "icon": None,
        "label": "",
        "displayLabel": "",
        "visibleLabel": False,
        "ariaLabel": f"Inventar-Slot {safe_index + 1}: leer",
        "title": "",
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
        "metadata": {},
    }


def _fallback_build_slot_from_item_dict(
    item: Mapping[str, Any],
    *,
    slot_index: int,
    selected_slot: int,
    icon_only: bool,
) -> dict[str, Any] | None:
    if not _is_item_placeable(item):
        return None

    safe_index = _coerce_int(slot_index, 0, minimum=0)
    item_id = _coerce_text(item.get("itemId"), item.get("familyId") or item.get("vplibUid") or "library-item")
    label = _coerce_text(item.get("label"), "VPLIB Item")
    object_kind = _coerce_text(item.get("objectKind"), DEFAULT_OBJECT_KIND)
    runtime_block_type_id = _coerce_text(item.get("runtimeBlockTypeId"), item.get("blockTypeId") or "library-item")
    family_id = _normalize_text(item.get("familyId"))
    package_id = _normalize_text(item.get("packageId"))
    vplib_uid = _normalize_text(item.get("vplibUid"))
    variant_id = _coerce_text(item.get("variantId"), DEFAULT_VARIANT_ID)
    revision_hash = _normalize_text(item.get("revisionHash"))

    icon_key = f"vplib-{_slug_from_text(family_id or object_kind or item_id)}"
    icon_url = _normalize_text(item.get("iconUrl"))

    library_ref = {
        "source": DEFAULT_LIBRARY_SOURCE_NAME,
        "kind": "vplib",
        "libraryItemId": item_id,
        "familyId": family_id,
        "packageId": package_id,
        "vplibUid": vplib_uid,
        "variantId": variant_id,
        "revisionHash": revision_hash,
        "objectKind": object_kind,
        "domain": _normalize_text(item.get("domain")),
        "category": _normalize_text(item.get("category")),
        "subcategory": _normalize_text(item.get("subcategory")),
    }

    placement_command = {
        "kind": DEFAULT_PLACE_COMMAND_KIND,
        "source": DEFAULT_LIBRARY_SOURCE_NAME,
        "runtimeBlockTypeId": runtime_block_type_id,
        "blockTypeId": runtime_block_type_id,
        "libraryRef": library_ref,
    }

    visible_label = not _coerce_bool(icon_only, False)

    return {
        "slotIndex": safe_index,
        "slotKey": f"hotbar-{safe_index}",
        "empty": False,
        "enabled": True,
        "selected": safe_index == selected_slot,
        "source": DEFAULT_SOURCE,
        "sourceKind": "vplib",
        "itemId": item_id,
        "itemKind": "vplib",
        "kind": "vplib",
        "type": object_kind,
        "blockTypeId": runtime_block_type_id,
        "runtimeBlockTypeId": runtime_block_type_id,
        "placeable": True,
        "breakable": False,
        "iconKey": icon_key,
        "iconKind": DEFAULT_ICON_KIND,
        "iconUrl": icon_url,
        "icon": {
            "key": icon_key,
            "kind": DEFAULT_ICON_KIND,
            "url": icon_url,
            "placeholder": icon_url is None,
            "cssClass": f"editor-hotbar-slot-icon--{icon_key}",
            "ariaHidden": False,
        },
        "label": label,
        "displayLabel": label if visible_label else "",
        "visibleLabel": visible_label,
        "ariaLabel": f"Inventar-Slot {safe_index + 1}: {label}",
        "title": label,
        "description": _normalize_text(item.get("description"), ""),
        "stackSize": 1,
        "maxStackSize": 1,
        "familyId": family_id,
        "packageId": package_id,
        "vplibUid": vplib_uid,
        "variantId": variant_id,
        "revisionHash": revision_hash,
        "objectKind": object_kind,
        "domain": _normalize_text(item.get("domain")),
        "category": _normalize_text(item.get("category")),
        "subcategory": _normalize_text(item.get("subcategory")),
        "libraryRef": library_ref,
        "placementCommand": placement_command,
        "assets": _to_json_compatible(item.get("assets")),
        "metadata": {
            "source": DEFAULT_LIBRARY_SOURCE_NAME,
            "vplib": True,
            "runtimeBlockTypeId": runtime_block_type_id,
        },
    }


# -----------------------------------------------------------------------------
# Öffentliche Mapping-Funktionen
# -----------------------------------------------------------------------------

def build_empty_editor_slot(
    slot_index: int,
    *,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
) -> dict[str, Any]:
    """
    Baut einen leeren Editor-Hotbar-Slot.
    """
    model = _coerce_slot_model(
        {
            "slotIndex": slot_index,
            "empty": True,
            "selected": slot_index == selected_slot,
        },
        fallback_index=slot_index,
        selected_slot=selected_slot,
    )

    if model is not None:
        as_dict = _model_to_dict(model)
        if as_dict:
            return as_dict

    return _fallback_build_empty_slot(slot_index, selected_slot=selected_slot)


def map_library_item_to_editor_slot(
    record: Mapping[str, Any] | MutableMapping[str, Any] | Any,
    *,
    slot_index: int = 0,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    icon_only: bool = False,
) -> dict[str, Any] | None:
    """
    Mappt ein rohes Library-Item auf einen editorfreundlichen Hotbar-Slot.

    Rückgabe:
    - dict, wenn das Item placeable ist
    - None, wenn das Item keine belastbare Library-/Runtime-ID besitzt
    """
    safe_slot_index = normalize_slot_index(
        slot_index,
        fallback_index=slot_index,
        hotbar_size=hotbar_size,
    )
    safe_selected_slot = normalize_slot_index(
        selected_slot,
        fallback_index=DEFAULT_SELECTED_SLOT,
        hotbar_size=hotbar_size,
    )

    item_model = _coerce_item_model(record)
    if item_model is not None:
        item_dict = _model_to_dict(item_model)
    else:
        item_dict = _fallback_normalize_library_item(_safe_mapping(record))

    if not _is_item_placeable(item_dict):
        return None

    models_api = _resolve_models_api()
    slot_cls = models_api.get("EditorInventorySlot")

    if slot_cls is not None and item_model is not None:
        try:
            if hasattr(slot_cls, "from_item"):
                slot_model = slot_cls.from_item(
                    item_model,
                    slot_index=safe_slot_index,
                    selected_slot=safe_selected_slot,
                    visible_label=not _normalize_icon_only(icon_only),
                )
                slot_dict = _model_to_dict(slot_model)
                if slot_dict:
                    return slot_dict
        except Exception:
            pass

    return _fallback_build_slot_from_item_dict(
        item_dict,
        slot_index=safe_slot_index,
        selected_slot=safe_selected_slot,
        icon_only=icon_only,
    )


def map_library_slot_to_editor_slot(
    record: Mapping[str, Any] | MutableMapping[str, Any] | Any,
    *,
    slot_index: int | None = None,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    icon_only: bool = False,
) -> dict[str, Any] | None:
    """
    Mappt einen Library-Inventory-Slot auf einen editorfreundlichen Hotbar-Slot.
    """
    mapping = _safe_mapping(record)

    fallback_index = 0 if slot_index is None else slot_index
    extracted_index = extract_slot_index(
        mapping,
        fallback_index=fallback_index,
        hotbar_size=hotbar_size,
    )

    if _coerce_bool(mapping.get("empty"), False):
        return build_empty_editor_slot(
            extracted_index,
            selected_slot=selected_slot,
        )

    slot_model = _coerce_slot_model(
        mapping,
        fallback_index=extracted_index,
        selected_slot=selected_slot,
    )
    if slot_model is not None:
        slot_dict = _model_to_dict(slot_model)
        if slot_dict and not _coerce_bool(slot_dict.get("empty"), False):
            if _coerce_bool(slot_dict.get("placeable"), False):
                return slot_dict

    return map_library_item_to_editor_slot(
        mapping,
        slot_index=extracted_index,
        selected_slot=selected_slot,
        hotbar_size=hotbar_size,
        icon_only=icon_only,
    )


def map_library_items_to_editor_slots(
    records: Sequence[Mapping[str, Any]] | Any,
    *,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Mappt eine Liste von Library-Items auf eine vollständige Slot-Liste.
    """
    safe_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
    safe_selected = normalize_slot_index(
        selected_slot,
        fallback_index=DEFAULT_SELECTED_SLOT,
        hotbar_size=safe_size,
    )

    slots = [
        build_empty_editor_slot(index, selected_slot=safe_selected)
        for index in range(safe_size)
    ]

    for index, record in enumerate(_safe_list_of_mappings(records)[:safe_size]):
        mapped = map_library_item_to_editor_slot(
            record,
            slot_index=index,
            selected_slot=safe_selected,
            hotbar_size=safe_size,
            icon_only=icon_only,
        )

        if mapped is not None:
            slots[index] = mapped

    return slots


def map_library_slots_to_editor_slots(
    records: Sequence[Mapping[str, Any]] | Any,
    *,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Mappt Library-Inventory-Slots auf eine vollständige editorfreundliche Slot-Liste.
    """
    safe_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
    safe_selected = normalize_slot_index(
        selected_slot,
        fallback_index=DEFAULT_SELECTED_SLOT,
        hotbar_size=safe_size,
    )

    slots = [
        build_empty_editor_slot(index, selected_slot=safe_selected)
        for index in range(safe_size)
    ]

    for fallback_index, record in enumerate(_safe_list_of_mappings(records)):
        slot_index = extract_slot_index(
            record,
            fallback_index=fallback_index,
            hotbar_size=safe_size,
        )

        mapped = map_library_slot_to_editor_slot(
            record,
            slot_index=slot_index,
            selected_slot=safe_selected,
            hotbar_size=safe_size,
            icon_only=icon_only,
        )

        if mapped is not None and 0 <= slot_index < safe_size:
            slots[slot_index] = mapped

    return slots


def build_editor_inventory_from_mapped_slots(
    slots: Sequence[Mapping[str, Any]] | Any,
    *,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    source: str = DEFAULT_SOURCE,
    source_detail: str = DEFAULT_LIBRARY_SOURCE_NAME,
    icon_only: bool = False,
) -> dict[str, Any]:
    """
    Baut eine kompakte Inventory-Struktur aus bereits gemappten Slots.
    """
    safe_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
    safe_selected = normalize_slot_index(
        selected_slot,
        fallback_index=DEFAULT_SELECTED_SLOT,
        hotbar_size=safe_size,
    )

    slot_list = _safe_list_of_mappings(slots)
    by_index: dict[int, dict[str, Any]] = {}

    for fallback_index, slot in enumerate(slot_list):
        slot_index = extract_slot_index(
            slot,
            fallback_index=fallback_index,
            hotbar_size=safe_size,
        )
        by_index[slot_index] = slot

    normalized_slots = [
        by_index.get(index) or build_empty_editor_slot(index, selected_slot=safe_selected)
        for index in range(safe_size)
    ]

    items: list[dict[str, Any]] = []
    seen_item_ids: set[str] = set()

    for slot in normalized_slots:
        if _coerce_bool(slot.get("empty"), True):
            continue

        item_id = _normalize_text(slot.get("itemId") or slot.get("item_id"))
        if not item_id or item_id in seen_item_ids:
            continue

        seen_item_ids.add(item_id)
        items.append(
            {
                "itemId": item_id,
                "itemKind": _coerce_text(slot.get("itemKind") or slot.get("item_kind"), "vplib"),
                "kind": _coerce_text(slot.get("kind"), "vplib"),
                "source": _coerce_text(slot.get("source"), source),
                "label": _normalize_text(slot.get("label"), ""),
                "displayLabel": _normalize_text(slot.get("displayLabel") or slot.get("display_label"), ""),
                "visibleLabel": _coerce_bool(slot.get("visibleLabel") or slot.get("visible_label"), not icon_only),
                "blockTypeId": _normalize_text(slot.get("blockTypeId") or slot.get("block_type_id")),
                "runtimeBlockTypeId": _normalize_text(slot.get("runtimeBlockTypeId") or slot.get("runtime_block_type_id")),
                "familyId": _normalize_text(slot.get("familyId") or slot.get("family_id")),
                "packageId": _normalize_text(slot.get("packageId") or slot.get("package_id")),
                "vplibUid": _normalize_text(slot.get("vplibUid") or slot.get("vplib_uid")),
                "variantId": _normalize_text(slot.get("variantId") or slot.get("variant_id")),
                "revisionHash": _normalize_text(slot.get("revisionHash") or slot.get("revision_hash")),
                "objectKind": _normalize_text(slot.get("objectKind") or slot.get("object_kind")),
                "domain": _normalize_text(slot.get("domain")),
                "category": _normalize_text(slot.get("category")),
                "subcategory": _normalize_text(slot.get("subcategory")),
                "iconKey": _normalize_text(slot.get("iconKey") or slot.get("icon_key")),
                "iconKind": _normalize_text(slot.get("iconKind") or slot.get("icon_kind")),
                "iconUrl": _normalize_text(slot.get("iconUrl") or slot.get("icon_url")),
                "placeable": _coerce_bool(slot.get("placeable"), False),
                "breakable": _coerce_bool(slot.get("breakable"), False),
                "libraryRef": _to_json_compatible(slot.get("libraryRef") or slot.get("library_ref")),
                "placementCommand": _to_json_compatible(slot.get("placementCommand") or slot.get("placement_command")),
                "metadata": _to_json_compatible(_safe_mapping(slot.get("metadata"))),
            }
        )

    filled_count = sum(1 for slot in normalized_slots if not _coerce_bool(slot.get("empty"), True))

    return {
        "enabled": True,
        "source": source,
        "sourceDetail": source_detail,
        "hotbarSize": safe_size,
        "defaultSelectedSlot": safe_selected,
        "selectedSlot": safe_selected,
        "scrollWrap": True,
        "allowPlaceAction": filled_count > 0,
        "allowBreakAction": True,
        "iconOnly": icon_only,
        "items": items,
        "slots": normalized_slots,
        "emptySlotCount": safe_size - filled_count,
        "filledSlotCount": filled_count,
        "hasPlaceableItems": filled_count > 0,
    }


# -----------------------------------------------------------------------------
# Metadaten / Cache
# -----------------------------------------------------------------------------

def get_library_inventory_mapper_metadata() -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten dieses Mapper-Moduls.
    """
    try:
        models_api = _resolve_models_api()
        models_available = _coerce_bool(models_api.get("available"), False)
        models_error = None
    except Exception as exc:
        models_available = False
        models_error = exc

    return {
        "moduleName": LIBRARY_INVENTORY_MAPPER_MODULE_NAME,
        "moduleVersion": LIBRARY_INVENTORY_MAPPER_MODULE_VERSION,
        "generatedAtUtc": _safe_utc_timestamp(),
        "modelsModuleName": MODELS_MODULE_NAME,
        "modelsAvailable": models_available,
        "modelsError": _to_json_compatible(models_error),
        "functions": [
            "build_empty_editor_slot",
            "map_library_item_to_editor_slot",
            "map_library_slot_to_editor_slot",
            "map_library_items_to_editor_slots",
            "map_library_slots_to_editor_slots",
            "build_editor_inventory_from_mapped_slots",
        ],
        "rules": {
            "debugGrassDirtGenerated": False,
            "onlyLibraryItemsPlaceable": True,
            "runtimeBlockTypeIdIsTemporaryAdapter": True,
            "unknownFieldsPreservedViaModels": models_available,
        },
    }


def clear_library_inventory_mapper_caches() -> None:
    """
    Löscht interne Caches dieses Mapper-Moduls.
    """
    cache_clearers = (
        _candidate_missing_names,
        _load_models_module,
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
    "LIBRARY_INVENTORY_MAPPER_MODULE_NAME",
    "LIBRARY_INVENTORY_MAPPER_MODULE_VERSION",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "DEFAULT_VARIANT_ID",
    "DEFAULT_SOURCE",
    "DEFAULT_LIBRARY_SOURCE_NAME",
    "DEFAULT_ICON_KIND",
    "DEFAULT_OBJECT_KIND",
    "DEFAULT_PLACE_COMMAND_KIND",
    "normalize_slot_index",
    "extract_slot_index",
    "build_empty_editor_slot",
    "map_library_item_to_editor_slot",
    "map_library_slot_to_editor_slot",
    "map_library_items_to_editor_slots",
    "map_library_slots_to_editor_slots",
    "build_editor_inventory_from_mapped_slots",
    "get_library_inventory_mapper_metadata",
    "clear_library_inventory_mapper_caches",
]