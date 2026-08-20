// services/vectoplan-editor/src/frontend/runtime/world/chunk_source.ts
import { chunkApiErrorToDetails } from "@api/chunk_api_errors";
import type {
  ChunkApiBatchChunkRequest,
  ChunkApiBatchResult,
  ChunkApiBlockDefinition,
  ChunkApiBlocksResult,
  ChunkApiChunkCoordinates,
  ChunkApiChunkResult,
  ChunkApiCommandPayload,
  ChunkApiCommandResult,
  ChunkApiFailedResult,
  ChunkApiPlaceableBlockDefinition,
  ChunkApiWorldPosition,
} from "@api/chunk_api_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  ALLOW_CHUNK_PLACEABLE_FALLBACK,
  BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  DEBUG_GRASS_DIRT_ALLOWED,
  EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  createEditorLibraryPlacementContext,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  hasLibraryIdentity as contractHasLibraryIdentity,
  isForbiddenDebugBlockTypeId,
  isValidEditorLibraryPlacementContext,
  mergeContractMetadata,
  normalizeContractInteger,
  normalizeContractText,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId as normalizeContractRuntimeBlockTypeId,
  type EditorInventoryContractPlacementSource,
  type EditorLibraryPlacementInput,
} from "../../contracts/editor_inventory_contract";
import type { RuntimeChunkContent } from "./chunk_content";
import type { ChunkRegistryHandle, ChunkRegistrySnapshot } from "./chunk_registry";

export type ChunkSourceKind =
  | "chunk-service";

export type ChunkSourceLifecycleStatus =
  | "created"
  | "initializing"
  | "ready"
  | "degraded"
  | "failed"
  | "destroying"
  | "destroyed";

export type ChunkSourceCapability =
  | "remote-read"
  | "remote-command"
  | "batch-load"
  | "single-load"
  | "cacheable"
  | "abortable"
  | "dirty-tracking"
  | "reload-dirty"
  | "snapshot-backed"
  | "generated-fallback"
  | "project-scoped"
  | "world-scoped"
  | "persistent"

  /**
   * Legacy/diagnostic capability.
   *
   * This does not mean the source owns productive hotbar inventory.
   */
  | "placeable-blocks-placeholder"
  | "legacy-placeable-blocks-diagnostic"
  | "legacy-block-catalog-diagnostic"

  /**
   * Productive inventory is exposed through the editor proxy route
   * /editor/api/inventory, but it is loaded by SceneRuntime/HotbarController.
   */
  | "editor-inventory"

  /**
   * Preferred semantic placement path for Library/VPLIB items.
   */
  | "library-placement"
  | "vplib-placement"
  | "runtime-block-type-placement"
  | "library-placement-context";

export type ChunkSourceEventType =
  | "lifecycle"
  | "blocks-loaded"
  | "chunk-loaded"
  | "chunks-loaded"
  | "command-sent"
  | "command-result"
  | "dirty-chunks"
  | "error"
  | "destroyed";

export type ChunkSourcePlacementSource =
  | "library"
  | "legacy-block"
  | "remove"
  | "unknown";

export interface ChunkSourcePlacementContext {
  readonly kind: "chunk-source-placement-context.v1";
  readonly source: ChunkSourcePlacementSource;
  readonly runtimeBlockTypeId: string | null;
  readonly blockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly inventoryItemId: string | null;
  readonly inventorySlotIndex: number | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly commandMetadata: Record<string, unknown>;
  readonly valid: boolean;
  readonly invalidReason: string | null;
}

export interface ChunkSourceLibraryPlacementInput extends EditorLibraryPlacementInput {
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
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
  readonly semanticProfile?: Record<string, unknown> | null;
  readonly semanticPlacement?: Readonly<{
    readonly kind: "parcel-grid-prism.v1";
    readonly footprint: Readonly<Record<string, unknown>>;
    readonly occupiedCells: readonly ChunkApiWorldPosition[];
    readonly mergeKey: string;
    readonly anchorPosition?: ChunkApiWorldPosition;
  }> | null;
}

export interface ChunkSourceLifecycleState {
  readonly status: ChunkSourceLifecycleStatus;
  readonly createdAt: string;
  readonly initializedAt: string | null;
  readonly readyAt: string | null;
  readonly failedAt: string | null;
  readonly destroyedAt: string | null;
  readonly lastUpdatedAt: string;
  readonly lastError: ChunkApiFailedResult | null;
}

export interface ChunkSourceMetadata {
  readonly kind: ChunkSourceKind;
  readonly id: string;
  readonly label: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly apiBaseUrl: string;
  readonly sourceKind: string;
  readonly mode: string;
  readonly capabilities: readonly ChunkSourceCapability[];
  readonly localFallbackEnabled: false;
  readonly productiveInventoryRoute: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  readonly ownsHotbarInventory: false;
  readonly legacyChunkBlocksAreInventoryTruth: false;
  readonly browserCallsVectoplanLibraryDirectly: typeof BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY;
}

