"""Simplified masonry wall compression and eccentricity checks."""

from __future__ import annotations

from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord
from src.materials import MaterialCatalog


class MasonryWallDesign:
    design_id = "masonry_wall_compression/0.2"

    def __init__(self, catalog: MaterialCatalog) -> None:
        self.catalog = catalog

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        material = self.catalog.get(str(payload.get("masonry_grade", "MZ12_NMIIA")))
        length_m = float(payload["length_m"])
        thickness_m = float(payload["thickness_m"])
        height_m = float(payload["height_m"])
        axial_kn = abs(float(payload.get("design_axial_kn", 0.0)))
        moment_knm = abs(float(payload.get("design_moment_knm", 0.0)))
        if min(length_m, thickness_m, height_m) <= 0:
            raise ValueError("Invalid masonry wall geometry")
        eccentricity_m = moment_knm / axial_kn if axial_kn > 1e-9 else 0.0
        eccentricity_ratio = eccentricity_m / thickness_m
        slenderness = height_m / thickness_m
        # Conservative transparent reduction for the concept stage.
        reduction = max(0.15, min(1.0, (1.0 - 2.0 * eccentricity_ratio) * (1.0 - max(0.0, slenderness - 10.0) / 60.0)))
        fk = material.value("fk")
        fd = fk / material.factor("gamma_m", 1.5)
        resistance_kn = reduction * fd * length_m * thickness_m * 1_000.0
        checks = [
            CheckResult("masonry_compression", "Normalkrafttragfähigkeit", "ULS", axial_kn, resistance_kn, "kN", axial_kn / resistance_kn if resistance_kn > 0 else None, "Drucktragfähigkeit mit offengelegter Schlankheits- und Exzentrizitätsreduktion.", ("EN1996-1-1",), ("Konzeptmodell; detaillierte Rand- und Knotenbedingungen separat nachweisen.",)),
            CheckResult("masonry_middle_third", "Kernbereich", "ULS", eccentricity_m, thickness_m / 6.0, "m", eccentricity_m / (thickness_m / 6.0), "Kontrolle, ob die Resultierende im mittleren Drittel liegt.", ("EN1996-1-1",)),
        ]
        return {
            "design_module": self.design_id,
            "material": material.to_dict(),
            "reduction_factor": round(reduction, 4),
            "slenderness": round(slenderness, 4),
            "eccentricity_m": round(eccentricity_m, 6),
            "checks": [check.to_dict() for check in checks],
            "decisions": [DecisionRecord("masonry_model", "Mauerwerkswand", "Vertikaler Druck mit Einachs-Exzentrizität", "Lasten enthalten N und M um die Wanddickenachse.", alternatives=("nonlinear_shell", "panel_model"), standard_refs=("EN1996-1-1",)).to_dict()],
            "calculation_steps": [CalculationStep("masonry_resistance", "Wandtragfähigkeit", "NRd = Φ · fd · l · t", f"Φ={reduction:.3f}; fd={fd:.3f} MPa", round(resistance_kn, 3), "kN", ("EN1996-1-1",)).to_dict()],
            "verification_level": "concept_wall_check_not_certified",
        }
