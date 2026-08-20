from __future__ import annotations

from src.knowledge import CalculationPathRegistry, FormulaRegistry, StructuralPipelineRegistry
from src.pipeline import CalculationPathPlanner, CalculationPipeline, StructuralPipelinePlanner
from src.projects import ProjectCaseRepository
from src.reference_cases import ReferenceCaseRepository


def test_every_curated_formula_is_classified_in_a_persistent_calculation_path():
    registry = CalculationPathRegistry()
    catalog = registry.catalog()
    coverage = registry.coverage()

    assert catalog["schema_version"] == "structural-calculation-path-catalog/0.1"
    assert catalog["statistics"]["path_count"] >= 20
    assert coverage["catalogued_formula_count"] >= 100
    assert coverage["assigned_formula_count"] == coverage["catalogued_formula_count"]
    assert coverage["unassigned_formula_count"] == 0
    assert coverage["gate"]["passed"] is True
    assert coverage["by_disposition"]["executable_path"] >= 60
    assert coverage["by_disposition"]["blocked_incomplete"] > 0
    assert coverage["by_disposition"]["historical_reference"] > 0


def test_calculation_paths_only_reference_known_formula_ids():
    registry = CalculationPathRegistry()
    for path in registry.records():
        assert path["steps"]
        assert all(step["formula"]["formula_id"] == step["formula_ref"] for step in path["steps"])
        assert all(step["formula"]["equation"] for step in path["steps"])


def test_every_executable_formula_has_a_persistent_example_substitution_and_result():
    formulas = FormulaRegistry().records()
    executable = [item for item in formulas if item["status"] in {"implemented", "implemented_bounded"}]
    assert executable
    assert all(item["processing"]["example"]["inputs"] for item in executable)
    assert all(item["processing"]["example"]["steps"] != ["unvollständig"] for item in executable)
    assert all(item["processing"]["example"]["result"].get("value") != "unvollständig" for item in executable)


def test_rule_planner_selects_stability_chain_and_binds_runtime_values():
    project = ProjectCaseRepository().get("complex_residential_building")
    payload = next(item["job"] for item in project["positions"] if item["position_ref"] == "P05")
    payload["project_ref"] = project["project_ref"]
    payload["model_revision_ref"] = project["model_revision_ref"]
    result = CalculationPipeline().run(payload)
    plan = result["calculation_plan"]

    selected = {item["path_id"]: item for item in plan["paths"]}
    assert {"RW-BASIS-001", "RW-COMB-001", "RW-SECTION-001", "RW-STABILITY-001"}.issubset(selected)
    stability = selected["RW-STABILITY-001"]
    assert [step["formula_ref"] for step in stability["steps"]] == ["BUCK-002", "BUCK-003"]
    assert all(step["execution_state"] == "executed" for step in stability["steps"])
    assert stability["steps"][0]["result"]["unit"] == "kN"
    assert stability["steps"][1]["result"]["unit"] == "-"
    assert plan["execution_summary"]["catalog_gate_passed"] is True
    assert result["workflow_plan"]["path_coverage"]["gate"]["passed"] is True
    assert result["summary"]["workflow_pipeline_count"] >= 1


def test_rule_planner_keeps_old_and_current_wind_methods_separate():
    planner = CalculationPathPlanner()
    plan = planner.plan_from_facts({
        "load_case_action_types": [],
        "environmental_action_types": ["wind"],
        "design_types": [],
        "requested_capabilities": [],
        "analysis_kind": None,
    })
    wind = next(item for item in plan["paths"] if item["path_id"] == "RW-WIND-001")
    assert [step["formula_ref"] for step in wind["steps"]] == ["WIND-001", "WIND-002", "WIND-003", "WIND-004"]
    historical = next(item for item in wind["alternatives"] if item["method_id"] == "din1055-4-historical")
    assert historical["status"] == "historical_reference"
    assert historical["activation"].startswith("nur explizites")


