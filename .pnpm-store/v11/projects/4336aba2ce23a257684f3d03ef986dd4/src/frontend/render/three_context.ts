// services/vectoplan-editor/src/frontend/render/three_context.ts
import * as THREE from "three";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type ThreeContextStatus =
  | "created"
  | "initializing"
  | "ready"
  | "resizing"
  | "rendering"
  | "failed"
  | "disposed";

export interface ThreeContextOptions {
  readonly canvas: HTMLCanvasElement;
  readonly canvasHost?: HTMLElement | null;
  readonly logger?: EditorLogger;
  readonly antialias?: boolean;
  readonly alpha?: boolean;
  readonly clearColor?: string;
  readonly pixelRatioMax?: number;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly cameraPosition?: THREE.Vector3Like;
  readonly cameraRotation?: THREE.Euler | THREE.Vector3Like;
  readonly enableShadows?: boolean;
  readonly addDefaultLights?: boolean;
  readonly addDefaultGrid?: boolean;
}

export interface ThreeContextResizeInput {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio?: number;
  readonly updateCanvasStyle?: boolean;
}

export interface ThreeContextRenderInput {
  readonly deltaMs?: number;
  readonly elapsedMs?: number;
}

export interface ThreeContextSnapshot {
  readonly kind: "three-context-snapshot.v1";
  readonly status: ThreeContextStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly frameCount: number;
  readonly lastFrameAt: string | null;
  readonly lastError: Record<string, unknown> | null;
  readonly rendererInfo: {
    readonly memoryGeometries: number;
    readonly memoryTextures: number;
    readonly renderCalls: number;
    readonly renderTriangles: number;
    readonly renderLines: number;
    readonly renderPoints: number;
  } | null;
  readonly camera: {
    readonly fov: number;
    readonly near: number;
    readonly far: number;
    readonly aspect: number;
    readonly position: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly rotation: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
      readonly order: string;
    };
  };
  readonly scene: {
    readonly objectCount: number;
    readonly chunkGroupObjectCount: number;
    readonly previewGroupObjectCount: number;
    readonly helperGroupObjectCount: number;
  };
}

export interface ThreeContextHandle {
  readonly kind: "vectoplan-editor-three-context.v1";

  initialize(): void;
  resize(input: ThreeContextResizeInput): void;
  render(input?: ThreeContextRenderInput): void;

  getStatus(): ThreeContextStatus;
  getRenderer(): THREE.WebGLRenderer;
  getScene(): THREE.Scene;
  getCamera(): THREE.PerspectiveCamera;
  getClock(): THREE.Clock;

  getRootGroup(): THREE.Group;
  getChunkGroup(): THREE.Group;
  getPreviewGroup(): THREE.Group;
  getHelperGroup(): THREE.Group;

  setCameraPosition(position: THREE.Vector3Like): void;
  setCameraRotation(rotation: THREE.Euler | THREE.Vector3Like): void;
  setClearColor(color: string): void;
  setPixelRatio(value: number): void;

  addToScene(object: THREE.Object3D): void;
  removeFromScene(object: THREE.Object3D): void;

  addToChunkGroup(object: THREE.Object3D): void;
  clearChunkGroup(): void;

  addToPreviewGroup(object: THREE.Object3D): void;
  clearPreviewGroup(): void;

  addToHelperGroup(object: THREE.Object3D): void;
  clearHelperGroup(): void;

  getSnapshot(): ThreeContextSnapshot;
  dispose(reason?: string): void;
}

const THREE_CONTEXT_KIND = "vectoplan-editor-three-context.v1" as const;
const THREE_CONTEXT_SNAPSHOT_KIND = "three-context-snapshot.v1" as const;

const DEFAULT_CLEAR_COLOR = "#020617";
const DEFAULT_FOV = 65;
const DEFAULT_NEAR = 0.05;
const DEFAULT_FAR = 1_000;
const DEFAULT_PIXEL_RATIO_MAX = 2;

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Rendering/logging must not throw.
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
    // Rendering/logging must not throw.
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
    // Rendering/logging must not throw.
  }
}

function normalizeDimension(value: unknown, fallback: number): number {
  try {
    return Math.max(1, Math.round(safeNumber(value, fallback, { min: 1, max: 100_000 })));
  } catch {
    return fallback;
  }
}

function normalizePixelRatio(value: unknown, maxValue: number): number {
  try {
    return safeNumber(value, 1, {
      min: 0.25,
      max: Math.max(0.25, maxValue),
    });
  } catch {
    return 1;
  }
}

function safeCanvasSize(canvas: HTMLCanvasElement): { readonly width: number; readonly height: number } {
  try {
    const rect = canvas.getBoundingClientRect();
    const width = normalizeDimension(rect.width || canvas.clientWidth || canvas.width, 1);
    const height = normalizeDimension(rect.height || canvas.clientHeight || canvas.height, 1);

    return {
      width,
      height,
    };
  } catch {
    return {
      width: 1,
      height: 1,
    };
  }
}

