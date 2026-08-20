"""Loads the literature-to-code-to-test traceability catalog."""

from __future__ import annotations

from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
from typing import Any


class LiteratureRegistry:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or Path(__file__).with_name("catalog.json")
        with self.path.open("r", encoding="utf-8") as stream:
            self._catalog: dict[str, Any] = json.load(stream)

    def catalog(self) -> dict[str, Any]:
        return self._catalog

    def records(self) -> list[dict[str, Any]]:
        return list(self._catalog.get("topics") or [])


class FormulaRegistry:
    """Stable formula index with source, standard and implementation evidence.

    The original 0.2 catalog remains readable. 0.3 normalizes every old and new
    record to the same public shape so the UI never has to guess whether a field
    is missing. Unknown information is deliberately exposed as ``unvollständig``.
    """

    UNKNOWN = "unvollständig"

    _CATEGORY_BY_PREFIX = {
        "EQ": "01_fundamentals", "LOAD": "02_actions", "SNOW": "02_actions",
        "WIND": "02_actions", "COMB": "03_safety", "BEAM": "04_members",
        "TRUSS": "04_members", "STRESS": "05_sections", "SHEAR": "05_sections",
        "BEND": "05_sections", "CENTROID": "05_sections", "ECC": "05_sections",
        "DEF": "05_sections", "BUCK": "06_stability", "RC": "08_materials",
        "FOUND": "09_geotechnics", "EARTH": "09_geotechnics", "WATER": "09_geotechnics",
    }

    _EXAMPLES: dict[str, dict[str, Any]] = {
        "EQ-001": {"inputs": [{"label": "F₁,x", "value": 12, "unit": "kN"}, {"label": "F₂,x", "value": -12, "unit": "kN"}], "steps": ["12 + (−12)"], "result": {"label": "ΣF_x", "value": 0, "unit": "kN", "assessment": "Gleichgewicht"}},
        "EQ-002": {"inputs": [{"label": "Last", "value": -20, "unit": "kN"}, {"label": "Auflager", "value": 20, "unit": "kN"}], "steps": ["−20 + 20"], "result": {"label": "ΣF_z", "value": 0, "unit": "kN", "assessment": "Gleichgewicht"}},
        "EQ-003": {"inputs": [{"label": "F", "value": 10, "unit": "kN"}, {"label": "a", "value": 3, "unit": "m"}, {"label": "R", "value": 15, "unit": "kN"}, {"label": "b", "value": 2, "unit": "m"}], "steps": ["10 · 3 − 15 · 2"], "result": {"label": "ΣM", "value": 0, "unit": "kNm", "assessment": "Gleichgewicht"}},
        "LOAD-001": {"inputs": [{"label": "V", "value": 2, "unit": "m³"}, {"label": "γ", "value": 25, "unit": "kN/m³"}], "steps": ["2 · 25"], "result": {"label": "G_k", "value": 50, "unit": "kN"}},
        "LOAD-002": {"inputs": [{"label": "Beton d", "value": 0.2, "unit": "m"}, {"label": "Beton γ", "value": 25, "unit": "kN/m³"}, {"label": "Estrich d", "value": 0.06, "unit": "m"}, {"label": "Estrich γ", "value": 20, "unit": "kN/m³"}], "steps": ["0,20 · 25 + 0,06 · 20"], "result": {"label": "g_k", "value": 6.2, "unit": "kN/m²"}},
        "LOAD-003": {"inputs": [{"label": "q_area", "value": 5, "unit": "kN/m²"}, {"label": "b_t", "value": 3, "unit": "m"}], "steps": ["5 · 3"], "result": {"label": "q_line", "value": 15, "unit": "kN/m"}},
        "LOAD-004": {"inputs": [{"label": "q", "value": 8, "unit": "kN/m"}, {"label": "L", "value": 5, "unit": "m"}], "steps": ["8 · 5"], "result": {"label": "F", "value": 40, "unit": "kN"}},
        "COMB-001": {"inputs": [{"label": "G_k", "value": 10, "unit": "kN"}, {"label": "Q_k", "value": 6, "unit": "kN"}, {"label": "γ_G", "value": 1.35, "unit": "-"}, {"label": "γ_Q", "value": 1.5, "unit": "-"}], "steps": ["1,35 · 10 + 1,50 · 6"], "result": {"label": "E_d", "value": 22.5, "unit": "kN"}},
        "STRESS-001": {"inputs": [{"label": "N", "value": 200, "unit": "kN"}, {"label": "A", "value": 10000, "unit": "mm²"}], "steps": ["200 000 N / 10 000 mm²"], "result": {"label": "σ", "value": 20, "unit": "N/mm²"}},
        "FOUND-001": {"inputs": [{"label": "N_Ed", "value": 600, "unit": "kN"}, {"label": "A_eff", "value": 4, "unit": "m²"}], "steps": ["600 / 4"], "result": {"label": "σ_Ed", "value": 150, "unit": "kN/m²"}},
        "FOUND-002": {"inputs": [{"label": "M_Ed", "value": 90, "unit": "kNm"}, {"label": "N_Ed", "value": 600, "unit": "kN"}], "steps": ["90 / 600"], "result": {"label": "e", "value": 0.15, "unit": "m"}},
        "FOUND-003": {"inputs": [{"label": "e_x", "value": 0.15, "unit": "m"}, {"label": "B", "value": 2, "unit": "m"}], "steps": ["0,15 ≤ 2/6 = 0,333"], "result": {"label": "Kernbedingung x", "value": "erfüllt", "unit": ""}},
        "SHEAR-001": {"inputs": [{"label": "V", "value": 120, "unit": "kN"}, {"label": "A_v", "value": 6000, "unit": "mm²"}], "steps": ["120 000 / 6 000"], "result": {"label": "τ", "value": 20, "unit": "N/mm²"}},
        "BEAM-001": {"inputs": [{"label": "q", "value": 10, "unit": "kN/m"}, {"label": "L", "value": 6, "unit": "m"}], "steps": ["10 · 6 / 2"], "result": {"label": "R_A = R_B", "value": 30, "unit": "kN"}},
        "BEAM-002": {"inputs": [{"label": "q", "value": 10, "unit": "kN/m"}, {"label": "L", "value": 6, "unit": "m"}], "steps": ["10 · 6² / 8"], "result": {"label": "M_max", "value": 45, "unit": "kNm"}},
        "BEAM-003": {"inputs": [{"label": "q", "value": 10, "unit": "kN/m"}, {"label": "L", "value": 4, "unit": "m"}], "steps": ["10 · 4² / 2"], "result": {"label": "|M_support|", "value": 80, "unit": "kNm"}},
        "BEND-001": {"inputs": [{"label": "M", "value": 100, "unit": "kNm"}, {"label": "W", "value": 1000, "unit": "cm³"}], "steps": ["100·10⁶ Nmm / 1·10⁶ mm³"], "result": {"label": "σ", "value": 100, "unit": "N/mm²"}},
        "BEND-002": {"inputs": [{"label": "b", "value": 200, "unit": "mm"}, {"label": "h", "value": 400, "unit": "mm"}], "steps": ["200 · 400² / 6"], "result": {"label": "W", "value": 5333333.33, "unit": "mm³"}},
        "CENTROID-001": {"inputs": [{"label": "A₁", "value": 2, "unit": "m²"}, {"label": "x₁", "value": 0, "unit": "m"}, {"label": "A₂", "value": 2, "unit": "m²"}, {"label": "x₂", "value": 4, "unit": "m"}], "steps": ["(2·0 + 2·4) / (2+2)"], "result": {"label": "x_s", "value": 2, "unit": "m"}},
        "BUCK-002": {"inputs": [{"label": "E", "value": 210000, "unit": "N/mm²"}, {"label": "I", "value": 80000000, "unit": "mm⁴"}, {"label": "L_cr", "value": 3000, "unit": "mm"}], "steps": ["π² · 210 000 · 80 000 000 / 3 000²"], "result": {"label": "N_cr", "value": 18423, "unit": "kN"}},
        "RC-001": {"inputs": [{"label": "α_cc", "value": 0.85, "unit": "-"}, {"label": "f_ck", "value": 30, "unit": "N/mm²"}, {"label": "γ_c", "value": 1.5, "unit": "-"}], "steps": ["0,85 · 30 / 1,50"], "result": {"label": "f_cd", "value": 17, "unit": "N/mm²"}},
        "RC-002": {"inputs": [{"label": "f_yk", "value": 500, "unit": "N/mm²"}, {"label": "γ_s", "value": 1.15, "unit": "-"}], "steps": ["500 / 1,15"], "result": {"label": "f_yd", "value": 434.78, "unit": "N/mm²"}},
        "RC-003": {"inputs": [{"label": "M_Ed", "value": 120, "unit": "kNm"}, {"label": "z", "value": 500, "unit": "mm"}, {"label": "f_yd", "value": 435, "unit": "N/mm²"}], "steps": ["120·10⁶ / (500 · 435)"], "result": {"label": "A_s,req", "value": 551.72, "unit": "mm²"}},
        "DEF-001": {"inputs": [{"label": "q", "value": 10, "unit": "N/mm"}, {"label": "L", "value": 6000, "unit": "mm"}, {"label": "E", "value": 210000, "unit": "N/mm²"}, {"label": "I", "value": 80000000, "unit": "mm⁴"}], "steps": ["5 · 10 · 6 000⁴ / (384 · 210 000 · 80 000 000)"], "result": {"label": "w_max", "value": 10.05, "unit": "mm"}},
        "SNOW-001": {"inputs": [{"label": "μ_i", "value": 0.8, "unit": "-"}, {"label": "C_e", "value": 1, "unit": "-"}, {"label": "C_t", "value": 1, "unit": "-"}, {"label": "s_k", "value": 0.85, "unit": "kN/m²"}], "steps": ["0,8 · 1,0 · 1,0 · 0,85"], "result": {"label": "s", "value": 0.68, "unit": "kN/m²"}},
        "WIND-001": {"inputs": [{"label": "ρ", "value": 1.25, "unit": "kg/m³"}, {"label": "v_b", "value": 25, "unit": "m/s"}], "steps": ["0,5 · 1,25 · 25² / 1 000"], "result": {"label": "q_b", "value": 0.390625, "unit": "kN/m²"}},
        "WIND-003": {"inputs": [{"label": "q_p", "value": 0.644, "unit": "kN/m²"}, {"label": "c_pe", "value": 0.8, "unit": "-"}, {"label": "c_pi", "value": -0.2, "unit": "-"}], "steps": ["0,644 · (0,8 − (−0,2))"], "result": {"label": "w_net", "value": 0.644, "unit": "kN/m²"}},
        "EARTH-001": {"inputs": [{"label": "φ", "value": 32, "unit": "°"}], "steps": ["tan²(45° − 32°/2)"], "result": {"label": "K_a", "value": 0.307, "unit": "-"}},
        "WATER-001": {"inputs": [{"label": "γ_w", "value": 10, "unit": "kN/m³"}, {"label": "z", "value": 2, "unit": "m"}], "steps": ["10 · 2"], "result": {"label": "p_w", "value": 20, "unit": "kN/m²"}}
    }

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or Path(__file__).with_name("formulas.json")
        with self.path.open("r", encoding="utf-8") as stream:
            base: dict[str, Any] = json.load(stream)
        root = self.path.parent
        with (root / "catalog_structure.json").open("r", encoding="utf-8") as stream:
            structure: dict[str, Any] = json.load(stream)
        with (root / "extended_formulas.json").open("r", encoding="utf-8") as stream:
            extension: dict[str, Any] = json.load(stream)
        with (root / "roadmap_formulas.json").open("r", encoding="utf-8") as stream:
            roadmap: dict[str, Any] = json.load(stream)
        with (root / "formula_examples.json").open("r", encoding="utf-8") as stream:
            example_catalog: dict[str, Any] = json.load(stream)
        self._example_overrides = dict(example_catalog.get("examples") or {})

        sources = [*base.get("sources", []), *structure.get("sources", []), *roadmap.get("sources", [])]
        source_index = {item["source_id"]: item for item in sources}
        category_index = {item["id"]: item for item in structure["categories"]}
        records = [
            self._normalize(item, source_index, category_index)
            for item in [*base.get("formulas", []), *extension.get("formulas", []), *roadmap.get("formulas", [])]
        ]
        identifiers = [item["formula_id"] for item in records]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Duplicate formula_id in structural formula catalog")
        status_counts = {
            status["id"]: sum(1 for item in records if item["status"] == status["id"])
            for status in structure["status_definitions"]
        }
        self._catalog = {
            "catalog_version": structure["schema_version"],
            "purpose": base.get("purpose"),
            "unknown_marker": self.UNKNOWN,
            "categories": structure["categories"],
            "status_definitions": structure["status_definitions"],
            "standard_families": structure["standard_families"],
            "sources": sources,
            "statistics": {"formula_count": len(records), "source_count": len(sources), "by_status": status_counts},
            "formulas": records,
        }

    def _normalize(
        self,
        record: dict[str, Any],
        source_index: dict[str, dict[str, Any]],
        category_index: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        formula_id = str(record.get("formula_id") or self.UNKNOWN)
        prefix = formula_id.split("-", 1)[0]
        category_id = record.get("category_id") or self._CATEGORY_BY_PREFIX.get(prefix, "12_parameters")
        category = category_index.get(category_id, {})
        source = dict(record.get("source") or {})
        source_meta = source_index.get(str(source.get("source_id")), {})
        source.setdefault("pdf_page", source.get("book_pages", self.UNKNOWN))
        source.setdefault("book_pages", str(source.get("pdf_page", self.UNKNOWN)))
        source.setdefault("printed_page", source.get("pdf_page", self.UNKNOWN))
        source.setdefault("section", self.UNKNOWN)
        source.setdefault("excerpt_url", self.UNKNOWN)
        source["title"] = source_meta.get("title", source.get("source_id", self.UNKNOWN))
        source["short_title"] = source_meta.get("short_title", source_meta.get("title", source.get("source_id", self.UNKNOWN)))
        source["kind"] = source_meta.get("kind", source_meta.get("role", "literature"))
        source["normative_authority"] = bool(source_meta.get("normative_authority", False))
        source["standard_state"] = source_meta.get("standard_state", "didaktische Quelle – nicht normativ")
        source["current_replacement"] = source_meta.get("current_replacement", self.UNKNOWN)
        source["official_url"] = source_meta.get("official_url", self.UNKNOWN)
        source["file_name"] = source_meta.get("file_name", self.UNKNOWN)

        status = str(record.get("status") or "incomplete")
        if status not in {"implemented", "implemented_bounded", "documented", "incomplete"}:
            status = "incomplete"
        backend = record.get("backend") or self.UNKNOWN
        tests = record.get("tests") or [self.UNKNOWN]
        example = record.get("example") or self._example_overrides.get(formula_id) or self._EXAMPLES.get(formula_id)
        if example is None:
            example = {
                "inputs": [],
                "steps": [self.UNKNOWN],
                "result": {"label": "Beispielergebnis", "value": self.UNKNOWN, "unit": ""},
            }
        processing_steps = record.get("processing_steps") or [
            {"order": 1, "label": "Eingaben übernehmen", "detail": "Werte, Einheiten und Herkunft werden in den Rechenfall übernommen."},
            {"order": 2, "label": "Gültigkeit prüfen", "detail": "System, Annahmen, Normprofil und Anwendungsgrenzen werden geprüft."},
            {"order": 3, "label": "Einheiten normieren", "detail": "Eingaben werden vor der Auswertung auf konsistente Recheneinheiten gebracht."},
            {"order": 4, "label": "Ansatz auswerten", "detail": str(record.get("equation") or self.UNKNOWN)},
            {"order": 5, "label": "Ergebnis bewerten", "detail": "Ergebnis, Einheit, Ausnutzung und Prüfhinweise werden protokolliert."},
        ]
        incomplete_fields = []
        for name, value in {
            "Formel": record.get("equation"),
            "Quelle": source.get("pdf_page"),
            "Normbezug": record.get("standard_refs"),
            "Implementierung": backend,
            "Test": tests,
            "Quellenausschnitt": source.get("excerpt_url"),
        }.items():
            if not value or value == self.UNKNOWN or value == [self.UNKNOWN]:
                incomplete_fields.append(name)
        variables = []
        for index, variable in enumerate(record.get("variables") or [], 1):
            item = dict(variable)
            item.setdefault("variable_id", f"{formula_id}.input.{index:02d}")
            item.setdefault("role", "input")
            item.setdefault("required", True)
            item.setdefault("value_source", "project_input_or_previous_step")
            item.setdefault("minimum", self.UNKNOWN)
            item.setdefault("maximum", self.UNKNOWN)
            variables.append(item)

        normalized = dict(record)
        normalized.update({
            "formula_id": formula_id,
            "category_id": category_id,
            "category_label": category.get("label", self.UNKNOWN),
            "chapter": record.get("chapter") or category.get("label", self.UNKNOWN),
            "title": record.get("title") or self.UNKNOWN,
            "equation": record.get("equation") or self.UNKNOWN,
            "description": record.get("description") or self.UNKNOWN,
            "variables": variables,
            "assumptions": record.get("assumptions") or [self.UNKNOWN],
            "standard_refs": record.get("standard_refs") or [],
            "source": source,
            "status": status,
            "backend": backend,
            "tests": tests,
            "tags": record.get("tags") or [],
            "processing": {"steps": processing_steps, "example": example},
            "completeness": {
                "complete": len(incomplete_fields) == 0,
                "missing": incomplete_fields or [],
                "label": "vollständig erfasst" if not incomplete_fields else self.UNKNOWN,
            },
        })
        if source.get("kind", "").startswith("historical_standard"):
            knowledge_role = "historical_standard_reference"
        elif source.get("source_id") == "eurocode_local_register":
            knowledge_role = "eurocode_implementation_placeholder"
        elif normalized["standard_refs"]:
            knowledge_role = "engineering_method_with_eurocode_context"
        else:
            knowledge_role = "engineering_method"
        normalized["knowledge_role"] = knowledge_role
        normalized["normative_rule"] = False
        normalized["normative_note"] = (
            "Rechenmethode oder Implementierungsfunktion; keine eigenständige Eurocode-Regel. "
            "Die normative Freigabe entsteht erst durch eine verifizierte Eurocode-Regelreferenz im Rechenweg."
        )
        return normalized

    def catalog(self) -> dict[str, Any]:
        return self._catalog

    def records(self) -> list[dict[str, Any]]:
        return list(self._catalog.get("formulas") or [])

    def get(self, formula_id: str) -> dict[str, Any]:
        match = next((item for item in self.records() if item.get("formula_id") == formula_id), None)
        if match is None:
            raise KeyError(formula_id)
        return match

    def variable_catalog(self) -> dict[str, Any]:
        """Return stable, machine-readable variables used by formula and pipeline bindings."""
        variables = []
        for formula in self.records():
            for variable in formula.get("variables") or []:
                variables.append({
                    **dict(variable),
                    "formula_id": formula["formula_id"],
                    "formula_title": formula["title"],
                    "formula_status": formula["status"],
                    "category_id": formula["category_id"],
                    "standard_refs": list(formula.get("standard_refs") or []),
                })
        return {
            "schema_version": "structural-formula-variable-catalog/0.1",
            "variable_count": len(variables),
            "formula_count_with_variables": len({item["formula_id"] for item in variables}),
            "variables": variables,
            "policy": {
                "identity": "variable_id ist innerhalb einer formula_id stabil und wird von Rechenwegen und Pipelines referenziert.",
                "units": "Die Katalogeinheit ist verbindlich; Konvertierungen müssen vor der Formelauswertung protokolliert werden.",
                "bounds": "Unbekannte Mindest- oder Höchstgrenzen bleiben unvollständig und dürfen nicht geschätzt werden.",
            },
        }


class EurocodeRegistry:
    """Paginated access to the complete EC1-EC9 source/equation index."""

    _cache: dict[Path, dict[str, Any]] = {}

    def __init__(self, path: Path | None = None) -> None:
        self.path = (path or Path(__file__).with_name("eurocode_catalog.json")).resolve()
        if self.path not in self._cache:
            with self.path.open("r", encoding="utf-8") as stream:
                self._cache[self.path] = json.load(stream)
        self._catalog = self._cache[self.path]
        self._rule_index = {item["rule_id"]: item for item in self._catalog.get("rules") or []}
        self._document_index = {item["document_id"]: item for item in self._catalog.get("documents") or []}
        self._rules_by_document: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for rule in self._catalog.get("rules") or []:
            self._rules_by_document[str(rule["document_id"])].append(rule)
        self._workflow_candidates_cache: list[dict[str, Any]] | None = None

    @staticmethod
    def _normalize_designation(value: str) -> str:
        normalized = re.sub(r"[^A-Z0-9]", "", value.upper().replace("DIN", ""))
        return normalized.replace("NA", "")

    @staticmethod
    def as_formula(rule: dict[str, Any]) -> dict[str, Any]:
        """Expose a source rule through the primary Eurocode formula contract."""
        return {
            **rule,
            "formula_id": rule["rule_id"],
            "equation": rule.get("equation_text", "unvollständig"),
            "status": "incomplete",
            "normative_rule": True,
            "knowledge_role": "eurocode_rule_candidate",
            "variables": [],
            "standard_refs": [rule.get("designation")],
            "implementation_ref": None,
            "verification_gate": {
                "passed": rule.get("verification_status") == "expert_verified",
                "status": rule.get("verification_status", "machine_candidate_unverified"),
                "missing": ["Variablen", "Einheiten", "Anwendungsgrenzen", "NA-Overlay", "Test"],
            },
        }

    def catalog(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in self._catalog.items()
            if key != "rules"
        }

    def get_rule(self, rule_id: str) -> dict[str, Any]:
        try:
            return self._rule_index[rule_id]
        except KeyError as error:
            raise KeyError(rule_id) from error

    def get_formula(self, formula_id: str) -> dict[str, Any]:
        return self.as_formula(self.get_rule(formula_id))

    def get_document(self, document_id: str) -> dict[str, Any]:
        try:
            return self._document_index[document_id]
        except KeyError as error:
            raise KeyError(document_id) from error

    def documents_for_standard_refs(self, standard_refs: list[str]) -> list[dict[str, Any]]:
        matches: dict[str, dict[str, Any]] = {}
        normalized_refs = [self._normalize_designation(item) for item in standard_refs if item]
        for document in self._catalog.get("documents") or []:
            designation = self._normalize_designation(str(document.get("designation") or ""))
            if any(ref and (ref in designation or designation in ref) for ref in normalized_refs):
                matches[document["document_id"]] = document
        return list(matches.values())

    def candidate_rules_for_standard_refs(
        self,
        standard_refs: list[str],
        *,
        topics: list[str] | None = None,
        limit: int = 12,
    ) -> dict[str, Any]:
        documents = self.documents_for_standard_refs(standard_refs)
        topic_set = set(topics or [])
        candidates = [
            rule
            for document in documents
            for rule in self._rules_by_document.get(document["document_id"], [])
            if not topic_set or rule.get("topic") in topic_set
        ]
        candidates.sort(key=lambda item: (
            {"high": 0, "medium": 1, "low": 2}.get(str(item.get("confidence")), 3),
            str(item.get("designation")),
            int((item.get("source") or {}).get("pdf_page") or 0),
        ))
        return {
            "document_count": len(documents),
            "candidate_rule_count": len(candidates),
            "documents": [{
                key: document.get(key)
                for key in ("document_id", "designation", "document_kind", "eurocode_family", "current_legal_status", "national_application_status")
            } for document in documents],
            "suggested_rule_refs": [item["rule_id"] for item in candidates[:max(0, limit)]],
            "verification_status": "machine_candidates_require_expert_mapping",
        }

    def _workflow_candidates(self) -> list[dict[str, Any]]:
        if self._workflow_candidates_cache is not None:
            return self._workflow_candidates_cache
        groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
        for rule in self._catalog.get("rules") or []:
            source = rule.get("source") or {}
            key = (str(rule["document_id"]), str(source.get("clause") or "unvollständig"), str(rule.get("topic") or "unvollständig"))
            groups[key].append(rule)
        records = []
        for (document_id, clause, topic), rules in groups.items():
            first = rules[0]
            digest = hashlib.sha1(f"{document_id}|{clause}|{topic}".encode("utf-8")).hexdigest()[:12].upper()
            records.append({
                "candidate_path_id": f"EC-RW-{digest}",
                "eurocode_family": first["eurocode_family"],
                "family_title": first["family_title"],
                "document_id": document_id,
                "designation": first["designation"],
                "document_kind": first["document_kind"],
                "clause": clause,
                "section": (first.get("source") or {}).get("section", "unvollständig"),
                "topic": topic,
                "title": f"{first['designation']} · {clause} · {(first.get('source') or {}).get('section', topic)}",
                "status": "candidate_unverified",
                "verification_gate": {
                    "passed": False,
                    "rule": "Erst nach fachlicher Prüfung von Normtext, Nationalem Anhang, Variablen, Grenzen und Testwerten ausführbar.",
                },
                "rule_count": len(rules),
                "rule_refs": [item["rule_id"] for item in rules],
                "purpose": "Normabschnitt als Kandidat für einen fachlich zu kuratierenden Rechenweg.",
                "missing": ["fachliche Schrittfolge", "Variablenbindung", "Gültigkeitsgrenzen", "NA-Overlay", "Implementierung", "Tests"],
            })
        records.sort(key=lambda item: (item["eurocode_family"], item["designation"], item["clause"], item["topic"]))
        self._workflow_candidates_cache = records
        return records

    def query_workflow_candidates(
        self,
        *,
        query: str = "",
        family: str = "",
        topic: str = "",
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        page = max(1, int(page))
        page_size = max(1, min(100, int(page_size)))
        needle = query.strip().casefold()
        records = []
        for item in self._workflow_candidates():
            if family and item["eurocode_family"] != family:
                continue
            if topic and item["topic"] != topic:
                continue
            if needle and needle not in " ".join(str(value) for value in item.values() if not isinstance(value, list)).casefold():
                continue
            records.append(item)
        total = len(records)
        start = (page - 1) * page_size
        page_count = max(1, (total + page_size - 1) // page_size)
        return {
            "schema_version": "eurocode-calculation-path-candidates/0.1",
            "statistics": {
                "candidate_path_count": len(self._workflow_candidates()),
                "by_family": dict(Counter(item["eurocode_family"] for item in self._workflow_candidates())),
                "by_topic": dict(Counter(item["topic"] for item in self._workflow_candidates())),
            },
            "pagination": {"page": page, "page_size": page_size, "page_count": page_count, "total": total, "has_previous": page > 1, "has_next": page < page_count},
            "items": records[start:start + page_size],
            "gate": {"passed": False, "rule": "Maschinell gruppierte Normabschnitte werden erst nach fachlicher Kuratierung zu ausführbaren Rechenwegen."},
        }

    def query_rules(
        self,
        *,
        query: str = "",
        family: str = "",
        document_id: str = "",
        document_kind: str = "",
        confidence: str = "",
        topic: str = "",
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        page = max(1, int(page))
        page_size = max(1, min(100, int(page_size)))
        needle = query.strip().casefold()
        records = []
        for item in self._catalog.get("rules") or []:
            if family and item.get("eurocode_family") != family:
                continue
            if document_id and item.get("document_id") != document_id:
                continue
            if document_kind and item.get("document_kind") != document_kind:
                continue
            if confidence and item.get("confidence") != confidence:
                continue
            if topic and item.get("topic") != topic:
                continue
            if needle:
                haystack = " ".join(
                    str(item.get(key) or "")
                    for key in ("rule_id", "designation", "title", "equation_text", "source_excerpt", "topic")
                ).casefold()
                if needle not in haystack:
                    continue
            records.append(item)
        total = len(records)
        confidence_order = {"high": 0, "medium": 1, "low": 2}
        records.sort(
            key=lambda item: (
                confidence_order.get(str(item.get("confidence")), 3),
                str(item.get("eurocode_family")),
                str(item.get("designation")),
                int((item.get("source") or {}).get("pdf_page") or 0),
                str(item.get("rule_id")),
            )
        )
        start = (page - 1) * page_size
        end = start + page_size
        page_count = max(1, (total + page_size - 1) // page_size)
        return {
            "schema_version": self._catalog["schema_version"],
            "query": {
                "q": query,
                "family": family,
                "document_id": document_id,
                "document_kind": document_kind,
                "confidence": confidence,
                "topic": topic,
            },
            "pagination": {
                "page": page,
                "page_size": page_size,
                "page_count": page_count,
                "total": total,
                "has_previous": page > 1,
                "has_next": page < page_count,
            },
            "items": records[start:end],
        }


__all__ = ["EurocodeRegistry", "FormulaRegistry", "LiteratureRegistry"]
