"""Steel cross-section resistance checks."""

from __future__ import annotations

import math
from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord
from src.materials import MaterialCatalog


class SteelMemberDesign:
    design_id = "steel_cross_section/0.2"

    def __init__(self, catalog: MaterialCatalog) -> None:
        self.catalog = catalog

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        material = self.catalog.get(str(payload.get("steel_grade", "S355")))
        fy = material.value("fy")
        gamma = material.factor("gamma_m0", 1.0)
        area_mm2 = float(payload["area_mm2"])
        shear_area_mm2 = float(payload.get("shear_area_mm2", area_mm2 * 0.6))
        section_modulus_cm3 = float(payload["section_modulus_cm3"])
        moment_knm = abs(float(payload.get("design_moment_knm", 0.0)))
        shear_kn = abs(float(payload.get("design_shear_kn", 0.0)))
        axial_kn = abs(float(payload.get("design_axial_kn", 0.0)))
        moment_resistance = section_modulus_cm3 * 1000.0 * fy / gamma / 1_000_000.0
        shear_resistance = shear_area_mm2 * fy / (math.sqrt(3.0) * gamma) / 1000.0
        axial_resistance = area_mm2 * fy / gamma / 1000.0
        interaction = axial_kn / axial_resistance + moment_knm / moment_resistance
        checks = [
            CheckResult("steel_bending", "Querschnittstragfähigkeit Biegung", "ULS", moment_knm, moment_resistance, "kNm", moment_knm / moment_resistance, "Elastische/plastische Querschnittstragfähigkeit entsprechend dem übergebenen Widerstandsmoment.", ("EN1993-1-1",)),
            CheckResult("steel_shear", "Querschnittstragfähigkeit Querkraft", "ULS", shear_kn, shear_resistance, "kN", shear_kn / shear_resistance, "Schubtragfähigkeit aus Schubfläche und Streckgrenze.", ("EN1993-1-1",)),
            CheckResult("steel_nm", "Interaktion Normalkraft/Biegung", "ULS", interaction, 1.0, "-", interaction, "Lineare Konzeptinteraktion; Stabilität und Querschnittsklasse sind separat zu ergänzen.", ("EN1993-1-1",), ("Kein Biegedrillknicken oder globaler Stabilitätsnachweis.",)),
        ]
        return {
            "design_module": self.design_id,
            "material": material.to_dict(),
            "checks": [check.to_dict() for check in checks],
            "decisions": [DecisionRecord("steel_resistance_model", "Stahlquerschnitt", "Querschnittswiderstände ohne globale Stabilität", "Nur Querschnittskenngrößen und Schnittgrößen wurden übergeben.", alternatives=("member_buckling", "lateral_torsional_buckling"), standard_refs=("EN1993-1-1",)).to_dict()],
            "calculation_steps": [CalculationStep("steel_mrd", "Biegewiderstand", "MRd = W · fy / γM0", f"W={section_modulus_cm3:g} cm³; fy={fy:g} MPa", round(moment_resistance, 3), "kNm", ("EN1993-1-1",)).to_dict()],
            "verification_level": "deterministic_cross_section_check_not_certified",
        }
