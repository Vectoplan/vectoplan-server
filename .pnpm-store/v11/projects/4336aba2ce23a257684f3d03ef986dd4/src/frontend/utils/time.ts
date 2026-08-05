// services/vectoplan-editor/src/frontend/utils/time.ts

export type TimestampMs = number;

export type IsoTimestamp = string;

export interface TimeSnapshot {
  readonly iso: IsoTimestamp;
  readonly epochMs: TimestampMs;
  readonly monotonicMs: number;
}

export interface DurationParts {
  readonly totalMs: number;
  readonly seconds: number;
  readonly minutes: number;
  readonly hours: number;
}

const FALLBACK_ISO_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function nowEpochMs(): TimestampMs {
  try {
    const value = Date.now();

    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function nowMonotonicMs(): number {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      const value = performance.now();

      return Number.isFinite(value) ? value : nowEpochMs();
    }

    return nowEpochMs();
  } catch {
    return nowEpochMs();
  }
}

export function nowIsoString(): IsoTimestamp {
  try {
    return new Date().toISOString();
  } catch {
    return FALLBACK_ISO_TIMESTAMP;
  }
}

export function createTimeSnapshot(): TimeSnapshot {
  return {
    iso: nowIsoString(),
    epochMs: nowEpochMs(),
    monotonicMs: nowMonotonicMs(),
  };
}

export function isoFromEpochMs(value: unknown, fallback: IsoTimestamp = FALLBACK_ISO_TIMESTAMP): IsoTimestamp {
  try {
    const epochMs = normalizeEpochMs(value, Number.NaN);

    if (!Number.isFinite(epochMs)) {
      return fallback;
    }

    return new Date(epochMs).toISOString();
  } catch {
    return fallback;
  }
}

export function normalizeEpochMs(value: unknown, fallback = 0): TimestampMs {
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

    if (numeric > 0 && numeric < 10_000_000_000) {
      return Math.round(numeric * 1000);
    }

    return Math.round(numeric);
  } catch {
    return fallback;
  }
}

