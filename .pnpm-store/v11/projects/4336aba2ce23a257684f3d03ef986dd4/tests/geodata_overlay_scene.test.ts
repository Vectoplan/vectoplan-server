import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import { createGeodataOverlayScene } from "../src/frontend/render/geodata_overlay_scene";
import type { RuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import type { ChunkRegistryHandle } from "../src/frontend/runtime/world/chunk_registry";

function createChunk(
  loadedAt: string,
  cells: readonly number[],
  chunkX = 0,
  metadata: Record<string, unknown> = {},
): RuntimeChunkContent {
  const terrainEntry = {
    cellValue: 1,
    blockTypeId: "system_terrain_test",
    solid: true,
    metadata: { role: "terrain" },
  };
  const structureEntry = {
    cellValue: 2,
    blockTypeId: "lod2_exterior_wall",
    solid: true,
    metadata: { role: "building-wall" },
  };
  return {
    kind: "runtime-chunk-content.v1",
    projectId: "project",
    universeId: "universe",
    worldId: "world",
    chunkKey: `${chunkX}:0:0`,
    chunkX,
    chunkY: 0,
    chunkZ: 0,
    chunkSize: 2,
    cellSize: 1,
    cells,
    palette: [terrainEntry, structureEntry],
    paletteByCellValue: new Map([[1, terrainEntry], [2, structureEntry]]),
    paletteByBlockTypeId: new Map([
      [terrainEntry.blockTypeId, terrainEntry],
      [structureEntry.blockTypeId, structureEntry],
    ]),
    stats: {
      cellCount: cells.length,
      airCellCount: cells.filter((value) => value === 0).length,
      nonAirCellCount: cells.filter((value) => value !== 0).length,
      solidCellCount: cells.filter((value) => value !== 0).length,
      nonSolidCellCount: 0,
      paletteBlockCount: 2,
      uniqueCellValues: [...new Set(cells)],
    },
    source: "snapshot",
    snapshotId: "snapshot",
    chunkRevision: 1,
    chunkVersion: "version",
    loadedAt,
    raw: { metadata },
  } as unknown as RuntimeChunkContent;
}

test("reuses unchanged surface data and recomputes only after a chunk revision change", () => {
  const parent = new THREE.Group();
  let chunk = createChunk("first", [1, 0, 0, 0, 0, 0, 0, 0]);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent });

  scene.syncFromRegistry(registry, "initial");
  const firstSurface = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;
  assert.equal(firstSurface.get("0:0"), 1);

  scene.syncFromRegistry(registry, "unchanged");
  assert.equal(scene.getGroup().userData.surfaceCellY, firstSurface);

  chunk = createChunk("second", [0, 0, 1, 0, 0, 0, 0, 0]);
  scene.syncFromRegistry(registry, "changed");
  const changedSurface = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;
  assert.notEqual(changedSurface, firstSurface);
  assert.equal(changedSurface.get("0:0"), 2);

  scene.dispose("test-complete");
});

