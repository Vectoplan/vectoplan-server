"""Explicit special checks for stability, fatigue, fire and construction stages.

Each class exposes a deliberately bounded engineering model.  The returned
trace names the input that has to be supplied by a qualified engineer; no
module silently invents temperatures, detail categories or effective lengths.
"""

from __future__ import annotations

import math
from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord


class MemberStabilityDesign:
    design_id = "elastic_member_stability/0.1"

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        length_m = float(payload["length_m"])
        factor = float(payload.get("effective_length_factor", 1.0))
        elastic_mpa = float(payload["elastic_modulus_mpa"])
        inertia_m4 = float(payload["inertia_m4"])
        axial_kn = abs(float(payload["design_axial_kn"]))
        first_order_moment = abs(float(payload.get("first_order_moment_knm", 0.0)))
        if min(length_m, factor, elastic_mpa, inertia_m4) <= 0:
            raise ValueError("Invalid member stability input")
        critical_kn = math.pi**2 * elastic_mpa * 1000.0 * inertia_m4 / (factor * length_m) ** 2
        ratio = axial_kn / critical_kn
        magnification = 1.0 / (1.0 - ratio) if ratio < 1.0 else float("inf")
        second_order_moment = first_order_moment * magnification
        checks = [CheckResult(
            "elastic_euler_stability", "Elastische Knicklast", "ULS", axial_kn, critical_kn, "kN", ratio,
            "Vergleich der Bemessungsnormalkraft mit der elastischen Euler-Knicklast des angegebenen Stabes.",
            ("EN1993-1-1",),
            ("Kein Ersatz für werkstoffabhängige Knickkurven, Imperfektionen oder räumliches Biegedrillknicken.",),
        )]
        moment_resistance = payload.get("design_moment_resistance_knm")
        if moment_resistance is not None:
            resistance = float(moment_resistance)
            checks.append(CheckResult(
                "second_order_moment", "Moment Theorie II. Ordnung", "ULS", second_order_moment, resistance, "kNm",
                second_order_moment / resistance if resistance > 0 else None,
                "Elastisch vergrößertes Moment aus dem ausdrücklich angegebenen Erstordnungswert.", ("EN1990", "EN1993-1-1"),
            ))
        return {
            "design_module": self.design_id,
            "critical_load_kn": round(critical_kn, 6),
            "magnification_factor": round(magnification, 6) if math.isfinite(magnification) else None,
            "second_order_moment_knm": round(second_order_moment, 6) if math.isfinite(second_order_moment) else None,
            "checks": [item.to_dict() for item in checks],
            "decisions": [DecisionRecord(
                "stability_model", "Stabilitätsmodell", "Elastische Euler-Eigenlast mit Momentenvergrößerung",
                "Stablänge, Lagerungsbeiwert und Biegesteifigkeit sind projektspezifisch angegeben.",
                alternatives=("member buckling curve", "geometrically nonlinear frame", "shell eigenvalue"), standard_refs=("EN1990", "EN1993-1-1"),
            ).to_dict()],
            "calculation_steps": [
                CalculationStep("euler_ncr", "Kritische Normalkraft", "Ncr = pi² E I / (k L)²", f"E={elastic_mpa:g} MPa; I={inertia_m4:g} m4; kL={factor*length_m:g} m", round(critical_kn, 6), "kN", ("EN1993-1-1",)).to_dict(),
                CalculationStep("second_order_factor", "Momentenvergrößerung", "eta = 1 / (1 - NEd/Ncr)", f"NEd={axial_kn:g} kN; Ncr={critical_kn:.3f} kN", round(magnification, 6) if math.isfinite(magnification) else "instabil", "-", ("EN1990",)).to_dict(),
            ],
            "verification_level": "elastic_member_stability_not_general_3d_stability",
        }


class FatigueDesign:
    design_id = "constant_amplitude_fatigue/0.1"

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        stress_range = abs(float(payload["stress_range_mpa"]))
        detail_category = float(payload["detail_category_mpa"])
        cycles = float(payload["cycles"])
        reference_cycles = float(payload.get("reference_cycles", 2_000_000.0))
        slope = float(payload.get("sn_slope", 3.0))
        if min(detail_category, cycles, reference_cycles, slope) <= 0:
            raise ValueError("Invalid fatigue input")
        resistance = detail_category * (reference_cycles / cycles) ** (1.0 / slope)
        check = CheckResult(
            "constant_amplitude_fatigue", "Ermüdung - konstante Spannungsschwingbreite", "FAT", stress_range,
            resistance, "MPa", stress_range / resistance, "S-N-Nachweis für eine ausdrücklich gewählte Kerbfallkategorie und Lastspielzahl.",
            ("EN1993-1-9",), ("Keine Schadensakkumulation aus einem variablen Lastkollektiv; Schweißdetail und Kerbfall sind fachlich festzulegen.",),
        )
        return {
            "design_module": self.design_id, "checks": [check.to_dict()],
            "decisions": [DecisionRecord("fatigue_detail", "Ermüdungsdetail", f"Detailkategorie {detail_category:g}", "Die Kategorie wurde als explizite Projekteingabe übernommen; sie wird nicht aus Geometrie geraten.", standard_refs=("EN1993-1-9",)).to_dict()],
            "calculation_steps": [CalculationStep("fatigue_sn", "Zulässige Spannungsschwingbreite", "Delta_sigma_R = Delta_sigma_C (NC/N)^(1/m)", f"Delta_sigma_C={detail_category:g} MPa; N={cycles:g}; m={slope:g}", round(resistance, 6), "MPa", ("EN1993-1-9",)).to_dict()],
            "verification_level": "constant_amplitude_detail_check",
        }


