// src/frontend/runtime/physics/double_tap_detector.ts

import type { PhysicsTimestampMs } from "./physics_models";

import {
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  sanitizePhysicsString,
} from "./physics_models";

import {
  PHYSICS_DEFAULT_DOUBLE_TAP_WINDOW_MS,
  PHYSICS_MAX_DOUBLE_TAP_WINDOW_MS,
  PHYSICS_MIN_DOUBLE_TAP_WINDOW_MS,
} from "./physics_defaults";

/**
 * Generic double-tap detector used by the physics/input bridge.
 *
 * Primary use case:
 * - detect double Space press
 * - convert it into a flight toggle request
 *
 * This file is intentionally DOM-free:
 * - no KeyboardEvent imports
 * - no window/document access
 * - no store access
 *
 * keyboard_input.ts or input_controller.ts should translate real browser events
 * into plain DoubleTapPressInput objects and pass them here.
 */

export type DoubleTapKeyId = string;

export type DoubleTapDetectionReason =
  | "detected"
  | "first_tap"
  | "outside_window"
  | "repeat_ignored"
  | "disabled"
  | "invalid_event"
  | "already_consumed"
  | "reset";

export interface DoubleTapDetectorConfig {
  readonly enabled: boolean;

  /**
   * Maximum time between first and second tap.
   */
  readonly windowMs: PhysicsTimestampMs;

  /**
   * Optional maximum age of an unfinished tap sequence.
   * If exceeded, old tap state is discarded before processing the next press.
   */
  readonly maxSequenceAgeMs: PhysicsTimestampMs;

  /**
   * Keyboard repeat should not count as a second tap.
   */
  readonly ignoreRepeatedPresses: boolean;

  /**
   * If true, a detected double tap consumes the current sequence and the next
   * press starts a fresh sequence.
   */
  readonly consumeAfterDetection: boolean;

  /**
   * If true, the detector returns "already_consumed" for duplicate press ids.
   * Useful when pointer/keyboard fallback layers may both forward one action.
   */
  readonly dedupePressIds: boolean;
}

export interface DoubleTapDetectorConfigPatch {
  readonly enabled?: unknown;
  readonly windowMs?: unknown;
  readonly maxSequenceAgeMs?: unknown;
  readonly ignoreRepeatedPresses?: unknown;
  readonly consumeAfterDetection?: unknown;
  readonly dedupePressIds?: unknown;
}

export interface DoubleTapPressInput {
  readonly keyId?: unknown;
  readonly nowMs?: unknown;

  /**
   * True when the browser reports KeyboardEvent.repeat.
   */
  readonly repeat?: unknown;

  /**
   * Optional stable id for a press edge.
   * If provided, the detector can dedupe duplicate forwarded actions.
   */
  readonly pressId?: unknown;

  /**
   * Optional guard from caller. If false, event is ignored.
   */
  readonly active?: unknown;
}

export interface DoubleTapMemoryEntry {
  readonly keyId: DoubleTapKeyId;
  readonly tapCount: number;
  readonly firstTapAtMs: PhysicsTimestampMs | null;
  readonly lastTapAtMs: PhysicsTimestampMs | null;
  readonly lastDetectedAtMs: PhysicsTimestampMs | null;
  readonly lastPressId: string | null;
  readonly consumed: boolean;
  readonly sequence: number;
}

export interface DoubleTapResult {
  readonly detected: boolean;
  readonly reason: DoubleTapDetectionReason;
  readonly keyId: DoubleTapKeyId;
  readonly tapCount: number;
  readonly firstTapAtMs: PhysicsTimestampMs | null;
  readonly previousTapAtMs: PhysicsTimestampMs | null;
  readonly currentTapAtMs: PhysicsTimestampMs | null;
  readonly elapsedMs: PhysicsTimestampMs | null;
  readonly consumed: boolean;
  readonly sequence: number;
  readonly warnings: readonly string[];
}

