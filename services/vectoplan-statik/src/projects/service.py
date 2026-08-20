"""Runs a complete structural project as an auditable set of positions."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

from src.knowledge import CalculationPathRegistry, FormulaRegistry, LiteratureRegistry
from src.loads import SnowLoadCalculator, WindLoadCalculator
from src.pipeline import CalculationPipeline
from src.reports.dossier import StructuralDossierBuilder


PROJECT_CONTRACT_VERSION = "structural-project-case/0.1"


def _decode_pointer(path: str) -> list[str]:
    if not path.startswith("/"):
        raise ValueError("override path must be a JSON pointer")
    return [part.replace("~1", "/").replace("~0", "~") for part in path[1:].split("/") if part]


def apply_numeric_overrides(payload: Mapping[str, Any], overrides: Any) -> dict[str, Any]:
    """Apply numeric preview changes only to explicitly editable project input branches."""
    if not isinstance(overrides, list) or len(overrides) > 80:
        raise ValueError("overrides must be an array with at most 80 entries")
    updated = json.loads(json.dumps(payload))
    for override in overrides:
        if not isinstance(override, Mapping) or not isinstance(override.get("path"), str):
            raise ValueError("every override needs a path and numeric value")
        value = override.get("value")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("override values must be numeric")
        parts = _decode_pointer(str(override["path"]))
        allowed = (
            len(parts) >= 3 and parts[0] == "environmental_actions"
        ) or (
            len(parts) >= 5 and parts[0] == "positions" and parts[2] == "job"
            and parts[3] in {"load_cases", "analysis_model", "design", "additional_designs"}
        )
        if not allowed:
            raise ValueError(f"override path is not editable: {override['path']}")
        target: Any = updated
        try:
            for part in parts[:-1]:
                target = target[int(part)] if isinstance(target, list) else target[part]
            key = int(parts[-1]) if isinstance(target, list) else parts[-1]
            current = target[key]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ValueError(f"override path does not exist: {override['path']}") from exc
        if isinstance(current, bool) or not isinstance(current, (int, float)):
            raise ValueError(f"override target is not numeric: {override['path']}")
        target[key] = float(value)
    _synchronize_environmental_position_loads(updated)
    return updated


def _synchronize_environmental_position_loads(payload: dict[str, Any]) -> None:
    """Keep the worked snow action and the truss test load on one source of truth."""
    positions = {str(item.get("position_ref")): item for item in payload.get("positions") or []}
    for action in payload.get("environmental_actions") or []:
        if action.get("kind") != "snow" or not action.get("position_ref"):
            continue
        calculated = SnowLoadCalculator().calculate(action)
        nodal = calculated.get("nodal_load_kn")
        position = positions.get(str(action["position_ref"]))
        if nodal is None or position is None:
            continue
        job = position.get("job") or {}
        for load_case in job.get("load_cases") or []:
            if str(load_case.get("action_type")) == "snow":
                load_case["value"] = nodal
        for node_load in (job.get("analysis_model") or {}).get("nodal_loads") or []:
            values = node_load.get("fy_by_load_case_kn") or {}
            if "S" in values:
                values["S"] = -abs(float(nodal))


def _editable_variables(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    variables: list[dict[str, Any]] = []
    labels = {
        "ground_snow_load_kn_m2": "Bodenschneelast sₖ", "shape_coefficient": "Formbeiwert μᵢ",
        "exposure_coefficient": "Umgebungskoeffizient Cₑ", "thermal_coefficient": "Temperaturkoeffizient Cₜ",
        "tributary_area_m2": "Lasteinzugsfläche", "basic_wind_velocity_m_s": "Basiswindgeschwindigkeit vᵦ",
        "air_density_kg_m3": "Luftdichte ρ", "exposure_factor": "Expositionsfaktor cₑ(z)",
        "external_pressure_coefficient": "Außendruckbeiwert cₚₑ", "internal_pressure_coefficient": "Innendruckbeiwert cₚᵢ",
        "loaded_area_m2": "Belastete Fläche", "length_m": "Länge", "length_x_m": "Länge x",
        "length_y_m": "Länge y", "thickness_m": "Dicke", "elastic_modulus_mpa": "Elastizitätsmodul",
        "inertia_m4": "Flächenträgheitsmoment", "design_axial_kn": "Bemessungsnormalkraft",
        "design_moment_knm": "Bemessungsmoment", "provided_reinforcement_mm2": "Vorhandene Bewehrung",
        "width_mm": "Breite", "height_mm": "Höhe", "cover_mm": "Betondeckung",
    }

    def unit_for(name: str) -> str:
        suffixes = (("_kn_m2", "kN/m²"), ("_kn_m", "kN/m"), ("_knm", "kNm"), ("_kn", "kN"),
                    ("_kg_m3", "kg/m³"), ("_m_s", "m/s"), ("_mpa", "MPa"), ("_m4", "m⁴"),
                    ("_mm2", "mm²"), ("_mm", "mm"), ("_m2", "m²"), ("_m", "m"))
        return next((unit for suffix, unit in suffixes if name.endswith(suffix)), "–")

    for action_index, action in enumerate(payload.get("environmental_actions") or []):
        for key, value in action.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                variables.append({
                    "path": f"/environmental_actions/{action_index}/{key}", "scope": "environment",
                    "scope_ref": action.get("action_id"), "group": "Schnee" if action.get("kind") == "snow" else "Wind",
                    "label": labels.get(key, key.replace("_", " ")), "value": value, "unit": unit_for(key),
                })

    def walk(value: Any, parts: list[str], position: Mapping[str, Any], group: str) -> None:
        if isinstance(value, Mapping):
            for key, nested in value.items():
                walk(nested, [*parts, str(key)], position, group)
        elif isinstance(value, list):
            for index, nested in enumerate(value):
                walk(nested, [*parts, str(index)], position, group)
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            key = parts[-1]
            if key in {"nx", "ny", "samples_per_span"}:
                return
            variables.append({
                "path": "/" + "/".join(parts), "scope": "position", "scope_ref": position.get("position_ref"),
                "group": group, "label": labels.get(key, key.replace("_", " ")), "value": value, "unit": unit_for(key),
            })

    for position_index, position in enumerate(payload.get("positions") or []):
        job = position.get("job") or {}
        for branch, group in (
            ("load_cases", "Lastfälle"),
            ("analysis_model", "System und Geometrie"),
            ("design", "Bemessung"),
            ("additional_designs", "Zusatznachweise"),
        ):
            if branch in job:
                walk(job[branch], ["positions", str(position_index), "job", branch], position, group)
    return variables


def validate_project_case(payload: Any) -> list[str]:
    if not isinstance(payload, Mapping):
        return ["project case must be an object"]
    errors: list[str] = []
    if payload.get("contract_version") != PROJECT_CONTRACT_VERSION:
        errors.append(f"contract_version must be {PROJECT_CONTRACT_VERSION}")
    for field in ("project_ref", "model_revision_ref"):
        if not str(payload.get(field, "")).strip():
            errors.append(f"{field} is required")
    positions = payload.get("positions")
    if not isinstance(positions, list) or not positions:
        errors.append("positions must be a non-empty array")
    elif len({str(item.get("position_ref")) for item in positions if isinstance(item, Mapping)}) != len(positions):
        errors.append("position_ref must be unique")
    return errors


class ProjectCaseRepository:
    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or Path(__file__).resolve().parents[1] / "project_cases").resolve()
        self._index = self._read(self.root / "index.json")

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        with path.open("r", encoding="utf-8") as stream:
            return json.load(stream)

    def catalog(self) -> dict[str, Any]:
        return self._index

    def get(self, case_id: str) -> dict[str, Any]:
        match = next((item for item in self._index["cases"] if item["case_id"] == case_id), None)
        if not match:
            raise KeyError(case_id)
        path = (self.root / str(match["file"])).resolve()
        if path.parent != self.root or not path.is_file():
            raise ValueError("Project case path is invalid")
        return self._read(path)


class ProjectCalculationPipeline:
    pipeline_id = "vectoplan-project-calculation/0.1"

    def __init__(self) -> None:
        self.calculation = CalculationPipeline()
        self.dossiers = StructuralDossierBuilder()
        self.literature = LiteratureRegistry()
        self.formulas = FormulaRegistry()
        self.calculation_paths = CalculationPathRegistry(formulas=self.formulas)

    @staticmethod
    def _fingerprint(payload: Mapping[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:20]

    def run(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        errors = validate_project_case(payload)
        if errors:
            raise ValueError("; ".join(errors))
        positions = []
        all_checks = []
        all_warnings = []
        all_capabilities: dict[str, dict[str, Any]] = {}
        environmental_actions = []
        for action in payload.get("environmental_actions") or []:
            kind = str(action.get("kind"))
            if kind == "snow":
                calculated_action = SnowLoadCalculator().calculate(action)
            elif kind == "wind":
                calculated_action = WindLoadCalculator().calculate(action)
            else:
                raise ValueError(f"unsupported environmental action: {kind}")
            calculated_action["calculation_plan"] = self.calculation.path_planner.plan_from_facts(
                {
                    "structure_type": payload.get("structure_type"),
                    "standards_profile": payload.get("standards_profile", "DE_EC_2021"),
                    "norm_generation": "current_first_generation",
                    "analysis_kind": None,
                    "load_case_categories": [],
                    "load_case_action_types": [],
                    "design_types": [],
                    "environmental_action_types": [kind],
                    "requested_capabilities": [],
                },
                calculated_action.get("calculation_steps") or [],
            )
            environmental_actions.append(calculated_action)
        for record in payload["positions"]:
            position_ref = str(record["position_ref"])
            job = json.loads(json.dumps(record["job"]))
            job["project_ref"] = payload["project_ref"]
            job["model_revision_ref"] = payload["model_revision_ref"]
            job["element_ref"] = position_ref
            job["element_label"] = record.get("label", position_ref)
            job["project_metadata"] = dict(payload.get("project_metadata") or {})
            job["regulatory_context"] = dict(payload.get("regulatory_context") or {})
            result = self.calculation.run(job)
            dossier = self.dossiers.build(job, result)
            checks = list((result.get("design") or {}).get("checks") or [])
            all_checks.extend({**item, "position_ref": position_ref} for item in checks)
            all_warnings.extend(f"{position_ref}: {item}" for item in result.get("warnings") or [])
            for capability in (result.get("capability_assessment") or {}).get("records") or []:
                current = all_capabilities.setdefault(capability["capability_id"], {**capability, "positions": []})
                if capability.get("requested"):
                    current["positions"].append(position_ref)
                    ranking = {"not_required": 0, "calculated": 1, "external_solver_required": 2, "required_but_missing": 3}
                    if ranking.get(str(capability.get("status")), 0) >= ranking.get(str(current.get("status")), 0):
                        current.update({key: value for key, value in capability.items() if key != "positions"})
            positions.append({
                "position_ref": position_ref, "label": record.get("label", position_ref), "group": record.get("group", "Positionen"),
                "level": record.get("level"), "dependencies": list(record.get("dependencies") or []),
                "job": job, "result": result, "dossier": dossier,
            })
        assessed = [item for item in all_checks if item.get("utilization") is not None]
        governing = max(assessed, key=lambda item: float(item["utilization"])) if assessed else None
        status_order = {"not_assessed": 0, "passed": 1, "attention": 2, "not_adequate": 3}
        status = max((str(item["result"]["summary"]["status"]) for item in positions), key=lambda item: status_order.get(item, 0))
        unresolved = [item for item in all_capabilities.values() if item.get("positions") and item.get("status") != "calculated"]
        formulas = self.formulas.records()
        path_coverage = self.calculation_paths.coverage()
        workflow_gates = [
            bool(item["result"]["workflow_plan"]["execution_summary"]["runtime_gate_passed"])
            for item in positions
        ]
        return {
            "ok": True,
            "contract_version": "structural-project-result/0.1",
            "project_analysis_ref": f"project_analysis_{self._fingerprint(payload)}",
            "pipeline": self.pipeline_id,
            "project_ref": payload["project_ref"],
            "model_revision_ref": payload["model_revision_ref"],
            "project_metadata": dict(payload.get("project_metadata") or {}),
            "regulatory_context": dict(payload.get("regulatory_context") or {}),
            "positions": positions,
            "environmental_actions": environmental_actions,
            "editable_variables": _editable_variables(payload),
            "load_links": list(payload.get("load_links") or []),
            "summary": {
                "status": status, "position_count": len(positions), "check_count": len(all_checks),
                "governing_check": governing, "warning_count": len(all_warnings), "unresolved_capability_count": len(unresolved),
                "calculation_status": status,
                "runtime_gate_passed": bool(workflow_gates) and all(workflow_gates),
                "release_status": "review_required",
            },
            "capability_matrix": list(all_capabilities.values()),
            "literature_traceability": self.literature.records(),
            # Compatibility key for report renderers; records are implementation
            # methods, not the primary normative Eurocode formula catalog.
            "formula_catalog": formulas,
            "implementation_method_catalog": formulas,
            "formula_coverage": {
                **{key: value for key, value in path_coverage.items() if key != "records"},
                "statement": "Jede interne Rechenmethode ist einem aktiven, dokumentierenden, historischen oder gesperrten Rechenweg zugeordnet. Eurocode-Regelstellen werden erst nach fachlicher Kuratierung, NA-Overlay und Testfreigabe ausführbar.",
            },
            "calculation_path_catalog": {
                "schema_version": "structural-calculation-path-catalog/0.1",
                "path_count": len(self.calculation_paths.records()),
                "selected_by_position": {
                    item["position_ref"]: [path["path_id"] for path in item["result"]["calculation_plan"]["paths"]]
                    for item in positions
                },
            },
            "workflow_pipeline_catalog": {
                "schema_version": "structural-workflow-plan/0.1",
                "selected_by_position": {
                    item["position_ref"]: [
                        pipeline["pipeline_id"]
                        for pipeline in item["result"]["workflow_plan"]["pipelines"]
                    ]
                    for item in positions
                },
                "runtime_gate_by_position": {
                    item["position_ref"]: item["result"]["workflow_plan"]["execution_summary"]["runtime_gate_passed"]
                    for item in positions
                },
            },
            "warnings": list(dict.fromkeys(all_warnings)),
            "verification": {
                "certified": False, "independent_review_required": True,
                "message": "Mehrpositions-Testpipeline mit reproduzierbaren Einzelkernen; keine bauaufsichtliche Freigabe.",
            },
        }


__all__ = [
    "PROJECT_CONTRACT_VERSION", "ProjectCalculationPipeline", "ProjectCaseRepository", "apply_numeric_overrides",
    "validate_project_case",
]
