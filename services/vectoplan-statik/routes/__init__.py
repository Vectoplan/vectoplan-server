"""Central blueprint registry."""

from __future__ import annotations

from flask import Flask

from routes.health import health_bp
from routes.statik import statik_api_bp, statik_ui_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(statik_ui_bp)
    app.register_blueprint(
        statik_api_bp,
        url_prefix=str(app.config["ROUTE_PREFIX"]).rstrip("/"),
    )
    app.extensions["vectoplan_statik"]["blueprints"] = [
        "health",
        "statik",
        "statik_api",
    ]


__all__ = ["register_blueprints"]
