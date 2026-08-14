from __future__ import annotations

import logging
import os
from pathlib import Path

from flask import Flask, redirect, url_for
from dotenv import load_dotenv

from config import resolve_config
from extensions import init_extensions
from routes import register_blueprints
from src.bootstrap.startup import run_startup_checks


SERVICE_ROOT = Path(__file__).resolve().parent


def create_app(config_name: str | None = None) -> Flask:
    load_dotenv(SERVICE_ROOT / ".env", override=False)

    app = Flask(
        __name__,
        template_folder=str(SERVICE_ROOT / "templates"),
        static_folder=str(SERVICE_ROOT / "static"),
    )
    app.config.from_object(resolve_config(config_name))

    logging.basicConfig(
        level=getattr(logging, str(app.config.get("LOG_LEVEL", "INFO")).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    init_extensions(app)
    register_blueprints(app)

    @app.get("/")
    def root_redirect():
        return redirect(url_for("cad.index"))

    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; frame-ancestors *",
        )
        return response

    run_startup_checks(app, service_root=SERVICE_ROOT)
    from vectoplan_i18n import init_app as init_i18n
    init_i18n(app)
    return app


if __name__ == "__main__":
    application = create_app(os.getenv("VECTOPLAN_CAD_CONFIG"))
    application.run(
        host=application.config["HOST"],
        port=application.config["PORT"],
        debug=application.config["DEBUG"],
    )
