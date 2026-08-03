// services/vectoplan-editor/src/frontend/runtime/world/chunk_loader.ts
import {
  isChunkApiFailedResult,
  type ChunkApiBatchChunkRequest,
  type ChunkApiFailedResult,
} from "@api/chunk_api_models";
import type { EditorLogger } from "@utils/logger";
import { createEditorId, chunkKeyFromCoordinates } from "@utils/ids";
import { normalizeUnknownError, safeInteger, safeNumber, safeString, uniqueStrings } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import {
  chunkCoordinatesFromKey,
  chunkKeyDistanceSquared,
  createChunkCellAddress,
  sortChunkKeys,
  uniqueChunkKeys,
  visibleChunkCoordinatesAround,
  type ChunkCoordinates,
  type ChunkWorldPosition,
} from "./chunk_coordinates";
import type { RuntimeChunkContent } from "./chunk_content";
import {
  createChunkSourceFailedResult,
  type ChunkSource,
} from "./chunk_source";

export type ChunkLoaderStatus =
  | "created"
  | "idle"
  | "loading"
  | "ready"
  | "degraded"
  | "failed"
  | "destroyed";

export type ChunkLoaderLoadReason =
  | "initial"
  | "position-change"
  | "manual"
  | "dirty-reload"
  | "full-refresh"
  | "visibility-change"
  | "command-result"
  | (string & {});

export interface ChunkLoaderVisibleRange {
  readonly centerChunkKey: string;
  readonly center: ChunkCoordinates;
  readonly radius: number;
  readonly chunkKeys: readonly string[];
  readonly coordinates: readonly ChunkCoordinates[];
}

export interface ChunkLoaderOptions {
  readonly source: ChunkSource;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
  readonly initialCenter?: ChunkCoordinates;
  readonly initialRadius?: number;
  readonly maxRadius?: number;
  readonly verticalRadius?: number;
  readonly maxChunksPerLoad?: number;
  readonly preferBatch?: boolean;
  readonly markVisible?: boolean;
  readonly forceInitialLoad?: boolean;
}

export interface ChunkLoaderPriorityDirection {
  readonly chunkX: number;
  readonly chunkY?: number;
  readonly chunkZ: number;
}

export interface ChunkLoaderLoadOptions {
  readonly priorityDirection?: ChunkLoaderPriorityDirection;
  readonly reason?: ChunkLoaderLoadReason;
  readonly signal?: AbortSignal;
  readonly force?: boolean;
  readonly contentProfile?: "surface-shell.v1" | "full";
  readonly markVisible?: boolean;
  readonly preferBatch?: boolean;
  readonly maxChunks?: number;
  readonly batchSize?: number;
  readonly shouldContinue?: () => boolean;
  readonly onBatchLoaded?: (progress: ChunkLoaderBatchProgress) => void;
}

export interface ChunkLoaderBatchProgress {
  readonly batchIndex: number;
  readonly batchCount: number;
  readonly requestedChunkKeys: readonly string[];
  readonly loadedChunkKeys: readonly string[];
  readonly failedChunkKeys: readonly string[];
  readonly fromCache: boolean;
}

export interface ChunkLoaderPositionLoadOptions extends ChunkLoaderLoadOptions {
  readonly radius?: number;
}

export interface ChunkLoaderLoadResult {
  readonly ok: true;
  readonly reason: ChunkLoaderLoadReason;
  readonly requestedChunkKeys: readonly string[];
  readonly loadedChunkKeys: readonly string[];
  readonly failedChunkKeys: readonly string[];
  readonly chunks: readonly RuntimeChunkContent[];
  readonly fromCacheCount: number;
  readonly error: null;
  readonly elapsedMs: number;
  readonly completedAt: string;
}

export interface ChunkLoaderFailureResult {
  readonly ok: false;
  readonly reason: ChunkLoaderLoadReason;
  readonly requestedChunkKeys: readonly string[];
  readonly loadedChunkKeys: readonly string[];
  readonly failedChunkKeys: readonly string[];
  readonly chunks: readonly RuntimeChunkContent[];
  readonly fromCacheCount: number;
  readonly error: ChunkApiFailedResult;
  readonly elapsedMs: number;
  readonly completedAt: string;
}

export type ChunkLoaderResult =
  | ChunkLoaderLoadResult
  | ChunkLoaderFailureResult;

export interface ChunkLoaderSnapshot {
  readonly kind: "chunk-loader-snapshot.v1";
  readonly id: string;
  readonly status: ChunkLoaderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly centerChunkKey: string;
  readonly visibleRadius: number;
  readonly visibleChunkKeys: readonly string[];
  readonly loadedChunkKeys: readonly string[];
  readonly dirtyChunkKeys: readonly string[];
  readonly lastLoadedChunkKeys: readonly string[];
  readonly lastFailedChunkKeys: readonly string[];
  readonly lastError: ChunkApiFailedResult | null;
  readonly loadCount: number;
  readonly failureCount: number;
  readonly pendingLoadCount: number;
}

export interface ChunkLoaderHandle {
  readonly kind: "vectoplan-editor-chunk-loader.v1";

