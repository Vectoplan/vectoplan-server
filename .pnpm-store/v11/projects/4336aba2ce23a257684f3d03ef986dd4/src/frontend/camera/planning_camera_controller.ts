import * as THREE from "three";

export type PlanningCameraInteraction = "orbit" | "pan" | null;

export interface PlanningCameraCursorRay {
  readonly origin: THREE.Vector3;
  readonly direction: THREE.Vector3;
}

export interface PlanningCameraSnapshot {
  readonly kind: "planning-camera-snapshot.v1";
  readonly enabled: boolean;
  readonly initialized: boolean;
  readonly interaction: PlanningCameraInteraction;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly distance: number;
  readonly azimuth: number;
  readonly polar: number;
  readonly cursorNdc: Readonly<{ x: number; y: number }>;
  readonly keyboardMoving: boolean;
}

export interface PlanningCameraControllerOptions {
  readonly root: HTMLElement;
  readonly host: HTMLElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly signal?: AbortSignal;
  /**
   * An active planning tool may claim the primary pointer before the camera.
   * Returning true leaves the complete pointer sequence on the shared editor
   * input/WorldEdit pipeline instead of starting an orbit gesture.
   */
  readonly shouldYieldPrimaryPointer?: (event: PointerEvent) => boolean;
  readonly onCursorChange?: () => void;
  readonly onCameraChange?: () => void;
}

export interface PlanningCameraControllerHandle {
  readonly kind: "vectoplan-planning-camera.v1";
  enable(focus?: THREE.Vector3, reason?: string): void;
  disable(reason?: string): void;
  resetView(focus?: THREE.Vector3): void;
  setTopView(): void;
  update(deltaMs?: number): void;
  getCursorRay(): PlanningCameraCursorRay | null;
  getSnapshot(): PlanningCameraSnapshot;
  destroy(): void;
}

const SNAPSHOT_KIND = "planning-camera-snapshot.v1" as const;
const HANDLE_KIND = "vectoplan-planning-camera.v1" as const;
const MIN_DISTANCE = 4;
export const PLANNING_CAMERA_MAX_DISTANCE = 640;
const MIN_POLAR = 0.055;
const MAX_POLAR = Math.PI / 2 - 0.035;
const MIN_KEYBOARD_SPEED = 4;
const MAX_KEYBOARD_SPEED = 72;

export type PlanningKeyboardMovement = "forward" | "backward" | "left" | "right";

