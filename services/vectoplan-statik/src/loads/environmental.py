"""Transparent environmental action calculations used by project dossiers.

These helpers calculate effects from explicit project inputs.  They deliberately
do not derive climatic map values, exposure categories or National Annex values.
"""

from __future__ import annotations

from typing import Any, Mapping

from src.domain import CalculationStep, CheckResult, DecisionRecord


class SnowLoadCalculator:
    """Calculate roof snow from explicitly selected National-Annex parameters."""

    calculation_id = "roof_snow_load/0.1"

    def calculate(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        sk = float(payload["ground_snow_load_kn_m2"])
        mu = float(payload["shape_coefficient"])
        ce = float(payload.get("exposure_coefficient", 1.0))
        ct = float(payload.get("thermal_coefficient", 1.0))
        if min(sk, mu, ce, ct) < 0 or ce == 0 or ct == 0:
            raise ValueError("Snow-load parameters must be non-negative and Ce/Ct positive")
        roof_load = mu * ce * ct * sk
        tributary_area = payload.get("tributary_area_m2")
        nodal_load = roof_load * float(tributary_area) if tributary_area is not None else None
        steps = [CalculationStep(
            "roof_snow", "Schneelast auf dem Dach", "s = μᵢ · Cₑ · Cₜ · sₖ",
            f"μᵢ={mu:g}; Cₑ={ce:g}; Cₜ={ct:g}; sₖ={sk:g} kN/m²",
            roof_load, "kN/m²", ("DIN EN 1991-1-3", "DIN EN 1991-1-3/NA:2019-04"),
            ("Formbeiwert und Boden-Schneelast wurden projektspezifisch gewählt",),
        ).to_dict()]
        if nodal_load is not None:
            area = float(tributary_area)
            if area <= 0:
                raise ValueError("Snow tributary area must be positive")
            steps.append(CalculationStep(
                "snow_to_node", "Schneeflächenlast als Knotenlast", "Fₛ = s · Aₑ",
                f"s={roof_load:g} kN/m²; Aₑ={area:g} m²", nodal_load, "kN",
                ("DIN EN 1991-1-3",), ("Zugeordnete Lasteinzugsfläche",),
            ).to_dict())
        return {
            "action_id": str(payload.get("action_id") or "snow"),
            "kind": "snow", "calculation": self.calculation_id,
            "title": str(payload.get("label") or "Schneelast Dach"),
            "input_source": "explicit_project_input",
            "roof_snow_load_kn_m2": round(roof_load, 6),
            "nodal_load_kn": round(nodal_load, 6) if nodal_load is not None else None,
            "position_ref": payload.get("position_ref"),
            "calculation_steps": steps,
            "decisions": [DecisionRecord(
                "snow_parameters", "Schneelastparameter", "explizite Projekteingaben",
                "Schneezone, Geländehöhe und Dachgeometrie sind nicht aus Karten geraten; sₖ und μᵢ müssen nachvollziehbar vorgegeben werden.",
                alternatives=("verifizierter Klimadaten-/NA-Dienst",),
                standard_refs=("DIN EN 1991-1-3", "DIN EN 1991-1-3/NA:2019-04"),
            ).to_dict()],
            "applicability": {
                "supported": ["uniform_roof_snow", "explicit_shape_coefficient", "tributary_nodal_load"],
                "not_supported": ["automatic_snow_zone_lookup", "drift_accumulation", "exceptional_snow", "local_drift_at_obstacles"],
            },
        }


class WindLoadCalculator:
    """Transparent basic wind-pressure chain using explicit exposure coefficients."""

    calculation_id = "wind_pressure/0.1"

    def calculate(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        vb = float(payload["basic_wind_velocity_m_s"])
        rho = float(payload.get("air_density_kg_m3", 1.25))
        ce = float(payload["exposure_factor"])
        cpe = float(payload["external_pressure_coefficient"])
        cpi = float(payload["internal_pressure_coefficient"])
        if vb <= 0 or rho <= 0 or ce <= 0:
            raise ValueError("Wind velocity, air density and exposure factor must be positive")
        qb = 0.5 * rho * vb**2 / 1000.0
        qp = ce * qb
        net_coefficient = cpe - cpi
        net_pressure = qp * net_coefficient
        loaded_area = payload.get("loaded_area_m2")
        resultant = net_pressure * float(loaded_area) if loaded_area is not None else None
        steps = [
            CalculationStep(
                "basic_velocity_pressure", "Basisgeschwindigkeitsdruck", "qᵦ = 0,5 · ρ · vᵦ²",
                f"ρ={rho:g} kg/m³; vᵦ={vb:g} m/s", qb, "kN/m²",
                ("DIN EN 1991-1-4", "DIN EN 1991-1-4/NA:2024-08"),
                ("Basiswindgeschwindigkeit projektspezifisch vorgegeben",),
            ).to_dict(),
            CalculationStep(
                "peak_velocity_pressure", "Böengeschwindigkeitsdruck", "qₚ(z) = cₑ(z) · qᵦ",
                f"cₑ(z)={ce:g}; qᵦ={qb:.6f} kN/m²", qp, "kN/m²",
                ("DIN EN 1991-1-4", "DIN EN 1991-1-4/NA:2024-08"),
                ("Expositionsfaktor enthält die projektbezogene Geländewirkung",),
            ).to_dict(),
            CalculationStep(
                "net_wind_pressure", "Resultierender Winddruck", "w = qₚ(z) · (cₚₑ − cₚᵢ)",
                f"qₚ={qp:.6f} kN/m²; cₚₑ={cpe:g}; cₚᵢ={cpi:g}", net_pressure, "kN/m²",
                ("DIN EN 1991-1-4", "DIN EN 1991-1-4/NA:2024-08"),
                ("Außen- und Innendruck wirken für die betrachtete Fläche gleichzeitig",),
            ).to_dict(),
        ]
        if resultant is not None:
            area = float(loaded_area)
            if area <= 0:
                raise ValueError("Wind loaded area must be positive")
            steps.append(CalculationStep(
                "wind_resultant", "Windresultierende", "F𝑤 = w · A",
                f"w={net_pressure:.6f} kN/m²; A={area:g} m²", resultant, "kN",
                ("DIN EN 1991-1-4",), ("Konstanter Druck über die angegebene Teilfläche",),
            ).to_dict())
        return {
            "action_id": str(payload.get("action_id") or "wind"),
            "kind": "wind", "calculation": self.calculation_id,
            "title": str(payload.get("label") or "Windlast Fassade"),
            "input_source": "explicit_project_input",
            "basic_velocity_pressure_kn_m2": round(qb, 6),
            "peak_velocity_pressure_kn_m2": round(qp, 6),
            "net_pressure_kn_m2": round(net_pressure, 6),
            "resultant_kn": round(resultant, 6) if resultant is not None else None,
            "position_ref": payload.get("position_ref"),
            "calculation_steps": steps,
            "decisions": [DecisionRecord(
                "wind_parameters", "Windlastparameter", "explizite Projekteingaben",
                "Windzone, Geländekategorie, Gebäudehöhe und Druckbeiwerte werden nicht erraten, sondern im Rechenblatt offengelegt.",
                alternatives=("verifizierter Windzonen-/Geländedienst", "vollständige zonierte Fassadenbelegung"),
                standard_refs=("DIN EN 1991-1-4", "DIN EN 1991-1-4/NA:2024-08"),
            ).to_dict()],
            "applicability": {
                "supported": ["basic_velocity_pressure", "explicit_exposure_factor", "net_surface_pressure"],
                "not_supported": ["automatic_wind_zone_lookup", "orography", "dynamic_response", "vortex_shedding", "aeroelastic_instability"],
            },
        }


class ThermalMovementCalculator:
    """Calculate free longitudinal thermal movement and optional bearing checks."""

    calculation_id = "free_thermal_movement/0.1"

    def calculate(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        length_m = float(payload["length_m"])
        alpha_1_k = float(payload.get("thermal_expansion_1_k", 1.0e-5))
        delta_t_positive_k = abs(float(payload.get("delta_t_positive_k", 0.0)))
        delta_t_negative_k = abs(float(payload.get("delta_t_negative_k", 0.0)))
        if length_m <= 0 or alpha_1_k <= 0:
            raise ValueError("Thermal movement requires positive length and expansion coefficient")

        expansion_mm = alpha_1_k * delta_t_positive_k * length_m * 1000.0
        contraction_mm = alpha_1_k * delta_t_negative_k * length_m * 1000.0
        checks: list[dict[str, Any]] = []
        positive_capacity = payload.get("bearing_positive_capacity_mm")
        negative_capacity = payload.get("bearing_negative_capacity_mm")
        if positive_capacity is not None:
            capacity = float(positive_capacity)
            checks.append(CheckResult(
                "thermal_bearing_positive", "Lagerweg Erwärmung", "SLS",
                expansion_mm, capacity, "mm", expansion_mm / capacity if capacity > 0 else None,
                "Freie Längenänderung wird mit dem angegebenen positiven Lagerweg verglichen.",
                ("EN1991-1-5",),
                ("Zwang, Lagerreibung, Bauwerk-Boden-Interaktion und nichtlineare Temperaturanteile sind nicht enthalten.",),
            ).to_dict())
        if negative_capacity is not None:
            capacity = float(negative_capacity)
            checks.append(CheckResult(
                "thermal_bearing_negative", "Lagerweg Abkühlung", "SLS",
                contraction_mm, capacity, "mm", contraction_mm / capacity if capacity > 0 else None,
                "Freie Längenänderung wird mit dem angegebenen negativen Lagerweg verglichen.",
                ("EN1991-1-5",),
                ("Zwang, Lagerreibung, Bauwerk-Boden-Interaktion und nichtlineare Temperaturanteile sind nicht enthalten.",),
            ).to_dict())

        return {
            "calculation": self.calculation_id,
            "input_source": "explicit_project_input",
            "expansion_mm": round(expansion_mm, 3),
            "contraction_mm": round(contraction_mm, 3),
            "total_range_mm": round(expansion_mm + contraction_mm, 3),
            "checks": checks,
            "decisions": [DecisionRecord(
                "thermal_model", "Temperaturbewegung", "freie lineare Längenänderung",
                "Länge, Temperaturdifferenzen und Ausdehnungskoeffizient wurden projektspezifisch vorgegeben.",
                alternatives=("gekoppeltes Zwangsmodell", "nichtlineares Temperaturprofil"),
                standard_refs=("EN1991-1-5",),
            ).to_dict()],
            "calculation_steps": [CalculationStep(
                "thermal_expansion", "Freie Längenänderung", "ΔL = α · ΔT · L",
                f"α={alpha_1_k:g} 1/K; L={length_m:g} m; ΔT+={delta_t_positive_k:g} K; ΔT-={delta_t_negative_k:g} K",
                f"+{expansion_mm:.3f} / -{contraction_mm:.3f}", "mm", ("EN1991-1-5",),
                ("Gleichmäßiger Temperaturanteil", "Freie Bewegung ohne Zwang"),
            ).to_dict()],
            "applicability": {
                "supported": ["uniform_temperature_component", "free_longitudinal_movement", "bearing_range_comparison"],
                "not_supported": ["thermal_gradient", "bearing_friction", "soil_structure_interaction", "nonlinear_restraint"],
            },
        }


__all__ = ["SnowLoadCalculator", "ThermalMovementCalculator", "WindLoadCalculator"]
