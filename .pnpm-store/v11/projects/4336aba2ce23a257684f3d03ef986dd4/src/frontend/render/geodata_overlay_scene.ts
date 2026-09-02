import * as THREE from "three";
import { getChunkCellValue } from "@api/chunk_cell_storage";
import {
  isSolidCellValue,
  type RuntimeChunkContent,
} from "@runtime/world/chunk_content";
import { cellIndexFromLocalCoordinates } from "@runtime/world/chunk_coordinates";
import type { ChunkRegistryHandle } from "@runtime/world/chunk_registry";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { ThreeContextHandle } from "./three_context";
import { createLod2BuildingScene } from "./lod2_building_scene";

const CONTRACT_VERSION = "geodata-overlays.v1" as const;
const SCENE_KIND = "vectoplan-editor-geodata-overlay-scene.v1" as const;
const SNAPSHOT_KIND = "geodata-overlay-scene-snapshot.v1" as const;
const EARTH_GRID_SCHEMA_VERSION = "vectoplan-earth-grid-frame.v1" as const;
const EARTH_GRID_READY_EVENT = "vectoplan-editor:earth-grid-frame-ready" as const;

type PointXZ = readonly [number, number];
type SourceLine = readonly PointXZ[];

interface OverlayStyle {
  readonly color: string;
  readonly opacity: number;
  readonly lineWidth: number;
  readonly surfaceWidth: number;
  readonly verticalOffset: number;
  readonly sampleStep: number;
}

interface OverlayTile {
  readonly id: string;
  readonly datasetId: string;
  readonly label: string;
  readonly releaseKey: string;
  readonly tileKey: string;
  readonly renderMode: "surface-lines" | "surface-ribbons";
  readonly semanticRole: string;
  readonly classificationSource: boolean;
  readonly style: OverlayStyle;
  readonly lines: readonly SourceLine[];
  readonly surfaceWidths: readonly number[];
}

interface BoundarySegmentXZ {
  readonly start: PointXZ;
  readonly end: PointXZ;
}

interface RoadBoundaryIndex {
  readonly bucketSize: number;
  readonly buckets: ReadonlyMap<string, readonly BoundarySegmentXZ[]>;
}

interface ChunkSurfaceCacheEntry {
  readonly revision: string;
  readonly size: number;
  readonly originX: number;
  readonly originZ: number;
  readonly fallbackTops: Float64Array;
  readonly terrainTops: Float64Array;
}

export interface EarthGridFrameContract {
  readonly schemaVersion: typeof EARTH_GRID_SCHEMA_VERSION;
  readonly horizontalMapping: "vectoplan-periodic-equirectangular";
  readonly mappingVersion: "1";
  readonly axisConvention: "x-east-y-up-z-north";
  readonly worldWidthCells: number;
  readonly worldHeightCells: number;
  readonly metersPerCell: number;
  readonly centralMeridianDegrees: number;
  readonly storageOrigin: Readonly<{ x: number; y: number; z: number }>;
}

export interface GeodataOverlaySceneOptions {
  readonly three?: ThreeContextHandle;
  readonly parent?: THREE.Object3D;
  readonly logger?: EditorLogger;
  readonly autoAttachToThreeChunkGroup?: boolean;
}

export interface GeodataOverlaySceneStats {
  readonly buildingCount: number;
  readonly buildingTriangleCount: number;
  readonly invalidBuildingCount: number;
  readonly overlayCount: number;
  readonly tileCount: number;
  readonly sourceLineCount: number;
  readonly renderedSegmentCount: number;
  readonly surfaceCellCount: number;
  readonly objectCount: number;
}

export interface GeodataOverlaySceneSnapshot {
  readonly kind: typeof SNAPSHOT_KIND;
  readonly status: "created" | "ready" | "syncing" | "degraded" | "disposed";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly stats: GeodataOverlaySceneStats;
  readonly lastError: Record<string, unknown> | null;
}

export interface GeodataOverlaySceneHandle {
  readonly kind: typeof SCENE_KIND;
  syncFromRegistry(registry: ChunkRegistryHandle, reason?: string): GeodataOverlaySceneStats;
  getGroup(): THREE.Group;
  getStats(): GeodataOverlaySceneStats;
  getSnapshot(): GeodataOverlaySceneSnapshot;
  dispose(reason?: string): void;
}

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Rendering diagnostics must never break the scene.
  }
}

function logWarn(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.warn?.(message, details);
  } catch {
    // Rendering diagnostics must never break the scene.
  }
}

function finiteNumber(value: unknown): number | null {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
}

function parsePoint(value: unknown): PointXZ | null {
  const items = asArray(value);
  if (items.length < 2) return null;
  const x = finiteNumber(items[0]);
  const z = finiteNumber(items[1]);
  return x === null || z === null ? null : [x, z];
}

