import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { buildLod2Mesh, createLod2BuildingScene, triangulateLod2Polygon } from "../src/frontend/render/lod2_building_scene";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { createGeodataOverlayScene } from "../src/frontend/render/geodata_overlay_scene";
import { resolveVisualLayer } from "../src/frontend/render/visual_layer_resolver";
import {
  LOD2_EXISTING_ROOF_COLOR,
  LOD2_EXISTING_WALL_COLOR,
} from "../src/frontend/scene/lod2_existing_appearance";

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

test("raw LoD2 fallback renders untouched roof and wall surfaces in existing-building whites", () => {
  const roofRing = [[0, 2, 0], [2, 2, 0], [2, 2, 2], [0, 2, 2], [0, 2, 0]];
  const wallRing = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0], [0, 0, 0]];
  const mesh = buildLod2Mesh({ id: "appearance", polygons: [
    { surface: "RoofSurface", rings: [roofRing] },
    { surface: "WallSurface", rings: [wallRing] },
  ] })!;
  const colors = mesh.geometry.getAttribute("color");
  const roofVertexCount = triangulateLod2Polygon([roofRing.slice(0, -1) as any]).length * 3;
  const roofColor = new THREE.Color(LOD2_EXISTING_ROOF_COLOR);
  const wallColor = new THREE.Color(LOD2_EXISTING_WALL_COLOR);
  assert(colors.count > roofVertexCount);
  assert.equal(new THREE.Color(colors.getX(0), colors.getY(0), colors.getZ(0)).getHexString(),roofColor.getHexString());
  assert.equal(new THREE.Color(
    colors.getX(roofVertexCount),
    colors.getY(roofVertexCount),
    colors.getZ(roofVertexCount),
  ).getHexString(),wallColor.getHexString());
  mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
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
  assert.equal(scene.getVisualLayerResolutions()["0:0:0"].selectedKind, "lod2");
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

test("visual resolver keeps licensed LoD2 visible while photorealistic is locked", () => {
  const contract = {
    schemaVersion: "geodata-overlays.v1",
    items: [{
      id: "lod2-tile", datasetId: "3d-gebaeudedaten", renderMode: "building-meshes",
      source: { lod: 2, license: "dl-de-zero-2.0" },
    }],
    visualLayerResolution: {
      schemaVersion: "geodata-visual-layer-resolution.v1",
      policy: "photorealistic-lod3-lod2.v1",
      selected: { kind: "lod2", itemIds: ["lod2-tile"] },
      layers: [
        { kind: "photorealistic", datasetId: "3d-reality-mesh", priority: 300, enabled: false,
          status: "license_required", itemIds: [], provenance: { licenseState: "license_required" } },
        { kind: "lod3", datasetId: "3d-gebaeudedaten", priority: 200, enabled: true,
          status: "unavailable", itemIds: [], provenance: {} },
        { kind: "lod2", datasetId: "3d-gebaeudedaten", priority: 100, enabled: true,
          status: "ready", itemIds: ["lod2-tile"], provenance: { source: "Berlin LoD2" } },
      ],
    },
  };
  const resolved = resolveVisualLayer(contract);
  assert.equal(resolved.source, "server");
  assert.equal(resolved.selectedKind, "lod2");
  assert.equal(resolved.fallbackUsed, true);
  assert.equal(resolved.layers[0].status, "license_required");
  assert.deepEqual(resolved.layers[2].provenance, { source: "Berlin LoD2" });
});

test("editor falls through unsupported or locked layers in declared priority order", () => {
  const contract = {
    items: [
      { id: "photo", datasetId: "3d-reality-mesh", renderMode: "textured-mesh-tile" },
      { id: "lod3", datasetId: "3d-gebaeudedaten", renderMode: "building-meshes", source: { lod: 3 } },
      { id: "lod2", datasetId: "3d-gebaeudedaten", renderMode: "building-meshes", source: { lod: 2 } },
    ],
    visualLayerResolution: {
      schemaVersion: "geodata-visual-layer-resolution.v1",
      selected: { kind: "lod3" },
      layers: [
        { kind: "photorealistic", priority: 300, enabled: false, status: "license_required", itemIds: ["photo"] },
        { kind: "lod3", priority: 200, enabled: true, status: "ready", itemIds: ["lod3"] },
        { kind: "lod2", priority: 100, enabled: true, status: "ready", itemIds: ["lod2"] },
      ],
    },
  };
  assert.equal(resolveVisualLayer(contract).selectedKind, "lod3");
  assert.equal(resolveVisualLayer(contract, ["lod2"]).selectedKind, "lod2");
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
