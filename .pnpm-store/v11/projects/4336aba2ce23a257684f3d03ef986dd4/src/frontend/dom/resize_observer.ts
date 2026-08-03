// services/vectoplan-editor/src/frontend/dom/resize_observer.ts
import { getCanvasHostSize, type EditorDomRefs } from "@dom/dom_refs";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeNumber } from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type EditorResizeSource =
  | "initial"
  | "resize-observer"
  | "window-resize"
  | "visual-viewport"
  | "visibility-change"
  | "manual"
  | "fallback";

export interface EditorResizeSnapshot {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly aspect: number;
  readonly canvasPixelWidth: number;
  readonly canvasPixelHeight: number;
  readonly hasCanvas: boolean;
  readonly isVisible: boolean;
  readonly source: EditorResizeSource;
  readonly createdAt: string;
}

export interface EditorResizeObserverOptions {
  readonly refs: EditorDomRefs;
  readonly store?: EditorStore;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
  readonly observeWindow?: boolean;
  readonly observeVisualViewport?: boolean;
  readonly observeDocumentVisibility?: boolean;
  readonly updateCanvasBackingStore?: boolean;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly maxDevicePixelRatio?: number;
  readonly debounceMs?: number;
  readonly onResize?: (snapshot: EditorResizeSnapshot) => void;
}

export interface EditorResizeObserverHandle {
  readonly kind: "vectoplan-editor-resize-observer.v1";
  start(): void;
  stop(): void;
  destroy(reason?: string): void;
  isRunning(): boolean;
  isDestroyed(): boolean;
  requestMeasure(source?: EditorResizeSource): EditorResizeSnapshot;
  getSnapshot(): EditorResizeSnapshot | null;
}

interface ResizeListenerBinding {
  readonly remove: () => void;
}

const RESIZE_OBSERVER_KIND = "vectoplan-editor-resize-observer.v1" as const;
const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MIN_HEIGHT = 240;
const DEFAULT_MAX_DEVICE_PIXEL_RATIO = 2;
const DEFAULT_DEBOUNCE_MS = 80;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
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
    // Resize logging must never break resize handling.
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
    // Resize logging must never break resize handling.
  }
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  try {
    return Math.min(max, Math.max(min, safeNumber(value, fallback)));
  } catch {
    return fallback;
  }
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  try {
    return Math.trunc(clampNumber(value, fallback, min, max));
  } catch {
    return fallback;
  }
}

function readDevicePixelRatio(maxDevicePixelRatio: number): number {
  try {
    const raw = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    return clampNumber(raw, 1, 0.25, maxDevicePixelRatio);
  } catch {
    return 1;
  }
}

function readDocumentVisibility(): boolean {
  try {
    if (typeof document === "undefined") {
      return true;
    }

    return document.visibilityState !== "hidden";
  } catch {
    return true;
  }
}

function normalizeDimension(value: unknown, fallback: number, min: number): number {
  try {
    const numeric = safeNumber(value, fallback);

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.max(min, Math.round(numeric));
  } catch {
    return fallback;
  }
}

function buildSnapshot(input: {
  readonly refs: EditorDomRefs;
  readonly source: EditorResizeSource;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maxDevicePixelRatio: number;
}): EditorResizeSnapshot {
  try {
    const hostSize = getCanvasHostSize(input.refs);
    const width = normalizeDimension(hostSize.width, input.minWidth, input.minWidth);
    const height = normalizeDimension(hostSize.height, input.minHeight, input.minHeight);
    const devicePixelRatio = readDevicePixelRatio(input.maxDevicePixelRatio);
    const aspect = height > 0 ? width / height : 1;
    const canvasPixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const canvasPixelHeight = Math.max(1, Math.round(height * devicePixelRatio));

    return {
      width,
      height,
      devicePixelRatio,
      aspect,
      canvasPixelWidth,
      canvasPixelHeight,
      hasCanvas: input.refs.canvas !== null,
      isVisible: readDocumentVisibility() && width > 0 && height > 0,
      source: input.source,
      createdAt: now(),
    };
  } catch {
    const width = Math.max(1, input.minWidth);
    const height = Math.max(1, input.minHeight);

    return {
      width,
      height,
      devicePixelRatio: 1,
      aspect: width / Math.max(1, height),
      canvasPixelWidth: width,
      canvasPixelHeight: height,
      hasCanvas: input.refs.canvas !== null,
      isVisible: true,
      source: "fallback",
      createdAt: now(),
    };
  }
}