export interface DoubleTapDetectorSnapshot {
  readonly config: DoubleTapDetectorConfig;
  readonly entries: readonly DoubleTapMemoryEntry[];
  readonly lastResult: DoubleTapResult | null;
  readonly revision: number;
}

export const DOUBLE_TAP_DEFAULT_KEY_ID = "space";

export const DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG: DoubleTapDetectorConfig = Object.freeze({
  enabled: true,
  windowMs: PHYSICS_DEFAULT_DOUBLE_TAP_WINDOW_MS,
  maxSequenceAgeMs: Math.max(PHYSICS_DEFAULT_DOUBLE_TAP_WINDOW_MS * 2, 500),
  ignoreRepeatedPresses: true,
  consumeAfterDetection: true,
  dedupePressIds: true,
});

export const EMPTY_DOUBLE_TAP_RESULT: DoubleTapResult = Object.freeze({
  detected: false,
  reason: "reset",
  keyId: DOUBLE_TAP_DEFAULT_KEY_ID,
  tapCount: 0,
  firstTapAtMs: null,
  previousTapAtMs: null,
  currentTapAtMs: null,
  elapsedMs: null,
  consumed: false,
  sequence: 0,
  warnings: [],
});

function createWarning(message: string): string {
  try {
    return sanitizePhysicsString(message, "Unknown double-tap warning");
  } catch {
    return "Unknown double-tap warning";
  }
}