function objectCount(root: THREE.Object3D): number {
  try {
    let count = 0;
    root.traverse(() => {
      count += 1;
    });

    return count;
  } catch {
    return 0;
  }
}

function disposeObject3D(object: THREE.Object3D): void {
  try {
    object.traverse((child) => {
      const maybeMesh = child as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };

      try {
        maybeMesh.geometry?.dispose?.();
      } catch {
        // Ignore geometry disposal failure.
      }

      try {
        const material = maybeMesh.material;

        if (Array.isArray(material)) {
          for (const item of material) {
            item.dispose();
          }
        } else {
          material?.dispose?.();
        }
      } catch {
        // Ignore material disposal failure.
      }
    });
  } catch {
    // Ignore traversal disposal failure.
  }
}

function clearGroup(group: THREE.Group, dispose = true): void {
  try {
    const children = [...group.children];

    for (const child of children) {
      group.remove(child);

      if (dispose) {
        disposeObject3D(child);
      }
    }
  } catch {
    // Ignore group clearing failure.
  }
}

function createGroup(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

function applyCameraPosition(camera: THREE.PerspectiveCamera, position: THREE.Vector3Like | undefined): void {
  try {
    if (!position) {
      camera.position.set(8, 4, 18);
      return;
    }

    camera.position.set(
      safeNumber(position.x, 8),
      safeNumber(position.y, 4),
      safeNumber(position.z, 18),
    );
  } catch {
    camera.position.set(8, 4, 18);
  }
}

function applyCameraRotation(camera: THREE.PerspectiveCamera, rotation: THREE.Euler | THREE.Vector3Like | undefined): void {
  try {
    camera.rotation.order = "YXZ";

    if (!rotation) {
      camera.rotation.set(0, Math.PI, 0, "YXZ");
      return;
    }

    if (rotation instanceof THREE.Euler) {
      camera.rotation.copy(rotation);
      camera.rotation.order = "YXZ";
      return;
    }

    camera.rotation.set(
      safeNumber(rotation.x, 0),
      safeNumber(rotation.y, Math.PI),
      safeNumber(rotation.z, 0),
      "YXZ",
    );
  } catch {
    camera.rotation.set(0, Math.PI, 0, "YXZ");
  }
}

function createRenderer(input: {
  readonly canvas: HTMLCanvasElement;
  readonly antialias: boolean;
  readonly alpha: boolean;
  readonly clearColor: string;
  readonly enableShadows: boolean;
  readonly pixelRatio: number;
}): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas: input.canvas,
    antialias: input.antialias,
    alpha: input.alpha,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
  });

  renderer.setPixelRatio(input.pixelRatio);
  renderer.setClearColor(new THREE.Color(input.clearColor), input.alpha ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  renderer.shadowMap.enabled = input.enableShadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return renderer;
}

function addDefaultLights(scene: THREE.Scene): THREE.Group {
  const group = createGroup("default_lighting_group");

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  ambient.name = "ambient_light";

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1f2937, 0.65);
  hemi.name = "hemisphere_light";

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.name = "main_directional_light";
  sun.position.set(12, 24, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -32;
  sun.shadow.camera.right = 32;
  sun.shadow.camera.top = 32;
  sun.shadow.camera.bottom = -32;

  group.add(ambient);
  group.add(hemi);
  group.add(sun);
  scene.add(group);

  return group;
}

function addDefaultGrid(helperGroup: THREE.Group): THREE.GridHelper | null {
  try {
    const grid = new THREE.GridHelper(64, 64, 0x334155, 0x1e293b);
    grid.name = "debug_ground_grid";
    grid.position.y = -0.01;
    helperGroup.add(grid);

    return grid;
  } catch {
    return null;
  }
}

function rendererInfo(renderer: THREE.WebGLRenderer): ThreeContextSnapshot["rendererInfo"] {
  try {
    const info = renderer.info;

    return {
      memoryGeometries: info.memory.geometries,
      memoryTextures: info.memory.textures,
      renderCalls: info.render.calls,
      renderTriangles: info.render.triangles,
      renderLines: info.render.lines,
      renderPoints: info.render.points,
    };
  } catch {
    return null;
  }
}

