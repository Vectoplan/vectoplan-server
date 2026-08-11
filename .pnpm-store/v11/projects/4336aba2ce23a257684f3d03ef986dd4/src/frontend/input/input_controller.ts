// services/vectoplan-editor/src/frontend/input/input_controller.ts
import type { ChunkApiWorldPosition } from "@api/chunk_api_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  focusEditorCanvas,
  setDomLiveMessage,
  type EditorDomRefs,
} from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import {
  normalizeUnknownError,
  safeBoolean,
  safeInteger,
  safeString,
} from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import type {
  EditorInventoryItem,
  EditorStateChunkCellPosition,
} from "@state/editor_state";
import { applyEditorAction } from "@state/state_actions";
import {
  selectActiveLibraryRef,
  selectActivePlacementCommand,
  selectActivePlacementSummary,
  selectActiveRuntimeBlockTypeId,
  selectPlacementCell,
  selectSelectedFamilyId,
  selectSelectedInventoryItem,
  selectSelectedLibraryItemId,
  selectSelectedPackageId,
  selectSelectedRevisionHash,
  selectSelectedSlotIndex,
  selectSelectedVariantId,
  selectSelectedVplibUid,
  selectSourceCell,
} from "@state/state_selectors";
import type { PlayerMovementIntent } from "../runtime/physics/physics_models";
import {
  createSpaceDoubleTapDetector,
  detectSpaceDoubleTap,
  shouldToggleFlightFromDoubleTap,
  type DoubleTapDetector,
} from "../runtime/physics/double_tap_detector";
import {
  createInputState,
  inputSnapshotToDebugSummary,
  type InputStateHandle,
  type InputStateSnapshot,
  type KeyboardActionKey,
} from "./input_state";
import {
  createKeyboardInput,
  type KeyboardInputHandle,
} from "./keyboard_input";
import {
  createMouseInput,
  type MouseInputHandle,
} from "./mouse_input";
import {
  createPointerLock,
  type PointerLockHandle,
} from "./pointer_lock";
import {
  BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  DEBUG_GRASS_DIRT_ALLOWED,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  asEditorInventoryContractRecord,
  clearEditorInventoryContractCaches,
  createEditorLibraryPlacementContext,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  isForbiddenDebugBlockTypeId,
  isValidEditorLibraryPlacementContext,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId as normalizeContractRuntimeBlockTypeId,
  type EditorLibraryPlacementContext,
} from "../contracts/editor_inventory_contract";

export type EditorInputControllerStatus =
  | "created"
  | "attached"
  | "active"
  | "disabled"
  | "failed"
  | "destroyed";

export interface EditorInputMovementIntent {
  readonly forward: number;
  readonly right: number;

  /**
   * Legacy vertical movement axis.
   *
   * New physics code should prefer:
   * - ascendHeld
   * - descendHeld
   * - jumpPressed
   * - toggleFlightRequested
   */
  readonly up: number;

  readonly sprint: boolean;
  readonly crouch: boolean;
  readonly jump: boolean;
  readonly inspect: boolean;
  readonly cancel: boolean;

  readonly sprintHeld: boolean;
  readonly jumpPressed: boolean;
  readonly spacePressed: boolean;
  readonly spacePressedThisFrame: boolean;
  readonly ascendHeld: boolean;
  readonly descendHeld: boolean;
  readonly toggleFlightRequested: boolean;
  readonly debugNoClipRequested: boolean;
  readonly physics: PlayerMovementIntent;
  readonly active: boolean;
}

export interface EditorInputLibraryPlacementContext
  extends EditorLibraryPlacementContext {
  readonly itemKind: string | null;
  readonly sourceKind: string | null;
}

export interface EditorInputBlockIntent {
  readonly trigger: string;
  readonly position: ChunkApiWorldPosition;

  /**
   * Legacy alias. Für Library-/VPLIB-Placement ist dies der technische
   * runtimeBlockTypeId, nicht die fachliche Objektidentität.
   */
  readonly blockTypeId: string | null;

  readonly runtimeBlockTypeId: string | null;
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
  readonly libraryPlacement: EditorInputLibraryPlacementContext | null;

  readonly sourceCell: EditorStateChunkCellPosition | null;
  readonly placementCell: EditorStateChunkCellPosition | null;
  readonly targetPoint: Readonly<{ x: number; y: number; z: number }> | null;
  readonly createdAt: string;
}

export interface EditorInputWorldEditIntent {
  readonly action: "primary" | "secondary" | "primary-release" | "secondary-release";
  readonly trigger: string;
  readonly position: ChunkApiWorldPosition | null;
  readonly sourceCell: EditorStateChunkCellPosition | null;
  readonly placementCell: EditorStateChunkCellPosition | null;
  readonly targetPoint: Readonly<{ x: number; y: number; z: number }> | null;
  readonly createdAt: string;
}

export interface EditorInputControllerOptions {
  readonly refs: EditorDomRefs;
  readonly store: EditorStore;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly enabled?: boolean;
  readonly autoAttach?: boolean;
  readonly keyboardEnabled?: boolean;
  readonly mouseEnabled?: boolean;
  readonly wheelEnabled?: boolean;
  readonly pointerLockEnabled?: boolean;

  readonly requestPointerLockOnClick?: boolean;
  readonly requestPointerLockOnPointerDown?: boolean;
  readonly requirePointerLockForMouseActions?: boolean;
  readonly suppressPrimaryActionOnPointerLockActivation?: boolean;

  readonly preventDefault?: boolean;
  readonly dispatchToStore?: boolean;

  /**
   * The 3D scene keeps targeting in a lightweight frame-local cache. Reading
   * it here avoids rebuilding the full editor store just so a click can use
   * the newest raycast result.
   */
  readonly getTargetCells?: () => {
    readonly sourceCell: EditorStateChunkCellPosition | null;
    readonly placementCell: EditorStateChunkCellPosition | null;
    readonly targetPoint: Readonly<{ x: number; y: number; z: number }> | null;
  };

  readonly onPlaceBlock?: (intent: EditorInputBlockIntent) => void | Promise<void>;
  readonly onRemoveBlock?: (intent: EditorInputBlockIntent) => void | Promise<void>;
  readonly onWorldEditAction?: (
    intent: EditorInputWorldEditIntent,
  ) => boolean | Promise<boolean>;
  readonly onInspect?: (intent: {
    readonly sourceCell: EditorStateChunkCellPosition | null;
    readonly placementCell: EditorStateChunkCellPosition | null;
    readonly trigger: string;
    readonly createdAt: string;
  }) => void | Promise<void>;
  readonly onCancel?: (trigger: string) => void | Promise<void>;
  readonly onMovementIntent?: (
    intent: EditorInputMovementIntent,
    snapshot: InputStateSnapshot,
  ) => void;
  readonly onPerformanceEvent?: (event: {
    readonly type: string;
    readonly phase: string;
    readonly durationMs: number;
    readonly detail?: Readonly<Record<string, unknown>>;
  }) => void;
}

export interface EditorInputControllerSnapshot {
  readonly kind: "editor-input-controller-snapshot.v1";
  readonly status: EditorInputControllerStatus;
  readonly enabled: boolean;
  readonly attached: boolean;
  readonly destroyed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly attachCount: number;
  readonly detachCount: number;
  readonly placeIntentCount: number;
  readonly removeIntentCount: number;
  readonly inspectIntentCount: number;
  readonly cancelIntentCount: number;
  readonly blockedPlaceIntentCount: number;
  readonly blockedRemoveIntentCount: number;
  readonly dedupedPointerActionCount: number;
  readonly hotbarSelectCount: number;
  readonly blockedHotbarSelectCount: number;
  readonly wheelHotbarSelectCount: number;
  readonly movementIntentCount: number;
  readonly flightToggleIntentCount: number;
  readonly pointerLockRequestCount: number;
  readonly pointerLockExitCount: number;
  readonly lastTrigger: string | null;
  readonly lastBlockedReason: string | null;
  readonly lastPlacementContext: EditorInputLibraryPlacementContext | null;
  readonly lastMovementIntent: EditorInputMovementIntent;
  readonly lastError: Record<string, unknown> | null;
  readonly input: ReturnType<InputStateHandle["getSnapshot"]>;
  readonly keyboard: ReturnType<KeyboardInputHandle["getSnapshot"]>;
  readonly mouse: ReturnType<MouseInputHandle["getSnapshot"]>;
  readonly pointerLock: ReturnType<PointerLockHandle["getSnapshot"]> | null;
}

export interface EditorInputControllerHandle {
  readonly kind: "vectoplan-editor-input-controller.v1";

  attach(): void;
  detach(reason?: string): void;
  enable(reason?: string): void;
  disable(reason?: string): void;

  getInputState(): InputStateHandle;
  getKeyboardInput(): KeyboardInputHandle;
  getMouseInput(): MouseInputHandle;
  getPointerLock(): PointerLockHandle | null;

