# services/vectoplan-editor/src/library_inventory/models.py
"""
Datenmodelle für die editorseitige Library-Inventory-Adapter-Schicht.

Zweck:
- stabile, editorfreundliche Modellschicht zwischen `vectoplan-library` und
  `vectoplan-editor`
- tolerante Aufnahme wechselnder Library-Payloads
- klare Zielstruktur für Hotbar, Inventory, LibraryRef und PlacementCommand
- keine HTTP-Requests
- keine Flask-Route
- keine Frontend-/DOM-Logik
- keine direkte Chunk-/BlockWorld-Mutation
- keine Datenbanklogik

Warum diese Datei bewusst tolerant gebaut ist:
- `vectoplan-library` wird sich weiterentwickeln.
- Response-Shapes können sich von `blocks`, `items`, `inventory.slots`,
  `library.items`, `defaultVariant`, `variants`, `assets` usw. unterscheiden.
- Der Editor braucht trotzdem stabile Kernfelder:
    - familyId
    - packageId
    - vplibUid
    - variantId
    - revisionHash
    - runtimeBlockTypeId
    - libraryRef
    - placementCommand
- Neue oder unbekannte Library-Felder werden nicht verworfen, sondern in
  `extra`, `metadata` oder `raw` mitgeführt.

Öffentliche Modellgruppen:
- LibraryClassification
- LibraryAssetRefs
- EditorInventoryIcon
- EditorLibraryRef
- EditorPlacementCommand
- EditorInventoryItem
- EditorInventorySlot
- EditorInventoryState
- EditorInventoryPayload
- LibraryInventoryModelMetadata

Diese Datei ist absichtlich stdlib-only.
"""

from __future__ import annotations

import dataclasses
import re
from collections.abc import Mapping, MutableMapping, Sequence
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, ClassVar, Final, Self


# -----------------------------------------------------------------------------
# Modulkonstanten
# -----------------------------------------------------------------------------

LIBRARY_INVENTORY_MODELS_MODULE_NAME: Final[str] = "src.library_inventory.models"
LIBRARY_INVENTORY_MODELS_MODULE_VERSION: Final[str] = "0.1.0"

EDITOR_INVENTORY_KIND: Final[str] = "editor-inventory"
EDITOR_INVENTORY_SCHEMA_VERSION: Final[str] = "editor-inventory.v1"

EDITOR_INVENTORY_ITEM_KIND_VPLIB: Final[str] = "vplib"
EDITOR_INVENTORY_ITEM_KIND_EMPTY: Final[str] = "empty"

EDITOR_INVENTORY_SOURCE_LIBRARY: Final[str] = "library"
EDITOR_INVENTORY_SOURCE_EMPTY: Final[str] = "empty"
EDITOR_INVENTORY_SOURCE_FALLBACK: Final[str] = "fallback"

EDITOR_LIBRARY_SOURCE_NAME: Final[str] = "vectoplan-library"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0
DEFAULT_VARIANT_ID: Final[str] = "default"

DEFAULT_OBJECT_KIND: Final[str] = "library_item"
DEFAULT_ICON_KIND: Final[str] = "library-item"
DEFAULT_EMPTY_ICON_KIND: Final[str] = "empty"

DEFAULT_PLACE_COMMAND_KIND: Final[str] = "PlaceLibraryItem"

MAX_HOTBAR_SIZE: Final[int] = 64
MAX_JSON_DEPTH: Final[int] = 32


# -----------------------------------------------------------------------------
# Bekannte Key-Gruppen
# -----------------------------------------------------------------------------

FAMILY_ID_KEYS: Final[tuple[str, ...]] = (
    "familyId",
    "family_id",
    "familyID",
    "id",
)

PACKAGE_ID_KEYS: Final[tuple[str, ...]] = (
    "packageId",
    "package_id",
    "packageID",
)

VPLIB_UID_KEYS: Final[tuple[str, ...]] = (
    "vplibUid",
    "vplib_uid",
    "vplibUID",
    "vplib_uid_v1",
)

VARIANT_ID_KEYS: Final[tuple[str, ...]] = (
    "variantId",
    "variant_id",
    "defaultVariantId",
    "default_variant_id",
    "selectedVariantId",
    "selected_variant_id",
)

REVISION_HASH_KEYS: Final[tuple[str, ...]] = (
    "revisionHash",
    "revision_hash",
    "currentRevisionHash",
    "current_revision_hash",
    "publishedRevisionHash",
    "published_revision_hash",
)

RUNTIME_BLOCK_TYPE_ID_KEYS: Final[tuple[str, ...]] = (
    "runtimeBlockTypeId",
    "runtime_block_type_id",
    "chunkBlockTypeId",
    "chunk_block_type_id",
    "blockTypeId",
    "block_type_id",
)

LABEL_KEYS: Final[tuple[str, ...]] = (
    "label",
    "name",
    "title",
    "displayName",
    "display_name",
)

DESCRIPTION_KEYS: Final[tuple[str, ...]] = (
    "description",
    "summary",
    "text",
)

OBJECT_KIND_KEYS: Final[tuple[str, ...]] = (
    "objectKind",
    "object_kind",
    "kind",
    "type",
)

DOMAIN_KEYS: Final[tuple[str, ...]] = (
    "domain",
    "domainId",
    "domain_id",
)

CATEGORY_KEYS: Final[tuple[str, ...]] = (
    "category",
    "categoryId",
    "category_id",
)

SUBCATEGORY_KEYS: Final[tuple[str, ...]] = (
    "subcategory",
    "subCategory",
    "subcategoryId",
    "subcategory_id",
    "sub_category",
)

SOURCE_PATH_KEYS: Final[tuple[str, ...]] = (
    "sourcePath",
    "source_path",
    "path",
)

ICON_URL_KEYS: Final[tuple[str, ...]] = (
    "iconUrl",
    "icon_url",
    "previewUrl",
    "preview_url",
    "thumbnailUrl",
    "thumbnail_url",
)

LIBRARY_ITEM_ID_KEYS: Final[tuple[str, ...]] = (
    "libraryItemId",
    "library_item_id",
    "itemId",
    "item_id",
)

SLOT_INDEX_KEYS: Final[tuple[str, ...]] = (
    "slotIndex",
    "slot_index",
    "index",
    "slot",
)

KNOWN_LIBRARY_IDENTITY_KEYS: Final[frozenset[str]] = frozenset(
    FAMILY_ID_KEYS
    + PACKAGE_ID_KEYS
    + VPLIB_UID_KEYS
    + VARIANT_ID_KEYS
    + REVISION_HASH_KEYS
    + RUNTIME_BLOCK_TYPE_ID_KEYS
    + LABEL_KEYS
    + DESCRIPTION_KEYS
    + OBJECT_KIND_KEYS
    + DOMAIN_KEYS
    + CATEGORY_KEYS
    + SUBCATEGORY_KEYS
    + SOURCE_PATH_KEYS
    + ICON_URL_KEYS
    + LIBRARY_ITEM_ID_KEYS
    + (
        "classification",
        "variant",
        "defaultVariant",
        "default_variant",
        "item",
        "libraryItem",
        "library_item",
        "block",
        "family",
        "assets",
        "assetRefs",
        "asset_refs",
        "metadata",
        "meta",
        "payload",
        "raw",
    )
)

KNOWN_SLOT_KEYS: Final[frozenset[str]] = frozenset(
    (
        "slotIndex",
        "slot_index",
        "slotKey",
        "slot_key",
        "empty",
        "enabled",
        "selected",
        "source",
        "sourceKind",
        "source_kind",
        "itemId",
        "item_id",
        "itemKind",
        "item_kind",
        "kind",
        "type",
        "blockTypeId",
        "block_type_id",
        "runtimeBlockTypeId",
        "runtime_block_type_id",
        "placeable",
        "breakable",
        "icon",
        "iconKey",
        "icon_key",
        "iconKind",
        "icon_kind",
        "iconUrl",
        "icon_url",
        "label",
        "displayLabel",
        "display_label",
        "visibleLabel",
        "visible_label",
        "ariaLabel",
        "aria_label",
        "title",
        "description",
        "stackSize",
        "stack_size",
        "maxStackSize",
        "max_stack_size",
        "familyId",
        "family_id",
        "packageId",
        "package_id",
        "vplibUid",
        "vplib_uid",
        "variantId",
        "variant_id",
        "revisionHash",
        "revision_hash",
        "objectKind",
        "object_kind",
        "domain",
        "category",
        "subcategory",
        "libraryRef",
        "library_ref",
        "placementCommand",
        "placement_command",
        "assets",
        "metadata",
        "meta",
        "raw",
    )
)


