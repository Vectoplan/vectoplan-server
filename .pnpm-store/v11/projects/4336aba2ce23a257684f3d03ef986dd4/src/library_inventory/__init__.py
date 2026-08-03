# services/vectoplan-editor/src/library_inventory/__init__.py
"""
Öffentliche Paket-Fassade für die editorseitige Library-Inventory-Adapter-Schicht.

Zweck:
- `src.inventory.payload` soll nicht selbst die komplette Normalisierung von
  `vectoplan-library`-Responses besitzen müssen.
- Dieses Paket ist die fachliche Adapter-Schicht zwischen:
    vectoplan-library Published/Inventory API
    -> editorfreundliche Inventory-/Hotbar-Struktur
- Die Submodule können schrittweise ergänzt werden:
    models.py
    normalizer.py
    mapper.py
    health.py

Geplante Import-Richtung:

    src.inventory.payload
      -> src.library_inventory
      -> src.library_inventory.normalizer / mapper / models / health

Diese Datei enthält bewusst:
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine direkte Chunk-/BlockWorld-Mutation
- keine direkten HTTP-Requests
- keine Datenbanklogik

Robustheitsprinzipien:
- Lazy Imports
- gecachte API-Auflösung
- defensive Delegation
- lokale Fallback-Normalisierung, damit das Paket auch vor vollständiger
  Submodul-Implementierung benutzbar bleibt
- Cache-Clear für Entwicklungsreloads und Tests

Wichtig:
- Die einzige fachlich zulässige Quelle für placebare Editor-Items ist
  `vectoplan-library`.
- `debug_grass` / `debug_dirt` dürfen hier nicht als fachliche Items erzeugt werden.
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
# Paketkonstanten
# -----------------------------------------------------------------------------

LIBRARY_INVENTORY_PACKAGE_NAME: Final[str] = "src.library_inventory"
LIBRARY_INVENTORY_PACKAGE_VERSION: Final[str] = "0.1.0"

LIBRARY_INVENTORY_MODELS_MODULE_NAME: Final[str] = f"{LIBRARY_INVENTORY_PACKAGE_NAME}.models"
LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME: Final[str] = f"{LIBRARY_INVENTORY_PACKAGE_NAME}.normalizer"
LIBRARY_INVENTORY_MAPPER_MODULE_NAME: Final[str] = f"{LIBRARY_INVENTORY_PACKAGE_NAME}.mapper"
LIBRARY_INVENTORY_HEALTH_MODULE_NAME: Final[str] = f"{LIBRARY_INVENTORY_PACKAGE_NAME}.health"

NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME: Final[str] = "normalize_library_inventory"
NORMALIZE_LIBRARY_ITEM_FUNCTION_NAME: Final[str] = "normalize_library_item"
NORMALIZE_LIBRARY_SLOT_FUNCTION_NAME: Final[str] = "normalize_library_slot"
BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME: Final[str] = "build_editor_inventory_from_library"

MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "map_library_item_to_editor_slot"
MAP_LIBRARY_SLOT_TO_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "map_library_slot_to_editor_slot"
BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME: Final[str] = "build_empty_editor_slot"

GET_LIBRARY_INVENTORY_MODELS_METADATA_FUNCTION_NAME: Final[str] = "get_library_inventory_models_metadata"
GET_LIBRARY_INVENTORY_NORMALIZER_METADATA_FUNCTION_NAME: Final[str] = "get_library_inventory_normalizer_metadata"
GET_LIBRARY_INVENTORY_MAPPER_METADATA_FUNCTION_NAME: Final[str] = "get_library_inventory_mapper_metadata"
GET_LIBRARY_INVENTORY_HEALTH_FUNCTION_NAME: Final[str] = "get_library_inventory_health"

CLEAR_LIBRARY_INVENTORY_MODELS_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_models_caches"
CLEAR_LIBRARY_INVENTORY_NORMALIZER_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_normalizer_caches"
CLEAR_LIBRARY_INVENTORY_MAPPER_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_mapper_caches"
CLEAR_LIBRARY_INVENTORY_HEALTH_CACHES_FUNCTION_NAME: Final[str] = "clear_library_inventory_health_caches"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0
DEFAULT_SOURCE: Final[str] = "library"
DEFAULT_SOURCE_DETAIL: Final[str] = "vectoplan-library"


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


def _first_text(*values: Any, default: str | None = None) -> str | None:
    """
    Liefert den ersten nicht-leeren Textwert.
    """
    for value in values:
        normalized = _normalize_text(value)
        if normalized:
            return normalized

    return default


def _slug_from_text(value: Any, default: str = "item") -> str:
    """
    Baut einen einfachen frontend-/css-freundlichen Slug.
    """
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

    if isinstance(value, BaseException):
        return {
            "type": value.__class__.__name__,
            "message": _coerce_text(value, "Unbekannter Fehler."),
        }

    return _normalize_text(value)


def _exception_payload(exc: BaseException | str | None) -> dict[str, Any] | None:
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
    Erzwingt ein Dictionary als Payload-Rückgabe.
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
    Prüft, ob ein `ModuleNotFoundError` das Zielmodul selbst betrifft.
    """
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=16)
def _load_optional_module(module_name: str) -> ModuleType | None:
    """
    Lädt ein optionales Library-Inventory-Submodul lazy und gecacht.

    Verhalten:
    - fehlt das Zielmodul selbst -> None
    - fehlt eine innere Abhängigkeit -> RuntimeError
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
            f"Das Library-Inventory-Modul `{normalized_module_name}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Library-Inventory-Modul `{normalized_module_name}` konnte nicht importiert werden."
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
def _resolve_library_inventory_api() -> dict[str, Any]:
    """
    Löst die verfügbare API aus optionalen Submodulen auf.
    """
    models_module = _load_optional_module(LIBRARY_INVENTORY_MODELS_MODULE_NAME)
    normalizer_module = _load_optional_module(LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME)
    mapper_module = _load_optional_module(LIBRARY_INVENTORY_MAPPER_MODULE_NAME)
    health_module = _load_optional_module(LIBRARY_INVENTORY_HEALTH_MODULE_NAME)

    return {
        "models_module_available": models_module is not None,
        "normalizer_module_available": normalizer_module is not None,
        "mapper_module_available": mapper_module is not None,
        "health_module_available": health_module is not None,
        "models_module": models_module,
        "normalizer_module": normalizer_module,
        "mapper_module": mapper_module,
        "health_module": health_module,
        "normalize_inventory": _safe_get_callable(
            normalizer_module,
            NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME,
        ),
        "normalize_item": _safe_get_callable(
            normalizer_module,
            NORMALIZE_LIBRARY_ITEM_FUNCTION_NAME,
        ),
        "normalize_slot": _safe_get_callable(
            normalizer_module,
            NORMALIZE_LIBRARY_SLOT_FUNCTION_NAME,
        ),
        "build_editor_inventory": _safe_get_callable(
            normalizer_module,
            BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME,
        ),
        "map_item_to_slot": _safe_get_callable(
            mapper_module,
            MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME,
        ),
        "map_slot_to_slot": _safe_get_callable(
            mapper_module,
            MAP_LIBRARY_SLOT_TO_EDITOR_SLOT_FUNCTION_NAME,
        ),
        "build_empty_slot": _safe_get_callable(
            mapper_module,
            BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME,
        ),
        "models_metadata_getter": _safe_get_callable(
            models_module,
            GET_LIBRARY_INVENTORY_MODELS_METADATA_FUNCTION_NAME,
        ),
        "normalizer_metadata_getter": _safe_get_callable(
            normalizer_module,
            GET_LIBRARY_INVENTORY_NORMALIZER_METADATA_FUNCTION_NAME,
        ),
        "mapper_metadata_getter": _safe_get_callable(
            mapper_module,
            GET_LIBRARY_INVENTORY_MAPPER_METADATA_FUNCTION_NAME,
        ),
        "health_getter": _safe_get_callable(
            health_module,
            GET_LIBRARY_INVENTORY_HEALTH_FUNCTION_NAME,
        ),
        "models_cache_clearer": _safe_get_callable(
            models_module,
            CLEAR_LIBRARY_INVENTORY_MODELS_CACHES_FUNCTION_NAME,
        ),
        "normalizer_cache_clearer": _safe_get_callable(
            normalizer_module,
            CLEAR_LIBRARY_INVENTORY_NORMALIZER_CACHES_FUNCTION_NAME,
        ),
        "mapper_cache_clearer": _safe_get_callable(
            mapper_module,
            CLEAR_LIBRARY_INVENTORY_MAPPER_CACHES_FUNCTION_NAME,
        ),
        "health_cache_clearer": _safe_get_callable(
            health_module,
            CLEAR_LIBRARY_INVENTORY_HEALTH_CACHES_FUNCTION_NAME,
        ),
    }


def _call_with_supported_kwargs(
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
    required_without_value: list[str] = []

    for name, parameter in parameters.items():
        if parameter.kind not in {
            inspect.Parameter.KEYWORD_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        }:
            continue

        if name in kwargs_dict:
            supported_kwargs[name] = kwargs_dict[name]
        elif parameter.default is inspect.Parameter.empty:
            required_without_value.append(name)

    if required_without_value:
        raise TypeError(
            "Library-Inventory-Callback kann nicht aufgerufen werden. "
            f"Fehlende Pflichtargumente: {', '.join(required_without_value)}."
        )

    return callback(**supported_kwargs)


# -----------------------------------------------------------------------------
# Lokale Fallback-Normalisierung
# -----------------------------------------------------------------------------

def _extract_nested_item(record: Mapping[str, Any]) -> dict[str, Any]:
    """
    Liefert ein wahrscheinlich verschachteltes Library-Item aus einem Record.
    """
    for key in ("item", "libraryItem", "library_item", "block", "family"):
        nested = _safe_mapping(record.get(key))
        if nested:
            return nested

    return {}


def _extract_nested_variant(record: Mapping[str, Any], item: Mapping[str, Any]) -> dict[str, Any]:
    """
    Liefert ein wahrscheinlich verschachteltes Variant-Objekt.
    """
    for container in (record, item):
        for key in ("variant", "defaultVariant", "default_variant"):
            nested = _safe_mapping(container.get(key))
            if nested:
                return nested

    return {}


def _extract_nested_assets(record: Mapping[str, Any], item: Mapping[str, Any]) -> dict[str, Any]:
    """
    Liefert eine einfache Asset-Zusammenfassung.
    """
    assets: dict[str, Any] = {}

    for container in (record, item):
        for key in ("assets", "assetRefs", "asset_refs"):
            nested = container.get(key)

            if isinstance(nested, Mapping):
                assets.update(dict(nested))
            elif isinstance(nested, Sequence) and not isinstance(nested, (str, bytes, bytearray)):
                assets.setdefault("items", _safe_list_of_mappings(nested))

    return assets


def _extract_icon_url(
    *,
    record: Mapping[str, Any],
    item: Mapping[str, Any],
    assets: Mapping[str, Any],
) -> str | None:
    """
    Extrahiert eine Icon-/Preview-URL oder einen Pfad.
    """
    direct = _first_text(
        record.get("iconUrl"),
        record.get("icon_url"),
        record.get("previewUrl"),
        record.get("preview_url"),
        item.get("iconUrl"),
        item.get("icon_url"),
        item.get("previewUrl"),
        item.get("preview_url"),
        assets.get("iconUrl"),
        assets.get("icon_url"),
        assets.get("previewUrl"),
        assets.get("preview_url"),
    )
    if direct:
        return direct

    for key in ("icon", "preview", "thumbnail"):
        for container in (record, item, assets):
            nested = container.get(key) if isinstance(container, Mapping) else None
            nested_mapping = _safe_mapping(nested)

            if nested_mapping:
                value = _first_text(
                    nested_mapping.get("url"),
                    nested_mapping.get("uri"),
                    nested_mapping.get("path"),
                    nested_mapping.get("relativePath"),
                    nested_mapping.get("relative_path"),
                )
                if value:
                    return value

            value = _normalize_text(nested)
            if value:
                return value

    return None


def _local_normalize_library_item(record: Mapping[str, Any]) -> dict[str, Any]:
    """
    Lokale robuste Normalisierung eines Library-Records.

    Wird genutzt, solange `normalizer.py` noch nicht existiert oder als
    Sicherheitsnetz bei Fehlern im Submodul.
    """
    item = _extract_nested_item(record)
    variant = _extract_nested_variant(record, item)
    assets = _extract_nested_assets(record, item)

    family_id = _first_text(
        record.get("familyId"),
        record.get("family_id"),
        record.get("id"),
        item.get("familyId"),
        item.get("family_id"),
        item.get("id"),
    )

    package_id = _first_text(
        record.get("packageId"),
        record.get("package_id"),
        item.get("packageId"),
        item.get("package_id"),
    )

    vplib_uid = _first_text(
        record.get("vplibUid"),
        record.get("vplib_uid"),
        item.get("vplibUid"),
        item.get("vplib_uid"),
    )

    variant_id = _first_text(
        record.get("variantId"),
        record.get("variant_id"),
        record.get("defaultVariantId"),
        record.get("default_variant_id"),
        item.get("variantId"),
        item.get("variant_id"),
        item.get("defaultVariantId"),
        item.get("default_variant_id"),
        variant.get("variantId"),
        variant.get("variant_id"),
        variant.get("id"),
        default="default",
    )

    label = _first_text(
        record.get("label"),
        record.get("name"),
        record.get("title"),
        item.get("label"),
        item.get("name"),
        item.get("title"),
        family_id,
        vplib_uid,
        default="VPLIB Item",
    )

    object_kind = _first_text(
        record.get("objectKind"),
        record.get("object_kind"),
        item.get("objectKind"),
        item.get("object_kind"),
        default="library_item",
    )

    revision_hash = _first_text(
        record.get("revisionHash"),
        record.get("revision_hash"),
        record.get("currentRevisionHash"),
        record.get("current_revision_hash"),
        item.get("revisionHash"),
        item.get("revision_hash"),
        item.get("currentRevisionHash"),
        item.get("current_revision_hash"),
    )

    runtime_block_type_id = _first_text(
        record.get("runtimeBlockTypeId"),
        record.get("runtime_block_type_id"),
        record.get("chunkBlockTypeId"),
        record.get("chunk_block_type_id"),
        record.get("blockTypeId"),
        record.get("block_type_id"),
        item.get("runtimeBlockTypeId"),
        item.get("runtime_block_type_id"),
        item.get("chunkBlockTypeId"),
        item.get("chunk_block_type_id"),
        item.get("blockTypeId"),
        item.get("block_type_id"),
    )

    if not runtime_block_type_id:
        runtime_block_type_id = family_id or (
            f"vplib:{vplib_uid}:{variant_id}" if vplib_uid else None
        )

    return {
        "libraryItemId": _first_text(
            record.get("libraryItemId"),
            record.get("library_item_id"),
            record.get("itemId"),
            record.get("item_id"),
            family_id,
            vplib_uid,
            runtime_block_type_id,
            default="library-item",
        ),
        "familyId": family_id,
        "packageId": package_id,
        "vplibUid": vplib_uid,
        "variantId": variant_id or "default",
        "label": label,
        "description": _first_text(record.get("description"), item.get("description"), default=""),
        "objectKind": object_kind,
        "domain": _first_text(
            record.get("domain"),
            item.get("domain"),
            _deep_get(record, ("classification", "domain")),
            _deep_get(item, ("classification", "domain")),
        ),
        "category": _first_text(
            record.get("category"),
            item.get("category"),
            _deep_get(record, ("classification", "category")),
            _deep_get(item, ("classification", "category")),
        ),
        "subcategory": _first_text(
            record.get("subcategory"),
            record.get("subCategory"),
            item.get("subcategory"),
            item.get("subCategory"),
            _deep_get(record, ("classification", "subcategory")),
            _deep_get(item, ("classification", "subcategory")),
        ),
        "revisionHash": revision_hash,
        "sourcePath": _first_text(record.get("sourcePath"), record.get("source_path"), item.get("sourcePath"), item.get("source_path")),
        "runtimeBlockTypeId": runtime_block_type_id,
        "iconUrl": _extract_icon_url(record=record, item=item, assets=assets),
        "assets": _to_json_compatible(assets),
        "raw": _to_json_compatible(record),
    }


def _local_build_empty_editor_slot(slot_index: int, *, selected_slot: int = DEFAULT_SELECTED_SLOT) -> dict[str, Any]:
    """
    Baut einen leeren Editor-Hotbar-Slot.
    """
    safe_slot_index = _coerce_int(slot_index, 0, minimum=0)

    return {
        "slotIndex": safe_slot_index,
        "slotKey": f"hotbar-{safe_slot_index}",
        "empty": True,
        "enabled": True,
        "selected": safe_slot_index == selected_slot,
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
        "ariaLabel": f"Inventar-Slot {safe_slot_index + 1}: leer",
        "title": "",
        "stackSize": 0,
        "maxStackSize": 0,
        "libraryRef": None,
        "placementCommand": None,
        "metadata": {},
    }


def _local_map_library_item_to_editor_slot(
    record: Mapping[str, Any],
    *,
    slot_index: int = 0,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> dict[str, Any] | None:
    """
    Lokales Mapping eines Library-Items auf einen Editor-Slot.
    """
    item = _local_normalize_library_item(record)

    runtime_block_type_id = _normalize_text(item.get("runtimeBlockTypeId"))
    family_id = _normalize_text(item.get("familyId"))
    vplib_uid = _normalize_text(item.get("vplibUid"))

    if not runtime_block_type_id or not (family_id or vplib_uid):
        return None

    label = _coerce_text(item.get("label"), "VPLIB Item")
    object_kind = _coerce_text(item.get("objectKind"), "library_item")
    library_item_id = _coerce_text(item.get("libraryItemId"), family_id or vplib_uid or runtime_block_type_id)
    safe_slot_index = _coerce_int(slot_index, 0, minimum=0)

    icon_key = f"vplib-{_slug_from_text(family_id or object_kind or library_item_id)}"

    library_ref = {
        "source": "vectoplan-library",
        "kind": "vplib",
        "libraryItemId": library_item_id,
        "familyId": family_id,
        "packageId": _normalize_text(item.get("packageId")),
        "vplibUid": vplib_uid,
        "variantId": _coerce_text(item.get("variantId"), "default"),
        "revisionHash": _normalize_text(item.get("revisionHash")),
        "objectKind": object_kind,
        "domain": _normalize_text(item.get("domain")),
        "category": _normalize_text(item.get("category")),
        "subcategory": _normalize_text(item.get("subcategory")),
        "sourcePath": _normalize_text(item.get("sourcePath")),
    }

    placement_command = {
        "kind": "PlaceLibraryItem",
        "source": "vectoplan-library",
        "runtimeBlockTypeId": runtime_block_type_id,
        "blockTypeId": runtime_block_type_id,
        "libraryRef": library_ref,
    }

    visible_label = not _coerce_bool(icon_only, False)

    return {
        "slotIndex": safe_slot_index,
        "slotKey": f"hotbar-{safe_slot_index}",
        "empty": False,
        "enabled": True,
        "selected": safe_slot_index == selected_slot,
        "source": DEFAULT_SOURCE,
        "sourceKind": "vplib",
        "itemId": library_item_id,
        "itemKind": "vplib",
        "kind": "vplib",
        "type": object_kind,
        "blockTypeId": runtime_block_type_id,
        "runtimeBlockTypeId": runtime_block_type_id,
        "placeable": True,
        "breakable": False,
        "iconKey": icon_key,
        "iconKind": "library-item",
        "iconUrl": _normalize_text(item.get("iconUrl")),
        "icon": {
            "key": icon_key,
            "kind": "library-item",
            "url": _normalize_text(item.get("iconUrl")),
            "placeholder": _normalize_text(item.get("iconUrl")) is None,
            "cssClass": f"editor-hotbar-slot-icon--{icon_key}",
            "ariaHidden": False,
        },
        "label": label,
        "displayLabel": label if visible_label else "",
        "visibleLabel": visible_label,
        "ariaLabel": f"Inventar-Slot {safe_slot_index + 1}: {label}",
        "title": label,
        "description": _normalize_text(item.get("description"), ""),
        "stackSize": 1,
        "maxStackSize": 1,
        "familyId": family_id,
        "packageId": _normalize_text(item.get("packageId")),
        "vplibUid": vplib_uid,
        "variantId": _coerce_text(item.get("variantId"), "default"),
        "revisionHash": _normalize_text(item.get("revisionHash")),
        "objectKind": object_kind,
        "domain": _normalize_text(item.get("domain")),
        "category": _normalize_text(item.get("category")),
        "subcategory": _normalize_text(item.get("subcategory")),
        "libraryRef": library_ref,
        "placementCommand": placement_command,
        "assets": _to_json_compatible(item.get("assets")),
        "metadata": {
            "source": "vectoplan-library",
            "vplib": True,
            "runtimeBlockTypeId": runtime_block_type_id,
        },
    }


def _local_build_editor_inventory_from_library(
    *,
    raw_slots: Sequence[Mapping[str, Any]] | None = None,
    raw_items: Sequence[Mapping[str, Any]] | None = None,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> dict[str, Any]:
    """
    Lokaler Inventory-Builder aus rohen Library-Slots oder Items.
    """
    safe_hotbar_size = _coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=64)
    safe_selected_slot = _coerce_int(
        selected_slot,
        DEFAULT_SELECTED_SLOT,
        minimum=0,
        maximum=max(0, safe_hotbar_size - 1),
    )

    slots = [
        _local_build_empty_editor_slot(index, selected_slot=safe_selected_slot)
        for index in range(safe_hotbar_size)
    ]

    used = 0

    raw_slots_list = _safe_list_of_mappings(raw_slots)
    raw_items_list = _safe_list_of_mappings(raw_items)

    if raw_slots_list:
        for fallback_index, raw_slot in enumerate(raw_slots_list):
            slot_index = _coerce_int(
                _read_mapping_any(raw_slot, ("slotIndex", "slot_index", "index", "slot"), fallback_index),
                fallback_index,
                minimum=0,
                maximum=max(0, safe_hotbar_size - 1),
            )

            mapped = _local_map_library_item_to_editor_slot(
                raw_slot,
                slot_index=slot_index,
                selected_slot=safe_selected_slot,
                icon_only=icon_only,
            )

            if mapped is not None:
                slots[slot_index] = mapped
                used += 1

        return {
            "slots": slots,
            "filledSlotCount": used,
            "emptySlotCount": safe_hotbar_size - used,
        }

    for index, raw_item in enumerate(raw_items_list[:safe_hotbar_size]):
        mapped = _local_map_library_item_to_editor_slot(
            raw_item,
            slot_index=index,
            selected_slot=safe_selected_slot,
            icon_only=icon_only,
        )

        if mapped is not None:
            slots[index] = mapped
            used += 1

    return {
        "slots": slots,
        "filledSlotCount": used,
        "emptySlotCount": safe_hotbar_size - used,
    }


# -----------------------------------------------------------------------------
# Öffentliche API
# -----------------------------------------------------------------------------

def normalize_library_item(record: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> dict[str, Any]:
    """
    Normalisiert ein einzelnes Library-Item.
    """
    api = _resolve_library_inventory_api()
    callback = api.get("normalize_item")
    mapping = _safe_mapping(record)

    if callable(callback):
        try:
            return _coerce_payload_dict(
                _call_with_supported_kwargs(callback, {"record": mapping, "item": mapping}),
                function_name=NORMALIZE_LIBRARY_ITEM_FUNCTION_NAME,
            )
        except Exception:
            pass

    return _local_normalize_library_item(mapping)


def normalize_library_slot(record: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> dict[str, Any]:
    """
    Normalisiert einen einzelnen Library-Inventory-Slot.
    """
    api = _resolve_library_inventory_api()
    callback = api.get("normalize_slot")
    mapping = _safe_mapping(record)

    if callable(callback):
        try:
            return _coerce_payload_dict(
                _call_with_supported_kwargs(callback, {"record": mapping, "slot": mapping}),
                function_name=NORMALIZE_LIBRARY_SLOT_FUNCTION_NAME,
            )
        except Exception:
            pass

    return _local_normalize_library_item(mapping)


def map_library_item_to_editor_slot(
    record: Mapping[str, Any] | MutableMapping[str, Any] | Any,
    *,
    slot_index: int = 0,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> dict[str, Any] | None:
    """
    Mappt ein Library-Item auf einen Editor-Hotbar-Slot.
    """
    api = _resolve_library_inventory_api()
    callback = api.get("map_item_to_slot")
    mapping = _safe_mapping(record)

    if callable(callback):
        try:
            value = _call_with_supported_kwargs(
                callback,
                {
                    "record": mapping,
                    "item": mapping,
                    "slot_index": slot_index,
                    "slotIndex": slot_index,
                    "selected_slot": selected_slot,
                    "selectedSlot": selected_slot,
                    "icon_only": icon_only,
                    "iconOnly": icon_only,
                },
            )
            if value is None:
                return None
            return _coerce_payload_dict(
                value,
                function_name=MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME,
            )
        except Exception:
            pass

    return _local_map_library_item_to_editor_slot(
        mapping,
        slot_index=slot_index,
        selected_slot=selected_slot,
        icon_only=icon_only,
    )


def map_library_slot_to_editor_slot(
    record: Mapping[str, Any] | MutableMapping[str, Any] | Any,
    *,
    slot_index: int = 0,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> dict[str, Any] | None:
    """
    Mappt einen Library-Inventory-Slot auf einen Editor-Hotbar-Slot.
    """
    api = _resolve_library_inventory_api()
    callback = api.get("map_slot_to_slot")
    mapping = _safe_mapping(record)

    if callable(callback):
        try:
            value = _call_with_supported_kwargs(
                callback,
                {
                    "record": mapping,
                    "slot": mapping,
                    "slot_index": slot_index,
                    "slotIndex": slot_index,
                    "selected_slot": selected_slot,
                    "selectedSlot": selected_slot,
                    "icon_only": icon_only,
                    "iconOnly": icon_only,
                },
            )
            if value is None:
                return None
            return _coerce_payload_dict(
                value,
                function_name=MAP_LIBRARY_SLOT_TO_EDITOR_SLOT_FUNCTION_NAME,
            )
        except Exception:
            pass

    return _local_map_library_item_to_editor_slot(
        mapping,
        slot_index=slot_index,
        selected_slot=selected_slot,
        icon_only=icon_only,
    )


def build_empty_editor_slot(
    slot_index: int,
    *,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
) -> dict[str, Any]:
    """
    Baut einen leeren Editor-Slot.
    """
    api = _resolve_library_inventory_api()
    callback = api.get("build_empty_slot")

    if callable(callback):
        try:
            return _coerce_payload_dict(
                _call_with_supported_kwargs(
                    callback,
                    {
                        "slot_index": slot_index,
                        "slotIndex": slot_index,
                        "selected_slot": selected_slot,
                        "selectedSlot": selected_slot,
                    },
                ),
                function_name=BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME,
            )
        except Exception:
            pass

    return _local_build_empty_editor_slot(slot_index, selected_slot=selected_slot)


def build_editor_inventory_from_library(
    *,
    raw_slots: Sequence[Mapping[str, Any]] | None = None,
    raw_items: Sequence[Mapping[str, Any]] | None = None,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> dict[str, Any]:
    """
    Baut eine editorfreundliche Slot-Struktur aus Library-Slots oder Items.
    """
    api = _resolve_library_inventory_api()
    callback = api.get("build_editor_inventory")

    if callable(callback):
        try:
            return _coerce_payload_dict(
                _call_with_supported_kwargs(
                    callback,
                    {
                        "raw_slots": raw_slots,
                        "rawSlots": raw_slots,
                        "raw_items": raw_items,
                        "rawItems": raw_items,
                        "hotbar_size": hotbar_size,
                        "hotbarSize": hotbar_size,
                        "selected_slot": selected_slot,
                        "selectedSlot": selected_slot,
                        "icon_only": icon_only,
                        "iconOnly": icon_only,
                    },
                ),
                function_name=BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME,
            )
        except Exception:
            pass

    return _local_build_editor_inventory_from_library(
        raw_slots=raw_slots,
        raw_items=raw_items,
        hotbar_size=hotbar_size,
        selected_slot=selected_slot,
        icon_only=icon_only,
    )


def normalize_library_inventory(
    *,
    raw_slots: Sequence[Mapping[str, Any]] | None = None,
    raw_items: Sequence[Mapping[str, Any]] | None = None,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
    icon_only: bool = False,
) -> dict[str, Any]:
    """
    Alias für `build_editor_inventory_from_library`.
    """
    return build_editor_inventory_from_library(
        raw_slots=raw_slots,
        raw_items=raw_items,
        hotbar_size=hotbar_size,
        selected_slot=selected_slot,
        icon_only=icon_only,
    )


# -----------------------------------------------------------------------------
# Metadaten / Health / Cache
# -----------------------------------------------------------------------------

def _safe_call_metadata_getter(callback: Callable[..., Any] | None) -> dict[str, Any] | None:
    if not callable(callback):
        return None

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


def get_library_inventory_package_metadata(
    *,
    include_submodule_metadata: bool = True,
) -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten für das Paket.
    """
    try:
        api = _resolve_library_inventory_api()
        resolution_error = None
    except Exception as exc:
        api = {}
        resolution_error = exc

    models_metadata = None
    normalizer_metadata = None
    mapper_metadata = None
    health_payload = None

    if include_submodule_metadata and resolution_error is None:
        models_metadata = _safe_call_metadata_getter(api.get("models_metadata_getter"))
        normalizer_metadata = _safe_call_metadata_getter(api.get("normalizer_metadata_getter"))
        mapper_metadata = _safe_call_metadata_getter(api.get("mapper_metadata_getter"))
        health_payload = _safe_call_metadata_getter(api.get("health_getter"))

    return {
        "packageName": LIBRARY_INVENTORY_PACKAGE_NAME,
        "packageVersion": LIBRARY_INVENTORY_PACKAGE_VERSION,
        "generatedAtUtc": _safe_utc_timestamp(),
        "modules": {
            "models": {
                "moduleName": LIBRARY_INVENTORY_MODELS_MODULE_NAME,
                "available": _coerce_bool(api.get("models_module_available"), False),
                "metadata": models_metadata,
            },
            "normalizer": {
                "moduleName": LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME,
                "available": _coerce_bool(api.get("normalizer_module_available"), False),
                "metadata": normalizer_metadata,
            },
            "mapper": {
                "moduleName": LIBRARY_INVENTORY_MAPPER_MODULE_NAME,
                "available": _coerce_bool(api.get("mapper_module_available"), False),
                "metadata": mapper_metadata,
            },
            "health": {
                "moduleName": LIBRARY_INVENTORY_HEALTH_MODULE_NAME,
                "available": _coerce_bool(api.get("health_module_available"), False),
                "metadata": health_payload,
            },
        },
        "api": {
            "normalizeLibraryInventory": NORMALIZE_LIBRARY_INVENTORY_FUNCTION_NAME,
            "normalizeLibraryItem": NORMALIZE_LIBRARY_ITEM_FUNCTION_NAME,
            "normalizeLibrarySlot": NORMALIZE_LIBRARY_SLOT_FUNCTION_NAME,
            "buildEditorInventoryFromLibrary": BUILD_EDITOR_INVENTORY_FROM_LIBRARY_FUNCTION_NAME,
            "mapLibraryItemToEditorSlot": MAP_LIBRARY_ITEM_TO_EDITOR_SLOT_FUNCTION_NAME,
            "mapLibrarySlotToEditorSlot": MAP_LIBRARY_SLOT_TO_EDITOR_SLOT_FUNCTION_NAME,
            "buildEmptyEditorSlot": BUILD_EMPTY_EDITOR_SLOT_FUNCTION_NAME,
        },
        "fallbacks": {
            "localNormalizerAvailable": True,
            "localMapperAvailable": True,
            "debugGrassDirtGenerated": False,
        },
        "error": _exception_payload(resolution_error),
    }


