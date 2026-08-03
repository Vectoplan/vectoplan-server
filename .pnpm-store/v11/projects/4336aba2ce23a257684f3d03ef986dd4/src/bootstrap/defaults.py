# services/vectoplan-editor/src/bootstrap/defaults.py
"""
Zentrale Defaults für den Bootstrap des Microservice `vectoplan-editor`.

Diese Datei liefert ausschließlich robuste Standardwerte und kleine Builder für:
- Editor-Shell
- Vite-/Static-Assets
- Browser-Bootstrap
- Root-Dataset-Werte
- Runtime-Feature-Flags
- Chunk-Service-Konfiguration
- Chunk-Route-Hints
- Hotbar-/Placeable-Blocks-Defaults
- kontrollierte Legacy-/Fallback-Metadaten

Aktuelle Zielarchitektur:
- neue Frontend-Wahrheit:
    services/vectoplan-editor/src/frontend
- gebaute Frontend-Artefakte:
    services/vectoplan-editor/static/editor
- Browser spricht:
    /editor/api/chunk
- Editor-Backend spricht intern:
    http://vectoplan-chunk:5000
- Welt-/Chunk-Wahrheit:
    vectoplan-chunk
- lokale BlockWorld:
    nicht mehr produktive Wahrheit; höchstens Diagnose/Fallback/Test

Diese Datei enthält keine:
- Flask-Routen
- HTTP-Proxy-Logik
- Template-Rendering
- Chunk-Fachlogik
- Datenbankzugriffe
"""

from __future__ import annotations

import copy
import json
from collections.abc import Mapping, Sequence
from functools import lru_cache
from types import MappingProxyType
from typing import Any, Final


# =============================================================================
# Modulmetadaten
# =============================================================================

DEFAULTS_MODULE_NAME: Final[str] = "src.bootstrap.defaults"
DEFAULTS_VERSION: Final[str] = "0.5.0"


# =============================================================================
# Kleine robuste Helfer
# =============================================================================

_TRUE_VALUES: Final[set[str]] = {"1", "true", "t", "yes", "y", "on", "enabled"}
_FALSE_VALUES: Final[set[str]] = {"0", "false", "f", "no", "n", "off", "disabled"}


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

    if value is None:
        return default

    if isinstance(value, int) and not isinstance(value, bool):
        return bool(value)

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


def _safe_json_loads(value: Any, default: Any) -> Any:
    if not isinstance(value, str):
        return default

    try:
        return json.loads(value)
    except Exception:
        return default


def _safe_deepcopy(value: Any) -> Any:
    try:
        return copy.deepcopy(value)
    except Exception:
        try:
            return json.loads(json.dumps(value, ensure_ascii=False, default=str))
        except Exception:
            return value


def _safe_mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    return {}


def _freeze_mapping(value: Mapping[str, Any] | dict[str, Any]) -> Mapping[str, Any]:
    try:
        return MappingProxyType(dict(value))
    except Exception:
        try:
            return dict(value)
        except Exception:
            return {}


def _freeze_sequence_dicts(
    value: Sequence[Mapping[str, Any]] | Sequence[dict[str, Any]],
) -> tuple[Mapping[str, Any], ...]:
    frozen_items: list[Mapping[str, Any]] = []

    try:
        for item in value:
            frozen_items.append(_freeze_mapping(item))
    except Exception:
        return tuple()

    return tuple(frozen_items)


