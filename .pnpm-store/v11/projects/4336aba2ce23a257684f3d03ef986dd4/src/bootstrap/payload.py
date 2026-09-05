# services/vectoplan-editor/src/bootstrap/payload.py
from __future__ import annotations

import copy
import json
import re
from collections.abc import Mapping, Sequence
from functools import lru_cache
from typing import Any, Final


try:
    from . import defaults as _defaults
except Exception:  # pragma: no cover - erlaubt isolierte Import-/Tooling-Checks
    _defaults = None


PAYLOAD_MODULE_NAME: Final[str] = "src.bootstrap.payload"
PAYLOAD_MODULE_VERSION: Final[str] = "0.5.0"

_DEFAULT_JSON_FALLBACK: Final[str] = "{}"

_TRUE_VALUES: Final[set[str]] = {"1", "true", "t", "yes", "y", "on", "enabled"}
_FALSE_VALUES: Final[set[str]] = {"0", "false", "f", "no", "n", "off", "disabled"}

_INTERNAL_ONLY_CHUNK_KEYS: Final[set[str]] = {
    "internalBaseUrl",
    "internal_base_url",
    "maxResponseBytes",
    "statusPaths",
}


# =============================================================================
# Defensive Basis-Helfer
# =============================================================================

def _default_attr(name: str, fallback: Any) -> Any:
    try:
        if _defaults is not None and hasattr(_defaults, name):
            return getattr(_defaults, name)
    except Exception:
        pass
    return fallback


def _default_call(name: str, fallback: Any, *args: Any, **kwargs: Any) -> Any:
    try:
        if _defaults is not None and hasattr(_defaults, name):
            candidate = getattr(_defaults, name)
            if callable(candidate):
                return candidate(*args, **kwargs)
    except Exception:
        pass
    return _safe_deepcopy(fallback)


def _normalize_text(value: Any, default: str | None = None) -> str | None:
    if value is None:
        return default

    try:
        normalized = str(value).strip()
    except Exception:
        return default

    return normalized or default


def _coerce_text(value: Any, default: str) -> str:
    normalized = _normalize_text(value, default)
    return normalized if normalized is not None else default


def _coerce_optional_text(value: Any, default: str | None = None) -> str | None:
    return _normalize_text(value, default)


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, int) and not isinstance(value, bool):
        return bool(value)

    if value is None:
        return default

    try:
        normalized = str(value).strip().lower()
    except Exception:
        return default

    if normalized in _TRUE_VALUES:
        return True

    if normalized in _FALSE_VALUES:
        return False

    return default


