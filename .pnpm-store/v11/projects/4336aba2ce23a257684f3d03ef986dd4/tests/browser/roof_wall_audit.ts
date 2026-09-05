// Live CAD regression: bundle as Node ESM; requires the local editor/CAD proxy.
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildLineBrushBuildingLayout } from "../../src/frontend/world_edit/systems/line_brush/building_layout";
import { buildLineBrushRoofZones } from "../../src/frontend/world_edit/systems/line_brush/building_roofs";
import { lineBrushBuildingPreset } from "../../src/frontend/world_edit/systems/line_brush/building_presets";
import { createPathBrushDraft } from "../../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS } from "../../src/frontend/world_edit/systems/roof/contracts";
import { buildLineBrushRoofWallCells, type LineBrushRoofWallZone } from "../../src/frontend/world_edit/systems/line_brush/roof_walls";
import { createConstructionCellMesh, constructionCellForIntersection } from "../../src/frontend/scene/construction_cell_rendering";
import { roofSurfaceTriangles, heightOnRoof } from "../../src/frontend/scene/roof_surface_geometry";

const draft = createPathBrushDraft([{ x: 0, y: 0, z: 0 }, { x: 32, y: 0, z: 12 }, { x: 22, y: 0, z: 39 }], { kind: "building", width: 8 })!;
const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
for (const roofType of ["gable", "pent"] as const) for (const extra of [0, 1]) {
  const zones: LineBrushRoofWallZone[] = [];
  for (const zone of buildLineBrushRoofZones(draft, layout, roofType, true)) {
    const eavesY = (6 + (zone.segmentIndex === 0 ? extra : 0)) * 2.645;
    const parameters = { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType, pitchDeg: 35, eavesHeightMm: Math.round(eavesY * 1000),
      ridgeDirection: zone.ridgeDirection, edgeOverhangsMm: zone.polygon[0]!.map((_, i) => zone.interiorEdges.includes(i) ? 0 : 250) };
    const response = await fetch("http://127.0.0.1:5100/editor/api/cad/automation/roof/calculate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRoofCalculationRequest(zone.polygon[0]!.map(([x, z]) => ({ x, y: eavesY, z })), parameters)),
    });
    const calculation = await response.json();
    assert.equal(calculation.ok, true);
    zones.push({ ...zone, calculation, eavesY });
  }
  const cells = buildLineBrushRoofWallCells(zones);
  const material = new THREE.MeshBasicMaterial();
  const mesh = createConstructionCellMesh(cells, material)!;
  assert.ok(mesh);
  mesh.updateMatrixWorld(true);
  let externalSamples = 0, stepSamples = 0;
  for (const [index, zone] of zones.entries()) {
    const triangles = roofSurfaceTriangles(zone.calculation);
    const ring = [...zone.polygon[0]!];
    if (ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1]) ring.pop();
    const signed = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]!; return sum + a[0] * b[1] - a[1] * b[0]; }, 0);
    for (const [edge, a] of ring.entries()) {
      const b = ring[(edge + 1) % ring.length]!, dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const inward = new THREE.Vector3(-dz / length, 0, dx / length).multiplyScalar(Math.sign(signed));
      for (let sample = 1; sample < 10; sample += 1) {
        const x = a[0] + dx * sample / 10, z = a[1] + dz * sample / 10;
        const top = heightOnRoof(triangles, x, z)!;
        const internal = zone.interiorEdges.includes(edge);
        const neighborTop = internal ? heightOnRoof(roofSurfaceTriangles(zones[1 - index]!.calculation), x, z) : null;
        const bottom = Math.max(zone.eavesY, neighborTop ?? -Infinity);
        if (top - bottom < 0.02) continue;
        const origin = new THREE.Vector3(x, (top + bottom) / 2, z).addScaledVector(inward, -0.1);
        const hit = new THREE.Raycaster(origin, inward, 0, 0.8).intersectObject(mesh, false)[0];
        assert.ok(hit, `${roofType}/${extra}: open ${internal ? "step" : "exterior"} edge ${index}/${edge}/${sample}`);
        assert.ok(constructionCellForIntersection(hit), "infill must retain its editable routing cell");
        if (internal) stepSamples += 1; else externalSamples += 1;
      }
    }
  }
  assert.ok(externalSamples > 20);
  if (extra) assert.ok(stepSamples > 0);
  console.log(JSON.stringify({ roofType, extra, fragments: cells.length, externalSamples, stepSamples }));
  mesh.geometry.dispose(); material.dispose();
}