def _safe_group_dict(*groups: Mapping[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}

    for group in groups:
        try:
            result.update(dict(group))
        except Exception:
            continue

    return result


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


def _milliseconds_to_seconds(milliseconds: int, default: float) -> float:
    try:
        return max(0.1, float(milliseconds) / 1000.0)
    except Exception:
        return default


# =============================================================================
# Kanonische Defaults
# =============================================================================

DEFAULT_APP_NAME: Final[str] = "vectoplan-editor"
DEFAULT_APP_DISPLAY_NAME: Final[str] = "VECTOPLAN Editor"
DEFAULT_SERVICE_VERSION: Final[str] = "0.1.0"

DEFAULT_BUILD_MODE: Final[str] = "development"
DEFAULT_BUILD_VERSION: Final[str] = "dev"

# -----------------------------------------------------------------------------
# Editor-Route / Template / Static / Vite
# -----------------------------------------------------------------------------

DEFAULT_EDITOR_ROUTE_PATH: Final[str] = "/editor"
DEFAULT_EDITOR_TEMPLATE_NAME: Final[str] = "editor/index.html"
DEFAULT_EDITOR_TEMPLATE_MODE: Final[str] = "chunk_service_viewport"

DEFAULT_STATIC_EDITOR_URL_PREFIX: Final[str] = "/static/editor"
DEFAULT_STATIC_EDITOR_MANIFEST_NAME: Final[str] = "manifest.json"
DEFAULT_VITE_ENTRYPOINT: Final[str] = "main.ts"
DEFAULT_USE_VITE_MANIFEST: Final[bool] = True
DEFAULT_STRICT_ASSET_CHECKS: Final[bool] = False

DEFAULT_FALLBACK_STATIC_JS: Final[str] = ""
DEFAULT_FALLBACK_STATIC_CSS: Final[str] = ""

# -----------------------------------------------------------------------------
# Browser-/Runtime-Identität
# -----------------------------------------------------------------------------

DEFAULT_PAGE_TITLE: Final[str] = "VECTOPLAN Editor"
DEFAULT_BRAND_NAME: Final[str] = "VECTOPLAN Editor"

DEFAULT_RUNTIME_MODE: Final[str] = "remote_chunk_service"
DEFAULT_WORLD_MODE: Final[str] = "chunk_service"
DEFAULT_SOURCE_MODE: Final[str] = "chunk-service"

DEFAULT_INITIAL_STATUS: Final[str] = "Initialisierung..."
DEFAULT_RUNTIME_LOADING_STATUS: Final[str] = "Editor wird geladen..."
DEFAULT_RUNTIME_READY_STATUS: Final[str] = "Editor bereit"
DEFAULT_RUNTIME_ERROR_STATUS: Final[str] = "Editor konnte nicht gestartet werden"

DEFAULT_VIEWPORT_PLACEHOLDER: Final[str] = "3D-Viewport wird aufgebaut."

DEFAULT_POINTER_LOCK_TITLE: Final[str] = "First-Person-Modus"
DEFAULT_POINTER_LOCK_MESSAGE: Final[str] = (
    "Klicke in den Viewport, um die Maus zu sperren und dich im Raum zu bewegen."
)
DEFAULT_POINTER_LOCK_HINT: Final[str] = (
    "W A S D bewegen · Maus schauen · Linksklick setzen · Rechtsklick entfernen · ESC löst den Mausfang."
)

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------

DEFAULT_CHUNK_SERVICE_ENABLED: Final[bool] = True
DEFAULT_LOCAL_WORLD_FALLBACK_ENABLED: Final[bool] = False
DEFAULT_LEGACY_FRONTEND_ENABLED: Final[bool] = False
DEFAULT_REMOTE_CHUNK_SERVICE_REQUIRED: Final[bool] = False

DEFAULT_POINTER_LOCK_ENABLED: Final[bool] = True
DEFAULT_FIRST_PERSON_ENABLED: Final[bool] = True
DEFAULT_DEBUG_OVERLAY_ENABLED: Final[bool] = True
DEFAULT_CROSSHAIR_ENABLED: Final[bool] = True
DEFAULT_HOTBAR_ENABLED: Final[bool] = True
DEFAULT_STATUS_BAR_ENABLED: Final[bool] = True
DEFAULT_LOADING_OVERLAY_ENABLED: Final[bool] = True
DEFAULT_ERROR_PANEL_ENABLED: Final[bool] = True

# -----------------------------------------------------------------------------
# Chunk-Service
# -----------------------------------------------------------------------------

DEFAULT_CHUNK_SERVICE_MODE: Final[str] = "editor-proxy"
DEFAULT_CHUNK_SERVICE_SOURCE_KIND: Final[str] = "vectoplan-chunk"

DEFAULT_CHUNK_API_PREFIX: Final[str] = "/editor/api/chunk"
DEFAULT_CHUNK_BROWSER_BASE_URL: Final[str] = DEFAULT_CHUNK_API_PREFIX
DEFAULT_CHUNK_SERVICE_INTERNAL_URL: Final[str] = "http://vectoplan-chunk:5000"

DEFAULT_CHUNK_DEFAULT_PROJECT_ID: Final[str] = "dev-project"
DEFAULT_CHUNK_DEFAULT_WORLD_ID: Final[str] = "world_spawn"

DEFAULT_CHUNK_REGISTRY_ID: Final[str] = "debug-blocks"
DEFAULT_CHUNK_REGISTRY_VERSION: Final[str] = "1"

DEFAULT_CHUNK_REQUEST_TIMEOUT_MS: Final[int] = 10_000
DEFAULT_CHUNK_COMMAND_TIMEOUT_MS: Final[int] = 15_000
DEFAULT_CHUNK_BATCH_TIMEOUT_MS: Final[int] = 20_000
DEFAULT_CHUNK_STATUS_TIMEOUT_MS: Final[int] = 5_000

DEFAULT_CHUNK_MAX_BATCH_CHUNKS: Final[int] = 256
DEFAULT_CHUNK_MAX_RESPONSE_BYTES: Final[int] = 20 * 1024 * 1024

DEFAULT_CHUNK_PREFER_BATCH_LOAD: Final[bool] = True
DEFAULT_CHUNK_RELOAD_DIRTY_AFTER_COMMAND: Final[bool] = True
DEFAULT_CHUNK_ALLOW_GENERATED: Final[bool] = True
DEFAULT_CHUNK_PREFER_SNAPSHOT: Final[bool] = True

DEFAULT_CHUNK_PROXY_DIAGNOSTICS_ENABLED: Final[bool] = True
DEFAULT_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS: Final[bool] = True
DEFAULT_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER: Final[bool] = True
DEFAULT_CHUNK_PROXY_FORWARD_USER_HEADERS: Final[bool] = False

DEFAULT_CHUNK_STATUS_PATHS: Final[tuple[str, ...]] = (
    "/",
    "/projects/_status",
    "/worlds/_status",
    "/blocks/_status",
    "/chunks/_status",
    "/commands/_status",
)

# -----------------------------------------------------------------------------
# Chunk-/World-Runtime
# -----------------------------------------------------------------------------

DEFAULT_CHUNKS_ENABLED: Final[bool] = True
DEFAULT_CHUNKS_EMPTY_WORLD: Final[bool] = False
DEFAULT_CHUNKS_CHUNK_SIZE: Final[int] = 16
DEFAULT_CHUNKS_VIEW_DISTANCE: Final[int] = 7
DEFAULT_CHUNKS_PRELOAD_RADIUS: Final[int] = 1
DEFAULT_CHUNKS_UNLOAD_DISTANCE: Final[int] = 9
DEFAULT_CHUNKS_MAX_LOADED_CHUNKS: Final[int] = 384
DEFAULT_CHUNKS_LOAD_AROUND_PLAYER: Final[bool] = True
DEFAULT_CHUNKS_DEBUG_DRAW_CHUNK_BOUNDS: Final[bool] = False

# -----------------------------------------------------------------------------
# Kamera / Navigation
# -----------------------------------------------------------------------------

DEFAULT_LOOK_INVERT_X: Final[bool] = False
DEFAULT_LOOK_INVERT_Y: Final[bool] = False
DEFAULT_LOOK_SENSITIVITY: Final[float] = 0.0025
DEFAULT_LOOK_MAX_PITCH_DEGREES: Final[float] = 89.0

DEFAULT_MOVEMENT_WALK_SPEED: Final[float] = 5.5
DEFAULT_MOVEMENT_SPRINT_MULTIPLIER: Final[float] = 1.8
DEFAULT_MOVEMENT_RUN_SPEED: Final[float] = DEFAULT_MOVEMENT_WALK_SPEED * DEFAULT_MOVEMENT_SPRINT_MULTIPLIER
DEFAULT_MOVEMENT_FLY_SPEED: Final[float] = 8.0
DEFAULT_MOVEMENT_VERTICAL_FLY_SPEED: Final[float] = 8.0
DEFAULT_MOVEMENT_DOUBLE_TAP_WINDOW_MS: Final[int] = 300
DEFAULT_MOVEMENT_ALLOW_FLIGHT_TOGGLE: Final[bool] = True
DEFAULT_MOVEMENT_ENABLE_GRAVITY: Final[bool] = False
DEFAULT_MOVEMENT_GRAVITY: Final[float] = 9.81
DEFAULT_MOVEMENT_PLAYER_HEIGHT: Final[float] = 1.8
DEFAULT_MOVEMENT_JUMP_IMPULSE: Final[float] = 5.25

DEFAULT_SPAWN_X: Final[float] = 8.0
DEFAULT_SPAWN_Y: Final[float] = 8.0
DEFAULT_SPAWN_Z: Final[float] = 18.0
DEFAULT_INITIAL_YAW: Final[float] = 0.0
DEFAULT_INITIAL_PITCH: Final[float] = 0.0

# -----------------------------------------------------------------------------
# Inventory / Hotbar / Blocks
# -----------------------------------------------------------------------------

DEFAULT_INVENTORY_ENABLED: Final[bool] = True
DEFAULT_INVENTORY_SOURCE: Final[str] = "vectoplan-user-inventory"
DEFAULT_INVENTORY_ICON_MODE: Final[str] = "icon-only"
DEFAULT_INVENTORY_HOTBAR_SIZE: Final[int] = 9
DEFAULT_INVENTORY_DEFAULT_SELECTED_SLOT: Final[int] = 0
DEFAULT_INVENTORY_SCROLL_WRAP: Final[bool] = True
DEFAULT_INVENTORY_ALLOW_PLACE_ACTION: Final[bool] = True
DEFAULT_INVENTORY_ALLOW_BREAK_ACTION: Final[bool] = True
DEFAULT_INVENTORY_DEFAULT_STACK_SIZE: Final[int] = 64

DEFAULT_DEBUG_GRASS_BLOCK_TYPE_ID: Final[str] = "debug_grass"
DEFAULT_DEBUG_DIRT_BLOCK_TYPE_ID: Final[str] = "debug_dirt"

DEFAULT_INVENTORY_DEBUG_BLOCK_TYPE_IDS: Final[tuple[str, ...]] = (
    DEFAULT_DEBUG_GRASS_BLOCK_TYPE_ID,
    DEFAULT_DEBUG_DIRT_BLOCK_TYPE_ID,
)

DEFAULT_HOTBAR_DEFAULT_BLOCK_TYPE_ID: Final[str] = ""

# -----------------------------------------------------------------------------
# Presence
# -----------------------------------------------------------------------------

DEFAULT_PRESENCE_ENABLED: Final[bool] = False
DEFAULT_PRESENCE_ROOM_ID: Final[str] = "editor-local-room"
DEFAULT_PRESENCE_TRANSPORT: Final[str] = "disabled"
DEFAULT_PRESENCE_UPDATE_RATE_HZ: Final[int] = 12
DEFAULT_PRESENCE_HEARTBEAT_INTERVAL_MS: Final[int] = 5000
DEFAULT_PRESENCE_REMOTE_INTERPOLATION_MS: Final[int] = 120
DEFAULT_PRESENCE_MAX_REMOTE_PLAYERS: Final[int] = 64
DEFAULT_PRESENCE_SHOW_REMOTE_NAMES: Final[bool] = True
DEFAULT_PRESENCE_SELF_DISPLAY_NAME: Final[str] = "Builder"

# -----------------------------------------------------------------------------
# Legacy-Kompatibilität, bewusst deaktiviert als Wahrheit
# -----------------------------------------------------------------------------

DEFAULT_BLOCK_WORLD_ENABLED: Final[bool] = False
DEFAULT_BLOCK_WORLD_MODE: Final[str] = "legacy_local_block_world"
DEFAULT_BLOCK_WORLD_VERSION: Final[int] = 1
DEFAULT_BLOCK_WORLD_NAME: Final[str] = "legacy-local-flat-block-world"
DEFAULT_BLOCK_WORLD_SEED: Final[int] = 1337
DEFAULT_BLOCK_WORLD_CELL_SIZE: Final[float] = 1.0
DEFAULT_BLOCK_WORLD_CHUNK_SIZE: Final[int] = 16
DEFAULT_BLOCK_WORLD_DEPTH: Final[int] = 50
DEFAULT_BLOCK_WORLD_SURFACE_Y: Final[int] = 0
DEFAULT_BLOCK_WORLD_MIN_BLOCK_Y: Final[int] = DEFAULT_BLOCK_WORLD_SURFACE_Y - DEFAULT_BLOCK_WORLD_DEPTH + 1
DEFAULT_BLOCK_WORLD_MAX_BLOCK_Y: Final[int] = DEFAULT_BLOCK_WORLD_SURFACE_Y
DEFAULT_BLOCK_WORLD_REACH_DISTANCE: Final[float] = 8.0
DEFAULT_BLOCK_WORLD_ALLOW_BREAK: Final[bool] = True
DEFAULT_BLOCK_WORLD_ALLOW_PLACE: Final[bool] = True
DEFAULT_BLOCK_WORLD_DEFAULT_HOTBAR_BLOCK_TYPE_IDS: Final[tuple[str, ...]] = (
    DEFAULT_DEBUG_GRASS_BLOCK_TYPE_ID,
    DEFAULT_DEBUG_DIRT_BLOCK_TYPE_ID,
)


# =============================================================================
# Gruppierte Defaults
# =============================================================================

DEFAULT_EDITOR_IDENTITY_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "app_name": DEFAULT_APP_NAME,
        "app_display_name": DEFAULT_APP_DISPLAY_NAME,
        "service_version": DEFAULT_SERVICE_VERSION,
        "build_mode": DEFAULT_BUILD_MODE,
        "build_version": DEFAULT_BUILD_VERSION,
        "page_title": DEFAULT_PAGE_TITLE,
        "brand_name": DEFAULT_BRAND_NAME,
    }
)