function updateCanvasBackingStore(
  refs: EditorDomRefs,
  snapshot: EditorResizeSnapshot,
): void {
  try {
    const canvas = refs.canvas;

    if (!canvas) {
      return;
    }

    if (canvas.width !== snapshot.canvasPixelWidth) {
      canvas.width = snapshot.canvasPixelWidth;
    }

    if (canvas.height !== snapshot.canvasPixelHeight) {
      canvas.height = snapshot.canvasPixelHeight;
    }

    canvas.style.width = `${snapshot.width}px`;
    canvas.style.height = `${snapshot.height}px`;

    canvas.dataset.viewportWidth = String(snapshot.width);
    canvas.dataset.viewportHeight = String(snapshot.height);
    canvas.dataset.canvasPixelWidth = String(snapshot.canvasPixelWidth);
    canvas.dataset.canvasPixelHeight = String(snapshot.canvasPixelHeight);
    canvas.dataset.devicePixelRatio = String(snapshot.devicePixelRatio);
    canvas.dataset.resizeSource = snapshot.source;
    canvas.dataset.resizeAt = snapshot.createdAt;
  } catch {
    // Canvas resize must not break runtime.
  }
}

function updateRootDataset(
  refs: EditorDomRefs,
  snapshot: EditorResizeSnapshot,
): void {
  try {
    refs.root.dataset.viewportWidth = String(snapshot.width);
    refs.root.dataset.viewportHeight = String(snapshot.height);
    refs.root.dataset.viewportAspect = String(snapshot.aspect);
    refs.root.dataset.devicePixelRatio = String(snapshot.devicePixelRatio);
    refs.root.dataset.canvasPixelWidth = String(snapshot.canvasPixelWidth);
    refs.root.dataset.canvasPixelHeight = String(snapshot.canvasPixelHeight);
    refs.root.dataset.lastResizeSource = snapshot.source;
    refs.root.dataset.lastResizeAt = snapshot.createdAt;
    refs.root.dataset.isVisible = snapshot.isVisible ? "true" : "false";
    refs.root.dataset.hasCanvas = snapshot.hasCanvas ? "true" : "false";
  } catch {
    // Dataset update must not throw.
  }
}

function updateStore(
  store: EditorStore | undefined,
  snapshot: EditorResizeSnapshot,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "viewport/update",
        width: snapshot.width,
        height: snapshot.height,
        devicePixelRatio: snapshot.devicePixelRatio,
        isVisible: snapshot.isVisible,
        hasCanvas: snapshot.hasCanvas,
        source: "resize-observer",
        createdAt: snapshot.createdAt,
      }),
      {
        action: "resize-observer.viewport-update",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store update must not break resize observer.
  }
}

function snapshotsEqual(
  left: EditorResizeSnapshot | null,
  right: EditorResizeSnapshot,
): boolean {
  try {
    if (!left) {
      return false;
    }

    return (
      left.width === right.width
      && left.height === right.height
      && left.devicePixelRatio === right.devicePixelRatio
      && left.canvasPixelWidth === right.canvasPixelWidth
      && left.canvasPixelHeight === right.canvasPixelHeight
      && left.hasCanvas === right.hasCanvas
      && left.isVisible === right.isVisible
    );
  } catch {
    return false;
  }
}

function createDebouncedMeasure(
  callback: (source: EditorResizeSource) => void,
  debounceMs: number,
): {
  readonly schedule: (source: EditorResizeSource) => void;
  readonly cancel: () => void;
  readonly flush: (source?: EditorResizeSource) => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let latestSource: EditorResizeSource = "manual";

  const safeDebounceMs = clampInteger(debounceMs, DEFAULT_DEBOUNCE_MS, 0, 2_000);

  const cancel = (): void => {
    try {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    } catch {
      timeoutId = null;
    }
  };

  const run = (source: EditorResizeSource): void => {
    timeoutId = null;

    try {
      callback(source);
    } catch {
      // Resize callback must not throw into event loop.
    }
  };

  return {
    schedule(source: EditorResizeSource): void {
      latestSource = source;

      if (safeDebounceMs <= 0) {
        cancel();
        run(source);
        return;
      }

      cancel();

      try {
        timeoutId = globalThis.setTimeout(() => run(latestSource), safeDebounceMs);
      } catch {
        run(source);
      }
    },

    cancel,

    flush(source?: EditorResizeSource): void {
      const nextSource = source ?? latestSource;
      cancel();
      run(nextSource);
    },
  };
}

