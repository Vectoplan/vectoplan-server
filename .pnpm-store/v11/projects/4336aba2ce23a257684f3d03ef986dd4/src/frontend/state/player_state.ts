// src/frontend/state/player_state.ts

import type {
  CollisionFlags,
  PhysicsCameraBinding,
  PhysicsError,
  PhysicsEulerAngles,
  PhysicsRuntimeSnapshot,
  PhysicsTimestampMs,
  PhysicsVector3,
  PlayerMovementMode,
  PlayerPhysicsState,
} from "../runtime/physics/physics_models";

import {
  createCollisionFlags,
  createEyePosition,
  createPhysicsCameraBinding,
  createPhysicsError,
  createPhysicsVector3,
  EMPTY_COLLISION_FLAGS,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  sanitizePhysicsString,
  ZERO_PHYSICS_ANGLES,
  ZERO_PHYSICS_VECTOR,
} from "../runtime/physics/physics_models";

import {
  DEFAULT_PHYSICS_CONFIG,
  createDefaultPhysicsConfig,
  type PhysicsConfigPatch,
} from "../runtime/physics/physics_defaults";

import {
  createInitialPlayerPhysicsState,
  createPlayerPhysicsStorePatch,
  createPlayerPhysicsStateFromSpawn,
  createSafePhysicsTimestamp,
  createSafeRevision,
  normalizePhysicsAngles,
  normalizePhysicsPosition,
  normalizePhysicsVelocity,
  type CameraLikeSpawnInput,
  type PlayerPhysicsStorePatch,
} from "../runtime/physics/player_physics_state";

/**
 * Store-facing player state models.
 *
 * This file is the bridge between the physics runtime and the editor store.
 * It should remain plain-data oriented and free of:
 * - DOM APIs
 * - Three.js objects
 * - runtime loops
 * - chunk loading
 * - render objects
 *
 * Intended use:
 * - editor_state.ts imports EditorPlayerState
 * - state_actions.ts uses createPlayerStateFromPhysics(...)
 * - state_selectors.ts reads the derived flags/positions
 * - ui/debug_overlay.ts can display PlayerDebugState
 */

export type PlayerStateSource =
  | "default"
  | "bootstrap"
  | "physics-runtime"
  | "scene-runtime"
  | "store-patch"
  | "reset"
  | "unknown";

export type PlayerRuntimeStatus =
  | "idle"
  | "ready"
  | "moving"
  | "grounded"
  | "airborne"
  | "flying"
  | "blocked"
  | "error";

export interface PlayerDebugState {
  readonly enabled: boolean;
  readonly source: PlayerStateSource;
  readonly status: PlayerRuntimeStatus;
  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly positionText: string;
  readonly velocityText: string;
  readonly eyePositionText: string;
  readonly collisionText: string;
  readonly lastErrorMessage: string | null;
  readonly warnings: readonly string[];
  readonly revision: number;
}

export interface EditorPlayerState {
  readonly source: PlayerStateSource;
  readonly status: PlayerRuntimeStatus;

  readonly position: PhysicsVector3;
  readonly velocity: PhysicsVector3;
  readonly eyePosition: PhysicsVector3;
  readonly angles: PhysicsEulerAngles;

  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;

  readonly collisionFlags: CollisionFlags;

  readonly lastGroundedAtMs: PhysicsTimestampMs | null;
  readonly lastJumpAtMs: PhysicsTimestampMs | null;
  readonly lastFlightToggleAtMs: PhysicsTimestampMs | null;
  readonly lastUpdatedAtMs: PhysicsTimestampMs | null;

  readonly lastError: PhysicsError | null;
  readonly warnings: readonly string[];

  readonly physicsRevision: number;
  readonly storeRevision: number;

  /**
   * Optional raw physics state snapshot for systems that need exact runtime data.
   * Keep this serializable.
   */
  readonly physics: PlayerPhysicsState;
}

export interface EditorPlayerStatePatch {
  readonly source?: PlayerStateSource;
  readonly status?: PlayerRuntimeStatus;

  readonly position?: Partial<PhysicsVector3> | null;
  readonly velocity?: Partial<PhysicsVector3> | null;
  readonly eyePosition?: Partial<PhysicsVector3> | null;
  readonly angles?: Partial<PhysicsEulerAngles> | null;

