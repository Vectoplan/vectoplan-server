from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from app import create_app
from src.automation.dimensions import DimensionCalculationError, calculate_dimensions
from src.automation.roof import RoofCalculationError, calculate_roof


ROOT = Path(__file__).resolve().parents[1]


def _example(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def _client():
    return create_app("testing").test_client()


def _point_on_plan_polygon(point: list[float], polygon: list[list[float]]) -> bool:
    inside = False
    for index, start in enumerate(polygon):
        end = polygon[(index + 1) % len(polygon)]
        cross = (
            (end[0] - start[0]) * (point[1] - start[1])
            - (end[1] - start[1]) * (point[0] - start[0])
        )
        if (
            abs(cross) <= 0.1
            and min(start[0], end[0]) - 0.1 <= point[0] <= max(start[0], end[0]) + 0.1
            and min(start[1], end[1]) - 0.1 <= point[1] <= max(start[1], end[1]) + 0.1
        ):
            return True
        if (start[1] > point[1]) == (end[1] > point[1]):
            continue
        crossing_x = (end[0] - start[0]) * (point[1] - start[1]) / (end[1] - start[1]) + start[0]
        if point[0] < crossing_x:
            inside = not inside
    return inside


def _face_height_at(point: list[float], polygon: list[list[float]]) -> float | None:
    origin = polygon[0]
    for first_index in range(1, len(polygon) - 1):
        first = polygon[first_index]
        for second_index in range(first_index + 1, len(polygon)):
            second = polygon[second_index]
            first_dx, first_dy = first[0] - origin[0], first[1] - origin[1]
            second_dx, second_dy = second[0] - origin[0], second[1] - origin[1]
            determinant = first_dx * second_dy - second_dx * first_dy
            if abs(determinant) <= 1e-9:
                continue
            first_dz, second_dz = first[2] - origin[2], second[2] - origin[2]
            a = (first_dz * second_dy - second_dz * first_dy) / determinant
            b = (first_dx * second_dz - second_dx * first_dz) / determinant
            return origin[2] + a * (point[0] - origin[0]) + b * (point[1] - origin[1])
    return None


def _point_is_on_roof(point: list[float], faces: list[dict]) -> bool:
    for face in faces:
        polygon = face["polygon_3d_mm"]
        plan_polygon = [[vertex[0], vertex[1]] for vertex in polygon]
        if not _point_on_plan_polygon(point, plan_polygon):
            continue
        height = _face_height_at(point, polygon)
        if height is not None and abs(point[2] - height) <= 0.1:
            return True
    return False


def test_automatic_dimensions_create_external_and_door_chains():
    result = calculate_dimensions(_example("src/automation/dimensions/example_request.json"))

    assert result["contract_version"] == "cad-auto-dimension-result/0.1"
    assert result["summary"]["external_chain_count"] == 4
    assert result["summary"]["internal_chain_count"] == 2
    assert result["summary"]["opening_dimension_count"] == 2
    assert any(
        segment["role"] == "opening_width" and "hall-door" in segment["source_refs"]
        for chain in result["chains"]
        for segment in chain["segments"]
    )
    assert result["export"]["suggested_filename"].endswith(".json")


def test_dimension_recalculation_changes_fingerprint_and_offsets():
    request = _example("src/automation/dimensions/example_request.json")
    first = calculate_dimensions(request)
    request["options"]["external_offset_mm"] = 1600
    second = calculate_dimensions(request)

    assert first["input_fingerprint"] != second["input_fingerprint"]
    assert first["chains"][0]["dimension_line_mm"] != second["chains"][0]["dimension_line_mm"]


def test_dimensions_reject_invalid_footprint():
    with pytest.raises(DimensionCalculationError):
        calculate_dimensions({"contract_version": "cad-auto-dimension-request/0.1", "footprint": {"outer_ring_mm": [[0, 0]]}})


@pytest.mark.parametrize(
    ("roof_type", "face_count"),
    [
        ("flat", 1),
        ("gable", 2),
        ("hipped", 4),
        ("half_hipped", 4),
        ("pent", 1),
        ("mansard", 4),
        ("trapezoid", 3),
        ("butterfly", 2),
        ("pyramid", 4),
        ("barrel", 12),
        ("sawtooth", 6),
    ],
)
def test_roof_calculator_supports_parametric_roof_catalog(roof_type: str, face_count: int):
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = roof_type
    result = calculate_roof(request)

    assert result["roof_type"] == roof_type
    assert result["summary"]["face_count"] == face_count
    assert result["summary"]["roof_surface_area_m2"] > 0
    assert result["roof_skin"]["volume_m3"] > 0
    assert result["summary"]["rafter_count"] > 0
    assert result["summary"]["purlin_count"] > 0
    assert result["structure"]["summary"]["timber_volume_m3"] > 0
    assert result["roof_build_up"]["top_faces"]
    assert result["roof_build_up"]["counter_battens"]
    assert result["roof_build_up"]["tile_battens"]


@pytest.mark.parametrize(
    "roof_type",
    ["flat", "gable", "hipped", "half_hipped", "pent", "mansard", "trapezoid", "butterfly", "pyramid", "barrel", "sawtooth"],
)
@pytest.mark.parametrize(
    "footprint",
    [None, [[0, 0], [8000, 0], [8000, 3000], [4000, 3000], [4000, 7000], [0, 7000]]],
    ids=["rectangle", "concave"],
)
def test_all_structural_members_are_below_and_supported_by_the_generated_roof_faces(roof_type: str, footprint: list | None):
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = roof_type
    if footprint is not None:
        request["footprint"]["outer_ring_mm"] = footprint
        request["parameters"]["overhang_mm"] = 0
    result = calculate_roof(request)
    faces = result["geometry"]["faces"]

    for member in [*result["structure"]["rafters"], *result["structure"]["purlins"]]:
        start = member["support_start_3d_mm"]
        end = member["support_end_3d_mm"]
        for ratio in (0, 0.25, 0.5, 0.75, 1):
            sample = [start[axis] + (end[axis] - start[axis]) * ratio for axis in range(3)]
            assert _point_is_on_roof(sample, faces), (
                f"{roof_type} member {member['member_ref']} loses its roof support at {sample}"
            )
        assert max(member["start_3d_mm"][2], member["end_3d_mm"][2]) <= max(start[2], end[2]) + 0.1


@pytest.mark.parametrize("roof_type", ["hipped", "half_hipped", "pyramid"])
def test_hip_roofs_create_hip_rafters_and_clipped_common_rafters(roof_type: str):
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = roof_type
    result = calculate_roof(request)
    rafters = result["structure"]["rafters"]

    assert sum(member["role"] == "hip_rafter" for member in rafters) >= 4
    common_lengths = {round(member["length_mm"], -1) for member in rafters if member["role"] == "rafter"}
    assert len(common_lengths) > 2


def test_roof_uses_timber_defaults_birdsmouth_and_span_dependent_middle_purlins():
    request = _example("src/automation/roof/example_request.json")
    request["parameters"].pop("structure")
    request["parameters"]["overhang_mm"] = 0
    request["parameters"]["ridge_direction"] = "x"
    request["footprint"]["outer_ring_mm"] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    short = calculate_roof(request)
    short_structure = short["structure"]

    assert short_structure["rafter_configuration"]["height_mm"] == 200
    assert short_structure["rafter_configuration"]["spacing_mm"] == 650
    assert short_structure["rafter_configuration"]["birdsmouth_depth_mm"] == 30
    assert short_structure["purlin_configuration"]["width_mm"] == 140
    assert short_structure["purlin_configuration"]["height_mm"] == 200
    assert not any(member["role"] == "middle_purlin" for member in short_structure["purlins"])
    assert all(member["section_orientation"] == "vertical" for member in short_structure["purlins"])
    assert all(member["height_axis_3d"] == [0.0, 0.0, 1.0] for member in short_structure["purlins"])
    assert any(member.get("notches") for member in short_structure["rafters"])
    assert all(
        notch["depth_mm"] == 30
        for member in short_structure["rafters"]
        for notch in member.get("notches", [])
    )

    request["footprint"]["outer_ring_mm"] = [[0, 0], [6000, 0], [6000, 10000], [0, 10000]]
    long = calculate_roof(request)
    assert any(member["role"] == "middle_purlin" for member in long["structure"]["purlins"])


def test_roof_migrates_the_previous_standard_timber_dimensions_on_recalculation():
    result = calculate_roof(_example("src/automation/roof/example_request.json"))

    assert result["structure"]["rafter_configuration"]["spacing_mm"] == 650
    assert result["structure"]["purlin_configuration"]["width_mm"] == 140
    assert result["structure"]["purlin_configuration"]["height_mm"] == 200
    assert result["structure"]["purlin_configuration"]["maximum_spacing_mm"] == 4500


@pytest.mark.parametrize("mode", ["between", "below", "above"])
def test_roof_build_up_contains_tiles_laths_and_all_insulation_modes(mode: str):
    request = _example("src/automation/roof/example_request.json")
    request["parameters"]["roof_build_up"] = {"insulation_mode": mode}
    result = calculate_roof(request)
    build_up = result["roof_build_up"]
    roles = [layer["role"] for layer in build_up["layers"]]

    assert build_up["insulation_mode"] == mode
    assert roles == [
        "insulation", "roof_sheathing", "underlay", "counter_batten", "tile_batten", "roof_tile"
    ]
    assert build_up["layers"][-1]["material_ref"] == "vp.roof.tiled-insulated"
    assert build_up["counter_battens"]
    assert build_up["tile_battens"]
    assert build_up["top_faces"]
    if mode == "above":
        assert build_up["exterior_offset_mm"] > 200
    else:
        assert build_up["exterior_offset_mm"] < 200


def test_roof_overhang_and_pitch_trigger_complete_recalculation():
    request = _example("src/automation/roof/example_request.json")
    first = calculate_roof(request)
    request["parameters"]["pitch_deg"] = 42
    request["parameters"]["overhang_mm"]["north_mm"] = 1200
    second = calculate_roof(request)

    assert first["input_fingerprint"] != second["input_fingerprint"]
    assert first["geometry"]["roof_coverage_polygon_mm"] != second["geometry"]["roof_coverage_polygon_mm"]
    assert first["summary"]["maximum_height_mm"] != second["summary"]["maximum_height_mm"]


@pytest.mark.parametrize(
    "roof_type",
    ["flat", "gable", "hipped", "half_hipped", "pent", "mansard", "trapezoid", "butterfly", "pyramid", "barrel", "sawtooth"],
)
@pytest.mark.parametrize(("pitch_deg", "overhang_mm"), [(12, 0), (65, 1800)])
def test_all_purlins_stay_inside_the_fixed_205_mm_building_bearing_line(
    roof_type: str,
    pitch_deg: int,
    overhang_mm: int,
):
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = roof_type
    request["parameters"]["pitch_deg"] = pitch_deg
    request["parameters"]["overhang_mm"] = overhang_mm

    result = calculate_roof(request)
    bearing_ring = result["geometry"]["purlin_bearing_polygon_mm"]
    purlins = result["structure"]["purlins"]
    eaves_purlins = [member for member in purlins if member["role"] == "eaves_purlin"]

    assert bearing_ring == [
        [205.0, 205.0], [11795.0, 205.0], [11795.0, 7795.0], [205.0, 7795.0]
    ]
    assert result["structure"]["bearing_model"]["purlin_edge_offset_mm"] == 205
    assert result["structure"]["bearing_model"]["purlin_plan_reference"] == "source_footprint"
    assert result["structure"]["bearing_model"]["purlin_vertical_reference"] == "roof_zone_top"
    assert eaves_purlins
    rafter = result["structure"]["rafter_configuration"]
    purlin = result["structure"]["purlin_configuration"]

    lowest_purlin_bottom = min(
        member[key][2] - purlin["height_mm"] / 2
        for member in purlins
        for key in ("start_3d_mm", "end_3d_mm")
    )
    assert lowest_purlin_bottom == pytest.approx(request["parameters"]["eaves_height_mm"], abs=0.001)
    assert result["structure"]["bearing_model"]["lowest_purlin_bottom_mm"] == pytest.approx(
        request["parameters"]["eaves_height_mm"],
        abs=0.001,
    )

    for member in purlins:
        start = member["support_start_3d_mm"]
        end = member["support_end_3d_mm"]
        vertical_factor = member["support_vertical_factor"]
        contact_drop = (rafter["height_mm"] - rafter["birdsmouth_depth_mm"]) / vertical_factor
        assert member["start_3d_mm"][2] + purlin["height_mm"] / 2 == pytest.approx(
            start[2] - contact_drop,
            abs=0.001,
        )
        assert member["end_3d_mm"][2] + purlin["height_mm"] / 2 == pytest.approx(
            end[2] - contact_drop,
            abs=0.001,
        )
        assert member["top_bearing_start_3d_mm"][2] == pytest.approx(start[2] - contact_drop, abs=0.001)
        assert member["top_bearing_end_3d_mm"][2] == pytest.approx(end[2] - contact_drop, abs=0.001)
        for ratio in (0, 0.25, 0.5, 0.75, 1):
            sample = [
                start[axis] + (end[axis] - start[axis]) * ratio
                for axis in range(2)
            ]
            assert _point_on_plan_polygon(sample, bearing_ring), (
                f"{roof_type} purlin {member['member_ref']} leaves the marked building bearing area at {sample}"
            )

    eaves_plan_length = sum(
        math.hypot(
            member["support_end_3d_mm"][0] - member["support_start_3d_mm"][0],
            member["support_end_3d_mm"][1] - member["support_start_3d_mm"][1],
        )
        for member in eaves_purlins
    )
    expected_length = (
        2 * (11590 + 7590)
        if roof_type in {"hipped", "half_hipped", "pyramid"}
        else 2 * 11590
    )
    assert eaves_plan_length == pytest.approx(expected_length, abs=0.1)
    assert all(
        _point_on_plan_polygon(member[key][:2], bearing_ring)
        for member in eaves_purlins
        for key in ("support_start_3d_mm", "support_end_3d_mm")
    )


def test_roof_pitch_is_normalized_to_whole_degrees():
    request = _example("src/automation/roof/example_request.json")
    request["parameters"]["pitch_deg"] = 35.5

    result = calculate_roof(request)

    assert result["normalized_request"]["parameters"]["pitch_deg"] == 36


@pytest.mark.parametrize("roof_type", ["barrel", "sawtooth"])
def test_special_roof_forms_follow_the_common_pitch_control(roof_type: str):
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = roof_type
    # Keep the legacy special-form fields fixed.  The common pitch control is
    # authoritative for the quick settings used by both 2D and 3D editors.
    request["parameters"]["barrel_rise_mm"] = 3000
    request["parameters"]["sawtooth_pitch_deg"] = 35
    request["parameters"]["pitch_deg"] = 15
    shallow = calculate_roof(request)
    request["parameters"]["pitch_deg"] = 55
    steep = calculate_roof(request)

    assert steep["summary"]["maximum_height_mm"] > shallow["summary"]["maximum_height_mm"]
    assert steep["input_fingerprint"] != shallow["input_fingerprint"]
    if roof_type == "sawtooth":
        assert {
            face["pitch_deg"]
            for face in steep["geometry"]["faces"]
            if face["role"] == "sawtooth-slope"
        } == {55}


def test_barrel_build_up_closes_every_curved_segment_transition():
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = "barrel"
    result = calculate_roof(request)
    transition_caps = [
        cap for cap in result["roof_build_up"]["roof_caps"]
        if cap["role"] == "barrel_transition_cap"
    ]

    assert len(transition_caps) >= result["normalized_request"]["parameters"]["barrel_segment_count"] - 1
    assert all(cap["section_mm"] == {"width": 120.0, "height": 30.0} for cap in transition_caps)


def test_roof_accepts_german_type_aliases_and_individual_edge_overhangs():
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = "Walmdach"
    request["parameters"]["overhang_mm"] = {"edges_mm": [300, 400, 500, 600]}
    result = calculate_roof(request)

    assert result["roof_type"] == "hipped"
    assert result["geometry"]["edge_overhangs_mm"] == [300, 400, 500, 600]


def test_roof_clips_skin_and_structure_to_concave_straight_polygon():
    request = _example("src/automation/roof/example_request.json")
    request["footprint"]["outer_ring_mm"] = [
        [0, 0], [8000, 0], [8000, 3000], [4000, 3000], [4000, 7000], [0, 7000]
    ]
    request["parameters"]["overhang_mm"] = 0
    result = calculate_roof(request)

    assert result["geometry_method"] == "polygon-clipped-v2"
    assert len(result["geometry"]["faces"]) > 2
    assert sum(face["plan_area_m2"] for face in result["geometry"]["faces"]) == pytest.approx(40.0)
    assert result["structure"]["rafters"]
    assert result["structure"]["purlins"]
    assert all(member["length_mm"] > 0 for member in [
        *result["structure"]["rafters"], *result["structure"]["purlins"]
    ])


def test_roof_rejects_self_intersecting_polygon():
    request = _example("src/automation/roof/example_request.json")
    request["footprint"]["outer_ring_mm"] = [[0, 0], [6000, 6000], [0, 6000], [6000, 0]]
    with pytest.raises(RoofCalculationError, match="self-intersect"):
        calculate_roof(request)


def test_roof_rejects_unknown_type():
    request = _example("src/automation/roof/example_request.json")
    request["roof_type"] = "unknown-roof"
    with pytest.raises(RoofCalculationError):
        calculate_roof(request)


def test_dimension_and_roof_http_endpoints_return_json_results():
    dimensions = _client().post(
        "/api/v1/cad/automation/dimensions/calculate",
        json=_example("src/automation/dimensions/example_request.json"),
    )
    roof = _client().post(
        "/api/v1/cad/automation/roof/calculate",
        json=_example("src/automation/roof/example_request.json"),
    )

    assert dimensions.status_code == 200
    assert dimensions.get_json()["contract_version"] == "cad-auto-dimension-result/0.1"
    assert roof.status_code == 200
    assert roof.get_json()["contract_version"] == "cad-roof-calculation-result/0.1"


def test_automation_http_endpoints_return_structured_validation_errors():
    dimensions = _client().post("/api/v1/cad/automation/dimensions/calculate", json={})
    roof = _client().post("/api/v1/cad/automation/roof/calculate", json={})

    assert dimensions.status_code == 400
    assert dimensions.get_json()["error"] == "invalid_dimension_request"
    assert roof.status_code == 400
    assert roof.get_json()["error"] == "invalid_roof_request"