export function parseIsoTimestamp(value: unknown, fallback: TimestampMs | null = null): TimestampMs | null {
  try {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return fallback;
    }

    const parsed = Date.parse(trimmed);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function elapsedMsSince(startedAtMs: unknown): number {
  try {
    const start = typeof startedAtMs === "number" ? startedAtMs : Number.NaN;

    if (!Number.isFinite(start)) {
      return 0;
    }

    return Math.max(0, nowMonotonicMs() - start);
  } catch {
    return 0;
  }
}

export function elapsedEpochMsSince(startedAtEpochMs: unknown): number {
  try {
    const start = normalizeEpochMs(startedAtEpochMs, Number.NaN);

    if (!Number.isFinite(start)) {
      return 0;
    }

    return Math.max(0, nowEpochMs() - start);
  } catch {
    return 0;
  }
}

export function measureElapsedMs(startedAtMonotonicMs: number, endedAtMonotonicMs = nowMonotonicMs()): number {
  try {
    if (!Number.isFinite(startedAtMonotonicMs) || !Number.isFinite(endedAtMonotonicMs)) {
      return 0;
    }

    return Math.max(0, endedAtMonotonicMs - startedAtMonotonicMs);
  } catch {
    return 0;
  }
}

export function sleep(ms: unknown, signal?: AbortSignal): Promise<void> {
  const duration = clampDurationMs(ms, 0, 120_000);

  if (duration <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timeoutId: number | null = null;

    const cleanup = (): void => {
      try {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      } catch {
        // Ignore.
      }

      try {
        signal?.removeEventListener("abort", onAbort);
      } catch {
        // Ignore.
      }
    };

    const onAbort = (): void => {
      cleanup();

      try {
        reject(new DOMException("Sleep was aborted.", "AbortError"));
      } catch {
        reject(new Error("Sleep was aborted."));
      }
    };

    try {
      if (signal?.aborted) {
        onAbort();
        return;
      }

      signal?.addEventListener("abort", onAbort, {
        once: true,
      });

      timeoutId = window.setTimeout(() => {
        cleanup();
        resolve();
      }, duration);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function createTimeoutSignal(
  timeoutMs: unknown,
  parentSignal?: AbortSignal,
): {
  readonly signal: AbortSignal;
  readonly controller: AbortController;
  readonly cleanup: () => void;
  readonly timedOut: () => boolean;
} {
  const controller = new AbortController();
  const duration = clampDurationMs(timeoutMs, 0, 120_000);
  let didTimeOut = false;
  let timeoutId: number | null = null;

  const cleanup = (): void => {
    try {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    } catch {
      // Ignore.
    }

    try {
      parentSignal?.removeEventListener("abort", onParentAbort);
    } catch {
      // Ignore.
    }
  };

  const onParentAbort = (): void => {
    try {
      if (!controller.signal.aborted) {
        controller.abort(parentSignal?.reason ?? "parent-abort");
      }
    } catch {
      // Ignore.
    }
  };

  try {
    if (parentSignal?.aborted) {
      controller.abort(parentSignal.reason ?? "parent-abort");
    } else {
      parentSignal?.addEventListener("abort", onParentAbort, {
        once: true,
      });
    }

    if (duration > 0) {
      timeoutId = window.setTimeout(() => {
        didTimeOut = true;

        try {
          if (!controller.signal.aborted) {
            controller.abort("timeout");
          }
        } catch {
          // Ignore.
        }
      }, duration);
    }
  } catch {
    // Ignore setup failure; return usable controller.
  }

  return {
    signal: controller.signal,
    controller,
    cleanup,
    timedOut: () => didTimeOut,
  };
}

export function clampDurationMs(
  value: unknown,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  fallback = min,
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

    return Math.round(Math.min(max, Math.max(min, numeric)));
  } catch {
    return fallback;
  }
}

export function secondsToMs(value: unknown, fallback = 0): number {
  try {
    const seconds =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    if (!Number.isFinite(seconds)) {
      return fallback;
    }

    return Math.round(seconds * 1000);
  } catch {
    return fallback;
  }
}

export function msToSeconds(value: unknown, fallback = 0): number {
  try {
    const ms =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    if (!Number.isFinite(ms)) {
      return fallback;
    }

    return ms / 1000;
  } catch {
    return fallback;
  }
}

export function durationParts(ms: unknown): DurationParts {
  try {
    const totalMs = clampDurationMs(ms, 0, Number.MAX_SAFE_INTEGER, 0);
    const seconds = totalMs / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;

    return {
      totalMs,
      seconds,
      minutes,
      hours,
    };
  } catch {
    return {
      totalMs: 0,
      seconds: 0,
      minutes: 0,
      hours: 0,
    };
  }
}

export function formatDurationMs(ms: unknown): string {
  try {
    const duration = clampDurationMs(ms, 0, Number.MAX_SAFE_INTEGER, 0);

    if (duration < 1000) {
      return `${duration}ms`;
    }

    const seconds = duration / 1000;

    if (seconds < 60) {
      return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
    }

    const minutes = seconds / 60;

    if (minutes < 60) {
      return `${minutes.toFixed(minutes < 10 ? 2 : 1)}m`;
    }

    const hours = minutes / 60;

    return `${hours.toFixed(hours < 10 ? 2 : 1)}h`;
  } catch {
    return "0ms";
  }
}

export function createFrameTimer(): {
  readonly start: () => number;
  readonly stop: (startedAtMs: number) => number;
  readonly now: () => number;
} {
  return {
    start(): number {
      return nowMonotonicMs();
    },

    stop(startedAtMs: number): number {
      return measureElapsedMs(startedAtMs);
    },

    now(): number {
      return nowMonotonicMs();
    },
  };
}

export function shouldThrottle(
  lastRunAtMs: number | null | undefined,
  intervalMs: number,
  nowMsValue = nowMonotonicMs(),
): boolean {
  try {
    if (lastRunAtMs === null || lastRunAtMs === undefined || !Number.isFinite(lastRunAtMs)) {
      return false;
    }

    return nowMsValue - lastRunAtMs < intervalMs;
  } catch {
    return false;
  }
}

export function createIntervalGate(intervalMs: number): {
  readonly shouldRun: () => boolean;
  readonly markRun: () => void;
  readonly reset: () => void;
  readonly getLastRunAtMs: () => number | null;
} {
  let lastRunAtMs: number | null = null;
  const safeIntervalMs = clampDurationMs(intervalMs, 0, Number.MAX_SAFE_INTEGER, 0);

  return {
    shouldRun(): boolean {
      return !shouldThrottle(lastRunAtMs, safeIntervalMs);
    },

    markRun(): void {
      lastRunAtMs = nowMonotonicMs();
    },

    reset(): void {
      lastRunAtMs = null;
    },

    getLastRunAtMs(): number | null {
      return lastRunAtMs;
    },
  };
}

export function createDebouncedTask(
  callback: () => void,
  delayMs: number,
): {
  readonly schedule: () => void;
  readonly cancel: () => void;
  readonly flush: () => void;
} {
  let timeoutId: number | null = null;
  const safeDelayMs = clampDurationMs(delayMs, 0, 120_000, 0);

  const cancel = (): void => {
    try {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    } catch {
      // Ignore.
    }
  };

  const run = (): void => {
    timeoutId = null;

    try {
      callback();
    } catch {
      // Debounced tasks must not throw into browser event loop.
    }
  };

  return {
    schedule(): void {
      cancel();

      try {
        timeoutId = window.setTimeout(run, safeDelayMs);
      } catch {
        run();
      }
    },

    cancel,

    flush(): void {
      const hadTimeout = timeoutId !== null;
      cancel();

      if (hadTimeout) {
        run();
      }
    },
  };
}

export function createRafLoop(
  callback: (deltaMs: number, nowMs: number) => void,
): {
  readonly start: () => void;
  readonly stop: () => void;
  readonly isRunning: () => boolean;
} {
  let running = false;
  let frameId: number | null = null;
  let lastNowMs = nowMonotonicMs();

  const tick = (timestamp: number): void => {
    if (!running) {
      return;
    }

    const currentNowMs = Number.isFinite(timestamp) ? timestamp : nowMonotonicMs();
    const deltaMs = Math.max(0, currentNowMs - lastNowMs);
    lastNowMs = currentNowMs;

    try {
      callback(deltaMs, currentNowMs);
    } catch {
      // RAF callback errors must not permanently stop cleanup.
    }

    try {
      frameId = window.requestAnimationFrame(tick);
    } catch {
      running = false;
      frameId = null;
    }
  };

  return {
    start(): void {
      if (running) {
        return;
      }

      running = true;
      lastNowMs = nowMonotonicMs();

      try {
        frameId = window.requestAnimationFrame(tick);
      } catch {
        running = false;
        frameId = null;
      }
    },

    stop(): void {
      running = false;

      try {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
      } catch {
        // Ignore.
      }

      frameId = null;
    },

    isRunning(): boolean {
      return running;
    },
  };
}