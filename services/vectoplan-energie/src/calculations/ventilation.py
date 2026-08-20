"""Ventilation, infiltration and hygienic airflow working calculations."""

from __future__ import annotations

from typing import Any, Mapping


AIR_HEAT_CAPACITY_WH_M3K = 0.34


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def calculate_ventilation(project: Mapping[str, Any]) -> dict[str, Any]:
    systems = project.get("systems") if isinstance(project.get("systems"), Mapping) else {}
    ventilation = systems.get("ventilation") if isinstance(systems.get("ventilation"), Mapping) else {}
    zones = project.get("zones") if isinstance(project.get("zones"), list) else []
    volume = sum(max(0.0, _number(dict(zone).get("volume_m3"))) for zone in zones if isinstance(zone, Mapping))
    occupants = sum(max(0.0, _number(dict(zone).get("occupants"))) for zone in zones if isinstance(zone, Mapping))
    mechanical_air_changes = max(0.0, _number(ventilation.get("air_changes_per_hour"), 0.5))
    infiltration_air_changes = max(0.0, _number(ventilation.get("infiltration_air_changes_per_hour"), 0.10))
    recovery = min(0.95, max(0.0, _number(ventilation.get("heat_recovery_rate"), 0.0)))
    mechanical_flow_m3_h = max(0.0, _number(ventilation.get("design_airflow_m3_h"), volume * mechanical_air_changes))
    hygienic_flow_m3_h = occupants * max(0.0, _number(ventilation.get("minimum_airflow_per_person_m3_h"), 25.0))
    effective_flow_m3_h = volume * infiltration_air_changes + mechanical_flow_m3_h * (1.0 - recovery)
    heat_transfer_w_k = AIR_HEAT_CAPACITY_WH_M3K * effective_flow_m3_h
    return {
        "type": str(ventilation.get("type") or "natural"),
        "conditioned_volume_m3": round(volume, 3),
        "occupants": round(occupants, 2),
        "mechanical_air_changes_per_hour": round(mechanical_air_changes, 4),
        "infiltration_air_changes_per_hour": round(infiltration_air_changes, 4),
        "heat_recovery_rate": round(recovery, 4),
        "design_airflow_m3_h": round(mechanical_flow_m3_h, 2),
        "hygienic_screening_airflow_m3_h": round(hygienic_flow_m3_h, 2),
        "hygienic_screening_passed": mechanical_flow_m3_h >= hygienic_flow_m3_h or occupants <= 0,
        "effective_thermal_airflow_m3_h": round(effective_flow_m3_h, 2),
        "heat_transfer_w_k": round(heat_transfer_w_k, 3),
        "screening_only": True,
    }


__all__ = ["AIR_HEAT_CAPACITY_WH_M3K", "calculate_ventilation"]
