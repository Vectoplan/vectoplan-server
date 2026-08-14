# services/vectoplan-editor/routes/chunk.py
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Any, Callable, Mapping

from flask import Blueprint, Response, current_app, jsonify, request


LOGGER = logging.getLogger(__name__)

CHUNK_ROUTE_MODULE_VERSION = "0.2.0"

CHUNK_PROXY_PREFIX = "/editor/api/chunk"

DEFAULT_PROJECT_ID = "dev-project"
DEFAULT_WORLD_ID = "world_spawn"

DEFAULT_REGISTRY_ID = "debug-blocks"
DEFAULT_REGISTRY_VERSION = "1"

DEFAULT_PLACEABLE_BLOCKS = (
    {
        "blockTypeId": "debug_grass",
        "label": "Debug Grass",
        "cellValue": 1,
        "paletteIndex": 0,
        "solid": True,
        "placeable": True,
        "breakable": True,
    },
    {
        "blockTypeId": "debug_dirt",
        "label": "Debug Dirt",
        "cellValue": 2,
        "paletteIndex": 1,
        "solid": True,
        "placeable": True,
        "breakable": True,
    },
)

chunk_bp = Blueprint(
    "chunk",
    __name__,
    url_prefix=CHUNK_PROXY_PREFIX,
)


# =============================================================================
# Diagnose / Status
# =============================================================================

@chunk_bp.get("/_status")
def chunk_proxy_status() -> Response:
    """
    Lokaler Editor-Proxy-Status.

    Diese Route ist bewusst read-only und soll auch dann antworten, wenn
    `vectoplan-chunk` gerade nicht erreichbar ist.

    Zweck:
    - beweist, dass routes/chunk.py registriert ist
    - beweist, dass der Proxy konfiguriert ist
    - versucht optional einen Upstream-Ping
    - markiert den Proxy als degraded, wenn der Upstream nicht erreichbar ist
    """

    started_at = time.perf_counter()
    request_id = _request_id()

    config_summary = _chunk_proxy_config_summary()
    client_info: dict[str, Any] = {
        "enabled": _chunk_service_enabled(),
        "importable": False,
        "created": False,
        "pingAttempted": False,
        "reachable": False,
    }

    if not _chunk_service_enabled():
        payload = {
            "ok": True,
            "status": "disabled",
            "service": "vectoplan-editor",
            "route": "chunk-proxy",
            "moduleVersion": CHUNK_ROUTE_MODULE_VERSION,
            "requestId": request_id,
            "elapsedMs": _elapsed_ms(started_at),
            "proxy": {
                "prefix": CHUNK_PROXY_PREFIX,
                "config": config_summary,
                "supportedRoutes": _supported_routes(),
            },
            "chunkService": client_info,
        }
        return _json_response(payload, status=200, request_id=request_id)

    try:
        client = _get_chunk_client()
        client_info["importable"] = True
        client_info["created"] = True
        client_info["baseUrl"] = getattr(client, "base_url", config_summary.get("internalBaseUrl"))

        try:
            ping_response = _call_client_status(client)
            client_info["pingAttempted"] = True
            client_info["reachable"] = bool(getattr(ping_response, "ok", False))
            client_info["statusCode"] = getattr(ping_response, "status_code", None)
            client_info["elapsedMs"] = round(float(getattr(ping_response, "elapsed_ms", 0.0)), 3)
            client_info["requestId"] = getattr(ping_response, "request_id", None)

            data = getattr(ping_response, "data", None)
            if data is not None:
                client_info["dataPreview"] = _payload_preview(data)

            error = getattr(ping_response, "error", None)
            if error is not None:
                client_info["error"] = _error_to_dict(error)

        except Exception as exc:
            LOGGER.warning("Chunk proxy upstream ping failed during _status: %s", exc)
            client_info["pingAttempted"] = True
            client_info["reachable"] = False
            client_info["error"] = _error_payload(
                code="chunk_service_ping_failed",
                message="Chunk service ping failed during proxy status check.",
                details={
                    "exceptionType": type(exc).__name__,
                    "exceptionMessage": str(exc),
                },
            )

        status_text = "ready" if client_info["reachable"] else "degraded"

        payload = {
            "ok": True,
            "status": status_text,
            "service": "vectoplan-editor",
            "route": "chunk-proxy",
            "moduleVersion": CHUNK_ROUTE_MODULE_VERSION,
            "requestId": request_id,
            "elapsedMs": _elapsed_ms(started_at),
            "proxy": {
                "prefix": CHUNK_PROXY_PREFIX,
                "config": config_summary,
                "supportedRoutes": _supported_routes(),
            },
            "chunkService": client_info,
        }

        return _json_response(payload, status=200, request_id=request_id)

    except Exception as exc:
        LOGGER.exception("Chunk proxy local status check failed.")

        payload = {
            "ok": False,
            "status": "error",
            "service": "vectoplan-editor",
            "route": "chunk-proxy",
            "moduleVersion": CHUNK_ROUTE_MODULE_VERSION,
            "requestId": request_id,
            "elapsedMs": _elapsed_ms(started_at),
            "proxy": {
                "prefix": CHUNK_PROXY_PREFIX,
                "config": config_summary,
                "supportedRoutes": _supported_routes(),
            },
            "chunkService": client_info,
            "error": _error_payload(
                code="chunk_proxy_status_failed",
                message="Editor chunk proxy status check failed.",
                details={
                    "exceptionType": type(exc).__name__,
                    "exceptionMessage": str(exc),
                },
            ),
        }

        return _json_response(payload, status=500, request_id=request_id)


