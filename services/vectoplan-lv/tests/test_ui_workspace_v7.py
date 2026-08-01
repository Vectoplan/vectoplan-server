from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]


def test_workspace_loads_simplified_v7_assets(client):
    response = client.get("/lv")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "workspace-v7.css" in html
    assert "workspace-v7-simplification.js" in html
    assert 'aria-label="Hinzufügen"' in html
    assert 'aria-label="Position(en) anfragen"' in html
    assert 'aria-label="GAEB X84 herunterladen"' in html


def test_v7_keeps_primary_actions_visible_and_secondary_actions_grouped():
    template = (
        SERVICE_ROOT / "templates" / "lv" / "workspace_v2.html"
    ).read_text(encoding="utf-8")
    styles = (
        SERVICE_ROOT / "static" / "lv" / "css" / "workspace-v7.css"
    ).read_text(encoding="utf-8")

    add_menu = template.index('aria-label="Hinzufügen"')
    add_title = template.index('id="add-title"')
    inquiry_action = template.index('id="open-inquiry-workspace"')
    gaeb_import = template.index('id="gaeb-import"')
    gaeb_export = template.index('id="gaeb-export"')

    assert add_menu < add_title < inquiry_action < gaeb_import < gaeb_export
    assert ".brand," in styles
    assert ".panel-heading" in styles
    assert "flex-wrap: nowrap" in styles


def test_v6_handles_unavailable_inquiry_route_without_global_error():
    script = (
        SERVICE_ROOT / "static" / "lv" / "js" / "workspace-v6-procurement.js"
    ).read_text(encoding="utf-8")

    assert "response.status === 404" in script
    assert "Anfragefunktion wird vorbereitet" in script
    assert "renderLvSelection();" in script
