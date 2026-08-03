// services/vectoplan-editor/src/frontend/inventory/chunk_inventory_source.ts
import type {
  ChunkApiBlocksResult,
  ChunkApiClient,
  ChunkApiFailedResult,
} from "@api/chunk_api_models";
import { isChunkApiFailedResult } from "@api/chunk_api_models";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError } from "@utils/safe";
import {
  inventoryCatalogContainsForbiddenDebugBlocks,
  inventoryCatalogToDebugSummary,
  isInventoryCatalog,
  updateInventorySelection,
  type InventoryCatalog,
  type InventoryDebugSummary,
  type InventorySelectionOptions,
} from "./inventory_models";
import {
  createFallbackInventorySlotFactoryResult,
  createInventorySlotFactoryResultFromBlocksResult,
  inventorySlotFactoryResultToDebugSummary,
  type InventorySlotFactoryResult,
} from "./inventory_slot_factory";
import {
  ALLOW_CHUNK_PLACEABLE_FALLBACK,
  BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  DEBUG_GRASS_DIRT_ALLOWED,
  DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
  EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  asEditorInventoryContractRecord,
  clearEditorInventoryContractCaches,
  containsForbiddenDebugBlockTypeId,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  normalizeContractBoolean,
  normalizeContractInteger,
  normalizeContractSlotIndex,
  normalizeInventorySourceLoadOptions,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId,
  type EditorHotbarInventorySourceHandle,
  type EditorInventorySelectionOptions,
  type EditorInventorySourceLoadOptions,
} from "../contracts/editor_inventory_contract";

export type ChunkInventorySourceStatus =
  | "created"
  | "loading"
  | "ready"
  | "degraded"
  | "failed"
  | "disabled"
  | "destroyed";

export interface ChunkInventorySourceOptions {
  readonly client: ChunkApiClient;
  readonly logger?: EditorLogger;
  readonly projectId: string;
  readonly worldId: string;
  readonly slotCount?: number;

  /**
   * Legacy only.
   *
   * This value must not default to debug_grass/debug_dirt. If provided and it is
   * forbidden, it is ignored.
   */
  readonly defaultBlockTypeId?: string | null;

  readonly signal?: AbortSignal;

  /**
   * Default: false.
   *
   * Chunk-derived inventory is no longer the productive hotbar truth. The active
   * editor inventory must come from /editor/api/inventory. This source can still
   * be enabled explicitly for diagnostics/backwards compatibility.
   */
  readonly allowLegacyChunkInventory?: boolean;

  /**
   * Default: true.
   *
   * When legacy chunk inventory is disabled, load() returns an empty fallback
   * catalog instead of calling the chunk block route.
   */
  readonly returnEmptyFallbackWhenDisabled?: boolean;
}

export type ChunkInventoryLoadOptions = EditorInventorySourceLoadOptions;

export interface ChunkInventorySourceSnapshot {
  readonly kind: "chunk-inventory-source-snapshot.v1";
  readonly status: ChunkInventorySourceStatus;
  readonly projectId: string;
  readonly worldId: string;
  readonly catalog: InventoryDebugSummary | null;
  readonly factoryResult: Record<string, unknown> | null;
  readonly lastError: ChunkApiFailedResult | null;
  readonly loadCount: number;
  readonly reloadCount: number;
  readonly selectionCount: number;
  readonly failureCount: number;
  readonly blockedLoadCount: number;
  readonly destroyed: boolean;

  /**
   * Backend contract diagnostics only:
   * - inventoryBlockCount comes from result.placeableBlocks.
   * - creativeBlockCount comes from result.blocks.
   *
   * Productive hotbar inventory must use /editor/api/inventory.
   */
  readonly inventoryBlockCount: number;
  readonly creativeBlockCount: number;
  readonly totalBlockCount: number;
  readonly hasInventoryPayload: boolean;
  readonly hasCreativeLibraryPayload: boolean;
  readonly lastLoadedAt: string | null;
  readonly lastReason: string | null;

  readonly legacyChunkInventoryAllowed: boolean;
  readonly legacyDiagnosticOnly: true;
  readonly productiveInventoryRoute: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  readonly usedAsProductiveInventory: false;
  readonly ownsHotbarInventory: false;
  readonly legacyChunkBlocksAreInventoryTruth: false;
  readonly browserCallsVectoplanLibraryDirectly: typeof BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY;
  readonly onlyLibraryItemsPlaceable: typeof ONLY_LIBRARY_ITEMS_PLACEABLE;
  readonly debugGrassDirtAllowed: typeof DEBUG_GRASS_DIRT_ALLOWED;
  readonly allowChunkPlaceableFallback: typeof ALLOW_CHUNK_PLACEABLE_FALLBACK;
  readonly emptyFallbackCreatesPlaceableItems: typeof EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS;
  readonly forbiddenDebugBlockTypeIds: readonly string[];
}

