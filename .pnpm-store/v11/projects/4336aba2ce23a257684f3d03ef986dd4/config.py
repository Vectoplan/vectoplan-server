# services/vectoplan-editor/config.py
"""
Zentrale Konfiguration für den Microservice `vectoplan-editor`.

Diese Datei ist bewusst vorausschauend aufgebaut, weil der Editor mehrere
Integrationspfade gleichzeitig trägt:

1. Die aktive Browser-/Builder-Runtime unter:

       services/vectoplan-editor/src/frontend

2. Den bestehenden Remote-Chunk-Service-Pfad:

       Browser
         -> /editor/api/chunk
         -> vectoplan-editor Backend-Proxy
         -> vectoplan-chunk

3. Den Library-/Inventory-Pfad:

       Browser
         -> /editor/api/inventory
         -> vectoplan-editor Backend
         -> src.inventory
         -> src.clients.library_client
         -> vectoplan-library

4. Die iframe-Integration in `vectoplan-app`:

       Browser
         -> http://localhost:5103/ui/project/<project_id>/editor
         -> redirect
         -> http://localhost:5100/editor?embed=1&app_project_id=...&chunk_project_id=...&chunk_world_id=...

Wichtige Invarianten:

- Der Browser spricht niemals direkt mit http://vectoplan-chunk:5000.
- Der Browser spricht niemals direkt mit http://vectoplan-library:5000.
- Der Browser spricht für Chunks mit /editor/api/chunk.
- Der Browser spricht für Inventory mit /editor/api/inventory.
- Der Editor darf von `vectoplan-app` im iframe geladen werden, aber nur über
  explizit konfigurierte Frame-Ancestors.
- Kein Wildcard-frame-ancestors für die Editor-Einbettung.
- App-Projekt-IDs und Chunk-Projekt-IDs sind getrennte Konzepte.
- Query-Parameter aus vectoplan-app überschreiben Editor-Defaults.
- Diese Datei enthält keine Business-Logik.
- Diese Datei enthält keine HTTP-Proxy-Implementierung.
- Diese Datei enthält keine Chunk- oder Library-Fachlogik.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Final


# =============================================================================
# Konstanten
# =============================================================================

_TRUE_VALUES: Final[set[str]] = {
    "1",
    "true",
    "t",
    "yes",
    "y",
    "on",
    "enabled",
    "ja",
}

_FALSE_VALUES: Final[set[str]] = {
    "0",
    "false",
    "f",
    "no",
    "n",
    "off",
    "disabled",
    "nein",
}

_SPLIT_RE: Final[re.Pattern[str]] = re.compile(r"[\s,;]+")
_SAFE_ID_RE: Final[re.Pattern[str]] = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$")

_DEFAULT_APP_NAME: Final[str] = "vectoplan-editor"
_DEFAULT_APP_DISPLAY_NAME: Final[str] = "VECTOPLAN Editor"

_DEFAULT_APP_PUBLIC_URL: Final[str] = "http://localhost:5103"
_DEFAULT_EDITOR_PUBLIC_URL: Final[str] = "http://localhost:5100"
_DEFAULT_EDITOR_ROUTE_PATH: Final[str] = "/editor"
_DEFAULT_EDITOR_TEMPLATE_NAME: Final[str] = "editor/index.html"

_DEFAULT_STATIC_EDITOR_URL_PREFIX: Final[str] = "/static/editor"
_DEFAULT_STATIC_EDITOR_MANIFEST_NAME: Final[str] = "manifest.json"
_DEFAULT_VITE_ENTRYPOINT: Final[str] = "main.ts"

_DEFAULT_EDITOR_TEMPLATE_MODE: Final[str] = "chunk_service_viewport"
_DEFAULT_EDITOR_RUNTIME_MODE: Final[str] = "remote_chunk_service"
_DEFAULT_EDITOR_WORLD_MODE: Final[str] = "chunk_service"
_DEFAULT_EDITOR_SOURCE_MODE: Final[str] = "chunk-service"
_DEFAULT_EDITOR_BUILD_MODE: Final[str] = "development"
_DEFAULT_EDITOR_BUILD_VERSION: Final[str] = "dev"

# -----------------------------------------------------------------------------
# iframe / Security Defaults
# -----------------------------------------------------------------------------

_DEFAULT_EDITOR_EMBED_ENABLED: Final[bool] = True
_DEFAULT_EDITOR_EMBED_QUERY_PARAM: Final[str] = "embed"
_DEFAULT_EDITOR_EMBED_QUERY_TRUE_VALUES: Final[tuple[str, ...]] = ("1", "true", "yes", "on")
_DEFAULT_EDITOR_FRAME_ANCESTORS: Final[tuple[str, ...]] = (
    "http://localhost:5103",
    "http://127.0.0.1:5103",
    "http://localhost:5101",
    "http://127.0.0.1:5101",
    "http://localhost:5097",
    "http://127.0.0.1:5097",
    "http://localhost:5108",
    "http://127.0.0.1:5108",
)
_DEFAULT_EDITOR_CSP_EXTRA_CONNECT_SRC: Final[tuple[str, ...]] = (
    "http://localhost:5103",
    "http://127.0.0.1:5103",
)
_DEFAULT_EDITOR_CSP_EXTRA_IMG_SRC: Final[tuple[str, ...]] = ()
_DEFAULT_EDITOR_CSP_EXTRA_SCRIPT_SRC: Final[tuple[str, ...]] = ()
_DEFAULT_EDITOR_CSP_EXTRA_STYLE_SRC: Final[tuple[str, ...]] = ()

# -----------------------------------------------------------------------------
# Chunk-Service Defaults
# -----------------------------------------------------------------------------

_DEFAULT_CHUNK_SERVICE_ENABLED: Final[bool] = True
_DEFAULT_CHUNK_SERVICE_INTERNAL_BASE_URL: Final[str] = "http://vectoplan-chunk:5000"
_DEFAULT_CHUNK_SERVICE_BROWSER_BASE_URL: Final[str] = "/editor/api/chunk"
_DEFAULT_CHUNK_SERVICE_API_PREFIX: Final[str] = "/editor/api/chunk"

# Fallbacks only. In app-driven mode these are overridden by query params from
# vectoplan-app: chunk_project_id, chunk_universe_id, chunk_world_id.
_DEFAULT_CHUNK_SERVICE_PROJECT_ID: Final[str] = "dev-project"
_DEFAULT_CHUNK_SERVICE_UNIVERSE_ID: Final[str] = "dev-universe"
_DEFAULT_CHUNK_SERVICE_WORLD_ID: Final[str] = "world_spawn"
_DEFAULT_APP_PROJECT_PUBLIC_ID: Final[str] = ""

_DEFAULT_CHUNK_CONTEXT_STATUS: Final[str] = "ready"
_DEFAULT_CHUNK_CONTEXT_READY: Final[bool] = True

_DEFAULT_CHUNK_SERVICE_SOURCE_KIND: Final[str] = "vectoplan-chunk"
_DEFAULT_CHUNK_SERVICE_MODE: Final[str] = "editor-proxy"
_DEFAULT_CHUNK_SERVICE_REGISTRY_ID: Final[str] = "debug-blocks"
_DEFAULT_CHUNK_SERVICE_REGISTRY_VERSION: Final[str] = "1"

_DEFAULT_CHUNK_REQUEST_TIMEOUT_MS: Final[int] = 10_000
_DEFAULT_CHUNK_COMMAND_TIMEOUT_MS: Final[int] = 15_000
_DEFAULT_CHUNK_BATCH_TIMEOUT_MS: Final[int] = 20_000
_DEFAULT_CHUNK_STATUS_TIMEOUT_MS: Final[int] = 5_000
_DEFAULT_CHUNK_MAX_BATCH_CHUNKS: Final[int] = 256
_DEFAULT_CHUNK_MAX_RESPONSE_BYTES: Final[int] = 20 * 1024 * 1024

_DEFAULT_PLACEABLE_BLOCKS: Final[tuple[dict[str, Any], ...]] = ()

# -----------------------------------------------------------------------------
# Library-Service Defaults
# -----------------------------------------------------------------------------

_DEFAULT_LIBRARY_SERVICE_ENABLED: Final[bool] = True
_DEFAULT_LIBRARY_SERVICE_INTERNAL_BASE_URL: Final[str] = "http://vectoplan-library:5000"
_DEFAULT_LIBRARY_SERVICE_API_PREFIX: Final[str] = "/api/v1/vplib/library"
_DEFAULT_LIBRARY_SERVICE_SOURCE: Final[str] = "db"

_DEFAULT_LIBRARY_REQUEST_TIMEOUT_MS: Final[int] = 5_000
_DEFAULT_LIBRARY_STATUS_TIMEOUT_MS: Final[int] = 3_000
_DEFAULT_LIBRARY_MAX_RESPONSE_BYTES: Final[int] = 10 * 1024 * 1024
_DEFAULT_LIBRARY_CLIENT_CACHE_TTL_SECONDS: Final[float] = 5.0
_DEFAULT_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS: Final[float] = 60.0
_DEFAULT_LIBRARY_CLIENT_ALLOW_STALE_CACHE: Final[bool] = True
_DEFAULT_LIBRARY_CLIENT_USER_AGENT: Final[str] = "vectoplan-editor-library-client/0.1"

_DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL: Final[str] = "/editor/api/library"
_DEFAULT_EDITOR_INVENTORY_ROUTE_PATH: Final[str] = "/editor/api/inventory"
_DEFAULT_EDITOR_INVENTORY_SOURCE: Final[str] = "vectoplan-user-inventory"
_DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE: Final[int] = 9
_DEFAULT_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT: Final[int] = 0
_DEFAULT_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT: Final[int] = 32

_DEFAULT_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK: Final[bool] = False
_DEFAULT_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK: Final[bool] = True
_DEFAULT_EDITOR_INVENTORY_ICON_ONLY: Final[bool] = False
_DEFAULT_EDITOR_INVENTORY_ALLOW_PLACE_ACTION: Final[bool] = True
_DEFAULT_EDITOR_INVENTORY_ALLOW_BREAK_ACTION: Final[bool] = True
_DEFAULT_EDITOR_INVENTORY_SCROLL_WRAP: Final[bool] = True

# -----------------------------------------------------------------------------
# CAD automation proxy defaults
# -----------------------------------------------------------------------------

_DEFAULT_CAD_SERVICE_INTERNAL_BASE_URL: Final[str] = "http://vectoplan-cad:5000"
_DEFAULT_CAD_AUTOMATION_REQUEST_TIMEOUT_SECONDS: Final[float] = 30.0

# -----------------------------------------------------------------------------
# UI Defaults
# -----------------------------------------------------------------------------

_DEFAULT_ALLOWED_ORIGINS: Final[tuple[str, ...]] = ("*",)

_DEFAULT_EDITOR_STATUS_INITIAL: Final[str] = "Initialisierung..."
_DEFAULT_EDITOR_STATUS_LOADING: Final[str] = "Editor wird geladen..."
_DEFAULT_EDITOR_STATUS_READY: Final[str] = "Editor bereit"
_DEFAULT_EDITOR_STATUS_ERROR: Final[str] = "Editor konnte nicht gestartet werden"

_DEFAULT_POINTER_LOCK_TITLE: Final[str] = "First-Person-Modus"
_DEFAULT_POINTER_LOCK_MESSAGE: Final[str] = (
    "Klicke in den Viewport, um die Maus zu sperren und dich im Raum zu bewegen."
)
_DEFAULT_POINTER_LOCK_HINT: Final[str] = (
    "W A S D bewegen · Maus schauen · Linksklick abbauen · Rechtsklick platzieren · ESC löst den Mausfang."
)


# =============================================================================
# Robuste ENV-Helfer
# =============================================================================

try:
    _ENV_CACHE: dict[str, str] = dict(os.environ)
except Exception:
    _ENV_CACHE = {}


def refresh_env_cache() -> dict[str, str]:
    """
    Refresh des internen ENV-Caches.

    Normaler Runtime-Code braucht das nicht. Für Tests, Hot-Reloads oder
    App-Factory-Diagnosen ist der Hook nützlich.
    """
    global _ENV_CACHE

    try:
        _ENV_CACHE = dict(os.environ)
    except Exception:
        _ENV_CACHE = {}

    try:
        _cached_chunk_route_hints.cache_clear()
        _cached_library_route_hints.cache_clear()
        _cached_static_paths.cache_clear()
        _cached_embed_security_config.cache_clear()
    except Exception:
        pass

    return dict(_ENV_CACHE)


def _safe_getenv(name: str) -> str | None:
    try:
        if name in _ENV_CACHE:
            return _ENV_CACHE.get(name)
        return os.getenv(name)
    except Exception:
        return None


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None

    try:
        normalized = str(value).strip()
    except Exception:
        return None

    return normalized or None


def _normalize_identifier(value: Any, default: str = "") -> str:
    """
    Normalize public ids passed through env defaults.

    Query values are validated in routes/ui/editor.py. This helper only keeps
    config defaults predictable.
    """
    text = _normalize_text(value)

    if text is None:
        return default

    if len(text) > 180:
        return default

    if not _SAFE_ID_RE.match(text):
        return default

    return text


def _normalize_chunk_status(value: Any, default: str = _DEFAULT_CHUNK_CONTEXT_STATUS) -> str:
    text = (_normalize_text(value) or "").lower().replace("-", "_").replace(" ", "_")

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

    status = aliases.get(text, text)

    if status in {"ready", "pending", "error", "disabled"}:
        return status

    return default


def _read_str_env(name: str, default: str) -> str:
    value = _normalize_text(_safe_getenv(name))
    return value if value is not None else default


def _read_optional_str_env(name: str, default: str | None = None) -> str | None:
    value = _normalize_text(_safe_getenv(name))
    return value if value is not None else default


def _read_first_str_env(names: tuple[str, ...], default: str) -> str:
    for name in names:
        value = _normalize_text(_safe_getenv(name))
        if value is not None:
            return value

    return default


def _read_first_identifier_env(names: tuple[str, ...], default: str) -> str:
    raw = _read_first_str_env(names, default)
    return _normalize_identifier(raw, default)


def _read_bool_env(name: str, default: bool = False) -> bool:
    raw_value = _normalize_text(_safe_getenv(name))
    if raw_value is None:
        return default

    lowered = raw_value.lower()

    if lowered in _TRUE_VALUES:
        return True

    if lowered in _FALSE_VALUES:
        return False

    return default


def _read_first_bool_env(names: tuple[str, ...], default: bool = False) -> bool:
    for name in names:
        raw_value = _normalize_text(_safe_getenv(name))
        if raw_value is None:
            continue

        lowered = raw_value.lower()

        if lowered in _TRUE_VALUES:
            return True

        if lowered in _FALSE_VALUES:
            return False

    return default


def _read_int_env(
    name: str,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    raw_value = _normalize_text(_safe_getenv(name))

    if raw_value is None:
        value = default
    else:
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_first_int_env(
    names: tuple[str, ...],
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    for name in names:
        raw_value = _normalize_text(_safe_getenv(name))
        if raw_value is None:
            continue

        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            continue

        if minimum is not None:
            value = max(minimum, value)

        if maximum is not None:
            value = min(maximum, value)

        return value

    value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_float_env(
    name: str,
    default: float,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    raw_value = _normalize_text(_safe_getenv(name))

    if raw_value is None:
        value = default
    else:
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_first_float_env(
    names: tuple[str, ...],
    default: float,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    for name in names:
        raw_value = _normalize_text(_safe_getenv(name))
        if raw_value is None:
            continue

        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue

        if minimum is not None:
            value = max(minimum, value)

        if maximum is not None:
            value = min(maximum, value)

        return value

    value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_csv_env(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw_value = _normalize_text(_safe_getenv(name))

    if raw_value is None:
        return default

    try:
        values = tuple(part.strip() for part in raw_value.split(",") if part.strip())
    except Exception:
        return default

    return values or default


def _read_list_env(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    """
    Robuster Listenparser.

    Unterstützt:
    - JSON Array: ["a", "b"]
    - CSV: a,b
    - Space-separated: a b
    - Semicolon: a;b
    """
    raw_value = _normalize_text(_safe_getenv(name))

    if raw_value is None:
        return default

    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            result: list[str] = []
            for item in parsed:
                text = _normalize_text(item)
                if text and text not in result:
                    result.append(text)
            return tuple(result) or default
    except Exception:
        pass

    try:
        result = []
        for part in _SPLIT_RE.split(raw_value):
            text = _normalize_text(part)
            if text and text not in result:
                result.append(text)
        return tuple(result) or default
    except Exception:
        return default


def _read_first_list_env(names: tuple[str, ...], default: tuple[str, ...]) -> tuple[str, ...]:
    for name in names:
        raw_value = _normalize_text(_safe_getenv(name))
        if raw_value is None:
            continue
        return _read_list_env(name, default)

    return default


def _read_json_env(name: str, default: Any) -> Any:
    raw_value = _normalize_text(_safe_getenv(name))
    if raw_value is None:
        return default

    try:
        return json.loads(raw_value)
    except Exception:
        return default


def _resolve_service_root() -> Path:
    try:
        return Path(__file__).resolve().parent
    except Exception:
        return Path(".").resolve()


SERVICE_ROOT: Final[Path] = _resolve_service_root()


def _build_path(*parts: str) -> Path:
    try:
        return SERVICE_ROOT.joinpath(*parts)
    except Exception:
        return SERVICE_ROOT


def _normalize_route_path(value: str, default: str) -> str:
    raw_value = _normalize_text(value) or default

    try:
        normalized = raw_value.strip()
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


def _normalize_url(value: str, default: str) -> str:
    raw_value = _normalize_text(value) or default

    try:
        normalized = raw_value.rstrip("/")
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
    except Exception:
        pass

    return default.rstrip("/")


def _normalize_origin(value: str, default: str | None = None) -> str:
    raw_value = _normalize_text(value)

    if raw_value is None:
        return default or ""

    try:
        if raw_value in {"self", "'self'"}:
            return "'self'"

        if raw_value == "*":
            return "*"

        if not (raw_value.startswith("http://") or raw_value.startswith("https://")):
            return default or ""

        without_path = raw_value.split("#", 1)[0].split("?", 1)[0].rstrip("/")
        parts = without_path.split("/")

        if len(parts) >= 3:
            return f"{parts[0]}//{parts[2]}"

        return default or ""
    except Exception:
        return default or ""


def _normalize_origin_tuple(values: tuple[str, ...], default: tuple[str, ...]) -> tuple[str, ...]:
    try:
        result: list[str] = []

        for value in values:
            origin = _normalize_origin(value)
            if not origin:
                continue
            if origin == "*":
                continue
            if origin not in result:
                result.append(origin)

        if result:
            return tuple(result)

        return default
    except Exception:
        return default


def _csp_source_value(value: str) -> str:
    normalized = _normalize_origin(value)

    if not normalized:
        return ""

    if normalized in {"self", "'self'"}:
        return "'self'"

    if normalized == "*":
        return "*"

    return normalized


def _csp_join_sources(values: tuple[str, ...], include_self: bool = False) -> str:
    try:
        result: list[str] = []

        if include_self:
            result.append("'self'")

        for value in values:
            source = _csp_source_value(value)
            if not source:
                continue
            if source not in result:
                result.append(source)

        return " ".join(result)
    except Exception:
        return "'self'" if include_self else ""


def _normalize_api_prefix(value: str, default: str) -> str:
    return _normalize_route_path(value, default)


def _join_route_path(*parts: str) -> str:
    cleaned: list[str] = []

    for part in parts:
        value = _normalize_text(part)
        if value is None:
            continue
        cleaned.append(value.strip("/"))

    if not cleaned:
        return "/"

    return "/" + "/".join(cleaned)


def _join_public_url(base_url: str, route_path: str) -> str:
    base = _normalize_url(base_url, _DEFAULT_EDITOR_PUBLIC_URL)
    route = _normalize_route_path(route_path, _DEFAULT_EDITOR_ROUTE_PATH)

    try:
        if base.endswith(route):
            return base

        if route == "/":
            return base

        return f"{base}{route}"
    except Exception:
        return f"{_DEFAULT_EDITOR_PUBLIC_URL}{_DEFAULT_EDITOR_ROUTE_PATH}"


def _as_public_static_url(prefix: str, file_path: str) -> str:
    normalized_prefix = _normalize_route_path(prefix, _DEFAULT_STATIC_EDITOR_URL_PREFIX)
    normalized_file = (_normalize_text(file_path) or "").lstrip("/")
    return _join_route_path(normalized_prefix, normalized_file)


def _seconds_from_ms(milliseconds: int, default_seconds: float) -> float:
    try:
        return max(0.1, float(milliseconds) / 1000.0)
    except Exception:
        return default_seconds


# =============================================================================
# Cache-Helfer
# =============================================================================

@lru_cache(maxsize=64)
def _cached_chunk_route_hints(
    api_base_url: str,
    project_id: str,
    universe_id: str,
    world_id: str,
) -> dict[str, str]:
    prefix = _normalize_route_path(api_base_url, _DEFAULT_CHUNK_SERVICE_API_PREFIX)
    project_base = _join_route_path(prefix, "projects", project_id)
    world_base = _join_route_path(project_base, "worlds", world_id)

    # Most current chunk routes are project/world scoped. universe_id is still
    # carried as context for app/editor consistency and future route expansion.
    return {
        "apiBaseUrl": prefix,
        "status": _join_route_path(prefix, "_status"),
        "testConnection": _join_route_path(prefix, "_test", "connection"),
        "placeableBlocks": _join_route_path(prefix, "placeable-blocks"),
        "projects": _join_route_path(prefix, "projects"),
        "project": project_base,
        "projectBootstrap": _join_route_path(project_base, "bootstrap"),
        "universes": _join_route_path(project_base, "universes"),
        "universe": _join_route_path(project_base, "universes", universe_id) if universe_id else "",
        "worlds": _join_route_path(project_base, "worlds"),
        "world": world_base,
        "blocks": _join_route_path(world_base, "blocks"),
        "chunk": _join_route_path(world_base, "chunks"),
        "chunks": _join_route_path(world_base, "chunks"),
        "chunksBatch": _join_route_path(world_base, "chunks", "batch"),
        "commands": _join_route_path(world_base, "commands"),
    }


@lru_cache(maxsize=32)
def _cached_library_route_hints(
    editor_library_browser_base_url: str,
    editor_inventory_route_path: str,
) -> dict[str, str]:
    browser_base = _normalize_route_path(
        editor_library_browser_base_url,
        _DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL,
    )
    inventory_route = _normalize_route_path(
        editor_inventory_route_path,
        _DEFAULT_EDITOR_INVENTORY_ROUTE_PATH,
    )

    return {
        "browserBaseUrl": browser_base,
        "inventory": inventory_route,
        "status": _join_route_path(browser_base, "_status"),
        "health": _join_route_path(browser_base, "health"),
        "dbHealth": _join_route_path(browser_base, "db", "health"),
        "publicationStatus": _join_route_path(browser_base, "publication-status"),
        "blocks": _join_route_path(browser_base, "blocks"),
        "tree": _join_route_path(browser_base, "tree"),
    }


@lru_cache(maxsize=32)
def _cached_static_paths(
    static_editor_url_prefix: str,
    manifest_name: str,
) -> dict[str, str]:
    prefix = _normalize_route_path(static_editor_url_prefix, _DEFAULT_STATIC_EDITOR_URL_PREFIX)
    manifest = _normalize_text(manifest_name) or _DEFAULT_STATIC_EDITOR_MANIFEST_NAME

    return {
        "staticEditorUrlPrefix": prefix,
        "manifestUrl": _as_public_static_url(prefix, manifest),
    }


@lru_cache(maxsize=32)
def _cached_default_placeable_blocks() -> tuple[dict[str, Any], ...]:
    return tuple(dict(block) for block in _DEFAULT_PLACEABLE_BLOCKS)


@lru_cache(maxsize=32)
def _cached_embed_security_config(
    embed_enabled: bool,
    app_public_url: str,
    editor_public_url: str,
    frame_ancestors_csp: str,
) -> dict[str, Any]:
    return {
        "enabled": bool(embed_enabled),
        "appPublicUrl": app_public_url,
        "editorPublicUrl": editor_public_url,
        "frameAncestors": frame_ancestors_csp,
        "removeXFrameOptionsOnEmbed": True,
        "xFrameOptionsDefault": "SAMEORIGIN",
        "embedQueryParam": _DEFAULT_EDITOR_EMBED_QUERY_PARAM,
        "embedQueryTrueValues": list(_DEFAULT_EDITOR_EMBED_QUERY_TRUE_VALUES),
    }


# =============================================================================
# Basiskonfiguration
# =============================================================================

class BaseConfig:
    """
    Gemeinsame Basiskonfiguration für alle Umgebungen.
    """

    # -------------------------------------------------------------------------
    # Service-Metadaten
    # -------------------------------------------------------------------------

    APP_NAME = _DEFAULT_APP_NAME
    APP_DISPLAY_NAME = _DEFAULT_APP_DISPLAY_NAME

    APP_ENV = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_ENV",
            "FLASK_ENV",
        ),
        "development",
    )

    BUILD_MODE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_BUILD_MODE",
            "VECTOPLAN_BUILD_MODE",
        ),
        _DEFAULT_EDITOR_BUILD_MODE,
    )

    BUILD_VERSION = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_BUILD_VERSION",
            "VECTOPLAN_BUILD_VERSION",
            "GIT_SHA",
        ),
        _DEFAULT_EDITOR_BUILD_VERSION,
    )

    SERVICE_VERSION = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_SERVICE_VERSION",
            "VECTOPLAN_EDITOR_VERSION",
        ),
        "0.1.0",
    )

    # -------------------------------------------------------------------------
    # Flask-Grundkonfiguration
    # -------------------------------------------------------------------------

    SECRET_KEY = _read_str_env(
        "VECTOPLAN_EDITOR_SECRET_KEY",
        "dev-secret-key-change-me",
    )

    DEBUG = _read_bool_env("VECTOPLAN_EDITOR_DEBUG", False)
    TESTING = _read_bool_env("VECTOPLAN_EDITOR_TESTING", False)

    TEMPLATES_AUTO_RELOAD = _read_bool_env(
        "VECTOPLAN_EDITOR_TEMPLATES_AUTO_RELOAD",
        True,
    )

    EXPLAIN_TEMPLATE_LOADING = _read_bool_env(
        "VECTOPLAN_EDITOR_EXPLAIN_TEMPLATE_LOADING",
        False,
    )

    SEND_FILE_MAX_AGE_DEFAULT = _read_int_env(
        "VECTOPLAN_EDITOR_SEND_FILE_MAX_AGE_DEFAULT",
        default=0,
        minimum=0,
    )

    PREFERRED_URL_SCHEME = _read_str_env(
        "VECTOPLAN_EDITOR_PREFERRED_URL_SCHEME",
        "http",
    )

    SERVER_NAME = _read_optional_str_env("VECTOPLAN_EDITOR_SERVER_NAME", None)

    APPLICATION_ROOT = _read_str_env(
        "VECTOPLAN_EDITOR_APPLICATION_ROOT",
        "/",
    )

    MAX_CONTENT_LENGTH = _read_int_env(
        "VECTOPLAN_EDITOR_MAX_CONTENT_LENGTH",
        default=16 * 1024 * 1024,
        minimum=1024,
    )

    JSON_SORT_KEYS = False
    JSONIFY_PRETTYPRINT_REGULAR = _read_bool_env(
        "VECTOPLAN_EDITOR_JSON_PRETTY",
        False,
    )

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = _read_str_env(
        "VECTOPLAN_EDITOR_SESSION_COOKIE_SAMESITE",
        "Lax",
    )
    SESSION_COOKIE_SECURE = _read_bool_env(
        "VECTOPLAN_EDITOR_SESSION_COOKIE_SECURE",
        False,
    )

    # -------------------------------------------------------------------------
    # Public / iframe Integration
    # -------------------------------------------------------------------------

    VECTOPLAN_APP_PUBLIC_URL = _normalize_url(
        _read_first_str_env(
            (
                "VECTOPLAN_APP_PUBLIC_URL",
                "VECTOPLAN_APP_PUBLIC_BASE_URL",
                "APP_PUBLIC_URL",
            ),
            _DEFAULT_APP_PUBLIC_URL,
        ),
        _DEFAULT_APP_PUBLIC_URL,
    )

    VECTOPLAN_EDITOR_PUBLIC_URL = _normalize_url(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_PUBLIC_URL",
                "VECTOPLAN_EDITOR_PUBLIC_BASE_URL",
                "EDITOR_PUBLIC_URL",
                "EDITOR_PUBLIC_BASE_URL",
            ),
            _DEFAULT_EDITOR_PUBLIC_URL,
        ),
        _DEFAULT_EDITOR_PUBLIC_URL,
    )

    VECTOPLAN_EDITOR_PUBLIC_BASE_URL = VECTOPLAN_EDITOR_PUBLIC_URL
    EDITOR_PUBLIC_URL = VECTOPLAN_EDITOR_PUBLIC_URL
    EDITOR_PUBLIC_BASE_URL = VECTOPLAN_EDITOR_PUBLIC_URL

    VECTOPLAN_EDITOR_EMBED_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_EMBED_ENABLED",
            "EDITOR_EMBED_ENABLED",
        ),
        _DEFAULT_EDITOR_EMBED_ENABLED,
    )

    VECTOPLAN_EDITOR_EMBED_QUERY_PARAM = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_EMBED_QUERY_PARAM",
            "EDITOR_EMBED_QUERY_PARAM",
        ),
        _DEFAULT_EDITOR_EMBED_QUERY_PARAM,
    )

    VECTOPLAN_EDITOR_EMBED_QUERY_TRUE_VALUES = _read_first_list_env(
        (
            "VECTOPLAN_EDITOR_EMBED_QUERY_TRUE_VALUES",
            "EDITOR_EMBED_QUERY_TRUE_VALUES",
        ),
        _DEFAULT_EDITOR_EMBED_QUERY_TRUE_VALUES,
    )

    VECTOPLAN_EDITOR_FRAME_ANCESTORS = _normalize_origin_tuple(
        _read_first_list_env(
            (
                "VECTOPLAN_EDITOR_FRAME_ANCESTORS",
                "VECTOPLAN_EDITOR_ALLOWED_FRAME_PARENTS",
                "VECTOPLAN_ALLOWED_FRAME_PARENTS",
                "FRAME_ANCESTORS",
            ),
            _DEFAULT_EDITOR_FRAME_ANCESTORS,
        ),
        _DEFAULT_EDITOR_FRAME_ANCESTORS,
    )

    VECTOPLAN_EDITOR_ALLOWED_FRAME_PARENTS = VECTOPLAN_EDITOR_FRAME_ANCESTORS

    VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP = _csp_join_sources(
        VECTOPLAN_EDITOR_FRAME_ANCESTORS,
        include_self=True,
    )

    VECTOPLAN_EDITOR_CSP_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CSP_ENABLED",
            "EDITOR_CSP_ENABLED",
        ),
        True,
    )

    VECTOPLAN_EDITOR_X_FRAME_OPTIONS_DEFAULT = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_X_FRAME_OPTIONS_DEFAULT",
            "EDITOR_X_FRAME_OPTIONS_DEFAULT",
        ),
        "SAMEORIGIN",
    )

    VECTOPLAN_EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED",
            "EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED",
        ),
        True,
    )

    VECTOPLAN_EDITOR_CSP_EXTRA_CONNECT_SRC = _read_first_list_env(
        (
            "VECTOPLAN_EDITOR_CSP_EXTRA_CONNECT_SRC",
            "EDITOR_CSP_EXTRA_CONNECT_SRC",
        ),
        _DEFAULT_EDITOR_CSP_EXTRA_CONNECT_SRC,
    )

    VECTOPLAN_EDITOR_CSP_EXTRA_IMG_SRC = _read_first_list_env(
        (
            "VECTOPLAN_EDITOR_CSP_EXTRA_IMG_SRC",
            "EDITOR_CSP_EXTRA_IMG_SRC",
        ),
        _DEFAULT_EDITOR_CSP_EXTRA_IMG_SRC,
    )

    VECTOPLAN_EDITOR_CSP_EXTRA_SCRIPT_SRC = _read_first_list_env(
        (
            "VECTOPLAN_EDITOR_CSP_EXTRA_SCRIPT_SRC",
            "EDITOR_CSP_EXTRA_SCRIPT_SRC",
        ),
        _DEFAULT_EDITOR_CSP_EXTRA_SCRIPT_SRC,
    )

    VECTOPLAN_EDITOR_CSP_EXTRA_STYLE_SRC = _read_first_list_env(
        (
            "VECTOPLAN_EDITOR_CSP_EXTRA_STYLE_SRC",
            "EDITOR_CSP_EXTRA_STYLE_SRC",
        ),
        _DEFAULT_EDITOR_CSP_EXTRA_STYLE_SRC,
    )

    # -------------------------------------------------------------------------
    # Pfade
    # -------------------------------------------------------------------------

    SERVICE_ROOT = SERVICE_ROOT
    SRC_ROOT = _build_path("src")
    BACKEND_BOOTSTRAP_ROOT = _build_path("src", "bootstrap")
    CLIENTS_ROOT = _build_path("src", "clients")
    INVENTORY_ROOT = _build_path("src", "inventory")
    LIBRARY_INVENTORY_ROOT = _build_path("src", "library_inventory")
    ROUTES_ROOT = _build_path("routes")
    TEMPLATES_ROOT = _build_path("templates")
    TEMPLATES_EDITOR_ROOT = _build_path("templates", "editor")
    STATIC_ROOT = _build_path("static")
    STATIC_EDITOR_ROOT = _build_path("static", "editor")

    # Produktive Frontend-Wahrheit.
    FRONTEND_ROOT = _build_path("src", "frontend")
    FRONTEND_SRC_ROOT = FRONTEND_ROOT

    # Legacy-Pfad nur zur Diagnose.
    LEGACY_FRONTEND_ROOT = _build_path("frontend")

    TESTS_ROOT = _build_path("tests")

    STATIC_EDITOR_MANIFEST_PATH = _build_path(
        "static",
        "editor",
        _DEFAULT_STATIC_EDITOR_MANIFEST_NAME,
    )

    STATIC_EDITOR_ASSETS_ROOT = _build_path("static", "editor", "assets")

    # -------------------------------------------------------------------------
    # Editor-Route, Template und Static/Vite
    # -------------------------------------------------------------------------

    EDITOR_ROUTE_PATH = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_ROUTE_PATH",
                "VECTOPLAN_EDITOR_ROUTE",
                "EDITOR_ROUTE_PATH",
                "EDITOR_ROUTE",
            ),
            _DEFAULT_EDITOR_ROUTE_PATH,
        ),
        _DEFAULT_EDITOR_ROUTE_PATH,
    )

    VECTOPLAN_EDITOR_ROUTE = EDITOR_ROUTE_PATH
    EDITOR_ROUTE = EDITOR_ROUTE_PATH
    VECTOPLAN_EDITOR_IFRAME_URL = _join_public_url(
        VECTOPLAN_EDITOR_PUBLIC_URL,
        EDITOR_ROUTE_PATH,
    )
    EDITOR_IFRAME_URL = VECTOPLAN_EDITOR_IFRAME_URL

    EDITOR_TEMPLATE_NAME = _read_str_env(
        "VECTOPLAN_EDITOR_TEMPLATE_NAME",
        _DEFAULT_EDITOR_TEMPLATE_NAME,
    )

    STATIC_EDITOR_URL_PREFIX = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_STATIC_EDITOR_URL_PREFIX",
                "VECTOPLAN_EDITOR_STATIC_URL_PREFIX",
            ),
            _DEFAULT_STATIC_EDITOR_URL_PREFIX,
        ),
        _DEFAULT_STATIC_EDITOR_URL_PREFIX,
    )

    STATIC_EDITOR_MANIFEST_NAME = _read_str_env(
        "VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME",
        _DEFAULT_STATIC_EDITOR_MANIFEST_NAME,
    )

    VITE_ENTRYPOINT = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_VITE_ENTRYPOINT",
            "VECTOPLAN_EDITOR_FRONTEND_ENTRYPOINT",
        ),
        _DEFAULT_VITE_ENTRYPOINT,
    )

    USE_VITE_MANIFEST = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_USE_VITE_MANIFEST",
            "VECTOPLAN_EDITOR_USE_MANIFEST_ASSETS",
        ),
        True,
    )

    STRICT_ASSET_CHECKS = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS",
            "VECTOPLAN_EDITOR_FAIL_ON_MISSING_ASSETS",
        ),
        False,
    )

    FALLBACK_STATIC_JS = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_FALLBACK_STATIC_JS",
            "VECTOPLAN_EDITOR_MAIN_JS_FILE",
        ),
        "",
    )

    FALLBACK_STATIC_CSS = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_FALLBACK_STATIC_CSS",
            "VECTOPLAN_EDITOR_MAIN_CSS_FILE",
        ),
        "",
    )

    # -------------------------------------------------------------------------
    # Editor-Runtime
    # -------------------------------------------------------------------------

    EDITOR_TEMPLATE_MODE = _read_str_env(
        "VECTOPLAN_EDITOR_TEMPLATE_MODE",
        _DEFAULT_EDITOR_TEMPLATE_MODE,
    )

    EDITOR_RUNTIME_MODE = _read_str_env(
        "VECTOPLAN_EDITOR_RUNTIME_MODE",
        _DEFAULT_EDITOR_RUNTIME_MODE,
    )

    EDITOR_WORLD_MODE = _read_str_env(
        "VECTOPLAN_EDITOR_WORLD_MODE",
        _DEFAULT_EDITOR_WORLD_MODE,
    )

    EDITOR_SOURCE_MODE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_SOURCE_MODE",
            "VECTOPLAN_EDITOR_WORLD_SOURCE_MODE",
        ),
        _DEFAULT_EDITOR_SOURCE_MODE,
    )

    EDITOR_PAGE_TITLE = _read_str_env(
        "VECTOPLAN_EDITOR_PAGE_TITLE",
        _DEFAULT_APP_DISPLAY_NAME,
    )

    EDITOR_BRAND_NAME = _read_str_env(
        "VECTOPLAN_EDITOR_BRAND_NAME",
        _DEFAULT_APP_DISPLAY_NAME,
    )

    EDITOR_STATUS_INITIAL = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_INITIAL",
        _DEFAULT_EDITOR_STATUS_INITIAL,
    )

    EDITOR_STATUS_LOADING = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_LOADING",
        _DEFAULT_EDITOR_STATUS_LOADING,
    )

    EDITOR_STATUS_READY = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_READY",
        _DEFAULT_EDITOR_STATUS_READY,
    )

    EDITOR_STATUS_ERROR = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_ERROR",
        _DEFAULT_EDITOR_STATUS_ERROR,
    )

    EDITOR_POINTER_LOCK_TITLE = _read_str_env(
        "VECTOPLAN_EDITOR_POINTER_LOCK_TITLE",
        _DEFAULT_POINTER_LOCK_TITLE,
    )

    EDITOR_POINTER_LOCK_MESSAGE = _read_str_env(
        "VECTOPLAN_EDITOR_POINTER_LOCK_MESSAGE",
        _DEFAULT_POINTER_LOCK_MESSAGE,
    )

    EDITOR_POINTER_LOCK_HINT = _read_str_env(
        "VECTOPLAN_EDITOR_POINTER_LOCK_HINT",
        _DEFAULT_POINTER_LOCK_HINT,
    )

    EDITOR_ENABLE_POINTER_LOCK = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_POINTER_LOCK",
        True,
    )

    EDITOR_ENABLE_FIRST_PERSON = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_FIRST_PERSON",
        True,
    )

    EDITOR_ENABLE_DEBUG_OVERLAY = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_DEBUG_OVERLAY",
        True,
    )

    EDITOR_ENABLE_CROSSHAIR = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_CROSSHAIR",
        True,
    )

    EDITOR_ENABLE_HOTBAR = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_HOTBAR",
        True,
    )

    EDITOR_ENABLE_STATUS_BAR = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_STATUS_BAR",
        True,
    )

    EDITOR_ENABLE_LOADING_OVERLAY = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_LOADING_OVERLAY",
        True,
    )

    EDITOR_ENABLE_ERROR_PANEL = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_ERROR_PANEL",
        True,
    )

    EDITOR_LOCAL_WORLD_FALLBACK_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED",
            "VECTOPLAN_EDITOR_ENABLE_LOCAL_WORLD_FALLBACK",
        ),
        False,
    )

    EDITOR_LEGACY_FRONTEND_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED",
            "VECTOPLAN_EDITOR_ENABLE_LEGACY_FRONTEND",
        ),
        False,
    )

    EDITOR_REMOTE_CHUNK_SERVICE_REQUIRED = _read_bool_env(
        "VECTOPLAN_EDITOR_REMOTE_CHUNK_SERVICE_REQUIRED",
        False,
    )

    # -------------------------------------------------------------------------
    # Runtime-Kamera / Bewegung / Spawn
    # -------------------------------------------------------------------------

    EDITOR_RUNTIME_MOVE_SPEED = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_MOVE_SPEED",
        default=5.5,
        minimum=0.1,
        maximum=100.0,
    )

    EDITOR_RUNTIME_SPRINT_MULTIPLIER = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPRINT_MULTIPLIER",
        default=2.4,
        minimum=1.0,
        maximum=10.0,
    )

    EDITOR_RUNTIME_LOOK_SENSITIVITY = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_LOOK_SENSITIVITY",
        default=0.0025,
        minimum=0.0001,
        maximum=1.0,
    )

    EDITOR_RUNTIME_PLAYER_HEIGHT = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_PLAYER_HEIGHT",
        default=1.8,
        minimum=0.2,
        maximum=10.0,
    )

    EDITOR_RUNTIME_SPAWN_X = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPAWN_X",
        default=8.0,
        minimum=-100_000.0,
        maximum=100_000.0,
    )

    EDITOR_RUNTIME_SPAWN_Y = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Y",
        default=2.0,
        minimum=-100_000.0,
        maximum=100_000.0,
    )

    EDITOR_RUNTIME_SPAWN_Z = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Z",
        default=8.0,
        minimum=-100_000.0,
        maximum=100_000.0,
    )

    EDITOR_RUNTIME_INITIAL_YAW = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_INITIAL_YAW",
        default=0.0,
        minimum=-360.0,
        maximum=360.0,
    )

    EDITOR_RUNTIME_INITIAL_PITCH = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_INITIAL_PITCH",
        default=0.0,
        minimum=-89.0,
        maximum=89.0,
    )

    # -------------------------------------------------------------------------
    # Library-Service / Editor-Inventory
    # -------------------------------------------------------------------------

    VECTOPLAN_LIBRARY_BASE_URL = _normalize_url(
        _read_first_str_env(
            (
                "VECTOPLAN_LIBRARY_BASE_URL",
                "VECTOPLAN_LIBRARY_URL",
                "VECTOPLAN_LIBRARY_SERVICE_URL",
                "VECTOPLAN_EDITOR_LIBRARY_BASE_URL",
                "VECTOPLAN_EDITOR_LIBRARY_SERVICE_BASE_URL",
                "VECTOPLAN_EDITOR_LIBRARY_SERVICE_INTERNAL_URL",
                "VECTOPLAN_LIBRARY_INTERNAL_URL",
            ),
            _DEFAULT_LIBRARY_SERVICE_INTERNAL_BASE_URL,
        ),
        _DEFAULT_LIBRARY_SERVICE_INTERNAL_BASE_URL,
    )

    VECTOPLAN_EDITOR_LIBRARY_BASE_URL = VECTOPLAN_LIBRARY_BASE_URL
    VECTOPLAN_LIBRARY_URL = VECTOPLAN_LIBRARY_BASE_URL
    VECTOPLAN_LIBRARY_SERVICE_URL = VECTOPLAN_LIBRARY_BASE_URL

    VECTOPLAN_LIBRARY_API_PREFIX = _normalize_api_prefix(
        _read_first_str_env(
            (
                "VECTOPLAN_LIBRARY_API_PREFIX",
                "VECTOPLAN_EDITOR_LIBRARY_API_PREFIX",
            ),
            _DEFAULT_LIBRARY_SERVICE_API_PREFIX,
        ),
        _DEFAULT_LIBRARY_SERVICE_API_PREFIX,
    )

    VECTOPLAN_EDITOR_LIBRARY_API_PREFIX = VECTOPLAN_LIBRARY_API_PREFIX

    VECTOPLAN_EDITOR_LIBRARY_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_LIBRARY_ENABLED",
            "VECTOPLAN_LIBRARY_ENABLED",
            "VECTOPLAN_EDITOR_USE_LIBRARY",
        ),
        _DEFAULT_LIBRARY_SERVICE_ENABLED,
    )

    VECTOPLAN_LIBRARY_SOURCE = _read_first_str_env(
        (
            "VECTOPLAN_LIBRARY_SOURCE",
            "VECTOPLAN_EDITOR_LIBRARY_SOURCE",
            "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_SOURCE",
        ),
        _DEFAULT_LIBRARY_SERVICE_SOURCE,
    )

    VECTOPLAN_LIBRARY_REQUEST_TIMEOUT = _read_first_float_env(
        (
            "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT",
            "VECTOPLAN_LIBRARY_TIMEOUT_SECONDS",
            "VECTOPLAN_EDITOR_LIBRARY_REQUEST_TIMEOUT",
            "VECTOPLAN_EDITOR_LIBRARY_TIMEOUT_SECONDS",
        ),
        default=_seconds_from_ms(_DEFAULT_LIBRARY_REQUEST_TIMEOUT_MS, 5.0),
        minimum=0.1,
        maximum=120.0,
    )

    VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_LIBRARY_REQUEST_TIMEOUT_MS",
        ),
        default=_DEFAULT_LIBRARY_REQUEST_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_LIBRARY_STATUS_TIMEOUT_MS",
        ),
        default=_DEFAULT_LIBRARY_STATUS_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS = _read_first_float_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS",
            "VECTOPLAN_EDITOR_LIBRARY_CACHE_TTL_SECONDS",
        ),
        default=_DEFAULT_LIBRARY_CLIENT_CACHE_TTL_SECONDS,
        minimum=0.0,
        maximum=3600.0,
    )

    VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS = _read_first_float_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS",
            "VECTOPLAN_EDITOR_LIBRARY_STALE_CACHE_TTL_SECONDS",
        ),
        default=_DEFAULT_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS,
        minimum=0.0,
        maximum=24 * 3600.0,
    )

    VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE = _read_first_bool_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE",
            "VECTOPLAN_EDITOR_LIBRARY_ALLOW_STALE_CACHE",
        ),
        _DEFAULT_LIBRARY_CLIENT_ALLOW_STALE_CACHE,
    )

    VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES = _read_first_int_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES",
            "VECTOPLAN_EDITOR_LIBRARY_MAX_RESPONSE_BYTES",
        ),
        default=_DEFAULT_LIBRARY_MAX_RESPONSE_BYTES,
        minimum=1024,
        maximum=100 * 1024 * 1024,
    )

    VECTOPLAN_LIBRARY_CLIENT_USER_AGENT = _read_first_str_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_USER_AGENT",
            "VECTOPLAN_EDITOR_LIBRARY_USER_AGENT",
        ),
        _DEFAULT_LIBRARY_CLIENT_USER_AGENT,
    )

    VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_LIBRARY_API_BROWSER_BASE_URL",
            ),
            _DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL,
        ),
        _DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL,
    )

    VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH",
                "VECTOPLAN_EDITOR_INVENTORY_API_PATH",
                "VECTOPLAN_EDITOR_INVENTORY_URL",
            ),
            _DEFAULT_EDITOR_INVENTORY_ROUTE_PATH,
        ),
        _DEFAULT_EDITOR_INVENTORY_ROUTE_PATH,
    )

    VECTOPLAN_EDITOR_INVENTORY_SOURCE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_SOURCE",
            "VECTOPLAN_LIBRARY_INVENTORY_SOURCE",
        ),
        _DEFAULT_EDITOR_INVENTORY_SOURCE,
    )

    VECTOPLAN_EDITOR_INVENTORY_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
            "EDITOR_INVENTORY_ENABLED",
        ),
        True,
    )

    # -------------------------------------------------------------------------
    # CAD-Service / parametrische Automatisierung
    # -------------------------------------------------------------------------

    VECTOPLAN_EDITOR_CAD_SERVICE_INTERNAL_URL = _normalize_url(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CAD_SERVICE_INTERNAL_URL",
                "VECTOPLAN_CAD_INTERNAL_URL",
            ),
            _DEFAULT_CAD_SERVICE_INTERNAL_BASE_URL,
        ),
        _DEFAULT_CAD_SERVICE_INTERNAL_BASE_URL,
    )

    VECTOPLAN_EDITOR_CAD_AUTOMATION_TIMEOUT_SECONDS = _read_first_float_env(
        (
            "VECTOPLAN_EDITOR_CAD_AUTOMATION_TIMEOUT_SECONDS",
            "VECTOPLAN_CAD_AUTOMATION_TIMEOUT_SECONDS",
        ),
        default=_DEFAULT_CAD_AUTOMATION_REQUEST_TIMEOUT_SECONDS,
        minimum=1.0,
        maximum=120.0,
    )

    VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE",
            "EDITOR_INVENTORY_HOTBAR_SIZE",
            "INVENTORY_HOTBAR_SIZE",
            "VECTOPLAN_EDITOR_HOTBAR_SLOTS",
        ),
        default=_DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
        minimum=1,
        maximum=64,
    )

    VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            "EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            "INVENTORY_DEFAULT_SELECTED_SLOT",
        ),
        default=_DEFAULT_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT,
        minimum=0,
        maximum=max(0, VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE - 1),
    )

    VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
            "EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
        ),
        default=max(
            _DEFAULT_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT,
            VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE,
        ),
        minimum=VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE,
        maximum=512,
    )

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK",
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
            "EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
        ),
        _DEFAULT_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK,
    )

    VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK = VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
            "EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
        ),
        _DEFAULT_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK,
    )

    VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY",
            "EDITOR_INVENTORY_ICON_ONLY",
            "INVENTORY_ICON_ONLY",
        ),
        _DEFAULT_EDITOR_INVENTORY_ICON_ONLY,
    )

    VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP",
            "EDITOR_INVENTORY_SCROLL_WRAP",
            "INVENTORY_SCROLL_WRAP",
        ),
        _DEFAULT_EDITOR_INVENTORY_SCROLL_WRAP,
    )

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION",
            "EDITOR_INVENTORY_ALLOW_PLACE_ACTION",
            "INVENTORY_ALLOW_PLACE_ACTION",
        ),
        _DEFAULT_EDITOR_INVENTORY_ALLOW_PLACE_ACTION,
    )

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
            "EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
            "INVENTORY_ALLOW_BREAK_ACTION",
        ),
        _DEFAULT_EDITOR_INVENTORY_ALLOW_BREAK_ACTION,
    )

    VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT",
            "EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT",
        ),
        False,
    )

    # Aliase, die `src.inventory` direkt liest.
    EDITOR_INVENTORY_ENABLED = VECTOPLAN_EDITOR_INVENTORY_ENABLED
    EDITOR_INVENTORY_HOTBAR_SIZE = VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE
    INVENTORY_HOTBAR_SIZE = VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE
    EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT = VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT
    INVENTORY_DEFAULT_SELECTED_SLOT = VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT
    EDITOR_INVENTORY_SCROLL_WRAP = VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP
    INVENTORY_SCROLL_WRAP = VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP
    EDITOR_INVENTORY_ALLOW_PLACE_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION
    INVENTORY_ALLOW_PLACE_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION
    EDITOR_INVENTORY_ALLOW_BREAK_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION
    INVENTORY_ALLOW_BREAK_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION
    EDITOR_INVENTORY_ICON_ONLY = VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY
    INVENTORY_ICON_ONLY = VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY

    # -------------------------------------------------------------------------
    # Chunk-Service / Editor-Proxy
    # -------------------------------------------------------------------------

    EDITOR_CHUNK_SERVICE_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED",
            "EDITOR_CHUNK_SERVICE_ENABLED",
            "VECTOPLAN_EDITOR_CHUNK_ENABLED",
            "VECTOPLAN_EDITOR_REMOTE_CHUNK_ENABLED",
        ),
        _DEFAULT_CHUNK_SERVICE_ENABLED,
    )

    EDITOR_CHUNK_SERVICE_BASE_URL = _normalize_url(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_BASE_URL",
                "EDITOR_CHUNK_SERVICE_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_INTERNAL_URL",
                "VECTOPLAN_CHUNK_SERVICE_INTERNAL_URL",
                "VECTOPLAN_CHUNK_INTERNAL_URL",
                "VECTOPLAN_CHUNK_INTERNAL_BASE_URL",
                "CHUNK_SERVICE_INTERNAL_URL",
                "CHUNK_INTERNAL_URL",
                "CHUNK_INTERNAL_BASE_URL",
            ),
            _DEFAULT_CHUNK_SERVICE_INTERNAL_BASE_URL,
        ),
        _DEFAULT_CHUNK_SERVICE_INTERNAL_BASE_URL,
    )

    VECTOPLAN_CHUNK_INTERNAL_URL = EDITOR_CHUNK_SERVICE_BASE_URL
    VECTOPLAN_CHUNK_INTERNAL_BASE_URL = EDITOR_CHUNK_SERVICE_BASE_URL
    CHUNK_INTERNAL_URL = EDITOR_CHUNK_SERVICE_BASE_URL

    EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
                "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_API_PREFIX",
            ),
            _DEFAULT_CHUNK_SERVICE_BROWSER_BASE_URL,
        ),
        _DEFAULT_CHUNK_SERVICE_BROWSER_BASE_URL,
    )

    EDITOR_CHUNK_SERVICE_API_PREFIX = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_API_PREFIX",
                "EDITOR_CHUNK_SERVICE_API_PREFIX",
                "VECTOPLAN_EDITOR_CHUNK_API_PREFIX",
            ),
            _DEFAULT_CHUNK_SERVICE_API_PREFIX,
        ),
        _DEFAULT_CHUNK_SERVICE_API_PREFIX,
    )

    EDITOR_APP_PROJECT_PUBLIC_ID = _read_first_identifier_env(
        (
            "VECTOPLAN_EDITOR_APP_PROJECT_PUBLIC_ID",
            "VECTOPLAN_APP_PROJECT_PUBLIC_ID",
            "APP_PROJECT_PUBLIC_ID",
        ),
        _DEFAULT_APP_PROJECT_PUBLIC_ID,
    )

    EDITOR_CHUNK_SERVICE_PROJECT_ID = _read_first_identifier_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "VECTOPLAN_EDITOR_CHUNK_PROJECT_ID",
            "EDITOR_CHUNK_PROJECT_ID",
            "CHUNK_PROJECT_ID",
            "VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID",
            "VECTOPLAN_CHUNK_DEFAULT_PROJECT_ID",
        ),
        _DEFAULT_CHUNK_SERVICE_PROJECT_ID,
    )

    EDITOR_CHUNK_SERVICE_UNIVERSE_ID = _read_first_identifier_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_UNIVERSE_ID",
            "EDITOR_CHUNK_SERVICE_UNIVERSE_ID",
            "VECTOPLAN_EDITOR_CHUNK_UNIVERSE_ID",
            "EDITOR_CHUNK_UNIVERSE_ID",
            "CHUNK_UNIVERSE_ID",
            "VECTOPLAN_EDITOR_DEFAULT_UNIVERSE_ID",
            "VECTOPLAN_CHUNK_DEFAULT_UNIVERSE_ID",
        ),
        _DEFAULT_CHUNK_SERVICE_UNIVERSE_ID,
    )

    EDITOR_CHUNK_SERVICE_WORLD_ID = _read_first_identifier_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_WORLD_ID",
            "EDITOR_CHUNK_SERVICE_WORLD_ID",
            "VECTOPLAN_EDITOR_CHUNK_WORLD_ID",
            "EDITOR_CHUNK_WORLD_ID",
            "CHUNK_WORLD_ID",
            "VECTOPLAN_EDITOR_DEFAULT_WORLD_ID",
            "VECTOPLAN_CHUNK_DEFAULT_WORLD_ID",
            "VECTOPLAN_CHUNK_DEFAULT_INSTANCE_WORLD_ID",
        ),
        _DEFAULT_CHUNK_SERVICE_WORLD_ID,
    )

    EDITOR_CHUNK_CONTEXT_STATUS = _normalize_chunk_status(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CHUNK_CONTEXT_STATUS",
                "VECTOPLAN_EDITOR_CHUNK_STATUS",
                "CHUNK_STATUS",
            ),
            _DEFAULT_CHUNK_CONTEXT_STATUS,
        ),
        _DEFAULT_CHUNK_CONTEXT_STATUS,
    )

    EDITOR_CHUNK_CONTEXT_READY = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_CONTEXT_READY",
            "VECTOPLAN_EDITOR_CHUNK_READY",
            "CHUNK_READY",
        ),
        bool(
            _DEFAULT_CHUNK_CONTEXT_READY
            and EDITOR_CHUNK_SERVICE_PROJECT_ID
            and EDITOR_CHUNK_SERVICE_WORLD_ID
            and EDITOR_CHUNK_CONTEXT_STATUS == "ready"
        ),
    )

    EDITOR_CHUNK_SERVICE_SOURCE_KIND = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            "EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            "VECTOPLAN_EDITOR_CHUNK_SOURCE_KIND",
        ),
        _DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
    )

    EDITOR_CHUNK_SERVICE_MODE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_MODE",
            "EDITOR_CHUNK_SERVICE_MODE",
            "VECTOPLAN_EDITOR_CHUNK_MODE",
        ),
        _DEFAULT_CHUNK_SERVICE_MODE,
    )

    EDITOR_CHUNK_SERVICE_REGISTRY_ID = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_REGISTRY_ID",
            "EDITOR_CHUNK_SERVICE_REGISTRY_ID",
        ),
        _DEFAULT_CHUNK_SERVICE_REGISTRY_ID,
    )

    EDITOR_CHUNK_SERVICE_REGISTRY_VERSION = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_REGISTRY_VERSION",
            "EDITOR_CHUNK_SERVICE_REGISTRY_VERSION",
        ),
        _DEFAULT_CHUNK_SERVICE_REGISTRY_VERSION,
    )

    EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_REQUEST_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_REQUEST_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_COMMAND_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_COMMAND_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_BATCH_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_BATCH_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_STATUS_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_STATUS_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            "EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            "VECTOPLAN_EDITOR_CHUNK_PREFER_BATCH_LOAD",
            "VECTOPLAN_EDITOR_CHUNKS_PREFER_BATCH_LOAD",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "VECTOPLAN_EDITOR_CHUNK_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "VECTOPLAN_EDITOR_CHUNKS_RELOAD_DIRTY_AFTER_COMMAND",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
            "EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
            "VECTOPLAN_EDITOR_CHUNK_MAX_BATCH_CHUNKS",
        ),
        default=_DEFAULT_CHUNK_MAX_BATCH_CHUNKS,
        minimum=1,
        maximum=10_000,
    )

    EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
            "EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
            "VECTOPLAN_EDITOR_CHUNK_MAX_RESPONSE_BYTES",
        ),
        default=_DEFAULT_CHUNK_MAX_RESPONSE_BYTES,
        minimum=1024,
        maximum=512 * 1024 * 1024,
    )

    EDITOR_CHUNK_SERVICE_ALLOW_GENERATED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_ALLOW_GENERATED",
            "EDITOR_CHUNK_SERVICE_ALLOW_GENERATED",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT",
            "EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_STATUS_PATHS = _read_first_list_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_PATHS",
            "VECTOPLAN_EDITOR_CHUNK_STATUS_PATHS",
        ),
        (
            "/",
            "/projects/_status",
            "/worlds/_status",
            "/blocks/_status",
            "/chunks/_status",
            "/commands/_status",
        ),
    )

    EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED",
            "EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED",
        ),
        True,
    )

    EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
            "EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
        ),
        True,
    )

    EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER",
            "EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER",
        ),
        False,
    )

    EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS",
            "EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS",
        ),
        False,
    )

    # Backwards-compatible aliases for older code.
    EDITOR_CHUNK_ENABLED = EDITOR_CHUNK_SERVICE_ENABLED
    EDITOR_CHUNK_MODE = EDITOR_CHUNK_SERVICE_MODE
    EDITOR_CHUNK_SOURCE_KIND = EDITOR_CHUNK_SERVICE_SOURCE_KIND
    EDITOR_CHUNK_SERVICE_INTERNAL_URL = EDITOR_CHUNK_SERVICE_BASE_URL
    EDITOR_CHUNK_API_PREFIX = EDITOR_CHUNK_SERVICE_API_PREFIX
    EDITOR_CHUNK_BROWSER_BASE_URL = EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL
    EDITOR_DEFAULT_PROJECT_ID = EDITOR_CHUNK_SERVICE_PROJECT_ID
    EDITOR_DEFAULT_UNIVERSE_ID = EDITOR_CHUNK_SERVICE_UNIVERSE_ID
    EDITOR_DEFAULT_WORLD_ID = EDITOR_CHUNK_SERVICE_WORLD_ID
    EDITOR_CHUNK_DEFAULT_PROJECT_ID = EDITOR_CHUNK_SERVICE_PROJECT_ID
    EDITOR_CHUNK_DEFAULT_UNIVERSE_ID = EDITOR_CHUNK_SERVICE_UNIVERSE_ID
    EDITOR_CHUNK_DEFAULT_WORLD_ID = EDITOR_CHUNK_SERVICE_WORLD_ID

    EDITOR_CHUNK_REQUEST_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS,
        10.0,
    )
    EDITOR_CHUNK_COMMAND_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS,
        15.0,
    )
    EDITOR_CHUNK_BATCH_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS,
        20.0,
    )
    EDITOR_CHUNK_STATUS_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS,
        5.0,
    )

    # -------------------------------------------------------------------------
    # Legacy Placeholder-Hotbar / Placeable Blocks
    # -------------------------------------------------------------------------

    EDITOR_PLACEABLE_BLOCKS = _read_json_env(
        "VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_JSON",
        [dict(block) for block in _cached_default_placeable_blocks()],
    )

    EDITOR_HOTBAR_SLOTS = VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE

    EDITOR_HOTBAR_DEFAULT_BLOCK_TYPE_ID = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_HOTBAR_DEFAULT_BLOCK_TYPE_ID",
            "VECTOPLAN_EDITOR_DEFAULT_BLOCK_TYPE_ID",
        ),
        "",
    )

    # -------------------------------------------------------------------------
    # CORS / Proxy / Security
    # -------------------------------------------------------------------------

    CORS_ENABLED = _read_bool_env(
        "VECTOPLAN_EDITOR_CORS_ENABLED",
        False,
    )

    CORS_ALLOWED_ORIGINS = _read_csv_env(
        "VECTOPLAN_EDITOR_CORS_ALLOWED_ORIGINS",
        _DEFAULT_ALLOWED_ORIGINS,
    )

    PROXY_TRUST_X_FORWARDED = _read_bool_env(
        "VECTOPLAN_EDITOR_PROXY_TRUST_X_FORWARDED",
        False,
    )

    # -------------------------------------------------------------------------
    # Hilfsmethoden
    # -------------------------------------------------------------------------

    @classmethod
    def get_static_paths(cls) -> dict[str, str]:
        return dict(
            _cached_static_paths(
                cls.STATIC_EDITOR_URL_PREFIX,
                cls.STATIC_EDITOR_MANIFEST_NAME,
            )
        )

    @classmethod
    def get_editor_slot_labels(cls) -> list[str]:
        try:
            slot_count = int(cls.VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE)
        except (TypeError, ValueError):
            slot_count = _DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE

        slot_count = max(1, min(slot_count, 64))
        return [str(index) for index in range(1, slot_count + 1)]

    @classmethod
    def get_placeable_blocks(cls) -> list[dict[str, Any]]:
        """
        Legacy-/Debug-Placeable-Blocks.

        Wichtig:
        - Diese Daten sind nicht mehr die fachliche Inventory-Wahrheit.
        - Das produktive Inventory kommt aus /editor/api/inventory.
        - Standardmäßig wird hier eine leere Liste geliefert, solange der
          Chunk-Fallback nicht explizit aktiviert ist.
        """
        if not bool(cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK):
            return []

        blocks = cls.EDITOR_PLACEABLE_BLOCKS

        if not isinstance(blocks, list):
            return [dict(block) for block in _cached_default_placeable_blocks()]

        normalized: list[dict[str, Any]] = []

        for item in blocks:
            if not isinstance(item, dict):
                continue

            block_type_id = _normalize_text(item.get("blockTypeId"))
            if block_type_id is None:
                continue

            block = dict(item)
            block["blockTypeId"] = block_type_id
            block.setdefault("label", block_type_id)
            block.setdefault("solid", True)
            block.setdefault("placeable", True)
            block.setdefault("breakable", True)
            block.setdefault("debugOnly", True)

            normalized.append(block)

        return normalized or [dict(block) for block in _cached_default_placeable_blocks()]

    @classmethod
    def build_embed_security_config(cls) -> dict[str, Any]:
        return dict(
            _cached_embed_security_config(
                bool(cls.VECTOPLAN_EDITOR_EMBED_ENABLED),
                str(cls.VECTOPLAN_APP_PUBLIC_URL),
                str(cls.VECTOPLAN_EDITOR_PUBLIC_URL),
                str(cls.VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP),
            )
        )

    @classmethod
    def build_security_header_config(cls) -> dict[str, Any]:
        extra_connect = list(cls.VECTOPLAN_EDITOR_CSP_EXTRA_CONNECT_SRC)
        if cls.VECTOPLAN_APP_PUBLIC_URL not in extra_connect:
            extra_connect.append(cls.VECTOPLAN_APP_PUBLIC_URL)

        return {
            "embed": cls.build_embed_security_config(),
            "csp": {
                "enabled": bool(cls.VECTOPLAN_EDITOR_CSP_ENABLED),
                "frameAncestors": str(cls.VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP),
                "extraConnectSrc": extra_connect,
                "extraImgSrc": list(cls.VECTOPLAN_EDITOR_CSP_EXTRA_IMG_SRC),
                "extraScriptSrc": list(cls.VECTOPLAN_EDITOR_CSP_EXTRA_SCRIPT_SRC),
                "extraStyleSrc": list(cls.VECTOPLAN_EDITOR_CSP_EXTRA_STYLE_SRC),
            },
            "xFrameOptions": {
                "default": str(cls.VECTOPLAN_EDITOR_X_FRAME_OPTIONS_DEFAULT),
                "removeOnEmbed": bool(cls.VECTOPLAN_EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED),
            },
        }

    @classmethod
    def build_chunk_route_hints(cls) -> dict[str, str]:
        return dict(
            _cached_chunk_route_hints(
                cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL,
                cls.EDITOR_CHUNK_SERVICE_PROJECT_ID,
                cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID,
                cls.EDITOR_CHUNK_SERVICE_WORLD_ID,
            )
        )

    @classmethod
    def build_chunk_context_config(cls) -> dict[str, Any]:
        return {
            "appProjectPublicId": str(cls.EDITOR_APP_PROJECT_PUBLIC_ID),
            "projectPublicId": str(cls.EDITOR_APP_PROJECT_PUBLIC_ID),
            "chunkProjectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "chunkUniverseId": str(cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID),
            "chunkWorldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "projectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "universeId": str(cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID),
            "worldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "status": str(cls.EDITOR_CHUNK_CONTEXT_STATUS),
            "ready": bool(cls.EDITOR_CHUNK_CONTEXT_READY),
            "queryParameters": {
                "appProjectPublicId": "app_project_public_id",
                "appProjectId": "app_project_id",
                "projectPublicId": "project_public_id",
                "chunkProjectId": "chunk_project_id",
                "chunkUniverseId": "chunk_universe_id",
                "chunkWorldId": "chunk_world_id",
                "projectId": "project_id",
                "worldId": "world_id",
                "chunkReady": "chunk_ready",
                "chunkStatus": "chunk_status",
            },
            "overridePolicy": {
                "queryOverridesDefaults": True,
                "appProjectIdIsNotChunkProjectId": True,
                "projectIdCompatibilityAliasUsesChunkProjectId": True,
                "worldIdCompatibilityAliasUsesChunkWorldId": True,
            },
        }

    @classmethod
    def build_library_route_hints(cls) -> dict[str, str]:
        return dict(
            _cached_library_route_hints(
                cls.VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL,
                cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH,
            )
        )

    @classmethod
    def build_library_service_config(cls, include_internal: bool = False) -> dict[str, Any]:
        route_hints = cls.build_library_route_hints()

        payload: dict[str, Any] = {
            "enabled": bool(cls.VECTOPLAN_EDITOR_LIBRARY_ENABLED),
            "source": str(cls.VECTOPLAN_LIBRARY_SOURCE),
            "browserBaseUrl": str(cls.VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL),
            "inventoryRoute": str(cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH),
            "routeHints": route_hints,
            "requestTimeoutMs": int(cls.VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS),
            "statusTimeoutMs": int(cls.VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS),
            "cacheTtlSeconds": float(cls.VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS),
            "staleCacheTtlSeconds": float(cls.VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS),
            "allowStaleCache": bool(cls.VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE),
        }

        if include_internal:
            payload["internalBaseUrl"] = str(cls.VECTOPLAN_LIBRARY_BASE_URL)
            payload["apiPrefix"] = str(cls.VECTOPLAN_LIBRARY_API_PREFIX)
            payload["requestTimeoutSeconds"] = float(cls.VECTOPLAN_LIBRARY_REQUEST_TIMEOUT)
            payload["maxResponseBytes"] = int(cls.VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES)
            payload["userAgent"] = str(cls.VECTOPLAN_LIBRARY_CLIENT_USER_AGENT)

        return payload

    @classmethod
    def build_inventory_config(cls) -> dict[str, Any]:
        return {
            "enabled": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ENABLED),
            "source": _DEFAULT_EDITOR_INVENTORY_SOURCE,
            "route": str(cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH),
            "hotbarSize": int(cls.VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE),
            "defaultSelectedSlot": int(cls.VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT),
            "libraryItemsLimit": int(cls.VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT),
            "allowChunkPlaceableFallback": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK),
            "allowEmptyFallback": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK),
            "iconOnly": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY),
            "scrollWrap": bool(cls.VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP),
            "allowPlaceAction": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION),
            "allowBreakAction": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION),
            "forceRefreshOnBoot": bool(cls.VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT),
            "onlyLibraryItemsPlaceable": True,
            "debugGrassDirtAllowed": False,
        }

    @classmethod
    def build_chunk_service_config(cls, include_internal: bool = False) -> dict[str, Any]:
        route_hints = cls.build_chunk_route_hints()
        chunk_context = cls.build_chunk_context_config()

        payload: dict[str, Any] = {
            "enabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "mode": str(cls.EDITOR_CHUNK_SERVICE_MODE),
            "sourceKind": str(cls.EDITOR_CHUNK_SERVICE_SOURCE_KIND),
            "apiBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL),
            "browserBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL),
            "projectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "universeId": str(cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID),
            "worldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "appProjectPublicId": str(cls.EDITOR_APP_PROJECT_PUBLIC_ID),
            "chunkProjectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "chunkUniverseId": str(cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID),
            "chunkWorldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "chunkStatus": str(cls.EDITOR_CHUNK_CONTEXT_STATUS),
            "chunkReady": bool(cls.EDITOR_CHUNK_CONTEXT_READY),
            "context": chunk_context,
            "registryId": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_ID),
            "registryVersion": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_VERSION),
            "routeHints": route_hints,
            "requestTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS),
            "commandTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS),
            "batchTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS),
            "statusTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS),
            "preferBatchLoad": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD),
            "reloadDirtyChunksAfterCommand": bool(
                cls.EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND
            ),
            "maxBatchChunks": int(cls.EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS),
            "allowGenerated": bool(cls.EDITOR_CHUNK_SERVICE_ALLOW_GENERATED),
            "preferSnapshot": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT),
        }

        if include_internal:
            payload["internalBaseUrl"] = str(cls.EDITOR_CHUNK_SERVICE_BASE_URL)
            payload["internalUrl"] = str(cls.EDITOR_CHUNK_SERVICE_BASE_URL)
            payload["maxResponseBytes"] = int(cls.EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES)
            payload["statusPaths"] = list(cls.EDITOR_CHUNK_SERVICE_STATUS_PATHS)

        return payload

    @classmethod
    def build_chunk_proxy_settings(cls) -> dict[str, Any]:
        return {
            "enabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "internalBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BASE_URL),
            "internalUrl": str(cls.EDITOR_CHUNK_SERVICE_BASE_URL),
            "browserBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL),
            "apiPrefix": str(cls.EDITOR_CHUNK_SERVICE_API_PREFIX),
            "projectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "universeId": str(cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID),
            "worldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "appProjectPublicId": str(cls.EDITOR_APP_PROJECT_PUBLIC_ID),
            "chunkProjectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "chunkUniverseId": str(cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID),
            "chunkWorldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "chunkStatus": str(cls.EDITOR_CHUNK_CONTEXT_STATUS),
            "chunkReady": bool(cls.EDITOR_CHUNK_CONTEXT_READY),
            "context": cls.build_chunk_context_config(),
            "sourceKind": str(cls.EDITOR_CHUNK_SERVICE_SOURCE_KIND),
            "mode": str(cls.EDITOR_CHUNK_SERVICE_MODE),
            "registryId": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_ID),
            "registryVersion": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_VERSION),
            "requestTimeoutSeconds": float(cls.EDITOR_CHUNK_REQUEST_TIMEOUT),
            "commandTimeoutSeconds": float(cls.EDITOR_CHUNK_COMMAND_TIMEOUT),
            "batchTimeoutSeconds": float(cls.EDITOR_CHUNK_BATCH_TIMEOUT),
            "statusTimeoutSeconds": float(cls.EDITOR_CHUNK_STATUS_TIMEOUT),
            "requestTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS),
            "commandTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS),
            "batchTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS),
            "statusTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS),
            "preferBatchLoad": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD),
            "reloadDirtyChunksAfterCommand": bool(
                cls.EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND
            ),
            "maxBatchChunks": int(cls.EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS),
            "maxResponseBytes": int(cls.EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES),
            "allowGenerated": bool(cls.EDITOR_CHUNK_SERVICE_ALLOW_GENERATED),
            "preferSnapshot": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT),
            "statusPaths": list(cls.EDITOR_CHUNK_SERVICE_STATUS_PATHS),
            "routeHints": cls.build_chunk_route_hints(),
            "diagnostics": {
                "enabled": bool(cls.EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED),
                "includeUpstreamDetails": bool(cls.EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS),
            },
            "placeableBlocks": {
                "placeholderEnabled": bool(
                    cls.EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER
                ),
                "allowChunkPlaceableFallback": bool(
                    cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK
                ),
                "blocks": cls.get_placeable_blocks(),
                "debugOnly": True,
            },
            "forwardUserHeaders": bool(cls.EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS),
        }

    @classmethod
    def build_runtime_feature_flags(cls) -> dict[str, bool]:
        return {
            "chunkServiceEnabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "libraryServiceEnabled": bool(cls.VECTOPLAN_EDITOR_LIBRARY_ENABLED),
            "inventoryEnabled": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ENABLED),
            "libraryInventoryEnabled": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ENABLED),
            "chunkPlaceableFallbackEnabled": bool(cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK),
            "onlyLibraryItemsPlaceable": True,
            "debugBlocksAllowedInInventory": False,
            "localWorldFallbackEnabled": bool(cls.EDITOR_LOCAL_WORLD_FALLBACK_ENABLED),
            "legacyFrontendEnabled": bool(cls.EDITOR_LEGACY_FRONTEND_ENABLED),
            "pointerLockEnabled": bool(cls.EDITOR_ENABLE_POINTER_LOCK),
            "firstPersonEnabled": bool(cls.EDITOR_ENABLE_FIRST_PERSON),
            "debugOverlayEnabled": bool(cls.EDITOR_ENABLE_DEBUG_OVERLAY),
            "crosshairEnabled": bool(cls.EDITOR_ENABLE_CROSSHAIR),
            "hotbarEnabled": bool(cls.EDITOR_ENABLE_HOTBAR),
            "statusBarEnabled": bool(cls.EDITOR_ENABLE_STATUS_BAR),
            "loadingOverlayEnabled": bool(cls.EDITOR_ENABLE_LOADING_OVERLAY),
            "errorPanelEnabled": bool(cls.EDITOR_ENABLE_ERROR_PANEL),
            "remoteChunkServiceRequired": bool(cls.EDITOR_REMOTE_CHUNK_SERVICE_REQUIRED),
            "embedEnabled": bool(cls.VECTOPLAN_EDITOR_EMBED_ENABLED),
            "appProjectContextEnabled": True,
            "queryChunkContextOverridesDefaults": True,
        }

    @classmethod
    def build_editor_bootstrap_payload(cls) -> dict[str, Any]:
        chunk_config = cls.build_chunk_service_config(include_internal=False)
        library_config = cls.build_library_service_config(include_internal=False)
        inventory_config = cls.build_inventory_config()
        chunk_context = cls.build_chunk_context_config()

        return {
            "service": {
                "name": cls.APP_NAME,
                "displayName": cls.APP_DISPLAY_NAME,
                "version": cls.SERVICE_VERSION,
                "environment": cls.APP_ENV,
                "publicUrl": cls.VECTOPLAN_EDITOR_PUBLIC_URL,
                "route": cls.EDITOR_ROUTE_PATH,
            },
            "build": {
                "mode": cls.BUILD_MODE,
                "version": cls.BUILD_VERSION,
            },
            "project": {
                "appProjectPublicId": cls.EDITOR_APP_PROJECT_PUBLIC_ID,
                "projectPublicId": cls.EDITOR_APP_PROJECT_PUBLIC_ID,
                "projectId": cls.EDITOR_CHUNK_SERVICE_PROJECT_ID,
                "universeId": cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID,
                "worldId": cls.EDITOR_CHUNK_SERVICE_WORLD_ID,
                "chunkProjectId": cls.EDITOR_CHUNK_SERVICE_PROJECT_ID,
                "chunkUniverseId": cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID,
                "chunkWorldId": cls.EDITOR_CHUNK_SERVICE_WORLD_ID,
                "chunkStatus": cls.EDITOR_CHUNK_CONTEXT_STATUS,
                "chunkReady": bool(cls.EDITOR_CHUNK_CONTEXT_READY),
                "context": chunk_context,
            },
            "embed": {
                "enabled": bool(cls.VECTOPLAN_EDITOR_EMBED_ENABLED),
                "appPublicUrl": cls.VECTOPLAN_APP_PUBLIC_URL,
                "frameAncestors": cls.VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP,
            },
            "runtime": {
                "mode": cls.EDITOR_RUNTIME_MODE,
                "worldMode": cls.EDITOR_WORLD_MODE,
                "sourceMode": cls.EDITOR_SOURCE_MODE,
                "chunk": chunk_config,
                "chunkContext": chunk_context,
                "library": library_config,
                "inventory": inventory_config,
                "camera": {
                    "spawn": {
                        "x": float(cls.EDITOR_RUNTIME_SPAWN_X),
                        "y": float(cls.EDITOR_RUNTIME_SPAWN_Y),
                        "z": float(cls.EDITOR_RUNTIME_SPAWN_Z),
                    },
                    "yaw": float(cls.EDITOR_RUNTIME_INITIAL_YAW),
                    "pitch": float(cls.EDITOR_RUNTIME_INITIAL_PITCH),
                    "moveSpeed": float(cls.EDITOR_RUNTIME_MOVE_SPEED),
                    "sprintMultiplier": float(cls.EDITOR_RUNTIME_SPRINT_MULTIPLIER),
                    "lookSensitivity": float(cls.EDITOR_RUNTIME_LOOK_SENSITIVITY),
                    "playerHeight": float(cls.EDITOR_RUNTIME_PLAYER_HEIGHT),
                },
                "ui": {
                    "pageTitle": cls.EDITOR_PAGE_TITLE,
                    "brandName": cls.EDITOR_BRAND_NAME,
                    "statusInitial": cls.EDITOR_STATUS_INITIAL,
                    "statusLoading": cls.EDITOR_STATUS_LOADING,
                    "statusReady": cls.EDITOR_STATUS_READY,
                    "statusError": cls.EDITOR_STATUS_ERROR,
                    "pointerLockTitle": cls.EDITOR_POINTER_LOCK_TITLE,
                    "pointerLockMessage": cls.EDITOR_POINTER_LOCK_MESSAGE,
                    "pointerLockHint": cls.EDITOR_POINTER_LOCK_HINT,
                    "hotbarSlots": int(cls.VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE),
                    "defaultBlockTypeId": cls.EDITOR_HOTBAR_DEFAULT_BLOCK_TYPE_ID,
                    "inventoryRoute": cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH,
                    "inventorySource": cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE,
                },
                "featureFlags": cls.build_runtime_feature_flags(),
            },
            "library": library_config,
            "inventory": inventory_config,
            "featureFlags": cls.build_runtime_feature_flags(),
        }

    @classmethod
    def build_root_dataset_values(cls) -> dict[str, str]:
        chunk_config = cls.build_chunk_service_config(include_internal=False)
        library_config = cls.build_library_service_config(include_internal=False)
        inventory_config = cls.build_inventory_config()

        return {
            "editor-root": "true",
            "editor-runtime-mode": cls.EDITOR_RUNTIME_MODE,
            "editor-world-mode": cls.EDITOR_WORLD_MODE,
            "editor-source-mode": cls.EDITOR_SOURCE_MODE,
            "editor-build-mode": cls.BUILD_MODE,
            "editor-build-version": cls.BUILD_VERSION,
            "editor-public-url": cls.VECTOPLAN_EDITOR_PUBLIC_URL,
            "editor-route-path": cls.EDITOR_ROUTE_PATH,
            "editor-embed-enabled": "true" if cls.VECTOPLAN_EDITOR_EMBED_ENABLED else "false",
            "editor-frame-ancestors": cls.VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP,
            "app-project-public-id": str(cls.EDITOR_APP_PROJECT_PUBLIC_ID),
            "chunk-service-enabled": "true" if cls.EDITOR_CHUNK_SERVICE_ENABLED else "false",
            "chunk-service-api-base-url": chunk_config["apiBaseUrl"],
            "chunk-service-browser-base-url": chunk_config["browserBaseUrl"],
            "chunk-service-project-id": chunk_config["projectId"],
            "chunk-service-universe-id": chunk_config["universeId"],
            "chunk-service-world-id": chunk_config["worldId"],
            "chunk-project-id": chunk_config["chunkProjectId"],
            "chunk-universe-id": chunk_config["chunkUniverseId"],
            "chunk-world-id": chunk_config["chunkWorldId"],
            "chunk-status": str(cls.EDITOR_CHUNK_CONTEXT_STATUS),
            "chunk-ready": "true" if cls.EDITOR_CHUNK_CONTEXT_READY else "false",
            "chunk-service-source-kind": chunk_config["sourceKind"],
            "chunk-service-mode": chunk_config["mode"],
            "library-service-enabled": "true" if cls.VECTOPLAN_EDITOR_LIBRARY_ENABLED else "false",
            "library-browser-base-url": library_config["browserBaseUrl"],
            "library-inventory-route": library_config["inventoryRoute"],
            "inventory-enabled": "true" if inventory_config["enabled"] else "false",
            "inventory-source": inventory_config["source"],
            "inventory-route": inventory_config["route"],
            "inventory-hotbar-size": str(inventory_config["hotbarSize"]),
            "inventory-default-selected-slot": str(inventory_config["defaultSelectedSlot"]),
            "inventory-only-library-items-placeable": "true",
            "inventory-chunk-placeable-fallback": "true"
            if inventory_config["allowChunkPlaceableFallback"]
            else "false",
        }

    @classmethod
    def build_editor_template_context(cls) -> dict[str, Any]:
        static_paths = cls.get_static_paths()
        chunk_config = cls.build_chunk_service_config(include_internal=False)
        chunk_proxy = cls.build_chunk_proxy_settings()
        library_config = cls.build_library_service_config(include_internal=False)
        inventory_config = cls.build_inventory_config()
        chunk_context = cls.build_chunk_context_config()

        return {
            "app_name": cls.APP_NAME,
            "app_display_name": cls.APP_DISPLAY_NAME,
            "page_title": cls.EDITOR_PAGE_TITLE,
            "brand_name": cls.EDITOR_BRAND_NAME,
            "editor_public_url": cls.VECTOPLAN_EDITOR_PUBLIC_URL,
            "editor_iframe_url": cls.VECTOPLAN_EDITOR_IFRAME_URL,
            "editor_route_path": cls.EDITOR_ROUTE_PATH,
            "editor_template_name": cls.EDITOR_TEMPLATE_NAME,
            "editor_template_mode": cls.EDITOR_TEMPLATE_MODE,
            "editor_runtime_mode": cls.EDITOR_RUNTIME_MODE,
            "editor_world_mode": cls.EDITOR_WORLD_MODE,
            "editor_source_mode": cls.EDITOR_SOURCE_MODE,
            "build_mode": cls.BUILD_MODE,
            "build_version": cls.BUILD_VERSION,
            "service_version": cls.SERVICE_VERSION,
            "static_editor_url_prefix": cls.STATIC_EDITOR_URL_PREFIX,
            "static_editor_manifest_name": cls.STATIC_EDITOR_MANIFEST_NAME,
            "static_editor_manifest_url": static_paths["manifestUrl"],
            "vite_entrypoint": cls.VITE_ENTRYPOINT,
            "use_vite_manifest": bool(cls.USE_VITE_MANIFEST),
            "strict_asset_checks": bool(cls.STRICT_ASSET_CHECKS),
            "fallback_static_js": cls.FALLBACK_STATIC_JS,
            "fallback_static_css": cls.FALLBACK_STATIC_CSS,
            "status_initial": cls.EDITOR_STATUS_INITIAL,
            "status_loading": cls.EDITOR_STATUS_LOADING,
            "status_ready": cls.EDITOR_STATUS_READY,
            "status_error": cls.EDITOR_STATUS_ERROR,
            "pointer_lock_title": cls.EDITOR_POINTER_LOCK_TITLE,
            "pointer_lock_message": cls.EDITOR_POINTER_LOCK_MESSAGE,
            "pointer_lock_hint": cls.EDITOR_POINTER_LOCK_HINT,
            "embed": cls.build_embed_security_config(),
            "security": cls.build_security_header_config(),
            "feature_flags": cls.build_runtime_feature_flags(),
            "bootstrap_payload": cls.build_editor_bootstrap_payload(),
            "root_dataset_values": cls.build_root_dataset_values(),
            "chunk": chunk_config,
            "chunk_config": chunk_config,
            "chunk_context": chunk_context,
            "chunk_proxy": chunk_proxy,
            "chunk_route_hints": cls.build_chunk_route_hints(),
            "chunk_enabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "chunk_api_base_url": cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL,
            "chunk_browser_base_url": cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL,
            "app_project_public_id": cls.EDITOR_APP_PROJECT_PUBLIC_ID,
            "chunk_project_id": cls.EDITOR_CHUNK_SERVICE_PROJECT_ID,
            "chunk_universe_id": cls.EDITOR_CHUNK_SERVICE_UNIVERSE_ID,
            "chunk_world_id": cls.EDITOR_CHUNK_SERVICE_WORLD_ID,
            "chunk_status": cls.EDITOR_CHUNK_CONTEXT_STATUS,
            "chunk_ready": bool(cls.EDITOR_CHUNK_CONTEXT_READY),
            "library": library_config,
            "library_config": library_config,
            "library_route_hints": cls.build_library_route_hints(),
            "inventory": inventory_config,
            "inventory_config": inventory_config,
            "inventory_route": cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH,
            "inventory_source": cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE,
            "placeable_blocks": cls.get_placeable_blocks(),
            "hotbar_slots": cls.get_editor_slot_labels(),
        }

    @classmethod
    def validate(cls) -> list[str]:
        errors: list[str] = []

        def require_text(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{attribute_name} muss ein nicht-leerer String sein.")

        def require_path(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, Path):
                errors.append(f"{attribute_name} muss ein pathlib.Path sein.")

        def require_bool(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, bool):
                errors.append(f"{attribute_name} muss ein bool sein.")

        def require_positive_number(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, (int, float)) or value <= 0:
                errors.append(f"{attribute_name} muss numerisch und größer als 0 sein.")

        for attribute_name in (
            "APP_NAME",
            "APP_DISPLAY_NAME",
            "APP_ENV",
            "EDITOR_ROUTE_PATH",
            "EDITOR_TEMPLATE_NAME",
            "STATIC_EDITOR_URL_PREFIX",
            "STATIC_EDITOR_MANIFEST_NAME",
            "VITE_ENTRYPOINT",
            "EDITOR_RUNTIME_MODE",
            "EDITOR_WORLD_MODE",
            "EDITOR_SOURCE_MODE",
            "EDITOR_CHUNK_SERVICE_BASE_URL",
            "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
            "EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "EDITOR_CHUNK_SERVICE_UNIVERSE_ID",
            "EDITOR_CHUNK_SERVICE_WORLD_ID",
            "EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            "EDITOR_CHUNK_SERVICE_MODE",
            "EDITOR_CHUNK_CONTEXT_STATUS",
            "VECTOPLAN_LIBRARY_BASE_URL",
            "VECTOPLAN_LIBRARY_API_PREFIX",
            "VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH",
            "VECTOPLAN_EDITOR_INVENTORY_SOURCE",
            "VECTOPLAN_EDITOR_PUBLIC_URL",
            "VECTOPLAN_APP_PUBLIC_URL",
            "VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP",
        ):
            require_text(attribute_name)

        for attribute_name in (
            "SERVICE_ROOT",
            "SRC_ROOT",
            "BACKEND_BOOTSTRAP_ROOT",
            "CLIENTS_ROOT",
            "INVENTORY_ROOT",
            "LIBRARY_INVENTORY_ROOT",
            "ROUTES_ROOT",
            "TEMPLATES_ROOT",
            "TEMPLATES_EDITOR_ROOT",
            "STATIC_ROOT",
            "STATIC_EDITOR_ROOT",
            "FRONTEND_ROOT",
            "FRONTEND_SRC_ROOT",
            "LEGACY_FRONTEND_ROOT",
            "STATIC_EDITOR_MANIFEST_PATH",
            "STATIC_EDITOR_ASSETS_ROOT",
        ):
            require_path(attribute_name)

        for attribute_name in (
            "DEBUG",
            "TESTING",
            "USE_VITE_MANIFEST",
            "STRICT_ASSET_CHECKS",
            "EDITOR_CHUNK_SERVICE_ENABLED",
            "EDITOR_CHUNK_CONTEXT_READY",
            "EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            "EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "EDITOR_LOCAL_WORLD_FALLBACK_ENABLED",
            "EDITOR_LEGACY_FRONTEND_ENABLED",
            "VECTOPLAN_EDITOR_LIBRARY_ENABLED",
            "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
            "VECTOPLAN_EDITOR_EMBED_ENABLED",
            "VECTOPLAN_EDITOR_CSP_ENABLED",
            "VECTOPLAN_EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED",
        ):
            require_bool(attribute_name)

        for attribute_name in (
            "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
            "EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
            "EDITOR_RUNTIME_MOVE_SPEED",
            "EDITOR_RUNTIME_SPRINT_MULTIPLIER",
            "EDITOR_RUNTIME_LOOK_SENSITIVITY",
            "EDITOR_RUNTIME_PLAYER_HEIGHT",
            "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS",
            "VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS",
            "VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES",
            "VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE",
            "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
        ):
            require_positive_number(attribute_name)

        if isinstance(cls.EDITOR_ROUTE_PATH, str) and not cls.EDITOR_ROUTE_PATH.startswith("/"):
            errors.append("EDITOR_ROUTE_PATH muss mit '/' beginnen.")

        if isinstance(cls.STATIC_EDITOR_URL_PREFIX, str) and not cls.STATIC_EDITOR_URL_PREFIX.startswith("/"):
            errors.append("STATIC_EDITOR_URL_PREFIX muss mit '/' beginnen.")

        if isinstance(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL, str):
            if not cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL.startswith("/"):
                errors.append("EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL muss mit '/' beginnen.")

        if isinstance(cls.EDITOR_CHUNK_SERVICE_API_PREFIX, str):
            if not cls.EDITOR_CHUNK_SERVICE_API_PREFIX.startswith("/"):
                errors.append("EDITOR_CHUNK_SERVICE_API_PREFIX muss mit '/' beginnen.")

        if isinstance(cls.EDITOR_CHUNK_SERVICE_BASE_URL, str):
            if not (
                cls.EDITOR_CHUNK_SERVICE_BASE_URL.startswith("http://")
                or cls.EDITOR_CHUNK_SERVICE_BASE_URL.startswith("https://")
            ):
                errors.append("EDITOR_CHUNK_SERVICE_BASE_URL muss mit http:// oder https:// beginnen.")

        if isinstance(cls.VECTOPLAN_LIBRARY_BASE_URL, str):
            if not (
                cls.VECTOPLAN_LIBRARY_BASE_URL.startswith("http://")
                or cls.VECTOPLAN_LIBRARY_BASE_URL.startswith("https://")
            ):
                errors.append("VECTOPLAN_LIBRARY_BASE_URL muss mit http:// oder https:// beginnen.")

        if isinstance(cls.VECTOPLAN_EDITOR_PUBLIC_URL, str):
            if not (
                cls.VECTOPLAN_EDITOR_PUBLIC_URL.startswith("http://")
                or cls.VECTOPLAN_EDITOR_PUBLIC_URL.startswith("https://")
            ):
                errors.append("VECTOPLAN_EDITOR_PUBLIC_URL muss mit http:// oder https:// beginnen.")

        if isinstance(cls.VECTOPLAN_APP_PUBLIC_URL, str):
            if not (
                cls.VECTOPLAN_APP_PUBLIC_URL.startswith("http://")
                or cls.VECTOPLAN_APP_PUBLIC_URL.startswith("https://")
            ):
                errors.append("VECTOPLAN_APP_PUBLIC_URL muss mit http:// oder https:// beginnen.")

        if isinstance(cls.VECTOPLAN_LIBRARY_API_PREFIX, str):
            if not cls.VECTOPLAN_LIBRARY_API_PREFIX.startswith("/"):
                errors.append("VECTOPLAN_LIBRARY_API_PREFIX muss mit '/' beginnen.")

        if isinstance(cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH, str):
            if not cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH.startswith("/"):
                errors.append("VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH muss mit '/' beginnen.")

        if "*" in tuple(cls.VECTOPLAN_EDITOR_FRAME_ANCESTORS):
            errors.append("VECTOPLAN_EDITOR_FRAME_ANCESTORS darf für iframe-Embedding kein '*' enthalten.")

        if cls.EDITOR_CHUNK_CONTEXT_STATUS not in {"ready", "pending", "error", "disabled"}:
            errors.append("EDITOR_CHUNK_CONTEXT_STATUS muss ready, pending, error oder disabled sein.")

        if cls.EDITOR_LOCAL_WORLD_FALLBACK_ENABLED:
            errors.append(
                "EDITOR_LOCAL_WORLD_FALLBACK_ENABLED ist aktiv. Für den Remote-Chunk-Slice sollte der Wert false sein."
            )

        if cls.EDITOR_LEGACY_FRONTEND_ENABLED:
            errors.append(
                "EDITOR_LEGACY_FRONTEND_ENABLED ist aktiv. Für src/frontend sollte der Wert false sein."
            )

        if cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE not in {
            "library",
            "editor-inventory",
            "vectoplan-user-inventory",
        }:
            errors.append(
                "VECTOPLAN_EDITOR_INVENTORY_SOURCE muss eine VPLIB-/User-Inventarquelle sein."
            )

        if cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK:
            errors.append(
                "VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK ist aktiv. Dadurch könnten Debug-Blöcke wieder als Fallback erscheinen."
            )

        return errors


# =============================================================================
# Umgebungsspezifische Klassen
# =============================================================================

class Config(BaseConfig):
    """
    Default-Konfiguration für lokale Entwicklung.
    """

    APP_ENV = _read_str_env("VECTOPLAN_EDITOR_ENV", "development")
    DEBUG = _read_bool_env("VECTOPLAN_EDITOR_DEBUG", True)
    TESTING = _read_bool_env("VECTOPLAN_EDITOR_TESTING", False)
    TEMPLATES_AUTO_RELOAD = _read_bool_env(
        "VECTOPLAN_EDITOR_TEMPLATES_AUTO_RELOAD",
        True,
    )


class DevelopmentConfig(BaseConfig):
    """
    Explizite Entwicklungs-Konfiguration.
    """

    APP_ENV = "development"
    DEBUG = True
    TESTING = False
    TEMPLATES_AUTO_RELOAD = True
    SEND_FILE_MAX_AGE_DEFAULT = 0
    EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED = True
    EDITOR_ENABLE_DEBUG_OVERLAY = True
    VECTOPLAN_EDITOR_LIBRARY_ENABLED = True
    VECTOPLAN_EDITOR_INVENTORY_ENABLED = True
    VECTOPLAN_EDITOR_EMBED_ENABLED = True


class TestingConfig(BaseConfig):
    """
    Test-Konfiguration.
    """

    APP_ENV = "testing"
    DEBUG = True
    TESTING = True
    SECRET_KEY = _read_str_env(
        "VECTOPLAN_EDITOR_TEST_SECRET_KEY",
        "test-secret-key",
    )
    TEMPLATES_AUTO_RELOAD = True
    SEND_FILE_MAX_AGE_DEFAULT = 0
    EDITOR_ENABLE_DEBUG_OVERLAY = False
    VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS = 0.0
    VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS = 0.0
    VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK = True
    VECTOPLAN_EDITOR_EMBED_ENABLED = True
    EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS = _read_int_env(
        "VECTOPLAN_EDITOR_TEST_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
        default=1_000,
        minimum=100,
        maximum=30_000,
    )
    EDITOR_CHUNK_STATUS_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS,
        1.0,
    )


class ProductionConfig(BaseConfig):
    """
    Produktionsnähere Konfiguration.
    """

    APP_ENV = "production"
    DEBUG = False
    TESTING = False
    TEMPLATES_AUTO_RELOAD = False
    SEND_FILE_MAX_AGE_DEFAULT = _read_int_env(
        "VECTOPLAN_EDITOR_SEND_FILE_MAX_AGE_DEFAULT",
        default=3600,
        minimum=0,
    )
    SESSION_COOKIE_SECURE = _read_bool_env(
        "VECTOPLAN_EDITOR_SESSION_COOKIE_SECURE",
        True,
    )
    EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED = _read_bool_env(
        "VECTOPLAN_EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED",
        False,
    )
    EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS = _read_bool_env(
        "VECTOPLAN_EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
        False,
    )
    STRICT_ASSET_CHECKS = _read_bool_env(
        "VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS",
        True,
    )
    VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE = True
    VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK = False
    VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK = False


CONFIG_BY_NAME: Final[dict[str, type[BaseConfig]]] = {
    "default": Config,
    "config": Config,
    "development": DevelopmentConfig,
    "dev": DevelopmentConfig,
    "testing": TestingConfig,
    "test": TestingConfig,
    "production": ProductionConfig,
    "prod": ProductionConfig,
}


def get_config_class(name: str | None = None) -> type[BaseConfig]:
    requested_name = _normalize_text(name)

    if requested_name is None:
        requested_name = _read_str_env("VECTOPLAN_EDITOR_CONFIG", "default")

    key = requested_name.lower()
    return CONFIG_BY_NAME.get(key, Config)


__all__ = [
    "BaseConfig",
    "Config",
    "DevelopmentConfig",
    "TestingConfig",
    "ProductionConfig",
    "CONFIG_BY_NAME",
    "get_config_class",
    "refresh_env_cache",
]
