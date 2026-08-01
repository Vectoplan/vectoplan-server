"""JSON-safe representations of inquiries and supplier responses."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from models import (
    ProcurementInquiry,
    ProcurementInquiryItem,
    ProcurementOffer,
    ProcurementRecipient,
)


def _decimal(value: Decimal | None, places: int) -> str | None:
    return format(value, f".{places}f") if value is not None else None


def serialize_inquiry_item(item: ProcurementInquiryItem) -> dict[str, Any]:
    return {
        "lv_item_id": item.item_public_id_snapshot,
        "ordinal_number": item.ordinal_number,
        "short_text": item.short_text,
        "long_text": item.long_text,
        "quantity": _decimal(item.quantity, 3),
        "unit": item.unit,
        "sort_order": item.sort_order,
    }


def serialize_offer(offer: ProcurementOffer) -> dict[str, Any]:
    assessment = (
        offer.llm_assessment if isinstance(offer.llm_assessment, dict) else None
    )
    return {
        "public_id": offer.public_id,
        "status": offer.status,
        "total_amount": _decimal(offer.total_amount, 4),
        "currency": offer.currency,
        "delivery_days": offer.delivery_days,
        "valid_until": (
            offer.valid_until.isoformat() if offer.valid_until else None
        ),
        "message": offer.message,
        "line_items": (
            offer.line_items if isinstance(offer.line_items, list) else []
        ),
        "attachments": (
            offer.attachment_manifest
            if isinstance(offer.attachment_manifest, list)
            else []
        ),
        "attachments_placeholder": True,
        "llm_assessment": assessment,
        "llm_assessment_status": "completed" if assessment else "pending",
        "received_at": offer.received_at.isoformat(),
        "revision": offer.revision,
        "created_at": offer.created_at.isoformat(),
        "updated_at": offer.updated_at.isoformat(),
    }


def serialize_recipient(recipient: ProcurementRecipient) -> dict[str, Any]:
    return {
        "public_id": recipient.public_id,
        "external_company_id": recipient.external_company_id,
        "company_name": recipient.company_name,
        "contact_name": recipient.contact_name,
        "contact_email": recipient.contact_email,
        "source": recipient.source,
        "distance_km": _decimal(recipient.distance_km, 2),
        "matched_services": (
            recipient.matched_services
            if isinstance(recipient.matched_services, list)
            else []
        ),
        "match_reasons": (
            recipient.match_reasons
            if isinstance(recipient.match_reasons, list)
            else []
        ),
        "status": recipient.status,
        "queued_at": (
            recipient.queued_at.isoformat() if recipient.queued_at else None
        ),
        "sent_at": recipient.sent_at.isoformat() if recipient.sent_at else None,
        "responded_at": (
            recipient.responded_at.isoformat()
            if recipient.responded_at
            else None
        ),
        "delivery_error": recipient.delivery_error,
        "offer": serialize_offer(recipient.offer) if recipient.offer else None,
    }


def serialize_inquiry(inquiry: ProcurementInquiry) -> dict[str, Any]:
    recipients = [serialize_recipient(item) for item in inquiry.recipients]
    return {
        "public_id": inquiry.public_id,
        "project_public_id": inquiry.project_public_id,
        "lv_document_id": inquiry.document.public_id,
        "lv_version_id": inquiry.version.public_id,
        "title": inquiry.title,
        "message": inquiry.message,
        "status": inquiry.status,
        "due_date": inquiry.due_date.isoformat() if inquiry.due_date else None,
        "items": [serialize_inquiry_item(item) for item in inquiry.items],
        "item_count": len(inquiry.items),
        "recipients": recipients,
        "recipient_count": len(recipients),
        "offer_count": sum(1 for item in recipients if item["offer"]),
        "queued_at": (
            inquiry.queued_at.isoformat() if inquiry.queued_at else None
        ),
        "sent_at": inquiry.sent_at.isoformat() if inquiry.sent_at else None,
        "created_by": inquiry.created_by,
        "revision": inquiry.revision,
        "created_at": inquiry.created_at.isoformat(),
        "updated_at": inquiry.updated_at.isoformat(),
    }


__all__ = [
    "serialize_inquiry",
    "serialize_inquiry_item",
    "serialize_offer",
    "serialize_recipient",
]