@chunk_bp.get("/_test/connection")
def chunk_proxy_test_connection() -> Response:
    """
    Strenger Verbindungstest zum Upstream `vectoplan-chunk`.

    Im Unterschied zu /_status gibt diese Route 503 zurück, wenn der Upstream
    nicht erreichbar ist.
    """

    return _proxy_call(
        lambda client: _call_client_status(client),
        operation="test_connection",
        context={
            "kind": "diagnostic",
        },
        preserve_upstream_payload=False,
    )


# =============================================================================
# Projekt-Routen
# =============================================================================

@chunk_bp.get("/projects")
def list_projects() -> Response:
    return _proxy_call(
        lambda client: client.list_projects(),
        operation="list_projects",
    )


@chunk_bp.post("/projects")
def create_project() -> Response:
    body, error_response = _read_json_body(required=False)

    if error_response is not None:
        return error_response

    return _proxy_call(
        lambda client: client.create_project(body or {}),
        operation="create_project",
    )


@chunk_bp.get("/projects/<project_id>")
def get_project(project_id: str) -> Response:
    return _proxy_call(
        lambda client: client.get_project(project_id),
        operation="get_project",
        context={"projectId": project_id},
    )


@chunk_bp.delete("/projects/<project_id>")
def delete_project(project_id: str) -> Response:
    return _proxy_call(
        lambda client: client.delete_project(project_id),
        operation="delete_project",
        context={"projectId": project_id},
    )


@chunk_bp.get("/projects/<project_id>/bootstrap")
def get_project_bootstrap(project_id: str) -> Response:
    return _proxy_call(
        lambda client: client.get_project_bootstrap(project_id),
        operation="get_project_bootstrap",
        context={"projectId": project_id},
    )


# =============================================================================
# World-Routen
# =============================================================================

@chunk_bp.get("/projects/<project_id>/worlds")
def list_worlds(project_id: str) -> Response:
    return _proxy_call(
        lambda client: client.list_worlds(project_id),
        operation="list_worlds",
        context={"projectId": project_id},
    )


@chunk_bp.post("/projects/<project_id>/worlds")
def create_world(project_id: str) -> Response:
    body, error_response = _read_json_body(required=False)

    if error_response is not None:
        return error_response

    return _proxy_call(
        lambda client: client.create_world(project_id, body or {}),
        operation="create_world",
        context={"projectId": project_id},
    )


@chunk_bp.get("/projects/<project_id>/worlds/<world_id>")
def get_world(project_id: str, world_id: str) -> Response:
    return _proxy_call(
        lambda client: client.get_world(project_id, world_id),
        operation="get_world",
        context={
            "projectId": project_id,
            "worldId": world_id,
        },
    )


@chunk_bp.delete("/projects/<project_id>/worlds/<world_id>")
def delete_world(project_id: str, world_id: str) -> Response:
    return _proxy_call(
        lambda client: client.delete_world(project_id, world_id),
        operation="delete_world",
        context={
            "projectId": project_id,
            "worldId": world_id,
        },
    )


# =============================================================================
# Blocks / Placeable Blocks
# =============================================================================

@chunk_bp.get("/placeable-blocks")
def get_placeable_blocks() -> Response:
    """
    Browser-Hotbar-Quelle für die erste Remote-Chunk-Integration.

    Diese Route darf in der ersten Stufe bewusst einen lokalen Placeholder
    liefern, damit die Hotbar stabil `debug_grass` und `debug_dirt` verwenden
    kann, selbst wenn der vollständige Blocks-Pfad noch nicht fertig gemappt ist.
    """

    request_id = _request_id()
    started_at = time.perf_counter()

    if _placeable_blocks_placeholder_enabled():
        project_id = _default_project_id()
        world_id = _default_world_id()
        blocks = _configured_placeable_blocks()

        payload = {
            "ok": True,
            "responseVersion": "vectoplan-editor-placeable-blocks.v1",
            "source": "editor-placeholder",
            "projectId": project_id,
            "worldId": world_id,
            "registryId": _registry_id(),
            "registryVersion": _registry_version(),
            "blocks": blocks,
            "routeHints": _default_route_hints(project_id, world_id),
            "elapsedMs": _elapsed_ms(started_at),
            "requestId": request_id,
        }

        return _json_response(payload, status=200, request_id=request_id)

    project_id = _default_project_id()
    world_id = _default_world_id()

    return _proxy_call(
        lambda client: client.get_blocks(project_id, world_id),
        operation="get_placeable_blocks_from_upstream",
        context={
            "projectId": project_id,
            "worldId": world_id,
        },
    )


@chunk_bp.get("/projects/<project_id>/worlds/<world_id>/blocks")
def get_blocks(project_id: str, world_id: str) -> Response:
    return _proxy_call(
        lambda client: client.get_blocks(project_id, world_id),
        operation="get_blocks",
        context={
            "projectId": project_id,
            "worldId": world_id,
        },
    )


# =============================================================================
# Chunk-Routen
# =============================================================================

