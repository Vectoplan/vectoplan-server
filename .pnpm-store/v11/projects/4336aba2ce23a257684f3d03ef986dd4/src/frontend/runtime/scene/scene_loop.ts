// services/vectoplan-editor/src/frontend/runtime/scene/scene_loop.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { SceneLifecycleHandle } from "./scene_lifecycle";

export type SceneLoopStatus =
  | "created"
  | "starting"
  | "running"
  | "paused"
  | "stopping"
  | "stopped"
  | "failed"
  | "destroyed";

export type SceneLoopPhase =
  | "before-update"
  | "update"
  | "after-update"
  | "before-render"
  | "render"
  | "after-render";

export interface SceneLoopTickContext {
  readonly frame: number;
  readonly deltaMs: number;
  readonly elapsedMs: number;
  readonly nowMs: number;
  readonly startedAtMs: number;
  readonly status: SceneLoopStatus;
  readonly paused: boolean;
}

export type SceneLoopCallback = (context: SceneLoopTickContext) => void | Promise<void>;

export interface SceneLoopCallbackRegistration {
  readonly id: string;
  readonly phase: SceneLoopPhase;
  readonly label: string;
  readonly enabled: boolean;
  readonly critical: boolean;
  readonly createdAt: string;
  readonly callback: SceneLoopCallback;
}

export interface SceneLoopOptions {
  readonly logger?: EditorLogger;
  readonly store?: EditorStore;
  readonly lifecycle?: SceneLifecycleHandle;
  readonly signal?: AbortSignal;

  readonly autoStart?: boolean;
  readonly maxDeltaMs?: number;
  readonly minDeltaMs?: number;
  readonly fixedDeltaMs?: number | null;
  readonly pauseWhenDocumentHidden?: boolean;
  readonly dispatchFramesToStore?: boolean;
  readonly continueAfterCallbackError?: boolean;
}

export interface SceneLoopStartOptions {
  readonly reason?: string;
  readonly resetClock?: boolean;
}

export interface SceneLoopStopOptions {
  readonly reason?: string;
  readonly clearFrame?: boolean;
}

export interface SceneLoopSnapshot {
  readonly kind: "scene-loop-snapshot.v1";
  readonly status: SceneLoopStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly stoppedAt: string | null;
  readonly destroyedAt: string | null;
  readonly frame: number;
  readonly startedAtMs: number | null;
  readonly lastNowMs: number | null;
  readonly lastDeltaMs: number | null;
  readonly elapsedMs: number;
  readonly averageFrameMs: number | null;
  readonly minObservedFrameMs: number | null;
  readonly maxObservedFrameMs: number | null;
  readonly callbackCount: number;
  readonly enabledCallbackCount: number;
  readonly failedCallbackCount: number;
  readonly lastReason: string | null;
  readonly lastError: Record<string, unknown> | null;
  readonly pausedByVisibility: boolean;
  readonly running: boolean;
  readonly destroyed: boolean;
}

export interface SceneLoopHandle {
  readonly kind: "vectoplan-editor-scene-loop.v1";

  start(options?: SceneLoopStartOptions | string | unknown): void;
  stop(options?: SceneLoopStopOptions | string | unknown): void;
  pause(reason?: string): void;
  resume(reason?: string): void;
  tick(nowMs?: number): void;

  addCallback(input: {
    readonly phase: SceneLoopPhase;
    readonly label: string;
    readonly callback: SceneLoopCallback;
    readonly critical?: boolean;
    readonly enabled?: boolean;
  }): () => void;

  removeCallback(idOrLabel: string): boolean;
  setCallbackEnabled(idOrLabel: string, enabled: boolean): boolean;
  clearCallbacks(reason?: string): void;

  getStatus(): SceneLoopStatus;
  isRunning(): boolean;
  isPaused(): boolean;
  getSnapshot(): SceneLoopSnapshot;

  destroy(reason?: string): void;
}

const SCENE_LOOP_KIND = "vectoplan-editor-scene-loop.v1" as const;
const SCENE_LOOP_SNAPSHOT_KIND = "scene-loop-snapshot.v1" as const;

const DEFAULT_MAX_DELTA_MS = 100;
const DEFAULT_MIN_DELTA_MS = 0;
const FRAME_AVERAGE_ALPHA = 0.08;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function nowMsSafe(): number {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      const value = performance.now();
      return Number.isFinite(value) ? value : Date.now();
    }

    return Date.now();
  } catch {
    return Date.now();
  }
}

function normalizeReason(value: unknown, fallback = "scene-loop"): string {
  return safeString(value, fallback);
}

