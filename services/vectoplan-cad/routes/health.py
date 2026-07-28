from __future__ import annotations

from flask import Blueprint, current_app, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.get("/health/live")
def live():
    return jsonify({"ok": True, "service": current_app.config["SERVICE_NAME"], "status": "live"})


@health_bp.get("/health/ready")
def ready():
    startup = current_app.extensions.get("vectoplan_cad", {}).get("startup", {})
    ready_state = bool(startup.get("ready", False))
    status = 200 if ready_state else 503
    return jsonify({"ok": ready_state, "service": current_app.config["SERVICE_NAME"], "status": "ready" if ready_state else "not_ready", "startup": startup}), status
