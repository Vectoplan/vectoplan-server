// services/vectoplan-editor/src/frontend/runtime/scene/scene_world_bridge.ts
import type { EditorLogger } from "@utils/logger";
import { createEditorId } from "@utils/ids";
import { normalizeUnknownError, safeBoolean, safeInteger, safeString, uniqueStrings } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { ChunkSourceEvent, ChunkSourceUnsubscribe } from "@runtime/world/chunk_source";
import type { RuntimeChunkContent } from "@runtime/world/chunk_content";
import type { ChunkRegistryHandle } from "@runtime/world/chunk_registry";
import type { WorldRuntimeHandle } from "@runtime/world/world_runtime";
import type {
  ChunkSceneEntry,
  ChunkSceneHandle,
  ChunkSceneSnapshot,
  ChunkSceneStats,
} from "@render/chunk_scene";

export type SceneWorldBridgeStatus =
  | "created"
  | "initializing"
  | "ready"
  | "syncing"
  | "remeshing"
  | "degraded"
  | "failed"
  | "destroyed";

export type SceneWorldBridgeSyncReason =
  | "initialize"
  | "manual"
  | "source-event"
  | "chunk-loaded"
  | "chunks-loaded"
  | "command-result"
  | "dirty-chunks"
  | "dirty-reload"
  | "full-refresh"
  | "visibility-change"
  | "store-update"
  | "destroy";

export interface SceneWorldBridgeOptions {
  readonly worldRuntime: WorldRuntimeHandle;
  readonly chunkScene: ChunkSceneHandle;
  readonly store?: EditorStore;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly autoInitialize?: boolean;
  readonly autoSyncOnInitialize?: boolean;
  readonly syncOnSourceEvents?: boolean;
  readonly debounceSyncMs?: number;
  readonly clearMissingChunksOnSync?: boolean;
  readonly dispatchToStore?: boolean;
  readonly renderAfterSync?: () => void;
}

export interface SceneWorldBridgeSyncOptions {
  readonly reason?: SceneWorldBridgeSyncReason;
  readonly clearMissing?: boolean;
  readonly onlyVisible?: boolean;
  readonly dispatchToStore?: boolean;
  readonly renderAfterSync?: boolean;
}

export interface SceneWorldBridgeRemeshOptions {
  readonly reason?: SceneWorldBridgeSyncReason;
  readonly dirtyChunkKeys?: readonly string[];
  readonly dispatchToStore?: boolean;
  readonly renderAfterSync?: boolean;
}

export interface SceneWorldBridgeSyncResult {
  readonly ok: boolean;
  readonly reason: SceneWorldBridgeSyncReason;
  readonly syncedChunkKeys: readonly string[];
  readonly visibleChunkKeys: readonly string[];
  readonly renderedChunkKeys: readonly string[];
  readonly meshCount: number;
  readonly elapsedMs: number;
  readonly completedAt: string;
  readonly error: Record<string, unknown> | null;
}

export interface SceneWorldBridgeSnapshot {
  readonly kind: "scene-world-bridge-snapshot.v1";
  readonly id: string;
  readonly status: SceneWorldBridgeStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly initialized: boolean;
  readonly destroyed: boolean;
  readonly syncCount: number;
  readonly failedSyncCount: number;
  readonly remeshCount: number;
  readonly sourceEventCount: number;
  readonly scheduledSyncCount: number;
  readonly lastSyncAt: string | null;
  readonly lastSyncReason: SceneWorldBridgeSyncReason | null;
  readonly lastSyncedChunkKeys: readonly string[];
  readonly lastRenderedChunkKeys: readonly string[];
  readonly lastDirtyChunkKeys: readonly string[];
  readonly lastError: Record<string, unknown> | null;
  readonly sourceSubscribed: boolean;
  readonly chunkScene: ChunkSceneSnapshot;
  readonly chunkSceneStats: ChunkSceneStats;
}

export interface SceneWorldBridgeHandle {
  readonly kind: "vectoplan-editor-scene-world-bridge.v1";

  initialize(): Promise<void>;

  syncFromWorld(options?: SceneWorldBridgeSyncOptions): SceneWorldBridgeSyncResult;
  syncVisible(options?: SceneWorldBridgeSyncOptions): SceneWorldBridgeSyncResult;
  remeshDirtyChunks(options?: SceneWorldBridgeRemeshOptions): SceneWorldBridgeSyncResult;

  scheduleSync(options?: SceneWorldBridgeSyncOptions): void;
  cancelScheduledSync(reason?: string): void;

