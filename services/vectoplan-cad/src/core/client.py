from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from typing import Any


class CoreClientError(RuntimeError):
    pass


def _request(
    *, base_url: str, path: str, method: str, api_key: str, timeout: int, body: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    if not base_url:
        raise CoreClientError("vectoplan-core is not configured")
    headers = {
        "Accept": "application/json",
        "User-Agent": "vectoplan-cad/core-client",
        "X-Service-ID": "vectoplan-cad",
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(dict(body)).encode("utf-8")
    if api_key:
        headers["X-Service-API-Key"] = api_key
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(base_url.rstrip("/") + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        message = f"Core returned HTTP {exc.code}"
        try:
            error_payload = json.loads(exc.read().decode("utf-8"))
            error = error_payload.get("error") if isinstance(error_payload, Mapping) else None
            if isinstance(error, Mapping):
                message = str(error.get("message") or error.get("code") or message)
            elif isinstance(error_payload, Mapping) and error_payload.get("message"):
                message = str(error_payload["message"])
            elif error:
                message = str(error)
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            pass
        raise CoreClientError(message) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise CoreClientError(f"Core request failed: {exc}") from exc
    if not isinstance(payload, dict):
        raise CoreClientError("Core returned an invalid response")
    if payload.get("ok") is False:
        error = payload.get("error")
        nested_message = error.get("message") if isinstance(error, Mapping) else None
        raise CoreClientError(str(payload.get("message") or nested_message or error or "Core rejected request"))
    return payload


def project_chunks_to_projection(config: Mapping[str, Any], core_project_id: str, body: Mapping[str, Any]) -> dict[str, Any]:
    project_id = urllib.parse.quote(core_project_id, safe="")
    return _request(
        base_url=str(config.get("CORE_INTERNAL_URL") or ""),
        path=f"/api/v1/projects/{project_id}/projections/chunk-to-2d",
        method="POST",
        api_key=str(config.get("CORE_SERVICE_API_KEY") or ""),
        timeout=int(config.get("CORE_TIMEOUT_SECONDS") or 45),
        body=body,
    )


def get_import_projection(
    config: Mapping[str, Any], core_project_id: str, document_id: str
) -> dict[str, Any]:
    project_id = urllib.parse.quote(core_project_id, safe="")
    encoded_document = urllib.parse.quote(document_id, safe="")
    return _request(
        base_url=str(config.get("CORE_INTERNAL_URL") or ""),
        path=f"/api/v1/projects/{project_id}/imports/{encoded_document}/projection",
        method="GET",
        api_key=str(config.get("CORE_SERVICE_API_KEY") or ""),
        timeout=int(config.get("CORE_TIMEOUT_SECONDS") or 45),
    )


def dispatch_cad_command(
    config: Mapping[str, Any], core_project_id: str, command: Mapping[str, Any]
) -> dict[str, Any]:
    project_id = urllib.parse.quote(core_project_id, safe="")
    return _request(
        base_url=str(config.get("CORE_INTERNAL_URL") or ""),
        path=f"/api/v1/projects/{project_id}/commands/cad",
        method="POST",
        api_key=str(config.get("CORE_SERVICE_API_KEY") or ""),
        timeout=int(config.get("CORE_TIMEOUT_SECONDS") or 45),
        body={"command": dict(command)},
    )
