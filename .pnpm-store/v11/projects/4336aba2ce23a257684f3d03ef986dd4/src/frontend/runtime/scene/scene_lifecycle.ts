// services/vectoplan-editor/src/frontend/runtime/scene/scene_lifecycle.ts
import type { EditorLogger } from "@utils/logger";
import { createEditorId } from "@utils/ids";
import { normalizeUnknownError, safeBoolean, safeInteger, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type SceneLifecycleStatus =
  | "created"
  | "initializing"
  | "running"
  | "paused"
  | "failed"
  | "destroying"
  | "destroyed";

export type SceneLifecycleCleanupKind =
  | "callback"
  | "disposable"
  | "abort-controller"
  | "event-listener"
  | "timeout"
  | "animation-frame"
  | "external";

export type SceneLifecycleStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface SceneLifecycleDisposable {
  readonly destroy?: (reason?: string) => void | Promise<void>;
  readonly dispose?: (reason?: string) => void | Promise<void>;
  readonly stop?: (reason?: string | unknown) => void | Promise<void>;
}

export interface SceneLifecycleCleanupRegistration {
  readonly id: string;
  readonly kind: SceneLifecycleCleanupKind;
  readonly label: string;
  readonly createdAt: string;
  readonly critical: boolean;
  readonly cleanup: (reason: string) => void | Promise<void>;
}

export interface SceneLifecycleStep {
  readonly id: string;
  readonly label: string;
  readonly status: SceneLifecycleStepStatus;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly failedAt: string | null;
  readonly elapsedMs: number | null;
  readonly error: Record<string, unknown> | null;
}

export interface SceneLifecycleStatusEvent {
  readonly status: SceneLifecycleStatus;
  readonly previousStatus: SceneLifecycleStatus;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface SceneLifecycleSnapshot {
  readonly kind: "scene-lifecycle-snapshot.v1";
  readonly id: string;
  readonly status: SceneLifecycleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly initializedAt: string | null;
  readonly runningAt: string | null;
  readonly pausedAt: string | null;
  readonly failedAt: string | null;
  readonly destroyingAt: string | null;
  readonly destroyedAt: string | null;
  readonly lastReason: string | null;
  readonly lastError: Record<string, unknown> | null;
  readonly cleanupCount: number;
  readonly criticalCleanupCount: number;
  readonly listenerCount: number;
  readonly stepCount: number;
  readonly failedStepCount: number;
  readonly pendingStepCount: number;
  readonly abortSignalAborted: boolean;
  readonly steps: readonly SceneLifecycleStep[];
}

export interface SceneLifecycleOptions {
  readonly logger?: EditorLogger;
  readonly id?: string;
  readonly label?: string;
  readonly parentSignal?: AbortSignal;
  readonly destroyOnParentAbort?: boolean;
  readonly throwOnCriticalCleanupFailure?: boolean;
}

export interface RunLifecycleStepOptions {
  readonly id?: string;
  readonly label: string;
  readonly skipIfDestroyed?: boolean;
  readonly critical?: boolean;
}

export type SceneLifecycleStatusListener = (event: SceneLifecycleStatusEvent) => void;

export type SceneLifecycleUnsubscribe = () => void;

export interface SceneLifecycleHandle {
  readonly kind: "vectoplan-editor-scene-lifecycle.v1";

  initialize(reason?: string): void;
  markRunning(reason?: string): void;
  pause(reason?: string): void;
  resume(reason?: string): void;
  fail(error: unknown, reason?: string): void;

  getId(): string;
  getStatus(): SceneLifecycleStatus;
  getAbortSignal(): AbortSignal;
  getSnapshot(): SceneLifecycleSnapshot;

  isAlive(): boolean;
  isRunning(): boolean;
  isDestroyed(): boolean;
  throwIfDestroyed(action?: string): void;

  onStatus(listener: SceneLifecycleStatusListener): SceneLifecycleUnsubscribe;

  runStep<T>(
    options: RunLifecycleStepOptions,
    task: (signal: AbortSignal) => T | Promise<T>,
  ): Promise<T>;

  registerCleanup(input: {
    readonly kind?: SceneLifecycleCleanupKind;
    readonly label: string;
    readonly critical?: boolean;
    readonly cleanup: (reason: string) => void | Promise<void>;
  }): SceneLifecycleUnsubscribe;

  registerDisposable(input: {
    readonly label: string;
    readonly disposable: SceneLifecycleDisposable | null | undefined;
    readonly method?: "destroy" | "dispose" | "stop" | "auto";
    readonly critical?: boolean;
  }): SceneLifecycleUnsubscribe;

  registerAbortController(input: {
    readonly label: string;
    readonly controller: AbortController | null | undefined;
    readonly critical?: boolean;
  }): SceneLifecycleUnsubscribe;

  registerEventListener<K extends keyof WindowEventMap>(
    input: {
      readonly target: Window;
      readonly type: K;
      readonly listener: (event: WindowEventMap[K]) => void;
      readonly options?: AddEventListenerOptions | boolean;
      readonly label?: string;
      readonly critical?: boolean;
    },
  ): SceneLifecycleUnsubscribe;

  registerDocumentEventListener<K extends keyof DocumentEventMap>(
    input: {
      readonly target: Document;
      readonly type: K;
      readonly listener: (event: DocumentEventMap[K]) => void;
      readonly options?: AddEventListenerOptions | boolean;
      readonly label?: string;
      readonly critical?: boolean;
    },
  ): SceneLifecycleUnsubscribe;

  registerElementEventListener<K extends keyof HTMLElementEventMap>(
    input: {
      readonly target: HTMLElement;
      readonly type: K;
      readonly listener: (event: HTMLElementEventMap[K]) => void;
      readonly options?: AddEventListenerOptions | boolean;
      readonly label?: string;
      readonly critical?: boolean;
    },
  ): SceneLifecycleUnsubscribe;

  registerTimeout(input: {
    readonly label: string;
    readonly timeoutId: number | null | undefined;
    readonly critical?: boolean;
  }): SceneLifecycleUnsubscribe;

  registerAnimationFrame(input: {
    readonly label: string;
    readonly frameId: number | null | undefined;
    readonly critical?: boolean;
  }): SceneLifecycleUnsubscribe;

  destroy(reason?: string): Promise<void>;
}

const SCENE_LIFECYCLE_KIND = "vectoplan-editor-scene-lifecycle.v1" as const;
const SCENE_LIFECYCLE_SNAPSHOT_KIND = "scene-lifecycle-snapshot.v1" as const;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function nowMs(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
  }
}

function elapsedMs(startedAt: number): number {
  try {
    return Math.max(0, Math.round(nowMs() - startedAt));
  } catch {
    return 0;
  }
}

function normalizeReason(value: unknown, fallback = "scene-lifecycle"): string {
  return safeString(value, fallback);
}

function normalizeErrorReason(error: unknown, fallback = "scene-lifecycle-error"): string {
  try {
    const normalized = normalizeUnknownError(error);
    return safeString(normalized.message, fallback);
  } catch {
    return fallback;
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
    // Lifecycle logging must never break runtime.
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
    // Lifecycle logging must never break runtime.
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
    // Lifecycle logging must never break runtime.
  }
}

function normalizeLabel(value: unknown, fallback = "scene-lifecycle"): string {
  const normalized = safeString(value, fallback);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeCleanupKind(value: unknown): SceneLifecycleCleanupKind {
  const normalized = safeString(value, "callback");

  if (
    normalized === "callback"
    || normalized === "disposable"
    || normalized === "abort-controller"
    || normalized === "event-listener"
    || normalized === "timeout"
    || normalized === "animation-frame"
    || normalized === "external"
  ) {
    return normalized;
  }

  return "callback";
}

function createCleanupId(label: string): string {
  return createEditorId({
    prefix: `cleanup_${label.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    entropyLength: 8,
  });
}

function createStepId(label: string): string {
  return createEditorId({
    prefix: `step_${label.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    entropyLength: 8,
  });
}

function isTerminalStatus(status: SceneLifecycleStatus): boolean {
  return status === "destroying" || status === "destroyed";
}

function methodFromDisposable(
  disposable: SceneLifecycleDisposable,
  method: "destroy" | "dispose" | "stop" | "auto",
): ((reason?: string) => void | Promise<void>) | null {
  try {
    if (method === "destroy" && typeof disposable.destroy === "function") {
      return disposable.destroy.bind(disposable);
    }

    if (method === "dispose" && typeof disposable.dispose === "function") {
      return disposable.dispose.bind(disposable);
    }

    if (method === "stop" && typeof disposable.stop === "function") {
      return (reason?: string) => disposable.stop?.(reason);
    }

    if (method === "auto") {
      if (typeof disposable.destroy === "function") {
        return disposable.destroy.bind(disposable);
      }

      if (typeof disposable.dispose === "function") {
        return disposable.dispose.bind(disposable);
      }

      if (typeof disposable.stop === "function") {
        return (reason?: string) => disposable.stop?.(reason);
      }
    }

    return null;
  } catch {
    return null;
  }
}

function safeRemoveCleanup(
  cleanups: Map<string, SceneLifecycleCleanupRegistration>,
  id: string,
): void {
  try {
    cleanups.delete(id);
  } catch {
    // Ignore.
  }
}

function stepToFailed(
  step: SceneLifecycleStep,
  error: unknown,
  startedAtMs: number,
): SceneLifecycleStep {
  return {
    ...step,
    status: "failed",
    failedAt: now(),
    elapsedMs: elapsedMs(startedAtMs),
    error: normalizeUnknownError(error),
  };
}

function stepToCompleted(
  step: SceneLifecycleStep,
  startedAtMs: number,
): SceneLifecycleStep {
  return {
    ...step,
    status: "completed",
    completedAt: now(),
    elapsedMs: elapsedMs(startedAtMs),
    error: null,
  };
}

function stepToRunning(step: SceneLifecycleStep): SceneLifecycleStep {
  return {
    ...step,
    status: "running",
    startedAt: now(),
  };
}

export function createSceneLifecycle(options?: SceneLifecycleOptions): SceneLifecycleHandle {
  const logger = options?.logger;
  const id = safeString(options?.id, createEditorId({ prefix: "scene_lifecycle" }));
  const label = normalizeLabel(options?.label, "scene-lifecycle");
  const throwOnCriticalCleanupFailure = safeBoolean(options?.throwOnCriticalCleanupFailure, false);
  const destroyOnParentAbort = safeBoolean(options?.destroyOnParentAbort, true);
  const createdAt = now();

  const abortController = new AbortController();
  const cleanups = new Map<string, SceneLifecycleCleanupRegistration>();
  const listeners = new Set<SceneLifecycleStatusListener>();
  const steps = new Map<string, SceneLifecycleStep>();

  let status: SceneLifecycleStatus = "created";
  let updatedAt = createdAt;
  let initializedAt: string | null = null;
  let runningAt: string | null = null;
  let pausedAt: string | null = null;
  let failedAt: string | null = null;
  let destroyingAt: string | null = null;
  let destroyedAt: string | null = null;
  let lastReason: string | null = null;
  let lastError: Record<string, unknown> | null = null;
  let destroyPromise: Promise<void> | null = null;

  function emitStatus(previousStatus: SceneLifecycleStatus, reason?: string | null): void {
    const event: SceneLifecycleStatusEvent = {
      status,
      previousStatus,
      reason: reason ?? null,
      createdAt: now(),
    };

    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (error) {
        logWarn(logger, "Scene lifecycle status listener failed.", {
          error: normalizeUnknownError(error),
          status,
          previousStatus,
        });
      }
    }
  }

  function setStatus(nextStatus: SceneLifecycleStatus, reason?: string | null): void {
    if (status === "destroyed" && nextStatus !== "destroyed") {
      return;
    }

    const previousStatus = status;
    const normalizedReason = reason === null || reason === undefined ? null : normalizeReason(reason, "scene-lifecycle-status");

    status = nextStatus;
    updatedAt = now();
    lastReason = normalizedReason ?? lastReason;

    if (nextStatus === "initializing") initializedAt = initializedAt ?? updatedAt;
    if (nextStatus === "running") runningAt = runningAt ?? updatedAt;
    if (nextStatus === "paused") pausedAt = updatedAt;
    if (nextStatus === "failed") failedAt = failedAt ?? updatedAt;
    if (nextStatus === "destroying") destroyingAt = destroyingAt ?? updatedAt;
    if (nextStatus === "destroyed") destroyedAt = destroyedAt ?? updatedAt;

    emitStatus(previousStatus, normalizedReason);

    logDebug(logger, "Scene lifecycle status changed.", {
      id,
      label,
      previousStatus,
      status: nextStatus,
      reason: normalizedReason,
    });
  }

  function setError(error: unknown, reason?: string | null): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed", reason ?? normalizeErrorReason(error, "scene-lifecycle-failed"));
  }

  function throwIfDestroyed(action = "scene-lifecycle-action"): void {
    const normalizedAction = normalizeReason(action, "scene-lifecycle-action");

    if (isTerminalStatus(status)) {
      throw new Error(`Scene lifecycle is ${status}. Action '${normalizedAction}' is not allowed.`);
    }

    if (abortController.signal.aborted) {
      throw new Error(`Scene lifecycle signal is aborted. Action '${normalizedAction}' is not allowed.`);
    }
  }

  function registerCleanup(input: {
    readonly kind?: SceneLifecycleCleanupKind;
    readonly label: string;
    readonly critical?: boolean;
    readonly cleanup: (reason: string) => void | Promise<void>;
  }): SceneLifecycleUnsubscribe {
    const cleanupLabel = normalizeLabel(input.label, "cleanup");
    const cleanupId = createCleanupId(cleanupLabel);

    const registration: SceneLifecycleCleanupRegistration = {
      id: cleanupId,
      kind: normalizeCleanupKind(input.kind),
      label: cleanupLabel,
      createdAt: now(),
      critical: safeBoolean(input.critical, false),
      cleanup: input.cleanup,
    };

    cleanups.set(cleanupId, registration);

    let unsubscribed = false;

    return () => {
      if (unsubscribed) {
        return;
      }

      unsubscribed = true;
      safeRemoveCleanup(cleanups, cleanupId);
    };
  }

  async function runCleanup(
    registration: SceneLifecycleCleanupRegistration,
    reason: string,
  ): Promise<void> {
    const normalizedReason = normalizeReason(reason, "scene-lifecycle-cleanup");

    try {
      await registration.cleanup(normalizedReason);

      logDebug(logger, "Scene lifecycle cleanup completed.", {
        id: registration.id,
        kind: registration.kind,
        label: registration.label,
        critical: registration.critical,
        reason: normalizedReason,
      });
    } catch (error) {
      logWarn(logger, "Scene lifecycle cleanup failed.", {
        id: registration.id,
        kind: registration.kind,
        label: registration.label,
        critical: registration.critical,
        reason: normalizedReason,
        error: normalizeUnknownError(error),
      });

      if (registration.critical && throwOnCriticalCleanupFailure) {
        throw error;
      }
    }
  }

  function getSnapshot(): SceneLifecycleSnapshot {
    const allSteps = [...steps.values()];
    const failedStepCount = allSteps.filter((step) => step.status === "failed").length;
    const pendingStepCount = allSteps.filter((step) => step.status === "pending" || step.status === "running").length;
    const criticalCleanupCount = [...cleanups.values()].filter((cleanup) => cleanup.critical).length;

    return {
      kind: SCENE_LIFECYCLE_SNAPSHOT_KIND,
      id,
      status,
      createdAt,
      updatedAt,
      initializedAt,
      runningAt,
      pausedAt,
      failedAt,
      destroyingAt,
      destroyedAt,
      lastReason,
      lastError,
      cleanupCount: cleanups.size,
      criticalCleanupCount,
      listenerCount: listeners.size,
      stepCount: allSteps.length,
      failedStepCount,
      pendingStepCount,
      abortSignalAborted: abortController.signal.aborted,
      steps: allSteps,
    };
  }

  const handle: SceneLifecycleHandle = {
    kind: SCENE_LIFECYCLE_KIND,

    initialize(reason?: string): void {
      throwIfDestroyed("initialize");
      setStatus("initializing", reason ?? "initialize");
    },

    markRunning(reason?: string): void {
      throwIfDestroyed("markRunning");
      setStatus("running", reason ?? "running");
    },

    pause(reason?: string): void {
      throwIfDestroyed("pause");

      if (status !== "running") {
        return;
      }

      setStatus("paused", reason ?? "pause");
    },

    resume(reason?: string): void {
      throwIfDestroyed("resume");

      if (status !== "paused") {
        return;
      }

      setStatus("running", reason ?? "resume");
    },

    fail(error: unknown, reason?: string): void {
      if (status === "destroyed") {
        return;
      }

      setError(error, reason ?? "scene-lifecycle-failed");
    },

    getId(): string {
      return id;
    },

    getStatus(): SceneLifecycleStatus {
      return status;
    },

    getAbortSignal(): AbortSignal {
      return abortController.signal;
    },

    getSnapshot,

    isAlive(): boolean {
      return !isTerminalStatus(status) && !abortController.signal.aborted;
    },

    isRunning(): boolean {
      return status === "running";
    },

    isDestroyed(): boolean {
      return status === "destroyed";
    },

    throwIfDestroyed,

    onStatus(listener: SceneLifecycleStatusListener): SceneLifecycleUnsubscribe {
      if (typeof listener !== "function") {
        return () => undefined;
      }

      listeners.add(listener);

      let unsubscribed = false;

      return () => {
        if (unsubscribed) {
          return;
        }

        unsubscribed = true;

        try {
          listeners.delete(listener);
        } catch {
          // Ignore.
        }
      };
    },

    async runStep<T>(
      stepOptions: RunLifecycleStepOptions,
      task: (signal: AbortSignal) => T | Promise<T>,
    ): Promise<T> {
      const stepLabel = normalizeLabel(stepOptions.label, "lifecycle-step");
      const stepId = safeString(stepOptions.id, createStepId(stepLabel));
      const startedAtMs = nowMs();

      if (stepOptions.skipIfDestroyed === true && isTerminalStatus(status)) {
        const skippedStep: SceneLifecycleStep = {
          id: stepId,
          label: stepLabel,
          status: "skipped",
          startedAt: null,
          completedAt: now(),
          failedAt: null,
          elapsedMs: 0,
          error: null,
        };

        steps.set(stepId, skippedStep);
        throw new Error(`Lifecycle step '${stepLabel}' was skipped because lifecycle is ${status}.`);
      }

      throwIfDestroyed(`runStep:${stepLabel}`);

      const initialStep: SceneLifecycleStep = {
        id: stepId,
        label: stepLabel,
        status: "pending",
        startedAt: null,
        completedAt: null,
        failedAt: null,
        elapsedMs: null,
        error: null,
      };

      steps.set(stepId, stepToRunning(initialStep));

      try {
        const result = await task(abortController.signal);
        const runningStep = steps.get(stepId) ?? initialStep;
        steps.set(stepId, stepToCompleted(runningStep, startedAtMs));

        return result;
      } catch (error) {
        const runningStep = steps.get(stepId) ?? initialStep;
        steps.set(stepId, stepToFailed(runningStep, error, startedAtMs));

        if (stepOptions.critical !== false) {
          setError(error, `critical-step-failed:${stepLabel}`);
        }

        throw error;
      }
    },

    registerCleanup,

    registerDisposable(input: {
      readonly label: string;
      readonly disposable: SceneLifecycleDisposable | null | undefined;
      readonly method?: "destroy" | "dispose" | "stop" | "auto";
      readonly critical?: boolean;
    }): SceneLifecycleUnsubscribe {
      const disposable = input.disposable;

      if (!disposable) {
        return () => undefined;
      }

      const method = methodFromDisposable(disposable, input.method ?? "auto");

      if (!method) {
        return () => undefined;
      }

      return registerCleanup({
        kind: "disposable",
        label: input.label,
        critical: input.critical,
        cleanup: async (reason: string) => {
          await method(normalizeReason(reason, "scene-lifecycle-disposable-cleanup"));
        },
      });
    },

    registerAbortController(input: {
      readonly label: string;
      readonly controller: AbortController | null | undefined;
      readonly critical?: boolean;
    }): SceneLifecycleUnsubscribe {
      if (!input.controller) {
        return () => undefined;
      }

      return registerCleanup({
        kind: "abort-controller",
        label: input.label,
        critical: input.critical,
        cleanup: (reason: string) => {
          try {
            const normalizedReason = normalizeReason(reason, "scene-lifecycle-abort-controller");

            if (!input.controller?.signal.aborted) {
              input.controller?.abort(normalizedReason);
            }
          } catch {
            // Abort is best-effort.
          }
        },
      });
    },

    registerEventListener<K extends keyof WindowEventMap>(
      input: {
        readonly target: Window;
        readonly type: K;
        readonly listener: (event: WindowEventMap[K]) => void;
        readonly options?: AddEventListenerOptions | boolean;
        readonly label?: string;
        readonly critical?: boolean;
      },
    ): SceneLifecycleUnsubscribe {
      try {
        input.target.addEventListener(input.type, input.listener as EventListener, input.options);

        return registerCleanup({
          kind: "event-listener",
          label: input.label ?? `window:${String(input.type)}`,
          critical: input.critical,
          cleanup: () => {
            input.target.removeEventListener(input.type, input.listener as EventListener, input.options);
          },
        });
      } catch (error) {
        logWarn(logger, "Window event listener registration failed.", {
          type: String(input.type),
          error: normalizeUnknownError(error),
        });

        return () => undefined;
      }
    },

    registerDocumentEventListener<K extends keyof DocumentEventMap>(
      input: {
        readonly target: Document;
        readonly type: K;
        readonly listener: (event: DocumentEventMap[K]) => void;
        readonly options?: AddEventListenerOptions | boolean;
        readonly label?: string;
        readonly critical?: boolean;
      },
    ): SceneLifecycleUnsubscribe {
      try {
        input.target.addEventListener(input.type, input.listener as EventListener, input.options);

        return registerCleanup({
          kind: "event-listener",
          label: input.label ?? `document:${String(input.type)}`,
          critical: input.critical,
          cleanup: () => {
            input.target.removeEventListener(input.type, input.listener as EventListener, input.options);
          },
        });
      } catch (error) {
        logWarn(logger, "Document event listener registration failed.", {
          type: String(input.type),
          error: normalizeUnknownError(error),
        });

        return () => undefined;
      }
    },

    registerElementEventListener<K extends keyof HTMLElementEventMap>(
      input: {
        readonly target: HTMLElement;
        readonly type: K;
        readonly listener: (event: HTMLElementEventMap[K]) => void;
        readonly options?: AddEventListenerOptions | boolean;
        readonly label?: string;
        readonly critical?: boolean;
      },
    ): SceneLifecycleUnsubscribe {
      try {
        input.target.addEventListener(input.type, input.listener as EventListener, input.options);

        return registerCleanup({
          kind: "event-listener",
          label: input.label ?? `element:${String(input.type)}`,
          critical: input.critical,
          cleanup: () => {
            input.target.removeEventListener(input.type, input.listener as EventListener, input.options);
          },
        });
      } catch (error) {
        logWarn(logger, "Element event listener registration failed.", {
          type: String(input.type),
          error: normalizeUnknownError(error),
        });

        return () => undefined;
      }
    },

    registerTimeout(input: {
      readonly label: string;
      readonly timeoutId: number | null | undefined;
      readonly critical?: boolean;
    }): SceneLifecycleUnsubscribe {
      if (typeof input.timeoutId !== "number") {
        return () => undefined;
      }

      return registerCleanup({
        kind: "timeout",
        label: input.label,
        critical: input.critical,
        cleanup: () => {
          window.clearTimeout(input.timeoutId);
        },
      });
    },

    registerAnimationFrame(input: {
      readonly label: string;
      readonly frameId: number | null | undefined;
      readonly critical?: boolean;
    }): SceneLifecycleUnsubscribe {
      if (typeof input.frameId !== "number") {
        return () => undefined;
      }

      return registerCleanup({
        kind: "animation-frame",
        label: input.label,
        critical: input.critical,
        cleanup: () => {
          window.cancelAnimationFrame(input.frameId);
        },
      });
    },

    async destroy(reason?: string): Promise<void> {
      if (destroyPromise) {
        return destroyPromise;
      }

      destroyPromise = (async () => {
        if (status === "destroyed") {
          return;
        }

        const destroyReason = normalizeReason(reason, "scene-lifecycle-destroy");

        setStatus("destroying", destroyReason);

        try {
          if (!abortController.signal.aborted) {
            abortController.abort(destroyReason);
          }
        } catch {
          // Abort is best-effort.
        }

        const cleanupList = [...cleanups.values()].reverse();
        cleanups.clear();

        const failures: unknown[] = [];

        for (const cleanup of cleanupList) {
          try {
            await runCleanup(cleanup, destroyReason);
          } catch (error) {
            failures.push(error);
          }
        }

        listeners.clear();

        if (failures.length > 0 && throwOnCriticalCleanupFailure) {
          lastError = normalizeUnknownError(failures[0]);
          setStatus("failed", "destroy-cleanup-failed");
          throw failures[0];
        }

        setStatus("destroyed", destroyReason);

        logInfo(logger, "Scene lifecycle destroyed.", {
          id,
          label,
          reason: destroyReason,
          cleanupCount: cleanupList.length,
          failureCount: failures.length,
        });
      })();

      return destroyPromise;
    },
  };

  if (options?.parentSignal) {
    try {
      if (options.parentSignal.aborted) {
        if (destroyOnParentAbort) {
          void handle.destroy("parent-signal-already-aborted");
        } else {
          setStatus("failed", "parent-signal-already-aborted");
        }
      } else {
        const onAbort = (): void => {
          if (destroyOnParentAbort) {
            void handle.destroy("parent-signal-abort");
          } else {
            try {
              abortController.abort("parent-signal-abort");
            } catch {
              // Ignore.
            }
            setStatus("failed", "parent-signal-abort");
          }
        };

        options.parentSignal.addEventListener("abort", onAbort, {
          once: true,
        });

        registerCleanup({
          kind: "event-listener",
          label: "parent-abort-signal",
          cleanup: () => {
            options.parentSignal?.removeEventListener("abort", onAbort);
          },
        });
      }
    } catch (error) {
      logWarn(logger, "Parent abort signal wiring failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  logDebug(logger, "Scene lifecycle created.", {
    id,
    label,
    destroyOnParentAbort,
  });

  return handle;
}

export function isSceneLifecycleHandle(value: unknown): value is SceneLifecycleHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<SceneLifecycleHandle>;

    return (
      record.kind === SCENE_LIFECYCLE_KIND
      && typeof record.initialize === "function"
      && typeof record.runStep === "function"
      && typeof record.registerCleanup === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}