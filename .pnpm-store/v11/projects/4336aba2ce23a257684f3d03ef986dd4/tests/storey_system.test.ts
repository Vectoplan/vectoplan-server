import assert from "node:assert/strict";
import test from "node:test";

import type { EditorInputWorldEditIntent } from "../src/frontend/input/input_controller";
import { createStoreySystem, type StoreySystemHooks } from "../src/frontend/world_edit/systems/storey/system";

function intent(
  action: EditorInputWorldEditIntent["action"],
  trigger = "test:first-person",
): EditorInputWorldEditIntent {
  return {
    action,
    trigger,
    position: { x: 4, y: 5, z: 6 },
    sourceCell: null,
    placementCell: null,
    targetPoint: null,
    createdAt: "2026-09-02T00:00:00Z",
  };
}

interface Fixture {
  readonly system: ReturnType<typeof createStoreySystem>;
  readonly calls: string[];
  readonly statuses: Array<readonly [string, string | undefined]>;
  setSelected(value: boolean): void;
  setTargetAvailable(value: boolean): void;
}

function fixture(): Fixture {
  const calls: string[] = [];
  const statuses: Array<readonly [string, string | undefined]> = [];
  let selected = false;
  let targetAvailable = true;
  const hooks: StoreySystemHooks = {
    resolveTarget: (value) => {
      calls.push(`resolve:${value.trigger}`);
      return targetAvailable ? { x: 4, y: 5, z: 6 } : null;
    },
    selectBuildingAt: (target) => {
      calls.push(`select:${target.x}:${target.y}:${target.z}`);
      selected = targetAvailable;
      return selected;
    },
    hasSelection: () => selected,
    openSettings: () => calls.push("open"),
    closeSettings: () => calls.push("close"),
    addStorey: async () => { calls.push("add"); },
    removeStorey: async () => { calls.push("remove"); },
    reset: () => { selected = false; calls.push("reset"); },
    setStatus: (message, kind) => statuses.push([message, kind]),
  };
  return {
    system: createStoreySystem(hooks),
    calls,
    statuses,
    setSelected: (value) => { selected = value; },
    setTargetAvailable: (value) => { targetAvailable = value; },
  };
}

test("storey is one shared WorldEdit system with no camera-mode side effects", async () => {
  const firstPerson = fixture();
  const planning = fixture();

  assert.equal(firstPerson.system.tool, "storey");
  assert(firstPerson.system.aliases.includes("geschoss"));
  assert(firstPerson.system.aliases.includes("floors"));
  assert.equal(firstPerson.system.ui.inventoryToolId, "storey");
  assert.equal(firstPerson.system.ui.maxDistance, 220);
  assert.equal(firstPerson.system.behavior.commandTool, null);
  assert.equal(firstPerson.system.behavior.selectionVisualization, "none");
  assert.equal(firstPerson.system.behavior.showParcelGridHandles, false);

  assert.equal(await firstPerson.system.handleIntent(intent("primary", "test:first-person")), true);
  assert.equal(await planning.system.handleIntent(intent("primary", "test:planning")), true);
  assert.deepEqual(firstPerson.calls, ["resolve:test:first-person", "select:4:5:6", "open"]);
  assert.deepEqual(planning.calls, ["resolve:test:planning", "select:4:5:6", "open"]);
});

test("primary selection opens settings and reports a missing editable building without executing", async () => {
  const value = fixture();
  value.setTargetAvailable(false);

  assert.equal(await value.system.handleIntent(intent("primary")), true);
  assert.deepEqual(value.calls, ["resolve:test:first-person"]);
  assert.deepEqual(value.statuses, [[
    "Kein editierbarer Linien-Brush-Baukörper an dieser Position.",
    "warning",
  ]]);
  assert.equal(value.system.canExecute(), false);
});

test("secondary removes one storey from the selected or newly aimed building and releases are inert", async () => {
  const value = fixture();
  assert.equal(await value.system.handleIntent(intent("secondary", "mouse:secondary-down")), true);
  assert.deepEqual(value.calls, ["resolve:mouse:secondary-down", "select:4:5:6", "remove"]);

  value.calls.length = 0;
  assert.equal(await value.system.handleIntent(intent("secondary", "mouse:secondary-down")), true);
  assert.deepEqual(value.calls, ["remove"], "an existing selection is reused without a different camera pick");

  value.calls.length = 0;
  assert.equal(await value.system.handleIntent(intent("primary-release")), true);
  assert.equal(await value.system.handleIntent(intent("secondary-release")), true);
  assert.deepEqual(value.calls, []);
});

test("execute, lifecycle, reset and keyboard shortcuts delegate exactly once to shared hooks", async () => {
  const value = fixture();
  assert.equal(value.system.canExecute(), false);
  value.system.onActivate?.(null);
  assert.deepEqual(value.calls, []);

  value.setSelected(true);
  assert.equal(value.system.canExecute(), true);
  value.system.onActivate?.(null);
  await value.system.execute();
  value.system.onDeactivate?.("roof");
  value.system.reset();
  assert.deepEqual(value.calls, ["open", "add", "close", "reset"]);

  let prevented = 0;
  let stopped = 0;
  const key = (keyValue: string) => ({
    key: keyValue,
    preventDefault: () => { prevented += 1; },
    stopPropagation: () => { stopped += 1; },
  }) as unknown as KeyboardEvent;
  value.calls.length = 0;
  for (const keyValue of ["+", "=", "-", "_"]) {
    assert.equal(value.system.handleKeyDown?.(key(keyValue)), true);
  }
  assert.equal(value.system.handleKeyDown?.(key("ArrowUp")), false);
  assert.deepEqual(value.calls, ["add", "add", "remove", "remove"]);
  assert.equal(prevented, 4);
  assert.equal(stopped, 4);
});
