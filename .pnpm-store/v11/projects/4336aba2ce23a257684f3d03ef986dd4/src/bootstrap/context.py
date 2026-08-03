# services/vectoplan-editor/src/bootstrap/context.py
from __future__ import annotations

import copy
import importlib
import json
import logging
import os
from collections.abc import Callable, Mapping
from functools import lru_cache
from types import MappingProxyType
from typing import Any, Final

try:
    from flask import current_app, has_app_context, has_request_context, url_for
except Exception:  # pragma: no cover - erlaubt Import ohne Flask-Kontext
    current_app = None  # type: ignore[assignment]

    def has_app_context() -> bool:  # type: ignore[override]
        return False

    def has_request_context() -> bool:  # type: ignore[override]
        return False

    def url_for(*args: Any, **kwargs: Any) -> str:  # type: ignore[override]
        raise RuntimeError("Flask url_for ist nicht verfügbar.")


try:
    from . import defaults as _defaults
except Exception:  # pragma: no cover - erlaubt isolierte Tooling-Imports
    _defaults = None


LOGGER = logging.getLogger(__name__)


# =============================================================================
# Modulmetadaten
# =============================================================================

CONTEXT_MODULE_NAME: Final[str] = "src.bootstrap.context"
CONTEXT_VERSION: Final[str] = "0.5.0"

_CONTEXT_PACKAGE_NAME: Final[str] = (__package__ or "src.bootstrap").rstrip(".")

_PAYLOAD_MODULE_CANDIDATES: Final[tuple[str, ...]] = (
    "src.bootstrap.payload",
    ".payload",
)

_ASSETS_MODULE_CANDIDATES: Final[tuple[str, ...]] = (
    "src.bootstrap.assets",
    ".assets",
)

_TRUE_VALUES: Final[set[str]] = {"1", "true", "t", "yes", "y", "on", "enabled"}
_FALSE_VALUES: Final[set[str]] = {"0", "false", "f", "no", "n", "off", "disabled"}

_DEFAULT_EDITOR_ROUTE_PATH: Final[str] = "/editor"
_DEFAULT_EDITOR_TEMPLATE_NAME: Final[str] = "editor/index.html"
_DEFAULT_STATIC_EDITOR_URL_PREFIX: Final[str] = "/static/editor"
_DEFAULT_CHUNK_API_PREFIX: Final[str] = "/editor/api/chunk"
_DEFAULT_CHUNK_PROJECT_ID: Final[str] = "dev-project"
_DEFAULT_CHUNK_WORLD_ID: Final[str] = "world_spawn"


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


def _safe_json_loads(value: Any, default: Any) -> Any:
    if not isinstance(value, str):
        return default

    try:
        return json.loads(value)
    except Exception:
        return default


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


def _safe_json_dumps(
    value: Any,
    fallback: str = "{}",
    *,
    compact: bool = True,
    sort_keys: bool = False,
) -> str:
    try:
        return json.dumps(
            _json_safe(value),
            ensure_ascii=False,
            separators=(",", ":") if compact else None,
            sort_keys=sort_keys,
            default=str,
        )
    except Exception:
        return fallback


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


def _safe_deepcopy(value: Any) -> Any:
    try:
        return copy.deepcopy(value)
    except Exception:
        try:
            return json.loads(json.dumps(value, ensure_ascii=False, default=str))
        except Exception:
            return value


def _safe_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _safe_mapping_proxy(value: Mapping[str, Any]) -> Mapping[str, Any]:
    try:
        return MappingProxyType(dict(value))
    except Exception:
        try:
            return dict(value)
        except Exception:
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


def _safe_shallow_context_merge(
    base: dict[str, Any],
    override: Mapping[str, Any] | None,
) -> dict[str, Any]:
    result = _safe_deepcopy(base)

    if not isinstance(result, dict):
        try:
            result = dict(base)
        except Exception:
            result = {}

    if not isinstance(override, Mapping):
        return result

    for key, value in override.items():
        normalized_key = _normalize_text(key)
        if not normalized_key:
            continue
        result[normalized_key] = value

    return result


def _normalize_text_list(value: Any, default: tuple[str, ...] = ()) -> list[str]:
    if isinstance(value, str):
        parsed = _safe_json_loads(value, None)
        if isinstance(parsed, (list, tuple)):
            value = parsed
        else:
            value = value.split(",")

    if not isinstance(value, (list, tuple, set)):
        value = default

    result: list[str] = []
    seen: set[str] = set()

    for item in value:
        normalized = _normalize_text(item)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)

    return result


# =============================================================================
# Config-Zugriff
# =============================================================================

def _resolve_active_config_source(config_source: Any | None = None) -> Any:
    if config_source is not None:
        return config_source

    try:
        if has_app_context() and current_app is not None:
            return current_app.config
    except Exception:
        pass

    return {}


def _safe_get_config_value(config_source: Any, key: str, default: Any = None) -> Any:
    normalized_key = _normalize_text(key)
    if not normalized_key:
        return default

    source = _resolve_active_config_source(config_source)

    try:
        if isinstance(source, Mapping):
            return source.get(normalized_key, default)
    except Exception:
        pass

    try:
        nested_config = getattr(source, "config", None)
        if isinstance(nested_config, Mapping):
            return nested_config.get(normalized_key, default)
    except Exception:
        pass

    try:
        return getattr(source, normalized_key, default)
    except Exception:
        return default


def _resolve_first_config_value(
    config_source: Any,
    default: Any,
    *keys: str,
) -> Any:
    for key in keys:
        value = _safe_get_config_value(config_source, key, None)
        if value not in {None, ""}:
            return value
    return default