@chunk_bp.get("/projects/<project_id>/worlds/<world_id>/chunks")
def get_chunk(project_id: str, world_id: str) -> Response:
    query = _read_chunk_query()

    if query["error"] is not None:
        return _json_response(
            {
                "ok": False,
                "error": query["error"],
            },
            status=400,
            request_id=_request_id(),
        )

    return _proxy_call(
        lambda client: client.get_chunk(
            project_id,
            world_id,
            chunk_x=query["chunkX"],
            chunk_y=query["chunkY"],
            chunk_z=query["chunkZ"],
            prefer_snapshot=query["preferSnapshot"],
            allow_generated=query["allowGenerated"],
            content_profile=query["contentProfile"],
        ),
        operation="get_chunk",
        context={
            "projectId": project_id,
            "worldId": world_id,
            "chunkX": query["chunkX"],
            "chunkY": query["chunkY"],
            "chunkZ": query["chunkZ"],
            "preferSnapshot": query["preferSnapshot"],
            "allowGenerated": query["allowGenerated"],
            "contentProfile": query["contentProfile"],
        },
    )


@chunk_bp.post("/projects/<project_id>/worlds/<world_id>/chunks/batch")
def get_chunks_batch(project_id: str, world_id: str) -> Response:
    body, error_response = _read_json_body(required=True)

    if error_response is not None:
        return error_response

    if not isinstance(body, Mapping):
        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="invalid_batch_payload",
                    message="Batch chunk request body must be a JSON object.",
                    details={
                        "receivedType": type(body).__name__,
                    },
                ),
            },
            status=400,
            request_id=_request_id(),
        )

    chunks = body.get("chunks")

    if not isinstance(chunks, list):
        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="invalid_batch_chunks",
                    message="Batch chunk request must contain a 'chunks' array.",
                    details={
                        "receivedType": type(chunks).__name__,
                    },
                ),
            },
            status=400,
            request_id=_request_id(),
        )

    max_batch_chunks = _max_batch_chunks()
    if len(chunks) > max_batch_chunks:
        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="chunk_batch_too_large",
                    message="Batch chunk request exceeds configured maximum.",
                    details={
                        "chunkCount": len(chunks),
                        "maxBatchChunks": max_batch_chunks,
                    },
                ),
            },
            status=413,
            request_id=_request_id(),
        )

    prefer_snapshot = _optional_bool_from_mapping(body, "preferSnapshot")
    allow_generated = _optional_bool_from_mapping(body, "allowGenerated")

    return _proxy_call(
        lambda client: client.get_chunks_batch(
            project_id,
            world_id,
            chunks,
            prefer_snapshot=prefer_snapshot,
            allow_generated=allow_generated,
            content_profile=_requested_chunk_content_profile(),
        ),
        operation="get_chunks_batch",
        context={
            "projectId": project_id,
            "worldId": world_id,
            "chunkCount": len(chunks),
            "preferSnapshot": prefer_snapshot,
            "allowGenerated": allow_generated,
            "contentProfile": _requested_chunk_content_profile(),
        },
    )


@chunk_bp.get("/projects/<project_id>/worlds/<world_id>/terrain/region")
def get_terrain_region(project_id: str, world_id: str) -> Response:
    return _proxy_call(
        lambda client: client.get_terrain_region(project_id, world_id),
        operation="get_terrain_region",
        context={
            "projectId": project_id,
            "worldId": world_id,
        },
    )


# =============================================================================
# Command-Routen
# =============================================================================

@chunk_bp.post("/projects/<project_id>/worlds/<world_id>/commands")
def send_command(project_id: str, world_id: str) -> Response:
    body, error_response = _read_json_body(required=True)

    if error_response is not None:
        return error_response

    if not isinstance(body, Mapping):
        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="invalid_command_payload",
                    message="Command payload must be a JSON object.",
                    details={
                        "receivedType": type(body).__name__,
                    },
                ),
            },
            status=400,
            request_id=_request_id(),
        )

    command_type = body.get("type")

    if not command_type or not isinstance(command_type, str):
        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="missing_command_type",
                    message="Command payload must contain a string field 'type'.",
                ),
            },
            status=400,
            request_id=_request_id(),
        )

    include_command_log = _optional_bool_arg("includeCommandLog")

    return _proxy_call(
        lambda client: client.send_command(
            project_id,
            world_id,
            body,
            include_command_log=include_command_log,
        ),
        operation="send_command",
        context={
            "projectId": project_id,
            "worldId": world_id,
            "commandType": command_type,
            "includeCommandLog": include_command_log,
        },
    )


# =============================================================================
# Default-Aliase für dev-project / world_spawn
# =============================================================================

@chunk_bp.get("/bootstrap")
def get_default_project_bootstrap() -> Response:
    project_id = _default_project_id()

    return _proxy_call(
        lambda client: client.get_project_bootstrap(project_id),
        operation="get_default_project_bootstrap",
        context={"projectId": project_id},
    )


@chunk_bp.get("/blocks")
def get_default_blocks() -> Response:
    project_id = _default_project_id()
    world_id = _default_world_id()

    return _proxy_call(
        lambda client: client.get_blocks(project_id, world_id),
        operation="get_default_blocks",
        context={
            "projectId": project_id,
            "worldId": world_id,
        },
    )


@chunk_bp.get("/chunks")
def get_default_chunk() -> Response:
    project_id = _default_project_id()
    world_id = _default_world_id()

    return get_chunk(project_id, world_id)


@chunk_bp.post("/chunks/batch")
def get_default_chunks_batch() -> Response:
    project_id = _default_project_id()
    world_id = _default_world_id()

    return get_chunks_batch(project_id, world_id)


