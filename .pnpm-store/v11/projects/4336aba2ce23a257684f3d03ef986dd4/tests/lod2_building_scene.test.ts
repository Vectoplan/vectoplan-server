import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { buildLod2Mesh, createLod2BuildingScene, triangulateLod2Polygon } from "../src/frontend/render/lod2_building_scene";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { createGeodataOverlayScene } from "../src/frontend/render/geodata_overlay_scene";

const roof = [[0, 10, 0], [10, 10, 0], [10, 10, 10], [0, 10, 10]] as const;
const hole = [[3, 10, 3], [7, 10, 3], [7, 10, 7], [3, 10, 7]] as const;
const feature = { id: "berlin-1", sourceTile: "LoD2_391_5820.zip", sourceSha256: "source-v1",
  polygons: [{ surface: "RoofSurface", rings: [[...roof, roof[0]], [...hole, hole[0]]] }] };
function area(triangles: readonly (readonly (readonly number[])[])[]) {
  return triangles.reduce((sum, triangle) => sum + new THREE.Vector3(...triangle[1]).sub(new THREE.Vector3(...triangle[0]))
    .cross(new THREE.Vector3(...triangle[2]).sub(new THREE.Vector3(...triangle[0]))).length() / 2, 0);
}

test("roof courtyard remains a hole, not a filled triangle fan", () => {
  assert.equal(area(triangulateLod2Polygon([roof, hole])), 84);
});

test("vertical wall and sloped roofs have their true 3D area", () => {
  assert.equal(area(triangulateLod2Polygon([[[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0]]])), 80);
  assert.ok(Math.abs(area(triangulateLod2Polygon([[[0, 0, 0], [10, 0, 0], [10, 5, 10], [0, 5, 10]]])) - Math.sqrt(125) * 10) < 1e-8);
});

test("concave face, degenerate face and invalid geometry", () => {
  assert.equal(area(triangulateLod2Polygon([[[0, 0, 0], [4, 0, 0], [4, 0, 1], [1, 0, 1], [1, 0, 4], [0, 0, 4]]])), 7);
  assert.deepEqual(triangulateLod2Polygon([[[0, 0, 0], [1, 0, 0], [2, 0, 0]]]), []);
  assert.equal(buildLod2Mesh({ ...feature, polygons: [{ rings: [[[NaN, 0, 0]]] }] }), null);
  const mesh = buildLod2Mesh(feature)!;
  assert.equal(mesh.position.y, 10);
  assert.equal(mesh.userData.affectsVoxelState, false);
  assert.equal(mesh.userData.affectsCollision, false);
});

test("building is deduplicated, retained, updated and disposed with visible chunks", () => {
  const parent = new THREE.Group();
  const scene = createLod2BuildingScene(parent);
  const contract = { schemaVersion: "geodata-overlays.v1", referenceFingerprint: "frame", items: [{
    datasetId: "3d-gebaeudedaten", renderMode: "building-meshes", heightReference: { anchorElevationM: 30 },
    geometry: { type: "BuildingMultiSurface", dimensions: "world-xyz", features: [feature] },
  }] };
  let keys = ["0:0:0", "0:1:0", "1:0:0"];
  const registry = { getVisibleChunkKeys: () => keys, getChunk: () => ({ raw: { metadata: { geodataOverlays: contract } } }) } as any;
  assert.equal(scene.sync(registry).buildingCount, 1);
  const mesh = scene.getGroup().children[0] as THREE.Mesh;
  assert.equal(scene.sync(registry).buildingCount, 1);
  assert.equal(scene.getGroup().children[0], mesh);
  keys = ["1:0:0"];
  scene.sync(registry);
  assert.equal(scene.getGroup().children[0], mesh);
  let disposed = 0;
  mesh.geometry.addEventListener("dispose", () => disposed++);
  contract.items[0].heightReference.anchorElevationM = 31;
  scene.sync(registry);
  assert.equal(disposed, 1);
  assert.notEqual(scene.getGroup().children[0], mesh);
  keys = [];
  assert.equal(scene.sync(registry).buildingCount, 0);
  assert.equal(scene.getGroup().children.length, 0);
  scene.dispose();
  assert.equal(parent.children.length, 0);
});

test("normal API batch preserves LoD2 metadata and renders buildings alongside parcel lines", () => {
  const cells = Array.from({ length: 16 ** 3 }, (_, index) => Math.floor(index / 16) % 16 === 0 ? 1 : 0);
  const raw = { ok: true, projectId: "test", worldId: "world_spawn", chunks: [{ chunk: {
    projectId: "test", worldId: "world_spawn", chunkX: 0, chunkY: 0, chunkZ: 0, chunkSize: 16, cells,
    palette: [{ blockTypeId: "system_terrain", cellValue: 1, solid: true }], stats: {},
    metadata: { geodataOverlays: { schemaVersion: "geodata-overlays.v1", referenceFingerprint: "frame", items: [
      { id: "parcels", datasetId: "flurstuecke", tileKey: "0:0", renderMode: "surface-lines",
        geometry: { dimensions: "world-xz", coordinates: [[[1, 1], [10, 1]]] } },
      { id: "lod2", datasetId: "3d-gebaeudedaten", renderMode: "building-meshes",
        geometry: { type: "BuildingMultiSurface", dimensions: "world-xyz", features: [feature] } },
    ] } },
  } }] };
  const normalized = normalizeChunkApiBatchResult(raw, null, { projectId: "test", worldId: "world_spawn",
    requestedChunks: [{ chunkX: 0, chunkY: 0, chunkZ: 0 }] });
  assert.equal(normalized.ok, true);
  const chunk = createRuntimeChunkContent(normalized.chunks[0]);
  const registry = { getVisibleChunkKeys: () => ["0:0:0"], getChunk: () => chunk, hasChunk: () => true } as any;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });
  const stats = scene.syncFromRegistry(registry);
  assert.equal(stats.overlayCount, 2);
  assert.equal(stats.buildingCount, 1);
  assert.ok(stats.renderedSegmentCount > 0);
  const mesh = scene.getGroup().getObjectByName("lod2_berlin-1");
  assert.ok(mesh);
  assert.ok(scene.getGroup().getObjectByName("geodata_overlay_parcels"));
  assert.equal(scene.getGroup().userData.surfaceCellY.get("1:1"), 1);
  assert.equal(scene.syncFromRegistry(registry).buildingCount, 1);
  assert.equal(scene.getGroup().getObjectByName("lod2_berlin-1"), mesh);
  scene.dispose();
  assert.equal(scene.getGroup().children.length, 0);
});
