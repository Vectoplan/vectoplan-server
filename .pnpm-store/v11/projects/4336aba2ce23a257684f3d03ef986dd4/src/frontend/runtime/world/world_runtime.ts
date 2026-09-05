// services/vectoplan-editor/src/frontend/runtime/world/world_runtime.ts
import type { ChunkApiClient } from "@api/chunk_api_models";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";
import type { EditorLogger } from "@utils/logger";
import { createEditorId, chunkKeyFromCoordinates } from "@utils/ids";
import {
  normalizeUnknownError,
  safeBoolean,
  safeInteger,
  safeString,
} from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import {
  applyEditorAction,
  chunkLoadedAction,
  chunksLoadedAction,
  dirtyChunksAction,
  failedAction,
  worldConnectionAction,
} from "@state/state_actions";
import type {
  BlockCollisionWorldCellInput,
  BlockCollisionWorldReader,
} from "../physics/block_collision_query";
import {
  createBlockCollisionQuery,
  type BlockCollisionQuery,
  type BlockCollisionQueryConfigPatch,
} from "../physics/block_collision_query";
import type { PhysicsAabb } from "../physics/physics_models";
import type { ChunkSource, ChunkSourceEvent } from "./chunk_source";
import { createChunkServiceSourceFromBootstrap } from "./chunk_service_source";
import {
  createChunkLoader,
  isChunkLoaderFailureResult,
  isChunkLoaderSuccessResult,
  type ChunkLoaderHandle,
  type ChunkLoaderLoadReason,
  type ChunkLoaderResult,
  type ChunkLoaderPriorityDirection,
  type ChunkLoaderBatchProgress,
} from "./chunk_loader";
import type { RuntimeChunkContent } from "./chunk_content";
import {
  createChunkCellAddress,
  chunkKeysForWorldAabb,
  visibleChunkCoordinatesAround,
  worldToChunkCoordinates,
  type ChunkCoordinates,
  type ChunkWorldPosition,
} from "./chunk_coordinates";
import type {
  ChunkRegistryHandle,
  RegistryCollisionCellResult,
} from "./chunk_registry";
import { createBlockCollisionWorldReaderFromRegistry } from "./chunk_registry";

export type WorldRuntimeStatus =
  | "created"
  | "initializing"
  | "ready"
  | "degraded"
  | "failed"
  | "destroying"
  | "destroyed";

export interface WorldRuntimeOptions {
  readonly bootstrap: EditorBootstrap;
  readonly store: EditorStore;
  readonly chunkApiClient: ChunkApiClient;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
}

export interface WorldRuntimeRefreshOptions {
  readonly reason?: string;
  readonly force?: boolean;
  readonly signal?: AbortSignal;
}

export interface WorldRuntimeLoadAroundOptions extends WorldRuntimeRefreshOptions {
  readonly radius?: number;
  readonly markVisible?: boolean;
  readonly preferBatch?: boolean;
  readonly contentProfile?: "surface-shell.v1" | "full";
  readonly maxChunks?: number;
  readonly retainVisibleChunkKeys?: readonly string[];
  readonly priorityDirection?: ChunkLoaderPriorityDirection;
  readonly batchSize?: number;
  readonly shouldContinue?: () => boolean;
  readonly onBatchLoaded?: (progress: ChunkLoaderBatchProgress) => void;
}

export interface WorldRuntimeLoadAroundAabbOptions extends WorldRuntimeRefreshOptions {
  readonly radius?: number;
  readonly includeAabbChunks?: boolean;
}

export interface WorldRuntimeSnapshot {
  readonly kind: "world-runtime-snapshot.v1";
  readonly id: string;
  readonly status: WorldRuntimeStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly projectId: string;
  readonly worldId: string;
  readonly source: ReturnType<ChunkSource["getSummary"]>;
  readonly loader: ReturnType<ChunkLoaderHandle["getSnapshot"]>;
  readonly visibleChunkKeys: readonly string[];
  readonly loadedChunkKeys: readonly string[];
  readonly dirtyChunkKeys: readonly string[];
  readonly failedChunkKeys: readonly string[];
  readonly collisionReaderAvailable: boolean;
  readonly lastError: Record<string, unknown> | null;
  readonly ownsChunkWorld: true;
  readonly ownsCollisionReader: true;
  readonly ownsHotbarInventory: false;
  readonly productiveInventoryRoute: "/editor/api/inventory";
  readonly legacyChunkBlocksIgnoredAsInventory: true;
  readonly browserCallsVectoplanLibraryDirectly: false;
}

export interface WorldRuntimeCollisionSnapshot {
  readonly kind: "world-runtime-collision-snapshot.v1";
  readonly worldRuntimeId: string;
  readonly status: WorldRuntimeStatus;
  readonly readerAvailable: boolean;
  readonly loadedChunkKeys: readonly string[];
  readonly failedChunkKeys: readonly string[];
  readonly dirtyChunkKeys: readonly string[];
  readonly missingChunkPolicy: "block";
}

export interface WorldRuntimeHandle {
  readonly kind: "vectoplan-editor-world-runtime.v1";

  initialize(): Promise<void>;

  getStatus(): WorldRuntimeStatus;
  getSource(): ChunkSource;
  getRegistry(): ChunkRegistryHandle;
  getLoader(): ChunkLoaderHandle;
  getSnapshot(): WorldRuntimeSnapshot;

  loadInitialWorld(options?: WorldRuntimeRefreshOptions): Promise<readonly RuntimeChunkContent[]>;
  loadAroundPosition(
    position: ChunkWorldPosition,
    options?: WorldRuntimeLoadAroundOptions,
  ): Promise<readonly RuntimeChunkContent[]>;
  loadAroundChunk(
    center: ChunkCoordinates,
    options?: WorldRuntimeLoadAroundOptions,
  ): Promise<readonly RuntimeChunkContent[]>;
  loadAroundAabb(
    aabb: PhysicsAabb,
    options?: WorldRuntimeLoadAroundAabbOptions,
  ): Promise<readonly RuntimeChunkContent[]>;

