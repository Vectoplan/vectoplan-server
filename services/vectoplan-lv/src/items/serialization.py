"""JSON-safe LV item representations."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from models import LvItem


def _decimal(value: Decimal | None, places: int) -> str | None:
    return format(value, f".{places}f") if value is not None else None


def serialize_item(item: LvItem, *, include_billings: bool = False) -> dict[str, Any]:
    calculation_rows = item.calculation_rows
    if not isinstance(calculation_rows, list):
        calculation_rows = []
    calculation_attachments = item.calculation_attachment_manifest
    if not isinstance(calculation_attachments, list):
        calculation_attachments = []
    payload: dict[str, Any] = {
        "public_id": item.public_id,
        "lv_version_id": item.version.public_id,
        "sort_order": item.sort_order,
        "parent_public_id": item.parent.public_id if item.parent is not None else None,
        "ordinal_number": item.ordinal_number,
        "item_type": item.item_type,
        "short_text": item.short_text,
        "long_text": item.long_text,
        "quantity": _decimal(item.quantity, 3),
        "unit": item.unit,
        "unit_price": _decimal(item.unit_price, 4),
        "total_price": _decimal(item.total_price, 4),
        "calculation_rows": calculation_rows,
        "calculation_total": _decimal(item.calculation_total, 3),
        "calculation_note": item.calculation_note,
        "calculation_attachments": calculation_attachments,
        "calculation_attachments_placeholder": True,
        "revision": item.revision,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }
    if include_billings:
        from src.billing.serialization import serialize_billing_entry

        payload["billings"] = [
            serialize_billing_entry(entry)
            for entry in sorted(
                item.billing_entries,
                key=lambda entry: (entry.invoice_number, entry.id),
            )
        ]
    return payload


__all__ = ["serialize_item"]
