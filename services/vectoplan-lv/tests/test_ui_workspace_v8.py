from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]


def test_workspace_loads_portal_optimized_v8_styles(client):
    response = client.get("/lv")
    html = response.get_data(as_text=True)

    assert response.status_code == 200
    assert "workspace-v8.css" in html
    assert 'class="lv-picker" hidden aria-hidden="true"' in html
    assert 'id="new-lv"' in html
    assert "hidden\n            aria-hidden=\"true\"" in html
    assert 'class="search" hidden aria-hidden="true"' in html
    assert "Noch keine LV-Daten für dieses Projekt verfügbar." in html


def test_v8_centers_controls_offsets_only_oz_and_splits_panes_evenly():
    styles = (
        SERVICE_ROOT / "static" / "lv" / "css" / "workspace-v8.css"
    ).read_text(encoding="utf-8")

    assert "--portal-workspace-rail-clearance: 64px" in styles
    assert ".modes {" in styles
    assert "justify-content: center" in styles
    assert ".toolbar {" in styles
    assert "padding: 10px 16px 14px" in styles
    assert "grid-template-columns: repeat(2, minmax(0, 1fr))" in styles
    assert ".procurement-view {" in styles
    assert ".drag-column {" in styles
    assert "width: calc(42px + var(--portal-workspace-rail-clearance))" in styles
    assert "text-align: right" in styles
    assert ".search," in styles
    assert "#lv-app:not([data-workspace-mode=\"lv\"]) .toolbar" in styles


def test_v8_uses_four_accessible_icon_actions_with_hover_tooltips():
    template = (
        SERVICE_ROOT / "templates" / "lv" / "workspace_v2.html"
    ).read_text(encoding="utf-8")
    styles = (
        SERVICE_ROOT / "static" / "lv" / "css" / "workspace-v8.css"
    ).read_text(encoding="utf-8")

    assert template.count('class="lv-only toolbar-icon-action"') == 2
    assert 'class="lv-only inquiry-launch toolbar-icon-action"' in template
    assert 'class="toolbar-icon-action"' in template
    assert template.count('class="toolbar-action-tooltip" role="tooltip"') == 4
    assert 'aria-label="Hinzufügen"' in template
    assert 'aria-label="Position(en) anfragen"' in template
    assert 'aria-label="GAEB 3.3 importieren"' in template
    assert 'aria-label="GAEB X84 herunterladen"' in template
    assert ".toolbar-icon-action:hover > .toolbar-action-tooltip" in styles
    assert ".toolbar-icon-action:focus-visible > .toolbar-action-tooltip" in styles


def test_no_lv_copy_no_longer_points_to_removed_creation_control():
    script = (
        SERVICE_ROOT / "static" / "lv" / "js" / "workspace-v2.js"
    ).read_text(encoding="utf-8")

    assert "Noch keine LV-Daten für dieses Projekt verfügbar." in script
    assert "Sobald das Projekt-LV bereitsteht" in script
    assert "Lege ein LV an, um Titel und Positionen zu erfassen." not in script