DEFAULT_EDITOR_ASSET_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "editor_route_path": DEFAULT_EDITOR_ROUTE_PATH,
        "editor_template_name": DEFAULT_EDITOR_TEMPLATE_NAME,
        "editor_template_mode": DEFAULT_EDITOR_TEMPLATE_MODE,
        "static_editor_url_prefix": DEFAULT_STATIC_EDITOR_URL_PREFIX,
        "static_editor_manifest_name": DEFAULT_STATIC_EDITOR_MANIFEST_NAME,
        "vite_entrypoint": DEFAULT_VITE_ENTRYPOINT,
        "use_vite_manifest": DEFAULT_USE_VITE_MANIFEST,
        "strict_asset_checks": DEFAULT_STRICT_ASSET_CHECKS,
        "fallback_static_js": DEFAULT_FALLBACK_STATIC_JS,
        "fallback_static_css": DEFAULT_FALLBACK_STATIC_CSS,
    }
)

DEFAULT_EDITOR_TEXT_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "initial_status": DEFAULT_INITIAL_STATUS,
        "runtime_loading_status": DEFAULT_RUNTIME_LOADING_STATUS,
        "runtime_ready_status": DEFAULT_RUNTIME_READY_STATUS,
        "runtime_error_status": DEFAULT_RUNTIME_ERROR_STATUS,
        "viewport_placeholder": DEFAULT_VIEWPORT_PLACEHOLDER,
        "pointer_lock_title": DEFAULT_POINTER_LOCK_TITLE,
        "pointer_lock_message": DEFAULT_POINTER_LOCK_MESSAGE,
        "pointer_lock_hint": DEFAULT_POINTER_LOCK_HINT,
    }
)

DEFAULT_EDITOR_RUNTIME_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "runtime_mode": DEFAULT_RUNTIME_MODE,
        "world_mode": DEFAULT_WORLD_MODE,
        "source_mode": DEFAULT_SOURCE_MODE,
    }
)

DEFAULT_EDITOR_FEATURE_FLAG_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "chunkServiceEnabled": DEFAULT_CHUNK_SERVICE_ENABLED,
        "localWorldFallbackEnabled": DEFAULT_LOCAL_WORLD_FALLBACK_ENABLED,
        "legacyFrontendEnabled": DEFAULT_LEGACY_FRONTEND_ENABLED,
        "remoteChunkServiceRequired": DEFAULT_REMOTE_CHUNK_SERVICE_REQUIRED,
        "pointerLockEnabled": DEFAULT_POINTER_LOCK_ENABLED,
        "firstPersonEnabled": DEFAULT_FIRST_PERSON_ENABLED,
        "debugOverlayEnabled": DEFAULT_DEBUG_OVERLAY_ENABLED,
        "crosshairEnabled": DEFAULT_CROSSHAIR_ENABLED,
        "hotbarEnabled": DEFAULT_HOTBAR_ENABLED,
        "statusBarEnabled": DEFAULT_STATUS_BAR_ENABLED,
        "loadingOverlayEnabled": DEFAULT_LOADING_OVERLAY_ENABLED,
        "errorPanelEnabled": DEFAULT_ERROR_PANEL_ENABLED,
    }
)

DEFAULT_EDITOR_CHUNK_SERVICE_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "enabled": DEFAULT_CHUNK_SERVICE_ENABLED,
        "mode": DEFAULT_CHUNK_SERVICE_MODE,
        "sourceKind": DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
        "apiBaseUrl": DEFAULT_CHUNK_BROWSER_BASE_URL,
        "browserBaseUrl": DEFAULT_CHUNK_BROWSER_BASE_URL,
        "internalBaseUrl": DEFAULT_CHUNK_SERVICE_INTERNAL_URL,
        "projectId": DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
        "worldId": DEFAULT_CHUNK_DEFAULT_WORLD_ID,
        "registryId": DEFAULT_CHUNK_REGISTRY_ID,
        "registryVersion": DEFAULT_CHUNK_REGISTRY_VERSION,
        "requestTimeoutMs": DEFAULT_CHUNK_REQUEST_TIMEOUT_MS,
        "commandTimeoutMs": DEFAULT_CHUNK_COMMAND_TIMEOUT_MS,
        "batchTimeoutMs": DEFAULT_CHUNK_BATCH_TIMEOUT_MS,
        "statusTimeoutMs": DEFAULT_CHUNK_STATUS_TIMEOUT_MS,
        "preferBatchLoad": DEFAULT_CHUNK_PREFER_BATCH_LOAD,
        "reloadDirtyChunksAfterCommand": DEFAULT_CHUNK_RELOAD_DIRTY_AFTER_COMMAND,
        "maxBatchChunks": DEFAULT_CHUNK_MAX_BATCH_CHUNKS,
        "maxResponseBytes": DEFAULT_CHUNK_MAX_RESPONSE_BYTES,
        "allowGenerated": DEFAULT_CHUNK_ALLOW_GENERATED,
        "preferSnapshot": DEFAULT_CHUNK_PREFER_SNAPSHOT,
        "statusPaths": DEFAULT_CHUNK_STATUS_PATHS,
        "diagnosticsEnabled": DEFAULT_CHUNK_PROXY_DIAGNOSTICS_ENABLED,
        "includeUpstreamDetails": DEFAULT_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS,
        "placeableBlocksPlaceholderEnabled": DEFAULT_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER,
        "forwardUserHeaders": DEFAULT_CHUNK_PROXY_FORWARD_USER_HEADERS,
    }
)

DEFAULT_EDITOR_CAMERA_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "spawn_x": DEFAULT_SPAWN_X,
        "spawn_y": DEFAULT_SPAWN_Y,
        "spawn_z": DEFAULT_SPAWN_Z,
        "initial_yaw": DEFAULT_INITIAL_YAW,
        "initial_pitch": DEFAULT_INITIAL_PITCH,
        "look_invert_x": DEFAULT_LOOK_INVERT_X,
        "look_invert_y": DEFAULT_LOOK_INVERT_Y,
        "look_sensitivity": DEFAULT_LOOK_SENSITIVITY,
        "look_max_pitch_degrees": DEFAULT_LOOK_MAX_PITCH_DEGREES,
        "movement_walk_speed": DEFAULT_MOVEMENT_WALK_SPEED,
        "movement_run_speed": DEFAULT_MOVEMENT_RUN_SPEED,
        "movement_fly_speed": DEFAULT_MOVEMENT_FLY_SPEED,
        "movement_vertical_fly_speed": DEFAULT_MOVEMENT_VERTICAL_FLY_SPEED,
        "movement_sprint_multiplier": DEFAULT_MOVEMENT_SPRINT_MULTIPLIER,
        "movement_double_tap_window_ms": DEFAULT_MOVEMENT_DOUBLE_TAP_WINDOW_MS,
        "movement_allow_flight_toggle": DEFAULT_MOVEMENT_ALLOW_FLIGHT_TOGGLE,
        "movement_enable_gravity": DEFAULT_MOVEMENT_ENABLE_GRAVITY,
        "movement_gravity": DEFAULT_MOVEMENT_GRAVITY,
        "movement_player_height": DEFAULT_MOVEMENT_PLAYER_HEIGHT,
        "movement_jump_impulse": DEFAULT_MOVEMENT_JUMP_IMPULSE,
    }
)

