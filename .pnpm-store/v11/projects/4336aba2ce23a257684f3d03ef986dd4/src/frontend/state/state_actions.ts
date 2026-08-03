// services/vectoplan-editor/src/frontend/state/state_actions.ts
import { chunkApiErrorToDetails } from "@api/chunk_api_errors";
import type {
  ChunkApiBlocksResult,
  ChunkApiCommandPayload,
  ChunkApiCommandResult,
  ChunkApiErrorDetails,
  ChunkApiFailedResult,
  ChunkApiRuntimeChunkContent,
} from "@api/chunk_api_models";
import type {
  EditorInventoryLoadResult,
  EditorInventoryPayload,
  EditorInventoryState as ApiEditorInventoryState,
} from "@api/editor_inventory_models";
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
} from "@api/editor_inventory_models";
import type { InventoryCatalog } from "@inventory/inventory_models";
import {
  createInventoryCatalogFromLibraryInventory,
} from "@inventory/inventory_models";
import {
  createInventorySlotFactoryResultFromEditorInventoryLoadResult,
  createInventorySlotFactoryResultFromEditorInventoryPayload,
  createInventorySlotFactoryResultFromEditorInventoryState,
} from "@inventory/inventory_slot_factory";
import type {
  EditorChunkSummaryInput,
  EditorConnectionStatus,
  EditorInventorySource,
  EditorLifecycleStatus,
  EditorPointerButton,
  EditorState,
  EditorStateChunkCellPosition,
  EditorStateEuler3,
  EditorStateVector3,
  EditorTargetKind,
  EditorTargetStatus,
  EditorToolId,
} from "./editor_state";
import {
  createEditorInventoryItemsFromBlocks,
  createEditorStateError,
  normalizeEditorStateError,
  withClearedTargetingState,
  withCommandError,
  withCommandPending,
  withCommandResult,
  withCreativeLibraryBlocks,
  withCreativeLibraryCatalog,
  withDebugError,
  withDebugWarning,
  withDirtyChunks,
  withFailedChunkKeys,
  withInventoryCatalog,
  withInventoryItems,
  withLifecycleStatus,
  withLoadedChunk,
  withLoadedChunks,
  withPlayerDebugState,
  withPlayerState,
  withPlayerStatePatch,
  withResetPlayerState,
  withSelectedInventorySlot,
  withTargetingState,
  withUiError,
  withUiLoading,
  withWorldConnectionStatus,
  withoutDirtyChunks,
} from "./editor_state";
import type {
  EditorPlayerStatePatch,
  PlayerStateBootstrapInput,
  PlayerStateUpdateInput,
} from "./player_state";

export type EditorActionKind =
  | "lifecycle/set-status"
  | "lifecycle/ready"
  | "lifecycle/failed"
  | "lifecycle/destroyed"
  | "viewport/update"
  | "input/pointer-lock"
  | "input/keys"
  | "input/buttons"
  | "input/pointer-delta"
  | "input/reset-deltas"
  | "camera/update"
  | "player/update"
  | "player/patch"
  | "player/reset"
  | "player/debug"
  | "world/connection"
  | "world/chunk-loaded"
  | "world/chunks-loaded"
  | "world/chunk-failed"
  | "world/dirty-chunks"
  | "world/dirty-reloaded"
  | "world/full-refresh"
  | "inventory/loading"
  | "inventory/loaded"
  | "inventory/editor-payload-loaded"
  | "inventory/editor-state-loaded"
  | "inventory/editor-load-result"
  | "inventory/catalog-loaded"
  | "inventory/creative-library-loaded"
  | "inventory/creative-library-catalog-loaded"
  | "inventory/failed"
  | "inventory/select-slot"
  | "inventory/select-runtime-block-type"
  | "inventory/select-library-item"
  | "inventory/select-family"
  | "inventory/select-vplib"
  | "targeting/update"
  | "targeting/clear"
  | "tools/set-active"
  | "tools/preview"
  | "command/pending"
  | "command/result"
  | "command/failed"
  | "command/clear"
  | "render/initialized"
  | "render/frame"
  | "render/chunks"
  | "render/error"
  | "ui/loading"
  | "ui/error"
  | "ui/clear-error"
  | "ui/source-status"
  | "ui/live-message"
  | "ui/crosshair"
  | "ui/hotbar"
  | "debug/action"
  | "debug/warning"
  | "debug/error";

export interface EditorActionBase {
  readonly kind: EditorActionKind;
  readonly createdAt?: string;
  readonly source?: string;
}

export interface SetLifecycleStatusAction extends EditorActionBase {
  readonly kind: "lifecycle/set-status";
  readonly status: EditorLifecycleStatus;
  readonly reason?: string | null;
  readonly bootAttemptCount?: number;
}

export interface SetLifecycleReadyAction extends EditorActionBase {
  readonly kind: "lifecycle/ready";
}

export interface SetLifecycleFailedAction extends EditorActionBase {
  readonly kind: "lifecycle/failed";
  readonly error: unknown;
  readonly reason?: string | null;
}

export interface SetLifecycleDestroyedAction extends EditorActionBase {
  readonly kind: "lifecycle/destroyed";
  readonly reason?: string | null;
}

export interface UpdateViewportAction extends EditorActionBase {
  readonly kind: "viewport/update";
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio?: number;
  readonly isVisible?: boolean;
  readonly hasCanvas?: boolean;
}

export interface SetPointerLockAction extends EditorActionBase {
  readonly kind: "input/pointer-lock";
  readonly pointerLocked: boolean;
  readonly pointerLockAvailable?: boolean;
}

export interface SetPressedKeysAction extends EditorActionBase {
  readonly kind: "input/keys";
  readonly pressedKeys: readonly string[];
}

export interface SetPressedButtonsAction extends EditorActionBase {
  readonly kind: "input/buttons";
  readonly pressedButtons: readonly EditorPointerButton[];
  readonly lastPointerButton?: EditorPointerButton | null;
  readonly phase?: "down" | "up" | "move";
}

export interface SetPointerDeltaAction extends EditorActionBase {
  readonly kind: "input/pointer-delta";
  readonly mouseDeltaX: number;
  readonly mouseDeltaY: number;
  readonly wheelDelta?: number;
}

export interface ResetInputDeltasAction extends EditorActionBase {
  readonly kind: "input/reset-deltas";
}

export interface UpdateCameraAction extends EditorActionBase {
  readonly kind: "camera/update";
  readonly position?: Partial<EditorStateVector3>;
  readonly rotation?: Partial<EditorStateEuler3>;
  readonly isSprinting?: boolean;
}

export interface UpdatePlayerStateAction extends EditorActionBase {
  readonly kind: "player/update";
  readonly input: PlayerStateUpdateInput;
}

export interface PatchPlayerStateAction extends EditorActionBase {
  readonly kind: "player/patch";
  readonly patch: EditorPlayerStatePatch;
}

