// services/vectoplan-editor/src/frontend/camera/first_person_camera.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { InputStateHandle, InputStateSnapshot, KeyboardActionKey } from "@input/input_state";
import type { ThreeContextHandle } from "@render/three_context";
import type {
  CameraBasis,
  CameraEuler3,
  CameraStateHandle,
  CameraStateSnapshot,
  CameraVector3,
} from "./camera_state";

export type FirstPersonCameraStatus =
  | "created"
  | "initialized"
  | "active"
  | "paused"
  | "disabled"
  | "failed"
  | "destroyed";

export interface FirstPersonCameraOptions {
  readonly cameraState: CameraStateHandle;
  readonly inputState: InputStateHandle;
  readonly three?: ThreeContextHandle;
  readonly store?: EditorStore;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly enabled?: boolean;
  readonly movementEnabled?: boolean;
  readonly lookEnabled?: boolean;
  readonly dispatchToStore?: boolean;
  readonly syncToThree?: boolean;
  readonly resetInputDeltasAfterUpdate?: boolean;

  readonly sensitivity?: number;
  readonly invertY?: boolean;
  readonly maxDeltaMs?: number;
  readonly minPitch?: number;
  readonly maxPitch?: number;
  readonly verticalMovementEnabled?: boolean;
}

export interface FirstPersonCameraUpdateInput {
  readonly deltaMs: number;
  readonly reason?: string;
}

export interface FirstPersonCameraSnapshot {
  readonly kind: "first-person-camera-snapshot.v1";
  readonly status: FirstPersonCameraStatus;
  readonly enabled: boolean;
  readonly movementEnabled: boolean;
  readonly lookEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly updateCount: number;
  readonly movedCount: number;
  readonly rotatedCount: number;
  readonly lastUpdateAt: string | null;
  readonly lastDeltaMs: number | null;
  readonly sensitivity: number;
  readonly invertY: boolean;
  readonly position: CameraVector3;
  readonly rotation: CameraEuler3;
  readonly lastMovementVector: CameraVector3;
  readonly lastLookDelta: {
    readonly x: number;
    readonly y: number;
  };
  readonly lastError: Record<string, unknown> | null;
}

export interface FirstPersonCameraHandle {
  readonly kind: "vectoplan-editor-first-person-camera.v1";

  initialize(): void;
  update(input: FirstPersonCameraUpdateInput): CameraStateSnapshot;

  enable(reason?: string): void;
  disable(reason?: string): void;
  pause(reason?: string): void;
  resume(reason?: string): void;

  setSensitivity(value: number): void;
  setInvertY(value: boolean): void;
  setMovementEnabled(value: boolean): void;
  setLookEnabled(value: boolean): void;

  syncToThree(reason?: string): void;
  syncToStore(reason?: string): void;

  getStatus(): FirstPersonCameraStatus;
  getSnapshot(): FirstPersonCameraSnapshot;

  destroy(reason?: string): void;
}

const FIRST_PERSON_CAMERA_KIND = "vectoplan-editor-first-person-camera.v1" as const;
const FIRST_PERSON_CAMERA_SNAPSHOT_KIND = "first-person-camera-snapshot.v1" as const;

const DEFAULT_SENSITIVITY = 0.0022;
const DEFAULT_MAX_DELTA_MS = 80;
const DEFAULT_MIN_PITCH = -Math.PI / 2 + 0.001;
const DEFAULT_MAX_PITCH = Math.PI / 2 - 0.001;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
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

function normalizeSensitivity(value: unknown): number {
  return safeNumber(value, DEFAULT_SENSITIVITY, {
    min: 0.00001,
    max: 0.1,
  });
}

function normalizeDeltaMs(value: unknown, maxDeltaMs: number): number {
  return safeNumber(value, 0, {
    min: 0,
    max: maxDeltaMs,
  });
}

