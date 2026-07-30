"""JSON-safe representations of the first LV aggregate."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from models import LvDocument, LvVersion


def _iso(value: datetime | date | None) -> str | None:
    return value.isoformat() if value is not None else None


def serialize_version(version: LvVersion) -> dict[str, Any]:
    return {
        "public_id": version.public_id,
        "version_number": version.version_number,
        "label": version.label,
        "status": version.status,
        "source_type": version.source_type,
        "source_reference": version.source_reference,
        "based_on_version_id": version.based_on_version_id,
        "created_by": version.created_by,
        "created_at": _iso(version.created_at),
        "released_by": version.released_by,
        "released_at": _iso(version.released_at),
        "content_hash": version.content_hash,
        "mutable": version.is_mutable,
    }


def serialize_document(
    document: LvDocument, *, include_versions: bool = False
) -> dict[str, Any]:
    current_draft = next(
        (
            version.public_id
            for version in document.versions
            if version.id == document.current_draft_version_id
        ),
        None,
    )
    current_contract = next(
        (
            version.public_id
            for version in document.versions
            if version.id == document.current_contract_version_id
        ),
        None,
    )
    payload: dict[str, Any] = {
        "public_id": document.public_id,
        "project_public_id": document.project_public_id,
        "name": document.name,
        "description": document.description,
        "kind": document.kind,
        "status": document.status,
        "currency": document.currency,
        "owner_user_id": document.owner_user_id,
        "revision": document.revision,
        "current_draft_version_id": current_draft,
        "current_contract_version_id": current_contract,
        "created_at": _iso(document.created_at),
        "updated_at": _iso(document.updated_at),
    }
    if include_versions:
        payload["versions"] = [
            serialize_version(version)
            for version in sorted(
                document.versions, key=lambda item: item.version_number
            )
        ]
    return payload


__all__ = ["serialize_document", "serialize_version"]