def _resolve_first_env_or_config(
    config_source: Any,
    default: Any,
    *keys: str,
) -> Any:
    config_value = _resolve_first_config_value(config_source, None, *keys)
    if config_value not in {None, ""}:
        return config_value

    for key in keys:
        try:
            value = os.environ.get(key)
        except Exception:
            value = None

        if value not in {None, ""}:
            return value

    return default


# =============================================================================
# Static-URL-Helfer
# =============================================================================

def _safe_static_url_from_builder(
    filename: str,
    static_url_builder: Callable[..., str] | None = None,
) -> str | None:
    if not callable(static_url_builder):
        return None

    clean_filename = _coerce_text(filename, "").lstrip("/")
    if not clean_filename:
        return None

    builder = static_url_builder

    for attempt in (
        lambda: builder(clean_filename),
        lambda: builder(filename=clean_filename),
        lambda: builder("static", filename=clean_filename),
    ):
        try:
            result = attempt()
            normalized = _normalize_text(result)
            if normalized:
                return normalized
        except Exception:
            continue

    return None


def _safe_static_url(
    filename: str,
    static_url_builder: Callable[..., str] | None = None,
) -> str:
    clean_filename = _coerce_text(filename, "").lstrip("/")
    if not clean_filename:
        return "/static/"

    built_from_callback = _safe_static_url_from_builder(
        clean_filename,
        static_url_builder=static_url_builder,
    )
    if built_from_callback:
        return built_from_callback

    try:
        if has_request_context() or has_app_context():
            return url_for("static", filename=clean_filename)
    except Exception:
        pass

    return f"/static/{clean_filename}"


# =============================================================================
# Lazy Import: payload.py / assets.py
# =============================================================================

@lru_cache(maxsize=16)
def _resolve_import_target(candidate: str, package_name: str) -> tuple[str, str | None, str]:
    normalized = _coerce_text(candidate, "")

    if not normalized:
        return package_name, None, package_name

    if normalized.startswith("."):
        canonical_name = f"{package_name}{normalized}"
        return normalized, package_name, canonical_name

    return normalized, None, normalized


@lru_cache(maxsize=32)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    parts = module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_candidate_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


def _import_first_available_module(candidates: tuple[str, ...]) -> Any | None:
    for candidate in candidates:
        import_name, package_name, canonical_name = _resolve_import_target(
            candidate,
            _CONTEXT_PACKAGE_NAME,
        )

        try:
            if package_name:
                return importlib.import_module(import_name, package=package_name)
            return importlib.import_module(import_name)
        except ModuleNotFoundError as exc:
            if _is_missing_candidate_module(exc, canonical_name):
                continue
            raise RuntimeError(
                f"Das Modul `{canonical_name}` konnte nicht geladen werden, weil eine innere Abhängigkeit fehlt: "
                f"{getattr(exc, 'name', None)!r}."
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"Das Modul `{canonical_name}` konnte nicht geladen werden.") from exc

    return None


@lru_cache(maxsize=1)
def _resolve_payload_callables() -> tuple[Callable[..., Any] | None, Callable[..., Any] | None]:
    module = _import_first_available_module(_PAYLOAD_MODULE_CANDIDATES)

    if module is None:
        return None, None

    payload_builder = None
    payload_serializer = None

    for export_name in (
        "build_editor_bootstrap_payload",
        "build_bootstrap_payload",
        "create_editor_bootstrap_payload",
    ):
        candidate = getattr(module, export_name, None)
        if callable(candidate):
            payload_builder = candidate
            break

    for export_name in (
        "serialize_editor_bootstrap_payload",
        "serialize_bootstrap_payload",
        "dumps_editor_bootstrap_payload",
    ):
        candidate = getattr(module, export_name, None)
        if callable(candidate):
            payload_serializer = candidate
            break

    return payload_builder, payload_serializer


@lru_cache(maxsize=1)
def _resolve_assets_callables() -> tuple[Callable[..., Any] | None, Callable[..., Any] | None]:
    module = _import_first_available_module(_ASSETS_MODULE_CANDIDATES)

    if module is None:
        return None, None

    get_assets = getattr(module, "get_editor_assets", None)
    build_template_context = getattr(module, "build_editor_assets_template_context", None)

    return (
        get_assets if callable(get_assets) else None,
        build_template_context if callable(build_template_context) else None,
    )


# =============================================================================
# Context-Bausteine
# =============================================================================

def _build_base_context() -> dict[str, Any]:
    fallback = {
        "app_name": "vectoplan-editor",
        "app_display_name": "VECTOPLAN Editor",
        "service_version": "0.1.0",
        "build_mode": "development",
        "build_version": "dev",
        "page_title": "VECTOPLAN Editor",
        "brand_name": "VECTOPLAN Editor",
        "editor_route_path": "/editor",
        "editor_template_name": "editor/index.html",
        "editor_template_mode": "chunk_service_viewport",
        "runtime_mode": "remote_chunk_service",
        "world_mode": "chunk_service",
        "source_mode": "chunk-service",
        "chunk": _default_call("get_default_chunk_service_config", {}, include_internal=False),
        "chunk_proxy": _default_call("get_default_chunk_proxy_config", {}),
        "chunk_route_hints": _default_call("get_default_chunk_service_route_hints", {}),
        "feature_flags": _default_call("get_default_runtime_feature_flags", {}),
        "root_dataset_values": _default_call("get_default_root_dataset_values", {}),
        "inventory_default_palette": _default_call("get_default_inventory_palette", []),
        "placeable_blocks": _default_call("get_default_placeable_blocks", []),
        "block_world_default_config": _default_call("get_default_block_world_config", {}),
    }

    default_context = _default_call("get_default_editor_template_context", fallback)

    if not isinstance(default_context, Mapping):
        default_context = fallback

    return _deep_merge_dicts(fallback, default_context)