  requestPointerLock(reason?: string): Promise<boolean>;
  exitPointerLock(reason?: string): Promise<boolean>;

  getMovementIntent(): EditorInputMovementIntent;
  clear(reason?: string): void;

  getStatus(): EditorInputControllerStatus;
  getSnapshot(): EditorInputControllerSnapshot;

  destroy(reason?: string): Promise<void>;
}

const INPUT_CONTROLLER_KIND = "vectoplan-editor-input-controller.v1" as const;
const INPUT_CONTROLLER_SNAPSHOT_KIND = "editor-input-controller-snapshot.v1" as const;
const POINTER_ACTION_DUPLICATE_GUARD_MS = 40;
const POINTER_LOCK_ACTIVATION_SUPPRESS_MS = 220;
const PRODUCTIVE_INVENTORY_ROUTE = PRODUCTIVE_EDITOR_INVENTORY_ROUTE;

type PointerActionKind = "place" | "remove" | "inspect";

const MAX_INPUT_CONTROLLER_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string | null>();
const INTEGER_CACHE = new Map<string, number>();
const ERROR_RECORD_CACHE = new Map<string, Record<string, unknown>>();
const RUNTIME_BLOCK_TYPE_ID_CACHE = new Map<string, string | null>();

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_INPUT_CONTROLLER_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearInputControllerCaches(): void {
  try {
    TEXT_CACHE.clear();
    INTEGER_CACHE.clear();
    ERROR_RECORD_CACHE.clear();
    RUNTIME_BLOCK_TYPE_ID_CACHE.clear();
    clearEditorInventoryContractCaches();
  } catch {
    // Cache clearing must never break runtime.
  }
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

function monotonicNowMs(): number {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }

    return Date.now();
  } catch {
    return Date.now();
  }
}

function timestampToMs(value: string | null | undefined): number {
  try {
    if (!value) {
      return monotonicNowMs();
    }

    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return monotonicNowMs();
  } catch {
    return monotonicNowMs();
  }
}

function normalizeErrorRecord(error: unknown): Record<string, unknown> {
  try {
    const key =
      error instanceof Error
        ? `${error.name}:${error.message}:${error.stack ?? ""}`
        : typeof error === "string"
          ? error
          : JSON.stringify(error);

    const cached = ERROR_RECORD_CACHE.get(key);
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
        key,
        normalized as Record<string, unknown>,
      );
    }

    return setCachedValue(ERROR_RECORD_CACHE, key, {
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
        message: "Unknown input controller error.",
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
    // Input logging must never break runtime.
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
    // Input logging must never break runtime.
  }
}

function getCanvasSize(refs: EditorDomRefs): {
  readonly width: number;
  readonly height: number;
} {
  try {
    const rect = refs.canvasHost.getBoundingClientRect();

    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  } catch {
    return {
      width: 1,
      height: 1,
    };
  }
}

function worldPositionFromCell(
  cell: EditorStateChunkCellPosition,
): ChunkApiWorldPosition {
  return {
    x: cell.worldX,
    y: cell.worldY,
    z: cell.worldZ,
  };
}

function fallbackWorldPosition(): ChunkApiWorldPosition {
  return {
    x: 0,
    y: 0,
    z: 0,
  };
}

function positionFromOptionalCell(
  cell: EditorStateChunkCellPosition | null,
): ChunkApiWorldPosition {
  try {
    return cell ? worldPositionFromCell(cell) : fallbackWorldPosition();
  } catch {
    return fallbackWorldPosition();
  }
}

function normalizeText(value: unknown): string | null {
  try {
    if (typeof value === "string") {
      const cached = TEXT_CACHE.get(value);
      if (cached !== undefined) {
        return cached;
      }

      return setCachedValue(TEXT_CACHE, value, normalizeOptionalContractText(value));
    }

    return normalizeOptionalContractText(value);
  } catch {
    return null;
  }
}

function isForbiddenRuntimeBlockTypeId(value: unknown): boolean {
  return isForbiddenDebugBlockTypeId(value);
}

function normalizeRuntimeBlockTypeId(value: unknown): string | null {
  try {
    const raw = String(value ?? "");
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

function normalizeSlotIndex(value: unknown): number | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    const key = String(value);
    const cached = INTEGER_CACHE.get(key);

    if (cached !== undefined) {
      return cached >= 0 ? cached : null;
    }

    const parsed = safeInteger(value, -1);
    setCachedValue(INTEGER_CACHE, key, parsed);

    return parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function actionKeys(snapshot: InputStateSnapshot): readonly KeyboardActionKey[] {
  try {
    return snapshot.keyboard.pressedActionKeys;
  } catch {
    return [];
  }
}

function hasAction(snapshot: InputStateSnapshot, action: KeyboardActionKey): boolean {
  try {
    return actionKeys(snapshot).includes(action);
  } catch {
    return false;
  }
}

function movementAxis(
  snapshot: InputStateSnapshot,
  positive: KeyboardActionKey,
  negative: KeyboardActionKey,
): number {
  try {
    const positiveValue = hasAction(snapshot, positive) ? 1 : 0;
    const negativeValue = hasAction(snapshot, negative) ? 1 : 0;

    return positiveValue - negativeValue;
  } catch {
    return 0;
  }
}

function detectToggleFlightFromSnapshot(
  snapshot: InputStateSnapshot,
  doubleTapDetector: DoubleTapDetector | null,
): boolean {
  try {
    if (!doubleTapDetector || !snapshot.keyboard.spacePressedThisFrame) {
      return false;
    }

    const edge = snapshot.keyboard.keyDownEdge;

    if (!edge || edge.actionKey !== "jump") {
      return false;
    }

    const result = detectSpaceDoubleTap(doubleTapDetector, {
      nowMs: timestampToMs(edge.timestamp),
      repeat: edge.repeat,
      pressId: edge.pressId ?? undefined,
      active: true,
    });

    return shouldToggleFlightFromDoubleTap(result);
  } catch {
    return false;
  }
}

function physicsIntentFromEditorIntent(
  intent: Omit<EditorInputMovementIntent, "physics">,
): PlayerMovementIntent {
  try {
    return {
      forward: intent.forward,
      right: intent.right,
      sprintHeld: intent.sprintHeld,
      jumpPressed: intent.jumpPressed,
      ascendHeld: intent.ascendHeld,
      descendHeld: intent.descendHeld,
      toggleFlightRequested: intent.toggleFlightRequested,
      debugNoClipRequested: intent.debugNoClipRequested,
    };
  } catch {
    return {
      forward: 0,
      right: 0,
      sprintHeld: false,
      jumpPressed: false,
      ascendHeld: false,
      descendHeld: false,
      toggleFlightRequested: false,
      debugNoClipRequested: false,
    };
  }
}

function setMovementIntentFlightToggle(
  intent: EditorInputMovementIntent,
  toggleFlightRequested: boolean,
): EditorInputMovementIntent {
  try {
    const baseIntent: Omit<EditorInputMovementIntent, "physics"> = {
      forward: intent.forward,
      right: intent.right,
      up: intent.up,
      sprint: intent.sprint,
      crouch: intent.crouch,
      jump: intent.jump,
      inspect: intent.inspect,
      cancel: intent.cancel,
      sprintHeld: intent.sprintHeld,
      jumpPressed: intent.jumpPressed,
      spacePressed: intent.spacePressed,
      spacePressedThisFrame: intent.spacePressedThisFrame,
      ascendHeld: intent.ascendHeld,
      descendHeld: intent.descendHeld,
      toggleFlightRequested,
      debugNoClipRequested: intent.debugNoClipRequested,
      active: intent.active || toggleFlightRequested,
    };

    return {
      ...baseIntent,
      physics: physicsIntentFromEditorIntent(baseIntent),
    };
  } catch {
    return intent;
  }
}

function setMovementIntentJumpPressed(
  intent: EditorInputMovementIntent,
  jumpPressed: boolean,
): EditorInputMovementIntent {
  try {
    const baseIntent: Omit<EditorInputMovementIntent, "physics"> = {
      forward: intent.forward,
      right: intent.right,
      up: intent.up,
      sprint: intent.sprint,
      crouch: intent.crouch,
      jump: intent.jump,
      inspect: intent.inspect,
      cancel: intent.cancel,
      sprintHeld: intent.sprintHeld,
      jumpPressed,
      spacePressed: intent.spacePressed,
      spacePressedThisFrame: intent.spacePressedThisFrame,
      ascendHeld: intent.ascendHeld,
      descendHeld: intent.descendHeld,
      toggleFlightRequested: intent.toggleFlightRequested,
      debugNoClipRequested: intent.debugNoClipRequested,
      active: intent.active || jumpPressed,
    };

    return {
      ...baseIntent,
      physics: physicsIntentFromEditorIntent(baseIntent),
    };
  } catch {
    return intent;
  }
}

function movementIntentFromSnapshot(
  snapshot: InputStateSnapshot,
  options?: {
    readonly doubleTapDetector?: DoubleTapDetector | null;
    readonly consumeDoubleTap?: boolean;
  },
): EditorInputMovementIntent {
  try {
    const forward = movementAxis(snapshot, "move-backward", "move-forward");
    const right = movementAxis(snapshot, "move-right", "move-left");

    const sprintHeld = snapshot.keyboard.sprintHeld || hasAction(snapshot, "sprint");
    const crouch = hasAction(snapshot, "crouch");
    const jumpHeld = hasAction(snapshot, "jump");
    const jumpPressed = snapshot.keyboard.jumpPressedThisFrame;
    const spacePressedThisFrame = snapshot.keyboard.spacePressedThisFrame;
    const spacePressed = jumpHeld || spacePressedThisFrame;
    const ascendHeld = snapshot.keyboard.ascendHeld || jumpHeld;
    const descendHeld = snapshot.keyboard.descendHeld || hasAction(snapshot, "move-down");
    const inspect = hasAction(snapshot, "inspect");
    const cancel = hasAction(snapshot, "cancel");

    const toggleFlightRequested =
      options?.consumeDoubleTap === false
        ? false
        : detectToggleFlightFromSnapshot(
            snapshot,
            options?.doubleTapDetector ?? null,
          );

    const up = (ascendHeld ? 1 : 0) - (descendHeld ? 1 : 0);

    const baseIntent: Omit<EditorInputMovementIntent, "physics"> = {
      forward,
      right,
      up,
      sprint: sprintHeld,
      crouch,
      jump: jumpHeld,
      inspect,
      cancel,
      sprintHeld,
      jumpPressed,
      spacePressed,
      spacePressedThisFrame,
      ascendHeld,
      descendHeld,
      toggleFlightRequested,
      debugNoClipRequested: false,
      active:
        forward !== 0 ||
        right !== 0 ||
        up !== 0 ||
        sprintHeld ||
        crouch ||
        jumpHeld ||
        jumpPressed ||
        spacePressedThisFrame ||
        ascendHeld ||
        descendHeld ||
        toggleFlightRequested ||
        inspect ||
        cancel,
    };

    return {
      ...baseIntent,
      physics: physicsIntentFromEditorIntent(baseIntent),
    };
  } catch {
    const fallbackBase: Omit<EditorInputMovementIntent, "physics"> = {
      forward: 0,
      right: 0,
      up: 0,
      sprint: false,
      crouch: false,
      jump: false,
      inspect: false,
      cancel: false,
      sprintHeld: false,
      jumpPressed: false,
      spacePressed: false,
      spacePressedThisFrame: false,
      ascendHeld: false,
      descendHeld: false,
      toggleFlightRequested: false,
      debugNoClipRequested: false,
      active: false,
    };

    return {
      ...fallbackBase,
      physics: physicsIntentFromEditorIntent(fallbackBase),
    };
  }
}

function dispatchStoreAction(
  store: EditorStore,
  action: Parameters<typeof applyEditorAction>[1],
  options?: {
    readonly notify?: boolean;
    readonly captureHistory?: boolean;
  },
): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, action),
      {
        action: action.kind,
        notify: options?.notify ?? true,
        captureHistory: options?.captureHistory ?? false,
      },
    );
  } catch {
    // Input controller store dispatch must not break DOM input.
  }
}

