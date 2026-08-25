import assert from "node:assert/strict";
import test from "node:test";

import {
  WORLD_EDIT_COMMAND_SOURCE,
  type WorldEditSystem,
  type WorldEditTool,
} from "../src/frontend/world_edit/systems/contracts";
import { worldEditToolIdFromSlot } from "../src/frontend/inventory/creative_inventory_panel";
import { createWorldEditSystemRegistry } from "../src/frontend/world_edit/systems/registry";
import { createSculptSystem } from "../src/frontend/world_edit/systems/sculpt/system";
import { createTentacleSystem } from "../src/frontend/world_edit/systems/tentacle/system";
import { createRoofSystem } from "../src/frontend/world_edit/systems/roof/system";
import {
  buildRoofCalculationRequest,
  DEFAULT_ROOF_TOOL_PARAMETERS,
  roofCalculationRequestKey,
} from "../src/frontend/world_edit/systems/roof/contracts";
import {
  normalizeQuickRoofPitch,
  normalizeQuickRoofOverhangMm,
  persistedRoofQuickSettings,
  ROOF_TYPE_OPTIONS,
  roofOverhangFromWheel,
  roofPitchFromWheel,
} from "../src/frontend/world_edit/systems/roof/quick_settings";
import {
  inactiveRoofZones,
  shouldCommitRoofSettingsClose,
  uniqueRoofZones,
} from "../src/frontend/world_edit/systems/roof/zones";
import { createRoofCalculationMeshes } from "../src/frontend/scene/roof_calculation_rendering";
import {
  polygonAreaClosedCoordinates,
  polygonAreaPlanCentroid,
  polygonAreaPlanArea,
  polygonAreaSelfIntersects,
  validPolygonArea,
} from "../src/frontend/world_edit/systems/polygon_area/geometry";
import { createCopyPasteSystem } from "../src/frontend/world_edit/systems/copy_paste/system";
import { createCutPasteSystem } from "../src/frontend/world_edit/systems/cut_paste/system";
import { shouldAppendTentacleSample } from "../src/frontend/world_edit/systems/tentacle/geometry";
import {
  clipboardAnchorAlongAxis,
  clipboardParcelMaskEnabled,
} from "../src/frontend/world_edit/systems/clipboard/geometry";

function intent(action: "primary" | "secondary" | "primary-release" | "secondary-release") {
  return {
    action,
    trigger: "test",
    position: { x: 1, y: 2, z: 3 },
    sourceCell: null,
    placementCell: null,
    targetPoint: null,
    createdAt: "2026-08-20T00:00:00Z",
  } as const;
}

const TOOLS: readonly WorldEditTool[] = [
  "selection",
  "room",
  "paint",
  "sculpt",
  "parcel",
  "parcel-grid",
  "ruler",
  "copy-paste",
  "cut-paste",
  "tentacle",
  "roof",
];

