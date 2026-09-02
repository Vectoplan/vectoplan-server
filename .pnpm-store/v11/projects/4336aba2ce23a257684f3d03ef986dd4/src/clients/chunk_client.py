# services/vectoplan-editor/src/clients/chunk_client.py
from __future__ import annotations

import json
import logging
import os
import socket
import time
import uuid
from dataclasses import dataclass, field
from functools import lru_cache
from json import JSONDecodeError
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, quote, urlencode, urlparse
from urllib.request import Request, urlopen

try:
    from flask import current_app, has_app_context, request as flask_request
except Exception:  # pragma: no cover - erlaubt Import ohne Flask-Kontext
    current_app = None
    flask_request = None

    def has_app_context() -> bool:
        return False


LOGGER = logging.getLogger(__name__)


# =============================================================================
# Defaults
# =============================================================================

DEFAULT_CHUNK_SERVICE_INTERNAL_URL = "http://vectoplan-chunk:5000"

DEFAULT_REQUEST_TIMEOUT_SECONDS = 10.0
DEFAULT_COMMAND_TIMEOUT_SECONDS = 15.0
DEFAULT_BATCH_TIMEOUT_SECONDS = 20.0
DEFAULT_STATUS_TIMEOUT_SECONDS = 5.0

DEFAULT_REQUEST_TIMEOUT_MS = 10_000
DEFAULT_COMMAND_TIMEOUT_MS = 15_000
DEFAULT_BATCH_TIMEOUT_MS = 20_000
DEFAULT_STATUS_TIMEOUT_MS = 5_000

DEFAULT_MAX_RESPONSE_BYTES = 20 * 1024 * 1024
DEFAULT_MAX_BATCH_CHUNKS = 256

DEFAULT_STATUS_PATHS = (
    "/health/ready",
    "/",
)

DEFAULT_USER_AGENT = "vectoplan-editor/chunk-client"
DEFAULT_SERVICE_NAME = "vectoplan-chunk"

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
BODY_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}

BLOCKED_FORWARD_HEADERS = {
    "host",
    "content-length",
    "cookie",
    "set-cookie",
}


# =============================================================================
# Datenklassen
# =============================================================================

