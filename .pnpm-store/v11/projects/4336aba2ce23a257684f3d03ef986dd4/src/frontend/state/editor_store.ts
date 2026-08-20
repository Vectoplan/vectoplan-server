// services/vectoplan-editor/src/frontend/state/editor_store.ts
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
} from "@api/editor_inventory_models";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorState } from "./editor_state";

export type EditorStoreListener = (
  state: EditorState,
  previousState: EditorState,
) => void;

export type EditorStoreUnsubscribe = () => void;

export type EditorStateUpdater =
  | EditorState
  | ((previous: EditorState) => EditorState);

export type EditorStoreInvariantWarningCode =
  | "invalid-state-shape"
  | "legacy-or-local-runtime-enabled"
  | "legacy-chunk-inventory-source"
  | "chunk-inventory-flags-enabled"
  | "library-placement-rules-disabled"
  | "debug-grass-dirt-enabled"
  | "forbidden-debug-block-ids-present"
  | "missing-inventory-selection"
  | "missing-library-identity"
  | "missing-runtime-block-type-id";

export interface EditorStoreInvariantWarning {
  readonly code: EditorStoreInvariantWarningCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface EditorStoreDiagnostics {
  readonly kind: "editor-store-diagnostics.v1";
  readonly stateValid: boolean;
  readonly schemaVersion: string | null;
  readonly lifecycleStatus: string | null;
  readonly worldStatus: string | null;
  readonly inventoryStatus: string | null;
  readonly inventorySource: string | null;
  readonly inventoryItemCount: number;
  readonly inventoryHotbarSlotCount: number;
  readonly inventoryLibraryItemCount: number;
  readonly inventoryPlaceableLibraryItemCount: number;
  readonly selectedSlotIndex: number | null;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedPackageId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedVariantId: string | null;
  readonly selectedRevisionHash: string | null;
  readonly onlyLibraryItemsPlaceable: boolean | null;
  readonly debugGrassDirtAllowed: boolean | null;
  readonly localWorldFallbackEnabled: boolean | null;
  readonly legacyFrontendEnabled: boolean | null;
  readonly legacyChunkInventoryDetected: boolean;
  readonly chunkInventoryFlagsEnabled: boolean;
  readonly forbiddenDebugBlockIdsDetected: boolean;
  readonly productiveInventoryRoute: "/editor/api/inventory";
  readonly browserCallsVectoplanLibraryDirectly: false;
  readonly updatedAt: string;
}

export interface EditorStoreSnapshot {
  readonly kind: "editor-store-snapshot.v1";
  readonly state: EditorState;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly listenerCount: number;
  readonly destroyed: boolean;
  readonly lastAction: string | null;
  readonly lastError: Record<string, unknown> | null;
  readonly diagnostics: EditorStoreDiagnostics;
  readonly invariantWarnings: readonly EditorStoreInvariantWarning[];
}

export interface CreateEditorStoreOptions {
  readonly initialState: EditorState;
  readonly logger?: EditorLogger;
  readonly maxHistoryEntries?: number;
}

export interface EditorStoreSetOptions {
  readonly action?: string;
  readonly notify?: boolean;
  readonly captureHistory?: boolean;
}

export interface EditorStore {
  readonly kind: "vectoplan-editor-store.v1";

  getState(): EditorState;
  peekState(): EditorState;
  setState(updater: EditorStateUpdater, options?: EditorStoreSetOptions): EditorState;
  patchState(
    patch: Partial<EditorState>,
    options?: EditorStoreSetOptions,
  ): EditorState;

  subscribe(listener: EditorStoreListener): EditorStoreUnsubscribe;
  once(listener: EditorStoreListener): EditorStoreUnsubscribe;

  getRevision(): number;
  getSnapshot(): EditorStoreSnapshot;
  getHistory(): readonly EditorStoreSnapshot[];