export interface ChunkSourceSummary {
  readonly metadata: ChunkSourceMetadata;
  readonly lifecycle: ChunkSourceLifecycleState;
  readonly registry: ChunkRegistrySnapshot;
  readonly loadedChunkCount: number;
  readonly visibleChunkCount: number;
  readonly dirtyChunkCount: number;
  readonly failedChunkCount: number;

  /**
   * Legacy/diagnostic count only.
   *
   * Productive hotbar item count belongs to the editor inventory source, not to
   * ChunkSource.
   */
  readonly placeableBlockCount: number;

  readonly lastLoadedChunkKey: string | null;
  readonly lastCommandStatus: string | null;
  readonly lastPlacementContext: ChunkSourcePlacementContext | null;
  readonly lastUpdatedAt: string;
  readonly productiveInventoryRoute: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  readonly ownsHotbarInventory: false;
  readonly legacyChunkBlocksAreInventoryTruth: false;
}

export interface ChunkSourceLoadChunkOptions {
  readonly signal?: AbortSignal;
  readonly markVisible?: boolean;
  readonly forceReload?: boolean;
  readonly contentProfile?: "surface-shell.v1" | "full";
  readonly reason?: string;
}

export interface ChunkSourceLoadChunksOptions extends ChunkSourceLoadChunkOptions {
  readonly preferBatch?: boolean;
  readonly maxBatchChunks?: number;
}

export interface ChunkSourceCommandOptions {
  readonly signal?: AbortSignal;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly correlationId?: string;
  readonly reloadDirtyChunks?: boolean;
  readonly reason?: string;

  /**
   * Library-/VPLIB-aware command context.
   *
   * Ordinary placements use `SetBlock`; raster-adapted parcel bodies use
   * `PlaceObject` with a polygon footprint. In both cases
   * `runtimeBlockTypeId` remains the technical `blockTypeId`.
   */
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
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;

  /**
   * Default: false.
   *
   * Only enable this after the chunk command route explicitly accepts extra
   * library metadata fields in the command payload.
   */
  readonly includeLibraryMetadataInCommand?: boolean;

  /**
   * Default: false for legacy setBlock, true for placeLibraryItem.
   */
  readonly requireLibraryIdentity?: boolean;

  /**
   * Default: false.
   *
   * Legacy block-catalog validation must stay opt-in because Library/VPLIB
   * runtimeBlockTypeIds may not be present in legacy chunk block catalogs.
   */
  readonly validateAgainstLegacyBlockCatalog?: boolean;
}

export interface ChunkSourceDirtyOptions {
  readonly signal?: AbortSignal;
  readonly reason?: string;
  readonly force?: boolean;
}

export interface ChunkSourceInventoryResult {
  /**
   * Legacy/diagnostic block catalog.
   */
  readonly blocks: readonly ChunkApiBlockDefinition[];

  /**
   * Legacy/diagnostic placeable block catalog.
   *
   * Productive hotbar inventory is /editor/api/inventory.
   */
  readonly placeableBlocks: readonly ChunkApiPlaceableBlockDefinition[];

  readonly usedPaletteFallback: boolean;
  readonly result: ChunkApiBlocksResult;
  readonly legacyDiagnosticOnly: true;
  readonly productiveInventoryRoute: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
}

export interface ChunkSourceLoadChunkResult {
  readonly chunk: RuntimeChunkContent;
  readonly result: ChunkApiChunkResult;
  readonly fromCache: boolean;
}

export interface ChunkSourceLoadChunksResult {
  readonly chunks: readonly RuntimeChunkContent[];
  readonly result: ChunkApiBatchResult | null;
  readonly failed: readonly ChunkApiFailedResult[];
  readonly fromCacheCount: number;
}

export interface ChunkSourceCommandResult {
  readonly result: ChunkApiCommandResult;
  readonly reloadedChunks: readonly RuntimeChunkContent[];
  readonly dirtyChunks: readonly string[];
  readonly changedChunks: readonly string[];
  readonly placementContext?: ChunkSourcePlacementContext | unknown | null;
}

export interface ChunkSourceEvent {
  readonly type: ChunkSourceEventType;
  readonly createdAt: string;
  readonly source: ChunkSourceMetadata;
  readonly payload: unknown;
}

export interface ChunkSourceLifecycleEventPayload {
  readonly lifecycle: ChunkSourceLifecycleState;
  readonly reason: string | null;
}

export interface ChunkSourceBlocksLoadedEventPayload {
  /**
   * Legacy/diagnostic block list.
   */
  readonly blocks: readonly ChunkApiBlockDefinition[];

