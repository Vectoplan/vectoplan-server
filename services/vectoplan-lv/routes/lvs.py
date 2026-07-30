"""HTTP adapter for the first LV document use cases."""

from __future__ import annotations

from flask import Blueprint, jsonify, request, url_for

from routes.context import resolve_actor_user_id, resolve_project_public_id
from src.lvs.errors import LvValidationError
from src.lvs.serialization import serialize_document
from src.lvs.service import create_lv_document, get_lv_document, list_lv_documents


lvs_bp = Blueprint("lvs", __name__, url_prefix="/v1/lvs")


def _json_object() -> dict:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise LvValidationError("request body must be a JSON object")
    return payload


@lvs_bp.get("")
def list_lvs():
    project_public_id = resolve_project_public_id()
    documents = list_lv_documents(project_public_id)
    return jsonify(
        {
            "items": [
                serialize_document(document, include_versions=False)
                for document in documents
            ],
            "count": len(documents),
        }
    )


@lvs_bp.post("")
def create_lv():
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    document = create_lv_document(
        project_public_id,
        payload,
        actor_user_id=resolve_actor_user_id(),
    )
    response = jsonify(serialize_document(document, include_versions=True))
    response.status_code = 201
    response.headers["Location"] = url_for(
        "lvs.get_lv", lv_id=document.public_id
    )
    return response


@lvs_bp.get("/<string:lv_id>")
def get_lv(lv_id: str):
    project_public_id = resolve_project_public_id()
    document = get_lv_document(project_public_id, lv_id)
    return jsonify(serialize_document(document, include_versions=True))


__all__ = ["lvs_bp"]
