// src/frontend/runtime/physics/physics_models.ts

/**
 * Shared physics model contracts for the VECTOPLAN editor runtime.
 *
 * This file is intentionally dependency-free:
 * - no Three.js imports
 * - no DOM imports
 * - no store imports
 * - no world/chunk imports
 *
 * The physics layer should work with plain serializable values wherever possible.
 * Rendering, camera binding, input collection and chunk lookup are wired in higher layers.
 */

export type PhysicsScalar = number;

export type PhysicsTimestampMs = number;

export type PhysicsDeltaSeconds = number;

export type PhysicsAxis = "x" | "y" | "z";

export type PhysicsSign = -1 | 0 | 1;

export type PlayerMovementMode = "grounded" | "airborne" | "flying";

export type PlayerColliderKind = "aabb";

export type CollisionCellKind =
  | "unknown"
  | "air"
  | "solid"
  | "non_solid"
  | "liquid"
  | "trigger";

export type CollisionResolutionPolicy =
  | "block"
  | "allow"
  | "request_chunk"
  | "treat_as_air"
  | "treat_as_solid";

export type PhysicsStepPhase =
  | "idle"
  | "collect-input"
  | "integrate"
  | "collide"
  | "commit"
  | "failed";

export interface PhysicsVector3 {
  readonly x: PhysicsScalar;
  readonly y: PhysicsScalar;
  readonly z: PhysicsScalar;
}

export interface MutablePhysicsVector3 {
  x: PhysicsScalar;
  y: PhysicsScalar;
  z: PhysicsScalar;
}

export interface PhysicsEulerAngles {
  readonly yaw: PhysicsScalar;
  readonly pitch: PhysicsScalar;
  readonly roll?: PhysicsScalar;
}

export interface PhysicsAabb {
  readonly min: PhysicsVector3;
  readonly max: PhysicsVector3;
}

export interface PlayerAabbCollider {
  readonly kind: "aabb";

  /**
   * Full collider width in world/block units.
   * For a Minecraft-like player this is usually smaller than one full block.
   */
  readonly width: PhysicsScalar;

  /**
   * Full collider height in world/block units.
   */
  readonly height: PhysicsScalar;

  /**
   * Eye offset from the player's foot/base position.
   */
  readonly eyeHeight: PhysicsScalar;

  /**
   * Small inset used to reduce floating point jitter when resolving collisions.
   */
  readonly skinWidth: PhysicsScalar;
}

export type PlayerCollider = PlayerAabbCollider;

export interface PhysicsTimingConfig {
  readonly fixedTimeStepSeconds: PhysicsDeltaSeconds;
  readonly maxFrameDeltaSeconds: PhysicsDeltaSeconds;
  readonly maxSubSteps: number;
}

export interface PhysicsMovementConfig {
  readonly walkSpeed: PhysicsScalar;
  readonly sprintSpeed: PhysicsScalar;
  readonly airControlSpeed: PhysicsScalar;
  readonly flySpeed: PhysicsScalar;
  readonly flySprintSpeed: PhysicsScalar;
  readonly jumpVelocity: PhysicsScalar;
  readonly gravity: PhysicsScalar;
  readonly maxFallSpeed: PhysicsScalar;
  readonly groundSnapDistance: PhysicsScalar;
}

export interface PhysicsInputConfig {
  /**
   * Maximum delay between two Space key presses that counts as a double tap.
   */
  readonly doubleTapWindowMs: PhysicsTimestampMs;

  /**
   * If true, the first Space tap can still trigger a jump while the second tap
   * inside the double-tap window switches to flying.
   */
  readonly allowJumpBeforeFlightToggle: boolean;
}

export interface PhysicsMissingChunkConfig {
  /**
   * Movement policy when collision data for a relevant chunk is unavailable.
   *
   * Recommended early runtime setting:
   * - "block" or "request_chunk" for safety
   *
   * Dangerous setting:
   * - "treat_as_air", because the player may fall through not-yet-loaded terrain.
   */
  readonly policy: CollisionResolutionPolicy;

  readonly blockHorizontalMovement: boolean;
  readonly blockVerticalMovement: boolean;
}

