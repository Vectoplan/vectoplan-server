"""Orchestrate model normalization, physics modules and result gates."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Any, Mapping

from src.calculations.annual_balance import calculate_annual_balance
from src.calculations.building_physics import (
    calculate_heating_load,
    calculate_moisture_screen,
    calculate_summer_comfort,
)
from src.calculations.envelope import calculate_envelope
from src.calculations.renovation import build_renovation_variants, build_roadmap
from src.calculations.systems import calculate_system_balance
from src.calculations.ventilation import calculate_ventilation
from src.domain.model import normalize_energy_project, validate_normalized_project


PIPELINE_VERSION = "energy-pipeline/0.3"
DEFAULT_RULE_PROFILE = "de-working-2026.1"


def validate_pipeline_request(payload: Any) -> list[str]:
    if not isinstance(payload, Mapping):
        return ["request body must be a JSON object"]
    model = _request_model(payload)
    if not isinstance(model, Mapping):
        return ["project must be a JSON object"]
    return []


def _request_model(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """Unwrap ``{"project": model}`` without mistaking project metadata for it."""
    wrapped = payload.get("project")
    if (
        isinstance(wrapped, Mapping)
        and not isinstance(payload.get("building"), Mapping)
        and not isinstance(payload.get("envelope"), Mapping)
        and any(key in wrapped for key in ("building", "envelope", "geometry", "schema_version"))
    ):
        return wrapped
    return payload


def _fingerprint(project: Mapping[str, Any]) -> str:
    encoded = json.dumps(project, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256(encoded).hexdigest()[:20]


def _quality(issues: list[Mapping[str, Any]], project: Mapping[str, Any]) -> dict[str, Any]:
    errors = sum(1 for issue in issues if issue.get("severity") == "error")
    warnings = sum(1 for issue in issues if issue.get("severity") == "warning")
    components = project.get("envelope", {}).get("components", []) if isinstance(project.get("envelope"), Mapping) else []
    verified = sum(1 for item in components if isinstance(item, Mapping) and item.get("status") == "verified")
    total = len(components)
    score = max(0, min(100, 100 - errors * 18 - warnings * 6 - max(0, total - verified) * 2))
    return {
        "score_percent": score,
        "errors": errors,
        "warnings": warnings,
        "verified_components": verified,
        "component_count": total,
    }


def _compliance_screen(project: Mapping[str, Any], envelope: Mapping[str, Any], systems: Mapping[str, Any]) -> dict[str, Any]:
    targets = project.get("targets") if isinstance(project.get("targets"), Mapping) else {}
    reference_primary = targets.get("reference_primary_energy_kwh_m2a")
    reference_transmission = targets.get("reference_transmission_w_m2k")
    target_ratio = float(targets.get("primary_energy_ratio", 0.40) or 0.40)
    actual_primary = float(systems.get("primary_energy_kwh_m2a", 0.0) or 0.0)
    actual_transmission = float(envelope.get("mean_u_value_w_m2k", 0.0) or 0.0)
    checks: list[dict[str, Any]] = []
    if reference_primary is None:
        checks.append({"id": "primary-reference", "status": "data-missing", "message": "Referenzgebäude-Primärenergie fehlt."})
    else:
        limit = float(reference_primary) * target_ratio
        checks.append({"id": "primary-reference", "status": "passed" if actual_primary <= limit else "failed", "actual": round(actual_primary, 3), "limit": round(limit, 3)})
    if reference_transmission is None:
        checks.append({"id": "transmission-reference", "status": "data-missing", "message": "Referenzwert des baulichen Wärmeschutzes fehlt."})
    else:
        envelope_ratio = float(targets.get("transmission_ratio", 0.55) or 0.55)
        limit = float(reference_transmission) * envelope_ratio
        checks.append({"id": "transmission-reference", "status": "passed" if actual_transmission <= limit else "failed", "actual": round(actual_transmission, 4), "limit": round(limit, 4)})
    checks.append(
        {
            "id": "renewable-heat-screen",
            "status": "passed" if systems.get("renewable_heat_65_percent_screening") else "review",
            "actual_percent": round(float(systems.get("renewable_heat_share", 0.0)) * 100.0, 1),
            "screening_threshold_percent": 65,
        }
    )
    return {
        "target": str(targets.get("standard") or "GEG"),
        "checks": checks,
        "status": "passed" if checks and all(item["status"] == "passed" for item in checks) else "incomplete",
        "normative": False,
    }


def _stage(stage_id: str, label: str, output: Mapping[str, Any], inputs: list[str]) -> dict[str, Any]:
    return {
        "id": stage_id,
        "label": label,
        "status": "completed",
        "inputs": inputs,
        "output": dict(output),
    }


def _evaluate(model: Mapping[str, Any], include_variants: bool) -> dict[str, Any]:
    project = normalize_energy_project(model)
    issues = validate_normalized_project(project)
    envelope = calculate_envelope(project)
    ventilation = calculate_ventilation(project)
    heating_load = calculate_heating_load(project, envelope, ventilation)
    moisture = calculate_moisture_screen(project)
    summer = calculate_summer_comfort(project)
    annual = calculate_annual_balance(project, envelope, ventilation)
    systems = calculate_system_balance(project, annual)
    compliance = _compliance_screen(project, envelope, systems)
    quality = _quality(issues, project)
    stages = [
        _stage("model", "Projektmodell normalisieren", {"model_fingerprint": _fingerprint(project), "issues": issues}, ["project", "editor-selection", "cad-selection"]),
        _stage("envelope", "Gebäudehülle & Wärmebrücken", envelope, ["envelope.components", "envelope.thermal_bridges"]),
        _stage("ventilation", "Lüftung & Infiltration", ventilation, ["systems.ventilation", "zones"]),
        _stage("heating-load", "Auslegungs-Heizlast", heating_load, ["envelope", "ventilation", "climate"]),
        _stage("moisture", "Feuchteschutz-Screening", moisture, ["envelope.components.layers", "climate"]),
        _stage("summer-comfort", "Sommerlicher Wärmeschutz", summer, ["windows", "shading", "zones"]),
        _stage("annual-balance", "Jahres-Nutzenergiebilanz", annual, ["envelope", "ventilation", "usage", "climate"]),
        _stage("systems", "Anlagen-, End- und Primärenergie", systems, ["systems", "annual-balance"]),
        _stage("target-screen", "Ziel- und Regelprofilprüfung", compliance, ["targets", "systems", "envelope"]),
    ]
    summary = {
        "mean_u_value_w_m2k": envelope["mean_u_value_w_m2k"],
        "heat_transfer_w_k": envelope["total_heat_transfer_w_k"],
        "design_heat_load_kw": heating_load["design_heat_load_kw"],
        "useful_space_heating_kwh_a": annual["useful_space_heating_kwh_a"],
        "final_energy_kwh_m2a": systems["final_energy_kwh_m2a"],
        "primary_energy_kwh_m2a": systems["primary_energy_kwh_m2a"],
        "co2_kg_m2a": systems["co2_kg_m2a"],
        "energy_class": systems["energy_class"],
        "data_quality_percent": quality["score_percent"],
    }
    result: dict[str, Any] = {
        "ok": not any(issue.get("severity") == "error" for issue in issues),
        "pipeline_version": PIPELINE_VERSION,
        "rule_profile": str(project.get("targets", {}).get("rule_profile") or DEFAULT_RULE_PROFILE),
        "calculation_status": "working",
        "normative": False,
        "calculated_at": datetime.now(timezone.utc).isoformat(),
        "project_id": project["project"]["id"],
        "project_revision": project["revision"],
        "model_fingerprint": _fingerprint(project),
        "normalized_project": project,
        "summary": summary,
        "quality": quality,
        "issues": issues,
        "stages": stages,
        "compliance_screen": compliance,
        "readiness": {
            "working_calculation": True,
            "normative_output_allowed": False,
            "energy_certificate_allowed": False,
            "isfp_export_allowed": False,
            "missing_gates": [
                "validated DIN V 18599 calculation kernel",
                "complete official climate and usage profile",
                "reference-building calculation",
                "authorized expert review and signature",
                "official registration/export workflow",
            ],
        },
        "sources": [
            {"id": "geg", "url": "https://www.gesetze-im-internet.de/geg/BJNR172810020.html", "role": "legal-structure-and-output-gates"},
            {"id": "bafa-isfp", "url": "https://www.bafa.de/DE/Energie/Energieberatung/Energieberatung_Wohngebaeude/energieberatung_wohngebaeude.html", "role": "roadmap-export-gate"},
            {"id": "kfw-tfaq", "url": "https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-%28Inlandsf%C3%B6rderung%29/PDF-Dokumente/6000004865_Infoblatt_BEG_TFAQ_Effizienzhaus.pdf", "role": "funding-profile-reference"},
        ],
        "disclaimer": "Reproduzierbare Facharbeitsberechnung; kein normativer GEG-, Förder-, iSFP- oder Energieausweis-Nachweis.",
    }
    if include_variants:
        variants = build_renovation_variants(project, _evaluate)
        result["variants"] = variants
        result["renovation_roadmap"] = build_roadmap(variants)
    return result


def run_energy_pipeline(payload: Mapping[str, Any], include_variants: bool = True) -> dict[str, Any]:
    model = _request_model(payload)
    return _evaluate(model, include_variants)


__all__ = ["DEFAULT_RULE_PROFILE", "PIPELINE_VERSION", "run_energy_pipeline", "validate_pipeline_request"]