export interface ResetPlayerStateAction extends EditorActionBase {
  readonly kind: "player/reset";
  readonly input?: PlayerStateBootstrapInput | null;
}

export interface PlayerDebugAction extends EditorActionBase {
  readonly kind: "player/debug";
  readonly enabled?: boolean;
}

export interface SetWorldConnectionAction extends EditorActionBase {
  readonly kind: "world/connection";
  readonly status: EditorConnectionStatus;
  readonly error?: ChunkApiErrorDetails | null;
}

export interface ChunkLoadedAction extends EditorActionBase {
  readonly kind: "world/chunk-loaded";
  readonly chunk: ChunkApiRuntimeChunkContent | EditorChunkSummaryInput;
}

export interface ChunksLoadedAction extends EditorActionBase {
  readonly kind: "world/chunks-loaded";
  readonly chunks: readonly (ChunkApiRuntimeChunkContent | EditorChunkSummaryInput)[];
}

export interface ChunkFailedAction extends EditorActionBase {
  readonly kind: "world/chunk-failed";
  readonly chunkKey: string;
  readonly error?: ChunkApiErrorDetails | null;
}

export interface DirtyChunksAction extends EditorActionBase {
  readonly kind: "world/dirty-chunks";
  readonly dirtyChunkKeys: readonly string[];
}

export interface DirtyReloadedAction extends EditorActionBase {
  readonly kind: "world/dirty-reloaded";
  readonly reloadedChunkKeys?: readonly string[];
}

export interface FullRefreshAction extends EditorActionBase {
  readonly kind: "world/full-refresh";
  readonly loadedChunkKeys?: readonly string[];
}

export interface InventoryLoadingAction extends EditorActionBase {
  readonly kind: "inventory/loading";
}

export interface InventoryLoadedAction extends EditorActionBase {
  /**
   * Legacy-only.
   *
   * Chunk-Block-Resultate dürfen nicht mehr automatisch Hotbar-Wahrheit sein.
   * Productive Hotbar-Inventory muss über /editor/api/inventory kommen.
   */
  readonly kind: "inventory/loaded";
  readonly result: ChunkApiBlocksResult;
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
  readonly inventorySource?: EditorInventorySource;
  readonly allowChunkInventory?: boolean;
}

export interface EditorInventoryPayloadLoadedAction extends EditorActionBase {
  readonly kind: "inventory/editor-payload-loaded";
  readonly payload: EditorInventoryPayload;
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
}

export interface EditorInventoryStateLoadedAction extends EditorActionBase {
  readonly kind: "inventory/editor-state-loaded";
  readonly inventory: ApiEditorInventoryState;
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
}

export interface EditorInventoryLoadResultAction extends EditorActionBase {
  readonly kind: "inventory/editor-load-result";
  readonly result: EditorInventoryLoadResult;
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
}

export interface InventoryCatalogLoadedAction extends EditorActionBase {
  readonly kind: "inventory/catalog-loaded";
  readonly catalog: InventoryCatalog;
  readonly error?: ChunkApiErrorDetails | null;
}

export interface CreativeLibraryLoadedAction extends EditorActionBase {
  /**
   * Legacy-only diagnostic creative-library loading from chunk block catalogs.
   */
  readonly kind: "inventory/creative-library-loaded";
  readonly result: ChunkApiBlocksResult;
  readonly librarySource?: EditorInventorySource;
}

export interface CreativeLibraryCatalogLoadedAction extends EditorActionBase {
  readonly kind: "inventory/creative-library-catalog-loaded";
  readonly catalog: InventoryCatalog;
  readonly error?: ChunkApiErrorDetails | null;
}

export interface InventoryFailedAction extends EditorActionBase {
  readonly kind: "inventory/failed";
  readonly error: unknown;
}

export interface SelectInventorySlotAction extends EditorActionBase {
  readonly kind: "inventory/select-slot";
  readonly slot: number;
}

export interface SelectRuntimeBlockTypeAction extends EditorActionBase {
  readonly kind: "inventory/select-runtime-block-type";
  readonly runtimeBlockTypeId: string;
}

export interface SelectLibraryItemAction extends EditorActionBase {
  readonly kind: "inventory/select-library-item";
  readonly libraryItemId: string;
}

export interface SelectFamilyAction extends EditorActionBase {
  readonly kind: "inventory/select-family";
  readonly familyId: string;
}

export interface SelectVplibAction extends EditorActionBase {
  readonly kind: "inventory/select-vplib";
  readonly vplibUid: string;
}

export interface UpdateTargetingAction extends EditorActionBase {
  readonly kind: "targeting/update";
  readonly targetKind: EditorTargetKind;
  readonly status: EditorTargetStatus;
  readonly reason?: string | null;
  readonly distance?: number | null;
  readonly chunkKey?: string | null;
  readonly sourceCell?: EditorStateChunkCellPosition | null;
  readonly placementCell?: EditorStateChunkCellPosition | null;
  readonly normal?: EditorStateVector3 | null;
}

export interface ClearTargetingAction extends EditorActionBase {
  readonly kind: "targeting/clear";
  readonly reason?: string | null;
}

export interface SetActiveToolAction extends EditorActionBase {
  readonly kind: "tools/set-active";
  readonly toolId: EditorToolId;
}

export interface SetToolPreviewAction extends EditorActionBase {
  readonly kind: "tools/preview";
  readonly visible: boolean;
  readonly blockTypeId?: string | null;
}

export interface CommandPendingAction extends EditorActionBase {
  readonly kind: "command/pending";
  readonly command: ChunkApiCommandPayload;
}

export interface CommandResultAction extends EditorActionBase {
  readonly kind: "command/result";
  readonly result: ChunkApiCommandResult;
}

export interface CommandFailedAction extends EditorActionBase {
  readonly kind: "command/failed";
  readonly error: unknown;
}

export interface CommandClearAction extends EditorActionBase {
  readonly kind: "command/clear";
}

export interface RenderInitializedAction extends EditorActionBase {
  readonly kind: "render/initialized";
  readonly initialized: boolean;
}

export interface RenderFrameAction extends EditorActionBase {
  readonly kind: "render/frame";
  readonly frameMs?: number | null;
  readonly meshCount?: number;
  readonly drawCallCount?: number;
}

export interface RenderChunksAction extends EditorActionBase {
  readonly kind: "render/chunks";
  readonly renderedChunkKeys: readonly string[];
  readonly meshCount?: number;
  readonly drawCallCount?: number;
}

export interface RenderErrorAction extends EditorActionBase {
  readonly kind: "render/error";
  readonly error: unknown;
}

export interface UiLoadingAction extends EditorActionBase {
  readonly kind: "ui/loading";
  readonly loading: boolean;
  readonly message?: string | null;
}

export interface UiErrorAction extends EditorActionBase {
  readonly kind: "ui/error";
  readonly title?: string | null;
  readonly message: string;
  readonly error?: unknown;
}

export interface UiClearErrorAction extends EditorActionBase {
  readonly kind: "ui/clear-error";
}

