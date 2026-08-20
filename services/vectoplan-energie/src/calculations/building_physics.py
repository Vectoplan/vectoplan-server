"""Heating-load, moisture and summer-comfort working calculations."""

from __future__ import annotations

from math import exp
from typing import Any, Mapping


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def saturation_pressure_pa(temperature_c: float) -> float:
    """Magnus approximation used only for a transparent condensation screen."""
    if temperature_c >= 0:
        return 610.5 * exp(17.269 * temperature_c / (237.3 + temperature_c))
    return 610.5 * exp(21.875 * temperature_c / (265.5 + temperature_c))


def calculate_heating_load(
    project: Mapping[str, Any], envelope: Mapping[str, Any], ventilation: Mapping[str, Any]
) -> dict[str, Any]:
    climate = project.get("climate") if isinstance(project.get("climate"), Mapping) else {}
    zones = project.get("zones") if isinstance(project.get("zones"), list) else []
    indoor = max((_number(dict(zone).get("indoor_temperature_c"), 20.0) for zone in zones if isinstance(zone, Mapping)), default=20.0)
    outdoor = _number(climate.get("design_outdoor_temperature_c"), -10.0)
    delta_t = max(0.0, indoor - outdoor)
    transmission_w_k = _number(envelope.get("total_heat_transfer_w_k"))
    ventilation_w_k = _number(ventilation.get("heat_transfer_w_k"))
    transmission_kw = transmission_w_k * delta_t / 1000.0
    ventilation_kw = ventilation_w_k * delta_t / 1000.0
    warm_up_factor = max(1.0, _number(climate.get("heating_load_safety_factor"), 1.05))
    return {
        "indoor_temperature_c": round(indoor, 2),
        "design_outdoor_temperature_c": round(outdoor, 2),
        "design_temperature_difference_k": round(delta_t, 2),
        "transmission_heat_load_kw": round(transmission_kw, 3),
        "ventilation_heat_load_kw": round(ventilation_kw, 3),
        "design_heat_load_kw": round((transmission_kw + ventilation_kw) * warm_up_factor, 3),
        "safety_factor": round(warm_up_factor, 3),
        "method": "steady-state-working-method",
        "normative": False,
    }


def calculate_moisture_screen(project: Mapping[str, Any]) -> dict[str, Any]:
    envelope = project.get("envelope") if isinstance(project.get("envelope"), Mapping) else {}
    components = envelope.get("components") if isinstance(envelope.get("components"), list) else []
    climate = project.get("climate") if isinstance(project.get("climate"), Mapping) else {}
    indoor_t = _number(climate.get("moisture_indoor_temperature_c"), 20.0)
    outdoor_t = _number(climate.get("moisture_outdoor_temperature_c"), -5.0)
    indoor_rh = min(1.0, max(0.0, _number(climate.get("indoor_relative_humidity"), 0.50)))
    outdoor_rh = min(1.0, max(0.0, _number(climate.get("outdoor_relative_humidity"), 0.80)))
    p_inside = saturation_pressure_pa(indoor_t) * indoor_rh
    p_outside = saturation_pressure_pa(outdoor_t) * outdoor_rh
    rows: list[dict[str, Any]] = []
    for raw in components:
        component = dict(raw) if isinstance(raw, Mapping) else {}
        layers = component.get("layers") if isinstance(component.get("layers"), list) else []
        if not layers:
            continue
        resistances: list[float] = []
        sd_values: list[float] = []
        for raw_layer in layers:
            layer = dict(raw_layer) if isinstance(raw_layer, Mapping) else {}
            thickness = _number(layer.get("thickness_m"), _number(layer.get("thickness_cm")) / 100.0)
            conductivity = _number(layer.get("conductivity_w_mk", layer.get("lambda_w_mk")))
            resistances.append(thickness / conductivity if thickness > 0 and conductivity > 0 else 0.0)
            sd_values.append(thickness * max(0.0, _number(layer.get("mu"))))
        r_total = 0.17 + sum(resistances)
        sd_total = sum(sd_values)
        r_run = 0.13
        sd_run = 0.0
        interfaces: list[dict[str, Any]] = []
        risk = False
        for index, (resistance, sd) in enumerate(zip(resistances, sd_values)):
            r_run += resistance
            sd_run += sd
            temperature = indoor_t - (indoor_t - outdoor_t) * r_run / r_total if r_total else indoor_t
            vapour = p_inside - (p_inside - p_outside) * sd_run / sd_total if sd_total else p_inside
            saturation = saturation_pressure_pa(temperature)
            condenses = vapour > saturation
            risk = risk or condenses
            interfaces.append(
                {
                    "after_layer": index + 1,
                    "temperature_c": round(temperature, 2),
                    "vapour_pressure_pa": round(vapour, 1),
                    "saturation_pressure_pa": round(saturation, 1),
                    "condensation_risk": condenses,
                }
            )
        rows.append(
            {
                "component_id": str(component.get("id") or ""),
                "component_name": str(component.get("name") or "Bauteil"),
                "risk": risk,
                "interfaces": interfaces,
            }
        )
    return {
        "components": rows,
        "risk_count": sum(1 for row in rows if row["risk"]),
        "status": "screened" if rows else "insufficient-data",
        "method": "stationary-vapour-pressure-screening",
        "normative": False,
    }


def calculate_summer_comfort(project: Mapping[str, Any]) -> dict[str, Any]:
    envelope = project.get("envelope") if isinstance(project.get("envelope"), Mapping) else {}
    zones = project.get("zones") if isinstance(project.get("zones"), list) else []
    components = envelope.get("components") if isinstance(envelope.get("components"), list) else []
    solar_w = 0.0
    for raw in components:
        item = dict(raw) if isinstance(raw, Mapping) else {}
        if str(item.get("kind")) != "window":
            continue
        area = max(0.0, _number(item.get("area_m2")))
        g_value = min(1.0, max(0.0, _number(item.get("g_value"), 0.55)))
        shade = min(1.0, max(0.0, _number(item.get("shading_factor"), 0.75)))
        orientation = str(item.get("orientation") or "mixed").lower()
        orientation_factor = {"north": 0.45, "east": 0.75, "west": 0.85, "south": 1.0}.get(orientation, 0.78)
        solar_w += area * g_value * shade * orientation_factor * 500.0
    area = sum(max(0.0, _number(dict(zone).get("floor_area_m2"))) for zone in zones if isinstance(zone, Mapping))
    specific = solar_w / area if area else 0.0
    threshold = _number(envelope.get("summer_screening_threshold_w_m2"), 45.0)
    return {
        "solar_gain_peak_w": round(solar_w, 1),
        "specific_solar_gain_w_m2": round(specific, 2),
        "screening_threshold_w_m2": round(threshold, 2),
        "screening_passed": specific <= threshold if area else False,
        "status": "screened" if area else "insufficient-data",
        "method": "solar-gain-working-screen",
        "normative": False,
    }


__all__ = [
    "calculate_heating_load",
    "calculate_moisture_screen",
    "calculate_summer_comfort",
    "saturation_pressure_pa",
]
