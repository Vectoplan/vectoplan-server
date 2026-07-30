from __future__ import annotations

from pathlib import Path


def test_workspace_loads_v5_fixed_viewport_assets(client):
    response = client.get("/lv")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "workspace-v5.css" in html
    assert "workspace-v5-enhancements.js" in html


def test_v5_layout_and_interaction_contract():
    root = Path(__file__).resolve().parents[1]
    script = (
        root / "static" / "lv" / "js" / "workspace-v5-enhancements.js"
    ).read_text(encoding="utf-8")
    styles = (
        root / "static" / "lv" / "css" / "workspace-v5.css"
    ).read_text(encoding="utf-8")

    assert 'data-workspace-mode="lv"' in styles
    assert "overflow: hidden" in styles
    assert "minmax(560px, 44%)" in styles
    assert "Kommentar zur Rechenzeile" in script
    assert "titleBlockOrderV5" in script
    assert 'replaceAll("_TITEL", "")' in script
