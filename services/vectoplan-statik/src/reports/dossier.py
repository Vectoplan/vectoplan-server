"""Universal structural calculation dossier shared by UI, HTML and PDF.

The dossier is intentionally object-type agnostic.  Object-specific topics are
represented by an applicability matrix instead of hard-coded report layouts.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Mapping

from src.loads import LoadPathBuilder
from src.knowledge import LiteratureRegistry


DOSSIER_VERSION = "structural-calculation-dossier/0.1"


TYPE_LABELS = {
    "residential_building": "Wohngebäude",
    "single_family_house": "Einfamilienhaus",
    "multi_family_building": "Mehrfamilienhaus",
    "high_rise_building": "Hochhaus",
    "office_building": "Bürogebäude",
    "school_building": "Schulgebäude",
    "hospital_building": "Krankenhaus",
    "church_building": "Kirche / Sakralbau",
    "assembly_building": "Versammlungsstätte",
    "hotel_building": "Hotelgebäude",
    "retail_building": "Handelsgebäude",
    "parking_structure": "Parkhaus / Tiefgarage",
    "sports_building": "Sportstätte",
    "warehouse": "Lagergebäude",
    "building_special": "Hochbau-Sondernutzung (Platzhalter)",
    "industrial_hall": "Halle / Industriebau",
    "bridge": "Brücke",
    "scaffold_standing": "Stand- und Fassadengerüst",
    "scaffold_suspended": "Hängegerüst",
    "falsework": "Traggerüst",
    "scaffold_special": "Sondergerüst (Platzhalter)",
    "tower": "Turm / Hochbau",
    "retaining_structure": "Stützbauwerk / Gründung",
    "generic": "Allgemeines Tragwerk",
}


BUILDING_TOPICS = (
    ("storey_stability", "Gesamtstabilität, Geschosse und Aussteifung"),
    ("slabs_walls", "Decken, Wände, Stützen und Unterzüge"),
    ("wind_snow", "Wind, Schnee und objektspezifische Einwirkungen"),
    ("robustness", "Robustheit und außergewöhnliche Bemessungssituationen"),
    ("fire", "Tragwerksbemessung für den Brandfall"),
    ("foundation", "Gründung, Baugrund und Grundwasser"),
)

SCAFFOLD_TOPICS = (
    ("scaffold_classification", "Gerüstart, Systemklasse und bestimmungsgemäße Verwendung"),
    ("wind_snow", "Nutzung, Wind, Schnee und Bekleidung"),
    ("global_stability", "Räumliche Stabilität und Imperfektionen"),
    ("anchors_supports", "Verankerungen, Aufhängungen und Fußpunkte"),
    ("construction_stages", "Montage-, Umbau-, Betriebs- und Rückbauzustände"),
    ("product_rules", "Produkt-, Zulassungs- und Ausführungsregeln"),
)


TOPIC_MATRIX = {
    "residential_building": BUILDING_TOPICS,
    "single_family_house": BUILDING_TOPICS,
    "multi_family_building": BUILDING_TOPICS,
    "high_rise_building": BUILDING_TOPICS,
    "office_building": BUILDING_TOPICS,
    "school_building": BUILDING_TOPICS,
    "hospital_building": BUILDING_TOPICS,
    "church_building": BUILDING_TOPICS,
    "assembly_building": BUILDING_TOPICS,
    "hotel_building": BUILDING_TOPICS,
    "retail_building": BUILDING_TOPICS,
    "parking_structure": BUILDING_TOPICS,
    "sports_building": BUILDING_TOPICS,
    "warehouse": BUILDING_TOPICS,
    "building_special": BUILDING_TOPICS,
    "scaffold_standing": SCAFFOLD_TOPICS,
    "scaffold_suspended": SCAFFOLD_TOPICS,
    "falsework": SCAFFOLD_TOPICS,
    "scaffold_special": SCAFFOLD_TOPICS,
    "industrial_hall": (
        ("frame_stability", "Rahmenstabilität und Theorie II. Ordnung"),
        ("bracing", "Verbände und räumliche Aussteifung"),
        ("wind_snow", "Wind, Schnee und Verwehungen"),
        ("connections", "Anschlüsse und Knoten"),
        ("foundation", "Stützenfüße und Gründung"),
    ),
    "bridge": (
        ("traffic", "Verkehrslastmodelle"),
        ("temperature_bearings", "Temperatur, Lager und Bewegungswege"),
        ("fatigue", "Ermüdung"),
        ("dynamics", "Dynamik und Schwingungen"),
        ("construction_stages", "Bauzustände"),
        ("substructure", "Widerlager, Pfeiler und Gründung"),
        ("monitoring", "Messung und Bestandsabgleich"),
    ),
    "retaining_structure": (
        ("ground_model", "Baugrundmodell und Grundwasser"),
        ("earth_pressure", "Erd- und Wasserdruck"),
        ("stages", "Bauzustände und Aushub"),
        ("anchors_piles", "Anker, Pfähle und Spundwände"),
        ("concrete_details", "Stahlbetonbauteile und Bewehrung"),
    ),
}


class StructuralDossierBuilder:
    builder_id = "vectoplan-structural-dossier/0.1"

    def __init__(self) -> None:
        self.load_path_builder = LoadPathBuilder()
        self.literature = LiteratureRegistry()

    def build(self, job: Mapping[str, Any], result: Mapping[str, Any]) -> dict[str, Any]:
        structure_type = str(job.get("structure_type", "generic"))
        checks = self._checks(result)
        combinations = list(((result.get("load_combinations") or {}).get("combinations") or []))
        analyses = list(((result.get("analysis") or {}).get("analyses") or []))
        steps = list(result.get("calculation_steps") or [])
        standards = list(result.get("standards") or [])
        decisions = list(result.get("decisions") or [])
        load_path = self.load_path_builder.build(job, result)
        visuals = self._visualizations(analyses)
        topics = self._topic_matrix(structure_type, job, result)
        chapters = self._chapters(job, result, checks, combinations, analyses, standards, steps, load_path, topics)

        return {
            "contract_version": DOSSIER_VERSION,
            "builder": self.builder_id,
            "generated_at": datetime.now(UTC).isoformat(),
            "document_control": {
                "project_ref": job.get("project_ref"),
                "model_revision_ref": job.get("model_revision_ref"),
                "analysis_ref": result.get("analysis_ref"),
                "job_ref": job.get("job_ref"),
                "position_ref": job.get("element_ref", job.get("job_ref")),
                "position_label": job.get("element_label", job.get("project_ref")),
                "status": (result.get("summary") or {}).get("status"),
                "review_state": "independent_engineering_review_required",
            },
            "project": {
                "name": (job.get("project_metadata") or {}).get("name", job.get("project_ref")),
                "structure_type": structure_type,
                "structure_type_label": TYPE_LABELS.get(structure_type, structure_type),
                "phase": (job.get("project_metadata") or {}).get("phase", "Entwurf"),
                "location": (job.get("project_metadata") or {}).get("location"),
            },
            "summary": {
                **dict(result.get("summary") or {}),
                "governing_utilization": max((float(item.get("utilization") or 0.0) for item in checks), default=0.0),
                "calculated_topics": sum(1 for item in topics if item["status"] == "calculated"),
                "open_topics": sum(1 for item in topics if item["status"] == "open"),
            },
            "inputs": self._inputs(job),
            "load_path": load_path,
            "load_combinations": combinations,
            "analysis_cases": self._analysis_cases(analyses),
            "checks": checks,
            "calculation_steps": steps,
            "calculation_plan": dict(result.get("calculation_plan") or {}),
            "workflow_plan": dict(result.get("workflow_plan") or {}),
            "standards": standards,
            "decisions": decisions,
            "environmental_actions": dict(result.get("environmental_actions") or {}),
            "visualizations": visuals,
            "applicability_matrix": topics,
            "capability_assessment": dict(result.get("capability_assessment") or {}),
            "literature_traceability": self.literature.records(),
            "chapters": chapters,
            "limitations": self._limitations(result, analyses),
            "verification": dict(result.get("verification") or {}),
        }

    @staticmethod
    def _checks(result: Mapping[str, Any]) -> list[dict[str, Any]]:
        checks = [dict(item) for item in ((result.get("design") or {}).get("checks") or [])]
        for action in (result.get("environmental_actions") or {}).values():
            if isinstance(action, Mapping):
                checks.extend(dict(item) for item in action.get("checks") or [])
        for check in checks:
            design = check.get("design_value")
            resistance = check.get("resistance_value")
            unit = check.get("unit", "")
            check["comparison"] = f"{design} {unit} ≤ {resistance} {unit}" if design is not None and resistance is not None else "nicht bewertet"
        return checks

    @staticmethod
    def _inputs(job: Mapping[str, Any]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []

        def walk(value: Any, path: str, group: str) -> None:
            if isinstance(value, Mapping):
                for key, item in value.items():
                    walk(item, f"{path}.{key}" if path else str(key), group)
            elif isinstance(value, list):
                for index, item in enumerate(value):
                    walk(item, f"{path}.{index}", group)
            elif isinstance(value, (str, int, float)) and not isinstance(value, bool):
                records.append({"path": path, "label": path.split(".")[-1], "value": value, "group": group, "source": "analysis_job"})

        walk(job.get("analysis_model") or {}, "analysis_model", "System und Geometrie")
        walk(job.get("design") or {}, "design", "Material und Bemessung")
        walk(job.get("environmental_actions") or {}, "environmental_actions", "Umwelteinwirkungen")
        return records

    @staticmethod
    def _analysis_cases(analyses: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
        records = []
        for item in analyses:
            combination = item.get("combination") or {}
            calculated = item.get("result") or {}
            records.append({
                "combination_id": combination.get("combination_id"),
                "label": combination.get("label"),
                "limit_state": combination.get("limit_state"),
                "solver": calculated.get("solver"),
                "theory": calculated.get("theory"),
                "boundary_condition": calculated.get("boundary_condition"),
                "envelope": calculated.get("envelope") or {},
                "reactions": calculated.get("nodes") or [],
            })
        return records

    @staticmethod
    def _visualizations(analyses: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
        visuals = []
        for item in analyses:
            combination = item.get("combination") or {}
            calculated = item.get("result") or {}
            if calculated.get("grid"):
                visuals.append({
                    "visualization_id": f"surface_{combination.get('combination_id')}",
                    "kind": "surface_field",
                    "title": f"Flächenergebnis · {combination.get('label')}",
                    "quantities": ["w_mm", "mx_knm_m", "my_knm_m"],
                    "grid": calculated.get("grid"),
                    "envelope": calculated.get("envelope"),
                })
            if calculated.get("spans"):
                visuals.append({
                    "visualization_id": f"beam_{combination.get('combination_id')}",
                    "kind": "beam_diagrams",
                    "title": f"Schnittgrößen · {combination.get('label')}",
                    "quantities": ["moment_knm", "shear_kn", "deflection_mm"],
                    "spans": calculated.get("spans"),
                    "envelope": calculated.get("envelope"),
                })
            if calculated.get("members") and calculated.get("nodes"):
                visuals.append({
                    "visualization_id": f"truss_{combination.get('combination_id')}",
                    "kind": "truss_forces",
                    "title": f"Fachwerkkräfte · {combination.get('label')}",
                    "nodes": calculated.get("nodes"),
                    "members": calculated.get("members"),
                    "envelope": calculated.get("envelope"),
                })
        return visuals

    @staticmethod
    def _topic_matrix(structure_type: str, job: Mapping[str, Any], result: Mapping[str, Any]) -> list[dict[str, Any]]:
        entries = TOPIC_MATRIX.get(structure_type, (("general", "Allgemeine Tragwerksberechnung"),))
        actions = {str(item.get("action_type")) for item in job.get("load_cases") or []}
        analysis_kind = str((job.get("analysis_model") or {}).get("kind"))
        design_types = {str(item.get("type")) for item in [job.get("design"), *(job.get("additional_designs") or [])] if isinstance(item, Mapping)}
        environmental = result.get("environmental_actions") or {}
        calculated = {
            "traffic": "traffic" in actions,
            "temperature_bearings": bool(environmental.get("temperature")),
            "wind_snow": bool({"wind", "snow"} & actions),
            "storey_stability": "member_stability" in design_types,
            "slabs_walls": analysis_kind in {"surface_plate", "grillage_plate"} or "masonry" in design_types,
            "foundation": "foundation" in design_types,
            "earth_pressure": "retaining_wall" in design_types,
            "ground_model": bool({"foundation", "retaining_wall"} & design_types),
            "concrete_details": "reinforced_concrete" in design_types,
            "general": True,
        }
        return [{
            "topic_id": topic_id,
            "label": label,
            "status": "calculated" if calculated.get(topic_id, False) else "open",
            "evidence": "im Rechenergebnis enthalten" if calculated.get(topic_id, False) else "Eingabe/Solver/Nachweis noch erforderlich",
        } for topic_id, label in entries]

    @staticmethod
    def _chapters(job: Mapping[str, Any], result: Mapping[str, Any], checks: list[dict[str, Any]], combinations: list[dict[str, Any]], analyses: list[dict[str, Any]], standards: list[dict[str, Any]], steps: list[dict[str, Any]], load_path: dict[str, Any], topics: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {"chapter_id": "01", "title": "Projekt und Dokumentenstand", "status": "complete", "record_count": 1},
            {"chapter_id": "02", "title": "Berechnungsgrundlagen und Normen", "status": "review", "record_count": len(standards)},
            {"chapter_id": "03", "title": "Tragsystem, Idealisierung und Anwendungsgrenzen", "status": "complete" if analyses else "partial", "record_count": len(analyses)},
            {"chapter_id": "04", "title": "Einwirkungen, Lastfälle und Lastpfad", "status": "complete", "record_count": len(load_path.get("sources") or []) + len(load_path.get("transfers") or [])},
            {"chapter_id": "05", "title": "Kombinationen", "status": "complete", "record_count": len(combinations)},
            {"chapter_id": "06", "title": "Positionen und Berechnungsergebnisse", "status": "complete" if checks else "partial", "record_count": len(checks)},
            {"chapter_id": "07", "title": "Rechenweg und Entscheidungen", "status": "complete", "record_count": len(steps) + len(result.get("decisions") or [])},
            {"chapter_id": "08", "title": "Objektspezifische Prüfmatrix", "status": "review", "record_count": len(topics)},
            {"chapter_id": "09", "title": "Zusammenfassung, offene Punkte und Freigabe", "status": "review", "record_count": sum(1 for item in topics if item["status"] == "open")},
        ]

    @staticmethod
    def _limitations(result: Mapping[str, Any], analyses: list[Mapping[str, Any]]) -> list[str]:
        limitations = list(result.get("warnings") or [])
        for capability in (result.get("capability_assessment") or {}).get("records") or []:
            if capability.get("requested") and capability.get("status") != "calculated":
                note = f"{capability.get('label')}: {capability.get('evidence')}"
                if note not in limitations:
                    limitations.append(note)
        return limitations


__all__ = ["DOSSIER_VERSION", "StructuralDossierBuilder"]
