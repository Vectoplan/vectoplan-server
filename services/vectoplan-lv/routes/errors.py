"""Consistent JSON error responses."""

from __future__ import annotations

from typing import Any

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from src.lvs.errors import LvError


def _payload(code: str, message: str, **details: Any) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(LvError)
    def handle_lv_error(error: LvError):
        return jsonify(_payload(error.code, str(error))), error.status_code

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        return (
            jsonify(
                _payload(
                    error.name.lower().replace(" ", "_"),
                    error.description,
                )
            ),
            error.code,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception(
            "Unhandled request error on %s %s", request.method, request.path
        )
        return (
            jsonify(_payload("internal_error", "An internal error occurred")),
            500,
        )


__all__ = ["register_error_handlers"]
