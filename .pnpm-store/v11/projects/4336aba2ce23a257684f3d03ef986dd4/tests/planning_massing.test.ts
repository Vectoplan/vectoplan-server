import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  normalizePlanningMassingHeight,
  validatePlanningMassing,
} from "../src/frontend/planning_massing/planning_massing_model";

test("a reverse rectangle becomes one deterministic block mass", () => {
  const result = validatePlanningMassing({
    minimum: { x: 14, y: 3, z: 25 },
    maximum: { x: 10, y: 3, z: 20 },
  }, 9);

  assert.equal(result.ok, true);
  assert.deepEqual(result.draft?.bodyBounds, {
    minimum: { x: 10, y: 3, z: 20 },
    maximum: { x: 14, y: 11, z: 25 },
  });
  assert.equal(result.draft?.widthBlocks, 5);
  assert.equal(result.draft?.depthBlocks, 6);
  assert.equal(result.draft?.footprintAreaM2, 30);
  assert.equal(result.draft?.volumeM3, 270);
});

test("the roof ring follows the outer block faces at the massing eaves", () => {
  const result = validatePlanningMassing({
    minimum: { x: 2, y: 7, z: 4 },
    maximum: { x: 4, y: 7, z: 8 },
  }, 3);

  assert.equal(result.draft?.roofEavesY, 10);
  assert.deepEqual(result.draft?.roofPoints, [
    { x: 2, y: 10, z: 4 },
    { x: 5, y: 10, z: 4 },
    { x: 5, y: 10, z: 9 },
    { x: 2, y: 10, z: 9 },
  ]);
});

test("height is block-snapped and bounded for one command", () => {
  assert.equal(normalizePlanningMassingHeight(7.9), 7);
  assert.equal(normalizePlanningMassingHeight(-20), 1);
  assert.equal(normalizePlanningMassingHeight(999), 128);
  assert.equal(normalizePlanningMassingHeight("invalid", 6), 6);
});

test("missing and oversized footprints are rejected before mutation", () => {
  assert.equal(validatePlanningMassing(null, 6).code, "massing_selection_missing");
  const oversized = validatePlanningMassing({
    minimum: { x: 0, y: 0, z: 0 },
    maximum: { x: 256, y: 0, z: 2 },
  }, 6);
  assert.equal(oversized.ok, false);
  assert.equal(oversized.code, "massing_footprint_too_large");
});

test("the MVP reuses WorldEdit fill and the existing roof pipeline", () => {
  const source = readFileSync(resolve("src/frontend/world_edit/world_edit_controller.ts"), "utf8");
  assert.match(source, /executeAt\(undefined, "fill", \{/);
  assert.match(source, /commandTool: "selection"/);
  assert.match(source, /subsystem: "planning-massing"/);
  assert.match(source, /activate\("roof"\)/);
  assert.match(source, /const calculation = await calculateRoofPreview\(\)/);
  assert.doesNotMatch(source, /planningMassingWorldRuntime|planningMassingScene/);
});

test("the massing flow and regular WorldEdit panels never cover each other", () => {
  const controller = readFileSync(resolve("src/frontend/planning_massing/planning_massing_controller.ts"), "utf8");
  const styles = readFileSync(resolve("src/frontend/styles/planning_massing.css"), "utf8");

  assert.match(controller, /dataset\.planningMassingActive = "true"/);
  assert.match(styles, /data-planning-massing-active="true"/);
  assert.match(styles, /data-world-edit-tool="selection"\]\s+\.editor-world-edit/);
  assert.match(styles, /:not\(\[data-world-edit-tool="selection"\]\)\s+\.vp-planning-massing/);
});
