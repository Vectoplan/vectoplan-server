// src/frontend/camera/camera_state.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type {
  PhysicsCameraBinding,
  PhysicsEulerAngles,
  PhysicsVector3,
} from "../runtime/physics/physics_models";

export type CameraMode =
  | "first-person";

export type CameraStateStatus =
  | "created"
  | "ready"
  | "updating"
  | "failed"
  | "destroyed";

export type CameraPositionSource =
  | "camera-state"
  | "player-physics"
  | "runtime-binding"
  | "reset"
  | "unknown";

export interface CameraVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CameraEuler3 {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
}

export interface CameraBasis {
  readonly forward: CameraVector3;
  readonly right: CameraVector3;
  readonly up: CameraVector3;
}

export interface CameraProjectionState {
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly aspect: number;
}

export interface CameraMovementState {
  /**
   * Legacy movement values.
   *
   * With the physics system enabled, these values are not the source of
   * physical movement anymore. They remain for compatibility, UI display and
   * older debug tooling.
   */
  readonly moveSpeed: number;
  readonly sprintMultiplier: number;
  readonly isSprinting: boolean;
  readonly velocity: CameraVector3;
}

export interface CameraFollowState {
  readonly enabled: boolean;
  readonly source: CameraPositionSource;
  readonly bodyPosition: CameraVector3 | null;
  readonly eyePosition: CameraVector3 | null;
  readonly lastBindingAt: string | null;
  readonly lastBindingReason: string | null;
}

export interface CameraStateSnapshot {
  readonly kind: "camera-state-snapshot.v1";
  readonly status: CameraStateStatus;
  readonly mode: CameraMode;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly position: CameraVector3;
  readonly rotation: CameraEuler3;
  readonly projection: CameraProjectionState;
  readonly movement: CameraMovementState;
  readonly follow: CameraFollowState;
  readonly basis: CameraBasis;
  readonly lastError: Record<string, unknown> | null;
}

export interface CreateCameraStateOptions {
  readonly logger?: EditorLogger;
  readonly mode?: CameraMode;
  readonly position?: Partial<CameraVector3>;
  readonly rotation?: Partial<CameraEuler3>;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly aspect?: number;
  readonly moveSpeed?: number;
  readonly sprintMultiplier?: number;

  /**
   * When true, the camera is expected to follow a player/physics binding.
   * This does not move the camera by itself; SceneRuntime must call
   * applyPhysicsCameraBinding(...) each frame.
   */
  readonly followPlayerPhysics?: boolean;
}

export interface CameraStateSetOptions {
  readonly reason?: string;
  readonly source?: CameraPositionSource;
}

export interface CameraStateHandle {
  readonly kind: "vectoplan-editor-camera-state.v1";

  getStatus(): CameraStateStatus;
  getSnapshot(): CameraStateSnapshot;

  getPosition(): CameraVector3;
  setPosition(position: Partial<CameraVector3>, options?: CameraStateSetOptions): CameraStateSnapshot;
  translate(delta: Partial<CameraVector3>, options?: CameraStateSetOptions): CameraStateSnapshot;

  getRotation(): CameraEuler3;
  setRotation(rotation: Partial<CameraEuler3>, options?: CameraStateSetOptions): CameraStateSnapshot;
  rotate(delta: Partial<CameraEuler3>, options?: CameraStateSetOptions): CameraStateSnapshot;

  /**
   * Physics-compatible binding:
   * - bodyPosition = physical player base/body position
   * - eyePosition = camera/render position
   * - angles = yaw/pitch/roll
   */
  applyPhysicsCameraBinding(binding: PhysicsCameraBinding, options?: CameraStateSetOptions): CameraStateSnapshot;
  setEyePosition(position: Partial<CameraVector3>, options?: CameraStateSetOptions): CameraStateSnapshot;
  setLookAngles(angles: Partial<CameraEuler3>, options?: CameraStateSetOptions): CameraStateSnapshot;

  getProjection(): CameraProjectionState;
  setProjection(projection: Partial<CameraProjectionState>, options?: CameraStateSetOptions): CameraStateSnapshot;
  setAspect(aspect: number, options?: CameraStateSetOptions): CameraStateSnapshot;

