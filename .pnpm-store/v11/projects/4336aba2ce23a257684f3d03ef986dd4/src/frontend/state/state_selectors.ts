// services/vectoplan-editor/src/frontend/state/state_selectors.ts
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
} from "@api/editor_inventory_models";
import type {
  ChunkApiCommandResult,
  ChunkApiErrorDetails,
} from "@api/chunk_api_models";
import type {
  EditorCameraState,
  EditorCommandState,
  EditorConnectionStatus,
  EditorCreativeLibraryItem,
  EditorCreativeLibraryState,
  EditorDebugState,
  EditorInputState,
  EditorInventoryHotbarSlot,
  EditorInventoryItem,
  EditorInventoryPlacementRef,
  EditorInventoryState,
  EditorLifecycleState,
  EditorLifecycleStatus,
  EditorProjectState,
  EditorRenderState,
  EditorState,
  EditorStateChunkCellPosition,
  EditorStateVector3,
  EditorTargetState,
  EditorToolId,
  EditorToolState,
  EditorUiState,
  EditorViewportState,
  EditorWorldState,
} from "./editor_state";
import type {
  EditorPlayerState,
  PlayerDebugState,
} from "./player_state";
import type {
  CollisionFlags,
  PhysicsCameraBinding,
  PhysicsEulerAngles,
  PhysicsVector3,
  PlayerMovementMode,
  PlayerPhysicsState,
} from "../runtime/physics/physics_models";
import {
  EMPTY_COLLISION_FLAGS,
  ZERO_PHYSICS_ANGLES,
  ZERO_PHYSICS_VECTOR,
} from "../runtime/physics/physics_models";

export type EditorStateSelector<T> = (state: EditorState) => T;

export type EditorStateComparator<T> = (left: T, right: T) => boolean;

export interface EditorRuntimeReadiness {
  readonly bootReady: boolean;
  readonly worldReady: boolean;
  readonly inventoryReady: boolean;
  readonly renderReady: boolean;
  readonly playerReady: boolean;
  readonly canInteract: boolean;
  readonly blockingReason: string | null;
}

export interface EditorWorldSourceSummary {
  readonly sourceKind: "chunk-service";
  readonly apiBaseUrl: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly status: EditorConnectionStatus;
  readonly loadedChunkCount: number;
  readonly dirtyChunkCount: number;
  readonly visibleChunkCount: number;
  readonly lastError: ChunkApiErrorDetails | null;
}

export interface EditorSelectedBlockSummary {
  readonly slot: number;
  readonly selectedSlotIndex: number;

  /**
   * Legacy alias. For Library/VPLIB inventory this is the runtimeBlockTypeId.
   */
  readonly blockTypeId: string | null;

  readonly runtimeBlockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly label: string;
  readonly shortLabel: string;
  readonly cellValue: number | null;
  readonly color: string | null;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly enabled: boolean;
  readonly placeable: boolean;
  readonly placementRef: EditorInventoryPlacementRef;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly itemKind: EditorInventoryItem["kind"];
  readonly sourceKind: EditorInventoryItem["sourceKind"];
}

export interface EditorTargetSummary {
  readonly kind: EditorTargetState["kind"];
  readonly status: EditorTargetState["status"];
  readonly canPlace: boolean;
  readonly canRemove: boolean;
  readonly chunkKey: string | null;
  readonly sourceCell: EditorStateChunkCellPosition | null;
  readonly placementCell: EditorStateChunkCellPosition | null;
  readonly reason: string | null;
}

export interface EditorCommandSummary {
  readonly status: EditorCommandState["status"];
  readonly pending: boolean;
  readonly lastCommandType: string | null;
  readonly changed: boolean;
  readonly dirtyChunkKeys: readonly string[];
  readonly changedChunkKeys: readonly string[];
  readonly lastError: ChunkApiErrorDetails | null;
  readonly lastResult: ChunkApiCommandResult | null;
}

export interface EditorUiSummary {
  readonly loading: boolean;
  readonly errorVisible: boolean;
  readonly errorTitle: string | null;
  readonly errorMessage: string | null;
  readonly sourceStatusLabel: string;
  readonly hotbarVisible: boolean;
  readonly crosshairVisible: boolean;
  readonly debugOverlayVisible: boolean;
}

export interface EditorDebugSummary {
  readonly enabled: boolean;
  readonly lastAction: string | null;
  readonly warnings: readonly string[];
  readonly errors: readonly ChunkApiErrorDetails[];
  readonly bootstrapWarnings: readonly string[];
  readonly player: PlayerDebugState | null;
}

export interface EditorInventorySummary {
  readonly status: EditorConnectionStatus;
  readonly source: EditorInventoryState["source"];
  readonly slotCount: number;
  readonly selectedSlot: number;
  readonly selectedSlotIndex: number;

  /**
   * Legacy alias. For Library/VPLIB inventory this is the selected runtimeBlockTypeId.
   */
  readonly selectedBlockTypeId: string | null;

  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedCellValue: number | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedPackageId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedVariantId: string | null;
  readonly selectedRevisionHash: string | null;
  readonly selectedObjectKind: string | null;
  readonly selectedLibraryRef: EditorInventoryLibraryRef | null;
  readonly selectedPlacementCommand: EditorInventoryPlacementCommand | null;
  readonly itemCount: number;
  readonly libraryItemCount: number;
  readonly placeableItemCount: number;
  readonly hotbarSlotCount: number;
  readonly blockTypeIds: readonly string[];
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly packageIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly usedPaletteFallback: boolean;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;
  readonly hasForbiddenDebugBlockIds: boolean;
  readonly lastLoadedAt: string | null;
  readonly lastError: ChunkApiErrorDetails | null;
}

export interface EditorCreativeLibrarySummary {
  readonly status: EditorConnectionStatus;
  readonly source: EditorCreativeLibraryState["source"];
  readonly itemCount: number;
  readonly totalCount: number;
  readonly blockTypeIds: readonly string[];
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly packageIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly categoryIds: readonly string[];
  readonly lastLoadedAt: string | null;
  readonly lastError: ChunkApiErrorDetails | null;
}

export interface EditorPlayerSummary {
  readonly status: EditorPlayerState["status"];
  readonly source: EditorPlayerState["source"];
  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly position: PhysicsVector3;
  readonly velocity: PhysicsVector3;
  readonly eyePosition: PhysicsVector3;
  readonly angles: PhysicsEulerAngles;
  readonly collisionFlags: CollisionFlags;
  readonly physicsRevision: number;
  readonly storeRevision: number;
  readonly lastGroundedAtMs: number | null;
  readonly lastJumpAtMs: number | null;
  readonly lastFlightToggleAtMs: number | null;
  readonly lastErrorMessage: string | null;
  readonly warnings: readonly string[];
}

export interface EditorPlayerMovementSummary {
  readonly movementMode: PlayerMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly moving: boolean;
  readonly falling: boolean;
  readonly rising: boolean;
  readonly horizontalSpeed: number;
  readonly verticalSpeed: number;
  readonly totalSpeed: number;
  readonly blocked: boolean;
  readonly blockedByMissingChunk: boolean;
}

export interface EditorActivePlacementSummary {
  readonly valid: boolean;
  readonly blockedReason: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly blockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly label: string | null;
  readonly itemKind: EditorInventoryItem["kind"] | null;
  readonly sourceKind: EditorInventoryItem["sourceKind"] | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
}

export interface CachedEditorStateSelector<T> {
  readonly select: EditorStateSelector<T>;
  readonly clear: () => void;
  readonly getHitCount: () => number;
  readonly getMissCount: () => number;
}

function safeArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeString(value: unknown, fallback: string): string {
  try {
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function safeNullableString(value: unknown, fallback: string | null = null): string | null {
  try {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : fallback;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(value: unknown, fallback: number): number {
  try {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function safeInteger(value: unknown, fallback: number): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value.trim(), 10)
          : Number.NaN;

    return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
  } catch {
    return fallback;
  }
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function uniqueStrings(values: readonly unknown[]): readonly string[] {
  try {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const normalized = safeString(value, "").trim();

      if (normalized.length === 0 || seen.has(normalized) || isForbiddenDebugBlockTypeId(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(normalized);
    }

    return result;
  } catch {
    return [];
  }
}

function defaultComparator<T>(left: T, right: T): boolean {
  return Object.is(left, right);
}

function isReadyOrDegraded(status: EditorConnectionStatus): boolean {
  return status === "ready" || status === "degraded";
}

function isInteractableLifecycleStatus(status: EditorLifecycleStatus): boolean {
  return status === "ready" || status === "degraded";
}

function normalizeSlot(slot: unknown, slotCount: number): number {
  try {
    return Math.max(0, Math.min(Math.max(0, slotCount - 1), safeInteger(slot, 0)));
  } catch {
    return 0;
  }
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "");
  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

function normalizeRuntimeBlockTypeId(value: unknown): string | null {
  try {
    const normalized = safeNullableString(value, null);

    if (!normalized || isForbiddenDebugBlockTypeId(normalized)) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

function normalizeBlockTypeId(value: unknown): string | null {
  return normalizeRuntimeBlockTypeId(value);
}

function emptyPlacementRef(): EditorInventoryPlacementRef {
  return {
    kind: "unknown",
    blockTypeId: null,
    runtimeBlockTypeId: null,
    assetTypeId: null,
    libraryItemId: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    libraryRef: null,
    placementCommand: null,
  };
}

function safePhysicsVector3(
  value: Partial<PhysicsVector3> | null | undefined,
  fallback: PhysicsVector3 = ZERO_PHYSICS_VECTOR,
): PhysicsVector3 {
  try {
    return {
      x: safeNumber(value?.x, fallback.x),
      y: safeNumber(value?.y, fallback.y),
      z: safeNumber(value?.z, fallback.z),
    };
  } catch {
    return fallback;
  }
}

function safePhysicsAngles(
  value: Partial<PhysicsEulerAngles> | null | undefined,
  fallback: PhysicsEulerAngles = ZERO_PHYSICS_ANGLES,
): PhysicsEulerAngles {
  try {
    return {
      yaw: safeNumber(value?.yaw, fallback.yaw),
      pitch: safeNumber(value?.pitch, fallback.pitch),
      roll: safeNumber(value?.roll ?? 0, fallback.roll ?? 0),
    };
  } catch {
    return fallback;
  }
}

function safeCollisionFlags(
  value: Partial<CollisionFlags> | null | undefined,
): CollisionFlags {
  try {
    return {
      grounded: safeBoolean(value?.grounded, EMPTY_COLLISION_FLAGS.grounded),
      hitCeiling: safeBoolean(value?.hitCeiling, EMPTY_COLLISION_FLAGS.hitCeiling),
      hitWallX: safeBoolean(value?.hitWallX, EMPTY_COLLISION_FLAGS.hitWallX),
      hitWallZ: safeBoolean(value?.hitWallZ, EMPTY_COLLISION_FLAGS.hitWallZ),
      hitHorizontalWall: safeBoolean(
        value?.hitHorizontalWall,
        Boolean(value?.hitWallX || value?.hitWallZ),
      ),
      touchedSolid: safeBoolean(value?.touchedSolid, EMPTY_COLLISION_FLAGS.touchedSolid),
      blockedByMissingChunk: safeBoolean(
        value?.blockedByMissingChunk,
        EMPTY_COLLISION_FLAGS.blockedByMissingChunk,
      ),
    };
  } catch {
    return EMPTY_COLLISION_FLAGS;
  }
}

function normalizePlayerMovementMode(value: unknown, fallback: PlayerMovementMode = "airborne"): PlayerMovementMode {
  try {
    if (value === "grounded" || value === "airborne" || value === "flying") {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function computeVectorLength(value: PhysicsVector3): number {
  try {
    const x = safeNumber(value.x, 0);
    const y = safeNumber(value.y, 0);
    const z = safeNumber(value.z, 0);

    return Math.sqrt((x * x) + (y * y) + (z * z));
  } catch {
    return 0;
  }
}

function computeHorizontalSpeed(value: PhysicsVector3): number {
  try {
    const x = safeNumber(value.x, 0);
    const z = safeNumber(value.z, 0);

    return Math.sqrt((x * x) + (z * z));
  } catch {
    return 0;
  }
}

function itemHasLibraryIdentity(item: EditorInventoryItem | null): boolean {
  if (!item) {
    return false;
  }

  return Boolean(
    item.libraryRef
      || item.placementCommand
      || item.libraryItemId
      || item.familyId
      || item.vplibUid,
  );
}

function placementRefHasLibraryIdentity(ref: EditorInventoryPlacementRef | null): boolean {
  if (!ref) {
    return false;
  }

  return Boolean(
    ref.libraryRef
      || ref.placementCommand
      || ref.libraryItemId
      || ref.familyId
      || ref.vplibUid,
  );
}

function isLibraryInventoryItem(item: EditorInventoryItem | null): boolean {
  if (!item) {
    return false;
  }

  if (item.kind === "library-item" || item.kind === "vplib") {
    return true;
  }

  return itemHasLibraryIdentity(item);
}

function isPlaceableLibraryItem(item: EditorInventoryItem | null): boolean {
  if (!item) {
    return false;
  }

  const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(item.runtimeBlockTypeId ?? item.blockTypeId);

  return Boolean(
    item.enabled === true
      && item.placeable === true
      && runtimeBlockTypeId
      && isLibraryInventoryItem(item),
  );
}

function hasForbiddenDebugBlockIdsInUnknown(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);

    return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.some((id) => serialized.includes(id));
  } catch {
    return false;
  }
}

export function createSafeEditorSelector<T>(
  selector: EditorStateSelector<T>,
  fallback: T,
): EditorStateSelector<T> {
  return (state: EditorState): T => {
    try {
      return selector(state);
    } catch {
      return fallback;
    }
  };
}

export function createCachedEditorSelector<T>(
  selector: EditorStateSelector<T>,
  comparator: EditorStateComparator<T> = defaultComparator,
): CachedEditorStateSelector<T> {
  let hasValue = false;
  let lastState: EditorState | null = null;
  let lastValue: T | undefined;
  let hitCount = 0;
  let missCount = 0;

  return {
    select(state: EditorState): T {
      try {
        if (hasValue && lastState === state) {
          hitCount += 1;
          return lastValue as T;
        }

        const nextValue = selector(state);

        if (hasValue && comparator(lastValue as T, nextValue)) {
          lastState = state;
          hitCount += 1;
          return lastValue as T;
        }

        hasValue = true;
        lastState = state;
        lastValue = nextValue;
        missCount += 1;

        return nextValue;
      } catch {
        if (hasValue) {
          hitCount += 1;
          return lastValue as T;
        }

        throw new Error("Cached editor selector failed before an initial value was available.");
      }
    },

    clear(): void {
      hasValue = false;
      lastState = null;
      lastValue = undefined;
      hitCount = 0;
      missCount = 0;
    },

    getHitCount(): number {
      return hitCount;
    },

    getMissCount(): number {
      return missCount;
    },
  };
}

export function shallowEqualArray<T>(left: readonly T[], right: readonly T[]): boolean {
  try {
    if (left === right) {
      return true;
    }

    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!Object.is(left[index], right[index])) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function shallowEqualRecord(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  try {
    if (left === right) {
      return true;
    }

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!Object.is(left[key], right[key])) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function shallowEqualVector3(left: PhysicsVector3, right: PhysicsVector3): boolean {
  try {
    return (
      Object.is(left.x, right.x)
      && Object.is(left.y, right.y)
      && Object.is(left.z, right.z)
    );
  } catch {
    return false;
  }
}

export function shallowEqualAngles(left: PhysicsEulerAngles, right: PhysicsEulerAngles): boolean {
  try {
    return (
      Object.is(left.yaw, right.yaw)
      && Object.is(left.pitch, right.pitch)
      && Object.is(left.roll ?? 0, right.roll ?? 0)
    );
  } catch {
    return false;
  }
}

export function selectBootstrap(state: EditorState) {
  return state.bootstrap;
}

export function selectBuild(state: EditorState) {
  return state.build;
}

export function selectLifecycle(state: EditorState): EditorLifecycleState {
  return state.lifecycle;
}

export function selectLifecycleStatus(state: EditorState): EditorLifecycleStatus {
  return state.lifecycle.status;
}

export function selectIsBooting(state: EditorState): boolean {
  return (
    state.lifecycle.status === "created"
    || state.lifecycle.status === "bootstrapping"
    || state.lifecycle.status === "initializing"
    || state.lifecycle.status === "loading"
  );
}

export function selectIsReady(state: EditorState): boolean {
  return state.lifecycle.status === "ready";
}

export function selectIsDegraded(state: EditorState): boolean {
  return state.lifecycle.status === "degraded" || state.world.connection.status === "degraded";
}

export function selectIsDestroyed(state: EditorState): boolean {
  return state.lifecycle.status === "destroyed" || state.lifecycle.status === "destroying";
}

export function selectHasFatalError(state: EditorState): boolean {
  return state.lifecycle.status === "failed" || state.ui.errorVisible === true;
}

export function selectProject(state: EditorState): EditorProjectState {
  return state.project;
}

export function selectProjectId(state: EditorState): string {
  return state.project.projectId;
}

export function selectUniverseId(state: EditorState): string | null {
  return state.project.universeId;
}

export function selectWorldId(state: EditorState): string {
  return state.project.worldId;
}

export function selectViewport(state: EditorState): EditorViewportState {
  return state.viewport;
}

export function selectViewportSize(state: EditorState): { readonly width: number; readonly height: number } {
  return {
    width: safeNumber(state.viewport.width, 0),
    height: safeNumber(state.viewport.height, 0),
  };
}

export function selectViewportAspect(state: EditorState): number {
  return safeNumber(state.viewport.aspect, 1);
}

export function selectHasCanvas(state: EditorState): boolean {
  return state.viewport.hasCanvas;
}

export function selectInput(state: EditorState): EditorInputState {
  return state.input;
}

export function selectPointerLocked(state: EditorState): boolean {
  return state.input.pointerLocked;
}

export function selectPointerLockAvailable(state: EditorState): boolean {
  return state.input.pointerLockAvailable;
}

export function selectPressedKeys(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.input.pressedKeys));
}

export function selectIsKeyPressed(state: EditorState, key: string): boolean {
  try {
    const normalized = key.trim().toLowerCase();

    return state.input.pressedKeys.some((pressedKey) => pressedKey.toLowerCase() === normalized);
  } catch {
    return false;
  }
}

export function selectCamera(state: EditorState): EditorCameraState {
  return state.camera;
}

export function selectCameraPosition(state: EditorState): EditorStateVector3 {
  return state.camera.position;
}

export function selectCameraRotation(state: EditorState) {
  return state.camera.rotation;
}

export function selectCameraForwardHint(state: EditorState): EditorStateVector3 {
  try {
    const pitch = state.camera.rotation.pitch;
    const yaw = state.camera.rotation.yaw;
    const cosPitch = Math.cos(pitch);

    return {
      x: Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    };
  } catch {
    return {
      x: 0,
      y: 0,
      z: -1,
    };
  }
}

export function selectPlayer(state: EditorState): EditorPlayerState {
  return state.player;
}

export function selectPlayerPhysicsState(state: EditorState): PlayerPhysicsState {
  return state.player.physics;
}

export function selectPlayerStatus(state: EditorState): EditorPlayerState["status"] {
  return state.player.status;
}

export function selectPlayerSource(state: EditorState): EditorPlayerState["source"] {
  return state.player.source;
}

export function selectPlayerPosition(state: EditorState): PhysicsVector3 {
  return safePhysicsVector3(state.player.position);
}

export function selectPlayerBodyPosition(state: EditorState): PhysicsVector3 {
  return selectPlayerPosition(state);
}

export function selectPlayerEyePosition(state: EditorState): PhysicsVector3 {
  return safePhysicsVector3(state.player.eyePosition, selectPlayerPosition(state));
}

export function selectPlayerVelocity(state: EditorState): PhysicsVector3 {
  return safePhysicsVector3(state.player.velocity);
}

export function selectPlayerAngles(state: EditorState): PhysicsEulerAngles {
  return safePhysicsAngles(state.player.angles);
}

export function selectPlayerCameraBinding(state: EditorState): PhysicsCameraBinding {
  return {
    bodyPosition: selectPlayerBodyPosition(state),
    eyePosition: selectPlayerEyePosition(state),
    angles: selectPlayerAngles(state),
  };
}

export function selectPlayerMovementMode(state: EditorState): PlayerMovementMode {
  return normalizePlayerMovementMode(state.player.movementMode);
}

export function selectPlayerGrounded(state: EditorState): boolean {
  return state.player.grounded === true || state.player.movementMode === "grounded";
}

export function selectPlayerFlying(state: EditorState): boolean {
  return state.player.flying === true || state.player.movementMode === "flying";
}

export function selectPlayerAirborne(state: EditorState): boolean {
  return !selectPlayerGrounded(state) && !selectPlayerFlying(state);
}

export function selectPlayerCollisionFlags(state: EditorState): CollisionFlags {
  return safeCollisionFlags(state.player.collisionFlags);
}

export function selectPlayerBlockedByMissingChunk(state: EditorState): boolean {
  return selectPlayerCollisionFlags(state).blockedByMissingChunk;
}

export function selectPlayerHitHorizontalWall(state: EditorState): boolean {
  const flags = selectPlayerCollisionFlags(state);

  return flags.hitHorizontalWall || flags.hitWallX || flags.hitWallZ;
}

export function selectPlayerHitCeiling(state: EditorState): boolean {
  return selectPlayerCollisionFlags(state).hitCeiling;
}

export function selectPlayerHorizontalSpeed(state: EditorState): number {
  return computeHorizontalSpeed(selectPlayerVelocity(state));
}

export function selectPlayerVerticalSpeed(state: EditorState): number {
  return safeNumber(selectPlayerVelocity(state).y, 0);
}

export function selectPlayerTotalSpeed(state: EditorState): number {
  return computeVectorLength(selectPlayerVelocity(state));
}

export function selectPlayerMoving(state: EditorState): boolean {
  return selectPlayerTotalSpeed(state) > 0.0001;
}

export function selectPlayerFalling(state: EditorState): boolean {
  return !selectPlayerGrounded(state) && !selectPlayerFlying(state) && selectPlayerVerticalSpeed(state) < -0.0001;
}

export function selectPlayerRising(state: EditorState): boolean {
  return !selectPlayerGrounded(state) && !selectPlayerFlying(state) && selectPlayerVerticalSpeed(state) > 0.0001;
}

export function selectPlayerLastError(state: EditorState) {
  return state.player.lastError;
}

export function selectPlayerWarnings(state: EditorState): readonly string[] {
  return safeArray(state.player.warnings);
}

export function selectPlayerDebugState(state: EditorState): PlayerDebugState | null {
  return state.debug.player;
}

export function selectPlayerSummary(state: EditorState): EditorPlayerSummary {
  return {
    status: state.player.status,
    source: state.player.source,
    movementMode: selectPlayerMovementMode(state),
    grounded: selectPlayerGrounded(state),
    flying: selectPlayerFlying(state),
    position: selectPlayerPosition(state),
    velocity: selectPlayerVelocity(state),
    eyePosition: selectPlayerEyePosition(state),
    angles: selectPlayerAngles(state),
    collisionFlags: selectPlayerCollisionFlags(state),
    physicsRevision: safeInteger(state.player.physicsRevision, 0),
    storeRevision: safeInteger(state.player.storeRevision, 0),
    lastGroundedAtMs: state.player.lastGroundedAtMs,
    lastJumpAtMs: state.player.lastJumpAtMs,
    lastFlightToggleAtMs: state.player.lastFlightToggleAtMs,
    lastErrorMessage: state.player.lastError?.message ?? null,
    warnings: selectPlayerWarnings(state),
  };
}

export function selectPlayerMovementSummary(state: EditorState): EditorPlayerMovementSummary {
  return {
    movementMode: selectPlayerMovementMode(state),
    grounded: selectPlayerGrounded(state),
    flying: selectPlayerFlying(state),
    moving: selectPlayerMoving(state),
    falling: selectPlayerFalling(state),
    rising: selectPlayerRising(state),
    horizontalSpeed: selectPlayerHorizontalSpeed(state),
    verticalSpeed: selectPlayerVerticalSpeed(state),
    totalSpeed: selectPlayerTotalSpeed(state),
    blocked: selectPlayerHitHorizontalWall(state) || selectPlayerHitCeiling(state),
    blockedByMissingChunk: selectPlayerBlockedByMissingChunk(state),
  };
}

export function selectWorld(state: EditorState): EditorWorldState {
  return state.world;
}

export function selectWorldConnectionStatus(state: EditorState): EditorConnectionStatus {
  return state.world.connection.status;
}

export function selectWorldConnectionError(state: EditorState): ChunkApiErrorDetails | null {
  return state.world.connection.lastError;
}

export function selectWorldSourceSummary(state: EditorState): EditorWorldSourceSummary {
  return {
    sourceKind: "chunk-service",
    apiBaseUrl: state.world.connection.apiBaseUrl,
    projectId: state.world.connection.projectId,
    worldId: state.world.connection.worldId,
    status: state.world.connection.status,
    loadedChunkCount: state.world.chunkCount,
    dirtyChunkCount: state.world.dirtyChunkCount,
    visibleChunkCount: state.world.visibleChunkCount,
    lastError: state.world.connection.lastError,
  };
}

export function selectLoadedChunkKeys(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.world.loadedChunkKeys));
}

export function selectVisibleChunkKeys(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.world.visibleChunkKeys));
}

export function selectDirtyChunkKeys(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.world.dirtyChunkKeys));
}

export function selectFailedChunkKeys(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.world.failedChunkKeys));
}