class FireResistanceDesign:
    design_id = "explicit_fire_reduction_check/0.1"

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        action = abs(float(payload["fire_design_action"]))
        ambient_resistance = float(payload["ambient_design_resistance"])
        reduction = float(payload["verified_reduction_factor"])
        duration = float(payload["fire_duration_min"])
        unit = str(payload.get("unit", "kN"))
        if ambient_resistance <= 0 or not 0 < reduction <= 1 or duration <= 0:
            raise ValueError("Invalid fire resistance input")
        fire_resistance = ambient_resistance * reduction
        check = CheckResult(
            "fire_reduced_resistance", f"Brandwiderstand R{duration:g}", "ACC-FIRE", action, fire_resistance, unit,
            action / fire_resistance, "Widerstand im Brandfall mit einem projektspezifisch verifizierten Reduktionsfaktor.",
            ("EN1990", "EN1991-1-2"),
            ("Temperaturfeld und Reduktionsfaktor müssen aus einem passenden materialbezogenen Brandnachweis stammen.",),
        )
        return {
            "design_module": self.design_id, "checks": [check.to_dict()],
            "decisions": [DecisionRecord("fire_model", "Brandnachweis", "Expliziter reduzierter Widerstand", "Der Rechenkern übernimmt keine implizite Temperatur oder Materialabminderung.", alternatives=("thermal section analysis", "advanced fire FEM"), standard_refs=("EN1991-1-2",)).to_dict()],
            "calculation_steps": [CalculationStep("fire_reduction", "Reduzierter Brandwiderstand", "Rfi,d = ktheta * Rd", f"Rd={ambient_resistance:g} {unit}; ktheta={reduction:g}; t={duration:g} min", round(fire_resistance, 6), unit, ("EN1991-1-2",)).to_dict()],
            "verification_level": "explicit_reduction_not_thermal_analysis",
        }


class ConstructionStageDesign:
    design_id = "sequential_construction_stage/0.1"

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        stages = list(payload.get("stages") or [])
        if not stages:
            raise ValueError("At least one construction stage is required")
        cumulative = 0.0
        records = []
        maximum = 0.0
        for index, stage in enumerate(stages, 1):
            increment = float(stage["effect_increment"])
            factor = float(stage.get("factor", 1.0))
            cumulative += increment * factor
            maximum = max(maximum, abs(cumulative))
            records.append({"sequence": index, "stage_id": stage.get("stage_id", f"stage_{index}"), "increment": increment, "factor": factor, "cumulative_effect": round(cumulative, 6), "active_components": list(stage.get("active_components") or [])})
        resistance = payload.get("design_resistance")
        checks = []
        if resistance is not None:
            resistance_value = float(resistance)
            checks.append(CheckResult("construction_stage_envelope", "Bauzustandsumhüllende", "ULS-STAGE", maximum, resistance_value, str(payload.get("unit", "kN")), maximum / resistance_value if resistance_value > 0 else None, "Sequenzielle Überlagerung der explizit angegebenen Bauzustandswirkungen.", ("EN1990",), ("Steifigkeitsänderungen und Umlagerungen müssen als Stufenwerte aus einem geeigneten Modell stammen.",)))
        return {
            "design_module": self.design_id, "stages": records, "checks": [item.to_dict() for item in checks],
            "decisions": [DecisionRecord("stage_sequence", "Bauzustände", "Explizite Reihenfolge", "Jede Aktivierung und Laständerung ist als eigene Stufe dokumentiert.", alternatives=("time dependent nonlinear FEM",), standard_refs=("EN1990",)).to_dict()],
            "calculation_steps": [CalculationStep("stage_accumulation", "Bauzustandsfolge", "E_i = E_(i-1) + gamma_i Delta_E_i", f"{len(records)} Stufen", round(maximum, 6), str(payload.get("unit", "kN")), ("EN1990",)).to_dict()],
            "verification_level": "sequential_effect_accumulation_not_stage_fem",
        }


__all__ = ["ConstructionStageDesign", "FatigueDesign", "FireResistanceDesign", "MemberStabilityDesign"]