  requestFullRefresh(options?: WorldRuntimeRefreshOptions): Promise<void>;
  reloadDirtyChunks(options?: WorldRuntimeRefreshOptions): Promise<void>;

  markChunkDirty(chunkKey: string, reason?: string): readonly string[];
  markChunksDirty(chunkKeys: readonly string[], reason?: string): readonly string[];
  getDirtyChunkKeys(): readonly string[];

  sampleCell(position: ChunkWorldPosition): ReturnType<ChunkRegistryHandle["sampleCellByWorldPosition"]>;

  /**
   * Read-only collision access for PhysicsRuntime.
   *
   * These methods must not perform HTTP requests. Missing chunk data is exposed
   * as loaded=false so the physics query can fail closed.
   */
  getCollisionWorldReader(): BlockCollisionWorldReader;
  getBlockCollisionQuery(config?: BlockCollisionQueryConfigPatch | null): BlockCollisionQuery;
  getCollisionCell(cell: BlockCollisionWorldCellInput | ChunkWorldPosition): RegistryCollisionCellResult;
  isCollisionCellLoaded(cell: BlockCollisionWorldCellInput | ChunkWorldPosition): boolean;
  getCollisionSnapshot(): WorldRuntimeCollisionSnapshot;

  destroy(reason?: string): Promise<void>;
}

type AnyRecord = Record<string, unknown>;

const WORLD_RUNTIME_KIND = "vectoplan-editor-world-runtime.v1" as const;
const WORLD_RUNTIME_SNAPSHOT_KIND = "world-runtime-snapshot.v1" as const;
const WORLD_RUNTIME_COLLISION_SNAPSHOT_KIND = "world-runtime-collision-snapshot.v1" as const;
const PRODUCTIVE_INVENTORY_ROUTE = "/editor/api/inventory" as const;
const DEFAULT_CHUNK_SIZE = 16;

function asRecord(value: unknown): AnyRecord {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as AnyRecord)
      : {};
  } catch {
    return {};
  }
}

function asArray<T = unknown>(value: unknown): readonly T[] {
  try {
    return Array.isArray(value) ? (value as readonly T[]) : [];
  } catch {
    return [];
  }
}

function asStringArray(value: unknown): readonly string[] {
  try {
    return asArray(value)
      .map((item) => safeString(item, ""))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function uniqueStrings(values: readonly unknown[]): readonly string[] {
  try {
    return [...new Set(asStringArray(values))];
  } catch {
    return [];
  }
}

function callUnknownMethod<T = unknown>(
  target: unknown,
  methodNames: readonly string[],
  args: readonly unknown[] = [],
): T | null {
  try {
    const record = asRecord(target);

    for (const methodName of methodNames) {
      const method = record[methodName];

      if (typeof method !== "function") {
        continue;
      }

      return (method as (...methodArgs: readonly unknown[]) => T)(...args);
    }

    return null;
  } catch {
    return null;
  }
}

function getSnapshotRecord(target: unknown): AnyRecord {
  try {
    const snapshot = callUnknownMethod(target, ["getSnapshot", "snapshot"]);
    return asRecord(snapshot);
  } catch {
    return {};
  }
}

function readStringKeysFromTarget(
  target: unknown,
  methodNames: readonly string[],
  snapshotFieldNames: readonly string[],
): readonly string[] {
  try {
    const direct = callUnknownMethod<unknown>(target, methodNames);
    const directKeys = asStringArray(direct);

    if (directKeys.length > 0) {
      return directKeys;
    }

    const snapshot = getSnapshotRecord(target);

    for (const fieldName of snapshotFieldNames) {
      const keys = asStringArray(snapshot[fieldName]);

      if (keys.length > 0) {
        return keys;
      }
    }

    return [];
  } catch {
    return [];
  }
}

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // World runtime logging must never break runtime.
  }
}

function logInfo(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.info?.(message, details);
  } catch {
    // World runtime logging must never break runtime.
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
    // World runtime logging must never break runtime.
  }
}

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "1970-01-01T00:00:00.000Z";
    }
  }
}

function normalizeReason(
  value: unknown,
  fallback: ChunkLoaderLoadReason,
): ChunkLoaderLoadReason {
  return safeString(value, fallback) as ChunkLoaderLoadReason;
}

function normalizeRadius(value: unknown): number {
  return safeInteger(value, 1, {
    min: 0,
    max: 8,
  });
}

function chunkKeyFromRuntimeCoordinates(coordinates: ChunkCoordinates): string {
  return chunkKeyFromCoordinates(
    safeInteger(coordinates.chunkX, 0),
    safeInteger(coordinates.chunkY, 0),
    safeInteger(coordinates.chunkZ, 0),
  );
}

function chunkKeysFromLoaderResult(result: ChunkLoaderResult): readonly string[] {
  try {
    return isChunkLoaderSuccessResult(result) ? result.loadedChunkKeys : [];
  } catch {
    return [];
  }
}

function chunksFromLoaderResult(result: ChunkLoaderResult): readonly RuntimeChunkContent[] {
  try {
    return isChunkLoaderSuccessResult(result) ? result.chunks : [];
  } catch {
    return [];
  }
}

function storeAction(
  store: EditorStore,
  action: Parameters<typeof applyEditorAction>[1],
  options?: {
    readonly notify?: boolean;
    readonly captureHistory?: boolean;
  },
): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, action),
      {
        action: action.kind,
        notify: options?.notify ?? true,
        captureHistory: options?.captureHistory ?? false,
      },
    );
  } catch {
    // Store updates must not break runtime side effects.
  }
}

function dispatchLoadedChunks(
  store: EditorStore,
  chunks: readonly RuntimeChunkContent[],
): void {
  try {
    if (chunks.length === 0) {
      return;
    }

    if (chunks.length === 1 && chunks[0]) {
      storeAction(store, chunkLoadedAction(chunks[0]));
      return;
    }

    storeAction(store, chunksLoadedAction(chunks));
  } catch {
    // Store updates must not break runtime side effects.
  }
}

