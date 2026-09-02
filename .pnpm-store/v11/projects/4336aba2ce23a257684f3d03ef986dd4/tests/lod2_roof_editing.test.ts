import assert from "node:assert/strict";
import test from "node:test";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS, requestRoofCalculation } from "../src/frontend/world_edit/systems/roof/contracts";
import { importedRoofSource, type ImportedRoofSource } from "../src/frontend/world_edit/systems/roof/imported";
import { createRoofCalculationMeshes } from "../src/frontend/scene/roof_calculation_rendering";
import { LOD2_EXISTING_ROOF_COLOR } from "../src/frontend/scene/lod2_existing_appearance";
import { persistedRoofQuickSettings } from "../src/frontend/world_edit/systems/roof/quick_settings";
import { createFlatRoofCalculation } from "../src/frontend/world_edit/systems/roof/courtyard";
import {
  polygonAreaClosedRingCoordinates,
  polygonAreaRingsFromFootprint,
} from "../src/frontend/world_edit/systems/polygon_area/geometry";

const source: ImportedRoofSource = {
  schemaVersion: "lod2-roof-source.v1", sourceSha256: "a".repeat(64), buildingId: "fixture", sourceTile: "tile.zip",
  baseY: 6, referencePitchDeg: 35, footprint: [[[0,0],[8,0],[8,8],[0,8],[0,0]]],
  faces: [{ face_ref: "f1", polygon_3d_mm: [[0,0,6000],[8000,0,6000],[8000,8000,10000]] },
          { face_ref: "f2", polygon_3d_mm: [[0,0,6000],[8000,8000,10000],[0,8000,10000]] }],
};
const parameters = { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType: "imported" as const, importedSource: source,
  pitchDeg: 35, eavesHeightMm: 6000, overhangMm: 0, overhangNorthMm: 0, overhangEastMm: 0, overhangSouthMm: 0, overhangWestMm: 0 };
const points = source.footprint[0]!.slice(0,-1).map(([x,z]) => ({x:x!,z:z!,y:6}));

test("original LoD2 shape uses canonical roof meshes, without network or invented structure", async () => {
  const request = buildRoofCalculationRequest(points, parameters);
  const calculation = await requestRoofCalculation(request);
  assert.deepEqual((calculation.geometry as any).faces, source.faces);
  assert.deepEqual((calculation.structure as any).rafters, []);
  const rendered = createRoofCalculationMeshes(calculation, { objectInstanceId: "roof-fixture", semanticObjectRef: { metadata: {roofParameters:parameters} } });
  assert.equal(rendered.meshes.length, 1); // merged facets, still one editable roof
  assert(rendered.meshes.every(m => m.userData.semanticRoof === true && m.userData.objectInstanceId === "roof-fixture"));
  assert(rendered.meshes.every(m => m.userData.existingLod2Roof === true));
  assert.equal(`#${((rendered.meshes[0]!.material as any).color.getHexString())}`, LOD2_EXISTING_ROOF_COLOR);
  rendered.geometries.forEach(g => g.dispose()); rendered.materials.forEach(m => m.dispose());
});

test("solar metadata never changes an untouched LoD2 roof from existing-white to design-red", async () => {
  const calculation = await requestRoofCalculation(buildRoofCalculationRequest(points, parameters));
  const rendered = createRoofCalculationMeshes(calculation, {
    semanticObjectRef: {
      metadata: {
        roofParameters: parameters,
        solar: { moduleId: "pv-module", selectedFaces: ["f1"] },
      },
    },
  });
  assert(rendered.meshes.length > 0);
  assert(rendered.meshes.every(mesh => mesh.userData.existingLod2Roof === true));
  assert.equal(`#${((rendered.meshes[0]!.material as any).color.getHexString())}`, LOD2_EXISTING_ROOF_COLOR);
  rendered.geometries.forEach(g => g.dispose()); rendered.materials.forEach(m => m.dispose());
});

test("slope edit produces new persisted geometry but retains original source", async () => {
  const original = JSON.stringify(source);
  const first = await requestRoofCalculation(buildRoofCalculationRequest(points, parameters));
  const edited = await requestRoofCalculation(buildRoofCalculationRequest(points, {...parameters, pitchDeg: 45}));
  assert.notEqual(first.input_fingerprint, edited.input_fingerprint);
  assert((edited.summary as any).maximum_height_mm > (first.summary as any).maximum_height_mm);
  assert.equal(JSON.stringify(source), original);
  const rendered = createRoofCalculationMeshes(edited, {
    semanticObjectRef: { metadata: { roofParameters: parameters, solar: { selectedFaces: ["f1"] } } },
  });
  assert(rendered.meshes.every(mesh => mesh.userData.existingLod2Roof === false));
  assert.equal((rendered.meshes[0]!.material as any).color.getHex(), 0xb9471c);
  rendered.geometries.forEach(g => g.dispose()); rendered.materials.forEach(m => m.dispose());
  const saved = JSON.parse(JSON.stringify({...parameters, pitchDeg:45}));
  assert.equal(persistedRoofQuickSettings({roofParameters:saved}, parameters).roofType, "imported");
  const reloaded = await requestRoofCalculation(buildRoofCalculationRequest(points, saved));
  assert.deepEqual(reloaded.geometry, edited.geometry);
});

