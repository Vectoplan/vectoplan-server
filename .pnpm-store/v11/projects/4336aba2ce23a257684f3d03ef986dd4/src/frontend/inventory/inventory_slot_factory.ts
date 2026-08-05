// services/vectoplan-editor/src/frontend/inventory/inventory_slot_factory.ts
import type {
  ChunkApiBlockDefinition,
  ChunkApiBlocksResult,
  ChunkApiPlaceableBlockDefinition,
} from "@api/chunk_api_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryLoadResult,
  EditorInventoryPayload,
  EditorInventoryPlacementCommand,
  EditorInventorySlot,
  EditorInventoryState,
} from "@api/editor_inventory_models";
import {
  getEditorInventoryLoadError,
  getEditorInventoryLoadReason,
} from "@api/editor_inventory_models";
import {
  buildEmptyInventoryState,
  normalizeEditorInventoryState,
} from "@api/editor_inventory_normalize";
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
  isForbiddenDebugBlockTypeId,
  normalizeContractInteger,
  normalizeContractText,
  normalizeInventorySourceKind,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId,
} from "../contracts/editor_inventory_contract";
import {
  DEFAULT_HOTBAR_SLOT_COUNT,
  DEFAULT_PLACEABLE_BLOCK_TYPE_ID,
  createEmptyInventoryItem,
  createFallbackInventoryCatalog,
  createHotbarSlots,
  createInventoryCatalogFromBlocksResult,
  createInventoryCatalogFromLibraryInventory,
  createInventoryItemsFromBlocks,
  createInventoryItemsFromLibrarySlots,
  getInventoryAssetItems,
  getInventoryBlockItems,
  getInventoryLibraryItems,
  getInventoryPlaceableItems,
  inventoryCatalogContainsForbiddenDebugBlocks,
  inventoryCatalogToDebugSummary,
  isInventoryCatalog,
  isLibraryInventoryCatalog,
  normalizeInventoryCatalog,
  selectInventoryItem,
  updateInventorySelection,
  type HotbarSlot,
  type InventoryCatalog,
  type InventoryDebugSummary,
  type InventoryItem,
  type InventoryLibraryItem,
  type InventoryLoadStatus,
  type InventorySelectionOptions,
  type InventorySourceKind,
} from "./inventory_models";

export const INVENTORY_SLOT_FACTORY_MODULE_NAME =
  "frontend.inventory.inventory_slot_factory";
export const INVENTORY_SLOT_FACTORY_MODULE_VERSION = "0.3.1";

export type InventorySlotFactoryStatus =
  | "ready"
  | "degraded"
  | "fallback"
  | "empty"
  | "failed";

export interface InventoryDomSlot {
  readonly slot: number;
  readonly label: string;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly color: string | null;
  readonly selected: boolean;
  readonly enabled: boolean;
  readonly itemKind: InventoryItem["kind"];
  readonly sourceKind: InventorySourceKind;
}

export interface InventorySlotFactoryOptions extends InventorySelectionOptions {
  readonly projectId?: string;
  readonly worldId?: string;
  readonly registryId?: string;
  readonly registryVersion?: string;
  readonly slotCount?: number;
  readonly allowDisabledBlocks?: boolean;
  readonly allowChunkBlocks?: boolean;
  readonly allowDebugBlocks?: boolean;
  readonly allowEmptyFallback?: boolean;
  readonly sourceKind?: InventorySourceKind;
  readonly status?: InventoryLoadStatus;
  readonly errorMessage?: string | null;
  readonly fallbackReason?: string | null;
  readonly loadedAt?: string | null;
}

export interface InventorySlotFactoryBlocksInput
  extends InventorySlotFactoryOptions {
  readonly blocks: readonly (
    | ChunkApiBlockDefinition
    | ChunkApiPlaceableBlockDefinition
  )[];
}

export interface InventorySlotFactoryLibraryInput
  extends InventorySlotFactoryOptions {
  readonly payload?: EditorInventoryPayload | null;
  readonly state?: EditorInventoryState | null;
  readonly loadResult?: EditorInventoryLoadResult | null;
}

export interface InventorySlotFactoryResult {
  readonly kind: "inventory-slot-factory-result.v1";
  readonly status: InventorySlotFactoryStatus;
  readonly catalog: InventoryCatalog;
  readonly hotbarSlots: readonly HotbarSlot[];
  readonly domSlots: readonly InventoryDomSlot[];
  readonly debug: InventoryDebugSummary;
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
  readonly selectedLibraryRef: EditorInventoryLibraryRef | null;
  readonly selectedPlacementCommand: EditorInventoryPlacementCommand | null;
  readonly hasPlaceableItems: boolean;
  readonly hasPlaceableLibraryItems: boolean;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly usedFallback: boolean;
  readonly errorMessage: string | null;
  readonly createdAt: string;
}

export interface InventorySlotFactorySelectionUpdate {
  readonly catalog: InventoryCatalog;
  readonly selection: InventorySelectionOptions;
  readonly fallbackReason?: string | null;
}

const INVENTORY_SLOT_FACTORY_RESULT_KIND =
  "inventory-slot-factory-result.v1" as const;

const MAX_INVENTORY_SLOT_FACTORY_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string>();
const NULLABLE_TEXT_CACHE = new Map<string, string | null>();
const INTEGER_CACHE = new Map<string, number>();
const ERROR_MESSAGE_CACHE = new Map<string, string>();

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_INVENTORY_SLOT_FACTORY_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearInventorySlotFactoryCaches(): void {
  try {
    TEXT_CACHE.clear();
    NULLABLE_TEXT_CACHE.clear();
    INTEGER_CACHE.clear();
    ERROR_MESSAGE_CACHE.clear();
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

      const normalized = normalizeContractText(value, fallback);
      return setCachedValue(TEXT_CACHE, value, normalized);
    }

    return normalizeContractText(value, fallback);
  } catch {
    return fallback;
  }
}

