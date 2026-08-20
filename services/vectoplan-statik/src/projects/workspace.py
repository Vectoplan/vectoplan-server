"""Compose a frontend workspace from a persisted structural project case."""

from __future__ import annotations

from copy import deepcopy
import re
from typing import Any, Mapping


WORKSPACE_CONTRACT_VERSION = "structural-project-workspace/0.1"


def _slug(value: object) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", str(value or "system").lower()).strip("_")
    return normalized or "system"


def _position_kind(position: Mapping[str, Any]) -> str:
    job = position.get("job") or {}
    model = job.get("analysis_model") or {}
    design = job.get("design") or {}
    label = f"{position.get('label', '')} {position.get('group', '')}".lower()
    if design.get("type") == "foundation" or "fundament" in label or "gründung" in label:
        return "foundation"
    if model.get("kind") in {"surface_plate", "grillage_plate"} or "decke" in label or "platte" in label:
        return "slab"
    if design.get("type") == "masonry" or "wand" in label or "kern" in label or "widerlager" in label:
        return "wall"
    if "stütze" in label or "pfeiler" in label or "column" in label or "mast" in label:
        return "column"
    return "beam"


def _automatic_geometry(index: int, kind: str) -> dict[str, Any]:
    column = index % 3
    row = index // 3
    x = 125 + column * 265
    y = 125 + row * 130
    if kind == "slab":
        return {"type": "polygon", "points": [[x, y], [x + 210, y], [x + 210, y + 88], [x, y + 88]]}
    if kind == "wall":
        return {"type": "line", "start": [x + 18, y], "end": [x + 18, y + 92], "width": 16}
    if kind == "beam":
        return {"type": "line", "start": [x, y + 45], "end": [x + 210, y + 45], "width": 16}
    return {"type": "point", "point": [x + 105, y + 45], "size": 36 if kind == "foundation" else 24}


def _element_parameters(position: Mapping[str, Any]) -> dict[str, Any]:
    job = position.get("job") or {}
    model = job.get("analysis_model") or {}
    design = (job.get("design") or {}).get("parameters") or {}
    first_span = (model.get("spans") or [{}])[0]
    parameters = deepcopy(design)
    parameters.setdefault("span_m", first_span.get("length_m", model.get("length_x_m", design.get("length_m", 4.0))))
    parameters.setdefault("width_m", model.get("length_y_m", design.get("width_m", 1.0)))
    parameters.setdefault("thickness_cm", float(model.get("thickness_m", design.get("height_mm", 200) / 1000)) * 100)
    parameters.setdefault("support_condition", "continuous" if len(model.get("spans") or []) > 1 else "simply_supported")
    parameters.setdefault("superimposed_dead_load_kn_m2", 0.0)
    parameters.setdefault("variable_load_kn_m2", 0.0)
    return parameters


def build_workspace_model(payload: Mapping[str, Any], result: Mapping[str, Any]) -> dict[str, Any]:
    """Create a deterministic 2D/3D selection model for every project position."""
    workspace = payload.get("workspace") or {}
    visual_overrides = workspace.get("visuals") or {}
    result_positions = {item["position_ref"]: item for item in result.get("positions") or []}
    level_ids: dict[str, str] = {}
    levels = []
    for position in payload.get("positions") or []:
        label = str(position.get("level") or "System")
        if label not in level_ids:
            level_ref = f"level_{_slug(label)}"
            level_ids[label] = level_ref
            levels.append({"level_ref": level_ref, "label": label, "elevation_m": float(len(levels) * 3.0)})

    elements = []
    for index, position in enumerate(payload.get("positions") or []):
        position_ref = str(position["position_ref"])
        position_result = result_positions.get(position_ref, {})
        summary = (position_result.get("result") or {}).get("summary") or {}
        governing = summary.get("governing_check") or {}
        kind = _position_kind(position)
        visual = visual_overrides.get(position_ref) or {}
        kind = str(visual.get("kind") or kind)
        geometry = deepcopy(visual.get("geometry") or _automatic_geometry(index, kind))
        elements.append({
            "element_ref": position_ref,
            "kind": kind,
            "label": position.get("label", position_ref),
            "group": position.get("group", "Positionen"),
            "level_ref": level_ids[str(position.get("level") or "System")],
            "geometry": geometry,
            "parameters": _element_parameters(position),
            "provenance": {
                "geometry": "Testprojekt · lokale Arbeitskopie",
                "loads": "Projektfall · Pipeline",
                "material": "Projektfall · Katalogwert",
            },
            "review": {
                "status": summary.get("status", "unreviewed"),
                "last_utilization": governing.get("utilization", 0.0),
                "workflow_gate_passed": summary.get("workflow_gate_passed", False),
            },
        })

    load_cases: dict[str, dict[str, Any]] = {}
    for position in payload.get("positions") or []:
        for load_case in (position.get("job") or {}).get("load_cases") or []:
            identifier = str(load_case.get("load_case_id") or len(load_cases))
            load_cases.setdefault(identifier, {
                "load_case_ref": identifier,
                "label": load_case.get("label", identifier),
                "category": load_case.get("category"),
                "automatic": True,
            })

    metadata = deepcopy(payload.get("project_metadata") or {})
    metadata.update({
        "type": payload.get("structure_type") or (payload.get("positions") or [{}])[0].get("job", {}).get("structure_type", "generic"),
        "standard_basis": "Eurocode-Projektprofil · fachliche Freigabe offen",
        "review_status": "independent_review_required",
    })
    return {
        "contract_version": "structural-model/0.1",
        "project_ref": payload["project_ref"],
        "model_revision_ref": payload["model_revision_ref"],
        "project": metadata,
        "levels": levels,
        "load_cases": list(load_cases.values()),
        "elements": elements,
        "diagram_kind": workspace.get("diagram_kind", "building"),
        "automation": {
            "model_idealization": "local_project_case",
            "load_path": "project_pipeline_preview",
            "material_resolution": "project_case_catalog",
            "feedback_to_source_model": "not_connected",
        },
    }