function dispatchLoaderResult(store: EditorStore, result: ChunkLoaderResult): void {
  try {
    if (isChunkLoaderSuccessResult(result)) {
      dispatchLoadedChunks(store, result.chunks);

      if (result.failedChunkKeys.length > 0) {
        storeAction(store, {
          kind: "debug/warning",
          warning: `Einige Chunks konnten nicht geladen werden: ${result.failedChunkKeys.join(", ")}`,
          createdAt: now(),
          source: "world-runtime.loader-result",
        });
      }

      return;
    }

    storeAction(store, {
      kind: "debug/error",
      error: result.error,
      createdAt: now(),
      source: "world-runtime.loader-result",
    });

    storeAction(store, worldConnectionAction("degraded", result.error.error));
  } catch {
    // Store updates must not break runtime side effects.
  }
}

function ensureChunkServiceOnly(bootstrap: EditorBootstrap): void {
  try {
    if (
      bootstrap.runtime.localWorldFallbackEnabled !== false ||
      bootstrap.runtime.legacyFrontendEnabled !== false
    ) {
      throw new Error("The new editor frontend does not support local or legacy world fallback.");
    }

    if (bootstrap.runtime.chunk.enabled !== true) {
      throw new Error("Chunk service runtime is required.");
    }

    if (
      bootstrap.runtime.worldMode !== "chunk_service" ||
      bootstrap.runtime.sourceMode !== "chunk-service"
    ) {
      throw new Error("World runtime must use chunk_service / chunk-service mode.");
    }

    if (bootstrap.featureFlags.chunkServiceEnabled !== true) {
      throw new Error("Chunk service feature flag must be enabled.");
    }

    /**
     * Wichtig:
     * Legacy-Inventory-Flags sollen nicht mehr produktiv wirken.
     * Wir werfen hier absichtlich keinen Fehler mehr, weil alte Bootstrap-Werte
     * den Editor sonst hart am Start hindern können. Die WorldRuntime ignoriert
     * Chunk-Blocklisten als Inventory-Wahrheit unabhängig von diesen Flags.
     */
  } catch (error) {
    throw error;
  }
}

function connectionErrorDetails(error: unknown): {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly statusCode: null;
  readonly requestId: null;
  readonly requestKind: null;
  readonly url: null;
  readonly method: null;
  readonly exceptionType: string | null;
  readonly details: Record<string, unknown> | null;
} {
  const normalized = normalizeUnknownError(error);

  return {
    code: normalized.code ?? "world_runtime_error",
    message: normalized.message,
    retryable: true,
    statusCode: null,
    requestId: null,
    requestKind: null,
    url: null,
    method: null,
    exceptionType: normalized.name,
    details: {
      ...(normalized.details ?? {}),
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      legacyChunkBlocksAreDiagnosticOnly: true,
      worldRuntimeOwnsHotbarInventory: false,
    },
  };
}

function createFallbackCollisionCell(
  cell: BlockCollisionWorldCellInput | ChunkWorldPosition,
): RegistryCollisionCellResult {
  const address = createChunkCellAddress({
    worldX: cell.x,
    worldY: cell.y,
    worldZ: cell.z,
    chunkSize: DEFAULT_CHUNK_SIZE,
  });

  return {
    kind: "unknown",
    solid: true,
    loaded: false,
    blockTypeId: null,
    policy: "block",
    missingReason: "reader_failed",
    source: "world-runtime-fallback",
    chunkKey: address.chunkKey,
    cellValue: 0,
  };
}

function createFallbackSample(
  position: ChunkWorldPosition,
): ReturnType<ChunkRegistryHandle["sampleCellByWorldPosition"]> {
  const address = createChunkCellAddress({
    worldX: position.x,
    worldY: position.y,
    worldZ: position.z,
    chunkSize: DEFAULT_CHUNK_SIZE,
  });

  return {
    exists: false,
    chunkLoaded: false,
    chunkKey: address.chunkKey,
    address,
    cellValue: 0,
    air: true,
    paletteEntry: null,
    blockTypeId: null,
    solid: false,
    placeable: false,
    breakable: false,
    collisionKind: "air",
  };
}

function createFallbackCollisionWorldReader(
  logger?: EditorLogger,
): BlockCollisionWorldReader {
  return {
    sourceName: "world-runtime.fallback",
    isCellLoaded: () => false,
    getCollisionCell: (cell) => {
      logWarn(logger, "Fallback collision reader used.", {
        cell,
        policy: "block",
      });

      return {
        kind: "unknown",
        solid: true,
        loaded: false,
        blockTypeId: null,
        policy: "block",
        missingReason: "reader_failed",
        source: "world-runtime.fallback",
      };
    },
  };
}

function getSourceDirtyChunkKeys(source: ChunkSource): readonly string[] {
  try {
    const keys = readStringKeysFromTarget(
      source,
      ["getDirtyChunkKeys", "dirtyChunkKeys", "getDirtyKeys"],
      ["dirtyChunkKeys", "dirtyChunks", "dirtyKeys"],
    );

    if (keys.length > 0) {
      return keys;
    }

    const registry = callUnknownMethod<ChunkRegistryHandle>(source, ["getRegistry"]);
    return registry ? getRegistryDirtyChunkKeys(registry) : [];
  } catch {
    return [];
  }
}

function getSourceLoadedChunkKeys(source: ChunkSource): readonly string[] {
  try {
    const keys = readStringKeysFromTarget(
      source,
      ["getLoadedChunkKeys", "loadedChunkKeys", "getChunkKeys", "getLoadedKeys"],
      ["loadedChunkKeys", "loadedChunks", "chunkKeys", "chunks"],
    );

    if (keys.length > 0) {
      return keys;
    }

    const registry = callUnknownMethod<ChunkRegistryHandle>(source, ["getRegistry"]);
    return registry ? getRegistryLoadedChunkKeys(registry) : [];
  } catch {
    return [];
  }
}

