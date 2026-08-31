from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.scene.service import build_scene


SUPPORTED_ELEMENT_KINDS = {
    "dimension",
    "line",
    "opening",
    "room",
    "room_label",
    "roof",
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
            geometry = element.get("geometry")
            # Semantic Core snapshots can carry `form` at element level while
            # legacy CAD snapshots keep it inside geometry.  Validate the
            # effective geometry contract used by the scene resolver.
            if (
                isinstance(geometry, dict)
                and not isinstance(geometry.get("form"), str)
                and isinstance(element.get("form"), str)
            ):
                geometry = {**geometry, "form": element["form"]}
            _validate_geometry(kind, geometry, f"{element_path}.geometry", errors)

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
            "library_catalog": f"{config['ROUTE_PREFIX']}/library/catalog",
            "exports": f"{config['ROUTE_PREFIX']}/exports",
            "plan_profiles": f"{config['ROUTE_PREFIX']}/plan-profiles",
            "core_projection": f"{config['ROUTE_PREFIX']}/core/projects/<core_project_id>/projection",
            "core_import_projection": f"{config['ROUTE_PREFIX']}/core/projects/<core_project_id>/imports/<document_id>/projection",
            "automatic_dimensions": f"{config['ROUTE_PREFIX']}/automation/dimensions/calculate",
            "parametric_roof": f"{config['ROUTE_PREFIX']}/automation/roof/calculate",
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
            "cad_tools": [
                "select",
                "world_selection",
                "create_wall",
                "create_opening",
                "place_library_object",
                "create_room",
                "create_roof",
                "update_roof",
                "delete_selection",
                "create_line",
                "create_dimension",
            ],
            "library_only_placement": True,
            "world_edit": "cad-worldedit/0.1",
            "room_zones": "vectoplan-space-room/0.1",
            "automatic_dimensions": "cad-auto-dimension-result/0.1",
            "parametric_roof": "cad-roof-calculation-result/0.1",
            "model_command_bridge": "vectoplan-model-command/0.1",
            "commands": (
                "core_chunk_persistent"
                if bool(config.get("CORE_INTERNAL_URL"))
                else "validated_stateless_draft"
            ),
            "exports": ["pdf", "dxf", "dwg", "svg"],
            "core_connection": bool(config.get("CORE_INTERNAL_URL")),
            "persistence": bool(config.get("CORE_INTERNAL_URL")),
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
    form = value.get("form")
    if isinstance(form, str):
        _validate_semantic_geometry(form, value, path, errors)
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
    if kind == "room":
        points = value.get("points_mm")
        if isinstance(points, list):
            _validate_points(points, f"{path}.points_mm", errors, minimum=3)
            if not _is_number(value.get("area_m2")) or value["area_m2"] <= 0:
                errors.append(f"{path}.area_m2 must be a number greater than zero")
            _validate_point(value.get("label_point_mm"), f"{path}.label_point_mm", errors)
            _require_positive_number(value, "height_mm", path, errors)
        else:
            for key in ("x_mm", "y_mm"):
                if not _is_number(value.get(key)):
                    errors.append(f"{path}.{key} must be a number")
            for key in ("width_mm", "depth_mm", "height_mm"):
                if not _is_number(value.get(key)) or value[key] <= 0:
                    errors.append(f"{path}.{key} must be a number greater than zero")


def _validate_semantic_geometry(
    form: str, value: dict[str, Any], path: str, errors: list[str]
) -> None:
    if form == "line_segment":
        _validate_point(value.get("start_mm"), f"{path}.start_mm", errors)
        _validate_point(value.get("end_mm"), f"{path}.end_mm", errors)
        _require_positive_number(value, "thickness_mm", path, errors)
        return
    if form in {"polyline", "closed_polyline", "rectangle"}:
        _validate_points(value.get("path_mm"), f"{path}.path_mm", errors, minimum=2)
        _require_positive_number(value, "thickness_mm", path, errors)
        return
    if form == "network":
        segments = value.get("segments_mm")
        if not isinstance(segments, list) or not segments:
            errors.append(f"{path}.segments_mm must be a non-empty array")
        else:
            for index, segment in enumerate(segments):
                _validate_points(segment, f"{path}.segments_mm[{index}]", errors, minimum=2, exact=2)
        paths = value.get("paths_mm")
        if paths is not None and not isinstance(paths, list):
            errors.append(f"{path}.paths_mm must be an array when provided")
        elif isinstance(paths, list):
            for index, network_path in enumerate(paths):
                _validate_points(network_path, f"{path}.paths_mm[{index}]", errors, minimum=2)
        nodes = value.get("nodes_mm")
        if nodes is not None and (not isinstance(nodes, list) or not nodes):
            errors.append(f"{path}.nodes_mm must be a non-empty array when provided")
        elif isinstance(nodes, list):
            for index, node in enumerate(nodes):
                node_path = f"{path}.nodes_mm[{index}]"
                if not isinstance(node, dict):
                    errors.append(f"{node_path} must be an object")
                    continue
                _validate_point(node.get("point_mm"), f"{node_path}.point_mm", errors)
                if not isinstance(node.get("degree"), int) or node["degree"] < 0:
                    errors.append(f"{node_path}.degree must be a non-negative integer")
        _require_positive_number(value, "thickness_mm", path, errors)
        return
    if form in {"arc", "circle"}:
        _validate_point(value.get("center_mm"), f"{path}.center_mm", errors)
        for key in ("radius_mm", "thickness_mm"):
            _require_positive_number(value, key, path, errors)
        for key in ("start_angle_deg", "sweep_angle_deg"):
            if not _is_number(value.get(key)):
                errors.append(f"{path}.{key} must be a number")
        return
    if form == "region":
        outer_ring = value.get("outer_ring_mm")
        if outer_ring is None:
            # An unresolved semantic placeholder can omit its ring entirely.
            return
        if isinstance(outer_ring, list) and len(outer_ring) < 3:
            # Core can retain semantic placeholders before their footprint is
            # resolved.  They are intentionally invisible and must not reject
            # an otherwise renderable CAD sheet.
            for index, point in enumerate(outer_ring):
                _validate_point(point, f"{path}.outer_ring_mm[{index}]", errors)
            return
        _validate_points(outer_ring, f"{path}.outer_ring_mm", errors, minimum=3)
        return
    if form == "discrete":
        for key in ("x_mm", "y_mm"):
            if not _is_number(value.get(key)):
                errors.append(f"{path}.{key} must be a number")
        for key in ("width_mm", "height_mm"):
            _require_positive_number(value, key, path, errors)
        return
    errors.append(f"{path}.form '{form}' is not supported")


def _validate_points(
    value: Any,
    path: str,
    errors: list[str],
    *,
    minimum: int,
    exact: int | None = None,
) -> None:
    if not isinstance(value, list) or (exact is not None and len(value) != exact) or len(value) < minimum:
        expected = f"exactly {exact}" if exact is not None else f"at least {minimum}"
        errors.append(f"{path} must contain {expected} points")
        return
    for index, point in enumerate(value):
        _validate_point(point, f"{path}[{index}]", errors)


def _validate_point(value: Any, path: str, errors: list[str]) -> None:
    if (
        not isinstance(value, list)
        or len(value) != 2
        or not all(_is_number(coordinate) for coordinate in value)
    ):
        errors.append(f"{path} must be a two-number array")


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)
