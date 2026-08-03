// src/frontend/camera/camera_movement_math.ts

import type {
  PhysicsEulerAngles,
  PhysicsVector3,
  PlayerMovementIntent,
} from "../runtime/physics/physics_models";

export interface Vector2Like {
  readonly x: number;
  readonly y: number;
}

export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MutableVector3Like {
  x: number;
  y: number;
  z: number;
}

export interface CameraAngles {
  /**
   * Horizontal rotation in radians.
   *
   * Three.js / FPS convention:
   * yaw = 0 looks toward world -Z.
   * positive yaw turns left toward -X.
   * negative yaw turns right toward +X.
   *
   * Mouse input is mapped so:
   * mouse right -> yaw decreases -> view turns right toward +X.
   */
  readonly yaw: number;

  /**
   * Vertical rotation in radians.
   *
   * Convention:
   * pitch > 0 looks upward.
   * pitch < 0 looks downward.
   *
   * Mouse input is mapped so:
   * mouse up   -> pitch increases.
   * mouse down -> pitch decreases.
   */
  readonly pitch: number;

  readonly roll: number;
}

export interface CameraEulerRotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly order: "YXZ";
}

export interface CameraMovementIntentLike {
  readonly forward?: number;
  readonly right?: number;
  readonly up?: number;
  readonly sprint?: boolean;
  readonly crouch?: boolean;
  readonly jump?: boolean;
  readonly active?: boolean;

  /**
   * Physics-oriented optional fields.
   * Legacy camera movement functions ignore flight toggling but can preserve
   * shape compatibility with EditorInputMovementIntent / PlayerMovementIntent.
   */
  readonly sprintHeld?: boolean;
  readonly jumpPressed?: boolean;
  readonly ascendHeld?: boolean;
  readonly descendHeld?: boolean;
  readonly toggleFlightRequested?: boolean;
  readonly debugNoClipRequested?: boolean;
}

export interface CameraLookOptions {
  readonly mouseSensitivityX?: number;
  readonly mouseSensitivityY?: number;
  readonly invertMouseX?: boolean;
  readonly invertMouseY?: boolean;
  readonly minPitchRadians?: number;
  readonly maxPitchRadians?: number;
  readonly normalizeYaw?: boolean;
}

export interface CameraMovementOptions {
  readonly movementSpeed?: number;
  readonly verticalMovementSpeed?: number;
  readonly sprintMultiplier?: number;
  readonly crouchMultiplier?: number;
  readonly deltaSeconds?: number;
  readonly maxDeltaSeconds?: number;

  /**
   * Legacy camera movement flag.
   *
   * New physics-based movement should generally keep direct camera movement off
   * and use PlayerPhysicsController instead.
   */
  readonly allowVerticalMovement?: boolean;

  readonly normalizeHorizontalDiagonal?: boolean;
}

export interface NormalizedMovementIntent {
  readonly forward: number;
  readonly right: number;
  readonly up: number;
  readonly sprint: boolean;
  readonly crouch: boolean;
  readonly jump: boolean;
  readonly active: boolean;

  readonly sprintHeld: boolean;
  readonly jumpPressed: boolean;
  readonly ascendHeld: boolean;
  readonly descendHeld: boolean;
  readonly toggleFlightRequested: boolean;
  readonly debugNoClipRequested: boolean;
}

export interface CameraLookUpdateResult {
  readonly angles: CameraAngles;
  readonly yawDelta: number;
  readonly pitchDelta: number;
  readonly appliedMouseDelta: Vector2Like;
}

export interface CameraMovementBasis {
  readonly forward: Vector3Like;
  readonly right: Vector3Like;
  readonly up: Vector3Like;
}

export interface CameraMovementVectorResult {
  readonly direction: Vector3Like;
  readonly horizontalDirection: Vector3Like;
  readonly verticalDirection: Vector3Like;
  readonly speedMultiplier: number;
  readonly horizontalMagnitude: number;
  readonly verticalMagnitude: number;
  readonly active: boolean;
}

export interface CameraMovementStepResult {
  readonly position: Vector3Like;
  readonly velocity: Vector3Like;
  readonly direction: Vector3Like;
  readonly speed: number;
  readonly deltaSeconds: number;
  readonly active: boolean;
}

