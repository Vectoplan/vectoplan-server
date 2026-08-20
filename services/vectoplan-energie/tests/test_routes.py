from __future__ import annotations


def test_ui_route_is_full_workspace_shell(client):
    response = client.get("/energie")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "VECTOPLAN" in html
    assert "energy-app" in html
    assert "Energetische Projektübersicht" in html
    assert "Projektziele" in html
    assert '<nav class="module-rail"' in html
    assert '<aside class="module-rail"' not in html
    assert "Arbeitsbereiche" in html

    css = client.get("/static/energie/css/main.css").get_data(as_text=True)
    assert "VECTOPLAN workspace integration" in css
    assert "flex-direction:row" in css
    assert "--brand:#155eef" in css


def test_root_redirects_to_energy_workspace(client):
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/energie")


def test_readiness_reports_complete_structure(client):
    response = client.get("/health/ready")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["ok"] is True
    assert payload["startup"]["integration_calls"] is False


def test_bootstrap_is_standalone_and_has_demo_project(client):
    response = client.get("/api/v1/energie/bootstrap")
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["integration_boundary"]["enabled"] is False
    assert payload["project"]["schema_version"] == "energy-project/0.1"
    assert payload["project"]["building"]["type"] == "residential"


def test_calculation_preview_rejects_incomplete_request(client):
    response = client.post("/api/v1/energie/calculate", json={"project_id": "x"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_calculation_request"


def test_change_set_remains_inert(client):
    response = client.post(
        "/api/v1/energie/change-sets",
        json={
            "project_id": "vp-demo-energie-001",
            "base_revision": "demo-rev-17",
            "changes": [{"path": "/envelope/wall/u_value", "operation": "set", "value": 0.18}],
        },
    )
    payload = response.get_json()
    assert response.status_code == 202
    assert payload["persisted"] is False
    assert payload["dispatched"] is False
    assert payload["change_set"]["status"] == "draft"


def test_report_endpoint_never_claims_normative_output(client):
    response = client.post(
        "/api/v1/energie/report-drafts",
        json={"project_id": "vp-demo-energie-001", "report_type": "concept_summary"},
    )
    payload = response.get_json()
    assert response.status_code == 202
    assert payload["generated"] is False
    assert payload["report"]["normative"] is False
