// services/vectoplan-editor/src/frontend/ui/hotbar_view.ts
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  type EditorInventoryLibraryRef,
  type EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  renderDomHotbarSlots,
  setDomHotbarVisibility,
  setDomLiveMessage,
  type EditorDomRefs,
  type HotbarSlotRenderInput,
} from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeInteger, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore, EditorStoreUnsubscribe } from "@state/editor_store";
import type {
  EditorInventoryHotbarSlot,
  EditorInventoryItem,
  EditorState,
} from "@state/editor_state";
import { applyEditorAction } from "@state/state_actions";
import {
  selectInventoryHotbarSlots,
  selectInventoryItems,
  selectInventoryStatus,
  selectSelectedBlockTypeId,
  selectSelectedInventoryItem,
  selectSelectedInventorySlot,
  selectSelectedSlot,
} from "@state/state_selectors";

export type HotbarViewStatus =
  | "created"
  | "mounted"
  | "visible"
  | "hidden"
  | "empty"
  | "failed"
  | "disposed";

export interface HotbarViewOptions {
  readonly refs: EditorDomRefs;
  readonly store: EditorStore;
  readonly logger?: EditorLogger;
  readonly enabled?: boolean;
  readonly visible?: boolean;
  readonly autoMount?: boolean;
  readonly slotCount?: number;
  readonly renderEmptySlots?: boolean;
  readonly updateLiveRegion?: boolean;
  readonly selectSlotOnClick?: boolean;
  readonly onSlotClick?: (slot: number, item: EditorInventoryItem | null) => void;

  /**
   * Standard: true.
   * Wenn aktiv, werden nur Library-/VPLIB-Slots als fachlich aktiv angezeigt.
   */
  readonly onlyLibraryItemsPlaceable?: boolean;

  /**
   * Standard: false.
   * Legacy-Block-Slots dürfen nur bewusst als klickbar dargestellt werden.
   */
  readonly allowLegacyBlockItems?: boolean;
}

export interface HotbarViewModelSlot {
  readonly slot: number;
  readonly index: number;
  readonly selected: boolean;
  readonly status: EditorInventoryHotbarSlot["status"];
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly sourceKind: string | null;
  readonly itemKind: string | null;
  readonly color: string | null;
  readonly enabled: boolean;
  readonly keyBinding: string;
  readonly item: EditorInventoryItem | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
}

export interface HotbarViewModel {
  readonly status: string;
  readonly visible: boolean;
  readonly selectedSlot: number;
  readonly selectedSlotIndex: number;
  readonly selectedBlockTypeId: string | null;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedLabel: string | null;
  readonly slots: readonly HotbarViewModelSlot[];
  readonly itemCount: number;
  readonly slotCount: number;
  readonly libraryItemCount: number;
  readonly blockTypeIds: readonly string[];
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;
  readonly updatedAt: string;
}

export interface HotbarViewSnapshot {
  readonly kind: "hotbar-view-snapshot.v1";
  readonly status: HotbarViewStatus;
  readonly enabled: boolean;
  readonly visible: boolean;
  readonly mounted: boolean;
  readonly disposed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly renderCount: number;
  readonly skippedRenderCount: number;
  readonly showCount: number;
  readonly hideCount: number;
  readonly clickCount: number;
  readonly keyActivateCount: number;
  readonly blockedClickCount: number;
  readonly lastRenderAt: string | null;
  readonly lastReason: string | null;
  readonly lastClickedSlot: number | null;
  readonly lastBlockedSlot: number | null;
  readonly lastViewModel: HotbarViewModel | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface HotbarViewHandle {
  readonly kind: "vectoplan-editor-hotbar-view.v1";

  mount(): void;
  render(state?: EditorState, reason?: string): void;
  show(reason?: string): void;
  hide(reason?: string): void;
  setEnabled(enabled: boolean, reason?: string): void;

  getStatus(): HotbarViewStatus;
  getSnapshot(): HotbarViewSnapshot;

  dispose(reason?: string): void;
}

const HOTBAR_VIEW_KIND = "vectoplan-editor-hotbar-view.v1" as const;
const HOTBAR_VIEW_SNAPSHOT_KIND = "hotbar-view-snapshot.v1" as const;
const DEFAULT_SLOT_COUNT = 9;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "unknown-time";
    }
  }
}

function normalizeErrorRecord(error: unknown): Record<string, unknown> {
  try {
    const normalized = normalizeUnknownError(error);

    if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
      return normalized as Record<string, unknown>;
    }

    return {
      name: "UnknownError",
      message: String(normalized),
    };
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
        message: "Unknown hotbar view error.",
      };
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
    // UI logging must never break hotbar rendering.
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
    // UI logging must never break hotbar rendering.
  }
}

function normalizeSlotCount(value: unknown): number {
  return safeInteger(value, DEFAULT_SLOT_COUNT, {
    min: 1,
    max: 64,
  });
}

function normalizeSlot(value: unknown, slotCount: number): number {
  return safeInteger(value, 0, {
    min: 0,
    max: Math.max(0, slotCount - 1),
  });
}