  getMovement(): CameraMovementState;
  setMovement(movement: Partial<Omit<CameraMovementState, "velocity">> & { readonly velocity?: Partial<CameraVector3> }, options?: CameraStateSetOptions): CameraStateSnapshot;
  setSprinting(isSprinting: boolean, options?: CameraStateSetOptions): CameraStateSnapshot;

  getFollow(): CameraFollowState;
  setFollowEnabled(enabled: boolean, options?: CameraStateSetOptions): CameraStateSnapshot;

  getBasis(): CameraBasis;
  reset(options?: CameraStateSetOptions): CameraStateSnapshot;

  destroy(reason?: string): void;
}

const CAMERA_STATE_KIND = "vectoplan-editor-camera-state.v1" as const;
const CAMERA_STATE_SNAPSHOT_KIND = "camera-state-snapshot.v1" as const;

const DEFAULT_POSITION: CameraVector3 = {
  x: 8,
  y: 4,
  z: 18,
};

const DEFAULT_ROTATION: CameraEuler3 = {
  pitch: 0,
  yaw: Math.PI,
  roll: 0,
};

const DEFAULT_PROJECTION: CameraProjectionState = {
  fov: 65,
  near: 0.05,
  far: 1_000,
  aspect: 1,
};

const DEFAULT_MOVEMENT: CameraMovementState = {
  moveSpeed: 5.5,
  sprintMultiplier: 2.4,
  isSprinting: false,
  velocity: {
    x: 0,
    y: 0,
    z: 0,
  },
};

const DEFAULT_FOLLOW: CameraFollowState = {
  enabled: false,
  source: "camera-state",
  bodyPosition: null,
  eyePosition: null,
  lastBindingAt: null,
  lastBindingReason: null,
};

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "1970-01-01T00:00:00.000Z";
    }
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
    // Camera logging must never break runtime.
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
    // Camera logging must never break runtime.
  }
}

function normalizeErrorRecord(error: unknown): Record<string, unknown> {
  try {
    const normalized = normalizeUnknownError(error);

    if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
      return normalized as Record<string, unknown>;
    }

    return {
      name: "UnknownError",
      message: String(normalized),
    };
  } catch {
    try {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
        };
      }

      return {
        name: "UnknownError",
        message: String(error),
      };
    } catch {
      return {
        name: "UnknownError",
        message: "Unknown camera state error.",
      };
    }
  }
}

function normalizeMode(value: unknown): CameraMode {
  const mode = safeString(value, "first-person");

  return mode === "first-person" ? "first-person" : "first-person";
}

function normalizePositionSource(value: unknown, fallback: CameraPositionSource): CameraPositionSource {
  const source = safeString(value, fallback);

  if (
    source === "camera-state"
    || source === "player-physics"
    || source === "runtime-binding"
    || source === "reset"
    || source === "unknown"
  ) {
    return source;
  }

  return fallback;
}

function normalizeAngle(value: unknown, fallback: number, min: number, max: number): number {
  try {
    return safeNumber(value, fallback, {
      min,
      max,
    });
  } catch {
    return fallback;
  }
}

function normalizePosition(value: Partial<CameraVector3> | undefined | null, fallback: CameraVector3): CameraVector3 {
  return {
    x: safeNumber(value?.x, fallback.x, {
      min: -1_000_000,
      max: 1_000_000,
    }),
    y: safeNumber(value?.y, fallback.y, {
      min: -1_000_000,
      max: 1_000_000,
    }),
    z: safeNumber(value?.z, fallback.z, {
      min: -1_000_000,
      max: 1_000_000,
    }),
  };
}

function normalizeRotation(value: Partial<CameraEuler3> | undefined | null, fallback: CameraEuler3): CameraEuler3 {
  return {
    pitch: normalizeAngle(value?.pitch, fallback.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001),
    yaw: normalizeAngle(value?.yaw, fallback.yaw, -Math.PI * 10, Math.PI * 10),
    roll: normalizeAngle(value?.roll, fallback.roll, -Math.PI * 2, Math.PI * 2),
  };
}

function normalizePhysicsVector(value: Partial<PhysicsVector3> | undefined | null, fallback: CameraVector3): CameraVector3 {
  try {
    return normalizePosition(value, fallback);
  } catch {
    return fallback;
  }
}