export interface ChunkInventorySourceHandle extends EditorHotbarInventorySourceHandle {
  readonly kind: "vectoplan-editor-chunk-inventory-source.v1";

  load(options?: ChunkInventoryLoadOptions): Promise<InventoryCatalog | ChunkApiFailedResult>;
  reload(options?: ChunkInventoryLoadOptions): Promise<InventoryCatalog | ChunkApiFailedResult>;

  /**
   * Legacy selection capability.
   *
   * This source intentionally does not implement selectSlot(). The productive
   * LibraryInventorySource does. HotbarController must treat selectSlot as an
   * optional capability through the central contract guards.
   */
  select(options: EditorInventorySelectionOptions): InventoryCatalog | null;

  getStatus(): ChunkInventorySourceStatus;
  getCatalog(): InventoryCatalog | null;
  getLastBlocksResult(): ChunkApiBlocksResult | null;
  getLastFactoryResult(): InventorySlotFactoryResult | null;
  getSnapshot(): ChunkInventorySourceSnapshot;

  destroy(reason?: string): void;
}

const CHUNK_INVENTORY_SOURCE_KIND =
  "vectoplan-editor-chunk-inventory-source.v1" as const;
const CHUNK_INVENTORY_SOURCE_SNAPSHOT_KIND =
  "chunk-inventory-source-snapshot.v1" as const;

const DEFAULT_SLOT_COUNT: number = DEFAULT_EDITOR_INVENTORY_SLOT_COUNT;
const PRODUCTIVE_INVENTORY_ROUTE = PRODUCTIVE_EDITOR_INVENTORY_ROUTE;

const MAX_CHUNK_INVENTORY_SOURCE_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string>();
const NULLABLE_TEXT_CACHE = new Map<string, string | null>();
const INTEGER_CACHE = new Map<string, number>();
const ERROR_RECORD_CACHE = new Map<string, Record<string, unknown>>();
const FAILED_RESULT_CACHE = new Map<string, ChunkApiFailedResult>();

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_CHUNK_INVENTORY_SOURCE_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearChunkInventorySourceCaches(): void {
  try {
    TEXT_CACHE.clear();
    NULLABLE_TEXT_CACHE.clear();
    INTEGER_CACHE.clear();
    ERROR_RECORD_CACHE.clear();
    FAILED_RESULT_CACHE.clear();
    clearEditorInventoryContractCaches();
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

function safeString(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "string") {
      const cached = TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached || fallback;
      }

      const trimmed = value.trim();
      return setCachedValue(
        TEXT_CACHE,
        value,
        trimmed.length > 0 ? trimmed : fallback,
      );
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const converted = String(value).trim();
      return converted.length > 0 ? converted : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function safeNullableString(
  value: unknown,
  fallback: string | null = null,
): string | null {
  try {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === "string") {
      const cached = NULLABLE_TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached ?? fallback;
      }

      const trimmed = value.trim();
      return setCachedValue(
        NULLABLE_TEXT_CACHE,
        value,
        trimmed.length > 0 ? trimmed : fallback,
      );
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const converted = String(value).trim();
      return converted.length > 0 ? converted : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function safeInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    const cacheKey = `${String(value)}|${fallback}|${min}|${max}`;
    const cached = INTEGER_CACHE.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const normalized = normalizeContractInteger(value, fallback, min, max);
    return setCachedValue(INTEGER_CACHE, cacheKey, normalized);
  } catch {
    return fallback;
  }
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  try {
    return normalizeContractBoolean(value, fallback);
  } catch {
    return fallback;
  }
}

function normalizeSlotCount(value: unknown): number {
  return safeInteger(value, DEFAULT_SLOT_COUNT, 1, 64);
}

function normalizeSelectedSlot(
  value: unknown,
  slotCount: number,
  fallback = 0,
): number {
  try {
    return normalizeContractSlotIndex(value, slotCount, fallback);
  } catch {
    return safeInteger(value, fallback, 0, Math.max(0, slotCount - 1));
  }
}

function normalizeLegacyBlockTypeId(value: unknown): string | null {
  return normalizeRuntimeBlockTypeId(value);
}

function unknownRecord(value: unknown): Record<string, unknown> {
  return asEditorInventoryContractRecord(value);
}

function unknownArray(value: unknown): readonly unknown[] {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function hotbarSlotTextField(slot: unknown, key: string): string | null {
  try {
    return safeNullableString(unknownRecord(slot)[key], null);
  } catch {
    return null;
  }
}

function hotbarSlotItemTextField(slot: unknown, key: string): string | null {
  try {
    return safeNullableString(unknownRecord(unknownRecord(slot).item)[key], null);
  } catch {
    return null;
  }
}

function hotbarSlotObjectKind(slot: unknown): string | null {
  try {
    return (
      hotbarSlotTextField(slot, "objectKind") ??
      hotbarSlotTextField(slot, "object_kind") ??
      hotbarSlotItemTextField(slot, "objectKind") ??
      hotbarSlotItemTextField(slot, "object_kind")
    );
  } catch {
    return null;
  }
}

function hotbarSlotRuntimeBlockTypeId(slot: unknown): string | null {
  try {
    const record = unknownRecord(slot);
    const item = unknownRecord(record.item);

    return normalizeRuntimeBlockTypeId(
      record.runtimeBlockTypeId ??
        record.blockTypeId ??
        item.runtimeBlockTypeId ??
        item.blockTypeId,
    );
  } catch {
    return null;
  }
}

function hotbarSlotBlockTypeId(slot: unknown): string | null {
  try {
    const record = unknownRecord(slot);
    const item = unknownRecord(record.item);

    return normalizeRuntimeBlockTypeId(
      record.blockTypeId ??
        record.runtimeBlockTypeId ??
        item.blockTypeId ??
        item.runtimeBlockTypeId,
    );
  } catch {
    return null;
  }
}

function hotbarSlotNumberField(
  slot: unknown,
  key: string,
  fallback: number,
): number {
  try {
    return safeInteger(unknownRecord(slot)[key], fallback, 0, 999);
  } catch {
    return fallback;
  }
}

function hotbarSlotBooleanField(
  slot: unknown,
  key: string,
  fallback: boolean,
): boolean {
  try {
    return safeBoolean(unknownRecord(slot)[key], fallback);
  } catch {
    return fallback;
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
    // Inventory logging must never break runtime.
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
    // Inventory logging must never break runtime.
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
    // Inventory logging must never break runtime.
  }
}

function requestSignal(
  loadOptions: ChunkInventoryLoadOptions | undefined,
  sourceSignal: AbortSignal | undefined,
): AbortSignal | undefined {
  return loadOptions?.signal ?? sourceSignal;
}

function normalizeErrorRecord(error: unknown): Record<string, unknown> {
  try {
    const cacheKey =
      error instanceof Error
        ? `${error.name}:${error.message}:${error.stack ?? ""}`
        : typeof error === "string"
          ? error
          : JSON.stringify(error);

    const cached = ERROR_RECORD_CACHE.get(cacheKey);
    if (cached) {
      return cached;
    }

    const normalized = normalizeUnknownError(error);

    if (
      normalized &&
      typeof normalized === "object" &&
      !Array.isArray(normalized)
    ) {
      return setCachedValue(
        ERROR_RECORD_CACHE,
        cacheKey,
        normalized as Record<string, unknown>,
      );
    }

    return setCachedValue(ERROR_RECORD_CACHE, cacheKey, {
      name: "UnknownError",
      message: String(normalized),
    });
  } catch {
    try {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
        };
      }

      return {
        name: "UnknownError",
        message: String(error),
      };
    } catch {
      return {
        name: "UnknownError",
        message: "Unknown chunk inventory source error.",
      };
    }
  }
}