@chunk_bp.post("/commands")
def send_default_command() -> Response:
    project_id = _default_project_id()
    world_id = _default_world_id()

    return send_command(project_id, world_id)


# =============================================================================
# Proxy-Helper
# =============================================================================

def _proxy_call(
    call: Callable[[Any], Any],
    *,
    operation: str,
    context: Mapping[str, Any] | None = None,
    preserve_upstream_payload: bool = True,
) -> Response:
    request_id = _request_id()
    started_at = time.perf_counter()
    safe_context = dict(context or {})

    authorization_error = _authorize_proxy_request(operation, safe_context)
    if authorization_error is not None:
        return authorization_error

    if not _chunk_service_enabled():
        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="chunk_service_disabled",
                    message="Editor Chunk Service proxy is disabled by configuration.",
                    details={
                        "operation": operation,
                        "context": safe_context,
                    },
                ),
            },
            status=503,
            request_id=request_id,
        )

    try:
        client = _get_chunk_client()
    except Exception as exc:
        LOGGER.exception("Could not create Chunk client for operation %s.", operation)

        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="chunk_client_unavailable",
                    message="Editor could not initialize the Chunk Service client.",
                    details={
                        "operation": operation,
                        "context": safe_context,
                        "exceptionType": type(exc).__name__,
                        "exceptionMessage": str(exc),
                    },
                ),
            },
            status=500,
            request_id=request_id,
        )

    try:
        upstream_response = call(client)
    except Exception as exc:
        LOGGER.exception("Chunk proxy operation failed before upstream response: %s.", operation)

        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="chunk_proxy_operation_failed",
                    message="Editor chunk proxy operation failed.",
                    details={
                        "operation": operation,
                        "context": safe_context,
                        "exceptionType": type(exc).__name__,
                        "exceptionMessage": str(exc),
                    },
                ),
            },
            status=500,
            request_id=request_id,
        )

    try:
        include_upstream_details = _include_upstream_details()

        if preserve_upstream_payload:
            payload = _upstream_payload_or_proxy_error(
                upstream_response,
                include_upstream_details=include_upstream_details,
            )
        else:
            payload = _response_to_proxy_status_payload(
                upstream_response,
                operation=operation,
                context=safe_context,
                include_upstream_details=include_upstream_details,
            )

        status_code = _response_proxy_status_code(upstream_response)
        headers = _response_proxy_headers(upstream_response)

        headers["X-Vectoplan-Editor-Chunk-Operation"] = operation
        headers["X-Vectoplan-Editor-Chunk-Proxy-Elapsed-Ms"] = str(_elapsed_ms(started_at))

        raw_text = getattr(upstream_response, "raw_text", None)
        if (
            preserve_upstream_payload
            and bool(getattr(upstream_response, "ok", False))
            and isinstance(raw_text, str)
            and raw_text
            and not bool(getattr(upstream_response, "truncated", False))
        ):
            # Chunk batches can contain several megabytes of JSON. Reusing the
            # already validated upstream body avoids a second recursive
            # _json_safe pass plus a complete JSON serialization in the editor
            # proxy for every streamed batch.
            return _raw_json_response(
                raw_text,
                status=status_code,
                headers=headers,
                request_id=request_id,
            )

        return _json_response(
            payload,
            status=status_code,
            headers=headers,
            request_id=request_id,
        )

    except Exception as exc:
        LOGGER.exception("Could not convert Chunk proxy response for operation %s.", operation)

        return _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="chunk_proxy_response_conversion_failed",
                    message="Editor could not convert Chunk Service response.",
                    details={
                        "operation": operation,
                        "context": safe_context,
                        "exceptionType": type(exc).__name__,
                        "exceptionMessage": str(exc),
                    },
                ),
            },
            status=502,
            request_id=request_id,
        )



def _authorize_proxy_request(
    operation: str,
    context: Mapping[str, Any],
) -> Response | None:
    if not _config_bool(
        "VECTOPLAN_EDITOR_CHUNK_PROXY_ENFORCE_PROJECT_ACCESS",
        default=True,
    ):
        return None

    if operation in {"test_connection"}:
        return None

    from routes.access_context import (
        EditorAccessError,
        access_error_response,
        require_project_access,
    )

    if operation in {"create_project", "delete_project"}:
        return access_error_response(
            EditorAccessError(
                "project_lifecycle_owned_by_app",
                "Chunk projects can only be created or deleted through vectoplan-app.",
            )
        )

    project_id = str(context.get("projectId") or "").strip()
    world_id = str(context.get("worldId") or "").strip()
    if not project_id:
        return access_error_response(
            EditorAccessError(
                "canonical_project_context_required",
                "The Editor proxy does not expose cross-project collection operations.",
            )
        )

    capability = "view"
    if operation in {
        "create_world",
        "delete_world",
    }:
        capability = "manage"
    elif operation in {"send_command", "send_default_command"}:
        capability = "command"
    elif bool(context.get("allowGenerated")):
        capability = "materialize"

    try:
        require_project_access(
            project_id=project_id,
            world_id=world_id or None,
            capability=capability,
        )
    except EditorAccessError as exc:
        return access_error_response(exc)
    return None