function safeNullableString(
  value: unknown,
  fallback: string | null = null,
): string | null {
  try {
    if (typeof value === "string") {
      const cached = NULLABLE_TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached ?? fallback;
      }

      const normalized = normalizeOptionalContractText(value) ?? fallback;
      return setCachedValue(NULLABLE_TEXT_CACHE, value, normalized);
    }

    return normalizeOptionalContractText(value) ?? fallback;
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

function normalizeSlotCount(value: unknown): number {
  return safeInteger(
    value,
    DEFAULT_HOTBAR_SLOT_COUNT || DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
    1,
    64,
  );
}

function normalizeSlotIndex(value: unknown, slotCount: number): number {
  return safeInteger(value, 0, 0, Math.max(0, slotCount - 1));
}

function normalizeStatus(
  value: unknown,
  fallback: InventoryLoadStatus,
): InventoryLoadStatus {
  if (
    value === "idle" ||
    value === "loading" ||
    value === "ready" ||
    value === "degraded" ||
    value === "failed" ||
    value === "empty" ||
    value === "fallback" ||
    value === "error" ||
    value === "destroyed"
  ) {
    return value;
  }

  return fallback;
}

function normalizeSourceKind(
  value: unknown,
  fallback: InventorySourceKind,
): InventorySourceKind {
  try {
    return normalizeInventorySourceKind(value, fallback) as InventorySourceKind;
  } catch {
    return fallback;
  }
}

function errorMessageFromUnknown(error: unknown, fallback: string): string {
  try {
    const key =
      error instanceof Error
        ? `${error.name}:${error.message}`
        : typeof error === "string"
          ? error
          : JSON.stringify(error);

    const cached = ERROR_MESSAGE_CACHE.get(key);
    if (cached !== undefined) {
      return cached || fallback;
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return setCachedValue(ERROR_MESSAGE_CACHE, key, error.message.trim());
    }

    const message = safeString(error, "");

    return setCachedValue(ERROR_MESSAGE_CACHE, key, message || fallback);
  } catch {
    return fallback;
  }
}

function unknownRecord(value: unknown): Record<string, unknown> {
  return asEditorInventoryContractRecord(value);
}

function inventoryItemField(item: InventoryItem, key: string): unknown {
  try {
    return unknownRecord(item)[key];
  } catch {
    return null;
  }
}

function hotbarSlotField(slot: HotbarSlot, key: string): unknown {
  try {
    return unknownRecord(slot)[key];
  } catch {
    return null;
  }
}

function hotbarSlotStringField(
  slot: HotbarSlot,
  key: string,
  fallback: string | null = null,
): string | null {
  try {
    return safeNullableString(hotbarSlotField(slot, key), fallback);
  } catch {
    return fallback;
  }
}

function inventoryItemRuntimeBlockTypeId(item: InventoryItem): string | null {
  try {
    return normalizeRuntimeBlockTypeId(
      inventoryItemField(item, "runtimeBlockTypeId") ??
        inventoryItemField(item, "blockTypeId"),
    );
  } catch {
    return null;
  }
}

function inventoryItemBlockTypeId(item: InventoryItem): string | null {
  try {
    return normalizeRuntimeBlockTypeId(
      inventoryItemField(item, "blockTypeId") ??
        inventoryItemField(item, "runtimeBlockTypeId"),
    );
  } catch {
    return null;
  }
}

function inventoryItemLibraryField(
  item: InventoryItem,
  key: string,
): string | null {
  return safeNullableString(inventoryItemField(item, key), null);
}

function cloneItemWithSlot(item: InventoryItem, slot: number): InventoryItem {
  try {
    if (item.slot === slot) {
      return item;
    }

    if (item.kind === "empty") {
      return createEmptyInventoryItem(slot, item.disabledReason);
    }

    return {
      ...item,
      slot,
    } as InventoryItem;
  } catch {
    return createEmptyInventoryItem(
      slot,
      "Inventory slot normalization failed.",
    );
  }
}

function normalizeItemsToSlotCount(
  items: readonly InventoryItem[],
  slotCount: number,
): readonly InventoryItem[] {
  try {
    const normalizedSlotCount = normalizeSlotCount(slotCount);
    const bySlot = new Map<number, InventoryItem>();

    for (const item of items) {
      const slot = normalizeSlotIndex(item.slot, normalizedSlotCount);

      if (bySlot.has(slot)) {
        continue;
      }

      bySlot.set(slot, cloneItemWithSlot(item, slot));
    }

    return Array.from(
      { length: normalizedSlotCount },
      (_, slot) => bySlot.get(slot) ?? createEmptyInventoryItem(slot),
    );
  } catch {
    return Array.from(
      { length: normalizeSlotCount(slotCount) },
      (_, slot) =>
        createEmptyInventoryItem(
          slot,
          "Inventory slot normalization failed.",
        ),
    );
  }
}

function catalogHasPlaceableLibraryItems(catalog: InventoryCatalog): boolean {
  try {
    return catalog.libraryItems.some(
      (item) => item.enabled && Boolean(item.runtimeBlockTypeId),
    );
  } catch {
    return false;
  }
}

function catalogHasPlaceableItems(catalog: InventoryCatalog): boolean {
  try {
    return catalog.placeableItems.some((item) => item.enabled);
  } catch {
    return false;
  }
}

function getSelectedLibraryItem(
  catalog: InventoryCatalog,
): InventoryLibraryItem | null {
  try {
    return catalog.selection.selectedLibraryItem;
  } catch {
    return null;
  }
}

function getSelectedLibraryRef(
  catalog: InventoryCatalog,
): EditorInventoryLibraryRef | null {
  try {
    return catalog.selection.selectedLibraryRef;
  } catch {
    return null;
  }
}

function getSelectedPlacementCommand(
  catalog: InventoryCatalog,
): EditorInventoryPlacementCommand | null {
  try {
    return catalog.selection.selectedPlacementCommand;
  } catch {
    return null;
  }
}

function catalogUsesFallback(catalog: InventoryCatalog): boolean {
  return (
    catalog.sourceKind === "static-fallback" ||
    catalog.sourceKind === "empty-fallback" ||
    catalog.sourceKind === "fallback" ||
    catalog.status === "empty" ||
    catalog.status === "fallback"
  );
}

function containsForbiddenDebugBlocks(value: unknown): boolean {
  return containsForbiddenDebugBlockTypeId(value);
}

function sanitizeCatalog(
  catalog: InventoryCatalog,
  options?: Pick<
    InventorySlotFactoryOptions,
    "projectId" | "worldId" | "slotCount" | "selectedSlot" | "selectedSlotIndex"
  >,
): InventoryCatalog {
  if (inventoryCatalogContainsForbiddenDebugBlocks(catalog)) {
    return createFallbackInventoryCatalog({
      projectId: options?.projectId ?? catalog.projectId,
      worldId: options?.worldId ?? catalog.worldId,
      slotCount: options?.slotCount ?? catalog.slotCount,
      selectedSlot:
        options?.selectedSlotIndex ??
        options?.selectedSlot ??
        catalog.selection.selectedSlot,
      selectedSlotIndex:
        options?.selectedSlotIndex ??
        options?.selectedSlot ??
        catalog.selection.selectedSlotIndex,
      reason: "Inventory catalog contained forbidden debug block ids.",
    });
  }

  return catalog;
}

function domSlotsFromHotbarSlots(
  slots: readonly HotbarSlot[],
): readonly InventoryDomSlot[] {
  try {
    return slots.map((slot) => {
      const itemRecord = unknownRecord(slot.item);

      const runtimeBlockTypeId =
        slot.runtimeBlockTypeId ??
        slot.blockTypeId ??
        normalizeRuntimeBlockTypeId(itemRecord.runtimeBlockTypeId) ??
        normalizeRuntimeBlockTypeId(itemRecord.blockTypeId);

      const blockTypeId =
        slot.blockTypeId ??
        slot.runtimeBlockTypeId ??
        normalizeRuntimeBlockTypeId(itemRecord.blockTypeId) ??
        normalizeRuntimeBlockTypeId(itemRecord.runtimeBlockTypeId);

      return {
        slot: slot.slot,
        label: slot.label,
        blockTypeId,
        runtimeBlockTypeId,
        libraryItemId:
          slot.libraryItemId ??
          safeNullableString(itemRecord.libraryItemId, null),
        familyId:
          slot.familyId ??
          safeNullableString(itemRecord.familyId, null),
        packageId:
          slot.packageId ??
          safeNullableString(itemRecord.packageId, null),
        vplibUid:
          slot.vplibUid ??
          safeNullableString(itemRecord.vplibUid, null),
        variantId:
          slot.variantId ??
          safeNullableString(itemRecord.variantId, null),
        revisionHash:
          slot.revisionHash ??
          safeNullableString(itemRecord.revisionHash, null),
        objectKind:
          hotbarSlotStringField(slot, "objectKind") ??
          safeNullableString(itemRecord.objectKind, null),
        color: slot.color,
        selected: slot.selected,
        enabled: slot.enabled,
        itemKind: slot.item.kind,
        sourceKind: slot.sourceKind,
      };
    });
  } catch {
    return [];
  }
}

function catalogToFactoryResult(
  catalogInput: InventoryCatalog,
  options?: {
    readonly usedFallback?: boolean;
    readonly errorMessage?: string | null;
    readonly selection?: InventorySelectionOptions;
    readonly fallbackContext?: Pick<
      InventorySlotFactoryOptions,
      "projectId" | "worldId" | "slotCount" | "selectedSlot" | "selectedSlotIndex"
    >;
  },
): InventorySlotFactoryResult {
  const sanitized = sanitizeCatalog(catalogInput, options?.fallbackContext);
  const catalog = options?.selection
    ? updateInventorySelection(sanitized, options.selection)
    : sanitized;

  const errorMessage = options?.errorMessage ?? catalog.errorMessage ?? null;
  const usedFallback = options?.usedFallback ?? catalogUsesFallback(catalog);
  const status = normalizeFactoryStatus(catalog, usedFallback, errorMessage);
  const selectedLibraryItem = getSelectedLibraryItem(catalog);
  const selectedLibraryRef = getSelectedLibraryRef(catalog);
  const selectedPlacementCommand = getSelectedPlacementCommand(catalog);
  const selectedPlacementRef = catalog.selection.selectedPlacementRef ?? null;

  return {
    kind: INVENTORY_SLOT_FACTORY_RESULT_KIND,
    status,
    catalog,
    hotbarSlots: catalog.hotbarSlots,
    domSlots: domSlotsFromHotbarSlots(catalog.hotbarSlots),
    debug: inventoryCatalogToDebugSummary(catalog),
    selectedSlot: catalog.selection.selectedSlot,
    selectedSlotIndex: catalog.selection.selectedSlotIndex,
    selectedBlockTypeId: catalog.selection.selectedBlockTypeId,
    selectedRuntimeBlockTypeId: catalog.selection.selectedRuntimeBlockTypeId,
    selectedLibraryItemId:
      selectedLibraryItem?.libraryItemId ??
      selectedPlacementRef?.libraryItemId ??
      null,
    selectedFamilyId:
      selectedLibraryItem?.familyId ?? selectedPlacementRef?.familyId ?? null,
    selectedPackageId:
      selectedLibraryItem?.packageId ?? selectedPlacementRef?.packageId ?? null,
    selectedVplibUid:
      selectedLibraryItem?.vplibUid ?? selectedPlacementRef?.vplibUid ?? null,
    selectedVariantId:
      selectedLibraryItem?.variantId ?? selectedPlacementRef?.variantId ?? null,
    selectedRevisionHash:
      selectedLibraryItem?.revisionHash ??
      selectedPlacementRef?.revisionHash ??
      null,
    selectedObjectKind:
      selectedLibraryItem?.objectKind ?? selectedPlacementRef?.objectKind ?? null,
    selectedLibraryRef,
    selectedPlacementCommand,
    hasPlaceableItems: catalogHasPlaceableItems(catalog),
    hasPlaceableLibraryItems: catalogHasPlaceableLibraryItems(catalog),
    onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
    usedFallback,
    errorMessage,
    createdAt: nowIsoStringSafe(),
  };
}

function normalizeFactoryStatus(
  catalog: InventoryCatalog,
  usedFallback: boolean,
  errorMessage: string | null,
): InventorySlotFactoryStatus {
  try {
    if (
      errorMessage ||
      catalog.status === "failed" ||
      catalog.status === "error"
    ) {
      return usedFallback ? "fallback" : "failed";
    }

    if (usedFallback) {
      return catalog.status === "empty" ? "empty" : "fallback";
    }

    if (catalog.status === "empty") {
      return "empty";
    }

    if (catalog.status === "degraded") {
      return "degraded";
    }

    return "ready";
  } catch {
    return "failed";
  }
}

function selectionFromOptionsOrCatalog(
  catalog: InventoryCatalog,
  options?: InventorySlotFactoryOptions,
): InventorySelectionOptions {
  return {
    selectedSlot:
      options?.selectedSlotIndex ??
      options?.selectedSlot ??
      catalog.selection.selectedSlot,
    selectedSlotIndex:
      options?.selectedSlotIndex ??
      options?.selectedSlot ??
      catalog.selection.selectedSlotIndex,
    blockTypeId:
      options?.blockTypeId ??
      catalog.selection.selectedRuntimeBlockTypeId ??
      catalog.selection.selectedBlockTypeId,
    runtimeBlockTypeId:
      options?.runtimeBlockTypeId ??
      catalog.selection.selectedRuntimeBlockTypeId,
    assetTypeId: options?.assetTypeId,
    libraryItemId:
      options?.libraryItemId ?? catalog.selection.selectedPlacementRef?.libraryItemId,
    inventoryItemId: options?.inventoryItemId,
    inventorySlotIndex: options?.inventorySlotIndex,
    familyId: options?.familyId ?? catalog.selection.selectedPlacementRef?.familyId,
    packageId:
      options?.packageId ?? catalog.selection.selectedPlacementRef?.packageId,
    vplibUid:
      options?.vplibUid ?? catalog.selection.selectedPlacementRef?.vplibUid,
    variantId:
      options?.variantId ?? catalog.selection.selectedPlacementRef?.variantId,
    revisionHash:
      options?.revisionHash ??
      catalog.selection.selectedPlacementRef?.revisionHash,
    objectKind:
      options?.objectKind ?? catalog.selection.selectedPlacementRef?.objectKind,
    preferEnabled: options?.preferEnabled,
  };
}

function payloadFromLoadResult(
  result: EditorInventoryLoadResult | null | undefined,
): EditorInventoryPayload | null {
  if (!result) {
    return null;
  }

  if (result.ok) {
    return result.payload;
  }

  return result.payload ?? null;
}

function stateFromPayloadOrState(
  payload?: EditorInventoryPayload | null,
  state?: EditorInventoryState | null,
): EditorInventoryState | null {
  if (state) {
    return state;
  }

  if (payload?.inventory) {
    return payload.inventory;
  }

  return null;
}

function stateFromLoadResult(
  result: EditorInventoryLoadResult | null | undefined,
): EditorInventoryState | null {
  if (!result) {
    return null;
  }

  if (result.ok) {
    return result.state;
  }

  return result.state ?? result.payload?.inventory ?? null;
}

function errorFromLoadResult(
  result: EditorInventoryLoadResult | null | undefined,
): string | null {
  if (!result || result.ok) {
    return null;
  }

  const error = getEditorInventoryLoadError(result);
  return error?.message ?? getEditorInventoryLoadReason(
    result,
    "Library inventory load failed.",
  );
}

function slotCountFromLibraryState(
  state: EditorInventoryState | null,
  fallback?: number,
): number {
  if (!state) {
    return normalizeSlotCount(fallback ?? DEFAULT_HOTBAR_SLOT_COUNT);
  }

  const record = unknownRecord(state);

  return normalizeSlotCount(
    record.hotbarSize ??
      record.hotbar_size ??
      state.slots?.length ??
      fallback ??
      DEFAULT_HOTBAR_SLOT_COUNT,
  );
}

function selectedSlotFromLibraryState(
  state: EditorInventoryState | null,
  fallback?: number,
): number {
  if (!state) {
    return normalizeSlotIndex(fallback ?? 0, DEFAULT_HOTBAR_SLOT_COUNT);
  }

  const slotCount = slotCountFromLibraryState(state);
  const record = unknownRecord(state);

  return normalizeSlotIndex(
    record.selectedSlot ??
      record.selected_slot ??
      record.defaultSelectedSlot ??
      record.default_selected_slot ??
      fallback ??
      0,
    slotCount,
  );
}

function normalizeLibraryState(
  state: EditorInventoryState,
  options?: InventorySlotFactoryOptions,
): EditorInventoryState {
  if (containsForbiddenDebugBlocks(state)) {
    return buildEmptyInventoryState({
      hotbarSize: options?.slotCount ?? slotCountFromLibraryState(state),
      selectedSlot:
        options?.selectedSlotIndex ??
        options?.selectedSlot ??
        selectedSlotFromLibraryState(state),
      sourceDetail: "forbidden-debug-items-detected",
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    });
  }

  return normalizeEditorInventoryState(state, {
    hotbarSize: options?.slotCount ?? slotCountFromLibraryState(state),
    selectedSlot:
      options?.selectedSlotIndex ??
      options?.selectedSlot ??
      selectedSlotFromLibraryState(state),
    includeEmptySlots: true,
    source: "library",
    sourceDetail: "library-inventory",
    route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  });
}

export function createInventoryCatalogFromItems(
  items: readonly InventoryItem[],
  options?: InventorySlotFactoryOptions,
): InventoryCatalog {
  try {
    const slotCount = normalizeSlotCount(
      options?.slotCount ?? Math.max(items.length, DEFAULT_HOTBAR_SLOT_COUNT),
    );
    const normalizedItems = normalizeItemsToSlotCount(items, slotCount);
    const selection = selectInventoryItem(normalizedItems, {
      selectedSlot: options?.selectedSlotIndex ?? options?.selectedSlot,
      selectedSlotIndex: options?.selectedSlotIndex ?? options?.selectedSlot,
      blockTypeId: options?.blockTypeId,
      runtimeBlockTypeId: options?.runtimeBlockTypeId,
      assetTypeId: options?.assetTypeId,
      libraryItemId: options?.libraryItemId,
      inventoryItemId: options?.inventoryItemId,
      inventorySlotIndex: options?.inventorySlotIndex,
      familyId: options?.familyId,
      packageId: options?.packageId,
      vplibUid: options?.vplibUid,
      variantId: options?.variantId,
      revisionHash: options?.revisionHash,
      objectKind: options?.objectKind,
      preferEnabled: options?.preferEnabled,
    });
    const hotbarSlots = createHotbarSlots(normalizedItems, selection);
    const libraryItems = getInventoryLibraryItems(normalizedItems);
    const blockItems = getInventoryBlockItems(normalizedItems);
    const assetItems = getInventoryAssetItems(normalizedItems);
    const placeableItems = getInventoryPlaceableItems(normalizedItems);
    const sourceKind = normalizeSourceKind(
      options?.sourceKind,
      libraryItems.length > 0 ? "library" : "runtime-generated",
    );
    const status = normalizeStatus(
      options?.status,
      placeableItems.length > 0 ? "ready" : "empty",
    );

    return {
      sourceKind,
      status,
      projectId: safeString(options?.projectId, "dev-project"),
      worldId: safeString(options?.worldId, "world_spawn"),
      registryId: safeString(options?.registryId, "editor-runtime-inventory"),
      registryVersion: safeString(options?.registryVersion, "v1"),
      slotCount,
      items: normalizedItems,
      libraryItems,
      blockItems,
      assetItems,
      placeableItems,
      hotbarSlots,
      selection,
      blockTypeIds: blockItems
        .map((item) => item.blockTypeId)
        .filter((value) => !isForbiddenDebugBlockTypeId(value)),
      runtimeBlockTypeIds: placeableItems
        .map((item) => inventoryItemRuntimeBlockTypeId(item))
        .filter((value): value is string => Boolean(value)),
      libraryItemIds: libraryItems
        .map((item) => item.libraryItemId)
        .filter((value): value is string => Boolean(value)),
      familyIds: libraryItems
        .map((item) => item.familyId)
        .filter((value): value is string => Boolean(value)),
      vplibUids: libraryItems
        .map((item) => item.vplibUid)
        .filter((value): value is string => Boolean(value)),
      usedPaletteFallback: false,
      loadedAt: options?.loadedAt ?? nowIsoStringSafe(),
      errorMessage: safeNullableString(options?.errorMessage, null),
      rawResult: null,
    };
  } catch (error) {
    return createFallbackInventoryCatalog({
      projectId: options?.projectId,
      worldId: options?.worldId,
      slotCount: options?.slotCount,
      selectedSlot: options?.selectedSlotIndex ?? options?.selectedSlot,
      selectedSlotIndex: options?.selectedSlotIndex ?? options?.selectedSlot,
      reason: `Inventory catalog from items failed: ${errorMessageFromUnknown(
        error,
        "unknown error",
      )}`,
    });
  }
}

export function createInventorySlotFactoryResultFromLibraryInventory(
  input: InventorySlotFactoryLibraryInput,
): InventorySlotFactoryResult {
  try {
    const loadError = errorFromLoadResult(input.loadResult);
    const stateFromResult = stateFromLoadResult(input.loadResult);
    const state = stateFromResult ?? stateFromPayloadOrState(input.payload, input.state);

    if (!state) {
      return createFallbackInventorySlotFactoryResult({
        ...input,
        fallbackReason:
          input.fallbackReason ?? loadError ?? "Library inventory state was empty.",
      });
    }

    const normalizedState = normalizeLibraryState(state, input);
    const selectedSlot =
      input.selectedSlotIndex ??
      input.selectedSlot ??
      selectedSlotFromLibraryState(normalizedState);
    const slotCount = input.slotCount ?? slotCountFromLibraryState(normalizedState);

    const catalog = createInventoryCatalogFromLibraryInventory({
      payload: input.payload ?? payloadFromLoadResult(input.loadResult),
      state: normalizedState,
      projectId: input.projectId,
      worldId: input.worldId,
      slotCount,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
      allowEmptyFallback: input.allowEmptyFallback,
      reason: input.fallbackReason ?? loadError,
    });

    const selection = selectionFromOptionsOrCatalog(catalog, input);
    const selectedCatalog = updateInventorySelection(
      sanitizeCatalog(catalog, input),
      selection,
    );

    return catalogToFactoryResult(selectedCatalog, {
      usedFallback: catalogUsesFallback(selectedCatalog),
      errorMessage: loadError ?? selectedCatalog.errorMessage,
      selection: selectionFromOptionsOrCatalog(selectedCatalog, input),
      fallbackContext: input,
    });
  } catch (error) {
    return createFallbackInventorySlotFactoryResult({
      ...input,
      fallbackReason: `Library inventory mapping failed: ${errorMessageFromUnknown(
        error,
        "unknown error",
      )}`,
    });
  }
}

export function createInventorySlotFactoryResultFromEditorInventoryState(
  state: EditorInventoryState | null | undefined,
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  return createInventorySlotFactoryResultFromLibraryInventory({
    ...options,
    state: state ?? null,
  });
}

export function createInventorySlotFactoryResultFromEditorInventoryPayload(
  payload: EditorInventoryPayload | null | undefined,
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  return createInventorySlotFactoryResultFromLibraryInventory({
    ...options,
    payload: payload ?? null,
  });
}

export function createInventorySlotFactoryResultFromEditorInventoryLoadResult(
  loadResult: EditorInventoryLoadResult | null | undefined,
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  return createInventorySlotFactoryResultFromLibraryInventory({
    ...options,
    loadResult: loadResult ?? null,
  });
}

export function createInventorySlotFactoryResultFromBlocksResult(
  result: ChunkApiBlocksResult | null | undefined,
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  try {
    if (options?.allowChunkBlocks !== true) {
      return createFallbackInventorySlotFactoryResult({
        ...options,
        fallbackReason:
          options?.fallbackReason ??
          `Chunk blocks are disabled as inventory truth. Use ${PRODUCTIVE_EDITOR_INVENTORY_ROUTE}.`,
      });
    }

    if (!result) {
      return createFallbackInventorySlotFactoryResult({
        ...options,
        fallbackReason: options?.fallbackReason ?? "Chunk blocks result was empty.",
      });
    }

    const catalog = createInventoryCatalogFromBlocksResult({
      result,
      slotCount: options?.slotCount,
      selectedSlot: options?.selectedSlotIndex ?? options?.selectedSlot,
      selectedSlotIndex: options?.selectedSlotIndex ?? options?.selectedSlot,
      defaultBlockTypeId: options?.blockTypeId ?? DEFAULT_PLACEABLE_BLOCK_TYPE_ID,
      allowDisabledBlocks: options?.allowDisabledBlocks,
      allowChunkBlocks: true,
    });

    const selectedCatalog = updateInventorySelection(catalog, {
      selectedSlot:
        options?.selectedSlotIndex ??
        options?.selectedSlot ??
        catalog.selection.selectedSlot,
      selectedSlotIndex:
        options?.selectedSlotIndex ??
        options?.selectedSlot ??
        catalog.selection.selectedSlotIndex,
      blockTypeId:
        options?.blockTypeId ??
        catalog.selection.selectedRuntimeBlockTypeId ??
        catalog.selection.selectedBlockTypeId,
      runtimeBlockTypeId:
        options?.runtimeBlockTypeId ??
        catalog.selection.selectedRuntimeBlockTypeId,
      assetTypeId: options?.assetTypeId,
      libraryItemId: options?.libraryItemId,
      inventoryItemId: options?.inventoryItemId,
      inventorySlotIndex: options?.inventorySlotIndex,
      familyId: options?.familyId,
      packageId: options?.packageId,
      vplibUid: options?.vplibUid,
      variantId: options?.variantId,
      revisionHash: options?.revisionHash,
      objectKind: options?.objectKind,
      preferEnabled: options?.preferEnabled,
    });

    return catalogToFactoryResult(selectedCatalog, {
      usedFallback: false,
      errorMessage: null,
      fallbackContext: options,
    });
  } catch (error) {
    return createFallbackInventorySlotFactoryResult({
      ...options,
      fallbackReason: `Chunk blocks result mapping failed: ${errorMessageFromUnknown(
        error,
        "unknown error",
      )}`,
    });
  }
}

export function createInventorySlotFactoryResultFromBlocks(
  input: InventorySlotFactoryBlocksInput,
): InventorySlotFactoryResult {
  try {
    if (input.allowChunkBlocks !== true) {
      return createFallbackInventorySlotFactoryResult({
        ...input,
        fallbackReason:
          input.fallbackReason ??
          `Chunk block list is disabled as inventory truth. Use ${PRODUCTIVE_EDITOR_INVENTORY_ROUTE}.`,
      });
    }

    const slotCount = normalizeSlotCount(input.slotCount);
    const items = createInventoryItemsFromBlocks(input.blocks, slotCount, {
      allowDisabledBlocks: input.allowDisabledBlocks,
      allowDebugBlocks: input.allowDebugBlocks === true,
    });

    const catalog = createInventoryCatalogFromItems(items, {
      ...input,
      slotCount,
      sourceKind: input.sourceKind ?? "runtime-generated",
      status: input.status ?? "ready",
      loadedAt: input.loadedAt ?? nowIsoStringSafe(),
    });

    return catalogToFactoryResult(catalog, {
      usedFallback: false,
      errorMessage: input.errorMessage ?? null,
      fallbackContext: input,
    });
  } catch (error) {
    return createFallbackInventorySlotFactoryResult({
      ...input,
      fallbackReason: `Block list mapping failed: ${errorMessageFromUnknown(
        error,
        "unknown error",
      )}`,
    });
  }
}

export function createInventorySlotFactoryResultFromLibrarySlots(
  slots: readonly EditorInventorySlot[],
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  try {
    if (containsForbiddenDebugBlocks(slots)) {
      return createFallbackInventorySlotFactoryResult({
        ...options,
        fallbackReason: "Library slots contained forbidden debug block ids.",
      });
    }

    const slotCount = normalizeSlotCount(
      options?.slotCount ?? Math.max(slots.length, DEFAULT_HOTBAR_SLOT_COUNT),
    );
    const items = createInventoryItemsFromLibrarySlots(slots, slotCount);
    const catalog = createInventoryCatalogFromItems(items, {
      ...options,
      slotCount,
      sourceKind: "library",
      status: getInventoryPlaceableItems(items).length > 0 ? "ready" : "empty",
      loadedAt: options?.loadedAt ?? nowIsoStringSafe(),
    });

    return catalogToFactoryResult(catalog, {
      usedFallback: catalogUsesFallback(catalog),
      errorMessage: catalog.errorMessage,
      fallbackContext: options,
    });
  } catch (error) {
    return createFallbackInventorySlotFactoryResult({
      ...options,
      fallbackReason: `Library slot mapping failed: ${errorMessageFromUnknown(
        error,
        "unknown error",
      )}`,
    });
  }
}

export function createInventorySlotFactoryResultFromItems(
  items: readonly InventoryItem[],
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  try {
    const catalog = createInventoryCatalogFromItems(items, options);

    return catalogToFactoryResult(catalog, {
      usedFallback: catalogUsesFallback(catalog),
      errorMessage: catalog.errorMessage,
      fallbackContext: options,
    });
  } catch (error) {
    return createFallbackInventorySlotFactoryResult({
      ...options,
      fallbackReason: `Inventory item mapping failed: ${errorMessageFromUnknown(
        error,
        "unknown error",
      )}`,
    });
  }
}

export function createInventorySlotFactoryResultFromCatalog(
  catalog: InventoryCatalog | unknown,
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  try {
    const normalizedCatalog = isInventoryCatalog(catalog)
      ? normalizeInventoryCatalog(catalog)
      : createFallbackInventoryCatalog({
          projectId: options?.projectId,
          worldId: options?.worldId,
          slotCount: options?.slotCount,
          selectedSlot: options?.selectedSlotIndex ?? options?.selectedSlot,
          selectedSlotIndex: options?.selectedSlotIndex ?? options?.selectedSlot,
          reason: options?.fallbackReason ?? "Invalid inventory catalog.",
        });

    const selectedCatalog = updateInventorySelection(
      sanitizeCatalog(normalizedCatalog, options),
      selectionFromOptionsOrCatalog(normalizedCatalog, options),
    );

    return catalogToFactoryResult(selectedCatalog, {
      usedFallback: catalogUsesFallback(selectedCatalog),
      errorMessage: selectedCatalog.errorMessage,
      fallbackContext: options,
    });
  } catch (error) {
    return createFallbackInventorySlotFactoryResult({
      ...options,
      fallbackReason: `Inventory catalog mapping failed: ${errorMessageFromUnknown(
        error,
        "unknown error",
      )}`,
    });
  }
}

export function createFallbackInventorySlotFactoryResult(
  options?: InventorySlotFactoryOptions,
): InventorySlotFactoryResult {
  const fallbackReason = safeNullableString(
    options?.fallbackReason ?? options?.errorMessage,
    "Empty Library inventory fallback was used.",
  );

  const catalog = createFallbackInventoryCatalog({
    projectId: options?.projectId,
    worldId: options?.worldId,
    slotCount: options?.slotCount,
    selectedSlot: options?.selectedSlotIndex ?? options?.selectedSlot,
    selectedSlotIndex: options?.selectedSlotIndex ?? options?.selectedSlot,
    reason: fallbackReason,
  });

  return catalogToFactoryResult(catalog, {
    usedFallback: true,
    errorMessage: fallbackReason,
    fallbackContext: options,
  });
}

export function updateInventorySlotFactorySelection(
  input: InventorySlotFactorySelectionUpdate,
): InventorySlotFactoryResult {
  try {
    const catalog = updateInventorySelection(input.catalog, input.selection);

    return catalogToFactoryResult(catalog, {
      usedFallback: catalogUsesFallback(catalog),
      errorMessage: catalog.errorMessage,
    });
  } catch (error) {
    return createFallbackInventorySlotFactoryResult({
      fallbackReason:
        input.fallbackReason ??
        `Inventory selection update failed: ${errorMessageFromUnknown(
          error,
          "unknown error",
        )}`,
    });
  }
}

export function ensureInventoryCatalogSlotCount(
  catalog: InventoryCatalog,
  slotCount: number,
): InventoryCatalog {
  try {
    const normalizedSlotCount = normalizeSlotCount(slotCount);

    if (
      catalog.slotCount === normalizedSlotCount &&
      catalog.items.length === normalizedSlotCount
    ) {
      return catalog;
    }

    return createInventoryCatalogFromItems(catalog.items, {
      projectId: catalog.projectId,
      worldId: catalog.worldId,
      registryId: catalog.registryId,
      registryVersion: catalog.registryVersion,
      slotCount: normalizedSlotCount,
      selectedSlot: catalog.selection.selectedSlot,
      selectedSlotIndex: catalog.selection.selectedSlotIndex,
      blockTypeId: catalog.selection.selectedBlockTypeId,
      runtimeBlockTypeId: catalog.selection.selectedRuntimeBlockTypeId,
      libraryItemId: catalog.selection.selectedPlacementRef?.libraryItemId,
      familyId: catalog.selection.selectedPlacementRef?.familyId,
      packageId: catalog.selection.selectedPlacementRef?.packageId,
      vplibUid: catalog.selection.selectedPlacementRef?.vplibUid,
      variantId: catalog.selection.selectedPlacementRef?.variantId,
      revisionHash: catalog.selection.selectedPlacementRef?.revisionHash,
      objectKind: catalog.selection.selectedPlacementRef?.objectKind,
      sourceKind: catalog.sourceKind,
      status: catalog.status,
      errorMessage: catalog.errorMessage,
      loadedAt: catalog.loadedAt,
    });
  } catch {
    return catalog;
  }
}

export function getSelectedHotbarSlot(
  catalog: InventoryCatalog,
): HotbarSlot | null {
  try {
    return catalog.hotbarSlots.find((slot) => slot.selected) ?? null;
  } catch {
    return null;
  }
}

export function getSelectedLibraryHotbarSlot(
  catalog: InventoryCatalog,
): HotbarSlot | null {
  try {
    const selected = getSelectedHotbarSlot(catalog);

    if (!selected || selected.item.kind !== "library-item") {
      return null;
    }

    return selected;
  } catch {
    return null;
  }
}

export function getHotbarSlotByIndex(
  catalog: InventoryCatalog,
  slotIndex: number,
): HotbarSlot | null {
  try {
    const normalizedSlot = normalizeSlotIndex(slotIndex, catalog.slotCount);

    return catalog.hotbarSlots.find((slot) => slot.slot === normalizedSlot) ?? null;
  } catch {
    return null;
  }
}

export function getRuntimeBlockTypeIdFromFactoryResult(
  result: InventorySlotFactoryResult,
): string | null {
  try {
    return normalizeRuntimeBlockTypeId(
      result.selectedRuntimeBlockTypeId ?? result.selectedBlockTypeId,
    );
  } catch {
    return null;
  }
}

export function getPlacementCommandFromFactoryResult(
  result: InventorySlotFactoryResult,
): EditorInventoryPlacementCommand | null {
  try {
    return result.selectedPlacementCommand;
  } catch {
    return null;
  }
}

export function getLibraryRefFromFactoryResult(
  result: InventorySlotFactoryResult,
): EditorInventoryLibraryRef | null {
  try {
    return result.selectedLibraryRef;
  } catch {
    return null;
  }
}

export function canFactoryResultPlaceLibraryItem(
  result: InventorySlotFactoryResult,
): boolean {
  try {
    return Boolean(
      result.status === "ready" &&
        result.hasPlaceableLibraryItems &&
        result.selectedLibraryRef &&
        result.selectedPlacementCommand &&
        getRuntimeBlockTypeIdFromFactoryResult(result) &&
        !result.usedFallback,
    );
  } catch {
    return false;
  }
}

export function inventorySlotFactoryResultToDebugSummary(
  result: InventorySlotFactoryResult,
): Record<string, unknown> {
  try {
    return {
      kind: result.kind,
      status: result.status,
      selectedSlot: result.selectedSlot,
      selectedSlotIndex: result.selectedSlotIndex,
      selectedBlockTypeId: result.selectedBlockTypeId,
      selectedRuntimeBlockTypeId: result.selectedRuntimeBlockTypeId,
      selectedLibraryItemId: result.selectedLibraryItemId,
      selectedFamilyId: result.selectedFamilyId,
      selectedPackageId: result.selectedPackageId,
      selectedVplibUid: result.selectedVplibUid,
      selectedVariantId: result.selectedVariantId,
      selectedRevisionHash: result.selectedRevisionHash,
      selectedObjectKind: result.selectedObjectKind,
      hasPlaceableItems: result.hasPlaceableItems,
      hasPlaceableLibraryItems: result.hasPlaceableLibraryItems,
      onlyLibraryItemsPlaceable: result.onlyLibraryItemsPlaceable,
      usedFallback: result.usedFallback,
      errorMessage: result.errorMessage,
      createdAt: result.createdAt,
      debug: result.debug,
      domSlots: result.domSlots.map((slot) => ({
        slot: slot.slot,
        label: slot.label,
        blockTypeId: slot.blockTypeId,
        runtimeBlockTypeId: slot.runtimeBlockTypeId,
        libraryItemId: slot.libraryItemId,
        familyId: slot.familyId,
        packageId: slot.packageId,
        vplibUid: slot.vplibUid,
        variantId: slot.variantId,
        revisionHash: slot.revisionHash,
        objectKind: slot.objectKind,
        selected: slot.selected,
        enabled: slot.enabled,
        itemKind: slot.itemKind,
        sourceKind: slot.sourceKind,
      })),
      contract: editorInventoryContractDiagnostics({
        runtimeBlockTypeId: result.selectedRuntimeBlockTypeId,
        libraryItemId: result.selectedLibraryItemId,
        familyId: result.selectedFamilyId,
        packageId: result.selectedPackageId,
        vplibUid: result.selectedVplibUid,
        variantId: result.selectedVariantId,
        revisionHash: result.selectedRevisionHash,
        objectKind: result.selectedObjectKind,
      }),
      rules: {
        ...editorInventoryContractRules(),
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
        debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
        allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
        emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
        legacyChunkInventoryIsDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
        forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
      },
    };
  } catch {
    return {
      kind: INVENTORY_SLOT_FACTORY_RESULT_KIND,
      status: "failed",
      errorMessage: "Inventory slot factory debug summary failed.",
    };
  }
}

export function isInventorySlotFactoryResult(
  value: unknown,
): value is InventorySlotFactoryResult {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const record = value as Partial<InventorySlotFactoryResult>;

    return (
      record.kind === INVENTORY_SLOT_FACTORY_RESULT_KIND &&
      isInventoryCatalog(record.catalog) &&
      Array.isArray(record.hotbarSlots) &&
      Array.isArray(record.domSlots)
    );
  } catch {
    return false;
  }
}

