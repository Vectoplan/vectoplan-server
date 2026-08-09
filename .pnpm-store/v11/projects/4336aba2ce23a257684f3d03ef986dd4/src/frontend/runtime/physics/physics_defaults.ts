// src/frontend/runtime/physics/physics_defaults.ts

import type {
  CollisionResolutionPolicy,
  PhysicsConfig,
  PhysicsDebugConfig,
  PhysicsDeltaSeconds,
  PhysicsInputConfig,
  PhysicsMissingChunkConfig,
  PhysicsMovementConfig,
  PhysicsTimingConfig,
  PlayerAabbCollider,
} from "./physics_models";

import {
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  sanitizePhysicsString,
} from "./physics_models";

/**
 * Default physics tuning for the VECTOPLAN editor runtime.
 *
 * This file is intentionally free of DOM, Three.js, store and chunk dependencies.
 * It defines safe defaults and normalization helpers only.
 *
 * Unit convention:
 * - 1 world unit = 1 block/cell edge length
 * - velocity = world units per second
 * - gravity = world units per second²
 */

export const PHYSICS_DEFAULT_FIXED_TIME_STEP_SECONDS: PhysicsDeltaSeconds = 1 / 60;
export const PHYSICS_DEFAULT_MAX_FRAME_DELTA_SECONDS: PhysicsDeltaSeconds = 0.25;
// Four catch-up steps cover a 15 FPS hitch without allowing collision work to
// monopolize the next render frame and amplify the hitch further.
export const PHYSICS_DEFAULT_MAX_SUB_STEPS = 4;

export const PHYSICS_DEFAULT_WALK_SPEED = 4.25;
export const PHYSICS_DEFAULT_SPRINT_SPEED = 9.5;
export const PHYSICS_DEFAULT_AIR_CONTROL_SPEED = 2.35;
export const PHYSICS_DEFAULT_FLY_SPEED = 6.5;
export const PHYSICS_DEFAULT_FLY_SPRINT_SPEED = 15;
export const PHYSICS_DEFAULT_JUMP_VELOCITY = 6.25;
export const PHYSICS_DEFAULT_GRAVITY = -18.0;
export const PHYSICS_DEFAULT_MAX_FALL_SPEED = -32.0;
export const PHYSICS_DEFAULT_GROUND_SNAP_DISTANCE = 0.08;

export const PHYSICS_DEFAULT_PLAYER_WIDTH = 0.6;
export const PHYSICS_DEFAULT_PLAYER_HEIGHT = 1.8;
export const PHYSICS_DEFAULT_PLAYER_EYE_HEIGHT = 1.62;
export const PHYSICS_DEFAULT_PLAYER_SKIN_WIDTH = 0.001;

export const PHYSICS_DEFAULT_DOUBLE_TAP_WINDOW_MS = 280;
export const PHYSICS_DEFAULT_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE = true;

export const PHYSICS_MIN_FIXED_TIME_STEP_SECONDS = 1 / 240;
export const PHYSICS_MAX_FIXED_TIME_STEP_SECONDS = 1 / 20;

export const PHYSICS_MIN_PLAYER_WIDTH = 0.1;
export const PHYSICS_MAX_PLAYER_WIDTH = 1.5;
export const PHYSICS_MIN_PLAYER_HEIGHT = 0.4;
export const PHYSICS_MAX_PLAYER_HEIGHT = 4.0;
export const PHYSICS_MIN_PLAYER_EYE_HEIGHT = 0.1;
export const PHYSICS_MAX_PLAYER_EYE_HEIGHT = 4.0;
export const PHYSICS_MIN_PLAYER_SKIN_WIDTH = 0.00001;
export const PHYSICS_MAX_PLAYER_SKIN_WIDTH = 0.05;

export const PHYSICS_MIN_SPEED = 0;
export const PHYSICS_MAX_SPEED = 80;
export const PHYSICS_MIN_JUMP_VELOCITY = 0;
export const PHYSICS_MAX_JUMP_VELOCITY = 80;
export const PHYSICS_MIN_GRAVITY = -200;
export const PHYSICS_MAX_GRAVITY = 0;
export const PHYSICS_MIN_MAX_FALL_SPEED = -300;
export const PHYSICS_MAX_MAX_FALL_SPEED = -1;
export const PHYSICS_MIN_GROUND_SNAP_DISTANCE = 0;
export const PHYSICS_MAX_GROUND_SNAP_DISTANCE = 0.5;