# -----------------------------------------------------------------------------
# Basis-Hilfsfunktionen
# -----------------------------------------------------------------------------

def normalize_text(value: Any, default: str | None = None) -> str | None:
    """
    Normalisiert beliebige Werte zu nicht-leerem String oder `default`.
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
    Wandelt typische boolesche Werte robust in bool.
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


def safe_list_of_mappings(value: Any) -> list[dict[str, Any]]:
    """
    Wandelt eine Sequenz in list[dict].
    """
    result: list[dict[str, Any]] = []

    for item in safe_sequence(value):
        mapping = safe_mapping(item)
        if mapping:
            result.append(mapping)

    return result


def safe_deepcopy(value: Any) -> Any:
    """
    Kopiert Daten defensiv.
    """
    try:
        return deepcopy(value)
    except Exception:
        return value


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


def deep_get(value: Any, path: Sequence[str], default: Any = None) -> Any:
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


def first_text(*values: Any, default: str | None = None) -> str | None:
    """
    Liefert den ersten nicht-leeren Textwert.
    """
    for value in values:
        normalized = normalize_text(value)
        if normalized:
            return normalized

    return default


_SLUG_RE = re.compile(r"[^a-zA-Z0-9._:/ -]+")


def slug_from_text(value: Any, default: str = "item") -> str:
    """
    Baut einen einfachen frontend-/css-freundlichen Slug.
    """
    text = coerce_text(value, default).strip().lower()
    text = _SLUG_RE.sub("", text)

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


def to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    """
    Wandelt Python-Objekte defensiv in JSON-kompatible Strukturen um.
    """
    if depth > MAX_JSON_DEPTH:
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
        return {
            "type": value.__class__.__name__,
            "message": coerce_text(value, "Unbekannter Fehler."),
        }

    return normalize_text(value)


def extract_extra_fields(
    mapping: Mapping[str, Any] | None,
    known_keys: frozenset[str] | Sequence[str],
) -> dict[str, Any]:
    """
    Extrahiert unbekannte Felder zur Zukunftssicherheit.
    """
    if not isinstance(mapping, Mapping):
        return {}

    known = set(known_keys)
    result: dict[str, Any] = {}

    for key, value in mapping.items():
        if key not in known:
            result[coerce_text(key, "unknown")] = to_json_compatible(value)

    return result


def merge_metadata(*values: Any) -> dict[str, Any]:
    """
    Merged mehrere Metadata-/Meta-/Payload-Mappings defensiv.
    """
    result: dict[str, Any] = {}

    for value in values:
        mapping = safe_mapping(value)
        if mapping:
            result.update(to_json_compatible(mapping))

    return result


def get_nested_record(record: Mapping[str, Any], *keys: str) -> dict[str, Any]:
    """
    Liefert den ersten verschachtelten Mapping-Wert.
    """
    for key in keys:
        nested = safe_mapping(record.get(key))
        if nested:
            return nested

    return {}


# -----------------------------------------------------------------------------
# Modell-Basisklasse
# -----------------------------------------------------------------------------

@dataclasses.dataclass(slots=True)
class ModelBase:
    """
    Kleine Basisklasse mit robustem `to_dict`.
    """

    def to_dict(self) -> dict[str, Any]:
        return to_json_compatible(dataclasses.asdict(self))

    def clone(self: Self, **updates: Any) -> Self:
        """
        Liefert eine Kopie mit Änderungen.
        """
        return dataclasses.replace(self, **updates)


# -----------------------------------------------------------------------------
# Classification / Assets
# -----------------------------------------------------------------------------

@dataclasses.dataclass(slots=True)
class LibraryClassification(ModelBase):
    """
    Taxonomie-/Klassifikationsreferenz eines Library-Items.
    """

    domain: str | None = None
    category: str | None = None
    subcategory: str | None = None
    path: str | None = None
    label: str | None = None
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @classmethod
    def from_mapping(
        cls,
        value: Mapping[str, Any] | None,
        *,
        fallback: Mapping[str, Any] | None = None,
    ) -> "LibraryClassification":
        mapping = safe_mapping(value)
        fallback_mapping = safe_mapping(fallback)

        domain = first_text(
            read_mapping_any(mapping, DOMAIN_KEYS),
            read_mapping_any(fallback_mapping, DOMAIN_KEYS),
        )
        category = first_text(
            read_mapping_any(mapping, CATEGORY_KEYS),
            read_mapping_any(fallback_mapping, CATEGORY_KEYS),
        )
        subcategory = first_text(
            read_mapping_any(mapping, SUBCATEGORY_KEYS),
            read_mapping_any(fallback_mapping, SUBCATEGORY_KEYS),
        )

        path = first_text(
            mapping.get("path"),
            mapping.get("classificationPath"),
            mapping.get("classification_path"),
            fallback_mapping.get("classificationPath"),
            fallback_mapping.get("classification_path"),
        )

        if not path:
            parts = [part for part in (domain, category, subcategory) if part]
            path = "/".join(parts) if parts else None

        return cls(
            domain=domain,
            category=category,
            subcategory=subcategory,
            path=path,
            label=first_text(mapping.get("label"), mapping.get("name")),
            raw=to_json_compatible(mapping) if mapping else {},
            extra=extract_extra_fields(
                mapping,
                frozenset(
                    DOMAIN_KEYS
                    + CATEGORY_KEYS
                    + SUBCATEGORY_KEYS
                    + (
                        "path",
                        "classificationPath",
                        "classification_path",
                        "label",
                        "name",
                    )
                ),
            ),
        )


@dataclasses.dataclass(slots=True)
class LibraryAssetRefs(ModelBase):
    """
    Asset-/Preview-/Icon-Referenzen eines Library-Items.
    """

    icon_url: str | None = None
    preview_url: str | None = None
    thumbnail_url: str | None = None
    model_url: str | None = None
    model_kind: str | None = None
    items: list[dict[str, Any]] = dataclasses.field(default_factory=list)
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @classmethod
    def from_sources(cls, *sources: Any) -> "LibraryAssetRefs":
        merged: dict[str, Any] = {}
        item_list: list[dict[str, Any]] = []

        for source in sources:
            if isinstance(source, Mapping):
                for key in ("assets", "assetRefs", "asset_refs"):
                    nested = source.get(key)
                    if isinstance(nested, Mapping):
                        merged.update(dict(nested))
                    elif isinstance(nested, Sequence) and not isinstance(nested, (str, bytes, bytearray)):
                        item_list.extend(safe_list_of_mappings(nested))

                # Direkte Asset-Felder ebenfalls akzeptieren.
                for key in (
                    "icon",
                    "iconUrl",
                    "icon_url",
                    "preview",
                    "previewUrl",
                    "preview_url",
                    "thumbnail",
                    "thumbnailUrl",
                    "thumbnail_url",
                    "model",
                    "modelUrl",
                    "model_url",
                    "mesh",
                    "glb",
                    "gltf",
                ):
                    if key in source:
                        merged[key] = source.get(key)

        for key in ("items", "assets"):
            nested_items = safe_list_of_mappings(merged.get(key))
            if nested_items:
                item_list.extend(nested_items)

        icon_url = first_text(
            merged.get("iconUrl"),
            merged.get("icon_url"),
            _asset_url_from_nested(merged.get("icon")),
        )
        preview_url = first_text(
            merged.get("previewUrl"),
            merged.get("preview_url"),
            _asset_url_from_nested(merged.get("preview")),
        )
        thumbnail_url = first_text(
            merged.get("thumbnailUrl"),
            merged.get("thumbnail_url"),
            _asset_url_from_nested(merged.get("thumbnail")),
        )
        model_url = first_text(
            merged.get("modelUrl"),
            merged.get("model_url"),
            _asset_url_from_nested(merged.get("model")),
            _asset_url_from_nested(merged.get("mesh")),
            _asset_url_from_nested(merged.get("glb")),
            _asset_url_from_nested(merged.get("gltf")),
        )

        model_kind = first_text(
            merged.get("modelKind"),
            merged.get("model_kind"),
            merged.get("assetKind"),
            merged.get("asset_kind"),
        )

        return cls(
            icon_url=icon_url,
            preview_url=preview_url,
            thumbnail_url=thumbnail_url,
            model_url=model_url,
            model_kind=model_kind,
            items=[to_json_compatible(item) for item in item_list],
            raw=to_json_compatible(merged),
            extra=extract_extra_fields(
                merged,
                frozenset(
                    (
                        "icon",
                        "iconUrl",
                        "icon_url",
                        "preview",
                        "previewUrl",
                        "preview_url",
                        "thumbnail",
                        "thumbnailUrl",
                        "thumbnail_url",
                        "model",
                        "modelUrl",
                        "model_url",
                        "mesh",
                        "glb",
                        "gltf",
                        "modelKind",
                        "model_kind",
                        "assetKind",
                        "asset_kind",
                        "items",
                        "assets",
                    )
                ),
            ),
        )


def _asset_url_from_nested(value: Any) -> str | None:
    """
    Extrahiert URL/URI/Pfad aus einem Asset-Nested-Objekt.
    """
    if isinstance(value, str):
        return normalize_text(value)

    mapping = safe_mapping(value)
    if not mapping:
        return None

    return first_text(
        mapping.get("url"),
        mapping.get("uri"),
        mapping.get("path"),
        mapping.get("relativePath"),
        mapping.get("relative_path"),
        mapping.get("assetPath"),
        mapping.get("asset_path"),
    )


# -----------------------------------------------------------------------------
# Icon / LibraryRef / Placement
# -----------------------------------------------------------------------------

@dataclasses.dataclass(slots=True)
class EditorInventoryIcon(ModelBase):
    """
    Editorfreundliche Icon-/Preview-Referenz.
    """

    key: str | None = None
    kind: str = DEFAULT_ICON_KIND
    url: str | None = None
    placeholder: bool = True
    css_class: str | None = None
    aria_hidden: bool = False
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @classmethod
    def from_mapping(
        cls,
        value: Mapping[str, Any] | None,
        *,
        fallback_key: str | None = None,
        fallback_kind: str = DEFAULT_ICON_KIND,
        fallback_url: str | None = None,
    ) -> "EditorInventoryIcon":
        mapping = safe_mapping(value)

        key = first_text(
            mapping.get("key"),
            mapping.get("iconKey"),
            mapping.get("icon_key"),
            fallback_key,
        )
        kind = coerce_text(
            first_text(mapping.get("kind"), mapping.get("iconKind"), mapping.get("icon_kind"), fallback_kind),
            fallback_kind,
        )
        url = first_text(
            mapping.get("url"),
            mapping.get("uri"),
            mapping.get("path"),
            fallback_url,
        )

        if not key:
            key = f"icon-{slug_from_text(kind)}"

        css_class = first_text(
            mapping.get("cssClass"),
            mapping.get("css_class"),
            f"editor-hotbar-slot-icon--{slug_from_text(key)}",
        )

        return cls(
            key=key,
            kind=kind,
            url=url,
            placeholder=coerce_bool(mapping.get("placeholder"), url is None),
            css_class=css_class,
            aria_hidden=coerce_bool(mapping.get("ariaHidden", mapping.get("aria_hidden")), False),
            raw=to_json_compatible(mapping) if mapping else {},
            extra=extract_extra_fields(
                mapping,
                frozenset(
                    (
                        "key",
                        "iconKey",
                        "icon_key",
                        "kind",
                        "iconKind",
                        "icon_kind",
                        "url",
                        "uri",
                        "path",
                        "placeholder",
                        "cssClass",
                        "css_class",
                        "ariaHidden",
                        "aria_hidden",
                    )
                ),
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "kind": self.kind,
            "url": self.url,
            "placeholder": self.placeholder,
            "cssClass": self.css_class,
            "ariaHidden": self.aria_hidden,
            "raw": to_json_compatible(self.raw),
            "extra": to_json_compatible(self.extra),
        }


@dataclasses.dataclass(slots=True)
class EditorLibraryRef(ModelBase):
    """
    Stabile Referenz vom Editor zurück auf `vectoplan-library`.
    """

    source: str = EDITOR_LIBRARY_SOURCE_NAME
    kind: str = EDITOR_INVENTORY_ITEM_KIND_VPLIB
    library_item_id: str | None = None
    family_id: str | None = None
    package_id: str | None = None
    vplib_uid: str | None = None
    variant_id: str = DEFAULT_VARIANT_ID
    revision_hash: str | None = None
    object_kind: str = DEFAULT_OBJECT_KIND
    domain: str | None = None
    category: str | None = None
    subcategory: str | None = None
    source_path: str | None = None
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @property
    def stable_key(self) -> str:
        """
        Liefert eine möglichst stabile Referenz-ID.
        """
        if self.vplib_uid:
            return f"vplib:{self.vplib_uid}:{self.variant_id or DEFAULT_VARIANT_ID}"

        if self.family_id:
            return f"family:{self.family_id}:{self.variant_id or DEFAULT_VARIANT_ID}"

        if self.library_item_id:
            return f"item:{self.library_item_id}:{self.variant_id or DEFAULT_VARIANT_ID}"

        return f"unknown:{DEFAULT_VARIANT_ID}"

    @property
    def is_valid(self) -> bool:
        """
        Eine LibraryRef ist gültig, wenn mindestens VPLIB-UID oder Family-ID vorhanden ist.
        """
        return bool(self.vplib_uid or self.family_id)

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "EditorLibraryRef":
        mapping = safe_mapping(value)

        return cls(
            source=coerce_text(mapping.get("source"), EDITOR_LIBRARY_SOURCE_NAME),
            kind=coerce_text(mapping.get("kind"), EDITOR_INVENTORY_ITEM_KIND_VPLIB),
            library_item_id=first_text(
                read_mapping_any(mapping, LIBRARY_ITEM_ID_KEYS),
                mapping.get("libraryItemId"),
                mapping.get("library_item_id"),
            ),
            family_id=first_text(read_mapping_any(mapping, FAMILY_ID_KEYS)),
            package_id=first_text(read_mapping_any(mapping, PACKAGE_ID_KEYS)),
            vplib_uid=first_text(read_mapping_any(mapping, VPLIB_UID_KEYS)),
            variant_id=coerce_text(first_text(read_mapping_any(mapping, VARIANT_ID_KEYS)), DEFAULT_VARIANT_ID),
            revision_hash=first_text(read_mapping_any(mapping, REVISION_HASH_KEYS)),
            object_kind=coerce_text(first_text(read_mapping_any(mapping, OBJECT_KIND_KEYS)), DEFAULT_OBJECT_KIND),
            domain=first_text(read_mapping_any(mapping, DOMAIN_KEYS)),
            category=first_text(read_mapping_any(mapping, CATEGORY_KEYS)),
            subcategory=first_text(read_mapping_any(mapping, SUBCATEGORY_KEYS)),
            source_path=first_text(read_mapping_any(mapping, SOURCE_PATH_KEYS)),
            raw=to_json_compatible(mapping) if mapping else {},
            extra=extract_extra_fields(
                mapping,
                frozenset(
                    (
                        "source",
                        "kind",
                        "libraryItemId",
                        "library_item_id",
                    )
                )
                | KNOWN_LIBRARY_IDENTITY_KEYS,
            ),
        )

    @classmethod
    def from_item(cls, item: "EditorInventoryItem") -> "EditorLibraryRef":
        return cls(
            source=EDITOR_LIBRARY_SOURCE_NAME,
            kind=EDITOR_INVENTORY_ITEM_KIND_VPLIB,
            library_item_id=item.item_id,
            family_id=item.family_id,
            package_id=item.package_id,
            vplib_uid=item.vplib_uid,
            variant_id=item.variant_id,
            revision_hash=item.revision_hash,
            object_kind=item.object_kind,
            domain=item.classification.domain,
            category=item.classification.category,
            subcategory=item.classification.subcategory,
            source_path=item.source_path,
            raw=to_json_compatible(item.raw),
            extra=to_json_compatible(item.extra),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "kind": self.kind,
            "libraryItemId": self.library_item_id,
            "familyId": self.family_id,
            "packageId": self.package_id,
            "vplibUid": self.vplib_uid,
            "variantId": self.variant_id,
            "revisionHash": self.revision_hash,
            "objectKind": self.object_kind,
            "domain": self.domain,
            "category": self.category,
            "subcategory": self.subcategory,
            "sourcePath": self.source_path,
            "stableKey": self.stable_key,
            "valid": self.is_valid,
            "raw": to_json_compatible(self.raw),
            "extra": to_json_compatible(self.extra),
        }


@dataclasses.dataclass(slots=True)
class EditorPlacementCommand(ModelBase):
    """
    Übergangs-Command-Payload für die Editor-Runtime.

    Aktuell nutzt der Chunk-Pfad noch runtime/blockType-nahe IDs. Langfristig
    soll daraus ein Core-/Project-Command mit echter LibraryRef werden.
    """

    kind: str = DEFAULT_PLACE_COMMAND_KIND
    source: str = EDITOR_LIBRARY_SOURCE_NAME
    runtime_block_type_id: str | None = None
    block_type_id: str | None = None
    library_ref: EditorLibraryRef | None = None
    payload: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @property
    def is_placeable(self) -> bool:
        return bool(self.runtime_block_type_id and self.library_ref and self.library_ref.is_valid)

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "EditorPlacementCommand":
        mapping = safe_mapping(value)
        library_ref = EditorLibraryRef.from_mapping(safe_mapping(mapping.get("libraryRef", mapping.get("library_ref"))))

        runtime_block_type_id = first_text(
            mapping.get("runtimeBlockTypeId"),
            mapping.get("runtime_block_type_id"),
            mapping.get("blockTypeId"),
            mapping.get("block_type_id"),
        )

        return cls(
            kind=coerce_text(mapping.get("kind"), DEFAULT_PLACE_COMMAND_KIND),
            source=coerce_text(mapping.get("source"), EDITOR_LIBRARY_SOURCE_NAME),
            runtime_block_type_id=runtime_block_type_id,
            block_type_id=first_text(mapping.get("blockTypeId"), mapping.get("block_type_id"), runtime_block_type_id),
            library_ref=library_ref if library_ref.is_valid else None,
            payload=to_json_compatible(safe_mapping(mapping.get("payload"))),
            extra=extract_extra_fields(
                mapping,
                frozenset(
                    (
                        "kind",
                        "source",
                        "runtimeBlockTypeId",
                        "runtime_block_type_id",
                        "blockTypeId",
                        "block_type_id",
                        "libraryRef",
                        "library_ref",
                        "payload",
                    )
                ),
            ),
        )

    @classmethod
    def from_item(cls, item: "EditorInventoryItem") -> "EditorPlacementCommand":
        library_ref = EditorLibraryRef.from_item(item)

        return cls(
            kind=DEFAULT_PLACE_COMMAND_KIND,
            source=EDITOR_LIBRARY_SOURCE_NAME,
            runtime_block_type_id=item.runtime_block_type_id,
            block_type_id=item.runtime_block_type_id,
            library_ref=library_ref,
            payload={
                "familyId": item.family_id,
                "packageId": item.package_id,
                "vplibUid": item.vplib_uid,
                "variantId": item.variant_id,
                "revisionHash": item.revision_hash,
                "objectKind": item.object_kind,
            },
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "source": self.source,
            "runtimeBlockTypeId": self.runtime_block_type_id,
            "blockTypeId": self.block_type_id or self.runtime_block_type_id,
            "libraryRef": self.library_ref.to_dict() if self.library_ref else None,
            "payload": to_json_compatible(self.payload),
            "extra": to_json_compatible(self.extra),
            "placeable": self.is_placeable,
        }


# -----------------------------------------------------------------------------
# Inventory Item / Slot / State / Payload
# -----------------------------------------------------------------------------

@dataclasses.dataclass(slots=True)
class EditorInventoryItem(ModelBase):
    """
    Editorfreundliches Inventory-Item aus `vectoplan-library`.
    """

    item_id: str
    item_kind: str = EDITOR_INVENTORY_ITEM_KIND_VPLIB
    source: str = EDITOR_INVENTORY_SOURCE_LIBRARY
    label: str = "VPLIB Item"
    description: str = ""
    family_id: str | None = None
    package_id: str | None = None
    vplib_uid: str | None = None
    variant_id: str = DEFAULT_VARIANT_ID
    revision_hash: str | None = None
    object_kind: str = DEFAULT_OBJECT_KIND
    runtime_block_type_id: str | None = None
    source_path: str | None = None
    classification: LibraryClassification = dataclasses.field(default_factory=LibraryClassification)
    assets: LibraryAssetRefs = dataclasses.field(default_factory=LibraryAssetRefs)
    icon: EditorInventoryIcon = dataclasses.field(default_factory=EditorInventoryIcon)
    metadata: dict[str, Any] = dataclasses.field(default_factory=dict)
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @property
    def is_library_item(self) -> bool:
        return self.source == EDITOR_INVENTORY_SOURCE_LIBRARY and self.item_kind == EDITOR_INVENTORY_ITEM_KIND_VPLIB

    @property
    def is_placeable(self) -> bool:
        return bool(self.runtime_block_type_id and (self.family_id or self.vplib_uid))

    @property
    def stable_key(self) -> str:
        if self.vplib_uid:
            return f"vplib:{self.vplib_uid}:{self.variant_id or DEFAULT_VARIANT_ID}"

        if self.family_id:
            return f"family:{self.family_id}:{self.variant_id or DEFAULT_VARIANT_ID}"

        return self.item_id

    @classmethod
    def from_library_record(cls, record: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> "EditorInventoryItem":
        """
        Baut ein EditorInventoryItem aus einem rohen Library-Record.

        Akzeptiert sowohl Published-Block-Records als auch Inventory-Slot-Records
        mit verschachteltem `item`.
        """
        mapping = safe_mapping(record)
        item = get_nested_record(mapping, "item", "libraryItem", "library_item", "block", "family")
        variant = get_nested_record(mapping, "variant", "defaultVariant", "default_variant")
        if not variant:
            variant = get_nested_record(item, "variant", "defaultVariant", "default_variant")

        classification = LibraryClassification.from_mapping(
            safe_mapping(mapping.get("classification")) or safe_mapping(item.get("classification")),
            fallback=mapping or item,
        )
        assets = LibraryAssetRefs.from_sources(mapping, item)

        family_id = first_text(
            read_mapping_any(mapping, FAMILY_ID_KEYS),
            read_mapping_any(item, FAMILY_ID_KEYS),
        )
        package_id = first_text(
            read_mapping_any(mapping, PACKAGE_ID_KEYS),
            read_mapping_any(item, PACKAGE_ID_KEYS),
        )
        vplib_uid = first_text(
            read_mapping_any(mapping, VPLIB_UID_KEYS),
            read_mapping_any(item, VPLIB_UID_KEYS),
        )
        variant_id = coerce_text(
            first_text(
                read_mapping_any(mapping, VARIANT_ID_KEYS),
                read_mapping_any(item, VARIANT_ID_KEYS),
                read_mapping_any(variant, VARIANT_ID_KEYS),
            ),
            DEFAULT_VARIANT_ID,
        )
        revision_hash = first_text(
            read_mapping_any(mapping, REVISION_HASH_KEYS),
            read_mapping_any(item, REVISION_HASH_KEYS),
        )
        object_kind = coerce_text(
            first_text(
                read_mapping_any(mapping, OBJECT_KIND_KEYS),
                read_mapping_any(item, OBJECT_KIND_KEYS),
            ),
            DEFAULT_OBJECT_KIND,
        )
        label = coerce_text(
            first_text(
                read_mapping_any(mapping, LABEL_KEYS),
                read_mapping_any(item, LABEL_KEYS),
                family_id,
                vplib_uid,
            ),
            "VPLIB Item",
        )
        description = coerce_text(
            first_text(
                read_mapping_any(mapping, DESCRIPTION_KEYS),
                read_mapping_any(item, DESCRIPTION_KEYS),
            ),
            "",
        )
        runtime_block_type_id = first_text(
            read_mapping_any(mapping, RUNTIME_BLOCK_TYPE_ID_KEYS),
            read_mapping_any(item, RUNTIME_BLOCK_TYPE_ID_KEYS),
        )

        if not runtime_block_type_id:
            runtime_block_type_id = family_id or (f"vplib:{vplib_uid}:{variant_id}" if vplib_uid else None)

        item_id = coerce_text(
            first_text(
                read_mapping_any(mapping, LIBRARY_ITEM_ID_KEYS),
                read_mapping_any(item, LIBRARY_ITEM_ID_KEYS),
                family_id,
                vplib_uid,
                runtime_block_type_id,
            ),
            "library-item",
        )

        source_path = first_text(
            read_mapping_any(mapping, SOURCE_PATH_KEYS),
            read_mapping_any(item, SOURCE_PATH_KEYS),
        )

        icon = EditorInventoryIcon.from_mapping(
            safe_mapping(mapping.get("icon")) or safe_mapping(item.get("icon")),
            fallback_key=f"vplib-{slug_from_text(family_id or object_kind or item_id)}",
            fallback_kind=DEFAULT_ICON_KIND,
            fallback_url=first_text(
                read_mapping_any(mapping, ICON_URL_KEYS),
                read_mapping_any(item, ICON_URL_KEYS),
                assets.icon_url,
                assets.preview_url,
                assets.thumbnail_url,
            ),
        )

        metadata = merge_metadata(
            mapping.get("metadata"),
            mapping.get("meta"),
            item.get("metadata"),
            item.get("meta"),
        )
        metadata.setdefault("source", EDITOR_LIBRARY_SOURCE_NAME)
        metadata.setdefault("vplib", True)

        raw = to_json_compatible(mapping)

        return cls(
            item_id=item_id,
            item_kind=EDITOR_INVENTORY_ITEM_KIND_VPLIB,
            source=EDITOR_INVENTORY_SOURCE_LIBRARY,
            label=label,
            description=description,
            family_id=family_id,
            package_id=package_id,
            vplib_uid=vplib_uid,
            variant_id=variant_id,
            revision_hash=revision_hash,
            object_kind=object_kind,
            runtime_block_type_id=runtime_block_type_id,
            source_path=source_path,
            classification=classification,
            assets=assets,
            icon=icon,
            metadata=to_json_compatible(metadata),
            raw=raw,
            extra=extract_extra_fields(mapping, KNOWN_LIBRARY_IDENTITY_KEYS),
        )

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> "EditorInventoryItem":
        """
        Baut ein Item aus bereits editornaher oder roher Library-Struktur.
        """
        mapping = safe_mapping(value)

        if mapping.get("itemKind") == EDITOR_INVENTORY_ITEM_KIND_EMPTY or mapping.get("kind") == EDITOR_INVENTORY_ITEM_KIND_EMPTY:
            return cls.empty()

        if "libraryRef" in mapping or "library_ref" in mapping:
            library_ref = EditorLibraryRef.from_mapping(safe_mapping(mapping.get("libraryRef", mapping.get("library_ref"))))
            icon = EditorInventoryIcon.from_mapping(
                safe_mapping(mapping.get("icon")),
                fallback_key=first_text(mapping.get("iconKey"), mapping.get("icon_key")),
                fallback_url=first_text(mapping.get("iconUrl"), mapping.get("icon_url")),
            )
            classification = LibraryClassification.from_mapping(
                {
                    "domain": first_text(mapping.get("domain"), library_ref.domain),
                    "category": first_text(mapping.get("category"), library_ref.category),
                    "subcategory": first_text(mapping.get("subcategory"), library_ref.subcategory),
                }
            )
            assets = LibraryAssetRefs.from_sources(mapping)

            return cls(
                item_id=coerce_text(first_text(mapping.get("itemId"), mapping.get("item_id"), library_ref.library_item_id), library_ref.stable_key),
                item_kind=coerce_text(first_text(mapping.get("itemKind"), mapping.get("item_kind"), mapping.get("kind")), EDITOR_INVENTORY_ITEM_KIND_VPLIB),
                source=coerce_text(mapping.get("source"), EDITOR_INVENTORY_SOURCE_LIBRARY),
                label=coerce_text(mapping.get("label"), "VPLIB Item"),
                description=coerce_text(mapping.get("description"), ""),
                family_id=first_text(mapping.get("familyId"), mapping.get("family_id"), library_ref.family_id),
                package_id=first_text(mapping.get("packageId"), mapping.get("package_id"), library_ref.package_id),
                vplib_uid=first_text(mapping.get("vplibUid"), mapping.get("vplib_uid"), library_ref.vplib_uid),
                variant_id=coerce_text(first_text(mapping.get("variantId"), mapping.get("variant_id"), library_ref.variant_id), DEFAULT_VARIANT_ID),
                revision_hash=first_text(mapping.get("revisionHash"), mapping.get("revision_hash"), library_ref.revision_hash),
                object_kind=coerce_text(first_text(mapping.get("objectKind"), mapping.get("object_kind"), library_ref.object_kind), DEFAULT_OBJECT_KIND),
                runtime_block_type_id=first_text(mapping.get("runtimeBlockTypeId"), mapping.get("runtime_block_type_id"), mapping.get("blockTypeId"), mapping.get("block_type_id")),
                source_path=first_text(mapping.get("sourcePath"), mapping.get("source_path"), library_ref.source_path),
                classification=classification,
                assets=assets,
                icon=icon,
                metadata=merge_metadata(mapping.get("metadata"), mapping.get("meta")),
                raw=to_json_compatible(mapping),
                extra=extract_extra_fields(mapping, KNOWN_SLOT_KEYS | KNOWN_LIBRARY_IDENTITY_KEYS),
            )

        return cls.from_library_record(mapping)

    @classmethod
    def empty(cls) -> "EditorInventoryItem":
        return cls(
            item_id="empty",
            item_kind=EDITOR_INVENTORY_ITEM_KIND_EMPTY,
            source=EDITOR_INVENTORY_SOURCE_EMPTY,
            label="",
            runtime_block_type_id=None,
        )

    def to_library_ref(self) -> EditorLibraryRef:
        return EditorLibraryRef.from_item(self)

    def to_placement_command(self) -> EditorPlacementCommand:
        return EditorPlacementCommand.from_item(self)

    def to_dict(self) -> dict[str, Any]:
        return {
            "itemId": self.item_id,
            "itemKind": self.item_kind,
            "kind": self.item_kind,
            "source": self.source,
            "label": self.label,
            "description": self.description,
            "familyId": self.family_id,
            "packageId": self.package_id,
            "vplibUid": self.vplib_uid,
            "variantId": self.variant_id,
            "revisionHash": self.revision_hash,
            "objectKind": self.object_kind,
            "runtimeBlockTypeId": self.runtime_block_type_id,
            "blockTypeId": self.runtime_block_type_id,
            "sourcePath": self.source_path,
            "classification": self.classification.to_dict(),
            "domain": self.classification.domain,
            "category": self.classification.category,
            "subcategory": self.classification.subcategory,
            "assets": self.assets.to_dict(),
            "icon": self.icon.to_dict(),
            "iconKey": self.icon.key,
            "iconKind": self.icon.kind,
            "iconUrl": self.icon.url,
            "metadata": to_json_compatible(self.metadata),
            "raw": to_json_compatible(self.raw),
            "extra": to_json_compatible(self.extra),
            "libraryRef": self.to_library_ref().to_dict() if self.is_library_item else None,
            "placementCommand": self.to_placement_command().to_dict() if self.is_placeable else None,
            "placeable": self.is_placeable,
            "stableKey": self.stable_key,
        }


@dataclasses.dataclass(slots=True)
class EditorInventorySlot(ModelBase):
    """
    Editor-Hotbar-/Inventory-Slot.
    """

    slot_index: int
    slot_key: str
    empty: bool = True
    enabled: bool = True
    selected: bool = False
    source: str = EDITOR_INVENTORY_SOURCE_EMPTY
    item: EditorInventoryItem | None = None
    visible_label: bool = True
    stack_size: int = 0
    max_stack_size: int = 0
    metadata: dict[str, Any] = dataclasses.field(default_factory=dict)
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @property
    def item_id(self) -> str | None:
        return self.item.item_id if self.item else None

    @property
    def item_kind(self) -> str:
        return self.item.item_kind if self.item else EDITOR_INVENTORY_ITEM_KIND_EMPTY

    @property
    def label(self) -> str:
        return self.item.label if self.item else ""

    @property
    def display_label(self) -> str:
        if not self.visible_label or not self.item:
            return ""
        return self.item.label

    @property
    def runtime_block_type_id(self) -> str | None:
        return self.item.runtime_block_type_id if self.item else None

    @property
    def placeable(self) -> bool:
        return bool(self.item and self.item.is_placeable and not self.empty and self.enabled)

    @property
    def breakable(self) -> bool:
        return False

    @property
    def icon(self) -> EditorInventoryIcon | None:
        return self.item.icon if self.item else None

    @classmethod
    def empty_slot(
        cls,
        slot_index: int,
        *,
        selected_slot: int = DEFAULT_SELECTED_SLOT,
    ) -> "EditorInventorySlot":
        safe_index = coerce_int(slot_index, 0, minimum=0)

        return cls(
            slot_index=safe_index,
            slot_key=f"hotbar-{safe_index}",
            empty=True,
            enabled=True,
            selected=safe_index == selected_slot,
            source=EDITOR_INVENTORY_SOURCE_EMPTY,
            item=None,
            visible_label=False,
            stack_size=0,
            max_stack_size=0,
        )

    @classmethod
    def from_item(
        cls,
        item: EditorInventoryItem,
        *,
        slot_index: int,
        selected_slot: int = DEFAULT_SELECTED_SLOT,
        visible_label: bool = True,
    ) -> "EditorInventorySlot":
        safe_index = coerce_int(slot_index, 0, minimum=0)

        return cls(
            slot_index=safe_index,
            slot_key=f"hotbar-{safe_index}",
            empty=not item.is_placeable,
            enabled=True,
            selected=safe_index == selected_slot,
            source=item.source,
            item=item,
            visible_label=visible_label,
            stack_size=1 if item.is_placeable else 0,
            max_stack_size=1 if item.is_placeable else 0,
            metadata={
                "source": item.source,
                "stableKey": item.stable_key,
            },
        )

    @classmethod
    def from_mapping(
        cls,
        value: Mapping[str, Any] | MutableMapping[str, Any] | Any,
        *,
        fallback_index: int = 0,
        selected_slot: int = DEFAULT_SELECTED_SLOT,
    ) -> "EditorInventorySlot":
        mapping = safe_mapping(value)

        slot_index = coerce_int(
            read_mapping_any(mapping, SLOT_INDEX_KEYS, fallback_index),
            fallback_index,
            minimum=0,
        )
        empty = coerce_bool(mapping.get("empty"), False)

        if empty:
            return cls.empty_slot(slot_index, selected_slot=selected_slot).clone(
                raw=to_json_compatible(mapping),
                extra=extract_extra_fields(mapping, KNOWN_SLOT_KEYS),
            )

        item = EditorInventoryItem.from_mapping(mapping)

        return cls(
            slot_index=slot_index,
            slot_key=coerce_text(first_text(mapping.get("slotKey"), mapping.get("slot_key")), f"hotbar-{slot_index}"),
            empty=not item.is_placeable,
            enabled=coerce_bool(mapping.get("enabled"), True),
            selected=coerce_bool(mapping.get("selected"), slot_index == selected_slot),
            source=coerce_text(mapping.get("source"), item.source),
            item=item,
            visible_label=coerce_bool(first_text(mapping.get("visibleLabel"), mapping.get("visible_label")), True),
            stack_size=coerce_int(first_text(mapping.get("stackSize"), mapping.get("stack_size")), 1 if item.is_placeable else 0, minimum=0),
            max_stack_size=coerce_int(first_text(mapping.get("maxStackSize"), mapping.get("max_stack_size")), 1 if item.is_placeable else 0, minimum=0),
            metadata=merge_metadata(mapping.get("metadata"), mapping.get("meta")),
            raw=to_json_compatible(mapping),
            extra=extract_extra_fields(mapping, KNOWN_SLOT_KEYS),
        )

    def to_dict(self) -> dict[str, Any]:
        icon = self.icon
        library_ref = self.item.to_library_ref() if self.item and self.item.is_library_item else None
        placement_command = self.item.to_placement_command() if self.item and self.item.is_placeable else None

        return {
            "slotIndex": self.slot_index,
            "slotKey": self.slot_key,
            "empty": self.empty,
            "enabled": self.enabled,
            "selected": self.selected,
            "source": self.source,
            "sourceKind": self.item_kind,
            "itemId": self.item_id,
            "itemKind": self.item_kind,
            "kind": self.item_kind,
            "type": self.item.object_kind if self.item else EDITOR_INVENTORY_ITEM_KIND_EMPTY,
            "blockTypeId": self.runtime_block_type_id,
            "runtimeBlockTypeId": self.runtime_block_type_id,
            "placeable": self.placeable,
            "breakable": self.breakable,
            "iconKey": icon.key if icon else None,
            "iconKind": icon.kind if icon else None,
            "iconUrl": icon.url if icon else None,
            "icon": icon.to_dict() if icon else None,
            "label": self.label,
            "displayLabel": self.display_label,
            "visibleLabel": self.visible_label,
            "ariaLabel": f"Inventar-Slot {self.slot_index + 1}: {self.label or 'leer'}",
            "title": self.label,
            "description": self.item.description if self.item else "",
            "stackSize": self.stack_size,
            "maxStackSize": self.max_stack_size,
            "familyId": self.item.family_id if self.item else None,
            "packageId": self.item.package_id if self.item else None,
            "vplibUid": self.item.vplib_uid if self.item else None,
            "variantId": self.item.variant_id if self.item else None,
            "revisionHash": self.item.revision_hash if self.item else None,
            "objectKind": self.item.object_kind if self.item else None,
            "domain": self.item.classification.domain if self.item else None,
            "category": self.item.classification.category if self.item else None,
            "subcategory": self.item.classification.subcategory if self.item else None,
            "libraryRef": library_ref.to_dict() if library_ref else None,
            "placementCommand": placement_command.to_dict() if placement_command else None,
            "assets": self.item.assets.to_dict() if self.item else None,
            "metadata": to_json_compatible(self.metadata),
            "raw": to_json_compatible(self.raw),
            "extra": to_json_compatible(self.extra),
        }


@dataclasses.dataclass(slots=True)
class EditorInventoryState(ModelBase):
    """
    Editor-Inventory-/Hotbar-Zustand.
    """

    enabled: bool = True
    source: str = EDITOR_INVENTORY_SOURCE_LIBRARY
    source_detail: str = EDITOR_LIBRARY_SOURCE_NAME
    hotbar_size: int = DEFAULT_HOTBAR_SIZE
    default_selected_slot: int = DEFAULT_SELECTED_SLOT
    selected_slot: int = DEFAULT_SELECTED_SLOT
    scroll_wrap: bool = True
    allow_place_action: bool = True
    allow_break_action: bool = True
    icon_only: bool = False
    slots: list[EditorInventorySlot] = dataclasses.field(default_factory=list)
    items: list[EditorInventoryItem] = dataclasses.field(default_factory=list)
    metadata: dict[str, Any] = dataclasses.field(default_factory=dict)
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    @property
    def filled_slot_count(self) -> int:
        return sum(1 for slot in self.slots if not slot.empty)

    @property
    def empty_slot_count(self) -> int:
        return sum(1 for slot in self.slots if slot.empty)

    @property
    def selected_item(self) -> EditorInventoryItem | None:
        for slot in self.slots:
            if slot.slot_index == self.selected_slot and slot.item:
                return slot.item
        return None

    @property
    def has_placeable_items(self) -> bool:
        return any(slot.placeable for slot in self.slots)

    @classmethod
    def empty(
        cls,
        *,
        hotbar_size: int = DEFAULT_HOTBAR_SIZE,
        selected_slot: int = DEFAULT_SELECTED_SLOT,
        source: str = EDITOR_INVENTORY_SOURCE_FALLBACK,
        source_detail: str = "empty",
    ) -> "EditorInventoryState":
        safe_size = coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
        safe_selected = coerce_int(selected_slot, DEFAULT_SELECTED_SLOT, minimum=0, maximum=max(0, safe_size - 1))

        return cls(
            enabled=True,
            source=source,
            source_detail=source_detail,
            hotbar_size=safe_size,
            default_selected_slot=safe_selected,
            selected_slot=safe_selected,
            allow_place_action=False,
            slots=[
                EditorInventorySlot.empty_slot(index, selected_slot=safe_selected)
                for index in range(safe_size)
            ],
            items=[],
        )

    @classmethod
    def from_slots(
        cls,
        slots: Sequence[EditorInventorySlot],
        *,
        source: str = EDITOR_INVENTORY_SOURCE_LIBRARY,
        source_detail: str = EDITOR_LIBRARY_SOURCE_NAME,
        hotbar_size: int = DEFAULT_HOTBAR_SIZE,
        selected_slot: int = DEFAULT_SELECTED_SLOT,
        enabled: bool = True,
        scroll_wrap: bool = True,
        allow_place_action: bool = True,
        allow_break_action: bool = True,
        icon_only: bool = False,
        metadata: Mapping[str, Any] | None = None,
    ) -> "EditorInventoryState":
        safe_size = coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
        safe_selected = coerce_int(selected_slot, DEFAULT_SELECTED_SLOT, minimum=0, maximum=max(0, safe_size - 1))

        slot_list = list(slots)
        by_index: dict[int, EditorInventorySlot] = {
            slot.slot_index: slot.clone(selected=slot.slot_index == safe_selected)
            for slot in slot_list
            if 0 <= slot.slot_index < safe_size
        }

        normalized_slots = [
            by_index.get(index) or EditorInventorySlot.empty_slot(index, selected_slot=safe_selected)
            for index in range(safe_size)
        ]

        seen_items: dict[str, EditorInventoryItem] = {}
        for slot in normalized_slots:
            if slot.item and slot.item.item_id not in seen_items:
                seen_items[slot.item.item_id] = slot.item

        return cls(
            enabled=enabled,
            source=source,
            source_detail=source_detail,
            hotbar_size=safe_size,
            default_selected_slot=safe_selected,
            selected_slot=safe_selected,
            scroll_wrap=scroll_wrap,
            allow_place_action=allow_place_action and any(slot.placeable for slot in normalized_slots),
            allow_break_action=allow_break_action,
            icon_only=icon_only,
            slots=normalized_slots,
            items=list(seen_items.values()),
            metadata=to_json_compatible(safe_mapping(metadata)),
        )

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> "EditorInventoryState":
        mapping = safe_mapping(value)

        inventory_mapping = safe_mapping(mapping.get("inventory"))
        source_mapping = inventory_mapping or mapping

        hotbar_size = coerce_int(
            first_text(source_mapping.get("hotbarSize"), source_mapping.get("hotbar_size")),
            DEFAULT_HOTBAR_SIZE,
            minimum=1,
            maximum=MAX_HOTBAR_SIZE,
        )
        selected_slot = coerce_int(
            first_text(source_mapping.get("selectedSlot"), source_mapping.get("selected_slot")),
            DEFAULT_SELECTED_SLOT,
            minimum=0,
            maximum=max(0, hotbar_size - 1),
        )

        slots_raw = safe_sequence(source_mapping.get("slots"))
        slots = [
            EditorInventorySlot.from_mapping(slot_raw, fallback_index=index, selected_slot=selected_slot)
            for index, slot_raw in enumerate(slots_raw)
        ]

        if not slots:
            return cls.empty(
                hotbar_size=hotbar_size,
                selected_slot=selected_slot,
                source=coerce_text(source_mapping.get("source"), EDITOR_INVENTORY_SOURCE_FALLBACK),
                source_detail=coerce_text(source_mapping.get("sourceDetail", source_mapping.get("source_detail")), "empty"),
            ).clone(
                raw=to_json_compatible(mapping),
                extra=extract_extra_fields(source_mapping, frozenset(("inventory", "slots"))),
            )

        return cls.from_slots(
            slots,
            source=coerce_text(source_mapping.get("source"), EDITOR_INVENTORY_SOURCE_LIBRARY),
            source_detail=coerce_text(first_text(source_mapping.get("sourceDetail"), source_mapping.get("source_detail")), EDITOR_LIBRARY_SOURCE_NAME),
            hotbar_size=hotbar_size,
            selected_slot=selected_slot,
            enabled=coerce_bool(source_mapping.get("enabled"), True),
            scroll_wrap=coerce_bool(first_text(source_mapping.get("scrollWrap"), source_mapping.get("scroll_wrap")), True),
            allow_place_action=coerce_bool(first_text(source_mapping.get("allowPlaceAction"), source_mapping.get("allow_place_action")), True),
            allow_break_action=coerce_bool(first_text(source_mapping.get("allowBreakAction"), source_mapping.get("allow_break_action")), True),
            icon_only=coerce_bool(first_text(source_mapping.get("iconOnly"), source_mapping.get("icon_only")), False),
            metadata=merge_metadata(source_mapping.get("metadata"), source_mapping.get("meta")),
        ).clone(
            raw=to_json_compatible(mapping),
            extra=extract_extra_fields(source_mapping, frozenset(("slots", "items"))),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "source": self.source,
            "sourceDetail": self.source_detail,
            "hotbarSize": self.hotbar_size,
            "defaultSelectedSlot": self.default_selected_slot,
            "selectedSlot": self.selected_slot,
            "scrollWrap": self.scroll_wrap,
            "allowPlaceAction": self.allow_place_action,
            "allowBreakAction": self.allow_break_action,
            "iconOnly": self.icon_only,
            "items": [item.to_dict() for item in self.items],
            "slots": [slot.to_dict() for slot in self.slots],
            "emptySlotCount": self.empty_slot_count,
            "filledSlotCount": self.filled_slot_count,
            "hasPlaceableItems": self.has_placeable_items,
            "selectedItem": self.selected_item.to_dict() if self.selected_item else None,
            "metadata": to_json_compatible(self.metadata),
            "raw": to_json_compatible(self.raw),
            "extra": to_json_compatible(self.extra),
        }


@dataclasses.dataclass(slots=True)
class EditorInventoryPayload(ModelBase):
    """
    Root-Payload für `/editor/api/inventory`.
    """

    ok: bool = True
    kind: str = EDITOR_INVENTORY_KIND
    schema_version: str = EDITOR_INVENTORY_SCHEMA_VERSION
    source: str = EDITOR_INVENTORY_SOURCE_LIBRARY
    source_detail: str = EDITOR_LIBRARY_SOURCE_NAME
    generated_at_utc: str = dataclasses.field(default_factory=safe_utc_timestamp)
    route: str = "/editor/api/inventory"
    inventory: EditorInventoryState = dataclasses.field(default_factory=EditorInventoryState)
    capabilities: dict[str, Any] = dataclasses.field(default_factory=dict)
    fallback: dict[str, Any] = dataclasses.field(default_factory=lambda: {"active": False, "reason": None})
    diagnostics: dict[str, Any] = dataclasses.field(default_factory=dict)
    metadata: dict[str, Any] = dataclasses.field(default_factory=dict)
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    DEFAULT_CAPABILITIES: ClassVar[dict[str, Any]] = {
        "serverDriven": True,
        "source": EDITOR_LIBRARY_SOURCE_NAME,
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
    }

    @classmethod
    def from_inventory_state(
        cls,
        inventory: EditorInventoryState,
        *,
        ok: bool | None = None,
        source: str | None = None,
        source_detail: str | None = None,
        route: str = "/editor/api/inventory",
        fallback: Mapping[str, Any] | None = None,
        diagnostics: Mapping[str, Any] | None = None,
    ) -> "EditorInventoryPayload":
        resolved_ok = inventory.has_placeable_items if ok is None else bool(ok)

        return cls(
            ok=resolved_ok,
            source=source or inventory.source,
            source_detail=source_detail or inventory.source_detail,
            route=route,
            inventory=inventory,
            capabilities=to_json_compatible(cls.DEFAULT_CAPABILITIES),
            fallback=to_json_compatible(safe_mapping(fallback) or {"active": False, "reason": None}),
            diagnostics=to_json_compatible(safe_mapping(diagnostics)),
        )

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | MutableMapping[str, Any] | Any) -> "EditorInventoryPayload":
        mapping = safe_mapping(value)
        inventory = EditorInventoryState.from_mapping(mapping)

        return cls(
            ok=coerce_bool(mapping.get("ok"), inventory.has_placeable_items),
            kind=coerce_text(mapping.get("kind"), EDITOR_INVENTORY_KIND),
            schema_version=coerce_text(first_text(mapping.get("schemaVersion"), mapping.get("schema_version")), EDITOR_INVENTORY_SCHEMA_VERSION),
            source=coerce_text(mapping.get("source"), inventory.source),
            source_detail=coerce_text(first_text(mapping.get("sourceDetail"), mapping.get("source_detail")), inventory.source_detail),
            generated_at_utc=coerce_text(first_text(mapping.get("generatedAtUtc"), mapping.get("generated_at_utc")), safe_utc_timestamp()),
            route=coerce_text(mapping.get("route"), "/editor/api/inventory"),
            inventory=inventory,
            capabilities=to_json_compatible(safe_mapping(mapping.get("capabilities")) or cls.DEFAULT_CAPABILITIES),
            fallback=to_json_compatible(safe_mapping(mapping.get("fallback"))),
            diagnostics=to_json_compatible(safe_mapping(mapping.get("diagnostics"))),
            metadata=merge_metadata(mapping.get("metadata"), mapping.get("meta")),
            raw=to_json_compatible(mapping),
            extra=extract_extra_fields(
                mapping,
                frozenset(
                    (
                        "ok",
                        "kind",
                        "schemaVersion",
                        "schema_version",
                        "source",
                        "sourceDetail",
                        "source_detail",
                        "generatedAtUtc",
                        "generated_at_utc",
                        "route",
                        "inventory",
                        "capabilities",
                        "fallback",
                        "diagnostics",
                        "metadata",
                        "meta",
                    )
                ),
            ),
        )

    @classmethod
    def empty_fallback(
        cls,
        *,
        hotbar_size: int = DEFAULT_HOTBAR_SIZE,
        selected_slot: int = DEFAULT_SELECTED_SLOT,
        reason: str = "empty-fallback",
        route: str = "/editor/api/inventory",
    ) -> "EditorInventoryPayload":
        inventory = EditorInventoryState.empty(
            hotbar_size=hotbar_size,
            selected_slot=selected_slot,
            source=EDITOR_INVENTORY_SOURCE_FALLBACK,
            source_detail=reason,
        )

        return cls.from_inventory_state(
            inventory,
            ok=False,
            source=EDITOR_INVENTORY_SOURCE_FALLBACK,
            source_detail=reason,
            route=route,
            fallback={
                "active": True,
                "reason": reason,
            },
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "kind": self.kind,
            "schemaVersion": self.schema_version,
            "source": self.source,
            "sourceDetail": self.source_detail,
            "generatedAtUtc": self.generated_at_utc,
            "route": self.route,
            "inventory": self.inventory.to_dict(),
            "capabilities": to_json_compatible(self.capabilities or self.DEFAULT_CAPABILITIES),
            "fallback": to_json_compatible(self.fallback),
            "diagnostics": to_json_compatible(self.diagnostics),
            "metadata": to_json_compatible(self.metadata),
            "raw": to_json_compatible(self.raw),
            "extra": to_json_compatible(self.extra),
        }


# -----------------------------------------------------------------------------
# Metadata-Modell
# -----------------------------------------------------------------------------

@dataclasses.dataclass(slots=True)
class LibraryInventoryModelMetadata(ModelBase):
    """
    Diagnose-Metadaten der Modellschicht.
    """

    module_name: str = LIBRARY_INVENTORY_MODELS_MODULE_NAME
    module_version: str = LIBRARY_INVENTORY_MODELS_MODULE_VERSION
    schema_version: str = EDITOR_INVENTORY_SCHEMA_VERSION
    generated_at_utc: str = dataclasses.field(default_factory=safe_utc_timestamp)

    def to_dict(self) -> dict[str, Any]:
        return {
            "moduleName": self.module_name,
            "moduleVersion": self.module_version,
            "schemaVersion": self.schema_version,
            "generatedAtUtc": self.generated_at_utc,
            "models": [
                "LibraryClassification",
                "LibraryAssetRefs",
                "EditorInventoryIcon",
                "EditorLibraryRef",
                "EditorPlacementCommand",
                "EditorInventoryItem",
                "EditorInventorySlot",
                "EditorInventoryState",
                "EditorInventoryPayload",
            ],
            "defaults": {
                "hotbarSize": DEFAULT_HOTBAR_SIZE,
                "selectedSlot": DEFAULT_SELECTED_SLOT,
                "variantId": DEFAULT_VARIANT_ID,
                "source": EDITOR_INVENTORY_SOURCE_LIBRARY,
                "librarySource": EDITOR_LIBRARY_SOURCE_NAME,
            },
            "rules": {
                "debugGrassDirtAllowed": False,
                "unknownFieldsPreserved": True,
                "rawPayloadPreserved": True,
                "runtimeBlockTypeIdIsTemporaryAdapter": True,
            },
        }


# -----------------------------------------------------------------------------
# Öffentliche Hilfsfunktionen
# -----------------------------------------------------------------------------

def build_empty_slots(
    *,
    hotbar_size: int = DEFAULT_HOTBAR_SIZE,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
) -> list[EditorInventorySlot]:
    """
    Baut leere Slots.
    """
    safe_size = coerce_int(hotbar_size, DEFAULT_HOTBAR_SIZE, minimum=1, maximum=MAX_HOTBAR_SIZE)
    safe_selected = coerce_int(selected_slot, DEFAULT_SELECTED_SLOT, minimum=0, maximum=max(0, safe_size - 1))

    return [
        EditorInventorySlot.empty_slot(index, selected_slot=safe_selected)
        for index in range(safe_size)
    ]


def coerce_inventory_item(value: Any) -> EditorInventoryItem:
    """
    Erzwingt ein EditorInventoryItem.
    """
    if isinstance(value, EditorInventoryItem):
        return value

    return EditorInventoryItem.from_mapping(value)


def coerce_inventory_slot(
    value: Any,
    *,
    fallback_index: int = 0,
    selected_slot: int = DEFAULT_SELECTED_SLOT,
) -> EditorInventorySlot:
    """
    Erzwingt einen EditorInventorySlot.
    """
    if isinstance(value, EditorInventorySlot):
        return value

    return EditorInventorySlot.from_mapping(
        value,
        fallback_index=fallback_index,
        selected_slot=selected_slot,
    )


def coerce_inventory_state(value: Any) -> EditorInventoryState:
    """
    Erzwingt einen EditorInventoryState.
    """
    if isinstance(value, EditorInventoryState):
        return value

    return EditorInventoryState.from_mapping(value)


def coerce_inventory_payload(value: Any) -> EditorInventoryPayload:
    """
    Erzwingt einen EditorInventoryPayload.
    """
    if isinstance(value, EditorInventoryPayload):
        return value

    return EditorInventoryPayload.from_mapping(value)


def get_library_inventory_models_metadata() -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten der Modellschicht.
    """
    return LibraryInventoryModelMetadata().to_dict()


