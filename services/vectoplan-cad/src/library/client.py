from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Mapping


CATALOG_CONTRACT = "cad-library-catalog/0.1"
ROOM_ITEM = {
    "catalog_item_id": "world-edit-room",
    "family_ref": "world-edit.room",
    "package_ref": "vectoplan.world-edit",
    "variant_ref": "default",
    "revision_hash": "builtin-world-edit-room-v1",
    "label": "Räume",
    "description": "Semantischen Raum aus einer WorldEdit-Auswahl erzeugen.",
    "domain": "world-edit",
    "category": "basic-tools",
    "subcategory": "built-in",
    "object_kind": "world_edit_tool",
    "placement_kind": "room",
    "world_edit_tool": "room",
    "dimensions": {"width_mm": 1000, "height_mm": 3000, "depth_mm": 1000, "thickness_mm": 0},
    "plan_representation": {
        "symbol_kind": "room",
        "detail_level": "permit",
        "room_fill_mode": "zone",
        "room_stamp_show_name": True,
        "room_stamp_show_area": True,
        "room_stamp_show_floor_finish": True,
        "line_weight_mm": 0.35,
    },
    "variants": [
        {
            "variant_ref": "default",
            "label": "Raum",
            "is_default": True,
            "dimensions": {"width_mm": 1000, "height_mm": 3000, "depth_mm": 1000, "thickness_mm": 0},
            "plan_representation": {
                "symbol_kind": "room",
                "detail_level": "permit",
                "room_fill_mode": "zone",
                "room_stamp_show_name": True,
                "room_stamp_show_area": True,
                "room_stamp_show_floor_finish": True,
                "line_weight_mm": 0.35,
            },
        }
    ],
    "source": "vectoplan-library/world-edit",
}


class LibraryClientError(RuntimeError):
    pass


def load_cad_library_catalog(config: Mapping[str, Any]) -> dict[str, Any]:
    """Load and reduce the Creative Library to the contract CAD is allowed to place."""
    base_url = str(config.get("LIBRARY_INTERNAL_URL") or "").rstrip("/")
    if base_url:
        try:
            payload = _request_inventory(config, base_url)
            items = _extract_items(payload)
            normalized = [item for value in items if (item := _normalize_item(value))]
            fallback_items = _load_fallback_items(config)
            known_families = {item["family_ref"] for item in normalized}
            normalized.extend(item for item in fallback_items if item["family_ref"] not in known_families)
            return _catalog(normalized, source="vectoplan-library+standard-vplib", authoritative=True)
        except LibraryClientError:
            if not bool(config.get("MOCK_MODE")):
                raise

    return _catalog(_load_fallback_items(config), source="vectoplan-library-repository", authoritative=True)


