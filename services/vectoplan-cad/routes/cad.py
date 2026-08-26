from __future__ import annotations

from flask import Blueprint, current_app, jsonify, render_template, request

from src.automation.dimensions import DimensionCalculationError, calculate_dimensions
from src.automation.roof import RoofCalculationError, calculate_roof
from src.commands.service import build_command_receipt, validate_cad_command
from src.core.client import CoreClientError, dispatch_cad_command, get_import_projection, project_chunks_to_projection
from src.exports.service import build_export_receipt, validate_export_request
from src.library.client import LibraryClientError, load_cad_library_catalog
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
                "command": "cad-command/0.2",
                "library_catalog": "cad-library-catalog/0.1",
                "export": "cad-export/0.1",
                "automatic_dimensions": "cad-auto-dimension-result/0.1",
                "parametric_roof": "cad-roof-calculation-result/0.1",
                "plan_rules": "cad-plan-rules/0.1",
            },
            "mock_mode": current_app.config["MOCK_MODE"],
            "core_connection": bool(current_app.config["CORE_INTERNAL_URL"]),
            "stateful_storage": False,
        }
    )


@cad_api_bp.get("/bootstrap")
def bootstrap():
    return jsonify(build_bootstrap_payload(current_app.config))


@cad_api_bp.get("/plan-profiles")
def plan_profiles():
    return jsonify(load_json_file(current_app.config["PLAN_PROFILE_PATH"]))


@cad_api_bp.get("/plan-rules")
def plan_rules():
    return jsonify(load_json_file(current_app.config["PLAN_RULES_PATH"]))


@cad_api_bp.get("/test-input")
def test_input():
    return jsonify(load_json_file(current_app.config["TEST_INPUT_PATH"]))


@cad_api_bp.get("/library/catalog")
def library_catalog():
    try:
        return jsonify(load_cad_library_catalog(current_app.config))
    except LibraryClientError as exc:
        return jsonify({"ok": False, "error": "library_unavailable", "message": str(exc)}), 502


@cad_api_bp.post("/preview")
def preview():
    payload = request.get_json(silent=True)
    errors = validate_projection_input(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_projection", "errors": errors}), 400
    return jsonify(build_preview(payload))


@cad_api_bp.post("/core/projects/<core_project_id>/projection")
def core_projection(core_project_id: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"ok": False, "error": "invalid_core_projection_request"}), 400
    try:
        return jsonify(project_chunks_to_projection(current_app.config, core_project_id, payload))
    except CoreClientError as exc:
        return jsonify({"ok": False, "error": "projection_unavailable", "message": str(exc)}), 502


@cad_api_bp.get("/core/projects/<core_project_id>/imports/<document_id>/projection")
def core_import_projection(core_project_id: str, document_id: str):
    try:
        return jsonify(get_import_projection(current_app.config, core_project_id, document_id))
    except CoreClientError as exc:
        return jsonify({"ok": False, "error": "projection_unavailable", "message": str(exc)}), 502


@cad_api_bp.post("/commands")
def create_command_draft():
    payload = request.get_json(silent=True)
    try:
        catalog = load_cad_library_catalog(current_app.config)
    except LibraryClientError as exc:
        return jsonify({"ok": False, "error": "library_unavailable", "message": str(exc)}), 502
    errors = validate_cad_command(payload, catalog=catalog)
    if errors:
        return jsonify({"ok": False, "error": "invalid_cad_command", "errors": errors}), 400
    receipt = build_command_receipt(payload, catalog=catalog)
    user_context = payload.get("user_context") if isinstance(payload.get("user_context"), dict) else {}
    core_project_id = str(user_context.get("core_project_id") or "").strip()
    if receipt["mutation_intent"]["model_changing"] and core_project_id:
        try:
            dispatch = dispatch_cad_command(current_app.config, core_project_id, receipt["command"])
        except CoreClientError as exc:
            return jsonify({
                "ok": False,
                "error": "model_command_unavailable",
                "message": str(exc),
                "receipt": receipt,
            }), 502
        receipt.update({
            "accepted": True,
            "dispatch": dispatch.get("dispatch") or "chunk-persisted",
            "message": "CAD-Ã„nderung wurde im gemeinsamen 3D-Modell gespeichert.",
            "stateful_storage": True,
            "core_result": dispatch,
        })
    return jsonify(receipt), 202


@cad_api_bp.post("/automation/dimensions/calculate")
def calculate_automatic_dimensions():
    payload = request.get_json(silent=True)
    try:
        return jsonify(calculate_dimensions(payload))
    except DimensionCalculationError as exc:
        return jsonify({"ok": False, "error": "invalid_dimension_request", "errors": exc.errors}), 400


@cad_api_bp.post("/automation/roof/calculate")
def calculate_parametric_roof():
    payload = request.get_json(silent=True)
    try:
        return jsonify(calculate_roof(payload))
    except RoofCalculationError as exc:
        return jsonify({"ok": False, "error": "invalid_roof_request", "errors": exc.errors}), 400


@cad_api_bp.post("/exports")
def create_export_request():
    payload = request.get_json(silent=True)
    errors = validate_export_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_export_request", "errors": errors}), 400
    return jsonify(build_export_receipt(payload)), 202