def _get_chunk_client() -> Any:
    try:
        from src.clients.chunk_client import get_chunk_client

        return get_chunk_client()
    except Exception:
        try:
            from src.clients import get_chunk_client

            return get_chunk_client()
        except Exception:
            LOGGER.exception("Failed to import/create Chunk client.")
            raise


def _call_client_status(client: Any) -> Any:
    if hasattr(client, "test_connection"):
        return client.test_connection()

    if hasattr(client, "get_status"):
        return client.get_status()

    if hasattr(client, "ping"):
        return client.ping()

    raise RuntimeError("Chunk client does not expose test_connection(), get_status() or ping().")


def _upstream_payload_or_proxy_error(
    upstream_response: Any,
    *,
    include_upstream_details: bool,
) -> Any:
    if hasattr(upstream_response, "upstream_payload_or_proxy_error"):
        return upstream_response.upstream_payload_or_proxy_error(
            include_upstream_details=include_upstream_details,
        )

    if hasattr(upstream_response, "upstream_payload_or_error"):
        return upstream_response.upstream_payload_or_error()

    data = getattr(upstream_response, "data", None)
    if data is not None:
        return data

    if hasattr(upstream_response, "to_dict"):
        try:
            return upstream_response.to_dict(
                include_raw_text=False,
                include_upstream_details=include_upstream_details,
            )
        except TypeError:
            return upstream_response.to_dict(include_raw_text=False)

    return {
        "ok": False,
        "error": _error_payload(
            code="invalid_upstream_response",
            message="Chunk client returned an unsupported response object.",
            details={
                "responseType": type(upstream_response).__name__,
            },
        ),
    }


def _response_to_proxy_status_payload(
    upstream_response: Any,
    *,
    operation: str,
    context: Mapping[str, Any],
    include_upstream_details: bool,
) -> dict[str, Any]:
    ok = bool(getattr(upstream_response, "ok", False))
    data = getattr(upstream_response, "data", None)
    error = getattr(upstream_response, "error", None)

    payload: dict[str, Any] = {
        "ok": ok,
        "operation": operation,
        "context": _json_safe(dict(context)),
        "requestId": getattr(upstream_response, "request_id", None),
        "statusCode": getattr(upstream_response, "status_code", None),
        "elapsedMs": round(float(getattr(upstream_response, "elapsed_ms", 0.0)), 3),
        "upstreamService": getattr(upstream_response, "upstream_service", "vectoplan-chunk"),
    }

    if data is not None:
        payload["data"] = _payload_preview(data)

    if error is not None:
        payload["error"] = _error_to_dict(error)

    if include_upstream_details and hasattr(upstream_response, "to_dict"):
        try:
            payload["upstream"] = upstream_response.to_dict(
                include_raw_text=False,
                include_upstream_details=True,
            )
        except TypeError:
            payload["upstream"] = upstream_response.to_dict(include_raw_text=False)
        except Exception:
            pass

    return payload


def _response_proxy_status_code(upstream_response: Any) -> int:
    if hasattr(upstream_response, "proxy_status_code"):
        try:
            return int(upstream_response.proxy_status_code())
        except Exception:
            pass

    status_code = getattr(upstream_response, "status_code", None)
    if isinstance(status_code, int):
        return status_code

    error = getattr(upstream_response, "error", None)
    retryable = bool(getattr(error, "retryable", False)) if error is not None else False
    return 503 if retryable else 502


def _response_proxy_headers(upstream_response: Any) -> dict[str, str]:
    if hasattr(upstream_response, "proxy_headers"):
        try:
            headers = upstream_response.proxy_headers()
            if isinstance(headers, Mapping):
                return {str(key): str(value) for key, value in headers.items()}
        except Exception:
            pass

    headers = {
        "X-Vectoplan-Chunk-Proxy": "vectoplan-editor",
    }

    request_id = getattr(upstream_response, "request_id", None)
    if request_id:
        headers["X-Vectoplan-Chunk-Request-Id"] = str(request_id)

    status_code = getattr(upstream_response, "status_code", None)
    if status_code is not None:
        headers["X-Vectoplan-Chunk-Upstream-Status"] = str(status_code)

    return headers


# =============================================================================
# Request-/Response-Helfer
# =============================================================================

def _json_response(
    payload: Any,
    *,
    status: int = 200,
    headers: Mapping[str, str] | None = None,
    request_id: str | None = None,
) -> Response:
    safe_payload = _json_safe(payload)

    try:
        response = jsonify(safe_payload)
    except Exception:
        LOGGER.exception("jsonify failed for chunk proxy payload; falling back to json.dumps.")
        response = current_app.response_class(
            json.dumps(
                _json_safe(
                    {
                        "ok": False,
                        "error": _error_payload(
                            code="json_response_serialization_failed",
                            message="Editor could not serialize chunk proxy response.",
                        ),
                    }
                ),
                ensure_ascii=False,
                default=str,
            ),
            mimetype="application/json",
        )

    response.status_code = _safe_status_code(status)

    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Vectoplan-Editor-Chunk-Proxy"] = "true"
    response.headers["X-Vectoplan-Editor-Chunk-Route-Version"] = CHUNK_ROUTE_MODULE_VERSION

    resolved_request_id = request_id or _request_id()
    response.headers["X-Vectoplan-Request-Id"] = resolved_request_id

    if headers:
        for key, value in headers.items():
            header_key = str(key).strip()
            if not header_key:
                continue

            if header_key.lower() in {
                "content-length",
                "content-encoding",
                "transfer-encoding",
                "connection",
            }:
                continue

            response.headers[header_key] = str(value)

    return response


