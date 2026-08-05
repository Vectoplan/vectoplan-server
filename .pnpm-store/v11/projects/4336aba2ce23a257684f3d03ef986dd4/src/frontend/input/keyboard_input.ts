// src/frontend/input/keyboard_input.ts
import type { EditorLogger } from "@utils/logger";
import {
  normalizeUnknownError,
  safeBoolean,
  safeString,
  uniqueStrings,
} from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import {
  inputSnapshotToDebugSummary,
  keyboardActionKeyToHotbarSlot,
  type InputStateHandle,
  type KeyboardActionKey,
  type KeyboardEventLike,
} from "./input_state";

export type KeyboardInputStatus =
  | "created"
  | "attached"
  | "active"
  | "detached"
  | "disabled"
  | "failed"
  | "destroyed";

export type KeyboardInputTarget =
  | Window
  | Document
  | HTMLElement;

export interface KeyboardInputOptions {
  readonly inputState: InputStateHandle;
  readonly store?: EditorStore;
  readonly logger?: EditorLogger;
  readonly target?: KeyboardInputTarget;
  readonly signal?: AbortSignal;
  readonly enabled?: boolean;
  readonly preventDefaultForHandledKeys?: boolean;
  readonly ignoreEditableTargets?: boolean;
  readonly capture?: boolean;
  readonly passive?: boolean;
  readonly dispatchToStore?: boolean;

  /**
   * Clears stuck movement keys when the browser window loses focus.
   * This avoids permanent W/A/S/D movement after tab changes or devtools focus.
   */
  readonly clearOnWindowBlur?: boolean;

  /**
   * Clears keys when the document becomes hidden.
   */
  readonly clearOnVisibilityChange?: boolean;

  /**
   * Prevents double-calling legacy callbacks when onActionKeyDown is also provided.
   * Default false because input_controller.ts already handles hotbar/cancel through onActionKeyDown.
   */
  readonly invokeSpecificCallbacksAlongsideActionCallbacks?: boolean;

  /**
   * If true, repeated KeyboardEvent.repeat events are still passed into InputState.
   * Default false because physics and hotbar logic should consume edge events only.
   */
  readonly forwardRepeatedKeyDownToInputState?: boolean;

  readonly onActionKeyDown?: (actionKey: KeyboardActionKey, event: KeyboardEvent) => void;
  readonly onActionKeyUp?: (actionKey: KeyboardActionKey, event: KeyboardEvent) => void;
  readonly onHotbarSlot?: (slot: number, event: KeyboardEvent) => void;
  readonly onCancel?: (event: KeyboardEvent) => void;
}

export interface KeyboardInputSnapshot {
  readonly kind: "keyboard-input-snapshot.v1";
  readonly status: KeyboardInputStatus;
  readonly enabled: boolean;
  readonly attached: boolean;
  readonly destroyed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly keyDownCount: number;
  readonly keyUpCount: number;
  readonly handledCount: number;
  readonly ignoredCount: number;
  readonly repeatedKeyDownCount: number;
  readonly focusLossClearCount: number;
  readonly visibilityClearCount: number;
  readonly lastActionKey: KeyboardActionKey | null;
  readonly lastKey: string | null;
  readonly lastCode: string | null;
  readonly pressedKeys: readonly string[];
  readonly pressedActionKeys: readonly KeyboardActionKey[];
  readonly lastError: Record<string, unknown> | null;
}

export interface KeyboardInputHandle {
  readonly kind: "vectoplan-editor-keyboard-input.v1";

  attach(): void;
  detach(reason?: string): void;

  enable(reason?: string): void;
  disable(reason?: string): void;

  handleKeyDown(event: KeyboardEvent): void;
  handleKeyUp(event: KeyboardEvent): void;

  clear(reason?: string): void;

  isEnabled(): boolean;
  isAttached(): boolean;
  getStatus(): KeyboardInputStatus;
  getSnapshot(): KeyboardInputSnapshot;

  destroy(reason?: string): void;
}