function dispatchDebugWarning(
  store: EditorStore,
  warning: string,
  source: string,
): void {
  dispatchStoreAction(
    store,
    {
      kind: "debug/warning",
      warning,
      source,
      createdAt: now(),
    },
    {
      notify: false,
      captureHistory: false,
    },
  );
}

function dispatchDebugError(store: EditorStore, error: unknown, source: string): void {
  dispatchStoreAction(
    store,
    {
      kind: "debug/error",
      error,
      source,
      createdAt: now(),
    },
    {
      notify: false,
      captureHistory: false,
    },
  );
}

function dispatchLiveMessage(
  store: EditorStore,
  message: string | null,
  source: string,
): void {
  dispatchStoreAction(
    store,
    {
      kind: "ui/live-message",
      message,
      source,
      createdAt: now(),
    },
    {
      notify: true,
      captureHistory: false,
    },
  );
}

function slotFromKeyboardAction(actionKey: KeyboardActionKey): number | null {
  try {
    if (!actionKey.startsWith("hotbar-")) {
      return null;
    }

    const value = Number.parseInt(actionKey.replace("hotbar-", ""), 10);

    if (!Number.isFinite(value) || value < 1 || value > 9) {
      return null;
    }

    return value - 1;
  } catch {
    return null;
  }
}

function normalizeSlot(slot: number, slotCount: number): number {
  try {
    const count = Math.max(1, safeInteger(slotCount, 1));
    return Math.max(0, Math.min(count - 1, safeInteger(slot, 0)));
  } catch {
    return 0;
  }
}

