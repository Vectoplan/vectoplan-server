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


def test_room_zone_is_validated_and_projected_as_room_primitive():
    payload = deepcopy(input_payload())
    payload["sheets"][0]["elements"].append(
        {
            "element_ref": "room_wohnen_01",
            "label": "Wohnen",
            "kind": "room",
            "layer": "rooms",
            "view_refs": ["vp_ground_floor"],
            "semantic_role": "energy_zone",
            "room_type": "wohnen",
            "text": "Wohnen\n20.00 m²",
            "geometry": {
                "x_mm": 1000,
                "y_mm": 2000,
                "width_mm": 5000,
                "depth_mm": 4000,
                "height_mm": 3000,
                "area_m2": 20.0,
            },
        }
    )
    assert validate_projection_input(payload) == []
    primitive = next(
        item
        for item in build_preview(payload)["scene"]["sheets"][0]["viewports"][0]["primitives"]
        if item["primitive_ref"] == "room_wohnen_01"
    )
    assert primitive["primitive_type"] == "room"
    assert primitive["metadata"]["room_type"] == "wohnen"
    assert primitive["metadata"]["area_m2"] == 20.0


def test_semantic_polyline_is_one_selectable_thick_path():
    payload = deepcopy(input_payload())
    sheet = payload["sheets"][0]
    sheet["elements"] = [
        {
            "element_ref": "semantic-wall-path",
            "label": "Zusammenhängende Wand",
            "kind": "wall",
            "layer": "construction_wall",
            "view_refs": ["vp_ground_floor"],
            "form": "polyline",
            "source_cell_count": 5,
            "geometry": {
                "form": "polyline",
                "path_mm": [[500, 500], [1500, 500], [1500, 1500]],
                "closed": False,
                "thickness_mm": 365,
            },
        }
    ]

    assert validate_projection_input(payload) == []
    scene = build_preview(payload)["scene"]
    primitive = scene["sheets"][0]["viewports"][0]["primitives"][0]
    assert primitive["primitive_type"] == "thick_path"
    assert primitive["metadata"]["source_cell_count"] == 5
    assert primitive["metadata"]["thickness_mm"] == 365


def test_semantic_network_preserves_explicit_joint_nodes():
    payload = deepcopy(input_payload())
    sheet = payload["sheets"][0]
    sheet["elements"] = [
        {
            "element_ref": "semantic-wall-network",
            "label": "Verzweigte Wand",
            "kind": "wall",
            "layer": "construction_wall",
            "view_refs": ["vp_ground_floor"],
            "form": "network",
            "geometry": {
                "form": "network",
                "segments_mm": [
                    [[500, 500], [1500, 500]],
                    [[1500, 500], [2500, 500]],
                    [[1500, 500], [1500, 1500]],
                ],
                "paths_mm": [
                    [[500, 500], [1500, 500], [2500, 500]],
                    [[1500, 1500], [1500, 500]],
                ],
                "nodes_mm": [
                    {"point_mm": [500, 500], "degree": 1},
                    {"point_mm": [1500, 500], "degree": 3},
                    {"point_mm": [2500, 500], "degree": 1},
                    {"point_mm": [1500, 1500], "degree": 1},
                ],
                "thickness_mm": 365,
            },
        }
    ]

    assert validate_projection_input(payload) == []
    scene = build_preview(payload)["scene"]
    primitive = scene["sheets"][0]["viewports"][0]["primitives"][0]
    assert primitive["primitive_type"] == "thick_segments"
    assert sorted(len(path) for path in primitive["geometry"]["paths_mm"]) == [2, 3]
    assert len(primitive["geometry"]["nodes_mm"]) == 4
