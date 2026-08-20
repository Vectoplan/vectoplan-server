"""Read-only startup invariants for the standalone service."""

from __future__ import annotations

from pathlib import Path

from flask import Flask


REQUIRED_ROUTES = {
    "/statik",
    "/statik/ausgabevorlagen",
    "/health/live",
    "/health/ready",
    "/api/v1/statik/status",
    "/api/v1/statik/bootstrap",
    "/api/v1/statik/sample-model",
    "/api/v1/statik/report-templates",
    "/api/v1/statik/report-templates/outline-schema",
    "/api/v1/statik/report-templates/<template_id>/outline",
    "/api/v1/statik/report-section-templates",
    "/api/v1/statik/analysis-preview",
    "/api/v1/statik/analysis-jobs",
    "/api/v1/statik/standards",
    "/api/v1/statik/materials",
    "/api/v1/statik/reference-cases",
    "/api/v1/statik/commands",
    "/api/v1/statik/reports",
}


def run_startup_checks(app: Flask, service_root: Path) -> None:
    required_files = [
        service_root / "templates" / "statik" / "index.html",
        service_root / "static" / "statik" / "css" / "main.css",
        service_root / "static" / "statik" / "js" / "main.js",
        service_root / "templates" / "statik" / "report_templates.html",
        service_root / "static" / "statik" / "css" / "report-templates.css",
        service_root / "static" / "statik" / "js" / "report-templates.js",
        service_root / "src" / "report_templates" / "catalog.json",
        service_root / "src" / "report_templates" / "calculation_modules.json",
        service_root / "src" / "report_templates" / "section_templates.json",
        Path(app.config["SAMPLE_MODEL_PATH"]),
        Path(app.config["PROFILE_CATALOG_PATH"]),
        Path(app.config["CONTRACT_ROOT"]) / "structural_model.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "structural_command.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "report_request.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "structural_analysis_job.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "structural_exchange.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "structural_report_template.schema.json",
        Path(app.config["CONTRACT_ROOT"]) / "structural_report_outline.schema.json",
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
        "mode": "standalone_engineering_kernel",
    }
    app.extensions["vectoplan_statik"]["startup"] = startup

    if not ready:
        message = (
            "VECTOPLAN Statik startup checks failed: "
            f"files={missing_files}, routes={missing_routes}"
        )
        app.logger.error(message)
        if app.config["STRICT_STARTUP"]:
            raise RuntimeError(message)


__all__ = ["REQUIRED_ROUTES", "run_startup_checks"]
