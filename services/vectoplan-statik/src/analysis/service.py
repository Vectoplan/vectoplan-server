"""Transparent, deterministic concept checks for the first UI foundation.

The formulas intentionally remain a local preview. They make assumptions and
data provenance visible, but they are not a certified structural solver.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Mapping


CONTRACT_VERSION = "structural-analysis-request/0.1"
SUPPORT_FACTORS = {
    "simply_supported": 8.0,
    "continuous": 12.0,
    "cantilever": 2.0,
    "two_way": 14.0,
}
SLENDERNESS_LIMITS = {
    "simply_supported": 25.0,
    "continuous": 28.0,
    "cantilever": 8.0,
    "two_way": 32.0,
}
CONCRETE_STRENGTHS = {
    "C20/25": 20.0,
    "C25/30": 25.0,
    "C30/37": 30.0,
    "C35/45": 35.0,
}
STEEL_STRENGTHS = {"B500A": 500.0, "B500B": 500.0}


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def validate_analysis_request(payload: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, Mapping):
        return ["payload must be an object"]
    if payload.get("contract_version") != CONTRACT_VERSION:
        errors.append(f"contract_version must be {CONTRACT_VERSION}")
    for field in ("project_ref", "element_ref", "model_revision_ref"):
        if not str(payload.get(field, "")).strip():
            errors.append(f"{field} is required")

    assumptions = payload.get("assumptions")
    if not isinstance(assumptions, Mapping):
        return errors + ["assumptions must be an object"]

    ranges = {
        "span_m": (0.2, 100.0),
        "width_m": (0.2, 100.0),
        "thickness_cm": (5.0, 300.0),
        "superimposed_dead_load_kn_m2": (0.0, 100.0),
        "variable_load_kn_m2": (0.0, 100.0),
        "cover_mm": (5.0, 150.0),
        "provided_reinforcement_mm2_m": (1.0, 20000.0),
    }
    for field, (minimum, maximum) in ranges.items():
        value = assumptions.get(field)
        if not _is_number(value):
            errors.append(f"assumptions.{field} must be a number")
        elif not minimum <= float(value) <= maximum:
            errors.append(f"assumptions.{field} must be between {minimum:g} and {maximum:g}")

    support = assumptions.get("support_condition")
    if support not in SUPPORT_FACTORS:
        errors.append(
            "assumptions.support_condition must be one of "
            + ", ".join(sorted(SUPPORT_FACTORS))
        )
    if assumptions.get("concrete_class") not in CONCRETE_STRENGTHS:
        errors.append("assumptions.concrete_class is not supported")
    if assumptions.get("reinforcement_class") not in STEEL_STRENGTHS:
        errors.append("assumptions.reinforcement_class is not supported")
    return errors


def _status(utilization: float) -> str:
    if utilization <= 0.85:
        return "passed"
    if utilization <= 1.0:
        return "attention"
    return "not_adequate"


def _rounded(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def calculate_concept(payload: Mapping[str, Any]) -> dict[str, Any]:
    assumptions = payload["assumptions"]
    span_m = float(assumptions["span_m"])
    width_m = float(assumptions["width_m"])
    thickness_cm = float(assumptions["thickness_cm"])
    super_dead = float(assumptions["superimposed_dead_load_kn_m2"])
    variable = float(assumptions["variable_load_kn_m2"])
    cover_mm = float(assumptions["cover_mm"])
    provided_as = float(assumptions["provided_reinforcement_mm2_m"])
    support = str(assumptions["support_condition"])
    concrete_class = str(assumptions["concrete_class"])
    steel_class = str(assumptions["reinforcement_class"])

    self_weight = thickness_cm / 100.0 * 25.0
    permanent = self_weight + super_dead
    design_surface_load = 1.35 * permanent + 1.50 * variable
    support_factor = SUPPORT_FACTORS[support]
    design_moment = design_surface_load * span_m**2 / support_factor
    design_shear = design_surface_load * span_m / 2.0

    assumed_bar_diameter_mm = 12.0
    depth_mm = max(20.0, thickness_cm * 10.0 - cover_mm - assumed_bar_diameter_mm / 2.0)
    lever_arm_mm = 0.9 * depth_mm
    fyd = STEEL_STRENGTHS[steel_class] / 1.15
    bending_reinforcement = design_moment * 1_000_000.0 / (lever_arm_mm * fyd)
    minimum_reinforcement = 0.0015 * 1000.0 * thickness_cm * 10.0
    required_reinforcement = max(bending_reinforcement, minimum_reinforcement)
    bending_utilization = required_reinforcement / provided_as

    # A transparent concept-only shear capacity surrogate for early sizing.
    concrete_strength = CONCRETE_STRENGTHS[concrete_class]
    shear_capacity = 0.12 * math.sqrt(concrete_strength) * 1000.0 * depth_mm / 1000.0
    shear_utilization = design_shear / max(shear_capacity, 0.001)

    slenderness = span_m * 100.0 / thickness_cm
    slenderness_limit = SLENDERNESS_LIMITS[support]
    slenderness_utilization = slenderness / slenderness_limit

    checks = [
        {
            "id": "uls_bending",
            "label": "Biegung",
            "status": _status(bending_utilization),
            "utilization": _rounded(bending_utilization, 3),
            "design_value": _rounded(required_reinforcement, 0),
            "resistance_value": _rounded(provided_as, 0),
            "unit": "mm²/m",
            "explanation": "Erforderliche zu vorhandener Bewehrungsfläche im 1-m-Plattenstreifen.",
        },
        {
            "id": "uls_shear",
            "label": "Querkraft",
            "status": _status(shear_utilization),
            "utilization": _rounded(shear_utilization, 3),
            "design_value": _rounded(design_shear, 2),
            "resistance_value": _rounded(shear_capacity, 2),
            "unit": "kN/m",
            "explanation": "Vereinfachte Konzeptprüfung der Querkrafttragfähigkeit.",
        },
        {
            "id": "sls_slenderness",
            "label": "Schlankheit",
            "status": _status(slenderness_utilization),
            "utilization": _rounded(slenderness_utilization, 3),
            "design_value": _rounded(slenderness, 1),
            "resistance_value": _rounded(slenderness_limit, 1),
            "unit": "L/h",
            "explanation": "Frühe Gebrauchstauglichkeitsindikation aus Spannweite und Bauteilhöhe.",
        },
    ]
    governing = max(checks, key=lambda check: float(check["utilization"]))
    overall_status = str(governing["status"])

    target_thickness = max(
        16.0,
        math.ceil((span_m * 100.0 / (slenderness_limit * 0.85)) / 2.0) * 2.0,
    )
    suggested_as = math.ceil(required_reinforcement / 25.0) * 25.0
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:16]

    return {
        "ok": True,
        "contract_version": "structural-analysis-result/0.1",
        "analysis_ref": f"concept_{fingerprint}",
        "project_ref": payload["project_ref"],
        "element_ref": payload["element_ref"],
        "model_revision_ref": payload["model_revision_ref"],
        "stateful_storage": False,
        "verification": {
            "level": "concept_preview",
            "verified": False,
            "certified": False,
            "standard_basis": "Eurocode-orientierte Vorbemessungsannahmen, kein Normnachweis",
        },
        "summary": {
            "status": overall_status,
            "governing_check": governing["id"],
            "governing_label": governing["label"],
            "governing_utilization": governing["utilization"],
            "design_surface_load_kn_m2": _rounded(design_surface_load, 2),
            "design_moment_knm_m": _rounded(design_moment, 2),
            "design_shear_kn_m": _rounded(design_shear, 2),
        },
        "checks": checks,
        "recommendation": {
            "thickness_cm": _rounded(target_thickness, 0),
            "reinforcement_mm2_m": _rounded(suggested_as, 0),
            "message": (
                "Geometrie beibehalten und fachlich prüfen."
                if overall_status == "passed"
                else "Bauteilhöhe oder Bewehrung prüfen und neu berechnen."
            ),
        },
        "calculation_steps": [
            {
                "label": "Eigengewicht",
                "formula": "g₀ = h · 25 kN/m³",
                "value": _rounded(self_weight, 2),
                "unit": "kN/m²",
            },
            {
                "label": "Bemessungsflächenlast",
                "formula": "qᵈ = 1,35 · Σgₖ + 1,50 · qₖ",
                "value": _rounded(design_surface_load, 2),
                "unit": "kN/m²",
            },
            {
                "label": "Bemessungsmoment",
                "formula": f"Mᵈ = qᵈ · L² / {support_factor:g}",
                "value": _rounded(design_moment, 2),
                "unit": "kNm/m",
            },
            {
                "label": "Erforderliche Bewehrung",
                "formula": "Aₛ,erf = Mᵈ / (0,9d · fyd)",
                "value": _rounded(required_reinforcement, 0),
                "unit": "mm²/m",
            },
        ],
        "provenance": {
            "geometry": "local_sample_model_or_user_input",
            "loads": "local_sample_model_or_user_input",
            "materials": "local_fallback_catalog",
            "future_sources": ["vectoplan-core", "vectoplan-cad", "vectoplan-editor", "vectoplan-library"],
        },
        "warnings": [
            "Keine FE-Berechnung, Stabilitätsanalyse oder vollständige Normkombinatorik.",
            "Freigabe und prüffähige Dokumentation müssen durch eine qualifizierte Fachperson erfolgen.",
        ],
        "input_echo": {
            "span_m": span_m,
            "width_m": width_m,
            "thickness_cm": thickness_cm,
            "support_condition": support,
            "concrete_class": concrete_class,
        },
    }
