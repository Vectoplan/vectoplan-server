import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";
import { createEnvironmentSystem, type EnvironmentSystem } from "@render/environment_system";
import { createThreeContext, type ThreeContextHandle } from "@render/three_context";
import "../styles/generator_preview.css";

const CONTRACT = "vectoplan-generator-preview.v1";
const UPDATE_MESSAGE = "vectoplan.generator-preview.update";
const READY_MESSAGE = "vectoplan.generator-preview.ready";
const RESULT_MESSAGE = "vectoplan.generator-preview.result";
const ERROR_MESSAGE = "vectoplan.generator-preview.error";
const ROOT_SELECTOR = "[data-editor-generator-preview]";
const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.32;
const WALK_SPEED = 3.8;
const SPRINT_SPEED = 7.2;
const JUMP_SPEED = 5.2;
const GRAVITY = 15;
const SUPPORTED_MODEL_EXTENSIONS = [".glb", ".gltf", ".obj", ".stl", ".fbx"] as const;
const SUPPORTED_TEXTURE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tga"] as const;
const MODULE_ENVELOPE_NAME = "generator_preview_module_grid";
const MODULE_ENVELOPE_COLOR = 0xdbeafe;
const MODULE_ENVELOPE_OPACITY = 0.86;
const MAX_VISIBLE_CELL_DIVISIONS = 64;

interface PreviewGeometry {
  readonly shape: string;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly unit: string;
  readonly cellsX: number;
  readonly cellsY: number;
  readonly cellsZ: number;
}

interface GeneratorPreviewPayload {
  readonly familyName: string;
  readonly familySlug: string;
  readonly objectKind: string;
  readonly variantId: string;
  readonly materialClass: string;
  readonly colorHint: string;
  readonly geometry: PreviewGeometry;
  readonly raw?: Record<string, unknown>;
}

interface GeneratorPreviewUpdateMessage {
  readonly type: typeof UPDATE_MESSAGE;
  readonly contract: typeof CONTRACT;
  readonly sequence?: number;
  readonly payload?: Partial<GeneratorPreviewPayload>;
  readonly assets?: readonly File[];
}

export interface GeneratorPreviewRuntimeHandle {
  readonly kind: "vectoplan-editor-generator-preview-runtime.v1";
  applyUpdate(message: GeneratorPreviewUpdateMessage): Promise<void>;
  resetCamera(): void;
  getSnapshot(): Record<string, unknown>;
  destroy(): void;
}

declare global {
  interface Window {
    __VECTOPLAN_GENERATOR_PREVIEW__?: GeneratorPreviewRuntimeHandle;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = "", maximum = 180): string {
  try {
    const normalized = String(value ?? "").trim();
    return (normalized || fallback).slice(0, maximum);
  } catch {
    return fallback;
  }
}

function finite(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number)
    ? THREE.MathUtils.clamp(number, minimum, maximum)
    : fallback;
}

function integer(value: unknown, fallback: number, maximum = 1_000): number {
  return Math.round(finite(value, fallback, 1, maximum));
}

function unitFactor(unit: string): number {
  const normalized = unit.toLowerCase();
  if (["mm", "millimeter", "millimetre"].includes(normalized)) return 0.001;
  if (["cm", "centimeter", "centimetre"].includes(normalized)) return 0.01;
  if (["dm", "dezimeter", "decimetre"].includes(normalized)) return 0.1;
  if (["in", "inch", "zoll"].includes(normalized)) return 0.0254;
  if (["ft", "foot", "feet"].includes(normalized)) return 0.3048;
  return 1;
}

function normalizeGeometry(value: unknown): PreviewGeometry {
  const source = asRecord(value);
  const unit = text(source.unit, "m", 16);
  const factor = unitFactor(unit);
  return {
    shape: text(source.shape ?? source.primitiveShape, "block", 48).toLowerCase(),
    width: finite(source.width, 1, 0.001, 10_000) * factor,
    height: finite(source.height, 1, 0.001, 10_000) * factor,
    depth: finite(source.depth, 1, 0.001, 10_000) * factor,
    unit: "m",
    cellsX: integer(source.cellsX, 1),
    cellsY: integer(source.cellsY, 1),
    cellsZ: integer(source.cellsZ, 1),
  };
}

