// services/vectoplan-editor/src/frontend/runtime/world/chunk_service_source.ts
import { chunkKeyFromCoordinates } from '@utils/ids';
import type {
  ChunkApiBatchChunkRequest,
  ChunkApiBatchResult,
  ChunkApiBlocksResult,
  ChunkApiChunkCoordinates,
  ChunkApiChunkResult,
  ChunkApiClient,
  ChunkApiCommandPayload,
  ChunkApiCommandResult,
  ChunkApiFailedResult,
  ChunkApiWorldPosition,
} from "@api/chunk_api_models";
import {
  isChunkApiFailedResult,
  normalizeChunkApiCoordinates,
  normalizeChunkApiWorldPosition,
} from "@api/chunk_api_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";
import type { EditorLogger } from "@utils/logger";
import {
  BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  DEBUG_GRASS_DIRT_ALLOWED,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  createEditorLibraryPlacementContext,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  hasLibraryIdentity as contractHasLibraryIdentity,
  isForbiddenDebugBlockTypeId as isForbiddenDebugBlockTypeIdContract,
  isValidEditorLibraryPlacementContext,
  libraryRefFromPlacementCommand as contractLibraryRefFromPlacementCommand,
  mergeContractMetadata,
  normalizeContractBoolean,
  normalizeContractInteger,
  normalizeContractText,
  normalizeEditorInventoryLibraryRef,
  normalizeEditorInventoryPlacementCommand,
  normalizeOptionalContractInteger,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId as normalizeContractRuntimeBlockTypeId,
  runtimeBlockTypeIdFromPlacementCommand as contractRuntimeBlockTypeIdFromPlacementCommand,
} from "../../contracts/editor_inventory_contract";
import type {
  ChunkSource,
  ChunkSourceCommandOptions,
  ChunkSourceCommandResult,
  ChunkSourceDirtyOptions,
  ChunkSourceEvent,
  ChunkSourceEventListener,
  ChunkSourceInventoryResult,
  ChunkSourceLifecycleState,
  ChunkSourceLibraryPlacementInput,
  ChunkSourceLoadChunkOptions,
  ChunkSourceLoadChunkResult,
  ChunkSourceLoadChunksOptions,
  ChunkSourceLoadChunksResult,
  ChunkSourceMetadata,
  ChunkSourceSummary,
  ChunkSourceUnsubscribe,
} from "./chunk_source";
import {
  chunkCoordinatesFromKey,
  sortChunkKeys,
  type ChunkCoordinates,
} from "./chunk_coordinates";
import {
  createChunkRegistry,
  type ChunkRegistryHandle,
} from "./chunk_registry";
import type { RuntimeChunkContent } from "./chunk_content";
import {
  createChunkEditSession,
  type ChunkEditLibraryPlacementInput,
  type ChunkEditSessionHandle,
} from "./chunk_edit_session";

export interface CreateChunkServiceSourceOptions {
  readonly client: ChunkApiClient;
  readonly bootstrap?: EditorBootstrap;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
  readonly registry?: ChunkRegistryHandle;
  readonly editSession?: ChunkEditSessionHandle;
  readonly id?: string;
  readonly label?: string;
  readonly projectId?: string;
  readonly universeId?: string;
  readonly worldId?: string;
  readonly apiBaseUrl?: string;
  readonly sourceKind?: string;
  readonly mode?: string;
  readonly maxChunks?: number;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly autoInitialize?: boolean;
}

export interface CreateChunkServiceSourceFromBootstrapOptions {
  readonly bootstrap: EditorBootstrap;
  readonly client: ChunkApiClient;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
  readonly registry?: ChunkRegistryHandle;
  readonly editSession?: ChunkEditSessionHandle;
  readonly maxChunks?: number;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly autoInitialize?: boolean;
}

export interface ChunkServiceSourceLibraryPlacementInput
  extends ChunkEditLibraryPlacementInput,
    ChunkSourceLibraryPlacementInput {
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly label?: string | null;
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
}

export interface ChunkServiceSource extends ChunkSource {
  readonly kind: "chunk-service";
  readonly serviceKind: "vectoplan-editor-chunk-service-source.v1";

  /**
   * Semantischer Library-/VPLIB-Placement-Pfad.
   *
   * Der Chunk-Service erhält weiterhin einen kompatiblen SetBlock-Command mit
   * `blockTypeId = runtimeBlockTypeId`. Die Library-Identität bleibt in
   * EditSession/Metadata/Events erhalten.
   */
  placeLibraryItem(
    position: ChunkApiWorldPosition,
    placement: ChunkServiceSourceLibraryPlacementInput,
    commandOptions?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult>;
}

type AnyRecord = Record<string, unknown>;

type SourceRequestOverrides = {
  readonly signal?: AbortSignal;
  readonly headers?: Record<string, string>;
};

type LibraryAwareCommandOptions = ChunkSourceCommandOptions & {
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly label?: string | null;
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
  readonly includeLibraryMetadataInCommand?: boolean;
  readonly requireLibraryIdentity?: boolean;
  readonly validateAgainstLegacyBlockCatalog?: boolean;
  readonly reloadDirtyChunks?: boolean;
};

type PreparedLibraryPlacementSuccess = {
  readonly ok: true;
  readonly runtimeBlockTypeId: string;
  readonly context: ReturnType<typeof createEditorLibraryPlacementContext>;
  readonly options: LibraryAwareCommandOptions;
};

type PreparedLibraryPlacementFailure = {
  readonly ok: false;
  readonly failed: ChunkApiFailedResult;
};

type PreparedLibraryPlacementResult =
  | PreparedLibraryPlacementSuccess
  | PreparedLibraryPlacementFailure;

const CHUNK_SERVICE_SOURCE_KIND = "vectoplan-editor-chunk-service-source.v1" as const;
const CHUNK_SERVICE_SOURCE_LABEL = "VECTOPLAN Chunk Service Source" as const;
const HARD_MAX_SOURCE_BATCH_SIZE = 12;
const DEFAULT_PROJECT_ID = "dev-project" as const;
const DEFAULT_UNIVERSE_ID = "default-universe" as const;
const DEFAULT_WORLD_ID = "world_spawn" as const;
const DEFAULT_API_BASE_URL = "/editor/api/chunk" as const;
const DEFAULT_MAX_CHUNKS = 1024;
const DEFAULT_SOURCE_MODE = "remote-chunk-service" as const;

const MAX_CHUNK_SERVICE_SOURCE_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string>();
const OPTIONAL_TEXT_CACHE = new Map<string, string | null>();
const RUNTIME_BLOCK_TYPE_ID_CACHE = new Map<string, string | null>();
const ERROR_MESSAGE_CACHE = new Map<string, ChunkApiFailedResult>();

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_CHUNK_SERVICE_SOURCE_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearChunkServiceSourceCaches(): void {
  try {
    TEXT_CACHE.clear();
    OPTIONAL_TEXT_CACHE.clear();
    RUNTIME_BLOCK_TYPE_ID_CACHE.clear();
    ERROR_MESSAGE_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

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

function readField(value: unknown, key: string): unknown {
  try {
    const record = asRecord(value);
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
  } catch {
    return undefined;
  }
}

function readFirstField(value: unknown, keys: readonly string[]): unknown {
  try {
    const record = asRecord(value);

    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        continue;
      }

      const candidate = record[key];

      if (candidate !== undefined && candidate !== null && candidate !== "") {
        return candidate;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function readFirstText(value: unknown, keys: readonly string[]): string | null {
  try {
    return normalizeOptionalText(readFirstField(value, keys));
  } catch {
    return null;
  }
}

function normalizeText(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "string") {
      const cached = TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached || fallback;
      }

      return setCachedValue(TEXT_CACHE, value, normalizeContractText(value, fallback));
    }

    return normalizeContractText(value, fallback);
  } catch {
    return fallback;
  }
}

function normalizeOptionalText(value: unknown): string | null {
  try {
    if (typeof value === "string") {
      const cached = OPTIONAL_TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached;
      }

      return setCachedValue(
        OPTIONAL_TEXT_CACHE,
        value,
        normalizeOptionalContractText(value),
      );
    }

    return normalizeOptionalContractText(value);
  } catch {
    return null;
  }
}

function normalizeRuntimeBlockTypeId(value: unknown): string | null {
  try {
    const raw =
      typeof value === "string"
        ? value
        : value === null || value === undefined
          ? ""
          : String(value);

    const cached = RUNTIME_BLOCK_TYPE_ID_CACHE.get(raw);

    if (cached !== undefined) {
      return cached;
    }

    return setCachedValue(
      RUNTIME_BLOCK_TYPE_ID_CACHE,
      raw,
      normalizeContractRuntimeBlockTypeId(value),
    );
  } catch {
    return null;
  }
}

function safeNowIsoString(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function createSourceId(projectId: string, worldId: string): string {
  try {
    const base = `${projectId}:${worldId}:${Date.now()}:${Math.random()}`;
    const encoded =
      typeof btoa === "function"
        ? btoa(base).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)
        : base.replace(/[^a-zA-Z0-9]/g, "").slice(-16);

    return `chunk-service-${encoded || "source"}`;
  } catch {
    return `chunk-service-${Date.now()}`;
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
    // Logging must never break source runtime.
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
    // Logging must never break source runtime.
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
    // Logging must never break source runtime.
  }
}

function logError(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.error?.(message, details);
  } catch {
    // Logging must never break source runtime.
  }
}

function requestOverridesFromSignal(
  signal?: AbortSignal,
  contentProfile?: unknown,
): SourceRequestOverrides | undefined {
  const profile = contentProfile === "full"
    ? "full"
    : contentProfile === "surface-shell.v1"
      ? "surface-shell.v1"
      : null;
  if (!signal && !profile) {
    return undefined;
  }

  return {
    signal,
    headers: profile
      ? { "X-Vectoplan-Chunk-Content-Profile": profile }
      : undefined,
  };
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as { aborted?: unknown }).aborted === "boolean"
    );
  } catch {
    return false;
  }
}

