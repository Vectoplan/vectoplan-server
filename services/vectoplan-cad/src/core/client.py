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
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise CoreClientError(f"Core request failed: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("ok") is False:
        raise CoreClientError(str(payload.get("message") or payload.get("error") or "Core rejected request"))
    return payload


def project_chunks_to_projection(config: Mapping[str, Any], core_project_id: str, body: Mapping[str, Any]) -> dict[str, Any]:
    project_id = urllib.parse.quote(core_project_id, safe="")
    return _request(
        base_url=str(config.get("CORE_INTERNAL_URL") or ""),
        path=f"/api/v1/projects/{project_id}/projections/chunk-to-2d",
        method="POST",
        api_key=str(config.get("CORE_SERVICE_API_KEY") or ""),
        timeout=int(config.get("CORE_TIMEOUT_SECONDS") or 30),
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
        timeout=int(config.get("CORE_TIMEOUT_SECONDS") or 30),
    )

