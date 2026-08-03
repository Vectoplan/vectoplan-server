// src/frontend/runtime/physics/player_physics_state.ts

import type {
  CollisionFlags,
  PhysicsCameraBinding,
  PhysicsConfig,
  PhysicsEulerAngles,
  PhysicsSpawnConfig,
  PhysicsStatePatch,
  PhysicsTimestampMs,
  PhysicsVector3,
  PlayerCollider,
  PlayerMovementMode,
  PlayerPhysicsState,
} from "./physics_models";

import {
  createCollisionFlags,
  createEyePosition,
  createPhysicsCameraBinding,
  createPhysicsVector3,
  createPlayerPhysicsState,
  EMPTY_COLLISION_FLAGS,
  movementModeToFlying,
  normalizeMovementMode,
  patchPlayerPhysicsState,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  ZERO_PHYSICS_ANGLES,
  ZERO_PHYSICS_VECTOR,
} from "./physics_models";

import { DEFAULT_PHYSICS_CONFIG, createDefaultPhysicsConfig } from "./physics_defaults";

/**
 * Player physics state helpers.
 *
 * This file owns creation, normalization, reset and safe patching of the
 * serializable player physics state. It intentionally does not perform the
 * actual physics simulation. Movement, gravity and collision resolution belong
 * to player_physics_controller.ts and voxel_collision_solver.ts.
 *
 * Design rule:
 * - Input creates intent.
 * - Physics controller creates new state.
 * - This file creates and normalizes state objects.
 * - Camera/render/store integration happens outside this file.
 */

export interface PlayerPhysicsStateInitInput {
  readonly position?: Partial<PhysicsVector3> | null;
  readonly velocity?: Partial<PhysicsVector3> | null;
  readonly angles?: Partial<PhysicsEulerAngles> | null;
  readonly movementMode?: PlayerMovementMode | string | null;
  readonly grounded?: unknown;
  readonly flying?: unknown;
  readonly collider?: PlayerCollider | null;
  readonly nowMs?: PhysicsTimestampMs | null;
  readonly revision?: unknown;
  readonly collisionFlags?: Partial<CollisionFlags> | null;
}

export interface CameraLikeSpawnInput {
  readonly x?: unknown;
  readonly y?: unknown;
  readonly z?: unknown;
  readonly yaw?: unknown;
  readonly pitch?: unknown;
  readonly roll?: unknown;
}

export interface PhysicsSpawnInput {
  readonly position?: Partial<PhysicsVector3> | null;
  readonly angles?: Partial<PhysicsEulerAngles> | null;
  readonly movementMode?: PlayerMovementMode | string | null;
}

export interface PlayerPhysicsResetOptions {
  readonly preserveLookAngles?: boolean;
  readonly preserveFlightMode?: boolean;
  readonly preserveRevision?: boolean;
  readonly nowMs?: PhysicsTimestampMs | null;
}

export interface PlayerPhysicsDerivedSnapshot {
  readonly position: PhysicsVector3;
  readonly velocity: PhysicsVector3;
  readonly eyePosition: PhysicsVector3;
  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly collisionFlags: CollisionFlags;
  readonly revision: number;
}

export interface PlayerPhysicsStorePatch {
  readonly position: PhysicsVector3;
  readonly velocity: PhysicsVector3;
  readonly eyePosition: PhysicsVector3;
  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly collisionFlags: CollisionFlags;
  readonly lastGroundedAtMs: PhysicsTimestampMs | null;
  readonly lastJumpAtMs: PhysicsTimestampMs | null;
  readonly lastFlightToggleAtMs: PhysicsTimestampMs | null;
  readonly revision: number;
}

export const DEFAULT_PLAYER_SPAWN_POSITION: PhysicsVector3 = Object.freeze({
  x: 0,
  y: 8,
  z: 0,
});

export const DEFAULT_PLAYER_SPAWN_ANGLES: PhysicsEulerAngles = Object.freeze({
  yaw: 0,
  pitch: 0,
  roll: 0,
});