DEFAULT_EDITOR_CHUNK_STREAMING_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "chunks_enabled": DEFAULT_CHUNKS_ENABLED,
        "chunks_empty_world": DEFAULT_CHUNKS_EMPTY_WORLD,
        "chunks_chunk_size": DEFAULT_CHUNKS_CHUNK_SIZE,
        "chunks_view_distance": DEFAULT_CHUNKS_VIEW_DISTANCE,
        "chunks_preload_radius": DEFAULT_CHUNKS_PRELOAD_RADIUS,
        "chunks_unload_distance": DEFAULT_CHUNKS_UNLOAD_DISTANCE,
        "chunks_max_loaded_chunks": DEFAULT_CHUNKS_MAX_LOADED_CHUNKS,
        "chunks_load_around_player": DEFAULT_CHUNKS_LOAD_AROUND_PLAYER,
        "chunks_debug_draw_chunk_bounds": DEFAULT_CHUNKS_DEBUG_DRAW_CHUNK_BOUNDS,
    }
)

DEFAULT_EDITOR_INVENTORY_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "inventory_enabled": DEFAULT_INVENTORY_ENABLED,
        "inventory_source": DEFAULT_INVENTORY_SOURCE,
        "inventory_icon_mode": DEFAULT_INVENTORY_ICON_MODE,
        "inventory_hotbar_size": DEFAULT_INVENTORY_HOTBAR_SIZE,
        "inventory_default_selected_slot": DEFAULT_INVENTORY_DEFAULT_SELECTED_SLOT,
        "inventory_scroll_wrap": DEFAULT_INVENTORY_SCROLL_WRAP,
        "inventory_allow_place_action": DEFAULT_INVENTORY_ALLOW_PLACE_ACTION,
        "inventory_allow_break_action": DEFAULT_INVENTORY_ALLOW_BREAK_ACTION,
        "inventory_default_stack_size": DEFAULT_INVENTORY_DEFAULT_STACK_SIZE,
        "inventory_block_registry_id": DEFAULT_CHUNK_REGISTRY_ID,
        "inventory_block_registry_version": DEFAULT_CHUNK_REGISTRY_VERSION,
        "inventory_default_block_type_id": DEFAULT_HOTBAR_DEFAULT_BLOCK_TYPE_ID,
    }
)

DEFAULT_EDITOR_PRESENCE_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "presence_enabled": DEFAULT_PRESENCE_ENABLED,
        "presence_room_id": DEFAULT_PRESENCE_ROOM_ID,
        "presence_transport": DEFAULT_PRESENCE_TRANSPORT,
        "presence_update_rate_hz": DEFAULT_PRESENCE_UPDATE_RATE_HZ,
        "presence_heartbeat_interval_ms": DEFAULT_PRESENCE_HEARTBEAT_INTERVAL_MS,
        "presence_remote_interpolation_ms": DEFAULT_PRESENCE_REMOTE_INTERPOLATION_MS,
        "presence_max_remote_players": DEFAULT_PRESENCE_MAX_REMOTE_PLAYERS,
        "presence_show_remote_names": DEFAULT_PRESENCE_SHOW_REMOTE_NAMES,
        "presence_self_display_name": DEFAULT_PRESENCE_SELF_DISPLAY_NAME,
    }
)

DEFAULT_EDITOR_BLOCK_WORLD_VALUES: Final[Mapping[str, Any]] = _freeze_mapping(
    {
        "block_world_enabled": DEFAULT_BLOCK_WORLD_ENABLED,
        "block_world_mode": DEFAULT_BLOCK_WORLD_MODE,
        "block_world_version": DEFAULT_BLOCK_WORLD_VERSION,
        "block_world_name": DEFAULT_BLOCK_WORLD_NAME,
        "block_world_seed": DEFAULT_BLOCK_WORLD_SEED,
        "block_world_cell_size": DEFAULT_BLOCK_WORLD_CELL_SIZE,
        "block_world_chunk_size": DEFAULT_BLOCK_WORLD_CHUNK_SIZE,
        "block_world_depth": DEFAULT_BLOCK_WORLD_DEPTH,
        "block_world_surface_y": DEFAULT_BLOCK_WORLD_SURFACE_Y,
        "block_world_min_block_y": DEFAULT_BLOCK_WORLD_MIN_BLOCK_Y,
        "block_world_max_block_y": DEFAULT_BLOCK_WORLD_MAX_BLOCK_Y,
        "block_world_reach_distance": DEFAULT_BLOCK_WORLD_REACH_DISTANCE,
        "block_world_allow_break": DEFAULT_BLOCK_WORLD_ALLOW_BREAK,
        "block_world_allow_place": DEFAULT_BLOCK_WORLD_ALLOW_PLACE,
        "block_world_default_hotbar_block_type_ids": DEFAULT_BLOCK_WORLD_DEFAULT_HOTBAR_BLOCK_TYPE_IDS,
        "block_world_legacy": True,
        "block_world_truth_owner": "vectoplan-chunk",
    }
)


# =============================================================================
# Chunk-Service Builder
# =============================================================================

@lru_cache(maxsize=64)
def _build_chunk_service_route_hints_cached(
    api_base_url: str,
    project_id: str,
    world_id: str,
) -> Mapping[str, str]:
    safe_api_base_url = _normalize_route_path(api_base_url, DEFAULT_CHUNK_API_PREFIX)
    safe_project_id = _coerce_text(project_id, DEFAULT_CHUNK_DEFAULT_PROJECT_ID)
    safe_world_id = _coerce_text(world_id, DEFAULT_CHUNK_DEFAULT_WORLD_ID)

    project_base = _join_route_path(safe_api_base_url, "projects", safe_project_id)
    world_base = _join_route_path(project_base, "worlds", safe_world_id)

    return _freeze_mapping(
        {
            "apiBaseUrl": safe_api_base_url,
            "status": _join_route_path(safe_api_base_url, "_status"),
            "testConnection": _join_route_path(safe_api_base_url, "_test", "connection"),
            "placeableBlocks": _join_route_path(safe_api_base_url, "placeable-blocks"),
            "projects": _join_route_path(safe_api_base_url, "projects"),
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
            "defaultBlocks": _join_route_path(safe_api_base_url, "blocks"),
            "defaultChunk": _join_route_path(safe_api_base_url, "chunks"),
            "defaultChunksBatch": _join_route_path(safe_api_base_url, "chunks", "batch"),
            "defaultCommands": _join_route_path(safe_api_base_url, "commands"),
        }
    )


def get_default_chunk_service_route_hints(
    api_base_url: str = DEFAULT_CHUNK_BROWSER_BASE_URL,
    project_id: str = DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
    world_id: str = DEFAULT_CHUNK_DEFAULT_WORLD_ID,
) -> dict[str, str]:
    try:
        return dict(_build_chunk_service_route_hints_cached(api_base_url, project_id, world_id))
    except Exception:
        return dict(
            _build_chunk_service_route_hints_cached(
                DEFAULT_CHUNK_BROWSER_BASE_URL,
                DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
                DEFAULT_CHUNK_DEFAULT_WORLD_ID,
            )
        )


def build_default_chunk_route_hints(
    api_base_url: str = DEFAULT_CHUNK_BROWSER_BASE_URL,
    project_id: str = DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
    world_id: str = DEFAULT_CHUNK_DEFAULT_WORLD_ID,
) -> dict[str, str]:
    return get_default_chunk_service_route_hints(
        api_base_url=api_base_url,
        project_id=project_id,
        world_id=world_id,
    )