function normalizePayload(value: unknown): GeneratorPreviewPayload {
  const source = asRecord(value);
  const raw = asRecord(source.raw);
  return {
    familyName: text(source.familyName ?? raw.family_name, "Library-Baustein", 120),
    familySlug: text(source.familySlug ?? raw.family_slug, "", 120),
    objectKind: text(source.objectKind ?? raw.object_kind, "cell_block", 64),
    variantId: text(source.variantId ?? raw.default_variant_id, "default", 120),
    materialClass: text(source.materialClass ?? raw.material_class, "default", 120),
    colorHint: text(source.colorHint ?? raw["material.color_hint"], "", 32),
    geometry: normalizeGeometry(source.geometry ?? source),
    raw,
  };
}

function extension(name: string): string {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function materialColor(materialClass: string, colorHint: string): THREE.Color {
  if (/^#[0-9a-f]{3,8}$/i.test(colorHint)) {
    return new THREE.Color(colorHint);
  }
  const value = materialClass.toLowerCase();
  if (value.includes("ziegel") || value.includes("brick")) return new THREE.Color(0xa94f3d);
  if (value.includes("beton") || value.includes("concrete")) return new THREE.Color(0x9ca3af);
  if (value.includes("stahl") || value.includes("steel") || value.includes("metal")) return new THREE.Color(0x7890a8);
  if (value.includes("holz") || value.includes("wood")) return new THREE.Color(0x9a6a3a);
  if (value.includes("glas") || value.includes("glass")) return new THREE.Color(0x8fd3e8);
  if (value.includes("stein") || value.includes("stone")) return new THREE.Color(0x858a82);
  return new THREE.Color(0x6fa88c);
}

function createMaterial(
  payload: GeneratorPreviewPayload,
  texture: THREE.Texture | null = null,
): THREE.MeshStandardMaterial {
  const glass = /glas|glass/i.test(payload.materialClass);
  return new THREE.MeshStandardMaterial({
    color: texture ? new THREE.Color(0xffffff) : materialColor(payload.materialClass, payload.colorHint),
    map: texture,
    roughness: glass ? 0.12 : 0.72,
    metalness: /stahl|steel|metal/i.test(payload.materialClass) ? 0.62 : 0.04,
    transparent: glass,
    opacity: glass ? 0.48 : 1,
  });
}

function createPrimitiveGeometry(geometry: PreviewGeometry): THREE.BufferGeometry {
  const { width, height, depth } = geometry;
  switch (geometry.shape) {
    case "cylinder":
      return new THREE.CylinderGeometry(width / 2, width / 2, height, 48);
    case "pipe":
      return new THREE.CylinderGeometry(width / 2, width / 2, height, 48, 1, true);
    case "sphere":
      return new THREE.SphereGeometry(Math.max(width, height, depth) / 2, 48, 32);
    default:
      return new THREE.BoxGeometry(width, height, depth);
  }
}

function gridAlignedCenter(geometry: PreviewGeometry): THREE.Vector3 {
  return new THREE.Vector3(
    geometry.width / 2,
    geometry.height / 2,
    geometry.depth / 2,
  );
}

function visibleDivisionCount(value: number): number {
  return THREE.MathUtils.clamp(
    Math.round(value),
    1,
    MAX_VISIBLE_CELL_DIVISIONS,
  );
}

function createModuleEnvelope(geometry: PreviewGeometry): THREE.LineSegments {
  const cellsX = visibleDivisionCount(geometry.cellsX);
  const cellsY = visibleDivisionCount(geometry.cellsY);
  const cellsZ = visibleDivisionCount(geometry.cellsZ);
  const positions: number[] = [];

  const addLine = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ): void => {
    positions.push(x1, y1, z1, x2, y2, z2);
  };

  for (let xIndex = 0; xIndex <= cellsX; xIndex += 1) {
    const x = geometry.width * (xIndex / cellsX);
    for (let yIndex = 0; yIndex <= cellsY; yIndex += 1) {
      const y = geometry.height * (yIndex / cellsY);
      addLine(x, y, 0, x, y, geometry.depth);
    }
  }
  for (let xIndex = 0; xIndex <= cellsX; xIndex += 1) {
    const x = geometry.width * (xIndex / cellsX);
    for (let zIndex = 0; zIndex <= cellsZ; zIndex += 1) {
      const z = geometry.depth * (zIndex / cellsZ);
      addLine(x, 0, z, x, geometry.height, z);
    }
  }
  for (let yIndex = 0; yIndex <= cellsY; yIndex += 1) {
    const y = geometry.height * (yIndex / cellsY);
    for (let zIndex = 0; zIndex <= cellsZ; zIndex += 1) {
      const z = geometry.depth * (zIndex / cellsZ);
      addLine(0, y, z, geometry.width, y, z);
    }
  }

  const frameGeometry = new THREE.BufferGeometry();
  frameGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const frameMaterial = new THREE.LineBasicMaterial({
    color: MODULE_ENVELOPE_COLOR,
    transparent: true,
    opacity: MODULE_ENVELOPE_OPACITY,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
  frame.name = MODULE_ENVELOPE_NAME;
  frame.renderOrder = 50;
  frame.userData = {
    vectoplan: {
      kind: "multi-cell-module-envelope",
      gridAligned: true,
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: {
          x: geometry.width,
          y: geometry.height,
          z: geometry.depth,
        },
      },
      cells: { x: cellsX, y: cellsY, z: cellsZ },
    },
  };
  return frame;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      const record = material as THREE.Material & Record<string, unknown>;
      for (const value of Object.values(record)) {
        if (value instanceof THREE.Texture) {
          (value as THREE.Texture).dispose();
        }
      }
      material.dispose();
    }
  });
}