test("rescans only the visible chunk whose content revision changed", () => {
  function countingCells(values: readonly number[]) {
    let reads = 0;
    const cells = new Proxy([...values], {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/.test(property)) reads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    return { cells, reads: () => reads };
  }

  const firstCells = countingCells([1, 0, 0, 0, 0, 0, 0, 0]);
  const secondCells = countingCells([1, 0, 0, 0, 0, 0, 0, 0]);
  const chunks = new Map<string, RuntimeChunkContent>([
    ["0:0:0", createChunk("first-a", firstCells.cells, 0)],
    ["1:0:0", createChunk("first-b", secondCells.cells, 1)],
  ]);
  const registry = {
    getVisibleChunkKeys: () => [...chunks.keys()],
    getChunk: (key: string) => chunks.get(key) ?? null,
    hasChunk: (key: string) => chunks.has(key),
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  scene.syncFromRegistry(registry, "initial");
  const firstChunkReadsAfterInitialSync = firstCells.reads();
  assert.ok(firstChunkReadsAfterInitialSync > 0);
  assert.ok(secondCells.reads() > 0);

  const changedSecondCells = countingCells([0, 0, 1, 0, 0, 0, 0, 0]);
  chunks.set("1:0:0", createChunk("second-b", changedSecondCells.cells, 1));
  scene.syncFromRegistry(registry, "one-chunk-changed");

  assert.equal(firstCells.reads(), firstChunkReadsAfterInitialSync);
  assert.ok(changedSecondCells.reads() > 0);
  scene.dispose("test-complete");
});

test("uses the lowest solid top as ground fallback instead of draping roads over roofs", () => {
  const chunk = createChunk("building-column", [2, 0, 2, 0, 0, 0, 0, 0]);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  scene.syncFromRegistry(registry, "building-column-fallback");
  const surface = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;

  assert.equal(surface.get("0:0"), 1);
  scene.dispose("test-complete");
});

test("renders street centerlines as visible surface ribbons without changing voxel state", () => {
  const metadata = {
    geodataOverlays: {
      schemaVersion: "geodata-overlays.v1",
      items: [{
        id: "street-network",
        datasetId: "strassendaten",
        label: "Strassen- und Wegenetz",
        releaseKey: "live:public:public:strassendaten",
        tileKey: "0:0",
        renderMode: "surface-ribbons",
        semanticRole: "street-network",
        classificationSource: true,
        style: {
          color: "#6f7782",
          opacity: 1,
          lineWidth: 1,
          surfaceWidth: 1.5,
          verticalOffset: 0.025,
          sampleStep: 0.25,
        },
        geometry: {
          type: "MultiLineString",
          dimensions: "world-xz",
          coordinates: [[[0.1, 0.25], [1.75, 0.25]]],
        },
      }],
    },
  };
  const chunk = createChunk("street", [1, 1, 1, 1, 0, 0, 0, 0], 0, metadata);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  const stats = scene.syncFromRegistry(registry, "street-ribbon");
  const road = scene.getGroup().getObjectByName("geodata_overlay_street-network");

  assert.ok(road instanceof THREE.Mesh);
  assert.equal(road.userData.semanticRole, "street-network");
  assert.equal(road.userData.affectsVoxelState, false);
  assert.ok(stats.renderedSegmentCount > 0);
  const casing = scene.getGroup().getObjectByName("geodata_overlay_street-network_casing");
  assert.ok(casing instanceof THREE.Mesh);
  assert.equal((road.material as THREE.MeshBasicMaterial).transparent, false);
  assert.equal((road.material as THREE.MeshBasicMaterial).depthWrite, true);
  assert.equal((road.material as THREE.MeshBasicMaterial).color.getHexString(), "fbfcfd");
  assert.equal((casing.material as THREE.MeshBasicMaterial).color.getHexString(), "cbd2d9");
  assert.equal(stats.objectCount, 2);
  scene.dispose("test-complete");
});

test("clamps a nominal six metre road ribbon to the closest parcel boundaries", () => {
  const metadata = {
    geodataOverlays: {
      schemaVersion: "geodata-overlays.v1",
      items: [{
        id: "parcel-boundaries",
        datasetId: "flurstuecke",
        label: "Flurstuecksgrenzen",
        releaseKey: "live:parcels",
        tileKey: "0:0",
        renderMode: "surface-lines",
        semanticRole: "parcel-boundary",
        classificationSource: false,
        style: { color: "#1687ff", opacity: 1, lineWidth: 1, verticalOffset: 0.015, sampleStep: 0.25 },
        geometry: {
          type: "MultiLineString",
          dimensions: "world-xz",
          coordinates: [
            [[0, 0], [2, 0]],
            [[0, 0.5], [2, 0.5]],
          ],
        },
      }, {
        id: "street-network",
        datasetId: "strassendaten",
        label: "Strassen- und Wegenetz",
        releaseKey: "live:streets",
        tileKey: "0:0",
        renderMode: "surface-ribbons",
        semanticRole: "street-network",
        classificationSource: true,
        style: { color: "#6f7782", opacity: 1, lineWidth: 1, surfaceWidth: 12, verticalOffset: 0.03, sampleStep: 0.25 },
        geometry: {
          type: "MultiLineString",
          dimensions: "world-xz",
          coordinates: [[[0.1, 0.25], [1.75, 0.25]]],
        },
      }],
    },
  };
  const chunk = createChunk("narrow-street", [1, 1, 1, 1, 0, 0, 0, 0], 0, metadata);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  scene.syncFromRegistry(registry, "narrow-street");
  const road = scene.getGroup().getObjectByName("geodata_overlay_street-network") as THREE.Mesh;
  const casing = scene.getGroup().getObjectByName("geodata_overlay_street-network_casing") as THREE.Mesh;
  const positions = casing.geometry.getAttribute("position") as THREE.BufferAttribute;
  const zValues = Array.from({ length: positions.count }, (_, index) => positions.getZ(index));

  assert.ok(road instanceof THREE.Mesh);
  assert.ok(casing instanceof THREE.Mesh);
  assert.equal((road.material as THREE.MeshBasicMaterial).color.getHexString(), "fbfcfd");
  assert.ok(Math.max(...zValues) - Math.min(...zValues) <= 0.501);
  scene.dispose("test-complete");
});
