# services/vectoplan-editor/src/bootstrap/__init__.py
from __future__ import annotations

import copy
import importlib
import inspect
import json
import logging
import os
import re
import threading
from functools import lru_cache
from types import ModuleType
from typing import TYPE_CHECKING, Any, Callable, Final, Mapping


if TYPE_CHECKING:
    from flask import Flask
    from .startup import FileCheckSpec, PathCheckSpec


LOGGER = logging.getLogger(__name__)

BOOTSTRAP_PACKAGE_VERSION: Final[str] = "0.6.0"

_STARTUP_MODULE_NAME: Final[str] = "src.bootstrap.startup"
_DEFAULTS_MODULE_NAME: Final[str] = "src.bootstrap.defaults"
_ASSETS_MODULE_NAME: Final[str] = "src.bootstrap.assets"
_PAYLOAD_MODULE_NAME: Final[str] = "src.bootstrap.payload"
_CONTEXT_MODULE_NAME: Final[str] = "src.bootstrap.context"

_MODULE_NAMES: Final[dict[str, str]] = {
    "startup": _STARTUP_MODULE_NAME,
    "defaults": _DEFAULTS_MODULE_NAME,
    "assets": _ASSETS_MODULE_NAME,
    "payload": _PAYLOAD_MODULE_NAME,
    "context": _CONTEXT_MODULE_NAME,
}

_STARTUP_PUBLIC_EXPORTS: Final[tuple[str, ...]] = (
    "PathCheckSpec",
    "FileCheckSpec",
    "get_default_path_check_specs",
    "get_default_file_check_specs",
    "get_default_path_check_spec_data",
    "get_default_file_check_spec_data",
    "run_startup",
    "bootstrap_app",
    "initialize_app",
    "get_startup_state",
    "get_startup_summary",
)

_DEFAULTS_PUBLIC_EXPORTS: Final[tuple[str, ...]] = (
    "get_editor_bootstrap_defaults",
    "get_editor_bootstrap_default_values",
    "build_editor_bootstrap_defaults",
    "get_default_editor_template_context",
    "get_default_editor_payload_seed_context",
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
    "get_editor_defaults_module_metadata",
)

_ASSETS_PUBLIC_EXPORTS: Final[tuple[str, ...]] = (
    "EditorAssetFile",
    "EditorAssets",
    "EditorAssetSettings",
    "get_editor_assets",
    "get_editor_asset_settings",
    "resolve_editor_assets",
    "build_editor_assets_template_context",
    "clear_asset_caches",
)

_PAYLOAD_PUBLIC_EXPORTS: Final[tuple[str, ...]] = (
    "get_default_editor_bootstrap_payload_seed",
    "get_editor_bootstrap_payload_metadata",
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
)

_CONTEXT_PUBLIC_EXPORTS: Final[tuple[str, ...]] = (
    "build_editor_template_context",
    "build_editor_context",
    "create_editor_template_context",
    "create_editor_context",
    "build_fallback_editor_template_context",
    "build_fallback_editor_context",
    "create_fallback_editor_template_context",
    "create_fallback_editor_context",
    "get_editor_context_module_metadata",
)

_PACKAGE_PUBLIC_EXPORTS: Final[tuple[str, ...]] = (
    "BOOTSTRAP_PACKAGE_VERSION",
    "get_editor_bootstrap_package_metadata",
    "clear_editor_bootstrap_package_caches",
)

_PUBLIC_EXPORTS: Final[tuple[str, ...]] = (
    *_PACKAGE_PUBLIC_EXPORTS,
    *_STARTUP_PUBLIC_EXPORTS,
    *_DEFAULTS_PUBLIC_EXPORTS,
    *_ASSETS_PUBLIC_EXPORTS,
    *_PAYLOAD_PUBLIC_EXPORTS,
    *_CONTEXT_PUBLIC_EXPORTS,
)

_CACHE_LOCK = threading.RLock()

_SAFE_ID_RE: Final[re.Pattern[str]] = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$")

_DEFAULT_CHUNK_BROWSER_BASE_URL: Final[str] = "/editor/api/chunk"
_DEFAULT_CHUNK_PROJECT_ID: Final[str] = "dev-project"
_DEFAULT_CHUNK_UNIVERSE_ID: Final[str] = "dev-universe"
_DEFAULT_CHUNK_WORLD_ID: Final[str] = "world_spawn"


# =============================================================================
# Defensive Helper
# =============================================================================

def _has_value(value: Any) -> bool:
    try:
        return value is not None and value != ""
    except Exception:
        return value is not None


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


def _coerce_bool(value: Any, default: bool = False) -> bool:
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

    if normalized in {"1", "true", "t", "yes", "y", "on", "enabled", "ja"}:
        return True

    if normalized in {"0", "false", "f", "no", "n", "off", "disabled", "nein"}:
        return False

    return default


def _coerce_float(value: Any, default: float) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _coerce_int(value: Any, default: int) -> int:
    try:
        if value is None:
            return default
        return int(value)
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


def _json_dumps(value: Any) -> str:
    try:
        return json.dumps(
            _json_safe(value),
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
            default=str,
        )
    except Exception:
        return "{}"


def _safe_get_config_value(config_source: Any, key: str, default: Any = None) -> Any:
    if config_source is None:
        return default

    try:
        if isinstance(config_source, Mapping):
            return config_source.get(key, default)
    except Exception:
        pass

    try:
        get_method = getattr(config_source, "get", None)
        if callable(get_method):
            return get_method(key, default)
    except Exception:
        pass

    try:
        return getattr(config_source, key)
    except Exception:
        return default


def _config_first(config_source: Any, default: Any, *keys: str) -> Any:
    for key in keys:
        value = _safe_get_config_value(config_source, key, None)
        if _has_value(value):
            return value

    for key in keys:
        try:
            value = os.environ.get(key)
        except Exception:
            value = None

        if _has_value(value):
            return value

    return default


def _mapping_get(source: Any, *keys: str, default: Any = None) -> Any:
    if source is None:
        return default

    for key in keys:
        try:
            if isinstance(source, Mapping) and key in source:
                value = source.get(key)
                if _has_value(value):
                    return value
        except Exception:
            pass

        try:
            get_method = getattr(source, "get", None)
            if callable(get_method):
                value = get_method(key, None)
                if _has_value(value):
                    return value
        except Exception:
            pass

        try:
            value = getattr(source, key)
            if _has_value(value):
                return value
        except Exception:
            pass

    return default


def _normalize_route_path(value: Any, default: str) -> str:
    raw = _normalize_text(value, default) or default

    try:
        normalized = raw.strip()
        if not normalized:
            normalized = default

        if not normalized.startswith("/"):
            normalized = f"/{normalized}"

        while "//" in normalized:
            normalized = normalized.replace("//", "/")

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


def _safe_script_json(text: str) -> str:
    normalized = _coerce_text(text, "{}")

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
        return "{}"


def _safe_identifier(value: Any, default: str = "") -> str:
    text = _normalize_text(value)

    if text is None:
        return default

    if len(text) > 180:
        return default

    if not _SAFE_ID_RE.match(text):
        return default

    return text


def _chunk_status(value: Any, default: str = "pending") -> str:
    text = _coerce_text(value, "").strip().lower().replace("-", "_").replace(" ", "_")

    aliases = {
        "": default,
        "ok": "ready",
        "active": "ready",
        "linked": "ready",
        "created": "ready",
        "provisioned": "ready",
        "waiting": "pending",
        "queued": "pending",
        "failed": "error",
        "failure": "error",
        "unavailable": "error",
        "off": "disabled",
    }

    result = aliases.get(text, text)

    if result in {"ready", "pending", "error", "disabled"}:
        return result

    return default


def _first_identifier(*values: Any, default: str = "") -> str:
    for value in values:
        text = _safe_identifier(value, "")
        if text:
            return text
    return default


def _first_text(*values: Any, default: str = "") -> str:
    for value in values:
        text = _normalize_text(value)
        if text:
            return text
    return default


# =============================================================================
# App / Chunk Context
# =============================================================================

def _request_args_from_kwargs(kwargs: Mapping[str, Any]) -> Any:
    return (
        kwargs.get("request_args")
        or kwargs.get("requestArgs")
        or kwargs.get("query_args")
        or kwargs.get("queryArgs")
        or kwargs.get("args")
        or {}
    )


def _explicit_chunk_context_from_kwargs(kwargs: Mapping[str, Any]) -> dict[str, Any]:
    for key in (
        "chunk_context",
        "chunkContext",
        "app_project_context",
        "appProjectContext",
        "project_context",
        "projectContext",
    ):
        value = kwargs.get(key)
        if isinstance(value, Mapping):
            return dict(value)

    return {}


