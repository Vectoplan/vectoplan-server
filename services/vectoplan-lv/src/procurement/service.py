"""Application services for the low-effort supplier inquiry workflow."""

from __future__ import annotations

import json
import re
from datetime import date
from decimal import Decimal
from typing import Any, Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import LvItem
from models.procurement import (
    OFFER_STATUSES,
    ProcurementInquiry,
    ProcurementInquiryItem,
    ProcurementOffer,
    ProcurementRecipient,
)
from src.domain.attachments import normalize_attachment_manifest
from src.domain.identifiers import new_public_id
from src.items.service import current_draft_version, parse_decimal
from src.lvs.errors import LvConflictError, LvNotFoundError, LvValidationError
from src.lvs.service import get_lv_document
from models.base import utc_now


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _text(
    payload: Mapping[str, Any],
    field: str,
    *,
    maximum: int,
    required: bool = False,
) -> str | None:
    value = str(payload.get(field) or "").strip()
    if required and not value:
        raise LvValidationError(f"{field} is required")
    if len(value) > maximum:
        raise LvValidationError(
            f"{field} must not exceed {maximum} characters"
        )
    return value or None


def _date(value: Any, field: str) -> date | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value).strip())
    except (TypeError, ValueError):
        raise LvValidationError(f"{field} must be an ISO date") from None


def _integer(
    value: Any,
    field: str,
    *,
    minimum: int = 0,
    maximum: int = 100_000,
) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise LvValidationError(f"{field} must be an integer") from None
    if parsed < minimum or parsed > maximum:
        raise LvValidationError(
            f"{field} must be between {minimum} and {maximum}"
        )
    return parsed


def _string_list(value: Any, field: str, maximum: int = 100) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > maximum:
        raise LvValidationError(f"{field} must be an array")
    result: list[str] = []
    for candidate in value:
        text = str(candidate or "").strip()
        if text and text not in result:
            result.append(text[:250])
    return result


def _selected_positions(
    project_public_id: str,
    lv_id: str,
    raw_item_ids: Any,
) -> tuple[Any, Any, list[LvItem]]:
    document = get_lv_document(project_public_id, lv_id)
    version = current_draft_version(document)
    if not isinstance(raw_item_ids, list):
        raise LvValidationError("item_public_ids must be an array")
    item_ids = [str(value or "").strip() for value in raw_item_ids]
    item_ids = [value for value in item_ids if value]
    if not item_ids:
        raise LvValidationError("select at least one LV position")
    if len(item_ids) > 500:
        raise LvValidationError("an inquiry cannot contain more than 500 positions")
    if len(set(item_ids)) != len(item_ids):
        raise LvValidationError("item_public_ids must not contain duplicates")

    statement = select(LvItem).where(
        LvItem.public_id.in_(item_ids),
        LvItem.lv_version_id == version.id,
        LvItem.deleted_at.is_(None),
    )
    found = list(db.session.scalars(statement).unique())
    found_by_id = {item.public_id: item for item in found}
    if set(found_by_id) != set(item_ids):
        raise LvValidationError(
            "all selected positions must belong to the current LV version"
        )
    positions = [found_by_id[public_id] for public_id in item_ids]
    if any(item.item_type != "position" for item in positions):
        raise LvValidationError("only LV positions can be requested")
    return document, version, positions


def _recipient(candidate: Any) -> ProcurementRecipient:
    if not isinstance(candidate, Mapping):
        raise LvValidationError("each recipient must be an object")
    company_name = _text(
        candidate,
        "company_name",
        maximum=250,
        required=True,
    )
    contact_email = str(candidate.get("contact_email") or "").strip().lower()
    if not contact_email or len(contact_email) > 320:
        raise LvValidationError("each recipient needs a valid contact_email")
    if not EMAIL_PATTERN.fullmatch(contact_email):
        raise LvValidationError("each recipient needs a valid contact_email")
    source = str(candidate.get("source") or "manual").strip().lower()
    if source not in {"manual", "directory", "suggestion", "import"}:
        raise LvValidationError("recipient source is not supported")
    return ProcurementRecipient(
        public_id=new_public_id("rcpt"),
        external_company_id=_text(
            candidate,
            "external_company_id",
            maximum=128,
        ),
        company_name=company_name,
        contact_name=_text(candidate, "contact_name", maximum=250),
        contact_email=contact_email,
        source=source,
        distance_km=parse_decimal(
            candidate.get("distance_km"),
            "distance_km",
            minimum=Decimal("0"),
        ),
        matched_services=_string_list(
            candidate.get("matched_services"),
            "matched_services",
        ),
        match_reasons=_string_list(
            candidate.get("match_reasons"),
            "match_reasons",
        ),
        status="queued",
        queued_at=utc_now(),
    )


