// services/vectoplan-editor/src/frontend/input/mouse_input.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { EditorPointerButton } from "@state/editor_state";
import type {
  InputStateHandle,
  InputStateSnapshot,
  PointerEventLike,
  WheelEventLike,
} from "./input_state";
import {
  inputSnapshotToDebugSummary,
} from "./input_state";
import type { PointerLockHandle } from "./pointer_lock";

export type MouseInputStatus =
  | "created"
  | "attached"
  | "active"
  | "dragging"
  | "detached"
  | "disabled"
  | "failed"
  | "destroyed";

export type MouseInputTarget =
  | HTMLElement
  | Window
  | Document;

export interface MouseInputOptions {
  readonly inputState: InputStateHandle;
  readonly store?: EditorStore;
  readonly logger?: EditorLogger;
  readonly target: MouseInputTarget;
  readonly canvasHost?: HTMLElement | null;
  readonly signal?: AbortSignal;

  /**
   * Optional pointer-lock handle.
   *
   * When provided, mouse input can activate pointer lock from the first primary
   * pointer interaction and then camera-look can use movementX/movementY without
   * requiring a pressed mouse button.
   */
  readonly pointerLock?: PointerLockHandle | null;

  readonly enabled?: boolean;
  readonly preventDefault?: boolean;
  readonly preventContextMenu?: boolean;
  readonly focusOnPointerDown?: boolean;
  readonly capturePointer?: boolean;
  readonly dispatchToStore?: boolean;
  readonly listenOnWindowForPointerUp?: boolean;
  readonly listenOnWindowForPointerMove?: boolean;
  readonly ignoreEditableTargets?: boolean;
  readonly passiveMove?: boolean;

  /**
   * If true, the first primary pointerdown requests pointer lock.
   * Browser security still requires this user gesture.
   */
  readonly requestPointerLockOnPointerDown?: boolean;

  /**
   * If true, block place/remove callbacks are not fired while pointer lock is inactive.
   */
  readonly requirePointerLockForActions?: boolean;

  /**
   * If true, the pointer event that activates pointer lock does not also trigger
   * a primary click/down action. This avoids placing a block on the first click.
   */
  readonly suppressPrimaryActionOnPointerLockActivation?: boolean;

  /**
   * Suppresses the matching click/up event shortly after pointer-lock activation.
   * This prevents browsers from firing a click after the activation pointerdown
   * and accidentally placing a block.
   */
  readonly suppressClickAfterActivationMs?: number;

  readonly onPrimaryDown?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;
  readonly onPrimaryUp?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;
  readonly onPrimaryClick?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;

  readonly onSecondaryDown?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;
  readonly onSecondaryUp?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;
  readonly onSecondaryClick?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;

  readonly onMiddleDown?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;
  readonly onMiddleUp?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;

  /**
   * Called on every pointer move. With pointer lock active this is the main
   * camera-look path and must not require a pressed mouse button.
   */
  readonly onPointerMove?: (snapshot: InputStateSnapshot, event: PointerEvent | MouseEvent) => void;

  /**
   * Wheel callback. The input controller should map this to inventory slot
   * selection; this file only captures and normalizes the wheel event.
   */
  readonly onWheel?: (snapshot: InputStateSnapshot, event: WheelEvent) => void;

  /**
   * Kept for compatibility with the existing runtime. Prefer passing pointerLock
   * directly for new code.
   */
  readonly onCanvasActivation?: (event: PointerEvent | MouseEvent) => void | Promise<void>;
}

export interface MouseInputSnapshot {
  readonly kind: "mouse-input-snapshot.v1";
  readonly status: MouseInputStatus;
  readonly enabled: boolean;
  readonly attached: boolean;
  readonly destroyed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;

  readonly pointerDownCount: number;
  readonly pointerUpCount: number;
  readonly pointerMoveCount: number;
  readonly clickCount: number;
  readonly wheelCount: number;
  readonly contextMenuCount: number;
  readonly handledCount: number;
  readonly ignoredCount: number;
  readonly suppressedActionCount: number;
  readonly pointerLockActivationCount: number;

  readonly lastButton: EditorPointerButton | null;
  readonly pressedButtons: readonly EditorPointerButton[];
  readonly pointerLocked: boolean;
  readonly pointerLockRequiredForActions: boolean;
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly normalizedX: number;
    readonly normalizedY: number;
  };
  readonly delta: {
    readonly x: number;
    readonly y: number;
  };
  readonly wheelDelta: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };

  readonly lastError: Record<string, unknown> | null;
}

export interface MouseInputHandle {
  readonly kind: "vectoplan-editor-mouse-input.v1";

  attach(): void;
  detach(reason?: string): void;

  enable(reason?: string): void;
  disable(reason?: string): void;