  /**
   * Legacy/diagnostic placeable block list.
   */
  readonly placeableBlocks: readonly ChunkApiPlaceableBlockDefinition[];

  readonly usedPaletteFallback: boolean;
  readonly legacyDiagnosticOnly: true;
  readonly productiveInventoryRoute: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
}

export interface ChunkSourceChunkLoadedEventPayload {
  readonly chunk: RuntimeChunkContent;
  readonly fromCache: boolean;
}

export interface ChunkSourceChunksLoadedEventPayload {
  readonly chunks: readonly RuntimeChunkContent[];
  readonly fromCacheCount: number;
  readonly failed: readonly ChunkApiFailedResult[];
}

export interface ChunkSourceCommandSentEventPayload {
  readonly command: ChunkApiCommandPayload;
  readonly correlationId?: string;
  readonly placementContext?: ChunkSourcePlacementContext | unknown | null;
  readonly reason: string | null;
}

export interface ChunkSourceCommandResultEventPayload {
  readonly result: ChunkSourceCommandResult;
  readonly command?: ChunkApiCommandPayload;
  readonly placementContext?: ChunkSourcePlacementContext | unknown | null;
  readonly dirtyChunks?: readonly string[];
  readonly changedChunks?: readonly string[];
  readonly reason: string | null;
}

export interface ChunkSourceDirtyChunksEventPayload {
  readonly dirtyChunkKeys: readonly string[];
  readonly reason: string | null;
}

export interface ChunkSourceErrorEventPayload {
  readonly error: ChunkApiFailedResult;
  readonly reason: string | null;
}

export type ChunkSourceEventListener = (event: ChunkSourceEvent) => void;

export type ChunkSourceUnsubscribe = () => void;

export interface ChunkSource {
  readonly kind: ChunkSourceKind;
  readonly capabilities: readonly ChunkSourceCapability[];

  initialize(options?: { readonly signal?: AbortSignal }): Promise<void>;

  getMetadata(): ChunkSourceMetadata;
  getLifecycleState(): ChunkSourceLifecycleState;
  getSummary(): ChunkSourceSummary;
  getRegistry(): ChunkRegistryHandle;

  /**
   * Legacy-/diagnostic path.
   *
   * Productive editor inventory comes from /editor/api/inventory.
   */
  loadPlaceableBlocks(options?: { readonly signal?: AbortSignal; readonly force?: boolean }): Promise<ChunkSourceInventoryResult | ChunkApiFailedResult>;

  /**
   * Legacy-/diagnostic path.
   *
   * Productive editor inventory comes from /editor/api/inventory.
   */
  loadBlocks(options?: { readonly signal?: AbortSignal; readonly force?: boolean }): Promise<ChunkSourceInventoryResult | ChunkApiFailedResult>;

  loadChunk(
    coordinates: ChunkApiChunkCoordinates,
    options?: ChunkSourceLoadChunkOptions,
  ): Promise<ChunkSourceLoadChunkResult | ChunkApiFailedResult>;

  loadChunks(
    chunks: readonly ChunkApiBatchChunkRequest[],
    options?: ChunkSourceLoadChunksOptions,
  ): Promise<ChunkSourceLoadChunksResult | ChunkApiFailedResult>;

  getChunk(chunkKey: string): RuntimeChunkContent | null;
  getLoadedChunkKeys(): readonly string[];
  getVisibleChunkKeys(): readonly string[];