  handleSourceEvent(event: ChunkSourceEvent): void;

  getStatus(): SceneWorldBridgeStatus;
  getWorldRuntime(): WorldRuntimeHandle;
  getRegistry(): ChunkRegistryHandle;
  getChunkScene(): ChunkSceneHandle;
  getSnapshot(): SceneWorldBridgeSnapshot;

  destroy(reason?: string): void;
}

const SCENE_WORLD_BRIDGE_KIND = "vectoplan-editor-scene-world-bridge.v1" as const;
const SCENE_WORLD_BRIDGE_SNAPSHOT_KIND = "scene-world-bridge-snapshot.v1" as const;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function nowMs(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
  }
}

function elapsedMs(startedAtMs: number): number {
  try {
    return Math.max(0, Math.round(nowMs() - startedAtMs));
  } catch {
    return 0;
  }
}

function normalizeReason(value: unknown, fallback: SceneWorldBridgeSyncReason): SceneWorldBridgeSyncReason {
  const normalized = safeString(value, fallback);

  if (
    normalized === "initialize"
    || normalized === "manual"
    || normalized === "source-event"
    || normalized === "chunk-loaded"
    || normalized === "chunks-loaded"
    || normalized === "command-result"
    || normalized === "dirty-chunks"
    || normalized === "dirty-reload"
    || normalized === "full-refresh"
    || normalized === "visibility-change"
    || normalized === "store-update"
    || normalized === "destroy"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeDebounceMs(value: unknown): number {
  return safeInteger(value, 60, {
    min: 0,
    max: 2_000,
  });
}

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Bridge logging must never break runtime.
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
    // Bridge logging must never break runtime.
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
    // Bridge logging must never break runtime.
  }
}

function entryChunkKeys(entries: readonly ChunkSceneEntry[]): readonly string[] {
  try {
    return uniqueStrings(entries.map((entry) => entry.chunkKey));
  } catch {
    return [];
  }
}

function runtimeChunkKeys(chunks: readonly RuntimeChunkContent[]): readonly string[] {
  try {
    return uniqueStrings(chunks.map((chunk) => chunk.chunkKey));
  } catch {
    return [];
  }
}

function readDirtyChunkKeysFromPayload(payload: unknown): readonly string[] {
  try {
    if (Array.isArray(payload)) {
      return uniqueStrings(payload);
    }

    if (!payload || typeof payload !== "object") {
      return [];
    }

    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.dirtyChunks)) {
      return uniqueStrings(record.dirtyChunks);
    }

    if (Array.isArray(record.dirtyChunkKeys)) {
      return uniqueStrings(record.dirtyChunkKeys);
    }

    if (record.result && typeof record.result === "object") {
      const result = record.result as Record<string, unknown>;

      if (Array.isArray(result.dirtyChunks)) {
        return uniqueStrings(result.dirtyChunks);
      }

      if (Array.isArray(result.changedChunks)) {
        return uniqueStrings(result.changedChunks);
      }
    }

    return [];
  } catch {
    return [];
  }
}

function readLoadedChunksFromPayload(payload: unknown): readonly RuntimeChunkContent[] {
  try {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const record = payload as Record<string, unknown>;

    if (record.chunk && typeof record.chunk === "object") {
      const chunk = record.chunk as RuntimeChunkContent;

      if (typeof chunk.chunkKey === "string" && Array.isArray(chunk.cells)) {
        return [chunk];
      }
    }

    if (Array.isArray(record.chunks)) {
      return record.chunks.filter((item): item is RuntimeChunkContent => (
        Boolean(item)
        && typeof item === "object"
        && typeof (item as RuntimeChunkContent).chunkKey === "string"
        && Array.isArray((item as RuntimeChunkContent).cells)
      ));
    }

    return [];
  } catch {
    return [];
  }
}

function dispatchRenderedChunksToStore(
  store: EditorStore | undefined,
  input: {
    readonly renderedChunkKeys: readonly string[];
    readonly meshCount: number;
    readonly source: string;
  },
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "render/chunks",
        renderedChunkKeys: input.renderedChunkKeys,
        meshCount: input.meshCount,
        createdAt: now(),
        source: input.source,
      }),
      {
        action: input.source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break scene bridge.
  }
}

function dispatchDirtyChunksToStore(
  store: EditorStore | undefined,
  dirtyChunkKeys: readonly string[],
  source: string,
): void {
  try {
    if (!store || dirtyChunkKeys.length === 0) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "world/dirty-chunks",
        dirtyChunkKeys,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break scene bridge.
  }
}

