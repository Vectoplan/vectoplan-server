from __future__ import annotations


def valid_analysis_payload():
    return {
        "contract_version": "structural-analysis-request/0.1",
        "project_ref": "project_test",
        "element_ref": "slab_test",
        "model_revision_ref": "revision_test_1",
        "assumptions": {
            "span_m": 5.2,
            "width_m": 4.2,
            "thickness_cm": 20,
            "support_condition": "continuous",
            "superimposed_dead_load_kn_m2": 1.5,
            "variable_load_kn_m2": 2.0,
            "concrete_class": "C25/30",
            "reinforcement_class": "B500B",
            "cover_mm": 30,
            "provided_reinforcement_mm2_m": 754,
        },
    }


def test_root_redirects_to_workspace(client):
    response = client.get("/")
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/statik")


def test_health_and_readiness_are_local(client):
    live = client.get("/health/live")
    ready = client.get("/health/ready")
    assert live.status_code == 200
    assert live.get_json()["service"] == "vectoplan-statik"
    assert ready.status_code == 200
    assert ready.get_json()["startup"]["stateful_storage"] is False
    assert ready.get_json()["startup"]["integration_calls"] is False


def test_workspace_is_full_screen_and_uses_the_compact_layout(client):
    response = client.get("/statik")
    html = response.get_data(as_text=True)
    assert response.status_code == 200
    assert 'id="statik-app"' in html
    assert 'data-experience="guided"' in html
    assert 'id="structural-canvas"' in html
    assert 'class="stage-tool-row"' in html
    assert 'class="inspector-result"' in html
    assert 'id="calculation-dossier"' in html
    assert 'data-dossier-tab="checks"' in html
    assert 'data-workflow="model"' in html
    assert 'data-view="loads"' in html
    assert 'data-action="zoom-fit"' in html
    assert 'class="mobile-panel-button explorer-button"' in html
    assert 'class="workspace-badge">Tragwerk' in html
    assert 'class="app-header"' not in html
    assert 'class="ribbon"' not in html
    assert 'class="project-summary"' not in html
    assert 'id="element-search"' not in html
    assert 'class="result-tray"' not in html
    assert 'class="statusbar"' not in html
    assert "prüffähiger statischer Nachweis" in html

    css = client.get("/static/statik/css/main.css").get_data(as_text=True)
    assert "width: 100vw" in css
    assert "height: 100dvh" in css
    assert "VECTOPLAN workspace integration" in css
    assert "grid-template-columns: minmax(460px, 1fr) 352px" in css
    assert "transform: translateX(-105%)" in css


def test_status_and_bootstrap_keep_every_integration_disabled(client):
    status = client.get("/api/v1/statik/status").get_json()
    bootstrap = client.get("/api/v1/statik/bootstrap").get_json()
    assert status["mode"] == "standalone_engineering_kernel"
    assert status["integrations_enabled"] is False
    assert bootstrap["capabilities"]["persistence"] is False
    assert bootstrap["capabilities"]["certified_solver"] is False
    assert "bridge" in bootstrap["capabilities"]["supported_systems"]
    assert all(target["enabled"] is False for target in bootstrap["integrations"].values())
    assert all(target["connection"] == "not_connected" for target in bootstrap["integrations"].values())


def test_sample_model_covers_the_prepared_component_families(client):
    response = client.get("/api/v1/statik/sample-model")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["contract_version"] == "structural-model/0.1"
    assert {element["kind"] for element in payload["elements"]} == {
        "slab",
        "beam",
        "column",
        "wall",
        "foundation",
    }
    assert payload["automation"]["feedback_to_source_model"] == "not_connected"


def test_analysis_preview_is_transparent_and_not_certified(client):
    response = client.post("/api/v1/statik/analysis-preview", json=valid_analysis_payload())
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["ok"] is True
    assert payload["contract_version"] == "structural-analysis-result/0.1"
    assert payload["stateful_storage"] is False
    assert payload["verification"]["certified"] is False
    assert payload["summary"]["governing_utilization"] > 0
    assert {check["id"] for check in payload["checks"]} == {
        "uls_bending",
        "uls_shear",
        "sls_slenderness",
    }
    assert len(payload["calculation_steps"]) == 4
    assert "vectoplan-library" in payload["provenance"]["future_sources"]