export function normalizeDoubleTapKeyId(value: unknown, fallback: DoubleTapKeyId = DOUBLE_TAP_DEFAULT_KEY_ID): DoubleTapKeyId {
  try {
    const keyId = sanitizePhysicsString(value, fallback).trim().toLowerCase();
    return keyId.length > 0 ? keyId : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeDoubleTapTimestamp(
  value: unknown,
  fallback: PhysicsTimestampMs = 0,
): PhysicsTimestampMs {
  try {
    return sanitizePhysicsNumber(value, fallback, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
  } catch {
    return fallback;
  }
}

export function normalizeDoubleTapPressId(value: unknown): string | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    const text = sanitizePhysicsString(value, "");
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export function createDoubleTapDetectorConfig(
  patch: DoubleTapDetectorConfigPatch | null | undefined = undefined,
): DoubleTapDetectorConfig {
  try {
    const windowMs = sanitizePhysicsNumber(
      patch?.windowMs,
      DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG.windowMs,
      {
        min: PHYSICS_MIN_DOUBLE_TAP_WINDOW_MS,
        max: PHYSICS_MAX_DOUBLE_TAP_WINDOW_MS,
      },
    );

    const maxSequenceAgeMs = sanitizePhysicsNumber(
      patch?.maxSequenceAgeMs,
      Math.max(windowMs * 2, DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG.maxSequenceAgeMs),
      {
        min: windowMs,
        max: Math.max(PHYSICS_MAX_DOUBLE_TAP_WINDOW_MS * 4, 1000),
      },
    );

    return {
      enabled: sanitizePhysicsBoolean(patch?.enabled, DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG.enabled),
      windowMs,
      maxSequenceAgeMs,
      ignoreRepeatedPresses: sanitizePhysicsBoolean(
        patch?.ignoreRepeatedPresses,
        DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG.ignoreRepeatedPresses,
      ),
      consumeAfterDetection: sanitizePhysicsBoolean(
        patch?.consumeAfterDetection,
        DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG.consumeAfterDetection,
      ),
      dedupePressIds: sanitizePhysicsBoolean(
        patch?.dedupePressIds,
        DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG.dedupePressIds,
      ),
    };
  } catch {
    return { ...DEFAULT_DOUBLE_TAP_DETECTOR_CONFIG };
  }
}

export function createDoubleTapMemoryEntry(
  keyId: DoubleTapKeyId,
  patch: Partial<DoubleTapMemoryEntry> = {},
): DoubleTapMemoryEntry {
  try {
    return {
      keyId: normalizeDoubleTapKeyId(patch.keyId ?? keyId),
      tapCount: Math.max(0, Math.floor(sanitizePhysicsNumber(patch.tapCount, 0))),
      firstTapAtMs:
        patch.firstTapAtMs === null || patch.firstTapAtMs === undefined
          ? null
          : normalizeDoubleTapTimestamp(patch.firstTapAtMs),
      lastTapAtMs:
        patch.lastTapAtMs === null || patch.lastTapAtMs === undefined
          ? null
          : normalizeDoubleTapTimestamp(patch.lastTapAtMs),
      lastDetectedAtMs:
        patch.lastDetectedAtMs === null || patch.lastDetectedAtMs === undefined
          ? null
          : normalizeDoubleTapTimestamp(patch.lastDetectedAtMs),
      lastPressId: normalizeDoubleTapPressId(patch.lastPressId),
      consumed: sanitizePhysicsBoolean(patch.consumed, false),
      sequence: Math.max(0, Math.floor(sanitizePhysicsNumber(patch.sequence, 0))),
    };
  } catch {
    return {
      keyId,
      tapCount: 0,
      firstTapAtMs: null,
      lastTapAtMs: null,
      lastDetectedAtMs: null,
      lastPressId: null,
      consumed: false,
      sequence: 0,
    };
  }
}

export function createDoubleTapResult(params: {
  readonly detected?: boolean;
  readonly reason?: DoubleTapDetectionReason;
  readonly keyId?: DoubleTapKeyId;
  readonly tapCount?: unknown;
  readonly firstTapAtMs?: PhysicsTimestampMs | null;
  readonly previousTapAtMs?: PhysicsTimestampMs | null;
  readonly currentTapAtMs?: PhysicsTimestampMs | null;
  readonly elapsedMs?: PhysicsTimestampMs | null;
  readonly consumed?: unknown;
  readonly sequence?: unknown;
  readonly warnings?: readonly string[];
} = {}): DoubleTapResult {
  try {
    return {
      detected: sanitizePhysicsBoolean(params.detected, false),
      reason: params.reason ?? "invalid_event",
      keyId: normalizeDoubleTapKeyId(params.keyId),
      tapCount: Math.max(0, Math.floor(sanitizePhysicsNumber(params.tapCount, 0))),
      firstTapAtMs:
        params.firstTapAtMs === null || params.firstTapAtMs === undefined
          ? null
          : normalizeDoubleTapTimestamp(params.firstTapAtMs),
      previousTapAtMs:
        params.previousTapAtMs === null || params.previousTapAtMs === undefined
          ? null
          : normalizeDoubleTapTimestamp(params.previousTapAtMs),
      currentTapAtMs:
        params.currentTapAtMs === null || params.currentTapAtMs === undefined
          ? null
          : normalizeDoubleTapTimestamp(params.currentTapAtMs),
      elapsedMs:
        params.elapsedMs === null || params.elapsedMs === undefined
          ? null
          : normalizeDoubleTapTimestamp(params.elapsedMs),
      consumed: sanitizePhysicsBoolean(params.consumed, false),
      sequence: Math.max(0, Math.floor(sanitizePhysicsNumber(params.sequence, 0))),
      warnings: Array.isArray(params.warnings) ? params.warnings.map(createWarning) : [],
    };
  } catch {
    return { ...EMPTY_DOUBLE_TAP_RESULT };
  }
}

export class DoubleTapDetector {
  private config: DoubleTapDetectorConfig;
  private readonly entries: Map<DoubleTapKeyId, DoubleTapMemoryEntry>;
  private lastResult: DoubleTapResult | null;
  private revision: number;

  public constructor(config: DoubleTapDetectorConfigPatch | null | undefined = undefined) {
    this.config = createDoubleTapDetectorConfig(config);
    this.entries = new Map();
    this.lastResult = null;
    this.revision = 0;
  }

  public updateConfig(config: DoubleTapDetectorConfigPatch | null | undefined): DoubleTapDetectorConfig {
    try {
      this.config = createDoubleTapDetectorConfig({
        ...this.config,
        ...(config ?? {}),
      });

      this.revision += 1;
      return this.config;
    } catch {
      this.config = createDoubleTapDetectorConfig();
      this.revision += 1;
      return this.config;
    }
  }

  public getConfig(): DoubleTapDetectorConfig {
    try {
      return { ...this.config };
    } catch {
      return createDoubleTapDetectorConfig();
    }
  }

  public reset(keyId?: unknown): DoubleTapResult {
    try {
      const normalizedKeyId = keyId === undefined ? null : normalizeDoubleTapKeyId(keyId);

      if (normalizedKeyId) {
        this.entries.delete(normalizedKeyId);
      } else {
        this.entries.clear();
      }

      this.revision += 1;

      const result = createDoubleTapResult({
        detected: false,
        reason: "reset",
        keyId: normalizedKeyId ?? DOUBLE_TAP_DEFAULT_KEY_ID,
        sequence: this.revision,
      });

      this.lastResult = result;
      return result;
    } catch {
      this.entries.clear();
      this.revision += 1;
      this.lastResult = { ...EMPTY_DOUBLE_TAP_RESULT };
      return this.lastResult;
    }
  }

  public consume(keyId: unknown = DOUBLE_TAP_DEFAULT_KEY_ID): DoubleTapResult {
    try {
      const normalizedKeyId = normalizeDoubleTapKeyId(keyId);
      const previous = this.entries.get(normalizedKeyId);

      if (!previous) {
        const result = createDoubleTapResult({
          detected: false,
          reason: "reset",
          keyId: normalizedKeyId,
          sequence: this.revision,
        });

        this.lastResult = result;
        return result;
      }

      const next = createDoubleTapMemoryEntry(normalizedKeyId, {
        ...previous,
        consumed: true,
        tapCount: 0,
        firstTapAtMs: null,
        lastTapAtMs: null,
        sequence: previous.sequence + 1,
      });

      this.entries.set(normalizedKeyId, next);
      this.revision += 1;

      const result = createDoubleTapResult({
        detected: false,
        reason: "already_consumed",
        keyId: normalizedKeyId,
        tapCount: next.tapCount,
        firstTapAtMs: next.firstTapAtMs,
        previousTapAtMs: previous.lastTapAtMs,
        currentTapAtMs: next.lastTapAtMs,
        consumed: true,
        sequence: next.sequence,
      });

      this.lastResult = result;
      return result;
    } catch {
      return this.reset(keyId);
    }
  }

  public press(input: DoubleTapPressInput | null | undefined): DoubleTapResult {
    try {
      const warnings: string[] = [];

      if (!this.config.enabled) {
        const result = createDoubleTapResult({
          detected: false,
          reason: "disabled",
          keyId: normalizeDoubleTapKeyId(input?.keyId),
          warnings,
          sequence: this.revision,
        });

        this.lastResult = result;
        return result;
      }

      if (!input || sanitizePhysicsBoolean(input.active, true) === false) {
        const result = createDoubleTapResult({
          detected: false,
          reason: "invalid_event",
          keyId: normalizeDoubleTapKeyId(input?.keyId),
          warnings: [createWarning("Double-tap press ignored because input was inactive or missing.")],
          sequence: this.revision,
        });

        this.lastResult = result;
        return result;
      }

      const keyId = normalizeDoubleTapKeyId(input.keyId);
      const nowMs = normalizeDoubleTapTimestamp(input.nowMs);
      const repeat = sanitizePhysicsBoolean(input.repeat, false);
      const pressId = normalizeDoubleTapPressId(input.pressId);

      if (this.config.ignoreRepeatedPresses && repeat) {
        const previous = this.getOrCreateEntry(keyId);

        const result = createDoubleTapResult({
          detected: false,
          reason: "repeat_ignored",
          keyId,
          tapCount: previous.tapCount,
          firstTapAtMs: previous.firstTapAtMs,
          previousTapAtMs: previous.lastTapAtMs,
          currentTapAtMs: nowMs,
          elapsedMs: previous.lastTapAtMs === null ? null : Math.max(0, nowMs - previous.lastTapAtMs),
          consumed: previous.consumed,
          sequence: previous.sequence,
        });

        this.lastResult = result;
        return result;
      }

      let previous = this.getOrCreateEntry(keyId);

      if (
        this.config.dedupePressIds &&
        pressId !== null &&
        previous.lastPressId !== null &&
        previous.lastPressId === pressId
      ) {
        const result = createDoubleTapResult({
          detected: false,
          reason: "already_consumed",
          keyId,
          tapCount: previous.tapCount,
          firstTapAtMs: previous.firstTapAtMs,
          previousTapAtMs: previous.lastTapAtMs,
          currentTapAtMs: nowMs,
          elapsedMs: previous.lastTapAtMs === null ? null : Math.max(0, nowMs - previous.lastTapAtMs),
          consumed: previous.consumed,
          sequence: previous.sequence,
          warnings: [createWarning("Duplicate double-tap press id ignored.")],
        });

        this.lastResult = result;
        return result;
      }

      previous = this.expireIfStale(previous, nowMs);

      const previousTapAtMs = previous.lastTapAtMs;
      const firstTapAtMs = previous.firstTapAtMs ?? nowMs;
      const elapsedMs = previousTapAtMs === null ? null : Math.max(0, nowMs - previousTapAtMs);
      const withinWindow = elapsedMs !== null && elapsedMs <= this.config.windowMs;

      if (previous.consumed) {
        previous = createDoubleTapMemoryEntry(keyId, {
          keyId,
          tapCount: 0,
          firstTapAtMs: null,
          lastTapAtMs: null,
          lastDetectedAtMs: previous.lastDetectedAtMs,
          lastPressId: previous.lastPressId,
          consumed: false,
          sequence: previous.sequence + 1,
        });
      }

      if (withinWindow && previous.tapCount >= 1) {
        const sequence = previous.sequence + 1;

        const nextEntry = createDoubleTapMemoryEntry(keyId, {
          keyId,
          tapCount: this.config.consumeAfterDetection ? 0 : previous.tapCount + 1,
          firstTapAtMs: this.config.consumeAfterDetection ? null : firstTapAtMs,
          lastTapAtMs: this.config.consumeAfterDetection ? null : nowMs,
          lastDetectedAtMs: nowMs,
          lastPressId: pressId,
          consumed: this.config.consumeAfterDetection,
          sequence,
        });

        this.entries.set(keyId, nextEntry);
        this.revision += 1;

        const result = createDoubleTapResult({
          detected: true,
          reason: "detected",
          keyId,
          tapCount: previous.tapCount + 1,
          firstTapAtMs,
          previousTapAtMs,
          currentTapAtMs: nowMs,
          elapsedMs,
          consumed: nextEntry.consumed,
          sequence,
          warnings,
        });

        this.lastResult = result;
        return result;
      }

      const outsideWindow = elapsedMs !== null && elapsedMs > this.config.windowMs;

      const next = createDoubleTapMemoryEntry(keyId, {
        keyId,
        tapCount: 1,
        firstTapAtMs: nowMs,
        lastTapAtMs: nowMs,
        lastDetectedAtMs: previous.lastDetectedAtMs,
        lastPressId: pressId,
        consumed: false,
        sequence: previous.sequence + 1,
      });

      this.entries.set(keyId, next);
      this.revision += 1;

      const result = createDoubleTapResult({
        detected: false,
        reason: outsideWindow ? "outside_window" : "first_tap",
        keyId,
        tapCount: next.tapCount,
        firstTapAtMs: next.firstTapAtMs,
        previousTapAtMs,
        currentTapAtMs: nowMs,
        elapsedMs,
        consumed: false,
        sequence: next.sequence,
        warnings,
      });

      this.lastResult = result;
      return result;
    } catch (error) {
      const result = createDoubleTapResult({
        detected: false,
        reason: "invalid_event",
        keyId: normalizeDoubleTapKeyId(input?.keyId),
        warnings: [
          createWarning(
            error instanceof Error
              ? error.message
              : "Double-tap detector failed while processing press input.",
          ),
        ],
        sequence: this.revision,
      });

      this.lastResult = result;
      return result;
    }
  }

  public peek(keyId: unknown = DOUBLE_TAP_DEFAULT_KEY_ID): DoubleTapMemoryEntry {
    try {
      const normalizedKeyId = normalizeDoubleTapKeyId(keyId);
      return this.getOrCreateEntry(normalizedKeyId);
    } catch {
      return createDoubleTapMemoryEntry(DOUBLE_TAP_DEFAULT_KEY_ID);
    }
  }

  public getLastResult(): DoubleTapResult | null {
    try {
      return this.lastResult ? { ...this.lastResult } : null;
    } catch {
      return null;
    }
  }

  public snapshot(): DoubleTapDetectorSnapshot {
    try {
      return {
        config: { ...this.config },
        entries: Array.from(this.entries.values()).map((entry) => ({ ...entry })),
        lastResult: this.lastResult ? { ...this.lastResult } : null,
        revision: this.revision,
      };
    } catch {
      return {
        config: createDoubleTapDetectorConfig(),
        entries: [],
        lastResult: null,
        revision: 0,
      };
    }
  }

  private getOrCreateEntry(keyId: DoubleTapKeyId): DoubleTapMemoryEntry {
    try {
      const existing = this.entries.get(keyId);

      if (existing) {
        return existing;
      }

      const entry = createDoubleTapMemoryEntry(keyId);
      this.entries.set(keyId, entry);
      return entry;
    } catch {
      return createDoubleTapMemoryEntry(keyId);
    }
  }

  private expireIfStale(entry: DoubleTapMemoryEntry, nowMs: PhysicsTimestampMs): DoubleTapMemoryEntry {
    try {
      if (entry.lastTapAtMs === null) {
        return entry;
      }

      const ageMs = Math.max(0, nowMs - entry.lastTapAtMs);

      if (ageMs <= this.config.maxSequenceAgeMs) {
        return entry;
      }

      const expired = createDoubleTapMemoryEntry(entry.keyId, {
        keyId: entry.keyId,
        tapCount: 0,
        firstTapAtMs: null,
        lastTapAtMs: null,
        lastDetectedAtMs: entry.lastDetectedAtMs,
        lastPressId: entry.lastPressId,
        consumed: false,
        sequence: entry.sequence + 1,
      });

      this.entries.set(entry.keyId, expired);
      this.revision += 1;

      return expired;
    } catch {
      return entry;
    }
  }
}

export function createDoubleTapDetector(
  config: DoubleTapDetectorConfigPatch | null | undefined = undefined,
): DoubleTapDetector {
  try {
    return new DoubleTapDetector(config);
  } catch {
    return new DoubleTapDetector();
  }
}

export function createSpaceDoubleTapDetector(
  config: DoubleTapDetectorConfigPatch | null | undefined = undefined,
): DoubleTapDetector {
  try {
    return new DoubleTapDetector(config);
  } catch {
    return new DoubleTapDetector();
  }
}

export function detectSpaceDoubleTap(
  detector: DoubleTapDetector,
  params: {
    readonly nowMs?: unknown;
    readonly repeat?: unknown;
    readonly pressId?: unknown;
    readonly active?: unknown;
  },
): DoubleTapResult {
  try {
    return detector.press({
      keyId: DOUBLE_TAP_DEFAULT_KEY_ID,
      nowMs: params.nowMs,
      repeat: params.repeat,
      pressId: params.pressId,
      active: params.active,
    });
  } catch {
    return createDoubleTapResult({
      detected: false,
      reason: "invalid_event",
      keyId: DOUBLE_TAP_DEFAULT_KEY_ID,
    });
  }
}

export function isDoubleTapDetected(result: DoubleTapResult | null | undefined): boolean {
  try {
    return Boolean(result?.detected);
  } catch {
    return false;
  }
}

export function shouldToggleFlightFromDoubleTap(result: DoubleTapResult | null | undefined): boolean {
  try {
    return Boolean(result?.detected && result.reason === "detected");
  } catch {
    return false;
  }
}