const KEYBOARD_INPUT_KIND = "vectoplan-editor-keyboard-input.v1" as const;
const KEYBOARD_INPUT_SNAPSHOT_KIND = "keyboard-input-snapshot.v1" as const;

const HANDLED_ACTION_KEYS: readonly KeyboardActionKey[] = [
  "move-forward",
  "move-backward",
  "move-left",
  "move-right",
  "move-up",
  "move-down",
  "sprint",
  "jump",
  "crouch",
  "place",
  "remove",
  "inspect",
  "cancel",
  "hotbar-1",
  "hotbar-2",
  "hotbar-3",
  "hotbar-4",
  "hotbar-5",
  "hotbar-6",
  "hotbar-7",
  "hotbar-8",
  "hotbar-9",
];

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Keyboard logging must never break input handling.
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
    // Keyboard logging must never break input handling.
  }
}

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
        message: "Unknown keyboard input error.",
      };
    }
  }
}

function defaultTarget(): KeyboardInputTarget {
  try {
    if (typeof window !== "undefined") {
      return window;
    }

    if (typeof document !== "undefined") {
      return document;
    }

    throw new Error("No keyboard input target is available.");
  } catch (error) {
    throw new Error(`No keyboard input target is available: ${String(error)}`);
  }
}

function normalizeTarget(value: KeyboardInputTarget | undefined): KeyboardInputTarget {
  try {
    return value ?? defaultTarget();
  } catch {
    return defaultTarget();
  }
}

