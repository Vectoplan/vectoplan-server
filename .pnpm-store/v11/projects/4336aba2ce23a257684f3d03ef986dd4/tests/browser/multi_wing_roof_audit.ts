// Bundle as Node ESM, then run against the current local editor/CAD proxy.
import assert from "node:assert/strict";
import { buildLineBrushRoofZones } from "../../src/frontend/world_edit/systems/line_brush/building_roofs";
import { buildLineBrushBuildingLayout } from "../../src/frontend/world_edit/systems/line_brush/building_layout";
import { lineBrushBuildingPreset } from "../../src/frontend/world_edit/systems/line_brush/building_presets";
import { createPathBrushDraft } from "../../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS } from "../../src/frontend/world_edit/systems/roof/contracts";
import { roofSurfaceTriangles, heightOnRoof } from "../../src/frontend/scene/roof_surface_geometry";
import { MULTI_WING_ROOF_PATHS, MULTI_WING_ROOF_TYPES, MULTI_WING_STOREYS } from "../fixtures/multi_wing_roofs";

for (const [name, path] of Object.entries(MULTI_WING_ROOF_PATHS)) for (const roofType of MULTI_WING_ROOF_TYPES) for (const stepped of [false, true]) {
  const draft = createPathBrushDraft(path.map(([x, z]) => ({ x, y: 0, z })), { kind: "building", width: 8 })!;
  const zones = buildLineBrushRoofZones(draft, buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard")), roofType, true);
  const results = [], eaves: number[] = [];
  for (const [index, zone] of zones.entries()) {
    const y = (stepped ? MULTI_WING_STOREYS[index]! : 6) * 2.645;
    eaves.push(y);
    const parameters = { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType, eavesHeightMm: Math.round(y * 1000),
      ridgeDirection: zone.ridgeDirection, continuationEdgesMm: zone.continuationEdgesMm,
      continuationEdgeIndices: zone.continuationEdgeIndices,
      edgeOverhangsMm: zone.polygon[0]!.map((_, edge) => zone.interiorEdges.includes(edge) ? 0 : 250) };
    const request = buildRoofCalculationRequest(zone.polygon[0]!.map(([x, z]) => ({ x, y, z })), parameters);
    const response = await fetch("http://127.0.0.1:5100/editor/api/cad/automation/roof/calculate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
    });
    const result = await response.json(); assert.equal(result.ok, true, JSON.stringify(result)); results.push(result);
  }
  let maximumGapM = 0;
  for (let index = 0; index < zones.length - 1; index += 1) {
    const [a, b] = [zones[index]!.polygon[0]![1]!, zones[index]!.polygon[0]![2]!];
    for (let sample = 0; sample <= 20; sample += 1) {
      const x = a[0] + (b[0] - a[0]) * sample / 20, z = a[1] + (b[1] - a[1]) * sample / 20;
      const first = heightOnRoof(roofSurfaceTriangles(results[index]), x, z);
      const second = heightOnRoof(roofSurfaceTriangles(results[index + 1]), x, z);
      assert.notEqual(first, null); assert.notEqual(second, null);
      const gap = Math.abs(first! - second! - eaves[index]! + eaves[index + 1]!);
      maximumGapM = Math.max(maximumGapM, gap);
      assert.ok(gap < 1e-6, `${name}/${roofType}/${stepped}: seam ${index}/${sample}: ${gap} m gap`);
      const skins = results.slice(index, index + 2).map(result => roofSurfaceTriangles({ geometry: { faces: result.roof_build_up.top_faces } }));
      const firstSkin = heightOnRoof(skins[0]!, x, z), secondSkin = heightOnRoof(skins[1]!, x, z);
      assert.notEqual(firstSkin, null, "first tile skin must reach the shared joint");
      assert.notEqual(secondSkin, null, "second tile skin must reach the shared joint");
      const skinGap = Math.abs(firstSkin! - secondSkin! - eaves[index]! + eaves[index + 1]!);
      maximumGapM = Math.max(maximumGapM, skinGap);
      assert.ok(skinGap < 1e-6, `${name}/${roofType}/${stepped}: tile skin ${index}/${sample}: ${skinGap} m gap`);
      if (sample === 10) assert.ok(first! - eaves[index]! > 2.5, "the ridge must continue above the joint");
    }
  }
  console.log(JSON.stringify({ name, roofType, stepped, maximumGapM, wings: zones.length }));
}