def _raw_json_response(
    raw_text: str,
    *,
    status: int = 200,
    headers: Mapping[str, str] | None = None,
    request_id: str | None = None,
) -> Response:
    """Return validated upstream JSON without parsing/serializing it again."""
    response = current_app.response_class(raw_text, mimetype="application/json")
    response.status_code = _safe_status_code(status)

    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Vectoplan-Editor-Chunk-Proxy"] = "true"
    response.headers["X-Vectoplan-Editor-Chunk-Route-Version"] = CHUNK_ROUTE_MODULE_VERSION
    response.headers["X-Vectoplan-Request-Id"] = request_id or _request_id()

    if headers:
        for key, value in headers.items():
            header_key = str(key).strip()
            if not header_key or header_key.lower() in {
                "content-length",
                "content-encoding",
                "transfer-encoding",
                "connection",
            }:
                continue
            response.headers[header_key] = str(value)

    return response


def _read_json_body(*, required: bool) -> tuple[Any, Response | None]:
    try:
        if not request.data and not required:
            return {}, None

        body = request.get_json(silent=True)

        if body is None:
            if required:
                return None, _json_response(
                    {
                        "ok": False,
                        "error": _error_payload(
                            code="invalid_json_body",
                            message="Request body must be valid JSON.",
                        ),
                    },
                    status=400,
                    request_id=_request_id(),
                )

            return {}, None

        return body, None

    except Exception as exc:
        LOGGER.exception("Could not read JSON request body.")

        return None, _json_response(
            {
                "ok": False,
                "error": _error_payload(
                    code="json_body_read_failed",
                    message="Could not read JSON request body.",
                    details={
                        "exceptionType": type(exc).__name__,
                        "exceptionMessage": str(exc),
                    },
                ),
            },
            status=400,
            request_id=_request_id(),
        )



def _requested_chunk_content_profile() -> str | None:
    value = (
        request.headers.get('X-Vectoplan-Chunk-Content-Profile')
        or request.args.get('contentProfile')
        or request.args.get('content_profile')
        or ''
    )
    normalized = str(value).strip().lower()
    if normalized in {'full', 'dense', 'canonical'}:
        return 'full'
    if normalized in {'surface', 'surface-shell', 'surface-shell.v1'}:
        return 'surface-shell.v1'
    return None

def _read_chunk_query() -> dict[str, Any]:
    parsed: dict[str, Any] = {
        "chunkX": None,
        "chunkY": None,
        "chunkZ": None,
        "preferSnapshot": _optional_bool_arg("preferSnapshot"),
        "allowGenerated": _optional_bool_arg("allowGenerated"),
        "contentProfile": _requested_chunk_content_profile(),
        "error": None,
    }

    missing: list[str] = []
    invalid: dict[str, Any] = {}

    for key in ("chunkX", "chunkY", "chunkZ"):
        raw = request.args.get(key)

        if raw in {None, ""}:
            missing.append(key)
            continue

        try:
            parsed[key] = int(str(raw))
        except Exception:
            invalid[key] = raw

    if missing or invalid:
        parsed["error"] = _error_payload(
            code="invalid_chunk_coordinates",
            message="Chunk request requires integer query parameters chunkX, chunkY and chunkZ.",
            details={
                "missing": missing,
                "invalid": invalid,
            },
        )

    return parsed


def _optional_bool_arg(name: str) -> bool | None:
    if name not in request.args:
        return None

    return _parse_bool(request.args.get(name))


def _optional_bool_from_mapping(mapping: Mapping[str, Any], key: str) -> bool | None:
    if key not in mapping:
        return None

    return _parse_bool(mapping.get(key))


def _parse_bool(value: Any) -> bool | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()

    if normalized in {"1", "true", "yes", "y", "on", "enabled"}:
        return True

    if normalized in {"0", "false", "no", "n", "off", "disabled"}:
        return False

    return None


def _safe_status_code(value: Any) -> int:
    try:
        status = int(value)
    except Exception:
        return 500

    if status < 100 or status > 599:
        return 500

    return status


def _request_id() -> str:
    try:
        existing = (
            request.headers.get("X-Request-Id")
            or request.headers.get("X-Vectoplan-Request-Id")
            or request.args.get("requestId")
        )
    except Exception:
        existing = None

    if existing:
        return str(existing)

    return uuid.uuid4().hex


# =============================================================================
# Config-Helfer
# =============================================================================

def _chunk_service_enabled() -> bool:
    return _config_bool(
        "EDITOR_CHUNK_SERVICE_ENABLED",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED",
        "EDITOR_CHUNK_ENABLED",
        "VECTOPLAN_EDITOR_CHUNK_ENABLED",
        default=True,
    )


def _placeable_blocks_placeholder_enabled() -> bool:
    return _config_bool(
        "EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER",
        "VECTOPLAN_EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER",
        default=True,
    )


def _include_upstream_details() -> bool:
    return _config_bool(
        "EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
        "VECTOPLAN_EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
        default=True,
    )


def _default_project_id() -> str:
    return _config_value(
        "EDITOR_CHUNK_SERVICE_PROJECT_ID",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID",
        "EDITOR_DEFAULT_PROJECT_ID",
        "VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID",
        "VECTOPLAN_CHUNK_DEFAULT_PROJECT_ID",
        default=DEFAULT_PROJECT_ID,
    )


