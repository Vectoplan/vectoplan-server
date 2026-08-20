from __future__ import annotations

from src.calculations.service import calculate_preview


def request_payload(**overrides):
    payload = {
        "project_id": "test-project",
        "building_type": "residential",
        "geometry": {"heated_floor_area_m2": 500, "envelope_area_m2": 950},
        "envelope": {
            "exterior_wall_u_value": 0.24,
            "roof_u_value": 0.18,
            "floor_u_value": 0.28,
            "window_u_value": 1.1,
            "window_share": 0.18,
            "source": "library",
        },
        "systems": {
            "heating_type": "heat_pump",
            "seasonal_performance_factor": 3.6,
            "heat_recovery_rate": 0.75,
            "pv_peak_kwp": 10,
            "verified": True,
        },
        "usage": {"indoor_temperature_c": 20, "occupants": 20, "climate_location": "Köln"},
        "provenance": {"geometry_revision": "r1"},
    }
    for key, value in overrides.items():
        payload[key] = value
    return payload


def test_working_calculation_is_explicitly_non_normative():
    result = calculate_preview(request_payload())
    assert result["ok"] is True
    assert result["calculation_status"] == "working"
    assert result["normative"] is False
    assert result["methodology"] == "energy-working-model/0.2"
    assert "nicht" in result["disclaimer"].lower()


def test_better_wall_and_windows_reduce_primary_energy():
    baseline = calculate_preview(request_payload())
    optimized_payload = request_payload()
    optimized_payload["envelope"]["exterior_wall_u_value"] = 0.16
    optimized_payload["envelope"]["window_u_value"] = 0.75
    optimized = calculate_preview(optimized_payload)
    assert optimized["metrics"]["primary_energy_kwh_m2a"] < baseline["metrics"]["primary_energy_kwh_m2a"]


def test_more_pv_does_not_increase_final_energy():
    baseline = calculate_preview(request_payload())
    more_pv_payload = request_payload()
    more_pv_payload["systems"]["pv_peak_kwp"] = 20
    more_pv = calculate_preview(more_pv_payload)
    assert more_pv["metrics"]["final_energy_kwh_a"] <= baseline["metrics"]["final_energy_kwh_a"]
