from __future__ import annotations


def test_workspace_uses_two_work_areas_without_old_status_panels(client):
    response = client.get("/lv")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert 'data-project-public-id="1"' in html
    assert "LV &amp; Kalkulation" in html
    assert "Aufmaß &amp; Abrechnung" in html
    assert "Projektkontext" not in html
    assert "Implementierungsstand" not in html
    assert "Grundgerüst" not in html
    assert "+ Titel" in html
    assert "+ Position" in html
    assert "+ Text" in html
    assert "GAEB 3.3 importieren" in html
    assert "Aufmaße / Dateien vormerken" in html
    assert "Zelle anklicken" in html
    assert "Rechenweg / Aufmaß" in html
    assert 'id="context-menu"' in html