function createFailedFromError(
  error: unknown,
  fallbackMessage = "Chunk inventory source failed.",
): ChunkApiFailedResult {
  if (
    error &&
    typeof error === "object" &&
    "ok" in error &&
    (error as { ok?: unknown }).ok === false
  ) {
    return error as ChunkApiFailedResult;
  }

  const normalized = normalizeErrorRecord(error);
  const message = safeString(normalized.message, fallbackMessage);
  const cacheKey = `${safeString(
    normalized.name,
    "ChunkInventorySourceError",
  )}:${message}`;

  const cached = FAILED_RESULT_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  return setCachedValue(FAILED_RESULT_CACHE, cacheKey, {
    ok: false,
    request: null,
    source: "client-fallback",
    raw: error,
    error: {
      code: safeString(normalized.code, "chunk_inventory_source_error"),
      message,
      retryable: true,
      statusCode: null,
      requestId: null,
      requestKind: null,
      url: null,
      method: null,
      exceptionType: safeNullableString(
        normalized.name,
        "ChunkInventorySourceError",
      ),
      details: {
        ...((normalized.details as Record<string, unknown> | null | undefined) ??
          {}),
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        legacyChunkInventoryIsDiagnosticOnly:
          LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
        browserCallsVectoplanLibraryDirectly:
          BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
        debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
        allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
        forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      },
    },
  });
}

function createDisabledFailedResult(reason: string): ChunkApiFailedResult {
  return createFailedFromError(new Error(reason), reason);
}

function normalizeLoadOptions(
  loadOptions?: ChunkInventoryLoadOptions,
): ChunkInventoryLoadOptions {
  try {
    return normalizeInventorySourceLoadOptions(loadOptions);
  } catch {
    return {};
  }
}