  sendCommand(
    command: ChunkApiCommandPayload,
    options?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult>;

  /**
   * Legacy-compatible SetBlock path.
   *
   * For Library/VPLIB items, `blockTypeId` must already be the technical
   * `runtimeBlockTypeId`. Prefer `placeLibraryItem(...)`.
   */
  setBlock(
    position: ChunkApiWorldPosition,
    blockTypeId: string,
    options?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult>;

  /**
   * Semantic Library/VPLIB placement path.
   *
   * Implementations send `SetBlock` for a normal voxel or `PlaceObject` when
   * `semanticPlacement` supplies a parcel-grid polygon.
   */
  placeLibraryItem(
    position: ChunkApiWorldPosition,
    placement: ChunkSourceLibraryPlacementInput,
    options?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult>;

  removeBlock(
    position: ChunkApiWorldPosition,
    options?: ChunkSourceCommandOptions,
  ): Promise<ChunkSourceCommandResult | ChunkApiFailedResult>;

  markChunkDirty(chunkKey: string, reason?: string): readonly string[];
  markChunksDirty(chunkKeys: readonly string[], reason?: string): readonly string[];
  getDirtyChunkKeys(): readonly string[];
  clearDirtyChunks(chunkKeys?: readonly string[], reason?: string): readonly string[];

  reloadDirtyChunks(options?: ChunkSourceDirtyOptions): Promise<readonly RuntimeChunkContent[] | ChunkApiFailedResult>;
  requestFullRefresh(options?: ChunkSourceDirtyOptions): Promise<readonly RuntimeChunkContent[] | ChunkApiFailedResult>;

  invalidateChunk(chunkKey: string, reason?: string): boolean;
  invalidateAll(reason?: string): void;

  subscribe(listener: ChunkSourceEventListener): ChunkSourceUnsubscribe;

  destroy(reason?: string): Promise<void> | void;
}

export const CHUNK_SOURCE_PLACEMENT_CONTEXT_KIND = "chunk-source-placement-context.v1" as const;

export const PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE = PRODUCTIVE_EDITOR_INVENTORY_ROUTE;

export const DEFAULT_CHUNK_SOURCE_CAPABILITIES: readonly ChunkSourceCapability[] = [
  "remote-read",
  "remote-command",
  "batch-load",
  "single-load",
  "cacheable",
  "abortable",
  "dirty-tracking",
  "reload-dirty",
  "snapshot-backed",
  "generated-fallback",
  "project-scoped",
  "world-scoped",
  "persistent",
  "placeable-blocks-placeholder",
  "legacy-placeable-blocks-diagnostic",
  "legacy-block-catalog-diagnostic",
  "editor-inventory",
  "library-placement",
  "vplib-placement",
  "runtime-block-type-placement",
  "library-placement-context",
];

const MAX_CHUNK_SOURCE_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string>();
const NULLABLE_TEXT_CACHE = new Map<string, string | null>();
const INTEGER_CACHE = new Map<string, number>();
const METADATA_CACHE = new WeakMap<object, Record<string, unknown>>();

function setCachedValue<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
): V {
  try {
    if (cache.size > MAX_CHUNK_SOURCE_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearChunkSourceCaches(): void {
  try {
    TEXT_CACHE.clear();
    NULLABLE_TEXT_CACHE.clear();
    INTEGER_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function safeString(value: unknown, fallback: string): string {
  try {
    if (typeof value === "string") {
      const cached = TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached || fallback;
      }

      const normalized = normalizeContractText(value, fallback);
      return setCachedValue(TEXT_CACHE, value, normalized);
    }

    return normalizeContractText(value, fallback);
  } catch {
    return fallback;
  }
}

function safeNullableString(value: unknown): string | null {
  try {
    if (typeof value === "string") {
      const cached = NULLABLE_TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached;
      }

      return setCachedValue(NULLABLE_TEXT_CACHE, value, normalizeOptionalContractText(value));
    }

    return normalizeOptionalContractText(value);
  } catch {
    return null;
  }
}

function safeIntegerOrNull(value: unknown): number | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    const key = String(value);
    const cached = INTEGER_CACHE.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const parsed = normalizeContractInteger(value, Number.NaN);

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return setCachedValue(INTEGER_CACHE, key, Math.trunc(parsed));
  } catch {
    return null;
  }
}

function safeMetadata(value: unknown): Record<string, unknown> {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const cached = METADATA_CACHE.get(value);

    if (cached) {
      return cached;
    }

    const record = value as Record<string, unknown>;
    METADATA_CACHE.set(value, record);
    return record;
  } catch {
    return {};
  }
}

function safeCapabilities(value: unknown): readonly ChunkSourceCapability[] {
  try {
    if (!Array.isArray(value)) {
      return DEFAULT_CHUNK_SOURCE_CAPABILITIES;
    }

    const valid = value.filter((capability): capability is ChunkSourceCapability => (
      typeof capability === "string"
      && DEFAULT_CHUNK_SOURCE_CAPABILITIES.includes(capability as ChunkSourceCapability)
    ));

    return valid.length > 0 ? [...new Set(valid)] : DEFAULT_CHUNK_SOURCE_CAPABILITIES;
  } catch {
    return DEFAULT_CHUNK_SOURCE_CAPABILITIES;
  }
}

function isForbiddenDebugRuntimeBlockTypeId(value: unknown): boolean {
  return isForbiddenDebugBlockTypeId(value);
}

function normalizeRuntimeBlockTypeId(value: unknown): string | null {
  return normalizeContractRuntimeBlockTypeId(value);
}

function commandStringField(command: EditorInventoryPlacementCommand | null | undefined, key: string): string | null {
  try {
    if (!command || typeof command !== "object") {
      return null;
    }

    return safeNullableString((command as unknown as Record<string, unknown>)[key]);
  } catch {
    return null;
  }
}

function hasLibraryIdentity(input: {
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly libraryItemId?: string | null;
  readonly familyId?: string | null;
  readonly vplibUid?: string | null;
}): boolean {
  return contractHasLibraryIdentity(input);
}

function normalizePlacementSource(value: unknown): ChunkSourcePlacementSource {
  try {
    const normalized = safeString(value, "unknown");

    if (
      normalized === "library"
      || normalized === "legacy-block"
      || normalized === "remove"
      || normalized === "unknown"
    ) {
      return normalized;
    }

    if (normalized === "vplib" || normalized === "editor-inventory") {
      return "library";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function contractPlacementSource(source: ChunkSourcePlacementSource): EditorInventoryContractPlacementSource {
  switch (source) {
    case "library":
      return "library";
    case "legacy-block":
      return "legacy-block";
    case "remove":
      return "remove";
    case "unknown":
    default:
      return "unknown";
  }
}

function isChunkApiFailedResultLike(value: unknown): value is ChunkApiFailedResult {
  try {
    return Boolean(value)
      && typeof value === "object"
      && (value as { ok?: unknown }).ok === false
      && "error" in value;
  } catch {
    return false;
  }
}

function emptyRegistrySnapshot(): ChunkRegistrySnapshot {
  return {
    kind: "chunk-registry-snapshot.v1",
    chunkKeys: [],
    visibleChunkKeys: [],
    dirtyChunkKeys: [],
    failedChunkKeys: [],
    entries: [],
    stats: {
      chunkCount: 0,
      visibleChunkCount: 0,
      dirtyChunkCount: 0,
      failedChunkCount: 0,
      cellCount: 0,
      nonAirCellCount: 0,
      maxChunks: 0,
      lastUpdatedAt: null,
      solidCellCount: 0,
      nonSolidCellCount: 0,
    },
  };
}

export function isChunkSource(value: unknown): value is ChunkSource {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const source = value as Partial<ChunkSource>;

    return (
      source.kind === "chunk-service"
      && typeof source.initialize === "function"
      && typeof source.loadChunk === "function"
      && typeof source.loadChunks === "function"
      && typeof source.setBlock === "function"
      && typeof source.placeLibraryItem === "function"
      && typeof source.removeBlock === "function"
      && typeof source.getRegistry === "function"
    );
  } catch {
    return false;
  }
}

export function isChunkServiceSource(value: unknown): value is ChunkSource {
  return isChunkSource(value) && value.kind === "chunk-service";
}

export function hasChunkSourceCapability(
  source: Pick<ChunkSource, "capabilities">,
  capability: ChunkSourceCapability,
): boolean {
  try {
    return source.capabilities.includes(capability);
  } catch {
    return false;
  }
}

export function requireChunkSourceCapability(
  source: Pick<ChunkSource, "capabilities">,
  capability: ChunkSourceCapability,
): void {
  if (!hasChunkSourceCapability(source, capability)) {
    throw new Error(`Chunk source does not support capability '${capability}'.`);
  }
}

export function createChunkSourceFailedResult(input: {
  readonly error: ChunkApiFailedResult | Error | unknown;
  readonly fallbackMessage?: string;
  readonly source?: ChunkApiFailedResult["source"];
  readonly raw?: unknown;
  readonly details?: Record<string, unknown> | null;
}): ChunkApiFailedResult {
  if (isChunkApiFailedResultLike(input.error)) {
    return input.error;
  }

  const details = chunkApiErrorToDetails(input.error);

  return {
    ok: false,
    request: null,
    source: input.source ?? "unknown",
    raw: input.raw ?? input.error,
    error: {
      ...details,
      message: details.message || input.fallbackMessage || "Chunk source operation failed.",
      retryable: details.retryable ?? true,
      details: {
        ...(details.details ?? {}),
        ...(input.details ?? {}),
        productiveInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
        legacyChunkBlocksAreDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
        browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
        debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
        allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
        emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
        forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      },
    },
  };
}

export function createChunkSourceLifecycleState(
  status: ChunkSourceLifecycleStatus = "created",
): ChunkSourceLifecycleState {
  const now = nowIsoStringSafe();

  return {
    status,
    createdAt: now,
    initializedAt: status === "initializing" || status === "ready" ? now : null,
    readyAt: status === "ready" ? now : null,
    failedAt: status === "failed" ? now : null,
    destroyedAt: status === "destroyed" ? now : null,
    lastUpdatedAt: now,
    lastError: null,
  };
}

export function updateChunkSourceLifecycleState(
  previous: ChunkSourceLifecycleState,
  status: ChunkSourceLifecycleStatus,
  error?: ChunkApiFailedResult | null,
): ChunkSourceLifecycleState {
  const now = nowIsoStringSafe();

  return {
    ...previous,
    status,
    initializedAt:
      status === "initializing" || status === "ready"
        ? previous.initializedAt ?? now
        : previous.initializedAt,
    readyAt: status === "ready" ? previous.readyAt ?? now : previous.readyAt,
    failedAt: status === "failed" ? now : previous.failedAt,
    destroyedAt: status === "destroyed" ? previous.destroyedAt ?? now : previous.destroyedAt,
    lastUpdatedAt: now,
    lastError: error === undefined ? previous.lastError : error,
  };
}

export function createChunkSourceMetadata(input: {
  readonly id: string;
  readonly label?: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly apiBaseUrl: string;
  readonly sourceKind?: string;
  readonly mode?: string;
  readonly capabilities?: readonly ChunkSourceCapability[];
}): ChunkSourceMetadata {
  return {
    kind: "chunk-service",
    id: safeString(input.id, "chunk-service-source"),
    label: safeString(input.label, "Chunk Service Source"),
    projectId: safeString(input.projectId, "dev-project"),
    worldId: safeString(input.worldId, "world_spawn"),
    apiBaseUrl: safeString(input.apiBaseUrl, "/editor/api/chunk"),
    sourceKind: safeString(input.sourceKind, "vectoplan-chunk"),
    mode: safeString(input.mode, "editor-proxy"),
    capabilities: safeCapabilities(input.capabilities),
    localFallbackEnabled: false,
    productiveInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
    ownsHotbarInventory: false,
    legacyChunkBlocksAreInventoryTruth: false,
    browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  };
}

export function createChunkSourceEvent(input: {
  readonly type: ChunkSourceEventType;
  readonly source: ChunkSourceMetadata;
  readonly payload?: unknown;
  readonly createdAt?: string;
}): ChunkSourceEvent {
  return {
    type: input.type,
    createdAt: input.createdAt ?? nowIsoStringSafe(),
    source: input.source,
    payload: input.payload ?? null,
  };
}

export function notifyChunkSourceListeners(
  listeners: Iterable<ChunkSourceEventListener>,
  event: ChunkSourceEvent,
): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Listener failure must not break source state.
    }
  }
}

export function createChunkSourcePlacementContext(input: {
  readonly source?: ChunkSourcePlacementContext["source"];
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
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
  readonly requireLibraryIdentity?: boolean;
}): ChunkSourcePlacementContext {
  const source = normalizePlacementSource(input.source);
  const commandRuntimeBlockTypeId = normalizeRuntimeBlockTypeId(
    commandStringField(input.placementCommand, "runtimeBlockTypeId")
      ?? commandStringField(input.placementCommand, "runtime_block_type_id")
      ?? commandStringField(input.placementCommand, "blockTypeId")
      ?? commandStringField(input.placementCommand, "block_type_id"),
  );

  const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
    input.runtimeBlockTypeId
      ?? input.blockTypeId
      ?? commandRuntimeBlockTypeId,
  );