  readonly movementMode?: PlayerMovementMode | string | null;
  readonly grounded?: unknown;
  readonly flying?: unknown;

  readonly collisionFlags?: Partial<CollisionFlags> | null;

  readonly lastGroundedAtMs?: PhysicsTimestampMs | null;
  readonly lastJumpAtMs?: PhysicsTimestampMs | null;
  readonly lastFlightToggleAtMs?: PhysicsTimestampMs | null;
  readonly lastUpdatedAtMs?: PhysicsTimestampMs | null;

  readonly lastError?: PhysicsError | null;
  readonly warnings?: readonly string[] | null;

  readonly physicsRevision?: unknown;
  readonly storeRevision?: unknown;

  readonly physics?: PlayerPhysicsState | null;
}

export interface PlayerStateUpdateInput {
  readonly player?: PlayerPhysicsState | null;
  readonly camera?: PhysicsCameraBinding | null;
  readonly snapshot?: PhysicsRuntimeSnapshot | null;
  readonly source?: PlayerStateSource;
  readonly status?: PlayerRuntimeStatus;
  readonly nowMs?: PhysicsTimestampMs | null;
  readonly error?: PhysicsError | null;
  readonly warnings?: readonly string[] | null;
}

export interface PlayerStateBootstrapInput {
  readonly cameraSpawn?: CameraLikeSpawnInput | null;
  readonly physics?: PhysicsConfigPatch | null;
  readonly source?: PlayerStateSource;
  readonly nowMs?: PhysicsTimestampMs | null;
}

export interface PlayerStateSerialization {
  readonly source: PlayerStateSource;
  readonly status: PlayerRuntimeStatus;
  readonly position: PhysicsVector3;
  readonly velocity: PhysicsVector3;
  readonly eyePosition: PhysicsVector3;
  readonly angles: PhysicsEulerAngles;
  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly collisionFlags: CollisionFlags;
  readonly lastGroundedAtMs: PhysicsTimestampMs | null;
  readonly lastJumpAtMs: PhysicsTimestampMs | null;
  readonly lastFlightToggleAtMs: PhysicsTimestampMs | null;
  readonly lastUpdatedAtMs: PhysicsTimestampMs | null;
  readonly lastError: PhysicsError | null;
  readonly warnings: readonly string[];
  readonly physicsRevision: number;
  readonly storeRevision: number;
}

export const DEFAULT_PLAYER_STATE_SOURCE: PlayerStateSource = "default";
export const DEFAULT_PLAYER_RUNTIME_STATUS: PlayerRuntimeStatus = "idle";

export const DEFAULT_PLAYER_STATE_POSITION: PhysicsVector3 = Object.freeze({
  x: 0,
  y: 8,
  z: 0,
});

export const DEFAULT_PLAYER_STATE_ANGLES: PhysicsEulerAngles = Object.freeze({
  yaw: 0,
  pitch: 0,
  roll: 0,
});

