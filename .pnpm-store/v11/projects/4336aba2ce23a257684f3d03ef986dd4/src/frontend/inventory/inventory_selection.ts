// services/vectoplan-editor/src/frontend/inventory/inventory_selection.ts
import {
  updateInventorySelection,
  type HotbarSlot,
  type InventoryAssetItem,
  type InventoryBlockItem,
  type InventoryCatalog,
  type InventoryItem,
  type InventoryLibraryItem,
  type InventoryPlacementRef,
  type InventorySelection,
  type InventorySelectionOptions,
  type InventorySlotStatus,
} from "./inventory_models";

export type InventoryNavigationDirection =
  | "next"
  | "previous";

export type InventorySelectionReason =
  | "manual"
  | "keyboard"
  | "wheel"
  | "hotbar-click"
  | "backend-refresh"
  | "catalog-refresh"
  | "fallback"
  | "library-refresh"
  | "library-load"
  | "vplib-select"
  | string;

export interface InventoryNavigationOptions {
  readonly wrap?: boolean;
  readonly skipEmptySlots?: boolean;
  readonly preferEnabled?: boolean;
  readonly allowDisabledSelection?: boolean;
  readonly allowEmptySelection?: boolean;

  /**
   * Standard: true.
   * Wenn aktiv, gelten nur Library-/VPLIB-Items als fachlich auswählbar.
   */
  readonly onlyLibraryItemsPlaceable?: boolean;

  /**
   * Standard: false.
   * Legacy-Block-/Asset-Auswahl ist nur erlaubt, wenn dies explizit aktiviert ist.
   */
  readonly allowLegacyBlockSelection?: boolean;
}

export interface InventoryWheelNavigationOptions extends InventoryNavigationOptions {
  readonly invertWheel?: boolean;
  readonly horizontalFallback?: boolean;
}

export interface InventorySelectionResult {
  readonly kind: "inventory-selection-result.v1";
  readonly catalog: InventoryCatalog;
  readonly previousSlot: number;
  readonly selectedSlot: number;
  readonly selectedSlotIndex: number;
  readonly selectedItem: InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem | null;
  readonly selectedLibraryItem: InventoryLibraryItem | null;
  readonly selectedBlockItem: InventoryBlockItem | null;
  readonly selectedAssetItem: InventoryAssetItem | null;
  readonly selectedBlockTypeId: string | null;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedPlacementRef: InventoryPlacementRef | null;
  readonly changed: boolean;
  readonly direction: InventoryNavigationDirection | null;
  readonly reason: string;
  readonly blocked: boolean;
  readonly blockedReason: string | null;
}

export interface InventoryWheelLike {
  readonly deltaX?: number;
  readonly deltaY?: number;
  readonly deltaZ?: number;
}

const INVENTORY_SELECTION_RESULT_KIND = "inventory-selection-result.v1" as const;

const FORBIDDEN_DEBUG_BLOCK_TYPE_IDS = new Set<string>([
  "debug_grass",
  "debug_dirt",
]);

function safeString(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function safeNullableString(value: unknown, fallback: string | null = null): string | null {
  try {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(value: unknown, fallback: number): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    return Number.isFinite(numeric) ? numeric : fallback;
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
    const numeric = Math.trunc(safeNumber(value, fallback));

    return Math.min(max, Math.max(min, numeric));
  } catch {
    return fallback;
  }
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeReason(reason: unknown, fallback: string): string {
  return safeString(reason, fallback);
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "");

  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.has(normalized);
}

function containsForbiddenDebugBlockTypeId(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);

    return Array.from(FORBIDDEN_DEBUG_BLOCK_TYPE_IDS).some((blockTypeId) => serialized.includes(blockTypeId));
  } catch {
    return false;
  }
}

export function normalizeInventorySlotIndex(slot: unknown, slotCount: number): number {
  try {
    const count = Math.max(1, safeInteger(slotCount, 1, 1, 99));

    return safeInteger(slot, 0, 0, count - 1);
  } catch {
    return 0;
  }
}