  handlePointerDown(event: PointerEvent | MouseEvent): void;
  handlePointerUp(event: PointerEvent | MouseEvent): void;
  handlePointerMove(event: PointerEvent | MouseEvent): void;
  handleClick(event: PointerEvent | MouseEvent): void;
  handleWheel(event: WheelEvent): void;
  handleContextMenu(event: MouseEvent): void;

  clear(reason?: string): void;

  isEnabled(): boolean;
  isAttached(): boolean;
  getStatus(): MouseInputStatus;
  getSnapshot(): MouseInputSnapshot;

  destroy(reason?: string): void;
}

const MOUSE_INPUT_KIND = "vectoplan-editor-mouse-input.v1" as const;
const MOUSE_INPUT_SNAPSHOT_KIND = "mouse-input-snapshot.v1" as const;

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Mouse logging must never break input handling.
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
    // Mouse logging must never break input handling.
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

function monotonicNowMs(): number {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }

    return Date.now();
  } catch {
    return 0;
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
        message: "Unknown mouse input error.",
      };
    }
  }
}

function supportsPointerEvents(): boolean {
  try {
    return typeof window !== "undefined" && "PointerEvent" in window;
  } catch {
    return false;
  }
}

function isHTMLElement(value: unknown): value is HTMLElement {
  try {
    return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
  } catch {
    return false;
  }
}

function isWindowTarget(value: MouseInputTarget): value is Window {
  try {
    return typeof window !== "undefined" && value === window;
  } catch {
    return false;
  }
}

function isDocumentTarget(value: MouseInputTarget): value is Document {
  try {
    return typeof document !== "undefined" && value === document;
  } catch {
    return false;
  }
}

function eventTargetElement(target: MouseInputTarget): HTMLElement | null {
  try {
    if (isHTMLElement(target)) {
      return target;
    }

    return null;
  } catch {
    return null;
  }
}

function getRectTarget(target: MouseInputTarget, fallback?: HTMLElement | null): HTMLElement | null {
  try {
    return fallback ?? eventTargetElement(target);
  } catch {
    return null;
  }
}

function getTargetRect(target: MouseInputTarget, fallback?: HTMLElement | null): DOMRect | null {
  try {
    const element = getRectTarget(target, fallback);
    return element?.getBoundingClientRect() ?? null;
  } catch {
    return null;
  }
}

function getCanvasSize(target: MouseInputTarget, fallback?: HTMLElement | null): {
  readonly width: number;
  readonly height: number;
} {
  try {
    const rect = getTargetRect(target, fallback);

    if (!rect) {
      return {
        width: 1,
        height: 1,
      };
    }

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

function getRelativePointerPosition(
  event: PointerEvent | MouseEvent | WheelEvent,
  target: MouseInputTarget,
  fallback?: HTMLElement | null,
  pointerLocked?: boolean,
): {
  readonly x: number;
  readonly y: number;
} {
  try {
    const rect = getTargetRect(target, fallback);

    if (!rect) {
      return {
        x: safeNumber(event.clientX, 0),
        y: safeNumber(event.clientY, 0),
      };
    }

    /**
     * During pointer lock, clientX/clientY can be stale or meaningless.
     * The crosshair/targeting model is center-screen, so keep the logical
     * pointer position at the center of the viewport and use movementX/Y
     * exclusively for camera look.
     */
    if (pointerLocked) {
      return {
        x: rect.width / 2,
        y: rect.height / 2,
      };
    }

    return {
      x: safeNumber(event.clientX, 0) - rect.left,
      y: safeNumber(event.clientY, 0) - rect.top,
    };
  } catch {
    return {
      x: 0,
      y: 0,
    };
  }
}

function normalizePointerButton(event: PointerEvent | MouseEvent): EditorPointerButton {
  try {
    if (event.button === 0) return "primary";
    if (event.button === 1) return "middle";
    if (event.button === 2) return "secondary";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function pointerIdFromEvent(event: PointerEvent | MouseEvent): number | null {
  try {
    if ("pointerId" in event && typeof event.pointerId === "number") {
      return event.pointerId;
    }

    return null;
  } catch {
    return null;
  }
}

function pointerEventLikeFromEvent(
  event: PointerEvent | MouseEvent,
  target: MouseInputTarget,
  fallback: HTMLElement | null | undefined,
  pointerLocked: boolean,
): PointerEventLike {
  const position = getRelativePointerPosition(event, target, fallback, pointerLocked);

  return {
    button: safeNumber(event.button, -1),
    buttons: safeNumber(event.buttons, 0),
    clientX: position.x,
    clientY: position.y,
    movementX: "movementX" in event ? safeNumber(event.movementX, 0) : 0,
    movementY: "movementY" in event ? safeNumber(event.movementY, 0) : 0,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };
}

function wheelEventLikeFromEvent(
  event: WheelEvent,
  target: MouseInputTarget,
  fallback: HTMLElement | null | undefined,
  pointerLocked: boolean,
): WheelEventLike {
  const position = getRelativePointerPosition(event, target, fallback, pointerLocked);

  return {
    button: safeNumber(event.button, -1),
    buttons: safeNumber(event.buttons, 0),
    clientX: position.x,
    clientY: position.y,
    movementX: 0,
    movementY: 0,
    deltaX: safeNumber(event.deltaX, 0),
    deltaY: safeNumber(event.deltaY, 0),
    deltaZ: safeNumber(event.deltaZ, 0),
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };
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
      || target.closest("[data-editor-ignore-mouse='true']") !== null
      || target.closest("[data-editor-ignore-pointer-lock='true']") !== null
      || target.closest("[data-editor-ui-interactive='true']") !== null
    );
  } catch {
    return false;
  }
}

function maybePreventDefault(event: Event, enabled: boolean): void {
  try {
    if (enabled) {
      event.preventDefault();
    }
  } catch {
    // Some passive/synthetic events may not allow preventDefault.
  }
}

function focusTarget(target: MouseInputTarget): void {
  try {
    const element = eventTargetElement(target);

    if (!element) {
      return;
    }

    if (element.getAttribute("tabindex") === null) {
      element.setAttribute("tabindex", "-1");
    }

    if (typeof element.focus === "function") {
      element.focus({
        preventScroll: true,
      });
    }
  } catch {
    try {
      eventTargetElement(target)?.focus?.();
    } catch {
      // Ignore focus failure.
    }
  }
}

function trySetPointerCapture(target: MouseInputTarget, event: PointerEvent | MouseEvent): void {
  try {
    if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent)) {
      return;
    }

    const element = eventTargetElement(target);

    if (!element || typeof element.setPointerCapture !== "function") {
      return;
    }

    element.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best-effort.
  }
}

