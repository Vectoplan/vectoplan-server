// src/frontend/runtime/physics/physics_runtime.ts

import type {
  PhysicsCameraBinding,
  PhysicsConfig,
  PhysicsDeltaSeconds,
  PhysicsError,
  PhysicsEulerAngles,
  PhysicsRuntimeSnapshot,
  PhysicsStepPhase,
  PhysicsTimestampMs,
  PlayerMovementIntent,
  PlayerPhysicsState,
} from "./physics_models";

import {
  createPhysicsCameraBinding,
  createPhysicsError,
  EMPTY_PLAYER_MOVEMENT_INTENT,
  normalizeMovementIntent,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  ZERO_PHYSICS_ANGLES,
} from "./physics_models";

import {
  DEFAULT_PHYSICS_CONFIG,
  createDefaultPhysicsConfig,
  mergePhysicsConfig,
  type PhysicsConfigPatch,
} from "./physics_defaults";

import {
  createInitialPlayerPhysicsState,
  createPlayerPhysicsCameraBinding,
  createPlayerPhysicsStateFromSpawn,
  type CameraLikeSpawnInput,
} from "./player_physics_state";

import type {
  PlayerPhysicsControllerConfigPatch,
  PlayerPhysicsControllerStepResult,
} from "./player_physics_controller";

import {
  createPlayerPhysicsController,
  type PlayerPhysicsController,
} from "./player_physics_controller";

import type {
  VoxelCollisionQueryLike,
} from "./voxel_collision_solver";

/**
 * Runtime wrapper around the player physics controller.
 *
 * Owns:
 * - fixed timestep accumulator
 * - controller lifecycle
 * - current runtime phase
 * - safe snapshots for SceneRuntime / Store / Debug UI
 * - callbacks for integration layers
 *
 * Does not own:
 * - DOM input events
 * - camera object mutation
 * - store mutation
 * - chunk loading
 * - rendering
 *
 * Expected SceneRuntime frame order:
 * 1. collect input snapshot
 * 2. update look angles from mouse/controller
 * 3. call physicsRuntime.stepFrame(...)
 * 4. write returned camera.eyePosition to FirstPersonCameraController / Three camera
 * 5. update targeting
 * 6. update tools/previews
 * 7. render
 */

export type PhysicsRuntimeLifecycleState =
  | "created"
  | "started"
  | "paused"
  | "stopped"
  | "destroyed";

export interface PhysicsRuntimeConfig {
  readonly enabled: boolean;
  readonly physics: PhysicsConfig;
  readonly controller: PlayerPhysicsControllerConfigPatch;
  readonly fixedTimeStepSeconds: PhysicsDeltaSeconds;
  readonly maxFrameDeltaSeconds: PhysicsDeltaSeconds;
  readonly maxSubSteps: number;
  readonly exposeWarnings: boolean;
  readonly failClosedWithoutQuery: boolean;
}

export interface PhysicsRuntimeConfigPatch {
  readonly enabled?: unknown;
  readonly physics?: PhysicsConfigPatch | null;
  readonly controller?: PlayerPhysicsControllerConfigPatch | null;
  readonly fixedTimeStepSeconds?: unknown;
  readonly maxFrameDeltaSeconds?: unknown;
  readonly maxSubSteps?: unknown;
  readonly exposeWarnings?: unknown;
  readonly failClosedWithoutQuery?: unknown;
}

export interface PhysicsRuntimeStepFrameInput {
  readonly nowMs: PhysicsTimestampMs;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly movementIntent?: Partial<PlayerMovementIntent> | null;
  readonly lookAngles?: Partial<PhysicsEulerAngles> | null;
  readonly query?: VoxelCollisionQueryLike | null;
}

export interface PhysicsRuntimeFixedStepInput {
  readonly nowMs: PhysicsTimestampMs;
  readonly fixedDeltaSeconds: PhysicsDeltaSeconds;
  readonly movementIntent: PlayerMovementIntent;
  readonly lookAngles: PhysicsEulerAngles;
  readonly query: VoxelCollisionQueryLike;
}

