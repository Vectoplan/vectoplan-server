// src/frontend/camera/first_person_camera_controller.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type {
  PhysicsCameraBinding,
  PhysicsEulerAngles,
  PhysicsVector3,
  PhysicsConfig,
} from "../runtime/physics/physics_models";
import {
  applyCameraMovementStep,
  cameraAnglesFromPhysicsAngles,
  cameraEulerFromAngles,
  CAMERA_MOVEMENT_DEFAULTS,
  copyVector3ToMutable,
  DEFAULT_CAMERA_ANGLES,
  normalizeCameraAngles,
  normalizeMovementIntent,
  physicsAnglesFromCameraAngles,
  updateCameraAnglesFromMouseDelta,
  ZERO_VECTOR_2,
  ZERO_VECTOR_3,
  type CameraAngles,
  type CameraLookOptions,
  type CameraMovementIntentLike,
  type CameraMovementOptions,
  type MutableVector3Like,
  type Vector2Like,
  type Vector3Like,
} from "./camera_movement_math";

export type FirstPersonCameraStatus =
  | "created"
  | "attached"
  | "active"
  | "disabled"
  | "failed"
  | "destroyed";

export type FirstPersonCameraPositionSource =
  | "camera-controller"
  | "legacy-direct-movement"
  | "physics-binding"
  | "manual"
  | "camera-sync"
  | "reset"
  | "unknown";

export interface CameraRotationLike {
  x: number;
  y: number;
  z: number;
  order?: string;
  set?: (x: number, y: number, z: number, order?: string) => unknown;
  reorder?: (order: string) => unknown;
}

export interface CameraPositionLike extends MutableVector3Like {
  set?: (x: number, y: number, z: number) => unknown;
  copy?: (source: MutableVector3Like) => unknown;
}

export interface CameraObjectLike {
  readonly position: CameraPositionLike;
  readonly rotation: CameraRotationLike;
  updateMatrix?: () => unknown;
  updateMatrixWorld?: (force?: boolean) => unknown;
  updateProjectionMatrix?: () => unknown;
}

export interface FirstPersonCameraUpdateInput {
  readonly lookDelta?: Partial<Vector2Like> | null;
  readonly movementIntent?: CameraMovementIntentLike | null;
  readonly physicsBinding?: PhysicsCameraBinding | null;
  readonly deltaSeconds?: number;
  readonly source?: string;
}

export interface FirstPersonCameraControllerOptions extends CameraLookOptions, CameraMovementOptions {
  readonly camera: CameraObjectLike;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly enabled?: boolean;
  readonly autoAttach?: boolean;
  readonly writeInitialTransform?: boolean;
  readonly updateCameraMatrix?: boolean;

  readonly initialPosition?: Partial<Vector3Like> | null;
  readonly initialAngles?: Partial<CameraAngles> | null;

  readonly resetPosition?: Partial<Vector3Like> | null;
  readonly resetAngles?: Partial<CameraAngles> | null;

  /**
   * When true, update(...) and applyMovementIntent(...) may move the camera
   * directly with legacy no-physics movement.
   *
   * While introducing the player physics system this can stay true for
   * backwards compatibility. SceneRuntime should set this to false once
   * PhysicsRuntime becomes the movement owner.
   */
  readonly directMovementEnabled?: boolean;

  /**
   * When true, the camera is expected to follow PhysicsRuntime through
   * applyPhysicsCameraBinding(...).
   */
  readonly physicsFollowEnabled?: boolean;

  /**
   * Optional sign/multiplier hooks.
   *
   * Defaults are neutral. The canonical Hytale/Minecraft control signs are
   * implemented in camera_movement_math.ts / input_controller.ts.
   */
  readonly lookDeltaMultiplierX?: number;
  readonly lookDeltaMultiplierY?: number;
  readonly movementForwardMultiplier?: number;
  readonly movementRightMultiplier?: number;
  readonly movementUpMultiplier?: number;

  readonly onChange?: (snapshot: FirstPersonCameraSnapshot) => void;
  readonly onLook?: (snapshot: FirstPersonCameraSnapshot) => void;
  readonly onMove?: (snapshot: FirstPersonCameraSnapshot) => void;
  readonly onPhysicsBinding?: (snapshot: FirstPersonCameraSnapshot) => void;
  readonly onError?: (error: unknown) => void;
}

export interface FirstPersonCameraFollowState {
  readonly physicsFollowEnabled: boolean;
  readonly directMovementEnabled: boolean;
  readonly source: FirstPersonCameraPositionSource;
  readonly bodyPosition: Vector3Like | null;
  readonly eyePosition: Vector3Like | null;
  readonly lastBindingAt: string | null;
  readonly lastBindingSource: string | null;
}

