# services/vectoplan-editor/src/clients/library_client.py
"""
Serverseitiger HTTP-Client für den VECTOPLAN Library-Service.

Zweck:
- `vectoplan-editor` darf im Browser nicht direkt `vectoplan-library` aufrufen.
- Der Editor-Backend-Service lädt Library-/Inventory-/Published-Daten serverseitig.
- Diese Datei kapselt HTTP, Konfiguration, Fehlerbehandlung, Caching und
  defensive Payload-Normalisierung.
- Die Datei enthält keine Frontend-, DOM-, Runtime-, Chunk- oder Hotbar-Logik.

Typischer Zielpfad:

    Browser
      -> GET /editor/api/inventory
      -> routes/inventory.py
      -> src.inventory
      -> src.clients.library_client
      -> http://vectoplan-library:5000/api/v1/vplib/library/...

Wichtige Endpunkte des Library-Service:

    GET /api/v1/vplib/library/health
    GET /api/v1/vplib/library/db/health
    GET /api/v1/vplib/library/publication-status
    GET /api/v1/vplib/library/blocks?source=db
    GET /api/v1/vplib/library/tree?source=db
    GET /api/v1/vplib/library/inventory
    GET /api/v1/vplib/library/blocks/<block_id>?source=db
    GET /api/v1/vplib/library/blocks/<block_id>/variants?source=db

Robustheitsprinzipien:
- keine harte Flask-Abhängigkeit beim Import
- stdlib-only HTTP via urllib
- defensive Config-Auflösung aus Flask config und Environment
- kurze TTL-Caches für erfolgreiche GET-Responses
- optionaler stale-cache bei temporären Transportfehlern
- klare Exception-Klassen
- JSON-kompatible Diagnose-Payloads
- stabile Convenience-Funktionen für spätere Routen/Payload-Builder
"""

from __future__ import annotations

import copy
import dataclasses
import json
import os
import threading
import time
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import UTC, datetime
from http import HTTPStatus
from types import TracebackType
from typing import Any, Final
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


# -----------------------------------------------------------------------------
# Modulkonstanten
# -----------------------------------------------------------------------------

LIBRARY_CLIENT_MODULE_NAME: Final[str] = "src.clients.library_client"
LIBRARY_CLIENT_MODULE_VERSION: Final[str] = "0.1.0"

DEFAULT_LIBRARY_BASE_URL: Final[str] = "http://vectoplan-library:5000"
DEFAULT_LIBRARY_API_PREFIX: Final[str] = "/api/v1/vplib/library"
DEFAULT_TIMEOUT_SECONDS: Final[float] = 5.0
DEFAULT_CACHE_TTL_SECONDS: Final[float] = 5.0
DEFAULT_STALE_CACHE_TTL_SECONDS: Final[float] = 60.0
DEFAULT_MAX_RESPONSE_BYTES: Final[int] = 10 * 1024 * 1024
DEFAULT_USER_AGENT: Final[str] = (
    f"vectoplan-editor-library-client/{LIBRARY_CLIENT_MODULE_VERSION}"
)

DEFAULT_SOURCE: Final[str] = "db"
DEFAULT_INVENTORY_HOTBAR_SIZE: Final[int] = 9

CONFIG_BASE_URL_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_BASE_URL",
    "VECTOPLAN_LIBRARY_URL",
    "VECTOPLAN_LIBRARY_SERVICE_URL",
    "VECTOPLAN_EDITOR_LIBRARY_BASE_URL",
)

CONFIG_API_PREFIX_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_API_PREFIX",
    "VECTOPLAN_EDITOR_LIBRARY_API_PREFIX",
)

CONFIG_TIMEOUT_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT",
    "VECTOPLAN_LIBRARY_TIMEOUT_SECONDS",
    "VECTOPLAN_EDITOR_LIBRARY_REQUEST_TIMEOUT",
    "VECTOPLAN_EDITOR_LIBRARY_TIMEOUT_SECONDS",
)

CONFIG_CACHE_TTL_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS",
    "VECTOPLAN_EDITOR_LIBRARY_CACHE_TTL_SECONDS",
)

CONFIG_STALE_CACHE_TTL_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS",
    "VECTOPLAN_EDITOR_LIBRARY_STALE_CACHE_TTL_SECONDS",
)

CONFIG_ALLOW_STALE_CACHE_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE",
    "VECTOPLAN_EDITOR_LIBRARY_ALLOW_STALE_CACHE",
)

CONFIG_MAX_RESPONSE_BYTES_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES",
    "VECTOPLAN_EDITOR_LIBRARY_MAX_RESPONSE_BYTES",
)

CONFIG_USER_AGENT_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_LIBRARY_CLIENT_USER_AGENT",
    "VECTOPLAN_EDITOR_LIBRARY_USER_AGENT",
)

CONFIG_INVENTORY_SOURCE_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_EDITOR_INVENTORY_SOURCE",
    "VECTOPLAN_LIBRARY_INVENTORY_SOURCE",
)

CONFIG_ALLOW_CHUNK_FALLBACK_KEYS: Final[tuple[str, ...]] = (
    "VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK",
    "VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
)

HTTP_JSON_CONTENT_TYPES: Final[tuple[str, ...]] = (
    "application/json",
    "application/problem+json",
    "text/json",
)


# -----------------------------------------------------------------------------
# Exceptions
# -----------------------------------------------------------------------------

class LibraryClientError(RuntimeError):
    """
    Basisklasse für alle Fehler dieses Clients.
    """


class LibraryClientConfigurationError(LibraryClientError):
    """
    Fehlerhafte oder unvollständige Client-Konfiguration.
    """


class LibraryClientTransportError(LibraryClientError):
    """
    Netzwerk-, DNS-, Timeout- oder Verbindungsfehler.
    """


