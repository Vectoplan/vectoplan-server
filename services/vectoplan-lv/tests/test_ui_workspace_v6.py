from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]


def test_workspace_loads_focused_procurement_assets(client):
    response = client.get("/lv")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "workspace-v6.css" in html
    assert "workspace-v6-procurement.js" in html
    assert 'data-mode="procurement"' in html
    assert "Position(en) anfragen" in html
    assert "Anfragen &amp; Angebote" in html
    assert "Anfrage senden" in html
    assert "Analyse ausstehend" in html


def test_v6_separates_position_selection_history_and_integrations():
    script = (
        SERVICE_ROOT / "static" / "lv" / "js" / "workspace-v6-procurement.js"
    ).read_text(encoding="utf-8")
    styles = (
        SERVICE_ROOT / "static" / "lv" / "css" / "workspace-v6.css"
    ).read_text(encoding="utf-8")

    assert "inquirySelectedIds" in script
    assert "recipient-suggestions" in script
    assert "queue_for_delivery: true" in script
    assert "Antwort erfassen" in script
    assert "llm_assessment" in script
    assert "grid-template-columns" in styles
    assert ".inquiry-position-pane" in styles
    assert ".inquiry-history-pane" in styles


def test_context_reports_procurement_integrations_truthfully(client):
    capabilities = client.get("/v1/context").get_json()["capabilities"]

    assert capabilities["procurement_inquiries"] == "ready"
    assert capabilities["company_directory"] == "not_connected"
    assert capabilities["email_delivery"] == "not_connected"
    assert capabilities["offer_llm_assessment"] == "not_connected"
