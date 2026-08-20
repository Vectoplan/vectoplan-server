// services/vectoplan-editor/src/frontend/inventory/hotbar_controller.ts
import type { ChunkApiFailedResult } from "@api/chunk_api_models";
import type {
  EditorInventoryLoadResult,
  EditorInventoryPayload,
  EditorInventoryState,
} from "@api/editor_inventory_models";
import {
  renderDomHotbarSlots,
  setDomHotbarVisibility,
  setDomInventoryPanelText,
  setDomLiveMessage,
  type EditorDomRefs,
  type HotbarSlotRenderInput,
} from "@dom/dom_refs";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { LibraryInventorySourceSnapshot } from "./library_inventory_source";
import {
  type HotbarSlot,
  type InventoryAssetItem,
  type InventoryBlockItem,
  type InventoryCatalog,
  type InventoryItem,
  type InventoryLibraryItem,
  type InventorySelectionOptions,
  inventoryCatalogContainsForbiddenDebugBlocks,
  isInventoryCatalog,
  isLibraryInventoryCatalog,
} from "./inventory_models";
import {
  createFallbackInventorySlotFactoryResult,
  createInventorySlotFactoryResultFromCatalog,
  createInventorySlotFactoryResultFromEditorInventoryLoadResult,
  createInventorySlotFactoryResultFromEditorInventoryPayload,
  createInventorySlotFactoryResultFromEditorInventoryState,
  updateInventorySlotFactorySelection,
  type InventorySlotFactoryResult,
} from "./inventory_slot_factory";
import { normalizeWheelInventoryDirection } from "./inventory_selection";
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
  createEditorInventoryRuntimePlaceable,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  hasInventoryClearCache,
  hasInventoryDestroy,
  hasInventoryRefresh,
  hasInventorySelect,
  hasInventorySelectSlot,
  hasSelectedRuntimePlaceable,
  isEditorInventoryRuntimePlaceable,
  normalizeContractBoolean,
  normalizeContractInteger,
  normalizeContractSlotIndex,
  normalizeContractText,
  normalizeInventorySourceLoadOptions,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId,
  type EditorHotbarInventorySourceHandle,
  type EditorInventoryRuntimePlaceable,
  type EditorInventorySelectionOptions,
  type EditorInventorySourceLoadOptions,
} from "../contracts/editor_inventory_contract";

export type HotbarControllerStatus =
  | "created"
  | "loading"
  | "ready"
  | "empty"
  | "degraded"
  | "failed"
  | "destroyed";

export type HotbarControllerLoadReason =
  | "hotbar-initialize"
  | "hotbar-load"
  | "hotbar-reload"
  | "hotbar-refresh"
  | "hotbar-load-failed"
  | "hotbar-load-exception"
  | "hotbar-controller-destroy"
  | string;

export type HotbarInventorySourceHandle = EditorHotbarInventorySourceHandle;

export interface HotbarControllerOptions {
  readonly inventorySource: HotbarInventorySourceHandle;
  readonly store: EditorStore;
  readonly domRefs: EditorDomRefs;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
  readonly slotCount?: number;
  readonly enableKeyboardShortcuts?: boolean;
  readonly enableWheelSelection?: boolean;
  readonly enableSlotClickSelection?: boolean;
  readonly defaultSelectedSlot?: number;
  readonly renderToDom?: boolean;

  /**
   * Legacy-Name. Wird weiterhin akzeptiert, aber nicht mehr auf debug_grass
   * defaulted.
   */
  readonly defaultBlockTypeId?: string | null;

  readonly defaultRuntimeBlockTypeId?: string | null;
  readonly defaultLibraryItemId?: string | null;
  readonly defaultFamilyId?: string | null;
  readonly defaultPackageId?: string | null;
  readonly defaultVplibUid?: string | null;
  readonly defaultVariantId?: string | null;
  readonly defaultRevisionHash?: string | null;
  readonly defaultObjectKind?: string | null;

  /**
   * Standard: false.
   * Chunk-Inventar darf nur noch bewusst als Legacy-/Debug-Pfad verwendet werden.
   */
  readonly allowLegacyChunkInventory?: boolean;

  /**
   * Standard: true.
   * Der Controller akzeptiert nur Library-/VPLIB-Items als placebare Auswahl.
   */
  readonly onlyLibraryItemsPlaceable?: boolean;

  /**
   * Standard: true.
   * Leere Library-Fallbacks sind erlaubt, erzeugen aber keine placebaren Items.
   */
  readonly allowEmptyFallback?: boolean;

  /**
   * Standard: true.
   * Wenn true, wird bei destroy() auch die Inventory-Source zerstört, falls sie
   * eine destroy-Methode besitzt.
   */
  readonly destroyInventorySourceOnDestroy?: boolean;
}

export interface HotbarSelectionApplyOptions {
  readonly dispatch?: boolean;
  readonly render?: boolean;
}

export interface HotbarControllerSnapshot {
  readonly kind: "hotbar-controller-snapshot.v1";
  readonly status: HotbarControllerStatus;
  readonly selectedSlot: number;
  readonly selectedSlotIndex: number;
  readonly selectedBlockTypeId: string | null;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedPackageId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedVariantId: string | null;
  readonly selectedRevisionHash: string | null;
  readonly selectedObjectKind: string | null;
  readonly itemCount: number;
  readonly libraryItemCount: number;
  readonly blockItemCount: number;
  readonly assetItemCount: number;
  readonly hotbarSlotCount: number;
  readonly sourceKind: string | null;
  readonly usedPaletteFallback: boolean;
  readonly usedFallback: boolean;
  readonly hasPlaceableItems: boolean;
  readonly hasPlaceableLibraryItems: boolean;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly allowLegacyChunkInventory: boolean;
  readonly loadedAt: string | null;
  readonly updatedAt: string | null;
  readonly lastError: ChunkApiFailedResult | null;
  readonly destroyed: boolean;
  readonly initializeCount: number;
  readonly loadCount: number;
  readonly reloadCount: number;
  readonly selectionCount: number;
  readonly renderCount: number;
  readonly blockedSelectionCount: number;
  readonly lastReason: string | null;
  readonly productiveInventoryRoute: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  readonly browserCallsVectoplanLibraryDirectly: typeof BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY;
  readonly debugGrassDirtAllowed: typeof DEBUG_GRASS_DIRT_ALLOWED;
}

export interface HotbarControllerHandle {
  readonly kind: "vectoplan-editor-hotbar-controller.v1";

  initialize(): Promise<InventoryCatalog | ChunkApiFailedResult>;
  load(options?: {
    readonly force?: boolean;
    readonly reason?: string;
    readonly silent?: boolean;
  }): Promise<InventoryCatalog | ChunkApiFailedResult>;
  reload(reason?: string): Promise<InventoryCatalog | ChunkApiFailedResult>;
  refresh(reason?: string): Promise<InventoryCatalog | ChunkApiFailedResult>;

  selectSlot(
    slot: number,
    reason?: string,
    options?: HotbarSelectionApplyOptions,
  ): InventoryCatalog | null;

  /**
   * Legacy-Name. Wählt jetzt primär nach runtimeBlockTypeId.
   */
  selectBlockType(blockTypeId: string, reason?: string): InventoryCatalog | null;

  selectRuntimeBlockType(runtimeBlockTypeId: string, reason?: string): InventoryCatalog | null;
  selectLibraryItem(libraryItemId: string, reason?: string): InventoryCatalog | null;
  selectFamily(familyId: string, reason?: string): InventoryCatalog | null;
  selectVplib(vplibUid: string, reason?: string): InventoryCatalog | null;

  selectNext(reason?: string): InventoryCatalog | null;
  selectPrevious(reason?: string): InventoryCatalog | null;

  getStatus(): HotbarControllerStatus;
  getCatalog(): InventoryCatalog | null;
  getSelectedItem(): InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem | null;
  getSelectedLibraryItem(): InventoryLibraryItem | null;
  getSelectedBlockItem(): InventoryBlockItem | null;
  getSelectedRuntimeBlockTypeId(): string | null;
  getSelectedRuntimePlaceable(): EditorInventoryRuntimePlaceable | null;
  getSnapshot(): HotbarControllerSnapshot;

  render(): void;
  clearCache(): void;
  destroy(reason?: string): void;
}

type AnyRecord = Record<string, unknown>;

const HOTBAR_CONTROLLER_KIND = "vectoplan-editor-hotbar-controller.v1" as const;
const HOTBAR_CONTROLLER_SNAPSHOT_KIND = "hotbar-controller-snapshot.v1" as const;

/**
 * Keep this broad. Upstream constants may be literal typed as 9; runtime
 * controller logic must accept dynamic hotbar sizes.
 */