export function isLibraryInventorySlotFactoryResult(
  value: unknown,
): value is InventorySlotFactoryResult {
  try {
    return (
      isInventorySlotFactoryResult(value) &&
      isLibraryInventoryCatalog(value.catalog) &&
      value.hasPlaceableLibraryItems &&
      !value.usedFallback
    );
  } catch {
    return false;
  }
}

export function getInventorySlotFactoryMetadata(): Record<string, unknown> {
  return {
    moduleName: INVENTORY_SLOT_FACTORY_MODULE_NAME,
    moduleVersion: INVENTORY_SLOT_FACTORY_MODULE_VERSION,
    resultKind: INVENTORY_SLOT_FACTORY_RESULT_KIND,
    defaultHotbarSlotCount: DEFAULT_HOTBAR_SLOT_COUNT,
    defaultPlaceableBlockTypeId: DEFAULT_PLACEABLE_BLOCK_TYPE_ID,
    productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    supportsLibraryInventory: true,
    supportsEditorInventoryPayload: true,
    supportsLegacyChunkBlocks: true,
    legacyChunkBlocksRequireExplicitAllow: true,
    contract: getEditorInventoryContractMetadata(),
    rules: {
      ...editorInventoryContractRules(),
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly:
        BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
      emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
      legacyChunkInventoryIsDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
      loadResultUnionHandledSafely: true,
      domSlotsNormalizedLocally: true,
      hotbarSlotObjectKindReadDefensively: true,
      hotbarSlotObjectKindIsFirstClassDomField: true,
    },
  };
}