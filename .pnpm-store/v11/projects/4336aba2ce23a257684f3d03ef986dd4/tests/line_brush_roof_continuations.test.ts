import test from "node:test";
import assert from "node:assert/strict";
import { buildLineBrushRoofZones } from "../src/frontend/world_edit/systems/line_brush/building_roofs";
import { buildLineBrushBuildingLayout } from "../src/frontend/world_edit/systems/line_brush/building_layout";
import { lineBrushBuildingPreset } from "../src/frontend/world_edit/systems/line_brush/building_presets";
import { createPathBrushDraft } from "../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS } from "../src/frontend/world_edit/systems/roof/contracts";
import { MULTI_WING_ROOF_PATHS, MULTI_WING_ROOF_TYPES } from "./fixtures/multi_wing_roofs";

for (const [name, path] of Object.entries(MULTI_WING_ROOF_PATHS)) test(`hip/tent continuation topology follows every ${name} wing`, () => {
  const draft = createPathBrushDraft(path.map(([x, z]) => ({ x, y: 0, z })), { kind: "building", width: 8 })!;
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  for (const roofType of MULTI_WING_ROOF_TYPES) {
    const zones = buildLineBrushRoofZones(draft, layout, roofType, true);
    assert.equal(zones.length, path.length - 1);
    for (const [index, zone] of zones.entries()) {
      const expected = [...(index < zones.length - 1 ? [1] : []), ...(index > 0 ? [3] : [])];
      assert.deepEqual(zone.continuationEdgeIndices, expected);
      const [a, b] = [path[index]!, path[index + 1]!];
      const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI + 360) % 360;
      assert.ok(Math.abs(Number(zone.ridgeDirection) - angle) < 1e-8, "a short connector must retain its wing direction");
      const points = zone.polygon[0]!.map(([x, z]) => ({ x, y: 15.87, z }));
      const request = buildRoofCalculationRequest(points, { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType,
        ridgeDirection: zone.ridgeDirection, continuationEdgesMm: zone.continuationEdgesMm,
        continuationEdgeIndices: zone.continuationEdgeIndices });
      assert.equal(request.roof_type, roofType);
      assert.deepEqual(request.parameters.continuation_edges_mm, zone.continuationEdgesMm);
      if (index) {
        const previous = zones[index - 1]!.polygon[0]!;
        assert.deepEqual([zone.polygon[0]![0], zone.polygon[0]![3]], [previous[1], previous[2]]);
      }
    }
  }
});

test("moving a persisted wing recomputes its connected edges from their identity", () => {
  const points = [{ x: 12, y: 10, z: 5 }, { x: 24, y: 10, z: 6 }, { x: 23, y: 10, z: 14 }, { x: 12, y: 10, z: 13 }];
  const request = buildRoofCalculationRequest(points, { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType: "hipped",
    continuationEdgeIndices: [1], continuationEdgesMm: [[[1000, 2000], [1000, 8000]]] });
  assert.deepEqual(request.parameters.continuation_edges_mm, [[[24000, 6000], [23000, 14000]]]);
});

test("isolated hip/tent roofs preserve their closed end caps", () => {
  const draft = createPathBrushDraft([{ x: 0, y: 0, z: 0 }, { x: 18, y: 0, z: 0 }], { kind: "building", width: 8 })!;
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  for (const roofType of MULTI_WING_ROOF_TYPES) {
    const [zone] = buildLineBrushRoofZones(draft, layout, roofType, false);
    assert.deepEqual(zone!.interiorEdges, []);
    assert.equal(zone!.continuationEdgeIndices, undefined);
    assert.equal(zone!.continuationEdgesMm, undefined);
  }
});
