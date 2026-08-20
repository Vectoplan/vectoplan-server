from __future__ import annotations

from unittest.mock import patch

from app import create_app
from src.library.client import load_cad_library_catalog


def client():
    app = create_app("testing")
    return app.test_client()


def valid_command(**overrides):
    payload = {
        "contract_version": "cad-command/0.2",
        "command": "create_wall",
        "document_ref": "cad_demo_001",
        "sheet_ref": "sheet_01",
        "viewport_ref": "vp_ground_floor",
        "base_revision_ref": "core_revision_mock_0001",
        "client_command_id": "test_command_001",
        "geometry": {"start_mm": [1000, 2000], "end_mm": [6800, 2000]},
        "parameters": {"thickness_mm": 240},
        "family_ref": "vp.hochbau.waende.mauerwerkswaende.mauerwerkswand",
        "variant_ref": "240_mm",
    }
    payload.update(overrides)
    return payload


def test_live_health():
    response = client().get("/health/live")
    assert response.status_code == 200
    assert response.get_json()["ok"] is True


def test_ready_health():
    response = client().get("/health/ready")
    assert response.status_code == 200
    assert response.get_json()["startup"]["stateful_storage"] is False


def test_cad_template():
    response = client().get("/cad")
    assert response.status_code == 200
    assert b"plan-svg" in response.data
    assert b"navigation-hint" in response.data
    assert b"workspace-actions" in response.data
    assert b"toggle-navigator" not in response.data
    assert b"toggle-inspector" not in response.data
    assert b"touch-hint" in response.data
    assert b"panel-backdrop" not in response.data
    assert b"right-panel" not in response.data
    assert b"left-panel" not in response.data
    assert b"workspace-toolbar" not in response.data
    assert b'data-tool="selection"' not in response.data
    assert b'data-tool="parcel-grid"' in response.data
    assert b'data-quick-tool="wall"' in response.data
    assert b'data-quick-tool="room"' in response.data
    assert b'data-quick-tool="window"' in response.data
    assert b'data-quick-tool="door"' in response.data
    assert b'data-quick-tool="stair"' in response.data
    assert b"Creative Library" in response.data
    assert b'data-action="create-room"' not in response.data
    assert b"data-export" not in response.data
    assert b"data-action=\"zoom-fit\"" not in response.data
    assert b"plan-profile" not in response.data
    assert b"viewport-list" not in response.data
    assert b"statusbar" not in response.data
    assert b"brand-mark" not in response.data
    assert b"document-title" not in response.data
    assert b"Keine Auswahl" not in response.data
    assert b"core-status-row" not in response.data
    assert b"project-status-row" not in response.data


def test_cad_frontend_loads_core_project_and_keeps_sample_explicit():
    response = client().get("/static/cad/js/main.js")
    assert response.status_code == 200
    source = response.get_data(as_text=True)
    assert 'query.get("core_project_id")' in source
    assert '/core/projects/${encodeURIComponent(projectContext.coreProjectId)}/projection' in source
    assert 'query.get("sample") === "1"' in source
    assert "await loadProjectInput()" in source
    assert "Kein Core-Projekt übergeben" in source
    assert "Systemgelände ist ausgeblendet" in source
    assert "Benutzerblöcke" in source
    assert "vectoplan-cad:model-command" in source
    assert "await loadLibraryCatalog()" in source
    assert "activateQuickTool" in source
    assert 'state.activeTool === "room"' in source
    assert "function drawingModelPoint" in source
    assert 'event.key === "Shift"' in source
    assert "baseWidth * 0.0001" in source
    assert "data.message || nestedError || errorCode" in source
    assert "vectoplan-parcel-grid-state.v1" in source
    assert "parcel-grid-guide" in source
    assert "vectoplan-editor:parcel-selection-changed" in source


def test_bootstrap_describes_interactive_capabilities():
    response = client().get("/api/v1/cad/bootstrap")
    assert response.status_code == 200
    capabilities = response.get_json()["capabilities"]
    assert capabilities["scene_graph"] == "cad-scene/0.1"
    assert "create_wall" in capabilities["cad_tools"]
    assert "create_room" in capabilities["cad_tools"]
    assert capabilities["library_only_placement"] is True
    assert capabilities["model_command_bridge"] == "vectoplan-model-command/0.1"
    assert isinstance(capabilities["persistence"], bool)


def test_creative_library_catalog_is_the_authoritative_placement_source():
    response = client().get("/api/v1/cad/library/catalog")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["authoritative"] is True
    assert payload["contract_version"] == "cad-library-catalog/0.1"
    families = {item["family_ref"] for item in payload["items"]}
    assert "vp.hochbau.waende.mauerwerkswaende.mauerwerkswand" in families
    assert "vp.hochbau.oeffnungen.fenster.standardfenster" in families
    assert "vp.hochbau.oeffnungen.innentueren.innentuer" in families
    assert "world-edit.room" in families
    assert "vp.hochbau.treppen_rampen.treppenlaeufe.treppenbereich" in families