function parseLines(value: unknown): readonly SourceLine[] {
  const result: SourceLine[] = [];
  for (const rawLine of asArray(value)) {
    const points = asArray(rawLine)
      .map(parsePoint)
      .filter((point): point is PointXZ => point !== null);
    if (points.length >= 2) result.push(points);
  }
  return result;
}

function parseStyle(value: unknown): OverlayStyle {
  const style = asRecord(value) ?? {};
  return {
    color: safeString(style.color, "#ffd54f"),
    opacity: safeNumber(style.opacity, 0.96, { min: 0, max: 1 }),
    lineWidth: safeNumber(style.lineWidth, 1.5, { min: 0.1, max: 20 }),
    surfaceWidth: safeNumber(style.surfaceWidth, 0, { min: 0, max: 64 }),
    verticalOffset: safeNumber(style.verticalOffset, 0.015, { min: 0.001, max: 2 }),
    sampleStep: safeNumber(style.sampleStep, 0.25, { min: 0.05, max: 2 }),
  };
}

function parseOverlayTile(value: unknown): OverlayTile | null {
  const item = asRecord(value);
  if (!item) return null;
  const renderMode = safeString(item.renderMode, "");
  if (renderMode !== "surface-lines" && renderMode !== "surface-ribbons") return null;
  const geometry = asRecord(item.geometry);
  if (!geometry || safeString(geometry.dimensions, "") !== "world-xz") return null;
  const id = safeString(item.id, "");
  const datasetId = safeString(item.datasetId, "");
  const tileKey = safeString(item.tileKey, "");
  if (!id || !datasetId || !tileKey) return null;
  const semanticRole = safeString(item.semanticRole, "visual-reference");
  const label = safeString(item.label, id);
  const parcelBoundary = `${id} ${datasetId} ${label} ${semanticRole}`.toLowerCase();
  const parsedStyle = parseStyle(item.style);
  const isParcelBoundary = semanticRole === "parcel-boundary"
    || ["parcel", "cadastr", "cadastre", "flurstueck", "grundstueck", "alkis"].some((token) => parcelBoundary.includes(token));
  const isStreet = semanticRole === "street-network";
  const style: OverlayStyle = isParcelBoundary
    ? { ...parsedStyle, color: "#1687ff", opacity: Math.max(parsedStyle.opacity, 0.92) }
    : isStreet
      ? { ...parsedStyle, color: "#fbfcfd", opacity: 1, surfaceWidth: 6 }
    : parsedStyle;
  const lines = parseLines(geometry.coordinates);
  const rawSurfaceWidths = asArray(geometry.surfaceWidths);
  return {
    id,
    datasetId,
    label,
    releaseKey: safeString(item.releaseKey, "unknown-release"),
    tileKey,
    renderMode,
    semanticRole: isParcelBoundary ? "parcel-boundary" : semanticRole,
    classificationSource: item.classificationSource === true,
    style,
    lines,
    surfaceWidths: lines.map((_, index) => safeNumber(
      rawSurfaceWidths[index],
      style.surfaceWidth,
      { min: 0.1, max: 6 },
    )),
  };
}

function overlayTilesFromChunk(chunk: RuntimeChunkContent): readonly OverlayTile[] {
  const metadata = asRecord(chunk.raw.metadata);
  const contract = asRecord(metadata?.geodataOverlays);
  if (!contract || safeString(contract.schemaVersion, "") !== CONTRACT_VERSION) return [];
  return asArray(contract.items)
    .map(parseOverlayTile)
    .filter((item): item is OverlayTile => item !== null);
}

function earthGridFromChunk(chunk: RuntimeChunkContent): EarthGridFrameContract | null {
  const metadata = asRecord(chunk.raw.metadata);
  const contract = asRecord(metadata?.geodataOverlays);
  const value = asRecord(contract?.earthGrid);
  const storageOrigin = asRecord(value?.storageOrigin);
  if (
    safeString(value?.schemaVersion, "") !== EARTH_GRID_SCHEMA_VERSION
    || safeString(value?.horizontalMapping, "") !== "vectoplan-periodic-equirectangular"
    || safeString(value?.mappingVersion, "") !== "1"
    || safeString(value?.axisConvention, "") !== "x-east-y-up-z-north"
  ) return null;
  const worldWidthCells = finiteNumber(value?.worldWidthCells);
  const worldHeightCells = finiteNumber(value?.worldHeightCells);
  const metersPerCell = finiteNumber(value?.metersPerCell);
  const centralMeridianDegrees = finiteNumber(value?.centralMeridianDegrees);
  const originX = finiteNumber(storageOrigin?.x);
  const originY = finiteNumber(storageOrigin?.y);
  const originZ = finiteNumber(storageOrigin?.z);
  if (
    worldWidthCells === null || worldWidthCells <= 0
    || worldHeightCells === null || worldHeightCells <= 0
    || metersPerCell === null || metersPerCell <= 0
    || centralMeridianDegrees === null
    || originX === null || originY === null || originZ === null
  ) return null;
  return {
    schemaVersion: EARTH_GRID_SCHEMA_VERSION,
    horizontalMapping: "vectoplan-periodic-equirectangular",
    mappingVersion: "1",
    axisConvention: "x-east-y-up-z-north",
    worldWidthCells,
    worldHeightCells,
    metersPerCell,
    centralMeridianDegrees,
    storageOrigin: { x: originX, y: originY, z: originZ },
  };
}

