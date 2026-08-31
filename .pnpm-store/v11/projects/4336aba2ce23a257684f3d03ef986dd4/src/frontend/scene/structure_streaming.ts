import type { RuntimeChunkContent } from "../runtime/world/chunk_content";
import type { ChunkCoordinates } from "../runtime/world/chunk_coordinates";

/** Additional visible chunks: actual terrain layers AND persisted structures.
 * A semantic roof's primary chunk can be outside the horizontal view circle;
 * retaining that anchor is necessary while any part of its roof is visible.
 */
export function additionalSurfaceChunkCoordinates(
  chunks: readonly RuntimeChunkContent[],
  center: ChunkCoordinates,
): readonly ChunkCoordinates[] {
  const coordinates = new Map<string, ChunkCoordinates>();
  function add(coordinate: ChunkCoordinates): void {
    coordinates.set(`${coordinate.chunkX}:${coordinate.chunkY}:${coordinate.chunkZ}`, coordinate);
  }
  for (const chunk of chunks) {
    const metadata = chunk.raw.metadata;
    const hint = metadata?.structureStreaming as Record<string, unknown> | undefined;
    if (hint?.schemaVersion === "structure-streaming.v1" && Array.isArray(hint.chunkCoordinates)) {
      for (const value of hint.chunkCoordinates) {
        if (!value || typeof value !== "object") continue;
        const { chunkX, chunkY, chunkZ } = value as ChunkCoordinates;
        if (![chunkX, chunkY, chunkZ].every(Number.isSafeInteger)) continue;
        // The server returns coordinates, never occupancy. Even an all-air
        // snapshot can own a roof, so don't filter by cell count or terrain Y.
        add({ chunkX, chunkY, chunkZ });
      }
    }
    const minimum = chunk.stats.minimumSurfaceY;
    const maximum = chunk.stats.maximumSurfaceY;
    if (typeof minimum !== "number" || !Number.isFinite(minimum)
        || typeof maximum !== "number" || !Number.isFinite(maximum)) continue;
    const lower = Math.max(center.chunkY - 8, Math.floor(Math.min(minimum, maximum) / chunk.chunkSize));
    const upper = Math.min(center.chunkY + 8, Math.floor(Math.max(minimum, maximum) / chunk.chunkSize));
    for (let chunkY = lower; chunkY <= upper; chunkY += 1) {
      if (chunkY !== chunk.chunkY) add({ chunkX: chunk.chunkX, chunkY, chunkZ: chunk.chunkZ });
    }
  }
  return [...coordinates.values()];
}
