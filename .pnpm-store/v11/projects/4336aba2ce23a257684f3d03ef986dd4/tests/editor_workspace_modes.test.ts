import assert from "node:assert/strict";
import test from "node:test";

import {
  editorWorkspaceModeDescriptor,
  editorWorkspaceToolDescriptor,
  planningWorkspaceTools,
  preferredWorkspaceModeForTool,
  workspacePointerNdc,
  workspaceModeAllowsGenericBlockEditing,
  workspaceModeSupportsTool,
  worldEditToolShowsParcelGuides,
} from "../src/frontend/modes/editor_workspace_mode";
import {
  PLANNING_CAMERA_MAX_DISTANCE,
  clampPlanningPolar,
  planningCameraTargetingDistance,
  planningKeyboardMovement,
  planningKeyboardPanOffset,
  planningOrbitPosition,
  planningPointerInteraction,
  planningScreenPlanePanOffset,
  planningZoomDistance,
} from "../src/frontend/camera/planning_camera_controller";

test("Ego and planning modes expose every WorldEdit tool on one shared runtime", () => {
  assert.equal(editorWorkspaceModeDescriptor("first-person").camera, "first-person");
  assert.equal(editorWorkspaceModeDescriptor("planning").camera, "orbit");
  assert.equal(workspaceModeSupportsTool("first-person", "paint"), true);
  assert.equal(workspaceModeSupportsTool("planning", "paint"), true);
  assert.equal(workspaceModeSupportsTool("planning", "parcel-grid"), true);
  assert.equal(workspaceModeSupportsTool("first-person", "parcel-grid"), true);
  assert.equal(workspaceModeSupportsTool("first-person", "selection"), true);
  assert.equal(workspaceModeSupportsTool("planning", "selection"), true);
  assert.equal(workspaceModeSupportsTool("first-person", "tentacle"), true);
  assert.equal(workspaceModeSupportsTool("planning", "tentacle"), true);
  assert.equal(workspaceModeSupportsTool("first-person", "roof"), true);
  assert.equal(workspaceModeSupportsTool("planning", "roof"), true);
  assert.equal(workspaceModeSupportsTool("planning", "room"), true);
  assert.equal(workspaceModeSupportsTool("first-person", "storey"), true);
  assert.equal(workspaceModeSupportsTool("planning", "storey"), true);
});

test("no WorldEdit inventory selection changes the current workspace view", () => {
  const tools = editorWorkspaceModeDescriptor("first-person").tools;
  for (const tool of tools) {
    assert.equal(preferredWorkspaceModeForTool(tool, "first-person"), "first-person", `${tool} changed Ego`);
    assert.equal(preferredWorkspaceModeForTool(tool, "planning"), "planning", `${tool} changed planning`);
  }
  assert.equal(preferredWorkspaceModeForTool("parcel", "first-person"), "first-person");
  assert.equal(preferredWorkspaceModeForTool("parcel-grid", "first-person"), "first-person");
});

test("parcel guides belong exclusively to parcel and parcel-grid tools", () => {
  assert.equal(worldEditToolShowsParcelGuides(null), false);
  assert.equal(worldEditToolShowsParcelGuides("parcel"), true);
  assert.equal(worldEditToolShowsParcelGuides("parcel-grid"), true);
  assert.equal(worldEditToolShowsParcelGuides("roof"), false);
  assert.equal(worldEditToolShowsParcelGuides("tentacle"), false);
});

test("planning picking follows the free cursor while Ego keeps the crosshair", () => {
  assert.deepEqual(workspacePointerNdc("first-person", 0.75, -0.5), { x: 0, y: 0 });
  assert.deepEqual(workspacePointerNdc("planning", 0.75, -0.5), { x: 0.75, y: -0.5 });
  assert.deepEqual(workspacePointerNdc("planning", 4, -4), { x: 1, y: -1 });
  assert.deepEqual(workspacePointerNdc("planning", "invalid", undefined), { x: 0, y: 0 });
});

