// services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
import * as THREE from "three";
import {
  createEnvironmentSystem,
  type EnvironmentSystem,
} from "@render/environment_system";
import {
  createChunkMeshWorkerClient,
  type ChunkMeshWorkerClient,
} from "@render/chunk_mesh_worker_client";
import type {
  ChunkMeshBoundaryMasks,
  ChunkMeshWorkerResult,
} from "@render/chunk_mesh_worker_models";
import {
  createPerformanceRecorder,
  type PerformanceRecorderHandle,
} from "../performance/performance_recorder";
import {
  createEditorRealtimeClient,
  type EditorRealtimeClient,
  type EditorRealtimeEvent,
  type RealtimeHeldItem,
  type RealtimeMember,
  type RealtimePresenceState,
} from "./realtime_client";
import {
  isVplibParametricObjectRef,
  shouldRenderSemanticFootprint,
  shouldAdaptSemanticObjectToParcelGrid,
  shouldAdaptBlockToParcelGrid,
} from "./semantic_object_rendering";
import { additionalSurfaceChunkCoordinates } from "./structure_streaming";
import { trimLod2WallCaps, type Lod2WallCaps } from "./lod2_wall_caps";
import { createLod2RoofIndex } from "./lod2_roof_index";
import { pickBlockInventoryItem, postPickedBlockToInventory } from "../inventory/pick_block";
import { createRoofCalculationMeshes } from "./roof_calculation_rendering";
import { buildSolarLayout, createSolarMesh, normalizeSolarSettings } from "../world_edit/systems/solar/layout";
import { touchesLod2Wall } from './lod2_block_grid';
import {
  isRenderedRoofCalculationCurrent,
  roofCalculationForScene,
} from "../world_edit/systems/roof/optimistic_calculations";
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
  ChunkApiCommandPayload,
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
  type EditorInputWorldEditIntent,
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
import type { EditorStateChunkCellPosition } from "@state/editor_state";
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
import { isChunkLoaderFailureResult } from "@runtime/world/chunk_loader";
import { commandResultFromUnknown } from "@runtime/world/chunk_command_result";
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
import {
  applyOptimisticBlockEdit,
  applyOptimisticCellValue,
  type OptimisticBlockEditResult,
} from "@runtime/world/optimistic_block_edit";
import {
  applyMaterialAppearance,
  fallbackMaterialAppearance,
  getMaterialAppearance,
  loadMaterialTexture,
  normalizeMaterialAppearance,
} from "@render/material_appearance_registry";
import {
  createGeodataOverlayScene,
  type GeodataOverlaySceneHandle,
} from "@render/geodata_overlay_scene";
import { raycastFromOriginDirection } from "@targeting/raycast";
import {
  chunkCoordinatesFromKey,
  createChunkCellAddress,
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
  readonly pendingChunkMeshCount: number;
  readonly chunkMeshQueueHighWaterMark: number;
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
  readonly geodataOverlays: ReturnType<GeodataOverlaySceneHandle["getSnapshot"]> | null;
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
  getGeodataOverlayScene(): GeodataOverlaySceneHandle | null;
  getTargetCells(): {
    readonly sourceCell: EditorStateChunkCellPosition | null;
    readonly placementCell: EditorStateChunkCellPosition | null;
    readonly targetPoint: Readonly<{ x: number; y: number; z: number }> | null;
  };
  getSelectedLibraryPlacement(): ActiveLibraryPlacement;
  setWorldEditIntentHandler(
    handler: SceneWorldEditIntentHandler | null,
    options?: Readonly<{ maxDistance?: number }>,
  ): void;
  setPlacementConstraintHandler(handler: ScenePlacementConstraintHandler | null): void;
  setPlacementGeometryHandler(handler: ScenePlacementGeometryHandler | null): void;
  refreshPlacementGeometry(reason?: string): void;
  getSnapshot(): SceneRuntimeSnapshot;

  destroy(reason?: string): Promise<void>;
}

interface ChunkMeshRecord {
  readonly chunkKey: string;
  readonly group: THREE.Group;
  readonly meshes: readonly THREE.Mesh[];
  readonly materials: readonly THREE.Material[];
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly quadCount: number;
  readonly triangleCount: number;
}

interface OptimisticBlockOverlay {
  readonly cellKey: string;
  readonly chunkKey: string;
  readonly mesh: THREE.Mesh;
}

