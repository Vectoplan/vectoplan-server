"""Transparent working calculations for the energy workspace.

This module intentionally does not implement a normative GEG, DIN V 18599 or
funding calculation. It provides deterministic working values so the product
workflow, provenance and target handling can be developed safely first.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


HEATING_SYSTEMS = {
    "heat_pump": {
        "label": "Luft/Wasser-Wärmepumpe",
        "efficiency": 3.6,
        "primary_factor": 1.8,
        "co2_factor": 0.36,
    },
    "district_heating": {
        "label": "Fernwärme",
        "efficiency": 0.92,
        "primary_factor": 0.7,
        "co2_factor": 0.18,
    },
    "gas_condensing": {
        "label": "Gas-Brennwert",
        "efficiency": 0.95,
        "primary_factor": 1.1,
        "co2_factor": 0.20,
    },
    "biomass": {
        "label": "Biomasse",
        "efficiency": 0.84,
        "primary_factor": 0.2,
        "co2_factor": 0.04,
    },
}


def _number(value: Any, default: float, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return min(maximum, max(minimum, parsed))


def validate_calculation_request(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["request body must be a JSON object"]

    errors: list[str] = []
    for field in ("project_id", "building_type", "geometry", "envelope", "systems", "usage"):
        if field not in payload:
            errors.append(f"missing required field: {field}")

    if payload.get("building_type") not in {"residential", "non_residential"}:
        errors.append("building_type must be residential or non_residential")

    for field in ("geometry", "envelope", "systems", "usage"):
        if field in payload and not isinstance(payload.get(field), dict):
            errors.append(f"{field} must be an object")

    return errors


def _rating(value: float) -> dict[str, str]:
    if value < 25:
        return {"class": "A+", "tone": "excellent", "label": "sehr effizient"}
    if value < 50:
        return {"class": "A", "tone": "good", "label": "effizient"}
    if value < 75:
        return {"class": "B", "tone": "good", "label": "guter Entwurf"}
    if value < 100:
        return {"class": "C", "tone": "medium", "label": "optimierbar"}
    if value < 130:
        return {"class": "D", "tone": "medium", "label": "erhöht"}
    return {"class": "E", "tone": "critical", "label": "hoher Bedarf"}


def calculate_preview(payload: dict[str, Any]) -> dict[str, Any]:
    geometry = payload.get("geometry", {})
    envelope = payload.get("envelope", {})
    systems = payload.get("systems", {})
    usage = payload.get("usage", {})

    area = _number(geometry.get("heated_floor_area_m2"), 642.8, 20, 1_000_000)
    envelope_area = _number(geometry.get("envelope_area_m2"), area * 1.85, area * 0.5, area * 8)
    wall_u = _number(envelope.get("exterior_wall_u_value"), 0.24, 0.05, 3.0)
    roof_u = _number(envelope.get("roof_u_value"), 0.18, 0.05, 3.0)
    floor_u = _number(envelope.get("floor_u_value"), 0.28, 0.05, 3.0)
    window_u = _number(envelope.get("window_u_value"), 1.1, 0.3, 6.0)
    window_share = _number(envelope.get("window_share"), 0.18, 0.03, 0.55)

    fixed_share = 0.42
    wall_share = max(0.03, 1.0 - fixed_share - window_share)
    weighted_u = (
        wall_u * wall_share
        + roof_u * 0.21
        + floor_u * 0.21
        + window_u * window_share
    )

    indoor_temperature = _number(usage.get("indoor_temperature_c"), 20, 16, 26)
    heat_recovery = _number(systems.get("heat_recovery_rate"), 0.72, 0, 0.95)
    temperature_factor = 1 + (indoor_temperature - 20) * 0.045
    transmission_kwh = weighted_u * envelope_area * 67 * temperature_factor
    ventilation_kwh = area * 15 * (1 - heat_recovery * 0.72) * temperature_factor
    useful_space_heat_kwh = max(0.0, (transmission_kwh + ventilation_kwh) * 0.82)

    is_residential = payload.get("building_type") == "residential"
    occupants = _number(usage.get("occupants"), max(2, area / 45), 0, area)
    hot_water_kwh = occupants * (620 if is_residential else 210)
    lighting_and_aux_kwh = area * (7.5 if is_residential else 15.0)

    heating_type = str(systems.get("heating_type", "heat_pump"))
    heating = HEATING_SYSTEMS.get(heating_type, HEATING_SYSTEMS["heat_pump"])
    efficiency_default = float(heating["efficiency"])
    efficiency = _number(
        systems.get("seasonal_performance_factor"),
        efficiency_default,
        0.4,
        8.0,
    )
    heating_final_kwh = (useful_space_heat_kwh + hot_water_kwh) / efficiency

    pv_kwp = _number(systems.get("pv_peak_kwp"), 0, 0, 100_000)
    pv_self_use_kwh = min(
        heating_final_kwh + lighting_and_aux_kwh,
        pv_kwp * 930 * (0.36 if is_residential else 0.54),
    )
    final_energy_kwh = max(0.0, heating_final_kwh + lighting_and_aux_kwh - pv_self_use_kwh)
    final_energy_index = final_energy_kwh / area
    primary_energy_index = final_energy_index * float(heating["primary_factor"])
    co2_kg_m2a = final_energy_kwh * float(heating["co2_factor"]) / area

    quality_score = 82
    if payload.get("provenance", {}).get("geometry_revision"):
        quality_score += 5
    if envelope.get("source") == "library":
        quality_score += 4
    if systems.get("verified"):
        quality_score += 4
    if not usage.get("climate_location"):
        quality_score -= 7
    quality_score = int(max(35, min(98, quality_score)))

    recommendations: list[dict[str, Any]] = []
    if wall_u > 0.20:
        recommendations.append(
            {
                "id": "wall_insulation",
                "title": "Außenwand prüfen",
                "reason": "Der angesetzte U-Wert liegt über dem Zielwert der Konzeptvariante.",
                "impact": "medium",
                "suggested_value": 0.18,
                "unit": "W/(m²K)",
            }
        )
    if window_u > 1.0:
        recommendations.append(
            {
                "id": "window_quality",
                "title": "Fensterqualität vergleichen",
                "reason": "Eine bessere Verglasung reduziert den Transmissionsanteil sichtbar.",
                "impact": "medium",
                "suggested_value": 0.85,
                "unit": "W/(m²K)",
            }
        )
    if heating_type == "heat_pump" and efficiency < 3.8:
        recommendations.append(
            {
                "id": "heat_pump_temperature",
                "title": "Vorlauftemperatur optimieren",
                "reason": "Ein höherer saisonaler Leistungsfaktor verbessert die Vorschau deutlich.",
                "impact": "high",
                "suggested_value": 4.1,
                "unit": "JAZ",
            }
        )
    if pv_kwp < area * 0.018:
        recommendations.append(
            {
                "id": "pv_area",
                "title": "PV-Fläche ausschöpfen",
                "reason": "Die aktuelle Generatorleistung nutzt das angenommene Dachpotenzial nur teilweise.",
                "impact": "high",
                "suggested_value": round(area * 0.024, 1),
                "unit": "kWp",
            }
        )

    return {
        "ok": True,
        "calculation_status": "working",
        "normative": False,
        "methodology": "energy-working-model/0.2",
        "calculated_at": datetime.now(timezone.utc).isoformat(),
        "project_id": str(payload.get("project_id")),
        "metrics": {
            "weighted_u_value": round(weighted_u, 3),
            "transmission_heat_loss_kwh_a": round(transmission_kwh),
            "ventilation_heat_loss_kwh_a": round(ventilation_kwh),
            "useful_space_heat_kwh_a": round(useful_space_heat_kwh),
            "final_energy_kwh_a": round(final_energy_kwh),
            "final_energy_kwh_m2a": round(final_energy_index, 1),
            "primary_energy_kwh_m2a": round(primary_energy_index, 1),
            "co2_kg_m2a": round(co2_kg_m2a, 1),
            "pv_self_use_kwh_a": round(pv_self_use_kwh),
            "data_quality_percent": quality_score,
        },
        "rating": _rating(primary_energy_index),
        "energy_balance": [
            {"id": "transmission", "label": "Transmission", "value_kwh_a": round(transmission_kwh)},
            {"id": "ventilation", "label": "Lüftung", "value_kwh_a": round(ventilation_kwh)},
            {"id": "solar_internal", "label": "Solare + interne Gewinne", "value_kwh_a": -round((transmission_kwh + ventilation_kwh) * 0.18)},
            {"id": "pv", "label": "PV-Eigennutzung", "value_kwh_a": -round(pv_self_use_kwh)},
        ],
        "recommendations": recommendations,
        "assumptions": [
            "Vereinfachte Flächenanteile für Dach, Boden, Wand und Fenster",
            "Konzept-Klimafaktor ohne standortbezogenen Normdatensatz",
            "Keine normative Anlagen-, Zonen- oder Wärmebrückenbilanz",
        ],
        "disclaimer": (
            "Technischer Arbeitsstand; nicht für GEG-, KfW-, Energieausweis- oder andere "
            "prüffähige Nachweise verwenden."
        ),
    }


__all__ = ["HEATING_SYSTEMS", "calculate_preview", "validate_calculation_request"]