function getSourceVisibleChunkKeys(source: ChunkSource): readonly string[] {
  try {
    const keys = readStringKeysFromTarget(
      source,
      ["getVisibleChunkKeys", "visibleChunkKeys", "getVisibleKeys"],
      ["visibleChunkKeys", "visibleChunks", "visibleKeys"],
    );

    if (keys.length > 0) {
      return keys;
    }

    const registry = callUnknownMethod<ChunkRegistryHandle>(source, ["getRegistry"]);
    return registry ? getRegistryVisibleChunkKeys(registry) : [];
  } catch {
    return [];
  }
}

function getRegistryLoadedChunkKeys(registry: ChunkRegistryHandle): readonly string[] {
  try {
    return readStringKeysFromTarget(
      registry,
      ["getLoadedChunkKeys", "loadedChunkKeys", "getChunkKeys", "getLoadedKeys"],
      ["loadedChunkKeys", "loadedChunks", "chunkKeys", "chunks"],
    );
  } catch {
    return [];
  }
}

function getRegistryVisibleChunkKeys(registry: ChunkRegistryHandle): readonly string[] {
  try {
    return readStringKeysFromTarget(
      registry,
      ["getVisibleChunkKeys", "visibleChunkKeys", "getVisibleKeys"],
      ["visibleChunkKeys", "visibleChunks", "visibleKeys"],
    );
  } catch {
    return [];
  }
}

function getRegistryFailedChunkKeys(registry: ChunkRegistryHandle): readonly string[] {
  try {
    return readStringKeysFromTarget(
      registry,
      ["getFailedChunkKeys", "failedChunkKeys", "getFailedKeys"],
      ["failedChunkKeys", "failedChunks", "failedKeys"],
    );
  } catch {
    return [];
  }
}

function getRegistryDirtyChunkKeys(registry: ChunkRegistryHandle): readonly string[] {
  try {
    return readStringKeysFromTarget(
      registry,
      ["getDirtyChunkKeys", "dirtyChunkKeys", "getDirtyKeys"],
      ["dirtyChunkKeys", "dirtyChunks", "dirtyKeys"],
    );
  } catch {
    return [];
  }
}

function setRegistryVisibleChunkKeys(
  registry: ChunkRegistryHandle,
  chunkKeys: readonly string[],
  reason: string,
): void {
  try {
    callUnknownMethod(registry, ["setVisibleChunkKeys", "replaceVisibleChunkKeys"], [
      chunkKeys,
      reason,
    ]);
  } catch {
    // Visibility is diagnostic/runtime state. Failure must not break loading.
  }
}

function markRegistryChunkDirty(
  registry: ChunkRegistryHandle,
  chunkKey: string,
  reason?: string,
): readonly string[] {
  try {
    const direct = callUnknownMethod<unknown>(
      registry,
      ["markChunkDirty", "markDirty", "setDirty"],
      [chunkKey, reason],
    );

    const directKeys = asStringArray(direct);
    if (directKeys.length > 0) {
      return directKeys;
    }

    return uniqueStrings([chunkKey, ...getRegistryDirtyChunkKeys(registry)]);
  } catch {
    return uniqueStrings([chunkKey]);
  }
}

function markRegistryChunksDirty(
  registry: ChunkRegistryHandle,
  chunkKeys: readonly string[],
  reason?: string,
): readonly string[] {
  try {
    const direct = callUnknownMethod<unknown>(
      registry,
      ["markChunksDirty", "markDirtyChunks", "addDirtyChunks"],
      [chunkKeys, reason],
    );

    const directKeys = asStringArray(direct);
    if (directKeys.length > 0) {
      return directKeys;
    }

    return uniqueStrings([...chunkKeys, ...getRegistryDirtyChunkKeys(registry)]);
  } catch {
    return uniqueStrings(chunkKeys);
  }
}

function markSourceChunkDirty(
  source: ChunkSource,
  chunkKey: string,
  reason?: string,
): readonly string[] {
  try {
    const direct = callUnknownMethod<unknown>(
      source,
      ["markChunkDirty", "markDirty", "setDirty"],
      [chunkKey, reason],
    );

    const directKeys = asStringArray(direct);
    if (directKeys.length > 0) {
      return directKeys;
    }

    const registry = callUnknownMethod<ChunkRegistryHandle>(source, ["getRegistry"]);
    return registry
      ? markRegistryChunkDirty(registry, chunkKey, reason)
      : uniqueStrings([chunkKey]);
  } catch {
    return uniqueStrings([chunkKey]);
  }
}

function markSourceChunksDirty(
  source: ChunkSource,
  chunkKeys: readonly string[],
  reason?: string,
): readonly string[] {
  try {
    const direct = callUnknownMethod<unknown>(
      source,
      ["markChunksDirty", "markDirtyChunks", "addDirtyChunks"],
      [chunkKeys, reason],
    );

    const directKeys = asStringArray(direct);
    if (directKeys.length > 0) {
      return directKeys;
    }

    const registry = callUnknownMethod<ChunkRegistryHandle>(source, ["getRegistry"]);
    return registry
      ? markRegistryChunksDirty(registry, chunkKeys, reason)
      : uniqueStrings(chunkKeys);
  } catch {
    return uniqueStrings(chunkKeys);
  }
}

