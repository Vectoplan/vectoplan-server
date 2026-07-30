from __future__ import annotations

from pathlib import Path


def test_workspace_loads_v4_spreadsheet_assets(client):
    response = client.get("/lv")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "workspace-v4.css" in html
    assert "workspace-v4-enhancements.js" in html


def test_v4_keyboard_and_layout_contract_is_present():
    root = Path(__file__).resolve().parents[1]
    script = (
        root / "static" / "lv" / "js" / "workspace-v4-enhancements.js"
    ).read_text(encoding="utf-8")
    styles = (
        root / "static" / "lv" / "css" / "workspace-v4.css"
    ).read_text(encoding="utf-8")

    assert 'event.key !== "Tab"' in script
    assert 'state.calculationDraftRows.push({ expression: "", note: "" })' in script
    assert "hierarchy-depth-2" in script
    assert ".calculation-sheet .calculation-rows" in styles
    assert "overflow-y: auto" in styles
    assert ".calculation-actions" in styles
