from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from src.projection.service import build_preview, load_json_file, validate_projection_input
from src.scene.service import _element_to_primitive, _wall_polygon


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
    assert wall["geometry"]["wall_join_start"] is True
    assert wall["geometry"]["wall_join_end"] is True
    assert wall["geometry"]["wall_join_mode"] == "automatic_miter"


def test_legacy_wall_polygon_uses_butt_caps_without_visible_protrusions():
    assert _wall_polygon({
        "start_mm": [0, 0],
        "end_mm": [1000, 0],
        "thickness_mm": 100,
    }) == [[0, 50], [1000, 50], [1000, -50], [0, -50]]


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


def test_persistent_roof_projection_keeps_edit_identity_and_calculation():
    payload = deepcopy(input_payload())
    calculation = {
        "ok": True,
        "roof_type": "gable",
        "geometry": {
            "source_footprint_mm": [[0, 0], [8000, 0], [8000, 6000], [0, 6000]],
            "roof_coverage_polygon_mm": [[-500, -500], [8500, -500], [8500, 6500], [-500, 6500]],
            "ridge_line_mm": [[4000, -500], [4000, 6500]],
        },
    }
    payload["sheets"][0]["elements"].append({
        "element_ref": "roof-gable-1",
        "label": "Parametrisches Dach · gable",
        "kind": "roof",
        "layer": "construction_roof",
        "view_refs": ["vp_ground_floor"],
        "source": {
            "kind": "core_construction_element",
            "object_instance_id": "roof-object-1",
            "object_anchor": {"x": 0, "y": 6, "z": 0},
        },
        "roof_type": "gable",
        "roof_calculation": calculation,
        "geometry": {
            "points_mm": calculation["geometry"]["source_footprint_mm"],
            "coverage_points_mm": calculation["geometry"]["roof_coverage_polygon_mm"],
            "ridge_line_mm": calculation["geometry"]["ridge_line_mm"],
            "roof_calculation": calculation,
        },
    })

    assert validate_projection_input(payload) == []
    primitive = next(
        item
        for item in build_preview(payload)["scene"]["sheets"][0]["viewports"][0]["primitives"]
        if item["primitive_ref"] == "roof-gable-1"
    )
    assert primitive["source_kind"] == "roof"
    assert primitive["geometry"]["points_mm"] == calculation["geometry"]["source_footprint_mm"]
    assert primitive["metadata"]["source"]["object_instance_id"] == "roof-object-1"
    assert primitive["metadata"]["roof_calculation"] == calculation


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


def test_semantic_region_form_on_element_is_projected_without_legacy_wall_fields():
    payload = deepcopy(input_payload())
    sheet = payload["sheets"][0]
    ring = [[500, 500], [2500, 500], [2500, 1500], [500, 1500], [500, 500]]
    sheet["elements"] = [
        {
            "element_ref": "semantic-wall-region-element-form",
            "label": "Flächenwand",
            "kind": "wall",
            "layer": "construction_wall",
            "view_refs": ["vp_ground_floor"],
            "form": "region",
            "geometry": {"outer_ring_mm": ring},
        }
    ]

    assert validate_projection_input(payload) == []
    primitive = build_preview(payload)["scene"]["sheets"][0]["viewports"][0]["primitives"][0]
    assert primitive["primitive_type"] == "polygon"
    assert primitive["geometry"]["points_mm"] == ring
    assert primitive["metadata"]["form"] == "region"


def test_wall_network_is_recovered_when_form_metadata_is_missing():
    primitive = _element_to_primitive(
        {
            "element_ref": "wall-network-without-form",
            "kind": "wall",
            "layer": "construction_wall",
            "geometry": {
                "segments_mm": [[[0, 0], [1000, 0]], [[1000, 0], [1000, 1000]]],
                "thickness_mm": 240,
            },
        }
    )
    assert primitive["primitive_type"] == "thick_segments"
    assert len(primitive["geometry"]["segments_mm"]) == 2


def test_malformed_wall_geometry_cannot_abort_the_entire_scene():
    primitive = _element_to_primitive(
        {
            "element_ref": "wall-from-unknown-contract-version",
            "kind": "wall",
            "layer": "construction_wall",
            "geometry": {"thickness_mm": 240},
        }
    )
    assert primitive["primitive_type"] == "polygon"
    assert primitive["geometry"]["points_mm"] == []
    assert _wall_polygon({"thickness_mm": 240}) == []