function addEventTargetListener(
  target: EventTarget | null | undefined,
  eventName: string,
  listener: EventListener,
): ResizeListenerBinding {
  try {
    if (!target) {
      return {
        remove: () => undefined,
      };
    }

    target.addEventListener(eventName, listener, {
      passive: true,
    });

    return {
      remove: () => {
        try {
          target.removeEventListener(eventName, listener);
        } catch {
          // Ignore.
        }
      },
    };
  } catch {
    return {
      remove: () => undefined,
    };
  }
}

function addWindowListener(
  eventName: string,
  listener: EventListener,
): ResizeListenerBinding {
  try {
    if (typeof window === "undefined") {
      return {
        remove: () => undefined,
      };
    }

    return addEventTargetListener(window, eventName, listener);
  } catch {
    return {
      remove: () => undefined,
    };
  }
}

function addDocumentListener(
  eventName: string,
  listener: EventListener,
): ResizeListenerBinding {
  try {
    if (typeof document === "undefined") {
      return {
        remove: () => undefined,
      };
    }

    return addEventTargetListener(document, eventName, listener);
  } catch {
    return {
      remove: () => undefined,
    };
  }
}

function addVisualViewportListener(
  eventName: "resize" | "scroll",
  listener: EventListener,
): ResizeListenerBinding {
  try {
    if (typeof window === "undefined" || !window.visualViewport) {
      return {
        remove: () => undefined,
      };
    }

    return addEventTargetListener(window.visualViewport, eventName, listener);
  } catch {
    return {
      remove: () => undefined,
    };
  }
}

