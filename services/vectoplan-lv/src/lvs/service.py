"""Application use cases for the initial LV aggregate."""

from __future__ import annotations

from typing import Any, Mapping

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from extensions import db
from models import LvDocument, LvVersion
from models.lv_document import LV_KINDS
from src.domain.identifiers import new_public_id
from src.lvs.errors import LvConflictError, LvNotFoundError, LvValidationError


def _required_text(
    payload: Mapping[str, Any], key: str, *, maximum: int
) -> str:
    value = str(payload.get(key) or "").strip()
    if not value:
        raise LvValidationError(f"{key} is required")
    if len(value) > maximum:
        raise LvValidationError(f"{key} must not exceed {maximum} characters")
    return value


def _optional_text(
    payload: Mapping[str, Any], key: str, *, maximum: int
) -> str | None:
    raw = payload.get(key)
    if raw is None:
        return None
    value = str(raw).strip()
    if len(value) > maximum:
        raise LvValidationError(f"{key} must not exceed {maximum} characters")
    return value or None


def create_lv_document(
    project_public_id: str,
    payload: Mapping[str, Any],
    *,
    actor_user_id: str | None = None,
) -> LvDocument:
    """Create an LV and its initial mutable version atomically."""
    name = _required_text(payload, "name", maximum=250)
    description = _optional_text(payload, "description", maximum=20_000)
    kind = str(payload.get("kind") or "tender").strip().lower()
    if kind not in LV_KINDS:
        raise LvValidationError(
            f"kind must be one of: {', '.join(sorted(LV_KINDS))}"
        )

    currency = str(payload.get("currency") or "EUR").strip().upper()
    if len(currency) != 3 or not currency.isalpha():
        raise LvValidationError("currency must be a three-letter code")

    owner_user_id = (
        str(payload.get("owner_user_id") or actor_user_id or "").strip() or None
    )
    document = LvDocument(
        public_id=new_public_id("lv"),
        project_public_id=project_public_id,
        name=name,
        description=description,
        kind=kind,
        status="draft",
        currency=currency,
        owner_user_id=owner_user_id,
    )

    try:
        db.session.add(document)
        db.session.flush()

        initial_version = LvVersion(
            public_id=new_public_id("lvv"),
            lv_document_id=document.id,
            version_number=1,
            label="Initialer Entwurf",
            status="draft",
            source_type="manual",
            created_by=actor_user_id,
        )
        db.session.add(initial_version)
        db.session.flush()
        document.current_draft_version_id = initial_version.id
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise LvConflictError("the LV could not be created due to a conflict") from exc
    except Exception:
        db.session.rollback()
        raise

    return document


def list_lv_documents(project_public_id: str) -> list[LvDocument]:
    statement = (
        select(LvDocument)
        .where(
            LvDocument.project_public_id == project_public_id,
            LvDocument.deleted_at.is_(None),
        )
        .order_by(LvDocument.updated_at.desc(), LvDocument.id.desc())
    )
    return list(db.session.scalars(statement).unique())


def get_lv_document(project_public_id: str, public_id: str) -> LvDocument:
    statement = select(LvDocument).where(
        LvDocument.project_public_id == project_public_id,
        LvDocument.public_id == public_id,
        LvDocument.deleted_at.is_(None),
    )
    document = db.session.scalar(statement)
    if document is None:
        # Project-scoped 404 intentionally avoids revealing cross-project data.
        raise LvNotFoundError("LV not found")
    return document


__all__ = ["create_lv_document", "get_lv_document", "list_lv_documents"]