export interface PhysicsRuntimeFrameResult {
  readonly ok: boolean;
  readonly phase: PhysicsStepPhase;
  readonly lifecycle: PhysicsRuntimeLifecycleState;
  readonly stepped: boolean;
  readonly subStepCount: number;
  readonly accumulatorSeconds: PhysicsDeltaSeconds;
  readonly player: PlayerPhysicsState;
  readonly camera: PhysicsCameraBinding;
  readonly lastControllerStep: PlayerPhysicsControllerStepResult | null;
  readonly error: PhysicsError | null;
  readonly warnings: readonly string[];
}

export interface PhysicsRuntimeCallbacks {
  readonly onBeforeStep?: (input: PhysicsRuntimeFixedStepInput) => void;
  readonly onAfterStep?: (result: PlayerPhysicsControllerStepResult) => void;
  readonly onFrame?: (result: PhysicsRuntimeFrameResult) => void;
  readonly onError?: (error: PhysicsError) => void;
  readonly onStateChanged?: (state: PlayerPhysicsState) => void;
}

export interface PhysicsRuntimeSnapshotExtended extends PhysicsRuntimeSnapshot {
  readonly lifecycle: PhysicsRuntimeLifecycleState;
  readonly frameRevision: number;
  readonly subStepCount: number;
  readonly lastFrameAtMs: PhysicsTimestampMs | null;
  readonly destroyed: boolean;
}

export const DEFAULT_PHYSICS_RUNTIME_CONFIG: PhysicsRuntimeConfig = Object.freeze({
  enabled: true,
  physics: DEFAULT_PHYSICS_CONFIG,
  controller: Object.freeze({}),
  fixedTimeStepSeconds: DEFAULT_PHYSICS_CONFIG.timing.fixedTimeStepSeconds,
  maxFrameDeltaSeconds: DEFAULT_PHYSICS_CONFIG.timing.maxFrameDeltaSeconds,
  maxSubSteps: DEFAULT_PHYSICS_CONFIG.timing.maxSubSteps,
  exposeWarnings: true,
  failClosedWithoutQuery: true,
});