export const PHYSICS_MIN_DOUBLE_TAP_WINDOW_MS = 80;
export const PHYSICS_MAX_DOUBLE_TAP_WINDOW_MS = 800;

export const PHYSICS_DEFAULT_MISSING_CHUNK_POLICY: CollisionResolutionPolicy = "treat_as_air";

export interface PhysicsTimingConfigPatch {
  readonly fixedTimeStepSeconds?: unknown;
  readonly maxFrameDeltaSeconds?: unknown;
  readonly maxSubSteps?: unknown;
}

export interface PhysicsMovementConfigPatch {
  readonly walkSpeed?: unknown;
  readonly sprintSpeed?: unknown;
  readonly airControlSpeed?: unknown;
  readonly flySpeed?: unknown;
  readonly flySprintSpeed?: unknown;
  readonly jumpVelocity?: unknown;
  readonly gravity?: unknown;
  readonly maxFallSpeed?: unknown;
  readonly groundSnapDistance?: unknown;
}

export interface PhysicsInputConfigPatch {
  readonly doubleTapWindowMs?: unknown;
  readonly allowJumpBeforeFlightToggle?: unknown;
}

export interface PhysicsMissingChunkConfigPatch {
  readonly policy?: unknown;
  readonly blockHorizontalMovement?: unknown;
  readonly blockVerticalMovement?: unknown;
}

export interface PlayerAabbColliderPatch {
  readonly kind?: unknown;
  readonly width?: unknown;
  readonly height?: unknown;
  readonly eyeHeight?: unknown;
  readonly skinWidth?: unknown;
}

export interface PhysicsDebugConfigPatch {
  readonly enabled?: unknown;
  readonly exposeToStore?: unknown;
  readonly includeCollisionCells?: unknown;
}

export interface PhysicsConfigPatch {
  readonly enabled?: unknown;
  readonly timing?: PhysicsTimingConfigPatch | null;
  readonly movement?: PhysicsMovementConfigPatch | null;
  readonly input?: PhysicsInputConfigPatch | null;
  readonly missingChunks?: PhysicsMissingChunkConfigPatch | null;
  readonly collider?: PlayerAabbColliderPatch | null;
  readonly debug?: PhysicsDebugConfigPatch | null;
}

export const DEFAULT_PLAYER_AABB_COLLIDER: PlayerAabbCollider = Object.freeze({
  kind: "aabb",
  width: PHYSICS_DEFAULT_PLAYER_WIDTH,
  height: PHYSICS_DEFAULT_PLAYER_HEIGHT,
  eyeHeight: PHYSICS_DEFAULT_PLAYER_EYE_HEIGHT,
  skinWidth: PHYSICS_DEFAULT_PLAYER_SKIN_WIDTH,
});

export const DEFAULT_PHYSICS_TIMING_CONFIG: PhysicsTimingConfig = Object.freeze({
  fixedTimeStepSeconds: PHYSICS_DEFAULT_FIXED_TIME_STEP_SECONDS,
  maxFrameDeltaSeconds: PHYSICS_DEFAULT_MAX_FRAME_DELTA_SECONDS,
  maxSubSteps: PHYSICS_DEFAULT_MAX_SUB_STEPS,
});

export const DEFAULT_PHYSICS_MOVEMENT_CONFIG: PhysicsMovementConfig = Object.freeze({
  walkSpeed: PHYSICS_DEFAULT_WALK_SPEED,
  sprintSpeed: PHYSICS_DEFAULT_SPRINT_SPEED,
  airControlSpeed: PHYSICS_DEFAULT_AIR_CONTROL_SPEED,
  flySpeed: PHYSICS_DEFAULT_FLY_SPEED,
  flySprintSpeed: PHYSICS_DEFAULT_FLY_SPRINT_SPEED,
  jumpVelocity: PHYSICS_DEFAULT_JUMP_VELOCITY,
  gravity: PHYSICS_DEFAULT_GRAVITY,
  maxFallSpeed: PHYSICS_DEFAULT_MAX_FALL_SPEED,
  groundSnapDistance: PHYSICS_DEFAULT_GROUND_SNAP_DISTANCE,
});

export const DEFAULT_PHYSICS_INPUT_CONFIG: PhysicsInputConfig = Object.freeze({
  doubleTapWindowMs: PHYSICS_DEFAULT_DOUBLE_TAP_WINDOW_MS,
  allowJumpBeforeFlightToggle: PHYSICS_DEFAULT_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE,
});