@dataclass(frozen=True)
class ChunkClientConfig:
    """
    Konfiguration für den editorseitigen Backend-Client zu `vectoplan-chunk`.

    Diese Konfiguration ist ausschließlich für Backend-Code gedacht.

    Browser:
        /editor/api/chunk/...

    Editor-Backend:
        ChunkClient -> http://vectoplan-chunk:5000/...

    Der Browser darf die interne Base-URL niemals direkt verwenden.
    """

    base_url: str = DEFAULT_CHUNK_SERVICE_INTERNAL_URL

    request_timeout_seconds: float = DEFAULT_REQUEST_TIMEOUT_SECONDS
    command_timeout_seconds: float = DEFAULT_COMMAND_TIMEOUT_SECONDS
    batch_timeout_seconds: float = DEFAULT_BATCH_TIMEOUT_SECONDS
    status_timeout_seconds: float = DEFAULT_STATUS_TIMEOUT_SECONDS

    max_response_bytes: int = DEFAULT_MAX_RESPONSE_BYTES
    max_batch_chunks: int = DEFAULT_MAX_BATCH_CHUNKS

    status_paths: tuple[str, ...] = DEFAULT_STATUS_PATHS

    user_agent: str = DEFAULT_USER_AGENT
    service_name: str = DEFAULT_SERVICE_NAME
    service_id: str = "vectoplan-editor"
    service_api_key: str = ""

    include_upstream_details: bool = True
    forward_user_headers: bool = False

    @classmethod
    def from_sources(
        cls,
        app_config: Mapping[str, Any] | None = None,
        environ: Mapping[str, str] | None = None,
    ) -> "ChunkClientConfig":
        """
        Erzeugt die Client-Konfiguration robust aus mehreren Quellen.

        Priorität:
        1. explizit übergebenes app_config
        2. Flask current_app.config, falls App-Kontext existiert
        3. Environment
        4. Defaults

        Unterstützt bewusst neue und ältere ENV-/Config-Namen, damit die
        Übergangsphase ohne harte Brüche funktioniert.
        """

        merged_config: dict[str, Any] = {}

        if has_app_context() and current_app is not None:
            try:
                merged_config.update(dict(current_app.config))
            except Exception:
                LOGGER.exception("Could not read Flask current_app.config for ChunkClientConfig.")

        if app_config:
            try:
                merged_config.update(dict(app_config))
            except Exception:
                LOGGER.exception("Could not merge explicit app_config for ChunkClientConfig.")

        env = environ if environ is not None else os.environ

        base_url = _first_config_value(
            merged_config,
            env,
            keys=(
                "EDITOR_CHUNK_SERVICE_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_BASE_URL",
                "EDITOR_CHUNK_SERVICE_INTERNAL_URL",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_INTERNAL_URL",
                "VECTOPLAN_CHUNK_SERVICE_INTERNAL_URL",
                "CHUNK_SERVICE_INTERNAL_URL",
            ),
            default=DEFAULT_CHUNK_SERVICE_INTERNAL_URL,
        )

        request_timeout_ms = _coerce_int(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_REQUEST_TIMEOUT_MS",
                ),
                default=DEFAULT_REQUEST_TIMEOUT_MS,
            ),
            DEFAULT_REQUEST_TIMEOUT_MS,
        )

        command_timeout_ms = _coerce_int(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_COMMAND_TIMEOUT_MS",
                ),
                default=DEFAULT_COMMAND_TIMEOUT_MS,
            ),
            DEFAULT_COMMAND_TIMEOUT_MS,
        )

        batch_timeout_ms = _coerce_int(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_BATCH_TIMEOUT_MS",
                ),
                default=DEFAULT_BATCH_TIMEOUT_MS,
            ),
            DEFAULT_BATCH_TIMEOUT_MS,
        )

        status_timeout_ms = _coerce_int(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
                    "VECTOPLAN_EDITOR_CHUNK_STATUS_TIMEOUT_MS",
                ),
                default=DEFAULT_STATUS_TIMEOUT_MS,
            ),
            DEFAULT_STATUS_TIMEOUT_MS,
        )

        # Alte Sekunden-Konfiguration überschreibt nur dann sinnvoll, wenn kein
        # Millisekunden-Wert explizit gesetzt wurde.
        request_timeout_seconds = _seconds_from_ms(request_timeout_ms, DEFAULT_REQUEST_TIMEOUT_SECONDS)
        command_timeout_seconds = _seconds_from_ms(command_timeout_ms, DEFAULT_COMMAND_TIMEOUT_SECONDS)
        batch_timeout_seconds = _seconds_from_ms(batch_timeout_ms, DEFAULT_BATCH_TIMEOUT_SECONDS)
        status_timeout_seconds = _seconds_from_ms(status_timeout_ms, DEFAULT_STATUS_TIMEOUT_SECONDS)

        request_timeout_seconds = _coerce_float(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_REQUEST_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_REQUEST_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_REQUEST_TIMEOUT_SECONDS",
                    "CHUNK_SERVICE_REQUEST_TIMEOUT",
                ),
                default=request_timeout_seconds,
            ),
            request_timeout_seconds,
        )

        command_timeout_seconds = _coerce_float(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_COMMAND_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_COMMAND_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_COMMAND_TIMEOUT_SECONDS",
                    "CHUNK_SERVICE_COMMAND_TIMEOUT",
                ),
                default=command_timeout_seconds,
            ),
            command_timeout_seconds,
        )

        batch_timeout_seconds = _coerce_float(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_BATCH_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_BATCH_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_BATCH_TIMEOUT_SECONDS",
                    "CHUNK_SERVICE_BATCH_TIMEOUT",
                ),
                default=batch_timeout_seconds,
            ),
            batch_timeout_seconds,
        )

        status_timeout_seconds = _coerce_float(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_STATUS_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_STATUS_TIMEOUT",
                    "VECTOPLAN_EDITOR_CHUNK_STATUS_TIMEOUT_SECONDS",
                    "CHUNK_SERVICE_STATUS_TIMEOUT",
                ),
                default=status_timeout_seconds,
            ),
            status_timeout_seconds,
        )

        max_response_bytes = _coerce_int(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
                    "EDITOR_CHUNK_MAX_RESPONSE_BYTES",
                    "VECTOPLAN_EDITOR_CHUNK_MAX_RESPONSE_BYTES",
                    "CHUNK_SERVICE_MAX_RESPONSE_BYTES",
                ),
                default=DEFAULT_MAX_RESPONSE_BYTES,
            ),
            DEFAULT_MAX_RESPONSE_BYTES,
        )

        max_batch_chunks = _coerce_int(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
                    "EDITOR_CHUNK_MAX_BATCH_CHUNKS",
                    "VECTOPLAN_EDITOR_CHUNK_MAX_BATCH_CHUNKS",
                ),
                default=DEFAULT_MAX_BATCH_CHUNKS,
            ),
            DEFAULT_MAX_BATCH_CHUNKS,
        )

        status_paths = _coerce_string_tuple(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_STATUS_PATHS",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_PATHS",
                    "EDITOR_CHUNK_STATUS_PATHS",
                    "VECTOPLAN_EDITOR_CHUNK_STATUS_PATHS",
                    "CHUNK_SERVICE_STATUS_PATHS",
                ),
                default=",".join(DEFAULT_STATUS_PATHS),
            ),
            DEFAULT_STATUS_PATHS,
        )

        user_agent = _coerce_non_empty_string(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_USER_AGENT",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_USER_AGENT",
                    "VECTOPLAN_EDITOR_CHUNK_USER_AGENT",
                    "CHUNK_SERVICE_USER_AGENT",
                ),
                default=DEFAULT_USER_AGENT,
            ),
            DEFAULT_USER_AGENT,
        )

        service_name = _coerce_non_empty_string(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_SERVICE_NAME",
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_NAME",
                    "VECTOPLAN_EDITOR_CHUNK_UPSTREAM_SERVICE_NAME",
                    "CHUNK_SERVICE_NAME",
                ),
                default=DEFAULT_SERVICE_NAME,
            ),
            DEFAULT_SERVICE_NAME,
        )

        service_id = _coerce_non_empty_string(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_ID",
                    "EDITOR_CHUNK_SERVICE_ID",
                ),
                default="vectoplan-editor",
            ),
            "vectoplan-editor",
        )
        service_api_key = _coerce_non_empty_string(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "VECTOPLAN_EDITOR_CHUNK_SERVICE_API_KEY",
                    "VECTOPLAN_EDITOR_CHUNK_INTERNAL_TOKEN",
                    "VECTOPLAN_CHUNK_SERVICE_API_KEY",
                    "VECTOPLAN_CHUNK_INTERNAL_TOKEN",
                ),
                default="",
            ),
            "",
        )

        include_upstream_details = _coerce_bool(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
                    "VECTOPLAN_EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
                ),
                default=True,
            ),
            True,
        )

        forward_user_headers = _coerce_bool(
            _first_config_value(
                merged_config,
                env,
                keys=(
                    "EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS",
                    "VECTOPLAN_EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS",
                ),
                default=False,
            ),
            False,
        )

        return cls(
            base_url=_normalize_base_url(str(base_url)),
            request_timeout_seconds=max(0.1, request_timeout_seconds),
            command_timeout_seconds=max(0.1, command_timeout_seconds),
            batch_timeout_seconds=max(0.1, batch_timeout_seconds),
            status_timeout_seconds=max(0.1, status_timeout_seconds),
            max_response_bytes=max(1024, int(max_response_bytes)),
            max_batch_chunks=max(1, int(max_batch_chunks)),
            status_paths=status_paths,
            user_agent=user_agent,
            service_name=service_name,
            service_id=service_id,
            service_api_key=service_api_key,
            include_upstream_details=bool(include_upstream_details),
            forward_user_headers=bool(forward_user_headers),
        )