export function wrapInventorySlotIndex(slot: number, slotCount: number): number {
  try {
    const count = Math.max(1, safeInteger(slotCount, 1, 1, 99));
    const raw = safeInteger(slot, 0);

    return ((raw % count) + count) % count;
  } catch {
    return 0;
  }
}

function isLibraryItem(item: InventoryItem | null | undefined): item is InventoryLibraryItem {
  try {
    return Boolean(
      item
      && item.kind === "library-item"
      && item.enabled
      && item.runtimeBlockTypeId
      && !isForbiddenDebugBlockTypeId(item.runtimeBlockTypeId)
      && (
        item.familyId
        || item.vplibUid
        || item.libraryItemId
        || item.libraryRef
      ),
    );
  } catch {
    return false;
  }
}

function isLegacyPlaceableItem(
  item: InventoryItem | null | undefined,
): item is InventoryBlockItem | InventoryAssetItem {
  try {
    if (!item || (item.kind !== "block" && item.kind !== "asset")) {
      return false;
    }

    if (item.kind === "block" && isForbiddenDebugBlockTypeId(item.blockTypeId)) {
      return false;
    }

    if (item.kind === "asset" && item.runtimeBlockTypeId && isForbiddenDebugBlockTypeId(item.runtimeBlockTypeId)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isPlaceableItem(
  item: InventoryItem | null | undefined,
  options?: InventoryNavigationOptions,
): item is InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem {
  try {
    const onlyLibraryItemsPlaceable = safeBoolean(options?.onlyLibraryItemsPlaceable, true);
    const allowLegacyBlockSelection = safeBoolean(options?.allowLegacyBlockSelection, false);

    if (isLibraryItem(item)) {
      return true;
    }

    if (onlyLibraryItemsPlaceable && !allowLegacyBlockSelection) {
      return false;
    }

    return isLegacyPlaceableItem(item);
  } catch {
    return false;
  }
}

function isEnabledPlaceableItem(
  item: InventoryItem | null | undefined,
  options?: InventoryNavigationOptions,
): item is InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem {
  try {
    if (!isPlaceableItem(item, options)) {
      return false;
    }

    if (item.enabled) {
      return true;
    }

    return safeBoolean(options?.allowDisabledSelection, false);
  } catch {
    return false;
  }
}

export function isSelectableHotbarSlot(
  slot: HotbarSlot | null | undefined,
  options?: InventoryNavigationOptions,
): boolean {
  try {
    if (!slot) {
      return false;
    }

    if (containsForbiddenDebugBlockTypeId(slot)) {
      return false;
    }

    const skipEmptySlots = safeBoolean(options?.skipEmptySlots, true);
    const preferEnabled = safeBoolean(options?.preferEnabled, true);
    const allowDisabledSelection = safeBoolean(options?.allowDisabledSelection, false);
    const allowEmptySelection = safeBoolean(options?.allowEmptySelection, false);

    if (slot.status === "empty" || slot.item.kind === "empty") {
      return allowEmptySelection && !skipEmptySlots;
    }

    if (slot.status === "disabled" || slot.enabled === false) {
      return allowDisabledSelection;
    }

    if (preferEnabled && !slot.enabled) {
      return false;
    }

    return isEnabledPlaceableItem(slot.item, {
      ...options,
      allowDisabledSelection,
    });
  } catch {
    return false;
  }
}

export function getSelectedHotbarSlot(catalog: InventoryCatalog): HotbarSlot | null {
  try {
    return catalog.hotbarSlots.find((slot) => slot.selected) ?? null;
  } catch {
    return null;
  }
}

export function getHotbarSlotByIndex(
  catalog: InventoryCatalog,
  slotIndex: number,
): HotbarSlot | null {
  try {
    const normalized = normalizeInventorySlotIndex(slotIndex, catalog.slotCount);

    return catalog.hotbarSlots.find((slot) => slot.slot === normalized) ?? null;
  } catch {
    return null;
  }
}

export function getInventoryItemBySlot(
  catalog: InventoryCatalog,
  slotIndex: number,
): InventoryItem | null {
  try {
    const normalized = normalizeInventorySlotIndex(slotIndex, catalog.slotCount);

    return catalog.items.find((item) => item.slot === normalized) ?? null;
  } catch {
    return null;
  }
}

export function getCurrentInventorySlotIndex(catalog: InventoryCatalog): number {
  try {
    const selectedSlot = getSelectedHotbarSlot(catalog);

    if (selectedSlot) {
      return normalizeInventorySlotIndex(selectedSlot.slot, catalog.slotCount);
    }

    return normalizeInventorySlotIndex(
      catalog.selection.selectedSlotIndex ?? catalog.selection.selectedSlot,
      catalog.slotCount,
    );
  } catch {
    return 0;
  }
}

function normalizeDirection(value: unknown): InventoryNavigationDirection | null {
  try {
    if (value === "next" || value === 1 || value === "1") {
      return "next";
    }

    if (value === "previous" || value === -1 || value === "-1") {
      return "previous";
    }

    return null;
  } catch {
    return null;
  }
}

function stepForDirection(direction: InventoryNavigationDirection): number {
  return direction === "next" ? 1 : -1;
}

function selectedLibraryItemFromSelection(selection: InventorySelection): InventoryLibraryItem | null {
  try {
    return selection.selectedLibraryItem ?? (selection.selectedItem?.kind === "library-item" ? selection.selectedItem : null);
  } catch {
    return null;
  }
}

function selectedBlockItemFromSelection(selection: InventorySelection): InventoryBlockItem | null {
  try {
    return selection.selectedBlockItem ?? (selection.selectedItem?.kind === "block" ? selection.selectedItem : null);
  } catch {
    return null;
  }
}

function selectedAssetItemFromSelection(selection: InventorySelection): InventoryAssetItem | null {
  try {
    return selection.selectedAssetItem ?? (selection.selectedItem?.kind === "asset" ? selection.selectedItem : null);
  } catch {
    return null;
  }
}

function runtimeBlockTypeIdFromSelection(selection: InventorySelection): string | null {
  try {
    const candidate =
      selection.selectedRuntimeBlockTypeId
      ?? selection.selectedPlacementRef?.runtimeBlockTypeId
      ?? selection.selectedPlacementRef?.blockTypeId
      ?? selection.selectedBlockTypeId
      ?? null;

    if (!candidate || isForbiddenDebugBlockTypeId(candidate)) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

function getBlockedResult(
  catalog: InventoryCatalog,
  reason: string,
  blockedReason: string,
  direction: InventoryNavigationDirection | null,
): InventorySelectionResult {
  const selectedSlot = getCurrentInventorySlotIndex(catalog);
  const selectedItem = catalog.selection.selectedItem;
  const selectedLibraryItem = selectedLibraryItemFromSelection(catalog.selection);
  const selectedBlockItem = selectedBlockItemFromSelection(catalog.selection);
  const selectedAssetItem = selectedAssetItemFromSelection(catalog.selection);

  return {
    kind: INVENTORY_SELECTION_RESULT_KIND,
    catalog,
    previousSlot: selectedSlot,
    selectedSlot,
    selectedSlotIndex: selectedSlot,
    selectedItem,
    selectedLibraryItem,
    selectedBlockItem,
    selectedAssetItem,
    selectedBlockTypeId: catalog.selection.selectedBlockTypeId ?? runtimeBlockTypeIdFromSelection(catalog.selection),
    selectedRuntimeBlockTypeId: runtimeBlockTypeIdFromSelection(catalog.selection),
    selectedLibraryItemId: catalog.selection.selectedPlacementRef?.libraryItemId ?? selectedLibraryItem?.libraryItemId ?? null,
    selectedFamilyId: catalog.selection.selectedPlacementRef?.familyId ?? selectedLibraryItem?.familyId ?? null,
    selectedVplibUid: catalog.selection.selectedPlacementRef?.vplibUid ?? selectedLibraryItem?.vplibUid ?? null,
    selectedPlacementRef: catalog.selection.selectedPlacementRef,
    changed: false,
    direction,
    reason,
    blocked: true,
    blockedReason,
  };
}

function buildSelectionResult(
  previousCatalog: InventoryCatalog,
  nextCatalog: InventoryCatalog,
  reason: string,
  direction: InventoryNavigationDirection | null,
  blockedReason: string | null = null,
): InventorySelectionResult {
  try {
    const previousSlot = getCurrentInventorySlotIndex(previousCatalog);
    const selectedSlot = normalizeInventorySlotIndex(nextCatalog.selection.selectedSlotIndex, nextCatalog.slotCount);
    const selectedItem = nextCatalog.selection.selectedItem;
    const selectedLibraryItem = selectedLibraryItemFromSelection(nextCatalog.selection);
    const selectedBlockItem = selectedBlockItemFromSelection(nextCatalog.selection);
    const selectedAssetItem = selectedAssetItemFromSelection(nextCatalog.selection);

    return {
      kind: INVENTORY_SELECTION_RESULT_KIND,
      catalog: nextCatalog,
      previousSlot,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
      selectedItem,
      selectedLibraryItem,
      selectedBlockItem,
      selectedAssetItem,
      selectedBlockTypeId: nextCatalog.selection.selectedBlockTypeId ?? runtimeBlockTypeIdFromSelection(nextCatalog.selection),
      selectedRuntimeBlockTypeId: runtimeBlockTypeIdFromSelection(nextCatalog.selection),
      selectedLibraryItemId: nextCatalog.selection.selectedPlacementRef?.libraryItemId ?? selectedLibraryItem?.libraryItemId ?? null,
      selectedFamilyId: nextCatalog.selection.selectedPlacementRef?.familyId ?? selectedLibraryItem?.familyId ?? null,
      selectedVplibUid: nextCatalog.selection.selectedPlacementRef?.vplibUid ?? selectedLibraryItem?.vplibUid ?? null,
      selectedPlacementRef: nextCatalog.selection.selectedPlacementRef,
      changed: previousSlot !== selectedSlot,
      direction,
      reason,
      blocked: blockedReason !== null,
      blockedReason,
    };
  } catch {
    return getBlockedResult(
      previousCatalog,
      reason,
      "Selection result creation failed.",
      direction,
    );
  }
}

function statusForDeselectedSlot(slot: HotbarSlot): InventorySlotStatus {
  try {
    if (slot.item.kind === "empty") {
      return "empty";
    }

    if (!slot.enabled) {
      return "disabled";
    }

    return "available";
  } catch {
    return "empty";
  }
}

function createEmptyOrDisabledSelection(
  catalog: InventoryCatalog,
  slotIndex: number,
  options?: InventoryNavigationOptions,
): InventoryCatalog {
  try {
    const normalizedSlot = normalizeInventorySlotIndex(slotIndex, catalog.slotCount);
    const item = getInventoryItemBySlot(catalog, normalizedSlot);
    const allowDisabledSelection = safeBoolean(options?.allowDisabledSelection, false);

    const selectedItem = isPlaceableItem(item, options) && (item.enabled || allowDisabledSelection)
      ? item
      : null;
    const selectedLibraryItem = selectedItem?.kind === "library-item" ? selectedItem : null;
    const selectedBlockItem = selectedItem?.kind === "block" ? selectedItem : null;
    const selectedAssetItem = selectedItem?.kind === "asset" ? selectedItem : null;
    const selectedRuntimeBlockTypeId =
      selectedLibraryItem?.runtimeBlockTypeId
      ?? selectedBlockItem?.blockTypeId
      ?? selectedAssetItem?.runtimeBlockTypeId
      ?? null;

    const selection: InventorySelection = {
      selectedSlot: normalizedSlot,
      selectedSlotIndex: normalizedSlot,
      selectedItem,
      selectedLibraryItem,
      selectedBlockItem,
      selectedAssetItem,
      selectedBlockTypeId: selectedRuntimeBlockTypeId,
      selectedRuntimeBlockTypeId,
      selectedCellValue: selectedBlockItem?.cellValue ?? null,
      selectedPlacementRef: selectedItem?.placementRef ?? null,
      selectedLibraryRef: selectedLibraryItem?.libraryRef ?? selectedAssetItem?.libraryRef ?? null,
      selectedPlacementCommand: selectedLibraryItem?.placementCommand ?? selectedAssetItem?.placementCommand ?? null,
    };

    const hotbarSlots: readonly HotbarSlot[] = catalog.hotbarSlots.map((slot) => {
      const selected = slot.slot === normalizedSlot;
      const status: InventorySlotStatus = selected
        ? slot.item.kind === "empty"
          ? "empty"
          : slot.enabled || allowDisabledSelection
            ? "selected"
            : "disabled"
        : statusForDeselectedSlot(slot);

      return {
        ...slot,
        selected,
        status,
      };
    });

    return {
      ...catalog,
      selection,
      hotbarSlots,
    };
  } catch {
    return catalog;
  }
}

function applySlotSelection(
  catalog: InventoryCatalog,
  slotIndex: number,
  options?: InventoryNavigationOptions,
): InventoryCatalog {
  try {
    const normalizedSlot = normalizeInventorySlotIndex(slotIndex, catalog.slotCount);
    const allowEmptySelection = safeBoolean(options?.allowEmptySelection, false);
    const allowDisabledSelection = safeBoolean(options?.allowDisabledSelection, false);
    const slot = getHotbarSlotByIndex(catalog, normalizedSlot);

    if (
      allowEmptySelection
      || (
        allowDisabledSelection
        && slot
        && slot.status === "disabled"
      )
    ) {
      return createEmptyOrDisabledSelection(catalog, normalizedSlot, options);
    }

    return updateInventorySelection(catalog, {
      selectedSlot: normalizedSlot,
      selectedSlotIndex: normalizedSlot,
      preferEnabled: options?.preferEnabled ?? true,
    });
  } catch {
    return catalog;
  }
}

export function findNextSelectableInventorySlotIndex(
  catalog: InventoryCatalog,
  input?: {
    readonly fromSlot?: number;
    readonly direction?: InventoryNavigationDirection;
    readonly options?: InventoryNavigationOptions;
  },
): number | null {
  try {
    const slotCount = Math.max(1, catalog.slotCount);
    const wrap = safeBoolean(input?.options?.wrap, true);
    const direction = normalizeDirection(input?.direction) ?? "next";
    const step = stepForDirection(direction);
    const fromSlot = normalizeInventorySlotIndex(
      input?.fromSlot ?? getCurrentInventorySlotIndex(catalog),
      slotCount,
    );

    for (let offset = 1; offset <= slotCount; offset += 1) {
      const raw = fromSlot + step * offset;

      if (!wrap && (raw < 0 || raw >= slotCount)) {
        return null;
      }

      const candidateSlot = wrap
        ? wrapInventorySlotIndex(raw, slotCount)
        : normalizeInventorySlotIndex(raw, slotCount);

      const candidate = getHotbarSlotByIndex(catalog, candidateSlot);

      if (isSelectableHotbarSlot(candidate, input?.options)) {
        return candidateSlot;
      }
    }

    return isSelectableHotbarSlot(getHotbarSlotByIndex(catalog, fromSlot), input?.options)
      ? fromSlot
      : null;
  } catch {
    return null;
  }
}

export function selectInventorySlot(
  catalog: InventoryCatalog,
  slotIndex: number,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
    readonly direction?: InventoryNavigationDirection | null;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "manual");

  try {
    if (containsForbiddenDebugBlockTypeId(catalog)) {
      return getBlockedResult(
        catalog,
        reason,
        "Catalog contains forbidden debug block ids.",
        options?.direction ?? null,
      );
    }

    const normalizedSlot = normalizeInventorySlotIndex(slotIndex, catalog.slotCount);
    const requestedSlot = getHotbarSlotByIndex(catalog, normalizedSlot);

    if (!requestedSlot) {
      return getBlockedResult(
        catalog,
        reason,
        `Hotbar slot ${normalizedSlot} does not exist.`,
        options?.direction ?? null,
      );
    }

    if (!isSelectableHotbarSlot(requestedSlot, options)) {
      const fallbackSlot = findNextSelectableInventorySlotIndex(catalog, {
        fromSlot: normalizedSlot,
        direction: options?.direction ?? "next",
        options,
      });

      if (fallbackSlot === null) {
        return getBlockedResult(
          catalog,
          reason,
          "No selectable Library/VPLIB hotbar slot exists.",
          options?.direction ?? null,
        );
      }

      const fallbackCatalog = applySlotSelection(catalog, fallbackSlot, options);

      return buildSelectionResult(
        catalog,
        fallbackCatalog,
        reason,
        options?.direction ?? null,
        fallbackSlot === normalizedSlot ? "Requested slot is not directly selectable." : null,
      );
    }

    const nextCatalog = applySlotSelection(catalog, normalizedSlot, options);

    return buildSelectionResult(
      catalog,
      nextCatalog,
      reason,
      options?.direction ?? null,
    );
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Inventory slot selection failed.",
      options?.direction ?? null,
    );
  }
}

export function selectNextInventorySlot(
  catalog: InventoryCatalog,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "next");

  try {
    const fromSlot = getCurrentInventorySlotIndex(catalog);
    const nextSlot = findNextSelectableInventorySlotIndex(catalog, {
      fromSlot,
      direction: "next",
      options,
    });

    if (nextSlot === null) {
      return getBlockedResult(
        catalog,
        reason,
        "No next selectable Library/VPLIB hotbar slot exists.",
        "next",
      );
    }

    return selectInventorySlot(catalog, nextSlot, {
      ...options,
      reason,
      direction: "next",
    });
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Next hotbar slot selection failed.",
      "next",
    );
  }
}

export function selectPreviousInventorySlot(
  catalog: InventoryCatalog,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "previous");

  try {
    const fromSlot = getCurrentInventorySlotIndex(catalog);
    const previousSlot = findNextSelectableInventorySlotIndex(catalog, {
      fromSlot,
      direction: "previous",
      options,
    });

    if (previousSlot === null) {
      return getBlockedResult(
        catalog,
        reason,
        "No previous selectable Library/VPLIB hotbar slot exists.",
        "previous",
      );
    }

    return selectInventorySlot(catalog, previousSlot, {
      ...options,
      reason,
      direction: "previous",
    });
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Previous hotbar slot selection failed.",
      "previous",
    );
  }
}