def get_library_inventory_health() -> dict[str, Any]:
    """
    Liefert eine kompakte Health-Antwort.
    """
    metadata = get_library_inventory_package_metadata(include_submodule_metadata=False)

    return {
        "ok": True,
        "status": "ok",
        "generatedAtUtc": _safe_utc_timestamp(),
        "packageName": LIBRARY_INVENTORY_PACKAGE_NAME,
        "packageVersion": LIBRARY_INVENTORY_PACKAGE_VERSION,
        "metadata": metadata,
    }


def clear_library_inventory_package_caches() -> None:
    """
    Löscht interne Caches und, falls verfügbar, Submodul-Caches.
    """
    try:
        api = _resolve_library_inventory_api()
    except Exception:
        api = {}

    for key in (
        "models_cache_clearer",
        "normalizer_cache_clearer",
        "mapper_cache_clearer",
        "health_cache_clearer",
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
        _resolve_library_inventory_api,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


# -----------------------------------------------------------------------------
# Alias-Funktionen
# -----------------------------------------------------------------------------

def get_library_inventory_metadata() -> dict[str, Any]:
    return get_library_inventory_package_metadata()


def clear_library_inventory_caches() -> None:
    clear_library_inventory_package_caches()


# -----------------------------------------------------------------------------
# Öffentliche Exporte
# -----------------------------------------------------------------------------

__all__ = [
    "LIBRARY_INVENTORY_PACKAGE_NAME",
    "LIBRARY_INVENTORY_PACKAGE_VERSION",
    "LIBRARY_INVENTORY_MODELS_MODULE_NAME",
    "LIBRARY_INVENTORY_NORMALIZER_MODULE_NAME",
    "LIBRARY_INVENTORY_MAPPER_MODULE_NAME",
    "LIBRARY_INVENTORY_HEALTH_MODULE_NAME",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "DEFAULT_SOURCE",
    "DEFAULT_SOURCE_DETAIL",
    "normalize_library_item",
    "normalize_library_slot",
    "normalize_library_inventory",
    "build_editor_inventory_from_library",
    "map_library_item_to_editor_slot",
    "map_library_slot_to_editor_slot",
    "build_empty_editor_slot",
    "get_library_inventory_package_metadata",
    "get_library_inventory_metadata",
    "get_library_inventory_health",
    "clear_library_inventory_package_caches",
    "clear_library_inventory_caches",
]