interface OptimisticSemanticOverlay {
  readonly key: string;
  readonly chunkKey: string;
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

interface SceneIdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

type SceneIdleWindow = Window;

type MeshAxis = 0 | 1 | 2;

interface GreedyFaceDirection {
  readonly axis: MeshAxis;
  readonly sign: -1 | 1;
  readonly uAxis: MeshAxis;
  readonly vAxis: MeshAxis;
  readonly normal: readonly [number, number, number];
}

interface GreedyMaterialBuffers {
  readonly positions: number[];
  readonly normals: number[];
  readonly uvs: number[];
  readonly indices: number[];
  quadCount: number;
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

export interface ActiveLibraryPlacement {
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
  readonly semanticProfile: Record<string, unknown> | null;
  readonly commandMetadata: Record<string, unknown>;
}

export type SceneWorldEditIntentHandler = (
  intent: EditorInputWorldEditIntent,
) => boolean | Promise<boolean>;

export interface ScenePlacementConstraintResult {
  readonly allowed: boolean;
  readonly message?: string;
  readonly code?: string;
  readonly semanticPlacement?: Readonly<{
    readonly kind: "parcel-grid-prism.v1";
    readonly footprint: Readonly<Record<string, unknown>>;
    readonly occupiedCells: readonly ChunkApiWorldPosition[];
    readonly mergeKey: string;
    readonly anchorPosition?: ChunkApiWorldPosition;
  }>;
}

export type ScenePlacementConstraintHandler = (
  position: ChunkApiWorldPosition,
  context?: Readonly<{
    targetPoint?: Readonly<{ x: number; y: number; z: number }> | null;
    worldCellGrid?: boolean;
  }>,
) => ScenePlacementConstraintResult;

export type ScenePlacementGeometryHandler = (
  position: ChunkApiWorldPosition,
  context?: Readonly<{
    currentFootprint?: Readonly<Record<string, unknown>> | null;
  }>,
) => ScenePlacementConstraintResult["semanticPlacement"] | null;

type SceneSemanticPlacement = NonNullable<ScenePlacementConstraintResult["semanticPlacement"]>;

interface PendingSemanticMigration {
  readonly key: string;
  readonly chunkKey: string;
  readonly position: ChunkApiWorldPosition;
  readonly blockTypeId: string;
  readonly semantic: SceneSemanticPlacement;
  readonly objectInstanceId: string | null;
  attempts: number;
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

interface PendingOptimisticBlockEdit {
  readonly sequence: number;
  readonly position: ChunkWorldPosition;
  readonly blockTypeId: string | null;
  readonly previousCellValue: number;
  readonly nextCellValue: number;
  readonly cellKey: string;
  readonly chunkKey: string;
  readonly affectedMeshChunkKeys: readonly string[];
  readonly label: string | null;
  readonly color: string | null;
}

interface SceneCameraFrameTelemetry {
  readonly lookDeltaX: number;
  readonly lookDeltaY: number;
  readonly lookDeltaMagnitude: number;
  readonly pointerLocked: boolean;
  readonly movementActive: boolean;
  readonly sprinting: boolean;
  readonly inputReadMs: number;
  readonly physicsSimulationMs: number;
  readonly physicsStoreMs: number;
  readonly cameraFinalizeMs: number;
  readonly cameraStoreMs: number;
  readonly physicsSubSteps: number;
}

const SCENE_RUNTIME_KIND = "vectoplan-editor-scene-runtime.v1" as const;
const SCENE_RUNTIME_SNAPSHOT_KIND = "scene-runtime-snapshot.v1" as const;

const DEFAULT_CLEAR_COLOR = "#020617";
const DEFAULT_CAMERA_SENSITIVITY = 0.0022;
const DEFAULT_TARGET_MAX_DISTANCE = 9;
const DEFAULT_MAX_MESH_CELLS_PER_CHUNK = 4096;
const MAX_CHUNK_MESHES_PER_IDLE_SLICE = 1;
const MIN_CHUNK_MESH_IDLE_BUDGET_MS = 4;
const CHUNK_MESH_IDLE_TIMEOUT_MS = 250;
const CHUNK_MESH_PROGRESS_COMMIT_INTERVAL_MS = 120;
// Keep the interactive reserve compact. The previous minimum predicted six
// whole chunk rings ahead even though the configured reserve is two chunks;
// one short flight therefore queued up to eleven 90 KiB batch responses.
const MIN_DIRECTIONAL_PRELOAD_RADIUS = 2;
const MIN_CHUNK_UNLOAD_RESERVE = 2;
const INITIAL_WARMUP_EXTRA_RADIUS = 2;
const CHUNK_STREAM_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000] as const;
const MAX_PREFETCH_MESH_WARMUP_CHUNKS = 24;
const RENDER_STORE_SYNC_INTERVAL_MS = 250;
const PHYSICS_STORE_SYNC_INTERVAL_MS = 100;
const CAMERA_STORE_SYNC_INTERVAL_MS = 50;
const NAVIGATION_COMPASS_UPDATE_INTERVAL_MS = 50;
const TARGETING_UPDATE_INTERVAL_MS = 34;
const CHUNK_STREAM_POLL_INTERVAL_MS = 100;
const HELD_ITEM_REFRESH_INTERVAL_MS = 80;
const REALTIME_PRESENCE_PUBLISH_INTERVAL_MS = 84;
const TERRAIN_SHADOW_CAST_DISTANCE = 48;
const TERRAIN_SHADOW_CAMERA_MOVE_DISTANCE = 12;
const FRAME_DIAGNOSTIC_WINDOW_SIZE = 120;
const FRAME_DIAGNOSTIC_UPDATE_INTERVAL_MS = 500;
const GAMEPLAY_PIXEL_RATIO_MAX = 1.25;
// A full authoritative chunk reload is intentionally delayed long enough to
// coalesce normal build bursts. Real F8 captures showed one 17-93 KiB batch
// reload after virtually every click, with individual requests taking up to
// 990 ms and starving the browser process. Parametric items now get a correct
// local preview immediately, so this delay is not visible as a full cube.
const BLOCK_RECONCILE_QUIET_MS = 2_500;
const BLOCK_EDIT_MESH_QUIET_MS = 90;
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

function isCameraDragTestRequested(): boolean {
  try {
    const query = new URL(window.location.href).searchParams;
    return query.get("camera_input_test")?.trim().toLowerCase() === "drag";
  } catch {
    return false;
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

function compactDefinitionValues(value: unknown): Record<string, string | number | boolean | null> {
  const record = asRecord(value);
  const result: Record<string, string | number | boolean | null> = {};

  for (const [key, item] of Object.entries(record).slice(0, 256)) {
    if (item === null) {
      result[key] = null;
    } else if (typeof item === "string") {
      result[key] = item;
    } else if (typeof item === "number") {
      result[key] = item;
    } else if (typeof item === "boolean") {
      result[key] = item;
    }
  }

  return result;
}

function variantDefinitionValuesFromSource(source: unknown): Record<string, string | number | boolean | null> {
  const selectedVariantId = normalizeOptionalContractText(firstDefined(
    readNestedValue(source, ["variantId"]),
    readNestedValue(source, ["variant_id"]),
    readNestedValue(source, ["selected_variant", "variant_id"]),
    readNestedValue(source, ["metadata", "selected_variant_id"]),
    readNestedValue(source, ["rawSlot", "variantId"]),
    readNestedValue(source, ["rawSlot", "variant_id"]),
    "default",
  ));
  const variantArrays = [
    readNestedValue(source, ["variants"]),
    readNestedValue(source, ["payload", "variants"]),
    readNestedValue(source, ["raw", "variants"]),
    readNestedValue(source, ["rawItem", "variants"]),
    readNestedValue(source, ["rawSlot", "variants"]),
    readNestedValue(source, ["rawSlot", "raw", "variants"]),
    readNestedValue(source, ["rawSlot", "raw", "payload", "variants"]),
  ];
  for (const candidate of variantArrays) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const variants = candidate.map(asRecord);
    const selected = variants.find((variant) => (
      normalizeOptionalContractText(firstDefined(variant.variant_id, variant.variantId, variant.id))
        === selectedVariantId
    )) ?? variants.find((variant) => safeBoolean(variant.is_default, false)) ?? variants[0];
    const values = compactDefinitionValues(firstDefined(
      selected?.definition_values,
      selected?.definitionValues,
      readNestedValue(selected, ["metadata", "definition_values"]),
    ));
    if (Object.keys(values).length > 0) return values;
  }
  return {};
}

function librarySemanticProfileFromSources(
  ...sources: readonly unknown[]
): Record<string, unknown> | null {
  try {
    const definitionPaths: readonly (readonly string[])[] = [
      ["semanticProfile", "variables"],
      ["semantic_profile", "variables"],
      ["metadata", "definition_values"],
      ["metadata", "definitionValues"],
      ["variant", "definition_values"],
      ["variant", "definitionValues"],
      ["selected_variant", "definition_values"],
      ["selected_variant", "definitionValues"],
      ["payload", "metadata", "definition_values"],
      ["payload", "metadata", "definitionValues"],
      ["raw", "payload", "metadata", "definition_values"],
      ["raw", "payload", "metadata", "definitionValues"],
      ["rawSlot", "metadata", "definition_values"],
      ["rawSlot", "metadata", "definitionValues"],
      ["rawSlot", "raw", "payload", "metadata", "definition_values"],
      ["rawItem", "metadata", "definition_values"],
      ["rawItem", "metadata", "definitionValues"],
    ];
    let variables: Record<string, string | number | boolean | null> = {};

    for (const source of sources) {
      for (const path of definitionPaths) {
        const candidate = compactDefinitionValues(readNestedValue(source, path));
        if (Object.keys(candidate).length > 0) {
          variables = candidate;
          break;
        }
      }
      if (Object.keys(variables).length === 0) {
        variables = variantDefinitionValuesFromSource(source);
      }
      if (Object.keys(variables).length > 0) {
        break;
      }
    }

    if (Object.keys(variables).length === 0) {
      return null;
    }

    const revisionPaths: readonly (readonly string[])[] = [
      ["semanticProfile", "revisionHash"],
      ["variant", "revision_hash"],
      ["variant", "revisionHash"],
      ["rawSlot", "variant", "revision_hash"],
      ["rawSlot", "raw", "extra", "variant", "revision_hash"],
      ["rawSlot", "raw", "payload", "revision_hash"],
    ];
    let revisionHash: string | null = null;
    for (const source of sources) {
      for (const path of revisionPaths) {
        revisionHash = normalizeOptionalContractText(readNestedValue(source, path));
        if (revisionHash) {
          break;
        }
      }
      if (revisionHash) {
        break;
      }
    }

    return {
      schemaVersion: "library-semantic-profile-snapshot/0.1",
      revisionHash,
      variables,
    };
  } catch {
    return null;
  }
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
    const blockTypeId = safeString(entry?.blockTypeId, "runtime-block");
    if (blockTypeId === "lod2_exterior_wall") return new THREE.Color("#e2d9c7");
    if (blockTypeId.startsWith("system_terrain")) {
      return new THREE.Color("#f8fafc");
    }
    const color = safeString(entry?.color, "");

    if (color.length > 0) {
      return new THREE.Color(color);
    }

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
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.02,
  });
  const appearance = getMaterialAppearance(entry?.blockTypeId)
    ?? fallbackMaterialAppearance(entry?.blockTypeId);
  applyMaterialAppearance(material, appearance);
  return material;
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

const GREEDY_FACE_DIRECTIONS: readonly GreedyFaceDirection[] = [
  { axis: 0, sign: 1, uAxis: 1, vAxis: 2, normal: [1, 0, 0] },
  { axis: 0, sign: -1, uAxis: 2, vAxis: 1, normal: [-1, 0, 0] },
  { axis: 1, sign: 1, uAxis: 2, vAxis: 0, normal: [0, 1, 0] },
  { axis: 1, sign: -1, uAxis: 0, vAxis: 2, normal: [0, -1, 0] },
  { axis: 2, sign: 1, uAxis: 0, vAxis: 1, normal: [0, 0, 1] },
  { axis: 2, sign: -1, uAxis: 1, vAxis: 0, normal: [0, 0, -1] },
] as const;

function localCellIndex(x: number, y: number, z: number, chunkSize: number): number {
  return x + (chunkSize * (y + (chunkSize * z)));
}

function createGreedyMaterialBuffers(): GreedyMaterialBuffers {
  return {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    quadCount: 0,
  };
}

function appendGreedyQuad(
  buffers: GreedyMaterialBuffers,
  chunk: RuntimeChunkContent,
  direction: GreedyFaceDirection,
  slice: number,
  u: number,
  v: number,
  width: number,
  height: number,
  cellSize: number,
): void {
  const origin = [0, 0, 0];
  const du = [0, 0, 0];
  const dv = [0, 0, 0];
  origin[direction.axis] = slice + (direction.sign > 0 ? 1 : 0);
  origin[direction.uAxis] = u;
  origin[direction.vAxis] = v;
  du[direction.uAxis] = width;
  dv[direction.vAxis] = height;

  const worldOffset = [
    chunk.chunkX * chunk.chunkSize,
    chunk.chunkY * chunk.chunkSize,
    chunk.chunkZ * chunk.chunkSize,
  ];
  const corners = [
    origin,
    origin.map((value, axis) => value + du[axis]),
    origin.map((value, axis) => value + du[axis] + dv[axis]),
    origin.map((value, axis) => value + dv[axis]),
  ];
  const vertexOffset = buffers.positions.length / 3;

  for (const corner of corners) {
    buffers.positions.push(
      (worldOffset[0] + corner[0]) * cellSize,
      (worldOffset[1] + corner[1]) * cellSize,
      (worldOffset[2] + corner[2]) * cellSize,
    );
    buffers.normals.push(...direction.normal);
  }
  // Textures use RepeatWrapping, so a merged rectangle still shows one tile
  // per voxel instead of stretching a single block texture over the surface.
  buffers.uvs.push(0, 0, width, 0, width, height, 0, height);
  buffers.indices.push(
    vertexOffset,
    vertexOffset + 1,
    vertexOffset + 2,
    vertexOffset,
    vertexOffset + 2,
    vertexOffset + 3,
  );
  buffers.quadCount += 1;
}

export function createChunkMeshRecord(
  chunk: RuntimeChunkContent,
  isWorldCellOccluder?: (worldX: number, worldY: number, worldZ: number) => boolean,
): ChunkMeshRecord {
  const group = new THREE.Group();
  group.name = `chunk:${chunk.chunkKey}`;
  group.userData.chunkKey = chunk.chunkKey;

  const cellSize = safeNumber(chunk.cellSize, 1, {
    min: 0.000001,
    max: 1_000,
  });
  const maxCells = Math.min(chunk.cells.length, DEFAULT_MAX_MESH_CELLS_PER_CHUNK);
  const chunkSize = chunk.chunkSize;
  const byCellValue = new Map<number, GreedyMaterialBuffers>();

  function cellValueAt(x: number, y: number, z: number): number {
    if (
      x >= 0 && x < chunkSize
      && y >= 0 && y < chunkSize
      && z >= 0 && z < chunkSize
    ) {
      const index = localCellIndex(x, y, z, chunkSize);
      if (index >= maxCells) return 0;
      return safeInteger(chunk.cells[index], 0, {
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
      });
    }

    if (!isWorldCellOccluder) return 0;
    const worldX = (chunk.chunkX * chunkSize) + x;
    const worldY = (chunk.chunkY * chunkSize) + y;
    const worldZ = (chunk.chunkZ * chunkSize) + z;
    return isWorldCellOccluder(worldX, worldY, worldZ) ? 1 : 0;
  }

  for (const direction of GREEDY_FACE_DIRECTIONS) {
    for (let slice = 0; slice < chunkSize; slice += 1) {
      const mask = new Int32Array(chunkSize * chunkSize);

      for (let v = 0; v < chunkSize; v += 1) {
        for (let u = 0; u < chunkSize; u += 1) {
          const local = [0, 0, 0];
          local[direction.axis] = slice;
          local[direction.uAxis] = u;
          local[direction.vAxis] = v;
          const cellValue = cellValueAt(local[0], local[1], local[2]);
          if (!isNonAirOccluder(cellValue)) continue;

          const neighbor = [...local];
          neighbor[direction.axis] += direction.sign;
          if (isNonAirOccluder(cellValueAt(neighbor[0], neighbor[1], neighbor[2]))) continue;
          mask[u + (v * chunkSize)] = cellValue;
        }
      }

      for (let v = 0; v < chunkSize; v += 1) {
        for (let u = 0; u < chunkSize;) {
          const cellValue = mask[u + (v * chunkSize)];
          if (cellValue <= 0) {
            u += 1;
            continue;
          }

          let width = 1;
          while (
            u + width < chunkSize
            && mask[u + width + (v * chunkSize)] === cellValue
          ) width += 1;

          let height = 1;
          heightLoop: while (v + height < chunkSize) {
            for (let offset = 0; offset < width; offset += 1) {
              if (mask[u + offset + ((v + height) * chunkSize)] !== cellValue) {
                break heightLoop;
              }
            }
            height += 1;
          }

          let buffers = byCellValue.get(cellValue);
          if (!buffers) {
            buffers = createGreedyMaterialBuffers();
            byCellValue.set(cellValue, buffers);
          }
          appendGreedyQuad(
            buffers,
            chunk,
            direction,
            slice,
            u,
            v,
            width,
            height,
            cellSize,
          );

          for (let clearV = 0; clearV < height; clearV += 1) {
            for (let clearU = 0; clearU < width; clearU += 1) {
              mask[u + clearU + ((v + clearV) * chunkSize)] = 0;
            }
          }
          u += width;
        }
      }
    }
  }

  const meshes: THREE.Mesh[] = [];
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  let quadCount = 0;

  for (const [cellValue, buffers] of byCellValue.entries()) {
    const entry = chunk.paletteByCellValue.get(cellValue) ?? null;
    const material = createMaterial(entry);
    material.name = materialKeyForCellValue(cellValue);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
    geometry.setIndex(buffers.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `chunk:${chunk.chunkKey}:cell:${cellValue}`;
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.chunkKey = chunk.chunkKey;
    mesh.userData.cellValue = cellValue;
    mesh.userData.quadCount = buffers.quadCount;
    group.add(mesh);
    meshes.push(mesh);
    materials.push(material);
    geometries.push(geometry);
    quadCount += buffers.quadCount;
  }

  group.userData.quadCount = quadCount;
  group.userData.triangleCount = quadCount * 2;

  return {
    chunkKey: chunk.chunkKey,
    group,
    meshes,
    materials,
    geometries,
    quadCount,
    triangleCount: quadCount * 2,
  };
}

export interface SemanticChunkObjectRef {
  readonly objectInstanceId: string;
  readonly objectTypeId: string;
  readonly objectVariantId: string;
  readonly objectKind: string;
  readonly primaryChunkKey: string;
  readonly fillBlockTypeId: string;
  readonly anchor: ChunkApiWorldPosition;
  readonly dimensions: Readonly<{ x: number; y: number; z: number }>;
  readonly footprint: Readonly<Record<string, unknown>>;
  readonly occupiedCells: readonly ChunkApiWorldPosition[];
  readonly mergeKey: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

const semanticRefCache = new WeakMap<RuntimeChunkContent, readonly SemanticChunkObjectRef[]>();
export function semanticObjectRefs(chunk: RuntimeChunkContent): readonly SemanticChunkObjectRef[] {
  const cached = semanticRefCache.get(chunk);
  if (cached) return cached;
  const rawChunk = asRecord(chunk.raw.raw);
  const normalizedRefs = chunk.raw.objectRefs;
  const rawRefs = Array.isArray(normalizedRefs)
    ? normalizedRefs
    : Array.isArray(rawChunk.objectRefs)
      ? rawChunk.objectRefs
    : Array.isArray(asRecord(rawChunk.content).objectRefs)
      ? asRecord(rawChunk.content).objectRefs as unknown[]
      : [];
  const result = rawRefs.map((value): SemanticChunkObjectRef | null => {
    const ref = asRecord(value);
    const footprint = asRecord(ref.footprint);
    const metadata = asRecord(ref.metadata);
    const objectKind = safeString(ref.objectKind, "");
    if (objectKind !== "semantic_footprint" && !isVplibParametricObjectRef({ objectKind, metadata })) return null;
    if (objectKind === "semantic_footprint"
      && safeString(footprint.coordinateSpace, "") !== "world-cell-xz") return null;
    const occupiedCells = (Array.isArray(ref.occupiedCells) ? ref.occupiedCells : [])
      .map((entry): ChunkApiWorldPosition | null => {
        const cell = asRecord(entry);
        const x = Number(cell.x);
        const y = Number(cell.y);
        const z = Number(cell.z);
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
          ? { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }
          : null;
      })
      .filter((cell): cell is ChunkApiWorldPosition => cell !== null);
    if (occupiedCells.length === 0) return null;
    const rawAnchor = asRecord(ref.anchor);
    const anchor = {
      x: safeInteger(rawAnchor.x, occupiedCells[0]!.x, { min: -1_000_000, max: 1_000_000 }),
      y: safeInteger(rawAnchor.y, occupiedCells[0]!.y, { min: -1_000_000, max: 1_000_000 }),
      z: safeInteger(rawAnchor.z, occupiedCells[0]!.z, { min: -1_000_000, max: 1_000_000 }),
    };
    const rawDimensions = asRecord(ref.dimensions);
    return {
      objectInstanceId: safeString(ref.objectInstanceId, "semantic-object"),
      objectTypeId: safeString(ref.objectTypeId, "semantic_footprint"),
      objectVariantId: safeString(ref.objectVariantId, "default"),
      objectKind,
      primaryChunkKey: safeString(ref.primaryChunkKey, chunk.chunkKey),
      fillBlockTypeId: safeString(ref.fillBlockTypeId, ""),
      anchor,
      dimensions: {
        x: safeInteger(rawDimensions.x, 1, { min: 1, max: 256 }),
        y: safeInteger(rawDimensions.y, 1, { min: 1, max: 256 }),
        z: safeInteger(rawDimensions.z, 1, { min: 1, max: 256 }),
      },
      footprint,
      occupiedCells,
      mergeKey: safeString(metadata.mergeKey, ""),
      metadata,
    };
  }).filter((value): value is SemanticChunkObjectRef => value !== null);
  semanticRefCache.set(chunk, result);
  return result;
}

export function appendLod2WallCaps(record: ChunkMeshRecord, caps: Lod2WallCaps): ChunkMeshRecord {
  if (!caps.geometry) return record;
  const material = createMaterial(caps.chunk.paletteByBlockTypeId.get("lod2_exterior_wall") ?? null);
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(caps.geometry, material);
  mesh.name = `lod2-wall-caps:${caps.chunk.chunkKey}`;
  mesh.receiveShadow = true;
  mesh.userData.chunkKey = caps.chunk.chunkKey;
  mesh.userData.lod2WallCaps = true;
  mesh.userData.cappedCellIndices = caps.cappedCellIndices;
  mesh.userData.alignedCellIndices = caps.alignedCellIndices;
  record.group.add(mesh);
  return {...record, meshes:[...record.meshes,mesh], materials:[...record.materials,material], geometries:[...record.geometries,caps.geometry]};
}

function semanticPlacementFingerprint(value: Readonly<{
  footprint: Readonly<Record<string, unknown>>;
  occupiedCells: readonly ChunkApiWorldPosition[];
  mergeKey: string;
}>): string {
  const normalizeCoordinates = (coordinate: unknown): unknown => {
    if (Array.isArray(coordinate)) return coordinate.map(normalizeCoordinates);
    const numeric = Number(coordinate);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(6)) : null;
  };
  const occupiedCells = value.occupiedCells
    .map((cell) => [Math.floor(cell.x), Math.floor(cell.y), Math.floor(cell.z)])
    .sort((first, second) => first[0] - second[0] || first[1] - second[1] || first[2] - second[2]);
  return JSON.stringify({
    type: safeString(value.footprint.type, "Polygon"),
    coordinates: normalizeCoordinates(value.footprint.coordinates),
    baseY: Number(Number(value.footprint.baseY ?? 0).toFixed(6)),
    height: Number(Number(value.footprint.height ?? 1).toFixed(6)),
    occupiedCells,
    mergeKey: value.mergeKey,
  });
}

function semanticFootprintRing(value: unknown): Array<readonly [number, number]> {
  const outer = Array.isArray(value) ? value : [];
  const result = outer.map((value): readonly [number, number] | null => {
    if (!Array.isArray(value) || value.length < 2) return null;
    const x = Number(value[0]);
    const z = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(z) ? [x, z] : null;
  }).filter((value): value is readonly [number, number] => value !== null);
  if (result.length > 1
    && Math.hypot(result[0]![0] - result[result.length - 1]![0], result[0]![1] - result[result.length - 1]![1]) < 1e-6) result.pop();
  return result;
}

function semanticFootprintPolygonsFromFootprint(
  footprint: Readonly<Record<string, unknown>>,
): Array<Array<readonly [number, number]>> {
  const coordinates = Array.isArray(footprint.coordinates) ? footprint.coordinates : [];
  const rawPolygons = safeString(footprint.type, "Polygon") === "MultiPolygon"
    ? coordinates
    : [coordinates];
  return rawPolygons.map((polygon) => (
    semanticFootprintRing(Array.isArray(polygon) ? polygon[0] : null)
  )).filter((polygon) => polygon.length >= 3);
}

function semanticFootprintPolygons(ref: SemanticChunkObjectRef): Array<Array<readonly [number, number]>> {
  return semanticFootprintPolygonsFromFootprint(ref.footprint);
}

function createSemanticFootprintGeometry(
  footprint: Readonly<Record<string, unknown>>,
  fallbackBaseY: number,
  cellSize: number,
): THREE.ExtrudeGeometry | null {
  const polygons = semanticFootprintPolygonsFromFootprint(footprint);
  if (polygons.length === 0) return null;
  const shapes = polygons.map((points) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0]![0] * cellSize, -points[0]![1] * cellSize);
    for (const point of points.slice(1)) shape.lineTo(point[0] * cellSize, -point[1] * cellSize);
    shape.closePath();
    return shape;
  });
  const height = safeNumber(footprint.height, 1, { min: 0.01, max: 256 }) * cellSize;
  const baseY = safeNumber(footprint.baseY, fallbackBaseY, {
    min: -1_000_000,
    max: 1_000_000,
  }) * cellSize;
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, baseY, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createParametricObjectMeshes(
  ref: SemanticChunkObjectRef,
  chunk: RuntimeChunkContent,
  cellSize: number,
): Readonly<{
  meshes: readonly THREE.Mesh[];
  materials: readonly THREE.Material[];
  geometries: readonly THREE.BufferGeometry[];
}> {
  const profile = asRecord(ref.metadata.geometryProfile);
  const profileId = safeString(profile["geometry.profile_id"], "").toLowerCase().replace(/-/g, "_");
  const primitiveShape = safeString(profile["geometry.primitive_shape"], "box").toLowerCase().replace(/-/g, "_");
  const axis = safeString(profile["geometry.axis"], "x").toLowerCase();
  const interactionState = asRecord(ref.metadata.interactionState);
  const anchor = ref.anchor ?? ref.occupiedCells[0] ?? { x: 0, y: 0, z: 0 };
  const paletteEntry = chunk.paletteByBlockTypeId.get(ref.fillBlockTypeId) ?? null;
  const maxWidth = Math.max(0.1, ref.dimensions.x - 0.04);
  const maxHeight = Math.max(0.1, ref.dimensions.y - 0.04);
  const maxDepth = Math.max(0.1, ref.dimensions.z - 0.04);
  const dimension = (key: string, fallback: number, maximum: number): number => (
    safeNumber(profile[key], fallback * 1000, { min: 1, max: 256_000 }) / 1000
  ) * cellSize > maximum * cellSize
    ? maximum * cellSize
    : Math.max(0.025 * cellSize, safeNumber(profile[key], fallback * 1000, {
        min: 1,
        max: 256_000,
      }) / 1000 * cellSize);
  const width = dimension("dimensions.width_mm", 1, maxWidth);
  const declaredHeight = dimension("dimensions.height_mm", 1, maxHeight);
  const heightMode = safeString(profile["geometry.height_mode"], "dimensions").toLowerCase();
  const heightFraction = safeNumber(profile["geometry.height_fraction"], heightMode === "half" ? 0.5 : 1, {
    min: 0.01,
    max: 32,
  });
  const height = profileId === "half_block" || heightMode === "half"
    ? Math.min(maxHeight * cellSize, heightFraction * cellSize)
    : declaredHeight;
  const depth = dimension("dimensions.depth_mm", 0.12, maxDepth);
  const baseX = anchor.x * cellSize;
  const baseY = anchor.y * cellSize;
  const baseZ = anchor.z * cellSize;
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    part: string,
  ): void => {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `vplib:${ref.objectInstanceId}:${part}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.objectInstanceId = ref.objectInstanceId;
    mesh.userData.vplibParametric = true;
    mesh.userData.vplibProfileId = profileId;
    mesh.userData.vplibInteractionKind = safeString(interactionState.kind, "none");
    mesh.userData.semanticObjectRef = ref;
    meshes.push(mesh);
    if (!materials.includes(material)) materials.push(material);
    geometries.push(geometry);
  };

  const partMaterial = (color: unknown, opacity: unknown): THREE.Material => {
    const material = createMaterial(paletteEntry);
    const colorText = safeString(color, "");
    if (/^#[0-9a-f]{6}$/i.test(colorText)) material.color.set(colorText);
    const resolvedOpacity = safeNumber(opacity, 1, { min: 0, max: 1 });
    if (resolvedOpacity < 0.999) {
      material.transparent = true;
      material.opacity = resolvedOpacity;
      material.depthWrite = false;
    }
    return material;
  };

  const parsedParts = (() => {
    const raw = profile["geometry.parts_json"];
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || raw.trim().length === 0) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  if (profileId === "composite_parts" && parsedParts.length > 0) {
    for (const [index, rawPart] of parsedParts.slice(0, 64).entries()) {
      const part = asRecord(rawPart);
      const vector = (key: string, fallback: readonly [number, number, number]): readonly [number, number, number] => {
        const value = part[key];
        const array = Array.isArray(value) ? value : [];
        return [
          safeNumber(array[0], fallback[0], { min: -1000, max: 1000 }),
          safeNumber(array[1], fallback[1], { min: -1000, max: 1000 }),
          safeNumber(array[2], fallback[2], { min: -1000, max: 1000 }),
        ];
      };
      const size = vector("size", [1, 1, 1]).map((component) => Math.max(0.001, Math.abs(component))) as [number, number, number];
      const position = vector("position", [0, 0, 0]);
      const rotation = vector("rotation", [0, 0, 0]);
      const shape = safeString(part.shape, "box").toLowerCase();
      let geometry: THREE.BufferGeometry;
      if (["cylinder", "pipe"].includes(shape)) {
        geometry = new THREE.CylinderGeometry(size[0] * cellSize * 0.5, size[0] * cellSize * 0.5, size[1] * cellSize, 20);
      } else if (shape === "wedge") {
        const wedge = new THREE.BoxGeometry(size[0] * cellSize, size[1] * cellSize, size[2] * cellSize);
        const positions = wedge.getAttribute("position");
        for (let vertex = 0; vertex < positions.count; vertex += 1) {
          if (positions.getZ(vertex) < 0) positions.setY(vertex, positions.getY(vertex) - size[1] * cellSize * 0.5);
        }
        positions.needsUpdate = true;
        geometry = wedge;
      } else {
        geometry = new THREE.BoxGeometry(size[0] * cellSize, size[1] * cellSize, size[2] * cellSize);
      }
      geometry.rotateX(rotation[0] * Math.PI / 180);
      geometry.rotateY(rotation[1] * Math.PI / 180);
      geometry.rotateZ(rotation[2] * Math.PI / 180);
      geometry.translate(
        baseX + (position[0] + 0.5) * cellSize,
        baseY + (position[1] + size[1] * 0.5) * cellSize,
        baseZ + (position[2] + 0.5) * cellSize,
      );
      add(geometry, partMaterial(part.color, part.opacity), safeString(part.part_id ?? part.id, `part-${index + 1}`));
    }
    return { meshes, materials, geometries };
  }

  if (profileId === "pipe_segment" || primitiveShape === "pipe") {
    const length = dimension("dimensions.length_mm", 1, axis === "y" ? maxHeight : axis === "z" ? maxDepth : maxWidth);
    const diameter = Math.max(
      0.045 * cellSize,
      Math.min(
        Math.max(0.06 * cellSize, Math.min(height, depth)),
        0.86 * cellSize,
      ),
    );
    const geometry = new THREE.CylinderGeometry(diameter * 0.5, diameter * 0.5, length, 20, 1, false);
    if (axis === "x") geometry.rotateZ(Math.PI / 2);
    if (axis === "z") geometry.rotateX(Math.PI / 2);
    geometry.translate(
      baseX + (axis === "x" ? length * 0.5 : cellSize * 0.5),
      baseY + (axis === "y" ? length * 0.5 : cellSize * 0.5),
      baseZ + (axis === "z" ? length * 0.5 : cellSize * 0.5),
    );
    add(geometry, createMaterial(paletteEntry), "pipe");
    return { meshes, materials, geometries };
  }

  if (profileId === "vertical_cylinder" || primitiveShape === "cylinder") {
    const diameter = Math.max(0.08 * cellSize, Math.min(width, depth, ref.dimensions.x * cellSize * 0.94));
    const geometry = new THREE.CylinderGeometry(diameter * 0.5, diameter * 0.5, height, 24, 1, true);
    geometry.translate(baseX + ref.dimensions.x * cellSize * 0.5, baseY + height * 0.5, baseZ + ref.dimensions.z * cellSize * 0.5);
    add(geometry, createMaterial(paletteEntry), "cylinder");
    return { meshes, materials, geometries };
  }

  if (profileId === "conveyor_segment" || primitiveShape === "conveyor") {
    const bodyWidth = axis === "z" ? Math.min(width, 0.72 * cellSize) : Math.min(depth, 0.72 * cellSize);
    const bodyLength = axis === "z" ? depth : width;
    const beltThickness = Math.max(0.055 * cellSize, Math.min(height, 0.18 * cellSize));
    const centerX = baseX + ref.dimensions.x * cellSize * 0.5;
    const centerZ = baseZ + ref.dimensions.z * cellSize * 0.5;
    const belt = new THREE.BoxGeometry(
      axis === "z" ? bodyWidth : bodyLength,
      beltThickness,
      axis === "z" ? bodyLength : Math.min(depth, 0.72 * cellSize),
    );
    belt.translate(centerX, baseY + beltThickness * 1.6, centerZ);
    const beltMaterial = partMaterial("#334155", 1);
    add(belt, beltMaterial, "belt");
    const rollerMaterial = partMaterial("#94a3b8", 1);
    for (const offset of [-0.34, 0, 0.34]) {
      const roller = new THREE.CylinderGeometry(0.075 * cellSize, 0.075 * cellSize, Math.min(depth, 0.74 * cellSize), 16);
      roller.rotateZ(Math.PI / 2);
      if (axis === "z") roller.rotateY(Math.PI / 2);
      roller.translate(
        centerX + (axis === "z" ? 0 : offset * cellSize),
        baseY + beltThickness * 2.15,
        centerZ + (axis === "z" ? offset * cellSize : 0),
      );
      add(roller, rollerMaterial, `roller-${offset}`);
    }
    return { meshes, materials, geometries };
  }

  if (profileId === "stair_run" || primitiveShape === "stairs") {
    const steps = Math.max(2, Math.min(16, Math.round(Math.max(width, depth) / (0.22 * cellSize))));
    const run = axis === "x" ? width : depth;
    const stairWidth = axis === "x" ? depth : width;
    const material = createMaterial(paletteEntry);
    for (let index = 0; index < steps; index += 1) {
      const stepLength = run / steps;
      const stepHeight = height * (index + 1) / steps;
      const geometry = new THREE.BoxGeometry(
        axis === "x" ? stepLength : stairWidth,
        stepHeight,
        axis === "x" ? stairWidth : stepLength,
      );
      geometry.translate(
        baseX + (axis === "x" ? stepLength * (index + 0.5) : ref.dimensions.x * cellSize * 0.5),
        baseY + stepHeight * 0.5,
        baseZ + (axis === "x" ? ref.dimensions.z * cellSize * 0.5 : stepLength * (index + 0.5)),
      );
      add(geometry, material, `step-${index + 1}`);
    }
    return { meshes, materials, geometries };
  }

  if (["block", "half_block", "slab", "wall_segment", "beam", "column"].includes(profileId)) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(
      baseX + ref.dimensions.x * cellSize * 0.5,
      baseY + height * 0.5,
      baseZ + ref.dimensions.z * cellSize * 0.5,
    );
    add(geometry, createMaterial(paletteEntry), profileId);
    return { meshes, materials, geometries };
  }

  if (profileId === "thin_window") {
    const centerX = baseX + ref.dimensions.x * cellSize * 0.5;
    const centerY = baseY + height * 0.5;
    const centerZ = baseZ + cellSize * 0.5;
    const frame = Math.max(0.045 * cellSize, Math.min(width, height) * 0.085);
    const frameDepth = Math.max(0.055 * cellSize, Math.min(depth, 0.16 * cellSize));
    const frameMaterial = createMaterial(paletteEntry);
    const paneMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x9bdcf2,
      transparent: true,
      opacity: 0.38,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pane = new THREE.BoxGeometry(Math.max(frame, width - frame * 2), Math.max(frame, height - frame * 2), Math.max(0.018 * cellSize, frameDepth * 0.22));
    pane.translate(centerX, centerY, centerZ);
    add(pane, paneMaterial, "glass");
    [
      [width, frame, centerX, baseY + frame * 0.5],
      [width, frame, centerX, baseY + height - frame * 0.5],
      [frame, Math.max(frame, height - frame * 2), baseX + (ref.dimensions.x * cellSize - width) * 0.5 + frame * 0.5, centerY],
      [frame, Math.max(frame, height - frame * 2), baseX + (ref.dimensions.x * cellSize + width) * 0.5 - frame * 0.5, centerY],
    ].forEach((entry, index) => {
      const geometry = new THREE.BoxGeometry(entry[0]!, entry[1]!, frameDepth);
      geometry.translate(entry[2]!, entry[3]!, centerZ);
      add(geometry, frameMaterial, `frame-${index}`);
    });
    return { meshes, materials, geometries };
  }

  if (profileId === "hinged_door") {
    const panelDepth = Math.max(0.055 * cellSize, Math.min(depth, 0.18 * cellSize));
    const frameSize = Math.max(0.045 * cellSize, Math.min(width * 0.07, 0.08 * cellSize));
    const frameMaterial = partMaterial("#334155", 1);
    [
      [frameSize, height, baseX + frameSize * 0.5, baseY + height * 0.5],
      [frameSize, height, baseX + width - frameSize * 0.5, baseY + height * 0.5],
      [width, frameSize, baseX + width * 0.5, baseY + height - frameSize * 0.5],
    ].forEach((entry, index) => {
      const frameGeometry = new THREE.BoxGeometry(entry[0]!, entry[1]!, panelDepth * 1.25);
      frameGeometry.translate(entry[2]!, entry[3]!, baseZ + cellSize * 0.5);
      add(frameGeometry, frameMaterial, `door-frame-${index + 1}`);
    });
    const geometry = new THREE.BoxGeometry(width, height, panelDepth);
    geometry.translate(width * 0.5, height * 0.5, 0);
    const open = safeBoolean(interactionState.open, false);
    if (open) geometry.rotateY(-Math.PI / 2);
    geometry.translate(baseX + 0.035 * cellSize, baseY, baseZ + cellSize * 0.5);
    add(geometry, createMaterial(paletteEntry), "door-panel");
    const handle = new THREE.SphereGeometry(Math.max(0.025 * cellSize, frameSize * 0.42), 14, 10);
    handle.translate(width * 0.82, height * 0.52, -panelDepth * 0.62);
    if (open) handle.rotateY(-Math.PI / 2);
    handle.translate(baseX + 0.035 * cellSize, baseY, baseZ + cellSize * 0.5);
    add(handle, partMaterial("#d4af37", 1), "door-handle");
    return { meshes, materials, geometries };
  }

  return { meshes, materials, geometries };
}

function createSemanticRoomFloorGeometry(
  footprint: Readonly<Record<string, unknown>>,
  fallbackBaseY: number,
  cellSize: number,
): THREE.ShapeGeometry | null {
  const polygons = semanticFootprintPolygonsFromFootprint(footprint);
  if (polygons.length === 0) return null;
  const shapes = polygons.map((points) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0]![0] * cellSize, -points[0]![1] * cellSize);
    for (const point of points.slice(1)) shape.lineTo(point[0] * cellSize, -point[1] * cellSize);
    shape.closePath();
    return shape;
  });
  const baseY = safeNumber(footprint.baseY, fallbackBaseY, {
    min: -1_000_000,
    max: 1_000_000,
  }) * cellSize;
  const geometry = new THREE.ShapeGeometry(shapes);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, baseY + Math.max(0.018, cellSize * 0.018), 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createSemanticRoomLabel(
  ref: SemanticChunkObjectRef,
  cellSize: number,
): THREE.Sprite | null {
  if (typeof document === "undefined") return null;
  const polygons = semanticFootprintPolygons(ref);
  const points = polygons.flat();
  if (points.length < 3) return null;
  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const minZ = Math.min(...points.map((point) => point[1]));
  const maxZ = Math.max(...points.map((point) => point[1]));
  const label = safeString(ref.metadata.label, "Raum");
  const fallbackArea = Math.max(0, (maxX - minX) * (maxZ - minZ));
  const area = safeNumber(ref.metadata.areaM2, fallbackArea, { min: 0, max: 10_000_000 });
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 176;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,.92)";
  context.strokeStyle = "rgba(21,128,61,.7)";
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 24);
  context.fill();
  context.stroke();
  context.fillStyle = "#14532d";
  context.font = "700 54px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(label.slice(0, 32), canvas.width / 2, 74);
  context.fillStyle = "#166534";
  context.font = "600 42px system-ui, sans-serif";
  context.fillText(`${area.toFixed(2)} m²`, canvas.width / 2, 132);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const baseY = safeNumber(ref.footprint.baseY, ref.occupiedCells[0]?.y ?? 0, {
    min: -1_000_000,
    max: 1_000_000,
  });
  sprite.position.set((minX + maxX) * 0.5 * cellSize, (baseY + 0.08) * cellSize, (minZ + maxZ) * 0.5 * cellSize);
  const width = Math.max(2.8, Math.min(7, (maxX - minX) * 0.65)) * cellSize;
  sprite.scale.set(width, width * (canvas.height / canvas.width), 1);
  sprite.renderOrder = 96;
  sprite.userData.semanticRoomLabel = true;
  sprite.userData.objectInstanceId = ref.objectInstanceId;
  return sprite;
}

function semanticFootprintWithPolygons(
  footprint: Readonly<Record<string, unknown>>,
  polygons: readonly (readonly (readonly [number, number])[])[],
): Readonly<Record<string, unknown>> {
  const coordinates = polygons.map((polygon) => [[...polygon, polygon[0]!]]);
  return polygons.length === 1
    ? { ...footprint, type: "Polygon", coordinates: coordinates[0] }
    : { ...footprint, type: "MultiPolygon", coordinates };
}

function semanticFootprintsTouch(first: SemanticChunkObjectRef, second: SemanticChunkObjectRef): boolean {
  const firstPolygons = semanticFootprintPolygons(first);
  const secondPolygons = semanticFootprintPolygons(second);
  if (firstPolygons.length === 0 || secondPolygons.length === 0) return false;
  const bounds = (points: readonly (readonly [number, number])[]) => ({
    minX: Math.min(...points.map((point) => point[0])),
    maxX: Math.max(...points.map((point) => point[0])),
    minZ: Math.min(...points.map((point) => point[1])),
    maxZ: Math.max(...points.map((point) => point[1])),
  });
  const tolerance = 0.03;
  return firstPolygons.some((firstPoints) => secondPolygons.some((secondPoints) => {
    const a = bounds(firstPoints);
    const b = bounds(secondPoints);
    return a.minX <= b.maxX + tolerance && a.maxX + tolerance >= b.minX
      && a.minZ <= b.maxZ + tolerance && a.maxZ + tolerance >= b.minZ;
  }));
}

function coalesceSemanticObjectRefs(refs: readonly SemanticChunkObjectRef[]): readonly SemanticChunkObjectRef[] {
  const result: SemanticChunkObjectRef[] = [];
  for (const ref of refs) {
    const index = ref.mergeKey
      ? result.findIndex((candidate) => candidate.mergeKey === ref.mergeKey
        && candidate.objectTypeId === ref.objectTypeId
        && ref.objectTypeId !== "space_room"
        && candidate.fillBlockTypeId === ref.fillBlockTypeId
        && semanticFootprintsTouch(candidate, ref))
      : -1;
    if (index < 0) {
      result.push(ref);
      continue;
    }
    const current = result[index]!;
    const polygons = [...semanticFootprintPolygons(current), ...semanticFootprintPolygons(ref)];
    result[index] = {
      ...current,
      objectInstanceId: `${current.objectInstanceId}+${ref.objectInstanceId}`,
      footprint: semanticFootprintWithPolygons(current.footprint, polygons),
      occupiedCells: [...current.occupiedCells, ...ref.occupiedCells],
    };
  }
  return result;
}

function chunkWithoutSemanticObjectCells(
  chunk: RuntimeChunkContent,
  refs: readonly SemanticChunkObjectRef[],
): RuntimeChunkContent {
  if (refs.length === 0) return chunk;
  const cells = [...chunk.cells];
  for (const ref of coalesceSemanticObjectRefs(refs)) {
    if (ref.metadata.voxelOccupancy === "none") continue;
    for (const position of ref.occupiedCells) {
      const localX = position.x - chunk.chunkX * chunk.chunkSize;
      const localY = position.y - chunk.chunkY * chunk.chunkSize;
      const localZ = position.z - chunk.chunkZ * chunk.chunkSize;
      if (localX < 0 || localY < 0 || localZ < 0
        || localX >= chunk.chunkSize || localY >= chunk.chunkSize || localZ >= chunk.chunkSize) continue;
      cells[localCellIndex(localX, localY, localZ, chunk.chunkSize)] = 0;
    }
  }
  return { ...chunk, cells };
}

export function appendSemanticObjectMeshes(
  record: ChunkMeshRecord,
  chunk: RuntimeChunkContent,
  refs: readonly SemanticChunkObjectRef[],
): ChunkMeshRecord {
  const semanticMeshes: THREE.Mesh[] = [];
  const semanticMaterials: THREE.Material[] = [];
  const semanticGeometries: THREE.BufferGeometry[] = [];
  for (const ref of coalesceSemanticObjectRefs(refs)) {
    if (ref.primaryChunkKey !== chunk.chunkKey) continue;
    const cellSize = safeNumber(chunk.cellSize, 1, { min: 0.000001, max: 1_000 });
    if (isVplibParametricObjectRef(ref)) {
      const parametric = createParametricObjectMeshes(ref, chunk, cellSize);
      for (const mesh of parametric.meshes) record.group.add(mesh);
      semanticMeshes.push(...parametric.meshes);
      semanticMaterials.push(...parametric.materials);
      semanticGeometries.push(...parametric.geometries);
      continue;
    }
    if (ref.objectTypeId === "building_roof") {
      const roofCalculation = roofCalculationForScene(
        ref.objectInstanceId,
        ref.metadata.roofCalculation,
        chunk.chunkRevision,
      );
      const roof = createRoofCalculationMeshes(roofCalculation, {
        scale: cellSize,
        semanticObjectRef: ref,
        objectInstanceId: ref.objectInstanceId,
      });
      for (const mesh of roof.meshes) record.group.add(mesh);
      semanticMeshes.push(...roof.meshes);
      semanticMaterials.push(...roof.materials);
      semanticGeometries.push(...roof.geometries);
      const settings = normalizeSolarSettings(ref.metadata.solar);
      const solar = createSolarMesh(buildSolarLayout(roofCalculation, settings), settings.module);
      if (solar) {
        solar.scale.setScalar(cellSize);
        solar.userData = { ...roof.meshes[0]?.userData, semanticRoof: true,
          objectInstanceId: ref.objectInstanceId, semanticObjectRef: ref, solarArray: true };
        record.group.add(solar);
        semanticMeshes.push(solar);
        semanticMaterials.push(solar.material as THREE.Material);
        semanticGeometries.push(solar.geometry);
      }
      continue;
    }
    const geometry = createSemanticFootprintGeometry(
      ref.footprint,
      ref.occupiedCells[0]?.y ?? 0,
      cellSize,
    );
    const roomGeometry = ref.objectTypeId === "space_room"
      ? createSemanticRoomFloorGeometry(ref.footprint, ref.occupiedCells[0]?.y ?? 0, cellSize)
      : null;
    const selectedGeometry = roomGeometry ?? geometry;
    if (!selectedGeometry) continue;
    if (roomGeometry && geometry) geometry.dispose();
    const paletteEntry = chunk.paletteByBlockTypeId.get(ref.fillBlockTypeId) ?? null;
    const material = ref.objectTypeId === "space_room"
      ? new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      : createMaterial(paletteEntry);
    const mesh = new THREE.Mesh(selectedGeometry, material);
    mesh.name = `semantic:${ref.objectInstanceId}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.objectInstanceId = ref.objectInstanceId;
    mesh.userData.semanticFootprint = true;
    mesh.userData.semanticRoom = ref.objectTypeId === "space_room";
    mesh.userData.semanticObjectRef = ref;
    mesh.userData.roomType = ref.metadata.roomType;
    mesh.userData.roomLabel = ref.metadata.label;
    record.group.add(mesh);
    if (ref.objectTypeId === "space_room") {
      const label = createSemanticRoomLabel(ref, cellSize);
      if (label) {
        record.group.add(label);
        semanticMaterials.push(label.material);
      }
    }
    semanticMeshes.push(mesh);
    semanticMaterials.push(material);
    semanticGeometries.push(selectedGeometry);
  }
  return {
    ...record,
    meshes: [...record.meshes, ...semanticMeshes],
    materials: [...record.materials, ...semanticMaterials],
    geometries: [...record.geometries, ...semanticGeometries],
  };
}

