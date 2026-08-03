// services/vectoplan-editor/src/frontend/inventory/library_inventory_source.ts
/**
 * Library-basierte Inventory-Source für die Editor-Hotbar.
 *
 * Zweck:
 * - lädt Inventory ausschließlich über /editor/api/inventory
 * - nutzt die serverseitige vectoplan-library-Integration
 * - stellt stabile Hotbar-Slots für Runtime/Controller/UI bereit
 * - blockiert debug_grass/debug_dirt als fachliche Inventory-Wahrheit
 * - kapselt Laden, Refresh, Auswahl, Fallback und Diagnose
 *
 * Architekturregel:
 * - Browser ruft nicht direkt vectoplan-library auf.
 * - Browser ruft /editor/api/inventory auf.
 * - Placebare Slots müssen aus Library/VPLIB kommen.
 * - Placebare Slots brauchen Library-Identität und runtimeBlockTypeId.
 *
 * Diese Datei enthält bewusst:
 * - keine DOM-Rendering-Logik
 * - keine Three.js-/Scene-Logik
 * - keine direkte Chunk-Command-Ausführung
 * - keine direkte vectoplan-library-HTTP-Requests
 */

import {
  EditorInventoryApiClient,
  buildEditorInventoryApiClientConfig,
  clearEditorInventoryApiClientCaches,
  getDefaultEditorInventoryApiClient,
  loadEditorInventory,
  type EditorInventoryApiClientConfig,
} from "../api/editor_inventory_api_client";
import {
  DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
  DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
  asBoolean,
  asOptionalString,
  asRecord,
  asString,
  getBlockTypeId,
  getEditorInventoryLoadError,
  getEditorInventoryLoadReason,
  getLibraryRef,
  getPlacementCommand,
  getRuntimeBlockTypeId,
  getSelectedInventoryItem,
  getSelectedInventorySlot,
  getSlotIndex,
  isPlaceableLibrarySlot,
  type EditorInventoryItem,
  type EditorInventoryLibraryRef,
  type EditorInventoryLoadResult,
  type EditorInventoryLoadSuccess,
  type EditorInventoryPlacementCommand,
  type EditorInventoryRuntimeSelection,
  type EditorInventorySlot,
  type EditorInventorySource,
  type EditorInventoryState,
  type UnknownRecord,
} from "../api/editor_inventory_models";
import {
  buildEmptyInventoryState,
  getRuntimeSelectionFromInventoryState,
  normalizeEditorInventoryState,
} from "../api/editor_inventory_normalize";
import {
  BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  DEBUG_GRASS_DIRT_ALLOWED,
  DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
  DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
  EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  clearEditorInventoryContractCaches,
  containsForbiddenDebugBlockTypeId,
  createEditorInventoryRuntimePlaceable,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  isEditorInventoryRuntimePlaceable,
  isForbiddenDebugBlockTypeId,
  normalizeContractInteger,
  normalizeContractSlotIndex,
  normalizeEditorInventoryLibraryRef,
  normalizeEditorInventoryPlacementCommand,
  normalizeInventorySourceLoadOptions,
  normalizeRuntimeBlockTypeId,
  type EditorHotbarInventorySourceHandle,
  type EditorInventoryRuntimePlaceable,
  type EditorInventorySourceLoadOptions,
  type EditorInventorySourceRefreshOptions,
} from "../contracts/editor_inventory_contract";

export const LIBRARY_INVENTORY_SOURCE_MODULE_NAME =
  "frontend.inventory.library_inventory_source";
export const LIBRARY_INVENTORY_SOURCE_MODULE_VERSION = "0.2.1";

export const LIBRARY_INVENTORY_SOURCE_KIND = "library" as const;
export const LIBRARY_INVENTORY_SOURCE_HANDLE_KIND =
  "vectoplan-editor-library-inventory-source.v1" as const;
export const LIBRARY_INVENTORY_ITEM_KIND = DEFAULT_EDITOR_INVENTORY_ITEM_KIND;
export const LIBRARY_INVENTORY_DEFAULT_LOAD_STATE: LibraryInventorySourceLoadState =
  "idle";

export type LibraryInventorySourceLoadState =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "fallback"
  | "error"
  | "destroyed";

export type LibraryInventorySourceEventType =
  | "load-start"
  | "load-success"
  | "load-empty"
  | "load-error"
  | "selection-change"
  | "state-change"
  | "reset"
  | "destroy";

export interface LibraryInventorySourceOptions {
  apiUrl?: string;
  hotbarSize?: number;
  selectedSlot?: number;
  autoLoad?: boolean;
  forceRefreshOnBoot?: boolean;
  includeEmptySlots?: boolean;
  allowEmptyFallback?: boolean;
  timeoutMs?: number;
  client?: EditorInventoryApiClient;
  clientConfig?: Partial<EditorInventoryApiClientConfig>;
  initialState?: EditorInventoryState | null;
}

export interface LibraryInventorySourceSnapshot {
  kind: "library-inventory-source-snapshot.v1";
  source: EditorInventorySource;
  loadState: LibraryInventorySourceLoadState;
  state: EditorInventoryState;
  slots: EditorInventorySlot[];
  items: EditorInventoryItem[];
  selectedSlotIndex: number;
  selectedSlot: EditorInventorySlot | null;
  selectedItem: EditorInventoryItem | null;
  runtimeSelection: EditorInventoryRuntimeSelection;
  runtimePlaceable: EditorInventoryRuntimePlaceable | null;
  lastError: Error | null;
  lastLoadedAt: number | null;
  lastRequestId: string | null;
  hasPlaceableItems: boolean;
  placeableSlots: EditorInventorySlot[];
  destroyed: boolean;
  productiveInventoryRoute: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  browserCallsVectoplanLibraryDirectly: typeof BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY;
}

export interface LibraryInventorySourceEvent {
  type: LibraryInventorySourceEventType;
  snapshot: LibraryInventorySourceSnapshot;
  error?: Error | null;
  reason?: string | null;
}

export type LibraryInventorySourceListener = (
  event: LibraryInventorySourceEvent,
) => void;

export type LibraryInventoryRuntimePlaceable = EditorInventoryRuntimePlaceable;

export type LibraryInventorySourceLoadOptions = EditorInventorySourceLoadOptions;

