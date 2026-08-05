// services/vectoplan-editor/src/frontend/render/chunk_scene.ts
import * as THREE from "three";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeString, uniqueStrings } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { RuntimeChunkContent } from "@runtime/world/chunk_content";
import type { ChunkRegistryHandle } from "@runtime/world/chunk_registry";
import {
  chunkMeshResultToDebugSummary,
  createChunkMesher,
  type ChunkMeshBuildOptions,
  type ChunkMeshResult,
  type ChunkMesherHandle,
  type ChunkMesherOptions,
} from "./chunk_mesher";
import type { ThreeContextHandle } from "./three_context";

export type ChunkSceneStatus =
  | "created"
  | "ready"
  | "updating"
  | "degraded"
  | "failed"
  | "disposed";

export interface ChunkSceneOptions {
  readonly three: ThreeContextHandle;
  readonly logger?: EditorLogger;
  readonly mesher?: ChunkMesherHandle;
  readonly mesherOptions?: ChunkMesherOptions;
  readonly autoAttachToThreeChunkGroup?: boolean;
  readonly includeDebugUserData?: boolean;
  readonly visibleByDefault?: boolean;
}

export interface ChunkSceneUpdateOptions extends ChunkMeshBuildOptions {
  readonly reason?: string;
  readonly replaceExisting?: boolean;
}

export interface ChunkSceneSyncOptions extends ChunkSceneUpdateOptions {
  readonly onlyVisible?: boolean;
  readonly clearMissing?: boolean;
}

export interface ChunkSceneEntry {
  readonly chunkKey: string;
  readonly chunk: RuntimeChunkContent;
  readonly mesh: ChunkMeshResult;
  readonly visible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number | null;
  readonly version: string | null;
}

export interface ChunkSceneStats {
  readonly entryCount: number;
  readonly visibleEntryCount: number;
  readonly meshObjectCount: number;
  readonly totalEmittedCellCount: number;
  readonly totalSkippedCellCount: number;
  readonly totalNonAirCellCount: number;
  readonly lastUpdatedAt: string | null;
}

export interface ChunkSceneSnapshot {
  readonly kind: "chunk-scene-snapshot.v1";
  readonly status: ChunkSceneStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly chunkKeys: readonly string[];
  readonly visibleChunkKeys: readonly string[];
  readonly stats: ChunkSceneStats;
  readonly mesher: ReturnType<ChunkMesherHandle["getSnapshot"]>;
  readonly lastError: Record<string, unknown> | null;
}

export interface ChunkSceneHandle {
  readonly kind: "vectoplan-editor-chunk-scene.v1";

  setChunk(chunk: RuntimeChunkContent, options?: ChunkSceneUpdateOptions): ChunkSceneEntry;
  setChunks(chunks: readonly RuntimeChunkContent[], options?: ChunkSceneUpdateOptions): readonly ChunkSceneEntry[];

  removeChunk(chunkKey: string, reason?: string): boolean;
  clear(reason?: string): void;

  hasChunk(chunkKey: string): boolean;
  getEntry(chunkKey: string): ChunkSceneEntry | null;
  getChunkKeys(): readonly string[];
  getVisibleChunkKeys(): readonly string[];

  setChunkVisible(chunkKey: string, visible: boolean, reason?: string): boolean;
  setVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[];

  syncFromRegistry(registry: ChunkRegistryHandle, options?: ChunkSceneSyncOptions): readonly ChunkSceneEntry[];
  remeshDirtyChunks(registry: ChunkRegistryHandle, dirtyChunkKeys: readonly string[], options?: ChunkSceneUpdateOptions): readonly ChunkSceneEntry[];

  getGroup(): THREE.Group;
  getStats(): ChunkSceneStats;
  getSnapshot(): ChunkSceneSnapshot;
  debugSummary(): Record<string, unknown>;

  dispose(reason?: string): void;
}

