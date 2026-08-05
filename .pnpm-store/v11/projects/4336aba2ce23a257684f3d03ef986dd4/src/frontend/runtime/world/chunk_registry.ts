// src/frontend/runtime/world/chunk_registry.ts
import type { ChunkApiRuntimeChunkContent } from "@api/chunk_api_models";
import { CHUNK_API_AIR_CELL_VALUE } from "@api/chunk_api_models";
import type { EditorLogger } from "@utils/logger";
import { chunkKeyFromCoordinates } from "@utils/ids";
import {
  normalizeUnknownError,
  safeInteger,
  safeString,
  uniqueStrings,
} from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type {
  BlockCollisionWorldCellInput,
  BlockCollisionWorldCellResult,
  BlockCollisionWorldReader,
  BlockCollisionMissingCellReason,
} from "../physics/block_collision_query";
import {
  createChunkCellAddress,
  sortChunkKeys,
  uniqueChunkKeys,
  type ChunkCellAddress,
  type ChunkCoordinates,
  type ChunkWorldPosition,
} from "./chunk_coordinates";
import {
  type RuntimeCellSample,
  type RuntimeChunkContent,
  createRuntimeChunkContent,
  isSystemAirBlockTypeId,
  runtimeChunkContentToDebugSummary,
  sampleCellAtLocalCoordinates,
  sampleCellAtWorldPosition,
} from "./chunk_content";

export type ChunkRegistryEntryStatus =
  | "loaded"
  | "dirty"
  | "failed"
  | "evicted";

export interface ChunkRegistryEntryError {
  readonly message: string;
  readonly code: string | null;
  readonly createdAt: string;
  readonly details: Record<string, unknown> | null;
}

export interface ChunkRegistryEntry {
  readonly chunkKey: string;
  readonly chunk: RuntimeChunkContent;
  readonly status: ChunkRegistryEntryStatus;
  readonly visible: boolean;
  readonly dirty: boolean;
  readonly loadedAt: string;
  readonly updatedAt: string;
  readonly lastAccessedAt: string;
  readonly loadCount: number;
  readonly error: ChunkRegistryEntryError | null;
}

export interface ChunkRegistryStats {
  readonly chunkCount: number;
  readonly visibleChunkCount: number;
  readonly dirtyChunkCount: number;
  readonly failedChunkCount: number;
  readonly cellCount: number;
  readonly nonAirCellCount: number;
  readonly solidCellCount: number;
  readonly nonSolidCellCount: number;
  readonly maxChunks: number;
  readonly lastUpdatedAt: string | null;
}

export interface ChunkRegistrySnapshot {
  readonly kind: "chunk-registry-snapshot.v1";
  readonly chunkKeys: readonly string[];
  readonly visibleChunkKeys: readonly string[];
  readonly dirtyChunkKeys: readonly string[];
  readonly failedChunkKeys: readonly string[];
  readonly entries: readonly ChunkRegistryEntry[];
  readonly stats: ChunkRegistryStats;
}

export interface CreateChunkRegistryOptions {
  readonly logger?: EditorLogger;
  readonly maxChunks?: number;
  readonly defaultChunkSize?: number;
  readonly defaultProjectId?: string;
  readonly defaultWorldId?: string;
}

export interface SetChunkOptions {
  readonly visible?: boolean;
  readonly dirty?: boolean;
  readonly reason?: string;
}

export interface MarkDirtyOptions {
  readonly reason?: string;
  readonly includeUnloaded?: boolean;
}

export interface RegistrySampleResult extends RuntimeCellSample {
  readonly chunkLoaded: boolean;
}

export interface RegistryCollisionCellResult extends BlockCollisionWorldCellResult {
  readonly kind: "air" | "solid" | "non_solid" | "liquid" | "trigger" | "unknown";
  readonly solid: boolean;
  readonly loaded: boolean;
  readonly blockTypeId: string | null;
  readonly missingReason: BlockCollisionMissingCellReason | null;
  readonly source: string;
  readonly chunkKey: string;
  readonly cellValue: number;
}

export interface ChunkRegistryHandle {
  readonly kind: "vectoplan-editor-chunk-registry.v1";

  setChunk(chunk: RuntimeChunkContent, options?: SetChunkOptions): RuntimeChunkContent;
  setApiChunk(chunk: ChunkApiRuntimeChunkContent, options?: SetChunkOptions): RuntimeChunkContent;
  setChunks(chunks: readonly RuntimeChunkContent[], options?: SetChunkOptions): readonly RuntimeChunkContent[];
  setApiChunks(chunks: readonly ChunkApiRuntimeChunkContent[], options?: SetChunkOptions): readonly RuntimeChunkContent[];

  getChunk(chunkKey: string): RuntimeChunkContent | null;
  getEntry(chunkKey: string): ChunkRegistryEntry | null;
  hasChunk(chunkKey: string): boolean;
  requireChunk(chunkKey: string): RuntimeChunkContent;

