"""Euler-Bernoulli beam-line solver for one, two and multiple spans.

Supported today:
* prismatic elements per span;
* vertical and rotational nodal restraints;
* uniformly distributed load per span;
* linear elastic first-order analysis.

Point loads, hinges inside a span, Timoshenko shear deformation, geometric
nonlinearity and dynamics belong to later solver adapters and are reported as
unsupported instead of being silently approximated.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from src.domain import CalculationStep, DecisionRecord
from src.solvers.linear_algebra import solve_linear_system


@dataclass(frozen=True, slots=True)
class BeamSpan:
    span_id: str
    length_m: float
    elastic_modulus_mpa: float
    inertia_m4: float
    uniform_load_kn_m: float


@dataclass(frozen=True, slots=True)
class BeamSupport:
    vertical: bool
    rotation: bool = False


def _element_stiffness(ei: float, length: float) -> list[list[float]]:
    factor = ei / length**3
    length2 = length * length
    return [
        [12 * factor, 6 * length * factor, -12 * factor, 6 * length * factor],
        [6 * length * factor, 4 * length2 * factor, -6 * length * factor, 2 * length2 * factor],
        [-12 * factor, -6 * length * factor, 12 * factor, -6 * length * factor],
        [6 * length * factor, 2 * length2 * factor, -6 * length * factor, 4 * length2 * factor],
    ]


def _matvec(matrix: list[list[float]], vector: list[float]) -> list[float]:
    return [sum(value * vector[column] for column, value in enumerate(row)) for row in matrix]


class BeamLineSolver:
    solver_id = "euler_bernoulli_beam_line/0.2"

    def solve(
        self,
        spans: Iterable[BeamSpan | dict[str, Any]],
        supports: Iterable[BeamSupport | dict[str, Any]] | None = None,
        *,
        samples_per_span: int = 41,
    ) -> dict[str, Any]:
        normalized_spans = [item if isinstance(item, BeamSpan) else BeamSpan(**item) for item in spans]
        if not normalized_spans:
            raise ValueError("At least one beam span is required")
        for span in normalized_spans:
            if span.length_m <= 0 or span.elastic_modulus_mpa <= 0 or span.inertia_m4 <= 0:
                raise ValueError(f"Span {span.span_id} has invalid stiffness or length")
        node_count = len(normalized_spans) + 1
        if supports is None:
            normalized_supports = [BeamSupport(vertical=True) for _ in range(node_count)]
        else:
            normalized_supports = [item if isinstance(item, BeamSupport) else BeamSupport(**item) for item in supports]
        if len(normalized_supports) != node_count:
            raise ValueError("One support definition is required for every beam node")

        dof_count = node_count * 2
        stiffness = [[0.0 for _ in range(dof_count)] for _ in range(dof_count)]
        loads = [0.0 for _ in range(dof_count)]
        element_data: list[tuple[list[int], list[list[float]], list[float]]] = []
        for index, span in enumerate(normalized_spans):
            length = span.length_m
            ei = span.elastic_modulus_mpa * 1000.0 * span.inertia_m4
            local_stiffness = _element_stiffness(ei, length)
            # Vertical displacement is positive upwards; positive load input acts downwards.
            load = span.uniform_load_kn_m
            fixed_load = [-load * length / 2.0, -load * length**2 / 12.0, -load * length / 2.0, load * length**2 / 12.0]
            dofs = [2 * index, 2 * index + 1, 2 * index + 2, 2 * index + 3]
            for row_local, row_global in enumerate(dofs):
                loads[row_global] += fixed_load[row_local]
                for col_local, col_global in enumerate(dofs):
                    stiffness[row_global][col_global] += local_stiffness[row_local][col_local]
            element_data.append((dofs, local_stiffness, fixed_load))

        restrained: set[int] = set()
        for node, support in enumerate(normalized_supports):
            if support.vertical:
                restrained.add(2 * node)
            if support.rotation:
                restrained.add(2 * node + 1)
        free = [dof for dof in range(dof_count) if dof not in restrained]
        displacement = [0.0] * dof_count
        if free:
            reduced_k = [[stiffness[row][column] for column in free] for row in free]
            reduced_f = [loads[row] for row in free]
            solved = solve_linear_system(reduced_k, reduced_f)
            for dof, value in zip(free, solved, strict=True):
                displacement[dof] = value

        system_force = _matvec(stiffness, displacement)
        reactions = [system_force[index] - loads[index] for index in range(dof_count)]
        result_spans: list[dict[str, Any]] = []
        max_abs_moment = 0.0
        max_abs_shear = 0.0
        max_abs_deflection = 0.0
        global_offset = 0.0
        sample_count = max(5, min(401, int(samples_per_span)))
        for span, (dofs, local_stiffness, fixed_load) in zip(normalized_spans, element_data, strict=True):
            local_displacement = [displacement[dof] for dof in dofs]
            end_actions = [value - fixed_load[index] for index, value in enumerate(_matvec(local_stiffness, local_displacement))]
            length = span.length_m
            ei = span.elastic_modulus_mpa * 1000.0 * span.inertia_m4
            samples: list[dict[str, float]] = []
            for index in range(sample_count):
                x = length * index / (sample_count - 1)
                moment = -end_actions[1] + end_actions[0] * x - span.uniform_load_kn_m * x**2 / 2.0
                shear = end_actions[0] - span.uniform_load_kn_m * x
                deflection = (
                    local_displacement[0]
                    + local_displacement[1] * x
                    + (-end_actions[1] * x**2 / 2.0 + end_actions[0] * x**3 / 6.0 - span.uniform_load_kn_m * x**4 / 24.0) / ei
                )
                samples.append({
                    "x_local_m": round(x, 6),
                    "x_global_m": round(global_offset + x, 6),
                    "moment_knm": round(moment, 6),
                    "shear_kn": round(shear, 6),
                    "deflection_mm": round(deflection * 1000.0, 6),
                })
                max_abs_moment = max(max_abs_moment, abs(moment))
                max_abs_shear = max(max_abs_shear, abs(shear))
                max_abs_deflection = max(max_abs_deflection, abs(deflection * 1000.0))
            result_spans.append({
                "span_id": span.span_id,
                "length_m": length,
                "end_actions": {
                    "left_shear_kn": round(end_actions[0], 6),
                    "left_moment_knm": round(-end_actions[1], 6),
                    "right_shear_kn": round(-end_actions[2], 6),
                    "right_moment_knm": round(end_actions[3], 6),
                },
                "samples": samples,
            })
            global_offset += length

        node_results = []
        for node in range(node_count):
            node_results.append({
                "node": node,
                "x_m": round(sum(span.length_m for span in normalized_spans[:node]), 6),
                "vertical_displacement_mm": round(displacement[2 * node] * 1000.0, 6),
                "rotation_rad": round(displacement[2 * node + 1], 9),
                "vertical_reaction_kn": round(reactions[2 * node], 6) if normalized_supports[node].vertical else None,
                "reaction_moment_knm": round(reactions[2 * node + 1], 6) if normalized_supports[node].rotation else None,
            })

        return {
            "solver": self.solver_id,
            "analysis_type": "linear_static_beam_line",
            "theory": "Euler-Bernoulli first order",
            "applicability": {
                "supported": ["one_span", "two_span", "multi_span", "cantilever", "uniform_line_load", "elastic_prismatic_spans"],
                "not_supported": ["dynamic", "geometric_nonlinearity", "material_nonlinearity", "internal_hinges", "point_loads", "shear_deformation"],
            },
            "nodes": node_results,
            "spans": result_spans,
            "envelope": {
                "max_abs_moment_knm": round(max_abs_moment, 6),
                "max_abs_shear_kn": round(max_abs_shear, 6),
                "max_abs_deflection_mm": round(max_abs_deflection, 6),
            },
            "decisions": [
                DecisionRecord(
                    decision_id="beam_solver",
                    subject="Stabtheorie",
                    selected="Euler-Bernoulli first order",
                    reason="Schlanker, linear-elastischer Balken mit kleinen Verformungen und ohne vorgegebene Schubverformung.",
                    alternatives=("Timoshenko", "second_order", "nonlinear_frame"),
                    standard_refs=("EN1990",),
                ).to_dict()
            ],
            "calculation_steps": [
                CalculationStep(
                    step_id="beam_stiffness",
                    label="Stabsteifigkeit",
                    formula="k_e = E I / L³ · [[12, 6L, -12, 6L], ...]",
                    substitutions=f"{len(normalized_spans)} Stäbe; {len(free)} freie Freiheitsgrade",
                    value=dof_count,
                    unit="Freiheitsgrade",
                    standard_refs=("EN1990",),
                    assumptions=("Linear elastisch", "Kleine Verformungen", "Bernoulli-Hypothese"),
                ).to_dict()
            ],
        }
