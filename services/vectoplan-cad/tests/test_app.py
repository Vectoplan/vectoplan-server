from __future__ import annotations

from unittest.mock import patch

import pytest

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
    assert b"navigation-hint" not in response.data
    assert b"plan-summary" not in response.data
    assert b"building-panel" in response.data
    assert b"building-storeys" in response.data
    assert b'data-action="add-storey"' in response.data
    assert b'data-storey-kind="attic"' in response.data
    assert b"Geb\xc3\xa4udedaten werden als CAD-Entwurf" not in response.data
    assert b"2,77 m" in response.data
    assert b'data-edit-action="copy"' in response.data
    assert b'data-edit-action="rotate"' in response.data
    assert b'data-edit-action="cut"' in response.data
    assert b'data-edit-action="paste"' in response.data
    assert b'data-edit-action="distort"' in response.data
    assert b'data-edit-action="mirror"' in response.data
    assert b'data-edit-action="modify-point"' in response.data
    assert b'data-view-action="plan-overview"' in response.data
    assert b"cad-toolbar-stack" in response.data
    assert b"cad-toolbar-icon" in response.data
    assert b"cad-workflow-4" in response.data
    assert b"plan-workspace-panel" in response.data
    assert b'id="room-label-panel"' in response.data
    assert b'data-action="save-room-label"' in response.data
    assert b'id="plan-phase"' in response.data
    assert b'id="plan-content"' in response.data
    assert b'data-plan-action="auto-dimensions"' in response.data
    assert b'data-plan-action="auto-section"' in response.data
    assert b'value="civil"' in response.data
    assert b'value="engineering"' in response.data
    assert "Gelb · bearbeitbare Referenz".encode() in response.data
    assert "Weiß · ausgeblendet".encode() in response.data
    assert b'id="door-options"' in response.data
    assert b'data-door-hinge="left"' in response.data
    assert b'data-door-swing="negative"' in response.data
    assert b'value="bridge"' in response.data
    assert b"workspace-actions" in response.data
    assert b"toggle-navigator" not in response.data
    assert b"toggle-inspector" not in response.data
    assert b"touch-hint" not in response.data
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
    assert b'data-tool="dimension"' in response.data
    assert b'id="measurement-mode"' in response.data
    second_rail = response.data.split(b'class="cad-edit-rail"', 1)[1].split(b'</div>', 1)[0]
    assert second_rail.index(b'data-tool="dimension"') < second_rail.index(b'data-tool="roof"')
    assert b'id="cad-coordinate-bar"' in response.data
    assert b'id="opening-placement-options"' in response.data
    assert b'id="stair-options"' in response.data
    assert b'id="workspace-message"' not in response.data
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
    assert 'event.key === "Control"' in source
    assert "baseWidth * 0.0001" in source
    assert "data.message || nestedError || errorCode" in source
    assert "vectoplan-parcel-grid-state.v1" in source
    assert "parcel-grid-guide" in source
    assert "vectoplan-editor:parcel-selection-changed" in source
    assert "function renderDoorPrimitive" in source
    assert "function renderWindowPrimitive" in source
    assert "function renderStairPrimitive" in source
    assert "function renderPlanSummary" not in source
    assert 'coveragePolicy: "cell-center"' in source
    assert 'coveragePolicy: "cell-contained"' not in source
    assert "The Core projection is already masked" in source
    assert "function renderCrosshair" in source
    assert 'id: "workspace-grid-minor"' not in source
    assert "function loadBuildingDraft" in source
    assert "function storedBuildingDraft" in source
    assert "function semanticProjectionRequest" in source
    assert "semantic-floor-plan-v2-" in source
    assert "...(storeys.length ? {storeys} : {})" in source
    assert 'if (projectContext.coreProjectId) {' in source
    assert "function recalculateStoreyElevations" in source
    assert "ground: 2770" in source
    assert "upper: 2645" in source
    assert "basement: 2530" in source
    assert "attic: 1250" in source
    assert "function parseStoreyHeightMeters" in source
    assert 'textContent: "m"' in source
    assert "vectoplan-cad:building-structure" in source
    assert "function copySelectedPrimitive" in source
    assert "function pasteClipboard" in source
    assert "function primitiveEditTransform" in source
    assert "function applyDistort" in source
    assert 'commandName, transform' in source
    assert "direkt weiterzeichnen · ESC beendet" in source
    assert "drawCommandPending" not in source
    assert "function enqueueDrawCommand" in source
    assert "function dispatchCadCommandRequest" in source
    assert "event.shiftKey || Math.abs(event.deltaX)" not in source
    assert "function renderPointModifyHandles" in source
    assert "function updatePointModification" in source
    assert "pointGeometryOverrides: new Map()" in source
    assert "function togglePlanOverview" in source
    assert "function planOverviewCamera" in source
    assert "function objectSnapCandidate" in source
    assert "function wallPathBoundaryCorners" in source
    assert "capExtension" in source
    assert "boundaryPoint" in source
    assert "function wallPrimitiveBoundaryPolygons" in source
    assert "function finiteSegmentIntersection" in source
    assert "function wallObjectSnapAnchors" in source
    assert '"wall-edge-intersection"' in source
    assert "function primitiveObjectSnapAnchors" in source
    assert 'kind: "wall-edge-corner"' in source
    assert "function primitiveSnapPriority" in source
    assert "if (areaDrawing) return closest" in source
    assert "function gridSnapEnabled" in source
    assert "function alignmentTrackingCandidate" in source
    assert "function updatePointTrackingCandidate" in source
    assert "function renderPointTrackingGuides" in source
    assert "if (!gridSnapEnabled()) return [Math.round(point.x), Math.round(point.y)]" in source
    assert 'return Boolean(control?.checked)' in source
    assert "function wallEdgeGeometry" in source
    assert "function openRoomLabelEditor" in source
    assert "window.prompt" not in source
    assert "function wallHostCandidate" in source
    assert 'placement_mode = "wall_hosted"' in source
    assert "roomDraftPoints" in source
    assert "function handleCadEscape" in source
    assert "function areaCloseSnapPoint" in source
    assert "function completeRoomDrawing" in source
    assert "roofDraftClosed: false" in source
    assert "if (!state.roofDraftClosed)" in source
    assert 'panel.hidden = !closedDraft && !selectedRoof' in source
    assert "Dachfläche geschlossen · jetzt Dachform und Parameter einstellen" in source
    assert 'kind: "area-close"' in source
    assert 'state.snapTarget?.kind === "area-close"' in source
    assert 'window.addEventListener("keydown", handleCadEscape, true)' in source
    assert 'window.addEventListener("keyup", suppressCadEscapeKeyup, true)' in source
    assert "event.stopImmediatePropagation()" in source
    assert 'displayMode: ["red", "yellow", "gray", "white"]' in source
    assert "function updateSelectedDoorConfiguration" in source
    assert "function mergeOptimisticProjection" in source
    assert "function appendPlanAxes" in source
    assert "function renderPlanDetails" in source
    assert 'selectTool("room")' in source
    assert 'selectTool("select")' not in source.split("async function submitRoomCommand", 1)[1].split("function openRoomLabelEditor", 1)[0]
    assert 'payload.parameters.reference_line = "wall_outer_edge"' in source
    assert 'payload.parameters.reference_edge = "outside"' in source
    assert 'payload.parameters.wall_body_side = "inside-left"' in source
    assert "function confirmCoordinateInput" in source
    assert "function beginOpeningPlacement" in source
    assert "function finishStairConfiguration" in source
    assert "vectoplan-cad:worldedit-measurement" in source
    assert "function wallChainCloseSnapPoint" in source
    assert "function closedFacesFromWallSegments" in source
    assert "function completeAreaMeasurement" in source
    assert "function clearMeasurementResults" in source
    assert "function isCadEscapeEvent" in source
    assert 'payload.parameters.wall_join_mode = "automatic_miter"' in source
    assert "measurement-result-overlay" in source
    assert "function measurementLengthParts" in source
    assert "function completeLengthMeasurement" in source
    assert "function isTransientMeasurementPrimitive" in source
    assert "draftPointRadius" in source
    assert "function renderPlanWorkspace" in source
    assert "state.camera = null" not in source.split('String(data.type || data.kind || "") !== "vectoplan-app:parcel-selection-sync"', 1)[1].split("});", 1)[0]