function normalizePhysicsAngles(value: Partial<PhysicsEulerAngles> | undefined | null, fallback: CameraEuler3): CameraEuler3 {
  try {
    return normalizeRotation(
      {
        pitch: value?.pitch,
        yaw: value?.yaw,
        roll: value?.roll,
      },
      fallback,
    );
  } catch {
    return fallback;
  }
}

function normalizeProjection(value: Partial<CameraProjectionState> | undefined, fallback: CameraProjectionState): CameraProjectionState {
  const near = safeNumber(value?.near, fallback.near, {
    min: 0.001,
    max: 10_000,
  });
  const far = Math.max(
    near + 1,
    safeNumber(value?.far, fallback.far, {
      min: near + 1,
      max: 1_000_000,
    }),
  );

  return {
    fov: safeNumber(value?.fov, fallback.fov, {
      min: 10,
      max: 140,
    }),
    near,
    far,
    aspect: safeNumber(value?.aspect, fallback.aspect, {
      min: 0.01,
      max: 100,
    }),
  };
}

function normalizeMovement(
  value: Partial<Omit<CameraMovementState, "velocity">> & { readonly velocity?: Partial<CameraVector3> } | undefined,
  fallback: CameraMovementState,
): CameraMovementState {
  return {
    moveSpeed: safeNumber(value?.moveSpeed, fallback.moveSpeed, {
      min: 0,
      max: 10_000,
    }),
    sprintMultiplier: safeNumber(value?.sprintMultiplier, fallback.sprintMultiplier, {
      min: 1,
      max: 100,
    }),
    isSprinting: safeBoolean(value?.isSprinting, fallback.isSprinting),
    velocity: normalizePosition(value?.velocity, fallback.velocity),
  };
}

function normalizeYaw(value: number): number {
  try {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const twoPi = Math.PI * 2;
    let next = value % twoPi;

    if (next > Math.PI) {
      next -= twoPi;
    }

    if (next < -Math.PI) {
      next += twoPi;
    }

    return next;
  } catch {
    return 0;
  }
}

function normalizeCameraRotation(rotation: CameraEuler3): CameraEuler3 {
  return {
    pitch: normalizeAngle(rotation.pitch, 0, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001),
    yaw: normalizeYaw(rotation.yaw),
    roll: normalizeAngle(rotation.roll, 0, -Math.PI * 2, Math.PI * 2),
  };
}

function vectorLength(value: CameraVector3): number {
  try {
    return Math.hypot(value.x, value.y, value.z);
  } catch {
    return 0;
  }
}

function normalizeVector(value: CameraVector3, fallback: CameraVector3): CameraVector3 {
  try {
    const length = vectorLength(value);

    if (!Number.isFinite(length) || length <= 0.000001) {
      return fallback;
    }

    return {
      x: value.x / length,
      y: value.y / length,
      z: value.z / length,
    };
  } catch {
    return fallback;
  }
}

function cross(left: CameraVector3, right: CameraVector3): CameraVector3 {
  return {
    x: (left.y * right.z) - (left.z * right.y),
    y: (left.z * right.x) - (left.x * right.z),
    z: (left.x * right.y) - (left.y * right.x),
  };
}

function computeBasis(rotation: CameraEuler3): CameraBasis {
  try {
    const pitch = rotation.pitch;
    const yaw = rotation.yaw;
    const cosPitch = Math.cos(pitch);

    /**
     * FPS convention used by the physics system:
     * - yaw = 0 looks toward -Z
     * - +X is right
     * - +Y is up
     */
    const forward = normalizeVector(
      {
        x: Math.sin(yaw) * cosPitch,
        y: Math.sin(pitch),
        z: -Math.cos(yaw) * cosPitch,
      },
      {
        x: 0,
        y: 0,
        z: -1,
      },
    );

    const worldUp = {
      x: 0,
      y: 1,
      z: 0,
    };

    const right = normalizeVector(
      cross(forward, worldUp),
      {
        x: 1,
        y: 0,
        z: 0,
      },
    );

    const up = normalizeVector(
      cross(right, forward),
      worldUp,
    );

    return {
      forward,
      right,
      up,
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
      up: {
        x: 0,
        y: 1,
        z: 0,
      },
    };
  }
}