export const DEFAULT_PHYSICS_MISSING_CHUNK_CONFIG: PhysicsMissingChunkConfig = Object.freeze({
  policy: PHYSICS_DEFAULT_MISSING_CHUNK_POLICY,
  blockHorizontalMovement: false,
  blockVerticalMovement: false,
});

export const DEFAULT_PHYSICS_DEBUG_CONFIG: PhysicsDebugConfig = Object.freeze({
  enabled: false,
  exposeToStore: true,
  includeCollisionCells: false,
});

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = Object.freeze({
  enabled: true,
  timing: DEFAULT_PHYSICS_TIMING_CONFIG,
  movement: DEFAULT_PHYSICS_MOVEMENT_CONFIG,
  input: DEFAULT_PHYSICS_INPUT_CONFIG,
  missingChunks: DEFAULT_PHYSICS_MISSING_CHUNK_CONFIG,
  collider: DEFAULT_PLAYER_AABB_COLLIDER,
  debug: DEFAULT_PHYSICS_DEBUG_CONFIG,
});

export function normalizeCollisionResolutionPolicy(
  value: unknown,
  fallback: CollisionResolutionPolicy = PHYSICS_DEFAULT_MISSING_CHUNK_POLICY,
): CollisionResolutionPolicy {
  try {
    const normalized = sanitizePhysicsString(value, fallback).trim().toLowerCase();

    if (
      normalized === "block" ||
      normalized === "allow" ||
      normalized === "request_chunk" ||
      normalized === "treat_as_air" ||
      normalized === "treat_as_solid"
    ) {
      return normalized;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function createDefaultPlayerAabbCollider(
  patch: PlayerAabbColliderPatch | null | undefined = undefined,
): PlayerAabbCollider {
  try {
    const width = sanitizePhysicsNumber(patch?.width, PHYSICS_DEFAULT_PLAYER_WIDTH, {
      min: PHYSICS_MIN_PLAYER_WIDTH,
      max: PHYSICS_MAX_PLAYER_WIDTH,
    });

    const height = sanitizePhysicsNumber(patch?.height, PHYSICS_DEFAULT_PLAYER_HEIGHT, {
      min: PHYSICS_MIN_PLAYER_HEIGHT,
      max: PHYSICS_MAX_PLAYER_HEIGHT,
    });

    const rawEyeHeight = sanitizePhysicsNumber(
      patch?.eyeHeight,
      PHYSICS_DEFAULT_PLAYER_EYE_HEIGHT,
      {
        min: PHYSICS_MIN_PLAYER_EYE_HEIGHT,
        max: PHYSICS_MAX_PLAYER_EYE_HEIGHT,
      },
    );

    const eyeHeight = Math.min(rawEyeHeight, Math.max(PHYSICS_MIN_PLAYER_EYE_HEIGHT, height - 0.05));

    const skinWidth = sanitizePhysicsNumber(
      patch?.skinWidth,
      PHYSICS_DEFAULT_PLAYER_SKIN_WIDTH,
      {
        min: PHYSICS_MIN_PLAYER_SKIN_WIDTH,
        max: PHYSICS_MAX_PLAYER_SKIN_WIDTH,
      },
    );

    return {
      kind: "aabb",
      width,
      height,
      eyeHeight,
      skinWidth,
    };
  } catch {
    return { ...DEFAULT_PLAYER_AABB_COLLIDER };
  }
}

export function createDefaultPhysicsTimingConfig(
  patch: PhysicsTimingConfigPatch | null | undefined = undefined,
): PhysicsTimingConfig {
  try {
    const fixedTimeStepSeconds = sanitizePhysicsNumber(
      patch?.fixedTimeStepSeconds,
      PHYSICS_DEFAULT_FIXED_TIME_STEP_SECONDS,
      {
        min: PHYSICS_MIN_FIXED_TIME_STEP_SECONDS,
        max: PHYSICS_MAX_FIXED_TIME_STEP_SECONDS,
      },
    );

    const maxFrameDeltaSeconds = sanitizePhysicsNumber(
      patch?.maxFrameDeltaSeconds,
      Math.max(PHYSICS_DEFAULT_MAX_FRAME_DELTA_SECONDS, fixedTimeStepSeconds),
      {
        min: fixedTimeStepSeconds,
        max: 2,
      },
    );

    const maxSubSteps = Math.max(
      1,
      Math.floor(
        sanitizePhysicsNumber(patch?.maxSubSteps, PHYSICS_DEFAULT_MAX_SUB_STEPS, {
          min: 1,
          max: 60,
        }),
      ),
    );

    return {
      fixedTimeStepSeconds,
      maxFrameDeltaSeconds,
      maxSubSteps,
    };
  } catch {
    return { ...DEFAULT_PHYSICS_TIMING_CONFIG };
  }
}

export function createDefaultPhysicsMovementConfig(
  patch: PhysicsMovementConfigPatch | null | undefined = undefined,
): PhysicsMovementConfig {
  try {
    const walkSpeed = sanitizePhysicsNumber(patch?.walkSpeed, PHYSICS_DEFAULT_WALK_SPEED, {
      min: PHYSICS_MIN_SPEED,
      max: PHYSICS_MAX_SPEED,
    });

    const sprintSpeed = sanitizePhysicsNumber(patch?.sprintSpeed, PHYSICS_DEFAULT_SPRINT_SPEED, {
      min: walkSpeed,
      max: PHYSICS_MAX_SPEED,
    });

    const airControlSpeed = sanitizePhysicsNumber(
      patch?.airControlSpeed,
      PHYSICS_DEFAULT_AIR_CONTROL_SPEED,
      {
        min: PHYSICS_MIN_SPEED,
        max: PHYSICS_MAX_SPEED,
      },
    );

    const flySpeed = sanitizePhysicsNumber(patch?.flySpeed, PHYSICS_DEFAULT_FLY_SPEED, {
      min: PHYSICS_MIN_SPEED,
      max: PHYSICS_MAX_SPEED,
    });

    const flySprintSpeed = sanitizePhysicsNumber(
      patch?.flySprintSpeed,
      PHYSICS_DEFAULT_FLY_SPRINT_SPEED,
      {
        min: flySpeed,
        max: PHYSICS_MAX_SPEED,
      },
    );

    const jumpVelocity = sanitizePhysicsNumber(
      patch?.jumpVelocity,
      PHYSICS_DEFAULT_JUMP_VELOCITY,
      {
        min: PHYSICS_MIN_JUMP_VELOCITY,
        max: PHYSICS_MAX_JUMP_VELOCITY,
      },
    );

    const gravity = sanitizePhysicsNumber(patch?.gravity, PHYSICS_DEFAULT_GRAVITY, {
      min: PHYSICS_MIN_GRAVITY,
      max: PHYSICS_MAX_GRAVITY,
    });

    const maxFallSpeed = sanitizePhysicsNumber(
      patch?.maxFallSpeed,
      PHYSICS_DEFAULT_MAX_FALL_SPEED,
      {
        min: PHYSICS_MIN_MAX_FALL_SPEED,
        max: PHYSICS_MAX_MAX_FALL_SPEED,
      },
    );

    const groundSnapDistance = sanitizePhysicsNumber(
      patch?.groundSnapDistance,
      PHYSICS_DEFAULT_GROUND_SNAP_DISTANCE,
      {
        min: PHYSICS_MIN_GROUND_SNAP_DISTANCE,
        max: PHYSICS_MAX_GROUND_SNAP_DISTANCE,
      },
    );

    return {
      walkSpeed,
      sprintSpeed,
      airControlSpeed,
      flySpeed,
      flySprintSpeed,
      jumpVelocity,
      gravity,
      maxFallSpeed,
      groundSnapDistance,
    };
  } catch {
    return { ...DEFAULT_PHYSICS_MOVEMENT_CONFIG };
  }
}

export function createDefaultPhysicsInputConfig(
  patch: PhysicsInputConfigPatch | null | undefined = undefined,
): PhysicsInputConfig {
  try {
    return {
      doubleTapWindowMs: sanitizePhysicsNumber(
        patch?.doubleTapWindowMs,
        PHYSICS_DEFAULT_DOUBLE_TAP_WINDOW_MS,
        {
          min: PHYSICS_MIN_DOUBLE_TAP_WINDOW_MS,
          max: PHYSICS_MAX_DOUBLE_TAP_WINDOW_MS,
        },
      ),
      allowJumpBeforeFlightToggle: sanitizePhysicsBoolean(
        patch?.allowJumpBeforeFlightToggle,
        PHYSICS_DEFAULT_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE,
      ),
    };
  } catch {
    return { ...DEFAULT_PHYSICS_INPUT_CONFIG };
  }
}

export function createDefaultPhysicsMissingChunkConfig(
  patch: PhysicsMissingChunkConfigPatch | null | undefined = undefined,
): PhysicsMissingChunkConfig {
  try {
    const policy = normalizeCollisionResolutionPolicy(
      patch?.policy,
      PHYSICS_DEFAULT_MISSING_CHUNK_POLICY,
    );

    /**
     * Safety rule:
     * If missing chunks are treated as solid or blocked, both movement axes
     * should block by default. This avoids falling through unloaded terrain.
     */
    const defaultBlocksMovement =
      policy === "block" || policy === "request_chunk" || policy === "treat_as_solid";

    return {
      policy,
      blockHorizontalMovement: sanitizePhysicsBoolean(
        patch?.blockHorizontalMovement,
        defaultBlocksMovement,
      ),
      blockVerticalMovement: sanitizePhysicsBoolean(
        patch?.blockVerticalMovement,
        defaultBlocksMovement,
      ),
    };
  } catch {
    return { ...DEFAULT_PHYSICS_MISSING_CHUNK_CONFIG };
  }
}

export function createDefaultPhysicsDebugConfig(
  patch: PhysicsDebugConfigPatch | null | undefined = undefined,
): PhysicsDebugConfig {
  try {
    return {
      enabled: sanitizePhysicsBoolean(patch?.enabled, DEFAULT_PHYSICS_DEBUG_CONFIG.enabled),
      exposeToStore: sanitizePhysicsBoolean(
        patch?.exposeToStore,
        DEFAULT_PHYSICS_DEBUG_CONFIG.exposeToStore,
      ),
      includeCollisionCells: sanitizePhysicsBoolean(
        patch?.includeCollisionCells,
        DEFAULT_PHYSICS_DEBUG_CONFIG.includeCollisionCells,
      ),
    };
  } catch {
    return { ...DEFAULT_PHYSICS_DEBUG_CONFIG };
  }
}

export function createDefaultPhysicsConfig(
  patch: PhysicsConfigPatch | null | undefined = undefined,
): PhysicsConfig {
  try {
    return {
      enabled: sanitizePhysicsBoolean(patch?.enabled, DEFAULT_PHYSICS_CONFIG.enabled),
      timing: createDefaultPhysicsTimingConfig(patch?.timing),
      movement: createDefaultPhysicsMovementConfig(patch?.movement),
      input: createDefaultPhysicsInputConfig(patch?.input),
      missingChunks: createDefaultPhysicsMissingChunkConfig(patch?.missingChunks),
      collider: createDefaultPlayerAabbCollider(patch?.collider),
      debug: createDefaultPhysicsDebugConfig(patch?.debug),
    };
  } catch {
    return {
      enabled: DEFAULT_PHYSICS_CONFIG.enabled,
      timing: { ...DEFAULT_PHYSICS_TIMING_CONFIG },
      movement: { ...DEFAULT_PHYSICS_MOVEMENT_CONFIG },
      input: { ...DEFAULT_PHYSICS_INPUT_CONFIG },
      missingChunks: { ...DEFAULT_PHYSICS_MISSING_CHUNK_CONFIG },
      collider: { ...DEFAULT_PLAYER_AABB_COLLIDER },
      debug: { ...DEFAULT_PHYSICS_DEBUG_CONFIG },
    };
  }
}

export function mergePhysicsConfig(
  base: PhysicsConfig | null | undefined,
  patch: PhysicsConfigPatch | null | undefined,
): PhysicsConfig {
  try {
    const safeBase = base ?? DEFAULT_PHYSICS_CONFIG;

    return createDefaultPhysicsConfig({
      enabled: patch?.enabled ?? safeBase.enabled,
      timing: {
        ...safeBase.timing,
        ...(patch?.timing ?? {}),
      },
      movement: {
        ...safeBase.movement,
        ...(patch?.movement ?? {}),
      },
      input: {
        ...safeBase.input,
        ...(patch?.input ?? {}),
      },
      missingChunks: {
        ...safeBase.missingChunks,
        ...(patch?.missingChunks ?? {}),
      },
      collider: {
        ...safeBase.collider,
        ...(patch?.collider ?? {}),
      },
      debug: {
        ...safeBase.debug,
        ...(patch?.debug ?? {}),
      },
    });
  } catch {
    return createDefaultPhysicsConfig(patch);
  }
}

export function physicsConfigToSerializable(config: PhysicsConfig): PhysicsConfig {
  try {
    return createDefaultPhysicsConfig(config);
  } catch {
    return createDefaultPhysicsConfig();
  }
}
