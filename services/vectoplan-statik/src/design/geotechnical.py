"""Bounded geotechnical action model for retaining structures.

This is an auditable Rankine action calculation, not a substitute for a ground
model, soil-structure interaction analysis or a geotechnical design report.
"""

from __future__ import annotations

import math
from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord


class RetainingWallEarthPressureDesign:
    design_id = "rankine_retaining_wall_actions/0.1"

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        height_m = float(payload["height_m"])
        gamma_kn_m3 = float(payload["soil_unit_weight_kn_m3"])
        phi_deg = float(payload["friction_angle_deg"])
        surcharge_kn_m2 = float(payload.get("surcharge_kn_m2", 0.0))
        water_depth_m = max(0.0, min(height_m, float(payload.get("water_depth_m", 0.0))))
        water_gamma = float(payload.get("water_unit_weight_kn_m3", 10.0))
        resistance_kn_m = payload.get("design_horizontal_resistance_kn_m")
        if height_m <= 0 or gamma_kn_m3 <= 0 or not 0 < phi_deg < 50:
            raise ValueError("Invalid retaining-wall height or soil parameters")

        sin_phi = math.sin(math.radians(phi_deg))
        ka = (1.0 - sin_phi) / (1.0 + sin_phi)
        soil_force = 0.5 * ka * gamma_kn_m3 * height_m**2
        surcharge_force = ka * surcharge_kn_m2 * height_m
        water_force = 0.5 * water_gamma * water_depth_m**2
        total_force = soil_force + surcharge_force + water_force
        toe_moment = soil_force * height_m / 3.0 + surcharge_force * height_m / 2.0 + water_force * water_depth_m / 3.0
        checks: list[dict[str, Any]] = []
        if resistance_kn_m is not None:
            resistance = float(resistance_kn_m)
            checks.append(CheckResult(
                "retaining_horizontal_resistance", "Horizontaler Widerstand", "ULS",
                total_force, resistance, "kN/m", total_force / resistance if resistance > 0 else None,
                "Resultierende aus aktivem Erddruck, Auflast und hydrostatischem Wasserdruck.",
                ("EN1997-1",),
                ("Gleitflächen, Wandreibung, Schichtung, passive Anteile und Bauzustände sind separat zu untersuchen.",),
            ).to_dict())
        return {
            "design_module": self.design_id,
            "earth_pressure_coefficient_ka": round(ka, 5),
            "resultants": {
                "soil_kn_m": round(soil_force, 3),
                "surcharge_kn_m": round(surcharge_force, 3),
                "water_kn_m": round(water_force, 3),
                "total_horizontal_kn_m": round(total_force, 3),
                "toe_moment_knm_m": round(toe_moment, 3),
            },
            "diagram": [
                {"depth_m": 0.0, "soil_pressure_kn_m2": round(ka * surcharge_kn_m2, 3), "water_pressure_kn_m2": 0.0},
                {"depth_m": round(height_m - water_depth_m, 3), "soil_pressure_kn_m2": round(ka * (gamma_kn_m3 * (height_m - water_depth_m) + surcharge_kn_m2), 3), "water_pressure_kn_m2": 0.0},
                {"depth_m": height_m, "soil_pressure_kn_m2": round(ka * (gamma_kn_m3 * height_m + surcharge_kn_m2), 3), "water_pressure_kn_m2": round(water_gamma * water_depth_m, 3)},
            ],
            "checks": checks,
            "decisions": [DecisionRecord(
                "earth_pressure_model", "Erddruckmodell", "Rankine aktiv + hydrostatischer Wasserdruck",
                "Das Modell verwendet ausschließlich die angegebenen homogenen Boden- und Wasserparameter.",
                alternatives=("Ruhedruck", "passiver Erddruck", "geschichtetes FE-Bodenmodell"),
                standard_refs=("EN1997-1",),
            ).to_dict()],
            "calculation_steps": [
                CalculationStep("earth_ka", "Aktiver Erddruckbeiwert", "Kₐ = (1-sin φ)/(1+sin φ)", f"φ={phi_deg:g}°", round(ka, 5), "-", ("EN1997-1",)).to_dict(),
                CalculationStep("earth_force", "Resultierender Horizontalerddruck", "E = 1/2 KₐγH² + KₐqH + 1/2γwHw²", f"H={height_m:g} m; γ={gamma_kn_m3:g} kN/m³; q={surcharge_kn_m2:g} kN/m²; Hw={water_depth_m:g} m", round(total_force, 3), "kN/m", ("EN1997-1",)).to_dict(),
            ],
            "verification_level": "action_model_not_geotechnical_design",
            "applicability": {
                "supported": ["homogeneous_soil", "active_rankine_pressure", "uniform_surcharge", "hydrostatic_water"],
                "not_supported": ["soil_layers", "seepage", "wall_friction", "anchors", "sheet_pile_bending", "construction_stages"],
            },
        }


__all__ = ["RetainingWallEarthPressureDesign"]