const CHUNK_SCENE_KIND = "vectoplan-editor-chunk-scene.v1" as const;
const CHUNK_SCENE_SNAPSHOT_KIND = "chunk-scene-snapshot.v1" as const;

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Chunk scene logging must never break rendering.
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
    // Chunk scene logging must never break rendering.
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
    // Chunk scene logging must never break rendering.
  }
}

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeChunkKey(value: unknown): string {
  try {
    const normalized = safeString(value, "");
    return normalized.length > 0 ? normalized : "0:0:0";
  } catch {
    return "0:0:0";
  }
}

function removeObjectFromParent(object: THREE.Object3D | null | undefined): void {
  try {
    if (!object) {
      return;
    }

    object.parent?.remove(object);
  } catch {
    // Best-effort only.
  }
}

function setObjectVisible(object: THREE.Object3D | null | undefined, visible: boolean): void {
  try {
    if (!object) {
      return;
    }

    object.visible = visible;
  } catch {
    // Best-effort only.
  }
}

function addObjectIfMissing(group: THREE.Group, object: THREE.Object3D): void {
  try {
    if (object.parent === group) {
      return;
    }

    object.parent?.remove(object);
    group.add(object);
  } catch {
    // Ignore; caller handles degraded rendering state.
  }
}

function entryFromMesh(
  chunk: RuntimeChunkContent,
  mesh: ChunkMeshResult,
  visible: boolean,
  existing?: ChunkSceneEntry | null,
): ChunkSceneEntry {
  const timestamp = now();

  return {
    chunkKey: chunk.chunkKey,
    chunk,
    mesh,
    visible,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    revision: chunk.chunkRevision,
    version: chunk.chunkVersion,
  };
}

function disposeEntry(entry: ChunkSceneEntry | null | undefined): void {
  try {
    if (!entry) {
      return;
    }

    removeObjectFromParent(entry.mesh.group);
    entry.mesh.dispose();
  } catch {
    // Best-effort only.
  }
}

function entryNeedsRemesh(entry: ChunkSceneEntry, chunk: RuntimeChunkContent): boolean {
  try {
    return (
      entry.chunk.chunkKey !== chunk.chunkKey
      || entry.revision !== chunk.chunkRevision
      || entry.version !== chunk.chunkVersion
      || entry.chunk.stats.nonAirCellCount !== chunk.stats.nonAirCellCount
      || entry.chunk.stats.cellCount !== chunk.stats.cellCount
      || entry.chunk.loadedAt !== chunk.loadedAt
    );
  } catch {
    return true;
  }
}

function countObjects(root: THREE.Object3D): number {
  try {
    let count = 0;

    root.traverse(() => {
      count += 1;
    });

    return count;
  } catch {
    return 0;
  }
}

function collectStats(entries: Iterable<ChunkSceneEntry>, lastUpdatedAt: string | null): ChunkSceneStats {
  let entryCount = 0;
  let visibleEntryCount = 0;
  let meshObjectCount = 0;
  let totalEmittedCellCount = 0;
  let totalSkippedCellCount = 0;
  let totalNonAirCellCount = 0;

  try {
    for (const entry of entries) {
      entryCount += 1;

      if (entry.visible) {
        visibleEntryCount += 1;
      }

      meshObjectCount += entry.mesh.meshes.length;
      totalEmittedCellCount += entry.mesh.stats.emittedCellCount;
      totalSkippedCellCount += entry.mesh.stats.skippedCellCount;
      totalNonAirCellCount += entry.chunk.stats.nonAirCellCount;
    }
  } catch {
    // Return partial stats.
  }

  return {
    entryCount,
    visibleEntryCount,
    meshObjectCount,
    totalEmittedCellCount,
    totalSkippedCellCount,
    totalNonAirCellCount,
    lastUpdatedAt,
  };
}

