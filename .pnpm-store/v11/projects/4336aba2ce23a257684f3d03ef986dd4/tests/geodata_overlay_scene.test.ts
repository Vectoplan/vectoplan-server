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
): RuntimeChunkContent {
  const terrainEntry = {
    cellValue: 1,
    blockTypeId: "system_terrain_test",
    solid: true,
    metadata: { role: "terrain" },
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
    palette: [terrainEntry],
    paletteByCellValue: new Map([[1, terrainEntry]]),
    paletteByBlockTypeId: new Map([[terrainEntry.blockTypeId, terrainEntry]]),
    stats: {
      cellCount: cells.length,
      airCellCount: cells.filter((value) => value === 0).length,
      nonAirCellCount: cells.filter((value) => value !== 0).length,
      solidCellCount: cells.filter((value) => value !== 0).length,
      nonSolidCellCount: 0,
      paletteBlockCount: 1,
      uniqueCellValues: [0, 1],
    },
    source: "snapshot",
    snapshotId: "snapshot",
    chunkRevision: 1,
    chunkVersion: "version",
    loadedAt,
    raw: { metadata: {} },
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