def _route_hints_for_chunk_context(context: Mapping[str, Any]) -> dict[str, str]:
    api_prefix = _normalize_route_path(
        context.get("apiBaseUrl") or context.get("browserBaseUrl") or _DEFAULT_CHUNK_BROWSER_BASE_URL,
        _DEFAULT_CHUNK_BROWSER_BASE_URL,
    )

    project_id = _safe_identifier(
        context.get("chunkProjectId")
        or context.get("chunk_project_id")
        or context.get("projectId")
        or context.get("project_id"),
        _DEFAULT_CHUNK_PROJECT_ID,
    )

    universe_id = _safe_identifier(
        context.get("chunkUniverseId")
        or context.get("chunk_universe_id")
        or context.get("universeId")
        or context.get("universe_id"),
        "",
    )

    world_id = _safe_identifier(
        context.get("chunkWorldId")
        or context.get("chunk_world_id")
        or context.get("worldId")
        or context.get("world_id"),
        _DEFAULT_CHUNK_WORLD_ID,
    )

    project_base = _join_route_path(api_prefix, "projects", project_id)
    world_base = _join_route_path(project_base, "worlds", world_id)

    return {
        "apiBaseUrl": api_prefix,
        "browserBaseUrl": api_prefix,
        "status": _join_route_path(api_prefix, "_status"),
        "testConnection": _join_route_path(api_prefix, "_test", "connection"),
        "placeableBlocks": _join_route_path(api_prefix, "placeable-blocks"),
        "projects": _join_route_path(api_prefix, "projects"),
        "project": project_base,
        "projectBootstrap": _join_route_path(project_base, "bootstrap"),
        "bootstrap": _join_route_path(project_base, "bootstrap"),
        "universes": _join_route_path(project_base, "universes"),
        "universe": _join_route_path(project_base, "universes", universe_id) if universe_id else "",
        "worlds": _join_route_path(project_base, "worlds"),
        "world": world_base,
        "blocks": _join_route_path(world_base, "blocks"),
        "chunk": _join_route_path(world_base, "chunks"),
        "chunks": _join_route_path(world_base, "chunks"),
        "chunksBatch": _join_route_path(world_base, "chunks", "batch"),
        "commands": _join_route_path(world_base, "commands"),
        "defaultBlocks": _join_route_path(api_prefix, "blocks"),
        "defaultChunk": _join_route_path(api_prefix, "chunks"),
        "defaultChunksBatch": _join_route_path(api_prefix, "chunks", "batch"),
        "defaultCommands": _join_route_path(api_prefix, "commands"),
    }