export interface HorizontalYawMovementResult {
  readonly direction: Vector3Like;
  readonly forward: Vector3Like;
  readonly right: Vector3Like;
  readonly forwardAmount: number;
  readonly rightAmount: number;
  readonly active: boolean;
}

export const CAMERA_MOVEMENT_DEFAULTS = {
  mouseSensitivityX: 0.0025,
  mouseSensitivityY: 0.0025,
  minPitchRadians: -Math.PI / 2 + 0.001,
  maxPitchRadians: Math.PI / 2 - 0.001,
  movementSpeed: 5,
  verticalMovementSpeed: 5,
  sprintMultiplier: 2.4,
  crouchMultiplier: 0.45,
  maxDeltaSeconds: 0.1,
} as const;

export const WORLD_UP: Vector3Like = Object.freeze({
  x: 0,
  y: 1,
  z: 0,
});

export const ZERO_VECTOR_3: Vector3Like = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
});

export const ZERO_VECTOR_2: Vector2Like = Object.freeze({
  x: 0,
  y: 0,
});

export const DEFAULT_CAMERA_ANGLES: CameraAngles = Object.freeze({
  yaw: 0,
  pitch: 0,
  roll: 0,
});

function finiteNumber(value: unknown, fallback: number): number {
  try {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseFloat(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function finiteBoolean(value: unknown, fallback: boolean): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
        return true;
      }

      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
        return false;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function clampNumber(value: number, min: number, max: number): number {
  try {
    const safeValue = Number.isFinite(value) ? value : 0;
    const safeMin = Number.isFinite(min) ? min : safeValue;
    const safeMax = Number.isFinite(max) ? max : safeValue;
    const lower = Math.min(safeMin, safeMax);
    const upper = Math.max(safeMin, safeMax);

    return Math.min(upper, Math.max(lower, safeValue));
  } catch {
    return 0;
  }
}

function normalizeAxis(value: unknown): number {
  try {
    return clampNumber(finiteNumber(value, 0), -1, 1);
  } catch {
    return 0;
  }
}

function vectorLength3(vector: Vector3Like): number {
  try {
    return Math.hypot(
      finiteNumber(vector.x, 0),
      finiteNumber(vector.y, 0),
      finiteNumber(vector.z, 0),
    );
  } catch {
    return 0;
  }
}

function createVector3(x: unknown, y: unknown, z: unknown): Vector3Like {
  return {
    x: finiteNumber(x, 0),
    y: finiteNumber(y, 0),
    z: finiteNumber(z, 0),
  };
}

function createVector2(x: unknown, y: unknown): Vector2Like {
  return {
    x: finiteNumber(x, 0),
    y: finiteNumber(y, 0),
  };
}

function cross(left: Vector3Like, right: Vector3Like): Vector3Like {
  try {
    return {
      x: finiteNumber(left.y, 0) * finiteNumber(right.z, 0) - finiteNumber(left.z, 0) * finiteNumber(right.y, 0),
      y: finiteNumber(left.z, 0) * finiteNumber(right.x, 0) - finiteNumber(left.x, 0) * finiteNumber(right.z, 0),
      z: finiteNumber(left.x, 0) * finiteNumber(right.y, 0) - finiteNumber(left.y, 0) * finiteNumber(right.x, 0),
    };
  } catch {
    return ZERO_VECTOR_3;
  }
}

export function degreesToRadians(degrees: number): number {
  try {
    return finiteNumber(degrees, 0) * (Math.PI / 180);
  } catch {
    return 0;
  }
}

export function radiansToDegrees(radians: number): number {
  try {
    return finiteNumber(radians, 0) * (180 / Math.PI);
  } catch {
    return 0;
  }
}

export function normalizeAngleRadians(angle: number): number {
  try {
    const twoPi = Math.PI * 2;
    const value = finiteNumber(angle, 0);

    if (value === 0) {
      return 0;
    }

    let normalized = value % twoPi;

    if (normalized > Math.PI) {
      normalized -= twoPi;
    }

    if (normalized < -Math.PI) {
      normalized += twoPi;
    }

    return normalized;
  } catch {
    return 0;
  }
}

export function clampPitchRadians(
  pitch: number,
  minPitchRadians = CAMERA_MOVEMENT_DEFAULTS.minPitchRadians,
  maxPitchRadians = CAMERA_MOVEMENT_DEFAULTS.maxPitchRadians,
): number {
  try {
    const min = finiteNumber(minPitchRadians, CAMERA_MOVEMENT_DEFAULTS.minPitchRadians);
    const max = finiteNumber(maxPitchRadians, CAMERA_MOVEMENT_DEFAULTS.maxPitchRadians);

    return clampNumber(finiteNumber(pitch, 0), min, max);
  } catch {
    return 0;
  }
}

export function normalizeCameraAngles(input: Partial<CameraAngles> | null | undefined): CameraAngles {
  try {
    return {
      yaw: normalizeAngleRadians(finiteNumber(input?.yaw, DEFAULT_CAMERA_ANGLES.yaw)),
      pitch: clampPitchRadians(finiteNumber(input?.pitch, DEFAULT_CAMERA_ANGLES.pitch)),
      roll: finiteNumber(input?.roll, DEFAULT_CAMERA_ANGLES.roll),
    };
  } catch {
    return DEFAULT_CAMERA_ANGLES;
  }
}

export function cameraAnglesFromPhysicsAngles(input: Partial<PhysicsEulerAngles> | null | undefined): CameraAngles {
  try {
    return normalizeCameraAngles({
      yaw: input?.yaw,
      pitch: input?.pitch,
      roll: input?.roll,
    });
  } catch {
    return DEFAULT_CAMERA_ANGLES;
  }
}

export function physicsAnglesFromCameraAngles(input: Partial<CameraAngles> | null | undefined): PhysicsEulerAngles {
  try {
    const angles = normalizeCameraAngles(input);

    return {
      yaw: angles.yaw,
      pitch: angles.pitch,
      roll: angles.roll,
    };
  } catch {
    return {
      yaw: 0,
      pitch: 0,
      roll: 0,
    };
  }
}

export function normalizeMovementIntent(intent: CameraMovementIntentLike | null | undefined): NormalizedMovementIntent {
  try {
    const forward = normalizeAxis(intent?.forward);
    const right = normalizeAxis(intent?.right);
    const ascendHeld = finiteBoolean(intent?.ascendHeld, false);
    const descendHeld = finiteBoolean(intent?.descendHeld, false);
    const up = normalizeAxis(intent?.up ?? ((ascendHeld ? 1 : 0) - (descendHeld ? 1 : 0)));
    const sprint = finiteBoolean(intent?.sprint ?? intent?.sprintHeld, false);
    const crouch = finiteBoolean(intent?.crouch, false);
    const jump = finiteBoolean(intent?.jump, false);
    const jumpPressed = finiteBoolean(intent?.jumpPressed, false);
    const toggleFlightRequested = finiteBoolean(intent?.toggleFlightRequested, false);
    const debugNoClipRequested = finiteBoolean(intent?.debugNoClipRequested, false);

    return {
      forward,
      right,
      up,
      sprint,
      crouch,
      jump,
      active: finiteBoolean(
        intent?.active,
        forward !== 0
          || right !== 0
          || up !== 0
          || sprint
          || crouch
          || jump
          || jumpPressed
          || ascendHeld
          || descendHeld
          || toggleFlightRequested
          || debugNoClipRequested,
      ),
      sprintHeld: sprint,
      jumpPressed,
      ascendHeld,
      descendHeld,
      toggleFlightRequested,
      debugNoClipRequested,
    };
  } catch {
    return {
      forward: 0,
      right: 0,
      up: 0,
      sprint: false,
      crouch: false,
      jump: false,
      active: false,
      sprintHeld: false,
      jumpPressed: false,
      ascendHeld: false,
      descendHeld: false,
      toggleFlightRequested: false,
      debugNoClipRequested: false,
    };
  }
}

export function playerMovementIntentFromCameraIntent(intent: CameraMovementIntentLike | null | undefined): PlayerMovementIntent {
  try {
    const normalized = normalizeMovementIntent(intent);

    return {
      forward: normalized.forward,
      right: normalized.right,
      sprintHeld: normalized.sprintHeld,
      jumpPressed: normalized.jumpPressed,
      ascendHeld: normalized.ascendHeld || normalized.up > 0,
      descendHeld: normalized.descendHeld || normalized.up < 0,
      toggleFlightRequested: normalized.toggleFlightRequested,
      debugNoClipRequested: normalized.debugNoClipRequested,
    };
  } catch {
    return {
      forward: 0,
      right: 0,
      sprintHeld: false,
      jumpPressed: false,
      ascendHeld: false,
      descendHeld: false,
      toggleFlightRequested: false,
      debugNoClipRequested: false,
    };
  }
}

export function normalizeVector3(vector: Vector3Like | null | undefined): Vector3Like {
  try {
    const value = createVector3(vector?.x, vector?.y, vector?.z);
    const length = vectorLength3(value);

    if (length <= 0.000001) {
      return ZERO_VECTOR_3;
    }

    return {
      x: value.x / length,
      y: value.y / length,
      z: value.z / length,
    };
  } catch {
    return ZERO_VECTOR_3;
  }
}

export function addVector3(left: Vector3Like, right: Vector3Like): Vector3Like {
  try {
    return {
      x: finiteNumber(left.x, 0) + finiteNumber(right.x, 0),
      y: finiteNumber(left.y, 0) + finiteNumber(right.y, 0),
      z: finiteNumber(left.z, 0) + finiteNumber(right.z, 0),
    };
  } catch {
    return ZERO_VECTOR_3;
  }
}

export function subtractVector3(left: Vector3Like, right: Vector3Like): Vector3Like {
  try {
    return {
      x: finiteNumber(left.x, 0) - finiteNumber(right.x, 0),
      y: finiteNumber(left.y, 0) - finiteNumber(right.y, 0),
      z: finiteNumber(left.z, 0) - finiteNumber(right.z, 0),
    };
  } catch {
    return ZERO_VECTOR_3;
  }
}

export function scaleVector3(vector: Vector3Like, scalar: number): Vector3Like {
  try {
    const safeScalar = finiteNumber(scalar, 0);

    return {
      x: finiteNumber(vector.x, 0) * safeScalar,
      y: finiteNumber(vector.y, 0) * safeScalar,
      z: finiteNumber(vector.z, 0) * safeScalar,
    };
  } catch {
    return ZERO_VECTOR_3;
  }
}

export function getPlanarForwardVectorFromYaw(yaw: number): Vector3Like {
  try {
    const safeYaw = finiteNumber(yaw, 0);

    /**
     * Three.js camera convention:
     * camera.rotation.order = "YXZ"
     * camera.rotation.y = yaw
     * local camera forward is -Z.
     *
     * yaw = 0      -> world -Z
     * yaw = +90deg -> world -X
     * yaw = -90deg -> world +X
     */
    return normalizeVector3({
      x: -Math.sin(safeYaw),
      y: 0,
      z: -Math.cos(safeYaw),
    });
  } catch {
    return {
      x: 0,
      y: 0,
      z: -1,
    };
  }
}

export function getPlanarRightVectorFromYaw(yaw: number): Vector3Like {
  try {
    const safeYaw = finiteNumber(yaw, 0);

    /**
     * World-space camera right vector for the same Three.js YXZ yaw convention.
     *
     * yaw = 0      -> world +X
     * yaw = +90deg -> world -Z
     * yaw = -90deg -> world +Z
     */
    return normalizeVector3({
      x: Math.cos(safeYaw),
      y: 0,
      z: -Math.sin(safeYaw),
    });
  } catch {
    return {
      x: 1,
      y: 0,
      z: 0,
    };
  }
}

export function getCameraForwardVectorFromAngles(angles: Partial<CameraAngles> | null | undefined): Vector3Like {
  try {
    const normalized = normalizeCameraAngles(angles);
    const cosPitch = Math.cos(normalized.pitch);

    return normalizeVector3({
      x: -Math.sin(normalized.yaw) * cosPitch,
      y: Math.sin(normalized.pitch),
      z: -Math.cos(normalized.yaw) * cosPitch,
    });
  } catch {
    return {
      x: 0,
      y: 0,
      z: -1,
    };
  }
}

export function getCameraRightVectorFromAngles(angles: Partial<CameraAngles> | null | undefined): Vector3Like {
  try {
    const forward = getCameraForwardVectorFromAngles(angles);
    return normalizeVector3(cross(forward, WORLD_UP));
  } catch {
    return {
      x: 1,
      y: 0,
      z: 0,
    };
  }
}

export function getCameraUpVectorFromAngles(angles: Partial<CameraAngles> | null | undefined): Vector3Like {
  try {
    const forward = getCameraForwardVectorFromAngles(angles);
    const right = getCameraRightVectorFromAngles(angles);
    return normalizeVector3(cross(right, forward));
  } catch {
    return WORLD_UP;
  }
}

export function getCameraMovementBasis(yaw: number): CameraMovementBasis {
  try {
    return {
      forward: getPlanarForwardVectorFromYaw(yaw),
      right: getPlanarRightVectorFromYaw(yaw),
      up: WORLD_UP,
    };
  } catch {
    return {
      forward: {
        x: 0,
        y: 0,
        z: -1,
      },
      right: {
        x: 1,
        y: 0,
        z: 0,
      },
      up: WORLD_UP,
    };
  }
}

export function getCameraLookBasis(angles: Partial<CameraAngles> | null | undefined): CameraMovementBasis {
  try {
    return {
      forward: getCameraForwardVectorFromAngles(angles),
      right: getCameraRightVectorFromAngles(angles),
      up: getCameraUpVectorFromAngles(angles),
    };
  } catch {
    return {
      forward: {
        x: 0,
        y: 0,
        z: -1,
      },
      right: {
        x: 1,
        y: 0,
        z: 0,
      },
      up: WORLD_UP,
    };
  }
}

export function updateCameraAnglesFromMouseDelta(
  currentAngles: Partial<CameraAngles> | null | undefined,
  mouseDelta: Partial<Vector2Like> | null | undefined,
  options?: CameraLookOptions,
): CameraLookUpdateResult {
  try {
    const current = normalizeCameraAngles(currentAngles);
    const delta = createVector2(mouseDelta?.x, mouseDelta?.y);

    const sensitivityX = finiteNumber(
      options?.mouseSensitivityX,
      CAMERA_MOVEMENT_DEFAULTS.mouseSensitivityX,
    );
    const sensitivityY = finiteNumber(
      options?.mouseSensitivityY,
      CAMERA_MOVEMENT_DEFAULTS.mouseSensitivityY,
    );

    const invertMouseX = finiteBoolean(options?.invertMouseX, false);
    const invertMouseY = finiteBoolean(options?.invertMouseY, false);
    const normalizeYaw = finiteBoolean(options?.normalizeYaw, true);

    /**
     * Browser pointer convention:
     * movementX > 0 means mouse moved right.
     * movementY > 0 means mouse moved down.
     *
     * Three.js camera yaw convention:
     * yaw decreasing turns view right.
     * yaw increasing turns view left.
     *
     * Desired FPS convention:
     * mouse right -> look right  -> yaw decreases.
     * mouse left  -> look left   -> yaw increases.
     * mouse up    -> look up     -> pitch increases.
     * mouse down  -> look down   -> pitch decreases.
     */
    const yawDelta = delta.x * sensitivityX * (invertMouseX ? 1 : -1);
    const pitchDelta = delta.y * sensitivityY * (invertMouseY ? 1 : -1);

    const nextYawRaw = current.yaw + yawDelta;
    const nextPitchRaw = current.pitch + pitchDelta;

    const nextAngles: CameraAngles = {
      yaw: normalizeYaw ? normalizeAngleRadians(nextYawRaw) : nextYawRaw,
      pitch: clampPitchRadians(
        nextPitchRaw,
        options?.minPitchRadians,
        options?.maxPitchRadians,
      ),
      roll: current.roll,
    };

    return {
      angles: nextAngles,
      yawDelta: normalizeYaw
        ? normalizeAngleRadians(nextAngles.yaw - current.yaw)
        : yawDelta,
      pitchDelta: nextAngles.pitch - current.pitch,
      appliedMouseDelta: delta,
    };
  } catch {
    return {
      angles: normalizeCameraAngles(currentAngles),
      yawDelta: 0,
      pitchDelta: 0,
      appliedMouseDelta: ZERO_VECTOR_2,
    };
  }
}

export function movementSpeedMultiplier(
  intent: CameraMovementIntentLike | null | undefined,
  options?: CameraMovementOptions,
): number {
  try {
    const normalized = normalizeMovementIntent(intent);
    const sprintMultiplier = finiteNumber(
      options?.sprintMultiplier,
      CAMERA_MOVEMENT_DEFAULTS.sprintMultiplier,
    );
    const crouchMultiplier = finiteNumber(
      options?.crouchMultiplier,
      CAMERA_MOVEMENT_DEFAULTS.crouchMultiplier,
    );

    if (normalized.crouch) {
      return Math.max(0, crouchMultiplier);
    }

    if (normalized.sprint || normalized.sprintHeld) {
      return Math.max(0, sprintMultiplier);
    }

    return 1;
  } catch {
    return 1;
  }
}

export function movementVectorFromYaw(
  yaw: number,
  intent: CameraMovementIntentLike | null | undefined,
  options?: CameraMovementOptions,
): CameraMovementVectorResult {
  try {
    const normalized = normalizeMovementIntent(intent);
    const basis = getCameraMovementBasis(yaw);

    const forwardAxis = normalized.forward;
    const rightAxis = normalized.right;

    const horizontal = addVector3(
      scaleVector3(basis.forward, forwardAxis),
      scaleVector3(basis.right, rightAxis),
    );

    const horizontalMagnitude = vectorLength3(horizontal);
    const normalizeHorizontalDiagonal = finiteBoolean(options?.normalizeHorizontalDiagonal, true);

    const horizontalDirection = horizontalMagnitude > 0.000001
      ? normalizeHorizontalDiagonal
        ? normalizeVector3(horizontal)
        : horizontal
      : ZERO_VECTOR_3;

    const allowVerticalMovement = finiteBoolean(options?.allowVerticalMovement, true);
    const verticalAxis = allowVerticalMovement ? normalized.up : 0;

    const verticalDirection = verticalAxis !== 0
      ? scaleVector3(WORLD_UP, verticalAxis)
      : ZERO_VECTOR_3;

    const combined = addVector3(horizontalDirection, verticalDirection);
    const direction = normalizeVector3(combined);

    return {
      direction,
      horizontalDirection,
      verticalDirection,
      speedMultiplier: movementSpeedMultiplier(normalized, options),
      horizontalMagnitude,
      verticalMagnitude: Math.abs(verticalAxis),
      active: normalized.active && vectorLength3(combined) > 0.000001,
    };
  } catch {
    return {
      direction: ZERO_VECTOR_3,
      horizontalDirection: ZERO_VECTOR_3,
      verticalDirection: ZERO_VECTOR_3,
      speedMultiplier: 1,
      horizontalMagnitude: 0,
      verticalMagnitude: 0,
      active: false,
    };
  }
}

export function horizontalYawMovementFromPlayerIntent(
  yaw: number,
  intent: PlayerMovementIntent | CameraMovementIntentLike | null | undefined,
): HorizontalYawMovementResult {
  try {
    const normalized = normalizeMovementIntent(intent);
    const forward = getPlanarForwardVectorFromYaw(yaw);
    const right = getPlanarRightVectorFromYaw(yaw);

    const horizontal = addVector3(
      scaleVector3(forward, normalized.forward),
      scaleVector3(right, normalized.right),
    );

    const direction = vectorLength3(horizontal) > 0.000001
      ? normalizeVector3(horizontal)
      : ZERO_VECTOR_3;

    return {
      direction,
      forward,
      right,
      forwardAmount: normalized.forward,
      rightAmount: normalized.right,
      active: vectorLength3(direction) > 0.000001,
    };
  } catch {
    return {
      direction: ZERO_VECTOR_3,
      forward: {
        x: 0,
        y: 0,
        z: -1,
      },
      right: {
        x: 1,
        y: 0,
        z: 0,
      },
      forwardAmount: 0,
      rightAmount: 0,
      active: false,
    };
  }
}

export function applyCameraMovementStep(
  currentPosition: Vector3Like,
  yaw: number,
  intent: CameraMovementIntentLike | null | undefined,
  options?: CameraMovementOptions,
): CameraMovementStepResult {
  try {
    const position = createVector3(currentPosition.x, currentPosition.y, currentPosition.z);
    const vector = movementVectorFromYaw(yaw, intent, options);

    const movementSpeed = finiteNumber(
      options?.movementSpeed,
      CAMERA_MOVEMENT_DEFAULTS.movementSpeed,
    );
    const verticalMovementSpeed = finiteNumber(
      options?.verticalMovementSpeed,
      CAMERA_MOVEMENT_DEFAULTS.verticalMovementSpeed,
    );
    const maxDeltaSeconds = finiteNumber(
      options?.maxDeltaSeconds,
      CAMERA_MOVEMENT_DEFAULTS.maxDeltaSeconds,
    );

    const deltaSeconds = clampNumber(
      finiteNumber(options?.deltaSeconds, 0),
      0,
      Math.max(0, maxDeltaSeconds),
    );

    const horizontalVelocity = scaleVector3(
      vector.horizontalDirection,
      movementSpeed * vector.speedMultiplier,
    );

    const verticalVelocity = scaleVector3(
      vector.verticalDirection,
      verticalMovementSpeed * vector.speedMultiplier,
    );

    const velocity = addVector3(horizontalVelocity, verticalVelocity);

    return {
      position: {
        x: position.x + velocity.x * deltaSeconds,
        y: position.y + velocity.y * deltaSeconds,
        z: position.z + velocity.z * deltaSeconds,
      },
      velocity,
      direction: vector.direction,
      speed: vectorLength3(velocity),
      deltaSeconds,
      active: vector.active,
    };
  } catch {
    return {
      position: createVector3(currentPosition?.x, currentPosition?.y, currentPosition?.z),
      velocity: ZERO_VECTOR_3,
      direction: ZERO_VECTOR_3,
      speed: 0,
      deltaSeconds: 0,
      active: false,
    };
  }
}

export function cameraEulerFromAngles(angles: Partial<CameraAngles> | null | undefined): CameraEulerRotation {
  try {
    const normalized = normalizeCameraAngles(angles);

    /**
     * Three.js FPS convention:
     * camera.rotation.order = "YXZ"
     * camera.rotation.y = yaw
     * camera.rotation.x = pitch
     */
    return {
      x: normalized.pitch,
      y: normalized.yaw,
      z: normalized.roll,
      order: "YXZ",
    };
  } catch {
    return {
      x: 0,
      y: 0,
      z: 0,
      order: "YXZ",
    };
  }
}

export function cameraAnglesFromEuler(rotation: Partial<CameraEulerRotation> | null | undefined): CameraAngles {
  try {
    return normalizeCameraAngles({
      pitch: rotation?.x,
      yaw: rotation?.y,
      roll: rotation?.z,
    });
  } catch {
    return DEFAULT_CAMERA_ANGLES;
  }
}

export function copyVector3ToMutable(
  source: Vector3Like,
  target: MutableVector3Like,
): MutableVector3Like {
  try {
    target.x = finiteNumber(source.x, 0);
    target.y = finiteNumber(source.y, 0);
    target.z = finiteNumber(source.z, 0);

    return target;
  } catch {
    return target;
  }
}

export function vectorsNearlyEqual(
  left: Vector3Like,
  right: Vector3Like,
  epsilon = 0.000001,
): boolean {
  try {
    const tolerance = Math.max(0, finiteNumber(epsilon, 0.000001));

    return (
      Math.abs(finiteNumber(left.x, 0) - finiteNumber(right.x, 0)) <= tolerance
      && Math.abs(finiteNumber(left.y, 0) - finiteNumber(right.y, 0)) <= tolerance
      && Math.abs(finiteNumber(left.z, 0) - finiteNumber(right.z, 0)) <= tolerance
    );
  } catch {
    return false;
  }
}

export function anglesNearlyEqual(
  left: Partial<CameraAngles> | null | undefined,
  right: Partial<CameraAngles> | null | undefined,
  epsilon = 0.000001,
): boolean {
  try {
    const a = normalizeCameraAngles(left);
    const b = normalizeCameraAngles(right);
    const tolerance = Math.max(0, finiteNumber(epsilon, 0.000001));

    return (
      Math.abs(a.yaw - b.yaw) <= tolerance
      && Math.abs(a.pitch - b.pitch) <= tolerance
      && Math.abs(a.roll - b.roll) <= tolerance
    );
  } catch {
    return false;
  }
}