"""Same-origin adapter for vectoplan-library's persistent user inventory."""
from __future__ import annotations

import json
import os
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any, Final
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

USER_INVENTORY_API_PATH: Final[str] = "/api/v1/vplib/inventar_user"
DEFAULT_LIBRARY_BASE_URL: Final[str] = "http://vectoplan-library:5000"
DEFAULT_PUBLIC_BASE_URL: Final[str] = "http://127.0.0.1:5101"
HOTBAR_SIZE: Final[int] = 9

class UserInventoryAdapterError(RuntimeError):
    pass

def _map(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}

def _maps(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        return []
    return [dict(item) for item in value if isinstance(item, Mapping)]

def _text(value: Any, default: str = "") -> str:
    try:
        normalized = str(value).strip() if value is not None else ""
    except Exception:
        normalized = ""
    return normalized or default

def _int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        result = default
    return min(maximum, max(minimum, result))

def _bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    normalized = _text(value).lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default

def _config(source: Any, *keys: str, default: Any = None) -> Any:
    values = _map(source)
    for key in keys:
        value = values.get(key) or os.getenv(key)
        if value not in (None, ""):
            return value
    return default

def _base_url(source: Any) -> str:
    return _text(_config(
        source,
        "VECTOPLAN_LIBRARY_BASE_URL",
        "VECTOPLAN_LIBRARY_URL",
        "VECTOPLAN_LIBRARY_SERVICE_URL",
        "VECTOPLAN_EDITOR_LIBRARY_BASE_URL",
        default=DEFAULT_LIBRARY_BASE_URL,
    ), DEFAULT_LIBRARY_BASE_URL).rstrip("/")

def _public_base_url(source: Any) -> str:
    return _text(_config(
        source,
        "VECTOPLAN_LIBRARY_PUBLIC_BASE_URL",
        "VECTOPLAN_LIBRARY_BROWSER_BASE_URL",
        "VECTOPLAN_EDITOR_LIBRARY_PUBLIC_BASE_URL",
        default=DEFAULT_PUBLIC_BASE_URL,
    ), DEFAULT_PUBLIC_BASE_URL).rstrip("/")

def get_creative_inventory_public_url(config_source: Any = None) -> str:
    return f"{_public_base_url(config_source)}/creative-inventar"

def _request_json(
    *, source: Any, method: str, path: str,
    query: Mapping[str, Any] | None = None,
    body: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    url = f"{_base_url(source)}{path}"
    query_values = {str(k): v for k, v in _map(query).items() if v is not None}
    if query_values:
        url = f"{url}?{urlencode(query_values)}"
    raw_body = json.dumps(dict(body), ensure_ascii=False).encode("utf-8") if body else None
    headers = {
        "Accept": "application/json",
        "User-Agent": "vectoplan-editor/user-inventory-adapter",
        "X-VECTOPLAN-Editor-Inventory-Source": "vectoplan-user-inventory",
    }
    if raw_body:
        headers["Content-Type"] = "application/json"
    timeout = float(_config(source, "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT", default=5.0))
    request = Request(url, data=raw_body, headers=headers, method=method.upper())
    try:
        with urlopen(request, timeout=max(0.2, min(120.0, timeout))) as response:
            raw = response.read(4 * 1024 * 1024)
            payload = json.loads(raw.decode("utf-8")) if raw else {}
    except HTTPError as exc:
        raise UserInventoryAdapterError(f"User inventory HTTP {exc.code} at {url}") from exc
    except (URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise UserInventoryAdapterError(f"User inventory unavailable at {url}: {exc}") from exc
    if not isinstance(payload, Mapping) or payload.get("ok") is False:
        raise UserInventoryAdapterError("User inventory returned an invalid or failed payload.")
    return dict(payload)

def _unwrap(payload: Mapping[str, Any]) -> dict[str, Any]:
    for key in ("data", "payload", "result"):
        if isinstance(payload.get(key), Mapping):
            return dict(payload[key])
    return dict(payload)

def _nested(record: Mapping[str, Any], *keys: str) -> Any:
    for source in (
        record, _map(record.get("placement")), _map(record.get("payload")),
        _map(record.get("variant")), _map(record.get("metadata")), _map(record.get("meta")),
    ):
        for key in keys:
            if source.get(key) not in (None, ""):
                return source[key]
    return None

def _public_asset_url(value: Any, public_base_url: str) -> str | None:
    raw = _text(value)
    if not raw:
        return None
    lowered = raw.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return raw
    if raw.startswith("/"):
        return f"{public_base_url}{raw}"
    return f"{public_base_url}/{raw.lstrip('/')}"

def _public_asset_items(slot: Mapping[str, Any], public_base_url: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for source in _maps(slot.get("assets")):
        asset = dict(source)
        for key in ("uri", "url", "preview_url", "previewUrl"):
            if asset.get(key) not in (None, ""):
                asset[key] = _public_asset_url(asset[key], public_base_url)
        result.append(asset)
    return result

def _public_preview(slot: Mapping[str, Any], public_base_url: str) -> dict[str, Any]:
    preview = _map(slot.get("preview"))
    for key in ("url", "uri", "src"):
        if preview.get(key) not in (None, ""):
            preview[key] = _public_asset_url(preview[key], public_base_url)
    return preview

def _editor_slot(
    slot: Mapping[str, Any],
    fallback: int,
    public_base_url: str,
) -> dict[str, Any]:
    index = _int(slot.get("slot_index", slot.get("slotIndex", fallback + 1)), fallback + 1, 1, HOTBAR_SIZE) - 1
    family = _text(_nested(slot, "familyId", "family_id"))
    uid = _text(_nested(slot, "vplibUid", "vplib_uid", "uid"))
    package = _text(_nested(slot, "packageId", "package_id"))
    variant = _text(_nested(slot, "variantId", "variant_id"), "default")
    assets = _public_asset_items(slot, public_base_url)
    preview = _public_preview(slot, public_base_url)
    runtime_id = _text(_nested(
        slot, "runtimeBlockTypeId", "runtime_block_type_id", "blockTypeId", "block_type_id"
    )) or family or (f"vplib:{uid}:{variant}" if uid else "")
    common = {
        "slotIndex": index,
        "slotKey": f"hotbar-{index}",
        "selected": _bool(slot.get("selected")),
        "enabled": not _bool(slot.get("locked")),
        "source": "vectoplan-user-inventory",
    }
    if _bool(slot.get("empty")) or not (family or uid or runtime_id):
        return {**common, "empty": True, "sourceKind": "empty", "placeable": False}
    item_id = _text(_nested(slot, "itemId", "item_id", "item_db_id", "id"), family or uid or runtime_id)
    return {
        **dict(slot), **common, "assets": assets, "preview": preview,
        "empty": False, "sourceKind": "vplib", "itemId": item_id,
        "itemKind": "vplib", "kind": "vplib",
        "familyId": family or None, "packageId": package or None,
        "vplibUid": uid or None, "variantId": variant,
        "runtimeBlockTypeId": runtime_id, "blockTypeId": runtime_id,
        "label": _text(_nested(slot, "label", "name", "title"), "VPLIB Item"),
        "objectKind": _text(_nested(slot, "objectKind", "object_kind"), "library_item"),
        "placeable": True, "breakable": False,
    }

def _empty_payload(selected: int, route: str, error: Any) -> dict[str, Any]:
    slots = [{
        "slotIndex": index, "slotKey": f"hotbar-{index}", "empty": True,
        "enabled": True, "selected": index == selected,
        "source": "vectoplan-user-inventory", "sourceKind": "empty",
        "itemKind": "empty", "placeable": False, "breakable": False,
    } for index in range(HOTBAR_SIZE)]
    return {
        "ok": False, "kind": "editor-user-inventory",
        "schemaVersion": "editor-user-inventory.v1",
        "source": "vectoplan-user-inventory", "sourceDetail": "user-inventory-unavailable",
        "generatedAtUtc": datetime.now(UTC).isoformat(), "route": route,
        "inventory": {
            "enabled": True, "source": "vectoplan-user-inventory",
            "hotbarSize": HOTBAR_SIZE, "defaultSelectedSlot": selected,
            "selectedSlot": selected, "scrollWrap": True,
            "allowPlaceAction": False, "allowBreakAction": True,
            "onlyLibraryItemsPlaceable": True, "items": [], "slots": slots,
            "emptySlotCount": HOTBAR_SIZE, "filledSlotCount": 0,
            "placeableSlotCount": 0, "hasPlaceableItems": False,
        },
        "fallback": {"active": True, "reason": "user-inventory-unavailable"},
        "capabilities": {
            "serverDriven": True, "supportsVplib": True,
            "supportsPersistentSelection": True,
            "allowsBreakWithoutSelectedItem": True, "allowsDebugGrassDirt": False,
        },
        "diagnostics": {"upstreamPath": USER_INVENTORY_API_PATH, "error": _text(error)},
    }

def _hydrate_items_from_slots(inventory: Mapping[str, Any]) -> dict[str, Any]:
    result = dict(inventory)
    slots = _maps(result.get("slots"))
    slots_by_item_id = {
        _text(slot.get("itemId") or slot.get("item_id")): slot
        for slot in slots
        if _text(slot.get("itemId") or slot.get("item_id"))
    }
    items: list[dict[str, Any]] = []
    for source in _maps(result.get("items")):
        item = dict(source)
        slot = slots_by_item_id.get(_text(item.get("itemId") or item.get("item_id")))
        if slot:
            if not item.get("assets") and slot.get("assets"):
                item["assets"] = slot["assets"]
            if not item.get("metadata") and slot.get("metadata"):
                item["metadata"] = slot["metadata"]
        items.append(item)
    result["items"] = items
    return result

def build_editor_user_inventory_payload(
    *, config_source: Any = None, request_args: Any = None,
    include_empty_slots: bool = True, route_path: str = "/editor/api/inventory", **_: Any,
) -> dict[str, Any]:
    args = _map(request_args)
    user_id = _int(args.get("user_id"), 1, 1, 2_147_483_647)
    inventory_key = _text(args.get("inventory_key"), "default")
    selected_fallback = _int(args.get("selected_slot"), 0, 0, HOTBAR_SIZE - 1)
    try:
        upstream = _request_json(
            source=config_source, method="GET", path=USER_INVENTORY_API_PATH,
            query={"user_id": user_id, "inventory_key": inventory_key},
        )
        state = _unwrap(upstream)
        selected = _int(
            state.get("active_slot_index", state.get("last_selected_slot_index", selected_fallback + 1)),
            selected_fallback + 1, 1, HOTBAR_SIZE,
        ) - 1
        public_base_url = _public_base_url(config_source)
        slots = [
            _editor_slot(slot, index, public_base_url)
            for index, slot in enumerate(_maps(state.get("slots"))[:HOTBAR_SIZE])
        ]
        from src.library_inventory.normalizer import normalize_library_inventory
        payload = normalize_library_inventory(
            raw_slots=slots, hotbar_size=HOTBAR_SIZE, selected_slot=selected,
            source="vectoplan-user-inventory", source_detail="vectoplan-library-inventar_user",
            include_empty_slots=include_empty_slots, route=route_path,
            diagnostics={"upstreamPath": USER_INVENTORY_API_PATH, "userId": user_id,
                         "inventoryKey": inventory_key, "slotIndexConvention": "zero/one"},
        )
        inventory = _hydrate_items_from_slots(_map(payload.get("inventory")))
        inventory.update({
            "source": "vectoplan-user-inventory", "hotbarSize": HOTBAR_SIZE,
            "defaultSelectedSlot": selected, "selectedSlot": selected,
            "allowBreakAction": True, "onlyLibraryItemsPlaceable": True,
            "userId": user_id, "inventoryKey": inventory_key,
        })
        payload.update({
            "kind": "editor-user-inventory", "schemaVersion": "editor-user-inventory.v1",
            "source": "vectoplan-user-inventory", "inventory": inventory,
        })
        capabilities = _map(payload.get("capabilities"))
        capabilities.update({"supportsPersistentSelection": True,
                             "allowsBreakWithoutSelectedItem": True,
                             "allowsDebugGrassDirt": False})
        payload["capabilities"] = capabilities
        return payload
    except Exception as exc:
        return _empty_payload(selected_fallback, route_path, exc)

def persist_editor_user_inventory_selection(
    slot_index: Any, *, config_source: Any = None, request_payload: Any = None,
) -> dict[str, Any]:
    body = _map(request_payload)
    editor_slot = _int(slot_index, 0, 0, HOTBAR_SIZE - 1)
    user_id = _int(body.get("user_id"), 1, 1, 2_147_483_647)
    inventory_key = _text(body.get("inventory_key"), "default")
    library_slot = editor_slot + 1
    upstream = _request_json(
        source=config_source, method="PATCH", path=f"{USER_INVENTORY_API_PATH}/select-slot",
        body={"user_id": user_id, "inventory_key": inventory_key, "slot_index": library_slot},
    )
    return {
        "ok": True, "source": "vectoplan-user-inventory",
        "selectedSlot": editor_slot, "selectedSlotIndex": editor_slot,
        "librarySlotIndex": library_slot, "upstream": upstream,
    }

__all__ = [
    "build_editor_user_inventory_payload", "get_creative_inventory_public_url",
    "persist_editor_user_inventory_selection", "UserInventoryAdapterError",
]
