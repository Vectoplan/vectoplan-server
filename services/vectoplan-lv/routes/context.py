"""Project-context adapter shared by API endpoints."""

from __future__ import annotations

import re
from typing import Any, Mapping

from flask import Blueprint, current_app, jsonify, request

from src.lvs.errors import LvValidationError


context_bp = Blueprint("context", __name__)
PROJECT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")
PROJECT_HEADER = "X-Vectoplan-Project-Id"
USER_HEADER = "X-Vectoplan-User-Id"


def resolve_project_public_id(
    payload: Mapping[str, Any] | None = None, *, required: bool = True
) -> str | None:
    header_value = str(request.headers.get(PROJECT_HEADER) or "").strip()
    payload_value = str((payload or {}).get("project_public_id") or "").strip()

    if header_value and payload_value and header_value != payload_value:
        raise LvValidationError(
            "project_public_id does not match the project context header"
        )
    value = header_value or payload_value
    if not value:
        value = "1"
    if not PROJECT_ID_PATTERN.fullmatch(value):
        raise LvValidationError("project_public_id has an invalid format")
    return value


def resolve_actor_user_id() -> str | None:
    value = str(request.headers.get(USER_HEADER) or "").strip()
    return value[:128] or None


@context_bp.get("/v1/context")
def get_context():
    project_public_id = resolve_project_public_id(required=False)
    return jsonify(
        {
            "service": current_app.config["SERVICE_NAME"],
            "version": current_app.config["SERVICE_VERSION"],
            "project_public_id": project_public_id,
            "actor_user_id": resolve_actor_user_id(),
            "project_context_verified": False,
            "capabilities": {
                "lv_core": "ready",
                "versions": "initial",
                "manual_items": "ready",
                "gaeb_3_3": "foundation",
                "measurements_and_billing": "ready",
                "attachments": "metadata_only",
                "integrations": "standalone",
                "library": "not_connected",
                "document_analysis": "not_connected",
                "nextcloud": "not_connected",
            },
        }
    )


__all__ = [
    "PROJECT_HEADER",
    "USER_HEADER",
    "context_bp",
    "resolve_actor_user_id",
    "resolve_project_public_id",
]
