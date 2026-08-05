// services/vectoplan-editor/src/frontend/input/pointer_lock.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { InputStateHandle } from "./input_state";

export type PointerLockStatus =
  | "created"
  | "attached"
  | "requesting"
  | "locked"
  | "unlocked"
  | "unavailable"
  | "failed"
  | "destroyed";

export type PointerLockRequestReason =
  | "manual"
  | "target-click"
  | "target-pointerdown"
  | "input-controller"
  | "scene-runtime"
  | "already-locked"
  | "attach"
  | "detach"
  | "disable"
  | "destroy"
  | "abort-signal"
  | "visibilitychange"
  | "pointerlockchange"
  | "unknown"
  | string;

export interface PointerLockOptions {
  readonly target: HTMLElement;
  readonly inputState: InputStateHandle;
  readonly store?: EditorStore;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly enabled?: boolean;
  readonly requestOnClick?: boolean;
  readonly requestOnPointerDown?: boolean;
  readonly preventDefaultOnActivation?: boolean;
  readonly exitOnDestroy?: boolean;
  readonly unadjustedMovement?: boolean;
  readonly dispatchToStore?: boolean;

  readonly onLocked?: () => void;
  readonly onUnlocked?: () => void;
  readonly onError?: (error: unknown) => void;
}

export interface PointerLockSnapshot {
  readonly kind: "pointer-lock-snapshot.v1";
  readonly status: PointerLockStatus;
  readonly available: boolean;
  readonly enabled: boolean;
  readonly locked: boolean;
  readonly attached: boolean;
  readonly destroyed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly requestCount: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly changeCount: number;
  readonly lastRequestedAt: string | null;
  readonly lastLockedAt: string | null;
  readonly lastUnlockedAt: string | null;
  readonly lastErrorAt: string | null;
  readonly targetTagName: string | null;
  readonly targetId: string | null;
  readonly lastReason: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface PointerLockHandle {
  readonly kind: "vectoplan-editor-pointer-lock.v1";

  attach(): void;
  detach(reason?: PointerLockRequestReason): void;

  enable(reason?: PointerLockRequestReason): void;
  disable(reason?: PointerLockRequestReason): void;

  requestLock(reason?: PointerLockRequestReason): Promise<boolean>;
  requestLockFromEvent(event: MouseEvent | PointerEvent, reason?: PointerLockRequestReason): Promise<boolean>;

  exitLock(reason?: PointerLockRequestReason): Promise<boolean>;
  syncFromDocument(reason?: PointerLockRequestReason): boolean;

  isAvailable(): boolean;
  isEnabled(): boolean;
  isAttached(): boolean;
  isLocked(): boolean;
  getStatus(): PointerLockStatus;
  getSnapshot(): PointerLockSnapshot;

  destroy(reason?: PointerLockRequestReason): Promise<void>;
}

const POINTER_LOCK_KIND = "vectoplan-editor-pointer-lock.v1" as const;
const POINTER_LOCK_SNAPSHOT_KIND = "pointer-lock-snapshot.v1" as const;
const POINTER_LOCK_WAIT_TIMEOUT_MS = 750;

type PointerLockRequestOptions = {
  readonly unadjustedMovement?: boolean;
};

type PointerLockRequestFunction = (options?: PointerLockRequestOptions) => void | Promise<void>;
type PointerLockExitFunction = () => void | Promise<void>;

type PointerLockTarget = HTMLElement & {
  readonly requestPointerLock: PointerLockRequestFunction;
};

type PointerLockDocumentLike = Document & {
  readonly pointerLockElement: Element | null;
  readonly exitPointerLock: PointerLockExitFunction;
};

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

function normalizeReason(reason: PointerLockRequestReason | undefined, fallback: string): string {
  try {
    const value = safeString(reason, "").trim();
    return value || fallback;
  } catch {
    return fallback;
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
        message: "Unknown pointer lock error.",
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
    // Logging must never break editor runtime.
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
    // Logging must never break editor runtime.
  }
}

function getPointerLockDocument(): PointerLockDocumentLike | null {
  try {
    if (typeof document === "undefined") {
      return null;
    }

    return document as PointerLockDocumentLike;
  } catch {
    return null;
  }
}

function getWindow(): Window | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    return window;
  } catch {
    return null;
  }
}