def test_incomplete_semantic_region_is_an_invisible_placeholder_not_a_sheet_error():
    payload = deepcopy(input_payload())
    sheet = payload["sheets"][0]
    sheet["elements"].append(
        {
            "element_ref": "pending-semantic-region",
            "label": "Noch nicht aufgelöste Fläche",
            "kind": "wall",
            "layer": "construction_wall",
            "view_refs": ["vp_ground_floor"],
            "form": "region",
            "geometry": {"form": "region"},
        }
    )

    assert validate_projection_input(payload) == []
    primitives = build_preview(payload)["scene"]["sheets"][0]["viewports"][0]["primitives"]
    placeholder = next(item for item in primitives if item["primitive_ref"] == "pending-semantic-region")
    assert placeholder["primitive_type"] == "polygon"
    assert placeholder["geometry"]["points_mm"] == []
    assert any(item["primitive_ref"] == "wall_ext_north" for item in primitives)


def test_architectural_roles_receive_specific_render_styles():
    payload = deepcopy(input_payload())
    sheet = payload["sheets"][0]
    viewport_ref = "vp_ground_floor"
    roles = (
        ("door", "opening"),
        ("window", "opening"),
        ("stair", "structure"),
        ("slab", "structure"),
    )
    sheet["elements"] = [
        {
            "element_ref": f"semantic-{role}",
            "label": role.title(),
            "kind": kind,
            "layer": f"construction_{role}",
            "view_refs": [viewport_ref],
            "semantic_role": role,
            "geometry": {
                "form": "region",
                "outer_ring_mm": [
                    [index * 2000, 0],
                    [index * 2000 + 1200, 0],
                    [index * 2000 + 1200, 240],
                    [index * 2000, 240],
                    [index * 2000, 0],
                ],
            },
        }
        for index, (role, kind) in enumerate(roles)
    ]

    assert validate_projection_input(payload) == []
    primitives = build_preview(payload)["scene"]["sheets"][0]["viewports"][0]["primitives"]
    assert {primitive["style_ref"] for primitive in primitives} == {
        "door",
        "window",
        "stair",
        "slab",
    }
    assert all(primitive["primitive_type"] == "polygon" for primitive in primitives)


def test_imported_openings_infer_door_and_window_styles_from_library_family():
    payload = deepcopy(input_payload())
    sheet = payload["sheets"][0]
    viewport_ref = "vp_ground_floor"
    sheet["elements"] = [
        {
            "element_ref": "legacy-door",
            "label": "Eingangstür",
            "kind": "opening",
            "layer": "openings",
            "family_ref": "hochbau.oeffnungen.tuer",
            "variant_ref": "haustuer_1010",
            "view_refs": [viewport_ref],
            "geometry": {"x_mm": 1000, "y_mm": 1000, "width_mm": 1010, "height_mm": 240},
        },
        {
            "element_ref": "legacy-window",
            "label": "Fenster Süd",
            "kind": "opening",
            "layer": "openings",
            "family_ref": "hochbau.oeffnungen.fenster",
            "variant_ref": "fenster_2010",
            "view_refs": [viewport_ref],
            "geometry": {"x_mm": 3000, "y_mm": 1000, "width_mm": 2010, "height_mm": 240},
        },
    ]

    assert validate_projection_input(payload) == []
    primitives = build_preview(payload)["scene"]["sheets"][0]["viewports"][0]["primitives"]
    assert [primitive["style_ref"] for primitive in primitives] == ["door", "window"]


def test_outer_edge_wall_chain_is_automatically_mitered_at_exact_reference_corner():
    payload = deepcopy(input_payload())
    sheet = payload["sheets"][0]
    viewport_ref = "vp_ground_floor"
    sheet["elements"] = [
        {
            "element_ref": "wall-chain-1",
            "label": "Wandzug 1",
            "kind": "wall",
            "layer": "walls",
            "view_refs": [viewport_ref],
            "geometry": {
                "start_mm": [0, 50],
                "end_mm": [1000, 50],
                "reference_start_mm": [0, 0],
                "reference_end_mm": [1000, 0],
                "thickness_mm": 100,
                "wall_chain_ref": "wall-chain:test",
                "wall_join_mode": "automatic_miter",
            },
        },
        {
            "element_ref": "wall-chain-2",
            "label": "Wandzug 2",
            "kind": "wall",
            "layer": "walls",
            "view_refs": [viewport_ref],
            "geometry": {
                "start_mm": [950, 0],
                "end_mm": [950, 1000],
                "reference_start_mm": [1000, 0],
                "reference_end_mm": [1000, 1000],
                "thickness_mm": 100,
                "wall_chain_ref": "wall-chain:test",
                "wall_join_mode": "automatic_miter",
            },
        },
    ]

    assert validate_projection_input(payload) == []
    primitives = build_preview(payload)["scene"]["sheets"][0]["viewports"][0]["primitives"]
    first, second = primitives
    assert first["geometry"]["points_mm"] == [[0, 0], [1000, 0], [900, 100], [0, 100]]
    assert second["geometry"]["points_mm"] == [[1000, 0], [1000, 1000], [900, 1000], [900, 100]]
    assert first["geometry"]["wall_join_end"] is True
    assert second["geometry"]["wall_join_start"] is True