function horizontalCellKey(x: number, z: number): string {
  return `${Math.floor(x)}:${Math.floor(z)}`;
}

function chunkSurfaceRevision(chunk: RuntimeChunkContent): string {
  return [
    chunk.loadedAt,
    chunk.chunkRevision ?? "",
    chunk.chunkVersion ?? "",
    chunk.cells.length,
    chunk.palette.length,
  ].join(":");
}

function isTerrainCellValue(cellValue: number, chunk: RuntimeChunkContent): boolean {
  const entry = chunk.paletteByCellValue.get(cellValue);
  if (!entry) return false;
  const blockTypeId = entry.blockTypeId.toLowerCase();
  const role = safeString(entry.metadata.role, "").toLowerCase();
  const category = safeString(entry.metadata.category, "").toLowerCase();
  return blockTypeId.startsWith("system_terrain")
    || role === "terrain"
    || category === "terrain";
}

function buildChunkSurfaceCacheEntry(chunk: RuntimeChunkContent): ChunkSurfaceCacheEntry {
  const size = chunk.chunkSize;
  const originX = chunk.chunkX * size;
  const originY = chunk.chunkY * size;
  const originZ = chunk.chunkZ * size;
  const columnCount = size * size;
  const fallbackTops = new Float64Array(columnCount);
  const terrainTops = new Float64Array(columnCount);
  fallbackTops.fill(Number.NEGATIVE_INFINITY);
  terrainTops.fill(Number.NEGATIVE_INFINITY);

  for (let localZ = 0; localZ < size; localZ += 1) {
    for (let localX = 0; localX < size; localX += 1) {
      const columnIndex = (localZ * size) + localX;
      for (let localY = size - 1; localY >= 0; localY -= 1) {
        const cellIndex = cellIndexFromLocalCoordinates({ localX, localY, localZ }, size);
        const cellValue = getChunkCellValue(chunk.cells, cellIndex);
        if (!isSolidCellValue(cellValue, chunk)) continue;
        const topY = originY + localY + 1;
        // A column without an explicit terrain cell may contain an LoD wall or
        // another raised object.  Using the highest solid cell makes a road
        // climb onto roofs.  The lowest solid top is the conservative ground
        // fallback; an explicit terrain cell still wins below.
        fallbackTops[columnIndex] = Number.isFinite(fallbackTops[columnIndex])
          ? Math.min(fallbackTops[columnIndex], topY)
          : topY;
        if (isTerrainCellValue(cellValue, chunk)) {
          terrainTops[columnIndex] = topY;
          break;
        }
      }
    }
  }

  return {
    revision: chunkSurfaceRevision(chunk),
    size,
    originX,
    originZ,
    fallbackTops,
    terrainTops,
  };
}

function buildVisibleSurfaceMap(
  registry: ChunkRegistryHandle,
  visibleChunkKeys: readonly string[],
  chunkSurfaceCache: Map<string, ChunkSurfaceCacheEntry>,
): ReadonlyMap<string, number> {
  const terrainSurface = new Map<string, number>();
  const fallbackSurface = new Map<string, number>();
  for (const cachedChunkKey of chunkSurfaceCache.keys()) {
    if (!registry.hasChunk(cachedChunkKey)) chunkSurfaceCache.delete(cachedChunkKey);
  }

  for (const chunkKey of visibleChunkKeys) {
    const chunk = registry.getChunk(chunkKey);
    if (!chunk) continue;
    const revision = chunkSurfaceRevision(chunk);
    let cached = chunkSurfaceCache.get(chunkKey);
    if (!cached || cached.revision !== revision) {
      cached = buildChunkSurfaceCacheEntry(chunk);
      chunkSurfaceCache.set(chunkKey, cached);
    }

    for (let localZ = 0; localZ < cached.size; localZ += 1) {
      for (let localX = 0; localX < cached.size; localX += 1) {
        const columnIndex = (localZ * cached.size) + localX;
        const key = `${cached.originX + localX}:${cached.originZ + localZ}`;
        const currentFallback = fallbackSurface.get(key) ?? Number.POSITIVE_INFINITY;
        const currentTerrain = terrainSurface.get(key) ?? Number.NEGATIVE_INFINITY;
        const fallbackTop = cached.fallbackTops[columnIndex] ?? Number.NEGATIVE_INFINITY;
        const terrainTop = cached.terrainTops[columnIndex] ?? Number.NEGATIVE_INFINITY;
        if (Number.isFinite(fallbackTop) && fallbackTop < currentFallback) {
          fallbackSurface.set(key, fallbackTop);
        }
        if (terrainTop > currentTerrain) terrainSurface.set(key, terrainTop);
      }
    }
  }
  const surface = new Map(fallbackSurface);
  for (const [key, topY] of terrainSurface) surface.set(key, topY);
  return surface;
}

