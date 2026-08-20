import math

import pytest

from src.design.concrete import ReinforcedConcreteDesign
from src.design.geotechnical import RetainingWallEarthPressureDesign
from src.design.steel import SteelMemberDesign
from src.design.timber import TimberMemberDesign
from src.formulas import centroid
from src.knowledge import FormulaRegistry
from src.loads import SnowLoadCalculator, WindLoadCalculator, area_to_line_load, permanent_area_load, self_weight_from_volume
from src.materials import default_material_catalog
from src.projects import ProjectCalculationPipeline, ProjectCaseRepository, apply_numeric_overrides
from src.solvers.beam import BeamLineSolver


def test_formula_catalog_and_action_calculators_are_traceable():
    records = FormulaRegistry().records()
    assert len(records) >= 35
    assert all(item["source"]["book_pages"] and item["equation"] and item["backend"] and item["tests"] for item in records)
    assert self_weight_from_volume(2.0, 25.0)["value_kn"] == 50.0
    assert permanent_area_load([{"thickness_m": 0.2, "unit_weight_kn_m3": 25}])["value_kn_m2"] == 5.0
    assert area_to_line_load(5.0, 3.0)["value_kn_m"] == 15.0
    assert centroid([{"area": 2, "coordinate": 0}, {"area": 2, "coordinate": 4}])["coordinate"] == 2.0


def test_snow_and_wind_actions_expose_every_factor():
    snow = SnowLoadCalculator().calculate({
        "ground_snow_load_kn_m2": 0.85, "shape_coefficient": 0.8,
        "exposure_coefficient": 1.0, "thermal_coefficient": 1.0, "tributary_area_m2": 10,
    })
    assert snow["roof_snow_load_kn_m2"] == pytest.approx(0.68)
    assert snow["nodal_load_kn"] == pytest.approx(6.8)
    assert "μᵢ" in snow["calculation_steps"][0]["formula"]
    wind = WindLoadCalculator().calculate({
        "basic_wind_velocity_m_s": 25, "air_density_kg_m3": 1.25, "exposure_factor": 1.65,
        "external_pressure_coefficient": 0.8, "internal_pressure_coefficient": -0.2, "loaded_area_m2": 10,
    })
    assert wind["basic_velocity_pressure_kn_m2"] == pytest.approx(0.390625)
    assert wind["net_pressure_kn_m2"] == pytest.approx(0.644531, abs=1e-6)
    assert len(wind["calculation_steps"]) == 4


def test_project_pipeline_closes_member_equilibrium():
    result = ProjectCalculationPipeline().run(ProjectCaseRepository().get("complex_residential_building"))
    roof = next(item for item in result["positions"] if item["position_ref"] == "P07")
    analysis = roof["result"]["analysis"]["analyses"][0]["result"]
    applied = 2 * (12 + 18)
    assert sum(node["ry_kn"] for node in analysis["nodes"]) == pytest.approx(applied * 1.44, abs=1e-5)


def test_cantilever_beam_matches_closed_form_solution():
    length, load, e_mpa, inertia = 4.0, 10.0, 210000.0, 8e-5
    result = BeamLineSolver().solve(
        [{"span_id": "S1", "length_m": length, "elastic_modulus_mpa": e_mpa, "inertia_m4": inertia, "uniform_load_kn_m": load}],
        [{"vertical": True, "rotation": True}, {"vertical": False, "rotation": False}], samples_per_span=41,
    )
    expected_mm = load * length**4 / (8 * e_mpa * 1000 * inertia) * 1000
    assert result["envelope"]["max_abs_deflection_mm"] == pytest.approx(expected_mm, rel=2e-4)


def test_steel_beam_design_returns_trace():
    result = SteelMemberDesign(default_material_catalog()).check({
        "steel_grade": "S355", "area_mm2": 10000, "shear_area_mm2": 6000,
        "section_modulus_cm3": 1500, "design_moment_knm": 100, "design_shear_kn": 50,
    })
    assert result["calculation_steps"] and {item["check_id"] for item in result["checks"]} >= {"steel_bending", "steel_shear"}


def test_timber_design_returns_trace():
    result = TimberMemberDesign(default_material_catalog()).check({
        "timber_grade": "C24", "section_modulus_mm3": 4e6, "area_mm2": 20000,
        "design_moment_knm": 20, "design_shear_kn": 10, "span_m": 5, "max_deflection_mm": 8,
    })
    assert result["calculation_steps"] and len(result["checks"]) == 3


def test_concrete_design_with_stirrups():
    result = ReinforcedConcreteDesign(default_material_catalog()).check({
        "concrete_class": "C30/37", "reinforcement_class": "B500B", "width_mm": 300,
        "height_mm": 600, "cover_mm": 35, "bar_diameter_mm": 20, "design_moment_knm": 120,
        "design_shear_kn": 120, "provided_reinforcement_mm2": 2000,
        "stirrup_area_mm2": 157, "stirrup_spacing_mm": 150, "cot_theta": 2,
    })
    assert any(item["check_id"] == "rc_shear_reinforcement" for item in result["checks"])
    assert any(item["step_id"] == "rc_shear_stirrups" for item in result["calculation_steps"])


def test_geotechnical_reference_calculations():
    result = RetainingWallEarthPressureDesign().check({
        "height_m": 5, "soil_unit_weight_kn_m3": 19, "friction_angle_deg": 32,
        "surcharge_kn_m2": 10, "water_depth_m": 2,
    })
    expected_ka = (1-math.sin(math.radians(32))) / (1+math.sin(math.radians(32)))
    assert result["earth_pressure_coefficient_ka"] == pytest.approx(expected_ka, abs=1e-5)
    assert result["resultants"]["water_kn_m"] == pytest.approx(20)


def test_preview_override_updates_snow_and_truss_without_mutating_case():
    project = ProjectCaseRepository().get("complex_residential_building")
    changed = apply_numeric_overrides(project, [{"path": "/environmental_actions/0/ground_snow_load_kn_m2", "value": 1.0}])
    assert project["environmental_actions"][0]["ground_snow_load_kn_m2"] == 0.85
    result = ProjectCalculationPipeline().run(changed)
    assert result["environmental_actions"][0]["roof_snow_load_kn_m2"] == pytest.approx(0.8)
    roof = next(item for item in result["positions"] if item["position_ref"] == "P07")
    assert roof["job"]["load_cases"][1]["value"] == pytest.approx(21.1764705882)


def test_preview_rejects_non_numeric_or_non_editable_paths():
    project = ProjectCaseRepository().get("complex_residential_building")
    with pytest.raises(ValueError):
        apply_numeric_overrides(project, [{"path": "/project_ref", "value": 1}])
    with pytest.raises(ValueError):
        apply_numeric_overrides(project, [{"path": "/environmental_actions/0/label", "value": 1}])