export function planningKeyboardMovement(code: string): PlanningKeyboardMovement | null {
  switch (code) {
    case "KeyW":
    case "w":
    case "W":
    case "ArrowUp":
      return "forward";
    case "KeyS":
    case "s":
    case "S":
    case "ArrowDown":
      return "backward";
    case "KeyA":
    case "a":
    case "A":
    case "ArrowLeft":
      return "left";
    case "KeyD":
    case "d":
    case "D":
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

/**
 * Moves the orbit focus on the horizontal world plane. Movement follows the
 * current view direction, while its speed scales gently with zoom so WASD is
 * useful both close to a building and across a site.
 */
export function planningKeyboardPanOffset(
  azimuth: number,
  cameraDistance: number,
  deltaMs: number,
  lateral: number,
  forward: number,
): Readonly<{ x: number; y: number; z: number }> {
  const safeDistance = Math.max(MIN_DISTANCE, Math.min(PLANNING_CAMERA_MAX_DISTANCE, cameraDistance));
  const safeDeltaSeconds = Math.max(0, Math.min(0.1, Number.isFinite(deltaMs) ? deltaMs / 1_000 : 0));
  const length = Math.hypot(lateral, forward);
  if (length <= Number.EPSILON || safeDeltaSeconds <= 0) return { x: 0, y: 0, z: 0 };
  const normalizedLateral = lateral / Math.max(1, length);
  const normalizedForward = forward / Math.max(1, length);
  const speed = Math.max(MIN_KEYBOARD_SPEED, Math.min(MAX_KEYBOARD_SPEED, safeDistance * 0.45));
  const distance = speed * safeDeltaSeconds;
  const forwardX = -Math.sin(azimuth);
  const forwardZ = -Math.cos(azimuth);
  const rightX = Math.cos(azimuth);
  const rightZ = -Math.sin(azimuth);
  return {
    x: (rightX * normalizedLateral + forwardX * normalizedForward) * distance,
    y: 0,
    z: (rightZ * normalizedLateral + forwardZ * normalizedForward) * distance,
  };
}

export function clampPlanningPolar(value: number): number {
  return Math.max(MIN_POLAR, Math.min(MAX_POLAR, Number.isFinite(value) ? value : Math.PI / 4));
}

/**
 * Planning navigation deliberately has no modifier-key variants: primary drag
 * orbits, middle drag pans in the camera plane. A planning tool can explicitly
 * own the primary pointer, in which case that gesture remains available to
 * the existing WorldEdit input pipeline.
 */
export function planningPointerInteraction(
  button: number,
  primaryPointerClaimed: boolean,
): PlanningCameraInteraction {
  if (button === 1) return "pan";
  if (button === 0 && !primaryPointerClaimed) return "orbit";
  return null;
}

export function planningScreenPlanePanOffset(
  cameraRight: Readonly<{ x: number; y: number; z: number }>,
  cameraUp: Readonly<{ x: number; y: number; z: number }>,
  cameraDistance: number,
  cameraFovDegrees: number,
  viewportHeight: number,
  deltaX: number,
  deltaY: number,
): Readonly<{ x: number; y: number; z: number }> {
  const safeDistance = Math.max(MIN_DISTANCE, Math.min(PLANNING_CAMERA_MAX_DISTANCE, cameraDistance));
  const safeHeight = Math.max(1, viewportHeight);
  const safeFov = Math.max(1, Math.min(179, cameraFovDegrees));
  const scale = 2 * safeDistance * Math.tan(THREE.MathUtils.degToRad(safeFov) / 2) / safeHeight;
  const rightScale = -deltaX * scale;
  const upScale = deltaY * scale;
  return {
    x: cameraRight.x * rightScale + cameraUp.x * upScale,
    y: cameraRight.y * rightScale + cameraUp.y * upScale,
    z: cameraRight.z * rightScale + cameraUp.z * upScale,
  };
}

export function planningZoomDistance(cameraDistance: number, wheelDeltaY: number): number {
  const safeDistance = Math.max(MIN_DISTANCE, Math.min(PLANNING_CAMERA_MAX_DISTANCE, cameraDistance));
  const safeDelta = Number.isFinite(wheelDeltaY) ? wheelDeltaY : 0;
  return Math.max(
    MIN_DISTANCE,
    Math.min(PLANNING_CAMERA_MAX_DISTANCE, safeDistance * Math.exp(safeDelta * 0.00125)),
  );
}

/**
 * Cursor picking must at least reach the orbit focus. It may use the visible
 * camera depth beyond that focus, but remains proportional to the current zoom
 * so normal close-range editing does not pay for a permanent long raycast.
 */
export function planningCameraTargetingDistance(
  cameraDistance: number,
  cameraFar: number,
): number {
  const distance = Math.max(
    MIN_DISTANCE,
    Math.min(
      PLANNING_CAMERA_MAX_DISTANCE,
      Number.isFinite(cameraDistance) ? cameraDistance : MIN_DISTANCE,
    ),
  );
  const visibleFar = Number.isFinite(cameraFar) && cameraFar > 0
    ? cameraFar
    : distance * 2;
  return Math.max(distance, Math.min(visibleFar, distance * 2));
}

export function planningOrbitPosition(
  target: Readonly<{ x: number; y: number; z: number }>,
  distance: number,
  azimuth: number,
  polar: number,
): Readonly<{ x: number; y: number; z: number }> {
  const safeDistance = Math.max(MIN_DISTANCE, Math.min(PLANNING_CAMERA_MAX_DISTANCE, distance));
  const safePolar = clampPlanningPolar(polar);
  const horizontal = Math.sin(safePolar) * safeDistance;
  return {
    x: target.x + Math.sin(azimuth) * horizontal,
    y: target.y + Math.cos(safePolar) * safeDistance,
    z: target.z + Math.cos(azimuth) * horizontal,
  };
}

function isInteractiveTarget(value: EventTarget | null): boolean {
  if (!(value instanceof Element)) return false;
  return Boolean(value.closest(
    "[data-editor-workspace-control], [data-editor-ui-interactive], button, input, select, textarea, a, iframe",
  ));
}

function finiteFocus(value: THREE.Vector3 | undefined): THREE.Vector3 | null {
  if (!value) return null;
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
    ? value.clone()
    : null;
}

export function createPlanningCameraController(
  options: PlanningCameraControllerOptions,
): PlanningCameraControllerHandle {
  const target = new THREE.Vector3();
  const cursorNdc = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const previousPointer = new THREE.Vector2();
  const pressedMovementKeys = new Set<string>();
  const cleanup: Array<() => void> = [];

  let enabled = false;
  let initialized = false;
  let destroyed = false;
  let interaction: PlanningCameraInteraction = null;
  let activePointerId: number | null = null;
  let distance = 42;
  let azimuth = Math.PI * 0.78;
  let polar = Math.PI * 0.31;

  function updateDataset(reason?: string): void {
    options.root.dataset.editorPlanningCamera = enabled ? "active" : "inactive";
    options.root.dataset.editorPlanningCameraInteraction = interaction ?? "none";
    if (reason) options.root.dataset.editorPlanningCameraReason = reason;
  }

  function applyCamera(): void {
    if (!enabled || destroyed) return;
    const position = planningOrbitPosition(target, distance, azimuth, polar);
    options.camera.position.set(position.x, position.y, position.z);
    options.camera.up.set(0, 1, 0);
    options.camera.lookAt(target);
    options.camera.updateMatrixWorld(true);
    options.onCameraChange?.();
  }

  function setCursorFromClient(clientX: number, clientY: number): void {
    const rect = options.host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    cursorNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    cursorNdc.x = Math.max(-1, Math.min(1, cursorNdc.x));
    cursorNdc.y = Math.max(-1, Math.min(1, cursorNdc.y));
    options.root.dataset.editorPlanningCursorX = cursorNdc.x.toFixed(4);
    options.root.dataset.editorPlanningCursorY = cursorNdc.y.toFixed(4);
    options.onCursorChange?.();
  }

  function navigationInteraction(event: PointerEvent): PlanningCameraInteraction {
    let primaryPointerClaimed = false;
    if (event.button === 0) {
      try {
        primaryPointerClaimed = options.shouldYieldPrimaryPointer?.(event) === true;
      } catch {
        // Navigation remains usable if an optional tool ownership probe fails.
      }
    }
    return planningPointerInteraction(event.button, primaryPointerClaimed);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!enabled || destroyed || isInteractiveTarget(event.target)) return;
    setCursorFromClient(event.clientX, event.clientY);
    const nextInteraction = navigationInteraction(event);
    if (!nextInteraction) return;
    interaction = nextInteraction;
    activePointerId = event.pointerId;
    previousPointer.set(event.clientX, event.clientY);
    try { options.host.setPointerCapture(event.pointerId); } catch { /* window listeners keep dragging usable */ }
    event.preventDefault();
    event.stopImmediatePropagation();
    updateDataset(`pointer-${nextInteraction}`);
  }

  function panBy(deltaX: number, deltaY: number): void {
    options.camera.updateMatrixWorld(true);
    cameraRight.set(1, 0, 0).applyQuaternion(options.camera.quaternion).normalize();
    cameraUp.set(0, 1, 0).applyQuaternion(options.camera.quaternion).normalize();
    const height = Math.max(1, options.host.getBoundingClientRect().height);
    const offset = planningScreenPlanePanOffset(
      cameraRight,
      cameraUp,
      distance,
      options.camera.fov,
      height,
      deltaX,
      deltaY,
    );
    target.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!enabled || destroyed || isInteractiveTarget(event.target)) return;
    if (!interaction && event.target instanceof Node && !options.host.contains(event.target)) return;
    setCursorFromClient(event.clientX, event.clientY);
    if (!interaction || activePointerId !== event.pointerId) return;
    const deltaX = event.clientX - previousPointer.x;
    const deltaY = event.clientY - previousPointer.y;
    previousPointer.set(event.clientX, event.clientY);
    if (interaction === "orbit") {
      azimuth -= deltaX * 0.006;
      polar = clampPlanningPolar(polar + deltaY * 0.005);
    } else panBy(deltaX, deltaY);
    applyCamera();
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function endInteraction(event: PointerEvent): void {
    if (!interaction || activePointerId !== event.pointerId) return;
    try { options.host.releasePointerCapture(event.pointerId); } catch { /* capture may already have ended */ }
    interaction = null;
    activePointerId = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    updateDataset("pointer-up");
  }

  function handleWheel(event: WheelEvent): void {
    if (!enabled || destroyed || isInteractiveTarget(event.target)) return;
    setCursorFromClient(event.clientX, event.clientY);
    distance = planningZoomDistance(distance, event.deltaY);
    applyCamera();
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!enabled || destroyed || event.altKey || event.ctrlKey || event.metaKey || isInteractiveTarget(event.target)) return;
    const key = event.code || event.key;
    const movement = planningKeyboardMovement(key);
    if (!movement) return;
    pressedMovementKeys.add(key);
    event.preventDefault();
    event.stopImmediatePropagation();
    updateDataset(`keyboard-${movement}`);
  }

  function handleKeyUp(event: KeyboardEvent): void {
    const key = event.code || event.key;
    const movement = planningKeyboardMovement(key);
    if (!movement) return;
    if (!pressedMovementKeys.has(key) && (!enabled || isInteractiveTarget(event.target))) return;
    pressedMovementKeys.delete(key);
    event.preventDefault();
    event.stopImmediatePropagation();
    updateDataset("keyboard-up");
  }

  function clearKeyboardMovement(): void {
    if (pressedMovementKeys.size === 0) return;
    pressedMovementKeys.clear();
    updateDataset("keyboard-clear");
  }

  function updateKeyboardMovement(deltaMs: number): boolean {
    if (!enabled || pressedMovementKeys.size === 0) return false;
    const movements = new Set(
      [...pressedMovementKeys]
        .map((key) => planningKeyboardMovement(key))
        .filter((movement): movement is PlanningKeyboardMovement => movement !== null),
    );
    const lateral = Number(movements.has("right")) - Number(movements.has("left"));
    const forward = Number(movements.has("forward")) - Number(movements.has("backward"));
    const offset = planningKeyboardPanOffset(azimuth, distance, deltaMs, lateral, forward);
    if (offset.x === 0 && offset.z === 0) return false;
    target.add(new THREE.Vector3(offset.x, 0, offset.z));
    return true;
  }

  function addListener(targetValue: EventTarget, type: string, listener: EventListener, listenerOptions: AddEventListenerOptions): void {
    targetValue.addEventListener(type, listener, listenerOptions);
    cleanup.push(() => targetValue.removeEventListener(type, listener, listenerOptions));
  }

  addListener(options.host, "pointerdown", handlePointerDown as EventListener, { capture: true, passive: false });
  addListener(window, "pointermove", handlePointerMove as EventListener, { capture: true, passive: false });
  addListener(window, "pointerup", endInteraction as EventListener, { capture: true, passive: false });
  addListener(window, "pointercancel", endInteraction as EventListener, { capture: true, passive: false });
  addListener(options.host, "wheel", handleWheel as EventListener, { capture: true, passive: false });
  addListener(window, "keydown", handleKeyDown as EventListener, { capture: true, passive: false });
  addListener(window, "keyup", handleKeyUp as EventListener, { capture: true, passive: false });
  addListener(window, "blur", clearKeyboardMovement as EventListener, { capture: true, passive: true });

  const handle: PlanningCameraControllerHandle = {
    kind: HANDLE_KIND,
    enable(focus?: THREE.Vector3, reason = "planning-camera.enable"): void {
      if (destroyed) return;
      const nextFocus = finiteFocus(focus);
      if (!initialized) {
        target.copy(nextFocus ?? new THREE.Vector3());
        initialized = true;
      } else if (nextFocus && target.distanceToSquared(nextFocus) > 512 * 512) target.copy(nextFocus);
      enabled = true;
      applyCamera();
      updateDataset(reason);
    },
    disable(reason = "planning-camera.disable"): void {
      if (destroyed) return;
      enabled = false;
      interaction = null;
      activePointerId = null;
      pressedMovementKeys.clear();
      updateDataset(reason);
    },
    resetView(focus?: THREE.Vector3): void {
      const nextFocus = finiteFocus(focus);
      if (nextFocus) target.copy(nextFocus);
      distance = 42;
      azimuth = Math.PI * 0.78;
      polar = Math.PI * 0.31;
      initialized = true;
      applyCamera();
    },
    setTopView(): void { polar = MIN_POLAR; applyCamera(); },
    update(deltaMs = 0): void {
      updateKeyboardMovement(deltaMs);
      applyCamera();
    },
    getCursorRay(): PlanningCameraCursorRay | null {
      if (!enabled || destroyed) return null;
      options.camera.updateMatrixWorld(true);
      raycaster.setFromCamera(cursorNdc, options.camera);
      return { origin: raycaster.ray.origin.clone(), direction: raycaster.ray.direction.clone().normalize() };
    },
    getSnapshot(): PlanningCameraSnapshot {
      return {
        kind: SNAPSHOT_KIND,
        enabled,
        initialized,
        interaction,
        target: { x: target.x, y: target.y, z: target.z },
        distance,
        azimuth,
        polar,
        cursorNdc: { x: cursorNdc.x, y: cursorNdc.y },
        keyboardMoving: pressedMovementKeys.size > 0,
      };
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      enabled = false;
      interaction = null;
      activePointerId = null;
      pressedMovementKeys.clear();
      for (const dispose of cleanup.splice(0)) dispose();
      delete options.root.dataset.editorPlanningCamera;
      delete options.root.dataset.editorPlanningCameraInteraction;
      delete options.root.dataset.editorPlanningCameraReason;
      delete options.root.dataset.editorPlanningCursorX;
      delete options.root.dataset.editorPlanningCursorY;
    },
  };
  if (options.signal) {
    if (options.signal.aborted) handle.destroy();
    else options.signal.addEventListener("abort", () => handle.destroy(), { once: true });
  }
  return handle;
}
