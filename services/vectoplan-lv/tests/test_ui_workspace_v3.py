from __future__ import annotations


def test_workspace_exposes_sections_and_dual_calculation_editor(client):
    response = client.get("/lv")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "+ Teilbereich" in html
    assert "Kalkulation / Rechenweg" in html
    assert "Dokumente zur Kalkulation" in html
    assert "calculation-grid-header" in html
    assert "workspace-v3.css" in html
    assert "workspace-v3-enhancements.js" in html
    assert "Ordnungszahl (automatisch)" in html
