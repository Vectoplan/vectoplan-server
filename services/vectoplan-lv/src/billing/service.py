"""Persistence for combined Aufmaß and Abrechnung entries."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Mapping

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import BillingEntry, LvDocument, LvItem, LvVersion
from src.billing.calculation import evaluate_calculation_rows
from src.domain.attachments import normalize_attachment_manifest
from src.domain.identifiers import new_public_id
from src.items.service import get_item, parse_decimal
from src.lvs.errors import LvConflictError, LvNotFoundError, LvValidationError
from src.lvs.service import get_lv_document


def _required_invoice_number(payload: Mapping[str, Any]) -> str:
    value = str(payload.get("invoice_number") or "").strip()
    if not value:
        raise LvValidationError("invoice_number is required")
    if len(value) > 80:
        raise LvValidationError("invoice_number must not exceed 80 characters")
    return value


def _notes(payload: Mapping[str, Any]) -> str | None:
    value = str(payload.get("notes") or "").strip()
    if len(value) > 50_000:
        raise LvValidationError("notes must not exceed 50000 characters")
    return value or None


def list_item_billings(
    project_public_id: str,
    item_id: str,
) -> list[BillingEntry]:
    item = get_item(project_public_id, item_id)
    statement = (
        select(BillingEntry)
        .where(BillingEntry.lv_item_id == item.id)
        .order_by(BillingEntry.updated_at.desc(), BillingEntry.id.desc())
    )
    return list(db.session.scalars(statement).unique())


def list_lv_billings(
    project_public_id: str,
    lv_id: str,
) -> list[BillingEntry]:
    document = get_lv_document(project_public_id, lv_id)
    statement = (
        select(BillingEntry)
        .where(
            BillingEntry.project_public_id == project_public_id,
            BillingEntry.lv_document_id == document.id,
        )
        .order_by(
            BillingEntry.invoice_number.asc(),
            BillingEntry.updated_at.desc(),
        )
    )
    return list(db.session.scalars(statement).unique())


def _entry_by_public_id(
    project_public_id: str,
    entry_id: str,
) -> BillingEntry:
    statement = select(BillingEntry).where(
        BillingEntry.project_public_id == project_public_id,
        BillingEntry.public_id == entry_id,
    )
    entry = db.session.scalar(statement)
    if entry is None:
        raise LvNotFoundError("billing entry not found")
    return entry


def save_item_billing(
    project_public_id: str,
    item_id: str,
    payload: Mapping[str, Any],
) -> tuple[BillingEntry, bool]:
    item = get_item(project_public_id, item_id)
    if item.item_type != "position":
        raise LvValidationError("only positions can be billed")
    if not item.version.is_mutable:
        raise LvConflictError("released LV positions cannot be billed")

    invoice_number = _required_invoice_number(payload)
    requested_id = str(payload.get("public_id") or "").strip()
    entry: BillingEntry | None = None
    if requested_id:
        entry = _entry_by_public_id(project_public_id, requested_id)
        if entry.lv_item_id != item.id:
            raise LvConflictError("billing entry belongs to a different LV item")
    else:
        entry = db.session.scalar(
            select(BillingEntry).where(
                BillingEntry.lv_item_id == item.id,
                BillingEntry.invoice_number == invoice_number,
            )
        )

    created = entry is None
    if entry is None:
        version = item.version
        document = db.session.get(LvDocument, version.lv_document_id)
        if document is None:
            raise LvNotFoundError("LV not found")
        entry = BillingEntry(
            public_id=new_public_id("bill"),
            project_public_id=project_public_id,
            lv_document_id=document.id,
            lv_version_id=version.id,
            lv_item_id=item.id,
            invoice_number=invoice_number,
        )
        db.session.add(entry)
    else:
        entry.invoice_number = invoice_number
        entry.revision += 1

    if "calculation_rows" in payload:
        rows, total = evaluate_calculation_rows(payload.get("calculation_rows"))
        if total < 0:
            raise LvValidationError("the sum of calculation rows must not be negative")
        entry.calculation_rows = rows
        has_calculations = any(row["expression"] for row in rows)
        entry.calculation_total = total if has_calculations else None
        if has_calculations:
            entry.billed_quantity = total
        elif "billed_quantity" in payload:
            entry.billed_quantity = parse_decimal(
                payload.get("billed_quantity"),
                "billed_quantity",
                minimum=Decimal("0"),
            )
    elif "billed_quantity" in payload:
        entry.billed_quantity = parse_decimal(
            payload.get("billed_quantity"),
            "billed_quantity",
            minimum=Decimal("0"),
        )
    if "notes" in payload:
        entry.notes = _notes(payload)
    if "attachments" in payload:
        entry.attachment_manifest = normalize_attachment_manifest(
            payload.get("attachments")
        )

    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise LvConflictError(
            "this position is already assigned to the invoice number"
        ) from exc
    except Exception:
        db.session.rollback()
        raise
    return entry, created


__all__ = [
    "list_item_billings",
    "list_lv_billings",
    "save_item_billing",
]