def test_invalid_analysis_returns_actionable_errors(client):
    payload = valid_analysis_payload()
    payload["assumptions"]["thickness_cm"] = 0
    payload["assumptions"]["support_condition"] = "unknown"
    response = client.post("/api/v1/statik/analysis-preview", json=payload)
    assert response.status_code == 400
    errors = response.get_json()["errors"]
    assert any("thickness_cm" in error for error in errors)
    assert any("support_condition" in error for error in errors)


def test_command_is_validated_but_never_persisted(client):
    response = client.post(
        "/api/v1/statik/commands",
        json={
            "contract_version": "structural-command/0.1",
            "command": "update_element_parameters",
            "project_ref": "project_test",
            "element_ref": "slab_test",
            "base_revision_ref": "revision_test_1",
            "client_command_id": "command_test_1",
            "parameters": {"thickness_cm": 22},
        },
    )
    payload = response.get_json()
    assert response.status_code == 202
    assert payload["processable"] is True
    assert payload["accepted"] is False
    assert payload["persisted"] is False
    assert payload["dispatch"] == "core_adapter_not_connected"


def test_report_is_validated_but_not_generated(client):
    response = client.post(
        "/api/v1/statik/reports",
        json={
            "contract_version": "structural-report-request/0.1",
            "project_ref": "project_test",
            "source_revision_ref": "revision_test_1",
            "format": "pdf",
            "sections": ["model", "assumptions", "loads", "checks", "results"],
        },
    )
    payload = response.get_json()
    assert response.status_code == 202
    assert payload["accepted"] is False
    assert payload["persisted"] is False
    assert payload["dispatch"] == "document_worker_not_connected"


def test_frontend_only_calls_its_own_api_boundary(client):
    source = client.get("/static/statik/js/main.js").get_data(as_text=True)
    assert 'requestJson("/bootstrap")' in source
    assert 'requestJson("/project-cases")' in source
    assert "/workspace" in source
    assert "projectOverridePayload" in source
    assert 'requestJson("/sample-model")' in source
    assert 'requestJson("/analysis-preview"' in source
    assert 'requestJson("/analysis-jobs/dossier"' in source
    assert "vectoplan-core:" not in source
    assert "vectoplan-library:" not in source


def test_main_workspace_exposes_project_picker_editor_pipeline_and_output(client):
    markup = client.get("/statik").get_data(as_text=True)
    assert 'id="project-case-select"' in markup
    assert 'id="project-variable-editor"' in markup
    assert 'data-dossier-tab="project"' in markup
    assert 'data-dossier-tab="pipelines"' in markup
    assert 'data-dossier-tab="output"' in markup
    assert 'id="project-output-dialog"' in markup
    assert 'data-output-view="report"' in markup
    assert 'data-output-view="template"' in markup


def test_project_case_api_and_program_report_are_available(client):
    catalog = client.get("/api/v1/statik/project-cases")
    assert catalog.status_code == 200
    assert catalog.get_json()["cases"][0]["case_id"] == "complex_residential_building"
    run = client.get("/api/v1/statik/project-cases/complex_residential_building/run")
    assert run.status_code == 200
    assert run.get_json()["summary"]["position_count"] == 9
    report = client.get("/api/v1/statik/project-cases/complex_residential_building/report.html")
    markup = report.get_data(as_text=True)
    assert report.status_code == 200
    assert "Positions- und Prüfverzeichnis" in markup
    assert "project-system-canvas" in markup
    assert markup.count("project-result-canvas") == 9
    assert "Literatur → Rechenmethode → Test" in markup


