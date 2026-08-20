"""Validation-only report requests for the future document worker."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping


CONTRACT_VERSION = "structural-report-request/0.1"
ALLOWED_SECTIONS = {"model", "assumptions", "loads", "checks", "results", "comments"}


def validate_report_request(payload: Any) -> list[str]:
    if not isinstance(payload, Mapping):
        return ["payload must be an object"]
    errors: list[str] = []
    if payload.get("contract_version") != CONTRACT_VERSION:
        errors.append(f"contract_version must be {CONTRACT_VERSION}")
    for field in ("project_ref", "source_revision_ref"):
        if not str(payload.get(field, "")).strip():
            errors.append(f"{field} is required")
    if payload.get("format") != "pdf":
        errors.append("format must be pdf")
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        errors.append("sections must be a non-empty array")
    elif any(section not in ALLOWED_SECTIONS for section in sections):
        errors.append("sections contains an unsupported value")
    return errors


def build_report_receipt(payload: Mapping[str, Any]) -> dict[str, Any]:
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:16]
    return {
        "ok": True,
        "contract_version": "structural-report-receipt/0.1",
        "receipt_ref": f"report_{fingerprint}",
        "processable": True,
        "accepted": False,
        "persisted": False,
        "dispatch": "document_worker_not_connected",
        "requested_format": "pdf",
        "sections": list(payload["sections"]),
        "message": "Berichtsstruktur ist valide; ein PDF wurde noch nicht erzeugt.",
    }