def test_live_library_inventory_keeps_standard_cad_quick_tools_available():
    app = create_app("testing")
    app.config["LIBRARY_INTERNAL_URL"] = "http://vectoplan-library"
    live_payload = {
        "ok": True,
        "items": [{
            "family_id": "vp.hochbau.daecher.flachdach",
            "label": "Flachdach",
            "publication_status": "published",
        }],
    }
    with patch("src.library.client._request_inventory", return_value=live_payload):
        catalog = load_cad_library_catalog(app.config)

    families = {item["family_ref"] for item in catalog["items"]}
    assert catalog["source"] == "vectoplan-library+standard-vplib"
    assert "vp.hochbau.waende.mauerwerkswaende.mauerwerkswand" in families
    assert "vp.hochbau.oeffnungen.fenster.standardfenster" in families
    assert "vp.hochbau.oeffnungen.innentueren.innentuer" in families
    assert "world-edit.room" in families
    assert "vp.hochbau.treppen_rampen.treppenlaeufe.treppenbereich" in families


def test_test_input_contract():
    response = client().get("/api/v1/cad/test-input")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["contract_version"] == "cad-projection/0.1"
    assert payload["sheets"]
    assert "create_dimension" in payload["allowed_commands"]


def test_preview_returns_stateless_scene_graph():
    test_input = client().get("/api/v1/cad/test-input").get_json()
    response = client().post("/api/v1/cad/preview", json=test_input)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["stateful_storage"] is False
    assert payload["sheet_count"] == 1
    assert payload["scene"]["contract_version"] == "cad-scene/0.1"
    assert payload["scene"]["sheets"][0]["viewports"][0]["primitives"]


def test_invalid_projection_returns_actionable_errors():
    response = client().post("/api/v1/cad/preview", json={"sheets": []})
    assert response.status_code == 400
    payload = response.get_json()
    assert payload["error"] == "invalid_projection"
    assert any("contract_version" in error for error in payload["errors"])


def test_incomplete_command_is_rejected():
    response = client().post("/api/v1/cad/commands", json={"command": "create_wall"})
    assert response.status_code == 400
    payload = response.get_json()
    assert payload["error"] == "invalid_cad_command"
    assert payload["errors"]


def test_valid_command_returns_non_persistent_preview_element():
    before = client().get("/api/v1/cad/test-input").get_json()
    before_count = len(before["sheets"][0]["elements"])
    response = client().post("/api/v1/cad/commands", json=valid_command())
    assert response.status_code == 202
    payload = response.get_json()
    assert payload["accepted"] is False
    assert payload["processable"] is True
    assert payload["placeholder"] is False
    assert payload["stateful_storage"] is False
    assert payload["preview_element"]["kind"] == "wall"
    assert payload["preview_element"]["geometry"]["thickness_mm"] == 240
    assert payload["command"]["library_context"]["family_ref"] == valid_command()["family_ref"]
    assert payload["mutation_intent"]["model_changing"] is True
    assert "vectoplan-editor-3d" in payload["mutation_intent"]["target_surfaces"]
    after = client().get("/api/v1/cad/test-input").get_json()
    assert len(after["sheets"][0]["elements"]) == before_count


def test_valid_project_command_is_persisted_through_core():
    command = valid_command(user_context={"core_project_id": "core-project-1"})
    with patch(
        "routes.cad.dispatch_cad_command",
        return_value={"ok": True, "accepted": True, "dispatch": "chunk-persisted"},
    ) as dispatch:
        response = client().post("/api/v1/cad/commands", json=command)

    assert response.status_code == 202
    payload = response.get_json()
    assert payload["accepted"] is True
    assert payload["stateful_storage"] is True
    assert payload["dispatch"] == "chunk-persisted"
    assert dispatch.call_args.args[1] == "core-project-1"


def test_unlisted_family_is_rejected_for_model_changes():
    response = client().post(
        "/api/v1/cad/commands",
        json=valid_command(family_ref="freehand.not.in.library", variant_ref="custom"),
    )
    assert response.status_code == 400
    assert any("Creative Library catalog" in error for error in response.get_json()["errors"])


def test_room_command_creates_green_zone_preview_with_area():
    response = client().post(
        "/api/v1/cad/commands",
        json=valid_command(
            command="create_room",
            family_ref="world-edit.room",
            variant_ref="default",
            geometry={"start_mm": [1000, 2000], "end_mm": [6000, 6000]},
            parameters={"height_mm": 3000, "room_type": "wohnen", "label": "Wohnen"},
        ),
    )
    assert response.status_code == 202
    payload = response.get_json()
    assert payload["preview_element"]["kind"] == "room"
    assert payload["preview_element"]["semantic_role"] == "energy_zone"
    assert payload["preview_element"]["geometry"]["area_m2"] == 20.0
    assert payload["preview_element"]["text"] == "Wohnen\n20.00 m²"


def test_export_request_is_validated_but_not_dispatched():
    response = client().post(
        "/api/v1/cad/exports",
        json={
            "contract_version": "cad-export/0.1",
            "format": "pdf",
            "document_ref": "cad_demo_001",
            "sheet_ref": "sheet_01",
            "source_revision_ref": "core_revision_mock_0001",
        },
    )
    assert response.status_code == 202
    payload = response.get_json()
    assert payload["processable"] is True
    assert payload["accepted"] is False
    assert payload["dispatch"] == "export_worker_unavailable"


def test_core_projection_adapter_is_project_scoped():
    expected = {"ok": True, "snapshot": {"projection": {"contract_version": "cad-projection/0.1"}}}
    with patch("routes.cad.project_chunks_to_projection", return_value=expected) as adapter:
        response = client().post(
            "/api/v1/cad/core/projects/core-project-1/projection",
            json={"chunks": [{"chunkX": 0, "chunkY": 0, "chunkZ": 0}]},
        )
    assert response.status_code == 200
    assert response.get_json() == expected
    assert adapter.call_args.args[1] == "core-project-1"