@dataclass(frozen=True)
class ChunkClientErrorInfo:
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)
    exception_type: str | None = None
    retryable: bool = False

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "details": _json_safe(self.details),
            "retryable": self.retryable,
        }

        if self.exception_type:
            payload["exceptionType"] = self.exception_type

        return payload


@dataclass(frozen=True)
class ChunkClientResponse:
    ok: bool
    method: str
    path: str
    url: str
    status_code: int | None
    elapsed_ms: float
    data: Any = None
    raw_text: str | None = None
    headers: dict[str, str] = field(default_factory=dict)
    error: ChunkClientErrorInfo | None = None
    request_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    truncated: bool = False
    upstream_service: str = DEFAULT_SERVICE_NAME

    @property
    def failed(self) -> bool:
        return not self.ok

    @property
    def has_upstream_status(self) -> bool:
        return isinstance(self.status_code, int)

    def to_dict(
        self,
        *,
        include_raw_text: bool = False,
        include_upstream_details: bool = True,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "ok": self.ok,
            "requestId": self.request_id,
            "method": self.method,
            "path": self.path,
            "statusCode": self.status_code,
            "elapsedMs": round(self.elapsed_ms, 3),
            "upstreamService": self.upstream_service,
            "truncated": self.truncated,
        }

        if self.data is not None:
            payload["data"] = _json_safe(self.data)

        if self.error is not None:
            payload["error"] = self.error.to_dict()

        if include_upstream_details:
            payload["upstream"] = {
                "service": self.upstream_service,
                "statusCode": self.status_code,
                "headers": _safe_response_headers_for_payload(self.headers),
            }

        if include_raw_text and self.raw_text is not None:
            payload["rawText"] = self.raw_text

        return payload

    def upstream_payload_or_proxy_error(
        self,
        *,
        include_upstream_details: bool = False,
    ) -> Any:
        """
        Liefert bei valider Upstream-JSON-Antwort direkt den Upstream-Payload.

        Wenn kein Upstream-Payload vorhanden ist, wird ein normalisierter
        Proxy-Fehler zurückgegeben.
        """

        if self.data is not None:
            return self.data

        return self.to_dict(
            include_raw_text=False,
            include_upstream_details=include_upstream_details,
        )

    def proxy_status_code(self) -> int:
        """
        Empfohlener HTTP-Status für den Editor-Proxy.

        - Wenn upstream einen Statuscode geliefert hat, wird er erhalten.
        - Wenn der Chunk-Service nicht erreichbar ist, wird 503 genutzt.
        - Für lokale Proxy-/Parsing-Probleme wird 502 genutzt.
        """

        if self.status_code is not None:
            return int(self.status_code)

        if self.error and self.error.retryable:
            return 503

        return 502

    def proxy_headers(self) -> dict[str, str]:
        headers = {
            "X-Vectoplan-Chunk-Proxy": "vectoplan-editor",
            "X-Vectoplan-Chunk-Upstream-Service": self.upstream_service,
            "X-Vectoplan-Chunk-Request-Id": self.request_id,
            "X-Vectoplan-Chunk-Elapsed-Ms": str(round(self.elapsed_ms, 3)),
        }

        if self.status_code is not None:
            headers["X-Vectoplan-Chunk-Upstream-Status"] = str(self.status_code)

        return headers


# =============================================================================
# Client
# =============================================================================

