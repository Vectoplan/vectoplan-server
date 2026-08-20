"""Persistent calculation-path catalog built exclusively on formula identifiers."""

from __future__ import annotations

from collections import Counter
from copy import deepcopy
import hashlib
from itertools import product
import json
from pathlib import Path
from typing import Any, Iterable

from .literature import EurocodeRegistry, FormulaRegistry


EXECUTABLE_PATH_STATUSES = {"implemented", "implemented_bounded"}

CATEGORY_EUROCODE_TOPICS = {
    "01_basis": ["analysis"],
    "02_actions": ["actions"],
    "03_safety": ["combinations"],
    "04_analysis": ["analysis"],
    "05_sections": ["resistance", "serviceability"],
    "06_materials": ["resistance", "materials", "detailing", "connections"],
    "07_geotechnics": ["geotechnics"],
    "08_special": ["stability", "fatigue", "fire", "seismic", "serviceability"],
    "09_systems": ["analysis"],
}


class CalculationPathRegistry:
    """Load, validate and enrich the durable calculation-path knowledge graph."""

    def __init__(
        self,
        path: Path | None = None,
        formulas: FormulaRegistry | None = None,
    ) -> None:
        self.path = path or Path(__file__).with_name("calculation_paths.json")
        with self.path.open("r", encoding="utf-8") as stream:
            self._catalog: dict[str, Any] = json.load(stream)
        root = self.path.parent
        with (root / "calculation_path_extensions.json").open("r", encoding="utf-8") as stream:
            extensions: dict[str, Any] = json.load(stream)
        with (root / "calculation_path_metadata.json").open("r", encoding="utf-8") as stream:
            self._metadata: dict[str, Any] = json.load(stream)
        self._catalog["paths"] = [
            *(self._catalog.get("paths") or []),
            *(extensions.get("paths") or []),
        ]
        self.formulas = formulas or FormulaRegistry()
        self.eurocodes = EurocodeRegistry()
        self._formula_index = {item["formula_id"]: item for item in self.formulas.records()}
        self._path_index = {item["path_id"]: item for item in self._catalog.get("paths") or []}
        self._validate()

    @staticmethod
    def _formula_refs(path: dict[str, Any]) -> Iterable[tuple[str, str, str | None]]:
        for step in path.get("steps") or []:
            yield str(step["formula_ref"]), "step", None
        for formula_id in path.get("supporting_formula_refs") or []:
            yield str(formula_id), "supporting", None
        for alternative in path.get("alternatives") or []:
            for formula_id in alternative.get("formula_refs") or []:
                yield str(formula_id), "alternative", str(alternative.get("method_id") or "alternative")

    def _validate(self) -> None:
        path_ids = [item.get("path_id") for item in self._catalog.get("paths") or []]
        if len(path_ids) != len(set(path_ids)):
            raise ValueError("Duplicate path_id in structural calculation-path catalog")
        category_ids = {item["category_id"] for item in self._catalog.get("categories") or []}
        missing_categories = [
            path["path_id"] for path in self._catalog.get("paths") or []
            if path.get("category_id") not in category_ids
        ]
        if missing_categories:
            raise ValueError(f"Unknown calculation-path categories: {', '.join(missing_categories)}")
        missing_formulas = sorted({
            formula_id
            for path in self._catalog.get("paths") or []
            for formula_id, _, _ in self._formula_refs(path)
            if formula_id not in self._formula_index
        })
        if missing_formulas:
            raise ValueError(f"Unknown formula references in calculation paths: {', '.join(missing_formulas)}")

    @staticmethod
    def _formula_summary(formula: dict[str, Any]) -> dict[str, Any]:
        return {
            "formula_id": formula["formula_id"],
            "title": formula["title"],
            "equation": formula["equation"],
            "description": formula["description"],
            "status": formula["status"],
            "standard_refs": list(formula.get("standard_refs") or []),
            "assumptions": list(formula.get("assumptions") or []),
            "variables": deepcopy(formula.get("variables") or []),
            "source": deepcopy(formula.get("source") or {}),
            "example": deepcopy((formula.get("processing") or {}).get("example") or {}),
            "knowledge_role": formula.get("knowledge_role", "engineering_method"),
            "normative_rule": False,
        }

    def _normative_basis(self, record: dict[str, Any]) -> dict[str, Any]:
        standard_refs = list(record.get("standard_refs") or [])
        topics = CATEGORY_EUROCODE_TOPICS.get(str(record.get("category_id")), [])
        mapping = self.eurocodes.candidate_rules_for_standard_refs(standard_refs, topics=topics)
        verified_refs = list(record.get("verified_eurocode_rule_refs") or [])
        if verified_refs:
            status = "verified_rule_mapping"
        elif mapping["document_count"]:
            status = "document_scope_mapped_rule_verification_pending"
        elif standard_refs:
            status = "eurocode_reference_unmapped"
        else:
            status = "engineering_method_not_directly_normative"
        normative_required = bool(standard_refs)
        return {
            "basis_kind": "eurocode_governed" if normative_required else "engineering_method",
            "standard_refs": standard_refs,
            "topics": topics,
            "documents": mapping["documents"],
            "candidate_rule_count": mapping["candidate_rule_count"],
            "suggested_rule_refs": mapping["suggested_rule_refs"],
            "verified_rule_refs": verified_refs,
            "verification_status": status,
            "gate": {
                "passed": bool(verified_refs) or not normative_required,
                "rule": "Ein Eurocode-gesteuerter Rechenweg benötigt mindestens eine fachlich bestätigte Regel-ID; Dokument- oder Familienbezug allein genügt nicht.",
            },
        }

    def _decorate(self, path: dict[str, Any]) -> dict[str, Any]:
        record = deepcopy(path)
        metadata_record = dict((self._metadata.get("path_metadata") or {}).get(path["path_id"]) or {})
        profile_ids = [*(path.get("metadata_profiles") or []), *(metadata_record.pop("profiles", []) or [])]
        applicability = {"structure_types": [], "materials": [], "component_types": [], "calculation_scopes": []}
        limits = {"minimum": ["unvollständig"], "maximum": ["unvollständig"], "exclusions": []}
        for profile_id in dict.fromkeys(profile_ids):
            profile = (self._metadata.get("profiles") or {}).get(profile_id) or {}
            for key in applicability:
                applicability[key].extend(profile.get(key) or [])
            for key in limits:
                if profile.get("limits", {}).get(key):
                    limits[key] = list(profile["limits"][key])
        for key in applicability:
            applicability[key].extend(metadata_record.get(key) or [])
            applicability[key] = list(dict.fromkeys(applicability[key])) or ["unvollständig"]
        if metadata_record.get("limits"):
            for key in limits:
                if metadata_record["limits"].get(key):
                    limits[key] = list(metadata_record["limits"][key])
        record["metadata_profiles"] = list(dict.fromkeys(profile_ids))
        record["applicability"] = applicability
        record["limits"] = limits
        for step in record.get("steps") or []:
            step["formula"] = self._formula_summary(self._formula_index[step["formula_ref"]])
            step.setdefault("variable_bindings", [
                {
                    "variable_id": variable["variable_id"],
                    "symbol": variable.get("symbol"),
                    "unit": variable.get("unit"),
                    "required": variable.get("required", True),
                    "source": variable.get("value_source", "project_input_or_previous_step"),
                    "minimum": variable.get("minimum", "unvollständig"),
                    "maximum": variable.get("maximum", "unvollständig"),
                }
                for variable in step["formula"].get("variables") or []
            ])
        record["supporting_formulas"] = [
            self._formula_summary(self._formula_index[formula_id])
            for formula_id in record.get("supporting_formula_refs") or []
        ]
        for alternative in record.get("alternatives") or []:
            alternative["formulas"] = [
                self._formula_summary(self._formula_index[formula_id])
                for formula_id in alternative.get("formula_refs") or []
            ]
        record["formula_count"] = len({formula_id for formula_id, _, _ in self._formula_refs(path)})
        record["standard_refs"] = list(dict.fromkeys(
            standard
            for formula_id, _, _ in self._formula_refs(path)
            for standard in self._formula_index[formula_id].get("standard_refs") or []
        ))
        record["implementation_refs"] = list(dict.fromkeys(
            formula_id for formula_id, _, _ in self._formula_refs(path)
        ))
        record["normative_basis"] = self._normative_basis(record)
        record["required_variables"] = list({
            binding["variable_id"]: binding
            for step in record.get("steps") or []
            for binding in step.get("variable_bindings") or []
        }.values())
        structures, materials, components, scopes = self._variant_values(record)
        record["application_variant_count"] = len(structures) * len(materials) * len(components) * len(scopes)
        record["executable"] = record.get("status") in EXECUTABLE_PATH_STATUSES
        return record

    @staticmethod
    def _variant_values(record: dict[str, Any]) -> list[list[str]]:
        applicability = record.get("applicability") or {}
        result = []
        for key in ("structure_types", "materials", "component_types", "calculation_scopes"):
            values = [str(value) for value in applicability.get(key) or [] if value not in {"all", "unvollständig"}]
            result.append(list(dict.fromkeys(values)) or ["any"])
        return result

    def variant_count(self) -> int:
        return sum(
            len(structures) * len(materials) * len(components) * len(scopes)
            for record in self.records()
            for structures, materials, components, scopes in [self._variant_values(record)]
        )

    def query_variants(
        self,
        *,
        query: str = "",
        structure_type: str = "",
        material: str = "",
        calculation_scope: str = "",
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        page = max(1, int(page))
        page_size = max(1, min(100, int(page_size)))
        needle = query.strip().casefold()
        variants = []
        for record in self.records():
            structures, materials, components, scopes = self._variant_values(record)
            for structure, material_value, component, scope in product(structures, materials, components, scopes):
                if structure_type and structure != structure_type:
                    continue
                if material and material_value != material:
                    continue
                if calculation_scope and scope != calculation_scope:
                    continue
                haystack = f"{record['path_id']} {record['title']} {structure} {material_value} {component} {scope}".casefold()
                if needle and needle not in haystack:
                    continue
                key = f"{record['path_id']}|{structure}|{material_value}|{component}|{scope}"
                digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:10].upper()
                variants.append({
                    "variant_id": f"RWV-{digest}",
                    "base_path_id": record["path_id"],
                    "title": record["title"],
                    "status": record["status"],
                    "structure_type": structure,
                    "material": material_value,
                    "component_type": component,
                    "calculation_scope": scope,
                    "normative_verification_status": record["normative_basis"]["verification_status"],
                    "normative_gate_passed": record["normative_basis"]["gate"]["passed"],
                })
        total = len(variants)
        start = (page - 1) * page_size
        page_count = max(1, (total + page_size - 1) // page_size)
        return {
            "schema_version": "structural-calculation-path-variants/0.1",
            "statistics": {"variant_count": self.variant_count(), "base_path_count": len(self._path_index)},
            "pagination": {"page": page, "page_size": page_size, "page_count": page_count, "total": total, "has_previous": page > 1, "has_next": page < page_count},
            "items": variants[start:start + page_size],
            "meaning": "Deterministische Anwendungsvarianten der kuratierten Rechenwegmuster; keine zusätzlichen, unabhängig verifizierten Rechenmethoden.",
        }

    def records(self) -> list[dict[str, Any]]:
        return [self._decorate(item) for item in self._catalog.get("paths") or []]

    def get(self, path_id: str) -> dict[str, Any]:
        try:
            return self._decorate(self._path_index[path_id])
        except KeyError as error:
            raise KeyError(path_id) from error

    def coverage(self, *, include_eurocodes: bool = False) -> dict[str, Any]:
        bindings: dict[str, list[dict[str, Any]]] = {formula_id: [] for formula_id in self._formula_index}
        for path in self._catalog.get("paths") or []:
            for formula_id, role, method_id in self._formula_refs(path):
                bindings[formula_id].append({
                    "path_id": path["path_id"],
                    "path_title": path["title"],
                    "path_status": path["status"],
                    "role": role,
                    "method_id": method_id,
                })

        records = []
        for formula_id, formula in self._formula_index.items():
            formula_bindings = bindings[formula_id]
            is_historical = "HIST" in formula_id or "historisch" in formula.get("tags", []) or formula_id.startswith("WIND-CORR")
            if not formula_bindings:
                disposition = "unassigned"
                reason = "Keinem Rechenweg zugeordnet."
            elif is_historical:
                disposition = "historical_reference"
                reason = "Als historischer Vergleich erfasst; keine automatische Aktivierung."
            elif formula["status"] == "incomplete":
                disposition = "blocked_incomplete"
                reason = "Im Rechenweg reserviert, aber wegen unvollständiger Verifikation gesperrt."
            elif formula["status"] == "documented":
                disposition = "documented_reference"
                reason = "Erklärungs- oder Auswahlwissen; derzeit kein eigenständiger ausführbarer Schritt."
            elif any(item["path_status"] in EXECUTABLE_PATH_STATUSES for item in formula_bindings):
                disposition = "executable_path"
                reason = "Mindestens einem ausführbaren oder begrenzt ausführbaren Rechenweg zugeordnet."
            else:
                disposition = "reserved"
                reason = "Katalogisiert und einem Ausbaupfad zugeordnet."
            records.append({
                "formula_id": formula_id,
                "title": formula["title"],
                "formula_status": formula["status"],
                "disposition": disposition,
                "reason": reason,
                "bindings": formula_bindings,
            })

        counts = Counter(item["disposition"] for item in records)
        result: dict[str, Any] = {
            "catalogued_formula_count": len(records),
            "assigned_formula_count": len(records) - counts.get("unassigned", 0),
            "unassigned_formula_count": counts.get("unassigned", 0),
            "by_disposition": dict(sorted(counts.items())),
            "records": records,
            "gate": {
                "passed": counts.get("unassigned", 0) == 0,
                "rule": "Jede interne Rechenmethode muss einem aktiven, dokumentierenden, historischen oder gesperrten Rechenweg zugeordnet sein.",
            },
        }
        if include_eurocodes:
            source_catalog = EurocodeRegistry().catalog()
            statistics = source_catalog.get("statistics") or {}
            result["eurocode_source_register"] = {
                "candidate_count": statistics.get("rules", 0),
                "document_count": statistics.get("documents", 0),
                "disposition": "source_candidate_not_executable",
                "reason": "Eurocode-Regel-ID und Formel-ID sind identisch. Die Regel wird erst nach fachlicher Kuratierung, Variablenbindung, NA-Overlay und Testfreigabe ausführbar.",
            }
        return result

    def catalog(self, *, include_coverage_records: bool = False) -> dict[str, Any]:
        records = self.records()
        coverage = self.coverage(include_eurocodes=True)
        if not include_coverage_records:
            coverage = {key: value for key, value in coverage.items() if key != "records"}
        result = {key: deepcopy(value) for key, value in self._catalog.items() if key != "paths"}
        result["paths"] = records
        result["statistics"] = {
            "path_count": len(records),
            "executable_path_count": sum(item["executable"] for item in records),
            "by_status": dict(Counter(item["status"] for item in records)),
            "curated_formula_count": len(self._formula_index),
            "application_variant_count": self.variant_count(),
            "eurocode_candidate_path_count": len(self.eurocodes._workflow_candidates()),
        }
        result["formula_coverage"] = coverage
        return result


__all__ = ["CalculationPathRegistry", "EXECUTABLE_PATH_STATUSES"]
