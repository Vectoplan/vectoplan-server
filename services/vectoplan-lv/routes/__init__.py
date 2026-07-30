"""Central blueprint registry."""

from __future__ import annotations

from flask import Flask

from routes.billing import billing_bp
from routes.context import context_bp
from routes.gaeb import gaeb_bp
from routes.health import health_bp
from routes.items import items_bp
from routes.lvs import lvs_bp
from routes.ui import ui_bp


BLUEPRINTS = (
    health_bp,
    context_bp,
    lvs_bp,
    items_bp,
    billing_bp,
    gaeb_bp,
    ui_bp,
)


def register_blueprints(app: Flask) -> None:
    registered: list[str] = []
    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)
        registered.append(blueprint.name)

    app.extensions.setdefault("vectoplan_lv", {})["blueprints"] = registered


__all__ = ["BLUEPRINTS", "register_blueprints"]
