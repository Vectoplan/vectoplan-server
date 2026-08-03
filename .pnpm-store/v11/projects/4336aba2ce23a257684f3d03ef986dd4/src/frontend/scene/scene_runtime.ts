// services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
import * as THREE from "three";
import {
  createEnvironmentSystem,
  type EnvironmentSystem,
} from "@render/environment_system";
import {
  createEditorRealtimeClient,
  type EditorRealtimeClient,
  type EditorRealtimeEvent,
  type RealtimeHeldItem,
  type RealtimeMember,
  type RealtimePresenceState,
} from "./realtime_client";
import {
  createRemoteAvatarScene,
  type RemoteAvatarScene,
} from "./remote_avatar_scene";
import {
  createHeldItemVisual,
  type HeldItemVisualHandle,
} from "./held_item_visual";
import {
  createChunkMapOverlay,
  type ChunkMapOverlayHandle,
  type ChunkMapPlayer,
} from "./chunk_map_overlay";
import {
  createNavigationCompass,
  type NavigationCompassHandle,
  type NavigationCompassMarker,
} from "./navigation_compass";
import { isChunkApiFailedResult } from "@api/chunk_api_models";
import type {
  ChunkApiClient,
  ChunkApiCommandResult,
  ChunkApiFailedResult,
  ChunkApiWorldPosition,
} from "@api/chunk_api_models";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  getEditorCanvas,
  setDomBootMessage,
  setDomCanvasAriaActive,
  setDomLiveMessage,
  type EditorDomRefs,
} from "@dom/dom_refs";
import {
  createEditorResizeObserver,
  type EditorResizeObserverHandle,
  type EditorResizeSnapshot,
} from "@dom/resize_observer";
import {
  createEditorInputController,
  type EditorInputBlockIntent,
  type EditorInputControllerHandle,
  type EditorInputMovementIntent,
} from "@input/input_controller";
import {
  createHotbarController,
  type HotbarControllerHandle,
} from "@inventory/hotbar_controller";
import {
  createLibraryInventorySource,
  type LibraryInventorySourceHandle,
} from "@inventory/library_inventory_source";
import type { EditorLogger } from "@utils/logger";
import { createEditorId } from "@utils/ids";
import {
  normalizeUnknownError,
  safeBoolean,
  safeInteger,
  safeNumber,
  safeString,
} from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import {
  selectActiveLibraryRef,
  selectActivePlacementCommand,
  selectActiveRuntimeBlockTypeId,
  selectInventoryItemBySlot,
  selectSelectedFamilyId,
  selectSelectedInventoryItem,
  selectSelectedInventorySlot,
  selectSelectedLibraryItemId,
  selectSelectedPackageId,
  selectSelectedRevisionHash,
  selectSelectedSlotIndex,
  selectSelectedVariantId,
  selectSelectedVplibUid,
} from "@state/state_selectors";
import type { WorldRuntimeHandle } from "@runtime/world/world_runtime";
import {
  createPhysicsRuntime,
  type PhysicsRuntime,
  type PhysicsRuntimeConfigPatch,
  type PhysicsRuntimeFrameResult,
} from "@runtime/physics/physics_runtime";
import type {
  PhysicsCameraBinding,
  PhysicsEulerAngles,
} from "@runtime/physics/physics_models";
import type {
  RuntimeChunkContent,
  RuntimeChunkPaletteEntry,
} from "@runtime/world/chunk_content";
import { forEachNonAirCellSpan } from "@api/chunk_cell_storage";
import {
  chunkCoordinatesFromKey,
  createChunkCellAddress,
  localCoordinatesFromCellIndex,
  worldToChunkCoordinates,
  visibleChunkCoordinatesAround,
  type ChunkCoordinates,
  type ChunkWorldPosition,
} from "@runtime/world/chunk_coordinates";
import {
  createEditorUiRuntime,
  type EditorUiRuntimeHandle,
} from "@ui/editor_ui_runtime";
import {
  ALLOW_CHUNK_PLACEABLE_FALLBACK,
  BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
  DEBUG_GRASS_DIRT_ALLOWED,
  DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  asEditorInventoryContractRecord,
  editorInventoryContractDiagnostics,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  hasLibraryIdentity as contractHasLibraryIdentity,
  isForbiddenDebugBlockTypeId as contractIsForbiddenDebugBlockTypeId,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId as normalizeContractRuntimeBlockTypeId,
} from "../contracts/editor_inventory_contract";

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
  readonly onExitRequested?: () => void | Promise<void>;
}

export interface SceneRuntimeSnapshot {
  readonly kind: "scene-runtime-snapshot.v1";
  readonly id: string;
  readonly status: SceneRuntimeStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly initializedAt: string | null;
  readonly destroyedAt: string | null;
  readonly frameCount: number;
  readonly renderCount: number;
  readonly meshCount: number;
  readonly materialCount: number;
  readonly renderedChunkKeys: readonly string[];
  readonly lastRenderedAt: string | null;
  readonly lastTargetSignature: string | null;
  readonly lastCameraChunkKey: string | null;
  readonly lastPlacement: ActiveLibraryPlacement | null;
  readonly placeIntentCount: number;
  readonly blockedPlaceIntentCount: number;
  readonly removeIntentCount: number;
  readonly lastError: Record<string, unknown> | null;
  readonly inventory: SceneInventoryBootstrapConfig;
  readonly resize: ReturnType<EditorResizeObserverHandle["getSnapshot"]> | null;
  readonly input: ReturnType<EditorInputControllerHandle["getSnapshot"]> | null;
  readonly ui: ReturnType<EditorUiRuntimeHandle["getSnapshot"]> | null;
  readonly physics: ReturnType<PhysicsRuntime["snapshot"]> | null;
  readonly hotbar: ReturnType<HotbarControllerHandle["getSnapshot"]> | null;
}

export interface SceneRuntimeHandle {
  readonly kind: "vectoplan-editor-scene-runtime.v1";

  initialize(): Promise<void>;

  start(reason?: string): void;
  pause(reason?: string): void;
  renderOnce(reason?: string): void;

  requestFullRefresh(reason?: string): Promise<void>;
  reloadDirtyChunks(reason?: string): Promise<void>;

  getStatus(): SceneRuntimeStatus;
  getRenderer(): THREE.WebGLRenderer | null;
  getScene(): THREE.Scene | null;
  getCamera(): THREE.PerspectiveCamera | null;
  getInputController(): EditorInputControllerHandle | null;
  getUiRuntime(): EditorUiRuntimeHandle | null;
  getHotbarController(): HotbarControllerHandle | null;
  getSnapshot(): SceneRuntimeSnapshot;

  destroy(reason?: string): Promise<void>;
}

interface ChunkMeshRecord {
  readonly chunkKey: string;
  readonly group: THREE.Group;
  readonly meshes: readonly THREE.InstancedMesh[];
  readonly materials: readonly THREE.Material[];
  readonly geometry: THREE.BufferGeometry;
  readonly cellRecords: readonly MeshCellRecord[];
}

interface MeshCellRecord {
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly localX: number;
  readonly localY: number;
  readonly localZ: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  readonly cellValue: number;
  readonly blockTypeId: string | null;
}

interface SceneInventoryBootstrapConfig {
  readonly apiUrl: typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  readonly hotbarSize: number;
  readonly selectedSlot: number;
  readonly forceRefreshOnBoot: boolean;
  readonly enabled: boolean;
  readonly onlyLibraryItemsPlaceable: typeof ONLY_LIBRARY_ITEMS_PLACEABLE;
  readonly debugGrassDirtAllowed: typeof DEBUG_GRASS_DIRT_ALLOWED;
  readonly allowChunkPlaceableFallback: typeof ALLOW_CHUNK_PLACEABLE_FALLBACK;
}

interface ActiveLibraryPlacement {
  readonly valid: boolean;
  readonly reason: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly blockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly inventoryItemId: string | null;
  readonly inventorySlotIndex: number | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly label: string | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly commandMetadata: Record<string, unknown>;
}

interface SceneLibraryPlacementSource {
  placeLibraryItem(
    position: ChunkApiWorldPosition,
    placement: Record<string, unknown>,
    commandOptions?: Record<string, unknown>,
  ): Promise<unknown>;
}

interface SceneRemoveBlockSource {
  removeBlock(
    position: ChunkApiWorldPosition,
    commandOptions?: Record<string, unknown>,
  ): Promise<unknown>;
}

const SCENE_RUNTIME_KIND = "vectoplan-editor-scene-runtime.v1" as const;
const SCENE_RUNTIME_SNAPSHOT_KIND = "scene-runtime-snapshot.v1" as const;

const DEFAULT_CLEAR_COLOR = "#020617";
const DEFAULT_CAMERA_SENSITIVITY = 0.0022;
const DEFAULT_TARGET_MAX_DISTANCE = 9;
const DEFAULT_MAX_MESH_CELLS_PER_CHUNK = 4096;
const DEFAULT_INVENTORY_API_URL = PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
const DEFAULT_HOTBAR_SLOT_COUNT: number = Number(DEFAULT_EDITOR_INVENTORY_SLOT_COUNT) || 9;

const MAX_SCENE_RUNTIME_CACHE_ENTRIES = 512;
const OPTIONAL_TEXT_CACHE = new Map<string, string | null>();
const RUNTIME_BLOCK_TYPE_ID_CACHE = new Map<string, string | null>();

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_SCENE_RUNTIME_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearSceneRuntimeCaches(): void {
  try {
    OPTIONAL_TEXT_CACHE.clear();
    RUNTIME_BLOCK_TYPE_ID_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function nowMs(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
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
    // Scene logging must never break rendering.
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
    // Scene logging must never break rendering.
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
    // Scene logging must never break rendering.
  }
}

function setStoreAction(
  store: EditorStore,
  action: Parameters<typeof applyEditorAction>[1],
  options?: {
    readonly notify?: boolean;
    readonly captureHistory?: boolean;
  },
): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, action),
      {
        action: action.kind,
        notify: options?.notify ?? true,
        captureHistory: options?.captureHistory ?? false,
      },
    );
  } catch {
    // Store updates must never break rendering.
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return asEditorInventoryContractRecord(value);
}

function asArray(value: unknown): readonly unknown[] {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readNestedValue(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;

  for (const key of path) {
    const record = asRecord(current);
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      return undefined;
    }
    current = record[key];
  }

  return current;
}

function firstDefined(...values: readonly unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function normalizeOptionalText(value: unknown): string | null {
  try {
    if (typeof value === "string") {
      const cached = OPTIONAL_TEXT_CACHE.get(value);
      if (cached !== undefined) {
        return cached;
      }

      return setCachedValue(
        OPTIONAL_TEXT_CACHE,
        value,
        normalizeOptionalContractText(value),
      );
    }

    return normalizeOptionalContractText(value);
  } catch {
    return null;
  }
}

function isForbiddenRuntimeBlockTypeId(value: unknown): boolean {
  return contractIsForbiddenDebugBlockTypeId(value);
}

function normalizeRuntimeBlockTypeId(value: unknown): string | null {
  try {
    const raw = String(value ?? "");
    const cached = RUNTIME_BLOCK_TYPE_ID_CACHE.get(raw);
    if (cached !== undefined) {
      return cached;
    }

    return setCachedValue(
      RUNTIME_BLOCK_TYPE_ID_CACHE,
      raw,
      normalizeContractRuntimeBlockTypeId(value),
    );
  } catch {
    return null;
  }
}

function normalizeInventoryApiUrl(
  value: unknown,
): typeof PRODUCTIVE_EDITOR_INVENTORY_ROUTE {
  const raw = safeString(value, DEFAULT_INVENTORY_API_URL).trim();

  if (!raw) {
    return PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  }

  /**
   * The browser-facing productive hotbar source is always the editor inventory
   * proxy route. Do not call vectoplan-library directly from the scene.
   */
  if (raw.includes(PRODUCTIVE_EDITOR_INVENTORY_ROUTE)) {
    return PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
  }

  return PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
}

function normalizeInventoryBootstrapConfig(
  bootstrap: EditorBootstrap,
): SceneInventoryBootstrapConfig {
  const hotbarSize = safeInteger(
    firstDefined(
      readNestedValue(bootstrap, ["inventory", "hotbarSize"]),
      readNestedValue(bootstrap, ["inventory", "slotCount"]),
      readNestedValue(bootstrap, ["runtime", "inventory", "hotbarSize"]),
      readNestedValue(bootstrap, ["runtime", "inventory", "slotCount"]),
      readNestedValue(bootstrap, ["runtime", "ui", "hotbarSlots"]),
      DEFAULT_HOTBAR_SLOT_COUNT,
    ),
    DEFAULT_HOTBAR_SLOT_COUNT,
    {
      min: 1,
      max: 64,
    },
  );

  const selectedSlot = safeInteger(
    firstDefined(
      readNestedValue(bootstrap, ["inventory", "selectedSlot"]),
      readNestedValue(bootstrap, ["inventory", "defaultSelectedSlot"]),
      readNestedValue(bootstrap, ["runtime", "inventory", "selectedSlot"]),
      readNestedValue(bootstrap, ["runtime", "inventory", "defaultSelectedSlot"]),
      0,
    ),
    0,
    {
      min: 0,
      max: Math.max(0, hotbarSize - 1),
    },
  );

  return {
    apiUrl: normalizeInventoryApiUrl(
      firstDefined(
        readNestedValue(bootstrap, ["inventory", "apiUrl"]),
        readNestedValue(bootstrap, ["inventory", "inventoryUrl"]),
        readNestedValue(bootstrap, ["inventory", "route"]),
        readNestedValue(bootstrap, ["runtime", "inventory", "apiUrl"]),
        readNestedValue(bootstrap, ["runtime", "inventory", "inventoryUrl"]),
        readNestedValue(bootstrap, ["runtime", "inventory", "route"]),
        readNestedValue(bootstrap, ["runtime", "library", "inventoryRoute"]),
        DEFAULT_INVENTORY_API_URL,
      ),
    ),
    hotbarSize,
    selectedSlot,
    forceRefreshOnBoot: safeBoolean(
      firstDefined(
        readNestedValue(bootstrap, ["inventory", "forceRefreshOnBoot"]),
        readNestedValue(bootstrap, ["runtime", "inventory", "forceRefreshOnBoot"]),
        false,
      ),
      false,
    ),
    enabled: safeBoolean(
      firstDefined(
        readNestedValue(bootstrap, ["inventory", "enabled"]),
        readNestedValue(bootstrap, ["runtime", "inventory", "enabled"]),
        true,
      ),
      true,
    ),
    onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
    debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
    allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
  };
}

function sourceSupportsLibraryPlacement(
  source: unknown,
): source is SceneLibraryPlacementSource {
  try {
    return typeof asRecord(source).placeLibraryItem === "function";
  } catch {
    return false;
  }
}

function sourceSupportsRemoveBlock(source: unknown): source is SceneRemoveBlockSource {
  try {
    return typeof asRecord(source).removeBlock === "function";
  } catch {
    return false;
  }
}

function commandResultFromUnknown(value: unknown): ChunkApiCommandResult | null {
  try {
    const record = asRecord(value);
    const candidate =
      record.result ??
      readNestedValue(record, ["raw", "result"]) ??
      readNestedValue(record, ["payload", "result"]);

    if (candidate && typeof candidate === "object") {
      return candidate as ChunkApiCommandResult;
    }

    if (record.ok === true && record.commandId) {
      return record as unknown as ChunkApiCommandResult;
    }

    return null;
  } catch {
    return null;
  }
}

function reloadedChunkCountFromUnknown(value: unknown): number {
  try {
    const record = asRecord(value);
    const direct =
      record.reloadedChunks ??
      record.loadedChunks ??
      record.chunks ??
      record.dirtyChunks ??
      readNestedValue(record, ["result", "reloadedChunks"]);

    return asArray(direct).length;
  } catch {
    return 0;
  }
}

function dirtyChunkKeysFromUnknown(value: unknown): readonly string[] {
  try {
    const record = asRecord(value);
    const direct =
      record.dirtyChunkKeys ??
      record.dirtyChunks ??
      record.reloadedChunkKeys ??
      readNestedValue(record, ["result", "dirtyChunkKeys"]);

    return asArray(direct)
      .map((item) => safeString(item, ""))
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function disposeObject3D(object: THREE.Object3D): void {
  try {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;

      const geometry = mesh.geometry;
      if (geometry && typeof geometry.dispose === "function") {
        geometry.dispose();
      }

      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const item of material) {
          item?.dispose?.();
        }
      } else {
        material?.dispose?.();
      }
    });
  } catch {
    // Dispose is best-effort.
  }
}