export function selectHasDirtyChunks(state: EditorState): boolean {
  return state.world.dirtyChunkCount > 0 || state.world.dirtyChunkKeys.length > 0;
}

export function selectChunkSummary(state: EditorState, chunkKey: string) {
  try {
    return state.world.chunksByKey[chunkKey] ?? null;
  } catch {
    return null;
  }
}

export function selectLastLoadedChunkKey(state: EditorState): string | null {
  return state.world.lastLoadedChunkKey;
}

export function selectInventory(state: EditorState): EditorInventoryState {
  return state.inventory;
}

export function selectInventoryStatus(state: EditorState): EditorConnectionStatus {
  return state.inventory.status;
}

export function selectInventoryHasForbiddenDebugBlockIds(state: EditorState): boolean {
  return hasForbiddenDebugBlockIdsInUnknown(state.inventory);
}

export function selectCreativeLibraryHasForbiddenDebugBlockIds(state: EditorState): boolean {
  return hasForbiddenDebugBlockIdsInUnknown(state.creativeLibrary);
}

export function selectInventoryReady(state: EditorState): boolean {
  try {
    // Empty hotbar slots, including a completely empty hotbar, are a valid
    // interactive state. Readiness describes the completed data load only;
    // placement validity belongs exclusively to the currently selected slot.
    return (
      isReadyOrDegraded(state.inventory.status)
      && selectInventoryHasForbiddenDebugBlockIds(state) === false
    );
  } catch {
    return false;
  }
}