def test_cad_styles_use_white_workspace_and_full_precision_crosshair():
    response = client().get("/static/cad/css/main.css")
    assert response.status_code == 200
    source = response.get_data(as_text=True)
    assert ".workspace-canvas" in source
    assert "background: #fff" in source
    assert "cursor: none" in source
    assert ".cad-crosshair-horizontal" in source
    assert ".cad-crosshair-vertical" in source
    assert ".cad-point-tracking" in source
    assert ".measurement-last-digit" in source
    assert ".draft-wall-preview" in source
    assert ".draft-wall-reference" in source
    assert ".draft-wall-hatch-line" in source
    assert ".wall-hatch-line" in source
    assert ".wall-hatch-background { fill: #fff; }" in source
    assert ".wall-material-concrete" in source
    assert ".wall-material-insulated" in source
    assert ".opening-cutout { fill: #fff; stroke: none; }" in source
    assert "stroke-dasharray" not in source.split(".door-swing {", 1)[1].split("}", 1)[0]
    assert "fill: url(#cad-wall-hatch)" in source
    assert ".storey-mode-white" in source
    assert ".cad-door-panel" in source
    assert ".cad-toolbar-stack" in source
    assert ".cad-toolbar-icon" in source
    assert ".point-modify-handle" in source
    assert ".cad-app.is-plan-overview" in source
    assert ".cad-crosshair-center.is-snapped" in source
    assert ".cad-object-snap" not in source
    assert ".primitive:hover .semantic-fill" not in source
    assert ".plan-sheet" in source


