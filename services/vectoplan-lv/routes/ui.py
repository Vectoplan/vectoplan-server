"""Delivery route for the LV workspace."""

from flask import Blueprint, redirect, render_template, request, url_for


ui_bp = Blueprint("ui", __name__)


@ui_bp.get("/")
def index():
    return redirect(url_for("ui.lv_workspace"))


@ui_bp.get("/lv")
def lv_workspace():
    return render_template(
        "lv/workspace_v2.html",
        project_public_id=request.args.get("project_public_id", "1"),
    )


__all__ = ["ui_bp"]
