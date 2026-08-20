import assert from "node:assert/strict";
import test from "node:test";

import {
  type WorldEditSystem,
  type WorldEditTool,
} from "../src/frontend/world_edit/systems/contracts";
import { createWorldEditSystemRegistry } from "../src/frontend/world_edit/systems/registry";

const TOOLS: readonly WorldEditTool[] = [
  "selection",
  "room",
  "paint",
  "sculpt",
  "parcel",
  "parcel-grid",
  "ruler",
  "clipboard",
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