export interface PhysicsDebugConfig {
  readonly enabled: boolean;
  readonly exposeToStore: boolean;
  readonly includeCollisionCells: boolean;
}

export interface PhysicsConfig {
  readonly enabled: boolean;
  readonly timing: PhysicsTimingConfig;
  readonly movement: PhysicsMovementConfig;
  readonly input: PhysicsInputConfig;
  readonly missingChunks: PhysicsMissingChunkConfig;
  readonly collider: PlayerCollider;
  readonly debug: PhysicsDebugConfig;
}

export interface PlayerMovementIntent {
  /**
   * Forward/backward axis after input normalization.
   *
   * Convention:
   * - -1 = forward in the current editor runtime convention
   * -  0 = no forward/backward movement
   * -  1 = backward
   */
  readonly forward: PhysicsScalar;

  /**
   * Left/right axis after input normalization.
   *
   * Convention:
   * - -1 = left
   * -  0 = no sideways movement
   * -  1 = right
   */
  readonly right: PhysicsScalar;

  readonly sprintHeld: boolean;

  /**
   * True only for the frame in which Space was newly pressed.
   * This must ignore keyboard repeat events.
   */
  readonly jumpPressed: boolean;

  /**
   * True while Space is currently held down.
   * Used for flight ascend.
   */
  readonly ascendHeld: boolean;

  /**
   * True while the descend key is held down.
   * Current intended binding: Q.
   */
  readonly descendHeld: boolean;

  /**
   * True only for the frame in which the flight toggle was requested.
   * Usually produced by the double-tap detector.
   */
  readonly toggleFlightRequested: boolean;

  /**
   * Optional explicit no-clip request for future debug tooling.
   * Normal gameplay must keep this false.
   */
  readonly debugNoClipRequested?: boolean;
}

export interface CollisionFlags {
  readonly grounded: boolean;
  readonly hitCeiling: boolean;
  readonly hitWallX: boolean;
  readonly hitWallZ: boolean;
  readonly hitHorizontalWall: boolean;
  readonly touchedSolid: boolean;
  readonly blockedByMissingChunk: boolean;
}

export interface CollisionCellRef {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  readonly kind: CollisionCellKind;
  readonly blockTypeId?: string | null;
  readonly chunkLoaded: boolean;
}

export interface CollisionQueryResult {
  readonly kind: CollisionCellKind;
  readonly solid: boolean;
  readonly loaded: boolean;
  readonly blockTypeId?: string | null;
  readonly policy?: CollisionResolutionPolicy;
}

export interface CollisionTrace {
  readonly checkedCellCount: number;
  readonly solidCellCount: number;
  readonly missingCellCount: number;
  readonly cells?: readonly CollisionCellRef[];
}

export interface PlayerPhysicsState {
  readonly position: PhysicsVector3;

  /**
   * Current velocity in world units per second.
   */
  readonly velocity: PhysicsVector3;

  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;

  readonly collider: PlayerCollider;

  readonly lastGroundedAtMs: PhysicsTimestampMs | null;
  readonly lastJumpAtMs: PhysicsTimestampMs | null;
  readonly lastFlightToggleAtMs: PhysicsTimestampMs | null;

  readonly collisionFlags: CollisionFlags;

  /**
   * Monotonic simulation counter. Useful for store/debug synchronization.
   */
  readonly revision: number;
}

export interface PhysicsCameraBinding {
  readonly eyePosition: PhysicsVector3;
  readonly bodyPosition: PhysicsVector3;
  readonly angles: PhysicsEulerAngles;
}

export interface PhysicsStepInput {
  readonly nowMs: PhysicsTimestampMs;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly movementIntent: PlayerMovementIntent;
  readonly lookAngles: PhysicsEulerAngles;
  readonly config: PhysicsConfig;
}

export interface PhysicsStepResult {
  readonly ok: boolean;
  readonly phase: PhysicsStepPhase;
  readonly previousState: PlayerPhysicsState;
  readonly nextState: PlayerPhysicsState;
  readonly camera: PhysicsCameraBinding;
  readonly collisionTrace?: CollisionTrace;
  readonly error?: PhysicsError;
  readonly warnings: readonly string[];
}

export interface PhysicsError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly recoverable: boolean;
}