@lru_cache(maxsize=64)
def _build_chunk_service_config_cached(
    api_base_url: str,
    project_id: str,
    world_id: str,
) -> Mapping[str, Any]:
    safe_api_base_url = _normalize_route_path(api_base_url, DEFAULT_CHUNK_BROWSER_BASE_URL)
    safe_project_id = _coerce_text(project_id, DEFAULT_CHUNK_DEFAULT_PROJECT_ID)
    safe_world_id = _coerce_text(world_id, DEFAULT_CHUNK_DEFAULT_WORLD_ID)

    route_hints = get_default_chunk_service_route_hints(
        api_base_url=safe_api_base_url,
        project_id=safe_project_id,
        world_id=safe_world_id,
    )

    return _freeze_mapping(
        {
            "enabled": DEFAULT_CHUNK_SERVICE_ENABLED,
            "mode": DEFAULT_CHUNK_SERVICE_MODE,
            "sourceKind": DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
            "apiBaseUrl": safe_api_base_url,
            "browserBaseUrl": safe_api_base_url,
            "projectId": safe_project_id,
            "worldId": safe_world_id,
            "registryId": DEFAULT_CHUNK_REGISTRY_ID,
            "registryVersion": DEFAULT_CHUNK_REGISTRY_VERSION,
            "routeHints": route_hints,
            "requestTimeoutMs": DEFAULT_CHUNK_REQUEST_TIMEOUT_MS,
            "commandTimeoutMs": DEFAULT_CHUNK_COMMAND_TIMEOUT_MS,
            "batchTimeoutMs": DEFAULT_CHUNK_BATCH_TIMEOUT_MS,
            "statusTimeoutMs": DEFAULT_CHUNK_STATUS_TIMEOUT_MS,
            "preferBatchLoad": DEFAULT_CHUNK_PREFER_BATCH_LOAD,
            "reloadDirtyChunksAfterCommand": DEFAULT_CHUNK_RELOAD_DIRTY_AFTER_COMMAND,
            "maxBatchChunks": DEFAULT_CHUNK_MAX_BATCH_CHUNKS,
            "allowGenerated": DEFAULT_CHUNK_ALLOW_GENERATED,
            "preferSnapshot": DEFAULT_CHUNK_PREFER_SNAPSHOT,
        }
    )


def get_default_chunk_service_config(
    api_base_url: str = DEFAULT_CHUNK_BROWSER_BASE_URL,
    project_id: str = DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
    world_id: str = DEFAULT_CHUNK_DEFAULT_WORLD_ID,
    *,
    include_internal: bool = False,
) -> dict[str, Any]:
    config = _safe_deepcopy(
        dict(
            _build_chunk_service_config_cached(
                api_base_url,
                project_id,
                world_id,
            )
        )
    )

    if include_internal:
        config["internalBaseUrl"] = DEFAULT_CHUNK_SERVICE_INTERNAL_URL
        config["maxResponseBytes"] = DEFAULT_CHUNK_MAX_RESPONSE_BYTES
        config["statusPaths"] = list(DEFAULT_CHUNK_STATUS_PATHS)
        config["diagnostics"] = {
            "enabled": DEFAULT_CHUNK_PROXY_DIAGNOSTICS_ENABLED,
            "includeUpstreamDetails": DEFAULT_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS,
        }
        config["placeableBlocks"] = {
            "placeholderEnabled": DEFAULT_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER,
            "blocks": get_default_placeable_blocks(),
        }

    return config


def build_default_chunk_service_config(
    api_base_url: str = DEFAULT_CHUNK_BROWSER_BASE_URL,
    project_id: str = DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
    world_id: str = DEFAULT_CHUNK_DEFAULT_WORLD_ID,
    *,
    include_internal: bool = False,
) -> dict[str, Any]:
    return get_default_chunk_service_config(
        api_base_url=api_base_url,
        project_id=project_id,
        world_id=world_id,
        include_internal=include_internal,
    )


def get_default_chunk_proxy_config() -> dict[str, Any]:
    return {
        "enabled": DEFAULT_CHUNK_SERVICE_ENABLED,
        "internalBaseUrl": DEFAULT_CHUNK_SERVICE_INTERNAL_URL,
        "browserBaseUrl": DEFAULT_CHUNK_BROWSER_BASE_URL,
        "apiPrefix": DEFAULT_CHUNK_API_PREFIX,
        "projectId": DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
        "worldId": DEFAULT_CHUNK_DEFAULT_WORLD_ID,
        "sourceKind": DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
        "mode": DEFAULT_CHUNK_SERVICE_MODE,
        "registryId": DEFAULT_CHUNK_REGISTRY_ID,
        "registryVersion": DEFAULT_CHUNK_REGISTRY_VERSION,
        "requestTimeoutSeconds": _milliseconds_to_seconds(DEFAULT_CHUNK_REQUEST_TIMEOUT_MS, 10.0),
        "commandTimeoutSeconds": _milliseconds_to_seconds(DEFAULT_CHUNK_COMMAND_TIMEOUT_MS, 15.0),
        "batchTimeoutSeconds": _milliseconds_to_seconds(DEFAULT_CHUNK_BATCH_TIMEOUT_MS, 20.0),
        "statusTimeoutSeconds": _milliseconds_to_seconds(DEFAULT_CHUNK_STATUS_TIMEOUT_MS, 5.0),
        "requestTimeoutMs": DEFAULT_CHUNK_REQUEST_TIMEOUT_MS,
        "commandTimeoutMs": DEFAULT_CHUNK_COMMAND_TIMEOUT_MS,
        "batchTimeoutMs": DEFAULT_CHUNK_BATCH_TIMEOUT_MS,
        "statusTimeoutMs": DEFAULT_CHUNK_STATUS_TIMEOUT_MS,
        "preferBatchLoad": DEFAULT_CHUNK_PREFER_BATCH_LOAD,
        "reloadDirtyChunksAfterCommand": DEFAULT_CHUNK_RELOAD_DIRTY_AFTER_COMMAND,
        "maxBatchChunks": DEFAULT_CHUNK_MAX_BATCH_CHUNKS,
        "maxResponseBytes": DEFAULT_CHUNK_MAX_RESPONSE_BYTES,
        "allowGenerated": DEFAULT_CHUNK_ALLOW_GENERATED,
        "preferSnapshot": DEFAULT_CHUNK_PREFER_SNAPSHOT,
        "statusPaths": list(DEFAULT_CHUNK_STATUS_PATHS),
        "routeHints": get_default_chunk_service_route_hints(),
        "diagnostics": {
            "enabled": DEFAULT_CHUNK_PROXY_DIAGNOSTICS_ENABLED,
            "includeUpstreamDetails": DEFAULT_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS,
        },
        "placeableBlocks": {
            "placeholderEnabled": DEFAULT_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER,
            "blocks": get_default_placeable_blocks(),
        },
        "forwardUserHeaders": DEFAULT_CHUNK_PROXY_FORWARD_USER_HEADERS,
    }


# =============================================================================
# Feature Flags / Dataset / Bootstrap Payload
# =============================================================================

def get_default_runtime_feature_flags() -> dict[str, bool]:
    return {
        "chunkServiceEnabled": DEFAULT_CHUNK_SERVICE_ENABLED,
        "localWorldFallbackEnabled": DEFAULT_LOCAL_WORLD_FALLBACK_ENABLED,
        "legacyFrontendEnabled": DEFAULT_LEGACY_FRONTEND_ENABLED,
        "remoteChunkServiceRequired": DEFAULT_REMOTE_CHUNK_SERVICE_REQUIRED,
        "pointerLockEnabled": DEFAULT_POINTER_LOCK_ENABLED,
        "firstPersonEnabled": DEFAULT_FIRST_PERSON_ENABLED,
        "debugOverlayEnabled": DEFAULT_DEBUG_OVERLAY_ENABLED,
        "crosshairEnabled": DEFAULT_CROSSHAIR_ENABLED,
        "hotbarEnabled": DEFAULT_HOTBAR_ENABLED,
        "statusBarEnabled": DEFAULT_STATUS_BAR_ENABLED,
        "loadingOverlayEnabled": DEFAULT_LOADING_OVERLAY_ENABLED,
        "errorPanelEnabled": DEFAULT_ERROR_PANEL_ENABLED,
    }