  const contractContext = createEditorLibraryPlacementContext({
    source: contractPlacementSource(source),
    runtimeBlockTypeId,
    blockTypeId: input.blockTypeId ?? runtimeBlockTypeId,
    libraryItemId: input.libraryItemId ?? input.libraryRef?.libraryItemId ?? null,
    inventoryItemId: input.inventoryItemId ?? null,
    inventorySlotIndex: input.inventorySlotIndex ?? null,
    familyId: input.familyId ?? input.libraryRef?.familyId ?? null,
    packageId: input.packageId ?? input.libraryRef?.packageId ?? null,
    vplibUid: input.vplibUid ?? input.libraryRef?.vplibUid ?? null,
    variantId: input.variantId ?? input.libraryRef?.variantId ?? "default",
    revisionHash: input.revisionHash ?? input.libraryRef?.revisionHash ?? null,
    objectKind: input.objectKind ?? input.libraryRef?.objectKind ?? null,
    libraryRef: input.libraryRef ?? null,
    placementCommand: input.placementCommand ?? null,
    commandMetadata: mergeContractMetadata(input.commandMetadata, {
      chunkSourcePlacementSource: source,
      productiveInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
    }),
    requireLibraryIdentity: input.requireLibraryIdentity ?? source === "library",
  });