function truncateLabel(value: unknown, maxLength = 12): string {
  try {
    const label = safeString(value, "Leer");

    if (label.length <= maxLength) {
      return label;
    }

    return `${label.slice(0, Math.max(1, maxLength - 1))}…`;
  } catch {
    return "Leer";
  }
}

function uniqueStrings(values: readonly unknown[]): readonly string[] {
  try {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const normalized = safeString(value, "");

      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(normalized);
    }

    return result;
  } catch {
    return [];
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function nullableString(value: unknown): string | null {
  try {
    const normalized = safeString(value, "");
    return normalized || null;
  } catch {
    return null;
  }
}

function readAny(value: unknown, keys: readonly string[]): unknown {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const candidate = record[key];

      if (candidate !== undefined && candidate !== null) {
        return candidate;
      }
    }
  }

  return null;
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "");
  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

function containsForbiddenDebugBlockTypeId(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.some((id) => serialized.includes(id));
  } catch {
    return false;
  }
}

function runtimeBlockTypeIdFrom(value: unknown): string | null {
  const candidate = nullableString(
    readAny(value, [
      "runtimeBlockTypeId",
      "runtime_block_type_id",
      "blockTypeId",
      "block_type_id",
    ]),
  );

  if (!candidate || isForbiddenDebugBlockTypeId(candidate)) {
    return null;
  }

  return candidate;
}

function blockTypeIdFrom(value: unknown): string | null {
  const candidate = nullableString(
    readAny(value, [
      "blockTypeId",
      "block_type_id",
      "runtimeBlockTypeId",
      "runtime_block_type_id",
    ]),
  );

  if (!candidate || isForbiddenDebugBlockTypeId(candidate)) {
    return null;
  }

  return candidate;
}

function libraryItemIdFrom(value: unknown): string | null {
  return nullableString(
    readAny(value, [
      "libraryItemId",
      "library_item_id",
      "itemId",
      "item_id",
    ]),
  );
}

function familyIdFrom(value: unknown): string | null {
  return nullableString(readAny(value, ["familyId", "family_id"]));
}

function packageIdFrom(value: unknown): string | null {
  return nullableString(readAny(value, ["packageId", "package_id"]));
}

function vplibUidFrom(value: unknown): string | null {
  return nullableString(readAny(value, ["vplibUid", "vplib_uid"]));
}

function variantIdFrom(value: unknown): string | null {
  return nullableString(readAny(value, ["variantId", "variant_id"]));
}

function revisionHashFrom(value: unknown): string | null {
  return nullableString(readAny(value, ["revisionHash", "revision_hash"]));
}

function itemKindFrom(value: unknown): string | null {
  return nullableString(readAny(value, ["itemKind", "item_kind", "kind"]));
}

function sourceKindFrom(value: unknown): string | null {
  return nullableString(readAny(value, ["sourceKind", "source_kind", "source"]));
}

function libraryRefFrom(value: unknown): EditorInventoryLibraryRef | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const direct = asRecord(record.libraryRef ?? record.library_ref);
  if (direct) {
    return direct as unknown as EditorInventoryLibraryRef;
  }

  const familyId = familyIdFrom(record);
  const vplibUid = vplibUidFrom(record);

  if (!familyId && !vplibUid) {
    return null;
  }

  return {
    source: "vectoplan-library",
    kind: "vplib",
    libraryItemId: libraryItemIdFrom(record),
    familyId,
    packageId: packageIdFrom(record),
    vplibUid,
    variantId: variantIdFrom(record) ?? "default",
    revisionHash: revisionHashFrom(record),
    objectKind: nullableString(readAny(record, ["objectKind", "object_kind", "type"])),
    domain: nullableString(record.domain),
    category: nullableString(record.category),
    subcategory: nullableString(record.subcategory),
    valid: true,
  };
}

function placementCommandFrom(value: unknown): EditorInventoryPlacementCommand | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const direct = asRecord(record.placementCommand ?? record.placement_command);
  if (direct) {
    return direct as unknown as EditorInventoryPlacementCommand;
  }

  const runtimeBlockTypeId = runtimeBlockTypeIdFrom(record);
  const libraryRef = libraryRefFrom(record);

  if (!runtimeBlockTypeId || !libraryRef) {
    return null;
  }

  return {
    kind: "PlaceLibraryItem",
    source: "vectoplan-library",
    runtimeBlockTypeId,
    blockTypeId: runtimeBlockTypeId,
    libraryRef,
    placeable: true,
  };
}

function isLibraryPlaceable(value: unknown): boolean {
  try {
    if (!value || containsForbiddenDebugBlockTypeId(value)) {
      return false;
    }

    const runtimeBlockTypeId = runtimeBlockTypeIdFrom(value);
    const familyId = familyIdFrom(value);
    const vplibUid = vplibUidFrom(value);
    const libraryRef = libraryRefFrom(value);
    const itemKind = itemKindFrom(value);
    const sourceKind = sourceKindFrom(value);

    return Boolean(
      runtimeBlockTypeId
      && (
        familyId
        || vplibUid
        || libraryRef
        || itemKind === "vplib"
        || sourceKind === "library"
      ),
    );
  } catch {
    return false;
  }
}