export function selectInventoryItems(state: EditorState): readonly EditorInventoryItem[] {
  return safeArray(state.inventory.items);
}

export function selectInventoryLibraryItems(state: EditorState): readonly EditorInventoryItem[] {
  try {
    return selectInventoryItems(state).filter((item) => isLibraryInventoryItem(item));
  } catch {
    return [];
  }
}

export function selectInventoryPlaceableItems(state: EditorState): readonly EditorInventoryItem[] {
  try {
    return selectInventoryItems(state).filter((item) => isPlaceableLibraryItem(item));
  } catch {
    return [];
  }
}

export function selectInventoryHotbarSlots(state: EditorState): readonly EditorInventoryHotbarSlot[] {
  return safeArray(state.inventory.hotbarSlots);
}

export function selectInventoryBlockTypeIds(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.inventory.blockTypeIds));
}

export function selectInventoryRuntimeBlockTypeIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.inventory.runtimeBlockTypeIds).length > 0
      ? safeArray(state.inventory.runtimeBlockTypeIds)
      : selectInventoryItems(state).map((item) => item.runtimeBlockTypeId ?? item.blockTypeId ?? ""),
  );
}

export function selectInventoryLibraryItemIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.inventory.libraryItemIds).length > 0
      ? safeArray(state.inventory.libraryItemIds)
      : selectInventoryItems(state).map((item) => item.libraryItemId ?? ""),
  );
}

export function selectInventoryFamilyIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.inventory.familyIds).length > 0
      ? safeArray(state.inventory.familyIds)
      : selectInventoryItems(state).map((item) => item.familyId ?? ""),
  );
}

export function selectInventoryPackageIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    selectInventoryItems(state).map((item) => item.packageId ?? ""),
  );
}

export function selectInventoryVplibUids(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.inventory.vplibUids).length > 0
      ? safeArray(state.inventory.vplibUids)
      : selectInventoryItems(state).map((item) => item.vplibUid ?? ""),
  );
}

export function selectSelectedSlot(state: EditorState): number {
  return normalizeSlot(
    state.inventory.selectedSlotIndex ?? state.inventory.selectedSlot,
    state.inventory.slotCount,
  );
}

export function selectSelectedSlotIndex(state: EditorState): number {
  return selectSelectedSlot(state);
}

export function selectSelectedInventorySlot(state: EditorState): EditorInventoryHotbarSlot | null {
  try {
    const selectedSlot = selectSelectedSlot(state);

    return state.inventory.hotbarSlots.find((slot) => slot.slot === selectedSlot) ?? null;
  } catch {
    return null;
  }
}

export function selectSelectedInventoryItem(state: EditorState): EditorInventoryItem | null {
  try {
    const selectedSlot = selectSelectedSlot(state);
    const selectedItem = state.inventory.selectedItem;

    if (selectedItem && selectedItem.slot === selectedSlot) {
      return selectedItem;
    }

    return selectInventoryItemBySlot(state, selectedSlot) ?? selectedItem ?? null;
  } catch {
    return null;
  }
}

