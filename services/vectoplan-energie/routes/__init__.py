"""Central blueprint registry for VECTOPLAN Energie."""

from __future__ import annotations

from flask import Flask

from routes.energie import energie_api_bp, energie_ui_bp
from routes.health import health_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(energie_ui_bp)
    app.register_blueprint(
        energie_api_bp,
        url_prefix=str(app.config["ROUTE_PREFIX"]).rstrip("/"),
    )
    app.extensions["vectoplan_energie"]["blueprints"] = [
        "health",
        "energie",
        "energie_api",
    ]


__all__ = ["register_blueprints"]