function isLegacyBlockAllowed(
  value: unknown,
  options: {
    readonly onlyLibraryItemsPlaceable: boolean;
    readonly allowLegacyBlockItems: boolean;
  },
): boolean {
  if (options.onlyLibraryItemsPlaceable && !options.allowLegacyBlockItems) {
    return false;
  }

  const blockTypeId = blockTypeIdFrom(value);
  return Boolean(blockTypeId && !isForbiddenDebugBlockTypeId(blockTypeId));
}

function isSlotAllowed(
  value: unknown,
  options: {
    readonly onlyLibraryItemsPlaceable: boolean;
    readonly allowLegacyBlockItems: boolean;
  },
): boolean {
  if (isLibraryPlaceable(value)) {
    return true;
  }

  return isLegacyBlockAllowed(value, options);
}

function getItemBySlot(
  items: readonly EditorInventoryItem[],
  slot: number,
): EditorInventoryItem | null {
  try {
    return items.find((item) => item.slot === slot) ?? null;
  } catch {
    return null;
  }
}

function getHotbarSlotBySlot(
  slots: readonly EditorInventoryHotbarSlot[],
  slot: number,
): EditorInventoryHotbarSlot | null {
  try {
    return slots.find((candidate) => candidate.slot === slot) ?? null;
  } catch {
    return null;
  }
}

function emptySlotViewModel(slot: number, selectedSlot: number, reason = "leer"): HotbarViewModelSlot {
  const selected = slot === selectedSlot;

  return {
    slot,
    index: slot,
    selected,
    status: "empty",
    label: String(slot + 1),
    shortLabel: String(slot + 1),
    title: `Slot ${slot + 1}: ${reason}`,
    blockTypeId: null,
    runtimeBlockTypeId: null,
    libraryItemId: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    sourceKind: "empty",
    itemKind: "empty",
    color: null,
    enabled: false,
    keyBinding: String(slot + 1),
    item: null,
    libraryRef: null,
    placementCommand: null,
  };
}

function createSlotViewModel(input: {
  readonly slot: number;
  readonly selectedSlot: number;
  readonly item: EditorInventoryItem | null;
  readonly hotbarSlot: EditorInventoryHotbarSlot | null;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly allowLegacyBlockItems: boolean;
}): HotbarViewModelSlot {
  try {
    const selected = input.slot === input.selectedSlot;
    const item = input.item;
    const hotbarSlot = input.hotbarSlot;
    const primary = item ?? hotbarSlot;

    if (!primary) {
      return emptySlotViewModel(input.slot, input.selectedSlot);
    }

    if (containsForbiddenDebugBlockTypeId(primary)) {
      return emptySlotViewModel(input.slot, input.selectedSlot, "Debug-Block nicht erlaubt");
    }

    const allowed = isSlotAllowed(primary, {
      onlyLibraryItemsPlaceable: input.onlyLibraryItemsPlaceable,
      allowLegacyBlockItems: input.allowLegacyBlockItems,
    });

    if (!allowed) {
      return emptySlotViewModel(input.slot, input.selectedSlot, "kein Library-/VPLIB-Item");
    }

    const runtimeBlockTypeId = runtimeBlockTypeIdFrom(primary);
    const blockTypeId = blockTypeIdFrom(primary) ?? runtimeBlockTypeId;
    const libraryItemId = libraryItemIdFrom(primary);
    const familyId = familyIdFrom(primary);
    const packageId = packageIdFrom(primary);
    const vplibUid = vplibUidFrom(primary);
    const variantId = variantIdFrom(primary);
    const revisionHash = revisionHashFrom(primary);
    const sourceKind = sourceKindFrom(primary) ?? (isLibraryPlaceable(primary) ? "library" : "legacy-block");
    const itemKind = itemKindFrom(primary) ?? (isLibraryPlaceable(primary) ? "vplib" : "block");
    const libraryRef = libraryRefFrom(primary);
    const placementCommand = placementCommandFrom(primary);

    const label = truncateLabel(
      readAny(hotbarSlot, ["label", "shortLabel", "short_label"])
        ?? readAny(item, ["shortLabel", "short_label", "label"])
        ?? runtimeBlockTypeId
        ?? libraryItemId
        ?? familyId
        ?? vplibUid
        ?? input.slot + 1,
      12,
    );
    const fullLabel = safeString(
      readAny(primary, ["label", "title", "name"]),
      label,
    );

    const enabled = safeBoolean(
      readAny(hotbarSlot, ["enabled"]),
      safeBoolean(readAny(item, ["enabled"]), true),
    ) && Boolean(runtimeBlockTypeId);

    return {
      slot: input.slot,
      index: safeInteger(readAny(hotbarSlot, ["index"]), input.slot, {
        min: 0,
        max: 64,
      }),
      selected: safeBoolean(readAny(hotbarSlot, ["selected"]), selected),
      status: safeString(
        readAny(hotbarSlot, ["status"]),
        selected ? "selected" : enabled ? "available" : "disabled",
      ) as EditorInventoryHotbarSlot["status"],
      label,
      shortLabel: truncateLabel(readAny(hotbarSlot, ["shortLabel", "short_label"]) ?? label, 12),
      title: safeString(
        readAny(hotbarSlot, ["title"]),
        `${fullLabel}${runtimeBlockTypeId ? ` (${runtimeBlockTypeId})` : ""}`,
      ),
      blockTypeId,
      runtimeBlockTypeId,
      libraryItemId,
      familyId,
      packageId,
      vplibUid,
      variantId,
      revisionHash,
      sourceKind,
      itemKind,
      color: nullableString(readAny(hotbarSlot, ["color"]) ?? readAny(item, ["color"])),
      enabled,
      keyBinding: safeString(readAny(hotbarSlot, ["keyBinding", "key_binding"]), String(input.slot + 1)),
      item,
      libraryRef,
      placementCommand,
    };
  } catch {
    return emptySlotViewModel(input.slot, input.selectedSlot);
  }
}

