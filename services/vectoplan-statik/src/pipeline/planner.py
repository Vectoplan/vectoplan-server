"""Rule-based planner that assembles calculation paths from persisted knowledge."""

from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Any, Mapping, Sequence

from src.knowledge.calculation_paths import CalculationPathRegistry, EXECUTABLE_PATH_STATUSES


class CalculationPathPlanner:
    plan_version = "structural-calculation-plan/0.1"

    def __init__(self, registry: CalculationPathRegistry | None = None) -> None:
        self.registry = registry or CalculationPathRegistry()

    @staticmethod
    def facts_from_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
        load_cases = [item for item in payload.get("load_cases") or [] if isinstance(item, Mapping)]
        designs = [payload.get("design"), *(payload.get("additional_designs") or [])]
        designs = [item for item in designs if isinstance(item, Mapping)]
        model = payload.get("analysis_model") if isinstance(payload.get("analysis_model"), Mapping) else {}
        environmental = payload.get("environmental_actions")
        if isinstance(environmental, Mapping):
            environmental_types = [str(key) for key, value in environmental.items() if value]
        elif isinstance(environmental, Sequence) and not isinstance(environmental, (str, bytes)):
            environmental_types = [str(item.get("kind")) for item in environmental if isinstance(item, Mapping)]
        else:
            environmental_types = []
        profile = str(payload.get("standards_profile") or "DE_EC_2021")
        requested_capabilities = list(dict.fromkeys([
            *(payload.get("requested_capabilities") or []),
            *(payload.get("required_capabilities") or []),
        ]))
        element_kind = payload.get("element_kind") or model.get("element_kind") or model.get("member_kind")
        subsystem_kind = payload.get("subsystem_kind") or model.get("subsystem_kind")
        return {
            "structure_type": payload.get("structure_type"),
            "material_kind": payload.get("material_kind"),
            "calculation_scope": payload.get("calculation_scope") or "structure",
            "element_kind": element_kind,
            "subsystem_kind": subsystem_kind,
            "project_phase": payload.get("project_phase"),
            "occupancy": payload.get("occupancy"),
            "bridge_type": payload.get("bridge_type"),
            "standards_profile": profile,
            "norm_generation": "second_generation_preview" if profile.startswith("EU_2G") else "current_first_generation",
            "analysis_kind": model.get("kind"),
            "span_count": len(model.get("spans") or []),
            "has_openings": bool(model.get("openings")),
            "has_line_supports": bool(model.get("line_supports")),
            "has_point_supports": bool(model.get("point_supports")),
            "load_case_categories": sorted({str(item.get("category")) for item in load_cases}),
            "load_case_action_types": sorted({str(item.get("action_type") or "imposed") for item in load_cases}),
            "design_types": [str(item.get("type")) for item in designs],
            "environmental_action_types": environmental_types,
            "requested_capabilities": requested_capabilities,
        }

    @staticmethod
    def _evaluate_clause(facts: Mapping[str, Any], clause: Mapping[str, Any]) -> dict[str, Any]:
        fact_name = str(clause.get("fact"))
        operator = str(clause.get("operator") or "equals")
        expected = clause.get("value")
        actual = facts.get(fact_name)
        if operator == "equals":
            matched = actual == expected
        elif operator == "not_equals":
            matched = actual != expected
        elif operator == "contains":
            matched = expected in actual if isinstance(actual, (list, tuple, set, str)) else False
        elif operator == "contains_any":
            actual_values = actual if isinstance(actual, (list, tuple, set)) else [actual]
            expected_values = expected if isinstance(expected, (list, tuple, set)) else [expected]
            matched = bool({item for item in actual_values if item is not None} & set(expected_values))
        elif operator == "exists":
            matched = (actual is not None) == bool(expected)
        elif operator == "greater_than":
            matched = actual is not None and float(actual) > float(expected)
        elif operator == "at_least":
            matched = actual is not None and float(actual) >= float(expected)
        else:
            raise ValueError(f"Unsupported calculation-path rule operator: {operator}")
        return {
            "fact": fact_name, "operator": operator, "expected": expected,
            "actual": actual, "matched": matched,
        }

    def evaluate_selection(self, selection: Mapping[str, Any], facts: Mapping[str, Any]) -> dict[str, Any]:
        all_results = [self._evaluate_clause(facts, item) for item in selection.get("all") or []]
        any_results = [self._evaluate_clause(facts, item) for item in selection.get("any") or []]
        none_results = [self._evaluate_clause(facts, item) for item in selection.get("none") or []]
        matched = (
            all(item["matched"] for item in all_results)
            and (any(item["matched"] for item in any_results) if any_results else True)
            and not any(item["matched"] for item in none_results)
        )
        return {"matched": matched, "all": all_results, "any": any_results, "none": none_results}

    @staticmethod
    def _example_substitution(example: Mapping[str, Any]) -> str:
        values = []
        for item in example.get("inputs") or []:
            values.append(f"{item.get('label')}={item.get('value')} {item.get('unit', '')}".strip())
        return "; ".join(values) if values else "unvollständig"

    @staticmethod
    def _example_result(example: Mapping[str, Any]) -> dict[str, Any]:
        result = example.get("result") if isinstance(example.get("result"), Mapping) else {}
        return {
            "label": result.get("label", "Beispielergebnis"),
            "value": result.get("value", "unvollständig"),
            "unit": result.get("unit", ""),
            "assessment": result.get("assessment"),
            "source": "catalog_example",
        }

    def _bind_steps(
        self,
        path: dict[str, Any],
        runtime_index: Mapping[str, list[dict[str, Any]]],
    ) -> list[dict[str, Any]]:
        bound = []
        path_executable = path.get("status") in EXECUTABLE_PATH_STATUSES
        for step in path.get("steps") or []:
            formula = step["formula"]
            runtime = next(
                (runtime_index[step_id][0] for step_id in step.get("runtime_step_ids") or [] if runtime_index.get(step_id)),
                None,
            )
            if runtime is not None:
                state = "executed"
                substitution = runtime.get("substitutions") or "unvollständig"
                result = {
                    "label": runtime.get("label") or step["label"],
                    "value": runtime.get("value"),
                    "unit": runtime.get("unit", ""),
                    "assessment": None,
                    "source": "runtime",
                }
            elif not path_executable or formula["status"] == "incomplete":
                state = "blocked"
                substitution = self._example_substitution(formula["example"])
                result = self._example_result(formula["example"])
            else:
                state = "planned"
                substitution = self._example_substitution(formula["example"])
                result = self._example_result(formula["example"])
            bound.append({
                **deepcopy(step),
                "execution_state": state,
                "formula_expression": runtime.get("formula") if runtime else formula["equation"],
                "substitution": substitution,
                "result": result,
                "standard_refs": list(runtime.get("standard_refs") or formula["standard_refs"]) if runtime else formula["standard_refs"],
                "assumptions": list(runtime.get("assumptions") or formula["assumptions"]) if runtime else formula["assumptions"],
            })
        return bound

    def plan_from_facts(
        self,
        facts: Mapping[str, Any],
        runtime_steps: Sequence[Mapping[str, Any]] | None = None,
    ) -> dict[str, Any]:
        runtime_index: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for step in runtime_steps or []:
            runtime_index[str(step.get("step_id"))].append(dict(step))

        selected = []
        rejected_count = 0
        for path in sorted(self.registry.records(), key=lambda item: (int(item.get("priority", 999)), item["path_id"])):
            evaluation = self.evaluate_selection(path.get("selection") or {}, facts)
            if not evaluation["matched"]:
                rejected_count += 1
                continue
            steps = self._bind_steps(path, runtime_index)
            selected.append({
                **path,
                "selection_evaluation": evaluation,
                "execution_state": "selected" if path["executable"] else "selected_but_blocked",
                "steps": steps,
            })

        flattened = [step for path in selected for step in path.get("steps") or []]
        state_counts = dict(sorted(defaultdict(int, {
            state: sum(step["execution_state"] == state for step in flattened)
            for state in {step["execution_state"] for step in flattened}
        }).items()))
        coverage = self.registry.coverage()
        return {
            "plan_version": self.plan_version,
            "facts": dict(facts),
            "selected_path_count": len(selected),
            "rejected_path_count": rejected_count,
            "paths": selected,
            "execution_summary": {
                "step_count": len(flattened),
                "by_state": state_counts,
                "runtime_step_count": len(runtime_steps or []),
                "catalog_gate_passed": coverage["gate"]["passed"],
                "unassigned_formula_count": coverage["unassigned_formula_count"],
            },
            "formula_coverage": {key: value for key, value in coverage.items() if key != "records"},
        }

    def plan(
        self,
        payload: Mapping[str, Any],
        runtime_steps: Sequence[Mapping[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return self.plan_from_facts(self.facts_from_payload(payload), runtime_steps)


__all__ = ["CalculationPathPlanner"]