function paletteColor(entry: RuntimeChunkPaletteEntry | null): THREE.Color {
  try {
    const color = safeString(entry?.color, "");

    if (color.length > 0) {
      return new THREE.Color(color);
    }

    const blockTypeId = safeString(entry?.blockTypeId, "runtime-block");
    let hash = 0;

    for (let index = 0; index < blockTypeId.length; index += 1) {
      hash = ((hash << 5) - hash + blockTypeId.charCodeAt(index)) | 0;
    }

    const hue = Math.abs(hash % 360) / 360;
    return new THREE.Color().setHSL(hue, 0.52, 0.48);
  } catch {
    return new THREE.Color("#64748b");
  }
}

function createMaterial(
  entry: RuntimeChunkPaletteEntry | null,
): THREE.MeshStandardMaterial {
  const color = paletteColor(entry);

  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.02,
  });
}

function normalizeCameraPosition(position: unknown): THREE.Vector3 {
  const record = position as { x?: unknown; y?: unknown; z?: unknown } | null | undefined;

  return new THREE.Vector3(
    safeNumber(record?.x, 8),
    safeNumber(record?.y, 4),
    safeNumber(record?.z, 18),
  );
}

function normalizeCameraRotation(rotation: unknown): THREE.Euler {
  const record = rotation as { pitch?: unknown; yaw?: unknown; roll?: unknown } | null | undefined;

  return new THREE.Euler(
    safeNumber(record?.pitch, 0),
    safeNumber(record?.yaw, Math.PI),
    safeNumber(record?.roll, 0),
    "YXZ",
  );
}

function chunkKeyFromCoordinatesLocal(coordinates: ChunkCoordinates): string {
  return `${safeInteger(coordinates.chunkX, 0)}:${safeInteger(coordinates.chunkY, 0)}:${safeInteger(coordinates.chunkZ, 0)}`;
}

function createCellRecord(
  chunk: RuntimeChunkContent,
  cellIndex: number,
  cellValue: number,
  entry: RuntimeChunkPaletteEntry | null,
): MeshCellRecord {
  const local = localCoordinatesFromCellIndex(cellIndex, chunk.chunkSize);

  return {
    chunkKey: chunk.chunkKey,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    chunkZ: chunk.chunkZ,
    localX: local.localX,
    localY: local.localY,
    localZ: local.localZ,
    worldX: (chunk.chunkX * chunk.chunkSize) + local.localX,
    worldY: (chunk.chunkY * chunk.chunkSize) + local.localY,
    worldZ: (chunk.chunkZ * chunk.chunkSize) + local.localZ,
    cellValue,
    blockTypeId: entry?.blockTypeId ?? null,
  };
}

function createEditorCellFromRecord(record: MeshCellRecord): {
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly localX: number;
  readonly localY: number;
  readonly localZ: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  readonly cellValue: number;
  readonly blockTypeId: string | null;
} {
  return {
    chunkKey: record.chunkKey,
    chunkX: record.chunkX,
    chunkY: record.chunkY,
    chunkZ: record.chunkZ,
    localX: record.localX,
    localY: record.localY,
    localZ: record.localZ,
    worldX: record.worldX,
    worldY: record.worldY,
    worldZ: record.worldZ,
    cellValue: record.cellValue,
    blockTypeId: record.blockTypeId,
  };
}

function materialKeyForCellValue(cellValue: number): string {
  return `cell_${cellValue}`;
}


function isNonAirOccluder(value: unknown): boolean {
  try {
    const normalized = safeInteger(value, 0, {
      min: -1,
      max: Number.MAX_SAFE_INTEGER,
    });
    return normalized !== 0;
  } catch {
    return false;
  }
}

function isCellFullyOccluded(
  chunk: RuntimeChunkContent,
  cellIndex: number,
): boolean {
  const local = localCoordinatesFromCellIndex(cellIndex, chunk.chunkSize);
  const last = chunk.chunkSize - 1;
  if (
    local.localX <= 0
    || local.localX >= last
    || local.localY <= 0
    || local.localY >= last
    || local.localZ <= 0
    || local.localZ >= last
  ) {
    return false;
  }

  const yStride = chunk.chunkSize;
  const zStride = chunk.chunkSize * chunk.chunkSize;
  return [
    cellIndex - 1,
    cellIndex + 1,
    cellIndex - yStride,
    cellIndex + yStride,
    cellIndex - zStride,
    cellIndex + zStride,
  ].every((neighborIndex) => isNonAirOccluder(chunk.cells[neighborIndex]));
}

function createChunkMeshRecord(chunk: RuntimeChunkContent): ChunkMeshRecord {
  const group = new THREE.Group();
  group.name = `chunk:${chunk.chunkKey}`;
  group.userData.chunkKey = chunk.chunkKey;

  const cellSize = safeNumber(chunk.cellSize, 1, {
    min: 0.000001,
    max: 1_000,
  });
  const geometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);
  const byCellValue = new Map<number, MeshCellRecord[]>();
  const maxCells = Math.min(chunk.cells.length, DEFAULT_MAX_MESH_CELLS_PER_CHUNK);

  forEachNonAirCellSpan(chunk.cells, (start, end, rawCellValue) => {
    const cellValue = safeInteger(rawCellValue, 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });

    if (cellValue <= 0) {
      return;
    }

    for (let cellIndex = start; cellIndex < end && cellIndex < maxCells; cellIndex += 1) {
      if (isCellFullyOccluded(chunk, cellIndex)) {
        continue;
      }

      const entry = chunk.paletteByCellValue.get(cellValue) ?? null;
      const record = createCellRecord(chunk, cellIndex, cellValue, entry);

      const existing = byCellValue.get(cellValue) ?? [];
      existing.push(record);
      byCellValue.set(cellValue, existing);
    }
  });

  const meshes: THREE.InstancedMesh[] = [];
  const materials: THREE.Material[] = [];
  const allCellRecords: MeshCellRecord[] = [];
  const matrix = new THREE.Matrix4();

  for (const [cellValue, records] of byCellValue.entries()) {
    const entry = chunk.paletteByCellValue.get(cellValue) ?? null;
    const material = createMaterial(entry);
    material.name = materialKeyForCellValue(cellValue);

    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      Math.max(1, records.length),
    );
    mesh.name = `chunk:${chunk.chunkKey}:cell:${cellValue}`;
    mesh.frustumCulled = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.chunkKey = chunk.chunkKey;
    mesh.userData.cellValue = cellValue;
    mesh.userData.cells = records;

    records.forEach((record, index) => {
      matrix.makeTranslation(
        (record.worldX * cellSize) + (cellSize / 2),
        (record.worldY * cellSize) + (cellSize / 2),
        (record.worldZ * cellSize) + (cellSize / 2),
      );
      mesh.setMatrixAt(index, matrix);
      allCellRecords.push(record);
    });

    mesh.instanceMatrix.needsUpdate = true;
    // Instanced terrain blocks carry world-space translations. Recompute the
    // aggregate bounds after all instance matrices are written so Three.js
    // cannot frustum-cull a whole terrain chunk using the unit cube at origin.
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
    materials.push(material);
  }

  return {
    chunkKey: chunk.chunkKey,
    group,
    meshes,
    materials,
    geometry,
    cellRecords: allCellRecords,
  };
}

function createRenderer(
  canvas: HTMLCanvasElement,
  bootstrap: EditorBootstrap,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: safeBoolean(bootstrap.render.antialias, true),
    alpha: safeBoolean(bootstrap.render.alpha, false),
    powerPreference: "high-performance",
  });

  renderer.setClearColor(
    new THREE.Color(safeString(bootstrap.render.clearColor, DEFAULT_CLEAR_COLOR)),
    1,
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;

  return renderer;
}

function createScene(bootstrap: EditorBootstrap): THREE.Scene {
  const scene = new THREE.Scene();
  scene.name = "vectoplan-editor-scene";
  const clearColor = new THREE.Color(
    safeString(bootstrap.render.clearColor, DEFAULT_CLEAR_COLOR),
  );
  const visibleChunkRadius = safeInteger(bootstrap.render.visibleChunkRadius, 7, {
    min: 0,
    max: 16,
  });
  const initialFogRadius = Math.min(5, visibleChunkRadius);
  const fogFar = Math.max(48, (initialFogRadius - 1) * 16);
  const fogNear = Math.max(32, fogFar - 48);

  scene.background = clearColor;
  scene.fog = new THREE.Fog(clearColor, fogNear, fogFar);

  return scene;
}

function createCamera(bootstrap: EditorBootstrap): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    safeNumber(bootstrap.camera.fov, 65, {
      min: 10,
      max: 140,
    }),
    1,
    safeNumber(bootstrap.camera.near, 0.05, {
      min: 0.001,
      max: 10,
    }),
    safeNumber(bootstrap.camera.far, 1_000, {
      min: 10,
      max: 1_000_000,
    }),
  );

  camera.name = "vectoplan-editor-camera";
  camera.position.copy(normalizeCameraPosition(bootstrap.camera.spawn));
  camera.rotation.copy(normalizeCameraRotation(bootstrap.camera.rotation));
  camera.rotation.order = "YXZ";

  return camera;
}

function updateCameraAspect(
  camera: THREE.PerspectiveCamera,
  snapshot: EditorResizeSnapshot,
): void {
  try {
    camera.aspect = snapshot.aspect || 1;
    camera.updateProjectionMatrix();
  } catch {
    // Aspect update must not throw.
  }
}

function movementVectorFromIntent(
  intent: EditorInputMovementIntent,
  yaw: number,
): THREE.Vector3 {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new THREE.Vector3(0, 1, 0);

  const output = new THREE.Vector3();
  output.addScaledVector(forward, intent.forward);
  output.addScaledVector(right, intent.right);
  output.addScaledVector(up, intent.up);

  if (output.lengthSq() > 1) {
    output.normalize();
  }

  return output;
}

function getScenePhysicsBootstrap(
  bootstrap: EditorBootstrap,
): NonNullable<EditorBootstrap["runtime"]["physics"]> {
  try {
    return bootstrap.runtime.physics ?? bootstrap.physics;
  } catch {
    return bootstrap.physics;
  }
}

function shouldUseScenePhysicsRuntime(bootstrap: EditorBootstrap): boolean {
  try {
    const physics = getScenePhysicsBootstrap(bootstrap);

    return Boolean(
      physics.enabled &&
        bootstrap.featureFlags.physicsEnabled &&
        bootstrap.featureFlags.playerCollisionEnabled,
    );
  } catch {
    return false;
  }
}

function shouldSceneCameraFollowPhysics(bootstrap: EditorBootstrap): boolean {
  try {
    return Boolean(
      shouldUseScenePhysicsRuntime(bootstrap) &&
        bootstrap.camera.physicsFollowEnabled,
    );
  } catch {
    return false;
  }
}

function createPhysicsRuntimeConfigFromBootstrap(
  bootstrap: EditorBootstrap,
): PhysicsRuntimeConfigPatch {
  const physics = getScenePhysicsBootstrap(bootstrap);
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
  } as PhysicsRuntimeConfigPatch;
}

function physicsAnglesFromCamera(camera: THREE.PerspectiveCamera): PhysicsEulerAngles {
  try {
    return {
      yaw: safeNumber(camera.rotation.y, 0),
      pitch: safeNumber(camera.rotation.x, 0),
      roll: safeNumber(camera.rotation.z, 0),
    };
  } catch {
    return {
      yaw: 0,
      pitch: 0,
      roll: 0,
    };
  }
}

function applyPhysicsCameraBindingToThreeCamera(
  camera: THREE.PerspectiveCamera,
  binding: PhysicsCameraBinding,
): void {
  try {
    camera.position.set(
      safeNumber(binding.eyePosition.x, camera.position.x),
      safeNumber(binding.eyePosition.y, camera.position.y),
      safeNumber(binding.eyePosition.z, camera.position.z),
    );
    camera.rotation.set(
      safeNumber(binding.angles.pitch, camera.rotation.x),
      safeNumber(binding.angles.yaw, camera.rotation.y),
      safeNumber(binding.angles.roll, camera.rotation.z),
      "YXZ",
    );
    camera.updateMatrixWorld(true);
  } catch {
    // Camera binding is best-effort; the next frame can recover.
  }
}

function targetSignatureFromCells(
  sourceCell: {
    readonly chunkKey: string;
    readonly worldX: number;
    readonly worldY: number;
    readonly worldZ: number;
    readonly cellValue: number;
  } | null,
  placementCell: {
    readonly chunkKey: string;
    readonly worldX: number;
    readonly worldY: number;
    readonly worldZ: number;
    readonly cellValue: number;
  } | null,
  status: string,
): string {
  return [
    status,
    sourceCell
      ? `${sourceCell.chunkKey}:${sourceCell.worldX}:${sourceCell.worldY}:${sourceCell.worldZ}:${sourceCell.cellValue}`
      : "none",
    placementCell
      ? `${placementCell.chunkKey}:${placementCell.worldX}:${placementCell.worldY}:${placementCell.worldZ}:${placementCell.cellValue}`
      : "none",
  ].join("|");
}

function commandField(
  command: EditorInventoryPlacementCommand | null,
  key: string,
): string | null {
  try {
    if (!command || typeof command !== "object") {
      return null;
    }

    const value = (command as unknown as Record<string, unknown>)[key];

    return normalizeOptionalText(value);
  } catch {
    return null;
  }
}

function hasLibraryIdentity(input: {
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly vplibUid: string | null;
}): boolean {
  return contractHasLibraryIdentity(input);
}

function placementIntentMetadata(
  intent: EditorInputBlockIntent | null | undefined,
): Record<string, unknown> {
  try {
    const placement = intent?.libraryPlacement;

    return {
      trigger: intent?.trigger ?? null,
      intentRuntimeBlockTypeId: intent?.runtimeBlockTypeId ?? null,
      intentLibraryItemId: intent?.libraryItemId ?? null,
      intentInventoryItemId: intent?.inventoryItemId ?? null,
      intentInventorySlotIndex: intent?.inventorySlotIndex ?? null,
      intentFamilyId: intent?.familyId ?? null,
      intentPackageId: intent?.packageId ?? null,
      intentVplibUid: intent?.vplibUid ?? null,
      intentVariantId: intent?.variantId ?? null,
      intentRevisionHash: intent?.revisionHash ?? null,
      intentObjectKind: intent?.objectKind ?? null,
      inputPlacementValid: placement?.valid ?? null,
      inputPlacementBlockedReason: placement?.blockedReason ?? null,
      inputCommandMetadata: placement?.commandMetadata ?? null,
    };
  } catch {
    return {};
  }
}

