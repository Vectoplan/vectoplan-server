// src/frontend/runtime/scene/scene_runtime.ts
import {
  isChunkApiFailedResult,
  type ChunkApiClient,
} from "@api/chunk_api_models";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";
import {
  getEditorCanvas,
  hideDomLoadingOverlay,
  setDomBootMessage,
  setDomCrosshair,
  setDomHotbarVisibility,
  setDomLiveMessage,
  setDomProjectLabel,
  setDomSourceStatus,
  showDomFatalError,
  type EditorDomRefs,
} from "@dom/dom_refs";
import {
  createEditorResizeObserver,
  type EditorResizeObserverHandle,
  type EditorResizeSnapshot,
} from "@dom/resize_observer";
import {
  createEditorInputController,
  type EditorInputControllerHandle,
} from "@input/input_controller";
import type { InputStateHandle } from "@input/input_state";
import type { KeyboardInputHandle } from "@input/keyboard_input";
import type { MouseInputHandle } from "@input/mouse_input";
import type { PointerLockHandle } from "@input/pointer_lock";
import {
  createCameraState,
  type CameraStateHandle,
  type CameraStateSnapshot,
} from "@camera/camera_state";
import {
  createFirstPersonCameraController,
  type CameraObjectLike,
  type FirstPersonCameraControllerHandle,
  type FirstPersonCameraSnapshot,
} from "@camera/first_person_camera_controller";
import {
  createChunkInventorySource,
  type ChunkInventorySourceHandle,
} from "@inventory/chunk_inventory_source";
import {
  createHotbarController,
  type HotbarControllerHandle,
} from "@inventory/hotbar_controller";
import { createDebugOverlay, type DebugOverlayHandle } from "@render/debug_overlay";
import { createChunkScene, type ChunkSceneHandle } from "@render/chunk_scene";
import { createPreviewRenderer, type PreviewRendererHandle } from "@render/preview_renderer";
import { createThreeContext, type ThreeContextHandle } from "@render/three_context";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import {
  selectActiveBlockTypeId,
  selectCanPlaceBlock,
  selectCanRemoveBlock,
  selectCrosshairVisible,
  selectPointerLocked,
  selectSelectedInventoryItem,
  selectSelectedSlot,
  selectTargeting,
} from "@state/state_selectors";
import { createChunkCellAddress } from "@runtime/world/chunk_coordinates";
import type { WorldRuntimeHandle } from "@runtime/world/world_runtime";
import {
  createPhysicsRuntime,
  type PhysicsRuntime,
  type PhysicsRuntimeFrameResult,
} from "@runtime/physics/physics_runtime";
import type {
  PhysicsCameraBinding,
  PhysicsEulerAngles,
} from "@runtime/physics/physics_models";
import { createChunkTargeting, type ChunkTargetingHandle } from "@targeting/chunk_targeting";
import type { EditorLogger } from "@utils/logger";
import { createEditorId } from "@utils/ids";
import { normalizeUnknownError, safeBoolean, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import {
  createSceneChunkTools,
  type SceneChunkToolsHandle,
  type SceneChunkToolExecutionResult,
} from "./scene_chunk_tools";
import {
  createSceneLifecycle,
  type SceneLifecycleHandle,
} from "./scene_lifecycle";
import {
  createSceneLoop,
  type SceneLoopHandle,
} from "./scene_loop";
import {
  createSceneWorldBridge,
  type SceneWorldBridgeHandle,
} from "./scene_world_bridge";

export type SceneRuntimeStatus =
  | "created"
  | "initializing"
  | "ready"
  | "running"
  | "paused"
  | "failed"
  | "destroying"
  | "destroyed";

export interface SceneRuntimeOptions {
  readonly bootstrap: EditorBootstrap;
  readonly store: EditorStore;
  readonly domRefs: EditorDomRefs;
  readonly worldRuntime: WorldRuntimeHandle;
  readonly chunkApiClient: ChunkApiClient;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
}

export interface SceneRuntimeSnapshot {
  readonly kind: "scene-runtime-snapshot.v1";
  readonly id: string;
  readonly status: SceneRuntimeStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly initializedAt: string | null;
  readonly readyAt: string | null;
  readonly runningAt: string | null;
  readonly destroyedAt: string | null;
  readonly bootstrapped: boolean;
  readonly initialized: boolean;
  readonly destroyed: boolean;
  readonly projectId: string;
  readonly worldId: string;
  readonly activeBlockTypeId: string | null;
  readonly selectedSlot: number | null;
  readonly lastCameraChunkKey: string | null;
  readonly lastPrimaryResult: SceneChunkToolExecutionResult | null;
  readonly lastSecondaryResult: SceneChunkToolExecutionResult | null;
  readonly lastError: Record<string, unknown> | null;
  readonly lifecycle: ReturnType<SceneLifecycleHandle["getSnapshot"]>;
  readonly loop: ReturnType<SceneLoopHandle["getSnapshot"]> | null;
  readonly world: ReturnType<WorldRuntimeHandle["getSnapshot"]> | null;
  readonly resize: ReturnType<EditorResizeObserverHandle["getSnapshot"]> | null;
  readonly three: ReturnType<ThreeContextHandle["getSnapshot"]> | null;
  readonly chunkScene: ReturnType<ChunkSceneHandle["getSnapshot"]> | null;
  readonly worldBridge: ReturnType<SceneWorldBridgeHandle["getSnapshot"]> | null;
  readonly inputController: ReturnType<EditorInputControllerHandle["getSnapshot"]> | null;
  readonly input: ReturnType<InputStateHandle["getSnapshot"]> | null;
  readonly keyboard: ReturnType<KeyboardInputHandle["getSnapshot"]> | null;
  readonly mouse: ReturnType<MouseInputHandle["getSnapshot"]> | null;
  readonly pointerLock: ReturnType<PointerLockHandle["getSnapshot"]> | null;
  readonly camera: CameraStateSnapshot | null;
  readonly firstPersonCamera: ReturnType<FirstPersonCameraControllerHandle["getSnapshot"]> | null;
  readonly physics: ReturnType<PhysicsRuntime["snapshot"]> | null;
  readonly targeting: ReturnType<ChunkTargetingHandle["getSnapshot"]> | null;
  readonly chunkTools: ReturnType<SceneChunkToolsHandle["getSnapshot"]> | null;
  readonly hotbar: ReturnType<HotbarControllerHandle["getSnapshot"]> | null;
  readonly inventory: ReturnType<ChunkInventorySourceHandle["getSnapshot"]> | null;
  readonly preview: ReturnType<PreviewRendererHandle["getSnapshot"]> | null;
  readonly debugOverlay: ReturnType<DebugOverlayHandle["getSnapshot"]> | null;
}

export interface SceneRuntimeHandle {
  readonly kind: "vectoplan-editor-scene-runtime.v1";

  initialize(): Promise<void>;
  start(reason?: string): void;
  pause(reason?: string): void;
  resume(reason?: string): void;

  requestRender(reason?: string): void;
  requestFullRefresh(reason?: string): Promise<void>;
  reloadDirtyChunks(reason?: string): Promise<void>;

  executePrimary(reason?: string): Promise<SceneChunkToolExecutionResult | null>;
  executeSecondary(reason?: string): Promise<SceneChunkToolExecutionResult | null>;

  getStatus(): SceneRuntimeStatus;
  getSnapshot(): SceneRuntimeSnapshot;

  getLifecycle(): SceneLifecycleHandle;
  getLoop(): SceneLoopHandle | null;
  getThreeContext(): ThreeContextHandle | null;
  getWorldRuntime(): WorldRuntimeHandle;
  getChunkScene(): ChunkSceneHandle | null;
  getWorldBridge(): SceneWorldBridgeHandle | null;
  getTargeting(): ChunkTargetingHandle | null;
  getChunkTools(): SceneChunkToolsHandle | null;
  getHotbar(): HotbarControllerHandle | null;
  getInputController(): EditorInputControllerHandle | null;

  destroy(reason?: string): Promise<void>;
}

const SCENE_RUNTIME_KIND = "vectoplan-editor-scene-runtime.v1" as const;
const SCENE_RUNTIME_SNAPSHOT_KIND = "scene-runtime-snapshot.v1" as const;

interface RuntimeVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface RuntimeForwardVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

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

function nowMs(): number {
  try {
    return Date.now();
  } catch {
    return 0;
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
        message: "Unknown scene runtime error.",
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
    // Scene runtime logging must never break runtime.
  }
}

function logInfo(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.info?.(message, details);
  } catch {
    // Scene runtime logging must never break runtime.
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
    // Scene runtime logging must never break runtime.
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasMethod<T extends object, K extends string>(
  value: T | null | undefined,
  methodName: K,
): value is T & Record<K, (...args: readonly unknown[]) => unknown> {
  try {
    return Boolean(value && typeof (value as Record<string, unknown>)[methodName] === "function");
  } catch {
    return false;
  }
}

function callOptionalMethod(
  value: unknown,
  methodName: string,
  args: readonly unknown[],
): boolean {
  try {
    const record = asRecord(value);

    if (!record || typeof record[methodName] !== "function") {
      return false;
    }

    (record[methodName] as (...methodArgs: readonly unknown[]) => unknown)(...args);
    return true;
  } catch {
    return false;
  }
}

function isCameraObjectLike(value: unknown): value is CameraObjectLike {
  try {
    const record = asRecord(value);
    const position = asRecord(record?.position);
    const rotation = asRecord(record?.rotation);

    return Boolean(
      position
      && rotation
      && typeof position.x === "number"
      && typeof position.y === "number"
      && typeof position.z === "number"
      && typeof rotation.x === "number"
      && typeof rotation.y === "number"
      && typeof rotation.z === "number",
    );
  } catch {
    return false;
  }
}

function extractCameraFromThree(threeContext: ThreeContextHandle): CameraObjectLike {
  const candidates: unknown[] = [];

  try {
    if (hasMethod(threeContext, "getCamera")) {
      candidates.push(threeContext.getCamera());
    }
  } catch {
    // Continue with other candidates.
  }

  try {
    if (hasMethod(threeContext, "getThreeCamera")) {
      candidates.push(threeContext.getThreeCamera());
    }
  } catch {
    // Continue with other candidates.
  }

  try {
    if (hasMethod(threeContext, "getPerspectiveCamera")) {
      candidates.push(threeContext.getPerspectiveCamera());
    }
  } catch {
    // Continue with other candidates.
  }

  try {
    const record = asRecord(threeContext);
    candidates.push(record?.camera);
    candidates.push(record?.threeCamera);
    candidates.push(record?.perspectiveCamera);
  } catch {
    // Continue with validation.
  }

  for (const candidate of candidates) {
    if (isCameraObjectLike(candidate)) {
      return candidate;
    }
  }

  throw new Error("Three camera object could not be resolved from ThreeContext.");
}

function normalizeVector3(value: unknown, fallback: RuntimeVector3): RuntimeVector3 {
  try {
    const record = asRecord(value);

    return {
      x: safeNumber(record?.x, fallback.x),
      y: safeNumber(record?.y, fallback.y),
      z: safeNumber(record?.z, fallback.z),
    };
  } catch {
    return fallback;
  }
}

function normalizeRuntimeForwardVector(vector: RuntimeForwardVector): RuntimeForwardVector {
  try {
    const length = Math.hypot(vector.x, vector.y, vector.z);

    if (length <= 0.000001) {
      return {
        x: 0,
        y: 0,
        z: -1,
      };
    }

    return {
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length,
    };
  } catch {
    return {
      x: 0,
      y: 0,
      z: -1,
    };
  }
}

function forwardVectorFromAngles(input: {
  readonly yaw: number;
  readonly pitch: number;
}): RuntimeForwardVector {
  try {
    const yaw = safeNumber(input.yaw, 0);
    const pitch = safeNumber(input.pitch, 0);
    const cosPitch = Math.cos(pitch);

    return normalizeRuntimeForwardVector({
      x: -Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    });
  } catch {
    return {
      x: 0,
      y: 0,
      z: -1,
    };
  }
}

function physicsAnglesFromFirstPersonSnapshot(snapshot: FirstPersonCameraSnapshot): PhysicsEulerAngles {
  try {
    return {
      yaw: safeNumber(snapshot.angles.yaw, 0),
      pitch: safeNumber(snapshot.angles.pitch, 0),
      roll: safeNumber(snapshot.angles.roll, 0),
    };
  } catch {
    return {
      yaw: 0,
      pitch: 0,
      roll: 0,
    };
  }
}

function createPhysicsRuntimeConfigFromBootstrap(bootstrap: EditorBootstrap) {
  const physics = bootstrap.runtime.physics ?? bootstrap.physics;
  const collider = physics.collider;
  const movement = physics.movement;
  const timing = physics.timing;

  const physicsConfig = {
    enabled: physics.enabled,
    timing: {
      fixedTimeStepSeconds: timing.fixedTimeStepSeconds,
      maxFrameDeltaSeconds: timing.maxFrameDeltaSeconds,
      maxSubSteps: timing.maxSubSteps,
    },
    movement: {
      walkSpeed: movement.walkSpeed,
      sprintSpeed: movement.sprintSpeed,
      airControlSpeed: movement.airControlSpeed,
      flySpeed: movement.flySpeed,
      flySprintSpeed: movement.flySprintSpeed,
      jumpVelocity: movement.jumpVelocity,
      gravity: movement.gravity,
      maxFallSpeed: movement.maxFallSpeed,
      groundSnapDistance: movement.groundSnapDistance,
    },
    input: {
      doubleTapWindowMs: physics.input.doubleTapWindowMs,
      allowJumpBeforeFlightToggle: physics.input.allowJumpBeforeFlightToggle,
    },
    collider: {
      kind: collider.kind,
      width: collider.width,
      height: collider.height,
      eyeHeight: collider.eyeHeight,
      skinWidth: collider.skinWidth,
    },
    missingChunks: {
      policy: physics.missingChunks.policy,
      blockHorizontalMovement: physics.missingChunks.blockHorizontalMovement,
      blockVerticalMovement: physics.missingChunks.blockVerticalMovement,
    },
    debug: {
      enabled: physics.debug.enabled,
      exposeToStore: physics.debug.exposeToStore,
      includeCollisionCells: physics.debug.includeCollisionCells,
    },
  };

  return {
    enabled: physics.enabled,
    physics: physicsConfig,
    controller: {
      physics: physicsConfig,
      collision: {
        enabled: physics.enabled,
        epsilon: 0.000001,
        skinWidth: collider.skinWidth,
        includeTraceCells: physics.debug.includeCollisionCells,
        groundProbeDistance: Math.max(0.01, movement.groundSnapDistance),
        ceilingProbeDistance: Math.max(0.01, collider.skinWidth * 4),
        maxCellsPerQuery: 262_144,
      },
      yawForwardSign: 1,
      preserveHorizontalVelocityWhenNoInput: false,
      horizontalDampingPerSecond: 24,
      airborneHorizontalDampingPerSecond: 8,
      flyingDampingPerSecond: 18,
    },
    fixedTimeStepSeconds: timing.fixedTimeStepSeconds,
    maxFrameDeltaSeconds: timing.maxFrameDeltaSeconds,
    maxSubSteps: timing.maxSubSteps,
    exposeWarnings: true,
    failClosedWithoutQuery: true,
  };
}

function shouldUseScenePhysicsRuntime(bootstrap: EditorBootstrap): boolean {
  try {
    const physics = bootstrap.runtime.physics ?? bootstrap.physics;

    return Boolean(
      physics.enabled
      && bootstrap.featureFlags.physicsEnabled
      && bootstrap.featureFlags.playerCollisionEnabled,
    );
  } catch {
    return false;
  }
}

function shouldSceneCameraFollowPhysics(bootstrap: EditorBootstrap): boolean {
  try {
    return Boolean(
      shouldUseScenePhysicsRuntime(bootstrap)
      && bootstrap.camera.physicsFollowEnabled,
    );
  } catch {
    return false;
  }
}

function dispatchDebugError(store: EditorStore, error: unknown, source: string): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "debug/error",
        error,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break runtime.
  }
}