class ChunkClient:
    """
    HTTP-Client für den Zugriff vom `vectoplan-editor`-Backend auf
    `vectoplan-chunk`.

    Diese Klasse ist bewusst transportorientiert.

    Sie darf nicht:
    - ChunkSnapshots interpretieren
    - ChunkEvents schreiben
    - Editor-State verändern
    - Three.js-/Frontend-Logik kennen
    - Generator- oder Block-Fachlogik besitzen
    """

    def __init__(self, config: ChunkClientConfig | None = None) -> None:
        self.config = config or ChunkClientConfig.from_sources()

    @classmethod
    def from_sources(
        cls,
        app_config: Mapping[str, Any] | None = None,
        environ: Mapping[str, str] | None = None,
    ) -> "ChunkClient":
        return cls(ChunkClientConfig.from_sources(app_config=app_config, environ=environ))

    @property
    def base_url(self) -> str:
        return self.config.base_url

    # -------------------------------------------------------------------------
    # Generische Requests
    # -------------------------------------------------------------------------

    def request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        json_body: Any = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
        request_id: str | None = None,
    ) -> ChunkClientResponse:
        method_normalized = _normalize_method(method)
        started_at = time.perf_counter()
        resolved_request_id = request_id or uuid.uuid4().hex
        normalized_path = "/"
        url = self.config.base_url

        try:
            normalized_path = _normalize_relative_path(path)
            url = self.build_url(normalized_path, query=query)

            if method_normalized in SAFE_METHODS and json_body is not None:
                return self._local_error_response(
                    method=method_normalized,
                    path=normalized_path,
                    url=url,
                    started_at=started_at,
                    request_id=resolved_request_id,
                    code="body_not_allowed_for_method",
                    message=f"HTTP method {method_normalized} must not send a JSON body.",
                    details={
                        "method": method_normalized,
                        "path": normalized_path,
                    },
                    retryable=False,
                )

            timeout = timeout_seconds if timeout_seconds is not None else self.config.request_timeout_seconds
            timeout = max(0.1, float(timeout))

            request_headers = self._build_headers(
                headers=headers,
                has_json_body=json_body is not None,
                request_id=resolved_request_id,
            )
            body_bytes = self._encode_body(json_body)

            req = Request(
                url=url,
                data=body_bytes,
                headers=request_headers,
                method=method_normalized,
            )

            with urlopen(req, timeout=timeout) as response:
                raw_text, truncated = self._read_response_text(response)
                parsed_data, parse_error = _parse_json_or_error(raw_text)

                status_code = int(getattr(response, "status", response.getcode()))
                response_headers = _headers_to_dict(response.headers)

                if parse_error is not None:
                    return ChunkClientResponse(
                        ok=False,
                        method=method_normalized,
                        path=normalized_path,
                        url=url,
                        status_code=status_code,
                        elapsed_ms=_elapsed_ms(started_at),
                        data=parsed_data,
                        raw_text=raw_text,
                        headers=response_headers,
                        error=ChunkClientErrorInfo(
                            code=parse_error["code"],
                            message=parse_error["message"],
                            details={
                                "path": normalized_path,
                                "statusCode": status_code,
                                "truncated": truncated,
                            },
                            retryable=False,
                        ),
                        request_id=resolved_request_id,
                        truncated=truncated,
                        upstream_service=self.config.service_name,
                    )

                upstream_ok = _is_upstream_ok(status_code, parsed_data)

                return ChunkClientResponse(
                    ok=upstream_ok,
                    method=method_normalized,
                    path=normalized_path,
                    url=url,
                    status_code=status_code,
                    elapsed_ms=_elapsed_ms(started_at),
                    data=parsed_data,
                    raw_text=raw_text,
                    headers=response_headers,
                    error=None if upstream_ok else _extract_upstream_error(parsed_data, status_code),
                    request_id=resolved_request_id,
                    truncated=truncated,
                    upstream_service=self.config.service_name,
                )

        except HTTPError as exc:
            return self._handle_http_error(
                exc,
                method=method_normalized,
                path=normalized_path,
                url=url,
                started_at=started_at,
                request_id=resolved_request_id,
            )

        except (URLError, TimeoutError, socket.timeout) as exc:
            LOGGER.warning(
                "Chunk service request failed: method=%s path=%s url=%s error=%s",
                method_normalized,
                normalized_path,
                url,
                exc,
            )

            return ChunkClientResponse(
                ok=False,
                method=method_normalized,
                path=normalized_path,
                url=url,
                status_code=None,
                elapsed_ms=_elapsed_ms(started_at),
                data=None,
                raw_text=None,
                headers={},
                error=ChunkClientErrorInfo(
                    code="chunk_service_unreachable",
                    message="Chunk service could not be reached.",
                    details={
                        "baseUrl": self.config.base_url,
                        "path": normalized_path,
                        "reason": str(exc),
                    },
                    exception_type=type(exc).__name__,
                    retryable=True,
                ),
                request_id=resolved_request_id,
                upstream_service=self.config.service_name,
            )

        except ValueError as exc:
            return self._local_error_response(
                method=method_normalized,
                path=normalized_path,
                url=url,
                started_at=started_at,
                request_id=resolved_request_id,
                code="invalid_chunk_client_request",
                message=str(exc),
                details={
                    "path": path,
                    "method": method,
                },
                retryable=False,
            )

        except Exception as exc:
            LOGGER.exception(
                "Unexpected ChunkClient error: method=%s path=%s url=%s",
                method_normalized,
                normalized_path,
                url,
            )

            return ChunkClientResponse(
                ok=False,
                method=method_normalized,
                path=normalized_path,
                url=url,
                status_code=None,
                elapsed_ms=_elapsed_ms(started_at),
                data=None,
                raw_text=None,
                headers={},
                error=ChunkClientErrorInfo(
                    code="chunk_client_internal_error",
                    message="Unexpected editor-side Chunk client error.",
                    details={
                        "baseUrl": self.config.base_url,
                        "path": normalized_path,
                    },
                    exception_type=type(exc).__name__,
                    retryable=False,
                ),
                request_id=resolved_request_id,
                upstream_service=self.config.service_name,
            )

    def get(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
    ) -> ChunkClientResponse:
        return self.request(
            "GET",
            path,
            query=query,
            headers=headers,
            timeout_seconds=timeout_seconds,
        )

    def post(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        json_body: Any = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
    ) -> ChunkClientResponse:
        return self.request(
            "POST",
            path,
            query=query,
            json_body=json_body,
            headers=headers,
            timeout_seconds=timeout_seconds,
        )

    def put(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        json_body: Any = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
    ) -> ChunkClientResponse:
        return self.request(
            "PUT",
            path,
            query=query,
            json_body=json_body,
            headers=headers,
            timeout_seconds=timeout_seconds,
        )

    def patch(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        json_body: Any = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
    ) -> ChunkClientResponse:
        return self.request(
            "PATCH",
            path,
            query=query,
            json_body=json_body,
            headers=headers,
            timeout_seconds=timeout_seconds,
        )

    def delete(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        json_body: Any = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
    ) -> ChunkClientResponse:
        return self.request(
            "DELETE",
            path,
            query=query,
            json_body=json_body,
            headers=headers,
            timeout_seconds=timeout_seconds,
        )

    # -------------------------------------------------------------------------
    # Status / Diagnose
    # -------------------------------------------------------------------------

    def ping(self) -> ChunkClientResponse:
        """
        Prüft die konfigurierten Statuspfade und gibt die erste erfolgreiche
        Antwort zurück.

        Wenn kein Statuspfad erfolgreich ist, wird eine strukturierte
        Sammelantwort zurückgegeben.
        """

        attempts: list[dict[str, Any]] = []
        last_response: ChunkClientResponse | None = None
        started_at = time.perf_counter()

        for status_path in self.config.status_paths:
            response = self.get(
                status_path,
                timeout_seconds=self.config.status_timeout_seconds,
            )
            last_response = response
            attempts.append(
                response.to_dict(
                    include_raw_text=False,
                    include_upstream_details=False,
                )
            )

            if response.ok:
                return response

        return ChunkClientResponse(
            ok=False,
            method="GET",
            path=",".join(self.config.status_paths),
            url=self.config.base_url,
            status_code=last_response.status_code if last_response else None,
            elapsed_ms=_elapsed_ms(started_at),
            data={
                "ok": False,
                "attempts": attempts,
            },
            raw_text=None,
            headers={},
            error=ChunkClientErrorInfo(
                code="chunk_service_status_unavailable",
                message="No configured Chunk Service status path returned a successful response.",
                details={
                    "baseUrl": self.config.base_url,
                    "statusPaths": list(self.config.status_paths),
                    "attemptCount": len(attempts),
                },
                retryable=True,
            ),
            upstream_service=self.config.service_name,
        )

    def get_status(self) -> ChunkClientResponse:
        return self.ping()

    def test_connection(self) -> ChunkClientResponse:
        return self.ping()

    # -------------------------------------------------------------------------
    # Projects
    # -------------------------------------------------------------------------

    def list_projects(self) -> ChunkClientResponse:
        return self.get("/projects")

    def get_project(self, project_id: str) -> ChunkClientResponse:
        return self.get(f"/projects/{_segment(project_id)}")

    def get_project_bootstrap(self, project_id: str) -> ChunkClientResponse:
        return self.get(f"/projects/{_segment(project_id)}/bootstrap")

    def create_project(self, payload: Mapping[str, Any]) -> ChunkClientResponse:
        return self.post(
            "/projects",
            json_body=dict(payload),
            timeout_seconds=self.config.command_timeout_seconds,
        )

    def delete_project(self, project_id: str) -> ChunkClientResponse:
        return self.delete(
            f"/projects/{_segment(project_id)}",
            timeout_seconds=self.config.command_timeout_seconds,
        )

    # -------------------------------------------------------------------------
    # Worlds
    # -------------------------------------------------------------------------

    def list_worlds(self, project_id: str) -> ChunkClientResponse:
        return self.get(f"/projects/{_segment(project_id)}/worlds")

    def get_world(self, project_id: str, world_id: str) -> ChunkClientResponse:
        return self.get(
            f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}"
        )

    def create_world(self, project_id: str, payload: Mapping[str, Any]) -> ChunkClientResponse:
        return self.post(
            f"/projects/{_segment(project_id)}/worlds",
            json_body=dict(payload),
            timeout_seconds=self.config.command_timeout_seconds,
        )

    def delete_world(self, project_id: str, world_id: str) -> ChunkClientResponse:
        return self.delete(
            f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}",
            timeout_seconds=self.config.command_timeout_seconds,
        )

    # -------------------------------------------------------------------------
    # Blocks
    # -------------------------------------------------------------------------

    def get_blocks(self, project_id: str, world_id: str) -> ChunkClientResponse:
        return self.get(
            f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}/blocks"
        )

    def load_blocks(self, project_id: str, world_id: str) -> ChunkClientResponse:
        return self.get_blocks(project_id, world_id)

    # -------------------------------------------------------------------------
    # Chunks
    # -------------------------------------------------------------------------

    def get_chunk(
        self,
        project_id: str,
        world_id: str,
        *,
        chunk_x: int,
        chunk_y: int,
        chunk_z: int,
        prefer_snapshot: bool | None = None,
        allow_generated: bool | None = None,
        content_profile: str | None = None,
    ) -> ChunkClientResponse:
        query: dict[str, Any] = {
            "chunkX": int(chunk_x),
            "chunkY": int(chunk_y),
            "chunkZ": int(chunk_z),
        }

        if prefer_snapshot is not None:
            query["preferSnapshot"] = _bool_query(prefer_snapshot)

        if allow_generated is not None:
            query["allowGenerated"] = _bool_query(allow_generated)

        if content_profile:
            query["contentProfile"] = str(content_profile)

        return self.get(
            f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}/chunks",
            query=query,
            timeout_seconds=self.config.request_timeout_seconds,
        )

    def load_chunk(
        self,
        project_id: str,
        world_id: str,
        *,
        chunk_x: int,
        chunk_y: int,
        chunk_z: int,
        prefer_snapshot: bool | None = None,
        allow_generated: bool | None = None,
        content_profile: str | None = None,
    ) -> ChunkClientResponse:
        return self.get_chunk(
            project_id,
            world_id,
            chunk_x=chunk_x,
            chunk_y=chunk_y,
            chunk_z=chunk_z,
            prefer_snapshot=prefer_snapshot,
            allow_generated=allow_generated,
            content_profile=content_profile,
        )

    def get_active_editor_dataset(
        self,
        project_id: str,
        world_id: str,
    ) -> ChunkClientResponse:
        return self.get(
            (
                f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}"
                "/editor-datasets/active"
            ),
            timeout_seconds=self.config.request_timeout_seconds,
        )

    def get_active_editor_dataset_chunk(
        self,
        project_id: str,
        world_id: str,
        *,
        chunk_x: int,
        chunk_y: int,
        chunk_z: int,
    ) -> ChunkClientResponse:
        return self.get(
            (
                f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}"
                "/editor-datasets/active/chunks"
            ),
            query={"chunkX": int(chunk_x), "chunkY": int(chunk_y), "chunkZ": int(chunk_z)},
            timeout_seconds=self.config.request_timeout_seconds,
        )

    def get_terrain_region(
        self,
        project_id: str,
        world_id: str,
    ) -> ChunkClientResponse:
        return self.get(
            (
                f"/projects/{_segment(project_id)}/worlds/"
                f"{_segment(world_id)}/terrain/region"
            ),
            timeout_seconds=self.config.batch_timeout_seconds,
        )

    def get_map_structures(
        self,
        project_id: str,
        world_id: str,
    ) -> ChunkClientResponse:
        return self.get(
            (
                f"/projects/{_segment(project_id)}/worlds/"
                f"{_segment(world_id)}/map/structures"
            ),
            timeout_seconds=self.config.batch_timeout_seconds,
        )

    def get_chunks_batch(
        self,
        project_id: str,
        world_id: str,
        chunks: list[Mapping[str, Any]],
        *,
        prefer_snapshot: bool | None = None,
        allow_generated: bool | None = None,
        content_profile: str | None = None,
    ) -> ChunkClientResponse:
        if len(chunks) > self.config.max_batch_chunks:
            return self._local_error_response(
                method="POST",
                path=f"/projects/{project_id}/worlds/{world_id}/chunks/batch",
                url=self.base_url,
                started_at=time.perf_counter(),
                request_id=uuid.uuid4().hex,
                code="chunk_batch_too_large",
                message="Chunk batch exceeds configured maxBatchChunks.",
                details={
                    "requested": len(chunks),
                    "maxBatchChunks": self.config.max_batch_chunks,
                },
                retryable=False,
            )

        body: dict[str, Any] = {
            "chunks": [dict(chunk) for chunk in chunks],
        }

        if prefer_snapshot is not None:
            body["preferSnapshot"] = bool(prefer_snapshot)

        if allow_generated is not None:
            body["allowGenerated"] = bool(allow_generated)

        return self.post(
            f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}/chunks/batch",
            query=(
                {"contentProfile": content_profile} if content_profile else None
            ),
            json_body=body,
            timeout_seconds=self.config.batch_timeout_seconds,
        )

    def load_chunks_batch(
        self,
        project_id: str,
        world_id: str,
        chunks: list[Mapping[str, Any]],
        *,
        prefer_snapshot: bool | None = None,
        allow_generated: bool | None = None,
        content_profile: str | None = None,
    ) -> ChunkClientResponse:
        return self.get_chunks_batch(
            project_id,
            world_id,
            chunks,
            prefer_snapshot=prefer_snapshot,
            allow_generated=allow_generated,
            content_profile=content_profile,
        )

    # -------------------------------------------------------------------------
    # Commands
    # -------------------------------------------------------------------------

    def send_command(
        self,
        project_id: str,
        world_id: str,
        command: Mapping[str, Any],
        *,
        include_command_log: bool | None = None,
    ) -> ChunkClientResponse:
        return self.post(
            f"/projects/{_segment(project_id)}/worlds/{_segment(world_id)}/commands",
            query=(
                {"includeCommandLog": include_command_log}
                if include_command_log is not None
                else None
            ),
            json_body=dict(command),
            timeout_seconds=self.config.command_timeout_seconds,
        )

    def send_set_block(
        self,
        project_id: str,
        world_id: str,
        *,
        position: Mapping[str, Any],
        block_type_id: str,
        user_id: str | None = None,
        session_id: str | None = None,
        client_command_id: str | None = None,
        extra: Mapping[str, Any] | None = None,
    ) -> ChunkClientResponse:
        command: dict[str, Any] = {
            "type": "SetBlock",
            "position": dict(position),
            "blockTypeId": block_type_id,
        }

        if user_id:
            command["userId"] = user_id

        if session_id:
            command["sessionId"] = session_id

        if client_command_id:
            command["clientCommandId"] = client_command_id

        if extra:
            command.update(dict(extra))

        return self.send_command(project_id, world_id, command)

    def set_block(
        self,
        project_id: str,
        world_id: str,
        *,
        position: Mapping[str, Any],
        block_type_id: str,
        user_id: str | None = None,
        session_id: str | None = None,
        client_command_id: str | None = None,
        extra: Mapping[str, Any] | None = None,
    ) -> ChunkClientResponse:
        return self.send_set_block(
            project_id,
            world_id,
            position=position,
            block_type_id=block_type_id,
            user_id=user_id,
            session_id=session_id,
            client_command_id=client_command_id,
            extra=extra,
        )

    def send_remove_block(
        self,
        project_id: str,
        world_id: str,
        *,
        position: Mapping[str, Any],
        user_id: str | None = None,
        session_id: str | None = None,
        client_command_id: str | None = None,
        extra: Mapping[str, Any] | None = None,
    ) -> ChunkClientResponse:
        command: dict[str, Any] = {
            "type": "RemoveBlock",
            "position": dict(position),
        }

        if user_id:
            command["userId"] = user_id

        if session_id:
            command["sessionId"] = session_id

        if client_command_id:
            command["clientCommandId"] = client_command_id

        if extra:
            command.update(dict(extra))

        return self.send_command(project_id, world_id, command)

    def remove_block(
        self,
        project_id: str,
        world_id: str,
        *,
        position: Mapping[str, Any],
        user_id: str | None = None,
        session_id: str | None = None,
        client_command_id: str | None = None,
        extra: Mapping[str, Any] | None = None,
    ) -> ChunkClientResponse:
        return self.send_remove_block(
            project_id,
            world_id,
            position=position,
            user_id=user_id,
            session_id=session_id,
            client_command_id=client_command_id,
            extra=extra,
        )

    # -------------------------------------------------------------------------
    # Proxy-Hilfen für routes/chunk.py
    # -------------------------------------------------------------------------

    def proxy_request(
        self,
        method: str,
        upstream_path: str,
        *,
        query: Mapping[str, Any] | None = None,
        json_body: Any = None,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float | None = None,
    ) -> ChunkClientResponse:
        """
        Generische Proxy-Methode für `routes/chunk.py`.

        `upstream_path` ist relativ zum Chunk-Service, zum Beispiel:

            /projects/dev-project/worlds/world_spawn/chunks
        """

        return self.request(
            method,
            upstream_path,
            query=query,
            json_body=json_body,
            headers=headers,
            timeout_seconds=timeout_seconds,
        )

    def build_url(
        self,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
    ) -> str:
        normalized_path, embedded_query = _split_path_and_query(path)
        query_items = list(embedded_query)

        if query:
            query_items.extend(_query_items(query))

        query_string = urlencode(query_items, doseq=True)
        url = f"{self.config.base_url}{normalized_path}"

        if query_string:
            url = f"{url}?{query_string}"

        return url

    # -------------------------------------------------------------------------
    # Internals
    # -------------------------------------------------------------------------

    def _build_headers(
        self,
        *,
        headers: Mapping[str, str] | None,
        has_json_body: bool,
        request_id: str,
    ) -> dict[str, str]:
        result: dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": self.config.user_agent,
            "X-Vectoplan-Proxy": "vectoplan-editor",
            "X-Vectoplan-Upstream-Service": self.config.service_name,
            "X-Vectoplan-Chunk-Request-Id": request_id,
        }

        if self.config.service_id:
            result["X-VECTOPLAN-Service-ID"] = self.config.service_id
            result["X-Vectoplan-Service"] = self.config.service_id
        if self.config.service_api_key:
            result["Authorization"] = f"Bearer {self.config.service_api_key}"
            result["X-API-Key"] = self.config.service_api_key
            result["X-Vectoplan-Internal-Token"] = self.config.service_api_key

        try:
            from routes.access_context import trusted_chunk_headers

            result.update(trusted_chunk_headers())
        except Exception:
            # Health checks have no project access context. Project requests are
            # rejected by the proxy before the client is called.
            pass

        if has_json_body:
            result["Content-Type"] = "application/json; charset=utf-8"

        if headers:
            for key, value in headers.items():
                normalized_key = str(key).strip()
                if not normalized_key:
                    continue

                lowered = normalized_key.lower()

                if lowered in HOP_BY_HOP_HEADERS or lowered in BLOCKED_FORWARD_HEADERS:
                    continue

                result[normalized_key] = str(value)

        if self.config.forward_user_headers:
            forwarded_headers = _read_forwardable_flask_headers()
            result.update(forwarded_headers)

        return result

    def _encode_body(self, json_body: Any) -> bytes | None:
        if json_body is None:
            return None

        try:
            return json.dumps(
                json_body,
                ensure_ascii=False,
                separators=(",", ":"),
                default=str,
            ).encode("utf-8")
        except Exception as exc:
            raise ValueError(f"Could not JSON-encode request body for Chunk Service: {exc}") from exc

    def _read_response_text(self, response: Any) -> tuple[str, bool]:
        max_bytes = self.config.max_response_bytes

        try:
            raw = response.read(max_bytes + 1)
        except Exception as exc:
            raise ValueError(f"Could not read Chunk Service response body: {exc}") from exc

        truncated = len(raw) > max_bytes

        if truncated:
            raw = raw[:max_bytes]

        return raw.decode("utf-8", errors="replace"), truncated

    def _handle_http_error(
        self,
        exc: HTTPError,
        *,
        method: str,
        path: str,
        url: str,
        started_at: float,
        request_id: str,
    ) -> ChunkClientResponse:
        try:
            raw_text, truncated = self._read_response_text(exc)
        except Exception:
            raw_text = ""
            truncated = False

        parsed_data, parse_error = _parse_json_or_error(raw_text)
        status_code = int(getattr(exc, "code", 0) or 0)
        response_headers = _headers_to_dict(exc.headers)

        if parse_error is not None:
            error = ChunkClientErrorInfo(
                code="chunk_service_http_error",
                message=f"Chunk service returned HTTP {status_code}. Response body was not valid JSON.",
                details={
                    "path": path,
                    "statusCode": status_code,
                    "parseError": parse_error,
                    "truncated": truncated,
                },
                exception_type=type(exc).__name__,
                retryable=status_code in {408, 429, 500, 502, 503, 504},
            )
        else:
            error = _extract_upstream_error(parsed_data, status_code)

        return ChunkClientResponse(
            ok=False,
            method=method,
            path=path,
            url=url,
            status_code=status_code,
            elapsed_ms=_elapsed_ms(started_at),
            data=parsed_data,
            raw_text=raw_text,
            headers=response_headers,
            error=error,
            request_id=request_id,
            truncated=truncated,
            upstream_service=self.config.service_name,
        )

    def _local_error_response(
        self,
        *,
        method: str,
        path: str,
        url: str,
        started_at: float,
        request_id: str,
        code: str,
        message: str,
        details: Mapping[str, Any] | None = None,
        retryable: bool,
    ) -> ChunkClientResponse:
        return ChunkClientResponse(
            ok=False,
            method=method,
            path=path,
            url=url,
            status_code=None,
            elapsed_ms=_elapsed_ms(started_at),
            data=None,
            raw_text=None,
            headers={},
            error=ChunkClientErrorInfo(
                code=code,
                message=message,
                details=dict(details or {}),
                retryable=retryable,
            ),
            request_id=request_id,
            upstream_service=self.config.service_name,
        )