def _apply_identity_context(context: dict[str, Any], config_source: Any) -> None:
    context["app_name"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("app_name"), "APP_NAME", "VECTOPLAN_EDITOR_APP_NAME"),
        "vectoplan-editor",
    )
    context["app_display_name"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("app_display_name"), "APP_DISPLAY_NAME", "VECTOPLAN_EDITOR_APP_DISPLAY_NAME"),
        "VECTOPLAN Editor",
    )
    context["service_version"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("service_version"), "SERVICE_VERSION", "VECTOPLAN_EDITOR_SERVICE_VERSION"),
        "0.1.0",
    )
    context["build_mode"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("build_mode"), "BUILD_MODE", "VECTOPLAN_EDITOR_BUILD_MODE"),
        "development",
    )
    context["build_version"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("build_version"), "BUILD_VERSION", "VECTOPLAN_EDITOR_BUILD_VERSION"),
        "dev",
    )


def _apply_editor_shell_context(context: dict[str, Any], config_source: Any) -> None:
    context["page_title"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("page_title"), "EDITOR_PAGE_TITLE", "VECTOPLAN_EDITOR_PAGE_TITLE"),
        "VECTOPLAN Editor",
    )
    context["brand_name"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("brand_name"), "EDITOR_BRAND_NAME", "VECTOPLAN_EDITOR_BRAND_NAME"),
        "VECTOPLAN Editor",
    )
    context["editor_route_path"] = _normalize_route_path(
        _resolve_first_env_or_config(config_source, context.get("editor_route_path"), "EDITOR_ROUTE_PATH", "VECTOPLAN_EDITOR_ROUTE_PATH"),
        _DEFAULT_EDITOR_ROUTE_PATH,
    )
    context["editor_template_name"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("editor_template_name"), "EDITOR_TEMPLATE_NAME", "VECTOPLAN_EDITOR_TEMPLATE_NAME"),
        _DEFAULT_EDITOR_TEMPLATE_NAME,
    )
    context["editor_template_mode"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("editor_template_mode"), "EDITOR_TEMPLATE_MODE", "VECTOPLAN_EDITOR_TEMPLATE_MODE"),
        "chunk_service_viewport",
    )
    context["runtime_mode"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("runtime_mode"), "EDITOR_RUNTIME_MODE", "VECTOPLAN_EDITOR_RUNTIME_MODE"),
        "remote_chunk_service",
    )
    context["world_mode"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("world_mode"), "EDITOR_WORLD_MODE", "VECTOPLAN_EDITOR_WORLD_MODE"),
        "chunk_service",
    )
    context["source_mode"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("source_mode"), "EDITOR_SOURCE_MODE", "VECTOPLAN_EDITOR_SOURCE_MODE"),
        "chunk-service",
    )


def _apply_text_context(context: dict[str, Any], config_source: Any) -> None:
    mapping = {
        "initial_status": ("EDITOR_STATUS_INITIAL", "VECTOPLAN_EDITOR_STATUS_INITIAL"),
        "runtime_loading_status": ("EDITOR_STATUS_LOADING", "VECTOPLAN_EDITOR_STATUS_LOADING"),
        "runtime_ready_status": ("EDITOR_STATUS_READY", "VECTOPLAN_EDITOR_STATUS_READY"),
        "runtime_error_status": ("EDITOR_STATUS_ERROR", "VECTOPLAN_EDITOR_STATUS_ERROR"),
        "viewport_placeholder": ("EDITOR_VIEWPORT_PLACEHOLDER", "VECTOPLAN_EDITOR_VIEWPORT_PLACEHOLDER"),
        "pointer_lock_title": ("EDITOR_POINTER_LOCK_TITLE", "VECTOPLAN_EDITOR_POINTER_LOCK_TITLE"),
        "pointer_lock_message": ("EDITOR_POINTER_LOCK_MESSAGE", "VECTOPLAN_EDITOR_POINTER_LOCK_MESSAGE"),
        "pointer_lock_hint": ("EDITOR_POINTER_LOCK_HINT", "VECTOPLAN_EDITOR_POINTER_LOCK_HINT"),
    }

    for context_key, config_keys in mapping.items():
        context[context_key] = _coerce_text(
            _resolve_first_env_or_config(config_source, context.get(context_key), *config_keys),
            _coerce_text(context.get(context_key), ""),
        )