function tileIdentity(tile: OverlayTile): string {
  return `${tile.id}:${tile.datasetId}:${tile.releaseKey}:${tile.tileKey}`;
}

function segmentIdentity(
  overlayId: string,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
): string {
  const first = `${Math.round(start[0] * 1000)}:${Math.round(start[1] * 1000)}:${Math.round(start[2] * 1000)}`;
  const second = `${Math.round(end[0] * 1000)}:${Math.round(end[1] * 1000)}:${Math.round(end[2] * 1000)}`;
  return first <= second
    ? `${overlayId}:${first}:${second}`
    : `${overlayId}:${second}:${first}`;
}

const ROAD_BOUNDARY_BUCKET_SIZE = 8;
const ROAD_BOUNDARY_RAY_EPSILON = 0.02;

function buildRoadBoundaryIndex(tiles: Iterable<OverlayTile>): RoadBoundaryIndex | null {
  const bucketSize = ROAD_BOUNDARY_BUCKET_SIZE;
  const mutable = new Map<string, BoundarySegmentXZ[]>();
  const seen = new Set<string>();
  let segmentCount = 0;
  for (const tile of tiles) {
    if (tile.semanticRole !== "parcel-boundary") continue;
    for (const line of tile.lines) {
      for (let index = 1; index < line.length; index += 1) {
        const start = line[index - 1];
        const end = line[index];
        if (Math.hypot(end[0] - start[0], end[1] - start[1]) <= 1e-8) continue;
        const first = `${Math.round(start[0] * 1000)}:${Math.round(start[1] * 1000)}`;
        const second = `${Math.round(end[0] * 1000)}:${Math.round(end[1] * 1000)}`;
        const identity = first <= second ? `${first}:${second}` : `${second}:${first}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        const segment = { start, end } satisfies BoundarySegmentXZ;
        const minimumBucketX = Math.floor(Math.min(start[0], end[0]) / bucketSize);
        const maximumBucketX = Math.floor(Math.max(start[0], end[0]) / bucketSize);
        const minimumBucketZ = Math.floor(Math.min(start[1], end[1]) / bucketSize);
        const maximumBucketZ = Math.floor(Math.max(start[1], end[1]) / bucketSize);
        for (let bucketX = minimumBucketX; bucketX <= maximumBucketX; bucketX += 1) {
          for (let bucketZ = minimumBucketZ; bucketZ <= maximumBucketZ; bucketZ += 1) {
            const key = `${bucketX}:${bucketZ}`;
            const bucket = mutable.get(key) ?? [];
            bucket.push(segment);
            mutable.set(key, bucket);
          }
        }
        segmentCount += 1;
      }
    }
  }
  return segmentCount > 0 ? { bucketSize, buckets: mutable } : null;
}

function nearbyRoadBoundaries(
  index: RoadBoundaryIndex,
  x: number,
  z: number,
  radius: number,
): readonly BoundarySegmentXZ[] {
  const result = new Set<BoundarySegmentXZ>();
  const minimumBucketX = Math.floor((x - radius) / index.bucketSize);
  const maximumBucketX = Math.floor((x + radius) / index.bucketSize);
  const minimumBucketZ = Math.floor((z - radius) / index.bucketSize);
  const maximumBucketZ = Math.floor((z + radius) / index.bucketSize);
  for (let bucketX = minimumBucketX; bucketX <= maximumBucketX; bucketX += 1) {
    for (let bucketZ = minimumBucketZ; bucketZ <= maximumBucketZ; bucketZ += 1) {
      for (const segment of index.buckets.get(`${bucketX}:${bucketZ}`) ?? []) result.add(segment);
    }
  }
  return [...result];
}

function rayBoundaryDistance(
  origin: PointXZ,
  direction: PointXZ,
  segment: BoundarySegmentXZ,
  maximumDistance: number,
): number | null {
  const segmentX = segment.end[0] - segment.start[0];
  const segmentZ = segment.end[1] - segment.start[1];
  const denominator = (direction[0] * segmentZ) - (direction[1] * segmentX);
  if (Math.abs(denominator) <= 1e-9) return null;
  const offsetX = segment.start[0] - origin[0];
  const offsetZ = segment.start[1] - origin[1];
  const distance = ((offsetX * segmentZ) - (offsetZ * segmentX)) / denominator;
  const factor = ((offsetX * direction[1]) - (offsetZ * direction[0])) / denominator;
  return distance > ROAD_BOUNDARY_RAY_EPSILON
    && distance <= maximumDistance + 1e-6
    && factor >= -1e-6
    && factor <= 1 + 1e-6
    ? distance
    : null;
}

/**
 * A road ribbon is symmetric around its source line.  Therefore the usable
 * width is twice the closest known parcel boundary in either normal
 * direction, never the sum of both sides (which would spill when the source
 * line is not perfectly centred in its road parcel).
 */
export function constrainedRoadSurfaceWidth(
  nominalWidth: number,
  point: PointXZ,
  tangent: PointXZ,
  boundaryIndex: RoadBoundaryIndex | null,
): number {
  const safeNominal = Math.max(0.1, Math.min(6, nominalWidth));
  if (!boundaryIndex) return safeNominal;
  const tangentLength = Math.hypot(tangent[0], tangent[1]);
  if (tangentLength <= 1e-9) return safeNominal;
  const maximumHalfWidth = safeNominal / 2;
  const normal: PointXZ = [-tangent[1] / tangentLength, tangent[0] / tangentLength];
  const candidates = nearbyRoadBoundaries(boundaryIndex, point[0], point[1], maximumHalfWidth);
  let constrainedHalfWidth = maximumHalfWidth;
  for (const direction of [normal, [-normal[0], -normal[1]] as PointXZ]) {
    for (const segment of candidates) {
      const distance = rayBoundaryDistance(point, direction, segment, maximumHalfWidth);
      if (distance !== null) constrainedHalfWidth = Math.min(constrainedHalfWidth, distance);
    }
  }
  return Math.max(0.1, Math.min(safeNominal, constrainedHalfWidth * 2));
}

function appendDrapedSourceLine(
  positions: number[],
  emittedSegments: Set<string>,
  tile: OverlayTile,
  line: SourceLine,
  surface: ReadonlyMap<string, number>,
): number {
  let emitted = 0;
  for (let lineIndex = 1; lineIndex < line.length; lineIndex += 1) {
    const start = line[lineIndex - 1];
    const end = line[lineIndex];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(distance / tile.style.sampleStep));
    let previous: readonly [number, number, number] | null = null;

    for (let index = 0; index <= steps; index += 1) {
      const factor = index / steps;
      const x = start[0] + (dx * factor);
      const z = start[1] + (dz * factor);
      const surfaceY = surface.get(horizontalCellKey(x, z));
      const current: readonly [number, number, number] | null = surfaceY === undefined
        ? null
        : [x, surfaceY + tile.style.verticalOffset, z];

      if (previous && current) {
        const identity = segmentIdentity(tile.id, previous, current);
        if (!emittedSegments.has(identity)) {
          emittedSegments.add(identity);
          positions.push(
            previous[0], previous[1], previous[2],
            current[0], current[1], current[2],
          );
          emitted += 1;
        }
      }
      previous = current;
    }
  }
  return emitted;
}

function appendDrapedSourceRibbon(
  positions: number[],
  emittedSegments: Set<string>,
  tile: OverlayTile,
  line: SourceLine,
  surface: ReadonlyMap<string, number>,
  roadBoundaryIndex: RoadBoundaryIndex | null = null,
): number {
  let emitted = 0;
  for (let lineIndex = 1; lineIndex < line.length; lineIndex += 1) {
    const sourceStart = line[lineIndex - 1];
    const sourceEnd = line[lineIndex];
    const sourceDx = sourceEnd[0] - sourceStart[0];
    const sourceDz = sourceEnd[1] - sourceStart[1];
    const sourceDistance = Math.hypot(sourceDx, sourceDz);
    const steps = Math.max(1, Math.ceil(sourceDistance / tile.style.sampleStep));
    let previous: readonly [number, number, number] | null = null;

    for (let index = 0; index <= steps; index += 1) {
      const factor = index / steps;
      const x = sourceStart[0] + (sourceDx * factor);
      const z = sourceStart[1] + (sourceDz * factor);
      const surfaceY = surface.get(horizontalCellKey(x, z));
      const current: readonly [number, number, number] | null = surfaceY === undefined
        ? null
        : [x, surfaceY + tile.style.verticalOffset, z];

      if (previous && current) {
        const identity = segmentIdentity(tile.id, previous, current);
        const dx = current[0] - previous[0];
        const dy = current[1] - previous[1];
        const dz = current[2] - previous[2];
        const distance = Math.hypot(dx, dz);
        // Never stretch a street ribbon vertically over a wall or a missing
        // terrain step. Voxel terrain itself may legitimately move by one
        // metre between samples, hence the deliberately tolerant threshold.
        const plausibleSurfaceStep = Math.abs(dy) <= Math.max(1.5, distance * 2);
        if (!emittedSegments.has(identity) && distance > 1e-6 && plausibleSurfaceStep) {
          emittedSegments.add(identity);
          const effectiveWidth = tile.semanticRole === "street-network"
            ? constrainedRoadSurfaceWidth(
              tile.style.surfaceWidth,
              [(previous[0] + current[0]) / 2, (previous[2] + current[2]) / 2],
              [dx, dz],
              roadBoundaryIndex,
            )
            : tile.style.surfaceWidth;
          const halfWidth = Math.max(0.05, effectiveWidth / 2);
          const normalX = (-dz / distance) * halfWidth;
          const normalZ = (dx / distance) * halfWidth;
          const previousLeft = [previous[0] + normalX, previous[1], previous[2] + normalZ] as const;
          const previousRight = [previous[0] - normalX, previous[1], previous[2] - normalZ] as const;
          const currentLeft = [current[0] + normalX, current[1], current[2] + normalZ] as const;
          const currentRight = [current[0] - normalX, current[1], current[2] - normalZ] as const;
          positions.push(
            ...previousLeft, ...previousRight, ...currentRight,
            ...previousLeft, ...currentRight, ...currentLeft,
          );
          emitted += 1;
        }
      }
      previous = current;
    }
  }
  return emitted;
}

function appendDrapedRibbonCaps(
  positions: number[],
  emittedCaps: Set<string>,
  tile: OverlayTile,
  line: SourceLine,
  surface: ReadonlyMap<string, number>,
  roadBoundaryIndex: RoadBoundaryIndex | null = null,
): void {
  const segmentCount = 12;
  for (const [pointIndex, point] of line.entries()) {
    const surfaceY = surface.get(horizontalCellKey(point[0], point[1]));
    if (surfaceY === undefined) continue;
    const centerY = surfaceY + tile.style.verticalOffset;
    const capKey = [
      tile.id,
      Math.round(point[0] * 1000),
      Math.round(centerY * 1000),
      Math.round(point[1] * 1000),
    ].join(":");
    if (emittedCaps.has(capKey)) continue;
    emittedCaps.add(capKey);
    const previous = line[Math.max(0, pointIndex - 1)] ?? point;
    const next = line[Math.min(line.length - 1, pointIndex + 1)] ?? point;
    const effectiveWidth = tile.semanticRole === "street-network"
      ? constrainedRoadSurfaceWidth(
        tile.style.surfaceWidth,
        point,
        [next[0] - previous[0], next[1] - previous[1]],
        roadBoundaryIndex,
      )
      : tile.style.surfaceWidth;
    const radius = Math.max(0.05, effectiveWidth / 2);
    for (let index = 0; index < segmentCount; index += 1) {
      const firstAngle = (index / segmentCount) * Math.PI * 2;
      const secondAngle = ((index + 1) / segmentCount) * Math.PI * 2;
      positions.push(
        point[0], centerY, point[1],
        point[0] + (Math.cos(firstAngle) * radius), centerY,
        point[1] + (Math.sin(firstAngle) * radius),
        point[0] + (Math.cos(secondAngle) * radius), centerY,
        point[1] + (Math.sin(secondAngle) * radius),
      );
    }
  }
}

function disposeObject(object: THREE.Object3D): void {
  try {
    object.traverse((child) => {
      const drawable = child as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      drawable.geometry?.dispose?.();
      if (Array.isArray(drawable.material)) {
        for (const material of drawable.material) material.dispose();
      } else {
        drawable.material?.dispose?.();
      }
    });
  } catch {
    // Disposal is best effort.
  }
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

export function createGeodataOverlayScene(
  options: GeodataOverlaySceneOptions,
): GeodataOverlaySceneHandle {
  const group = new THREE.Group();
  group.name = "vectoplan_geodata_overlay_scene_group";
  group.renderOrder = 50;
  const lineGroup = new THREE.Group();
  group.add(lineGroup);
  const buildings = createLod2BuildingScene(group);
  const logger = options.logger;
  const createdAt = now();
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let status: GeodataOverlaySceneSnapshot["status"] = "created";
  let lastError: Record<string, unknown> | null = null;
  let earthGridSignature = "";
  let registrySignature = "";
  const chunkSurfaceCache = new Map<string, ChunkSurfaceCacheEntry>();
  let stats: GeodataOverlaySceneStats = {
    buildingCount: 0,
    buildingTriangleCount: 0,
    invalidBuildingCount: 0,
    overlayCount: 0,
    tileCount: 0,
    sourceLineCount: 0,
    renderedSegmentCount: 0,
    surfaceCellCount: 0,
    objectCount: 0,
  };

  if (options.autoAttachToThreeChunkGroup ?? true) {
    const parent = options.parent ?? options.three?.getChunkGroup();
    if (!parent) {
      throw new Error("GeodataOverlayScene requires either 'parent' or 'three' when auto-attach is enabled.");
    }
    parent.add(group);
  }
  status = "ready";

  function syncFromRegistry(
    registry: ChunkRegistryHandle,
    reason = "registry-sync",
  ): GeodataOverlaySceneStats {
    if (status === "disposed") return stats;
    const visibleChunkKeys = registry.getVisibleChunkKeys();
    const nextRegistrySignature = visibleChunkKeys.map((chunkKey) => {
      const chunk = registry.getChunk(chunkKey);
      return `${chunkKey}@${chunk ? chunkSurfaceRevision(chunk) : "missing"}`;
    }).join("|");
    if (nextRegistrySignature === registrySignature && group.userData.surfaceCellY instanceof Map) {
      logDebug(logger, "Geodata overlay sync skipped because visible chunk content is unchanged.", {
        reason,
        visibleChunkCount: visibleChunkKeys.length,
      });
      return stats;
    }
    status = "syncing";
    try {
      const surface = buildVisibleSurfaceMap(registry, visibleChunkKeys, chunkSurfaceCache);
      // Shared, read-only draping truth for parcel selections and any future
      // plan guides.  Keeping it on the overlay group prevents another terrain
      // sampler from slowly diverging from the yellow cadastral lines.
      group.userData.surfaceCellY = surface;
      const tilesByIdentity = new Map<string, OverlayTile>();
      let earthGrid: EarthGridFrameContract | null = null;
      for (const chunkKey of visibleChunkKeys) {
        const chunk = registry.getChunk(chunkKey);
        if (!chunk) continue;
        earthGrid ??= earthGridFromChunk(chunk);
        for (const tile of overlayTilesFromChunk(chunk)) {
          tilesByIdentity.set(tileIdentity(tile), tile);
        }
      }

      if (earthGrid) {
        group.userData.earthGrid = earthGrid;
        const nextSignature = JSON.stringify(earthGrid);
        if (nextSignature !== earthGridSignature) {
          earthGridSignature = nextSignature;
          try {
            window.dispatchEvent(new CustomEvent(EARTH_GRID_READY_EVENT, { detail: earthGrid }));
          } catch {
            // The renderer also exposes the frame through group.userData.
          }
        }
      }

      const overlays = new Map<string, {
        tile: OverlayTile;
        linePositions: number[];
        ribbonPositions: number[];
        ribbonCasingPositions: number[];
        emitted: Set<string>;
        emittedCasing: Set<string>;
        emittedCaps: Set<string>;
        emittedCasingCaps: Set<string>;
        tileCount: number;
        sourceLineCount: number;
        renderedSegmentCount: number;
      }>();
      const roadBoundaryIndex = buildRoadBoundaryIndex(tilesByIdentity.values());
      for (const tile of tilesByIdentity.values()) {
        const current = overlays.get(tile.id) ?? {
          tile,
          linePositions: [],
          ribbonPositions: [],
          ribbonCasingPositions: [],
          emitted: new Set<string>(),
          emittedCasing: new Set<string>(),
          emittedCaps: new Set<string>(),
          emittedCasingCaps: new Set<string>(),
          tileCount: 0,
          sourceLineCount: 0,
          renderedSegmentCount: 0,
        };
        current.tileCount += 1;
        current.sourceLineCount += tile.lines.length;
        for (const [lineIndex, line] of tile.lines.entries()) {
          if (tile.renderMode === "surface-ribbons" && tile.semanticRole === "street-network") {
            const allowedWidth = Math.max(0.1, Math.min(6, tile.surfaceWidths[lineIndex] ?? 6));
            const casingTile: OverlayTile = {
              ...tile,
              style: {
                ...tile.style,
                surfaceWidth: allowedWidth,
                verticalOffset: Math.max(0.003, tile.style.verticalOffset - 0.008),
              },
            };
            const surfaceTile: OverlayTile = {
              ...tile,
              style: {
                ...tile.style,
                surfaceWidth: Math.max(0.1, allowedWidth - 0.3),
              },
            };
            appendDrapedSourceRibbon(
              current.ribbonCasingPositions,
              current.emittedCasing,
              casingTile,
              line,
              surface,
              roadBoundaryIndex,
            );
            appendDrapedRibbonCaps(
              current.ribbonCasingPositions,
              current.emittedCasingCaps,
              casingTile,
              line,
              surface,
              roadBoundaryIndex,
            );
            appendDrapedRibbonCaps(
              current.ribbonPositions,
              current.emittedCaps,
              surfaceTile,
              line,
              surface,
              roadBoundaryIndex,
            );
            current.renderedSegmentCount += appendDrapedSourceRibbon(
              current.ribbonPositions,
              current.emitted,
              surfaceTile,
              line,
              surface,
              roadBoundaryIndex,
            );
          } else {
            current.renderedSegmentCount += tile.renderMode === "surface-ribbons"
              ? appendDrapedSourceRibbon(
                current.ribbonPositions,
                current.emitted,
                tile,
                line,
                surface,
              )
              : appendDrapedSourceLine(
                current.linePositions,
                current.emitted,
                tile,
                line,
                surface,
              );
          }
        }
        overlays.set(tile.id, current);
      }

      clearGroup(lineGroup);
      let sourceLineCount = 0;
      let renderedSegmentCount = 0;
      for (const overlay of overlays.values()) {
        sourceLineCount += overlay.sourceLineCount;
        renderedSegmentCount += overlay.renderedSegmentCount;
        if (
          overlay.linePositions.length === 0
          && overlay.ribbonPositions.length === 0
          && overlay.ribbonCasingPositions.length === 0
        ) continue;
        if (overlay.ribbonCasingPositions.length > 0) {
          const casingGeometry = new THREE.BufferGeometry();
          casingGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(overlay.ribbonCasingPositions, 3),
          );
          casingGeometry.computeBoundingSphere();
          const casing = new THREE.Mesh(
            casingGeometry,
            new THREE.MeshBasicMaterial({
              color: "#cbd2d9",
              transparent: false,
              opacity: 1,
              depthTest: true,
              depthWrite: true,
              toneMapped: false,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: -1,
            }),
          );
          casing.name = `geodata_overlay_${overlay.tile.id}_casing`;
          casing.renderOrder = 49;
          casing.userData = {
            kind: "geodata-overlay-casing",
            overlayId: overlay.tile.id,
            semanticRole: overlay.tile.semanticRole,
            affectsVoxelState: false,
            affectsCollision: false,
          };
          lineGroup.add(casing);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            overlay.tile.renderMode === "surface-ribbons"
              ? overlay.ribbonPositions
              : overlay.linePositions,
            3,
          ),
        );
        geometry.computeBoundingSphere();
        const material = overlay.tile.renderMode === "surface-ribbons"
          ? new THREE.MeshBasicMaterial({
            color: overlay.tile.style.color,
            // Opaque road surfaces avoid the dark, blotchy result caused by
            // alpha stacking at intersections and chunk boundaries.
            transparent: overlay.tile.semanticRole === "street-network"
              ? false
              : overlay.tile.style.opacity < 1,
            opacity: overlay.tile.semanticRole === "street-network"
              ? 1
              : overlay.tile.style.opacity,
            depthTest: true,
            depthWrite: overlay.tile.semanticRole === "street-network",
            toneMapped: false,
            side: THREE.DoubleSide,
            polygonOffset: overlay.tile.semanticRole === "street-network",
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          })
          : new THREE.LineBasicMaterial({
            color: overlay.tile.style.color,
            transparent: overlay.tile.style.opacity < 1,
            opacity: overlay.tile.style.opacity,
            linewidth: overlay.tile.style.lineWidth,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
          });
        const drawable = overlay.tile.renderMode === "surface-ribbons"
          ? new THREE.Mesh(geometry, material)
          : new THREE.LineSegments(geometry, material);
        drawable.name = `geodata_overlay_${overlay.tile.id}`;
        drawable.renderOrder = overlay.tile.semanticRole === "street-network" ? 50 : 51;
        drawable.userData = {
          kind: "geodata-overlay",
          overlayId: overlay.tile.id,
          datasetId: overlay.tile.datasetId,
          releaseKey: overlay.tile.releaseKey,
          semanticRole: overlay.tile.semanticRole,
          classificationSource: overlay.tile.classificationSource,
          affectsVoxelState: false,
          affectsCollision: false,
        };
        lineGroup.add(drawable);
      }

      const buildingStats = buildings.sync(registry);
      group.userData.visualLayerResolutions = buildings.getVisualLayerResolutions();
      stats = {
        buildingCount: buildingStats.buildingCount,
        buildingTriangleCount: buildingStats.triangleCount,
        invalidBuildingCount: buildingStats.invalidBuildingCount,
        overlayCount: overlays.size + (buildingStats.buildingCount > 0 ? 1 : 0),
        tileCount: tilesByIdentity.size,
        sourceLineCount,
        renderedSegmentCount,
        surfaceCellCount: surface.size,
        objectCount: lineGroup.children.length + buildingStats.buildingCount,
      };
      updatedAt = now();
      lastError = null;
      registrySignature = nextRegistrySignature;
      status = "ready";
      logDebug(logger, "Geodata overlays synced to visible voxel surface.", {
        reason,
        ...stats,
      });
      return stats;
    } catch (error) {
      lastError = normalizeUnknownError(error);
      status = "degraded";
      updatedAt = now();
      logWarn(logger, "Geodata overlay synchronization failed.", {
        reason,
        error: lastError,
      });
      return stats;
    }
  }

  return {
    kind: SCENE_KIND,
    syncFromRegistry,
    getGroup: () => group,
    getStats: () => stats,
    getSnapshot: () => ({
      kind: SNAPSHOT_KIND,
      status,
      createdAt,
      updatedAt,
      disposedAt,
      stats,
      lastError,
    }),
    dispose(reason?: string): void {
      if (status === "disposed") return;
      buildings.dispose();
      clearGroup(group);
      chunkSurfaceCache.clear();
      registrySignature = "";
      delete group.userData.surfaceCellY;
      group.parent?.remove(group);
      disposedAt = now();
      updatedAt = disposedAt;
      status = "disposed";
      logDebug(logger, "Geodata overlay scene disposed.", { reason: reason ?? null });
    },
  };
}