function selectedSlotFromLoadOptions(
  loadOptions: ChunkInventoryLoadOptions | undefined,
  fallback: number,
  slotCount: number,
): number {
  try {
    const normalized = normalizeLoadOptions(loadOptions);

    return normalizeSelectedSlot(
      normalized.selectedSlotIndex ?? normalized.selectedSlot,
      slotCount,
      fallback,
    );
  } catch {
    return normalizeSelectedSlot(
      loadOptions?.selectedSlotIndex ?? loadOptions?.selectedSlot,
      slotCount,
      fallback,
    );
  }
}

function selectionFromContractOptions(
  selection: EditorInventorySelectionOptions,
): InventorySelectionOptions {
  try {
    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      selection.runtimeBlockTypeId ?? selection.blockTypeId,
    );

    return {
      selectedSlot: selection.selectedSlot,
      selectedSlotIndex: selection.selectedSlotIndex,
      blockTypeId: runtimeBlockTypeId,
      runtimeBlockTypeId,
      assetTypeId: normalizeOptionalContractText(selection.assetTypeId),
      libraryItemId: normalizeOptionalContractText(selection.libraryItemId),
      inventoryItemId: normalizeOptionalContractText(selection.inventoryItemId),
      inventorySlotIndex: selection.inventorySlotIndex ?? null,
      familyId: normalizeOptionalContractText(selection.familyId),
      packageId: normalizeOptionalContractText(selection.packageId),
      vplibUid: normalizeOptionalContractText(selection.vplibUid),
      variantId: normalizeOptionalContractText(selection.variantId),
      revisionHash: normalizeOptionalContractText(selection.revisionHash),
      objectKind: normalizeOptionalContractText(selection.objectKind),
      preferEnabled: selection.preferEnabled ?? true,
    };
  } catch {
    return {
      preferEnabled: true,
    };
  }
}

/**
 * Legacy diagnostics path.
 *
 * The hotbar catalog intentionally uses placeableBlocks first when this path is
 * explicitly enabled. Productive runtime must use /editor/api/inventory instead.
 */
function resultToFactoryResult(
  result: ChunkApiBlocksResult,
  input: {
    readonly slotCount: number;
    readonly selectedSlot: number;
    readonly defaultBlockTypeId: string | null;
  },
): InventorySlotFactoryResult {
  return createInventorySlotFactoryResultFromBlocksResult(result, {
    slotCount: input.slotCount,
    selectedSlot: input.selectedSlot,
    selectedSlotIndex: input.selectedSlot,
    blockTypeId: input.defaultBlockTypeId,
    runtimeBlockTypeId: input.defaultBlockTypeId,
    allowDisabledBlocks: false,
    allowChunkBlocks: true,
    projectId: result.projectId,
    worldId: result.worldId,
  });
}

function fallbackFactoryResult(input: {
  readonly projectId: string;
  readonly worldId: string;
  readonly slotCount: number;
  readonly selectedSlot: number;
  readonly reason: string;
}): InventorySlotFactoryResult {
  return createFallbackInventorySlotFactoryResult({
    projectId: input.projectId,
    worldId: input.worldId,
    slotCount: input.slotCount,
    selectedSlot: input.selectedSlot,
    selectedSlotIndex: input.selectedSlot,
    fallbackReason: input.reason,
  });
}

function inventoryBlockCountFromResult(result: ChunkApiBlocksResult | null): number {
  try {
    return result?.placeableBlocks?.length ?? 0;
  } catch {
    return 0;
  }
}

function creativeBlockCountFromResult(result: ChunkApiBlocksResult | null): number {
  try {
    return result?.blocks?.length ?? 0;
  } catch {
    return 0;
  }
}

function statusFromCatalog(catalog: InventoryCatalog): ChunkInventorySourceStatus {
  try {
    if (catalog.status === "ready") {
      return "ready";
    }

    if (catalog.status === "degraded" || catalog.status === "fallback") {
      return "degraded";
    }

    if (catalog.status === "failed" || catalog.status === "error") {
      return "failed";
    }

    if (catalog.status === "empty" || catalog.sourceKind === "empty-fallback") {
      return "disabled";
    }

    return "degraded";
  } catch {
    return "degraded";
  }
}

function catalogHasForbiddenDebugBlockIds(catalog: InventoryCatalog | null): boolean {
  if (!catalog) {
    return false;
  }

  try {
    if (inventoryCatalogContainsForbiddenDebugBlocks(catalog)) {
      return true;
    }
  } catch {
    // Fall through to contract-level scan.
  }

  return containsForbiddenDebugBlockTypeId(catalog);
}