function addVector(left: CameraVector3, right: Partial<CameraVector3> | undefined): CameraVector3 {
  return {
    x: left.x + safeNumber(right?.x, 0),
    y: left.y + safeNumber(right?.y, 0),
    z: left.z + safeNumber(right?.z, 0),
  };
}

function addEuler(left: CameraEuler3, right: Partial<CameraEuler3> | undefined): CameraEuler3 {
  return normalizeCameraRotation({
    pitch: left.pitch + safeNumber(right?.pitch, 0),
    yaw: left.yaw + safeNumber(right?.yaw, 0),
    roll: left.roll + safeNumber(right?.roll, 0),
  });
}

function cloneFollowState(value: CameraFollowState): CameraFollowState {
  return {
    enabled: value.enabled,
    source: value.source,
    bodyPosition: value.bodyPosition ? { ...value.bodyPosition } : null,
    eyePosition: value.eyePosition ? { ...value.eyePosition } : null,
    lastBindingAt: value.lastBindingAt,
    lastBindingReason: value.lastBindingReason,
  };
}

function freezeSnapshot<T>(value: T): T {
  try {
    if (value && typeof value === "object") {
      return Object.freeze(value);
    }

    return value;
  } catch {
    return value;
  }
}

export function createCameraState(options?: CreateCameraStateOptions): CameraStateHandle {
  const logger = options?.logger;
  const createdAt = now();

  const initialPosition = normalizePosition(options?.position, DEFAULT_POSITION);
  const initialRotation = normalizeRotation(options?.rotation, DEFAULT_ROTATION);
  const initialProjection = normalizeProjection(
    {
      fov: options?.fov,
      near: options?.near,
      far: options?.far,
      aspect: options?.aspect,
    },
    DEFAULT_PROJECTION,
  );
  const initialMovement = normalizeMovement(
    {
      moveSpeed: options?.moveSpeed,
      sprintMultiplier: options?.sprintMultiplier,
    },
    DEFAULT_MOVEMENT,
  );
  const initialFollow: CameraFollowState = {
    ...DEFAULT_FOLLOW,
    enabled: safeBoolean(options?.followPlayerPhysics, false),
    source: safeBoolean(options?.followPlayerPhysics, false) ? "player-physics" : "camera-state",
    eyePosition: safeBoolean(options?.followPlayerPhysics, false) ? initialPosition : null,
    bodyPosition: null,
    lastBindingAt: null,
    lastBindingReason: null,
  };

  let status: CameraStateStatus = "created";
  let mode = normalizeMode(options?.mode);
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let destroyed = false;
  let position = initialPosition;
  let rotation = normalizeCameraRotation(initialRotation);
  let projection = initialProjection;
  let movement = initialMovement;
  let follow = initialFollow;
  let lastError: Record<string, unknown> | null = null;

  function setStatus(nextStatus: CameraStateStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function setError(error: unknown): void {
    lastError = normalizeErrorRecord(error);
    setStatus("failed");
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed") {
      logWarn(logger, "Camera state action ignored because handle is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function snapshot(): CameraStateSnapshot {
    return freezeSnapshot({
      kind: CAMERA_STATE_SNAPSHOT_KIND,
      status,
      mode,
      createdAt,
      updatedAt,
      destroyedAt,
      position: { ...position },
      rotation: { ...rotation },
      projection: { ...projection },
      movement: {
        ...movement,
        velocity: { ...movement.velocity },
      },
      follow: cloneFollowState(follow),
      basis: computeBasis(rotation),
      lastError,
    });
  }

  function markUpdated(reason?: string): CameraStateSnapshot {
    setStatus("ready");

    if (reason) {
      logDebug(logger, "Camera state updated.", {
        reason,
        position,
        rotation,
        follow,
      });
    }

    return snapshot();
  }

  function updateFollowState(input: Partial<CameraFollowState>, reason?: string): void {
    follow = {
      ...follow,
      ...input,
      bodyPosition: input.bodyPosition === undefined
        ? follow.bodyPosition
        : input.bodyPosition
          ? { ...input.bodyPosition }
          : null,
      eyePosition: input.eyePosition === undefined
        ? follow.eyePosition
        : input.eyePosition
          ? { ...input.eyePosition }
          : null,
      source: normalizePositionSource(input.source, follow.source),
      lastBindingAt: input.lastBindingAt === undefined ? now() : input.lastBindingAt,
      lastBindingReason: input.lastBindingReason === undefined ? reason ?? null : input.lastBindingReason,
    };
  }

  const handle: CameraStateHandle = {
    kind: CAMERA_STATE_KIND,

    getStatus(): CameraStateStatus {
      return status;
    },

    getSnapshot(): CameraStateSnapshot {
      return snapshot();
    },

    getPosition(): CameraVector3 {
      return { ...position };
    },

    setPosition(nextPosition: Partial<CameraVector3>, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setPosition")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        position = normalizePosition(nextPosition, position);
        updateFollowState(
          {
            source: normalizePositionSource(setOptions?.source, "camera-state"),
            eyePosition: position,
          },
          setOptions?.reason ?? "setPosition",
        );
        return markUpdated(setOptions?.reason ?? "setPosition");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    translate(delta: Partial<CameraVector3>, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("translate")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        position = normalizePosition(addVector(position, delta), position);
        updateFollowState(
          {
            source: normalizePositionSource(setOptions?.source, "camera-state"),
            eyePosition: position,
          },
          setOptions?.reason ?? "translate",
        );
        return markUpdated(setOptions?.reason ?? "translate");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    getRotation(): CameraEuler3 {
      return { ...rotation };
    },

    setRotation(nextRotation: Partial<CameraEuler3>, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setRotation")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        rotation = normalizeCameraRotation(normalizeRotation(nextRotation, rotation));
        return markUpdated(setOptions?.reason ?? "setRotation");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    rotate(delta: Partial<CameraEuler3>, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("rotate")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        rotation = addEuler(rotation, delta);
        return markUpdated(setOptions?.reason ?? "rotate");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    applyPhysicsCameraBinding(binding: PhysicsCameraBinding, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("applyPhysicsCameraBinding")) {
        return snapshot();
      }

      try {
        setStatus("updating");

        const eyePosition = normalizePhysicsVector(binding.eyePosition, position);
        const bodyPosition = normalizePhysicsVector(binding.bodyPosition, follow.bodyPosition ?? eyePosition);
        const angles = normalizePhysicsAngles(binding.angles, rotation);

        position = eyePosition;
        rotation = normalizeCameraRotation(angles);

        updateFollowState(
          {
            enabled: true,
            source: normalizePositionSource(setOptions?.source, "player-physics"),
            bodyPosition,
            eyePosition,
          },
          setOptions?.reason ?? "applyPhysicsCameraBinding",
        );

        return markUpdated(setOptions?.reason ?? "applyPhysicsCameraBinding");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    setEyePosition(nextPosition: Partial<CameraVector3>, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setEyePosition")) {
        return snapshot();
      }

      try {
        setStatus("updating");

        position = normalizePosition(nextPosition, position);

        updateFollowState(
          {
            source: normalizePositionSource(setOptions?.source, follow.enabled ? "player-physics" : "camera-state"),
            eyePosition: position,
          },
          setOptions?.reason ?? "setEyePosition",
        );

        return markUpdated(setOptions?.reason ?? "setEyePosition");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    setLookAngles(nextAngles: Partial<CameraEuler3>, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setLookAngles")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        rotation = normalizeCameraRotation(normalizeRotation(nextAngles, rotation));
        return markUpdated(setOptions?.reason ?? "setLookAngles");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    getProjection(): CameraProjectionState {
      return { ...projection };
    },

    setProjection(nextProjection: Partial<CameraProjectionState>, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setProjection")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        projection = normalizeProjection(nextProjection, projection);
        return markUpdated(setOptions?.reason ?? "setProjection");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    setAspect(aspect: number, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setAspect")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        projection = normalizeProjection(
          {
            aspect,
          },
          projection,
        );
        return markUpdated(setOptions?.reason ?? "setAspect");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    getMovement(): CameraMovementState {
      return {
        ...movement,
        velocity: { ...movement.velocity },
      };
    },

    setMovement(
      nextMovement: Partial<Omit<CameraMovementState, "velocity">> & { readonly velocity?: Partial<CameraVector3> },
      setOptions?: CameraStateSetOptions,
    ): CameraStateSnapshot {
      if (!assertAlive("setMovement")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        movement = normalizeMovement(nextMovement, movement);
        return markUpdated(setOptions?.reason ?? "setMovement");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    setSprinting(isSprinting: boolean, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setSprinting")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        movement = {
          ...movement,
          isSprinting: safeBoolean(isSprinting, movement.isSprinting),
        };
        return markUpdated(setOptions?.reason ?? "setSprinting");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    getFollow(): CameraFollowState {
      return cloneFollowState(follow);
    },

    setFollowEnabled(enabled: boolean, setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("setFollowEnabled")) {
        return snapshot();
      }

      try {
        setStatus("updating");

        updateFollowState(
          {
            enabled: safeBoolean(enabled, follow.enabled),
            source: normalizePositionSource(setOptions?.source, follow.source),
            eyePosition: position,
          },
          setOptions?.reason ?? "setFollowEnabled",
        );

        return markUpdated(setOptions?.reason ?? "setFollowEnabled");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    getBasis(): CameraBasis {
      return computeBasis(rotation);
    },

    reset(setOptions?: CameraStateSetOptions): CameraStateSnapshot {
      if (!assertAlive("reset")) {
        return snapshot();
      }

      try {
        setStatus("updating");
        mode = normalizeMode(options?.mode);
        position = initialPosition;
        rotation = normalizeCameraRotation(initialRotation);
        projection = initialProjection;
        movement = initialMovement;
        follow = {
          ...initialFollow,
          source: normalizePositionSource(setOptions?.source, "reset"),
          eyePosition: initialPosition,
          bodyPosition: null,
          lastBindingAt: now(),
          lastBindingReason: setOptions?.reason ?? "reset",
        };
        lastError = null;
        return markUpdated(setOptions?.reason ?? "reset");
      } catch (error) {
        setError(error);
        return snapshot();
      }
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      destroyedAt = now();
      setStatus("destroyed");

      logDebug(logger, "Camera state destroyed.", {
        reason: reason ?? null,
      });
    },
  };

  setStatus("ready");

  logDebug(logger, "Camera state created.", {
    mode,
    position,
    rotation,
    projection,
    follow,
  });

  return handle;
}

export function cameraVectorToDebug(value: CameraVector3): Record<string, number> {
  return {
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

export function cameraEulerToDebug(value: CameraEuler3): Record<string, number> {
  return {
    pitch: value.pitch,
    yaw: value.yaw,
    roll: value.roll,
  };
}

export function cameraSnapshotToDebug(snapshot: CameraStateSnapshot): Record<string, unknown> {
  return {
    kind: snapshot.kind,
    status: snapshot.status,
    mode: snapshot.mode,
    position: cameraVectorToDebug(snapshot.position),
    rotation: cameraEulerToDebug(snapshot.rotation),
    projection: snapshot.projection,
    movement: snapshot.movement,
    follow: snapshot.follow,
    basis: snapshot.basis,
    lastError: snapshot.lastError,
  };
}

export function physicsVectorToCameraVector(value: Partial<PhysicsVector3> | null | undefined, fallback = DEFAULT_POSITION): CameraVector3 {
  return normalizePhysicsVector(value, fallback);
}

export function physicsAnglesToCameraEuler(value: Partial<PhysicsEulerAngles> | null | undefined, fallback = DEFAULT_ROTATION): CameraEuler3 {
  return normalizePhysicsAngles(value, fallback);
}

export function cameraVectorToPhysicsVector(value: Partial<CameraVector3> | null | undefined, fallback = DEFAULT_POSITION): PhysicsVector3 {
  const vector = normalizePosition(value, fallback);

  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

export function cameraEulerToPhysicsAngles(value: Partial<CameraEuler3> | null | undefined, fallback = DEFAULT_ROTATION): PhysicsEulerAngles {
  const rotation = normalizeRotation(value, fallback);

  return {
    yaw: rotation.yaw,
    pitch: rotation.pitch,
    roll: rotation.roll,
  };
}

export function isCameraStateHandle(value: unknown): value is CameraStateHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<CameraStateHandle>;

    return (
      record.kind === CAMERA_STATE_KIND
      && typeof record.getSnapshot === "function"
      && typeof record.setPosition === "function"
      && typeof record.setRotation === "function"
      && typeof record.applyPhysicsCameraBinding === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}