function hasPointerLockRequest(target: HTMLElement): target is PointerLockTarget {
  try {
    return typeof (target as { readonly requestPointerLock?: unknown }).requestPointerLock === "function";
  } catch {
    return false;
  }
}

function supportsPointerLock(target: HTMLElement): boolean {
  try {
    const doc = getPointerLockDocument();

    if (!doc) {
      return false;
    }

    return (
      "pointerLockElement" in doc
      && hasPointerLockRequest(target)
      && typeof doc.exitPointerLock === "function"
    );
  } catch {
    return false;
  }
}

function currentPointerLockElement(): Element | null {
  try {
    return getPointerLockDocument()?.pointerLockElement ?? null;
  } catch {
    return null;
  }
}

function isTargetLocked(target: HTMLElement): boolean {
  try {
    return currentPointerLockElement() === target;
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

function eventTargetIsEditable(target: EventTarget | null): boolean {
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
      || target.isContentEditable
      || target.closest("[contenteditable='true']") !== null
      || target.closest("[data-editor-ignore-pointer-lock='true']") !== null
      || target.closest("[data-editor-ui-interactive='true']") !== null
    );
  } catch {
    return false;
  }
}

function shouldIgnoreActivationEvent(event: MouseEvent | PointerEvent): boolean {
  try {
    /**
     * Do not ignore defaultPrevented here.
     *
     * mouse_input.ts intentionally calls preventDefault() before requesting pointer lock
     * to prevent text selection/context side effects. Browser user activation is still
     * valid in the same event stack, so ignoring defaultPrevented prevents Minecraft-style
     * pointer lock from ever starting.
     */
    if (eventTargetIsEditable(event.target)) {
      return true;
    }

    if (typeof event.button === "number" && event.button !== 0) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function dispatchPointerLockToStore(
  store: EditorStore | undefined,
  input: {
    readonly locked: boolean;
    readonly available: boolean;
    readonly source: string;
  },
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "input/pointer-lock",
        pointerLocked: input.locked,
        pointerLockAvailable: input.available,
        createdAt: now(),
        source: input.source,
      }),
      {
        action: input.source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store update must never break pointer lock state.
  }
}

function dispatchDebugWarning(
  store: EditorStore | undefined,
  warning: string,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "debug/warning",
        warning,
        createdAt: now(),
        source: "pointer-lock",
      }),
      {
        action: "pointer-lock.warning",
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Debug dispatch is best-effort.
  }
}

function dispatchDebugError(
  store: EditorStore | undefined,
  error: unknown,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "debug/error",
        error,
        createdAt: now(),
        source: "pointer-lock",
      }),
      {
        action: "pointer-lock.error",
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Debug dispatch is best-effort.
  }
}

function ensureFocusableTarget(target: HTMLElement): void {
  try {
    const existingTabIndex = target.getAttribute("tabindex");

    if (existingTabIndex === null) {
      target.setAttribute("tabindex", "-1");
    }
  } catch {
    // Focusability is best-effort.
  }
}

function tryFocusTarget(target: HTMLElement): void {
  try {
    ensureFocusableTarget(target);

    if (typeof target.focus === "function") {
      target.focus({
        preventScroll: true,
      });
    }
  } catch {
    try {
      target.focus();
    } catch {
      // Ignore focus failure.
    }
  }
}

