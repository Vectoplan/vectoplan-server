"""Discrete orthogonal grillage solver for rectangular floor systems.

The solver is deliberately narrower than a shell FEM.  It represents a plate
by two orthogonal families of Euler-Bernoulli strips with shared vertical
translations.  This makes openings, internal line/point supports, orthotropic
strip stiffness and vertical springs explicit without claiming membrane or
general three-dimensional behaviour.
"""

from __future__ import annotations

import math
from typing import Any, Mapping

from src.domain import CalculationStep, DecisionRecord
from src.solvers.linear_algebra import solve_linear_system


class GrillagePlateSolver:
    solver_id = "orthogonal_grillage_plate/0.1"

    @staticmethod
    def _inside_opening(x: float, y: float, openings: list[Mapping[str, Any]]) -> bool:
        return any(
            float(item["x_min_m"]) < x < float(item["x_max_m"])
            and float(item["y_min_m"]) < y < float(item["y_max_m"])
            for item in openings
        )

    @staticmethod
    def _beam_stiffness(elastic_modulus_kn_m2: float, inertia_m4: float, length_m: float) -> list[list[float]]:
        factor = elastic_modulus_kn_m2 * inertia_m4 / length_m**3
        length2 = length_m**2
        return [
            [12 * factor, 6 * length_m * factor, -12 * factor, 6 * length_m * factor],
            [6 * length_m * factor, 4 * length2 * factor, -6 * length_m * factor, 2 * length2 * factor],
            [-12 * factor, -6 * length_m * factor, 12 * factor, -6 * length_m * factor],
            [6 * length_m * factor, 2 * length2 * factor, -6 * length_m * factor, 4 * length2 * factor],
        ]

    @staticmethod
    def _nearest_node(
        x: float,
        y: float,
        nodes: list[dict[str, Any]],
    ) -> int:
        return min(nodes, key=lambda node: (node["x_m"] - x) ** 2 + (node["y_m"] - y) ** 2)["index"]

    def solve(
        self,
        *,
        length_x_m: float,
        length_y_m: float,
        thickness_m: float,
        elastic_modulus_x_mpa: float,
        elastic_modulus_y_mpa: float,
        uniform_load_kn_m2: float,
        poisson_ratio: float = 0.2,
        nx: int = 9,
        ny: int = 7,
        edge_supports: list[str] | None = None,
        openings: list[Mapping[str, Any]] | None = None,
        line_supports: list[Mapping[str, Any]] | None = None,
        point_supports: list[Mapping[str, Any]] | None = None,
        contact_springs: list[Mapping[str, Any]] | None = None,
        cracking: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        if min(length_x_m, length_y_m, thickness_m, elastic_modulus_x_mpa, elastic_modulus_y_mpa) <= 0:
            raise ValueError("Grillage dimensions, thickness and elastic moduli must be positive")
        if not 0 <= poisson_ratio < 0.5:
            raise ValueError("Poisson ratio must be between 0 and 0.5")
        nx = max(5, min(17, int(nx)))
        ny = max(5, min(17, int(ny)))
        dx = length_x_m / (nx - 1)
        dy = length_y_m / (ny - 1)
        openings = list(openings or [])
        line_supports = list(line_supports or [])
        point_supports = list(point_supports or [])
        contact_springs = list(contact_springs or [])
        edge_supports = list(edge_supports or ["x_min", "x_max", "y_min", "y_max"])

        nodes: list[dict[str, Any]] = []
        node_by_grid: dict[tuple[int, int], int] = {}
        for iy in range(ny):
            y = iy * dy
            for ix in range(nx):
                x = ix * dx
                if self._inside_opening(x, y, openings):
                    continue
                index = len(nodes)
                nodes.append({"index": index, "ix": ix, "iy": iy, "x_m": x, "y_m": y})
                node_by_grid[(ix, iy)] = index

        if len(nodes) < 4:
            raise ValueError("Openings remove too much of the grillage model")

        elements: list[dict[str, Any]] = []
        for iy in range(ny):
            for ix in range(nx - 1):
                left = node_by_grid.get((ix, iy))
                right = node_by_grid.get((ix + 1, iy))
                if left is not None and right is not None:
                    elements.append({"axis": "x", "i": left, "j": right, "length_m": dx, "strip_width_m": dy})
        for iy in range(ny - 1):
            for ix in range(nx):
                lower = node_by_grid.get((ix, iy))
                upper = node_by_grid.get((ix, iy + 1))
                if lower is not None and upper is not None:
                    elements.append({"axis": "y", "i": lower, "j": upper, "length_m": dy, "strip_width_m": dx})

        constrained_w: set[int] = set()
        tolerance = max(dx, dy) * 0.55
        for node in nodes:
            if "x_min" in edge_supports and node["ix"] == 0:
                constrained_w.add(node["index"])
            if "x_max" in edge_supports and node["ix"] == nx - 1:
                constrained_w.add(node["index"])
            if "y_min" in edge_supports and node["iy"] == 0:
                constrained_w.add(node["index"])
            if "y_max" in edge_supports and node["iy"] == ny - 1:
                constrained_w.add(node["index"])
        for support in line_supports:
            axis = str(support.get("axis", "x"))
            coordinate = float(support["coordinate_m"])
            start = float(support.get("start_m", 0.0))
            end = float(support.get("end_m", length_x_m if axis == "y" else length_y_m))
            for node in nodes:
                transverse = node["y_m"] if axis == "x" else node["x_m"]
                longitudinal = node["x_m"] if axis == "x" else node["y_m"]
                if abs(transverse - coordinate) <= tolerance and start - tolerance <= longitudinal <= end + tolerance:
                    constrained_w.add(node["index"])
        for support in point_supports:
            constrained_w.add(self._nearest_node(float(support["x_m"]), float(support["y_m"]), nodes))
        if not constrained_w:
            raise ValueError("Grillage model has no vertical supports")

        spring_by_node: dict[int, float] = {}
        compression_only: set[int] = set()
        for spring in contact_springs:
            node_index = self._nearest_node(float(spring["x_m"]), float(spring["y_m"]), nodes)
            spring_by_node[node_index] = spring_by_node.get(node_index, 0.0) + float(spring["stiffness_kn_m"])
            if bool(spring.get("compression_only", False)):
                compression_only.add(node_index)

        crack_threshold = float((cracking or {}).get("cracking_moment_knm_m", 0.0))
        cracked_factor_target = float((cracking or {}).get("cracked_stiffness_factor", 0.45))
        cracked_factor_target = max(0.15, min(1.0, cracked_factor_target))
        stiffness_factor = 1.0
        active_springs = set(spring_by_node)
        iterations: list[dict[str, Any]] = []
        final_displacements: list[float] = []
        final_reactions: dict[int, float] = {}
        final_mx: list[list[float | None]] = []
        final_my: list[list[float | None]] = []

        for iteration in range(1, 9):
            dof_count = len(nodes) * 3
            stiffness = [[0.0 for _ in range(dof_count)] for _ in range(dof_count)]
            loads = [0.0 for _ in range(dof_count)]
            for element in elements:
                axis = element["axis"]
                elastic = (elastic_modulus_x_mpa if axis == "x" else elastic_modulus_y_mpa) * 1000.0 * stiffness_factor
                inertia = element["strip_width_m"] * thickness_m**3 / 12.0
                local = self._beam_stiffness(elastic, inertia, element["length_m"])
                rotation_offset = 2 if axis == "x" else 1
                indices = [3 * element["i"], 3 * element["i"] + rotation_offset, 3 * element["j"], 3 * element["j"] + rotation_offset]
                for row, global_row in enumerate(indices):
                    for column, global_column in enumerate(indices):
                        stiffness[global_row][global_column] += local[row][column]
            for node in nodes:
                ix, iy = node["ix"], node["iy"]
                tributary_x = dx * (0.5 if ix in {0, nx - 1} else 1.0)
                tributary_y = dy * (0.5 if iy in {0, ny - 1} else 1.0)
                loads[3 * node["index"]] -= uniform_load_kn_m2 * tributary_x * tributary_y
            for node_index in active_springs:
                stiffness[3 * node_index][3 * node_index] += spring_by_node[node_index]

            max_diagonal = max(abs(stiffness[index][index]) for index in range(dof_count)) or 1.0
            for node in nodes:
                stiffness[3 * node["index"] + 1][3 * node["index"] + 1] += max_diagonal * 1e-10
                stiffness[3 * node["index"] + 2][3 * node["index"] + 2] += max_diagonal * 1e-10
            constrained = {3 * node for node in constrained_w}
            free = [index for index in range(dof_count) if index not in constrained]
            reduced = [[stiffness[row][column] for column in free] for row in free]
            reduced_loads = [loads[row] for row in free]
            solved = solve_linear_system(reduced, reduced_loads, tolerance=max_diagonal * 1e-13)
            displacements = [0.0] * dof_count
            for index, value in zip(free, solved, strict=True):
                displacements[index] = value
            reactions = {
                node: sum(stiffness[3 * node][column] * displacements[column] for column in range(dof_count)) - loads[3 * node]
                for node in constrained_w
            }
            for node in active_springs:
                reactions[node] = -spring_by_node[node] * displacements[3 * node]

            deactivated = {
                node for node in compression_only & active_springs
                if reactions.get(node, 0.0) < -1e-8
            }
            active_springs -= deactivated

            rows_w: list[list[float | None]] = []
            for iy in range(ny):
                row: list[float | None] = []
                for ix in range(nx):
                    node = node_by_grid.get((ix, iy))
                    row.append(None if node is None else displacements[3 * node])
                rows_w.append(row)
            rigidity_x = elastic_modulus_x_mpa * 1000.0 * stiffness_factor * thickness_m**3 / (12.0 * (1.0 - poisson_ratio**2))
            rigidity_y = elastic_modulus_y_mpa * 1000.0 * stiffness_factor * thickness_m**3 / (12.0 * (1.0 - poisson_ratio**2))
            mx_rows: list[list[float | None]] = []
            my_rows: list[list[float | None]] = []
            maximum_moment = 0.0
            for iy in range(ny):
                mx_row: list[float | None] = []
                my_row: list[float | None] = []
                for ix in range(nx):
                    value = rows_w[iy][ix]
                    if value is None:
                        mx_row.append(None)
                        my_row.append(None)
                        continue
                    left = rows_w[iy][max(0, ix - 1)]
                    right = rows_w[iy][min(nx - 1, ix + 1)]
                    down = rows_w[max(0, iy - 1)][ix]
                    up = rows_w[min(ny - 1, iy + 1)][ix]
                    d2x = 0.0 if left is None or right is None else (left - 2 * value + right) / dx**2
                    d2y = 0.0 if down is None or up is None else (down - 2 * value + up) / dy**2
                    mx = -rigidity_x * (d2x + poisson_ratio * d2y)
                    my = -rigidity_y * (d2y + poisson_ratio * d2x)
                    maximum_moment = max(maximum_moment, abs(mx), abs(my))
                    mx_row.append(mx)
                    my_row.append(my)
                mx_rows.append(mx_row)
                my_rows.append(my_row)

            target_factor = cracked_factor_target if crack_threshold > 0 and maximum_moment > crack_threshold else 1.0
            next_factor = 0.5 * stiffness_factor + 0.5 * target_factor
            iterations.append({
                "iteration": iteration,
                "stiffness_factor": round(stiffness_factor, 5),
                "max_moment_knm_m": round(maximum_moment, 5),
                "deactivated_contact_springs": len(deactivated),
            })
            final_displacements = displacements
            final_reactions = reactions
            final_mx, final_my = mx_rows, my_rows
            if not deactivated and abs(next_factor - stiffness_factor) < 0.002:
                stiffness_factor = next_factor
                break
            stiffness_factor = next_factor

        grid_rows: list[list[dict[str, Any]]] = []
        max_deflection_mm = 0.0
        max_mx = 0.0
        max_my = 0.0
        for iy in range(ny):
            row: list[dict[str, Any]] = []
            for ix in range(nx):
                node_index = node_by_grid.get((ix, iy))
                if node_index is None:
                    row.append({"x_m": round(ix * dx, 6), "y_m": round(iy * dy, 6), "active": False, "w_mm": None, "mx_knm_m": None, "my_knm_m": None})
                    continue
                w_mm = final_displacements[3 * node_index] * 1000.0
                mx = float(final_mx[iy][ix] or 0.0)
                my = float(final_my[iy][ix] or 0.0)
                max_deflection_mm = max(max_deflection_mm, abs(w_mm))
                max_mx = max(max_mx, abs(mx))
                max_my = max(max_my, abs(my))
                row.append({
                    "x_m": round(ix * dx, 6), "y_m": round(iy * dy, 6), "active": True,
                    "w_mm": round(w_mm, 6), "mx_knm_m": round(mx, 6), "my_knm_m": round(my, 6),
                    "supported": node_index in constrained_w,
                })
            grid_rows.append(row)

        reaction_records = [
            {"node": node, "x_m": round(nodes[node]["x_m"], 5), "y_m": round(nodes[node]["y_m"], 5), "vertical_reaction_kn": round(value, 6)}
            for node, value in sorted(final_reactions.items())
        ]
        equilibrium = sum(item["vertical_reaction_kn"] for item in reaction_records) - uniform_load_kn_m2 * sum(
            dx * (0.5 if node["ix"] in {0, nx - 1} else 1.0) * dy * (0.5 if node["iy"] in {0, ny - 1} else 1.0)
            for node in nodes
        )
        return {
            "solver": self.solver_id,
            "analysis_type": "linear_or_secant_nonlinear_grillage_surface",
            "theory": "orthogonal Euler-Bernoulli strip grillage with shared vertical translations",
            "boundary_condition": "explicit_edge_line_point_and_spring_supports",
            "grid": {"nx": nx, "ny": ny, "rows": grid_rows},
            "nodes": reaction_records,
            "openings": [dict(item) for item in openings],
            "supports": {"edges": edge_supports, "line_count": len(line_supports), "point_count": len(point_supports), "active_contact_springs": len(active_springs)},
            "iterations": iterations,
            "equilibrium_residual_kn": round(equilibrium, 5),
            "envelope": {
                "max_abs_deflection_mm": round(max_deflection_mm, 6),
                "max_abs_mx_knm_m": round(max_mx, 6),
                "max_abs_my_knm_m": round(max_my, 6),
            },
            "applicability": {
                "supported": ["rectangular_grillage", "openings", "line_supports", "point_supports", "orthotropic", "secant_cracking", "vertical_spring_contact"],
                "not_supported": ["membrane_action", "large_displacement_shell", "three_dimensional_solid", "plastic_hinges"],
            },
            "decisions": [DecisionRecord(
                "surface_solver", "Flächenmodell", "Orthogonales Grillagenmodell",
                "Das Projekt enthält innere Lager und/oder Öffnungen; die Lastabtragung wird über explizite Streifen und Knoten abgebildet.",
                alternatives=("Navier plate", "Mindlin shell FEM", "3D solid FEM"), standard_refs=("EN1990",),
            ).to_dict()],
            "calculation_steps": [
                CalculationStep(
                    "grillage_discretization", "Diskretisierung", "K u = F",
                    f"{len(nodes)} Knoten; {len(elements)} Streifen; {len(constrained_w)} vertikale Lager",
                    len(nodes) * 3, "Freiheitsgrade", ("EN1990",),
                    ("Kleine Verformungen", "Orthogonale Biegestreifen", "Keine Membranwirkung"),
                ).to_dict(),
                CalculationStep(
                    "grillage_cracking", "Risssteifigkeitsiteration", "E_eff = zeta * E",
                    f"Grenzmoment={crack_threshold:g} kNm/m; Zielfaktor={cracked_factor_target:g}",
                    round(stiffness_factor, 5), "-", ("EN1992-1-1",),
                    ("Globale Sekantensteifigkeit", "Kein nichtlineares Materialgesetz"),
                ).to_dict(),
                CalculationStep(
                    "grillage_equilibrium", "Gleichgewicht", "Sum Rz - Sum Fz = 0",
                    f"{len(reaction_records)} Reaktionsknoten", round(equilibrium, 5), "kN", ("EN1990",),
                ).to_dict(),
            ],
        }


__all__ = ["GrillagePlateSolver"]
