from __future__ import annotations

from src.calculations.envelope import calculate_u_value
from src.calculations.systems import energy_class
from src.pipeline.orchestrator import PIPELINE_VERSION, run_energy_pipeline


def test_layer_based_u_value_is_reproducible():
    result = calculate_u_value(
        {
            "kind": "exterior_wall",
            "layers": [
                {"thickness_m": 0.20, "conductivity_w_mk": 0.04},
                {"thickness_m": 0.175, "conductivity_w_mk": 0.21},
            ],
        }
    )
    assert result["source"] == "calculated-from-layers"
    assert 0.16 < result["u_value_w_m2k"] < 0.18


def test_residential_energy_classes_follow_geg_annex_boundaries():
    assert energy_class(30) == "A+"
    assert energy_class(30.01) == "A"
    assert energy_class(160) == "E"
    assert energy_class(251) == "H"


def test_all_packaged_datasets_run_through_pipeline(client):
    listing = client.get("/api/v1/energie/datasets").get_json()["datasets"]
    assert len(listing) >= 4
    for item in listing:
        dataset = client.get(f"/api/v1/energie/datasets/{item['id']}").get_json()
        result = run_energy_pipeline(dataset, include_variants=False)
        assert result["pipeline_version"] == PIPELINE_VERSION
        assert result["summary"]["design_heat_load_kw"] >= 0
        assert result["summary"]["primary_energy_kwh_m2a"] >= 0
        assert len(result["stages"]) == 9


def test_renovation_case_has_improving_complete_variant(client):
    dataset = client.get("/api/v1/energie/datasets/residential-1960-renovation").get_json()
    result = run_energy_pipeline(dataset)
    complete = next(item for item in result["variants"] if item["id"] == "complete")
    assert complete["summary"]["primary_energy_kwh_m2a"] < result["summary"]["primary_energy_kwh_m2a"]
    assert len(result["renovation_roadmap"]["steps"]) == 3


def test_pipeline_and_document_routes_never_claim_official_output(client):
    dataset = client.get("/api/v1/energie/datasets/residential-new-build").get_json()
    pipeline = client.post("/api/v1/energie/pipeline/run", json={"project": dataset}).get_json()
    assert pipeline["normative"] is False
    assert pipeline["readiness"]["energy_certificate_allowed"] is False
    document = client.post(
        "/api/v1/energie/documents/energy-certificate-draft",
        json={"project": dataset},
    )
    assert document.status_code == 202
    assert document.get_json()["official_export_allowed"] is False


def test_model_source_contract_and_selection_normalization(client):
    sources = client.get("/api/v1/energie/model-sources?project_id=p-1").get_json()
    assert sources["contract"] == "vectoplan.energy-selection.v1"
    assert "/editor/test-generator" in sources["editor"]["url"]
    response = client.post(
        "/api/v1/energie/model-selections/normalize",
        json={
            "contract": "vectoplan.energy-selection.v1",
            "source": "vectoplan-editor",
            "projectId": "p-1",
            "selection": {
                "objects": [
                    {
                        "id": "wall-1",
                        "kind": "exterior_wall",
                        "name": "Außenwand",
                        "properties": {"area_m2": 42.5, "u_value": 0.18},
                    }
                ]
            },
        },
    )
    assert response.status_code == 200
    assert response.get_json()["selection"]["selection"]["count"] == 1


def test_versioned_rule_profile_exposes_locked_normative_modules(client):
    response = client.get("/api/v1/energie/rule-profiles/de-working-2026.1")
    profile = response.get_json()
    assert response.status_code == 200
    assert profile["normative"] is False
    assert profile["modules"]["official_energy_certificate"] == "locked"