  return {
    kind: CHUNK_SOURCE_PLACEMENT_CONTEXT_KIND,
    source,
    runtimeBlockTypeId: contractContext.runtimeBlockTypeId,
    blockTypeId: contractContext.blockTypeId ?? contractContext.runtimeBlockTypeId,
    libraryItemId: contractContext.libraryItemId,
    inventoryItemId: contractContext.inventoryItemId,
    inventorySlotIndex: safeIntegerOrNull(contractContext.inventorySlotIndex),
    familyId: contractContext.familyId,
    packageId: contractContext.packageId,
    vplibUid: contractContext.vplibUid,
    variantId: contractContext.variantId,
    revisionHash: contractContext.revisionHash,
    objectKind: contractContext.objectKind,
    libraryRef: contractContext.libraryRef,
    placementCommand: contractContext.placementCommand,
    commandMetadata: contractContext.commandMetadata,
    valid: source === "remove" ? true : isValidEditorLibraryPlacementContext(contractContext),
    invalidReason: source === "remove" ? null : contractContext.invalidReason,
  };
}

export function createChunkSourcePlacementContextFromLibraryInput(
  placement: ChunkSourceLibraryPlacementInput,
  options?: ChunkSourceCommandOptions,
): ChunkSourcePlacementContext {
  return createChunkSourcePlacementContext({
    source: "library",
    runtimeBlockTypeId: placement.runtimeBlockTypeId ?? options?.runtimeBlockTypeId ?? placement.blockTypeId ?? options?.blockTypeId ?? null,
    blockTypeId: placement.blockTypeId ?? options?.blockTypeId ?? placement.runtimeBlockTypeId ?? options?.runtimeBlockTypeId ?? null,
    libraryItemId: placement.libraryItemId ?? options?.libraryItemId ?? null,
    inventoryItemId: placement.inventoryItemId ?? options?.inventoryItemId ?? null,
    inventorySlotIndex: placement.inventorySlotIndex ?? options?.inventorySlotIndex ?? null,
    familyId: placement.familyId ?? options?.familyId ?? null,
    packageId: placement.packageId ?? options?.packageId ?? null,
    vplibUid: placement.vplibUid ?? options?.vplibUid ?? null,
    variantId: placement.variantId ?? options?.variantId ?? "default",
    revisionHash: placement.revisionHash ?? options?.revisionHash ?? null,
    objectKind: placement.objectKind ?? options?.objectKind ?? null,
    libraryRef: placement.libraryRef ?? options?.libraryRef ?? null,
    placementCommand: placement.placementCommand ?? options?.placementCommand ?? null,
    commandMetadata: mergeContractMetadata(options?.commandMetadata, placement.commandMetadata),
    requireLibraryIdentity: options?.requireLibraryIdentity ?? true,
  });
}