class LibraryClientHTTPError(LibraryClientError):
    """
    HTTP-Fehlerantwort des Library-Service.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        url: str | None = None,
        payload: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.url = url
        self.payload = dict(payload or {})


class LibraryClientPayloadError(LibraryClientError):
    """
    Payload ist nicht erwartungsgemäß, nicht JSON oder nicht mapping-kompatibel.
    """


# -----------------------------------------------------------------------------
# Dataclasses
# -----------------------------------------------------------------------------

@dataclasses.dataclass(frozen=True)
class LibraryClientConfig:
    """
    Laufzeitkonfiguration für den Library-Client.
    """

    base_url: str = DEFAULT_LIBRARY_BASE_URL
    api_prefix: str = DEFAULT_LIBRARY_API_PREFIX
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    cache_ttl_seconds: float = DEFAULT_CACHE_TTL_SECONDS
    stale_cache_ttl_seconds: float = DEFAULT_STALE_CACHE_TTL_SECONDS
    allow_stale_cache: bool = True
    max_response_bytes: int = DEFAULT_MAX_RESPONSE_BYTES
    user_agent: str = DEFAULT_USER_AGENT
    inventory_source: str = "library"
    allow_chunk_placeable_fallback: bool = False

    def normalized(self) -> "LibraryClientConfig":
        """
        Liefert eine defensiv normalisierte Konfiguration.
        """
        base_url = _normalize_base_url(self.base_url, DEFAULT_LIBRARY_BASE_URL)
        api_prefix = _normalize_api_prefix(self.api_prefix, DEFAULT_LIBRARY_API_PREFIX)

        timeout_seconds = _clamp_float(
            self.timeout_seconds,
            default=DEFAULT_TIMEOUT_SECONDS,
            minimum=0.2,
            maximum=120.0,
        )

        cache_ttl_seconds = _clamp_float(
            self.cache_ttl_seconds,
            default=DEFAULT_CACHE_TTL_SECONDS,
            minimum=0.0,
            maximum=3600.0,
        )

        stale_cache_ttl_seconds = _clamp_float(
            self.stale_cache_ttl_seconds,
            default=DEFAULT_STALE_CACHE_TTL_SECONDS,
            minimum=0.0,
            maximum=24 * 3600.0,
        )

        max_response_bytes = _clamp_int(
            self.max_response_bytes,
            default=DEFAULT_MAX_RESPONSE_BYTES,
            minimum=1024,
            maximum=100 * 1024 * 1024,
        )

        user_agent = _coerce_text(self.user_agent, DEFAULT_USER_AGENT)
        inventory_source = _coerce_text(self.inventory_source, "library").lower()

        return dataclasses.replace(
            self,
            base_url=base_url,
            api_prefix=api_prefix,
            timeout_seconds=timeout_seconds,
            cache_ttl_seconds=cache_ttl_seconds,
            stale_cache_ttl_seconds=stale_cache_ttl_seconds,
            max_response_bytes=max_response_bytes,
            user_agent=user_agent,
            inventory_source=inventory_source,
            allow_stale_cache=bool(self.allow_stale_cache),
            allow_chunk_placeable_fallback=bool(self.allow_chunk_placeable_fallback),
        )

    def fingerprint(self) -> str:
        """
        Stabiler Cache-Key für Client-Instanzen.
        """
        normalized = self.normalized()

        return "|".join(
            (
                normalized.base_url,
                normalized.api_prefix,
                str(normalized.timeout_seconds),
                str(normalized.cache_ttl_seconds),
                str(normalized.stale_cache_ttl_seconds),
                str(normalized.allow_stale_cache),
                str(normalized.max_response_bytes),
                normalized.user_agent,
                normalized.inventory_source,
                str(normalized.allow_chunk_placeable_fallback),
            )
        )

    def to_dict(self) -> dict[str, Any]:
        """
        JSON-kompatible Diagnoseform.
        """
        normalized = self.normalized()

        return {
            "baseUrl": normalized.base_url,
            "apiPrefix": normalized.api_prefix,
            "timeoutSeconds": normalized.timeout_seconds,
            "cacheTtlSeconds": normalized.cache_ttl_seconds,
            "staleCacheTtlSeconds": normalized.stale_cache_ttl_seconds,
            "allowStaleCache": normalized.allow_stale_cache,
            "maxResponseBytes": normalized.max_response_bytes,
            "userAgent": normalized.user_agent,
            "inventorySource": normalized.inventory_source,
            "allowChunkPlaceableFallback": normalized.allow_chunk_placeable_fallback,
        }


@dataclasses.dataclass(frozen=True)
class LibraryClientResponse:
    """
    Einheitliche Response-Hülle für HTTP-Requests an `vectoplan-library`.
    """

    ok: bool
    method: str
    url: str
    path: str
    query: dict[str, Any]
    status_code: int | None = None
    payload: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    from_cache: bool = False
    stale: bool = False
    fetched_at_utc: str = ""
    duration_ms: float | None = None
    headers: dict[str, str] = dataclasses.field(default_factory=dict)

    def require_payload(self) -> dict[str, Any]:
        """
        Liefert Payload oder wirft eine aussagekräftige Exception.
        """
        if self.ok and isinstance(self.payload, dict):
            return self.payload

        message = _coerce_text(
            _deep_get(self.error, ("message",), None)
            or _deep_get(self.error, ("error", "message"), None)
            or _deep_get(self.payload, ("error", "message"), None),
            "Library-Service-Response ist nicht erfolgreich.",
        )

        if self.status_code is not None and self.status_code >= 400:
            raise LibraryClientHTTPError(
                message,
                status_code=self.status_code,
                url=self.url,
                payload=self.payload,
            )

        raise LibraryClientPayloadError(message)

    def to_dict(self) -> dict[str, Any]:
        """
        JSON-kompatible Diagnoseform.
        """
        return {
            "ok": self.ok,
            "method": self.method,
            "url": self.url,
            "path": self.path,
            "query": _to_json_compatible(self.query),
            "statusCode": self.status_code,
            "payload": _to_json_compatible(self.payload),
            "error": _to_json_compatible(self.error),
            "fromCache": self.from_cache,
            "stale": self.stale,
            "fetchedAtUtc": self.fetched_at_utc,
            "durationMs": self.duration_ms,
            "headers": _to_json_compatible(self.headers),
        }


@dataclasses.dataclass(frozen=True)
class LibraryClientHealth:
    """
    Kleine Health-/Diagnoseantwort des Clients selbst.
    """

    ok: bool
    status: str
    generated_at_utc: str
    config: dict[str, Any]
    cache: dict[str, Any]
    module: dict[str, Any]
    library: dict[str, Any] | None = None
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "status": self.status,
            "generatedAtUtc": self.generated_at_utc,
            "config": _to_json_compatible(self.config),
            "cache": _to_json_compatible(self.cache),
            "module": _to_json_compatible(self.module),
            "library": _to_json_compatible(self.library),
            "error": _to_json_compatible(self.error),
        }


@dataclasses.dataclass
class _CachedResponse:
    """
    Interner TTL-Cache-Eintrag.
    """

    response: LibraryClientResponse
    created_at_monotonic: float
    expires_at_monotonic: float
    stale_until_monotonic: float


# -----------------------------------------------------------------------------
# Kleine robuste Hilfsfunktionen
# -----------------------------------------------------------------------------

def _utc_now() -> datetime:
    try:
        return datetime.now(UTC)
    except Exception:
        return datetime.utcnow().replace(tzinfo=UTC)


def _utc_iso() -> str:
    try:
        return _utc_now().isoformat()
    except Exception:
        return "1970-01-01T00:00:00+00:00"


def _monotonic() -> float:
    try:
        return time.monotonic()
    except Exception:
        return time.time()


def _coerce_text(value: Any, default: str = "") -> str:
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


def _normalize_optional_text(value: Any) -> str | None:
    normalized = _coerce_text(value, "")
    return normalized or None


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


def _coerce_float(value: Any, default: float) -> float:
    if isinstance(value, bool):
        return default

    if isinstance(value, (int, float)):
        try:
            return float(value)
        except Exception:
            return default

    if isinstance(value, str):
        try:
            return float(value.strip())
        except Exception:
            return default

    return default


def _coerce_int(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return default

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        try:
            return int(value)
        except Exception:
            return default

    if isinstance(value, str):
        try:
            return int(float(value.strip()))
        except Exception:
            return default

    return default


def _clamp_float(
    value: Any,
    *,
    default: float,
    minimum: float,
    maximum: float,
) -> float:
    number = _coerce_float(value, default)

    if number < minimum:
        return minimum

    if number > maximum:
        return maximum

    return number


def _clamp_int(
    value: Any,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    number = _coerce_int(value, default)

    if number < minimum:
        return minimum

    if number > maximum:
        return maximum

    return number


def _normalize_base_url(value: Any, default: str) -> str:
    normalized = _coerce_text(value, default).rstrip("/")

    if not normalized:
        normalized = default.rstrip("/")

    if not normalized.startswith(("http://", "https://")):
        raise LibraryClientConfigurationError(
            "VECTOPLAN Library Base URL muss mit http:// oder https:// beginnen."
        )

    return normalized


def _normalize_api_prefix(value: Any, default: str) -> str:
    normalized = _coerce_text(value, default)

    if not normalized:
        normalized = default

    normalized = "/" + normalized.strip("/")

    return normalized.rstrip("/") or "/"


def _quote_path_segment(value: Any) -> str:
    return quote(_coerce_text(value, ""), safe="")


def _strip_none_query_values(query: Mapping[str, Any] | None) -> dict[str, Any]:
    if not query:
        return {}

    result: dict[str, Any] = {}

    for key, value in query.items():
        normalized_key = _coerce_text(key, "")
        if not normalized_key:
            continue

        if value is None:
            continue

        if isinstance(value, str) and not value.strip():
            continue

        if isinstance(value, bool):
            result[normalized_key] = "true" if value else "false"
            continue

        if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            values: list[str] = []
            for item in value:
                if item is None:
                    continue
                normalized_item = _coerce_text(item, "")
                if normalized_item:
                    values.append(normalized_item)
            if values:
                result[normalized_key] = values
            continue

        result[normalized_key] = value

    return result


def _build_query_string(query: Mapping[str, Any] | None) -> str:
    cleaned = _strip_none_query_values(query)

    if not cleaned:
        return ""

    return urlencode(cleaned, doseq=True)


def _safe_copy_json(value: Any) -> Any:
    try:
        return copy.deepcopy(value)
    except Exception:
        try:
            return json.loads(json.dumps(value, default=str))
        except Exception:
            return value


def _to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    if depth > 30:
        return _coerce_text(value, "<max-depth>")

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if dataclasses.is_dataclass(value):
        try:
            return _to_json_compatible(dataclasses.asdict(value), depth=depth + 1)
        except Exception:
            return _coerce_text(value, "")

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

    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8")
        except Exception:
            return "<bytes>"

    if isinstance(value, BaseException):
        return {
            "type": value.__class__.__name__,
            "message": _coerce_text(value, ""),
        }

    return _coerce_text(value, "")


def _deep_get(
    value: Any,
    path: Sequence[str],
    default: Any = None,
) -> Any:
    current = value

    for key in path:
        if not isinstance(current, Mapping):
            return default

        try:
            current = current.get(key)
        except Exception:
            return default

    return current if current is not None else default


def _mapping_get_any(
    mapping: Mapping[str, Any] | MutableMapping[str, Any] | None,
    keys: Sequence[str],
    default: Any = None,
) -> Any:
    if mapping is None:
        return default

    for key in keys:
        try:
            if key in mapping:
                value = mapping[key]
                if value is not None:
                    return value
        except Exception:
            continue

    return default


def _env_get_any(keys: Sequence[str], default: Any = None) -> Any:
    for key in keys:
        try:
            value = os.environ.get(key)
            if value is not None:
                return value
        except Exception:
            continue

    return default


def _config_or_env_get(
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None,
    keys: Sequence[str],
    default: Any = None,
) -> Any:
    config_value = _mapping_get_any(config_source, keys, None)
    if config_value is not None:
        return config_value

    return _env_get_any(keys, default)


def _safe_get_flask_config() -> Mapping[str, Any] | None:
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            return current_app.config
    except Exception:
        return None

    return None


def _safe_get_flask_logger() -> Any | None:
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            return current_app.logger
    except Exception:
        return None

    return None


def _safe_request_id() -> str | None:
    try:
        from flask import has_request_context, request

        if not has_request_context():
            return None

        header_names = (
            "X-Request-ID",
            "X-Correlation-ID",
            "X-VECTOPLAN-Request-ID",
        )

        for header_name in header_names:
            value = _normalize_optional_text(request.headers.get(header_name))
            if value:
                return value
    except Exception:
        return None

    return None


def _log_debug(message: str, *args: Any) -> None:
    logger = _safe_get_flask_logger()
    if logger is None:
        return

    try:
        logger.debug(message, *args)
    except Exception:
        pass


def _log_warning(message: str, *args: Any) -> None:
    logger = _safe_get_flask_logger()
    if logger is None:
        return

    try:
        logger.warning(message, *args)
    except Exception:
        pass


def _log_exception(message: str, *args: Any) -> None:
    logger = _safe_get_flask_logger()
    if logger is None:
        return

    try:
        logger.exception(message, *args)
    except Exception:
        pass


def _exception_payload(exc: BaseException | str | None) -> dict[str, Any] | None:
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


# -----------------------------------------------------------------------------
# Konfiguration
# -----------------------------------------------------------------------------

def build_library_client_config(
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
) -> LibraryClientConfig:
    """
    Baut eine `LibraryClientConfig` aus:
    1. explizitem `config_source`
    2. Flask `current_app.config`, falls verfügbar
    3. Environment
    4. Defaults
    """
    source = config_source if config_source is not None else _safe_get_flask_config()

    base_url = _config_or_env_get(
        source,
        CONFIG_BASE_URL_KEYS,
        DEFAULT_LIBRARY_BASE_URL,
    )

    api_prefix = _config_or_env_get(
        source,
        CONFIG_API_PREFIX_KEYS,
        DEFAULT_LIBRARY_API_PREFIX,
    )

    timeout_seconds = _coerce_float(
        _config_or_env_get(source, CONFIG_TIMEOUT_KEYS, DEFAULT_TIMEOUT_SECONDS),
        DEFAULT_TIMEOUT_SECONDS,
    )

    cache_ttl_seconds = _coerce_float(
        _config_or_env_get(source, CONFIG_CACHE_TTL_KEYS, DEFAULT_CACHE_TTL_SECONDS),
        DEFAULT_CACHE_TTL_SECONDS,
    )

    stale_cache_ttl_seconds = _coerce_float(
        _config_or_env_get(
            source,
            CONFIG_STALE_CACHE_TTL_KEYS,
            DEFAULT_STALE_CACHE_TTL_SECONDS,
        ),
        DEFAULT_STALE_CACHE_TTL_SECONDS,
    )

    allow_stale_cache = _coerce_bool(
        _config_or_env_get(source, CONFIG_ALLOW_STALE_CACHE_KEYS, True),
        True,
    )

    max_response_bytes = _coerce_int(
        _config_or_env_get(
            source,
            CONFIG_MAX_RESPONSE_BYTES_KEYS,
            DEFAULT_MAX_RESPONSE_BYTES,
        ),
        DEFAULT_MAX_RESPONSE_BYTES,
    )

    user_agent = _coerce_text(
        _config_or_env_get(source, CONFIG_USER_AGENT_KEYS, DEFAULT_USER_AGENT),
        DEFAULT_USER_AGENT,
    )

    inventory_source = _coerce_text(
        _config_or_env_get(source, CONFIG_INVENTORY_SOURCE_KEYS, "library"),
        "library",
    )

    allow_chunk_placeable_fallback = _coerce_bool(
        _config_or_env_get(source, CONFIG_ALLOW_CHUNK_FALLBACK_KEYS, False),
        False,
    )

    return LibraryClientConfig(
        base_url=base_url,
        api_prefix=api_prefix,
        timeout_seconds=timeout_seconds,
        cache_ttl_seconds=cache_ttl_seconds,
        stale_cache_ttl_seconds=stale_cache_ttl_seconds,
        allow_stale_cache=allow_stale_cache,
        max_response_bytes=max_response_bytes,
        user_agent=user_agent,
        inventory_source=inventory_source,
        allow_chunk_placeable_fallback=allow_chunk_placeable_fallback,
    ).normalized()


# -----------------------------------------------------------------------------
# Client
# -----------------------------------------------------------------------------

class VectoplanLibraryClient:
    """
    Robuster serverseitiger HTTP-Client für `vectoplan-library`.

    Die Klasse cached nur erfolgreiche GET-Responses und gibt auf Wunsch
    stale cache zurück, wenn der Library-Service kurzfristig nicht erreichbar ist.
    """

    def __init__(
        self,
        config: LibraryClientConfig | Mapping[str, Any] | None = None,
    ) -> None:
        if isinstance(config, LibraryClientConfig):
            self.config = config.normalized()
        elif isinstance(config, Mapping):
            self.config = build_library_client_config(config)
        else:
            self.config = build_library_client_config()

        self._cache_lock = threading.RLock()
        self._cache: dict[str, _CachedResponse] = {}

    # -------------------------------------------------------------------------
    # URL / Header
    # -------------------------------------------------------------------------

    def build_url(
        self,
        path: str,
        query: Mapping[str, Any] | None = None,
    ) -> str:
        """
        Baut eine absolute URL zum Library-Service.
        """
        normalized_path = "/" + _coerce_text(path, "").strip("/")
        if normalized_path == "/":
            normalized_path = ""

        base = self.config.base_url.rstrip("/")
        prefix = self.config.api_prefix.strip("/")

        url = f"{base}/{prefix}{normalized_path}"

        query_string = _build_query_string(query)
        if query_string:
            url = f"{url}?{query_string}"

        return url

    def build_headers(self) -> dict[str, str]:
        """
        Baut Standardheaders für Library-Requests.
        """
        headers = {
            "Accept": "application/json",
            "User-Agent": self.config.user_agent,
            "X-VECTOPLAN-Editor-Client": LIBRARY_CLIENT_MODULE_NAME,
            "X-VECTOPLAN-Editor-Client-Version": LIBRARY_CLIENT_MODULE_VERSION,
        }

        request_id = _safe_request_id()
        if request_id:
            headers["X-Request-ID"] = request_id
            headers["X-Correlation-ID"] = request_id

        return headers

    # -------------------------------------------------------------------------
    # Cache
    # -------------------------------------------------------------------------

    def _cache_key(
        self,
        *,
        method: str,
        path: str,
        query: Mapping[str, Any] | None,
    ) -> str:
        url = self.build_url(path, query)
        return f"{method.upper()} {url}"

    def _get_cached_response(
        self,
        key: str,
        *,
        allow_stale: bool,
    ) -> LibraryClientResponse | None:
        now = _monotonic()

        with self._cache_lock:
            entry = self._cache.get(key)

            if entry is None:
                return None

            if now <= entry.expires_at_monotonic:
                return dataclasses.replace(
                    entry.response,
                    from_cache=True,
                    stale=False,
                )

            if allow_stale and now <= entry.stale_until_monotonic:
                return dataclasses.replace(
                    entry.response,
                    from_cache=True,
                    stale=True,
                )

            try:
                self._cache.pop(key, None)
            except Exception:
                pass

        return None

    def _set_cached_response(
        self,
        key: str,
        response: LibraryClientResponse,
    ) -> None:
        if not response.ok or not isinstance(response.payload, dict):
            return

        ttl = self.config.cache_ttl_seconds
        stale_ttl = self.config.stale_cache_ttl_seconds

        if ttl <= 0 and stale_ttl <= 0:
            return

        now = _monotonic()
        expires_at = now + max(0.0, ttl)
        stale_until = expires_at + max(0.0, stale_ttl)

        cached_response = dataclasses.replace(
            response,
            payload=_safe_copy_json(response.payload),
            error=_safe_copy_json(response.error),
            headers=_safe_copy_json(response.headers),
            from_cache=False,
            stale=False,
        )

        with self._cache_lock:
            self._cache[key] = _CachedResponse(
                response=cached_response,
                created_at_monotonic=now,
                expires_at_monotonic=expires_at,
                stale_until_monotonic=stale_until,
            )

    def clear_cache(self) -> None:
        """
        Löscht den Response-Cache dieser Client-Instanz.
        """
        with self._cache_lock:
            self._cache.clear()

    def get_cache_snapshot(self) -> dict[str, Any]:
        """
        Liefert eine kleine Cache-Diagnose.
        """
        now = _monotonic()

        with self._cache_lock:
            total = len(self._cache)
            fresh = 0
            stale = 0
            expired = 0

            for entry in self._cache.values():
                if now <= entry.expires_at_monotonic:
                    fresh += 1
                elif now <= entry.stale_until_monotonic:
                    stale += 1
                else:
                    expired += 1

        return {
            "total": total,
            "fresh": fresh,
            "stale": stale,
            "expired": expired,
            "ttlSeconds": self.config.cache_ttl_seconds,
            "staleTtlSeconds": self.config.stale_cache_ttl_seconds,
            "allowStaleCache": self.config.allow_stale_cache,
        }

    # -------------------------------------------------------------------------
    # HTTP Core
    # -------------------------------------------------------------------------

    def request_json_response(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        method: str = "GET",
        use_cache: bool = True,
        force_refresh: bool = False,
    ) -> LibraryClientResponse:
        """
        Führt einen JSON-Request aus und liefert eine Response-Hülle.

        Aktuell ist nur GET vorgesehen. Andere Methoden werden bewusst blockiert,
        weil dieser Client für Published-/Inventory-Reads gedacht ist.
        """
        normalized_method = _coerce_text(method, "GET").upper()
        if normalized_method != "GET":
            raise LibraryClientConfigurationError(
                "VectoplanLibraryClient unterstützt aktuell nur GET-Requests."
            )

        normalized_path = "/" + _coerce_text(path, "").strip("/")
        cleaned_query = _strip_none_query_values(query)
        url = self.build_url(normalized_path, cleaned_query)
        cache_key = self._cache_key(
            method=normalized_method,
            path=normalized_path,
            query=cleaned_query,
        )

        if use_cache and not force_refresh:
            cached = self._get_cached_response(cache_key, allow_stale=False)
            if cached is not None:
                return cached

        started = _monotonic()
        fetched_at = _utc_iso()

        request = Request(
            url,
            headers=self.build_headers(),
            method=normalized_method,
        )

        try:
            with urlopen(request, timeout=self.config.timeout_seconds) as response:
                status_code = int(getattr(response, "status", HTTPStatus.OK))
                headers = _extract_response_headers(response)
                raw = response.read(self.config.max_response_bytes + 1)

                if len(raw) > self.config.max_response_bytes:
                    raise LibraryClientPayloadError(
                        "Library-Service-Response überschreitet die erlaubte Maximalgröße."
                    )

                payload = _decode_json_payload(raw)
                payload_dict = _coerce_payload_mapping(payload)

                duration_ms = (_monotonic() - started) * 1000.0
                ok = 200 <= status_code < 300 and _payload_is_logically_ok(payload_dict)

                client_response = LibraryClientResponse(
                    ok=ok,
                    method=normalized_method,
                    url=url,
                    path=normalized_path,
                    query=dict(cleaned_query),
                    status_code=status_code,
                    payload=payload_dict,
                    error=None if ok else _extract_payload_error(payload_dict),
                    from_cache=False,
                    stale=False,
                    fetched_at_utc=fetched_at,
                    duration_ms=duration_ms,
                    headers=headers,
                )

                if client_response.ok:
                    self._set_cached_response(cache_key, client_response)

                return client_response

        except HTTPError as exc:
            response = self._build_http_error_response(
                exc,
                method=normalized_method,
                path=normalized_path,
                query=cleaned_query,
                url=url,
                fetched_at=fetched_at,
                started=started,
            )
            return response

        except (TimeoutError, URLError, OSError) as exc:
            stale = self._fallback_stale_response(
                cache_key,
                exc=exc,
                method=normalized_method,
                path=normalized_path,
                query=cleaned_query,
                url=url,
                fetched_at=fetched_at,
                started=started,
            )
            if stale is not None:
                return stale

            raise LibraryClientTransportError(
                f"Library-Service konnte nicht erreicht werden: {exc!s}"
            ) from exc

        except LibraryClientError:
            raise

        except Exception as exc:
            stale = self._fallback_stale_response(
                cache_key,
                exc=exc,
                method=normalized_method,
                path=normalized_path,
                query=cleaned_query,
                url=url,
                fetched_at=fetched_at,
                started=started,
            )
            if stale is not None:
                return stale

            raise LibraryClientTransportError(
                f"Unerwarteter Fehler beim Library-Service-Request: {exc!s}"
            ) from exc

    def request_json(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        use_cache: bool = True,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        """
        Convenience-Variante: liefert direkt die Payload oder wirft Exception.
        """
        response = self.request_json_response(
            path,
            query=query,
            use_cache=use_cache,
            force_refresh=force_refresh,
        )
        return response.require_payload()

    def _build_http_error_response(
        self,
        exc: HTTPError,
        *,
        method: str,
        path: str,
        query: Mapping[str, Any],
        url: str,
        fetched_at: str,
        started: float,
    ) -> LibraryClientResponse:
        status_code = int(getattr(exc, "code", 0) or 0)
        headers = _extract_response_headers(exc)

        payload_dict: dict[str, Any] | None = None
        error_payload: dict[str, Any] | None = None

        try:
            raw = exc.read(self.config.max_response_bytes + 1)
            if raw:
                payload = _decode_json_payload(raw)
                payload_dict = _coerce_payload_mapping(payload)
                error_payload = _extract_payload_error(payload_dict)
        except Exception:
            payload_dict = None

        if error_payload is None:
            error_payload = {
                "reason": "library-http-error",
                "message": _coerce_text(exc.reason, f"HTTP {status_code}"),
                "statusCode": status_code,
            }

        duration_ms = (_monotonic() - started) * 1000.0

        return LibraryClientResponse(
            ok=False,
            method=method,
            url=url,
            path=path,
            query=dict(query),
            status_code=status_code or None,
            payload=payload_dict,
            error=error_payload,
            from_cache=False,
            stale=False,
            fetched_at_utc=fetched_at,
            duration_ms=duration_ms,
            headers=headers,
        )

    def _fallback_stale_response(
        self,
        cache_key: str,
        *,
        exc: BaseException,
        method: str,
        path: str,
        query: Mapping[str, Any],
        url: str,
        fetched_at: str,
        started: float,
    ) -> LibraryClientResponse | None:
        if not self.config.allow_stale_cache:
            return None

        stale = self._get_cached_response(cache_key, allow_stale=True)
        if stale is None:
            return None

        _log_warning(
            "Library-Service-Request fehlgeschlagen; stale cache wird verwendet: %r",
            exc,
        )

        duration_ms = (_monotonic() - started) * 1000.0

        return dataclasses.replace(
            stale,
            method=method,
            url=url,
            path=path,
            query=dict(query),
            from_cache=True,
            stale=True,
            fetched_at_utc=fetched_at,
            duration_ms=duration_ms,
            error={
                "reason": "stale-cache-after-request-error",
                "message": "Library-Service war nicht erreichbar; stale cache wurde verwendet.",
                "sourceError": _exception_payload(exc),
            },
        )

    # -------------------------------------------------------------------------
    # High-level Library API
    # -------------------------------------------------------------------------

    def get_health_response(
        self,
        *,
        force_refresh: bool = False,
    ) -> LibraryClientResponse:
        return self.request_json_response(
            "/health",
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_health(
        self,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        return self.get_health_response(force_refresh=force_refresh).require_payload()

    def get_db_health_response(
        self,
        *,
        force_refresh: bool = False,
    ) -> LibraryClientResponse:
        return self.request_json_response(
            "/db/health",
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_db_health(
        self,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        return self.get_db_health_response(force_refresh=force_refresh).require_payload()

    def get_publication_status_response(
        self,
        *,
        force_refresh: bool = False,
    ) -> LibraryClientResponse:
        return self.request_json_response(
            "/publication-status",
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_publication_status(
        self,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        return self.get_publication_status_response(
            force_refresh=force_refresh,
        ).require_payload()

    def get_published_blocks_response(
        self,
        *,
        source: str = DEFAULT_SOURCE,
        limit: int | None = None,
        offset: int | None = None,
        domain: str | None = None,
        category: str | None = None,
        subcategory: str | None = None,
        object_kind: str | None = None,
        query_text: str | None = None,
        include_unpublished: bool | None = None,
        force_refresh: bool = False,
        extra_query: Mapping[str, Any] | None = None,
    ) -> LibraryClientResponse:
        query = {
            "source": _coerce_text(source, DEFAULT_SOURCE),
            "limit": limit,
            "offset": offset,
            "domain": domain,
            "category": category,
            "subcategory": subcategory,
            "object_kind": object_kind,
            "q": query_text,
            "include_unpublished": include_unpublished,
        }

        if extra_query:
            query.update(dict(extra_query))

        return self.request_json_response(
            "/blocks",
            query=query,
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_published_blocks(
        self,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self.get_published_blocks_response(**kwargs).require_payload()

    def get_published_tree_response(
        self,
        *,
        source: str = DEFAULT_SOURCE,
        force_refresh: bool = False,
        extra_query: Mapping[str, Any] | None = None,
    ) -> LibraryClientResponse:
        query = {
            "source": _coerce_text(source, DEFAULT_SOURCE),
        }

        if extra_query:
            query.update(dict(extra_query))

        return self.request_json_response(
            "/tree",
            query=query,
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_published_tree(
        self,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self.get_published_tree_response(**kwargs).require_payload()

    def get_inventory_response(
        self,
        *,
        force_refresh: bool = False,
        extra_query: Mapping[str, Any] | None = None,
    ) -> LibraryClientResponse:
        query = dict(extra_query or {})

        return self.request_json_response(
            "/inventory",
            query=query,
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_inventory(
        self,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self.get_inventory_response(**kwargs).require_payload()

    def get_block_detail_response(
        self,
        block_id: str,
        *,
        source: str = DEFAULT_SOURCE,
        include_raw_documents: bool | None = None,
        include_documents: bool | None = None,
        force_refresh: bool = False,
        extra_query: Mapping[str, Any] | None = None,
    ) -> LibraryClientResponse:
        identifier = _coerce_text(block_id, "")
        if not identifier:
            raise LibraryClientConfigurationError("block_id darf nicht leer sein.")

        path = f"/blocks/{_quote_path_segment(identifier)}"
        query = {
            "source": _coerce_text(source, DEFAULT_SOURCE),
            "include_raw_documents": include_raw_documents,
            "include_documents": include_documents,
        }

        if extra_query:
            query.update(dict(extra_query))

        return self.request_json_response(
            path,
            query=query,
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_block_detail(
        self,
        block_id: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self.get_block_detail_response(block_id, **kwargs).require_payload()

    def get_block_variants_response(
        self,
        block_id: str,
        *,
        source: str = DEFAULT_SOURCE,
        include_unpublished: bool | None = None,
        force_refresh: bool = False,
        extra_query: Mapping[str, Any] | None = None,
    ) -> LibraryClientResponse:
        identifier = _coerce_text(block_id, "")
        if not identifier:
            raise LibraryClientConfigurationError("block_id darf nicht leer sein.")

        path = f"/blocks/{_quote_path_segment(identifier)}/variants"
        query = {
            "source": _coerce_text(source, DEFAULT_SOURCE),
            "include_unpublished": include_unpublished,
        }

        if extra_query:
            query.update(dict(extra_query))

        return self.request_json_response(
            path,
            query=query,
            use_cache=True,
            force_refresh=force_refresh,
        )

    def get_block_variants(
        self,
        block_id: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self.get_block_variants_response(block_id, **kwargs).require_payload()

    # -------------------------------------------------------------------------
    # Editor-nahe Convenience
    # -------------------------------------------------------------------------

    def get_first_published_block(
        self,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any] | None:
        """
        Liefert das erste veröffentlichte Library-Item aus `/blocks?source=db`.

        Diese Methode ist nur ein Convenience-Helfer für den ersten Editor-Slice.
        Die eigentliche Inventory-Payload soll später in `src.inventory` /
        `src.library_inventory` gebaut werden.
        """
        payload = self.get_published_blocks(
            source=DEFAULT_SOURCE,
            limit=1,
            force_refresh=force_refresh,
        )

        items = extract_library_items(payload)
        return items[0] if items else None

    def ping(
        self,
        *,
        force_refresh: bool = True,
    ) -> bool:
        """
        Kleiner Verbindungstest.
        """
        try:
            response = self.get_health_response(force_refresh=force_refresh)
            return bool(response.ok)
        except Exception:
            return False

    def get_client_health(
        self,
        *,
        include_remote: bool = False,
        force_refresh: bool = False,
    ) -> LibraryClientHealth:
        """
        Liefert Health dieses Clients und optional einen Remote-Health-Abruf.
        """
        remote_payload: dict[str, Any] | None = None
        error_payload: dict[str, Any] | None = None
        ok = True
        status = "ok"

        if include_remote:
            try:
                remote_response = self.get_health_response(force_refresh=force_refresh)
                remote_payload = remote_response.to_dict()
                ok = bool(remote_response.ok)
                status = "ok" if remote_response.ok else "remote-error"
            except Exception as exc:
                ok = False
                status = "remote-unavailable"
                error_payload = _exception_payload(exc)

        return LibraryClientHealth(
            ok=ok,
            status=status,
            generated_at_utc=_utc_iso(),
            config=self.config.to_dict(),
            cache=self.get_cache_snapshot(),
            module=get_library_client_module_metadata(),
            library=remote_payload,
            error=error_payload,
        )

    def __enter__(self) -> "VectoplanLibraryClient":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None


# -----------------------------------------------------------------------------
# HTTP/Payload-Helfer
# -----------------------------------------------------------------------------

def _extract_response_headers(response: Any) -> dict[str, str]:
    result: dict[str, str] = {}

    try:
        headers = response.headers
    except Exception:
        headers = None

    if headers is None:
        return result

    try:
        for key, value in headers.items():
            result[_coerce_text(key, "unknown")] = _coerce_text(value, "")
    except Exception:
        return result

    return result


def _decode_json_payload(raw: bytes | bytearray | str) -> Any:
    if isinstance(raw, str):
        text = raw
    else:
        try:
            text = bytes(raw).decode("utf-8")
        except Exception as exc:
            raise LibraryClientPayloadError(
                "Library-Service-Response konnte nicht als UTF-8 gelesen werden."
            ) from exc

    if not text.strip():
        return {}

    try:
        return json.loads(text)
    except Exception as exc:
        raise LibraryClientPayloadError(
            "Library-Service-Response ist kein gültiges JSON."
        ) from exc


def _coerce_payload_mapping(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload

    if isinstance(payload, Mapping):
        return dict(payload)

    raise LibraryClientPayloadError(
        "Library-Service-Response muss ein JSON-Objekt sein."
    )


def _payload_is_logically_ok(payload: Mapping[str, Any]) -> bool:
    """
    Berücksichtigt Library-Payloads mit `ok=false`.

    Wenn kein `ok`-Feld existiert, gilt HTTP 2xx als ausreichend.
    """
    try:
        if "ok" in payload:
            return _coerce_bool(payload.get("ok"), False)
    except Exception:
        return True

    return True


def _extract_payload_error(payload: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, Mapping):
        return None

    try:
        error = payload.get("error")
        if isinstance(error, Mapping):
            return dict(error)
    except Exception:
        pass

    try:
        message = payload.get("message") or payload.get("detail")
        if message:
            return {
                "reason": _coerce_text(payload.get("reason"), "library-payload-error"),
                "message": _coerce_text(message, "Library-Service meldet Fehler."),
            }
    except Exception:
        pass

    return None


# -----------------------------------------------------------------------------
# Extractor-Helfer für spätere Inventory-Adapter
# -----------------------------------------------------------------------------

def extract_library_items(payload: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """
    Extrahiert Published-Block-/Library-Items aus verschiedenen Response-Shapes.
    """
    if not isinstance(payload, Mapping):
        return []

    candidate_paths = (
        ("items",),
        ("blocks",),
        ("data", "items"),
        ("data", "blocks"),
        ("result", "items"),
        ("library", "items"),
    )

    for path in candidate_paths:
        value = _deep_get(payload, path, None)
        items = _coerce_list_of_dicts(value)
        if items:
            return items

    return []


def extract_inventory_slots(payload: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """
    Extrahiert Inventory-Slots aus verschiedenen Response-Shapes.
    """
    if not isinstance(payload, Mapping):
        return []

    candidate_paths = (
        ("inventory", "slots"),
        ("slots",),
        ("data", "inventory", "slots"),
        ("data", "slots"),
        ("result", "inventory", "slots"),
    )

    for path in candidate_paths:
        value = _deep_get(payload, path, None)
        slots = _coerce_list_of_dicts(value)
        if slots:
            return slots

    return []


def extract_tree(payload: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """
    Extrahiert einen Library-Tree aus verschiedenen Response-Shapes.
    """
    if not isinstance(payload, Mapping):
        return None

    candidate_paths = (
        ("tree",),
        ("root",),
        ("data", "tree"),
        ("data", "root"),
        ("result", "tree"),
    )

    for path in candidate_paths:
        value = _deep_get(payload, path, None)
        if isinstance(value, Mapping):
            return dict(value)

    return None


def _coerce_list_of_dicts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        return []

    result: list[dict[str, Any]] = []

    for item in value:
        if isinstance(item, dict):
            result.append(item)
        elif isinstance(item, Mapping):
            result.append(dict(item))

    return result


# -----------------------------------------------------------------------------
# Globale Client-Factory mit Cache
# -----------------------------------------------------------------------------

_CLIENT_CACHE_LOCK = threading.RLock()
_CLIENT_CACHE: dict[str, VectoplanLibraryClient] = {}


def get_library_client(
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | LibraryClientConfig | None = None,
    *,
    force_new: bool = False,
) -> VectoplanLibraryClient:
    """
    Liefert eine gecachte Client-Instanz für die aktuelle Konfiguration.

    In Tests kann `force_new=True` genutzt werden.
    """
    if isinstance(config_source, LibraryClientConfig):
        config = config_source.normalized()
    else:
        config = build_library_client_config(config_source)

    fingerprint = config.fingerprint()

    if force_new:
        return VectoplanLibraryClient(config)

    with _CLIENT_CACHE_LOCK:
        existing = _CLIENT_CACHE.get(fingerprint)
        if existing is not None:
            return existing

        client = VectoplanLibraryClient(config)
        _CLIENT_CACHE[fingerprint] = client
        return client


def clear_library_client_caches() -> None:
    """
    Löscht alle global gecachten Client-Instanzen und deren Response-Caches.
    """
    with _CLIENT_CACHE_LOCK:
        clients = list(_CLIENT_CACHE.values())
        _CLIENT_CACHE.clear()

    for client in clients:
        try:
            client.clear_cache()
        except Exception:
            continue


# -----------------------------------------------------------------------------
# Modul-Level Convenience-Funktionen
# -----------------------------------------------------------------------------

def load_library_inventory_response(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    force_refresh: bool = False,
    extra_query: Mapping[str, Any] | None = None,
) -> LibraryClientResponse:
    client = get_library_client(config_source)
    return client.get_inventory_response(
        force_refresh=force_refresh,
        extra_query=extra_query,
    )


def load_library_inventory_payload(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    force_refresh: bool = False,
    extra_query: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return load_library_inventory_response(
        config_source=config_source,
        force_refresh=force_refresh,
        extra_query=extra_query,
    ).require_payload()


def load_published_blocks_payload(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    source: str = DEFAULT_SOURCE,
    limit: int | None = None,
    force_refresh: bool = False,
    extra_query: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    client = get_library_client(config_source)
    return client.get_published_blocks(
        source=source,
        limit=limit,
        force_refresh=force_refresh,
        extra_query=extra_query,
    )


def load_published_tree_payload(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    source: str = DEFAULT_SOURCE,
    force_refresh: bool = False,
    extra_query: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    client = get_library_client(config_source)
    return client.get_published_tree(
        source=source,
        force_refresh=force_refresh,
        extra_query=extra_query,
    )


def load_block_detail_payload(
    block_id: str,
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    source: str = DEFAULT_SOURCE,
    force_refresh: bool = False,
    extra_query: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    client = get_library_client(config_source)
    return client.get_block_detail(
        block_id,
        source=source,
        force_refresh=force_refresh,
        extra_query=extra_query,
    )


def load_block_variants_payload(
    block_id: str,
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    source: str = DEFAULT_SOURCE,
    force_refresh: bool = False,
    extra_query: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    client = get_library_client(config_source)
    return client.get_block_variants(
        block_id,
        source=source,
        force_refresh=force_refresh,
        extra_query=extra_query,
    )


def get_library_client_module_metadata() -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten dieser Datei.
    """
    return {
        "moduleName": LIBRARY_CLIENT_MODULE_NAME,
        "moduleVersion": LIBRARY_CLIENT_MODULE_VERSION,
        "defaultBaseUrl": DEFAULT_LIBRARY_BASE_URL,
        "defaultApiPrefix": DEFAULT_LIBRARY_API_PREFIX,
        "defaultSource": DEFAULT_SOURCE,
        "defaultInventoryHotbarSize": DEFAULT_INVENTORY_HOTBAR_SIZE,
        "configKeys": {
            "baseUrl": list(CONFIG_BASE_URL_KEYS),
            "apiPrefix": list(CONFIG_API_PREFIX_KEYS),
            "timeout": list(CONFIG_TIMEOUT_KEYS),
            "cacheTtl": list(CONFIG_CACHE_TTL_KEYS),
            "staleCacheTtl": list(CONFIG_STALE_CACHE_TTL_KEYS),
            "allowStaleCache": list(CONFIG_ALLOW_STALE_CACHE_KEYS),
            "maxResponseBytes": list(CONFIG_MAX_RESPONSE_BYTES_KEYS),
            "userAgent": list(CONFIG_USER_AGENT_KEYS),
            "inventorySource": list(CONFIG_INVENTORY_SOURCE_KEYS),
            "allowChunkFallback": list(CONFIG_ALLOW_CHUNK_FALLBACK_KEYS),
        },
    }


