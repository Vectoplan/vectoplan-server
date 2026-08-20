"""UI and stateless preparation APIs for energy consulting."""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, render_template, request

from src.calculations.service import calculate_preview, validate_calculation_request
from src.changes.service import build_change_set, validate_change_request
from src.datasets.service import get_dataset, list_datasets
from src.documents.service import SUPPORTED_DOCUMENTS, build_document_draft
from src.integrations.model_sources import build_model_sources, normalize_selection
from src.pipeline.orchestrator import (
    DEFAULT_RULE_PROFILE,
    PIPELINE_VERSION,
    run_energy_pipeline,
    validate_pipeline_request,
)
from src.reports.service import build_report_draft, validate_report_request
from src.standards.service import load_rule_profile
from src.workspace.service import build_bootstrap_payload, load_json_file, validate_energy_project


energie_ui_bp = Blueprint("energie", __name__)
energie_api_bp = Blueprint("energie_api", __name__)


@energie_ui_bp.get("/energie")
def index():
    return render_template(
        "energie/index.html",
        service_name=current_app.config["SERVICE_NAME"],
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
    )


@energie_api_bp.get("/status")
def status():
    return jsonify(
        {
            "ok": True,
            "service": current_app.config["SERVICE_NAME"],
            "version": current_app.config["SERVICE_VERSION"],
            "stateful_storage": False,
            "integrations_enabled": bool(current_app.config["INTEGRATIONS_ENABLED"]),
            "mode": "standalone_preparation",
            "contracts": {
                "project": current_app.config["PROJECT_CONTRACT_VERSION"],
                "calculation": current_app.config["CALCULATION_CONTRACT_VERSION"],
                "change_set": current_app.config["CHANGE_SET_CONTRACT_VERSION"],
            },
        }
    )


@energie_api_bp.get("/bootstrap")
def bootstrap():
    payload = build_bootstrap_payload(current_app.config)
    payload["model_sources"] = build_model_sources(
        current_app.config,
        request.host_url.rstrip("/"),
        str(payload.get("project", {}).get("project", {}).get("id") or ""),
    )
    payload["datasets"] = list_datasets(current_app.config)
    payload["pipeline"] = {
        "version": PIPELINE_VERSION,
        "default_rule_profile": DEFAULT_RULE_PROFILE,
        "route": f"{str(current_app.config['ROUTE_PREFIX']).rstrip('/')}/pipeline/run",
    }
    return jsonify(payload)


@energie_api_bp.get("/sample-project")
def sample_project():
    payload = load_json_file(current_app.config["SAMPLE_PROJECT_PATH"])
    errors = validate_energy_project(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_sample_project", "errors": errors}), 500
    return jsonify(payload)


@energie_api_bp.post("/calculate")
@energie_api_bp.post("/calculation-preview")
def calculation_preview():
    payload = request.get_json(silent=True)
    errors = validate_calculation_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_calculation_request", "errors": errors}), 400
    return jsonify(calculate_preview(payload))


@energie_api_bp.post("/pipeline/run")
def run_pipeline():
    payload = request.get_json(silent=True)
    errors = validate_pipeline_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_pipeline_request", "errors": errors}), 400
    include_variants = request.args.get("include_variants", "1").strip().lower() not in {"0", "false", "no"}
    return jsonify(run_energy_pipeline(payload, include_variants=include_variants))


@energie_api_bp.get("/model-sources")
def model_sources():
    return jsonify(
        build_model_sources(
            current_app.config,
            request.host_url.rstrip("/"),
            str(request.args.get("project_id") or ""),
        )
    )


@energie_api_bp.post("/model-selections/normalize")
def normalize_model_selection():
    normalized, errors = normalize_selection(request.get_json(silent=True))
    if errors:
        return jsonify({"ok": False, "error": "invalid_model_selection", "errors": errors}), 400
    return jsonify({"ok": True, "selection": normalized})


@energie_api_bp.get("/datasets")
def datasets():
    return jsonify({"ok": True, "datasets": list_datasets(current_app.config)})


@energie_api_bp.get("/rule-profiles/<profile_id>")
def rule_profile(profile_id: str):
    payload = load_rule_profile(current_app.config["RULE_PROFILE_ROOT"], profile_id)
    if payload is None:
        return jsonify({"ok": False, "error": "rule_profile_not_found"}), 404
    return jsonify(payload)


@energie_api_bp.get("/datasets/<dataset_id>")
def dataset(dataset_id: str):
    payload = get_dataset(current_app.config, dataset_id)
    if payload is None:
        return jsonify({"ok": False, "error": "dataset_not_found"}), 404
    return jsonify(payload)


@energie_api_bp.post("/documents/<document_type>")
def create_document(document_type: str):
    if document_type not in SUPPORTED_DOCUMENTS:
        return jsonify({"ok": False, "error": "unsupported_document_type"}), 404
    payload = request.get_json(silent=True)
    errors = validate_pipeline_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_document_request", "errors": errors}), 400
    return jsonify(build_document_draft(document_type, payload)), 202


@energie_api_bp.post("/change-sets")
def create_change_set():
    payload = request.get_json(silent=True)
    errors = validate_change_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_change_request", "errors": errors}), 400
    return jsonify(build_change_set(payload)), 202


@energie_api_bp.post("/report-drafts")
def create_report_draft():
    payload = request.get_json(silent=True)
    errors = validate_report_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_report_request", "errors": errors}), 400
    return jsonify(build_report_draft(payload)), 202


__all__ = ["energie_api_bp", "energie_ui_bp"]