function dispatchDebugError(
  store: EditorStore | undefined,
  error: unknown,
  source: string,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "debug/error",
        error,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Ignore.
  }
}

function maybeRenderAfterSync(callback: (() => void) | undefined, enabled: boolean): void {
  try {
    if (!enabled) {
      return;
    }

    callback?.();
  } catch {
    // Rendering callback must not break bridge state.
  }
}

function buildSuccessResult(input: {
  readonly reason: SceneWorldBridgeSyncReason;
  readonly syncedChunkKeys: readonly string[];
  readonly visibleChunkKeys: readonly string[];
  readonly renderedChunkKeys: readonly string[];
  readonly meshCount: number;
  readonly startedAtMs: number;
}): SceneWorldBridgeSyncResult {
  return {
    ok: true,
    reason: input.reason,
    syncedChunkKeys: uniqueStrings(input.syncedChunkKeys),
    visibleChunkKeys: uniqueStrings(input.visibleChunkKeys),
    renderedChunkKeys: uniqueStrings(input.renderedChunkKeys),
    meshCount: input.meshCount,
    elapsedMs: elapsedMs(input.startedAtMs),
    completedAt: now(),
    error: null,
  };
}

function buildFailedResult(input: {
  readonly reason: SceneWorldBridgeSyncReason;
  readonly startedAtMs: number;
  readonly error: unknown;
  readonly syncedChunkKeys?: readonly string[];
  readonly visibleChunkKeys?: readonly string[];
  readonly renderedChunkKeys?: readonly string[];
  readonly meshCount?: number;
}): SceneWorldBridgeSyncResult {
  return {
    ok: false,
    reason: input.reason,
    syncedChunkKeys: uniqueStrings(input.syncedChunkKeys ?? []),
    visibleChunkKeys: uniqueStrings(input.visibleChunkKeys ?? []),
    renderedChunkKeys: uniqueStrings(input.renderedChunkKeys ?? []),
    meshCount: input.meshCount ?? 0,
    elapsedMs: elapsedMs(input.startedAtMs),
    completedAt: now(),
    error: normalizeUnknownError(input.error),
  };
}

