"""Auditable load-origin and load-transfer records for reports and the UI."""

from __future__ import annotations

from typing import Any, Mapping


class LoadPathBuilder:
    """Build a trace without inventing connectivity that is not in the model."""

    builder_id = "structural-load-path/0.1"

    def build(self, job: Mapping[str, Any], result: Mapping[str, Any]) -> dict[str, Any]:
        model = job.get("analysis_model") or {}
        kind = str(model.get("kind", "member_check"))
        load_cases = list(job.get("load_cases") or [])
        sources: list[dict[str, Any]] = []
        transfers: list[dict[str, Any]] = []

        if kind in {"surface_plate", "grillage_plate"}:
            area = float(model.get("length_x_m", 0.0)) * float(model.get("length_y_m", 0.0))
            values = model.get("load_case_values_kn_m2") or {}
            for case in load_cases:
                case_id = str(case.get("load_case_id"))
                intensity = float(values.get(case_id, case.get("value", 0.0)))
                resultant = intensity * area
                sources.append(self._source(case, intensity, "kN/m²", "area_action"))
                transfers.append({
                    "transfer_id": f"{case_id}_surface_resultant",
                    "from": case_id,
                    "to": "plate_support_boundary",
                    "rule": "F = q · A",
                    "substitutions": f"{intensity:.3f} kN/m² · {area:.3f} m²",
                    "value": round(resultant, 3),
                    "unit": "kN",
                    "status": "resultant_only",
                    "note": "Eine Verteilung auf einzelne Auflager ist ohne explizites Auflager-/Kontaktmodell nicht freigegeben.",
                })
            if kind == "grillage_plate":
                governing = self._governing_analysis(result)
                for node in (governing.get("result") or {}).get("nodes") or []:
                    if node.get("vertical_reaction_kn") is None:
                        continue
                    transfers.append({
                        "transfer_id": f"surface_support_{node.get('node')}",
                        "from": "grillage_surface",
                        "to": f"support_node_{node.get('node')}",
                        "rule": "R = K·u - F",
                        "substitutions": str((governing.get("combination") or {}).get("combination_id", "maßgebend")),
                        "value": round(float(node["vertical_reaction_kn"]), 3),
                        "unit": "kN",
                        "status": "calculated_reaction",
                    })
        elif kind == "beam_line":
            values_by_case: dict[str, float] = {}
            total_length = 0.0
            for span in model.get("spans") or []:
                length = float(span.get("length_m", 0.0))
                total_length += length
                for case_id, value in (span.get("load_case_values_kn_m") or {}).items():
                    values_by_case[str(case_id)] = values_by_case.get(str(case_id), 0.0) + float(value) * length
            for case in load_cases:
                case_id = str(case.get("load_case_id"))
                sources.append(self._source(case, case.get("value"), case.get("unit"), "line_action"))
                transfers.append({
                    "transfer_id": f"{case_id}_beam_resultant",
                    "from": case_id,
                    "to": "beam_support_nodes",
                    "rule": "F = Σ(qᵢ · Lᵢ)",
                    "substitutions": f"{len(model.get('spans') or [])} Feld(er), Gesamtlänge {total_length:.3f} m",
                    "value": round(values_by_case.get(case_id, 0.0), 3),
                    "unit": "kN",
                    "status": "characteristic_resultant",
                })
            governing = self._governing_analysis(result)
            for node in (governing.get("result") or {}).get("nodes") or []:
                reaction = node.get("vertical_reaction_kn")
                if reaction is None:
                    continue
                transfers.append({
                    "transfer_id": f"support_{node.get('node')}",
                    "from": "beam_line",
                    "to": f"support_node_{node.get('node')}",
                    "rule": "R = K·u - F",
                    "substitutions": str((governing.get("combination") or {}).get("combination_id", "maßgebend")),
                    "value": round(float(reaction), 3),
                    "unit": "kN",
                    "status": "calculated_reaction",
                })
        elif kind == "truss_2d":
            for case in load_cases:
                sources.append(self._source(case, case.get("value"), case.get("unit"), "nodal_action"))
            governing = self._governing_analysis(result)
            for node in (governing.get("result") or {}).get("nodes") or []:
                if abs(float(node.get("rx_kn", 0.0))) + abs(float(node.get("ry_kn", 0.0))) <= 1e-9:
                    continue
                transfers.append({
                    "transfer_id": f"truss_support_{node.get('node_id')}", "from": "truss_2d",
                    "to": f"support_{node.get('node_id')}", "rule": "R = K·u - F",
                    "substitutions": str((governing.get("combination") or {}).get("combination_id", "maßgebend")),
                    "value": round(float(node.get("ry_kn", 0.0)), 3), "unit": "kN", "status": "calculated_reaction",
                })
        else:
            for case in load_cases:
                sources.append(self._source(case, case.get("value"), case.get("unit"), "member_action"))

        return {
            "builder": self.builder_id,
            "sources": sources,
            "transfers": transfers,
            "connectivity_status": "local_analysis_model_only",
            "feedback_to_2d_3d": "not_connected",
        }

    @staticmethod
    def _source(case: Mapping[str, Any], value: Any, unit: Any, representation: str) -> dict[str, Any]:
        return {
            "load_case_id": case.get("load_case_id"),
            "label": case.get("label"),
            "category": case.get("category"),
            "action_type": case.get("action_type"),
            "value": value,
            "unit": unit,
            "representation": representation,
            "origin": case.get("source", "explicit_analysis_job"),
        }

    @staticmethod
    def _governing_analysis(result: Mapping[str, Any]) -> Mapping[str, Any]:
        analyses = ((result.get("analysis") or {}).get("analyses") or [])
        return next((item for item in analyses if (item.get("combination") or {}).get("limit_state") == "ULS"), analyses[0] if analyses else {})


__all__ = ["LoadPathBuilder"]
