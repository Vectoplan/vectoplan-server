from __future__ import annotations

import json
import logging
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen  # nosec B310 - fixed configured service URL

from flask import Blueprint, Response, current_app, jsonify, request


LOGGER = logging.getLogger(__name__)

CAD_PROXY_PREFIX = "/editor/api/cad"
CAD_ROOF_CALCULATION_PATH = "/api/v1/cad/automation/roof/calculate"
MAX_REQUEST_BYTES = 2 * 1024 * 1024
MAX_RESPONSE_BYTES = 20 * 1024 * 1024

cad_bp = Blueprint("editor_cad", __name__, url_prefix=CAD_PROXY_PREFIX)


def _upstream_url() -> str:
    base_url = str(
        current_app.config.get(
            "VECTOPLAN_EDITOR_CAD_SERVICE_INTERNAL_URL",
            "http://vectoplan-cad:5000",
        )
        or ""
    ).strip()
    parsed = urlsplit(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("CAD service URL is invalid.")
    return urljoin(base_url.rstrip("/") + "/", CAD_ROOF_CALCULATION_PATH.lstrip("/"))


def _timeout_seconds() -> float:
    try:
        return max(
            1.0,
            min(
                120.0,
                float(current_app.config.get("VECTOPLAN_EDITOR_CAD_AUTOMATION_TIMEOUT_SECONDS", 30.0)),
            ),
        )
    except (TypeError, ValueError):
        return 30.0


def _read_limited(response: Any) -> bytes:
    payload = response.read(MAX_RESPONSE_BYTES + 1)
    if len(payload) > MAX_RESPONSE_BYTES:
        raise ValueError("CAD response exceeds the configured size limit.")
    return payload


def _proxy_response(payload: bytes, status: int, content_type: str | None) -> Response:
    return Response(payload, status=status, content_type=content_type or "application/json")


@cad_bp.post("/automation/roof/calculate")
def calculate_roof() -> Response:
    raw_body = request.get_data(cache=True)
    if len(raw_body) > MAX_REQUEST_BYTES:
        return jsonify({
            "ok": False,
            "error": "roof_calculation_request_too_large",
            "message": "The roof calculation request is too large.",
        }), 413

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({
            "ok": False,
            "error": "invalid_roof_calculation_request",
            "message": "A JSON object is required.",
        }), 400

    try:
        upstream_request = Request(
            _upstream_url(),
            data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "vectoplan-editor-cad-proxy/0.1",
            },
            method="POST",
        )
        with urlopen(upstream_request, timeout=_timeout_seconds()) as upstream:  # nosec B310
            return _proxy_response(
                _read_limited(upstream),
                int(getattr(upstream, "status", 200)),
                upstream.headers.get("Content-Type"),
            )
    except HTTPError as exc:
        try:
            return _proxy_response(
                _read_limited(exc),
                int(exc.code),
                exc.headers.get("Content-Type") if exc.headers else None,
            )
        except Exception:
            LOGGER.exception("Could not relay CAD roof validation response.")
    except (URLError, TimeoutError, ValueError, OSError):
        LOGGER.exception("CAD roof calculation proxy failed.")
    except Exception:
        LOGGER.exception("Unexpected CAD roof calculation proxy failure.")

    return jsonify({
        "ok": False,
        "error": "cad_roof_calculation_unavailable",
        "message": "The CAD roof calculation service is unavailable.",
    }), 502