  clearHistory(): void;
  destroy(reason?: string): void;
}

const STORE_KIND = "vectoplan-editor-store.v1" as const;
const STORE_SNAPSHOT_KIND = "editor-store-snapshot.v1" as const;
const STORE_DIAGNOSTICS_KIND = "editor-store-diagnostics.v1" as const;

const EDITOR_STATE_SCHEMA_VERSION = "vectoplan-editor-state.v1" as const;
const DEFAULT_MAX_HISTORY_ENTRIES = 50;
const ABSOLUTE_MAX_HISTORY_ENTRIES = 250;
const PRODUCTIVE_INVENTORY_ROUTE = "/editor/api/inventory" as const;

const LEGACY_INVENTORY_SOURCES = new Set<string>([
  "chunk-service",
  "editor-placeholder",
  "chunk-palette",
  "static-fallback",
  "runtime-generated",
]);

const FORBIDDEN_DEBUG_BLOCK_TYPE_ID_SET: ReadonlySet<string> = new Set<string>(
  [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
);

function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  try {
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function readRecord(value: unknown, key: string): Record<string, unknown> {
  try {
    return toRecord(toRecord(value)[key]);
  } catch {
    return {};
  }
}

function readArray(value: unknown, key: string): readonly unknown[] {
  try {
    const candidate = toRecord(value)[key];
    return Array.isArray(candidate) ? candidate : [];
  } catch {
    return [];
  }
}

function isEditorStateLike(value: unknown): value is EditorState {
  try {
    const record = toRecord(value);

    return (
      record.schemaVersion === EDITOR_STATE_SCHEMA_VERSION &&
      isRecord(record.lifecycle) &&
      isRecord(record.world) &&
      isRecord(record.inventory) &&
      isRecord(record.creativeLibrary) &&
      isRecord(record.player) &&
      isRecord(record.ui) &&
      isRecord(record.debug)
    );
  } catch {
    return false;
  }
}

function nowIsoStringSafe(): string {
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

function safeString(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "number" || typeof value === "boolean") {
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : fallback;
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

function safeNullableString(value: unknown): string | null {
  const normalized = safeString(value, "");
  return normalized.length > 0 ? normalized : null;
}

function safeInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value.trim(), 10)
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.trunc(numeric)));
  } catch {
    return fallback;
  }
}

function safeBooleanOrNull(value: unknown): boolean | null {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) {
        return true;
      }

      if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
        return false;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function safeActionName(action: unknown, fallback = "store.setState"): string {
  try {
    if (typeof action !== "string") {
      return fallback;
    }

    const trimmed = action.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

const HIGH_FREQUENCY_ACTIONS: ReadonlySet<string> = new Set([
  "mouse.pointer-move",
  // Hotbar selection can fire for every mouse-wheel notch and again when the
  // embedded user inventory acknowledges the selection. Running the complete
  // invariant scan here recursively walks the large VPLIB raw payloads and
  // showed up as 31-61 ms stalls in F8 captures.
  "input-controller.hotbar-slot",
  "inventory/select-slot",
]);

function isHighFrequencyAction(action: string): boolean {
  return HIGH_FREQUENCY_ACTIONS.has(action);
}

function normalizeMaxHistoryEntries(value: unknown): number {
  return safeInteger(
    value,
    DEFAULT_MAX_HISTORY_ENTRIES,
    0,
    ABSOLUTE_MAX_HISTORY_ENTRIES,
  );
}

function shallowMergeState(
  previous: EditorState,
  patch: Partial<EditorState>,
): EditorState {
  try {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return previous;
    }

    return {
      ...previous,
      ...patch,
    };
  } catch {
    return previous;
  }
}

function freezeIfPossible<T>(value: T): T {
  try {
    if (value && typeof value === "object") {
      return Object.freeze(value) as T;
    }

    return value;
  } catch {
    return value;
  }
}

function cloneHistorySnapshot(snapshot: EditorStoreSnapshot): EditorStoreSnapshot {
  try {
    return freezeIfPossible({
      ...snapshot,
      invariantWarnings: [...snapshot.invariantWarnings],
      diagnostics: {
        ...snapshot.diagnostics,
      },
    });
  } catch {
    return snapshot;
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
    // Store logging must never throw.
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
    // Store logging must never throw.
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
    // Store logging must never throw.
  }
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "");
  return FORBIDDEN_DEBUG_BLOCK_TYPE_ID_SET.has(normalized);
}