def get_default_root_dataset_values() -> dict[str, str]:
    return {
        "editor-root": "true",
        "editor-runtime-mode": DEFAULT_RUNTIME_MODE,
        "editor-world-mode": DEFAULT_WORLD_MODE,
        "editor-source-mode": DEFAULT_SOURCE_MODE,
        "editor-build-mode": DEFAULT_BUILD_MODE,
        "editor-build-version": DEFAULT_BUILD_VERSION,
        "chunk-service-enabled": "true" if DEFAULT_CHUNK_SERVICE_ENABLED else "false",
        "chunk-service-api-base-url": DEFAULT_CHUNK_BROWSER_BASE_URL,
        "chunk-service-browser-base-url": DEFAULT_CHUNK_BROWSER_BASE_URL,
        "chunk-service-project-id": DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
        "chunk-service-world-id": DEFAULT_CHUNK_DEFAULT_WORLD_ID,
        "chunk-service-source-kind": DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
        "chunk-service-mode": DEFAULT_CHUNK_SERVICE_MODE,
    }


@lru_cache(maxsize=1)
def _build_default_editor_bootstrap_payload_cached() -> Mapping[str, Any]:
    chunk_config = get_default_chunk_service_config()
    feature_flags = get_default_runtime_feature_flags()

    payload = {
        "service": {
            "name": DEFAULT_APP_NAME,
            "displayName": DEFAULT_APP_DISPLAY_NAME,
            "version": DEFAULT_SERVICE_VERSION,
        },
        "build": {
            "mode": DEFAULT_BUILD_MODE,
            "version": DEFAULT_BUILD_VERSION,
        },
        "project": {
            "projectId": DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
            "worldId": DEFAULT_CHUNK_DEFAULT_WORLD_ID,
        },
        "runtime": {
            "mode": DEFAULT_RUNTIME_MODE,
            "worldMode": DEFAULT_WORLD_MODE,
            "sourceMode": DEFAULT_SOURCE_MODE,
            "chunk": chunk_config,
            "camera": {
                "spawn": {
                    "x": DEFAULT_SPAWN_X,
                    "y": DEFAULT_SPAWN_Y,
                    "z": DEFAULT_SPAWN_Z,
                },
                "yaw": DEFAULT_INITIAL_YAW,
                "pitch": DEFAULT_INITIAL_PITCH,
                "moveSpeed": DEFAULT_MOVEMENT_WALK_SPEED,
                "sprintMultiplier": DEFAULT_MOVEMENT_SPRINT_MULTIPLIER,
                "lookSensitivity": DEFAULT_LOOK_SENSITIVITY,
                "playerHeight": DEFAULT_MOVEMENT_PLAYER_HEIGHT,
            },
            "chunks": {
                "enabled": DEFAULT_CHUNKS_ENABLED,
                "chunkSize": DEFAULT_CHUNKS_CHUNK_SIZE,
                "viewDistance": DEFAULT_CHUNKS_VIEW_DISTANCE,
                "preloadRadius": DEFAULT_CHUNKS_PRELOAD_RADIUS,
                "unloadDistance": DEFAULT_CHUNKS_UNLOAD_DISTANCE,
                "maxLoadedChunks": DEFAULT_CHUNKS_MAX_LOADED_CHUNKS,
                "loadAroundPlayer": DEFAULT_CHUNKS_LOAD_AROUND_PLAYER,
                "debugDrawChunkBounds": DEFAULT_CHUNKS_DEBUG_DRAW_CHUNK_BOUNDS,
            },
            "inventory": {
                "enabled": DEFAULT_INVENTORY_ENABLED,
                "source": DEFAULT_INVENTORY_SOURCE,
                "hotbarSize": DEFAULT_INVENTORY_HOTBAR_SIZE,
                "selectedSlot": DEFAULT_INVENTORY_DEFAULT_SELECTED_SLOT,
                "defaultBlockTypeId": DEFAULT_HOTBAR_DEFAULT_BLOCK_TYPE_ID,
                "items": get_default_inventory_palette(),
                "placeableBlocks": get_default_placeable_blocks(),
            },
            "ui": {
                "pageTitle": DEFAULT_PAGE_TITLE,
                "brandName": DEFAULT_BRAND_NAME,
                "statusInitial": DEFAULT_INITIAL_STATUS,
                "statusLoading": DEFAULT_RUNTIME_LOADING_STATUS,
                "statusReady": DEFAULT_RUNTIME_READY_STATUS,
                "statusError": DEFAULT_RUNTIME_ERROR_STATUS,
                "viewportPlaceholder": DEFAULT_VIEWPORT_PLACEHOLDER,
                "pointerLockTitle": DEFAULT_POINTER_LOCK_TITLE,
                "pointerLockMessage": DEFAULT_POINTER_LOCK_MESSAGE,
                "pointerLockHint": DEFAULT_POINTER_LOCK_HINT,
            },
            "featureFlags": feature_flags,
        },
        "featureFlags": feature_flags,
    }

    return _freeze_mapping(payload)


def get_default_editor_bootstrap_payload() -> dict[str, Any]:
    return _safe_deepcopy(dict(_build_default_editor_bootstrap_payload_cached()))


# =============================================================================
# Placeable Blocks / Inventory
# =============================================================================

def _build_placeable_block(
    *,
    block_type_id: str,
    label: str,
    cell_value: int,
    palette_index: int,
) -> dict[str, Any]:
    return {
        "blockTypeId": block_type_id,
        "label": label,
        "cellValue": cell_value,
        "paletteIndex": palette_index,
        "solid": True,
        "placeable": True,
        "breakable": True,
        "metadata": {
            "source": "editor-defaults",
            "registryId": DEFAULT_CHUNK_REGISTRY_ID,
            "registryVersion": DEFAULT_CHUNK_REGISTRY_VERSION,
        },
    }


@lru_cache(maxsize=1)
def _build_default_placeable_blocks_cached() -> tuple[Mapping[str, Any], ...]:
    return _freeze_sequence_dicts(())


def get_default_placeable_blocks() -> list[dict[str, Any]]:
    return _safe_deepcopy([dict(block) for block in _build_default_placeable_blocks_cached()])


def _build_filled_inventory_slot(
    *,
    slot_index: int,
    item_id: str,
    block_type_id: str,
    label: str,
    selected: bool = False,
) -> dict[str, Any]:
    return {
        "slotIndex": slot_index,
        "slotKey": f"slot_{slot_index}",
        "empty": False,
        "enabled": True,
        "selected": bool(selected),
        "itemId": item_id,
        "itemKind": "block",
        "kind": "block",
        "type": "block",
        "blockTypeId": block_type_id,
        "placeable": True,
        "breakable": True,
        "iconKey": "placeholder-block",
        "iconKind": "css",
        "iconUrl": None,
        "icon": {
            "key": "placeholder-block",
            "kind": "css",
            "url": None,
        },
        "label": label,
        "displayLabel": "",
        "visibleLabel": False,
        "ariaLabel": label,
        "title": label,
        "stackSize": DEFAULT_INVENTORY_DEFAULT_STACK_SIZE,
        "maxStackSize": DEFAULT_INVENTORY_DEFAULT_STACK_SIZE,
        "metadata": {
            "source": "editor-defaults",
            "registryId": DEFAULT_CHUNK_REGISTRY_ID,
            "registryVersion": DEFAULT_CHUNK_REGISTRY_VERSION,
        },
    }


def _build_empty_inventory_slot(slot_index: int, *, selected: bool = False) -> dict[str, Any]:
    return {
        "slotIndex": slot_index,
        "slotKey": f"slot_{slot_index}",
        "empty": True,
        "enabled": True,
        "selected": bool(selected),
        "itemId": None,
        "itemKind": None,
        "kind": "empty",
        "type": "empty",
        "blockTypeId": None,
        "placeable": False,
        "breakable": False,
        "iconKey": None,
        "iconKind": None,
        "iconUrl": None,
        "icon": None,
        "label": "",
        "displayLabel": "",
        "visibleLabel": False,
        "ariaLabel": f"Leerer Slot {slot_index + 1}",
        "title": "",
        "stackSize": 0,
        "maxStackSize": DEFAULT_INVENTORY_DEFAULT_STACK_SIZE,
        "metadata": {
            "source": "editor-defaults",
        },
    }