export const DEFAULT_PLAYER_MOVEMENT_MODE: PlayerMovementMode = "airborne";

export function createSafePhysicsTimestamp(value: unknown, fallback: PhysicsTimestampMs | null = null): PhysicsTimestampMs | null {
  try {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(0, value);
  } catch {
    return fallback;
  }
}

export function createSafeRevision(value: unknown, fallback = 0): number {
  try {
    const safe = sanitizePhysicsNumber(value, fallback, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });

    return Math.floor(safe);
  } catch {
    return fallback;
  }
}

export function normalizePhysicsPosition(
  value: Partial<PhysicsVector3> | null | undefined,
  fallback: PhysicsVector3 = DEFAULT_PLAYER_SPAWN_POSITION,
): PhysicsVector3 {
  try {
    return createPhysicsVector3(
      value?.x,
      value?.y,
      value?.z,
      fallback,
    );
  } catch {
    return { ...fallback };
  }
}

export function normalizePhysicsVelocity(
  value: Partial<PhysicsVector3> | null | undefined,
  fallback: PhysicsVector3 = ZERO_PHYSICS_VECTOR,
): PhysicsVector3 {
  try {
    return createPhysicsVector3(
      value?.x,
      value?.y,
      value?.z,
      fallback,
    );
  } catch {
    return { ...fallback };
  }
}

export function normalizePhysicsAngles(
  value: Partial<PhysicsEulerAngles> | null | undefined,
  fallback: PhysicsEulerAngles = DEFAULT_PLAYER_SPAWN_ANGLES,
): PhysicsEulerAngles {
  try {
    return {
      yaw: sanitizePhysicsNumber(value?.yaw, fallback.yaw),
      pitch: sanitizePhysicsNumber(value?.pitch, fallback.pitch),
      roll: sanitizePhysicsNumber(value?.roll, fallback.roll ?? 0),
    };
  } catch {
    return { ...fallback };
  }
}

export function normalizePhysicsSpawnConfig(
  input: PhysicsSpawnInput | null | undefined,
  fallback: PhysicsSpawnConfig = {
    position: DEFAULT_PLAYER_SPAWN_POSITION,
    angles: DEFAULT_PLAYER_SPAWN_ANGLES,
    movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
  },
): PhysicsSpawnConfig {
  try {
    return {
      position: normalizePhysicsPosition(input?.position, fallback.position),
      angles: normalizePhysicsAngles(input?.angles, fallback.angles),
      movementMode: normalizeMovementMode(input?.movementMode, fallback.movementMode ?? DEFAULT_PLAYER_MOVEMENT_MODE),
    };
  } catch {
    return {
      position: { ...fallback.position },
      angles: { ...fallback.angles },
      movementMode: fallback.movementMode ?? DEFAULT_PLAYER_MOVEMENT_MODE,
    };
  }
}

export function createSpawnConfigFromCameraLikeInput(
  input: CameraLikeSpawnInput | null | undefined,
  fallback: PhysicsSpawnConfig = {
    position: DEFAULT_PLAYER_SPAWN_POSITION,
    angles: DEFAULT_PLAYER_SPAWN_ANGLES,
    movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
  },
): PhysicsSpawnConfig {
  try {
    return {
      position: createPhysicsVector3(
        input?.x,
        input?.y,
        input?.z,
        fallback.position,
      ),
      angles: {
        yaw: sanitizePhysicsNumber(input?.yaw, fallback.angles.yaw),
        pitch: sanitizePhysicsNumber(input?.pitch, fallback.angles.pitch),
        roll: sanitizePhysicsNumber(input?.roll, fallback.angles.roll ?? 0),
      },
      movementMode: fallback.movementMode ?? DEFAULT_PLAYER_MOVEMENT_MODE,
    };
  } catch {
    return {
      position: { ...fallback.position },
      angles: { ...fallback.angles },
      movementMode: fallback.movementMode ?? DEFAULT_PLAYER_MOVEMENT_MODE,
    };
  }
}