function sanitizeCatalog(
  catalog: InventoryCatalog,
  input: {
    readonly projectId: string;
    readonly worldId: string;
    readonly slotCount: number;
    readonly selectedSlot: number;
    readonly reason: string;
  },
): InventorySlotFactoryResult | null {
  if (!catalogHasForbiddenDebugBlockIds(catalog) && isInventoryCatalog(catalog)) {
    return null;
  }

  return fallbackFactoryResult({
    projectId: input.projectId,
    worldId: input.worldId,
    slotCount: input.slotCount,
    selectedSlot: input.selectedSlot,
    reason: input.reason,
  });
}

function domSlotFromHotbarSlot(slot: unknown): InventorySlotFactoryResult["domSlots"][number] {
  const record = unknownRecord(slot);
  const item = unknownRecord(record.item);
  const slotIndex = hotbarSlotNumberField(slot, "slot", 0);
  const label =
    safeNullableString(record.label, null) ??
    safeNullableString(item.label, null) ??
    safeNullableString(item.name, null) ??
    `Slot ${slotIndex + 1}`;

  const runtimeBlockTypeId = hotbarSlotRuntimeBlockTypeId(slot);
  const blockTypeId = hotbarSlotBlockTypeId(slot) ?? runtimeBlockTypeId;

  return {
    slot: slotIndex,
    label,
    blockTypeId,
    runtimeBlockTypeId,
    libraryItemId:
      hotbarSlotTextField(slot, "libraryItemId") ??
      hotbarSlotItemTextField(slot, "libraryItemId"),
    familyId:
      hotbarSlotTextField(slot, "familyId") ??
      hotbarSlotItemTextField(slot, "familyId"),
    packageId:
      hotbarSlotTextField(slot, "packageId") ??
      hotbarSlotItemTextField(slot, "packageId"),
    vplibUid:
      hotbarSlotTextField(slot, "vplibUid") ??
      hotbarSlotItemTextField(slot, "vplibUid"),
    variantId:
      hotbarSlotTextField(slot, "variantId") ??
      hotbarSlotItemTextField(slot, "variantId"),
    revisionHash:
      hotbarSlotTextField(slot, "revisionHash") ??
      hotbarSlotItemTextField(slot, "revisionHash"),
    objectKind: hotbarSlotObjectKind(slot),
    color:
      hotbarSlotTextField(slot, "color") ??
      hotbarSlotItemTextField(slot, "color"),
    selected: hotbarSlotBooleanField(slot, "selected", false),
    enabled: hotbarSlotBooleanField(slot, "enabled", false),
    sourceKind: safeString(record.sourceKind, "chunk-service") as InventorySlotFactoryResult["domSlots"][number]["sourceKind"],
    itemKind: safeString(item.kind, "empty") as InventorySlotFactoryResult["domSlots"][number]["itemKind"],
  };
}

function factoryResultWithSelection(
  previous: InventorySlotFactoryResult,
  catalog: InventoryCatalog,
): InventorySlotFactoryResult {
  return {
    ...previous,
    catalog,
    hotbarSlots: catalog.hotbarSlots,
    domSlots: catalog.hotbarSlots.map((slot) => domSlotFromHotbarSlot(slot)),
    debug: inventoryCatalogToDebugSummary(catalog),
    selectedSlot: catalog.selection.selectedSlot,
    selectedSlotIndex: catalog.selection.selectedSlotIndex,
    selectedBlockTypeId:
      catalog.selection.selectedRuntimeBlockTypeId ??
      catalog.selection.selectedBlockTypeId,
    selectedRuntimeBlockTypeId:
      catalog.selection.selectedRuntimeBlockTypeId ??
      catalog.selection.selectedBlockTypeId,
    selectedLibraryItemId:
      catalog.selection.selectedPlacementRef?.libraryItemId ??
      previous.selectedLibraryItemId,
    selectedFamilyId:
      catalog.selection.selectedPlacementRef?.familyId ??
      previous.selectedFamilyId,
    selectedPackageId:
      catalog.selection.selectedPlacementRef?.packageId ??
      previous.selectedPackageId,
    selectedVplibUid:
      catalog.selection.selectedPlacementRef?.vplibUid ??
      previous.selectedVplibUid,
    selectedVariantId:
      catalog.selection.selectedPlacementRef?.variantId ??
      previous.selectedVariantId,
    selectedRevisionHash:
      catalog.selection.selectedPlacementRef?.revisionHash ??
      previous.selectedRevisionHash,
    selectedObjectKind:
      catalog.selection.selectedPlacementRef?.objectKind ??
      previous.selectedObjectKind,
    selectedLibraryRef:
      catalog.selection.selectedLibraryRef ?? previous.selectedLibraryRef,
    selectedPlacementCommand:
      catalog.selection.selectedPlacementCommand ?? previous.selectedPlacementCommand,
    hasPlaceableItems: catalog.placeableItems.length > 0,
    hasPlaceableLibraryItems: catalog.libraryItems.some((item) => item.enabled),
    createdAt: nowIsoStringSafe(),
  };
}

