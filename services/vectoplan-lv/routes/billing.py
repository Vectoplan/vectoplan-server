"""HTTP adapter for combined Aufmaß and Abrechnung."""

from __future__ import annotations

from flask import Blueprint, jsonify, request, url_for

from routes.context import resolve_project_public_id
from src.billing.serialization import serialize_billing_entry
from src.billing.service import (
    list_item_billings,
    list_lv_billings,
    save_item_billing,
)
from src.lvs.errors import LvValidationError


billing_bp = Blueprint("billing", __name__, url_prefix="/v1")


def _json_object() -> dict:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise LvValidationError("request body must be a JSON object")
    return payload


@billing_bp.get("/lvs/<string:lv_id>/billings")
def list_billings_for_lv(lv_id: str):
    project_public_id = resolve_project_public_id()
    entries = list_lv_billings(project_public_id, lv_id)
    return jsonify(
        {
            "items": [serialize_billing_entry(entry) for entry in entries],
            "count": len(entries),
            "attachments_placeholder": True,
        }
    )


@billing_bp.get("/items/<string:item_id>/billings")
def list_billings_for_item(item_id: str):
    project_public_id = resolve_project_public_id()
    entries = list_item_billings(project_public_id, item_id)
    return jsonify(
        {
            "items": [serialize_billing_entry(entry) for entry in entries],
            "count": len(entries),
            "attachments_placeholder": True,
        }
    )


@billing_bp.post("/items/<string:item_id>/billings")
def save_billing_for_item(item_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    entry, created = save_item_billing(project_public_id, item_id, payload)
    response = jsonify(serialize_billing_entry(entry))
    response.status_code = 201 if created else 200
    response.headers["Location"] = url_for(
        "billing.list_billings_for_item",
        item_id=item_id,
    )
    return response


__all__ = ["billing_bp"]
