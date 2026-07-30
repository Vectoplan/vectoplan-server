"""Liveness and dependency readiness endpoints."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, current_app, jsonify
from sqlalchemy import text

from extensions import db
from src.storage.factory import get_storage_provider


health_bp = Blueprint("health", __name__)


def _database_check() -> dict[str, Any]:
    if not current_app.config.get("READINESS_CHECK_DATABASE", True):
        return {"status": "skipped"}
    try:
        db.session.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        db.session.rollback()
        return {
            "status": "error",
            "message": f"{type(exc).__name__}: {exc}",
        }


def _storage_check() -> dict[str, Any]:
    if not current_app.config.get("READINESS_CHECK_STORAGE", True):
        return {"status": "skipped"}
    try:
        return get_storage_provider(current_app).readiness()
    except Exception as exc:
        return {
            "status": "error",
            "message": f"{type(exc).__name__}: {exc}",
        }


@health_bp.get("/health")
@health_bp.get("/health/live")
def health():
    return jsonify(
        {
            "status": "ok",
            "service": current_app.config["SERVICE_NAME"],
            "version": current_app.config["SERVICE_VERSION"],
        }
    )


@health_bp.get("/ready")
@health_bp.get("/health/ready")
def ready():
    metadata = current_app.extensions.get("vectoplan_lv", {})
    checks = {
        "configuration": {
            "status": (
                "ok"
                if not metadata.get("configuration", {}).get("issues")
                else "error"
            ),
            "issues": metadata.get("configuration", {}).get("issues", []),
        },
        "startup": metadata.get(
            "startup", {"status": "error", "issues": ["startup not run"]}
        ),
        "database": _database_check(),
        "storage": _storage_check(),
    }
    ready_state = all(
        check.get("status") in {"ok", "skipped"} for check in checks.values()
    )
    return (
        jsonify(
            {
                "status": "ok" if ready_state else "not_ready",
                "service": current_app.config["SERVICE_NAME"],
                "version": current_app.config["SERVICE_VERSION"],
                "checks": checks,
            }
        ),
        200 if ready_state else 503,
    )


__all__ = ["health_bp"]