def get_library_client_health(
    *,
    config_source: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    include_remote: bool = False,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """
    Modul-Level Health-Helfer.
    """
    try:
        client = get_library_client(config_source)
        return client.get_client_health(
            include_remote=include_remote,
            force_refresh=force_refresh,
        ).to_dict()
    except Exception as exc:
        return {
            "ok": False,
            "status": "error",
            "generatedAtUtc": _utc_iso(),
            "module": get_library_client_module_metadata(),
            "error": _exception_payload(exc),
        }


__all__ = [
    "LIBRARY_CLIENT_MODULE_NAME",
    "LIBRARY_CLIENT_MODULE_VERSION",
    "DEFAULT_LIBRARY_BASE_URL",
    "DEFAULT_LIBRARY_API_PREFIX",
    "DEFAULT_SOURCE",
    "LibraryClientError",
    "LibraryClientConfigurationError",
    "LibraryClientTransportError",
    "LibraryClientHTTPError",
    "LibraryClientPayloadError",
    "LibraryClientConfig",
    "LibraryClientResponse",
    "LibraryClientHealth",
    "VectoplanLibraryClient",
    "build_library_client_config",
    "get_library_client",
    "clear_library_client_caches",
    "load_library_inventory_response",
    "load_library_inventory_payload",
    "load_published_blocks_payload",
    "load_published_tree_payload",
    "load_block_detail_payload",
    "load_block_variants_payload",
    "extract_library_items",
    "extract_inventory_slots",
    "extract_tree",
    "get_library_client_module_metadata",
    "get_library_client_health",
]