const DEFAULT_SLOT_COUNT: number = Number(DEFAULT_EDITOR_INVENTORY_SLOT_COUNT) || 9;
const PRODUCTIVE_INVENTORY_ROUTE = PRODUCTIVE_EDITOR_INVENTORY_ROUTE;

const MAX_HOTBAR_CONTROLLER_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string | null>();
const INTEGER_CACHE = new Map<string, number>();
const ERROR_RECORD_CACHE = new Map<string, Record<string, unknown>>();
const FAILED_RESULT_CACHE = new Map<string, ChunkApiFailedResult>();

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_HOTBAR_CONTROLLER_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearHotbarControllerCaches(): void {
  try {
    TEXT_CACHE.clear();
    INTEGER_CACHE.clear();
    ERROR_RECORD_CACHE.clear();
    FAILED_RESULT_CACHE.clear();
    clearEditorInventoryContractCaches();
  } catch {
    // Cache clearing must never break runtime.
  }
}

export function isSilentHotbarReloadReason(reason?: string): boolean {
  return reason?.startsWith("library-user-inventory-frame") ?? false;
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

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Hotbar logging must never break runtime.
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
    // Hotbar logging must never break runtime.
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
    // Hotbar logging must never break runtime.
  }
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
        message: "Unknown hotbar controller error.",
      };
    }
  }
}

function nullableString(value: unknown): string | null {
  try {
    if (typeof value === "string") {
      const cached = TEXT_CACHE.get(value);
      if (cached !== undefined) {
        return cached;
      }

      const normalized = normalizeOptionalContractText(value);
      return setCachedValue(TEXT_CACHE, value, normalized);
    }

    return normalizeOptionalContractText(value);
  } catch {
    return null;
  }
}

function boolValue(value: unknown, fallback = false): boolean {
  try {
    return normalizeContractBoolean(value, fallback);
  } catch {
    return fallback;
  }
}

function intValue(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  try {
    const cacheKey = `${String(value)}|${fallback}|${minimum}|${maximum}`;
    const cached = INTEGER_CACHE.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    return setCachedValue(
      INTEGER_CACHE,
      cacheKey,
      normalizeContractInteger(value, fallback, minimum, maximum),
    );
  } catch {
    return fallback;
  }
}

function normalizeSlotCount(value: unknown): number {
  return intValue(value, DEFAULT_SLOT_COUNT, 1, 64);
}

function normalizeSlot(value: unknown, slotCount: number): number {
  return normalizeContractSlotIndex(value, slotCount, 0);
}

function isChunkApiFailedResult(value: unknown): value is ChunkApiFailedResult {
  try {
    return (
      Boolean(value) &&
      typeof value === "object" &&
      (value as { ok?: unknown }).ok === false &&
      "error" in value
    );
  } catch {
    return false;
  }
}

