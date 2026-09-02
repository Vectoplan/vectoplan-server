// services/vectoplan-editor/src/frontend/api/chunk_api_normalize.ts
import {
  chunkApiErrorToDetails,
  createInvalidPayloadError,
} from "./chunk_api_errors";
import type {
  ChunkApiAffectedCell,
  ChunkApiAnyResult,
  ChunkApiBatchChunkRequest,
  ChunkApiBatchResult,
  ChunkApiBlockCollectionKind,
  ChunkApiBlockDefinition,
  ChunkApiBlockMetadata,
  ChunkApiBlockSource,
  ChunkApiBlocksResult,
  ChunkApiChunkCoordinates,
  ChunkApiChunkFlags,
  ChunkApiChunkResult,
  ChunkApiCommandFlags,
  ChunkApiCommandResult,
  ChunkApiCommandStatus,
  ChunkApiCommandType,
  ChunkApiConnectionTestResult,
  ChunkApiErrorDetails,
  ChunkApiFailedResult,
  ChunkApiPaletteEntry,
  ChunkApiPlaceableBlockDefinition,
  ChunkApiPlaceableBlocksResult,
  ChunkApiProjectBootstrapResult,
  ChunkApiRequestMeta,
  ChunkApiResponseSource,
  ChunkApiRouteHints,
  ChunkApiRuntimeChunkContent,
  ChunkApiStatusResult,
  ChunkApiUnknownRecord,
} from "./chunk_api_models";
import {
  CHUNK_API_AIR_CELL_VALUE,
  CHUNK_API_CELL_ENCODING,
  CHUNK_API_IMPLICIT_SOLID_CELL_VALUE,
  CHUNK_API_CELL_INDEX_ORDER,
  CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE,
  CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE,
  CHUNK_API_CREATIVE_LIBRARY_ROUTE,
  CHUNK_API_DEFAULT_CELL_SIZE,
  CHUNK_API_DEFAULT_CHUNK_SIZE,
  CHUNK_API_DEFAULT_PLACEABLE_BLOCKS,
  CHUNK_API_DEFAULT_PROJECT_ID,
  CHUNK_API_DEFAULT_REGISTRY_ID,
  CHUNK_API_DEFAULT_REGISTRY_VERSION,
  CHUNK_API_DEFAULT_WORLD_ID,
  CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE,
  CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE,
  CHUNK_API_EDITOR_INVENTORY_ROUTE,
  CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  chunkApiChunkKeyFromCoordinates,
  normalizeChunkApiCoordinates,
} from "./chunk_api_models";
import {
  createChunkCellsFromRuns,
  createChunkCellsFromValues,
  getChunkCellStorageInfo,
} from "./chunk_cell_storage";

interface NormalizeResultOptions {
  readonly projectId?: string;
  readonly worldId?: string;
  readonly source?: ChunkApiResponseSource;
  readonly blockSource?: ChunkApiBlockSource;
  readonly allowFallback?: boolean;
}

interface NormalizeBlocksOptions extends NormalizeResultOptions {
  readonly fallbackBlocks?: readonly ChunkApiPlaceableBlockDefinition[];
}

interface NormalizeChunkOptions extends NormalizeResultOptions {
  readonly fallbackChunkKey?: string;
  readonly fallbackCoordinates?: ChunkApiChunkCoordinates;
}

interface NormalizeBatchOptions extends NormalizeResultOptions {
  readonly requestedChunks?: readonly ChunkApiBatchChunkRequest[];
}

type UnknownPathSegment = string | number;