export function normalizeWheelInventoryDirection(
  wheel: InventoryWheelLike | number,
  options?: InventoryWheelNavigationOptions,
): InventoryNavigationDirection | null {
  try {
    const invertWheel = safeBoolean(options?.invertWheel, false);
    const horizontalFallback = safeBoolean(options?.horizontalFallback, true);

    const deltaY = typeof wheel === "number"
      ? wheel
      : safeNumber(wheel.deltaY, 0);
    const deltaX = typeof wheel === "number"
      ? 0
      : safeNumber(wheel.deltaX, 0);

    const rawDelta =
      deltaY !== 0
        ? deltaY
        : horizontalFallback
          ? deltaX
          : 0;

    if (rawDelta === 0) {
      return null;
    }

    const normalizedDelta = invertWheel ? -rawDelta : rawDelta;

    /**
     * Browser convention:
     * deltaY > 0 means wheel down / scroll down.
     *
     * Editor convention:
     * wheel down => next slot
     * wheel up   => previous slot
     */
    return normalizedDelta > 0 ? "next" : "previous";
  } catch {
    return null;
  }
}

export function selectInventorySlotByWheel(
  catalog: InventoryCatalog,
  wheel: InventoryWheelLike | number,
  options?: InventoryWheelNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "wheel");

  try {
    const direction = normalizeWheelInventoryDirection(wheel, options);

    if (!direction) {
      return getBlockedResult(
        catalog,
        reason,
        "Wheel input did not contain a usable direction.",
        null,
      );
    }

    return direction === "next"
      ? selectNextInventorySlot(catalog, {
          ...options,
          reason,
        })
      : selectPreviousInventorySlot(catalog, {
          ...options,
          reason,
        });
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Wheel hotbar selection failed.",
      null,
    );
  }
}