def create_inquiry(
    project_public_id: str,
    lv_id: str,
    payload: Mapping[str, Any],
    *,
    actor_user_id: str | None = None,
) -> ProcurementInquiry:
    document, version, positions = _selected_positions(
        project_public_id,
        lv_id,
        payload.get("item_public_ids"),
    )
    raw_recipients = payload.get("recipients")
    if raw_recipients is None:
        raw_recipients = []
    if not isinstance(raw_recipients, list) or len(raw_recipients) > 100:
        raise LvValidationError("recipients must be an array")
    recipients = [_recipient(candidate) for candidate in raw_recipients]
    emails = [recipient.contact_email for recipient in recipients]
    if len(emails) != len(set(emails)):
        raise LvValidationError("a recipient email can only be used once")

    queue_for_delivery = bool(payload.get("queue_for_delivery", False))
    if queue_for_delivery and not recipients:
        raise LvValidationError(
            "at least one recipient is required for delivery"
        )
    fallback_title = (
        f"Preisanfrage · {positions[0].short_text or positions[0].ordinal_number}"
        if len(positions) == 1
        else f"Preisanfrage · {len(positions)} LV-Positionen"
    )
    title = _text(payload, "title", maximum=250) or fallback_title
    now = utc_now()
    inquiry = ProcurementInquiry(
        public_id=new_public_id("inq"),
        project_public_id=project_public_id,
        lv_document_id=document.id,
        lv_version_id=version.id,
        title=title,
        message=_text(payload, "message", maximum=50_000),
        status="queued" if queue_for_delivery else "draft",
        due_date=_date(payload.get("due_date"), "due_date"),
        created_by=actor_user_id,
        queued_at=now if queue_for_delivery else None,
    )
    for item in positions:
        inquiry.items.append(
            ProcurementInquiryItem(
                lv_item_id=item.id,
                item_public_id_snapshot=item.public_id,
                ordinal_number=item.ordinal_number,
                short_text=item.short_text,
                long_text=item.long_text,
                quantity=item.quantity,
                unit=item.unit,
                sort_order=item.sort_order,
            )
        )
    inquiry.recipients.extend(recipients)
    db.session.add(inquiry)
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise LvConflictError("the inquiry recipients are not unique") from exc
    except Exception:
        db.session.rollback()
        raise
    return inquiry


def list_inquiries(
    project_public_id: str,
    lv_id: str,
) -> list[ProcurementInquiry]:
    document = get_lv_document(project_public_id, lv_id)
    statement = (
        select(ProcurementInquiry)
        .where(
            ProcurementInquiry.project_public_id == project_public_id,
            ProcurementInquiry.lv_document_id == document.id,
        )
        .order_by(
            ProcurementInquiry.created_at.desc(),
            ProcurementInquiry.id.desc(),
        )
    )
    return list(db.session.scalars(statement).unique())


def get_inquiry(
    project_public_id: str,
    inquiry_id: str,
) -> ProcurementInquiry:
    statement = select(ProcurementInquiry).where(
        ProcurementInquiry.project_public_id == project_public_id,
        ProcurementInquiry.public_id == inquiry_id,
    )
    inquiry = db.session.scalar(statement)
    if inquiry is None:
        raise LvNotFoundError("inquiry not found")
    return inquiry


def _recipient_for_inquiry(
    inquiry: ProcurementInquiry,
    recipient_id: Any,
) -> ProcurementRecipient:
    public_id = str(recipient_id or "").strip()
    recipient = next(
        (item for item in inquiry.recipients if item.public_id == public_id),
        None,
    )
    if recipient is None:
        raise LvValidationError("recipient does not belong to the inquiry")
    return recipient


