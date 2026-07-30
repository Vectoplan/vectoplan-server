"""HTTP adapter for editable LV positions and text rows."""

from __future__ import annotations

from flask import Blueprint, jsonify, request, url_for

from routes.context import resolve_project_public_id
from src.items.serialization import serialize_item
from src.items.service import (
    create_item,
    get_item,
    list_items,
    reorder_items,
    update_item,
)
from src.lvs.errors import LvValidationError


items_bp = Blueprint("items", __name__, url_prefix="/v1")


def _json_object() -> dict:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise LvValidationError("request body must be a JSON object")
    return payload


@items_bp.get("/lvs/<string:lv_id>/items")
def list_lv_items(lv_id: str):
    project_public_id = resolve_project_public_id()
    items = list_items(project_public_id, lv_id)
    return jsonify(
        {
            "items": [
                serialize_item(item, include_billings=True) for item in items
            ],
            "count": len(items),
        }
    )


@items_bp.post("/lvs/<string:lv_id>/items")
def create_lv_item(lv_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    item = create_item(project_public_id, lv_id, payload)
    response = jsonify(serialize_item(item, include_billings=True))
    response.status_code = 201
    response.headers["Location"] = url_for(
        "items.get_lv_item",
        item_id=item.public_id,
    )
    return response


@items_bp.post("/lvs/<string:lv_id>/items/reorder")
def reorder_lv_items(lv_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    items = reorder_items(
        project_public_id,
        lv_id,
        payload.get("order"),
    )
    return jsonify(
        {
            "items": [
                serialize_item(item, include_billings=True) for item in items
            ],
            "count": len(items),
        }
    )


@items_bp.get("/items/<string:item_id>")
def get_lv_item(item_id: str):
    project_public_id = resolve_project_public_id()
    return jsonify(
        serialize_item(
            get_item(project_public_id, item_id),
            include_billings=True,
        )
    )


@items_bp.patch("/items/<string:item_id>")
def patch_lv_item(item_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    item = update_item(project_public_id, item_id, payload)
    return jsonify(serialize_item(item, include_billings=True))


__all__ = ["items_bp"]