export function selectInventoryBlockType(
  catalog: InventoryCatalog,
  blockTypeId: string,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "block-type");

  try {
    const requestedBlockTypeId = safeString(blockTypeId, "");

    if (!requestedBlockTypeId) {
      return getBlockedResult(
        catalog,
        reason,
        "Block type id is empty.",
        null,
      );
    }

    if (isForbiddenDebugBlockTypeId(requestedBlockTypeId)) {
      return getBlockedResult(
        catalog,
        reason,
        `Forbidden debug block type id: ${requestedBlockTypeId}`,
        null,
      );
    }

    const nextCatalog = updateInventorySelection(catalog, {
      blockTypeId: requestedBlockTypeId,
      runtimeBlockTypeId: requestedBlockTypeId,
      preferEnabled: options?.preferEnabled ?? true,
    });

    return buildSelectionResult(catalog, nextCatalog, reason, null);
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Block type selection failed.",
      null,
    );
  }
}

export function selectInventoryRuntimeBlockType(
  catalog: InventoryCatalog,
  runtimeBlockTypeId: string,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "runtime-block-type");

  try {
    const requestedRuntimeBlockTypeId = safeString(runtimeBlockTypeId, "");

    if (!requestedRuntimeBlockTypeId) {
      return getBlockedResult(
        catalog,
        reason,
        "Runtime block type id is empty.",
        null,
      );
    }

    if (isForbiddenDebugBlockTypeId(requestedRuntimeBlockTypeId)) {
      return getBlockedResult(
        catalog,
        reason,
        `Forbidden debug block type id: ${requestedRuntimeBlockTypeId}`,
        null,
      );
    }

    const nextCatalog = updateInventorySelection(catalog, {
      runtimeBlockTypeId: requestedRuntimeBlockTypeId,
      blockTypeId: requestedRuntimeBlockTypeId,
      preferEnabled: options?.preferEnabled ?? true,
    });

    return buildSelectionResult(catalog, nextCatalog, reason, null);
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Runtime block type selection failed.",
      null,
    );
  }
}