# =============================================================================
# Factory
# =============================================================================

def get_chunk_client(
    app_config: Mapping[str, Any] | None = None,
    environ: Mapping[str, str] | None = None,
) -> ChunkClient:
    """
    Factory für Routen und Backend-Module.

    Es wird bewusst ein leichter Client pro Aufruf erzeugt. Der Client hält keine
    persistenten Sockets und keinen mutable Request-State.
    """

    return ChunkClient.from_sources(app_config=app_config, environ=environ)


# =============================================================================
# Helper
# =============================================================================

def _first_config_value(
    app_config: Mapping[str, Any],
    environ: Mapping[str, str],
    *,
    keys: tuple[str, ...],
    default: Any,
) -> Any:
    for key in keys:
        if key in app_config and app_config[key] not in {None, ""}:
            return app_config[key]

    for key in keys:
        if key in environ and environ[key] not in {None, ""}:
            return environ[key]

    return default


def _coerce_non_empty_string(value: Any, default: str) -> str:
    try:
        normalized = str(value).strip()
    except Exception:
        return default

    return normalized or default


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


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    try:
        normalized = str(value).strip().lower()
    except Exception:
        return default

    if normalized in {"1", "true", "t", "yes", "y", "on", "enabled"}:
        return True

    if normalized in {"0", "false", "f", "no", "n", "off", "disabled"}:
        return False

    return default