export function createChunkSourcePlacementContextFromSetBlock(
  blockTypeId: string,
  options?: ChunkSourceCommandOptions,
): ChunkSourcePlacementContext {
  return createChunkSourcePlacementContext({
    source: options?.requireLibraryIdentity ? "library" : "legacy-block",
    runtimeBlockTypeId: options?.runtimeBlockTypeId ?? blockTypeId,
    blockTypeId: options?.blockTypeId ?? blockTypeId,
    libraryItemId: options?.libraryItemId ?? null,
    inventoryItemId: options?.inventoryItemId ?? null,
    inventorySlotIndex: options?.inventorySlotIndex ?? null,
    familyId: options?.familyId ?? null,
    packageId: options?.packageId ?? null,
    vplibUid: options?.vplibUid ?? null,
    variantId: options?.variantId ?? "default",
    revisionHash: options?.revisionHash ?? null,
    objectKind: options?.objectKind ?? null,
    libraryRef: options?.libraryRef ?? null,
    placementCommand: options?.placementCommand ?? null,
    commandMetadata: options?.commandMetadata ?? null,
    requireLibraryIdentity: options?.requireLibraryIdentity ?? false,
  });
}

export function createChunkSourcePlacementContextForRemove(
  options?: ChunkSourceCommandOptions,
): ChunkSourcePlacementContext {
  return createChunkSourcePlacementContext({
    source: "remove",
    runtimeBlockTypeId: null,
    blockTypeId: null,
    libraryItemId: options?.libraryItemId ?? null,
    inventoryItemId: options?.inventoryItemId ?? null,
    inventorySlotIndex: options?.inventorySlotIndex ?? null,
    familyId: options?.familyId ?? null,
    packageId: options?.packageId ?? null,
    vplibUid: options?.vplibUid ?? null,
    variantId: options?.variantId ?? null,
    revisionHash: options?.revisionHash ?? null,
    objectKind: options?.objectKind ?? null,
    libraryRef: options?.libraryRef ?? null,
    placementCommand: options?.placementCommand ?? null,
    commandMetadata: options?.commandMetadata ?? null,
    requireLibraryIdentity: false,
  });
}

export function assertValidChunkSourcePlacementContext(context: ChunkSourcePlacementContext): void {
  if (!context.valid) {
    throw new Error(`Invalid chunk source placement context: ${context.invalidReason ?? "unknown"}.`);
  }

  if (context.source === "library" && !context.runtimeBlockTypeId) {
    throw new Error("Library placement requires runtimeBlockTypeId.");
  }

  if (context.source === "library" && !hasLibraryIdentity(context)) {
    throw new Error("Library placement requires library identity.");
  }

  if (context.runtimeBlockTypeId && isForbiddenDebugRuntimeBlockTypeId(context.runtimeBlockTypeId)) {
    throw new Error(`Forbidden debug runtime block type '${context.runtimeBlockTypeId}' cannot be placed.`);
  }
}