export function selectInventoryLibraryItem(
  catalog: InventoryCatalog,
  libraryItemId: string,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "library-item");

  try {
    const requestedLibraryItemId = safeString(libraryItemId, "");

    if (!requestedLibraryItemId) {
      return getBlockedResult(
        catalog,
        reason,
        "Library item id is empty.",
        null,
      );
    }

    const nextCatalog = updateInventorySelection(catalog, {
      libraryItemId: requestedLibraryItemId,
      preferEnabled: options?.preferEnabled ?? true,
    });

    return buildSelectionResult(catalog, nextCatalog, reason, null);
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Library item selection failed.",
      null,
    );
  }
}

export function selectInventoryFamily(
  catalog: InventoryCatalog,
  familyId: string,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "family");

  try {
    const requestedFamilyId = safeString(familyId, "");

    if (!requestedFamilyId) {
      return getBlockedResult(
        catalog,
        reason,
        "Family id is empty.",
        null,
      );
    }

    const nextCatalog = updateInventorySelection(catalog, {
      familyId: requestedFamilyId,
      preferEnabled: options?.preferEnabled ?? true,
    });

    return buildSelectionResult(catalog, nextCatalog, reason, null);
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Family selection failed.",
      null,
    );
  }
}

export function selectInventoryVplib(
  catalog: InventoryCatalog,
  vplibUid: string,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "vplib");

  try {
    const requestedVplibUid = safeString(vplibUid, "");

    if (!requestedVplibUid) {
      return getBlockedResult(
        catalog,
        reason,
        "VPLIB UID is empty.",
        null,
      );
    }

    const nextCatalog = updateInventorySelection(catalog, {
      vplibUid: requestedVplibUid,
      preferEnabled: options?.preferEnabled ?? true,
    });

    return buildSelectionResult(catalog, nextCatalog, reason, null);
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "VPLIB selection failed.",
      null,
    );
  }
}