function mergeAbortSignal(
  sourceSignal?: AbortSignal,
  overrideSignal?: AbortSignal,
): AbortSignal | undefined {
  try {
    return overrideSignal ?? sourceSignal;
  } catch {
    return sourceSignal;
  }
}

function isDestroyedLifecycle(lifecycle: ChunkSourceLifecycleState): boolean {
  try {
    const record = asRecord(lifecycle);
    return record.status === "destroyed" || record.status === "destroying";
  } catch {
    return false;
  }
}

function createLifecycleState(
  status: string,
  patch?: Record<string, unknown>,
): ChunkSourceLifecycleState {
  return {
    status,
    createdAt: safeNowIsoString(),
    updatedAt: safeNowIsoString(),
    error: null,
    lastError: null,
    connectionOk: status === "ready",
    initialized: status === "ready",
    destroyed: status === "destroyed",
    ...patch,
  } as unknown as ChunkSourceLifecycleState;
}

function createFailedResult(
  message: string,
  source: string = "client-fallback",
  details?: Record<string, unknown>,
): ChunkApiFailedResult {
  const cacheKey = `${source}:${message}:${JSON.stringify(details ?? {})}`;

  try {
    const cached = ERROR_MESSAGE_CACHE.get(cacheKey);
    if (cached) {
      return cached;
    }
  } catch {
    // Continue without cache.
  }

  const failed = {
    ok: false,
    request: null,
    source,
    raw: null,
    error: {
      message,
      details: details ?? {},
    },
    message,
    details: {
      ...(details ?? {}),
      productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
      browserUsesEditorInventoryApi: true,
      browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
      legacyChunkBlocksAreDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    },
  } as unknown as ChunkApiFailedResult;

  return setCachedValue(ERROR_MESSAGE_CACHE, cacheKey, failed);
}

function createFailedFromUnknown(
  error: unknown,
  fallbackMessage: string,
  details?: Record<string, unknown>,
): ChunkApiFailedResult {
  try {
    const message =
      error instanceof Error
        ? error.message
        : normalizeOptionalText(error) ?? fallbackMessage;

    return createFailedResult(message, "unknown", {
      ...(details ?? {}),
      errorName: error instanceof Error ? error.name : null,
      fallbackMessage,
    });
  } catch {
    return createFailedResult(fallbackMessage, "unknown", details);
  }
}

function createFailedFromDestroyed(): ChunkApiFailedResult {
  return createFailedResult("ChunkServiceSource is destroyed.", "client-fallback", {
    lifecycle: "destroyed",
  });
}

function createFailedFromMissingClientMethod(methodName: string): ChunkApiFailedResult {
  return createFailedResult(`Chunk API client method is missing: ${methodName}.`, "client-fallback", {
    methodName,
  });
}

function isFailedResult(value: unknown): value is ChunkApiFailedResult {
  try {
    if (isChunkApiFailedResult(value)) {
      return true;
    }

    const record = asRecord(value);
    return record.ok === false || Boolean(record.error);
  } catch {
    return false;
  }
}

function normalizeChunkKey(value: unknown): string {
  try {
    const normalized = normalizeText(value, "");

    if (normalized.length > 0) {
      return normalized;
    }

    return "0:0:0";
  } catch {
    return "0:0:0";
  }
}

function chunkCoordinatesFromDirtyKey(chunkKey: string): ChunkCoordinates {
  try {
    return chunkCoordinatesFromKey(chunkKey);
  } catch {
    return {
      chunkX: 0,
      chunkY: 0,
      chunkZ: 0,
    };
  }
}

function uniqueDirtyKeys(values: readonly unknown[]): readonly string[] {
  try {
    const keys = values
      .map((value) => {
        if (typeof value === "string") {
          return normalizeChunkKey(value);
        }

        const record = asRecord(value);
        return normalizeChunkKey(
          record.chunkKey ??
            record.key ??
            record.id ??
            `${record.chunkX ?? 0}:${record.chunkY ?? 0}:${record.chunkZ ?? 0}`,
        );
      })
      .filter((value) => value.length > 0);

    return sortChunkKeys([...new Set(keys)]);
  } catch {
    return [];
  }
}

function extractDirtyChunkKeys(value: unknown): readonly string[] {
  try {
    const record = asRecord(value);
    const rawDirty =
      record.dirtyChunks ??
      record.dirtyChunkKeys ??
      record.affectedChunks ??
      record.affectedChunkKeys ??
      asRecord(record.result).dirtyChunks ??
      asRecord(record.result).dirtyChunkKeys ??
      asRecord(record.raw).dirtyChunks ??
      asRecord(record.raw).dirtyChunkKeys ??
      [];

    return uniqueDirtyKeys(asArray(rawDirty));
  } catch {
    return [];
  }
}

function normalizeCoordinates(value: unknown): ChunkApiChunkCoordinates {
  try {
    return normalizeChunkApiCoordinates(value) as ChunkApiChunkCoordinates;
  } catch {
    const record = asRecord(value);

    return {
      chunkX: normalizeContractInteger(record.chunkX ?? record.x, 0),
      chunkY: normalizeContractInteger(record.chunkY ?? record.y, 0),
      chunkZ: normalizeContractInteger(record.chunkZ ?? record.z, 0),
    } as ChunkApiChunkCoordinates;
  }
}

function normalizeWorldPosition(value: unknown): ChunkApiWorldPosition {
  try {
    return normalizeChunkApiWorldPosition(value) as ChunkApiWorldPosition;
  } catch {
    const record = asRecord(value);

    return {
      x: normalizeContractInteger(record.x, 0),
      y: normalizeContractInteger(record.y, 0),
      z: normalizeContractInteger(record.z, 0),
    } as ChunkApiWorldPosition;
  }
}

function bootstrapRecord(bootstrap?: EditorBootstrap): AnyRecord {
  try {
    return asRecord(bootstrap);
  } catch {
    return {};
  }
}

function bootstrapProjectRecord(bootstrap?: EditorBootstrap): AnyRecord {
  try {
    const root = bootstrapRecord(bootstrap);
    return asRecord(root.project ?? root.projectContext ?? root.context);
  } catch {
    return {};
  }
}

function bootstrapRuntimeRecord(bootstrap?: EditorBootstrap): AnyRecord {
  try {
    const root = bootstrapRecord(bootstrap);
    return asRecord(root.runtime);
  } catch {
    return {};
  }
}

function bootstrapChunkRecord(bootstrap?: EditorBootstrap): AnyRecord {
  try {
    const runtime = bootstrapRuntimeRecord(bootstrap);
    const root = bootstrapRecord(bootstrap);
    return asRecord(runtime.chunk ?? root.chunk);
  } catch {
    return {};
  }
}