def _apply_runtime_context(context: dict[str, Any], config_source: Any) -> None:
    bool_mapping = {
        "first_person_enabled": ("EDITOR_ENABLE_FIRST_PERSON", "VECTOPLAN_EDITOR_ENABLE_FIRST_PERSON"),
        "debug_overlay_enabled": ("EDITOR_ENABLE_DEBUG_OVERLAY", "VECTOPLAN_EDITOR_ENABLE_DEBUG_OVERLAY"),
        "crosshair_enabled": ("EDITOR_ENABLE_CROSSHAIR", "VECTOPLAN_EDITOR_ENABLE_CROSSHAIR"),
        "allow_pointer_lock": ("EDITOR_ENABLE_POINTER_LOCK", "VECTOPLAN_EDITOR_ENABLE_POINTER_LOCK"),
        "local_world_fallback_enabled": ("EDITOR_LOCAL_WORLD_FALLBACK_ENABLED", "VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED"),
        "legacy_frontend_enabled": ("EDITOR_LEGACY_FRONTEND_ENABLED", "VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED"),
    }

    for context_key, config_keys in bool_mapping.items():
        context[context_key] = _coerce_bool(
            _resolve_first_env_or_config(config_source, context.get(context_key), *config_keys),
            _coerce_bool(context.get(context_key), False),
        )

    float_mapping = {
        "movement_walk_speed": ("EDITOR_RUNTIME_MOVE_SPEED", "VECTOPLAN_EDITOR_RUNTIME_MOVE_SPEED", 5.5, 0.1, 1000.0),
        "movement_sprint_multiplier": ("EDITOR_RUNTIME_SPRINT_MULTIPLIER", "VECTOPLAN_EDITOR_RUNTIME_SPRINT_MULTIPLIER", 2.4, 1.0, 10.0),
        "look_sensitivity": ("EDITOR_RUNTIME_LOOK_SENSITIVITY", "VECTOPLAN_EDITOR_RUNTIME_LOOK_SENSITIVITY", 0.0025, 0.00005, 5.0),
        "movement_player_height": ("EDITOR_RUNTIME_PLAYER_HEIGHT", "VECTOPLAN_EDITOR_RUNTIME_PLAYER_HEIGHT", 1.8, 0.2, 100.0),
        "spawn_x": ("EDITOR_RUNTIME_SPAWN_X", "VECTOPLAN_EDITOR_RUNTIME_SPAWN_X", 8.0, -100000.0, 100000.0),
        "spawn_y": ("EDITOR_RUNTIME_SPAWN_Y", "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Y", 8.0, -100000.0, 100000.0),
        "spawn_z": ("EDITOR_RUNTIME_SPAWN_Z", "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Z", 18.0, -100000.0, 100000.0),
        "initial_yaw": ("EDITOR_RUNTIME_INITIAL_YAW", "VECTOPLAN_EDITOR_RUNTIME_INITIAL_YAW", 0.0, -360.0, 360.0),
        "initial_pitch": ("EDITOR_RUNTIME_INITIAL_PITCH", "VECTOPLAN_EDITOR_RUNTIME_INITIAL_PITCH", 0.0, -89.0, 89.0),
    }

    for context_key, values in float_mapping.items():
        key_a, key_b, default, minimum, maximum = values
        context[context_key] = _coerce_float(
            _resolve_first_env_or_config(config_source, context.get(context_key), key_a, key_b),
            _coerce_float(context.get(context_key), default, minimum, maximum),
            minimum,
            maximum,
        )

    context["movement_run_speed"] = _coerce_float(
        context.get("movement_run_speed"),
        context["movement_walk_speed"] * context["movement_sprint_multiplier"],
        0.1,
        1000.0,
    )


def _apply_asset_context(context: dict[str, Any], config_source: Any) -> None:
    context["static_editor_url_prefix"] = _normalize_route_path(
        _resolve_first_env_or_config(config_source, context.get("static_editor_url_prefix"), "STATIC_EDITOR_URL_PREFIX", "VECTOPLAN_EDITOR_STATIC_EDITOR_URL_PREFIX"),
        _DEFAULT_STATIC_EDITOR_URL_PREFIX,
    )
    context["static_editor_manifest_name"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("static_editor_manifest_name"), "STATIC_EDITOR_MANIFEST_NAME", "VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME"),
        "manifest.json",
    )
    context["vite_entrypoint"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("vite_entrypoint"), "VITE_ENTRYPOINT", "VECTOPLAN_EDITOR_VITE_ENTRYPOINT"),
        "main.ts",
    )
    context["use_vite_manifest"] = _coerce_bool(
        _resolve_first_env_or_config(config_source, context.get("use_vite_manifest"), "USE_VITE_MANIFEST", "VECTOPLAN_EDITOR_USE_VITE_MANIFEST"),
        True,
    )
    context["strict_asset_checks"] = _coerce_bool(
        _resolve_first_env_or_config(config_source, context.get("strict_asset_checks"), "STRICT_ASSET_CHECKS", "VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS"),
        False,
    )
    context["fallback_static_js"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("fallback_static_js"), "FALLBACK_STATIC_JS", "VECTOPLAN_EDITOR_FALLBACK_STATIC_JS"),
        "",
    )
    context["fallback_static_css"] = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("fallback_static_css"), "FALLBACK_STATIC_CSS", "VECTOPLAN_EDITOR_FALLBACK_STATIC_CSS"),
        "",
    )


def _build_chunk_route_hints(api_base_url: str, project_id: str, world_id: str) -> dict[str, str]:
    default_hints = _default_call(
        "get_default_chunk_service_route_hints",
        {},
        api_base_url=api_base_url,
        project_id=project_id,
        world_id=world_id,
    )
    if isinstance(default_hints, Mapping) and default_hints:
        return dict(default_hints)

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


