"""Read-only startup invariants for the service skeleton."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from flask import Flask

from src.storage.factory import get_storage_provider


REQUIRED_ROUTES = {
    "/health",
    "/ready",
    "/v1/context",
    "/v1/lvs",
    "/lv",
}
REQUIRED_FILES = {
    "app.py",
    "wsgi.py",
    "config.py",
    "extensions.py",
    "routes/__init__.py",
    "models/__init__.py",
    "migrations/env.py",
}


def _registered_routes(app: Flask) -> set[str]:
    return {str(rule.rule) for rule in app.url_map.iter_rules()}


def run_startup(app: Flask) -> dict[str, Any]:
    """Validate structure and route registration without mutating the database."""
    service_root = Path(app.extensions["vectoplan_lv"]["service_root"])
    issues = list(
        app.extensions.get("vectoplan_lv", {})
        .get("configuration", {})
        .get("issues", [])
    )

    missing_files = sorted(
        relative
        for relative in REQUIRED_FILES
        if not (service_root / relative).is_file()
    )
    missing_routes = sorted(REQUIRED_ROUTES - _registered_routes(app))
    if missing_files:
        issues.append(f"missing required files: {', '.join(missing_files)}")
    if missing_routes:
        issues.append(f"missing required routes: {', '.join(missing_routes)}")

    storage = get_storage_provider(app)
    state = {
        "status": "ok" if not issues else "error",
        "issues": issues,
        "missing_files": missing_files,
        "missing_routes": missing_routes,
        "storage_provider": storage.name,
    }
    app.extensions["vectoplan_lv"]["startup"] = state

    if issues and app.config.get("STARTUP_STRICT", False):
        raise RuntimeError("vectoplan-lv startup checks failed: " + " | ".join(issues))
    return state


__all__ = ["REQUIRED_FILES", "REQUIRED_ROUTES", "run_startup"]
