from __future__ import annotations

import json
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


def test_roof_overhang_and_pitch_trigger_complete_recalculation():
    request = _example("src/automation/roof/example_request.json")
    first = calculate_roof(request)
    request["parameters"]["pitch_deg"] = 42
    request["parameters"]["overhang_mm"]["north_mm"] = 1200
    second = calculate_roof(request)

    assert first["input_fingerprint"] != second["input_fingerprint"]
    assert first["geometry"]["roof_coverage_polygon_mm"] != second["geometry"]["roof_coverage_polygon_mm"]
    assert first["summary"]["maximum_height_mm"] != second["summary"]["maximum_height_mm"]


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