export type LibraryInventorySourceRefreshOptions =
  EditorInventorySourceRefreshOptions;

export interface LibraryInventorySourceHandle
  extends EditorHotbarInventorySourceHandle {
  readonly kind: typeof LIBRARY_INVENTORY_SOURCE_HANDLE_KIND;

  subscribe(listener: LibraryInventorySourceListener): () => void;

  getSnapshot(): LibraryInventorySourceSnapshot;
  getState(): EditorInventoryState;
  getLoadState(): LibraryInventorySourceLoadState;
  getLastError(): Error | null;

  getSlots(): EditorInventorySlot[];
  getItems(): EditorInventoryItem[];
  getPlaceableSlots(): EditorInventorySlot[];

  hasPlaceableItems(): boolean;

  getSelectedSlotIndex(): number;
  getSelectedSlot(): EditorInventorySlot | null;
  getSelectedItem(): EditorInventoryItem | null;
  getRuntimeSelection(): EditorInventoryRuntimeSelection;
  getSelectedRuntimePlaceable(): EditorInventoryRuntimePlaceable | null;
  getRuntimePlaceableForSlot(slotIndex: number): EditorInventoryRuntimePlaceable | null;
  getSlot(slotIndex: number): EditorInventorySlot | null;

  load(options?: LibraryInventorySourceLoadOptions): Promise<LibraryInventorySourceSnapshot>;
  reload(options?: LibraryInventorySourceLoadOptions): Promise<LibraryInventorySourceSnapshot>;
  refresh(options?: LibraryInventorySourceRefreshOptions): Promise<LibraryInventorySourceSnapshot>;

  selectSlot(slotIndex: number, reason?: string): LibraryInventorySourceSnapshot;
  selectNext(reason?: string): LibraryInventorySourceSnapshot;
  selectPrevious(reason?: string): LibraryInventorySourceSnapshot;

  reset(): LibraryInventorySourceSnapshot;
  clearCache(): void;
  getDiagnostics(): UnknownRecord;
  destroy(reason?: string): void;
}

const SNAPSHOT_KIND = "library-inventory-source-snapshot.v1" as const;

const MAX_LIBRARY_SOURCE_CACHE_ENTRIES = 512;

/**
 * Important:
 * Some upstream constants are literal typed, e.g. 9. In this source all runtime
 * sizes are handled as normal numbers and only passed to strict upstream
 * helpers through safe wrappers.
 */
const DEFAULT_HOTBAR_SIZE_NUMBER: number =
  Number(DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE) ||
  Number(DEFAULT_EDITOR_INVENTORY_SLOT_COUNT) ||
  9;
const DEFAULT_SELECTED_SLOT_NUMBER: number =
  Number(DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT) || 0;

const NORMALIZED_ERROR_CACHE = new Map<string, Error>();
const SLOT_INDEX_CACHE = new Map<string, number>();