def test_cad_plan_symbols_create_white_wall_openings_and_material_sections():
    response = client().get("/static/cad/js/main.js")
    assert response.status_code == 200
    source = response.get_data(as_text=True)
    assert "function wallMaterialKind" in source
    assert 'return "concrete"' in source
    assert 'return "insulated"' in source
    assert 'return "drywall"' in source
    assert "function appendOpeningCutout" in source
    assert 'class: "opening-jamb"' in source
    assert 'class: "window-mullion"' in source
    assert "Math.max(8, Math.min(18" in source


def test_plan_overview_uses_vertical_reference_style_title_block():
    response = client().get("/static/cad/js/main.js")
    assert response.status_code == 200
    source = response.get_data(as_text=True)
    assert '["title_block", {x: 33800, y: 2450, width: 6400, height: 24500}]' in source
    assert 'class: "plan-title-brand-strip"' in source
    assert '"BAUVORHABEN"' in source
    assert '"PLANINHALT"' in source
    assert '"ÄNDERUNGEN"' in source
    assert '"PLANANGABEN"' in source
    assert '"PLANINHALT / MASSSTÄBE"' in source
    assert '"ÄNDERUNGSVERMERK"' in source


def test_plan_rules_cover_buildings_and_infrastructure():
    response = client().get("/api/v1/cad/plan-rules")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["contract_version"] == "cad-plan-rules/0.1"
    assert payload["content_order"][:4] == [
        "floor_plans", "site_plan", "elevations", "sections"
    ]
    assert payload["profiles"]["residential"]["label"] == "Wohngebäude"
    assert payload["profiles"]["bridge"]["aliases"]["floor_plans"] == "Draufsicht"
    assert payload["profiles"]["tunnel"]["aliases"]["cross_sections"] == "Tunnelquerschnitte"
    assert payload["profiles"]["civil"]["domain"] == "tiefbau"
    assert payload["profiles"]["engineering"]["domain"] == "ingenieurbau"
    assert "reinforcement_plan" in payload["profiles"]["engineering"]["required"]
    assert payload["phases"]["execution"]["dimensioning"] == "complete"


def test_command_preview_keeps_active_storey_for_scene_filtering():
    command = valid_command(
        parameters={
            "thickness_mm": 240,
            "storey_id": "upper_floor_1",
            "storey_name": "1. Obergeschoss",
            "storey_height_mm": 3100,
            "base_y": 4,
            "storey_base_y": 3,
        }
    )
    response = client().post("/api/v1/cad/commands", json=command)
    assert response.status_code == 202
    payload = response.get_json()
    assert payload["preview_element"]["storey_id"] == "upper_floor_1"


def test_parcel_grid_detail_is_only_visible_while_editing():
    response = client().get("/static/cad/css/main.css")
    assert response.status_code == 200
    source = response.get_data(as_text=True)
    assert ".parcel-grid-surface," in source
    assert "#plan-svg.is-parcel-grid-editing .parcel-grid-surface" in source
    assert ".parcel-grid-guide { pointer-events: stroke; }" in source


