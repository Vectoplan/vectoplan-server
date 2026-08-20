"""Timber member strength and serviceability checks."""

from __future__ import annotations

from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord
from src.materials import MaterialCatalog


class TimberMemberDesign:
    design_id = "timber_member/0.2"

    def __init__(self, catalog: MaterialCatalog) -> None:
        self.catalog = catalog

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        material = self.catalog.get(str(payload.get("timber_grade", "C24")))
        kmod = float(payload.get("kmod", material.metadata.get("kmod", 0.8)))
        gamma = material.factor("gamma_m", 1.3)
        moment_knm = abs(float(payload.get("design_moment_knm", 0.0)))
        shear_kn = abs(float(payload.get("design_shear_kn", 0.0)))
        section_modulus_mm3 = float(payload["section_modulus_mm3"])
        area_mm2 = float(payload["area_mm2"])
        deflection_mm = abs(float(payload.get("max_deflection_mm", 0.0)))
        span_mm = float(payload.get("span_m", 1.0)) * 1000.0
        fm_d = kmod * material.value("fm_k") / gamma
        fv_d = kmod * material.value("fv_k") / gamma
        moment_capacity = fm_d * section_modulus_mm3 / 1_000_000.0
        shear_capacity = fv_d * area_mm2 * 2.0 / 3.0 / 1000.0
        deflection_limit = span_mm / float(payload.get("deflection_limit_ratio", 300.0))
        checks = [
            CheckResult("timber_bending", "Biegespannung", "ULS", moment_knm, moment_capacity, "kNm", moment_knm / moment_capacity, "Biegewiderstand mit explizitem kmod und γM.", ("EN1995-1-1",)),
            CheckResult("timber_shear", "Schubspannung", "ULS", shear_kn, shear_capacity, "kN", shear_kn / shear_capacity, "Rechteckiger Holzquerschnitt mit wirksamer Schubfläche 2A/3.", ("EN1995-1-1",)),
            CheckResult("timber_deflection", "Verformung", "SLS", deflection_mm, deflection_limit, "mm", deflection_mm / deflection_limit if deflection_limit else None, "Projektseitig festgelegter Verformungsgrenzwert.", ("EN1995-1-1",)),
        ]
        return {
            "design_module": self.design_id,
            "material": material.to_dict(),
            "checks": [check.to_dict() for check in checks],
            "decisions": [DecisionRecord("timber_kmod", "Modifikationsbeiwert", str(kmod), "Aus Nutzungsklasse und Lasteinwirkungsdauer; als explizite Projekteingabe gespeichert.", standard_refs=("EN1995-1-1",)).to_dict()],
            "calculation_steps": [CalculationStep("timber_fmd", "Bemessungsbiegefestigkeit", "fm,d = kmod · fm,k / γM", f"kmod={kmod:g}; fm,k={material.value('fm_k'):g}", round(fm_d, 3), "MPa", ("EN1995-1-1",)).to_dict()],
            "verification_level": "deterministic_member_check_not_certified",
        }