  initialize(options?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult>;

  loadInitialChunks(options?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult>;

  loadAroundPosition(
    position: ChunkWorldPosition,
    options?: ChunkLoaderPositionLoadOptions,
  ): Promise<ChunkLoaderResult>;

  loadAroundChunk(
    center: ChunkCoordinates,
    radius?: number,
    options?: ChunkLoaderLoadOptions,
  ): Promise<ChunkLoaderResult>;

  loadChunkKeys(
    chunkKeys: readonly string[],
    options?: ChunkLoaderLoadOptions,
  ): Promise<ChunkLoaderResult>;

  loadCoordinates(
    coordinates: readonly ChunkCoordinates[],
    options?: ChunkLoaderLoadOptions,
  ): Promise<ChunkLoaderResult>;

  reloadDirtyChunks(options?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult>;

  requestFullRefresh(options?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult>;

  setVisibleRadius(radius: number): void;
  getVisibleRadius(): number;

  setCenterChunk(center: ChunkCoordinates, reason?: string): ChunkLoaderVisibleRange;
  getCenterChunk(): ChunkCoordinates;
  getVisibleRange(): ChunkLoaderVisibleRange;

  getStatus(): ChunkLoaderStatus;
  getSnapshot(): ChunkLoaderSnapshot;

  destroy(reason?: string): void;
}

const CHUNK_LOADER_KIND = "vectoplan-editor-chunk-loader.v1" as const;
const CHUNK_LOADER_SNAPSHOT_KIND = "chunk-loader-snapshot.v1" as const;
const DEFAULT_VISIBLE_RADIUS = 7;
const DEFAULT_MAX_RADIUS = 8;
const DEFAULT_STREAMING_BATCH_SIZE = 24;
const DEFAULT_MAX_CHUNKS_PER_LOAD = 256;

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

function elapsedMsSince(startedAt: number): number {
  try {
    return Math.max(0, Math.round(nowMs() - startedAt));
  } catch {
    return 0;
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
    // Logging must never break loader runtime.
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
    // Logging must never break loader runtime.
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
    // Logging must never break loader runtime.
  }
}

function normalizeReason(value: unknown, fallback: ChunkLoaderLoadReason): ChunkLoaderLoadReason {
  return safeString(value, fallback) as ChunkLoaderLoadReason;
}

function normalizeRadius(value: unknown, fallback: number, maxRadius: number): number {
  try {
    return safeInteger(value, fallback, {
      min: 0,
      max: maxRadius,
    });
  } catch {
    return fallback;
  }
}

function normalizeMaxChunks(value: unknown): number {
  try {
    return safeInteger(value, DEFAULT_MAX_CHUNKS_PER_LOAD, {
      min: 1,
      max: 2048,
    });
  } catch {
    return DEFAULT_MAX_CHUNKS_PER_LOAD;
  }
}

function normalizeCoordinates(coordinates: ChunkCoordinates): ChunkCoordinates {
  return {
    chunkX: safeInteger(coordinates.chunkX, 0),
    chunkY: safeInteger(coordinates.chunkY, 0),
    chunkZ: safeInteger(coordinates.chunkZ, 0),
  };
}

function coordinatesToRequest(coordinates: ChunkCoordinates): ChunkApiBatchChunkRequest {
  const normalized = normalizeCoordinates(coordinates);

  return {
    chunkX: normalized.chunkX,
    chunkY: normalized.chunkY,
    chunkZ: normalized.chunkZ,
  };
}

function coordinatesToKey(coordinates: ChunkCoordinates): string {
  const normalized = normalizeCoordinates(coordinates);

  return chunkKeyFromCoordinates(
    normalized.chunkX,
    normalized.chunkY,
    normalized.chunkZ,
  );
}

function normalizeChunkKeys(chunkKeys: readonly unknown[]): readonly string[] {
  try {
    const strict = uniqueChunkKeys(chunkKeys);

    if (strict.length > 0) {
      return strict;
    }

    return sortChunkKeys(
      uniqueStrings(
        chunkKeys
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
  } catch {
    return [];
  }
}

function coordinatesFromKeys(chunkKeys: readonly string[]): readonly ChunkCoordinates[] {
  try {
    return normalizeChunkKeys(chunkKeys).map((key) => chunkCoordinatesFromKey(key));
  } catch {
    return [];
  }
}

function coordinatesUnique(coordinates: readonly ChunkCoordinates[]): readonly ChunkCoordinates[] {
  try {
    const byKey = new Map<string, ChunkCoordinates>();

    for (const coordinate of coordinates) {
      const normalized = normalizeCoordinates(coordinate);
      byKey.set(coordinatesToKey(normalized), normalized);
    }

    return sortChunkKeys([...byKey.keys()])
      .map((key) => byKey.get(key))
      .filter((value): value is ChunkCoordinates => Boolean(value));
  } catch {
    return [];
  }
}

function chunkPriorityScore(
  coordinate: ChunkCoordinates,
  center: ChunkCoordinates,
  direction?: ChunkLoaderPriorityDirection,
): number {
  const distanceSquared = chunkKeyDistanceSquared(
    coordinatesToKey(coordinate),
    coordinatesToKey(center),
  );
  if (!direction) {
    return distanceSquared * 100;
  }

  const directionLength = Math.hypot(direction.chunkX, direction.chunkZ);
  if (directionLength <= 0.001) {
    return distanceSquared * 100;
  }

  const offsetX = coordinate.chunkX - center.chunkX;
  const offsetZ = coordinate.chunkZ - center.chunkZ;
  const forwardDistance = (
    offsetX * direction.chunkX + offsetZ * direction.chunkZ
  ) / directionLength;

  return distanceSquared * 20 - forwardDistance * 120;
}

function limitCoordinatesAroundCenter(
  coordinates: readonly ChunkCoordinates[],
  center: ChunkCoordinates,
  maxChunks: number,
  priorityDirection?: ChunkLoaderPriorityDirection,
): readonly ChunkCoordinates[] {
  try {
    const limitedMax = normalizeMaxChunks(maxChunks);

    return [...coordinates]
      .sort(
        (left, right) =>
          chunkPriorityScore(left, center, priorityDirection)
          - chunkPriorityScore(right, center, priorityDirection),
      )
      .slice(0, limitedMax);
  } catch {
    return coordinates.slice(0, Math.max(1, maxChunks));
  }
}

function createVisibleRange(
  center: ChunkCoordinates,
  radius: number,
  verticalRadius: number = 1,
): ChunkLoaderVisibleRange {
  const normalizedCenter = normalizeCoordinates(center);
  const normalizedRadius = Math.max(0, Math.trunc(radius));
  const normalizedVerticalRadius = Math.max(0, Math.trunc(verticalRadius));
  const horizontalVisibilityOptions = {
    radial: true,
    verticalRadius: 0,
  } as const;
  const nearVerticalVisibilityOptions = {
    radial: true,
    verticalRadius: Math.min(normalizedVerticalRadius, normalizedRadius),
  } as const;
  const horizontalCoordinates = visibleChunkCoordinatesAround(
    normalizedCenter,
    normalizedRadius,
    horizontalVisibilityOptions,
  );
  const nearVerticalCoordinates = normalizedRadius > 0 && normalizedVerticalRadius > 0
    ? visibleChunkCoordinatesAround(
        normalizedCenter,
        Math.min(2, normalizedRadius),
        nearVerticalVisibilityOptions,
      )
    : [];
  const coordinates = coordinatesUnique([
    ...horizontalCoordinates,
    ...nearVerticalCoordinates,
  ]);
  const chunkKeys = coordinates.map((coordinate) => coordinatesToKey(coordinate));

  return {
    centerChunkKey: coordinatesToKey(normalizedCenter),
    center: normalizedCenter,
    radius: normalizedRadius,
    chunkKeys,
    coordinates,
  };
}

function createFailure(
  error: unknown,
  fallbackMessage: string,
): ChunkApiFailedResult {
  return createChunkSourceFailedResult({
    error,
    fallbackMessage,
    source: "unknown",
  });
}

function isAbortFailure(error: ChunkApiFailedResult | null): boolean {
  try {
    if (!error) {
      return false;
    }

    return error.error.code === "chunk_api_request_aborted";
  } catch {
    return false;
  }
}

export function isChunkLoaderSuccessResult(result: ChunkLoaderResult): result is ChunkLoaderLoadResult {
  return result.ok === true;
}

export function isChunkLoaderFailureResult(result: ChunkLoaderResult): result is ChunkLoaderFailureResult {
  return result.ok === false;
}

function makeFailedResult(input: {
  readonly reason: ChunkLoaderLoadReason;
  readonly requestedChunkKeys: readonly string[];
  readonly loadedChunkKeys?: readonly string[];
  readonly failedChunkKeys?: readonly string[];
  readonly chunks?: readonly RuntimeChunkContent[];
  readonly fromCacheCount?: number;
  readonly error: ChunkApiFailedResult;
  readonly startedAt: number;
}): ChunkLoaderFailureResult {
  return {
    ok: false,
    reason: input.reason,
    requestedChunkKeys: normalizeChunkKeys(input.requestedChunkKeys),
    loadedChunkKeys: normalizeChunkKeys(input.loadedChunkKeys ?? []),
    failedChunkKeys: normalizeChunkKeys(input.failedChunkKeys ?? input.requestedChunkKeys),
    chunks: input.chunks ?? [],
    fromCacheCount: input.fromCacheCount ?? 0,
    error: input.error,
    elapsedMs: elapsedMsSince(input.startedAt),
    completedAt: now(),
  };
}

function makeSuccessResult(input: {
  readonly reason: ChunkLoaderLoadReason;
  readonly requestedChunkKeys: readonly string[];
  readonly chunks: readonly RuntimeChunkContent[];
  readonly failedChunkKeys?: readonly string[];
  readonly fromCacheCount?: number;
  readonly startedAt: number;
}): ChunkLoaderLoadResult {
  return {
    ok: true,
    reason: input.reason,
    requestedChunkKeys: normalizeChunkKeys(input.requestedChunkKeys),
    loadedChunkKeys: normalizeChunkKeys(input.chunks.map((chunk) => chunk.chunkKey)),
    failedChunkKeys: normalizeChunkKeys(input.failedChunkKeys ?? []),
    chunks: input.chunks,
    fromCacheCount: input.fromCacheCount ?? 0,
    error: null,
    elapsedMs: elapsedMsSince(input.startedAt),
    completedAt: now(),
  };
}

function failedKeysFromLoaded(
  requestedChunkKeys: readonly string[],
  chunks: readonly RuntimeChunkContent[],
): readonly string[] {
  try {
    const loaded = new Set(chunks.map((chunk) => chunk.chunkKey));
    return requestedChunkKeys.filter((key) => !loaded.has(key));
  } catch {
    return [];
  }
}

function requestOptionsFromLoaderOptions(options?: ChunkLoaderLoadOptions): {
  readonly signal?: AbortSignal;
  readonly forceReload?: boolean;
  readonly contentProfile?: "surface-shell.v1" | "full";
  readonly markVisible?: boolean;
  readonly preferBatch?: boolean;
  readonly maxBatchChunks?: number;
  readonly reason?: string;
} {
  const output: {
    signal?: AbortSignal;
    forceReload?: boolean;
    contentProfile?: "surface-shell.v1" | "full";
    markVisible?: boolean;
    preferBatch?: boolean;
    maxBatchChunks?: number;
    reason?: string;
  } = {};

  if (options?.signal) {
    output.signal = options.signal;
  }

  if (options?.contentProfile) {
    output.contentProfile = options.contentProfile;
  }

  if (typeof options?.force === "boolean") {
    output.forceReload = options.force;
  }

  if (typeof options?.markVisible === "boolean") {
    output.markVisible = options.markVisible;
  }

  if (typeof options?.preferBatch === "boolean") {
    output.preferBatch = options.preferBatch;
  }

  if (typeof options?.maxChunks === "number") {
    output.maxBatchChunks = options.maxChunks;
  }

  if (options?.reason) {
    output.reason = String(options.reason);
  }

  return output;
}

function dirtyOptionsFromLoaderOptions(options?: ChunkLoaderLoadOptions): {
  readonly signal?: AbortSignal;
  readonly reason?: string;
  readonly force?: boolean;
} {
  const output: {
    signal?: AbortSignal;
    reason?: string;
    force?: boolean;
  } = {};

  if (options?.signal) {
    output.signal = options.signal;
  }

  if (options?.reason) {
    output.reason = String(options.reason);
  }

  if (typeof options?.force === "boolean") {
    output.force = options.force;
  }

  return output;
}

function readChunkSizeFromSource(source: ChunkSource): number {
  try {
    const firstKey = source.getLoadedChunkKeys()[0];

    if (!firstKey) {
      return 16;
    }

    const chunk = source.getChunk(firstKey);
    return safeInteger(chunk?.chunkSize, 16, {
      min: 1,
      max: 512,
    });
  } catch {
    return 16;
  }
}

function shouldInitializeSource(source: ChunkSource): boolean {
  try {
    const lifecycle = source.getLifecycleState();

    return (
      lifecycle.status === "created"
      || lifecycle.status === "failed"
    );
  } catch {
    return true;
  }
}

export function createChunkLoader(options: ChunkLoaderOptions): ChunkLoaderHandle {
  const source = options.source;
  const logger = options.logger;
  const id = createEditorId({
    prefix: "chunk_loader",
  });
  const createdAt = now();
  const maxRadius = normalizeRadius(options.maxRadius, DEFAULT_MAX_RADIUS, 16);
  const verticalRadius = safeInteger(options.verticalRadius, 1, {
    min: 0,
    max: 2,
  });
  const maxChunksPerLoad = normalizeMaxChunks(options.maxChunksPerLoad);
  const preferBatch = options.preferBatch ?? true;
  const defaultMarkVisible = options.markVisible ?? true;

  let status: ChunkLoaderStatus = "created";
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let visibleRadius = normalizeRadius(options.initialRadius, DEFAULT_VISIBLE_RADIUS, maxRadius);
  let centerChunk = normalizeCoordinates(options.initialCenter ?? { chunkX: 0, chunkY: 0, chunkZ: 0 });
  let visibleRange = createVisibleRange(centerChunk, visibleRadius, verticalRadius);
  let lastLoadedChunkKeys: readonly string[] = [];
  let lastFailedChunkKeys: readonly string[] = [];
  let lastError: ChunkApiFailedResult | null = null;
  let loadCount = 0;
  let failureCount = 0;
  let pendingLoadCount = 0;

  function assertAlive(action: string): ChunkApiFailedResult | null {
    if (destroyed || status === "destroyed") {
      return createFailure(
        new Error(`ChunkLoader is destroyed. Action '${action}' is not allowed.`),
        "ChunkLoader is destroyed.",
      );
    }

    return null;
  }

  function setStatus(nextStatus: ChunkLoaderStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function setError(error: ChunkApiFailedResult | null): void {
    lastError = error;

    if (error) {
      failureCount += 1;
      setStatus(isAbortFailure(error) ? "degraded" : "failed");
    }
  }

  function markLoadStart(reason: ChunkLoaderLoadReason): void {
    pendingLoadCount += 1;
    setStatus("loading");

    logDebug(logger, "Chunk loader load started.", {
      id,
      reason,
      pendingLoadCount,
      centerChunkKey: visibleRange.centerChunkKey,
      visibleRadius,
    });
  }

  function markLoadEnd(result: ChunkLoaderResult): ChunkLoaderResult {
    pendingLoadCount = Math.max(0, pendingLoadCount - 1);
    updatedAt = now();

    if (isChunkLoaderSuccessResult(result)) {
      loadCount += 1;
      lastLoadedChunkKeys = result.loadedChunkKeys;
      lastFailedChunkKeys = result.failedChunkKeys;
      lastError = null;
      setStatus(result.failedChunkKeys.length > 0 ? "degraded" : "ready");
    } else {
      lastLoadedChunkKeys = result.loadedChunkKeys;
      lastFailedChunkKeys = result.failedChunkKeys;
      setError(result.error);
    }

    logDebug(logger, "Chunk loader load completed.", {
      id,
      reason: result.reason,
      ok: result.ok,
      loadedChunkCount: result.loadedChunkKeys.length,
      failedChunkCount: result.failedChunkKeys.length,
      elapsedMs: result.elapsedMs,
      pendingLoadCount,
    });

    return result;
  }

  async function runCoordinateLoad(
    coordinates: readonly ChunkCoordinates[],
    reason: ChunkLoaderLoadReason,
    loadOptions?: ChunkLoaderLoadOptions,
  ): Promise<ChunkLoaderResult> {
    const normalizedReason = normalizeReason(reason, "manual");
    const failure = assertAlive("runCoordinateLoad");
    const startedAt = nowMs();

    if (failure) {
      return makeFailedResult({
        reason: normalizedReason,
        requestedChunkKeys: [],
        error: failure,
        startedAt,
      });
    }

    const uniqueCoordinates = coordinatesUnique(coordinates);
    const limitedCoordinates = limitCoordinatesAroundCenter(
      uniqueCoordinates,
      centerChunk,
      loadOptions?.maxChunks ?? maxChunksPerLoad,
      loadOptions?.priorityDirection,
    );
    const requestedChunkKeys = limitedCoordinates.map((coordinate) => coordinatesToKey(coordinate));

    if (limitedCoordinates.length === 0) {
      return makeSuccessResult({
        reason: normalizedReason,
        requestedChunkKeys: [],
        chunks: [],
        startedAt,
      });
    }

    try {
      const markVisible = loadOptions?.markVisible ?? defaultMarkVisible;
      const registry = source.getRegistry();
      const coordinatesToLoad = loadOptions?.force
        ? limitedCoordinates
        : limitedCoordinates.filter(
            (coordinate) => !registry.getChunk(coordinatesToKey(coordinate)),
          );
      const cachedChunkKeys = requestedChunkKeys.filter(
        (chunkKey) => Boolean(registry.getChunk(chunkKey)),
      );
      const cachedChunkCount = cachedChunkKeys.length;

      const previousVisibleChunkKeys = markVisible
        ? registry.getVisibleChunkKeys()
        : [];
      const batchSize = safeInteger(loadOptions?.batchSize, DEFAULT_STREAMING_BATCH_SIZE, {
        min: 1,
        max: Math.max(1, maxChunksPerLoad),
      });
      const visibilityBatchSize = Math.min(12, batchSize);
      const batches: ChunkCoordinates[][] = [];

      for (let offset = 0; offset < coordinatesToLoad.length; offset += batchSize) {
        batches.push(coordinatesToLoad.slice(offset, offset + batchSize));
      }

      const cachedProgressBatchCount = Math.ceil(
        cachedChunkKeys.length / visibilityBatchSize,
      );
      const progressBatchCount = cachedProgressBatchCount + batches.reduce(
        (count, batch) => count + Math.max(1, Math.ceil(batch.length / visibilityBatchSize)),
        0,
      );
      const explicitFailedKeys: string[] = [];
      let sourceFromCacheCount = 0;
      let interrupted = false;
      let progressBatchIndex = 0;

      const yieldForProgressiveRender = (): Promise<void> => new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => resolve());
          return;
        }

        setTimeout(resolve, 0);
      });

      const notifyBatchLoaded = (progress: ChunkLoaderBatchProgress): void => {
        loadOptions?.onBatchLoaded?.(progress);
      };

      if (markVisible && cachedChunkKeys.length > 0) {
        for (let offset = 0; offset < cachedChunkKeys.length; offset += visibilityBatchSize) {
          const visibleKeys = cachedChunkKeys.slice(offset, offset + visibilityBatchSize);
          registry.addVisibleChunkKeys(
            visibleKeys,
            `${String(normalizedReason)}:cached-${progressBatchIndex + 1}`,
          );
          notifyBatchLoaded({
            batchIndex: progressBatchIndex,
            batchCount: progressBatchCount,
            requestedChunkKeys: visibleKeys,
            loadedChunkKeys: visibleKeys,
            failedChunkKeys: [],
            fromCache: true,
          });
          progressBatchIndex += 1;
          if (offset + visibilityBatchSize < cachedChunkKeys.length && loadOptions?.onBatchLoaded) {
            await yieldForProgressiveRender();
          }
        }
      }

      if (coordinatesToLoad.length === 0) {
        if (markVisible && requestedChunkKeys.length > 0) {
          registry.setVisibleChunkKeys(requestedChunkKeys, String(normalizedReason));
        }

        return makeSuccessResult({
          reason: normalizedReason,
          requestedChunkKeys,
          chunks: requestedChunkKeys
            .map((chunkKey) => registry.getChunk(chunkKey))
            .filter((chunk): chunk is RuntimeChunkContent => Boolean(chunk)),
          fromCacheCount: cachedChunkCount,
          startedAt,
        });
      }

      markLoadStart(normalizedReason);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        if (loadOptions?.shouldContinue?.() === false) {
          interrupted = true;
          break;
        }

        const batch = batches[batchIndex] ?? [];
        const batchRequestedChunkKeys = batch.map((coordinate) => coordinatesToKey(coordinate));
        const result = await source.loadChunks(
          batch.map((coordinate) => coordinatesToRequest(coordinate)),
          {
            ...requestOptionsFromLoaderOptions({
              ...loadOptions,
              maxChunks: batch.length,
              preferBatch: loadOptions?.preferBatch ?? preferBatch,
              markVisible: false,
              reason: normalizedReason,
            }),
          },
        );

        if (isChunkApiFailedResult(result)) {
          return markLoadEnd(
            makeFailedResult({
              reason: normalizedReason,
              requestedChunkKeys,
              error: result,
              startedAt,
            }),
          );
        }

        sourceFromCacheCount += result.fromCacheCount;
        const batchFailedChunkKeys = result.result?.failedChunks
          ? result.result.failedChunks.map((coordinates) => coordinatesToKey(coordinates))
          : [];
        explicitFailedKeys.push(...batchFailedChunkKeys);

        const batchLoadedChunkKeys = batchRequestedChunkKeys.filter(
          (chunkKey) => Boolean(registry.getChunk(chunkKey)),
        );

        const visibilitySlices: string[][] = [];
        if (markVisible && batchLoadedChunkKeys.length > 0) {
          for (
            let offset = 0;
            offset < batchLoadedChunkKeys.length;
            offset += visibilityBatchSize
          ) {
            visibilitySlices.push(
              batchLoadedChunkKeys.slice(offset, offset + visibilityBatchSize),
            );
          }
        } else {
          visibilitySlices.push([...batchLoadedChunkKeys]);
        }

        for (let sliceIndex = 0; sliceIndex < visibilitySlices.length; sliceIndex += 1) {
          const visibleKeys = visibilitySlices[sliceIndex] ?? [];
          if (markVisible && visibleKeys.length > 0) {
            registry.addVisibleChunkKeys(
              visibleKeys,
              `${String(normalizedReason)}:batch-${progressBatchIndex + 1}`,
            );
          }
          notifyBatchLoaded({
            batchIndex: progressBatchIndex,
            batchCount: progressBatchCount,
            requestedChunkKeys: visibleKeys.length > 0 ? visibleKeys : batchRequestedChunkKeys,
            loadedChunkKeys: visibleKeys,
            failedChunkKeys: sliceIndex === visibilitySlices.length - 1
              ? batchFailedChunkKeys
              : [],
            fromCache: result.fromCacheCount >= batch.length,
          });
          progressBatchIndex += 1;
          if (sliceIndex + 1 < visibilitySlices.length && loadOptions?.onBatchLoaded) {
            await yieldForProgressiveRender();
          }
        }
      }

      const resolvedChunks = requestedChunkKeys
        .map((chunkKey) => registry.getChunk(chunkKey))
        .filter((chunk): chunk is RuntimeChunkContent => Boolean(chunk));

      if (markVisible) {
        const loadedRequestedChunkKeys = resolvedChunks.map((chunk) => chunk.chunkKey);
        const targetComplete =
          !interrupted && loadedRequestedChunkKeys.length === requestedChunkKeys.length;
        const nextVisibleChunkKeys = targetComplete
          ? loadedRequestedChunkKeys
          : uniqueStrings([...previousVisibleChunkKeys, ...loadedRequestedChunkKeys]);

        if (nextVisibleChunkKeys.length > 0) {
          registry.setVisibleChunkKeys(nextVisibleChunkKeys, String(normalizedReason));
        }
      }

      return markLoadEnd(
        makeSuccessResult({
          reason: normalizedReason,
          requestedChunkKeys,
          chunks: resolvedChunks,
          failedChunkKeys: explicitFailedKeys.length > 0
            ? explicitFailedKeys
            : interrupted
              ? []
              : failedKeysFromLoaded(requestedChunkKeys, resolvedChunks),
          fromCacheCount: sourceFromCacheCount + cachedChunkCount,
          startedAt,
        }),
      );
    } catch (error) {
      const failed = createFailure(error, "Chunk coordinate load failed.");

      return markLoadEnd(
        makeFailedResult({
          reason: normalizedReason,
          requestedChunkKeys,
          error: failed,
          startedAt,
        }),
      );
    }
  }

  const handle: ChunkLoaderHandle = {
    kind: CHUNK_LOADER_KIND,

    async initialize(loadOptions?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult> {
      const failure = assertAlive("initialize");
      const startedAt = nowMs();

      if (failure) {
        return makeFailedResult({
          reason: "initial",
          requestedChunkKeys: [],
          error: failure,
          startedAt,
        });
      }

      try {
        setStatus("loading");

        if (shouldInitializeSource(source)) {
          await source.initialize({
            signal: loadOptions?.signal ?? options.signal,
          });
        }

        setStatus("idle");

        return handle.loadInitialChunks({
          ...loadOptions,
          reason: "initial",
          force: loadOptions?.force ?? options.forceInitialLoad ?? false,
        });
      } catch (error) {
        const failed = createFailure(error, "Chunk loader initialization failed.");

        return markLoadEnd(
          makeFailedResult({
            reason: "initial",
            requestedChunkKeys: visibleRange.chunkKeys,
            error: failed,
            startedAt,
          }),
        );
      }
    },

    async loadInitialChunks(loadOptions?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult> {
      return runCoordinateLoad(
        visibleRange.coordinates,
        loadOptions?.reason ?? "initial",
        loadOptions,
      );
    },

    async loadAroundPosition(
      position: ChunkWorldPosition,
      loadOptions?: ChunkLoaderPositionLoadOptions,
    ): Promise<ChunkLoaderResult> {
      const chunkSize = readChunkSizeFromSource(source);
      const address = createChunkCellAddress({
        worldX: safeNumber(position.x, 0),
        worldY: safeNumber(position.y, 0),
        worldZ: safeNumber(position.z, 0),
        chunkSize,
      });

      return handle.loadAroundChunk(
        {
          chunkX: address.chunkX,
          chunkY: address.chunkY,
          chunkZ: address.chunkZ,
        },
        loadOptions?.radius ?? visibleRadius,
        {
          ...loadOptions,
          reason: loadOptions?.reason ?? "position-change",
        },
      );
    },

    async loadAroundChunk(
      center: ChunkCoordinates,
      radius?: number,
      loadOptions?: ChunkLoaderLoadOptions,
    ): Promise<ChunkLoaderResult> {
      const previousCenter = centerChunk;
      handle.setCenterChunk(center, String(loadOptions?.reason ?? "load-around-chunk"));

      const nextRadius = normalizeRadius(radius, visibleRadius, maxRadius);
      visibleRadius = nextRadius;
      visibleRange = createVisibleRange(centerChunk, visibleRadius, verticalRadius);
      const priorityDirection = loadOptions?.priorityDirection ?? {
        chunkX: centerChunk.chunkX - previousCenter.chunkX,
        chunkY: centerChunk.chunkY - previousCenter.chunkY,
        chunkZ: centerChunk.chunkZ - previousCenter.chunkZ,
      };

      return runCoordinateLoad(
        visibleRange.coordinates,
        loadOptions?.reason ?? "visibility-change",
        {
          ...loadOptions,
          priorityDirection,
        },
      );
    },

    async loadChunkKeys(
      chunkKeys: readonly string[],
      loadOptions?: ChunkLoaderLoadOptions,
    ): Promise<ChunkLoaderResult> {
      return runCoordinateLoad(
        coordinatesFromKeys(chunkKeys),
        loadOptions?.reason ?? "manual",
        loadOptions,
      );
    },

    async loadCoordinates(
      coordinates: readonly ChunkCoordinates[],
      loadOptions?: ChunkLoaderLoadOptions,
    ): Promise<ChunkLoaderResult> {
      return runCoordinateLoad(
        coordinates,
        loadOptions?.reason ?? "manual",
        loadOptions,
      );
    },

    async reloadDirtyChunks(loadOptions?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult> {
      const failure = assertAlive("reloadDirtyChunks");
      const startedAt = nowMs();
      const dirtyChunkKeys = source.getDirtyChunkKeys();

      if (failure) {
        return makeFailedResult({
          reason: "dirty-reload",
          requestedChunkKeys: dirtyChunkKeys,
          error: failure,
          startedAt,
        });
      }

      if (dirtyChunkKeys.length === 0) {
        return makeSuccessResult({
          reason: "dirty-reload",
          requestedChunkKeys: [],
          chunks: [],
          startedAt,
        });
      }

      markLoadStart("dirty-reload");

      try {
        const result = await source.reloadDirtyChunks({
          ...dirtyOptionsFromLoaderOptions({
            ...loadOptions,
            reason: loadOptions?.reason ?? "dirty-reload",
            force: loadOptions?.force ?? true,
          }),
        });

        if (isChunkApiFailedResult(result)) {
          return markLoadEnd(
            makeFailedResult({
              reason: "dirty-reload",
              requestedChunkKeys: dirtyChunkKeys,
              error: result,
              startedAt,
            }),
          );
        }

        return markLoadEnd(
          makeSuccessResult({
            reason: "dirty-reload",
            requestedChunkKeys: dirtyChunkKeys,
            chunks: result,
            failedChunkKeys: failedKeysFromLoaded(dirtyChunkKeys, result),
            startedAt,
          }),
        );
      } catch (error) {
        const failed = createFailure(error, "Dirty chunks could not be reloaded.");

        return markLoadEnd(
          makeFailedResult({
            reason: "dirty-reload",
            requestedChunkKeys: dirtyChunkKeys,
            error: failed,
            startedAt,
          }),
        );
      }
    },

    async requestFullRefresh(loadOptions?: ChunkLoaderLoadOptions): Promise<ChunkLoaderResult> {
      const failure = assertAlive("requestFullRefresh");
      const startedAt = nowMs();
      const requestedChunkKeys = source.getVisibleChunkKeys().length > 0
        ? source.getVisibleChunkKeys()
        : visibleRange.chunkKeys;

      if (failure) {
        return makeFailedResult({
          reason: "full-refresh",
          requestedChunkKeys,
          error: failure,
          startedAt,
        });
      }

      markLoadStart("full-refresh");

      try {
        const result = await source.requestFullRefresh({
          ...dirtyOptionsFromLoaderOptions({
            ...loadOptions,
            reason: loadOptions?.reason ?? "full-refresh",
            force: loadOptions?.force ?? true,
          }),
        });

        if (isChunkApiFailedResult(result)) {
          return markLoadEnd(
            makeFailedResult({
              reason: "full-refresh",
              requestedChunkKeys,
              error: result,
              startedAt,
            }),
          );
        }

        return markLoadEnd(
          makeSuccessResult({
            reason: "full-refresh",
            requestedChunkKeys,
            chunks: result,
            failedChunkKeys: failedKeysFromLoaded(requestedChunkKeys, result),
            startedAt,
          }),
        );
      } catch (error) {
        const failed = createFailure(error, "Full chunk refresh failed.");

        return markLoadEnd(
          makeFailedResult({
            reason: "full-refresh",
            requestedChunkKeys,
            error: failed,
            startedAt,
          }),
        );
      }
    },

    setVisibleRadius(radius: number): void {
      if (destroyed) {
        return;
      }

      visibleRadius = normalizeRadius(radius, visibleRadius, maxRadius);
      visibleRange = createVisibleRange(centerChunk, visibleRadius, verticalRadius);
      updatedAt = now();

      logDebug(logger, "Chunk loader visible radius changed.", {
        visibleRadius,
        visibleChunkCount: visibleRange.chunkKeys.length,
      });
    },

    getVisibleRadius(): number {
      return visibleRadius;
    },

    setCenterChunk(center: ChunkCoordinates, reason?: string): ChunkLoaderVisibleRange {
      if (destroyed) {
        return visibleRange;
      }

      centerChunk = normalizeCoordinates(center);
      visibleRange = createVisibleRange(centerChunk, visibleRadius, verticalRadius);
      updatedAt = now();

      logDebug(logger, "Chunk loader center changed.", {
        centerChunkKey: visibleRange.centerChunkKey,
        reason: reason ?? null,
      });

      return visibleRange;
    },

    getCenterChunk(): ChunkCoordinates {
      return centerChunk;
    },

    getVisibleRange(): ChunkLoaderVisibleRange {
      return visibleRange;
    },

    getStatus(): ChunkLoaderStatus {
      return status;
    },

    getSnapshot(): ChunkLoaderSnapshot {
      return {
        kind: CHUNK_LOADER_SNAPSHOT_KIND,
        id,
        status,
        createdAt,
        updatedAt,
        destroyedAt,
        centerChunkKey: visibleRange.centerChunkKey,
        visibleRadius,
        visibleChunkKeys: visibleRange.chunkKeys,
        loadedChunkKeys: source.getLoadedChunkKeys(),
        dirtyChunkKeys: source.getDirtyChunkKeys(),
        lastLoadedChunkKeys,
        lastFailedChunkKeys,
        lastError,
        loadCount,
        failureCount,
        pendingLoadCount,
      };
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      destroyedAt = now();
      setStatus("destroyed");

      logInfo(logger, "Chunk loader destroyed.", {
        id,
        reason: reason ?? null,
        loadCount,
        failureCount,
      });
    },
  };

  logInfo(logger, "Chunk loader created.", {
    id,
    visibleRadius,
    maxRadius,
    maxChunksPerLoad,
    preferBatch,
  });

  return handle;
}

export function isChunkLoaderHandle(value: unknown): value is ChunkLoaderHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<ChunkLoaderHandle>;

    return (
      record.kind === CHUNK_LOADER_KIND
      && typeof record.initialize === "function"
      && typeof record.loadAroundPosition === "function"
      && typeof record.requestFullRefresh === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}