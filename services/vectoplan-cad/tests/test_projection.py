from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from src.projection.service import build_preview, load_json_file, validate_projection_input


ROOT = Path(__file__).resolve().parents[1]


def input_payload():
    return load_json_file(ROOT / "static" / "cad" / "examples" / "test_input.json")


def test_projection_input_is_valid():
    assert validate_projection_input(input_payload()) == []


def test_projection_summary_and_scene():
    preview = build_preview(input_payload())
    assert preview["ok"] is True
    assert preview["sheet_count"] == 1
    assert preview["viewport_count"] == 3
    assert preview["element_count"] >= 10
    assert preview["stateful_storage"] is False
    scene = preview["scene"]
    assert scene["document_ref"] == "cad_demo_001"
    assert scene["contract_version"] == "cad-scene/0.1"
    layers = {layer["layer_ref"] for layer in scene["sheets"][0]["layers"]}
    assert {"walls", "openings", "annotations", "structure"} <= layers


def test_wall_is_resolved_to_polygon_primitive():
    scene = build_preview(input_payload())["scene"]
    primitives = scene["sheets"][0]["viewports"][0]["primitives"]
    wall = next(item for item in primitives if item["primitive_ref"] == "wall_ext_north")
    assert wall["primitive_type"] == "polygon"
    assert len(wall["geometry"]["points_mm"]) == 4
    assert wall["metadata"]["family_ref"] == "hochbau.waende.ziegelwand"


def test_projection_rejects_unknown_viewport_reference():
    payload = deepcopy(input_payload())
    payload["sheets"][0]["elements"][0]["view_refs"] = ["missing_viewport"]
    errors = validate_projection_input(payload)
    assert any("unknown viewport references" in error for error in errors)


def test_projection_rejects_invalid_wall_geometry():
    payload = deepcopy(input_payload())
    payload["sheets"][0]["elements"][0]["geometry"]["thickness_mm"] = 0
    errors = validate_projection_input(payload)
    assert any("thickness_mm" in error for error in errors)