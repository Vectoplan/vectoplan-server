from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.scene.service import build_scene


SUPPORTED_ELEMENT_KINDS = {
    "dimension",
    "line",
    "opening",
    "room_label",
    "structure",
    "text",
    "wall",
}


def load_json_file(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_projection_input(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["payload must be a JSON object"]

    errors: list[str] = []
    contract_version = _require_non_empty_string(payload, "contract_version", "$", errors)
    if contract_version and contract_version != "cad-projection/0.1":
        errors.append("$.contract_version must be cad-projection/0.1")

    document = payload.get("document")
    if not isinstance(document, dict):
        errors.append("$.document must be an object")
    else:
        for key in ("document_ref", "project_ref", "source_revision_ref"):
            _require_non_empty_string(document, key, "$.document", errors)
        if not isinstance(document.get("plan_profile"), dict):
            errors.append("$.document.plan_profile must be an object")

    sheets = payload.get("sheets")
    if not isinstance(sheets, list):
        errors.append("$.sheets must be an array")
        return errors
    if not sheets:
        errors.append("$.sheets must contain at least one sheet")
        return errors

    sheet_refs: set[str] = set()
    for sheet_index, sheet in enumerate(sheets):
        path = f"$.sheets[{sheet_index}]"
        if not isinstance(sheet, dict):
            errors.append(f"{path} must be an object")
            continue

        sheet_ref = _require_non_empty_string(sheet, "sheet_ref", path, errors)
        if sheet_ref:
            if sheet_ref in sheet_refs:
                errors.append(f"{path}.sheet_ref must be unique")
            sheet_refs.add(sheet_ref)

        _require_non_empty_string(sheet, "format", path, errors)
        for key in ("width_mm", "height_mm"):
            _require_positive_number(sheet, key, path, errors)

        viewports = sheet.get("viewports")
        if not isinstance(viewports, list):
            errors.append(f"{path}.viewports must be an array")
            viewports = []
        elif not viewports:
            errors.append(f"{path}.viewports must contain at least one viewport")

        viewport_refs: set[str] = set()
        for viewport_index, viewport in enumerate(viewports):
            viewport_path = f"{path}.viewports[{viewport_index}]"
            if not isinstance(viewport, dict):
                errors.append(f"{viewport_path} must be an object")
                continue
            viewport_ref = _require_non_empty_string(
                viewport, "viewport_ref", viewport_path, errors
            )
            if viewport_ref:
                if viewport_ref in viewport_refs:
                    errors.append(f"{viewport_path}.viewport_ref must be unique within the sheet")
                viewport_refs.add(viewport_ref)
            _require_non_empty_string(viewport, "kind", viewport_path, errors)
            _validate_rect(viewport.get("sheet_rect_mm"), f"{viewport_path}.sheet_rect_mm", errors)
            if viewport.get("kind") != "legend":
                _validate_rect(
                    viewport.get("model_view_box_mm"),
                    f"{viewport_path}.model_view_box_mm",
                    errors,
                )

        elements = sheet.get("elements")
        if not isinstance(elements, list):
            errors.append(f"{path}.elements must be an array")
            continue

        element_refs: set[str] = set()
        for element_index, element in enumerate(elements):
            element_path = f"{path}.elements[{element_index}]"
            if not isinstance(element, dict):
                errors.append(f"{element_path} must be an object")
                continue
            element_ref = _require_non_empty_string(
                element, "element_ref", element_path, errors
            )
            if element_ref:
                if element_ref in element_refs:
                    errors.append(f"{element_path}.element_ref must be unique within the sheet")
                element_refs.add(element_ref)

            kind = _require_non_empty_string(element, "kind", element_path, errors)
            if kind and kind not in SUPPORTED_ELEMENT_KINDS:
                errors.append(
                    f"{element_path}.kind '{kind}' is not supported; "
                    f"expected one of {', '.join(sorted(SUPPORTED_ELEMENT_KINDS))}"
                )
            _require_non_empty_string(element, "layer", element_path, errors)

            view_refs = element.get("view_refs")
            if not isinstance(view_refs, list) or not view_refs:
                errors.append(f"{element_path}.view_refs must be a non-empty array")
            else:
                unknown_refs = [
                    ref for ref in view_refs if not isinstance(ref, str) or ref not in viewport_refs
                ]
                if unknown_refs:
                    errors.append(
                        f"{element_path}.view_refs contains unknown viewport references: "
                        f"{', '.join(map(str, unknown_refs))}"
                    )
            _validate_geometry(kind, element.get("geometry"), f"{element_path}.geometry", errors)

    return errors


def build_preview(payload: dict[str, Any]) -> dict[str, Any]:
    sheets = payload.get("sheets", [])
    return {
        "ok": True,
        "contract_version": payload.get("contract_version"),
        "document_ref": payload.get("document", {}).get("document_ref"),
        "sheet_count": len(sheets),
        "viewport_count": sum(len(sheet.get("viewports", [])) for sheet in sheets),
        "element_count": sum(len(sheet.get("elements", [])) for sheet in sheets),
        "projection": payload,
        "scene": build_scene(payload),
        "stateful_storage": False,
    }


def build_bootstrap_payload(config: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "service": config["SERVICE_NAME"],
        "version": config["SERVICE_VERSION"],
        "contract_version": config["CONTRACT_VERSION"],
        "mock_mode": config["MOCK_MODE"],
        "stateful_storage": False,
        "routes": {
            "test_input": f"{config['ROUTE_PREFIX']}/test-input",
            "preview": f"{config['ROUTE_PREFIX']}/preview",
            "commands": f"{config['ROUTE_PREFIX']}/commands",
            "exports": f"{config['ROUTE_PREFIX']}/exports",
            "plan_profiles": f"{config['ROUTE_PREFIX']}/plan-profiles",
        },
        "capabilities": {
            "plan_sheet": True,
            "multiple_viewports": True,
            "selection": True,
            "inspector": True,
            "scene_graph": "cad-scene/0.1",
            "layers": True,
            "snap_grid": True,
            "local_undo_redo": True,
            "cad_tools": ["select", "create_wall", "create_line", "create_dimension"],
            "commands": "validated_stateless_draft",
            "exports": ["pdf", "dxf", "dwg", "svg"],
            "core_connection": False,
            "persistence": False,
        },
    }


def _require_non_empty_string(
    value: dict[str, Any], key: str, path: str, errors: list[str]
) -> str | None:
    candidate = value.get(key)
    if not isinstance(candidate, str) or not candidate.strip():
        errors.append(f"{path}.{key} must be a non-empty string")
        return None
    return candidate


def _require_positive_number(
    value: dict[str, Any], key: str, path: str, errors: list[str]
) -> float | None:
    candidate = value.get(key)
    if not _is_number(candidate) or candidate <= 0:
        errors.append(f"{path}.{key} must be a number greater than zero")
        return None
    return float(candidate)


def _validate_rect(value: Any, path: str, errors: list[str]) -> None:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return
    for key in ("x", "y"):
        if not _is_number(value.get(key)):
            errors.append(f"{path}.{key} must be a number")
    for key in ("width", "height"):
        if not _is_number(value.get(key)) or value[key] <= 0:
            errors.append(f"{path}.{key} must be a number greater than zero")


def _validate_geometry(kind: str | None, value: Any, path: str, errors: list[str]) -> None:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return
    if kind in {"wall", "line", "dimension"}:
        _validate_point(value.get("start_mm"), f"{path}.start_mm", errors)
        _validate_point(value.get("end_mm"), f"{path}.end_mm", errors)
    if kind == "wall":
        _require_positive_number(value, "thickness_mm", path, errors)
    if kind in {"opening", "structure"}:
        for key in ("x_mm", "y_mm"):
            if not _is_number(value.get(key)):
                errors.append(f"{path}.{key} must be a number")
        for key in ("width_mm", "height_mm"):
            if not _is_number(value.get(key)) or value[key] <= 0:
                errors.append(f"{path}.{key} must be a number greater than zero")
    if kind in {"room_label", "text"}:
        for key in ("x_mm", "y_mm"):
            if not _is_number(value.get(key)):
                errors.append(f"{path}.{key} must be a number")


def _validate_point(value: Any, path: str, errors: list[str]) -> None:
    if (
        not isinstance(value, list)
        or len(value) != 2
        or not all(_is_number(coordinate) for coordinate in value)
    ):
        errors.append(f"{path} must be a two-number array")


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)