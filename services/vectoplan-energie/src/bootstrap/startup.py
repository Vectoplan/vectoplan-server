"""Read-only startup invariants for the standalone service."""

from __future__ import annotations

from pathlib import Path

from flask import Flask


REQUIRED_ROUTES = {
    "/energie",
    "/health/live",
    "/health/ready",
    "/api/v1/energie/status",
    "/api/v1/energie/bootstrap",
    "/api/v1/energie/sample-project",
    "/api/v1/energie/calculate",
    "/api/v1/energie/calculation-preview",
    "/api/v1/energie/pipeline/run",
    "/api/v1/energie/model-sources",
    "/api/v1/energie/model-selections/normalize",
    "/api/v1/energie/datasets",
    "/api/v1/energie/datasets/<dataset_id>",
    "/api/v1/energie/rule-profiles/<profile_id>",
    "/api/v1/energie/documents/<document_type>",
    "/api/v1/energie/change-sets",
    "/api/v1/energie/report-drafts",
}


def run_startup_checks(app: Flask, service_root: Path) -> None:
    required_files = [
        service_root / "templates" / "energie" / "index.html",
        service_root / "static" / "energie" / "css" / "main.css",
        service_root / "static" / "energie" / "js" / "main.js",
        Path(app.config["SAMPLE_PROJECT_PATH"]),
        Path(app.config["MODULE_CATALOG_PATH"]),
        Path(app.config["CONTRACT_ROOT"]) / "energy_project.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "calculation_request.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "change_set.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "model_selection.schema.json",
        Path(app.config["DATASET_ROOT"]) / "residential-new-build.json",
        Path(app.config["DATASET_ROOT"]) / "residential-1960-renovation.json",
        Path(app.config["DATASET_ROOT"]) / "non-residential-office.json",
        Path(app.config["DATASET_ROOT"]) / "mixed-use-complex.json",
        Path(app.config["RULE_PROFILE_ROOT"]) / "de-working-2026.1.json",
    ]
    missing_files = [str(path) for path in required_files if not path.is_file()]
    registered_routes = {str(rule.rule) for rule in app.url_map.iter_rules()}
    missing_routes = sorted(REQUIRED_ROUTES - registered_routes)

    ready = not missing_files and not missing_routes
    startup = {
        "ready": ready,
        "missing_files": missing_files,
        "missing_routes": missing_routes,
        "stateful_storage": False,
        "integration_calls": False,
        "mode": "standalone_preparation",
    }
    app.extensions["vectoplan_energie"]["startup"] = startup

    if not ready:
        message = (
            "VECTOPLAN Energie startup checks failed: "
            f"files={missing_files}, routes={missing_routes}"
        )
        app.logger.error(message)
        if app.config["STRICT_STARTUP"]:
            raise RuntimeError(message)


__all__ = ["REQUIRED_ROUTES", "run_startup_checks"]
