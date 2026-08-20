"""Application factory for the standalone VECTOPLAN energy workspace."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, redirect, request, url_for

from config import resolve_config
from extensions import init_extensions
from routes import register_blueprints
from src.bootstrap.startup import run_startup_checks


SERVICE_ROOT = Path(__file__).resolve().parent


def create_app(config_name: str | None = None) -> Flask:
    """Create a configured service without activating external integrations."""
    load_dotenv(SERVICE_ROOT / ".env", override=False)

    app = Flask(
        __name__,
        template_folder=str(SERVICE_ROOT / "templates"),
        static_folder=str(SERVICE_ROOT / "static"),
    )
    app.config.from_object(resolve_config(config_name))
    app.json.sort_keys = False
    app.url_map.strict_slashes = False

    logging.basicConfig(
        level=getattr(
            logging,
            str(app.config.get("LOG_LEVEL", "INFO")).upper(),
            logging.INFO,
        ),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    init_extensions(app)
    register_blueprints(app)

    @app.get("/")
    def root_redirect():
        return redirect(url_for("energie.index"))

    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            f"img-src 'self' data:; connect-src {app.config['CONNECT_SOURCES']}; font-src 'self'; "
            f"frame-src {app.config['FRAME_SOURCES']}; "
            f"frame-ancestors {app.config['FRAME_ANCESTORS']}",
        )
        if request.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    run_startup_checks(app, SERVICE_ROOT)
    return app


if __name__ == "__main__":
    application = create_app(os.getenv("VECTOPLAN_ENERGIE_CONFIG"))
    application.run(
        host=application.config["HOST"],
        port=application.config["PORT"],
        debug=application.config["DEBUG"],
    )


__all__ = ["create_app"]