test("courtyard cannot silently become a filled standard roof; invalid sources fail closed", async () => {
  const courtyard = {...source, footprint:[...source.footprint, [[2,2],[6,2],[6,6],[2,6],[2,2]]]};
  await assert.rejects(requestRoofCalculation(buildRoofCalculationRequest(points, {...parameters, importedSource:courtyard, roofType:"gable"})), /Innenhof/);
  await assert.rejects(requestRoofCalculation(buildRoofCalculationRequest(points.slice(0,-1), parameters)), /Dachumriss/);
  assert.equal(importedRoofSource({...source, faces:[{polygon_3d_mm:[[NaN,0,0]]}]}), undefined);
});

test("LoD2 overhang extends only boundary vertices and keeps the source immutable", async () => {
  const original = JSON.stringify(source);
  const calculation = await requestRoofCalculation(buildRoofCalculationRequest(points, {
    ...parameters,
    overhangMm: 500,
    overhangNorthMm: 500,
    overhangEastMm: 500,
    overhangSouthMm: 500,
    overhangWestMm: 500,
  }));
  const vertices = (calculation.geometry as any).faces.flatMap((face:any) => face.polygon_3d_mm);
  assert(Math.min(...vertices.map((point:any) => point[0])) < 0);
  assert(Math.max(...vertices.map((point:any) => point[0])) > 8000);
  assert(Math.min(...vertices.map((point:any) => point[1])) < 0);
  assert(Math.max(...vertices.map((point:any) => point[1])) > 8000);
  assert.equal(JSON.stringify(source), original);
  assert.match(String(calculation.input_fingerprint), /:500$/);
});

test("editable semantic roof footprints retain courtyard rings across load and save", () => {
  const coordinates = [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
  ] as const;
  const rings = polygonAreaRingsFromFootprint({
    type: "Polygon",
    coordinates,
    baseY: 12,
  }, 0);

  assert.equal(rings.length, 2);
  assert(rings.every((ring) => ring.every((point) => point.y === 12)));
  assert.deepEqual(polygonAreaClosedRingCoordinates(rings[0]!, rings.slice(1)), coordinates);
  assert.deepEqual(polygonAreaRingsFromFootprint({
    type: "Polygon",
    coordinates: [coordinates[0].slice(0, 2), coordinates[1]],
  }, 0), []);
});

test("local flat-roof calculation triangulates around courtyards and has a stable persisted version", () => {
  const outerRing = [[0, 0], [10, 0], [10, 10], [0, 10]]
    .map(([x, z]) => ({ x: x!, y: 6, z: z! }));
  const holeRing = [[3, 3], [7, 3], [7, 7], [3, 7]]
    .map(([x, z]) => ({ x: x!, y: 6, z: z! }));
  const calculation = createFlatRoofCalculation(outerRing, 6_000, [holeRing], 240);
  const faces = (calculation.geometry as any).faces as readonly any[];

  assert(faces.length > 1);
  const area = faces.reduce((sum, face) => sum + Number(face.plan_area_m2), 0);
  assert(Math.abs(area - 84) < 1e-7);
  for (const face of faces) {
    const centroidX = face.polygon_3d_mm.reduce((sum: number, point: number[]) => sum + point[0], 0)
      / face.polygon_3d_mm.length / 1_000;
    const centroidZ = face.polygon_3d_mm.reduce((sum: number, point: number[]) => sum + point[1], 0)
      / face.polygon_3d_mm.length / 1_000;
    assert(!(centroidX > 3 && centroidX < 7 && centroidZ > 3 && centroidZ < 7));
  }
  assert.match(String(calculation.input_fingerprint), /^flat-courtyard-v1:/);
  assert.equal(calculation.input_fingerprint,
    createFlatRoofCalculation(outerRing, 6_000, [holeRing], 240).input_fingerprint);
  assert.notEqual(calculation.input_fingerprint,
    createFlatRoofCalculation(outerRing, 6_000, [], 240).input_fingerprint);
  assert.equal((calculation.structure as any).bearing_model.purlin_vertical_reference, "roof_zone_top");
  assert.equal((calculation.roof_build_up as any).layers[0].thickness_mm, 240);
});