type BuildEmptyInventoryStateOptions = Parameters<typeof buildEmptyInventoryState>[0];
type NormalizeEditorInventoryStateOptions = Parameters<typeof normalizeEditorInventoryState>[1];

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_LIBRARY_SOURCE_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearLibraryInventorySourceLocalCaches(): void {
  try {
    NORMALIZED_ERROR_CACHE.clear();
    SLOT_INDEX_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

function now(): number {
  try {
    return Date.now();
  } catch {
    return new Date().getTime();
  }
}

function createError(value: unknown, fallbackMessage: string): Error {
  try {
    if (value instanceof Error) {
      return value;
    }

    const message =
      value && typeof value === "object" && "message" in value
        ? asString((value as { message?: unknown }).message, fallbackMessage)
        : asString(value, fallbackMessage);

    const cacheKey = `${message || fallbackMessage}`;

    const cached = NORMALIZED_ERROR_CACHE.get(cacheKey);
    if (cached) {
      return cached;
    }

    return setCachedValue(
      NORMALIZED_ERROR_CACHE,
      cacheKey,
      new Error(message || fallbackMessage),
    );
  } catch {
    return new Error(fallbackMessage);
  }
}

function cloneState(state: EditorInventoryState): EditorInventoryState {
  try {
    return JSON.parse(JSON.stringify(state)) as EditorInventoryState;
  } catch {
    return state;
  }
}

function clampSelectedSlot(value: unknown, hotbarSize: number): number {
  try {
    const normalizedHotbarSize = normalizeHotbarSize(hotbarSize);
    const cacheKey = `${String(value)}|${normalizedHotbarSize}`;
    const cached = SLOT_INDEX_CACHE.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    return setCachedValue(
      SLOT_INDEX_CACHE,
      cacheKey,
      normalizeContractSlotIndex(
        value,
        normalizedHotbarSize,
        DEFAULT_SELECTED_SLOT_NUMBER,
      ),
    );
  } catch {
    return DEFAULT_SELECTED_SLOT_NUMBER;
  }
}

function normalizeHotbarSize(value: unknown): number {
  try {
    return normalizeContractInteger(
      value,
      DEFAULT_HOTBAR_SIZE_NUMBER,
      1,
      64,
    );
  } catch {
    return DEFAULT_HOTBAR_SIZE_NUMBER;
  }
}

function normalizeApiUrl(value: unknown): string {
  try {
    const raw = asString(value, PRODUCTIVE_EDITOR_INVENTORY_ROUTE).trim();

    if (!raw) {
      return PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
    }

    /**
     * Productive browser source is always the editor proxy. Direct
     * vectoplan-library browser URLs are intentionally collapsed.
     */
    if (raw.includes(PRODUCTIVE_EDITOR_INVENTORY_ROUTE)) {
      return raw;
    }

    return PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  } catch {
    return PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  }
}

function buildEmptyInventoryStateSafe(
  options: {
    readonly hotbarSize?: number;
    readonly selectedSlot?: number;
    readonly source?: string;
    readonly sourceDetail?: string;
    readonly route?: string;
  },
): EditorInventoryState {
  try {
    return buildEmptyInventoryState({
      ...options,
      hotbarSize: normalizeHotbarSize(options.hotbarSize),
      selectedSlot: clampSelectedSlot(
        options.selectedSlot,
        normalizeHotbarSize(options.hotbarSize),
      ),
    } as unknown as BuildEmptyInventoryStateOptions);
  } catch {
    return buildEmptyInventoryState({
      hotbarSize: DEFAULT_HOTBAR_SIZE_NUMBER,
      selectedSlot: DEFAULT_SELECTED_SLOT_NUMBER,
      source: "fallback",
      sourceDetail: "build-empty-state-safe-failed",
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    } as unknown as BuildEmptyInventoryStateOptions);
  }
}

function normalizeEditorInventoryStateSafe(
  state: EditorInventoryState,
  options: {
    readonly hotbarSize?: number;
    readonly selectedSlot?: number;
    readonly includeEmptySlots?: boolean;
    readonly source?: string;
    readonly route?: string;
    readonly sourceDetail?: string;
  },
): EditorInventoryState {
  try {
    const hotbarSize = normalizeHotbarSize(options.hotbarSize);
    const selectedSlot = clampSelectedSlot(options.selectedSlot, hotbarSize);

    return normalizeEditorInventoryState(state, {
      ...options,
      hotbarSize,
      selectedSlot,
    } as unknown as NormalizeEditorInventoryStateOptions);
  } catch {
    return buildEmptyInventoryStateSafe({
      hotbarSize: options.hotbarSize,
      selectedSlot: options.selectedSlot,
      source: "fallback",
      sourceDetail: "normalize-state-safe-failed",
      route: options.route ?? PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    });
  }
}

function makeInitialState(options?: LibraryInventorySourceOptions): EditorInventoryState {
  try {
    if (options?.initialState) {
      return sanitizeState(
        normalizeEditorInventoryStateSafe(options.initialState, {
          hotbarSize: options.hotbarSize,
          selectedSlot: options.selectedSlot,
          includeEmptySlots: true,
          source: "library",
          route: normalizeApiUrl(options.apiUrl),
        }),
        options,
      );
    }

    const hotbarSize = normalizeHotbarSize(options?.hotbarSize);
    const selectedSlot = clampSelectedSlot(options?.selectedSlot, hotbarSize);

    return sanitizeState(
      buildEmptyInventoryStateSafe({
        hotbarSize,
        selectedSlot,
        source: "fallback",
        sourceDetail: "initial-empty",
        route: normalizeApiUrl(options?.apiUrl),
      }),
      options,
    );
  } catch {
    return buildEmptyInventoryStateSafe({
      hotbarSize: DEFAULT_HOTBAR_SIZE_NUMBER,
      selectedSlot: DEFAULT_SELECTED_SLOT_NUMBER,
      source: "fallback",
      sourceDetail: "initial-state-failed",
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    });
  }
}

function getSlotsFromState(state: EditorInventoryState): EditorInventorySlot[] {
  try {
    return Array.isArray(state.slots)
      ? [...state.slots].sort((left, right) => getSlotIndex(left) - getSlotIndex(right))
      : [];
  } catch {
    return [];
  }
}

function getItemsFromState(state: EditorInventoryState): EditorInventoryItem[] {
  try {
    return Array.isArray(state.items) ? [...state.items] : [];
  } catch {
    return [];
  }
}

function getPlaceableSlotsFromState(state: EditorInventoryState): EditorInventorySlot[] {
  try {
    return getSlotsFromState(state).filter((slot) => {
      try {
        return isPlaceableLibrarySlot(slot) && !hasForbiddenDebugBlock(slot);
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function hasForbiddenDebugBlock(
  slot: EditorInventorySlot | null | undefined,
): boolean {
  if (!slot) {
    return false;
  }

  return Boolean(
    isForbiddenDebugBlockTypeId(slot.blockTypeId) ||
      isForbiddenDebugBlockTypeId(slot.block_type_id) ||
      isForbiddenDebugBlockTypeId(slot.runtimeBlockTypeId) ||
      isForbiddenDebugBlockTypeId(slot.runtime_block_type_id),
  );
}

function stateContainsForbiddenDebugBlocks(state: EditorInventoryState): boolean {
  return containsForbiddenDebugBlockTypeId(state);
}

function sanitizeState(
  state: EditorInventoryState,
  options?: LibraryInventorySourceOptions,
): EditorInventoryState {
  try {
    if (stateContainsForbiddenDebugBlocks(state)) {
      return buildEmptyInventoryStateSafe({
        hotbarSize:
          state.hotbarSize ||
          options?.hotbarSize ||
          DEFAULT_HOTBAR_SIZE_NUMBER,
        selectedSlot:
          state.selectedSlot ??
          options?.selectedSlot ??
          DEFAULT_SELECTED_SLOT_NUMBER,
        source: "fallback",
        sourceDetail: "forbidden-debug-items-detected",
        route: normalizeApiUrl(options?.apiUrl),
      });
    }

    const hotbarSize = normalizeHotbarSize(
      state.hotbarSize ?? options?.hotbarSize ?? DEFAULT_HOTBAR_SIZE_NUMBER,
    );
    const selectedSlot = clampSelectedSlot(
      state.selectedSlot ?? state.defaultSelectedSlot ?? options?.selectedSlot,
      hotbarSize,
    );

    const normalized = normalizeEditorInventoryStateSafe(state, {
      hotbarSize,
      selectedSlot,
      includeEmptySlots: true,
      source: "library",
      route: normalizeApiUrl(options?.apiUrl),
    });

    normalized.onlyLibraryItemsPlaceable = ONLY_LIBRARY_ITEMS_PLACEABLE;
    normalized.debugGrassDirtAllowed = DEBUG_GRASS_DIRT_ALLOWED;
    normalized.allowChunkPlaceableFallback = false;
    normalized.allowPlaceAction = getPlaceableSlotsFromState(normalized).length > 0;

    return normalized;
  } catch {
    return buildEmptyInventoryStateSafe({
      hotbarSize: options?.hotbarSize ?? DEFAULT_HOTBAR_SIZE_NUMBER,
      selectedSlot: options?.selectedSlot ?? DEFAULT_SELECTED_SLOT_NUMBER,
      source: "fallback",
      sourceDetail: "sanitize-state-failed",
      route: normalizeApiUrl(options?.apiUrl),
    });
  }
}

function getSelectedSlotFromState(
  state: EditorInventoryState,
): EditorInventorySlot | null {
  try {
    const direct = getSelectedInventorySlot({ inventory: state });
    if (direct && !hasForbiddenDebugBlock(direct)) {
      return direct;
    }

    const selectedSlotIndex = clampSelectedSlot(
      state.selectedSlot,
      state.hotbarSize || DEFAULT_HOTBAR_SIZE_NUMBER,
    );
    return (
      getSlotsFromState(state).find(
        (slot) => getSlotIndex(slot) === selectedSlotIndex,
      ) ?? null
    );
  } catch {
    return null;
  }
}

function getSelectedItemFromState(
  state: EditorInventoryState,
): EditorInventoryItem | null {
  try {
    const selected = getSelectedInventoryItem({ inventory: state });

    if (!selected) {
      return null;
    }

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      selected.runtimeBlockTypeId ?? selected.blockTypeId,
    );

    if (!runtimeBlockTypeId) {
      return selected;
    }

    return {
      ...selected,
      runtimeBlockTypeId,
      blockTypeId: normalizeRuntimeBlockTypeId(
        selected.blockTypeId ?? runtimeBlockTypeId,
      ),
    };
  } catch {
    return null;
  }
}

function getRuntimeSelectionFromStateSafe(
  state: EditorInventoryState,
): EditorInventoryRuntimeSelection {
  try {
    return getRuntimeSelectionFromInventoryState(state);
  } catch {
    const selectedSlotIndex = clampSelectedSlot(
      state.selectedSlot,
      state.hotbarSize || DEFAULT_HOTBAR_SIZE_NUMBER,
    );

    return {
      slotIndex: selectedSlotIndex,
      slot: null,
      item: null,
      libraryRef: null,
      placementCommand: null,
      runtimeBlockTypeId: null,
      blockTypeId: null,
      placeable: false,
      source: "empty",
      itemKind: "empty",
    };
  }
}

function getLibraryRefFromSlotSafe(
  slot: EditorInventorySlot | null | undefined,
): EditorInventoryLibraryRef | null {
  try {
    if (!slot) {
      return null;
    }

    return normalizeEditorInventoryLibraryRef(
      getLibraryRef(slot) ??
        slot.libraryRef ??
        slot.library_ref ??
        {
          source: "vectoplan-library",
          kind: "vplib",
          libraryItemId: asOptionalString(slot.itemId ?? slot.item_id),
          familyId: asOptionalString(slot.familyId ?? slot.family_id),
          packageId: asOptionalString(slot.packageId ?? slot.package_id),
          vplibUid: asOptionalString(slot.vplibUid ?? slot.vplib_uid),
          variantId:
            asOptionalString(slot.variantId ?? slot.variant_id) ?? "default",
          revisionHash: asOptionalString(
            slot.revisionHash ?? slot.revision_hash,
          ),
          objectKind: asOptionalString(slot.objectKind ?? slot.object_kind),
          domain: asOptionalString(slot.domain),
          category: asOptionalString(slot.category),
          subcategory: asOptionalString(slot.subcategory),
        },
    );
  } catch {
    return null;
  }
}

function getPlacementCommandFromSlotSafe(
  slot: EditorInventorySlot | null | undefined,
): EditorInventoryPlacementCommand | null {
  try {
    if (!slot) {
      return null;
    }

    const direct = normalizeEditorInventoryPlacementCommand(
      getPlacementCommand(slot) ?? slot.placementCommand ?? slot.placement_command,
    );

    if (direct) {
      return direct;
    }

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      slot.runtimeBlockTypeId ??
        slot.runtime_block_type_id ??
        slot.blockTypeId ??
        slot.block_type_id,
    );
    const libraryRef = getLibraryRefFromSlotSafe(slot);

    if (!runtimeBlockTypeId || !libraryRef) {
      return null;
    }

    return normalizeEditorInventoryPlacementCommand({
      kind: "PlaceLibraryItem",
      source: "vectoplan-library",
      runtimeBlockTypeId,
      blockTypeId: runtimeBlockTypeId,
      libraryRef,
      placeable: true,
    });
  } catch {
    return null;
  }
}

function makeSnapshot(
  state: EditorInventoryState,
  loadState: LibraryInventorySourceLoadState,
  lastError: Error | null,
  lastLoadedAt: number | null,
  lastRequestId: string | null,
  destroyed: boolean,
): LibraryInventorySourceSnapshot {
  const slots = getSlotsFromState(state);
  const items = getItemsFromState(state);
  const selectedSlot = getSelectedSlotFromState(state);
  const selectedItem = getSelectedItemFromState(state);
  const runtimeSelection = getRuntimeSelectionFromStateSafe(state);
  const placeableSlots = getPlaceableSlotsFromState(state);
  const runtimePlaceable = buildRuntimePlaceableFromSlot(
    selectedSlot,
    selectedItem,
  );

  return {
    kind: SNAPSHOT_KIND,
    source: asString(state.source, "library"),
    loadState,
    state,
    slots,
    items,
    selectedSlotIndex: clampSelectedSlot(
      state.selectedSlot,
      state.hotbarSize || slots.length || DEFAULT_HOTBAR_SIZE_NUMBER,
    ),
    selectedSlot,
    selectedItem,
    runtimeSelection,
    runtimePlaceable,
    lastError,
    lastLoadedAt,
    lastRequestId,
    hasPlaceableItems: placeableSlots.length > 0,
    placeableSlots,
    destroyed,
    productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  };
}

function isUsableLoadSuccess(
  result: EditorInventoryLoadResult,
): result is EditorInventoryLoadSuccess {
  try {
    if (!result.ok) {
      return false;
    }

    if (!result.state || stateContainsForbiddenDebugBlocks(result.state)) {
      return false;
    }

    return getPlaceableSlotsFromState(result.state).length > 0;
  } catch {
    return false;
  }
}

function getFailureError(result: EditorInventoryLoadResult): Error {
  try {
    if (!result.ok) {
      return (
        getEditorInventoryLoadError(result) ??
        result.error ??
        new Error(
          getEditorInventoryLoadReason(
            result,
            "Library inventory load failed.",
          ),
        )
      );
    }

    return new Error("Inventory enthält keine placebaren Library-/VPLIB-Slots.");
  } catch {
    return new Error("Library inventory load failed.");
  }
}

function getLoadStateFromResult(
  result: EditorInventoryLoadResult,
): LibraryInventorySourceLoadState {
  try {
    if (!result.ok) {
      return "error";
    }

    const placeableSlots = getPlaceableSlotsFromState(result.state);

    if (placeableSlots.length > 0) {
      return "ready";
    }

    return result.payload?.fallback?.active ? "fallback" : "empty";
  } catch {
    return "error";
  }
}

function extractRequestId(result: EditorInventoryLoadResult): string | null {
  try {
    return asOptionalString(result.payload?.diagnostics?.requestId);
  } catch {
    return null;
  }
}

function normalizeItemFromSlot(
  slot: EditorInventorySlot | null,
): EditorInventoryItem | null {
  if (!slot || slot.empty || !isPlaceableLibrarySlot(slot) || hasForbiddenDebugBlock(slot)) {
    return null;
  }

  try {
    return {
      itemId: asOptionalString(slot.itemId ?? slot.item_id),
      itemKind: asString(
        slot.itemKind ?? slot.item_kind ?? slot.kind,
        DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
      ),
      kind: asString(
        slot.kind ?? slot.itemKind ?? slot.item_kind,
        DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
      ),
      source: asString(slot.source, "library"),
      label: asOptionalString(slot.label),
      displayLabel: asOptionalString(slot.displayLabel ?? slot.display_label),
      visibleLabel: asBoolean(slot.visibleLabel ?? slot.visible_label, true),
      description: asOptionalString(slot.description),
      blockTypeId: normalizeRuntimeBlockTypeId(getBlockTypeId(slot)),
      runtimeBlockTypeId: normalizeRuntimeBlockTypeId(getRuntimeBlockTypeId(slot)),
      familyId: asOptionalString(slot.familyId ?? slot.family_id),
      packageId: asOptionalString(slot.packageId ?? slot.package_id),
      vplibUid: asOptionalString(slot.vplibUid ?? slot.vplib_uid),
      variantId: asOptionalString(slot.variantId ?? slot.variant_id) ?? "default",
      revisionHash: asOptionalString(slot.revisionHash ?? slot.revision_hash),
      objectKind: asOptionalString(slot.objectKind ?? slot.object_kind),
      domain: asOptionalString(slot.domain),
      category: asOptionalString(slot.category),
      subcategory: asOptionalString(slot.subcategory),
      iconKey: asOptionalString(slot.iconKey ?? slot.icon_key),
      iconKind: asString(slot.iconKind ?? slot.icon_kind, "library-item"),
      iconUrl: asOptionalString(slot.iconUrl ?? slot.icon_url),
      icon: slot.icon ?? null,
      placeable: true,
      breakable: asBoolean(slot.breakable, false),
      libraryRef: getLibraryRefFromSlotSafe(slot),
      placementCommand: getPlacementCommandFromSlotSafe(slot),
      assets: asRecord(slot.assets),
      metadata: asRecord(slot.metadata),
    };
  } catch {
    return null;
  }
}

function buildRuntimePlaceableFromSlot(
  slot: EditorInventorySlot | null,
  item: EditorInventoryItem | null,
): EditorInventoryRuntimePlaceable | null {
  try {
    if (!slot || slot.empty || !isPlaceableLibrarySlot(slot) || hasForbiddenDebugBlock(slot)) {
      return null;
    }

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      getRuntimeBlockTypeId(slot),
    );
    const blockTypeId = normalizeRuntimeBlockTypeId(
      getBlockTypeId(slot) ?? runtimeBlockTypeId,
    );
    const libraryRef = getLibraryRefFromSlotSafe(slot);
    const placementCommand = getPlacementCommandFromSlotSafe(slot);

    if (!runtimeBlockTypeId || !blockTypeId || !libraryRef || !placementCommand) {
      return null;
    }

    const runtimePlaceable = createEditorInventoryRuntimePlaceable({
      source: "library",
      sourceKind: "library",
      slotIndex: getSlotIndex(slot),
      inventorySlotIndex: getSlotIndex(slot),
      itemId: asOptionalString(slot.itemId ?? slot.item_id),
      itemKind: asString(
        slot.itemKind ?? slot.item_kind ?? slot.kind,
        DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
      ),
      runtimeBlockTypeId,
      blockTypeId,
      libraryItemId: asOptionalString(slot.itemId ?? slot.item_id),
      inventoryItemId: asOptionalString(item?.itemId ?? slot.itemId ?? slot.item_id),
      familyId: asOptionalString(slot.familyId ?? slot.family_id),
      packageId: asOptionalString(slot.packageId ?? slot.package_id),
      vplibUid: asOptionalString(slot.vplibUid ?? slot.vplib_uid),
      variantId: asOptionalString(slot.variantId ?? slot.variant_id) ?? "default",
      revisionHash: asOptionalString(slot.revisionHash ?? slot.revision_hash),
      objectKind: asOptionalString(slot.objectKind ?? slot.object_kind),
      label: asString(slot.label, "VPLIB Item"),
      libraryRef,
      placementCommand,
      commandMetadata: {
        source: "library-inventory-source",
        slotIndex: getSlotIndex(slot),
        productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
      },
      rawSlot: slot,
      rawItem: item,
      requireLibraryIdentity: true,
    });

    return isEditorInventoryRuntimePlaceable(runtimePlaceable)
      ? runtimePlaceable
      : null;
  } catch {
    return null;
  }
}

export class LibraryInventorySource implements LibraryInventorySourceHandle {
  public readonly kind = LIBRARY_INVENTORY_SOURCE_HANDLE_KIND;

  private readonly client: EditorInventoryApiClient;
  private readonly options: LibraryInventorySourceOptions;
  private readonly listeners = new Set<LibraryInventorySourceListener>();

  private state: EditorInventoryState;
  private loadState: LibraryInventorySourceLoadState =
    LIBRARY_INVENTORY_DEFAULT_LOAD_STATE;
  private lastError: Error | null = null;
  private lastLoadedAt: number | null = null;
  private lastRequestId: string | null = null;
  private activeLoad: Promise<LibraryInventorySourceSnapshot> | null = null;
  private selectionPersistTimer: number | null = null;
  private destroyed = false;

  public constructor(options?: LibraryInventorySourceOptions) {
    this.options = {
      includeEmptySlots: true,
      allowEmptyFallback: true,
      ...options,
      hotbarSize: normalizeHotbarSize(options?.hotbarSize),
      selectedSlot: clampSelectedSlot(
        options?.selectedSlot,
        normalizeHotbarSize(options?.hotbarSize),
      ),
      apiUrl: normalizeApiUrl(options?.apiUrl),
    };

    this.client =
      options?.client ??
      getDefaultEditorInventoryApiClient({
        ...options?.clientConfig,
        apiUrl: normalizeApiUrl(options?.apiUrl ?? options?.clientConfig?.apiUrl),
        hotbarSize: normalizeHotbarSize(
          options?.hotbarSize ?? options?.clientConfig?.hotbarSize,
        ),
        selectedSlot: clampSelectedSlot(
          options?.selectedSlot ?? options?.clientConfig?.selectedSlot,
          normalizeHotbarSize(options?.hotbarSize ?? options?.clientConfig?.hotbarSize),
        ),
        forceRefresh:
          options?.forceRefreshOnBoot ?? options?.clientConfig?.forceRefresh,
        timeoutMs: options?.timeoutMs ?? options?.clientConfig?.timeoutMs,
      } as Partial<EditorInventoryApiClientConfig>);

    this.state = sanitizeState(makeInitialState(this.options), this.options);

    if (options?.autoLoad) {
      void this.load({
        forceRefresh: Boolean(options.forceRefreshOnBoot),
        reason: "auto-load",
      });
    }
  }

  public subscribe(listener: LibraryInventorySourceListener): () => void {
    if (this.destroyed) {
      return () => undefined;
    }

    try {
      this.listeners.add(listener);

      return () => {
        try {
          this.listeners.delete(listener);
        } catch {
          // Ignore unsubscribe failure.
        }
      };
    } catch {
      return () => undefined;
    }
  }

  public getSnapshot(): LibraryInventorySourceSnapshot {
    return makeSnapshot(
      this.state,
      this.loadState,
      this.lastError,
      this.lastLoadedAt,
      this.lastRequestId,
      this.destroyed,
    );
  }

  public getState(): EditorInventoryState {
    return cloneState(this.state);
  }

  public getLoadState(): LibraryInventorySourceLoadState {
    return this.loadState;
  }

  public getLastError(): Error | null {
    return this.lastError;
  }

  public getSlots(): EditorInventorySlot[] {
    return this.getSnapshot().slots;
  }

  public getItems(): EditorInventoryItem[] {
    return this.getSnapshot().items;
  }

  public getPlaceableSlots(): EditorInventorySlot[] {
    return this.getSnapshot().placeableSlots;
  }

  public hasPlaceableItems(): boolean {
    return this.getSnapshot().hasPlaceableItems;
  }

  public getSelectedSlotIndex(): number {
    return this.getSnapshot().selectedSlotIndex;
  }

  public getSelectedSlot(): EditorInventorySlot | null {
    return this.getSnapshot().selectedSlot;
  }

  public getSelectedItem(): EditorInventoryItem | null {
    return this.getSnapshot().selectedItem;
  }

  public getRuntimeSelection(): EditorInventoryRuntimeSelection {
    return this.getSnapshot().runtimeSelection;
  }

  public getSelectedRuntimePlaceable(): EditorInventoryRuntimePlaceable | null {
    return this.getSnapshot().runtimePlaceable;
  }

  public getRuntimePlaceableForSlot(
    slotIndex: number,
  ): EditorInventoryRuntimePlaceable | null {
    const slot = this.getSlot(slotIndex);
    const item = slot ? normalizeItemFromSlot(slot) : null;
    return buildRuntimePlaceableFromSlot(slot, item);
  }

  public getSlot(slotIndex: number): EditorInventorySlot | null {
    const safeIndex = clampSelectedSlot(
      slotIndex,
      this.state.hotbarSize || DEFAULT_HOTBAR_SIZE_NUMBER,
    );
    return (
      this.getSlots().find((slot) => getSlotIndex(slot) === safeIndex) ?? null
    );
  }

  public async load(
    options?: LibraryInventorySourceLoadOptions,
  ): Promise<LibraryInventorySourceSnapshot> {
    if (this.destroyed) {
      return this.getSnapshot();
    }

    const loadOptions = normalizeInventorySourceLoadOptions(options);

    if (this.activeLoad && !loadOptions.forceRefresh && !loadOptions.force) {
      return this.activeLoad;
    }

    if (
      loadOptions.selectedSlotIndex !== undefined ||
      loadOptions.selectedSlot !== undefined
    ) {
      this.selectSlot(
        loadOptions.selectedSlotIndex ??
          loadOptions.selectedSlot ??
          this.getSelectedSlotIndex(),
        "load-options-selection",
      );
    }

    this.setLoadState("loading", "load-start");

    const promise = this.loadInternal(loadOptions);
    this.activeLoad = promise;

    try {
      return await promise;
    } finally {
      this.activeLoad = null;
    }
  }

  public async reload(
    options?: LibraryInventorySourceLoadOptions,
  ): Promise<LibraryInventorySourceSnapshot> {
    return this.load({
      ...options,
      force: true,
      forceRefresh: true,
      reason: options?.reason ?? "reload",
    });
  }

  public async refresh(
    options?: LibraryInventorySourceRefreshOptions,
  ): Promise<LibraryInventorySourceSnapshot> {
    return this.load({
      ...options,
      force: true,
      forceRefresh: true,
      reason: options?.reason ?? "refresh",
    });
  }

  private persistSelection(slotIndex: number, reason?: string): void {
    if (reason === "load-options-selection" || typeof window === "undefined") {
      return;
    }

    if (this.selectionPersistTimer !== null) {
      window.clearTimeout(this.selectionPersistTimer);
    }

    this.selectionPersistTimer = window.setTimeout(() => {
      this.selectionPersistTimer = null;
      if (this.destroyed || typeof fetch !== "function") return;
      const url = `${normalizeApiUrl(this.options.apiUrl).replace(/\/+$/, "")}/select-slot`;
      void fetch(url, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ slotIndex, selectedSlot: slotIndex }),
      }).then((response) => {
        if (!response.ok) throw new Error(`Inventory selection HTTP ${response.status}`);
      }).catch((error: unknown) => {
        try {
          console.warn("[vectoplan-editor] User inventory selection was not persisted.", error);
        } catch {
          // Persistence is best effort; local selection remains usable.
        }
      });
    }, 140);
  }

  public selectSlot(
    slotIndex: number,
    reason?: string,
  ): LibraryInventorySourceSnapshot {
    if (this.destroyed) {
      return this.getSnapshot();
    }

    try {
      const hotbarSize = this.state.hotbarSize || DEFAULT_HOTBAR_SIZE_NUMBER;
      const selectedSlot = clampSelectedSlot(slotIndex, hotbarSize);

      const slots = getSlotsFromState(this.state).map((slot) => ({
        ...slot,
        selected: getSlotIndex(slot) === selectedSlot,
      }));

      const selectedSlotRecord =
        slots.find((slot) => getSlotIndex(slot) === selectedSlot) ?? null;

      this.state = sanitizeState(
        {
          ...this.state,
          selectedSlot,
          defaultSelectedSlot: selectedSlot,
          slots,
          selectedItem: normalizeItemFromSlot(selectedSlotRecord),
          selectionReason: reason ?? "select-slot",
        } as EditorInventoryState,
        this.options,
      );

      this.emit("selection-change");
      this.emit("state-change");

      this.persistSelection(selectedSlot, reason);
      return this.getSnapshot();
    } catch (error) {
      this.lastError = createError(
        error,
        "Library inventory slot selection failed.",
      );
      this.emit("state-change", this.lastError);
      return this.getSnapshot();
    }
  }

  public selectNext(reason?: string): LibraryInventorySourceSnapshot {
    const hotbarSize = this.state.hotbarSize || DEFAULT_HOTBAR_SIZE_NUMBER;
    const current = this.getSelectedSlotIndex();
    const next =
      this.state.scrollWrap === false
        ? Math.min(hotbarSize - 1, current + 1)
        : (current + 1) % hotbarSize;

    return this.selectSlot(next, reason ?? "select-next");
  }

  public selectPrevious(reason?: string): LibraryInventorySourceSnapshot {
    const hotbarSize = this.state.hotbarSize || DEFAULT_HOTBAR_SIZE_NUMBER;
    const current = this.getSelectedSlotIndex();
    const previous =
      this.state.scrollWrap === false
        ? Math.max(0, current - 1)
        : (current - 1 + hotbarSize) % hotbarSize;

    return this.selectSlot(previous, reason ?? "select-previous");
  }

  public reset(): LibraryInventorySourceSnapshot {
    if (this.destroyed) {
      return this.getSnapshot();
    }

    try {
      this.state = sanitizeState(makeInitialState(this.options), this.options);
      this.loadState = "idle";
      this.lastError = null;
      this.lastLoadedAt = null;
      this.lastRequestId = null;
      this.activeLoad = null;
      this.emit("reset");
      this.emit("state-change");
    } catch (error) {
      this.lastError = createError(error, "Library inventory reset failed.");
      this.emit("state-change", this.lastError);
    }

    return this.getSnapshot();
  }

  public clearCache(): void {
    try {
      this.client.clearCache();
    } catch {
      // bewusst still
    }

    try {
      clearEditorInventoryContractCaches();
      clearLibraryInventorySourceLocalCaches();
    } catch {
      // Cache clearing is best-effort.
    }
  }

  public getDiagnostics(): UnknownRecord {
    const snapshot = this.getSnapshot();

    let clientDiagnostics: unknown = null;

    try {
      clientDiagnostics = this.client.getDiagnostics();
    } catch {
      clientDiagnostics = null;
    }

    return {
      moduleName: LIBRARY_INVENTORY_SOURCE_MODULE_NAME,
      moduleVersion: LIBRARY_INVENTORY_SOURCE_MODULE_VERSION,
      handleKind: this.kind,
      loadState: this.loadState,
      destroyed: this.destroyed,
      lastError: this.lastError?.message ?? null,
      lastLoadedAt: this.lastLoadedAt,
      lastRequestId: this.lastRequestId,
      snapshot: {
        source: snapshot.source,
        slotCount: snapshot.slots.length,
        itemCount: snapshot.items.length,
        selectedSlotIndex: snapshot.selectedSlotIndex,
        hasPlaceableItems: snapshot.hasPlaceableItems,
        placeableSlotCount: snapshot.placeableSlots.length,
        runtimePlaceable: snapshot.runtimePlaceable
          ? {
              runtimeBlockTypeId: snapshot.runtimePlaceable.runtimeBlockTypeId,
              familyId: snapshot.runtimePlaceable.familyId,
              vplibUid: snapshot.runtimePlaceable.vplibUid,
              variantId: snapshot.runtimePlaceable.variantId,
              objectKind: snapshot.runtimePlaceable.objectKind,
            }
          : null,
      },
      contract: editorInventoryContractDiagnostics(
        snapshot.runtimePlaceable ?? snapshot.state,
      ),
      client: clientDiagnostics,
      rules: {
        ...editorInventoryContractRules(),
        browserUsesEditorInventoryApi: true,
        browserDoesNotCallVectoplanLibraryDirectly: true,
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
        debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
        chunkPlaceableFallbackUsed: false,
        emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
        legacyChunkInventoryIsDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
        forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      },
    };
  }

  public destroy(reason?: string): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.activeLoad = null;
    this.loadState = "destroyed";
    this.lastError = reason ? new Error(reason) : null;
    if (this.selectionPersistTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.selectionPersistTimer);
      this.selectionPersistTimer = null;
    }
    this.emit("destroy", this.lastError);

    try {
      this.listeners.clear();
    } catch {
      // Ignore cleanup failure.
    }
  }

  private async loadInternal(
    options?: LibraryInventorySourceLoadOptions,
  ): Promise<LibraryInventorySourceSnapshot> {
    try {
      const result = await this.client.loadInventory({
        forceRefresh: Boolean(options?.forceRefresh ?? options?.force),
        includeEmptySlots: this.options.includeEmptySlots ?? true,
        ...(options?.signal ? { signal: options.signal } : {}),
      });

      this.lastLoadedAt = now();
      this.lastRequestId = extractRequestId(result);

      if (!isUsableLoadSuccess(result)) {
        const error = getFailureError(result);
        this.lastError = error;

        if (this.options.allowEmptyFallback !== false) {
          this.state = sanitizeState(result.state, this.options);
          this.loadState = getLoadStateFromResult(result);
          this.emit(
            this.loadState === "empty" || this.loadState === "fallback"
              ? "load-empty"
              : "load-error",
            error,
          );
          this.emit("state-change", error);
          return this.getSnapshot();
        }

        throw error;
      }

      this.state = sanitizeState(result.state, this.options);
      this.loadState = "ready";
      this.lastError = null;

      if (
        options?.selectedSlotIndex !== undefined ||
        options?.selectedSlot !== undefined
      ) {
        this.selectSlot(
          options.selectedSlotIndex ??
            options.selectedSlot ??
            this.getSelectedSlotIndex(),
          options.reason ?? "load-selection",
        );
      }

      this.emit("load-success");
      this.emit("state-change");

      return this.getSnapshot();
    } catch (error) {
      const normalizedError = createError(
        error,
        "Library-Inventory konnte nicht geladen werden.",
      );

      this.lastError = normalizedError;
      this.lastLoadedAt = now();
      this.loadState = "error";

      if (this.options.allowEmptyFallback !== false) {
        this.state = buildEmptyInventoryStateSafe({
          hotbarSize:
            this.options.hotbarSize ??
            this.state.hotbarSize ??
            DEFAULT_HOTBAR_SIZE_NUMBER,
          selectedSlot:
            this.state.selectedSlot ??
            this.options.selectedSlot ??
            DEFAULT_SELECTED_SLOT_NUMBER,
          source: "fallback",
          sourceDetail:
            normalizedError.message || "library-inventory-load-error",
          route: normalizeApiUrl(this.options.apiUrl),
        });
      }

      this.emit("load-error", normalizedError);
      this.emit("state-change", normalizedError);

      return this.getSnapshot();
    }
  }

  private setLoadState(
    loadState: LibraryInventorySourceLoadState,
    eventType?: LibraryInventorySourceEventType,
  ): void {
    if (this.destroyed && loadState !== "destroyed") {
      return;
    }

    this.loadState = loadState;

    if (eventType) {
      this.emit(eventType);
    }

    this.emit("state-change");
  }

  private emit(type: LibraryInventorySourceEventType, error?: Error | null): void {
    const event: LibraryInventorySourceEvent = {
      type,
      snapshot: this.getSnapshot(),
      error: error ?? this.lastError,
      reason: error?.message ?? this.lastError?.message ?? null,
    };

    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // Listener dürfen Source nicht zerstören.
      }
    }
  }
}