export interface UiSourceStatusAction extends EditorActionBase {
  readonly kind: "ui/source-status";
  readonly label: string;
}

export interface UiLiveMessageAction extends EditorActionBase {
  readonly kind: "ui/live-message";
  readonly message: string | null;
}

export interface UiCrosshairAction extends EditorActionBase {
  readonly kind: "ui/crosshair";
  readonly visible: boolean;
}

export interface UiHotbarAction extends EditorActionBase {
  readonly kind: "ui/hotbar";
  readonly visible: boolean;
}

export interface DebugActionAction extends EditorActionBase {
  readonly kind: "debug/action";
  readonly action: string;
}

export interface DebugWarningAction extends EditorActionBase {
  readonly kind: "debug/warning";
  readonly warning: string;
}

export interface DebugErrorAction extends EditorActionBase {
  readonly kind: "debug/error";
  readonly error: unknown;
}

export type EditorAction =
  | SetLifecycleStatusAction
  | SetLifecycleReadyAction
  | SetLifecycleFailedAction
  | SetLifecycleDestroyedAction
  | UpdateViewportAction
  | SetPointerLockAction
  | SetPressedKeysAction
  | SetPressedButtonsAction
  | SetPointerDeltaAction
  | ResetInputDeltasAction
  | UpdateCameraAction
  | UpdatePlayerStateAction
  | PatchPlayerStateAction
  | ResetPlayerStateAction
  | PlayerDebugAction
  | SetWorldConnectionAction
  | ChunkLoadedAction
  | ChunksLoadedAction
  | ChunkFailedAction
  | DirtyChunksAction
  | DirtyReloadedAction
  | FullRefreshAction
  | InventoryLoadingAction
  | InventoryLoadedAction
  | EditorInventoryPayloadLoadedAction
  | EditorInventoryStateLoadedAction
  | EditorInventoryLoadResultAction
  | InventoryCatalogLoadedAction
  | CreativeLibraryLoadedAction
  | CreativeLibraryCatalogLoadedAction
  | InventoryFailedAction
  | SelectInventorySlotAction
  | SelectRuntimeBlockTypeAction
  | SelectLibraryItemAction
  | SelectFamilyAction
  | SelectVplibAction
  | UpdateTargetingAction
  | ClearTargetingAction
  | SetActiveToolAction
  | SetToolPreviewAction
  | CommandPendingAction
  | CommandResultAction
  | CommandFailedAction
  | CommandClearAction
  | RenderInitializedAction
  | RenderFrameAction
  | RenderChunksAction
  | RenderErrorAction
  | UiLoadingAction
  | UiErrorAction
  | UiClearErrorAction
  | UiSourceStatusAction
  | UiLiveMessageAction
  | UiCrosshairAction
  | UiHotbarAction
  | DebugActionAction
  | DebugWarningAction
  | DebugErrorAction;

const PRODUCTIVE_INVENTORY_ROUTE = "/editor/api/inventory" as const;

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function safeString(value: unknown, fallback: string): string {
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

function safeNumber(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, numeric));
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
    return Math.trunc(safeNumber(value, fallback, min, max));
  } catch {
    return fallback;
  }
}

