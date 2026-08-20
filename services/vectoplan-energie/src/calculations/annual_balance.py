"""Annual useful-energy and gain balance."""

from __future__ import annotations

from typing import Any, Mapping


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def calculate_annual_balance(
    project: Mapping[str, Any], envelope: Mapping[str, Any], ventilation: Mapping[str, Any]
) -> dict[str, Any]:
    climate = project.get("climate") if isinstance(project.get("climate"), Mapping) else {}
    usage = project.get("usage") if isinstance(project.get("usage"), Mapping) else {}
    zones = project.get("zones") if isinstance(project.get("zones"), list) else []
    components = (
        project.get("envelope", {}).get("components", [])
        if isinstance(project.get("envelope"), Mapping)
        else []
    )
    area = sum(max(0.0, _number(dict(zone).get("floor_area_m2"))) for zone in zones if isinstance(zone, Mapping))
    occupants = sum(max(0.0, _number(dict(zone).get("occupants"))) for zone in zones if isinstance(zone, Mapping))
    degree_days = max(0.0, _number(climate.get("heating_degree_days_kd"), 3_400.0))
    utilization = min(1.0, max(0.0, _number(climate.get("heating_loss_utilization_factor"), 0.82)))
    h_transmission = _number(envelope.get("total_heat_transfer_w_k"))
    h_ventilation = _number(ventilation.get("heat_transfer_w_k"))
    transmission_kwh = h_transmission * degree_days * 24.0 / 1000.0
    ventilation_kwh = h_ventilation * degree_days * 24.0 / 1000.0

    internal_gain_kwh = (
        occupants * max(0.0, _number(usage.get("internal_gain_per_person_w"), 70.0))
        * max(0.0, _number(usage.get("occupied_hours_per_year"), 3_200.0)) / 1000.0
    )
    solar_gain_kwh = 0.0
    annual_solar_irradiation = max(0.0, _number(climate.get("window_solar_irradiation_kwh_m2a"), 430.0))
    for raw in components:
        item = dict(raw) if isinstance(raw, Mapping) else {}
        if str(item.get("kind")) != "window":
            continue
        solar_gain_kwh += (
            max(0.0, _number(item.get("area_m2")))
            * min(1.0, max(0.0, _number(item.get("g_value"), 0.55)))
            * min(1.0, max(0.0, _number(item.get("shading_factor"), 0.75)))
            * annual_solar_irradiation
        )
    useful_gains = min(transmission_kwh + ventilation_kwh, (internal_gain_kwh + solar_gain_kwh) * utilization)
    useful_heating = max(0.0, (transmission_kwh + ventilation_kwh) * utilization - useful_gains)
    building_type = str(project.get("building", {}).get("type") if isinstance(project.get("building"), Mapping) else "residential")
    hot_water_per_person = _number(usage.get("hot_water_kwh_per_person_a"), 620.0 if building_type == "residential" else 210.0)
    hot_water = occupants * max(0.0, hot_water_per_person)
    return {
        "floor_area_m2": round(area, 3),
        "heating_degree_days_kd": round(degree_days, 1),
        "transmission_heat_loss_kwh_a": round(transmission_kwh, 2),
        "ventilation_heat_loss_kwh_a": round(ventilation_kwh, 2),
        "internal_gains_kwh_a": round(internal_gain_kwh, 2),
        "solar_gains_kwh_a": round(solar_gain_kwh, 2),
        "usable_gains_kwh_a": round(useful_gains, 2),
        "useful_space_heating_kwh_a": round(useful_heating, 2),
        "useful_hot_water_kwh_a": round(hot_water, 2),
        "loss_utilization_factor": round(utilization, 3),
        "method": "annual-degree-day-working-balance",
        "normative": False,
    }


__all__ = ["calculate_annual_balance"]
