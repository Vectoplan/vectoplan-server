"""Transparent reinforced-concrete section checks for rectangular members."""

from __future__ import annotations

import math
from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord
from src.materials import MaterialCatalog


class ReinforcedConcreteDesign:
    design_id = "rc_rectangular_section/0.2"

    def __init__(self, catalog: MaterialCatalog) -> None:
        self.catalog = catalog

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        concrete = self.catalog.get(str(payload.get("concrete_class", "C25/30")))
        steel = self.catalog.get(str(payload.get("reinforcement_class", "B500B")))
        b_mm = float(payload["width_mm"])
        h_mm = float(payload["height_mm"])
        cover_mm = float(payload.get("cover_mm", 30.0))
        bar_mm = float(payload.get("bar_diameter_mm", 12.0))
        moment_knm = abs(float(payload.get("design_moment_knm", 0.0)))
        shear_kn = abs(float(payload.get("design_shear_kn", 0.0)))
        provided_as = float(payload.get("provided_reinforcement_mm2", 0.0))
        if min(b_mm, h_mm) <= 0 or cover_mm + bar_mm / 2 >= h_mm:
            raise ValueError("Invalid reinforced-concrete section geometry")
        d_mm = h_mm - cover_mm - bar_mm / 2.0
        z_mm = min(0.95 * d_mm, 0.9 * d_mm)
        fck = concrete.value("fck")
        fctm = concrete.value("fctm")
        fyk = steel.value("fyk")
        fyd = fyk / steel.factor("gamma_s", 1.15)
        fcd = 0.85 * fck / concrete.factor("gamma_c", 1.50)
        bending_as = moment_knm * 1_000_000.0 / max(z_mm * fyd, 1e-9)
        minimum_ratio = max(0.26 * fctm / fyk, 0.0013)
        minimum_as = minimum_ratio * b_mm * d_mm
        required_as = max(bending_as, minimum_as)
        bending_utilization = required_as / provided_as if provided_as > 0 else None

        rho = min(0.02, max(required_as, provided_as) / max(b_mm * d_mm, 1e-9))
        k = min(2.0, 1.0 + math.sqrt(200.0 / d_mm))
        vrdc_mpa = max(
            (0.18 / concrete.factor("gamma_c", 1.50)) * k * (100.0 * rho * fck) ** (1.0 / 3.0),
            0.035 * k**1.5 * math.sqrt(fck),
        )
        shear_capacity_kn = vrdc_mpa * b_mm * d_mm / 1000.0
        shear_utilization = shear_kn / shear_capacity_kn if shear_capacity_kn > 0 else None
        compression_depth_mm = required_as * fyd / max(0.8 * b_mm * fcd, 1e-9)
        ductility_utilization = compression_depth_mm / max(0.45 * d_mm, 1e-9)

        checks = [
            CheckResult("rc_bending", "Biegebewehrung", "ULS", required_as, provided_as or None, "mm²", bending_utilization, "Erforderliche und vorhandene Längsbewehrung des Rechteckquerschnitts.", ("EN1992-1-1",)),
            CheckResult("rc_shear", "Querkraft ohne Querkraftbewehrung", "ULS", shear_kn, shear_capacity_kn, "kN", shear_utilization, "Betontraganteil mit expliziter Längsbewehrungsquote; Mindest- und Maximalregeln sind sichtbar.", ("EN1992-1-1",), ("Nur für den dokumentierten Rechteckquerschnitt und ohne Vorspannung.",)),
            CheckResult("rc_ductility", "Druckzonenhöhe", "ULS", compression_depth_mm, 0.45 * d_mm, "mm", ductility_utilization, "Konzeptkontrolle der relativen Druckzonenhöhe.", ("EN1992-1-1",)),
        ]
        stirrup_area = payload.get("stirrup_area_mm2")
        stirrup_spacing = payload.get("stirrup_spacing_mm")
        shear_with_stirrups_kn = None
        if stirrup_area is not None and stirrup_spacing is not None:
            asw_mm2 = float(stirrup_area)
            spacing_mm = float(stirrup_spacing)
            cot_theta = max(1.0, min(2.5, float(payload.get("cot_theta", 2.0))))
            if min(asw_mm2, spacing_mm) <= 0:
                raise ValueError("Stirrup area and spacing must be positive")
            shear_with_stirrups_kn = asw_mm2 / spacing_mm * z_mm * fyd * cot_theta / 1000.0
            checks = [item for item in checks if item.check_id != "rc_shear"]
            checks.append(CheckResult(
                "rc_shear_reinforcement", "Querkraftbewehrung", "ULS", shear_kn, shear_with_stirrups_kn, "kN",
                shear_kn / shear_with_stirrups_kn if shear_with_stirrups_kn > 0 else None,
                "Traganteil der ausdrücklich angegebenen Bügelbewehrung mit dokumentierter Druckstrebenneigung.",
                ("EN1992-1-1",), ("Der Druckstreben- und Mindestbewehrungsnachweis ist projektspezifisch zu ergänzen.",),
            ))
        return {
            "design_module": self.design_id,
            "material": {"concrete": concrete.to_dict(), "reinforcement": steel.to_dict()},
            "section": {"width_mm": b_mm, "height_mm": h_mm, "effective_depth_mm": round(d_mm, 3), "lever_arm_mm": round(z_mm, 3)},
            "required_reinforcement_mm2": round(required_as, 3),
            "minimum_reinforcement_mm2": round(minimum_as, 3),
            "checks": [check.to_dict() for check in checks],
            "decisions": [DecisionRecord("rc_section_model", "Betonquerschnitt", "Rechteckquerschnitt mit vereinfachtem Rechteckspannungsblock", "Geometrie und Material sind als Stahlbeton-Rechteckquerschnitt angegeben.", standard_refs=("EN1992-1-1",)).to_dict()],
            "calculation_steps": [
                CalculationStep("rc_design_strengths", "Bemessungsfestigkeiten", "fcd = 0,85 fck / γc; fyd = fyk / γs", f"fck={fck:g}; fyk={fyk:g}", round(fyd, 3), "MPa", ("EN1992-1-1",)).to_dict(),
                CalculationStep("rc_bending_as", "Erforderliche Biegebewehrung", "As,req = MEd / (z fyd)", f"MEd={moment_knm:g} kNm; z={z_mm:.1f} mm", round(required_as, 3), "mm²", ("EN1992-1-1",)).to_dict(),
                CalculationStep("rc_shear_capacity", "Querkrafttragfähigkeit", "VRd,c = vRd,c · bw · d", f"vRd,c={vrdc_mpa:.3f} MPa; bw={b_mm:g} mm; d={d_mm:.1f} mm", round(shear_capacity_kn, 3), "kN", ("EN1992-1-1",)).to_dict(),
                *([CalculationStep("rc_shear_stirrups", "Querkraftbewehrung", "VRd,s = Asw/s · z · fywd · cot(theta)", f"Asw={float(stirrup_area):g} mm²; s={float(stirrup_spacing):g} mm; z={z_mm:.1f} mm", round(shear_with_stirrups_kn, 3), "kN", ("EN1992-1-1",)).to_dict()] if shear_with_stirrups_kn is not None else []),
            ],
            "verification_level": "deterministic_section_check_not_certified",
        }