@lru_cache(maxsize=1)
def _build_default_inventory_palette_cached() -> tuple[Mapping[str, Any], ...]:
    slots = [
        _build_empty_inventory_slot(slot_index, selected=slot_index == 0)
        for slot_index in range(DEFAULT_INVENTORY_HOTBAR_SIZE)
    ]

    return _freeze_sequence_dicts(slots)


def get_default_inventory_palette() -> list[dict[str, Any]]:
    return _safe_deepcopy([dict(entry) for entry in _build_default_inventory_palette_cached()])


def get_default_inventory_palette_tuple() -> tuple[Mapping[str, Any], ...]:
    return _build_default_inventory_palette_cached()


def get_default_inventory_slot(
    slot_index: int,
    default: Mapping[str, Any] | dict[str, Any] | None = None,
) -> dict[str, Any]:
    safe_slot_index = _coerce_int(slot_index, 0, 0, 255)

    try:
        palette = _build_default_inventory_palette_cached()
        if 0 <= safe_slot_index < len(palette):
            return _safe_deepcopy(dict(palette[safe_slot_index]))
    except Exception:
        pass

    fallback_mapping = _safe_mapping(default)

    if fallback_mapping:
        fallback = _safe_deepcopy(dict(fallback_mapping))
        fallback["slotIndex"] = safe_slot_index
        fallback.setdefault("slotKey", f"slot_{safe_slot_index}")
        return fallback

    return _build_empty_inventory_slot(safe_slot_index)


# =============================================================================
# Legacy-BlockWorld Defaults
# =============================================================================

@lru_cache(maxsize=1)
def _build_default_block_world_config_cached() -> Mapping[str, Any]:
    return _freeze_mapping(
        {
            "enabled": DEFAULT_BLOCK_WORLD_ENABLED,
            "mode": DEFAULT_BLOCK_WORLD_MODE,
            "version": DEFAULT_BLOCK_WORLD_VERSION,
            "worldName": DEFAULT_BLOCK_WORLD_NAME,
            "worldSeed": DEFAULT_BLOCK_WORLD_SEED,
            "cellSize": DEFAULT_BLOCK_WORLD_CELL_SIZE,
            "chunkSize": DEFAULT_BLOCK_WORLD_CHUNK_SIZE,
            "depth": DEFAULT_BLOCK_WORLD_DEPTH,
            "surfaceY": DEFAULT_BLOCK_WORLD_SURFACE_Y,
            "minBlockY": DEFAULT_BLOCK_WORLD_MIN_BLOCK_Y,
            "maxBlockY": DEFAULT_BLOCK_WORLD_MAX_BLOCK_Y,
            "reachDistance": DEFAULT_BLOCK_WORLD_REACH_DISTANCE,
            "allowBreak": DEFAULT_BLOCK_WORLD_ALLOW_BREAK,
            "allowPlace": DEFAULT_BLOCK_WORLD_ALLOW_PLACE,
            "defaultHotbarBlockTypeIds": DEFAULT_BLOCK_WORLD_DEFAULT_HOTBAR_BLOCK_TYPE_IDS,
            "legacy": True,
            "truthOwner": "vectoplan-chunk",
        }
    )


def get_default_block_world_config() -> dict[str, Any]:
    return _safe_deepcopy(dict(_build_default_block_world_config_cached()))


def get_default_block_world_hotbar_block_type_ids() -> list[str]:
    return list(DEFAULT_BLOCK_WORLD_DEFAULT_HOTBAR_BLOCK_TYPE_IDS)


def get_default_block_world_hotbar_block_type_ids_tuple() -> tuple[str, ...]:
    return tuple(DEFAULT_BLOCK_WORLD_DEFAULT_HOTBAR_BLOCK_TYPE_IDS)


# =============================================================================
# Template- und Payload-Kontexte
# =============================================================================

@lru_cache(maxsize=1)
def _build_default_editor_template_context_cached() -> Mapping[str, Any]:
    context = _safe_group_dict(
        DEFAULT_EDITOR_IDENTITY_VALUES,
        DEFAULT_EDITOR_ASSET_VALUES,
        DEFAULT_EDITOR_TEXT_VALUES,
        DEFAULT_EDITOR_RUNTIME_VALUES,
        DEFAULT_EDITOR_CAMERA_VALUES,
        DEFAULT_EDITOR_CHUNK_STREAMING_VALUES,
        DEFAULT_EDITOR_INVENTORY_VALUES,
        DEFAULT_EDITOR_PRESENCE_VALUES,
        DEFAULT_EDITOR_BLOCK_WORLD_VALUES,
    )

    feature_flags = get_default_runtime_feature_flags()
    chunk = get_default_chunk_service_config()
    root_dataset_values = get_default_root_dataset_values()

    context["feature_flags"] = feature_flags
    context["chunk"] = chunk
    context["chunk_config"] = chunk
    context["chunk_route_hints"] = dict(chunk.get("routeHints", {}))
    context["chunk_enabled"] = bool(chunk.get("enabled", True))
    context["chunk_mode"] = str(chunk.get("mode", DEFAULT_CHUNK_SERVICE_MODE))
    context["chunk_source_kind"] = str(chunk.get("sourceKind", DEFAULT_CHUNK_SERVICE_SOURCE_KIND))
    context["chunk_api_base_url"] = str(chunk.get("apiBaseUrl", DEFAULT_CHUNK_BROWSER_BASE_URL))
    context["chunk_browser_base_url"] = str(chunk.get("browserBaseUrl", DEFAULT_CHUNK_BROWSER_BASE_URL))
    context["chunk_project_id"] = str(chunk.get("projectId", DEFAULT_CHUNK_DEFAULT_PROJECT_ID))
    context["chunk_world_id"] = str(chunk.get("worldId", DEFAULT_CHUNK_DEFAULT_WORLD_ID))

    context["bootstrap_payload"] = get_default_editor_bootstrap_payload()
    context["root_dataset_values"] = root_dataset_values
    context["placeable_blocks"] = get_default_placeable_blocks()
    context["inventory_default_palette"] = get_default_inventory_palette()
    context["block_world_default_config"] = get_default_block_world_config()
    context["block_world_default_hotbar_block_type_ids"] = get_default_block_world_hotbar_block_type_ids()

    context["fallback_active"] = False
    context["fallback_reason"] = None

    return _freeze_mapping(context)


def get_default_editor_template_context() -> dict[str, Any]:
    return _safe_deepcopy(dict(_build_default_editor_template_context_cached()))


@lru_cache(maxsize=1)
def _build_default_editor_payload_seed_context_cached() -> Mapping[str, Any]:
    context = get_default_editor_template_context()
    context["bootstrap_payload"] = get_default_editor_bootstrap_payload()
    context["root_dataset_values"] = get_default_root_dataset_values()
    context["chunk"] = get_default_chunk_service_config()
    context["chunk_proxy"] = get_default_chunk_proxy_config()
    return _freeze_mapping(context)


def get_default_editor_payload_seed_context() -> dict[str, Any]:
    return _safe_deepcopy(dict(_build_default_editor_payload_seed_context_cached()))


def get_default_editor_context_value(key: str, default: Any = None) -> Any:
    normalized_key = _normalize_text(key)
    if not normalized_key:
        return default

    try:
        return dict(_build_default_editor_template_context_cached()).get(normalized_key, default)
    except Exception:
        return default


def get_default_editor_payload_seed_value(key: str, default: Any = None) -> Any:
    normalized_key = _normalize_text(key)
    if not normalized_key:
        return default

    try:
        return dict(_build_default_editor_payload_seed_context_cached()).get(normalized_key, default)
    except Exception:
        return default