export function selectInventoryPlacementRef(
  catalog: InventoryCatalog,
  selection: InventorySelectionOptions,
  options?: InventoryNavigationOptions & {
    readonly reason?: InventorySelectionReason;
  },
): InventorySelectionResult {
  const reason = normalizeReason(options?.reason, "placement-ref");

  try {
    const runtimeBlockTypeId = safeNullableString(selection.runtimeBlockTypeId ?? selection.blockTypeId, null);

    if (runtimeBlockTypeId && isForbiddenDebugBlockTypeId(runtimeBlockTypeId)) {
      return getBlockedResult(
        catalog,
        reason,
        `Forbidden debug block type id: ${runtimeBlockTypeId}`,
        null,
      );
    }

    const nextCatalog = updateInventorySelection(catalog, {
      ...selection,
      preferEnabled: options?.preferEnabled ?? selection.preferEnabled ?? true,
    });

    return buildSelectionResult(catalog, nextCatalog, reason, null);
  } catch {
    return getBlockedResult(
      catalog,
      reason,
      "Placement reference selection failed.",
      null,
    );
  }
}

export function getSelectedInventoryItem(
  catalog: InventoryCatalog,
): InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem | null {
  try {
    return catalog.selection.selectedItem;
  } catch {
    return null;
  }
}