export function resolveInitialMovementMode(params: {
  readonly movementMode?: PlayerMovementMode | string | null;
  readonly grounded?: unknown;
  readonly flying?: unknown;
}): PlayerMovementMode {
  try {
    const explicitMode = params.movementMode;

    if (explicitMode === "grounded" || explicitMode === "airborne" || explicitMode === "flying") {
      return explicitMode;
    }

    if (sanitizePhysicsBoolean(params.flying, false)) {
      return "flying";
    }

    if (sanitizePhysicsBoolean(params.grounded, false)) {
      return "grounded";
    }

    return DEFAULT_PLAYER_MOVEMENT_MODE;
  } catch {
    return DEFAULT_PLAYER_MOVEMENT_MODE;
  }
}

export function normalizePlayerCollisionFlags(
  flags: Partial<CollisionFlags> | null | undefined,
  movementMode: PlayerMovementMode,
): CollisionFlags {
  try {
    const grounded = movementMode === "grounded";

    return createCollisionFlags({
      ...(flags ?? EMPTY_COLLISION_FLAGS),
      grounded,
      hitHorizontalWall: Boolean(flags?.hitHorizontalWall ?? flags?.hitWallX ?? flags?.hitWallZ ?? false),
    });
  } catch {
    return createCollisionFlags({
      grounded: movementMode === "grounded",
    });
  }
}

export function createInitialPlayerPhysicsState(
  input: PlayerPhysicsStateInitInput | null | undefined,
  config: PhysicsConfig | null | undefined = DEFAULT_PHYSICS_CONFIG,
): PlayerPhysicsState {
  try {
    const safeConfig = config ?? createDefaultPhysicsConfig();
    const movementMode = resolveInitialMovementMode({
      movementMode: input?.movementMode,
      grounded: input?.grounded,
      flying: input?.flying,
    });

    const nowMs = createSafePhysicsTimestamp(input?.nowMs, null);

    return createPlayerPhysicsState({
      position: normalizePhysicsPosition(input?.position),
      velocity: normalizePhysicsVelocity(input?.velocity),
      movementMode,
      collider: input?.collider ?? safeConfig.collider,
      nowMs,
      collisionFlags: normalizePlayerCollisionFlags(input?.collisionFlags, movementMode),
      revision: createSafeRevision(input?.revision, 0),
    });
  } catch {
    return createPlayerPhysicsState({
      position: DEFAULT_PLAYER_SPAWN_POSITION,
      velocity: ZERO_PHYSICS_VECTOR,
      movementMode: DEFAULT_PLAYER_MOVEMENT_MODE,
      collider: createDefaultPhysicsConfig().collider,
      nowMs: null,
      collisionFlags: EMPTY_COLLISION_FLAGS,
      revision: 0,
    });
  }
}

export function createPlayerPhysicsStateFromSpawn(
  spawn: PhysicsSpawnConfig | null | undefined,
  config: PhysicsConfig | null | undefined = DEFAULT_PHYSICS_CONFIG,
  nowMs: PhysicsTimestampMs | null = null,
): PlayerPhysicsState {
  try {
    const safeConfig = config ?? createDefaultPhysicsConfig();
    const safeSpawn = normalizePhysicsSpawnConfig(spawn);

    return createInitialPlayerPhysicsState(
      {
        position: safeSpawn.position,
        velocity: ZERO_PHYSICS_VECTOR,
        movementMode: safeSpawn.movementMode,
        collider: safeConfig.collider,
        nowMs,
        collisionFlags: {
          grounded: safeSpawn.movementMode === "grounded",
        },
      },
      safeConfig,
    );
  } catch {
    return createInitialPlayerPhysicsState(null, config);
  }
}