function isRecord(value: unknown): value is ChunkApiUnknownRecord {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function parseJsonMaybe(value: unknown): unknown {
  try {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function readPath(root: unknown, path: readonly UnknownPathSegment[]): unknown {
  try {
    let current = parseJsonMaybe(root);

    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof segment === "number") {
        if (!Array.isArray(current)) {
          return undefined;
        }

        current = current[segment];
        continue;
      }

      if (!isRecord(current)) {
        return undefined;
      }

      current = parseJsonMaybe(current[segment]);
    }

    return current;
  } catch {
    return undefined;
  }
}

function readFirst(values: readonly unknown[]): unknown {
  try {
    for (const value of values) {
      if (value !== undefined && value !== null) {
        return value;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function readString(value: unknown, fallback: string): string {
  try {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function readNullableString(value: unknown, fallback: string | null = null): string | null {
  try {
    if (value === null) {
      return null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const converted = String(value).trim();
      return converted.length > 0 ? converted : fallback;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function readNumber(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, numeric));
  } catch {
    return fallback;
  }
}

function readInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    return Math.trunc(readNumber(value, fallback, min, max));
  } catch {
    return fallback;
  }
}

function readArray(value: unknown): readonly unknown[] {
  try {
    const parsed = parseJsonMaybe(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStringArray(value: unknown): readonly string[] {
  try {
    const array = readArray(value);
    const result: string[] = [];

    for (const item of array) {
      if (typeof item === "string" && item.trim().length > 0) {
        result.push(item.trim());
      }
    }

    return result;
  } catch {
    return [];
  }
}

function readRecord(value: unknown): ChunkApiUnknownRecord {
  try {
    const parsed = parseJsonMaybe(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeSource(
  request: ChunkApiRequestMeta | null | undefined,
  fallback?: ChunkApiResponseSource,
): ChunkApiResponseSource {
  try {
    return fallback ?? request?.source ?? "unknown";
  } catch {
    return "unknown";
  }
}

function createFailedResult(input: {
  readonly error: unknown;
  readonly request?: ChunkApiRequestMeta | null;
  readonly raw?: unknown;
  readonly source?: ChunkApiResponseSource;
}): ChunkApiFailedResult {
  const errorDetails: ChunkApiErrorDetails = chunkApiErrorToDetails(input.error);

  return {
    ok: false,
    request: input.request ?? null,
    source: input.source ?? input.request?.source ?? "unknown",
    raw: input.raw ?? null,
    error: errorDetails,
  };
}

function normalizeMetadata(value: unknown): ChunkApiBlockMetadata {
  try {
    const record = readRecord(value);
    return { ...record };
  } catch {
    return {};
  }
}

function normalizeBlockSource(value: unknown, fallback: ChunkApiBlockSource): ChunkApiBlockSource {
  const normalized = readString(value, fallback);

  if (
    normalized === "editor-placeholder-route"
    || normalized === "chunk-service-blocks-route"
    || normalized === "chunk-service-placeable-blocks-route"
    || normalized === "chunk-service-creative-library-route"
    || normalized === "chunk-palette"
    || normalized === "static-client-fallback"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeChunkContentSource(value: unknown): ChunkApiRuntimeChunkContent["source"] {
  const normalized = readString(value, "unknown");

  if (normalized === "snapshot" || normalized === "generated" || normalized === "unknown") {
    return normalized;
  }

  return "unknown";
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = readString(value, "").trim();
  return CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

function normalizeBlockTypeId(value: unknown, fallback = ""): string {
  const normalized = readString(value, fallback).trim();

  if (!normalized || isForbiddenDebugBlockTypeId(normalized)) {
    return "";
  }

  return normalized;
}

function normalizePaletteEntry(raw: unknown, paletteIndex: number): ChunkApiPaletteEntry | null {
  const record = readRecord(raw);
  const blockTypeId = normalizeBlockTypeId(
    typeof raw === "string" ? raw : readFirst([
      record.blockTypeId,
      record.typeId,
      record.id,
      record.slug,
    ]),
    "",
  );

  if (!blockTypeId) {
    return null;
  }

  const canonicalAir = blockTypeId.toLowerCase() === "system_air";
  const canonicalWater = blockTypeId.toLowerCase() === "system_water";

  return {
    blockTypeId,
    label: readString(
      readFirst([
        record.label,
        record.name,
        blockTypeId,
      ]),
      blockTypeId,
    ),
    registryId: readString(record.registryId, CHUNK_API_DEFAULT_REGISTRY_ID),
    registryVersion: readString(record.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION),
    solid: canonicalAir || canonicalWater ? false : readBoolean(record.solid, true),
    placeable: canonicalAir ? false : readBoolean(record.placeable, true),
    breakable: canonicalAir ? false : readBoolean(record.breakable, true),
    metadata: normalizeMetadata(record.metadata),
  };
}

function normalizePalette(raw: unknown): readonly ChunkApiPaletteEntry[] {
  try {
    const array = readArray(raw);
    const result: ChunkApiPaletteEntry[] = [];
    const seen = new Set<string>();

    array.forEach((entry, index) => {
      try {
        const normalized = normalizePaletteEntry(entry, index);

        if (!normalized || seen.has(normalized.blockTypeId)) {
          return;
        }

        seen.add(normalized.blockTypeId);
        result.push(normalized);
      } catch {
        // Drop invalid palette entries.
      }
    });

    return result;
  } catch {
    return [];
  }
}

function blockDefinitionFromPaletteEntry(
  entry: ChunkApiPaletteEntry,
  paletteIndex: number,
  source: ChunkApiBlockSource,
): ChunkApiBlockDefinition {
  return {
    blockTypeId: entry.blockTypeId,
    label: entry.label,
    registryId: entry.registryId,
    registryVersion: entry.registryVersion,
    cellValue: paletteIndex + 1,
    paletteIndex,
    solid: entry.solid,
    placeable: entry.placeable,
    breakable: entry.breakable,
    source,
    metadata: entry.metadata,
  };
}

function normalizeBlockDefinition(
  raw: unknown,
  index: number,
  source: ChunkApiBlockSource,
): ChunkApiBlockDefinition | null {
  const record = readRecord(raw);
  const blockTypeId = normalizeBlockTypeId(
    readFirst([
      record.blockTypeId,
      record.typeId,
      record.id,
      record.slug,
    ]),
    "",
  );

  if (!blockTypeId) {
    return null;
  }

  const paletteIndexRaw = readFirst([
    record.paletteIndex,
    readPath(record, ["palette", "index"]),
  ]);

  const paletteIndex = paletteIndexRaw === null
    ? null
    : readInteger(paletteIndexRaw, index, 0, Number.MAX_SAFE_INTEGER);

  const cellValue = readInteger(
    readFirst([
      record.cellValue,
      record.value,
    ]),
    paletteIndex === null ? index + 1 : paletteIndex + 1,
    1,
    Number.MAX_SAFE_INTEGER,
  );

  return {
    blockTypeId,
    label: readString(
      readFirst([
        record.label,
        record.name,
        blockTypeId,
      ]),
      blockTypeId,
    ),
    registryId: readString(record.registryId, CHUNK_API_DEFAULT_REGISTRY_ID),
    registryVersion: readString(record.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION),
    cellValue,
    paletteIndex,
    solid: readBoolean(record.solid, true),
    placeable: readBoolean(record.placeable, true),
    breakable: readBoolean(record.breakable, true),
    source: normalizeBlockSource(record.source, source),
    metadata: normalizeMetadata(record.metadata),
  };
}

function dedupeBlocks(blocks: readonly ChunkApiBlockDefinition[]): readonly ChunkApiBlockDefinition[] {
  try {
    const seen = new Set<string>();
    const result: ChunkApiBlockDefinition[] = [];

    for (const block of blocks) {
      const blockTypeId = normalizeBlockTypeId(block.blockTypeId);

      if (!blockTypeId || seen.has(blockTypeId)) {
        continue;
      }

      seen.add(blockTypeId);
      result.push({
        ...block,
        blockTypeId,
      });
    }

    return result;
  } catch {
    return [];
  }
}

function normalizeBlocksArray(raw: unknown, source: ChunkApiBlockSource): readonly ChunkApiBlockDefinition[] {
  try {
    const array = readArray(raw);
    const result: ChunkApiBlockDefinition[] = [];

    array.forEach((item, index) => {
      try {
        const block = normalizeBlockDefinition(item, index, source);

        if (block && block.blockTypeId.trim().length > 0) {
          result.push(block);
        }
      } catch {
        // Drop invalid block entries.
      }
    });

    return dedupeBlocks(result);
  } catch {
    return [];
  }
}

function toPlaceableBlock(block: ChunkApiBlockDefinition): ChunkApiPlaceableBlockDefinition | null {
  try {
    if (block.placeable !== true || isForbiddenDebugBlockTypeId(block.blockTypeId)) {
      return null;
    }

    return {
      ...block,
      blockTypeId: normalizeBlockTypeId(block.blockTypeId),
      placeable: true,
    };
  } catch {
    return null;
  }
}

function toPlaceableBlocks(blocks: readonly ChunkApiBlockDefinition[]): readonly ChunkApiPlaceableBlockDefinition[] {
  try {
    return blocks
      .map((block) => toPlaceableBlock(block))
      .filter((block): block is ChunkApiPlaceableBlockDefinition => block !== null);
  } catch {
    return [];
  }
}

function normalizePlaceableBlocksArray(
  raw: unknown,
  source: ChunkApiBlockSource,
): readonly ChunkApiPlaceableBlockDefinition[] {
  try {
    return normalizeBlocksArray(raw, source)
      .map((block) => toPlaceableBlock(block))
      .filter((block): block is ChunkApiPlaceableBlockDefinition => block !== null);
  } catch {
    return [];
  }
}

function normalizeBlocksFromPalette(
  palette: readonly ChunkApiPaletteEntry[],
  source: ChunkApiBlockSource,
): readonly ChunkApiBlockDefinition[] {
  try {
    return palette.map((entry, index) => blockDefinitionFromPaletteEntry(entry, index, source));
  } catch {
    return [];
  }
}

function mergeBlockCollections(
  primary: readonly ChunkApiBlockDefinition[],
  secondary: readonly ChunkApiBlockDefinition[],
): readonly ChunkApiBlockDefinition[] {
  try {
    return dedupeBlocks([...primary, ...secondary]);
  } catch {
    return dedupeBlocks(primary);
  }
}

/**
 * Legacy full block catalog payload.
 *
 * Productive Library/VPLIB inventory does not use this payload.
 */
function findRawBlocksPayload(raw: unknown): unknown {
  try {
    return readFirst([
      readPath(raw, ["blocks"]),
      readPath(raw, ["blockTypes"]),
      readPath(raw, ["items"]),
      readPath(raw, ["data", "blocks"]),
      readPath(raw, ["data", "blockTypes"]),
      readPath(raw, ["data", "items"]),
      readPath(raw, ["result", "blocks"]),
      readPath(raw, ["result", "blockTypes"]),
      readPath(raw, ["catalog", "blocks"]),
      readPath(raw, ["creativeLibrary", "blocks"]),
      readPath(raw, ["library", "blocks"]),
      readPath(raw, ["chunk", "blocks"]),
    ]);
  } catch {
    return undefined;
  }
}

/**
 * Legacy active chunk-placeable payload.
 *
 * Productive Library/VPLIB hotbar uses /editor/api/inventory instead.
 */
function findRawPlaceableBlocksPayload(raw: unknown): unknown {
  try {
    return readFirst([
      readPath(raw, ["placeableBlocks"]),
      readPath(raw, ["inventoryBlocks"]),
      readPath(raw, ["inventory"]),
      readPath(raw, ["inventory", "blocks"]),
      readPath(raw, ["hotbarBlocks"]),
      readPath(raw, ["hotbar", "blocks"]),
      readPath(raw, ["data", "placeableBlocks"]),
      readPath(raw, ["data", "inventoryBlocks"]),
      readPath(raw, ["data", "inventory"]),
      readPath(raw, ["data", "inventory", "blocks"]),
      readPath(raw, ["result", "placeableBlocks"]),
      readPath(raw, ["result", "inventoryBlocks"]),
      readPath(raw, ["result", "inventory"]),
      readPath(raw, ["result", "inventory", "blocks"]),
    ]);
  } catch {
    return undefined;
  }
}

function findRawPalettePayload(raw: unknown): unknown {
  try {
    return readFirst([
      readPath(raw, ["palette"]),
      readPath(raw, ["chunk", "palette"]),
      readPath(raw, ["content", "palette"]),
      readPath(raw, ["data", "palette"]),
      readPath(raw, ["data", "chunk", "palette"]),
      readPath(raw, ["result", "palette"]),
    ]);
  } catch {
    return undefined;
  }
}

function normalizeRouteHints(raw: unknown): Partial<ChunkApiRouteHints> {
  try {
    const record = readRecord(raw);
    const result: Record<string, string> = {};

    const keys: readonly string[] = [
      "status",
      "connectionTest",
      "projects",
      "project",
      "projectBootstrap",
      "worlds",
      "world",
      "blocks",
      "placeableBlocks",
      "editorInventory",
      "editorInventoryHealth",
      "editorInventoryMetadata",
      "creativeLibrary",
      "creativeLibraryHealth",
      "creativeLibraryMetadata",
      "chunk",
      "chunks",
      "chunksBatch",
      "commands",
      "defaultBlocks",
      "defaultChunk",
      "defaultChunksBatch",
      "defaultCommands",
    ];

    for (const key of keys) {
      const value = record[key];

      if (typeof value === "string" && value.trim().length > 0) {
        result[key] = value.trim();
      }
    }

    return result as Partial<ChunkApiRouteHints>;
  } catch {
    return {};
  }
}

function normalizeRouteHintsWithEditorDefaults(raw: unknown): Partial<ChunkApiRouteHints> {
  const hints = normalizeRouteHints(raw);

  return {
    editorInventory: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    editorInventoryHealth: CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE,
    editorInventoryMetadata: CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE,
    creativeLibrary: CHUNK_API_CREATIVE_LIBRARY_ROUTE,
    creativeLibraryHealth: CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE,
    creativeLibraryMetadata: CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE,
    ...hints,
  };
}

function normalizeChunkFlags(raw: unknown): ChunkApiChunkFlags {
  const record = readRecord(raw);

  return {
    snapshotBacked: readBoolean(
      readFirst([record.snapshotBacked, record.snapshot_backed]),
      false,
    ),
    providerGenerated: readBoolean(
      readFirst([record.providerGenerated, record.provider_generated]),
      false,
    ),
    materialized: readBoolean(record.materialized, false),
    createdSnapshot: readBoolean(
      readFirst([record.createdSnapshot, record.created_snapshot]),
      false,
    ),
  };
}

function normalizeChunkStats(raw: unknown, cells: readonly number[]) {
  try {
    const stats = readRecord(raw);
    const storageInfo = getChunkCellStorageInfo(cells);
    const cellCount = readInteger(stats.cellCount, cells.length, 0);
    const computedAirCellCount = storageInfo.airCellCount;
    const airCellCount = readInteger(
      readFirst([
        stats.airCellCount,
        stats.airCells,
        stats.air_cell_count,
      ]),
      computedAirCellCount,
      0,
    );
    const nonAirCellCount = readInteger(
      readFirst([
        stats.nonAirCellCount,
        stats.nonAirCells,
        stats.non_air_cell_count,
      ]),
      Math.max(0, cellCount - airCellCount),
      0,
    );
    const minimumSurfaceY = Number(
      readFirst([stats.minimumSurfaceY, stats.minimum_surface_y]),
    );
    const maximumSurfaceY = Number(
      readFirst([stats.maximumSurfaceY, stats.maximum_surface_y]),
    );

    return {
      cellCount,
      airCellCount,
      nonAirCellCount,
      minimumSurfaceY: Number.isFinite(minimumSurfaceY) ? minimumSurfaceY : undefined,
      maximumSurfaceY: Number.isFinite(maximumSurfaceY) ? maximumSurfaceY : undefined,
    };
  } catch {
    const airCellCount = getChunkCellStorageInfo(cells).airCellCount;

    return {
      cellCount: cells.length,
      airCellCount,
      nonAirCellCount: Math.max(0, cells.length - airCellCount),
    };
  }
}

function normalizeCells(raw: unknown): readonly number[] {
  try {
    if (!Array.isArray(raw)) {
      const encoded = readRecord(raw);
      if (readString(encoded.encoding, '') === 'rle-value-count.v1') {
        const expected = readInteger(encoded.decodedCellCount, 0, 1, 2_000_000);
        const runs = readArray(encoded.runs);
        if (runs.length === 0 || runs.length % 2 !== 0) return [];

        const normalizedRuns: number[] = [];
        let decodedCellCount = 0;
        for (let index = 0; index < runs.length; index += 2) {
          const value = readInteger(
            runs[index],
            CHUNK_API_AIR_CELL_VALUE,
            CHUNK_API_IMPLICIT_SOLID_CELL_VALUE,
            Number.MAX_SAFE_INTEGER,
          );
          const count = readInteger(runs[index + 1], 0, 1, expected);
          if (decodedCellCount + count > expected) return [];
          normalizedRuns.push(value, count);
          decodedCellCount += count;
        }
        return decodedCellCount === expected
          ? createChunkCellsFromRuns(expected, normalizedRuns)
          : [];
      }
    }

    const array = readArray(raw);
    return createChunkCellsFromValues(array, array.length, (value) => readInteger(
      value,
      CHUNK_API_AIR_CELL_VALUE,
      CHUNK_API_IMPLICIT_SOLID_CELL_VALUE,
      Number.MAX_SAFE_INTEGER,
    ));
  } catch {
    return [];
  }
}

function normalizeChunkCoordinates(
  raw: unknown,
  fallback?: ChunkApiChunkCoordinates,
): ChunkApiChunkCoordinates {
  const fallbackX = fallback?.chunkX ?? 0;
  const fallbackY = fallback?.chunkY ?? 0;
  const fallbackZ = fallback?.chunkZ ?? 0;

  return normalizeChunkApiCoordinates({
    chunkX: readInteger(
      readFirst([
        readPath(raw, ["chunkX"]),
        readPath(raw, ["x"]),
        fallbackX,
      ]),
      fallbackX,
    ),
    chunkY: readInteger(
      readFirst([
        readPath(raw, ["chunkY"]),
        readPath(raw, ["y"]),
        fallbackY,
      ]),
      fallbackY,
    ),
    chunkZ: readInteger(
      readFirst([
        readPath(raw, ["chunkZ"]),
        readPath(raw, ["z"]),
        fallbackZ,
      ]),
      fallbackZ,
    ),
  });
}

function normalizeRuntimeChunkContent(
  rawChunk: unknown,
  rawResponse: unknown,
  options?: NormalizeChunkOptions,
): ChunkApiRuntimeChunkContent {
  const chunkRecord = readRecord(rawChunk);
  const responseRecord = readRecord(rawResponse);
  const coordinates = normalizeChunkCoordinates(
    chunkRecord,
    options?.fallbackCoordinates,
  );
  const chunkKey = readString(
    readFirst([
      chunkRecord.chunkKey,
      responseRecord.chunkKey,
      options?.fallbackChunkKey,
      chunkApiChunkKeyFromCoordinates(coordinates),
    ]),
    chunkApiChunkKeyFromCoordinates(coordinates),
  );
  const cells = normalizeCells(
    readFirst([
      chunkRecord.cells,
      readPath(chunkRecord, ["content", "cells"]),
      readPath(responseRecord, ["cells"]),
      readPath(responseRecord, ["content", "cells"]),
      readPath(responseRecord, ["chunk", "cells"]),
    ]),
  );
  const palette = normalizePalette(
    readFirst([
      chunkRecord.palette,
      responseRecord.palette,
      readPath(responseRecord, ["content", "palette"]),
      readPath(responseRecord, ["chunk", "palette"]),
    ]),
  );
  const stats = normalizeChunkStats(
    readFirst([
      chunkRecord.stats,
      responseRecord.stats,
      readPath(responseRecord, ["chunk", "stats"]),
      readPath(responseRecord, ["content", "stats"]),
      readPath(responseRecord, ["metadata", "stats"]),
    ]),
    cells,
  );
  const revisionRaw = readFirst([
    chunkRecord.chunkRevision,
    chunkRecord.revision,
    readPath(responseRecord, ["snapshot", "chunkRevision"]),
    readPath(responseRecord, ["snapshot", "revision"]),
  ]);
  const revision = readInteger(revisionRaw, -1, -1);

  return {
    projectId: readString(
      readFirst([
        chunkRecord.projectId,
        responseRecord.projectId,
        options?.projectId,
      ]),
      options?.projectId ?? CHUNK_API_DEFAULT_PROJECT_ID,
    ),
    universeId: readNullableString(
      readFirst([
        chunkRecord.universeId,
        responseRecord.universeId,
      ]),
      null,
    ),
    worldId: readString(
      readFirst([
        chunkRecord.worldId,
        responseRecord.worldId,
        options?.worldId,
      ]),
      options?.worldId ?? CHUNK_API_DEFAULT_WORLD_ID,
    ),
    chunkKey,
    chunkX: coordinates.chunkX,
    chunkY: coordinates.chunkY,
    chunkZ: coordinates.chunkZ,
    chunkSize: readInteger(
      readFirst([
        chunkRecord.chunkSize,
        responseRecord.chunkSize,
        readPath(responseRecord, ["chunk", "chunkSize"]),
        readPath(responseRecord, ["content", "chunkSize"]),
      ]),
      CHUNK_API_DEFAULT_CHUNK_SIZE,
      1,
      512,
    ),
    cellSize: readNumber(
      readFirst([
        chunkRecord.cellSize,
        responseRecord.cellSize,
        readPath(responseRecord, ["chunk", "cellSize"]),
        readPath(responseRecord, ["content", "cellSize"]),
      ]),
      CHUNK_API_DEFAULT_CELL_SIZE,
      0.000001,
    ),
    cells,
    palette,
    stats,
    source: normalizeChunkContentSource(
      readFirst([
        chunkRecord.source,
        responseRecord.source,
      ]),
    ),
    snapshotId: readNullableString(
      readFirst([
        chunkRecord.snapshotId,
        readPath(responseRecord, ["snapshot", "snapshotId"]),
      ]),
      null,
    ),
    chunkRevision: revision >= 0 ? revision : null,
    chunkVersion: readNullableString(
      readFirst([
        chunkRecord.chunkVersion,
        readPath(responseRecord, ["snapshot", "chunkVersion"]),
      ]),
      null,
    ),
    schemaVersion: readNullableString(
      readFirst([
        chunkRecord.schemaVersion,
        readPath(responseRecord, ["snapshot", "schemaVersion"]),
      ]),
      null,
    ),
    runtimeContentVersion: readNullableString(
      readFirst([
        chunkRecord.runtimeContentVersion,
        readPath(responseRecord, ["snapshot", "runtimeContentVersion"]),
      ]),
      null,
    ),
    cellEncoding: CHUNK_API_CELL_ENCODING,
    cellIndexOrder: CHUNK_API_CELL_INDEX_ORDER,
    objectRefs: readArray(
      readFirst([
        chunkRecord.objectRefs,
        readPath(chunkRecord, ["content", "objectRefs"]),
        responseRecord.objectRefs,
        readPath(responseRecord, ["chunk", "objectRefs"]),
        readPath(responseRecord, ["content", "objectRefs"]),
        readPath(responseRecord, ["snapshot", "objectRefs"]),
      ]),
    ),
    metadata: readRecord(
      readFirst([
        chunkRecord.metadata,
        responseRecord.metadata,
      ]),
    ),
    raw: rawChunk,
  };
}

function validateRuntimeChunkContent(
  chunk: ChunkApiRuntimeChunkContent,
  request?: ChunkApiRequestMeta | null,
): void {
  if (chunk.cells.length === 0) {
    throw createInvalidPayloadError({
      request: request ?? null,
      message: "Chunk response did not contain cells.",
      details: {
        chunkKey: chunk.chunkKey,
      },
    });
  }

  if (chunk.palette.length === 0 && chunk.stats.nonAirCellCount > 0) {
    throw createInvalidPayloadError({
      request: request ?? null,
      message: "Chunk response contained non-air cells but no palette.",
      details: {
        chunkKey: chunk.chunkKey,
        nonAirCellCount: chunk.stats.nonAirCellCount,
      },
    });
  }
}

function normalizeAffectedCell(raw: unknown): ChunkApiAffectedCell {
  const record = readRecord(raw);

  return {
    x: readInteger(record.x, 0),
    y: readInteger(record.y, 0),
    z: readInteger(record.z, 0),
    localX: record.localX === undefined || record.localX === null ? null : readInteger(record.localX, 0),
    localY: record.localY === undefined || record.localY === null ? null : readInteger(record.localY, 0),
    localZ: record.localZ === undefined || record.localZ === null ? null : readInteger(record.localZ, 0),
    chunkKey: readNullableString(record.chunkKey, null),
    beforeCellValue: record.beforeCellValue === undefined || record.beforeCellValue === null ? null : readInteger(record.beforeCellValue, 0),
    afterCellValue: record.afterCellValue === undefined || record.afterCellValue === null ? null : readInteger(record.afterCellValue, 0),
    beforeBlockTypeId: readNullableString(record.beforeBlockTypeId, null),
    afterBlockTypeId: readNullableString(record.afterBlockTypeId, null),
  };
}

function normalizeCommandFlags(raw: unknown): ChunkApiCommandFlags {
  const record = readRecord(raw);

  return {
    dbBacked: readBoolean(record.dbBacked, true),
    projectScoped: readBoolean(record.projectScoped, true),
    snapshotWritten: readBoolean(record.snapshotWritten, false),
    eventsWritten: readBoolean(record.eventsWritten, false),
    objectCommand: readBoolean(record.objectCommand, false),
  };
}

function normalizeChunkVersions(raw: unknown): Readonly<Record<string, string>> {
  const record = readRecord(raw);
  const result: Record<string, string> = {};

  try {
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" && value.trim().length > 0) {
        result[key] = value.trim();
      }
    }
  } catch {
    return {};
  }

  return result;
}

function normalizeCommandType(value: unknown): ChunkApiCommandType {
  const normalized = readString(value, "SetBlock");

  if (
    normalized === "SetBlock"
    || normalized === "RemoveBlock"
    || normalized === "ReplaceBlock"
    || normalized === "WorldEdit"
    || normalized === "PlaceObject"
    || normalized === "RemoveObject"
    || normalized === "ObjectBatch"
  ) {
    return normalized;
  }

  return "SetBlock";
}

function normalizeCommandStatus(value: unknown): ChunkApiCommandStatus {
  const normalized = readString(value, "unknown");

  if (
    normalized === "pending"
    || normalized === "applied"
    || normalized === "noop"
    || normalized === "rejected"
    || normalized === "failed"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return "unknown";
}

function inferBlockCollectionKind(input: {
  readonly fullBlocks: readonly ChunkApiBlockDefinition[];
  readonly inventoryBlocks: readonly ChunkApiPlaceableBlockDefinition[];
  readonly usedFallback: boolean;
  readonly usedPalette: boolean;
}): ChunkApiBlockCollectionKind {
  if (input.usedFallback || input.usedPalette) {
    return "fallback";
  }

  if (input.fullBlocks.length > 0 && input.inventoryBlocks.length > 0) {
    return "combined";
  }

  if (input.fullBlocks.length > 0) {
    return "creative-library";
  }

  if (input.inventoryBlocks.length > 0) {
    return "inventory";
  }

  return "fallback";
}

function wrapLegacyBlockRaw(raw: unknown, reason: string): ChunkApiUnknownRecord {
  return {
    originalRaw: raw,
    reason,
    legacyDiagnosticOnly: true,
    productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
  };
}

export function normalizeChunkApiStatusResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeResultOptions,
): ChunkApiStatusResult | ChunkApiFailedResult {
  try {
    const record = readRecord(raw);

    if (readBoolean(record.ok, false) !== true) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk API status response was not ok.",
        details: {
          rawPreview: record,
        },
      });
    }

    const chunkService = readRecord(record.chunkService);
    const proxy = readRecord(record.proxy);

    return {
      ok: true,
      request: request ?? null,
      source: normalizeSource(request, options?.source ?? "editor-proxy"),
      raw,
      error: null,
      service: readString(record.service, "vectoplan-editor"),
      route: readNullableString(record.route, null),
      moduleVersion: readNullableString(record.moduleVersion, null),
      proxyReachable: readBoolean(
        readFirst([
          proxy.created,
          record.proxyReachable,
          true,
        ]),
        true,
      ),
      upstreamReachable: readBoolean(
        readFirst([
          chunkService.reachable,
          readPath(record, ["upstream", "reachable"]),
          record.upstreamReachable,
        ]),
        true,
      ),
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function normalizeChunkApiConnectionTestResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeResultOptions,
): ChunkApiConnectionTestResult | ChunkApiFailedResult {
  try {
    const record = readRecord(raw);

    if (readBoolean(record.ok, false) !== true) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk API connection test response was not ok.",
      });
    }

    return {
      ok: true,
      request: request ?? null,
      source: normalizeSource(request, options?.source ?? "editor-proxy"),
      raw,
      error: null,
      editorProxyReachable: readBoolean(record.editorProxyReachable, true),
      chunkServiceReachable: readBoolean(
        readFirst([
          record.chunkServiceReachable,
          readPath(record, ["chunkService", "reachable"]),
          readPath(record, ["upstream", "reachable"]),
          record.reachable,
        ]),
        true,
      ),
      projectId: readString(record.projectId, options?.projectId ?? CHUNK_API_DEFAULT_PROJECT_ID),
      worldId: readString(record.worldId, options?.worldId ?? CHUNK_API_DEFAULT_WORLD_ID),
      diagnostics: {
        ...readRecord(
          readFirst([
            record.diagnostics,
            record.proxy,
            record.chunkService,
            record,
          ]),
        ),
        productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
      },
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function normalizeChunkApiProjectBootstrapResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeResultOptions,
): ChunkApiProjectBootstrapResult | ChunkApiFailedResult {
  try {
    const record = readRecord(raw);

    if (readBoolean(record.ok, false) !== true) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk project bootstrap response was not ok.",
      });
    }

    return {
      ok: true,
      request: request ?? null,
      source: normalizeSource(request, options?.source ?? "editor-proxy"),
      raw,
      error: null,
      projectId: readString(record.projectId, options?.projectId ?? CHUNK_API_DEFAULT_PROJECT_ID),
      universeId: readNullableString(record.universeId, null),
      worldId: readString(
        readFirst([
          record.worldId,
          record.defaultWorldId,
          record.spawnWorldId,
        ]),
        options?.worldId ?? CHUNK_API_DEFAULT_WORLD_ID,
      ),
      defaultWorldId: readNullableString(record.defaultWorldId, null),
      spawnWorldId: readNullableString(record.spawnWorldId, null),
      routeHints: normalizeRouteHintsWithEditorDefaults(record.routeHints),
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function normalizeChunkApiBlocksResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeBlocksOptions,
): ChunkApiBlocksResult | ChunkApiFailedResult {
  try {
    const record = readRecord(raw);
    const rawBlocks = findRawBlocksPayload(raw);
    const rawPlaceableBlocks = findRawPlaceableBlocksPayload(raw);
    const rawPalette = findRawPalettePayload(raw);
    const palette = normalizePalette(rawPalette);
    const rawBlocksArray = readArray(rawBlocks);
    const rawPlaceableBlocksArray = readArray(rawPlaceableBlocks);

    const defaultBlockSource = palette.length > 0 && rawBlocksArray.length === 0
      ? "chunk-palette"
      : "chunk-service-blocks-route";
    const blockSource = options?.blockSource ?? defaultBlockSource;
    const placeableSource: ChunkApiBlockSource =
      blockSource === "chunk-service-creative-library-route"
        ? "chunk-service-placeable-blocks-route"
        : blockSource;

    let fullBlocks = normalizeBlocksArray(rawBlocks, blockSource);
    let inventoryBlocks = normalizePlaceableBlocksArray(rawPlaceableBlocks, placeableSource);
    let usedPaletteFallback = false;
    let usedStaticFallback = false;

    if (fullBlocks.length === 0 && palette.length > 0) {
      fullBlocks = normalizeBlocksFromPalette(palette, "chunk-palette");
      usedPaletteFallback = true;
    }

    if (inventoryBlocks.length === 0) {
      inventoryBlocks = toPlaceableBlocks(fullBlocks);
    }

    if (fullBlocks.length === 0 && inventoryBlocks.length > 0) {
      fullBlocks = inventoryBlocks;
    }

    if (fullBlocks.length === 0 && options?.allowFallback !== false) {
      fullBlocks = options?.fallbackBlocks ?? CHUNK_API_DEFAULT_PLACEABLE_BLOCKS;
      usedStaticFallback = fullBlocks.length > 0;
    }

    if (inventoryBlocks.length === 0 && options?.allowFallback !== false) {
      inventoryBlocks = toPlaceableBlocks(fullBlocks);

      if (inventoryBlocks.length === 0) {
        inventoryBlocks = options?.fallbackBlocks ?? CHUNK_API_DEFAULT_PLACEABLE_BLOCKS;
        usedStaticFallback = usedStaticFallback || inventoryBlocks.length > 0;
      }
    }

    if (fullBlocks.length === 0 && inventoryBlocks.length === 0 && options?.allowFallback === false) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk block response did not contain a usable legacy block catalog.",
        details: {
          hasRawBlocks: rawBlocks !== undefined,
          hasRawPlaceableBlocks: rawPlaceableBlocks !== undefined,
          paletteLength: palette.length,
          allowFallback: options?.allowFallback ?? true,
          productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
        },
      });
    }

    const mergedFullBlocks = mergeBlockCollections(fullBlocks, inventoryBlocks);
    const registryId = readString(
      readFirst([
        record.registryId,
        readPath(mergedFullBlocks, [0, "registryId"]),
        readPath(inventoryBlocks, [0, "registryId"]),
      ]),
      CHUNK_API_DEFAULT_REGISTRY_ID,
    );
    const registryVersion = readString(
      readFirst([
        record.registryVersion,
        readPath(mergedFullBlocks, [0, "registryVersion"]),
        readPath(inventoryBlocks, [0, "registryVersion"]),
      ]),
      CHUNK_API_DEFAULT_REGISTRY_VERSION,
    );
    const collectionKind = inferBlockCollectionKind({
      fullBlocks: mergedFullBlocks,
      inventoryBlocks,
      usedFallback: usedStaticFallback,
      usedPalette: usedPaletteFallback,
    });

    return {
      ok: true,
      request: request ?? null,
      source: normalizeSource(request, options?.source ?? (
        usedPaletteFallback ? "chunk-palette-fallback" : "editor-proxy"
      )),
      raw: wrapLegacyBlockRaw(raw, "legacy-blocks-normalized"),
      error: null,
      projectId: readString(record.projectId, options?.projectId ?? CHUNK_API_DEFAULT_PROJECT_ID),
      worldId: readString(record.worldId, options?.worldId ?? CHUNK_API_DEFAULT_WORLD_ID),
      registryId,
      registryVersion,

      /**
       * Legacy/diagnostic full catalog.
       */
      blocks: mergedFullBlocks,

      /**
       * Legacy/diagnostic placeable list.
       *
       * Productive hotbar inventory uses /editor/api/inventory.
       */
      placeableBlocks: inventoryBlocks,

      sourceKind: usedPaletteFallback
        ? "chunk-palette"
        : usedStaticFallback
          ? "static-client-fallback"
          : blockSource,
      usedPaletteFallback: readBoolean(record.usedPaletteFallback, usedPaletteFallback),
      collectionKind,
      inventoryRouteKind: "placeable-blocks",
      creativeLibraryRouteKind: "blocks",
      inventoryBlockCount: inventoryBlocks.length,
      creativeLibraryBlockCount: mergedFullBlocks.length,
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function normalizeChunkApiPlaceableBlocksResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeBlocksOptions,
): ChunkApiPlaceableBlocksResult | ChunkApiFailedResult {
  try {
    const normalized = normalizeChunkApiBlocksResult(raw, request, {
      ...options,
      blockSource: options?.blockSource ?? "chunk-service-placeable-blocks-route",
      source: options?.source ?? "editor-proxy",
      allowFallback: options?.allowFallback ?? true,
    });

    if (normalized.ok === false) {
      return normalized;
    }

    const placeableBlocks = normalized.placeableBlocks.length > 0
      ? normalized.placeableBlocks
      : toPlaceableBlocks(normalized.blocks);

    return {
      ...normalized,

      /**
       * Legacy diagnostic only. Empty is valid because productive inventory comes
       * from /editor/api/inventory.
       */
      blocks: placeableBlocks,
      placeableBlocks,
      raw: wrapLegacyBlockRaw(raw, "legacy-placeable-blocks-normalized"),
      sourceKind: normalized.sourceKind === "chunk-service-creative-library-route"
        ? "chunk-service-placeable-blocks-route"
        : normalized.sourceKind,
      collectionKind: placeableBlocks.length > 0 ? "inventory" : "fallback",
      inventoryRouteKind: "placeable-blocks",
      creativeLibraryRouteKind: "blocks",
      inventoryBlockCount: placeableBlocks.length,
      creativeLibraryBlockCount: placeableBlocks.length,
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function normalizeChunkApiChunkResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeChunkOptions,
): ChunkApiChunkResult | ChunkApiFailedResult {
  try {
    const record = readRecord(raw);

    if (readBoolean(record.ok, false) !== true) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk response was not ok.",
        details: {
          rawStatus: record.ok,
        },
      });
    }

    const rawChunk = readFirst([
      record.chunk,
      record.content,
      record.data,
      raw,
    ]);

    const chunk = normalizeRuntimeChunkContent(rawChunk, raw, options);
    validateRuntimeChunkContent(chunk, request);

    return {
      ok: true,
      request: request ?? null,
      source: normalizeSource(request, options?.source ?? "editor-proxy"),
      raw,
      error: null,
      projectId: readString(record.projectId, chunk.projectId),
      universeId: readNullableString(record.universeId, chunk.universeId),
      worldId: readString(record.worldId, chunk.worldId),
      chunkKey: readString(record.chunkKey, chunk.chunkKey),
      chunk,
      flags: normalizeChunkFlags(record.flags),
      routeHints: normalizeRouteHintsWithEditorDefaults(record.routeHints),
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function normalizeChunkApiBatchResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeBatchOptions,
): ChunkApiBatchResult | ChunkApiFailedResult {
  try {
    const record = readRecord(raw);

    if (readBoolean(record.ok, false) !== true) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk batch response was not ok.",
      });
    }

    const rawChunks = readArray(
      readFirst([
        record.chunks,
        readPath(record, ["data", "chunks"]),
        readPath(record, ["result", "chunks"]),
      ]),
    );
    const chunks: ChunkApiRuntimeChunkContent[] = [];
    const failedChunks: ChunkApiChunkCoordinates[] = [];

    rawChunks.forEach((rawChunk, index) => {
      try {
        const requested = options?.requestedChunks?.[index];
        const fallbackCoordinates = requested
          ? normalizeChunkCoordinates(requested)
          : undefined;
        // Batch endpoints return one response envelope per chunk, while a few
        // legacy providers return the chunk directly. Normalize the productive
        // payload, not the envelope. Keeping the envelope as rawResponse still
        // preserves project/world/snapshot metadata and backwards compatibility.
        const rawChunkRecord = readRecord(rawChunk);
        const rawChunkContent = readFirst([
          rawChunkRecord.chunk,
          rawChunkRecord.content,
          rawChunkRecord.data,
          rawChunk,
        ]);
        const chunk = normalizeRuntimeChunkContent(rawChunkContent, rawChunk, {
          projectId: options?.projectId,
          worldId: options?.worldId,
          fallbackCoordinates,
        });
        validateRuntimeChunkContent(chunk, request);
        chunks.push(chunk);
      } catch {
        const requested = options?.requestedChunks?.[index];

        if (requested) {
          failedChunks.push(normalizeChunkCoordinates(requested));
        }
      }
    });

    for (const failed of readArray(record.failedChunks)) {
      try {
        failedChunks.push(normalizeChunkCoordinates(failed));
      } catch {
        // Drop invalid failed chunk entries.
      }
    }

    if (chunks.length === 0) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk batch response did not contain valid chunks.",
      });
    }

    return {
      ok: true,
      request: request ?? null,
      source: normalizeSource(request, options?.source ?? "editor-proxy"),
      raw,
      error: null,
      projectId: readString(record.projectId, options?.projectId ?? chunks[0]?.projectId ?? CHUNK_API_DEFAULT_PROJECT_ID),
      worldId: readString(record.worldId, options?.worldId ?? chunks[0]?.worldId ?? CHUNK_API_DEFAULT_WORLD_ID),
      chunks,
      failedChunks,
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function normalizeChunkApiCommandResult(
  raw: unknown,
  request?: ChunkApiRequestMeta | null,
  options?: NormalizeResultOptions,
): ChunkApiCommandResult | ChunkApiFailedResult {
  try {
    const record = readRecord(raw);

    if (readBoolean(record.ok, false) !== true) {
      throw createInvalidPayloadError({
        request: request ?? null,
        message: "Chunk command response was not ok.",
        details: {
          code: readPath(record, ["error", "code"]),
          message: readPath(record, ["error", "message"]),
        },
      });
    }

    const commandType = normalizeCommandType(
      readFirst([
        record.commandType,
        record.type,
        readPath(record, ["command", "type"]),
      ]),
    );
    const commandStatus = normalizeCommandStatus(
      readFirst([
        record.commandStatus,
        record.status,
      ]),
    );
    const affectedCells = readArray(record.affectedCells).map((cell) => normalizeAffectedCell(cell));

    return {
      ok: true,
      request: request ?? null,
      source: normalizeSource(request, options?.source ?? "editor-proxy"),
      raw,
      error: null,
      projectId: readString(record.projectId, options?.projectId ?? CHUNK_API_DEFAULT_PROJECT_ID),
      worldId: readString(record.worldId, options?.worldId ?? CHUNK_API_DEFAULT_WORLD_ID),
      commandType,
      commandStatus,
      changed: readBoolean(record.changed, affectedCells.length > 0),
      eventIds: readStringArray(record.eventIds),
      snapshotIds: readStringArray(record.snapshotIds),
      changedChunks: readStringArray(record.changedChunks),
      dirtyChunks: readStringArray(record.dirtyChunks),
      affectedCells,
      chunkVersions: normalizeChunkVersions(record.chunkVersions),
      flags: normalizeCommandFlags(record.flags),
    };
  } catch (error) {
    return createFailedResult({
      error,
      request,
      raw,
      source: options?.source ?? normalizeSource(request),
    });
  }
}

export function buildBlocksResultFromChunkResult(
  chunkResult: ChunkApiChunkResult,
  request?: ChunkApiRequestMeta | null,
): ChunkApiBlocksResult | ChunkApiFailedResult {
  try {
    const blocks = normalizeBlocksFromPalette(chunkResult.chunk.palette, "chunk-palette");
    const placeableBlocks = toPlaceableBlocks(blocks);

    return {
      ok: true,
      request: request ?? chunkResult.request,
      source: "chunk-palette-fallback",
      raw: wrapLegacyBlockRaw(chunkResult.raw, "chunk-palette-diagnostic-fallback"),
      error: null,
      projectId: chunkResult.projectId,
      worldId: chunkResult.worldId,
      registryId: readString(readPath(blocks, [0, "registryId"]), CHUNK_API_DEFAULT_REGISTRY_ID),
      registryVersion: readString(readPath(blocks, [0, "registryVersion"]), CHUNK_API_DEFAULT_REGISTRY_VERSION),
      blocks,
      placeableBlocks,
      sourceKind: "chunk-palette",
      usedPaletteFallback: true,
      collectionKind: "fallback",
      inventoryRouteKind: "placeable-blocks",
      creativeLibraryRouteKind: "blocks",
      inventoryBlockCount: placeableBlocks.length,
      creativeLibraryBlockCount: blocks.length,
    };
  } catch (error) {
    return createFailedResult({
      error,
      request: request ?? chunkResult.request,
      raw: chunkResult.raw,
      source: "chunk-palette-fallback",
    });
  }
}

export function buildStaticFallbackBlocksResult(input: {
  readonly projectId: string;
  readonly worldId: string;
  readonly request?: ChunkApiRequestMeta | null;
  readonly raw?: unknown;
}): ChunkApiBlocksResult {
  const blocks = CHUNK_API_DEFAULT_PLACEABLE_BLOCKS;

  return {
    ok: true,
    request: input.request ?? null,
    source: "client-fallback",
    raw: wrapLegacyBlockRaw(input.raw ?? null, "empty-static-diagnostic-fallback"),
    error: null,
    projectId: input.projectId || CHUNK_API_DEFAULT_PROJECT_ID,
    worldId: input.worldId || CHUNK_API_DEFAULT_WORLD_ID,
    registryId: CHUNK_API_DEFAULT_REGISTRY_ID,
    registryVersion: CHUNK_API_DEFAULT_REGISTRY_VERSION,
    blocks,
    placeableBlocks: blocks,
    sourceKind: "static-client-fallback",
    usedPaletteFallback: false,
    collectionKind: "fallback",
    inventoryRouteKind: "placeable-blocks",
    creativeLibraryRouteKind: "blocks",
    inventoryBlockCount: blocks.length,
    creativeLibraryBlockCount: blocks.length,
  };
}

export function assertChunkApiSuccess<T extends ChunkApiAnyResult>(
  result: T,
): Exclude<T, ChunkApiFailedResult> {
  if (result.ok === false) {
    throw new Error(result.error.message);
  }

  return result as Exclude<T, ChunkApiFailedResult>;
}

export function getChunkApiNormalizeMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.api.chunk_api_normalize",
    productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    defaultPlaceableBlocksCount: CHUNK_API_DEFAULT_PLACEABLE_BLOCKS.length,
    rules: {
      normalizesChunkWorldPayloads: true,
      chunkBlockCatalogsAreLegacyDiagnosticOnly: true,
      placeableBlocksCanBeEmpty: true,
      debugGrassDirtFiltered: true,
      staticFallbackHasNoDebugBlocks: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
    },
  };
}
