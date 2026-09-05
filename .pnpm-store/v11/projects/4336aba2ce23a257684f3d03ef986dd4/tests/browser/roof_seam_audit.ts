// Live integration audit: bundle with esbuild --platform=node --format=esm,
// then run while the editor/CAD proxy is available on localhost:5100.
import { buildLineBrushBuildingLayout } from "../../src/frontend/world_edit/systems/line_brush/building_layout";
import { buildLineBrushRoofZones } from "../../src/frontend/world_edit/systems/line_brush/building_roofs";
import { lineBrushBuildingPreset } from "../../src/frontend/world_edit/systems/line_brush/building_presets";
import { createPathBrushDraft } from "../../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS, type RoofType } from "../../src/frontend/world_edit/systems/roof/contracts";
import { roofSurfaceTriangles, heightOnRoof } from "../../src/frontend/scene/roof_surface_geometry";

const draft = createPathBrushDraft([{ x: 0, y: 0, z: 0 }, { x: 32, y: 0, z: 12 }, { x: 22, y: 0, z: 39 }], { kind: "building", width: 8 })!;
const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
for (const roofType of ["gable", "hipped", "half_hipped", "pent", "mansard", "trapezoid", "butterfly", "pyramid", "barrel", "sawtooth"] as RoofType[]) {
  const zones = buildLineBrushRoofZones(draft, layout, roofType, true);
  const results = [];
  for (const zone of zones) {
    const parameters = { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType, eavesHeightMm: 15870,
      ridgeDirection: zone.ridgeDirection, continuationEdgesMm: zone.continuationEdgesMm,
      continuationEdgeIndices: zone.continuationEdgeIndices,
      edgeOverhangsMm: zone.polygon[0]!.map((_, i) => zone.interiorEdges.includes(i) ? 0 : 250) };
    const request = buildRoofCalculationRequest(zone.polygon[0]!.map(([x, z]) => ({ x, y: 15.87, z })), parameters);
    const response = await fetch("http://127.0.0.1:5100/editor/api/cad/automation/roof/calculate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(JSON.stringify(result));
    results.push(result);
  }
  const [start, end] = [zones[0]!.polygon[0]![1]!, zones[0]!.polygon[0]![2]!];
  const triangles = results.map(roofSurfaceTriangles);
  const differences: number[] = [];
  for (let i = 0; i <= 20; i += 1) {
    const x = start[0] + (end[0] - start[0]) * i / 20;
    const z = start[1] + (end[1] - start[1]) * i / 20;
    const first = heightOnRoof(triangles[0]!, x, z), second = heightOnRoof(triangles[1]!, x, z);
    if (first === null || second === null) throw new Error(`${roofType}: uncovered shared seam ${i}`);
    differences.push(Math.abs(first - second));
  }
  const maximumSeamGapM = Math.max(...differences);
  if (maximumSeamGapM > 1e-6) throw new Error(`${roofType}: ${maximumSeamGapM} m gap at the shared wing seam`);
  console.log(JSON.stringify({ roofType, maximumSeamGapM, ridgeDirections: results.map((result) => result.geometry.ridge_direction_deg),
    alignmentOffsetsMm: results.map((result) => result.structure.bearing_model.vertical_alignment_offset_mm),
    samples: [differences[0], differences[10], differences[20]] }));
}