function normalizeTimestampMs(value: unknown, fallback = 0): PhysicsTimestampMs {
  try {
    return sanitizePhysicsNumber(value, fallback, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
  } catch {
    return fallback;
  }
}

function normalizeDeltaSeconds(value: unknown, fallback = 0): PhysicsDeltaSeconds {
  try {
    return sanitizePhysicsNumber(value, fallback, {
      min: 0,
      max: 10,
    });
  } catch {
    return fallback;
  }
}

function normalizeAngles(value: Partial<PhysicsEulerAngles> | null | undefined): PhysicsEulerAngles {
  try {
    return {
      yaw: sanitizePhysicsNumber(value?.yaw, ZERO_PHYSICS_ANGLES.yaw),
      pitch: sanitizePhysicsNumber(value?.pitch, ZERO_PHYSICS_ANGLES.pitch),
      roll: sanitizePhysicsNumber(value?.roll, ZERO_PHYSICS_ANGLES.roll ?? 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_ANGLES };
  }
}

function normalizeSubStepCount(value: unknown, fallback: number): number {
  try {
    return Math.max(
      1,
      Math.floor(
        sanitizePhysicsNumber(value, fallback, {
          min: 1,
          max: 120,
        }),
      ),
    );
  } catch {
    return fallback;
  }
}

function createRuntimeError(
  code: string,
  message: string,
  options: {
    readonly cause?: unknown;
    readonly recoverable?: boolean;
  } = {},
): PhysicsError {
  try {
    return createPhysicsError(code, message, {
      cause: options.cause,
      recoverable: options.recoverable ?? true,
    });
  } catch {
    return {
      code,
      message,
      cause: options.cause,
      recoverable: options.recoverable ?? true,
    };
  }
}

function createWarning(message: string): string {
  try {
    return String(message || "Unknown physics-runtime warning");
  } catch {
    return "Unknown physics-runtime warning";
  }
}

function safeCall(callback: (() => void) | undefined, onError?: (error: unknown) => void): void {
  try {
    callback?.();
  } catch (error) {
    try {
      onError?.(error);
    } catch {
      // Intentionally ignored. Runtime callback failures must not crash physics.
    }
  }
}

function safeCallWithValue<T>(
  callback: ((value: T) => void) | undefined,
  value: T,
  onError?: (error: unknown) => void,
): void {
  try {
    callback?.(value);
  } catch (error) {
    try {
      onError?.(error);
    } catch {
      // Intentionally ignored. Runtime callback failures must not crash physics.
    }
  }
}

export function createPhysicsRuntimeConfig(
  patch: PhysicsRuntimeConfigPatch | null | undefined = undefined,
): PhysicsRuntimeConfig {
  try {
    const physics = mergePhysicsConfig(DEFAULT_PHYSICS_CONFIG, patch?.physics);
    const fixedTimeStepSeconds = sanitizePhysicsNumber(
      patch?.fixedTimeStepSeconds,
      physics.timing.fixedTimeStepSeconds,
      {
        min: 1 / 240,
        max: 1 / 20,
      },
    );

    const maxFrameDeltaSeconds = sanitizePhysicsNumber(
      patch?.maxFrameDeltaSeconds,
      physics.timing.maxFrameDeltaSeconds,
      {
        min: fixedTimeStepSeconds,
        max: 2,
      },
    );

    const maxSubSteps = normalizeSubStepCount(
      patch?.maxSubSteps,
      physics.timing.maxSubSteps,
    );

    return {
      enabled: sanitizePhysicsBoolean(patch?.enabled, DEFAULT_PHYSICS_RUNTIME_CONFIG.enabled),
      physics,
      controller: {
        ...(patch?.controller ?? {}),
        physics,
      },
      fixedTimeStepSeconds,
      maxFrameDeltaSeconds,
      maxSubSteps,
      exposeWarnings: sanitizePhysicsBoolean(
        patch?.exposeWarnings,
        DEFAULT_PHYSICS_RUNTIME_CONFIG.exposeWarnings,
      ),
      failClosedWithoutQuery: sanitizePhysicsBoolean(
        patch?.failClosedWithoutQuery,
        DEFAULT_PHYSICS_RUNTIME_CONFIG.failClosedWithoutQuery,
      ),
    };
  } catch {
    return {
      enabled: DEFAULT_PHYSICS_RUNTIME_CONFIG.enabled,
      physics: createDefaultPhysicsConfig(),
      controller: {},
      fixedTimeStepSeconds: DEFAULT_PHYSICS_RUNTIME_CONFIG.fixedTimeStepSeconds,
      maxFrameDeltaSeconds: DEFAULT_PHYSICS_RUNTIME_CONFIG.maxFrameDeltaSeconds,
      maxSubSteps: DEFAULT_PHYSICS_RUNTIME_CONFIG.maxSubSteps,
      exposeWarnings: DEFAULT_PHYSICS_RUNTIME_CONFIG.exposeWarnings,
      failClosedWithoutQuery: DEFAULT_PHYSICS_RUNTIME_CONFIG.failClosedWithoutQuery,
    };
  }
}

export function mergePhysicsRuntimeConfig(
  base: PhysicsRuntimeConfig | null | undefined,
  patch: PhysicsRuntimeConfigPatch | null | undefined,
): PhysicsRuntimeConfig {
  try {
    const safeBase = base ?? DEFAULT_PHYSICS_RUNTIME_CONFIG;

    return createPhysicsRuntimeConfig({
      enabled: patch?.enabled ?? safeBase.enabled,
      physics: patch?.physics
        ? mergePhysicsConfig(safeBase.physics, patch.physics)
        : safeBase.physics,
      controller: {
        ...safeBase.controller,
        ...(patch?.controller ?? {}),
      },
      fixedTimeStepSeconds: patch?.fixedTimeStepSeconds ?? safeBase.fixedTimeStepSeconds,
      maxFrameDeltaSeconds: patch?.maxFrameDeltaSeconds ?? safeBase.maxFrameDeltaSeconds,
      maxSubSteps: patch?.maxSubSteps ?? safeBase.maxSubSteps,
      exposeWarnings: patch?.exposeWarnings ?? safeBase.exposeWarnings,
      failClosedWithoutQuery: patch?.failClosedWithoutQuery ?? safeBase.failClosedWithoutQuery,
    });
  } catch {
    return createPhysicsRuntimeConfig(patch);
  }
}

export function createDisabledPhysicsFrameResult(params: {
  readonly lifecycle: PhysicsRuntimeLifecycleState;
  readonly player: PlayerPhysicsState;
  readonly camera: PhysicsCameraBinding;
  readonly accumulatorSeconds: PhysicsDeltaSeconds;
  readonly warning?: string;
}): PhysicsRuntimeFrameResult {
  try {
    return {
      ok: true,
      phase: "idle",
      lifecycle: params.lifecycle,
      stepped: false,
      subStepCount: 0,
      accumulatorSeconds: params.accumulatorSeconds,
      player: params.player,
      camera: params.camera,
      lastControllerStep: null,
      error: null,
      warnings: params.warning ? [createWarning(params.warning)] : [],
    };
  } catch {
    return {
      ok: true,
      phase: "idle",
      lifecycle: "created",
      stepped: false,
      subStepCount: 0,
      accumulatorSeconds: 0,
      player: params.player,
      camera: params.camera,
      lastControllerStep: null,
      error: null,
      warnings: [],
    };
  }
}

export class PhysicsRuntime {
  private config: PhysicsRuntimeConfig;
  private readonly controller: PlayerPhysicsController;
  private callbacks: PhysicsRuntimeCallbacks;
  private lifecycle: PhysicsRuntimeLifecycleState;
  private accumulatorSeconds: PhysicsDeltaSeconds;
  private lastFrameAtMs: PhysicsTimestampMs | null;
  private lastStepAtMs: PhysicsTimestampMs | null;
  private lastFrameResult: PhysicsRuntimeFrameResult | null;
  private lastError: PhysicsError | null;
  private warnings: string[];
  private frameRevision: number;
  private subStepCount: number;
  private destroyed: boolean;

  public constructor(options: {
    readonly initialState?: PlayerPhysicsState | null;
    readonly spawn?: CameraLikeSpawnInput | null;
    readonly config?: PhysicsRuntimeConfigPatch | null;
    readonly callbacks?: PhysicsRuntimeCallbacks | null;
  } = {}) {
    this.config = createPhysicsRuntimeConfig(options.config);
    const initialState =
      options.initialState ??
      createPlayerPhysicsStateFromSpawn(
        {
          position: options.spawn
            ? {
                x: sanitizePhysicsNumber(options.spawn.x, 0),
                y: sanitizePhysicsNumber(options.spawn.y, 8),
                z: sanitizePhysicsNumber(options.spawn.z, 0),
              }
            : {
                x: 0,
                y: 8,
                z: 0,
              },
          angles: options.spawn
            ? {
                yaw: sanitizePhysicsNumber(options.spawn.yaw, 0),
                pitch: sanitizePhysicsNumber(options.spawn.pitch, 0),
                roll: sanitizePhysicsNumber(options.spawn.roll, 0),
              }
            : ZERO_PHYSICS_ANGLES,
          movementMode: "airborne",
        },
        this.config.physics,
        null,
      );

    this.controller = createPlayerPhysicsController({
      initialState,
      config: this.config.controller,
    });

    this.callbacks = options.callbacks ?? {};
    this.lifecycle = "created";
    this.accumulatorSeconds = 0;
    this.lastFrameAtMs = null;
    this.lastStepAtMs = null;
    this.lastFrameResult = null;
    this.lastError = null;
    this.warnings = [];
    this.frameRevision = 0;
    this.subStepCount = 0;
    this.destroyed = false;
  }

  public start(): PhysicsRuntimeSnapshotExtended {
    try {
      if (this.destroyed) {
        this.raiseError(
          createRuntimeError("PHYSICS_RUNTIME_DESTROYED", "Cannot start a destroyed physics runtime.", {
            recoverable: false,
          }),
        );

        return this.snapshot();
      }

      this.lifecycle = "started";
      this.frameRevision += 1;
      return this.snapshot();
    } catch {
      return this.snapshot();
    }
  }

  public pause(): PhysicsRuntimeSnapshotExtended {
    try {
      if (this.destroyed) {
        return this.snapshot();
      }

      this.lifecycle = "paused";
      this.frameRevision += 1;
      return this.snapshot();
    } catch {
      return this.snapshot();
    }
  }

  public resume(): PhysicsRuntimeSnapshotExtended {
    try {
      if (this.destroyed) {
        return this.snapshot();
      }

      this.lifecycle = "started";
      this.frameRevision += 1;
      return this.snapshot();
    } catch {
      return this.snapshot();
    }
  }

  public stop(options: {
    readonly resetAccumulator?: boolean;
  } = {}): PhysicsRuntimeSnapshotExtended {
    try {
      if (this.destroyed) {
        return this.snapshot();
      }

      this.lifecycle = "stopped";

      if (sanitizePhysicsBoolean(options.resetAccumulator, true)) {
        this.accumulatorSeconds = 0;
      }

      this.frameRevision += 1;
      return this.snapshot();
    } catch {
      return this.snapshot();
    }
  }

  public destroy(): PhysicsRuntimeSnapshotExtended {
    try {
      this.lifecycle = "destroyed";
      this.destroyed = true;
      this.accumulatorSeconds = 0;
      this.callbacks = {};
      this.frameRevision += 1;
      return this.snapshot();
    } catch {
      this.lifecycle = "destroyed";
      this.destroyed = true;
      return this.snapshot();
    }
  }

  public reset(options: {
    readonly state?: PlayerPhysicsState | null;
    readonly spawn?: CameraLikeSpawnInput | null;
    readonly clearAccumulator?: boolean;
    readonly clearError?: boolean;
  } = {}): PhysicsRuntimeSnapshotExtended {
    try {
      if (this.destroyed) {
        return this.snapshot();
      }

      const nextState =
        options.state ??
        createPlayerPhysicsStateFromSpawn(
          {
            position: options.spawn
              ? {
                  x: sanitizePhysicsNumber(options.spawn.x, 0),
                  y: sanitizePhysicsNumber(options.spawn.y, 8),
                  z: sanitizePhysicsNumber(options.spawn.z, 0),
                }
              : {
                  x: 0,
                  y: 8,
                  z: 0,
                },
            angles: options.spawn
              ? {
                  yaw: sanitizePhysicsNumber(options.spawn.yaw, 0),
                  pitch: sanitizePhysicsNumber(options.spawn.pitch, 0),
                  roll: sanitizePhysicsNumber(options.spawn.roll, 0),
                }
              : ZERO_PHYSICS_ANGLES,
            movementMode: "airborne",
          },
          this.config.physics,
          null,
        );

      this.controller.reset(nextState);

      if (sanitizePhysicsBoolean(options.clearAccumulator, true)) {
        this.accumulatorSeconds = 0;
      }

      if (sanitizePhysicsBoolean(options.clearError, true)) {
        this.lastError = null;
        this.warnings = [];
      }

      this.lastFrameResult = null;
      this.lastFrameAtMs = null;
      this.lastStepAtMs = null;
      this.subStepCount = 0;
      this.frameRevision += 1;

      safeCallWithValue(this.callbacks.onStateChanged, this.controller.getState(), (error) => {
        this.raiseError(
          createRuntimeError("PHYSICS_RUNTIME_CALLBACK_FAILED", "Physics onStateChanged callback failed.", {
            cause: error,
            recoverable: true,
          }),
        );
      });

      return this.snapshot();
    } catch (error) {
      this.raiseError(
        createRuntimeError("PHYSICS_RUNTIME_RESET_FAILED", "Physics runtime reset failed.", {
          cause: error,
          recoverable: true,
        }),
      );

      return this.snapshot();
    }
  }

  public updateConfig(config: PhysicsRuntimeConfigPatch | null | undefined): PhysicsRuntimeConfig {
    try {
      this.config = mergePhysicsRuntimeConfig(this.config, config);
      this.controller.updateConfig(this.config.controller);
      this.frameRevision += 1;
      return this.config;
    } catch (error) {
      this.raiseError(
        createRuntimeError("PHYSICS_RUNTIME_CONFIG_FAILED", "Physics runtime config update failed.", {
          cause: error,
          recoverable: true,
        }),
      );

      return this.config;
    }
  }

  public setCallbacks(callbacks: PhysicsRuntimeCallbacks | null | undefined): void {
    try {
      this.callbacks = callbacks ?? {};
      this.frameRevision += 1;
    } catch {
      this.callbacks = {};
      this.frameRevision += 1;
    }
  }

  public patchCallbacks(callbacks: Partial<PhysicsRuntimeCallbacks> | null | undefined): void {
    try {
      this.callbacks = {
        ...this.callbacks,
        ...(callbacks ?? {}),
      };
      this.frameRevision += 1;
    } catch {
      this.frameRevision += 1;
    }
  }

  public getConfig(): PhysicsRuntimeConfig {
    try {
      return createPhysicsRuntimeConfig(this.config);
    } catch {
      return createPhysicsRuntimeConfig();
    }
  }

  public getPlayerState(): PlayerPhysicsState {
    try {
      return this.controller.getState();
    } catch {
      return createInitialPlayerPhysicsState(null, this.config.physics);
    }
  }

  public setPlayerState(state: PlayerPhysicsState): PlayerPhysicsState {
    try {
      const next = this.controller.setState(state);
      this.frameRevision += 1;

      safeCallWithValue(this.callbacks.onStateChanged, next, (error) => {
        this.raiseError(
          createRuntimeError("PHYSICS_RUNTIME_CALLBACK_FAILED", "Physics onStateChanged callback failed.", {
            cause: error,
            recoverable: true,
          }),
        );
      });

      return next;
    } catch {
      return this.getPlayerState();
    }
  }

  public getCameraBinding(angles: Partial<PhysicsEulerAngles> | null | undefined = ZERO_PHYSICS_ANGLES): PhysicsCameraBinding {
    try {
      return createPlayerPhysicsCameraBinding(this.getPlayerState(), normalizeAngles(angles));
    } catch {
      return createPhysicsCameraBinding(this.getPlayerState(), ZERO_PHYSICS_ANGLES);
    }
  }

  public setFlying(flying: boolean, nowMs: PhysicsTimestampMs | null = null): PlayerPhysicsState {
    try {
      const next = this.controller.setFlying(flying, nowMs);
      this.frameRevision += 1;

      safeCallWithValue(this.callbacks.onStateChanged, next, (error) => {
        this.raiseError(
          createRuntimeError("PHYSICS_RUNTIME_CALLBACK_FAILED", "Physics onStateChanged callback failed.", {
            cause: error,
            recoverable: true,
          }),
        );
      });

      return next;
    } catch {
      return this.getPlayerState();
    }
  }

  public stepFrame(input: PhysicsRuntimeStepFrameInput): PhysicsRuntimeFrameResult {
    try {
      const nowMs = normalizeTimestampMs(input.nowMs, this.lastFrameAtMs ?? 0);
      const rawDeltaSeconds = normalizeDeltaSeconds(input.deltaSeconds, 0);
      const deltaSeconds = Math.min(rawDeltaSeconds, this.config.maxFrameDeltaSeconds);
      const movementIntent = normalizeMovementIntent(input.movementIntent ?? EMPTY_PLAYER_MOVEMENT_INTENT);
      const lookAngles = normalizeAngles(input.lookAngles);
      const player = this.getPlayerState();
      const camera = this.getCameraBinding(lookAngles);

      if (this.destroyed) {
        const error = createRuntimeError(
          "PHYSICS_RUNTIME_DESTROYED",
          "Cannot step a destroyed physics runtime.",
          {
            recoverable: false,
          },
        );

        this.raiseError(error);

        return this.createFrameResult({
          ok: false,
          phase: "failed",
          stepped: false,
          subStepCount: 0,
          player,
          camera,
          error,
          warnings: [error.message],
        });
      }

      if (!this.config.enabled || !this.config.physics.enabled) {
        const result = createDisabledPhysicsFrameResult({
          lifecycle: this.lifecycle,
          player,
          camera,
          accumulatorSeconds: this.accumulatorSeconds,
          warning: "Physics runtime is disabled.",
        });

        this.lastFrameResult = result;
        this.lastFrameAtMs = nowMs;
        this.emitFrame(result);
        return result;
      }

      if (this.lifecycle !== "started") {
        const result = createDisabledPhysicsFrameResult({
          lifecycle: this.lifecycle,
          player,
          camera,
          accumulatorSeconds: this.accumulatorSeconds,
        });

        this.lastFrameResult = result;
        this.lastFrameAtMs = nowMs;
        this.emitFrame(result);
        return result;
      }

      if (!input.query) {
        const error = createRuntimeError(
          "PHYSICS_RUNTIME_QUERY_MISSING",
          "Physics runtime step skipped because no collision query was provided.",
          {
            recoverable: true,
          },
        );

        this.raiseError(error);

        if (this.config.failClosedWithoutQuery) {
          const result = this.createFrameResult({
            ok: false,
            phase: "failed",
            stepped: false,
            subStepCount: 0,
            player,
            camera,
            error,
            warnings: [error.message],
          });

          this.lastFrameResult = result;
          this.lastFrameAtMs = nowMs;
          this.emitFrame(result);
          return result;
        }

        const result = createDisabledPhysicsFrameResult({
          lifecycle: this.lifecycle,
          player,
          camera,
          accumulatorSeconds: this.accumulatorSeconds,
          warning: error.message,
        });

        this.lastFrameResult = result;
        this.lastFrameAtMs = nowMs;
        this.emitFrame(result);
        return result;
      }

      this.accumulatorSeconds += deltaSeconds;

      const fixedTimeStepSeconds = this.config.fixedTimeStepSeconds;
      const maxSubSteps = this.config.maxSubSteps;
      let localSubStepCount = 0;
      let lastControllerStep: PlayerPhysicsControllerStepResult | null = null;
      const frameWarnings: string[] = [];

      while (
        this.accumulatorSeconds + Number.EPSILON >= fixedTimeStepSeconds &&
        localSubStepCount < maxSubSteps
      ) {
        const stepInput: PhysicsRuntimeFixedStepInput = {
          nowMs,
          fixedDeltaSeconds: fixedTimeStepSeconds,
          movementIntent,
          lookAngles,
          query: input.query,
        };

        safeCallWithValue(this.callbacks.onBeforeStep, stepInput, (error) => {
          this.raiseError(
            createRuntimeError("PHYSICS_RUNTIME_CALLBACK_FAILED", "Physics onBeforeStep callback failed.", {
              cause: error,
              recoverable: true,
            }),
          );
        });

        lastControllerStep = this.controller.step({
          nowMs,
          deltaSeconds: fixedTimeStepSeconds,
          movementIntent,
          lookAngles,
          query: input.query,
        });

        safeCallWithValue(this.callbacks.onAfterStep, lastControllerStep, (error) => {
          this.raiseError(
            createRuntimeError("PHYSICS_RUNTIME_CALLBACK_FAILED", "Physics onAfterStep callback failed.", {
              cause: error,
              recoverable: true,
            }),
          );
        });

        if (!lastControllerStep.ok && lastControllerStep.error) {
          this.raiseError(lastControllerStep.error);
        }

        frameWarnings.push(...lastControllerStep.warnings);

        this.accumulatorSeconds = Math.max(0, this.accumulatorSeconds - fixedTimeStepSeconds);
        this.lastStepAtMs = nowMs;
        localSubStepCount += 1;
      }

      if (localSubStepCount >= maxSubSteps && this.accumulatorSeconds >= fixedTimeStepSeconds) {
        frameWarnings.push(
          createWarning("Physics accumulator exceeded max sub-steps and was clamped."),
        );

        this.accumulatorSeconds = Math.min(this.accumulatorSeconds, fixedTimeStepSeconds);
      }

      this.subStepCount = localSubStepCount;
      this.lastFrameAtMs = nowMs;
      this.frameRevision += 1;

      const nextPlayer = this.getPlayerState();
      const nextCamera = this.getCameraBinding(lookAngles);

      safeCallWithValue(this.callbacks.onStateChanged, nextPlayer, (error) => {
        this.raiseError(
          createRuntimeError("PHYSICS_RUNTIME_CALLBACK_FAILED", "Physics onStateChanged callback failed.", {
            cause: error,
            recoverable: true,
          }),
        );
      });

      const result = this.createFrameResult({
        ok: !lastControllerStep?.error,
        phase: lastControllerStep?.phase ?? "idle",
        stepped: localSubStepCount > 0,
        subStepCount: localSubStepCount,
        player: nextPlayer,
        camera: nextCamera,
        lastControllerStep,
        error: lastControllerStep?.error ?? null,
        warnings: frameWarnings,
      });

      this.lastFrameResult = result;
      this.emitFrame(result);
      return result;
    } catch (error) {
      const physicsError = createRuntimeError(
        "PHYSICS_RUNTIME_STEP_FAILED",
        error instanceof Error ? error.message : "Physics runtime frame step failed.",
        {
          cause: error,
          recoverable: true,
        },
      );

      this.raiseError(physicsError);

      const result = this.createFrameResult({
        ok: false,
        phase: "failed",
        stepped: false,
        subStepCount: 0,
        player: this.getPlayerState(),
        camera: this.getCameraBinding(input.lookAngles),
        error: physicsError,
        warnings: [physicsError.message],
      });

      this.lastFrameResult = result;
      return result;
    }
  }

  public flushAccumulator(): void {
    try {
      this.accumulatorSeconds = 0;
      this.frameRevision += 1;
    } catch {
      this.accumulatorSeconds = 0;
    }
  }

  public getLastFrameResult(): PhysicsRuntimeFrameResult | null {
    try {
      return this.lastFrameResult;
    } catch {
      return null;
    }
  }

  public snapshot(): PhysicsRuntimeSnapshotExtended {
    try {
      const player = this.getPlayerState();
      const camera = this.getCameraBinding();

      return {
        enabled: this.config.enabled && this.config.physics.enabled,
        phase: this.lastFrameResult?.phase ?? "idle",
        player,
        camera,
        accumulatorSeconds: this.accumulatorSeconds,
        lastStepAtMs: this.lastStepAtMs,
        lastError: this.lastError,
        warnings: [...this.warnings],
        lifecycle: this.lifecycle,
        frameRevision: this.frameRevision,
        subStepCount: this.subStepCount,
        lastFrameAtMs: this.lastFrameAtMs,
        destroyed: this.destroyed,
      };
    } catch {
      const player = createInitialPlayerPhysicsState(null, DEFAULT_PHYSICS_CONFIG);

      return {
        enabled: false,
        phase: "failed",
        player,
        camera: createPhysicsCameraBinding(player, ZERO_PHYSICS_ANGLES),
        accumulatorSeconds: 0,
        lastStepAtMs: null,
        lastError: createRuntimeError(
          "PHYSICS_RUNTIME_SNAPSHOT_FAILED",
          "Physics runtime snapshot failed.",
          {
            recoverable: true,
          },
        ),
        warnings: ["Physics runtime snapshot failed."],
        lifecycle: "created",
        frameRevision: 0,
        subStepCount: 0,
        lastFrameAtMs: null,
        destroyed: false,
      };
    }
  }

  private createFrameResult(params: {
    readonly ok: boolean;
    readonly phase: PhysicsStepPhase;
    readonly stepped: boolean;
    readonly subStepCount: number;
    readonly player: PlayerPhysicsState;
    readonly camera: PhysicsCameraBinding;
    readonly lastControllerStep?: PlayerPhysicsControllerStepResult | null;
    readonly error?: PhysicsError | null;
    readonly warnings?: readonly string[];
  }): PhysicsRuntimeFrameResult {
    try {
      const warnings = this.config.exposeWarnings ? [...(params.warnings ?? [])] : [];

      this.warnings = warnings;

      return {
        ok: params.ok,
        phase: params.phase,
        lifecycle: this.lifecycle,
        stepped: params.stepped,
        subStepCount: Math.max(0, Math.floor(params.subStepCount)),
        accumulatorSeconds: this.accumulatorSeconds,
        player: params.player,
        camera: params.camera,
        lastControllerStep: params.lastControllerStep ?? null,
        error: params.error ?? null,
        warnings,
      };
    } catch {
      return {
        ok: false,
        phase: "failed",
        lifecycle: this.lifecycle,
        stepped: false,
        subStepCount: 0,
        accumulatorSeconds: this.accumulatorSeconds,
        player: params.player,
        camera: params.camera,
        lastControllerStep: null,
        error: params.error ?? null,
        warnings: ["Failed to create physics frame result."],
      };
    }
  }

  private emitFrame(result: PhysicsRuntimeFrameResult): void {
    safeCallWithValue(this.callbacks.onFrame, result, (error) => {
      this.raiseError(
        createRuntimeError("PHYSICS_RUNTIME_CALLBACK_FAILED", "Physics onFrame callback failed.", {
          cause: error,
          recoverable: true,
        }),
      );
    });
  }

  private raiseError(error: PhysicsError): void {
    try {
      this.lastError = error;
      this.warnings = [...this.warnings, error.message];

      safeCallWithValue(this.callbacks.onError, error, () => {
        // Avoid recursive callback error reporting.
      });
    } catch {
      this.lastError = error;
    }
  }
}

export function createPhysicsRuntime(options: {
  readonly initialState?: PlayerPhysicsState | null;
  readonly spawn?: CameraLikeSpawnInput | null;
  readonly config?: PhysicsRuntimeConfigPatch | null;
  readonly callbacks?: PhysicsRuntimeCallbacks | null;
} = {}): PhysicsRuntime {
  try {
    return new PhysicsRuntime(options);
  } catch {
    return new PhysicsRuntime();
  }
}