def _coerce_int(
    value: Any,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    try:
        result = int(value)
    except Exception:
        try:
            result = int(float(value))
        except Exception:
            result = int(default)

    if minimum is not None:
        result = max(minimum, result)

    if maximum is not None:
        result = min(maximum, result)

    return result


def _coerce_float(
    value: Any,
    default: float,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    try:
        result = float(value)
    except Exception:
        result = float(default)

    if minimum is not None:
        result = max(minimum, result)

    if maximum is not None:
        result = min(maximum, result)

    return result


def _safe_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _safe_deepcopy(value: Any) -> Any:
    try:
        return copy.deepcopy(value)
    except Exception:
        try:
            return json.loads(json.dumps(value, ensure_ascii=False, default=str))
        except Exception:
            return value


def _json_safe(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, Mapping):
        return {str(key): _json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]

    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


def _safe_json_loads(value: Any, default: Any) -> Any:
    if not isinstance(value, str):
        return default

    try:
        return json.loads(value)
    except Exception:
        return default


def _safe_json_dumps(
    value: Any,
    *,
    ensure_ascii: bool = False,
    sort_keys: bool = False,
    compact: bool = False,
    fallback: str = _DEFAULT_JSON_FALLBACK,
) -> str:
    try:
        separators = (",", ":") if compact else None
        return json.dumps(
            _json_safe(value),
            ensure_ascii=ensure_ascii,
            sort_keys=sort_keys,
            separators=separators,
            default=str,
        )
    except Exception:
        return fallback


def _safe_script_json(text: str) -> str:
    """
    Macht JSON sicher für Einbettung in HTML-<script>-Tags.
    """
    normalized = _coerce_text(text, _DEFAULT_JSON_FALLBACK)

    try:
        return (
            normalized
            .replace("&", "\\u0026")
            .replace("<", "\\u003c")
            .replace(">", "\\u003e")
            .replace("\u2028", "\\u2028")
            .replace("\u2029", "\\u2029")
        )
    except Exception:
        return _DEFAULT_JSON_FALLBACK


def _deep_merge_dicts(
    base: Mapping[str, Any] | None,
    override: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {}

    if isinstance(base, Mapping):
        for key, value in base.items():
            normalized_key = _normalize_text(key)
            if normalized_key:
                result[normalized_key] = _safe_deepcopy(value)

    if isinstance(override, Mapping):
        for key, value in override.items():
            normalized_key = _normalize_text(key)
            if not normalized_key:
                continue

            existing = result.get(normalized_key)

            if isinstance(existing, Mapping) and isinstance(value, Mapping):
                result[normalized_key] = _deep_merge_dicts(existing, value)
            else:
                result[normalized_key] = _safe_deepcopy(value)

    return result


def _resolve_first(
    source: Mapping[str, Any],
    keys: Sequence[str],
    default: Any,
) -> Any:
    if not isinstance(source, Mapping):
        return default

    for key in keys:
        try:
            if key in source and source[key] is not None:
                return source[key]
        except Exception:
            continue

    return default


def _nested(source: Mapping[str, Any], *keys: str) -> Mapping[str, Any]:
    for key in keys:
        candidate = _resolve_first(source, (key,), None)
        if isinstance(candidate, Mapping):
            return candidate
    return {}


def _normalize_route_path(value: Any, default: str) -> str:
    raw = _coerce_text(value, default)

    try:
        normalized = raw.strip()
        if not normalized:
            normalized = default

        if not normalized.startswith("/"):
            normalized = f"/{normalized}"

        if len(normalized) > 1:
            normalized = normalized.rstrip("/")

        return normalized
    except Exception:
        return default


def _join_route_path(*parts: Any) -> str:
    cleaned: list[str] = []

    for part in parts:
        value = _normalize_text(part)
        if not value:
            continue
        cleaned.append(value.strip("/"))

    if not cleaned:
        return "/"

    return "/" + "/".join(cleaned)


def _slugify(value: Any, default: str = "vectoplan-editor") -> str:
    raw = _coerce_text(value, default).lower()

    try:
        normalized = re.sub(r"[^a-z0-9._-]+", "-", raw)
        normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
        return normalized or default
    except Exception:
        return default


def _normalize_list_of_dicts(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        value = _safe_json_loads(value, [])

    if not isinstance(value, (list, tuple)):
        return []

    result: list[dict[str, Any]] = []

    for item in value:
        if isinstance(item, Mapping):
            result.append(_safe_deepcopy(dict(item)))

    return result


# =============================================================================
# Default-Seed
# =============================================================================

@lru_cache(maxsize=1)
def _build_default_context_seed_cached() -> dict[str, Any]:
    fallback = {
        "app_name": "vectoplan-editor",
        "app_display_name": "VECTOPLAN Editor",
        "service_version": "0.1.0",
        "build_mode": "development",
        "build_version": "dev",
        "page_title": "VECTOPLAN Editor",
        "brand_name": "VECTOPLAN Editor",
        "editor_route_path": "/editor",
        "runtime_mode": "remote_chunk_service",
        "world_mode": "chunk_service",
        "source_mode": "chunk-service",
        "chunk": _default_call("get_default_chunk_service_config", {}, include_internal=False),
        "feature_flags": _default_call("get_default_runtime_feature_flags", {}),
        "root_dataset_values": _default_call("get_default_root_dataset_values", {}),
        "inventory_default_palette": _default_call("get_default_inventory_palette", []),
        "placeable_blocks": _default_call("get_default_placeable_blocks", []),
        "block_world_default_config": _default_call("get_default_block_world_config", {}),
    }

    context = _default_call("get_default_editor_template_context", fallback)
    if not isinstance(context, Mapping):
        context = fallback

    return _deep_merge_dicts(fallback, context)


def get_default_editor_bootstrap_payload_seed() -> dict[str, Any]:
    return build_editor_bootstrap_payload(_build_default_context_seed_cached())


# =============================================================================
# Section Builder
# =============================================================================

def _build_route_hints(api_base_url: str, project_id: str, world_id: str) -> dict[str, str]:
    try:
        route_hints = _default_call(
            "get_default_chunk_service_route_hints",
            {},
            api_base_url=api_base_url,
            project_id=project_id,
            world_id=world_id,
        )
        if isinstance(route_hints, Mapping) and route_hints:
            return dict(route_hints)
    except Exception:
        pass

    project_base = _join_route_path(api_base_url, "projects", project_id)
    world_base = _join_route_path(project_base, "worlds", world_id)

    return {
        "apiBaseUrl": api_base_url,
        "status": _join_route_path(api_base_url, "_status"),
        "testConnection": _join_route_path(api_base_url, "_test", "connection"),
        "placeableBlocks": _join_route_path(api_base_url, "placeable-blocks"),
        "projects": _join_route_path(api_base_url, "projects"),
        "project": project_base,
        "projectBootstrap": _join_route_path(project_base, "bootstrap"),
        "bootstrap": _join_route_path(project_base, "bootstrap"),
        "worlds": _join_route_path(project_base, "worlds"),
        "world": world_base,
        "blocks": _join_route_path(world_base, "blocks"),
        "chunk": _join_route_path(world_base, "chunks"),
        "chunks": _join_route_path(world_base, "chunks"),
        "chunksBatch": _join_route_path(world_base, "chunks", "batch"),
        "commands": _join_route_path(world_base, "commands"),
        "defaultBlocks": _join_route_path(api_base_url, "blocks"),
        "defaultChunk": _join_route_path(api_base_url, "chunks"),
        "defaultChunksBatch": _join_route_path(api_base_url, "chunks", "batch"),
        "defaultCommands": _join_route_path(api_base_url, "commands"),
    }


def _build_feature_flags(source: Mapping[str, Any]) -> dict[str, bool]:
    flags_source = _nested(source, "featureFlags", "feature_flags")
    defaults_flags = _default_call("get_default_runtime_feature_flags", {})

    merged = _deep_merge_dicts(
        defaults_flags if isinstance(defaults_flags, Mapping) else {},
        flags_source,
    )

    return {
        "chunkServiceEnabled": _coerce_bool(merged.get("chunkServiceEnabled"), True),
        "localWorldFallbackEnabled": _coerce_bool(merged.get("localWorldFallbackEnabled"), False),
        "legacyFrontendEnabled": _coerce_bool(merged.get("legacyFrontendEnabled"), False),
        "remoteChunkServiceRequired": _coerce_bool(merged.get("remoteChunkServiceRequired"), False),
        "pointerLockEnabled": _coerce_bool(merged.get("pointerLockEnabled"), True),
        "firstPersonEnabled": _coerce_bool(merged.get("firstPersonEnabled"), True),
        "debugOverlayEnabled": _coerce_bool(merged.get("debugOverlayEnabled"), True),
        "crosshairEnabled": _coerce_bool(merged.get("crosshairEnabled"), True),
        "hotbarEnabled": _coerce_bool(merged.get("hotbarEnabled"), True),
        "statusBarEnabled": _coerce_bool(merged.get("statusBarEnabled"), True),
        "loadingOverlayEnabled": _coerce_bool(merged.get("loadingOverlayEnabled"), True),
        "errorPanelEnabled": _coerce_bool(merged.get("errorPanelEnabled"), True),
    }


def _build_chunk_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    runtime = _nested(source, "runtime")
    runtime_chunk = _nested(runtime, "chunk", "chunkService")
    root_chunk = _nested(source, "chunk", "chunkService")
    chunk_source = _deep_merge_dicts(root_chunk, runtime_chunk)

    default_chunk = _default_call("get_default_chunk_service_config", {}, include_internal=False)
    merged = _deep_merge_dicts(default_chunk if isinstance(default_chunk, Mapping) else {}, chunk_source)

    api_base_url = _normalize_route_path(
        _resolve_first(
            merged,
            ("apiBaseUrl", "api_base_url", "browserBaseUrl", "chunk_api_base_url"),
            _default_attr("DEFAULT_CHUNK_BROWSER_BASE_URL", "/editor/api/chunk"),
        ),
        "/editor/api/chunk",
    )

    browser_base_url = _normalize_route_path(
        _resolve_first(
            merged,
            ("browserBaseUrl", "browser_base_url", "apiBaseUrl"),
            api_base_url,
        ),
        api_base_url,
    )

    project_id = _coerce_text(
        _resolve_first(
            merged,
            ("projectId", "project_id", "chunk_project_id"),
            _default_attr("DEFAULT_CHUNK_DEFAULT_PROJECT_ID", "dev-project"),
        ),
        "dev-project",
    )

    world_id = _coerce_text(
        _resolve_first(
            merged,
            ("worldId", "world_id", "chunk_world_id"),
            _default_attr("DEFAULT_CHUNK_DEFAULT_WORLD_ID", "world_spawn"),
        ),
        "world_spawn",
    )

    default_route_hints = _build_route_hints(api_base_url, project_id, world_id)
    incoming_route_hints = _safe_mapping(merged.get("routeHints"))
    route_hints = _deep_merge_dicts(default_route_hints, incoming_route_hints)

    payload: dict[str, Any] = {
        "enabled": _coerce_bool(merged.get("enabled"), True),
        "mode": _coerce_text(
            merged.get("mode"),
            _default_attr("DEFAULT_CHUNK_SERVICE_MODE", "editor-proxy"),
        ),
        "sourceKind": _coerce_text(
            merged.get("sourceKind"),
            _default_attr("DEFAULT_CHUNK_SERVICE_SOURCE_KIND", "vectoplan-chunk"),
        ),
        "apiBaseUrl": api_base_url,
        "browserBaseUrl": browser_base_url,
        "projectId": project_id,
        "worldId": world_id,
        "registryId": _coerce_text(
            merged.get("registryId"),
            _default_attr("DEFAULT_CHUNK_REGISTRY_ID", "debug-blocks"),
        ),
        "registryVersion": _coerce_text(
            merged.get("registryVersion"),
            _default_attr("DEFAULT_CHUNK_REGISTRY_VERSION", "1"),
        ),
        "routeHints": route_hints,
        "requestTimeoutMs": _coerce_int(
            merged.get("requestTimeoutMs"),
            _default_attr("DEFAULT_CHUNK_REQUEST_TIMEOUT_MS", 10_000),
            100,
            300_000,
        ),
        "commandTimeoutMs": _coerce_int(
            merged.get("commandTimeoutMs"),
            _default_attr("DEFAULT_CHUNK_COMMAND_TIMEOUT_MS", 15_000),
            100,
            300_000,
        ),
        "batchTimeoutMs": _coerce_int(
            merged.get("batchTimeoutMs"),
            _default_attr("DEFAULT_CHUNK_BATCH_TIMEOUT_MS", 20_000),
            100,
            300_000,
        ),
        "statusTimeoutMs": _coerce_int(
            merged.get("statusTimeoutMs"),
            _default_attr("DEFAULT_CHUNK_STATUS_TIMEOUT_MS", 5_000),
            100,
            300_000,
        ),
        "preferBatchLoad": _coerce_bool(merged.get("preferBatchLoad"), True),
        "reloadDirtyChunksAfterCommand": _coerce_bool(
            merged.get("reloadDirtyChunksAfterCommand"),
            True,
        ),
        "maxBatchChunks": _coerce_int(
            merged.get("maxBatchChunks"),
            _default_attr("DEFAULT_CHUNK_MAX_BATCH_CHUNKS", 256),
            1,
            10_000,
        ),
        "allowGenerated": _coerce_bool(merged.get("allowGenerated"), True),
        "preferSnapshot": _coerce_bool(merged.get("preferSnapshot"), True),
        "diagnostics": {
            "enabled": _coerce_bool(
                _safe_mapping(merged.get("diagnostics")).get("enabled", merged.get("diagnosticsEnabled")),
                True,
            ),
            "statusUrl": route_hints.get("status"),
            "testConnectionUrl": route_hints.get("testConnection"),
        },
        "commands": {
            "enabled": True,
            "url": route_hints.get("commands"),
            "reloadDirtyChunksAfterCommand": _coerce_bool(
                merged.get("reloadDirtyChunksAfterCommand"),
                True,
            ),
        },
    }

    # Sicherheit: interne Docker-URL nie als normale Browser-Ziel-URL ausgeben.
    for internal_key in _INTERNAL_ONLY_CHUNK_KEYS:
        payload.pop(internal_key, None)

    return payload


def _build_camera_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    runtime = _nested(source, "runtime")
    camera = _nested(runtime, "camera")
    spawn = _nested(camera, "spawn")

    return {
        "spawn": {
            "x": _coerce_float(spawn.get("x", source.get("spawn_x")), _default_attr("DEFAULT_SPAWN_X", 8.0), -100_000.0, 100_000.0),
            "y": _coerce_float(spawn.get("y", source.get("spawn_y")), _default_attr("DEFAULT_SPAWN_Y", 8.0), -100_000.0, 100_000.0),
            "z": _coerce_float(spawn.get("z", source.get("spawn_z")), _default_attr("DEFAULT_SPAWN_Z", 18.0), -100_000.0, 100_000.0),
        },
        "yaw": _coerce_float(camera.get("yaw", source.get("initial_yaw")), _default_attr("DEFAULT_INITIAL_YAW", 0.0), -360.0, 360.0),
        "pitch": _coerce_float(camera.get("pitch", source.get("initial_pitch")), _default_attr("DEFAULT_INITIAL_PITCH", 0.0), -89.0, 89.0),
        "moveSpeed": _coerce_float(camera.get("moveSpeed", source.get("movement_walk_speed")), _default_attr("DEFAULT_MOVEMENT_WALK_SPEED", 5.5), 0.1, 1000.0),
        "sprintMultiplier": _coerce_float(camera.get("sprintMultiplier", source.get("movement_sprint_multiplier")), _default_attr("DEFAULT_MOVEMENT_SPRINT_MULTIPLIER", 1.8), 1.0, 10.0),
        "lookSensitivity": _coerce_float(camera.get("lookSensitivity", source.get("look_sensitivity")), _default_attr("DEFAULT_LOOK_SENSITIVITY", 0.0025), 0.00005, 5.0),
        "playerHeight": _coerce_float(camera.get("playerHeight", source.get("movement_player_height")), _default_attr("DEFAULT_MOVEMENT_PLAYER_HEIGHT", 1.8), 0.2, 100.0),
    }


def _build_chunks_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    runtime = _nested(source, "runtime")
    chunks = _nested(runtime, "chunks")

    return {
        "enabled": _coerce_bool(chunks.get("enabled", source.get("chunks_enabled")), True),
        "emptyWorld": _coerce_bool(chunks.get("emptyWorld", source.get("chunks_empty_world")), False),
        "chunkSize": _coerce_int(chunks.get("chunkSize", source.get("chunks_chunk_size")), _default_attr("DEFAULT_CHUNKS_CHUNK_SIZE", 16), 1, 4096),
        "viewDistance": _coerce_int(chunks.get("viewDistance", source.get("chunks_view_distance")), _default_attr("DEFAULT_CHUNKS_VIEW_DISTANCE", 14), 0, 512),
        "preloadRadius": _coerce_int(chunks.get("preloadRadius", source.get("chunks_preload_radius")), _default_attr("DEFAULT_CHUNKS_PRELOAD_RADIUS", 2), 0, 128),
        "unloadDistance": _coerce_int(chunks.get("unloadDistance", source.get("chunks_unload_distance")), _default_attr("DEFAULT_CHUNKS_UNLOAD_DISTANCE", 19), 0, 1024),
        "maxLoadedChunks": _coerce_int(chunks.get("maxLoadedChunks", source.get("chunks_max_loaded_chunks")), _default_attr("DEFAULT_CHUNKS_MAX_LOADED_CHUNKS", 2048), 1, 100_000),
        "loadAroundPlayer": _coerce_bool(chunks.get("loadAroundPlayer", source.get("chunks_load_around_player")), True),
        "debugDrawChunkBounds": _coerce_bool(chunks.get("debugDrawChunkBounds", source.get("chunks_debug_draw_chunk_bounds")), False),
        "preferBatchLoad": _coerce_bool(chunks.get("preferBatchLoad", source.get("chunks_prefer_batch_load")), True),
        "reloadDirtyAfterCommand": _coerce_bool(chunks.get("reloadDirtyAfterCommand", source.get("chunks_reload_dirty_after_command")), True),
    }


def _build_inventory_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    runtime = _nested(source, "runtime")
    inventory = _nested(runtime, "inventory")

    hotbar_size = _coerce_int(
        inventory.get("hotbarSize", source.get("inventory_hotbar_size")),
        _default_attr("DEFAULT_INVENTORY_HOTBAR_SIZE", 9),
        1,
        128,
    )
    selected_slot = _coerce_int(
        inventory.get("selectedSlot", inventory.get("defaultSelectedSlot", source.get("inventory_default_selected_slot"))),
        _default_attr("DEFAULT_INVENTORY_DEFAULT_SELECTED_SLOT", 0),
        0,
        max(0, hotbar_size - 1),
    )

    items = _normalize_inventory_items(
        inventory.get("items", inventory.get("defaultPalette", source.get("inventory_default_palette"))),
        hotbar_size=hotbar_size,
        selected_slot=selected_slot,
    )

    placeable_blocks = _normalize_list_of_dicts(
        inventory.get("placeableBlocks", source.get("placeable_blocks"))
    )
    if not placeable_blocks:
        placeable_blocks = _default_call("get_default_placeable_blocks", [])

    return {
        "enabled": _coerce_bool(inventory.get("enabled", source.get("inventory_enabled")), True),
        "source": _coerce_text(inventory.get("source", source.get("inventory_source")), "vectoplan-user-inventory"),
        "iconMode": _coerce_text(inventory.get("iconMode", source.get("inventory_icon_mode")), "icon-only"),
        "hotbarSize": hotbar_size,
        "selectedSlot": selected_slot,
        "defaultSelectedSlot": selected_slot,
        "defaultBlockTypeId": _coerce_text(
            inventory.get("defaultBlockTypeId", source.get("inventory_default_block_type_id")),
            _default_attr("DEFAULT_HOTBAR_DEFAULT_BLOCK_TYPE_ID", ""),
        ),
        "scrollWrap": _coerce_bool(inventory.get("scrollWrap", source.get("inventory_scroll_wrap")), True),
        "allowPlaceAction": _coerce_bool(inventory.get("allowPlaceAction", source.get("inventory_allow_place_action")), True),
        "allowBreakAction": _coerce_bool(inventory.get("allowBreakAction", source.get("inventory_allow_break_action")), True),
        "items": items,
        "defaultPalette": items,
        "placeableBlocks": placeable_blocks,
    }


def _normalize_inventory_items(value: Any, *, hotbar_size: int, selected_slot: int) -> list[dict[str, Any]]:
    incoming = _normalize_list_of_dicts(value)
    fallback = _default_call("get_default_inventory_palette", [])

    if not incoming and isinstance(fallback, list):
        incoming = _normalize_list_of_dicts(fallback)

    result: list[dict[str, Any]] = []

    for index in range(hotbar_size):
        raw = incoming[index] if index < len(incoming) else {}
        block_type_id = _coerce_optional_text(raw.get("blockTypeId"), raw.get("blockId"))
        empty = _coerce_bool(raw.get("empty"), block_type_id is None)

        result.append(
            {
                "slotIndex": index,
                "slotKey": _coerce_text(raw.get("slotKey"), f"slot_{index}"),
                "empty": empty,
                "enabled": _coerce_bool(raw.get("enabled"), True),
                "selected": index == selected_slot,
                "itemId": _coerce_optional_text(raw.get("itemId"), f"block_{block_type_id}" if block_type_id else None),
                "itemKind": _coerce_optional_text(raw.get("itemKind"), "block" if block_type_id else None),
                "kind": _coerce_text(raw.get("kind"), "block" if block_type_id else "empty"),
                "type": _coerce_text(raw.get("type"), "block" if block_type_id else "empty"),
                "blockTypeId": block_type_id,
                "blockId": _coerce_optional_text(raw.get("blockId"), block_type_id),
                "label": _coerce_text(raw.get("label"), block_type_id or ""),
                "displayLabel": _coerce_text(raw.get("displayLabel"), ""),
                "visibleLabel": _coerce_bool(raw.get("visibleLabel"), False),
                "ariaLabel": _coerce_text(raw.get("ariaLabel"), raw.get("label") or f"Slot {index + 1}"),
                "title": _coerce_text(raw.get("title"), raw.get("label") or ""),
                "placeable": _coerce_bool(raw.get("placeable"), bool(block_type_id)),
                "breakable": _coerce_bool(raw.get("breakable"), bool(block_type_id)),
                "stackSize": _coerce_int(raw.get("stackSize"), 0 if empty else 64, 0, 9999),
                "maxStackSize": _coerce_int(raw.get("maxStackSize"), 64, 1, 9999),
                "iconKey": _coerce_optional_text(raw.get("iconKey"), "placeholder-block" if block_type_id else None),
                "iconKind": _coerce_optional_text(raw.get("iconKind"), "css" if block_type_id else None),
                "iconUrl": _coerce_optional_text(raw.get("iconUrl"), None),
                "icon": _safe_deepcopy(raw.get("icon")),
                "metadata": _safe_deepcopy(raw.get("metadata") if isinstance(raw.get("metadata"), Mapping) else {}),
            }
        )

    return result


def _build_ui_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    runtime = _nested(source, "runtime")
    ui = _nested(runtime, "ui")

    return {
        "pageTitle": _coerce_text(ui.get("pageTitle", source.get("page_title")), "VECTOPLAN Editor"),
        "brandName": _coerce_text(ui.get("brandName", source.get("brand_name")), "VECTOPLAN Editor"),
        "statusInitial": _coerce_text(ui.get("statusInitial", source.get("initial_status")), "Initialisierung..."),
        "statusLoading": _coerce_text(ui.get("statusLoading", source.get("runtime_loading_status")), "Editor wird geladen..."),
        "statusReady": _coerce_text(ui.get("statusReady", source.get("runtime_ready_status")), "Editor bereit"),
        "statusError": _coerce_text(ui.get("statusError", source.get("runtime_error_status")), "Editor konnte nicht gestartet werden"),
        "viewportPlaceholder": _coerce_text(ui.get("viewportPlaceholder", source.get("viewport_placeholder")), "3D-Viewport wird aufgebaut."),
        "pointerLockTitle": _coerce_text(ui.get("pointerLockTitle", source.get("pointer_lock_title")), "First-Person-Modus"),
        "pointerLockMessage": _coerce_text(ui.get("pointerLockMessage", source.get("pointer_lock_message")), "Klicke in den Viewport, um die Maus zu sperren."),
        "pointerLockHint": _coerce_text(ui.get("pointerLockHint", source.get("pointer_lock_hint")), "W A S D bewegen · Maus schauen · ESC löst den Mausfang."),
    }


def _build_assets_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    assets = _nested(source, "assets")

    return {
        "staticEditorUrlPrefix": _coerce_text(
            assets.get("staticEditorUrlPrefix", source.get("static_editor_url_prefix")),
            _default_attr("DEFAULT_STATIC_EDITOR_URL_PREFIX", "/static/editor"),
        ),
        "manifestName": _coerce_text(
            assets.get("manifestName", source.get("static_editor_manifest_name")),
            _default_attr("DEFAULT_STATIC_EDITOR_MANIFEST_NAME", "manifest.json"),
        ),
        "viteEntrypoint": _coerce_text(
            assets.get("viteEntrypoint", source.get("vite_entrypoint")),
            _default_attr("DEFAULT_VITE_ENTRYPOINT", "main.ts"),
        ),
        "useViteManifest": _coerce_bool(
            assets.get("useViteManifest", source.get("use_vite_manifest")),
            True,
        ),
    }


def _build_legacy_block_world_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    block_world = _safe_mapping(source.get("block_world_default_config"))
    if not block_world:
        block_world = _default_call("get_default_block_world_config", {})

    return {
        "enabled": _coerce_bool(block_world.get("enabled"), False),
        "mode": _coerce_text(block_world.get("mode"), "legacy_local_block_world"),
        "legacy": True,
        "truthOwner": "vectoplan-chunk",
        "chunkSize": _coerce_int(block_world.get("chunkSize", block_world.get("chunk_size")), 16, 1, 4096),
        "reachDistance": _coerce_float(block_world.get("reachDistance", block_world.get("reach_distance")), 8.0, 0.1, 128.0),
        "defaultHotbarBlockTypeIds": list(
            block_world.get("defaultHotbarBlockTypeIds")
            or block_world.get("default_hotbar_block_type_ids")
            or _default_call("get_default_block_world_hotbar_block_type_ids", [])
        ),
    }


def _build_runtime_payload(source: Mapping[str, Any]) -> dict[str, Any]:
    runtime = _nested(source, "runtime")

    feature_flags = _build_feature_flags(source)
    chunk = _build_chunk_payload(source)
    camera = _build_camera_payload(source)
    chunks = _build_chunks_payload(source)
    inventory = _build_inventory_payload(source)
    ui = _build_ui_payload(source)

    if chunk["enabled"]:
        chunks["enabled"] = True
        chunks["emptyWorld"] = False

    return {
        "mode": _coerce_text(runtime.get("mode", source.get("runtime_mode")), "remote_chunk_service"),
        "worldMode": _coerce_text(runtime.get("worldMode", source.get("world_mode")), "chunk_service"),
        "sourceMode": _coerce_text(runtime.get("sourceMode", source.get("source_mode")), "chunk-service"),
        "chunk": chunk,
        "camera": camera,
        "chunks": chunks,
        "inventory": inventory,
        "ui": ui,
        "blockWorld": _build_legacy_block_world_payload(source),
        "featureFlags": feature_flags,
        # Kompatibilitätswerte für ältere Runtime-Reader
        "firstPersonEnabled": feature_flags["firstPersonEnabled"],
        "debugOverlayEnabled": feature_flags["debugOverlayEnabled"],
        "crosshairEnabled": feature_flags["crosshairEnabled"],
        "allowPointerLock": feature_flags["pointerLockEnabled"],
        "moveSpeed": camera["moveSpeed"],
        "sprintMultiplier": camera["sprintMultiplier"],
        "lookSensitivity": camera["lookSensitivity"],
        "playerHeight": camera["playerHeight"],
        "spawn": camera["spawn"],
    }


# =============================================================================
# Payload-Build
# =============================================================================

def _resolve_effective_source(
    context: Mapping[str, Any] | None = None,
    *,
    template_context: Mapping[str, Any] | None = None,
    source_context: Mapping[str, Any] | None = None,
    payload_override: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    merged: dict[str, Any] = _safe_deepcopy(_build_default_context_seed_cached())

    for candidate in (context, template_context, source_context, payload_override):
        if isinstance(candidate, Mapping):
            merged = _deep_merge_dicts(merged, candidate)

    return merged


def build_editor_bootstrap_payload(
    context: Mapping[str, Any] | None = None,
    *,
    template_context: Mapping[str, Any] | None = None,
    source_context: Mapping[str, Any] | None = None,
    payload_override: Mapping[str, Any] | None = None,
    fallback_active: bool | None = None,
    fallback_reason: str | None = None,
) -> dict[str, Any]:
    source = _resolve_effective_source(
        context,
        template_context=template_context,
        source_context=source_context,
        payload_override=payload_override,
    )

    if fallback_active is not None:
        source["fallback_active"] = bool(fallback_active)

    if fallback_reason is not None:
        source["fallback_reason"] = fallback_reason

    runtime = _build_runtime_payload(source)
    chunk = _safe_mapping(runtime.get("chunk"))
    ui = _safe_mapping(runtime.get("ui"))

    app_name = _slugify(
        _resolve_first(source, ("app_name", "appName"), "vectoplan-editor"),
        "vectoplan-editor",
    )

    payload = {
        "ok": True,
        "service": {
            "name": app_name,
            "displayName": _coerce_text(
                _resolve_first(source, ("app_display_name", "appDisplayName"), "VECTOPLAN Editor"),
                "VECTOPLAN Editor",
            ),
            "version": _coerce_text(
                _resolve_first(source, ("service_version", "serviceVersion"), "0.1.0"),
                "0.1.0",
            ),
        },
        "kind": "editor-bootstrap",
        "schemaVersion": "editor-bootstrap.v1",
        "source": PAYLOAD_MODULE_NAME,
        "payloadModuleVersion": PAYLOAD_MODULE_VERSION,
        "build": {
            "mode": _coerce_text(_resolve_first(source, ("build_mode", "buildMode"), "development"), "development"),
            "version": _coerce_text(_resolve_first(source, ("build_version", "buildVersion"), "dev"), "dev"),
        },
        "project": {
            "projectId": chunk.get("projectId", "dev-project"),
            "worldId": chunk.get("worldId", "world_spawn"),
        },
        "pageTitle": ui.get("pageTitle", "VECTOPLAN Editor"),
        "brandName": ui.get("brandName", "VECTOPLAN Editor"),
        "routePath": _normalize_route_path(
            _resolve_first(source, ("editor_route_path", "routePath"), "/editor"),
            "/editor",
        ),
        "initialStatus": ui.get("statusInitial", "Initialisierung..."),
        "runtimeLoadingStatus": ui.get("statusLoading", "Editor wird geladen..."),
        "runtimeReadyStatus": ui.get("statusReady", "Editor bereit"),
        "runtimeErrorStatus": ui.get("statusError", "Editor konnte nicht gestartet werden"),
        "viewportPlaceholder": ui.get("viewportPlaceholder", "3D-Viewport wird aufgebaut."),
        "pointerLock": {
            "title": ui.get("pointerLockTitle"),
            "message": ui.get("pointerLockMessage"),
            "hint": ui.get("pointerLockHint"),
        },
        "runtime": runtime,
        "chunk": _json_safe(dict(chunk)),
        "assets": _build_assets_payload(source),
        "featureFlags": runtime.get("featureFlags", {}),
        "fallback": {
            "active": _coerce_bool(source.get("fallback_active"), False),
            "reason": _coerce_optional_text(source.get("fallback_reason"), None),
        },
    }

    return _json_safe(payload)


def build_fallback_editor_bootstrap_payload(
    *,
    reason: str = "fallback-active",
    context: Mapping[str, Any] | None = None,
    template_context: Mapping[str, Any] | None = None,
    source_context: Mapping[str, Any] | None = None,
    payload_override: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return build_editor_bootstrap_payload(
        context=context,
        template_context=template_context,
        source_context=source_context,
        payload_override=payload_override,
        fallback_active=True,
        fallback_reason=reason,
    )


def normalize_editor_bootstrap_payload(
    payload: Mapping[str, Any] | None = None,
    *,
    context: Mapping[str, Any] | None = None,
    template_context: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return build_editor_bootstrap_payload(
        context=payload,
        template_context=template_context,
        payload_override=context,
    )


def serialize_editor_bootstrap_payload(
    payload: Mapping[str, Any] | None = None,
    *,
    value: Mapping[str, Any] | None = None,
    build_from_context: Mapping[str, Any] | None = None,
    context: Mapping[str, Any] | None = None,
    template_context: Mapping[str, Any] | None = None,
    normalize: bool = False,
    ensure_safe_script_json: bool = True,
    compact: bool = False,
    sort_keys: bool = False,
) -> str:
    if isinstance(payload, Mapping):
        candidate = _safe_deepcopy(dict(payload))
    elif isinstance(value, Mapping):
        candidate = _safe_deepcopy(dict(value))
    elif isinstance(build_from_context, Mapping):
        candidate = build_editor_bootstrap_payload(build_from_context)
    elif isinstance(context, Mapping):
        candidate = build_editor_bootstrap_payload(context)
    elif isinstance(template_context, Mapping):
        candidate = build_editor_bootstrap_payload(template_context=template_context)
    else:
        candidate = build_editor_bootstrap_payload()

    if normalize:
        candidate = normalize_editor_bootstrap_payload(candidate)

    serialized = _safe_json_dumps(
        candidate,
        ensure_ascii=False,
        sort_keys=sort_keys,
        compact=compact,
        fallback=_DEFAULT_JSON_FALLBACK,
    )

    if ensure_safe_script_json:
        return _safe_script_json(serialized)

    return serialized


# =============================================================================
# Aliases
# =============================================================================

def build_bootstrap_payload(
    context: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    return build_editor_bootstrap_payload(context, **kwargs)


def create_editor_bootstrap_payload(
    context: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    return build_editor_bootstrap_payload(context, **kwargs)


def create_bootstrap_payload(
    context: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    return build_editor_bootstrap_payload(context, **kwargs)


def serialize_bootstrap_payload(
    payload: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> str:
    return serialize_editor_bootstrap_payload(payload, **kwargs)


def dumps_editor_bootstrap_payload(
    payload: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> str:
    return serialize_editor_bootstrap_payload(payload, **kwargs)


def dumps_bootstrap_payload(
    payload: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> str:
    return serialize_editor_bootstrap_payload(payload, **kwargs)


# =============================================================================
# Diagnose / Cache
# =============================================================================

def get_editor_bootstrap_payload_metadata() -> dict[str, Any]:
    seed = build_editor_bootstrap_payload()
    runtime = _safe_mapping(seed.get("runtime"))
    chunk = _safe_mapping(runtime.get("chunk"))
    inventory = _safe_mapping(runtime.get("inventory"))
    block_world = _safe_mapping(runtime.get("blockWorld"))
    route_hints = _safe_mapping(chunk.get("routeHints"))

    return {
        "moduleName": PAYLOAD_MODULE_NAME,
        "moduleVersion": PAYLOAD_MODULE_VERSION,
        "schemaVersion": seed.get("schemaVersion"),
        "defaultRuntimeMode": runtime.get("mode"),
        "defaultWorldMode": runtime.get("worldMode"),
        "defaultSourceMode": runtime.get("sourceMode"),
        "defaultChunkEnabled": chunk.get("enabled"),
        "defaultChunkApiBaseUrl": chunk.get("apiBaseUrl"),
        "defaultChunkProjectId": chunk.get("projectId"),
        "defaultChunkWorldId": chunk.get("worldId"),
        "defaultChunkRouteHintKeys": sorted(route_hints.keys()),
        "defaultInventorySource": inventory.get("source"),
        "defaultHotbarSize": inventory.get("hotbarSize"),
        "defaultBlockWorldEnabled": block_world.get("enabled"),
        "defaultBlockWorldTruthOwner": block_world.get("truthOwner"),
        "safeScriptJsonEnabledByDefault": True,
    }


def clear_editor_bootstrap_payload_caches() -> None:
    for candidate in (
        _build_default_context_seed_cached,
    ):
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            pass

    try:
        if _defaults is not None and hasattr(_defaults, "clear_editor_defaults_caches"):
            _defaults.clear_editor_defaults_caches()
    except Exception:
        pass


def clear_payload_caches() -> None:
    clear_editor_bootstrap_payload_caches()


def clear_bootstrap_caches() -> None:
    clear_editor_bootstrap_payload_caches()


__all__ = [
    "PAYLOAD_MODULE_NAME",
    "PAYLOAD_MODULE_VERSION",
    "get_default_editor_bootstrap_payload_seed",
    "get_editor_bootstrap_payload_metadata",
    "clear_editor_bootstrap_payload_caches",
    "clear_payload_caches",
    "clear_bootstrap_caches",
    "build_editor_bootstrap_payload",
    "build_fallback_editor_bootstrap_payload",
    "build_bootstrap_payload",
    "create_editor_bootstrap_payload",
    "create_bootstrap_payload",
    "normalize_editor_bootstrap_payload",
    "serialize_editor_bootstrap_payload",
    "serialize_bootstrap_payload",
    "dumps_editor_bootstrap_payload",
    "dumps_bootstrap_payload",
]