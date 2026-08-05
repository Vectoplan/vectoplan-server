// services/vectoplan-editor/src/frontend/state/editor_state.ts
import type {
  EditorBootstrap,
  EditorEuler3,
  EditorVector3,
} from "@bootstrap/bootstrap_models";
import type {
  ChunkApiBlockDefinition,
  ChunkApiCommandPayload,
  ChunkApiCommandResult,
  ChunkApiErrorDetails,
  ChunkApiPlaceableBlockDefinition,
  ChunkApiRuntimeChunkContent,
} from "@api/chunk_api_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
} from "@api/editor_inventory_models";
import type {
  HotbarSlot as RuntimeHotbarSlot,
  InventoryAssetItem as RuntimeInventoryAssetItem,
  InventoryBlockItem as RuntimeInventoryBlockItem,
  InventoryCatalog,
  InventoryLibraryItem as RuntimeInventoryLibraryItem,
} from "@inventory/inventory_models";
import type {
  EditorPlayerState,
  EditorPlayerStatePatch,
  PlayerDebugState,
  PlayerStateBootstrapInput,
  PlayerStateUpdateInput,
} from "./player_state";
import {
  createDefaultEditorPlayerState,
  createPlayerDebugState,
  patchEditorPlayerState,
  resetEditorPlayerState,
  updateEditorPlayerStateFromPhysics,
} from "./player_state";

export type EditorLifecycleStatus =
  | "created"
  | "bootstrapping"
  | "initializing"
  | "loading"
  | "ready"
  | "degraded"
  | "failed"
  | "destroying"
  | "destroyed";

export type EditorConnectionStatus =
  | "unknown"
  | "connecting"
  | "ready"
  | "degraded"
  | "failed"
  | "offline";

export type EditorCommandStatus =
  | "idle"
  | "pending"
  | "applied"
  | "noop"
  | "rejected"
  | "failed";

export type EditorToolId =
  | "select"
  | "place-block"
  | "remove-block"
  | "inspect"
  | "none";

export type EditorTargetKind =
  | "none"
  | "chunk-cell"
  | "block-face"
  | "block"
  | "unknown";

export type EditorTargetStatus =
  | "none"
  | "valid"
  | "blocked"
  | "invalid"
  | "missing-chunk"
  | "out-of-range"
  | "unknown";

export type EditorPointerButton =
  | "primary"
  | "secondary"
  | "middle"
  | "unknown";

export type EditorInventorySource =
  | "library"
  | "library-service"
  | "editor-inventory"
  | "vplib"
  | "creative-library"
  | "chunk-service"
  | "editor-placeholder"
  | "chunk-palette"
  | "static-fallback"
  | "runtime-generated"
  | "empty-fallback"
  | "unknown";

export type EditorInventoryItemKind =
  | "vplib"
  | "library-item"
  | "block"
  | "asset"
  | "empty";

export type EditorInventorySlotStatus =
  | "empty"
  | "available"
  | "selected"
  | "disabled";

export interface EditorStateVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EditorStateEuler3 {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
}

export interface EditorStateCellPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EditorStateChunkCoordinates {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
}

export interface EditorStateChunkCellPosition {
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

export interface EditorLifecycleState {
  readonly bootId: string;
  readonly status: EditorLifecycleStatus;
  readonly bootAttemptCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly readyAt: string | null;
  readonly failedAt: string | null;
  readonly destroyedAt: string | null;
  readonly lastReason: string | null;
}

export interface EditorBuildState {
  readonly buildMode: string;
  readonly buildVersion: string;
  readonly frontendRoot: "services/vectoplan-editor/src/frontend";
  readonly localWorldFallbackEnabled: false;
  readonly legacyFrontendEnabled: false;
}

export interface EditorProjectState {
  readonly projectId: string;
  readonly universeId: string | null;
  readonly worldId: string;
  readonly templateId: string | null;
  readonly providerId: string | null;
  readonly providerWorldId: string | null;
}

export interface EditorViewportState {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly aspect: number;
  readonly resizedAt: string | null;
  readonly isVisible: boolean;
  readonly hasCanvas: boolean;
}

export interface EditorInputState {
  readonly pointerLocked: boolean;
  readonly pointerLockAvailable: boolean;
  readonly keyboardEnabled: boolean;
  readonly mouseEnabled: boolean;
  readonly wheelEnabled: boolean;
  readonly pressedKeys: readonly string[];
  readonly pressedButtons: readonly EditorPointerButton[];
  readonly lastPointerButton: EditorPointerButton | null;
  readonly lastPointerDownAt: string | null;
  readonly lastPointerUpAt: string | null;
  readonly lastPointerMoveAt: string | null;
  readonly lastWheelAt: string | null;
  readonly mouseDeltaX: number;
  readonly mouseDeltaY: number;
  readonly wheelDelta: number;
}

export interface EditorCameraState {
  readonly mode: "first-person";
  readonly position: EditorStateVector3;
  readonly rotation: EditorStateEuler3;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly moveSpeed: number;
  readonly sprintMultiplier: number;
  readonly isSprinting: boolean;
  readonly updatedAt: string | null;
}

export interface EditorWorldConnectionState {
  readonly status: EditorConnectionStatus;
  readonly sourceKind: "chunk-service";
  readonly apiBaseUrl: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly lastStatusAt: string | null;
  readonly lastError: ChunkApiErrorDetails | null;
}

export interface EditorChunkSummary {
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly source: "snapshot" | "generated" | "unknown";
  readonly cellCount: number;
  readonly nonAirCellCount: number;
  readonly revision: number | null;
  readonly version: string | null;
  readonly loadedAt: string;
}

export interface EditorWorldState {
  readonly connection: EditorWorldConnectionState;
  readonly chunkSize: number;
  readonly cellSize: number;
  readonly loadedChunkKeys: readonly string[];
  readonly visibleChunkKeys: readonly string[];
  readonly dirtyChunkKeys: readonly string[];
  readonly failedChunkKeys: readonly string[];
  readonly chunksByKey: Readonly<Record<string, EditorChunkSummary>>;
  readonly lastLoadedChunkKey: string | null;
  readonly lastDirtyReloadAt: string | null;
  readonly lastFullRefreshAt: string | null;
  readonly chunkCount: number;
  readonly visibleChunkCount: number;
  readonly dirtyChunkCount: number;
}

export interface EditorInventoryIcon {
  readonly kind: "text" | "color" | "asset-url" | "library" | "none";
  readonly value: string | null;
}

export interface EditorInventoryPlacementRef {
  readonly kind: "vplib" | "library-item" | "block" | "asset" | "unknown";
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly assetTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
}

export interface EditorInventoryItem {
  readonly slot: number;
  readonly id: string;
  readonly kind: EditorInventoryItemKind;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly assetTypeId: string | null;
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
  readonly paletteIndex: number | null;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly solid: boolean;
  readonly placeable: boolean;
  readonly breakable: boolean;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
  readonly category: string | null;
  readonly role: string | null;
  readonly color: string | null;
  readonly icon: EditorInventoryIcon;
  readonly placementRef: EditorInventoryPlacementRef;
  readonly source: ChunkApiBlockDefinition["source"] | "vectoplan-library" | "library" | string;
  readonly sourceKind: EditorInventorySource;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly raw:
    | ChunkApiBlockDefinition
    | ChunkApiPlaceableBlockDefinition
    | RuntimeInventoryLibraryItem
    | RuntimeInventoryAssetItem
    | RuntimeInventoryBlockItem
    | unknown
    | null;
}

export interface EditorInventoryHotbarSlot {
  readonly slot: number;
  readonly index: number;
  readonly status: EditorInventorySlotStatus;
  readonly selected: boolean;
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly assetTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly sourceKind: EditorInventorySource;
  readonly itemKind: EditorInventoryItemKind;
  readonly color: string | null;
  readonly icon: EditorInventoryIcon;
  readonly keyBinding: string;
  readonly enabled: boolean;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
}

export interface EditorInventoryState {
  readonly status: EditorConnectionStatus;
  readonly source: EditorInventorySource;
  readonly slotCount: number;
  readonly selectedSlot: number;
  readonly selectedSlotIndex: number;
  readonly selectedItem: EditorInventoryItem | null;
  readonly selectedBlockTypeId: string | null;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedCellValue: number | null;
  readonly selectedPlacementRef: EditorInventoryPlacementRef | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedPackageId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedVariantId: string | null;
  readonly selectedRevisionHash: string | null;
  readonly selectedObjectKind: string | null;
  readonly selectedLibraryRef: EditorInventoryLibraryRef | null;
  readonly selectedPlacementCommand: EditorInventoryPlacementCommand | null;
  readonly items: readonly EditorInventoryItem[];
  readonly hotbarSlots: readonly EditorInventoryHotbarSlot[];
  readonly blockTypeIds: readonly string[];
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly packageIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly lastLoadedAt: string | null;
  readonly lastError: ChunkApiErrorDetails | null;
  readonly usedPaletteFallback: boolean;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;
}

export interface EditorCreativeLibraryItem {
  readonly id: string;
  readonly kind: EditorInventoryItemKind;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly assetTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly label: string;
  readonly shortLabel: string;
  readonly category: string | null;
  readonly role: string | null;
  readonly color: string | null;
  readonly icon: EditorInventoryIcon;
  readonly placementRef: EditorInventoryPlacementRef;
  readonly source: EditorInventorySource;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly raw:
    | ChunkApiBlockDefinition
    | ChunkApiPlaceableBlockDefinition
    | RuntimeInventoryLibraryItem
    | RuntimeInventoryAssetItem
    | unknown
    | null;
}

export interface EditorCreativeLibraryState {
  readonly status: EditorConnectionStatus;
  readonly source: EditorInventorySource;
  readonly items: readonly EditorCreativeLibraryItem[];
  readonly blockTypeIds: readonly string[];
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly packageIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly categoryIds: readonly string[];
  readonly lastLoadedAt: string | null;
  readonly lastError: ChunkApiErrorDetails | null;
  readonly totalCount: number;
}

export interface EditorTargetState {
  readonly kind: EditorTargetKind;
  readonly status: EditorTargetStatus;
  readonly reason: string | null;
  readonly distance: number | null;
  readonly chunkKey: string | null;
  readonly sourceCell: EditorStateChunkCellPosition | null;
  readonly placementCell: EditorStateChunkCellPosition | null;
  readonly normal: EditorStateVector3 | null;
  readonly updatedAt: string | null;
}

export interface EditorToolState {
  readonly activeToolId: EditorToolId;
  readonly previousToolId: EditorToolId | null;
  readonly availableToolIds: readonly EditorToolId[];
  readonly enabledToolIds: readonly EditorToolId[];
  readonly cursorHint: string | null;
  readonly previewVisible: boolean;
  readonly previewBlockTypeId: string | null;
  readonly updatedAt: string | null;
}

export interface EditorCommandState {
  readonly status: EditorCommandStatus;
  readonly pendingCommand: ChunkApiCommandPayload | null;
  readonly lastCommand: ChunkApiCommandPayload | null;
  readonly lastResult: ChunkApiCommandResult | null;
  readonly lastError: ChunkApiErrorDetails | null;
  readonly dirtyChunkKeys: readonly string[];
  readonly changedChunkKeys: readonly string[];
  readonly eventIds: readonly string[];
  readonly snapshotIds: readonly string[];
  readonly submittedAt: string | null;
  readonly completedAt: string | null;
}

export interface EditorRenderState {
  readonly initialized: boolean;
  readonly frameCount: number;
  readonly lastFrameAt: string | null;
  readonly averageFrameMs: number | null;
  readonly meshCount: number;
  readonly drawCallCount: number;
  readonly renderedChunkKeys: readonly string[];
  readonly previewVisible: boolean;
  readonly targetHighlightVisible: boolean;
  readonly lastError: ChunkApiErrorDetails | null;
}

export interface EditorUiState {
  readonly loading: boolean;
  readonly loadingMessage: string | null;
  readonly errorVisible: boolean;
  readonly errorTitle: string | null;
  readonly errorMessage: string | null;
  readonly sourceStatusLabel: string;
  readonly leftPanelVisible: boolean;
  readonly rightPanelVisible: boolean;
  readonly hotbarVisible: boolean;
  readonly crosshairVisible: boolean;
  readonly debugOverlayVisible: boolean;
  readonly liveMessage: string | null;
}

export interface EditorDebugState {
  readonly enabled: boolean;
  readonly lastAction: string | null;
  readonly lastActionAt: string | null;
  readonly warnings: readonly string[];
  readonly errors: readonly ChunkApiErrorDetails[];
  readonly bootstrapWarnings: readonly string[];
  readonly player: PlayerDebugState | null;
}

export interface EditorState {
  readonly schemaVersion: "vectoplan-editor-state.v1";
  readonly bootstrap: EditorBootstrap;
  readonly build: EditorBuildState;
  readonly lifecycle: EditorLifecycleState;
  readonly project: EditorProjectState;
  readonly viewport: EditorViewportState;
  readonly input: EditorInputState;
  readonly camera: EditorCameraState;
  readonly player: EditorPlayerState;
  readonly world: EditorWorldState;
  readonly inventory: EditorInventoryState;
  readonly creativeLibrary: EditorCreativeLibraryState;
  readonly targeting: EditorTargetState;
  readonly tools: EditorToolState;
  readonly command: EditorCommandState;
  readonly render: EditorRenderState;
  readonly ui: EditorUiState;
  readonly debug: EditorDebugState;
}

export interface CreateInitialEditorStateOptions {
  readonly bootId: string;
  readonly buildMode: string;
  readonly buildVersion: string;
  readonly bootstrap: EditorBootstrap;
  readonly createdAt: string;
}

export interface EditorStateErrorInput {
  readonly code?: string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown> | null;
}

export interface EditorChunkSummaryInput {
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly source: "snapshot" | "generated" | "unknown";
  readonly chunkSize?: number;
  readonly cellSize?: number;
  readonly stats?: {
    readonly cellCount?: number;
    readonly nonAirCellCount?: number;
  };
  readonly cells?: readonly unknown[];
  readonly chunkRevision?: number | null;
  readonly chunkVersion?: string | null;
  readonly loadedAt?: string;
}

export const EDITOR_STATE_SCHEMA_VERSION = "vectoplan-editor-state.v1" as const;

export const DEFAULT_TOOL_IDS: readonly EditorToolId[] = [
  "select",
  "place-block",
  "remove-block",
  "inspect",
];

export const DEFAULT_EDITOR_HOTBAR_SLOT_COUNT = 9;

type RuntimeLibraryRecord = RuntimeInventoryLibraryItem & Record<string, unknown>;
type RuntimeAssetRecord = RuntimeInventoryAssetItem & Record<string, unknown>;
type RuntimeBlockRecord = RuntimeInventoryBlockItem & Record<string, unknown>;
type RuntimeHotbarRecord = RuntimeHotbarSlot & Record<string, unknown>;

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
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

function safeNumber(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, numeric));
  } catch {
    return fallback;
  }
}

function safeInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    return Math.trunc(safeNumber(value, fallback, min, max));
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
    const result = new Set<string>();

    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }

      const trimmed = value.trim();

      if (trimmed.length > 0 && !isForbiddenDebugBlockTypeId(trimmed)) {
        result.add(trimmed);
      }
    }

    return [...result];
  } catch {
    return [];
  }
}

function cloneVector3(
  value: EditorVector3 | EditorStateVector3 | undefined,
  fallback: EditorStateVector3,
): EditorStateVector3 {
  try {
    if (!value) {
      return fallback;
    }

    return {
      x: safeNumber(value.x, fallback.x),
      y: safeNumber(value.y, fallback.y),
      z: safeNumber(value.z, fallback.z),
    };
  } catch {
    return fallback;
  }
}

function cloneEuler3(
  value: EditorEuler3 | EditorStateEuler3 | undefined,
  fallback: EditorStateEuler3,
): EditorStateEuler3 {
  try {
    if (!value) {
      return fallback;
    }

    return {
      pitch: safeNumber(value.pitch, fallback.pitch),
      yaw: safeNumber(value.yaw, fallback.yaw),
      roll: safeNumber(value.roll, fallback.roll),
    };
  } catch {
    return fallback;
  }
}

function createPlayerBootstrapInput(
  bootstrap: EditorBootstrap,
  cameraSpawn: EditorStateVector3,
  cameraRotation: EditorStateEuler3,
  createdAt: string,
): PlayerStateBootstrapInput {
  try {
    const runtimePhysics = (bootstrap.runtime as unknown as {
      readonly physics?: unknown;
    }).physics;

    const rootPhysics = (bootstrap as unknown as {
      readonly physics?: unknown;
    }).physics;

    return {
      cameraSpawn: {
        x: cameraSpawn.x,
        y: cameraSpawn.y,
        z: cameraSpawn.z,
        yaw: cameraRotation.yaw,
        pitch: cameraRotation.pitch,
        roll: cameraRotation.roll,
      },
      physics: runtimePhysics && typeof runtimePhysics === "object"
        ? runtimePhysics
        : rootPhysics && typeof rootPhysics === "object"
          ? rootPhysics
          : null,
      source: "bootstrap",
      nowMs: Date.parse(createdAt),
    };
  } catch {
    return {
      cameraSpawn: {
        x: cameraSpawn.x,
        y: cameraSpawn.y,
        z: cameraSpawn.z,
        yaw: cameraRotation.yaw,
        pitch: cameraRotation.pitch,
        roll: cameraRotation.roll,
      },
      physics: null,
      source: "bootstrap",
      nowMs: Date.now(),
    };
  }
}

function cameraPositionFromPlayer(player: EditorPlayerState): EditorStateVector3 {
  try {
    return {
      x: safeNumber(player.eyePosition.x, player.position.x),
      y: safeNumber(player.eyePosition.y, player.position.y),
      z: safeNumber(player.eyePosition.z, player.position.z),
    };
  } catch {
    return {
      x: 0,
      y: 8,
      z: 0,
    };
  }
}

function cameraRotationFromPlayer(player: EditorPlayerState, fallback: EditorStateEuler3): EditorStateEuler3 {
  try {
    return {
      pitch: safeNumber(player.angles.pitch, fallback.pitch),
      yaw: safeNumber(player.angles.yaw, fallback.yaw),
      roll: safeNumber(player.angles.roll, fallback.roll),
    };
  } catch {
    return fallback;
  }
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "");
  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