function createViewModel(
  state: EditorState,
  options: {
    readonly slotCount: number;
    readonly renderEmptySlots: boolean;
    readonly visible: boolean;
    readonly onlyLibraryItemsPlaceable: boolean;
    readonly allowLegacyBlockItems: boolean;
  },
): HotbarViewModel {
  try {
    const items = selectInventoryItems(state);
    const hotbarSlots = selectInventoryHotbarSlots(state);
    const selectedSlot = normalizeSlot(selectSelectedSlot(state), options.slotCount);
    const selectedInventorySlot = selectSelectedInventorySlot(state);
    const selectedItem = selectSelectedInventoryItem(state);
    const selectedBlockTypeId = selectSelectedBlockTypeId(state);
    const inventoryStatus = selectInventoryStatus(state);

    const slots: HotbarViewModelSlot[] = [];

    for (let slot = 0; slot < options.slotCount; slot += 1) {
      const item = getItemBySlot(items, slot);
      const hotbarSlot = getHotbarSlotBySlot(hotbarSlots, slot);

      if (!item && !hotbarSlot && !options.renderEmptySlots) {
        continue;
      }

      slots.push(
        createSlotViewModel({
          slot,
          selectedSlot,
          item,
          hotbarSlot,
          onlyLibraryItemsPlaceable: options.onlyLibraryItemsPlaceable,
          allowLegacyBlockItems: options.allowLegacyBlockItems,
        }),
      );
    }

    const selectedViewSlot = slots.find((slot) => slot.selected) ?? null;
    const selectedRuntimeBlockTypeId = selectedViewSlot?.runtimeBlockTypeId ?? blockTypeIdFrom(selectedInventorySlot) ?? blockTypeIdFrom(selectedItem) ?? selectedBlockTypeId ?? null;
    const selectedLibraryItemId = selectedViewSlot?.libraryItemId ?? libraryItemIdFrom(selectedInventorySlot) ?? libraryItemIdFrom(selectedItem);
    const selectedFamilyId = selectedViewSlot?.familyId ?? familyIdFrom(selectedInventorySlot) ?? familyIdFrom(selectedItem);
    const selectedVplibUid = selectedViewSlot?.vplibUid ?? vplibUidFrom(selectedInventorySlot) ?? vplibUidFrom(selectedItem);

    const selectedLabel =
      selectedViewSlot?.label
      ?? safeString(readAny(selectedInventorySlot, ["label"]), "")
      ?? safeString(readAny(selectedItem, ["shortLabel", "short_label", "label"]), "")
      ?? null;

    return {
      status: inventoryStatus,
      visible: options.visible,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
      selectedBlockTypeId: selectedRuntimeBlockTypeId,
      selectedRuntimeBlockTypeId,
      selectedLibraryItemId,
      selectedFamilyId,
      selectedVplibUid,
      selectedLabel,
      slots,
      itemCount: items.length,
      slotCount: options.slotCount,
      libraryItemCount: slots.filter((slot) => slot.itemKind === "vplib" || slot.sourceKind === "library").length,
      blockTypeIds: uniqueStrings(slots.map((slot) => slot.blockTypeId)),
      runtimeBlockTypeIds: uniqueStrings(slots.map((slot) => slot.runtimeBlockTypeId)),
      libraryItemIds: uniqueStrings(slots.map((slot) => slot.libraryItemId)),
      familyIds: uniqueStrings(slots.map((slot) => slot.familyId)),
      vplibUids: uniqueStrings(slots.map((slot) => slot.vplibUid)),
      onlyLibraryItemsPlaceable: options.onlyLibraryItemsPlaceable,
      debugGrassDirtAllowed: false,
      updatedAt: now(),
    };
  } catch {
    return {
      status: "failed",
      visible: options.visible,
      selectedSlot: 0,
      selectedSlotIndex: 0,
      selectedBlockTypeId: null,
      selectedRuntimeBlockTypeId: null,
      selectedLibraryItemId: null,
      selectedFamilyId: null,
      selectedVplibUid: null,
      selectedLabel: null,
      slots: [],
      itemCount: 0,
      slotCount: options.slotCount,
      libraryItemCount: 0,
      blockTypeIds: [],
      runtimeBlockTypeIds: [],
      libraryItemIds: [],
      familyIds: [],
      vplibUids: [],
      onlyLibraryItemsPlaceable: options.onlyLibraryItemsPlaceable,
      debugGrassDirtAllowed: false,
      updatedAt: now(),
    };
  }
}