test("planning dock exposes Linien Brush and shared Tentacle Straße without losing Ego Tentacle", () => {
  const planningTools = planningWorkspaceTools().map((entry) => entry.tool);
  assert.ok(planningTools.includes("parcel"));
  assert.ok(planningTools.includes("roof"));
  assert.ok(planningTools.includes("room"));
  assert.ok(planningTools.includes("tentacle"));
  assert.ok(planningTools.includes("storey"));
  assert.ok(!planningTools.includes("stair"));
  assert.ok(!planningTools.includes("paint"));
  assert.equal(workspaceModeSupportsTool("planning", "stair"), true);
  assert.equal(editorWorkspaceToolDescriptor("room")?.label, "Linien Brush");
  assert.equal(editorWorkspaceToolDescriptor("room")?.shortLabel, "Linien Brush");
  assert.equal(editorWorkspaceToolDescriptor("tentacle")?.label, "Tentacle Straße");
  assert.equal(editorWorkspaceToolDescriptor("tentacle")?.shortLabel, "Straße");
  assert.equal(editorWorkspaceToolDescriptor("storey")?.label, "Geschoss");
});

test("planning orbit math keeps a stable distance and stays above the target", () => {
  const target = { x: 12, y: 3, z: -8 };
  const position = planningOrbitPosition(target, 42, Math.PI * 0.78, Math.PI * 0.31);
  const distance = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
  assert.ok(Math.abs(distance - 42) < 1e-9);
  assert.ok(position.y > target.y);
  assert.ok(clampPlanningPolar(-10) > 0);
  assert.ok(clampPlanningPolar(10) < Math.PI / 2);
});

test("cursor targeting reaches the focus even at maximum planning zoom", () => {
  assert.equal(
    planningCameraTargetingDistance(PLANNING_CAMERA_MAX_DISTANCE, 1_000),
    1_000,
  );
  assert.ok(
    planningCameraTargetingDistance(PLANNING_CAMERA_MAX_DISTANCE, 500)
      >= PLANNING_CAMERA_MAX_DISTANCE,
  );
  assert.equal(planningCameraTargetingDistance(42, 1_000), 84);
});

test("planning pointer gestures map primary drag to orbit and middle drag to pan", () => {
  assert.equal(planningPointerInteraction(0, false), "orbit");
  assert.equal(planningPointerInteraction(1, false), "pan");
  assert.equal(planningPointerInteraction(1, true), "pan");
  assert.equal(planningPointerInteraction(2, false), null);
});

test("planning pan stays in the camera screen plane and wheel zoom remains bounded", () => {
  const pan = planningScreenPlanePanOffset(
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    42,
    60,
    900,
    30,
    20,
  );
  assert.ok(pan.x < 0);
  assert.ok(pan.y > 0);
  assert.equal(pan.z, 0);
  assert.ok(planningZoomDistance(42, -120) < 42);
  assert.ok(planningZoomDistance(42, 120) > 42);
  assert.equal(planningZoomDistance(PLANNING_CAMERA_MAX_DISTANCE, 10_000), PLANNING_CAMERA_MAX_DISTANCE);
  assert.equal(planningZoomDistance(4, -10_000), 4);
});

test("planning keyboard navigation maps WASD and arrows to the same camera-plane movement", () => {
  assert.equal(planningKeyboardMovement("KeyW"), "forward");
  assert.equal(planningKeyboardMovement("ArrowUp"), "forward");
  assert.equal(planningKeyboardMovement("KeyS"), "backward");
  assert.equal(planningKeyboardMovement("ArrowDown"), "backward");
  assert.equal(planningKeyboardMovement("KeyA"), "left");
  assert.equal(planningKeyboardMovement("ArrowLeft"), "left");
  assert.equal(planningKeyboardMovement("KeyD"), "right");
  assert.equal(planningKeyboardMovement("ArrowRight"), "right");
  assert.equal(planningKeyboardMovement("Space"), null);

  const forward = planningKeyboardPanOffset(0, 42, 1_000, 0, 1);
  const right = planningKeyboardPanOffset(0, 42, 1_000, 1, 0);
  const diagonal = planningKeyboardPanOffset(0, 42, 1_000, 1, 1);
  assert.ok(Math.abs(forward.x) < 1e-12);
  assert.ok(forward.z < 0);
  assert.ok(right.x > 0);
  assert.ok(Math.abs(right.z) < 1e-12);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - Math.hypot(forward.x, forward.z)) < 1e-9);
  assert.deepEqual(planningKeyboardPanOffset(0, 42, 16, 0, 0), { x: 0, y: 0, z: 0 });
});

test("an active planning tool can claim primary input without enabling generic block edits", () => {
  assert.equal(planningPointerInteraction(0, true), null);
  assert.equal(workspaceModeAllowsGenericBlockEditing("planning"), false);
  assert.equal(workspaceModeAllowsGenericBlockEditing("first-person"), true);
});
