"""Application factory for the VECTOPLAN LV microservice."""

from __future__ import annotations

import logging
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, request

from extensions import init_extensions


SERVICE_ROOT = Path(__file__).resolve().parent
EXTENSION_NAMESPACE = "vectoplan_lv"


def _load_environment() -> None:
    """Load a service-local environment file without overriding real env vars."""
    load_dotenv(SERVICE_ROOT / ".env", override=False)


def _configure_logging(app: Flask) -> None:
    level_name = str(app.config.get("LOG_LEVEL", "INFO")).upper()
    app.logger.setLevel(getattr(logging, level_name, logging.INFO))


def _install_security_headers(app: Flask) -> None:
    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
        if request.path in {"/", "/lv"}:
            frame_ancestors = str(app.config["FRAME_ANCESTORS"]).strip()
            response.headers.setdefault(
                "Content-Security-Policy",
                f"frame-ancestors 'self' {frame_ancestors}",
            )
        return response


def _register_error_handlers(app: Flask) -> None:
    from routes.errors import register_error_handlers

    register_error_handlers(app)


def _register_blueprints(app: Flask) -> None:
    from routes import register_blueprints

    register_blueprints(app)


def _run_startup_checks(app: Flask) -> None:
    if not app.config.get("STARTUP_CHECKS_ENABLED", True):
        return

    from src.bootstrap.startup import run_startup

    run_startup(app)


def create_app(config_object: type | str | None = None) -> Flask:
    """Create and configure a complete service instance."""
    _load_environment()
    from config import get_config_class

    config_class = get_config_class(config_object)

    app = Flask(
        __name__,
        template_folder=str(SERVICE_ROOT / "templates"),
        static_folder=str(SERVICE_ROOT / "static"),
        static_url_path="/static",
    )
    app.config.from_object(config_class)
    app.json.sort_keys = False
    app.url_map.strict_slashes = False

    app.extensions.setdefault(
        EXTENSION_NAMESPACE,
        {
            "service": app.config["SERVICE_NAME"],
            "version": app.config["SERVICE_VERSION"],
            "config": config_class.__name__,
            "service_root": str(SERVICE_ROOT),
            "startup": {"status": "pending", "issues": []},
        },
    )
    validator = getattr(config_class, "validate", None)
    configuration_issues = list(validator()) if callable(validator) else []
    app.extensions[EXTENSION_NAMESPACE]["configuration"] = {
        "status": "ok" if not configuration_issues else "error",
        "issues": configuration_issues,
    }

    _configure_logging(app)
    _install_security_headers(app)
    init_extensions(app)
    _register_error_handlers(app)
    _register_blueprints(app)

    with app.app_context():
        _run_startup_checks(app)

    app.logger.info(
        "%s %s initialized with %s",
        app.config["SERVICE_NAME"],
        app.config["SERVICE_VERSION"],
        config_class.__name__,
    )
    return app


def _main() -> None:
    app = create_app()
    app.run(
        host=str(app.config["HOST"]),
        port=int(app.config["PORT"]),
        debug=bool(app.config["DEBUG"]),
    )


if __name__ == "__main__":
    _main()


__all__ = ["create_app"]