function viewModelToRenderSlots(viewModel: HotbarViewModel): readonly HotbarSlotRenderInput[] {
  try {
    return viewModel.slots.map((slot) => ({
      slot: slot.slot,
      label: slot.label,
      blockTypeId: slot.runtimeBlockTypeId ?? slot.blockTypeId,
      color: slot.color,
      selected: slot.selected,
      sourceKind: slot.sourceKind,
      itemKind: slot.itemKind,
      libraryItemId: slot.libraryItemId,
      familyId: slot.familyId,
      packageId: slot.packageId,
      vplibUid: slot.vplibUid,
      variantId: slot.variantId,
      revisionHash: slot.revisionHash,
      enabled: slot.enabled,
    } as HotbarSlotRenderInput & Record<string, unknown>));
  } catch {
    return [];
  }
}

function setDatasetValue(element: HTMLElement | null, key: string, value: unknown): void {
  try {
    if (!element) {
      return;
    }

    if (value === undefined || value === null) {
      delete element.dataset[key];
      return;
    }

    element.dataset[key] = String(value);
  } catch {
    // Dataset updates are diagnostic-only.
  }
}

function applyViewModelToDom(
  refs: EditorDomRefs,
  viewModel: HotbarViewModel,
  updateLiveRegion: boolean,
): void {
  try {
    renderDomHotbarSlots(refs, viewModelToRenderSlots(viewModel));

    setDatasetValue(refs.root, "hotbarStatus", viewModel.status);
    setDatasetValue(refs.root, "hotbarSelectedSlot", viewModel.selectedSlot);
    setDatasetValue(refs.root, "hotbarSelectedSlotIndex", viewModel.selectedSlotIndex);
    setDatasetValue(refs.root, "hotbarSelectedBlockTypeId", viewModel.selectedBlockTypeId);
    setDatasetValue(refs.root, "hotbarSelectedRuntimeBlockTypeId", viewModel.selectedRuntimeBlockTypeId);
    setDatasetValue(refs.root, "hotbarSelectedLibraryItemId", viewModel.selectedLibraryItemId);
    setDatasetValue(refs.root, "hotbarSelectedFamilyId", viewModel.selectedFamilyId);
    setDatasetValue(refs.root, "hotbarSelectedVplibUid", viewModel.selectedVplibUid);
    setDatasetValue(refs.root, "hotbarSelectedLabel", viewModel.selectedLabel);
    setDatasetValue(refs.root, "hotbarItemCount", viewModel.itemCount);
    setDatasetValue(refs.root, "hotbarLibraryItemCount", viewModel.libraryItemCount);
    setDatasetValue(refs.root, "hotbarSlotCount", viewModel.slotCount);
    setDatasetValue(refs.root, "hotbarOnlyLibraryItemsPlaceable", viewModel.onlyLibraryItemsPlaceable ? "true" : "false");
    setDatasetValue(refs.root, "hotbarDebugGrassDirtAllowed", "false");
    setDatasetValue(refs.root, "hotbarUpdatedAt", viewModel.updatedAt);

    if (refs.hotbar) {
      refs.hotbar.dataset.hotbarStatus = viewModel.status;
      refs.hotbar.dataset.selectedSlot = String(viewModel.selectedSlot);
      refs.hotbar.dataset.selectedBlockTypeId = viewModel.selectedBlockTypeId ?? "";
      refs.hotbar.dataset.selectedRuntimeBlockTypeId = viewModel.selectedRuntimeBlockTypeId ?? "";
      refs.hotbar.dataset.selectedLibraryItemId = viewModel.selectedLibraryItemId ?? "";
      refs.hotbar.dataset.selectedFamilyId = viewModel.selectedFamilyId ?? "";
      refs.hotbar.dataset.selectedVplibUid = viewModel.selectedVplibUid ?? "";
      refs.hotbar.dataset.hotbarKind = "vplib";
      refs.hotbar.dataset.hotbarOnlyLibraryItemsPlaceable = viewModel.onlyLibraryItemsPlaceable ? "true" : "false";
      refs.hotbar.dataset.hotbarDebugGrassDirtAllowed = "false";
    }

    if (refs.hotbarSlots) {
      refs.hotbarSlots.setAttribute("aria-label", "Library-/VPLIB-Hotbar");
      refs.hotbarSlots.dataset.hotbarStatus = viewModel.status;
      refs.hotbarSlots.dataset.selectedSlot = String(viewModel.selectedSlot);
      refs.hotbarSlots.dataset.selectedBlockTypeId = viewModel.selectedBlockTypeId ?? "";
      refs.hotbarSlots.dataset.selectedRuntimeBlockTypeId = viewModel.selectedRuntimeBlockTypeId ?? "";
      refs.hotbarSlots.dataset.selectedLibraryItemId = viewModel.selectedLibraryItemId ?? "";
      refs.hotbarSlots.dataset.selectedFamilyId = viewModel.selectedFamilyId ?? "";
      refs.hotbarSlots.dataset.selectedVplibUid = viewModel.selectedVplibUid ?? "";
      refs.hotbarSlots.dataset.hotbarSlotsSource = "library";
    }

    if (updateLiveRegion && viewModel.selectedLabel) {
      setDomLiveMessage(refs, `Ausgewählt: ${viewModel.selectedLabel}`);
    }
  } catch {
    // DOM rendering must never throw into runtime.
  }
}

