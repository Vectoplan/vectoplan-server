import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_VISIBLE_CHUNK_RADIUS, DEFAULT_CHUNK_SERVICE_MAX_LOADED_CHUNKS } from "../src/frontend/bootstrap/bootstrap_models";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { createChunkRegistry } from "../src/frontend/runtime/world/chunk_registry";
import { createChunkLoader } from "../src/frontend/runtime/world/chunk_loader";
import type { ChunkSource } from "../src/frontend/runtime/world/chunk_source";
import { visibleChunkCoordinatesAround, type ChunkCoordinates } from "../src/frontend/runtime/world/chunk_coordinates";
import { configuredStreamingRadius, retainedSurfaceChunkKeys, streamingCoordinateBudget } from "../src/frontend/scene/chunk_streaming_policy";

const center = { chunkX: 0, chunkY: 0, chunkZ: 0 };
function chunk(coordinate: ChunkCoordinates, metadata: Record<string, unknown> = {}) {
  const { chunkX, chunkY, chunkZ } = coordinate;
  const result = normalizeChunkApiBatchResult({ ok: true, chunks: [{ chunk: {
    projectId: "streaming-test", worldId: "earth", chunkKey: `${chunkX}:${chunkY}:${chunkZ}`,
    ...coordinate, chunkSize: 16, cellSize: 1, cells: Array(4096).fill(0), palette: [],
    source: "snapshot", metadata,
  } }] }, null, { projectId: "streaming-test", worldId: "earth", requestedChunks: [coordinate] });
  assert(result.ok);
  return createRuntimeChunkContent(result.chunks[0]!);
}
function fixtureLoader() {
  const registry = createChunkRegistry({ maxChunks: 2048 });
  const batches: readonly ChunkCoordinates[][] = [];
  const mutableBatches = batches as ChunkCoordinates[][];
  const source = {
    getRegistry: () => registry,
    getLoadedChunkKeys: () => registry.getChunkKeys(),
    getChunk: (key: string) => registry.getChunk(key),
    getLifecycleState: () => ({ status: "ready" }),
    loadChunks: async (coordinates: ChunkCoordinates[]) => {
      mutableBatches.push(coordinates);
      const chunks = coordinates.map((coordinate) => chunk(coordinate));
      registry.setChunks(chunks);
      return { chunks, result: null, failed: [], fromCacheCount: 0 };
    },
  } as unknown as ChunkSource;
  return { registry, batches, loader: createChunkLoader({ source, maxRadius: 16, verticalRadius: 0, maxChunksPerLoad: 256 }) };
}

test("actual deployment defaults expose 224 m and a matching registry budget", () => {
  const compose = readFileSync("../../docker-compose.yml", "utf8");
  const defaults = readFileSync("src/bootstrap/defaults.py", "utf8");
  const radius = Number(compose.match(/CHUNKS_VIEW_DISTANCE:-([0-9]+)/)?.[1]);
  const capacity = Number(compose.match(/CHUNKS_MAX_LOADED_CHUNKS:-([0-9]+)/)?.[1]);
  assert.equal(radius, 14);
  assert.equal(capacity, 2048);
  assert.equal(DEFAULT_VISIBLE_CHUNK_RADIUS, radius);
  assert.equal(DEFAULT_CHUNK_SERVICE_MAX_LOADED_CHUNKS, capacity);
  assert.match(defaults, /DEFAULT_CHUNKS_VIEW_DISTANCE: Final\[int\] = 14/);
  assert.equal(configuredStreamingRadius(radius, capacity), 14);
  assert.equal(configuredStreamingRadius(14, 512), 7, "explicit low-memory configuration stays within its working budget");
});

test("movement can interrupt distant work after a small batch and resume without reloading completed chunks", async () => {
  const { registry, loader, batches } = fixtureLoader();
  const options = { maxChunks: streamingCoordinateBudget(14, true), batchSize: 12, markVisible: true };
  await loader.loadAroundChunk(center, 14, { ...options, shouldContinue: () => batches.length < 2 });
  assert.equal(registry.getChunkKeys().length, 24);
  assert.equal(registry.getVisibleChunkKeys().length, 24);
  await loader.loadAroundChunk(center, 14, options);
  assert.equal(registry.getVisibleChunkKeys().length, 613);
  assert.equal(batches.reduce((sum, batch) => sum + batch.length, 0), 613);
  loader.destroy();
});

