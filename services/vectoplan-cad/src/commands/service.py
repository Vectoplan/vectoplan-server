from __future__ import annotations

from copy import deepcopy
from math import hypot
from typing import Any, Mapping

from src.library.client import resolve_catalog_item
from src.automation.roof import RoofCalculationError, calculate_roof


SUPPORTED_COMMANDS = {
    "create_dimension",
    "create_line",
    "create_opening",
    "create_room",
    "create_roof",
    "create_section_marker",
    "create_wall",
    "place_library_object",
    "update_room",
    "update_roof",
}

LIBRARY_COMMANDS = {
    "create_opening",
    "create_room",
    "create_wall",
    "place_library_object",
    "update_room",
}

ROOF_COMMANDS = {"create_roof", "update_roof"}
MODEL_CHANGING_COMMANDS = LIBRARY_COMMANDS | ROOF_COMMANDS


def validate_cad_command(payload: Any, *, catalog: Mapping[str, Any] | None = None) -> list[str]:
    if not isinstance(payload, dict):
        return ["payload must be a JSON object"]

    errors: list[str] = []
    for key in (
        "contract_version",
        "command",
        "document_ref",
        "sheet_ref",
        "viewport_ref",
        "base_revision_ref",
        "client_command_id",
    ):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            errors.append(f"$.{key} must be a non-empty string")

    if payload.get("contract_version") not in {None, "cad-command/0.1", "cad-command/0.2"}:
        errors.append("$.contract_version must be cad-command/0.1 or cad-command/0.2")

    command = payload.get("command")
    if isinstance(command, str) and command not in SUPPORTED_COMMANDS:
        errors.append(
            f"$.command '{command}' is not supported; "
            f"expected one of {', '.join(sorted(SUPPORTED_COMMANDS))}"
        )

    geometry = payload.get("geometry")
    if not isinstance(geometry, dict):
        errors.append("$.geometry must be an object")
    else:
        _validate_point(geometry.get("start_mm"), "$.geometry.start_mm", errors)
        _validate_point(geometry.get("end_mm"), "$.geometry.end_mm", errors)
        if _valid_point(geometry.get("start_mm")) and _valid_point(geometry.get("end_mm")):
            if geometry["start_mm"] == geometry["end_mm"]:
                errors.append("$.geometry start_mm and end_mm must not be identical")

    parameters = payload.get("parameters", {})
    if parameters is not None and not isinstance(parameters, dict):
        errors.append("$.parameters must be an object")
    if command == "create_wall":
        thickness = parameters.get("thickness_mm") if isinstance(parameters, dict) else None
        if not _is_number(thickness) or thickness <= 0:
            errors.append("$.parameters.thickness_mm must be a number greater than zero")

    if command in LIBRARY_COMMANDS:
        _validate_library_selection(payload, catalog, errors)

    if command == "create_opening":
        opening_height = parameters.get("height_mm") if isinstance(parameters, dict) else None
        host_wall_ref = parameters.get("host_wall_ref") if isinstance(parameters, dict) else None
        host_thickness = parameters.get("host_wall_thickness_mm") if isinstance(parameters, dict) else None
        if not _is_number(opening_height) or opening_height <= 0:
            errors.append("$.parameters.height_mm must be a number greater than zero")
        if not isinstance(host_wall_ref, str) or not host_wall_ref.strip():
            errors.append("$.parameters.host_wall_ref must reference an existing wall")
        if not _is_number(host_thickness) or host_thickness <= 0:
            errors.append("$.parameters.host_wall_thickness_mm must be a number greater than zero")

    if command == "place_library_object":
        thickness = parameters.get("thickness_mm") if isinstance(parameters, dict) else None
        if not _is_number(thickness) or thickness <= 0:
            errors.append("$.parameters.thickness_mm must be a number greater than zero")

    if command in {"create_room", "update_room"}:
        height = parameters.get("height_mm") if isinstance(parameters, dict) else None
        room_type = parameters.get("room_type") if isinstance(parameters, dict) else None
        label = parameters.get("label") if isinstance(parameters, dict) else None
        if not _is_number(height) or height <= 0:
            errors.append("$.parameters.height_mm must be a number greater than zero")
        if not isinstance(room_type, str) or not room_type.strip():
            errors.append("$.parameters.room_type must be a non-empty string")
        if not isinstance(label, str) or not label.strip():
            errors.append("$.parameters.label must be a non-empty string")
        points = geometry.get("points_mm") if isinstance(geometry, dict) else None
        if points is not None:
            if not isinstance(points, list) or len(points) < 3:
                errors.append("$.geometry.points_mm must contain at least three points")
            else:
                for index, point in enumerate(points):
                    _validate_point(point, f"$.geometry.points_mm[{index}]", errors)
                if all(_valid_point(point) for point in points) and _polygon_metrics(points)[0] <= 0:
                    errors.append("$.geometry.points_mm must describe a non-zero room area")

    if command in ROOF_COMMANDS:
        points = geometry.get("points_mm") if isinstance(geometry, dict) else None
        if not isinstance(points, list) or len(points) < 3:
            errors.append("$.geometry.points_mm must contain at least three roof-area points")
        else:
            for index, point in enumerate(points):
                _validate_point(point, f"$.geometry.points_mm[{index}]", errors)
            if all(_valid_point(point) for point in points) and _polygon_metrics(points)[0] <= 0:
                errors.append("$.geometry.points_mm must describe a non-zero roof area")
        roof_request = parameters.get("roof_request") if isinstance(parameters, dict) else None
        if not isinstance(roof_request, Mapping):
            errors.append("$.parameters.roof_request must contain the parametric roof request")
        else:
            try:
                calculate_roof(roof_request)
            except RoofCalculationError as exc:
                errors.extend(f"$.parameters.roof_request: {error}" for error in exc.errors)
        if command == "update_roof":
            target_object_instance_id = parameters.get("target_object_instance_id") if isinstance(parameters, dict) else None
            target_anchor = parameters.get("target_anchor") if isinstance(parameters, dict) else None
            if not isinstance(target_object_instance_id, str) or not target_object_instance_id.strip():
                errors.append("$.parameters.target_object_instance_id must reference the persistent roof")
            if not isinstance(target_anchor, Mapping) or not all(
                _is_number(target_anchor.get(axis)) for axis in ("x", "y", "z")
            ):
                errors.append("$.parameters.target_anchor must contain numeric x, y and z coordinates")

    return errors


