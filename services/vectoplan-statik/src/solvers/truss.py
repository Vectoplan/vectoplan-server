"""Small linear-elastic two-dimensional truss solver."""

from __future__ import annotations

import math
from typing import Any, Mapping

from src.domain import CalculationStep, DecisionRecord
from src.solvers.linear_algebra import solve_linear_system


class Truss2DSolver:
    solver_id = "linear_truss_2d/0.1"

    def solve(
        self,
        *,
        nodes: list[Mapping[str, Any]],
        members: list[Mapping[str, Any]],
        supports: list[Mapping[str, Any]],
        nodal_loads: list[Mapping[str, Any]],
    ) -> dict[str, Any]:
        if len(nodes) < 2 or not members:
            raise ValueError("A truss needs at least two nodes and one member")
        ordered = [dict(item) for item in nodes]
        index_by_id = {str(item["node_id"]): index for index, item in enumerate(ordered)}
        if len(index_by_id) != len(ordered):
            raise ValueError("Truss node ids must be unique")
        dof_count = len(ordered) * 2
        stiffness = [[0.0 for _ in range(dof_count)] for _ in range(dof_count)]
        loads = [0.0 for _ in range(dof_count)]
        element_data: list[dict[str, Any]] = []
        for member in members:
            i = index_by_id[str(member["start_node"])]
            j = index_by_id[str(member["end_node"])]
            dx = float(ordered[j]["x_m"]) - float(ordered[i]["x_m"])
            dy = float(ordered[j]["y_m"]) - float(ordered[i]["y_m"])
            length = math.hypot(dx, dy)
            if length <= 0:
                raise ValueError("Truss member length must be positive")
            c, s = dx / length, dy / length
            area_m2 = float(member["area_mm2"]) / 1_000_000.0
            elastic_kn_m2 = float(member["elastic_modulus_mpa"]) * 1000.0
            factor = elastic_kn_m2 * area_m2 / length
            local = [
                [c*c, c*s, -c*c, -c*s], [c*s, s*s, -c*s, -s*s],
                [-c*c, -c*s, c*c, c*s], [-c*s, -s*s, c*s, s*s],
            ]
            indices = [2*i, 2*i+1, 2*j, 2*j+1]
            for row, global_row in enumerate(indices):
                for column, global_column in enumerate(indices):
                    stiffness[global_row][global_column] += factor * local[row][column]
            element_data.append({"member": dict(member), "i": i, "j": j, "length_m": length, "c": c, "s": s, "factor": factor})
        for load in nodal_loads:
            node = index_by_id[str(load["node_id"])]
            loads[2*node] += float(load.get("fx_kn", 0.0))
            loads[2*node+1] += float(load.get("fy_kn", 0.0))
        constrained: set[int] = set()
        for support in supports:
            node = index_by_id[str(support["node_id"])]
            if bool(support.get("fix_x", False)):
                constrained.add(2*node)
            if bool(support.get("fix_y", False)):
                constrained.add(2*node+1)
        free = [index for index in range(dof_count) if index not in constrained]
        solved = solve_linear_system([[stiffness[r][c] for c in free] for r in free], [loads[r] for r in free])
        displacement = [0.0] * dof_count
        for dof, value in zip(free, solved, strict=True):
            displacement[dof] = value
        reactions = [sum(stiffness[row][column] * displacement[column] for column in range(dof_count)) - loads[row] for row in range(dof_count)]
        member_results = []
        maximum_force = 0.0
        for data in element_data:
            i, j, c, s = data["i"], data["j"], data["c"], data["s"]
            extension = -c*displacement[2*i] - s*displacement[2*i+1] + c*displacement[2*j] + s*displacement[2*j+1]
            force = data["factor"] * extension
            maximum_force = max(maximum_force, abs(force))
            member_results.append({
                "member_id": data["member"]["member_id"], "axial_force_kn": round(force, 6),
                "start_node": data["member"]["start_node"], "end_node": data["member"]["end_node"],
                "stress_mpa": round(force * 1000.0 / float(data["member"]["area_mm2"]), 6),
                "length_m": round(data["length_m"], 6),
            })
        node_results = [{
            "node_id": item["node_id"], "x_m": item["x_m"], "y_m": item["y_m"],
            "ux_mm": round(displacement[2*index]*1000.0, 6), "uy_mm": round(displacement[2*index+1]*1000.0, 6),
            "rx_kn": round(reactions[2*index], 6), "ry_kn": round(reactions[2*index+1], 6),
        } for index, item in enumerate(ordered)]
        return {
            "solver": self.solver_id, "analysis_type": "linear_static_truss_2d", "theory": "pin-jointed axial truss",
            "nodes": node_results, "members": member_results,
            "envelope": {"max_abs_axial_force_kn": round(maximum_force, 6), "max_abs_deflection_mm": round(max(max(abs(item["ux_mm"]), abs(item["uy_mm"])) for item in node_results), 6)},
            "applicability": {"supported": ["two_dimensional_truss", "nodal_loads", "pin_joints"], "not_supported": ["frame_bending", "joint_slip", "spatial_truss", "geometric_nonlinearity"]},
            "decisions": [DecisionRecord("truss_model", "Fachwerkmodell", "Ebener gelenkiger Stabzug", "Lasten greifen in den Knoten an; die Stäbe übertragen ausschließlich Normalkraft.", alternatives=("2D frame", "3D truss"), standard_refs=("EN1990",)).to_dict()],
            "calculation_steps": [CalculationStep("truss_stiffness", "Fachwerksteifigkeit", "k = EA/L", f"{len(ordered)} Knoten; {len(members)} Stäbe", len(free), "freie Freiheitsgrade", ("EN1990",), ("Linear elastisch", "Gelenkige Knoten")).to_dict()],
        }


__all__ = ["Truss2DSolver"]
