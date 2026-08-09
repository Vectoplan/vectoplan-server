// src/frontend/input/input_state.ts
import type { EditorPointerButton } from "@state/editor_state";
import {
  normalizeUnknownError,
  safeBoolean,
  safeInteger,
  safeNumber,
  safeString,
  uniqueStrings,
} from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type InputDeviceKind =
  | "keyboard"
  | "mouse"
  | "pointer"
  | "wheel"
  | "touch"
  | "unknown";

export type InputPhase =
  | "idle"
  | "active"
  | "dragging"
  | "locked"
  | "disabled"
  | "failed";

export type KeyboardActionKey =
  | "move-forward"
  | "move-backward"
  | "move-left"
  | "move-right"
  | "move-up"
  | "move-down"
  | "sprint"
  | "jump"
  | "crouch"
  | "place"
  | "remove"
  | "inspect"
  | "cancel"
  | "hotbar-1"
  | "hotbar-2"
  | "hotbar-3"
  | "hotbar-4"
  | "hotbar-5"
  | "hotbar-6"
  | "hotbar-7"
  | "hotbar-8"
  | "hotbar-9"
  | "unknown";

export interface PointerPosition {
  readonly x: number;
  readonly y: number;
  readonly normalizedX: number;
  readonly normalizedY: number;
}

export interface PointerDelta {
  readonly x: number;
  readonly y: number;
}

export interface WheelDelta {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface InputModifiers {
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
}

export interface KeyboardEdgeState {
  readonly key: string | null;
  readonly code: string | null;
  readonly token: string | null;
  readonly actionKey: KeyboardActionKey | null;
  readonly timestamp: string | null;
  readonly repeat: boolean;
  readonly pressId: string | null;
  readonly sequence: number;
}

export interface KeyboardInputSnapshot {
  readonly enabled: boolean;
  readonly pressedKeys: readonly string[];
  readonly pressedActionKeys: readonly KeyboardActionKey[];
  readonly lastKey: string | null;
  readonly lastCode: string | null;
  readonly lastActionKey: KeyboardActionKey | null;
  readonly lastKeyDownAt: string | null;
  readonly lastKeyUpAt: string | null;
  readonly lastKeyRepeat: boolean;
  readonly modifiers: InputModifiers;

  /**
   * Frame/edge data.
   *
   * These fields are intentionally reset by resetDeltas().
   * They let higher layers distinguish:
   * - key is held
   * - key was newly pressed in this frame
   * - key was released in this frame
   *
   * Physics uses these for jump and double-Space flight toggle.
   */
  readonly keyDownEdge: KeyboardEdgeState | null;
  readonly keyUpEdge: KeyboardEdgeState | null;
  readonly pressedThisFrameActionKeys: readonly KeyboardActionKey[];
  readonly releasedThisFrameActionKeys: readonly KeyboardActionKey[];
  readonly spacePressedThisFrame: boolean;
  readonly spaceReleasedThisFrame: boolean;
  readonly jumpPressedThisFrame: boolean;
  readonly ascendHeld: boolean;
  readonly descendHeld: boolean;
  readonly sprintHeld: boolean;
  readonly keySequence: number;
}

export interface PointerInputSnapshot {
  readonly enabled: boolean;
  readonly pointerLocked: boolean;
  readonly pointerLockAvailable: boolean;
  readonly pointerLockChangeCount: number;
  readonly lastPointerLockChangeAt: string | null;
  readonly pressedButtons: readonly EditorPointerButton[];
  readonly lastButton: EditorPointerButton | null;
  readonly position: PointerPosition;
  readonly previousPosition: PointerPosition | null;

  /**
   * Raw pointer delta for the last pointer move.
   * With pointer lock this should be read from movementX/movementY.
   */
  readonly delta: PointerDelta;

  /**
   * Explicit camera-look delta. It mirrors delta for now, but gives the camera
   * layer a stable field that remains valid if pointer and UI cursor handling
   * diverge later.
   */
  readonly lookDelta: PointerDelta;

  readonly accumulatedDelta: PointerDelta;
  readonly accumulatedLookDelta: PointerDelta;
  readonly lastPointerDownAt: string | null;
  readonly lastPointerUpAt: string | null;
  readonly lastPointerMoveAt: string | null;
  readonly lastClickAt: string | null;
  readonly modifiers: InputModifiers;
}

export interface WheelInputSnapshot {
  readonly enabled: boolean;
  readonly delta: WheelDelta;
  readonly accumulatedDelta: WheelDelta;
  readonly lastWheelAt: string | null;
  readonly modifiers: InputModifiers;
}

export interface InputStateSnapshot {
  readonly kind: "input-state-snapshot.v1";
  readonly phase: InputPhase;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly keyboard: KeyboardInputSnapshot;
  readonly pointer: PointerInputSnapshot;
  readonly wheel: WheelInputSnapshot;
  readonly lastDeviceKind: InputDeviceKind;
  readonly lastResetReason: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface CreateInputStateOptions {
  readonly keyboardEnabled?: boolean;
  readonly mouseEnabled?: boolean;
  readonly wheelEnabled?: boolean;
  readonly pointerLockEnabled?: boolean;
  readonly canvasWidth?: number;
  readonly canvasHeight?: number;
}

export interface InputStateUpdateOptions {
  readonly timestamp?: string;
  readonly canvasWidth?: number;
  readonly canvasHeight?: number;
}

export interface KeyboardEventLike {
  readonly key?: string;
  readonly code?: string;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly repeat?: boolean;
}

export interface PointerEventLike {
  readonly button?: number;
  readonly buttons?: number;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly movementX?: number;
  readonly movementY?: number;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
}

export interface WheelEventLike extends PointerEventLike {
  readonly deltaX?: number;
  readonly deltaY?: number;
  readonly deltaZ?: number;
}

export interface InputStateHandle {
  readonly kind: "vectoplan-editor-input-state.v1";