def _coerce_string_tuple(value: Any, default: tuple[str, ...]) -> tuple[str, ...]:
    try:
        if value is None:
            return default

        if isinstance(value, (list, tuple, set)):
            raw_values = [str(item).strip() for item in value]
        else:
            raw_values = [part.strip() for part in str(value).split(",")]

        normalized = tuple(_normalize_relative_path(item) for item in raw_values if item)

        return normalized or default
    except Exception:
        return default


def _seconds_from_ms(milliseconds: int, default_seconds: float) -> float:
    try:
        return max(0.1, float(milliseconds) / 1000.0)
    except Exception:
        return default_seconds


@lru_cache(maxsize=64)
def _normalize_base_url(value: str) -> str:
    raw = str(value or "").strip() or DEFAULT_CHUNK_SERVICE_INTERNAL_URL
    parsed = urlparse(raw)

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        LOGGER.warning(
            "Invalid Chunk Service base URL %r. Falling back to %s.",
            value,
            DEFAULT_CHUNK_SERVICE_INTERNAL_URL,
        )
        raw = DEFAULT_CHUNK_SERVICE_INTERNAL_URL

    return raw.rstrip("/")


def _normalize_method(method: str) -> str:
    normalized = str(method or "GET").strip().upper()

    if not normalized:
        return "GET"

    if not normalized.replace("-", "").isalpha():
        raise ValueError(f"Invalid HTTP method for Chunk Service request: {method!r}")

    return normalized