test("requested radius 14 produces 613 surface columns without the old hidden radius-eight cap", () => {
  const coordinates = visibleChunkCoordinatesAround(center, 14, { radial: true, verticalRadius: 0 });
  assert.equal(coordinates.length, 613);
  assert(coordinates.some((coordinate) => coordinate.chunkX === 14));
  assert(coordinates.every((coordinate) => coordinate.chunkY === 0));
  assert.equal(streamingCoordinateBudget(14, true), coordinates.length);
  assert.equal(streamingCoordinateBudget(14, false), 639, "underground detail remains a small local reserve");
});

test("startup and camera movement retain the entire distant ring in 12-chunk near-first batches", async () => {
  const { registry, loader, batches } = fixtureLoader();
  const loadOptions = { maxChunks: streamingCoordinateBudget(14, true), batchSize: 12, markVisible: true };
  const initial = await loader.loadAroundChunk(center, 14, loadOptions);
  assert(initial.ok);
  assert.equal(registry.getVisibleChunkKeys().length, 613);
  assert(batches.every((batch) => batch.length <= 12));
  assert(batches[0]!.every((coordinate) => Math.hypot(coordinate.chunkX, coordinate.chunkZ) <= 2));
  assert(registry.hasChunk("14:0:0"));
  const initialBatchCount = batches.length;
  const moved = { ...center, chunkX: 1 };
  const retained = retainedSurfaceChunkKeys(registry.getChunkKeys().map((key) => registry.getChunk(key)!), new Set(registry.getVisibleChunkKeys()), moved, 14);
  const afterMovement = await loader.loadAroundChunk(moved, 14, { ...loadOptions, retainVisibleChunkKeys: retained });
  assert(afterMovement.ok);
  assert(registry.hasChunk("15:0:0"));
  assert(registry.getVisibleChunkKeys().includes("-14:0:0"), "old boundary stays visible for one chunk of backtracking");
  assert(registry.getVisibleChunkKeys().length >= 613, "movement must not truncate the ring to the HTTP budget256");
  const additionalDownloads = batches.slice(initialBatchCount).reduce((sum, batch) => sum + batch.length, 0);
  assert.equal(additionalDownloads, 29, "crossing a chunk boundary downloads only its new crescent");
  loader.destroy();
});

test("cached visibility changes retain upper floors and distant roof anchors, then release them outside the reserve", async () => {
  const { registry, loader } = fixtureLoader();
  const roofCoordinate = { chunkX: 22, chunkY: 3, chunkZ: 0 };
  const ground = chunk({ chunkX: 13, chunkY: 0, chunkZ: 0 }, {
    structureStreaming: { schemaVersion: "structure-streaming.v1", chunkCoordinates: [roofCoordinate] },
  });
  const roof = chunk(roofCoordinate);
  const upper = chunk({ chunkX: 13, chunkY: 2, chunkZ: 0 });
  registry.setChunks([ground, roof, upper, chunk(center)]);
  registry.setVisibleChunkKeys([ground.chunkKey, roof.chunkKey, upper.chunkKey]);
  const retained = retainedSurfaceChunkKeys(registry.getChunkKeys().map((key) => registry.getChunk(key)!), new Set(registry.getVisibleChunkKeys()), center, 14);
  assert(retained.includes(roof.chunkKey));
  assert(retained.includes(upper.chunkKey));
  await loader.loadAroundChunk(center, 0, { markVisible: true, retainVisibleChunkKeys: retained });
  assert(registry.getVisibleChunkKeys().includes(roof.chunkKey), "cached loader path must preserve anchors too");
  const departed = retainedSurfaceChunkKeys(registry.getChunkKeys().map((key) => registry.getChunk(key)!), new Set(registry.getVisibleChunkKeys()), { ...center, chunkX: -4 }, 14);
  assert(!departed.includes(roof.chunkKey));
  assert(!departed.includes(upper.chunkKey));
  loader.destroy();
});
