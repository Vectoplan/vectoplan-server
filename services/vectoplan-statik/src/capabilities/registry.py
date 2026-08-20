"""Machine-readable solver capability and project-scope assessment."""

from __future__ import annotations

from typing import Any, Mapping


CAPABILITIES = {
    "openings": ("Öffnungen", "orthogonal_grillage_plate/0.1", "bounded"),
    "line_supports": ("Linienlager", "orthogonal_grillage_plate/0.1", "bounded"),
    "point_supports": ("Punktlager", "orthogonal_grillage_plate/0.1", "bounded"),
    "orthotropic": ("Orthotrope Biegesteifigkeit", "orthogonal_grillage_plate/0.1", "bounded"),
    "nonlinear": ("Sekanteniteration / Kontaktumschaltung", "orthogonal_grillage_plate/0.1", "bounded"),
    "contact": ("Vertikale Feder- und Druckkontaktmodelle", "orthogonal_grillage_plate/0.1", "bounded"),
    "cracking": ("Rissbedingte Sekantensteifigkeit", "orthogonal_grillage_plate/0.1", "bounded"),
    "stability": ("Elastische Stabstabilität", "elastic_member_stability/0.1", "bounded"),
    "fatigue": ("Konstante Ermüdungsschwingbreite", "constant_amplitude_fatigue/0.1", "bounded"),
    "fire": ("Explizit reduzierter Brandwiderstand", "explicit_fire_reduction_check/0.1", "bounded"),
    "construction_stages": ("Sequenzielle Bauzustandswirkungen", "sequential_construction_stage/0.1", "bounded"),
    "general_nonlinear_3d_fem": ("Allgemeine nichtlineare 3D-FEM", "external_solver_adapter", "external"),
}


class CapabilityRegistry:
    registry_id = "structural-capabilities/0.1"

    @staticmethod
    def _requested(job: Mapping[str, Any]) -> set[str]:
        requested = set(str(item) for item in job.get("required_capabilities") or [])
        model = job.get("analysis_model") or {}
        if model.get("openings"):
            requested.add("openings")
        if model.get("line_supports"):
            requested.add("line_supports")
        if model.get("point_supports"):
            requested.add("point_supports")
        if model.get("contact_springs"):
            requested.add("contact")
        if model.get("cracking"):
            requested.update(("cracking", "nonlinear"))
        if model.get("kind") == "grillage_plate" and float(model.get("elastic_modulus_x_mpa", 0)) != float(model.get("elastic_modulus_y_mpa", 0)):
            requested.add("orthotropic")
        for design in [job.get("design"), *(job.get("additional_designs") or [])]:
            if not isinstance(design, Mapping):
                continue
            requested.update({
                "member_stability": {"stability"}, "fatigue": {"fatigue"}, "fire_resistance": {"fire"},
                "construction_stages": {"construction_stages"},
            }.get(str(design.get("type")), set()))
        return requested

    def assess(self, job: Mapping[str, Any], result: Mapping[str, Any]) -> dict[str, Any]:
        requested = self._requested(job)
        used_modules = {str((item.get("result") or {}).get("solver")) for item in (result.get("analysis") or {}).get("analyses") or []}
        design = result.get("design") or {}
        used_modules.update(str(item.get("design_module")) for item in design.get("modules") or [design] if isinstance(item, Mapping))
        records = []
        unresolved = []
        for capability_id, (label, implementation, level) in CAPABILITIES.items():
            is_requested = capability_id in requested
            available = implementation in used_modules or (level == "external" and bool(job.get("external_solver_receipt")))
            if not is_requested:
                status = "not_required"
                evidence = "Für diesen Rechenauftrag nicht angefordert."
            elif available:
                status = "calculated"
                evidence = f"Im Ergebnis durch {implementation} nachgewiesen."
            elif level == "external":
                status = "external_solver_required"
                evidence = "Nur mit versioniertem Ergebnisbeleg eines externen Solvers zulässig."
                unresolved.append(capability_id)
            else:
                status = "required_but_missing"
                evidence = f"Angefordert, aber {implementation} wurde nicht ausgeführt."
                unresolved.append(capability_id)
            records.append({
                "capability_id": capability_id, "label": label, "requested": is_requested,
                "status": status, "implementation": implementation, "verification_level": level, "evidence": evidence,
            })
        return {"registry": self.registry_id, "records": records, "unresolved": unresolved, "complete_for_requested_scope": not unresolved}


__all__ = ["CapabilityRegistry"]
