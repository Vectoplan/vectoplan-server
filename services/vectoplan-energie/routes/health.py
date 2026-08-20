"""Liveness and local readiness endpoints."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify


health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
@health_bp.get("/health/live")
def live():
    return jsonify(
        {
            "ok": True,
            "service": current_app.config["SERVICE_NAME"],
            "version": current_app.config["SERVICE_VERSION"],
            "status": "live",
        }
    )


@health_bp.get("/ready")
@health_bp.get("/health/ready")
def ready():
    startup = current_app.extensions.get("vectoplan_energie", {}).get("startup", {})
    is_ready = bool(startup.get("ready", False))
    return (
        jsonify(
            {
                "ok": is_ready,
                "service": current_app.config["SERVICE_NAME"],
                "status": "ready" if is_ready else "not_ready",
                "startup": startup,
            }
        ),
        200 if is_ready else 503,
    )


__all__ = ["health_bp"]