function containsForbiddenDebugBlockIds(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);

    if (typeof serialized !== "string") {
      return false;
    }

    return [...FORBIDDEN_DEBUG_BLOCK_TYPE_ID_SET].some((id) =>
      serialized.includes(id),
    );
  } catch {
    return false;
  }
}

function inventoryItemHasLibraryIdentity(item: unknown): boolean {
  try {
    const record = toRecord(item);

    return Boolean(
      record.libraryRef ||
        record.placementCommand ||
        safeNullableString(record.libraryItemId) ||
        safeNullableString(record.familyId) ||
        safeNullableString(record.vplibUid),
    );
  } catch {
    return false;
  }
}

function inventoryItemIsLibraryItem(item: unknown): boolean {
  try {
    const record = toRecord(item);

    return Boolean(
      record.kind === "vplib" ||
        record.kind === "library-item" ||
        record.sourceKind === "library" ||
        record.sourceKind === "vplib" ||
        inventoryItemHasLibraryIdentity(record),
    );
  } catch {
    return false;
  }
}

function inventoryItemIsPlaceableLibraryItem(item: unknown): boolean {
  try {
    const record = toRecord(item);
    const runtimeBlockTypeId = safeNullableString(
      record.runtimeBlockTypeId ?? record.blockTypeId,
    );

    return Boolean(
      record.enabled === true &&
        record.placeable === true &&
        runtimeBlockTypeId &&
        !isForbiddenDebugBlockTypeId(runtimeBlockTypeId) &&
        inventoryItemIsLibraryItem(record),
    );
  } catch {
    return false;
  }
}