def _apply_chunk_context(context: dict[str, Any], config_source: Any) -> None:
    enabled = _coerce_bool(
        _resolve_first_env_or_config(config_source, context.get("chunk_enabled"), "EDITOR_CHUNK_SERVICE_ENABLED", "VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED"),
        True,
    )
    api_base_url = _normalize_route_path(
        _resolve_first_env_or_config(config_source, context.get("chunk_api_base_url"), "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL", "VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL"),
        _DEFAULT_CHUNK_API_PREFIX,
    )
    browser_base_url = _normalize_route_path(
        _resolve_first_env_or_config(config_source, context.get("chunk_browser_base_url"), "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL", "VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL"),
        api_base_url,
    )
    project_id = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("chunk_project_id"), "EDITOR_CHUNK_SERVICE_PROJECT_ID", "VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID"),
        _DEFAULT_CHUNK_PROJECT_ID,
    )
    world_id = _coerce_text(
        _resolve_first_env_or_config(config_source, context.get("chunk_world_id"), "EDITOR_CHUNK_SERVICE_WORLD_ID", "VECTOPLAN_EDITOR_CHUNK_SERVICE_WORLD_ID"),
        _DEFAULT_CHUNK_WORLD_ID,
    )

    route_hints = _build_chunk_route_hints(api_base_url, project_id, world_id)

    chunk = _default_call(
        "get_default_chunk_service_config",
        {},
        api_base_url=api_base_url,
        project_id=project_id,
        world_id=world_id,
        include_internal=False,
    )
    if not isinstance(chunk, Mapping):
        chunk = {}

    chunk_config = _deep_merge_dicts(
        chunk,
        {
            "enabled": enabled,
            "mode": _coerce_text(
                _resolve_first_env_or_config(config_source, context.get("chunk_mode"), "EDITOR_CHUNK_SERVICE_MODE", "VECTOPLAN_EDITOR_CHUNK_SERVICE_MODE"),
                "editor-proxy",
            ),
            "sourceKind": _coerce_text(
                _resolve_first_env_or_config(config_source, context.get("chunk_source_kind"), "EDITOR_CHUNK_SERVICE_SOURCE_KIND", "VECTOPLAN_EDITOR_CHUNK_SERVICE_SOURCE_KIND"),
                "vectoplan-chunk",
            ),
            "apiBaseUrl": api_base_url,
            "browserBaseUrl": browser_base_url,
            "projectId": project_id,
            "worldId": world_id,
            "routeHints": route_hints,
            "requestTimeoutMs": _coerce_int(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS"),
                10_000,
                100,
                300_000,
            ),
            "commandTimeoutMs": _coerce_int(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS"),
                15_000,
                100,
                300_000,
            ),
            "batchTimeoutMs": _coerce_int(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS"),
                20_000,
                100,
                300_000,
            ),
            "statusTimeoutMs": _coerce_int(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS"),
                5_000,
                100,
                300_000,
            ),
            "preferBatchLoad": _coerce_bool(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD", "VECTOPLAN_EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD"),
                True,
            ),
            "reloadDirtyChunksAfterCommand": _coerce_bool(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND", "VECTOPLAN_EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND"),
                True,
            ),
            "maxBatchChunks": _coerce_int(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS", "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS"),
                256,
                1,
                10_000,
            ),
        },
    )

    chunk_proxy = _default_call("get_default_chunk_proxy_config", {})
    if not isinstance(chunk_proxy, Mapping):
        chunk_proxy = {}

    chunk_proxy_config = _deep_merge_dicts(
        chunk_proxy,
        {
            "enabled": enabled,
            "internalBaseUrl": _coerce_text(
                _resolve_first_env_or_config(config_source, None, "EDITOR_CHUNK_SERVICE_BASE_URL", "VECTOPLAN_EDITOR_CHUNK_SERVICE_BASE_URL"),
                "http://vectoplan-chunk:5000",
            ),
            "browserBaseUrl": browser_base_url,
            "apiPrefix": api_base_url,
            "projectId": project_id,
            "worldId": world_id,
            "routeHints": route_hints,
        },
    )

    context["chunk"] = chunk_config
    context["chunk_config"] = chunk_config
    context["chunk_proxy"] = chunk_proxy_config
    context["chunk_route_hints"] = route_hints
    context["chunk_enabled"] = enabled
    context["chunk_api_base_url"] = api_base_url
    context["chunk_browser_base_url"] = browser_base_url
    context["chunk_project_id"] = project_id
    context["chunk_world_id"] = world_id
    context["chunk_mode"] = str(chunk_config.get("mode"))
    context["chunk_source_kind"] = str(chunk_config.get("sourceKind"))
    context['chunks_view_distance'] = _coerce_int(
        _resolve_first_env_or_config(
            config_source,
            context.get('chunks_view_distance'),
            'VECTOPLAN_EDITOR_CHUNKS_VIEW_DISTANCE',
            'EDITOR_CHUNKS_VIEW_DISTANCE',
        ),
        10,
        1,
        16,
    )
    context['chunks_preload_radius'] = _coerce_int(
        _resolve_first_env_or_config(
            config_source,
            context.get('chunks_preload_radius'),
            'VECTOPLAN_EDITOR_CHUNKS_PRELOAD_RADIUS',
            'EDITOR_CHUNKS_PRELOAD_RADIUS',
        ),
        4,
        1,
        8,
    )
    context['chunks_unload_distance'] = _coerce_int(
        _resolve_first_env_or_config(
            config_source,
            context.get('chunks_unload_distance'),
            'VECTOPLAN_EDITOR_CHUNKS_UNLOAD_DISTANCE',
            'EDITOR_CHUNKS_UNLOAD_DISTANCE',
        ),
        64,
        16,
        96,
    )
    context['chunks_max_loaded_chunks'] = _coerce_int(
        _resolve_first_env_or_config(
            config_source,
            context.get('chunks_max_loaded_chunks'),
            'VECTOPLAN_EDITOR_CHUNKS_MAX_LOADED_CHUNKS',
            'EDITOR_CHUNKS_MAX_LOADED_CHUNKS',
        ),
        2048,
        512,
        8192,
    )