function createCallbackId(label: string, phase: SceneLoopPhase): string {
  try {
    const safeLabel = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return `scene_loop_${phase}_${safeLabel || "callback"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `scene_loop_${phase}_${Date.now()}`;
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
    // Scene loop logging must never break runtime.
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
    // Scene loop logging must never break runtime.
  }
}

function logInfo(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.info?.(message, details);
  } catch {
    // Scene loop logging must never break runtime.
  }
}

function normalizeMaxDeltaMs(value: unknown): number {
  return safeNumber(value, DEFAULT_MAX_DELTA_MS, {
    min: 1,
    max: 5_000,
  });
}

function normalizeMinDeltaMs(value: unknown): number {
  return safeNumber(value, DEFAULT_MIN_DELTA_MS, {
    min: 0,
    max: 1_000,
  });
}

function normalizeFixedDeltaMs(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return safeNumber(value, 16.6667, {
    min: 0.001,
    max: 1_000,
  });
}

function normalizePhase(value: unknown): SceneLoopPhase {
  const normalized = safeString(value, "update");

  if (
    normalized === "before-update"
    || normalized === "update"
    || normalized === "after-update"
    || normalized === "before-render"
    || normalized === "render"
    || normalized === "after-render"
  ) {
    return normalized;
  }

  return "update";
}

function normalizeStartOptions(value: unknown): SceneLoopStartOptions {
  if (typeof value === "string") {
    return {
      reason: normalizeReason(value, "start"),
      resetClock: true,
    };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    return {
      reason: normalizeReason(record.reason, "start"),
      resetClock: safeBoolean(record.resetClock, true),
    };
  }

  return {
    reason: "start",
    resetClock: true,
  };
}

function normalizeStopOptions(value: unknown): SceneLoopStopOptions {
  if (typeof value === "string") {
    return {
      reason: normalizeReason(value, "stop"),
      clearFrame: true,
    };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    return {
      reason: normalizeReason(record.reason, "stop"),
      clearFrame: safeBoolean(record.clearFrame, true),
    };
  }

  return {
    reason: "stop",
    clearFrame: true,
  };
}

function phaseOrder(phase: SceneLoopPhase): number {
  switch (phase) {
    case "before-update":
      return 10;
    case "update":
      return 20;
    case "after-update":
      return 30;
    case "before-render":
      return 40;
    case "render":
      return 50;
    case "after-render":
      return 60;
    default:
      return 999;
  }
}

function sortCallbacks(
  callbacks: Iterable<SceneLoopCallbackRegistration>,
): readonly SceneLoopCallbackRegistration[] {
  try {
    return [...callbacks].sort((left, right) => {
      const phaseDelta = phaseOrder(left.phase) - phaseOrder(right.phase);

      if (phaseDelta !== 0) {
        return phaseDelta;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
  } catch {
    return [...callbacks];
  }
}

function requestFrame(callback: FrameRequestCallback): number | null {
  try {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      return null;
    }

    return window.requestAnimationFrame(callback);
  } catch {
    return null;
  }
}

function cancelFrame(frameId: number | null): void {
  try {
    if (frameId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(frameId);
    }
  } catch {
    // Ignore.
  }
}

function readDocumentHidden(): boolean {
  try {
    if (typeof document === "undefined") {
      return false;
    }

    return document.visibilityState === "hidden";
  } catch {
    return false;
  }
}

function dispatchFrameToStore(
  store: EditorStore | undefined,
  input: {
    readonly frameMs: number;
    readonly source: string;
  },
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "render/frame",
        frameMs: input.frameMs,
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
    // Store dispatch must not break loop.
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
        source: "scene-loop",
      }),
      {
        action: "scene-loop.debug-error",
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Ignore.
  }
}

function createTickContext(input: {
  readonly frame: number;
  readonly deltaMs: number;
  readonly elapsedMs: number;
  readonly nowMs: number;
  readonly startedAtMs: number;
  readonly status: SceneLoopStatus;
  readonly paused: boolean;
}): SceneLoopTickContext {
  return {
    frame: input.frame,
    deltaMs: input.deltaMs,
    elapsedMs: input.elapsedMs,
    nowMs: input.nowMs,
    startedAtMs: input.startedAtMs,
    status: input.status,
    paused: input.paused,
  };
}

export function createSceneLoop(options?: SceneLoopOptions): SceneLoopHandle {
  const logger = options?.logger;
  const store = options?.store;
  const lifecycle = options?.lifecycle;

  const maxDeltaMs = normalizeMaxDeltaMs(options?.maxDeltaMs);
  const minDeltaMs = normalizeMinDeltaMs(options?.minDeltaMs);
  const fixedDeltaMs = normalizeFixedDeltaMs(options?.fixedDeltaMs);
  const pauseWhenDocumentHidden = safeBoolean(options?.pauseWhenDocumentHidden, true);
  const dispatchFramesToStore = safeBoolean(options?.dispatchFramesToStore, true);
  const continueAfterCallbackError = safeBoolean(options?.continueAfterCallbackError, true);

  const callbacks = new Map<string, SceneLoopCallbackRegistration>();

  const createdAt = now();
  let updatedAt = createdAt;
  let startedAt: string | null = null;
  let stoppedAt: string | null = null;
  let destroyedAt: string | null = null;
  let status: SceneLoopStatus = "created";
  let destroyed = false;
  let paused = false;
  let pausedByVisibility = false;
  let frameId: number | null = null;
  let frame = 0;
  let startedAtMs: number | null = null;
  let lastNowMs: number | null = null;
  let lastDeltaMs: number | null = null;
  let elapsedMs = 0;
  let averageFrameMs: number | null = null;
  let minObservedFrameMs: number | null = null;
  let maxObservedFrameMs: number | null = null;
  let failedCallbackCount = 0;
  let lastReason: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  function setStatus(nextStatus: SceneLoopStatus, reason?: unknown): void {
    const normalizedReason = reason === null || reason === undefined
      ? null
      : normalizeReason(reason, "scene-loop-status");

    status = nextStatus;
    updatedAt = now();
    lastReason = normalizedReason ?? lastReason;

    if (nextStatus === "running") {
      startedAt = startedAt ?? updatedAt;
    }

    if (nextStatus === "stopped") {
      stoppedAt = updatedAt;
    }

    if (nextStatus === "destroyed") {
      destroyedAt = updatedAt;
    }

    try {
      if (nextStatus === "running") {
        lifecycle?.markRunning(normalizedReason ?? "scene-loop-running");
      } else if (nextStatus === "paused") {
        lifecycle?.pause(normalizedReason ?? "scene-loop-paused");
      } else if (nextStatus === "failed") {
        lifecycle?.fail(lastError ?? new Error("Scene loop failed."), normalizedReason ?? "scene-loop-failed");
      }
    } catch {
      // Lifecycle sync is best-effort.
    }
  }

  function setError(error: unknown, reason?: unknown): void {
    const normalizedError = normalizeUnknownError(error);
    lastError = normalizedError;
    setStatus("failed", normalizeReason(reason ?? normalizedError.message, "scene-loop-failed"));
    dispatchDebugError(store, error);

    logWarn(logger, "Scene loop failed.", {
      reason: normalizeReason(reason, "unknown"),
      error: lastError,
    });
  }

  function isRunning(): boolean {
    return status === "running" && frameId !== null && !destroyed;
  }

  function isPaused(): boolean {
    return paused || status === "paused";
  }

  function scheduleNextFrame(): void {
    if (destroyed || status === "destroyed" || status === "stopping" || status === "stopped") {
      return;
    }

    frameId = requestFrame((timestamp) => {
      handle.tick(timestamp);
    });

    if (frameId === null) {
      setError(new Error("requestAnimationFrame is not available."), "request-frame-unavailable");
    }
  }

  async function invokeCallback(
    registration: SceneLoopCallbackRegistration,
    context: SceneLoopTickContext,
  ): Promise<void> {
    if (!registration.enabled) {
      return;
    }

    try {
      const result = registration.callback(context);

      if (result && typeof (result as Promise<void>).then === "function") {
        await result;
      }
    } catch (error) {
      failedCallbackCount += 1;

      logWarn(logger, "Scene loop callback failed.", {
        callbackId: registration.id,
        label: registration.label,
        phase: registration.phase,
        critical: registration.critical,
        error: normalizeUnknownError(error),
      });

      dispatchDebugError(store, error);

      if (registration.critical || !continueAfterCallbackError) {
        throw error;
      }
    }
  }

  async function runCallbacks(context: SceneLoopTickContext): Promise<void> {
    const sorted = sortCallbacks(callbacks.values());

    for (const registration of sorted) {
      await invokeCallback(registration, context);
    }
  }

  function computeDelta(inputNowMs: number): number {
    try {
      if (fixedDeltaMs !== null) {
        return fixedDeltaMs;
      }

      if (lastNowMs === null) {
        return 0;
      }

      const rawDelta = inputNowMs - lastNowMs;

      if (!Number.isFinite(rawDelta)) {
        return 0;
      }

      return Math.min(maxDeltaMs, Math.max(minDeltaMs, rawDelta));
    } catch {
      return 0;
    }
  }

  function updateFrameStats(deltaMs: number): void {
    try {
      if (deltaMs > 0) {
        averageFrameMs = averageFrameMs === null
          ? deltaMs
          : (averageFrameMs * (1 - FRAME_AVERAGE_ALPHA)) + (deltaMs * FRAME_AVERAGE_ALPHA);

        minObservedFrameMs = minObservedFrameMs === null
          ? deltaMs
          : Math.min(minObservedFrameMs, deltaMs);

        maxObservedFrameMs = maxObservedFrameMs === null
          ? deltaMs
          : Math.max(maxObservedFrameMs, deltaMs);
      }

      lastDeltaMs = deltaMs;
      elapsedMs += deltaMs;
    } catch {
      // Stats are non-critical.
    }
  }

  function stopFrame(clearFrame: boolean): void {
    if (clearFrame) {
      cancelFrame(frameId);
    }

    frameId = null;
  }

  function attachAbortSignal(): void {
    try {
      const signal = options?.signal;

      if (!signal) {
        return;
      }

      if (signal.aborted) {
        handle.destroy("abort-signal-already-aborted");
        return;
      }

      signal.addEventListener(
        "abort",
        () => {
          handle.destroy("abort-signal");
        },
        {
          once: true,
        },
      );
    } catch {
      // Abort integration is best-effort.
    }
  }

  function attachVisibilityListener(): void {
    if (!pauseWhenDocumentHidden || typeof document === "undefined") {
      return;
    }

    try {
      document.addEventListener("visibilitychange", () => {
        if (destroyed) {
          return;
        }

        if (readDocumentHidden()) {
          pausedByVisibility = true;
          handle.pause("document-hidden");
          return;
        }

        if (pausedByVisibility) {
          pausedByVisibility = false;
          handle.resume("document-visible");
        }
      });
    } catch {
      // Visibility pause is best-effort.
    }
  }

  const handle: SceneLoopHandle = {
    kind: SCENE_LOOP_KIND,

    start(startOptions?: SceneLoopStartOptions | string | unknown): void {
      if (destroyed) {
        return;
      }

      if (isRunning()) {
        return;
      }

      const normalizedStartOptions = normalizeStartOptions(startOptions);

      try {
        setStatus("starting", normalizedStartOptions.reason);

        if (normalizedStartOptions.resetClock !== false || startedAtMs === null) {
          startedAtMs = nowMsSafe();
          lastNowMs = null;
          lastDeltaMs = null;
          elapsedMs = 0;
          frame = 0;
          averageFrameMs = null;
          minObservedFrameMs = null;
          maxObservedFrameMs = null;
        }

        paused = false;
        setStatus("running", normalizedStartOptions.reason);
        scheduleNextFrame();

        logInfo(logger, "Scene loop started.", {
          reason: normalizedStartOptions.reason ?? null,
          maxDeltaMs,
          minDeltaMs,
          fixedDeltaMs,
          callbackCount: callbacks.size,
        });
      } catch (error) {
        setError(error, "scene-loop-start-failed");
      }
    },

    stop(stopOptions?: SceneLoopStopOptions | string | unknown): void {
      if (destroyed) {
        return;
      }

      const normalizedStopOptions = normalizeStopOptions(stopOptions);

      try {
        setStatus("stopping", normalizedStopOptions.reason);
        stopFrame(normalizedStopOptions.clearFrame ?? true);
        setStatus("stopped", normalizedStopOptions.reason);

        logInfo(logger, "Scene loop stopped.", {
          reason: normalizedStopOptions.reason ?? null,
          frame,
          elapsedMs,
        });
      } catch (error) {
        setError(error, "scene-loop-stop-failed");
      }
    },

    pause(reason?: string): void {
      if (destroyed || status === "destroyed") {
        return;
      }

      paused = true;
      setStatus("paused", reason ?? "pause");
    },

    resume(reason?: string): void {
      if (destroyed || status === "destroyed") {
        return;
      }

      paused = false;

      if (status === "paused") {
        lastNowMs = null;
        setStatus("running", reason ?? "resume");

        if (frameId === null) {
          scheduleNextFrame();
        }
      }
    },

    tick(inputNowMs?: number): void {
      if (destroyed || status === "destroyed") {
        return;
      }

      frameId = null;

      if (paused || status === "paused") {
        scheduleNextFrame();
        return;
      }

      if (status !== "running") {
        return;
      }

      const tickNowMs = typeof inputNowMs === "number" && Number.isFinite(inputNowMs)
        ? inputNowMs
        : nowMsSafe();

      const safeStartedAtMs = startedAtMs ?? tickNowMs;
      const deltaMs = computeDelta(tickNowMs);

      updateFrameStats(deltaMs);
      lastNowMs = tickNowMs;
      frame += 1;

      const context = createTickContext({
        frame,
        deltaMs,
        elapsedMs,
        nowMs: tickNowMs,
        startedAtMs: safeStartedAtMs,
        status,
        paused,
      });

      void runCallbacks(context)
        .then(() => {
          if (dispatchFramesToStore) {
            dispatchFrameToStore(store, {
              frameMs: deltaMs,
              source: "scene-loop.tick",
            });
          }

          scheduleNextFrame();
        })
        .catch((error) => {
          setError(error, "scene-loop-callback-failed");

          if (continueAfterCallbackError) {
            scheduleNextFrame();
          }
        });
    },

    addCallback(input: {
      readonly phase: SceneLoopPhase;
      readonly label: string;
      readonly callback: SceneLoopCallback;
      readonly critical?: boolean;
      readonly enabled?: boolean;
    }): () => void {
      const phase = normalizePhase(input.phase);
      const label = safeString(input.label, "callback");
      const id = createCallbackId(label, phase);

      const registration: SceneLoopCallbackRegistration = {
        id,
        phase,
        label,
        enabled: input.enabled ?? true,
        critical: input.critical ?? false,
        createdAt: now(),
        callback: input.callback,
      };

      callbacks.set(id, registration);
      updatedAt = now();

      logDebug(logger, "Scene loop callback added.", {
        id,
        phase,
        label,
        enabled: registration.enabled,
        critical: registration.critical,
      });

      let removed = false;

      return () => {
        if (removed) {
          return;
        }

        removed = true;
        callbacks.delete(id);
        updatedAt = now();
      };
    },

    removeCallback(idOrLabel: string): boolean {
      const normalized = safeString(idOrLabel, "");

      if (callbacks.delete(normalized)) {
        updatedAt = now();
        return true;
      }

      for (const [id, registration] of callbacks.entries()) {
        if (registration.label === normalized) {
          callbacks.delete(id);
          updatedAt = now();
          return true;
        }
      }

      return false;
    },

    setCallbackEnabled(idOrLabel: string, enabled: boolean): boolean {
      const normalized = safeString(idOrLabel, "");

      for (const [id, registration] of callbacks.entries()) {
        if (id === normalized || registration.label === normalized) {
          callbacks.set(id, {
            ...registration,
            enabled,
          });
          updatedAt = now();
          return true;
        }
      }

      return false;
    },

    clearCallbacks(reason?: string): void {
      callbacks.clear();
      updatedAt = now();

      logDebug(logger, "Scene loop callbacks cleared.", {
        reason: reason ?? null,
      });
    },

    getStatus(): SceneLoopStatus {
      return status;
    },

    isRunning,

    isPaused,

    getSnapshot(): SceneLoopSnapshot {
      const enabledCallbackCount = [...callbacks.values()].filter((callback) => callback.enabled).length;

      return {
        kind: SCENE_LOOP_SNAPSHOT_KIND,
        status,
        createdAt,
        updatedAt,
        startedAt,
        stoppedAt,
        destroyedAt,
        frame,
        startedAtMs,
        lastNowMs,
        lastDeltaMs,
        elapsedMs,
        averageFrameMs,
        minObservedFrameMs,
        maxObservedFrameMs,
        callbackCount: callbacks.size,
        enabledCallbackCount,
        failedCallbackCount,
        lastReason,
        lastError,
        pausedByVisibility,
        running: isRunning(),
        destroyed,
      };
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      const destroyReason = normalizeReason(reason, "destroy");

      destroyed = true;
      stopFrame(true);
      callbacks.clear();
      destroyedAt = now();
      setStatus("destroyed", destroyReason);

      logInfo(logger, "Scene loop destroyed.", {
        reason: destroyReason,
        frame,
        elapsedMs,
        failedCallbackCount,
      });
    },
  };

  attachAbortSignal();
  attachVisibilityListener();

  if (options?.autoStart === true) {
    handle.start({
      reason: "auto-start",
      resetClock: true,
    });
  }

  return handle;
}

export function isSceneLoopHandle(value: unknown): value is SceneLoopHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<SceneLoopHandle>;

    return (
      record.kind === SCENE_LOOP_KIND
      && typeof record.start === "function"
      && typeof record.tick === "function"
      && typeof record.addCallback === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}