def test_calculation_path_ui_and_apis_are_available(client):
    page = client.get("/statik/rechenwege")
    assert page.status_code == 302
    assert "/statik/katalog?bereich=rechenwege" in page.headers["Location"]
    page = client.get("/statik/rechenwege?embedded=1")
    markup = page.get_data(as_text=True)
    assert "Rechenweg-Katalog" in markup
    assert 'id="calculationSteps"' in markup
    assert 'id="coverageGate"' in markup

    catalog_response = client.get("/api/v1/statik/calculation-paths")
    catalog = catalog_response.get_json()
    assert catalog_response.status_code == 200
    assert catalog["formula_coverage"]["gate"]["passed"] is True
    assert catalog["formula_coverage"]["eurocode_source_register"]["candidate_count"] == 12089

    detail = client.get("/api/v1/statik/calculation-paths/RW-STABILITY-001")
    assert detail.status_code == 200
    assert detail.get_json()["steps"][1]["formula"]["formula_id"] == "BUCK-003"
    assert client.get("/api/v1/statik/calculation-paths/UNKNOWN").status_code == 404

    plan = client.post("/api/v1/statik/calculation-paths/plan", json={"facts": {
        "load_case_categories": ["permanent"],
        "load_case_action_types": [],
        "environmental_action_types": [],
        "analysis_kind": "beam_line",
        "design_types": ["steel"],
        "requested_capabilities": [],
    }})
    assert plan.status_code == 200
    assert {item["path_id"] for item in plan.get_json()["paths"]} >= {"RW-BEAM-001", "RW-STEEL-001"}


def test_pipeline_catalog_covers_every_path_and_derives_formula_variables():
    registry = StructuralPipelineRegistry()
    catalog = registry.catalog()
    coverage = registry.coverage()

    assert catalog["schema_version"] == "structural-pipeline-catalog/0.1"
    assert catalog["statistics"]["pipeline_count"] >= 12
    assert coverage["assigned_path_count"] == coverage["catalogued_path_count"]
    assert coverage["unassigned_path_count"] == 0
    assert coverage["gate"]["passed"] is True
    bridge = registry.get("PIPE-STRUCT-BRIDGE-001")
    assert "RW-BRIDGE-LM1-001" in bridge["path_refs"]
    assert bridge["variable_count"] > 100
    assert all(item["variable_id"] for item in bridge["required_variables"])


def test_pipeline_extension_pack_covers_scaffolding_bridge_components_and_building_typologies():
    registry = StructuralPipelineRegistry()
    catalog = registry.catalog()

    assert catalog["statistics"]["pipeline_count"] >= 54
    assert catalog["statistics"]["by_domain"]["scaffolding"] >= 5
    assert catalog["statistics"]["by_domain"]["bridge"] >= 20
    assert catalog["statistics"]["by_domain"]["building"] >= 15

    suspended = registry.get("PIPE-STRUCT-SCAFFOLD-SUSPENDED-001")
    assert "DIN EN 12811-1:2004-03" in suspended["normative_basis"]["supplementary_standard_candidates"]
    assert suspended["normative_basis"]["gate"]["passed"] is False

    gaps = registry.get("PIPE-GAP-SCAFFOLD-SPECIAL-001")
    assert gaps["status"] == "incomplete"
    assert gaps["executable"] is False
    assert "mobile_access_tower" in gaps["applicability"]["components"]

    bearing = registry.get("PIPE-COMP-BRIDGE-BEARING-001")
    assert any("DIN EN 1337" in item for item in bearing["normative_basis"]["supplementary_standard_candidates"])
    assert registry.get("PIPE-STRUCT-HOSPITAL-001")["building_profile"]["structure_type"] == "hospital_building"
    assert registry.get("PIPE-GAP-BUILDING-TYPOLOGY-001")["executable"] is False
    assert registry.get("PIPE-GAP-BRIDGE-SCOPE-001")["executable"] is False