function sortKeys(keys: Iterable<string>): readonly string[] {
  try {
    return [...keys].sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

export function createChunkScene(options: ChunkSceneOptions): ChunkSceneHandle {
  const logger = options.logger;
  const three = options.three;
  const mesher = options.mesher ?? createChunkMesher({
    logger,
    ...(options.mesherOptions ?? {}),
  });
  const attachToThreeChunkGroup = options.autoAttachToThreeChunkGroup ?? true;
  const includeDebugUserData = options.includeDebugUserData ?? true;
  const visibleByDefault = options.visibleByDefault ?? true;

  const group = new THREE.Group();
  group.name = "vectoplan_chunk_scene_group";

  const entries = new Map<string, ChunkSceneEntry>();

  const createdAt = now();
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let status: ChunkSceneStatus = "created";
  let disposed = false;
  let lastError: Record<string, unknown> | null = null;

  function setStatus(nextStatus: ChunkSceneStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function setError(error: unknown): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed");
  }

  function assertAlive(action: string): void {
    if (disposed || status === "disposed") {
      throw new Error(`ChunkScene is disposed. Action '${action}' is not allowed.`);
    }
  }

  function attachRootGroup(): void {
    try {
      if (!attachToThreeChunkGroup) {
        return;
      }

      const chunkGroup = three.getChunkGroup();
      addObjectIfMissing(chunkGroup, group);
    } catch (error) {
      setError(error);
      logWarn(logger, "Chunk scene root group could not be attached to Three chunk group.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function setChunk(chunk: RuntimeChunkContent, updateOptions?: ChunkSceneUpdateOptions): ChunkSceneEntry {
    assertAlive("setChunk");
    setStatus("updating");

    try {
      attachRootGroup();

      const chunkKey = normalizeChunkKey(chunk.chunkKey);
      const existing = entries.get(chunkKey) ?? null;
      const replaceExisting = updateOptions?.replaceExisting ?? true;
      const visible = updateOptions?.visible ?? existing?.visible ?? visibleByDefault;

      if (existing && !replaceExisting && !entryNeedsRemesh(existing, chunk)) {
        const refreshed = {
          ...existing,
          visible,
          updatedAt: now(),
        };

        setObjectVisible(refreshed.mesh.group, visible);
        entries.set(chunkKey, refreshed);
        setStatus("ready");

        return refreshed;
      }

      const mesh = existing
        ? mesher.rebuildChunkMesh(existing.mesh, chunk, {
            ...updateOptions,
            visible,
            includeDebugUserData,
            namePrefix: "chunk",
          })
        : mesher.buildChunkMesh(chunk, {
            ...updateOptions,
            visible,
            includeDebugUserData,
            namePrefix: "chunk",
          });

      mesh.group.visible = visible;
      addObjectIfMissing(group, mesh.group);

      const entry = entryFromMesh(chunk, mesh, visible, existing);
      entries.set(chunkKey, entry);

      updatedAt = now();
      setStatus("ready");

      logDebug(logger, "Chunk mesh set in scene.", {
        chunkKey,
        visible,
        reason: updateOptions?.reason ?? null,
        meshCount: mesh.meshes.length,
        emittedCellCount: mesh.stats.emittedCellCount,
      });

      return entry;
    } catch (error) {
      setError(error);
      logWarn(logger, "Chunk scene setChunk failed.", {
        chunkKey: chunk.chunkKey,
        error: normalizeUnknownError(error),
      });

      throw error;
    }
  }

  function setChunks(chunks: readonly RuntimeChunkContent[], updateOptions?: ChunkSceneUpdateOptions): readonly ChunkSceneEntry[] {
    assertAlive("setChunks");

    const result: ChunkSceneEntry[] = [];

    for (const chunk of chunks) {
      try {
        result.push(setChunk(chunk, updateOptions));
      } catch {
        // setChunk already logged. Continue other chunks.
      }
    }

    setStatus(result.length === chunks.length ? "ready" : "degraded");

    return result;
  }

  function removeChunk(chunkKey: string, reason?: string): boolean {
    assertAlive("removeChunk");

    const key = normalizeChunkKey(chunkKey);
    const existing = entries.get(key);

    if (!existing) {
      return false;
    }

    disposeEntry(existing);
    const deleted = entries.delete(key);
    updatedAt = now();

    logDebug(logger, "Chunk mesh removed from scene.", {
      chunkKey: key,
      deleted,
      reason: reason ?? null,
    });

    return deleted;
  }

  function clear(reason?: string): void {
    assertAlive("clear");

    for (const entry of entries.values()) {
      disposeEntry(entry);
    }

    entries.clear();
    updatedAt = now();

    logDebug(logger, "Chunk scene cleared.", {
      reason: reason ?? null,
    });
  }

  function getVisibleChunkKeys(): readonly string[] {
    return sortKeys(
      [...entries.values()]
        .filter((entry) => entry.visible)
        .map((entry) => entry.chunkKey),
    );
  }

  function setChunkVisible(chunkKey: string, visible: boolean, reason?: string): boolean {
    assertAlive("setChunkVisible");

    const key = normalizeChunkKey(chunkKey);
    const existing = entries.get(key);

    if (!existing) {
      return false;
    }

    const next = {
      ...existing,
      visible,
      updatedAt: now(),
    };

    setObjectVisible(next.mesh.group, visible);
    entries.set(key, next);
    updatedAt = now();

    logDebug(logger, "Chunk visibility changed.", {
      chunkKey: key,
      visible,
      reason: reason ?? null,
    });

    return true;
  }

  function setVisibleChunkKeys(chunkKeys: readonly string[], reason?: string): readonly string[] {
    assertAlive("setVisibleChunkKeys");

    const normalized = new Set(uniqueStrings(chunkKeys));

    for (const entry of entries.values()) {
      const visible = normalized.has(entry.chunkKey);
      const next = {
        ...entry,
        visible,
        updatedAt: now(),
      };

      setObjectVisible(next.mesh.group, visible);
      entries.set(entry.chunkKey, next);
    }

    updatedAt = now();

    logDebug(logger, "Chunk scene visible keys set.", {
      visibleChunkKeys: [...normalized],
      reason: reason ?? null,
    });

    return getVisibleChunkKeys();
  }

  function syncFromRegistry(registry: ChunkRegistryHandle, syncOptions?: ChunkSceneSyncOptions): readonly ChunkSceneEntry[] {
    assertAlive("syncFromRegistry");

    try {
      const snapshot = registry.getSnapshot();
      const desiredKeys = syncOptions?.onlyVisible === true
        ? snapshot.visibleChunkKeys
        : snapshot.chunkKeys;
      const desiredSet = new Set(desiredKeys);
      const synced: ChunkSceneEntry[] = [];

      for (const key of desiredKeys) {
        const chunk = registry.getChunk(key);

        if (!chunk) {
          continue;
        }

        synced.push(setChunk(chunk, {
          ...syncOptions,
          visible: snapshot.visibleChunkKeys.includes(key),
          reason: syncOptions?.reason ?? "syncFromRegistry",
        }));
      }

      if (syncOptions?.clearMissing === true) {
        for (const existingKey of [...entries.keys()]) {
          if (!desiredSet.has(existingKey)) {
            removeChunk(existingKey, "syncFromRegistry-clearMissing");
          }
        }
      }

      setVisibleChunkKeys(snapshot.visibleChunkKeys, "syncFromRegistry-visibleKeys");
      setStatus("ready");

      return synced;
    } catch (error) {
      setError(error);
      logWarn(logger, "Chunk scene syncFromRegistry failed.", {
        error: normalizeUnknownError(error),
      });

      return [];
    }
  }

  function remeshDirtyChunks(
    registry: ChunkRegistryHandle,
    dirtyChunkKeys: readonly string[],
    updateOptions?: ChunkSceneUpdateOptions,
  ): readonly ChunkSceneEntry[] {
    assertAlive("remeshDirtyChunks");

    const updated: ChunkSceneEntry[] = [];

    for (const chunkKey of uniqueStrings(dirtyChunkKeys)) {
      try {
        const chunk = registry.getChunk(chunkKey);

        if (!chunk) {
          continue;
        }

        updated.push(setChunk(chunk, {
          ...updateOptions,
          forceWireframe: updateOptions?.forceWireframe,
          replaceExisting: true,
          reason: updateOptions?.reason ?? "remeshDirtyChunks",
        }));
      } catch (error) {
        logWarn(logger, "Dirty chunk remesh failed.", {
          chunkKey,
          error: normalizeUnknownError(error),
        });
      }
    }

    return updated;
  }

  function getStats(): ChunkSceneStats {
    return collectStats(entries.values(), updatedAt);
  }

  function getSnapshot(): ChunkSceneSnapshot {
    return {
      kind: CHUNK_SCENE_SNAPSHOT_KIND,
      status,
      createdAt,
      updatedAt,
      disposedAt,
      chunkKeys: sortKeys(entries.keys()),
      visibleChunkKeys: getVisibleChunkKeys(),
      stats: getStats(),
      mesher: mesher.getSnapshot(),
      lastError,
    };
  }

  function debugSummary(): Record<string, unknown> {
    try {
      return {
        kind: CHUNK_SCENE_KIND,
        snapshot: getSnapshot(),
        group: {
          name: group.name,
          objectCount: countObjects(group),
          parentName: group.parent?.name ?? null,
        },
        entries: [...entries.values()].map((entry) => ({
          chunkKey: entry.chunkKey,
          visible: entry.visible,
          revision: entry.revision,
          version: entry.version,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          mesh: chunkMeshResultToDebugSummary(entry.mesh),
        })),
      };
    } catch (error) {
      return {
        kind: CHUNK_SCENE_KIND,
        debugSummaryFailed: true,
        error: normalizeUnknownError(error),
      };
    }
  }

  function dispose(reason?: string): void {
    if (disposed) {
      return;
    }

    disposed = true;
    disposedAt = now();

    try {
      clear(reason ?? "chunk-scene-dispose");
    } catch {
      // Ignore.
    }

    try {
      removeObjectFromParent(group);
      group.clear();
    } catch {
      // Ignore.
    }

    try {
      mesher.dispose(reason ?? "chunk-scene-dispose");
    } catch {
      // Ignore.
    }

    setStatus("disposed");

    logInfo(logger, "Chunk scene disposed.", {
      reason: reason ?? null,
    });
  }

  const handle: ChunkSceneHandle = {
    kind: CHUNK_SCENE_KIND,

    setChunk,
    setChunks,

    removeChunk,
    clear,

    hasChunk(chunkKey: string): boolean {
      try {
        return entries.has(normalizeChunkKey(chunkKey));
      } catch {
        return false;
      }
    },

    getEntry(chunkKey: string): ChunkSceneEntry | null {
      try {
        return entries.get(normalizeChunkKey(chunkKey)) ?? null;
      } catch {
        return null;
      }
    },

    getChunkKeys(): readonly string[] {
      return sortKeys(entries.keys());
    },

    getVisibleChunkKeys,

    setChunkVisible,
    setVisibleChunkKeys,

    syncFromRegistry,
    remeshDirtyChunks,

    getGroup(): THREE.Group {
      return group;
    },

    getStats,
    getSnapshot,
    debugSummary,

    dispose,
  };

  try {
    attachRootGroup();
    setStatus("ready");
  } catch {
    setStatus("degraded");
  }

  logInfo(logger, "Chunk scene created.", {
    autoAttachToThreeChunkGroup: attachToThreeChunkGroup,
    visibleByDefault,
    includeDebugUserData,
  });

  return handle;
}