export function selectSelectedBlockTypeId(state: EditorState): string | null {
  try {
    return normalizeBlockTypeId(
      state.inventory.selectedBlockTypeId
      ?? state.inventory.selectedRuntimeBlockTypeId
      ?? selectSelectedInventoryItem(state)?.blockTypeId
      ?? selectSelectedInventoryItem(state)?.runtimeBlockTypeId
      ?? selectSelectedInventorySlot(state)?.blockTypeId
      ?? selectSelectedInventorySlot(state)?.runtimeBlockTypeId
      ?? null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedRuntimeBlockTypeId(state: EditorState): string | null {
  try {
    return normalizeRuntimeBlockTypeId(
      state.inventory.selectedRuntimeBlockTypeId
      ?? state.inventory.selectedBlockTypeId
      ?? selectSelectedInventoryItem(state)?.runtimeBlockTypeId
      ?? selectSelectedInventoryItem(state)?.blockTypeId
      ?? selectSelectedInventorySlot(state)?.runtimeBlockTypeId
      ?? selectSelectedInventorySlot(state)?.blockTypeId
      ?? null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedCellValue(state: EditorState): number | null {
  try {
    const direct = state.inventory.selectedCellValue;

    if (typeof direct === "number" && Number.isFinite(direct)) {
      return direct;
    }

    return selectSelectedInventoryItem(state)?.cellValue ?? null;
  } catch {
    return null;
  }
}

export function selectSelectedPlacementRef(state: EditorState): EditorInventoryPlacementRef | null {
  try {
    return state.inventory.selectedPlacementRef
      ?? selectSelectedInventoryItem(state)?.placementRef
      ?? null;
  } catch {
    return null;
  }
}

export function selectSelectedLibraryItemId(state: EditorState): string | null {
  try {
    return safeNullableString(
      state.inventory.selectedLibraryItemId
      ?? selectSelectedInventoryItem(state)?.libraryItemId
      ?? selectSelectedPlacementRef(state)?.libraryItemId
      ?? null,
      null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedFamilyId(state: EditorState): string | null {
  try {
    return safeNullableString(
      state.inventory.selectedFamilyId
      ?? selectSelectedInventoryItem(state)?.familyId
      ?? selectSelectedPlacementRef(state)?.familyId
      ?? null,
      null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedPackageId(state: EditorState): string | null {
  try {
    return safeNullableString(
      state.inventory.selectedPackageId
      ?? selectSelectedInventoryItem(state)?.packageId
      ?? selectSelectedPlacementRef(state)?.packageId
      ?? null,
      null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedVplibUid(state: EditorState): string | null {
  try {
    return safeNullableString(
      state.inventory.selectedVplibUid
      ?? selectSelectedInventoryItem(state)?.vplibUid
      ?? selectSelectedPlacementRef(state)?.vplibUid
      ?? null,
      null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedVariantId(state: EditorState): string | null {
  try {
    return safeNullableString(
      state.inventory.selectedVariantId
      ?? selectSelectedInventoryItem(state)?.variantId
      ?? selectSelectedPlacementRef(state)?.variantId
      ?? "default",
      "default",
    );
  } catch {
    return "default";
  }
}

export function selectSelectedRevisionHash(state: EditorState): string | null {
  try {
    return safeNullableString(
      state.inventory.selectedRevisionHash
      ?? selectSelectedInventoryItem(state)?.revisionHash
      ?? selectSelectedPlacementRef(state)?.revisionHash
      ?? null,
      null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedObjectKind(state: EditorState): string | null {
  try {
    return safeNullableString(
      selectSelectedInventoryItem(state)?.objectKind
      ?? selectSelectedPlacementRef(state)?.objectKind
      ?? selectSelectedLibraryRef(state)?.objectKind
      ?? null,
      null,
    );
  } catch {
    return null;
  }
}

export function selectSelectedLibraryRef(state: EditorState): EditorInventoryLibraryRef | null {
  try {
    return state.inventory.selectedLibraryRef
      ?? selectSelectedInventoryItem(state)?.libraryRef
      ?? selectSelectedPlacementRef(state)?.libraryRef
      ?? null;
  } catch {
    return null;
  }
}

export function selectSelectedPlacementCommand(state: EditorState): EditorInventoryPlacementCommand | null {
  try {
    return state.inventory.selectedPlacementCommand
      ?? selectSelectedInventoryItem(state)?.placementCommand
      ?? selectSelectedPlacementRef(state)?.placementCommand
      ?? null;
  } catch {
    return null;
  }
}

export function selectActiveBlockTypeId(state: EditorState): string | null {
  return selectSelectedRuntimeBlockTypeId(state);
}

export function selectActiveRuntimeBlockTypeId(state: EditorState): string | null {
  return selectSelectedRuntimeBlockTypeId(state);
}

export function selectActiveLibraryRef(state: EditorState): EditorInventoryLibraryRef | null {
  return selectSelectedLibraryRef(state);
}

export function selectActivePlacementCommand(state: EditorState): EditorInventoryPlacementCommand | null {
  return selectSelectedPlacementCommand(state);
}

export function selectActiveBlockLabel(state: EditorState): string | null {
  try {
    return safeNullableString(selectSelectedInventoryItem(state)?.label, null);
  } catch {
    return null;
  }
}

export function selectActivePlacementSummary(state: EditorState): EditorActivePlacementSummary {
  try {
    const item = selectSelectedInventoryItem(state);
    const placementRef = selectSelectedPlacementRef(state);
    const runtimeBlockTypeId = selectSelectedRuntimeBlockTypeId(state);
    const libraryRef = selectSelectedLibraryRef(state);
    const placementCommand = selectSelectedPlacementCommand(state);
    const libraryItemId = selectSelectedLibraryItemId(state);
    const familyId = selectSelectedFamilyId(state);
    const packageId = selectSelectedPackageId(state);
    const vplibUid = selectSelectedVplibUid(state);
    const variantId = selectSelectedVariantId(state);
    const revisionHash = selectSelectedRevisionHash(state);
    const objectKind = selectSelectedObjectKind(state);
    const label = selectActiveBlockLabel(state);
    const hasLibraryIdentity = Boolean(
      libraryRef
        || placementCommand
        || familyId
        || vplibUid
        || libraryItemId
        || itemHasLibraryIdentity(item)
        || placementRefHasLibraryIdentity(placementRef),
    );

    let blockedReason: string | null = null;

    if (!runtimeBlockTypeId) {
      blockedReason = "missing-runtime-block-type-id";
    } else if (!item) {
      blockedReason = "missing-selected-inventory-item";
    } else if (item.enabled !== true) {
      blockedReason = "selected-item-disabled";
    } else if (item.placeable !== true) {
      blockedReason = "selected-item-not-placeable";
    } else if (state.inventory.onlyLibraryItemsPlaceable === true && !isLibraryInventoryItem(item)) {
      blockedReason = "selected-item-is-not-library-item";
    } else if (state.inventory.onlyLibraryItemsPlaceable === true && !hasLibraryIdentity) {
      blockedReason = "missing-library-identity";
    } else if (selectInventoryHasForbiddenDebugBlockIds(state)) {
      blockedReason = "inventory-contains-forbidden-debug-block-id";
    }

    return {
      valid: blockedReason === null,
      blockedReason,
      runtimeBlockTypeId,
      blockTypeId: runtimeBlockTypeId,
      libraryItemId,
      familyId,
      packageId,
      vplibUid,
      variantId,
      revisionHash,
      objectKind,
      label,
      itemKind: item?.kind ?? null,
      sourceKind: item?.sourceKind ?? null,
      libraryRef,
      placementCommand,
    };
  } catch {
    return {
      valid: false,
      blockedReason: "active-placement-selector-error",
      runtimeBlockTypeId: null,
      blockTypeId: null,
      libraryItemId: null,
      familyId: null,
      packageId: null,
      vplibUid: null,
      variantId: null,
      revisionHash: null,
      objectKind: null,
      label: null,
      itemKind: null,
      sourceKind: null,
      libraryRef: null,
      placementCommand: null,
    };
  }
}

export function selectSelectedBlockSummary(state: EditorState): EditorSelectedBlockSummary | null {
  const item = selectSelectedInventoryItem(state);

  if (!item) {
    return null;
  }

  const runtimeBlockTypeId = selectSelectedRuntimeBlockTypeId(state);

  if (!runtimeBlockTypeId) {
    return null;
  }

  return {
    slot: item.slot,
    selectedSlotIndex: selectSelectedSlot(state),
    blockTypeId: item.blockTypeId ?? runtimeBlockTypeId,
    runtimeBlockTypeId,
    libraryItemId: selectSelectedLibraryItemId(state),
    familyId: selectSelectedFamilyId(state),
    packageId: selectSelectedPackageId(state),
    vplibUid: selectSelectedVplibUid(state),
    variantId: selectSelectedVariantId(state),
    revisionHash: selectSelectedRevisionHash(state),
    objectKind: selectSelectedObjectKind(state),
    label: item.label,
    shortLabel: item.shortLabel,
    cellValue: item.cellValue,
    color: item.color,
    registryId: item.registryId,
    registryVersion: item.registryVersion,
    enabled: item.enabled,
    placeable: item.placeable,
    placementRef: item.placementRef ?? emptyPlacementRef(),
    libraryRef: selectSelectedLibraryRef(state),
    placementCommand: selectSelectedPlacementCommand(state),
    itemKind: item.kind,
    sourceKind: item.sourceKind,
  };
}

export function selectInventoryItemByBlockTypeId(
  state: EditorState,
  blockTypeId: string,
): EditorInventoryItem | null {
  try {
    const normalized = normalizeBlockTypeId(blockTypeId);

    if (!normalized) {
      return null;
    }

    return state.inventory.items.find((item) => item.blockTypeId === normalized || item.runtimeBlockTypeId === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectInventoryItemByRuntimeBlockTypeId(
  state: EditorState,
  runtimeBlockTypeId: string,
): EditorInventoryItem | null {
  return selectInventoryItemByBlockTypeId(state, runtimeBlockTypeId);
}

export function selectInventoryItemByLibraryItemId(
  state: EditorState,
  libraryItemId: string,
): EditorInventoryItem | null {
  try {
    const normalized = safeString(libraryItemId, "");

    if (!normalized) {
      return null;
    }

    return state.inventory.items.find((item) => item.libraryItemId === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectInventoryItemByFamilyId(
  state: EditorState,
  familyId: string,
): EditorInventoryItem | null {
  try {
    const normalized = safeString(familyId, "");

    if (!normalized) {
      return null;
    }

    return state.inventory.items.find((item) => item.familyId === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectInventoryItemByVplibUid(
  state: EditorState,
  vplibUid: string,
): EditorInventoryItem | null {
  try {
    const normalized = safeString(vplibUid, "");

    if (!normalized) {
      return null;
    }

    return state.inventory.items.find((item) => item.vplibUid === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectInventoryItemBySlot(
  state: EditorState,
  slot: number,
): EditorInventoryItem | null {
  try {
    const normalizedSlot = Math.trunc(slot);

    return state.inventory.items.find((item) => item.slot === normalizedSlot) ?? null;
  } catch {
    return null;
  }
}

export function selectInventorySummary(state: EditorState): EditorInventorySummary {
  const libraryItems = selectInventoryLibraryItems(state);
  const placeableItems = selectInventoryPlaceableItems(state);

  return {
    status: state.inventory.status,
    source: state.inventory.source,
    slotCount: state.inventory.slotCount,
    selectedSlot: state.inventory.selectedSlot,
    selectedSlotIndex: state.inventory.selectedSlotIndex,
    selectedBlockTypeId: selectSelectedBlockTypeId(state),
    selectedRuntimeBlockTypeId: selectSelectedRuntimeBlockTypeId(state),
    selectedCellValue: selectSelectedCellValue(state),
    selectedLibraryItemId: selectSelectedLibraryItemId(state),
    selectedFamilyId: selectSelectedFamilyId(state),
    selectedPackageId: selectSelectedPackageId(state),
    selectedVplibUid: selectSelectedVplibUid(state),
    selectedVariantId: selectSelectedVariantId(state),
    selectedRevisionHash: selectSelectedRevisionHash(state),
    selectedObjectKind: selectSelectedObjectKind(state),
    selectedLibraryRef: selectSelectedLibraryRef(state),
    selectedPlacementCommand: selectSelectedPlacementCommand(state),
    itemCount: state.inventory.items.length,
    libraryItemCount: libraryItems.length,
    placeableItemCount: placeableItems.length,
    hotbarSlotCount: state.inventory.hotbarSlots.length,
    blockTypeIds: selectInventoryBlockTypeIds(state),
    runtimeBlockTypeIds: selectInventoryRuntimeBlockTypeIds(state),
    libraryItemIds: selectInventoryLibraryItemIds(state),
    familyIds: selectInventoryFamilyIds(state),
    packageIds: selectInventoryPackageIds(state),
    vplibUids: selectInventoryVplibUids(state),
    usedPaletteFallback: state.inventory.usedPaletteFallback,
    onlyLibraryItemsPlaceable: state.inventory.onlyLibraryItemsPlaceable,
    debugGrassDirtAllowed: false,
    hasForbiddenDebugBlockIds: selectInventoryHasForbiddenDebugBlockIds(state),
    lastLoadedAt: state.inventory.lastLoadedAt,
    lastError: state.inventory.lastError,
  };
}

export function selectCreativeLibrary(state: EditorState): EditorCreativeLibraryState {
  return state.creativeLibrary;
}

export function selectCreativeLibraryReady(state: EditorState): boolean {
  return (
    (state.creativeLibrary.status === "ready" || state.creativeLibrary.items.length > 0)
    && selectCreativeLibraryHasForbiddenDebugBlockIds(state) === false
  );
}

export function selectCreativeLibraryItems(state: EditorState): readonly EditorCreativeLibraryItem[] {
  return safeArray(state.creativeLibrary.items);
}

export function selectCreativeLibraryBlockTypeIds(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.creativeLibrary.blockTypeIds));
}

export function selectCreativeLibraryRuntimeBlockTypeIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.creativeLibrary.runtimeBlockTypeIds).length > 0
      ? safeArray(state.creativeLibrary.runtimeBlockTypeIds)
      : state.creativeLibrary.items.map((item) => item.runtimeBlockTypeId ?? item.blockTypeId ?? ""),
  );
}

export function selectCreativeLibraryLibraryItemIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.creativeLibrary.libraryItemIds).length > 0
      ? safeArray(state.creativeLibrary.libraryItemIds)
      : state.creativeLibrary.items.map((item) => item.libraryItemId ?? ""),
  );
}

export function selectCreativeLibraryFamilyIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.creativeLibrary.familyIds).length > 0
      ? safeArray(state.creativeLibrary.familyIds)
      : state.creativeLibrary.items.map((item) => item.familyId ?? ""),
  );
}

export function selectCreativeLibraryPackageIds(state: EditorState): readonly string[] {
  return uniqueStrings(
    state.creativeLibrary.items.map((item) => item.packageId ?? ""),
  );
}

export function selectCreativeLibraryVplibUids(state: EditorState): readonly string[] {
  return uniqueStrings(
    safeArray(state.creativeLibrary.vplibUids).length > 0
      ? safeArray(state.creativeLibrary.vplibUids)
      : state.creativeLibrary.items.map((item) => item.vplibUid ?? ""),
  );
}

export function selectCreativeLibraryCategoryIds(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.creativeLibrary.categoryIds));
}

export function selectCreativeLibraryItemByBlockTypeId(
  state: EditorState,
  blockTypeId: string,
): EditorCreativeLibraryItem | null {
  try {
    const normalized = normalizeBlockTypeId(blockTypeId);

    if (!normalized) {
      return null;
    }

    return state.creativeLibrary.items.find((item) => item.blockTypeId === normalized || item.runtimeBlockTypeId === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectCreativeLibraryItemByRuntimeBlockTypeId(
  state: EditorState,
  runtimeBlockTypeId: string,
): EditorCreativeLibraryItem | null {
  return selectCreativeLibraryItemByBlockTypeId(state, runtimeBlockTypeId);
}

export function selectCreativeLibraryItemByLibraryItemId(
  state: EditorState,
  libraryItemId: string,
): EditorCreativeLibraryItem | null {
  try {
    const normalized = safeString(libraryItemId, "");

    if (!normalized) {
      return null;
    }

    return state.creativeLibrary.items.find((item) => item.libraryItemId === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectCreativeLibraryItemByFamilyId(
  state: EditorState,
  familyId: string,
): EditorCreativeLibraryItem | null {
  try {
    const normalized = safeString(familyId, "");

    if (!normalized) {
      return null;
    }

    return state.creativeLibrary.items.find((item) => item.familyId === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectCreativeLibraryItemByVplibUid(
  state: EditorState,
  vplibUid: string,
): EditorCreativeLibraryItem | null {
  try {
    const normalized = safeString(vplibUid, "");

    if (!normalized) {
      return null;
    }

    return state.creativeLibrary.items.find((item) => item.vplibUid === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectCreativeLibraryItemById(
  state: EditorState,
  id: string,
): EditorCreativeLibraryItem | null {
  try {
    const normalized = safeString(id, "");

    if (!normalized) {
      return null;
    }

    return state.creativeLibrary.items.find((item) => item.id === normalized) ?? null;
  } catch {
    return null;
  }
}

export function selectCreativeLibraryItemsByCategory(
  state: EditorState,
  category: string,
): readonly EditorCreativeLibraryItem[] {
  try {
    const normalized = safeString(category, "");

    if (!normalized) {
      return [];
    }

    return state.creativeLibrary.items.filter((item) => item.category === normalized);
  } catch {
    return [];
  }
}

export function selectCreativeLibrarySummary(state: EditorState): EditorCreativeLibrarySummary {
  return {
    status: state.creativeLibrary.status,
    source: state.creativeLibrary.source,
    itemCount: state.creativeLibrary.items.length,
    totalCount: state.creativeLibrary.totalCount,
    blockTypeIds: selectCreativeLibraryBlockTypeIds(state),
    runtimeBlockTypeIds: selectCreativeLibraryRuntimeBlockTypeIds(state),
    libraryItemIds: selectCreativeLibraryLibraryItemIds(state),
    familyIds: selectCreativeLibraryFamilyIds(state),
    packageIds: selectCreativeLibraryPackageIds(state),
    vplibUids: selectCreativeLibraryVplibUids(state),
    categoryIds: selectCreativeLibraryCategoryIds(state),
    lastLoadedAt: state.creativeLibrary.lastLoadedAt,
    lastError: state.creativeLibrary.lastError,
  };
}

export function selectTargeting(state: EditorState): EditorTargetState {
  return state.targeting;
}

export function selectTargetSummary(state: EditorState): EditorTargetSummary {
  const target = state.targeting;

  return {
    kind: target.kind,
    status: target.status,
    canPlace: selectCanPlaceBlock(state),
    canRemove: selectCanRemoveBlock(state),
    chunkKey: target.chunkKey,
    sourceCell: target.sourceCell,
    placementCell: target.placementCell,
    reason: target.reason,
  };
}

export function selectSourceCell(state: EditorState): EditorStateChunkCellPosition | null {
  return state.targeting.sourceCell;
}

export function selectPlacementCell(state: EditorState): EditorStateChunkCellPosition | null {
  return state.targeting.placementCell;
}

export function selectTargetChunkKey(state: EditorState): string | null {
  return state.targeting.chunkKey;
}

export function selectCanPlaceBlock(state: EditorState): boolean {
  try {
    const placement = selectActivePlacementSummary(state);

    return (
      isInteractableLifecycleStatus(state.lifecycle.status)
      && isReadyOrDegraded(state.world.connection.status)
      && state.command.status !== "pending"
      && state.targeting.status === "valid"
      && state.targeting.placementCell !== null
      && placement.valid
    );
  } catch {
    return false;
  }
}

export function selectCanRemoveBlock(state: EditorState): boolean {
  try {
    return (
      isInteractableLifecycleStatus(state.lifecycle.status)
      && isReadyOrDegraded(state.world.connection.status)
      && state.command.status !== "pending"
      && state.targeting.status === "valid"
      && state.targeting.sourceCell !== null
      && state.targeting.sourceCell.blockTypeId !== null
      && state.targeting.sourceCell.cellValue > 0
    );
  } catch {
    return false;
  }
}

export function selectTools(state: EditorState): EditorToolState {
  return state.tools;
}

export function selectActiveToolId(state: EditorState): EditorToolId {
  return state.tools.activeToolId;
}

export function selectToolEnabled(state: EditorState, toolId: EditorToolId): boolean {
  try {
    return state.tools.enabledToolIds.includes(toolId);
  } catch {
    return false;
  }
}

export function selectPreviewVisible(state: EditorState): boolean {
  return state.tools.previewVisible || state.render.previewVisible;
}

export function selectPreviewBlockTypeId(state: EditorState): string | null {
  return normalizeRuntimeBlockTypeId(state.tools.previewBlockTypeId);
}

export function selectCommand(state: EditorState): EditorCommandState {
  return state.command;
}

export function selectCommandStatus(state: EditorState): EditorCommandState["status"] {
  return state.command.status;
}

export function selectCommandPending(state: EditorState): boolean {
  return state.command.status === "pending" || state.command.pendingCommand !== null;
}

export function selectLastCommandResult(state: EditorState): ChunkApiCommandResult | null {
  return state.command.lastResult;
}

export function selectLastCommandError(state: EditorState): ChunkApiErrorDetails | null {
  return state.command.lastError;
}

export function selectCommandSummary(state: EditorState): EditorCommandSummary {
  const lastResult = state.command.lastResult;

  return {
    status: state.command.status,
    pending: selectCommandPending(state),
    lastCommandType: state.command.lastCommand?.type ?? lastResult?.commandType ?? null,
    changed: lastResult?.changed ?? false,
    dirtyChunkKeys: safeArray(state.command.dirtyChunkKeys),
    changedChunkKeys: safeArray(state.command.changedChunkKeys),
    lastError: state.command.lastError,
    lastResult,
  };
}

export function selectRender(state: EditorState): EditorRenderState {
  return state.render;
}

export function selectRenderInitialized(state: EditorState): boolean {
  return state.render.initialized;
}

export function selectRenderedChunkKeys(state: EditorState): readonly string[] {
  return uniqueStrings(safeArray(state.render.renderedChunkKeys));
}

export function selectRenderFrameCount(state: EditorState): number {
  return safeNumber(state.render.frameCount, 0);
}

export function selectUi(state: EditorState): EditorUiState {
  return state.ui;
}

export function selectUiSummary(state: EditorState): EditorUiSummary {
  return {
    loading: state.ui.loading,
    errorVisible: state.ui.errorVisible,
    errorTitle: state.ui.errorTitle,
    errorMessage: state.ui.errorMessage,
    sourceStatusLabel: state.ui.sourceStatusLabel,
    hotbarVisible: state.ui.hotbarVisible,
    crosshairVisible: state.ui.crosshairVisible,
    debugOverlayVisible: state.ui.debugOverlayVisible,
  };
}

export function selectLoadingMessage(state: EditorState): string | null {
  return state.ui.loadingMessage;
}

export function selectErrorMessage(state: EditorState): string | null {
  return state.ui.errorMessage;
}

export function selectLiveMessage(state: EditorState): string | null {
  return state.ui.liveMessage;
}

export function selectHotbarVisible(state: EditorState): boolean {
  return state.ui.hotbarVisible;
}

export function selectCrosshairVisible(state: EditorState): boolean {
  return state.ui.crosshairVisible;
}

export function selectDebug(state: EditorState): EditorDebugState {
  return state.debug;
}

export function selectDebugEnabled(state: EditorState): boolean {
  return safeBoolean(state.debug.enabled, false);
}

export function selectDebugSummary(state: EditorState): EditorDebugSummary {
  return {
    enabled: state.debug.enabled,
    lastAction: state.debug.lastAction,
    warnings: safeArray(state.debug.warnings),
    errors: safeArray(state.debug.errors),
    bootstrapWarnings: safeArray(state.debug.bootstrapWarnings),
    player: state.debug.player ?? null,
  };
}

export function selectAllErrors(state: EditorState): readonly ChunkApiErrorDetails[] {
  const errors: ChunkApiErrorDetails[] = [];

  if (state.world.connection.lastError) {
    errors.push(state.world.connection.lastError);
  }

  if (state.inventory.lastError) {
    errors.push(state.inventory.lastError);
  }

  if (state.creativeLibrary.lastError) {
    errors.push(state.creativeLibrary.lastError);
  }

  if (state.command.lastError) {
    errors.push(state.command.lastError);
  }

  if (state.render.lastError) {
    errors.push(state.render.lastError);
  }

  errors.push(...state.debug.errors);

  return errors;
}

export function selectRuntimeReadiness(state: EditorState): EditorRuntimeReadiness {
  try {
    const bootReady = isInteractableLifecycleStatus(state.lifecycle.status);
    const worldReady = isReadyOrDegraded(state.world.connection.status) && state.world.loadedChunkKeys.length > 0;
    const inventoryReady = selectInventoryReady(state);
    const renderReady = state.render.initialized;
    const commandReady = !selectCommandPending(state);
    const playerReady = Boolean(state.player && state.player.physics && state.player.status !== "error");
    const canInteract = bootReady && worldReady && inventoryReady && renderReady && commandReady && playerReady;

    let blockingReason: string | null = null;

    if (!bootReady) {
      blockingReason = `lifecycle:${state.lifecycle.status}`;
    } else if (!worldReady) {
      blockingReason = `world:${state.world.connection.status}`;
    } else if (!inventoryReady) {
      const activePlacement = selectActivePlacementSummary(state);
      blockingReason = activePlacement.blockedReason
        ? `inventory:${activePlacement.blockedReason}`
        : `inventory:${state.inventory.status}`;
    } else if (!renderReady) {
      blockingReason = "render:not-initialized";
    } else if (!commandReady) {
      blockingReason = "command:pending";
    } else if (!playerReady) {
      blockingReason = `player:${state.player?.status ?? "missing"}`;
    }

    return {
      bootReady,
      worldReady,
      inventoryReady,
      renderReady,
      playerReady,
      canInteract,
      blockingReason,
    };
  } catch {
    return {
      bootReady: false,
      worldReady: false,
      inventoryReady: false,
      renderReady: false,
      playerReady: false,
      canInteract: false,
      blockingReason: "selector-error",
    };
  }
}

export function selectCanStartRuntime(state: EditorState): boolean {
  try {
    return (
      !selectIsDestroyed(state)
      && !selectHasFatalError(state)
      && state.bootstrap.runtime.chunk.enabled === true
      && state.bootstrap.runtime.localWorldFallbackEnabled === false
      && state.bootstrap.runtime.legacyFrontendEnabled === false
      && state.bootstrap.inventory.onlyLibraryItemsPlaceable === true
      && state.bootstrap.inventory.debugGrassDirtAllowed === false
      && state.bootstrap.inventory.allowChunkPlaceableFallback === false
    );
  } catch {
    return false;
  }
}

export function selectShouldShowLoadingOverlay(state: EditorState): boolean {
  return state.ui.loading === true && state.ui.errorVisible === false;
}

export function selectShouldShowErrorOverlay(state: EditorState): boolean {
  return state.ui.errorVisible === true || state.lifecycle.status === "failed";
}

export function selectStatusLine(state: EditorState): string {
  try {
    const activePlacement = selectActivePlacementSummary(state);
    const world = selectWorldSourceSummary(state);
    const target = selectTargetSummary(state);
    const command = selectCommandSummary(state);
    const player = selectPlayerMovementSummary(state);

    const itemLabel = activePlacement.label ?? "kein VPLIB-Item";
    const runtimeBlockTypeId = activePlacement.runtimeBlockTypeId ?? "—";
    const identity = activePlacement.familyId || activePlacement.vplibUid
      ? `${activePlacement.familyId ?? activePlacement.vplibUid}`
      : null;

    const inventoryLabel = [
      itemLabel,
      runtimeBlockTypeId !== "—" ? `Runtime ${runtimeBlockTypeId}` : null,
      identity,
    ].filter((value): value is string => Boolean(value)).join(" · ");

    return [
      `World: ${world.status}`,
      `Chunks: ${world.loadedChunkCount}`,
      `Dirty: ${world.dirtyChunkCount}`,
      `Item: ${inventoryLabel}`,
      `Target: ${target.status}`,
      `Player: ${player.movementMode}`,
      `Command: ${command.status}`,
    ].join(" · ");
  } catch {
    return "Editor-Status nicht verfügbar";
  }
}

export const cachedRuntimeReadinessSelector = createCachedEditorSelector(
  selectRuntimeReadiness,
  (left, right) => (
    left.bootReady === right.bootReady
    && left.worldReady === right.worldReady
    && left.inventoryReady === right.inventoryReady
    && left.renderReady === right.renderReady
    && left.playerReady === right.playerReady
    && left.canInteract === right.canInteract
    && left.blockingReason === right.blockingReason
  ),
);

export const cachedWorldSourceSummarySelector = createCachedEditorSelector(
  selectWorldSourceSummary,
  (left, right) => (
    left.sourceKind === right.sourceKind
    && left.apiBaseUrl === right.apiBaseUrl
    && left.projectId === right.projectId
    && left.worldId === right.worldId
    && left.status === right.status
    && left.loadedChunkCount === right.loadedChunkCount
    && left.dirtyChunkCount === right.dirtyChunkCount
    && left.visibleChunkCount === right.visibleChunkCount
    && left.lastError === right.lastError
  ),
);

export const cachedPlayerSummarySelector = createCachedEditorSelector(
  selectPlayerSummary,
  (left, right) => (
    left.status === right.status
    && left.source === right.source
    && left.movementMode === right.movementMode
    && left.grounded === right.grounded
    && left.flying === right.flying
    && shallowEqualVector3(left.position, right.position)
    && shallowEqualVector3(left.velocity, right.velocity)
    && shallowEqualVector3(left.eyePosition, right.eyePosition)
    && shallowEqualAngles(left.angles, right.angles)
    && left.physicsRevision === right.physicsRevision
    && left.storeRevision === right.storeRevision
    && left.lastErrorMessage === right.lastErrorMessage
  ),
);

export const cachedPlayerMovementSummarySelector = createCachedEditorSelector(
  selectPlayerMovementSummary,
  (left, right) => (
    left.movementMode === right.movementMode
    && left.grounded === right.grounded
    && left.flying === right.flying
    && left.moving === right.moving
    && left.falling === right.falling
    && left.rising === right.rising
    && left.horizontalSpeed === right.horizontalSpeed
    && left.verticalSpeed === right.verticalSpeed
    && left.totalSpeed === right.totalSpeed
    && left.blocked === right.blocked
    && left.blockedByMissingChunk === right.blockedByMissingChunk
  ),
);

export const cachedInventoryItemsSelector = createCachedEditorSelector(
  selectInventoryItems,
  shallowEqualArray,
);

export const cachedInventoryLibraryItemsSelector = createCachedEditorSelector(
  selectInventoryLibraryItems,
  shallowEqualArray,
);

export const cachedInventoryPlaceableItemsSelector = createCachedEditorSelector(
  selectInventoryPlaceableItems,
  shallowEqualArray,
);

export const cachedInventoryHotbarSlotsSelector = createCachedEditorSelector(
  selectInventoryHotbarSlots,
  shallowEqualArray,
);

export const cachedCreativeLibraryItemsSelector = createCachedEditorSelector(
  selectCreativeLibraryItems,
  shallowEqualArray,
);

export const cachedDirtyChunkKeysSelector = createCachedEditorSelector(
  selectDirtyChunkKeys,
  shallowEqualArray,
);

export function getStateSelectorsMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.state.state_selectors",
    supportsLibraryInventory: true,
    supportsRuntimeBlockTypeId: true,
    supportsLibraryRef: true,
    supportsPlacementCommand: true,
    legacyBlockSelectorAliasesKept: true,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      activeBlockTypeIdAliasesRuntimeBlockTypeId: true,
      canPlaceRequiresLibraryIdentity: true,
      canPlaceRequiresRuntimeBlockTypeId: true,
      inventoryReadyRequiresSelectedLibraryItem: true,
      debugGrassDirtAllowed: false,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
    },
  };
}