function viewModelsEqual(left: HotbarViewModel | null, right: HotbarViewModel): boolean {
  try {
    if (!left) {
      return false;
    }

    if (
      left.status !== right.status
      || left.visible !== right.visible
      || left.selectedSlot !== right.selectedSlot
      || left.selectedSlotIndex !== right.selectedSlotIndex
      || left.selectedBlockTypeId !== right.selectedBlockTypeId
      || left.selectedRuntimeBlockTypeId !== right.selectedRuntimeBlockTypeId
      || left.selectedLibraryItemId !== right.selectedLibraryItemId
      || left.selectedFamilyId !== right.selectedFamilyId
      || left.selectedVplibUid !== right.selectedVplibUid
      || left.selectedLabel !== right.selectedLabel
      || left.itemCount !== right.itemCount
      || left.libraryItemCount !== right.libraryItemCount
      || left.slotCount !== right.slotCount
      || left.slots.length !== right.slots.length
    ) {
      return false;
    }

    for (let index = 0; index < left.slots.length; index += 1) {
      const leftSlot = left.slots[index];
      const rightSlot = right.slots[index];

      if (!leftSlot || !rightSlot) {
        return false;
      }

      if (
        leftSlot.slot !== rightSlot.slot
        || leftSlot.index !== rightSlot.index
        || leftSlot.selected !== rightSlot.selected
        || leftSlot.status !== rightSlot.status
        || leftSlot.label !== rightSlot.label
        || leftSlot.shortLabel !== rightSlot.shortLabel
        || leftSlot.title !== rightSlot.title
        || leftSlot.blockTypeId !== rightSlot.blockTypeId
        || leftSlot.runtimeBlockTypeId !== rightSlot.runtimeBlockTypeId
        || leftSlot.libraryItemId !== rightSlot.libraryItemId
        || leftSlot.familyId !== rightSlot.familyId
        || leftSlot.vplibUid !== rightSlot.vplibUid
        || leftSlot.color !== rightSlot.color
        || leftSlot.enabled !== rightSlot.enabled
      ) {
        return false;
      }
    }

    return true;
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

    const slot = Number.parseInt(slotElement.dataset.hotbarSlot ?? "", 10);

    if (!Number.isFinite(slot)) {
      return null;
    }

    return slot;
  } catch {
    return null;
  }
}