def test_parcel_geometry_uses_the_same_exact_earth_grid_as_3d():
    response = client().get("/static/cad/js/main.js")
    assert response.status_code == 200
    source = response.get_data(as_text=True)
    model_function = source.split("function lonLatToModelMm", 1)[1].split(
        "function lonLatToWorldModelMm", 1
    )[0]
    world_function = source.split("function lonLatToWorldModelMm", 1)[1].split(
        "function parcelModelPolygons", 1
    )[0]
    assert model_function.index("lonLatToExactWorldModelMm") < model_function.index(
        "lonLatToMetricWorldModelMm"
    )
    assert world_function.index("lonLatToExactWorldModelMm") < world_function.index(
        "lonLatToMetricWorldModelMm"
    )
    assert "modelPointToNorthUp(exact)" in model_function
    assert "function metricEarthGridDisplayFrame" in source
    assert "metresPerDegree.longitude * 1000 / gridMmPerDegreeLongitude" in source
    assert "metresPerDegree.latitude * 1000 / gridMmPerDegreeLatitude" in source
    assert "worldModelPointToMetricDisplay(point)" in source
    assert "metricDisplayPointToWorldModel([east, north])" in source


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
    room = next(item for item in payload["items"] if item["family_ref"] == "world-edit.room")
    assert room["plan_representation"]["symbol_kind"] == "room"
    assert room["plan_representation"]["room_stamp_show_area"] is True
    window = next(item for item in payload["items"] if item["family_ref"] == "vp.hochbau.oeffnungen.fenster.standardfenster")
    assert window["plan_representation"]["leaf_count"] == 0


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
    assert "plan_representation" in payload["command"]["library_context"]
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


def test_polygon_room_keeps_contour_centroid_and_area():
    response = client().post(
        "/api/v1/cad/commands",
        json=valid_command(
            command="create_room",
            family_ref="world-edit.room",
            variant_ref="default",
            geometry={
                "start_mm": [0, 0],
                "end_mm": [0, 4000],
                "points_mm": [[0, 0], [6000, 0], [6000, 2000], [3000, 4000], [0, 4000]],
            },
            parameters={"height_mm": 2770, "room_type": "wohnen", "label": "Wohnen"},
        ),
    )
    assert response.status_code == 202
    geometry = response.get_json()["preview_element"]["geometry"]
    assert geometry["points_mm"] == [[0, 0], [6000, 0], [6000, 2000], [3000, 4000], [0, 4000]]
    assert geometry["area_m2"] == 21.0
    assert len(geometry["label_point_mm"]) == 2


def test_roof_command_calculates_preview_and_dispatches_as_shared_model_change():
    points_mm = [[0, 0], [8000, 0], [8000, 3000], [4000, 3000], [4000, 7000], [0, 7000]]
    command = valid_command(
        command="create_roof",
        family_ref="world-edit.roof",
        variant_ref="hipped",
        geometry={"start_mm": points_mm[0], "end_mm": points_mm[-1], "points_mm": points_mm},
        parameters={
            "roof_request": {
                "contract_version": "cad-roof-calculation-request/0.1",
                "roof_type": "hipped",
                "footprint": {"outer_ring_mm": points_mm},
                "parameters": {
                    "pitch_deg": 35,
                    "eaves_height_mm": 3500,
                    "overhang_mm": 0,
                    "structure": {
                        "rafter": {"spacing_mm": 700},
                        "purlin": {"maximum_spacing_mm": 2500},
                    },
                },
            },
        },
        user_context={"core_project_id": "core-project-roof"},
    )
    with patch(
        "routes.cad.dispatch_cad_command",
        return_value={"ok": True, "accepted": True, "dispatch": "chunk-persisted"},
    ) as dispatch:
        response = client().post("/api/v1/cad/commands", json=command)

    assert response.status_code == 202
    payload = response.get_json()
    assert payload["accepted"] is True
    assert payload["preview_element"]["kind"] == "roof"
    assert payload["preview_element"]["geometry"]["points_mm"] == points_mm
    assert payload["command"]["parameters"]["roof_calculation"]["geometry_method"] == "polygon-clipped-v2"
    assert payload["mutation_intent"]["model_changing"] is True
    persisted = dispatch.call_args.args[2]
    assert persisted["parameters"]["roof_calculation"]["roof_type"] == "hipped"
    assert dispatch.call_args.args[1] == "core-project-roof"

    updated_points = [[-1000, 0], *points_mm[1:]]
    updated_request = {
        **command["parameters"]["roof_request"],
        "footprint": {"outer_ring_mm": updated_points},
    }
    update_command = valid_command(
        command="update_roof",
        family_ref="world-edit.roof",
        variant_ref="hipped",
        geometry={
            "start_mm": updated_points[0],
            "end_mm": updated_points[-1],
            "points_mm": updated_points,
        },
        parameters={
            "target_object_instance_id": "cad_roof_object_1",
            "target_anchor": {"x": 0, "y": 3, "z": 0},
            "roof_request": updated_request,
        },
        user_context={"core_project_id": "core-project-roof"},
    )
    with patch(
        "routes.cad.dispatch_cad_command",
        return_value={"ok": True, "accepted": True, "dispatch": "chunk-persisted"},
    ) as update_dispatch:
        update_response = client().post("/api/v1/cad/commands", json=update_command)

    assert update_response.status_code == 202
    update_payload = update_response.get_json()
    assert update_payload["accepted"] is True
    assert update_payload["preview_element"]["geometry"]["points_mm"] == updated_points
    assert update_dispatch.call_args.args[2]["parameters"]["target_object_instance_id"] == "cad_roof_object_1"