function deriveProjectId(options: CreateChunkServiceSourceOptions): string {
  try {
    const project = bootstrapProjectRecord(options.bootstrap);
    const chunk = bootstrapChunkRecord(options.bootstrap);

    return (
      normalizeOptionalText(options.projectId) ??
      readFirstText(project, ["projectId", "id", "project_id"]) ??
      readFirstText(chunk, ["projectId", "project_id"]) ??
      DEFAULT_PROJECT_ID
    );
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}

function deriveUniverseId(options: CreateChunkServiceSourceOptions): string {
  try {
    const project = bootstrapProjectRecord(options.bootstrap);
    const chunk = bootstrapChunkRecord(options.bootstrap);

    return (
      readFirstText(project, ["universeId", "universe_id"]) ??
      readFirstText(chunk, ["universeId", "universe_id"]) ??
      DEFAULT_UNIVERSE_ID
    );
  } catch {
    return DEFAULT_UNIVERSE_ID;
  }
}

function deriveWorldId(options: CreateChunkServiceSourceOptions): string {
  try {
    const project = bootstrapProjectRecord(options.bootstrap);
    const chunk = bootstrapChunkRecord(options.bootstrap);

    return (
      normalizeOptionalText(options.worldId) ??
      readFirstText(project, ["worldId", "world_id"]) ??
      readFirstText(chunk, ["worldId", "world_id"]) ??
      DEFAULT_WORLD_ID
    );
  } catch {
    return DEFAULT_WORLD_ID;
  }
}

function deriveApiBaseUrl(options: CreateChunkServiceSourceOptions): string {
  try {
    const chunk = bootstrapChunkRecord(options.bootstrap);

    return (
      normalizeOptionalText(options.apiBaseUrl) ??
      readFirstText(chunk, ["apiBaseUrl", "apiUrl", "baseUrl", "browserBaseUrl"]) ??
      DEFAULT_API_BASE_URL
    );
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

function deriveSourceMode(options: CreateChunkServiceSourceOptions): string {
  try {
    const runtime = bootstrapRuntimeRecord(options.bootstrap);
    const chunk = bootstrapChunkRecord(options.bootstrap);

    return (
      normalizeOptionalText(options.mode) ??
      readFirstText(chunk, ["mode", "sourceMode"]) ??
      readFirstText(runtime, ["mode"]) ??
      DEFAULT_SOURCE_MODE
    );
  } catch {
    return DEFAULT_SOURCE_MODE;
  }
}

function deriveMaxChunks(options: CreateChunkServiceSourceOptions): number {
  try {
    const chunk = bootstrapChunkRecord(options.bootstrap);

    return Math.max(
      DEFAULT_MAX_CHUNKS,
      normalizeContractInteger(
        options.maxChunks ?? chunk.maxChunks ?? chunk.maxLoadedChunks,
        DEFAULT_MAX_CHUNKS,
        1,
        100_000,
      ),
    );
  } catch {
    return DEFAULT_MAX_CHUNKS;
  }
}

function createDefaultRegistry(maxChunks: number): ChunkRegistryHandle {
  try {
    return createChunkRegistry({
      maxChunks,
    });
  } catch {
    return {} as ChunkRegistryHandle;
  }
}

function createDefaultEditSession(
  projectId: string,
  worldId: string,
  options: CreateChunkServiceSourceOptions,
): ChunkEditSessionHandle {
  try {
    return (createChunkEditSession as unknown as (input?: unknown) => ChunkEditSessionHandle)({
      projectId,
      worldId,
      userId: options.userId,
      sessionId: options.sessionId,
      source: "chunk-service-source",
    });
  } catch {
    return {} as ChunkEditSessionHandle;
  }
}

function getClientMethod(client: ChunkApiClient, methodName: string): Function | null {
  try {
    const method = (client as unknown as AnyRecord)[methodName];

    if (typeof method !== "function") {
      return null;
    }

    return method as Function;
  } catch {
    return null;
  }
}

async function invokeClientMethod(
  client: ChunkApiClient,
  methodName: string,
  candidates: readonly (readonly unknown[])[],
): Promise<unknown> {
  const method = getClientMethod(client, methodName);

  if (!method) {
    return createFailedFromMissingClientMethod(methodName);
  }

  let lastError: unknown = null;

  for (const args of candidates) {
    try {
      return await method.apply(client, [...args]);
    } catch (error) {
      lastError = error;
    }
  }

  return createFailedFromUnknown(lastError, `Chunk API client method failed: ${methodName}.`, {
    methodName,
  });
}

function callOptionalMethod<T = unknown>(
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

      return (method as Function).apply(target, [...args]) as T;
    }

    return null;
  } catch {
    return null;
  }
}

function extractRuntimeChunkCandidate(value: unknown): unknown {
  try {
    if (!value) {
      return null;
    }

    const record = asRecord(value);
    const rawRecord = asRecord(record.raw);
    const resultRecord = asRecord(record.result);

    return (
      record.chunk ??
      record.runtimeChunk ??
      record.runtimeContent ??
      record.content ??
      record.snapshot ??
      rawRecord.chunk ??
      rawRecord.runtimeChunk ??
      rawRecord.runtimeContent ??
      rawRecord.content ??
      rawRecord.snapshot ??
      resultRecord.chunk ??
      resultRecord.runtimeChunk ??
      resultRecord.runtimeContent ??
      resultRecord.content ??
      resultRecord.snapshot ??
      value
    );
  } catch {
    return value;
  }
}

function getChunkCandidateKey(value: unknown): string {
  try {
    const chunk = extractRuntimeChunkCandidate(value);
    const record = asRecord(chunk);
    const wrapper = asRecord(value);

    return normalizeChunkKey(
      record.chunkKey ??
        record.key ??
        record.id ??
        wrapper.chunkKey ??
        wrapper.key ??
        wrapper.id ??
        `${record.chunkX ?? wrapper.chunkX ?? 0}:${record.chunkY ?? wrapper.chunkY ?? 0}:${record.chunkZ ?? wrapper.chunkZ ?? 0}`,
    );
  } catch {
    return "0:0:0";
  }
}

function getRegistryStats(registry: ChunkRegistryHandle): Record<string, unknown> {
  try {
    const stats = callOptionalMethod<Record<string, unknown>>(registry, ["getStats"]);

    if (stats) {
      return stats;
    }

    const snapshot = asRecord(callOptionalMethod(registry, ["getSnapshot", "snapshot"]));
    return asRecord(snapshot.stats);
  } catch {
    return {};
  }
}

function updateRegistryWithChunk(
  registry: ChunkRegistryHandle,
  chunkValue: unknown,
  markVisible = true,
): void {
  const chunk = extractRuntimeChunkCandidate(chunkValue);
  const chunkKey = getChunkCandidateKey(chunkValue);
  const shouldBeVisible = markVisible || registry.getVisibleChunkKeys().includes(chunkKey);

  try {
    if (!chunk) {
      callOptionalMethod(registry, ["markChunkFailed"], [
        chunkKey,
        new Error("ChunkServiceSource received empty chunk candidate."),
        "chunk-service-empty-chunk",
      ]);
      return;
    }

    const setOptions = {
      visible: shouldBeVisible,
      dirty: false,
      reason: "chunk-service-load",
    };

    const beforeStats = getRegistryStats(registry);
    const beforeCount = normalizeContractInteger(beforeStats.chunkCount, 0, 0, 1_000_000);

    let stored: unknown = null;

    stored = callOptionalMethod(registry, ["setApiChunk"], [chunk, setOptions]);

    if (!stored) {
      stored = callOptionalMethod(registry, ["setChunk"], [chunk, setOptions]);
    }

    if (!stored) {
      stored = callOptionalMethod(registry, ["upsertChunk"], [chunk, setOptions]);
    }

    if (!stored) {
      stored = callOptionalMethod(registry, ["putChunk"], [chunk, setOptions]);
    }

    if (!stored) {
      stored = callOptionalMethod(registry, ["registerChunk"], [chunk, setOptions]);
    }

    if (!stored) {
      stored = callOptionalMethod(registry, ["replaceChunk"], [chunk, setOptions]);
    }

    if (!stored) {
      stored = callOptionalMethod(registry, ["storeChunk"], [chunk, setOptions]);
    }

    if (markVisible) {
      callOptionalMethod(registry, ["addVisibleChunkKeys"], [
        [chunkKey],
        "chunk-service-load-visible",
      ]);
    }

    const afterStats = getRegistryStats(registry);
    const afterCount = normalizeContractInteger(afterStats.chunkCount, beforeCount, 0, 1_000_000);
    const nonAirCellCount = normalizeContractInteger(afterStats.nonAirCellCount, 0, 0, 1_000_000_000);
    const visibleChunkCount = normalizeContractInteger(afterStats.visibleChunkCount, 0, 0, 1_000_000);

    if (!stored && afterCount <= beforeCount) {
      callOptionalMethod(registry, ["markChunkFailed"], [
        chunkKey,
        new Error("ChunkServiceSource could not store loaded chunk in registry."),
        "chunk-service-load-store-failed",
      ]);
      return;
    }

    if (afterCount <= 0 || (shouldBeVisible && visibleChunkCount <= 0)) {
      callOptionalMethod(registry, ["markChunkFailed"], [
        chunkKey,
        new Error("Chunk was stored but registry still has no visible chunks."),
        "chunk-service-visible-registration-failed",
      ]);
    }

    if (nonAirCellCount <= 0) {
      callOptionalMethod(registry, ["markChunkFailed"], [
        chunkKey,
        new Error("Chunk registry has no non-air cells after storing loaded chunk."),
        "chunk-service-non-air-cells-missing",
      ]);
    }
  } catch {
    try {
      callOptionalMethod(registry, ["markChunkFailed"], [
        chunkKey,
        new Error("ChunkServiceSource registry update failed."),
        "chunk-service-load-exception",
      ]);
    } catch {
      // Registry diagnostics must never break chunk loading.
    }
  }
}

function updateRegistryFromChunkResult(
  registry: ChunkRegistryHandle,
  result: unknown,
  markVisible = true,
): void {
  try {
    if (isFailedResult(result)) {
      return;
    }

    const chunk = extractRuntimeChunkCandidate(result);

    if (chunk) {
      updateRegistryWithChunk(registry, chunk, markVisible);
    }

    const chunkKey = getChunkCandidateKey(result);

    if (markVisible && chunkKey) {
      callOptionalMethod(registry, ["addVisibleChunkKeys"], [
        [chunkKey],
        "single-chunk-load-visible",
      ]);
    }
  } catch {
    // Best-effort only; updateRegistryWithChunk records failed chunks.
  }
}

function updateRegistryFromBatchResult(
  registry: ChunkRegistryHandle,
  result: unknown,
  markVisible = true,
): void {
  try {
    if (isFailedResult(result)) {
      return;
    }

    const record = asRecord(result);
    const rawRecord = asRecord(record.raw);
    const resultRecord = asRecord(record.result);

    const chunks = asArray(
      record.chunks ??
        rawRecord.chunks ??
        rawRecord.results ??
        rawRecord.items ??
        resultRecord.chunks ??
        resultRecord.results ??
        resultRecord.items,
    );

    const visibleKeys: string[] = [];

    for (const item of chunks) {
      const chunk = extractRuntimeChunkCandidate(item);
      const chunkKey = getChunkCandidateKey(item);

      if (chunk) {
        updateRegistryWithChunk(registry, chunk, markVisible);
      }

      if (chunkKey) {
        visibleKeys.push(chunkKey);
      }
    }

    if (markVisible && visibleKeys.length > 0) {
      callOptionalMethod(registry, ["addVisibleChunkKeys"], [
        sortChunkKeys([...new Set(visibleKeys)]),
        "batch-chunk-load-visible",
      ]);
    }

    const stats = getRegistryStats(registry);
    const chunkCount = normalizeContractInteger(stats.chunkCount, 0, 0, 1_000_000);
    const visibleChunkCount = normalizeContractInteger(stats.visibleChunkCount, 0, 0, 1_000_000);
    const nonAirCellCount = normalizeContractInteger(stats.nonAirCellCount, 0, 0, 1_000_000_000);

    if (chunkCount <= 0 || (markVisible && visibleChunkCount <= 0) || nonAirCellCount <= 0) {
      callOptionalMethod(registry, ["markChunkFailed"], [
        visibleKeys[0] ?? "0:0:0",
        new Error("Batch loaded but registry did not become usable for render/physics."),
        "chunk-service-batch-registry-unusable",
      ]);
    }
  } catch {
    // Best-effort only; individual update failures are recorded.
  }
}

function markDirtyChunksInRegistry(
  registry: ChunkRegistryHandle,
  dirtyChunkKeys: readonly string[],
): void {
  try {
    if (!dirtyChunkKeys.length) {
      return;
    }

    callOptionalMethod(registry, [
      "markDirtyChunks",
      "addDirtyChunks",
      "markChunksDirty",
    ], [dirtyChunkKeys]);

    for (const chunkKey of dirtyChunkKeys) {
      callOptionalMethod(registry, ["markDirty", "markChunkDirty", "setDirty"], [
        chunkKey,
      ]);
    }
  } catch {
    // Best-effort only.
  }
}

function clearDirtyChunksInRegistry(
  registry: ChunkRegistryHandle,
  dirtyChunkKeys: readonly string[],
): void {
  try {
    if (!dirtyChunkKeys.length) {
      return;
    }

    callOptionalMethod(registry, [
      "clearDirtyChunks",
      "removeDirtyChunks",
      "markChunksClean",
    ], [dirtyChunkKeys]);

    for (const chunkKey of dirtyChunkKeys) {
      callOptionalMethod(registry, ["clearDirty", "markChunkClean", "unsetDirty"], [
        chunkKey,
      ]);
    }
  } catch {
    // Best-effort only.
  }
}

function getRegistryDirtyChunkKeys(registry: ChunkRegistryHandle): readonly string[] {
  try {
    const direct = callOptionalMethod<unknown>(registry, [
      "getDirtyChunkKeys",
      "dirtyChunkKeys",
      "getDirtyKeys",
    ]);

    const keys = asArray(direct);

    if (keys.length > 0) {
      return uniqueDirtyKeys(keys);
    }

    const snapshot = callOptionalMethod<unknown>(registry, ["getSnapshot", "snapshot"]);
    const snapshotRecord = asRecord(snapshot);

    return uniqueDirtyKeys(
      asArray(
        snapshotRecord.dirtyChunkKeys ??
          snapshotRecord.dirtyChunks ??
          snapshotRecord.dirtyKeys,
      ),
    );
  } catch {
    return [];
  }
}

function createMetadata(input: {
  readonly id: string;
  readonly label: string;
  readonly projectId: string;
  readonly universeId: string;
  readonly worldId: string;
  readonly apiBaseUrl: string;
  readonly sourceKind: string;
  readonly mode: string;
  readonly maxChunks: number;
}): ChunkSourceMetadata {
  return {
    id: input.id,
    label: input.label,
    kind: "chunk-service",
    serviceKind: CHUNK_SERVICE_SOURCE_KIND,
    sourceKind: input.sourceKind,
    mode: input.mode,
    projectId: input.projectId,
    universeId: input.universeId,
    worldId: input.worldId,
    apiBaseUrl: input.apiBaseUrl,
    maxChunks: input.maxChunks,
    inventory: {
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
      source: "editor-inventory",
      legacyChunkInventoryDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
    },
    contract: getEditorInventoryContractMetadata(),
    rules: editorInventoryContractRules(),
    createdAt: safeNowIsoString(),
    updatedAt: safeNowIsoString(),
  } as unknown as ChunkSourceMetadata;
}

function createSummary(input: {
  readonly metadata: ChunkSourceMetadata;
  readonly lifecycle: ChunkSourceLifecycleState;
  readonly dirtyChunkKeys: readonly string[];
  readonly lastCommandAt: string | null;
  readonly lastLoadAt: string | null;
  readonly commandCount: number;
  readonly loadCount: number;
  readonly errorCount: number;
}): ChunkSourceSummary {
  return {
    kind: "chunk-service-summary",
    metadata: input.metadata,
    lifecycle: input.lifecycle,
    status: asRecord(input.lifecycle).status ?? "unknown",
    projectId: asRecord(input.metadata).projectId,
    worldId: asRecord(input.metadata).worldId,
    dirtyChunkKeys: [...input.dirtyChunkKeys],
    dirtyChunkCount: input.dirtyChunkKeys.length,
    lastCommandAt: input.lastCommandAt,
    lastLoadAt: input.lastLoadAt,
    commandCount: input.commandCount,
    loadCount: input.loadCount,
    errorCount: input.errorCount,
    contract: editorInventoryContractDiagnostics({
      source: "chunk-service",
      runtimeBlockTypeId: null,
    }),
  } as unknown as ChunkSourceSummary;
}

function createEvent(
  type: string,
  payload?: Record<string, unknown>,
): ChunkSourceEvent {
  return {
    type,
    kind: type,
    source: "chunk-service",
    timestamp: safeNowIsoString(),
    createdAt: safeNowIsoString(),
    payload: payload ?? {},
    ...payload,
  } as unknown as ChunkSourceEvent;
}

function notifyListeners(
  listeners: Set<ChunkSourceEventListener>,
  event: ChunkSourceEvent,
): void {
  try {
    for (const listener of listeners) {
      try {
        (listener as unknown as (event: ChunkSourceEvent) => void)(event);
      } catch {
        // Individual listeners must not break source runtime.
      }
    }
  } catch {
    // Notification must never throw.
  }
}

function createLegacyInventoryResult(reason: string): ChunkSourceInventoryResult {
  return {
    ok: true,
    source: "legacy-diagnostic-only",
    route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    items: [],
    blocks: [],
    placeableBlocks: [],
    hotbarSlots: [],
    reason,
    message:
      "Chunk block inventory is diagnostic-only. Productive hotbar data must come from /editor/api/inventory.",
    rules: editorInventoryContractRules(),
  } as unknown as ChunkSourceInventoryResult;
}

function normalizeCommandOptions(
  options?: ChunkSourceCommandOptions | null,
): LibraryAwareCommandOptions {
  try {
    const record = asRecord(options);

    return {
      ...(record as ChunkSourceCommandOptions),
      runtimeBlockTypeId: normalizeRuntimeBlockTypeId(record.runtimeBlockTypeId),
      blockTypeId: normalizeRuntimeBlockTypeId(record.blockTypeId),
      libraryItemId: normalizeOptionalText(record.libraryItemId),
      inventoryItemId: normalizeOptionalText(record.inventoryItemId),
      inventorySlotIndex: normalizeOptionalContractInteger(record.inventorySlotIndex),
      familyId: normalizeOptionalText(record.familyId),
      packageId: normalizeOptionalText(record.packageId),
      vplibUid: normalizeOptionalText(record.vplibUid),
      variantId: normalizeOptionalText(record.variantId),
      revisionHash: normalizeOptionalText(record.revisionHash),
      objectKind: normalizeOptionalText(record.objectKind),
      label: normalizeOptionalText(record.label),
      libraryRef: normalizeEditorInventoryLibraryRef(record.libraryRef),
      placementCommand: normalizeEditorInventoryPlacementCommand(record.placementCommand),
      commandMetadata: asRecord(record.commandMetadata),
      includeLibraryMetadataInCommand: normalizeContractBoolean(
        record.includeLibraryMetadataInCommand,
        false,
      ),
      requireLibraryIdentity: normalizeContractBoolean(
        record.requireLibraryIdentity,
        false,
      ),
      validateAgainstLegacyBlockCatalog: normalizeContractBoolean(
        record.validateAgainstLegacyBlockCatalog,
        false,
      ),
      reloadDirtyChunks: normalizeContractBoolean(record.reloadDirtyChunks, true),
    };
  } catch {
    return {};
  }
}

function createSetBlockPayload(
  position: ChunkApiWorldPosition,
  runtimeBlockTypeId: string,
  options?: LibraryAwareCommandOptions,
): ChunkApiCommandPayload {
  const metadata = mergeContractMetadata(options?.commandMetadata, {
    runtimeBlockTypeId,
    blockTypeId: runtimeBlockTypeId,
    libraryItemId: options?.libraryItemId ?? null,
    inventoryItemId: options?.inventoryItemId ?? null,
    inventorySlotIndex: options?.inventorySlotIndex ?? null,
    familyId: options?.familyId ?? null,
    packageId: options?.packageId ?? null,
    vplibUid: options?.vplibUid ?? null,
    variantId: options?.variantId ?? null,
    revisionHash: options?.revisionHash ?? null,
    objectKind: options?.objectKind ?? null,
    label: options?.label ?? null,
    contract: editorInventoryContractDiagnostics({
      source: "chunk-service-set-block",
      runtimeBlockTypeId,
      libraryRef: options?.libraryRef ?? null,
      placementCommand: options?.placementCommand ?? null,
    }),
  });

  const basePayload: AnyRecord = {
    kind: "SetBlock",
    type: "SetBlock",
    command: "SetBlock",
    userId: options?.userId,
    sessionId: options?.sessionId,
    position,
    blockTypeId: runtimeBlockTypeId,
    runtimeBlockTypeId,
    metadata,
  };

  if (options?.includeLibraryMetadataInCommand === true) {
    basePayload.libraryContext = {
      libraryRef: options.libraryRef ?? null,
      placementCommand: options.placementCommand ?? null,
      libraryItemId: options.libraryItemId ?? null,
      familyId: options.familyId ?? null,
      packageId: options.packageId ?? null,
      vplibUid: options.vplibUid ?? null,
      variantId: options.variantId ?? null,
      revisionHash: options.revisionHash ?? null,
      objectKind: options.objectKind ?? null,
      inventorySlotIndex: options.inventorySlotIndex ?? null,
    };
  }

  return basePayload as unknown as ChunkApiCommandPayload;
}

function createRemoveBlockPayload(
  position: ChunkApiWorldPosition,
  options?: LibraryAwareCommandOptions,
): ChunkApiCommandPayload {
  return {
    kind: "RemoveBlock",
    type: "RemoveBlock",
    command: "RemoveBlock",
    userId: options?.userId,
    sessionId: options?.sessionId,
    position,
    metadata: mergeContractMetadata(options?.commandMetadata, {
      contract: editorInventoryContractDiagnostics({
        source: "chunk-service-remove-block",
      }),
    }),
  } as unknown as ChunkApiCommandPayload;
}

function placementContextInvalidReason(value: unknown): string {
  try {
    const record = asRecord(value);

    return (
      normalizeOptionalText(record.invalidReason) ??
      normalizeOptionalText(record.blockedReason) ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

function isPlacementContextValid(
  value: ReturnType<typeof createEditorLibraryPlacementContext>,
): boolean {
  try {
    return isValidEditorLibraryPlacementContext(value as unknown);
  } catch {
    return false;
  }
}

function isPreparedPlacementFailure(
  value: PreparedLibraryPlacementResult,
): value is PreparedLibraryPlacementFailure {
  try {
    return value.ok === false;
  } catch {
    return true;
  }
}

function prepareLibraryPlacement(
  placement: ChunkServiceSourceLibraryPlacementInput,
  commandOptions?: ChunkSourceCommandOptions,
): PreparedLibraryPlacementResult {
  try {
    const options = normalizeCommandOptions(commandOptions);
    const placementRecord = asRecord(placement);

    const placementCommand =
      normalizeEditorInventoryPlacementCommand(placement.placementCommand) ??
      normalizeEditorInventoryPlacementCommand(options.placementCommand);

    const libraryRef =
      normalizeEditorInventoryLibraryRef(placement.libraryRef) ??
      normalizeEditorInventoryLibraryRef(options.libraryRef) ??
      contractLibraryRefFromPlacementCommand(placementCommand);

    const runtimeBlockTypeId =
      normalizeRuntimeBlockTypeId(placement.runtimeBlockTypeId) ??
      normalizeRuntimeBlockTypeId(placement.blockTypeId) ??
      normalizeRuntimeBlockTypeId(options.runtimeBlockTypeId) ??
      normalizeRuntimeBlockTypeId(options.blockTypeId) ??
      contractRuntimeBlockTypeIdFromPlacementCommand(placementCommand);

    const context = createEditorLibraryPlacementContext({
      source: "library",
      runtimeBlockTypeId,
      blockTypeId: runtimeBlockTypeId,
      libraryRef,
      placementCommand,
      commandMetadata: mergeContractMetadata(
        options.commandMetadata,
        placement.commandMetadata,
        {
          placementRecord,
        },
      ),
      requireLibraryIdentity: options.requireLibraryIdentity ?? true,
      libraryItemId:
        normalizeOptionalText(placement.libraryItemId) ??
        normalizeOptionalText(options.libraryItemId),
      inventoryItemId:
        normalizeOptionalText(placement.inventoryItemId) ??
        normalizeOptionalText(options.inventoryItemId),
      inventorySlotIndex:
        normalizeOptionalContractInteger(placement.inventorySlotIndex) ??
        normalizeOptionalContractInteger(options.inventorySlotIndex),
      familyId:
        normalizeOptionalText(placement.familyId) ??
        normalizeOptionalText(options.familyId),
      packageId:
        normalizeOptionalText(placement.packageId) ??
        normalizeOptionalText(options.packageId),
      vplibUid:
        normalizeOptionalText(placement.vplibUid) ??
        normalizeOptionalText(options.vplibUid),
      variantId:
        normalizeOptionalText(placement.variantId) ??
        normalizeOptionalText(options.variantId),
      revisionHash:
        normalizeOptionalText(placement.revisionHash) ??
        normalizeOptionalText(options.revisionHash),
      objectKind:
        normalizeOptionalText(placement.objectKind) ??
        normalizeOptionalText(options.objectKind),
      label:
        normalizeOptionalText(placement.label) ??
        normalizeOptionalText(options.label),
    });

    if (!runtimeBlockTypeId) {
      return {
        ok: false,
        failed: createFailedResult("Missing runtimeBlockTypeId for Library/VPLIB placement.", "client-fallback", {
          reason: "missing-runtime-block-type-id",
          placementDiagnostics: editorInventoryContractDiagnostics(placement),
        }),
      };
    }

    if (isForbiddenDebugBlockTypeIdContract(runtimeBlockTypeId)) {
      return {
        ok: false,
        failed: createFailedResult(
          `Forbidden debug runtimeBlockTypeId: ${runtimeBlockTypeId}.`,
          "client-fallback",
          {
            reason: "forbidden-debug-runtime-block-type-id",
            runtimeBlockTypeId,
            forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
          },
        ),
      };
    }

    if (!isPlacementContextValid(context)) {
      const invalidReason = placementContextInvalidReason(context);

      return {
        ok: false,
        failed: createFailedResult(
          `Invalid Library/VPLIB placement context: ${invalidReason}.`,
          "client-fallback",
          {
            reason: invalidReason === "unknown"
              ? "invalid-library-placement-context"
              : invalidReason,
            placementDiagnostics: editorInventoryContractDiagnostics({
              ...placementRecord,
              runtimeBlockTypeId,
              libraryRef,
              placementCommand,
            }),
          },
        ),
      };
    }

    if (!contractHasLibraryIdentity(context)) {
      return {
        ok: false,
        failed: createFailedResult("Missing Library/VPLIB identity for placement.", "client-fallback", {
          reason: "missing-library-identity",
          runtimeBlockTypeId,
        }),
      };
    }

    return {
      ok: true,
      runtimeBlockTypeId,
      context,
      options: {
        ...options,
        runtimeBlockTypeId,
        blockTypeId: runtimeBlockTypeId,
        libraryRef,
        placementCommand,
        libraryItemId: context.libraryItemId,
        inventoryItemId: context.inventoryItemId,
        inventorySlotIndex: context.inventorySlotIndex,
        familyId: context.familyId,
        packageId: context.packageId,
        vplibUid: context.vplibUid,
        variantId: context.variantId,
        revisionHash: context.revisionHash,
        objectKind: context.objectKind,
        label: context.label,
        commandMetadata: mergeContractMetadata(options.commandMetadata, {
          libraryPlacementContext: context,
        }),
      },
    };
  } catch (error) {
    return {
      ok: false,
      failed: createFailedFromUnknown(error, "Failed to prepare Library/VPLIB placement.", {
        placementDiagnostics: editorInventoryContractDiagnostics(placement),
      }),
    };
  }
}

export function createChunkServiceSource(
  options: CreateChunkServiceSourceOptions,
): ChunkServiceSource {
  const projectId = deriveProjectId(options);
  const universeId = deriveUniverseId(options);
  const worldId = deriveWorldId(options);
  const apiBaseUrl = deriveApiBaseUrl(options);
  const mode = deriveSourceMode(options);
  const maxChunks = deriveMaxChunks(options);
  const sourceKind = normalizeText(options.sourceKind, "chunk-service");
  const id = normalizeText(options.id, createSourceId(projectId, worldId));
  const label = normalizeText(options.label, CHUNK_SERVICE_SOURCE_LABEL);
  const commandUserId = normalizeText(options.userId, "editor_user");
  const commandSessionId = normalizeText(
    options.sessionId,
    `editor_session_${Date.now()}`,
  );

  function withCommandIdentity(
    commandOptions?: ChunkSourceCommandOptions | null,
  ): ChunkSourceCommandOptions {
    const record = asRecord(commandOptions);
    return {
      ...(record as ChunkSourceCommandOptions),
      userId: normalizeText(record.userId, commandUserId),
      sessionId: normalizeText(record.sessionId, commandSessionId),
    };
  }

  const client = options.client;
  const logger = options.logger;
  const sourceSignal = options.signal;
  const registry = options.registry ?? createDefaultRegistry(maxChunks);
  const editSession = options.editSession ?? createDefaultEditSession(projectId, worldId, options);

  const listeners = new Set<ChunkSourceEventListener>();
  const dirtyChunkKeys = new Set<string>();
  const scheduledDirtyChunkKeys = new Set<string>();
  const chunkKeysInFlight = new Set<string>();

  let lifecycle = createLifecycleState("idle");
  let destroyed = false;
  let lastCommandAt: string | null = null;
  let lastLoadAt: string | null = null;
  let commandCount = 0;
  let loadCount = 0;
  let errorCount = 0;
  let commandRequestTail: Promise<void> = Promise.resolve();
  let chunkBatchRequestTail: Promise<void> = Promise.resolve();
  let scheduledDirtyReloadPromise: Promise<void> | null = null;
  let scheduledDirtyReloadFirstAt = 0;
  let scheduledDirtyReloadDueAt = 0;

  const DIRTY_RELOAD_QUIET_MS = 80;
  const DIRTY_RELOAD_MAX_WAIT_MS = 240;

  function invokeQueuedCommandClient(
    methodName: string,
    candidates: readonly (readonly unknown[])[],
  ): Promise<unknown> {
    const operation = commandRequestTail.then(
      () => invokeClientMethod(client, methodName, candidates),
      () => invokeClientMethod(client, methodName, candidates),
    );
    commandRequestTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  function invokeQueuedChunkBatchClient(
    candidates: readonly (readonly unknown[])[],
  ): Promise<unknown> {
    const operation = chunkBatchRequestTail.then(
      () => invokeClientMethod(client, "loadChunksBatch", candidates),
      () => invokeClientMethod(client, "loadChunksBatch", candidates),
    );
    chunkBatchRequestTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }


  const metadata = createMetadata({
    id,
    label,
    projectId,
    universeId,
    worldId,
    apiBaseUrl,
    sourceKind,
    mode,
    maxChunks,
  });

  function updateLifecycle(
    status: string,
    patch?: Record<string, unknown>,
  ): ChunkSourceLifecycleState {
    lifecycle = {
      ...asRecord(lifecycle),
      status,
      updatedAt: safeNowIsoString(),
      connectionOk: status === "ready" ? true : asRecord(lifecycle).connectionOk,
      initialized: status === "ready" ? true : asRecord(lifecycle).initialized,
      destroyed: status === "destroyed",
      ...patch,
    } as unknown as ChunkSourceLifecycleState;

    notifyListeners(listeners, createEvent(`lifecycle:${status}`, {
      lifecycle,
      status,
    }));

    return lifecycle;
  }

  function emit(type: string, payload?: Record<string, unknown>): void {
    notifyListeners(listeners, createEvent(type, payload));
  }

  function rememberDirtyKeys(keys: readonly string[]): void {
    try {
      for (const key of keys) {
        dirtyChunkKeys.add(normalizeChunkKey(key));
      }

      if (keys.length > 0) {
        markDirtyChunksInRegistry(registry, keys);
        emit("dirty-chunks", {
          dirtyChunkKeys: [...dirtyChunkKeys],
        });
      }
    } catch {
      // Dirty tracking is best-effort.
    }
  }

  function forgetDirtyKeys(keys: readonly string[]): void {
    try {
      for (const key of keys) {
        dirtyChunkKeys.delete(normalizeChunkKey(key));
      }

      clearDirtyChunksInRegistry(registry, keys);
    } catch {
      // Dirty tracking is best-effort.
    }
  }

  async function initialize(): Promise<unknown> {
    try {
      if (destroyed || isDestroyedLifecycle(lifecycle)) {
        return createFailedFromDestroyed();
      }

      updateLifecycle("initializing");
      logInfo(logger, "Initializing ChunkServiceSource.", {
        projectId,
        worldId,
        apiBaseUrl,
      });

      const signal = mergeAbortSignal(sourceSignal, undefined);
      const result = await invokeClientMethod(client, "testConnection", [
        [requestOverridesFromSignal(signal)],
        [{ signal }],
        [],
      ]);

      if (isFailedResult(result)) {
        errorCount += 1;
        updateLifecycle("degraded", {
          error: result,
          lastError: result,
          connectionOk: false,
        });
        emit("connection:failed", { result });
        return result;
      }

      updateLifecycle("ready", {
        connectionOk: true,
        initialized: true,
        error: null,
      });
      emit("connection:ready", { result });
      return result;
    } catch (error) {
      errorCount += 1;
      const failed = createFailedFromUnknown(error, "Failed to initialize ChunkServiceSource.");
      updateLifecycle("failed", {
        error: failed,
        lastError: failed,
        connectionOk: false,
      });
      emit("connection:failed", { result: failed });
      return failed;
    }
  }

  async function loadChunk(
    coordinates: unknown,
    loadOptions?: ChunkSourceLoadChunkOptions,
  ): Promise<ChunkSourceLoadChunkResult> {
    try {
      if (destroyed || isDestroyedLifecycle(lifecycle)) {
        return createFailedFromDestroyed() as unknown as ChunkSourceLoadChunkResult;
      }

      const coords = normalizeCoordinates(coordinates);
      const loadOptionsRecord = asRecord(loadOptions);
      const signal = mergeAbortSignal(
        sourceSignal,
        isAbortSignal(loadOptionsRecord.signal) ? loadOptionsRecord.signal : undefined,
      );
      const overrides = requestOverridesFromSignal(signal, loadOptionsRecord.contentProfile);

      updateLifecycle("loading");
      emit("chunk:load:start", { coordinates: coords });

      const result = await invokeClientMethod(client, "loadChunk", [
        [projectId, worldId, coords, overrides],
        [{ projectId, worldId, coordinates: coords, ...coords, signal }],
        [coords, { projectId, worldId, signal }],
      ]);

      if (isFailedResult(result)) {
        errorCount += 1;
        updateLifecycle("degraded", {
          error: result,
          lastError: result,
        });
        emit("chunk:load:failed", { coordinates: coords, result });
        return result as unknown as ChunkSourceLoadChunkResult;
      }

      updateRegistryFromChunkResult(registry, result, loadOptions?.markVisible !== false);
      lastLoadAt = safeNowIsoString();
      loadCount += 1;
      updateLifecycle("ready");
      emit("chunk:load:ready", { coordinates: coords, result });

      return result as unknown as ChunkSourceLoadChunkResult;
    } catch (error) {
      errorCount += 1;
      const failed = createFailedFromUnknown(error, "Failed to load chunk.", {
        coordinates,
      });
      updateLifecycle("degraded", {
        error: failed,
        lastError: failed,
      });
      emit("chunk:load:failed", { coordinates, result: failed });
      return failed as unknown as ChunkSourceLoadChunkResult;
    }
  }

  async function loadChunks(
    requests: unknown,
    loadOptions?: ChunkSourceLoadChunksOptions,
  ): Promise<ChunkSourceLoadChunksResult> {
    const claimedChunkKeys: string[] = [];
    try {
      if (destroyed || isDestroyedLifecycle(lifecycle)) {
        return createFailedFromDestroyed() as unknown as ChunkSourceLoadChunksResult;
      }

      const loadOptionsRecord = asRecord(loadOptions);
      const force = loadOptionsRecord.force === true;
      const requestList = asArray(requests);
      const normalizedCandidates = requestList
        .map((request) => normalizeCoordinates(request)) as readonly ChunkApiBatchChunkRequest[];

      if (normalizedCandidates.length > HARD_MAX_SOURCE_BATCH_SIZE) {
        const chunks: RuntimeChunkContent[] = [];
        const failed: ChunkApiFailedResult[] = [];
        let fromCacheCount = 0;
        let lastBatchResult: ChunkApiBatchResult | null = null;
        let firstFailure: ChunkApiFailedResult | null = null;

        for (
          let offset = 0;
          offset < normalizedCandidates.length;
          offset += HARD_MAX_SOURCE_BATCH_SIZE
        ) {
          const part = normalizedCandidates.slice(
            offset,
            offset + HARD_MAX_SOURCE_BATCH_SIZE,
          );
          const partResult = await loadChunks(part, loadOptions);
          if (isFailedResult(partResult)) {
            firstFailure ??= partResult;
            failed.push(partResult);
            continue;
          }
          chunks.push(...partResult.chunks);
          failed.push(...partResult.failed);
          fromCacheCount += partResult.fromCacheCount;
          lastBatchResult = partResult.result ?? lastBatchResult;
        }

        if (chunks.length === 0 && firstFailure) {
          return firstFailure as unknown as ChunkSourceLoadChunksResult;
        }
        return {
          chunks,
          result: lastBatchResult,
          failed,
          fromCacheCount,
        };
      }

      const normalizedRequests = normalizedCandidates
        .filter((coordinates) => {
          const key = chunkKeyFromCoordinates(
            coordinates.chunkX,
            coordinates.chunkY,
            coordinates.chunkZ,
          );
          if (!force && chunkKeysInFlight.has(key)) return false;
          if (!force && registry.getChunk(key)) return false;
          chunkKeysInFlight.add(key);
          claimedChunkKeys.push(key);
          return true;
        }) as readonly ChunkApiBatchChunkRequest[];
      const signal = mergeAbortSignal(
        sourceSignal,
        isAbortSignal(loadOptionsRecord.signal) ? loadOptionsRecord.signal : undefined,
      );
      const overrides = requestOverridesFromSignal(signal, loadOptionsRecord.contentProfile);

      updateLifecycle("loading");
      emit("chunks:load:start", {
        count: normalizedRequests.length,
      });

      if (normalizedRequests.length === 0) {
        const emptyResult = {
          ok: true,
          request: null,
          source: "client-fallback",
          raw: {
            empty: true,
          },
          error: null,
          projectId,
          worldId,
          chunks: [],
          failedChunks: [],
        } as unknown as ChunkSourceLoadChunksResult;

        updateLifecycle("ready");
        return emptyResult;
      }

      const batchResult = await invokeQueuedChunkBatchClient([
        [projectId, worldId, normalizedRequests, overrides],
        [{ projectId, worldId, chunks: normalizedRequests, requests: normalizedRequests, signal }],
        [normalizedRequests, { projectId, worldId, signal }],
      ]);

      if (!isFailedResult(batchResult)) {
        updateRegistryFromBatchResult(registry, batchResult, loadOptions?.markVisible !== false);
        lastLoadAt = safeNowIsoString();
        loadCount += normalizedRequests.length;
        updateLifecycle("ready");
        emit("chunks:load:ready", {
          count: normalizedRequests.length,
          result: batchResult,
        });
        return batchResult as unknown as ChunkSourceLoadChunksResult;
      }

      logWarn(logger, "Batch chunk loading failed. Falling back to individual chunk loads.", {
        projectId,
        worldId,
        failed: batchResult,
      });

      const chunkResults: unknown[] = [];

      for (const coords of normalizedRequests) {
        const itemResult = await loadChunk(coords, loadOptions);
        chunkResults.push(itemResult);
      }

      const fallbackResult = {
        ok: true,
        request: null,
        source: "client-fallback",
        raw: {
          fallback: "individual-loads",
          batchFailure: batchResult,
        },
        error: null,
        projectId,
        worldId,
        chunks: chunkResults
          .filter((result) => !isFailedResult(result))
          .map((result) => asRecord(result).chunk ?? asRecord(result).raw),
        failedChunks: chunkResults.filter((result) => isFailedResult(result)),
      } as unknown as ChunkSourceLoadChunksResult;

      updateLifecycle("ready");
      emit("chunks:load:ready", {
        count: normalizedRequests.length,
        result: fallbackResult,
      });

      return fallbackResult;
    } catch (error) {
      errorCount += 1;
      const failed = createFailedFromUnknown(error, "Failed to load chunks.", {
        requests,
      });
      updateLifecycle("degraded", {
        error: failed,
        lastError: failed,
      });
      emit("chunks:load:failed", { result: failed });
      return failed as unknown as ChunkSourceLoadChunksResult;
    } finally {
      for (const key of claimedChunkKeys) chunkKeysInFlight.delete(key);
    }
  }

  async function reloadDirtyChunks(
    options?: ChunkSourceDirtyOptions,
  ): Promise<ChunkSourceLoadChunksResult> {
    try {
      if (destroyed || isDestroyedLifecycle(lifecycle)) {
        return createFailedFromDestroyed() as unknown as ChunkSourceLoadChunksResult;
      }

      const optionsRecord = asRecord(options);
      const explicitDirtyKeys = uniqueDirtyKeys(
        asArray(optionsRecord.dirtyChunkKeys ?? optionsRecord.chunkKeys),
      );
      const registryDirtyKeys = getRegistryDirtyChunkKeys(registry);
      const keys = uniqueDirtyKeys([
        ...dirtyChunkKeys,
        ...explicitDirtyKeys,
        ...registryDirtyKeys,
      ]);

      if (keys.length === 0) {
        return {
          ok: true,
          request: null,
          source: "client-fallback",
          raw: {
            empty: true,
            reason: "no-dirty-chunks",
          },
          error: null,
          projectId,
          worldId,
          chunks: [],
          failedChunks: [],
        } as unknown as ChunkSourceLoadChunksResult;
      }

      const coordinates = keys.map((key) => chunkCoordinatesFromDirtyKey(key));
      const result = await loadChunks(coordinates, {
        ...asRecord(options),
        // A command changes server state. Reusing the registry copy here made
        // successful place/remove commands look like no-ops until some later
        // streaming request happened to reload the chunk.
        force: true,
        markVisible: true,
      } as ChunkSourceLoadChunksOptions);

      if (!isFailedResult(result)) {
        forgetDirtyKeys(keys);
      }

      return result;
    } catch (error) {
      const failed = createFailedFromUnknown(error, "Failed to reload dirty chunks.");
      return failed as unknown as ChunkSourceLoadChunksResult;
    }
  }
  async function flushScheduledDirtyChunkReloads(): Promise<void> {
    while (!destroyed && scheduledDirtyChunkKeys.size > 0) {
      const delayMs = Math.max(0, scheduledDirtyReloadDueAt - Date.now());
      if (delayMs > 0) {
        await new Promise<void>((resolve) => {
          globalThis.setTimeout(resolve, delayMs);
        });
        continue;
      }

      const keys = [...scheduledDirtyChunkKeys];
      scheduledDirtyChunkKeys.clear();
      scheduledDirtyReloadFirstAt = 0;
      await reloadDirtyChunks({
        dirtyChunkKeys: keys,
      } as unknown as ChunkSourceDirtyOptions);
    }
  }

  function scheduleDirtyChunkReload(dirtyKeys: readonly string[]): Promise<void> {
    const nowMs = Date.now();
    dirtyKeys.forEach((key) => {
      const normalized = normalizeText(key);
      if (normalized) scheduledDirtyChunkKeys.add(normalized);
    });

    if (scheduledDirtyChunkKeys.size === 0) {
      return scheduledDirtyReloadPromise ?? Promise.resolve();
    }

    if (scheduledDirtyReloadFirstAt <= 0) {
      scheduledDirtyReloadFirstAt = nowMs;
    }
    scheduledDirtyReloadDueAt = Math.min(
      nowMs + DIRTY_RELOAD_QUIET_MS,
      scheduledDirtyReloadFirstAt + DIRTY_RELOAD_MAX_WAIT_MS,
    );

    if (!scheduledDirtyReloadPromise) {
      scheduledDirtyReloadPromise = flushScheduledDirtyChunkReloads().finally(() => {
        scheduledDirtyReloadPromise = null;
        if (!destroyed && scheduledDirtyChunkKeys.size > 0) {
          void scheduleDirtyChunkReload([]);
        }
      });
    }

    return scheduledDirtyReloadPromise;
  }


  async function sendCommandPayload(
    payload: ChunkApiCommandPayload,
    commandOptions?: LibraryAwareCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult> {
    try {
      if (destroyed || isDestroyedLifecycle(lifecycle)) {
        return createFailedFromDestroyed();
      }

      const signal = mergeAbortSignal(
        sourceSignal,
        isAbortSignal(asRecord(commandOptions).signal)
          ? (asRecord(commandOptions).signal as AbortSignal)
          : undefined,
      );
      const overrides = requestOverridesFromSignal(signal);

      updateLifecycle("commanding");
      emit("command:start", {
        payload,
      });

      const result = await invokeQueuedCommandClient("sendCommand", [
        [payload, overrides],
        [projectId, worldId, payload, overrides],
        [{ projectId, worldId, payload, command: payload, signal }],
      ]);

      if (isFailedResult(result)) {
        errorCount += 1;
        updateLifecycle("degraded", {
          error: result,
          lastError: result,
        });
        emit("command:failed", {
          payload,
          result,
        });
        return result;
      }

      commandCount += 1;
      lastCommandAt = safeNowIsoString();

      const dirtyKeys = extractDirtyChunkKeys(result);
      rememberDirtyKeys(dirtyKeys);

      updateLifecycle("ready");
      emit("command:ready", {
        payload,
        result,
        dirtyChunkKeys: dirtyKeys,
      });

      if (commandOptions?.reloadDirtyChunks !== false && dirtyKeys.length > 0) {
        await scheduleDirtyChunkReload(dirtyKeys);
      }

      return result as ChunkSourceCommandResult;
    } catch (error) {
      errorCount += 1;
      const failed = createFailedFromUnknown(error, "Failed to send chunk command.", {
        payload,
      });
      updateLifecycle("degraded", {
        error: failed,
        lastError: failed,
      });
      emit("command:failed", {
        payload,
        result: failed,
      });
      return failed;
    }
  }

  async function setBlock(
    position: ChunkApiWorldPosition,
    blockTypeId: string,
    commandOptions?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult> {
    try {
      const normalizedPosition = normalizeWorldPosition(position);
      const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(blockTypeId);

      if (!runtimeBlockTypeId) {
        return createFailedResult("Missing runtimeBlockTypeId for SetBlock command.", "client-fallback", {
          reason: "missing-runtime-block-type-id",
          blockTypeId,
        });
      }

      if (isForbiddenDebugBlockTypeIdContract(runtimeBlockTypeId)) {
        return createFailedResult(
          `Forbidden debug runtimeBlockTypeId: ${runtimeBlockTypeId}.`,
          "client-fallback",
          {
            reason: "forbidden-debug-runtime-block-type-id",
            runtimeBlockTypeId,
          },
        );
      }

      const options = normalizeCommandOptions(withCommandIdentity({
        ...(asRecord(commandOptions) as ChunkSourceCommandOptions),
        runtimeBlockTypeId,
        blockTypeId: runtimeBlockTypeId,
      }));

      const signal = mergeAbortSignal(
        sourceSignal,
        isAbortSignal(asRecord(commandOptions).signal)
          ? (asRecord(commandOptions).signal as AbortSignal)
          : undefined,
      );
      const overrides = {
        ...requestOverridesFromSignal(signal),
        userId: options.userId,
        sessionId: options.sessionId,
      };

      updateLifecycle("commanding");
      emit("command:set-block:start", {
        position: normalizedPosition,
        runtimeBlockTypeId,
      });

      const result = await invokeQueuedCommandClient("sendSetBlock", [
        [normalizedPosition, runtimeBlockTypeId, overrides],
        [projectId, worldId, normalizedPosition, runtimeBlockTypeId, overrides],
        [
          {
            projectId,
            worldId,
            position: normalizedPosition,
            blockTypeId: runtimeBlockTypeId,
            runtimeBlockTypeId,
            userId: options.userId,
            sessionId: options.sessionId,
            signal,
          },
        ],
      ]);

      const finalResult = isFailedResult(result)
        ? await sendCommandPayload(
            createSetBlockPayload(normalizedPosition, runtimeBlockTypeId, options),
            {
              ...options,
              reloadDirtyChunks: false,
            },
          )
        : result;

      if (isFailedResult(finalResult)) {
        errorCount += 1;
        updateLifecycle("degraded", {
          error: finalResult,
          lastError: finalResult,
        });
        emit("command:set-block:failed", {
          position: normalizedPosition,
          runtimeBlockTypeId,
          result: finalResult,
        });
        return finalResult;
      }

      commandCount += 1;
      lastCommandAt = safeNowIsoString();

      const dirtyKeys = extractDirtyChunkKeys(finalResult);
      rememberDirtyKeys(dirtyKeys);

      updateLifecycle("ready");
      emit("command:set-block:ready", {
        position: normalizedPosition,
        runtimeBlockTypeId,
        result: finalResult,
        dirtyChunkKeys: dirtyKeys,
      });

      if (options.reloadDirtyChunks !== false && dirtyKeys.length > 0) {
        await scheduleDirtyChunkReload(dirtyKeys);
      }

      return finalResult as ChunkSourceCommandResult;
    } catch (error) {
      errorCount += 1;
      const failed = createFailedFromUnknown(error, "Failed to set block.", {
        position,
        blockTypeId,
      });
      updateLifecycle("degraded", {
        error: failed,
        lastError: failed,
      });
      return failed;
    }
  }

  async function removeBlock(
    position: ChunkApiWorldPosition,
    commandOptions?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult> {
    try {
      const normalizedPosition = normalizeWorldPosition(position);
      const options = normalizeCommandOptions(withCommandIdentity(commandOptions));

      const signal = mergeAbortSignal(
        sourceSignal,
        isAbortSignal(asRecord(commandOptions).signal)
          ? (asRecord(commandOptions).signal as AbortSignal)
          : undefined,
      );
      const overrides = {
        ...requestOverridesFromSignal(signal),
        userId: options.userId,
        sessionId: options.sessionId,
      };

      updateLifecycle("commanding");
      emit("command:remove-block:start", {
        position: normalizedPosition,
      });

      const result = await invokeQueuedCommandClient("sendRemoveBlock", [
        [normalizedPosition, overrides],
        [projectId, worldId, normalizedPosition, overrides],
        [
          {
            projectId,
            worldId,
            position: normalizedPosition,
            userId: options.userId,
            sessionId: options.sessionId,
            signal,
          },
        ],
      ]);

      const finalResult = isFailedResult(result)
        ? await sendCommandPayload(
            createRemoveBlockPayload(normalizedPosition, options),
            {
              ...options,
              reloadDirtyChunks: false,
            },
          )
        : result;

      if (isFailedResult(finalResult)) {
        errorCount += 1;
        updateLifecycle("degraded", {
          error: finalResult,
          lastError: finalResult,
        });
        emit("command:remove-block:failed", {
          position: normalizedPosition,
          result: finalResult,
        });
        return finalResult;
      }

      commandCount += 1;
      lastCommandAt = safeNowIsoString();

      const dirtyKeys = extractDirtyChunkKeys(finalResult);
      rememberDirtyKeys(dirtyKeys);

      updateLifecycle("ready");
      emit("command:remove-block:ready", {
        position: normalizedPosition,
        result: finalResult,
        dirtyChunkKeys: dirtyKeys,
      });

      if (options.reloadDirtyChunks !== false && dirtyKeys.length > 0) {
        await scheduleDirtyChunkReload(dirtyKeys);
      }

      return finalResult as ChunkSourceCommandResult;
    } catch (error) {
      errorCount += 1;
      const failed = createFailedFromUnknown(error, "Failed to remove block.", {
        position,
      });
      updateLifecycle("degraded", {
        error: failed,
        lastError: failed,
      });
      return failed;
    }
  }

  async function placeLibraryItem(
    position: ChunkApiWorldPosition,
    placement: ChunkServiceSourceLibraryPlacementInput,
    commandOptions?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult> {
    try {
      const normalizedPosition = normalizeWorldPosition(position);
      const prepared = prepareLibraryPlacement(
        placement,
        withCommandIdentity(commandOptions),
      );

      if (isPreparedPlacementFailure(prepared)) {
        const failed = prepared.failed;

        errorCount += 1;
        emit("command:place-library-item:blocked", {
          position: normalizedPosition,
          result: failed,
        });
        return failed;
      }

      callOptionalMethod(editSession, [
        "preparePlaceLibraryItemCommand",
        "prepareLibraryPlacementCommand",
        "preparePlacementCommand",
      ], [
        normalizedPosition,
        {
          ...placement,
          runtimeBlockTypeId: prepared.runtimeBlockTypeId,
          blockTypeId: prepared.runtimeBlockTypeId,
          libraryRef: prepared.context.libraryRef,
          placementCommand: prepared.context.placementCommand,
          commandMetadata: mergeContractMetadata(
            placement.commandMetadata,
            prepared.options.commandMetadata,
            {
              libraryPlacementContext: prepared.context,
            },
          ),
        },
        prepared.options,
      ]);

      emit("command:place-library-item:start", {
        position: normalizedPosition,
        runtimeBlockTypeId: prepared.runtimeBlockTypeId,
        libraryContext: prepared.context,
      });

      const payload = createSetBlockPayload(
        normalizedPosition,
        prepared.runtimeBlockTypeId,
        prepared.options,
      );

      const result = await sendCommandPayload(payload, prepared.options);

      if (isFailedResult(result)) {
        callOptionalMethod(editSession, ["recordFailed", "recordCommandFailed"], [
          result,
          payload,
        ]);
        emit("command:place-library-item:failed", {
          position: normalizedPosition,
          result,
          libraryContext: prepared.context,
        });
        return result;
      }

      callOptionalMethod(editSession, ["recordResult", "recordCommandResult"], [
        result,
        payload,
      ]);

      emit("command:place-library-item:ready", {
        position: normalizedPosition,
        result,
        runtimeBlockTypeId: prepared.runtimeBlockTypeId,
        libraryContext: prepared.context,
      });

      return result;
    } catch (error) {
      errorCount += 1;
      const failed = createFailedFromUnknown(error, "Failed to place Library/VPLIB item.", {
        position,
        placementDiagnostics: editorInventoryContractDiagnostics(placement),
      });

      callOptionalMethod(editSession, ["recordFailed", "recordCommandFailed"], [
        failed,
        placement,
      ]);

      emit("command:place-library-item:failed", {
        position,
        result: failed,
      });

      return failed;
    }
  }

  async function loadBlocks(): Promise<ChunkApiBlocksResult | ChunkSourceInventoryResult> {
    try {
      logWarn(logger, "Chunk block catalog requested; returning diagnostic-only result.", {
        route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
      });

      return createLegacyInventoryResult("chunk-block-catalog-is-diagnostic-only") as
        | ChunkApiBlocksResult
        | ChunkSourceInventoryResult;
    } catch {
      return createLegacyInventoryResult("chunk-block-catalog-fallback-error") as
        | ChunkApiBlocksResult
        | ChunkSourceInventoryResult;
    }
  }

  async function loadPlaceableBlocks(): Promise<ChunkApiBlocksResult | ChunkSourceInventoryResult> {
    try {
      logWarn(logger, "Chunk placeable blocks requested; returning diagnostic-only result.", {
        route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
      });

      return createLegacyInventoryResult("chunk-placeable-blocks-are-diagnostic-only") as
        | ChunkApiBlocksResult
        | ChunkSourceInventoryResult;
    } catch {
      return createLegacyInventoryResult("chunk-placeable-blocks-fallback-error") as
        | ChunkApiBlocksResult
        | ChunkSourceInventoryResult;
    }
  }

  function getMetadata(): ChunkSourceMetadata {
    return {
      ...asRecord(metadata),
      updatedAt: safeNowIsoString(),
    } as unknown as ChunkSourceMetadata;
  }

  function getLifecycleState(): ChunkSourceLifecycleState {
    return lifecycle;
  }

  function getSummary(): ChunkSourceSummary {
    return createSummary({
      metadata: getMetadata(),
      lifecycle,
      dirtyChunkKeys: [...dirtyChunkKeys],
      lastCommandAt,
      lastLoadAt,
      commandCount,
      loadCount,
      errorCount,
    });
  }

  function getSnapshot(): Record<string, unknown> {
    return {
      kind: CHUNK_SERVICE_SOURCE_KIND,
      id,
      label,
      metadata: getMetadata(),
      lifecycle,
      summary: getSummary(),
      dirtyChunkKeys: [...dirtyChunkKeys],
      commandCount,
      loadCount,
      errorCount,
      registrySnapshot: callOptionalMethod(registry, ["getSnapshot", "snapshot"]),
      editSessionSnapshot: callOptionalMethod(editSession, ["getSnapshot", "snapshot"]),
      contract: getEditorInventoryContractMetadata(),
    };
  }

  function subscribe(listener: ChunkSourceEventListener): ChunkSourceUnsubscribe {
    try {
      listeners.add(listener);

      return (() => {
        try {
          listeners.delete(listener);
        } catch {
          // Unsubscribe must be safe.
        }
      }) as ChunkSourceUnsubscribe;
    } catch {
      return (() => undefined) as ChunkSourceUnsubscribe;
    }
  }

  function destroy(reason = "destroy"): void {
    try {
      if (destroyed) {
        return;
      }

      destroyed = true;
      updateLifecycle("destroying", {
        reason,
      });

      emit("destroying", {
        reason,
      });

      listeners.clear();
      scheduledDirtyChunkKeys.clear();
      dirtyChunkKeys.clear();

      callOptionalMethod(editSession, ["destroy", "dispose"], [reason]);

      updateLifecycle("destroyed", {
        reason,
        destroyed: true,
      });

      logInfo(logger, "ChunkServiceSource destroyed.", {
        reason,
        projectId,
        worldId,
      });
    } catch (error) {
      logError(logger, "Failed to destroy ChunkServiceSource.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const source: Record<string, unknown> = {
    kind: "chunk-service",
    serviceKind: CHUNK_SERVICE_SOURCE_KIND,

    id,
    label,
    projectId,
    universeId,
    worldId,
    apiBaseUrl,
    mode,

    client,
    registry,
    editSession,

    initialize,
    start: initialize,
    connect: initialize,

    destroy,
    dispose: destroy,

    subscribe,
    addEventListener: subscribe,

    getMetadata,
    getLifecycleState,
    getSummary,
    getSnapshot,
    getRegistry: () => registry,
    getEditSession: () => editSession,

    loadChunk,
    loadChunks,
    loadChunksBatch: loadChunks,
    loadChunkBatch: loadChunks,

    reloadDirtyChunks,
    refreshDirtyChunks: reloadDirtyChunks,

    getDirtyChunkKeys: () => [...dirtyChunkKeys],
    clearDirtyChunkKeys: () => {
      const keys = [...dirtyChunkKeys];
      dirtyChunkKeys.clear();
      clearDirtyChunksInRegistry(registry, keys);
    },

    setBlock,
    placeBlock: setBlock,
    removeBlock,
    deleteBlock: removeBlock,
    placeLibraryItem,

    sendCommand: sendCommandPayload,

    loadBlocks,
    loadPlaceableBlocks,

    supportsLibraryPlacement: true,
    supportsLegacyChunkInventory: false,
    legacyChunkInventoryDiagnosticOnly: true,
    productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    rules: editorInventoryContractRules(),
  };

  if (options.autoInitialize === true) {
    void initialize().catch((error: unknown) => {
      const failed = createFailedFromUnknown(error, "Auto-initialize failed.");
      logWarn(logger, "ChunkServiceSource auto-initialize failed.", {
        failed,
      });
    });
  } else {
    logDebug(logger, "ChunkServiceSource created without auto-initialize.", {
      projectId,
      worldId,
      apiBaseUrl,
    });
  }

  return source as unknown as ChunkServiceSource;
}

export function createChunkServiceSourceFromBootstrap(
  options: CreateChunkServiceSourceFromBootstrapOptions,
): ChunkServiceSource {
  return createChunkServiceSource({
    client: options.client,
    bootstrap: options.bootstrap,
    logger: options.logger,
    signal: options.signal,
    registry: options.registry,
    editSession: options.editSession,
    maxChunks: options.maxChunks,
    userId: options.userId,
    sessionId: options.sessionId,
    autoInitialize: options.autoInitialize,
  });
}

export function isChunkServiceSource(value: unknown): value is ChunkServiceSource {
  try {
    const record = asRecord(value);

    return (
      record.kind === "chunk-service" &&
      record.serviceKind === CHUNK_SERVICE_SOURCE_KIND &&
      typeof record.loadChunk === "function" &&
      typeof record.setBlock === "function" &&
      typeof record.removeBlock === "function" &&
      typeof record.placeLibraryItem === "function"
    );
  } catch {
    return false;
  }
}

export function getChunkServiceSourceContractDiagnostics(
  value?: unknown,
): Record<string, unknown> {
  try {
    return {
      sourceKind: CHUNK_SERVICE_SOURCE_KIND,
      isChunkServiceSource: isChunkServiceSource(value),
      contract: getEditorInventoryContractMetadata(),
      diagnostics: editorInventoryContractDiagnostics(value),
      rules: editorInventoryContractRules(),
    };
  } catch {
    return {
      sourceKind: CHUNK_SERVICE_SOURCE_KIND,
      error: "chunk-service-source-diagnostics-failed",
    };
  }
}