function markShadows(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function basename(value: string): string {
  return decodeURIComponent(value.split(/[?#]/, 1)[0].replaceAll("\\", "/").split("/").pop() ?? "")
    .toLowerCase();
}

async function parseUploadedModel(files: readonly File[]): Promise<THREE.Object3D | null> {
  const primary = files.find((file) => SUPPORTED_MODEL_EXTENSIONS.includes(
    extension(file.name) as typeof SUPPORTED_MODEL_EXTENSIONS[number],
  ));
  if (!primary) return null;

  const objectUrls = new Map<string, string>();
  for (const file of files) {
    objectUrls.set(file.name.toLowerCase(), URL.createObjectURL(file));
    objectUrls.set(basename(file.name), objectUrls.get(file.name.toLowerCase()) as string);
  }

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => objectUrls.get(url.toLowerCase())
    ?? objectUrls.get(basename(url))
    ?? url);

  try {
    const data = await primary.arrayBuffer();
    switch (extension(primary.name)) {
      case ".glb":
      case ".gltf": {
        const loader = new GLTFLoader(manager);
        const content = extension(primary.name) === ".gltf"
          ? new TextDecoder().decode(data)
          : data;
        const gltf = await new Promise<Awaited<ReturnType<GLTFLoader["parseAsync"]>>>(
          (resolve, reject) => loader.parse(content, "", resolve, reject),
        );
        return gltf.scene;
      }
      case ".obj":
        return new OBJLoader(manager).parse(new TextDecoder().decode(data));
      case ".stl": {
        const mesh = new THREE.Mesh(
          new STLLoader(manager).parse(data),
          new THREE.MeshStandardMaterial({ color: 0xa8b0ba, roughness: 0.68 }),
        );
        return mesh;
      }
      case ".fbx":
        return new FBXLoader(manager).parse(data, "");
      default:
        return null;
    }
  } finally {
    window.setTimeout(() => {
      for (const url of new Set(objectUrls.values())) URL.revokeObjectURL(url);
    }, 1_000);
  }
}

interface UploadedTexture {
  readonly file: File;
  readonly texture: THREE.Texture;
}

function uploadedTextureFile(files: readonly File[]): File | null {
  return files.find((file) => SUPPORTED_TEXTURE_EXTENSIONS.includes(
    extension(file.name) as typeof SUPPORTED_TEXTURE_EXTENSIONS[number],
  )) ?? null;
}

async function loadUploadedTexture(
  files: readonly File[],
  flipY: boolean,
  anisotropy: number,
): Promise<UploadedTexture | null> {
  const file = uploadedTextureFile(files);
  if (!file) return null;

  let texture: THREE.Texture;
  if (extension(file.name) === ".tga") {
    texture = new TGALoader().parse(await file.arrayBuffer());
  } else {
    const objectUrl = URL.createObjectURL(file);
    try {
      texture = await new THREE.TextureLoader().loadAsync(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  texture.name = file.name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = flipY;
  texture.anisotropy = Math.max(1, Math.min(anisotropy, 16));
  texture.needsUpdate = true;
  return { file, texture };
}

function applyTextureToObject(object: THREE.Object3D, texture: THREE.Texture): boolean {
  let applied = false;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      const textured = material as THREE.Material & {
        map?: THREE.Texture | null;
        color?: THREE.Color;
      };
      if (!("map" in textured)) continue;
      textured.map = texture;
      textured.color?.set(0xffffff);
      textured.needsUpdate = true;
      applied = true;
    }
  });
  return applied;
}
function fitModelToDimensions(object: THREE.Object3D, geometry: PreviewGeometry): void {
  object.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(object);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = Math.min(
    geometry.width / Math.max(initialSize.x, 0.0001),
    geometry.height / Math.max(initialSize.y, 0.0001),
    geometry.depth / Math.max(initialSize.z, 0.0001),
  );
  object.scale.multiplyScalar(Number.isFinite(scale) ? scale : 1);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x += (geometry.width / 2) - center.x;
  object.position.z += (geometry.depth / 2) - center.z;
  object.position.y -= box.min.y;
  object.updateMatrixWorld(true);
}

function parseBootstrap(root: HTMLElement): Record<string, unknown> {
  try {
    const script = root.querySelector<HTMLScriptElement>("[data-generator-preview-bootstrap]");
    return asRecord(JSON.parse(script?.textContent ?? "{}"));
  } catch {
    return {};
  }
}

function postToParent(parentOrigin: string, payload: Record<string, unknown>): void {
  if (window.parent === window) return;
  window.parent.postMessage({ contract: CONTRACT, ...payload }, parentOrigin);
}

export function startGeneratorPreview(): GeneratorPreviewRuntimeHandle {
  const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) throw new Error("Generator preview root was not found.");

  const canvas = root.querySelector<HTMLCanvasElement>("[data-generator-preview-canvas]");
  const title = root.querySelector<HTMLElement>("[data-generator-preview-title]");
  const details = root.querySelector<HTMLElement>("[data-generator-preview-details]");
  const status = root.querySelector<HTMLElement>("[data-generator-preview-status]");
  const controlsHost = root.querySelector<HTMLElement>("[data-generator-preview-environment-controls]");
  const resetButton = root.querySelector<HTMLButtonElement>("[data-generator-preview-reset]");
  const fullscreenButton = root.querySelector<HTMLButtonElement>("[data-generator-preview-fullscreen]");
  if (!canvas || !status || !controlsHost) throw new Error("Generator preview DOM is incomplete.");

  const bootstrap = parseBootstrap(root);
  const parentOrigin = text(
    root.dataset.generatorPreviewParentOrigin ?? bootstrap.parentOrigin,
    "http://127.0.0.1:5101",
    512,
  );
  const defaults = normalizePayload(bootstrap.defaultPreview);
  const three: ThreeContextHandle = createThreeContext({
    canvas,
    canvasHost: root,
    antialias: true,
    alpha: false,
    clearColor: "#020617",
    enableShadows: true,
    addDefaultLights: false,
    addDefaultGrid: false,
    near: 0.03,
    far: 1_000,
  });
  three.initialize();

  const scene = three.getScene();
  const renderer = three.getRenderer();
  const camera = three.getCamera();
  camera.rotation.order = "YXZ";

  const environment: EnvironmentSystem = createEnvironmentSystem({
    scene,
    renderer,
    camera,
    controlsHost,
    bootstrap: {
      environment: {
        latitude: 51.1657,
        longitude: 10.4515,
        trueNorthDegrees: 0,
      },
    } as unknown as EditorBootstrap,
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x5f7d62, roughness: 0.94 }),
  );
  ground.name = "generator_preview_ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(200, 200, 0x7f9f84, 0x536b58);
  grid.position.y = 0.002;
  scene.add(grid);

  const objectRoot = new THREE.Group();
  objectRoot.name = "generator_preview_object";
  scene.add(objectRoot);

  const pressed = new Set<string>();
  const objectBounds = new THREE.Box3();
  const clock = new THREE.Clock();
  let payload = defaults;
  let sequence = 0;
  let renderToken = 0;
  let frame = 0;
  let yaw = 0;
  let pitch = 0;
  let verticalVelocity = 0;
  let grounded = true;
  let destroyed = false;
  let updateCount = 0;
  let renderMode: "primitive" | "loading-model" | "uploaded-model" | "model-error" = "primitive";
  let loadedAssetNames: string[] = [];
  let appliedTextureName = "";

  function setStatus(message: string, state: "loading" | "ready" | "error" = "ready"): void {
    status.textContent = message;
    status.dataset.status = state;
  }

  function clearObject(): void {
    for (const child of [...objectRoot.children]) {
      objectRoot.remove(child);
      disposeObject(child);
    }
    objectBounds.makeEmpty();
  }

  function updateIdentity(next: GeneratorPreviewPayload): void {
    if (title) title.textContent = next.familyName;
    if (details) {
      const g = next.geometry;
      details.textContent = `${g.width.toFixed(2)} × ${g.height.toFixed(2)} × ${g.depth.toFixed(2)} m · ${next.materialClass}`;
    }
  }

  function addPrimitive(next: GeneratorPreviewPayload, texture: THREE.Texture | null = null): void {
    const geometry = createPrimitiveGeometry(next.geometry);
    const mesh = new THREE.Mesh(geometry, createMaterial(next, texture));
    mesh.position.copy(gridAlignedCenter(next.geometry));
    markShadows(mesh);
    objectRoot.add(mesh);

    const outlineMaterial = new THREE.LineBasicMaterial({
      color: MODULE_ENVELOPE_COLOR,
      transparent: true,
      opacity: 0.42,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      outlineMaterial,
    );
    outline.position.copy(mesh.position);
    outline.renderOrder = 40;
    objectRoot.add(outline);
    objectBounds.setFromObject(objectRoot);
    renderMode = "primitive";
    loadedAssetNames = texture ? [texture.name] : [];
    appliedTextureName = texture ? texture.name : "";
  }

  function addModuleEnvelope(next: GeneratorPreviewPayload): void {
    objectRoot.add(createModuleEnvelope(next.geometry));
  }

  async function renderUpdate(
    next: GeneratorPreviewPayload,
    assets: readonly File[],
    nextSequence: number,
  ): Promise<void> {
    const token = ++renderToken;
    payload = next;
    sequence = nextSequence;
    updateIdentity(next);
    updateCount += 1;

    const usableFiles = assets
      .filter((file): file is File => file instanceof File)
      .filter((file) => file.size <= 64 * 1024 * 1024)
      .slice(0, 32);
    const hasUploadedModel = usableFiles.some((file) => SUPPORTED_MODEL_EXTENSIONS.includes(
      extension(file.name) as typeof SUPPORTED_MODEL_EXTENSIONS[number],
    ));

    let uploadedTexture: UploadedTexture | null = null;
    try {
      uploadedTexture = await loadUploadedTexture(
        usableFiles,
        !hasUploadedModel,
        renderer.capabilities.getMaxAnisotropy(),
      );
    } catch (error) {
      console.warn("[vectoplan-editor:generator-preview] Textur konnte nicht geladen werden.", error);
    }

    if (token !== renderToken || destroyed) {
      uploadedTexture?.texture.dispose();
      return;
    }

    if (!hasUploadedModel) {
      clearObject();
      addPrimitive(next, uploadedTexture?.texture ?? null);
      setStatus(
        uploadedTexture
          ? "Textur auf Block angewendet · Klicken zum Umsehen"
          : "Generator-Daten übernommen · Klicken zum Umsehen",
        "ready",
      );
      postToParent(parentOrigin, {
        type: RESULT_MESSAGE,
        sequence,
        ok: true,
        renderer: "primitive",
        textureApplied: Boolean(uploadedTexture),
        textureAssetName: uploadedTexture?.file.name ?? "",
      });
      return;
    }

    renderMode = "loading-model";
    setStatus("3D-Modell wird im Editor geladen …", "loading");
    try {
      const model = await parseUploadedModel(usableFiles);
      if (!model || token !== renderToken || destroyed) {
        uploadedTexture?.texture.dispose();
        return;
      }
      fitModelToDimensions(model, next.geometry);
      const textureApplied = uploadedTexture
        ? applyTextureToObject(model, uploadedTexture.texture)
        : false;
      if (uploadedTexture && !textureApplied) {
        uploadedTexture.texture.dispose();
        uploadedTexture = null;
      }
      markShadows(model);

      // Swap only after parsing, fitting and material preparation succeeded.
      clearObject();
      addModuleEnvelope(next);
      objectRoot.add(model);
      objectBounds.setFromObject(objectRoot);
      renderMode = "uploaded-model";
      loadedAssetNames = usableFiles.map((file) => file.name);
      appliedTextureName = textureApplied ? uploadedTexture?.file.name ?? "" : "";
      setStatus(
        textureApplied
          ? "3D-Modell mit Textur aktiv · Rasterhülle eingeblendet"
          : "Hochgeladenes 3D-Modell aktiv · Rasterhülle eingeblendet",
        "ready",
      );
      postToParent(parentOrigin, {
        type: RESULT_MESSAGE,
        sequence,
        ok: true,
        renderer: "uploaded-model",
        textureApplied,
        textureAssetName: appliedTextureName,
      });
    } catch (error) {
      if (token !== renderToken || destroyed) {
        uploadedTexture?.texture.dispose();
        return;
      }
      clearObject();
      addPrimitive(next, uploadedTexture?.texture ?? null);
      renderMode = "model-error";
      setStatus(
        uploadedTexture
          ? "Modell nicht lesbar – Textur wird auf der Formvorschau gezeigt"
          : "Modell nicht lesbar – Formvorschau bleibt aktiv",
        "error",
      );
      postToParent(parentOrigin, {
        type: ERROR_MESSAGE,
        sequence,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  function resetCamera(): void {
    const g = payload.geometry;
    const centerX = g.width / 2;
    const centerZ = g.depth / 2;
    const distance = Math.max(3.2, Math.hypot(g.width, g.depth) * 1.6);
    camera.position.set(centerX + (distance * 0.7), EYE_HEIGHT, centerZ + distance);
    camera.lookAt(centerX, Math.min(g.height * 0.5, EYE_HEIGHT), centerZ);
    camera.rotation.order = "YXZ";
    yaw = camera.rotation.y;
    pitch = camera.rotation.x;
    verticalVelocity = 0;
    grounded = true;
  }

  function collides(position: THREE.Vector3): boolean {
    if (objectBounds.isEmpty()) return false;
    const feet = position.y - EYE_HEIGHT;
    if (feet > objectBounds.max.y || position.y < objectBounds.min.y) return false;
    return position.x > objectBounds.min.x - PLAYER_RADIUS
      && position.x < objectBounds.max.x + PLAYER_RADIUS
      && position.z > objectBounds.min.z - PLAYER_RADIUS
      && position.z < objectBounds.max.z + PLAYER_RADIUS;
  }

  function updateMovement(delta: number): void {
    const forwardAmount = Number(pressed.has("KeyW") || pressed.has("ArrowUp"))
      - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
    const rightAmount = Number(pressed.has("KeyD") || pressed.has("ArrowRight"))
      - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
    const direction = new THREE.Vector3();
    if (forwardAmount || rightAmount) {
      direction.set(
        -Math.sin(yaw) * forwardAmount + Math.cos(yaw) * rightAmount,
        0,
        -Math.cos(yaw) * forwardAmount - Math.sin(yaw) * rightAmount,
      ).normalize();
      const speed = pressed.has("ShiftLeft") || pressed.has("ShiftRight")
        ? SPRINT_SPEED
        : WALK_SPEED;
      const nextX = camera.position.clone();
      nextX.x += direction.x * speed * delta;
      nextX.x = THREE.MathUtils.clamp(nextX.x, -98, 98);
      if (!collides(nextX)) camera.position.x = nextX.x;
      const nextZ = camera.position.clone();
      nextZ.z += direction.z * speed * delta;
      nextZ.z = THREE.MathUtils.clamp(nextZ.z, -98, 98);
      if (!collides(nextZ)) camera.position.z = nextZ.z;
    }

    if (pressed.has("Space") && grounded) {
      verticalVelocity = JUMP_SPEED;
      grounded = false;
    }
    verticalVelocity -= GRAVITY * delta;
    camera.position.y += verticalVelocity * delta;
    if (camera.position.y <= EYE_HEIGHT) {
      camera.position.y = EYE_HEIGHT;
      verticalVelocity = 0;
      grounded = true;
    }
  }

  function resize(): void {
    const bounds = root.getBoundingClientRect();
    three.resize({
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      updateCanvasStyle: false,
    });
  }

  function animate(): void {
    if (destroyed) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);
    environment.update(delta);
    three.render({ deltaMs: delta * 1_000 });
    frame = window.requestAnimationFrame(animate);
  }

  const handle: GeneratorPreviewRuntimeHandle = {
    kind: "vectoplan-editor-generator-preview-runtime.v1",
    async applyUpdate(message): Promise<void> {
      if (message.contract !== CONTRACT || message.type !== UPDATE_MESSAGE) return;
      const next = normalizePayload(message.payload);
      const nextSequence = Number.isFinite(message.sequence) ? Number(message.sequence) : sequence + 1;
      await renderUpdate(next, message.assets ?? [], nextSequence);
    },
    resetCamera,
    getSnapshot: () => ({
      contract: CONTRACT,
      sequence,
      updateCount,
      frameCount: renderer.info.render.frame,
      chunkServiceEnabled: false,
      inventoryEnabled: false,
      realtimeEnabled: false,
      payload,
      rendering: {
        mode: renderMode,
        gridAnchor: "cell-boundaries",
        moduleEnvelopeVisible: Boolean(objectRoot.getObjectByName(MODULE_ENVELOPE_NAME)),
        objectNames: objectRoot.children.map((child) => child.name),
        loadedAssetNames: [...loadedAssetNames],
        appliedTextureName,
        bounds: objectBounds.isEmpty()
          ? null
          : {
            min: objectBounds.min.toArray(),
            max: objectBounds.max.toArray(),
          },
      },
      environment: environment.getSnapshot(),
      camera: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        yaw,
        pitch,
      },
    }),
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("message", onMessage);
      environment.destroy();
      clearObject();
      scene.remove(objectRoot, grid, ground);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      three.dispose("generator-preview-destroy");
    },
  };

  function onPointerLockChange(): void {
    root.dataset.pointerLocked = String(document.pointerLockElement === canvas);
  }

  function onMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement !== canvas) return;
    yaw -= event.movementX * 0.0022;
    pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0022, -1.5, 1.5);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  function onKeyDown(event: KeyboardEvent): void {
    pressed.add(event.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    pressed.delete(event.code);
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== parentOrigin) return;
    const message = asRecord(event.data) as unknown as GeneratorPreviewUpdateMessage;
    if (message.contract !== CONTRACT || message.type !== UPDATE_MESSAGE) return;
    void handle.applyUpdate(message);
  }

  canvas.addEventListener("click", () => {
    if (document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock();
    }
  });
  resetButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    resetCamera();
  });
  fullscreenButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void root.requestFullscreen();
    }
  });
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", onMouseMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("message", onMessage);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();
  clearObject();
  addPrimitive(defaults);
  updateIdentity(defaults);
  resetCamera();
  setStatus("Editor bereit · Warte auf Generator-Daten", "ready");
  animate();

  window.__VECTOPLAN_GENERATOR_PREVIEW__ = handle;
  postToParent(parentOrigin, {
    type: READY_MESSAGE,
    ok: true,
    route: window.location.pathname,
    capabilities: {
      chunkFree: true,
      firstPersonMovement: true,
      primitives: true,
      uploadedModels: [...SUPPORTED_MODEL_EXTENSIONS],
      skyAndSun: true,
      shadows: true,
    },
  });
  window.dispatchEvent(new CustomEvent(READY_MESSAGE, {
    detail: handle.getSnapshot(),
  }));
  window.addEventListener("pagehide", () => handle.destroy(), { once: true });
  return handle;
}