export interface PhysicsRuntimeSnapshot {
  readonly enabled: boolean;
  readonly phase: PhysicsStepPhase;
  readonly player: PlayerPhysicsState;
  readonly camera: PhysicsCameraBinding;
  readonly accumulatorSeconds: PhysicsDeltaSeconds;
  readonly lastStepAtMs: PhysicsTimestampMs | null;
  readonly lastError: PhysicsError | null;
  readonly warnings: readonly string[];
}

export interface PhysicsSpawnConfig {
  readonly position: PhysicsVector3;
  readonly angles: PhysicsEulerAngles;
  readonly movementMode?: PlayerMovementMode;
}

export interface PhysicsStatePatch {
  readonly position?: Partial<PhysicsVector3>;
  readonly velocity?: Partial<PhysicsVector3>;
  readonly movementMode?: PlayerMovementMode;
  readonly grounded?: boolean;
  readonly flying?: boolean;
  readonly lastGroundedAtMs?: PhysicsTimestampMs | null;
  readonly lastJumpAtMs?: PhysicsTimestampMs | null;
  readonly lastFlightToggleAtMs?: PhysicsTimestampMs | null;
  readonly collisionFlags?: Partial<CollisionFlags>;
}

export const ZERO_PHYSICS_VECTOR: PhysicsVector3 = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
});

export const ZERO_PHYSICS_ANGLES: PhysicsEulerAngles = Object.freeze({
  yaw: 0,
  pitch: 0,
  roll: 0,
});

export const EMPTY_COLLISION_FLAGS: CollisionFlags = Object.freeze({
  grounded: false,
  hitCeiling: false,
  hitWallX: false,
  hitWallZ: false,
  hitHorizontalWall: false,
  touchedSolid: false,
  blockedByMissingChunk: false,
});

export const EMPTY_PLAYER_MOVEMENT_INTENT: PlayerMovementIntent = Object.freeze({
  forward: 0,
  right: 0,
  sprintHeld: false,
  jumpPressed: false,
  ascendHeld: false,
  descendHeld: false,
  toggleFlightRequested: false,
  debugNoClipRequested: false,
});

export function createPhysicsError(
  code: string,
  message: string,
  options: {
    readonly cause?: unknown;
    readonly recoverable?: boolean;
  } = {},
): PhysicsError {
  return {
    code: sanitizePhysicsString(code, "PHYSICS_ERROR"),
    message: sanitizePhysicsString(message, "Unknown physics error"),
    cause: options.cause,
    recoverable: options.recoverable ?? true,
  };
}