export function createThreeContext(options: ThreeContextOptions): ThreeContextHandle {
  const logger = options.logger;
  const createdAt = nowIsoString();
  const canvas = options.canvas;
  const initialSize = safeCanvasSize(canvas);
  const pixelRatioMax = safeNumber(options.pixelRatioMax, DEFAULT_PIXEL_RATIO_MAX, {
    min: 0.25,
    max: 4,
  });
  const initialPixelRatio = normalizePixelRatio(
    typeof window !== "undefined" ? window.devicePixelRatio : 1,
    pixelRatioMax,
  );
  const antialias = safeBoolean(options.antialias, true);
  const alpha = safeBoolean(options.alpha, false);
  const clearColor = safeString(options.clearColor, DEFAULT_CLEAR_COLOR);
  const enableShadows = safeBoolean(options.enableShadows, true);

  let status: ThreeContextStatus = "created";
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let disposed = false;
  let width = initialSize.width;
  let height = initialSize.height;
  let pixelRatio = initialPixelRatio;
  let frameCount = 0;
  let lastFrameAt: string | null = null;
  let lastError: Record<string, unknown> | null = null;
  let defaultLightingGroup: THREE.Group | null = null;

  const scene = new THREE.Scene();
  scene.name = "vectoplan_editor_scene";

  const rootGroup = createGroup("editor_root_group");
  const chunkGroup = createGroup("chunk_group");
  const previewGroup = createGroup("preview_group");
  const helperGroup = createGroup("helper_group");

  rootGroup.add(chunkGroup);
  rootGroup.add(previewGroup);
  rootGroup.add(helperGroup);
  scene.add(rootGroup);

  const camera = new THREE.PerspectiveCamera(
    safeNumber(options.fov, DEFAULT_FOV, { min: 20, max: 110 }),
    width / Math.max(1, height),
    safeNumber(options.near, DEFAULT_NEAR, { min: 0.001, max: 10 }),
    safeNumber(options.far, DEFAULT_FAR, { min: 10, max: 100_000 }),
  );
  camera.name = "editor_camera";
  applyCameraPosition(camera, options.cameraPosition);
  applyCameraRotation(camera, options.cameraRotation);

  let renderer: THREE.WebGLRenderer;

  try {
    renderer = createRenderer({
      canvas,
      antialias,
      alpha,
      clearColor,
      enableShadows,
      pixelRatio,
    });
  } catch (error) {
    lastError = normalizeUnknownError(error);
    status = "failed";
    throw error;
  }

  function setStatus(nextStatus: ThreeContextStatus): void {
    status = nextStatus;
    updatedAt = nowIsoString();
  }

  function assertAlive(action: string): void {
    if (disposed || status === "disposed") {
      throw new Error(`ThreeContext is disposed. Action '${action}' is not allowed.`);
    }
  }

  function setLastError(error: unknown): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed");
  }

  function initialize(): void {
    assertAlive("initialize");

    try {
      setStatus("initializing");

      scene.background = new THREE.Color(clearColor);

      if (options.addDefaultLights !== false && !defaultLightingGroup) {
        defaultLightingGroup = addDefaultLights(scene);
      }

      if (options.addDefaultGrid === true) {
        addDefaultGrid(helperGroup);
      }

      handle.resize({
        width,
        height,
        devicePixelRatio: pixelRatio,
        updateCanvasStyle: false,
      });

      setStatus("ready");

      logInfo(logger, "Three context initialized.", {
        width,
        height,
        pixelRatio,
        antialias,
        alpha,
        shadows: enableShadows,
      });
    } catch (error) {
      setLastError(error);
      logWarn(logger, "Three context initialization failed.", {
        error: normalizeUnknownError(error),
      });
      throw error;
    }
  }

  function resize(input: ThreeContextResizeInput): void {
    assertAlive("resize");

    try {
      setStatus("resizing");

      width = normalizeDimension(input.width, width);
      height = normalizeDimension(input.height, height);
      pixelRatio = normalizePixelRatio(input.devicePixelRatio ?? pixelRatio, pixelRatioMax);

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, input.updateCanvasStyle ?? false);

      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();

      setStatus("ready");
    } catch (error) {
      setLastError(error);
      logWarn(logger, "Three context resize failed.", {
        error: normalizeUnknownError(error),
        width: input.width,
        height: input.height,
      });
    }
  }

  function render(): void {
    assertAlive("render");

    try {
      setStatus("rendering");
      renderer.render(scene, camera);
      frameCount += 1;
      lastFrameAt = nowIsoString();
      setStatus("ready");
    } catch (error) {
      setLastError(error);
      logWarn(logger, "Three context render failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function getRenderer(): THREE.WebGLRenderer {
    assertAlive("getRenderer");
    return renderer;
  }

  function getScene(): THREE.Scene {
    assertAlive("getScene");
    return scene;
  }

  function getCamera(): THREE.PerspectiveCamera {
    assertAlive("getCamera");
    return camera;
  }

  function addToScene(object: THREE.Object3D): void {
    assertAlive("addToScene");

    try {
      scene.add(object);
    } catch (error) {
      logWarn(logger, "Could not add object to scene.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function removeFromScene(object: THREE.Object3D): void {
    assertAlive("removeFromScene");

    try {
      object.parent?.remove(object);
    } catch (error) {
      logWarn(logger, "Could not remove object from scene.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  const clock = new THREE.Clock(false);

  const handle: ThreeContextHandle = {
    kind: THREE_CONTEXT_KIND,

    initialize,

    resize,

    render,

    getStatus(): ThreeContextStatus {
      return status;
    },

    getRenderer,

    getScene,

    getCamera,

    getClock(): THREE.Clock {
      return clock;
    },

    getRootGroup(): THREE.Group {
      assertAlive("getRootGroup");
      return rootGroup;
    },

    getChunkGroup(): THREE.Group {
      assertAlive("getChunkGroup");
      return chunkGroup;
    },

    getPreviewGroup(): THREE.Group {
      assertAlive("getPreviewGroup");
      return previewGroup;
    },

    getHelperGroup(): THREE.Group {
      assertAlive("getHelperGroup");
      return helperGroup;
    },

    setCameraPosition(position: THREE.Vector3Like): void {
      assertAlive("setCameraPosition");
      applyCameraPosition(camera, position);
    },

    setCameraRotation(rotation: THREE.Euler | THREE.Vector3Like): void {
      assertAlive("setCameraRotation");
      applyCameraRotation(camera, rotation);
    },

    setClearColor(color: string): void {
      assertAlive("setClearColor");

      try {
        const nextColor = safeString(color, clearColor);
        renderer.setClearColor(new THREE.Color(nextColor), alpha ? 0 : 1);
        scene.background = new THREE.Color(nextColor);
      } catch (error) {
        logWarn(logger, "Could not set clear color.", {
          color,
          error: normalizeUnknownError(error),
        });
      }
    },

    setPixelRatio(value: number): void {
      assertAlive("setPixelRatio");
      pixelRatio = normalizePixelRatio(value, pixelRatioMax);
      renderer.setPixelRatio(pixelRatio);
    },

    addToScene,

    removeFromScene,

    addToChunkGroup(object: THREE.Object3D): void {
      assertAlive("addToChunkGroup");
      chunkGroup.add(object);
    },

    clearChunkGroup(): void {
      assertAlive("clearChunkGroup");
      clearGroup(chunkGroup, true);
    },

    addToPreviewGroup(object: THREE.Object3D): void {
      assertAlive("addToPreviewGroup");
      previewGroup.add(object);
    },

    clearPreviewGroup(): void {
      assertAlive("clearPreviewGroup");
      clearGroup(previewGroup, true);
    },

    addToHelperGroup(object: THREE.Object3D): void {
      assertAlive("addToHelperGroup");
      helperGroup.add(object);
    },

    clearHelperGroup(): void {
      assertAlive("clearHelperGroup");
      clearGroup(helperGroup, true);
    },

    getSnapshot(): ThreeContextSnapshot {
      return {
        kind: THREE_CONTEXT_SNAPSHOT_KIND,
        status,
        createdAt,
        updatedAt,
        disposedAt,
        width,
        height,
        pixelRatio,
        frameCount,
        lastFrameAt,
        lastError,
        rendererInfo: disposed ? null : rendererInfo(renderer),
        camera: {
          fov: camera.fov,
          near: camera.near,
          far: camera.far,
          aspect: camera.aspect,
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          rotation: {
            x: camera.rotation.x,
            y: camera.rotation.y,
            z: camera.rotation.z,
            order: camera.rotation.order,
          },
        },
        scene: {
          objectCount: objectCount(scene),
          chunkGroupObjectCount: objectCount(chunkGroup),
          previewGroupObjectCount: objectCount(previewGroup),
          helperGroupObjectCount: objectCount(helperGroup),
        },
      };
    },

    dispose(reason?: string): void {
      if (disposed) {
        return;
      }

      disposed = true;
      disposedAt = nowIsoString();

      try {
        clock.stop();
      } catch {
        // Ignore.
      }

      try {
        clearGroup(chunkGroup, true);
        clearGroup(previewGroup, true);
        clearGroup(helperGroup, true);

        if (defaultLightingGroup) {
          scene.remove(defaultLightingGroup);
          disposeObject3D(defaultLightingGroup);
          defaultLightingGroup = null;
        }

        scene.remove(rootGroup);
      } catch {
        // Ignore scene cleanup failure.
      }

      try {
        renderer.dispose();
        renderer.forceContextLoss();
      } catch {
        // Ignore renderer disposal failure.
      }

      setStatus("disposed");

      logInfo(logger, "Three context disposed.", {
        reason: reason ?? null,
        frameCount,
      });
    },
  };

  logDebug(logger, "Three context created.", {
    width,
    height,
    pixelRatio,
    clearColor,
  });

  return handle;
}