  getSnapshot(): InputStateSnapshot;
  getPhase(): InputPhase;

  setEnabled(input: {
    readonly keyboard?: boolean;
    readonly pointer?: boolean;
    readonly wheel?: boolean;
  }): InputStateSnapshot;

  setPointerLock(locked: boolean, available?: boolean): InputStateSnapshot;

  keyDown(event: KeyboardEventLike, options?: InputStateUpdateOptions): InputStateSnapshot;
  keyUp(event: KeyboardEventLike, options?: InputStateUpdateOptions): InputStateSnapshot;
  clearKeys(): InputStateSnapshot;

  pointerDown(event: PointerEventLike, options?: InputStateUpdateOptions): InputStateSnapshot;
  pointerUp(event: PointerEventLike, options?: InputStateUpdateOptions): InputStateSnapshot;
  pointerMove(event: PointerEventLike, options?: InputStateUpdateOptions): InputStateSnapshot;
  pointerClick(event: PointerEventLike, options?: InputStateUpdateOptions): InputStateSnapshot;
  clearPointerButtons(): InputStateSnapshot;

  wheel(event: WheelEventLike, options?: InputStateUpdateOptions): InputStateSnapshot;

  resetDeltas(): InputStateSnapshot;
  resetKeyboardEdges(): InputStateSnapshot;
  resetAll(reason?: string): InputStateSnapshot;

  destroy(reason?: string): void;
}

const INPUT_STATE_KIND = "vectoplan-editor-input-state.v1" as const;
const INPUT_STATE_SNAPSHOT_KIND = "input-state-snapshot.v1" as const;

const DEFAULT_CANVAS_WIDTH = 1;
const DEFAULT_CANVAS_HEIGHT = 1;

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
        message: "Unknown input state error.",
      };
    }
  }
}