export function createWorldRuntime(options: WorldRuntimeOptions): WorldRuntimeHandle {
  ensureChunkServiceOnly(options.bootstrap);

  const logger = options.logger;
  const id = createEditorId({
    prefix: "world_runtime",
  });
  const createdAt = now();
  const bootstrap = options.bootstrap;
  const store = options.store;
  const chunkConfig = bootstrap.runtime.chunk;

  const earthTerrainWorld = [
    bootstrap.project.templateId,
    bootstrap.project.providerId,
    chunkConfig.projectId.startsWith("chk_prj_prj_")
      ? "earth-georeferenced-project"
      : "",
  ].some((value) => safeString(value, "").toLowerCase().includes("earth"));

  const source = createChunkServiceSourceFromBootstrap({
    bootstrap,
    client: options.chunkApiClient,
    logger: options.logger?.child?.("chunk_source") ?? options.logger,
    signal: options.signal,
  });

  const loader = createChunkLoader({
    source,
    logger: options.logger?.child?.("chunk_loader") ?? options.logger,
    signal: options.signal,
    initialCenter: worldToChunkCoordinates(
      {
        x: bootstrap.camera.spawn.x,
        y: bootstrap.camera.spawn.y,
        z: bootstrap.camera.spawn.z,
      },
      DEFAULT_CHUNK_SIZE,
    ),
    initialRadius: earthTerrainWorld
      ? 0
      : Math.min(
          1,
          safeInteger(bootstrap.render.visibleChunkRadius, 8, {
            min: 0,
            max: 16,
          }),
        ),
    maxRadius: 16,
    verticalRadius: earthTerrainWorld ? 0 : 1,
    maxChunksPerLoad: chunkConfig.maxBatchChunks,
    preferBatch: chunkConfig.preferBatchLoad,
    markVisible: true,
  });

  let status: WorldRuntimeStatus = "created";
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let destroyed = false;
  let initialized = false;
  let lastError: Record<string, unknown> | null = null;
  let sourceUnsubscribe: (() => void) | null = null;
  let collisionReader: BlockCollisionWorldReader | null = null;
  let collisionQuery: BlockCollisionQuery | null = null;

  function setStatus(nextStatus: WorldRuntimeStatus, reason?: string): void {
    status = nextStatus;
    updatedAt = now();

    logDebug(logger, "World runtime status changed.", {
      id,
      status,
      reason: reason ?? null,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    });
  }

  function setFailure(error: unknown, reason: string): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed", reason);

    storeAction(store, failedAction(error, reason));
    storeAction(store, worldConnectionAction("failed", connectionErrorDetails(error)));

    logWarn(logger, "World runtime failed.", {
      reason,
      error: lastError,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    });
  }

  function setDegraded(error: unknown, reason: string): void {
    lastError = normalizeUnknownError(error);
    setStatus("degraded", reason);

    storeAction(store, worldConnectionAction("degraded", connectionErrorDetails(error)));

    logWarn(logger, "World runtime degraded.", {
      reason,
      error: lastError,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    });
  }

  function assertAlive(action: string): void {
    if (destroyed || status === "destroyed" || status === "destroying") {
      throw new Error(`WorldRuntime is destroyed. Action '${action}' is not allowed.`);
    }
  }

  function getRegistry(): ChunkRegistryHandle {
    try {
      const registry = callUnknownMethod<ChunkRegistryHandle>(source, ["getRegistry"]);

      if (registry) {
        return registry;
      }

      return source.getRegistry();
    } catch {
      return source.getRegistry();
    }
  }

  function getCollisionWorldReader(): BlockCollisionWorldReader {
    assertAlive("getCollisionWorldReader");

    if (collisionReader) {
      return collisionReader;
    }

    try {
      collisionReader = createBlockCollisionWorldReaderFromRegistry(
        getRegistry(),
        "world-runtime.chunk-registry",
      );

      if (collisionQuery) {
        collisionQuery.setReader(collisionReader);
      }

      return collisionReader;
    } catch (error) {
      logWarn(logger, "World runtime collision reader creation failed.", {
        error: normalizeUnknownError(error),
      });

      collisionReader = createFallbackCollisionWorldReader(logger);

      if (collisionQuery) {
        collisionQuery.setReader(collisionReader);
      }

      return collisionReader;
    }
  }

  function getBlockCollisionQuery(
    config?: BlockCollisionQueryConfigPatch | null,
  ): BlockCollisionQuery {
    assertAlive("getBlockCollisionQuery");

    try {
      const reader = getCollisionWorldReader();

      if (!collisionQuery) {
        collisionQuery = createBlockCollisionQuery(reader, {
          missingCellPolicy: "block",
          treatUnknownAsSolid: true,
          treatNonSolidKindAsSolid: false,
          ...(config ?? {}),
        });
        return collisionQuery;
      }

      collisionQuery.setReader(reader);

      if (config) {
        collisionQuery.updateConfig(config);
      }

      return collisionQuery;
    } catch {
      collisionQuery = createBlockCollisionQuery(null, {
        missingCellPolicy: "block",
        treatUnknownAsSolid: true,
      });

      return collisionQuery;
    }
  }

  function getCollisionCell(
    cell: BlockCollisionWorldCellInput | ChunkWorldPosition,
  ): RegistryCollisionCellResult {
    assertAlive("getCollisionCell");

    try {
      return getRegistry().getCollisionCell(cell);
    } catch (error) {
      logWarn(logger, "World runtime collision cell query failed.", {
        error: normalizeUnknownError(error),
        cell,
      });

      return createFallbackCollisionCell(cell);
    }
  }

  function isCollisionCellLoaded(
    cell: BlockCollisionWorldCellInput | ChunkWorldPosition,
  ): boolean {
    assertAlive("isCollisionCellLoaded");

    try {
      return getRegistry().isCellLoaded(cell);
    } catch {
      return false;
    }
  }

  function getCollisionSnapshot(): WorldRuntimeCollisionSnapshot {
    try {
      const registry = getRegistry();

      return {
        kind: WORLD_RUNTIME_COLLISION_SNAPSHOT_KIND,
        worldRuntimeId: id,
        status,
        readerAvailable: Boolean(getCollisionWorldReader()),
        loadedChunkKeys: getSourceLoadedChunkKeys(source),
        failedChunkKeys: getRegistryFailedChunkKeys(registry),
        dirtyChunkKeys: getSourceDirtyChunkKeys(source),
        missingChunkPolicy: "block",
      };
    } catch {
      return {
        kind: WORLD_RUNTIME_COLLISION_SNAPSHOT_KIND,
        worldRuntimeId: id,
        status,
        readerAvailable: false,
        loadedChunkKeys: [],
        failedChunkKeys: [],
        dirtyChunkKeys: [],
        missingChunkPolicy: "block",
      };
    }
  }

  function subscribeSourceEvents(): void {
    if (sourceUnsubscribe) {
      return;
    }

    sourceUnsubscribe = source.subscribe((event: ChunkSourceEvent) => {
      try {
        const eventRecord = event as unknown as {
          readonly type?: string;
          readonly kind?: string;
          readonly payload?: unknown;
        };
        const eventType = safeString(eventRecord.type ?? eventRecord.kind, "unknown");

        switch (eventType) {
          case "blocks-loaded": {
            /**
             * Legacy-/Diagnoseereignis.
             *
             * Wichtig:
             * - Diese Blockliste darf nicht mehr als Hotbar-/Inventory-Wahrheit
             *   in den Store geschrieben werden.
             * - Das produktive Inventory kommt aus /editor/api/inventory und wird
             *   in scene_runtime.ts über LibraryInventorySource/HotbarController
             *   initialisiert.
             */
            const payload = eventRecord.payload as {
              readonly blocks?: readonly unknown[];
              readonly placeableBlocks?: readonly unknown[];
              readonly usedPaletteFallback?: boolean;
            };

            logDebug(logger, "Legacy chunk blocks loaded and ignored as inventory truth.", {
              blockCount: payload?.blocks?.length ?? null,
              placeableBlockCount: payload?.placeableBlocks?.length ?? null,
              usedPaletteFallback: payload?.usedPaletteFallback ?? null,
              inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
            });

            storeAction(
              store,
              {
                kind: "debug/action",
                action: "legacy-chunk-blocks-loaded-ignored-as-inventory",
                createdAt: now(),
                source: "world-runtime.source-event.blocks-loaded",
              },
              {
                notify: false,
                captureHistory: false,
              },
            );

            return;
          }

          case "chunk-loaded": {
            const payload = eventRecord.payload as { chunk?: RuntimeChunkContent };
            if (payload?.chunk) {
              dispatchLoadedChunks(store, [payload.chunk]);
            }
            return;
          }

          case "chunks-loaded": {
            const payload = eventRecord.payload as { chunks?: readonly RuntimeChunkContent[] };
            if (payload?.chunks) {
              dispatchLoadedChunks(store, payload.chunks);
            }
            return;
          }

          case "dirty-chunks": {
            const payload = eventRecord.payload as { dirtyChunkKeys?: readonly string[] };
            storeAction(
              store,
              dirtyChunksAction(payload?.dirtyChunkKeys ?? getSourceDirtyChunkKeys(source)),
            );
            return;
          }

          case "error": {
            storeAction(
              store,
              {
                kind: "debug/error",
                error: eventRecord.payload,
                createdAt: now(),
                source: "world-runtime.source-event",
              },
              {
                notify: false,
                captureHistory: false,
              },
            );
            return;
          }

          default:
            return;
        }
      } catch (error) {
        logWarn(logger, "World runtime source event handling failed.", {
          eventType: (event as unknown as { type?: unknown }).type ?? null,
          error: normalizeUnknownError(error),
        });
      }
    });
  }

  async function initialize(): Promise<void> {
    assertAlive("initialize");

    if (initialized) {
      return;
    }

    setStatus("initializing", "world-runtime.initialize");

    try {
      subscribeSourceEvents();

      storeAction(store, worldConnectionAction("connecting"));
      storeAction(store, {
        kind: "ui/source-status",
        label: "Chunk-Service wird verbunden",
        createdAt: now(),
        source: "world-runtime.initialize",
      });

      await source.initialize({
        signal: options.signal,
      });

      collisionReader = createBlockCollisionWorldReaderFromRegistry(
        getRegistry(),
        "world-runtime.chunk-registry",
      );
      collisionQuery = createBlockCollisionQuery(collisionReader, {
        missingCellPolicy: "block",
        treatUnknownAsSolid: true,
        treatNonSolidKindAsSolid: false,
      });

      /**
       * Kein produktives Inventory mehr aus Chunk-Blocks.
       *
       * Früher wurde hier source.loadPlaceableBlocks(...) aufgerufen und danach
       * inventoryLoadedAction(...) dispatcht. Das ist bewusst entfernt:
       *
       * - WorldRuntime besitzt Chunk-World, Collision, Dirty Reload und Refresh.
       * - Library-/VPLIB-Hotbar wird über /editor/api/inventory in der aktiven
       *   SceneRuntime geladen.
       * - Chunk-Blocks bleiben nur Diagnose/Legacy im ChunkSource-Event.
       */

      const result = await loader.initialize({
        reason: "initial",
        force: false,
        signal: options.signal,
      });

      dispatchLoaderResult(store, result);

      if (isChunkLoaderFailureResult(result)) {
        setDegraded(result.error, "world-runtime-initial-load-degraded");
        storeAction(store, {
          kind: "ui/source-status",
          label: "Chunk-Service eingeschränkt",
          createdAt: now(),
          source: "world-runtime.initialize",
        });
        initialized = true;
        return;
      }

      initialized = true;
      lastError = null;
      setStatus("ready", "world-runtime.initialize-ready");
      storeAction(store, worldConnectionAction("ready", null));
      storeAction(store, {
        kind: "ui/source-status",
        label: "Chunk-Service verbunden",
        createdAt: now(),
        source: "world-runtime.initialize",
      });

      logInfo(logger, "World runtime initialized.", {
        id,
        projectId: chunkConfig.projectId,
        worldId: chunkConfig.worldId,
        loadedChunkKeys: chunkKeysFromLoaderResult(result),
        collisionReaderAvailable: true,
        inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
        legacyChunkBlocksIgnoredAsInventory: true,
      });
    } catch (error) {
      setFailure(error, "world-runtime-initialize-failed");
      throw error;
    }
  }

  async function loadInitialWorld(
    refreshOptions?: WorldRuntimeRefreshOptions,
  ): Promise<readonly RuntimeChunkContent[]> {
    assertAlive("loadInitialWorld");

    const result = await loader.loadInitialChunks({
      reason: normalizeReason(refreshOptions?.reason, "initial"),
      force: refreshOptions?.force,
      signal: refreshOptions?.signal,
    });

    dispatchLoaderResult(store, result);

    if (isChunkLoaderFailureResult(result)) {
      setDegraded(result.error, "world-runtime-load-initial-degraded");
    }

    return chunksFromLoaderResult(result);
  }

  async function loadAroundPosition(
    position: ChunkWorldPosition,
    refreshOptions?: WorldRuntimeLoadAroundOptions,
  ): Promise<readonly RuntimeChunkContent[]> {
    assertAlive("loadAroundPosition");

    const radius = normalizeRadius(refreshOptions?.radius);
    const reason = normalizeReason(refreshOptions?.reason, "position-change");

    const result = await loader.loadAroundPosition(position, {
      reason,
      force: refreshOptions?.force,
      signal: refreshOptions?.signal,
      radius,
      markVisible: refreshOptions?.markVisible,
      preferBatch: refreshOptions?.preferBatch,
      contentProfile: refreshOptions?.contentProfile,
      maxChunks: refreshOptions?.maxChunks,
      retainVisibleChunkKeys: refreshOptions?.retainVisibleChunkKeys,
      priorityDirection: refreshOptions?.priorityDirection,
      batchSize: refreshOptions?.batchSize,
      shouldContinue: refreshOptions?.shouldContinue,
      onBatchLoaded: refreshOptions?.onBatchLoaded,
    });

    dispatchLoaderResult(store, result);

    if (isChunkLoaderFailureResult(result)) {
      setDegraded(result.error, "world-runtime-load-around-position-degraded");
    }

    return chunksFromLoaderResult(result);
  }

  async function loadAroundChunk(
    center: ChunkCoordinates,
    refreshOptions?: WorldRuntimeLoadAroundOptions,
  ): Promise<readonly RuntimeChunkContent[]> {
    assertAlive("loadAroundChunk");

    const radius = normalizeRadius(refreshOptions?.radius);
    const reason = normalizeReason(refreshOptions?.reason, "visibility-change");

    const result = await loader.loadAroundChunk(center, radius, {
      reason,
      force: refreshOptions?.force,
      signal: refreshOptions?.signal,
      markVisible: refreshOptions?.markVisible,
      preferBatch: refreshOptions?.preferBatch,
      contentProfile: refreshOptions?.contentProfile,
      maxChunks: refreshOptions?.maxChunks,
      retainVisibleChunkKeys: refreshOptions?.retainVisibleChunkKeys,
      priorityDirection: refreshOptions?.priorityDirection,
      batchSize: refreshOptions?.batchSize,
      shouldContinue: refreshOptions?.shouldContinue,
      onBatchLoaded: refreshOptions?.onBatchLoaded,
    });

    dispatchLoaderResult(store, result);

    if (isChunkLoaderFailureResult(result)) {
      setDegraded(result.error, "world-runtime-load-around-chunk-degraded");
    }

    return chunksFromLoaderResult(result);
  }

  async function loadAroundAabb(
    aabb: PhysicsAabb,
    refreshOptions?: WorldRuntimeLoadAroundAabbOptions,
  ): Promise<readonly RuntimeChunkContent[]> {
    assertAlive("loadAroundAabb");

    try {
      const radius = normalizeRadius(refreshOptions?.radius);
      const reason = normalizeReason(refreshOptions?.reason, "physics-aabb");
      const center = {
        x: (aabb.min.x + aabb.max.x) / 2,
        y: (aabb.min.y + aabb.max.y) / 2,
        z: (aabb.min.z + aabb.max.z) / 2,
      };
      const centerChunk = worldToChunkCoordinates(center, DEFAULT_CHUNK_SIZE);
      const visibleKeys = new Set<string>(
        visibleChunkCoordinatesAround(centerChunk, radius).map((coordinates) =>
          chunkKeyFromRuntimeCoordinates(coordinates),
        ),
      );

      if (safeBoolean(refreshOptions?.includeAabbChunks, true)) {
        for (const key of chunkKeysForWorldAabb(aabb, DEFAULT_CHUNK_SIZE)) {
          visibleKeys.add(key);
        }
      }

      setRegistryVisibleChunkKeys(getRegistry(), [...visibleKeys], String(reason));

      const result = await loader.loadAroundPosition(center, {
        reason,
        force: refreshOptions?.force,
        signal: refreshOptions?.signal,
        radius,
      });

      dispatchLoaderResult(store, result);

      if (isChunkLoaderFailureResult(result)) {
        setDegraded(result.error, "world-runtime-load-around-aabb-degraded");
      }

      return chunksFromLoaderResult(result);
    } catch (error) {
      setDegraded(error, "world-runtime-load-around-aabb-failed");
      return [];
    }
  }

  async function requestFullRefresh(
    refreshOptions?: WorldRuntimeRefreshOptions,
  ): Promise<void> {
    assertAlive("requestFullRefresh");

    const result = await loader.requestFullRefresh({
      reason: normalizeReason(refreshOptions?.reason, "full-refresh"),
      force: refreshOptions?.force ?? true,
      signal: refreshOptions?.signal,
    });

    dispatchLoaderResult(store, result);

    storeAction(store, {
      kind: "world/full-refresh",
      loadedChunkKeys: isChunkLoaderSuccessResult(result) ? result.loadedChunkKeys : [],
      createdAt: now(),
      source: "world-runtime.full-refresh",
    });

    if (isChunkLoaderFailureResult(result)) {
      setDegraded(result.error, "world-runtime-full-refresh-degraded");
    }
  }

  async function reloadDirtyChunks(
    refreshOptions?: WorldRuntimeRefreshOptions,
  ): Promise<void> {
    assertAlive("reloadDirtyChunks");

    const dirtyBefore = getSourceDirtyChunkKeys(source);

    if (dirtyBefore.length === 0) {
      return;
    }

    storeAction(store, dirtyChunksAction(dirtyBefore));

    const result = await loader.reloadDirtyChunks({
      reason: normalizeReason(refreshOptions?.reason, "dirty-reload"),
      force: refreshOptions?.force ?? true,
      signal: refreshOptions?.signal,
    });

    dispatchLoaderResult(store, result);

    storeAction(store, {
      kind: "world/dirty-reloaded",
      reloadedChunkKeys: isChunkLoaderSuccessResult(result) ? result.loadedChunkKeys : [],
      createdAt: now(),
      source: "world-runtime.dirty-reload",
    });

    if (isChunkLoaderFailureResult(result)) {
      setDegraded(result.error, "world-runtime-dirty-reload-degraded");
    }
  }

  function markChunkDirty(chunkKey: string, reason?: string): readonly string[] {
    assertAlive("markChunkDirty");

    const dirty = markSourceChunkDirty(source, chunkKey, reason);
    storeAction(store, dirtyChunksAction(dirty));
    return dirty;
  }

  function markChunksDirty(
    chunkKeys: readonly string[],
    reason?: string,
  ): readonly string[] {
    assertAlive("markChunksDirty");

    const dirty = markSourceChunksDirty(source, chunkKeys, reason);
    storeAction(store, dirtyChunksAction(dirty));
    return dirty;
  }

  function getDirtyChunkKeys(): readonly string[] {
    try {
      return getSourceDirtyChunkKeys(source);
    } catch {
      return [];
    }
  }

  function sampleCell(position: ChunkWorldPosition) {
    try {
      return getRegistry().sampleCellByWorldPosition(position);
    } catch {
      return createFallbackSample(position);
    }
  }

  function getSnapshot(): WorldRuntimeSnapshot {
    const registry = getRegistry();

    return {
      kind: WORLD_RUNTIME_SNAPSHOT_KIND,
      id,
      status,
      createdAt,
      updatedAt,
      destroyedAt,
      projectId: chunkConfig.projectId,
      worldId: chunkConfig.worldId,
      source: source.getSummary(),
      loader: loader.getSnapshot(),
      visibleChunkKeys: getSourceVisibleChunkKeys(source),
      loadedChunkKeys: getSourceLoadedChunkKeys(source),
      dirtyChunkKeys: getSourceDirtyChunkKeys(source),
      failedChunkKeys: getRegistryFailedChunkKeys(registry),
      collisionReaderAvailable: Boolean(collisionReader),
      lastError,
      ownsChunkWorld: true,
      ownsCollisionReader: true,
      ownsHotbarInventory: false,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      legacyChunkBlocksIgnoredAsInventory: true,
      browserCallsVectoplanLibraryDirectly: false,
    };
  }

  async function destroy(reason?: string): Promise<void> {
    if (destroyed) {
      return;
    }

    const destroyReason = safeString(reason, "world-runtime.destroy");

    destroyed = true;
    setStatus("destroying", destroyReason);

    try {
      collisionQuery = null;
      collisionReader = null;
    } catch {
      // Ignore.
    }

    try {
      sourceUnsubscribe?.();
      sourceUnsubscribe = null;
    } catch {
      // Ignore.
    }

    try {
      loader.destroy(destroyReason);
    } catch (error) {
      logWarn(logger, "Chunk loader destroy failed.", {
        error: normalizeUnknownError(error),
      });
    }

    try {
      await source.destroy(destroyReason);
    } catch (error) {
      logWarn(logger, "Chunk source destroy failed.", {
        error: normalizeUnknownError(error),
      });
    }

    destroyedAt = now();
    setStatus("destroyed", "world-runtime.destroyed");

    logInfo(logger, "World runtime destroyed.", {
      id,
      reason: destroyReason,
    });
  }

  const handle: WorldRuntimeHandle = {
    kind: WORLD_RUNTIME_KIND,

    initialize,

    getStatus(): WorldRuntimeStatus {
      return status;
    },

    getSource(): ChunkSource {
      return source;
    },

    getRegistry,

    getLoader(): ChunkLoaderHandle {
      return loader;
    },

    getSnapshot,

    loadInitialWorld,
    loadAroundPosition,
    loadAroundChunk,
    loadAroundAabb,

    requestFullRefresh,
    reloadDirtyChunks,

    markChunkDirty,
    markChunksDirty,
    getDirtyChunkKeys,

    sampleCell,

    getCollisionWorldReader,
    getBlockCollisionQuery,
    getCollisionCell,
    isCollisionCellLoaded,
    getCollisionSnapshot,

    destroy,
  };

  logInfo(logger, "World runtime created.", {
    id,
    projectId: chunkConfig.projectId,
    worldId: chunkConfig.worldId,
    apiBaseUrl: chunkConfig.apiBaseUrl,
    inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
    legacyChunkInventoryDisabledInWorldRuntime: true,
  });

  return handle;
}

