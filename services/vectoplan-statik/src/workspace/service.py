"""Workspace bootstrap and structural-model boundary helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping


def load_json_file(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return payload


def validate_structural_model(payload: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, Mapping):
        return ["payload must be an object"]
    if payload.get("contract_version") != "structural-model/0.1":
        errors.append("contract_version must be structural-model/0.1")
    for field in ("project_ref", "model_revision_ref", "project"):
        if not payload.get(field):
            errors.append(f"{field} is required")
    elements = payload.get("elements")
    if not isinstance(elements, list) or not elements:
        errors.append("elements must be a non-empty array")
    else:
        seen: set[str] = set()
        for index, element in enumerate(elements):
            if not isinstance(element, Mapping):
                errors.append(f"elements[{index}] must be an object")
                continue
            element_ref = str(element.get("element_ref", "")).strip()
            if not element_ref:
                errors.append(f"elements[{index}].element_ref is required")
            elif element_ref in seen:
                errors.append(f"duplicate element_ref: {element_ref}")
            seen.add(element_ref)
            if element.get("kind") not in {"slab", "beam", "column", "wall", "foundation"}:
                errors.append(f"elements[{index}].kind is unsupported")
            if not isinstance(element.get("geometry"), Mapping):
                errors.append(f"elements[{index}].geometry must be an object")
    return errors


def _integration_target(config: Mapping[str, Any], key: str, role: str) -> dict[str, Any]:
    url = str(config.get(key, "")).strip()
    return {
        "role": role,
        "configured": bool(url),
        "enabled": False,
        "connection": "not_connected",
        "activation_guard": "future_adapter_required",
    }


def build_bootstrap_payload(config: Mapping[str, Any]) -> dict[str, Any]:
    """Describe current capabilities without probing any external service."""
    return {
        "ok": True,
        "service": config["SERVICE_NAME"],
        "version": config["SERVICE_VERSION"],
        "mode": "standalone_engineering_kernel",
        "stateful_storage": False,
        "experience_modes": [
            {
                "id": "guided",
                "label": "Geführt",
                "description": "Automatik, klare Empfehlungen und nur notwendige Eingaben.",
            },
            {
                "id": "professional",
                "label": "Prüfen",
                "description": "Alle Annahmen, Rechenwerte und Änderungsentwürfe sichtbar.",
            },
        ],
        "workflow": [
            {"id": "model", "label": "Modell übernehmen", "state": "prepared"},
            {"id": "idealize", "label": "Tragwerk idealisieren", "state": "local_preview"},
            {"id": "loads", "label": "Lastabtrag bilden", "state": "local_preview"},
            {"id": "calculate", "label": "Konzept prüfen", "state": "available"},
            {"id": "review", "label": "Fachlich prüfen", "state": "available"},
            {"id": "publish", "label": "Änderungen zurückspielen", "state": "prepared"},
        ],
        "capabilities": {
            "structural_model": config["CONTRACT_VERSION"],
            "analysis_preview": "structural-analysis-result/0.1",
            "analysis_job": "structural-analysis-job/0.2",
            "analysis_result": "structural-analysis-result/0.2",
            "supported_systems": [
                "residential_building",
                "single_family_house",
                "multi_family_building",
                "high_rise_building",
                "office_building",
                "school_building",
                "hospital_building",
                "church_building",
                "assembly_building",
                "hotel_building",
                "retail_building",
                "parking_structure",
                "sports_building",
                "warehouse",
                "building_special",
                "industrial_hall",
                "bridge",
                "scaffold_standing",
                "scaffold_suspended",
                "falsework",
                "scaffold_special",
                "retaining_structure",
            ],
            "materials": ["reinforced_concrete", "prestressed_concrete", "steel", "composite", "timber", "masonry", "aluminium", "soil"],
            "analysis_models": ["beam_line", "surface_plate", "member_check"],
            "solvers": ["euler_bernoulli_beam_line/0.2", "navier_rectangular_plate/0.2"],
            "design_modules": ["reinforced_concrete", "steel", "timber", "masonry", "prestress_tendon", "foundation"],
            "exchange_formats": ["vectoplan-structural-exchange/0.2", "SAF 2.2.0"],
            "reports": ["html", "pdf"],
            "commands": [
                "update_element_parameters",
                "set_review_status",
                "add_load_case",
            ],
            "report_draft": True,
            "report_rendering": True,
            "persistence": False,
            "certified_solver": False,
        },
        "integrations": {
            "core": _integration_target(config, "CORE_INTERNAL_URL", "canonical model and revisions"),
            "cad": _integration_target(config, "CAD_INTERNAL_URL", "2D structural projection"),
            "editor": _integration_target(config, "EDITOR_INTERNAL_URL", "3D source model"),
            "library": _integration_target(config, "LIBRARY_INTERNAL_URL", "materials and component parameters"),
        },
        "safety": {
            "level": "engineering_calculation_kernel",
            "verified": False,
            "certified": False,
            "message": (
                "Ergebnisse sind nachvollziehbare Konzeptprüfungen und ersetzen "
                "keinen prüffähigen statischen Nachweis."
            ),
        },
    }