def _build_app_chunk_context(
    *,
    config_source: Any = None,
    source_context: Mapping[str, Any] | None = None,
    fallback_active: bool = False,
    fallback_reason: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Build normalized App/Chunk context.

    Priority:
    1. Explicit chunk_context/app_project_context passed by routes.editor.
    2. request_args/query args passed by routes.editor.
    3. Existing source_context/template context.
    4. config/env defaults.
    """
    explicit = _explicit_chunk_context_from_kwargs(kwargs)
    request_args = _request_args_from_kwargs(kwargs)
    source = source_context if isinstance(source_context, Mapping) else {}

    existing_chunk = {}
    try:
        existing_chunk = dict(
            source.get("chunk_context")
            or source.get("chunkContext")
            or source.get("chunk")
            or source.get("chunk_config")
            or {}
        )
    except Exception:
        existing_chunk = {}

    browser_base_url = _normalize_route_path(
        _first_text(
            explicit.get("apiBaseUrl"),
            explicit.get("browserBaseUrl"),
            _mapping_get(request_args, "chunk_api_base_url", "chunkApiBaseUrl", "apiBaseUrl"),
            _mapping_get(request_args, "chunk_browser_base_url", "chunkBrowserBaseUrl", "browserBaseUrl"),
            existing_chunk.get("apiBaseUrl"),
            existing_chunk.get("browserBaseUrl"),
            _config_first(
                config_source,
                _DEFAULT_CHUNK_BROWSER_BASE_URL,
                "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
                "EDITOR_CHUNK_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_API_PREFIX",
                "EDITOR_CHUNK_API_PREFIX",
            ),
        ),
        _DEFAULT_CHUNK_BROWSER_BASE_URL,
    )

    app_project_public_id = _first_identifier(
        explicit.get("appProjectPublicId"),
        explicit.get("app_project_public_id"),
        explicit.get("appProjectId"),
        explicit.get("app_project_id"),
        explicit.get("projectPublicId"),
        explicit.get("project_public_id"),
        _mapping_get(request_args, "app_project_public_id", "appProjectPublicId"),
        _mapping_get(request_args, "app_project_id", "appProjectId"),
        _mapping_get(request_args, "project_public_id", "projectPublicId"),
        existing_chunk.get("appProjectPublicId"),
        existing_chunk.get("app_project_public_id"),
        _config_first(
            config_source,
            "",
            "EDITOR_APP_PROJECT_PUBLIC_ID",
            "VECTOPLAN_EDITOR_APP_PROJECT_PUBLIC_ID",
            "VECTOPLAN_APP_PROJECT_PUBLIC_ID",
        ),
    )

    chunk_project_id = _first_identifier(
        explicit.get("chunkProjectId"),
        explicit.get("chunk_project_id"),
        explicit.get("projectId"),
        explicit.get("project_id"),
        _mapping_get(request_args, "chunk_project_id", "chunkProjectId"),
        _mapping_get(request_args, "project_id", "projectId"),
        existing_chunk.get("chunkProjectId"),
        existing_chunk.get("chunk_project_id"),
        existing_chunk.get("projectId"),
        _config_first(
            config_source,
            _DEFAULT_CHUNK_PROJECT_ID,
            "EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "EDITOR_CHUNK_PROJECT_ID",
            "VECTOPLAN_EDITOR_CHUNK_PROJECT_ID",
            "EDITOR_DEFAULT_PROJECT_ID",
            "VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID",
            "VECTOPLAN_CHUNK_DEFAULT_PROJECT_ID",
        ),
        default=_DEFAULT_CHUNK_PROJECT_ID,
    )

    chunk_universe_id = _first_identifier(
        explicit.get("chunkUniverseId"),
        explicit.get("chunk_universe_id"),
        explicit.get("universeId"),
        explicit.get("universe_id"),
        _mapping_get(request_args, "chunk_universe_id", "chunkUniverseId"),
        _mapping_get(request_args, "universe_id", "universeId"),
        existing_chunk.get("chunkUniverseId"),
        existing_chunk.get("chunk_universe_id"),
        existing_chunk.get("universeId"),
        _config_first(
            config_source,
            "",
            "EDITOR_CHUNK_SERVICE_UNIVERSE_ID",
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_UNIVERSE_ID",
            "EDITOR_CHUNK_UNIVERSE_ID",
            "VECTOPLAN_EDITOR_CHUNK_UNIVERSE_ID",
            "EDITOR_DEFAULT_UNIVERSE_ID",
            "VECTOPLAN_EDITOR_DEFAULT_UNIVERSE_ID",
            "VECTOPLAN_CHUNK_DEFAULT_UNIVERSE_ID",
        ),
    )

    chunk_world_id = _first_identifier(
        explicit.get("chunkWorldId"),
        explicit.get("chunk_world_id"),
        explicit.get("worldId"),
        explicit.get("world_id"),
        _mapping_get(request_args, "chunk_world_id", "chunkWorldId"),
        _mapping_get(request_args, "world_id", "worldId"),
        existing_chunk.get("chunkWorldId"),
        existing_chunk.get("chunk_world_id"),
        existing_chunk.get("worldId"),
        _config_first(
            config_source,
            _DEFAULT_CHUNK_WORLD_ID,
            "EDITOR_CHUNK_SERVICE_WORLD_ID",
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_WORLD_ID",
            "EDITOR_CHUNK_WORLD_ID",
            "VECTOPLAN_EDITOR_CHUNK_WORLD_ID",
            "EDITOR_DEFAULT_WORLD_ID",
            "VECTOPLAN_EDITOR_DEFAULT_WORLD_ID",
            "VECTOPLAN_CHUNK_DEFAULT_WORLD_ID",
            "VECTOPLAN_CHUNK_DEFAULT_INSTANCE_WORLD_ID",
        ),
        default=_DEFAULT_CHUNK_WORLD_ID,
    )

    status = _chunk_status(
        _first_text(
            explicit.get("status"),
            explicit.get("chunkStatus"),
            explicit.get("chunk_status"),
            _mapping_get(request_args, "chunk_status", "chunkStatus"),
            existing_chunk.get("status"),
            existing_chunk.get("chunkStatus"),
            existing_chunk.get("chunk_status"),
            _config_first(
                config_source,
                "ready" if chunk_project_id and chunk_world_id else "pending",
                "EDITOR_CHUNK_CONTEXT_STATUS",
                "VECTOPLAN_EDITOR_CHUNK_CONTEXT_STATUS",
                "VECTOPLAN_EDITOR_CHUNK_STATUS",
            ),
        ),
        "ready" if chunk_project_id and chunk_world_id else "pending",
    )

    ready = _coerce_bool(
        _first_text(
            explicit.get("ready"),
            explicit.get("chunkReady"),
            explicit.get("chunk_ready"),
            _mapping_get(request_args, "chunk_ready", "chunkReady"),
            existing_chunk.get("ready"),
            existing_chunk.get("chunkReady"),
            existing_chunk.get("chunk_ready"),
            _config_first(
                config_source,
                bool(chunk_project_id and chunk_world_id and status == "ready"),
                "EDITOR_CHUNK_CONTEXT_READY",
                "VECTOPLAN_EDITOR_CHUNK_CONTEXT_READY",
                "VECTOPLAN_EDITOR_CHUNK_READY",
            ),
        ),
        bool(chunk_project_id and chunk_world_id and status == "ready"),
    )

    if not chunk_project_id or not chunk_world_id:
        ready = False

    if ready and status not in {"error", "disabled"}:
        status = "ready"

    context = {
        "appProjectPublicId": app_project_public_id,
        "projectPublicId": app_project_public_id,
        "app_project_public_id": app_project_public_id,
        "project_public_id": app_project_public_id,
        "chunkProjectId": chunk_project_id,
        "chunk_project_id": chunk_project_id,
        "chunkUniverseId": chunk_universe_id,
        "chunk_universe_id": chunk_universe_id,
        "chunkWorldId": chunk_world_id,
        "chunk_world_id": chunk_world_id,
        "projectId": chunk_project_id,
        "project_id": chunk_project_id,
        "universeId": chunk_universe_id,
        "universe_id": chunk_universe_id,
        "worldId": chunk_world_id,
        "world_id": chunk_world_id,
        "status": status,
        "chunkStatus": status,
        "chunk_status": status,
        "ready": ready,
        "chunkReady": ready,
        "chunk_ready": ready,
        "apiBaseUrl": browser_base_url,
        "browserBaseUrl": browser_base_url,
        "source": "query" if request_args else "context" if explicit else "config",
        "queryOverridesDefaults": True,
        "fallbackActive": bool(fallback_active),
        "fallbackReason": fallback_reason,
    }
    context["routeHints"] = _route_hints_for_chunk_context(context)
    context["route_hints"] = context["routeHints"]

    return context


def _patch_chunk_config(value: Any, chunk_context: Mapping[str, Any]) -> dict[str, Any]:
    config = _safe_deepcopy(value) if isinstance(value, Mapping) else {}
    if not isinstance(config, dict):
        config = {}

    browser_base_url = _normalize_route_path(
        config.get("browserBaseUrl")
        or config.get("apiBaseUrl")
        or chunk_context.get("browserBaseUrl")
        or _DEFAULT_CHUNK_BROWSER_BASE_URL,
        _DEFAULT_CHUNK_BROWSER_BASE_URL,
    )

    patched_context = dict(chunk_context)
    patched_context["browserBaseUrl"] = browser_base_url
    patched_context["apiBaseUrl"] = browser_base_url
    route_hints = _route_hints_for_chunk_context(patched_context)

    config.update(
        {
            "enabled": _coerce_bool(config.get("enabled"), True),
            "mode": _coerce_text(config.get("mode"), "editor-proxy"),
            "sourceKind": _coerce_text(config.get("sourceKind"), "vectoplan-chunk"),
            "apiBaseUrl": browser_base_url,
            "browserBaseUrl": browser_base_url,
            "appProjectPublicId": _coerce_text(chunk_context.get("appProjectPublicId"), ""),
            "projectPublicId": _coerce_text(chunk_context.get("projectPublicId"), ""),
            "projectId": _coerce_text(chunk_context.get("chunkProjectId"), _DEFAULT_CHUNK_PROJECT_ID),
            "universeId": _coerce_text(chunk_context.get("chunkUniverseId"), ""),
            "worldId": _coerce_text(chunk_context.get("chunkWorldId"), _DEFAULT_CHUNK_WORLD_ID),
            "chunkProjectId": _coerce_text(chunk_context.get("chunkProjectId"), _DEFAULT_CHUNK_PROJECT_ID),
            "chunkUniverseId": _coerce_text(chunk_context.get("chunkUniverseId"), ""),
            "chunkWorldId": _coerce_text(chunk_context.get("chunkWorldId"), _DEFAULT_CHUNK_WORLD_ID),
            "chunkStatus": _coerce_text(chunk_context.get("status"), "pending"),
            "chunkReady": _coerce_bool(chunk_context.get("ready"), False),
            "context": dict(chunk_context),
            "routeHints": route_hints,
        }
    )

    return config


def _patch_project_payload(value: Any, chunk_context: Mapping[str, Any]) -> dict[str, Any]:
    project = _safe_deepcopy(value) if isinstance(value, Mapping) else {}
    if not isinstance(project, dict):
        project = {}

    project.update(
        {
            "appProjectPublicId": _coerce_text(chunk_context.get("appProjectPublicId"), ""),
            "projectPublicId": _coerce_text(chunk_context.get("projectPublicId"), ""),
            "projectId": _coerce_text(chunk_context.get("chunkProjectId"), _DEFAULT_CHUNK_PROJECT_ID),
            "universeId": _coerce_text(chunk_context.get("chunkUniverseId"), ""),
            "worldId": _coerce_text(chunk_context.get("chunkWorldId"), _DEFAULT_CHUNK_WORLD_ID),
            "chunkProjectId": _coerce_text(chunk_context.get("chunkProjectId"), _DEFAULT_CHUNK_PROJECT_ID),
            "chunkUniverseId": _coerce_text(chunk_context.get("chunkUniverseId"), ""),
            "chunkWorldId": _coerce_text(chunk_context.get("chunkWorldId"), _DEFAULT_CHUNK_WORLD_ID),
            "chunkStatus": _coerce_text(chunk_context.get("status"), "pending"),
            "chunkReady": _coerce_bool(chunk_context.get("ready"), False),
            "chunk": dict(chunk_context),
            "context": dict(chunk_context),
        }
    )

    return project


def _patch_runtime_payload(value: Any, chunk_context: Mapping[str, Any]) -> dict[str, Any]:
    runtime = _safe_deepcopy(value) if isinstance(value, Mapping) else {}
    if not isinstance(runtime, dict):
        runtime = {}

    runtime["chunk"] = _patch_chunk_config(runtime.get("chunk"), chunk_context)
    runtime["chunkContext"] = dict(chunk_context)

    feature_flags = runtime.get("featureFlags")
    if not isinstance(feature_flags, dict):
        feature_flags = {}

    feature_flags.update(
        {
            "chunkServiceEnabled": True,
            "appProjectContextEnabled": True,
            "queryChunkContextOverridesDefaults": True,
        }
    )

    runtime["featureFlags"] = feature_flags

    return runtime


def _patch_bootstrap_payload_with_chunk_context(
    payload: Any,
    chunk_context: Mapping[str, Any],
) -> dict[str, Any]:
    patched = _safe_deepcopy(payload) if isinstance(payload, Mapping) else {}
    if not isinstance(patched, dict):
        patched = {}

    patched["project"] = _patch_project_payload(patched.get("project"), chunk_context)
    patched["runtime"] = _patch_runtime_payload(patched.get("runtime"), chunk_context)
    patched["chunk"] = _patch_chunk_config(patched.get("chunk"), chunk_context)
    patched["chunkContext"] = dict(chunk_context)

    feature_flags = patched.get("featureFlags")
    if not isinstance(feature_flags, dict):
        feature_flags = {}

    feature_flags.update(
        {
            "chunkServiceEnabled": True,
            "appProjectContextEnabled": True,
            "queryChunkContextOverridesDefaults": True,
        }
    )

    patched["featureFlags"] = feature_flags

    return patched


def _patch_root_dataset_with_chunk_context(value: Any, chunk_context: Mapping[str, Any]) -> dict[str, str]:
    dataset = {str(key): str(item) for key, item in dict(value or {}).items()} if isinstance(value, Mapping) else {}

    dataset.update(
        {
            "app-project-public-id": _coerce_text(chunk_context.get("appProjectPublicId"), ""),
            "project-public-id": _coerce_text(chunk_context.get("projectPublicId"), ""),
            "chunk-project-id": _coerce_text(chunk_context.get("chunkProjectId"), ""),
            "chunk-universe-id": _coerce_text(chunk_context.get("chunkUniverseId"), ""),
            "chunk-world-id": _coerce_text(chunk_context.get("chunkWorldId"), ""),
            "chunk-status": _coerce_text(chunk_context.get("status"), "pending"),
            "chunk-ready": "true" if _coerce_bool(chunk_context.get("ready"), False) else "false",
            "chunk-service-project-id": _coerce_text(chunk_context.get("chunkProjectId"), ""),
            "chunk-service-universe-id": _coerce_text(chunk_context.get("chunkUniverseId"), ""),
            "chunk-service-world-id": _coerce_text(chunk_context.get("chunkWorldId"), ""),
            "chunk-service-api-base-url": _coerce_text(chunk_context.get("apiBaseUrl"), _DEFAULT_CHUNK_BROWSER_BASE_URL),
            "chunk-service-browser-base-url": _coerce_text(chunk_context.get("browserBaseUrl"), _DEFAULT_CHUNK_BROWSER_BASE_URL),
            "chunk-query-overrides-defaults": "true",
        }
    )

    return dataset


def _patch_template_context_with_chunk_context(
    context: Any,
    *,
    config_source: Any = None,
    source_context: Mapping[str, Any] | None = None,
    fallback_active: bool = False,
    fallback_reason: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    patched = _safe_deepcopy(context) if isinstance(context, Mapping) else {}
    if not isinstance(patched, dict):
        patched = {}

    chunk_context = _build_app_chunk_context(
        config_source=config_source,
        source_context=source_context or patched,
        fallback_active=fallback_active,
        fallback_reason=fallback_reason,
        **kwargs,
    )

    patched["chunk_context"] = dict(chunk_context)
    patched["chunkContext"] = dict(chunk_context)
    patched["chunk"] = _patch_chunk_config(patched.get("chunk") or patched.get("chunk_config"), chunk_context)
    patched["chunk_config"] = patched["chunk"]
    patched["chunk_proxy"] = _patch_chunk_config(patched.get("chunk_proxy"), chunk_context)
    patched["chunk_route_hints"] = dict(chunk_context.get("routeHints") or {})
    patched["chunk_enabled"] = _coerce_bool(patched["chunk"].get("enabled"), True)
    patched["chunk_api_base_url"] = patched["chunk"].get("apiBaseUrl")
    patched["chunk_browser_base_url"] = patched["chunk"].get("browserBaseUrl")

    patched["app_project_public_id"] = chunk_context.get("appProjectPublicId")
    patched["project_public_id"] = chunk_context.get("projectPublicId")
    patched["chunk_project_id"] = chunk_context.get("chunkProjectId")
    patched["chunk_universe_id"] = chunk_context.get("chunkUniverseId")
    patched["chunk_world_id"] = chunk_context.get("chunkWorldId")
    patched["chunk_status"] = chunk_context.get("status")
    patched["chunk_ready"] = _coerce_bool(chunk_context.get("ready"), False)

    patched["project"] = _patch_project_payload(patched.get("project"), chunk_context)
    patched["root_dataset_values"] = _patch_root_dataset_with_chunk_context(patched.get("root_dataset_values"), chunk_context)

    bootstrap_payload = patched.get("bootstrap_payload") or patched.get("editor_bootstrap_payload")
    bootstrap_payload = _patch_bootstrap_payload_with_chunk_context(bootstrap_payload, chunk_context)

    patched["bootstrap_payload"] = bootstrap_payload
    patched["editor_bootstrap_payload"] = bootstrap_payload

    bootstrap_json = _safe_script_json(_json_dumps(bootstrap_payload))
    patched["bootstrap_payload_json"] = bootstrap_json
    patched["editor_bootstrap_payload_json"] = bootstrap_json
    patched["editor_bootstrap_json"] = bootstrap_json

    return patched


# =============================================================================
# Lazy Import
# =============================================================================

@lru_cache(maxsize=64)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    normalized = _normalize_text(module_name, "")
    if not normalized:
        return ()

    parts = normalized.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_target_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=32)
def _import_module(module_name: str) -> ModuleType:
    return importlib.import_module(module_name)


def _load_module_by_key(key: str, *, required: bool = True) -> ModuleType | None:
    module_name = _MODULE_NAMES.get(key)

    if not module_name:
        raise RuntimeError(f"Unbekannter Bootstrap-Modul-Key: {key!r}")

    try:
        return _import_module(module_name)
    except ModuleNotFoundError as exc:
        if _is_missing_target_module(exc, module_name):
            if not required:
                return None

            raise RuntimeError(f"Das Bootstrap-Modul `{module_name}` wurde nicht gefunden.") from exc

        raise RuntimeError(
            f"Das Bootstrap-Modul `{module_name}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {getattr(exc, 'name', None)!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Das Bootstrap-Modul `{module_name}` konnte nicht importiert werden.") from exc


def _resolve_attribute_from_module_key(
    key: str,
    name: str,
    *,
    required: bool = True,
) -> Any | None:
    module = _load_module_by_key(key, required=required)

    if module is None:
        return None

    try:
        return getattr(module, name)
    except AttributeError as exc:
        if not required:
            return None

        raise RuntimeError(f"Das Attribut `{name}` fehlt in `{_MODULE_NAMES[key]}`.") from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Attribut `{name}` aus `{_MODULE_NAMES[key]}` konnte nicht gelesen werden."
        ) from exc


def _resolve_callable_from_module_key(
    key: str,
    name: str,
    *,
    required: bool = True,
) -> Callable[..., Any] | None:
    candidate = _resolve_attribute_from_module_key(key, name, required=required)

    if candidate is None:
        return None

    if not callable(candidate):
        if not required:
            return None

        raise RuntimeError(f"Das Attribut `{name}` in `{_MODULE_NAMES[key]}` ist nicht aufrufbar.")

    return candidate


def _call_flexible(function: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    """
    Ruft eine Funktion robust auf.

    Reihenfolge:
    1. args + kwargs
    2. nur kwargs
    3. nach Signatur gefilterte kwargs
    4. nur args
    5. parameterlos
    """
    first_error: Exception | None = None

    attempts: list[Callable[[], Any]] = [
        lambda: function(*args, **kwargs),
        lambda: function(**kwargs),
    ]

    try:
        signature = inspect.signature(function)
        parameters = signature.parameters

        accepts_var_kwargs = any(
            parameter.kind == inspect.Parameter.VAR_KEYWORD
            for parameter in parameters.values()
        )

        if not accepts_var_kwargs:
            filtered_kwargs = {
                key: value
                for key, value in kwargs.items()
                if key in parameters
            }
            attempts.append(lambda: function(*args, **filtered_kwargs))
            attempts.append(lambda: function(**filtered_kwargs))
    except Exception:
        pass

    attempts.extend(
        [
            lambda: function(*args),
            lambda: function(),
        ]
    )

    for attempt in attempts:
        try:
            return attempt()
        except TypeError as exc:
            if first_error is None:
                first_error = exc
            continue
        except Exception:
            raise

    if first_error is not None:
        raise first_error

    raise RuntimeError("Callable konnte nicht aufgerufen werden.")


def _call_first_available(
    key: str,
    function_names: tuple[str, ...],
    *,
    required: bool = False,
    fallback: Any = None,
    args: tuple[Any, ...] = (),
    kwargs: Mapping[str, Any] | None = None,
) -> Any:
    call_kwargs = dict(kwargs or {})

    for function_name in function_names:
        function = _resolve_callable_from_module_key(key, function_name, required=False)
        if callable(function):
            try:
                return _call_flexible(function, *args, **call_kwargs)
            except Exception:
                LOGGER.exception(
                    "Bootstrap submodule call failed: module=%s function=%s.",
                    key,
                    function_name,
                )
                if required:
                    raise

    if required:
        raise RuntimeError(
            f"Keine der erwarteten Funktionen in `{key}` ist verfügbar: {', '.join(function_names)}"
        )

    return _safe_deepcopy(fallback)


# =============================================================================
# Lokale Fallbacks
# =============================================================================

def _build_local_chunk_route_hints(config_source: Any, **kwargs: Any) -> dict[str, str]:
    context = _build_app_chunk_context(config_source=config_source, **kwargs)
    return _route_hints_for_chunk_context(context)


def _build_local_chunk_settings(config_source: Any, **kwargs: Any) -> dict[str, Any]:
    context = _build_app_chunk_context(config_source=config_source, **kwargs)
    route_hints = _route_hints_for_chunk_context(context)

    return {
        "enabled": _coerce_bool(
            _config_first(
                config_source,
                True,
                "EDITOR_CHUNK_SERVICE_ENABLED",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED",
                "EDITOR_CHUNK_ENABLED",
                "VECTOPLAN_EDITOR_CHUNK_ENABLED",
            ),
            True,
        ),
        "mode": _coerce_text(
            _config_first(
                config_source,
                "editor-proxy",
                "EDITOR_CHUNK_SERVICE_MODE",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_MODE",
                "EDITOR_CHUNK_MODE",
                "VECTOPLAN_EDITOR_CHUNK_MODE",
            ),
            "editor-proxy",
        ),
        "sourceKind": _coerce_text(
            _config_first(
                config_source,
                "vectoplan-chunk",
                "EDITOR_CHUNK_SERVICE_SOURCE_KIND",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_SOURCE_KIND",
                "EDITOR_CHUNK_SOURCE_KIND",
                "VECTOPLAN_EDITOR_CHUNK_SOURCE_KIND",
            ),
            "vectoplan-chunk",
        ),
        "apiBaseUrl": route_hints["apiBaseUrl"],
        "browserBaseUrl": route_hints["apiBaseUrl"],
        "appProjectPublicId": context["appProjectPublicId"],
        "projectPublicId": context["projectPublicId"],
        "projectId": context["chunkProjectId"],
        "universeId": context["chunkUniverseId"],
        "worldId": context["chunkWorldId"],
        "chunkProjectId": context["chunkProjectId"],
        "chunkUniverseId": context["chunkUniverseId"],
        "chunkWorldId": context["chunkWorldId"],
        "chunkStatus": context["status"],
        "chunkReady": context["ready"],
        "context": context,
        "registryId": "debug-blocks",
        "registryVersion": "1",
        "routeHints": route_hints,
        "requestTimeoutMs": _coerce_int(
            _config_first(config_source, 10000, "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS"),
            10000,
        ),
        "commandTimeoutMs": _coerce_int(
            _config_first(config_source, 15000, "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS"),
            15000,
        ),
        "batchTimeoutMs": _coerce_int(
            _config_first(config_source, 20000, "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS"),
            20000,
        ),
        "statusTimeoutMs": _coerce_int(
            _config_first(config_source, 5000, "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS"),
            5000,
        ),
        "preferBatchLoad": True,
        "reloadDirtyChunksAfterCommand": True,
        "maxBatchChunks": 256,
        "allowGenerated": True,
        "preferSnapshot": True,
    }


def _build_local_placeable_blocks() -> list[dict[str, Any]]:
    return []


def _build_local_inventory_palette() -> list[dict[str, Any]]:
    blocks = _build_local_placeable_blocks()
    slots: list[dict[str, Any]] = []

    for index, block in enumerate(blocks):
        slots.append(
            {
                "slotIndex": index,
                "slotKey": f"slot_{index}",
                "empty": False,
                "enabled": True,
                "selected": index == 0,
                "itemId": f"block_{block['blockTypeId']}",
                "itemKind": "block",
                "kind": "block",
                "type": "block",
                "blockTypeId": block["blockTypeId"],
                "label": block["label"],
                "placeable": True,
                "breakable": True,
                "stackSize": 64,
                "maxStackSize": 64,
            }
        )

    for index in range(len(slots), 9):
        slots.append(
            {
                "slotIndex": index,
                "slotKey": f"slot_{index}",
                "empty": True,
                "enabled": True,
                "selected": False,
                "itemId": None,
                "itemKind": None,
                "kind": "empty",
                "type": "empty",
                "blockTypeId": None,
                "label": "",
                "placeable": False,
                "breakable": False,
                "stackSize": 0,
                "maxStackSize": 64,
            }
        )

    return slots


def _build_local_editor_bootstrap_payload(
    *,
    config_source: Any = None,
    source_context: Mapping[str, Any] | None = None,
    fallback_active: bool = False,
    fallback_reason: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    chunk_context = _build_app_chunk_context(
        config_source=config_source,
        source_context=source_context,
        fallback_active=fallback_active,
        fallback_reason=fallback_reason,
        **kwargs,
    )
    chunk = _build_local_chunk_settings(config_source, source_context=source_context, **kwargs)

    runtime = {
        "mode": _coerce_text(
            _config_first(config_source, "remote_chunk_service", "EDITOR_RUNTIME_MODE", "VECTOPLAN_EDITOR_RUNTIME_MODE"),
            "remote_chunk_service",
        ),
        "worldMode": "chunk_service",
        "sourceMode": "chunk-service",
        "chunk": chunk,
        "chunkContext": chunk_context,
        "camera": {
            "spawn": {
                "x": _coerce_float(_config_first(config_source, 8.0, "EDITOR_RUNTIME_SPAWN_X", "VECTOPLAN_EDITOR_RUNTIME_SPAWN_X"), 8.0),
                "y": _coerce_float(_config_first(config_source, 8.0, "EDITOR_RUNTIME_SPAWN_Y", "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Y"), 8.0),
                "z": _coerce_float(_config_first(config_source, 18.0, "EDITOR_RUNTIME_SPAWN_Z", "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Z"), 18.0),
            },
            "moveSpeed": 5.5,
            "sprintMultiplier": 1.8,
            "lookSensitivity": 0.0025,
            "playerHeight": 1.8,
        },
        "inventory": {
            "enabled": True,
            "source": "vectoplan-user-inventory",
            "hotbarSize": 9,
            "selectedSlot": 0,
            "defaultBlockTypeId": "",
            "items": _build_local_inventory_palette(),
            "placeableBlocks": [],
        },
        "featureFlags": {
            "chunkServiceEnabled": True,
            "appProjectContextEnabled": True,
            "queryChunkContextOverridesDefaults": True,
            "localWorldFallbackEnabled": False,
            "legacyFrontendEnabled": False,
            "pointerLockEnabled": True,
            "firstPersonEnabled": True,
            "debugOverlayEnabled": True,
            "crosshairEnabled": True,
            "hotbarEnabled": True,
            "statusBarEnabled": True,
            "loadingOverlayEnabled": True,
            "errorPanelEnabled": True,
        },
    }

    payload: dict[str, Any] = {
        "ok": True,
        "service": {
            "name": "vectoplan-editor",
            "displayName": "VECTOPLAN Editor",
            "version": "0.1.0",
        },
        "kind": "editor-bootstrap",
        "schemaVersion": "editor-bootstrap.v1",
        "source": "src.bootstrap.local-fallback",
        "packageVersion": BOOTSTRAP_PACKAGE_VERSION,
        "build": {
            "mode": "development",
            "version": "dev",
        },
        "project": _patch_project_payload({}, chunk_context),
        "runtime": runtime,
        "chunk": chunk,
        "chunkContext": chunk_context,
        "featureFlags": runtime["featureFlags"],
        "fallback": {
            "active": bool(fallback_active),
            "reason": fallback_reason,
        },
    }

    if source_context:
        payload["context"] = {
            "hasSourceContext": True,
            "fallbackActive": bool(source_context.get("fallback_active", False)),
        }

    return _patch_bootstrap_payload_with_chunk_context(payload, chunk_context)


def _build_local_assets_template_context(config_source: Any = None) -> dict[str, Any]:
    fallback_js = _coerce_text(
        _config_first(config_source, "", "FALLBACK_STATIC_JS", "VECTOPLAN_EDITOR_FALLBACK_STATIC_JS"),
        "",
    )
    fallback_css = _coerce_text(
        _config_first(config_source, "", "FALLBACK_STATIC_CSS", "VECTOPLAN_EDITOR_FALLBACK_STATIC_CSS"),
        "",
    )

    js = [fallback_js] if fallback_js else []
    css = [fallback_css] if fallback_css else []

    return {
        "ok": bool(js),
        "source": "local-fallback",
        "js": js,
        "css": css,
        "preload": [],
        "files": [],
        "warnings": [] if js else ["No Vite manifest asset resolver available and no fallback JS configured."],
        "errors": [],
        "manifest_found": False,
        "manifest_loaded": False,
        "fallback_used": True,
    }


def _build_local_editor_template_context(
    *,
    config_source: Any = None,
    static_url_builder: Callable[[str], str] | None = None,
    include_bootstrap_payload: bool = True,
    include_assets: bool = True,
    fallback_active: bool = False,
    fallback_reason: str | None = None,
    source_context: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    chunk_context = _build_app_chunk_context(
        config_source=config_source,
        source_context=source_context,
        fallback_active=fallback_active,
        fallback_reason=fallback_reason,
        **kwargs,
    )
    chunk = _build_local_chunk_settings(config_source, source_context=source_context, **kwargs)

    context: dict[str, Any] = {
        "app_name": "vectoplan-editor",
        "app_display_name": "VECTOPLAN Editor",
        "service_version": "0.1.0",
        "build_mode": "development",
        "build_version": "dev",
        "page_title": _coerce_text(_config_first(config_source, "VECTOPLAN Editor", "EDITOR_PAGE_TITLE", "VECTOPLAN_EDITOR_PAGE_TITLE"), "VECTOPLAN Editor"),
        "brand_name": _coerce_text(_config_first(config_source, "VECTOPLAN Editor", "EDITOR_BRAND_NAME", "VECTOPLAN_EDITOR_BRAND_NAME"), "VECTOPLAN Editor"),
        "editor_route_path": "/editor",
        "editor_template_name": "editor/index.html",
        "editor_template_mode": "chunk_service_viewport",
        "runtime_mode": "remote_chunk_service",
        "world_mode": "chunk_service",
        "source_mode": "chunk-service",
        "initial_status": "Initialisierung...",
        "runtime_loading_status": "Editor wird geladen...",
        "runtime_ready_status": "Editor bereit",
        "runtime_error_status": "Editor konnte nicht gestartet werden",
        "viewport_placeholder": "3D-Viewport wird aufgebaut.",
        "pointer_lock_title": "First-Person-Modus",
        "pointer_lock_message": "Klicke in den Viewport, um die Maus zu sperren und dich im Raum zu bewegen.",
        "pointer_lock_hint": "W A S D bewegen · Maus schauen · Linksklick setzen · Rechtsklick entfernen · ESC löst den Mausfang.",
        "chunk": chunk,
        "chunk_config": chunk,
        "chunk_context": chunk_context,
        "chunkContext": chunk_context,
        "chunk_proxy": {
            "enabled": chunk["enabled"],
            "internalBaseUrl": _coerce_text(
                _config_first(config_source, "http://vectoplan-chunk:5000", "EDITOR_CHUNK_SERVICE_BASE_URL", "VECTOPLAN_EDITOR_CHUNK_SERVICE_BASE_URL", "VECTOPLAN_CHUNK_INTERNAL_URL"),
                "http://vectoplan-chunk:5000",
            ),
            "browserBaseUrl": chunk["browserBaseUrl"],
            "apiPrefix": chunk["apiBaseUrl"],
            "projectId": chunk["projectId"],
            "universeId": chunk["universeId"],
            "worldId": chunk["worldId"],
            "chunkProjectId": chunk["chunkProjectId"],
            "chunkUniverseId": chunk["chunkUniverseId"],
            "chunkWorldId": chunk["chunkWorldId"],
            "routeHints": chunk["routeHints"],
            "context": chunk_context,
        },
        "chunk_route_hints": dict(chunk["routeHints"]),
        "chunk_enabled": bool(chunk["enabled"]),
        "chunk_api_base_url": chunk["apiBaseUrl"],
        "chunk_browser_base_url": chunk["browserBaseUrl"],
        "app_project_public_id": chunk_context["appProjectPublicId"],
        "project_public_id": chunk_context["projectPublicId"],
        "chunk_project_id": chunk_context["chunkProjectId"],
        "chunk_universe_id": chunk_context["chunkUniverseId"],
        "chunk_world_id": chunk_context["chunkWorldId"],
        "chunk_status": chunk_context["status"],
        "chunk_ready": chunk_context["ready"],
        "chunk_mode": chunk["mode"],
        "chunk_source_kind": chunk["sourceKind"],
        "project": _patch_project_payload({}, chunk_context),
        "feature_flags": {
            "chunkServiceEnabled": True,
            "appProjectContextEnabled": True,
            "queryChunkContextOverridesDefaults": True,
            "localWorldFallbackEnabled": False,
            "legacyFrontendEnabled": False,
            "pointerLockEnabled": True,
            "firstPersonEnabled": True,
            "debugOverlayEnabled": True,
            "crosshairEnabled": True,
            "hotbarEnabled": True,
            "statusBarEnabled": True,
            "loadingOverlayEnabled": True,
            "errorPanelEnabled": True,
        },
        "root_dataset_values": _patch_root_dataset_with_chunk_context(
            {
                "editor-root": "true",
                "editor-runtime-mode": "remote_chunk_service",
                "editor-world-mode": "chunk_service",
                "editor-source-mode": "chunk-service",
                "chunk-service-enabled": "true",
                "chunk-service-api-base-url": chunk["apiBaseUrl"],
                "chunk-service-browser-base-url": chunk["browserBaseUrl"],
                "chunk-service-project-id": chunk["projectId"],
                "chunk-service-universe-id": chunk["universeId"],
                "chunk-service-world-id": chunk["worldId"],
                "chunk-service-source-kind": chunk["sourceKind"],
                "chunk-service-mode": chunk["mode"],
            },
            chunk_context,
        ),
        "placeable_blocks": _build_local_placeable_blocks(),
        "inventory_default_palette": _build_local_inventory_palette(),
        "fallback_active": bool(fallback_active),
        "fallback_reason": fallback_reason,
    }

    if include_assets:
        context["editor_assets"] = _build_local_assets_template_context(config_source)
    else:
        context["editor_assets"] = {
            "ok": False,
            "source": "disabled",
            "js": [],
            "css": [],
            "preload": [],
        }

    if include_bootstrap_payload:
        payload = _build_local_editor_bootstrap_payload(
            config_source=config_source,
            source_context=context,
            fallback_active=fallback_active,
            fallback_reason=fallback_reason,
            **kwargs,
        )
        context["editor_bootstrap_payload"] = payload
        context["editor_bootstrap_payload_json"] = _safe_script_json(_json_dumps(payload))
        context["editor_bootstrap_json"] = context["editor_bootstrap_payload_json"]
        context["bootstrap_payload"] = payload
        context["bootstrap_payload_json"] = context["editor_bootstrap_payload_json"]

    if source_context:
        context["source_context_available"] = True

    return _patch_template_context_with_chunk_context(
        context,
        config_source=config_source,
        source_context=source_context,
        fallback_active=fallback_active,
        fallback_reason=fallback_reason,
        **kwargs,
    )


# =============================================================================
# Defaults API
# =============================================================================

def _call_defaults(function_names: tuple[str, ...], *args: Any, fallback: Any = None, **kwargs: Any) -> Any:
    return _call_first_available(
        "defaults",
        function_names,
        fallback=fallback,
        args=args,
        kwargs=kwargs,
    )


def get_editor_bootstrap_defaults(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(
        (
            "get_editor_bootstrap_defaults",
            "get_editor_bootstrap_default_values",
            "build_editor_bootstrap_defaults",
        ),
        *args,
        fallback=None,
        **kwargs,
    )
    if isinstance(result, Mapping):
        return _patch_template_context_with_chunk_context(dict(result), **kwargs)
    return _build_local_editor_template_context(config_source=kwargs.get("config_source"), include_bootstrap_payload=False, **kwargs)


def get_editor_bootstrap_default_values(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return get_editor_bootstrap_defaults(*args, **kwargs)


def build_editor_bootstrap_defaults(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return get_editor_bootstrap_defaults(*args, **kwargs)


def get_default_editor_template_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(("get_default_editor_template_context",), *args, fallback=None, **kwargs)
    if isinstance(result, Mapping):
        return _patch_template_context_with_chunk_context(dict(result), **kwargs)
    return _build_local_editor_template_context(config_source=kwargs.get("config_source"), include_bootstrap_payload=False, **kwargs)


def get_default_editor_payload_seed_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(("get_default_editor_payload_seed_context",), *args, fallback=None, **kwargs)
    if isinstance(result, Mapping):
        return _patch_template_context_with_chunk_context(dict(result), **kwargs)
    return _build_local_editor_template_context(config_source=kwargs.get("config_source"), include_bootstrap_payload=False, **kwargs)


def get_default_chunk_service_route_hints(*args: Any, **kwargs: Any) -> dict[str, str]:
    result = _call_defaults(
        (
            "get_default_chunk_service_route_hints",
            "build_default_chunk_route_hints",
        ),
        *args,
        fallback=None,
        **kwargs,
    )
    if isinstance(result, Mapping):
        context = _build_app_chunk_context(source_context={"chunk": dict(result)}, **kwargs)
        return _route_hints_for_chunk_context(context)
    return _build_local_chunk_route_hints(kwargs.get("config_source"), **kwargs)


def build_default_chunk_route_hints(*args: Any, **kwargs: Any) -> dict[str, str]:
    return get_default_chunk_service_route_hints(*args, **kwargs)


def get_default_chunk_service_config(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(
        (
            "get_default_chunk_service_config",
            "build_default_chunk_service_config",
        ),
        *args,
        fallback=None,
        **kwargs,
    )
    context = _build_app_chunk_context(source_context={"chunk": result} if isinstance(result, Mapping) else None, **kwargs)
    if isinstance(result, Mapping):
        return _patch_chunk_config(dict(result), context)
    return _build_local_chunk_settings(kwargs.get("config_source"), **kwargs)


def build_default_chunk_service_config(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return get_default_chunk_service_config(*args, **kwargs)


def get_default_chunk_proxy_config(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(("get_default_chunk_proxy_config",), *args, fallback=None, **kwargs)
    context = _build_app_chunk_context(source_context={"chunk": result} if isinstance(result, Mapping) else None, **kwargs)

    if isinstance(result, Mapping):
        return _patch_chunk_config(dict(result), context)

    chunk = _build_local_chunk_settings(kwargs.get("config_source"), **kwargs)
    return {
        "enabled": chunk["enabled"],
        "internalBaseUrl": _coerce_text(
            _config_first(kwargs.get("config_source"), "http://vectoplan-chunk:5000", "EDITOR_CHUNK_SERVICE_BASE_URL", "VECTOPLAN_CHUNK_INTERNAL_URL"),
            "http://vectoplan-chunk:5000",
        ),
        "browserBaseUrl": chunk["browserBaseUrl"],
        "apiPrefix": chunk["apiBaseUrl"],
        "projectId": chunk["projectId"],
        "universeId": chunk["universeId"],
        "worldId": chunk["worldId"],
        "chunkProjectId": chunk["chunkProjectId"],
        "chunkUniverseId": chunk["chunkUniverseId"],
        "chunkWorldId": chunk["chunkWorldId"],
        "routeHints": chunk["routeHints"],
        "context": chunk["context"],
    }


def get_default_runtime_feature_flags(*args: Any, **kwargs: Any) -> dict[str, bool]:
    result = _call_defaults(("get_default_runtime_feature_flags",), *args, fallback=None, **kwargs)
    if isinstance(result, Mapping):
        flags = {str(key): bool(value) for key, value in result.items()}
    else:
        flags = {
            "chunkServiceEnabled": True,
            "localWorldFallbackEnabled": False,
            "legacyFrontendEnabled": False,
            "pointerLockEnabled": True,
            "firstPersonEnabled": True,
            "debugOverlayEnabled": True,
            "crosshairEnabled": True,
            "hotbarEnabled": True,
            "statusBarEnabled": True,
            "loadingOverlayEnabled": True,
            "errorPanelEnabled": True,
        }

    flags["appProjectContextEnabled"] = True
    flags["queryChunkContextOverridesDefaults"] = True
    return flags


def get_default_root_dataset_values(*args: Any, **kwargs: Any) -> dict[str, str]:
    result = _call_defaults(("get_default_root_dataset_values",), *args, fallback=None, **kwargs)

    if isinstance(result, Mapping):
        base = {str(key): str(value) for key, value in result.items() if value is not None}
    else:
        chunk = _build_local_chunk_settings(kwargs.get("config_source"), **kwargs)
        base = {
            "editor-root": "true",
            "editor-runtime-mode": "remote_chunk_service",
            "editor-world-mode": "chunk_service",
            "editor-source-mode": "chunk-service",
            "chunk-service-enabled": "true",
            "chunk-service-api-base-url": chunk["apiBaseUrl"],
            "chunk-service-browser-base-url": chunk["browserBaseUrl"],
            "chunk-service-project-id": chunk["projectId"],
            "chunk-service-world-id": chunk["worldId"],
            "chunk-service-source-kind": chunk["sourceKind"],
            "chunk-service-mode": chunk["mode"],
        }

    context = _build_app_chunk_context(source_context={"root_dataset_values": base}, **kwargs)
    return _patch_root_dataset_with_chunk_context(base, context)


def get_default_editor_bootstrap_payload(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(("get_default_editor_bootstrap_payload",), *args, fallback=None, **kwargs)
    context = _build_app_chunk_context(source_context={"bootstrap_payload": result} if isinstance(result, Mapping) else None, **kwargs)

    if isinstance(result, Mapping):
        return _patch_bootstrap_payload_with_chunk_context(dict(result), context)

    return _build_local_editor_bootstrap_payload(config_source=kwargs.get("config_source"), **kwargs)


def get_default_placeable_blocks(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
    result = _call_defaults(("get_default_placeable_blocks",), *args, fallback=None, **kwargs)
    if isinstance(result, list):
        return [dict(item) for item in result if isinstance(item, Mapping)]
    return _build_local_placeable_blocks()


def get_default_inventory_palette(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
    result = _call_defaults(("get_default_inventory_palette",), *args, fallback=None, **kwargs)
    if isinstance(result, list):
        return [dict(item) for item in result if isinstance(item, Mapping)]
    return _build_local_inventory_palette()


def get_default_inventory_palette_tuple(*args: Any, **kwargs: Any) -> tuple[Mapping[str, Any], ...]:
    return tuple(get_default_inventory_palette(*args, **kwargs))


def get_default_inventory_slot(slot_index: int = 0, *args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(("get_default_inventory_slot",), slot_index, *args, fallback=None, **kwargs)
    if isinstance(result, Mapping):
        return dict(result)

    palette = get_default_inventory_palette()
    index = max(0, min(int(slot_index), len(palette) - 1))
    return dict(palette[index])


def get_default_block_world_config(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(("get_default_block_world_config",), *args, fallback=None, **kwargs)
    if isinstance(result, Mapping):
        return dict(result)
    return {
        "enabled": False,
        "mode": "legacy_local_block_world",
        "legacy": True,
        "truthOwner": "vectoplan-chunk",
    }


def get_default_block_world_hotbar_block_type_ids(*args: Any, **kwargs: Any) -> list[str]:
    result = _call_defaults(("get_default_block_world_hotbar_block_type_ids",), *args, fallback=None, **kwargs)
    if isinstance(result, (list, tuple)):
        return [str(item) for item in result]
    return []


def get_editor_defaults_module_metadata(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_defaults(("get_editor_defaults_module_metadata",), *args, fallback=None, **kwargs)
    if isinstance(result, Mapping):
        metadata = dict(result)
    else:
        metadata = {
            "moduleName": _DEFAULTS_MODULE_NAME,
            "moduleVersion": None,
            "fallback": True,
        }

    metadata["appChunkContextFacadeVersion"] = BOOTSTRAP_PACKAGE_VERSION
    return metadata


# =============================================================================
# Assets API
# =============================================================================

def get_editor_assets(*args: Any, **kwargs: Any) -> Any:
    result = _call_first_available(
        "assets",
        ("get_editor_assets",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )
    if result is not None:
        return result
    return _build_local_assets_template_context(kwargs.get("app_config") or kwargs.get("config_source"))


def get_editor_asset_settings(*args: Any, **kwargs: Any) -> Any:
    result = _call_first_available(
        "assets",
        ("get_editor_asset_settings",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )
    return result


def resolve_editor_assets(*args: Any, **kwargs: Any) -> Any:
    result = _call_first_available(
        "assets",
        ("resolve_editor_assets",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )
    return result


def build_editor_assets_template_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_first_available(
        "assets",
        ("build_editor_assets_template_context",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )
    if isinstance(result, Mapping):
        return dict(result)
    return _build_local_assets_template_context(kwargs.get("app_config") or kwargs.get("config_source"))


def clear_asset_caches() -> None:
    function = _resolve_callable_from_module_key("assets", "clear_asset_caches", required=False)
    if callable(function):
        try:
            function()
        except Exception:
            LOGGER.exception("assets.clear_asset_caches failed.")


# =============================================================================
# Payload API
# =============================================================================

def build_editor_bootstrap_payload(
    *args: Any,
    config_source: Any = None,
    source_context: Mapping[str, Any] | None = None,
    fallback_active: bool = False,
    fallback_reason: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    result = _call_first_available(
        "payload",
        (
            "build_editor_bootstrap_payload",
            "build_bootstrap_payload",
            "create_editor_bootstrap_payload",
        ),
        fallback=None,
        args=args,
        kwargs={
            "config_source": config_source,
            "source_context": source_context,
            "fallback_active": fallback_active,
            "fallback_reason": fallback_reason,
            **kwargs,
        },
    )

    chunk_context = _build_app_chunk_context(
        config_source=config_source,
        source_context=source_context,
        fallback_active=fallback_active,
        fallback_reason=fallback_reason,
        **kwargs,
    )

    if isinstance(result, Mapping):
        return _patch_bootstrap_payload_with_chunk_context(dict(result), chunk_context)

    return _build_local_editor_bootstrap_payload(
        config_source=config_source,
        source_context=source_context,
        fallback_active=fallback_active,
        fallback_reason=fallback_reason,
        **kwargs,
    )


def build_fallback_editor_bootstrap_payload(
    *args: Any,
    reason: str = "fallback-active",
    config_source: Any = None,
    source_context: Mapping[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    result = _call_first_available(
        "payload",
        ("build_fallback_editor_bootstrap_payload",),
        fallback=None,
        args=args,
        kwargs={
            "reason": reason,
            "config_source": config_source,
            "source_context": source_context,
            **kwargs,
        },
    )

    chunk_context = _build_app_chunk_context(
        config_source=config_source,
        source_context=source_context,
        fallback_active=True,
        fallback_reason=reason,
        **kwargs,
    )

    if isinstance(result, Mapping):
        return _patch_bootstrap_payload_with_chunk_context(dict(result), chunk_context)

    return _build_local_editor_bootstrap_payload(
        config_source=config_source,
        source_context=source_context,
        fallback_active=True,
        fallback_reason=reason,
        **kwargs,
    )


def build_bootstrap_payload(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_editor_bootstrap_payload(*args, **kwargs)


def create_editor_bootstrap_payload(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_editor_bootstrap_payload(*args, **kwargs)


def create_bootstrap_payload(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_editor_bootstrap_payload(*args, **kwargs)


def normalize_editor_bootstrap_payload(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_first_available(
        "payload",
        ("normalize_editor_bootstrap_payload",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )

    chunk_context = _build_app_chunk_context(**kwargs)

    if isinstance(result, Mapping):
        return _patch_bootstrap_payload_with_chunk_context(dict(result), chunk_context)

    payload = args[0] if args else kwargs.get("payload")
    if isinstance(payload, Mapping):
        return _patch_bootstrap_payload_with_chunk_context(dict(payload), chunk_context)

    return build_editor_bootstrap_payload(**kwargs)


def serialize_editor_bootstrap_payload(*args: Any, **kwargs: Any) -> str:
    result = _call_first_available(
        "payload",
        (
            "serialize_editor_bootstrap_payload",
            "serialize_bootstrap_payload",
            "dumps_editor_bootstrap_payload",
            "dumps_bootstrap_payload",
        ),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )

    payload = args[0] if args else kwargs.get("payload")

    if isinstance(payload, Mapping):
        patched_payload = normalize_editor_bootstrap_payload(payload, **kwargs)
        return _safe_script_json(_json_dumps(patched_payload))

    if isinstance(result, str):
        try:
            parsed = json.loads(result)
            if isinstance(parsed, Mapping):
                patched = normalize_editor_bootstrap_payload(parsed, **kwargs)
                return _safe_script_json(_json_dumps(patched))
        except Exception:
            return _safe_script_json(result)

    return _safe_script_json(_json_dumps(build_editor_bootstrap_payload(**kwargs)))


def serialize_bootstrap_payload(*args: Any, **kwargs: Any) -> str:
    return serialize_editor_bootstrap_payload(*args, **kwargs)


def dumps_editor_bootstrap_payload(*args: Any, **kwargs: Any) -> str:
    return serialize_editor_bootstrap_payload(*args, **kwargs)


def dumps_bootstrap_payload(*args: Any, **kwargs: Any) -> str:
    return serialize_editor_bootstrap_payload(*args, **kwargs)


def get_default_editor_bootstrap_payload_seed(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_first_available(
        "payload",
        ("get_default_editor_bootstrap_payload_seed",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )

    chunk_context = _build_app_chunk_context(**kwargs)

    if isinstance(result, Mapping):
        return _patch_bootstrap_payload_with_chunk_context(dict(result), chunk_context)

    return build_editor_bootstrap_payload(**kwargs)


def get_editor_bootstrap_payload_metadata(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_first_available(
        "payload",
        ("get_editor_bootstrap_payload_metadata",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )
    if isinstance(result, Mapping):
        metadata = dict(result)
    else:
        metadata = {
            "moduleName": _PAYLOAD_MODULE_NAME,
            "moduleVersion": None,
            "fallback": True,
        }

    metadata["appChunkContextFacadeVersion"] = BOOTSTRAP_PACKAGE_VERSION
    return metadata


# =============================================================================
# Context API
# =============================================================================

def build_editor_template_context(
    *args: Any,
    config_source: Any = None,
    static_url_builder: Callable[[str], str] | None = None,
    include_bootstrap_payload: bool = True,
    include_assets: bool = True,
    **kwargs: Any,
) -> dict[str, Any]:
    result = _call_first_available(
        "context",
        (
            "build_editor_template_context",
            "build_editor_context",
            "create_editor_template_context",
            "create_editor_context",
        ),
        fallback=None,
        args=args,
        kwargs={
            "config_source": config_source,
            "static_url_builder": static_url_builder,
            "include_bootstrap_payload": include_bootstrap_payload,
            "include_assets": include_assets,
            **kwargs,
        },
    )

    if isinstance(result, Mapping):
        return _patch_template_context_with_chunk_context(
            dict(result),
            config_source=config_source,
            source_context=dict(result),
            **kwargs,
        )

    return _build_local_editor_template_context(
        config_source=config_source,
        static_url_builder=static_url_builder,
        include_bootstrap_payload=include_bootstrap_payload,
        include_assets=include_assets,
        **kwargs,
    )


def build_fallback_editor_template_context(
    *args: Any,
    reason: str = "fallback-active",
    source_context: Mapping[str, Any] | None = None,
    config_source: Any = None,
    static_url_builder: Callable[[str], str] | None = None,
    include_bootstrap_payload: bool = True,
    include_assets: bool = True,
    **kwargs: Any,
) -> dict[str, Any]:
    result = _call_first_available(
        "context",
        (
            "build_fallback_editor_template_context",
            "build_fallback_editor_context",
            "create_fallback_editor_template_context",
            "create_fallback_editor_context",
        ),
        fallback=None,
        args=args,
        kwargs={
            "reason": reason,
            "source_context": source_context,
            "config_source": config_source,
            "static_url_builder": static_url_builder,
            "include_bootstrap_payload": include_bootstrap_payload,
            "include_assets": include_assets,
            **kwargs,
        },
    )

    if isinstance(result, Mapping):
        return _patch_template_context_with_chunk_context(
            dict(result),
            config_source=config_source,
            source_context=source_context or dict(result),
            fallback_active=True,
            fallback_reason=reason,
            **kwargs,
        )

    return _build_local_editor_template_context(
        config_source=config_source,
        static_url_builder=static_url_builder,
        include_bootstrap_payload=include_bootstrap_payload,
        include_assets=include_assets,
        fallback_active=True,
        fallback_reason=reason,
        source_context=source_context,
        **kwargs,
    )


def build_editor_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_editor_template_context(*args, **kwargs)


def create_editor_template_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_editor_template_context(*args, **kwargs)


def create_editor_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_editor_template_context(*args, **kwargs)


def build_fallback_editor_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_fallback_editor_template_context(*args, **kwargs)


def create_fallback_editor_template_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_fallback_editor_template_context(*args, **kwargs)


def create_fallback_editor_context(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return build_fallback_editor_template_context(*args, **kwargs)


def get_editor_context_module_metadata(*args: Any, **kwargs: Any) -> dict[str, Any]:
    result = _call_first_available(
        "context",
        ("get_editor_context_module_metadata",),
        fallback=None,
        args=args,
        kwargs=kwargs,
    )
    if isinstance(result, Mapping):
        metadata = dict(result)
    else:
        metadata = {
            "moduleName": _CONTEXT_MODULE_NAME,
            "moduleVersion": None,
            "fallback": True,
        }

    metadata["appChunkContextFacadeVersion"] = BOOTSTRAP_PACKAGE_VERSION
    metadata["contextPatchInjectsChunkContext"] = True
    return metadata


# =============================================================================
# Startup API
# =============================================================================

def _resolve_startup_public_attribute(name: str) -> Any:
    if name not in _STARTUP_PUBLIC_EXPORTS:
        raise AttributeError(f"`src.bootstrap` exportiert kein Startup-Attribut namens `{name}`.")

    return _resolve_attribute_from_module_key("startup", name, required=True)


def _resolve_startup_callable(name: str) -> Callable[..., Any]:
    candidate = _resolve_startup_public_attribute(name)
    if not callable(candidate):
        raise RuntimeError(f"Das Attribut `{name}` in `{_STARTUP_MODULE_NAME}` ist nicht aufrufbar.")
    return candidate


def get_default_path_check_specs() -> tuple["PathCheckSpec", ...]:
    return _resolve_startup_callable("get_default_path_check_specs")()


def get_default_file_check_specs() -> tuple["FileCheckSpec", ...]:
    return _resolve_startup_callable("get_default_file_check_specs")()


def get_default_path_check_spec_data() -> list[dict[str, Any]]:
    return _resolve_startup_callable("get_default_path_check_spec_data")()


def get_default_file_check_spec_data() -> list[dict[str, Any]]:
    return _resolve_startup_callable("get_default_file_check_spec_data")()


def run_startup(app: "Flask") -> Any:
    return _resolve_startup_callable("run_startup")(app)


def bootstrap_app(app: "Flask") -> Any:
    return _resolve_startup_callable("bootstrap_app")(app)


def initialize_app(app: "Flask") -> Any:
    return _resolve_startup_callable("initialize_app")(app)


def get_startup_state(app: "Flask") -> dict[str, Any]:
    return _resolve_startup_callable("get_startup_state")(app)


def get_startup_summary(app: "Flask") -> dict[str, Any]:
    return _resolve_startup_callable("get_startup_summary")(app)


# =============================================================================
# Metadata / Cache
# =============================================================================

def get_editor_bootstrap_package_metadata(*, check_imports: bool = True) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "ok": True,
        "package": __name__,
        "version": BOOTSTRAP_PACKAGE_VERSION,
        "modules": {},
        "startupExports": list(_STARTUP_PUBLIC_EXPORTS),
        "defaultsExports": list(_DEFAULTS_PUBLIC_EXPORTS),
        "assetsExports": list(_ASSETS_PUBLIC_EXPORTS),
        "payloadExports": list(_PAYLOAD_PUBLIC_EXPORTS),
        "contextExports": list(_CONTEXT_PUBLIC_EXPORTS),
        "appChunkContext": {
            "enabled": True,
            "facadePatchVersion": BOOTSTRAP_PACKAGE_VERSION,
            "contextPatchInjectsChunkContext": True,
            "payloadPatchInjectsChunkContext": True,
            "queryOverridesDefaults": True,
        },
    }

    expected_by_key = {
        "startup": _STARTUP_PUBLIC_EXPORTS,
        "defaults": _DEFAULTS_PUBLIC_EXPORTS,
        "assets": _ASSETS_PUBLIC_EXPORTS,
        "payload": _PAYLOAD_PUBLIC_EXPORTS,
        "context": _CONTEXT_PUBLIC_EXPORTS,
    }

    for key, module_name in _MODULE_NAMES.items():
        entry: dict[str, Any] = {
            "moduleName": module_name,
            "importable": None,
            "file": None,
            "error": None,
        }

        if check_imports:
            try:
                module = _load_module_by_key(key, required=False)
                entry["importable"] = module is not None
                entry["file"] = getattr(module, "__file__", None) if module is not None else None

                if module is not None:
                    expected = expected_by_key.get(key, ())
                    entry["availableExports"] = sorted(name for name in expected if hasattr(module, name))
                    entry["missingExports"] = sorted(name for name in expected if not hasattr(module, name))
            except Exception as exc:
                metadata["ok"] = False
                entry["importable"] = False
                entry["error"] = {
                    "type": type(exc).__name__,
                    "message": str(exc),
                }

        metadata["modules"][key] = entry

    return metadata


def clear_editor_bootstrap_package_caches() -> dict[str, Any]:
    cleared: dict[str, Any] = {
        "package": __name__,
        "version": BOOTSTRAP_PACKAGE_VERSION,
        "localCaches": [],
        "submoduleCaches": {},
    }

    with _CACHE_LOCK:
        for cached_function in (
            _candidate_missing_names,
            _import_module,
        ):
            try:
                cached_function.cache_clear()  # type: ignore[attr-defined]
                cleared["localCaches"].append(getattr(cached_function, "__name__", repr(cached_function)))
            except Exception:
                pass

    clearers = (
        "clear_editor_bootstrap_package_caches",
        "clear_bootstrap_caches",
        "clear_defaults_caches",
        "clear_asset_caches",
        "clear_payload_caches",
        "clear_context_caches",
        "clear_startup_caches",
    )

    for key in sorted(_MODULE_NAMES):
        try:
            module = _load_module_by_key(key, required=False)
        except Exception as exc:
            cleared["submoduleCaches"][key] = {
                "ok": False,
                "error": {
                    "type": type(exc).__name__,
                    "message": str(exc),
                },
            }
            continue

        if module is None:
            cleared["submoduleCaches"][key] = {
                "ok": True,
                "skipped": "module-not-available",
            }
            continue

        called: list[str] = []

        for clearer_name in clearers:
            if key == "startup" and clearer_name == "clear_editor_bootstrap_package_caches":
                continue

            candidate = getattr(module, clearer_name, None)
            if callable(candidate):
                try:
                    candidate()
                    called.append(clearer_name)
                except Exception:
                    LOGGER.exception("Cache clearer %s failed in module %s.", clearer_name, _MODULE_NAMES[key])

        cleared["submoduleCaches"][key] = {
            "ok": True,
            "called": called,
        }

    cleared["ok"] = True
    return cleared


# =============================================================================
# Lazy Attribute
# =============================================================================

_LAZY_EXPORT_MAP: Final[dict[str, str]] = {
    **{name: "startup" for name in _STARTUP_PUBLIC_EXPORTS},
    **{name: "defaults" for name in _DEFAULTS_PUBLIC_EXPORTS},
    **{name: "assets" for name in _ASSETS_PUBLIC_EXPORTS},
    **{name: "payload" for name in _PAYLOAD_PUBLIC_EXPORTS},
    **{name: "context" for name in _CONTEXT_PUBLIC_EXPORTS},
}


def __getattr__(name: str) -> Any:
    if name in globals():
        return globals()[name]

    module_key = _LAZY_EXPORT_MAP.get(name)
    if module_key is not None:
        return _resolve_attribute_from_module_key(module_key, name, required=True)

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    default_dir = set(globals().keys())
    default_dir.update(_PUBLIC_EXPORTS)
    return sorted(default_dir)


__all__ = list(_PUBLIC_EXPORTS)