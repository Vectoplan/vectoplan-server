from __future__ import annotations


def test_report_template_library_is_pure_html_and_has_dynamic_preview_pages(client):
    for path in ("/statik/ausgabevorlagen", "/statik/berichtsvorlagen"):
        response = client.get(path)
        markup = response.get_data(as_text=True)
        assert response.status_code == 200
        assert 'id="report-template-app"' in markup
        assert 'data-preview-format="html"' in markup
        assert 'data-variable-slot="project.name"' in markup
        assert 'data-pipeline-slot="system.figure"' in markup
        assert 'data-preview-page="outline"' in markup
        assert 'data-preview-page="chapter"' in markup
        assert 'data-preview-page="cover"' in markup
        assert 'data-preview-page="position"' in markup
        assert 'data-preview-page="structure"' in markup
        assert 'data-preview-page="visualizations"' in markup
        assert 'id="automaticVisualizations"' in markup
        assert 'id="scopeModuleList"' not in markup
        assert 'data-zoom-target' not in markup
        assert 'data-page-target' not in markup
        assert "Reine HTML-Vorschau" not in markup
        assert "Ausgabeumfang" not in markup
        assert "Dynamische Gliederung" in markup
        assert "Kapitelvorlage" in markup
        assert "<iframe" not in markup
        assert "<object" not in markup
        assert "<embed" not in markup
        assert ".pdf" not in markup.lower()


def test_report_template_catalog_covers_major_structural_project_families(client):
    response = client.get("/api/v1/statik/report-templates")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["schema_version"] == "structural-report-template-catalog/0.2"
    assert payload["template_contract"] == "structural-report-template/0.2"
    assert payload["statistics"] == {
        "template_count": 28,
        "discipline_count": 4,
        "pipeline_profile_count": 4,
        "calculation_module_count": 51,
        "section_template_count": 12,
        "linked_pipeline_count": 29,
        "test_case_count": 4,
    }
    assert {item["variant_id"] for item in payload["outline_variants"]} == {
        "regelfall",
        "vollstaendig",
        "prueffassung",
    }
    assert {item["discipline_id"] for item in payload["disciplines"]} == {
        "hochbau",
        "tiefbau",
        "ingenieurbau",
        "sonderbau",
    }
    template_ids = {item["template_id"] for item in payload["templates"]}
    assert {
        "hochbau-mehrfamilienhaus",
        "tiefbau-pfahlgruendung",
        "ingenieurbau-strassenbruecke",
        "ingenieurbau-brueckenlager",
        "ingenieurbau-tunnel-bergmaennisch",
        "sonderbau-maschinenfundament",
    } <= template_ids
    assert all(item["outline_title"] for item in payload["templates"])
    assert all(item["position_group_count"] >= 2 for item in payload["templates"])


def test_all_28_templates_resolve_to_project_specific_dynamic_outlines(client):
    catalog = client.get("/api/v1/statik/report-templates").get_json()
    signatures = set()
    for entry in catalog["templates"]:
        template_id = entry["template_id"]
        detail = client.get(f"/api/v1/statik/report-templates/{template_id}")
        outline = client.get(f"/api/v1/statik/report-templates/{template_id}/outline")
        assert detail.status_code == 200
        assert outline.status_code == 200
        detail_payload = detail.get_json()
        outline_payload = outline.get_json()
        assert detail_payload["contract_version"] == "structural-report-template/0.2"
        assert detail_payload["rendering"]["format"] == "html"
        assert detail_payload["rendering"]["pages"] == [
            "outline",
            "chapter",
            "position",
            "structure",
            "cover",
            "visualizations",
        ]
        assert detail_payload["pipeline_binding"]["pipeline_ids"]
        assert len(detail_payload["visualization_plan"]) == 4
        assert all(item["automatic"] for item in detail_payload["visualization_plan"])
        assert len(outline_payload["groups"]) >= 6
        assert len(outline_payload["chapters"]) >= 10
        assert len(outline_payload["available_modules"]) >= len(outline_payload["chapters"])
        assert outline_payload["statistics"]["block_template_count"] >= 50
        assert outline_payload["statistics"]["estimated_pages_high"] > outline_payload["statistics"]["estimated_pages_low"]
        assert all(chapter["section_template"]["blocks"] for chapter in outline_payload["chapters"])
        assert all(chapter["number"] for chapter in outline_payload["chapters"])
        signatures.add(tuple(chapter["module_id"] for chapter in outline_payload["chapters"]))
    assert len(signatures) >= 24


