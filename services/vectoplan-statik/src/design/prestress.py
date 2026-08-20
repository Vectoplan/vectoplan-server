"""Prestressing tendon force and immediate-loss model."""

from __future__ import annotations

import math
from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord
from src.materials import MaterialCatalog


class PrestressTendonDesign:
    design_id = "prestress_tendon_force/0.2"

    def __init__(self, catalog: MaterialCatalog) -> None:
        self.catalog = catalog

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        material = self.catalog.get(str(payload.get("prestress_grade", "Y1860S7")))
        area_mm2 = float(payload["area_mm2"])
        length_m = float(payload["length_m"])
        theta_rad = abs(float(payload.get("angular_change_rad", 0.0)))
        friction_mu = float(payload.get("friction_mu", 0.19))
        wobble_1_m = float(payload.get("wobble_1_m", 0.006))
        anchorage_slip_mm = float(payload.get("anchorage_slip_mm", 6.0))
        relaxation_percent = float(payload.get("relaxation_percent", 2.5))
        fpk = material.value("fpk")
        fp01k = material.value("fp01k")
        max_stress = min(0.80 * fpk, 0.90 * fp01k)
        initial_force_kn = max_stress * area_mm2 / 1000.0
        after_friction_kn = initial_force_kn * math.exp(-(friction_mu * theta_rad + wobble_1_m * length_m))
        slip_loss_kn = material.elastic_modulus_mpa * area_mm2 * (anchorage_slip_mm / (length_m * 1000.0)) / 1000.0
        after_slip_kn = max(0.0, after_friction_kn - slip_loss_kn)
        effective_force_kn = after_slip_kn * (1.0 - relaxation_percent / 100.0)
        total_loss = 1.0 - effective_force_kn / initial_force_kn if initial_force_kn else 1.0
        check = CheckResult("prestress_initial_stress", "Zulässige Spannstahlspannung beim Spannen", "ULS", max_stress, min(0.80 * fpk, 0.90 * fp01k), "MPa", 1.0, "Anfangsspannung ist auf die kleinste der expliziten Grenzen gesetzt.", ("EN1992-1-1",))
        return {
            "design_module": self.design_id,
            "material": material.to_dict(),
            "forces_kn": {"jack": round(initial_force_kn, 3), "after_friction": round(after_friction_kn, 3), "after_anchorage_slip": round(after_slip_kn, 3), "effective_after_relaxation": round(effective_force_kn, 3)},
            "total_immediate_loss_percent": round(total_loss * 100.0, 3),
            "checks": [check.to_dict()],
            "decisions": [DecisionRecord("prestress_loss_model", "Spannkraftverluste", "Reibung + Welligkeit + Verankerungsschlupf + vorgegebene Relaxation", "Die Eingabe beschreibt ein nachträglich gespanntes Spannglied; Langzeitverluste aus Kriechen und Schwinden benötigen das Gesamtbauteilmodell.", alternatives=("time_dependent_section_analysis",), standard_refs=("EN1992-1-1",)).to_dict()],
            "calculation_steps": [
                CalculationStep("prestress_friction", "Reibungsverlust", "P(x)=P0·exp[-(μθ+kx)]", f"μ={friction_mu:g}; θ={theta_rad:g}; k={wobble_1_m:g}; x={length_m:g}", round(after_friction_kn, 3), "kN", ("EN1992-1-1",)).to_dict(),
                CalculationStep("prestress_slip", "Verankerungsschlupf", "ΔP = Ep Ap Δs / L", f"Δs={anchorage_slip_mm:g} mm", round(slip_loss_kn, 3), "kN", ("EN1992-1-1",)).to_dict(),
            ],
            "verification_level": "tendon_force_model_not_full_member_verification",
        }