function normalizePitch(value: unknown, minPitch: number, maxPitch: number): number {
  return safeNumber(value, 0, {
    min: minPitch,
    max: maxPitch,
  });
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

function zeroVector(): CameraVector3 {
  return {
    x: 0,
    y: 0,
    z: 0,
  };
}

function vectorLength(value: CameraVector3): number {
  try {
    return Math.hypot(value.x, value.y, value.z);
  } catch {
    return 0;
  }
}

function normalizeVector(value: CameraVector3): CameraVector3 {
  try {
    const length = vectorLength(value);

    if (!Number.isFinite(length) || length <= 0.000001) {
      return zeroVector();
    }

    return {
      x: value.x / length,
      y: value.y / length,
      z: value.z / length,
    };
  } catch {
    return zeroVector();
  }
}

function addVector(left: CameraVector3, right: CameraVector3): CameraVector3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

function scaleVector(value: CameraVector3, scalar: number): CameraVector3 {
  return {
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar,
  };
}

function hasAction(snapshot: InputStateSnapshot, action: KeyboardActionKey): boolean {
  try {
    return snapshot.keyboard.pressedActionKeys.includes(action);
  } catch {
    return false;
  }
}

function computeMovementDirection(input: InputStateSnapshot, basis: CameraBasis, verticalMovementEnabled: boolean): CameraVector3 {
  try {
    let direction = zeroVector();

    if (hasAction(input, "move-forward")) {
      direction = addVector(direction, basis.forward);
    }

    if (hasAction(input, "move-backward")) {
      direction = addVector(direction, scaleVector(basis.forward, -1));
    }

    if (hasAction(input, "move-right")) {
      direction = addVector(direction, basis.right);
    }

    if (hasAction(input, "move-left")) {
      direction = addVector(direction, scaleVector(basis.right, -1));
    }

    if (verticalMovementEnabled && hasAction(input, "move-up")) {
      direction = addVector(direction, {
        x: 0,
        y: 1,
        z: 0,
      });
    }

    if (verticalMovementEnabled && hasAction(input, "move-down")) {
      direction = addVector(direction, {
        x: 0,
        y: -1,
        z: 0,
      });
    }

    return normalizeVector(direction);
  } catch {
    return zeroVector();
  }
}

function movementSpeedFromSnapshot(camera: CameraStateSnapshot, input: InputStateSnapshot): number {
  try {
    const sprinting = hasAction(input, "sprint") || input.keyboard.modifiers.shift;
    const baseSpeed = camera.movement.moveSpeed;
    const multiplier = sprinting ? camera.movement.sprintMultiplier : 1;

    return baseSpeed * multiplier;
  } catch {
    return 0;
  }
}

function computeNextRotation(input: {
  readonly current: CameraEuler3;
  readonly pointer: InputStateSnapshot["pointer"];
  readonly sensitivity: number;
  readonly invertY: boolean;
  readonly minPitch: number;
  readonly maxPitch: number;
}): {
  readonly rotation: CameraEuler3;
  readonly changed: boolean;
  readonly lookDelta: {
    readonly x: number;
    readonly y: number;
  };
} {
  try {
    const deltaX = input.pointer.delta.x;
    const deltaY = input.pointer.delta.y;

    if (deltaX === 0 && deltaY === 0) {
      return {
        rotation: input.current,
        changed: false,
        lookDelta: {
          x: 0,
          y: 0,
        },
      };
    }

    const nextYaw = normalizeYaw(input.current.yaw - (deltaX * input.sensitivity));
    const yFactor = input.invertY ? -1 : 1;
    const nextPitch = normalizePitch(
      input.current.pitch - (deltaY * input.sensitivity * yFactor),
      input.minPitch,
      input.maxPitch,
    );

    return {
      rotation: {
        pitch: nextPitch,
        yaw: nextYaw,
        roll: input.current.roll,
      },
      changed: nextPitch !== input.current.pitch || nextYaw !== input.current.yaw,
      lookDelta: {
        x: deltaX,
        y: deltaY,
      },
    };
  } catch {
    return {
      rotation: input.current,
      changed: false,
      lookDelta: {
        x: 0,
        y: 0,
      },
    };
  }
}

function syncCameraToThree(three: ThreeContextHandle | undefined, cameraSnapshot: CameraStateSnapshot): void {
  try {
    if (!three) {
      return;
    }

    three.setCameraPosition(cameraSnapshot.position);
    three.setCameraRotation({
      x: cameraSnapshot.rotation.pitch,
      y: cameraSnapshot.rotation.yaw,
      z: cameraSnapshot.rotation.roll,
    });

    const projection = cameraSnapshot.projection;
    const camera = three.getCamera();
    camera.fov = projection.fov;
    camera.near = projection.near;
    camera.far = projection.far;
    camera.aspect = projection.aspect;
    camera.updateProjectionMatrix();
  } catch {
    // Three sync is best-effort; caller handles logging if needed.
  }
}

function syncCameraToStore(store: EditorStore | undefined, cameraSnapshot: CameraStateSnapshot, reason: string): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "camera/update",
        position: cameraSnapshot.position,
        rotation: cameraSnapshot.rotation,
        isSprinting: cameraSnapshot.movement.isSprinting,
        createdAt: now(),
        source: reason,
      }),
      {
        action: reason,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store sync must not break camera runtime.
  }
}