function nullableString(value: unknown, fallback: string | null = null): string | null {
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

function normalizeTimestamp(value: unknown): string {
  try {
    const normalized = safeString(value, "").trim();
    return normalized.length > 0 ? normalized : now();
  } catch {
    return now();
  }
}

function normalizeCanvasSize(options?: InputStateUpdateOptions): {
  readonly width: number;
  readonly height: number;
} {
  try {
    return {
      width: safeInteger(options?.canvasWidth, DEFAULT_CANVAS_WIDTH, {
        min: 1,
        max: 100_000,
      }),
      height: safeInteger(options?.canvasHeight, DEFAULT_CANVAS_HEIGHT, {
        min: 1,
        max: 100_000,
      }),
    };
  } catch {
    return {
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
    };
  }
}

function createZeroPointerPosition(): PointerPosition {
  return {
    x: 0,
    y: 0,
    normalizedX: 0,
    normalizedY: 0,
  };
}

function normalizePointerPosition(
  event: PointerEventLike,
  options?: InputStateUpdateOptions,
): PointerPosition {
  try {
    const size = normalizeCanvasSize(options);
    const x = safeNumber(event.clientX, 0);
    const y = safeNumber(event.clientY, 0);

    return {
      x,
      y,
      normalizedX: size.width > 0 ? (x / size.width) * 2 - 1 : 0,
      normalizedY: size.height > 0 ? -((y / size.height) * 2 - 1) : 0,
    };
  } catch {
    return createZeroPointerPosition();
  }
}

function createZeroDelta(): PointerDelta {
  return {
    x: 0,
    y: 0,
  };
}

function createZeroWheelDelta(): WheelDelta {
  return {
    x: 0,
    y: 0,
    z: 0,
  };
}

function normalizeModifiers(event: KeyboardEventLike | PointerEventLike | WheelEventLike | null | undefined): InputModifiers {
  try {
    return {
      alt: safeBoolean(event?.altKey, false),
      ctrl: safeBoolean(event?.ctrlKey, false),
      meta: safeBoolean(event?.metaKey, false),
      shift: safeBoolean(event?.shiftKey, false),
    };
  } catch {
    return {
      alt: false,
      ctrl: false,
      meta: false,
      shift: false,
    };
  }
}

function normalizeKey(value: unknown): string {
  try {
    if (typeof value !== "string") {
      return "";
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : "";
  } catch {
    return "";
  }
}

function normalizeCode(value: unknown): string {
  return normalizeKey(value);
}

function isSpaceKey(key: string, code: string): boolean {
  try {
    const normalizedKey = key.toLowerCase();
    const normalizedCode = code.toLowerCase();

    return normalizedKey === " " || normalizedKey === "space" || normalizedCode === "space";
  } catch {
    return false;
  }
}

function isRepeatEvent(event: KeyboardEventLike): boolean {
  try {
    return safeBoolean(event.repeat, false);
  } catch {
    return false;
  }
}

function keyToActionKey(key: string, code: string): KeyboardActionKey {
  try {
    const normalizedKey = key.toLowerCase();
    const normalizedCode = code.toLowerCase();

    /**
     * Semantic movement intent convention:
     * W/ArrowUp    => move-forward
     * S/ArrowDown  => move-backward
     * A/ArrowLeft  => move-left
     * D/ArrowRight => move-right
     *
     * Input only records intent. Camera/physics decides the final world sign.
     */
    if (normalizedKey === "w" || normalizedCode === "keyw" || normalizedKey === "arrowup" || normalizedCode === "arrowup") return "move-forward";
    if (normalizedKey === "s" || normalizedCode === "keys" || normalizedKey === "arrowdown" || normalizedCode === "arrowdown") return "move-backward";
    if (normalizedKey === "a" || normalizedCode === "keya" || normalizedKey === "arrowleft" || normalizedCode === "arrowleft") return "move-left";
    if (normalizedKey === "d" || normalizedCode === "keyd" || normalizedKey === "arrowright" || normalizedCode === "arrowright") return "move-right";

    /**
     * Space intentionally maps to jump.
     * The physics bridge can interpret:
     * - jumpPressedThisFrame for ground jump
     * - spacePressedThisFrame for double-tap flight toggle
     * - ascendHeld for flight ascend
     */
    if (isSpaceKey(key, code)) return "jump";

    /**
     * Q activates sprint; Shift descends while flying.
     */
    if (normalizedKey === "q" || normalizedCode === "keyq") return "sprint";
    if (normalizedKey === "shift" || normalizedCode === "shiftleft" || normalizedCode === "shiftright") return "move-down";
    if (normalizedKey === "control" || normalizedCode === "controlleft" || normalizedCode === "controlright") return "crouch";

    if (normalizedKey === "escape" || normalizedCode === "escape") return "cancel";
    if (normalizedKey === "f" || normalizedCode === "keyf") return "inspect";
    if (normalizedKey === "enter" || normalizedCode === "enter") return "place";
    if (normalizedKey === "backspace" || normalizedKey === "delete" || normalizedCode === "backspace" || normalizedCode === "delete") return "remove";

    if (/^[1-9]$/.test(normalizedKey)) {
      return `hotbar-${normalizedKey}` as KeyboardActionKey;
    }

    if (/^digit[1-9]$/.test(normalizedCode)) {
      return `hotbar-${normalizedCode.replace("digit", "")}` as KeyboardActionKey;
    }

    if (/^numpad[1-9]$/.test(normalizedCode)) {
      return `hotbar-${normalizedCode.replace("numpad", "")}` as KeyboardActionKey;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeButton(value: unknown): EditorPointerButton {
  try {
    const button = safeInteger(value, -1);

    if (button === 0) return "primary";
    if (button === 1) return "middle";
    if (button === 2) return "secondary";

    return "unknown";
  } catch {
    return "unknown";
  }
}

function buttonsFromEvent(event: PointerEventLike): readonly EditorPointerButton[] {
  try {
    const buttons = safeInteger(event.buttons, 0, {
      min: 0,
      max: 31,
    });
    const result: EditorPointerButton[] = [];

    if ((buttons & 1) === 1) result.push("primary");
    if ((buttons & 2) === 2) result.push("secondary");
    if ((buttons & 4) === 4) result.push("middle");

    if (result.length === 0) {
      const single = normalizeButton(event.button);
      if (single !== "unknown") result.push(single);
    }

    return result;
  } catch {
    return [];
  }
}

function normalizePointerButtons(buttons: readonly unknown[]): readonly EditorPointerButton[] {
  try {
    const valid: EditorPointerButton[] = [];

    for (const button of buttons) {
      if (
        button === "primary"
        || button === "secondary"
        || button === "middle"
        || button === "unknown"
      ) {
        if (!valid.includes(button)) {
          valid.push(button);
        }
      }
    }

    return valid.filter((button) => button !== "unknown");
  } catch {
    return [];
  }
}

function mergeButton(buttons: readonly EditorPointerButton[], button: EditorPointerButton): readonly EditorPointerButton[] {
  try {
    if (button === "unknown") {
      return buttons;
    }

    return normalizePointerButtons([...buttons, button]);
  } catch {
    return [];
  }
}

function removeButton(buttons: readonly EditorPointerButton[], button: EditorPointerButton): readonly EditorPointerButton[] {
  try {
    if (button === "unknown") {
      return buttons;
    }

    return buttons.filter((item) => item !== button);
  } catch {
    return [];
  }
}

function createEmptyKeyboardEdgeState(sequence = 0): KeyboardEdgeState {
  return {
    key: null,
    code: null,
    token: null,
    actionKey: null,
    timestamp: null,
    repeat: false,
    pressId: null,
    sequence,
  };
}

function createKeyboardEdgeState(input: {
  readonly key: string;
  readonly code: string;
  readonly token: string;
  readonly actionKey: KeyboardActionKey;
  readonly timestamp: string;
  readonly repeat: boolean;
  readonly sequence: number;
}): KeyboardEdgeState {
  try {
    const key = normalizeKey(input.key);
    const code = normalizeCode(input.code);
    const token = normalizeKey(input.token);
    const timestamp = normalizeTimestamp(input.timestamp);
    const sequence = safeInteger(input.sequence, 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });

    return {
      key: key || null,
      code: code || null,
      token: token || null,
      actionKey: input.actionKey === "unknown" ? null : input.actionKey,
      timestamp,
      repeat: safeBoolean(input.repeat, false),
      pressId: createKeyboardPressId({
        token,
        actionKey: input.actionKey,
        timestamp,
        sequence,
      }),
      sequence,
    };
  } catch {
    return createEmptyKeyboardEdgeState(input.sequence);
  }
}

function createKeyboardPressId(input: {
  readonly token: string;
  readonly actionKey: KeyboardActionKey;
  readonly timestamp: string;
  readonly sequence: number;
}): string {
  try {
    const token = normalizeKey(input.token) || "unknown-token";
    const actionKey = input.actionKey || "unknown";
    const timestamp = safeString(input.timestamp, now());

    return `${actionKey}:${token}:${timestamp}:${input.sequence}`;
  } catch {
    return `unknown:${Date.now()}:0`;
  }
}

function createInitialKeyboard(enabled: boolean): KeyboardInputSnapshot {
  return {
    enabled,
    pressedKeys: [],
    pressedActionKeys: [],
    lastKey: null,
    lastCode: null,
    lastActionKey: null,
    lastKeyDownAt: null,
    lastKeyUpAt: null,
    lastKeyRepeat: false,
    modifiers: {
      alt: false,
      ctrl: false,
      meta: false,
      shift: false,
    },
    keyDownEdge: null,
    keyUpEdge: null,
    pressedThisFrameActionKeys: [],
    releasedThisFrameActionKeys: [],
    spacePressedThisFrame: false,
    spaceReleasedThisFrame: false,
    jumpPressedThisFrame: false,
    ascendHeld: false,
    descendHeld: false,
    sprintHeld: false,
    keySequence: 0,
  };
}

function createInitialPointer(enabled: boolean, pointerLockAvailable: boolean): PointerInputSnapshot {
  return {
    enabled,
    pointerLocked: false,
    pointerLockAvailable,
    pointerLockChangeCount: 0,
    lastPointerLockChangeAt: null,
    pressedButtons: [],
    lastButton: null,
    position: createZeroPointerPosition(),
    previousPosition: null,
    delta: createZeroDelta(),
    lookDelta: createZeroDelta(),
    accumulatedDelta: createZeroDelta(),
    accumulatedLookDelta: createZeroDelta(),
    lastPointerDownAt: null,
    lastPointerUpAt: null,
    lastPointerMoveAt: null,
    lastClickAt: null,
    modifiers: {
      alt: false,
      ctrl: false,
      meta: false,
      shift: false,
    },
  };
}

function createInitialWheel(enabled: boolean): WheelInputSnapshot {
  return {
    enabled,
    delta: createZeroWheelDelta(),
    accumulatedDelta: createZeroWheelDelta(),
    lastWheelAt: null,
    modifiers: {
      alt: false,
      ctrl: false,
      meta: false,
      shift: false,
    },
  };
}

function normalizePressedKeys(keys: readonly string[]): readonly string[] {
  try {
    return uniqueStrings(
      keys
        .map((key) => normalizeKey(key))
        .filter((key) => key.length > 0),
    );
  } catch {
    return [];
  }
}

function actionKeysFromPressedKeys(keys: readonly string[]): readonly KeyboardActionKey[] {
  try {
    const actions: KeyboardActionKey[] = [];

    for (const key of keys) {
      const action = keyToActionKey(key, key);

      if (action !== "unknown" && !actions.includes(action)) {
        actions.push(action);
      }
    }

    return actions;
  } catch {
    return [];
  }
}

function addActionKey(keys: readonly KeyboardActionKey[], actionKey: KeyboardActionKey): readonly KeyboardActionKey[] {
  try {
    if (actionKey === "unknown" || keys.includes(actionKey)) {
      return keys;
    }

    return uniqueStrings([...keys, actionKey]) as readonly KeyboardActionKey[];
  } catch {
    return keys;
  }
}

function addFrameActionKey(keys: readonly KeyboardActionKey[], actionKey: KeyboardActionKey): readonly KeyboardActionKey[] {
  try {
    if (actionKey === "unknown" || keys.includes(actionKey)) {
      return keys;
    }

    return [...keys, actionKey];
  } catch {
    return keys;
  }
}

function shouldBeActive(keyboard: KeyboardInputSnapshot, pointer: PointerInputSnapshot): boolean {
  try {
    return keyboard.pressedKeys.length > 0 || pointer.pressedButtons.length > 0 || pointer.pointerLocked;
  } catch {
    return false;
  }
}

function phaseFromState(
  keyboard: KeyboardInputSnapshot,
  pointer: PointerInputSnapshot,
  wheel: WheelInputSnapshot,
): InputPhase {
  try {
    if (!keyboard.enabled && !pointer.enabled && !wheel.enabled) {
      return "disabled";
    }

    if (pointer.pointerLocked) {
      return "locked";
    }

    if (pointer.pressedButtons.length > 0) {
      return "dragging";
    }

    if (keyboard.pressedKeys.length > 0) {
      return "active";
    }

    return "idle";
  } catch {
    return "failed";
  }
}

function keyTokenFromEvent(key: string, code: string): string {
  try {
    return code || key;
  } catch {
    return "";
  }
}

function tokensMatch(left: string, right: string): boolean {
  try {
    return left.toLowerCase() === right.toLowerCase();
  } catch {
    return left === right;
  }
}

function removeKeyToken(
  keys: readonly string[],
  key: string,
  code: string,
): readonly string[] {
  try {
    return normalizePressedKeys(
      keys.filter((item) => {
        if (key && tokensMatch(item, key)) {
          return false;
        }

        if (code && tokensMatch(item, code)) {
          return false;
        }

        return true;
      }),
    );
  } catch {
    return [];
  }
}

function pointerDeltaFromEvent(
  event: PointerEventLike,
  previousPosition: PointerPosition,
  position: PointerPosition,
): PointerDelta {
  try {
    const hasMovementX = typeof event.movementX === "number" && Number.isFinite(event.movementX);
    const hasMovementY = typeof event.movementY === "number" && Number.isFinite(event.movementY);
    const positionDeltaX = position.x - previousPosition.x;
    const positionDeltaY = position.y - previousPosition.y;
    const movementX = hasMovementX ? safeNumber(event.movementX, 0) : positionDeltaX;
    const movementY = hasMovementY ? safeNumber(event.movementY, 0) : positionDeltaY;

    return {
      // Some browsers and automation surfaces expose finite movementX/Y but
      // keep them at zero outside Pointer Lock. In that case the canvas-space
      // position delta is the only truthful drag signal. Pointer Lock itself
      // keeps client coordinates stationary, so its real movement values keep
      // winning whenever they are non-zero.
      x: movementX !== 0 || positionDeltaX === 0 ? movementX : positionDeltaX,
      y: movementY !== 0 || positionDeltaY === 0 ? movementY : positionDeltaY,
    };
  } catch {
    return createZeroDelta();
  }
}

function accumulateDelta(previous: PointerDelta, next: PointerDelta): PointerDelta {
  try {
    return {
      x: previous.x + next.x,
      y: previous.y + next.y,
    };
  } catch {
    return previous;
  }
}

function accumulateWheelDelta(previous: WheelDelta, next: WheelDelta): WheelDelta {
  try {
    return {
      x: previous.x + next.x,
      y: previous.y + next.y,
      z: previous.z + next.z,
    };
  } catch {
    return previous;
  }
}

function clearKeyboardEdges(keyboard: KeyboardInputSnapshot): KeyboardInputSnapshot {
  try {
    return {
      ...keyboard,
      keyDownEdge: null,
      keyUpEdge: null,
      pressedThisFrameActionKeys: [],
      releasedThisFrameActionKeys: [],
      spacePressedThisFrame: false,
      spaceReleasedThisFrame: false,
      jumpPressedThisFrame: false,
    };
  } catch {
    return keyboard;
  }
}

function refreshKeyboardHoldFlags(keyboard: KeyboardInputSnapshot): KeyboardInputSnapshot {
  try {
    const pressedActionKeys = actionKeysFromPressedKeys(keyboard.pressedKeys);

    return {
      ...keyboard,
      pressedActionKeys,
      ascendHeld: pressedActionKeys.includes("jump") || pressedActionKeys.includes("move-up"),
      descendHeld: pressedActionKeys.includes("move-down"),
      sprintHeld: pressedActionKeys.includes("sprint"),
    };
  } catch {
    return keyboard;
  }
}

export function createInputState(options?: CreateInputStateOptions): InputStateHandle {
  const createdAt = now();

  let phase: InputPhase = "idle";
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let lastDeviceKind: InputDeviceKind = "unknown";
  let lastResetReason: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  let keyboard = createInitialKeyboard(options?.keyboardEnabled ?? true);
  let pointer = createInitialPointer(
    options?.mouseEnabled ?? true,
    options?.pointerLockEnabled ?? true,
  );
  let wheelState = createInitialWheel(options?.wheelEnabled ?? true);
  let destroyed = false;

  function assertAlive(action: string): void {
    if (destroyed) {
      throw new Error(`InputState is destroyed. Action '${action}' is not allowed.`);
    }
  }

  function setPhase(nextPhase: InputPhase): void {
    try {
      phase = nextPhase;
      updatedAt = now();
    } catch {
      phase = nextPhase;
    }
  }

  function updatePhaseFromState(): void {
    setPhase(phaseFromState(keyboard, pointer, wheelState));
  }

  function snapshot(): InputStateSnapshot {
    return {
      kind: INPUT_STATE_SNAPSHOT_KIND,
      phase,
      createdAt,
      updatedAt,
      destroyedAt,
      keyboard,
      pointer,
      wheel: wheelState,
      lastDeviceKind,
      lastResetReason,
      lastError,
    };
  }

  function resetKeyboardEdges(): InputStateSnapshot {
    try {
      if (destroyed) {
        return snapshot();
      }

      keyboard = clearKeyboardEdges(keyboard);
      updatedAt = now();
      lastResetReason = "keyboard-edges";
      updatePhaseFromState();
    } catch (error) {
      lastError = normalizeErrorRecord(error);
      setPhase("failed");
    }

    return snapshot();
  }

  function resetDeltas(): InputStateSnapshot {
    try {
      if (destroyed) {
        return snapshot();
      }

      pointer = {
        ...pointer,
        delta: createZeroDelta(),
        lookDelta: createZeroDelta(),
        accumulatedDelta: createZeroDelta(),
        accumulatedLookDelta: createZeroDelta(),
      };
      wheelState = {
        ...wheelState,
        delta: createZeroWheelDelta(),
        accumulatedDelta: createZeroWheelDelta(),
      };
      keyboard = clearKeyboardEdges(keyboard);
      updatedAt = now();
      lastResetReason = "deltas";
      updatePhaseFromState();
    } catch (error) {
      lastError = normalizeErrorRecord(error);
      setPhase("failed");
    }

    return snapshot();
  }

  const handle: InputStateHandle = {
    kind: INPUT_STATE_KIND,

    getSnapshot(): InputStateSnapshot {
      return snapshot();
    },

    getPhase(): InputPhase {
      return phase;
    },

    setEnabled(input: {
      readonly keyboard?: boolean;
      readonly pointer?: boolean;
      readonly wheel?: boolean;
    }): InputStateSnapshot {
      if (destroyed) {
        return snapshot();
      }

      try {
        keyboard = refreshKeyboardHoldFlags({
          ...keyboard,
          enabled: input.keyboard ?? keyboard.enabled,
          pressedKeys: input.keyboard === false ? [] : keyboard.pressedKeys,
          pressedActionKeys: input.keyboard === false ? [] : keyboard.pressedActionKeys,
          keyDownEdge: input.keyboard === false ? null : keyboard.keyDownEdge,
          keyUpEdge: input.keyboard === false ? null : keyboard.keyUpEdge,
          pressedThisFrameActionKeys: input.keyboard === false ? [] : keyboard.pressedThisFrameActionKeys,
          releasedThisFrameActionKeys: input.keyboard === false ? [] : keyboard.releasedThisFrameActionKeys,
          spacePressedThisFrame: input.keyboard === false ? false : keyboard.spacePressedThisFrame,
          spaceReleasedThisFrame: input.keyboard === false ? false : keyboard.spaceReleasedThisFrame,
          jumpPressedThisFrame: input.keyboard === false ? false : keyboard.jumpPressedThisFrame,
        });
        pointer = {
          ...pointer,
          enabled: input.pointer ?? pointer.enabled,
          pressedButtons: input.pointer === false ? [] : pointer.pressedButtons,
          delta: input.pointer === false ? createZeroDelta() : pointer.delta,
          lookDelta: input.pointer === false ? createZeroDelta() : pointer.lookDelta,
        };
        wheelState = {
          ...wheelState,
          enabled: input.wheel ?? wheelState.enabled,
          delta: input.wheel === false ? createZeroWheelDelta() : wheelState.delta,
        };

        lastResetReason = null;
        updatePhaseFromState();
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    setPointerLock(locked: boolean, available?: boolean): InputStateSnapshot {
      if (destroyed) {
        return snapshot();
      }

      try {
        const nextLocked = safeBoolean(locked, false);
        const previousLocked = pointer.pointerLocked;
        const changed = previousLocked !== nextLocked;
        const timestamp = now();

        pointer = {
          ...pointer,
          pointerLocked: nextLocked,
          pointerLockAvailable: available ?? pointer.pointerLockAvailable,
          pointerLockChangeCount: changed ? pointer.pointerLockChangeCount + 1 : pointer.pointerLockChangeCount,
          lastPointerLockChangeAt: changed ? timestamp : pointer.lastPointerLockChangeAt,
          pressedButtons: nextLocked ? [] : pointer.pressedButtons,
          previousPosition: nextLocked ? null : pointer.previousPosition,
          delta: createZeroDelta(),
          lookDelta: createZeroDelta(),
        };

        updatedAt = timestamp;
        updatePhaseFromState();
        lastDeviceKind = "pointer";
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    keyDown(event: KeyboardEventLike, updateOptions?: InputStateUpdateOptions): InputStateSnapshot {
      try {
        assertAlive("keyDown");

        if (!keyboard.enabled) {
          return snapshot();
        }

        const key = normalizeKey(event.key);
        const code = normalizeCode(event.code);
        const actionKey = keyToActionKey(key, code);
        const repeat = isRepeatEvent(event);
        const timestamp = normalizeTimestamp(updateOptions?.timestamp);
        const pressedKeyToken = keyTokenFromEvent(key, code);
        const alreadyPressed = keyboard.pressedKeys.some((item) => tokensMatch(item, pressedKeyToken));
        const shouldCreateEdge = !repeat && !alreadyPressed && actionKey !== "unknown";
        const nextSequence = shouldCreateEdge ? keyboard.keySequence + 1 : keyboard.keySequence;

        const pressedKeys = normalizePressedKeys(
          pressedKeyToken.length > 0 ? [...keyboard.pressedKeys, pressedKeyToken] : keyboard.pressedKeys,
        );
        const derivedActionKeys = actionKeysFromPressedKeys(pressedKeys);
        const pressedActionKeys = addActionKey(derivedActionKeys, actionKey);

        const keyDownEdge = shouldCreateEdge
          ? createKeyboardEdgeState({
              key,
              code,
              token: pressedKeyToken,
              actionKey,
              timestamp,
              repeat,
              sequence: nextSequence,
            })
          : null;

        const spacePressedThisFrame = shouldCreateEdge && isSpaceKey(key, code);
        const jumpPressedThisFrame = shouldCreateEdge && actionKey === "jump";

        keyboard = refreshKeyboardHoldFlags({
          ...keyboard,
          pressedKeys,
          pressedActionKeys,
          lastKey: key || keyboard.lastKey,
          lastCode: code || keyboard.lastCode,
          lastActionKey: actionKey,
          lastKeyDownAt: timestamp,
          lastKeyRepeat: repeat,
          modifiers: normalizeModifiers(event),
          keyDownEdge,
          keyUpEdge: null,
          pressedThisFrameActionKeys: shouldCreateEdge
            ? addFrameActionKey(keyboard.pressedThisFrameActionKeys, actionKey)
            : keyboard.pressedThisFrameActionKeys,
          releasedThisFrameActionKeys: [],
          spacePressedThisFrame,
          spaceReleasedThisFrame: false,
          jumpPressedThisFrame,
          keySequence: nextSequence,
        });

        lastDeviceKind = "keyboard";
        lastResetReason = null;
        setPhase(pointer.pointerLocked ? "locked" : "active");
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    keyUp(event: KeyboardEventLike, updateOptions?: InputStateUpdateOptions): InputStateSnapshot {
      try {
        assertAlive("keyUp");

        if (!keyboard.enabled) {
          return snapshot();
        }

        const key = normalizeKey(event.key);
        const code = normalizeCode(event.code);
        const actionKey = keyToActionKey(key, code);
        const timestamp = normalizeTimestamp(updateOptions?.timestamp);
        const pressedKeyToken = keyTokenFromEvent(key, code);
        const wasPressed = keyboard.pressedKeys.some((item) => tokensMatch(item, pressedKeyToken));
        const shouldCreateEdge = wasPressed && actionKey !== "unknown";
        const nextSequence = shouldCreateEdge ? keyboard.keySequence + 1 : keyboard.keySequence;

        const pressedKeys = removeKeyToken(keyboard.pressedKeys, key, code);
        const pressedActionKeys = actionKeysFromPressedKeys(pressedKeys);

        const keyUpEdge = shouldCreateEdge
          ? createKeyboardEdgeState({
              key,
              code,
              token: pressedKeyToken,
              actionKey,
              timestamp,
              repeat: false,
              sequence: nextSequence,
            })
          : null;

        keyboard = refreshKeyboardHoldFlags({
          ...keyboard,
          pressedKeys,
          pressedActionKeys,
          lastKey: key || keyboard.lastKey,
          lastCode: code || keyboard.lastCode,
          lastActionKey: actionKey,
          lastKeyUpAt: timestamp,
          lastKeyRepeat: false,
          modifiers: normalizeModifiers(event),
          keyDownEdge: null,
          keyUpEdge,
          pressedThisFrameActionKeys: [],
          releasedThisFrameActionKeys: shouldCreateEdge
            ? addFrameActionKey(keyboard.releasedThisFrameActionKeys, actionKey)
            : keyboard.releasedThisFrameActionKeys,
          spacePressedThisFrame: false,
          spaceReleasedThisFrame: shouldCreateEdge && isSpaceKey(key, code),
          jumpPressedThisFrame: false,
          keySequence: nextSequence,
        });

        lastDeviceKind = "keyboard";
        lastResetReason = null;
        updatePhaseFromState();
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    clearKeys(): InputStateSnapshot {
      if (destroyed) {
        return snapshot();
      }

      try {
        keyboard = refreshKeyboardHoldFlags({
          ...keyboard,
          pressedKeys: [],
          pressedActionKeys: [],
          keyDownEdge: null,
          keyUpEdge: null,
          pressedThisFrameActionKeys: [],
          releasedThisFrameActionKeys: [],
          spacePressedThisFrame: false,
          spaceReleasedThisFrame: false,
          jumpPressedThisFrame: false,
          lastKeyRepeat: false,
          modifiers: {
            alt: false,
            ctrl: false,
            meta: false,
            shift: false,
          },
        });

        lastDeviceKind = "keyboard";
        updatePhaseFromState();
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    pointerDown(event: PointerEventLike, updateOptions?: InputStateUpdateOptions): InputStateSnapshot {
      try {
        assertAlive("pointerDown");

        if (!pointer.enabled) {
          return snapshot();
        }

        const button = normalizeButton(event.button);
        const position = normalizePointerPosition(event, updateOptions);
        const eventButtons = buttonsFromEvent(event);
        const pressedButtons = eventButtons.length > 0
          ? normalizePointerButtons(eventButtons)
          : mergeButton(pointer.pressedButtons, button);

        pointer = {
          ...pointer,
          pressedButtons,
          lastButton: button,
          previousPosition: pointer.position,
          position,
          delta: createZeroDelta(),
          lookDelta: createZeroDelta(),
          lastPointerDownAt: normalizeTimestamp(updateOptions?.timestamp),
          modifiers: normalizeModifiers(event),
        };

        lastDeviceKind = "pointer";
        lastResetReason = null;
        setPhase(pointer.pointerLocked ? "locked" : "active");
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    pointerUp(event: PointerEventLike, updateOptions?: InputStateUpdateOptions): InputStateSnapshot {
      try {
        assertAlive("pointerUp");

        if (!pointer.enabled) {
          return snapshot();
        }

        const button = normalizeButton(event.button);
        const position = normalizePointerPosition(event, updateOptions);
        const eventButtons = buttonsFromEvent(event);
        const pressedButtons = event.buttons !== undefined
          ? normalizePointerButtons(eventButtons)
          : removeButton(pointer.pressedButtons, button);

        pointer = {
          ...pointer,
          pressedButtons,
          lastButton: button,
          previousPosition: pointer.position,
          position,
          delta: createZeroDelta(),
          lookDelta: createZeroDelta(),
          lastPointerUpAt: normalizeTimestamp(updateOptions?.timestamp),
          modifiers: normalizeModifiers(event),
        };

        lastDeviceKind = "pointer";
        lastResetReason = null;
        updatePhaseFromState();
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    pointerMove(event: PointerEventLike, updateOptions?: InputStateUpdateOptions): InputStateSnapshot {
      try {
        assertAlive("pointerMove");

        if (!pointer.enabled) {
          return snapshot();
        }

        const previousPosition = pointer.position;
        const position = normalizePointerPosition(event, updateOptions);
        const delta = pointerDeltaFromEvent(event, previousPosition, position);
        const lookDelta = delta;

        const pressedButtons = pointer.pointerLocked
          ? []
          : event.buttons !== undefined
            ? normalizePointerButtons(buttonsFromEvent(event))
            : pointer.pressedButtons;

        pointer = {
          ...pointer,
          pressedButtons,
          previousPosition,
          position,
          delta,
          lookDelta,
          accumulatedDelta: accumulateDelta(pointer.accumulatedDelta, delta),
          accumulatedLookDelta: accumulateDelta(pointer.accumulatedLookDelta, lookDelta),
          lastPointerMoveAt: normalizeTimestamp(updateOptions?.timestamp),
          modifiers: normalizeModifiers(event),
        };

        lastDeviceKind = "pointer";
        lastResetReason = null;
        setPhase(pointer.pointerLocked ? "locked" : pressedButtons.length > 0 ? "dragging" : "active");
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    pointerClick(event: PointerEventLike, updateOptions?: InputStateUpdateOptions): InputStateSnapshot {
      try {
        assertAlive("pointerClick");

        if (!pointer.enabled) {
          return snapshot();
        }

        const button = normalizeButton(event.button);
        const position = normalizePointerPosition(event, updateOptions);

        pointer = {
          ...pointer,
          lastButton: button,
          previousPosition: pointer.position,
          position,
          lastClickAt: normalizeTimestamp(updateOptions?.timestamp),
          modifiers: normalizeModifiers(event),
        };

        lastDeviceKind = "pointer";
        lastResetReason = null;
        setPhase(pointer.pointerLocked ? "locked" : shouldBeActive(keyboard, pointer) ? "active" : "idle");
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    clearPointerButtons(): InputStateSnapshot {
      if (destroyed) {
        return snapshot();
      }

      try {
        pointer = {
          ...pointer,
          pressedButtons: [],
          lastButton: null,
        };

        lastDeviceKind = "pointer";
        updatePhaseFromState();
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    wheel(event: WheelEventLike, updateOptions?: InputStateUpdateOptions): InputStateSnapshot {
      try {
        assertAlive("wheel");

        if (!wheelState.enabled) {
          return snapshot();
        }

        const delta = {
          x: safeNumber(event.deltaX, 0),
          y: safeNumber(event.deltaY, 0),
          z: safeNumber(event.deltaZ, 0),
        };

        wheelState = {
          ...wheelState,
          delta,
          accumulatedDelta: accumulateWheelDelta(wheelState.accumulatedDelta, delta),
          lastWheelAt: normalizeTimestamp(updateOptions?.timestamp),
          modifiers: normalizeModifiers(event),
        };

        lastDeviceKind = "wheel";
        lastResetReason = null;
        setPhase(pointer.pointerLocked ? "locked" : "active");
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    resetDeltas,

    resetKeyboardEdges,

    resetAll(reason?: string): InputStateSnapshot {
      if (destroyed) {
        return snapshot();
      }

      try {
        const locked = pointer.pointerLocked;
        const available = pointer.pointerLockAvailable;
        const pointerLockChangeCount = pointer.pointerLockChangeCount;
        const lastPointerLockChangeAt = pointer.lastPointerLockChangeAt;

        keyboard = createInitialKeyboard(keyboard.enabled);
        pointer = {
          ...createInitialPointer(pointer.enabled, available),
          pointerLocked: locked,
          pointerLockChangeCount,
          lastPointerLockChangeAt,
        };
        wheelState = createInitialWheel(wheelState.enabled);
        lastDeviceKind = "unknown";
        lastResetReason = nullableString(reason, "reset-all");
        lastError = null;

        updatePhaseFromState();
      } catch (error) {
        lastError = normalizeErrorRecord(error);
        setPhase("failed");
      }

      return snapshot();
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        destroyed = true;
        destroyedAt = now();

        keyboard = createInitialKeyboard(false);
        pointer = createInitialPointer(false, false);
        wheelState = createInitialWheel(false);
        lastDeviceKind = "unknown";
        lastResetReason = nullableString(reason, "destroy");
        lastError = null;

        setPhase("disabled");
      } catch {
        destroyed = true;
        destroyedAt = now();
        phase = "disabled";
      }
    },
  };

  if (!keyboard.enabled && !pointer.enabled && !wheelState.enabled) {
    setPhase("disabled");
  } else {
    updatePhaseFromState();
  }

  return handle;
}

export function isInputStateHandle(value: unknown): value is InputStateHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<InputStateHandle>;

    return (
      record.kind === INPUT_STATE_KIND
      && typeof record.getSnapshot === "function"
      && typeof record.keyDown === "function"
      && typeof record.pointerMove === "function"
      && typeof record.setPointerLock === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}

export function keyboardActionKeyToHotbarSlot(actionKey: KeyboardActionKey): number | null {
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

export function inputSnapshotToDebugSummary(snapshot: InputStateSnapshot): Record<string, unknown> {
  try {
    return {
      kind: snapshot.kind,
      phase: snapshot.phase,
      lastDeviceKind: snapshot.lastDeviceKind,
      lastResetReason: snapshot.lastResetReason,
      keyboard: {
        enabled: snapshot.keyboard.enabled,
        pressedKeys: snapshot.keyboard.pressedKeys,
        pressedActionKeys: snapshot.keyboard.pressedActionKeys,
        lastKey: snapshot.keyboard.lastKey,
        lastCode: snapshot.keyboard.lastCode,
        lastActionKey: snapshot.keyboard.lastActionKey,
        lastKeyRepeat: snapshot.keyboard.lastKeyRepeat,
        keyDownEdge: snapshot.keyboard.keyDownEdge,
        keyUpEdge: snapshot.keyboard.keyUpEdge,
        pressedThisFrameActionKeys: snapshot.keyboard.pressedThisFrameActionKeys,
        releasedThisFrameActionKeys: snapshot.keyboard.releasedThisFrameActionKeys,
        spacePressedThisFrame: snapshot.keyboard.spacePressedThisFrame,
        spaceReleasedThisFrame: snapshot.keyboard.spaceReleasedThisFrame,
        jumpPressedThisFrame: snapshot.keyboard.jumpPressedThisFrame,
        ascendHeld: snapshot.keyboard.ascendHeld,
        descendHeld: snapshot.keyboard.descendHeld,
        sprintHeld: snapshot.keyboard.sprintHeld,
        keySequence: snapshot.keyboard.keySequence,
      },
      pointer: {
        enabled: snapshot.pointer.enabled,
        pointerLocked: snapshot.pointer.pointerLocked,
        pointerLockAvailable: snapshot.pointer.pointerLockAvailable,
        pointerLockChangeCount: snapshot.pointer.pointerLockChangeCount,
        pressedButtons: snapshot.pointer.pressedButtons,
        position: snapshot.pointer.position,
        delta: snapshot.pointer.delta,
        lookDelta: snapshot.pointer.lookDelta,
        accumulatedDelta: snapshot.pointer.accumulatedDelta,
        accumulatedLookDelta: snapshot.pointer.accumulatedLookDelta,
      },
      wheel: {
        enabled: snapshot.wheel.enabled,
        delta: snapshot.wheel.delta,
        accumulatedDelta: snapshot.wheel.accumulatedDelta,
      },
      lastError: snapshot.lastError,
    };
  } catch (error) {
    return {
      kind: "input-state-debug-summary.failed",
      error: normalizeErrorRecord(error),
    };
  }
}

export function pointerButtonsFromNativeEvent(event: PointerEventLike): readonly EditorPointerButton[] {
  return buttonsFromEvent(event);
}

export function selectInputSpacePressedThisFrame(snapshot: InputStateSnapshot): boolean {
  try {
    return snapshot.keyboard.spacePressedThisFrame;
  } catch {
    return false;
  }
}

export function selectInputJumpPressedThisFrame(snapshot: InputStateSnapshot): boolean {
  try {
    return snapshot.keyboard.jumpPressedThisFrame;
  } catch {
    return false;
  }
}

export function selectInputAscendHeld(snapshot: InputStateSnapshot): boolean {
  try {
    return snapshot.keyboard.ascendHeld;
  } catch {
    return false;
  }
}

export function selectInputDescendHeld(snapshot: InputStateSnapshot): boolean {
  try {
    return snapshot.keyboard.descendHeld;
  } catch {
    return false;
  }
}

export function selectInputSprintHeld(snapshot: InputStateSnapshot): boolean {
  try {
    return snapshot.keyboard.sprintHeld;
  } catch {
    return false;
  }
}