def _apply_feature_flags(context: dict[str, Any], config_source: Any) -> None:
    flags = _default_call("get_default_runtime_feature_flags", {})
    if not isinstance(flags, Mapping):
        flags = {}

    feature_flags = _deep_merge_dicts(
        flags,
        {
            "chunkServiceEnabled": _coerce_bool(context.get("chunk_enabled"), True),
            "localWorldFallbackEnabled": _coerce_bool(context.get("local_world_fallback_enabled"), False),
            "legacyFrontendEnabled": _coerce_bool(context.get("legacy_frontend_enabled"), False),
            "pointerLockEnabled": _coerce_bool(context.get("allow_pointer_lock"), True),
            "firstPersonEnabled": _coerce_bool(context.get("first_person_enabled"), True),
            "debugOverlayEnabled": _coerce_bool(context.get("debug_overlay_enabled"), True),
            "crosshairEnabled": _coerce_bool(context.get("crosshair_enabled"), True),
            "hotbarEnabled": _coerce_bool(
                _resolve_first_env_or_config(config_source, True, "EDITOR_ENABLE_HOTBAR", "VECTOPLAN_EDITOR_ENABLE_HOTBAR"),
                True,
            ),
            "statusBarEnabled": _coerce_bool(
                _resolve_first_env_or_config(config_source, True, "EDITOR_ENABLE_STATUS_BAR", "VECTOPLAN_EDITOR_ENABLE_STATUS_BAR"),
                True,
            ),
            "loadingOverlayEnabled": _coerce_bool(
                _resolve_first_env_or_config(config_source, True, "EDITOR_ENABLE_LOADING_OVERLAY", "VECTOPLAN_EDITOR_ENABLE_LOADING_OVERLAY"),
                True,
            ),
            "errorPanelEnabled": _coerce_bool(
                _resolve_first_env_or_config(config_source, True, "EDITOR_ENABLE_ERROR_PANEL", "VECTOPLAN_EDITOR_ENABLE_ERROR_PANEL"),
                True,
            ),
        },
    )

    context["feature_flags"] = feature_flags


def _apply_dataset_values(context: dict[str, Any]) -> None:
    root_dataset = _default_call("get_default_root_dataset_values", {})
    if not isinstance(root_dataset, Mapping):
        root_dataset = {}

    dataset = _deep_merge_dicts(
        root_dataset,
        {
            "editor-root": "true",
            "editor-runtime-mode": context.get("runtime_mode", "remote_chunk_service"),
            "editor-world-mode": context.get("world_mode", "chunk_service"),
            "editor-source-mode": context.get("source_mode", "chunk-service"),
            "editor-build-mode": context.get("build_mode", "development"),
            "editor-build-version": context.get("build_version", "dev"),
            "chunk-service-enabled": "true" if context.get("chunk_enabled") else "false",
            "chunk-service-api-base-url": context.get("chunk_api_base_url", _DEFAULT_CHUNK_API_PREFIX),
            "chunk-service-browser-base-url": context.get("chunk_browser_base_url", _DEFAULT_CHUNK_API_PREFIX),
            "chunk-service-project-id": context.get("chunk_project_id", _DEFAULT_CHUNK_PROJECT_ID),
            "chunk-service-world-id": context.get("chunk_world_id", _DEFAULT_CHUNK_WORLD_ID),
            "chunk-service-source-kind": context.get("chunk_source_kind", "vectoplan-chunk"),
            "chunk-service-mode": context.get("chunk_mode", "editor-proxy"),
        },
    )

    context["root_dataset_values"] = {str(key): str(value) for key, value in dataset.items() if value is not None}
    context["root_dataset_values_json"] = _safe_script_json(_safe_json_dumps(context["root_dataset_values"]))


def _apply_inventory_context(context: dict[str, Any], config_source: Any) -> None:
    context["inventory_hotbar_size"] = _coerce_int(
        _resolve_first_env_or_config(config_source, context.get("inventory_hotbar_size"), "EDITOR_INVENTORY_HOTBAR_SIZE", "VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE"),
        9,
        1,
        128,
    )
    context["inventory_default_selected_slot"] = _coerce_int(
        context.get("inventory_default_selected_slot"),
        0,
        0,
        max(0, context["inventory_hotbar_size"] - 1),
    )

    palette = context.get("inventory_default_palette")
    if not isinstance(palette, list):
        palette = _default_call("get_default_inventory_palette", [])

    context["inventory_default_palette"] = palette if isinstance(palette, list) else []
    context["placeable_blocks"] = _normalize_list_of_dicts(context.get("placeable_blocks"))
    if not context["placeable_blocks"]:
        context["placeable_blocks"] = _default_call("get_default_placeable_blocks", [])


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


def _apply_assets_context(
    context: dict[str, Any],
    config_source: Any,
    *,
    force_asset_refresh: bool = False,
) -> None:
    get_assets, build_assets_context = _resolve_assets_callables()

    asset_context: dict[str, Any] = {
        "ok": False,
        "source": "unavailable",
        "js": [],
        "css": [],
        "preload": [],
        "files": [],
        "warnings": ["assets.py is not available"],
        "errors": [],
        "manifest_found": False,
        "manifest_loaded": False,
        "fallback_used": True,
    }

    if callable(build_assets_context):
        try:
            built = build_assets_context(app_config=config_source if isinstance(config_source, Mapping) else None, force_refresh=force_asset_refresh)
            if isinstance(built, Mapping):
                asset_context = _deep_merge_dicts(asset_context, built)
        except TypeError:
            try:
                built = build_assets_context(force_refresh=force_asset_refresh)
                if isinstance(built, Mapping):
                    asset_context = _deep_merge_dicts(asset_context, built)
            except Exception:
                LOGGER.exception("Editor asset context builder failed.")
        except Exception:
            LOGGER.exception("Editor asset context builder failed.")
    elif callable(get_assets):
        try:
            assets = get_assets(app_config=config_source if isinstance(config_source, Mapping) else None, force_refresh=force_asset_refresh)
            if hasattr(assets, "to_template_context"):
                asset_context = _deep_merge_dicts(asset_context, assets.to_template_context())
            elif isinstance(assets, Mapping):
                asset_context = _deep_merge_dicts(asset_context, assets)
        except TypeError:
            try:
                assets = get_assets(force_refresh=force_asset_refresh)
                if hasattr(assets, "to_template_context"):
                    asset_context = _deep_merge_dicts(asset_context, assets.to_template_context())
                elif isinstance(assets, Mapping):
                    asset_context = _deep_merge_dicts(asset_context, assets)
            except Exception:
                LOGGER.exception("Editor asset resolver failed.")
        except Exception:
            LOGGER.exception("Editor asset resolver failed.")

    context["editor_assets"] = asset_context
    context["editor_asset_js"] = list(asset_context.get("js") or [])
    context["editor_asset_css"] = list(asset_context.get("css") or [])
    context["editor_asset_preload"] = list(asset_context.get("preload") or [])

    if context["editor_asset_css"]:
        context["editor_css_url"] = context["editor_asset_css"][0]
    else:
        context["editor_css_url"] = _safe_static_url(
            _coerce_text(context.get("fallback_static_css") or context.get("editor_css_file"), ""),
        ) if (context.get("fallback_static_css") or context.get("editor_css_file")) else ""

    if context["editor_asset_js"]:
        context["editor_js_url"] = context["editor_asset_js"][0]
    else:
        context["editor_js_url"] = _safe_static_url(
            _coerce_text(context.get("fallback_static_js") or context.get("editor_js_file"), ""),
        ) if (context.get("fallback_static_js") or context.get("editor_js_file")) else ""