function wrapSlot(slot: number, slotCount: number): number {
  try {
    const count = Math.max(1, safeInteger(slotCount, 1));
    const raw = safeInteger(slot, 0);

    return ((raw % count) + count) % count;
  } catch {
    return 0;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  try {
    const record = asEditorInventoryContractRecord(value);
    return Object.keys(record).length > 0 ? record : null;
  } catch {
    return null;
  }
}

function readNumber(value: unknown, fallback: number): number {
  try {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function readInventoryRecord(state: unknown): Record<string, unknown> | null {
  try {
    return asRecord(asRecord(state)?.inventory);
  } catch {
    return null;
  }
}

function readInventorySlotCount(state: unknown): number {
  try {
    const inventory = readInventoryRecord(state);

    if (!inventory) {
      return 9;
    }

    const explicitSlotCount = readNumber(inventory.slotCount, 0);

    if (explicitSlotCount > 0) {
      return explicitSlotCount;
    }

    const hotbarSlots = Array.isArray(inventory.hotbarSlots)
      ? inventory.hotbarSlots
      : null;

    if (hotbarSlots && hotbarSlots.length > 0) {
      return hotbarSlots.length;
    }

    const slots = Array.isArray(inventory.slots) ? inventory.slots : null;

    if (slots && slots.length > 0) {
      return slots.length;
    }

    return 9;
  } catch {
    return 9;
  }
}

function readCurrentInventorySlot(state: unknown): number {
  try {
    const inventory = readInventoryRecord(state);

    if (!inventory) {
      return 0;
    }

    const directKeys = [
      "selectedSlotIndex",
      "selectedSlot",
      "activeSlotIndex",
      "activeSlot",
      "slot",
    ];

    for (const key of directKeys) {
      const value = readNumber(inventory[key], Number.NaN);

      if (Number.isFinite(value)) {
        return Math.max(0, Math.trunc(value));
      }
    }

    const selectedItem = asRecord(inventory.selectedItem);

    if (selectedItem) {
      const itemKeys = [
        "slotIndex",
        "slot",
        "index",
      ];

      for (const key of itemKeys) {
        const value = readNumber(selectedItem[key], Number.NaN);

        if (Number.isFinite(value)) {
          return Math.max(0, Math.trunc(value));
        }
      }
    }

    return 0;
  } catch {
    return 0;
  }
}

function readSelectedInventoryLabel(state: unknown, fallbackSlot: number): string {
  try {
    const inventory = readInventoryRecord(state);
    const selectedItem = asRecord(inventory?.selectedItem);
    const label = selectedItem?.label;

    if (typeof label === "string" && label.trim()) {
      return `Ausgewähltes Library-/VPLIB-Item: ${label.trim()}`;
    }

    const runtimeBlockTypeId = selectedItem?.runtimeBlockTypeId ?? selectedItem?.blockTypeId;

    if (typeof runtimeBlockTypeId === "string" && runtimeBlockTypeId.trim()) {
      return `Ausgewählter Runtime-Blocktyp: ${runtimeBlockTypeId.trim()}`;
    }

    const hotbarSlots = Array.isArray(inventory?.hotbarSlots)
      ? inventory.hotbarSlots
      : [];
    const hotbarSlot = asRecord(
      hotbarSlots.find((slot) => asRecord(slot)?.slot === fallbackSlot),
    );

    if (typeof hotbarSlot?.label === "string" && hotbarSlot.label.trim()) {
      return `Ausgewähltes Library-/VPLIB-Item: ${hotbarSlot.label.trim()}`;
    }

    return `Hotbar-Slot ${fallbackSlot + 1}`;
  } catch {
    return `Hotbar-Slot ${fallbackSlot + 1}`;
  }
}

function wheelDirectionFromSnapshot(snapshot: InputStateSnapshot, event?: WheelEvent): number {
  try {
    const eventDelta = event?.deltaY;

    if (typeof eventDelta === "number" && Number.isFinite(eventDelta) && eventDelta !== 0) {
      return eventDelta > 0 ? 1 : -1;
    }

    const snapshotDelta = snapshot.wheel.delta.y;

    if (snapshotDelta !== 0) {
      return snapshotDelta > 0 ? 1 : -1;
    }

    const xDelta = snapshot.wheel.delta.x;

    if (xDelta !== 0) {
      return xDelta > 0 ? 1 : -1;
    }

    return 0;
  } catch {
    return 0;
  }
}

function findNextHotbarSlot(
  currentSlot: number,
  direction: number,
  slotCount: number,
): number {
  try {
    const step = direction >= 0 ? 1 : -1;
    const count = Math.max(1, slotCount);
    return count > 1 ? wrapSlot(currentSlot + step, count) : currentSlot;
  } catch {
    return currentSlot;
  }
}
function postHotbarSelectionToInventoryFrame(
  refs: EditorDomRefs,
  zeroBasedSlot: number,
  trigger: string,
): void {
  try {
    const frame = refs.root.querySelector<HTMLIFrameElement>(
      "[data-user-inventory-frame]",
    );
    if (!frame?.contentWindow) {
      return;
    }

    let targetOrigin = "*";
    try {
      targetOrigin = new URL(
        frame.getAttribute("src") || frame.src,
        window.location.href,
      ).origin;
    } catch {
      targetOrigin = "*";
    }

    frame.contentWindow.postMessage(
      {
        type: "vectoplan:user-inventory-select-slot",
        source: "vectoplan-editor",
        version: 1,
        detail: {
          slot_index: zeroBasedSlot + 1,
          source: trigger,
          // Slot navigation is an in-session editor action. Persisting every
          // wheel tick makes the inventory frame emit a save event, which in
          // turn forces a full inventory/editor reload.
          persist: false,
          focus: false,
          immediate: false,
        },
      },
      targetOrigin,
    );
  } catch {
    // Cross-frame selection sync is best-effort.
  }
}


function setRootInputDataset(
  refs: EditorDomRefs,
  key: string,
  value: unknown,
): void {
  try {
    if (value === undefined || value === null) {
      delete refs.root.dataset[key];
      return;
    }

    refs.root.dataset[key] = String(value);
  } catch {
    // Dataset is diagnostic-only.
  }
}

function setPlacementDataset(
  refs: EditorDomRefs,
  context: EditorInputLibraryPlacementContext | null,
): void {
  try {
    setRootInputDataset(refs, "inputPlacementValid", context?.valid ?? null);
    setRootInputDataset(refs, "inputPlacementBlockedReason", context?.blockedReason ?? null);
    setRootInputDataset(refs, "inputPlacementInvalidReason", context?.invalidReason ?? null);
    setRootInputDataset(refs, "inputPlacementRuntimeBlockTypeId", context?.runtimeBlockTypeId ?? null);
    setRootInputDataset(refs, "inputPlacementLibraryItemId", context?.libraryItemId ?? null);
    setRootInputDataset(refs, "inputPlacementFamilyId", context?.familyId ?? null);
    setRootInputDataset(refs, "inputPlacementPackageId", context?.packageId ?? null);
    setRootInputDataset(refs, "inputPlacementVplibUid", context?.vplibUid ?? null);
    setRootInputDataset(refs, "inputPlacementVariantId", context?.variantId ?? null);
    setRootInputDataset(refs, "inputPlacementRevisionHash", context?.revisionHash ?? null);
    setRootInputDataset(refs, "inputPlacementObjectKind", context?.objectKind ?? null);
    setRootInputDataset(refs, "inputPlacementInventoryTruth", PRODUCTIVE_INVENTORY_ROUTE);
  } catch {
    // Dataset is diagnostic-only.
  }
}

function selectedItemKind(selectedItem: EditorInventoryItem | null): string | null {
  try {
    return selectedItem?.kind ?? null;
  } catch {
    return null;
  }
}

function selectedItemSourceKind(selectedItem: EditorInventoryItem | null): string | null {
  try {
    return selectedItem?.sourceKind ?? null;
  } catch {
    return null;
  }
}

function selectedItemIsLibraryPlaceable(
  selectedItem: EditorInventoryItem | null,
): boolean {
  try {
    if (!selectedItem) {
      return false;
    }

    if (!selectedItem.enabled || !selectedItem.placeable) {
      return false;
    }

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      selectedItem.runtimeBlockTypeId ?? selectedItem.blockTypeId,
    );

    if (!runtimeBlockTypeId) {
      return false;
    }

    return Boolean(
      selectedItem.kind === "library-item" ||
        selectedItem.kind === "vplib" ||
        selectedItem.sourceKind === "library" ||
        selectedItem.libraryRef ||
        selectedItem.placementCommand ||
        selectedItem.familyId ||
        selectedItem.vplibUid ||
        selectedItem.libraryItemId,
    );
  } catch {
    return false;
  }
}

function isInputPlacementContextValid(
  context: EditorInputLibraryPlacementContext,
): boolean {
  try {
    /**
     * Do not pass the strongly typed context directly to the type guard at the
     * call site. TypeScript can narrow the negative branch to never because
     * EditorInputLibraryPlacementContext already extends EditorLibraryPlacementContext.
     */
    return isValidEditorLibraryPlacementContext(context as unknown);
  } catch {
    return false;
  }
}

function createInvalidInputPlacementContext(
  context: EditorInputLibraryPlacementContext,
  reason: string,
): EditorInputLibraryPlacementContext {
  try {
    const normalized = createEditorLibraryPlacementContext({
      source: context.source,
      runtimeBlockTypeId: context.runtimeBlockTypeId,
      blockTypeId: context.blockTypeId,
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
      libraryRef: context.libraryRef,
      placementCommand: context.placementCommand,
      commandMetadata: {
        ...asEditorInventoryContractRecord(context.commandMetadata),
        invalidContextRebuiltBy: "input-controller",
      },
      requireLibraryIdentity: true,
      blockedReason: reason,
    });

    return {
      ...normalized,
      itemKind: context.itemKind,
      sourceKind: context.sourceKind,
    };
  } catch {
    return createFallbackPlacementContext(reason);
  }
}

function createFallbackPlacementContext(
  reason: string,
): EditorInputLibraryPlacementContext {
  const context = createEditorLibraryPlacementContext({
    source: "editor-inventory",
    runtimeBlockTypeId: null,
    blockTypeId: null,
    libraryItemId: null,
    inventoryItemId: null,
    inventorySlotIndex: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    label: null,
    libraryRef: null,
    placementCommand: null,
    commandMetadata: {
      inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
      browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
    },
    requireLibraryIdentity: true,
    blockedReason: reason,
  });

  return {
    ...context,
    itemKind: null,
    sourceKind: null,
  };
}

export function createEditorInputController(
  options: EditorInputControllerOptions,
): EditorInputControllerHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;
  const canvasSize = getCanvasSize(refs);

  const inputState = createInputState({
    keyboardEnabled: options.keyboardEnabled ?? true,
    mouseEnabled: options.mouseEnabled ?? true,
    wheelEnabled: options.wheelEnabled ?? true,
    pointerLockEnabled: options.pointerLockEnabled ?? true,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
  });

  const flightToggleDetector = createSpaceDoubleTapDetector();
  const createdAt = now();

  let status: EditorInputControllerStatus = "created";
  let enabled = safeBoolean(options.enabled, true);
  let attached = false;
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let attachCount = 0;
  let detachCount = 0;
  let placeIntentCount = 0;
  let removeIntentCount = 0;
  let inspectIntentCount = 0;
  let cancelIntentCount = 0;
  let blockedPlaceIntentCount = 0;
  let blockedRemoveIntentCount = 0;
  let dedupedPointerActionCount = 0;
  let hotbarSelectCount = 0;
  let blockedHotbarSelectCount = 0;
  let wheelHotbarSelectCount = 0;
  let movementIntentCount = 0;
  let flightToggleIntentCount = 0;
  let pointerLockRequestCount = 0;
  let pointerLockExitCount = 0;
  let lastTrigger: string | null = null;
  let lastBlockedReason: string | null = null;
  let lastPlacementContext: EditorInputLibraryPlacementContext | null = null;
  let lastError: Record<string, unknown> | null = null;
  let pendingFlightToggleRequested = false;
  let pendingJumpRequested = false;
  let lastMovementIntent = movementIntentFromSnapshot(inputState.getSnapshot(), {
    doubleTapDetector: null,
    consumeDoubleTap: false,
  });

  let pointerLock: PointerLockHandle | null = null;
  let lastPointerActionKey: string | null = null;
  let lastPointerActionAtMs = 0;

  function setStatus(nextStatus: EditorInputControllerStatus): void {
    try {
      status = nextStatus;
      updatedAt = now();

      refs.root.dataset.inputControllerStatus = nextStatus;
      refs.root.dataset.inputControllerEnabled = enabled ? "true" : "false";
      refs.root.dataset.inputControllerAttached = attached ? "true" : "false";
      refs.root.dataset.inputControllerUpdatedAt = updatedAt;
      refs.root.dataset.inputControllerInventoryTruth = PRODUCTIVE_INVENTORY_ROUTE;
      refs.root.dataset.inputControllerOnlyLibraryItemsPlaceable = String(ONLY_LIBRARY_ITEMS_PLACEABLE);
      refs.root.dataset.inputControllerDebugGrassDirtAllowed = String(DEBUG_GRASS_DIRT_ALLOWED);
      refs.root.dataset.inputControllerBrowserCallsLibraryDirectly = String(BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY);
    } catch {
      try {
        status = nextStatus;
        updatedAt = now();
      } catch {
        status = nextStatus;
      }
    }
  }

  function setError(error: unknown): void {
    try {
      lastError = normalizeErrorRecord(error);
      setStatus("failed");
      dispatchDebugError(store, error, "input-controller");
    } catch {
      status = "failed";
    }
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed") {
      logWarn(logger, "Input controller action ignored because controller is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function blockAction(reason: string, trigger: string, userMessage: string): void {
    lastBlockedReason = reason;
    setRootInputDataset(refs, "inputLastBlockedReason", reason);
    setRootInputDataset(refs, "inputLastBlockedAt", now());
    dispatchDebugWarning(store, `Input-Aktion blockiert: ${reason}`, trigger);
    dispatchLiveMessage(store, userMessage, trigger);
    setDomLiveMessage(refs, userMessage);
  }

  function createLibraryPlacementContext(
    state: ReturnType<EditorStore["peekState"]>,
  ): EditorInputLibraryPlacementContext {
    try {
      const selectedItem = selectSelectedInventoryItem(state);
      const activePlacement = selectActivePlacementSummary(state);
      const libraryRef = selectActiveLibraryRef(state) ?? activePlacement.libraryRef;
      const placementCommand =
        selectActivePlacementCommand(state) ?? activePlacement.placementCommand;
      const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
        activePlacement.runtimeBlockTypeId ??
          selectActiveRuntimeBlockTypeId(state) ??
          selectedItem?.runtimeBlockTypeId ??
          selectedItem?.blockTypeId,
      );

      const libraryItemId = normalizeText(
        activePlacement.libraryItemId ??
          selectSelectedLibraryItemId(state) ??
          selectedItem?.libraryItemId ??
          libraryRef?.libraryItemId,
      );
      const familyId = normalizeText(
        activePlacement.familyId ??
          selectSelectedFamilyId(state) ??
          selectedItem?.familyId ??
          libraryRef?.familyId,
      );
      const packageId = normalizeText(
        activePlacement.packageId ??
          selectSelectedPackageId(state) ??
          selectedItem?.packageId ??
          libraryRef?.packageId,
      );
      const vplibUid = normalizeText(
        activePlacement.vplibUid ??
          selectSelectedVplibUid(state) ??
          selectedItem?.vplibUid ??
          libraryRef?.vplibUid,
      );
      const variantId = normalizeText(
        activePlacement.variantId ??
          selectSelectedVariantId(state) ??
          selectedItem?.variantId ??
          libraryRef?.variantId ??
          "default",
      );
      const revisionHash = normalizeText(
        activePlacement.revisionHash ??
          selectSelectedRevisionHash(state) ??
          selectedItem?.revisionHash ??
          libraryRef?.revisionHash,
      );
      const inventorySlotIndex = normalizeSlotIndex(
        selectSelectedSlotIndex(state) ?? selectedItem?.slot,
      );
      const inventoryItemId = normalizeText(
        selectedItem?.id ?? libraryItemId ?? familyId ?? vplibUid,
      );
      const objectKind = normalizeText(
        activePlacement.objectKind ?? selectedItem?.objectKind ?? libraryRef?.objectKind,
      );
      const label = normalizeText(
        activePlacement.label ??
          selectedItem?.label ??
          familyId ??
          vplibUid ??
          libraryItemId ??
          runtimeBlockTypeId,
      );
      const itemKind = selectedItemKind(selectedItem) ?? activePlacement.itemKind ?? null;
      const sourceKind =
        selectedItemSourceKind(selectedItem) ?? activePlacement.sourceKind ?? null;

      let blockedReason = activePlacement.blockedReason ?? null;

      if (!blockedReason && selectedItem && !selectedItemIsLibraryPlaceable(selectedItem)) {
        blockedReason = "selected-item-is-not-placeable-library-item";
      }

      const contextBase = createEditorLibraryPlacementContext({
        source: "editor-inventory",
        runtimeBlockTypeId,
        blockTypeId: runtimeBlockTypeId,
        libraryItemId,
        inventoryItemId,
        inventorySlotIndex,
        familyId,
        packageId,
        vplibUid,
        variantId,
        revisionHash,
        objectKind,
        label,
        libraryRef,
        placementCommand,
        commandMetadata: {
          selectedLabel: label,
          selectedInventoryItemId: inventoryItemId,
          selectedInventorySlotIndex: inventorySlotIndex,
          selectedItemKind: itemKind,
          selectedSourceKind: sourceKind,
          selectedRuntimeBlockTypeId: runtimeBlockTypeId,
          selectedLibraryItemId: libraryItemId,
          selectedFamilyId: familyId,
          selectedPackageId: packageId,
          selectedVplibUid: vplibUid,
          selectedVariantId: variantId,
          selectedRevisionHash: revisionHash,
          selectedObjectKind: objectKind,
          activePlacementValid: activePlacement.valid,
          activePlacementBlockedReason: activePlacement.blockedReason,
          inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
          browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
        },
        requireLibraryIdentity: true,
        blockedReason,
      });

      const context: EditorInputLibraryPlacementContext = {
        ...contextBase,
        itemKind,
        sourceKind,
      };

      /**
       * Guard against accidental future drift: the central contract is the
       * source of truth for runtimeBlockTypeId + Library/VPLIB identity.
       *
       * Important:
       * Do not call the type guard directly in this if-condition. The helper
       * returns a plain boolean, avoiding a TypeScript negative-branch narrowing
       * to never for EditorInputLibraryPlacementContext.
       */
      if (!isInputPlacementContextValid(context)) {
        const invalidReason =
          context.blockedReason ??
          context.invalidReason ??
          "invalid-library-placement-context";

        const invalidContext = createInvalidInputPlacementContext(
          context,
          invalidReason,
        );

        setPlacementDataset(refs, invalidContext);
        return invalidContext;
      }

      setPlacementDataset(refs, context);

      return context;
    } catch (error) {
      logWarn(logger, "Library placement context creation failed.", {
        error: normalizeUnknownError(error),
      });

      const fallback = createFallbackPlacementContext("placement-context-error");

      setPlacementDataset(refs, fallback);

      return fallback;
    }
  }

  function refreshMovementIntent(trigger: string): void {
    try {
      const snapshot = inputState.getSnapshot();
      const detectedIntent = movementIntentFromSnapshot(snapshot, {
        doubleTapDetector: flightToggleDetector,
      });

      if (detectedIntent.jumpPressed) {
        pendingJumpRequested = true;
        setRootInputDataset(refs, "inputLastJumpRequestedAt", now());
      }


      if (detectedIntent.sprintHeld) {
        setRootInputDataset(refs, "inputLastSprintRequestedAt", now());
      }

      if (detectedIntent.descendHeld) {
        setRootInputDataset(refs, "inputLastDescendRequestedAt", now());
      }
      if (detectedIntent.toggleFlightRequested) {
        pendingFlightToggleRequested = true;
        flightToggleIntentCount += 1;
        setRootInputDataset(refs, "inputLastFlightToggleAt", now());
        dispatchLiveMessage(store, "Flugmodus umgeschaltet.", trigger);
      }

      const stableIntent = setMovementIntentFlightToggle(detectedIntent, false);
      lastMovementIntent = stableIntent;
      setRootInputDataset(refs, "inputJumpHeld", String(stableIntent.jump));
      setRootInputDataset(refs, "inputSprintHeld", String(stableIntent.sprintHeld));
      setRootInputDataset(refs, "inputDescendHeld", String(stableIntent.descendHeld));

      options.onMovementIntent?.(stableIntent, snapshot);

      if (stableIntent.active || pendingJumpRequested || pendingFlightToggleRequested) {
        movementIntentCount += 1;
      }

      lastTrigger = trigger;
      setStatus(attached && enabled ? "active" : status);
    } catch (error) {
      setError(error);
    }
  }

  function shouldSkipPointerAction(
    action: PointerActionKind,
    trigger: string,
  ): boolean {
    try {
      const key = action;
      const at = monotonicNowMs();
      const elapsed = at - lastPointerActionAtMs;

      if (
        lastPointerActionKey === key &&
        elapsed >= 0 &&
        elapsed < POINTER_ACTION_DUPLICATE_GUARD_MS
      ) {
        dedupedPointerActionCount += 1;
        logDebug(logger, "Pointer action deduplicated.", {
          action,
          trigger,
          elapsedMs: elapsed,
        });
        return true;
      }

      lastPointerActionKey = key;
      lastPointerActionAtMs = at;

      return false;
    } catch {
      return false;
    }
  }

  async function requestPointerLock(reason?: string): Promise<boolean> {
    if (!assertAlive("requestPointerLock")) {
      return false;
    }

    pointerLockRequestCount += 1;

    if (!pointerLock) {
      dispatchDebugWarning(
        store,
        "Pointer Lock ist deaktiviert.",
        reason ?? "input-controller.requestPointerLock",
      );
      return false;
    }

    try {
      focusEditorCanvas(refs);
      return await pointerLock.requestLock(
        reason ?? "input-controller.requestPointerLock",
      );
    } catch (error) {
      setError(error);
      return false;
    }
  }

  async function exitPointerLock(reason?: string): Promise<boolean> {
    pointerLockExitCount += 1;

    if (!pointerLock) {
      return true;
    }

    try {
      return await pointerLock.exitLock(reason ?? "input-controller.exitLock");
    } catch (error) {
      setError(error);
      return false;
    }
  }

  async function executeInspect(trigger: string): Promise<void> {
    if (!assertAlive("executeInspect")) {
      return;
    }

    inspectIntentCount += 1;
    lastTrigger = trigger;

    try {
      const state = store.peekState();

      dispatchStoreAction(store, {
        kind: "tools/set-active",
        toolId: "inspect",
        source: trigger,
        createdAt: now(),
      });

      const directTarget = options.getTargetCells?.() ?? null;
      await options.onInspect?.({
        sourceCell: directTarget ? directTarget.sourceCell : selectSourceCell(state),
        placementCell: directTarget ? directTarget.placementCell : selectPlacementCell(state),
        trigger,
        createdAt: now(),
      });
    } catch (error) {
      setError(error);
    }
  }

  async function executeCancel(trigger: string): Promise<void> {
    if (!assertAlive("executeCancel")) {
      return;
    }

    cancelIntentCount += 1;
    lastTrigger = trigger;

    try {
      dispatchStoreAction(store, {
        kind: "targeting/clear",
        reason: trigger,
        source: trigger,
        createdAt: now(),
      });

      dispatchLiveMessage(store, "Aktion abgebrochen.", trigger);
      setDomLiveMessage(refs, "Aktion abgebrochen.");

      await exitPointerLock(trigger);
      await options.onCancel?.(trigger);
    } catch (error) {
      setError(error);
    }
  }

  async function executePlace(trigger: string): Promise<void> {
    if (!assertAlive("executePlace")) {
      return;
    }

    placeIntentCount += 1;
    lastTrigger = trigger;

    try {
      const state = store.peekState();
      const directTarget = options.getTargetCells?.() ?? null;
      const placementCell = directTarget ? directTarget.placementCell : selectPlacementCell(state);
      const sourceCell = directTarget ? directTarget.sourceCell : selectSourceCell(state);
      const libraryPlacement = createLibraryPlacementContext(state);
      const position = positionFromOptionalCell(placementCell);

      lastPlacementContext = libraryPlacement;

      if (options.onWorldEditAction) {
        const handled = await options.onWorldEditAction({
          action: "primary",
          trigger,
          position: placementCell ? position : null,
          sourceCell,
          placementCell,
          targetPoint: directTarget?.targetPoint ?? null,
          createdAt: now(),
        });
        if (handled) return;
      }

      if (!placementCell) {
        blockedPlaceIntentCount += 1;
        blockAction(
          "missing-placement-cell",
          trigger,
          "Kein gültiges Ziel zum Platzieren.",
        );
        return;
      }

      if (!libraryPlacement.valid || !libraryPlacement.runtimeBlockTypeId) {
        blockedPlaceIntentCount += 1;
        blockAction(
          libraryPlacement.blockedReason ??
            libraryPlacement.invalidReason ??
            "invalid-library-placement",
          trigger,
          "Kein platzierbares Library-/VPLIB-Item ausgewählt.",
        );
        return;
      }

      if (!options.onPlaceBlock) {
        dispatchDebugWarning(
          store,
          "Library-/VPLIB-Item setzen wurde ausgelöst, aber onPlaceBlock ist nicht registriert.",
          trigger,
        );
        return;
      }

      await options.onPlaceBlock({
        trigger,
        position,
        blockTypeId: libraryPlacement.runtimeBlockTypeId,
        runtimeBlockTypeId: libraryPlacement.runtimeBlockTypeId,
        libraryItemId: libraryPlacement.libraryItemId,
        inventoryItemId: libraryPlacement.inventoryItemId,
        inventorySlotIndex: libraryPlacement.inventorySlotIndex,
        familyId: libraryPlacement.familyId,
        packageId: libraryPlacement.packageId,
        vplibUid: libraryPlacement.vplibUid,
        variantId: libraryPlacement.variantId,
        revisionHash: libraryPlacement.revisionHash,
        objectKind: libraryPlacement.objectKind,
        libraryRef: libraryPlacement.libraryRef,
        placementCommand: libraryPlacement.placementCommand,
        libraryPlacement,
        sourceCell,
        placementCell,
        targetPoint: directTarget?.targetPoint ?? null,
        createdAt: now(),
      });
    } catch (error) {
      setError(error);
    }
  }

  async function executeRemove(trigger: string): Promise<void> {
    if (!assertAlive("executeRemove")) {
      return;
    }

    removeIntentCount += 1;
    lastTrigger = trigger;

    try {
      const state = store.peekState();
      const directTarget = options.getTargetCells?.() ?? null;
      const sourceCell = directTarget ? directTarget.sourceCell : selectSourceCell(state);
      const placementCell = directTarget ? directTarget.placementCell : selectPlacementCell(state);

      if (options.onWorldEditAction) {
        const handled = await options.onWorldEditAction({
          action: "secondary",
          trigger,
          position: sourceCell ? worldPositionFromCell(sourceCell) : null,
          sourceCell,
          placementCell,
          targetPoint: directTarget?.targetPoint ?? null,
          createdAt: now(),
        });
        if (handled) return;
      }

      if (!sourceCell) {
        blockedRemoveIntentCount += 1;
        blockAction(
          "missing-source-cell",
          trigger,
          "Kein Block zum Entfernen ausgewählt.",
        );
        return;
      }

      const position = worldPositionFromCell(sourceCell);

      if (!options.onRemoveBlock) {
        dispatchDebugWarning(
          store,
          "Block entfernen wurde ausgelöst, aber onRemoveBlock ist nicht registriert.",
          trigger,
        );
        return;
      }

      await options.onRemoveBlock({
        trigger,
        position,
        blockTypeId: normalizeRuntimeBlockTypeId(sourceCell.blockTypeId),
        runtimeBlockTypeId: normalizeRuntimeBlockTypeId(sourceCell.blockTypeId),
        libraryItemId: null,
        inventoryItemId: null,
        inventorySlotIndex: null,
        familyId: null,
        packageId: null,
        vplibUid: null,
        variantId: null,
        revisionHash: null,
        objectKind: null,
        libraryRef: null,
        placementCommand: null,
        libraryPlacement: null,
        sourceCell,
        placementCell,
        targetPoint: directTarget?.targetPoint ?? null,
        createdAt: now(),
      });
    } catch (error) {
      setError(error);
    }
  }

  async function executeWorldEditRelease(
    action: "primary-release" | "secondary-release",
    trigger: string,
  ): Promise<void> {
    if (!assertAlive("executeWorldEditRelease") || !options.onWorldEditAction) return;
    try {
      const state = store.peekState();
      const directTarget = options.getTargetCells?.() ?? null;
      const sourceCell = directTarget ? directTarget.sourceCell : selectSourceCell(state);
      const placementCell = directTarget ? directTarget.placementCell : selectPlacementCell(state);
      const targetCell = action === "primary-release" ? placementCell : sourceCell;
      await options.onWorldEditAction({
        action,
        trigger,
        position: targetCell ? worldPositionFromCell(targetCell) : null,
        sourceCell,
        placementCell,
        targetPoint: directTarget?.targetPoint ?? null,
        createdAt: now(),
      });
    } catch (error) {
      setError(error);
    }
  }

  function executePointerAction(action: PointerActionKind, trigger: string): void {
    const actionStartedAtMs = monotonicNowMs();
    if (!assertAlive(`executePointerAction:${action}`)) {
      return;
    }

    if (shouldSkipPointerAction(action, trigger)) {
      options.onPerformanceEvent?.({
        type: "pointer-action",
        phase: "deduplicated",
        durationMs: Math.max(0, monotonicNowMs() - actionStartedAtMs),
        detail: { action, trigger, dedupedPointerActionCount },
      });
      return;
    }

    options.onPerformanceEvent?.({
      type: "pointer-action",
      phase: "accepted",
      durationMs: Math.max(0, monotonicNowMs() - actionStartedAtMs),
      detail: {
        action,
        trigger,
        placeIntentCount,
        removeIntentCount,
      },
    });

    if (action === "place") {
      void executePlace(trigger);
      return;
    }

    if (action === "remove") {
      void executeRemove(trigger);
      return;
    }

    void executeInspect(trigger);
  }

  function selectHotbarSlot(slot: number, trigger: string): void {
    const selectionStartedAtMs = monotonicNowMs();
    if (!assertAlive("selectHotbarSlot")) {
      return;
    }

    try {
      const state = store.peekState();
      const slotCount = readInventorySlotCount(state);
      const normalizedSlot = normalizeSlot(slot, slotCount);

      hotbarSelectCount += 1;
      lastTrigger = trigger;

      const storeUpdateStartedAtMs = monotonicNowMs();
      store.setState(
        (previous) =>
          applyEditorAction(previous, {
            kind: "inventory/select-slot",
            slot: normalizedSlot,
            source: trigger,
            createdAt: now(),
          }),
        {
          action: "input-controller.hotbar-slot",
          // Selection is consumed directly by placement/held-item polling and
          // rendered by the inventory iframe. Notifying every editor UI view
          // here adds work without a visible consumer.
          notify: false,
          captureHistory: false,
        },
      );
      const storeUpdateMs = monotonicNowMs() - storeUpdateStartedAtMs;

      const frameSyncStartedAtMs = monotonicNowMs();
      postHotbarSelectionToInventoryFrame(refs, normalizedSlot, trigger);
      const frameSyncMs = monotonicNowMs() - frameSyncStartedAtMs;

      const labelReadStartedAtMs = monotonicNowMs();
      const nextState = store.peekState();
      const label = readSelectedInventoryLabel(nextState, normalizedSlot);
      const labelReadMs = monotonicNowMs() - labelReadStartedAtMs;

      const domUpdateStartedAtMs = monotonicNowMs();
      setRootInputDataset(refs, "inputLastSelectedHotbarSlot", normalizedSlot);
      setRootInputDataset(refs, "inputLastSelectedHotbarAt", now());

      setDomLiveMessage(refs, label);
      // The embedded inventory renders the transient selected-item label.
      // Dispatching the same label through the global live-message store made
      // keyboard selection rebuild the surrounding UI (85-138 ms in F8),
      // while providing no additional visible information.
      setStatus(attached && enabled ? "active" : status);
      const domUpdateMs = monotonicNowMs() - domUpdateStartedAtMs;
      options.onPerformanceEvent?.({
        type: "hotbar-selection",
        phase: "complete",
        durationMs: Math.max(0, monotonicNowMs() - selectionStartedAtMs),
        detail: {
          trigger,
          normalizedSlot,
          storeUpdateMs,
          frameSyncMs,
          labelReadMs,
          domUpdateMs,
        },
      });
    } catch (error) {
      options.onPerformanceEvent?.({
        type: "hotbar-selection",
        phase: "exception",
        durationMs: Math.max(0, monotonicNowMs() - selectionStartedAtMs),
        detail: { trigger, slot },
      });
      setError(error);
    }
  }

  function selectHotbarByWheel(
    snapshot: InputStateSnapshot,
    event: WheelEvent,
    trigger: string,
  ): void {
    if (!assertAlive("selectHotbarByWheel")) {
      return;
    }

    const startedAtMs = monotonicNowMs();
    try {
      if (!(options.wheelEnabled ?? true)) {
        return;
      }

      const direction = wheelDirectionFromSnapshot(snapshot, event);

      if (direction === 0) {
        return;
      }

      const state = store.peekState();
      const slotCount = readInventorySlotCount(state);
      const currentSlot = normalizeSlot(readCurrentInventorySlot(state), slotCount);
      const nextSlot = findNextHotbarSlot(currentSlot, direction, slotCount);

      if (nextSlot === currentSlot) {
        blockedHotbarSelectCount += 1;
        return;
      }

      wheelHotbarSelectCount += 1;
      selectHotbarSlot(nextSlot, trigger);
      options.onPerformanceEvent?.({
        type: "hotbar-wheel",
        phase: "selection-complete",
        durationMs: Math.max(0, monotonicNowMs() - startedAtMs),
        detail: {
          currentSlot,
          nextSlot,
          direction,
        },
      });
    } catch (error) {
      setError(error);
    }
  }

  function handleKeyboardActionDown(actionKey: KeyboardActionKey): void {
    refreshMovementIntent(`keyboard:${actionKey}`);

    switch (actionKey) {
      case "place":
        void executePlace("keyboard:place");
        return;

      case "remove":
        void executeRemove("keyboard:remove");
        return;

      case "inspect":
        void executeInspect("keyboard:inspect");
        return;

      case "cancel":
        void executeCancel("keyboard:cancel");
        return;

      default: {
        const slot = slotFromKeyboardAction(actionKey);

        if (slot !== null) {
          selectHotbarSlot(slot, `keyboard:${actionKey}`);
        }
      }
    }
  }

  function handleKeyboardActionUp(actionKey: KeyboardActionKey): void {
    refreshMovementIntent(`keyboard-up:${actionKey}`);
  }

  const pointerLockTarget = refs.canvas ?? refs.canvasHost;

  pointerLock = (options.pointerLockEnabled ?? true)
    ? createPointerLock({
        target: pointerLockTarget,
        inputState,
        store,
        logger: logger?.child?.("pointer_lock") ?? logger,
        signal: options.signal,
        enabled,
        requestOnClick: false,
        exitOnDestroy: true,
        unadjustedMovement: false,
        dispatchToStore: options.dispatchToStore ?? true,
      })
    : null;

  const keyboardInput = createKeyboardInput({
    inputState,
    store,
    logger: logger?.child?.("keyboard_input") ?? logger,
    target: typeof window !== "undefined" ? window : refs.root,
    signal: options.signal,
    enabled: enabled && (options.keyboardEnabled ?? true),
    preventDefaultForHandledKeys: options.preventDefault ?? true,
    ignoreEditableTargets: true,
    dispatchToStore: options.dispatchToStore ?? true,
    forwardRepeatedKeyDownToInputState: false,
    onActionKeyDown: (actionKey) => handleKeyboardActionDown(actionKey),
    onActionKeyUp: (actionKey) => handleKeyboardActionUp(actionKey),
    onHotbarSlot: (slot) => selectHotbarSlot(slot, "keyboard:hotbar"),
    onCancel: () => {
      void executeCancel("keyboard:cancel");
    },
  });

  const mouseInput = createMouseInput({
    inputState,
    store,
    logger: logger?.child?.("mouse_input") ?? logger,
    target: refs.canvasHost,
    canvasHost: refs.canvasHost,
    signal: options.signal,
    pointerLock,
    enabled: enabled && (options.mouseEnabled ?? true),
    preventDefault: options.preventDefault ?? true,
    preventContextMenu: true,
    focusOnPointerDown: true,
    capturePointer: pointerLock === null,
    dispatchToStore: options.dispatchToStore ?? true,
    listenOnWindowForPointerUp: true,
    listenOnWindowForPointerMove: true,
    requestPointerLockOnPointerDown:
      options.requestPointerLockOnPointerDown ??
      options.requestPointerLockOnClick ??
      true,
    requirePointerLockForActions: options.requirePointerLockForMouseActions ?? false,
    suppressPrimaryActionOnPointerLockActivation:
      options.suppressPrimaryActionOnPointerLockActivation ?? true,
    suppressClickAfterActivationMs: POINTER_LOCK_ACTIVATION_SUPPRESS_MS,
    onCanvasActivation: () => {
      try {
        focusEditorCanvas(refs);
      } catch {
        // Canvas focus is best-effort.
      }
    },
    onPrimaryDown: () => {
      executePointerAction("place", "mouse:primary-down");
    },
    onPrimaryUp: () => {
      void executeWorldEditRelease("primary-release", "mouse:primary-up");
    },
    onSecondaryDown: () => {
      executePointerAction("remove", "mouse:secondary-down");
    },
    onSecondaryUp: () => {
      void executeWorldEditRelease("secondary-release", "mouse:secondary-up");
    },
    onMiddleDown: () => {
      executePointerAction("inspect", "mouse:middle-down");
    },
    onPointerMove: () => {
      refreshMovementIntent("mouse:pointer-move");
    },
    onWheel: (snapshot, event) => {
      selectHotbarByWheel(snapshot, event, "mouse:wheel");
    },
  });

  const controller: EditorInputControllerHandle = {
    kind: INPUT_CONTROLLER_KIND,

    attach(): void {
      if (!assertAlive("attach")) {
        return;
      }

      if (attached) {
        return;
      }

      try {
        pointerLock?.attach();
        keyboardInput.attach();
        mouseInput.attach();

        attached = true;
        attachCount += 1;
        setStatus(enabled ? "attached" : "disabled");

        logDebug(logger, "Editor input controller attached.", {
          enabled,
          pointerLockEnabled: Boolean(pointerLock),
          pointerLockActivation: pointerLock ? "mouse.pointerdown" : "disabled",
          wheelSelection: options.wheelEnabled ?? true,
          pointerActionPath: "mouse-input-only",
          libraryPlacementContextEnabled: true,
          inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
          duplicateGuardMs: POINTER_ACTION_DUPLICATE_GUARD_MS,
          pointerLockActivationSuppressMs: POINTER_LOCK_ACTIVATION_SUPPRESS_MS,
        });
      } catch (error) {
        setError(error);
      }
    },

    detach(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        mouseInput.detach(reason);
        keyboardInput.detach(reason);
        pointerLock?.detach(reason);

        attached = false;
        detachCount += 1;
        pendingFlightToggleRequested = false;
        pendingJumpRequested = false;
        setStatus(enabled ? "created" : "disabled");
      } catch (error) {
        setError(error);
      }
    },

    enable(reason?: string): void {
      if (!assertAlive("enable")) {
        return;
      }

      try {
        enabled = true;

        inputState.setEnabled({
          keyboard: options.keyboardEnabled ?? true,
          pointer: options.mouseEnabled ?? true,
          wheel: options.wheelEnabled ?? true,
        });

        pointerLock?.enable(reason);
        keyboardInput.enable(reason);
        mouseInput.enable(reason);

        setStatus(attached ? "attached" : "created");
      } catch (error) {
        setError(error);
      }
    },

    disable(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        enabled = false;
        pendingFlightToggleRequested = false;
        pendingJumpRequested = false;

        mouseInput.disable(reason);
        keyboardInput.disable(reason);
        pointerLock?.disable(reason);

        inputState.setEnabled({
          keyboard: false,
          pointer: false,
          wheel: false,
        });

        setStatus("disabled");
      } catch (error) {
        setError(error);
      }
    },

    getInputState(): InputStateHandle {
      return inputState;
    },

    getKeyboardInput(): KeyboardInputHandle {
      return keyboardInput;
    },

    getMouseInput(): MouseInputHandle {
      return mouseInput;
    },

    getPointerLock(): PointerLockHandle | null {
      return pointerLock;
    },

    requestPointerLock,
    exitPointerLock,

    getMovementIntent(): EditorInputMovementIntent {
      const freshIntent = movementIntentFromSnapshot(inputState.getSnapshot(), {
        doubleTapDetector: null,
        consumeDoubleTap: false,
      });

      // A held Space key behaves like Hytale: jump immediately and request the
      // next jump again as soon as the collision solver reports grounded.
      // The physics controller only applies this flag while grounded, so it is
      // safe to keep it true during the airborne part of the jump.
      const jumpPressed =
        pendingJumpRequested || freshIntent.jumpPressed || freshIntent.jump;
      const toggleFlightRequested = pendingFlightToggleRequested;
      pendingJumpRequested = false;
      pendingFlightToggleRequested = false;

      const jumpIntent = setMovementIntentJumpPressed(freshIntent, jumpPressed);
      const consumedIntent = setMovementIntentFlightToggle(
        jumpIntent,
        toggleFlightRequested,
      );
      lastMovementIntent = setMovementIntentFlightToggle(
        setMovementIntentJumpPressed(freshIntent, false),
        false,
      );

      return consumedIntent;
    },

    clear(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        pendingFlightToggleRequested = false;
        pendingJumpRequested = false;
        lastPlacementContext = null;
        lastBlockedReason = null;
        setPlacementDataset(refs, null);
        keyboardInput.clear(reason);
        mouseInput.clear(reason);
        inputState.resetDeltas();
        lastMovementIntent = movementIntentFromSnapshot(inputState.getSnapshot(), {
          doubleTapDetector: null,
          consumeDoubleTap: false,
        });
        refreshMovementIntent(reason ?? "input-controller.clear");
      } catch (error) {
        setError(error);
      }
    },

    getStatus(): EditorInputControllerStatus {
      return status;
    },

    getSnapshot(): EditorInputControllerSnapshot {
      return {
        kind: INPUT_CONTROLLER_SNAPSHOT_KIND,
        status,
        enabled,
        attached,
        destroyed,
        createdAt,
        updatedAt,
        destroyedAt,
        attachCount,
        detachCount,
        placeIntentCount,
        removeIntentCount,
        inspectIntentCount,
        cancelIntentCount,
        blockedPlaceIntentCount,
        blockedRemoveIntentCount,
        dedupedPointerActionCount,
        hotbarSelectCount,
        blockedHotbarSelectCount,
        wheelHotbarSelectCount,
        movementIntentCount,
        flightToggleIntentCount,
        pointerLockRequestCount,
        pointerLockExitCount,
        lastTrigger,
        lastBlockedReason,
        lastPlacementContext,
        lastMovementIntent: setMovementIntentFlightToggle(
          pendingJumpRequested
            ? setMovementIntentJumpPressed(lastMovementIntent, true)
            : lastMovementIntent,
          pendingFlightToggleRequested,
        ),
        lastError,
        input: inputState.getSnapshot(),
        keyboard: keyboardInput.getSnapshot(),
        mouse: mouseInput.getSnapshot(),
        pointerLock: pointerLock?.getSnapshot() ?? null,
      };
    },

    async destroy(reason?: string): Promise<void> {
      if (destroyed) {
        return;
      }

      destroyed = true;
      destroyedAt = now();
      pendingFlightToggleRequested = false;
      pendingJumpRequested = false;

      try {
        mouseInput.destroy(reason ?? "input-controller.destroy");
      } catch {
        // Continue destroy chain.
      }

      try {
        keyboardInput.destroy(reason ?? "input-controller.destroy");
      } catch {
        // Continue destroy chain.
      }

      try {
        await pointerLock?.destroy(reason ?? "input-controller.destroy");
      } catch {
        // Continue destroy chain.
      }

      try {
        inputState.destroy(reason ?? "input-controller.destroy");
      } catch {
        // Continue destroy chain.
      }

      attached = false;
      setStatus("destroyed");

      logDebug(logger, "Editor input controller destroyed.", {
        reason: reason ?? null,
        placeIntentCount,
        removeIntentCount,
        blockedPlaceIntentCount,
        blockedRemoveIntentCount,
        blockedHotbarSelectCount,
        dedupedPointerActionCount,
        inputState: inputSnapshotToDebugSummary(inputState.getSnapshot()),
      });
    },
  };

  if (options.signal) {
    try {
      if (options.signal.aborted) {
        void controller.destroy("abort-signal-already-aborted");
      } else {
        options.signal.addEventListener(
          "abort",
          () => {
            void controller.destroy("abort-signal");
          },
          {
            once: true,
          },
        );
      }
    } catch {
      // Abort wiring is best-effort.
    }
  }

  if (safeBoolean(options.autoAttach, true)) {
    controller.attach();
  }

  return controller;
}