export function isFinitePhysicsNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sanitizePhysicsNumber(
  value: unknown,
  fallback: number,
  options: {
    readonly min?: number;
    readonly max?: number;
  } = {},
): number {
  try {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : fallback;

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    const min = options.min;
    const max = options.max;

    if (typeof min === "number" && parsed < min) {
      return min;
    }

    if (typeof max === "number" && parsed > max) {
      return max;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function sanitizePhysicsBoolean(value: unknown, fallback: boolean): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
        return true;
      }

      if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
        return false;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function sanitizePhysicsString(value: unknown, fallback: string): string {
  try {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

export function createPhysicsVector3(
  x: unknown,
  y: unknown,
  z: unknown,
  fallback: PhysicsVector3 = ZERO_PHYSICS_VECTOR,
): PhysicsVector3 {
  try {
    return {
      x: sanitizePhysicsNumber(x, fallback.x),
      y: sanitizePhysicsNumber(y, fallback.y),
      z: sanitizePhysicsNumber(z, fallback.z),
    };
  } catch {
    return { ...fallback };
  }
}

export function clonePhysicsVector3(value: PhysicsVector3): PhysicsVector3 {
  try {
    return {
      x: sanitizePhysicsNumber(value?.x, 0),
      y: sanitizePhysicsNumber(value?.y, 0),
      z: sanitizePhysicsNumber(value?.z, 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function addPhysicsVector3(a: PhysicsVector3, b: PhysicsVector3): PhysicsVector3 {
  try {
    return {
      x: sanitizePhysicsNumber(a.x, 0) + sanitizePhysicsNumber(b.x, 0),
      y: sanitizePhysicsNumber(a.y, 0) + sanitizePhysicsNumber(b.y, 0),
      z: sanitizePhysicsNumber(a.z, 0) + sanitizePhysicsNumber(b.z, 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function subtractPhysicsVector3(a: PhysicsVector3, b: PhysicsVector3): PhysicsVector3 {
  try {
    return {
      x: sanitizePhysicsNumber(a.x, 0) - sanitizePhysicsNumber(b.x, 0),
      y: sanitizePhysicsNumber(a.y, 0) - sanitizePhysicsNumber(b.y, 0),
      z: sanitizePhysicsNumber(a.z, 0) - sanitizePhysicsNumber(b.z, 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function scalePhysicsVector3(value: PhysicsVector3, scalar: unknown): PhysicsVector3 {
  try {
    const safeScalar = sanitizePhysicsNumber(scalar, 0);

    return {
      x: sanitizePhysicsNumber(value.x, 0) * safeScalar,
      y: sanitizePhysicsNumber(value.y, 0) * safeScalar,
      z: sanitizePhysicsNumber(value.z, 0) * safeScalar,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function lengthSquaredPhysicsVector3(value: PhysicsVector3): number {
  try {
    const x = sanitizePhysicsNumber(value.x, 0);
    const y = sanitizePhysicsNumber(value.y, 0);
    const z = sanitizePhysicsNumber(value.z, 0);

    return x * x + y * y + z * z;
  } catch {
    return 0;
  }
}

export function normalizePhysicsVector3(value: PhysicsVector3): PhysicsVector3 {
  try {
    const x = sanitizePhysicsNumber(value.x, 0);
    const y = sanitizePhysicsNumber(value.y, 0);
    const z = sanitizePhysicsNumber(value.z, 0);
    const length = Math.sqrt(x * x + y * y + z * z);

    if (!Number.isFinite(length) || length <= 0) {
      return { ...ZERO_PHYSICS_VECTOR };
    }

    return {
      x: x / length,
      y: y / length,
      z: z / length,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function clampPhysicsMagnitude2D(
  x: unknown,
  z: unknown,
  maxLength = 1,
): { readonly x: number; readonly z: number } {
  try {
    const safeX = sanitizePhysicsNumber(x, 0);
    const safeZ = sanitizePhysicsNumber(z, 0);
    const safeMax = Math.max(0, sanitizePhysicsNumber(maxLength, 1));
    const length = Math.sqrt(safeX * safeX + safeZ * safeZ);

    if (!Number.isFinite(length) || length <= 0 || length <= safeMax) {
      return { x: safeX, z: safeZ };
    }

    const factor = safeMax / length;

    return {
      x: safeX * factor,
      z: safeZ * factor,
    };
  } catch {
    return { x: 0, z: 0 };
  }
}

export function createPhysicsAabb(min: PhysicsVector3, max: PhysicsVector3): PhysicsAabb {
  try {
    const safeMin = clonePhysicsVector3(min);
    const safeMax = clonePhysicsVector3(max);

    return {
      min: {
        x: Math.min(safeMin.x, safeMax.x),
        y: Math.min(safeMin.y, safeMax.y),
        z: Math.min(safeMin.z, safeMax.z),
      },
      max: {
        x: Math.max(safeMin.x, safeMax.x),
        y: Math.max(safeMin.y, safeMax.y),
        z: Math.max(safeMin.z, safeMax.z),
      },
    };
  } catch {
    return {
      min: { ...ZERO_PHYSICS_VECTOR },
      max: { ...ZERO_PHYSICS_VECTOR },
    };
  }
}

export function createPlayerAabbFromPosition(
  position: PhysicsVector3,
  collider: PlayerAabbCollider,
): PhysicsAabb {
  try {
    const safePosition = clonePhysicsVector3(position);
    const width = Math.max(0.01, sanitizePhysicsNumber(collider.width, 0.6));
    const height = Math.max(0.01, sanitizePhysicsNumber(collider.height, 1.8));
    const halfWidth = width / 2;

    return createPhysicsAabb(
      {
        x: safePosition.x - halfWidth,
        y: safePosition.y,
        z: safePosition.z - halfWidth,
      },
      {
        x: safePosition.x + halfWidth,
        y: safePosition.y + height,
        z: safePosition.z + halfWidth,
      },
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function createEyePosition(
  bodyPosition: PhysicsVector3,
  collider: PlayerCollider,
): PhysicsVector3 {
  try {
    const safeBody = clonePhysicsVector3(bodyPosition);
    const eyeHeight =
      collider.kind === "aabb"
        ? sanitizePhysicsNumber(collider.eyeHeight, 1.62, { min: 0.01 })
        : 1.62;

    return {
      x: safeBody.x,
      y: safeBody.y + eyeHeight,
      z: safeBody.z,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function createPhysicsCameraBinding(
  player: PlayerPhysicsState,
  angles: PhysicsEulerAngles,
): PhysicsCameraBinding {
  try {
    const bodyPosition = clonePhysicsVector3(player.position);

    return {
      bodyPosition,
      eyePosition: createEyePosition(bodyPosition, player.collider),
      angles: {
        yaw: sanitizePhysicsNumber(angles.yaw, 0),
        pitch: sanitizePhysicsNumber(angles.pitch, 0),
        roll: sanitizePhysicsNumber(angles.roll, 0),
      },
    };
  } catch {
    return {
      bodyPosition: { ...ZERO_PHYSICS_VECTOR },
      eyePosition: { ...ZERO_PHYSICS_VECTOR },
      angles: { ...ZERO_PHYSICS_ANGLES },
    };
  }
}

export function normalizeMovementMode(value: unknown, fallback: PlayerMovementMode): PlayerMovementMode {
  try {
    if (value === "grounded" || value === "airborne" || value === "flying") {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function movementModeToFlying(mode: PlayerMovementMode): boolean {
  return mode === "flying";
}

export function createCollisionFlags(
  patch: Partial<CollisionFlags> = {},
): CollisionFlags {
  try {
    const hitWallX = sanitizePhysicsBoolean(patch.hitWallX, false);
    const hitWallZ = sanitizePhysicsBoolean(patch.hitWallZ, false);

    return {
      grounded: sanitizePhysicsBoolean(patch.grounded, false),
      hitCeiling: sanitizePhysicsBoolean(patch.hitCeiling, false),
      hitWallX,
      hitWallZ,
      hitHorizontalWall: sanitizePhysicsBoolean(
        patch.hitHorizontalWall,
        hitWallX || hitWallZ,
      ),
      touchedSolid: sanitizePhysicsBoolean(patch.touchedSolid, false),
      blockedByMissingChunk: sanitizePhysicsBoolean(patch.blockedByMissingChunk, false),
    };
  } catch {
    return { ...EMPTY_COLLISION_FLAGS };
  }
}

export function createPlayerPhysicsState(params: {
  readonly position: PhysicsVector3;
  readonly velocity?: PhysicsVector3;
  readonly movementMode?: PlayerMovementMode;
  readonly collider: PlayerCollider;
  readonly nowMs?: PhysicsTimestampMs | null;
  readonly collisionFlags?: Partial<CollisionFlags>;
  readonly revision?: number;
}): PlayerPhysicsState {
  try {
    const movementMode = normalizeMovementMode(params.movementMode, "airborne");
    const grounded = movementMode === "grounded";
    const flying = movementMode === "flying";
    const nowMs = isFinitePhysicsNumber(params.nowMs) ? params.nowMs : null;

    return {
      position: clonePhysicsVector3(params.position),
      velocity: clonePhysicsVector3(params.velocity ?? ZERO_PHYSICS_VECTOR),
      movementMode,
      grounded,
      flying,
      collider: params.collider,
      lastGroundedAtMs: grounded ? nowMs : null,
      lastJumpAtMs: null,
      lastFlightToggleAtMs: flying ? nowMs : null,
      collisionFlags: createCollisionFlags({
        ...params.collisionFlags,
        grounded,
      }),
      revision: Math.max(0, Math.floor(sanitizePhysicsNumber(params.revision, 0))),
    };
  } catch (cause) {
    const fallbackCollider: PlayerAabbCollider = {
      kind: "aabb",
      width: 0.6,
      height: 1.8,
      eyeHeight: 1.62,
      skinWidth: 0.001,
    };

    return {
      position: { ...ZERO_PHYSICS_VECTOR },
      velocity: { ...ZERO_PHYSICS_VECTOR },
      movementMode: "airborne",
      grounded: false,
      flying: false,
      collider: fallbackCollider,
      lastGroundedAtMs: null,
      lastJumpAtMs: null,
      lastFlightToggleAtMs: null,
      collisionFlags: { ...EMPTY_COLLISION_FLAGS },
      revision: 0,
    };
  }
}

export function patchPlayerPhysicsState(
  state: PlayerPhysicsState,
  patch: PhysicsStatePatch,
): PlayerPhysicsState {
  try {
    const movementMode = normalizeMovementMode(patch.movementMode, state.movementMode);
    const grounded = patch.grounded ?? movementMode === "grounded";
    const flying = patch.flying ?? movementMode === "flying";

    return {
      ...state,
      position: {
        x: sanitizePhysicsNumber(patch.position?.x, state.position.x),
        y: sanitizePhysicsNumber(patch.position?.y, state.position.y),
        z: sanitizePhysicsNumber(patch.position?.z, state.position.z),
      },
      velocity: {
        x: sanitizePhysicsNumber(patch.velocity?.x, state.velocity.x),
        y: sanitizePhysicsNumber(patch.velocity?.y, state.velocity.y),
        z: sanitizePhysicsNumber(patch.velocity?.z, state.velocity.z),
      },
      movementMode,
      grounded,
      flying,
      lastGroundedAtMs:
        patch.lastGroundedAtMs === undefined ? state.lastGroundedAtMs : patch.lastGroundedAtMs,
      lastJumpAtMs:
        patch.lastJumpAtMs === undefined ? state.lastJumpAtMs : patch.lastJumpAtMs,
      lastFlightToggleAtMs:
        patch.lastFlightToggleAtMs === undefined
          ? state.lastFlightToggleAtMs
          : patch.lastFlightToggleAtMs,
      collisionFlags: createCollisionFlags({
        ...state.collisionFlags,
        ...patch.collisionFlags,
        grounded,
      }),
      revision: state.revision + 1,
    };
  } catch {
    return {
      ...state,
      revision: state.revision + 1,
    };
  }
}

export function normalizeMovementIntent(
  value: Partial<PlayerMovementIntent> | null | undefined,
): PlayerMovementIntent {
  try {
    return {
      forward: sanitizePhysicsNumber(value?.forward, 0, { min: -1, max: 1 }),
      right: sanitizePhysicsNumber(value?.right, 0, { min: -1, max: 1 }),
      sprintHeld: sanitizePhysicsBoolean(value?.sprintHeld, false),
      jumpPressed: sanitizePhysicsBoolean(value?.jumpPressed, false),
      ascendHeld: sanitizePhysicsBoolean(value?.ascendHeld, false),
      descendHeld: sanitizePhysicsBoolean(value?.descendHeld, false),
      toggleFlightRequested: sanitizePhysicsBoolean(value?.toggleFlightRequested, false),
      debugNoClipRequested: sanitizePhysicsBoolean(value?.debugNoClipRequested, false),
    };
  } catch {
    return { ...EMPTY_PLAYER_MOVEMENT_INTENT };
  }
}

export function isSolidCollisionKind(kind: CollisionCellKind): boolean {
  try {
    return kind === "solid" || kind === "unknown";
  } catch {
    return true;
  }
}

export function createCollisionQueryResult(params: {
  readonly kind?: CollisionCellKind;
  readonly loaded?: boolean;
  readonly blockTypeId?: string | null;
  readonly policy?: CollisionResolutionPolicy;
} = {}): CollisionQueryResult {
  try {
    const kind = params.kind ?? "unknown";
    const loaded = sanitizePhysicsBoolean(params.loaded, false);
    const solid =
      params.policy === "treat_as_air"
        ? false
        : params.policy === "treat_as_solid"
          ? true
          : isSolidCollisionKind(kind);

    return {
      kind,
      solid,
      loaded,
      blockTypeId: params.blockTypeId ?? null,
      policy: params.policy,
    };
  } catch {
    return {
      kind: "unknown",
      solid: true,
      loaded: false,
      blockTypeId: null,
      policy: "block",
    };
  }
}