function tryReleasePointerCapture(target: MouseInputTarget, event: PointerEvent | MouseEvent): void {
  try {
    if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent)) {
      return;
    }

    const element = eventTargetElement(target);

    if (!element || typeof element.releasePointerCapture !== "function") {
      return;
    }

    if (element.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  } catch {
    // Pointer capture is best-effort.
  }
}

function addEventTargetListener(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options: AddEventListenerOptions,
): () => void {
  try {
    target.addEventListener(type, listener, options);

    return () => {
      try {
        target.removeEventListener(type, listener, options);
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

    return addEventTargetListener(window, type, listener, options);
  } catch {
    return () => undefined;
  }
}

function dispatchButtonsToStore(
  store: EditorStore | undefined,
  snapshot: InputStateSnapshot,
  phase: "down" | "up" | "move",
  source: string,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "input/buttons",
        pressedButtons: snapshot.pointer.pressedButtons,
        lastPointerButton: snapshot.pointer.lastButton,
        phase,
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
    // Store updates must not break mouse input.
  }
}

function dispatchPointerDeltaToStore(
  store: EditorStore | undefined,
  snapshot: InputStateSnapshot,
  source: string,
  deltaOverride?: {
    readonly x: number;
    readonly y: number;
  },
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "input/pointer-delta",
        mouseDeltaX: deltaOverride?.x ?? snapshot.pointer.lookDelta.x,
        mouseDeltaY: deltaOverride?.y ?? snapshot.pointer.lookDelta.y,
        wheelDelta: snapshot.wheel.delta.y,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: source !== "mouse.pointer-move",
        captureHistory: false,
      },
    );
  } catch {
    // Store updates must not break mouse input.
  }
}

function dispatchResetDeltasToStore(
  store: EditorStore | undefined,
  source: string,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "input/reset-deltas",
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
    // Store updates must not break mouse input.
  }
}

function invokeButtonCallback(
  button: EditorPointerButton,
  phase: "down" | "up" | "click",
  options: MouseInputOptions,
  snapshot: InputStateSnapshot,
  event: PointerEvent | MouseEvent,
): void {
  try {
    if (button === "primary" && phase === "down") options.onPrimaryDown?.(snapshot, event);
    if (button === "primary" && phase === "up") options.onPrimaryUp?.(snapshot, event);
    if (button === "primary" && phase === "click") options.onPrimaryClick?.(snapshot, event);

    if (button === "secondary" && phase === "down") options.onSecondaryDown?.(snapshot, event);
    if (button === "secondary" && phase === "up") options.onSecondaryUp?.(snapshot, event);
    if (button === "secondary" && phase === "click") options.onSecondaryClick?.(snapshot, event);

    if (button === "middle" && phase === "down") options.onMiddleDown?.(snapshot, event);
    if (button === "middle" && phase === "up") options.onMiddleUp?.(snapshot, event);
  } catch (error) {
    logWarn(options.logger, "Mouse button callback failed.", {
      button,
      phase,
      error: normalizeErrorRecord(error),
    });
  }
}

