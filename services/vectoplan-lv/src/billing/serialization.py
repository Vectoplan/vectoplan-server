"""JSON-safe measurement and billing representations."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from models import BillingEntry


def _decimal(value: Decimal | None, places: int) -> str | None:
    return format(value, f".{places}f") if value is not None else None


def serialize_billing_entry(entry: BillingEntry) -> dict[str, Any]:
    line_total = None
    if entry.billed_quantity is not None and entry.item.unit_price is not None:
        line_total = Decimal(entry.billed_quantity) * Decimal(entry.item.unit_price)
    attachments = entry.attachment_manifest
    if not isinstance(attachments, list):
        attachments = []
    calculation_rows = entry.calculation_rows
    if not isinstance(calculation_rows, list):
        calculation_rows = []
    return {
        "public_id": entry.public_id,
        "project_public_id": entry.project_public_id,
        "lv_document_id": entry.document.public_id,
        "lv_version_id": entry.version.public_id,
        "lv_item_id": entry.item.public_id,
        "item_ordinal_number": entry.item.ordinal_number,
        "invoice_number": entry.invoice_number,
        "billed_quantity": _decimal(entry.billed_quantity, 3),
        "unit": entry.item.unit,
        "unit_price": _decimal(entry.item.unit_price, 4),
        "line_total": _decimal(line_total, 4),
        "notes": entry.notes,
        "calculation_rows": calculation_rows,
        "calculation_total": _decimal(entry.calculation_total, 3),
        "attachments": attachments,
        "attachments_placeholder": True,
        "revision": entry.revision,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
    }


__all__ = ["serialize_billing_entry"]