def clear_library_inventory_models_caches() -> None:
    """
    Cache-Clear-Hook für Symmetrie mit anderen Submodulen.

    Aktuell hält dieses Modul keine lru_caches, aber die Funktion bleibt als
    stabile öffentliche API erhalten.
    """
    return None


# -----------------------------------------------------------------------------
# Öffentliche Exporte
# -----------------------------------------------------------------------------

__all__ = [
    "LIBRARY_INVENTORY_MODELS_MODULE_NAME",
    "LIBRARY_INVENTORY_MODELS_MODULE_VERSION",
    "EDITOR_INVENTORY_KIND",
    "EDITOR_INVENTORY_SCHEMA_VERSION",
    "EDITOR_INVENTORY_ITEM_KIND_VPLIB",
    "EDITOR_INVENTORY_ITEM_KIND_EMPTY",
    "EDITOR_INVENTORY_SOURCE_LIBRARY",
    "EDITOR_INVENTORY_SOURCE_EMPTY",
    "EDITOR_INVENTORY_SOURCE_FALLBACK",
    "EDITOR_LIBRARY_SOURCE_NAME",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "DEFAULT_VARIANT_ID",
    "DEFAULT_OBJECT_KIND",
    "DEFAULT_ICON_KIND",
    "DEFAULT_PLACE_COMMAND_KIND",
    "LibraryClassification",
    "LibraryAssetRefs",
    "EditorInventoryIcon",
    "EditorLibraryRef",
    "EditorPlacementCommand",
    "EditorInventoryItem",
    "EditorInventorySlot",
    "EditorInventoryState",
    "EditorInventoryPayload",
    "LibraryInventoryModelMetadata",
    "normalize_text",
    "coerce_text",
    "coerce_bool",
    "coerce_int",
    "safe_utc_timestamp",
    "safe_mapping",
    "safe_sequence",
    "safe_list_of_mappings",
    "to_json_compatible",
    "read_mapping_any",
    "deep_get",
    "first_text",
    "slug_from_text",
    "extract_extra_fields",
    "merge_metadata",
    "build_empty_slots",
    "coerce_inventory_item",
    "coerce_inventory_slot",
    "coerce_inventory_state",
    "coerce_inventory_payload",
    "get_library_inventory_models_metadata",
    "clear_library_inventory_models_caches",
]