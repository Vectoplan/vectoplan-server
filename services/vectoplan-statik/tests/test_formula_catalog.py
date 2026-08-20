from __future__ import annotations

from src.knowledge import EurocodeRegistry, FormulaRegistry


def test_formula_catalog_has_stable_taxonomy_and_visible_unknowns():
    catalog = FormulaRegistry().catalog()
    assert catalog["catalog_version"] == "structural-formula-catalog/0.3"
    assert len(catalog["categories"]) == 12
    assert len(catalog["formulas"]) >= 85
    assert sum(catalog["statistics"]["by_status"].values()) == len(catalog["formulas"])
    identifiers = [item["formula_id"] for item in catalog["formulas"]]
    assert len(identifiers) == len(set(identifiers))
    assert all(item["category_id"] and item["processing"]["steps"] for item in catalog["formulas"])
    plate_opening = FormulaRegistry().get("PLATE-002")
    assert plate_opening["status"] == "implemented_bounded"
    assert plate_opening["processing"]["example"]["result"]["value"] == 54
    nonlinear_3d = FormulaRegistry().get("STABILITY-002")
    assert nonlinear_3d["status"] == "incomplete"


def test_historical_din_sources_are_not_presented_as_current_rules():
    catalog = FormulaRegistry().catalog()
    historical = [item for item in catalog["sources"] if item.get("kind", "").startswith("historical_standard")]
    assert len(historical) == 5
    assert all(item["normative_authority"] is False for item in historical)
    assert all(item["standard_state"] in {"zurückgezogen", "zurückgezogen; Berichtigung 1:2006-03 beachten", "historische Berichtigung"} for item in historical)
    wind = FormulaRegistry().get("WIND-HIST-002")
    assert wind["source"]["current_replacement"].startswith("DIN EN 1991-1-4")
    assert wind["standard_refs"] == ["EN1991-1-4"]


def test_implemented_formula_exposes_non_code_processing_example():
    record = FormulaRegistry().get("BEAM-002")
    assert record["status"] == "implemented"
    assert record["processing"]["example"]["inputs"]
    assert record["processing"]["example"]["result"]["value"] == 45
    assert len(record["processing"]["steps"]) == 5


def test_formula_catalog_page_and_detail_api_are_available(client):
    page = client.get("/statik/formelkatalog")
    assert page.status_code == 302
    assert "/statik/katalog?bereich=eurocodes" in page.headers["Location"]
    page = client.get("/statik/formelkatalog?embedded=1")
    markup = page.get_data(as_text=True)
    assert "Eurocode-Formelkatalog" in markup
    assert 'id="ruleList"' in markup

    detail = client.get("/api/v1/statik/implementation-methods/SAFETY-003")
    assert detail.status_code == 200
    payload = detail.get_json()
    assert payload["source"]["pdf_page"] == 23
    assert payload["processing"]["example"]["result"]["assessment"] == "erfüllt"
    assert client.get("/api/v1/statik/implementation-methods/DOES-NOT-EXIST").status_code == 404

    methods_page = client.get("/statik/methoden?embedded=1")
    methods_markup = methods_page.get_data(as_text=True)
    assert 'id="formulaList"' in methods_markup
    assert 'id="sourceExcerpt"' in methods_markup
    assert 'id="processingSteps"' in methods_markup

    formulas = client.get("/api/v1/statik/formulas?page_size=1").get_json()
    assert formulas["catalog_role"] == "primary_normative_formula_catalog"
    assert formulas["formula_count"] == 12089
    assert formulas["formula_identity"] == "formula_id == rule_id"
    formula_id = formulas["formulas"][0]["formula_id"]
    formula = client.get(f"/api/v1/statik/formulas/{formula_id}").get_json()
    assert formula["normative_rule"] is True
    assert formula["verification_gate"]["passed"] is False

    variables = client.get("/api/v1/statik/formula-variables").get_json()
    assert variables["formula_count"] == 12089
    assert variables["verified_formula_count"] == 0
    assert variables["variable_count"] == 0
    assert variables["status"] == "curation_required"


def test_all_catalog_excerpt_assets_are_reachable(client):
    excerpt_urls = {
        item["source"]["excerpt_url"]
        for item in FormulaRegistry().records()
        if item["source"]["excerpt_url"] != "unvollständig"
    }
    assert len(excerpt_urls) >= 20
    for url in excerpt_urls:
        response = client.get(url)
        assert response.status_code == 200, url
        assert response.mimetype == "image/jpeg"


def test_eurocode_source_register_covers_all_ec1_to_ec9_documents():
    catalog = EurocodeRegistry().catalog()
    assert catalog["schema_version"] == "eurocode-rule-catalog/0.1"
    assert len(catalog["families"]) == 9
    assert catalog["statistics"]["documents"] == 118
    assert catalog["statistics"]["pages"] == 6302
    assert catalog["statistics"]["text_pages"] == 6270
    assert catalog["statistics"]["weak_or_scanned_pages"] == 32
    assert catalog["statistics"]["rules"] == 12089
    assert sum(item["equation_candidates"] for item in catalog["families"]) == 12089
    assert catalog["statistics"]["by_document_kind"] == {
        "base_standard": 57,
        "national_annex": 55,
        "corrigendum": 2,
        "amendment": 4,
    }


def test_eurocode_rules_are_paginated_and_never_claim_unverified_implementation():
    registry = EurocodeRegistry()
    page = registry.query_rules(family="EC2", confidence="high", page=1, page_size=25)
    assert len(page["items"]) == 25
    assert page["pagination"]["total"] > 100
    assert page["pagination"]["has_next"] is True
    assert all(item["eurocode_family"] == "EC2" for item in page["items"])
    assert all(item["catalog_status"] == "incomplete" for item in page["items"])
    assert all(item["implementation_status"] == "unvollständig" for item in page["items"])
    assert all(item["source"]["pdf_page"] >= 1 for item in page["items"])


def test_eurocode_catalog_page_search_and_detail_api(client):
    page = client.get("/statik/formelkatalog/eurocodes")
    assert page.status_code == 302
    assert "/statik/katalog?bereich=eurocodes" in page.headers["Location"]
    page = client.get("/statik/formelkatalog/eurocodes?embedded=1")
    markup = page.get_data(as_text=True)
    assert "Eurocode-Formelkatalog EC1" in markup
    assert 'id="familyNavigation"' in markup
    assert 'id="ruleList"' in markup

    rules = client.get("/api/v1/statik/eurocodes/rules?family=EC3&q=Knicken&page_size=10")
    payload = rules.get_json()
    assert rules.status_code == 200
    assert payload["pagination"]["total"] > 0
    rule_id = payload["items"][0]["rule_id"]
    detail = client.get(f"/api/v1/statik/eurocodes/rules/{rule_id}")
    assert detail.status_code == 200
    assert detail.get_json()["source"]["file_name"].endswith(".pdf")
    assert client.get("/api/v1/statik/eurocodes/rules/UNKNOWN").status_code == 404


def test_eurocode_calculation_path_candidates_remain_blocked_until_manual_curation(client):
    response = client.get("/api/v1/statik/eurocodes/calculation-path-candidates?page_size=5")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["statistics"]["candidate_path_count"] >= 2000
    assert len(payload["items"]) == 5
    assert all(item["status"] == "candidate_unverified" for item in payload["items"])
    assert all(item["verification_gate"]["passed"] is False for item in payload["items"])