export function createLegacyDiagnosticInventoryResult(
  result: ChunkApiBlocksResult,
): ChunkSourceInventoryResult {
  return {
    blocks: result.blocks.filter((block) => !isForbiddenDebugRuntimeBlockTypeId(block.blockTypeId)),
    placeableBlocks: result.placeableBlocks.filter((block) => !isForbiddenDebugRuntimeBlockTypeId(block.blockTypeId)),
    usedPaletteFallback: result.usedPaletteFallback,
    result,
    legacyDiagnosticOnly: true,
    productiveInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
  };
}

export function createChunkSourceSummary(input: {
  readonly metadata: ChunkSourceMetadata;
  readonly lifecycle: ChunkSourceLifecycleState;
  readonly registry: ChunkRegistryHandle;
  readonly placeableBlockCount?: number;
  readonly lastLoadedChunkKey?: string | null;
  readonly lastCommandStatus?: string | null;
  readonly lastPlacementContext?: ChunkSourcePlacementContext | null;
}): ChunkSourceSummary {
  let registrySnapshot: ChunkRegistrySnapshot;

  try {
    registrySnapshot = input.registry.getSnapshot();
  } catch {
    registrySnapshot = emptyRegistrySnapshot();
  }

  return {
    metadata: input.metadata,
    lifecycle: input.lifecycle,
    registry: registrySnapshot,
    loadedChunkCount: registrySnapshot.stats.chunkCount,
    visibleChunkCount: registrySnapshot.stats.visibleChunkCount,
    dirtyChunkCount: registrySnapshot.stats.dirtyChunkCount,
    failedChunkCount: registrySnapshot.stats.failedChunkCount,
    placeableBlockCount: input.placeableBlockCount ?? 0,
    lastLoadedChunkKey: input.lastLoadedChunkKey ?? null,
    lastCommandStatus: input.lastCommandStatus ?? null,
    lastPlacementContext: input.lastPlacementContext ?? null,
    lastUpdatedAt: nowIsoStringSafe(),
    productiveInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
    ownsHotbarInventory: false,
    legacyChunkBlocksAreInventoryTruth: false,
  };
}

export function chunkSourceSummaryToDebug(summary: ChunkSourceSummary): Record<string, unknown> {
  return {
    kind: summary.metadata.kind,
    id: summary.metadata.id,
    label: summary.metadata.label,
    projectId: summary.metadata.projectId,
    worldId: summary.metadata.worldId,
    apiBaseUrl: summary.metadata.apiBaseUrl,
    sourceKind: summary.metadata.sourceKind,
    mode: summary.metadata.mode,
    capabilities: summary.metadata.capabilities,
    lifecycleStatus: summary.lifecycle.status,
    loadedChunkCount: summary.loadedChunkCount,
    visibleChunkCount: summary.visibleChunkCount,
    dirtyChunkCount: summary.dirtyChunkCount,
    failedChunkCount: summary.failedChunkCount,
    placeableBlockCount: summary.placeableBlockCount,
    lastLoadedChunkKey: summary.lastLoadedChunkKey,
    lastCommandStatus: summary.lastCommandStatus,
    lastPlacementContext: summary.lastPlacementContext,
    lastUpdatedAt: summary.lastUpdatedAt,
    productiveInventoryRoute: summary.productiveInventoryRoute,
    ownsHotbarInventory: summary.ownsHotbarInventory,
    legacyChunkBlocksAreInventoryTruth: summary.legacyChunkBlocksAreInventoryTruth,
    contract: editorInventoryContractDiagnostics(summary.lastPlacementContext),
    rules: {
      ...editorInventoryContractRules(),
      primaryInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      legacyPlaceableBlocksAreNotInventoryTruth: true,
      supportsLibraryPlacement: summary.metadata.capabilities.includes("library-placement"),
      supportsVplibPlacement: summary.metadata.capabilities.includes("vplib-placement"),
      setBlockUsesRuntimeBlockTypeId: true,
      debugGrassDirtAllowed: false,
    },
  };
}

export function getChunkSourceMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.runtime.world.chunk_source",
    supportsLibraryPlacement: true,
    supportsVplibPlacement: true,
    supportsRuntimeBlockTypePlacement: true,
    supportsLibraryPlacementContext: true,
    primaryInventoryRoute: PRODUCTIVE_CHUNK_SOURCE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    capabilities: [...DEFAULT_CHUNK_SOURCE_CAPABILITIES],
    contract: getEditorInventoryContractMetadata(),
    rules: {
      ...editorInventoryContractRules(),
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      legacyPlaceableBlocksAreNotInventoryTruth: true,
      legacyBlockCatalogIsDiagnosticOnly: true,
      setBlockStillSupportedForLegacyRuntime: true,
      placeLibraryItemIsPreferredForVplib: true,
      placeLibraryItemRequiresLibraryIdentity: true,
      chunkSourcePlacementContextUsesCentralContract: true,
      debugGrassDirtBlocked: true,
    },
  };
}