export interface FirstPersonCameraSnapshot {
  readonly kind: "first-person-camera-snapshot.v1";
  readonly status: FirstPersonCameraStatus;
  readonly enabled: boolean;
  readonly attached: boolean;
  readonly destroyed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;

  readonly position: Vector3Like;
  readonly angles: CameraAngles;
  readonly velocity: Vector3Like;
  readonly movementDirection: Vector3Like;
  readonly lastLookDelta: Vector2Like;
  readonly lastDeltaSeconds: number;
  readonly follow: FirstPersonCameraFollowState;

  readonly attachCount: number;
  readonly detachCount: number;
  readonly lookUpdateCount: number;
  readonly movementUpdateCount: number;
  readonly physicsBindingUpdateCount: number;
  readonly frameUpdateCount: number;
  readonly resetCount: number;
  readonly errorCount: number;

  readonly lastSource: string | null;
  readonly lastLookAt: string | null;
  readonly lastMoveAt: string | null;
  readonly lastPhysicsBindingAt: string | null;
  readonly lastResetAt: string | null;
  readonly lastErrorAt: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface FirstPersonCameraControllerHandle {
  readonly kind: "vectoplan-editor-first-person-camera-controller.v1";

  attach(): void;
  detach(reason?: string): void;

  enable(reason?: string): void;
  disable(reason?: string): void;

  update(input: FirstPersonCameraUpdateInput): FirstPersonCameraSnapshot;
  applyLookDelta(delta: Partial<Vector2Like> | null | undefined, source?: string): FirstPersonCameraSnapshot;
  applyMovementIntent(
    intent: CameraMovementIntentLike | null | undefined,
    deltaSeconds: number,
    source?: string,
  ): FirstPersonCameraSnapshot;

  applyPhysicsCameraBinding(binding: PhysicsCameraBinding, source?: string): FirstPersonCameraSnapshot;
  setPhysicsFollowEnabled(enabled: boolean, source?: string): FirstPersonCameraSnapshot;
  setDirectMovementEnabled(enabled: boolean, source?: string): FirstPersonCameraSnapshot;

  setPosition(position: Partial<Vector3Like>, source?: string): FirstPersonCameraSnapshot;
  setEyePosition(position: Partial<Vector3Like>, source?: string): FirstPersonCameraSnapshot;
  setAngles(angles: Partial<CameraAngles>, source?: string): FirstPersonCameraSnapshot;
  setPhysicsAngles(angles: Partial<PhysicsEulerAngles>, source?: string): FirstPersonCameraSnapshot;

  syncFromCamera(source?: string): FirstPersonCameraSnapshot;
  writeToCamera(source?: string): FirstPersonCameraSnapshot;

  reset(reason?: string): FirstPersonCameraSnapshot;

  getStatus(): FirstPersonCameraStatus;
  getSnapshot(): FirstPersonCameraSnapshot;

  destroy(reason?: string): void;
}

const FIRST_PERSON_CAMERA_KIND = "vectoplan-editor-first-person-camera-controller.v1" as const;
const FIRST_PERSON_CAMERA_SNAPSHOT_KIND = "first-person-camera-snapshot.v1" as const;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "unknown-time";
    }
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
        message: "Unknown first-person camera error.",
      };
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

function finiteNumber(value: unknown, fallback: number): number {
  try {
    return safeNumber(value, fallback);
  } catch {
    return fallback;
  }
}

