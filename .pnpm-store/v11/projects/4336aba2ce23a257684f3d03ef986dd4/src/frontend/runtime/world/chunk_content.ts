// src/frontend/runtime/world/chunk_content.ts
import { terrainCellShape, type TerrainCellShape } from './terrain_surface';
import type {
  ChunkApiPaletteEntry,
  ChunkApiRuntimeChunkContent,
} from "@api/chunk_api_models";
import {
  CHUNK_API_AIR_CELL_VALUE,
  CHUNK_API_CELL_ENCODING,
  CHUNK_API_IMPLICIT_SOLID_CELL_VALUE,
} from "@api/chunk_api_models";
import {
  cloneChunkCellsWithValue,
  createChunkCellsFromSpans,
  createChunkCellsFromValues,
  forEachNonAirCellSpan,
  getChunkCellStorageInfo,
  getChunkCellValue,
  isCompressedChunkCells,
} from "@api/chunk_cell_storage";
import { chunkKeyFromCoordinates } from "@utils/ids";
import {
  isRecord,
  safeArray,
  safeBoolean,
  safeInteger,
  safeNumber,
  safeRecord,
  safeString,
  uniqueStrings,
} from "@utils/safe";
import {
  cellIndexFromLocalCoordinates,
  createChunkCellAddress,
  createChunkCellAddressFromChunkAndLocal,
  localCoordinatesFromCellIndex,
  normalizeChunkSize,
  type ChunkCellAddress,
  type ChunkCoordinates,
  type ChunkWorldPosition,
  type LocalCellCoordinates,
} from "./chunk_coordinates";

export {
  CHUNK_API_AIR_CELL_VALUE,
  CHUNK_API_IMPLICIT_SOLID_CELL_VALUE,
};

export type RuntimeCellCollisionKind =
  | "air"
  | "solid"
  | "non_solid"
  | "liquid"
  | "trigger"
  | "unknown";

export interface RuntimeChunkPaletteEntry {
  readonly paletteIndex: number;
  readonly cellValue: number;
  readonly blockTypeId: string;
  readonly label: string;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly solid: boolean;
  readonly placeable: boolean;
  readonly breakable: boolean;
  readonly color: string | null;
  readonly metadata: Record<string, unknown>;
  readonly raw: ChunkApiPaletteEntry;
}

export interface RuntimeChunkStats {
  readonly cellCount: number;
  readonly airCellCount: number;
  readonly nonAirCellCount: number;
  readonly solidCellCount: number;
  readonly nonSolidCellCount: number;
  readonly paletteBlockCount: number;
  readonly uniqueCellValues: readonly number[];
  readonly minimumSurfaceY?: number;
  readonly maximumSurfaceY?: number;
}

export interface RuntimeChunkContent {
  readonly kind: "runtime-chunk-content.v1";
  readonly projectId: string;
  readonly universeId: string | null;
  readonly worldId: string;
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly chunkSize: number;
  readonly cellSize: number;
  readonly cells: readonly number[];
  readonly palette: readonly RuntimeChunkPaletteEntry[];
  readonly paletteByCellValue: ReadonlyMap<number, RuntimeChunkPaletteEntry>;
  readonly paletteByBlockTypeId: ReadonlyMap<string, RuntimeChunkPaletteEntry>;
  readonly stats: RuntimeChunkStats;
  readonly source: "snapshot" | "generated" | "unknown";
  readonly snapshotId: string | null;
  readonly chunkRevision: number | null;
  readonly chunkVersion: string | null;
  readonly loadedAt: string;
  readonly raw: ChunkApiRuntimeChunkContent;
}

export interface RuntimeCellCollisionInfo {
  readonly kind: RuntimeCellCollisionKind;
  readonly loaded: boolean;
  readonly air: boolean;
  readonly solid: boolean;
  readonly blockTypeId: string | null;
  readonly cellValue: number;
  readonly paletteEntry: RuntimeChunkPaletteEntry | null;
  readonly reason: string | null;
}