function createFailedResult(
  error: unknown,
  fallbackMessage = "Hotbar controller failed.",
): ChunkApiFailedResult {
  if (isChunkApiFailedResult(error)) {
    return error;
  }

  const normalized = normalizeErrorRecord(error);
  const message = normalizeContractText(normalized.message, fallbackMessage);
  const cacheKey = `${normalizeContractText(
    normalized.name,
    "HotbarControllerError",
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
      code: normalizeContractText(normalized.code, "hotbar_controller_error"),
      message,
      retryable: true,
      statusCode: null,
      requestId: null,
      requestKind: null,
      url: null,
      method: null,
      exceptionType: normalizeContractText(
        normalized.name,
        "HotbarControllerError",
      ),
      details: {
        ...((normalized.details as Record<string, unknown> | null | undefined) ??
          {}),
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
        debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
        allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
        forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      },
    },
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  try {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();

    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      tagName === "button" ||
      target.isContentEditable ||
      target.closest("[contenteditable='true']") !== null ||
      target.closest("[data-editor-ignore-hotbar='true']") !== null
    );
  } catch {
    return false;
  }
}

function getSlotFromEventTarget(target: EventTarget | null): number | null {
  try {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const slotElement = target.closest<HTMLElement>("[data-hotbar-slot]");

    if (!slotElement) {
      return null;
    }

    const rawSlot =
      slotElement.dataset.hotbarSlot ??
      slotElement.dataset.slot ??
      slotElement.getAttribute("data-hotbar-slot") ??
      slotElement.getAttribute("data-slot");

    const slot = Number.parseInt(rawSlot ?? "", 10);

    if (!Number.isFinite(slot)) {
      return null;
    }

    return slot;
  } catch {
    return null;
  }
}

function preventDefault(event: Event): void {
  try {
    event.preventDefault();
  } catch {
    // Ignore.
  }
}

function stopPropagation(event: Event): void {
  try {
    event.stopPropagation();
  } catch {
    // Ignore.
  }
}

function normalizeSelectedRuntimeBlockTypeId(value: unknown): string | null {
  return normalizeRuntimeBlockTypeId(value);
}

function isForbiddenCatalog(catalog: InventoryCatalog | null): boolean {
  if (!catalog) {
    return false;
  }

  try {
    if (inventoryCatalogContainsForbiddenDebugBlocks(catalog)) {
      return true;
    }
  } catch {
    // Fall through.
  }

  return containsForbiddenDebugBlockTypeId(catalog);
}

function toRecord(value: unknown): AnyRecord {
  return asEditorInventoryContractRecord(value);
}

function slotRecord(slot: unknown): Record<string, unknown> {
  return asEditorInventoryContractRecord(slot);
}

function itemRecordFromSlot(slot: unknown): Record<string, unknown> {
  return asEditorInventoryContractRecord(slotRecord(slot).item);
}

function optionalSlotField(slot: unknown, key: string): string | null {
  try {
    return nullableString(slotRecord(slot)[key]);
  } catch {
    return null;
  }
}

function optionalSlotItemField(slot: unknown, key: string): string | null {
  try {
    return nullableString(itemRecordFromSlot(slot)[key]);
  } catch {
    return null;
  }
}

function slotNumberField(slot: unknown, key: string, fallback: number): number {
  try {
    return intValue(slotRecord(slot)[key], fallback, 0, 999);
  } catch {
    return fallback;
  }
}

function slotBooleanField(slot: unknown, key: string, fallback: boolean): boolean {
  try {
    return boolValue(slotRecord(slot)[key], fallback);
  } catch {
    return fallback;
  }
}

function slotItemKind(slot: unknown): InventoryItem["kind"] {
  try {
    const raw =
      optionalSlotItemField(slot, "kind") ??
      optionalSlotField(slot, "itemKind") ??
      optionalSlotField(slot, "item_kind") ??
      "empty";

    if (raw === "library-item" || raw === "block" || raw === "asset" || raw === "empty") {
      return raw;
    }

    return "empty";
  } catch {
    return "empty";
  }
}

function slotSourceKind(slot: unknown): InventoryCatalog["sourceKind"] {
  try {
    return (
      optionalSlotField(slot, "sourceKind") ??
      optionalSlotField(slot, "source") ??
      "empty-fallback"
    ) as InventoryCatalog["sourceKind"];
  } catch {
    return "empty-fallback";
  }
}

function slotRuntimeBlockTypeId(slot: unknown): string | null {
  try {
    const record = slotRecord(slot);
    const item = itemRecordFromSlot(slot);

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

function slotBlockTypeId(slot: unknown): string | null {
  try {
    const record = slotRecord(slot);
    const item = itemRecordFromSlot(slot);

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

function slotObjectKind(slot: unknown): string | null {
  try {
    return (
      optionalSlotField(slot, "objectKind") ??
      optionalSlotField(slot, "object_kind") ??
      optionalSlotItemField(slot, "objectKind") ??
      optionalSlotItemField(slot, "object_kind")
    );
  } catch {
    return null;
  }
}

function hotbarSlotsToRenderInput(
  slots: readonly HotbarSlot[],
): readonly HotbarSlotRenderInput[] {
  try {
    return slots.map((slot) => {
      const record = slotRecord(slot);
      const item = itemRecordFromSlot(slot);
      const slotIndex = slotNumberField(slot, "slot", 0);
      const runtimeBlockTypeId = slotRuntimeBlockTypeId(slot);
      const blockTypeId = slotBlockTypeId(slot) ?? runtimeBlockTypeId;

      return {
        slot: slotIndex,
        label:
          nullableString(record.label) ??
          nullableString(item.label) ??
          nullableString(item.name) ??
          `Slot ${slotIndex + 1}`,
        selected: slotBooleanField(slot, "selected", false),
        blockTypeId,
        runtimeBlockTypeId,
        color: nullableString(record.color) ?? nullableString(item.color),
        sourceKind: slotSourceKind(slot),
        itemKind: slotItemKind(slot),
        libraryItemId:
          optionalSlotField(slot, "libraryItemId") ??
          optionalSlotItemField(slot, "libraryItemId"),
        familyId:
          optionalSlotField(slot, "familyId") ??
          optionalSlotItemField(slot, "familyId"),
        packageId:
          optionalSlotField(slot, "packageId") ??
          optionalSlotItemField(slot, "packageId"),
        vplibUid:
          optionalSlotField(slot, "vplibUid") ??
          optionalSlotItemField(slot, "vplibUid"),
        variantId:
          optionalSlotField(slot, "variantId") ??
          optionalSlotItemField(slot, "variantId"),
        revisionHash:
          optionalSlotField(slot, "revisionHash") ??
          optionalSlotItemField(slot, "revisionHash"),
        objectKind: slotObjectKind(slot),
        enabled: slotBooleanField(slot, "enabled", false),
      } as HotbarSlotRenderInput & Record<string, unknown>;
    });
  } catch {
    return [];
  }
}

function selectedRuntimeBlockTypeId(catalog: InventoryCatalog | null): string | null {
  if (!catalog) {
    return null;
  }

  try {
    const selectedPlacementRef = toRecord(catalog.selection.selectedPlacementRef);

    return normalizeSelectedRuntimeBlockTypeId(
      catalog.selection.selectedRuntimeBlockTypeId ??
        catalog.selection.selectedBlockTypeId ??
        selectedPlacementRef.runtimeBlockTypeId ??
        selectedPlacementRef.blockTypeId,
    );
  } catch {
    return null;
  }
}

function selectedLibraryItem(catalog: InventoryCatalog | null): InventoryLibraryItem | null {
  if (!catalog) {
    return null;
  }

  try {
    return catalog.selection.selectedLibraryItem ?? null;
  } catch {
    return null;
  }
}

function selectedBlockItem(catalog: InventoryCatalog | null): InventoryBlockItem | null {
  if (!catalog) {
    return null;
  }

  try {
    return catalog.selection.selectedBlockItem ?? null;
  } catch {
    return null;
  }
}

function selectedObjectKind(catalog: InventoryCatalog | null): string | null {
  try {
    const selectedPlacementRef = toRecord(catalog?.selection.selectedPlacementRef);
    return (
      nullableString(selectedPlacementRef.objectKind) ??
      selectedLibraryItem(catalog)?.objectKind ??
      null
    );
  } catch {
    return null;
  }
}

function selectedPlaceableItem(
  catalog: InventoryCatalog | null,
): InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem | null {
  if (!catalog) {
    return null;
  }

  try {
    const item = catalog.selection.selectedItem as InventoryItem | null;

    if (!item || item.kind === "empty") {
      return null;
    }

    if (item.kind === "library-item") {
      return item as InventoryLibraryItem;
    }

    if (item.kind === "block") {
      return item as InventoryBlockItem;
    }

    if (item.kind === "asset") {
      return item as InventoryAssetItem;
    }

    return null;
  } catch {
    return null;
  }
}

function catalogHasPlaceableLibraryItems(catalog: InventoryCatalog | null): boolean {
  if (!catalog) {
    return false;
  }

  try {
    return catalog.libraryItems.some(
      (item) => item.enabled && Boolean(item.runtimeBlockTypeId),
    );
  } catch {
    return false;
  }
}

function catalogHasPlaceableItems(catalog: InventoryCatalog | null): boolean {
  if (!catalog) {
    return false;
  }

  try {
    return catalog.placeableItems.some((item) => item.enabled);
  } catch {
    return false;
  }
}

function catalogUsesFallback(catalog: InventoryCatalog | null): boolean {
  if (!catalog) {
    return false;
  }

  return (
    catalog.sourceKind === "empty-fallback" ||
    catalog.sourceKind === "static-fallback" ||
    catalog.sourceKind === "fallback" ||
    catalog.status === "empty" ||
    catalog.status === "fallback"
  );
}

function catalogIsAllowedForHotbar(
  catalog: InventoryCatalog,
  options: {
    readonly allowLegacyChunkInventory: boolean;
    readonly onlyLibraryItemsPlaceable: boolean;
  },
): boolean {
  if (isForbiddenCatalog(catalog)) {
    return false;
  }

  if (!options.onlyLibraryItemsPlaceable) {
    return true;
  }

  if (isLibraryInventoryCatalog(catalog)) {
    return true;
  }

  return options.allowLegacyChunkInventory === true;
}

function sanitizeCatalogForHotbar(
  catalog: InventoryCatalog,
  options: {
    readonly allowLegacyChunkInventory: boolean;
    readonly onlyLibraryItemsPlaceable: boolean;
    readonly slotCount: number;
    readonly selectedSlot: number;
    readonly projectId?: string;
    readonly worldId?: string;
    readonly reason?: string | null;
  },
): InventoryCatalog {
  if (catalogIsAllowedForHotbar(catalog, options)) {
    return catalog;
  }

  return createFallbackInventorySlotFactoryResult({
    slotCount: options.slotCount,
    selectedSlot: options.selectedSlot,
    selectedSlotIndex: options.selectedSlot,
    projectId: options.projectId,
    worldId: options.worldId,
    fallbackReason:
      options.reason ?? "Inventory catalog is not an allowed Library/VPLIB catalog.",
  }).catalog;
}

function catalogStatusToControllerStatus(
  catalog: InventoryCatalog,
  usedFallback: boolean,
): HotbarControllerStatus {
  if (usedFallback || catalog.status === "empty" || catalog.status === "fallback") {
    return "empty";
  }

  if (catalog.status === "failed" || catalog.status === "error") {
    return "failed";
  }

  if (catalog.status === "degraded") {
    return "degraded";
  }

  return "ready";
}

function dispatchInventoryCatalog(
  store: EditorStore,
  catalog: InventoryCatalog,
  source: string,
): void {
  try {
    store.setState(
      (previous) =>
        applyEditorAction(previous, {
          kind: "inventory/catalog-loaded",
          catalog,
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
    // Store update must not break hotbar rendering.
  }
}

function dispatchInventoryError(
  store: EditorStore,
  error: ChunkApiFailedResult,
  source: string,
): void {
  try {
    store.setState(
      (previous) =>
        applyEditorAction(previous, {
          kind: "inventory/failed",
          error,
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
    // Store update must not break runtime.
  }
}

function renderCatalogToDom(
  refs: EditorDomRefs,
  catalog: InventoryCatalog,
  updateLiveRegion: boolean,
): void {
  try {
    renderDomHotbarSlots(refs, hotbarSlotsToRenderInput(catalog.hotbarSlots));
    setDomHotbarVisibility(refs, true);

    const selected = catalog.selection.selectedItem;
    const runtimeBlockTypeId = selectedRuntimeBlockTypeId(catalog);
    const libraryItem = selectedLibraryItem(catalog);
    refs.root.dataset.inventorySelectedSlot = String(
      catalog.selection.selectedSlotIndex ?? catalog.selection.selectedSlot ?? 0,
    );
    const sourceLabel = isLibraryInventoryCatalog(catalog)
      ? "Library"
      : catalog.sourceKind;

    const text = selected
      ? `Ausgewählt: ${selected.label}${runtimeBlockTypeId ? ` (${runtimeBlockTypeId})` : ""}`
      : "Kein Library-/VPLIB-Item ausgewählt.";

    const libraryText = libraryItem
      ? `\nFamily: ${libraryItem.familyId ?? "—"} · VPLIB: ${libraryItem.vplibUid ?? "—"} · Variante: ${libraryItem.variantId ?? "default"}`
      : "";

    setDomInventoryPanelText(refs, `${text}${libraryText}\nQuelle: ${sourceLabel}`);

    if (updateLiveRegion) {
      setDomLiveMessage(
        refs,
        selected
          ? `Ausgewählt: ${selected.label}`
          : "Kein Library-/VPLIB-Item ausgewählt.",
      );
    }
  } catch {
    // DOM render must never throw into runtime.
  }
}

function isLibraryInventorySourceSnapshot(
  value: unknown,
): value is LibraryInventorySourceSnapshot {
  try {
    return (
      Boolean(value) &&
      typeof value === "object" &&
      "state" in value &&
      "slots" in value &&
      "runtimeSelection" in value
    );
  } catch {
    return false;
  }
}

function isEditorInventoryLoadResult(
  value: unknown,
): value is EditorInventoryLoadResult {
  try {
    return (
      Boolean(value) &&
      typeof value === "object" &&
      "ok" in value &&
      ("state" in value || "payload" in value)
    );
  } catch {
    return false;
  }
}

function isEditorInventoryState(value: unknown): value is EditorInventoryState {
  try {
    return (
      Boolean(value) &&
      typeof value === "object" &&
      Array.isArray((value as { slots?: unknown }).slots)
    );
  } catch {
    return false;
  }
}

function isEditorInventoryPayload(
  value: unknown,
): value is EditorInventoryPayload {
  try {
    return (
      Boolean(value) &&
      typeof value === "object" &&
      "inventory" in value &&
      Boolean((value as { inventory?: unknown }).inventory)
    );
  } catch {
    return false;
  }
}

function factoryResultFromUnknownInventory(
  value: unknown,
  options: {
    readonly slotCount: number;
    readonly selectedSlot: number;
    readonly defaultRuntimeBlockTypeId: string | null;
    readonly defaultLibraryItemId: string | null;
    readonly defaultFamilyId: string | null;
    readonly defaultPackageId: string | null;
    readonly defaultVplibUid: string | null;
    readonly defaultVariantId: string | null;
    readonly defaultRevisionHash: string | null;
    readonly defaultObjectKind: string | null;
    readonly allowLegacyChunkInventory: boolean;
    readonly onlyLibraryItemsPlaceable: boolean;
    readonly allowEmptyFallback: boolean;
    readonly projectId?: string;
    readonly worldId?: string;
    readonly fallbackReason?: string | null;
  },
): InventorySlotFactoryResult {
  const selection: InventorySelectionOptions = {
    selectedSlot: options.selectedSlot,
    selectedSlotIndex: options.selectedSlot,
    blockTypeId: options.defaultRuntimeBlockTypeId,
    runtimeBlockTypeId: options.defaultRuntimeBlockTypeId,
    libraryItemId: options.defaultLibraryItemId,
    familyId: options.defaultFamilyId,
    packageId: options.defaultPackageId,
    vplibUid: options.defaultVplibUid,
    variantId: options.defaultVariantId,
    revisionHash: options.defaultRevisionHash,
    objectKind: options.defaultObjectKind,
    preferEnabled: true,
  };

  if (isInventoryCatalog(value)) {
    return createInventorySlotFactoryResultFromCatalog(value, {
      ...selection,
      slotCount: options.slotCount,
      allowChunkBlocks: options.allowLegacyChunkInventory,
    });
  }

  if (isLibraryInventorySourceSnapshot(value)) {
    return createInventorySlotFactoryResultFromEditorInventoryState(value.state, {
      ...selection,
      slotCount: options.slotCount,
      projectId: options.projectId,
      worldId: options.worldId,
    });
  }

  if (isEditorInventoryLoadResult(value)) {
    return createInventorySlotFactoryResultFromEditorInventoryLoadResult(value, {
      ...selection,
      slotCount: options.slotCount,
      projectId: options.projectId,
      worldId: options.worldId,
    });
  }

  if (isEditorInventoryPayload(value)) {
    return createInventorySlotFactoryResultFromEditorInventoryPayload(value, {
      ...selection,
      slotCount: options.slotCount,
      projectId: options.projectId,
      worldId: options.worldId,
    });
  }

  if (isEditorInventoryState(value)) {
    return createInventorySlotFactoryResultFromEditorInventoryState(value, {
      ...selection,
      slotCount: options.slotCount,
      projectId: options.projectId,
      worldId: options.worldId,
    });
  }

  return createFallbackInventorySlotFactoryResult({
    ...selection,
    slotCount: options.slotCount,
    projectId: options.projectId,
    worldId: options.worldId,
    fallbackReason: options.fallbackReason ?? "Unknown inventory source result.",
  });
}

function failedFromFactoryResult(
  result: InventorySlotFactoryResult,
): ChunkApiFailedResult | null {
  if (result.status !== "failed") {
    return null;
  }

  return createFailedResult(
    new Error(result.errorMessage ?? "Hotbar inventory failed."),
    "Hotbar inventory failed.",
  );
}

function catalogFromFactoryResult(
  result: InventorySlotFactoryResult,
  options: {
    readonly allowLegacyChunkInventory: boolean;
    readonly onlyLibraryItemsPlaceable: boolean;
    readonly slotCount: number;
    readonly selectedSlot: number;
  },
): InventoryCatalog {
  return sanitizeCatalogForHotbar(result.catalog, {
    ...options,
    reason: result.errorMessage,
  });
}

function makeLoadOptions(
  catalog: InventoryCatalog | null,
  input: {
    readonly force?: boolean;
    readonly reason?: string;
    readonly selectedSlot: number;
    readonly runtimeBlockTypeId: string | null;
    readonly libraryItemId: string | null;
    readonly familyId: string | null;
    readonly packageId: string | null;
    readonly vplibUid: string | null;
    readonly variantId: string | null;
    readonly revisionHash: string | null;
    readonly objectKind: string | null;
    readonly signal?: AbortSignal;
  },
): EditorInventorySourceLoadOptions {
  // On the first load the productive /editor/api/inventory payload owns the
  // persisted selection. Supplying the bootstrap fallback slot here used to
  // overwrite that server selection with slot 0 before the catalog was built.
  const selectedSlot = catalog?.selection.selectedSlotIndex;
  return normalizeInventorySourceLoadOptions({
    force: input.force,
    forceRefresh: input.force,
    selectedSlot,
    selectedSlotIndex: selectedSlot,
    blockTypeId:
      catalog?.selection.selectedRuntimeBlockTypeId ??
      catalog?.selection.selectedBlockTypeId ??
      input.runtimeBlockTypeId,
    runtimeBlockTypeId:
      catalog?.selection.selectedRuntimeBlockTypeId ?? input.runtimeBlockTypeId,
    libraryItemId:
      catalog?.selection.selectedPlacementRef?.libraryItemId ?? input.libraryItemId,
    familyId:
      catalog?.selection.selectedPlacementRef?.familyId ?? input.familyId,
    packageId:
      catalog?.selection.selectedPlacementRef?.packageId ?? input.packageId,
    vplibUid:
      catalog?.selection.selectedPlacementRef?.vplibUid ?? input.vplibUid,
    variantId:
      catalog?.selection.selectedPlacementRef?.variantId ?? input.variantId,
    revisionHash:
      catalog?.selection.selectedPlacementRef?.revisionHash ??
      input.revisionHash,
    objectKind:
      catalog?.selection.selectedPlacementRef?.objectKind ?? input.objectKind,
    signal: input.signal,
    allowStaticFallback: false,
    reason: input.reason ?? "hotbar-load",
  });
}

function selectedSlotIndexFromInventorySource(
  inventorySource: HotbarInventorySourceHandle,
  fallback: number,
  slotCount: number,
): number {
  try {
    const source = inventorySource as HotbarInventorySourceHandle & {
      readonly getSelectedSlotIndex?: () => number;
    };
    if (typeof source.getSelectedSlotIndex === "function") {
      return normalizeSlot(source.getSelectedSlotIndex(), slotCount);
    }
  } catch {
    // Fall back to the configured slot for legacy inventory sources.
  }
  return normalizeSlot(fallback, slotCount);
}

function catalogFromUnknownSelectionResult(
  value: unknown,
  options: {
    readonly slotCount: number;
    readonly selectedSlot: number;
    readonly defaultRuntimeBlockTypeId: string | null;
    readonly defaultLibraryItemId: string | null;
    readonly defaultFamilyId: string | null;
    readonly defaultPackageId: string | null;
    readonly defaultVplibUid: string | null;
    readonly defaultVariantId: string | null;
    readonly defaultRevisionHash: string | null;
    readonly defaultObjectKind: string | null;
    readonly allowLegacyChunkInventory: boolean;
    readonly onlyLibraryItemsPlaceable: boolean;
    readonly allowEmptyFallback: boolean;
    readonly fallbackReason?: string | null;
  },
): InventoryCatalog | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    if (isChunkApiFailedResult(value)) {
      return null;
    }

    const factoryResult = factoryResultFromUnknownInventory(value, options);
    return catalogFromFactoryResult(factoryResult, {
      allowLegacyChunkInventory: options.allowLegacyChunkInventory,
      onlyLibraryItemsPlaceable: options.onlyLibraryItemsPlaceable,
      slotCount: options.slotCount,
      selectedSlot: options.selectedSlot,
    });
  } catch {
    return null;
  }
}

function runtimePlaceableFromSelectedLibraryItem(
  selected: InventoryLibraryItem | null,
): EditorInventoryRuntimePlaceable | null {
  if (
    !selected ||
    !selected.runtimeBlockTypeId ||
    !selected.libraryRef ||
    !selected.placementCommand
  ) {
    return null;
  }

  try {
    const runtimePlaceable = createEditorInventoryRuntimePlaceable({
      source: "library",
      sourceKind: selected.sourceKind,
      slotIndex: selected.slot,
      itemId: selected.libraryItemId,
      itemKind: selected.itemKind,
      runtimeBlockTypeId: selected.runtimeBlockTypeId,
      blockTypeId: selected.blockTypeId,
      libraryItemId: selected.libraryItemId,
      inventoryItemId: selected.id,
      inventorySlotIndex: selected.slot,
      familyId: selected.familyId,
      packageId: selected.packageId,
      vplibUid: selected.vplibUid,
      variantId: selected.variantId,
      revisionHash: selected.revisionHash,
      objectKind: selected.objectKind,
      label: selected.label,
      libraryRef: selected.libraryRef,
      placementCommand: selected.placementCommand,
      commandMetadata: {
        source: "hotbar-controller.selected-library-item",
        selectedSlotIndex: selected.slot,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      },
      rawSlot: selected.rawSlot,
      rawItem: selected.rawItem,
      requireLibraryIdentity: true,
    });

    return isEditorInventoryRuntimePlaceable(runtimePlaceable)
      ? runtimePlaceable
      : null;
  } catch {
    return null;
  }
}

function selectionToContractSelection(
  selection: InventorySelectionOptions,
): EditorInventorySelectionOptions {
  return {
    selectedSlot: selection.selectedSlot,
    selectedSlotIndex: selection.selectedSlotIndex,
    blockTypeId: normalizeSelectedRuntimeBlockTypeId(
      selection.blockTypeId ?? selection.runtimeBlockTypeId,
    ),
    runtimeBlockTypeId: normalizeSelectedRuntimeBlockTypeId(
      selection.runtimeBlockTypeId ?? selection.blockTypeId,
    ),
    assetTypeId: nullableString(selection.assetTypeId),
    libraryItemId: nullableString(selection.libraryItemId),
    familyId: nullableString(selection.familyId),
    packageId: nullableString(selection.packageId),
    vplibUid: nullableString(selection.vplibUid),
    variantId: nullableString(selection.variantId),
    revisionHash: nullableString(selection.revisionHash),
    objectKind: nullableString(selection.objectKind),
    preferEnabled: selection.preferEnabled ?? true,
  };
}

export function createHotbarController(
  options: HotbarControllerOptions,
): HotbarControllerHandle {
  const logger = options.logger;
  const inventorySource = options.inventorySource;
  const store = options.store;
  const domRefs = options.domRefs;
  const slotCount = normalizeSlotCount(options.slotCount);
  const enableKeyboardShortcuts = options.enableKeyboardShortcuts ?? true;
  const enableWheelSelection = options.enableWheelSelection ?? true;
  const enableSlotClickSelection = options.enableSlotClickSelection ?? true;
  const destroyInventorySourceOnDestroy =
    options.destroyInventorySourceOnDestroy ?? true;
  const renderToDom = options.renderToDom ?? true;
  const defaultSelectedSlot = normalizeSlot(options.defaultSelectedSlot, slotCount);

  const defaultRuntimeBlockTypeId = normalizeSelectedRuntimeBlockTypeId(
    options.defaultRuntimeBlockTypeId ?? options.defaultBlockTypeId,
  );
  const defaultLibraryItemId = nullableString(options.defaultLibraryItemId);
  const defaultFamilyId = nullableString(options.defaultFamilyId);
  const defaultPackageId = nullableString(options.defaultPackageId);
  const defaultVplibUid = nullableString(options.defaultVplibUid);
  const defaultVariantId = nullableString(options.defaultVariantId);
  const defaultRevisionHash = nullableString(options.defaultRevisionHash);
  const defaultObjectKind = nullableString(options.defaultObjectKind);
  const allowLegacyChunkInventory = boolValue(
    options.allowLegacyChunkInventory,
    false,
  );
  const onlyLibraryItemsPlaceable = boolValue(
    options.onlyLibraryItemsPlaceable,
    ONLY_LIBRARY_ITEMS_PLACEABLE,
  );
  const allowEmptyFallback = boolValue(options.allowEmptyFallback, true);

  let status: HotbarControllerStatus = "created";
  let destroyed = false;
  let catalog: InventoryCatalog | null = null;
  let lastError: ChunkApiFailedResult | null = null;
  let updatedAt: string | null = null;
  let lastReason: string | null = null;

  let initializeCount = 0;
  let loadCount = 0;
  let reloadCount = 0;
  let selectionCount = 0;
  let renderCount = 0;
  let blockedSelectionCount = 0;

  const cleanupCallbacks: Array<() => void> = [];
  let listenersAttached = false;

  function setStatus(nextStatus: HotbarControllerStatus, reason?: string): void {
    status = nextStatus;
    updatedAt = now();
    lastReason = reason ?? lastReason;
  }

  function assertAlive(): ChunkApiFailedResult | null {
    if (!destroyed && status !== "destroyed") {
      return null;
    }

    return createFailedResult(new Error("HotbarController is destroyed."));
  }

  function createFallbackCatalog(reason: string): InventoryCatalog {
    return createFallbackInventorySlotFactoryResult({
      slotCount,
      selectedSlot: catalog?.selection.selectedSlotIndex ?? defaultSelectedSlot,
      selectedSlotIndex: catalog?.selection.selectedSlotIndex ?? defaultSelectedSlot,
      fallbackReason: reason,
    }).catalog;
  }

  function applyCatalog(
    nextCatalogInput: InventoryCatalog,
    reason: string,
    applyOptions?: {
      readonly live?: boolean;
      readonly usedFallback?: boolean;
      readonly dispatch?: boolean;
      readonly render?: boolean;
    },
  ): InventoryCatalog {
    const selectedSlot = normalizeSlot(
      nextCatalogInput.selection.selectedSlotIndex ??
        nextCatalogInput.selection.selectedSlot ??
        defaultSelectedSlot,
      slotCount,
    );

    const nextCatalog = sanitizeCatalogForHotbar(nextCatalogInput, {
      allowLegacyChunkInventory,
      onlyLibraryItemsPlaceable,
      slotCount,
      selectedSlot,
      reason,
    });

    catalog = nextCatalog;
    lastError = null;
    setStatus(
      catalogStatusToControllerStatus(
        nextCatalog,
        applyOptions?.usedFallback ?? catalogUsesFallback(nextCatalog),
      ),
      reason,
    );

    if (applyOptions?.dispatch !== false) {
      dispatchInventoryCatalog(store, nextCatalog, `hotbar.${reason}`);
    }

    if (renderToDom && applyOptions?.render !== false) {
      renderCatalogToDom(domRefs, nextCatalog, applyOptions?.live ?? true);
    }

    return nextCatalog;
  }

  function render(): void {
    try {
      if (!catalog) {
        return;
      }

      renderCount += 1;
      renderCatalogToDom(domRefs, catalog, false);
    } catch (error) {
      logWarn(logger, "Hotbar render failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  async function load(input?: {
    readonly force?: boolean;
    readonly reason?: string;
    readonly silent?: boolean;
  }): Promise<InventoryCatalog | ChunkApiFailedResult> {
    const aliveFailure = assertAlive();

    if (aliveFailure) {
      return aliveFailure;
    }

    const reason = input?.reason ?? "hotbar-load";

    loadCount += 1;
    if (!input?.silent) {
      setStatus("loading", reason);

      try {
        store.setState(
          (previous) =>
            applyEditorAction(previous, {
              kind: "inventory/loading",
              createdAt: now(),
              source: "hotbar-controller",
            }),
          {
            action: "hotbar.inventory-loading",
            notify: true,
            captureHistory: false,
          },
        );
      } catch {
        // Store loading state is best-effort.
      }
    }

    try {
      const rawResult = await inventorySource.load(
        makeLoadOptions(catalog, {
          force: input?.force,
          reason,
          selectedSlot: defaultSelectedSlot,
          runtimeBlockTypeId: defaultRuntimeBlockTypeId,
          libraryItemId: defaultLibraryItemId,
          familyId: defaultFamilyId,
          packageId: defaultPackageId,
          vplibUid: defaultVplibUid,
          variantId: defaultVariantId,
          revisionHash: defaultRevisionHash,
          objectKind: defaultObjectKind,
          signal: options.signal,
        }),
      );

      if (isChunkApiFailedResult(rawResult)) {
        lastError = rawResult;
        setStatus("failed", `${reason}-failed`);
        dispatchInventoryError(store, rawResult, "hotbar.inventory-failed");

        if (allowEmptyFallback) {
          const fallback = applyCatalog(
            createFallbackCatalog(rawResult.error.message),
            `${reason}-empty-fallback`,
            {
              live: true,
              usedFallback: true,
            },
          );
          return fallback;
        }

        logWarn(logger, "Hotbar inventory loading failed.", {
          error: rawResult.error,
        });

        return rawResult;
      }

      const loadedSelectedSlot = catalog?.selection.selectedSlotIndex
        ?? selectedSlotIndexFromInventorySource(
          inventorySource,
          defaultSelectedSlot,
          slotCount,
        );
      const factoryResult = factoryResultFromUnknownInventory(rawResult, {
        slotCount,
        selectedSlot: loadedSelectedSlot,
        defaultRuntimeBlockTypeId,
        defaultLibraryItemId,
        defaultFamilyId,
        defaultPackageId,
        defaultVplibUid,
        defaultVariantId,
        defaultRevisionHash,
        defaultObjectKind,
        allowLegacyChunkInventory,
        onlyLibraryItemsPlaceable,
        allowEmptyFallback,
        fallbackReason: reason,
      });

      const factoryFailure = failedFromFactoryResult(factoryResult);
      if (factoryFailure) {
        lastError = factoryFailure;
        setStatus("failed", `${reason}-factory-failed`);
        dispatchInventoryError(store, factoryFailure, "hotbar.inventory-failed");

        if (allowEmptyFallback) {
          const fallback = applyCatalog(
            createFallbackCatalog(factoryFailure.error.message),
            `${reason}-empty-fallback`,
            {
              live: true,
              usedFallback: true,
            },
          );
          return fallback;
        }

        return factoryFailure;
      }

      const nextCatalog = applyCatalog(
        catalogFromFactoryResult(factoryResult, {
          allowLegacyChunkInventory,
          onlyLibraryItemsPlaceable,
          slotCount,
          selectedSlot: loadedSelectedSlot,
        }),
        reason,
        {
          live: true,
          usedFallback: factoryResult.usedFallback,
        },
      );

      logInfo(logger, "Hotbar inventory loaded.", {
        status,
        sourceKind: nextCatalog.sourceKind,
        itemCount: nextCatalog.items.length,
        libraryItemCount: nextCatalog.libraryItems.length,
        blockItemCount: nextCatalog.blockItems.length,
        selectedSlot: nextCatalog.selection.selectedSlotIndex,
        selectedRuntimeBlockTypeId: nextCatalog.selection.selectedRuntimeBlockTypeId,
        selectedFamilyId: nextCatalog.selection.selectedPlacementRef?.familyId ?? null,
        selectedPackageId: nextCatalog.selection.selectedPlacementRef?.packageId ?? null,
        selectedVplibUid: nextCatalog.selection.selectedPlacementRef?.vplibUid ?? null,
        selectedVariantId: nextCatalog.selection.selectedPlacementRef?.variantId ?? null,
        selectedObjectKind: selectedObjectKind(nextCatalog),
        backendInventoryPayload: PRODUCTIVE_INVENTORY_ROUTE,
        backendCreativeLibraryPayload: "vectoplan-library",
        onlyLibraryItemsPlaceable,
        allowLegacyChunkInventory,
        debugBlocksAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      });

      return nextCatalog;
    } catch (error) {
      const failed = createFailedResult(error);
      lastError = failed;
      setStatus("failed", `${reason}-exception`);
      dispatchInventoryError(store, failed, "hotbar.inventory-failed");

      if (allowEmptyFallback) {
        return applyCatalog(
          createFallbackCatalog(failed.error.message),
          `${reason}-empty-fallback`,
          {
            live: true,
            usedFallback: true,
          },
        );
      }

      return failed;
    }
  }

  function select(
    selection: InventorySelectionOptions,
    reason: string,
    selectOptions?: HotbarSelectionApplyOptions,
  ): InventoryCatalog | null {
    const aliveFailure = assertAlive();

    if (aliveFailure) {
      lastError = aliveFailure;
      return null;
    }

    try {
      let nextCatalog: InventoryCatalog | null = null;
      const contractSelection = selectionToContractSelection(selection);

      if (hasInventorySelect(inventorySource)) {
        const selectedSourceResult = inventorySource.select(contractSelection);

        nextCatalog = catalogFromUnknownSelectionResult(selectedSourceResult, {
          slotCount,
          selectedSlot:
            selection.selectedSlotIndex ??
            selection.selectedSlot ??
            catalog?.selection.selectedSlotIndex ??
            defaultSelectedSlot,
          defaultRuntimeBlockTypeId,
          defaultLibraryItemId,
          defaultFamilyId,
          defaultPackageId,
          defaultVplibUid,
          defaultVariantId,
          defaultRevisionHash,
          defaultObjectKind,
          allowLegacyChunkInventory,
          onlyLibraryItemsPlaceable,
          allowEmptyFallback,
          fallbackReason: reason,
        });
      }

      if (!nextCatalog && hasInventorySelectSlot(inventorySource)) {
        const slot = normalizeSlot(
          selection.selectedSlotIndex ??
            selection.selectedSlot ??
            catalog?.selection.selectedSlotIndex ??
            defaultSelectedSlot,
          slotCount,
        );
        const selectedSourceResult = inventorySource.selectSlot(slot, reason);

        nextCatalog = catalogFromUnknownSelectionResult(selectedSourceResult, {
          slotCount,
          selectedSlot: slot,
          defaultRuntimeBlockTypeId:
            selection.runtimeBlockTypeId ??
            selection.blockTypeId ??
            defaultRuntimeBlockTypeId,
          defaultLibraryItemId: selection.libraryItemId ?? defaultLibraryItemId,
          defaultFamilyId: selection.familyId ?? defaultFamilyId,
          defaultPackageId: selection.packageId ?? defaultPackageId,
          defaultVplibUid: selection.vplibUid ?? defaultVplibUid,
          defaultVariantId: selection.variantId ?? defaultVariantId,
          defaultRevisionHash: selection.revisionHash ?? defaultRevisionHash,
          defaultObjectKind: selection.objectKind ?? defaultObjectKind,
          allowLegacyChunkInventory,
          onlyLibraryItemsPlaceable,
          allowEmptyFallback,
          fallbackReason: reason,
        });
      }

      if (!nextCatalog && catalog) {
        const factoryResult = updateInventorySlotFactorySelection({
          catalog,
          selection,
          fallbackReason: reason,
        });
        nextCatalog = factoryResult.catalog;
      }

      if (!nextCatalog) {
        blockedSelectionCount += 1;
        return null;
      }

      if (isForbiddenCatalog(nextCatalog)) {
        blockedSelectionCount += 1;
        logWarn(
          logger,
          "Hotbar selection blocked because catalog contains forbidden debug block ids.",
          {
            reason,
            forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
          },
        );
        return catalog;
      }

      selectionCount += 1;
      applyCatalog(nextCatalog, reason, {
        live: true,
        dispatch: selectOptions?.dispatch,
        render: selectOptions?.render,
      });

      logDebug(logger, "Hotbar selection changed.", {
        reason,
        selectedSlot: nextCatalog.selection.selectedSlot,
        selectedSlotIndex: nextCatalog.selection.selectedSlotIndex,
        selectedRuntimeBlockTypeId: nextCatalog.selection.selectedRuntimeBlockTypeId,
        selectedFamilyId: nextCatalog.selection.selectedPlacementRef?.familyId ?? null,
        selectedPackageId: nextCatalog.selection.selectedPlacementRef?.packageId ?? null,
        selectedVplibUid: nextCatalog.selection.selectedPlacementRef?.vplibUid ?? null,
        selectedVariantId: nextCatalog.selection.selectedPlacementRef?.variantId ?? null,
        selectedObjectKind: selectedObjectKind(nextCatalog),
      });

      return nextCatalog;
    } catch (error) {
      blockedSelectionCount += 1;
      logWarn(logger, "Hotbar selection failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });

      return null;
    }
  }

  function selectRelative(delta: number, reason: string): InventoryCatalog | null {
    try {
      if (!catalog) {
        return null;
      }

      const step = delta >= 0 ? 1 : -1;
      const nextSlot = normalizeSlot(catalog.selection.selectedSlotIndex + step, slotCount);
      return select(
        {
          selectedSlot: nextSlot,
          selectedSlotIndex: nextSlot,
        },
        reason,
      );
    } catch (error) {
      blockedSelectionCount += 1;
      logWarn(logger, "Hotbar relative selection failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
      return null;
    }
  }

  function handleHotbarClick(event: MouseEvent): void {
    try {
      if (!enableSlotClickSelection) {
        return;
      }

      const slot = getSlotFromEventTarget(event.target);

      if (slot === null) {
        return;
      }

      preventDefault(event);
      stopPropagation(event);

      select(
        {
          selectedSlot: slot,
          selectedSlotIndex: slot,
        },
        "hotbar-click",
      );
    } catch (error) {
      logWarn(logger, "Hotbar click handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    try {
      if (!enableKeyboardShortcuts || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key;

      if (/^[1-9]$/.test(key)) {
        const slot = Number.parseInt(key, 10) - 1;
        select(
          {
            selectedSlot: slot,
            selectedSlotIndex: slot,
          },
          "keyboard-number",
        );
        preventDefault(event);
        return;
      }

      if (key === "[" || key === "PageUp") {
        selectRelative(-1, "keyboard-previous");
        preventDefault(event);
        return;
      }

      if (key === "]" || key === "PageDown") {
        selectRelative(1, "keyboard-next");
        preventDefault(event);
      }
    } catch (error) {
      logWarn(logger, "Hotbar keyboard handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handleWheel(event: WheelEvent): void {
    try {
      if (!enableWheelSelection || isEditableTarget(event.target)) {
        return;
      }

      if (!catalog) {
        return;
      }

      const direction = normalizeWheelInventoryDirection(event);

      if (!direction) {
        return;
      }

      selectRelative(direction === "next" ? 1 : -1, "mouse-wheel");
      preventDefault(event);
    } catch (error) {
      logWarn(logger, "Hotbar wheel handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function addDomListeners(controller: HotbarControllerHandle): void {
    if (listenersAttached) {
      return;
    }

    try {
      if (domRefs.hotbarSlots && enableSlotClickSelection) {
        domRefs.hotbarSlots.addEventListener("click", handleHotbarClick);
        cleanupCallbacks.push(() =>
          domRefs.hotbarSlots?.removeEventListener("click", handleHotbarClick),
        );
      }

      if (enableKeyboardShortcuts && typeof window !== "undefined") {
        window.addEventListener("keydown", handleKeyDown);
        cleanupCallbacks.push(() =>
          window.removeEventListener("keydown", handleKeyDown),
        );
      }

      if (enableWheelSelection && typeof window !== "undefined") {
        window.addEventListener("wheel", handleWheel, {
          passive: false,
        });
        cleanupCallbacks.push(() =>
          window.removeEventListener("wheel", handleWheel),
        );
      }

      if (options.signal) {
        const onAbort = (): void => {
          controller.destroy("abort-signal");
        };

        options.signal.addEventListener("abort", onAbort, {
          once: true,
        });
        cleanupCallbacks.push(() =>
          options.signal?.removeEventListener("abort", onAbort),
        );
      }

      listenersAttached = true;
    } catch (error) {
      logWarn(logger, "Hotbar DOM listener setup failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function cleanup(): void {
    for (const callback of cleanupCallbacks.splice(0)) {
      try {
        callback();
      } catch {
        // Ignore cleanup failures.
      }
    }

    listenersAttached = false;
  }

  function getSelectedRuntimePlaceable(): EditorInventoryRuntimePlaceable | null {
    try {
      if (hasSelectedRuntimePlaceable(inventorySource)) {
        const direct = inventorySource.getSelectedRuntimePlaceable();
        if (direct) {
          return direct;
        }
      }
    } catch {
      // Fall through.
    }

    return runtimePlaceableFromSelectedLibraryItem(selectedLibraryItem(catalog));
  }

  const controller: HotbarControllerHandle = {
    kind: HOTBAR_CONTROLLER_KIND,

    async initialize(): Promise<InventoryCatalog | ChunkApiFailedResult> {
      const aliveFailure = assertAlive();

      if (aliveFailure) {
        return aliveFailure;
      }

      initializeCount += 1;
      addDomListeners(controller);

      return load({
        force: false,
        reason: "hotbar-initialize",
      });
    },

    load,

    async reload(reason?: string): Promise<InventoryCatalog | ChunkApiFailedResult> {
      reloadCount += 1;

      // The user-inventory iframe has already applied and persisted the slot
      // update before it emits this synchronization event. Refresh the editor
      // catalog in the background; changing the whole inventory state to
      // "loading" would unnecessarily cover the 3D viewport for a single
      // hotbar-slot change.
      const silent = isSilentHotbarReloadReason(reason);

      return load({
        force: true,
        reason: reason ?? "hotbar-reload",
        silent,
      });
    },

    async refresh(reason?: string): Promise<InventoryCatalog | ChunkApiFailedResult> {
      reloadCount += 1;

      try {
        if (hasInventoryRefresh(inventorySource)) {
          const result = await inventorySource.refresh({
            signal: options.signal,
            forceRefresh: true,
            reason: reason ?? "hotbar-refresh",
          });

          if (isChunkApiFailedResult(result)) {
            lastError = result;
            dispatchInventoryError(store, result, "hotbar.inventory-refresh-failed");
            return result;
          }

          const factoryResult = factoryResultFromUnknownInventory(result, {
            slotCount,
            selectedSlot: catalog?.selection.selectedSlotIndex ?? defaultSelectedSlot,
            defaultRuntimeBlockTypeId,
            defaultLibraryItemId,
            defaultFamilyId,
            defaultPackageId,
            defaultVplibUid,
            defaultVariantId,
            defaultRevisionHash,
            defaultObjectKind,
            allowLegacyChunkInventory,
            onlyLibraryItemsPlaceable,
            allowEmptyFallback,
            fallbackReason: reason ?? "hotbar-refresh",
          });

          return applyCatalog(
            catalogFromFactoryResult(factoryResult, {
              allowLegacyChunkInventory,
              onlyLibraryItemsPlaceable,
              slotCount,
              selectedSlot: catalog?.selection.selectedSlotIndex ?? defaultSelectedSlot,
            }),
            reason ?? "hotbar-refresh",
            {
              live: true,
              usedFallback: factoryResult.usedFallback,
            },
          );
        }
      } catch (error) {
        const failed = createFailedResult(error, "Hotbar inventory refresh failed.");
        lastError = failed;
        dispatchInventoryError(store, failed, "hotbar.inventory-refresh-failed");
        return failed;
      }

      return load({
        force: true,
        reason: reason ?? "hotbar-refresh",
      });
    },

    selectSlot(
      slot: number,
      reason?: string,
      selectOptions?: HotbarSelectionApplyOptions,
    ): InventoryCatalog | null {
      return select(
        {
          selectedSlot: slot,
          selectedSlotIndex: slot,
        },
        reason ?? "select-slot",
        selectOptions,
      );
    },

    selectBlockType(blockTypeId: string, reason?: string): InventoryCatalog | null {
      const runtimeBlockTypeId = normalizeSelectedRuntimeBlockTypeId(blockTypeId);
      if (!runtimeBlockTypeId) {
        blockedSelectionCount += 1;
        return null;
      }

      return select(
        {
          blockTypeId: runtimeBlockTypeId,
          runtimeBlockTypeId,
        },
        reason ?? "select-runtime-block-type",
      );
    },

    selectRuntimeBlockType(
      runtimeBlockTypeId: string,
      reason?: string,
    ): InventoryCatalog | null {
      const normalizedRuntimeBlockTypeId =
        normalizeSelectedRuntimeBlockTypeId(runtimeBlockTypeId);
      if (!normalizedRuntimeBlockTypeId) {
        blockedSelectionCount += 1;
        return null;
      }

      return select(
        {
          runtimeBlockTypeId: normalizedRuntimeBlockTypeId,
          blockTypeId: normalizedRuntimeBlockTypeId,
        },
        reason ?? "select-runtime-block-type",
      );
    },

    selectLibraryItem(libraryItemId: string, reason?: string): InventoryCatalog | null {
      const normalized = nullableString(libraryItemId);
      if (!normalized) {
        blockedSelectionCount += 1;
        return null;
      }

      return select(
        {
          libraryItemId: normalized,
        },
        reason ?? "select-library-item",
      );
    },

    selectFamily(familyId: string, reason?: string): InventoryCatalog | null {
      const normalized = nullableString(familyId);
      if (!normalized) {
        blockedSelectionCount += 1;
        return null;
      }

      return select(
        {
          familyId: normalized,
        },
        reason ?? "select-family",
      );
    },

    selectVplib(vplibUid: string, reason?: string): InventoryCatalog | null {
      const normalized = nullableString(vplibUid);
      if (!normalized) {
        blockedSelectionCount += 1;
        return null;
      }

      return select(
        {
          vplibUid: normalized,
        },
        reason ?? "select-vplib",
      );
    },

    selectNext(reason?: string): InventoryCatalog | null {
      return selectRelative(1, reason ?? "select-next");
    },

    selectPrevious(reason?: string): InventoryCatalog | null {
      return selectRelative(-1, reason ?? "select-previous");
    },

    getStatus(): HotbarControllerStatus {
      return status;
    },

    getCatalog(): InventoryCatalog | null {
      return catalog;
    },

    getSelectedItem(): InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem | null {
      return selectedPlaceableItem(catalog);
    },

    getSelectedLibraryItem(): InventoryLibraryItem | null {
      return selectedLibraryItem(catalog);
    },

    getSelectedBlockItem(): InventoryBlockItem | null {
      return selectedBlockItem(catalog);
    },

    getSelectedRuntimeBlockTypeId(): string | null {
      return selectedRuntimeBlockTypeId(catalog);
    },

    getSelectedRuntimePlaceable,

    getSnapshot(): HotbarControllerSnapshot {
      return {
        kind: HOTBAR_CONTROLLER_SNAPSHOT_KIND,
        status,
        selectedSlot: catalog?.selection.selectedSlot ?? defaultSelectedSlot,
        selectedSlotIndex: catalog?.selection.selectedSlotIndex ?? defaultSelectedSlot,
        selectedBlockTypeId: selectedRuntimeBlockTypeId(catalog),
        selectedRuntimeBlockTypeId: selectedRuntimeBlockTypeId(catalog),
        selectedLibraryItemId:
          catalog?.selection.selectedPlacementRef?.libraryItemId ?? null,
        selectedFamilyId:
          catalog?.selection.selectedPlacementRef?.familyId ?? null,
        selectedPackageId:
          catalog?.selection.selectedPlacementRef?.packageId ?? null,
        selectedVplibUid:
          catalog?.selection.selectedPlacementRef?.vplibUid ?? null,
        selectedVariantId:
          catalog?.selection.selectedPlacementRef?.variantId ?? null,
        selectedRevisionHash:
          catalog?.selection.selectedPlacementRef?.revisionHash ?? null,
        selectedObjectKind: selectedObjectKind(catalog),
        itemCount: catalog?.items.length ?? 0,
        libraryItemCount: catalog?.libraryItems.length ?? 0,
        blockItemCount: catalog?.blockItems.length ?? 0,
        assetItemCount: catalog?.assetItems.length ?? 0,
        hotbarSlotCount: catalog?.hotbarSlots.length ?? 0,
        sourceKind: catalog?.sourceKind ?? null,
        usedPaletteFallback: catalog?.usedPaletteFallback ?? false,
        usedFallback: catalogUsesFallback(catalog),
        hasPlaceableItems: catalogHasPlaceableItems(catalog),
        hasPlaceableLibraryItems: catalogHasPlaceableLibraryItems(catalog),
        onlyLibraryItemsPlaceable,
        allowLegacyChunkInventory,
        loadedAt: catalog?.loadedAt ?? null,
        updatedAt,
        lastError,
        destroyed,
        initializeCount,
        loadCount,
        reloadCount,
        selectionCount,
        renderCount,
        blockedSelectionCount,
        lastReason,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
        browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
        debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      };
    },

    render,

    clearCache(): void {
      try {
        if (hasInventoryClearCache(inventorySource)) {
          inventorySource.clearCache();
        }

        clearHotbarControllerCaches();
      } catch {
        // Cache clearing is best-effort.
      }
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      setStatus("destroyed", reason ?? "hotbar-controller-destroy");
      cleanup();

      if (destroyInventorySourceOnDestroy) {
        try {
          if (hasInventoryDestroy(inventorySource)) {
            inventorySource.destroy(reason ?? "hotbar-controller-destroy");
          }
        } catch {
          // Ignore.
        }
      }

      logDebug(logger, "Hotbar controller destroyed.", {
        reason: reason ?? null,
        initializeCount,
        loadCount,
        reloadCount,
        selectionCount,
        renderCount,
        blockedSelectionCount,
      });
    },
  };

  logDebug(logger, "Hotbar controller created.", {
    slotCount,
    defaultSelectedSlot,
    defaultRuntimeBlockTypeId,
    defaultLibraryItemId,
    defaultFamilyId,
    defaultPackageId,
    defaultVplibUid,
    defaultVariantId,
    defaultRevisionHash,
    defaultObjectKind,
    keyboard: enableKeyboardShortcuts,
    wheel: enableWheelSelection,
    slotClick: enableSlotClickSelection,
    allowLegacyChunkInventory,
    onlyLibraryItemsPlaceable,
    allowEmptyFallback,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  });

  return controller;
}

export function isHotbarControllerHandle(
  value: unknown,
): value is HotbarControllerHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<HotbarControllerHandle>;

    return (
      record.kind === HOTBAR_CONTROLLER_KIND &&
      typeof record.initialize === "function" &&
      typeof record.load === "function" &&
      typeof record.reload === "function" &&
      typeof record.selectSlot === "function" &&
      typeof record.getSnapshot === "function" &&
      typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}

export function hotbarControllerSnapshotToDebug(
  snapshot: HotbarControllerSnapshot,
): Record<string, unknown> {
  return {
    kind: snapshot.kind,
    status: snapshot.status,
    selectedSlot: snapshot.selectedSlot,
    selectedSlotIndex: snapshot.selectedSlotIndex,
    selectedRuntimeBlockTypeId: snapshot.selectedRuntimeBlockTypeId,
    selectedLibraryItemId: snapshot.selectedLibraryItemId,
    selectedFamilyId: snapshot.selectedFamilyId,
    selectedPackageId: snapshot.selectedPackageId,
    selectedVplibUid: snapshot.selectedVplibUid,
    selectedVariantId: snapshot.selectedVariantId,
    selectedRevisionHash: snapshot.selectedRevisionHash,
    selectedObjectKind: snapshot.selectedObjectKind,
    itemCount: snapshot.itemCount,
    libraryItemCount: snapshot.libraryItemCount,
    blockItemCount: snapshot.blockItemCount,
    assetItemCount: snapshot.assetItemCount,
    hotbarSlotCount: snapshot.hotbarSlotCount,
    sourceKind: snapshot.sourceKind,
    usedFallback: snapshot.usedFallback,
    hasPlaceableItems: snapshot.hasPlaceableItems,
    hasPlaceableLibraryItems: snapshot.hasPlaceableLibraryItems,
    onlyLibraryItemsPlaceable: snapshot.onlyLibraryItemsPlaceable,
    allowLegacyChunkInventory: snapshot.allowLegacyChunkInventory,
    lastError: snapshot.lastError?.error?.message ?? null,
    lastReason: snapshot.lastReason,
    productiveInventoryRoute: snapshot.productiveInventoryRoute,
    counts: {
      initialize: snapshot.initializeCount,
      load: snapshot.loadCount,
      reload: snapshot.reloadCount,
      selection: snapshot.selectionCount,
      render: snapshot.renderCount,
      blockedSelection: snapshot.blockedSelectionCount,
    },
    contract: editorInventoryContractDiagnostics({
      sourceKind: snapshot.sourceKind,
      runtimeBlockTypeId: snapshot.selectedRuntimeBlockTypeId,
      libraryItemId: snapshot.selectedLibraryItemId,
      familyId: snapshot.selectedFamilyId,
      packageId: snapshot.selectedPackageId,
      vplibUid: snapshot.selectedVplibUid,
      variantId: snapshot.selectedVariantId,
      revisionHash: snapshot.selectedRevisionHash,
      objectKind: snapshot.selectedObjectKind,
    }),
    rules: {
      ...editorInventoryContractRules(),
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: snapshot.onlyLibraryItemsPlaceable,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
      legacyChunkInventoryIsDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
      forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    },
  };
}

export function getHotbarControllerMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.inventory.hotbar_controller",
    controllerKind: HOTBAR_CONTROLLER_KIND,
    snapshotKind: HOTBAR_CONTROLLER_SNAPSHOT_KIND,
    supportsLibraryInventorySource: true,
    supportsLegacyChunkInventorySource: true,
    legacyChunkInventoryRequiresExplicitAllow: true,
    defaultSlotCount: DEFAULT_SLOT_COUNT,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    contract: getEditorInventoryContractMetadata(),
    rules: {
      ...editorInventoryContractRules(),
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      emptyFallbackCreatesPlaceableItems: false,
      chunkInventoryIsNeverDefault: true,
      selectedRuntimePlaceableIncludesFullLibraryIdentity: true,
      sourceCapabilitiesComeFromCentralContract: true,
      selectSlotIsOptionalSourceCapability: true,
      slotCountUsesBroadNumberInternally: true,
      hotbarSlotObjectKindReadDefensively: true,
    },
  };
}