def _default_world_id() -> str:
    return _config_value(
        "EDITOR_CHUNK_SERVICE_WORLD_ID",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_WORLD_ID",
        "EDITOR_DEFAULT_WORLD_ID",
        "VECTOPLAN_EDITOR_DEFAULT_WORLD_ID",
        "VECTOPLAN_CHUNK_DEFAULT_INSTANCE_WORLD_ID",
        default=DEFAULT_WORLD_ID,
    )


def _registry_id() -> str:
    return _config_value(
        "EDITOR_CHUNK_SERVICE_REGISTRY_ID",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_REGISTRY_ID",
        default=DEFAULT_REGISTRY_ID,
    )


def _registry_version() -> str:
    return _config_value(
        "EDITOR_CHUNK_SERVICE_REGISTRY_VERSION",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_REGISTRY_VERSION",
        default=DEFAULT_REGISTRY_VERSION,
    )


def _max_batch_chunks() -> int:
    return _config_int(
        "EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
        "EDITOR_CHUNK_MAX_BATCH_CHUNKS",
        default=256,
        minimum=1,
        maximum=10000,
    )


def _chunk_proxy_config_summary() -> dict[str, Any]:
    internal_base_url = _config_value(
        "EDITOR_CHUNK_SERVICE_BASE_URL",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_BASE_URL",
        "EDITOR_CHUNK_SERVICE_INTERNAL_URL",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_INTERNAL_URL",
        "VECTOPLAN_CHUNK_SERVICE_INTERNAL_URL",
        default="http://vectoplan-chunk:5000",
    )

    browser_base_url = _config_value(
        "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
        "EDITOR_CHUNK_BROWSER_BASE_URL",
        "VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL",
        default=CHUNK_PROXY_PREFIX,
    )

    return {
        "enabled": _chunk_service_enabled(),
        "internalBaseUrl": internal_base_url,
        "browserBaseUrl": browser_base_url,
        "browserPrefix": CHUNK_PROXY_PREFIX,
        "defaultProjectId": _default_project_id(),
        "defaultWorldId": _default_world_id(),
        "sourceKind": _config_value(
            "EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            default="vectoplan-chunk",
        ),
        "mode": _config_value(
            "EDITOR_CHUNK_SERVICE_MODE",
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_MODE",
            default="editor-proxy",
        ),
        "registryId": _registry_id(),
        "registryVersion": _registry_version(),
        "timeouts": {
            "requestMs": _config_int(
                "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
                default=10000,
                minimum=100,
                maximum=300000,
            ),
            "commandMs": _config_int(
                "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
                default=15000,
                minimum=100,
                maximum=300000,
            ),
            "batchMs": _config_int(
                "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
                default=20000,
                minimum=100,
                maximum=300000,
            ),
            "statusMs": _config_int(
                "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
                default=5000,
                minimum=100,
                maximum=300000,
            ),
        },
        "preferBatchLoad": _config_bool(
            "EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            default=True,
        ),
        "reloadDirtyChunksAfterCommand": _config_bool(
            "EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            default=True,
        ),
        "maxBatchChunks": _max_batch_chunks(),
        "placeableBlocksPlaceholderEnabled": _placeable_blocks_placeholder_enabled(),
    }


def _configured_placeable_blocks() -> list[dict[str, Any]]:
    try:
        blocks = current_app.config.get("EDITOR_PLACEABLE_BLOCKS")
    except Exception:
        blocks = None

    if isinstance(blocks, list):
        normalized: list[dict[str, Any]] = []

        for item in blocks:
            if not isinstance(item, Mapping):
                continue

            block_type_id = str(item.get("blockTypeId") or "").strip()
            if not block_type_id:
                continue

            block = dict(item)
            block["blockTypeId"] = block_type_id
            block.setdefault("label", block_type_id)
            block.setdefault("solid", True)
            block.setdefault("placeable", True)
            block.setdefault("breakable", True)

            normalized.append(_json_safe(block))

        if normalized:
            return normalized

    raw_env = os.environ.get("VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_JSON")
    if raw_env:
        try:
            parsed = json.loads(raw_env)
            if isinstance(parsed, list):
                return [_json_safe(dict(item)) for item in parsed if isinstance(item, Mapping)]
        except Exception:
            LOGGER.warning("Could not parse VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_JSON.")

    return [dict(block) for block in DEFAULT_PLACEABLE_BLOCKS]


def _config_value(*keys: str, default: str) -> str:
    for key in keys:
        try:
            value = current_app.config.get(key)
            if value not in {None, ""}:
                return str(value)
        except Exception:
            pass

    for key in keys:
        try:
            value = os.environ.get(key)
            if value not in {None, ""}:
                return str(value)
        except Exception:
            pass

    return default


def _config_bool(*keys: str, default: bool) -> bool:
    for key in keys:
        try:
            value = current_app.config.get(key)
            parsed = _parse_bool(value)
            if parsed is not None:
                return parsed
        except Exception:
            pass

    for key in keys:
        try:
            value = os.environ.get(key)
            parsed = _parse_bool(value)
            if parsed is not None:
                return parsed
        except Exception:
            pass

    return default