let defaultLibraryInventorySource: LibraryInventorySource | null = null;

export function createLibraryInventorySource(
  options?: LibraryInventorySourceOptions,
): LibraryInventorySource {
  return new LibraryInventorySource(options);
}

export function getDefaultLibraryInventorySource(
  options?: LibraryInventorySourceOptions,
): LibraryInventorySource {
  if (!defaultLibraryInventorySource || options) {
    defaultLibraryInventorySource = new LibraryInventorySource(options);
  }

  return defaultLibraryInventorySource;
}

export function clearLibraryInventorySourceCaches(): void {
  try {
    defaultLibraryInventorySource?.clearCache();
  } catch {
    // bewusst still
  }

  try {
    defaultLibraryInventorySource = null;
    clearEditorInventoryApiClientCaches();
    clearEditorInventoryContractCaches();
    clearLibraryInventorySourceLocalCaches();
  } catch {
    defaultLibraryInventorySource = null;
  }
}

export async function loadLibraryInventorySource(
  options?: LibraryInventorySourceOptions,
): Promise<LibraryInventorySourceSnapshot> {
  const source = getDefaultLibraryInventorySource(options);
  return source.load({
    forceRefresh: Boolean(options?.forceRefreshOnBoot),
    reason: "load-library-inventory-source",
  });
}