export function createChunkInventorySource(
  options: ChunkInventorySourceOptions,
): ChunkInventorySourceHandle {
  const client = options.client;
  const logger = options.logger;
  const projectId = safeString(options.projectId, "dev-project");
  const worldId = safeString(options.worldId, "world_spawn");
  const slotCount = normalizeSlotCount(options.slotCount);
  const defaultBlockTypeId = normalizeLegacyBlockTypeId(options.defaultBlockTypeId);
  const legacyChunkInventoryAllowed = safeBoolean(
    options.allowLegacyChunkInventory,
    false,
  );
  const returnEmptyFallbackWhenDisabled = safeBoolean(
    options.returnEmptyFallbackWhenDisabled,
    true,
  );

  let status: ChunkInventorySourceStatus = "created";
  let destroyed = false;
  let catalog: InventoryCatalog | null = null;
  let lastFactoryResult: InventorySlotFactoryResult | null = null;
  let lastBlocksResult: ChunkApiBlocksResult | null = null;
  let lastError: ChunkApiFailedResult | null = null;
  let loadCount = 0;
  let reloadCount = 0;
  let selectionCount = 0;
  let failureCount = 0;
  let blockedLoadCount = 0;
  let lastLoadedAt: string | null = null;
  let lastReason: string | null = null;

  function assertAlive(): ChunkApiFailedResult | null {
    if (!destroyed && status !== "destroyed") {
      return null;
    }

    return createFailedFromError(new Error("ChunkInventorySource is destroyed."));
  }

  function setStatus(nextStatus: ChunkInventorySourceStatus): void {
    status = nextStatus;
  }

  function applyCatalog(
    nextCatalog: InventoryCatalog,
    factoryResult: InventorySlotFactoryResult | null,
  ): InventoryCatalog {
    catalog = nextCatalog;
    lastFactoryResult = factoryResult;
    lastLoadedAt = nowIsoStringSafe();
    setStatus(statusFromCatalog(nextCatalog));

    return nextCatalog;
  }

  function createEmptyFallbackCatalog(
    reason: string,
    selectedSlot: number,
  ): InventoryCatalog {
    const factoryResult = fallbackFactoryResult({
      projectId,
      worldId,
      slotCount,
      selectedSlot,
      reason,
    });

    applyCatalog(factoryResult.catalog, factoryResult);
    setStatus("disabled");

    return factoryResult.catalog;
  }

  function legacyAllowedForLoad(loadOptions?: ChunkInventoryLoadOptions): boolean {
    const normalized = normalizeLoadOptions(loadOptions);

    return (
      legacyChunkInventoryAllowed === true ||
      normalized.allowLegacyChunkInventory === true
    );
  }

  function select(selection: EditorInventorySelectionOptions): InventoryCatalog | null {
    if (!catalog) {
      return null;
    }

    try {
      const normalizedSelection = selectionFromContractOptions(selection);
      const runtimeBlockTypeId = normalizeLegacyBlockTypeId(
        normalizedSelection.runtimeBlockTypeId ?? normalizedSelection.blockTypeId,
      );

      const nextSelection: InventorySelectionOptions = {
        ...normalizedSelection,
        blockTypeId: runtimeBlockTypeId,
        runtimeBlockTypeId,
        preferEnabled: normalizedSelection.preferEnabled ?? true,
      };

      catalog = updateInventorySelection(catalog, nextSelection);
      selectionCount += 1;

      if (catalogHasForbiddenDebugBlockIds(catalog)) {
        const selectedSlot = normalizeSelectedSlot(
          catalog.selection.selectedSlotIndex,
          slotCount,
        );
        const factoryResult = fallbackFactoryResult({
          projectId,
          worldId,
          slotCount,
          selectedSlot,
          reason:
            "Forbidden debug block ids were detected after chunk inventory selection.",
        });

        catalog = factoryResult.catalog;
        lastFactoryResult = factoryResult;
        setStatus("degraded");
        return catalog;
      }

      if (lastFactoryResult) {
        lastFactoryResult = factoryResultWithSelection(lastFactoryResult, catalog);
      }

      logDebug(logger, "Legacy chunk inventory selection changed.", {
        selectedSlot: catalog.selection.selectedSlot,
        selectedSlotIndex: catalog.selection.selectedSlotIndex,
        selectedBlockTypeId:
          catalog.selection.selectedRuntimeBlockTypeId ??
          catalog.selection.selectedBlockTypeId,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        usedAsProductiveInventory: false,
      });

      return catalog;
    } catch (error) {
      lastError = createFailedFromError(error);
      failureCount += 1;
      setStatus("degraded");

      logWarn(logger, "Legacy chunk inventory selection failed.", {
        error: lastError.error,
      });

      return catalog;
    }
  }

  async function load(
    loadOptions?: ChunkInventoryLoadOptions,
  ): Promise<InventoryCatalog | ChunkApiFailedResult> {
    const aliveFailure = assertAlive();

    if (aliveFailure) {
      return aliveFailure;
    }

    const normalizedLoadOptions = normalizeLoadOptions(loadOptions);
    const force =
      normalizedLoadOptions.force === true ||
      normalizedLoadOptions.forceRefresh === true;
    const selectedSlot = selectedSlotFromLoadOptions(
      normalizedLoadOptions,
      catalog?.selection.selectedSlotIndex ?? catalog?.selection.selectedSlot ?? 0,
      slotCount,
    );
    const requestedBlockTypeId = normalizeLegacyBlockTypeId(
      normalizedLoadOptions.runtimeBlockTypeId ??
        normalizedLoadOptions.blockTypeId ??
        defaultBlockTypeId,
    );

    lastReason = normalizedLoadOptions.reason ?? null;

    if (!legacyAllowedForLoad(normalizedLoadOptions)) {
      blockedLoadCount += 1;

      const reason = `Legacy chunk inventory source is disabled. Productive hotbar inventory uses ${PRODUCTIVE_INVENTORY_ROUTE}.`;

      logDebug(logger, "Legacy chunk inventory load blocked.", {
        reason: normalizedLoadOptions.reason ?? null,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        selectedSlot,
        usedAsProductiveInventory: false,
      });

      if (returnEmptyFallbackWhenDisabled) {
        return createEmptyFallbackCatalog(reason, selectedSlot);
      }

      lastError = createDisabledFailedResult(reason);
      setStatus("disabled");
      return lastError;
    }

    if (catalog && force !== true) {
      if (
        normalizedLoadOptions.blockTypeId !== undefined ||
        normalizedLoadOptions.runtimeBlockTypeId !== undefined ||
        normalizedLoadOptions.selectedSlot !== undefined ||
        normalizedLoadOptions.selectedSlotIndex !== undefined
      ) {
        return (
          select({
            blockTypeId: requestedBlockTypeId,
            runtimeBlockTypeId: requestedBlockTypeId,
            selectedSlot,
            selectedSlotIndex: selectedSlot,
            preferEnabled: true,
          }) ?? catalog
        );
      }

      return catalog;
    }

    setStatus("loading");

    try {
      const result = await client.loadBlocks({
        signal: requestSignal(normalizedLoadOptions, options.signal),
      });

      if (isChunkApiFailedResult(result)) {
        lastError = result;
        failureCount += 1;

        if (normalizedLoadOptions.allowStaticFallback !== false) {
          const factoryResult = fallbackFactoryResult({
            projectId,
            worldId,
            slotCount,
            selectedSlot,
            reason: result.error.message,
          });

          applyCatalog(factoryResult.catalog, factoryResult);
          setStatus("degraded");

          logWarn(
            logger,
            "Legacy chunk inventory block loading failed. Empty fallback catalog was used.",
            {
              error: result.error,
              reason: normalizedLoadOptions.reason ?? null,
              productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
            },
          );

          return factoryResult.catalog;
        }

        setStatus("failed");
        return result;
      }

      lastBlocksResult = result;

      const factoryResult = resultToFactoryResult(result, {
        slotCount,
        selectedSlot,
        defaultBlockTypeId: requestedBlockTypeId,
      });

      const sanitized = sanitizeCatalog(factoryResult.catalog, {
        projectId,
        worldId,
        slotCount,
        selectedSlot,
        reason: "Legacy chunk inventory contained forbidden debug block ids.",
      });

      loadCount += 1;
      lastError = null;

      const appliedFactoryResult = sanitized ?? factoryResult;
      const nextCatalog = applyCatalog(
        appliedFactoryResult.catalog,
        appliedFactoryResult,
      );

      if (sanitized) {
        setStatus("degraded");
        logWarn(
          logger,
          "Legacy chunk inventory catalog was replaced by empty fallback because forbidden debug block ids were detected.",
          {
            forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
            productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          },
        );
      }

      logInfo(logger, "Legacy chunk inventory loaded for diagnostics.", {
        projectId,
        worldId,
        status,
        itemCount: nextCatalog.items.length,
        blockItemCount: nextCatalog.blockItems.length,
        sourceKind: nextCatalog.sourceKind,
        usedPaletteFallback: nextCatalog.usedPaletteFallback,
        inventoryBlockCount: inventoryBlockCountFromResult(result),
        creativeBlockCount: creativeBlockCountFromResult(result),
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        usedAsProductiveInventory: false,
        legacyDiagnosticOnly: true,
      });

      return nextCatalog;
    } catch (error) {
      const failed = createFailedFromError(error);
      lastError = failed;
      failureCount += 1;

      if (normalizedLoadOptions.allowStaticFallback !== false) {
        const factoryResult = fallbackFactoryResult({
          projectId,
          worldId,
          slotCount,
          selectedSlot,
          reason: failed.error.message,
        });

        applyCatalog(factoryResult.catalog, factoryResult);
        setStatus("degraded");

        logWarn(
          logger,
          "Legacy chunk inventory loading raised an exception. Empty fallback catalog was used.",
          {
            error: failed.error,
            reason: normalizedLoadOptions.reason ?? null,
            productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          },
        );

        return factoryResult.catalog;
      }

      setStatus("failed");
      return failed;
    }
  }

  const handle: ChunkInventorySourceHandle = {
    kind: CHUNK_INVENTORY_SOURCE_KIND,

    load,

    async reload(
      loadOptions?: ChunkInventoryLoadOptions,
    ): Promise<InventoryCatalog | ChunkApiFailedResult> {
      reloadCount += 1;

      return load({
        ...loadOptions,
        force: true,
        forceRefresh: true,
      });
    },

    select,

    getStatus(): ChunkInventorySourceStatus {
      return status;
    },

    getCatalog(): InventoryCatalog | null {
      return catalog;
    },

    getLastBlocksResult(): ChunkApiBlocksResult | null {
      return lastBlocksResult;
    },

    getLastFactoryResult(): InventorySlotFactoryResult | null {
      return lastFactoryResult;
    },

    getSnapshot(): ChunkInventorySourceSnapshot {
      const inventoryBlockCount = inventoryBlockCountFromResult(lastBlocksResult);
      const creativeBlockCount = creativeBlockCountFromResult(lastBlocksResult);

      return {
        kind: CHUNK_INVENTORY_SOURCE_SNAPSHOT_KIND,
        status,
        projectId,
        worldId,
        catalog: catalog ? inventoryCatalogToDebugSummary(catalog) : null,
        factoryResult: lastFactoryResult
          ? inventorySlotFactoryResultToDebugSummary(lastFactoryResult)
          : null,
        lastError,
        loadCount,
        reloadCount,
        selectionCount,
        failureCount,
        blockedLoadCount,
        destroyed,
        inventoryBlockCount,
        creativeBlockCount,
        totalBlockCount: Math.max(inventoryBlockCount, creativeBlockCount),
        hasInventoryPayload: inventoryBlockCount > 0,
        hasCreativeLibraryPayload: creativeBlockCount > 0,
        lastLoadedAt,
        lastReason,
        legacyChunkInventoryAllowed,
        legacyDiagnosticOnly: true,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        usedAsProductiveInventory: false,
        ownsHotbarInventory: false,
        legacyChunkBlocksAreInventoryTruth: false,
        browserCallsVectoplanLibraryDirectly:
          BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
        debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
        allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
        emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
        forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      };
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      setStatus("destroyed");

      logDebug(logger, "Legacy chunk inventory source destroyed.", {
        reason: reason ?? null,
        loadCount,
        reloadCount,
        selectionCount,
        failureCount,
        blockedLoadCount,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      });
    },
  };

  logDebug(logger, "Legacy chunk inventory source created.", {
    projectId,
    worldId,
    slotCount,
    defaultBlockTypeId,
    legacyChunkInventoryAllowed,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    usedAsProductiveInventory: false,
    legacyDiagnosticOnly: true,
    forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  });

  return handle;
}