def test_outlines_follow_different_calculation_logics_for_building_bridge_and_tunnel(client):
    building = client.get(
        "/api/v1/statik/report-templates/hochbau-einfamilienhaus/outline"
    ).get_json()
    bridge = client.get(
        "/api/v1/statik/report-templates/ingenieurbau-strassenbruecke/outline"
    ).get_json()
    tunnel = client.get(
        "/api/v1/statik/report-templates/ingenieurbau-tunnel-bergmaennisch/outline"
    ).get_json()

    building_modules = {item["module_id"] for item in building["chapters"]}
    bridge_modules = {item["module_id"] for item in bridge["chapters"]}
    tunnel_modules = {item["module_id"] for item in tunnel["chapters"]}
    assert {"timber_members", "timber_connections", "masonry_members"} <= building_modules
    assert {"bridge_traffic_actions", "bridge_global_analysis", "bridge_bearings", "bridge_fatigue"} <= bridge_modules
    assert {"ground_model", "earth_water_actions", "construction_stages", "tunnel_interaction_analysis"} <= tunnel_modules
    assert building["profile"]["profile_id"] == "building"
    assert bridge["profile"]["profile_id"] == "bridge"
    assert tunnel["profile"]["profile_id"] == "tunnel"
    assert [group["title"] for group in bridge["groups"]] != [group["title"] for group in tunnel["groups"]]


def test_outline_variants_and_manual_scope_recompose_and_renumber(client):
    path = "/api/v1/statik/report-templates/hochbau-einfamilienhaus/outline"
    regular = client.get(path).get_json()
    complete = client.get(f"{path}?variant=vollstaendig").get_json()
    review = client.get(f"{path}?variant=prueffassung").get_json()
    assert complete["statistics"]["chapter_count"] > regular["statistics"]["chapter_count"]
    assert complete["statistics"]["estimated_pages_low"] > regular["statistics"]["estimated_pages_low"]
    assert review["review_mode"]["include_calculation_audit"] is True

    custom_response = client.post(path, json={
        "variant": "regelfall",
        "enabled_modules": ["plate_fe_analysis"],
        "disabled_modules": ["concrete_slabs", "document_control"],
    })
    assert custom_response.status_code == 200
    custom = custom_response.get_json()
    active = {chapter["module_id"] for chapter in custom["chapters"]}
    assert "plate_fe_analysis" in active
    assert "concrete_slabs" not in active
    assert "document_control" in active
    assert [chapter["number"] for chapter in custom["chapters"]] != [
        chapter["number"] for chapter in regular["chapters"]
    ]
    assert custom["scope"]["disabled_modules"] == ["concrete_slabs", "document_control"]


def test_section_templates_supply_reusable_html_blocks_and_bindings(client):
    response = client.get("/api/v1/statik/report-section-templates")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["schema_version"] == "structural-report-section-template-catalog/0.2"
    assert payload["statistics"]["section_template_count"] == 12
    ids = {item["section_template_id"] for item in payload["templates"]}
    assert {
        "source_narrative",
        "linear_member_calculation",
        "surface_fe_calculation",
        "geotechnical_calculation",
        "construction_stage",
        "connection_detail",
        "result_review",
    } <= ids
    assert all(block["binding"].startswith("/") for template in payload["templates"] for block in template["blocks"])
    assert any(
        "sketch" in block["kind"] or "figure" in block["kind"]
        for template in payload["templates"]
        for block in template["blocks"]
    )