function normalizePlayerStateSource(value: unknown, fallback: PlayerStateSource = DEFAULT_PLAYER_STATE_SOURCE): PlayerStateSource {
  try {
    if (
      value === "default" ||
      value === "bootstrap" ||
      value === "physics-runtime" ||
      value === "scene-runtime" ||
      value === "store-patch" ||
      value === "reset" ||
      value === "unknown"
    ) {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizePlayerRuntimeStatus(
  value: unknown,
  fallback: PlayerRuntimeStatus = DEFAULT_PLAYER_RUNTIME_STATUS,
): PlayerRuntimeStatus {
  try {
    if (
      value === "idle" ||
      value === "ready" ||
      value === "moving" ||
      value === "grounded" ||
      value === "airborne" ||
      value === "flying" ||
      value === "blocked" ||
      value === "error"
    ) {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizePlayerMovementMode(value: unknown, fallback: PlayerMovementMode = "airborne"): PlayerMovementMode {
  try {
    if (value === "grounded" || value === "airborne" || value === "flying") {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeWarnings(value: readonly string[] | null | undefined): readonly string[] {
  try {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((warning) => sanitizePhysicsString(warning, "Unknown player warning"))
      .filter((warning) => warning.length > 0);
  } catch {
    return [];
  }
}

function normalizeStoreRevision(value: unknown, fallback = 0): number {
  try {
    return Math.max(
      0,
      Math.floor(
        sanitizePhysicsNumber(value, fallback, {
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
        }),
      ),
    );
  } catch {
    return fallback;
  }
}

function vectorToText(value: PhysicsVector3, digits = 2): string {
  try {
    const precision = Math.max(
      0,
      Math.min(6, Math.floor(sanitizePhysicsNumber(digits, 2))),
    );

    return [
      sanitizePhysicsNumber(value.x, 0).toFixed(precision),
      sanitizePhysicsNumber(value.y, 0).toFixed(precision),
      sanitizePhysicsNumber(value.z, 0).toFixed(precision),
    ].join(", ");
  } catch {
    return "0.00, 0.00, 0.00";
  }
}

function collisionFlagsToText(flags: CollisionFlags): string {
  try {
    const parts: string[] = [];

    if (flags.grounded) {
      parts.push("grounded");
    }

    if (flags.hitCeiling) {
      parts.push("ceiling");
    }

    if (flags.hitWallX) {
      parts.push("wall-x");
    }

    if (flags.hitWallZ) {
      parts.push("wall-z");
    }

    if (flags.blockedByMissingChunk) {
      parts.push("missing-chunk");
    }

    if (flags.touchedSolid && parts.length === 0) {
      parts.push("solid");
    }

    return parts.length > 0 ? parts.join(", ") : "none";
  } catch {
    return "unknown";
  }
}

function inferStatusFromPlayerState(state: {
  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly velocity: PhysicsVector3;
  readonly collisionFlags: CollisionFlags;
  readonly lastError?: PhysicsError | null;
}): PlayerRuntimeStatus {
  try {
    if (state.lastError) {
      return "error";
    }

    if (state.flying || state.movementMode === "flying") {
      return "flying";
    }

    if (state.collisionFlags.hitHorizontalWall || state.collisionFlags.blockedByMissingChunk) {
      return "blocked";
    }

    const speedSquared =
      state.velocity.x * state.velocity.x +
      state.velocity.y * state.velocity.y +
      state.velocity.z * state.velocity.z;

    if (speedSquared > 0.0001) {
      return "moving";
    }

    if (state.grounded || state.movementMode === "grounded") {
      return "grounded";
    }

    if (state.movementMode === "airborne") {
      return "airborne";
    }

    return "ready";
  } catch {
    return "idle";
  }
}

export function createDefaultEditorPlayerState(
  input: PlayerStateBootstrapInput | null | undefined = undefined,
): EditorPlayerState {
  try {
    const physicsConfig = createDefaultPhysicsConfig(input?.physics);
    const nowMs = createSafePhysicsTimestamp(input?.nowMs, null);

    const player = createPlayerPhysicsStateFromSpawn(
      {
        position: input?.cameraSpawn
          ? {
              x: sanitizePhysicsNumber(input.cameraSpawn.x, DEFAULT_PLAYER_STATE_POSITION.x),
              y: sanitizePhysicsNumber(input.cameraSpawn.y, DEFAULT_PLAYER_STATE_POSITION.y),
              z: sanitizePhysicsNumber(input.cameraSpawn.z, DEFAULT_PLAYER_STATE_POSITION.z),
            }
          : DEFAULT_PLAYER_STATE_POSITION,
        angles: input?.cameraSpawn
          ? {
              yaw: sanitizePhysicsNumber(input.cameraSpawn.yaw, DEFAULT_PLAYER_STATE_ANGLES.yaw),
              pitch: sanitizePhysicsNumber(input.cameraSpawn.pitch, DEFAULT_PLAYER_STATE_ANGLES.pitch),
              roll: sanitizePhysicsNumber(input.cameraSpawn.roll, DEFAULT_PLAYER_STATE_ANGLES.roll ?? 0),
            }
          : DEFAULT_PLAYER_STATE_ANGLES,
        movementMode: "airborne",
      },
      physicsConfig,
      nowMs,
    );

    return createEditorPlayerStateFromPhysics({
      player,
      camera: createPhysicsCameraBinding(player, input?.cameraSpawn
        ? {
            yaw: sanitizePhysicsNumber(input.cameraSpawn.yaw, DEFAULT_PLAYER_STATE_ANGLES.yaw),
            pitch: sanitizePhysicsNumber(input.cameraSpawn.pitch, DEFAULT_PLAYER_STATE_ANGLES.pitch),
            roll: sanitizePhysicsNumber(input.cameraSpawn.roll, DEFAULT_PLAYER_STATE_ANGLES.roll ?? 0),
          }
        : DEFAULT_PLAYER_STATE_ANGLES),
      source: input?.source ?? "default",
      status: "ready",
      nowMs,
    });
  } catch {
    const physicsConfig = createDefaultPhysicsConfig();
    const player = createInitialPlayerPhysicsState(
      {
        position: DEFAULT_PLAYER_STATE_POSITION,
        movementMode: "airborne",
      },
      physicsConfig,
    );

    return createEditorPlayerStateFromPhysics({
      player,
      camera: createPhysicsCameraBinding(player, DEFAULT_PLAYER_STATE_ANGLES),
      source: "default",
      status: "idle",
      nowMs: null,
    });
  }
}

export function createEditorPlayerStateFromPhysics(
  input: PlayerStateUpdateInput,
): EditorPlayerState {
  try {
    const source = normalizePlayerStateSource(input.source, "physics-runtime");
    const player =
      input.player ??
      input.snapshot?.player ??
      createInitialPlayerPhysicsState(null, DEFAULT_PHYSICS_CONFIG);

    const physicsStorePatch: PlayerPhysicsStorePatch = createPlayerPhysicsStorePatch(player);
    const camera = input.camera ?? input.snapshot?.camera ?? createPhysicsCameraBinding(player, ZERO_PHYSICS_ANGLES);

    const position = normalizePhysicsPosition(physicsStorePatch.position, DEFAULT_PLAYER_STATE_POSITION);
    const velocity = normalizePhysicsVelocity(physicsStorePatch.velocity, ZERO_PHYSICS_VECTOR);
    const eyePosition = normalizePhysicsPosition(
      camera.eyePosition ?? physicsStorePatch.eyePosition,
      createEyePosition(position, player.collider),
    );

    const angles = normalizePhysicsAngles(camera.angles ?? ZERO_PHYSICS_ANGLES, ZERO_PHYSICS_ANGLES);
    const movementMode = normalizePlayerMovementMode(physicsStorePatch.movementMode, player.movementMode);
    const grounded = sanitizePhysicsBoolean(physicsStorePatch.grounded, movementMode === "grounded");
    const flying = sanitizePhysicsBoolean(physicsStorePatch.flying, movementMode === "flying");
    const collisionFlags = createCollisionFlags(physicsStorePatch.collisionFlags ?? player.collisionFlags);
    const lastError = input.error ?? input.snapshot?.lastError ?? null;
    const warnings = normalizeWarnings(input.warnings ?? input.snapshot?.warnings ?? []);

    const inferredStatus = inferStatusFromPlayerState({
      movementMode,
      grounded,
      flying,
      velocity,
      collisionFlags,
      lastError,
    });

    return {
      source,
      status: normalizePlayerRuntimeStatus(input.status, inferredStatus),
      position,
      velocity,
      eyePosition,
      angles,
      movementMode,
      grounded,
      flying,
      collisionFlags,
      lastGroundedAtMs: createSafePhysicsTimestamp(
        physicsStorePatch.lastGroundedAtMs,
        player.lastGroundedAtMs,
      ),
      lastJumpAtMs: createSafePhysicsTimestamp(
        physicsStorePatch.lastJumpAtMs,
        player.lastJumpAtMs,
      ),
      lastFlightToggleAtMs: createSafePhysicsTimestamp(
        physicsStorePatch.lastFlightToggleAtMs,
        player.lastFlightToggleAtMs,
      ),
      lastUpdatedAtMs: createSafePhysicsTimestamp(input.nowMs, Date.now()),
      lastError,
      warnings,
      physicsRevision: createSafeRevision(physicsStorePatch.revision, player.revision),
      storeRevision: 0,
      physics: player,
    };
  } catch (cause) {
    const player = createInitialPlayerPhysicsState(
      {
        position: DEFAULT_PLAYER_STATE_POSITION,
        movementMode: "airborne",
      },
      DEFAULT_PHYSICS_CONFIG,
    );

    return {
      source: "default",
      status: "error",
      position: DEFAULT_PLAYER_STATE_POSITION,
      velocity: ZERO_PHYSICS_VECTOR,
      eyePosition: createEyePosition(DEFAULT_PLAYER_STATE_POSITION, player.collider),
      angles: DEFAULT_PLAYER_STATE_ANGLES,
      movementMode: "airborne",
      grounded: false,
      flying: false,
      collisionFlags: EMPTY_COLLISION_FLAGS,
      lastGroundedAtMs: null,
      lastJumpAtMs: null,
      lastFlightToggleAtMs: null,
      lastUpdatedAtMs: null,
      lastError: createPhysicsError(
        "PLAYER_STATE_CREATE_FAILED",
        "Failed to create editor player state from physics state.",
        {
          cause,
          recoverable: true,
        },
      ),
      warnings: ["Failed to create editor player state from physics state."],
      physicsRevision: 0,
      storeRevision: 0,
      physics: player,
    };
  }
}

export function createEditorPlayerStateFromRuntimeSnapshot(
  snapshot: PhysicsRuntimeSnapshot | null | undefined,
  options: {
    readonly source?: PlayerStateSource;
    readonly status?: PlayerRuntimeStatus;
    readonly nowMs?: PhysicsTimestampMs | null;
  } = {},
): EditorPlayerState {
  try {
    if (!snapshot) {
      return createDefaultEditorPlayerState({
        source: options.source ?? "default",
        nowMs: options.nowMs ?? null,
      });
    }

    return createEditorPlayerStateFromPhysics({
      player: snapshot.player,
      camera: snapshot.camera,
      snapshot,
      source: options.source ?? "physics-runtime",
      status: options.status,
      nowMs: options.nowMs ?? null,
      error: snapshot.lastError,
      warnings: snapshot.warnings,
    });
  } catch {
    return createDefaultEditorPlayerState({
      source: options.source ?? "default",
      nowMs: options.nowMs ?? null,
    });
  }
}

export function patchEditorPlayerState(
  state: EditorPlayerState,
  patch: EditorPlayerStatePatch,
): EditorPlayerState {
  try {
    const source = normalizePlayerStateSource(patch.source, state.source);
    const movementMode = normalizePlayerMovementMode(patch.movementMode, state.movementMode);

    const position = normalizePhysicsPosition(patch.position, state.position);
    const velocity = normalizePhysicsVelocity(patch.velocity, state.velocity);
    const eyePosition = normalizePhysicsPosition(patch.eyePosition, state.eyePosition);
    const angles = normalizePhysicsAngles(patch.angles, state.angles);

    const grounded = sanitizePhysicsBoolean(patch.grounded, movementMode === "grounded" || state.grounded);
    const flying = sanitizePhysicsBoolean(patch.flying, movementMode === "flying" || state.flying);

    const collisionFlags = createCollisionFlags({
      ...state.collisionFlags,
      ...(patch.collisionFlags ?? {}),
      grounded,
    });

    const physics = patch.physics ?? state.physics;
    const lastError = patch.lastError === undefined ? state.lastError : patch.lastError;
    const warnings = patch.warnings === undefined ? state.warnings : normalizeWarnings(patch.warnings);

    const nextStatus = normalizePlayerRuntimeStatus(
      patch.status,
      inferStatusFromPlayerState({
        movementMode,
        grounded,
        flying,
        velocity,
        collisionFlags,
        lastError,
      }),
    );

    return {
      source,
      status: nextStatus,
      position,
      velocity,
      eyePosition,
      angles,
      movementMode,
      grounded,
      flying,
      collisionFlags,
      lastGroundedAtMs:
        patch.lastGroundedAtMs === undefined
          ? state.lastGroundedAtMs
          : createSafePhysicsTimestamp(patch.lastGroundedAtMs, null),
      lastJumpAtMs:
        patch.lastJumpAtMs === undefined
          ? state.lastJumpAtMs
          : createSafePhysicsTimestamp(patch.lastJumpAtMs, null),
      lastFlightToggleAtMs:
        patch.lastFlightToggleAtMs === undefined
          ? state.lastFlightToggleAtMs
          : createSafePhysicsTimestamp(patch.lastFlightToggleAtMs, null),
      lastUpdatedAtMs:
        patch.lastUpdatedAtMs === undefined
          ? createSafePhysicsTimestamp(Date.now(), state.lastUpdatedAtMs)
          : createSafePhysicsTimestamp(patch.lastUpdatedAtMs, state.lastUpdatedAtMs),
      lastError,
      warnings,
      physicsRevision: createSafeRevision(patch.physicsRevision, state.physicsRevision),
      storeRevision: normalizeStoreRevision(patch.storeRevision, state.storeRevision + 1),
      physics,
    };
  } catch {
    return {
      ...state,
      status: "error",
      lastError: createPhysicsError(
        "PLAYER_STATE_PATCH_FAILED",
        "Failed to patch editor player state.",
        {
          recoverable: true,
        },
      ),
      warnings: [...state.warnings, "Failed to patch editor player state."],
      storeRevision: state.storeRevision + 1,
    };
  }
}

export function updateEditorPlayerStateFromPhysics(
  state: EditorPlayerState,
  input: PlayerStateUpdateInput,
): EditorPlayerState {
  try {
    const next = createEditorPlayerStateFromPhysics({
      ...input,
      source: input.source ?? "physics-runtime",
    });

    return {
      ...next,
      storeRevision: state.storeRevision + 1,
    };
  } catch {
    return patchEditorPlayerState(state, {
      status: "error",
      lastError: createPhysicsError(
        "PLAYER_STATE_PHYSICS_UPDATE_FAILED",
        "Failed to update editor player state from physics.",
        {
          recoverable: true,
        },
      ),
      warnings: [...state.warnings, "Failed to update editor player state from physics."],
    });
  }
}

export function resetEditorPlayerState(
  state: EditorPlayerState | null | undefined,
  input: PlayerStateBootstrapInput | null | undefined = undefined,
): EditorPlayerState {
  try {
    const next = createDefaultEditorPlayerState({
      ...input,
      source: input?.source ?? "reset",
      nowMs: input?.nowMs ?? Date.now(),
    });

    return {
      ...next,
      storeRevision: normalizeStoreRevision(state?.storeRevision, 0) + 1,
    };
  } catch {
    return createDefaultEditorPlayerState({
      source: "reset",
      nowMs: Date.now(),
    });
  }
}

export function createPlayerDebugState(
  state: EditorPlayerState,
  options: {
    readonly enabled?: unknown;
    readonly includeWarnings?: unknown;
  } = {},
): PlayerDebugState {
  try {
    const enabled = sanitizePhysicsBoolean(options.enabled, true);
    const includeWarnings = sanitizePhysicsBoolean(options.includeWarnings, true);

    return {
      enabled,
      source: state.source,
      status: state.status,
      movementMode: state.movementMode,
      grounded: state.grounded,
      flying: state.flying,
      positionText: vectorToText(state.position),
      velocityText: vectorToText(state.velocity),
      eyePositionText: vectorToText(state.eyePosition),
      collisionText: collisionFlagsToText(state.collisionFlags),
      lastErrorMessage: state.lastError?.message ?? null,
      warnings: includeWarnings ? state.warnings : [],
      revision: state.storeRevision,
    };
  } catch {
    return {
      enabled: false,
      source: "unknown",
      status: "error",
      movementMode: "airborne",
      grounded: false,
      flying: false,
      positionText: "0.00, 0.00, 0.00",
      velocityText: "0.00, 0.00, 0.00",
      eyePositionText: "0.00, 0.00, 0.00",
      collisionText: "unknown",
      lastErrorMessage: "Failed to create player debug state.",
      warnings: ["Failed to create player debug state."],
      revision: 0,
    };
  }
}

export function serializeEditorPlayerState(
  state: EditorPlayerState,
): PlayerStateSerialization {
  try {
    return {
      source: state.source,
      status: state.status,
      position: createPhysicsVector3(state.position.x, state.position.y, state.position.z),
      velocity: createPhysicsVector3(state.velocity.x, state.velocity.y, state.velocity.z),
      eyePosition: createPhysicsVector3(state.eyePosition.x, state.eyePosition.y, state.eyePosition.z),
      angles: normalizePhysicsAngles(state.angles, ZERO_PHYSICS_ANGLES),
      movementMode: state.movementMode,
      grounded: state.grounded,
      flying: state.flying,
      collisionFlags: createCollisionFlags(state.collisionFlags),
      lastGroundedAtMs: createSafePhysicsTimestamp(state.lastGroundedAtMs, null),
      lastJumpAtMs: createSafePhysicsTimestamp(state.lastJumpAtMs, null),
      lastFlightToggleAtMs: createSafePhysicsTimestamp(state.lastFlightToggleAtMs, null),
      lastUpdatedAtMs: createSafePhysicsTimestamp(state.lastUpdatedAtMs, null),
      lastError: state.lastError,
      warnings: normalizeWarnings(state.warnings),
      physicsRevision: createSafeRevision(state.physicsRevision, 0),
      storeRevision: normalizeStoreRevision(state.storeRevision, 0),
    };
  } catch {
    const fallback = createDefaultEditorPlayerState();

    return {
      source: fallback.source,
      status: fallback.status,
      position: fallback.position,
      velocity: fallback.velocity,
      eyePosition: fallback.eyePosition,
      angles: fallback.angles,
      movementMode: fallback.movementMode,
      grounded: fallback.grounded,
      flying: fallback.flying,
      collisionFlags: fallback.collisionFlags,
      lastGroundedAtMs: fallback.lastGroundedAtMs,
      lastJumpAtMs: fallback.lastJumpAtMs ?? null,
      lastFlightToggleAtMs: fallback.lastFlightToggleAtMs,
      lastUpdatedAtMs: fallback.lastUpdatedAtMs,
      lastError: fallback.lastError,
      warnings: fallback.warnings,
      physicsRevision: fallback.physicsRevision,
      storeRevision: fallback.storeRevision,
    };
  }
}

export function isEditorPlayerState(value: unknown): value is EditorPlayerState {
  try {
    const candidate = value as EditorPlayerState | null | undefined;

    return Boolean(
      candidate &&
        candidate.position &&
        candidate.velocity &&
        candidate.eyePosition &&
        candidate.angles &&
        candidate.physics &&
        typeof candidate.source === "string" &&
        typeof candidate.status === "string" &&
        typeof candidate.movementMode === "string" &&
        typeof candidate.grounded === "boolean" &&
        typeof candidate.flying === "boolean" &&
        typeof candidate.storeRevision === "number",
    );
  } catch {
    return false;
  }
}

export function hasPlayerStatePositionChanged(
  previous: EditorPlayerState | null | undefined,
  next: EditorPlayerState | null | undefined,
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

export function hasPlayerStateModeChanged(
  previous: EditorPlayerState | null | undefined,
  next: EditorPlayerState | null | undefined,
): boolean {
  try {
    if (!previous || !next) {
      return true;
    }

    return (
      previous.movementMode !== next.movementMode ||
      previous.grounded !== next.grounded ||
      previous.flying !== next.flying ||
      previous.status !== next.status
    );
  } catch {
    return true;
  }
}

export function selectPlayerEyePosition(state: EditorPlayerState | null | undefined): PhysicsVector3 {
  try {
    return state?.eyePosition ?? ZERO_PHYSICS_VECTOR;
  } catch {
    return ZERO_PHYSICS_VECTOR;
  }
}

export function selectPlayerBodyPosition(state: EditorPlayerState | null | undefined): PhysicsVector3 {
  try {
    return state?.position ?? ZERO_PHYSICS_VECTOR;
  } catch {
    return ZERO_PHYSICS_VECTOR;
  }
}

export function selectPlayerVelocity(state: EditorPlayerState | null | undefined): PhysicsVector3 {
  try {
    return state?.velocity ?? ZERO_PHYSICS_VECTOR;
  } catch {
    return ZERO_PHYSICS_VECTOR;
  }
}

export function selectPlayerIsFlying(state: EditorPlayerState | null | undefined): boolean {
  try {
    return Boolean(state?.flying || state?.movementMode === "flying");
  } catch {
    return false;
  }
}

export function selectPlayerIsGrounded(state: EditorPlayerState | null | undefined): boolean {
  try {
    return Boolean(state?.grounded || state?.movementMode === "grounded");
  } catch {
    return false;
  }
}

export function selectPlayerCameraBinding(state: EditorPlayerState | null | undefined): PhysicsCameraBinding {
  try {
    if (!state) {
      const fallback = createDefaultEditorPlayerState();
      return createPhysicsCameraBinding(fallback.physics, fallback.angles);
    }

    return {
      bodyPosition: state.position,
      eyePosition: state.eyePosition,
      angles: state.angles,
    };
  } catch {
    const fallback = createDefaultEditorPlayerState();
    return createPhysicsCameraBinding(fallback.physics, fallback.angles);
  }
}