export function isEditorInputControllerHandle(
  value: unknown,
): value is EditorInputControllerHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<EditorInputControllerHandle>;

    return (
      record.kind === INPUT_CONTROLLER_KIND &&
      typeof record.attach === "function" &&
      typeof record.getInputState === "function" &&
      typeof record.requestPointerLock === "function" &&
      typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}

export function getInputControllerMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.input.input_controller",
    controllerKind: INPUT_CONTROLLER_KIND,
    snapshotKind: INPUT_CONTROLLER_SNAPSHOT_KIND,
    supportsLibraryPlacementContext: true,
    supportsRuntimeBlockTypePlacement: true,
    pointerActionDedupMs: POINTER_ACTION_DUPLICATE_GUARD_MS,
    pointerLockActivationSuppressMs: POINTER_LOCK_ACTIVATION_SUPPRESS_MS,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    contract: getEditorInventoryContractMetadata(),
    diagnostics: editorInventoryContractDiagnostics({
      sourceKind: "editor-inventory",
      runtimeBlockTypeId: null,
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    }),
    rules: {
      ...editorInventoryContractRules(),
      placeRequiresPlacementCell: true,
      placeRequiresLibraryIdentity: true,
      placeRequiresRuntimeBlockTypeId: true,
      removeRequiresSourceCell: true,
      blockTypeIdIsRuntimeBlockTypeAlias: true,
      hotbarSelectionAllowsEmptySlots: true,
      wheelSelectionSkipsEmptySlots: false,
      debugGrassDirtBlocked: true,
      onePointerActionPerPhysicalClick: true,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
      placementContextComesFromCentralContract: true,
      avoidsNegativeTypeGuardNeverNarrowing: true,
      pointerLockAssignedOnce: true,
    },
  };
}
