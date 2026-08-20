"""Create inert change sets for a future platform synchronisation layer."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Any
from uuid import uuid4


def validate_change_request(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["request body must be a JSON object"]
    errors: list[str] = []
    if not str(payload.get("project_id", "")).strip():
        errors.append("project_id is required")
    if not str(payload.get("base_revision", "")).strip():
        errors.append("base_revision is required")
    changes = payload.get("changes")
    if not isinstance(changes, list) or not changes:
        errors.append("changes must be a non-empty array")
    return errors


def build_change_set(payload: dict[str, Any]) -> dict[str, Any]:
    canonical = json.dumps(payload.get("changes", []), sort_keys=True, separators=(",", ":"))
    fingerprint = sha256(canonical.encode("utf-8")).hexdigest()[:20]
    return {
        "ok": True,
        "accepted": True,
        "persisted": False,
        "dispatched": False,
        "change_set": {
            "id": f"ecs_{uuid4().hex[:16]}",
            "schema_version": "energy-change-set/0.1",
            "project_id": str(payload["project_id"]),
            "base_revision": str(payload["base_revision"]),
            "fingerprint": fingerprint,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "authoring_service": "vectoplan-energie",
            "intent": str(payload.get("intent", "energy_consultant_override")),
            "changes": payload["changes"],
            "status": "draft",
        },
        "next_step": "A future orchestration adapter may validate and dispatch this draft.",
    }


__all__ = ["build_change_set", "validate_change_request"]
