"""Load and resolve the built-in structural-report template catalog."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Iterable

from src.knowledge import StructuralPipelineRegistry


MODULE_ROOT = Path(__file__).resolve().parent
CATALOG_PATH = MODULE_ROOT / "catalog.json"
SECTION_TEMPLATES_PATH = MODULE_ROOT / "section_templates.json"
CALCULATION_MODULES_PATH = MODULE_ROOT / "calculation_modules.json"
PIPELINE_BINDINGS_PATH = MODULE_ROOT / "pipeline_bindings.json"
TEST_CASES_PATH = MODULE_ROOT / "test_cases.json"
CONTRACT_ROOT = MODULE_ROOT.parent / "contracts"
SCHEMA_PATH = CONTRACT_ROOT / "structural_report_template.schema.json"
OUTLINE_SCHEMA_PATH = CONTRACT_ROOT / "structural_report_outline.schema.json"

class ReportTemplateRepository:
    """Read-only repository for HTML report, outline and section definitions."""

    def __init__(
        self,
        catalog_path: Path = CATALOG_PATH,
        section_templates_path: Path = SECTION_TEMPLATES_PATH,
        calculation_modules_path: Path = CALCULATION_MODULES_PATH,
        pipeline_bindings_path: Path = PIPELINE_BINDINGS_PATH,
        test_cases_path: Path = TEST_CASES_PATH,
    ) -> None:
        self._catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        self._section_catalog = json.loads(
            section_templates_path.read_text(encoding="utf-8")
        )
        self._module_catalog = json.loads(
            calculation_modules_path.read_text(encoding="utf-8")
        )
        self._pipeline_binding_catalog = json.loads(
            pipeline_bindings_path.read_text(encoding="utf-8")
        )
        self._test_case_catalog = json.loads(
            test_cases_path.read_text(encoding="utf-8")
        )
        self._templates = {
            item["template_id"]: item for item in self._catalog.get("templates", [])
        }
        self._section_templates = {
            item["section_template_id"]: item
            for item in self._section_catalog.get("templates", [])
        }
        self._modules = {
            item["module_id"]: item for item in self._module_catalog.get("modules", [])
        }
        self._pipeline_bindings = {
            item["template_id"]: item
            for item in self._pipeline_binding_catalog.get("bindings", [])
        }
        self._test_cases = {
            item["case_id"]: item for item in self._test_case_catalog.get("cases", [])
        }
        self._pipeline_registry = StructuralPipelineRegistry()
        self._validate_pipeline_bindings()

    def catalog(self) -> dict:
        """Return lightweight entries for the visual template browser."""
        disciplines = deepcopy(self._catalog.get("disciplines", []))
        entries = []
        project_profiles = self._module_catalog.get("project_profiles", {})
        for item in self._templates.values():
            entry = {
                key: deepcopy(item[key])
                for key in (
                    "template_id",
                    "discipline",
                    "family",
                    "title",
                    "short_title",
                    "summary",
                    "tags",
                    "system_figure",
                    "accent",
                )
            }
            profile = project_profiles.get(item["template_id"], {})
            entry.update(
                {
                    "outline_title": profile.get("outline_title", item["title"]),
                    "position_group_count": len(profile.get("position_groups", [])),
                    "pipeline_ids": deepcopy(
                        self._pipeline_bindings[item["template_id"]]["pipeline_ids"]
                    ),
                    "visualization_count": 4,
                }
            )
            entries.append(entry)
        return {
            "schema_version": self._catalog["schema_version"],
            "template_contract": self._catalog["template_contract"],
            "module_catalog_version": self._module_catalog["schema_version"],
            "section_template_catalog_version": self._section_catalog["schema_version"],
            "disciplines": disciplines,
            "outline_variants": deepcopy(self._module_catalog.get("variants", [])),
            "statistics": {
                "template_count": len(entries),
                "discipline_count": len(disciplines),
                "pipeline_profile_count": len(self._catalog.get("pipeline_profiles", {})),
                "calculation_module_count": len(self._modules),
                "section_template_count": len(self._section_templates),
                "linked_pipeline_count": len({
                    pipeline_id
                    for binding in self._pipeline_bindings.values()
                    for pipeline_id in binding["pipeline_ids"]
                }),
                "test_case_count": len(self._test_cases),
            },
            "templates": entries,
        }

    def get(self, template_id: str) -> dict:
        """Resolve a catalog entry into the runtime template contract."""
        try:
            item = deepcopy(self._templates[template_id])
        except KeyError as error:
            raise KeyError(template_id) from error

        chapter_profile = self._catalog["chapter_profiles"][item.pop("chapter_profile")]
        pipeline_profile = self._catalog["pipeline_profiles"][item.pop("pipeline_profile")]
        binding = deepcopy(self._pipeline_bindings[template_id])
        linked_pipelines = [
            self._pipeline_summary(self._pipeline_registry.get(pipeline_id))
            for pipeline_id in binding["pipeline_ids"]
        ]
        legacy_chapters = deepcopy(chapter_profile)
        legacy_chapters.extend(item.pop("object_chapters", []))
        legacy_chapters.extend(deepcopy(self._catalog.get("closing_chapters", [])))

        variables = deepcopy(self._catalog.get("common_variable_slots", []))
        variables.extend(deepcopy(pipeline_profile.get("variable_slots", [])))

        default_outline = self.outline(template_id)
        item.update(
            {
                "contract_version": self._catalog["template_contract"],
                "chapters": deepcopy(default_outline["chapters"]),
                "legacy_chapters": legacy_chapters,
                "outline_profile": deepcopy(default_outline["profile"]),
                "outline_variants": deepcopy(self._module_catalog.get("variants", [])),
                "position_groups": deepcopy(default_outline["position_groups"]),
                "calculation_modules": deepcopy(default_outline["available_modules"]),
                "default_outline_statistics": deepcopy(default_outline["statistics"]),
                "variable_slots": variables,
                "pipeline_binding": {
                    key: deepcopy(value)
                    for key, value in pipeline_profile.items()
                    if key != "variable_slots"
                },
                "rendering": deepcopy(self._catalog["rendering"]),
            }
        )
        item["pipeline_binding"].update({
            "binding_contract": self._pipeline_binding_catalog["schema_version"],
            "pipeline_ids": binding["pipeline_ids"],
            "pipelines": linked_pipelines,
            "path_refs": list(dict.fromkeys(
                path_id
                for pipeline in linked_pipelines
                for path_id in pipeline["path_refs"]
            )),
            "release_gate": {
                "passed": bool(linked_pipelines) and all(
                    pipeline["normative_gate_passed"] and pipeline["executable"]
                    for pipeline in linked_pipelines
                ),
                "rule": "Alle verknüpften Pipelines müssen ausführbar und normativ bestätigt sein.",
            },
        })
        item["visualization_plan"] = self._visualization_plan(item, linked_pipelines)
        item["rendering"]["pages"] = list(dict.fromkeys([
            *item["rendering"]["pages"],
            "visualizations",
        ]))
        return item

    def test_cases(self) -> dict:
        """Return persistent example inputs used to verify the template pipeline."""
        return {
            "schema_version": self._test_case_catalog["schema_version"],
            "statistics": {"case_count": len(self._test_cases)},
            "cases": [
                {
                    "case_id": item["case_id"],
                    "label": item["label"],
                    "template_id": item["template_id"],
                    "expected_pipeline_ids": deepcopy(item["expected_pipeline_ids"]),
                    "expected_figure_kind": item["expected_figure_kind"],
                }
                for item in self._test_cases.values()
            ],
        }

    def preview_case(self, case_id: str) -> dict:
        """Compose one deterministic HTML-preview contract from persisted test data."""
        try:
            case = deepcopy(self._test_cases[case_id])
        except KeyError as error:
            raise KeyError(case_id) from error
        template = self.get(case["template_id"])
        template["preview"] = self._merge_dict(template["preview"], case["preview"])
        outline = self.outline(case["template_id"], facts=case.get("facts") or {})
        return {
            "contract_version": "structural-calculation-template-preview/0.1",
            "case": case,
            "template": template,
            "outline": outline,
            "pipeline_binding": deepcopy(template["pipeline_binding"]),
            "visualizations": deepcopy(template["visualization_plan"]),
            "rendering": {
                "format": "html",
                "continuous_pages": True,
                "manual_zoom": False,
                "page_count": len(template["rendering"]["pages"]),
            },
        }

    def _validate_pipeline_bindings(self) -> None:
        missing_templates = sorted(set(self._templates) - set(self._pipeline_bindings))
        unknown_templates = sorted(set(self._pipeline_bindings) - set(self._templates))
        if missing_templates or unknown_templates:
            raise ValueError(
                f"Invalid report pipeline bindings; missing={missing_templates}, unknown={unknown_templates}"
            )
        for binding in self._pipeline_bindings.values():
            for pipeline_id in binding.get("pipeline_ids") or []:
                self._pipeline_registry.get(pipeline_id)
        for case in self._test_cases.values():
            if case["template_id"] not in self._templates:
                raise ValueError(f"Unknown report-template test case template: {case['template_id']}")

    @staticmethod
    def _pipeline_summary(pipeline: dict) -> dict:
        return {
            "pipeline_id": pipeline["pipeline_id"],
            "title": pipeline["title"],
            "domain": pipeline.get("domain"),
            "level": pipeline["level"],
            "status": pipeline["status"],
            "executable": pipeline["executable"],
            "normative_gate_passed": pipeline["normative_basis"]["gate"]["passed"],
            "path_refs": deepcopy(pipeline["path_refs"]),
            "outputs": deepcopy(pipeline.get("outputs") or []),
        }

    @staticmethod
    def _visualization_plan(item: dict, pipelines: list[dict]) -> list[dict]:
        pipeline_ids = [pipeline["pipeline_id"] for pipeline in pipelines]
        path_refs = list(dict.fromkeys(
            path_id for pipeline in pipelines for path_id in pipeline["path_refs"]
        ))
        system_kind = item.get("system_figure", "special")
        if system_kind == "bridge":
            action_kind = "bridge_actions"
        elif system_kind == "tower":
            action_kind = "wind_actions"
        elif system_kind == "hall":
            action_kind = "snow_wind_actions"
        else:
            action_kind = "actions"
        definitions = [
            ("system", "System und Geometrie", system_kind, "/model/geometry"),
            ("load_path", "Lastpfad und Auflagerreaktionen", "load_path", "/load_path"),
            ("actions", "Einwirkungen und Lastanordnung", action_kind, "/load_combinations"),
            ("results", "Ergebnis- und Ausnutzungsverlauf", "results", "/checks"),
        ]
        return [{
            "visualization_id": f"{item['template_id']}-{identifier}",
            "title": title,
            "figure_kind": figure_kind,
            "renderer": "inline_svg",
            "target_page": "visualizations",
            "data_pointer": pointer,
            "source_pipeline_ids": pipeline_ids,
            "source_path_refs": path_refs,
            "automatic": True,
            "release_state": "preview_only",
        } for identifier, title, figure_kind, pointer in definitions]

    @classmethod
    def _merge_dict(cls, base: dict, override: dict) -> dict:
        result = deepcopy(base)
        for key, value in override.items():
            if isinstance(value, dict) and isinstance(result.get(key), dict):
                result[key] = cls._merge_dict(result[key], value)
            else:
                result[key] = deepcopy(value)
        return result

    def outline(
        self,
        template_id: str,
        *,
        variant: str = "regelfall",
        facts: dict | None = None,
        enabled_modules: Iterable[str] | None = None,
        disabled_modules: Iterable[str] | None = None,
    ) -> dict:
        """Build a newly numbered outline from project facts and user scope choices."""
        if template_id not in self._templates:
            raise KeyError(template_id)

        variants = {
            item["variant_id"]: item for item in self._module_catalog.get("variants", [])
        }
        if variant not in variants:
            raise ValueError(f"unknown outline variant: {variant}")

        project_profile = deepcopy(
            self._module_catalog["project_profiles"][template_id]
        )
        base_id = project_profile["extends"]
        base_profile = deepcopy(self._module_catalog["base_profiles"][base_id])
        outline_profile_id = base_profile["outline_profile"]
        outline_groups = deepcopy(
            self._module_catalog["outline_profiles"][outline_profile_id]
        )

        resolved_facts = deepcopy(project_profile.get("default_facts", {}))
        if facts:
            resolved_facts.update(facts)
        enabled = set(enabled_modules or [])
        disabled = set(disabled_modules or []) - enabled

        requirements: dict[str, dict] = {}
        for profile_source, profile in (("base", base_profile), ("project", project_profile)):
            for module_id in profile.get("required_modules", []):
                requirements[module_id] = {
                    "requirement": "required",
                    "profile_source": profile_source,
                }
            for condition in profile.get("conditional_modules", []):
                module_id = condition["module_id"]
                if module_id not in requirements:
                    requirements[module_id] = {
                        "requirement": "conditional",
                        "fact": condition["fact"],
                        "profile_source": profile_source,
                    }
            for module_id in profile.get("optional_modules", []):
                if module_id not in requirements:
                    requirements[module_id] = {
                        "requirement": "optional",
                        "profile_source": profile_source,
                    }

        available_modules = []
        for module_id, requirement in requirements.items():
            module = deepcopy(self._modules[module_id])
            requirement_kind = requirement["requirement"]
            condition_fact = requirement.get("fact")
            condition_value = bool(resolved_facts.get(condition_fact, False))
            manually_enabled = module_id in enabled
            manually_disabled = module_id in disabled and requirement_kind != "required"

            if requirement_kind == "required":
                active = True
                reason = "Pflichtmodul der Projektart"
            elif manually_enabled:
                active = True
                reason = "Im Umfang manuell aktiviert"
            elif manually_disabled:
                active = False
                reason = "Im Umfang manuell deaktiviert"
            elif variant in {"vollstaendig", "prueffassung"}:
                active = True
                reason = "Durch Ausgabevariante aktiviert"
            elif requirement_kind == "conditional":
                active = condition_value
                reason = (
                    f"Projektmerkmal „{condition_fact}“ ist aktiv"
                    if active
                    else f"Projektmerkmal „{condition_fact}“ ist nicht aktiv"
                )
            else:
                active = False
                reason = "Optionales Modul ist im Regelfall nicht aktiv"

            module["activation"] = {
                **requirement,
                "active": active,
                "reason": reason,
                "condition_value": condition_value if condition_fact else None,
                "manually_enabled": manually_enabled,
                "manually_disabled": manually_disabled,
            }
            available_modules.append(module)

        module_order = {module_id: index for index, module_id in enumerate(requirements)}
        group_order = {
            group["group_id"]: index for index, group in enumerate(outline_groups)
        }
        available_modules.sort(
            key=lambda item: (
                group_order.get(item["group"], len(group_order)),
                module_order[item["module_id"]],
            )
        )

        chapters = []
        groups = []
        active_group_number = 0
        for group in outline_groups:
            active_modules = [
                module
                for module in available_modules
                if module["group"] == group["group_id"]
                and module["activation"]["active"]
            ]
            if not active_modules:
                continue
            active_group_number += 1
            group_entry = {
                **deepcopy(group),
                "number": str(active_group_number),
                "chapter_count": len(active_modules),
            }
            groups.append(group_entry)
            for chapter_index, module in enumerate(active_modules, start=1):
                section_template = deepcopy(
                    self._section_templates[module["section_template_id"]]
                )
                chapter = deepcopy(module)
                chapter.update(
                    {
                        "chapter_id": module["module_id"],
                        "number": f"{active_group_number}.{chapter_index}",
                        "group_title": group["title"],
                        "kind": self._chapter_kind(module),
                        "source": "pipeline" if module["calculations"] else "hybrid",
                        "repeatable": module["repeat_by"] != "once",
                        "section_template": section_template,
                    }
                )
                chapters.append(chapter)

        page_lows = sum(chapter["page_range"][0] for chapter in chapters)
        page_highs = sum(chapter["page_range"][1] for chapter in chapters)
        result = {
            "contract_version": "structural-report-outline/0.2",
            "template_id": template_id,
            "template_title": self._templates[template_id]["title"],
            "outline_title": project_profile["outline_title"],
            "variant": deepcopy(variants[variant]),
            "profile": {
                "profile_id": outline_profile_id,
                "base_profile_id": base_id,
                "groups": outline_groups,
            },
            "facts": resolved_facts,
            "scope": {
                "enabled_modules": sorted(enabled),
                "disabled_modules": sorted(disabled),
            },
            "position_groups": deepcopy(project_profile.get("position_groups", [])),
            "groups": groups,
            "chapters": chapters,
            "available_modules": available_modules,
            "statistics": {
                "group_count": len(groups),
                "chapter_count": len(chapters),
                "available_module_count": len(available_modules),
                "block_template_count": sum(
                    len(chapter["section_template"]["blocks"])
                    for chapter in chapters
                ),
                "calculation_count": sum(
                    len(chapter["calculations"]) for chapter in chapters
                ),
                "sketch_slot_count": sum(chapter["sketch_slots"] for chapter in chapters),
                "table_slot_count": sum(chapter["table_slots"] for chapter in chapters),
                "repeatable_chapter_count": sum(
                    1 for chapter in chapters if chapter["repeatable"]
                ),
                "estimated_pages_low": page_lows,
                "estimated_pages_high": page_highs,
            },
        }
        if variant == "prueffassung":
            result["review_mode"] = {
                "enabled": True,
                "freeze_numbering": True,
                "include_source_status": True,
                "include_calculation_audit": True,
                "include_approval_matrix": True,
            }
        return result

    def section_templates(self) -> dict:
        return {
            "schema_version": self._section_catalog["schema_version"],
            "statistics": {"section_template_count": len(self._section_templates)},
            "templates": deepcopy(list(self._section_templates.values())),
        }

    @staticmethod
    def _chapter_kind(module: dict) -> str:
        if module["group"] == "document":
            return "frontmatter"
        if module["group"] == "appendix":
            return "appendix"
        if module["group"] == "results":
            return "matrix"
        return "calculation" if module["calculations"] else "narrative"

    @staticmethod
    def schema() -> dict:
        return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    @staticmethod
    def outline_schema() -> dict:
        return json.loads(OUTLINE_SCHEMA_PATH.read_text(encoding="utf-8"))


__all__ = ["ReportTemplateRepository"]