function system(
  tool: WorldEditTool,
  aliases: readonly string[] = [],
  onIntent: () => void = () => undefined,
): WorldEditSystem {
  return {
    tool,
    aliases,
    ui: {
      title: tool,
      hint: tool,
      activationMessage: tool,
      maxDistance: 60,
      inventoryToolId: tool,
      operations: [],
      showBrushSettings: false,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: false,
      showClipboardStatus: false,
      resetLabel: "Reset",
      resetMessage: "Reset",
    },
    behavior: {
      selectionVisualization: "none",
      selectionDragMode: "none",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    async handleIntent(): Promise<boolean> {
      onIntent();
      return true;
    },
    canExecute: () => false,
    execute: () => undefined,
    reset: () => undefined,
  };
}

function completeSystems(): WorldEditSystem[] {
  return TOOLS.map((tool) => system(tool));
}

test("all WorldEdit systems are independently addressable and immutable", () => {
  const registry = createWorldEditSystemRegistry(completeSystems());

  assert.deepEqual(registry.systems.map(({ tool }) => tool), TOOLS);
  assert.equal(new Set(registry.systems).size, TOOLS.length);
  for (const tool of TOOLS) {
    const registered = registry.get(tool);
    assert.equal(registered.tool, tool);
    assert.ok(Object.isFrozen(registered));
    assert.ok(Object.isFrozen(registered.ui));
    assert.ok(Object.isFrozen(registered.behavior));
    assert.ok(Object.isFrozen(registered.aliases));
  }
});

test("the registry refuses missing, duplicate, and colliding systems", () => {
  assert.throws(
    () => createWorldEditSystemRegistry(completeSystems().filter(({ tool }) => tool !== "ruler")),
    /WorldEdit-System fehlt: ruler/,
  );
  assert.throws(
    () => createWorldEditSystemRegistry([...completeSystems(), system("room")]),
    /WorldEdit-System doppelt registriert: room/,
  );
  assert.throws(
    () => createWorldEditSystemRegistry(completeSystems().map((entry) => {
      if (entry.tool === "parcel" || entry.tool === "parcel-grid") return system(entry.tool, ["grund"]);
      return entry;
    })),
    /WorldEdit-Alias doppelt registriert: grund/,
  );
});

test("the longest alias wins independently of registration order", () => {
  const registry = createWorldEditSystemRegistry(completeSystems().map((entry) => {
    if (entry.tool === "parcel") return system("parcel", ["grund"]);
    if (entry.tool === "parcel-grid") return system("parcel-grid", ["grundstücksraster"]);
    return entry;
  }));

  assert.equal(registry.match("worldedit-grundstücksraster-tool"), "parcel-grid");
  assert.equal(registry.match("worldedit-grund-tool"), "parcel");
  assert.equal(registry.match("unknown-tool"), "selection");
});

test("dispatching to one system does not call a neighboring system", async () => {
  const calls = new Map<WorldEditTool, number>(TOOLS.map((tool) => [tool, 0]));
  const registry = createWorldEditSystemRegistry(TOOLS.map((tool) => system(
    tool,
    [],
    () => calls.set(tool, (calls.get(tool) ?? 0) + 1),
  )));

  await registry.get("parcel").handleIntent(undefined as never);

  assert.equal(calls.get("parcel"), 1);
  for (const tool of TOOLS.filter((entry) => entry !== "parcel")) {
    assert.equal(calls.get(tool), 0);
  }
});

test("copy and cut inventory slots both activate their dedicated WorldEdit systems", () => {
  const registry = createWorldEditSystemRegistry(TOOLS.map((tool) => system(
    tool,
    tool === "copy-paste"
      ? ["copy", "copy-transform"]
      : tool === "cut-paste" ? ["cut", "cut-transform"] : [],
  )));

  const copyToolId = worldEditToolIdFromSlot({
    object_kind: "world_edit_tool",
    world_edit_tool: "copy-transform",
  });
  const cutToolId = worldEditToolIdFromSlot({
    object_kind: "world_edit_tool",
    world_edit_tool: "cut-transform",
  });

  assert.equal(copyToolId, "copy-transform");
  assert.equal(cutToolId, "cut-transform");
  assert.equal(registry.match(copyToolId), "copy-paste");
  assert.equal(registry.match(cutToolId), "cut-paste");
});

test("roof inventory slots activate the dedicated roof system", () => {
  const toolId = worldEditToolIdFromSlot({
    object_kind: "world_edit_tool",
    world_edit_tool: "roof",
  });
  const registry = createWorldEditSystemRegistry(completeSystems());

  assert.equal(toolId, "roof");
  assert.equal(registry.match(toolId), "roof");
});

test("WorldEdit uses the Chunk service's accepted editor command source", () => {
  assert.equal(WORLD_EDIT_COMMAND_SOURCE, "editor");
});

test("sculpt maps left to lower and right to raise without the paint handler", async () => {
  const modes: string[] = [];
  let defaults = 0;
  const sculpt = createSculptSystem({
    resolveTarget: () => ({ position: { x: 1, y: 2, z: 3 }, blockTypeId: "terrain" }),
    executeLayer: async (_target, mode) => { modes.push(mode); },
    applyDefaults: () => { defaults += 1; },
    reset: () => undefined,
    setStatus: () => undefined,
  });
  sculpt.onActivate?.(null);
  await sculpt.handleIntent(intent("primary"));
  await sculpt.handleIntent(intent("secondary"));
  assert.equal(defaults, 1);
  assert.deepEqual(modes, ["lower", "raise"]);
});

test("copy and cut keep their fixed capture operation and movement phases isolated", async () => {
  let phase: "select" | "move" = "select";
  const copyCalls: string[] = [];
  const copy = createCopyPasteSystem({
    getPhase: () => phase,
    stopDrag: () => copyCalls.push("stop"),
    adjustSelectionHandle: () => false,
    resolveTarget: () => ({ x: 1, y: 2, z: 3 }),
    startSelection: () => copyCalls.push("select"),
    startMove: () => { copyCalls.push("move"); return true; },
    captureOrPaste: async () => { copyCalls.push("copy-or-paste"); },
    canExecute: () => true,
    reset: () => copyCalls.push("reset"),
    rebuild: () => copyCalls.push("rebuild"),
    refreshHud: () => copyCalls.push("hud"),
  });
  await copy.handleIntent(intent("primary"));
  await copy.handleIntent(intent("secondary"));
  await copy.handleIntent(intent("secondary-release"));
  phase = "move";
  await copy.handleIntent(intent("primary"));
  // A release without a delivered down event must still confirm paste.
  await copy.handleIntent(intent("secondary-release"));
  // An ordinary down/up pair executes exactly once.
  await copy.handleIntent(intent("secondary"));
  await copy.handleIntent(intent("secondary-release"));
  assert.deepEqual(copyCalls, [
    "select",
    "copy-or-paste",
    "move",
    "copy-or-paste",
    "copy-or-paste",
  ]);
  assert.equal(copy.ui.showMask, false);

  const cutCalls: string[] = [];
  const cut = createCutPasteSystem({
    getPhase: () => "select",
    stopDrag: () => undefined,
    adjustSelectionHandle: () => false,
    resolveTarget: () => ({ x: 1, y: 2, z: 3 }),
    startSelection: () => undefined,
    startMove: () => true,
    captureOrPaste: async () => { cutCalls.push("cut-or-paste"); },
    canExecute: () => true,
    reset: () => undefined,
    rebuild: () => undefined,
    refreshHud: () => undefined,
  });
  await cut.handleIntent(intent("secondary"));
  await cut.handleIntent(intent("secondary-release"));
  assert.deepEqual(cutCalls, ["cut-or-paste"]);
  assert.equal(cut.ui.showMask, false);
});

test("clipboard gizmo movement snaps exclusively along its selected axis", () => {
  const anchor = { x: 10, y: 20, z: 30 };

  assert.deepEqual(clipboardAnchorAlongAxis(anchor, "x", 2.6), { x: 13, y: 20, z: 30 });
  assert.deepEqual(clipboardAnchorAlongAxis(anchor, "y", -1.4), { x: 10, y: 19, z: 30 });
  assert.deepEqual(clipboardAnchorAlongAxis(anchor, "z", 0.49), { x: 10, y: 20, z: 30 });
  assert.deepEqual(anchor, { x: 10, y: 20, z: 30 });
});

test("copy and cut never inherit the parcel mask", () => {
  assert.equal(clipboardParcelMaskEnabled(true, 0), false);
  assert.equal(clipboardParcelMaskEnabled(false, 2), false);
  assert.equal(clipboardParcelMaskEnabled(true, 2), false);
});

test("tentacle draws with primary and executes with secondary", async () => {
  const calls: string[] = [];
  const tentacle = createTentacleSystem({
    stopDrawing: () => calls.push("stop"),
    startHover: () => calls.push("hover-start"),
    stopHover: () => calls.push("hover-stop"),
    finishPath: () => calls.push("finish"),
    removePointUnderCrosshair: () => false,
    resolveTarget: () => ({ x: 4, y: 5, z: 6 }),
    startDrawing: () => calls.push("draw"),
    executePath: async () => { calls.push("execute"); },
    pointCount: () => 3,
    rebuild: () => undefined,
    reset: () => undefined,
    setStatus: () => undefined,
  });
  await tentacle.handleIntent(intent("primary"));
  await tentacle.handleIntent(intent("primary-release"));
  await tentacle.handleIntent(intent("secondary"));
  const escape = {
    key: "Escape",
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as KeyboardEvent;
  assert.equal(tentacle.handleKeyDown?.(escape), true);
  assert.deepEqual(calls, ["draw", "stop", "execute", "finish"]);
});

test("tentacle right click deletes an aimed point before path execution", async () => {
  const calls: string[] = [];
  const tentacle = createTentacleSystem({
    stopDrawing: () => undefined,
    startHover: () => undefined,
    stopHover: () => undefined,
    finishPath: () => undefined,
    removePointUnderCrosshair: () => { calls.push("delete"); return true; },
    resolveTarget: () => null,
    startDrawing: () => undefined,
    executePath: async () => { calls.push("execute"); },
    pointCount: () => 3,
    rebuild: () => undefined,
    reset: () => undefined,
    setStatus: () => undefined,
  });

  await tentacle.handleIntent(intent("secondary"));

  assert.deepEqual(calls, ["delete"]);
});

test("tentacle hold debounce keeps a short click at exactly one point", () => {
  assert.equal(shouldAppendTentacleSample(40, 4), false);
  assert.equal(shouldAppendTentacleSample(179, 4), false);
  assert.equal(shouldAppendTentacleSample(180, 0.74), false);
  assert.equal(shouldAppendTentacleSample(180, 0.75), true);
});

test("polygon areas accept concave straight rings and reject self intersections", () => {
  const concave = [
    { x: 0, y: 4, z: 0 },
    { x: 6, y: 4, z: 0 },
    { x: 6, y: 4, z: 5 },
    { x: 3, y: 4, z: 2 },
    { x: 0, y: 4, z: 5 },
  ];
  const crossed = [
    { x: 0, y: 4, z: 0 },
    { x: 5, y: 4, z: 5 },
    { x: 0, y: 4, z: 5 },
    { x: 5, y: 4, z: 0 },
  ];

  assert.equal(validPolygonArea(concave), true);
  assert.equal(polygonAreaPlanArea(concave), 21);
  assert.deepEqual(polygonAreaPlanCentroid([
    { x: 0, y: 4, z: 0 }, { x: 8, y: 4, z: 0 },
    { x: 8, y: 4, z: 4 }, { x: 0, y: 4, z: 4 },
  ]), { x: 4, y: 4, z: 2 });
  assert.deepEqual(polygonAreaClosedCoordinates(concave).at(-1), [0, 0]);
  assert.equal(polygonAreaSelfIntersects(crossed), true);
  assert.equal(validPolygonArea(crossed), false);
});

test("roof request maps world-cell x/z into CAD millimetres with all structural variables", () => {
  const request = buildRoofCalculationRequest([
    { x: 1, y: 6, z: 2 },
    { x: 9, y: 6, z: 2 },
    { x: 9, y: 6, z: 7 },
    { x: 1, y: 6, z: 7 },
  ], { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType: "hipped", pitchDeg: 42 });

  assert.equal(request.roof_type, "hipped");
  assert.deepEqual(request.footprint.outer_ring_mm[0], [1000, 2000]);
  assert.equal(request.parameters.pitch_deg, 42);
  assert.deepEqual(request.parameters.overhang_mm, {
    default_mm: 500, north_mm: 500, east_mm: 500, south_mm: 500, west_mm: 500,
  });
  assert.equal(request.parameters.hip_end_ratio, 0.5);
  assert.deepEqual(request.parameters.roof_build_up, {
    insulation_mode: "between",
    insulation_thickness_mm: 200,
    sheathing_thickness_mm: 22,
    underlay_thickness_mm: 3,
    counter_batten: { width_mm: 60, height_mm: 40 },
    tile_batten: { width_mm: 50, height_mm: 30, spacing_mm: 330 },
    tile_thickness_mm: 20,
    tile_material_ref: "clay-roof-tile",
  });
  assert.deepEqual(request.parameters.structure, {
    rafter: { width_mm: 80, height_mm: 200, spacing_mm: 650, birdsmouth_depth_mm: 30 },
    purlin: {
      width_mm: 140,
      height_mm: 200,
      maximum_spacing_mm: 4500,
      middle_span_threshold_mm: 4500,
    },
  });
});

test("roof renderer keeps timber below the tiled surface and renders birdsmouth cuts", () => {
  const calculation = {
    ok: true,
    geometry: {
      faces: [{ face_ref: "face-1", polygon_3d_mm: [[0, 0, 0], [2000, 0, 0], [2000, 2000, 0], [0, 2000, 0]] }],
    },
    roof_build_up: {
      exterior_offset_mm: 115,
      top_faces: [{ face_ref: "face-1", polygon_3d_mm: [[0, 0, 115], [2000, 0, 115], [2000, 2000, 115], [0, 2000, 115]] }],
      layers: [
        { role: "insulation", bottom_offset_mm: -200, top_offset_mm: 0 },
        { role: "roof_sheathing", bottom_offset_mm: 0, top_offset_mm: 22 },
        { role: "counter_batten", bottom_offset_mm: 25, top_offset_mm: 65 },
        { role: "tile_batten", bottom_offset_mm: 65, top_offset_mm: 95 },
        { role: "roof_tile", thickness_mm: 20, bottom_offset_mm: 95, top_offset_mm: 115 },
      ],
      counter_battens: [],
      tile_battens: [],
    },
    structure: {
      rafters: [{
        member_ref: "rafter-1",
        start_3d_mm: [1000, 0, -100],
        end_3d_mm: [1000, 2000, -100],
        height_axis_3d: [0, 0, 1],
        section_mm: { width: 80, height: 200 },
        notches: [{ center_ratio: 0.5, length_mm: 140, depth_mm: 30 }],
      }],
      purlins: [{
        member_ref: "sloped-purlin",
        start_3d_mm: [0, 0, -400],
        end_3d_mm: [2000, 1000, -200],
        height_axis_3d: [0, 0, 1],
        role: "middle_purlin",
        section_mm: { width: 140, height: 200 },
      }],
    },
  };
  const rendered = createRoofCalculationMeshes(calculation, { preview: true });
  const tile = rendered.meshes.find((mesh) => String(mesh.userData.roofPart).startsWith("tiles-"));
  const rafters = rendered.meshes.filter((mesh) => String(mesh.userData.roofPart).startsWith("rafter-"));
  const purlin = rendered.meshes.find((mesh) => String(mesh.userData.roofPart).startsWith("purlin-"));
  const tileEdges = rendered.meshes.filter((mesh) => String(mesh.userData.roofPart).startsWith("tile-edge-"));

  assert.ok(tile?.geometry.boundingBox);
  assert.equal(rafters.length, 3);
  assert.ok(rafters.every((mesh) => (mesh.geometry.boundingBox?.max.y ?? Infinity) <= 0.000001));
  assert.ok((tile!.geometry.boundingBox!.min.y) > 0.09);
  assert.ok((tile!.geometry.boundingBox!.max.y - tile!.geometry.boundingBox!.min.y) >= 0.019);
  assert.equal(tileEdges.length, 4);
  assert.ok(purlin);
  const purlinPositions = purlin!.geometry.getAttribute("position");
  const purlinVertices = Array.from({ length: purlinPositions.count }, (_, index) => ({
    x: purlinPositions.getX(index),
    y: purlinPositions.getY(index),
    z: purlinPositions.getZ(index),
  }));
  assert.ok(purlinVertices.some((first, firstIndex) => purlinVertices.some((second, secondIndex) => (
    firstIndex !== secondIndex
      && Math.abs(first.x - second.x) <= 0.000001
      && Math.abs(first.z - second.z) <= 0.000001
      && Math.abs(Math.abs(first.y - second.y) - 0.2) <= 0.000001
  ))));
  assert.equal(Array.isArray(tile!.material), false);
  assert.equal((tile!.material as import("three").MeshStandardMaterial).transparent, false);
  assert.equal((tile!.material as import("three").MeshStandardMaterial).opacity, 1);
  rendered.geometries.forEach((geometry) => geometry.dispose());
  rendered.materials.forEach((material) => material.dispose());
});

test("roof system closes with Escape and executes only through its own hooks", async () => {
  const calls: string[] = [];
  const roof = createRoofSystem({
    stopInteraction: () => calls.push("stop"),
    startHover: () => calls.push("hover-start"),
    stopHover: () => calls.push("hover-stop"),
    openSettingsUnderCrosshair: () => false,
    removePointUnderCrosshair: () => false,
    resolveTarget: () => ({ x: 1, y: 2, z: 3 }),
    beginPointInteraction: () => calls.push("point"),
    finishArea: () => calls.push("finish"),
    executeRoof: async () => { calls.push("execute"); },
    isComplete: () => true,
    rebuild: () => undefined,
    reset: () => undefined,
    setStatus: () => undefined,
  });
  roof.onActivate?.(null);
  await roof.handleIntent(intent("primary"));
  await roof.handleIntent(intent("primary-release"));
  await roof.handleIntent(intent("secondary"));
  const escape = {
    key: "Escape",
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as KeyboardEvent;
  assert.equal(roof.handleKeyDown?.(escape), true);
  assert.deepEqual(calls, ["hover-start", "point", "stop", "execute", "finish"]);
});

test("roof quick settings expose every roof form and change pitch by wheel without text input", () => {
  assert.deepEqual(ROOF_TYPE_OPTIONS.map(({ type }) => type), [
    "flat", "gable", "hipped", "half_hipped", "pent", "mansard",
    "trapezoid", "butterfly", "pyramid", "barrel", "sawtooth",
  ]);
  assert.equal(roofPitchFromWheel(35, -100), 36);
  assert.equal(roofPitchFromWheel(35, 100), 34);
  assert.equal(roofPitchFromWheel(80, -100), 80);
  assert.equal(roofPitchFromWheel(0, 100), 0);
  assert.equal(normalizeQuickRoofPitch(35.5), 36);
  assert.equal(roofOverhangFromWheel(500, -100), 550);
  assert.equal(roofOverhangFromWheel(500, 100), 450);
  assert.equal(normalizeQuickRoofOverhangMm(527), 550);
  assert.equal(normalizeQuickRoofOverhangMm(12), 0);
});

test("persisted roof settings reopen with the authoritative per-zone values", () => {
  const firstZone = persistedRoofQuickSettings({
    roofParameters: { roofType: "hipped", pitchDeg: 35, overhangMm: 600 },
    roofRequest: { roof_type: "pent", parameters: { pitch_deg: 41, overhang_mm: { default_mm: 750 } } },
    roofCalculation: {
      roof_type: "pent",
      normalized_request: { roof_type: "pent", parameters: { pitch_deg: 41 } },
    },
  }, { roofType: "gable", pitchDeg: 30, overhangMm: 500 });
  assert.deepEqual(firstZone, {
    roofType: "hipped",
    pitchDeg: 35,
    overhangMm: 600,
  });

  // Opening another zone must never inherit the values of the zone that was
  // edited immediately before it.
  assert.deepEqual(persistedRoofQuickSettings({
    roofParameters: { roofType: "sawtooth", pitchDeg: 28, overhangMm: 950 },
  }, firstZone), {
    roofType: "sawtooth",
    pitchDeg: 28,
    overhangMm: 950,
  });
});

test("roof request identity is stable by key order and changes with overhang", () => {
  const first = {
    contract_version: "cad-roof-calculation-request/0.1",
    roof_type: "gable",
    parameters: { pitch_deg: 35, overhang_mm: { default_mm: 500 } },
  };
  const reordered = {
    parameters: { overhang_mm: { default_mm: 500 }, pitch_deg: 35 },
    roof_type: "gable",
    contract_version: "cad-roof-calculation-request/0.1",
  };
  const changed = {
    ...first,
    parameters: { ...first.parameters, overhang_mm: { default_mm: 550 } },
  };

  assert.equal(roofCalculationRequestKey(first), roofCalculationRequestKey(reordered));
  assert.notEqual(roofCalculationRequestKey(first), roofCalculationRequestKey(changed));
});

test("every persisted roof keeps one independent area and settings target", () => {
  const meshRoofReferences = [
    { objectInstanceId: "roof-a", mesh: "skin" },
    { objectInstanceId: "roof-a", mesh: "rafter" },
    { objectInstanceId: "roof-b", mesh: "skin" },
    { objectInstanceId: "roof-c", mesh: "purlin" },
  ];

  assert.deepEqual(
    uniqueRoofZones(meshRoofReferences).map(({ objectInstanceId }) => objectInstanceId),
    ["roof-a", "roof-b", "roof-c"],
  );
  assert.deepEqual(
    inactiveRoofZones(meshRoofReferences, "roof-a").map(({ objectInstanceId }) => objectInstanceId),
    ["roof-b", "roof-c"],
  );
});

test("closing valid roof settings commits the edit and releases the next zone", () => {
  assert.equal(shouldCommitRoofSettingsClose({
    restorePointerLock: true,
    roofToolActive: true,
    busy: false,
    closed: true,
    valid: true,
  }), true);
  assert.equal(shouldCommitRoofSettingsClose({
    restorePointerLock: false,
    roofToolActive: true,
    busy: false,
    closed: true,
    valid: true,
  }), false);
  assert.equal(shouldCommitRoofSettingsClose({
    restorePointerLock: true,
    roofToolActive: true,
    busy: true,
    closed: true,
    valid: true,
  }), false);
});

test("roof settings target consumes primary click before a new polygon point", async () => {
  const calls: string[] = [];
  const roof = createRoofSystem({
    stopInteraction: () => undefined,
    startHover: () => undefined,
    stopHover: () => undefined,
    openSettingsUnderCrosshair: () => { calls.push("settings"); return true; },
    removePointUnderCrosshair: () => false,
    resolveTarget: () => ({ x: 1, y: 2, z: 3 }),
    beginPointInteraction: () => calls.push("point"),
    finishArea: () => undefined,
    executeRoof: async () => undefined,
    isComplete: () => true,
    rebuild: () => undefined,
    reset: () => undefined,
    setStatus: () => undefined,
  });

  await roof.handleIntent(intent("primary"));

  assert.deepEqual(calls, ["settings"]);
});
