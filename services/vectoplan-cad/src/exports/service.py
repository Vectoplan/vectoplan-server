from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4


SUPPORTED_EXPORT_FORMATS = {"pdf", "dxf", "dwg", "svg"}


def validate_export_request(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["payload must be a JSON object"]
    errors: list[str] = []
    if payload.get("contract_version") != "cad-export/0.1":
        errors.append("$.contract_version must be cad-export/0.1")
    export_format = payload.get("format")
    if not isinstance(export_format, str) or export_format.lower() not in SUPPORTED_EXPORT_FORMATS:
        errors.append(
            "$.format must be one of " + ", ".join(sorted(SUPPORTED_EXPORT_FORMATS))
        )
    if not isinstance(payload.get("document_ref"), str) or not payload["document_ref"].strip():
        errors.append("$.document_ref must be a non-empty string")
    source_revision = payload.get("source_revision_ref")
    if not isinstance(source_revision, str) or not source_revision.strip():
        errors.append("$.source_revision_ref must be a non-empty string")
    if "sheet_ref" in payload and (
        not isinstance(payload["sheet_ref"], str) or not payload["sheet_ref"].strip()
    ):
        errors.append("$.sheet_ref must be a non-empty string when provided")
    return errors


def build_export_receipt(payload: dict[str, Any]) -> dict[str, Any]:
    request = deepcopy(payload)
    request["format"] = request["format"].lower()
    request.setdefault("contract_version", "cad-export/0.1")
    return {
        "ok": True,
        "accepted": False,
        "processable": True,
        "placeholder": False,
        "export_request_id": f"exp_{uuid4().hex[:12]}",
        "format": request["format"],
        "dispatch": "export_worker_unavailable",
        "message": (
            f"{request['format'].upper()}-Exportauftrag ist gültig. "
            "Ohne Export-Worker wurde kein Artefakt erzeugt."
        ),
        "request": request,
        "stateful_storage": False,
    }