def test_report_template_schema_outline_schema_and_error_contracts(client):
    schema = client.get("/api/v1/statik/report-templates/schema")
    outline_schema = client.get("/api/v1/statik/report-templates/outline-schema")
    assert schema.status_code == 200
    assert outline_schema.status_code == 200
    assert schema.get_json()["properties"]["rendering"]["properties"]["format"]["const"] == "html"
    assert schema.get_json()["properties"]["contract_version"]["const"] == "structural-report-template/0.2"
    assert outline_schema.get_json()["properties"]["contract_version"]["const"] == "structural-report-outline/0.2"

    missing = client.get("/api/v1/statik/report-templates/not-a-template")
    missing_outline = client.get("/api/v1/statik/report-templates/not-a-template/outline")
    invalid_variant = client.get(
        "/api/v1/statik/report-templates/hochbau-einfamilienhaus/outline?variant=unknown"
    )
    invalid_body = client.post(
        "/api/v1/statik/report-templates/hochbau-einfamilienhaus/outline",
        json={"facts": [], "enabled_modules": "plate_fe_analysis"},
    )
    assert missing.status_code == 404
    assert missing_outline.status_code == 404
    assert invalid_variant.status_code == 422
    assert invalid_body.status_code == 422
    assert missing.get_json()["error"] == "report_template_not_found"


def test_report_templates_are_bound_to_real_pipeline_ids_and_keep_release_gate_closed(client):
    highrise = client.get("/api/v1/statik/report-templates/hochbau-hochhaus").get_json()
    bridge = client.get("/api/v1/statik/report-templates/ingenieurbau-strassenbruecke").get_json()

    assert highrise["pipeline_binding"]["pipeline_ids"] == ["PIPE-STRUCT-HIGHRISE-001"]
    assert {
        "PIPE-STRUCT-BRIDGE-001",
        "PIPE-STRUCT-BRIDGE-ROAD-001",
        "PIPE-COMP-BRIDGE-ABUTMENT-001",
        "PIPE-COMP-BRIDGE-BEARING-001",
    } <= set(bridge["pipeline_binding"]["pipeline_ids"])
    assert highrise["pipeline_binding"]["release_gate"]["passed"] is False
    assert bridge["pipeline_binding"]["release_gate"]["passed"] is False
    assert all(item["pipeline_id"].startswith("PIPE-") for item in bridge["pipeline_binding"]["pipelines"])


def test_persistent_preview_cases_cover_residential_highrise_bridge_and_hall(client):
    catalog = client.get("/api/v1/statik/report-template-test-cases").get_json()
    assert catalog["statistics"]["case_count"] == 4
    assert {item["case_id"] for item in catalog["cases"]} == {
        "preview_residential_complex",
        "preview_highrise_core",
        "preview_road_bridge_complete",
        "preview_industrial_hall_crane",
    }

    for case in catalog["cases"]:
        response = client.get(f"/api/v1/statik/report-template-test-cases/{case['case_id']}")
        payload = response.get_json()
        assert response.status_code == 200
        assert payload["contract_version"] == "structural-calculation-template-preview/0.1"
        assert payload["rendering"] == {
            "format": "html",
            "continuous_pages": True,
            "manual_zoom": False,
            "page_count": 6,
        }
        actual_pipeline_ids = set(payload["pipeline_binding"]["pipeline_ids"])
        assert set(payload["case"]["expected_pipeline_ids"]) <= actual_pipeline_ids
        assert payload["visualizations"][0]["figure_kind"] == payload["case"]["expected_figure_kind"]
        assert all(item["renderer"] == "inline_svg" for item in payload["visualizations"])
        assert payload["outline"]["chapters"]

    missing = client.get("/api/v1/statik/report-template-test-cases/unknown")
    assert missing.status_code == 404