export function getSelectedInventoryLibraryItem(
  catalog: InventoryCatalog,
): InventoryLibraryItem | null {
  try {
    return catalog.selection.selectedLibraryItem;
  } catch {
    return null;
  }
}

export function getSelectedInventoryBlockTypeId(
  catalog: InventoryCatalog,
): string | null {
  try {
    const candidate = catalog.selection.selectedRuntimeBlockTypeId ?? catalog.selection.selectedBlockTypeId;

    if (!candidate || isForbiddenDebugBlockTypeId(candidate)) {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

export function getSelectedInventoryRuntimeBlockTypeId(
  catalog: InventoryCatalog,
): string | null {
  return getSelectedInventoryBlockTypeId(catalog);
}

export function getSelectedInventoryPlacementRef(
  catalog: InventoryCatalog,
): InventoryPlacementRef | null {
  try {
    return catalog.selection.selectedPlacementRef;
  } catch {
    return null;
  }
}

export function inventorySelectionResultToDebugSummary(
  result: InventorySelectionResult,
): Record<string, unknown> {
  try {
    return {
      kind: result.kind,
      reason: result.reason,
      changed: result.changed,
      blocked: result.blocked,
      blockedReason: result.blockedReason,
      direction: result.direction,
      previousSlot: result.previousSlot,
      selectedSlot: result.selectedSlot,
      selectedSlotIndex: result.selectedSlotIndex,
      selectedBlockTypeId: result.selectedBlockTypeId,
      selectedRuntimeBlockTypeId: result.selectedRuntimeBlockTypeId,
      selectedLibraryItemId: result.selectedLibraryItemId,
      selectedFamilyId: result.selectedFamilyId,
      selectedVplibUid: result.selectedVplibUid,
      selectedPlacementKind: result.selectedPlacementRef?.kind ?? null,
      selectedPlacementRef: result.selectedPlacementRef,
      rules: {
        onlyLibraryItemsPlaceable: true,
        debugGrassDirtAllowed: false,
        forbiddenDebugBlockTypeIds: Array.from(FORBIDDEN_DEBUG_BLOCK_TYPE_IDS),
      },
    };
  } catch {
    return {
      kind: INVENTORY_SELECTION_RESULT_KIND,
      blocked: true,
      blockedReason: "Selection debug summary failed.",
    };
  }
}

export function isInventorySelectionResult(value: unknown): value is InventorySelectionResult {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const record = value as Partial<InventorySelectionResult>;

    return (
      record.kind === INVENTORY_SELECTION_RESULT_KIND
      && record.catalog !== undefined
      && typeof record.selectedSlot === "number"
      && typeof record.changed === "boolean"
      && typeof record.blocked === "boolean"
    );
  } catch {
    return false;
  }
}

export function getInventorySelectionMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.inventory.inventory_selection",
    resultKind: INVENTORY_SELECTION_RESULT_KIND,
    supportsLibraryInventory: true,
    supportsLegacyBlockSelection: true,
    legacyBlockSelectionRequiresExplicitAllow: true,
    forbiddenDebugBlockTypeIds: Array.from(FORBIDDEN_DEBUG_BLOCK_TYPE_IDS),
    rules: {
      onlyLibraryItemsPlaceableDefault: true,
      debugGrassDirtAllowed: false,
      wheelSelectsOnlySelectableSlots: true,
      emptySlotsSkippedByDefault: true,
    },
  };
}