def test_specialist_pipeline_planner_selects_typology_and_keeps_normative_gate_closed():
    planner = StructuralPipelinePlanner()
    scaffolding = planner.plan_from_facts({
        "structure_type": "scaffold_suspended",
        "calculation_scope": "structure",
        "load_case_categories": ["permanent", "variable"],
        "load_case_action_types": ["imposed", "wind"],
        "environmental_action_types": ["wind"],
        "analysis_kind": "member_system",
        "design_types": ["steel"],
        "requested_capabilities": [],
    })
    scaffold_ids = {item["pipeline_id"] for item in scaffolding["pipelines"]}
    assert "PIPE-STRUCT-SCAFFOLD-SUSPENDED-001" in scaffold_ids
    scaffold = next(item for item in scaffolding["pipelines"] if item["pipeline_id"] == "PIPE-STRUCT-SCAFFOLD-SUSPENDED-001")
    assert scaffold["runtime_gate"]["passed"] is False

    bridge = planner.plan_from_facts({
        "structure_type": "bridge",
        "bridge_type": "road_bridge",
        "calculation_scope": "structure",
        "load_case_categories": ["permanent", "variable"],
        "load_case_action_types": ["traffic"],
        "environmental_action_types": [],
        "analysis_kind": "grillage_plate",
        "design_types": ["reinforced_concrete"],
        "requested_capabilities": [],
    })
    bridge_ids = {item["pipeline_id"] for item in bridge["pipelines"]}
    assert {"PIPE-STRUCT-BRIDGE-001", "PIPE-STRUCT-BRIDGE-ROAD-001"}.issubset(bridge_ids)

    hospital = planner.plan_from_facts({
        "structure_type": "hospital_building",
        "calculation_scope": "structure",
        "load_case_categories": ["permanent", "variable"],
        "load_case_action_types": ["imposed"],
        "environmental_action_types": [],
        "analysis_kind": "building_system",
        "design_types": ["reinforced_concrete"],
        "requested_capabilities": [],
    })
    assert "PIPE-STRUCT-HOSPITAL-001" in {item["pipeline_id"] for item in hospital["pipelines"]}


def test_pipeline_planner_selects_building_and_governance_and_exposes_blockers():
    planner = StructuralPipelinePlanner()
    plan = planner.plan_from_facts({
        "structure_type": "residential_building",
        "calculation_scope": "structure",
        "load_case_categories": ["permanent", "imposed"],
        "load_case_action_types": ["imposed", "snow", "wind"],
        "environmental_action_types": ["snow", "wind"],
        "analysis_kind": "grillage_plate",
        "design_types": ["reinforced_concrete"],
        "requested_capabilities": [],
    })
    selected = {item["pipeline_id"]: item for item in plan["pipelines"]}
    assert {"PIPE-STRUCT-BUILDING-001", "PIPE-GOV-RELEASE-001"}.issubset(selected)
    assert selected["PIPE-STRUCT-BUILDING-001"]["runtime_gate"]["passed"] is False
    assert selected["PIPE-STRUCT-BUILDING-001"]["runtime_gate"]["blockers"]
    assert plan["execution_summary"]["catalog_gate_passed"] is True


def test_unified_catalog_pipeline_ui_and_apis_are_available(client):
    page = client.get("/statik/katalog?bereich=pipelines")
    markup = page.get_data(as_text=True)
    assert page.status_code == 200
    assert "Wissens- und Pipelinekatalog" in markup
    assert 'data-area="eurocodes"' in markup
    assert 'data-area="rechenwege"' in markup
    assert 'data-area="pipelines"' in markup
    assert 'data-area="methoden"' in markup
    assert 'data-area="berechnungstemplates"' in markup

    embedded = client.get("/statik/pipelines?embedded=1")
    assert embedded.status_code == 200
    assert 'id="pipelinePhases"' in embedded.get_data(as_text=True)

    catalog = client.get("/api/v1/statik/pipelines")
    assert catalog.status_code == 200
    assert catalog.get_json()["path_coverage"]["gate"]["passed"] is True
    detail = client.get("/api/v1/statik/pipelines/PIPE-STRUCT-BUILDING-001")
    assert detail.status_code == 200
    assert detail.get_json()["required_variables"]
    assert client.get("/api/v1/statik/pipelines/UNKNOWN").status_code == 404

    path_variants = client.get("/api/v1/statik/calculation-path-variants?page_size=3").get_json()
    assert path_variants["statistics"]["variant_count"] >= 30000
    assert len(path_variants["items"]) == 3
    assert all(item["variant_id"].startswith("RWV-") for item in path_variants["items"])

    pipeline_variants = client.get("/api/v1/statik/pipeline-variants?page_size=3").get_json()
    assert pipeline_variants["statistics"]["variant_count"] >= 400
    assert len(pipeline_variants["items"]) == 3
    assert all(item["variant_id"].startswith("PIPEV-") for item in pipeline_variants["items"])

    scaffold_variants = client.get("/api/v1/statik/pipeline-variants?domain=scaffolding&page_size=100").get_json()
    assert scaffold_variants["pagination"]["total"] > 0
    assert all(item["domain"] == "scaffolding" for item in scaffold_variants["items"])