export function createEditorResizeObserver(
  options: EditorResizeObserverOptions,
): EditorResizeObserverHandle {
  const refs = options.refs;
  const logger = options.logger;
  const minWidth = clampInteger(options.minWidth, DEFAULT_MIN_WIDTH, 1, 100_000);
  const minHeight = clampInteger(options.minHeight, DEFAULT_MIN_HEIGHT, 1, 100_000);
  const maxDevicePixelRatio = clampNumber(options.maxDevicePixelRatio, DEFAULT_MAX_DEVICE_PIXEL_RATIO, 0.25, 8);
  const updateBackingStore = options.updateCanvasBackingStore ?? true;
  const observeWindow = options.observeWindow ?? true;
  const observeVisualViewport = options.observeVisualViewport ?? true;
  const observeDocumentVisibility = options.observeDocumentVisibility ?? true;
  const debounceMs = clampInteger(options.debounceMs, DEFAULT_DEBOUNCE_MS, 0, 2_000);

  let running = false;
  let destroyed = false;
  let resizeObserver: ResizeObserver | null = null;
  let snapshot: EditorResizeSnapshot | null = null;
  let abortBinding: ResizeListenerBinding | null = null;

  const bindings: ResizeListenerBinding[] = [];

  const applySnapshot = (nextSnapshot: EditorResizeSnapshot): EditorResizeSnapshot => {
    try {
      if (updateBackingStore) {
        updateCanvasBackingStore(refs, nextSnapshot);
      }

      updateRootDataset(refs, nextSnapshot);
      updateStore(options.store, nextSnapshot);

      try {
        options.onResize?.(nextSnapshot);
      } catch (error) {
        logWarn(logger, "Resize onResize callback failed.", {
          error: normalizeUnknownError(error),
        });
      }

      snapshot = nextSnapshot;
      return nextSnapshot;
    } catch (error) {
      logWarn(logger, "Resize snapshot application failed.", {
        error: normalizeUnknownError(error),
      });

      snapshot = nextSnapshot;
      return nextSnapshot;
    }
  };

  const measureNow = (source: EditorResizeSource): EditorResizeSnapshot => {
    const nextSnapshot = buildSnapshot({
      refs,
      source,
      minWidth,
      minHeight,
      maxDevicePixelRatio,
    });

    if (snapshotsEqual(snapshot, nextSnapshot)) {
      return snapshot ?? nextSnapshot;
    }

    return applySnapshot(nextSnapshot);
  };

  const debouncedMeasure = createDebouncedMeasure((source) => {
    if (!running || destroyed) {
      return;
    }

    measureNow(source);
  }, debounceMs);

  const handleResizeObserver: ResizeObserverCallback = () => {
    debouncedMeasure.schedule("resize-observer");
  };

  const handleWindowResize = (): void => {
    debouncedMeasure.schedule("window-resize");
  };

  const handleVisualViewportResize = (): void => {
    debouncedMeasure.schedule("visual-viewport");
  };

  const handleVisibilityChange = (): void => {
    debouncedMeasure.schedule("visibility-change");
  };

  const stopBindings = (): void => {
    for (const binding of bindings.splice(0)) {
      try {
        binding.remove();
      } catch {
        // Ignore.
      }
    }
  };

  const stopResizeObserver = (): void => {
    try {
      resizeObserver?.disconnect();
    } catch {
      // Ignore.
    }

    resizeObserver = null;
  };

  const attachAbortSignal = (): void => {
    try {
      const signal = options.signal;

      if (!signal || abortBinding) {
        return;
      }

      if (signal.aborted) {
        handle.destroy("abort-signal-already-aborted");
        return;
      }

      const onAbort = (): void => {
        handle.destroy("abort-signal");
      };

      signal.addEventListener("abort", onAbort, {
        once: true,
      });

      abortBinding = {
        remove: () => {
          try {
            signal.removeEventListener("abort", onAbort);
          } catch {
            // Ignore.
          }
        },
      };
    } catch {
      // Abort wiring is best-effort.
    }
  };

  const detachAbortSignal = (): void => {
    try {
      abortBinding?.remove();
    } catch {
      // Ignore.
    }

    abortBinding = null;
  };

  const handle: EditorResizeObserverHandle = {
    kind: RESIZE_OBSERVER_KIND,

    start(): void {
      if (destroyed || running) {
        return;
      }

      running = true;

      try {
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(handleResizeObserver);
          resizeObserver.observe(refs.canvasHost);
        }
      } catch (error) {
        resizeObserver = null;
        logWarn(logger, "ResizeObserver setup failed. Window resize fallback will be used.", {
          error: normalizeUnknownError(error),
        });
      }

      if (observeWindow) {
        bindings.push(addWindowListener("resize", handleWindowResize));
        bindings.push(addWindowListener("orientationchange", handleWindowResize));
      }

      if (observeDocumentVisibility) {
        bindings.push(addDocumentListener("visibilitychange", handleVisibilityChange));
      }

      if (observeVisualViewport) {
        bindings.push(addVisualViewportListener("resize", handleVisualViewportResize));
        bindings.push(addVisualViewportListener("scroll", handleVisualViewportResize));
      }

      attachAbortSignal();

      logDebug(logger, "Editor resize observer started.", {
        debounceMs,
        observeWindow,
        observeVisualViewport,
        observeDocumentVisibility,
        updateBackingStore,
      });

      measureNow("initial");
    },

    stop(): void {
      if (!running) {
        return;
      }

      running = false;
      debouncedMeasure.cancel();
      stopResizeObserver();
      stopBindings();

      logDebug(logger, "Editor resize observer stopped.");
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      running = false;
      debouncedMeasure.cancel();
      stopResizeObserver();
      stopBindings();
      detachAbortSignal();

      logDebug(logger, "Editor resize observer destroyed.", {
        reason: reason ?? "unknown",
      });
    },

    isRunning(): boolean {
      return running;
    },

    isDestroyed(): boolean {
      return destroyed;
    },

    requestMeasure(source?: EditorResizeSource): EditorResizeSnapshot {
      if (destroyed) {
        return snapshot ?? buildSnapshot({
          refs,
          source: source ?? "manual",
          minWidth,
          minHeight,
          maxDevicePixelRatio,
        });
      }

      return measureNow(source ?? "manual");
    },

    getSnapshot(): EditorResizeSnapshot | null {
      return snapshot;
    },
  };

  return handle;
}

export function isEditorResizeObserverHandle(value: unknown): value is EditorResizeObserverHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<EditorResizeObserverHandle>;

    return (
      record.kind === RESIZE_OBSERVER_KIND
      && typeof record.start === "function"
      && typeof record.stop === "function"
      && typeof record.requestMeasure === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}