function isHTMLElement(value: unknown): value is HTMLElement {
  try {
    return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
  } catch {
    return false;
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  try {
    if (!isHTMLElement(target)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();

    return (
      tagName === "input"
      || tagName === "textarea"
      || tagName === "select"
      || tagName === "button"
      || target.isContentEditable === true
      || target.closest("[contenteditable='true']") !== null
      || target.closest("[data-editor-ignore-keyboard='true']") !== null
      || target.closest("[data-editor-ignore-pointer-lock='true']") !== null
      || target.closest("[data-editor-ui-interactive='true']") !== null
    );
  } catch {
    return false;
  }
}

function eventToKeyboardEventLike(event: KeyboardEvent): KeyboardEventLike {
  return {
    key: event.key,
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    repeat: event.repeat,
  };
}

function normalizeActionKeyFromSnapshot(snapshot: ReturnType<InputStateHandle["getSnapshot"]>): KeyboardActionKey | null {
  try {
    const action = snapshot.keyboard.lastActionKey;

    return action && action !== "unknown" ? action : null;
  } catch {
    return null;
  }
}

function shouldHandleActionKey(actionKey: KeyboardActionKey | null): boolean {
  try {
    if (!actionKey || actionKey === "unknown") {
      return false;
    }

    return HANDLED_ACTION_KEYS.includes(actionKey);
  } catch {
    return false;
  }
}

function isDiscreteAction(actionKey: KeyboardActionKey | null): boolean {
  try {
    if (!actionKey) {
      return false;
    }

    return (
      actionKey === "cancel"
      || actionKey === "inspect"
      || actionKey === "place"
      || actionKey === "remove"
      || actionKey.startsWith("hotbar-")
    );
  } catch {
    return false;
  }
}

function shouldInvokeActionOnKeyDown(event: KeyboardEvent, actionKey: KeyboardActionKey | null): boolean {
  try {
    if (!actionKey || actionKey === "unknown") {
      return false;
    }

    /**
     * All callbacks are edge-based.
     * Held movement state is represented by inputState.keyboard.pressedActionKeys.
     */
    if (event.repeat === true) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isModifierKeyItself(event: KeyboardEvent): boolean {
  try {
    const key = safeString(event.key, "").toLowerCase();
    const code = safeString(event.code, "").toLowerCase();

    return (
      key === "shift"
      || key === "control"
      || key === "ctrl"
      || key === "alt"
      || key === "meta"
      || code === "shiftleft"
      || code === "shiftright"
      || code === "controlleft"
      || code === "controlright"
      || code === "altleft"
      || code === "altright"
      || code === "metaleft"
      || code === "metaright"
    );
  } catch {
    return false;
  }
}

function isBrowserShortcutKeyDown(event: KeyboardEvent, actionKey: KeyboardActionKey | null): boolean {
  try {
    /**
     * Do not hijack browser/system shortcuts such as Ctrl+W, Ctrl+R, Meta+L, Alt+Left.
     * Modifier keys themselves are still allowed because Control is currently used as crouch.
     */
    if (isModifierKeyItself(event)) {
      return false;
    }

    if (event.metaKey || event.altKey) {
      return true;
    }

    if (event.ctrlKey && actionKey !== "crouch") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function keyLabel(event: KeyboardEvent): string {
  try {
    const key = safeString(event.key, "");
    const code = safeString(event.code, "");

    if (key.length > 0 && code.length > 0) {
      return `${key}/${code}`;
    }

    return key || code || "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeKeyboardKey(value: unknown): string {
  try {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().toLowerCase();
  } catch {
    return "";
  }
}

function actionKeyFromKeyboardEvent(event: KeyboardEvent): KeyboardActionKey {
  try {
    const key = normalizeKeyboardKey(event.key);
    const code = normalizeKeyboardKey(event.code);

    if (key === "w" || code === "keyw" || key === "arrowup" || code === "arrowup") return "move-forward";
    if (key === "s" || code === "keys" || key === "arrowdown" || code === "arrowdown") return "move-backward";
    if (key === "a" || code === "keya" || key === "arrowleft" || code === "arrowleft") return "move-left";
    if (key === "d" || code === "keyd" || key === "arrowright" || code === "arrowright") return "move-right";

    /**
     * Space is jump at the input level.
     * Physics later decides whether this edge means:
     * - ground jump
     * - flight ascend hold
     * - double-space flight toggle
     */
    if (key === " " || key === "space" || code === "space") return "jump";

    if (key === "q" || code === "keyq") return "sprint";
    if (key === "shift" || code === "shiftleft" || code === "shiftright") return "move-down";
    if (key === "control" || key === "ctrl" || code === "controlleft" || code === "controlright") return "crouch";

    if (key === "escape" || code === "escape") return "cancel";
    if (key === "f" || code === "keyf") return "inspect";
    if (key === "enter" || code === "enter") return "place";
    if (key === "backspace" || key === "delete" || code === "backspace" || code === "delete") return "remove";

    if (/^[1-9]$/.test(key)) {
      return `hotbar-${key}` as KeyboardActionKey;
    }

    if (/^digit[1-9]$/.test(code)) {
      return `hotbar-${code.replace("digit", "")}` as KeyboardActionKey;
    }

    if (/^numpad[1-9]$/.test(code)) {
      return `hotbar-${code.replace("numpad", "")}` as KeyboardActionKey;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function pressedKeysFromSnapshot(snapshot: ReturnType<InputStateHandle["getSnapshot"]>): readonly string[] {
  try {
    return uniqueStrings(snapshot.keyboard.pressedKeys);
  } catch {
    return [];
  }
}

function pressedActionKeysFromSnapshot(snapshot: ReturnType<InputStateHandle["getSnapshot"]>): readonly KeyboardActionKey[] {
  try {
    return uniqueStrings(snapshot.keyboard.pressedActionKeys) as readonly KeyboardActionKey[];
  } catch {
    return [];
  }
}

function dispatchKeyboardStateToStore(
  store: EditorStore | undefined,
  snapshot: ReturnType<InputStateHandle["getSnapshot"]>,
  actionName: string,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "input/keys",
        pressedKeys: pressedKeysFromSnapshot(snapshot),
        createdAt: now(),
        source: actionName,
      }),
      {
        action: actionName,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store update must not break keyboard input.
  }
}

function dispatchDebugAction(
  store: EditorStore | undefined,
  action: string,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "debug/action",
        action,
        createdAt: now(),
        source: "keyboard-input",
      }),
      {
        action: "keyboard.debug-action",
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Debug dispatch must not break keyboard input.
  }
}

function maybePreventDefault(
  event: KeyboardEvent,
  actionKey: KeyboardActionKey | null,
  enabled: boolean,
): void {
  try {
    if (!enabled || !shouldHandleActionKey(actionKey)) {
      return;
    }

    event.preventDefault();
  } catch {
    // Some synthetic/passive events may not allow preventDefault.
  }
}

function addKeyboardListener(
  target: KeyboardInputTarget,
  type: "keydown" | "keyup",
  listener: (event: KeyboardEvent) => void,
  options: AddEventListenerOptions,
): () => void {
  try {
    (target as EventTarget).addEventListener(type, listener as EventListener, options);

    return () => {
      try {
        (target as EventTarget).removeEventListener(type, listener as EventListener, options);
      } catch {
        // Ignore remove failure.
      }
    };
  } catch {
    return () => undefined;
  }
}

function addWindowListener(
  type: string,
  listener: EventListener,
  options: AddEventListenerOptions,
): () => void {
  try {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    window.addEventListener(type, listener, options);

    return () => {
      try {
        window.removeEventListener(type, listener, options);
      } catch {
        // Ignore remove failure.
      }
    };
  } catch {
    return () => undefined;
  }
}

function addDocumentListener(
  type: string,
  listener: EventListener,
  options: AddEventListenerOptions,
): () => void {
  try {
    if (typeof document === "undefined") {
      return () => undefined;
    }

    document.addEventListener(type, listener, options);

    return () => {
      try {
        document.removeEventListener(type, listener, options);
      } catch {
        // Ignore remove failure.
      }
    };
  } catch {
    return () => undefined;
  }
}

function targetLabel(target: KeyboardInputTarget): string {
  try {
    if (typeof window !== "undefined" && target === window) {
      return "window";
    }

    if (typeof document !== "undefined" && target === document) {
      return "document";
    }

    if (isHTMLElement(target)) {
      return target.id ? `element#${target.id}` : target.tagName.toLowerCase();
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function invokeCallback(
  logger: EditorLogger | undefined,
  label: string,
  callback: (() => void) | undefined,
): void {
  try {
    callback?.();
  } catch (error) {
    logWarn(logger, `${label} failed.`, {
      error: normalizeErrorRecord(error),
    });
  }
}

export function createKeyboardInput(options: KeyboardInputOptions): KeyboardInputHandle {
  const inputState = options.inputState;
  const logger = options.logger;
  const store = options.store;
  const target = normalizeTarget(options.target);

  const preventDefaultForHandledKeys = options.preventDefaultForHandledKeys ?? true;
  const ignoreEditableTargets = options.ignoreEditableTargets ?? true;
  const dispatchToStore = options.dispatchToStore ?? true;
  const clearOnWindowBlur = options.clearOnWindowBlur ?? true;
  const clearOnVisibilityChange = options.clearOnVisibilityChange ?? true;
  const invokeSpecificCallbacksAlongsideActionCallbacks =
    options.invokeSpecificCallbacksAlongsideActionCallbacks ?? false;
  const forwardRepeatedKeyDownToInputState =
    options.forwardRepeatedKeyDownToInputState ?? false;

  const listenerOptions: AddEventListenerOptions = {
    capture: options.capture ?? false,
    passive: options.passive ?? false,
  };

  const createdAt = now();

  let status: KeyboardInputStatus = "created";
  let enabled = safeBoolean(options.enabled, true);
  let attached = false;
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;

  let keyDownCount = 0;
  let keyUpCount = 0;
  let handledCount = 0;
  let ignoredCount = 0;
  let repeatedKeyDownCount = 0;
  let focusLossClearCount = 0;
  let visibilityClearCount = 0;

  let lastActionKey: KeyboardActionKey | null = null;
  let lastKey: string | null = null;
  let lastCode: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  const cleanupCallbacks: Array<() => void> = [];

  function setStatus(nextStatus: KeyboardInputStatus): void {
    try {
      status = nextStatus;
      updatedAt = now();
    } catch {
      status = nextStatus;
    }
  }

  function setError(error: unknown): void {
    try {
      lastError = normalizeErrorRecord(error);
      setStatus("failed");
    } catch {
      status = "failed";
    }
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed") {
      logWarn(logger, "Keyboard input action ignored because controller is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function shouldIgnoreEvent(event: KeyboardEvent, phase: "down" | "up", actionKey: KeyboardActionKey | null): boolean {
    try {
      if (!enabled) {
        ignoredCount += 1;
        return true;
      }

      if (ignoreEditableTargets && isEditableTarget(event.target)) {
        ignoredCount += 1;
        return true;
      }

      if (phase === "down" && event.isComposing) {
        ignoredCount += 1;
        return true;
      }

      if (phase === "down" && isBrowserShortcutKeyDown(event, actionKey)) {
        ignoredCount += 1;
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  function afterKeyboardUpdate(
    snapshot: ReturnType<InputStateHandle["getSnapshot"]>,
    actionName: string,
  ): void {
    try {
      lastActionKey = normalizeActionKeyFromSnapshot(snapshot);
      lastKey = snapshot.keyboard.lastKey;
      lastCode = snapshot.keyboard.lastCode;
      updatedAt = now();

      if (dispatchToStore) {
        dispatchKeyboardStateToStore(store, snapshot, actionName);
      }

      if (lastActionKey && shouldHandleActionKey(lastActionKey)) {
        dispatchDebugAction(store, `keyboard:${lastActionKey}`);
      }
    } catch (error) {
      setError(error);
    }
  }

  function invokeSpecificDownCallbacks(actionKey: KeyboardActionKey, event: KeyboardEvent): void {
    try {
      const hasGeneralActionCallback = typeof options.onActionKeyDown === "function";

      if (hasGeneralActionCallback && !invokeSpecificCallbacksAlongsideActionCallbacks) {
        return;
      }

      const slot = keyboardActionKeyToHotbarSlot(actionKey);

      if (slot !== null) {
        invokeCallback(logger, "Keyboard hotbar callback", () => options.onHotbarSlot?.(slot, event));
        return;
      }

      if (actionKey === "cancel") {
        invokeCallback(logger, "Keyboard cancel callback", () => options.onCancel?.(event));
      }
    } catch (error) {
      logWarn(logger, "Keyboard specific action handler failed.", {
        actionKey,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function clearFromExternalReason(reason: string): void {
    try {
      if (destroyed) {
        return;
      }

      const snapshot = inputState.clearKeys();

      if (dispatchToStore) {
        dispatchKeyboardStateToStore(store, snapshot, reason);
      }

      afterKeyboardUpdate(snapshot, reason);
      setStatus(enabled ? (attached ? "attached" : "created") : "disabled");
    } catch (error) {
      setError(error);
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!assertAlive("handleKeyDown")) {
      return;
    }

    try {
      const predictedActionKey = actionKeyFromKeyboardEvent(event);

      if (shouldIgnoreEvent(event, "down", predictedActionKey)) {
        return;
      }

      keyDownCount += 1;

      if (event.repeat) {
        repeatedKeyDownCount += 1;

        if (!forwardRepeatedKeyDownToInputState) {
          maybePreventDefault(event, predictedActionKey, preventDefaultForHandledKeys);
          return;
        }
      }

      const snapshot = inputState.keyDown(eventToKeyboardEventLike(event), {
        timestamp: now(),
      });
      const actionKey = normalizeActionKeyFromSnapshot(snapshot) ?? predictedActionKey;

      if (shouldHandleActionKey(actionKey)) {
        handledCount += 1;
      }

      maybePreventDefault(event, actionKey, preventDefaultForHandledKeys);
      afterKeyboardUpdate(snapshot, "keyboard.key-down");

      if (actionKey && shouldInvokeActionOnKeyDown(event, actionKey)) {
        invokeCallback(logger, "Keyboard action key down callback", () => options.onActionKeyDown?.(actionKey, event));
        invokeSpecificDownCallbacks(actionKey, event);
      }

      if (status !== "active") {
        setStatus("active");
      }
    } catch (error) {
      setError(error);
      logWarn(logger, "Keyboard keydown handling failed.", {
        key: keyLabel(event),
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (!assertAlive("handleKeyUp")) {
      return;
    }

    try {
      const predictedActionKey = actionKeyFromKeyboardEvent(event);

      /**
       * Keyup should normally be processed even if ctrl/meta is held, because a key
       * may have been pressed before the modifier and must still be released.
       */
      if (!enabled) {
        ignoredCount += 1;
        return;
      }

      if (ignoreEditableTargets && isEditableTarget(event.target)) {
        ignoredCount += 1;
        return;
      }

      keyUpCount += 1;

      const snapshot = inputState.keyUp(eventToKeyboardEventLike(event), {
        timestamp: now(),
      });
      const actionKey = normalizeActionKeyFromSnapshot(snapshot) ?? predictedActionKey;

      if (shouldHandleActionKey(actionKey)) {
        handledCount += 1;
      }

      maybePreventDefault(event, actionKey, preventDefaultForHandledKeys);
      afterKeyboardUpdate(snapshot, "keyboard.key-up");

      if (actionKey) {
        invokeCallback(logger, "Keyboard action key up callback", () => options.onActionKeyUp?.(actionKey, event));
      }

      if (snapshot.keyboard.pressedKeys.length === 0) {
        setStatus(attached ? "attached" : "detached");
      }
    } catch (error) {
      setError(error);
      logWarn(logger, "Keyboard keyup handling failed.", {
        key: keyLabel(event),
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handleWindowBlur(): void {
    try {
      if (!clearOnWindowBlur || destroyed) {
        return;
      }

      focusLossClearCount += 1;
      clearFromExternalReason("keyboard.window-blur");
    } catch (error) {
      setError(error);
    }
  }

  function handleVisibilityChange(): void {
    try {
      if (!clearOnVisibilityChange || destroyed) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        visibilityClearCount += 1;
        clearFromExternalReason("keyboard.visibility-hidden");
      }
    } catch (error) {
      setError(error);
    }
  }

  function attachAbortSignal(): void {
    try {
      const signal = options.signal;

      if (!signal) {
        return;
      }

      if (signal.aborted) {
        controller.destroy("abort-signal-already-aborted");
        return;
      }

      const onAbort = (): void => {
        controller.destroy("abort-signal");
      };

      signal.addEventListener("abort", onAbort, {
        once: true,
      });

      cleanupCallbacks.push(() => {
        try {
          signal.removeEventListener("abort", onAbort);
        } catch {
          // Ignore cleanup failure.
        }
      });
    } catch {
      // Abort wiring is best-effort.
    }
  }

  function detachListeners(): void {
    try {
      for (const cleanup of cleanupCallbacks.splice(0)) {
        try {
          cleanup();
        } catch {
          // Continue cleanup chain.
        }
      }

      attached = false;
    } catch {
      attached = false;
    }
  }

  const controller: KeyboardInputHandle = {
    kind: KEYBOARD_INPUT_KIND,

    attach(): void {
      if (!assertAlive("attach")) {
        return;
      }

      if (attached) {
        return;
      }

      try {
        cleanupCallbacks.push(addKeyboardListener(target, "keydown", handleKeyDown, listenerOptions));
        cleanupCallbacks.push(addKeyboardListener(target, "keyup", handleKeyUp, listenerOptions));

        if (clearOnWindowBlur) {
          cleanupCallbacks.push(addWindowListener("blur", handleWindowBlur as EventListener, {
            capture: false,
            passive: true,
          }));
        }

        if (clearOnVisibilityChange) {
          cleanupCallbacks.push(addDocumentListener("visibilitychange", handleVisibilityChange as EventListener, {
            capture: false,
            passive: true,
          }));
        }

        attachAbortSignal();

        attached = true;
        setStatus(enabled ? "attached" : "disabled");

        logDebug(logger, "Keyboard input attached.", {
          enabled,
          target: targetLabel(target),
          preventDefaultForHandledKeys,
          ignoreEditableTargets,
          clearOnWindowBlur,
          clearOnVisibilityChange,
          invokeSpecificCallbacksAlongsideActionCallbacks,
          forwardRepeatedKeyDownToInputState,
          capture: listenerOptions.capture ?? false,
          passive: listenerOptions.passive ?? false,
        });
      } catch (error) {
        setError(error);
        logWarn(logger, "Keyboard input attach failed.", {
          error: normalizeErrorRecord(error),
        });
      }
    },

    detach(reason?: string): void {
      if (destroyed) {
        return;
      }

      detachListeners();

      try {
        const snapshot = inputState.clearKeys();

        if (dispatchToStore) {
          dispatchKeyboardStateToStore(store, snapshot, "keyboard.detach");
        }
      } catch {
        // Ignore detach state cleanup failure.
      }

      setStatus(enabled ? "detached" : "disabled");

      logDebug(logger, "Keyboard input detached.", {
        reason: reason ?? null,
      });
    },

    enable(reason?: string): void {
      if (!assertAlive("enable")) {
        return;
      }

      try {
        enabled = true;
        inputState.setEnabled({
          keyboard: true,
        });
        setStatus(attached ? "attached" : "created");

        logDebug(logger, "Keyboard input enabled.", {
          reason: reason ?? null,
        });
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
        inputState.setEnabled({
          keyboard: false,
        });
        const snapshot = inputState.clearKeys();

        if (dispatchToStore) {
          dispatchKeyboardStateToStore(store, snapshot, "keyboard.disable");
        }

        setStatus("disabled");

        logDebug(logger, "Keyboard input disabled.", {
          reason: reason ?? null,
        });
      } catch (error) {
        setError(error);
      }
    },

    handleKeyDown,

    handleKeyUp,

    clear(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        const snapshot = inputState.clearKeys();
        afterKeyboardUpdate(snapshot, "keyboard.clear");
        setStatus(enabled ? (attached ? "attached" : "created") : "disabled");

        logDebug(logger, "Keyboard input cleared.", {
          reason: reason ?? null,
        });
      } catch (error) {
        setError(error);
      }
    },

    isEnabled(): boolean {
      try {
        return enabled;
      } catch {
        return false;
      }
    },

    isAttached(): boolean {
      try {
        return attached;
      } catch {
        return false;
      }
    },

    getStatus(): KeyboardInputStatus {
      return status;
    },

    getSnapshot(): KeyboardInputSnapshot {
      const snapshot = inputState.getSnapshot();

      return {
        kind: KEYBOARD_INPUT_SNAPSHOT_KIND,
        status,
        enabled,
        attached,
        destroyed,
        createdAt,
        updatedAt,
        destroyedAt,
        keyDownCount,
        keyUpCount,
        handledCount,
        ignoredCount,
        repeatedKeyDownCount,
        focusLossClearCount,
        visibilityClearCount,
        lastActionKey,
        lastKey,
        lastCode,
        pressedKeys: pressedKeysFromSnapshot(snapshot),
        pressedActionKeys: pressedActionKeysFromSnapshot(snapshot),
        lastError,
      };
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      destroyedAt = now();

      detachListeners();

      try {
        inputState.clearKeys();
      } catch {
        // Ignore destroy state cleanup failure.
      }

      setStatus("destroyed");

      logDebug(logger, "Keyboard input destroyed.", {
        reason: reason ?? null,
        keyDownCount,
        keyUpCount,
        handledCount,
        ignoredCount,
        repeatedKeyDownCount,
        focusLossClearCount,
        visibilityClearCount,
        inputState: inputSnapshotToDebugSummary(inputState.getSnapshot()),
      });
    },
  };

  return controller;
}

export function isKeyboardInputHandle(value: unknown): value is KeyboardInputHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<KeyboardInputHandle>;

    return (
      record.kind === KEYBOARD_INPUT_KIND
      && typeof record.attach === "function"
      && typeof record.handleKeyDown === "function"
      && typeof record.handleKeyUp === "function"
      && typeof record.clear === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}