function createChunkMeshRecordFromWorkerResult(
  chunk: RuntimeChunkContent,
  result: ChunkMeshWorkerResult,
): ChunkMeshRecord {
  const group = new THREE.Group();
  group.name = `chunk:${chunk.chunkKey}`;
  group.userData.chunkKey = chunk.chunkKey;
  group.userData.chunkMeshWorkerBuildMs = result.buildMs;
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  for (const buffers of result.buffers) {
    const entry = chunk.paletteByCellValue.get(buffers.cellValue) ?? null;
    const material = createMaterial(entry);
    material.name = materialKeyForCellValue(buffers.cellValue);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(buffers.positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(buffers.normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(buffers.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `chunk:${chunk.chunkKey}:cell:${buffers.cellValue}`;
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.chunkKey = chunk.chunkKey;
    mesh.userData.cellValue = buffers.cellValue;
    mesh.userData.quadCount = buffers.quadCount;
    group.add(mesh);
    meshes.push(mesh);
    materials.push(material);
    geometries.push(geometry);
  }

  group.userData.quadCount = result.quadCount;
  group.userData.triangleCount = result.triangleCount;
  return {
    chunkKey: chunk.chunkKey,
    group,
    meshes,
    materials,
    geometries,
    quadCount: result.quadCount,
    triangleCount: result.triangleCount,
  };
}

function createRenderer(
  canvas: HTMLCanvasElement,
  bootstrap: EditorBootstrap,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    // Native MSAA multiplies the cost of every full-resolution terrain and
    // shadow pass. Crisp voxel edges remain readable without it and this keeps
    // the interactive viewport inside its frame budget on integrated GPUs.
    antialias: false,
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
  // Browser automation environments commonly reject Pointer Lock even for a
  // trusted click. This opt-in diagnostic keeps the production path unchanged
  // while allowing the same accumulator/camera/render loop to be exercised by
  // a held-button drag: ?camera_input_test=drag
  const cameraDragTestEnabled = isCameraDragTestRequested();
  const pointerLockEnabled = bootstrap.input.pointerLockEnabled && !cameraDragTestEnabled;

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
  let lastFrameDiagnosticAtMs = 0;
  let cameraInputFrameCount = 0;
  let lastCameraInputMagnitude = 0;
  const frameTimeSamplesMs: number[] = [];
  let meshCount = 0;
  let materialCount = 0;
  let lastRenderedAt: string | null = null;
  let lastTargetSignature: string | null = null;
  let latestSourceCell: EditorStateChunkCellPosition | null = null;
  let latestPlacementCell: EditorStateChunkCellPosition | null = null;
  let latestTargetPoint: Readonly<{ x: number; y: number; z: number }> | null = null;
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
  let visibilityRetryAttempt = 0;
  let visibilityRetryAtMs = 0;
  let lastError: Record<string, unknown> | null = null;
  let lastPlacement: ActiveLibraryPlacement | null = null;
  let placeIntentCount = 0;
  let blockedPlaceIntentCount = 0;
  let removeIntentCount = 0;
  let worldEditIntentHandler: SceneWorldEditIntentHandler | null = null;
  let worldEditTargetMaxDistance = DEFAULT_TARGET_MAX_DISTANCE;
  let placementConstraintHandler: ScenePlacementConstraintHandler | null = null;
  let placementGeometryHandler: ScenePlacementGeometryHandler | null = null;
  const pendingSemanticMigrations = new Map<string, PendingSemanticMigration>();
  const settledSemanticMigrationKeys = new Set<string>();
  let semanticMigrationTimerId: number | null = null;
  let semanticMigrationInFlight = false;
  let commandChunkRenderScheduled = false;
  let optimisticBlockEditSequence = 0;
  let blockCommandsInFlight = 0;
  let blockReconcileTimerId: number | null = null;
  let blockReconcileInFlight = false;
  let blockReconcileQueued = false;
  let blockShadowRefreshTimerId: number | null = null;
  let optimisticMeshTimerId: number | null = null;
  const pendingOptimisticBlockEdits = new Map<string, PendingOptimisticBlockEdit>();
  const pendingOptimisticMeshChunkKeys = new Set<string>();
  const optimisticBlockOverlays = new Map<string, OptimisticBlockOverlay>();
  const optimisticSemanticOverlays = new Map<string, OptimisticSemanticOverlay>();
  const optimisticOverlayMaterials = new Map<string, THREE.MeshStandardMaterial>();
  const blockReconcileChunkKeys = new Set<string>();
  let lastRenderStoreSyncAtMs = 0;
  let lastPhysicsStoreSyncAtMs = 0;
  let lastCameraStoreSyncAtMs = 0;
  let lastPhysicsStoreSignature: string | null = null;
  let lastNavigationCompassUpdateAtMs = 0;
  let lastTargetingUpdateAtMs = 0;
  let lastChunkStreamPollAtMs = 0;
  let lastHeldItemRefreshAtMs = 0;
  let lastRealtimePresencePublishAtMs = 0;
  let lastTerrainShadowCasterUpdateAtMs = -Infinity;
  let terrainShadowCastersDirty = true;
  let terrainShadowScanCount = 0;
  let terrainShadowChangeCount = 0;
  let terrainShadowCasterMeshCount = 0;
  let cachedSelectedHeldItem: RealtimeHeldItem | null = null;
  let chunkMeshQueueHighWaterMark = 0;
  let lastChunkMeshProgressCommitAtMs = 0;
  let chunkMeshIdleCallbackId: number | null = null;
  let chunkMeshFallbackTimerId: number | null = null;
  let chunkMeshWorkerClient: ChunkMeshWorkerClient | null = null;
  let chunkMeshBuildInFlight = false;
  let chunkMeshBuildGeneration = 0;
  let wantedChunkMeshKeys = new Set<string>();
  let visibleChunkMeshKeys = new Set<string>();
  const warmedChunkMeshKeys = new Set<string>();
  const optimisticChunkMeshKeys = new Set<string>();
  let lastChunkMeshQueueReason = "scene-runtime.chunk-mesh-queue";
  const pendingChunkMeshKeys: string[] = [];
  const pendingChunkMeshKeySet = new Set<string>();
  const chunkBoundaryRevisionCache = new WeakMap<RuntimeChunkContent, readonly string[]>();

  refs.root.dataset.sceneRuntimeCameraInputTest = cameraDragTestEnabled ? "drag" : "pointer-lock";
  refs.root.dataset.sceneRuntimePointerLockEnabled = String(pointerLockEnabled);

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let chunksRoot: THREE.Group | null = null;
  let optimisticOverlayRoot: THREE.Group | null = null;
  let optimisticOverlayGeometry: THREE.BoxGeometry | null = null;
  let geodataOverlayScene: GeodataOverlaySceneHandle | null = null;
  let geodataOverlaySyncTimerId: number | null = null;
  let geodataOverlaySyncReason = "scene-runtime.geodata-overlays";
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
  let realtimeClient: EditorRealtimeClient | null = null;
  let realtimeUnsubscribe: (() => void) | null = null;
  let remoteAvatarScene: RemoteAvatarScene | null = null;
  let localAvatarScene: RemoteAvatarScene | null = null;
  let firstPersonHeldItemVisual: HeldItemVisualHandle | null = null;
  let localRealtimeMember: RealtimeMember | null = null;
  let localAvatarSessionId: string | null = null;
  let environmentSystem: EnvironmentSystem | null = null;
  let performanceRecorder: PerformanceRecorderHandle | null = null;
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
  const terrainShadowCameraPosition = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, 0);
  const performanceDrawingBufferSize = new THREE.Vector2();
  let thirdPersonCameraInitialized = false;
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
    // Per-frame render state is diagnostic-only. Even with notifications
    // disabled, rebuilding the large immutable editor state cost ~30 ms in a
    // real project capture. Initial/explicit renders may still seed the store;
    // live frame metrics are exposed through the root dataset and recorder.
    if (frameMs !== null) return;
    const currentTimeMs = nowMs();
    if (
      frameMs !== null
      && currentTimeMs - lastRenderStoreSyncAtMs < RENDER_STORE_SYNC_INTERVAL_MS
    ) return;
    lastRenderStoreSyncAtMs = currentTimeMs;

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

  function removeOptimisticBlockOverlay(cellKey: string): void {
    const overlay = optimisticBlockOverlays.get(cellKey);
    if (!overlay) return;
    optimisticOverlayRoot?.remove(overlay.mesh);
    optimisticBlockOverlays.delete(cellKey);
  }

  function removeOptimisticBlockOverlaysForChunk(chunkKey: string): void {
    for (const overlay of [...optimisticBlockOverlays.values()]) {
      if (overlay.chunkKey === chunkKey) removeOptimisticBlockOverlay(overlay.cellKey);
    }
    for (const overlay of [...optimisticSemanticOverlays.values()]) {
      if (overlay.chunkKey === chunkKey) removeOptimisticSemanticOverlay(overlay.key);
    }
  }

  function removeOptimisticSemanticOverlay(key: string): void {
    const overlay = optimisticSemanticOverlays.get(key);
    if (!overlay) return;
    optimisticOverlayRoot?.remove(overlay.mesh);
    overlay.geometry.dispose();
    overlay.material.dispose();
    optimisticSemanticOverlays.delete(key);
  }

  function clearOptimisticBlockOverlays(): void {
    for (const cellKey of [...optimisticBlockOverlays.keys()]) {
      removeOptimisticBlockOverlay(cellKey);
    }
    for (const material of optimisticOverlayMaterials.values()) material.dispose();
    optimisticOverlayMaterials.clear();
    for (const key of [...optimisticSemanticOverlays.keys()]) removeOptimisticSemanticOverlay(key);
    optimisticOverlayGeometry?.dispose();
    optimisticOverlayGeometry = null;
  }

  function showOptimisticSemanticOverlay(
    semantic: SceneSemanticPlacement,
    blockTypeId: string,
  ): string | null {
    if (!optimisticOverlayRoot) return null;
    const anchor = semantic.anchorPosition ?? semantic.occupiedCells[0];
    if (!anchor) return null;
    const sample = worldRuntime.sampleCell(anchor);
    const chunk = worldRuntime.getRegistry().getChunk(sample.chunkKey);
    const cellSize = safeNumber(chunk?.cellSize, 1, { min: 0.000001, max: 1_000 });
    const geometry = createSemanticFootprintGeometry(semantic.footprint, anchor.y, cellSize);
    if (!geometry) return null;
    const key = `${sample.chunkKey}:${semanticPlacementFingerprint(semantic)}`;
    removeOptimisticSemanticOverlay(key);
    const paletteEntry = chunk?.paletteByBlockTypeId.get(blockTypeId) ?? null;
    const material = createMaterial(paletteEntry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `optimistic-semantic:${key}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.userData.semanticFootprint = true;
    mesh.userData.optimistic = true;
    optimisticOverlayRoot.add(mesh);
    optimisticSemanticOverlays.set(key, {
      key,
      chunkKey: sample.chunkKey,
      mesh,
      geometry,
      material,
    });
    return key;
  }

  function showOptimisticParametricOverlay(
    position: ChunkWorldPosition,
    placement: ActiveLibraryPlacement,
  ): string | null {
    if (!optimisticOverlayRoot || !placement.semanticProfile || !placement.runtimeBlockTypeId) {
      return null;
    }
    const variables = asRecord(placement.semanticProfile.variables);
    const profileId = safeString(variables["geometry.profile_id"], "")
      .toLowerCase()
      .replace(/-/g, "_");
    if (!profileId) return null;

    const sample = worldRuntime.sampleCell(position);
    const chunk = worldRuntime.getRegistry().getChunk(sample.chunkKey);
    const cellSize = safeNumber(chunk?.cellSize, 1, { min: 0.000001, max: 1_000 });
    const millimetres = (key: string, fallback: number): number => safeNumber(
      variables[key],
      fallback,
      { min: 1, max: 256_000 },
    ) / 1000 * cellSize;
    const heightMode = safeString(variables["geometry.height_mode"], "dimensions").toLowerCase();
    const heightFraction = safeNumber(
      variables["geometry.height_fraction"],
      heightMode === "half" ? 0.5 : 1,
      { min: 0.01, max: 32 },
    );
    const width = Math.max(0.04 * cellSize, Math.min(0.96 * cellSize, millimetres("dimensions.width_mm", 1000)));
    const depth = Math.max(0.035 * cellSize, Math.min(0.96 * cellSize, millimetres("dimensions.depth_mm", 1000)));
    const declaredHeight = millimetres("dimensions.height_mm", profileId === "hinged_door" ? 2000 : 1000);
    const height = profileId === "half_block" || heightMode === "half"
      ? Math.max(0.04 * cellSize, Math.min(cellSize, heightFraction * cellSize))
      : Math.max(0.04 * cellSize, Math.min(profileId === "hinged_door" ? 1.96 * cellSize : 0.96 * cellSize, declaredHeight));
    const renderedDepth = ["hinged_door", "thin_window", "wall_segment"].includes(profileId)
      ? Math.min(depth, 0.16 * cellSize)
      : depth;
    const geometry = new THREE.BoxGeometry(width, height, renderedDepth);
    geometry.translate(
      (Math.floor(position.x) + 0.5) * cellSize,
      Math.floor(position.y) * cellSize + height * 0.5,
      (Math.floor(position.z) + 0.5) * cellSize,
    );
    const paletteEntry = chunk?.paletteByBlockTypeId.get(placement.runtimeBlockTypeId) ?? null;
    const material = createMaterial(paletteEntry);
    if (profileId === "thin_window" && material instanceof THREE.MeshStandardMaterial) {
      material.color.set(0x9bdcf2);
      material.transparent = true;
      material.opacity = 0.48;
      material.depthWrite = false;
    }
    const key = `${sample.chunkKey}:vplib:${Math.floor(position.x)}:${Math.floor(position.y)}:${Math.floor(position.z)}`;
    removeOptimisticSemanticOverlay(key);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `optimistic-vplib:${profileId}:${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.userData.vplibParametric = true;
    mesh.userData.vplibProfileId = profileId;
    mesh.userData.optimistic = true;
    optimisticOverlayRoot.add(mesh);
    optimisticSemanticOverlays.set(key, {
      key,
      chunkKey: sample.chunkKey,
      mesh,
      geometry,
      material,
    });
    return key;
  }

  function showOptimisticBlockOverlay(edit: PendingOptimisticBlockEdit): void {
    if (!edit.blockTypeId || !optimisticOverlayRoot) return;
    removeOptimisticBlockOverlay(edit.cellKey);
    const registry = worldRuntime.getRegistry();
    const chunk = registry.getChunk(edit.chunkKey);
    const cellSize = safeNumber(chunk?.cellSize, 1, { min: 0.000001, max: 1_000 });
    optimisticOverlayGeometry ??= new THREE.BoxGeometry(1, 1, 1);
    let material = optimisticOverlayMaterials.get(edit.blockTypeId);
    if (!material) {
      const appearance = getMaterialAppearance(edit.blockTypeId)
        ?? fallbackMaterialAppearance(edit.blockTypeId);
      material = new THREE.MeshStandardMaterial({
        color: appearance?.color ?? edit.color ?? "#64748b",
        roughness: appearance?.roughness ?? 0.88,
        metalness: appearance?.metalness ?? 0.02,
      });
      applyMaterialAppearance(material, appearance);
      optimisticOverlayMaterials.set(edit.blockTypeId, material);
    }
    const mesh = new THREE.Mesh(optimisticOverlayGeometry, material);
    mesh.name = `optimistic-block:${edit.cellKey}`;
    mesh.position.set(
      (edit.position.x + 0.5) * cellSize,
      (edit.position.y + 0.5) * cellSize,
      (edit.position.z + 0.5) * cellSize,
    );
    mesh.scale.setScalar(cellSize * 0.998);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    optimisticOverlayRoot.add(mesh);
    optimisticBlockOverlays.set(edit.cellKey, {
      cellKey: edit.cellKey,
      chunkKey: edit.chunkKey,
      mesh,
    });
  }

  function clearChunkMeshes(): void {
    try {
      chunkMeshBuildGeneration += 1;
      const idleWindow = window as SceneIdleWindow;
      if (chunkMeshIdleCallbackId !== null) {
        idleWindow.cancelIdleCallback?.(chunkMeshIdleCallbackId);
        chunkMeshIdleCallbackId = null;
      }
      if (chunkMeshFallbackTimerId !== null) {
        window.clearTimeout(chunkMeshFallbackTimerId);
        chunkMeshFallbackTimerId = null;
      }
      pendingChunkMeshKeys.length = 0;
      pendingChunkMeshKeySet.clear();
      wantedChunkMeshKeys = new Set<string>();
      visibleChunkMeshKeys = new Set<string>();
      warmedChunkMeshKeys.clear();
      optimisticChunkMeshKeys.clear();
      pendingOptimisticMeshChunkKeys.clear();
      if (optimisticMeshTimerId !== null) {
        window.clearTimeout(optimisticMeshTimerId);
        optimisticMeshTimerId = null;
      }
      clearOptimisticBlockOverlays();
      lastChunkMeshProgressCommitAtMs = 0;

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
      terrainShadowCastersDirty = true;
    } catch (error) {
      logWarn(logger, "Chunk mesh cleanup failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function chunkBoundaryRevisionTokens(chunk: RuntimeChunkContent): readonly string[] {
    const cached = chunkBoundaryRevisionCache.get(chunk);
    if (cached) return cached;
    const size = chunk.chunkSize;
    const tokens: string[] = [];
    const faces = [
      [0, false], [0, true],
      [1, false], [1, true],
      [2, false], [2, true],
    ] as const;
    for (const [axis, positive] of faces) {
      const fixed = positive ? size - 1 : 0;
      let hash = 2166136261;
      for (let v = 0; v < size; v += 1) {
        for (let u = 0; u < size; u += 1) {
          const x = axis === 0 ? fixed : u;
          const y = axis === 1 ? fixed : axis === 0 ? u : v;
          const z = axis === 2 ? fixed : axis === 0 ? v : axis === 1 ? v : u;
          const solid = Number(chunk.cells[localCellIndex(x, y, z, size)] ?? 0) > 0 ? 1 : 0;
          hash = Math.imul(hash ^ solid, 16777619);
        }
      }
      tokens.push((hash >>> 0).toString(36));
    }
    chunkBoundaryRevisionCache.set(chunk, tokens);
    return tokens;
  }

  function chunkMeshRevisionToken(chunk: RuntimeChunkContent): string {
    const registry = worldRuntime.getRegistry();
    const selfRevision = `${chunk.chunkRevision ?? chunk.chunkVersion ?? "unversioned"}:${chunk.loadedAt}`;
    const neighborFaces = [
      [-1, 0, 0, 1], [1, 0, 0, 0],
      [0, -1, 0, 3], [0, 1, 0, 2],
      [0, 0, -1, 5], [0, 0, 1, 4],
    ] as const;
    const neighborRevisions = neighborFaces.map(([offsetX, offsetY, offsetZ, faceIndex]) => {
      const neighbor = registry.getChunk(chunkKeyFromCoordinatesLocal({
        chunkX: chunk.chunkX + offsetX,
        chunkY: chunk.chunkY + offsetY,
        chunkZ: chunk.chunkZ + offsetZ,
      }));
      return neighbor
        ? chunkBoundaryRevisionTokens(neighbor)[faceIndex]
        : "missing";
    });
    const roofVersions = lod2RoofsForChunk(chunk).map(({id,calculation}) => `${id}:${asRecord(calculation).input_fingerprint ?? asRecord(calculation).calculation_id}`);
    return [selfRevision, ...neighborRevisions, ...roofVersions].join("|");
  }

  const lod2RoofIndex = createLod2RoofIndex(semanticObjectRefs);
  function lod2RoofsForChunk(chunk: RuntimeChunkContent): readonly {id:string;buildingId:string;calculation:unknown;
    facadeSegments:readonly unknown[];repairFacadeRoofSeams:boolean}[] {
    return lod2RoofIndex.query(worldRuntime.getRegistry(),chunk).map(({ref,revision})=>{
      const importedSource=asRecord(asRecord(ref.metadata.roofParameters).importedSource);
      return {
        id:ref.objectInstanceId,
        buildingId:safeString(ref.metadata.lod2BuildingId,ref.objectInstanceId),
        calculation:roofCalculationForScene(ref.objectInstanceId,ref.metadata.roofCalculation,revision),
        facadeSegments:asArray(importedSource.facadeSegments),
        repairFacadeRoofSeams:importedSource.facadeProfileMode==='roof-clamped-v1',
      };
    });
  }

  function createChunkBoundaryMasks(chunk: RuntimeChunkContent): ChunkMeshBoundaryMasks {
    const size = chunk.chunkSize;
    const registry = worldRuntime.getRegistry();

    function face(
      offsetX: number,
      offsetY: number,
      offsetZ: number,
      axis: 0 | 1 | 2,
      positive: boolean,
    ): Uint8Array {
      const mask = new Uint8Array(size * size);
      const neighbor = registry.getChunk(chunkKeyFromCoordinatesLocal({
        chunkX: chunk.chunkX + offsetX,
        chunkY: chunk.chunkY + offsetY,
        chunkZ: chunk.chunkZ + offsetZ,
      }));
      if (!neighbor || neighbor.chunkSize !== size) return mask;
      const fixed = positive ? 0 : size - 1;
      for (let v = 0; v < size; v += 1) {
        for (let u = 0; u < size; u += 1) {
          const x = axis === 0 ? fixed : u;
          const y = axis === 1 ? fixed : axis === 0 ? u : v;
          const z = axis === 2 ? fixed : axis === 0 ? v : axis === 1 ? v : u;
          const value = Number(neighbor.cells[localCellIndex(x, y, z, size)] ?? 0);
          mask[u + v * size] = value > 0 ? 1 : 0;
        }
      }
      return mask;
    }

    return {
      negativeX: face(-1, 0, 0, 0, false),
      positiveX: face(1, 0, 0, 0, true),
      negativeY: face(0, -1, 0, 1, false),
      positiveY: face(0, 1, 0, 1, true),
      negativeZ: face(0, 0, -1, 2, false),
      positiveZ: face(0, 0, 1, 2, true),
    };
  }

  function scheduleSemanticMigration(delayMs = 500): void {
    if (destroyed || semanticMigrationInFlight || semanticMigrationTimerId !== null
      || pendingSemanticMigrations.size === 0) return;
    semanticMigrationTimerId = window.setTimeout(() => {
      semanticMigrationTimerId = null;
      void flushSemanticMigrations();
    }, delayMs);
  }

  function enqueueSemanticMigration(
    chunkKey: string,
    position: ChunkApiWorldPosition,
    blockTypeId: string,
    semantic: SceneSemanticPlacement,
    objectInstanceId: string | null = null,
  ): void {
    const key = [
      position.x,
      position.y,
      position.z,
      objectInstanceId ?? "legacy-set-block",
      semanticPlacementFingerprint(semantic),
    ].join(":");
    if (settledSemanticMigrationKeys.has(key) || pendingSemanticMigrations.has(key)) return;
    pendingSemanticMigrations.set(key, {
      key,
      chunkKey,
      position,
      blockTypeId,
      semantic,
      objectInstanceId,
      attempts: 0,
    });
    refs.root.dataset.sceneRuntimePendingSemanticMigrations = String(pendingSemanticMigrations.size);
    scheduleSemanticMigration();
  }

  async function flushSemanticMigrations(): Promise<void> {
    if (destroyed || semanticMigrationInFlight || pendingSemanticMigrations.size === 0) return;
    // Do not compete with camera streaming/mesh preparation. The conversion is
    // persistent metadata work and can safely wait until the visible geometry
    // is ready.
    if (pendingChunkMeshKeys.length > 0 || chunkMeshBuildInFlight || blockCommandsInFlight > 0) {
      scheduleSemanticMigration(350);
      return;
    }
    semanticMigrationInFlight = true;
    refs.root.dataset.sceneRuntimeSemanticMigrationBusy = "true";
    let migratedCount = 0;
    let failedCount = 0;
    try {
      const source = worldRuntime.getSource();
      const batch = [...pendingSemanticMigrations.values()].slice(0, 24);
      for (const migration of batch) {
        if (destroyed) break;
        const payload: ChunkApiCommandPayload = {
          type: "PlaceObject",
          userId: "editor_user",
          sessionId: "parcel_grid_geometry_migration",
          ...(migration.objectInstanceId ? { objectInstanceId: migration.objectInstanceId } : {}),
          position: migration.position,
          blockTypeId: migration.blockTypeId,
          objectTypeId: "parcel_grid_body",
          objectKind: "semantic_footprint",
          dimensions: { x: 1, y: 1, z: 1 },
          footprint: migration.semantic.footprint,
          occupiedCells: migration.semantic.occupiedCells,
          metadata: {
            schemaVersion: "vectoplan-parcel-grid-body.v1",
            mergeKey: migration.semantic.mergeKey,
            migratedFrom: "legacy-set-block",
            sourceChunkKey: migration.chunkKey,
          },
        };
        const result = await source.sendCommand(payload, {
          reason: "scene-runtime.persist-parcel-grid-geometry",
          reloadDirtyChunks: false,
        });
        if (isChunkApiFailedResult(result)) {
          migration.attempts += 1;
          failedCount += 1;
          logWarn(logger, "Persistent parcel-grid migration failed.", {
            position: migration.position,
            blockTypeId: migration.blockTypeId,
            objectInstanceId: migration.objectInstanceId,
            attempt: migration.attempts,
            error: result.error,
          });
          // A failed write is not settled. Keep a bounded retry in the idle
          // queue; after three attempts a later remesh may enqueue it again.
          if (migration.attempts >= 3) pendingSemanticMigrations.delete(migration.key);
          continue;
        }
        pendingSemanticMigrations.delete(migration.key);
        settledSemanticMigrationKeys.add(migration.key);
        migratedCount += 1;
        const commandResult = commandResultFromUnknown(result);
        for (const key of commandResult?.changedChunks ?? []) blockReconcileChunkKeys.add(key);
      }
      if (migratedCount > 0) scheduleBlockCommandReconcile("scene-runtime.persist-parcel-grid-geometry");
      refs.root.dataset.sceneRuntimeSemanticMigrationsPersisted = String(
        safeInteger(refs.root.dataset.sceneRuntimeSemanticMigrationsPersisted, 0, { min: 0 }) + migratedCount,
      );
      refs.root.dataset.sceneRuntimeSemanticMigrationFailures = String(
        safeInteger(refs.root.dataset.sceneRuntimeSemanticMigrationFailures, 0, { min: 0 }) + failedCount,
      );
    } finally {
      semanticMigrationInFlight = false;
      refs.root.dataset.sceneRuntimeSemanticMigrationBusy = "false";
      refs.root.dataset.sceneRuntimePendingSemanticMigrations = String(pendingSemanticMigrations.size);
      if (!destroyed && pendingSemanticMigrations.size > 0) scheduleSemanticMigration(120);
    }
  }

  async function buildChunkMeshRecord(chunk: RuntimeChunkContent): Promise<ChunkMeshRecord> {
    const persistedSemanticRefs = semanticObjectRefs(chunk).map((ref) => {
      if (!shouldAdaptSemanticObjectToParcelGrid(ref)) return ref;
      if (!placementGeometryHandler) return ref;
      const anchor = ref.occupiedCells[0];
      if (!anchor) return ref;
      const currentGeometry = placementGeometryHandler(anchor, { currentFootprint: ref.footprint });
      if (!currentGeometry || currentGeometry.kind !== "parcel-grid-prism.v1") return ref;
      if (semanticPlacementFingerprint(ref) !== semanticPlacementFingerprint(currentGeometry)
        && ref.fillBlockTypeId) {
        enqueueSemanticMigration(
          chunk.chunkKey,
          anchor,
          ref.fillBlockTypeId,
          currentGeometry,
          ref.objectInstanceId,
        );
      }
      return {
        ...ref,
        footprint: currentGeometry.footprint,
        occupiedCells: currentGeometry.occupiedCells,
        mergeKey: currentGeometry.mergeKey,
      };
    });
    const persistedCells = new Set(persistedSemanticRefs.flatMap((ref) => ref.occupiedCells.map(
      (position) => `${position.x}:${position.y}:${position.z}`,
    )));
    const transientSemanticRefs: SemanticChunkObjectRef[] = [];
    if (placementGeometryHandler) {
      for (let index = 0; index < chunk.cells.length; index += 1) {
        const cellValue = safeInteger(chunk.cells[index], 0, { min: 0, max: Number.MAX_SAFE_INTEGER });
        if (cellValue <= 0) continue;
        const paletteEntry = chunk.paletteByCellValue.get(cellValue) ?? null;
        const normalizedBlockTypeId = paletteEntry?.blockTypeId.trim().toLowerCase() ?? "";
        if (!paletteEntry?.placeable || !paletteEntry.breakable
          || !shouldAdaptBlockToParcelGrid(normalizedBlockTypeId)) continue;
        const localX = index % chunk.chunkSize;
        const localY = Math.floor(index / chunk.chunkSize) % chunk.chunkSize;
        const localZ = Math.floor(index / (chunk.chunkSize * chunk.chunkSize));
        const position = {
          x: chunk.chunkX * chunk.chunkSize + localX,
          y: chunk.chunkY * chunk.chunkSize + localY,
          z: chunk.chunkZ * chunk.chunkSize + localZ,
        };
        if (persistedCells.has(`${position.x}:${position.y}:${position.z}`)) continue;
        const semantic = placementGeometryHandler(position);
        if (!semantic || semantic.kind !== "parcel-grid-prism.v1") continue;
        enqueueSemanticMigration(chunk.chunkKey, position, paletteEntry.blockTypeId, semantic);
        transientSemanticRefs.push({
          objectInstanceId: `legacy-grid:${position.x}:${position.y}:${position.z}`,
          objectTypeId: "parcel_grid_body",
          objectVariantId: "default",
          objectKind: "semantic_footprint",
          primaryChunkKey: chunk.chunkKey,
          fillBlockTypeId: paletteEntry.blockTypeId,
          anchor: position,
          dimensions: { x: 1, y: 1, z: 1 },
          footprint: semantic.footprint,
          occupiedCells: semantic.occupiedCells,
          mergeKey: semantic.mergeKey,
          metadata: {},
        });
      }
    }
    const semanticRefs = [
      ...persistedSemanticRefs.filter(shouldRenderSemanticFootprint),
      ...transientSemanticRefs,
    ];
    const capsStartedAtMs = nowMs();
    const caps = trimLod2WallCaps(chunkWithoutSemanticObjectCells(chunk, semanticRefs), lod2RoofsForChunk(chunk),
      (x,y,z)=>Number(worldRuntime.sampleCell({x,y,z}).cellValue)>0);
    performanceRecorder?.recordEvent("chunk-mesh", "wall-caps", nowMs()-capsStartedAtMs,
      {chunkKey:chunk.chunkKey,cells:caps.cappedCellIndices.length,alignedCells:caps.alignedCellIndices.length,
        triangles:(caps.geometry?.getAttribute('position').count??0)/3});
    const meshingChunk = caps.chunk;
    if (!chunkMeshWorkerClient) {
      const record = createChunkMeshRecord(meshingChunk, (worldX, worldY, worldZ) => {
        const sample = worldRuntime.sampleCell({ x: worldX, y: worldY, z: worldZ });
        return sample.chunkLoaded && isNonAirOccluder(sample.cellValue);
      });
      return appendLod2WallCaps(appendSemanticObjectMeshes(record, chunk, semanticRefs), caps);
    }

    try {
      const result = await chunkMeshWorkerClient.build({
        chunkKey: chunk.chunkKey,
        chunkX: chunk.chunkX,
        chunkY: chunk.chunkY,
        chunkZ: chunk.chunkZ,
        chunkSize: chunk.chunkSize,
        cellSize: safeNumber(chunk.cellSize, 1, { min: 0.000001, max: 1_000 }),
        cells: Int32Array.from(meshingChunk.cells),
        boundaries: createChunkBoundaryMasks(meshingChunk),
      });
      refs.root.dataset.sceneRuntimeLastChunkWorkerBuildMs = result.buildMs.toFixed(2);
      const conversionStartedAtMs = nowMs();
      const record = createChunkMeshRecordFromWorkerResult(meshingChunk, result);
      performanceRecorder?.recordEvent(
        "chunk-mesh",
        "worker-result-convert",
        nowMs() - conversionStartedAtMs,
        {
          chunkKey: chunk.chunkKey,
          workerBuildMs: result.buildMs,
          bufferCount: result.buffers.length,
          quadCount: result.quadCount,
        },
      );
      return appendLod2WallCaps(appendSemanticObjectMeshes(record, chunk, semanticRefs), caps);
    } catch (error) {
      if (destroyed) throw error;
      refs.root.dataset.sceneRuntimeChunkMeshingThread = "main-thread-fallback";
      logWarn(logger, "Chunk mesh worker build failed; using synchronous fallback.", {
        chunkKey: chunk.chunkKey,
        error: normalizeUnknownError(error),
      });
      chunkMeshWorkerClient?.destroy();
      chunkMeshWorkerClient = null;
      const record = createChunkMeshRecord(meshingChunk, (worldX, worldY, worldZ) => {
        const sample = worldRuntime.sampleCell({ x: worldX, y: worldY, z: worldZ });
        return sample.chunkLoaded && isNonAirOccluder(sample.cellValue);
      });
      return appendLod2WallCaps(appendSemanticObjectMeshes(record, chunk, semanticRefs), caps);
    }
  }

  function installChunkMeshRecord(chunk: RuntimeChunkContent, record: ChunkMeshRecord): void {
    if (!chunksRoot) {
      disposeObject3D(record.group);
      return;
    }
    const existing = chunkMeshes.get(chunk.chunkKey);
    const optimisticEdit = optimisticChunkMeshKeys.delete(chunk.chunkKey);
    const deferShadowRefresh = running || optimisticEdit;
    let keepCastingShadow = existing?.meshes.some((mesh) => mesh.castShadow) ?? false;
    if (deferShadowRefresh && camera) {
      const cellSize = safeNumber(chunk.cellSize, 1, { min: 0.000001, max: 1_000 });
      const centerX = (chunk.chunkX * chunk.chunkSize + (chunk.chunkSize / 2)) * cellSize;
      const centerZ = (chunk.chunkZ * chunk.chunkSize + (chunk.chunkSize / 2)) * cellSize;
      const distanceX = centerX - camera.position.x;
      const distanceZ = centerZ - camera.position.z;
      keepCastingShadow = (distanceX * distanceX) + (distanceZ * distanceZ)
        <= TERRAIN_SHADOW_CAST_DISTANCE ** 2;
    }
    if (deferShadowRefresh) {
      for (const mesh of record.meshes) mesh.castShadow = keepCastingShadow;
    }
    if (existing) {
      chunksRoot.remove(existing.group);
      disposeObject3D(existing.group);
      chunkMeshes.delete(chunk.chunkKey);
    }
    chunksRoot.add(record.group);
    chunkMeshes.set(chunk.chunkKey, record);
    removeOptimisticBlockOverlaysForChunk(chunk.chunkKey);
    if (deferShadowRefresh) scheduleBlockShadowRefresh();
    else terrainShadowCastersDirty = true;
  }

  function chunkRoofMeshesAreCurrent(record: ChunkMeshRecord): boolean {
    const checkedRoofIds = new Set<string>();
    for (const mesh of record.meshes) {
      if (mesh.userData.semanticRoof !== true) continue;
      const ref = asRecord(mesh.userData.semanticObjectRef);
      const objectInstanceId = safeString(
        mesh.userData.objectInstanceId ?? ref.objectInstanceId,
        "",
      );
      if (!objectInstanceId || checkedRoofIds.has(objectInstanceId)) continue;
      checkedRoofIds.add(objectInstanceId);
      if (!isRenderedRoofCalculationCurrent(
        objectInstanceId,
        mesh.userData.roofCalculationVersion,
      )) return false;
    }
    return true;
  }

  function enqueueChunkMeshKey(chunkKey: string, highPriority = false): void {
    if (!chunkKey) return;
    if (pendingChunkMeshKeySet.has(chunkKey)) {
      if (highPriority) {
        const existingIndex = pendingChunkMeshKeys.indexOf(chunkKey);
        if (existingIndex > 0) {
          pendingChunkMeshKeys.splice(existingIndex, 1);
          pendingChunkMeshKeys.unshift(chunkKey);
        }
      }
      return;
    }

    pendingChunkMeshKeySet.add(chunkKey);
    if (highPriority) pendingChunkMeshKeys.unshift(chunkKey);
    else pendingChunkMeshKeys.push(chunkKey);
    chunkMeshQueueHighWaterMark = Math.max(
      chunkMeshQueueHighWaterMark,
      pendingChunkMeshKeys.length,
    );
  }

  function commitChunkMeshProgress(reason: string): void {
    if (running || /optimistic-block-edit/i.test(reason)) scheduleBlockShadowRefresh();
    else terrainShadowCastersDirty = true;
    meshCount = [...chunkMeshes.values()].reduce(
      (sum, record) => sum + record.meshes.length,
      0,
    );
    materialCount = [...chunkMeshes.values()].reduce(
      (sum, record) => sum + record.materials.length,
      0,
    );
    refs.root.dataset.sceneRuntimeSemanticMeshCount = String(
      [...chunkMeshes.values()].reduce(
        (sum, record) => sum + record.meshes.filter((mesh) => mesh.userData.semanticFootprint === true).length,
        0,
      ),
    );
    const quadCount = [...chunkMeshes.values()].reduce(
      (sum, record) => sum + record.quadCount,
      0,
    );
    const triangleCount = [...chunkMeshes.values()].reduce(
      (sum, record) => sum + record.triangleCount,
      0,
    );
    refs.root.dataset.sceneRuntimeRenderedChunkCount = String(chunkMeshes.size);
    refs.root.dataset.sceneRuntimeMeshCount = String(meshCount);
    refs.root.dataset.sceneRuntimeQuadCount = String(quadCount);
    refs.root.dataset.sceneRuntimeTriangleCount = String(triangleCount);
    refs.root.dataset.sceneRuntimeChunkMeshQueueDepth = String(pendingChunkMeshKeys.length);
    refs.root.dataset.sceneRuntimeChunkMeshQueueHighWaterMark = String(chunkMeshQueueHighWaterMark);
    refs.root.dataset.sceneRuntimeChunkMeshingMode = "idle-budgeted";
    refs.root.dataset.earthTerrainSpawnPrepared = String(earthTerrainSpawnPrepared);
    refs.root.dataset.earthTerrainSurfaceY = earthTerrainSurfaceY === null
      ? ""
      : String(earthTerrainSurfaceY);
    refs.root.dataset.earthTerrainStreamingChunkY = earthStreamingChunkY === null
      ? ""
      : String(earthStreamingChunkY);
    lastRenderedAt = now();
    renderCount += 1;

    if (!running) {
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
          notify: false,
          captureHistory: false,
        },
      );
    }

    logDebug(logger, "Scene chunk mesh progress committed.", {
      reason,
      chunkCount: chunkMeshes.size,
      pendingChunkMeshCount: pendingChunkMeshKeys.length,
      meshCount,
      materialCount,
      quadCount,
      triangleCount,
    });
    startPhysicsWhenWorldReady(reason);
  }

  function updateTerrainShadowCasters(timestampMs: number, force = false): void {
    if (!camera || !renderer) return;
    const cameraMoved = !Number.isFinite(terrainShadowCameraPosition.x)
      || terrainShadowCameraPosition.distanceToSquared(camera.position)
        >= TERRAIN_SHADOW_CAMERA_MOVE_DISTANCE ** 2;
    if (
      !force
      && !cameraMoved
      && !terrainShadowCastersDirty
    ) return;

    const registry = worldRuntime.getRegistry();
    const maximumDistanceSquared = TERRAIN_SHADOW_CAST_DISTANCE ** 2;
    let casterMeshCount = 0;
    let changed = false;

    for (const [chunkKey, record] of chunkMeshes.entries()) {
      const chunk = registry.getChunk(chunkKey);
      const cellSize = safeNumber(chunk?.cellSize, 1, { min: 0.000001, max: 1_000 });
      const chunkSize = safeInteger(chunk?.chunkSize, 16, { min: 1, max: 256 });
      const centerX = ((chunk?.chunkX ?? 0) * chunkSize + (chunkSize / 2)) * cellSize;
      const centerZ = ((chunk?.chunkZ ?? 0) * chunkSize + (chunkSize / 2)) * cellSize;
      const distanceX = centerX - camera.position.x;
      const distanceZ = centerZ - camera.position.z;
      const shouldCast = record.group.visible
        && ((distanceX * distanceX) + (distanceZ * distanceZ) <= maximumDistanceSquared);

      for (const mesh of record.meshes) {
        if (mesh.castShadow !== shouldCast) {
          mesh.castShadow = shouldCast;
          changed = true;
        }
        if (shouldCast) casterMeshCount += 1;
      }
    }

    if (changed) renderer.shadowMap.needsUpdate = true;
    terrainShadowCameraPosition.copy(camera.position);
    lastTerrainShadowCasterUpdateAtMs = timestampMs;
    terrainShadowCastersDirty = false;
    terrainShadowScanCount += 1;
    if (changed) terrainShadowChangeCount += 1;
    terrainShadowCasterMeshCount = casterMeshCount;
    refs.root.dataset.sceneRuntimeShadowCasterMeshCount = String(casterMeshCount);
    refs.root.dataset.sceneRuntimeShadowCastDistance = String(TERRAIN_SHADOW_CAST_DISTANCE);
  }

  async function processChunkMeshQueue(deadline?: SceneIdleDeadline): Promise<void> {
    if (
      destroyed
      || !chunksRoot
      || pendingChunkMeshKeys.length === 0
      || chunkMeshBuildInFlight
    ) return;

    const registry = worldRuntime.getRegistry();
    let processedCount = 0;
    let changed = false;
    const buildGeneration = chunkMeshBuildGeneration;

    while (
      pendingChunkMeshKeys.length > 0
      && processedCount < MAX_CHUNK_MESHES_PER_IDLE_SLICE
    ) {
      if (
        deadline
        && !deadline.didTimeout
        && deadline.timeRemaining() < MIN_CHUNK_MESH_IDLE_BUDGET_MS
      ) {
        break;
      }

      const key = pendingChunkMeshKeys.shift();
      if (!key) break;
      pendingChunkMeshKeySet.delete(key);

      const chunk = registry.getChunk(key);
      const existing = chunkMeshes.get(key);
      const wanted = wantedChunkMeshKeys.has(key);
      const visible = visibleChunkMeshKeys.has(key);

      if (!chunk) {
        warmedChunkMeshKeys.delete(key);
        if (existing) {
          chunksRoot.remove(existing.group);
          disposeObject3D(existing.group);
          chunkMeshes.delete(key);
          changed = true;
        }
        processedCount += 1;
        continue;
      }

      // Loaded chunks keep their prepared GPU mesh while they are outside the
      // current view. Re-entering a cached area must only toggle visibility,
      // not rebuild thousands of instances again.
      if (!wanted) {
        if (existing) existing.group.visible = false;
        processedCount += 1;
        continue;
      }

      const existingRevision = existing?.group.userData.chunkRevision;
      const nextRevision = chunkMeshRevisionToken(chunk);
      if (existing && existingRevision === nextRevision) {
        existing.group.visible = visible;
        processedCount += 1;
        continue;
      }

      chunkMeshBuildInFlight = true;
      refs.root.dataset.sceneRuntimeChunkMeshWorkerBusy = "true";
      let builtRecord: ChunkMeshRecord | null = null;
      try {
        builtRecord = await buildChunkMeshRecord(chunk);
      } catch (error) {
        if (!destroyed) {
          logWarn(logger, "Chunk mesh build failed.", {
            chunkKey: key,
            error: normalizeUnknownError(error),
          });
        }
        return;
      } finally {
        chunkMeshBuildInFlight = false;
        refs.root.dataset.sceneRuntimeChunkMeshWorkerBusy = "false";
      }
      if (
        !builtRecord
        || destroyed
        || buildGeneration !== chunkMeshBuildGeneration
        || !chunksRoot
      ) {
        if (builtRecord) disposeObject3D(builtRecord.group);
        return;
      }
      const latestChunk = registry.getChunk(key);
      if (!latestChunk || chunkMeshRevisionToken(latestChunk) !== nextRevision) {
        disposeObject3D(builtRecord.group);
        enqueueChunkMeshKey(key, true);
        processedCount += 1;
        continue;
      }
      if (pendingChunkMeshKeySet.has(key)) {
        // A new invalidation for this same chunk arrived while its worker build
        // was in flight. Installing the superseded result for even one frame
        // causes a visible old -> new geometry flash.
        disposeObject3D(builtRecord.group);
        processedCount += 1;
        continue;
      }
      if (!chunkRoofMeshesAreCurrent(builtRecord)) {
        // This record may have started building before the roof save registered
        // its optimistic result. Rebuild it against the current calculation;
        // never expose the prepared old geometry in the meantime.
        disposeObject3D(builtRecord.group);
        enqueueChunkMeshKey(key, true);
        processedCount += 1;
        continue;
      }
      const installStartedAtMs = nowMs();
      const optimisticInstall = optimisticChunkMeshKeys.has(chunk.chunkKey);
      installChunkMeshRecord(chunk, builtRecord);
      performanceRecorder?.recordEvent(
        "chunk-mesh",
        "install",
        nowMs() - installStartedAtMs,
        {
          chunkKey: chunk.chunkKey,
          meshCount: builtRecord.meshes.length,
          quadCount: builtRecord.quadCount,
          optimistic: optimisticInstall,
        },
      );
      builtRecord.group.userData.chunkRevision = nextRevision;
      builtRecord.group.visible = visibleChunkMeshKeys.has(key);
      changed = true;
      processedCount += 1;
    }

    refs.root.dataset.sceneRuntimeChunkMeshQueueDepth = String(pendingChunkMeshKeys.length);
    if (changed) {
      const currentTimeMs = nowMs();
      const shouldCommitProgress = pendingChunkMeshKeys.length === 0
        || currentTimeMs - lastChunkMeshProgressCommitAtMs >= CHUNK_MESH_PROGRESS_COMMIT_INTERVAL_MS;
      if (shouldCommitProgress) {
        lastChunkMeshProgressCommitAtMs = currentTimeMs;
        commitChunkMeshProgress(lastChunkMeshQueueReason);
      }
      // During boot the overlay is the only useful visual. Rendering the full
      // scene once per newly meshed chunk caused the very startup freeze the
      // warmup is meant to hide.
      if (!running && pendingChunkMeshKeys.length === 0) {
        renderOnce("scene-runtime.chunk-mesh-queue-complete");
      }
    }
  }

  function scheduleBlockShadowRefresh(): void {
    if (destroyed) return;
    if (blockShadowRefreshTimerId !== null) {
      window.clearTimeout(blockShadowRefreshTimerId);
    }
    // Rebuilding the shadow map on every click creates a visible GPU hitch.
    // Keep the geometry immediate and refresh its shadow once the click burst
    // has been quiet for a moment.
    blockShadowRefreshTimerId = window.setTimeout(() => {
      blockShadowRefreshTimerId = null;
      if (destroyed) return;
      terrainShadowCastersDirty = true;
      if (renderer) renderer.shadowMap.needsUpdate = true;
    }, 120);
  }

  function scheduleChunkMeshProcessing(): void {
    if (
      destroyed
      || pendingChunkMeshKeys.length === 0
      || chunkMeshBuildInFlight
      || chunkMeshIdleCallbackId !== null
      || chunkMeshFallbackTimerId !== null
    ) return;

    const idleWindow = window as SceneIdleWindow;
    if (typeof idleWindow.requestIdleCallback === "function") {
      chunkMeshIdleCallbackId = idleWindow.requestIdleCallback((deadline) => {
        chunkMeshIdleCallbackId = null;
        void processChunkMeshQueue(deadline).finally(() => {
          if (pendingChunkMeshKeys.length > 0) scheduleChunkMeshProcessing();
        });
      }, { timeout: CHUNK_MESH_IDLE_TIMEOUT_MS });
      return;
    }

    chunkMeshFallbackTimerId = window.setTimeout(() => {
      chunkMeshFallbackTimerId = null;
      void processChunkMeshQueue({
        didTimeout: true,
        timeRemaining: () => 0,
      }).finally(() => {
        if (pendingChunkMeshKeys.length > 0) scheduleChunkMeshProcessing();
      });
    }, 16);
  }

  function scheduleOptimisticBlockMesh(
    edit: OptimisticBlockEditResult,
    reason: string,
  ): void {
    if (!edit.changed || destroyed) return;
    scheduleGeodataOverlaySync(reason);
    lastChunkMeshQueueReason = reason;
    for (const key of edit.affectedMeshChunkKeys) {
      if (!worldRuntime.getRegistry().hasChunk(key)) continue;
      optimisticChunkMeshKeys.add(key);
      pendingOptimisticMeshChunkKeys.add(key);
    }
    refs.root.dataset.sceneRuntimeChunkMeshQueueDepth = String(
      pendingChunkMeshKeys.length + pendingOptimisticMeshChunkKeys.size,
    );
    if (optimisticMeshTimerId !== null) window.clearTimeout(optimisticMeshTimerId);
    optimisticMeshTimerId = window.setTimeout(() => {
      optimisticMeshTimerId = null;
      if (destroyed) return;
      const batchKeys = [...pendingOptimisticMeshChunkKeys];
      pendingOptimisticMeshChunkKeys.clear();
      for (const key of batchKeys) enqueueChunkMeshKey(key, true);
      performanceRecorder?.recordEvent(
        "block-mesh-batch",
        "flush",
        0,
        { chunkCount: batchKeys.length, reason },
      );
      if (chunkMeshBuildInFlight) return;
      const idleWindow = window as SceneIdleWindow;
      if (chunkMeshIdleCallbackId !== null) {
        idleWindow.cancelIdleCallback?.(chunkMeshIdleCallbackId);
        chunkMeshIdleCallbackId = null;
      }
      if (chunkMeshFallbackTimerId !== null) {
        window.clearTimeout(chunkMeshFallbackTimerId);
        chunkMeshFallbackTimerId = null;
      }
      void processChunkMeshQueue({ didTimeout: true, timeRemaining: () => 16 })
        .finally(() => {
          if (pendingChunkMeshKeys.length > 0) scheduleChunkMeshProcessing();
        });
    }, BLOCK_EDIT_MESH_QUIET_MS);
  }

  function syncGeodataOverlays(reason: string): void {
    if (destroyed || !geodataOverlayScene) return;
    const syncStartedAtMs = nowMs();
    const stats = geodataOverlayScene.syncFromRegistry(
      worldRuntime.getRegistry(),
      reason,
    );
    performanceRecorder?.recordEvent(
      "geodata-overlay",
      "sync",
      nowMs() - syncStartedAtMs,
      {
        reason,
        overlayCount: stats.overlayCount,
        surfaceCellCount: stats.surfaceCellCount,
        renderedSegmentCount: stats.renderedSegmentCount,
      },
    );
    refs.root.dataset.sceneRuntimeGeodataOverlayCount = String(stats.overlayCount);
    refs.root.dataset.sceneRuntimeGeodataOverlayTileCount = String(stats.tileCount);
    refs.root.dataset.sceneRuntimeGeodataOverlaySegmentCount = String(
      stats.renderedSegmentCount,
    );
    refs.root.dataset.sceneRuntimeGeodataOverlayStatus =
      geodataOverlayScene.getSnapshot().status;
  }

  function scheduleGeodataOverlaySync(reason: string): void {
    if (destroyed || !geodataOverlayScene) return;
    geodataOverlaySyncReason = reason;
    if (geodataOverlaySyncTimerId !== null) {
      window.clearTimeout(geodataOverlaySyncTimerId);
    }
    geodataOverlaySyncTimerId = window.setTimeout(() => {
      geodataOverlaySyncTimerId = null;
      syncGeodataOverlays(geodataOverlaySyncReason);
    }, 50);
  }

  function renderChunksFromRegistry(reason: string): void {
    try {
      terrainShadowCastersDirty = true;
      const registry = worldRuntime.getRegistry();
      scheduleGeodataOverlaySync(reason);
      const visibleKeys = registry.getVisibleChunkKeys();
      const loadedKeys = registry.getChunkKeys();
      const keys = visibleKeys.length > 0 ? visibleKeys : loadedKeys;
      const visible = new Set(keys);
      for (const key of warmedChunkMeshKeys) {
        if (!registry.hasChunk(key)) warmedChunkMeshKeys.delete(key);
      }
      const wanted = new Set([...keys, ...warmedChunkMeshKeys]);
      const highPriority = /dirty|command|realtime|place|remove/i.test(reason);
      wantedChunkMeshKeys = wanted;
      visibleChunkMeshKeys = visible;
      lastChunkMeshQueueReason = reason;

      for (const existingKey of chunkMeshes.keys()) {
        const record = chunkMeshes.get(existingKey);
        if (wanted.has(existingKey)) {
          if (record) record.group.visible = visible.has(existingKey);
          continue;
        }
        if (record) record.group.visible = false;
        // A registry eviction is the only reason to dispose a cached mesh.
        // Merely leaving the visible ring keeps it ready for backtracking.
        if (!registry.hasChunk(existingKey)) enqueueChunkMeshKey(existingKey, true);
      }

      for (const key of keys) {
        const chunk = registry.getChunk(key);
        if (!chunk) continue;

        const existing = chunkMeshes.get(key);
        const existingRevision = existing?.group.userData.chunkRevision;
        const nextRevision = chunkMeshRevisionToken(chunk);
        if (existing && existingRevision === nextRevision) {
          existing.group.visible = visible.has(key);
          continue;
        }
        enqueueChunkMeshKey(key, highPriority);
      }

      refs.root.dataset.sceneRuntimeChunkMeshQueueDepth = String(pendingChunkMeshKeys.length);
      refs.root.dataset.sceneRuntimeChunkMeshQueueHighWaterMark = String(chunkMeshQueueHighWaterMark);
      refs.root.dataset.sceneRuntimeChunkMeshingMode = "idle-budgeted";
      scheduleChunkMeshProcessing();
      if (pendingChunkMeshKeys.length === 0) startPhysicsWhenWorldReady(reason);
    } catch (error) {
      setError(error, "scene-runtime.renderChunksFromRegistry");
    }
  }

  async function preloadVisibleMaterialTextures(): Promise<void> {
    const registry = worldRuntime.getRegistry();
    const visibleKeys = registry.getVisibleChunkKeys();
    const pendingByKey = new Map<string, Promise<THREE.Texture>>();

    for (const key of visibleKeys) {
      const chunk = registry.getChunk(key);
      if (!chunk) continue;

      for (const entry of chunk.palette) {
        const appearance = getMaterialAppearance(entry.blockTypeId)
          ?? fallbackMaterialAppearance(entry.blockTypeId);
        if (!appearance?.textureUrl) continue;

        const textureKey = appearance.textureKey ?? appearance.textureUrl;
        if (pendingByKey.has(textureKey)) continue;
        const pending = loadMaterialTexture(
          appearance.textureUrl,
          textureKey,
          {
            anisotropy: appearance.anisotropy,
            generateMipmaps: appearance.generateMipmaps,
          },
        );
        if (pending) pendingByKey.set(textureKey, pending);
      }
    }

    // Inventory-only blocks may not occur in the spawn chunks yet. Loading
    // and uploading their textures behind the initial loading screen avoids a
    // decode/GPU upload pause on the first mouse-wheel selection.
    for (const item of store.peekState().inventory.items) {
      const blockTypeId = item.runtimeBlockTypeId ?? item.blockTypeId;
      if (!blockTypeId) continue;
      const appearance = getMaterialAppearance(blockTypeId)
        ?? fallbackMaterialAppearance(blockTypeId);
      if (!appearance?.textureUrl) continue;
      const textureKey = appearance.textureKey ?? appearance.textureUrl;
      if (pendingByKey.has(textureKey)) continue;
      const pending = loadMaterialTexture(
        appearance.textureUrl,
        textureKey,
        {
          anisotropy: appearance.anisotropy,
          generateMipmaps: appearance.generateMipmaps,
        },
      );
      if (pending) pendingByKey.set(textureKey, pending);
    }

    if (pendingByKey.size === 0) return;
    setDomBootMessage(refs, `Blocktexturen werden vorbereitet (${pendingByKey.size}).`);
    const loadedTextures = await Promise.allSettled(pendingByKey.values());
    if (renderer) {
      for (const result of loadedTextures) {
        if (result.status !== "fulfilled") continue;
        try {
          renderer.initTexture(result.value);
        } catch {
          // CPU-side preload still prevents a later image decode pause.
        }
      }
    }
  }

  async function drainInitialChunkMeshQueue(): Promise<void> {
    const startedAtMs = nowMs();
    refs.root.dataset.initialChunkWarmup = "meshing";

    while (
      !destroyed
      && (pendingChunkMeshKeys.length > 0 || chunkMeshBuildInFlight)
    ) {
      const total = Math.max(chunkMeshQueueHighWaterMark, pendingChunkMeshKeys.length);
      const completed = Math.max(0, total - pendingChunkMeshKeys.length);
      setDomBootMessage(
        refs,
        `Welt wird für flüssige Bewegung vorbereitet (${completed}/${total} Chunks).`,
      );

      // The expensive greedy scan runs in a worker. The main thread only
      // installs the finished typed buffers while the loading screen is shown.
      if (!chunkMeshBuildInFlight) {
        void processChunkMeshQueue({ didTimeout: true, timeRemaining: () => 16 });
      }
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }

    refs.root.dataset.initialChunkWarmup = pendingChunkMeshKeys.length === 0
      ? "ready"
      : "cancelled";
    refs.root.dataset.initialChunkWarmupElapsedMs = String(
      Math.max(0, Math.round(nowMs() - startedAtMs)),
    );
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

  function registerOptimisticBlockEdit(
    position: ChunkWorldPosition,
    blockTypeId: string | null,
    label: string | null = null,
  ): PendingOptimisticBlockEdit | null {
    optimisticBlockEditSequence += 1;
    const appearance = blockTypeId
      ? getMaterialAppearance(blockTypeId) ?? fallbackMaterialAppearance(blockTypeId)
      : null;
    const result = applyOptimisticBlockEdit({
      registry: worldRuntime.getRegistry(),
      position,
      blockTypeId,
      revision: optimisticBlockEditSequence,
      label,
      color: appearance?.color ?? null,
    });
    if (!result.changed) return null;

    const edit: PendingOptimisticBlockEdit = {
      sequence: optimisticBlockEditSequence,
      position,
      blockTypeId,
      previousCellValue: result.previousCellValue,
      nextCellValue: result.nextCellValue,
      cellKey: result.cellKey,
      chunkKey: result.chunkKey,
      affectedMeshChunkKeys: result.affectedMeshChunkKeys,
      label,
      color: appearance?.color ?? null,
    };
    pendingOptimisticBlockEdits.set(edit.cellKey, edit);
    blockReconcileChunkKeys.add(edit.chunkKey);
    showOptimisticBlockOverlay(edit);
    scheduleOptimisticBlockMesh(result, "scene-runtime.optimistic-block-edit");
    refs.root.dataset.sceneRuntimeLastBlockEditAppliedAt = now();
    refs.root.dataset.sceneRuntimePendingBlockCommands = String(blockCommandsInFlight + 1);
    return edit;
  }

  function rollbackOptimisticBlockEdit(edit: PendingOptimisticBlockEdit): void {
    const current = pendingOptimisticBlockEdits.get(edit.cellKey);
    if (!current || current.sequence !== edit.sequence) return;
    pendingOptimisticBlockEdits.delete(edit.cellKey);
    removeOptimisticBlockOverlay(edit.cellKey);
    optimisticBlockEditSequence += 1;
    const rollback = applyOptimisticCellValue({
      registry: worldRuntime.getRegistry(),
      position: edit.position,
      cellValue: edit.previousCellValue,
      revision: optimisticBlockEditSequence,
    });
    scheduleOptimisticBlockMesh(rollback, "scene-runtime.optimistic-block-edit-rollback");
    worldRuntime.getSource().markChunkDirty(
      edit.chunkKey,
      "scene-runtime.optimistic-block-edit-rollback",
    );
  }

  function confirmOptimisticBlockEdit(edit: PendingOptimisticBlockEdit): void {
    const current = pendingOptimisticBlockEdits.get(edit.cellKey);
    if (current?.sequence === edit.sequence) {
      pendingOptimisticBlockEdits.delete(edit.cellKey);
    }
  }

  function reapplyPendingOptimisticBlockEdits(): void {
    const edits = [...pendingOptimisticBlockEdits.values()]
      .sort((left, right) => left.sequence - right.sequence);
    for (const edit of edits) {
      const result = applyOptimisticBlockEdit({
        registry: worldRuntime.getRegistry(),
        position: edit.position,
        blockTypeId: edit.blockTypeId,
        revision: edit.sequence,
        label: edit.label,
        color: edit.color,
      });
      if (result.changed) scheduleOptimisticBlockMesh(result, "scene-runtime.optimistic-block-edit-reapply");
    }
  }

  async function flushBlockCommandReconcile(reason: string): Promise<void> {
    if (destroyed || blockReconcileInFlight || blockCommandsInFlight > 0) return;
    blockReconcileQueued = false;
    blockReconcileInFlight = true;
    refs.root.dataset.sceneRuntimeBlockReconcileStatus = "loading";
    try {
      const source = worldRuntime.getSource();
      const reconcileKeys = [...blockReconcileChunkKeys];
      blockReconcileChunkKeys.clear();
      if (reconcileKeys.length > 0) {
        const loadResult = await worldRuntime.getLoader().loadCoordinates(
          reconcileKeys.map((key) => chunkCoordinatesFromKey(key)),
          {
            reason,
            force: true,
            // Reconciliation refreshes data for chunks that are already part
            // of the streamed world. `markVisible: true` makes the loader
            // replace the complete visibility set with only these edited
            // chunks once the request completes, which visually unloads the
            // rest of the world after a block command.
            markVisible: false,
            contentProfile: "full",
            preferBatch: true,
            maxChunks: reconcileKeys.length,
            batchSize: Math.min(16, Math.max(1, reconcileKeys.length)),
          },
        );
        if (isChunkLoaderFailureResult(loadResult)) {
          reconcileKeys.forEach((key) => blockReconcileChunkKeys.add(key));
          throw loadResult.error;
        }
        // Neighbor keys are invalidated server-side for mesh seams, but their
        // cell payload did not change. The local boundary-aware mesher has
        // already updated the only neighbors that can be visually affected.
        source.clearDirtyChunks(
          source.getDirtyChunkKeys(),
          "scene-runtime.block-command-targeted-reconcile",
        );
      }
      if (destroyed) {
        return;
      }
      if (blockReconcileChunkKeys.size > 0) {
        blockReconcileQueued = true;
      }
      if (reconcileKeys.length === 0 && source.getDirtyChunkKeys().length > 0) {
        logDebug(logger, "Block reconciliation skipped unrelated dirty chunks.", {
          reason,
          dirtyChunkCount: source.getDirtyChunkKeys().length,
        });
      }
      // A reload can overlap the next click. Reapply commands that are not yet
      // confirmed so a stale snapshot never makes a fresh local edit flash away.
      reapplyPendingOptimisticBlockEdits();
      scheduleCommandChunkRender("scene-runtime.block-command-reconcile");
      refs.root.dataset.sceneRuntimeBlockReconcileStatus = "ready";
    } catch (error) {
      refs.root.dataset.sceneRuntimeBlockReconcileStatus = "failed";
      logWarn(logger, "Block edit reconciliation failed.", {
        reason,
        error: normalizeUnknownError(error),
      });
    } finally {
      blockReconcileInFlight = false;
      if (blockReconcileQueued && blockCommandsInFlight === 0) {
        scheduleBlockCommandReconcile("scene-runtime.block-command-reconcile-queued");
      }
    }
  }

  function scheduleBlockCommandReconcile(reason: string): void {
    if (destroyed) return;
    blockReconcileQueued = true;
    if (blockReconcileTimerId !== null) {
      window.clearTimeout(blockReconcileTimerId);
      blockReconcileTimerId = null;
    }
    if (blockCommandsInFlight > 0 || blockReconcileInFlight) return;
    blockReconcileTimerId = window.setTimeout(() => {
      blockReconcileTimerId = null;
      void flushBlockCommandReconcile(reason);
    }, BLOCK_RECONCILE_QUIET_MS);
  }

  function finishBlockCommand(
    edit: PendingOptimisticBlockEdit | null,
    success: boolean,
    reason: string,
  ): void {
    if (edit) {
      if (success) confirmOptimisticBlockEdit(edit);
      else rollbackOptimisticBlockEdit(edit);
    }
    blockCommandsInFlight = Math.max(0, blockCommandsInFlight - 1);
    refs.root.dataset.sceneRuntimePendingBlockCommands = String(blockCommandsInFlight);
    scheduleBlockCommandReconcile(reason);
  }


  function syncCameraToStore(source: string, notify = false): void {
    if (!camera) {
      return;
    }
    // Camera transforms are consumed directly by the scene, targeting and
    // recorder. Mirroring every mouse frame into the application store caused
    // another ~29 ms immutable-state rebuild without affecting rendering.
    if (!notify) return;
    const currentTimeMs = nowMs();
    if (
      !notify
      && currentTimeMs - lastCameraStoreSyncAtMs < CAMERA_STORE_SYNC_INTERVAL_MS
    ) return;
    lastCameraStoreSyncAtMs = currentTimeMs;

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
      refs.root.dataset.physicsFrameWarnings = String(frame.warnings.length);
      refs.root.dataset.physicsFrameSubSteps = String(frame.subStepCount);
      refs.root.dataset.physicsFramePhase = frame.phase;
      const signature = [
        frame.player.movementMode,
        frame.player.grounded ? "grounded" : "not-grounded",
        frame.player.flying ? "flying" : "not-flying",
        frame.error?.code ?? "ok",
      ].join("|");
      // Store synchronization is only needed when the semantic player state
      // changes. Treating accumulator-clamp warnings as urgent previously
      // forced a full notified store/UI update every slow frame (~231 ms),
      // which made the low-FPS condition self-reinforcing.
      if (!frame.error && signature === lastPhysicsStoreSignature) return;
      lastPhysicsStoreSignature = signature;
      lastPhysicsStoreSyncAtMs = nowMs();

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
          notify: Boolean(frame.error),
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
      lastPhysicsStoreSyncAtMs = nowMs();

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
    let candidate: unknown = null;
    let selectedSlotRecord: Record<string, unknown> = {};
    const state = store.peekState();
    const selectedSlot = selectSelectedInventorySlot(state);
    if (!selectedSlot || selectedSlot.status === "empty" || !selectedSlot.enabled) return null;
    selectedSlotRecord = asRecord(selectedSlot);
    candidate = selectSelectedInventoryItem(state)
      ?? selectInventoryItemBySlot(state, selectedSlot.slot);

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
    const appearanceIdentity = firstDefined(
      record.runtimeBlockTypeId,
      record.runtime_block_type_id,
      record.blockTypeId,
      record.block_type_id,
      selectedSlotRecord.runtimeBlockTypeId,
      selectedSlotRecord.runtime_block_type_id,
      selectedSlotRecord.blockTypeId,
      selectedSlotRecord.block_type_id,
    );
    const appearance = getMaterialAppearance(appearanceIdentity)
      ?? normalizeMaterialAppearance(rawItem)
      ?? normalizeMaterialAppearance(raw)
      ?? normalizeMaterialAppearance(record)
      ?? normalizeMaterialAppearance(selectedSlotRecord)
      ?? fallbackMaterialAppearance(appearanceIdentity);

    return {
      id,
      label,
      kind,
      color: normalizeOptionalText(colorValue)
        ?? (kind === "asset" ? "#38bdf8" : "#68a38a"),
      modelUrl,
      textureUrl: appearance?.textureUrl ?? null,
      textureKey: appearance?.textureKey ?? null,
      roughness: appearance?.roughness ?? 0.88,
      metalness: appearance?.metalness ?? 0.02,
    };
  }
  function createLocalPresenceState(clientTimeMs = Date.now()): RealtimePresenceState | null {
    if (!camera) return null;
    if (clientTimeMs - lastHeldItemRefreshAtMs >= HELD_ITEM_REFRESH_INTERVAL_MS) {
      cachedSelectedHeldItem = selectedHeldItem();
      lastHeldItemRefreshAtMs = clientTimeMs;
    }
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
      heldItem: cachedSelectedHeldItem,
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
    const heldItemId = item?.id ?? "";
    const heldItemKind = item?.kind ?? "none";
    const heldItemVisible = String(Boolean(item));
    const heldItemView = thirdPersonEnabled ? "third-person" : "first-person";
    if (refs.root.dataset.heldItemId !== heldItemId) refs.root.dataset.heldItemId = heldItemId;
    if (refs.root.dataset.heldItemKind !== heldItemKind) refs.root.dataset.heldItemKind = heldItemKind;
    if (refs.root.dataset.heldItemVisible !== heldItemVisible) {
      refs.root.dataset.heldItemVisible = heldItemVisible;
    }
    if (refs.root.dataset.heldItemView !== heldItemView) refs.root.dataset.heldItemView = heldItemView;
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
    if (!chunkMapOverlay) return;
    chunkMapOverlay.update({
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

  function updateNavigationCompass(
    state: RealtimePresenceState | null,
    timestampMs: number,
  ): void {
    if (!navigationCompass || !state) return;
    if (
      timestampMs - lastNavigationCompassUpdateAtMs
      < NAVIGATION_COMPASS_UPDATE_INTERVAL_MS
    ) return;
    lastNavigationCompassUpdateAtMs = timestampMs;

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
    if (code === "F8" || event.key === "F8") {
      event.preventDefault();
      event.stopImmediatePropagation();
      performanceRecorder?.toggle("keyboard-f8");
      return;
    }
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

  function updateFrameDiagnostics(timestampMs: number, frameMs: number): void {
    if (Number.isFinite(frameMs) && frameMs > 0 && frameMs < 1_000) {
      frameTimeSamplesMs.push(frameMs);
      if (frameTimeSamplesMs.length > FRAME_DIAGNOSTIC_WINDOW_SIZE) {
        frameTimeSamplesMs.splice(0, frameTimeSamplesMs.length - FRAME_DIAGNOSTIC_WINDOW_SIZE);
      }
    }

    if (
      frameTimeSamplesMs.length === 0
      || timestampMs - lastFrameDiagnosticAtMs < FRAME_DIAGNOSTIC_UPDATE_INTERVAL_MS
    ) {
      return;
    }

    lastFrameDiagnosticAtMs = timestampMs;
    const sorted = [...frameTimeSamplesMs].sort((left, right) => left - right);
    const sum = frameTimeSamplesMs.reduce((total, value) => total + value, 0);
    const averageMs = sum / frameTimeSamplesMs.length;
    const percentileIndex = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
    );

    refs.root.dataset.sceneRuntimeFps = (1_000 / Math.max(averageMs, 0.001)).toFixed(1);
    refs.root.dataset.sceneRuntimeFrameAverageMs = averageMs.toFixed(2);
    refs.root.dataset.sceneRuntimeFrameP95Ms = sorted[percentileIndex].toFixed(2);
    refs.root.dataset.sceneRuntimeFrameMaxMs = sorted[sorted.length - 1].toFixed(2);
    refs.root.dataset.sceneRuntimeFrameHitches25Ms = String(
      frameTimeSamplesMs.filter((value) => value > 25).length,
    );
    refs.root.dataset.sceneRuntimeFrameHitches50Ms = String(
      frameTimeSamplesMs.filter((value) => value > 50).length,
    );
    refs.root.dataset.sceneRuntimeFrameSampleCount = String(frameTimeSamplesMs.length);
    refs.root.dataset.sceneRuntimeCameraInputFrames = String(cameraInputFrameCount);
    refs.root.dataset.sceneRuntimeLastCameraInputMagnitude = lastCameraInputMagnitude.toFixed(2);
  }

  function updateCameraFromInput(deltaMs: number): SceneCameraFrameTelemetry {
    if (!camera || !inputController) {
      return {
        lookDeltaX: 0,
        lookDeltaY: 0,
        lookDeltaMagnitude: 0,
        pointerLocked: false,
        movementActive: false,
        sprinting: false,
        inputReadMs: 0,
        physicsSimulationMs: 0,
        physicsStoreMs: 0,
        cameraFinalizeMs: 0,
        cameraStoreMs: 0,
        physicsSubSteps: 0,
      };
    }

    try {
      const cameraUpdateStartedAtMs = nowMs();
      const inputState = inputController.getInputState();
      const snapshot = inputState.getSnapshot();
      // Pointer devices can emit many native events between two rendered
      // frames. Consuming only the last event loses most of that movement on a
      // busy frame and makes the camera feel delayed. The input state owns a
      // frame accumulator which is cleared exactly after this consumption.
      const pointerDelta = snapshot.pointer.accumulatedLookDelta;
      const sensitivity = safeNumber(
        bootstrap.input.sensitivity,
        DEFAULT_CAMERA_SENSITIVITY,
        {
          min: 0.00001,
          max: 0.1,
        },
      );
      const seconds = Math.max(0, Math.min(0.1, deltaMs / 1000));
      const hasPointerDelta = pointerDelta.x !== 0 || pointerDelta.y !== 0;

      if (
        snapshot.pointer.pointerLocked
        || snapshot.pointer.pressedButtons.length > 0
        || (cameraDragTestEnabled && hasPointerDelta)
      ) {
        if (hasPointerDelta) {
          cameraInputFrameCount += 1;
          lastCameraInputMagnitude = Math.hypot(pointerDelta.x, pointerDelta.y);
        }
        lookYaw -= pointerDelta.x * sensitivity;
        lookPitch -= pointerDelta.y * sensitivity;
        lookPitch = Math.max(
          -Math.PI / 2 + 0.001,
          Math.min(Math.PI / 2 - 0.001, lookPitch),
        );
      }
      camera.rotation.set(lookPitch, lookYaw, 0, "YXZ");

      const movementIntent = inputController.getMovementIntent();
      const inputReadMs = nowMs() - cameraUpdateStartedAtMs;
      let physicsSimulationMs = 0;
      let physicsStoreMs = 0;
      let physicsSubSteps = 0;

      if (physicsRuntime && physicsRuntimeEnabled) {
        const physicsSimulationStartedAtMs = nowMs();
        const physicsFrame = physicsRuntime.stepFrame({
          nowMs: nowMs(),
          deltaSeconds: seconds,
          movementIntent: movementIntent.physics,
          lookAngles: { yaw: lookYaw, pitch: lookPitch, roll: 0 },
          query: worldRuntime.getBlockCollisionQuery(),
        });
        physicsSimulationMs = nowMs() - physicsSimulationStartedAtMs;
        physicsSubSteps = physicsFrame.subStepCount;

        const physicsStoreStartedAtMs = nowMs();
        dispatchPhysicsFrameToStore(physicsFrame, "scene-runtime.physics-frame");
        physicsStoreMs = nowMs() - physicsStoreStartedAtMs;

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

      const cameraFinalizeStartedAtMs = nowMs();
      if (thirdPersonEnabled) {
        applyThirdPersonCamera(seconds);
      } else {
        camera.rotation.set(lookPitch, lookYaw, 0, "YXZ");
        camera.updateMatrixWorld(true);
      }
      const cameraFinalizeMs = nowMs() - cameraFinalizeStartedAtMs;

      const cameraStoreStartedAtMs = nowMs();
      inputState.resetDeltas();
      syncCameraToStore(
        physicsRuntimeEnabled ? "scene-runtime.physics-camera" : "scene-runtime.camera",
        false,
      );
      const cameraStoreMs = nowMs() - cameraStoreStartedAtMs;
      return {
        lookDeltaX: pointerDelta.x,
        lookDeltaY: pointerDelta.y,
        lookDeltaMagnitude: Math.hypot(pointerDelta.x, pointerDelta.y),
        pointerLocked: snapshot.pointer.pointerLocked,
        movementActive: movementIntent.active,
        sprinting: movementIntent.sprint,
        inputReadMs,
        physicsSimulationMs,
        physicsStoreMs,
        cameraFinalizeMs,
        cameraStoreMs,
        physicsSubSteps,
      };
    } catch (error) {
      logWarn(logger, "Camera/physics input update failed.", {
        error: normalizeUnknownError(error),
      });
      return {
        lookDeltaX: 0,
        lookDeltaY: 0,
        lookDeltaMagnitude: 0,
        pointerLocked: false,
        movementActive: false,
        sprinting: false,
        inputReadMs: 0,
        physicsSimulationMs: 0,
        physicsStoreMs: 0,
        cameraFinalizeMs: 0,
        cameraStoreMs: 0,
        physicsSubSteps: 0,
      };
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
    const probes = visibleChunkCoordinatesAround(center, radius, {
      radial: true,
      verticalRadius: 0,
    });

    return additionalSurfaceChunkCoordinates(
      probes.map((probe) => registry.getChunk(chunkKeyFromCoordinatesLocal(probe)))
        .filter((chunk): chunk is RuntimeChunkContent => chunk !== null),
      center,
    );
  }

  function updateStreamingFog(radius: number): void {
    if (!scene || !(scene.fog instanceof THREE.Fog)) return;
    const far = Math.max(64, (radius - 2) * 16);
    scene.fog.far = far;
    scene.fog.near = Math.max(32, far - 48);
  }

  function configuredPreloadRadius(): number {
    return Math.max(
      MIN_DIRECTIONAL_PRELOAD_RADIUS,
      safeInteger(refs.root.dataset.chunksPreloadRadius, MIN_DIRECTIONAL_PRELOAD_RADIUS, {
        min: 1,
        max: 8,
      }),
    );
  }

  function configuredUnloadDistance(visibleRadius: number): number {
    const minimum = visibleRadius + configuredPreloadRadius() + MIN_CHUNK_UNLOAD_RESERVE;
    const configured = Math.max(
      minimum,
      safeInteger(refs.root.dataset.chunksUnloadDistance, minimum, {
        min: visibleRadius + 1,
        max: 96,
      }),
    );
    // A very large historic dataset value kept hundreds of no-longer-visible
    // chunks alive until the 512-entry registry cap triggered GC churn. One
    // extra ring beyond the working reserve is sufficient for backtracking.
    return Math.min(configured, minimum + 1);
  }

  function warmLoadedChunkMeshes(
    coordinates: readonly ChunkCoordinates[],
    center: ChunkCoordinates,
    limit: number,
    reason: string,
  ): void {
    const registry = worldRuntime.getRegistry();
    const candidates = coordinates
      .filter((coordinate) => registry.hasChunk(chunkKeyFromCoordinatesLocal(coordinate)))
      .sort((left, right) => {
        const leftDistance = (
          (left.chunkX - center.chunkX) ** 2
          + (left.chunkZ - center.chunkZ) ** 2
        );
        const rightDistance = (
          (right.chunkX - center.chunkX) ** 2
          + (right.chunkZ - center.chunkZ) ** 2
        );
        return leftDistance - rightDistance;
      })
      .slice(0, Math.max(1, limit));

    for (const coordinate of candidates) {
      warmedChunkMeshKeys.add(chunkKeyFromCoordinatesLocal(coordinate));
    }

    refs.root.dataset.prefetchedChunkMeshCount = String(warmedChunkMeshKeys.size);
    if (candidates.length > 0) renderChunksFromRegistry(reason);
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
      maxChunks: Math.min(
        4096,
        Math.max(
          coordinates.length,
          safeInteger(bootstrap.runtime.chunk.maxBatchChunks, 256, {
            min: 1,
            max: 4096,
          }),
        ),
      ),
      priorityDirection,
      batchSize: 12,
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
    let evicted = false;
    for (const key of registry.getChunkKeys()) {
      if (visibleKeys.has(key) || dirtyKeys.has(key)) continue;
      const coordinate = chunkCoordinatesFromKey(key);
      const offsetX = coordinate.chunkX - center.chunkX;
      const offsetZ = coordinate.chunkZ - center.chunkZ;
      if (offsetX * offsetX + offsetZ * offsetZ > maximumDistanceSquared) {
        registry.deleteChunk(key, "scene-runtime.distance-eviction");
        warmedChunkMeshKeys.delete(key);
        evicted = true;
      }
    }
    if (evicted) renderChunksFromRegistry("scene-runtime.distance-eviction");
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

    const preloadRadius = configuredPreloadRadius();
    const unloadDistance = configuredUnloadDistance(visibleRadius);
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
        mode === "edge" ? 2 : 3,
        preloadRadius + 1,
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
    const prefetchChunkLimit = Math.min(
      safeInteger(bootstrap.runtime.chunk.maxBatchChunks, 256, {
        min: 1,
        max: 4096,
      }),
      Math.max(
        mode === "edge" ? 18 : 24,
        visibleRadius * (mode === "edge" ? 3 : 4),
      ),
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
        maxChunks: prefetchChunkLimit,
        priorityDirection: effectivePriorityDirection,
        batchSize: 12,
        shouldContinue: prefetchShouldContinue,
      });

      warmLoadedChunkMeshes(
        coordinates,
        center,
        Math.min(
          MAX_PREFETCH_MESH_WARMUP_CHUNKS,
          mode === "edge" ? Math.max(12, visibleRadius * 2) : Math.max(18, visibleRadius * 3),
        ),
        mode === "edge"
          ? "scene-runtime.edge-prefetch-mesh-warmup"
          : "scene-runtime.directional-prefetch-mesh-warmup",
      );

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
          maxChunks: prefetchChunkLimit,
          priorityDirection: effectivePriorityDirection,
          batchSize: 12,
          shouldContinue: prefetchShouldContinue,
        });
        warmLoadedChunkMeshes(
          surfaceCoordinates,
          center,
          MAX_PREFETCH_MESH_WARMUP_CHUNKS,
          mode === "edge"
            ? "scene-runtime.edge-surface-mesh-warmup"
            : "scene-runtime.directional-surface-mesh-warmup",
        );
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
      const loaderSnapshot = worldRuntime.getLoader().getSnapshot();
      const currentChunkLoadNeedsRetry =
        chunkKey === lastCameraChunkKey
        && !queuedCameraChunk
        && nowMs() >= visibilityRetryAtMs
        && (
          visibilityRetryAttempt > 0
          || loaderSnapshot.status === "failed"
          || loaderSnapshot.status === "degraded"
          || loaderSnapshot.lastFailedChunkKeys.length > 0
        );

      if (chunkKey !== lastCameraChunkKey) {
        lastCameraChunkKey = chunkKey;
        queuedCameraChunk = center;
        visibilityRetryAttempt = 0;
        visibilityRetryAtMs = 0;
      } else if (currentChunkLoadNeedsRetry) {
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
          batchSize: 12,
          shouldContinue: () => !destroyed && lastCameraChunkKey === targetChunkKey,
          onBatchLoaded: () => {
            if (!destroyed) {
              renderChunksFromRegistry("scene-runtime.camera-chunk-progressive-batch");
            }
          },
        });

        const completedLoadSnapshot = worldRuntime.getLoader().getSnapshot();
        const completedLoadNeedsRetry =
          completedLoadSnapshot.status === "failed"
          || completedLoadSnapshot.status === "degraded"
          || completedLoadSnapshot.lastFailedChunkKeys.length > 0;
        if (completedLoadNeedsRetry && lastCameraChunkKey === targetChunkKey) {
          const retryDelayMs = CHUNK_STREAM_RETRY_DELAYS_MS[
            Math.min(visibilityRetryAttempt, CHUNK_STREAM_RETRY_DELAYS_MS.length - 1)
          ];
          visibilityRetryAttempt += 1;
          visibilityRetryAtMs = nowMs() + retryDelayMs;
          refs.root.dataset.chunkStreamingStatus = "reconnecting";
          refs.root.dataset.chunkStreamingRetryMs = String(retryDelayMs);
          setDomLiveMessage(
            refs,
            "Umgebungsdaten sind kurzzeitig nicht erreichbar. Der Viewer verbindet sich automatisch neu.",
          );
        } else {
          const recoveredFromFailure = visibilityRetryAttempt > 0;
          visibilityRetryAttempt = 0;
          visibilityRetryAtMs = 0;
          refs.root.dataset.chunkStreamingStatus = "ready";
          refs.root.dataset.chunkStreamingRetryMs = "";
          if (recoveredFromFailure) {
            setDomLiveMessage(refs, "Umgebungsdaten wurden wiederhergestellt.");
          }
        }

        await loadTerrainSurfaceLayers(
          targetCenter,
          visibleRadius,
          targetChunkKey,
          priorityDirection,
        );
        updateStreamingFog(visibleRadius);

        renderChunksFromRegistry("scene-runtime.camera-chunk-change");

        if (lastCameraChunkKey === targetChunkKey && !queuedCameraChunk) {
          const unloadDistance = configuredUnloadDistance(visibleRadius);
          evictDistantChunks(targetCenter, unloadDistance);
          prefetchChunksAroundMovement(targetCenter, visibleRadius, priorityDirection);
        }
      }
    } catch (error) {
      const retryDelayMs = CHUNK_STREAM_RETRY_DELAYS_MS[
        Math.min(visibilityRetryAttempt, CHUNK_STREAM_RETRY_DELAYS_MS.length - 1)
      ];
      visibilityRetryAttempt += 1;
      visibilityRetryAtMs = nowMs() + retryDelayMs;
      refs.root.dataset.chunkStreamingStatus = "reconnecting";
      refs.root.dataset.chunkStreamingRetryMs = String(retryDelayMs);
      logWarn(logger, "Loading chunks around camera failed.", {
        error: normalizeUnknownError(error),
        retryDelayMs,
      });
    } finally {
      visibilityLoadInFlight = false;
    }
  }

  function updateTargeting(): void {
    if (!camera) {
      return;
    }

    try {
      const registry = worldRuntime.getRegistry();
      const chunkSize = registry.getChunk(registry.getChunkKeys()[0] ?? "")?.chunkSize ?? 16;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const targetMaxDistance = worldEditIntentHandler
        ? Math.max(DEFAULT_TARGET_MAX_DISTANCE, Math.min(96, worldEditTargetMaxDistance))
        : DEFAULT_TARGET_MAX_DISTANCE;
      const hit = raycastFromOriginDirection({
        origin: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        direction: {
          x: forward.x,
          y: forward.y,
          z: forward.z,
        },
        sampler: (position) => worldRuntime.sampleCell(position),
        options: {
          maxDistance: targetMaxDistance,
          maxSteps: Math.max(32, Math.ceil(targetMaxDistance) + 8),
          stepSize: 1,
          includeAir: false,
          source: "raycast",
        },
        chunkSize,
      });

      if (!hit.hit || !hit.sourceCell || !hit.sample) {
        latestSourceCell = null;
        latestPlacementCell = null;
        latestTargetPoint = null;
        lastTargetSignature = "none";
        refs.root.dataset.sceneRuntimeTargetSignature = "none";

        return;
      }

      const normal = hit.normal ?? { x: 0, y: 1, z: 0 };
      const nx = Math.round(normal.x);
      const ny = Math.round(normal.y);
      const nz = Math.round(normal.z);

      const sourceAddress = hit.sourceCell;
      const sourceCell = {
        chunkKey: sourceAddress.chunkKey,
        chunkX: sourceAddress.chunkX,
        chunkY: sourceAddress.chunkY,
        chunkZ: sourceAddress.chunkZ,
        localX: sourceAddress.localX,
        localY: sourceAddress.localY,
        localZ: sourceAddress.localZ,
        worldX: sourceAddress.worldX,
        worldY: sourceAddress.worldY,
        worldZ: sourceAddress.worldZ,
        cellValue: hit.sample.cellValue,
        blockTypeId: hit.sample.blockTypeId,
      };
      const placementAddress = hit.previousCell ?? createChunkCellAddress({
        worldX: sourceAddress.worldX + nx,
        worldY: sourceAddress.worldY + ny,
        worldZ: sourceAddress.worldZ + nz,
        chunkSize,
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
      latestSourceCell = sourceCell;
      latestPlacementCell = placementCell;
      latestTargetPoint = hit.position;

      const status =
        !placementSample.chunkLoaded
          ? "missing-chunk"
          : placementSample.air
            ? "valid"
            : "blocked";

      const signature = targetSignatureFromCells(sourceCell, placementCell, status);
      lastTargetSignature = signature;
      refs.root.dataset.sceneRuntimeTargetSignature = signature;
      refs.root.dataset.sceneRuntimeTargetStatus = status;
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

  function publishLocalPresence(
    state: RealtimePresenceState | null,
    timestampMs: number,
  ): void {
    if (!realtimeClient || !state) return;
    if (
      timestampMs - lastRealtimePresencePublishAtMs
      < REALTIME_PRESENCE_PUBLISH_INTERVAL_MS
    ) return;
    lastRealtimePresencePublishAtMs = timestampMs;
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
        reapplyPendingOptimisticBlockEdits();
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
      const frameCpuStartedAtMs = nowMs();
      let phaseStartedAtMs = frameCpuStartedAtMs;
      const cameraTelemetry = updateCameraFromInput(frameMs);
      const cameraPhysicsMs = nowMs() - phaseStartedAtMs;

      phaseStartedAtMs = nowMs();
      if (timestampMs - lastTargetingUpdateAtMs >= TARGETING_UPDATE_INTERVAL_MS) {
        lastTargetingUpdateAtMs = timestampMs;
        updateTargeting();
      }
      const targetingMs = nowMs() - phaseStartedAtMs;

      phaseStartedAtMs = nowMs();
      const deltaSeconds = Math.min(0.1, frameMs / 1_000);
      environmentSystem?.update(deltaSeconds);
      updateTerrainShadowCasters(timestampMs);
      const environmentMs = nowMs() - phaseStartedAtMs;

      phaseStartedAtMs = nowMs();
      remoteAvatarScene?.update(deltaSeconds, timestampMs);
      const localPresence = createLocalPresenceState(Date.now());
      if (localPresence && thirdPersonEnabled) {
        syncLocalAvatar(localPresence, deltaSeconds, timestampMs);
      } else {
        localAvatarScene?.setVisible(false);
      }
      updateFirstPersonHeldItem(localPresence, deltaSeconds, timestampMs);
      publishLocalPresence(localPresence, timestampMs);
      updateChunkMap(localPresence, timestampMs);
      updateNavigationCompass(localPresence, timestampMs);
      const avatarsHudMs = nowMs() - phaseStartedAtMs;

      phaseStartedAtMs = nowMs();
      renderer.render(scene, camera);
      const renderSubmitMs = nowMs() - phaseStartedAtMs;

      phaseStartedAtMs = nowMs();
      frameCount += 1;
      updateFrameDiagnostics(timestampMs, frameMs);
      renderStoreFrame(frameMs);

      if (timestampMs - lastChunkStreamPollAtMs >= CHUNK_STREAM_POLL_INTERVAL_MS) {
        lastChunkStreamPollAtMs = timestampMs;
        void maybeLoadChunksAroundCamera();
      }
      const storeStreamMs = nowMs() - phaseStartedAtMs;
      const cpuTotalMs = nowMs() - frameCpuStartedAtMs;

      if (performanceRecorder?.isRecording()) {
        renderer.getDrawingBufferSize(performanceDrawingBufferSize);
        const environmentSnapshot = environmentSystem?.getSnapshot();
        performanceRecorder.recordFrame({
          atMs: timestampMs,
          frameMs,
          phases: {
            cameraPhysicsMs,
            targetingMs,
            environmentMs,
            avatarsHudMs,
            renderSubmitMs,
            storeStreamMs,
            cpuTotalMs,
          },
          input: cameraTelemetry,
          camera: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            yaw: lookYaw,
            pitch: lookPitch,
          },
          renderer: {
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
            pixelRatio: renderer.getPixelRatio(),
            drawingBufferWidth: performanceDrawingBufferSize.x,
            drawingBufferHeight: performanceDrawingBufferSize.y,
          },
          world: {
            loadedChunks: worldRuntime.getRegistry().getChunkKeys().length,
            renderedChunks: chunkMeshes.size,
            meshes: meshCount,
            pendingChunkMeshes: pendingChunkMeshKeys.length,
            shadowCasters: terrainShadowCasterMeshCount,
          },
          edits: {
            placeIntents: placeIntentCount,
            removeIntents: removeIntentCount,
            pendingCommands: blockCommandsInFlight,
            pendingOverlays: optimisticBlockOverlays.size,
            pendingMeshBatchChunks: pendingOptimisticMeshChunkKeys.size,
          },
          shadows: {
            environmentRefreshCount: environmentSnapshot?.shadowRefreshCount ?? 0,
            environmentRefreshReason: environmentSnapshot?.lastShadowRefreshReason ?? "unknown",
            terrainScanCount: terrainShadowScanCount,
            terrainChangeCount: terrainShadowChangeCount,
          },
        });
      }
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
            setStoreAction(
              store,
              {
                kind: "command/result",
                result: commandResult,
                source: "scene-runtime.source-command-result",
                createdAt: now(),
              },
              {
                notify: false,
                captureHistory: false,
              },
            );
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
      // The iframe and editor store update immediately, while the controller's
      // selected catalog entry may still point at the previously active slot.
      // Resolve the full VPLIB payload by the authoritative store slot so doors,
      // windows and slabs keep their geometry profile during placement.
      const selectedSlotIndex = selectSelectedSlotIndex(state);
      const slotPlaceable = libraryInventorySource?.getRuntimePlaceableForSlot(
        selectedSlotIndex,
      ) ?? null;
      // Never fall back to the controller's previously selected record while
      // the store already has a current item. That exact race sent
      // `world-edit.ruler-laser` for visibly selected doors, windows and slabs.
      const hotbarPlaceable = slotPlaceable
        ?? (selectedItem ? null : hotbarController?.getSelectedRuntimePlaceable() ?? null);
      const hasCurrentInventoryPlacement = hotbarPlaceable !== null || selectedItem !== null;
      const semanticProfile = librarySemanticProfileFromSources(
        hotbarPlaceable,
        hotbarPlaceable?.rawSlot,
        hotbarPlaceable?.rawItem,
        selectedItem?.raw,
        selectedItem,
        inputPlacement,
      );

      const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
        firstDefined(
          hotbarPlaceable?.runtimeBlockTypeId,
          selectedItem?.runtimeBlockTypeId,
          selectedItem?.blockTypeId,
          selectActiveRuntimeBlockTypeId(state),
          inputPlacement?.runtimeBlockTypeId,
          intent?.runtimeBlockTypeId,
          intent?.blockTypeId,
        ),
      );

      const intentLibraryRef = intent?.libraryRef ?? inputPlacement?.libraryRef ?? null;
      const intentPlacementCommand =
        intent?.placementCommand ?? inputPlacement?.placementCommand ?? null;

      const libraryRef =
        hotbarPlaceable?.libraryRef ??
        selectActiveLibraryRef(state) ??
        intentLibraryRef;
      const placementCommand =
        hotbarPlaceable?.placementCommand ??
        selectActivePlacementCommand(state) ??
        intentPlacementCommand;

      const libraryItemId = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.libraryItemId,
          selectSelectedLibraryItemId(state),
          selectedItem?.libraryItemId,
          libraryRef?.libraryItemId,
          inputPlacement?.libraryItemId,
          intent?.libraryItemId,
        ),
      );
      const familyId = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.familyId,
          selectSelectedFamilyId(state),
          selectedItem?.familyId,
          libraryRef?.familyId,
          inputPlacement?.familyId,
          intent?.familyId,
        ),
      );
      const packageId = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.packageId,
          selectSelectedPackageId(state),
          selectedItem?.packageId,
          libraryRef?.packageId,
          inputPlacement?.packageId,
          intent?.packageId,
        ),
      );
      const vplibUid = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.vplibUid,
          selectSelectedVplibUid(state),
          selectedItem?.vplibUid,
          libraryRef?.vplibUid,
          inputPlacement?.vplibUid,
          intent?.vplibUid,
        ),
      );
      const variantId = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.variantId,
          selectSelectedVariantId(state),
          selectedItem?.variantId,
          libraryRef?.variantId,
          inputPlacement?.variantId,
          intent?.variantId,
          "default",
        ),
      );
      const revisionHash = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.revisionHash,
          selectSelectedRevisionHash(state),
          selectedItem?.revisionHash,
          libraryRef?.revisionHash,
          semanticProfile?.revisionHash,
          inputPlacement?.revisionHash,
          intent?.revisionHash,
        ),
      );
      const inventorySlotIndex = safeInteger(
        firstDefined(
          selectSelectedSlotIndex(state),
          hotbarPlaceable?.inventorySlotIndex,
          hotbarPlaceable?.slotIndex,
          selectedItem?.slot,
          inputPlacement?.inventorySlotIndex,
          intent?.inventorySlotIndex,
        ),
        0,
        {
          min: 0,
          max: 999,
        },
      );
      const inventoryItemId = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.inventoryItemId,
          hotbarPlaceable?.itemId,
          selectedItem?.id,
          libraryItemId,
          familyId,
          vplibUid,
          inputPlacement?.inventoryItemId,
          intent?.inventoryItemId,
        ),
      );
      const objectKind = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.objectKind,
          selectedItem?.objectKind,
          libraryRef?.objectKind,
          inputPlacement?.objectKind,
          intent?.objectKind,
        ),
      );
      const label = normalizeOptionalText(
        firstDefined(
          hotbarPlaceable?.label,
          selectedItem?.label,
          familyId,
          vplibUid,
          libraryItemId,
          runtimeBlockTypeId,
          inputPlacement?.label,
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
      } else if (!hasCurrentInventoryPlacement && inputPlacement && inputPlacement.valid === false) {
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
        semanticProfile,
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
          staleInputPlacementIgnored: hasCurrentInventoryPlacement && (
            normalizeRuntimeBlockTypeId(inputPlacement?.runtimeBlockTypeId) !== null
            && normalizeRuntimeBlockTypeId(inputPlacement?.runtimeBlockTypeId) !== runtimeBlockTypeId
          ),
          productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
          browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
          semanticProfile,
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
        semanticProfile: null,
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
    const placeStartedAtMs = nowMs();
    let optimisticEdit: PendingOptimisticBlockEdit | null = null;
    let optimisticSemanticOverlayKey: string | null = null;
    let commandStarted = false;
    let commandFinished = false;

    try {
      const placement = getActiveLibraryPlacement(intent);
      lastPlacement = placement;

      if (!placement.valid || !placement.runtimeBlockTypeId) {
        blockPlacement(placement, intent.trigger);
        return;
      }

      const worldCellGrid = placement.runtimeBlockTypeId === 'lod2_exterior_wall'
        || (['block','cell_block'].includes(placement.objectKind ?? '') && touchesLod2Wall(intent.position,
          p=>worldRuntime.sampleCell(p).blockTypeId));
      let placementConstraint = placementConstraintHandler?.(intent.position, {
        targetPoint: intent.targetPoint,
        worldCellGrid,
      });
      if (placementConstraint && !placementConstraint.allowed) {
        blockedPlaceIntentCount += 1;
        const message = placementConstraint.message
          || "Der Block würde die Grenze eines ausgewählten Grundstücks überschreiten.";
        setDomLiveMessage(refs, message);
        setStoreAction(store, {
          kind: "ui/live-message",
          message,
          source: intent.trigger,
          createdAt: now(),
        });
        setStoreAction(store, {
          kind: "debug/warning",
          warning: `Placement blockiert: ${placementConstraint.code ?? "parcel-boundary-overhang"}`,
          source: intent.trigger,
          createdAt: now(),
        }, { notify: false, captureHistory: false });
        return;
      }

      const source = worldRuntime.getSource();
      const commandPosition = placementConstraint?.semanticPlacement?.anchorPosition ?? intent.position;

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

      if (placementConstraint?.semanticPlacement) {
        optimisticSemanticOverlayKey = showOptimisticSemanticOverlay(
          placementConstraint.semanticPlacement,
          placement.runtimeBlockTypeId,
        );
      } else {
        optimisticSemanticOverlayKey = showOptimisticParametricOverlay(
          commandPosition,
          placement,
        );
      }
      optimisticEdit = optimisticSemanticOverlayKey
        ? null
        : registerOptimisticBlockEdit(
            intent.position,
            placement.runtimeBlockTypeId,
            placement.label,
          );
      performanceRecorder?.recordEvent(
        "block-place",
        "optimistic-applied",
        nowMs() - placeStartedAtMs,
        {
          chunkKey: optimisticEdit?.chunkKey ?? null,
          cellKey: optimisticEdit?.cellKey ?? null,
          blockTypeId: placement.runtimeBlockTypeId,
          pendingCommands: blockCommandsInFlight,
        },
      );
      blockCommandsInFlight += 1;
      commandStarted = true;
      refs.root.dataset.sceneRuntimePendingBlockCommands = String(blockCommandsInFlight);
      setDomLiveMessage(
        refs,
        `Block gesetzt: ${placement.label ?? placement.runtimeBlockTypeId}`,
      );

      const requestStartedAtMs = nowMs();
      const result = await source.placeLibraryItem(
        commandPosition,
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
          semanticProfile: placement.semanticProfile,
          semanticPlacement: placementConstraint?.semanticPlacement ?? null,
        },
        {
          reason: intent.trigger,
          // The local registry/mesh changes immediately. Server chunks are
          // reconciled once after the click burst instead of once per command.
          reloadDirtyChunks: false,
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
          // The Chunk service uses this authenticated Library/VPLIB context to
          // register a previously unseen runtime block type on first use.
          includeLibraryMetadataInCommand: true,
        },
      );
      performanceRecorder?.recordEvent(
        "block-place",
        "server-result",
        nowMs() - requestStartedAtMs,
        {
          chunkKey: optimisticEdit?.chunkKey ?? null,
          failed: isChunkApiFailedResult(result),
          pendingCommands: blockCommandsInFlight,
        },
      );

      if (isChunkApiFailedResult(result)) {
        if (optimisticSemanticOverlayKey) removeOptimisticSemanticOverlay(optimisticSemanticOverlayKey);
        finishBlockCommand(
          optimisticEdit,
          false,
          "scene-runtime.placeLibraryItem.failed",
        );
        commandFinished = true;
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
        refs.root.dataset.sceneRuntimeLastBlockCommandAt = now();
        refs.root.dataset.sceneRuntimeLastBlockCommandType = commandResult.commandType;
        if (commandResult.changed) {
          for (const key of commandResult.changedChunks) blockReconcileChunkKeys.add(key);
          realtimeClient?.publishWorldInvalidation({
            commandType: commandResult.commandType,
            eventIds: commandResult.eventIds,
            changedChunks: commandResult.changedChunks,
            dirtyChunks: commandResult.dirtyChunks,
            chunkVersions: commandResult.chunkVersions,
          });
        }
      }

      finishBlockCommand(
        optimisticEdit,
        true,
        "scene-runtime.placeLibraryItem.ready",
      );
      commandFinished = true;
      performanceRecorder?.recordEvent(
        "block-place",
        "complete",
        nowMs() - placeStartedAtMs,
        {
          chunkKey: optimisticEdit?.chunkKey ?? null,
          pendingCommands: blockCommandsInFlight,
        },
      );
    } catch (error) {
      if (optimisticSemanticOverlayKey) removeOptimisticSemanticOverlay(optimisticSemanticOverlayKey);
      if (commandStarted && !commandFinished) {
        finishBlockCommand(
          optimisticEdit,
          false,
          "scene-runtime.placeLibraryItem.exception",
        );
      }
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

  function parametricObjectAt(
    position: ChunkWorldPosition,
    requiredProfileId?: string,
  ): SemanticChunkObjectRef | null {
    const registry = worldRuntime.getRegistry();
    const seen = new Set<string>();
    for (const key of registry.getChunkKeys()) {
      const chunk = registry.getChunk(key);
      if (!chunk) continue;
      for (const ref of semanticObjectRefs(chunk)) {
        if (!isVplibParametricObjectRef(ref) || seen.has(ref.objectInstanceId)) continue;
        seen.add(ref.objectInstanceId);
        const profile = asRecord(ref.metadata.geometryProfile);
        if (requiredProfileId
          && safeString(profile["geometry.profile_id"], "").toLowerCase() !== requiredProfileId) continue;
        if (ref.occupiedCells.some((cell) => (
          cell.x === Math.floor(position.x)
          && cell.y === Math.floor(position.y)
          && cell.z === Math.floor(position.z)
        ))) return ref;
      }
    }
    return null;
  }

  async function removeParametricObject(ref: SemanticChunkObjectRef, trigger: string): Promise<boolean> {
    const result = await worldRuntime.getSource().sendCommand({
      type: "RemoveObject",
      userId: "editor_user",
      sessionId: "vplib_object_remove",
      position: ref.anchor,
      objectInstanceId: ref.objectInstanceId,
    }, {
      reason: "scene-runtime.remove-vplib-parametric-object",
      reloadDirtyChunks: false,
    });
    if (isChunkApiFailedResult(result)) {
      setStoreAction(store, {
        kind: "command/failed",
        error: result,
        source: trigger,
        createdAt: now(),
      });
      setDomLiveMessage(refs, "VPLIB-Objekt konnte nicht entfernt werden.");
      return false;
    }
    const commandResult = commandResultFromUnknown(result);
    for (const key of commandResult?.changedChunks ?? []) blockReconcileChunkKeys.add(key);
    scheduleBlockCommandReconcile("scene-runtime.remove-vplib-parametric-object");
    setDomLiveMessage(refs, "VPLIB-Objekt entfernt.");
    return true;
  }

  async function toggleParametricDoor(ref: SemanticChunkObjectRef, trigger: string): Promise<boolean> {
    const source = worldRuntime.getSource();
    const interactionState = asRecord(ref.metadata.interactionState);
    const nextOpen = !safeBoolean(interactionState.open, false);
    const payload = {
      type: "PlaceObject",
      userId: "editor_user",
      sessionId: "vplib_door_interaction",
      objectInstanceId: ref.objectInstanceId,
      position: ref.anchor,
      blockTypeId: ref.fillBlockTypeId,
      runtimeBlockTypeId: ref.fillBlockTypeId,
      objectTypeId: ref.objectTypeId,
      objectVariantId: ref.objectVariantId,
      objectKind: ref.objectKind,
      dimensions: ref.dimensions,
      footprint: ref.footprint,
      occupiedCells: ref.occupiedCells,
      metadata: {
        ...ref.metadata,
        interactionState: {
          ...interactionState,
          kind: "swing_door",
          open: nextOpen,
        },
        lastInteractionAt: now(),
        lastInteractionTrigger: trigger,
      },
      libraryContext: asRecord(ref.metadata.libraryPlacementContext),
    } as unknown as ChunkApiCommandPayload;
    const result = await source.sendCommand(payload, {
      reason: `scene-runtime.${nextOpen ? "open" : "close"}-vplib-door`,
      reloadDirtyChunks: false,
    });
    if (isChunkApiFailedResult(result)) {
      setStoreAction(store, {
        kind: "command/failed",
        error: result,
        source: trigger,
        createdAt: now(),
      });
      setDomLiveMessage(refs, "Tür konnte nicht geschaltet werden.");
      return false;
    }
    const commandResult = commandResultFromUnknown(result);
    for (const key of commandResult?.changedChunks ?? []) blockReconcileChunkKeys.add(key);
    scheduleBlockCommandReconcile("scene-runtime.toggle-vplib-door");
    setDomLiveMessage(refs, nextOpen ? "Tür geöffnet." : "Tür geschlossen.");
    return true;
  }

  async function removeBlock(intent: {
    readonly position: ChunkWorldPosition;
    readonly trigger: string;
  }): Promise<void> {
    removeIntentCount += 1;
    const removeStartedAtMs = nowMs();
    let optimisticEdit: PendingOptimisticBlockEdit | null = null;
    let commandStarted = false;
    let commandFinished = false;

    try {
      const source = worldRuntime.getSource();
      const interactiveDoor = parametricObjectAt(intent.position, "hinged_door");
      if (interactiveDoor) {
        await toggleParametricDoor(interactiveDoor, intent.trigger);
        return;
      }
      const parametricObject = parametricObjectAt(intent.position);
      if (parametricObject) {
        await removeParametricObject(parametricObject, intent.trigger);
        return;
      }

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

      optimisticEdit = registerOptimisticBlockEdit(intent.position, null);
      performanceRecorder?.recordEvent(
        "block-remove",
        "optimistic-applied",
        nowMs() - removeStartedAtMs,
        {
          chunkKey: optimisticEdit?.chunkKey ?? null,
          cellKey: optimisticEdit?.cellKey ?? null,
          pendingCommands: blockCommandsInFlight,
        },
      );
      blockCommandsInFlight += 1;
      commandStarted = true;
      refs.root.dataset.sceneRuntimePendingBlockCommands = String(blockCommandsInFlight);
      setDomLiveMessage(refs, "Block entfernt.");
      void prepareNextDepthChunk(intent.position);
      const requestStartedAtMs = nowMs();
      const result = await source.removeBlock(
        intent.position,
        {
          reason: intent.trigger,
          reloadDirtyChunks: false,
        },
      );
      performanceRecorder?.recordEvent(
        "block-remove",
        "server-result",
        nowMs() - requestStartedAtMs,
        {
          chunkKey: optimisticEdit?.chunkKey ?? null,
          failed: isChunkApiFailedResult(result),
          pendingCommands: blockCommandsInFlight,
        },
      );

      if (isChunkApiFailedResult(result)) {
        finishBlockCommand(
          optimisticEdit,
          false,
          "scene-runtime.removeBlock.failed",
        );
        commandFinished = true;
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
        refs.root.dataset.sceneRuntimeLastBlockCommandAt = now();
        refs.root.dataset.sceneRuntimeLastBlockCommandType = commandResult.commandType;
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

      finishBlockCommand(
        optimisticEdit,
        true,
        "scene-runtime.removeBlock.ready",
      );
      commandFinished = true;
      performanceRecorder?.recordEvent(
        "block-remove",
        "complete",
        nowMs() - removeStartedAtMs,
        {
          chunkKey: optimisticEdit?.chunkKey ?? null,
          pendingCommands: blockCommandsInFlight,
        },
      );
    } catch (error) {
      if (commandStarted && !commandFinished) {
        finishBlockCommand(
          optimisticEdit,
          false,
          "scene-runtime.removeBlock.exception",
        );
      }
      performanceRecorder?.recordEvent(
        "block-remove",
        "exception",
        nowMs() - removeStartedAtMs,
        { pendingCommands: blockCommandsInFlight },
      );
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
              readonly operation?: unknown;
              readonly source?: unknown;
              readonly selection_started_at_epoch_ms?: unknown;
              readonly selection_before_dispatch_ms?: unknown;
              readonly selection_state_ms?: unknown;
              readonly selection_render_ms?: unknown;
            };
          } | null;
          if (
            !message
            || message.source !== "vectoplan-library-user-inventory"
          ) {
            return;
          }

          const eventType = safeString(message.type, "");
          // The iframe can finish its API load before this listener is ready.
          // Its subsequent request-state response is therefore part of the
          // selection contract, not merely a WorldEdit notification.
          if (
            eventType !== "vectoplan:user-inventory-selection-change"
            && eventType !== "vectoplan:user-inventory-save"
            && eventType !== "vectoplan:user-inventory-load"
            && eventType !== "vectoplan:user-inventory-state"
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
          // The frame event is either an acknowledgement of an editor-owned
          // wheel/keyboard selection or a direct click inside the iframe. The
          // old path called HotbarController.selectSlot here, which rebuilt and
          // cloned the complete raw Library catalog. Real F8 captures measured
          // 0.84-1.98 s of main-thread work per acknowledgement. The editor
          // store is the runtime selection truth, so only apply the tiny slot
          // action when the iframe initiated a genuinely new selection.
          const selectionAlreadyApplied =
            store.peekState().inventory.selectedSlotIndex === zeroBasedSlot;
          const syncStartedAtMs = nowMs();
          if (!selectionAlreadyApplied) {
            setStoreAction(
              store,
              {
                kind: "inventory/select-slot",
                slot: zeroBasedSlot,
                source: "library-user-inventory-frame",
                createdAt: now(),
              },
              {
                notify: false,
                captureHistory: false,
              },
            );
          }
          performanceRecorder?.recordEvent(
            "hotbar-frame-sync",
            selectionAlreadyApplied ? "ack-skipped" : "slot-only",
            nowMs() - syncStartedAtMs,
            { zeroBasedSlot, eventType },
          );
          if (eventType === "vectoplan:user-inventory-selection-change") {
            const selectionStartedAtEpochMs = Number(
              message.detail?.selection_started_at_epoch_ms,
            );
            const selectionObservedMs = Number.isFinite(selectionStartedAtEpochMs)
              && selectionStartedAtEpochMs > 0
              ? Math.max(0, Date.now() - selectionStartedAtEpochMs)
              : 0;
            performanceRecorder?.recordEvent(
              "hotbar-library-selection",
              "message-received",
              selectionObservedMs,
              {
                zeroBasedSlot,
                source: safeString(message.detail?.source, "unknown"),
                beforeDispatchMs: Number(message.detail?.selection_before_dispatch_ms) || 0,
                stateUpdateMs: Number(message.detail?.selection_state_ms) || 0,
                renderMs: Number(message.detail?.selection_render_ms) || 0,
              },
            );
          }

          const inventoryOperation = safeString(
            message.detail?.operation,
            "",
          );
          const requiresCatalogReload =
            eventType === "vectoplan:user-inventory-load"
            || (
              eventType === "vectoplan:user-inventory-save"
              && inventoryOperation !== "select-slot"
            );
          if (requiresCatalogReload) {
            const reloadPromise = hotbarController
              ? hotbarController.reload("library-user-inventory-frame-sync")
              : source.reload({
                force: true,
                selectedSlot: zeroBasedSlot,
                selectedSlotIndex: zeroBasedSlot,
                reason: "library-user-inventory-frame-sync",
              });
            void reloadPromise.then(() => {
              hotbarController?.selectSlot(
                zeroBasedSlot,
                "library-user-inventory-frame-sync-ready",
              );
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
        renderToDom: false,
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
      try {
        chunkMeshWorkerClient = createChunkMeshWorkerClient();
        refs.root.dataset.sceneRuntimeChunkMeshingThread = "worker";
      } catch (error) {
        chunkMeshWorkerClient = null;
        refs.root.dataset.sceneRuntimeChunkMeshingThread = "main-thread-fallback";
        logWarn(logger, "Chunk mesh worker could not be created.", {
          error: normalizeUnknownError(error),
        });
      }
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
      geodataOverlayScene = createGeodataOverlayScene({
        parent: chunksRoot,
        autoAttachToThreeChunkGroup: true,
        ...(logger ? { logger: logger.child?.("geodata-overlays") ?? logger } : {}),
      });
      optimisticOverlayRoot = new THREE.Group();
      optimisticOverlayRoot.name = "vectoplan-editor-optimistic-blocks";
      scene.add(optimisticOverlayRoot);
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
      performanceRecorder = createPerformanceRecorder({
        root: refs.root,
        host: refs.viewportOverlay ?? refs.canvasHost,
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
      });
      refs.root.dataset.sceneRuntimeRenderProfile = "gameplay-performance";
      refs.root.dataset.sceneRuntimeAntialias = "false";
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
        maxDevicePixelRatio: Math.min(
          safeNumber(bootstrap.render.pixelRatioMax, GAMEPLAY_PIXEL_RATIO_MAX, {
            min: 0.5,
            max: 4,
          }),
          GAMEPLAY_PIXEL_RATIO_MAX,
        ),
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
        hotbarEnabled: false,
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
        pointerLockEnabled,
        requestPointerLockOnClick: pointerLockEnabled,
        preventDefault: true,
        // The scene consumes the accumulator directly. Mirroring every native
        // mouse event into the immutable app store adds work between rAF
        // callbacks and makes fast pointer motion feel delayed.
        dispatchToStore: false,
        onPerformanceEvent: (event) => {
          performanceRecorder?.recordEvent(
            event.type,
            event.phase,
            event.durationMs,
            event.detail,
          );
        },
        getTargetCells: () => ({
          sourceCell: latestSourceCell,
          placementCell: latestPlacementCell,
          targetPoint: latestTargetPoint,
        }),
        onWorldEditAction: async (intent) => {
          if (!worldEditIntentHandler) return false;
          return Boolean(await worldEditIntentHandler(intent));
        },
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
        onPickBlock: async (target) => {
          if(!target?.blockTypeId)return;
          const chunk=worldRuntime.getRegistry().getChunk(target.chunkKey);
          const palette=chunk?.paletteByBlockTypeId.get(target.blockTypeId);
          const object=chunk && semanticObjectRefs(chunk).find(ref=>ref.metadata.voxelOccupancy!=='none' && ref.occupiedCells.some(
            p=>p.x===target.worldX && p.y===target.worldY && p.z===target.worldZ));
          const item=pickBlockInventoryItem(target.blockTypeId,palette?.label??target.blockTypeId,palette?.metadata,object?.metadata);
          if(!item){setDomLiveMessage(refs,"Für diesen Block ist kein platzierbares VPLIB-Bauteil hinterlegt.");return;}
          const slot=store.peekState().inventory.selectedSlot;
          if(postPickedBlockToInventory(refs.root,item,slot))setDomLiveMessage(refs,"Anvisierter Block wird in den aktiven Inventarplatz übernommen.");
          else setDomLiveMessage(refs,"Das User-Inventar ist noch nicht bereit.");
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
        getEarthGridFrame: () => geodataOverlayScene?.getGroup().userData.earthGrid ?? null,
        terrainRegionUrl: (
          bootstrap.runtime.chunk.apiBaseUrl
          + "/projects/"
          + encodeURIComponent(bootstrap.runtime.chunk.projectId)
          + "/worlds/"
          + encodeURIComponent(bootstrap.runtime.chunk.worldId)
          + "/terrain/region"
        ),
        mapStructuresUrl: (
          bootstrap.runtime.chunk.apiBaseUrl
          + "/projects/"
          + encodeURIComponent(bootstrap.runtime.chunk.projectId)
          + "/worlds/"
          + encodeURIComponent(bootstrap.runtime.chunk.worldId)
          + "/map/structures"
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

      setDomBootMessage(refs, "Welt und Blockbibliothek werden geladen.");
      const inventoryInitialization = initializeLibraryInventory();
      await Promise.all([
        worldRuntime.initialize(),
        inventoryInitialization,
      ]);

      prepareEarthTerrainSpawn("initial-world-ready");
      const initialChunkSize = worldRuntime.getRegistry().getChunk(
        worldRuntime.getRegistry().getChunkKeys()[0] ?? "",
      )?.chunkSize ?? 16;
      const initialCameraCenter = worldToChunkCoordinates(
        {
          x: Math.floor(camera.position.x),
          y: Math.floor(camera.position.y),
          z: Math.floor(camera.position.z),
        },
        initialChunkSize,
      );
      const initialCenter = isEarthTerrainWorld()
        ? {
            ...initialCameraCenter,
            chunkY: earthStreamingChunkY ?? initialCameraCenter.chunkY,
          }
        : initialCameraCenter;
      const initialCenterKey = chunkKeyFromCoordinatesLocal(initialCenter);
      const initialVisibleRadius = safeInteger(bootstrap.render.visibleChunkRadius, 7, {
        min: 0,
        max: 16,
      });
      const initialPreloadRadius = configuredPreloadRadius();
      const initialWarmupRadius = Math.min(
        16,
        initialVisibleRadius + Math.max(INITIAL_WARMUP_EXTRA_RADIUS, initialPreloadRadius),
      );
      const initialWarmupMaxChunks = Math.min(
        4096,
        Math.max(
          safeInteger(bootstrap.runtime.chunk.maxBatchChunks, 256, {
            min: 1,
            max: 4096,
          }),
          ((initialWarmupRadius * 2 + 1) ** 2) + 64,
        ),
      );
      lastCameraChunk = initialCenter;
      lastCameraChunkKey = initialCenterKey;
      queuedCameraChunk = null;
      refs.root.dataset.initialVisibleChunkRadius = String(initialVisibleRadius);
      refs.root.dataset.initialWarmupChunkRadius = String(initialWarmupRadius);
      refs.root.dataset.initialWarmupMaxChunks = String(initialWarmupMaxChunks);

      await preloadVisibleMaterialTextures();
      chunkRenderingSuspended = false;
      renderChunksFromRegistry("scene-runtime.initialize-local-world");
      await drainInitialChunkMeshQueue();
      updateStreamingFog(initialVisibleRadius);
      setDomBootMessage(refs, "Editor ist bereit. Umgebung wird im Hintergrund geladen.");

      // The initial world already contains the local spawn chunk. Optional
      // geodata overlays and the radius reserve must never be a boot gate: a
      // missing Bigdata/GeoServer stack used to keep the complete editor behind
      // “1/18 Pakete” even though editable cells and roofs were available.
      const continueInitialStreaming = () => !destroyed && lastCameraChunkKey === initialCenterKey;
      const streamInitialEnvironment = async (): Promise<void> => {
        refs.root.dataset.initialStreamingStatus = "visible-loading";
        await worldRuntime.loadAroundChunk(initialCenter, {
          radius: initialVisibleRadius,
          reason: "scene-runtime.initial-visible-background",
          force: false,
          markVisible: true,
          preferBatch: true,
          contentProfile: isEarthTerrainWorld() ? "surface-shell.v1" : undefined,
          maxChunks: initialWarmupMaxChunks,
          batchSize: 12,
          shouldContinue: continueInitialStreaming,
          onBatchLoaded: (progress) => {
            if (!continueInitialStreaming()) return;
            refs.root.dataset.initialStreamingProgress = `${Math.min(progress.batchIndex + 1, progress.batchCount)}/${progress.batchCount}`;
            renderChunksFromRegistry("scene-runtime.initial-visible-progress");
          },
        });
        if (!continueInitialStreaming()) return;
        if (isEarthTerrainWorld()) {
          await loadTerrainSurfaceLayers(
            initialCenter,
            initialVisibleRadius,
            initialCenterKey,
            { chunkX: 0, chunkY: 0, chunkZ: 0 },
          );
        }
        renderChunksFromRegistry("scene-runtime.initial-visible-background-complete");
        await drainInitialChunkMeshQueue();
        if (!continueInitialStreaming()) return;

        refs.root.dataset.initialStreamingStatus = "reserve-loading";
        const reserveCoordinates = visibleChunkCoordinatesAround(initialCenter, initialWarmupRadius, {
          radial: true,
          verticalRadius: 0,
        });
        await worldRuntime.getLoader().loadCoordinates(reserveCoordinates, {
          reason: "scene-runtime.initial-reserve-background",
          force: false,
          markVisible: false,
          preferBatch: true,
          contentProfile: isEarthTerrainWorld() ? "surface-shell.v1" : undefined,
          maxChunks: initialWarmupMaxChunks,
          batchSize: 12,
          shouldContinue: continueInitialStreaming,
        });
        if (!continueInitialStreaming()) return;
        if (isEarthTerrainWorld()) {
          await loadTerrainSurfaceLayers(
            initialCenter,
            initialWarmupRadius,
            initialCenterKey,
            { chunkX: 0, chunkY: 0, chunkZ: 0 },
          );
        }
        refs.root.dataset.initialStreamingStatus = "ready";
      };

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
      void streamInitialEnvironment().catch((error) => {
        if (destroyed) return;
        refs.root.dataset.initialStreamingStatus = "degraded";
        logWarn(logger, "Initial environment streaming degraded; editor remains usable.", {
          error: normalizeUnknownError(error),
          centerChunkKey: initialCenterKey,
        });
        setDomLiveMessage(refs, "Editor ist bereit. Optionale Umgebungsdaten sind derzeit nur teilweise verfügbar.");
      });

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
      if (blockReconcileTimerId !== null) {
        window.clearTimeout(blockReconcileTimerId);
        blockReconcileTimerId = null;
      }
      if (blockShadowRefreshTimerId !== null) {
        window.clearTimeout(blockShadowRefreshTimerId);
        blockShadowRefreshTimerId = null;
      }
      if (semanticMigrationTimerId !== null) {
        window.clearTimeout(semanticMigrationTimerId);
        semanticMigrationTimerId = null;
      }
      pendingSemanticMigrations.clear();
      settledSemanticMigrationKeys.clear();
      pendingOptimisticBlockEdits.clear();
      blockReconcileChunkKeys.clear();

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
      performanceRecorder?.destroy();
      performanceRecorder = null;
      chunkMeshWorkerClient?.destroy();
      chunkMeshWorkerClient = null;
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
      if (geodataOverlaySyncTimerId !== null) {
        window.clearTimeout(geodataOverlaySyncTimerId);
        geodataOverlaySyncTimerId = null;
      }
      geodataOverlayScene?.dispose(reason ?? "scene-runtime.destroy");
      geodataOverlayScene = null;
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
    optimisticOverlayRoot = null;

    destroyedAt = now();
    worldEditIntentHandler = null;
    worldEditTargetMaxDistance = DEFAULT_TARGET_MAX_DISTANCE;
    placementConstraintHandler = null;
    placementGeometryHandler = null;
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

    getGeodataOverlayScene(): GeodataOverlaySceneHandle | null {
      return geodataOverlayScene;
    },

    getTargetCells() {
      return {
        sourceCell: latestSourceCell,
        placementCell: latestPlacementCell,
        targetPoint: latestTargetPoint,
      };
    },

    getSelectedLibraryPlacement(): ActiveLibraryPlacement {
      return getActiveLibraryPlacement(null);
    },

    setWorldEditIntentHandler(
      handler: SceneWorldEditIntentHandler | null,
      handlerOptions?: Readonly<{ maxDistance?: number }>,
    ): void {
      worldEditIntentHandler = handler;
      worldEditTargetMaxDistance = handler
        ? safeNumber(handlerOptions?.maxDistance, DEFAULT_TARGET_MAX_DISTANCE, { min: 9, max: 96 })
        : DEFAULT_TARGET_MAX_DISTANCE;
    },

    setPlacementConstraintHandler(handler: ScenePlacementConstraintHandler | null): void {
      placementConstraintHandler = handler;
    },

    setPlacementGeometryHandler(handler: ScenePlacementGeometryHandler | null): void {
      placementGeometryHandler = handler;
    },

    refreshPlacementGeometry(reason = "scene-runtime.placement-geometry-refresh"): void {
      // Geometry queued under an older parcel selection must never be written
      // after the user changes the selected lots or moves the 3 m guide.
      pendingSemanticMigrations.clear();
      settledSemanticMigrationKeys.clear();
      refs.root.dataset.sceneRuntimePendingSemanticMigrations = "0";
      lastChunkMeshQueueReason = reason;
      for (const key of worldRuntime.getSource().getLoadedChunkKeys()) enqueueChunkMeshKey(key, true);
      scheduleChunkMeshProcessing();
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
        pendingChunkMeshCount: pendingChunkMeshKeys.length,
        chunkMeshQueueHighWaterMark,
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
        geodataOverlays: geodataOverlayScene?.getSnapshot() ?? null,
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