def test_project_workspaces_cover_residential_highrise_bridge_and_hall(client):
    catalog = client.get("/api/v1/statik/project-cases").get_json()
    assert {item["case_id"] for item in catalog["cases"]} == {
        "complex_residential_building",
        "highrise_core_building",
        "road_bridge_complete",
        "industrial_hall_crane",
    }
    expected_templates = {
        "complex_residential_building": "hochbau-mehrfamilienhaus",
        "highrise_core_building": "hochbau-hochhaus",
        "road_bridge_complete": "ingenieurbau-strassenbruecke",
        "industrial_hall_crane": "hochbau-industrie-logistikhalle",
    }
    for case_id, template_id in expected_templates.items():
        response = client.get(f"/api/v1/statik/project-cases/{case_id}/workspace")
        payload = response.get_json()
        assert response.status_code == 200
        assert payload["contract_version"] == "structural-project-workspace/0.1"
        assert payload["calculation_template"]["template_id"] == template_id
        assert len(payload["model"]["elements"]) == payload["result"]["summary"]["position_count"]
        assert payload["result"]["editable_variables"]
        assert payload["knowledge"]["pipelines"]
        assert payload["safety"] == {
            "calculation_preview": True,
            "certified": False,
            "independent_review_required": True,
            "release_gate_passed": False,
            "message": "Rechenergebnisse, Pipelines und Dokumente sind Arbeitsstände; die fachliche Freigabe bleibt gesperrt.",
        }


def test_workspace_preview_and_reports_use_numeric_overrides(client):
    preview = client.post(
        "/api/v1/statik/project-cases/highrise_core_building/workspace",
        json={"overrides": [{"path": "/positions/2/job/analysis_model/thickness_m", "value": 0.31}]},
    )
    payload = preview.get_json()
    assert preview.status_code == 200
    variable = next(
        item for item in payload["result"]["editable_variables"]
        if item["path"] == "/positions/2/job/analysis_model/thickness_m"
    )
    assert variable["value"] == 0.31
    html = client.post(
        "/api/v1/statik/project-cases/industrial_hall_crane/report",
        json={"format": "html", "overrides": [{"path": "/positions/0/job/load_cases/1/value", "value": 14.0}]},
    )
    assert html.status_code == 200
    assert html.mimetype == "text/html"
    assert "Produktionshalle Nord" in html.get_data(as_text=True)
    pdf = client.post(
        "/api/v1/statik/project-cases/road_bridge_complete/report",
        json={"format": "pdf", "overrides": []},
    )
    assert pdf.status_code == 200
    assert pdf.mimetype == "application/pdf"
    assert pdf.data.startswith(b"%PDF")


def test_literature_traceability_api_exposes_complete_book_structure(client):
    response = client.get("/api/v1/statik/literature")
    payload = response.get_json()
    assert response.status_code == 200
    assert len(payload["topics"]) == 12
    assert payload["sources"][0]["normative_authority"] is False


def test_formula_catalog_and_editable_project_preview_are_available(client):
    formulas = client.get("/api/v1/statik/formulas")
    assert formulas.status_code == 200
    assert len(formulas.get_json()["formulas"]) >= 35
    preview = client.post(
        "/api/v1/statik/project-cases/complex_residential_building/preview",
        json={"overrides": [{"path": "/environmental_actions/0/ground_snow_load_kn_m2", "value": 1.0}]},
    )
    assert preview.status_code == 200
    payload = preview.get_json()
    assert payload["environmental_actions"][0]["roof_snow_load_kn_m2"] == 0.8
    assert payload["editable_variables"]
    invalid = client.post(
        "/api/v1/statik/project-cases/complex_residential_building/preview",
        json={"overrides": [{"path": "/project_ref", "value": 1}]},
    )
    assert invalid.status_code == 422


def test_project_report_contains_live_inputs_climate_and_visible_calculations(client):
    report = client.get("/api/v1/statik/project-cases/complex_residential_building/report.html")
    markup = report.get_data(as_text=True)
    assert report.status_code == 200
    assert "Wind- und Schneelasten" in markup
    assert "data-edit-input" in markup
    assert "Änderungen neu berechnen" in markup
    assert "calculation-step" in markup
    assert "Rechenmethoden &amp; Implementierungen" in markup
    assert "<details" not in markup
