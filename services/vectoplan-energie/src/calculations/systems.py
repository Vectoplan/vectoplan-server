"""Energy carriers, system effort, renewables and emissions."""

from __future__ import annotations

from typing import Any, Mapping


ENERGY_CARRIERS = {
    "electricity": {"primary_factor": 1.8, "co2_kg_kwh": 0.36},
    "natural_gas": {"primary_factor": 1.1, "co2_kg_kwh": 0.20},
    "district_heating": {"primary_factor": 0.7, "co2_kg_kwh": 0.18},
    "biomass": {"primary_factor": 0.2, "co2_kg_kwh": 0.04},
    "heating_oil": {"primary_factor": 1.1, "co2_kg_kwh": 0.266},
}

SYSTEM_DEFAULTS = {
    "heat_pump": ("electricity", 3.6),
    "district_heating": ("district_heating", 0.92),
    "gas_condensing": ("natural_gas", 0.95),
    "biomass": ("biomass", 0.84),
    "oil_condensing": ("heating_oil", 0.92),
}


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def energy_class(final_energy_kwh_m2a: float) -> str:
    for boundary, label in ((30, "A+"), (50, "A"), (75, "B"), (100, "C"), (130, "D"), (160, "E"), (200, "F"), (250, "G")):
        if final_energy_kwh_m2a <= boundary:
            return label
    return "H"


def calculate_system_balance(project: Mapping[str, Any], annual: Mapping[str, Any]) -> dict[str, Any]:
    systems = project.get("systems") if isinstance(project.get("systems"), Mapping) else {}
    heating = systems.get("heating") if isinstance(systems.get("heating"), Mapping) else {}
    renewables = systems.get("renewables") if isinstance(systems.get("renewables"), Mapping) else {}
    zones = project.get("zones") if isinstance(project.get("zones"), list) else []
    building = project.get("building") if isinstance(project.get("building"), Mapping) else {}
    system_type = str(heating.get("type") or "heat_pump")
    carrier_default, efficiency_default = SYSTEM_DEFAULTS.get(system_type, ("electricity", 1.0))
    carrier = str(heating.get("energy_carrier") or carrier_default)
    carrier_data = ENERGY_CARRIERS.get(carrier, ENERGY_CARRIERS["electricity"])
    efficiency = max(0.1, _number(heating.get("seasonal_performance_factor", heating.get("efficiency")), efficiency_default))
    useful_heating = max(0.0, _number(annual.get("useful_space_heating_kwh_a")))
    useful_hot_water = max(0.0, _number(annual.get("useful_hot_water_kwh_a")))
    heating_final = (useful_heating + useful_hot_water) / efficiency
    area = sum(max(0.0, _number(dict(zone).get("floor_area_m2"))) for zone in zones if isinstance(zone, Mapping))
    is_residential = str(building.get("type")) == "residential"
    lighting = area * max(0.0, _number(systems.get("lighting_kwh_m2a"), 7.5 if is_residential else 15.0))
    auxiliary = area * max(0.0, _number(systems.get("auxiliary_kwh_m2a"), 2.0 if is_residential else 4.5))
    pv_peak = max(0.0, _number(renewables.get("pv_peak_kwp")))
    pv_yield = max(0.0, _number(renewables.get("specific_yield_kwh_kwp_a"), 930.0))
    pv_generation = pv_peak * pv_yield
    self_use_fraction = min(1.0, max(0.0, _number(renewables.get("self_use_fraction"), 0.36 if is_residential else 0.54)))
    demand_before_pv = heating_final + lighting + auxiliary
    demand_coverage_cap = min(
        1.0,
        max(0.0, _number(renewables.get("maximum_self_use_demand_coverage"), 0.75 if is_residential else 0.90)),
    )
    pv_self_use = min(demand_before_pv * demand_coverage_cap, pv_generation * self_use_fraction)
    final_energy = max(0.0, demand_before_pv - pv_self_use)
    primary_factor = max(0.0, _number(heating.get("primary_energy_factor"), carrier_data["primary_factor"]))
    co2_factor = max(0.0, _number(heating.get("co2_kg_kwh"), carrier_data["co2_kg_kwh"]))
    primary_energy = final_energy * primary_factor
    renewable_heat = max(0.0, _number(heating.get("renewable_heat_share"), 1.0 if system_type == "heat_pump" else 0.0))
    final_index = final_energy / area if area else 0.0
    return {
        "heating_system_type": system_type,
        "energy_carrier": carrier,
        "seasonal_efficiency": round(efficiency, 4),
        "heating_and_hot_water_final_kwh_a": round(heating_final, 2),
        "lighting_kwh_a": round(lighting, 2),
        "auxiliary_kwh_a": round(auxiliary, 2),
        "pv_generation_kwh_a": round(pv_generation, 2),
        "pv_self_use_kwh_a": round(pv_self_use, 2),
        "pv_self_use_demand_coverage_cap": round(demand_coverage_cap, 3),
        "final_energy_kwh_a": round(final_energy, 2),
        "final_energy_kwh_m2a": round(final_index, 3),
        "primary_energy_factor": round(primary_factor, 4),
        "primary_energy_kwh_a": round(primary_energy, 2),
        "primary_energy_kwh_m2a": round(primary_energy / area, 3) if area else 0.0,
        "co2_kg_a": round(final_energy * co2_factor, 2),
        "co2_kg_m2a": round(final_energy * co2_factor / area, 3) if area else 0.0,
        "renewable_heat_share": round(renewable_heat, 4),
        "renewable_heat_65_percent_screening": renewable_heat >= 0.65,
        "energy_class": energy_class(final_index) if is_residential else None,
        "factor_profile": "de-working-factors/2026.1",
        "normative": False,
    }


__all__ = ["ENERGY_CARRIERS", "SYSTEM_DEFAULTS", "calculate_system_balance", "energy_class"]
