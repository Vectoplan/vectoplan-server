from __future__ import annotations

from flask import Flask

from routes.cad import cad_api_bp, cad_ui_bp
from routes.health import health_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(cad_ui_bp)
    app.register_blueprint(
        cad_api_bp,
        url_prefix=str(app.config["ROUTE_PREFIX"]).rstrip("/"),
    )