function snapshotPressedButtons(snapshot: InputStateSnapshot): readonly EditorPointerButton[] {
  try {
    return snapshot.pointer.pressedButtons;
  } catch {
    return [];
  }
}

function targetLabel(target: MouseInputTarget): string {
  try {
    if (isWindowTarget(target)) {
      return "window";
    }

    if (isDocumentTarget(target)) {
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

function eventIsInsideElement(event: Event, element: HTMLElement | null): boolean {
  try {
    if (!element) {
      return true;
    }

    const target = event.target;

    if (!target || !(target instanceof Node)) {
      return true;
    }

    return target === element || element.contains(target);
  } catch {
    return true;
  }
}

export function createMouseInput(options: MouseInputOptions): MouseInputHandle {
  const inputState = options.inputState;
  const store = options.store;
  const logger = options.logger;
  const target = options.target;
  const canvasHost = options.canvasHost ?? eventTargetElement(target);
  const pointerLock = options.pointerLock ?? null;

  const preventDefault = safeBoolean(options.preventDefault, true);
  const preventContextMenu = safeBoolean(options.preventContextMenu, true);
  const focusOnPointerDown = safeBoolean(options.focusOnPointerDown, true);
  const capturePointer = safeBoolean(options.capturePointer, true);
  const dispatchToStore = safeBoolean(options.dispatchToStore, true);
  const listenOnWindowForPointerUp = safeBoolean(options.listenOnWindowForPointerUp, true);
  const listenOnWindowForPointerMove = safeBoolean(options.listenOnWindowForPointerMove, true);
  const ignoreEditableTargets = safeBoolean(options.ignoreEditableTargets, true);
  const passiveMove = safeBoolean(options.passiveMove, false);

  const requestPointerLockOnPointerDown = safeBoolean(
    options.requestPointerLockOnPointerDown,
    pointerLock !== null,
  );
  const requirePointerLockForActions = safeBoolean(
    options.requirePointerLockForActions,
    pointerLock !== null,
  );
  const suppressPrimaryActionOnPointerLockActivation = safeBoolean(
    options.suppressPrimaryActionOnPointerLockActivation,
    true,
  );
  const suppressClickAfterActivationMs = Math.max(
    0,
    safeNumber(options.suppressClickAfterActivationMs, 450),
  );
  const pointerStoreSyncIntervalMs = 50;

  const defaultListenerOptions: AddEventListenerOptions = {
    capture: false,
    passive: false,
  };

  const moveListenerOptions: AddEventListenerOptions = {
    capture: false,
    passive: passiveMove,
  };

  const createdAt = now();

  let status: MouseInputStatus = "created";
  let enabled = safeBoolean(options.enabled, true);
  let attached = false;
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;

  let pointerDownCount = 0;
  let pointerUpCount = 0;
  let pointerMoveCount = 0;
  let clickCount = 0;
  let wheelCount = 0;
  let contextMenuCount = 0;
  let handledCount = 0;
  let ignoredCount = 0;
  let suppressedActionCount = 0;
  let pointerLockActivationCount = 0;
  let lastButton: EditorPointerButton | null = null;
  let lastError: Record<string, unknown> | null = null;
  let pendingPointerStoreSnapshot: InputStateSnapshot | null = null;
  let pendingPointerStoreSource = "mouse.pointer-move";
  let pendingPointerStoreDeltaX = 0;
  let pendingPointerStoreDeltaY = 0;
  let pointerStoreTimerId: number | null = null;
  let lastPointerStoreDispatchAtMs = -Infinity;

  let suppressActivationUntilMs = 0;
  let suppressedActivationButton: EditorPointerButton | null = null;
  let suppressedActivationPointerId: number | null = null;

  const cleanupCallbacks: Array<() => void> = [];
  const processedEvents = new WeakSet<Event>();

  function setStatus(nextStatus: MouseInputStatus): void {
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

  function cancelPendingPointerStoreDispatch(): void {
    if (pointerStoreTimerId !== null) {
      window.clearTimeout(pointerStoreTimerId);
      pointerStoreTimerId = null;
    }
    pendingPointerStoreSnapshot = null;
    pendingPointerStoreDeltaX = 0;
    pendingPointerStoreDeltaY = 0;
  }

  function flushPointerStoreDispatch(): void {
    pointerStoreTimerId = null;
    const snapshot = pendingPointerStoreSnapshot;
    const deltaX = pendingPointerStoreDeltaX;
    const deltaY = pendingPointerStoreDeltaY;
    pendingPointerStoreSnapshot = null;
    pendingPointerStoreDeltaX = 0;
    pendingPointerStoreDeltaY = 0;

    if (!snapshot || destroyed || !dispatchToStore) {
      return;
    }

    lastPointerStoreDispatchAtMs = monotonicNowMs();
    dispatchPointerDeltaToStore(
      store,
      snapshot,
      pendingPointerStoreSource,
      { x: deltaX, y: deltaY },
    );
  }

  function schedulePointerStoreDispatch(
    snapshot: InputStateSnapshot,
    source: string,
  ): void {
    pendingPointerStoreSnapshot = snapshot;
    pendingPointerStoreSource = source;
    pendingPointerStoreDeltaX += snapshot.pointer.lookDelta.x;
    pendingPointerStoreDeltaY += snapshot.pointer.lookDelta.y;

    if (pointerStoreTimerId !== null) {
      return;
    }

    const elapsedMs = monotonicNowMs() - lastPointerStoreDispatchAtMs;
    const delayMs = Math.max(0, pointerStoreSyncIntervalMs - elapsedMs);
    pointerStoreTimerId = window.setTimeout(flushPointerStoreDispatch, delayMs);
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed") {
      logWarn(logger, "Mouse input action ignored because controller is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function markProcessed(event: Event): boolean {
    try {
      if (processedEvents.has(event)) {
        return false;
      }

      processedEvents.add(event);
      return true;
    } catch {
      return true;
    }
  }

  function isPointerLocked(): boolean {
    try {
      if (pointerLock) {
        return pointerLock.isLocked();
      }

      return inputState.getSnapshot().pointer.pointerLocked;
    } catch {
      return false;
    }
  }

  function shouldIgnoreEvent(event: Event): boolean {
    try {
      if (!enabled) {
        ignoredCount += 1;
        return true;
      }

      if (ignoreEditableTargets && isEditableTarget(event.target)) {
        ignoredCount += 1;
        return true;
      }

      /**
       * If the listener is attached to window as fallback, normal non-locked
       * pointermove events outside the canvas should not drive the editor.
       * Pointer lock is exempt because movement is no longer spatially tied
       * to the original DOM target.
       */
      if (!isPointerLocked() && event.type.includes("move") && !eventIsInsideElement(event, canvasHost)) {
        ignoredCount += 1;
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  function canvasUpdateOptions(): {
    readonly timestamp: string;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
  } {
    const size = getCanvasSize(target, canvasHost);

    return {
      timestamp: now(),
      canvasWidth: size.width,
      canvasHeight: size.height,
    };
  }

  function afterPointerSnapshot(
    snapshot: InputStateSnapshot,
    source: string,
    phase: "down" | "up" | "move" | null,
  ): void {
    try {
      lastButton = snapshot.pointer.lastButton;
      updatedAt = now();

      if (dispatchToStore && phase && phase !== "move") {
        dispatchButtonsToStore(store, snapshot, phase, source);
      }

      if (dispatchToStore && phase === "move") {
        schedulePointerStoreDispatch(snapshot, source);
      }
    } catch (error) {
      setError(error);
    }
  }

  function shouldSuppressAction(
    button: EditorPointerButton,
    phase: "down" | "up" | "click",
    event: PointerEvent | MouseEvent,
    lockedBeforeEvent: boolean,
  ): boolean {
    try {
      if (button === "unknown") {
        return true;
      }

      if (!requirePointerLockForActions) {
        return false;
      }

      const lockedNow = isPointerLocked();

      if (!lockedBeforeEvent && !lockedNow) {
        suppressedActionCount += 1;
        return true;
      }

      if (suppressPrimaryActionOnPointerLockActivation && button === "primary") {
        const nowMs = monotonicNowMs();
        const eventPointerId = pointerIdFromEvent(event);

        const matchesSuppressedActivation =
          nowMs <= suppressActivationUntilMs
          && suppressedActivationButton === button
          && (
            suppressedActivationPointerId === null
            || eventPointerId === null
            || suppressedActivationPointerId === eventPointerId
          );

        if (matchesSuppressedActivation && (phase === "down" || phase === "up" || phase === "click")) {
          suppressedActionCount += 1;
          return true;
        }
      }

      return false;
    } catch {
      suppressedActionCount += 1;
      return true;
    }
  }

  async function requestPointerLockForActivation(event: PointerEvent | MouseEvent): Promise<void> {
    try {
      if (!pointerLock || !requestPointerLockOnPointerDown || pointerLock.isLocked()) {
        return;
      }

      const button = normalizePointerButton(event);

      if (button !== "primary") {
        return;
      }

      pointerLockActivationCount += 1;

      if (suppressPrimaryActionOnPointerLockActivation) {
        suppressActivationUntilMs = monotonicNowMs() + suppressClickAfterActivationMs;
        suppressedActivationButton = button;
        suppressedActivationPointerId = pointerIdFromEvent(event);
      }

      if (typeof pointerLock.requestLockFromEvent === "function") {
        await pointerLock.requestLockFromEvent(event, "mouse-input.pointerdown");
      } else {
        await pointerLock.requestLock("mouse-input.pointerdown");
      }
    } catch (error) {
      setError(error);
      logWarn(logger, "Pointer lock activation from mouse input failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function maybeInvokeLegacyCanvasActivation(event: PointerEvent | MouseEvent): void {
    try {
      /**
       * Avoid duplicate pointer-lock requests in the new path.
       * Older wiring can still use onCanvasActivation when no PointerLockHandle
       * was provided.
       */
      if (pointerLock && requestPointerLockOnPointerDown) {
        return;
      }

      void options.onCanvasActivation?.(event);
    } catch (error) {
      logWarn(logger, "Canvas activation callback failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handlePointerDown(event: PointerEvent | MouseEvent): void {
    if (!assertAlive("handlePointerDown")) {
      return;
    }

    try {
      if (!markProcessed(event)) {
        return;
      }

      if (shouldIgnoreEvent(event)) {
        return;
      }

      const lockedBeforeEvent = isPointerLocked();

      maybePreventDefault(event, preventDefault);

      if (focusOnPointerDown) {
        focusTarget(target);
      }

      if (capturePointer && !lockedBeforeEvent) {
        trySetPointerCapture(target, event);
      }

      void requestPointerLockForActivation(event);
      maybeInvokeLegacyCanvasActivation(event);

      pointerDownCount += 1;
      handledCount += 1;

      const snapshot = inputState.pointerDown(
        pointerEventLikeFromEvent(event, target, canvasHost, lockedBeforeEvent),
        canvasUpdateOptions(),
      );

      const button = normalizePointerButton(event);
      afterPointerSnapshot(snapshot, "mouse.pointer-down", "down");

      if (!shouldSuppressAction(button, "down", event, lockedBeforeEvent)) {
        invokeButtonCallback(button, "down", options, snapshot, event);
      }

      setStatus("active");
    } catch (error) {
      setError(error);
      logWarn(logger, "Mouse pointerdown handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handlePointerUp(event: PointerEvent | MouseEvent): void {
    if (!assertAlive("handlePointerUp")) {
      return;
    }

    try {
      if (!markProcessed(event)) {
        return;
      }

      const lockedBeforeEvent = isPointerLocked();

      maybePreventDefault(event, preventDefault);

      if (capturePointer && !lockedBeforeEvent) {
        tryReleasePointerCapture(target, event);
      }

      pointerUpCount += 1;
      handledCount += 1;

      const snapshot = inputState.pointerUp(
        pointerEventLikeFromEvent(event, target, canvasHost, lockedBeforeEvent),
        canvasUpdateOptions(),
      );

      const button = normalizePointerButton(event);
      afterPointerSnapshot(snapshot, "mouse.pointer-up", "up");

      if (!shouldSuppressAction(button, "up", event, lockedBeforeEvent)) {
        invokeButtonCallback(button, "up", options, snapshot, event);
      }

      setStatus(snapshot.pointer.pressedButtons.length > 0 ? "active" : "attached");
    } catch (error) {
      setError(error);
      logWarn(logger, "Mouse pointerup handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handlePointerMove(event: PointerEvent | MouseEvent): void {
    if (!assertAlive("handlePointerMove")) {
      return;
    }

    try {
      if (!markProcessed(event)) {
        return;
      }

      if (!enabled) {
        ignoredCount += 1;
        return;
      }

      if (ignoreEditableTargets && isEditableTarget(event.target)) {
        ignoredCount += 1;
        return;
      }

      const lockedBeforeEvent = isPointerLocked();

      if (!lockedBeforeEvent && event.type.includes("move") && !eventIsInsideElement(event, canvasHost)) {
        ignoredCount += 1;
        return;
      }

      pointerMoveCount += 1;

      if (!passiveMove) {
        maybePreventDefault(event, preventDefault);
      }

      const snapshot = inputState.pointerMove(
        pointerEventLikeFromEvent(event, target, canvasHost, lockedBeforeEvent),
        canvasUpdateOptions(),
      );

      afterPointerSnapshot(snapshot, "mouse.pointer-move", "move");
      options.onPointerMove?.(snapshot, event);

      /**
       * Important for Hytale/Minecraft-style camera:
       * pointer lock movement is active camera look even without pressed buttons.
       */
      setStatus(
        lockedBeforeEvent
          ? "active"
          : snapshot.pointer.pressedButtons.length > 0
            ? "dragging"
            : "active",
      );
    } catch (error) {
      setError(error);
      logWarn(logger, "Mouse pointermove handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handleClick(event: PointerEvent | MouseEvent): void {
    if (!assertAlive("handleClick")) {
      return;
    }

    try {
      if (!markProcessed(event)) {
        return;
      }

      if (shouldIgnoreEvent(event)) {
        return;
      }

      const lockedBeforeEvent = isPointerLocked();

      maybePreventDefault(event, preventDefault);

      clickCount += 1;
      handledCount += 1;

      const snapshot = inputState.pointerClick(
        pointerEventLikeFromEvent(event, target, canvasHost, lockedBeforeEvent),
        canvasUpdateOptions(),
      );

      const button = normalizePointerButton(event);
      afterPointerSnapshot(snapshot, "mouse.click", null);

      if (!shouldSuppressAction(button, "click", event, lockedBeforeEvent)) {
        invokeButtonCallback(button, "click", options, snapshot, event);
      }

      setStatus("active");
    } catch (error) {
      setError(error);
      logWarn(logger, "Mouse click handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handleWheel(event: WheelEvent): void {
    if (!assertAlive("handleWheel")) {
      return;
    }

    try {
      if (!markProcessed(event)) {
        return;
      }

      if (shouldIgnoreEvent(event)) {
        return;
      }

      const lockedBeforeEvent = isPointerLocked();

      maybePreventDefault(event, preventDefault);

      wheelCount += 1;
      handledCount += 1;

      const snapshot = inputState.wheel(
        wheelEventLikeFromEvent(event, target, canvasHost, lockedBeforeEvent),
        canvasUpdateOptions(),
      );

      if (dispatchToStore) {
        dispatchPointerDeltaToStore(store, snapshot, "mouse.wheel");
      }

      options.onWheel?.(snapshot, event);

      setStatus("active");
    } catch (error) {
      setError(error);
      logWarn(logger, "Mouse wheel handling failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function handleContextMenu(event: MouseEvent): void {
    if (!assertAlive("handleContextMenu")) {
      return;
    }

    try {
      contextMenuCount += 1;

      if (preventContextMenu) {
        event.preventDefault();
        handledCount += 1;
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

  const controller: MouseInputHandle = {
    kind: MOUSE_INPUT_KIND,

    attach(): void {
      if (!assertAlive("attach")) {
        return;
      }

      if (attached) {
        return;
      }

      try {
        const hasPointerEvents = supportsPointerEvents();

        if (hasPointerEvents) {
          cleanupCallbacks.push(addEventTargetListener(target, "pointerdown", handlePointerDown as EventListener, defaultListenerOptions));
          cleanupCallbacks.push(addEventTargetListener(target, "pointermove", handlePointerMove as EventListener, moveListenerOptions));
          cleanupCallbacks.push(addEventTargetListener(target, "click", handleClick as EventListener, defaultListenerOptions));

          if (listenOnWindowForPointerMove) {
            cleanupCallbacks.push(addWindowListener("pointermove", handlePointerMove as EventListener, moveListenerOptions));
          }

          if (listenOnWindowForPointerUp) {
            cleanupCallbacks.push(addWindowListener("pointerup", handlePointerUp as EventListener, defaultListenerOptions));
            cleanupCallbacks.push(addWindowListener("pointercancel", handlePointerUp as EventListener, defaultListenerOptions));
          } else {
            cleanupCallbacks.push(addEventTargetListener(target, "pointerup", handlePointerUp as EventListener, defaultListenerOptions));
            cleanupCallbacks.push(addEventTargetListener(target, "pointercancel", handlePointerUp as EventListener, defaultListenerOptions));
          }
        } else {
          cleanupCallbacks.push(addEventTargetListener(target, "mousedown", handlePointerDown as EventListener, defaultListenerOptions));
          cleanupCallbacks.push(addEventTargetListener(target, "mousemove", handlePointerMove as EventListener, moveListenerOptions));
          cleanupCallbacks.push(addEventTargetListener(target, "click", handleClick as EventListener, defaultListenerOptions));

          if (listenOnWindowForPointerMove) {
            cleanupCallbacks.push(addWindowListener("mousemove", handlePointerMove as EventListener, moveListenerOptions));
          }

          if (listenOnWindowForPointerUp) {
            cleanupCallbacks.push(addWindowListener("mouseup", handlePointerUp as EventListener, defaultListenerOptions));
          } else {
            cleanupCallbacks.push(addEventTargetListener(target, "mouseup", handlePointerUp as EventListener, defaultListenerOptions));
          }
        }

        cleanupCallbacks.push(addEventTargetListener(target, "wheel", handleWheel as EventListener, defaultListenerOptions));
        cleanupCallbacks.push(addEventTargetListener(target, "contextmenu", handleContextMenu as EventListener, defaultListenerOptions));

        attachAbortSignal();

        attached = true;
        setStatus(enabled ? "attached" : "disabled");

        logDebug(logger, "Mouse input attached.", {
          enabled,
          target: targetLabel(target),
          pointerEvents: hasPointerEvents,
          preventDefault,
          preventContextMenu,
          focusOnPointerDown,
          capturePointer,
          listenOnWindowForPointerUp,
          listenOnWindowForPointerMove,
          passiveMove,
          pointerLockProvided: pointerLock !== null,
          requestPointerLockOnPointerDown,
          requirePointerLockForActions,
          suppressPrimaryActionOnPointerLockActivation,
          suppressClickAfterActivationMs,
        });
      } catch (error) {
        setError(error);
        logWarn(logger, "Mouse input attach failed.", {
          error: normalizeErrorRecord(error),
        });
      }
    },

    detach(reason?: string): void {
      if (destroyed) {
        return;
      }

      detachListeners();
      cancelPendingPointerStoreDispatch();

      try {
        inputState.clearPointerButtons();
        inputState.resetDeltas();
        cancelPendingPointerStoreDispatch();

        if (dispatchToStore) {
          dispatchResetDeltasToStore(store, "mouse.detach");
        }
      } catch {
        // Ignore detach state cleanup failure.
      }

      setStatus(enabled ? "detached" : "disabled");

      logDebug(logger, "Mouse input detached.", {
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
          pointer: true,
          wheel: true,
        });
        setStatus(attached ? "attached" : "created");

        logDebug(logger, "Mouse input enabled.", {
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
          pointer: false,
          wheel: false,
        });
        inputState.clearPointerButtons();
        inputState.resetDeltas();
        cancelPendingPointerStoreDispatch();

        suppressActivationUntilMs = 0;
        suppressedActivationButton = null;
        suppressedActivationPointerId = null;

        if (dispatchToStore) {
          dispatchResetDeltasToStore(store, "mouse.disable");
        }

        setStatus("disabled");

        logDebug(logger, "Mouse input disabled.", {
          reason: reason ?? null,
        });
      } catch (error) {
        setError(error);
      }
    },

    handlePointerDown,
    handlePointerUp,
    handlePointerMove,
    handleClick,
    handleWheel,
    handleContextMenu,

    clear(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        inputState.clearPointerButtons();
        inputState.resetDeltas();
        cancelPendingPointerStoreDispatch();

        suppressActivationUntilMs = 0;
        suppressedActivationButton = null;
        suppressedActivationPointerId = null;

        if (dispatchToStore) {
          dispatchResetDeltasToStore(store, "mouse.clear");
        }

        setStatus(enabled ? "attached" : "disabled");

        logDebug(logger, "Mouse input cleared.", {
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

    getStatus(): MouseInputStatus {
      return status;
    },

    getSnapshot(): MouseInputSnapshot {
      const snapshot = inputState.getSnapshot();

      return {
        kind: MOUSE_INPUT_SNAPSHOT_KIND,
        status,
        enabled,
        attached,
        destroyed,
        createdAt,
        updatedAt,
        destroyedAt,
        pointerDownCount,
        pointerUpCount,
        pointerMoveCount,
        clickCount,
        wheelCount,
        contextMenuCount,
        handledCount,
        ignoredCount,
        suppressedActionCount,
        pointerLockActivationCount,
        lastButton,
        pressedButtons: snapshotPressedButtons(snapshot),
        pointerLocked: snapshot.pointer.pointerLocked,
        pointerLockRequiredForActions: requirePointerLockForActions,
        position: snapshot.pointer.position,
        delta: snapshot.pointer.lookDelta,
        wheelDelta: snapshot.wheel.delta,
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
      cancelPendingPointerStoreDispatch();

      try {
        inputState.clearPointerButtons();
        inputState.resetDeltas();
      } catch {
        // Ignore destroy state cleanup failure.
      }

      setStatus("destroyed");

      logDebug(logger, "Mouse input destroyed.", {
        reason: reason ?? null,
        pointerDownCount,
        pointerUpCount,
        pointerMoveCount,
        clickCount,
        wheelCount,
        contextMenuCount,
        handledCount,
        ignoredCount,
        suppressedActionCount,
        pointerLockActivationCount,
        inputState: inputSnapshotToDebugSummary(inputState.getSnapshot()),
      });
    },
  };

  return controller;
}

export function isMouseInputHandle(value: unknown): value is MouseInputHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<MouseInputHandle>;

    return (
      record.kind === MOUSE_INPUT_KIND
      && typeof record.attach === "function"
      && typeof record.handlePointerDown === "function"
      && typeof record.handlePointerMove === "function"
      && typeof record.handleWheel === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}