export function createSceneWorldBridge(options: SceneWorldBridgeOptions): SceneWorldBridgeHandle {
  const id = createEditorId({
    prefix: "scene_world_bridge",
  });
  const worldRuntime = options.worldRuntime;
  const chunkScene = options.chunkScene;
  const store = options.store;
  const logger = options.logger;
  const debounceSyncMs = normalizeDebounceMs(options.debounceSyncMs);
  const clearMissingChunksOnSync = safeBoolean(options.clearMissingChunksOnSync, false);
  const dispatchToStoreDefault = safeBoolean(options.dispatchToStore, true);
  const syncOnSourceEvents = safeBoolean(options.syncOnSourceEvents, true);
  const autoSyncOnInitialize = safeBoolean(options.autoSyncOnInitialize, true);

  const createdAt = now();

  let status: SceneWorldBridgeStatus = "created";
  let initialized = false;
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let syncCount = 0;
  let failedSyncCount = 0;
  let remeshCount = 0;
  let sourceEventCount = 0;
  let scheduledSyncCount = 0;
  let lastSyncAt: string | null = null;
  let lastSyncReason: SceneWorldBridgeSyncReason | null = null;
  let lastSyncedChunkKeys: readonly string[] = [];
  let lastRenderedChunkKeys: readonly string[] = [];
  let lastDirtyChunkKeys: readonly string[] = [];
  let lastError: Record<string, unknown> | null = null;
  let sourceUnsubscribe: ChunkSourceUnsubscribe | null = null;
  let scheduledSyncId: number | null = null;

  function setStatus(nextStatus: SceneWorldBridgeStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function setFailure(error: unknown): void {
    lastError = normalizeUnknownError(error);
    failedSyncCount += 1;
    setStatus("failed");
    dispatchDebugError(store, error, "scene-world-bridge.error");
  }

  function assertAlive(action: string): void {
    if (destroyed || status === "destroyed") {
      throw new Error(`SceneWorldBridge is destroyed. Action '${action}' is not allowed.`);
    }
  }

  function updateLastSync(result: SceneWorldBridgeSyncResult): void {
    lastSyncAt = result.completedAt;
    lastSyncReason = result.reason;
    lastSyncedChunkKeys = result.syncedChunkKeys;
    lastRenderedChunkKeys = result.renderedChunkKeys;

    if (result.ok) {
      lastError = null;
      syncCount += 1;
      setStatus("ready");
    } else {
      lastError = result.error;
      failedSyncCount += 1;
      setStatus("failed");
    }
  }

  function dispatchResultToStore(result: SceneWorldBridgeSyncResult, source: string): void {
    if (!result.ok) {
      if (result.error) {
        dispatchDebugError(store, result.error, source);
      }
      return;
    }

    dispatchRenderedChunksToStore(store, {
      renderedChunkKeys: result.renderedChunkKeys,
      meshCount: result.meshCount,
      source,
    });
  }

  function syncFromWorld(syncOptions?: SceneWorldBridgeSyncOptions): SceneWorldBridgeSyncResult {
    const startedAtMs = nowMs();
    const reason = normalizeReason(syncOptions?.reason, "manual");
    const dispatchToStore = syncOptions?.dispatchToStore ?? dispatchToStoreDefault;
    const renderAfterSync = syncOptions?.renderAfterSync ?? true;

    try {
      assertAlive("syncFromWorld");
      setStatus("syncing");

      const registry = worldRuntime.getRegistry();
      const entries = chunkScene.syncFromRegistry(registry, {
        onlyVisible: syncOptions?.onlyVisible ?? false,
        clearMissing: syncOptions?.clearMissing ?? clearMissingChunksOnSync,
        reason,
      });

      const stats = chunkScene.getStats();
      const renderedChunkKeys = chunkScene.getVisibleChunkKeys();
      const visibleChunkKeys = registry.getVisibleChunkKeys();

      const result = buildSuccessResult({
        reason,
        syncedChunkKeys: entryChunkKeys(entries),
        visibleChunkKeys,
        renderedChunkKeys,
        meshCount: stats.meshObjectCount,
        startedAtMs,
      });

      updateLastSync(result);

      if (dispatchToStore) {
        dispatchResultToStore(result, `scene-world-bridge.sync.${reason}`);
      }

      maybeRenderAfterSync(options.renderAfterSync, renderAfterSync);

      logDebug(logger, "Scene world bridge synced from world.", {
        reason,
        syncedChunkKeys: result.syncedChunkKeys,
        renderedChunkKeys: result.renderedChunkKeys,
        elapsedMs: result.elapsedMs,
      });

      return result;
    } catch (error) {
      const result = buildFailedResult({
        reason,
        startedAtMs,
        error,
        renderedChunkKeys: chunkScene.getVisibleChunkKeys(),
        meshCount: chunkScene.getStats().meshObjectCount,
      });

      updateLastSync(result);
      setFailure(error);

      logWarn(logger, "Scene world bridge sync failed.", {
        reason,
        error: normalizeUnknownError(error),
      });

      return result;
    }
  }

  function syncVisible(syncOptions?: SceneWorldBridgeSyncOptions): SceneWorldBridgeSyncResult {
    return syncFromWorld({
      ...syncOptions,
      onlyVisible: true,
      clearMissing: syncOptions?.clearMissing ?? true,
      reason: syncOptions?.reason ?? "visibility-change",
    });
  }

  function remeshDirtyChunks(remeshOptions?: SceneWorldBridgeRemeshOptions): SceneWorldBridgeSyncResult {
    const startedAtMs = nowMs();
    const reason = normalizeReason(remeshOptions?.reason, "dirty-reload");
    const dispatchToStore = remeshOptions?.dispatchToStore ?? dispatchToStoreDefault;
    const renderAfterSync = remeshOptions?.renderAfterSync ?? true;

    try {
      assertAlive("remeshDirtyChunks");
      setStatus("remeshing");

      const registry = worldRuntime.getRegistry();
      const dirtyChunkKeys = uniqueStrings(remeshOptions?.dirtyChunkKeys ?? worldRuntime.getDirtyChunkKeys());
      lastDirtyChunkKeys = dirtyChunkKeys;

      if (dirtyChunkKeys.length === 0) {
        const emptyResult = buildSuccessResult({
          reason,
          syncedChunkKeys: [],
          visibleChunkKeys: registry.getVisibleChunkKeys(),
          renderedChunkKeys: chunkScene.getVisibleChunkKeys(),
          meshCount: chunkScene.getStats().meshObjectCount,
          startedAtMs,
        });

        updateLastSync(emptyResult);
        return emptyResult;
      }

      const entries = chunkScene.remeshDirtyChunks(registry, dirtyChunkKeys, {
        replaceExisting: true,
        reason,
      });

      const stats = chunkScene.getStats();

      const result = buildSuccessResult({
        reason,
        syncedChunkKeys: entryChunkKeys(entries),
        visibleChunkKeys: registry.getVisibleChunkKeys(),
        renderedChunkKeys: chunkScene.getVisibleChunkKeys(),
        meshCount: stats.meshObjectCount,
        startedAtMs,
      });

      remeshCount += 1;
      updateLastSync(result);

      if (dispatchToStore) {
        dispatchResultToStore(result, `scene-world-bridge.remesh.${reason}`);
      }

      maybeRenderAfterSync(options.renderAfterSync, renderAfterSync);

      logDebug(logger, "Scene world bridge remeshed dirty chunks.", {
        reason,
        dirtyChunkKeys,
        syncedChunkKeys: result.syncedChunkKeys,
      });

      return result;
    } catch (error) {
      const result = buildFailedResult({
        reason,
        startedAtMs,
        error,
        syncedChunkKeys: [],
        visibleChunkKeys: chunkScene.getVisibleChunkKeys(),
        renderedChunkKeys: chunkScene.getVisibleChunkKeys(),
        meshCount: chunkScene.getStats().meshObjectCount,
      });

      updateLastSync(result);
      setFailure(error);

      logWarn(logger, "Scene world bridge dirty remesh failed.", {
        reason,
        error: normalizeUnknownError(error),
      });

      return result;
    }
  }

  function cancelScheduledSync(reason?: string): void {
    try {
      if (scheduledSyncId !== null) {
        window.clearTimeout(scheduledSyncId);
        scheduledSyncId = null;
      }

      logDebug(logger, "Scene world bridge scheduled sync cancelled.", {
        reason: reason ?? null,
      });
    } catch {
      scheduledSyncId = null;
    }
  }

  function scheduleSync(syncOptions?: SceneWorldBridgeSyncOptions): void {
    try {
      assertAlive("scheduleSync");

      cancelScheduledSync("reschedule");
      scheduledSyncCount += 1;

      const reason = normalizeReason(syncOptions?.reason, "source-event");

      if (debounceSyncMs <= 0) {
        syncFromWorld({
          ...syncOptions,
          reason,
        });
        return;
      }

      scheduledSyncId = window.setTimeout(() => {
        scheduledSyncId = null;
        syncFromWorld({
          ...syncOptions,
          reason,
        });
      }, debounceSyncMs);
    } catch (error) {
      setFailure(error);
    }
  }

  function handleSourceEvent(event: ChunkSourceEvent): void {
    try {
      if (destroyed) {
        return;
      }

      sourceEventCount += 1;

      switch (event.type) {
        case "chunk-loaded": {
          const chunks = readLoadedChunksFromPayload(event.payload);
          const keys = runtimeChunkKeys(chunks);

          if (keys.length > 0) {
            scheduleSync({
              reason: "chunk-loaded",
            });
          }

          return;
        }

        case "chunks-loaded": {
          const chunks = readLoadedChunksFromPayload(event.payload);
          const keys = runtimeChunkKeys(chunks);

          if (keys.length > 0) {
            scheduleSync({
              reason: "chunks-loaded",
            });
          } else {
            scheduleSync({
              reason: "source-event",
            });
          }

          return;
        }

        case "command-result": {
          const dirtyChunkKeys = readDirtyChunkKeysFromPayload(event.payload);
          lastDirtyChunkKeys = dirtyChunkKeys;

          if (dirtyChunkKeys.length > 0) {
            dispatchDirtyChunksToStore(store, dirtyChunkKeys, "scene-world-bridge.command-result");
          }

          scheduleSync({
            reason: "command-result",
          });

          return;
        }

        case "dirty-chunks": {
          const dirtyChunkKeys = readDirtyChunkKeysFromPayload(event.payload);
          lastDirtyChunkKeys = dirtyChunkKeys;

          if (dirtyChunkKeys.length > 0) {
            dispatchDirtyChunksToStore(store, dirtyChunkKeys, "scene-world-bridge.dirty-chunks");
          }

          return;
        }

        case "blocks-loaded":
        case "lifecycle":
          return;

        case "error": {
          lastError = normalizeUnknownError(event.payload);
          setStatus("degraded");
          dispatchDebugError(store, event.payload, "scene-world-bridge.source-error");
          return;
        }

        case "destroyed":
          setStatus("degraded");
          return;

        default:
          scheduleSync({
            reason: "source-event",
          });
      }
    } catch (error) {
      setFailure(error);

      logWarn(logger, "Scene world bridge source event handling failed.", {
        eventType: event.type,
        error: normalizeUnknownError(error),
      });
    }
  }

  function subscribeSourceEvents(): void {
    if (!syncOnSourceEvents || sourceUnsubscribe) {
      return;
    }

    try {
      sourceUnsubscribe = worldRuntime.getSource().subscribe(handleSourceEvent);

      logDebug(logger, "Scene world bridge subscribed to chunk source events.");
    } catch (error) {
      setFailure(error);

      logWarn(logger, "Scene world bridge could not subscribe to source events.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function attachAbortSignal(): void {
    try {
      const signal = options.signal;

      if (!signal) {
        return;
      }

      if (signal.aborted) {
        handle.destroy("abort-signal-already-aborted");
        return;
      }

      signal.addEventListener(
        "abort",
        () => {
          handle.destroy("abort-signal");
        },
        {
          once: true,
        },
      );
    } catch {
      // Abort wiring is best-effort.
    }
  }

  async function initialize(): Promise<void> {
    try {
      assertAlive("initialize");

      if (initialized) {
        return;
      }

      setStatus("initializing");
      subscribeSourceEvents();

      if (autoSyncOnInitialize) {
        syncFromWorld({
          reason: "initialize",
          clearMissing: false,
          onlyVisible: false,
          dispatchToStore: true,
          renderAfterSync: true,
        });
      }

      initialized = true;
      setStatus("ready");

      logInfo(logger, "Scene world bridge initialized.", {
        id,
        syncOnSourceEvents,
        autoSyncOnInitialize,
      });
    } catch (error) {
      setFailure(error);
      throw error;
    }
  }

  function getSnapshot(): SceneWorldBridgeSnapshot {
    return {
      kind: SCENE_WORLD_BRIDGE_SNAPSHOT_KIND,
      id,
      status,
      createdAt,
      updatedAt,
      destroyedAt,
      initialized,
      destroyed,
      syncCount,
      failedSyncCount,
      remeshCount,
      sourceEventCount,
      scheduledSyncCount,
      lastSyncAt,
      lastSyncReason,
      lastSyncedChunkKeys,
      lastRenderedChunkKeys,
      lastDirtyChunkKeys,
      lastError,
      sourceSubscribed: sourceUnsubscribe !== null,
      chunkScene: chunkScene.getSnapshot(),
      chunkSceneStats: chunkScene.getStats(),
    };
  }

  function destroy(reason?: string): void {
    if (destroyed) {
      return;
    }

    destroyed = true;
    destroyedAt = now();

    cancelScheduledSync(reason ?? "destroy");

    try {
      sourceUnsubscribe?.();
      sourceUnsubscribe = null;
    } catch {
      // Ignore.
    }

    setStatus("destroyed");

    logInfo(logger, "Scene world bridge destroyed.", {
      id,
      reason: reason ?? null,
      syncCount,
      failedSyncCount,
      remeshCount,
      sourceEventCount,
    });
  }

  const handle: SceneWorldBridgeHandle = {
    kind: SCENE_WORLD_BRIDGE_KIND,

    initialize,

    syncFromWorld,
    syncVisible,
    remeshDirtyChunks,

    scheduleSync,
    cancelScheduledSync,

    handleSourceEvent,

    getStatus(): SceneWorldBridgeStatus {
      return status;
    },

    getWorldRuntime(): WorldRuntimeHandle {
      return worldRuntime;
    },

    getRegistry(): ChunkRegistryHandle {
      return worldRuntime.getRegistry();
    },

    getChunkScene(): ChunkSceneHandle {
      return chunkScene;
    },

    getSnapshot,

    destroy,
  };

  attachAbortSignal();

  if (options.autoInitialize === true) {
    void initialize().catch((error) => {
      setFailure(error);
    });
  }

  logDebug(logger, "Scene world bridge created.", {
    id,
    syncOnSourceEvents,
    autoSyncOnInitialize,
    debounceSyncMs,
    clearMissingChunksOnSync,
  });

  return handle;
}

export function isSceneWorldBridgeHandle(value: unknown): value is SceneWorldBridgeHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<SceneWorldBridgeHandle>;

    return (
      record.kind === SCENE_WORLD_BRIDGE_KIND
      && typeof record.initialize === "function"
      && typeof record.syncFromWorld === "function"
      && typeof record.remeshDirtyChunks === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}