@lru_cache(maxsize=1)
def get_default_editor_value_groups() -> Mapping[str, Mapping[str, Any]]:
    return _freeze_mapping(
        {
            "identity": DEFAULT_EDITOR_IDENTITY_VALUES,
            "assets": DEFAULT_EDITOR_ASSET_VALUES,
            "text": DEFAULT_EDITOR_TEXT_VALUES,
            "runtime": DEFAULT_EDITOR_RUNTIME_VALUES,
            "feature_flags": DEFAULT_EDITOR_FEATURE_FLAG_VALUES,
            "chunk_service": DEFAULT_EDITOR_CHUNK_SERVICE_VALUES,
            "camera": DEFAULT_EDITOR_CAMERA_VALUES,
            "chunks": DEFAULT_EDITOR_CHUNK_STREAMING_VALUES,
            "inventory": DEFAULT_EDITOR_INVENTORY_VALUES,
            "presence": DEFAULT_EDITOR_PRESENCE_VALUES,
            "block_world": DEFAULT_EDITOR_BLOCK_WORLD_VALUES,
        }
    )


def get_default_editor_group(group_name: str) -> Mapping[str, Any]:
    normalized_group_name = _normalize_text(group_name, "")
    if not normalized_group_name:
        return {}

    try:
        groups = get_default_editor_value_groups()
        group = groups.get(normalized_group_name)
        return group if isinstance(group, Mapping) else {}
    except Exception:
        return {}


# =============================================================================
# Öffentliche Alias-Funktionen
# =============================================================================

def get_editor_bootstrap_defaults() -> dict[str, Any]:
    return get_default_editor_template_context()


def get_editor_bootstrap_default_values() -> dict[str, Any]:
    return get_editor_bootstrap_defaults()


def build_editor_bootstrap_defaults() -> dict[str, Any]:
    return get_editor_bootstrap_defaults()


# =============================================================================
# Diagnose / Cache-Clear
# =============================================================================

def get_editor_defaults_module_metadata() -> dict[str, Any]:
    groups = get_default_editor_value_groups()

    group_key_counts: dict[str, int] = {}
    for group_name, group_values in groups.items():
        try:
            group_key_counts[_coerce_text(group_name, "unknown")] = len(dict(group_values))
        except Exception:
            group_key_counts[_coerce_text(group_name, "unknown")] = 0

    try:
        chunk_route_hints = get_default_chunk_service_route_hints()
    except Exception:
        chunk_route_hints = {}

    return {
        "moduleName": DEFAULTS_MODULE_NAME,
        "moduleVersion": DEFAULTS_VERSION,
        "defaultAppName": DEFAULT_APP_NAME,
        "defaultRuntimeMode": DEFAULT_RUNTIME_MODE,
        "defaultWorldMode": DEFAULT_WORLD_MODE,
        "defaultSourceMode": DEFAULT_SOURCE_MODE,
        "defaultEditorRoutePath": DEFAULT_EDITOR_ROUTE_PATH,
        "defaultTemplateName": DEFAULT_EDITOR_TEMPLATE_NAME,
        "defaultStaticEditorUrlPrefix": DEFAULT_STATIC_EDITOR_URL_PREFIX,
        "defaultViteEntrypoint": DEFAULT_VITE_ENTRYPOINT,
        "defaultChunkServiceEnabled": DEFAULT_CHUNK_SERVICE_ENABLED,
        "defaultChunkServiceMode": DEFAULT_CHUNK_SERVICE_MODE,
        "defaultChunkServiceSourceKind": DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
        "defaultChunkApiPrefix": DEFAULT_CHUNK_API_PREFIX,
        "defaultChunkProjectId": DEFAULT_CHUNK_DEFAULT_PROJECT_ID,
        "defaultChunkWorldId": DEFAULT_CHUNK_DEFAULT_WORLD_ID,
        "defaultInventorySource": DEFAULT_INVENTORY_SOURCE,
        "defaultHotbarSize": DEFAULT_INVENTORY_HOTBAR_SIZE,
        "defaultBlockWorldEnabled": DEFAULT_BLOCK_WORLD_ENABLED,
        "chunkRouteHintKeys": sorted(chunk_route_hints.keys()),
        "featureFlags": get_default_runtime_feature_flags(),
        "groupKeyCounts": group_key_counts,
    }


def clear_editor_defaults_caches() -> None:
    cache_clearers = (
        _build_chunk_service_route_hints_cached,
        _build_chunk_service_config_cached,
        _build_default_editor_bootstrap_payload_cached,
        _build_default_placeable_blocks_cached,
        _build_default_inventory_palette_cached,
        _build_default_block_world_config_cached,
        _build_default_editor_template_context_cached,
        _build_default_editor_payload_seed_context_cached,
        get_default_editor_value_groups,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


def clear_defaults_caches() -> None:
    clear_editor_defaults_caches()


def clear_bootstrap_caches() -> None:
    clear_editor_defaults_caches()


__all__ = [
    "DEFAULTS_MODULE_NAME",
    "DEFAULTS_VERSION",
    "DEFAULT_APP_NAME",
    "DEFAULT_APP_DISPLAY_NAME",
    "DEFAULT_SERVICE_VERSION",
    "DEFAULT_BUILD_MODE",
    "DEFAULT_BUILD_VERSION",
    "DEFAULT_EDITOR_ROUTE_PATH",
    "DEFAULT_EDITOR_TEMPLATE_NAME",
    "DEFAULT_EDITOR_TEMPLATE_MODE",
    "DEFAULT_STATIC_EDITOR_URL_PREFIX",
    "DEFAULT_STATIC_EDITOR_MANIFEST_NAME",
    "DEFAULT_VITE_ENTRYPOINT",
    "DEFAULT_USE_VITE_MANIFEST",
    "DEFAULT_STRICT_ASSET_CHECKS",
    "DEFAULT_PAGE_TITLE",
    "DEFAULT_BRAND_NAME",
    "DEFAULT_RUNTIME_MODE",
    "DEFAULT_WORLD_MODE",
    "DEFAULT_SOURCE_MODE",
    "DEFAULT_CHUNK_SERVICE_ENABLED",
    "DEFAULT_LOCAL_WORLD_FALLBACK_ENABLED",
    "DEFAULT_LEGACY_FRONTEND_ENABLED",
    "DEFAULT_CHUNK_SERVICE_MODE",
    "DEFAULT_CHUNK_SERVICE_SOURCE_KIND",
    "DEFAULT_CHUNK_API_PREFIX",
    "DEFAULT_CHUNK_BROWSER_BASE_URL",
    "DEFAULT_CHUNK_SERVICE_INTERNAL_URL",
    "DEFAULT_CHUNK_DEFAULT_PROJECT_ID",
    "DEFAULT_CHUNK_DEFAULT_WORLD_ID",
    "DEFAULT_CHUNK_REGISTRY_ID",
    "DEFAULT_CHUNK_REGISTRY_VERSION",
    "DEFAULT_DEBUG_GRASS_BLOCK_TYPE_ID",
    "DEFAULT_DEBUG_DIRT_BLOCK_TYPE_ID",
    "DEFAULT_EDITOR_IDENTITY_VALUES",
    "DEFAULT_EDITOR_ASSET_VALUES",
    "DEFAULT_EDITOR_TEXT_VALUES",
    "DEFAULT_EDITOR_RUNTIME_VALUES",
    "DEFAULT_EDITOR_FEATURE_FLAG_VALUES",
    "DEFAULT_EDITOR_CHUNK_SERVICE_VALUES",
    "get_default_chunk_service_route_hints",
    "build_default_chunk_route_hints",
    "get_default_chunk_service_config",
    "build_default_chunk_service_config",
    "get_default_chunk_proxy_config",
    "get_default_runtime_feature_flags",
    "get_default_root_dataset_values",
    "get_default_editor_bootstrap_payload",
    "get_default_placeable_blocks",
    "get_default_inventory_palette",
    "get_default_inventory_palette_tuple",
    "get_default_inventory_slot",
    "get_default_block_world_config",
    "get_default_block_world_hotbar_block_type_ids",
    "get_default_block_world_hotbar_block_type_ids_tuple",
    "get_default_editor_template_context",
    "get_default_editor_payload_seed_context",
    "get_default_editor_context_value",
    "get_default_editor_payload_seed_value",
    "get_default_editor_value_groups",
    "get_default_editor_group",
    "get_editor_bootstrap_defaults",
    "get_editor_bootstrap_default_values",
    "build_editor_bootstrap_defaults",
    "get_editor_defaults_module_metadata",
    "clear_editor_defaults_caches",
    "clear_defaults_caches",
    "clear_bootstrap_caches",
]