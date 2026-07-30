from __future__ import annotations

from app import create_app


def client():
    app = create_app("testing")
    return app.test_client()


def valid_command(**overrides):
    payload = {
        "contract_version": "cad-command/0.1",
        "command": "create_wall",
        "document_ref": "cad_demo_001",
        "sheet_ref": "sheet_01",
        "viewport_ref": "vp_ground_floor",
        "base_revision_ref": "core_revision_mock_0001",
        "client_command_id": "test_command_001",
        "geometry": {"start_mm": [1000, 2000], "end_mm": [6800, 2000]},
        "parameters": {"thickness_mm": 240},
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
    assert b"wall-thickness" in response.data
    assert b"navigation-hint" in response.data
    assert b"toggle-navigator" in response.data
    assert b"toggle-inspector" in response.data
    assert b"touch-hint" in response.data
    assert b"panel-backdrop" in response.data
    assert b"viewport-list" not in response.data
    assert b"statusbar" not in response.data
    assert b"brand-mark" not in response.data
    assert b"document-title" not in response.data
    assert b"Keine Auswahl" not in response.data


def test_bootstrap_describes_interactive_capabilities():
    response = client().get("/api/v1/cad/bootstrap")
    assert response.status_code == 200
    capabilities = response.get_json()["capabilities"]
    assert capabilities["scene_graph"] == "cad-scene/0.1"
    assert "create_wall" in capabilities["cad_tools"]
    assert capabilities["persistence"] is False


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
    after = client().get("/api/v1/cad/test-input").get_json()
    assert len(after["sheets"][0]["elements"]) == before_count


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