function normalizeSource(source: unknown, fallback: string): string {
  try {
    const value = safeString(source, "").trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function normalizePositionSource(value: unknown, fallback: FirstPersonCameraPositionSource): FirstPersonCameraPositionSource {
  try {
    const normalized = safeString(value, fallback);

    if (
      normalized === "camera-controller"
      || normalized === "legacy-direct-movement"
      || normalized === "physics-binding"
      || normalized === "manual"
      || normalized === "camera-sync"
      || normalized === "reset"
      || normalized === "unknown"
    ) {
      return normalized;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeMultiplier(value: unknown, fallback = 1): number {
  try {
    const normalized = safeNumber(value, fallback);

    if (!Number.isFinite(normalized)) {
      return fallback;
    }

    if (Math.abs(normalized) < 0.000001) {
      return 0;
    }

    return normalized;
  } catch {
    return fallback;
  }
}

function normalizeVector3Input(value: Partial<Vector3Like> | null | undefined, fallback: Vector3Like): Vector3Like {
  try {
    return {
      x: finiteNumber(value?.x, fallback.x),
      y: finiteNumber(value?.y, fallback.y),
      z: finiteNumber(value?.z, fallback.z),
    };
  } catch {
    return fallback;
  }
}

function normalizePhysicsVector3Input(value: Partial<PhysicsVector3> | null | undefined, fallback: Vector3Like): Vector3Like {
  try {
    return normalizeVector3Input(
      {
        x: value?.x,
        y: value?.y,
        z: value?.z,
      },
      fallback,
    );
  } catch {
    return fallback;
  }
}

function normalizeVector2Input(value: Partial<Vector2Like> | null | undefined): Vector2Like {
  try {
    return {
      x: finiteNumber(value?.x, 0),
      y: finiteNumber(value?.y, 0),
    };
  } catch {
    return ZERO_VECTOR_2;
  }
}

function readCameraPosition(camera: CameraObjectLike): Vector3Like {
  try {
    return {
      x: finiteNumber(camera.position.x, 0),
      y: finiteNumber(camera.position.y, 0),
      z: finiteNumber(camera.position.z, 0),
    };
  } catch {
    return ZERO_VECTOR_3;
  }
}

function readCameraAngles(camera: CameraObjectLike): CameraAngles {
  try {
    return normalizeCameraAngles({
      pitch: finiteNumber(camera.rotation.x, DEFAULT_CAMERA_ANGLES.pitch),
      yaw: finiteNumber(camera.rotation.y, DEFAULT_CAMERA_ANGLES.yaw),
      roll: finiteNumber(camera.rotation.z, DEFAULT_CAMERA_ANGLES.roll),
    });
  } catch {
    return DEFAULT_CAMERA_ANGLES;
  }
}

function writePositionToCamera(camera: CameraObjectLike, nextPosition: Vector3Like): void {
  try {
    if (typeof camera.position.set === "function") {
      camera.position.set(nextPosition.x, nextPosition.y, nextPosition.z);
      return;
    }

    copyVector3ToMutable(nextPosition, camera.position);
  } catch {
    try {
      camera.position.x = nextPosition.x;
      camera.position.y = nextPosition.y;
      camera.position.z = nextPosition.z;
    } catch {
      // Best-effort write only.
    }
  }
}

function writeAnglesToCamera(camera: CameraObjectLike, nextAngles: CameraAngles): void {
  try {
    const euler = cameraEulerFromAngles(nextAngles);

    if (typeof camera.rotation.set === "function") {
      camera.rotation.set(euler.x, euler.y, euler.z, euler.order);
      return;
    }

    camera.rotation.x = euler.x;
    camera.rotation.y = euler.y;
    camera.rotation.z = euler.z;
    camera.rotation.order = euler.order;
  } catch {
    try {
      camera.rotation.x = nextAngles.pitch;
      camera.rotation.y = nextAngles.yaw;
      camera.rotation.z = nextAngles.roll;
      camera.rotation.order = "YXZ";
    } catch {
      // Best-effort write only.
    }
  }
}

function updateCameraMatrices(camera: CameraObjectLike, force: boolean): void {
  try {
    camera.updateMatrix?.();
  } catch {
    // Matrix update is best-effort.
  }

  try {
    camera.updateMatrixWorld?.(force);
  } catch {
    // Matrix-world update is best-effort.
  }

  try {
    camera.updateProjectionMatrix?.();
  } catch {
    // Projection update is best-effort.
  }
}

function safeDeltaSeconds(value: unknown, maxDeltaSeconds: number): number {
  try {
    const delta = finiteNumber(value, 0);
    const max = Math.max(0, finiteNumber(maxDeltaSeconds, CAMERA_MOVEMENT_DEFAULTS.maxDeltaSeconds));

    if (delta < 0) {
      return 0;
    }

    if (delta > max) {
      return max;
    }

    return delta;
  } catch {
    return 0;
  }
}

function invokeSnapshotCallback(
  callback: ((snapshot: FirstPersonCameraSnapshot) => void) | undefined,
  snapshot: FirstPersonCameraSnapshot,
  logger: EditorLogger | undefined,
  label: string,
): void {
  try {
    callback?.(snapshot);
  } catch (error) {
    logWarn(logger, `${label} failed.`, {
      error: normalizeErrorRecord(error),
    });
  }
}

export function createFirstPersonCameraController(
  options: FirstPersonCameraControllerOptions,
): FirstPersonCameraControllerHandle {
  const camera = options.camera;
  const logger = options.logger;

  const createdAt = now();

  let status: FirstPersonCameraStatus = "created";
  let enabled = safeBoolean(options.enabled, true);
  let attached = false;
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;

  let position = normalizeVector3Input(options.initialPosition, readCameraPosition(camera));
  let angles = normalizeCameraAngles(options.initialAngles ?? readCameraAngles(camera));
  let velocity: Vector3Like = ZERO_VECTOR_3;
  let movementDirection: Vector3Like = ZERO_VECTOR_3;
  let lastLookDelta: Vector2Like = ZERO_VECTOR_2;
  let lastDeltaSeconds = 0;

  let physicsFollowEnabled = safeBoolean(options.physicsFollowEnabled, false);
  let directMovementEnabled = safeBoolean(options.directMovementEnabled, true);
  let followSource: FirstPersonCameraPositionSource = physicsFollowEnabled ? "physics-binding" : "camera-controller";
  let followBodyPosition: Vector3Like | null = null;
  let followEyePosition: Vector3Like | null = physicsFollowEnabled ? position : null;
  let followLastBindingAt: string | null = null;
  let followLastBindingSource: string | null = null;

  let attachCount = 0;
  let detachCount = 0;
  let lookUpdateCount = 0;
  let movementUpdateCount = 0;
  let physicsBindingUpdateCount = 0;
  let frameUpdateCount = 0;
  let resetCount = 0;
  let errorCount = 0;

  let lastSource: string | null = null;
  let lastLookAt: string | null = null;
  let lastMoveAt: string | null = null;
  let lastPhysicsBindingAt: string | null = null;
  let lastResetAt: string | null = null;
  let lastErrorAt: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  const cleanupCallbacks: Array<() => void> = [];

  function setStatus(nextStatus: FirstPersonCameraStatus): void {
    try {
      status = nextStatus;
      updatedAt = now();
    } catch {
      status = nextStatus;
    }
  }

  function setError(error: unknown, source?: string): void {
    try {
      lastError = normalizeErrorRecord(error);
      lastErrorAt = now();
      lastSource = normalizeSource(source, "camera.error");
      errorCount += 1;
      setStatus("failed");

      try {
        options.onError?.(error);
      } catch {
        // User callback must not break runtime.
      }
    } catch {
      status = "failed";
    }
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed") {
      logWarn(logger, "First-person camera action ignored because controller is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function makeLookOptions(): CameraLookOptions {
    return {
      mouseSensitivityX: options.mouseSensitivityX ?? CAMERA_MOVEMENT_DEFAULTS.mouseSensitivityX,
      mouseSensitivityY: options.mouseSensitivityY ?? CAMERA_MOVEMENT_DEFAULTS.mouseSensitivityY,
      invertMouseX: options.invertMouseX ?? false,
      invertMouseY: options.invertMouseY ?? false,
      minPitchRadians: options.minPitchRadians ?? CAMERA_MOVEMENT_DEFAULTS.minPitchRadians,
      maxPitchRadians: options.maxPitchRadians ?? CAMERA_MOVEMENT_DEFAULTS.maxPitchRadians,
      normalizeYaw: options.normalizeYaw ?? true,
    };
  }

  function makeMovementOptions(deltaSeconds: number): CameraMovementOptions {
    return {
      movementSpeed: options.movementSpeed ?? CAMERA_MOVEMENT_DEFAULTS.movementSpeed,
      verticalMovementSpeed: options.verticalMovementSpeed ?? CAMERA_MOVEMENT_DEFAULTS.verticalMovementSpeed,
      sprintMultiplier: options.sprintMultiplier ?? CAMERA_MOVEMENT_DEFAULTS.sprintMultiplier,
      crouchMultiplier: options.crouchMultiplier ?? CAMERA_MOVEMENT_DEFAULTS.crouchMultiplier,
      deltaSeconds,
      maxDeltaSeconds: options.maxDeltaSeconds ?? CAMERA_MOVEMENT_DEFAULTS.maxDeltaSeconds,
      allowVerticalMovement: options.allowVerticalMovement ?? true,
      normalizeHorizontalDiagonal: options.normalizeHorizontalDiagonal ?? true,
    };
  }

  function normalizeLookDeltaForController(delta: Partial<Vector2Like> | null | undefined): Vector2Like {
    const normalized = normalizeVector2Input(delta);
    const multiplierX = normalizeMultiplier(options.lookDeltaMultiplierX, 1);
    const multiplierY = normalizeMultiplier(options.lookDeltaMultiplierY, 1);

    return {
      x: normalized.x * multiplierX,
      y: normalized.y * multiplierY,
    };
  }

  function normalizeMovementIntentForController(
    intent: CameraMovementIntentLike | null | undefined,
  ): ReturnType<typeof normalizeMovementIntent> {
    const normalized = normalizeMovementIntent(intent);
    const forwardMultiplier = normalizeMultiplier(options.movementForwardMultiplier, 1);
    const rightMultiplier = normalizeMultiplier(options.movementRightMultiplier, 1);
    const upMultiplier = normalizeMultiplier(options.movementUpMultiplier, 1);

    return {
      ...normalized,
      forward: normalized.forward * forwardMultiplier,
      right: normalized.right * rightMultiplier,
      up: normalized.up * upMultiplier,
    };
  }

  function followSnapshot(): FirstPersonCameraFollowState {
    return {
      physicsFollowEnabled,
      directMovementEnabled,
      source: followSource,
      bodyPosition: followBodyPosition ? { ...followBodyPosition } : null,
      eyePosition: followEyePosition ? { ...followEyePosition } : null,
      lastBindingAt: followLastBindingAt,
      lastBindingSource: followLastBindingSource,
    };
  }

  function snapshot(): FirstPersonCameraSnapshot {
    return {
      kind: FIRST_PERSON_CAMERA_SNAPSHOT_KIND,
      status,
      enabled,
      attached,
      destroyed,
      createdAt,
      updatedAt,
      destroyedAt,
      position: { ...position },
      angles: { ...angles },
      velocity: { ...velocity },
      movementDirection: { ...movementDirection },
      lastLookDelta: { ...lastLookDelta },
      lastDeltaSeconds,
      follow: followSnapshot(),
      attachCount,
      detachCount,
      lookUpdateCount,
      movementUpdateCount,
      physicsBindingUpdateCount,
      frameUpdateCount,
      resetCount,
      errorCount,
      lastSource,
      lastLookAt,
      lastMoveAt,
      lastPhysicsBindingAt,
      lastResetAt,
      lastErrorAt,
      lastError,
    };
  }

  function notifyChange(label: string): void {
    const current = snapshot();
    invokeSnapshotCallback(options.onChange, current, logger, `${label}.onChange`);
  }

  function writeTransform(source: string): FirstPersonCameraSnapshot {
    try {
      writePositionToCamera(camera, position);
      writeAnglesToCamera(camera, angles);

      if (options.updateCameraMatrix ?? true) {
        updateCameraMatrices(camera, true);
      }

      lastSource = source;
      updatedAt = now();

      return snapshot();
    } catch (error) {
      setError(error, source);
      return snapshot();
    }
  }

  function setFollowFromManualPosition(source: FirstPersonCameraPositionSource, trigger: string): void {
    try {
      followSource = source;
      followEyePosition = position;
      followLastBindingAt = now();
      followLastBindingSource = trigger;
    } catch {
      // Follow metadata is diagnostic-only.
    }
  }

  function applyPhysicsBindingUnsafe(binding: PhysicsCameraBinding, source: string): FirstPersonCameraSnapshot {
    const bodyPosition = normalizePhysicsVector3Input(binding.bodyPosition, followBodyPosition ?? position);
    const eyePosition = normalizePhysicsVector3Input(binding.eyePosition, position);
    const nextAngles = cameraAnglesFromPhysicsAngles(binding.angles);

    physicsFollowEnabled = true;
    followSource = "physics-binding";
    followBodyPosition = bodyPosition;
    followEyePosition = eyePosition;
    followLastBindingAt = now();
    followLastBindingSource = source;

    position = eyePosition;
    angles = nextAngles;
    velocity = ZERO_VECTOR_3;
    movementDirection = ZERO_VECTOR_3;
    lastPhysicsBindingAt = followLastBindingAt;
    physicsBindingUpdateCount += 1;

    const current = writeTransform(source);
    setStatus("active");

    invokeSnapshotCallback(options.onPhysicsBinding, current, logger, "camera.applyPhysicsCameraBinding.onPhysicsBinding");
    notifyChange("camera.applyPhysicsCameraBinding");

    return current;
  }

  function attachAbortSignal(): void {
    try {
      const signal = options.signal;

      if (!signal) {
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

      cleanupCallbacks.push(() => {
        try {
          signal.removeEventListener("abort", onAbort);
        } catch {
          // Ignore cleanup failure.
        }
      });
    } catch {
      // Abort wiring is best-effort.
    }
  }

  function detachCleanup(): void {
    try {
      for (const cleanup of cleanupCallbacks.splice(0)) {
        try {
          cleanup();
        } catch {
          // Continue cleanup chain.
        }
      }

      attached = false;
    } catch {
      attached = false;
    }
  }

  const handle: FirstPersonCameraControllerHandle = {
    kind: FIRST_PERSON_CAMERA_KIND,

    attach(): void {
      if (!assertAlive("attach")) {
        return;
      }

      if (attached) {
        return;
      }

      try {
        attachAbortSignal();

        attached = true;
        attachCount += 1;
        setStatus(enabled ? "attached" : "disabled");

        if (options.writeInitialTransform ?? true) {
          writeTransform("camera.attach.initial-transform");
        }

        logDebug(logger, "First-person camera controller attached.", {
          enabled,
          position,
          angles,
          physicsFollowEnabled,
          directMovementEnabled,
        });
      } catch (error) {
        setError(error, "camera.attach");
      }
    },

    detach(reason?: string): void {
      if (destroyed) {
        return;
      }

      const source = normalizeSource(reason, "camera.detach");

      try {
        detachCleanup();
        detachCount += 1;
        lastSource = source;
        setStatus(enabled ? "created" : "disabled");

        logDebug(logger, "First-person camera controller detached.", {
          reason: source,
        });
      } catch (error) {
        setError(error, source);
      }
    },

    enable(reason?: string): void {
      if (!assertAlive("enable")) {
        return;
      }

      const source = normalizeSource(reason, "camera.enable");

      try {
        enabled = true;
        lastSource = source;
        setStatus(attached ? "attached" : "created");

        logDebug(logger, "First-person camera controller enabled.", {
          reason: source,
        });
      } catch (error) {
        setError(error, source);
      }
    },

    disable(reason?: string): void {
      if (destroyed) {
        return;
      }

      const source = normalizeSource(reason, "camera.disable");

      try {
        enabled = false;
        velocity = ZERO_VECTOR_3;
        movementDirection = ZERO_VECTOR_3;
        lastLookDelta = ZERO_VECTOR_2;
        lastSource = source;
        setStatus("disabled");

        logDebug(logger, "First-person camera controller disabled.", {
          reason: source,
        });
      } catch (error) {
        setError(error, source);
      }
    },

    update(input: FirstPersonCameraUpdateInput): FirstPersonCameraSnapshot {
      if (!assertAlive("update")) {
        return snapshot();
      }

      const source = normalizeSource(input.source, "camera.update");

      if (!enabled) {
        lastSource = source;
        return snapshot();
      }

      try {
        frameUpdateCount += 1;

        const lookDelta = normalizeLookDeltaForController(input.lookDelta);
        const hasLookDelta = lookDelta.x !== 0 || lookDelta.y !== 0;

        if (hasLookDelta) {
          const lookResult = updateCameraAnglesFromMouseDelta(
            angles,
            lookDelta,
            makeLookOptions(),
          );

          angles = lookResult.angles;
          lastLookDelta = lookResult.appliedMouseDelta;
          lastLookAt = now();
          lookUpdateCount += 1;
        } else {
          lastLookDelta = ZERO_VECTOR_2;
        }

        const deltaSeconds = safeDeltaSeconds(
          input.deltaSeconds,
          options.maxDeltaSeconds ?? CAMERA_MOVEMENT_DEFAULTS.maxDeltaSeconds,
        );
        lastDeltaSeconds = deltaSeconds;

        if (input.physicsBinding) {
          const binding: PhysicsCameraBinding = {
            ...input.physicsBinding,
            angles: physicsAnglesFromCameraAngles(angles),
          };

          return applyPhysicsBindingUnsafe(binding, source);
        }

        const normalizedIntent = normalizeMovementIntentForController(input.movementIntent);
        const hasMovement = normalizedIntent.forward !== 0
          || normalizedIntent.right !== 0
          || normalizedIntent.up !== 0;

        if (hasMovement && deltaSeconds > 0 && directMovementEnabled && !physicsFollowEnabled) {
          const moveResult = applyCameraMovementStep(
            position,
            angles.yaw,
            normalizedIntent,
            makeMovementOptions(deltaSeconds),
          );

          position = moveResult.position;
          velocity = moveResult.velocity;
          movementDirection = moveResult.direction;
          lastMoveAt = now();
          movementUpdateCount += 1;
          setFollowFromManualPosition("legacy-direct-movement", source);
        } else {
          velocity = ZERO_VECTOR_3;
          movementDirection = ZERO_VECTOR_3;
        }

        const current = writeTransform(source);
        setStatus("active");

        if (hasLookDelta) {
          invokeSnapshotCallback(options.onLook, current, logger, "camera.update.onLook");
        }

        if (hasMovement && directMovementEnabled && !physicsFollowEnabled) {
          invokeSnapshotCallback(options.onMove, current, logger, "camera.update.onMove");
        }

        notifyChange("camera.update");

        return current;
      } catch (error) {
        setError(error, source);
        return snapshot();
      }
    },

    applyLookDelta(delta: Partial<Vector2Like> | null | undefined, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("applyLookDelta")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.look");

      if (!enabled) {
        lastSource = normalizedSource;
        return snapshot();
      }

      try {
        const lookDelta = normalizeLookDeltaForController(delta);

        if (lookDelta.x === 0 && lookDelta.y === 0) {
          lastLookDelta = ZERO_VECTOR_2;
          return snapshot();
        }

        const lookResult = updateCameraAnglesFromMouseDelta(
          angles,
          lookDelta,
          makeLookOptions(),
        );

        angles = lookResult.angles;
        lastLookDelta = lookResult.appliedMouseDelta;
        lastLookAt = now();
        lookUpdateCount += 1;

        const current = writeTransform(normalizedSource);
        setStatus("active");

        invokeSnapshotCallback(options.onLook, current, logger, "camera.applyLookDelta.onLook");
        notifyChange("camera.applyLookDelta");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    applyMovementIntent(
      intent: CameraMovementIntentLike | null | undefined,
      deltaSeconds: number,
      source?: string,
    ): FirstPersonCameraSnapshot {
      if (!assertAlive("applyMovementIntent")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.move");

      if (!enabled) {
        lastSource = normalizedSource;
        return snapshot();
      }

      try {
        const safeDelta = safeDeltaSeconds(
          deltaSeconds,
          options.maxDeltaSeconds ?? CAMERA_MOVEMENT_DEFAULTS.maxDeltaSeconds,
        );
        const normalizedIntent = normalizeMovementIntentForController(intent);

        lastDeltaSeconds = safeDelta;

        const hasMovement = normalizedIntent.forward !== 0
          || normalizedIntent.right !== 0
          || normalizedIntent.up !== 0;

        if (!hasMovement || safeDelta <= 0 || !directMovementEnabled || physicsFollowEnabled) {
          velocity = ZERO_VECTOR_3;
          movementDirection = ZERO_VECTOR_3;
          return snapshot();
        }

        const moveResult = applyCameraMovementStep(
          position,
          angles.yaw,
          normalizedIntent,
          makeMovementOptions(safeDelta),
        );

        position = moveResult.position;
        velocity = moveResult.velocity;
        movementDirection = moveResult.direction;
        lastMoveAt = now();
        movementUpdateCount += 1;
        setFollowFromManualPosition("legacy-direct-movement", normalizedSource);

        const current = writeTransform(normalizedSource);
        setStatus("active");

        invokeSnapshotCallback(options.onMove, current, logger, "camera.applyMovementIntent.onMove");
        notifyChange("camera.applyMovementIntent");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    applyPhysicsCameraBinding(binding: PhysicsCameraBinding, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("applyPhysicsCameraBinding")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.physics-binding");

      if (!enabled) {
        lastSource = normalizedSource;
        return snapshot();
      }

      try {
        return applyPhysicsBindingUnsafe(binding, normalizedSource);
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    setPhysicsFollowEnabled(enabledValue: boolean, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("setPhysicsFollowEnabled")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.set-physics-follow-enabled");

      try {
        physicsFollowEnabled = safeBoolean(enabledValue, physicsFollowEnabled);
        followSource = physicsFollowEnabled ? "physics-binding" : "camera-controller";
        followEyePosition = physicsFollowEnabled ? position : followEyePosition;
        followLastBindingAt = now();
        followLastBindingSource = normalizedSource;
        lastSource = normalizedSource;

        const current = snapshot();
        notifyChange("camera.setPhysicsFollowEnabled");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    setDirectMovementEnabled(enabledValue: boolean, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("setDirectMovementEnabled")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.set-direct-movement-enabled");

      try {
        directMovementEnabled = safeBoolean(enabledValue, directMovementEnabled);
        lastSource = normalizedSource;

        const current = snapshot();
        notifyChange("camera.setDirectMovementEnabled");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    setPosition(nextPosition: Partial<Vector3Like>, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("setPosition")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.set-position");

      try {
        position = normalizeVector3Input(nextPosition, position);
        velocity = ZERO_VECTOR_3;
        movementDirection = ZERO_VECTOR_3;
        setFollowFromManualPosition("manual", normalizedSource);

        const current = writeTransform(normalizedSource);
        notifyChange("camera.setPosition");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    setEyePosition(nextPosition: Partial<Vector3Like>, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("setEyePosition")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.set-eye-position");

      try {
        position = normalizeVector3Input(nextPosition, position);
        velocity = ZERO_VECTOR_3;
        movementDirection = ZERO_VECTOR_3;
        followEyePosition = position;
        followLastBindingAt = now();
        followLastBindingSource = normalizedSource;

        const current = writeTransform(normalizedSource);
        notifyChange("camera.setEyePosition");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    setAngles(nextAngles: Partial<CameraAngles>, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("setAngles")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.set-angles");

      try {
        angles = normalizeCameraAngles(nextAngles);
        lastLookDelta = ZERO_VECTOR_2;

        const current = writeTransform(normalizedSource);
        notifyChange("camera.setAngles");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    setPhysicsAngles(nextAngles: Partial<PhysicsEulerAngles>, source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("setPhysicsAngles")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.set-physics-angles");

      try {
        angles = cameraAnglesFromPhysicsAngles(nextAngles);
        lastLookDelta = ZERO_VECTOR_2;

        const current = writeTransform(normalizedSource);
        notifyChange("camera.setPhysicsAngles");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    syncFromCamera(source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("syncFromCamera")) {
        return snapshot();
      }

      const normalizedSource = normalizeSource(source, "camera.sync-from-camera");

      try {
        position = readCameraPosition(camera);
        angles = readCameraAngles(camera);
        velocity = ZERO_VECTOR_3;
        movementDirection = ZERO_VECTOR_3;
        lastLookDelta = ZERO_VECTOR_2;
        lastSource = normalizedSource;
        updatedAt = now();
        setFollowFromManualPosition("camera-sync", normalizedSource);

        const current = snapshot();
        notifyChange("camera.syncFromCamera");

        return current;
      } catch (error) {
        setError(error, normalizedSource);
        return snapshot();
      }
    },

    writeToCamera(source?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("writeToCamera")) {
        return snapshot();
      }

      return writeTransform(normalizeSource(source, "camera.write-to-camera"));
    },

    reset(reason?: string): FirstPersonCameraSnapshot {
      if (!assertAlive("reset")) {
        return snapshot();
      }

      const source = normalizeSource(reason, "camera.reset");

      try {
        position = normalizeVector3Input(
          options.resetPosition ?? options.initialPosition,
          readCameraPosition(camera),
        );
        angles = normalizeCameraAngles(
          options.resetAngles ?? options.initialAngles ?? DEFAULT_CAMERA_ANGLES,
        );
        velocity = ZERO_VECTOR_3;
        movementDirection = ZERO_VECTOR_3;
        lastLookDelta = ZERO_VECTOR_2;
        lastDeltaSeconds = 0;
        physicsFollowEnabled = safeBoolean(options.physicsFollowEnabled, false);
        directMovementEnabled = safeBoolean(options.directMovementEnabled, true);
        followSource = normalizePositionSource(physicsFollowEnabled ? "physics-binding" : "reset", "reset");
        followBodyPosition = null;
        followEyePosition = physicsFollowEnabled ? position : null;
        followLastBindingAt = now();
        followLastBindingSource = source;
        lastPhysicsBindingAt = null;
        lastResetAt = now();
        lastSource = source;
        resetCount += 1;

        const current = writeTransform(source);
        setStatus(enabled ? "active" : "disabled");
        notifyChange("camera.reset");

        return current;
      } catch (error) {
        setError(error, source);
        return snapshot();
      }
    },

    getStatus(): FirstPersonCameraStatus {
      return status;
    },

    getSnapshot(): FirstPersonCameraSnapshot {
      return snapshot();
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      const source = normalizeSource(reason, "camera.destroy");

      try {
        detachCleanup();

        destroyed = true;
        destroyedAt = now();
        enabled = false;
        velocity = ZERO_VECTOR_3;
        movementDirection = ZERO_VECTOR_3;
        lastLookDelta = ZERO_VECTOR_2;
        lastSource = source;

        setStatus("destroyed");

        logDebug(logger, "First-person camera controller destroyed.", {
          reason: source,
          attachCount,
          detachCount,
          lookUpdateCount,
          movementUpdateCount,
          physicsBindingUpdateCount,
          frameUpdateCount,
          resetCount,
          errorCount,
        });
      } catch (error) {
        destroyed = true;
        destroyedAt = now();
        setError(error, source);
      }
    },
  };

  if (options.autoAttach ?? true) {
    handle.attach();
  }

  return handle;
}

export function isFirstPersonCameraControllerHandle(
  value: unknown,
): value is FirstPersonCameraControllerHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<FirstPersonCameraControllerHandle>;

    return (
      record.kind === FIRST_PERSON_CAMERA_KIND
      && typeof record.attach === "function"
      && typeof record.update === "function"
      && typeof record.applyLookDelta === "function"
      && typeof record.applyMovementIntent === "function"
      && typeof record.applyPhysicsCameraBinding === "function"
      && typeof record.setPhysicsFollowEnabled === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}