def _normalize_relative_path(path: str) -> str:
    raw = str(path or "").strip()

    if not raw:
        return "/"

    parsed = urlparse(raw)

    if parsed.scheme or parsed.netloc:
        raise ValueError("Chunk client path must be relative. Absolute URLs are not allowed.")

    normalized_path = parsed.path or "/"

    if not normalized_path.startswith("/"):
        normalized_path = f"/{normalized_path}"

    segments = [segment for segment in normalized_path.split("/") if segment]

    if any(segment == ".." for segment in segments):
        raise ValueError("Chunk client path must not contain '..' path segments.")

    return normalized_path


def _split_path_and_query(path: str) -> tuple[str, list[tuple[str, Any]]]:
    raw = str(path or "").strip() or "/"
    parsed = urlparse(raw)
    normalized_path = _normalize_relative_path(parsed.path or "/")
    embedded_query = parse_qsl(parsed.query, keep_blank_values=True)
    return normalized_path, list(embedded_query)


def _query_items(query: Mapping[str, Any]) -> list[tuple[str, Any]]:
    items: list[tuple[str, Any]] = []

    for key, value in query.items():
        if value is None:
            continue

        if isinstance(value, bool):
            items.append((str(key), _bool_query(value)))
            continue

        if isinstance(value, (list, tuple, set)):
            for item in value:
                if item is None:
                    continue

                if isinstance(item, bool):
                    items.append((str(key), _bool_query(item)))
                else:
                    items.append((str(key), item))
        else:
            items.append((str(key), value))

    return items