export function createPlayerPhysicsStateFromCameraLikeSpawn(
  input: CameraLikeSpawnInput | null | undefined,
  config: PhysicsConfig | null | undefined = DEFAULT_PHYSICS_CONFIG,
  nowMs: PhysicsTimestampMs | null = null,
): {
  readonly player: PlayerPhysicsState;
  readonly spawn: PhysicsSpawnConfig;
} {
  try {
    const spawn = createSpawnConfigFromCameraLikeInput(input);
    const player = createPlayerPhysicsStateFromSpawn(spawn, config, nowMs);

    return {
      player,
      spawn,
    };
  } catch {
    const fallbackSpawn = normalizePhysicsSpawnConfig(null);
    return {
      player: createPlayerPhysicsStateFromSpawn(fallbackSpawn, config, nowMs),
      spawn: fallbackSpawn,
    };
  }
}

export function normalizePlayerPhysicsState(
  state: PlayerPhysicsState | null | undefined,
  config: PhysicsConfig | null | undefined = DEFAULT_PHYSICS_CONFIG,
): PlayerPhysicsState {
  try {
    if (!state) {
      return createInitialPlayerPhysicsState(null, config);
    }

    const movementMode = normalizeMovementMode(
      state.movementMode,
      state.flying ? "flying" : state.grounded ? "grounded" : "airborne",
    );

    return createPlayerPhysicsState({
      position: normalizePhysicsPosition(state.position),
      velocity: normalizePhysicsVelocity(state.velocity),
      movementMode,
      collider: state.collider ?? (config ?? createDefaultPhysicsConfig()).collider,
      nowMs: null,
      collisionFlags: normalizePlayerCollisionFlags(state.collisionFlags, movementMode),
      revision: createSafeRevision(state.revision, 0),
    });
  } catch {
    return createInitialPlayerPhysicsState(null, config);
  }
}

export function resetPlayerPhysicsState(
  currentState: PlayerPhysicsState | null | undefined,
  spawn: PhysicsSpawnConfig | null | undefined,
  config: PhysicsConfig | null | undefined = DEFAULT_PHYSICS_CONFIG,
  options: PlayerPhysicsResetOptions = {},
): PlayerPhysicsState {
  try {
    const safeSpawn = normalizePhysicsSpawnConfig(spawn);
    const safeConfig = config ?? createDefaultPhysicsConfig();
    const previous = normalizePlayerPhysicsState(currentState, safeConfig);

    const movementMode = options.preserveFlightMode && previous.flying
      ? "flying"
      : safeSpawn.movementMode ?? DEFAULT_PLAYER_MOVEMENT_MODE;

    const base = createPlayerPhysicsStateFromSpawn(
      {
        ...safeSpawn,
        movementMode,
      },
      safeConfig,
      createSafePhysicsTimestamp(options.nowMs, null),
    );

    if (!options.preserveRevision) {
      return base;
    }

    return {
      ...base,
      revision: previous.revision + 1,
    };
  } catch {
    return createPlayerPhysicsStateFromSpawn(spawn, config, createSafePhysicsTimestamp(options.nowMs, null));
  }
}

export function patchAndNormalizePlayerPhysicsState(
  state: PlayerPhysicsState,
  patch: PhysicsStatePatch,
): PlayerPhysicsState {
  try {
    const next = patchPlayerPhysicsState(state, patch);

    const movementMode = next.flying
      ? "flying"
      : next.grounded
        ? "grounded"
        : normalizeMovementMode(next.movementMode, "airborne");

    return {
      ...next,
      movementMode,
      flying: movementModeToFlying(movementMode),
      grounded: movementMode === "grounded",
      collisionFlags: normalizePlayerCollisionFlags(next.collisionFlags, movementMode),
    };
  } catch {
    return {
      ...state,
      revision: state.revision + 1,
    };
  }
}

