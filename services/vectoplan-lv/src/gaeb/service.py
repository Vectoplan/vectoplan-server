"""Application-level GAEB import/export orchestration."""

from __future__ import annotations

from typing import Any

from models import LvDocument
from src.gaeb.v33 import export_gaeb, parse_gaeb
from src.items.service import create_item, list_items
from src.lvs.errors import LvConflictError, LvValidationError
from src.lvs.service import get_lv_document


def import_gaeb(
    project_public_id: str,
    lv_id: str,
    xml_bytes: bytes,
    *,
    filename: str | None = None,
) -> dict[str, Any]:
    parsed = parse_gaeb(xml_bytes)
    imported: list[str] = []
    skipped: list[dict[str, str]] = []

    for index, payload in enumerate(parsed.items, start=1):
        try:
            item = create_item(project_public_id, lv_id, payload)
            imported.append(item.public_id)
        except (LvConflictError, LvValidationError) as exc:
            skipped.append(
                {
                    "row": str(index),
                    "ordinal_number": str(payload.get("ordinal_number") or ""),
                    "reason": str(exc),
                }
            )

    return {
        "format": "GAEB DA XML",
        "version": parsed.version,
        "phase": f"X{parsed.phase}" if parsed.phase else None,
        "filename": filename,
        "imported_count": len(imported),
        "imported_item_ids": imported,
        "skipped_count": len(skipped),
        "skipped": skipped,
        "warnings": parsed.warnings,
        "schema_validation": "not_performed",
    }


def export_lv_gaeb(
    project_public_id: str,
    lv_id: str,
    *,
    phase: str,
) -> tuple[LvDocument, bytes]:
    document = get_lv_document(project_public_id, lv_id)
    return document, export_gaeb(
        document,
        list_items(project_public_id, lv_id),
        phase=phase,
    )


__all__ = ["export_lv_gaeb", "import_gaeb"]