def _load_fallback_items(config: Mapping[str, Any]) -> list[dict[str, Any]]:
    fallback_path = Path(str(config["LIBRARY_FALLBACK_CATALOG_PATH"]))
    try:
        fallback = json.loads(fallback_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise LibraryClientError(f"Library fallback catalog is unavailable: {exc}") from exc
    items = fallback.get("items") if isinstance(fallback, dict) else None
    if not isinstance(items, list):
        raise LibraryClientError("Library fallback catalog has no items array")
    return [item for value in items if (item := _normalize_item(value))]


def resolve_catalog_item(
    catalog: Mapping[str, Any], family_ref: str, variant_ref: str | None = None
) -> dict[str, Any] | None:
    requested_family = str(family_ref or "").strip()
    requested_variant = str(variant_ref or "").strip()
    for value in catalog.get("items") or []:
        if not isinstance(value, dict) or value.get("family_ref") != requested_family:
            continue
        variants = value.get("variants") if isinstance(value.get("variants"), list) else []
        selected = None
        if requested_variant:
            selected = next(
                (item for item in variants if isinstance(item, dict) and item.get("variant_ref") == requested_variant),
                None,
            )
            if selected is None:
                requested_key = _variant_key(requested_variant)
                selected = next(
                    (
                        item
                        for item in variants
                        if isinstance(item, dict)
                        and _variant_key(item.get("variant_ref")) == requested_key
                    ),
                    None,
                )
            if selected is None:
                return None
        if selected is None:
            selected = next(
                (item for item in variants if isinstance(item, dict) and item.get("is_default")),
                variants[0] if variants else None,
            )
        return {**value, "selected_variant": selected}
    return None


def _variant_key(value: Any) -> str:
    """Keep historic ``885_x_2010_mm`` references compatible with generated IDs."""
    return _text(value).lower().replace("_x_", "_").replace("×", "_").replace("x", "_")


def _request_inventory(config: Mapping[str, Any], base_url: str) -> dict[str, Any]:
    path = str(config.get("LIBRARY_INVENTORY_PATH") or "").strip()
    url = base_url + (path if path.startswith("/") else f"/{path}")
    headers = {"Accept": "application/json", "User-Agent": "vectoplan-cad/library-client"}
    api_key = str(config.get("LIBRARY_SERVICE_API_KEY") or "").strip()
    if api_key:
        headers.update({"Authorization": f"Bearer {api_key}", "X-Service-API-Key": api_key})
    request = urllib.request.Request(url, method="GET", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=int(config.get("LIBRARY_TIMEOUT_SECONDS") or 15)) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise LibraryClientError(f"Creative Library returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise LibraryClientError(f"Creative Library request failed: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("ok") is False:
        raise LibraryClientError("Creative Library returned an invalid response")
    return payload


def _extract_items(payload: Mapping[str, Any]) -> list[Any]:
    candidates = [
        payload.get("items"),
        _mapping(payload.get("payload")).get("items"),
        _mapping(payload.get("data")).get("items"),
        _mapping(_mapping(payload.get("payload")).get("data")).get("items"),
    ]
    return next((value for value in candidates if isinstance(value, list)), [])


def _normalize_item(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None
    status = _text(value.get("publication_status") or value.get("status")).lower()
    if status and status not in {"published", "ready", "active", "ok"}:
        return None
    if value.get("enabled") is False or value.get("visible") is False or value.get("is_deleted") is True:
        return None
    family_ref = _text(value.get("family_ref") or value.get("family_id"))
    if not family_ref:
        return None
    variants = [_normalize_variant(item) for item in (value.get("variants") or [])]
    variants = [item for item in variants if item]
    default_variant = _text(value.get("default_variant_id") or value.get("variant_ref") or "default")
    if not variants:
        variants = [{
            "variant_ref": default_variant,
            "label": default_variant,
            "is_default": True,
            "dimensions": _dimensions(value),
            "plan_representation": _plan_representation(value),
        }]
    elif not any(item["is_default"] for item in variants):
        for item in variants:
            item["is_default"] = item["variant_ref"] == default_variant
        if not any(item["is_default"] for item in variants):
            variants[0]["is_default"] = True
    label = _text(value.get("label") or value.get("name") or family_ref)
    domain = _text(value.get("domain"))
    category = _text(value.get("category"))
    subcategory = _text(value.get("subcategory"))
    placement_kind = _placement_kind(label, family_ref, category, subcategory)
    selected = next((item for item in variants if item["is_default"]), variants[0])
    placement_command = _mapping(value.get("placement_command") or value.get("placementCommand"))
    runtime_block_type_id = _text(
        value.get("runtime_block_type_id")
        or value.get("runtimeBlockTypeId")
        or placement_command.get("runtimeBlockTypeId")
        or placement_command.get("blockTypeId")
        or family_ref
    )
    return {
        "catalog_item_id": _text(value.get("id") or value.get("item_db_id") or family_ref),
        "family_ref": family_ref,
        "package_ref": _text(value.get("package_id")),
        "vplib_uid": _text(value.get("vplib_uid") or value.get("vplibUid")),
        "runtime_block_type_id": runtime_block_type_id,
        "placement_command": dict(placement_command),
        "variant_ref": selected["variant_ref"],
        "revision_hash": _text(value.get("revision_hash") or value.get("published_revision_hash")),
        "label": label,
        "description": _text(value.get("description")),
        "domain": domain,
        "category": category,
        "subcategory": subcategory,
        "object_kind": _text(value.get("object_kind") or "cell_block"),
        "placement_kind": placement_kind,
        "world_edit_tool": _text(value.get("world_edit_tool")),
        "dimensions": selected["dimensions"],
        "plan_representation": selected.get("plan_representation") or _plan_representation(value),
        "variants": variants,
        "source": "vectoplan-library/creative-inventory",
    }


def _normalize_variant(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping) or value.get("enabled") is False or value.get("visible") is False:
        return None
    variant_ref = _text(value.get("variant_id") or value.get("variant_ref") or value.get("id_in_family"))
    if not variant_ref:
        return None
    return {
        "variant_ref": variant_ref,
        "label": _text(value.get("label") or value.get("name") or variant_ref),
        "is_default": bool(value.get("is_default")),
        "dimensions": _dimensions(value),
        "plan_representation": _plan_representation(value),
    }


def _dimensions(value: Mapping[str, Any]) -> dict[str, float]:
    definitions = _mapping(value.get("definition_values"))
    payload = _mapping(value.get("payload"))
    payload_definitions = _mapping(payload.get("definition_values"))
    sources = (definitions, payload_definitions, value)

    def number(*keys: str, fallback: float) -> float:
        for source in sources:
            for key in keys:
                candidate = source.get(key)
                if isinstance(candidate, (int, float)) and not isinstance(candidate, bool) and candidate >= 0:
                    return float(candidate)
        return fallback

    return {
        "width_mm": number("dimensions.width_mm", "width_mm", fallback=1000),
        "height_mm": number("dimensions.height_mm", "height_mm", fallback=1000),
        "depth_mm": number("dimensions.depth_mm", "depth_mm", fallback=1000),
        "thickness_mm": number("dimensions.thickness_mm", "thickness_mm", fallback=100),
    }


def _plan_representation(value: Mapping[str, Any]) -> dict[str, Any]:
    definitions = _mapping(value.get("definition_values"))
    payload = _mapping(value.get("payload"))
    payload_definitions = _mapping(payload.get("definition_values"))
    explicit = _mapping(value.get("plan_representation"))
    sources = (explicit, definitions, payload_definitions, value)

    def first(*keys: str, default: Any = None) -> Any:
        for source in sources:
            for key in keys:
                if key in source and source.get(key) is not None:
                    return source.get(key)
        return default

    try:
        frame_line_count = int(first("frame_line_count", "cad.plan.frame_line_count", default=2) or 2)
    except (TypeError, ValueError):
        frame_line_count = 2
    try:
        line_weight_mm = float(first("line_weight_mm", "cad.plan.line_weight_mm", default=0.35) or 0.35)
    except (TypeError, ValueError):
        line_weight_mm = 0.35

    def flag(*keys: str, default: bool = False) -> bool:
        raw = first(*keys, default=default)
        if isinstance(raw, str):
            return raw.strip().lower() in {"1", "true", "yes", "on"}
        return bool(raw)

    return {
        "symbol_kind": _text(first("symbol_kind", "cad.plan.symbol_kind", default="auto")) or "auto",
        "detail_level": _text(first("detail_level", "cad.plan.detail_level", default="permit")) or "permit",
        "show_swing": flag("show_swing", "cad.plan.show_swing", default=True),
        "show_opening_label": flag("show_opening_label", "cad.plan.show_opening_label", default=True),
        "show_sill_height": flag("show_sill_height", "cad.plan.show_sill_height", default=True),
        "frame_line_count": max(1, min(5, frame_line_count)),
        "room_fill_mode": _text(first("room_fill_mode", "cad.plan.room_fill_mode", default="zone")) or "zone",
        "room_stamp_show_name": flag("room_stamp_show_name", "cad.plan.room_stamp_show_name", default=True),
        "room_stamp_show_area": flag("room_stamp_show_area", "cad.plan.room_stamp_show_area", default=True),
        "room_stamp_show_floor_finish": flag("room_stamp_show_floor_finish", "cad.plan.room_stamp_show_floor_finish", default=False),
        "line_weight_mm": max(0.1, min(2.0, line_weight_mm)),
    }


def _placement_kind(label: str, family_ref: str, category: str, subcategory: str) -> str:
    haystack = " ".join((label, family_ref, category, subcategory)).lower()
    if any(token in haystack for token in ("treppe", "treppen", "stair")):
        return "room"
    if any(token in haystack for token in ("fenster", "tür", "tuer", "öffnung", "oeffnung")):
        return "opening"
    if any(token in haystack for token in ("wand", "dämmung", "daemmung", "wdvs")):
        return "linear"
    return "object"


def _catalog(items: list[dict[str, Any]], *, source: str, authoritative: bool) -> dict[str, Any]:
    merged = [*items]
    if not any(item.get("family_ref") == ROOM_ITEM["family_ref"] for item in merged):
        merged.append(dict(ROOM_ITEM))
    merged.sort(key=lambda item: (str(item.get("domain")), str(item.get("category")), str(item.get("label"))))
    return {
        "ok": True,
        "contract_version": CATALOG_CONTRACT,
        "source": source,
        "authoritative": authoritative,
        "item_count": len(merged),
        "items": merged,
    }


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _text(value: Any) -> str:
    return str(value or "").strip()
