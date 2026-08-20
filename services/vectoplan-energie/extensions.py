"""Internal extension registry for the stateless preparation service."""

from __future__ import annotations

from datetime import datetime, timezone

from flask import Flask


def init_extensions(app: Flask) -> None:
    app.extensions.setdefault(
        "vectoplan_energie",
        {
            "initialized": True,
            "initialized_at": datetime.now(timezone.utc).isoformat(),
            "stateful_storage": False,
            "integrations_enabled": bool(app.config["INTEGRATIONS_ENABLED"]),
            "startup": {},
        },
    )


__all__ = ["init_extensions"]