function safeRuntimeBlockTypeId(value: unknown, fallback: string | null = null): string | null {
  const normalized = safeNullableString(value, fallback);
  if (!normalized || isForbiddenDebugBlockTypeId(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeInventorySource(value: unknown, fallback: EditorInventorySource): EditorInventorySource {
  const normalized = safeString(value, fallback);

  if (
    normalized === "library"
    || normalized === "library-service"
    || normalized === "editor-inventory"
    || normalized === "vplib"
    || normalized === "creative-library"
    || normalized === "chunk-service"
    || normalized === "editor-placeholder"
    || normalized === "chunk-palette"
    || normalized === "static-fallback"
    || normalized === "runtime-generated"
    || normalized === "empty-fallback"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeSlot(slot: unknown, slotCount: number): number {
  return safeInteger(slot, 0, 0, Math.max(0, slotCount - 1));
}

function normalizeIcon(value: unknown, fallbackText: string): EditorInventoryIcon {
  try {
    if (!value || typeof value !== "object") {
      return {
        kind: "text",
        value: fallbackText.slice(0, 2).toUpperCase(),
      };
    }

    const record = value as {
      readonly kind?: unknown;
      readonly value?: unknown;
      readonly url?: unknown;
    };
    const kind = safeString(record.kind, "text");

    if (kind === "color" || kind === "asset-url" || kind === "none" || kind === "text" || kind === "library") {
      return {
        kind,
        value: safeNullableString(record.value ?? record.url, null),
      };
    }

    return {
      kind: "text",
      value: fallbackText.slice(0, 2).toUpperCase(),
    };
  } catch {
    return {
      kind: "none",
      value: null,
    };
  }
}

function normalizeLibraryRef(input: unknown): EditorInventoryLibraryRef | null {
  try {
    if (!input || typeof input !== "object") {
      return null;
    }

    const record = input as Record<string, unknown>;
    const familyId = safeNullableString(record.familyId ?? record.family_id, null);
    const vplibUid = safeNullableString(record.vplibUid ?? record.vplib_uid, null);
    const libraryItemId = safeNullableString(record.libraryItemId ?? record.library_item_id ?? record.itemId ?? record.item_id, null);

    if (!familyId && !vplibUid && !libraryItemId) {
      return null;
    }

    return {
      source: safeString(record.source, "vectoplan-library"),
      kind: "vplib",
      libraryItemId,
      familyId,
      packageId: safeNullableString(record.packageId ?? record.package_id, null),
      vplibUid,
      variantId: safeNullableString(record.variantId ?? record.variant_id, "default"),
      revisionHash: safeNullableString(record.revisionHash ?? record.revision_hash, null),
      objectKind: safeNullableString(record.objectKind ?? record.object_kind, null),
      domain: safeNullableString(record.domain, null),
      category: safeNullableString(record.category, null),
      subcategory: safeNullableString(record.subcategory, null),
      sourcePath: safeNullableString(record.sourcePath ?? record.source_path, null),
      stableKey: vplibUid ? `vplib:${vplibUid}` : familyId ? `family:${familyId}` : libraryItemId,
      valid: Boolean(familyId || vplibUid || libraryItemId),
    } as EditorInventoryLibraryRef;
  } catch {
    return null;
  }
}

function normalizePlacementCommand(
  input: unknown,
  fallbackRef: EditorInventoryLibraryRef | null,
  fallbackRuntimeBlockTypeId: string | null,
): EditorInventoryPlacementCommand | null {
  try {
    if (input && typeof input === "object") {
      const record = input as Record<string, unknown>;
      const runtimeBlockTypeId = safeRuntimeBlockTypeId(
        record.runtimeBlockTypeId
          ?? record.runtime_block_type_id
          ?? record.blockTypeId
          ?? record.block_type_id,
        fallbackRuntimeBlockTypeId,
      );
      const libraryRef = normalizeLibraryRef(record.libraryRef ?? record.library_ref) ?? fallbackRef;

      if (runtimeBlockTypeId && libraryRef) {
        return {
          ...record,
          kind: safeString(record.kind, "PlaceLibraryItem"),
          source: safeString(record.source, "vectoplan-library"),
          runtimeBlockTypeId,
          blockTypeId: safeRuntimeBlockTypeId(record.blockTypeId ?? record.block_type_id, runtimeBlockTypeId),
          libraryRef,
          placeable: true,
        } as EditorInventoryPlacementCommand;
      }
    }

    if (fallbackRuntimeBlockTypeId && fallbackRef) {
      return {
        kind: "PlaceLibraryItem",
        source: "vectoplan-library",
        runtimeBlockTypeId: fallbackRuntimeBlockTypeId,
        blockTypeId: fallbackRuntimeBlockTypeId,
        libraryRef: fallbackRef,
        placeable: true,
      } as EditorInventoryPlacementCommand;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizePlacementRef(input: Partial<EditorInventoryPlacementRef> | null | undefined): EditorInventoryPlacementRef {
  try {
    const blockTypeId = safeRuntimeBlockTypeId(input?.blockTypeId, null);
    const runtimeBlockTypeId = safeRuntimeBlockTypeId(input?.runtimeBlockTypeId, blockTypeId);

    return {
      kind:
        input?.kind === "vplib"
        || input?.kind === "library-item"
        || input?.kind === "block"
        || input?.kind === "asset"
        || input?.kind === "unknown"
          ? input.kind
          : "unknown",
      blockTypeId,
      runtimeBlockTypeId,
      assetTypeId: safeNullableString(input?.assetTypeId, null),
      libraryItemId: safeNullableString(input?.libraryItemId, null),
      familyId: safeNullableString(input?.familyId, null),
      packageId: safeNullableString(input?.packageId, null),
      vplibUid: safeNullableString(input?.vplibUid, null),
      variantId: safeNullableString(input?.variantId, null),
      revisionHash: safeNullableString(input?.revisionHash, null),
      objectKind: safeNullableString(input?.objectKind, null),
      libraryRef: input?.libraryRef ?? null,
      placementCommand: input?.placementCommand ?? null,
    };
  } catch {
    return createEmptyPlacementRef();
  }
}

function createEmptyPlacementRef(): EditorInventoryPlacementRef {
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

function createLibraryPlacementRef(
  input: {
    readonly runtimeBlockTypeId: string | null;
    readonly libraryItemId: string | null;
    readonly familyId: string | null;
    readonly packageId: string | null;
    readonly vplibUid: string | null;
    readonly variantId: string | null;
    readonly revisionHash: string | null;
    readonly objectKind: string | null;
    readonly libraryRef: EditorInventoryLibraryRef | null;
    readonly placementCommand: EditorInventoryPlacementCommand | null;
  },
): EditorInventoryPlacementRef {
  return {
    kind: input.libraryItemId ? "library-item" : "vplib",
    blockTypeId: input.runtimeBlockTypeId,
    runtimeBlockTypeId: input.runtimeBlockTypeId,
    assetTypeId: null,
    libraryItemId: input.libraryItemId,
    familyId: input.familyId,
    packageId: input.packageId,
    vplibUid: input.vplibUid,
    variantId: input.variantId,
    revisionHash: input.revisionHash,
    objectKind: input.objectKind,
    libraryRef: input.libraryRef,
    placementCommand: input.placementCommand,
  };
}

function deriveColorFromBlock(block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition): string | null {
  try {
    const value = block.metadata.debugColor ?? block.metadata.color;

    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

function deriveShortLabel(label: string): string {
  try {
    if (label.length <= 12) {
      return label;
    }

    const compact = label
      .replace(/^Debug\s+/i, "")
      .replace(/Block$/i, "")
      .replace(/_/g, " ")
      .trim();

    if (compact.length > 0 && compact.length <= 12) {
      return compact;
    }

    return `${label.slice(0, 10)}…`;
  } catch {
    return "Item";
  }
}

function metadataString(
  block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition,
  key: string,
): string | null {
  try {
    const value = (block.metadata as Record<string, unknown>)[key];

    return safeNullableString(value, null);
  } catch {
    return null;
  }
}

function inventorySourceFromBlock(block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition): EditorInventorySource {
  try {
    switch (block.source) {
      case "chunk-service-blocks-route":
      case "chunk-service-placeable-blocks-route":
      case "chunk-service-creative-library-route":
        return "chunk-service";

      case "editor-placeholder-route":
        return "editor-placeholder";

      case "chunk-palette":
        return "chunk-palette";

      case "static-client-fallback":
        return "static-fallback";

      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

function normalizeLifecycleStatus(value: unknown, fallback: EditorLifecycleStatus): EditorLifecycleStatus {
  const normalized = safeString(value, fallback);

  if (
    normalized === "created"
    || normalized === "bootstrapping"
    || normalized === "initializing"
    || normalized === "loading"
    || normalized === "ready"
    || normalized === "degraded"
    || normalized === "failed"
    || normalized === "destroying"
    || normalized === "destroyed"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeTargetStatus(value: unknown, fallback: EditorTargetStatus = "unknown"): EditorTargetStatus {
  const normalized = safeString(value, fallback);

  if (
    normalized === "none"
    || normalized === "valid"
    || normalized === "blocked"
    || normalized === "invalid"
    || normalized === "missing-chunk"
    || normalized === "out-of-range"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeTargetKind(value: unknown, fallback: EditorTargetKind = "unknown"): EditorTargetKind {
  const normalized = safeString(value, fallback);

  if (
    normalized === "none"
    || normalized === "chunk-cell"
    || normalized === "block-face"
    || normalized === "block"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeCommandStatus(value: unknown): EditorCommandStatus {
  const normalized = safeString(value, "idle");

  if (
    normalized === "idle"
    || normalized === "pending"
    || normalized === "applied"
    || normalized === "noop"
    || normalized === "rejected"
    || normalized === "failed"
  ) {
    return normalized;
  }

  return "idle";
}

function normalizePointerButton(value: unknown): EditorPointerButton {
  const normalized = safeString(value, "unknown");

  if (
    normalized === "primary"
    || normalized === "secondary"
    || normalized === "middle"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return "unknown";
}

function normalizeCellPosition(value: Partial<EditorStateChunkCellPosition> | null | undefined): EditorStateChunkCellPosition | null {
  if (!value) {
    return null;
  }

  try {
    return {
      chunkKey: safeString(value.chunkKey, "0:0:0"),
      chunkX: safeInteger(value.chunkX, 0),
      chunkY: safeInteger(value.chunkY, 0),
      chunkZ: safeInteger(value.chunkZ, 0),
      localX: safeInteger(value.localX, 0),
      localY: safeInteger(value.localY, 0),
      localZ: safeInteger(value.localZ, 0),
      worldX: safeInteger(value.worldX, 0),
      worldY: safeInteger(value.worldY, 0),
      worldZ: safeInteger(value.worldZ, 0),
      cellValue: safeInteger(value.cellValue, 0),
      blockTypeId: safeRuntimeBlockTypeId(value.blockTypeId, null),
    };
  } catch {
    return null;
  }
}

function chunkSourceFromInput(value: unknown): EditorChunkSummary["source"] {
  const normalized = safeString(value, "unknown");

  if (normalized === "snapshot" || normalized === "generated" || normalized === "unknown") {
    return normalized;
  }

  return "unknown";
}

function isLibraryLikeInventoryItem(item: EditorInventoryItem | null): boolean {
  if (!item) {
    return false;
  }

  return Boolean(
    item.kind === "vplib"
      || item.kind === "library-item"
      || item.sourceKind === "library"
      || item.sourceKind === "vplib"
      || item.libraryRef
      || item.placementCommand
      || item.libraryItemId
      || item.familyId
      || item.vplibUid,
  );
}

function isPlaceableLibraryInventoryItem(item: EditorInventoryItem | null): boolean {
  if (!item) {
    return false;
  }

  return Boolean(
    item.enabled === true
      && item.placeable === true
      && item.runtimeBlockTypeId
      && isLibraryLikeInventoryItem(item),
  );
}

function selectedItemForSlot(
  items: readonly EditorInventoryItem[],
  slot: number,
): EditorInventoryItem | null {
  try {
    const exact = items.find((item) => item.slot === slot && isPlaceableLibraryInventoryItem(item));

    if (exact) {
      return exact;
    }

    return items.find((item) => item.slot === slot) ?? null;
  } catch {
    return null;
  }
}

function selectedItemFallback(
  items: readonly EditorInventoryItem[],
): EditorInventoryItem | null {
  try {
    return items.find((item) => isPlaceableLibraryInventoryItem(item)) ?? null;
  } catch {
    return null;
  }
}

function selectedItemByRuntimeBlockTypeId(
  items: readonly EditorInventoryItem[],
  runtimeBlockTypeId: string | null,
): EditorInventoryItem | null {
  if (!runtimeBlockTypeId) {
    return null;
  }

  try {
    return items.find((item) => item.runtimeBlockTypeId === runtimeBlockTypeId || item.blockTypeId === runtimeBlockTypeId) ?? null;
  } catch {
    return null;
  }
}

function readChunkLoadedAt(
  chunk: ChunkApiRuntimeChunkContent | EditorChunkSummaryInput,
  fallback: string,
): string {
  try {
    const record = chunk as unknown as {
      readonly loadedAt?: unknown;
    };

    return safeString(record.loadedAt, fallback);
  } catch {
    return fallback;
  }
}

function createBlockPlacementRef(blockTypeId: string | null): EditorInventoryPlacementRef {
  const safeBlockTypeId = safeRuntimeBlockTypeId(blockTypeId, null);

  return {
    kind: safeBlockTypeId ? "block" : "unknown",
    blockTypeId: safeBlockTypeId,
    runtimeBlockTypeId: safeBlockTypeId,
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

function createDefaultInventoryIcon(label: string, color: string | null): EditorInventoryIcon {
  if (color) {
    return {
      kind: "color",
      value: color,
    };
  }

  return {
    kind: "text",
    value: deriveShortLabel(label).slice(0, 2).toUpperCase(),
  };
}

function createEmptyHotbarSlot(slot: number, selected: boolean): EditorInventoryHotbarSlot {
  return {
    slot,
    index: slot,
    status: "empty",
    selected,
    label: "Leer",
    shortLabel: "Leer",
    title: "Kein Library-/VPLIB-Item zugewiesen.",
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
    sourceKind: "empty-fallback",
    itemKind: "empty",
    color: null,
    icon: {
      kind: "none",
      value: null,
    },
    keyBinding: String(slot + 1),
    enabled: false,
    libraryRef: null,
    placementCommand: null,
  };
}

function createDisabledHotbarSlotFromItem(
  item: EditorInventoryItem,
  selected: boolean,
): EditorInventoryHotbarSlot {
  return {
    slot: item.slot,
    index: item.slot,
    status: "disabled",
    selected,
    label: item.label,
    shortLabel: item.shortLabel,
    title: item.disabledReason ?? "Dieses Item ist nicht platzierbar.",
    blockTypeId: item.blockTypeId,
    runtimeBlockTypeId: item.runtimeBlockTypeId,
    assetTypeId: item.assetTypeId,
    libraryItemId: item.libraryItemId,
    familyId: item.familyId,
    packageId: item.packageId,
    vplibUid: item.vplibUid,
    variantId: item.variantId,
    revisionHash: item.revisionHash,
    objectKind: item.objectKind,
    sourceKind: item.sourceKind,
    itemKind: item.kind,
    color: item.color,
    icon: item.icon,
    keyBinding: String(item.slot + 1),
    enabled: false,
    libraryRef: item.libraryRef,
    placementCommand: item.placementCommand,
  };
}

function createEditorHotbarSlotsFromItems(
  items: readonly EditorInventoryItem[],
  slotCount: number,
  selectedSlot: number,
): readonly EditorInventoryHotbarSlot[] {
  try {
    const safeSlotCount = safeInteger(slotCount, DEFAULT_EDITOR_HOTBAR_SLOT_COUNT, 1, 64);
    const selected = normalizeSlot(selectedSlot, safeSlotCount);

    return Array.from({ length: safeSlotCount }, (_, slot) => {
      const item = selectedItemForSlot(items, slot);
      const isSelected = slot === selected;

      if (!item) {
        return createEmptyHotbarSlot(slot, isSelected);
      }

      if (!isPlaceableLibraryInventoryItem(item)) {
        return createDisabledHotbarSlotFromItem(item, isSelected);
      }

      return {
        slot,
        index: slot,
        status: isSelected ? "selected" : "available",
        selected: isSelected,
        label: item.label,
        shortLabel: item.shortLabel,
        title: `${item.label} (${item.runtimeBlockTypeId ?? item.id})`,
        blockTypeId: item.runtimeBlockTypeId,
        runtimeBlockTypeId: item.runtimeBlockTypeId,
        assetTypeId: item.assetTypeId,
        libraryItemId: item.libraryItemId,
        familyId: item.familyId,
        packageId: item.packageId,
        vplibUid: item.vplibUid,
        variantId: item.variantId,
        revisionHash: item.revisionHash,
        objectKind: item.objectKind,
        sourceKind: item.sourceKind,
        itemKind: item.kind,
        color: item.color,
        icon: item.icon,
        keyBinding: String(slot + 1),
        enabled: true,
        libraryRef: item.libraryRef,
        placementCommand: item.placementCommand,
      };
    });
  } catch {
    return [];
  }
}

function hotbarSlotHasLibraryIdentity(slot: RuntimeHotbarRecord): boolean {
  try {
    return Boolean(
      slot.itemKind === "vplib"
        || slot.itemKind === "library-item"
        || slot.sourceKind === "library"
        || slot.libraryItemId
        || slot.familyId
        || slot.vplibUid
        || slot.libraryRef
        || slot.placementCommand,
    );
  } catch {
    return false;
  }
}

function createEditorHotbarSlotFromRuntimeSlot(slot: RuntimeHotbarSlot): EditorInventoryHotbarSlot {
  try {
    const record = slot as RuntimeHotbarRecord;
    const runtimeBlockTypeId = safeRuntimeBlockTypeId(record.runtimeBlockTypeId ?? record.blockTypeId, null);
    const libraryIdentity = hotbarSlotHasLibraryIdentity(record);
    const enabled = safeBoolean(record.enabled, record.status === "available" || record.status === "selected")
      && Boolean(runtimeBlockTypeId)
      && libraryIdentity;

    return {
      slot: safeInteger(record.slot, 0, 0),
      index: safeInteger(record.index ?? record.slot, safeInteger(record.slot, 0), 0),
      status:
        enabled
          ? safeBoolean(record.selected, false) ? "selected" : "available"
          : record.status === "empty" ? "empty" : "disabled",
      selected: safeBoolean(record.selected, false),
      label: safeString(record.label, enabled ? "Library Item" : "Leer"),
      shortLabel: safeString(record.shortLabel, safeString(record.label, "Leer")),
      title: safeString(record.title, safeString(record.label, "Leer")),
      blockTypeId: runtimeBlockTypeId,
      runtimeBlockTypeId,
      assetTypeId: safeNullableString(record.assetTypeId, null),
      libraryItemId: safeNullableString(record.libraryItemId, null),
      familyId: safeNullableString(record.familyId, null),
      packageId: safeNullableString(record.packageId, null),
      vplibUid: safeNullableString(record.vplibUid, null),
      variantId: safeNullableString(record.variantId, null),
      revisionHash: safeNullableString(record.revisionHash, null),
      objectKind: safeNullableString(record.objectKind, null),
      sourceKind: normalizeInventorySource(record.sourceKind, enabled ? "library" : "empty-fallback"),
      itemKind:
        record.itemKind === "vplib"
        || record.itemKind === "library-item"
        || record.itemKind === "asset"
        || record.itemKind === "block"
        || record.itemKind === "empty"
          ? record.itemKind
          : enabled ? "library-item" : "empty",
      color: safeNullableString(record.color, null),
      icon: normalizeIcon(record.icon, safeString(record.label, "Leer")),
      keyBinding: safeString(record.keyBinding, String(safeInteger(record.slot, 0) + 1)),
      enabled,
      libraryRef: normalizeLibraryRef(record.libraryRef) ?? null,
      placementCommand: normalizePlacementCommand(record.placementCommand, normalizeLibraryRef(record.libraryRef), runtimeBlockTypeId),
    };
  } catch {
    return createEmptyHotbarSlot(0, false);
  }
}

export function createEditorStateError(input: EditorStateErrorInput): ChunkApiErrorDetails {
  return {
    code: safeString(input.code, "editor_state_error"),
    message: safeString(input.message, "Editor state error."),
    retryable: input.retryable ?? false,
    statusCode: null,
    requestId: null,
    requestKind: null,
    url: null,
    method: null,
    exceptionType: null,
    details: input.details ?? null,
  };
}

export function normalizeEditorStateError(error: unknown, fallbackCode = "editor_state_error"): ChunkApiErrorDetails {
  if (
    error
    && typeof error === "object"
    && "code" in error
    && "message" in error
  ) {
    const details = error as Partial<ChunkApiErrorDetails>;

    return {
      code: safeString(details.code, fallbackCode),
      message: safeString(details.message, "Editor state error."),
      retryable: details.retryable ?? false,
      statusCode: details.statusCode ?? null,
      requestId: details.requestId ?? null,
      requestKind: details.requestKind ?? null,
      url: details.url ?? null,
      method: details.method ?? null,
      exceptionType: details.exceptionType ?? null,
      details: details.details ?? null,
    };
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message,
      retryable: true,
      statusCode: null,
      requestId: null,
      requestKind: null,
      url: null,
      method: null,
      exceptionType: error.name,
      details: null,
    };
  }

  return {
    code: fallbackCode,
    message: typeof error === "string" ? error : "Editor state error.",
    retryable: true,
    statusCode: null,
    requestId: null,
    requestKind: null,
    url: null,
    method: null,
    exceptionType: null,
    details: null,
  };
}

export function createEditorInventoryItemFromBlock(
  block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition,
  slot: number,
): EditorInventoryItem {
  const blockTypeId = safeRuntimeBlockTypeId(block.blockTypeId, null);
  const label = safeString(block.label, safeString(block.blockTypeId, `Block ${slot + 1}`));
  const color = deriveColorFromBlock(block);

  return {
    slot,
    id: `legacy-block:${blockTypeId ?? slot}`,
    kind: "block",
    blockTypeId,
    runtimeBlockTypeId: blockTypeId,
    assetTypeId: null,
    libraryItemId: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    label,
    shortLabel: deriveShortLabel(label),
    cellValue: safeInteger(block.cellValue, slot + 1, 1),
    paletteIndex: block.paletteIndex === null ? null : safeInteger(block.paletteIndex, slot, 0),
    registryId: safeString(block.registryId, "legacy-chunk-blocks"),
    registryVersion: safeString(block.registryVersion, "1"),
    solid: safeBoolean(block.solid, true),
    placeable: false,
    breakable: safeBoolean(block.breakable, true),
    enabled: false,
    disabledReason: "Legacy chunk blocks are diagnostic-only. Productive placement requires Library/VPLIB inventory.",
    category: metadataString(block, "category"),
    role: metadataString(block, "role"),
    color,
    icon: createDefaultInventoryIcon(label, color),
    placementRef: createBlockPlacementRef(blockTypeId),
    source: block.source,
    sourceKind: inventorySourceFromBlock(block),
    libraryRef: null,
    placementCommand: null,
    raw: block,
  };
}

export function createEditorInventoryItemFromRuntimeBlockItem(
  item: RuntimeInventoryBlockItem,
): EditorInventoryItem {
  const record = item as RuntimeBlockRecord;
  const blockTypeId = safeRuntimeBlockTypeId(record.blockTypeId, null);
  const label = safeString(record.label, blockTypeId ?? "Legacy Block");
  const color = typeof record.color === "object" && record.color
    ? safeNullableString((record.color as { readonly css?: unknown }).css, null)
    : null;

  return {
    slot: safeInteger(record.slot, 0, 0),
    id: safeString(record.id, `legacy-block:${blockTypeId ?? record.slot}`),
    kind: "block",
    blockTypeId,
    runtimeBlockTypeId: blockTypeId,
    assetTypeId: null,
    libraryItemId: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    label,
    shortLabel: safeString(record.shortLabel, deriveShortLabel(label)),
    cellValue: safeInteger(record.cellValue, record.slot + 1, 1),
    paletteIndex: record.paletteIndex === null ? null : safeInteger(record.paletteIndex, record.slot, 0),
    registryId: safeString(record.registryId, "legacy-chunk-blocks"),
    registryVersion: safeString(record.registryVersion, "1"),
    solid: safeBoolean(record.solid, true),
    placeable: false,
    breakable: safeBoolean(record.breakable, true),
    enabled: false,
    disabledReason: "Legacy chunk blocks are diagnostic-only. Productive placement requires Library/VPLIB inventory.",
    category: safeNullableString(record.category, null),
    role: safeNullableString(record.role, null),
    color,
    icon: normalizeIcon(record.icon, label),
    placementRef: normalizePlacementRef(record.placementRef as Partial<EditorInventoryPlacementRef> | null | undefined),
    source: record.rawBlock?.source ?? "static-client-fallback",
    sourceKind: normalizeInventorySource(record.sourceKind, "unknown"),
    libraryRef: null,
    placementCommand: null,
    raw: record.rawBlock ?? record,
  };
}

export function createEditorInventoryItemFromRuntimeLibraryItem(
  item: RuntimeInventoryLibraryItem,
): EditorInventoryItem {
  const record = item as RuntimeLibraryRecord;
  const runtimeBlockTypeId = safeRuntimeBlockTypeId(record.runtimeBlockTypeId ?? record.blockTypeId, null);
  const libraryRef = normalizeLibraryRef(record.libraryRef ?? record.placementRef?.libraryRef ?? record);
  const placementCommand = normalizePlacementCommand(record.placementCommand ?? record.placementRef?.placementCommand, libraryRef, runtimeBlockTypeId);
  const label = safeString(record.label, safeNullableString(record.familyId ?? record.vplibUid, null) ?? runtimeBlockTypeId ?? "VPLIB Item");
  const hasLibraryIdentity = Boolean(libraryRef?.valid || record.familyId || record.vplibUid || record.libraryItemId);
  const enabled = safeBoolean(record.enabled, true) && Boolean(runtimeBlockTypeId && hasLibraryIdentity);

  return {
    slot: safeInteger(record.slot, 0, 0),
    id: safeString(record.id, `vplib:${record.vplibUid ?? record.familyId ?? record.libraryItemId ?? record.slot}`),
    kind: record.itemKind === "vplib" ? "vplib" : "library-item",
    blockTypeId: runtimeBlockTypeId,
    runtimeBlockTypeId,
    assetTypeId: null,
    libraryItemId: safeNullableString(record.libraryItemId, null),
    familyId: safeNullableString(record.familyId, null),
    packageId: safeNullableString(record.packageId, null),
    vplibUid: safeNullableString(record.vplibUid, null),
    variantId: safeNullableString(record.variantId, "default"),
    revisionHash: safeNullableString(record.revisionHash, null),
    objectKind: safeNullableString(record.objectKind, null),
    label,
    shortLabel: safeString(record.shortLabel, deriveShortLabel(label)),
    cellValue: null,
    paletteIndex: null,
    registryId: "vectoplan-library",
    registryVersion: safeNullableString(record.revisionHash, "1") ?? "1",
    solid: true,
    placeable: enabled,
    breakable: false,
    enabled,
    disabledReason: enabled ? safeNullableString(record.disabledReason, null) : "Library/VPLIB item is missing runtime block type or library identity.",
    category: safeNullableString(record.category, null),
    role: safeNullableString(record.role, "library"),
    color: typeof record.color === "object" && record.color
      ? safeNullableString((record.color as { readonly css?: unknown }).css, "#a78bfa")
      : "#a78bfa",
    icon: normalizeIcon(record.icon, label),
    placementRef: createLibraryPlacementRef({
      runtimeBlockTypeId,
      libraryItemId: safeNullableString(record.libraryItemId, null),
      familyId: safeNullableString(record.familyId, null),
      packageId: safeNullableString(record.packageId, null),
      vplibUid: safeNullableString(record.vplibUid, null),
      variantId: safeNullableString(record.variantId, "default"),
      revisionHash: safeNullableString(record.revisionHash, null),
      objectKind: safeNullableString(record.objectKind, null),
      libraryRef,
      placementCommand,
    }),
    source: "vectoplan-library",
    sourceKind: "library",
    libraryRef,
    placementCommand,
    raw: item,
  };
}

export function createEditorInventoryItemFromRuntimeAssetItem(
  item: RuntimeInventoryAssetItem,
): EditorInventoryItem {
  const record = item as RuntimeAssetRecord;
  const runtimeBlockTypeId = safeRuntimeBlockTypeId(record.runtimeBlockTypeId ?? record.blockTypeId, null);
  const libraryRef = normalizeLibraryRef(record.libraryRef ?? record.placementRef?.libraryRef ?? record);
  const placementCommand = normalizePlacementCommand(record.placementCommand ?? record.placementRef?.placementCommand, libraryRef, runtimeBlockTypeId);
  const label = safeString(record.label, safeString(record.assetTypeId, "Asset Item"));
  const hasLibraryIdentity = Boolean(libraryRef?.valid || record.familyId || record.vplibUid || record.libraryItemId);
  const enabled = safeBoolean(record.enabled, true) && Boolean(runtimeBlockTypeId && hasLibraryIdentity);

  return {
    slot: safeInteger(record.slot, 0, 0),
    id: safeString(record.id, `asset:${record.assetTypeId ?? record.libraryItemId ?? record.slot}`),
    kind: "asset",
    blockTypeId: runtimeBlockTypeId,
    runtimeBlockTypeId,
    assetTypeId: safeNullableString(record.assetTypeId, null),
    libraryItemId: safeNullableString(record.libraryItemId, null),
    familyId: safeNullableString(record.familyId, null),
    packageId: safeNullableString(record.packageId, null),
    vplibUid: safeNullableString(record.vplibUid, null),
    variantId: safeNullableString(record.variantId, "default"),
    revisionHash: safeNullableString(record.revisionHash, null),
    objectKind: safeNullableString(record.objectKind, null),
    label,
    shortLabel: safeString(record.shortLabel, deriveShortLabel(label)),
    cellValue: null,
    paletteIndex: null,
    registryId: "vectoplan-library",
    registryVersion: safeNullableString(record.revisionHash, "1") ?? "1",
    solid: true,
    placeable: enabled,
    breakable: false,
    enabled,
    disabledReason: enabled ? safeNullableString(record.disabledReason, null) : "Asset item is missing runtime block type or library identity.",
    category: safeNullableString(record.category, null),
    role: safeNullableString(record.role, "asset"),
    color: typeof record.color === "object" && record.color
      ? safeNullableString((record.color as { readonly css?: unknown }).css, "#38bdf8")
      : "#38bdf8",
    icon: normalizeIcon(record.icon, label),
    placementRef: createLibraryPlacementRef({
      runtimeBlockTypeId,
      libraryItemId: safeNullableString(record.libraryItemId, null),
      familyId: safeNullableString(record.familyId, null),
      packageId: safeNullableString(record.packageId, null),
      vplibUid: safeNullableString(record.vplibUid, null),
      variantId: safeNullableString(record.variantId, "default"),
      revisionHash: safeNullableString(record.revisionHash, null),
      objectKind: safeNullableString(record.objectKind, null),
      libraryRef,
      placementCommand,
    }),
    source: "vectoplan-library",
    sourceKind: "library",
    libraryRef,
    placementCommand,
    raw: item,
  };
}

export function createEditorInventoryItemsFromBlocks(
  blocks: readonly (ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition)[],
  slotCount: number,
): readonly EditorInventoryItem[] {
  try {
    const safeSlotCount = safeInteger(slotCount, DEFAULT_EDITOR_HOTBAR_SLOT_COUNT, 1, 18);

    return blocks
      .filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId))
      .slice(0, safeSlotCount)
      .map((block, index) => createEditorInventoryItemFromBlock(block, index));
  } catch {
    return [];
  }
}

export function createEditorInventoryItemsFromCatalog(catalog: InventoryCatalog): readonly EditorInventoryItem[] {
  try {
    const libraryItems = catalog.libraryItems.map((item) => createEditorInventoryItemFromRuntimeLibraryItem(item));
    const assetItems = catalog.assetItems.map((item) => createEditorInventoryItemFromRuntimeAssetItem(item));

    /**
     * Block items are intentionally not part of productive inventory selection.
     * They are legacy diagnostics and must not become placeable hotbar items.
     */
    const legacyBlockItems = catalog.blockItems
      .filter((item) => !isForbiddenDebugBlockTypeId(item.blockTypeId))
      .map((item) => createEditorInventoryItemFromRuntimeBlockItem(item));

    return [
      ...libraryItems,
      ...assetItems,
      ...legacyBlockItems,
    ];
  } catch {
    return [];
  }
}

export function createEditorCreativeLibraryItemFromBlock(
  block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition,
): EditorCreativeLibraryItem {
  const blockTypeId = safeRuntimeBlockTypeId(block.blockTypeId, null);
  const label = safeString(block.label, blockTypeId ?? "unknown_block");
  const color = deriveColorFromBlock(block);

  return {
    id: `legacy-block:${blockTypeId ?? "unknown"}`,
    kind: "block",
    blockTypeId,
    runtimeBlockTypeId: blockTypeId,
    assetTypeId: null,
    libraryItemId: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    label,
    shortLabel: deriveShortLabel(label),
    category: metadataString(block, "category"),
    role: metadataString(block, "role"),
    color,
    icon: createDefaultInventoryIcon(label, color),
    placementRef: createBlockPlacementRef(blockTypeId),
    source: inventorySourceFromBlock(block),
    libraryRef: null,
    placementCommand: null,
    raw: block,
  };
}

export function createEditorCreativeLibraryItemFromRuntimeLibraryItem(
  item: RuntimeInventoryLibraryItem,
): EditorCreativeLibraryItem {
  const inventoryItem = createEditorInventoryItemFromRuntimeLibraryItem(item);

  return {
    id: inventoryItem.id,
    kind: inventoryItem.kind,
    blockTypeId: inventoryItem.blockTypeId,
    runtimeBlockTypeId: inventoryItem.runtimeBlockTypeId,
    assetTypeId: null,
    libraryItemId: inventoryItem.libraryItemId,
    familyId: inventoryItem.familyId,
    packageId: inventoryItem.packageId,
    vplibUid: inventoryItem.vplibUid,
    variantId: inventoryItem.variantId,
    revisionHash: inventoryItem.revisionHash,
    objectKind: inventoryItem.objectKind,
    label: inventoryItem.label,
    shortLabel: inventoryItem.shortLabel,
    category: inventoryItem.category,
    role: inventoryItem.role,
    color: inventoryItem.color,
    icon: inventoryItem.icon,
    placementRef: inventoryItem.placementRef,
    source: inventoryItem.sourceKind,
    libraryRef: inventoryItem.libraryRef,
    placementCommand: inventoryItem.placementCommand,
    raw: item,
  };
}

export function createEditorCreativeLibraryItemsFromBlocks(
  blocks: readonly (ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition)[],
): readonly EditorCreativeLibraryItem[] {
  try {
    return blocks
      .filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId))
      .map((block) => createEditorCreativeLibraryItemFromBlock(block));
  } catch {
    return [];
  }
}

export function createEditorCreativeLibraryItemsFromCatalog(
  catalog: InventoryCatalog,
): readonly EditorCreativeLibraryItem[] {
  try {
    const libraryItems = catalog.libraryItems.map((item) => createEditorCreativeLibraryItemFromRuntimeLibraryItem(item));

    if (libraryItems.length > 0) {
      return libraryItems;
    }

    return catalog.blockItems
      .filter((item) => !isForbiddenDebugBlockTypeId(item.blockTypeId))
      .map((item) => createEditorCreativeLibraryItemFromBlock(item.rawBlock));
  } catch {
    return [];
  }
}

export function createChunkSummaryFromContent(
  chunk: ChunkApiRuntimeChunkContent | EditorChunkSummaryInput,
  loadedAt = nowIsoStringSafe(),
): EditorChunkSummary {
  const stats = chunk.stats ?? {};
  const cells = Array.isArray(chunk.cells) ? chunk.cells : [];

  return {
    chunkKey: safeString(
      chunk.chunkKey,
      `${safeInteger(chunk.chunkX, 0)}:${safeInteger(chunk.chunkY, 0)}:${safeInteger(chunk.chunkZ, 0)}`,
    ),
    chunkX: safeInteger(chunk.chunkX, 0),
    chunkY: safeInteger(chunk.chunkY, 0),
    chunkZ: safeInteger(chunk.chunkZ, 0),
    source: chunkSourceFromInput(chunk.source),
    cellCount: safeInteger(stats.cellCount, cells.length, 0),
    nonAirCellCount: safeInteger(stats.nonAirCellCount, 0, 0),
    revision: typeof chunk.chunkRevision === "number" && Number.isFinite(chunk.chunkRevision) ? chunk.chunkRevision : null,
    version: safeNullableString(chunk.chunkVersion, null),
    loadedAt: readChunkLoadedAt(chunk, loadedAt),
  };
}

export function createInitialEditorState(options: CreateInitialEditorStateOptions): EditorState {
  const createdAt = safeString(options.createdAt, nowIsoStringSafe());
  const bootstrap = options.bootstrap;
  const chunk = bootstrap.runtime.chunk;
  const cameraSpawn = cloneVector3(bootstrap.camera.spawn, { x: 8, y: 4, z: 18 });
  const cameraRotation = cloneEuler3(bootstrap.camera.rotation, { pitch: 0, yaw: Math.PI, roll: 0 });
  const inventoryBootstrap = bootstrap.inventory as unknown as {
    readonly slotCount?: unknown;
    readonly hotbarSize?: unknown;
    readonly defaultBlockTypeId?: unknown;
    readonly defaultSelectedSlot?: unknown;
    readonly selectedSlot?: unknown;
    readonly source?: unknown;
  };
  const slotCount = safeInteger(
    inventoryBootstrap.slotCount ?? inventoryBootstrap.hotbarSize,
    DEFAULT_EDITOR_HOTBAR_SLOT_COUNT,
    1,
    64,
  );
  const selectedSlot = normalizeSlot(inventoryBootstrap.selectedSlot ?? inventoryBootstrap.defaultSelectedSlot, slotCount);
  const defaultPreviewBlockTypeId = safeRuntimeBlockTypeId(inventoryBootstrap.defaultBlockTypeId, null);
  const player = createDefaultEditorPlayerState(
    createPlayerBootstrapInput(bootstrap, cameraSpawn, cameraRotation, createdAt),
  );

  return {
    schemaVersion: EDITOR_STATE_SCHEMA_VERSION,
    bootstrap,

    build: {
      buildMode: safeString(options.buildMode, "development"),
      buildVersion: safeString(options.buildVersion, "0.1.0"),
      frontendRoot: "services/vectoplan-editor/src/frontend",
      localWorldFallbackEnabled: false,
      legacyFrontendEnabled: false,
    },

    lifecycle: {
      bootId: safeString(options.bootId, `editor_boot_${Date.now()}`),
      status: "created",
      bootAttemptCount: 0,
      createdAt,
      updatedAt: createdAt,
      readyAt: null,
      failedAt: null,
      destroyedAt: null,
      lastReason: null,
    },

    project: {
      projectId: safeString(chunk.projectId, bootstrap.project.projectId),
      universeId: safeNullableString(bootstrap.project.universeId, null),
      worldId: safeString(chunk.worldId, bootstrap.project.worldId),
      templateId: safeNullableString(bootstrap.project.templateId, null),
      providerId: safeNullableString(bootstrap.project.providerId, null),
      providerWorldId: safeNullableString(bootstrap.project.providerWorldId, null),
    },

    viewport: {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
      aspect: 1,
      resizedAt: null,
      isVisible: true,
      hasCanvas: false,
    },

    input: {
      pointerLocked: false,
      pointerLockAvailable: bootstrap.input.pointerLockEnabled,
      keyboardEnabled: bootstrap.input.keyboardEnabled,
      mouseEnabled: bootstrap.input.mouseEnabled,
      wheelEnabled: bootstrap.input.wheelEnabled,
      pressedKeys: [],
      pressedButtons: [],
      lastPointerButton: null,
      lastPointerDownAt: null,
      lastPointerUpAt: null,
      lastPointerMoveAt: null,
      lastWheelAt: null,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      wheelDelta: 0,
    },

    camera: {
      mode: "first-person",
      position: cameraPositionFromPlayer(player),
      rotation: cameraRotationFromPlayer(player, cameraRotation),
      fov: bootstrap.camera.fov,
      near: bootstrap.camera.near,
      far: bootstrap.camera.far,
      moveSpeed: bootstrap.camera.moveSpeed,
      sprintMultiplier: bootstrap.camera.sprintMultiplier,
      isSprinting: false,
      updatedAt: null,
    },

    player,

    world: {
      connection: {
        status: "unknown",
        sourceKind: "chunk-service",
        apiBaseUrl: chunk.apiBaseUrl,
        projectId: chunk.projectId,
        worldId: chunk.worldId,
        lastStatusAt: null,
        lastError: null,
      },
      chunkSize: 16,
      cellSize: 1,
      loadedChunkKeys: [],
      visibleChunkKeys: [],
      dirtyChunkKeys: [],
      failedChunkKeys: [],
      chunksByKey: {},
      lastLoadedChunkKey: null,
      lastDirtyReloadAt: null,
      lastFullRefreshAt: null,
      chunkCount: 0,
      visibleChunkCount: 0,
      dirtyChunkCount: 0,
    },

    inventory: {
      status: "unknown",
      source: normalizeInventorySource(inventoryBootstrap.source, "library"),
      slotCount,
      selectedSlot,
      selectedSlotIndex: selectedSlot,
      selectedItem: null,
      selectedBlockTypeId: null,
      selectedRuntimeBlockTypeId: null,
      selectedCellValue: null,
      selectedPlacementRef: null,
      selectedLibraryItemId: null,
      selectedFamilyId: null,
      selectedPackageId: null,
      selectedVplibUid: null,
      selectedVariantId: null,
      selectedRevisionHash: null,
      selectedObjectKind: null,
      selectedLibraryRef: null,
      selectedPlacementCommand: null,
      items: [],
      hotbarSlots: createEditorHotbarSlotsFromItems([], slotCount, selectedSlot),
      blockTypeIds: [],
      runtimeBlockTypeIds: [],
      libraryItemIds: [],
      familyIds: [],
      packageIds: [],
      vplibUids: [],
      lastLoadedAt: null,
      lastError: null,
      usedPaletteFallback: false,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    },

    creativeLibrary: {
      status: "unknown",
      source: "library",
      items: [],
      blockTypeIds: [],
      runtimeBlockTypeIds: [],
      libraryItemIds: [],
      familyIds: [],
      packageIds: [],
      vplibUids: [],
      categoryIds: [],
      lastLoadedAt: null,
      lastError: null,
      totalCount: 0,
    },

    targeting: {
      kind: "none",
      status: "none",
      reason: null,
      distance: null,
      chunkKey: null,
      sourceCell: null,
      placementCell: null,
      normal: null,
      updatedAt: null,
    },

    tools: {
      activeToolId: "place-block",
      previousToolId: null,
      availableToolIds: DEFAULT_TOOL_IDS,
      enabledToolIds: DEFAULT_TOOL_IDS,
      cursorHint: "Linksklick: Library-/VPLIB-Item setzen. Rechtsklick: Block entfernen.",
      previewVisible: false,
      previewBlockTypeId: defaultPreviewBlockTypeId,
      updatedAt: null,
    },

    command: {
      status: "idle",
      pendingCommand: null,
      lastCommand: null,
      lastResult: null,
      lastError: null,
      dirtyChunkKeys: [],
      changedChunkKeys: [],
      eventIds: [],
      snapshotIds: [],
      submittedAt: null,
      completedAt: null,
    },

    render: {
      initialized: false,
      frameCount: 0,
      lastFrameAt: null,
      averageFrameMs: null,
      meshCount: 0,
      drawCallCount: 0,
      renderedChunkKeys: [],
      previewVisible: false,
      targetHighlightVisible: false,
      lastError: null,
    },

    ui: {
      loading: true,
      loadingMessage: "Editor wird gestartet.",
      errorVisible: false,
      errorTitle: null,
      errorMessage: null,
      sourceStatusLabel: "Chunk-Service und Library-Inventar werden vorbereitet",
      leftPanelVisible: bootstrap.ui.showLeftPanel,
      rightPanelVisible: bootstrap.ui.showRightPanel,
      hotbarVisible: bootstrap.ui.showHotbar,
      crosshairVisible: true,
      debugOverlayVisible: bootstrap.ui.showDebugOverlay,
      liveMessage: "VECTOPLAN Editor wird geladen.",
    },

    debug: {
      enabled: bootstrap.featureFlags.debugOverlayEnabled,
      lastAction: null,
      lastActionAt: null,
      warnings: bootstrap.diagnostics.warnings,
      errors: [],
      bootstrapWarnings: bootstrap.diagnostics.warnings,
      player: createPlayerDebugState(player, {
        enabled: bootstrap.featureFlags.debugOverlayEnabled,
      }),
    },
  };
}

export function withLifecycleStatus(
  state: EditorState,
  status: EditorLifecycleStatus,
  reason?: string | null,
  bootAttemptCount?: number,
): EditorState {
  const updatedAt = nowIsoStringSafe();

  return {
    ...state,
    lifecycle: {
      ...state.lifecycle,
      status: normalizeLifecycleStatus(status, state.lifecycle.status),
      bootAttemptCount: bootAttemptCount ?? state.lifecycle.bootAttemptCount,
      updatedAt,
      readyAt: status === "ready" ? updatedAt : state.lifecycle.readyAt,
      failedAt: status === "failed" ? updatedAt : state.lifecycle.failedAt,
      destroyedAt: status === "destroyed" ? updatedAt : state.lifecycle.destroyedAt,
      lastReason: reason ?? state.lifecycle.lastReason,
    },
  };
}

export function withWorldConnectionStatus(
  state: EditorState,
  status: EditorConnectionStatus,
  error: ChunkApiErrorDetails | null = null,
): EditorState {
  return {
    ...state,
    world: {
      ...state.world,
      connection: {
        ...state.world.connection,
        status,
        lastStatusAt: nowIsoStringSafe(),
        lastError: error,
      },
    },
  };
}

function deriveInventoryStateFromItems(
  state: EditorState,
  items: readonly EditorInventoryItem[],
  options?: {
    readonly selectedSlot?: number;
    readonly selectedSlotIndex?: number;
    readonly source?: EditorInventorySource;
    readonly usedPaletteFallback?: boolean;
    readonly error?: ChunkApiErrorDetails | null;
    readonly allowEmptySelection?: boolean;
  },
): EditorInventoryState {
  const slotCount = safeInteger(state.inventory.slotCount, DEFAULT_EDITOR_HOTBAR_SLOT_COUNT, 1, 64);
  const requestedSlot = options?.selectedSlotIndex ?? options?.selectedSlot ?? state.inventory.selectedSlotIndex ?? state.inventory.selectedSlot;
  const normalizedRequestedSlot = normalizeSlot(requestedSlot, slotCount);
  const requestedItem = selectedItemForSlot(items, normalizedRequestedSlot);
  const selectedItem = isPlaceableLibraryInventoryItem(requestedItem)
    ? requestedItem
    : options?.allowEmptySelection === true
      ? null
      : selectedItemFallback(items);
  const selectedSlot = selectedItem ? normalizeSlot(selectedItem.slot, slotCount) : normalizedRequestedSlot;
  const selectedRuntimeBlockTypeId = selectedItem?.runtimeBlockTypeId ?? selectedItem?.blockTypeId ?? null;
  const selectedBlockTypeId = selectedRuntimeBlockTypeId;
  const selectedCellValue = selectedItem?.cellValue ?? null;
  const selectedPlacementRef = selectedItem?.placementRef ?? null;
  const placeableItems = items.filter((item) => isPlaceableLibraryInventoryItem(item));
  const hotbarSlots = createEditorHotbarSlotsFromItems(items, slotCount, selectedSlot);
  const updatedAt = nowIsoStringSafe();

  return {
    ...state.inventory,
    status: options?.error ? "degraded" : placeableItems.length > 0 ? "ready" : "degraded",
    source: options?.source ?? state.inventory.source,
    slotCount,
    selectedSlot,
    selectedSlotIndex: selectedSlot,
    selectedItem,
    selectedBlockTypeId,
    selectedRuntimeBlockTypeId,
    selectedCellValue,
    selectedPlacementRef,
    selectedLibraryItemId: selectedItem?.libraryItemId ?? selectedPlacementRef?.libraryItemId ?? null,
    selectedFamilyId: selectedItem?.familyId ?? selectedPlacementRef?.familyId ?? null,
    selectedPackageId: selectedItem?.packageId ?? selectedPlacementRef?.packageId ?? null,
    selectedVplibUid: selectedItem?.vplibUid ?? selectedPlacementRef?.vplibUid ?? null,
    selectedVariantId: selectedItem?.variantId ?? selectedPlacementRef?.variantId ?? null,
    selectedRevisionHash: selectedItem?.revisionHash ?? selectedPlacementRef?.revisionHash ?? null,
    selectedObjectKind: selectedItem?.objectKind ?? selectedPlacementRef?.objectKind ?? null,
    selectedLibraryRef: selectedItem?.libraryRef ?? selectedPlacementRef?.libraryRef ?? null,
    selectedPlacementCommand: selectedItem?.placementCommand ?? selectedPlacementRef?.placementCommand ?? null,
    items,
    hotbarSlots,
    blockTypeIds: uniqueStrings(items.map((item) => item.blockTypeId ?? "")),
    runtimeBlockTypeIds: uniqueStrings(items.map((item) => item.runtimeBlockTypeId ?? item.blockTypeId ?? "")),
    libraryItemIds: uniqueStrings(items.map((item) => item.libraryItemId ?? "")),
    familyIds: uniqueStrings(items.map((item) => item.familyId ?? "")),
    packageIds: uniqueStrings(items.map((item) => item.packageId ?? "")),
    vplibUids: uniqueStrings(items.map((item) => item.vplibUid ?? "")),
    lastLoadedAt: updatedAt,
    lastError: options?.error ?? null,
    usedPaletteFallback: options?.usedPaletteFallback ?? state.inventory.usedPaletteFallback,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
  };
}

export function withInventoryItems(
  state: EditorState,
  items: readonly EditorInventoryItem[],
  options?: {
    readonly selectedSlot?: number;
    readonly selectedSlotIndex?: number;
    readonly source?: EditorInventorySource;
    readonly usedPaletteFallback?: boolean;
    readonly error?: ChunkApiErrorDetails | null;
  },
): EditorState {
  const inventory = deriveInventoryStateFromItems(state, items, options);

  return {
    ...state,
    inventory,
    tools: {
      ...state.tools,
      previewBlockTypeId: inventory.selectedRuntimeBlockTypeId ?? state.tools.previewBlockTypeId,
      updatedAt: nowIsoStringSafe(),
    },
  };
}

export function withInventoryCatalog(
  state: EditorState,
  catalog: InventoryCatalog,
  options?: {
    readonly error?: ChunkApiErrorDetails | null;
  },
): EditorState {
  try {
    const items = createEditorInventoryItemsFromCatalog(catalog);
    const selectedRuntimeBlockTypeId = safeRuntimeBlockTypeId(
      catalog.selection.selectedRuntimeBlockTypeId
        ?? catalog.selection.selectedBlockTypeId
        ?? catalog.selection.selectedPlacementRef?.runtimeBlockTypeId
        ?? catalog.selection.selectedPlacementRef?.blockTypeId,
      null,
    );
    const selectedSlot = normalizeSlot(catalog.selection.selectedSlotIndex ?? catalog.selection.selectedSlot, catalog.slotCount);
    const selectedItem =
      selectedItemByRuntimeBlockTypeId(items, selectedRuntimeBlockTypeId)
      ?? selectedItemForSlot(items, selectedSlot)
      ?? selectedItemFallback(items);

    const inventory = deriveInventoryStateFromItems(state, items, {
      selectedSlot: selectedItem?.slot ?? selectedSlot,
      source: catalog.libraryItems.length > 0 ? "library" : normalizeInventorySource(catalog.sourceKind, "unknown"),
      usedPaletteFallback: catalog.usedPaletteFallback,
      error: options?.error ?? null,
    });

    const patchedInventory: EditorInventoryState = {
      ...inventory,
      status: options?.error
        ? "degraded"
        : catalog.status === "failed"
          ? "failed"
          : inventory.items.filter((item) => isPlaceableLibraryInventoryItem(item)).length > 0
            ? "ready"
            : "degraded",
      selectedItem: isPlaceableLibraryInventoryItem(selectedItem) ? selectedItem : inventory.selectedItem,
      selectedBlockTypeId: selectedItem?.runtimeBlockTypeId ?? selectedItem?.blockTypeId ?? inventory.selectedBlockTypeId,
      selectedRuntimeBlockTypeId: selectedItem?.runtimeBlockTypeId ?? inventory.selectedRuntimeBlockTypeId,
      selectedCellValue: selectedItem?.cellValue ?? inventory.selectedCellValue,
      selectedPlacementRef: selectedItem?.placementRef ?? inventory.selectedPlacementRef,
      selectedLibraryItemId: selectedItem?.libraryItemId ?? inventory.selectedLibraryItemId,
      selectedFamilyId: selectedItem?.familyId ?? inventory.selectedFamilyId,
      selectedPackageId: selectedItem?.packageId ?? inventory.selectedPackageId,
      selectedVplibUid: selectedItem?.vplibUid ?? inventory.selectedVplibUid,
      selectedVariantId: selectedItem?.variantId ?? inventory.selectedVariantId,
      selectedRevisionHash: selectedItem?.revisionHash ?? inventory.selectedRevisionHash,
      selectedObjectKind: selectedItem?.objectKind ?? inventory.selectedObjectKind,
      selectedLibraryRef: selectedItem?.libraryRef ?? inventory.selectedLibraryRef,
      selectedPlacementCommand: selectedItem?.placementCommand ?? inventory.selectedPlacementCommand,
      hotbarSlots: catalog.hotbarSlots.map((slot) => createEditorHotbarSlotFromRuntimeSlot(slot)),
      lastLoadedAt: catalog.loadedAt ?? inventory.lastLoadedAt,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    };

    return {
      ...state,
      inventory: patchedInventory,
      creativeLibrary: catalog.libraryItems.length > 0
        ? {
            ...state.creativeLibrary,
            status: "ready",
            source: "library",
            items: createEditorCreativeLibraryItemsFromCatalog(catalog),
            blockTypeIds: uniqueStrings(catalog.runtimeBlockTypeIds),
            runtimeBlockTypeIds: uniqueStrings(catalog.runtimeBlockTypeIds),
            libraryItemIds: uniqueStrings(catalog.libraryItemIds),
            familyIds: uniqueStrings(catalog.familyIds),
            packageIds: uniqueStrings(catalog.libraryItems.map((item) => item.packageId ?? "")),
            vplibUids: uniqueStrings(catalog.vplibUids),
            categoryIds: uniqueStrings(catalog.libraryItems.map((item) => item.category ?? "")),
            lastLoadedAt: catalog.loadedAt ?? nowIsoStringSafe(),
            lastError: options?.error ?? null,
            totalCount: catalog.libraryItems.length,
          }
        : state.creativeLibrary,
      tools: {
        ...state.tools,
        previewBlockTypeId: patchedInventory.selectedRuntimeBlockTypeId ?? state.tools.previewBlockTypeId,
        updatedAt: nowIsoStringSafe(),
      },
    };
  } catch (error) {
    return withDebugError(state, error);
  }
}

export function withSelectedInventorySlot(
  state: EditorState,
  slot: number,
): EditorState {
  const selectedSlot = normalizeSlot(slot, state.inventory.slotCount);
  const inventory = deriveInventoryStateFromItems(state, state.inventory.items, {
    selectedSlot,
    source: state.inventory.source,
    usedPaletteFallback: state.inventory.usedPaletteFallback,
    error: state.inventory.lastError,
    allowEmptySelection: true,
  });

  return {
    ...state,
    inventory,
    tools: {
      ...state.tools,
      previewBlockTypeId: inventory.selectedRuntimeBlockTypeId,
      updatedAt: nowIsoStringSafe(),
    },
  };
}

export function withCreativeLibraryItems(
  state: EditorState,
  items: readonly EditorCreativeLibraryItem[],
  options?: {
    readonly source?: EditorInventorySource;
    readonly error?: ChunkApiErrorDetails | null;
  },
): EditorState {
  const categoryIds = uniqueStrings(items.map((item) => item.category ?? ""));
  const blockTypeIds = uniqueStrings(items.map((item) => item.blockTypeId ?? ""));
  const runtimeBlockTypeIds = uniqueStrings(items.map((item) => item.runtimeBlockTypeId ?? item.blockTypeId ?? ""));
  const libraryItemIds = uniqueStrings(items.map((item) => item.libraryItemId ?? ""));
  const familyIds = uniqueStrings(items.map((item) => item.familyId ?? ""));
  const packageIds = uniqueStrings(items.map((item) => item.packageId ?? ""));
  const vplibUids = uniqueStrings(items.map((item) => item.vplibUid ?? ""));
  const updatedAt = nowIsoStringSafe();

  return {
    ...state,
    creativeLibrary: {
      ...state.creativeLibrary,
      status: options?.error ? "degraded" : items.length > 0 ? "ready" : "degraded",
      source: options?.source ?? state.creativeLibrary.source,
      items,
      blockTypeIds,
      runtimeBlockTypeIds,
      libraryItemIds,
      familyIds,
      packageIds,
      vplibUids,
      categoryIds,
      lastLoadedAt: updatedAt,
      lastError: options?.error ?? null,
      totalCount: items.length,
    },
  };
}

export function withCreativeLibraryBlocks(
  state: EditorState,
  blocks: readonly (ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition)[],
  options?: {
    readonly source?: EditorInventorySource;
    readonly error?: ChunkApiErrorDetails | null;
  },
): EditorState {
  return withCreativeLibraryItems(
    state,
    createEditorCreativeLibraryItemsFromBlocks(blocks),
    options,
  );
}

export function withCreativeLibraryCatalog(
  state: EditorState,
  catalog: InventoryCatalog,
  options?: {
    readonly error?: ChunkApiErrorDetails | null;
  },
): EditorState {
  return withCreativeLibraryItems(
    state,
    createEditorCreativeLibraryItemsFromCatalog(catalog),
    {
      source: catalog.libraryItems.length > 0 ? "library" : normalizeInventorySource(catalog.sourceKind, "unknown"),
      error: options?.error ?? null,
    },
  );
}

export function withLoadedChunk(
  state: EditorState,
  chunk: ChunkApiRuntimeChunkContent | EditorChunkSummaryInput,
): EditorState {
  const summary = createChunkSummaryFromContent(chunk);
  const existingKeys = new Set(state.world.loadedChunkKeys);
  existingKeys.add(summary.chunkKey);

  const visibleKeys = new Set(state.world.visibleChunkKeys);
  visibleKeys.add(summary.chunkKey);

  const failedKeys = state.world.failedChunkKeys.filter((key) => key !== summary.chunkKey);
  const dirtyKeys = state.world.dirtyChunkKeys.filter((key) => key !== summary.chunkKey);
  const chunksByKey = {
    ...state.world.chunksByKey,
    [summary.chunkKey]: summary,
  };

  return {
    ...state,
    world: {
      ...state.world,
      chunkSize: safeInteger((chunk as { chunkSize?: unknown }).chunkSize, state.world.chunkSize, 1, 512),
      cellSize: safeNumber((chunk as { cellSize?: unknown }).cellSize, state.world.cellSize, 0.000001),
      loadedChunkKeys: [...existingKeys],
      visibleChunkKeys: [...visibleKeys],
      dirtyChunkKeys: dirtyKeys,
      failedChunkKeys: failedKeys,
      chunksByKey,
      lastLoadedChunkKey: summary.chunkKey,
      chunkCount: Object.keys(chunksByKey).length,
      visibleChunkCount: visibleKeys.size,
      dirtyChunkCount: dirtyKeys.length,
    },
  };
}

export function withLoadedChunks(
  state: EditorState,
  chunks: readonly (ChunkApiRuntimeChunkContent | EditorChunkSummaryInput)[],
): EditorState {
  return chunks.reduce((current, chunk) => withLoadedChunk(current, chunk), state);
}

export function withDirtyChunks(
  state: EditorState,
  dirtyChunkKeys: readonly string[],
): EditorState {
  const merged = new Set(state.world.dirtyChunkKeys);

  for (const key of dirtyChunkKeys) {
    if (typeof key === "string" && key.trim().length > 0) {
      merged.add(key.trim());
    }
  }

  const next = [...merged];

  return {
    ...state,
    world: {
      ...state.world,
      dirtyChunkKeys: next,
      dirtyChunkCount: next.length,
    },
    command: {
      ...state.command,
      dirtyChunkKeys: next,
    },
  };
}

export function withoutDirtyChunks(
  state: EditorState,
  reloadedChunkKeys: readonly string[],
): EditorState {
  const reloaded = new Set(uniqueStrings(reloadedChunkKeys));
  const next = state.world.dirtyChunkKeys.filter((key) => !reloaded.has(key));

  return {
    ...state,
    world: {
      ...state.world,
      dirtyChunkKeys: next,
      dirtyChunkCount: next.length,
      lastDirtyReloadAt: nowIsoStringSafe(),
    },
    command: {
      ...state.command,
      dirtyChunkKeys: next,
    },
  };
}

export function withFailedChunkKeys(
  state: EditorState,
  failedChunkKeys: readonly string[],
): EditorState {
  const merged = new Set(state.world.failedChunkKeys);

  for (const key of failedChunkKeys) {
    if (typeof key === "string" && key.trim().length > 0) {
      merged.add(key.trim());
    }
  }

  return {
    ...state,
    world: {
      ...state.world,
      failedChunkKeys: [...merged],
    },
  };
}

export function withCommandPending(
  state: EditorState,
  command: ChunkApiCommandPayload,
): EditorState {
  return {
    ...state,
    command: {
      ...state.command,
      status: "pending",
      pendingCommand: command,
      lastCommand: command,
      lastError: null,
      submittedAt: nowIsoStringSafe(),
      completedAt: null,
    },
  };
}

export function withCommandResult(
  state: EditorState,
  result: ChunkApiCommandResult,
): EditorState {
  const completedAt = nowIsoStringSafe();
  const dirtyState = withDirtyChunks(state, result.dirtyChunks);
  const status = normalizeCommandStatus(
    result.commandStatus === "unknown" ? "idle" : result.commandStatus,
  );

  return {
    ...dirtyState,
    command: {
      ...dirtyState.command,
      status,
      pendingCommand: null,
      lastCommand: state.command.lastCommand,
      lastResult: result,
      lastError: null,
      dirtyChunkKeys: result.dirtyChunks,
      changedChunkKeys: result.changedChunks,
      eventIds: result.eventIds,
      snapshotIds: result.snapshotIds,
      submittedAt: state.command.submittedAt,
      completedAt,
    },
    world: {
      ...dirtyState.world,
      dirtyChunkKeys: result.dirtyChunks,
      dirtyChunkCount: result.dirtyChunks.length,
    },
  };
}

export function withCommandError(
  state: EditorState,
  error: ChunkApiErrorDetails,
): EditorState {
  return {
    ...state,
    command: {
      ...state.command,
      status: "failed",
      pendingCommand: null,
      lastError: error,
      completedAt: nowIsoStringSafe(),
    },
    debug: {
      ...state.debug,
      errors: [
        error,
        ...state.debug.errors,
      ].slice(0, 25),
    },
  };
}

export function withTargetingState(
  state: EditorState,
  input: Partial<EditorTargetState>,
): EditorState {
  return {
    ...state,
    targeting: {
      ...state.targeting,
      kind: normalizeTargetKind(input.kind, state.targeting.kind),
      status: normalizeTargetStatus(input.status, state.targeting.status),
      reason: input.reason ?? state.targeting.reason,
      distance: input.distance ?? state.targeting.distance,
      chunkKey: input.chunkKey ?? state.targeting.chunkKey,
      sourceCell: input.sourceCell === undefined ? state.targeting.sourceCell : normalizeCellPosition(input.sourceCell),
      placementCell: input.placementCell === undefined ? state.targeting.placementCell : normalizeCellPosition(input.placementCell),
      normal: input.normal === undefined ? state.targeting.normal : input.normal,
      updatedAt: input.updatedAt ?? nowIsoStringSafe(),
    },
  };
}

export function withClearedTargetingState(
  state: EditorState,
  reason?: string,
): EditorState {
  return {
    ...state,
    targeting: {
      kind: "none",
      status: "none",
      reason: reason ?? null,
      distance: null,
      chunkKey: null,
      sourceCell: null,
      placementCell: null,
      normal: null,
      updatedAt: nowIsoStringSafe(),
    },
    tools: {
      ...state.tools,
      previewVisible: false,
      updatedAt: nowIsoStringSafe(),
    },
  };
}

export function withInputPointerButton(
  state: EditorState,
  button: EditorPointerButton,
  pressed: boolean,
): EditorState {
  const normalizedButton = normalizePointerButton(button);
  const pressedButtons = new Set(state.input.pressedButtons);

  if (pressed) {
    pressedButtons.add(normalizedButton);
  } else {
    pressedButtons.delete(normalizedButton);
  }

  return {
    ...state,
    input: {
      ...state.input,
      pressedButtons: [...pressedButtons],
      lastPointerButton: normalizedButton,
      lastPointerDownAt: pressed ? nowIsoStringSafe() : state.input.lastPointerDownAt,
      lastPointerUpAt: pressed ? state.input.lastPointerUpAt : nowIsoStringSafe(),
    },
  };
}

export function withInputKey(
  state: EditorState,
  key: string,
  pressed: boolean,
): EditorState {
  const normalizedKey = safeString(key, "").toLowerCase();

  if (normalizedKey.length === 0) {
    return state;
  }

  const keys = new Set(state.input.pressedKeys);

  if (pressed) {
    keys.add(normalizedKey);
  } else {
    keys.delete(normalizedKey);
  }

  return {
    ...state,
    input: {
      ...state.input,
      pressedKeys: [...keys],
    },
  };
}

export function withPlayerState(
  state: EditorState,
  input: PlayerStateUpdateInput,
): EditorState {
  try {
    const player = updateEditorPlayerStateFromPhysics(state.player, {
      ...input,
      source: input.source ?? "physics-runtime",
      nowMs: input.nowMs ?? Date.now(),
    });

    return {
      ...state,
      player,
      camera: {
        ...state.camera,
        position: cameraPositionFromPlayer(player),
        rotation: cameraRotationFromPlayer(player, state.camera.rotation),
        isSprinting: state.input.pressedKeys.includes("shift"),
        updatedAt: nowIsoStringSafe(),
      },
      debug: {
        ...state.debug,
        player: createPlayerDebugState(player, {
          enabled: state.debug.enabled,
        }),
      },
    };
  } catch (error) {
    return withDebugError(state, error);
  }
}

export function withPlayerStatePatch(
  state: EditorState,
  patch: EditorPlayerStatePatch,
): EditorState {
  try {
    const player = patchEditorPlayerState(state.player, {
      ...patch,
      source: patch.source ?? "store-patch",
      lastUpdatedAtMs: patch.lastUpdatedAtMs ?? Date.now(),
    });

    return {
      ...state,
      player,
      camera: {
        ...state.camera,
        position: cameraPositionFromPlayer(player),
        rotation: cameraRotationFromPlayer(player, state.camera.rotation),
        isSprinting: state.input.pressedKeys.includes("shift"),
        updatedAt: nowIsoStringSafe(),
      },
      debug: {
        ...state.debug,
        player: createPlayerDebugState(player, {
          enabled: state.debug.enabled,
        }),
      },
    };
  } catch (error) {
    return withDebugError(state, error);
  }
}

export function withResetPlayerState(
  state: EditorState,
  input?: PlayerStateBootstrapInput | null,
): EditorState {
  try {
    const player = resetEditorPlayerState(state.player, {
      ...input,
      source: input?.source ?? "reset",
      nowMs: input?.nowMs ?? Date.now(),
    });

    return {
      ...state,
      player,
      camera: {
        ...state.camera,
        position: cameraPositionFromPlayer(player),
        rotation: cameraRotationFromPlayer(player, state.camera.rotation),
        isSprinting: false,
        updatedAt: nowIsoStringSafe(),
      },
      debug: {
        ...state.debug,
        player: createPlayerDebugState(player, {
          enabled: state.debug.enabled,
        }),
      },
    };
  } catch (error) {
    return withDebugError(state, error);
  }
}

export function withPlayerDebugState(
  state: EditorState,
  options?: {
    readonly enabled?: boolean;
  },
): EditorState {
  try {
    return {
      ...state,
      debug: {
        ...state.debug,
        player: createPlayerDebugState(state.player, {
          enabled: options?.enabled ?? state.debug.enabled,
        }),
      },
    };
  } catch (error) {
    return withDebugError(state, error);
  }
}

export function withUiLoading(
  state: EditorState,
  loading: boolean,
  message?: string | null,
): EditorState {
  return {
    ...state,
    ui: {
      ...state.ui,
      loading,
      loadingMessage: loading ? message ?? state.ui.loadingMessage : null,
    },
  };
}

export function withUiError(
  state: EditorState,
  title: string,
  message: string,
  error?: unknown,
): EditorState {
  const details = error ? normalizeEditorStateError(error, "editor_ui_error") : null;

  return {
    ...state,
    ui: {
      ...state.ui,
      loading: false,
      errorVisible: true,
      errorTitle: title,
      errorMessage: message,
      liveMessage: `${title}: ${message}`,
    },
    debug: details
      ? {
          ...state.debug,
          errors: [details, ...state.debug.errors].slice(0, 25),
        }
      : state.debug,
  };
}

export function withDebugWarning(
  state: EditorState,
  warning: string,
): EditorState {
  const normalized = safeString(warning, "");

  if (normalized.length === 0) {
    return state;
  }

  return {
    ...state,
    debug: {
      ...state.debug,
      warnings: [normalized, ...state.debug.warnings].slice(0, 50),
    },
  };
}

export function withDebugError(
  state: EditorState,
  error: unknown,
): EditorState {
  const details = normalizeEditorStateError(error, "editor_debug_error");

  return {
    ...state,
    debug: {
      ...state.debug,
      errors: [details, ...state.debug.errors].slice(0, 25),
    },
  };
}

export function getEditorStateMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.state.editor_state",
    schemaVersion: EDITOR_STATE_SCHEMA_VERSION,
    defaultHotbarSlotCount: DEFAULT_EDITOR_HOTBAR_SLOT_COUNT,
    supportsLibraryInventory: true,
    supportsLegacyBlockInventory: true,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      inventorySourceDefault: "library",
      runtimeBlockTypeIdIsTemporaryAdapter: true,
      legacyChunkBlocksAreDiagnosticOnly: true,
      emptyFallbackSlotsAreNotPlaceable: true,
    },
  };
}