function promiseFromMaybeVoid(value: void | Promise<void>): Promise<void> {
  try {
    if (value && typeof (value as Promise<void>).then === "function") {
      return value as Promise<void>;
    }

    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

function readElementTagName(target: HTMLElement): string | null {
  try {
    return safeString(target.tagName, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function readElementId(target: HTMLElement): string | null {
  try {
    return safeString(target.id, "") || null;
  } catch {
    return null;
  }
}

function delayPointerLockResult(target: HTMLElement, timeoutMs = POINTER_LOCK_WAIT_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const doc = getPointerLockDocument();

      if (!doc) {
        resolve(false);
        return;
      }

      if (isTargetLocked(target)) {
        resolve(true);
        return;
      }

      let settled = false;
      let timeoutId: number | null = null;

      const cleanup = (): void => {
        try {
          doc.removeEventListener("pointerlockchange", handleChange);
          doc.removeEventListener("pointerlockerror", handleError);
        } catch {
          // Ignore cleanup failure.
        }

        try {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
        } catch {
          // Ignore timeout cleanup failure.
        }
      };

      const settle = (locked: boolean): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(locked);
      };

      const handleChange = (): void => {
        settle(isTargetLocked(target));
      };

      const handleError = (): void => {
        settle(false);
      };

      doc.addEventListener("pointerlockchange", handleChange);
      doc.addEventListener("pointerlockerror", handleError);

      timeoutId = window.setTimeout(() => {
        settle(isTargetLocked(target));
      }, Math.max(50, timeoutMs));
    } catch {
      resolve(isTargetLocked(target));
    }
  });
}

function shouldRetryPointerLockWithoutUnadjustedMovement(error: unknown): boolean {
  try {
    const message = error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

    return (
      message.includes("unadjusted")
      || message.includes("movement")
      || message.includes("not supported")
      || message.includes("unsupported")
      || message.includes("permission")
      || message.includes("option")
      || message.includes("raw")
    );
  } catch {
    return true;
  }
}

async function requestPointerLockOnce(
  target: HTMLElement,
  useUnadjustedMovement: boolean,
): Promise<boolean> {
  if (!hasPointerLockRequest(target)) {
    throw new Error("requestPointerLock is not available on target.");
  }

  if (useUnadjustedMovement) {
    await promiseFromMaybeVoid(target.requestPointerLock({
      unadjustedMovement: true,
    }));
  } else {
    await promiseFromMaybeVoid(target.requestPointerLock());
  }

  return delayPointerLockResult(target);
}

async function requestPointerLockWithFallback(
  target: HTMLElement,
  unadjustedMovement: boolean,
): Promise<void> {
  if (!hasPointerLockRequest(target)) {
    throw new Error("requestPointerLock is not available on target.");
  }

  if (!unadjustedMovement) {
    const locked = await requestPointerLockOnce(target, false);

    if (!locked) {
      throw new Error("Pointer lock request completed but the target was not locked.");
    }

    return;
  }

  try {
    const lockedWithUnadjustedMovement = await requestPointerLockOnce(target, true);

    if (lockedWithUnadjustedMovement) {
      return;
    }
  } catch (error) {
    if (!shouldRetryPointerLockWithoutUnadjustedMovement(error)) {
      throw error;
    }
  }

  const lockedWithoutUnadjustedMovement = await requestPointerLockOnce(target, false);

  if (!lockedWithoutUnadjustedMovement) {
    throw new Error("Pointer lock request fallback completed but the target was not locked.");
  }
}

export function createPointerLock(options: PointerLockOptions): PointerLockHandle {
  const target = options.target;
  const inputState = options.inputState;
  const store = options.store;
  const logger = options.logger;

  const createdAt = now();
  const exitOnDestroy = options.exitOnDestroy ?? true;
  const requestOnClick = options.requestOnClick ?? true;
  const requestOnPointerDown = options.requestOnPointerDown ?? false;
  const preventDefaultOnActivation = options.preventDefaultOnActivation ?? false;
  const unadjustedMovement = options.unadjustedMovement ?? false;
  const dispatchToStore = options.dispatchToStore ?? true;

  let enabled = safeBoolean(options.enabled, true);
  let available = supportsPointerLock(target);
  let status: PointerLockStatus = available ? "created" : "unavailable";
  let attached = false;
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;

  let requestCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let changeCount = 0;

  let lastRequestedAt: string | null = null;
  let lastLockedAt: string | null = null;
  let lastUnlockedAt: string | null = null;
  let lastErrorAt: string | null = null;
  let lastReason: string | null = null;
  let lastError: Record<string, unknown> | null = null;
  let lastKnownLocked = isTargetLocked(target);
  let pendingRequest: Promise<boolean> | null = null;

  const cleanupCallbacks: Array<() => void> = [];

  function setStatus(nextStatus: PointerLockStatus, reason?: PointerLockRequestReason): void {
    try {
      status = nextStatus;
      updatedAt = now();
      lastReason = normalizeReason(reason, nextStatus);

      target.dataset.pointerLockStatus = nextStatus;
      target.dataset.pointerLockEnabled = enabled ? "true" : "false";
      target.dataset.pointerLockAvailable = available ? "true" : "false";
      target.dataset.pointerLockAttached = attached ? "true" : "false";
      target.dataset.pointerLockLocked = isTargetLocked(target) ? "true" : "false";
      target.dataset.pointerLockUpdatedAt = updatedAt;
      target.dataset.pointerLockLastReason = lastReason;
    } catch {
      try {
        status = nextStatus;
        updatedAt = now();
        lastReason = normalizeReason(reason, nextStatus);
      } catch {
        // Ignore diagnostic update failure.
      }
    }
  }

  function setError(error: unknown, reason?: PointerLockRequestReason): void {
    try {
      lastError = normalizeErrorRecord(error);
      lastErrorAt = now();
      errorCount += 1;
      setStatus("failed", reason ?? "error");

      dispatchDebugError(store, error);

      try {
        options.onError?.(error);
      } catch {
        // User callback must not break runtime.
      }
    } catch {
      // Error handling must not throw.
    }
  }

  function assertAlive(action: string): boolean {
    try {
      if (destroyed || status === "destroyed") {
        logWarn(logger, "Pointer-lock action ignored because handle is destroyed.", {
          action,
        });
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  function updateInputState(locked: boolean, source: string): void {
    try {
      inputState.setPointerLock(locked, available);

      if (dispatchToStore) {
        dispatchPointerLockToStore(store, {
          locked,
          available,
          source,
        });
      }
    } catch (error) {
      logWarn(logger, "Pointer-lock input state update failed.", {
        error: normalizeErrorRecord(error),
        locked,
        source,
      });
    }
  }

  function notifyLockedOnce(): void {
    try {
      options.onLocked?.();
    } catch {
      // User callback must not break runtime.
    }
  }

  function notifyUnlockedOnce(): void {
    try {
      options.onUnlocked?.();
    } catch {
      // User callback must not break runtime.
    }
  }

  function syncFromDocument(reason?: PointerLockRequestReason): boolean {
    if (!assertAlive("syncFromDocument")) {
      return false;
    }

    const normalizedReason = normalizeReason(reason, "syncFromDocument");

    try {
      available = supportsPointerLock(target);

      if (!available) {
        lastKnownLocked = false;
        updateInputState(false, "pointer-lock.unavailable");
        setStatus("unavailable", normalizedReason);
        return false;
      }

      const locked = isTargetLocked(target);
      const changed = locked !== lastKnownLocked;

      if (changed) {
        changeCount += 1;
      }

      lastKnownLocked = locked;

      if (locked) {
        lastLockedAt = now();
        lastError = null;
        updateInputState(true, "pointer-lock.locked");
        setStatus("locked", normalizedReason);

        if (changed) {
          notifyLockedOnce();
        }
      } else {
        lastUnlockedAt = now();
        updateInputState(false, "pointer-lock.unlocked");
        setStatus(attached ? "attached" : "unlocked", normalizedReason);

        if (changed) {
          notifyUnlockedOnce();
        }
      }

      logDebug(logger, "Pointer-lock synchronized from document.", {
        reason: normalizedReason,
        locked,
        available,
        changed,
        pointerLockElementTagName: currentPointerLockElement()?.tagName ?? null,
      });

      return locked;
    } catch (error) {
      setError(error, normalizedReason);
      logWarn(logger, "Pointer-lock sync failed.", {
        reason: normalizedReason,
        error: normalizeErrorRecord(error),
      });

      return false;
    }
  }

  async function requestLock(reason?: PointerLockRequestReason): Promise<boolean> {
    if (!assertAlive("requestLock")) {
      return false;
    }

    const normalizedReason = normalizeReason(reason, "manual");

    if (pendingRequest) {
      return pendingRequest;
    }

    pendingRequest = (async (): Promise<boolean> => {
      if (!enabled) {
        dispatchDebugWarning(store, "Pointer lock is disabled.");
        return false;
      }

      available = supportsPointerLock(target);

      if (!available) {
        lastKnownLocked = false;
        updateInputState(false, "pointer-lock.request-unavailable");
        setStatus("unavailable", normalizedReason);
        dispatchDebugWarning(store, "Pointer lock is not available in this browser/context.");
        return false;
      }

      if (isTargetLocked(target)) {
        syncFromDocument("already-locked");
        return true;
      }

      try {
        requestCount += 1;
        lastRequestedAt = now();
        setStatus("requesting", normalizedReason);
        tryFocusTarget(target);

        await requestPointerLockWithFallback(target, unadjustedMovement);

        const locked = syncFromDocument(normalizedReason);

        if (locked) {
          successCount += 1;
          lastError = null;
        }

        logDebug(logger, "Pointer-lock request completed.", {
          reason: normalizedReason,
          locked,
          requestCount,
          successCount,
          targetTagName: readElementTagName(target),
          targetId: readElementId(target),
        });

        return locked;
      } catch (error) {
        setError(error, normalizedReason);
        updateInputState(false, "pointer-lock.request-failed");

        logWarn(logger, "Pointer-lock request failed.", {
          reason: normalizedReason,
          error: normalizeErrorRecord(error),
          targetTagName: readElementTagName(target),
          targetId: readElementId(target),
        });

        return false;
      }
    })();

    try {
      return await pendingRequest;
    } finally {
      pendingRequest = null;
    }
  }

  async function requestLockFromEvent(
    event: MouseEvent | PointerEvent,
    reason?: PointerLockRequestReason,
  ): Promise<boolean> {
    const normalizedReason = normalizeReason(reason, "input-controller");

    try {
      if (shouldIgnoreActivationEvent(event)) {
        return false;
      }

      if (preventDefaultOnActivation) {
        try {
          event.preventDefault();
        } catch {
          // Best-effort only.
        }
      }

      return await requestLock(normalizedReason);
    } catch (error) {
      setError(error, normalizedReason);
      return false;
    }
  }

  async function exitLock(reason?: PointerLockRequestReason): Promise<boolean> {
    if (!assertAlive("exitLock")) {
      return false;
    }

    const normalizedReason = normalizeReason(reason, "exitLock");

    try {
      const doc = getPointerLockDocument();

      if (!doc || typeof doc.exitPointerLock !== "function") {
        available = false;
        lastKnownLocked = false;
        setStatus("unavailable", normalizedReason);
        updateInputState(false, "pointer-lock.exit-unavailable");
        return false;
      }

      if (!isTargetLocked(target)) {
        syncFromDocument("already-unlocked");
        return true;
      }

      await promiseFromMaybeVoid(doc.exitPointerLock());
      syncFromDocument(normalizedReason);

      logDebug(logger, "Pointer-lock exit completed.", {
        reason: normalizedReason,
      });

      return !isTargetLocked(target);
    } catch (error) {
      setError(error, normalizedReason);
      logWarn(logger, "Pointer-lock exit failed.", {
        reason: normalizedReason,
        error: normalizeErrorRecord(error),
      });

      return false;
    }
  }

  async function exitLockInternal(reason?: PointerLockRequestReason): Promise<boolean> {
    const normalizedReason = normalizeReason(reason, "exit-internal");

    try {
      const doc = getPointerLockDocument();

      if (!doc || typeof doc.exitPointerLock !== "function" || !isTargetLocked(target)) {
        lastKnownLocked = false;
        updateInputState(false, `pointer-lock.${normalizedReason}`);
        return true;
      }

      await promiseFromMaybeVoid(doc.exitPointerLock());

      lastKnownLocked = false;
      lastUnlockedAt = now();
      updateInputState(false, `pointer-lock.${normalizedReason}`);
      setStatus(attached ? "attached" : "unlocked", normalizedReason);

      return !isTargetLocked(target);
    } catch (error) {
      setError(error, normalizedReason);
      return false;
    }
  }

  function handlePointerLockChange(): void {
    try {
      syncFromDocument("pointerlockchange");
    } catch (error) {
      setError(error, "pointerlockchange");
    }
  }

  function handlePointerLockError(event: Event): void {
    try {
      setError({
        name: "PointerLockError",
        message: "Pointer lock error event was emitted.",
        type: event.type,
        targetTagName: readElementTagName(target),
        targetId: readElementId(target),
      }, "pointerlockerror");

      logWarn(logger, "Pointer-lock error event received.", {
        type: event.type,
        targetTagName: readElementTagName(target),
        targetId: readElementId(target),
      });
    } catch {
      // Error event handling must not throw.
    }
  }

  function handleVisibilityChange(): void {
    try {
      syncFromDocument("visibilitychange");
    } catch (error) {
      setError(error, "visibilitychange");
    }
  }

  function handleClick(event: MouseEvent): void {
    try {
      if (!enabled || !requestOnClick) {
        return;
      }

      void requestLockFromEvent(event, "target-click");
    } catch (error) {
      setError(error, "target-click");
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    try {
      if (!enabled || !requestOnPointerDown) {
        return;
      }

      void requestLockFromEvent(event, "target-pointerdown");
    } catch (error) {
      setError(error, "target-pointerdown");
    }
  }

  function attachAbortSignal(): void {
    try {
      const signal = options.signal;

      if (!signal) {
        return;
      }

      if (signal.aborted) {
        void handle.destroy("abort-signal");
        return;
      }

      const onAbort = (): void => {
        void handle.destroy("abort-signal");
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

  const handle: PointerLockHandle = {
    kind: POINTER_LOCK_KIND,

    attach(): void {
      if (!assertAlive("attach")) {
        return;
      }

      if (attached) {
        syncFromDocument("attach-already-attached");
        return;
      }

      try {
        const doc = getPointerLockDocument();

        if (!doc) {
          available = false;
          setStatus("unavailable", "attach");
          updateInputState(false, "pointer-lock.attach-no-document");
          return;
        }

        const win = getWindow();

        ensureFocusableTarget(target);

        doc.addEventListener("pointerlockchange", handlePointerLockChange);
        doc.addEventListener("pointerlockerror", handlePointerLockError);
        doc.addEventListener("visibilitychange", handleVisibilityChange);

        cleanupCallbacks.push(() => {
          try {
            doc.removeEventListener("pointerlockchange", handlePointerLockChange);
            doc.removeEventListener("pointerlockerror", handlePointerLockError);
            doc.removeEventListener("visibilitychange", handleVisibilityChange);
          } catch {
            // Ignore cleanup failure.
          }
        });

        if (win) {
          win.addEventListener("blur", handleVisibilityChange);
          win.addEventListener("focus", handleVisibilityChange);

          cleanupCallbacks.push(() => {
            try {
              win.removeEventListener("blur", handleVisibilityChange);
              win.removeEventListener("focus", handleVisibilityChange);
            } catch {
              // Ignore cleanup failure.
            }
          });
        }

        if (requestOnClick) {
          target.addEventListener("click", handleClick);

          cleanupCallbacks.push(() => {
            try {
              target.removeEventListener("click", handleClick);
            } catch {
              // Ignore cleanup failure.
            }
          });
        }

        if (requestOnPointerDown) {
          target.addEventListener("pointerdown", handlePointerDown);

          cleanupCallbacks.push(() => {
            try {
              target.removeEventListener("pointerdown", handlePointerDown);
            } catch {
              // Ignore cleanup failure.
            }
          });
        }

        attachAbortSignal();

        attached = true;
        available = supportsPointerLock(target);

        if (!available) {
          lastKnownLocked = false;
          updateInputState(false, "pointer-lock.attach-unavailable");
          setStatus("unavailable", "attach");
        } else {
          setStatus(enabled ? "attached" : "unavailable", "attach");
          syncFromDocument("attach");
        }

        logDebug(logger, "Pointer-lock attached.", {
          enabled,
          available,
          requestOnClick,
          requestOnPointerDown,
          preventDefaultOnActivation,
          unadjustedMovement,
          targetTagName: readElementTagName(target),
          targetId: readElementId(target),
        });
      } catch (error) {
        setError(error, "attach");
        logWarn(logger, "Pointer-lock attach failed.", {
          error: normalizeErrorRecord(error),
        });
      }
    },

    detach(reason?: PointerLockRequestReason): void {
      if (destroyed) {
        return;
      }

      const normalizedReason = normalizeReason(reason, "detach");

      try {
        detachListeners();

        if (isTargetLocked(target)) {
          void exitLockInternal(normalizedReason);
        } else {
          lastKnownLocked = false;
          updateInputState(false, "pointer-lock.detach");
        }

        setStatus("unlocked", normalizedReason);

        logDebug(logger, "Pointer-lock detached.", {
          reason: normalizedReason,
        });
      } catch (error) {
        setError(error, normalizedReason);
      }
    },

    enable(reason?: PointerLockRequestReason): void {
      if (!assertAlive("enable")) {
        return;
      }

      const normalizedReason = normalizeReason(reason, "enable");

      try {
        enabled = true;
        available = supportsPointerLock(target);
        setStatus(attached ? "attached" : available ? "created" : "unavailable", normalizedReason);
        syncFromDocument(normalizedReason);

        logDebug(logger, "Pointer-lock enabled.", {
          reason: normalizedReason,
          available,
        });
      } catch (error) {
        setError(error, normalizedReason);
      }
    },

    disable(reason?: PointerLockRequestReason): void {
      if (!assertAlive("disable")) {
        return;
      }

      const normalizedReason = normalizeReason(reason, "disable");

      try {
        enabled = false;

        if (isTargetLocked(target)) {
          void exitLockInternal(normalizedReason);
        } else {
          lastKnownLocked = false;
          updateInputState(false, "pointer-lock.disable");
        }

        setStatus("unavailable", normalizedReason);

        logDebug(logger, "Pointer-lock disabled.", {
          reason: normalizedReason,
        });
      } catch (error) {
        setError(error, normalizedReason);
      }
    },

    requestLock,
    requestLockFromEvent,
    exitLock,
    syncFromDocument,

    isAvailable(): boolean {
      try {
        available = supportsPointerLock(target);
        return available;
      } catch {
        return false;
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

    isLocked(): boolean {
      try {
        return isTargetLocked(target);
      } catch {
        return false;
      }
    },

    getStatus(): PointerLockStatus {
      return status;
    },

    getSnapshot(): PointerLockSnapshot {
      return {
        kind: POINTER_LOCK_SNAPSHOT_KIND,
        status,
        available,
        enabled,
        locked: isTargetLocked(target),
        attached,
        destroyed,
        createdAt,
        updatedAt,
        destroyedAt,
        requestCount,
        successCount,
        errorCount,
        changeCount,
        lastRequestedAt,
        lastLockedAt,
        lastUnlockedAt,
        lastErrorAt,
        targetTagName: readElementTagName(target),
        targetId: readElementId(target),
        lastReason,
        lastError,
      };
    },

    async destroy(reason?: PointerLockRequestReason): Promise<void> {
      if (destroyed) {
        return;
      }

      const normalizedReason = normalizeReason(reason, "destroy");

      try {
        if (exitOnDestroy && isTargetLocked(target)) {
          await exitLockInternal(normalizedReason);
        }

        detachListeners();

        destroyed = true;
        destroyedAt = now();
        lastKnownLocked = false;

        updateInputState(false, "pointer-lock.destroy");
        setStatus("destroyed", normalizedReason);

        logDebug(logger, "Pointer-lock destroyed.", {
          reason: normalizedReason,
          requestCount,
          successCount,
          errorCount,
          changeCount,
        });
      } catch (error) {
        destroyed = true;
        destroyedAt = now();
        setError(error, normalizedReason);
      }
    },
  };

  return handle;
}

export function isPointerLockHandle(value: unknown): value is PointerLockHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<PointerLockHandle>;

    return (
      record.kind === POINTER_LOCK_KIND
      && typeof record.attach === "function"
      && typeof record.requestLock === "function"
      && typeof record.requestLockFromEvent === "function"
      && typeof record.exitLock === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}