function uniqueStringList(values: readonly unknown[]): readonly string[] {
  try {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const normalized = safeString(value, "");

      if (normalized.length === 0 || seen.has(normalized) || isForbiddenRuntimeBlockTypeId(normalized)) {
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

function isFailedResult(value: unknown): value is ChunkApiFailedResult {
  try {
    return Boolean(value)
      && typeof value === "object"
      && (value as { ok?: unknown }).ok === false
      && "error" in value;
  } catch {
    return false;
  }
}

function normalizeError(error: unknown, fallbackMessage = "Editor action failed."): ChunkApiErrorDetails {
  try {
    if (isFailedResult(error)) {
      return error.error;
    }

    const normalized = chunkApiErrorToDetails(error);

    if (normalized.message && normalized.message.trim().length > 0) {
      return normalized;
    }

    return createEditorStateError({
      message: fallbackMessage,
      retryable: true,
    });
  } catch {
    return createEditorStateError({
      message: fallbackMessage,
      retryable: true,
    });
  }
}

function setLastDebugAction(state: EditorState, action: string, at = nowIsoStringSafe()): EditorState {
  return {
    ...state,
    debug: {
      ...state.debug,
      lastAction: safeString(action, state.debug.lastAction ?? "unknown"),
      lastActionAt: at,
    },
  };
}

function normalizePointerButton(value: unknown): EditorPointerButton {
  const normalized = safeString(value, "unknown");

  if (
    normalized === "primary"
    || normalized === "secondary"
    || normalized === "middle"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return "unknown";
}

function normalizePointerButtons(values: readonly EditorPointerButton[]): readonly EditorPointerButton[] {
  try {
    const result: EditorPointerButton[] = [];

    for (const value of values) {
      const normalized = normalizePointerButton(value);

      if (normalized !== "unknown" && !result.includes(normalized)) {
        result.push(normalized);
      }
    }

    return result;
  } catch {
    return [];
  }
}

function updateInputTimeForPhase(
  input: EditorState["input"],
  phase: SetPressedButtonsAction["phase"],
  at: string,
): EditorState["input"] {
  switch (phase) {
    case "down":
      return {
        ...input,
        lastPointerDownAt: at,
      };

    case "up":
      return {
        ...input,
        lastPointerUpAt: at,
      };

    case "move":
      return {
        ...input,
        lastPointerMoveAt: at,
      };

    default:
      return input;
  }
}

function sourceStatusLabelFromConnection(status: EditorConnectionStatus): string {
  switch (status) {
    case "connecting":
      return "Chunk-Service wird verbunden";
    case "ready":
      return "Chunk-Service verbunden";
    case "degraded":
      return "Chunk-Service eingeschränkt";
    case "failed":
      return "Chunk-Service fehlgeschlagen";
    case "offline":
      return "Chunk-Service offline";
    case "unknown":
    default:
      return "Chunk-Service unbekannt";
  }
}

function inventorySourceFromBlocksResult(result: ChunkApiBlocksResult): EditorInventorySource {
  try {
    if (result.usedPaletteFallback) {
      return "chunk-palette";
    }

    switch (result.sourceKind) {
      case "chunk-service-blocks-route":
      case "chunk-service-placeable-blocks-route":
      case "chunk-service-creative-library-route":
        return "chunk-service";

      case "editor-placeholder-route":
        return "editor-placeholder";

      case "static-client-fallback":
        return "static-fallback";

      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

function containsForbiddenDebugBlockTypeId(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.some((id) => serialized.includes(id));
  } catch {
    return false;
  }
}

function isForbiddenRuntimeBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "");
  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

function catalogFromEditorInventoryPayload(
  payload: EditorInventoryPayload,
  action: EditorInventoryPayloadLoadedAction,
  state: EditorState,
): InventoryCatalog {
  const selectedSlot = safeInteger(
    action.selectedSlotIndex
      ?? action.selectedSlot
      ?? state.inventory.selectedSlotIndex
      ?? payload.inventory?.selectedSlot
      ?? payload.inventory?.defaultSelectedSlot,
    state.inventory.selectedSlotIndex,
    0,
    Math.max(0, state.inventory.slotCount - 1),
  );

  const factory = createInventorySlotFactoryResultFromEditorInventoryPayload(payload, {
    slotCount: state.inventory.slotCount,
    selectedSlot,
    selectedSlotIndex: selectedSlot,
  });

  return factory.catalog;
}

function catalogFromEditorInventoryState(
  inventory: ApiEditorInventoryState,
  action: EditorInventoryStateLoadedAction,
  state: EditorState,
): InventoryCatalog {
  const selectedSlot = safeInteger(
    action.selectedSlotIndex
      ?? action.selectedSlot
      ?? state.inventory.selectedSlotIndex
      ?? inventory.selectedSlot
      ?? inventory.defaultSelectedSlot,
    state.inventory.selectedSlotIndex,
    0,
    Math.max(0, state.inventory.slotCount - 1),
  );

  const factory = createInventorySlotFactoryResultFromEditorInventoryState(inventory, {
    slotCount: state.inventory.slotCount,
    selectedSlot,
    selectedSlotIndex: selectedSlot,
  });

  return factory.catalog;
}

function catalogFromEditorInventoryLoadResult(
  result: EditorInventoryLoadResult,
  action: EditorInventoryLoadResultAction,
  state: EditorState,
): InventoryCatalog {
  const selectedSlot = safeInteger(
    action.selectedSlotIndex ?? action.selectedSlot ?? state.inventory.selectedSlotIndex,
    state.inventory.selectedSlotIndex,
    0,
    Math.max(0, state.inventory.slotCount - 1),
  );

  const factory = createInventorySlotFactoryResultFromEditorInventoryLoadResult(result, {
    slotCount: state.inventory.slotCount,
    selectedSlot,
    selectedSlotIndex: selectedSlot,
  });

  return factory.catalog;
}

function applyInventoryCatalogLoaded(
  state: EditorState,
  catalog: InventoryCatalog,
  error: ChunkApiErrorDetails | null,
): EditorState {
  if (containsForbiddenDebugBlockTypeId(catalog)) {
    const blockedError = createEditorStateError({
      code: "inventory_forbidden_debug_blocks",
      message: "Inventory-Catalog enthält verbotene Debug-Block-IDs.",
      retryable: false,
      details: {
        forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
        productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      },
    });

    return withDebugError(
      {
        ...state,
        inventory: {
          ...state.inventory,
          status: "failed",
          lastError: blockedError,
          onlyLibraryItemsPlaceable: true,
          debugGrassDirtAllowed: false,
        },
      },
      blockedError,
    );
  }

  return withInventoryCatalog(state, catalog, {
    error,
  });
}

/**
 * Legacy-Pfad.
 *
 * Chunk-Blocks dürfen nicht mehr automatisch Hotbar-Wahrheit sein. Diese Action
 * bleibt für alte Integrationen bestehen, lädt aber standardmäßig nur noch die
 * Creative-Library-Diagnose aus Blocks und lässt die produktive Hotbar unberührt.
 */
function applyLoadedInventory(
  state: EditorState,
  action: InventoryLoadedAction,
): EditorState {
  const slotCount = state.inventory.slotCount;
  const creativeBlocks = action.result.blocks.length > 0
    ? action.result.blocks
    : action.result.placeableBlocks;

  const source = action.inventorySource ?? inventorySourceFromBlocksResult(action.result);

  const creativeState = withCreativeLibraryBlocks(state, creativeBlocks, {
    source,
    error: null,
  });

  if (action.allowChunkInventory !== true) {
    const warningState = withDebugWarning(
      creativeState,
      `Chunk-Block-Inventar wurde als Hotbar-Wahrheit ignoriert. Verwende ${PRODUCTIVE_INVENTORY_ROUTE}.`,
    );

    return {
      ...warningState,
      inventory: {
        ...warningState.inventory,
        status: warningState.inventory.items.length > 0 ? warningState.inventory.status : "degraded",
        source: warningState.inventory.source === "unknown" ? "library" : warningState.inventory.source,
        lastLoadedAt: nowIsoStringSafe(),
        usedPaletteFallback: false,
        onlyLibraryItemsPlaceable: true,
        debugGrassDirtAllowed: false,
      },
      ui: {
        ...warningState.ui,
        sourceStatusLabel: `Library-Inventar erwartet ${PRODUCTIVE_INVENTORY_ROUTE}`,
      },
    };
  }

  const inventoryBlocks = action.result.placeableBlocks.length > 0
    ? action.result.placeableBlocks
    : action.result.blocks;

  const items = createEditorInventoryItemsFromBlocks(
    inventoryBlocks.filter((block) => !isForbiddenRuntimeBlockTypeId(block.blockTypeId)),
    slotCount,
  );

  const selectedSlot = safeInteger(
    action.selectedSlotIndex ?? action.selectedSlot,
    state.inventory.selectedSlotIndex ?? state.inventory.selectedSlot,
    0,
    Math.max(0, slotCount - 1),
  );

  return withDebugWarning(
    withInventoryItems(creativeState, items, {
      selectedSlot,
      selectedSlotIndex: selectedSlot,
      source,
      usedPaletteFallback: action.result.usedPaletteFallback,
      error: null,
    }),
    "Legacy Chunk-Inventory wurde ausdrücklich erlaubt. Dieser Pfad ist nur Diagnose/Kompatibilität.",
  );
}

function applyFailedChunk(
  state: EditorState,
  action: ChunkFailedAction,
): EditorState {
  const chunkKey = safeString(action.chunkKey, "");

  if (chunkKey.length === 0) {
    return state;
  }

  return withFailedChunkKeys(
    {
      ...state,
      world: {
        ...state.world,
        connection: {
          ...state.world.connection,
          lastError: action.error ?? state.world.connection.lastError,
        },
      },
    },
    [chunkKey],
  );
}

function applyRenderFrame(
  state: EditorState,
  action: RenderFrameAction,
  at: string,
): EditorState {
  const frameMs = action.frameMs ?? null;
  const previousAverage = state.render.averageFrameMs;
  const averageFrameMs = frameMs === null
    ? previousAverage
    : previousAverage === null
      ? frameMs
      : (previousAverage * 0.9) + (frameMs * 0.1);

  return {
    ...state,
    render: {
      ...state.render,
      frameCount: state.render.frameCount + 1,
      lastFrameAt: at,
      averageFrameMs,
      meshCount: action.meshCount ?? state.render.meshCount,
      drawCallCount: action.drawCallCount ?? state.render.drawCallCount,
    },
  };
}

function applyPlayerUpdate(
  state: EditorState,
  action: UpdatePlayerStateAction,
  at: string,
): EditorState {
  try {
    return setLastDebugAction(
      withPlayerState(state, {
        ...action.input,
        source: action.input.source ?? "physics-runtime",
        nowMs: action.input.nowMs ?? Date.parse(at),
      }),
      action.source ?? action.kind,
      at,
    );
  } catch (error) {
    return withDebugError(state, error);
  }
}

function applyPlayerPatch(
  state: EditorState,
  action: PatchPlayerStateAction,
  at: string,
): EditorState {
  try {
    return setLastDebugAction(
      withPlayerStatePatch(state, {
        ...action.patch,
        source: action.patch.source ?? "store-patch",
        lastUpdatedAtMs: action.patch.lastUpdatedAtMs ?? Date.parse(at),
      }),
      action.source ?? action.kind,
      at,
    );
  } catch (error) {
    return withDebugError(state, error);
  }
}

function applyPlayerReset(
  state: EditorState,
  action: ResetPlayerStateAction,
  at: string,
): EditorState {
  try {
    return setLastDebugAction(
      withResetPlayerState(state, {
        ...(action.input ?? {}),
        source: action.input?.source ?? "reset",
        nowMs: action.input?.nowMs ?? Date.parse(at),
      }),
      action.source ?? action.kind,
      at,
    );
  } catch (error) {
    return withDebugError(state, error);
  }
}

function selectInventoryByRuntimeBlockType(
  state: EditorState,
  runtimeBlockTypeId: string,
): EditorState {
  if (!runtimeBlockTypeId || isForbiddenRuntimeBlockTypeId(runtimeBlockTypeId)) {
    return state;
  }

  const item = state.inventory.items.find((candidate) => {
    return candidate.runtimeBlockTypeId === runtimeBlockTypeId || candidate.blockTypeId === runtimeBlockTypeId;
  });

  if (!item) {
    return state;
  }

  return withSelectedInventorySlot(state, item.slot);
}

function selectInventoryByLibraryField(
  state: EditorState,
  field: "libraryItemId" | "familyId" | "vplibUid",
  value: string,
): EditorState {
  const normalized = safeString(value, "");

  if (!normalized) {
    return state;
  }

  const item = state.inventory.items.find((candidate) => candidate[field] === normalized);

  if (!item) {
    return state;
  }

  return withSelectedInventorySlot(state, item.slot);
}

function applyActionUnsafe(state: EditorState, action: EditorAction): EditorState {
  const at = action.createdAt ?? nowIsoStringSafe();

  switch (action.kind) {
    case "lifecycle/set-status":
      return setLastDebugAction(
        withLifecycleStatus(state, action.status, action.reason ?? null, action.bootAttemptCount),
        action.source ?? action.kind,
        at,
      );

    case "lifecycle/ready":
      return setLastDebugAction(
        withLifecycleStatus(
          {
            ...state,
            ui: {
              ...state.ui,
              loading: false,
              loadingMessage: null,
              errorVisible: false,
              errorTitle: null,
              errorMessage: null,
              liveMessage: "VECTOPLAN Editor ist bereit.",
            },
          },
          "ready",
          "runtime-ready",
        ),
        action.source ?? action.kind,
        at,
      );

    case "lifecycle/failed": {
      const error = normalizeError(action.error, "Editor lifecycle failed.");

      return setLastDebugAction(
        withDebugError(
          withLifecycleStatus(
            {
              ...state,
              ui: {
                ...state.ui,
                loading: false,
                errorVisible: true,
                errorTitle: "Editor konnte nicht gestartet werden",
                errorMessage: error.message,
                liveMessage: "Editor konnte nicht gestartet werden.",
              },
            },
            "failed",
            action.reason ?? error.message,
          ),
          error,
        ),
        action.source ?? action.kind,
        at,
      );
    }

    case "lifecycle/destroyed":
      return setLastDebugAction(
        withLifecycleStatus(state, "destroyed", action.reason ?? "destroyed"),
        action.source ?? action.kind,
        at,
      );

    case "viewport/update": {
      const width = safeInteger(action.width, state.viewport.width, 0, 100_000);
      const height = safeInteger(action.height, state.viewport.height, 0, 100_000);
      const devicePixelRatio = safeNumber(action.devicePixelRatio, state.viewport.devicePixelRatio, 0.25, 8);
      const aspect = height > 0 ? width / height : state.viewport.aspect;

      return {
        ...state,
        viewport: {
          ...state.viewport,
          width,
          height,
          devicePixelRatio,
          aspect,
          isVisible: action.isVisible ?? state.viewport.isVisible,
          hasCanvas: action.hasCanvas ?? state.viewport.hasCanvas,
          resizedAt: at,
        },
      };
    }

    case "input/pointer-lock":
      return {
        ...state,
        input: {
          ...state.input,
          pointerLocked: action.pointerLocked,
          pointerLockAvailable: action.pointerLockAvailable ?? state.input.pointerLockAvailable,
          pressedButtons: action.pointerLocked ? [] : state.input.pressedButtons,
        },
      };

    case "input/keys":
      return {
        ...state,
        input: {
          ...state.input,
          pressedKeys: uniqueStringList(action.pressedKeys),
        },
      };

    case "input/buttons":
      return {
        ...state,
        input: updateInputTimeForPhase(
          {
            ...state.input,
            pressedButtons: normalizePointerButtons(action.pressedButtons),
            lastPointerButton: action.lastPointerButton ?? state.input.lastPointerButton,
          },
          action.phase,
          at,
        ),
      };

    case "input/pointer-delta":
      return {
        ...state,
        input: {
          ...state.input,
          mouseDeltaX: safeNumber(action.mouseDeltaX, 0),
          mouseDeltaY: safeNumber(action.mouseDeltaY, 0),
          wheelDelta: safeNumber(action.wheelDelta, state.input.wheelDelta),
          lastPointerMoveAt: at,
          lastWheelAt: action.wheelDelta === undefined ? state.input.lastWheelAt : at,
        },
      };

    case "input/reset-deltas":
      return {
        ...state,
        input: {
          ...state.input,
          mouseDeltaX: 0,
          mouseDeltaY: 0,
          wheelDelta: 0,
        },
      };

    case "camera/update":
      return {
        ...state,
        camera: {
          ...state.camera,
          position: {
            x: safeNumber(action.position?.x, state.camera.position.x),
            y: safeNumber(action.position?.y, state.camera.position.y),
            z: safeNumber(action.position?.z, state.camera.position.z),
          },
          rotation: {
            pitch: safeNumber(action.rotation?.pitch, state.camera.rotation.pitch),
            yaw: safeNumber(action.rotation?.yaw, state.camera.rotation.yaw),
            roll: safeNumber(action.rotation?.roll, state.camera.rotation.roll),
          },
          isSprinting: action.isSprinting ?? state.camera.isSprinting,
          updatedAt: at,
        },
      };

    case "player/update":
      return applyPlayerUpdate(state, action, at);

    case "player/patch":
      return applyPlayerPatch(state, action, at);

    case "player/reset":
      return applyPlayerReset(state, action, at);

    case "player/debug":
      return setLastDebugAction(
        withPlayerDebugState(state, {
          enabled: action.enabled ?? state.debug.enabled,
        }),
        action.source ?? action.kind,
        at,
      );

    case "world/connection": {
      const next = withWorldConnectionStatus(state, action.status, action.error ?? null);

      return setLastDebugAction(
        {
          ...next,
          ui: {
            ...next.ui,
            sourceStatusLabel: sourceStatusLabelFromConnection(action.status),
          },
        },
        action.source ?? action.kind,
        at,
      );
    }

    case "world/chunk-loaded":
      return setLastDebugAction(
        withLoadedChunk(
          withWorldConnectionStatus(state, "ready", null),
          action.chunk,
        ),
        action.source ?? action.kind,
        at,
      );

    case "world/chunks-loaded":
      return setLastDebugAction(
        withLoadedChunks(withWorldConnectionStatus(state, "ready", null), action.chunks),
        action.source ?? action.kind,
        at,
      );

    case "world/chunk-failed":
      return setLastDebugAction(applyFailedChunk(state, action), action.source ?? action.kind, at);

    case "world/dirty-chunks":
      return setLastDebugAction(withDirtyChunks(state, action.dirtyChunkKeys), action.source ?? action.kind, at);

    case "world/dirty-reloaded":
      return setLastDebugAction(
        withoutDirtyChunks(state, action.reloadedChunkKeys ?? []),
        action.source ?? action.kind,
        at,
      );

    case "world/full-refresh":
      return setLastDebugAction(
        {
          ...state,
          world: {
            ...state.world,
            visibleChunkKeys: uniqueStringList(action.loadedChunkKeys ?? state.world.visibleChunkKeys),
            lastFullRefreshAt: at,
          },
        },
        action.source ?? action.kind,
        at,
      );

    case "inventory/loading":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          status: "connecting",
          lastError: null,
          onlyLibraryItemsPlaceable: true,
          debugGrassDirtAllowed: false,
        },
        creativeLibrary: {
          ...state.creativeLibrary,
          status: state.creativeLibrary.items.length > 0 ? state.creativeLibrary.status : "connecting",
          lastError: null,
        },
        ui: {
          ...state.ui,
          sourceStatusLabel: "Library-/VPLIB-Inventar wird geladen",
          loading: true,
          loadingMessage: `Library-/VPLIB-Inventar wird über ${PRODUCTIVE_INVENTORY_ROUTE} geladen.`,
        },
      };

    case "inventory/loaded":
      return setLastDebugAction(applyLoadedInventory(state, action), action.source ?? action.kind, at);

    case "inventory/editor-payload-loaded": {
      const catalog = catalogFromEditorInventoryPayload(action.payload, action, state);
      return setLastDebugAction(applyInventoryCatalogLoaded(state, catalog, null), action.source ?? action.kind, at);
    }

    case "inventory/editor-state-loaded": {
      const catalog = catalogFromEditorInventoryState(action.inventory, action, state);
      return setLastDebugAction(applyInventoryCatalogLoaded(state, catalog, null), action.source ?? action.kind, at);
    }

    case "inventory/editor-load-result": {
      if (!action.result.ok) {
        const error = normalizeError(action.result.error, action.result.reason || "Editor inventory load failed.");

        return setLastDebugAction(
          applyInventoryCatalogLoaded(
            state,
            createInventoryCatalogFromLibraryInventory({
              state: action.result.state,
              slotCount: state.inventory.slotCount,
              selectedSlot: action.selectedSlotIndex ?? action.selectedSlot ?? state.inventory.selectedSlotIndex,
              reason: action.result.reason,
            }),
            error,
          ),
          action.source ?? action.kind,
          at,
        );
      }

      const catalog = catalogFromEditorInventoryLoadResult(action.result, action, state);
      return setLastDebugAction(applyInventoryCatalogLoaded(state, catalog, null), action.source ?? action.kind, at);
    }

    case "inventory/catalog-loaded":
      return setLastDebugAction(
        applyInventoryCatalogLoaded(state, action.catalog, action.error ?? null),
        action.source ?? action.kind,
        at,
      );

    case "inventory/creative-library-loaded": {
      const source = action.librarySource ?? inventorySourceFromBlocksResult(action.result);
      const blocks = action.result.blocks.length > 0
        ? action.result.blocks
        : action.result.placeableBlocks;

      return setLastDebugAction(
        withCreativeLibraryBlocks(state, blocks, {
          source,
          error: null,
        }),
        action.source ?? action.kind,
        at,
      );
    }

    case "inventory/creative-library-catalog-loaded":
      return setLastDebugAction(
        withCreativeLibraryCatalog(state, action.catalog, {
          error: action.error ?? null,
        }),
        action.source ?? action.kind,
        at,
      );

    case "inventory/failed": {
      const error = normalizeError(action.error, "Inventory loading failed.");

      return setLastDebugAction(
        withDebugError(
          {
            ...state,
            inventory: {
              ...state.inventory,
              status: state.inventory.items.length > 0 ? "degraded" : "failed",
              lastError: error,
              onlyLibraryItemsPlaceable: true,
              debugGrassDirtAllowed: false,
            },
            creativeLibrary: {
              ...state.creativeLibrary,
              status: state.creativeLibrary.items.length > 0 ? "degraded" : "failed",
              lastError: error,
            },
            ui: {
              ...state.ui,
              sourceStatusLabel: "Library-/VPLIB-Inventar fehlgeschlagen",
            },
          },
          error,
        ),
        action.source ?? action.kind,
        at,
      );
    }

    case "inventory/select-slot":
      return setLastDebugAction(withSelectedInventorySlot(state, action.slot), action.source ?? action.kind, at);

    case "inventory/select-runtime-block-type":
      return setLastDebugAction(
        selectInventoryByRuntimeBlockType(state, action.runtimeBlockTypeId),
        action.source ?? action.kind,
        at,
      );

    case "inventory/select-library-item":
      return setLastDebugAction(
        selectInventoryByLibraryField(state, "libraryItemId", action.libraryItemId),
        action.source ?? action.kind,
        at,
      );

    case "inventory/select-family":
      return setLastDebugAction(
        selectInventoryByLibraryField(state, "familyId", action.familyId),
        action.source ?? action.kind,
        at,
      );

    case "inventory/select-vplib":
      return setLastDebugAction(
        selectInventoryByLibraryField(state, "vplibUid", action.vplibUid),
        action.source ?? action.kind,
        at,
      );

    case "targeting/update":
      return withTargetingState(state, {
        kind: action.targetKind,
        status: action.status,
        reason: action.reason ?? null,
        distance: action.distance ?? null,
        chunkKey: action.chunkKey ?? action.sourceCell?.chunkKey ?? action.placementCell?.chunkKey ?? null,
        sourceCell: action.sourceCell ?? null,
        placementCell: action.placementCell ?? null,
        normal: action.normal ?? null,
        updatedAt: at,
      });

    case "targeting/clear":
      return withClearedTargetingState(state, action.reason ?? null);

    case "tools/set-active":
      return {
        ...state,
        tools: {
          ...state.tools,
          previousToolId: state.tools.activeToolId,
          activeToolId: state.tools.enabledToolIds.includes(action.toolId) ? action.toolId : state.tools.activeToolId,
          updatedAt: at,
        },
      };

    case "tools/preview": {
      const blockTypeId = action.blockTypeId && !isForbiddenRuntimeBlockTypeId(action.blockTypeId)
        ? action.blockTypeId
        : null;

      return {
        ...state,
        tools: {
          ...state.tools,
          previewVisible: action.visible,
          previewBlockTypeId: blockTypeId ?? state.tools.previewBlockTypeId,
          updatedAt: at,
        },
        render: {
          ...state.render,
          previewVisible: action.visible,
        },
      };
    }

    case "command/pending":
      return setLastDebugAction(withCommandPending(state, action.command), action.source ?? action.kind, at);

    case "command/result":
      return setLastDebugAction(withCommandResult(state, action.result), action.source ?? action.kind, at);

    case "command/failed": {
      const error = normalizeError(action.error, "Chunk command failed.");
      return setLastDebugAction(withCommandError(state, error), action.source ?? action.kind, at);
    }

    case "command/clear":
      return {
        ...state,
        command: {
          ...state.command,
          status: "idle",
          pendingCommand: null,
          lastError: null,
          submittedAt: null,
          completedAt: null,
        },
      };

    case "render/initialized":
      return {
        ...state,
        render: {
          ...state.render,
          initialized: action.initialized,
        },
      };

    case "render/frame":
      return applyRenderFrame(state, action, at);

    case "render/chunks":
      return {
        ...state,
        render: {
          ...state.render,
          renderedChunkKeys: uniqueStringList(action.renderedChunkKeys),
          meshCount: action.meshCount ?? state.render.meshCount,
          drawCallCount: action.drawCallCount ?? state.render.drawCallCount,
        },
      };

    case "render/error": {
      const error = normalizeError(action.error, "Render error.");

      return withDebugError(
        {
          ...state,
          render: {
            ...state.render,
            lastError: error,
          },
        },
        error,
      );
    }

    case "ui/loading":
      return withUiLoading(state, action.loading, action.message ?? null);

    case "ui/error":
      return withUiError(
        state,
        action.title ?? "Editor-Fehler",
        action.message,
        action.error ?? createEditorStateError({
          code: "editor_ui_error",
          message: action.message,
          retryable: false,
        }),
      );

    case "ui/clear-error":
      return {
        ...state,
        ui: {
          ...state.ui,
          errorVisible: false,
          errorTitle: null,
          errorMessage: null,
        },
      };

    case "ui/source-status":
      return {
        ...state,
        ui: {
          ...state.ui,
          sourceStatusLabel: safeString(action.label, state.ui.sourceStatusLabel),
        },
      };

    case "ui/live-message":
      return {
        ...state,
        ui: {
          ...state.ui,
          liveMessage: action.message,
        },
      };

    case "ui/crosshair":
      return {
        ...state,
        ui: {
          ...state.ui,
          crosshairVisible: action.visible,
        },
      };

    case "ui/hotbar":
      return {
        ...state,
        ui: {
          ...state.ui,
          hotbarVisible: action.visible,
        },
      };

    case "debug/action":
      return setLastDebugAction(state, action.action, at);

    case "debug/warning":
      return setLastDebugAction(withDebugWarning(state, action.warning), action.source ?? action.kind, at);

    case "debug/error":
      return setLastDebugAction(withDebugError(state, normalizeError(action.error, "Debug error.")), action.source ?? action.kind, at);

    default:
      return state;
  }
}

export function applyEditorAction(state: EditorState, action: EditorAction): EditorState {
  try {
    return applyActionUnsafe(state, action);
  } catch (error) {
    const normalizedError = normalizeEditorStateError(error, `editor_action_${action.kind.replace(/[^a-zA-Z0-9]+/g, "_")}`);

    return withDebugError(
      withDebugWarning(state, `Action failed: ${action.kind}`),
      normalizedError,
    );
  }
}

export function applyEditorActions(
  state: EditorState,
  actions: readonly EditorAction[],
): EditorState {
  let nextState = state;

  try {
    for (const action of actions) {
      nextState = applyEditorAction(nextState, action);
    }

    return nextState;
  } catch (error) {
    return withDebugError(
      nextState,
      normalizeError(error, "Applying editor actions failed."),
    );
  }
}

export function lifecycleStatusAction(
  status: EditorLifecycleStatus,
  reason?: string | null,
): SetLifecycleStatusAction {
  return {
    kind: "lifecycle/set-status",
    status,
    reason: reason ?? null,
    createdAt: nowIsoStringSafe(),
  };
}

export function readyAction(): SetLifecycleReadyAction {
  return {
    kind: "lifecycle/ready",
    createdAt: nowIsoStringSafe(),
  };
}

export function failedAction(error: unknown, reason?: string | null): SetLifecycleFailedAction {
  return {
    kind: "lifecycle/failed",
    error,
    reason: reason ?? null,
    createdAt: nowIsoStringSafe(),
  };
}

export function destroyedAction(reason?: string | null): SetLifecycleDestroyedAction {
  return {
    kind: "lifecycle/destroyed",
    reason: reason ?? null,
    createdAt: nowIsoStringSafe(),
  };
}

export function worldConnectionAction(
  status: EditorConnectionStatus,
  error?: ChunkApiErrorDetails | null,
): SetWorldConnectionAction {
  return {
    kind: "world/connection",
    status,
    error: error ?? null,
    createdAt: nowIsoStringSafe(),
  };
}

export function playerUpdateAction(
  input: PlayerStateUpdateInput,
  source = "physics-runtime",
): UpdatePlayerStateAction {
  return {
    kind: "player/update",
    input,
    source,
    createdAt: nowIsoStringSafe(),
  };
}

export function playerPatchAction(
  patch: EditorPlayerStatePatch,
  source = "store-patch",
): PatchPlayerStateAction {
  return {
    kind: "player/patch",
    patch,
    source,
    createdAt: nowIsoStringSafe(),
  };
}

export function playerResetAction(
  input?: PlayerStateBootstrapInput | null,
  source = "reset",
): ResetPlayerStateAction {
  return {
    kind: "player/reset",
    input: input ?? null,
    source,
    createdAt: nowIsoStringSafe(),
  };
}

export function playerDebugAction(enabled?: boolean): PlayerDebugAction {
  const base: PlayerDebugAction = {
    kind: "player/debug",
    createdAt: nowIsoStringSafe(),
  };

  if (typeof enabled === "boolean") {
    return {
      ...base,
      enabled,
    };
  }

  return base;
}

export function inventoryLoadedAction(
  result: ChunkApiBlocksResult,
  selectedSlot?: number,
  options?: {
    readonly allowChunkInventory?: boolean;
    readonly inventorySource?: EditorInventorySource;
  },
): InventoryLoadedAction {
  const base: InventoryLoadedAction = {
    kind: "inventory/loaded",
    result,
    allowChunkInventory: options?.allowChunkInventory ?? false,
    createdAt: nowIsoStringSafe(),
  };

  const withSource = options?.inventorySource
    ? {
        ...base,
        inventorySource: options.inventorySource,
      }
    : base;

  if (typeof selectedSlot === "number") {
    return {
      ...withSource,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
    };
  }

  return withSource;
}

export function editorInventoryPayloadLoadedAction(
  payload: EditorInventoryPayload,
  selectedSlot?: number,
): EditorInventoryPayloadLoadedAction {
  const base: EditorInventoryPayloadLoadedAction = {
    kind: "inventory/editor-payload-loaded",
    payload,
    createdAt: nowIsoStringSafe(),
  };

  if (typeof selectedSlot === "number") {
    return {
      ...base,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
    };
  }

  return base;
}

export function editorInventoryStateLoadedAction(
  inventory: ApiEditorInventoryState,
  selectedSlot?: number,
): EditorInventoryStateLoadedAction {
  const base: EditorInventoryStateLoadedAction = {
    kind: "inventory/editor-state-loaded",
    inventory,
    createdAt: nowIsoStringSafe(),
  };

  if (typeof selectedSlot === "number") {
    return {
      ...base,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
    };
  }

  return base;
}

export function editorInventoryLoadResultAction(
  result: EditorInventoryLoadResult,
  selectedSlot?: number,
): EditorInventoryLoadResultAction {
  const base: EditorInventoryLoadResultAction = {
    kind: "inventory/editor-load-result",
    result,
    createdAt: nowIsoStringSafe(),
  };

  if (typeof selectedSlot === "number") {
    return {
      ...base,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
    };
  }

  return base;
}

export function inventoryCatalogLoadedAction(
  catalog: InventoryCatalog,
  error?: ChunkApiErrorDetails | null,
): InventoryCatalogLoadedAction {
  return {
    kind: "inventory/catalog-loaded",
    catalog,
    error: error ?? null,
    createdAt: nowIsoStringSafe(),
  };
}

export function creativeLibraryLoadedAction(
  result: ChunkApiBlocksResult,
  librarySource?: EditorInventorySource,
): CreativeLibraryLoadedAction {
  const base: CreativeLibraryLoadedAction = {
    kind: "inventory/creative-library-loaded",
    result,
    createdAt: nowIsoStringSafe(),
  };

  if (librarySource) {
    return {
      ...base,
      librarySource,
    };
  }

  return base;
}

export function creativeLibraryCatalogLoadedAction(
  catalog: InventoryCatalog,
  error?: ChunkApiErrorDetails | null,
): CreativeLibraryCatalogLoadedAction {
  return {
    kind: "inventory/creative-library-catalog-loaded",
    catalog,
    error: error ?? null,
    createdAt: nowIsoStringSafe(),
  };
}

export function inventoryFailedAction(error: unknown): InventoryFailedAction {
  return {
    kind: "inventory/failed",
    error,
    createdAt: nowIsoStringSafe(),
  };
}

export function selectInventorySlotAction(slot: number): SelectInventorySlotAction {
  return {
    kind: "inventory/select-slot",
    slot,
    createdAt: nowIsoStringSafe(),
  };
}

export function selectRuntimeBlockTypeAction(runtimeBlockTypeId: string): SelectRuntimeBlockTypeAction {
  return {
    kind: "inventory/select-runtime-block-type",
    runtimeBlockTypeId,
    createdAt: nowIsoStringSafe(),
  };
}

export function selectLibraryItemAction(libraryItemId: string): SelectLibraryItemAction {
  return {
    kind: "inventory/select-library-item",
    libraryItemId,
    createdAt: nowIsoStringSafe(),
  };
}

export function selectFamilyAction(familyId: string): SelectFamilyAction {
  return {
    kind: "inventory/select-family",
    familyId,
    createdAt: nowIsoStringSafe(),
  };
}

export function selectVplibAction(vplibUid: string): SelectVplibAction {
  return {
    kind: "inventory/select-vplib",
    vplibUid,
    createdAt: nowIsoStringSafe(),
  };
}

export function commandResultAction(result: ChunkApiCommandResult): CommandResultAction {
  return {
    kind: "command/result",
    result,
    createdAt: nowIsoStringSafe(),
  };
}

export function commandFailedAction(resultOrError: ChunkApiFailedResult | unknown): CommandFailedAction {
  return {
    kind: "command/failed",
    error: resultOrError,
    createdAt: nowIsoStringSafe(),
  };
}

export function chunkLoadedAction(chunk: ChunkApiRuntimeChunkContent | EditorChunkSummaryInput): ChunkLoadedAction {
  return {
    kind: "world/chunk-loaded",
    chunk,
    createdAt: nowIsoStringSafe(),
  };
}

export function chunksLoadedAction(
  chunks: readonly (ChunkApiRuntimeChunkContent | EditorChunkSummaryInput)[],
): ChunksLoadedAction {
  return {
    kind: "world/chunks-loaded",
    chunks,
    createdAt: nowIsoStringSafe(),
  };
}

export function dirtyChunksAction(dirtyChunkKeys: readonly string[]): DirtyChunksAction {
  return {
    kind: "world/dirty-chunks",
    dirtyChunkKeys,
    createdAt: nowIsoStringSafe(),
  };
}

export function uiLoadingAction(loading: boolean, message?: string | null): UiLoadingAction {
  return {
    kind: "ui/loading",
    loading,
    message: message ?? null,
    createdAt: nowIsoStringSafe(),
  };
}

export function uiErrorAction(title: string, message: string, error?: unknown): UiErrorAction {
  return {
    kind: "ui/error",
    title,
    message,
    error,
    createdAt: nowIsoStringSafe(),
  };
}

export function uiCrosshairAction(visible: boolean): UiCrosshairAction {
  return {
    kind: "ui/crosshair",
    visible,
    createdAt: nowIsoStringSafe(),
  };
}

export function uiHotbarAction(visible: boolean): UiHotbarAction {
  return {
    kind: "ui/hotbar",
    visible,
    createdAt: nowIsoStringSafe(),
  };
}

export function getStateActionsMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.state.state_actions",
    supportsEditorInventoryPayload: true,
    supportsEditorInventoryLoadResult: true,
    supportsLibraryCatalogInventory: true,
    supportsLegacyChunkInventory: true,
    legacyChunkInventoryRequiresExplicitAllow: true,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      primaryInventoryAction: "inventory/catalog-loaded",
      primaryInventoryApi: PRODUCTIVE_INVENTORY_ROUTE,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      chunkBlocksIgnoredAsInventoryByDefault: true,
      creativeLibraryMayUseLegacyBlockCatalogForDiagnostics: true,
    },
  };
}