export function createSceneRuntime(options: SceneRuntimeOptions): SceneRuntimeHandle {
  const id = createEditorId({
    prefix: "scene_runtime",
  });
  const bootstrap = options.bootstrap;
  const inventoryBootstrap = normalizeInventoryBootstrapConfig(bootstrap);
  const scenePhysics = getScenePhysicsBootstrap(bootstrap);
  const physicsRuntimeEnabled = shouldUseScenePhysicsRuntime(bootstrap);
  const cameraShouldFollowPhysics = shouldSceneCameraFollowPhysics(bootstrap);
  const store = options.store;
  const refs = options.domRefs;
  const worldRuntime = options.worldRuntime;
  const logger = options.logger;
  const createdAt = now();

  let status: SceneRuntimeStatus = "created";
  let updatedAt = createdAt;
  let initializedAt: string | null = null;
  let destroyedAt: string | null = null;
  let destroyed = false;
  let running = false;
  let frameRequestId: number | null = null;
  let lastFrameAtMs: number | null = null;
  let frameCount = 0;
  let renderCount = 0;
  let meshCount = 0;
  let materialCount = 0;
  let lastRenderedAt: string | null = null;
  let lastTargetSignature: string | null = null;
  let lastCameraChunk: ChunkCoordinates | null = null;
  let earthStreamingChunkY: number | null = null;
  let earthTerrainSpawnPrepared = false;
  let earthTerrainSurfaceY: number | null = null;
  let chunkRenderingSuspended = true;
  let prefetchLoadInFlight = false;
  let prefetchLoadPromise: Promise<void> | null = null;
  let lastPrefetchCenter: ChunkCoordinates | null = null;
  let lastPrefetchDirection: { readonly x: number; readonly z: number } | null = null;
  let lastEdgePrefetchSignature: string | null = null;
  let lastCameraChunkKey: string | null = null;
  let queuedCameraChunk: ChunkCoordinates | null = null;
  let visibilityLoadInFlight = false;
  let lastError: Record<string, unknown> | null = null;
  let lastPlacement: ActiveLibraryPlacement | null = null;
  let placeIntentCount = 0;
  let blockedPlaceIntentCount = 0;
  let removeIntentCount = 0;
  let commandChunkRenderScheduled = false;

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let chunksRoot: THREE.Group | null = null;
  let resizeObserver: EditorResizeObserverHandle | null = null;
  let inputController: EditorInputControllerHandle | null = null;
  let physicsRuntime: PhysicsRuntime | null = null;
  let uiRuntime: EditorUiRuntimeHandle | null = null;
  let hotbarController: HotbarControllerHandle | null = null;
  let libraryInventorySource: LibraryInventorySourceHandle | null = null;
  let sourceUnsubscribe: (() => void) | null = null;
  let userInventoryFrameMessageListener: ((event: MessageEvent) => void) | null = null;

  const chunkMeshes = new Map<string, ChunkMeshRecord>();
  const depthChunkLoadsInFlight = new Map<string, Promise<void>>();
  const raycaster = new THREE.Raycaster();
  let realtimeClient: EditorRealtimeClient | null = null;
  let realtimeUnsubscribe: (() => void) | null = null;
  let remoteAvatarScene: RemoteAvatarScene | null = null;
  let localAvatarScene: RemoteAvatarScene | null = null;
  let firstPersonHeldItemVisual: HeldItemVisualHandle | null = null;
  let localRealtimeMember: RealtimeMember | null = null;
  let localAvatarSessionId: string | null = null;
  let environmentSystem: EnvironmentSystem | null = null;
  let realtimeReloadTimer: number | null = null;
  let realtimeReloadQueued = false;
  let realtimeReloadFirstAt = 0;
  const REALTIME_RELOAD_QUIET_MS = 80;
  const REALTIME_RELOAD_MAX_WAIT_MS = 240;
  let realtimeReloadInFlight = false;
  let realtimeIndicator: HTMLDivElement | null = null;
  let navigationCompass: NavigationCompassHandle | null = null;
  let chunkMapOverlay: ChunkMapOverlayHandle | null = null;
  let viewKeyListener: ((event: KeyboardEvent) => void) | null = null;
  let thirdPersonEnabled = false;
  let lookYaw = safeNumber(bootstrap.camera.rotation.yaw, 0);
  let lookPitch = safeNumber(bootstrap.camera.rotation.pitch, 0);
  const manualPlayerPosition = new THREE.Vector3(
    bootstrap.camera.spawn.x,
    bootstrap.camera.spawn.y - 1.62,
    bootstrap.camera.spawn.z,
  );
  const thirdPersonCameraPosition = new THREE.Vector3();
  let thirdPersonCameraInitialized = false;
  raycaster.far = DEFAULT_TARGET_MAX_DISTANCE;

  function setStatus(nextStatus: SceneRuntimeStatus): void {
    status = nextStatus;
    updatedAt = now();

    try {
      refs.root.dataset.sceneRuntimeStatus = nextStatus;
      refs.root.dataset.sceneRuntimeUpdatedAt = updatedAt;
      refs.root.dataset.sceneRuntimeInventoryTruth = PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
      refs.root.dataset.sceneRuntimeOnlyLibraryItemsPlaceable = String(ONLY_LIBRARY_ITEMS_PLACEABLE);
      refs.root.dataset.sceneRuntimeDebugGrassDirtAllowed = String(DEBUG_GRASS_DIRT_ALLOWED);
      refs.root.dataset.sceneRuntimeBrowserCallsLibraryDirectly = String(BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY);
    } catch {
      // Dataset is diagnostic-only.
    }
  }

  function setError(error: unknown, reason: string): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed");

    setStoreAction(store, {
      kind: "render/error",
      error,
      source: reason,
      createdAt: now(),
    });

    logWarn(logger, "Scene runtime failed.", {
      reason,
      error: lastError,
      inventoryTruth: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    });
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed" || status === "destroying") {
      logWarn(logger, "Scene runtime action ignored because runtime is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function renderStoreFrame(frameMs: number | null): void {
    setStoreAction(
      store,
      {
        kind: "render/frame",
        frameMs,
        meshCount,
        drawCallCount: meshCount,
        source: "scene-runtime.frame",
        createdAt: now(),
      },
      {
        notify: false,
        captureHistory: false,
      },
    );
  }

  function clearChunkMeshes(): void {
    try {
      if (!chunksRoot) {
        return;
      }

      for (const record of chunkMeshes.values()) {
        chunksRoot.remove(record.group);
        disposeObject3D(record.group);
      }

      chunkMeshes.clear();
      meshCount = 0;
      materialCount = 0;
    } catch (error) {
      logWarn(logger, "Chunk mesh cleanup failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function upsertChunkMesh(chunk: RuntimeChunkContent): void {
    if (!chunksRoot) {
      return;
    }

    const existing = chunkMeshes.get(chunk.chunkKey);

    if (existing) {
      chunksRoot.remove(existing.group);
      disposeObject3D(existing.group);
      chunkMeshes.delete(chunk.chunkKey);
    }

    const record = createChunkMeshRecord(chunk);
    chunksRoot.add(record.group);
    chunkMeshes.set(chunk.chunkKey, record);
  }

  function renderChunksFromRegistry(reason: string): void {
    try {
      const registry = worldRuntime.getRegistry();
      const visibleKeys = registry.getVisibleChunkKeys();
      const loadedKeys = registry.getChunkKeys();
      const keys = visibleKeys.length > 0 ? visibleKeys : loadedKeys;

      const wanted = new Set(keys);

      for (const existingKey of [...chunkMeshes.keys()]) {
        if (!wanted.has(existingKey)) {
          const record = chunkMeshes.get(existingKey);
          if (record && chunksRoot) {
            chunksRoot.remove(record.group);
            disposeObject3D(record.group);
          }
          chunkMeshes.delete(existingKey);
        }
      }

      for (const key of keys) {
        const chunk = registry.getChunk(key);

        if (!chunk) {
          continue;
        }

        const existing = chunkMeshes.get(key);
        const existingRevision = existing?.group.userData.chunkRevision;
        const nextRevision = chunk.chunkRevision ?? chunk.chunkVersion ?? chunk.loadedAt;

        if (existing && existingRevision === nextRevision) {
          continue;
        }

        upsertChunkMesh(chunk);
        const record = chunkMeshes.get(key);

        if (record) {
          record.group.userData.chunkRevision = nextRevision;
        }
      }

      meshCount = [...chunkMeshes.values()].reduce(
        (sum, record) => sum + record.meshes.length,
        0,
      );
      materialCount = [...chunkMeshes.values()].reduce(
        (sum, record) => sum + record.materials.length,
        0,
      );
      refs.root.dataset.sceneRuntimeRenderedChunkCount = String(chunkMeshes.size);
      refs.root.dataset.sceneRuntimeMeshCount = String(meshCount);
      refs.root.dataset.earthTerrainSpawnPrepared = String(earthTerrainSpawnPrepared);
      refs.root.dataset.earthTerrainSurfaceY = earthTerrainSurfaceY === null
        ? ""
        : String(earthTerrainSurfaceY);
      refs.root.dataset.earthTerrainStreamingChunkY = earthStreamingChunkY === null
        ? ""
        : String(earthStreamingChunkY);
      lastRenderedAt = now();
      renderCount += 1;

      setStoreAction(
        store,
        {
          kind: "render/chunks",
          renderedChunkKeys: [...chunkMeshes.keys()],
          meshCount,
          drawCallCount: meshCount,
          source: reason,
          createdAt: lastRenderedAt,
        },
        {
          notify: true,
          captureHistory: false,
        },
      );

      logDebug(logger, "Scene chunks rendered.", {
        reason,
        chunkCount: chunkMeshes.size,
        meshCount,
        materialCount,
      });
      startPhysicsWhenWorldReady(reason);
    } catch (error) {
      setError(error, "scene-runtime.renderChunksFromRegistry");
    }
  }
  function scheduleCommandChunkRender(reason: string): void {
    if (destroyed || commandChunkRenderScheduled) return;
    commandChunkRenderScheduled = true;
    queueMicrotask(() => {
      commandChunkRenderScheduled = false;
      if (destroyed) return;
      renderChunksFromRegistry(reason);
      renderOnce(reason);
    });
  }


  function syncCameraToStore(source: string, notify = false): void {
    if (!camera) {
      return;
    }

    setStoreAction(
      store,
      {
        kind: "camera/update",
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        rotation: {
          pitch: camera.rotation.x,
          yaw: camera.rotation.y,
          roll: camera.rotation.z,
        },
        source,
        createdAt: now(),
      },
      {
        notify,
        captureHistory: false,
      },
    );
  }

  function dispatchPhysicsFrameToStore(
    frame: PhysicsRuntimeFrameResult,
    reason: string,
  ): void {
    try {
      setStoreAction(
        store,
        {
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
        },
        {
          notify: true,
          captureHistory: false,
        },
      );
    } catch (error) {
      logWarn(logger, "Physics frame store synchronization failed.", {
        reason,
        error: normalizeUnknownError(error),
      });
    }
  }

  function dispatchPhysicsSnapshotToStore(reason: string): void {
    try {
      const snapshot = physicsRuntime?.snapshot();

      if (!snapshot) {
        return;
      }

      setStoreAction(
        store,
        {
          kind: "player/update",
          input: {
            player: snapshot.player,
            camera: snapshot.camera,
            snapshot,
            source: "physics-runtime",
            nowMs: nowMs(),
            error: snapshot.lastError,
            warnings: snapshot.warnings,
          },
          createdAt: now(),
          source: reason,
        },
        {
          notify: true,
          captureHistory: false,
        },
      );
    } catch (error) {
      logWarn(logger, "Physics snapshot store synchronization failed.", {
        reason,
        error: normalizeUnknownError(error),
      });
    }
  }

  function exposeSceneDebugHandle(reason: string): void {
    try {
      const target = globalThis as unknown as Record<string, unknown>;

      target.__VECTOPLAN_SCENE_RUNTIME_DEBUG__ = {
        reason,
        getSnapshot: () => handle.getSnapshot(),
        getPhysicsSnapshot: () => physicsRuntime?.snapshot() ?? null,
        getInputSnapshot: () => inputController?.getSnapshot() ?? null,
        getMovementIntent: () => inputController?.getMovementIntent() ?? null,
        getHotbarSnapshot: () => hotbarController?.getSnapshot() ?? null,
        getLibraryInventorySnapshot: () => libraryInventorySource?.getSnapshot?.() ?? null,
        getSelectedRuntimePlaceable: () =>
          hotbarController?.getSelectedRuntimePlaceable?.() ?? null,
        getLastPlacement: () => lastPlacement,
        getWorldCollisionCell: (x: number, y: number, z: number) =>
          worldRuntime.getCollisionCell({ x, y, z }),
        getCameraPosition: () => camera
          ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
          : null,
        getHeldItem: () => firstPersonHeldItemVisual?.getItem() ?? null,
      };
    } catch {
      // Debug hook is best-effort.
    }
  }

  function isEditableViewShortcutTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return tagName === "input"
      || tagName === "textarea"
      || tagName === "select"
      || tagName === "button"
      || target.isContentEditable
      || target.closest("[contenteditable='true']") !== null
      || target.closest("[data-editor-ui-interactive='true']") !== null;
  }

  function selectedHeldItem(): RealtimeHeldItem | null {
    const sourceSnapshot = libraryInventorySource?.getSnapshot?.() ?? null;
    let candidate: unknown = null;
    let selectedSlotRecord: Record<string, unknown> = {};

    if (sourceSnapshot) {
      const selectedSlot = sourceSnapshot.selectedSlot;
      if (!selectedSlot || selectedSlot.empty || selectedSlot.enabled === false) return null;
      selectedSlotRecord = asRecord(selectedSlot);
      candidate = sourceSnapshot.selectedItem ?? selectedSlot;
    } else {
      const state = store.peekState();
      const selectedSlot = selectSelectedInventorySlot(state);
      if (!selectedSlot || selectedSlot.status === "empty" || !selectedSlot.enabled) return null;
      selectedSlotRecord = asRecord(selectedSlot);
      candidate = hotbarController
        ? hotbarController.getSelectedItem()
        : selectInventoryItemBySlot(state, selectedSlot.slot);
    }

    const record = asRecord(candidate);
    const raw = asRecord(firstDefined(record.raw, record.rawItem, record.rawBlock));
    const rawItem = asRecord(firstDefined(raw.rawItem, raw.item, record.item));
    const assets = asRecord(firstDefined(
      record.assets,
      raw.assets,
      rawItem.assets,
      selectedSlotRecord.assets,
    ));
    const icon = asRecord(firstDefined(record.icon, rawItem.icon, selectedSlotRecord.icon));
    const placementCommand = asRecord(firstDefined(
      record.placementCommand,
      record.placement_command,
      selectedSlotRecord.placementCommand,
      selectedSlotRecord.placement_command,
    ));
    const placementPayload = asRecord(placementCommand.payload);
    const modelValue = firstDefined(
      record.modelUrl,
      record.model_url,
      raw.modelUrl,
      raw.model_url,
      rawItem.modelUrl,
      rawItem.model_url,
      assets.modelUrl,
      assets.model_url,
      placementPayload.modelUrl,
      placementPayload.model_url,
    );
    let modelUrl: string | null = null;
    const modelText = normalizeOptionalText(modelValue);
    if (modelText) {
      try {
        const url = new URL(modelText, window.location.href);
        if (url.protocol === "http:" || url.protocol === "https:") modelUrl = url.href;
      } catch {
        modelUrl = null;
      }
    }

    const rawKind = normalizeOptionalText(firstDefined(
      record.kind,
      record.itemKind,
      record.item_kind,
      selectedSlotRecord.kind,
      selectedSlotRecord.itemKind,
      selectedSlotRecord.item_kind,
    ))?.toLowerCase();
    if (!rawKind || rawKind === "empty") return null;
    const kind: RealtimeHeldItem["kind"] = rawKind === "block"
      ? "block"
      : rawKind === "asset"
        ? "asset"
        : rawKind === "library-item"
          ? "library-item"
          : "vplib";
    const id = normalizeOptionalText(firstDefined(
      record.id,
      record.itemId,
      record.item_id,
      selectedSlotRecord.itemId,
      selectedSlotRecord.item_id,
      record.runtimeBlockTypeId,
      record.runtime_block_type_id,
    ));
    if (!id) return null;
    const label = normalizeOptionalText(firstDefined(
      record.label,
      record.displayLabel,
      record.display_label,
      selectedSlotRecord.label,
      selectedSlotRecord.displayLabel,
      selectedSlotRecord.display_label,
    )) ?? "Objekt";
    const iconKind = normalizeOptionalText(firstDefined(
      icon.kind,
      record.iconKind,
      record.icon_kind,
      selectedSlotRecord.iconKind,
      selectedSlotRecord.icon_kind,
    ));
    const colorValue = firstDefined(
      iconKind === "color" ? firstDefined(icon.value, icon.color, icon.css) : undefined,
      typeof record.color === "string" ? record.color : asRecord(record.color).css,
      typeof selectedSlotRecord.color === "string"
        ? selectedSlotRecord.color
        : asRecord(selectedSlotRecord.color).css,
      asRecord(record.metadata).color,
      asRecord(selectedSlotRecord.metadata).color,
    );

    return {
      id,
      label,
      kind,
      color: normalizeOptionalText(colorValue)
        ?? (kind === "asset" ? "#38bdf8" : "#68a38a"),
      modelUrl,
    };
  }
  function createLocalPresenceState(clientTimeMs = Date.now()): RealtimePresenceState | null {
    if (!camera) return null;
    const player = physicsRuntime?.getPlayerState() ?? null;
    const member = localRealtimeMember;
    const position = player?.position ?? manualPlayerPosition;
    const velocity = player?.velocity ?? { x: 0, y: 0, z: 0 };
    return {
      sessionId: member?.sessionId ?? "local-editor-player",
      userId: member?.userId ?? "local",
      displayName: member?.displayName?.trim() || "Gast",
      avatarColor: member?.avatarColor || "#f8fafc",
      sequence: frameCount,
      clientTimeMs,
      position: { x: position.x, y: position.y, z: position.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      yaw: lookYaw,
      pitch: lookPitch,
      movementMode: player?.movementMode ?? "flying",
      grounded: player?.grounded ?? false,
      flying: player?.flying ?? true,
      heldItem: selectedHeldItem(),
    };
  }

  function updateFirstPersonHeldItem(
    state: RealtimePresenceState | null,
    deltaSeconds: number,
    timestampMs: number,
  ): void {
    const item = state?.heldItem ?? null;
    firstPersonHeldItemVisual?.setItem(item);
    firstPersonHeldItemVisual?.setVisible(!thirdPersonEnabled);
    const velocity = state?.velocity;
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
    firstPersonHeldItemVisual?.update(deltaSeconds, timestampMs, speed);
    refs.root.dataset.heldItemId = item?.id ?? "";
    refs.root.dataset.heldItemKind = item?.kind ?? "none";
    refs.root.dataset.heldItemVisible = String(Boolean(item));
    refs.root.dataset.heldItemView = thirdPersonEnabled ? "third-person" : "first-person";
  }

  function syncLocalAvatar(state: RealtimePresenceState, deltaSeconds: number, timestampMs: number): void {
    if (!localAvatarScene) return;
    if (localAvatarSessionId !== state.sessionId) {
      localAvatarScene.clear();
      localAvatarScene.upsertMember({
        sessionId: state.sessionId,
        userId: state.userId,
        displayName: state.displayName,
        avatarColor: state.avatarColor,
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
        connectedAtMs: localRealtimeMember?.connectedAtMs ?? Date.now(),
        state,
      });
      localAvatarSessionId = state.sessionId;
    } else {
      localAvatarScene.applyPresence(state);
    }
    localAvatarScene.setVisible(thirdPersonEnabled);
    localAvatarScene.update(deltaSeconds, timestampMs);
  }

  function mapPlayerFromPresence(state: RealtimePresenceState): ChunkMapPlayer {
    return {
      sessionId: state.sessionId,
      displayName: state.displayName || "Gast",
      avatarColor: state.avatarColor || "#f8fafc",
      position: state.position,
      yaw: state.yaw,
      local: true,
    };
  }

  function updateChunkMap(state: RealtimePresenceState | null, timestampMs: number): void {
    chunkMapOverlay?.update({
      localPlayer: state ? mapPlayerFromPresence(state) : null,
      remotePlayers: (remoteAvatarScene?.getPlayers() ?? []).map((player) => ({
        sessionId: player.sessionId,
        displayName: player.displayName || "Gast",
        avatarColor: player.avatarColor,
        position: player.position,
        yaw: player.yaw,
      })),
      connectionStatus: realtimeClient?.getStatus() ?? "idle",
    }, timestampMs);
  }

  function updateNavigationCompass(state: RealtimePresenceState | null): void {
    if (!navigationCompass || !state) return;

    const markers: NavigationCompassMarker[] = [
      {
        id: "project-spawn",
        label: "Projektstart",
        color: "#60a5fa",
        kind: "project",
        position: bootstrap.camera.spawn,
      },
      ...(remoteAvatarScene?.getPlayers() ?? []).map((player) => ({
        id: player.sessionId,
        label: player.displayName || "Gast",
        color: player.avatarColor || "#ffffff",
        kind: "player" as const,
        position: player.position,
      })),
    ];

    navigationCompass.update({
      yaw: state.yaw,
      playerPosition: state.position,
      markers,
    });
  }

  function isThirdPersonCameraBlocked(position: THREE.Vector3): boolean {
    try {
      return worldRuntime.getCollisionCell({
        x: Math.floor(position.x),
        y: Math.floor(position.y),
        z: Math.floor(position.z),
      }).solid;
    } catch {
      return false;
    }
  }

  function applyThirdPersonCamera(deltaSeconds: number): void {
    if (!camera) return;
    const player = physicsRuntime?.getPlayerState();
    const position = player?.position ?? manualPlayerPosition;
    const pivot = new THREE.Vector3(position.x, position.y + 1.18, position.z);
    const cosPitch = Math.cos(lookPitch);
    const forward = new THREE.Vector3(
      -Math.sin(lookYaw) * cosPitch,
      Math.sin(lookPitch),
      -Math.cos(lookYaw) * cosPitch,
    ).normalize();
    const desired = pivot.clone().addScaledVector(forward, -4.35);
    desired.y += 0.62;

    const offset = desired.clone().sub(pivot);
    const safePosition = pivot.clone();
    const steps = Math.max(4, Math.ceil(offset.length() / 0.18));
    for (let index = 1; index <= steps; index += 1) {
      const candidate = pivot.clone().addScaledVector(offset, index / steps);
      if (isThirdPersonCameraBlocked(candidate)) break;
      safePosition.copy(candidate);
    }

    if (!thirdPersonCameraInitialized) {
      thirdPersonCameraPosition.copy(camera.position);
      thirdPersonCameraInitialized = true;
    }
    const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * 12);
    thirdPersonCameraPosition.lerp(safePosition, blend);
    camera.position.copy(thirdPersonCameraPosition);
    camera.lookAt(pivot.clone().addScaledVector(forward, 0.85));
    camera.updateMatrixWorld(true);
  }

  function setThirdPersonEnabled(enabled: boolean): void {
    thirdPersonEnabled = enabled;
    thirdPersonCameraInitialized = false;
    refs.root.dataset.thirdPersonCamera = String(enabled);
    localAvatarScene?.setVisible(enabled);
    firstPersonHeldItemVisual?.setVisible(!enabled);

    setDomLiveMessage(
      refs,
      enabled ? "Dritte-Person-Kamera aktiviert." : "Ego-Kamera aktiviert.",
    );
  }

  function handleViewKeydown(event: KeyboardEvent): void {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const code = event.code || event.key;
    if (chunkMapOverlay?.isOpen()) {
      if (code === "Escape" || code === "KeyM" || event.key.toLowerCase() === "m") {
        event.preventDefault();
        event.stopImmediatePropagation();
        chunkMapOverlay.close();
      }
      return;
    }
    if (isEditableViewShortcutTarget(event.target)) return;
    if (refs.root.dataset.creativeInventoryOpen === "true") return;
    if (code === "KeyV" || event.key.toLowerCase() === "v") {
      event.preventDefault();
      event.stopImmediatePropagation();
      setThirdPersonEnabled(!thirdPersonEnabled);
      return;
    }
    if (code === "KeyM" || event.key.toLowerCase() === "m") {
      event.preventDefault();
      event.stopImmediatePropagation();
      chunkMapOverlay?.open();
    }
  }

  function updateCameraFromInput(deltaMs: number): void {
    if (!camera || !inputController) {
      return;
    }

    try {
      const inputState = inputController.getInputState();
      const snapshot = inputState.getSnapshot();
      const pointerDelta = snapshot.pointer.delta;
      const sensitivity = safeNumber(
        bootstrap.input.sensitivity,
        DEFAULT_CAMERA_SENSITIVITY,
        {
          min: 0.00001,
          max: 0.1,
        },
      );
      const seconds = Math.max(0, Math.min(0.1, deltaMs / 1000));

      if (snapshot.pointer.pointerLocked || snapshot.pointer.pressedButtons.length > 0) {
        lookYaw -= pointerDelta.x * sensitivity;
        lookPitch -= pointerDelta.y * sensitivity;
        lookPitch = Math.max(
          -Math.PI / 2 + 0.001,
          Math.min(Math.PI / 2 - 0.001, lookPitch),
        );
      }
      camera.rotation.set(lookPitch, lookYaw, 0, "YXZ");

      const movementIntent = inputController.getMovementIntent();

      if (physicsRuntime && physicsRuntimeEnabled) {
        const physicsFrame = physicsRuntime.stepFrame({
          nowMs: nowMs(),
          deltaSeconds: seconds,
          movementIntent: movementIntent.physics,
          lookAngles: { yaw: lookYaw, pitch: lookPitch, roll: 0 },
          query: worldRuntime.getBlockCollisionQuery(),
        });

        dispatchPhysicsFrameToStore(physicsFrame, "scene-runtime.physics-frame");

        if (cameraShouldFollowPhysics) {
          applyPhysicsCameraBindingToThreeCamera(camera, physicsFrame.camera);
        }
      } else {
        if (movementIntent.active) {
          const speed =
            bootstrap.camera.moveSpeed *
            (movementIntent.sprint ? bootstrap.camera.sprintMultiplier : 1);
          const movement = movementVectorFromIntent(movementIntent, lookYaw);
          manualPlayerPosition.addScaledVector(movement, speed * seconds);
        }
        camera.position.set(
          manualPlayerPosition.x,
          manualPlayerPosition.y + 1.62,
          manualPlayerPosition.z,
        );
      }

      if (thirdPersonEnabled) {
        applyThirdPersonCamera(seconds);
      } else {
        camera.rotation.set(lookPitch, lookYaw, 0, "YXZ");
        camera.updateMatrixWorld(true);
      }

      inputState.resetDeltas();
      syncCameraToStore(
        physicsRuntimeEnabled ? "scene-runtime.physics-camera" : "scene-runtime.camera",
        false,
      );
    } catch (error) {
      logWarn(logger, "Camera/physics input update failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }
  function isEarthTerrainWorld(): boolean {
    let routeWorldTemplate = "";
    try {
      const route = new URL(window.location.href);
      routeWorldTemplate = String(
        route.searchParams.get("effective_world_template")
        ?? route.searchParams.get("requested_world_template")
        ?? route.searchParams.get("world_template")
        ?? "",
      ).trim().toLowerCase();
    } catch {
      // The bootstrap contract remains the fallback outside a browser URL.
    }

    return [
      bootstrap.project.templateId,
      bootstrap.project.providerId,
      refs.root.dataset.effectiveWorldTemplate,
      refs.root.dataset.requestedWorldTemplate,
      routeWorldTemplate,
      bootstrap.runtime.chunk.projectId.startsWith("chk_prj_prj_")
        ? "earth-georeferenced-project"
        : "",
    ].some((value) => String(value ?? "").trim().toLowerCase().includes("earth"));
  }

  function loadedTerrainSurfaceYAt(worldX: number, worldZ: number): number | null {
    const cellX = Math.floor(worldX);
    const cellZ = Math.floor(worldZ);
    let highest: number | null = null;

    for (const key of worldRuntime.getRegistry().getChunkKeys()) {
      const chunk = worldRuntime.getRegistry().getChunk(key);
      if (!chunk || chunk.stats.minimumSurfaceY === undefined) continue;
      const chunkSize = Math.max(1, safeInteger(chunk.chunkSize, 16, { min: 1, max: 256 }));
      const chunkX = Math.floor(cellX / chunkSize);
      const chunkZ = Math.floor(cellZ / chunkSize);
      if (chunk.chunkX !== chunkX || chunk.chunkZ !== chunkZ) continue;

      const localX = ((cellX % chunkSize) + chunkSize) % chunkSize;
      const localZ = ((cellZ % chunkSize) + chunkSize) % chunkSize;
      for (let localY = 0; localY < chunkSize; localY += 1) {
        const cellIndex = localX + (localY * chunkSize) + (localZ * chunkSize * chunkSize);
        if (safeInteger(chunk.cells[cellIndex], 0, { min: 0 }) <= 0) continue;
        const worldY = (chunk.chunkY * chunkSize) + localY;
        highest = highest === null ? worldY : Math.max(highest, worldY);
      }
    }

    return highest;
  }

  function prepareEarthTerrainSpawn(reason: string): boolean {
    if (earthTerrainSpawnPrepared || !isEarthTerrainWorld()) return earthTerrainSpawnPrepared;

    const surfaceY = loadedTerrainSurfaceYAt(
      bootstrap.camera.spawn.x,
      bootstrap.camera.spawn.z,
    );
    if (surfaceY === null) {
      refs.root.dataset.earthTerrainSpawnPrepared = "false";
      refs.root.dataset.earthTerrainSpawnReason = `${reason}:surface-pending`;
      return false;
    }

    const playerBaseY = surfaceY + 1.05;
    const chunkSize = worldRuntime.getRegistry().getChunk(
      worldRuntime.getRegistry().getChunkKeys()[0] ?? "",
    )?.chunkSize ?? 16;
    earthTerrainSurfaceY = surfaceY;
    earthStreamingChunkY = Math.floor(surfaceY / chunkSize);

    if (physicsRuntime && physicsRuntimeEnabled) {
      const snapshot = physicsRuntime.reset({
        spawn: {
          x: bootstrap.camera.spawn.x,
          y: playerBaseY,
          z: bootstrap.camera.spawn.z,
          yaw: lookYaw,
          pitch: lookPitch,
          roll: 0,
        },
        clearAccumulator: true,
        clearError: true,
      });
      if (camera && cameraShouldFollowPhysics) {
        applyPhysicsCameraBindingToThreeCamera(camera, snapshot.camera);
      }
      dispatchPhysicsSnapshotToStore("scene-runtime.earth-terrain-spawn");
    } else {
      manualPlayerPosition.set(
        bootstrap.camera.spawn.x,
        playerBaseY,
        bootstrap.camera.spawn.z,
      );
      if (camera) {
        camera.position.set(
          manualPlayerPosition.x,
          manualPlayerPosition.y + 1.62,
          manualPlayerPosition.z,
        );
      }
    }

    earthTerrainSpawnPrepared = true;
    refs.root.dataset.earthTerrainSpawnPrepared = "true";
    refs.root.dataset.earthTerrainSpawnReason = reason;
    refs.root.dataset.earthTerrainSurfaceY = String(surfaceY);
    refs.root.dataset.earthTerrainPlayerBaseY = String(playerBaseY);
    refs.root.dataset.earthTerrainStreamingChunkY = String(earthStreamingChunkY);
    logInfo(logger, "Earth terrain spawn aligned to loaded DGM surface.", {
      reason,
      surfaceY,
      playerBaseY,
      chunkY: earthStreamingChunkY,
    });
    return true;
  }

  function startPhysicsWhenWorldReady(reason: string): boolean {
    if (!physicsRuntime || !physicsRuntimeEnabled || chunkRenderingSuspended) return false;

    const snapshot = physicsRuntime.snapshot();
    if (snapshot.lifecycle === "started") return true;

    const registry = worldRuntime.getRegistry();
    const stats = registry.getStats();
    if (stats.chunkCount <= 0 || registry.getVisibleChunkKeys().length <= 0) {
      refs.root.dataset.physicsTerrainGate = "waiting-for-visible-chunk";
      return false;
    }

    if (isEarthTerrainWorld() && !prepareEarthTerrainSpawn(`${reason}:physics-gate`)) {
      refs.root.dataset.physicsTerrainGate = "waiting-for-earth-surface";
      return false;
    }

    physicsRuntime.start();
    refs.root.dataset.physicsTerrainGate = "ready";
    refs.root.dataset.physicsTerrainGateReason = reason;
    dispatchPhysicsSnapshotToStore("scene-runtime.physics-terrain-ready");
    return true;
  }

  function terrainSurfaceCoordinates(
    center: ChunkCoordinates,
    radius: number,
  ): readonly ChunkCoordinates[] {
    const registry = worldRuntime.getRegistry();
    const coordinates = new Map<string, ChunkCoordinates>();
    const probes = visibleChunkCoordinatesAround(center, radius, {
      radial: true,
      verticalRadius: 0,
    });

    for (const probe of probes) {
      const chunk = registry.getChunk(chunkKeyFromCoordinatesLocal(probe));
      if (!chunk) continue;
      const minimum = chunk.stats.minimumSurfaceY;
      const maximum = chunk.stats.maximumSurfaceY;
      if (
        typeof minimum !== "number"
        || !Number.isFinite(minimum)
        || typeof maximum !== "number"
        || !Number.isFinite(maximum)
      ) {
        continue;
      }
      const minimumChunkY = Math.floor(Math.min(minimum, maximum) / chunk.chunkSize);
      const maximumChunkY = Math.floor(Math.max(minimum, maximum) / chunk.chunkSize);
      const lower = Math.max(center.chunkY - 8, minimumChunkY);
      const upper = Math.min(center.chunkY + 8, maximumChunkY);
      for (let chunkY = lower; chunkY <= upper; chunkY += 1) {
        if (chunkY === probe.chunkY) continue;
        const coordinate = {
          chunkX: probe.chunkX,
          chunkY,
          chunkZ: probe.chunkZ,
        };
        coordinates.set(chunkKeyFromCoordinatesLocal(coordinate), coordinate);
      }
    }

    return [...coordinates.values()];
  }

  function updateStreamingFog(radius: number): void {
    if (!scene || !(scene.fog instanceof THREE.Fog)) return;
    const far = Math.max(64, (radius - 2) * 16);
    scene.fog.far = far;
    scene.fog.near = Math.max(32, far - 48);
  }

  async function loadTerrainSurfaceLayers(
    center: ChunkCoordinates,
    radius: number,
    targetChunkKey: string,
    priorityDirection: ChunkCoordinates,
  ): Promise<void> {
    const coordinates = terrainSurfaceCoordinates(center, radius);
    if (coordinates.length === 0) return;

    const registry = worldRuntime.getRegistry();
    const visibleKeys = new Set(registry.getVisibleChunkKeys());
    await worldRuntime.getLoader().loadCoordinates(coordinates, {
      reason: "scene-runtime.terrain-surface-layers",
      force: false,
      markVisible: false,
      contentProfile: "surface-shell.v1",
      preferBatch: true,
      maxChunks: safeInteger(bootstrap.runtime.chunk.maxBatchChunks, 256, {
        min: 1,
        max: 4096,
      }),
      priorityDirection,
      batchSize: 48,
      shouldContinue: () => (
        !destroyed
        && lastCameraChunkKey === targetChunkKey
        && !queuedCameraChunk
      ),
      onBatchLoaded: (progress) => {
        for (const key of progress.loadedChunkKeys) visibleKeys.add(key);
        registry.setVisibleChunkKeys(
          [...visibleKeys],
          "scene-runtime.terrain-surface-progress",
        );
        renderChunksFromRegistry("scene-runtime.terrain-surface-progress");
      },
    });

    for (const coordinate of coordinates) {
      const key = chunkKeyFromCoordinatesLocal(coordinate);
      if (registry.hasChunk(key)) visibleKeys.add(key);
    }
    registry.setVisibleChunkKeys(
      [...visibleKeys],
      "scene-runtime.terrain-surface-complete",
    );
    prepareEarthTerrainSpawn("terrain-surface-layers");
  }

  function evictDistantChunks(center: ChunkCoordinates, unloadDistance: number): void {
    const registry = worldRuntime.getRegistry();
    const visibleKeys = new Set(registry.getVisibleChunkKeys());
    const dirtyKeys = new Set(registry.getDirtyChunkKeys());
    const maximumDistanceSquared = unloadDistance * unloadDistance;
    for (const key of registry.getChunkKeys()) {
      if (visibleKeys.has(key) || dirtyKeys.has(key)) continue;
      const coordinate = chunkCoordinatesFromKey(key);
      const offsetX = coordinate.chunkX - center.chunkX;
      const offsetZ = coordinate.chunkZ - center.chunkZ;
      if (offsetX * offsetX + offsetZ * offsetZ > maximumDistanceSquared) {
        registry.deleteChunk(key, "scene-runtime.distance-eviction");
      }
    }
  }

  function prefetchChunksAroundMovement(
    center: ChunkCoordinates,
    visibleRadius: number,
    priorityDirection: ChunkCoordinates,
    mode: "movement" | "edge" = "movement",
  ): void {
    if (destroyed || prefetchLoadInFlight) {
      return;
    }

    const preloadRadius = safeInteger(refs.root.dataset.chunksPreloadRadius, 2, {
      min: 1,
      max: 8,
    });
    const unloadDistance = safeInteger(refs.root.dataset.chunksUnloadDistance, 14, {
      min: visibleRadius + 1,
      max: 96,
    });
    const loadedKeys = new Set(worldRuntime.getRegistry().getChunkKeys());
    const candidates = new Map<string, ChunkCoordinates>();

    let directionX = priorityDirection.chunkX;
    let directionZ = priorityDirection.chunkZ;
    if (Math.hypot(directionX, directionZ) < 0.1) {
      directionX = Math.sin(lookYaw);
      directionZ = Math.cos(lookYaw);
    }
    const directionLength = Math.max(0.001, Math.hypot(directionX, directionZ));
    directionX /= directionLength;
    directionZ /= directionLength;
    const effectivePriorityDirection = {
      chunkX: directionX,
      chunkY: 0,
      chunkZ: directionZ,
    };
    const previousDirection = lastPrefetchDirection;
    const distanceFromPreviousPrefetch = lastPrefetchCenter
      ? Math.hypot(
          center.chunkX - lastPrefetchCenter.chunkX,
          center.chunkZ - lastPrefetchCenter.chunkZ,
        )
      : Number.POSITIVE_INFINITY;
    const directionSimilarity = previousDirection
      ? directionX * previousDirection.x + directionZ * previousDirection.z
      : -1;
    if (
      mode !== "edge"
      && distanceFromPreviousPrefetch < 2
      && directionSimilarity > 0.72
    ) return;

    let furthestPredictedCenter: ChunkCoordinates = center;
    const predictionSteps = Math.max(
      1,
      Math.min(
        mode === "edge" ? 2 : 4,
        preloadRadius + 2,
        unloadDistance - visibleRadius - 1,
      ),
    );
    for (let step = 1; step <= predictionSteps; step += 1) {
      const predictedCenter = {
        chunkX: Math.round(center.chunkX + directionX * step),
        chunkY: center.chunkY,
        chunkZ: Math.round(center.chunkZ + directionZ * step),
      };
      furthestPredictedCenter = predictedCenter;
      for (const candidate of visibleChunkCoordinatesAround(predictedCenter, visibleRadius, {
        radial: true,
        verticalRadius: 0,
      })) {
        const offsetX = candidate.chunkX - center.chunkX;
        const offsetZ = candidate.chunkZ - center.chunkZ;
        const forwardDistance = offsetX * directionX + offsetZ * directionZ;
        if (
          forwardDistance < 1
          || Math.hypot(offsetX, offsetZ) >= unloadDistance
        ) continue;
        const key = chunkKeyFromCoordinatesLocal(candidate);
        if (!loadedKeys.has(key)) candidates.set(key, candidate);
      }
    }
    const coordinates = [...candidates.values()];

    if (coordinates.length === 0) {
      if (mode === "edge") refs.root.dataset.chunkEdgePrefetchStatus = "cached";
      return;
    }

    prefetchLoadInFlight = true;
    const centerKey = chunkKeyFromCoordinatesLocal(center);
    const nextCenterKey = chunkKeyFromCoordinatesLocal({
      chunkX: center.chunkX + Math.sign(directionX),
      chunkY: center.chunkY,
      chunkZ: center.chunkZ + Math.sign(directionZ),
    });
    const prefetchShouldContinue = () => (
      !destroyed
      && (
        mode === "edge"
          ? lastCameraChunkKey === centerKey || lastCameraChunkKey === nextCenterKey
          : lastCameraChunkKey === centerKey && !queuedCameraChunk
      )
    );
    const prefetchBatchLimit = Math.min(
      mode === "edge" ? 16 : 24,
      safeInteger(bootstrap.runtime.chunk.maxBatchChunks, 256, {
        min: 1,
        max: 4096,
      }),
    );
    const loadPromise = (async () => {
      await worldRuntime.getLoader().loadCoordinates(coordinates, {
        reason: mode === "edge"
          ? "scene-runtime.edge-prefetch"
          : "scene-runtime.directional-prefetch",
        force: false,
        markVisible: false,
        contentProfile: "surface-shell.v1",
        preferBatch: true,
        maxChunks: prefetchBatchLimit,
        priorityDirection: effectivePriorityDirection,
        batchSize: prefetchBatchLimit,
        shouldContinue: prefetchShouldContinue,
      });

      if (!prefetchShouldContinue()) return;
      const registry = worldRuntime.getRegistry();
      const surfaceCoordinates = terrainSurfaceCoordinates(
        furthestPredictedCenter,
        visibleRadius,
      ).filter((coordinate) => !registry.hasChunk(chunkKeyFromCoordinatesLocal(coordinate)));
      if (surfaceCoordinates.length > 0) {
        await worldRuntime.getLoader().loadCoordinates(surfaceCoordinates, {
          reason: mode === "edge"
            ? "scene-runtime.edge-surface-prefetch"
            : "scene-runtime.directional-surface-prefetch",
          force: false,
          markVisible: false,
          contentProfile: "surface-shell.v1",
          preferBatch: true,
          maxChunks: prefetchBatchLimit,
          priorityDirection: effectivePriorityDirection,
          batchSize: prefetchBatchLimit,
          shouldContinue: prefetchShouldContinue,
        });
      }

      lastPrefetchCenter = { ...center };
      lastPrefetchDirection = { x: directionX, z: directionZ };
      refs.root.dataset.chunkEdgePrefetchStatus = mode === "edge" ? "ready" : "idle";
    })().catch((error) => {
      logWarn(logger, "Directional chunk prefetch failed.", {
        error: normalizeUnknownError(error),
      });
    }).finally(() => {
      prefetchLoadInFlight = false;
      if (prefetchLoadPromise === loadPromise) prefetchLoadPromise = null;
    });
    prefetchLoadPromise = loadPromise;
  }

  function maybePrefetchNearChunkEdge(
    center: ChunkCoordinates,
    chunkSize: number,
    visibleRadius: number,
  ): void {
    if (
      !camera
      || !inputController
      || destroyed
      || prefetchLoadInFlight
      || visibilityLoadInFlight
      || !lastCameraChunk
      || chunkMeshes.size <= 0
    ) return;

    const threshold = Math.min(7, Math.max(2, Math.floor(chunkSize * 0.45)));
    const localX = camera.position.x - (Math.floor(camera.position.x / chunkSize) * chunkSize);
    const localZ = camera.position.z - (Math.floor(camera.position.z / chunkSize) * chunkSize);
    const movementIntent = inputController.getMovementIntent();
    const movement = movementVectorFromIntent(movementIntent, lookYaw);
    if (!movementIntent.active || Math.hypot(movement.x, movement.z) < 0.05) {
      lastEdgePrefetchSignature = null;
      refs.root.dataset.chunkEdgePrefetchStatus = "buffered";
      refs.root.dataset.chunkEdgePrefetchDistance = "";
      return;
    }
    const directionX = movement.x < -0.05 && localX <= threshold
      ? -1
      : movement.x > 0.05 && localX >= chunkSize - threshold
        ? 1
        : 0;
    const directionZ = movement.z < -0.05 && localZ <= threshold
      ? -1
      : movement.z > 0.05 && localZ >= chunkSize - threshold
        ? 1
        : 0;

    if (directionX === 0 && directionZ === 0) {
      lastEdgePrefetchSignature = null;
      refs.root.dataset.chunkEdgePrefetchStatus = "buffered";
      refs.root.dataset.chunkEdgePrefetchDistance = "";
      return;
    }

    const distanceToEdge = Math.min(
      directionX < 0 ? localX : directionX > 0 ? chunkSize - localX : chunkSize,
      directionZ < 0 ? localZ : directionZ > 0 ? chunkSize - localZ : chunkSize,
    );
    const signature = [
      chunkKeyFromCoordinatesLocal(center),
      directionX,
      directionZ,
    ].join(":");
    refs.root.dataset.chunkEdgePrefetchDistance = distanceToEdge.toFixed(2);
    refs.root.dataset.chunkEdgePrefetchDirection = [directionX, directionZ].join(",");

    if (signature === lastEdgePrefetchSignature) return;

    lastEdgePrefetchSignature = signature;
    refs.root.dataset.chunkEdgePrefetchStatus = "loading";
    prefetchChunksAroundMovement(
      center,
      visibleRadius,
      {
        chunkX: directionX,
        chunkY: 0,
        chunkZ: directionZ,
      },
      "edge",
    );
  }

  async function maybeLoadChunksAroundCamera(): Promise<void> {
    if (!camera || destroyed) {
      return;
    }

    try {
      const chunkSize = worldRuntime.getRegistry().getStats().chunkCount > 0
        ? worldRuntime.getRegistry().getChunk(
            worldRuntime.getRegistry().getChunkKeys()[0] ?? "",
          )?.chunkSize ?? 16
        : 16;

      const cameraCenter = worldToChunkCoordinates(
        {
          x: Math.floor(camera.position.x),
          y: Math.floor(camera.position.y),
          z: Math.floor(camera.position.z),
        },
        chunkSize,
      );
      const earthTerrainStreaming = isEarthTerrainWorld();
      if (earthTerrainStreaming && earthStreamingChunkY === null) {
        earthStreamingChunkY = cameraCenter.chunkY;
      }
      // Earth terrain is a height field. Falling or flying vertically must not
      // schedule another complete horizontal visibility circle for every Y
      // level. Surface layers are resolved separately from the DGM columns.
      const center = earthTerrainStreaming
        ? {
            ...cameraCenter,
            chunkY: earthStreamingChunkY ?? cameraCenter.chunkY,
          }
        : cameraCenter;
      const chunkKey = chunkKeyFromCoordinatesLocal(center);

      if (chunkKey !== lastCameraChunkKey) {
        lastCameraChunkKey = chunkKey;
        queuedCameraChunk = center;
      }

      const visibleRadius = safeInteger(bootstrap.render.visibleChunkRadius, 7, {
        min: 0,
        max: 16,
      });
      maybePrefetchNearChunkEdge(center, chunkSize, visibleRadius);

      if (visibilityLoadInFlight || !queuedCameraChunk) {
        return;
      }

      visibilityLoadInFlight = true;

      if (prefetchLoadPromise) {
        await prefetchLoadPromise;
      }

      while (!destroyed && queuedCameraChunk) {
        const targetCenter = queuedCameraChunk;
        const targetChunkKey = chunkKeyFromCoordinatesLocal(targetCenter);
        queuedCameraChunk = null;
        const previousCenter = lastCameraChunk;
        const priorityDirection: ChunkCoordinates = previousCenter
          ? {
              chunkX: targetCenter.chunkX - previousCenter.chunkX,
              chunkY: targetCenter.chunkY - previousCenter.chunkY,
              chunkZ: targetCenter.chunkZ - previousCenter.chunkZ,
            }
          : {
              chunkX: 0,
              chunkY: 0,
              chunkZ: 0,
            };

        lastCameraChunk = targetCenter;

        await worldRuntime.loadAroundChunk(targetCenter, {
          radius: visibleRadius,
          reason: "scene-runtime.camera-chunk-change",
          force: false,
          markVisible: true,
          preferBatch: true,
          contentProfile: earthTerrainStreaming ? "surface-shell.v1" : undefined,
          priorityDirection,
          batchSize: 48,
          shouldContinue: () => !destroyed && lastCameraChunkKey === targetChunkKey,
          onBatchLoaded: () => {
            if (!destroyed) {
              renderChunksFromRegistry("scene-runtime.camera-chunk-progressive-batch");
            }
          },
        });

        await loadTerrainSurfaceLayers(
          targetCenter,
          visibleRadius,
          targetChunkKey,
          priorityDirection,
        );
        updateStreamingFog(visibleRadius);

        renderChunksFromRegistry("scene-runtime.camera-chunk-change");

        if (lastCameraChunkKey === targetChunkKey && !queuedCameraChunk) {
          const unloadDistance = safeInteger(
            refs.root.dataset.chunksUnloadDistance,
            14,
            { min: visibleRadius + 1, max: 96 },
          );
          evictDistantChunks(targetCenter, unloadDistance);
          prefetchChunksAroundMovement(targetCenter, visibleRadius, priorityDirection);
        }
      }
    } catch (error) {
      logWarn(logger, "Loading chunks around camera failed.", {
        error: normalizeUnknownError(error),
      });
    } finally {
      visibilityLoadInFlight = false;
    }
  }

  function resolveIntersectionCell(intersection: THREE.Intersection): MeshCellRecord | null {
    try {
      const object = intersection.object as THREE.Object3D & {
        readonly userData: {
          readonly cells?: readonly MeshCellRecord[];
        };
      };

      const instanceId = intersection.instanceId;

      if (typeof instanceId !== "number") {
        return null;
      }

      return object.userData.cells?.[instanceId] ?? null;
    } catch {
      return null;
    }
  }

  function updateTargeting(): void {
    if (!camera || !scene) {
      return;
    }

    try {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

      const meshObjects: THREE.Object3D[] = [];

      for (const record of chunkMeshes.values()) {
        meshObjects.push(...record.meshes);
      }

      const intersections = raycaster.intersectObjects(meshObjects, false);
      const hit = intersections[0];

      if (!hit) {
        if (lastTargetSignature !== "none") {
          lastTargetSignature = "none";
          setStoreAction(
            store,
            {
              kind: "targeting/clear",
              reason: "no-hit",
              source: "scene-runtime.targeting",
              createdAt: now(),
            },
            {
              notify: true,
              captureHistory: false,
            },
          );
        }

        return;
      }

      const record = resolveIntersectionCell(hit);

      if (!record) {
        return;
      }

      const normal = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);
      const nx = Math.round(normal.x);
      const ny = Math.round(normal.y);
      const nz = Math.round(normal.z);

      const sourceCell = createEditorCellFromRecord(record);
      const placementAddress = createChunkCellAddress({
        worldX: record.worldX + nx,
        worldY: record.worldY + ny,
        worldZ: record.worldZ + nz,
        chunkSize: worldRuntime.getRegistry().getEntry(record.chunkKey)?.chunk.chunkSize ?? 16,
      });

      const placementSample = worldRuntime.sampleCell({
        x: placementAddress.worldX,
        y: placementAddress.worldY,
        z: placementAddress.worldZ,
      });

      const placementCell = {
        chunkKey: placementAddress.chunkKey,
        chunkX: placementAddress.chunkX,
        chunkY: placementAddress.chunkY,
        chunkZ: placementAddress.chunkZ,
        localX: placementAddress.localX,
        localY: placementAddress.localY,
        localZ: placementAddress.localZ,
        worldX: placementAddress.worldX,
        worldY: placementAddress.worldY,
        worldZ: placementAddress.worldZ,
        cellValue: placementSample.cellValue,
        blockTypeId: placementSample.blockTypeId,
      };

      const status =
        !placementSample.chunkLoaded
          ? "missing-chunk"
          : placementSample.air
            ? "valid"
            : "blocked";

      const signature = targetSignatureFromCells(sourceCell, placementCell, status);

      if (signature === lastTargetSignature) {
        return;
      }

      lastTargetSignature = signature;

      setStoreAction(
        store,
        {
          kind: "targeting/update",
          targetKind: "block-face",
          status,
          reason: status === "valid" ? null : status,
          distance: hit.distance,
          chunkKey: sourceCell.chunkKey,
          sourceCell,
          placementCell,
          normal: {
            x: nx,
            y: ny,
            z: nz,
          },
          source: "scene-runtime.targeting",
          createdAt: now(),
        },
        {
          notify: true,
          captureHistory: false,
        },
      );
    } catch (error) {
      logWarn(logger, "Targeting update failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function updateRealtimeDiagnostics(): void {
    try {
      const connectionStatus = realtimeClient?.getStatus() ?? "idle";
      const remotePlayers = remoteAvatarScene?.getCount() ?? 0;
      const remoteHeldItems = (remoteAvatarScene?.getPlayers() ?? [])
        .filter((player) => Boolean(player.heldItem)).length;
      refs.root.dataset.realtimeStatus = connectionStatus;
      refs.root.dataset.realtimeRemotePlayers = String(remotePlayers);
      refs.root.dataset.realtimeRemoteHeldItems = String(remoteHeldItems);
      refs.root.dataset.realtimeRoom = `${bootstrap.runtime.chunk.projectId}:${bootstrap.runtime.chunk.worldId}`;

      if (realtimeIndicator) {
        realtimeIndicator.dataset.status = connectionStatus;
        realtimeIndicator.textContent = connectionStatus === "connected"
          ? `${remotePlayers + 1} online`
          : connectionStatus === "reconnecting"
            ? "Multiplayer verbindet neu"
            : "Multiplayer verbindet";
      }
    } catch {
      // Diagnostics are best-effort.
    }
  }

  function publishLocalPresence(state: RealtimePresenceState | null): void {
    if (!realtimeClient || !state) return;
    realtimeClient.publishPresence({
      position: state.position,
      velocity: state.velocity,
      yaw: state.yaw,
      pitch: state.pitch,
      movementMode: state.movementMode,
      grounded: state.grounded,
      flying: state.flying,
      heldItem: state.heldItem,
    });
  }

  function scheduleRealtimeChunkReload(): void {
    if (destroyed) return;

    const nowMs = Date.now();
    realtimeReloadQueued = true;
    if (realtimeReloadFirstAt <= 0) {
      realtimeReloadFirstAt = nowMs;
    }
    const dueAt = Math.min(
      nowMs + REALTIME_RELOAD_QUIET_MS,
      realtimeReloadFirstAt + REALTIME_RELOAD_MAX_WAIT_MS,
    );
    if (realtimeReloadTimer !== null) {
      window.clearTimeout(realtimeReloadTimer);
    }
    realtimeReloadTimer = window.setTimeout(() => {
      realtimeReloadTimer = null;
      if (destroyed || realtimeReloadInFlight) return;

      realtimeReloadQueued = false;
      realtimeReloadFirstAt = 0;
      realtimeReloadInFlight = true;
      void worldRuntime.reloadDirtyChunks({
        reason: "scene-runtime.realtime-invalidation",
        force: true,
      }).then(() => {
        scheduleCommandChunkRender("scene-runtime.realtime-invalidation");
      }).catch((error) => {
        logWarn(logger, "Realtime chunk reload failed.", {
          error: normalizeUnknownError(error),
        });
      }).finally(() => {
        realtimeReloadInFlight = false;
        if (realtimeReloadQueued) {
          scheduleRealtimeChunkReload();
        }
      });
    }, Math.max(0, dueAt - nowMs));
  }

  function handleRealtimeEvent(event: EditorRealtimeEvent): void {
    if (destroyed) {
      return;
    }

    if (event.type === "status") {
      if (event.status === "disconnected") {
        remoteAvatarScene?.clear();
      }
      updateRealtimeDiagnostics();
      return;
    }
    if (event.type === "session.welcome") {
      localRealtimeMember = event.session;
      localAvatarSessionId = null;
      localAvatarScene?.clear();
      event.members.forEach((member) => remoteAvatarScene?.upsertMember(member));
      updateRealtimeDiagnostics();
      return;
    }
    if (event.type === "member.joined") {
      remoteAvatarScene?.upsertMember(event.member);
      updateRealtimeDiagnostics();
      return;
    }
    if (event.type === "member.left") {
      remoteAvatarScene?.remove(event.sessionId);
      updateRealtimeDiagnostics();
      return;
    }
    if (event.type === "presence.state") {
      remoteAvatarScene?.applyPresence(event.state);
      return;
    }
    if (event.type === "world.invalidate") {
      const chunkKeys = [...new Set([
        ...event.invalidation.changedChunks,
        ...event.invalidation.dirtyChunks,
      ])];
      if (chunkKeys.length > 0) {
        worldRuntime.markChunksDirty(chunkKeys, "scene-runtime.realtime-invalidation");
        scheduleRealtimeChunkReload();
      }
      return;
    }
    if (event.type === "error") {
      logWarn(logger, "Realtime transport reported an error.", {
        code: event.code,
        message: event.message,
      });
    }
  }

  function renderFrame(timestampMs: number): void {
    if (!running || destroyed || !renderer || !scene || !camera) {
      return;
    }

    const previousFrameAt = lastFrameAtMs ?? timestampMs;
    const frameMs = Math.max(0, timestampMs - previousFrameAt);
    lastFrameAtMs = timestampMs;

    try {
      updateCameraFromInput(frameMs);
      updateTargeting();
      const deltaSeconds = Math.min(0.1, frameMs / 1_000);
      environmentSystem?.update(deltaSeconds);
      remoteAvatarScene?.update(deltaSeconds, timestampMs);
      const localPresence = createLocalPresenceState(Date.now());
      if (localPresence) syncLocalAvatar(localPresence, deltaSeconds, timestampMs);
      updateFirstPersonHeldItem(localPresence, deltaSeconds, timestampMs);
      publishLocalPresence(localPresence);
      updateChunkMap(localPresence, timestampMs);
      updateNavigationCompass(localPresence);

      renderer.render(scene, camera);

      frameCount += 1;
      renderStoreFrame(frameMs);

      void maybeLoadChunksAroundCamera();
    } catch (error) {
      setError(error, "scene-runtime.renderFrame");
    }

    frameRequestId = requestAnimationFrame(renderFrame);
  }

  function start(reason?: string): void {
    if (!assertAlive("start")) {
      return;
    }

    if (running) {
      return;
    }

    if (!renderer || !scene || !camera) {
      setError(
        new Error("Scene runtime cannot start before initialize()."),
        "scene-runtime.start",
      );
      return;
    }

    physicsRuntime?.start();

    running = true;
    lastFrameAtMs = null;
    setStatus("running");
    setDomCanvasAriaActive(refs, true);
    frameRequestId = requestAnimationFrame(renderFrame);

    logInfo(logger, "Scene runtime started.", {
      reason: reason ?? null,
    });
  }

  function pause(reason?: string): void {
    if (!running) {
      return;
    }

    running = false;
    physicsRuntime?.pause();

    if (frameRequestId !== null) {
      cancelAnimationFrame(frameRequestId);
      frameRequestId = null;
    }

    setDomCanvasAriaActive(refs, false);
    setStatus("paused");

    logDebug(logger, "Scene runtime paused.", {
      reason: reason ?? null,
    });
  }

  function renderOnce(reason?: string): void {
    if (!renderer || !scene || !camera) {
      return;
    }

    try {
      updateTargeting();
      environmentSystem?.update(0);
      remoteAvatarScene?.update(0, performance.now());
      updateFirstPersonHeldItem(createLocalPresenceState(Date.now()), 0, performance.now());
      renderer.render(scene, camera);
      frameCount += 1;
      renderStoreFrame(null);

      logDebug(logger, "Scene runtime rendered once.", {
        reason: reason ?? null,
      });
    } catch (error) {
      setError(error, "scene-runtime.renderOnce");
    }
  }

  function attachSourceSubscription(): void {
    if (sourceUnsubscribe) {
      return;
    }

    try {
      sourceUnsubscribe = worldRuntime.getSource().subscribe((event) => {
        if (destroyed) {
          return;
        }

        const isChunkDataEvent =
          event.type === "chunk-loaded" || event.type === "chunks-loaded";
        const canRenderStreamingEvent =
          !chunkRenderingSuspended
          && !visibilityLoadInFlight
          && !prefetchLoadInFlight;
        const canRenderDirtyEvent =
          event.type === "dirty-chunks"
          && !chunkRenderingSuspended
          && !visibilityLoadInFlight;

        if (
          (isChunkDataEvent && canRenderStreamingEvent)
          || canRenderDirtyEvent
        ) {
          renderChunksFromRegistry(`source-event:${event.type}`);
        }

        if (event.type === "command-result") {
          const payload = event.payload as {
            readonly result?: {
              readonly result?: ChunkApiCommandResult;
            };
          };

          const commandResult = payload.result?.result;

          if (commandResult) {
            setStoreAction(store, {
              kind: "command/result",
              result: commandResult,
              source: "scene-runtime.source-command-result",
              createdAt: now(),
            });
            if (commandResult.changed) {
              realtimeClient?.publishWorldInvalidation({
                commandType: commandResult.commandType,
                eventIds: commandResult.eventIds,
                changedChunks: commandResult.changedChunks,
                dirtyChunks: commandResult.dirtyChunks,
                chunkVersions: commandResult.chunkVersions,
              });
            }
          }
        }
      });
    } catch (error) {
      logWarn(logger, "Scene runtime source subscription failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function getActiveLibraryPlacement(
    intent?: EditorInputBlockIntent | null,
  ): ActiveLibraryPlacement {
    try {
      const state = store.peekState();
      const selectedItem = selectSelectedInventoryItem(state);
      const inputPlacement = intent?.libraryPlacement ?? null;
      const hotbarPlaceable = hotbarController?.getSelectedRuntimePlaceable() ?? null;

      const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
        firstDefined(
          inputPlacement?.runtimeBlockTypeId,
          intent?.runtimeBlockTypeId,
          intent?.blockTypeId,
          hotbarPlaceable?.runtimeBlockTypeId,
          selectActiveRuntimeBlockTypeId(state),
          selectedItem?.runtimeBlockTypeId,
          selectedItem?.blockTypeId,
        ),
      );

      const intentLibraryRef = intent?.libraryRef ?? inputPlacement?.libraryRef ?? null;
      const intentPlacementCommand =
        intent?.placementCommand ?? inputPlacement?.placementCommand ?? null;

      const libraryRef =
        intentLibraryRef ??
        hotbarPlaceable?.libraryRef ??
        selectActiveLibraryRef(state);
      const placementCommand =
        intentPlacementCommand ??
        hotbarPlaceable?.placementCommand ??
        selectActivePlacementCommand(state);

      const libraryItemId = normalizeOptionalText(
        firstDefined(
          inputPlacement?.libraryItemId,
          intent?.libraryItemId,
          hotbarPlaceable?.libraryItemId,
          selectSelectedLibraryItemId(state),
          selectedItem?.libraryItemId,
          libraryRef?.libraryItemId,
        ),
      );
      const familyId = normalizeOptionalText(
        firstDefined(
          inputPlacement?.familyId,
          intent?.familyId,
          hotbarPlaceable?.familyId,
          selectSelectedFamilyId(state),
          selectedItem?.familyId,
          libraryRef?.familyId,
        ),
      );
      const packageId = normalizeOptionalText(
        firstDefined(
          inputPlacement?.packageId,
          intent?.packageId,
          hotbarPlaceable?.packageId,
          selectSelectedPackageId(state),
          selectedItem?.packageId,
          libraryRef?.packageId,
        ),
      );
      const vplibUid = normalizeOptionalText(
        firstDefined(
          inputPlacement?.vplibUid,
          intent?.vplibUid,
          hotbarPlaceable?.vplibUid,
          selectSelectedVplibUid(state),
          selectedItem?.vplibUid,
          libraryRef?.vplibUid,
        ),
      );
      const variantId = normalizeOptionalText(
        firstDefined(
          inputPlacement?.variantId,
          intent?.variantId,
          hotbarPlaceable?.variantId,
          selectSelectedVariantId(state),
          selectedItem?.variantId,
          libraryRef?.variantId,
          "default",
        ),
      );
      const revisionHash = normalizeOptionalText(
        firstDefined(
          inputPlacement?.revisionHash,
          intent?.revisionHash,
          hotbarPlaceable?.revisionHash,
          selectSelectedRevisionHash(state),
          selectedItem?.revisionHash,
          libraryRef?.revisionHash,
        ),
      );
      const inventorySlotIndex = safeInteger(
        firstDefined(
          inputPlacement?.inventorySlotIndex,
          intent?.inventorySlotIndex,
          hotbarPlaceable?.inventorySlotIndex,
          hotbarPlaceable?.slotIndex,
          selectSelectedSlotIndex(state),
          selectedItem?.slot,
        ),
        0,
        {
          min: 0,
          max: 999,
        },
      );
      const inventoryItemId = normalizeOptionalText(
        firstDefined(
          inputPlacement?.inventoryItemId,
          intent?.inventoryItemId,
          hotbarPlaceable?.inventoryItemId,
          hotbarPlaceable?.itemId,
          selectedItem?.id,
          libraryItemId,
          familyId,
          vplibUid,
        ),
      );
      const objectKind = normalizeOptionalText(
        firstDefined(
          inputPlacement?.objectKind,
          intent?.objectKind,
          hotbarPlaceable?.objectKind,
          selectedItem?.objectKind,
          libraryRef?.objectKind,
        ),
      );
      const label = normalizeOptionalText(
        firstDefined(
          inputPlacement?.label,
          hotbarPlaceable?.label,
          selectedItem?.label,
          familyId,
          vplibUid,
          libraryItemId,
          runtimeBlockTypeId,
        ),
      );

      const libraryIdentityValid = hasLibraryIdentity({
        libraryRef,
        placementCommand,
        libraryItemId,
        familyId,
        vplibUid,
      });

      let reason: string | null = null;

      if (!runtimeBlockTypeId) {
        reason = "missing-runtime-block-type-id";
      } else if (!libraryIdentityValid) {
        reason = "missing-library-identity";
      } else if (inputPlacement && inputPlacement.valid === false) {
        reason = inputPlacement.blockedReason ?? "input-placement-invalid";
      } else if (selectedItem && (selectedItem.enabled === false || selectedItem.placeable === false)) {
        reason = "selected-inventory-item-not-placeable";
      } else if (runtimeBlockTypeId && isForbiddenRuntimeBlockTypeId(runtimeBlockTypeId)) {
        reason = "forbidden-debug-runtime-block-type-id";
      }

      return {
        valid: reason === null,
        reason,
        runtimeBlockTypeId,
        blockTypeId: runtimeBlockTypeId,
        libraryItemId,
        inventoryItemId,
        inventorySlotIndex,
        familyId,
        packageId,
        vplibUid,
        variantId,
        revisionHash,
        objectKind,
        label,
        libraryRef,
        placementCommand,
        commandMetadata: {
          ...placementIntentMetadata(intent),
          selectedLabel: label,
          selectedSlotIndex: inventorySlotIndex,
          selectedItemKind:
            selectedItem?.kind ??
            inputPlacement?.itemKind ??
            hotbarPlaceable?.itemKind ??
            null,
          selectedSourceKind:
            selectedItem?.sourceKind ??
            inputPlacement?.sourceKind ??
            hotbarPlaceable?.source ??
            null,
          selectedInventoryItemId: inventoryItemId,
          selectedLibraryItemId: libraryItemId,
          selectedFamilyId: familyId,
          selectedPackageId: packageId,
          selectedVplibUid: vplibUid,
          selectedVariantId: variantId,
          selectedRevisionHash: revisionHash,
          selectedObjectKind: objectKind,
          placementCommandKind: commandField(placementCommand, "kind"),
          placementCommandSource: commandField(placementCommand, "source"),
          productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
          browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
        },
      };
    } catch (error) {
      logWarn(logger, "Active Library placement resolution failed.", {
        error: normalizeUnknownError(error),
      });

      return {
        valid: false,
        reason: "placement-resolution-error",
        runtimeBlockTypeId: null,
        blockTypeId: null,
        libraryItemId: null,
        inventoryItemId: null,
        inventorySlotIndex: null,
        familyId: null,
        packageId: null,
        vplibUid: null,
        variantId: null,
        revisionHash: null,
        objectKind: null,
        label: null,
        libraryRef: null,
        placementCommand: null,
        commandMetadata: {},
      };
    }
  }

  function blockPlacement(placement: ActiveLibraryPlacement, trigger: string): void {
    blockedPlaceIntentCount += 1;
    lastPlacement = placement;

    const message =
      placement.reason === "missing-library-identity"
        ? "Kein gültiges Library-/VPLIB-Item ausgewählt."
        : placement.reason === "missing-runtime-block-type-id"
          ? "Das ausgewählte Library-/VPLIB-Item hat keinen Runtime-Blocktyp."
          : "Kein platzierbares Library-/VPLIB-Item ausgewählt.";

    setStoreAction(store, {
      kind: "ui/live-message",
      message,
      source: trigger,
      createdAt: now(),
    });

    setStoreAction(
      store,
      {
        kind: "debug/warning",
        warning: `Placement blockiert: ${placement.reason ?? "unknown"}`,
        source: trigger,
        createdAt: now(),
      },
      {
        notify: false,
        captureHistory: false,
      },
    );

    setDomLiveMessage(refs, message);

    logWarn(logger, "Library/VPLIB placement blocked.", {
      trigger,
      reason: placement.reason,
      runtimeBlockTypeId: placement.runtimeBlockTypeId,
      libraryItemId: placement.libraryItemId,
      familyId: placement.familyId,
      packageId: placement.packageId,
      vplibUid: placement.vplibUid,
      variantId: placement.variantId,
      objectKind: placement.objectKind,
    });
  }

  async function placeBlock(intent: EditorInputBlockIntent): Promise<void> {
    placeIntentCount += 1;

    try {
      const placement = getActiveLibraryPlacement(intent);
      lastPlacement = placement;

      if (!placement.valid || !placement.runtimeBlockTypeId) {
        blockPlacement(placement, intent.trigger);
        return;
      }

      setStoreAction(store, {
        kind: "ui/live-message",
        message: `Library-/VPLIB-Item wird gesetzt: ${placement.label ?? placement.runtimeBlockTypeId}`,
        source: intent.trigger,
        createdAt: now(),
      });

      const source = worldRuntime.getSource();

      if (!sourceSupportsLibraryPlacement(source)) {
        const failed: ChunkApiFailedResult = {
          ok: false,
          request: null,
          source: "client-fallback",
          raw: null,
          error: {
            code: "missing_place_library_item_capability",
            message: "World source does not support placeLibraryItem(...).",
            retryable: false,
            statusCode: null,
            requestId: null,
            requestKind: null,
            url: null,
            method: null,
            exceptionType: "SceneRuntimeCapabilityError",
            details: {
              productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
              runtimeBlockTypeId: placement.runtimeBlockTypeId,
            },
          },
        };

        setStoreAction(store, {
          kind: "command/failed",
          error: failed,
          source: intent.trigger,
          createdAt: now(),
        });
        return;
      }

      const result = await source.placeLibraryItem(
        intent.position,
        {
          runtimeBlockTypeId: placement.runtimeBlockTypeId,
          blockTypeId: placement.runtimeBlockTypeId,
          libraryItemId: placement.libraryItemId,
          inventoryItemId: placement.inventoryItemId,
          inventorySlotIndex: placement.inventorySlotIndex,
          familyId: placement.familyId,
          packageId: placement.packageId,
          vplibUid: placement.vplibUid,
          variantId: placement.variantId,
          revisionHash: placement.revisionHash,
          objectKind: placement.objectKind,
          libraryRef: placement.libraryRef,
          placementCommand: placement.placementCommand,
          commandMetadata: {
            ...placement.commandMetadata,
            trigger: intent.trigger,
            source: "scene-runtime.place-library-item",
          },
        },
        {
          reason: intent.trigger,
          reloadDirtyChunks: true,
          runtimeBlockTypeId: placement.runtimeBlockTypeId,
          blockTypeId: placement.runtimeBlockTypeId,
          libraryItemId: placement.libraryItemId,
          inventoryItemId: placement.inventoryItemId,
          inventorySlotIndex: placement.inventorySlotIndex,
          familyId: placement.familyId,
          packageId: placement.packageId,
          vplibUid: placement.vplibUid,
          variantId: placement.variantId,
          revisionHash: placement.revisionHash,
          objectKind: placement.objectKind,
          libraryRef: placement.libraryRef,
          placementCommand: placement.placementCommand,
          commandMetadata: placement.commandMetadata,
          requireLibraryIdentity: true,
          includeLibraryMetadataInCommand: false,
        },
      );

      if (isChunkApiFailedResult(result)) {
        setStoreAction(store, {
          kind: "command/failed",
          error: result,
          source: intent.trigger,
          createdAt: now(),
        });
        return;
      }

      const commandResult = commandResultFromUnknown(result);

      if (commandResult) {
        setStoreAction(store, {
          kind: "command/result",
          result: commandResult,
          source: intent.trigger,
          createdAt: now(),
        });
      }

      if (
        reloadedChunkCountFromUnknown(result) > 0 ||
        dirtyChunkKeysFromUnknown(result).length > 0
      ) {
        scheduleCommandChunkRender("scene-runtime.placeLibraryItem");
      }

      setDomLiveMessage(
        refs,
        `Library-/VPLIB-Item gesetzt: ${placement.label ?? placement.runtimeBlockTypeId}`,
      );
    } catch (error) {
      setStoreAction(store, {
        kind: "command/failed",
        error,
        source: intent.trigger,
        createdAt: now(),
      });
      setError(error, "scene-runtime.placeBlock");
    }
  }


  async function prepareNextDepthChunk(
    position: ChunkWorldPosition,
  ): Promise<void> {
    if (!isEarthTerrainWorld()) return;

    try {
      const registry = worldRuntime.getRegistry();
      const chunkSize = registry.getChunk(
        registry.getChunkKeys()[0] ?? "",
      )?.chunkSize ?? 16;
      const current = worldToChunkCoordinates(position, chunkSize);
      const localY = Math.floor(position.y) - (current.chunkY * chunkSize);
      if (localY > 2) return;

      const below = {
        chunkX: current.chunkX,
        chunkY: current.chunkY - 1,
        chunkZ: current.chunkZ,
      };
      const belowKey = chunkKeyFromCoordinatesLocal(below);
      if (registry.getChunk(belowKey)) {
        registry.addVisibleChunkKeys(
          [belowKey],
          "scene-runtime.lazy-depth-prefetch.cached",
        );
        scheduleCommandChunkRender("scene-runtime.lazy-depth-prefetch.cached");
        return;
      }

      const existingLoad = depthChunkLoadsInFlight.get(belowKey);
      if (existingLoad) {
        await existingLoad;
        return;
      }

      const loadPromise = (async (): Promise<void> => {
        await worldRuntime.getLoader().loadCoordinates([below], {
          reason: "scene-runtime.lazy-depth-prefetch",
          force: false,
          contentProfile: "full",
          markVisible: false,
          preferBatch: false,
          maxChunks: 1,
          batchSize: 1,
        });
        registry.addVisibleChunkKeys(
          [belowKey],
          "scene-runtime.lazy-depth-prefetch",
        );
        scheduleCommandChunkRender("scene-runtime.lazy-depth-prefetch");
      })();
      depthChunkLoadsInFlight.set(belowKey, loadPromise);
      try {
        await loadPromise;
      } finally {
        if (depthChunkLoadsInFlight.get(belowKey) === loadPromise) {
          depthChunkLoadsInFlight.delete(belowKey);
        }
      }
    } catch (error) {
      logWarn(logger, "Lazy depth chunk prefetch failed.", {
        position,
        error: normalizeUnknownError(error),
      });
    }
  }

  async function removeBlock(intent: {
    readonly position: ChunkWorldPosition;
    readonly trigger: string;
  }): Promise<void> {
    removeIntentCount += 1;

    try {
      setStoreAction(store, {
        kind: "ui/live-message",
        message: "Block wird entfernt.",
        source: intent.trigger,
        createdAt: now(),
      });

      const source = worldRuntime.getSource();

      if (!sourceSupportsRemoveBlock(source)) {
        const failed: ChunkApiFailedResult = {
          ok: false,
          request: null,
          source: "client-fallback",
          raw: null,
          error: {
            code: "missing_remove_block_capability",
            message: "World source does not support removeBlock(...).",
            retryable: false,
            statusCode: null,
            requestId: null,
            requestKind: null,
            url: null,
            method: null,
            exceptionType: "SceneRuntimeCapabilityError",
            details: {
              productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
            },
          },
        };

        setStoreAction(store, {
          kind: "command/failed",
          error: failed,
          source: intent.trigger,
          createdAt: now(),
        });
        return;
      }

      const depthChunkPromise = prepareNextDepthChunk(intent.position);
      const result = await source.removeBlock(
        intent.position,
        {
          reason: intent.trigger,
          reloadDirtyChunks: true,
        },
      );

      await depthChunkPromise;

      if (isChunkApiFailedResult(result)) {
        setStoreAction(store, {
          kind: "command/failed",
          error: result,
          source: intent.trigger,
          createdAt: now(),
        });
        return;
      }

      const commandResult = commandResultFromUnknown(result);

      if (commandResult) {
        setStoreAction(store, {
          kind: "command/result",
          result: commandResult,
          source: intent.trigger,
          createdAt: now(),
        });
      }

      if (
        reloadedChunkCountFromUnknown(result) > 0 ||
        dirtyChunkKeysFromUnknown(result).length > 0
      ) {
        scheduleCommandChunkRender("scene-runtime.removeBlock");
      }

      setDomLiveMessage(refs, "Block entfernt.");
    } catch (error) {
      setStoreAction(store, {
        kind: "command/failed",
        error,
        source: intent.trigger,
        createdAt: now(),
      });
      setError(error, "scene-runtime.removeBlock");
    }
  }

  async function initializeLibraryInventory(): Promise<void> {
    if (!inventoryBootstrap.enabled) {
      logInfo(logger, "Library inventory initialization skipped because inventory is disabled.", {
        inventoryApiUrl: inventoryBootstrap.apiUrl,
      });
      return;
    }

    try {
      setDomBootMessage(refs, "Library-/VPLIB-Inventar wird geladen.");
      setStoreAction(store, {
        kind: "inventory/loading",
        source: "scene-runtime.library-inventory",
        createdAt: now(),
      });

      libraryInventorySource = createLibraryInventorySource({
        apiUrl: inventoryBootstrap.apiUrl,
        hotbarSize: inventoryBootstrap.hotbarSize,
        selectedSlot: inventoryBootstrap.selectedSlot,
        autoLoad: false,
        forceRefreshOnBoot: inventoryBootstrap.forceRefreshOnBoot,
        includeEmptySlots: true,
        allowEmptyFallback: true,
        timeoutMs: 10_000,
      });
      const inventoryFrame = refs.root.querySelector<HTMLIFrameElement>(
        "[data-user-inventory-frame]",
      );
      if (inventoryFrame) {
        const configuredFrameUrl =
          refs.root.dataset.userInventoryUrl || inventoryFrame.src;
        let expectedFrameOrigin: string | null = null;
        try {
          expectedFrameOrigin = new URL(
            configuredFrameUrl,
            window.location.href,
          ).origin;
        } catch {
          expectedFrameOrigin = null;
        }

        userInventoryFrameMessageListener = (event: MessageEvent): void => {
          if (event.source !== inventoryFrame.contentWindow) {
            return;
          }
          if (expectedFrameOrigin && event.origin !== expectedFrameOrigin) {
            return;
          }

          const message = event.data as {
            readonly type?: unknown;
            readonly source?: unknown;
            readonly detail?: {
              readonly active_slot_index?: unknown;
              readonly slot_index?: unknown;
            };
          } | null;
          if (
            !message
            || message.source !== "vectoplan-library-user-inventory"
          ) {
            return;
          }

          const eventType = safeString(message.type, "");
          if (
            eventType !== "vectoplan:user-inventory-selection-change"
            && eventType !== "vectoplan:user-inventory-save"
            && eventType !== "vectoplan:user-inventory-load"
          ) {
            return;
          }

          const source = libraryInventorySource;
          if (!source) {
            return;
          }
          const oneBasedSlot = safeInteger(
            message.detail?.active_slot_index
              ?? message.detail?.slot_index,
            1,
            {
              min: 1,
              max: inventoryBootstrap.hotbarSize,
            },
          );
          const zeroBasedSlot = oneBasedSlot - 1;
          source.selectSlot(zeroBasedSlot, "library-user-inventory-frame");

          if (
            eventType === "vectoplan:user-inventory-save"
            || eventType === "vectoplan:user-inventory-load"
          ) {
            void source.reload({
              force: true,
              selectedSlot: zeroBasedSlot,
              selectedSlotIndex: zeroBasedSlot,
              reason: "library-user-inventory-frame-sync",
            }).catch((error) => {
              logWarn(logger, "User inventory frame sync failed.", {
                error: normalizeUnknownError(error),
              });
            });
          }
        };
        window.addEventListener(
          "message",
          userInventoryFrameMessageListener,
        );
      }

      hotbarController = createHotbarController({
        inventorySource: libraryInventorySource,
        store,
        domRefs: refs,
        logger: logger?.child?.("hotbar") ?? logger,
        signal: options.signal,
        slotCount: inventoryBootstrap.hotbarSize,
        defaultSelectedSlot: inventoryBootstrap.selectedSlot,
        enableKeyboardShortcuts: false,
        enableWheelSelection: false,
        enableSlotClickSelection: false,
        allowLegacyChunkInventory: false,
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
        allowEmptyFallback: true,
        destroyInventorySourceOnDestroy: false,
      });

      const result = await hotbarController.initialize();

      if (isChunkApiFailedResult(result)) {
        logWarn(logger, "Library inventory initialization failed.", {
          error: result.error,
          inventoryApiUrl: inventoryBootstrap.apiUrl,
        });

        setStoreAction(store, {
          kind: "inventory/failed",
          error: result,
          source: "scene-runtime.library-inventory",
          createdAt: now(),
        });

        return;
      }

      logInfo(logger, "Library inventory initialized.", {
        sourceKind: result.sourceKind,
        itemCount: result.items.length,
        libraryItemCount: result.libraryItems.length,
        placeableItemCount: result.placeableItems.length,
        selectedRuntimeBlockTypeId: result.selection.selectedRuntimeBlockTypeId,
        selectedFamilyId: result.selection.selectedPlacementRef?.familyId ?? null,
        selectedPackageId: result.selection.selectedPlacementRef?.packageId ?? null,
        selectedVplibUid: result.selection.selectedPlacementRef?.vplibUid ?? null,
        selectedVariantId: result.selection.selectedPlacementRef?.variantId ?? null,
        selectedObjectKind: result.selection.selectedPlacementRef?.objectKind ?? null,
        inventoryApiUrl: inventoryBootstrap.apiUrl,
      });
    } catch (error) {
      logWarn(logger, "Library inventory initialization failed with exception.", {
        error: normalizeUnknownError(error),
        inventoryApiUrl: inventoryBootstrap.apiUrl,
      });

      setStoreAction(store, {
        kind: "inventory/failed",
        error,
        source: "scene-runtime.library-inventory",
        createdAt: now(),
      });
    }
  }

  async function initialize(): Promise<void> {
    if (!assertAlive("initialize")) {
      return;
    }

    if (status === "ready" || status === "running") {
      return;
    }

    setStatus("initializing");
    setDomBootMessage(refs, "Scene Runtime wird initialisiert.");

    try {
      const canvas = getEditorCanvas(refs);

      refs.root.dataset.sceneRuntimeInventoryTruth = PRODUCTIVE_EDITOR_INVENTORY_ROUTE;
      refs.root.dataset.sceneRuntimeOnlyLibraryItemsPlaceable = String(ONLY_LIBRARY_ITEMS_PLACEABLE);
      refs.root.dataset.sceneRuntimeDebugGrassDirtAllowed = String(DEBUG_GRASS_DIRT_ALLOWED);
      refs.root.dataset.sceneRuntimeBrowserCallsLibraryDirectly = String(BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY);

      renderer = createRenderer(canvas, bootstrap);
      scene = createScene(bootstrap);
      camera = createCamera(bootstrap);
      scene.add(camera);
      firstPersonHeldItemVisual = createHeldItemVisual(camera, "first-person");
      lookYaw = camera.rotation.y;
      lookPitch = camera.rotation.x;
      manualPlayerPosition.set(
        camera.position.x,
        camera.position.y - 1.62,
        camera.position.z,
      );
      chunksRoot = new THREE.Group();
      chunksRoot.name = "vectoplan-editor-chunks";
      scene.add(chunksRoot);
      realtimeIndicator = document.createElement("div");
      realtimeIndicator.className = "editor-realtime-indicator";
      realtimeIndicator.setAttribute("role", "status");
      realtimeIndicator.setAttribute("aria-live", "polite");
      realtimeIndicator.textContent = "Multiplayer verbindet";
      (refs.viewportOverlay ?? refs.canvasHost).append(realtimeIndicator);
      environmentSystem = createEnvironmentSystem({
        scene,
        renderer,
        camera,
        controlsHost: refs.viewportOverlay ?? refs.canvasHost,
        bootstrap,
      });
      remoteAvatarScene = createRemoteAvatarScene(scene);
      localAvatarScene = createRemoteAvatarScene(scene);
      localAvatarScene.setVisible(false);
      realtimeClient = createEditorRealtimeClient({
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
        updateRateHz: 12,
      });
      realtimeUnsubscribe = realtimeClient.subscribe(handleRealtimeEvent);
      realtimeClient.connect();
      updateRealtimeDiagnostics();

      resizeObserver = createEditorResizeObserver({
        refs,
        store,
        logger: logger?.child?.("resize") ?? logger,
        signal: options.signal,
        updateCanvasBackingStore: true,
        maxDevicePixelRatio: bootstrap.render.pixelRatioMax,
        onResize: (snapshot) => {
          try {
            renderer?.setPixelRatio(snapshot.devicePixelRatio);
            renderer?.setSize(snapshot.width, snapshot.height, false);

            if (camera) {
              updateCameraAspect(camera, snapshot);
            }

            renderOnce("resize");
          } catch (error) {
            logWarn(logger, "Scene resize application failed.", {
              error: normalizeUnknownError(error),
            });
          }
        },
      });

      resizeObserver.start();

      uiRuntime = createEditorUiRuntime({
        refs,
        store,
        logger: logger?.child?.("ui") ?? logger,
        signal: options.signal,
        enabled: true,
        autoMount: true,
        autoRender: true,
        updateLiveRegions: true,
      });

      inputController = createEditorInputController({
        refs,
        store,
        logger: logger?.child?.("input") ?? logger,
        signal: options.signal,
        enabled: true,
        autoAttach: true,
        keyboardEnabled: bootstrap.input.keyboardEnabled,
        mouseEnabled: bootstrap.input.mouseEnabled,
        wheelEnabled: bootstrap.input.wheelEnabled,
        pointerLockEnabled: bootstrap.input.pointerLockEnabled,
        requestPointerLockOnClick: bootstrap.input.pointerLockEnabled,
        preventDefault: true,
        dispatchToStore: true,
        onPlaceBlock: async (intent) => {
          await placeBlock(intent);
        },
        onRemoveBlock: async (intent) => {
          await removeBlock({
            position: intent.position,
            trigger: intent.trigger,
          });
        },
        onInspect: async () => {
          setDomLiveMessage(refs, "Inspector-Auswahl aktualisiert.");
        },
        onCancel: async () => {
          setDomLiveMessage(refs, "3D-Editor wird verlassen.");
          await options.onExitRequested?.();
        },
      });

      navigationCompass = createNavigationCompass(
        refs.viewportOverlay ?? refs.canvasHost,
      );

      chunkMapOverlay = createChunkMapOverlay({
        root: refs.root,
        worldRuntime,
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
        terrainRegionUrl: (
          bootstrap.runtime.chunk.apiBaseUrl
          + "/projects/"
          + encodeURIComponent(bootstrap.runtime.chunk.projectId)
          + "/worlds/"
          + encodeURIComponent(bootstrap.runtime.chunk.worldId)
          + "/terrain/region"
        ),
        onOpen: () => {
          inputController?.clear("chunk-map-open");
          inputController?.disable("chunk-map-open");
          if (document.pointerLockElement) void document.exitPointerLock();
          setDomLiveMessage(refs, "Projektkarte geoeffnet.");
        },
        onClose: () => {
          if (refs.root.dataset.creativeInventoryOpen !== "true") {
            inputController?.clear("chunk-map-close");
            inputController?.enable("chunk-map-close");
            void inputController?.requestPointerLock("chunk-map-close");
          }
          setDomLiveMessage(refs, "Projektkarte geschlossen.");
        },
      });
      viewKeyListener = handleViewKeydown;
      document.addEventListener("keydown", viewKeyListener, true);

      if (physicsRuntimeEnabled) {
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
              setStoreAction(
                store,
                {
                  kind: "debug/error",
                  error,
                  source: "scene-runtime.physics.error",
                  createdAt: now(),
                },
                {
                  notify: false,
                  captureHistory: false,
                },
              );
            },
          },
        });

        refs.root.dataset.physicsTerrainGate = "waiting-for-visible-chunk";
        dispatchPhysicsSnapshotToStore("scene-runtime.physics-created-paused");
        exposeSceneDebugHandle("scene-runtime.physics-created");

        logInfo(logger, "Physics runtime created.", {
          enabled: scenePhysics.enabled,
          cameraShouldFollowPhysics,
          missingChunkPolicy: scenePhysics.missingChunks.policy,
          walkSpeed: scenePhysics.movement.walkSpeed,
          flySpeed: scenePhysics.movement.flySpeed,
        });
      }

      attachSourceSubscription();

      setDomBootMessage(refs, "Chunk-Welt wird geladen.");
      await worldRuntime.initialize();

      prepareEarthTerrainSpawn("initial-world-ready");
      chunkRenderingSuspended = false;
      renderChunksFromRegistry("scene-runtime.initialize");

      await initializeLibraryInventory();

      setStoreAction(store, {
        kind: "render/initialized",
        initialized: true,
        source: "scene-runtime.initialize",
        createdAt: now(),
      });

      resizeObserver.requestMeasure("manual");
      renderOnce("initialize");

      initializedAt = now();
      lastError = null;
      setStatus("ready");

      start("initialize");

      logInfo(logger, "Scene runtime initialized.", {
        id,
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
        inventoryApiUrl: inventoryBootstrap.apiUrl,
        libraryInventoryEnabled: inventoryBootstrap.enabled,
        onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      });
    } catch (error) {
      setError(error, "scene-runtime.initialize");
      throw error;
    }
  }

  async function requestFullRefresh(reason?: string): Promise<void> {
    if (!assertAlive("requestFullRefresh")) {
      return;
    }

    try {
      await worldRuntime.requestFullRefresh({
        reason: reason ?? "scene-runtime.full-refresh",
        force: true,
      });
      renderChunksFromRegistry(reason ?? "scene-runtime.full-refresh");
      renderOnce(reason ?? "scene-runtime.full-refresh");
    } catch (error) {
      setError(error, "scene-runtime.requestFullRefresh");
      throw error;
    }
  }

  async function reloadDirtyChunks(reason?: string): Promise<void> {
    if (!assertAlive("reloadDirtyChunks")) {
      return;
    }

    try {
      await worldRuntime.reloadDirtyChunks({
        reason: reason ?? "scene-runtime.dirty-reload",
        force: true,
      });
      renderChunksFromRegistry(reason ?? "scene-runtime.dirty-reload");
      renderOnce(reason ?? "scene-runtime.dirty-reload");
    } catch (error) {
      setError(error, "scene-runtime.reloadDirtyChunks");
      throw error;
    }
  }

  async function destroy(reason?: string): Promise<void> {
    if (destroyed) {
      return;
    }

    destroyed = true;
    setStatus("destroying");
    pause(reason ?? "destroy");

    try {
      sourceUnsubscribe?.();
      sourceUnsubscribe = null;
    } catch {
      // Ignore.
    }
    try {
      if (userInventoryFrameMessageListener) {
        window.removeEventListener(
          "message",
          userInventoryFrameMessageListener,
        );
        userInventoryFrameMessageListener = null;
      }
    } catch {
      // Ignore inventory iframe bridge teardown failures.
    }

    try {
    if (realtimeReloadTimer !== null) {
      window.clearTimeout(realtimeReloadTimer);
      realtimeReloadTimer = null;
    }

      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      realtimeClient?.destroy();
      realtimeClient = null;
      remoteAvatarScene?.destroy();
      remoteAvatarScene = null;
      localAvatarScene?.destroy();
      localAvatarScene = null;
      firstPersonHeldItemVisual?.destroy();
      firstPersonHeldItemVisual = null;
      localRealtimeMember = null;
      localAvatarSessionId = null;
      chunkMapOverlay?.destroy();
      chunkMapOverlay = null;
      if (viewKeyListener) {
        document.removeEventListener("keydown", viewKeyListener, true);
        viewKeyListener = null;
      }
      environmentSystem?.destroy();
      environmentSystem = null;
      realtimeIndicator?.remove();
      realtimeIndicator = null;
      navigationCompass?.destroy();
      navigationCompass = null;
    } catch {
      // Ignore realtime/environment teardown failures.
    }

    try {
      hotbarController?.destroy(reason ?? "scene-runtime.destroy");
      hotbarController = null;
    } catch {
      // Ignore.
    }

    try {
      libraryInventorySource?.destroy?.(reason ?? "scene-runtime.destroy");
      libraryInventorySource = null;
    } catch {
      // Ignore.
    }

    try {
      await inputController?.destroy(reason ?? "scene-runtime.destroy");
      inputController = null;
    } catch {
      // Ignore.
    }

    try {
      physicsRuntime?.destroy();
      physicsRuntime = null;
    } catch {
      // Ignore.
    }

    try {
      resizeObserver?.destroy(reason ?? "scene-runtime.destroy");
      resizeObserver = null;
    } catch {
      // Ignore.
    }

    try {
      uiRuntime?.dispose(reason ?? "scene-runtime.destroy");
      uiRuntime = null;
    } catch {
      // Ignore.
    }

    try {
      clearChunkMeshes();

      if (scene && chunksRoot) {
        scene.remove(chunksRoot);
      }

      if (scene) {
        disposeObject3D(scene);
      }

      renderer?.dispose();
    } catch (error) {
      logWarn(logger, "Scene dispose failed.", {
        error: normalizeUnknownError(error),
      });
    }

    renderer = null;
    scene = null;
    camera = null;
    chunksRoot = null;

    destroyedAt = now();
    setDomCanvasAriaActive(refs, false);
    setStatus("destroyed");

    logInfo(logger, "Scene runtime destroyed.", {
      id,
      reason: reason ?? null,
      frameCount,
      renderCount,
      placeIntentCount,
      blockedPlaceIntentCount,
      removeIntentCount,
    });
  }

  const handle: SceneRuntimeHandle = {
    kind: SCENE_RUNTIME_KIND,

    initialize,
    start,
    pause,
    renderOnce,
    requestFullRefresh,
    reloadDirtyChunks,

    getStatus(): SceneRuntimeStatus {
      return status;
    },

    getRenderer(): THREE.WebGLRenderer | null {
      return renderer;
    },

    getScene(): THREE.Scene | null {
      return scene;
    },

    getCamera(): THREE.PerspectiveCamera | null {
      return camera;
    },

    getInputController(): EditorInputControllerHandle | null {
      return inputController;
    },

    getUiRuntime(): EditorUiRuntimeHandle | null {
      return uiRuntime;
    },

    getHotbarController(): HotbarControllerHandle | null {
      return hotbarController;
    },

    getSnapshot(): SceneRuntimeSnapshot {
      return {
        kind: SCENE_RUNTIME_SNAPSHOT_KIND,
        id,
        status,
        createdAt,
        updatedAt,
        initializedAt,
        destroyedAt,
        frameCount,
        renderCount,
        meshCount,
        materialCount,
        renderedChunkKeys: [...chunkMeshes.keys()],
        lastRenderedAt,
        lastTargetSignature,
        lastCameraChunkKey,
        lastPlacement,
        placeIntentCount,
        blockedPlaceIntentCount,
        removeIntentCount,
        lastError,
        inventory: inventoryBootstrap,
        resize: resizeObserver?.getSnapshot() ?? null,
        input: inputController?.getSnapshot() ?? null,
        ui: uiRuntime?.getSnapshot() ?? null,
        physics: physicsRuntime?.snapshot() ?? null,
        hotbar: hotbarController?.getSnapshot() ?? null,
      };
    },

    destroy,
  };

  if (options.signal) {
    try {
      if (options.signal.aborted) {
        void destroy("abort-signal-already-aborted");
      } else {
        options.signal.addEventListener(
          "abort",
          () => {
            void destroy("abort-signal");
          },
          {
            once: true,
          },
        );
      }
    } catch {
      // Abort wiring is best-effort.
    }
  }

  logInfo(logger, "Scene runtime created.", {
    id,
    projectId: bootstrap.runtime.chunk.projectId,
    worldId: bootstrap.runtime.chunk.worldId,
    inventoryApiUrl: inventoryBootstrap.apiUrl,
    libraryInventoryEnabled: inventoryBootstrap.enabled,
    onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
    debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
    forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
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
      record.kind === SCENE_RUNTIME_KIND &&
      typeof record.initialize === "function" &&
      typeof record.requestFullRefresh === "function" &&
      typeof record.reloadDirtyChunks === "function" &&
      typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}

export function getSceneRuntimeMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.scene.scene_runtime",
    runtimeKind: SCENE_RUNTIME_KIND,
    snapshotKind: SCENE_RUNTIME_SNAPSHOT_KIND,
    productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    contract: getEditorInventoryContractMetadata(),
    diagnostics: editorInventoryContractDiagnostics({
      sourceKind: "library",
      runtimeBlockTypeId: null,
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    }),
    rules: {
      ...editorInventoryContractRules(),
      sceneUsesLibraryInventorySource: true,
      sceneUsesInputLibraryPlacementContext: true,
      sceneReadsHotbarRuntimePlaceable: true,
      sceneUsesPlaceLibraryItemCapability: true,
      worldSourceCapabilitiesAreCheckedDefensively: true,
      browserDoesNotCallVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
      placeBlockRequiresLibraryIdentity: true,
      placeBlockRequiresRuntimeBlockTypeId: true,
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
      legacyChunkInventoryFallbackDisabled: true,
    },
  };
}
