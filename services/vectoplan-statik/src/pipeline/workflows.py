"""Selection and release gates for persistent structural workflow pipelines."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping, Sequence

from src.knowledge import StructuralPipelineRegistry
from .planner import CalculationPathPlanner


class StructuralPipelinePlanner:
    plan_version = "structural-workflow-plan/0.1"

    def __init__(
        self,
        registry: StructuralPipelineRegistry | None = None,
        path_planner: CalculationPathPlanner | None = None,
    ) -> None:
        self.registry = registry or StructuralPipelineRegistry()
        self.path_planner = path_planner or CalculationPathPlanner(self.registry.calculation_paths)

    def plan_from_facts(
        self,
        facts: Mapping[str, Any],
        calculation_plan: Mapping[str, Any] | None = None,
        runtime_steps: Sequence[Mapping[str, Any]] | None = None,
    ) -> dict[str, Any]:
        path_plan = dict(calculation_plan or self.path_planner.plan_from_facts(facts, runtime_steps))
        selected_path_ids = {item["path_id"] for item in path_plan.get("paths") or []}
        selected_pipelines = []
        rejected_count = 0
        for pipeline in self.registry.records():
            evaluation = self.path_planner.evaluate_selection(pipeline.get("selection") or {}, facts)
            if not evaluation["matched"]:
                rejected_count += 1
                continue
            record = deepcopy(pipeline)
            blockers = []
            if not record.get("executable"):
                blockers.append({
                    "phase_id": "catalog",
                    "path_id": None,
                    "reason": "Pipeline ist als Gesamtmuster noch unvollstaendig oder besitzt einen unvollstaendigen Pflichtpfad.",
                })
            if not (record.get("normative_basis") or {}).get("gate", {}).get("passed", False):
                blockers.append({
                    "phase_id": "normative_basis",
                    "path_id": None,
                    "reason": "Mindestens eine Eurocode-Regel-ID oder ergänzende Fach-, Produkt-, Betreiber- bzw. Ausführungsnorm ist noch nicht fachlich bestätigt.",
                })
            active_path_count = 0
            for phase in record.get("phases") or []:
                phase_blockers = []
                for path in phase.get("paths") or []:
                    selected = path["path_id"] in selected_path_ids
                    if path["mode"] == "required" and not selected:
                        path["execution_state"] = "missing_required"
                        reason = "Pflicht-Rechenweg wurde durch die aktuellen Projektfakten nicht aktiviert."
                        phase_blockers.append({"path_id": path["path_id"], "reason": reason})
                    elif not selected:
                        path["execution_state"] = "not_applicable"
                    elif not path["executable"]:
                        path["execution_state"] = "selected_but_blocked"
                        reason = "Ausgewaehlter Rechenweg ist noch unvollstaendig."
                        phase_blockers.append({"path_id": path["path_id"], "reason": reason})
                        active_path_count += 1
                    else:
                        path["execution_state"] = "ready_or_executed"
                        active_path_count += 1
                phase["blockers"] = phase_blockers
                phase["gate_passed"] = not phase_blockers
                blockers.extend({"phase_id": phase["phase_id"], **item} for item in phase_blockers)
            record["selection_evaluation"] = evaluation
            record["active_path_count"] = active_path_count
            record["runtime_gate"] = {
                "passed": not blockers,
                "blocker_count": len(blockers),
                "blockers": blockers,
                "rule": "Alle aktiven Pflichtpfade muessen ausgewaehlt und alle aktiven Rechenwege ausfuehrbar sein.",
            }
            selected_pipelines.append(record)

        coverage = self.registry.coverage()
        return {
            "plan_version": self.plan_version,
            "facts": dict(facts),
            "selected_pipeline_count": len(selected_pipelines),
            "rejected_pipeline_count": rejected_count,
            "pipelines": selected_pipelines,
            "execution_summary": {
                "catalog_gate_passed": coverage["gate"]["passed"],
                "unassigned_path_count": coverage["unassigned_path_count"],
                "runtime_gate_passed": all(
                    item["runtime_gate"]["passed"] for item in selected_pipelines
                ),
                "blocked_pipeline_count": sum(
                    not item["runtime_gate"]["passed"] for item in selected_pipelines
                ),
            },
            "path_coverage": {key: value for key, value in coverage.items() if key != "records"},
        }

    def plan(
        self,
        payload: Mapping[str, Any],
        calculation_plan: Mapping[str, Any] | None = None,
        runtime_steps: Sequence[Mapping[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return self.plan_from_facts(
            self.path_planner.facts_from_payload(payload),
            calculation_plan,
            runtime_steps,
        )


__all__ = ["StructuralPipelinePlanner"]