def _attach_bootstrap_payload(context: dict[str, Any]) -> dict[str, Any]:
    payload_builder, payload_serializer = _resolve_payload_callables()

    if callable(payload_builder):
        try:
            payload = payload_builder(context)
        except TypeError:
            try:
                payload = payload_builder(context=context)
            except Exception:
                LOGGER.exception("Payload builder failed; using local fallback.")
                payload = _build_local_fallback_payload(context)
        except Exception:
            LOGGER.exception("Payload builder failed; using local fallback.")
            payload = _build_local_fallback_payload(context)
    else:
        payload = _build_local_fallback_payload(context)

    if callable(payload_serializer):
        try:
            payload_json = payload_serializer(payload)
        except TypeError:
            try:
                payload_json = payload_serializer(payload=payload)
            except Exception:
                LOGGER.exception("Payload serializer failed; using local serializer.")
                payload_json = _safe_script_json(_safe_json_dumps(payload))
        except Exception:
            LOGGER.exception("Payload serializer failed; using local serializer.")
            payload_json = _safe_script_json(_safe_json_dumps(payload))
    else:
        payload_json = _safe_script_json(_safe_json_dumps(payload))

    context["editor_bootstrap_payload"] = _safe_deepcopy(payload)
    context["editor_bootstrap_payload_json"] = _coerce_text(payload_json, "{}")
    context["editor_bootstrap_json"] = context["editor_bootstrap_payload_json"]
    context["bootstrap_payload"] = context["editor_bootstrap_payload"]
    context["bootstrap_payload_json"] = context["editor_bootstrap_payload_json"]

    return context


def _build_local_fallback_payload(context: Mapping[str, Any]) -> dict[str, Any]:
    chunk = _safe_mapping(context.get("chunk"))

    return {
        "ok": True,
        "service": {
            "name": _coerce_text(context.get("app_name"), "vectoplan-editor"),
            "displayName": _coerce_text(context.get("app_display_name"), "VECTOPLAN Editor"),
            "version": _coerce_text(context.get("service_version"), "0.1.0"),
        },
        "kind": "editor-bootstrap",
        "schemaVersion": "editor-bootstrap.v1",
        "source": "src.bootstrap.context.local-fallback",
        "build": {
            "mode": _coerce_text(context.get("build_mode"), "development"),
            "version": _coerce_text(context.get("build_version"), "dev"),
        },
        "project": {
            "projectId": chunk.get("projectId", context.get("chunk_project_id", "dev-project")),
            "worldId": chunk.get("worldId", context.get("chunk_world_id", "world_spawn")),
        },
        "runtime": {
            "mode": _coerce_text(context.get("runtime_mode"), "remote_chunk_service"),
            "worldMode": _coerce_text(context.get("world_mode"), "chunk_service"),
            "sourceMode": _coerce_text(context.get("source_mode"), "chunk-service"),
            "chunk": _json_safe(dict(chunk)),
            "featureFlags": _json_safe(context.get("feature_flags") or {}),
        },
        "chunk": _json_safe(dict(chunk)),
        "featureFlags": _json_safe(context.get("feature_flags") or {}),
        "fallback": {
            "active": _coerce_bool(context.get("fallback_active"), False),
            "reason": _coerce_optional_text(context.get("fallback_reason"), None),
        },
    }


# =============================================================================
# Öffentliche API
# =============================================================================