def record_response(
    project_public_id: str,
    inquiry_id: str,
    payload: Mapping[str, Any],
) -> tuple[ProcurementInquiry, ProcurementOffer | None]:
    inquiry = get_inquiry(project_public_id, inquiry_id)
    if inquiry.status in {"completed", "cancelled"}:
        raise LvConflictError("the inquiry no longer accepts responses")
    recipient = _recipient_for_inquiry(
        inquiry,
        payload.get("recipient_public_id"),
    )
    response_type = str(payload.get("response_type") or "offer").strip().lower()
    if response_type not in {"offer", "declined"}:
        raise LvValidationError("response_type must be offer or declined")
    now = utc_now()
    recipient.responded_at = now
    recipient.delivery_error = None

    if response_type == "declined":
        recipient.status = "declined"
        if recipient.offer is not None:
            db.session.delete(recipient.offer)
        offer = None
    else:
        recipient.status = "responded"
        offer = recipient.offer
        created = offer is None
        if offer is None:
            offer = ProcurementOffer(
                public_id=new_public_id("offer"),
                inquiry=inquiry,
                recipient=recipient,
                received_at=now,
            )
            db.session.add(offer)
        else:
            offer.revision += 1
            offer.received_at = now
        status = str(payload.get("status") or "received").strip().lower()
        if status not in OFFER_STATUSES:
            raise LvValidationError("offer status is not supported")
        offer.status = status
        offer.total_amount = parse_decimal(
            payload.get("total_amount"),
            "total_amount",
            minimum=Decimal("0"),
        )
        offer.currency = (
            str(payload.get("currency") or inquiry.document.currency or "EUR")
            .strip()
            .upper()
        )
        if len(offer.currency) != 3:
            raise LvValidationError("currency must contain three letters")
        offer.delivery_days = _integer(
            payload.get("delivery_days"),
            "delivery_days",
        )
        offer.valid_until = _date(payload.get("valid_until"), "valid_until")
        offer.message = _text(payload, "message", maximum=50_000)
        line_items = payload.get("line_items")
        if line_items is None:
            line_items = []
        if not isinstance(line_items, list) or len(line_items) > 500:
            raise LvValidationError("line_items must be an array")
        offer.line_items = line_items
        offer.attachment_manifest = normalize_attachment_manifest(
            payload.get("attachments")
        )
        if created:
            offer.llm_assessment = None

    inquiry.status = "offers_received"
    inquiry.revision += 1
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return inquiry, offer


def update_delivery_status(
    project_public_id: str,
    inquiry_id: str,
    recipient_id: str,
    payload: Mapping[str, Any],
) -> ProcurementInquiry:
    inquiry = get_inquiry(project_public_id, inquiry_id)
    recipient = _recipient_for_inquiry(inquiry, recipient_id)
    status = str(payload.get("status") or "").strip().lower()
    if status not in {"sent", "failed"}:
        raise LvValidationError("delivery status must be sent or failed")
    recipient.status = status
    recipient.delivery_error = (
        _text(payload, "delivery_error", maximum=10_000)
        if status == "failed"
        else None
    )
    if status == "sent":
        recipient.sent_at = utc_now()
    delivered_states = {"sent", "responded", "declined"}
    if all(item.status in delivered_states for item in inquiry.recipients):
        inquiry.status = "sent"
        inquiry.sent_at = max(
            (item.sent_at or item.responded_at or utc_now())
            for item in inquiry.recipients
        )
    inquiry.revision += 1
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return inquiry


def update_offer_assessment(
    project_public_id: str,
    offer_id: str,
    payload: Mapping[str, Any],
) -> ProcurementOffer:
    statement = (
        select(ProcurementOffer)
        .join(
            ProcurementInquiry,
            ProcurementOffer.inquiry_id == ProcurementInquiry.id,
        )
        .where(
            ProcurementInquiry.project_public_id == project_public_id,
            ProcurementOffer.public_id == offer_id,
        )
    )
    offer = db.session.scalar(statement)
    if offer is None:
        raise LvNotFoundError("offer not found")
    assessment = payload.get("llm_assessment", payload)
    if not isinstance(assessment, Mapping):
        raise LvValidationError("llm_assessment must be an object")
    normalized = dict(assessment)
    try:
        encoded = json.dumps(normalized, ensure_ascii=False)
    except (TypeError, ValueError):
        raise LvValidationError("llm_assessment must be JSON serializable") from None
    if len(encoded) > 100_000:
        raise LvValidationError("llm_assessment is too large")
    offer.llm_assessment = normalized
    offer.revision += 1
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return offer


def position_snapshots_for_suggestions(
    project_public_id: str,
    lv_id: str,
    item_public_ids: Sequence[str],
) -> list[dict[str, Any]]:
    _, _, positions = _selected_positions(
        project_public_id,
        lv_id,
        list(item_public_ids),
    )
    return [
        {
            "public_id": item.public_id,
            "ordinal_number": item.ordinal_number,
            "short_text": item.short_text,
            "long_text": item.long_text,
            "quantity": str(item.quantity) if item.quantity is not None else None,
            "unit": item.unit,
        }
        for item in positions
    ]


__all__ = [
    "create_inquiry",
    "get_inquiry",
    "list_inquiries",
    "position_snapshots_for_suggestions",
    "record_response",
    "update_delivery_status",
    "update_offer_assessment",
]