export function setPlayerMovementMode(
  state: PlayerPhysicsState,
  movementMode: PlayerMovementMode,
  nowMs: PhysicsTimestampMs | null = null,
): PlayerPhysicsState {
  try {
    const safeMode = normalizeMovementMode(movementMode, state.movementMode);
    const safeNow = createSafePhysicsTimestamp(nowMs, null);

    return patchAndNormalizePlayerPhysicsState(state, {
      movementMode: safeMode,
      grounded: safeMode === "grounded",
      flying: safeMode === "flying",
      lastGroundedAtMs: safeMode === "grounded" ? safeNow : state.lastGroundedAtMs,
      lastFlightToggleAtMs: safeMode === "flying" ? safeNow : state.lastFlightToggleAtMs,
      collisionFlags: {
        ...state.collisionFlags,
        grounded: safeMode === "grounded",
      },
    });
  } catch {
    return state;
  }
}

export function setPlayerFlying(
  state: PlayerPhysicsState,
  flying: boolean,
  nowMs: PhysicsTimestampMs | null = null,
): PlayerPhysicsState {
  try {
    if (flying) {
      return patchAndNormalizePlayerPhysicsState(state, {
        movementMode: "flying",
        grounded: false,
        flying: true,
        velocity: {
          y: 0,
        },
        lastFlightToggleAtMs: createSafePhysicsTimestamp(nowMs, state.lastFlightToggleAtMs),
        collisionFlags: {
          grounded: false,
          hitCeiling: false,
        },
      });
    }

    return patchAndNormalizePlayerPhysicsState(state, {
      movementMode: "airborne",
      grounded: false,
      flying: false,
      velocity: {
        y: Math.min(0, sanitizePhysicsNumber(state.velocity.y, 0)),
      },
      lastFlightToggleAtMs: createSafePhysicsTimestamp(nowMs, state.lastFlightToggleAtMs),
      collisionFlags: {
        grounded: false,
      },
    });
  } catch {
    return state;
  }
}

export function markPlayerGrounded(
  state: PlayerPhysicsState,
  nowMs: PhysicsTimestampMs | null = null,
): PlayerPhysicsState {
  try {
    return patchAndNormalizePlayerPhysicsState(state, {
      movementMode: "grounded",
      grounded: true,
      flying: false,
      velocity: {
        y: 0,
      },
      lastGroundedAtMs: createSafePhysicsTimestamp(nowMs, state.lastGroundedAtMs),
      collisionFlags: {
        ...state.collisionFlags,
        grounded: true,
        hitCeiling: false,
      },
    });
  } catch {
    return state;
  }
}

export function markPlayerAirborne(
  state: PlayerPhysicsState,
  options: {
    readonly preserveVerticalVelocity?: boolean;
  } = {},
): PlayerPhysicsState {
  try {
    if (state.flying) {
      return state;
    }

    return patchAndNormalizePlayerPhysicsState(state, {
      movementMode: "airborne",
      grounded: false,
      flying: false,
      velocity: {
        y: options.preserveVerticalVelocity
          ? state.velocity.y
          : Math.min(0, sanitizePhysicsNumber(state.velocity.y, 0)),
      },
      collisionFlags: {
        ...state.collisionFlags,
        grounded: false,
      },
    });
  } catch {
    return state;
  }
}

export function createPlayerPhysicsCameraBinding(
  state: PlayerPhysicsState,
  angles: PhysicsEulerAngles = ZERO_PHYSICS_ANGLES,
): PhysicsCameraBinding {
  try {
    return createPhysicsCameraBinding(state, normalizePhysicsAngles(angles, ZERO_PHYSICS_ANGLES));
  } catch {
    const position = normalizePhysicsPosition(state?.position, ZERO_PHYSICS_VECTOR);

    return {
      bodyPosition: position,
      eyePosition: createEyePosition(position, state.collider),
      angles: { ...ZERO_PHYSICS_ANGLES },
    };
  }
}