function arrayItems(value: unknown): readonly unknown[] {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function firstBooleanOrNull(...values: readonly unknown[]): boolean | null {
  try {
    for (const value of values) {
      const normalized = safeBooleanOrNull(value);

      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function createDiagnostics(
  state: EditorState,
  input: {
    readonly destroyed: boolean;
  },
): EditorStoreDiagnostics {
  try {
    const root = toRecord(state);
    const inventory = readRecord(root, "inventory");
    const creativeLibrary = readRecord(root, "creativeLibrary");
    const lifecycle = readRecord(root, "lifecycle");
    const world = readRecord(root, "world");
    const worldConnection = readRecord(world, "connection");
    const bootstrap = readRecord(root, "bootstrap");
    const bootstrapRuntime = readRecord(bootstrap, "runtime");
    const runtime = Object.keys(bootstrapRuntime).length > 0
      ? bootstrapRuntime
      : readRecord(root, "runtime");
    const runtimeChunk = readRecord(runtime, "chunk");
    const featureFlags = Object.keys(readRecord(bootstrap, "featureFlags")).length > 0
      ? readRecord(bootstrap, "featureFlags")
      : readRecord(root, "featureFlags");

    const inventoryItems = arrayItems(inventory.items);
    const hotbarSlots = arrayItems(inventory.hotbarSlots ?? inventory.slots);
    const inventorySource = safeNullableString(
      inventory.source ?? inventory.sourceKind,
    );
    const selectedRuntimeBlockTypeId = safeNullableString(
      inventory.selectedRuntimeBlockTypeId ?? inventory.selectedBlockTypeId,
    );

    const inventoryLibraryItemCount = inventoryItems.filter(
      inventoryItemIsLibraryItem,
    ).length;
    const inventoryPlaceableLibraryItemCount = inventoryItems.filter(
      inventoryItemIsPlaceableLibraryItem,
    ).length;
    const legacyChunkInventoryDetected =
      inventorySource === null
        ? false
        : LEGACY_INVENTORY_SOURCES.has(inventorySource);

    const chunkInventoryFlagsEnabled = [
      featureFlags.chunkServiceInventoryEnabled,
      featureFlags.chunkPaletteInventoryFallbackEnabled,
      featureFlags.placeableBlocksPlaceholderRouteEnabled,
      featureFlags.legacyChunkInventoryEnabled,
      inventory.allowChunkPlaceableFallback,
      inventory.allowLegacyChunkInventory,
    ].some((value) => safeBooleanOrNull(value) === true);

    const forbiddenDebugBlockIdsDetected = containsForbiddenDebugBlockIds({
      inventory,
      creativeLibrary,
    });

    return {
      kind: STORE_DIAGNOSTICS_KIND,
      stateValid: !input.destroyed && isEditorStateLike(state),
      schemaVersion: safeNullableString(root.schemaVersion),
      lifecycleStatus: safeNullableString(lifecycle.status),
      worldStatus: safeNullableString(
        worldConnection.status ?? world.status ?? root.worldStatus,
      ),
      inventoryStatus: safeNullableString(inventory.status),
      inventorySource,
      inventoryItemCount: inventoryItems.length,
      inventoryHotbarSlotCount: hotbarSlots.length,
      inventoryLibraryItemCount,
      inventoryPlaceableLibraryItemCount,
      selectedSlotIndex:
        inventory.selectedSlotIndex === undefined &&
        inventory.selectedSlot === undefined
          ? null
          : safeInteger(
              inventory.selectedSlotIndex ?? inventory.selectedSlot,
              0,
              0,
              999,
            ),
      selectedRuntimeBlockTypeId,
      selectedLibraryItemId: safeNullableString(
        inventory.selectedLibraryItemId ??
          inventory.libraryItemId ??
          inventory.selectedPlacementRef,
      ),
      selectedFamilyId: safeNullableString(
        inventory.selectedFamilyId ?? inventory.familyId,
      ),
      selectedPackageId: safeNullableString(
        inventory.selectedPackageId ?? inventory.packageId,
      ),
      selectedVplibUid: safeNullableString(
        inventory.selectedVplibUid ?? inventory.vplibUid,
      ),
      selectedVariantId: safeNullableString(
        inventory.selectedVariantId ?? inventory.variantId,
      ),
      selectedRevisionHash: safeNullableString(
        inventory.selectedRevisionHash ?? inventory.revisionHash,
      ),
      onlyLibraryItemsPlaceable: firstBooleanOrNull(
        inventory.onlyLibraryItemsPlaceable,
        featureFlags.onlyLibraryItemsPlaceable,
      ),
      debugGrassDirtAllowed: firstBooleanOrNull(
        inventory.debugGrassDirtAllowed,
        featureFlags.debugGrassDirtAllowed,
      ),
      localWorldFallbackEnabled: firstBooleanOrNull(
        runtime.localWorldFallbackEnabled,
        featureFlags.localWorldFallbackEnabled,
      ),
      legacyFrontendEnabled: firstBooleanOrNull(
        runtime.legacyFrontendEnabled,
        featureFlags.legacyFrontendEnabled,
      ),
      legacyChunkInventoryDetected:
        legacyChunkInventoryDetected ||
        safeBooleanOrNull(runtimeChunk.inventoryEnabled) === true,
      chunkInventoryFlagsEnabled,
      forbiddenDebugBlockIdsDetected,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      browserCallsVectoplanLibraryDirectly: false,
      updatedAt: nowIsoStringSafe(),
    };
  } catch {
    return {
      kind: STORE_DIAGNOSTICS_KIND,
      stateValid: false,
      schemaVersion: null,
      lifecycleStatus: null,
      worldStatus: null,
      inventoryStatus: null,
      inventorySource: null,
      inventoryItemCount: 0,
      inventoryHotbarSlotCount: 0,
      inventoryLibraryItemCount: 0,
      inventoryPlaceableLibraryItemCount: 0,
      selectedSlotIndex: null,
      selectedRuntimeBlockTypeId: null,
      selectedLibraryItemId: null,
      selectedFamilyId: null,
      selectedPackageId: null,
      selectedVplibUid: null,
      selectedVariantId: null,
      selectedRevisionHash: null,
      onlyLibraryItemsPlaceable: null,
      debugGrassDirtAllowed: null,
      localWorldFallbackEnabled: null,
      legacyFrontendEnabled: null,
      legacyChunkInventoryDetected: false,
      chunkInventoryFlagsEnabled: false,
      forbiddenDebugBlockIdsDetected: false,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      browserCallsVectoplanLibraryDirectly: false,
      updatedAt: nowIsoStringSafe(),
    };
  }
}

function createInvariantWarning(
  code: EditorStoreInvariantWarningCode,
  message: string,
  details?: Record<string, unknown>,
): EditorStoreInvariantWarning {
  if (details && Object.keys(details).length > 0) {
    return {
      code,
      message,
      details,
    };
  }

  return {
    code,
    message,
  };
}

function createInvariantWarnings(
  diagnostics: EditorStoreDiagnostics,
): readonly EditorStoreInvariantWarning[] {
  const warnings: EditorStoreInvariantWarning[] = [];

  if (!diagnostics.stateValid) {
    warnings.push(
      createInvariantWarning(
        "invalid-state-shape",
        "EditorState shape is invalid.",
        {
          schemaVersion: diagnostics.schemaVersion,
        },
      ),
    );
  }

  if (
    diagnostics.localWorldFallbackEnabled === true ||
    diagnostics.legacyFrontendEnabled === true
  ) {
    warnings.push(
      createInvariantWarning(
        "legacy-or-local-runtime-enabled",
        "Legacy/local runtime flags are enabled but the editor is chunk-service only.",
        {
          localWorldFallbackEnabled: diagnostics.localWorldFallbackEnabled,
          legacyFrontendEnabled: diagnostics.legacyFrontendEnabled,
        },
      ),
    );
  }

  if (diagnostics.legacyChunkInventoryDetected) {
    warnings.push(
      createInvariantWarning(
        "legacy-chunk-inventory-source",
        "Inventory source is legacy/diagnostic. Productive hotbar inventory must use /editor/api/inventory.",
        {
          inventorySource: diagnostics.inventorySource,
          productiveInventoryRoute: diagnostics.productiveInventoryRoute,
        },
      ),
    );
  }

  if (diagnostics.chunkInventoryFlagsEnabled) {
    warnings.push(
      createInvariantWarning(
        "chunk-inventory-flags-enabled",
        "Legacy chunk inventory flags are enabled.",
        {
          productiveInventoryRoute: diagnostics.productiveInventoryRoute,
        },
      ),
    );
  }

  if (diagnostics.onlyLibraryItemsPlaceable !== true) {
    warnings.push(
      createInvariantWarning(
        "library-placement-rules-disabled",
        "Inventory does not enforce Library/VPLIB-only placement.",
        {
          onlyLibraryItemsPlaceable: diagnostics.onlyLibraryItemsPlaceable,
        },
      ),
    );
  }

  if (diagnostics.debugGrassDirtAllowed === true) {
    warnings.push(
      createInvariantWarning(
        "debug-grass-dirt-enabled",
        "debug_grass/debug_dirt placement is enabled.",
        {
          forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
        },
      ),
    );
  }

  if (diagnostics.forbiddenDebugBlockIdsDetected) {
    warnings.push(
      createInvariantWarning(
        "forbidden-debug-block-ids-present",
        "Forbidden debug block ids are present in inventory or creative library state.",
        {
          forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
        },
      ),
    );
  }

  if (
    diagnostics.inventoryStatus === "ready" &&
    diagnostics.inventoryPlaceableLibraryItemCount > 0 &&
    !diagnostics.selectedRuntimeBlockTypeId
  ) {
    warnings.push(
      createInvariantWarning(
        "missing-runtime-block-type-id",
        "Inventory is ready but no selected runtimeBlockTypeId is available.",
      ),
    );
  }

  if (
    diagnostics.inventoryStatus === "ready" &&
    diagnostics.inventoryPlaceableLibraryItemCount > 0 &&
    !diagnostics.selectedLibraryItemId &&
    !diagnostics.selectedFamilyId &&
    !diagnostics.selectedVplibUid
  ) {
    warnings.push(
      createInvariantWarning(
        "missing-library-identity",
        "Inventory is ready but the selected item has no Library/VPLIB identity.",
      ),
    );
  }

  if (
    diagnostics.inventoryStatus === "ready" &&
    diagnostics.inventoryPlaceableLibraryItemCount > 0 &&
    diagnostics.selectedSlotIndex === null
  ) {
    warnings.push(
      createInvariantWarning(
        "missing-inventory-selection",
        "Inventory is ready but selectedSlotIndex is missing.",
      ),
    );
  }

  return warnings;
}

function invariantWarningSignature(
  warnings: readonly EditorStoreInvariantWarning[],
): string {
  try {
    return warnings
      .map((warning) => `${warning.code}:${warning.message}`)
      .join("|");
  } catch {
    return "unknown";
  }
}

function createSnapshot(input: {
  readonly state: EditorState;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly listenerCount: number;
  readonly destroyed: boolean;
  readonly lastAction: string | null;
  readonly lastError: Record<string, unknown> | null;
}): EditorStoreSnapshot {
  const diagnostics = createDiagnostics(input.state, {
    destroyed: input.destroyed,
  });
  const invariantWarnings = createInvariantWarnings(diagnostics);

  return freezeIfPossible({
    kind: STORE_SNAPSHOT_KIND,
    state: input.state,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    listenerCount: input.listenerCount,
    destroyed: input.destroyed,
    lastAction: input.lastAction,
    lastError: input.lastError,
    diagnostics,
    invariantWarnings,
  });
}

function notifyListenerSafely(
  listener: EditorStoreListener,
  state: EditorState,
  previousState: EditorState,
  logger?: EditorLogger,
): void {
  try {
    listener(state, previousState);
  } catch (error) {
    logWarn(logger, "Editor store listener failed.", {
      error: normalizeUnknownError(error),
    });
  }
}

function shouldCaptureHistory(options: EditorStoreSetOptions | undefined): boolean {
  try {
    return options?.captureHistory !== false;
  } catch {
    return true;
  }
}

function shouldNotify(options: EditorStoreSetOptions | undefined): boolean {
  try {
    return options?.notify !== false;
  } catch {
    return true;
  }
}

export function createEditorStore(options: CreateEditorStoreOptions): EditorStore {
  if (!isEditorStateLike(options.initialState)) {
    throw new Error("createEditorStore expected a valid EditorState initialState.");
  }

  const logger = options.logger;
  const maxHistoryEntries = normalizeMaxHistoryEntries(options.maxHistoryEntries);
  const createdAt = nowIsoStringSafe();

  let state: EditorState = options.initialState;
  let revision = 0;
  let destroyed = false;
  let updatedAt = createdAt;
  let notifying = false;
  let lastAction: string | null = "store.create";
  let lastError: Record<string, unknown> | null = null;
  let lastInvariantSignature = "";

  const listeners = new Set<EditorStoreListener>();
  const history: EditorStoreSnapshot[] = [];

  function assertAlive(action: string): void {
    if (destroyed) {
      throw new Error(
        `EditorStore is destroyed. Action '${action}' is not allowed.`,
      );
    }
  }

  function trimHistory(): void {
    try {
      if (maxHistoryEntries <= 0) {
        history.length = 0;
        return;
      }

      while (history.length > maxHistoryEntries) {
        history.shift();
      }
    } catch {
      // Ignore history trimming failures.
    }
  }

  function currentSnapshot(): EditorStoreSnapshot {
    return createSnapshot({
      state,
      revision,
      createdAt,
      updatedAt,
      listenerCount: listeners.size,
      destroyed,
      lastAction,
      lastError,
    });
  }

  function pushHistorySnapshot(): void {
    try {
      if (maxHistoryEntries <= 0) {
        return;
      }

      history.push(currentSnapshot());
      trimHistory();
    } catch (error) {
      logWarn(logger, "Editor store history snapshot failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function logInvariantWarningsIfChanged(action: string): void {
    try {
      const snapshot = currentSnapshot();
      const signature = invariantWarningSignature(snapshot.invariantWarnings);

      if (signature === lastInvariantSignature) {
        return;
      }

      lastInvariantSignature = signature;

      if (snapshot.invariantWarnings.length === 0) {
        logDebug(logger, "Editor store invariants are clean.", {
          action,
          revision,
          inventorySource: snapshot.diagnostics.inventorySource,
          selectedRuntimeBlockTypeId:
            snapshot.diagnostics.selectedRuntimeBlockTypeId,
        });
        return;
      }

      logWarn(logger, "Editor store invariant warnings detected.", {
        action,
        revision,
        warnings: snapshot.invariantWarnings,
        diagnostics: snapshot.diagnostics,
      });
    } catch {
      // Invariant diagnostics are non-fatal.
    }
  }

  function notifyListeners(previousState: EditorState, action: string): void {
    if (listeners.size === 0) {
      return;
    }

    if (notifying) {
      logWarn(logger, "Editor store nested notification detected.", {
        action,
        revision,
      });
    }

    const currentListeners = [...listeners];

    logDebug(logger, "Editor store notifying listeners.", {
      action,
      listenerCount: currentListeners.length,
      revision,
    });

    notifying = true;

    try {
      for (const listener of currentListeners) {
        if (!listeners.has(listener)) {
          continue;
        }

        notifyListenerSafely(listener, state, previousState, logger);
      }
    } finally {
      notifying = false;
    }
  }

  function commitState(
    nextState: EditorState,
    setOptions?: EditorStoreSetOptions,
  ): EditorState {
    const action = safeActionName(setOptions?.action);
    const highFrequency = isHighFrequencyAction(action);

    assertAlive(action);

    if (!isEditorStateLike(nextState)) {
      throw new Error(
        `EditorStore action '${action}' produced an invalid EditorState.`,
      );
    }

    const previousState = state;

    if (Object.is(previousState, nextState)) {
      lastAction = action;

      if (!highFrequency) {
        logDebug(logger, "Editor store state unchanged.", {
          action,
          revision,
        });
      }

      return state;
    }

    state = nextState;
    revision += 1;
    updatedAt = nowIsoStringSafe();
    lastAction = action;
    lastError = null;

    if (!highFrequency) {
      logInvariantWarningsIfChanged(action);
    }

    if (shouldCaptureHistory(setOptions)) {
      pushHistorySnapshot();
    }

    if (!highFrequency) {
      logDebug(logger, "Editor store state updated.", {
        action,
        revision,
        notify: shouldNotify(setOptions),
        captureHistory: shouldCaptureHistory(setOptions),
      });
    }

    if (shouldNotify(setOptions)) {
      notifyListeners(previousState, action);
    }

    return state;
  }

  pushHistorySnapshot();
  logInvariantWarningsIfChanged("store.create");

  const store: EditorStore = {
    kind: STORE_KIND,

    getState(): EditorState {
      assertAlive("getState");
      return state;
    },

    peekState(): EditorState {
      return state;
    },

    setState(
      updater: EditorStateUpdater,
      setOptions?: EditorStoreSetOptions,
    ): EditorState {
      const action = safeActionName(setOptions?.action);

      try {
        assertAlive(action);

        const nextState =
          typeof updater === "function"
            ? updater(state)
            : updater;

        return commitState(nextState, {
          action,
          notify: setOptions?.notify ?? true,
          captureHistory: setOptions?.captureHistory ?? true,
        });
      } catch (error) {
        const normalized = normalizeUnknownError(error);
        lastAction = action;
        lastError = normalized;

        logError(logger, "Editor store setState failed.", {
          action,
          error: normalized,
        });

        throw error;
      }
    },

    patchState(
      patch: Partial<EditorState>,
      setOptions?: EditorStoreSetOptions,
    ): EditorState {
      const action = safeActionName(setOptions?.action, "store.patchState");

      try {
        assertAlive(action);

        if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
          return state;
        }

        return commitState(shallowMergeState(state, patch), {
          action,
          notify: setOptions?.notify ?? true,
          captureHistory: setOptions?.captureHistory ?? true,
        });
      } catch (error) {
        const normalized = normalizeUnknownError(error);
        lastAction = action;
        lastError = normalized;

        logError(logger, "Editor store patchState failed.", {
          action,
          error: normalized,
        });

        throw error;
      }
    },

    subscribe(listener: EditorStoreListener): EditorStoreUnsubscribe {
      if (typeof listener !== "function") {
        throw new Error("EditorStore.subscribe expected a listener function.");
      }

      if (destroyed) {
        logWarn(
          logger,
          "Editor store subscribe ignored because store is destroyed.",
        );
        return () => undefined;
      }

      listeners.add(listener);

      logDebug(logger, "Editor store listener subscribed.", {
        listenerCount: listeners.size,
      });

      let unsubscribed = false;

      return () => {
        if (unsubscribed) {
          return;
        }

        unsubscribed = true;

        try {
          listeners.delete(listener);

          logDebug(logger, "Editor store listener unsubscribed.", {
            listenerCount: listeners.size,
          });
        } catch {
          // Ignore unsubscribe failures.
        }
      };
    },

    once(listener: EditorStoreListener): EditorStoreUnsubscribe {
      if (typeof listener !== "function") {
        throw new Error("EditorStore.once expected a listener function.");
      }

      let unsubscribe: EditorStoreUnsubscribe | null = null;

      const wrapped: EditorStoreListener = (nextState, previousState) => {
        try {
          unsubscribe?.();
        } finally {
          notifyListenerSafely(listener, nextState, previousState, logger);
        }
      };

      unsubscribe = store.subscribe(wrapped);
      return unsubscribe;
    },

    getRevision(): number {
      return revision;
    },

    getSnapshot(): EditorStoreSnapshot {
      return currentSnapshot();
    },

    getHistory(): readonly EditorStoreSnapshot[] {
      try {
        return history.map((snapshot) => cloneHistorySnapshot(snapshot));
      } catch {
        return [];
      }
    },

    clearHistory(): void {
      try {
        history.length = 0;
        pushHistorySnapshot();

        logDebug(logger, "Editor store history cleared.", {
          revision,
        });
      } catch (error) {
        logWarn(logger, "Editor store history clear failed.", {
          error: normalizeUnknownError(error),
        });
      }
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      const previousState = state;
      destroyed = true;
      updatedAt = nowIsoStringSafe();
      lastAction = "store.destroy";

      try {
        state = {
          ...state,
          lifecycle: {
            ...state.lifecycle,
            status: "destroyed",
            destroyedAt: updatedAt,
            updatedAt,
            lastReason: reason ?? state.lifecycle.lastReason,
          },
        };
        revision += 1;
        logInvariantWarningsIfChanged("store.destroy");
        pushHistorySnapshot();
        notifyListeners(previousState, "store.destroy");
      } catch (error) {
        lastError = normalizeUnknownError(error);

        logWarn(logger, "Editor store destroy state update failed.", {
          reason: reason ?? "unknown",
          error: lastError,
        });
      }

      try {
        listeners.clear();
      } catch {
        // Ignore cleanup failure.
      }

      logDebug(logger, "Editor store destroyed.", {
        reason: reason ?? "unknown",
        revision,
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      });
    },
  };

  logDebug(logger, "Editor store created.", {
    revision,
    createdAt,
    maxHistoryEntries,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
  });

  return store;
}

export function isEditorStore(value: unknown): value is EditorStore {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<EditorStore>;

    return (
      record.kind === STORE_KIND &&
      typeof record.getState === "function" &&
      typeof record.setState === "function" &&
      typeof record.subscribe === "function" &&
      typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}

export function getEditorStoreMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.state.editor_store",
    storeKind: STORE_KIND,
    snapshotKind: STORE_SNAPSHOT_KIND,
    diagnosticsKind: STORE_DIAGNOSTICS_KIND,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      storeDoesNotMutateInventorySemantics: true,
      storeReportsLibraryInventoryInvariants: true,
      storeReportsForbiddenDebugBlockIds: true,
      onlyLibraryItemsPlaceableExpected: true,
      debugGrassDirtAllowedExpected: false,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      diagnosticsUseRecordAdapters: true,
      noEmptyObjectPropertyAccess: true,
    },
  };
}
