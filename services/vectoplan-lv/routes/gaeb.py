"""HTTP endpoints for the independent GAEB DA XML 3.3 foundation."""

from __future__ import annotations

import re

from flask import Blueprint, Response, current_app, jsonify, request

from routes.context import resolve_project_public_id
from src.gaeb.service import export_lv_gaeb, import_gaeb
from src.lvs.errors import LvValidationError


gaeb_bp = Blueprint("gaeb", __name__, url_prefix="/v1/lvs")


def _safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip(".-")
    return cleaned[:80] or "leistungsverzeichnis"


@gaeb_bp.post("/<string:lv_id>/imports/gaeb")
def import_gaeb_file(lv_id: str):
    project_public_id = resolve_project_public_id()
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        raise LvValidationError("a GAEB file is required")
    maximum = int(current_app.config["MAX_CONTENT_LENGTH"])
    content = uploaded.stream.read(maximum + 1)
    if len(content) > maximum:
        raise LvValidationError("the GAEB file exceeds the configured upload limit")
    report = import_gaeb(
        project_public_id,
        lv_id,
        content,
        filename=uploaded.filename,
    )
    return jsonify(report), 201


@gaeb_bp.get("/<string:lv_id>/exports/gaeb")
def export_gaeb_file(lv_id: str):
    project_public_id = resolve_project_public_id()
    phase = str(request.args.get("phase") or "84")
    document, content = export_lv_gaeb(
        project_public_id,
        lv_id,
        phase=phase,
    )
    filename = f"{_safe_filename(document.name)}.X{phase}"
    return Response(
        content,
        mimetype="application/xml",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-GAEB-Version": "3.3",
            "X-GAEB-Phase": f"X{phase}",
        },
    )


__all__ = ["gaeb_bp"]
