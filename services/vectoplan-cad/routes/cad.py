from __future__ import annotations

from flask import Blueprint, current_app, jsonify, render_template, request

from src.commands.service import build_command_receipt, validate_cad_command
from src.exports.service import build_export_receipt, validate_export_request
from src.projection.service import (
    build_bootstrap_payload,
    build_preview,
    load_json_file,
    validate_projection_input,
)

cad_ui_bp = Blueprint("cad", __name__)
cad_api_bp = Blueprint("cad_api", __name__)


@cad_ui_bp.get("/cad")
def index():
    return render_template(
        "cad/index.html",
        service_name=current_app.config["SERVICE_NAME"],
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
    )


@cad_api_bp.get("/status")
def status():
    return jsonify(
        {
            "ok": True,
            "service": current_app.config["SERVICE_NAME"],
            "version": current_app.config["SERVICE_VERSION"],
            "contracts": {
                "projection": current_app.config["CONTRACT_VERSION"],
                "scene": "cad-scene/0.1",
                "command": "cad-command/0.1",
                "export": "cad-export/0.1",
            },
            "mock_mode": current_app.config["MOCK_MODE"],
            "core_connection": False,
            "stateful_storage": False,
        }
    )


@cad_api_bp.get("/bootstrap")
def bootstrap():
    return jsonify(build_bootstrap_payload(current_app.config))


@cad_api_bp.get("/plan-profiles")
def plan_profiles():
    return jsonify(load_json_file(current_app.config["PLAN_PROFILE_PATH"]))


@cad_api_bp.get("/test-input")
def test_input():
    return jsonify(load_json_file(current_app.config["TEST_INPUT_PATH"]))


@cad_api_bp.post("/preview")
def preview():
    payload = request.get_json(silent=True)
    errors = validate_projection_input(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_projection", "errors": errors}), 400
    return jsonify(build_preview(payload))


@cad_api_bp.post("/commands")
def create_command_draft():
    payload = request.get_json(silent=True)
    errors = validate_cad_command(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_cad_command", "errors": errors}), 400
    return jsonify(build_command_receipt(payload)), 202


@cad_api_bp.post("/exports")
def create_export_request():
    payload = request.get_json(silent=True)
    errors = validate_export_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_export_request", "errors": errors}), 400
    return jsonify(build_export_receipt(payload)), 202