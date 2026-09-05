import { DEFAULT_VISIBLE_CHUNK_RADIUS } from "../bootstrap/bootstrap_models";
import type { ChunkCoordinates } from "../runtime/world/chunk_coordinates";
import type { RuntimeChunkContent } from "../runtime/world/chunk_content";
import { additionalSurfaceChunkCoordinates } from "./structure_streaming";

const HORIZONTAL_CHUNK_COUNTS = Array.from({ length: 17 }, (_, radius) => {
  let count = 0;
  for (let x = -radius; x <= radius; x += 1) {
    for (let z = -radius; z <= radius; z += 1) {
      if (x * x + z * z <= radius * radius) count += 1;
    }
  }
  return count;
});

/** A horizontal surface circle plus a small local underground reserve, never a 3D cube. */
export function streamingCoordinateBudget(radius: number, earthTerrain: boolean): number {
  const safeRadius = Math.max(0, Math.min(16, Math.trunc(radius)));
  return HORIZONTAL_CHUNK_COUNTS[safeRadius]!
    + (earthTerrain || safeRadius === 0 ? 0 : safeRadius === 1 ? 10 : 26);
}

/** Reserve room for surface layers, structures and a directional loading buffer. */
export function configuredStreamingRadius(requested: unknown, maxLoadedChunks: unknown): number {
  let radius = typeof requested === "number" && Number.isFinite(requested)
    ? Math.max(0, Math.min(16, Math.trunc(requested)))
    : DEFAULT_VISIBLE_CHUNK_RADIUS;
  const capacity = typeof maxLoadedChunks === "number" && Number.isFinite(maxLoadedChunks)
    ? Math.max(128, maxLoadedChunks)
    : 2048;
  while (radius > 0 && streamingCoordinateBudget(radius, true) * 2 + 128 > capacity) radius -= 1;
  return radius;
}

/** Keep the previous boundary for one chunk of travel and keep its complete buildings.
 * Loading the next surface circle must not briefly remove upper floors/roof anchors.
 */
export function retainedSurfaceChunkKeys(
  loaded: readonly RuntimeChunkContent[],
  previouslyVisible: ReadonlySet<string>,
  center: ChunkCoordinates,
  visibleRadius: number,
): readonly string[] {
  const retentionDistanceSquared = (visibleRadius + 1) ** 2;
  const retained = loaded.filter((chunk) => previouslyVisible.has(chunk.chunkKey)
    && (chunk.chunkX - center.chunkX) ** 2 + (chunk.chunkZ - center.chunkZ) ** 2 <= retentionDistanceSquared);
  const loadedKeys = new Set(loaded.map((chunk) => chunk.chunkKey));
  const keys = new Set(retained.map((chunk) => chunk.chunkKey));
  for (const coordinate of additionalSurfaceChunkCoordinates(retained, center)) {
    const key = `${coordinate.chunkX}:${coordinate.chunkY}:${coordinate.chunkZ}`;
    if (loadedKeys.has(key)) keys.add(key);
  }
  return [...keys];
}
