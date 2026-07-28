from __future__ import annotations

from pathlib import Path

from flask import Flask


def run_startup_checks(app: Flask, service_root: Path) -> None:
    required = [
        service_root / "templates" / "cad" / "index.html",
        service_root / "static" / "cad" / "css" / "main.css",
        service_root / "static" / "cad" / "js" / "main.js",
        Path(app.config["TEST_INPUT_PATH"]),
        Path(app.config["PLAN_PROFILE_PATH"]),
        Path(app.config["CONTRACT_SCHEMA_PATH"]),
        Path(app.config["COMMAND_SCHEMA_PATH"]),
        Path(app.config["EXPORT_SCHEMA_PATH"]),
    ]

    missing = [str(path) for path in required if not path.exists()]
    startup = {
        "ready": not missing,
        "missing": missing,
        "mock_mode": bool(app.config["MOCK_MODE"]),
        "stateful_storage": False,
    }
    app.extensions["vectoplan_cad"]["startup"] = startup

    if missing:
        message = f"Missing required CAD files: {', '.join(missing)}"
        app.logger.error(message)
        if app.config["STRICT_STARTUP"]:
            raise RuntimeError(message)
