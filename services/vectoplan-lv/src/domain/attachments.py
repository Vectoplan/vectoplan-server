"""Validation for attachment metadata placeholders."""

from __future__ import annotations

from typing import Any, Mapping

from src.domain.identifiers import is_public_id, new_public_id
from src.lvs.errors import LvValidationError


def normalize_attachment_manifest(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise LvValidationError("attachments must be an array")
    if len(raw) > 100:
        raise LvValidationError("attachments must not contain more than 100 entries")

    manifest: list[dict[str, Any]] = []
    for candidate in raw:
        if not isinstance(candidate, Mapping):
            raise LvValidationError("each attachment must be an object")
        name = str(candidate.get("name") or "").strip()
        if not name or len(name) > 255:
            raise LvValidationError(
                "each attachment needs a name with at most 255 characters"
            )
        try:
            size = max(0, int(candidate.get("size") or 0))
        except (TypeError, ValueError):
            raise LvValidationError("attachment size must be an integer") from None
        content_type = str(
            candidate.get("content_type")
            or candidate.get("type")
            or "application/octet-stream"
        ).strip()[:128]
        public_id = str(candidate.get("public_id") or "").strip()
        if not is_public_id(public_id, "att"):
            public_id = new_public_id("att")
        manifest.append(
            {
                "public_id": public_id,
                "name": name,
                "size": size,
                "content_type": content_type,
                "state": "metadata_only",
            }
        )
    return manifest


__all__ = ["normalize_attachment_manifest"]
