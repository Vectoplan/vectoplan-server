"""Application services for manually editable LV rows."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Mapping

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import LvDocument, LvItem, LvVersion
from models.lv_item import LV_ITEM_TYPES
from src.billing.calculation import evaluate_calculation_rows
from src.domain.attachments import normalize_attachment_manifest
from src.domain.identifiers import new_public_id
from src.lvs.errors import LvConflictError, LvNotFoundError, LvValidationError
from src.lvs.service import get_lv_document


def _text(
    payload: Mapping[str, Any],
    key: str,
    *,
    maximum: int,
    required: bool = False,
) -> str | None:
    raw = payload.get(key)
    if raw is None:
        if required:
            raise LvValidationError(f"{key} is required")
        return None
    value = str(raw).strip()
    if required and not value:
        raise LvValidationError(f"{key} is required")
    if len(value) > maximum:
        raise LvValidationError(f"{key} must not exceed {maximum} characters")
    return value or None


def parse_decimal(
    value: Any,
    field: str,
    *,
    minimum: Decimal | None = None,
) -> Decimal | None:
    if value in (None, ""):
        return None
    normalized = str(value).strip()
    if "," in normalized and "." not in normalized:
        normalized = normalized.replace(",", ".")
    try:
        number = Decimal(normalized)
    except (InvalidOperation, ValueError):
        raise LvValidationError(f"{field} must be a decimal number") from None
    if not number.is_finite():
        raise LvValidationError(f"{field} must be finite")
    if minimum is not None and number < minimum:
        raise LvValidationError(f"{field} must be at least {minimum}")
    return number


def current_draft_version(document: LvDocument) -> LvVersion:
    version = next(
        (
            candidate
            for candidate in document.versions
            if candidate.id == document.current_draft_version_id
        ),
        None,
    )
    if version is None:
        raise LvConflictError("the LV has no current draft version")
    if not version.is_mutable:
        raise LvConflictError("the current LV version is not mutable")
    return version


def list_items(project_public_id: str, lv_id: str) -> list[LvItem]:
    document = get_lv_document(project_public_id, lv_id)
    version = current_draft_version(document)
    statement = (
        select(LvItem)
        .where(
            LvItem.lv_version_id == version.id,
            LvItem.deleted_at.is_(None),
        )
        .order_by(LvItem.sort_order.asc(), LvItem.id.asc())
    )
    return list(db.session.scalars(statement).unique())


def get_item(project_public_id: str, item_id: str) -> LvItem:
    statement = (
        select(LvItem)
        .join(LvVersion, LvItem.lv_version_id == LvVersion.id)
        .join(LvDocument, LvVersion.lv_document_id == LvDocument.id)
        .where(
            LvDocument.project_public_id == project_public_id,
            LvDocument.deleted_at.is_(None),
            LvItem.public_id == item_id,
            LvItem.deleted_at.is_(None),
        )
    )
    item = db.session.scalar(statement)
    if item is None:
        raise LvNotFoundError("LV item not found")
    return item


def _next_sort_order(version_id: int) -> int:
    current = db.session.scalar(
        select(func.max(LvItem.sort_order)).where(
            LvItem.lv_version_id == version_id,
            LvItem.deleted_at.is_(None),
        )
    )
    return int(current or 0) + 10


def _validate_parent(
    item_type: str,
    parent: LvItem | None,
    *,
    current: LvItem | None = None,
) -> None:
    if current is not None and parent is not None and parent.id == current.id:
        raise LvValidationError("an LV item cannot be its own parent")
    if item_type == "title":
        if parent is not None:
            raise LvValidationError("titles cannot have a parent")
        return
    if item_type == "section":
        if parent is None or parent.item_type != "title":
            raise LvValidationError(
                "sections must reference a title as parent_public_id"
            )
        return
    if parent is not None and parent.item_type not in {"title", "section"}:
        raise LvValidationError(
            "positions and text rows may reference a title or section"
        )


def _resolve_parent(
    version: LvVersion,
    payload: Mapping[str, Any],
    item_type: str,
    *,
    current: LvItem | None = None,
) -> LvItem | None:
    if "parent_public_id" not in payload:
        parent = current.parent if current is not None else None
    else:
        parent_public_id = str(payload.get("parent_public_id") or "").strip()
        if not parent_public_id:
            parent = None
        else:
            parent = db.session.scalar(
                select(LvItem).where(
                    LvItem.public_id == parent_public_id,
                    LvItem.lv_version_id == version.id,
                    LvItem.deleted_at.is_(None),
                )
            )
            if parent is None:
                raise LvValidationError(
                    "parent_public_id must reference an item in this LV"
                )
    _validate_parent(item_type, parent, current=current)
    return parent


def _sibling_count(
    version: LvVersion,
    item_type: str,
    parent: LvItem | None,
) -> int:
    statement = select(func.count(LvItem.id)).where(
        LvItem.lv_version_id == version.id,
        LvItem.item_type == item_type,
        LvItem.deleted_at.is_(None),
    )
    if parent is None:
        statement = statement.where(LvItem.parent_item_id.is_(None))
    else:
        statement = statement.where(LvItem.parent_item_id == parent.id)
    return int(db.session.scalar(statement) or 0)


def _default_ordinal(
    version: LvVersion,
    item_type: str,
    parent: LvItem | None,
    sort_order: int,
) -> str | None:
    del sort_order
    if item_type == "title":
        return f"{_sibling_count(version, item_type, None) + 1:02d}"
    if item_type == "section":
        if parent is None or not parent.ordinal_number:
            raise LvValidationError("a section requires a numbered title")
        return (
            f"{parent.ordinal_number}."
            f"{_sibling_count(version, item_type, parent) + 1:02d}"
        )
    if item_type == "position":
        prefix = parent.ordinal_number if parent is not None else "00"
        if not prefix:
            raise LvValidationError("the selected parent has no ordinal number")
        sequence = (_sibling_count(version, item_type, parent) + 1) * 10
        return f"{prefix}.{sequence:04d}"
    return None


def _ordered(items: list[LvItem]) -> list[LvItem]:
    return sorted(items, key=lambda item: (item.sort_order, item.id or 0))


def _renumber_items(items: list[LvItem]) -> None:
    numbered = [
        item
        for item in items
        if item.deleted_at is None and item.item_type in {"title", "section", "position"}
    ]
    for item in numbered:
        item.ordinal_number = f"tmp-{item.public_id}"
    for item in items:
        if item.item_type == "text":
            item.ordinal_number = None
    db.session.flush()

    ordered = _ordered(items)
    titles = [item for item in ordered if item.item_type == "title"]
    root_positions = [
        item
        for item in ordered
        if item.item_type == "position" and item.parent is None
    ]
    for position_index, position in enumerate(root_positions, start=1):
        position.ordinal_number = f"00.{position_index * 10:04d}"

    for title_index, title in enumerate(titles, start=1):
        title.ordinal_number = f"{title_index:02d}"
        sections = [
            item
            for item in ordered
            if item.item_type == "section" and item.parent is title
        ]
        direct_positions = [
            item
            for item in ordered
            if item.item_type == "position" and item.parent is title
        ]
        for position_index, position in enumerate(direct_positions, start=1):
            position.ordinal_number = (
                f"{title.ordinal_number}.{position_index * 10:04d}"
            )
        for section_index, section in enumerate(sections, start=1):
            section.ordinal_number = (
                f"{title.ordinal_number}.{section_index:02d}"
            )
            section_positions = [
                item
                for item in ordered
                if item.item_type == "position" and item.parent is section
            ]
            for position_index, position in enumerate(
                section_positions,
                start=1,
            ):
                position.ordinal_number = (
                    f"{section.ordinal_number}.{position_index * 10:04d}"
                )

    unresolved = [
        item for item in numbered if item.ordinal_number.startswith("tmp-")
    ]
    if unresolved:
        raise LvValidationError("the LV hierarchy contains unresolved items")


def _apply_calculation_payload(
    item: LvItem,
    payload: Mapping[str, Any],
) -> None:
    calculation_fields = {
        "calculation_rows",
        "calculation_note",
        "calculation_attachments",
    }
    if item.item_type != "position":
        if calculation_fields.intersection(payload):
            raise LvValidationError("only positions can have a calculation path")
        item.calculation_rows = []
        item.calculation_total = None
        item.calculation_note = None
        item.calculation_attachment_manifest = []
        return

    if "calculation_rows" in payload:
        rows, total = evaluate_calculation_rows(payload.get("calculation_rows"))
        if total < 0:
            raise LvValidationError(
                "the sum of calculation rows must not be negative"
            )
        item.calculation_rows = rows
        has_calculations = any(row["expression"] for row in rows)
        item.calculation_total = total if has_calculations else None
        if has_calculations:
            item.quantity = total
    if "calculation_note" in payload:
        item.calculation_note = _text(
            payload,
            "calculation_note",
            maximum=50_000,
        )
    if "calculation_attachments" in payload:
        item.calculation_attachment_manifest = normalize_attachment_manifest(
            payload.get("calculation_attachments")
        )


def _apply_item_payload(
    item: LvItem,
    payload: Mapping[str, Any],
    *,
    creating: bool,
) -> None:
    item_type = str(payload.get("item_type") or item.item_type or "position").lower()
    if item_type not in LV_ITEM_TYPES:
        raise LvValidationError(
            f"item_type must be one of: {', '.join(sorted(LV_ITEM_TYPES))}"
        )
    item.item_type = item_type

    editable = {
        "ordinal_number": (64, False),
        "short_text": (500, False),
        "long_text": (50_000, False),
        "unit": (32, False),
    }
    for field, (maximum, required) in editable.items():
        if creating or field in payload:
            setattr(
                item,
                field,
                _text(payload, field, maximum=maximum, required=required),
            )

    if creating or "quantity" in payload:
        item.quantity = parse_decimal(
            payload.get("quantity"),
            "quantity",
            minimum=Decimal("0"),
        )
    if creating or "unit_price" in payload:
        item.unit_price = parse_decimal(
            payload.get("unit_price"),
            "unit_price",
            minimum=Decimal("0"),
        )

    if item.item_type in {"position", "title", "section"}:
        if not item.short_text:
            raise LvValidationError(
                f"short_text is required for a {item.item_type}"
            )
        if not item.ordinal_number:
            raise LvValidationError(
                f"ordinal_number is required for a {item.item_type}"
            )
    if item.item_type == "text":
        if not item.short_text and not item.long_text:
            raise LvValidationError("a text row requires short_text or long_text")
        item.ordinal_number = None

    if item.item_type != "position":
        item.quantity = None
        item.unit = None
        item.unit_price = None
    if item.item_type == "title":
        item.parent = None


def create_item(
    project_public_id: str,
    lv_id: str,
    payload: Mapping[str, Any],
) -> LvItem:
    document = get_lv_document(project_public_id, lv_id)
    version = current_draft_version(document)
    item_type = str(payload.get("item_type") or "position").lower()
    if item_type not in LV_ITEM_TYPES:
        raise LvValidationError(
            f"item_type must be one of: {', '.join(sorted(LV_ITEM_TYPES))}"
        )
    parent = _resolve_parent(version, payload, item_type)
    sort_order = _next_sort_order(version.id)
    normalized_payload = dict(payload)
    if not str(normalized_payload.get("ordinal_number") or "").strip():
        normalized_payload["ordinal_number"] = _default_ordinal(
            version, item_type, parent, sort_order
        )
    item = LvItem(
        public_id=new_public_id("item"),
        lv_version_id=version.id,
        sort_order=sort_order,
        item_type=item_type,
        parent=parent,
    )
    _apply_item_payload(item, normalized_payload, creating=True)
    _apply_calculation_payload(item, normalized_payload)

    try:
        db.session.add(item)
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise LvConflictError(
            "the ordinal number already exists in this LV version"
        ) from exc
    except Exception:
        db.session.rollback()
        raise
    return item


def update_item(
    project_public_id: str,
    item_id: str,
    payload: Mapping[str, Any],
) -> LvItem:
    item = get_item(project_public_id, item_id)
    if not item.version.is_mutable:
        raise LvConflictError("released LV items cannot be changed")
    previous_type = item.item_type
    item_type = str(payload.get("item_type") or item.item_type).lower()
    hierarchy_changed = (
        "parent_public_id" in payload or item_type != previous_type
    )
    if hierarchy_changed:
        item.parent = _resolve_parent(
            item.version,
            payload,
            item_type,
            current=item,
        )
    _apply_item_payload(item, payload, creating=False)
    _apply_calculation_payload(item, payload)
    item.revision += 1
    try:
        if hierarchy_changed:
            items = list(db.session.scalars(
                select(LvItem).where(
                    LvItem.lv_version_id == item.lv_version_id,
                    LvItem.deleted_at.is_(None),
                )
            ).unique())
            _renumber_items(items)
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise LvConflictError(
            "the ordinal number already exists in this LV version"
        ) from exc
    except Exception:
        db.session.rollback()
        raise
    return item


def reorder_items(
    project_public_id: str,
    lv_id: str,
    order: Any,
) -> list[LvItem]:
    document = get_lv_document(project_public_id, lv_id)
    version = current_draft_version(document)
    items = list_items(project_public_id, lv_id)
    if not isinstance(order, list):
        raise LvValidationError("order must be an array")
    if len(order) != len(items):
        raise LvValidationError("order must contain every active LV item exactly once")

    by_public_id = {item.public_id: item for item in items}
    normalized: list[tuple[LvItem, str | None]] = []
    seen: set[str] = set()
    for candidate in order:
        if not isinstance(candidate, Mapping):
            raise LvValidationError("each order entry must be an object")
        public_id = str(candidate.get("public_id") or "").strip()
        if public_id in seen or public_id not in by_public_id:
            raise LvValidationError(
                "order contains an unknown or duplicate LV item"
            )
        seen.add(public_id)
        parent_public_id = (
            str(candidate.get("parent_public_id") or "").strip() or None
        )
        normalized.append((by_public_id[public_id], parent_public_id))

    for index, (item, parent_public_id) in enumerate(normalized, start=1):
        parent = None
        if parent_public_id is not None:
            parent = by_public_id.get(parent_public_id)
            if parent is None:
                raise LvValidationError(
                    "parent_public_id must reference an item in this LV"
                )
        _validate_parent(item.item_type, parent, current=item)
        item.parent = parent
        item.sort_order = index * 10
        item.revision += 1

    try:
        _renumber_items([item for item, _ in normalized])
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise LvConflictError("the LV order could not be saved") from exc
    except Exception:
        db.session.rollback()
        raise
    return list_items(project_public_id, lv_id)


__all__ = [
    "create_item",
    "current_draft_version",
    "get_item",
    "list_items",
    "parse_decimal",
    "reorder_items",
    "update_item",
]
