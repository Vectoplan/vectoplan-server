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
  readonly verticalOffset: number;
  readonly sampleStep: number;
}

interface OverlayTile {
  readonly id: string;
  readonly datasetId: string;
  readonly label: string;
  readonly releaseKey: string;
  readonly tileKey: string;
  readonly renderMode: "surface-lines";
  readonly semanticRole: string;
  readonly classificationSource: boolean;
  readonly style: OverlayStyle;
  readonly lines: readonly SourceLine[];
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
    verticalOffset: safeNumber(style.verticalOffset, 0.015, { min: 0.001, max: 2 }),
    sampleStep: safeNumber(style.sampleStep, 0.25, { min: 0.05, max: 2 }),
  };
}

function parseOverlayTile(value: unknown): OverlayTile | null {
  const item = asRecord(value);
  if (!item || safeString(item.renderMode, "") !== "surface-lines") return null;
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
  const isParcelBoundary = (
    item.classificationSource === true
    || ["parcel", "cadastr", "cadastre", "flurstueck", "grundstueck", "alkis"].some((token) => parcelBoundary.includes(token))
  );
  const style: OverlayStyle = isParcelBoundary
    ? { ...parsedStyle, color: "#1687ff", opacity: Math.max(parsedStyle.opacity, 0.92) }
    : parsedStyle;
  return {
    id,
    datasetId,
    label,
    releaseKey: safeString(item.releaseKey, "unknown-release"),
    tileKey,
    renderMode: "surface-lines",
    semanticRole,
    classificationSource: item.classificationSource === true,
    style,
    lines: parseLines(geometry.coordinates),
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
        if (!Number.isFinite(fallbackTops[columnIndex])) fallbackTops[columnIndex] = topY;
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
        const currentFallback = fallbackSurface.get(key) ?? Number.NEGATIVE_INFINITY;
        const currentTerrain = terrainSurface.get(key) ?? Number.NEGATIVE_INFINITY;
        const fallbackTop = cached.fallbackTops[columnIndex] ?? Number.NEGATIVE_INFINITY;
        const terrainTop = cached.terrainTops[columnIndex] ?? Number.NEGATIVE_INFINITY;
        if (fallbackTop > currentFallback) fallbackSurface.set(key, fallbackTop);
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
        positions: number[];
        emitted: Set<string>;
        tileCount: number;
        sourceLineCount: number;
        renderedSegmentCount: number;
      }>();
      for (const tile of tilesByIdentity.values()) {
        const current = overlays.get(tile.id) ?? {
          tile,
          positions: [],
          emitted: new Set<string>(),
          tileCount: 0,
          sourceLineCount: 0,
          renderedSegmentCount: 0,
        };
        current.tileCount += 1;
        current.sourceLineCount += tile.lines.length;
        for (const line of tile.lines) {
          current.renderedSegmentCount += appendDrapedSourceLine(
            current.positions,
            current.emitted,
            tile,
            line,
            surface,
          );
        }
        overlays.set(tile.id, current);
      }

      clearGroup(group);
      let sourceLineCount = 0;
      let renderedSegmentCount = 0;
      for (const overlay of overlays.values()) {
        sourceLineCount += overlay.sourceLineCount;
        renderedSegmentCount += overlay.renderedSegmentCount;
        if (overlay.positions.length === 0) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(overlay.positions, 3),
        );
        geometry.computeBoundingSphere();
        const material = new THREE.LineBasicMaterial({
          color: overlay.tile.style.color,
          transparent: overlay.tile.style.opacity < 1,
          opacity: overlay.tile.style.opacity,
          linewidth: overlay.tile.style.lineWidth,
          depthTest: true,
          depthWrite: false,
          toneMapped: false,
        });
        const lines = new THREE.LineSegments(geometry, material);
        lines.name = `geodata_overlay_${overlay.tile.id}`;
        lines.renderOrder = 50;
        lines.userData = {
          kind: "geodata-overlay",
          overlayId: overlay.tile.id,
          datasetId: overlay.tile.datasetId,
          releaseKey: overlay.tile.releaseKey,
          semanticRole: overlay.tile.semanticRole,
          classificationSource: overlay.tile.classificationSource,
          affectsVoxelState: false,
          affectsCollision: false,
        };
        group.add(lines);
      }

      stats = {
        overlayCount: overlays.size,
        tileCount: tilesByIdentity.size,
        sourceLineCount,
        renderedSegmentCount,
        surfaceCellCount: surface.size,
        objectCount: group.children.length,
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