function attachAbortSignal(signal: AbortSignal | undefined, destroy: () => void): () => void {
  try {
    if (!signal) {
      return () => undefined;
    }

    if (signal.aborted) {
      destroy();
      return () => undefined;
    }

    const onAbort = (): void => {
      destroy();
    };

    signal.addEventListener("abort", onAbort, {
      once: true,
    });

    return () => {
      try {
        signal.removeEventListener("abort", onAbort);
      } catch {
        // Ignore.
      }
    };
  } catch {
    return () => undefined;
  }
}

export function createFirstPersonCamera(options: FirstPersonCameraOptions): FirstPersonCameraHandle {
  const cameraState = options.cameraState;
  const inputState = options.inputState;
  const three = options.three;
  const store = options.store;
  const logger = options.logger;

  const createdAt = now();

  let status: FirstPersonCameraStatus = "created";
  let enabled = safeBoolean(options.enabled, true);
  let movementEnabled = safeBoolean(options.movementEnabled, true);
  let lookEnabled = safeBoolean(options.lookEnabled, true);
  let dispatchToStore = safeBoolean(options.dispatchToStore, true);
  let syncThree = safeBoolean(options.syncToThree, true);
  let resetInputDeltasAfterUpdate = safeBoolean(options.resetInputDeltasAfterUpdate, true);
  let verticalMovementEnabled = safeBoolean(options.verticalMovementEnabled, true);

  let sensitivity = normalizeSensitivity(options.sensitivity);
  let invertY = safeBoolean(options.invertY, false);
  let maxDeltaMs = safeNumber(options.maxDeltaMs, DEFAULT_MAX_DELTA_MS, {
    min: 1,
    max: 1_000,
  });
  let minPitch = safeNumber(options.minPitch, DEFAULT_MIN_PITCH, {
    min: -Math.PI / 2,
    max: 0,
  });
  let maxPitch = safeNumber(options.maxPitch, DEFAULT_MAX_PITCH, {
    min: 0,
    max: Math.PI / 2,
  });

  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let destroyed = false;
  let updateCount = 0;
  let movedCount = 0;
  let rotatedCount = 0;
  let lastUpdateAt: string | null = null;
  let lastDeltaMs: number | null = null;
  let lastMovementVector = zeroVector();
  let lastLookDelta = {
    x: 0,
    y: 0,
  };
  let lastError: Record<string, unknown> | null = null;

  const cleanupCallbacks: Array<() => void> = [];

  function setStatus(nextStatus: FirstPersonCameraStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function setError(error: unknown): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed");
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

  function currentCameraSnapshot(): CameraStateSnapshot {
    return cameraState.getSnapshot();
  }

  function syncAll(reason: string): void {
    const snapshot = currentCameraSnapshot();

    if (syncThree) {
      syncCameraToThree(three, snapshot);
    }

    if (dispatchToStore) {
      syncCameraToStore(store, snapshot, reason);
    }
  }

  function initialize(): void {
    if (!assertAlive("initialize")) {
      return;
    }

    try {
      syncAll("first-person-camera.initialize");
      setStatus(enabled ? "initialized" : "disabled");

      logDebug(logger, "First-person camera initialized.", {
        enabled,
        movementEnabled,
        lookEnabled,
        sensitivity,
        invertY,
      });
    } catch (error) {
      setError(error);
      logWarn(logger, "First-person camera initialization failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function update(updateInput: FirstPersonCameraUpdateInput): CameraStateSnapshot {
    if (!assertAlive("update")) {
      return currentCameraSnapshot();
    }

    try {
      if (!enabled || status === "paused" || status === "disabled") {
        return currentCameraSnapshot();
      }

      setStatus("active");

      const deltaMs = normalizeDeltaMs(updateInput.deltaMs, maxDeltaMs);
      const deltaSeconds = deltaMs / 1000;
      const input = inputState.getSnapshot();
      let camera = currentCameraSnapshot();

      lastMovementVector = zeroVector();
      lastLookDelta = {
        x: 0,
        y: 0,
      };

      if (lookEnabled) {
        const rotationResult = computeNextRotation({
          current: camera.rotation,
          pointer: input.pointer,
          sensitivity,
          invertY,
          minPitch,
          maxPitch,
        });

        if (rotationResult.changed) {
          camera = cameraState.setRotation(rotationResult.rotation, {
            reason: "first-person-camera.look",
          });
          rotatedCount += 1;
        }

        lastLookDelta = rotationResult.lookDelta;
      }

      if (movementEnabled) {
        const latestCamera = cameraState.getSnapshot();
        const direction = computeMovementDirection(input, latestCamera.basis, verticalMovementEnabled);
        const speed = movementSpeedFromSnapshot(latestCamera, input);
        const movementVector = scaleVector(direction, speed * deltaSeconds);

        if (vectorLength(movementVector) > 0.000001) {
          camera = cameraState.translate(movementVector, {
            reason: "first-person-camera.move",
          });
          cameraState.setSprinting(hasActionSafe(input, "sprint"), {
            reason: "first-person-camera.sprint",
          });
          movedCount += 1;
        }

        lastMovementVector = movementVector;
      }

      syncAll(updateInput.reason ?? "first-person-camera.update");

      if (resetInputDeltasAfterUpdate) {
        inputState.resetDeltas();
      }

      updateCount += 1;
      lastUpdateAt = now();
      lastDeltaMs = deltaMs;
      setStatus("active");

      return cameraState.getSnapshot();
    } catch (error) {
      setError(error);
      logWarn(logger, "First-person camera update failed.", {
        error: normalizeUnknownError(error),
        deltaMs: updateInput.deltaMs,
        reason: updateInput.reason ?? null,
      });

      return cameraState.getSnapshot();
    }
  }

  function hasActionSafe(input: InputStateSnapshot, action: KeyboardActionKey): boolean {
    try {
      return input.keyboard.pressedActionKeys.includes(action) || (
        action === "sprint" && input.keyboard.modifiers.shift
      );
    } catch {
      return false;
    }
  }

  const handle: FirstPersonCameraHandle = {
    kind: FIRST_PERSON_CAMERA_KIND,

    initialize,
    update,

    enable(reason?: string): void {
      if (!assertAlive("enable")) {
        return;
      }

      enabled = true;
      setStatus("initialized");
      logDebug(logger, "First-person camera enabled.", {
        reason: reason ?? null,
      });
    },

    disable(reason?: string): void {
      if (!assertAlive("disable")) {
        return;
      }

      enabled = false;
      setStatus("disabled");
      logDebug(logger, "First-person camera disabled.", {
        reason: reason ?? null,
      });
    },

    pause(reason?: string): void {
      if (!assertAlive("pause")) {
        return;
      }

      setStatus("paused");
      logDebug(logger, "First-person camera paused.", {
        reason: reason ?? null,
      });
    },

    resume(reason?: string): void {
      if (!assertAlive("resume")) {
        return;
      }

      setStatus(enabled ? "active" : "disabled");
      logDebug(logger, "First-person camera resumed.", {
        reason: reason ?? null,
      });
    },

    setSensitivity(value: number): void {
      sensitivity = normalizeSensitivity(value);
    },

    setInvertY(value: boolean): void {
      invertY = safeBoolean(value, invertY);
    },

    setMovementEnabled(value: boolean): void {
      movementEnabled = safeBoolean(value, movementEnabled);
    },

    setLookEnabled(value: boolean): void {
      lookEnabled = safeBoolean(value, lookEnabled);
    },

    syncToThree(reason?: string): void {
      if (!assertAlive("syncToThree")) {
        return;
      }

      try {
        syncCameraToThree(three, cameraState.getSnapshot());
        logDebug(logger, "First-person camera synced to Three.", {
          reason: reason ?? null,
        });
      } catch (error) {
        setError(error);
      }
    },

    syncToStore(reason?: string): void {
      if (!assertAlive("syncToStore")) {
        return;
      }

      try {
        syncCameraToStore(store, cameraState.getSnapshot(), reason ?? "first-person-camera.syncToStore");
      } catch (error) {
        setError(error);
      }
    },

    getStatus(): FirstPersonCameraStatus {
      return status;
    },

    getSnapshot(): FirstPersonCameraSnapshot {
      const snapshot = cameraState.getSnapshot();

      return {
        kind: FIRST_PERSON_CAMERA_SNAPSHOT_KIND,
        status,
        enabled,
        movementEnabled,
        lookEnabled,
        createdAt,
        updatedAt,
        destroyedAt,
        updateCount,
        movedCount,
        rotatedCount,
        lastUpdateAt,
        lastDeltaMs,
        sensitivity,
        invertY,
        position: snapshot.position,
        rotation: snapshot.rotation,
        lastMovementVector,
        lastLookDelta,
        lastError,
      };
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      destroyedAt = now();

      for (const cleanup of cleanupCallbacks.splice(0)) {
        try {
          cleanup();
        } catch {
          // Ignore cleanup failure.
        }
      }

      setStatus("destroyed");

      logDebug(logger, "First-person camera destroyed.", {
        reason: reason ?? null,
        updateCount,
        movedCount,
        rotatedCount,
      });
    },
  };

  cleanupCallbacks.push(
    attachAbortSignal(options.signal, () => {
      handle.destroy("abort-signal");
    }),
  );

  return handle;
}

export function isFirstPersonCameraHandle(value: unknown): value is FirstPersonCameraHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<FirstPersonCameraHandle>;

    return (
      record.kind === FIRST_PERSON_CAMERA_KIND
      && typeof record.initialize === "function"
      && typeof record.update === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}