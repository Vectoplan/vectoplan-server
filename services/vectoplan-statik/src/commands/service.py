"""Declarative, non-persistent structural command drafts."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping


CONTRACT_VERSION = "structural-command/0.1"
ALLOWED_COMMANDS = {
    "update_element_parameters",
    "set_review_status",
    "add_load_case",
}


def validate_command(payload: Any) -> list[str]:
    if not isinstance(payload, Mapping):
        return ["payload must be an object"]
    errors: list[str] = []
    if payload.get("contract_version") != CONTRACT_VERSION:
        errors.append(f"contract_version must be {CONTRACT_VERSION}")
    if payload.get("command") not in ALLOWED_COMMANDS:
        errors.append("command is unsupported")
    for field in ("project_ref", "element_ref", "base_revision_ref", "client_command_id"):
        if not str(payload.get(field, "")).strip():
            errors.append(f"{field} is required")
    if not isinstance(payload.get("parameters"), Mapping) or not payload.get("parameters"):
        errors.append("parameters must be a non-empty object")
    return errors


def build_command_receipt(payload: Mapping[str, Any]) -> dict[str, Any]:
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:16]
    return {
        "ok": True,
        "contract_version": "structural-command-receipt/0.1",
        "receipt_ref": f"draft_{fingerprint}",
        "command": payload["command"],
        "project_ref": payload["project_ref"],
        "element_ref": payload["element_ref"],
        "base_revision_ref": payload["base_revision_ref"],
        "preview_parameters": dict(payload["parameters"]),
        "processable": True,
        "accepted": False,
        "persisted": False,
        "dispatch": "core_adapter_not_connected",
        "message": "Änderung ist lokal plausibel, wurde aber nicht in andere Systeme übertragen.",
    }