function dispatchUiLoading(store: EditorStore, loading: boolean, message: string | null, source: string): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "ui/loading",
        loading,
        message,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break runtime.
  }
}

function dispatchUiError(store: EditorStore, title: string, message: string, source: string): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "ui/error",
        title,
        message,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break runtime.
  }
}

function dispatchUiFlag(
  store: EditorStore,
  actionKind: "ui/crosshair" | "ui/hotbar",
  visible: boolean,
  source: string,
): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: actionKind,
        visible,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break runtime.
  }
}

function dispatchRenderInitialized(store: EditorStore, initialized: boolean): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "render/initialized",
        initialized,
        createdAt: now(),
        source: "scene-runtime.render-initialized",
      }),
      {
        action: "scene-runtime.render-initialized",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break runtime.
  }
}

function dispatchInventoryCatalogFromSource(
  store: EditorStore,
  catalog: unknown,
  source: string,
): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "inventory/catalog-loaded",
        catalog: catalog as never,
        createdAt: now(),
        source,
      }),
      {
        action: source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Inventory dispatch must not break runtime.
  }
}

function normalizeActiveBlockTypeId(value: unknown, fallback: string | null): string | null {
  try {
    const normalized = safeString(value, "");

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function worldPositionFromVector(position: RuntimeVector3): {
  readonly x: number;
  readonly y: number;
  readonly z: number;
} {
  return {
    x: position.x,
    y: position.y,
    z: position.z,
  };
}

function booleanFeature(value: unknown, fallback: boolean): boolean {
  try {
    return safeBoolean(value, fallback);
  } catch {
    return fallback;
  }
}

async function safeDestroyHandle(
  label: string,
  value: unknown,
  logger: EditorLogger | undefined,
  reason: string,
): Promise<void> {
  try {
    if (!value || typeof value !== "object") {
      return;
    }

    if (hasMethod(value, "destroy")) {
      await value.destroy(reason);
      return;
    }

    if (hasMethod(value, "dispose")) {
      await value.dispose(reason);
      return;
    }

    if (hasMethod(value, "stop")) {
      await value.stop(reason);
    }
  } catch (error) {
    logWarn(logger, `${label} cleanup failed.`, {
      reason,
      error: normalizeErrorRecord(error),
    });
  }
}

function snapshotOrNull<T>(reader: () => T): T | null {
  try {
    return reader();
  } catch {
    return null;
  }
}

export function createSceneRuntime(options: SceneRuntimeOptions): SceneRuntimeHandle {
  const sceneLogger = options.logger?.child?.("scene_runtime") ?? options.logger;
  const id = createEditorId({
    prefix: "scene_runtime",
  });
  const createdAt = now();

  const lifecycle = createSceneLifecycle({
    ...(sceneLogger ? { logger: sceneLogger.child?.("lifecycle") ?? sceneLogger } : {}),
    ...(options.signal ? { parentSignal: options.signal } : {}),
    id: `${id}_lifecycle`,
    label: "scene-runtime",
    destroyOnParentAbort: true,
    throwOnCriticalCleanupFailure: false,
  });

  const bootstrap = options.bootstrap;
  const scenePhysics = bootstrap.runtime.physics ?? bootstrap.physics;
  const physicsRuntimeEnabled = shouldUseScenePhysicsRuntime(bootstrap);
  const cameraShouldFollowPhysics = shouldSceneCameraFollowPhysics(bootstrap);

  const store = options.store;
  const domRefs = options.domRefs;
  const worldRuntime = options.worldRuntime;
  const chunkApiClient = options.chunkApiClient;

  const pointerLockEnabled = booleanFeature(
    bootstrap.featureFlags.pointerLockEnabled && bootstrap.input.pointerLockEnabled,
    true,
  );
  const firstPersonEnabled = booleanFeature(bootstrap.featureFlags.firstPersonEnabled, true);
  const hotbarEnabled = booleanFeature(bootstrap.featureFlags.hotbarEnabled && bootstrap.ui.showHotbar, true);
  const crosshairEnabled = booleanFeature(bootstrap.featureFlags.crosshairEnabled && bootstrap.ui.showCrosshair, true);
  const inventoryEnabled = booleanFeature(bootstrap.featureFlags.chunkServiceInventoryEnabled, true);
  const debugOverlayEnabled = booleanFeature(
    bootstrap.featureFlags.debugOverlayEnabled && bootstrap.ui.showDebugOverlay,
    false,
  );

  let status: SceneRuntimeStatus = "created";
  let updatedAt = createdAt;
  let initializedAt: string | null = null;
  let readyAt: string | null = null;
  let runningAt: string | null = null;
  let destroyedAt: string | null = null;
  let initialized = false;
  let destroyed = false;
  let destroyPromise: Promise<void> | null = null;
  let lastError: Record<string, unknown> | null = null;
  let lastCameraChunkKey: string | null = null;
  let lastPrimaryResult: SceneChunkToolExecutionResult | null = null;
  let lastSecondaryResult: SceneChunkToolExecutionResult | null = null;

  let resizeObserver: EditorResizeObserverHandle | null = null;
  let three: ThreeContextHandle | null = null;
  let inputController: EditorInputControllerHandle | null = null;
  let cameraState: CameraStateHandle | null = null;
  let firstPersonCamera: FirstPersonCameraControllerHandle | null = null;
  let physicsRuntime: PhysicsRuntime | null = null;
  let chunkScene: ChunkSceneHandle | null = null;
  let worldBridge: SceneWorldBridgeHandle | null = null;
  let targeting: ChunkTargetingHandle | null = null;
  let chunkTools: SceneChunkToolsHandle | null = null;
  let inventorySource: ChunkInventorySourceHandle | null = null;
  let hotbar: HotbarControllerHandle | null = null;
  let preview: PreviewRendererHandle | null = null;
  let debugOverlay: DebugOverlayHandle | null = null;
  let loop: SceneLoopHandle | null = null;

  function setStatus(nextStatus: SceneRuntimeStatus): void {
    try {
      status = nextStatus;
      updatedAt = now();

      if (nextStatus === "ready") {
        readyAt = readyAt ?? updatedAt;
      }

      if (nextStatus === "running") {
        runningAt = runningAt ?? updatedAt;
      }

      if (nextStatus === "destroyed") {
        destroyedAt = destroyedAt ?? updatedAt;
      }
    } catch {
      status = nextStatus;
    }
  }

  function setError(error: unknown): void {
    lastError = normalizeErrorRecord(error);
    setStatus("failed");
    dispatchDebugError(store, error, "scene-runtime.error");
  }

  function assertAlive(action: string): void {
    if (destroyed || status === "destroyed" || status === "destroying") {
      throw new Error(`SceneRuntime is destroyed. Action '${action}' is not allowed.`);
    }
  }

  function applyUiBootstrapFlags(reason: string): void {
    try {
      setDomCrosshair(domRefs, {
        enabled: crosshairEnabled,
        visible: crosshairEnabled,
        variant: "neutral",
        pointerLocked: false,
        source: reason,
      });
      setDomHotbarVisibility(domRefs, hotbarEnabled);
      dispatchUiFlag(store, "ui/crosshair", crosshairEnabled, `${reason}.crosshair`);
      dispatchUiFlag(store, "ui/hotbar", hotbarEnabled, `${reason}.hotbar`);
    } catch (error) {
      logWarn(sceneLogger, "UI bootstrap flag sync failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function getActiveBlockTypeId(): string | null {
    try {
      const state = store.peekState();
      const selectedItem = selectSelectedInventoryItem(state);
      const fromSelectedItem = selectedItem?.blockTypeId ?? null;
      const fromStore = selectActiveBlockTypeId(state);
      const fromHotbar = hotbar?.getSelectedItem()?.blockTypeId ?? null;
      const fromBootstrap = bootstrap.inventory.defaultBlockTypeId;

      return normalizeActiveBlockTypeId(
        fromSelectedItem,
        normalizeActiveBlockTypeId(
          fromStore,
          normalizeActiveBlockTypeId(fromHotbar, fromBootstrap),
        ),
      );
    } catch {
      return bootstrap.inventory.defaultBlockTypeId;
    }
  }

  function getSelectedSlot(): number | null {
    try {
      const fromStore = selectSelectedSlot(store.peekState());

      if (typeof fromStore === "number") {
        return fromStore;
      }

      return hotbar?.getSelectedItem()?.slot ?? null;
    } catch {
      return null;
    }
  }

  function getCurrentCameraPosition(): RuntimeVector3 {
    try {
      const firstPersonSnapshot = firstPersonCamera?.getSnapshot();

      if (firstPersonSnapshot) {
        return normalizeVector3(firstPersonSnapshot.position, bootstrap.camera.spawn);
      }

      const camera = cameraState?.getSnapshot();

      if (camera) {
        return normalizeVector3(camera.position, bootstrap.camera.spawn);
      }

      return normalizeVector3(bootstrap.camera.spawn, {
        x: 0,
        y: 0,
        z: 0,
      });
    } catch {
      return normalizeVector3(bootstrap.camera.spawn, {
        x: 0,
        y: 0,
        z: 0,
      });
    }
  }

  function getCurrentCameraForward(): RuntimeForwardVector {
    try {
      const firstPersonSnapshot = firstPersonCamera?.getSnapshot();

      if (firstPersonSnapshot) {
        return forwardVectorFromAngles(firstPersonSnapshot.angles);
      }

      const camera = cameraState?.getSnapshot();

      if (camera?.basis?.forward) {
        return normalizeRuntimeForwardVector(normalizeVector3(camera.basis.forward, {
          x: 0,
          y: 0,
          z: -1,
        }));
      }

      return forwardVectorFromAngles({
        yaw: bootstrap.camera.rotation.yaw,
        pitch: bootstrap.camera.rotation.pitch,
      });
    } catch {
      return {
        x: 0,
        y: 0,
        z: -1,
      };
    }
  }

  function syncCameraStateFromFirstPersonSnapshot(
    snapshot: FirstPersonCameraSnapshot,
    reason: string,
  ): void {
    try {
      if (!cameraState) {
        return;
      }

      const rotation = {
        pitch: snapshot.angles.pitch,
        yaw: snapshot.angles.yaw,
        roll: snapshot.angles.roll,
      };

      const transformWasApplied =
        callOptionalMethod(cameraState, "setTransform", [{
          position: snapshot.position,
          rotation,
          reason,
        }])
        || callOptionalMethod(cameraState, "updateTransform", [{
          position: snapshot.position,
          rotation,
          reason,
        }])
        || callOptionalMethod(cameraState, "setCamera", [{
          position: snapshot.position,
          rotation,
          reason,
        }]);

      if (transformWasApplied) {
        return;
      }

      callOptionalMethod(cameraState, "setPosition", [
        snapshot.position,
        {
          reason,
        },
      ]);

      callOptionalMethod(cameraState, "setRotation", [
        rotation,
        {
          reason,
        },
      ]);
    } catch (error) {
      logWarn(sceneLogger, "Camera state synchronization failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function syncCameraStateFromPhysicsBinding(
    binding: PhysicsCameraBinding,
    reason: string,
  ): void {
    try {
      cameraState?.applyPhysicsCameraBinding(binding, {
        reason,
        source: "player-physics",
      });
    } catch (error) {
      logWarn(sceneLogger, "Physics camera-state synchronization failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function dispatchPhysicsFrameToStore(
    frame: PhysicsRuntimeFrameResult,
    reason: string,
  ): void {
    try {
      store.setState(
        (previous) => applyEditorAction(previous, {
          kind: "player/update",
          input: {
            player: frame.player,
            camera: frame.camera,
            snapshot: physicsRuntime?.snapshot() ?? null,
            source: "physics-runtime",
            nowMs: nowMs(),
            error: frame.error,
            warnings: frame.warnings,
          },
          createdAt: now(),
          source: reason,
        }),
        {
          action: reason,
          notify: true,
          captureHistory: false,
        },
      );
    } catch (error) {
      logWarn(sceneLogger, "Physics frame store synchronization failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function dispatchPhysicsSnapshotToStore(reason: string): void {
    try {
      const snapshot = physicsRuntime?.snapshot();

      if (!snapshot) {
        return;
      }

      store.setState(
        (previous) => applyEditorAction(previous, {
          kind: "player/update",
          input: {
            player: snapshot.player,
            camera: firstPersonCamera
              ? {
                  bodyPosition: snapshot.player.position,
                  eyePosition: firstPersonCamera.getSnapshot().position,
                  angles: physicsAnglesFromFirstPersonSnapshot(firstPersonCamera.getSnapshot()),
                }
              : snapshot.camera,
            snapshot,
            source: "physics-runtime",
            nowMs: nowMs(),
            error: snapshot.lastError,
            warnings: snapshot.warnings,
          },
          createdAt: now(),
          source: reason,
        }),
        {
          action: reason,
          notify: true,
          captureHistory: false,
        },
      );
    } catch (error) {
      logWarn(sceneLogger, "Physics snapshot store synchronization failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function syncCrosshairFromState(reason: string): void {
    try {
      if (!crosshairEnabled) {
        setDomCrosshair(domRefs, {
          visible: false,
          enabled: false,
          variant: "neutral",
          source: reason,
        });
        return;
      }

      const state = store.peekState();
      const target = selectTargeting(state);
      const pointerLocked = selectPointerLocked(state);
      const visible = selectCrosshairVisible(state);
      const canPlace = selectCanPlaceBlock(state);
      const canRemove = selectCanRemoveBlock(state);

      const blocked =
        target.status === "blocked"
        || target.status === "invalid"
        || target.status === "missing-chunk"
        || target.status === "out-of-range";

      const variant =
        blocked
          ? "blocked"
          : canRemove
            ? "remove"
            : canPlace
              ? "place"
              : target.status === "valid"
                ? "target"
                : "neutral";

      setDomCrosshair(domRefs, {
        enabled: crosshairEnabled,
        visible,
        variant,
        pointerLocked,
        label: blocked ? target.reason : null,
        source: reason,
      });
    } catch (error) {
      logWarn(sceneLogger, "Crosshair sync failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function syncCameraToTargeting(reason: string): void {
    try {
      if (!targeting) {
        syncCrosshairFromState(reason);
        return;
      }

      const position = getCurrentCameraPosition();
      const forward = getCurrentCameraForward();
      const activeBlockTypeId = getActiveBlockTypeId();

      targeting.updateFromCamera({
        position,
        forward,
        maxDistance: 8,
        action: "place",
        activeBlockTypeId,
        reason,
        dispatchToStore: true,
      });

      chunkTools?.previewCurrentTarget(reason);
      syncCrosshairFromState(reason);
    } catch (error) {
      logWarn(sceneLogger, "Camera targeting sync failed.", {
        reason,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function requestChunkLoadAroundCamera(reason: string): void {
    try {
      const position = getCurrentCameraPosition();
      const address = createChunkCellAddress({
        worldX: position.x,
        worldY: position.y,
        worldZ: position.z,
        chunkSize: 16,
      });

      if (address.chunkKey === lastCameraChunkKey) {
        return;
      }

      lastCameraChunkKey = address.chunkKey;

      void worldRuntime.loadAroundPosition(worldPositionFromVector(position), {
        reason,
        radius: 1,
        force: false,
      }).then(() => {
        worldBridge?.syncVisible({
          reason: "manual",
          clearMissing: false,
          renderAfterSync: true,
        });
      }).catch((error) => {
        logWarn(sceneLogger, "Chunk loading around camera failed.", {
          chunkKey: address.chunkKey,
          error: normalizeErrorRecord(error),
        });
      });
    } catch (error) {
      logWarn(sceneLogger, "Camera chunk tracking failed.", {
        error: normalizeErrorRecord(error),
      });
    }
  }

  function renderNow(reason: string): void {
    try {
      worldBridge?.syncVisible({
        reason: "manual",
        clearMissing: false,
        renderAfterSync: false,
        dispatchToStore: true,
      });
      three?.render({
        elapsedMs: 0,
        deltaMs: 0,
      });

      logDebug(sceneLogger, "Scene rendered.", {
        reason,
      });
    } catch (error) {
      setError(error);
    }
  }

  async function initialize(): Promise<void> {
    if (initialized) {
      return;
    }

    assertAlive("initialize");

    setStatus("initializing");
    lifecycle.initialize("scene-runtime.initialize");
    initializedAt = now();

    try {
      applyUiBootstrapFlags("scene-runtime.initialize");

      setDomProjectLabel(
        domRefs,
        bootstrap.runtime.chunk.projectId,
        bootstrap.runtime.chunk.worldId,
      );
      setDomSourceStatus(domRefs, {
        status: "connecting",
        label: "Chunk-Service wird verbunden",
      });
      setDomBootMessage(domRefs, "Scene Runtime wird vorbereitet.");
      dispatchUiLoading(store, true, "Scene Runtime wird vorbereitet.", "scene-runtime.initialize");

      await lifecycle.runStep(
        {
          label: "create-rendering",
          critical: true,
        },
        async () => {
          const canvas = getEditorCanvas(domRefs);

          three = createThreeContext({
            canvas,
            canvasHost: domRefs.canvasHost,
            antialias: bootstrap.render.antialias,
            alpha: bootstrap.render.alpha,
            clearColor: bootstrap.render.clearColor,
            pixelRatioMax: bootstrap.render.pixelRatioMax,
            fov: bootstrap.camera.fov,
            near: bootstrap.camera.near,
            far: bootstrap.camera.far,
            cameraPosition: bootstrap.camera.spawn,
            cameraRotation: {
              x: bootstrap.camera.rotation.pitch,
              y: bootstrap.camera.rotation.yaw,
              z: bootstrap.camera.rotation.roll,
            },
            enableShadows: true,
            addDefaultLights: true,
            addDefaultGrid: true,
            ...(sceneLogger ? { logger: sceneLogger.child?.("three") ?? sceneLogger } : {}),
          });
          three.initialize();

          lifecycle.registerDisposable({
            label: "three-context",
            disposable: three,
            method: "dispose",
            critical: true,
          });

          chunkScene = createChunkScene({
            three,
            autoAttachToThreeChunkGroup: true,
            includeDebugUserData: true,
            visibleByDefault: true,
            ...(sceneLogger ? { logger: sceneLogger.child?.("chunk_scene") ?? sceneLogger } : {}),
          });
          lifecycle.registerDisposable({
            label: "chunk-scene",
            disposable: chunkScene,
            method: "dispose",
            critical: false,
          });

          preview = createPreviewRenderer({
            three,
            showPlacementPreview: bootstrap.render.showPreview,
            showRemovalHighlight: true,
            showTargetOutline: bootstrap.render.showTargetHighlight,
            ...(sceneLogger ? { logger: sceneLogger.child?.("preview") ?? sceneLogger } : {}),
          });
          lifecycle.registerDisposable({
            label: "preview-renderer",
            disposable: preview,
            method: "dispose",
            critical: false,
          });

          dispatchRenderInitialized(store, true);
        },
      );

      await lifecycle.runStep(
        {
          label: "create-resize-observer",
          critical: true,
        },
        async () => {
          resizeObserver = createEditorResizeObserver({
            refs: domRefs,
            store,
            onResize: (snapshot: EditorResizeSnapshot) => {
              try {
                three?.resize({
                  width: snapshot.width,
                  height: snapshot.height,
                  devicePixelRatio: snapshot.devicePixelRatio,
                  updateCanvasStyle: true,
                });
                cameraState?.setAspect(snapshot.aspect, {
                  reason: "resize-observer",
                });
                firstPersonCamera?.writeToCamera("resize-observer");
              } catch (error) {
                logWarn(sceneLogger, "Resize sync failed.", {
                  error: normalizeErrorRecord(error),
                });
              }
            },
            updateCanvasBackingStore: true,
            maxDevicePixelRatio: bootstrap.render.pixelRatioMax,
            ...(sceneLogger ? { logger: sceneLogger.child?.("resize") ?? sceneLogger } : {}),
            ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
          });
          resizeObserver.start();

          lifecycle.registerDisposable({
            label: "resize-observer",
            disposable: resizeObserver,
            method: "destroy",
            critical: false,
          });
        },
      );

      await lifecycle.runStep(
        {
          label: "create-camera",
          critical: true,
        },
        async () => {
          if (!three) {
            throw new Error("ThreeContext was not created before camera setup.");
          }

          cameraState = createCameraState({
            position: bootstrap.camera.spawn,
            rotation: {
              pitch: bootstrap.camera.rotation.pitch,
              yaw: bootstrap.camera.rotation.yaw,
              roll: bootstrap.camera.rotation.roll,
            },
            fov: bootstrap.camera.fov,
            near: bootstrap.camera.near,
            far: bootstrap.camera.far,
            moveSpeed: bootstrap.camera.moveSpeed,
            sprintMultiplier: bootstrap.camera.sprintMultiplier,
            followPlayerPhysics: cameraShouldFollowPhysics,
            ...(sceneLogger ? { logger: sceneLogger.child?.("camera_state") ?? sceneLogger } : {}),
          });
          lifecycle.registerDisposable({
            label: "camera-state",
            disposable: cameraState,
            method: "destroy",
            critical: false,
          });

          if (firstPersonEnabled) {
            const cameraObject: CameraObjectLike = extractCameraFromThree(three);

            firstPersonCamera = createFirstPersonCameraController({
              camera: cameraObject,
              enabled: true,
              autoAttach: true,
              writeInitialTransform: true,
              updateCameraMatrix: true,
              directMovementEnabled: !physicsRuntimeEnabled && bootstrap.camera.directMovementEnabled,
              physicsFollowEnabled: cameraShouldFollowPhysics,
              initialPosition: bootstrap.camera.spawn,
              initialAngles: {
                yaw: bootstrap.camera.rotation.yaw,
                pitch: bootstrap.camera.rotation.pitch,
                roll: bootstrap.camera.rotation.roll,
              },
              resetPosition: bootstrap.camera.spawn,
              resetAngles: {
                yaw: bootstrap.camera.rotation.yaw,
                pitch: bootstrap.camera.rotation.pitch,
                roll: bootstrap.camera.rotation.roll,
              },
              movementSpeed: bootstrap.camera.moveSpeed,
              verticalMovementSpeed: bootstrap.camera.moveSpeed,
              sprintMultiplier: bootstrap.camera.sprintMultiplier,
              movementForwardMultiplier: 1,
              movementRightMultiplier: 1,
              movementUpMultiplier: 1,
              mouseSensitivityX: bootstrap.input.sensitivity,
              mouseSensitivityY: bootstrap.input.sensitivity,
              invertMouseX: false,
              invertMouseY: bootstrap.input.invertY,
              allowVerticalMovement: !physicsRuntimeEnabled,
              normalizeHorizontalDiagonal: true,
              onChange: (snapshot) => {
                syncCameraStateFromFirstPersonSnapshot(snapshot, "first-person-camera.change");
              },
              ...(sceneLogger ? { logger: sceneLogger.child?.("first_person_camera_controller") ?? sceneLogger } : {}),
              ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
            });

            if (physicsRuntimeEnabled) {
              firstPersonCamera.setDirectMovementEnabled(false, "scene-runtime.physics-enabled");
              firstPersonCamera.setPhysicsFollowEnabled(cameraShouldFollowPhysics, "scene-runtime.physics-enabled");
            }

            lifecycle.registerDisposable({
              label: "first-person-camera-controller",
              disposable: firstPersonCamera,
              method: "destroy",
              critical: false,
            });
          }
        },
      );

      await lifecycle.runStep(
        {
          label: "create-physics-runtime",
          critical: false,
        },
        async () => {
          if (!physicsRuntimeEnabled) {
            logInfo(sceneLogger, "Physics runtime is disabled for this scene.", {
              physicsEnabled: bootstrap.featureFlags.physicsEnabled,
              playerCollisionEnabled: bootstrap.featureFlags.playerCollisionEnabled,
            });
            return;
          }

          physicsRuntime = createPhysicsRuntime({
            spawn: {
              x: bootstrap.camera.spawn.x,
              y: bootstrap.camera.spawn.y,
              z: bootstrap.camera.spawn.z,
              yaw: bootstrap.camera.rotation.yaw,
              pitch: bootstrap.camera.rotation.pitch,
              roll: bootstrap.camera.rotation.roll,
            },
            config: createPhysicsRuntimeConfigFromBootstrap(bootstrap),
            callbacks: {
              onError: (error) => {
                dispatchDebugError(store, error, "scene-runtime.physics.error");
              },
            },
          });

          physicsRuntime.start();
          dispatchPhysicsSnapshotToStore("scene-runtime.physics-created");

          lifecycle.registerDisposable({
            label: "physics-runtime",
            disposable: {
              destroy: (): void => {
                try {
                  physicsRuntime?.destroy();
                } catch {
                  // Ignore physics runtime destroy failure during lifecycle cleanup.
                }
              },
            },
            method: "destroy",
            critical: false,
          });

          logInfo(sceneLogger, "Physics runtime created.", {
            cameraShouldFollowPhysics,
            missingChunkPolicy: scenePhysics.missingChunks.policy,
            walkSpeed: scenePhysics.movement.walkSpeed,
            flySpeed: scenePhysics.movement.flySpeed,
          });
        },
      );

      await lifecycle.runStep(
        {
          label: "create-world-scene-bridge",
          critical: true,
        },
        async () => {
          if (!chunkScene) {
            throw new Error("ChunkScene was not created before SceneWorldBridge.");
          }

          worldBridge = createSceneWorldBridge({
            worldRuntime,
            chunkScene,
            store,
            syncOnSourceEvents: true,
            autoInitialize: false,
            autoSyncOnInitialize: false,
            clearMissingChunksOnSync: false,
            dispatchToStore: true,
            renderAfterSync: () => {
              three?.render({
                deltaMs: 0,
                elapsedMs: 0,
              });
            },
            ...(sceneLogger ? { logger: sceneLogger.child?.("world_bridge") ?? sceneLogger } : {}),
            ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
          });
          await worldBridge.initialize();

          lifecycle.registerDisposable({
            label: "scene-world-bridge",
            disposable: worldBridge,
            method: "destroy",
            critical: false,
          });
        },
      );

      await lifecycle.runStep(
        {
          label: "create-targeting-tools-inventory",
          critical: true,
        },
        async () => {
          targeting = createChunkTargeting({
            registry: worldRuntime.getRegistry(),
            store,
            activeBlockTypeId: bootstrap.inventory.defaultBlockTypeId,
            maxDistance: 8,
            stepSize: 0.08,
            maxSteps: 256,
            includeAir: false,
            source: "raycast",
            dispatchToStore: true,
            ...(sceneLogger ? { logger: sceneLogger.child?.("targeting") ?? sceneLogger } : {}),
            ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
          });
          lifecycle.registerDisposable({
            label: "chunk-targeting",
            disposable: targeting,
            method: "destroy",
            critical: false,
          });

          chunkTools = createSceneChunkTools({
            worldRuntime,
            targeting,
            store,
            preview,
            enabled: true,
            remoteCommandsEnabled: bootstrap.featureFlags.remoteCommandsEnabled,
            reloadDirtyChunksAfterCommand: bootstrap.runtime.chunk.reloadDirtyChunksAfterCommand,
            dispatchToStore: true,
            getActiveBlockTypeId,
            onCommandApplied: () => {
              worldBridge?.syncFromWorld({
                reason: "command-result",
                clearMissing: false,
                renderAfterSync: true,
              });
            },
            onCommandFailed: (result) => {
              dispatchDebugError(store, result, "scene-runtime.command-failed");
            },
            ...(sceneLogger ? { logger: sceneLogger.child?.("chunk_tools") ?? sceneLogger } : {}),
            ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
          });
          chunkTools.initialize();
          lifecycle.registerDisposable({
            label: "scene-chunk-tools",
            disposable: chunkTools,
            method: "destroy",
            critical: false,
          });

          if (inventoryEnabled) {
            inventorySource = createChunkInventorySource({
              client: chunkApiClient,
              projectId: bootstrap.runtime.chunk.projectId,
              worldId: bootstrap.runtime.chunk.worldId,
              slotCount: bootstrap.inventory.slotCount,
              defaultBlockTypeId: bootstrap.inventory.defaultBlockTypeId,
              ...(sceneLogger ? { logger: sceneLogger.child?.("inventory_source") ?? sceneLogger } : {}),
              ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
            });
            lifecycle.registerDisposable({
              label: "chunk-inventory-source",
              disposable: inventorySource,
              method: "destroy",
              critical: false,
            });
          }

          if (inventorySource && hotbarEnabled) {
            hotbar = createHotbarController({
              inventorySource,
              store,
              domRefs,
              slotCount: bootstrap.inventory.slotCount,
              defaultSelectedSlot: 0,
              defaultBlockTypeId: bootstrap.inventory.defaultBlockTypeId,
              enableKeyboardShortcuts: false,
              enableWheelSelection: false,
              enableSlotClickSelection: false,
              ...(sceneLogger ? { logger: sceneLogger.child?.("hotbar") ?? sceneLogger } : {}),
              ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
            });
            lifecycle.registerDisposable({
              label: "hotbar-controller",
              disposable: hotbar,
              method: "destroy",
              critical: false,
            });
          }
        },
      );

      await lifecycle.runStep(
        {
          label: "attach-input",
          critical: true,
        },
        async () => {
          const inputLogger = sceneLogger?.child?.("input") ?? sceneLogger;

          inputController = createEditorInputController({
            refs: domRefs,
            store,
            logger: inputLogger,
            signal: lifecycle.getAbortSignal() ?? undefined,
            enabled: true,
            autoAttach: true,
            keyboardEnabled: bootstrap.input.keyboardEnabled,
            mouseEnabled: bootstrap.input.mouseEnabled,
            wheelEnabled: bootstrap.input.wheelEnabled,
            pointerLockEnabled,
            requestPointerLockOnClick: true,
            requestPointerLockOnPointerDown: pointerLockEnabled,
            requirePointerLockForMouseActions: false,
            suppressPrimaryActionOnPointerLockActivation: true,
            preventDefault: true,
            dispatchToStore: true,
            onPlaceBlock: async () => {
              if (!chunkTools) {
                return;
              }

              const result = await chunkTools.executePrimary({
                trigger: "primary-pointer",
                reason: "input-controller-place",
              });

              lastPrimaryResult = result;
              syncCrosshairFromState("input-controller-place");
            },
            onRemoveBlock: async () => {
              if (!chunkTools) {
                return;
              }

              const result = await chunkTools.executeSecondary({
                trigger: "secondary-pointer",
                reason: "input-controller-remove",
              });

              lastSecondaryResult = result;
              syncCrosshairFromState("input-controller-remove");
            },
            onInspect: async () => {
              chunkTools?.previewCurrentTarget("input-controller-inspect");
              syncCrosshairFromState("input-controller-inspect");
            },
            onCancel: async () => {
              chunkTools?.clearPreview("input-controller-cancel");
              targeting?.clear("input-controller-cancel");
              syncCrosshairFromState("input-controller-cancel");
            },
            onMovementIntent: () => {
              // Movement is consumed in the scene loop so key state remains continuous.
            },
          });

          lifecycle.registerDisposable({
            label: "input-controller",
            disposable: inputController,
            method: "destroy",
            critical: false,
          });
        },
      );

      await lifecycle.runStep(
        {
          label: "initialize-world",
          critical: true,
        },
        async () => {
          setDomBootMessage(domRefs, "Chunk-Service wird initialisiert.");
          dispatchUiLoading(store, true, "Chunk-Service wird initialisiert.", "scene-runtime.world-initialize");

          await worldRuntime.initialize();

          worldBridge?.syncFromWorld({
            reason: "initialize",
            clearMissing: false,
            onlyVisible: false,
            dispatchToStore: true,
            renderAfterSync: true,
          });

          setDomSourceStatus(domRefs, {
            status: "ready",
            label: "Chunk-Service verbunden",
          });
        },
      );

      await lifecycle.runStep(
        {
          label: "initialize-inventory-background",
          critical: false,
        },
        async () => {
          if (hotbar) {
            void hotbar.initialize().then((result) => {
              if (isChunkApiFailedResult(result)) {
                logWarn(sceneLogger, "Hotbar initialization returned failure.", {
                  error: result.error,
                });
                return;
              }

              targeting?.setActiveBlockTypeId(
                result.selection.selectedBlockTypeId ?? bootstrap.inventory.defaultBlockTypeId,
                "hotbar-initialized",
              );
              syncCrosshairFromState("hotbar-initialized");
            }).catch((error) => {
              logWarn(sceneLogger, "Hotbar background initialization failed.", {
                error: normalizeErrorRecord(error),
              });
            });

            return;
          }

          if (!inventorySource) {
            return;
          }

          void inventorySource.load({
            force: false,
            selectedSlot: 0,
            selectedSlotIndex: 0,
            blockTypeId: bootstrap.inventory.defaultBlockTypeId,
            allowStaticFallback: true,
            reason: "scene-runtime-inventory-background",
          }).then((result) => {
            if (isChunkApiFailedResult(result)) {
              logWarn(sceneLogger, "Inventory source initialization returned failure.", {
                error: result.error,
              });
              return;
            }

            dispatchInventoryCatalogFromSource(store, result, "scene-runtime.inventory-loaded");
            targeting?.setActiveBlockTypeId(
              result.selection.selectedBlockTypeId ?? bootstrap.inventory.defaultBlockTypeId,
              "inventory-initialized",
            );
            syncCrosshairFromState("inventory-initialized");
          }).catch((error) => {
            logWarn(sceneLogger, "Inventory background initialization failed.", {
              error: normalizeErrorRecord(error),
            });
          });
        },
      );

      await lifecycle.runStep(
        {
          label: "create-debug-overlay-loop",
          critical: true,
        },
        async () => {
          if (debugOverlayEnabled) {
            debugOverlay = createDebugOverlay({
              refs: domRefs,
              store,
              enabled: true,
              visible: bootstrap.ui.showDebugOverlay,
              updateIntervalMs: 250,
              ...(sceneLogger ? { logger: sceneLogger.child?.("debug_overlay") ?? sceneLogger } : {}),
            });
            lifecycle.registerDisposable({
              label: "debug-overlay",
              disposable: debugOverlay,
              method: "dispose",
              critical: false,
            });
          }

          loop = createSceneLoop({
            store,
            lifecycle,
            maxDeltaMs: 100,
            minDeltaMs: 0,
            fixedDeltaMs: null,
            pauseWhenDocumentHidden: true,
            dispatchFramesToStore: true,
            continueAfterCallbackError: true,
            ...(sceneLogger ? { logger: sceneLogger.child?.("loop") ?? sceneLogger } : {}),
            ...(lifecycle.getAbortSignal() ? { signal: lifecycle.getAbortSignal() } : {}),
          });

          loop.addCallback({
            phase: "update",
            label: "camera-targeting-world",
            critical: false,
            callback: (context) => {
              try {
                const inputState = inputController?.getInputState();
                const inputSnapshot = inputState?.getSnapshot() ?? null;
                const lookDelta = inputSnapshot?.pointer.pointerLocked
                  ? inputSnapshot.pointer.lookDelta
                  : {
                      x: 0,
                      y: 0,
                    };
                const deltaSeconds = safeNumber(context.deltaMs, 0) / 1000;
                const movementIntent = inputController?.getMovementIntent() ?? null;

                if (firstPersonCamera) {
                  if (physicsRuntime && physicsRuntimeEnabled) {
                    const lookSnapshot = firstPersonCamera.update({
                      lookDelta,
                      movementIntent: null,
                      deltaSeconds,
                      source: "scene-loop.look",
                    });

                    const physicsFrame = physicsRuntime.stepFrame({
                      nowMs: nowMs(),
                      deltaSeconds,
                      movementIntent: movementIntent?.physics ?? null,
                      lookAngles: physicsAnglesFromFirstPersonSnapshot(lookSnapshot),
                      query: worldRuntime.getBlockCollisionQuery(),
                    });

                    dispatchPhysicsFrameToStore(physicsFrame, "scene-loop.physics");

                    if (cameraShouldFollowPhysics) {
                      const cameraSnapshot = firstPersonCamera.applyPhysicsCameraBinding(
                        physicsFrame.camera,
                        "scene-loop.physics-binding",
                      );

                      syncCameraStateFromPhysicsBinding(physicsFrame.camera, "scene-loop.physics-binding");
                      syncCameraStateFromFirstPersonSnapshot(cameraSnapshot, "scene-loop.physics-binding");
                    } else {
                      syncCameraStateFromFirstPersonSnapshot(lookSnapshot, "scene-loop.look");
                    }
                  } else {
                    const cameraSnapshot = firstPersonCamera.update({
                      lookDelta,
                      movementIntent,
                      deltaSeconds,
                      source: "scene-loop",
                    });

                    syncCameraStateFromFirstPersonSnapshot(cameraSnapshot, "scene-loop");
                  }
                }

                inputState?.resetDeltas();

                syncCameraToTargeting("scene-loop");
                requestChunkLoadAroundCamera("camera-chunk-change");
              } catch (error) {
                logWarn(sceneLogger, "Scene loop camera/physics update failed.", {
                  error: normalizeErrorRecord(error),
                });
              }
            },
          });

          loop.addCallback({
            phase: "render",
            label: "render-three",
            critical: true,
            callback: (context) => {
              three?.render({
                deltaMs: context.deltaMs,
                elapsedMs: context.elapsedMs,
              });
            },
          });

          lifecycle.registerDisposable({
            label: "scene-loop",
            disposable: loop,
            method: "destroy",
            critical: false,
          });
        },
      );

      hideDomLoadingOverlay(domRefs);
      setDomLiveMessage(
        domRefs,
        pointerLockEnabled
          ? "VECTOPLAN Editor ist bereit. Klicke in den Viewport, um Maussteuerung zu aktivieren."
          : "VECTOPLAN Editor ist bereit.",
      );
      dispatchUiLoading(store, false, null, "scene-runtime.ready");
      syncCrosshairFromState("scene-runtime.ready");

      initialized = true;
      setStatus("ready");
      lifecycle.markRunning("scene-runtime.ready");

      start("initialize");

      logInfo(sceneLogger, "Scene runtime initialized.", {
        id,
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
        apiBaseUrl: bootstrap.runtime.chunk.apiBaseUrl,
        pointerLockEnabled,
        firstPersonEnabled,
        crosshairEnabled,
        hotbarEnabled,
        inventoryEnabled,
        physicsRuntimeEnabled,
        cameraShouldFollowPhysics,
      });
    } catch (error) {
      setError(error);

      const message = error instanceof Error ? error.message : "Scene Runtime konnte nicht gestartet werden.";
      showDomFatalError(domRefs, {
        title: "Scene Runtime konnte nicht gestartet werden",
        message,
        details: normalizeErrorRecord(error),
      });
      setDomSourceStatus(domRefs, {
        status: "failed",
        label: "Scene Runtime fehlgeschlagen",
      });
      dispatchUiError(store, "Scene Runtime konnte nicht gestartet werden", message, "scene-runtime.initialize-failed");

      logWarn(sceneLogger, "Scene runtime initialization failed.", {
        error: normalizeErrorRecord(error),
      });

      throw error;
    }
  }

  function start(reason?: string): void {
    assertAlive("start");

    if (!loop) {
      return;
    }

    physicsRuntime?.start();

    loop.start({
      reason: reason ?? "scene-runtime.start",
      resetClock: true,
    });
    setStatus("running");
    lifecycle.markRunning(reason ?? "scene-runtime.start");
  }

  function pause(reason?: string): void {
    if (destroyed) {
      return;
    }

    physicsRuntime?.pause();
    loop?.pause(reason ?? "scene-runtime.pause");
    lifecycle.pause(reason ?? "scene-runtime.pause");
    setStatus("paused");
  }

  function resume(reason?: string): void {
    assertAlive("resume");

    physicsRuntime?.resume();
    loop?.resume(reason ?? "scene-runtime.resume");
    lifecycle.resume(reason ?? "scene-runtime.resume");
    setStatus("running");
  }

  async function requestFullRefresh(reason?: string): Promise<void> {
    assertAlive("requestFullRefresh");

    await worldRuntime.requestFullRefresh({
      reason: reason ?? "scene-runtime.full-refresh",
      force: true,
    });

    worldBridge?.syncFromWorld({
      reason: "full-refresh",
      clearMissing: false,
      renderAfterSync: true,
    });
    syncCrosshairFromState(reason ?? "scene-runtime.full-refresh");
  }

  async function reloadDirtyChunks(reason?: string): Promise<void> {
    assertAlive("reloadDirtyChunks");

    await worldRuntime.reloadDirtyChunks({
      reason: reason ?? "scene-runtime.reload-dirty",
      force: true,
    });

    worldBridge?.remeshDirtyChunks({
      reason: "dirty-reload",
      renderAfterSync: true,
    });
    syncCrosshairFromState(reason ?? "scene-runtime.reload-dirty");
  }

  async function executePrimary(reason?: string): Promise<SceneChunkToolExecutionResult | null> {
    assertAlive("executePrimary");

    if (!chunkTools) {
      return null;
    }

    const result = await chunkTools.executePrimary({
      trigger: "manual",
      reason: reason ?? "scene-runtime.execute-primary",
    });

    lastPrimaryResult = result;
    syncCrosshairFromState(reason ?? "scene-runtime.execute-primary");

    return result;
  }

  async function executeSecondary(reason?: string): Promise<SceneChunkToolExecutionResult | null> {
    assertAlive("executeSecondary");

    if (!chunkTools) {
      return null;
    }

    const result = await chunkTools.executeSecondary({
      trigger: "manual",
      reason: reason ?? "scene-runtime.execute-secondary",
    });

    lastSecondaryResult = result;
    syncCrosshairFromState(reason ?? "scene-runtime.execute-secondary");

    return result;
  }

  function getSnapshot(): SceneRuntimeSnapshot {
    return {
      kind: SCENE_RUNTIME_SNAPSHOT_KIND,
      id,
      status,
      createdAt,
      updatedAt,
      initializedAt,
      readyAt,
      runningAt,
      destroyedAt,
      bootstrapped: true,
      initialized,
      destroyed,
      projectId: bootstrap.runtime.chunk.projectId,
      worldId: bootstrap.runtime.chunk.worldId,
      activeBlockTypeId: getActiveBlockTypeId(),
      selectedSlot: getSelectedSlot(),
      lastCameraChunkKey,
      lastPrimaryResult,
      lastSecondaryResult,
      lastError,
      lifecycle: lifecycle.getSnapshot(),
      loop: snapshotOrNull(() => loop?.getSnapshot() ?? null),
      world: snapshotOrNull(() => worldRuntime.getSnapshot()),
      resize: snapshotOrNull(() => resizeObserver?.getSnapshot() ?? null),
      three: snapshotOrNull(() => three?.getSnapshot() ?? null),
      chunkScene: snapshotOrNull(() => chunkScene?.getSnapshot() ?? null),
      worldBridge: snapshotOrNull(() => worldBridge?.getSnapshot() ?? null),
      inputController: snapshotOrNull(() => inputController?.getSnapshot() ?? null),
      input: snapshotOrNull(() => inputController?.getInputState().getSnapshot() ?? null),
      keyboard: snapshotOrNull(() => inputController?.getKeyboardInput().getSnapshot() ?? null),
      mouse: snapshotOrNull(() => inputController?.getMouseInput().getSnapshot() ?? null),
      pointerLock: snapshotOrNull(() => inputController?.getPointerLock()?.getSnapshot() ?? null),
      camera: snapshotOrNull(() => cameraState?.getSnapshot() ?? null),
      firstPersonCamera: snapshotOrNull(() => firstPersonCamera?.getSnapshot() ?? null),
      physics: snapshotOrNull(() => physicsRuntime?.snapshot() ?? null),
      targeting: snapshotOrNull(() => targeting?.getSnapshot() ?? null),
      chunkTools: snapshotOrNull(() => chunkTools?.getSnapshot() ?? null),
      hotbar: snapshotOrNull(() => hotbar?.getSnapshot() ?? null),
      inventory: snapshotOrNull(() => inventorySource?.getSnapshot() ?? null),
      preview: snapshotOrNull(() => preview?.getSnapshot() ?? null),
      debugOverlay: snapshotOrNull(() => debugOverlay?.getSnapshot() ?? null),
    };
  }

  async function destroy(reason?: string): Promise<void> {
    if (destroyPromise) {
      return destroyPromise;
    }

    destroyPromise = (async () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      setStatus("destroying");

      const destroyReason = safeString(reason, "scene-runtime.destroy");

      logInfo(sceneLogger, "Destroying scene runtime.", {
        id,
        reason: destroyReason,
      });

      try {
        loop?.stop({
          reason: destroyReason,
          clearFrame: true,
        });
      } catch {
        // Ignore.
      }

      await safeDestroyHandle("input-controller", inputController, sceneLogger, destroyReason);
      await safeDestroyHandle("scene-loop", loop, sceneLogger, destroyReason);

      try {
        physicsRuntime?.destroy();
      } catch (error) {
        logWarn(sceneLogger, "Physics runtime cleanup failed.", {
          reason: destroyReason,
          error: normalizeErrorRecord(error),
        });
      }

      await safeDestroyHandle("scene-chunk-tools", chunkTools, sceneLogger, destroyReason);
      await safeDestroyHandle("chunk-targeting", targeting, sceneLogger, destroyReason);
      await safeDestroyHandle("hotbar", hotbar, sceneLogger, destroyReason);
      await safeDestroyHandle("inventory-source", inventorySource, sceneLogger, destroyReason);
      await safeDestroyHandle("debug-overlay", debugOverlay, sceneLogger, destroyReason);
      await safeDestroyHandle("scene-world-bridge", worldBridge, sceneLogger, destroyReason);
      await safeDestroyHandle("preview-renderer", preview, sceneLogger, destroyReason);
      await safeDestroyHandle("chunk-scene", chunkScene, sceneLogger, destroyReason);
      await safeDestroyHandle("resize-observer", resizeObserver, sceneLogger, destroyReason);
      await safeDestroyHandle("first-person-camera-controller", firstPersonCamera, sceneLogger, destroyReason);
      await safeDestroyHandle("camera-state", cameraState, sceneLogger, destroyReason);
      await safeDestroyHandle("three-context", three, sceneLogger, destroyReason);

      try {
        await lifecycle.destroy(destroyReason);
      } catch (error) {
        logWarn(sceneLogger, "Scene lifecycle destroy failed.", {
          error: normalizeErrorRecord(error),
          reason: destroyReason,
        });
      }

      try {
        setDomCrosshair(domRefs, {
          visible: false,
          enabled: false,
          variant: "neutral",
          source: destroyReason,
        });
      } catch {
        // Ignore.
      }

      setStatus("destroyed");

      logInfo(sceneLogger, "Scene runtime destroyed.", {
        id,
        reason: destroyReason,
      });
    })();

    return destroyPromise;
  }

  const handle: SceneRuntimeHandle = {
    kind: SCENE_RUNTIME_KIND,

    initialize,
    start,
    pause,
    resume,

    requestRender(reason?: string): void {
      renderNow(reason ?? "scene-runtime.request-render");
    },

    requestFullRefresh,
    reloadDirtyChunks,

    executePrimary,
    executeSecondary,

    getStatus(): SceneRuntimeStatus {
      return status;
    },

    getSnapshot,

    getLifecycle(): SceneLifecycleHandle {
      return lifecycle;
    },

    getLoop(): SceneLoopHandle | null {
      return loop;
    },

    getThreeContext(): ThreeContextHandle | null {
      return three;
    },

    getWorldRuntime(): WorldRuntimeHandle {
      return worldRuntime;
    },

    getChunkScene(): ChunkSceneHandle | null {
      return chunkScene;
    },

    getWorldBridge(): SceneWorldBridgeHandle | null {
      return worldBridge;
    },

    getTargeting(): ChunkTargetingHandle | null {
      return targeting;
    },

    getChunkTools(): SceneChunkToolsHandle | null {
      return chunkTools;
    },

    getHotbar(): HotbarControllerHandle | null {
      return hotbar;
    },

    getInputController(): EditorInputControllerHandle | null {
      return inputController;
    },

    destroy,
  };

  logDebug(sceneLogger, "Scene runtime created.", {
    id,
    projectId: bootstrap.runtime.chunk.projectId,
    worldId: bootstrap.runtime.chunk.worldId,
    sourceMode: bootstrap.runtime.sourceMode,
    pointerLockEnabled,
    firstPersonEnabled,
    crosshairEnabled,
    hotbarEnabled,
    physicsRuntimeEnabled,
    cameraShouldFollowPhysics,
  });

  return handle;
}

export function isSceneRuntimeHandle(value: unknown): value is SceneRuntimeHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<SceneRuntimeHandle>;

    return (
      record.kind === SCENE_RUNTIME_KIND
      && typeof record.initialize === "function"
      && typeof record.destroy === "function"
      && typeof record.getSnapshot === "function"
    );
  } catch {
    return false;
  }
}