  deleteChunk(chunkKey: string, reason?: string): boolean;
  clear(reason?: string): void;

  getChunkKeys(): readonly string[];
  getVisibleChunkKeys(): readonly string[];
  getDirtyChunkKeys(): readonly string[];
  getFailedChunkKeys(): readonly string[];

  setVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[];
  addVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[];
  removeVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[];

  markChunkDirty(chunkKey: string, options?: MarkDirtyOptions): readonly string[];
  markChunksDirty(chunkKeys: readonly string[], options?: MarkDirtyOptions): readonly string[];
  clearDirtyChunk(chunkKey: string, reason?: string): readonly string[];
  clearDirtyChunks(chunkKeys: readonly string[], reason?: string): readonly string[];
  clearAllDirtyChunks(reason?: string): void;

  markChunkFailed(chunkKey: string, error: unknown, reason?: string): void;
  clearChunkError(chunkKey: string, reason?: string): void;

  sampleCellByWorldPosition(position: ChunkWorldPosition): RegistrySampleResult;
  sampleCellByAddress(address: ChunkCellAddress): RegistrySampleResult;

  /**
   * Read-only collision helpers for the local physics runtime.
   *
   * These methods never perform network requests. Missing chunks are reported
   * as loaded=false so the physics query can decide whether to block movement,
   * request chunk loading, or treat the cell as air.
   */
  isCellLoaded(cell: BlockCollisionWorldCellInput | ChunkWorldPosition): boolean;
  getCollisionCell(cell: BlockCollisionWorldCellInput | ChunkWorldPosition): RegistryCollisionCellResult;
  createBlockCollisionWorldReader(sourceName?: string): BlockCollisionWorldReader;

  getStats(): ChunkRegistryStats;
  getSnapshot(): ChunkRegistrySnapshot;
  debugSummary(): Record<string, unknown>;

  destroy(reason?: string): void;
}

const CHUNK_REGISTRY_KIND = "vectoplan-editor-chunk-registry.v1" as const;
const CHUNK_REGISTRY_SNAPSHOT_KIND = "chunk-registry-snapshot.v1" as const;
const DEFAULT_MAX_CHUNKS = 512;
const DEFAULT_CHUNK_SIZE = 16;

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Registry logging must never break runtime.
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
    // Registry logging must never break runtime.
  }
}

function normalizeMaxChunks(value: unknown): number {
  try {
    return safeInteger(value, DEFAULT_MAX_CHUNKS, {
      min: 16,
      max: 20_000,
    });
  } catch {
    return DEFAULT_MAX_CHUNKS;
  }
}

function normalizeChunkSize(value: unknown): number {
  try {
    return safeInteger(value, DEFAULT_CHUNK_SIZE, {
      min: 1,
      max: 512,
    });
  } catch {
    return DEFAULT_CHUNK_SIZE;
  }
}

function normalizeProjectId(value: unknown): string {
  return safeString(value, "dev-project");
}

function normalizeWorldId(value: unknown): string {
  return safeString(value, "world_spawn");
}

function normalizeWorldCoordinate(value: unknown): number {
  try {
    return safeInteger(value, 0, {
      min: Number.MIN_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER,
    });
  } catch {
    return 0;
  }
}

function createRegistryError(error: unknown): ChunkRegistryEntryError {
  const normalized = normalizeUnknownError(error);

  return {
    message: normalized.message,
    code: normalized.code,
    createdAt: nowIsoString(),
    details: normalized.details,
  };
}

