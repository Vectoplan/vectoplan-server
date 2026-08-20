"""Persistent structural workflow pipelines built from calculation-path IDs."""

from __future__ import annotations

from collections import Counter
from copy import deepcopy
import hashlib
from itertools import product
import json
from pathlib import Path
from typing import Any, Iterable

from .calculation_paths import CalculationPathRegistry, EXECUTABLE_PATH_STATUSES


EXECUTABLE_PIPELINE_STATUSES = {"implemented", "implemented_bounded"}


class StructuralPipelineRegistry:
    """Load and validate the formula -> path -> pipeline knowledge graph."""

    def __init__(
        self,
        path: Path | None = None,
        calculation_paths: CalculationPathRegistry | None = None,
    ) -> None:
        self.path = path or Path(__file__).with_name("structural_pipelines.json")
        with self.path.open("r", encoding="utf-8") as stream:
            self._catalog: dict[str, Any] = json.load(stream)
        if path is None:
            extension_path = Path(__file__).with_name("structural_pipeline_extensions.json")
            if extension_path.exists():
                with extension_path.open("r", encoding="utf-8") as stream:
                    self._merge_extension_pack(json.load(stream))
        self.calculation_paths = calculation_paths or CalculationPathRegistry()
        self._path_index = {item["path_id"]: item for item in self.calculation_paths.records()}
        self._pipeline_index = {
            item["pipeline_id"]: item for item in self._catalog.get("pipelines") or []
        }
        binding_path = Path(__file__).parents[1] / "report_templates" / "pipeline_bindings.json"
        self._report_template_bindings: dict[str, list[dict[str, str]]] = {}
        if binding_path.exists():
            binding_catalog = json.loads(binding_path.read_text(encoding="utf-8"))
            template_titles = self._report_template_titles()
            for binding in binding_catalog.get("bindings") or []:
                for pipeline_id in binding.get("pipeline_ids") or []:
                    self._report_template_bindings.setdefault(pipeline_id, []).append({
                        "template_id": binding["template_id"],
                        "title": template_titles.get(binding["template_id"], binding["template_id"]),
                        "url": f"/statik/katalog?bereich=berechnungstemplates&vorlage={binding['template_id']}",
                    })
        self._validate()

    def _merge_extension_pack(self, extension: dict[str, Any]) -> None:
        """Merge persisted specialist pipelines and expand building profiles."""
        pipelines = self._catalog.setdefault("pipelines", [])
        for pipeline in extension.get("pipelines") or []:
            record = deepcopy(pipeline)
            record.setdefault("source_pack", extension.get("pack_id", "extension"))
            pipelines.append(record)

        template = extension.get("building_typology_template") or {}
        for profile in extension.get("building_typology_profiles") or []:
            record = deepcopy(template)
            structure_type = str(profile["structure_type"])
            record.update({
                "pipeline_id": profile["pipeline_id"],
                "title": profile["title"],
                "description": profile["description"],
                "domain": "building",
                "source_pack": extension.get("pack_id", "extension"),
                "building_profile": deepcopy(profile),
                "selection": {"all": [{"fact": "structure_type", "operator": "equals", "value": structure_type}]},
                "applicability": {
                    "structure_types": [structure_type],
                    "materials": list(profile.get("materials") or []),
                    "components": list(profile.get("components") or ["complete_building"]),
                },
            })
            additions = profile.get("phase_extensions") or {}
            for phase in record.get("phases") or []:
                phase["conditional_path_refs"] = list(dict.fromkeys([
                    *(phase.get("conditional_path_refs") or []),
                    *(additions.get(phase.get("phase_id")) or []),
                ]))
            record["outputs"] = list(dict.fromkeys([
                *(record.get("outputs") or []),
                *(profile.get("outputs") or []),
            ]))
            record["review_gates"] = list(dict.fromkeys([
                *(record.get("review_gates") or []),
                *(profile.get("review_gates") or []),
            ]))
            normative = deepcopy(record.get("normative_program") or {})
            for key in ("eurocode_refs", "supplementary_standard_candidates", "regulatory_checks"):
                normative[key] = list(dict.fromkeys([
                    *(normative.get(key) or []),
                    *(profile.get(key) or []),
                ]))
            record["normative_program"] = normative
            pipelines.append(record)

        bridge_template = extension.get("bridge_typology_template") or {}
        for profile in extension.get("bridge_typology_profiles") or []:
            record = deepcopy(bridge_template)
            bridge_type = str(profile["bridge_type"])
            record.update({
                "pipeline_id": profile["pipeline_id"],
                "title": profile["title"],
                "description": profile["description"],
                "domain": "bridge",
                "source_pack": extension.get("pack_id", "extension"),
                "bridge_profile": deepcopy(profile),
                "selection": {"all": [
                    {"fact": "structure_type", "operator": "equals", "value": "bridge"},
                    {"fact": "bridge_type", "operator": "equals", "value": bridge_type},
                ]},
                "applicability": {
                    "structure_types": ["bridge"],
                    "materials": list(profile.get("materials") or []),
                    "components": [bridge_type],
                },
            })
            additions = profile.get("phase_extensions") or {}
            for phase in record.get("phases") or []:
                phase["conditional_path_refs"] = list(dict.fromkeys([
                    *(phase.get("conditional_path_refs") or []),
                    *(additions.get(phase.get("phase_id")) or []),
                ]))
            record["review_gates"] = list(dict.fromkeys([
                *(record.get("review_gates") or []),
                *(profile.get("review_gates") or []),
            ]))
            normative = deepcopy(record.get("normative_program") or {})
            for key in ("eurocode_refs", "supplementary_standard_candidates", "regulatory_checks"):
                normative[key] = list(dict.fromkeys([
                    *(normative.get(key) or []),
                    *(profile.get(key) or []),
                ]))
            record["normative_program"] = normative
            pipelines.append(record)

        self._catalog["pipeline_packs"] = [
            *(self._catalog.get("pipeline_packs") or []),
            deepcopy(extension.get("pack_summary") or {}),
        ]
        self._catalog["building_typology_profiles"] = deepcopy(extension.get("building_typology_profiles") or [])
        self._catalog["bridge_typology_profiles"] = deepcopy(extension.get("bridge_typology_profiles") or [])

    @staticmethod
    def _path_refs(pipeline: dict[str, Any]) -> Iterable[tuple[str, str, str]]:
        for phase in pipeline.get("phases") or []:
            phase_id = str(phase.get("phase_id") or "phase")
            for path_id in phase.get("required_path_refs") or []:
                yield str(path_id), "required", phase_id
            for path_id in phase.get("conditional_path_refs") or []:
                yield str(path_id), "conditional", phase_id

    def _validate(self) -> None:
        pipeline_ids = [item.get("pipeline_id") for item in self._catalog.get("pipelines") or []]
        if len(pipeline_ids) != len(set(pipeline_ids)):
            raise ValueError("Duplicate pipeline_id in structural pipeline catalog")
        category_ids = {item["category_id"] for item in self._catalog.get("categories") or []}
        missing_categories = [
            item["pipeline_id"] for item in self._catalog.get("pipelines") or []
            if item.get("category_id") not in category_ids
        ]
        if missing_categories:
            raise ValueError(f"Unknown pipeline categories: {', '.join(missing_categories)}")
        missing_paths = sorted({
            path_id
            for pipeline in self._catalog.get("pipelines") or []
            for path_id, _, _ in self._path_refs(pipeline)
            if path_id not in self._path_index
        })
        if missing_paths:
            raise ValueError(f"Unknown calculation paths in structural pipelines: {', '.join(missing_paths)}")
        unknown_bound_pipelines = sorted(set(self._report_template_bindings) - set(self._pipeline_index))
        if unknown_bound_pipelines:
            raise ValueError(
                f"Unknown pipelines in report-template bindings: {', '.join(unknown_bound_pipelines)}"
            )

    @staticmethod
    def _report_template_titles() -> dict[str, str]:
        catalog_path = Path(__file__).parents[1] / "report_templates" / "catalog.json"
        if not catalog_path.exists():
            return {}
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        return {item["template_id"]: item["title"] for item in catalog.get("templates") or []}

    @staticmethod
    def _path_summary(path: dict[str, Any]) -> dict[str, Any]:
        return {
            "path_id": path["path_id"],
            "title": path["title"],
            "status": path["status"],
            "executable": path["executable"],
            "phase": path.get("phase"),
            "formula_count": path.get("formula_count", 0),
            "standard_refs": list(path.get("standard_refs") or []),
            "required_variables": deepcopy(path.get("required_variables") or []),
            "applicability": deepcopy(path.get("applicability") or {}),
            "limits": deepcopy(path.get("limits") or {}),
            "normative_basis": deepcopy(path.get("normative_basis") or {}),
        }

    def _decorate(self, pipeline: dict[str, Any]) -> dict[str, Any]:
        record = deepcopy(pipeline)
        record.setdefault("domain", self._infer_domain(record))
        all_path_ids: list[str] = []
        all_paths: list[dict[str, Any]] = []
        blocked: list[dict[str, Any]] = []
        for phase in record.get("phases") or []:
            phase_paths = []
            for mode, key in (("required", "required_path_refs"), ("conditional", "conditional_path_refs")):
                for path_id in phase.get(key) or []:
                    path = self._path_index[path_id]
                    summary = {**self._path_summary(path), "mode": mode}
                    phase_paths.append(summary)
                    all_path_ids.append(path_id)
                    all_paths.append(summary)
                    if path.get("status") not in EXECUTABLE_PATH_STATUSES:
                        blocked.append({
                            "path_id": path_id,
                            "title": path["title"],
                            "phase_id": phase.get("phase_id"),
                            "mode": mode,
                            "reason": "Rechenweg ist fachlich oder technisch noch unvollstaendig.",
                        })
            phase["paths"] = phase_paths
            phase["path_count"] = len(phase_paths)
            phase["blocked_path_count"] = sum(not item["executable"] for item in phase_paths)

        unique_paths = {item["path_id"]: item for item in all_paths}
        variables = {
            variable["variable_id"]: variable
            for path in unique_paths.values()
            for variable in path.get("required_variables") or []
        }
        record["path_refs"] = list(dict.fromkeys(all_path_ids))
        record["path_count"] = len(unique_paths)
        record["executable_path_count"] = sum(item["executable"] for item in unique_paths.values())
        record["blocked_path_count"] = len(blocked)
        record["blocked_paths"] = blocked
        record["required_variables"] = list(variables.values())
        record["variable_count"] = len(variables)
        record["standard_refs"] = sorted({
            standard
            for path in unique_paths.values()
            for standard in path.get("standard_refs") or []
        })
        record["report_templates"] = deepcopy(
            self._report_template_bindings.get(record["pipeline_id"], [])
        )
        governed_paths = [
            path for path in unique_paths.values()
            if (path.get("normative_basis") or {}).get("basis_kind") == "eurocode_governed"
        ]
        verified_paths = [
            path for path in governed_paths
            if (path.get("normative_basis") or {}).get("gate", {}).get("passed")
        ]
        normative_documents = {
            document["document_id"]: document
            for path in governed_paths
            for document in (path.get("normative_basis") or {}).get("documents") or []
        }
        normative_program = deepcopy(record.get("normative_program") or {})
        explicit_refs = list(normative_program.get("eurocode_refs") or [])
        for document in self.calculation_paths.eurocodes.documents_for_standard_refs(explicit_refs):
            normative_documents.setdefault(document["document_id"], document)
        supplementary_candidates = list(normative_program.get("supplementary_standard_candidates") or [])
        verified_rule_refs = list(normative_program.get("verified_eurocode_rule_refs") or [])
        normative_gate_passed = (
            len(verified_paths) == len(governed_paths)
            and (not explicit_refs or bool(verified_rule_refs))
            and not supplementary_candidates
        )
        record["normative_basis"] = {
            "governed_path_count": len(governed_paths),
            "verified_path_count": len(verified_paths),
            "unverified_path_count": len(governed_paths) - len(verified_paths),
            "documents": list(normative_documents.values()),
            "explicit_eurocode_refs": explicit_refs,
            "verified_eurocode_rule_refs": verified_rule_refs,
            "supplementary_standard_candidates": supplementary_candidates,
            "regulatory_checks": list(normative_program.get("regulatory_checks") or []),
            "gate": {
                "passed": normative_gate_passed,
                "rule": "Alle Eurocode-gesteuerten Rechenwege benötigen fachlich bestätigte Regel-IDs; ergänzende Fach-, Produkt- und Ausführungsnormen dürfen nicht als ungeprüfte Kandidaten offen sein.",
            },
        }
        structures, materials, components = self._variant_values(record)
        record["application_variant_count"] = len(structures) * len(materials) * len(components)
        record["executable"] = (
            record.get("status") in EXECUTABLE_PIPELINE_STATUSES
            and not any(item["mode"] == "required" for item in blocked)
        )
        return record

    @staticmethod
    def _infer_domain(record: dict[str, Any]) -> str:
        pipeline_id = str(record.get("pipeline_id") or "")
        if "SCAFFOLD" in pipeline_id or "FALSEWORK" in pipeline_id:
            return "scaffolding"
        if "BRIDGE" in pipeline_id:
            return "bridge"
        if "HALL" in pipeline_id:
            return "hall"
        if "BUILDING" in pipeline_id or "FLOOR" in pipeline_id:
            return "building"
        if "SCENARIO" in pipeline_id:
            return "scenario"
        if "GOV" in pipeline_id:
            return "governance"
        if "SPECIAL" in pipeline_id:
            return "special"
        return "cross_domain"

    @staticmethod
    def _variant_values(record: dict[str, Any]) -> list[list[str]]:
        applicability = record.get("applicability") or {}
        result = []
        for key in ("structure_types", "materials", "components"):
            values = [str(value) for value in applicability.get(key) or [] if value != "all"]
            result.append(list(dict.fromkeys(values)) or ["any"])
        return result

    def variant_count(self) -> int:
        return sum(
            len(structures) * len(materials) * len(components)
            for record in self.records()
            for structures, materials, components in [self._variant_values(record)]
        )

    def query_variants(
        self,
        *,
        query: str = "",
        structure_type: str = "",
        material: str = "",
        domain: str = "",
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        page = max(1, int(page))
        page_size = max(1, min(100, int(page_size)))
        needle = query.strip().casefold()
        variants = []
        for record in self.records():
            if domain and record.get("domain") != domain:
                continue
            structures, materials, components = self._variant_values(record)
            for structure, material_value, component in product(structures, materials, components):
                if structure_type and structure != structure_type:
                    continue
                if material and material_value != material:
                    continue
                haystack = f"{record['pipeline_id']} {record['title']} {structure} {material_value} {component}".casefold()
                if needle and needle not in haystack:
                    continue
                key = f"{record['pipeline_id']}|{structure}|{material_value}|{component}"
                digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:10].upper()
                variants.append({
                    "variant_id": f"PIPEV-{digest}",
                    "base_pipeline_id": record["pipeline_id"],
                    "title": record["title"],
                    "status": record["status"],
                    "structure_type": structure,
                    "material": material_value,
                    "component": component,
                    "domain": record.get("domain"),
                    "path_count": record["path_count"],
                    "normative_gate_passed": record["normative_basis"]["gate"]["passed"],
                })
        total = len(variants)
        start = (page - 1) * page_size
        page_count = max(1, (total + page_size - 1) // page_size)
        return {
            "schema_version": "structural-pipeline-variants/0.1",
            "statistics": {"variant_count": self.variant_count(), "base_pipeline_count": len(self._pipeline_index)},
            "pagination": {"page": page, "page_size": page_size, "page_count": page_count, "total": total, "has_previous": page > 1, "has_next": page < page_count},
            "items": variants[start:start + page_size],
            "meaning": "Konkrete Baukörper-/Material-/Bauteilvarianten der Pipeline-Templates; keine künstlich vervielfachten Rechenmethoden.",
        }

    def records(self) -> list[dict[str, Any]]:
        return [self._decorate(item) for item in self._catalog.get("pipelines") or []]

    def get(self, pipeline_id: str) -> dict[str, Any]:
        try:
            return self._decorate(self._pipeline_index[pipeline_id])
        except KeyError as error:
            raise KeyError(pipeline_id) from error

    def coverage(self) -> dict[str, Any]:
        bindings: dict[str, list[dict[str, Any]]] = {path_id: [] for path_id in self._path_index}
        for pipeline in self._catalog.get("pipelines") or []:
            for path_id, mode, phase_id in self._path_refs(pipeline):
                bindings[path_id].append({
                    "pipeline_id": pipeline["pipeline_id"],
                    "pipeline_title": pipeline["title"],
                    "pipeline_status": pipeline["status"],
                    "mode": mode,
                    "phase_id": phase_id,
                })
        records = []
        for path_id, path in self._path_index.items():
            path_bindings = bindings[path_id]
            if not path_bindings:
                disposition = "unassigned"
                reason = "Keiner Pipeline zugeordnet."
            elif path["status"] in EXECUTABLE_PATH_STATUSES:
                disposition = "available"
                reason = "Mindestens einer Pipeline zugeordnet und als begrenzter Rechenweg verfuegbar."
            else:
                disposition = "reserved_blocked"
                reason = "Pipelineplatz ist fest reserviert; der unvollstaendige Rechenweg bleibt gesperrt."
            records.append({
                "path_id": path_id,
                "title": path["title"],
                "path_status": path["status"],
                "disposition": disposition,
                "reason": reason,
                "bindings": path_bindings,
            })
        counts = Counter(item["disposition"] for item in records)
        return {
            "catalogued_path_count": len(records),
            "assigned_path_count": len(records) - counts.get("unassigned", 0),
            "unassigned_path_count": counts.get("unassigned", 0),
            "by_disposition": dict(sorted(counts.items())),
            "records": records,
            "gate": {
                "passed": counts.get("unassigned", 0) == 0,
                "rule": "Jeder Rechenweg muss mindestens einer Bauteil-, Teilsystem-, Gesamttragwerks-, Sonder- oder Freigabepipeline zugeordnet sein.",
            },
        }

    def catalog(self, *, include_coverage_records: bool = False) -> dict[str, Any]:
        records = self.records()
        coverage = self.coverage()
        if not include_coverage_records:
            coverage = {key: value for key, value in coverage.items() if key != "records"}
        result = {key: deepcopy(value) for key, value in self._catalog.items() if key != "pipelines"}
        result["pipelines"] = records
        result["statistics"] = {
            "pipeline_count": len(records),
            "executable_pipeline_count": sum(item["executable"] for item in records),
            "path_count": len(self._path_index),
            "by_status": dict(Counter(item["status"] for item in records)),
            "by_level": dict(Counter(item["level"] for item in records)),
            "by_domain": dict(Counter(item.get("domain", "cross_domain") for item in records)),
            "by_structure_type": dict(Counter(
                structure
                for item in records
                for structure in (item.get("applicability") or {}).get("structure_types") or []
            )),
            "application_variant_count": self.variant_count(),
            "linked_report_template_count": len({
                template["template_id"]
                for templates in self._report_template_bindings.values()
                for template in templates
            }),
        }
        result["path_coverage"] = coverage
        return result


__all__ = ["EXECUTABLE_PIPELINE_STATUSES", "StructuralPipelineRegistry"]