function shouldHandleClick(event: MouseEvent): boolean {
  try {
    if (event.defaultPrevented) {
      return false;
    }

    if (event.button !== 0) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

function preventEvent(event: Event): void {
  try {
    event.preventDefault();
    event.stopPropagation();
  } catch {
    // Best-effort only.
  }
}

export function createHotbarView(options: HotbarViewOptions): HotbarViewHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;
  const slotCount = normalizeSlotCount(options.slotCount);
  const renderEmptySlots = safeBoolean(options.renderEmptySlots, true);
  const updateLiveRegion = safeBoolean(options.updateLiveRegion, false);
  const selectSlotOnClick = safeBoolean(options.selectSlotOnClick, true);
  const onlyLibraryItemsPlaceable = safeBoolean(options.onlyLibraryItemsPlaceable, true);
  const allowLegacyBlockItems = safeBoolean(options.allowLegacyBlockItems, false);

  const createdAt = now();

  let status: HotbarViewStatus = "created";
  let enabled = options.enabled ?? true;
  let visible = options.visible ?? true;
  let mounted = false;
  let disposed = false;
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let renderCount = 0;
  let skippedRenderCount = 0;
  let showCount = 0;
  let hideCount = 0;
  let clickCount = 0;
  let keyActivateCount = 0;
  let blockedClickCount = 0;
  let lastRenderAt: string | null = null;
  let lastReason: string | null = null;
  let lastClickedSlot: number | null = null;
  let lastBlockedSlot: number | null = null;
  let lastViewModel: HotbarViewModel | null = null;
  let lastError: Record<string, unknown> | null = null;
  let unsubscribe: EditorStoreUnsubscribe | null = null;

  const cleanupCallbacks: Array<() => void> = [];

  function setStatus(nextStatus: HotbarViewStatus, reason?: string | null): void {
    status = nextStatus;
    updatedAt = now();
    lastReason = reason ?? lastReason;

    setDatasetValue(refs.root, "hotbarViewStatus", nextStatus);
    setDatasetValue(refs.root, "hotbarViewUpdatedAt", updatedAt);
  }

  function setError(error: unknown): void {
    const normalized = normalizeErrorRecord(error);
    lastError = normalized;
    setStatus("failed", safeString(normalized.message, "Hotbar view failed."));

    logWarn(logger, "Hotbar view failed.", {
      error: lastError,
    });
  }

  function assertAlive(action: string): boolean {
    if (disposed || status === "disposed") {
      logWarn(logger, "Hotbar view action ignored because handle is disposed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function render(state?: EditorState, reason?: string): void {
    if (!assertAlive("render")) {
      return;
    }

    if (!enabled) {
      return;
    }

    try {
      const currentState = state ?? store.peekState();
      const viewModel = createViewModel(currentState, {
        slotCount,
        renderEmptySlots,
        visible,
        onlyLibraryItemsPlaceable,
        allowLegacyBlockItems,
      });

      if (viewModelsEqual(lastViewModel, viewModel)) {
        skippedRenderCount += 1;
        return;
      }

      applyViewModelToDom(refs, viewModel, updateLiveRegion);
      setDomHotbarVisibility(refs, visible);

      lastViewModel = viewModel;
      renderCount += 1;
      lastRenderAt = now();

      if (viewModel.slots.length === 0) {
        setStatus("empty", reason ?? "render-empty");
      } else {
        setStatus(visible ? "visible" : "hidden", reason ?? "render");
      }

      logDebug(logger, "Hotbar view rendered.", {
        visible,
        itemCount: viewModel.itemCount,
        libraryItemCount: viewModel.libraryItemCount,
        selectedSlot: viewModel.selectedSlot,
        selectedRuntimeBlockTypeId: viewModel.selectedRuntimeBlockTypeId,
        selectedFamilyId: viewModel.selectedFamilyId,
        selectedVplibUid: viewModel.selectedVplibUid,
        onlyLibraryItemsPlaceable,
      });
    } catch (error) {
      setError(error);
    }
  }

  function slotIsAllowedForActivation(slot: number, item: EditorInventoryItem | null): boolean {
    try {
      const state = store.peekState();
      const hotbarSlot = getHotbarSlotBySlot(selectInventoryHotbarSlots(state), slot);
      const candidate = item ?? hotbarSlot;

      return Boolean(candidate && isSlotAllowed(candidate, {
        onlyLibraryItemsPlaceable,
        allowLegacyBlockItems,
      }));
    } catch {
      return false;
    }
  }

  function selectSlot(slot: number, item: EditorInventoryItem | null, source: string): void {
    if (!selectSlotOnClick) {
      return;
    }

    if (!slotIsAllowedForActivation(slot, item)) {
      blockedClickCount += 1;
      lastBlockedSlot = slot;
      setDatasetValue(refs.root, "hotbarLastBlockedSlot", slot);
      setDatasetValue(refs.root, "hotbarLastBlockedAt", now());
      setDomLiveMessage(refs, "Dieser Slot enthält kein platzierbares Library-/VPLIB-Item.");
      return;
    }

    try {
      store.setState(
        (previous) => applyEditorAction(previous, {
          kind: "inventory/select-slot",
          slot,
          source,
          createdAt: now(),
        }),
        {
          action: "hotbar-view.select-slot",
          notify: true,
          captureHistory: false,
        },
      );

      const label = item ? `Ausgewählt: ${safeString(readAny(item, ["label"]), "VPLIB Item")}` : `Hotbar-Slot ${slot + 1}`;
      setDomLiveMessage(refs, label);
    } catch (error) {
      setError(error);
    }
  }

  function activateSlot(slot: number, source: string): void {
    try {
      const normalizedSlot = normalizeSlot(slot, slotCount);
      const currentState = store.peekState();
      const item = getItemBySlot(selectInventoryItems(currentState), normalizedSlot);

      lastClickedSlot = normalizedSlot;

      if (!slotIsAllowedForActivation(normalizedSlot, item)) {
        blockedClickCount += 1;
        lastBlockedSlot = normalizedSlot;
        setDomLiveMessage(refs, "Dieser Slot enthält kein platzierbares Library-/VPLIB-Item.");
        return;
      }

      options.onSlotClick?.(normalizedSlot, item);

      if (!options.onSlotClick) {
        selectSlot(normalizedSlot, item, source);
      }

      setDatasetValue(refs.root, "hotbarLastClickedSlot", normalizedSlot);
      setDatasetValue(refs.root, "hotbarLastClickedAt", now());

      logDebug(logger, "Hotbar slot activated.", {
        slot: normalizedSlot,
        runtimeBlockTypeId: runtimeBlockTypeIdFrom(item),
        familyId: familyIdFrom(item),
        vplibUid: vplibUidFrom(item),
        source,
      });
    } catch (error) {
      setError(error);
    }
  }

  function handleClick(event: MouseEvent): void {
    if (!assertAlive("click")) {
      return;
    }

    try {
      if (!enabled || !visible || !shouldHandleClick(event)) {
        return;
      }

      const slot = getSlotFromEventTarget(event.target);

      if (slot === null) {
        return;
      }

      preventEvent(event);

      clickCount += 1;
      activateSlot(slot, "hotbar-view.click");
    } catch (error) {
      setError(error);
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!assertAlive("keydown")) {
      return;
    }

    try {
      if (!enabled || !visible) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const slot = getSlotFromEventTarget(event.target);

      if (slot === null) {
        return;
      }

      preventEvent(event);

      keyActivateCount += 1;
      activateSlot(slot, "hotbar-view.keyboard");
    } catch (error) {
      setError(error);
    }
  }

  function mount(): void {
    if (!assertAlive("mount")) {
      return;
    }

    if (mounted) {
      return;
    }

    try {
      unsubscribe = store.subscribe((state) => {
        render(state, "store-update");
      });

      if (refs.hotbarSlots) {
        refs.hotbarSlots.addEventListener("click", handleClick);
        refs.hotbarSlots.addEventListener("keydown", handleKeyDown);

        cleanupCallbacks.push(() => refs.hotbarSlots?.removeEventListener("click", handleClick));
        cleanupCallbacks.push(() => refs.hotbarSlots?.removeEventListener("keydown", handleKeyDown));
      }

      mounted = true;
      setStatus(visible ? "visible" : "hidden", "mount");
      setDomHotbarVisibility(refs, visible);
      setDatasetValue(refs.root, "hotbarViewMounted", "true");
      setDatasetValue(refs.root, "hotbarViewVisible", visible ? "true" : "false");
      setDatasetValue(refs.root, "hotbarViewEnabled", enabled ? "true" : "false");
      setDatasetValue(refs.root, "hotbarOnlyLibraryItemsPlaceable", onlyLibraryItemsPlaceable ? "true" : "false");
      setDatasetValue(refs.root, "hotbarDebugGrassDirtAllowed", "false");

      render(store.peekState(), "mount");

      logDebug(logger, "Hotbar view mounted.", {
        enabled,
        visible,
        slotCount,
        renderEmptySlots,
        onlyLibraryItemsPlaceable,
        allowLegacyBlockItems,
      });
    } catch (error) {
      setError(error);
    }
  }

  function show(reason?: string): void {
    if (!assertAlive("show")) {
      return;
    }

    visible = true;
    showCount += 1;

    setDomHotbarVisibility(refs, true);
    setStatus("visible", reason ?? "show");
    setDatasetValue(refs.root, "hotbarViewVisible", "true");

    render(store.peekState(), reason ?? "show");

    logDebug(logger, "Hotbar view shown.", {
      reason: reason ?? null,
    });
  }

  function hide(reason?: string): void {
    if (!assertAlive("hide")) {
      return;
    }

    visible = false;
    hideCount += 1;

    setDomHotbarVisibility(refs, false);
    setStatus("hidden", reason ?? "hide");
    setDatasetValue(refs.root, "hotbarViewVisible", "false");

    logDebug(logger, "Hotbar view hidden.", {
      reason: reason ?? null,
    });
  }

  const handle: HotbarViewHandle = {
    kind: HOTBAR_VIEW_KIND,

    mount,
    render,
    show,
    hide,

    setEnabled(nextEnabled: boolean, reason?: string): void {
      if (!assertAlive("setEnabled")) {
        return;
      }

      enabled = safeBoolean(nextEnabled, enabled);
      setDatasetValue(refs.root, "hotbarViewEnabled", enabled ? "true" : "false");

      if (!enabled) {
        hide(reason ?? "disabled");
        return;
      }

      if (visible) {
        show(reason ?? "enabled");
      } else {
        setStatus("hidden", reason ?? "enabled-hidden");
      }
    },

    getStatus(): HotbarViewStatus {
      return status;
    },

    getSnapshot(): HotbarViewSnapshot {
      return {
        kind: HOTBAR_VIEW_SNAPSHOT_KIND,
        status,
        enabled,
        visible,
        mounted,
        disposed,
        createdAt,
        updatedAt,
        disposedAt,
        renderCount,
        skippedRenderCount,
        showCount,
        hideCount,
        clickCount,
        keyActivateCount,
        blockedClickCount,
        lastRenderAt,
        lastReason,
        lastClickedSlot,
        lastBlockedSlot,
        lastViewModel,
        lastError,
      };
    },

    dispose(reason?: string): void {
      if (disposed) {
        return;
      }

      const disposeReason = safeString(reason, "dispose");

      disposed = true;
      disposedAt = now();

      try {
        unsubscribe?.();
        unsubscribe = null;
      } catch {
        // Ignore.
      }

      for (const cleanup of cleanupCallbacks.splice(0)) {
        try {
          cleanup();
        } catch {
          // Ignore.
        }
      }

      mounted = false;
      setStatus("disposed", disposeReason);
      setDatasetValue(refs.root, "hotbarViewMounted", "false");
      setDatasetValue(refs.root, "hotbarViewDisposedAt", disposedAt);

      logDebug(logger, "Hotbar view disposed.", {
        reason: disposeReason,
        renderCount,
        skippedRenderCount,
        clickCount,
        keyActivateCount,
        blockedClickCount,
      });
    },
  };

  if (enabled && options.autoMount !== false) {
    mount();
  }

  return handle;
}

export function isHotbarViewHandle(value: unknown): value is HotbarViewHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<HotbarViewHandle>;

    return (
      record.kind === HOTBAR_VIEW_KIND
      && typeof record.mount === "function"
      && typeof record.render === "function"
      && typeof record.getSnapshot === "function"
      && typeof record.dispose === "function"
    );
  } catch {
    return false;
  }
}

export function getHotbarViewMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.ui.hotbar_view",
    kind: HOTBAR_VIEW_KIND,
    snapshotKind: HOTBAR_VIEW_SNAPSHOT_KIND,
    supportsLibraryInventory: true,
    supportsLegacyBlockItems: true,
    legacyBlockItemsRequireExplicitAllow: true,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      onlyLibraryItemsPlaceableDefault: true,
      debugGrassDirtAllowed: false,
      slotActivationRequiresLibraryOrExplicitLegacy: true,
    },
  };
}