export function getLibraryInventorySourceSnapshot(): LibraryInventorySourceSnapshot {
  return getDefaultLibraryInventorySource().getSnapshot();
}

export function getLibraryInventoryRuntimeSelection(): EditorInventoryRuntimeSelection {
  return getDefaultLibraryInventorySource().getRuntimeSelection();
}

export function getLibraryInventoryRuntimePlaceable(): EditorInventoryRuntimePlaceable | null {
  return getDefaultLibraryInventorySource().getSelectedRuntimePlaceable();
}

export function selectLibraryInventorySlot(
  slotIndex: number,
): LibraryInventorySourceSnapshot {
  return getDefaultLibraryInventorySource().selectSlot(
    slotIndex,
    "select-library-inventory-slot",
  );
}

export function isLibraryInventorySource(
  value: unknown,
): value is LibraryInventorySourceHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<LibraryInventorySourceHandle>;

    return (
      record.kind === LIBRARY_INVENTORY_SOURCE_HANDLE_KIND &&
      typeof record.load === "function" &&
      typeof record.reload === "function" &&
      typeof record.selectSlot === "function" &&
      typeof record.getSnapshot === "function" &&
      typeof record.getSelectedRuntimePlaceable === "function" &&
      typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}

export function getLibraryInventorySourceMetadata(): UnknownRecord {
  return {
    moduleName: LIBRARY_INVENTORY_SOURCE_MODULE_NAME,
    moduleVersion: LIBRARY_INVENTORY_SOURCE_MODULE_VERSION,
    sourceKind: LIBRARY_INVENTORY_SOURCE_KIND,
    handleKind: LIBRARY_INVENTORY_SOURCE_HANDLE_KIND,
    itemKind: LIBRARY_INVENTORY_ITEM_KIND,
    defaultApiUrl: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    defaultHotbarSize: DEFAULT_HOTBAR_SIZE_NUMBER,
    defaultSelectedSlot: DEFAULT_SELECTED_SLOT_NUMBER,
    clientConfig: buildEditorInventoryApiClientConfig({
      apiUrl: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    }),
    contract: getEditorInventoryContractMetadata(),
    rules: {
      ...editorInventoryContractRules(),
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      chunkPlaceableFallbackUsed: false,
      forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      supportsReloadAlias: true,
      supportsDestroy: true,
      supportsContractRuntimePlaceable: true,
      loadResultUnionHandledSafely: true,
      hotbarSizeUsesBroadNumberInternally: true,
    },
  };
}

export {
  EditorInventoryApiClient,
  loadEditorInventory,
};