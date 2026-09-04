import assert from "node:assert/strict";
import test from "node:test";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS, requestRoofCalculation } from "../src/frontend/world_edit/systems/roof/contracts";
import { importedRoofSource, type ImportedRoofSource } from "../src/frontend/world_edit/systems/roof/imported";
import { restoreImportedRoofOriginal } from "../src/frontend/world_edit/systems/roof/restoration";
import { createRoofCalculationMeshes } from "../src/frontend/scene/roof_calculation_rendering";
import {
  LOD2_EXISTING_ROOF_COLOR,
  isUnmodifiedLod2RoofCalculation,
} from "../src/frontend/scene/lod2_existing_appearance";
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

test("LoD2 restore resets every geometry-changing value to the immutable survey source", async () => {
  const edited = {
    ...parameters,
    roofType: "gable" as const,
    pitchDeg: 62,
    eavesHeightMm: 12_345,
    ridgeDirection: 71,
    overhangMm: 900,
    overhangNorthMm: 100,
    overhangEastMm: 200,
    overhangSouthMm: 300,
    overhangWestMm: 400,
    edgeOverhangsMm: [100, 200, 300, 400],
  };

  const restored = restoreImportedRoofOriginal(edited);

  assert.equal(restored.roofType, "imported");
  assert.equal(restored.pitchDeg, source.referencePitchDeg);
  assert.equal(restored.eavesHeightMm, source.baseY * 1_000);
  assert.equal(restored.ridgeDirection, "auto");
  assert.equal(restored.overhangMm, 0);
  assert.deepEqual([
    restored.overhangNorthMm,
    restored.overhangEastMm,
    restored.overhangSouthMm,
    restored.overhangWestMm,
  ], [0, 0, 0, 0]);
  assert.deepEqual(restored.edgeOverhangsMm, []);
  const calculation = await requestRoofCalculation(buildRoofCalculationRequest(points, restored));
  assert.deepEqual((calculation.geometry as any).faces, source.faces);
  const reloadedParameters = JSON.parse(JSON.stringify(restored));
  const reloaded = await requestRoofCalculation(buildRoofCalculationRequest(points, reloadedParameters));
  assert.deepEqual(reloaded.geometry, calculation.geometry);

  // Re-clicking an already selected LoD2-Original option is a restore as well;
  // legacy records can say `imported` while still carrying edited controls.
  const restoredAgain = restoreImportedRoofOriginal({
    ...edited,
    roofType: "imported",
  });
  assert.equal(restoredAgain.roofType, "imported");
  assert.equal(restoredAgain.pitchDeg, source.referencePitchDeg);
  assert.equal(restoredAgain.eavesHeightMm, source.baseY * 1_000);
  assert.equal(restoredAgain.overhangMm, 0);
  assert.deepEqual(restoredAgain.edgeOverhangsMm, []);
});

test("restored LoD2 preview is neutral-white before persisted semantic metadata arrives", async () => {
  const calculation = await requestRoofCalculation(buildRoofCalculationRequest(points, parameters));
  const rendered = createRoofCalculationMeshes(calculation, { preview: true });

  assert(rendered.meshes.every(mesh => mesh.userData.existingLod2Roof === true));
  assert.equal(`#${((rendered.meshes[0]!.material as any).color.getHexString())}`, LOD2_EXISTING_ROOF_COLOR);
  rendered.geometries.forEach(g => g.dispose()); rendered.materials.forEach(m => m.dispose());
});

test("LoD2 existing appearance is stable across facet and vertex reorderings", async () => {
  const calculation = await requestRoofCalculation(buildRoofCalculationRequest(points, parameters));
  const reordered = structuredClone(calculation) as any;
  reordered.geometry.faces = [...reordered.geometry.faces].reverse().map((face: any, index: number) => ({
    ...face,
    face_ref: `renumbered-${index}`,
    polygon_3d_mm: [
      ...face.polygon_3d_mm.slice(1),
      face.polygon_3d_mm[0],
    ].reverse(),
  }));
  const rendered = createRoofCalculationMeshes(reordered, {
    semanticObjectRef: { metadata: { roofParameters: parameters } },
  });

  assert(rendered.meshes.every(mesh => mesh.userData.existingLod2Roof === true));
  assert.equal(`#${((rendered.meshes[0]!.material as any).color.getHexString())}`, LOD2_EXISTING_ROOF_COLOR);
  rendered.geometries.forEach(g => g.dispose()); rendered.materials.forEach(m => m.dispose());
});

test("large LoD2 facet sets compare by canonical geometry without face-order coupling", () => {
  const faceCount = 4_096;
  const faces = Array.from({ length: faceCount }, (_unused, index) => ({
    face_ref: `source-${index}`,
    polygon_3d_mm: [
      [index * 2, 0, 6_000],
      [index * 2 + 1, 0, 6_000],
      [index * 2, 1, 6_001],
    ],
  }));
  const reorderedFaces = [...faces].reverse().map((face, index) => ({
    face_ref: `renumbered-${index}`,
    polygon_3d_mm: [
      face.polygon_3d_mm[1],
      face.polygon_3d_mm[0],
      face.polygon_3d_mm[2],
    ],
  }));
  const calculation = {
    ok: true,
    roof_type: "imported",
    source: "lod2-original-surfaces",
    geometry: { faces: reorderedFaces },
  };

  assert.equal(isUnmodifiedLod2RoofCalculation(calculation, {
    metadata: { roofParameters: { importedSource: { faces } } },
  }), true);
  reorderedFaces[0]!.polygon_3d_mm[0] = [999_999, 999_999, 999_999];
  assert.equal(isUnmodifiedLod2RoofCalculation(calculation, {
    metadata: { roofParameters: { importedSource: { faces } } },
  }), false);
});

test("renumbered LoD2 facets retain tolerance across spatial bucket boundaries", () => {
  const sourceFaces = [{
    face_ref: "source-face",
    polygon_3d_mm: [
      [0.0004, 0, 6_000],
      [1.0004, 0, 6_000],
      [0.0004, 1, 6_001],
    ],
  }];
  const calculatedFaces = [{
    face_ref: "renumbered-face",
    polygon_3d_mm: [
      [1.0013, 0, 6_000],
      [0.0013, 0, 6_000],
      [0.0013, 1, 6_001],
    ],
  }];
  const calculation = {
    ok: true,
    roof_type: "imported",
    source: "lod2-original-surfaces",
    geometry: { faces: calculatedFaces },
  };

  assert.equal(isUnmodifiedLod2RoofCalculation(calculation, {
    metadata: { roofParameters: { importedSource: { faces: sourceFaces } } },
  }), true);
  calculatedFaces[0]!.polygon_3d_mm[0] = [1.00141, 0, 6_000];
  assert.equal(isUnmodifiedLod2RoofCalculation(calculation, {
    metadata: { roofParameters: { importedSource: { faces: sourceFaces } } },
  }), false);
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