def _knowledge_summary(result: Mapping[str, Any]) -> dict[str, Any]:
    pipelines: dict[str, dict[str, Any]] = {}
    paths: dict[str, dict[str, Any]] = {}
    standards: dict[str, dict[str, Any]] = {}
    for position in result.get("positions") or []:
        position_ref = position["position_ref"]
        position_result = position.get("result") or {}
        for pipeline in (position_result.get("workflow_plan") or {}).get("pipelines") or []:
            pipelines.setdefault(pipeline["pipeline_id"], {
                "pipeline_id": pipeline["pipeline_id"],
                "title": pipeline["title"],
                "level": pipeline.get("level"),
                "status": pipeline.get("status"),
                "runtime_gate": deepcopy(pipeline.get("runtime_gate") or {}),
                "path_refs": deepcopy(pipeline.get("path_refs") or []),
                "report_templates": deepcopy(pipeline.get("report_templates") or []),
                "positions": [],
            })["positions"].append(position_ref)
        for path in (position_result.get("calculation_plan") or {}).get("paths") or []:
            paths.setdefault(path["path_id"], {
                "path_id": path["path_id"],
                "title": path["title"],
                "status": path.get("status"),
                "executable": path.get("executable", False),
                "formula_refs": deepcopy(path.get("formula_refs") or []),
                "standard_refs": deepcopy(path.get("standard_refs") or []),
                "positions": [],
            })["positions"].append(position_ref)
        for standard in position_result.get("standards") or []:
            key = str(standard.get("designation") or standard.get("standard_id"))
            standards.setdefault(key, deepcopy(standard))
    gates = [item["runtime_gate"].get("passed", False) for item in pipelines.values()]
    return {
        "pipelines": list(pipelines.values()),
        "calculation_paths": list(paths.values()),
        "standards": list(standards.values()),
        "statistics": {
            "pipeline_count": len(pipelines),
            "calculation_path_count": len(paths),
            "standard_count": len(standards),
            "runtime_gate_passed": bool(gates) and all(gates),
        },
    }


def build_project_workspace(
    case_id: str,
    payload: Mapping[str, Any],
    result: Mapping[str, Any],
    template: Mapping[str, Any],
    *,
    api_prefix: str = "/api/v1/statik",
) -> dict[str, Any]:
    """Join project inputs, calculations, knowledge layers and output template."""
    default_ref = (payload.get("workspace") or {}).get("default_position_ref")
    if not default_ref:
        default_ref = (payload.get("positions") or [{}])[0].get("position_ref")
    return {
        "ok": True,
        "contract_version": WORKSPACE_CONTRACT_VERSION,
        "case_id": case_id,
        "project_case": deepcopy(payload),
        "model": build_workspace_model(payload, result),
        "result": deepcopy(result),
        "knowledge": _knowledge_summary(result),
        "calculation_template": {
            "template_id": template["template_id"],
            "title": template["title"],
            "outline_title": template.get("outline_profile", {}).get("outline_title", template["title"]),
            "pipeline_binding": deepcopy(template["pipeline_binding"]),
            "visualization_plan": deepcopy(template["visualization_plan"]),
            "rendering": deepcopy(template["rendering"]),
        },
        "selection": {"default_position_ref": default_ref},
        "outputs": {
            "preview_api": f"{api_prefix}/project-cases/{case_id}/preview",
            "report_api": f"{api_prefix}/project-cases/{case_id}/report",
            "html": f"{api_prefix}/project-cases/{case_id}/report.html",
            "pdf": f"{api_prefix}/project-cases/{case_id}/report.pdf",
            "template": f"/statik/ausgabevorlagen?vorlage={template['template_id']}&embedded=1",
        },
        "safety": {
            "calculation_preview": True,
            "certified": False,
            "independent_review_required": True,
            "release_gate_passed": False,
            "message": "Rechenergebnisse, Pipelines und Dokumente sind Arbeitsstände; die fachliche Freigabe bleibt gesperrt.",
        },
    }


__all__ = ["WORKSPACE_CONTRACT_VERSION", "build_project_workspace", "build_workspace_model"]
