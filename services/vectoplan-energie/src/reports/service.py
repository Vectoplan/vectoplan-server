"""Create a report receipt without claiming a normative certificate."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


ALLOWED_REPORTS = {"concept_summary", "data_quality", "variant_comparison"}


def validate_report_request(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["request body must be a JSON object"]
    errors: list[str] = []
    if not str(payload.get("project_id", "")).strip():
        errors.append("project_id is required")
    if payload.get("report_type") not in ALLOWED_REPORTS:
        errors.append(f"report_type must be one of: {', '.join(sorted(ALLOWED_REPORTS))}")
    return errors


def build_report_draft(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "accepted": True,
        "generated": False,
        "report": {
            "id": f"erpt_{uuid4().hex[:16]}",
            "project_id": str(payload["project_id"]),
            "report_type": str(payload["report_type"]),
            "locale": str(payload.get("locale", "de-DE")),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "draft",
            "normative": False,
        },
        "message": "Berichtsentwurf vorbereitet. Es wurde kein Nachweisdokument erzeugt.",
    }


__all__ = ["ALLOWED_REPORTS", "build_report_draft", "validate_report_request"]