def _config_int(
    *keys: str,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    for key in keys:
        try:
            value = current_app.config.get(key)
            if value not in {None, ""}:
                return _bounded_int(value, default=default, minimum=minimum, maximum=maximum)
        except Exception:
            pass

    for key in keys:
        try:
            value = os.environ.get(key)
            if value not in {None, ""}:
                return _bounded_int(value, default=default, minimum=minimum, maximum=maximum)
        except Exception:
            pass

    return _bounded_int(default, default=default, minimum=minimum, maximum=maximum)


def _bounded_int(
    value: Any,
    *,
    default: int,
    minimum: int | None,
    maximum: int | None,
) -> int:
    try:
        parsed = int(value)
    except Exception:
        parsed = default

    if minimum is not None:
        parsed = max(minimum, parsed)

    if maximum is not None:
        parsed = min(maximum, parsed)

    return parsed


# =============================================================================
# Metadata / Route-Hints
# =============================================================================

def _default_route_hints(project_id: str, world_id: str) -> dict[str, str]:
    base = CHUNK_PROXY_PREFIX
    project_base = f"{base}/projects/{project_id}"
    world_base = f"{project_base}/worlds/{world_id}"

    return {
        "apiBaseUrl": base,
        "status": f"{base}/_status",
        "testConnection": f"{base}/_test/connection",
        "placeableBlocks": f"{base}/placeable-blocks",
        "projects": f"{base}/projects",
        "project": project_base,
        "projectBootstrap": f"{project_base}/bootstrap",
        "worlds": f"{project_base}/worlds",
        "world": world_base,
        "blocks": f"{world_base}/blocks",
        "chunk": f"{world_base}/chunks",
        "chunks": f"{world_base}/chunks",
        "chunksBatch": f"{world_base}/chunks/batch",
        "commands": f"{world_base}/commands",
    }


def _supported_routes() -> dict[str, list[str]]:
    return {
        "diagnostics": [
            "GET /editor/api/chunk/_status",
            "GET /editor/api/chunk/_test/connection",
        ],
        "placeableBlocks": [
            "GET /editor/api/chunk/placeable-blocks",
        ],
        "projects": [
            "GET /editor/api/chunk/projects",
            "POST /editor/api/chunk/projects",
            "GET /editor/api/chunk/projects/<projectId>",
            "DELETE /editor/api/chunk/projects/<projectId>",
            "GET /editor/api/chunk/projects/<projectId>/bootstrap",
        ],
        "worlds": [
            "GET /editor/api/chunk/projects/<projectId>/worlds",
            "POST /editor/api/chunk/projects/<projectId>/worlds",
            "GET /editor/api/chunk/projects/<projectId>/worlds/<worldId>",
            "DELETE /editor/api/chunk/projects/<projectId>/worlds/<worldId>",
        ],
        "blocks": [
            "GET /editor/api/chunk/projects/<projectId>/worlds/<worldId>/blocks",
            "GET /editor/api/chunk/blocks",
        ],
        "chunks": [
            "GET /editor/api/chunk/projects/<projectId>/worlds/<worldId>/chunks",
            "POST /editor/api/chunk/projects/<projectId>/worlds/<worldId>/chunks/batch",
            "GET /editor/api/chunk/chunks",
            "POST /editor/api/chunk/chunks/batch",
        ],
        "commands": [
            "POST /editor/api/chunk/projects/<projectId>/worlds/<worldId>/commands",
            "POST /editor/api/chunk/commands",
        ],
    }


# =============================================================================
# Payload-Helfer
# =============================================================================

def _error_payload(
    *,
    code: str,
    message: str,
    details: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "code": code,
        "message": message,
    }

    if details:
        payload["details"] = _json_safe(dict(details))

    return payload


def _error_to_dict(error: Any) -> dict[str, Any]:
    if hasattr(error, "to_dict"):
        try:
            payload = error.to_dict()
            if isinstance(payload, Mapping):
                return _json_safe(dict(payload))
        except Exception:
            pass

    if isinstance(error, Mapping):
        return _json_safe(dict(error))

    return _error_payload(
        code=getattr(error, "code", "chunk_proxy_error"),
        message=getattr(error, "message", str(error)),
        details={
            "exceptionType": type(error).__name__,
        },
    )


def _payload_preview(payload: Any) -> Any:
    if isinstance(payload, Mapping):
        preview: dict[str, Any] = {}

        for key in (
            "ok",
            "service",
            "route",
            "moduleVersion",
            "version",
            "status",
            "source",
            "projectId",
            "worldId",
            "chunkKey",
        ):
            if key in payload:
                preview[key] = _json_safe(payload[key])

        if "counts" in payload:
            preview["counts"] = _json_safe(payload.get("counts"))

        if "route" in payload and isinstance(payload.get("route"), Mapping):
            preview["route"] = _json_safe(payload.get("route"))

        if "chunk" in payload and isinstance(payload.get("chunk"), Mapping):
            chunk = payload.get("chunk") or {}
            preview["chunk"] = {
                "chunkKey": chunk.get("chunkKey"),
                "cellCount": len(chunk.get("cells") or []) if isinstance(chunk.get("cells"), list) else None,
                "paletteSize": len(chunk.get("palette") or []) if isinstance(chunk.get("palette"), list) else None,
            }

        return preview or _json_safe(payload)

    return _json_safe(payload)


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


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000.0, 3)


__all__ = [
    "CHUNK_PROXY_PREFIX",
    "CHUNK_ROUTE_MODULE_VERSION",
    "chunk_bp",
]