function createEmptySample(address: ChunkCellAddress): RegistrySampleResult {
  return {
    exists: false,
    chunkLoaded: false,
    chunkKey: address.chunkKey,
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

function createMissingCollisionCell(
  address: ChunkCellAddress,
  reason: BlockCollisionMissingCellReason,
  source = "chunk-registry",
): RegistryCollisionCellResult {
  return {
    kind: "unknown",
    solid: false,
    loaded: false,
    blockTypeId: null,
    policy: "treat_as_air",
    missingReason: reason,
    source,
    chunkKey: address.chunkKey,
    cellValue: CHUNK_API_AIR_CELL_VALUE,
  };
}

function createCollisionCellFromSample(
  sample: RegistrySampleResult,
  source = "chunk-registry",
): RegistryCollisionCellResult {
  try {
    if (!sample.chunkLoaded) {
      return createMissingCollisionCell(sample.address, "chunk_missing", source);
    }

    /**
     * Wichtig:
     * In sparse Chunk-Formaten bedeutet "sample.exists === false" innerhalb
     * eines geladenen Chunks normalerweise: diese Zelle ist Air.
     *
     * Vorher wurde daraus "cell_missing" + solid=true. Dadurch blockierte die
     * Physics Runtime Bewegung in leerem Raum.
     */
    if (!sample.exists) {
      return {
        kind: "air",
        solid: false,
        loaded: true,
        blockTypeId: null,
        policy: undefined,
        missingReason: null,
        source,
        chunkKey: sample.chunkKey,
        cellValue: CHUNK_API_AIR_CELL_VALUE,
      };
    }

    if (
      sample.air ||
      sample.cellValue === CHUNK_API_AIR_CELL_VALUE ||
      sample.collisionKind === "air" ||
      isSystemAirBlockTypeId(sample.blockTypeId)
    ) {
      return {
        kind: "air",
        solid: false,
        loaded: true,
        blockTypeId: null,
        policy: undefined,
        missingReason: null,
        source,
        chunkKey: sample.chunkKey,
        cellValue: sample.cellValue,
      };
    }

    return {
      kind: sample.collisionKind === "unknown" ? "unknown" : sample.collisionKind,
      solid: sample.solid,
      loaded: true,
      blockTypeId: sample.blockTypeId,
      policy: undefined,
      missingReason: null,
      source,
      chunkKey: sample.chunkKey,
      cellValue: sample.cellValue,
    };
  } catch {
    return createMissingCollisionCell(sample.address, "unknown", source);
  }
}

function normalizeChunkKey(value: unknown): string {
  try {
    const raw = safeString(value, "");

    if (raw.length > 0) {
      return raw;
    }

    return chunkKeyFromCoordinates(0, 0, 0);
  } catch {
    return chunkKeyFromCoordinates(0, 0, 0);
  }
}

function chunkCoordinatesFromContent(chunk: RuntimeChunkContent): ChunkCoordinates {
  return {
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    chunkZ: chunk.chunkZ,
  };
}

function createAddressFromWorldCell(
  cell: BlockCollisionWorldCellInput | ChunkWorldPosition,
  chunkSize: number,
): ChunkCellAddress {
  try {
    return createChunkCellAddress({
      worldX: normalizeWorldCoordinate(cell.x),
      worldY: normalizeWorldCoordinate(cell.y),
      worldZ: normalizeWorldCoordinate(cell.z),
      chunkSize,
    });
  } catch {
    return createChunkCellAddress({
      worldX: 0,
      worldY: 0,
      worldZ: 0,
      chunkSize,
    });
  }
}

function createEntry(
  chunk: RuntimeChunkContent,
  existing: ChunkRegistryEntry | null,
  options?: SetChunkOptions,
): ChunkRegistryEntry {
  const now = nowIsoString();
  const visible = options?.visible ?? existing?.visible ?? false;
  const dirty = options?.dirty ?? false;

  return {
    chunkKey: chunk.chunkKey,
    chunk,
    status: dirty ? "dirty" : "loaded",
    visible,
    dirty,
    loadedAt: existing?.loadedAt ?? now,
    updatedAt: now,
    lastAccessedAt: now,
    loadCount: (existing?.loadCount ?? 0) + 1,
    error: null,
  };
}

function touchEntry(entry: ChunkRegistryEntry): ChunkRegistryEntry {
  return {
    ...entry,
    lastAccessedAt: nowIsoString(),
  };
}

function markEntryDirty(entry: ChunkRegistryEntry): ChunkRegistryEntry {
  return {
    ...entry,
    dirty: true,
    status: "dirty",
    updatedAt: nowIsoString(),
  };
}

function clearEntryDirty(entry: ChunkRegistryEntry): ChunkRegistryEntry {
  return {
    ...entry,
    dirty: false,
    status: entry.error ? "failed" : "loaded",
    updatedAt: nowIsoString(),
  };
}

function markEntryVisible(entry: ChunkRegistryEntry, visible: boolean): ChunkRegistryEntry {
  return {
    ...entry,
    visible,
    updatedAt: nowIsoString(),
  };
}

function markEntryFailed(entry: ChunkRegistryEntry, error: unknown): ChunkRegistryEntry {
  return {
    ...entry,
    status: "failed",
    error: createRegistryError(error),
    updatedAt: nowIsoString(),
  };
}

function clearEntryError(entry: ChunkRegistryEntry): ChunkRegistryEntry {
  return {
    ...entry,
    status: entry.dirty ? "dirty" : "loaded",
    error: null,
    updatedAt: nowIsoString(),
  };
}

function createFailedPlaceholderEntry(input: {
  readonly chunkKey: string;
  readonly error: unknown;
  readonly defaultChunkSize: number;
  readonly defaultProjectId: string;
  readonly defaultWorldId: string;
}): ChunkRegistryEntry {
  const now = nowIsoString();
  const [chunkXRaw, chunkYRaw, chunkZRaw] = input.chunkKey.split(":");

  const chunkX = safeInteger(chunkXRaw, 0);
  const chunkY = safeInteger(chunkYRaw, 0);
  const chunkZ = safeInteger(chunkZRaw, 0);

  const placeholderRaw: ChunkApiRuntimeChunkContent = {
    projectId: input.defaultProjectId,
    universeId: null,
    worldId: input.defaultWorldId,
    chunkKey: input.chunkKey,
    chunkX,
    chunkY,
    chunkZ,
    chunkSize: input.defaultChunkSize,
    cellSize: 1,
    cells: [],
    palette: [],
    stats: {
      cellCount: 0,
      airCellCount: 0,
      nonAirCellCount: 0,
    },
    source: "unknown",
    snapshotId: null,
    chunkRevision: null,
    chunkVersion: null,
    schemaVersion: null,
    runtimeContentVersion: null,
    cellEncoding: {
      version: "cell-encoding.palette-index-plus-one.v1",
      airCellValue: 0,
      blockCellValueRule: "paletteIndex + 1",
    },
    cellIndexOrder: "x-fastest-y-then-z",
    metadata: {},
    raw: null,
  };

  return {
    chunkKey: input.chunkKey,
    chunk: createRuntimeChunkContent(placeholderRaw),
    status: "failed",
    visible: false,
    dirty: false,
    loadedAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    loadCount: 0,
    error: createRegistryError(input.error),
  };
}

function shouldEvictEntry(entry: ChunkRegistryEntry): boolean {
  return !entry.visible && !entry.dirty;
}

function sortEntriesByLastAccess(entries: readonly ChunkRegistryEntry[]): readonly ChunkRegistryEntry[] {
  try {
    return [...entries].sort((left, right) => (
      Date.parse(left.lastAccessedAt) - Date.parse(right.lastAccessedAt)
    ));
  } catch {
    return [...entries];
  }
}

function fallbackNormalizeChunkKeys(keys: readonly unknown[]): readonly string[] {
  try {
    const result: string[] = [];

    for (const key of keys) {
      const normalized = normalizeChunkKey(key);

      if (normalized.length > 0) {
        result.push(normalized);
      }
    }

    return sortChunkKeys(uniqueStrings(result));
  } catch {
    return [];
  }
}

export function createChunkRegistry(options?: CreateChunkRegistryOptions): ChunkRegistryHandle {
  const logger = options?.logger;
  const maxChunks = normalizeMaxChunks(options?.maxChunks);
  const defaultChunkSize = normalizeChunkSize(options?.defaultChunkSize);
  const defaultProjectId = normalizeProjectId(options?.defaultProjectId);
  const defaultWorldId = normalizeWorldId(options?.defaultWorldId);

  const entries = new Map<string, ChunkRegistryEntry>();
  const dirtyChunkKeys = new Set<string>();
  const visibleChunkKeys = new Set<string>();
  const failedChunkKeys = new Set<string>();

  let destroyed = false;
  let lastUpdatedAt: string | null = null;

  function assertAlive(action: string): void {
    if (destroyed) {
      throw new Error(`ChunkRegistry is destroyed. Action '${action}' is not allowed.`);
    }
  }

  function updateTimestamp(): void {
    lastUpdatedAt = nowIsoString();
  }

  function syncSetsFromEntry(entry: ChunkRegistryEntry): void {
    if (entry.visible) {
      visibleChunkKeys.add(entry.chunkKey);
    } else {
      visibleChunkKeys.delete(entry.chunkKey);
    }

    if (entry.dirty) {
      dirtyChunkKeys.add(entry.chunkKey);
    } else {
      dirtyChunkKeys.delete(entry.chunkKey);
    }

    if (entry.status === "failed") {
      failedChunkKeys.add(entry.chunkKey);
    } else {
      failedChunkKeys.delete(entry.chunkKey);
    }
  }

  function enforceMaxChunks(): void {
    try {
      if (entries.size <= maxChunks) {
        return;
      }

      const candidates = sortEntriesByLastAccess(
        [...entries.values()].filter((entry) => shouldEvictEntry(entry)),
      );

      for (const entry of candidates) {
        if (entries.size <= maxChunks) {
          break;
        }

        entries.delete(entry.chunkKey);
        dirtyChunkKeys.delete(entry.chunkKey);
        visibleChunkKeys.delete(entry.chunkKey);
        failedChunkKeys.delete(entry.chunkKey);
      }

      if (entries.size <= maxChunks) {
        return;
      }

      const fallbackCandidates = sortEntriesByLastAccess([...entries.values()]);

      for (const entry of fallbackCandidates) {
        if (entries.size <= maxChunks) {
          break;
        }

        entries.delete(entry.chunkKey);
        dirtyChunkKeys.delete(entry.chunkKey);
        visibleChunkKeys.delete(entry.chunkKey);
        failedChunkKeys.delete(entry.chunkKey);
      }
    } catch (error) {
      logWarn(logger, "Chunk registry eviction failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function setEntry(entry: ChunkRegistryEntry): ChunkRegistryEntry {
    entries.set(entry.chunkKey, entry);
    syncSetsFromEntry(entry);
    updateTimestamp();
    enforceMaxChunks();

    return entry;
  }

  function getEntryInternal(chunkKey: string, touch = false): ChunkRegistryEntry | null {
    const key = normalizeChunkKey(chunkKey);
    const entry = entries.get(key) ?? null;

    if (!entry) {
      return null;
    }

    if (touch) {
      const touched = touchEntry(entry);
      entries.set(key, touched);
      return touched;
    }

    return entry;
  }

  function normalizeChunkKeysForRegistry(keys: readonly unknown[]): readonly string[] {
    const normalized = uniqueChunkKeys(keys);

    if (normalized.length > 0) {
      return normalized;
    }

    return fallbackNormalizeChunkKeys(keys);
  }

  const registry: ChunkRegistryHandle = {
    kind: CHUNK_REGISTRY_KIND,

    setChunk(chunk: RuntimeChunkContent, setOptions?: SetChunkOptions): RuntimeChunkContent {
      assertAlive("setChunk");

      const existing = entries.get(chunk.chunkKey) ?? null;
      const entry = createEntry(chunk, existing, setOptions);

      setEntry(entry);

      logDebug(logger, "Chunk stored in registry.", {
        chunkKey: chunk.chunkKey,
        visible: entry.visible,
        dirty: entry.dirty,
        reason: setOptions?.reason ?? null,
      });

      return chunk;
    },

    setApiChunk(chunk: ChunkApiRuntimeChunkContent, setOptions?: SetChunkOptions): RuntimeChunkContent {
      assertAlive("setApiChunk");

      const runtimeChunk = createRuntimeChunkContent(chunk);
      return registry.setChunk(runtimeChunk, setOptions);
    },

    setChunks(chunks: readonly RuntimeChunkContent[], setOptions?: SetChunkOptions): readonly RuntimeChunkContent[] {
      assertAlive("setChunks");

      const result: RuntimeChunkContent[] = [];

      for (const chunk of chunks) {
        try {
          result.push(registry.setChunk(chunk, setOptions));
        } catch (error) {
          logWarn(logger, "Chunk could not be stored in registry.", {
            error: normalizeUnknownError(error),
            chunkKey: chunk?.chunkKey ?? null,
          });
        }
      }

      return result;
    },

    setApiChunks(chunks: readonly ChunkApiRuntimeChunkContent[], setOptions?: SetChunkOptions): readonly RuntimeChunkContent[] {
      assertAlive("setApiChunks");

      const result: RuntimeChunkContent[] = [];

      for (const chunk of chunks) {
        try {
          result.push(registry.setApiChunk(chunk, setOptions));
        } catch (error) {
          logWarn(logger, "API chunk could not be stored in registry.", {
            error: normalizeUnknownError(error),
            chunkKey: chunk?.chunkKey ?? null,
          });
        }
      }

      return result;
    },

    getChunk(chunkKey: string): RuntimeChunkContent | null {
      assertAlive("getChunk");

      return getEntryInternal(chunkKey, true)?.chunk ?? null;
    },

    getEntry(chunkKey: string): ChunkRegistryEntry | null {
      assertAlive("getEntry");

      return getEntryInternal(chunkKey, true);
    },

    hasChunk(chunkKey: string): boolean {
      assertAlive("hasChunk");

      return entries.has(normalizeChunkKey(chunkKey));
    },

    requireChunk(chunkKey: string): RuntimeChunkContent {
      assertAlive("requireChunk");

      const chunk = registry.getChunk(chunkKey);

      if (!chunk) {
        throw new Error(`Chunk '${chunkKey}' is not loaded.`);
      }

      return chunk;
    },

    deleteChunk(chunkKey: string, reason?: string): boolean {
      assertAlive("deleteChunk");

      const key = normalizeChunkKey(chunkKey);
      const deleted = entries.delete(key);

      dirtyChunkKeys.delete(key);
      visibleChunkKeys.delete(key);
      failedChunkKeys.delete(key);
      updateTimestamp();

      logDebug(logger, "Chunk deleted from registry.", {
        chunkKey: key,
        deleted,
        reason: reason ?? null,
      });

      return deleted;
    },

    clear(reason?: string): void {
      assertAlive("clear");

      entries.clear();
      dirtyChunkKeys.clear();
      visibleChunkKeys.clear();
      failedChunkKeys.clear();
      updateTimestamp();

      logDebug(logger, "Chunk registry cleared.", {
        reason: reason ?? null,
      });
    },

    getChunkKeys(): readonly string[] {
      assertAlive("getChunkKeys");

      return sortChunkKeys([...entries.keys()]);
    },

    getVisibleChunkKeys(): readonly string[] {
      assertAlive("getVisibleChunkKeys");

      return sortChunkKeys([...visibleChunkKeys]);
    },

    getDirtyChunkKeys(): readonly string[] {
      assertAlive("getDirtyChunkKeys");

      return sortChunkKeys([...dirtyChunkKeys]);
    },

    getFailedChunkKeys(): readonly string[] {
      assertAlive("getFailedChunkKeys");

      return sortChunkKeys([...failedChunkKeys]);
    },

    setVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[] {
      assertAlive("setVisibleChunkKeys");

      const normalized = new Set(normalizeChunkKeysForRegistry(chunkKeys));

      for (const entry of entries.values()) {
        const visible = normalized.has(entry.chunkKey);
        const updated = markEntryVisible(entry, visible);
        entries.set(entry.chunkKey, updated);
        syncSetsFromEntry(updated);
      }

      visibleChunkKeys.clear();

      for (const key of normalized) {
        visibleChunkKeys.add(key);

        const entry = entries.get(key);
        if (entry) {
          const updated = markEntryVisible(entry, true);
          entries.set(key, updated);
          syncSetsFromEntry(updated);
        }
      }

      updateTimestamp();

      logDebug(logger, "Visible chunk keys replaced.", {
        visibleChunkCount: visibleChunkKeys.size,
        reason: reason ?? null,
      });

      return registry.getVisibleChunkKeys();
    },

    addVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[] {
      assertAlive("addVisibleChunkKeys");

      for (const key of normalizeChunkKeysForRegistry(chunkKeys)) {
        visibleChunkKeys.add(key);

        const entry = entries.get(key);
        if (entry) {
          const updated = markEntryVisible(entry, true);
          entries.set(key, updated);
          syncSetsFromEntry(updated);
        }
      }

      updateTimestamp();

      logDebug(logger, "Visible chunk keys added.", {
        visibleChunkCount: visibleChunkKeys.size,
        reason: reason ?? null,
      });

      return registry.getVisibleChunkKeys();
    },

    removeVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[] {
      assertAlive("removeVisibleChunkKeys");

      for (const key of normalizeChunkKeysForRegistry(chunkKeys)) {
        visibleChunkKeys.delete(key);

        const entry = entries.get(key);
        if (entry) {
          const updated = markEntryVisible(entry, false);
          entries.set(key, updated);
          syncSetsFromEntry(updated);
        }
      }

      updateTimestamp();

      logDebug(logger, "Visible chunk keys removed.", {
        visibleChunkCount: visibleChunkKeys.size,
        reason: reason ?? null,
      });

      return registry.getVisibleChunkKeys();
    },

    markChunkDirty(chunkKey: string, markOptions?: MarkDirtyOptions): readonly string[] {
      assertAlive("markChunkDirty");

      const key = normalizeChunkKey(chunkKey);
      const entry = entries.get(key);

      if (entry) {
        setEntry(markEntryDirty(entry));
      } else if (markOptions?.includeUnloaded !== false) {
        dirtyChunkKeys.add(key);
        updateTimestamp();
      }

      logDebug(logger, "Chunk marked dirty.", {
        chunkKey: key,
        reason: markOptions?.reason ?? null,
      });

      return registry.getDirtyChunkKeys();
    },

    markChunksDirty(chunkKeys: readonly string[], markOptions?: MarkDirtyOptions): readonly string[] {
      assertAlive("markChunksDirty");

      for (const key of normalizeChunkKeysForRegistry(chunkKeys)) {
        registry.markChunkDirty(key, markOptions);
      }

      return registry.getDirtyChunkKeys();
    },

    clearDirtyChunk(chunkKey: string, reason?: string): readonly string[] {
      assertAlive("clearDirtyChunk");

      const key = normalizeChunkKey(chunkKey);
      dirtyChunkKeys.delete(key);

      const entry = entries.get(key);
      if (entry) {
        setEntry(clearEntryDirty(entry));
      }

      updateTimestamp();

      logDebug(logger, "Chunk dirty flag cleared.", {
        chunkKey: key,
        reason: reason ?? null,
      });

      return registry.getDirtyChunkKeys();
    },

    clearDirtyChunks(chunkKeys: readonly string[], reason?: string): readonly string[] {
      assertAlive("clearDirtyChunks");

      for (const key of normalizeChunkKeysForRegistry(chunkKeys)) {
        registry.clearDirtyChunk(key, reason);
      }

      return registry.getDirtyChunkKeys();
    },

    clearAllDirtyChunks(reason?: string): void {
      assertAlive("clearAllDirtyChunks");

      dirtyChunkKeys.clear();

      for (const [key, entry] of entries.entries()) {
        const updated = clearEntryDirty(entry);
        entries.set(key, updated);
        syncSetsFromEntry(updated);
      }

      updateTimestamp();

      logDebug(logger, "All dirty chunks cleared.", {
        reason: reason ?? null,
      });
    },

    markChunkFailed(chunkKey: string, error: unknown, reason?: string): void {
      assertAlive("markChunkFailed");

      const key = normalizeChunkKey(chunkKey);
      const entry = entries.get(key);

      if (entry) {
        setEntry(markEntryFailed(entry, error));
      } else {
        setEntry(createFailedPlaceholderEntry({
          chunkKey: key,
          error,
          defaultChunkSize,
          defaultProjectId,
          defaultWorldId,
        }));
      }

      logWarn(logger, "Chunk marked failed.", {
        chunkKey: key,
        reason: reason ?? null,
        error: normalizeUnknownError(error),
      });
    },

    clearChunkError(chunkKey: string, reason?: string): void {
      assertAlive("clearChunkError");

      const key = normalizeChunkKey(chunkKey);
      const entry = entries.get(key);

      if (!entry) {
        return;
      }

      setEntry(clearEntryError(entry));

      logDebug(logger, "Chunk error cleared.", {
        chunkKey: key,
        reason: reason ?? null,
      });
    },

    sampleCellByWorldPosition(position: ChunkWorldPosition): RegistrySampleResult {
      assertAlive("sampleCellByWorldPosition");

      const address = createChunkCellAddress({
        worldX: position.x,
        worldY: position.y,
        worldZ: position.z,
        chunkSize: defaultChunkSize,
      });

      return registry.sampleCellByAddress(address);
    },

    sampleCellByAddress(address: ChunkCellAddress): RegistrySampleResult {
      assertAlive("sampleCellByAddress");

      const chunk = registry.getChunk(address.chunkKey);

      if (!chunk) {
        return createEmptySample(address);
      }

      const sample = sampleCellAtLocalCoordinates(chunk, {
        localX: address.localX,
        localY: address.localY,
        localZ: address.localZ,
      });

      return {
        ...sample,
        chunkLoaded: true,
      };
    },

    isCellLoaded(cell: BlockCollisionWorldCellInput | ChunkWorldPosition): boolean {
      assertAlive("isCellLoaded");

      try {
        const address = createAddressFromWorldCell(cell, defaultChunkSize);
        return entries.has(address.chunkKey);
      } catch {
        return false;
      }
    },

    getCollisionCell(cell: BlockCollisionWorldCellInput | ChunkWorldPosition): RegistryCollisionCellResult {
      assertAlive("getCollisionCell");

      try {
        const address = createAddressFromWorldCell(cell, defaultChunkSize);
        const sample = registry.sampleCellByAddress(address);

        return createCollisionCellFromSample(sample, "chunk-registry");
      } catch {
        const address = createAddressFromWorldCell(cell, defaultChunkSize);
        return createMissingCollisionCell(address, "reader_failed", "chunk-registry");
      }
    },

    createBlockCollisionWorldReader(sourceName = "chunk-registry"): BlockCollisionWorldReader {
      assertAlive("createBlockCollisionWorldReader");

      const normalizedSourceName = safeString(sourceName, "chunk-registry");

      return {
        sourceName: normalizedSourceName,
        isCellLoaded: (cell) => {
          try {
            return registry.isCellLoaded(cell);
          } catch {
            return false;
          }
        },
        getCollisionCell: (cell) => {
          try {
            const result = registry.getCollisionCell(cell);

            return {
              kind: result.kind,
              solid: result.solid,
              loaded: result.loaded,
              blockTypeId: result.blockTypeId,
              policy: result.policy,
              missingReason: result.missingReason,
              source: normalizedSourceName,
            };
          } catch {
            return {
              kind: "unknown",
              solid: true,
              loaded: false,
              blockTypeId: null,
              policy: "block",
              missingReason: "reader_failed",
              source: normalizedSourceName,
            };
          }
        },
      };
    },

    getStats(): ChunkRegistryStats {
      assertAlive("getStats");

      let cellCount = 0;
      let nonAirCellCount = 0;
      let solidCellCount = 0;
      let nonSolidCellCount = 0;

      for (const entry of entries.values()) {
        cellCount += entry.chunk.stats.cellCount;
        nonAirCellCount += entry.chunk.stats.nonAirCellCount;
        solidCellCount += entry.chunk.stats.solidCellCount ?? 0;
        nonSolidCellCount += entry.chunk.stats.nonSolidCellCount ?? 0;
      }

      return {
        chunkCount: entries.size,
        visibleChunkCount: visibleChunkKeys.size,
        dirtyChunkCount: dirtyChunkKeys.size,
        failedChunkCount: failedChunkKeys.size,
        cellCount,
        nonAirCellCount,
        solidCellCount,
        nonSolidCellCount,
        maxChunks,
        lastUpdatedAt,
      };
    },

    getSnapshot(): ChunkRegistrySnapshot {
      assertAlive("getSnapshot");

      return {
        kind: CHUNK_REGISTRY_SNAPSHOT_KIND,
        chunkKeys: registry.getChunkKeys(),
        visibleChunkKeys: registry.getVisibleChunkKeys(),
        dirtyChunkKeys: registry.getDirtyChunkKeys(),
        failedChunkKeys: registry.getFailedChunkKeys(),
        entries: [...entries.values()],
        stats: registry.getStats(),
      };
    },

    debugSummary(): Record<string, unknown> {
      try {
        const visibleSummaries = registry.getVisibleChunkKeys()
          .map((key) => entries.get(key)?.chunk)
          .filter((chunk): chunk is RuntimeChunkContent => Boolean(chunk))
          .map((chunk) => runtimeChunkContentToDebugSummary(chunk));

        return {
          kind: CHUNK_REGISTRY_KIND,
          destroyed,
          stats: registry.getStats(),
          chunkKeys: registry.getChunkKeys(),
          visibleChunkKeys: registry.getVisibleChunkKeys(),
          dirtyChunkKeys: registry.getDirtyChunkKeys(),
          failedChunkKeys: registry.getFailedChunkKeys(),
          visibleSummaries,
          defaultChunkSize,
          defaultProjectId,
          defaultWorldId,
        };
      } catch (error) {
        return {
          kind: CHUNK_REGISTRY_KIND,
          debugSummaryFailed: true,
          error: normalizeUnknownError(error),
        };
      }
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      entries.clear();
      dirtyChunkKeys.clear();
      visibleChunkKeys.clear();
      failedChunkKeys.clear();
      updateTimestamp();

      logDebug(logger, "Chunk registry destroyed.", {
        reason: reason ?? null,
      });
    },
  };

  logDebug(logger, "Chunk registry created.", {
    maxChunks,
    defaultChunkSize,
    defaultProjectId,
    defaultWorldId,
  });

  return registry;
}

export function chunkRegistryEntryToDebugSummary(entry: ChunkRegistryEntry): Record<string, unknown> {
  try {
    return {
      chunkKey: entry.chunkKey,
      status: entry.status,
      visible: entry.visible,
      dirty: entry.dirty,
      loadedAt: entry.loadedAt,
      updatedAt: entry.updatedAt,
      lastAccessedAt: entry.lastAccessedAt,
      loadCount: entry.loadCount,
      error: entry.error,
      chunk: runtimeChunkContentToDebugSummary(entry.chunk),
    };
  } catch (error) {
    return {
      chunkKey: entry.chunkKey,
      summaryFailed: true,
      error: normalizeUnknownError(error),
    };
  }
}

export function collectChunkCoordinatesFromRegistry(
  registry: ChunkRegistryHandle,
): readonly ChunkCoordinates[] {
  try {
    return registry.getChunkKeys().map((chunkKey) => {
      const entry = registry.getEntry(chunkKey);
      const chunk = entry?.chunk;

      if (chunk) {
        return chunkCoordinatesFromContent(chunk);
      }

      const [x, y, z] = chunkKey.split(":");

      return {
        chunkX: safeInteger(x, 0),
        chunkY: safeInteger(y, 0),
        chunkZ: safeInteger(z, 0),
      };
    });
  } catch {
    return [];
  }
}

export function sampleRegistryCellByWorldPositionSafe(
  registry: ChunkRegistryHandle,
  position: ChunkWorldPosition,
): RegistrySampleResult {
  try {
    return registry.sampleCellByWorldPosition(position);
  } catch {
    const address = createChunkCellAddress({
      worldX: position.x,
      worldY: position.y,
      worldZ: position.z,
      chunkSize: DEFAULT_CHUNK_SIZE,
    });

    return createEmptySample(address);
  }
}

export function createBlockCollisionWorldReaderFromRegistry(
  registry: ChunkRegistryHandle,
  sourceName = "chunk-registry",
): BlockCollisionWorldReader {
  try {
    return registry.createBlockCollisionWorldReader(sourceName);
  } catch {
    const normalizedSourceName = safeString(sourceName, "chunk-registry");

    return {
      sourceName: normalizedSourceName,
      isCellLoaded: () => false,
      getCollisionCell: () => ({
        kind: "unknown",
        solid: true,
        loaded: false,
        blockTypeId: null,
        policy: "block",
        missingReason: "reader_failed",
        source: normalizedSourceName,
      }),
    };
  }
}

export function isChunkRegistryHandle(value: unknown): value is ChunkRegistryHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<ChunkRegistryHandle>;

    return (
      record.kind === CHUNK_REGISTRY_KIND
      && typeof record.setChunk === "function"
      && typeof record.getChunk === "function"
      && typeof record.sampleCellByWorldPosition === "function"
      && typeof record.getCollisionCell === "function"
      && typeof record.createBlockCollisionWorldReader === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}