def build_command_receipt(
    payload: dict[str, Any], *, catalog: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    command = deepcopy(payload)
    command["contract_version"] = "cad-command/0.2"
    selected_item = _selected_catalog_item(command, catalog)
    if selected_item:
        command["library_context"] = _library_snapshot(selected_item)
    if command.get("command") in ROOF_COMMANDS:
        command.setdefault("parameters", {})["roof_calculation"] = calculate_roof(
            command["parameters"]["roof_request"]
        )
    return {
        "ok": True,
        "accepted": False,
        "processable": True,
        "placeholder": False,
        "command_id": command["client_command_id"],
        "dispatch": "core_unavailable",
        "message": (
            "CadCommand ist gültig und wurde als lokaler Entwurf übernommen. "
            "Ohne Core-Verbindung wird er nicht persistiert."
        ),
        "command": command,
        "preview_element": _build_preview_element(command),
        "mutation_intent": _build_mutation_intent(command),
        "stateful_storage": False,
    }


def _build_preview_element(command: dict[str, Any]) -> dict[str, Any]:
    command_name = command["command"]
    kind_by_command = {
        "create_wall": "wall",
        "create_line": "line",
        "create_dimension": "dimension",
        "create_section_marker": "line",
        "create_opening": "opening",
        "place_library_object": "structure",
        "create_room": "room",
        "update_room": "room",
        "create_roof": "roof",
        "update_roof": "roof",
    }
    layer_by_command = {
        "create_wall": "walls",
        "create_line": "annotations",
        "create_dimension": "dimensions",
        "create_section_marker": "annotations",
        "create_opening": "openings",
        "place_library_object": "structure",
        "create_room": "rooms",
        "update_room": "rooms",
        "create_roof": "construction_roof",
        "update_roof": "construction_roof",
    }
    labels = {
        "create_wall": "Lokaler Wandentwurf",
        "create_line": "Lokaler Linienentwurf",
        "create_dimension": "Lokale Maßkette",
        "create_section_marker": "Lokale Schnittmarke",
        "create_opening": "Lokale Öffnung",
        "place_library_object": "Lokales Library-Bauteil",
        "create_room": "Lokaler Raum",
        "update_room": "Geänderter Raum",
        "create_roof": "Parametrisches Dach",
        "update_roof": "Geändertes parametrisches Dach",
    }
    geometry = deepcopy(command["geometry"])
    if command_name == "create_wall":
        geometry["thickness_mm"] = command["parameters"]["thickness_mm"]
    if command_name in {"create_opening", "place_library_object"}:
        geometry["form"] = "line_segment"
        geometry["thickness_mm"] = max(
            20,
            float(
                command.get("parameters", {}).get("host_wall_thickness_mm")
                if command_name == "create_opening"
                else command.get("parameters", {}).get("thickness_mm")
                or 120
            ),
        )
    if command_name in {"create_room", "update_room"}:
        points = geometry.get("points_mm")
        if isinstance(points, list) and len(points) >= 3:
            area_mm2, centroid = _polygon_metrics(points)
            geometry = {
                "points_mm": deepcopy(points),
                "label_point_mm": centroid,
                "height_mm": command["parameters"]["height_mm"],
                "area_m2": round(area_mm2 / 1_000_000, 2),
            }
        else:
            start = geometry["start_mm"]
            end = geometry["end_mm"]
            x_min, x_max = sorted((start[0], end[0]))
            y_min, y_max = sorted((start[1], end[1]))
            width = x_max - x_min
            depth = y_max - y_min
            geometry = {
                "x_mm": x_min,
                "y_mm": y_min,
                "width_mm": width,
                "depth_mm": depth,
                "height_mm": command["parameters"]["height_mm"],
                "area_m2": round(width * depth / 1_000_000, 2),
            }
    if command_name in ROOF_COMMANDS:
        calculation = command.get("parameters", {}).get("roof_calculation", {})
        roof_geometry = calculation.get("geometry", {}) if isinstance(calculation, Mapping) else {}
        source_points = roof_geometry.get("source_footprint_mm") if isinstance(roof_geometry, Mapping) else None
        coverage_points = roof_geometry.get("roof_coverage_polygon_mm") if isinstance(roof_geometry, Mapping) else None
        geometry = {
            "points_mm": deepcopy(source_points if isinstance(source_points, list) else command["geometry"].get("points_mm", [])),
            "coverage_points_mm": deepcopy(coverage_points if isinstance(coverage_points, list) else []),
            "ridge_line_mm": deepcopy(roof_geometry.get("ridge_line_mm", []) if isinstance(roof_geometry, Mapping) else []),
            "roof_calculation": deepcopy(calculation),
            "area_m2": round(_polygon_metrics(command["geometry"].get("points_mm", []))[0] / 1_000_000, 2),
        }

    element: dict[str, Any] = {
        "element_ref": f"draft_{command['client_command_id']}",
        "label": labels[command_name],
        "kind": kind_by_command[command_name],
        "layer": layer_by_command[command_name],
        "source": "local_cad_command",
        "view_refs": [command["viewport_ref"]],
        "geometry": geometry,
        "local_draft": True,
        "command_ref": command["client_command_id"],
        "storey_id": str(command.get("parameters", {}).get("storey_id") or "ground_floor"),
    }
    if command_name == "create_wall":
        element["family_ref"] = command.get("family_ref", "hochbau.waende.ziegelwand")
        element["variant_ref"] = command.get("variant_ref", "24cm_tragend")
    if command_name in LIBRARY_COMMANDS:
        element["family_ref"] = command.get("family_ref")
        element["variant_ref"] = command.get("variant_ref")
        element["library_context"] = deepcopy(command.get("library_context") or {})
    if command_name in {"create_opening", "place_library_object"}:
        element["label"] = str(command.get("library_context", {}).get("label") or labels[command_name])
    if command_name == "create_opening":
        context = command.get("library_context", {})
        descriptor = " ".join(str(context.get(key) or "") for key in (
            "label", "family_ref", "category", "subcategory", "object_kind"
        )).lower()
        element["semantic_role"] = "window" if "fenster" in descriptor or "window" in descriptor else "door"
        element["host_wall_ref"] = command.get("parameters", {}).get("host_wall_ref")
        element["host_wall_thickness_mm"] = command.get("parameters", {}).get("host_wall_thickness_mm")
    if command_name in {"create_room", "update_room"}:
        label = str(command.get("parameters", {}).get("label") or "Raum")
        element["label"] = label
        element["text"] = f"{label}\n{geometry['area_m2']:.2f} m²"
        element["semantic_role"] = "energy_zone"
        element["room_type"] = command.get("parameters", {}).get("room_type")
    if command_name in ROOF_COMMANDS:
        calculation = command.get("parameters", {}).get("roof_calculation", {})
        element["label"] = f"Parametrisches Dach · {calculation.get('roof_type', 'gable')}"
        element["semantic_role"] = "roof"
        element["roof_type"] = calculation.get("roof_type")
        element["roof_request"] = deepcopy(command.get("parameters", {}).get("roof_request", {}))
        element["roof_calculation"] = deepcopy(calculation)
    if command_name == "create_dimension":
        start = geometry["start_mm"]
        end = geometry["end_mm"]
        element["text"] = f"{hypot(end[0] - start[0], end[1] - start[1]):.0f} mm"
    if command_name == "create_section_marker":
        element["text"] = command.get("parameters", {}).get("label", "A–A")
    return element


def _validate_library_selection(
    payload: Mapping[str, Any], catalog: Mapping[str, Any] | None, errors: list[str]
) -> None:
    family_ref = payload.get("family_ref")
    variant_ref = payload.get("variant_ref")
    if not isinstance(family_ref, str) or not family_ref.strip():
        errors.append("$.family_ref must reference a Creative Library family")
        return
    if not isinstance(variant_ref, str) or not variant_ref.strip():
        errors.append("$.variant_ref must reference a Creative Library variant")
        return
    if not catalog:
        errors.append("Creative Library catalog is required for model-changing commands")
        return
    selected = resolve_catalog_item(catalog, family_ref, variant_ref)
    if selected is None:
        errors.append("$.family_ref/variant_ref is not contained in the Creative Library catalog")
        return
    placement_kind = selected.get("placement_kind")
    command = payload.get("command")
    compatible = {
        "create_wall": {"linear"},
        "create_opening": {"opening"},
        "place_library_object": {"linear", "object"},
        "create_room": {"room"},
        "update_room": {"room"},
    }
    if placement_kind not in compatible.get(str(command), set()):
        errors.append(
            f"Creative Library item placement_kind '{placement_kind}' is incompatible with {command}"
        )


def _selected_catalog_item(
    command: Mapping[str, Any], catalog: Mapping[str, Any] | None
) -> dict[str, Any] | None:
    if command.get("command") not in LIBRARY_COMMANDS or not catalog:
        return None
    return resolve_catalog_item(
        catalog,
        str(command.get("family_ref") or ""),
        str(command.get("variant_ref") or ""),
    )


def _library_snapshot(item: Mapping[str, Any]) -> dict[str, Any]:
    variant = item.get("selected_variant") if isinstance(item.get("selected_variant"), Mapping) else {}
    return {
        "contract_version": "cad-library-selection/0.1",
        "catalog_item_id": item.get("catalog_item_id"),
        "family_ref": item.get("family_ref"),
        "package_ref": item.get("package_ref"),
        "vplib_uid": item.get("vplib_uid"),
        "runtime_block_type_id": item.get("runtime_block_type_id"),
        "variant_ref": variant.get("variant_ref") or item.get("variant_ref"),
        "revision_hash": item.get("revision_hash"),
        "label": item.get("label"),
        "object_kind": item.get("object_kind"),
        "placement_kind": item.get("placement_kind"),
        "domain": item.get("domain"),
        "category": item.get("category"),
        "subcategory": item.get("subcategory"),
        "placement_command": deepcopy(item.get("placement_command") or {}),
        "dimensions": deepcopy(variant.get("dimensions") or item.get("dimensions") or {}),
        "source": item.get("source"),
    }


def _build_mutation_intent(command: Mapping[str, Any]) -> dict[str, Any]:
    model_changing = command.get("command") in MODEL_CHANGING_COMMANDS
    return {
        "contract_version": "vectoplan-model-command/0.1",
        "model_changing": model_changing,
        "source_surface": "cad-2d",
        "target_surfaces": ["vectoplan-core", "vectoplan-chunk", "vectoplan-editor-3d"] if model_changing else ["cad-2d"],
        "base_revision_ref": command.get("base_revision_ref"),
        "client_command_id": command.get("client_command_id"),
        "semantic_command": command.get("command"),
        "library_context": deepcopy(command.get("library_context") or {}),
        "dispatch": "core-required" if model_changing else "cad-local",
    }


def _validate_point(value: Any, path: str, errors: list[str]) -> None:
    if not _valid_point(value):
        errors.append(f"{path} must be a two-number array")


def _valid_point(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 2
        and all(_is_number(coordinate) for coordinate in value)
    )


def _polygon_metrics(points: list[list[float]]) -> tuple[float, list[float]]:
    ring = [[float(point[0]), float(point[1])] for point in points if _valid_point(point)]
    if len(ring) < 3:
        return 0.0, [0.0, 0.0]
    if ring[0] == ring[-1]:
        ring.pop()
    twice_area = 0.0
    weighted_x = 0.0
    weighted_y = 0.0
    for index, point in enumerate(ring):
        following = ring[(index + 1) % len(ring)]
        cross = point[0] * following[1] - following[0] * point[1]
        twice_area += cross
        weighted_x += (point[0] + following[0]) * cross
        weighted_y += (point[1] + following[1]) * cross
    if abs(twice_area) < 1e-9:
        return 0.0, [
            sum(point[0] for point in ring) / len(ring),
            sum(point[1] for point in ring) / len(ring),
        ]
    return abs(twice_area) / 2, [weighted_x / (3 * twice_area), weighted_y / (3 * twice_area)]


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)
