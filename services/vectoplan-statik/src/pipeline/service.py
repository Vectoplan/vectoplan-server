"""Orchestrates standards, combinations, solvers, checks and traceability."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping

from src.design import (
    ConstructionStageDesign,
    FatigueDesign,
    FireResistanceDesign,
    FoundationBearingDesign,
    MasonryWallDesign,
    MemberStabilityDesign,
    PrestressTendonDesign,
    ReinforcedConcreteDesign,
    RetainingWallEarthPressureDesign,
    SteelMemberDesign,
    TimberMemberDesign,
)
from src.capabilities import CapabilityRegistry
from src.domain import AnalysisStatus, MaterialKind, StructureType
from src.loads import CombinationEngine, LoadCase, ThermalMovementCalculator
from src.materials import MaterialCatalog, default_material_catalog
from src.pipeline.planner import CalculationPathPlanner
from src.pipeline.workflows import StructuralPipelinePlanner
from src.solvers import BeamLineSolver, GrillagePlateSolver, NavierPlateSolver, Truss2DSolver
from src.standards import StandardsRegistry, default_standards_registry


CONTRACT_VERSION = "structural-analysis-job/0.2"


def validate_analysis_job(payload: Any) -> list[str]:
    if not isinstance(payload, Mapping):
        return ["payload must be an object"]
    errors: list[str] = []
    if payload.get("contract_version") != CONTRACT_VERSION:
        errors.append(f"contract_version must be {CONTRACT_VERSION}")
    for field in ("project_ref", "model_revision_ref", "job_ref"):
        if not str(payload.get(field, "")).strip():
            errors.append(f"{field} is required")
    try:
        StructureType(str(payload.get("structure_type", "")))
    except ValueError:
        errors.append("structure_type is not supported")
    model = payload.get("analysis_model")
    if not isinstance(model, Mapping):
        errors.append("analysis_model must be an object")
    elif model.get("kind") not in {"beam_line", "surface_plate", "grillage_plate", "truss_2d", "member_check"}:
        errors.append("analysis_model.kind must be beam_line, surface_plate, grillage_plate, truss_2d or member_check")
    load_cases = payload.get("load_cases")
    if not isinstance(load_cases, list) or not load_cases:
        errors.append("load_cases must be a non-empty array")
    return errors


class CalculationPipeline:
    pipeline_id = "vectoplan-structural-pipeline/0.2"

    def __init__(
        self,
        *,
        materials: MaterialCatalog | None = None,
        standards: StandardsRegistry | None = None,
    ) -> None:
        self.materials = materials or default_material_catalog()
        self.standards = standards or default_standards_registry()
        self.beam_solver = BeamLineSolver()
        self.plate_solver = NavierPlateSolver()
        self.grillage_solver = GrillagePlateSolver()
        self.truss_solver = Truss2DSolver()
        self.design_modules = {
            "reinforced_concrete": ReinforcedConcreteDesign(self.materials),
            "steel": SteelMemberDesign(self.materials),
            "timber": TimberMemberDesign(self.materials),
            "masonry": MasonryWallDesign(self.materials),
            "prestress_tendon": PrestressTendonDesign(self.materials),
            "foundation": FoundationBearingDesign(),
            "retaining_wall": RetainingWallEarthPressureDesign(),
            "member_stability": MemberStabilityDesign(),
            "fatigue": FatigueDesign(),
            "fire_resistance": FireResistanceDesign(),
            "construction_stages": ConstructionStageDesign(),
        }
        self.thermal_calculator = ThermalMovementCalculator()
        self.capabilities = CapabilityRegistry()
        self.path_planner = CalculationPathPlanner()
        self.workflow_planner = StructuralPipelinePlanner(path_planner=self.path_planner)

    @staticmethod
    def _fingerprint(payload: Mapping[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:20]

    @staticmethod
    def _governing(combinations: list[dict[str, Any]], limit_state: str) -> dict[str, Any] | None:
        candidates = [item for item in combinations if item["limit_state"] == limit_state]
        return max(candidates, key=lambda item: abs(float(item["value"]))) if candidates else None

    @staticmethod
    def _load_from_factors(values: Mapping[str, Any], factors: Mapping[str, Any]) -> float:
        return sum(float(value) * float(factors.get(load_case_id, 0.0)) for load_case_id, value in values.items())

    def _solve_beam(self, model: Mapping[str, Any], combinations: list[dict[str, Any]]) -> dict[str, Any]:
        selected = [self._governing(combinations, "ULS"), self._governing(combinations, "SLS")]
        analyses = []
        for combination in selected:
            if combination is None:
                continue
            spans = []
            for item in model.get("spans", []):
                spans.append({
                    "span_id": str(item["span_id"]),
                    "length_m": float(item["length_m"]),
                    "elastic_modulus_mpa": float(item["elastic_modulus_mpa"]),
                    "inertia_m4": float(item["inertia_m4"]),
                    "uniform_load_kn_m": self._load_from_factors(item.get("load_case_values_kn_m", {}), combination["factors"]),
                })
            result = self.beam_solver.solve(spans, model.get("supports"), samples_per_span=int(model.get("samples_per_span", 41)))
            analyses.append({"combination": combination, "result": result})
        if not analyses:
            raise ValueError("No beam combination could be solved")
        return {"kind": "beam_line", "analyses": analyses, "governing": self._analysis_envelope(analyses)}

    def _solve_plate(self, model: Mapping[str, Any], combinations: list[dict[str, Any]]) -> dict[str, Any]:
        selected = [self._governing(combinations, "ULS"), self._governing(combinations, "SLS")]
        analyses = []
        for combination in selected:
            if combination is None:
                continue
            uniform_load = self._load_from_factors(model.get("load_case_values_kn_m2", {}), combination["factors"])
            result = self.plate_solver.solve(
                length_x_m=float(model["length_x_m"]),
                length_y_m=float(model["length_y_m"]),
                thickness_m=float(model["thickness_m"]),
                elastic_modulus_mpa=float(model["elastic_modulus_mpa"]),
                poisson_ratio=float(model.get("poisson_ratio", 0.2)),
                uniform_load_kn_m2=uniform_load,
                terms=int(model.get("series_terms", 15)),
                grid_size=int(model.get("grid_size", 21)),
            )
            analyses.append({"combination": combination, "result": result})
        if not analyses:
            raise ValueError("No surface combination could be solved")
        return {"kind": "surface_plate", "analyses": analyses, "governing": self._analysis_envelope(analyses)}

    def _solve_grillage(self, model: Mapping[str, Any], combinations: list[dict[str, Any]]) -> dict[str, Any]:
        selected = [self._governing(combinations, "ULS"), self._governing(combinations, "SLS")]
        analyses = []
        for combination in selected:
            if combination is None:
                continue
            uniform_load = self._load_from_factors(model.get("load_case_values_kn_m2", {}), combination["factors"])
            result = self.grillage_solver.solve(
                length_x_m=float(model["length_x_m"]),
                length_y_m=float(model["length_y_m"]),
                thickness_m=float(model["thickness_m"]),
                elastic_modulus_x_mpa=float(model.get("elastic_modulus_x_mpa", model.get("elastic_modulus_mpa"))),
                elastic_modulus_y_mpa=float(model.get("elastic_modulus_y_mpa", model.get("elastic_modulus_mpa"))),
                poisson_ratio=float(model.get("poisson_ratio", 0.2)),
                uniform_load_kn_m2=uniform_load,
                nx=int(model.get("nx", 9)),
                ny=int(model.get("ny", 7)),
                edge_supports=model.get("edge_supports"),
                openings=model.get("openings"),
                line_supports=model.get("line_supports"),
                point_supports=model.get("point_supports"),
                contact_springs=model.get("contact_springs"),
                cracking=model.get("cracking"),
            )
            analyses.append({"combination": combination, "result": result})
        if not analyses:
            raise ValueError("No grillage combination could be solved")
        return {"kind": "grillage_plate", "analyses": analyses, "governing": self._analysis_envelope(analyses)}

    def _solve_truss(self, model: Mapping[str, Any], combinations: list[dict[str, Any]]) -> dict[str, Any]:
        selected = [self._governing(combinations, "ULS"), self._governing(combinations, "SLS")]
        analyses = []
        for combination in selected:
            if combination is None:
                continue
            nodal_loads = []
            for node_load in model.get("nodal_loads") or []:
                nodal_loads.append({
                    "node_id": node_load["node_id"],
                    "fx_kn": self._load_from_factors(node_load.get("fx_by_load_case_kn", {}), combination["factors"]),
                    "fy_kn": self._load_from_factors(node_load.get("fy_by_load_case_kn", {}), combination["factors"]),
                })
            result = self.truss_solver.solve(
                nodes=list(model.get("nodes") or []),
                members=list(model.get("members") or []),
                supports=list(model.get("supports") or []),
                nodal_loads=nodal_loads,
            )
            analyses.append({"combination": combination, "result": result})
        if not analyses:
            raise ValueError("No truss combination could be solved")
        governing = self._analysis_envelope(analyses)
        governing["max_abs_axial_force_kn"] = max(
            abs(float(item["result"].get("envelope", {}).get("max_abs_axial_force_kn", 0.0))) for item in analyses
        )
        return {"kind": "truss_2d", "analyses": analyses, "governing": governing}

    @staticmethod
    def _analysis_envelope(analyses: list[dict[str, Any]]) -> dict[str, Any]:
        result = {
            "max_abs_moment_knm": 0.0,
            "max_abs_shear_kn": 0.0,
            "max_abs_deflection_mm": 0.0,
            "max_abs_mx_knm_m": 0.0,
            "max_abs_my_knm_m": 0.0,
        }
        for analysis in analyses:
            envelope = analysis["result"].get("envelope", {})
            for key in result:
                result[key] = max(result[key], abs(float(envelope.get(key, 0.0))))
        return {key: round(value, 6) for key, value in result.items() if value or key == "max_abs_deflection_mm"}

    def _design(self, payload: Mapping[str, Any], analysis: dict[str, Any]) -> dict[str, Any] | None:
        designs = [payload.get("design"), *(payload.get("additional_designs") or [])]
        designs = [item for item in designs if isinstance(item, Mapping)]
        if not designs:
            return None
        results = []
        for design in designs:
            design_type = str(design.get("type", ""))
            module = self.design_modules.get(design_type)
            if module is None:
                raise ValueError(f"Unsupported design module: {design_type}")
            parameters = dict(design.get("parameters", {}))
            envelope = analysis.get("governing", {})
            if design_type in {"reinforced_concrete", "steel", "timber"}:
                parameters.setdefault("design_moment_knm", envelope.get("max_abs_moment_knm", envelope.get("max_abs_mx_knm_m", 0.0)))
                parameters.setdefault("design_shear_kn", envelope.get("max_abs_shear_kn", 0.0))
            if design_type == "timber":
                parameters.setdefault("max_deflection_mm", envelope.get("max_abs_deflection_mm", 0.0))
            if design_type == "member_stability":
                parameters.setdefault("design_axial_kn", envelope.get("max_abs_axial_force_kn", 0.0))
            results.append(module.check(parameters))
        if len(results) == 1:
            return {**results[0], "modules": results}
        return {
            "design_module": "composite_design_chain/0.1",
            "modules": results,
            "checks": [check for item in results for check in item.get("checks", [])],
            "decisions": [decision for item in results for decision in item.get("decisions", [])],
            "calculation_steps": [step for item in results for step in item.get("calculation_steps", [])],
            "verification_level": "bounded_multi_module_chain",
        }

    def _environmental(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        configured = payload.get("environmental_actions")
        if not isinstance(configured, Mapping):
            return {}
        result: dict[str, Any] = {}
        temperature = configured.get("temperature")
        if isinstance(temperature, Mapping):
            result["temperature"] = self.thermal_calculator.calculate(temperature)
        return result

    def run(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        errors = validate_analysis_job(payload)
        if errors:
            raise ValueError("; ".join(errors))
        structure_type = StructureType(str(payload["structure_type"]))
        material_kind_value = payload.get("material_kind")
        material_kind = MaterialKind(str(material_kind_value)) if material_kind_value else None
        profile = self.standards.profile(str(payload.get("standards_profile", "DE_EC_2021")))
        load_cases = [LoadCase(**item) for item in payload["load_cases"]]
        actions = {case.action_type for case in load_cases}
        if isinstance(payload.get("environmental_actions"), Mapping) and payload["environmental_actions"].get("temperature"):
            actions.add("temperature")
        selected_standards, standards_decisions = self.standards.select(
            profile_id=profile.profile_id,
            structure_type=structure_type,
            material_kind=material_kind,
            actions=actions,
        )
        design_types = {
            str(item.get("type")) for item in [payload.get("design"), *(payload.get("additional_designs") or [])]
            if isinstance(item, Mapping)
        }
        extra_standard_ids: list[str] = []
        if "fatigue" in design_types:
            extra_standard_ids.append("EN1993-1-9")
        if "fire_resistance" in design_types:
            extra_standard_ids.extend(("EN1991-1-2", "EN1993-1-2"))
        known_ids = {item.ref_id for item in selected_standards}
        selected_standards.extend(self.standards.reference(ref_id) for ref_id in extra_standard_ids if ref_id not in known_ids)
        combination_result = CombinationEngine(profile).generate(load_cases)
        model = payload["analysis_model"]
        if model["kind"] == "beam_line":
            analysis = self._solve_beam(model, combination_result["combinations"])
        elif model["kind"] == "surface_plate":
            analysis = self._solve_plate(model, combination_result["combinations"])
        elif model["kind"] == "grillage_plate":
            analysis = self._solve_grillage(model, combination_result["combinations"])
        elif model["kind"] == "truss_2d":
            analysis = self._solve_truss(model, combination_result["combinations"])
        else:
            analysis = {"kind": "member_check", "analyses": [], "governing": {}}
        design_result = self._design(payload, analysis)
        environmental = self._environmental(payload)
        environmental_records = [item for item in environmental.values() if isinstance(item, Mapping)]
        checks = list((design_result or {}).get("checks", []))
        for item in environmental_records:
            checks.extend(item.get("checks", []))
        assessed = [check for check in checks if check.get("utilization") is not None]
        governing_check = max(assessed, key=lambda item: float(item["utilization"])) if assessed else None
        status = governing_check["status"] if governing_check else AnalysisStatus.NOT_ASSESSED.value
        fingerprint = self._fingerprint(payload)
        decisions = [
            *[item.to_dict() for item in standards_decisions],
            *combination_result["decisions"],
        ]
        for item in analysis.get("analyses", []):
            decisions.extend(item["result"].get("decisions", []))
        if design_result:
            decisions.extend(design_result.get("decisions", []))
        for item in environmental_records:
            decisions.extend(item.get("decisions", []))
        calculation_steps = [*combination_result["calculation_steps"]]
        for item in analysis.get("analyses", []):
            calculation_steps.extend(item["result"].get("calculation_steps", []))
        if design_result:
            calculation_steps.extend(design_result.get("calculation_steps", []))
        for item in environmental_records:
            calculation_steps.extend(item.get("calculation_steps", []))
        calculation_plan = self.path_planner.plan(payload, calculation_steps)
        workflow_plan = self.workflow_planner.plan(payload, calculation_plan, calculation_steps)

        result = {
            "ok": True,
            "contract_version": "structural-analysis-result/0.2",
            "analysis_ref": f"analysis_{fingerprint}",
            "pipeline": self.pipeline_id,
            "project_ref": payload["project_ref"],
            "model_revision_ref": payload["model_revision_ref"],
            "job_ref": payload["job_ref"],
            "structure_type": structure_type.value,
            "verification": {
                "level": "engineering_calculation_kernel",
                "verified": False,
                "certified": False,
                "independent_review_required": True,
                "norm_text_embedded": False,
                "message": "Reproduzierbare Berechnung; Freigabe nur nach fachlicher Prüfung und Abgleich mit lizenzierten Normen.",
            },
            "standards_profile": profile.to_dict(),
            "standards": [reference.to_dict() for reference in selected_standards],
            "load_combinations": combination_result,
            "analysis": analysis,
            "design": design_result,
            "environmental_actions": environmental,
            "summary": {
                "status": status,
                "governing_check": governing_check,
                "check_count": len(checks),
                "decision_count": len(decisions),
                "calculation_step_count": len(calculation_steps),
            },
            "decisions": decisions,
            "calculation_steps": calculation_steps,
            "calculation_plan": calculation_plan,
            "workflow_plan": workflow_plan,
            "input_echo": payload,
            "regulatory_context": dict(payload.get("regulatory_context") or {}),
            "warnings": [],
        }
        regulatory = payload.get("regulatory_context") or {}
        if str(regulatory.get("approval_status", "")) != "confirmed_for_calculation":
            result["warnings"].append(profile.transition_note)
        result["capability_assessment"] = self.capabilities.assess(payload, result)
        for capability_id in result["capability_assessment"]["unresolved"]:
            result["warnings"].append(f"Angeforderte Fähigkeit nicht vollständig nachgewiesen: {capability_id}")
        result["decisions"].append({
            "decision_id": "regulatory_context",
            "subject": "Bauordnungsrechtlicher Projektstand",
            "selected": regulatory.get("technical_building_rules", "nicht bestätigt"),
            "reason": regulatory.get("decision_note", "Normgeneration und Landesrecht sind als Projekteingabe zu bestätigen."),
            "alternatives": [],
            "standard_refs": list(profile.references),
            "source": "explicit_project_configuration",
        })
        result["summary"]["decision_count"] = len(result["decisions"])
        result["summary"]["calculation_path_count"] = calculation_plan["selected_path_count"]
        result["summary"]["catalog_gate_passed"] = calculation_plan["execution_summary"]["catalog_gate_passed"]
        result["summary"]["workflow_pipeline_count"] = workflow_plan["selected_pipeline_count"]
        result["summary"]["workflow_gate_passed"] = workflow_plan["execution_summary"]["runtime_gate_passed"]
        return result