export function isChunkInventorySourceHandle(
  value: unknown,
): value is ChunkInventorySourceHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<ChunkInventorySourceHandle>;

    return (
      record.kind === CHUNK_INVENTORY_SOURCE_KIND &&
      typeof record.load === "function" &&
      typeof record.reload === "function" &&
      typeof record.select === "function" &&
      typeof record.getSnapshot === "function" &&
      typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}

export function getChunkInventorySourceMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.inventory.chunk_inventory_source",
    sourceKind: CHUNK_INVENTORY_SOURCE_KIND,
    snapshotKind: CHUNK_INVENTORY_SOURCE_SNAPSHOT_KIND,
    legacyOnly: true,
    usedAsProductiveInventory: false,
    ownsHotbarInventory: false,
    legacyChunkBlocksAreInventoryTruth: false,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    contract: getEditorInventoryContractMetadata(),
    diagnostics: editorInventoryContractDiagnostics({
      sourceKind: "chunk-service",
      runtimeBlockTypeId: null,
      legacyDiagnosticOnly: true,
    }),
    rules: {
      ...editorInventoryContractRules(),
      chunkInventoryDisabledByDefault: true,
      loadRequiresExplicitAllowLegacyChunkInventory: true,
      debugGrassDirtDefaultRemoved: true,
      emptyFallbackCreatesNoPlaceableLibraryItems: true,
      factorySelectionDomSlotsIncludeObjectKind: true,
      hotbarSlotObjectKindReadDefensively: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      legacyChunkInventoryIsDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
      emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
    },
  };
}