def _segment(value: str) -> str:
    raw = str(value or "").strip()

    if not raw:
        raise ValueError("Path segment must not be empty.")

    if "/" in raw or "\\" in raw:
        raise ValueError(f"Invalid path segment: {raw!r}")

    return quote(raw, safe="")


def _bool_query(value: bool) -> str:
    return "true" if bool(value) else "false"


def _headers_to_dict(headers: Any) -> dict[str, str]:
    result: dict[str, str] = {}

    try:
        for key, value in dict(headers or {}).items():
            result[str(key)] = str(value)
    except Exception:
        return {}

    return result


def _parse_json_or_error(raw_text: str | None) -> tuple[Any, dict[str, str] | None]:
    if raw_text is None:
        return None, None

    text = raw_text.strip()

    if not text:
        return None, None

    try:
        return json.loads(text), None
    except JSONDecodeError as exc:
        return None, {
            "code": "invalid_json_response",
            "message": f"Chunk service response was not valid JSON: {exc.msg}",
        }


def _is_upstream_ok(status_code: int, data: Any) -> bool:
    if not 200 <= int(status_code) < 400:
        return False

    if isinstance(data, Mapping) and data.get("ok") is False:
        return False

    return True


def _extract_upstream_error(data: Any, status_code: int | None) -> ChunkClientErrorInfo:
    retryable = status_code in {408, 429, 500, 502, 503, 504}

    if isinstance(data, Mapping):
        upstream_error = data.get("error")

        if isinstance(upstream_error, Mapping):
            code = str(upstream_error.get("code") or "chunk_service_error")
            message = str(upstream_error.get("message") or "Chunk service returned an error.")
            details = upstream_error.get("details")

            return ChunkClientErrorInfo(
                code=code,
                message=message,
                details=dict(details) if isinstance(details, Mapping) else {},
                retryable=retryable,
            )

        if data.get("ok") is False:
            return ChunkClientErrorInfo(
                code=str(data.get("code") or "chunk_service_error"),
                message=str(data.get("message") or "Chunk service returned ok=false."),
                details={
                    "statusCode": status_code,
                },
                retryable=retryable,
            )

    return ChunkClientErrorInfo(
        code="chunk_service_http_error",
        message=f"Chunk service returned HTTP {status_code}.",
        details={
            "statusCode": status_code,
        },
        retryable=retryable,
    )


def _elapsed_ms(started_at: float) -> float:
    return (time.perf_counter() - started_at) * 1000.0


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


def _safe_response_headers_for_payload(headers: Mapping[str, str]) -> dict[str, str]:
    safe: dict[str, str] = {}

    for key, value in headers.items():
        lowered = str(key).lower()

        if lowered in {"set-cookie", "cookie", "authorization"}:
            continue

        safe[str(key)] = str(value)

    return safe


def _read_forwardable_flask_headers() -> dict[str, str]:
    if flask_request is None:
        return {}

    try:
        headers = getattr(flask_request, "headers", None)
    except Exception:
        return {}

    if headers is None:
        return {}

    result: dict[str, str] = {}

    for source_name, target_name in (
        ("X-Request-Id", "X-Request-Id"),
        ("X-Correlation-Id", "X-Correlation-Id"),
        ("X-Vectoplan-User-Id", "X-Vectoplan-User-Id"),
        ("X-Vectoplan-Session-Id", "X-Vectoplan-Session-Id"),
    ):
        try:
            value = headers.get(source_name)
        except Exception:
            value = None

        if value:
            result[target_name] = str(value)

    return result


__all__ = [
    "ChunkClient",
    "ChunkClientConfig",
    "ChunkClientErrorInfo",
    "ChunkClientResponse",
    "get_chunk_client",
]
