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
} from "../src/frontend/world_edit/systems/roof/contracts";
import {
  polygonAreaClosedCoordinates,
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
  assert.deepEqual(request.parameters.structure, {
    rafter: { width_mm: 80, height_mm: 200, spacing_mm: 700 },
    purlin: { width_mm: 160, height_mm: 240, maximum_spacing_mm: 2500 },
  });
});

test("roof system closes with Escape and executes only through its own hooks", async () => {
  const calls: string[] = [];
  const roof = createRoofSystem({
    stopInteraction: () => calls.push("stop"),
    startHover: () => calls.push("hover-start"),
    stopHover: () => calls.push("hover-stop"),
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