export function createPlayerPhysicsDerivedSnapshot(
  state: PlayerPhysicsState,
): PlayerPhysicsDerivedSnapshot {
  try {
    return {
      position: normalizePhysicsPosition(state.position, ZERO_PHYSICS_VECTOR),
      velocity: normalizePhysicsVelocity(state.velocity, ZERO_PHYSICS_VECTOR),
      eyePosition: createEyePosition(state.position, state.collider),
      movementMode: normalizeMovementMode(state.movementMode, DEFAULT_PLAYER_MOVEMENT_MODE),
      grounded: sanitizePhysicsBoolean(state.grounded, false),
      flying: sanitizePhysicsBoolean(state.flying, false),
      collisionFlags: createCollisionFlags(state.collisionFlags),
      revision: createSafeRevision(state.revision, 0),
    };
  } catch {
    const fallback = createInitialPlayerPhysicsState(null, DEFAULT_PHYSICS_CONFIG);

    return {
      position: fallback.position,
      velocity: fallback.velocity,
      eyePosition: createEyePosition(fallback.position, fallback.collider),
      movementMode: fallback.movementMode,
      grounded: fallback.grounded,
      flying: fallback.flying,
      collisionFlags: fallback.collisionFlags,
      revision: fallback.revision,
    };
  }
}

export function createPlayerPhysicsStorePatch(
  state: PlayerPhysicsState,
): PlayerPhysicsStorePatch {
  try {
    const snapshot = createPlayerPhysicsDerivedSnapshot(state);

    return {
      position: snapshot.position,
      velocity: snapshot.velocity,
      eyePosition: snapshot.eyePosition,
      movementMode: snapshot.movementMode,
      grounded: snapshot.grounded,
      flying: snapshot.flying,
      collisionFlags: snapshot.collisionFlags,
      lastGroundedAtMs: createSafePhysicsTimestamp(state.lastGroundedAtMs, null),
      lastJumpAtMs: createSafePhysicsTimestamp(state.lastJumpAtMs, null),
      lastFlightToggleAtMs: createSafePhysicsTimestamp(state.lastFlightToggleAtMs, null),
      revision: snapshot.revision,
    };
  } catch {
    const fallback = createInitialPlayerPhysicsState(null, DEFAULT_PHYSICS_CONFIG);

    return {
      position: fallback.position,
      velocity: fallback.velocity,
      eyePosition: createEyePosition(fallback.position, fallback.collider),
      movementMode: fallback.movementMode,
      grounded: fallback.grounded,
      flying: fallback.flying,
      collisionFlags: fallback.collisionFlags,
      lastGroundedAtMs: fallback.lastGroundedAtMs,
      lastJumpAtMs: fallback.lastJumpAtMs,
      lastFlightToggleAtMs: fallback.lastFlightToggleAtMs,
      revision: fallback.revision,
    };
  }
}

export function isPlayerPhysicsStateUsable(value: unknown): value is PlayerPhysicsState {
  try {
    const candidate = value as PlayerPhysicsState | null | undefined;

    return Boolean(
      candidate &&
        candidate.position &&
        candidate.velocity &&
        candidate.collider &&
        typeof candidate.movementMode === "string" &&
        typeof candidate.grounded === "boolean" &&
        typeof candidate.flying === "boolean" &&
        typeof candidate.revision === "number",
    );
  } catch {
    return false;
  }
}

export function hasPlayerMoved(
  previous: PlayerPhysicsState | null | undefined,
  next: PlayerPhysicsState | null | undefined,
  epsilon = 0.0001,
): boolean {
  try {
    if (!previous || !next) {
      return true;
    }

    const safeEpsilon = Math.max(0, sanitizePhysicsNumber(epsilon, 0.0001));

    return (
      Math.abs(previous.position.x - next.position.x) > safeEpsilon ||
      Math.abs(previous.position.y - next.position.y) > safeEpsilon ||
      Math.abs(previous.position.z - next.position.z) > safeEpsilon
    );
  } catch {
    return true;
  }
}

export function hasPlayerModeChanged(
  previous: PlayerPhysicsState | null | undefined,
  next: PlayerPhysicsState | null | undefined,
): boolean {
  try {
    if (!previous || !next) {
      return true;
    }

    return (
      previous.movementMode !== next.movementMode ||
      previous.grounded !== next.grounded ||
      previous.flying !== next.flying
    );
  } catch {
    return true;
  }
}