export interface RuntimeCellSample {
  readonly terrainShape?: TerrainCellShape | null;
  readonly exists: boolean;
  readonly chunkKey: string;
  readonly address: ChunkCellAddress;
  readonly cellValue: number;
  readonly air: boolean;
  readonly paletteEntry: RuntimeChunkPaletteEntry | null;
  readonly blockTypeId: string | null;
  readonly solid: boolean;
  readonly placeable: boolean;
  readonly breakable: boolean;
  readonly collisionKind: RuntimeCellCollisionKind;
}

export interface RuntimeChunkMutationPreview {
  readonly changed: boolean;
  readonly previousCellValue: number;
  readonly nextCellValue: number;
  readonly previousBlockTypeId: string | null;
  readonly nextBlockTypeId: string | null;
}

export interface RuntimeChunkValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface RuntimeChunkCloneOptions {
  readonly metadata?: Record<string, unknown>;
  readonly cells?: readonly number[];
  readonly palette?: readonly ChunkApiPaletteEntry[];
  readonly loadedAt?: string;
  readonly chunkRevision?: number | null;
  readonly chunkVersion?: string | null;
  readonly source?: "snapshot" | "generated" | "unknown";
}

export const RUNTIME_CHUNK_CONTENT_KIND = "runtime-chunk-content.v1" as const;

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function normalizeNullableString(value: unknown): string | null {
  try {
    const normalized = safeString(value, "");
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeRuntimeChunkSize(value: unknown): number {
  try {
    return Number(normalizeChunkSize(value));
  } catch {
    return 16;
  }
}

function normalizeChunkSource(value: unknown): RuntimeChunkContent["source"] {
  const normalized = safeString(value, "unknown");

  if (normalized === "snapshot" || normalized === "generated" || normalized === "unknown") {
    return normalized;
  }

  return "unknown";
}

function expectedCellCountForChunkSize(chunkSize: number): number {
  try {
    const normalizedChunkSize = normalizeRuntimeChunkSize(chunkSize);
    return normalizedChunkSize * normalizedChunkSize * normalizedChunkSize;
  } catch {
    return 4096;
  }
}

function normalizeCellValue(value: unknown): number {
  try {
    return safeInteger(value, CHUNK_API_AIR_CELL_VALUE, {
      min: CHUNK_API_IMPLICIT_SOLID_CELL_VALUE,
      max: Number.MAX_SAFE_INTEGER,
    });
  } catch {
    return CHUNK_API_AIR_CELL_VALUE;
  }
}

function normalizeCells(
  cells: unknown,
  expectedCellCount: number,
): readonly number[] {
  try {
    const rawCells = safeArray(cells);
    if (isCompressedChunkCells(rawCells) && rawCells.length === expectedCellCount) {
      return rawCells;
    }
    return createChunkCellsFromValues(rawCells, expectedCellCount, normalizeCellValue);
  } catch {
    return createChunkCellsFromSpans(expectedCellCount, []);
  }
}

function normalizePaletteEntry(
  entry: ChunkApiPaletteEntry,
  index: number,
): RuntimeChunkPaletteEntry {
  const blockTypeId = safeString(entry.blockTypeId, `unknown_block_${index}`);
  const metadata = safeRecord(entry.metadata);
  const color = typeof metadata.debugColor === "string" && metadata.debugColor.trim().length > 0
    ? metadata.debugColor.trim()
    : typeof metadata.color === "string" && metadata.color.trim().length > 0
      ? metadata.color.trim()
      : null;

  return {
    paletteIndex: index,
    cellValue: index + 1,
    blockTypeId,
    label: safeString(entry.label, blockTypeId),
    registryId: safeString(entry.registryId, "debug-blocks"),
    registryVersion: safeString(entry.registryVersion, "1"),
    solid: safeBoolean(entry.solid, true),
    placeable: safeBoolean(entry.placeable, true),
    breakable: safeBoolean(entry.breakable, true),
    color,
    metadata,
    raw: entry,
  };
}

function normalizePalette(
  palette: readonly ChunkApiPaletteEntry[] | unknown,
): readonly RuntimeChunkPaletteEntry[] {
  try {
    const rawPalette = safeArray(palette);

    return rawPalette
      .filter((entry): entry is ChunkApiPaletteEntry => isRecord(entry))
      .map((entry, index) => normalizePaletteEntry(entry, index));
  } catch {
    return [];
  }
}

function buildPaletteByCellValue(
  palette: readonly RuntimeChunkPaletteEntry[],
): ReadonlyMap<number, RuntimeChunkPaletteEntry> {
  const map = new Map<number, RuntimeChunkPaletteEntry>();

  try {
    for (const entry of palette) {
      map.set(entry.cellValue, entry);
    }
  } catch {
    // Ignore partial map failure.
  }

  return map;
}

function buildPaletteByBlockTypeId(
  palette: readonly RuntimeChunkPaletteEntry[],
): ReadonlyMap<string, RuntimeChunkPaletteEntry> {
  const map = new Map<string, RuntimeChunkPaletteEntry>();

  try {
    for (const entry of palette) {
      if (entry.blockTypeId.length > 0) {
        map.set(entry.blockTypeId, entry);
      }
    }
  } catch {
    // Ignore partial map failure.
  }

  return map;
}

function computeStats(
  cells: readonly number[],
  palette: readonly RuntimeChunkPaletteEntry[],
): RuntimeChunkStats {
  try {
    const storageInfo = getChunkCellStorageInfo(cells);
    const airCellCount = storageInfo.airCellCount;
    const nonAirCellCount = storageInfo.nonAirCellCount;
    let solidCellCount = 0;
    let nonSolidCellCount = 0;
    const unique = new Set<number>();
    if (airCellCount > 0) {
      unique.add(CHUNK_API_AIR_CELL_VALUE);
    }
    const paletteByCellValue = buildPaletteByCellValue(palette);

    forEachNonAirCellSpan(cells, (start, end, rawCell) => {
      const cell = normalizeCellValue(rawCell);
      const cellCount = end - start;

      unique.add(cell);

      const paletteEntry = paletteByCellValue.get(cell) ?? null;

      /**
       * Collision safety rule:
       * If a cell is non-air but the palette is missing, treat it as solid.
       * Unknown non-air cells must not become holes in the physics world.
       */
      if (paletteEntry?.solid ?? true) {
        solidCellCount += cellCount;
      } else {
        nonSolidCellCount += cellCount;
      }
    });

    return {
      cellCount: cells.length,
      airCellCount,
      nonAirCellCount,
      solidCellCount,
      nonSolidCellCount,
      paletteBlockCount: palette.length,
      uniqueCellValues: [...unique].sort((left, right) => left - right),
    };
  } catch {
    return {
      cellCount: cells.length,
      airCellCount: cells.length,
      nonAirCellCount: 0,
      solidCellCount: 0,
      nonSolidCellCount: 0,
      paletteBlockCount: palette.length,
      uniqueCellValues: [CHUNK_API_AIR_CELL_VALUE],
    };
  }
}

function createSafeRawChunk(
  apiChunk: ChunkApiRuntimeChunkContent,
  input: {
    readonly cells: readonly number[];
    readonly palette: readonly ChunkApiPaletteEntry[];
    readonly chunkSize: number;
    readonly cellSize: number;
    readonly chunkKey: string;
    readonly chunkX: number;
    readonly chunkY: number;
    readonly chunkZ: number;
    readonly source: RuntimeChunkContent["source"];
    readonly chunkRevision: number | null;
    readonly chunkVersion: string | null;
  },
): ChunkApiRuntimeChunkContent {
  try {
    return {
      ...apiChunk,
      chunkKey: input.chunkKey,
      chunkX: input.chunkX,
      chunkY: input.chunkY,
      chunkZ: input.chunkZ,
      chunkSize: input.chunkSize,
      cellSize: input.cellSize,
      cells: input.cells,
      palette: input.palette,
      source: input.source,
      chunkRevision: input.chunkRevision,
      chunkVersion: input.chunkVersion,
      cellEncoding: apiChunk.cellEncoding ?? CHUNK_API_CELL_ENCODING,
      cellIndexOrder: apiChunk.cellIndexOrder ?? "x-fastest-y-then-z",
    };
  } catch {
    return apiChunk;
  }
}

function createMissingCellSample(
  chunkKey: string,
  address: ChunkCellAddress,
): RuntimeCellSample {
  return {
    exists: false,
    chunkKey,
    address,
    cellValue: CHUNK_API_AIR_CELL_VALUE,
    air: true,
    paletteEntry: null,
    blockTypeId: null,
    solid: false,
    placeable: false,
    breakable: false,
    collisionKind: "air",
  };
}

export function createRuntimeChunkContent(
  apiChunk: ChunkApiRuntimeChunkContent,
): RuntimeChunkContent {
  const chunkSize = normalizeRuntimeChunkSize(apiChunk.chunkSize);
  const expectedCellCount = expectedCellCountForChunkSize(chunkSize);
  const cells = normalizeCells(apiChunk.cells, expectedCellCount);
  const palette = normalizePalette(apiChunk.palette);
  const paletteByCellValue = buildPaletteByCellValue(palette);
  const paletteByBlockTypeId = buildPaletteByBlockTypeId(palette);
  const computedStats = computeStats(cells, palette);
  const stats: RuntimeChunkStats = {
    ...computedStats,
    minimumSurfaceY: typeof apiChunk.stats.minimumSurfaceY === "number"
      && Number.isFinite(apiChunk.stats.minimumSurfaceY)
      ? apiChunk.stats.minimumSurfaceY
      : undefined,
    maximumSurfaceY: typeof apiChunk.stats.maximumSurfaceY === "number"
      && Number.isFinite(apiChunk.stats.maximumSurfaceY)
      ? apiChunk.stats.maximumSurfaceY
      : undefined,
  };
  const chunkX = safeInteger(apiChunk.chunkX, 0);
  const chunkY = safeInteger(apiChunk.chunkY, 0);
  const chunkZ = safeInteger(apiChunk.chunkZ, 0);
  const chunkKey = safeString(
    apiChunk.chunkKey,
    chunkKeyFromCoordinates(chunkX, chunkY, chunkZ),
  );
  const cellSize = safeNumber(apiChunk.cellSize, 1, {
    min: 0.000001,
    max: 1_000_000,
  });
  const source = normalizeChunkSource(apiChunk.source);
  const chunkRevision = typeof apiChunk.chunkRevision === "number" && Number.isFinite(apiChunk.chunkRevision)
    ? apiChunk.chunkRevision
    : null;
  const chunkVersion = normalizeNullableString(apiChunk.chunkVersion);
  const raw = createSafeRawChunk(apiChunk, {
    cells,
    palette: apiChunk.palette,
    chunkSize,
    cellSize,
    chunkKey,
    chunkX,
    chunkY,
    chunkZ,
    source,
    chunkRevision,
    chunkVersion,
  });

  return {
    kind: RUNTIME_CHUNK_CONTENT_KIND,
    projectId: safeString(apiChunk.projectId, "dev-project"),
    universeId: normalizeNullableString(apiChunk.universeId),
    worldId: safeString(apiChunk.worldId, "world_spawn"),
    chunkKey,
    chunkX,
    chunkY,
    chunkZ,
    chunkSize,
    cellSize,
    cells,
    palette,
    paletteByCellValue,
    paletteByBlockTypeId,
    stats,
    source,
    snapshotId: normalizeNullableString(apiChunk.snapshotId),
    chunkRevision,
    chunkVersion,
    loadedAt: nowIsoStringSafe(),
    raw,
  };
}

export function cloneRuntimeChunkContent(
  chunk: RuntimeChunkContent,
  options?: RuntimeChunkCloneOptions,
): RuntimeChunkContent {
  try {
    const raw: ChunkApiRuntimeChunkContent = {
      ...chunk.raw,
      metadata: options?.metadata ?? chunk.raw.metadata,
      cells: options?.cells ?? chunk.cells,
      palette: options?.palette ?? chunk.raw.palette,
      chunkRevision: options?.chunkRevision ?? chunk.chunkRevision,
      chunkVersion: options?.chunkVersion ?? chunk.chunkVersion,
      source: options?.source ?? chunk.source,
    };

    const cloned = createRuntimeChunkContent(raw);

    return {
      ...cloned,
      loadedAt: options?.loadedAt ?? chunk.loadedAt,
    };
  } catch {
    return chunk;
  }
}

export function validateRuntimeChunkContent(
  chunk: RuntimeChunkContent,
): RuntimeChunkValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (chunk.kind !== RUNTIME_CHUNK_CONTENT_KIND) {
      errors.push("Invalid runtime chunk content kind.");
    }

    if (chunk.chunkSize < 1) {
      errors.push("Chunk size must be >= 1.");
    }

    const expectedCellCount = expectedCellCountForChunkSize(chunk.chunkSize);

    if (chunk.cells.length !== expectedCellCount) {
      errors.push(`Chunk cell count mismatch. Expected ${expectedCellCount}, received ${chunk.cells.length}.`);
    }

    if (chunk.stats.nonAirCellCount > 0 && chunk.palette.length === 0) {
      warnings.push("Chunk contains non-air cells but has no palette. Unknown non-air cells are treated as solid for collision safety.");
    }

    for (const cellValue of chunk.stats.uniqueCellValues) {
      if (cellValue === CHUNK_API_AIR_CELL_VALUE) {
        continue;
      }

      if (cellValue === CHUNK_API_IMPLICIT_SOLID_CELL_VALUE) {
        continue;
      }

      if (!chunk.paletteByCellValue.has(cellValue)) {
        warnings.push(`Cell value ${cellValue} has no palette entry. It will be treated as solid by physics.`);
      }
    }

    if (chunk.raw.cellEncoding?.version !== CHUNK_API_CELL_ENCODING.version) {
      warnings.push(`Unexpected cell encoding: ${safeString(chunk.raw.cellEncoding?.version, "unknown")}`);
    }

    if (chunk.raw.cellIndexOrder !== "x-fastest-y-then-z") {
      warnings.push(`Unexpected cell index order: ${safeString(chunk.raw.cellIndexOrder, "unknown")}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Runtime chunk validation failed.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function isAirCellValue(value: unknown): boolean {
  return normalizeCellValue(value) === CHUNK_API_AIR_CELL_VALUE;
}

export function isSystemAirBlockTypeId(value: unknown): boolean {
  return safeString(value, "").trim().toLowerCase() === "system_air";
}

export function isNonAirCellValue(value: unknown): boolean {
  return !isAirCellValue(value);
}

export function isSolidCellValue(
  value: unknown,
  chunk?: RuntimeChunkContent | null,
): boolean {
  try {
    const cellValue = normalizeCellValue(value);

    if (cellValue === CHUNK_API_AIR_CELL_VALUE) {
      return false;
    }

    /**
     * Without a chunk/palette, version 1 physics treats every non-air cell as solid.
     */
    if (!chunk) {
      return true;
    }

    const entry = getPaletteEntryByCellValue(chunk, cellValue);

    // system_air is reserved for empty space and must never participate in
    // collision, even when malformed/legacy data placed it in the palette.
    if (isSystemAirBlockTypeId(entry?.blockTypeId)) {
      return false;
    }

    /**
     * Collision safety rule:
     * Unknown non-air cells are solid. This prevents walking/falling through
     * cells whose palette has not loaded or is inconsistent.
     */
    return entry?.solid ?? true;
  } catch {
    return false;
  }
}

export function runtimeCellCollisionKindFromValue(
  value: unknown,
  chunk?: RuntimeChunkContent | null,
): RuntimeCellCollisionKind {
  try {
    const cellValue = normalizeCellValue(value);

    if (cellValue === CHUNK_API_AIR_CELL_VALUE) {
      return "air";
    }

    if (!chunk) {
      return "solid";
    }

    const entry = getPaletteEntryByCellValue(chunk, cellValue);

    if (!entry) {
      return "solid";
    }

    if (isSystemAirBlockTypeId(entry.blockTypeId)) {
      return "air";
    }

    return entry.solid ? "solid" : "non_solid";
  } catch {
    return "unknown";
  }
}

export function cellValueToPaletteIndex(value: unknown): number | null {
  try {
    const cellValue = normalizeCellValue(value);

    if (cellValue === CHUNK_API_AIR_CELL_VALUE) {
      return null;
    }

    return cellValue - 1;
  } catch {
    return null;
  }
}

export function paletteIndexToCellValue(value: unknown): number {
  try {
    const paletteIndex = safeInteger(value, 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });

    return paletteIndex + 1;
  } catch {
    return CHUNK_API_AIR_CELL_VALUE;
  }
}

export function getPaletteEntryByCellValue(
  chunk: RuntimeChunkContent,
  cellValue: unknown,
): RuntimeChunkPaletteEntry | null {
  try {
    const normalizedCellValue = normalizeCellValue(cellValue);

    if (normalizedCellValue === CHUNK_API_AIR_CELL_VALUE) {
      return null;
    }

    return chunk.paletteByCellValue.get(normalizedCellValue) ?? null;
  } catch {
    return null;
  }
}

export function getPaletteEntryByBlockTypeId(
  chunk: RuntimeChunkContent,
  blockTypeId: unknown,
): RuntimeChunkPaletteEntry | null {
  try {
    const normalizedBlockTypeId = safeString(blockTypeId, "");

    if (normalizedBlockTypeId.length === 0) {
      return null;
    }

    return chunk.paletteByBlockTypeId.get(normalizedBlockTypeId) ?? null;
  } catch {
    return null;
  }
}

export function getCellValueAtIndex(
  chunk: RuntimeChunkContent,
  cellIndex: unknown,
): number {
  try {
    const index = safeInteger(cellIndex, -1, {
      min: -1,
      max: chunk.cells.length - 1,
    });

    if (index < 0) {
      return CHUNK_API_AIR_CELL_VALUE;
    }

    return getChunkCellValue(chunk.cells, index);
  } catch {
    return CHUNK_API_AIR_CELL_VALUE;
  }
}

export function getCellValueAtLocalCoordinates(
  chunk: RuntimeChunkContent,
  local: LocalCellCoordinates,
): number {
  try {
    const cellIndex = cellIndexFromLocalCoordinates(local, normalizeRuntimeChunkSize(chunk.chunkSize));
    return getCellValueAtIndex(chunk, cellIndex);
  } catch {
    return CHUNK_API_AIR_CELL_VALUE;
  }
}

export function getCellValueAtWorldPosition(
  chunk: RuntimeChunkContent,
  position: ChunkWorldPosition,
): number {
  try {
    const chunkSize = normalizeRuntimeChunkSize(chunk.chunkSize);
    const address = createChunkCellAddress({
      worldX: position.x,
      worldY: position.y,
      worldZ: position.z,
      chunkSize,
    });

    if (address.chunkKey !== chunk.chunkKey) {
      return CHUNK_API_AIR_CELL_VALUE;
    }

    return getCellValueAtIndex(chunk, address.cellIndex);
  } catch {
    return CHUNK_API_AIR_CELL_VALUE;
  }
}

export function getRuntimeCellCollisionInfo(
  chunk: RuntimeChunkContent,
  cellValue: unknown,
): RuntimeCellCollisionInfo {
  try {
    const normalizedCellValue = normalizeCellValue(cellValue);
    const paletteEntry = getPaletteEntryByCellValue(chunk, normalizedCellValue);
    const air = normalizedCellValue === CHUNK_API_AIR_CELL_VALUE
      || isSystemAirBlockTypeId(paletteEntry?.blockTypeId);
    const solid = air ? false : isSolidCellValue(normalizedCellValue, chunk);
    const kind = air ? "air" : runtimeCellCollisionKindFromValue(normalizedCellValue, chunk);

    return {
      kind,
      loaded: true,
      air,
      solid,
      blockTypeId: air ? null : paletteEntry?.blockTypeId ?? null,
      cellValue: normalizedCellValue,
      paletteEntry,
      reason: air
        ? "air"
        : paletteEntry
          ? null
          : "missing-palette-entry-treated-as-solid",
    };
  } catch {
    return {
      kind: "air",
      loaded: true,
      air: true,
      solid: false,
      blockTypeId: null,
      cellValue: CHUNK_API_AIR_CELL_VALUE,
      paletteEntry: null,
      reason: "collision-info-failed",
    };
  }
}

export function sampleCellAtLocalCoordinates(
  chunk: RuntimeChunkContent,
  local: LocalCellCoordinates,
): RuntimeCellSample {
  const chunkSize = normalizeRuntimeChunkSize(chunk.chunkSize);
  const address = createChunkCellAddressFromChunkAndLocal({
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    chunkZ: chunk.chunkZ,
    localX: local.localX,
    localY: local.localY,
    localZ: local.localZ,
    chunkSize,
  });

  const cellValue = getCellValueAtIndex(chunk, address.cellIndex);
  const paletteEntry = getPaletteEntryByCellValue(chunk, cellValue);
  const air = cellValue === CHUNK_API_AIR_CELL_VALUE
    || isSystemAirBlockTypeId(paletteEntry?.blockTypeId);
  const collisionKind = air ? "air" : runtimeCellCollisionKindFromValue(cellValue, chunk);

  return {
    exists: address.cellIndex >= 0 && address.cellIndex < chunk.cells.length,
    chunkKey: chunk.chunkKey,
    address,
    cellValue,
    air,
    paletteEntry,
    blockTypeId: air ? null : paletteEntry?.blockTypeId ?? null,
    solid: air ? false : isSolidCellValue(cellValue, chunk),
    placeable: paletteEntry?.placeable ?? false,
    breakable: paletteEntry?.breakable ?? false,
    collisionKind,
    terrainShape: terrainCellShape(chunk, local.localX, local.localY, local.localZ),
  };
}

export function sampleCellAtIndex(
  chunk: RuntimeChunkContent,
  cellIndex: unknown,
): RuntimeCellSample {
  const index = safeInteger(cellIndex, 0, {
    min: 0,
    max: Math.max(0, chunk.cells.length - 1),
  });
  const local = localCoordinatesFromCellIndex(index, normalizeRuntimeChunkSize(chunk.chunkSize));

  return sampleCellAtLocalCoordinates(chunk, local);
}

export function sampleCellAtWorldPosition(
  chunk: RuntimeChunkContent,
  position: ChunkWorldPosition,
): RuntimeCellSample {
  try {
    const chunkSize = normalizeRuntimeChunkSize(chunk.chunkSize);
    const address = createChunkCellAddress({
      worldX: position.x,
      worldY: position.y,
      worldZ: position.z,
      chunkSize,
    });

    if (address.chunkKey !== chunk.chunkKey) {
      return createMissingCellSample(address.chunkKey, address);
    }

    return sampleCellAtLocalCoordinates(chunk, address);
  } catch {
    return sampleCellAtIndex(chunk, 0);
  }
}

export function previewCellMutation(
  chunk: RuntimeChunkContent,
  local: LocalCellCoordinates,
  nextBlockTypeId: string | null,
): RuntimeChunkMutationPreview {
  const previousCellValue = getCellValueAtLocalCoordinates(chunk, local);
  const previousEntry = getPaletteEntryByCellValue(chunk, previousCellValue);
  const nextEntry = nextBlockTypeId === null
    ? null
    : getPaletteEntryByBlockTypeId(chunk, nextBlockTypeId);
  const nextCellValue = nextEntry?.cellValue ?? CHUNK_API_AIR_CELL_VALUE;

  return {
    changed: previousCellValue !== nextCellValue,
    previousCellValue,
    nextCellValue,
    previousBlockTypeId: previousEntry?.blockTypeId ?? null,
    nextBlockTypeId: nextEntry?.blockTypeId ?? null,
  };
}

export function cloneCellsWithMutation(
  chunk: RuntimeChunkContent,
  local: LocalCellCoordinates,
  nextCellValue: number,
): readonly number[] {
  try {
    const cellIndex = cellIndexFromLocalCoordinates(local, normalizeRuntimeChunkSize(chunk.chunkSize));
    return cloneChunkCellsWithValue(
      chunk.cells,
      cellIndex,
      normalizeCellValue(nextCellValue),
    );
  } catch {
    return chunk.cells;
  }
}

export function cloneChunkWithMutation(
  chunk: RuntimeChunkContent,
  local: LocalCellCoordinates,
  nextCellValue: number,
): RuntimeChunkContent {
  return cloneRuntimeChunkContent(chunk, {
    cells: cloneCellsWithMutation(chunk, local, nextCellValue),
    loadedAt: nowIsoStringSafe(),
    source: chunk.source,
  });
}

export function countCellsByValue(
  chunk: RuntimeChunkContent,
): ReadonlyMap<number, number> {
  const map = new Map<number, number>();

  try {
    const storageInfo = getChunkCellStorageInfo(chunk.cells);
    if (storageInfo.airCellCount > 0) {
      map.set(CHUNK_API_AIR_CELL_VALUE, storageInfo.airCellCount);
    }

    forEachNonAirCellSpan(chunk.cells, (start, end, cellValue) => {
      map.set(
        cellValue,
        (map.get(cellValue) ?? 0) + (end - start),
      );
    });
  } catch {
    // Return partial count map.
  }

  return map;
}

export function collectNonAirCellIndices(
  chunk: RuntimeChunkContent,
  limit = Number.POSITIVE_INFINITY,
): readonly number[] {
  try {
    const safeLimit = Math.max(0, Math.trunc(limit));
    const result: number[] = [];

    forEachNonAirCellSpan(chunk.cells, (start, end) => {
      for (let index = start; index < end && result.length < safeLimit; index += 1) {
        result.push(index);
      }
    });

    return result;
  } catch {
    return [];
  }
}

export function collectSolidCellIndices(
  chunk: RuntimeChunkContent,
  limit = Number.POSITIVE_INFINITY,
): readonly number[] {
  try {
    const safeLimit = Math.max(0, Math.trunc(limit));
    const result: number[] = [];

    forEachNonAirCellSpan(chunk.cells, (start, end, cellValue) => {
      if (isSolidCellValue(cellValue, chunk)) {
        for (let index = start; index < end && result.length < safeLimit; index += 1) {
          result.push(index);
        }
      }
    });

    return result;
  } catch {
    return [];
  }
}

export function collectBlockTypeIdsFromChunk(
  chunk: RuntimeChunkContent,
): readonly string[] {
  try {
    return uniqueStrings(chunk.palette.map((entry) => entry.blockTypeId));
  } catch {
    return [];
  }
}

export function runtimeChunkContentToDebugSummary(
  chunk: RuntimeChunkContent,
): Record<string, unknown> {
  try {
    return {
      kind: chunk.kind,
      chunkKey: chunk.chunkKey,
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
      chunkZ: chunk.chunkZ,
      chunkSize: chunk.chunkSize,
      cellSize: chunk.cellSize,
      cellCount: chunk.stats.cellCount,
      airCellCount: chunk.stats.airCellCount,
      nonAirCellCount: chunk.stats.nonAirCellCount,
      solidCellCount: chunk.stats.solidCellCount,
      nonSolidCellCount: chunk.stats.nonSolidCellCount,
      paletteBlockCount: chunk.stats.paletteBlockCount,
      uniqueCellValues: chunk.stats.uniqueCellValues,
      source: chunk.source,
      snapshotId: chunk.snapshotId,
      chunkRevision: chunk.chunkRevision,
      chunkVersion: chunk.chunkVersion,
      blockTypeIds: collectBlockTypeIdsFromChunk(chunk),
      loadedAt: chunk.loadedAt,
    };
  } catch {
    return {
      kind: RUNTIME_CHUNK_CONTENT_KIND,
      error: "debug_summary_failed",
    };
  }
}

export function isRuntimeChunkContent(value: unknown): value is RuntimeChunkContent {
  try {
    if (!isRecord(value)) {
      return false;
    }

    return value.kind === RUNTIME_CHUNK_CONTENT_KIND
      && typeof value.chunkKey === "string"
      && Array.isArray(value.cells)
      && Array.isArray(value.palette);
  } catch {
    return false;
  }
}

export function isRuntimeCellSample(value: unknown): value is RuntimeCellSample {
  try {
    if (!isRecord(value)) {
      return false;
    }

    return typeof value.exists === "boolean"
      && typeof value.chunkKey === "string"
      && typeof value.cellValue === "number"
      && isRecord(value.address);
  } catch {
    return false;
  }
}

export type RuntimeChunkAddressLike =
  | ChunkCoordinates
  | ChunkCellAddress
  | string;

export function runtimeChunkAddressToKey(value: RuntimeChunkAddressLike): string {
  try {
    if (typeof value === "string") {
      return value;
    }

    if ("chunkKey" in value && typeof value.chunkKey === "string") {
      return value.chunkKey;
    }

    return chunkKeyFromCoordinates(value.chunkX, value.chunkY, value.chunkZ);
  } catch {
    return chunkKeyFromCoordinates(0, 0, 0);
  }
}