def test_opening_requires_wall_host_and_uses_wall_thickness():
    base = valid_command(
        command="create_opening",
        family_ref="vp.hochbau.oeffnungen.innentueren.innentuer",
        variant_ref="885_x_2010_mm",
        geometry={"start_mm": [1000, 2000], "end_mm": [2000, 2000]},
        parameters={"height_mm": 2010, "thickness_mm": 120},
    )
    rejected = client().post("/api/v1/cad/commands", json=base)
    assert rejected.status_code == 400
    assert any("host_wall_ref" in error for error in rejected.get_json()["errors"])

    hosted = {
        **base,
        "parameters": {
            **base["parameters"],
            "host_wall_ref": "wall_001",
            "host_wall_thickness_mm": 240,
            "placement_mode": "wall_hosted",
        },
    }
    response = client().post("/api/v1/cad/commands", json=hosted)
    assert response.status_code == 202
    preview = response.get_json()["preview_element"]
    assert preview["host_wall_ref"] == "wall_001"
    assert preview["geometry"]["thickness_mm"] == 240
    assert preview["semantic_role"] == "door"
    assert preview["door_hinge_side"] == "left"
    assert preview["door_swing_side"] == "positive"


@pytest.mark.parametrize(
    ("command", "family_ref", "variant_ref", "geometry", "parameters", "expected_kind"),
    [
        ("create_wall", "vp.hochbau.waende.mauerwerkswaende.mauerwerkswand", "240_mm", {"start_mm": [0, 0], "end_mm": [5000, 0]}, {"thickness_mm": 240}, "wall"),
        ("create_opening", "vp.hochbau.oeffnungen.innentueren.innentuer", "885_x_2010_mm", {"start_mm": [1000, 0], "end_mm": [1885, 0]}, {"height_mm": 2010, "thickness_mm": 240, "host_wall_ref": "wall_001", "host_wall_thickness_mm": 240, "placement_mode": "wall_hosted"}, "opening"),
        ("create_opening", "vp.hochbau.oeffnungen.fenster.standardfenster", "1000_x_1200_mm", {"start_mm": [2500, 0], "end_mm": [3500, 0]}, {"height_mm": 1200, "thickness_mm": 240, "host_wall_ref": "wall_001", "host_wall_thickness_mm": 240, "placement_mode": "wall_hosted"}, "opening"),
        ("create_room", "vp.hochbau.treppen_rampen.treppenlaeufe.treppenbereich", "1200_x_3000_mm", {"start_mm": [0, 0], "end_mm": [3000, 5000], "points_mm": [[0, 0], [3000, 0], [3000, 5000], [0, 5000]]}, {"height_mm": 3000, "room_type": "stair", "label": "Treppenbereich"}, "structure"),
        ("create_room", "world-edit.room", "default", {"start_mm": [0, 0], "end_mm": [4000, 3000], "points_mm": [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]}, {"height_mm": 2770, "room_type": "wohnen", "label": "Wohnen"}, "room"),
    ],
)
def test_primary_cad_placement_tools_return_renderable_preview(command, family_ref, variant_ref, geometry, parameters, expected_kind):
    response = client().post(
        "/api/v1/cad/commands",
        json=valid_command(
            command=command,
            family_ref=family_ref,
            variant_ref=variant_ref,
            geometry=geometry,
            parameters={**parameters, "storey_id": "ground_floor"},
            client_command_id=f"matrix_{command}",
        ),
    )
    assert response.status_code == 202
    preview = response.get_json()["preview_element"]
    assert preview["kind"] == expected_kind
    assert preview["geometry"]
    assert preview["view_refs"] == ["vp_ground_floor"]


@pytest.mark.parametrize(
    ("command", "parameters", "expected_kind"),
    [
        ("create_line", {}, "line"),
        ("create_dimension", {}, "dimension"),
        ("create_section_marker", {"label": "B–B"}, "line"),
    ],
)
def test_annotation_cad_tools_return_renderable_preview(command, parameters, expected_kind):
    payload = valid_command(command=command, parameters=parameters, client_command_id=f"matrix_{command}")
    payload.pop("family_ref")
    payload.pop("variant_ref")
    response = client().post("/api/v1/cad/commands", json=payload)
    assert response.status_code == 202
    preview = response.get_json()["preview_element"]
    assert preview["kind"] == expected_kind
    assert preview["geometry"]


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
