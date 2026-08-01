"""HTTP adapter for supplier inquiries and offers."""

from __future__ import annotations

from flask import Blueprint, jsonify, request, url_for

from routes.context import (
    resolve_actor_user_id,
    resolve_project_public_id,
)
from src.lvs.errors import LvValidationError
from src.procurement.company_directory import NullCompanyDirectory
from src.procurement.serialization import serialize_inquiry, serialize_offer
from src.procurement.service import (
    create_inquiry,
    get_inquiry,
    list_inquiries,
    position_snapshots_for_suggestions,
    record_response,
    update_delivery_status,
    update_offer_assessment,
)


procurement_bp = Blueprint("procurement", __name__, url_prefix="/v1")


def _json_object() -> dict:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise LvValidationError("request body must be a JSON object")
    return payload


@procurement_bp.get("/lvs/<string:lv_id>/inquiries")
def list_lv_inquiries(lv_id: str):
    project_public_id = resolve_project_public_id()
    inquiries = list_inquiries(project_public_id, lv_id)
    return jsonify(
        {
            "items": [serialize_inquiry(item) for item in inquiries],
            "count": len(inquiries),
        }
    )


@procurement_bp.post("/lvs/<string:lv_id>/inquiries")
def create_lv_inquiry(lv_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    inquiry = create_inquiry(
        project_public_id,
        lv_id,
        payload,
        actor_user_id=resolve_actor_user_id(),
    )
    response = jsonify(serialize_inquiry(inquiry))
    response.status_code = 201
    response.headers["Location"] = url_for(
        "procurement.get_procurement_inquiry",
        inquiry_id=inquiry.public_id,
    )
    return response


@procurement_bp.get("/inquiries/<string:inquiry_id>")
def get_procurement_inquiry(inquiry_id: str):
    project_public_id = resolve_project_public_id()
    return jsonify(serialize_inquiry(get_inquiry(project_public_id, inquiry_id)))


@procurement_bp.post("/inquiries/<string:inquiry_id>/responses")
def create_procurement_response(inquiry_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    inquiry, offer = record_response(
        project_public_id,
        inquiry_id,
        payload,
    )
    return (
        jsonify(
            {
                "inquiry": serialize_inquiry(inquiry),
                "offer": serialize_offer(offer) if offer else None,
            }
        ),
        201,
    )


@procurement_bp.patch(
    "/inquiries/<string:inquiry_id>/recipients/<string:recipient_id>/delivery"
)
def patch_procurement_delivery(inquiry_id: str, recipient_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    inquiry = update_delivery_status(
        project_public_id,
        inquiry_id,
        recipient_id,
        payload,
    )
    return jsonify(serialize_inquiry(inquiry))


@procurement_bp.patch("/offers/<string:offer_id>/assessment")
def patch_offer_assessment(offer_id: str):
    payload = _json_object()
    project_public_id = resolve_project_public_id(payload)
    return jsonify(
        serialize_offer(
            update_offer_assessment(project_public_id, offer_id, payload)
        )
    )


@procurement_bp.get("/lvs/<string:lv_id>/recipient-suggestions")
def get_recipient_suggestions(lv_id: str):
    project_public_id = resolve_project_public_id()
    raw_ids = [
        value.strip()
        for value in request.args.getlist("item_public_id")
        if value.strip()
    ]
    positions = position_snapshots_for_suggestions(
        project_public_id,
        lv_id,
        raw_ids,
    )
    provider = NullCompanyDirectory()
    suggestions = provider.suggest(
        project_public_id=project_public_id,
        positions=positions,
    )
    return jsonify(
        {
            "items": suggestions,
            "count": len(suggestions),
            "provider": provider.provider_name,
            "automation_ready": True,
        }
    )


__all__ = ["procurement_bp"]