def build_editor_template_context(
    *,
    config_source: Any | None = None,
    static_url_builder: Callable[..., str] | None = None,
    fallback_active: bool = False,
    fallback_reason: str | None = None,
    extra_context: Mapping[str, Any] | None = None,
    include_bootstrap_payload: bool = True,
    include_assets: bool = True,
    force_asset_refresh: bool = False,
) -> dict[str, Any]:
    resolved_config_source = _resolve_active_config_source(config_source)
    context = _build_base_context()

    _apply_identity_context(context, resolved_config_source)
    _apply_editor_shell_context(context, resolved_config_source)
    _apply_text_context(context, resolved_config_source)
    _apply_asset_context(context, resolved_config_source)
    _apply_runtime_context(context, resolved_config_source)
    _apply_chunk_context(context, resolved_config_source)
    _apply_feature_flags(context, resolved_config_source)
    _apply_inventory_context(context, resolved_config_source)
    _apply_dataset_values(context)

    context["fallback_active"] = _coerce_bool(fallback_active, False)
    context["fallback_reason"] = _coerce_optional_text(fallback_reason, None)

    if extra_context:
        context = _safe_shallow_context_merge(context, extra_context)
        _apply_chunk_context(context, resolved_config_source)
        _apply_feature_flags(context, resolved_config_source)
        _apply_inventory_context(context, resolved_config_source)
        _apply_dataset_values(context)

    if include_assets:
        _apply_assets_context(
            context,
            resolved_config_source,
            force_asset_refresh=force_asset_refresh,
        )
    else:
        context["editor_assets"] = {}
        context["editor_asset_js"] = []
        context["editor_asset_css"] = []
        context["editor_asset_preload"] = []

    if include_bootstrap_payload:
        context = _attach_bootstrap_payload(context)
    else:
        context["editor_bootstrap_payload"] = None
        context["editor_bootstrap_payload_json"] = None
        context["editor_bootstrap_json"] = None
        context["bootstrap_payload"] = None
        context["bootstrap_payload_json"] = None

    return context


def build_fallback_editor_template_context(
    *,
    reason: str | None = None,
    source_context: Mapping[str, Any] | None = None,
    config_source: Any | None = None,
    static_url_builder: Callable[..., str] | None = None,
    extra_context: Mapping[str, Any] | None = None,
    include_bootstrap_payload: bool = True,
    include_assets: bool = True,
    force_asset_refresh: bool = False,
) -> dict[str, Any]:
    merged_extra: dict[str, Any] = {}

    if source_context:
        merged_extra = _deep_merge_dicts(merged_extra, source_context)

    if extra_context:
        merged_extra = _deep_merge_dicts(merged_extra, extra_context)

    return build_editor_template_context(
        config_source=config_source,
        static_url_builder=static_url_builder,
        fallback_active=True,
        fallback_reason=reason or "fallback-active",
        extra_context=merged_extra,
        include_bootstrap_payload=include_bootstrap_payload,
        include_assets=include_assets,
        force_asset_refresh=force_asset_refresh,
    )


# =============================================================================
# Aliases
# =============================================================================

def build_editor_context(**kwargs: Any) -> dict[str, Any]:
    return build_editor_template_context(**kwargs)


def create_editor_template_context(**kwargs: Any) -> dict[str, Any]:
    return build_editor_template_context(**kwargs)


def create_editor_context(**kwargs: Any) -> dict[str, Any]:
    return build_editor_template_context(**kwargs)


def build_fallback_editor_context(**kwargs: Any) -> dict[str, Any]:
    return build_fallback_editor_template_context(**kwargs)


def create_fallback_editor_template_context(**kwargs: Any) -> dict[str, Any]:
    return build_fallback_editor_template_context(**kwargs)


def create_fallback_editor_context(**kwargs: Any) -> dict[str, Any]:
    return build_fallback_editor_template_context(**kwargs)


# =============================================================================
# Diagnose / Cache
# =============================================================================

def get_editor_context_module_metadata() -> dict[str, Any]:
    payload_builder, payload_serializer = _resolve_payload_callables()
    get_assets, build_assets_context = _resolve_assets_callables()

    defaults_metadata = _default_call("get_editor_defaults_module_metadata", {})

    return {
        "moduleName": CONTEXT_MODULE_NAME,
        "moduleVersion": CONTEXT_VERSION,
        "payloadBuilderAvailable": callable(payload_builder),
        "payloadSerializerAvailable": callable(payload_serializer),
        "assetResolverAvailable": callable(get_assets),
        "assetTemplateContextBuilderAvailable": callable(build_assets_context),
        "defaultRuntimeMode": _default_attr("DEFAULT_RUNTIME_MODE", "remote_chunk_service"),
        "defaultWorldMode": _default_attr("DEFAULT_WORLD_MODE", "chunk_service"),
        "defaultSourceMode": _default_attr("DEFAULT_SOURCE_MODE", "chunk-service"),
        "defaultChunkApiPrefix": _default_attr("DEFAULT_CHUNK_API_PREFIX", "/editor/api/chunk"),
        "defaultChunkProjectId": _default_attr("DEFAULT_CHUNK_DEFAULT_PROJECT_ID", "dev-project"),
        "defaultChunkWorldId": _default_attr("DEFAULT_CHUNK_DEFAULT_WORLD_ID", "world_spawn"),
        "defaultsMetadata": _json_safe(defaults_metadata),
    }


def clear_editor_context_caches() -> None:
    for candidate in (
        _resolve_import_target,
        _candidate_missing_names,
        _resolve_payload_callables,
        _resolve_assets_callables,
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

    try:
        get_assets, build_assets_context = _resolve_assets_callables()
        module = _import_first_available_module(_ASSETS_MODULE_CANDIDATES)
        if module is not None and hasattr(module, "clear_asset_caches"):
            module.clear_asset_caches()
    except Exception:
        pass


def clear_context_caches() -> None:
    clear_editor_context_caches()


def clear_bootstrap_caches() -> None:
    clear_editor_context_caches()


__all__ = [
    "CONTEXT_MODULE_NAME",
    "CONTEXT_VERSION",
    "get_editor_context_module_metadata",
    "clear_editor_context_caches",
    "clear_context_caches",
    "clear_bootstrap_caches",
    "build_editor_template_context",
    "build_editor_context",
    "create_editor_template_context",
    "create_editor_context",
    "build_fallback_editor_template_context",
    "build_fallback_editor_context",
    "create_fallback_editor_template_context",
    "create_fallback_editor_context",
]