export function isWorldRuntimeHandle(value: unknown): value is WorldRuntimeHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<WorldRuntimeHandle>;

    return (
      record.kind === WORLD_RUNTIME_KIND &&
      typeof record.initialize === "function" &&
      typeof record.getSource === "function" &&
      typeof record.reloadDirtyChunks === "function" &&
      typeof record.requestFullRefresh === "function" &&
      typeof record.getCollisionWorldReader === "function" &&
      typeof record.getBlockCollisionQuery === "function"
    );
  } catch {
    return false;
  }
}

export function getWorldRuntimeMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.runtime.world.world_runtime",
    runtimeKind: WORLD_RUNTIME_KIND,
    snapshotKind: WORLD_RUNTIME_SNAPSHOT_KIND,
    collisionSnapshotKind: WORLD_RUNTIME_COLLISION_SNAPSHOT_KIND,
    ownsChunkWorld: true,
    ownsCollisionReader: true,
    ownsDirtyReload: true,
    ownsHotbarInventory: false,
    primaryInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    rules: {
      worldRuntimeDoesNotDispatchInventoryLoadedFromChunkBlocks: true,
      chunkBlocksAreDiagnosticOnly: true,
      libraryInventoryLoadedBySceneRuntime: true,
      collisionQueriesFailClosedOnMissingChunks: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    },
  };
}
