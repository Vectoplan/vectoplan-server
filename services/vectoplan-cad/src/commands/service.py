from __future__ import annotations

from copy import deepcopy
from math import hypot
from typing import Any


SUPPORTED_COMMANDS = {
    "create_dimension",
    "create_line",
    "create_section_marker",
    "create_wall",
}


def validate_cad_command(payload: Any) -> list[str]:
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

    if payload.get("contract_version") not in {None, "cad-command/0.1"}:
        errors.append("$.contract_version must be cad-command/0.1")

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

    return errors


def build_command_receipt(payload: dict[str, Any]) -> dict[str, Any]:
    command = deepcopy(payload)
    command["contract_version"] = "cad-command/0.1"
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
        "stateful_storage": False,
    }


def _build_preview_element(command: dict[str, Any]) -> dict[str, Any]:
    command_name = command["command"]
    kind_by_command = {
        "create_wall": "wall",
        "create_line": "line",
        "create_dimension": "dimension",
        "create_section_marker": "line",
    }
    layer_by_command = {
        "create_wall": "walls",
        "create_line": "annotations",
        "create_dimension": "dimensions",
        "create_section_marker": "annotations",
    }
    labels = {
        "create_wall": "Lokaler Wandentwurf",
        "create_line": "Lokaler Linienentwurf",
        "create_dimension": "Lokale Maßkette",
        "create_section_marker": "Lokale Schnittmarke",
    }
    geometry = deepcopy(command["geometry"])
    if command_name == "create_wall":
        geometry["thickness_mm"] = command["parameters"]["thickness_mm"]

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
    }
    if command_name == "create_wall":
        element["family_ref"] = command.get("family_ref", "hochbau.waende.ziegelwand")
        element["variant_ref"] = command.get("variant_ref", "24cm_tragend")
    if command_name == "create_dimension":
        start = geometry["start_mm"]
        end = geometry["end_mm"]
        element["text"] = f"{hypot(end[0] - start[0], end[1] - start[1]):.0f} mm"
    if command_name == "create_section_marker":
        element["text"] = command.get("parameters", {}).get("label", "A–A")
    return element


def _validate_point(value: Any, path: str, errors: list[str]) -> None:
    if not _valid_point(value):
        errors.append(f"{path} must be a two-number array")


def _valid_point(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 2
        and all(_is_number(coordinate) for coordinate in value)
    )


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)