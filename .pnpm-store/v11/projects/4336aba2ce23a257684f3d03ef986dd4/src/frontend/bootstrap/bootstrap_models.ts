// services/vectoplan-editor/src/frontend/bootstrap/bootstrap_models.ts

export type EditorJsonPrimitive = string | number | boolean | null;

export type EditorJsonValue =
  | EditorJsonPrimitive
  | EditorJsonObject
  | EditorJsonArray;

export interface EditorJsonObject {
  readonly [key: string]: EditorJsonValue;
}

export type EditorJsonArray = readonly EditorJsonValue[];

export type UnknownRecord = Record<string, unknown>;

export type EditorBuildMode =
  | "development"
  | "production"
  | "test";

export type EditorTemplateMode =
  | "vite-index"
  | "flask-template"
  | "single_viewport"
  | "fullscreen_viewport"
  | "unknown";

export type EditorRuntimeMode =
  | "remote_chunk_service"
  | "chunk_service";

export type EditorWorldMode =
  | "chunk_service";

export type EditorWorldSourceMode =
  | "chunk-service";

export type EditorChunkServiceMode =
  | "editor-proxy";

export type EditorChunkServiceSourceKind =
  | "vectoplan-chunk";

export type EditorChunkServiceConnectionState =
  | "unknown"
  | "disabled"
  | "connecting"
  | "ready"
  | "degraded"
  | "failed";

export type EditorChunkIdentityStatus =
  | "ready"
  | "pending"
  | "error"
  | "disabled"
  | "invalid"
  | string;

export type EditorChunkCellIndexOrder =
  | "x-fastest-y-then-z";

export type EditorChunkCoordinateSystem =
  | "vectoplan-world-y-up-v1"
  | "unknown";

export type EditorChunkProjectionType =
  | "flat-local-v1"
  | "unknown";

export type EditorChunkTopologyType =
  | "flat-unbounded-v1"
  | "unknown";

export type EditorChunkCellEncodingVersion =
  | "cell-encoding.palette-index-plus-one.v1";

export type EditorInventorySourceKind =
  | "library"
  | "vectoplan-library"
  | "vectoplan-user-inventory"
  | "editor-inventory"
  | "vplib"
  | "library-service"
  | "creative-library"
  | "chunk-service"
  | "editor-placeholder"
  | "chunk-palette"
  | "static-fallback"
  | "runtime-generated"
  | "empty-fallback"
  | "fallback"
  | "error"
  | "unknown";

export type EditorInventoryItemKind =
  | "vplib"
  | "library-item"
  | "block"
  | "asset"
  | "empty";

export type EditorInventoryRouteKind =
  | "editor-inventory"
  | "library-inventory"
  | "creative-library"
  | "blocks"
  | "placeable-blocks"
  | "none";

export type EditorPhysicsMode =
  | "local-player-physics-v1";

export type EditorPhysicsColliderKind =
  | "aabb";

export type EditorPhysicsMissingChunkPolicy =
  | "block"
  | "allow"
  | "request_chunk"
  | "treat_as_air"
  | "treat_as_solid";

export interface EditorAppBootstrap {
  readonly name: "vectoplan-editor";
  readonly mode: EditorBuildMode | string;
  readonly buildMode: EditorBuildMode | string;
  readonly buildVersion: string;
  readonly templateMode: EditorTemplateMode | string;
  readonly runtimeMode: EditorRuntimeMode | string;
  readonly serviceVersion: string;
  readonly frontendRoot: "services/vectoplan-editor/src/frontend";
  readonly createdAt: string;
}

export interface EditorProjectBootstrap {
  /**
   * Runtime project id. In the new editor this is the chunk project id.
   * It must not be an app project public id.
   */
  readonly projectId: string;

  readonly worldId: string;
  readonly universeId: string | null;
  readonly templateId: string | null;
  readonly providerId: string | null;
  readonly providerWorldId: string | null;

  /**
   * Optional compatibility/diagnostic aliases.
   */
  readonly runtimeProjectId?: string;
  readonly chunkProjectId?: string;
  readonly chunkUniverseId?: string | null;
  readonly chunkWorldId?: string;
  readonly appProjectPublicId?: string | null;
  readonly projectPublicId?: string | null;
}

export interface EditorChunkServiceRouteHints {
  readonly status: string;
  readonly connectionTest: string;

  readonly projects: string;
  readonly project: string;
  readonly projectBootstrap: string;

  readonly worlds: string;
  readonly world: string;

  /**
   * Legacy/diagnostic chunk block catalog endpoint.
   *
   * Productive Editor inventory must not be derived from this route.
   */
  readonly blocks: string;

  /**
   * Legacy/diagnostic chunk placeable-block endpoint.
   *
   * Productive Editor inventory must use /editor/api/inventory.
   */
  readonly placeableBlocks: string;

  /**
   * Productive Browser inventory endpoint.
   *
   * The browser calls this Editor route, not vectoplan-library directly.
   */
  readonly editorInventory: string;
  readonly editorInventoryHealth: string;
  readonly editorInventoryMetadata: string;

  /**
   * Server-side creative/library proxy endpoint.
   *
   * Browser callers should still prefer /editor/api/inventory for the hotbar.
   */
  readonly creativeLibrary: string;
  readonly creativeLibraryHealth: string;
  readonly creativeLibraryMetadata: string;

  readonly chunk: string;
  readonly chunksBatch: string;
  readonly commands: string;

  /**
   * Optional old alias. Kept only to avoid breaking callers that still inspect it.
   */
  readonly chunks?: string;
}

export interface EditorChunkServiceTimeouts {
  readonly statusMs: number;
  readonly requestMs: number;
  readonly blocksMs: number;
  readonly inventoryMs: number;
  readonly libraryMs: number;
  readonly chunkMs: number;
  readonly batchMs: number;
  readonly commandMs: number;
}

export interface EditorChunkIdentityDiagnostics {
  readonly kind: "vectoplan-editor-chunk-identity-contract.v1" | string;
  readonly status: "valid" | "degraded" | "invalid" | string;
  readonly projectId: string | null;
  readonly chunkProjectId: string | null;
  readonly appProjectPublicId: string | null;
  readonly projectPublicId: string | null;
  readonly universeId: string | null;
  readonly chunkUniverseId: string | null;
  readonly worldId: string | null;
  readonly chunkWorldId: string | null;
  readonly chunkReady: boolean;
  readonly ready: boolean;
  readonly chunkStatus: EditorChunkIdentityStatus;
  readonly valid: boolean;
  readonly degraded: boolean;
  readonly issues?: readonly unknown[];
  readonly rejectedCandidates?: readonly unknown[];
  readonly [key: string]: unknown;
}

export interface EditorChunkProxyDiagnostics {
  readonly apiBaseUrl?: unknown;
  readonly browserBaseUrl?: unknown;
  readonly [key: string]: unknown;
}

export interface EditorChunkServiceConfig {
  readonly enabled: true;
  readonly mode: EditorChunkServiceMode;
  readonly sourceKind: EditorChunkServiceSourceKind;
  readonly connectionState: EditorChunkServiceConnectionState;

  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;

  /**
   * Runtime project id for chunk routes.
   * This should be the same as chunkProjectId.
   */
  readonly projectId: string;

  /**
   * Runtime concrete world id for chunk routes.
   * This should be the same as chunkWorldId.
   */
  readonly worldId: string;

  /**
   * Explicit chunk identity fields.
   */
  readonly chunkProjectId?: string;
  readonly chunkUniverseId?: string | null;
  readonly chunkWorldId?: string;
  readonly universeId?: string | null;

  /**
   * App shell identity fields. These are context/diagnostics only.
   * They must never be used to build chunk-service /projects/<id> routes.
   */
  readonly appProjectPublicId?: string | null;
  readonly projectPublicId?: string | null;

  readonly chunkReady?: boolean;
  readonly ready?: boolean;
  readonly chunkStatus?: EditorChunkIdentityStatus;
  readonly status?: EditorChunkIdentityStatus;

  readonly identityValid?: boolean;
  readonly identityDegraded?: boolean;
  readonly valid?: boolean;
  readonly degraded?: boolean;
  readonly identityWarnings?: readonly string[];
  readonly chunkIdentityWarnings?: readonly string[];
  readonly identityDiagnostics?: EditorChunkIdentityDiagnostics | UnknownRecord | null;
  readonly contractIdentity?: EditorChunkIdentityDiagnostics | UnknownRecord | null;
  readonly proxyDiagnostics?: EditorChunkProxyDiagnostics | UnknownRecord | null;

  readonly preferBatchLoad: boolean;
  readonly reloadDirtyChunksAfterCommand: boolean;
  readonly maxBatchChunks: number;

  readonly maxLoadedChunks: number;
  readonly routeHints: EditorChunkServiceRouteHints;
  readonly timeouts: EditorChunkServiceTimeouts;
}

export interface EditorPhysicsTimingBootstrap {
  readonly fixedTimeStepSeconds: number;
  readonly maxFrameDeltaSeconds: number;
  readonly maxSubSteps: number;
}

export interface EditorPhysicsMovementBootstrap {
  readonly walkSpeed: number;
  readonly sprintSpeed: number;
  readonly airControlSpeed: number;
  readonly flySpeed: number;
  readonly flySprintSpeed: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
  readonly maxFallSpeed: number;
  readonly groundSnapDistance: number;
}

export interface EditorPhysicsInputBootstrap {
  readonly doubleTapWindowMs: number;
  readonly allowJumpBeforeFlightToggle: boolean;
}

export interface EditorPhysicsColliderBootstrap {
  readonly kind: EditorPhysicsColliderKind;
  readonly width: number;
  readonly height: number;
  readonly eyeHeight: number;
  readonly skinWidth: number;
}

export interface EditorPhysicsMissingChunkBootstrap {
  readonly policy: EditorPhysicsMissingChunkPolicy;
  readonly blockHorizontalMovement: boolean;
  readonly blockVerticalMovement: boolean;
}

export interface EditorPhysicsDebugBootstrap {
  readonly enabled: boolean;
  readonly exposeToStore: boolean;
  readonly includeCollisionCells: boolean;
}

export interface EditorPhysicsBootstrap {
  readonly enabled: boolean;
  readonly mode: EditorPhysicsMode;
  readonly timing: EditorPhysicsTimingBootstrap;
  readonly movement: EditorPhysicsMovementBootstrap;
  readonly input: EditorPhysicsInputBootstrap;
  readonly collider: EditorPhysicsColliderBootstrap;
  readonly missingChunks: EditorPhysicsMissingChunkBootstrap;
  readonly debug: EditorPhysicsDebugBootstrap;
}

export interface EditorRuntimeInventoryConfig {
  readonly enabled: boolean;
  readonly source: EditorInventorySourceKind;
  readonly kind: EditorInventoryItemKind;
  readonly apiUrl: string;
  readonly inventoryUrl: string;
  readonly route: string;
  readonly healthUrl: string;
  readonly metadataUrl: string;
  readonly hotbarSize: number;
  readonly slotCount: number;
  readonly selectedSlot: number;
  readonly defaultSelectedSlot: number;
  readonly forceRefreshOnBoot: boolean;
  readonly includeEmptySlots: boolean;
  readonly allowEmptyFallback: boolean;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;
  readonly allowChunkPlaceableFallback: false;
  readonly requestTimeoutMs: number;
  readonly cacheTtlMs: number;
  readonly staleCacheTtlMs: number;
}

export interface EditorRuntimeLibraryConfig {
  readonly enabled: boolean;
  readonly source: "vectoplan-library";
  readonly apiUrl: string;
  readonly browserApiUrl: string;
  readonly inventoryRoute: string;
  readonly creativeLibraryRoute: string;
  readonly healthRoute: string;
  readonly metadataRoute: string;
  readonly browserCallsLibraryDirectly: false;
}

export interface EditorRuntimeConfig {
  readonly mode: EditorRuntimeMode;
  readonly worldMode: EditorWorldMode;
  readonly sourceMode: EditorWorldSourceMode;

  readonly localWorldFallbackEnabled: false;
  readonly legacyFrontendEnabled: false;

  readonly chunk: EditorChunkServiceConfig;
  readonly physics: EditorPhysicsBootstrap;
  readonly inventory: EditorRuntimeInventoryConfig;
  readonly library: EditorRuntimeLibraryConfig;
}

export interface EditorFeatureFlags {
  readonly chunkServiceEnabled: true;
  readonly localWorldFallbackEnabled: false;
  readonly legacyFrontendEnabled: false;

  /**
   * Legacy chunk inventory switches.
   *
   * These are kept for diagnostics/backwards compatibility and must remain
   * disabled for the productive Library/VPLIB hotbar path.
   */
  readonly chunkServiceInventoryEnabled: boolean;
  readonly chunkPaletteInventoryFallbackEnabled: boolean;
  readonly placeableBlocksPlaceholderRouteEnabled: boolean;
  readonly legacyChunkInventoryEnabled: boolean;

  /**
   * Productive Library/VPLIB inventory switches.
   */
  readonly editorInventoryApiEnabled: boolean;
  readonly libraryInventoryEnabled: boolean;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;

  readonly remoteCommandsEnabled: boolean;
  readonly dirtyChunkReloadEnabled: boolean;

  readonly pointerLockEnabled: boolean;
  readonly firstPersonEnabled: boolean;
  readonly physicsEnabled: boolean;
  readonly playerCollisionEnabled: boolean;
  readonly flightModeEnabled: boolean;
  readonly crosshairEnabled: boolean;
  readonly hotbarEnabled: boolean;
  readonly statusBarEnabled: boolean;
  readonly loadingOverlayEnabled: boolean;
  readonly errorPanelEnabled: boolean;
  readonly debugOverlayEnabled: boolean;

  /**
   * Creative/library browser support.
   *
   * The active hotbar still uses inventory.editorInventoryApiUrl.
   */
  readonly creativeLibraryEnabled: boolean;
}

export interface EditorUiBootstrap {
  readonly language: "de" | "en";
  readonly title: string;
  readonly subtitle: string;
  readonly showLeftPanel: boolean;
  readonly showRightPanel: boolean;
  readonly showDebugOverlay: boolean;
  readonly showHotbar: boolean;
  readonly showCrosshair: boolean;
  readonly showStatusBar: boolean;
  readonly showLoadingOverlay: boolean;
}

export interface EditorInputBootstrap {
  readonly pointerLockEnabled: boolean;
  readonly keyboardEnabled: boolean;
  readonly mouseEnabled: boolean;
  readonly wheelEnabled: boolean;
  readonly invertY: boolean;
  readonly sensitivity: number;
}

export interface EditorCameraBootstrap {
  readonly mode: "first-person";
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly spawn: EditorVector3;
  readonly rotation: EditorEuler3;
  readonly moveSpeed: number;
  readonly sprintMultiplier: number;

  /**
   * The camera can still track look state, but physical movement belongs to
   * PlayerPhysicsRuntime when runtime.physics.enabled is true.
   */
  readonly directMovementEnabled: boolean;
  readonly physicsFollowEnabled: boolean;
}

export interface EditorRenderBootstrap {
  readonly antialias: boolean;
  readonly alpha: boolean;
  readonly pixelRatioMax: number;
  readonly clearColor: string;
  readonly chunkWireframe: boolean;
  readonly showPreview: boolean;
  readonly showTargetHighlight: boolean;
  readonly visibleChunkRadius: number;
  readonly maxChunksPerRenderSync: number;
}

export interface EditorInventoryBootstrap {
  readonly enabled: boolean;
  readonly source: EditorInventorySourceKind;
  readonly kind: EditorInventoryItemKind;

  readonly apiUrl: string;
  readonly inventoryUrl: string;
  readonly route: string;
  readonly healthUrl: string;
  readonly metadataUrl: string;

  readonly defaultBlockTypeId: string | null;
  readonly defaultRuntimeBlockTypeId: string | null;
  readonly fallbackBlockTypeIds: readonly string[];

  readonly slotCount: number;
  readonly hotbarSize: number;
  readonly selectedSlot: number;
  readonly defaultSelectedSlot: number;

  readonly includeEmptySlots: boolean;
  readonly forceRefreshOnBoot: boolean;
  readonly allowEmptyFallback: boolean;

  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;
  readonly allowChunkPlaceableFallback: false;

  readonly requestTimeoutMs: number;
  readonly cacheTtlMs: number;
  readonly staleCacheTtlMs: number;

  /**
   * Current active inventory/hotbar source.
   * This maps to /editor/api/inventory.
   */
  readonly inventoryRouteKind: "editor-inventory" | "library-inventory";

  /**
   * Creative Library source.
   * This maps to the server-side library/creative-library proxy, not directly
   * to vectoplan-library from the browser.
   */
  readonly creativeLibraryRouteKind: "creative-library" | "blocks";

  /**
   * Legacy route kind kept for diagnostics only.
   */
  readonly legacyChunkInventoryRouteKind: "placeable-blocks";
}

export interface EditorCreativeLibraryBootstrap {
  readonly enabled: boolean;
  readonly source: EditorInventorySourceKind;
  readonly routeKind: "creative-library" | "blocks";
  readonly apiUrl: string;
  readonly route: string;
  readonly healthUrl: string;
  readonly metadataUrl: string;
  readonly browserCallsLibraryDirectly: false;
}

export interface EditorVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EditorEuler3 {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
}

export interface EditorBootstrapDiagnostics {
  readonly source: "window" | "dataset" | "fallback" | "merged";
  readonly warnings: readonly string[];
  readonly normalizedAt: string;
  readonly rawAvailable: boolean;
}

export interface EditorBootstrap {
  readonly schemaVersion: "vectoplan-editor-bootstrap.v1";

  readonly app: EditorAppBootstrap;
  readonly project: EditorProjectBootstrap;
  readonly runtime: EditorRuntimeConfig;
  readonly featureFlags: EditorFeatureFlags;
  readonly ui: EditorUiBootstrap;
  readonly input: EditorInputBootstrap;
  readonly camera: EditorCameraBootstrap;
  readonly render: EditorRenderBootstrap;
  readonly inventory: EditorInventoryBootstrap;
  readonly creativeLibrary: EditorCreativeLibraryBootstrap;

  /**
   * Convenience mirror for old/experimental consumers that read
   * bootstrap.physics directly. runtime.physics remains canonical.
   */
  readonly physics: EditorPhysicsBootstrap;

  readonly diagnostics: EditorBootstrapDiagnostics;

  readonly raw: unknown;
}

export interface EditorBootstrapDefaults {
  readonly buildMode: string;
  readonly buildVersion: string;
  readonly chunkProxyBaseUrl: string;

  /**
   * Runtime chunk project id default. Should be chk_prj_... in project context.
   * dev-project is allowed for standalone/dev fallback only.
   */
  readonly projectId: string;

  readonly worldId: string;
  readonly localWorldFallbackEnabled: boolean;

  /**
   * Optional app context. Never used as chunk project id.
   */
  readonly appProjectPublicId?: string | null;
  readonly projectPublicId?: string | null;
}

export interface EditorBootstrapReadOptions {
  readonly rootElement: HTMLElement;
  readonly defaults: EditorBootstrapDefaults;
  readonly logger?: EditorBootstrapLogger;
}

export interface EditorBootstrapNormalizeOptions extends EditorBootstrapDefaults {
  readonly logger?: EditorBootstrapLogger;
}

export interface EditorBootstrapLogger {
  readonly debug?: (message: string, details?: Record<string, unknown>) => void;
  readonly info?: (message: string, details?: Record<string, unknown>) => void;
  readonly warn?: (message: string, details?: Record<string, unknown>) => void;
  readonly error?: (message: string, details?: Record<string, unknown>) => void;
}

export interface EditorWindowChunkGlobals {
  readonly apiBaseUrl?: unknown;
  readonly browserBaseUrl?: unknown;

  /**
   * projectId is allowed only when it already is a chunk project id.
   */
  readonly projectId?: unknown;
  readonly chunkProjectId?: unknown;
  readonly chunkServiceProjectId?: unknown;

  readonly appProjectPublicId?: unknown;
  readonly projectPublicId?: unknown;
  readonly rejectedProjectId?: unknown;

  readonly universeId?: unknown;
  readonly chunkUniverseId?: unknown;
  readonly chunkServiceUniverseId?: unknown;

  readonly worldId?: unknown;
  readonly chunkWorldId?: unknown;
  readonly chunkServiceWorldId?: unknown;

  readonly ready?: unknown;
  readonly chunkReady?: unknown;
  readonly status?: unknown;
  readonly chunkStatus?: unknown;

  readonly routeHints?: unknown;
  readonly serviceConfig?: unknown;
}

export interface EditorWindowInventoryGlobals {
  readonly enabled?: unknown;
  readonly source?: unknown;
  readonly kind?: unknown;
  readonly apiUrl?: unknown;
  readonly inventoryUrl?: unknown;
  readonly route?: unknown;
  readonly healthUrl?: unknown;
  readonly metadataUrl?: unknown;
  readonly hotbarSize?: unknown;
  readonly slotCount?: unknown;
  readonly selectedSlot?: unknown;
  readonly defaultSelectedSlot?: unknown;
  readonly forceRefreshOnBoot?: unknown;
  readonly includeEmptySlots?: unknown;
  readonly allowEmptyFallback?: unknown;
  readonly onlyLibraryItemsPlaceable?: unknown;
  readonly debugGrassDirtAllowed?: unknown;
  readonly allowChunkPlaceableFallback?: unknown;
}

export interface EditorWindowLibraryGlobals {
  readonly enabled?: unknown;
  readonly apiUrl?: unknown;
  readonly browserApiUrl?: unknown;
  readonly inventoryRoute?: unknown;
  readonly creativeLibraryRoute?: unknown;
  readonly healthRoute?: unknown;
  readonly metadataRoute?: unknown;
}

export interface EditorWindowPhysicsGlobals {
  readonly enabled?: unknown;
  readonly mode?: unknown;
  readonly timing?: unknown;
  readonly movement?: unknown;
  readonly input?: unknown;
  readonly collider?: unknown;
  readonly missingChunks?: unknown;
  readonly debug?: unknown;
}

export interface EditorDatasetChunkGlobals {
  readonly enabled?: string;
  readonly mode?: string;
  readonly sourceKind?: string;
  readonly apiBaseUrl?: string;
  readonly browserBaseUrl?: string;

  /**
   * Runtime projectId is only populated when it is a valid chunk project id.
   */
  readonly projectId?: string;
  readonly chunkProjectId?: string;
  readonly chunkServiceProjectId?: string;

  readonly appProjectPublicId?: string;
  readonly projectPublicId?: string;
  readonly rejectedProjectId?: string;

  readonly universeId?: string;
  readonly chunkUniverseId?: string;
  readonly chunkServiceUniverseId?: string;

  readonly worldId?: string;
  readonly chunkWorldId?: string;
  readonly chunkServiceWorldId?: string;

  readonly ready?: string;
  readonly chunkReady?: string;
  readonly status?: string;
  readonly chunkStatus?: string;

  readonly preferBatchLoad?: string;
  readonly reloadDirtyChunksAfterCommand?: string;
  readonly maxBatchChunks?: string;
  readonly visibleChunkRadius?: string;
  readonly viewDistance?: string;
  readonly preloadRadius?: string;
  readonly unloadDistance?: string;
  readonly maxLoadedChunks?: string;
  readonly routeHintsJson?: string;
  readonly serviceConfigJson?: string;
  readonly cameraDirectMovementEnabled?: string;
  readonly cameraPhysicsFollowEnabled?: string;
}

export interface EditorDatasetInventoryGlobals {
  readonly inventoryEnabled?: string;
  readonly inventorySource?: string;
  readonly inventoryKind?: string;
  readonly inventoryApiUrl?: string;
  readonly inventoryUrl?: string;
  readonly inventoryRoute?: string;
  readonly inventoryHealthUrl?: string;
  readonly inventoryMetadataUrl?: string;
  readonly inventoryHotbarSize?: string;
  readonly inventorySlotCount?: string;
  readonly inventorySelectedSlot?: string;
  readonly inventoryDefaultSelectedSlot?: string;
  readonly inventoryForceRefreshOnBoot?: string;
  readonly inventoryIncludeEmptySlots?: string;
  readonly inventoryAllowEmptyFallback?: string;
  readonly inventoryOnlyLibraryItemsPlaceable?: string;
  readonly inventoryDebugGrassDirtAllowed?: string;
  readonly inventoryAllowChunkPlaceableFallback?: string;

  readonly libraryApiUrl?: string;
  readonly libraryBrowserApiUrl?: string;
  readonly libraryInventoryRoute?: string;
  readonly libraryHealthUrl?: string;
  readonly libraryMetadataUrl?: string;

  readonly creativeLibraryApiUrl?: string;
  readonly creativeLibraryBrowserApiUrl?: string;
  readonly creativeLibraryRoute?: string;
  readonly creativeLibraryHealthUrl?: string;
  readonly creativeLibraryMetadataUrl?: string;

  readonly inventoryConfigJson?: string;
}

export interface EditorDatasetPhysicsGlobals {
  readonly physicsEnabled?: string;
  readonly physicsMode?: string;
  readonly physicsFixedTimeStepSeconds?: string;
  readonly physicsMaxFrameDeltaSeconds?: string;
  readonly physicsMaxSubSteps?: string;
  readonly physicsWalkSpeed?: string;
  readonly physicsSprintSpeed?: string;
  readonly physicsAirControlSpeed?: string;
  readonly physicsFlySpeed?: string;
  readonly physicsFlySprintSpeed?: string;
  readonly physicsJumpVelocity?: string;
  readonly physicsGravity?: string;
  readonly physicsMaxFallSpeed?: string;
  readonly physicsGroundSnapDistance?: string;
  readonly physicsDoubleTapWindowMs?: string;
  readonly physicsAllowJumpBeforeFlightToggle?: string;
  readonly physicsPlayerWidth?: string;
  readonly physicsPlayerHeight?: string;
  readonly physicsPlayerEyeHeight?: string;
  readonly physicsPlayerSkinWidth?: string;
  readonly physicsMissingChunkPolicy?: string;
  readonly physicsBlockHorizontalMovementOnMissingChunk?: string;
  readonly physicsBlockVerticalMovementOnMissingChunk?: string;
  readonly physicsDebugEnabled?: string;
  readonly physicsDebugExposeToStore?: string;
  readonly physicsDebugIncludeCollisionCells?: string;
  readonly physicsConfigJson?: string;
}

export interface EditorRawBootstrapSources {
  readonly windowBootstrap: unknown;
  readonly windowChunkGlobals: EditorWindowChunkGlobals;
  readonly windowInventoryGlobals?: EditorWindowInventoryGlobals;
  readonly windowLibraryGlobals?: EditorWindowLibraryGlobals;
  readonly windowPhysicsGlobals?: EditorWindowPhysicsGlobals;
  readonly datasetChunkGlobals: EditorDatasetChunkGlobals;
  readonly datasetInventoryGlobals?: EditorDatasetInventoryGlobals;
  readonly datasetPhysicsGlobals?: EditorDatasetPhysicsGlobals;
  readonly datasetRaw: DOMStringMap;
  readonly fallback: unknown;
}

export interface EditorChunkCellEncoding {
  readonly version: EditorChunkCellEncodingVersion;
  readonly airCellValue: 0;
  readonly blockCellValueRule: "paletteIndex + 1";
}

export interface EditorChunkWorldMetadata {
  readonly chunkSize: number;
  readonly cellSize: number;
  readonly coordinateSystem: EditorChunkCoordinateSystem;
  readonly projectionType: EditorChunkProjectionType;
  readonly topologyType: EditorChunkTopologyType;
  readonly cellIndexOrder: EditorChunkCellIndexOrder;
  readonly cellEncoding: EditorChunkCellEncoding;
}

export const EDITOR_BOOTSTRAP_SCHEMA_VERSION = "vectoplan-editor-bootstrap.v1" as const;

export const DEFAULT_EDITOR_SERVICE_NAME = "vectoplan-editor" as const;

export const DEFAULT_EDITOR_FRONTEND_ROOT = "services/vectoplan-editor/src/frontend" as const;

export const DEFAULT_EDITOR_TEMPLATE_MODE = "vite-index" as const;

export const DEFAULT_EDITOR_RUNTIME_MODE = "remote_chunk_service" as const;

export const DEFAULT_EDITOR_WORLD_MODE = "chunk_service" as const;

export const DEFAULT_EDITOR_WORLD_SOURCE_MODE = "chunk-service" as const;

export const DEFAULT_CHUNK_SERVICE_MODE = "editor-proxy" as const;

export const DEFAULT_CHUNK_SERVICE_SOURCE_KIND = "vectoplan-chunk" as const;

export const DEFAULT_CHUNK_PROXY_BASE_URL = "/editor/api/chunk" as const;

export const DEFAULT_EDITOR_INVENTORY_API_URL = "/editor/api/inventory" as const;

export const DEFAULT_EDITOR_INVENTORY_HEALTH_URL = "/editor/api/inventory/_health" as const;

export const DEFAULT_EDITOR_INVENTORY_METADATA_URL = "/editor/api/inventory/_metadata" as const;

export const DEFAULT_CREATIVE_LIBRARY_API_URL = "/editor/api/library" as const;

export const DEFAULT_CREATIVE_LIBRARY_HEALTH_URL = "/editor/api/library/_health" as const;

export const DEFAULT_CREATIVE_LIBRARY_METADATA_URL = "/editor/api/library/_metadata" as const;

export const DEFAULT_PROJECT_ID = "dev-project" as const;

export const DEFAULT_WORLD_ID = "world_spawn" as const;

export const DEFAULT_UNIVERSE_ID = "dev-universe" as const;

export const DEFAULT_TEMPLATE_ID = "dev-template" as const;

export const DEFAULT_PROVIDER_ID = "vectoplan-chunk" as const;

export const DEFAULT_PROVIDER_WORLD_ID = DEFAULT_WORLD_ID;

export const DEFAULT_CHUNK_SIZE = 16 as const;

export const DEFAULT_CELL_SIZE = 1 as const;

export const DEFAULT_AIR_CELL_VALUE = 0 as const;

export const DEFAULT_CELL_INDEX_ORDER = "x-fastest-y-then-z" as const;

export const DEFAULT_CHUNK_COORDINATE_SYSTEM = "vectoplan-world-y-up-v1" as const;

export const DEFAULT_CHUNK_PROJECTION_TYPE = "flat-local-v1" as const;

export const DEFAULT_CHUNK_TOPOLOGY_TYPE = "flat-unbounded-v1" as const;

export const DEFAULT_CHUNK_CELL_ENCODING: EditorChunkCellEncoding = {
  version: "cell-encoding.palette-index-plus-one.v1",
  airCellValue: DEFAULT_AIR_CELL_VALUE,
  blockCellValueRule: "paletteIndex + 1",
};

export const DEFAULT_CHUNK_SERVICE_TIMEOUTS: EditorChunkServiceTimeouts = {
  statusMs: 5_000,
  requestMs: 10_000,
  blocksMs: 10_000,
  inventoryMs: 10_000,
  libraryMs: 10_000,
  chunkMs: 15_000,
  batchMs: 20_000,
  commandMs: 15_000,
};

export const DEFAULT_CHUNK_SERVICE_MAX_BATCH_CHUNKS = 256 as const;

export const DEFAULT_CHUNK_SERVICE_MAX_LOADED_CHUNKS = 2048 as const;
export const DEFAULT_INVENTORY_SLOT_COUNT = 9 as const;

export const DEFAULT_INVENTORY_SOURCE_KIND = "vectoplan-user-inventory" as const;

export const DEFAULT_INVENTORY_ITEM_KIND = "vplib" as const;

export const DEFAULT_PRIMARY_BLOCK_TYPE_ID = "" as const;

export const DEFAULT_SECONDARY_BLOCK_TYPE_ID = "" as const;

export const DEFAULT_FALLBACK_BLOCK_TYPE_IDS: readonly string[] = [];

export const DEFAULT_INVENTORY_ROUTE_KIND = "editor-inventory" as const;

export const DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND = "creative-library" as const;

export const DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND = "placeable-blocks" as const;

export const DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE = true as const;

export const DEFAULT_DEBUG_GRASS_DIRT_ALLOWED = false as const;

export const DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK = false as const;

export const DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK = true as const;

export const DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT = false as const;

export const DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS = true as const;

export const DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS = 10_000 as const;

export const DEFAULT_INVENTORY_CACHE_TTL_MS = 5_000 as const;

export const DEFAULT_INVENTORY_STALE_CACHE_TTL_MS = 60_000 as const;

export const DEFAULT_CAMERA_SPAWN: EditorVector3 = {
  x: 8,
  y: 2,
  z: 8,
};

export const DEFAULT_CAMERA_ROTATION: EditorEuler3 = {
  pitch: 0,
  yaw: 0,
  roll: 0,
};

export const DEFAULT_RENDER_CLEAR_COLOR = "#020617" as const;

export const DEFAULT_VISIBLE_CHUNK_RADIUS = 14 as const;

export const DEFAULT_MAX_CHUNKS_PER_RENDER_SYNC = 256 as const;

export const DEFAULT_CAMERA_FOV = 65 as const;

export const DEFAULT_CAMERA_NEAR = 0.05 as const;

export const DEFAULT_CAMERA_FAR = 1_000 as const;

export const DEFAULT_CAMERA_MOVE_SPEED = 5.5 as const;

export const DEFAULT_CAMERA_SPRINT_MULTIPLIER = 2.4 as const;

export const DEFAULT_INPUT_SENSITIVITY = 0.0022 as const;

export const DEFAULT_POINTER_LOCK_ENABLED = true as const;

export const DEFAULT_FIRST_PERSON_ENABLED = true as const;

export const DEFAULT_PHYSICS_ENABLED = true as const;

export const DEFAULT_PLAYER_COLLISION_ENABLED = true as const;

export const DEFAULT_FLIGHT_MODE_ENABLED = true as const;

export const DEFAULT_CROSSHAIR_ENABLED = true as const;

export const DEFAULT_HOTBAR_ENABLED = true as const;

export const DEFAULT_STATUS_BAR_ENABLED = true as const;

export const DEFAULT_LOADING_OVERLAY_ENABLED = true as const;

export const DEFAULT_ERROR_PANEL_ENABLED = true as const;

export const DEFAULT_DEBUG_OVERLAY_ENABLED = false as const;

export const DEFAULT_CREATIVE_LIBRARY_ENABLED = true as const;

export const DEFAULT_PHYSICS_MODE = "local-player-physics-v1" as const;

export const DEFAULT_PHYSICS_FIXED_TIME_STEP_SECONDS = 1 / 60;

export const DEFAULT_PHYSICS_MAX_FRAME_DELTA_SECONDS = 0.25;

export const DEFAULT_PHYSICS_MAX_SUB_STEPS = 8 as const;

export const DEFAULT_PHYSICS_WALK_SPEED = 4.25;

export const DEFAULT_PHYSICS_SPRINT_SPEED = 9.5;

export const DEFAULT_PHYSICS_AIR_CONTROL_SPEED = 2.35;

export const DEFAULT_PHYSICS_FLY_SPEED = 6.5;

export const DEFAULT_PHYSICS_FLY_SPRINT_SPEED = 15;

export const DEFAULT_PHYSICS_JUMP_VELOCITY = 6.25;

export const DEFAULT_PHYSICS_GRAVITY = -18;

export const DEFAULT_PHYSICS_MAX_FALL_SPEED = -32;

export const DEFAULT_PHYSICS_GROUND_SNAP_DISTANCE = 0.08;

export const DEFAULT_PHYSICS_DOUBLE_TAP_WINDOW_MS = 280 as const;

export const DEFAULT_PHYSICS_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE = true as const;

export const DEFAULT_PHYSICS_COLLIDER_KIND = "aabb" as const;

export const DEFAULT_PHYSICS_PLAYER_WIDTH = 0.6;

export const DEFAULT_PHYSICS_PLAYER_HEIGHT = 1.8;

export const DEFAULT_PHYSICS_PLAYER_EYE_HEIGHT = 1.62;

export const DEFAULT_PHYSICS_PLAYER_SKIN_WIDTH = 0.001;

export const DEFAULT_PHYSICS_MISSING_CHUNK_POLICY = "block" as const;

export const DEFAULT_PHYSICS_BLOCK_HORIZONTAL_MOVEMENT_ON_MISSING_CHUNK = true as const;

export const DEFAULT_PHYSICS_BLOCK_VERTICAL_MOVEMENT_ON_MISSING_CHUNK = true as const;

export const DEFAULT_PHYSICS_DEBUG_EXPOSE_TO_STORE = true as const;

export const DEFAULT_PHYSICS_DEBUG_INCLUDE_COLLISION_CELLS = false as const;

function nowIsoStringForModel(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function safeStringForModel(value: unknown, fallback: string): string {
  try {
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
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

function safeNumberForModel(
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

function safeIntegerForModel(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    return Math.trunc(safeNumberForModel(value, fallback, min, max));
  } catch {
    return fallback;
  }
}

function safeBooleanForModel(value: unknown, fallback: boolean): boolean {
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

    if (["1", "true", "yes", "y", "on", "enabled", "ready"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off", "disabled", "pending", "error", "invalid"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeInventorySourceForModel(value: unknown): EditorInventorySourceKind {
  const normalized = safeStringForModel(value, DEFAULT_INVENTORY_SOURCE_KIND);

  if (
    normalized === "library"
    || normalized === "vectoplan-library"
    || normalized === "vectoplan-user-inventory"
    || normalized === "editor-inventory"
    || normalized === "vplib"
    || normalized === "library-service"
    || normalized === "creative-library"
    || normalized === "chunk-service"
    || normalized === "editor-placeholder"
    || normalized === "chunk-palette"
    || normalized === "static-fallback"
    || normalized === "runtime-generated"
    || normalized === "empty-fallback"
    || normalized === "fallback"
    || normalized === "error"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return DEFAULT_INVENTORY_SOURCE_KIND;
}

function normalizeInventoryItemKindForModel(value: unknown): EditorInventoryItemKind {
  const normalized = safeStringForModel(value, DEFAULT_INVENTORY_ITEM_KIND);

  if (
    normalized === "vplib"
    || normalized === "library-item"
    || normalized === "block"
    || normalized === "asset"
    || normalized === "empty"
  ) {
    return normalized;
  }

  return DEFAULT_INVENTORY_ITEM_KIND;
}

function normalizePhysicsModeForModel(value: unknown): EditorPhysicsMode {
  const normalized = safeStringForModel(value, DEFAULT_PHYSICS_MODE);

  return normalized === "local-player-physics-v1"
    ? "local-player-physics-v1"
    : DEFAULT_PHYSICS_MODE;
}

function normalizePhysicsMissingChunkPolicyForModel(value: unknown): EditorPhysicsMissingChunkPolicy {
  const normalized = safeStringForModel(value, DEFAULT_PHYSICS_MISSING_CHUNK_POLICY);

  if (
    normalized === "block"
    || normalized === "allow"
    || normalized === "request_chunk"
    || normalized === "treat_as_air"
    || normalized === "treat_as_solid"
  ) {
    return normalized;
  }

  return DEFAULT_PHYSICS_MISSING_CHUNK_POLICY;
}

function sanitizeIdentifierForModel(value: unknown, fallback: string): string {
  try {
    const raw = safeStringForModel(value, fallback);
    const normalized = raw.replace(/[^a-zA-Z0-9_.:-]/g, "").trim();

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function isLikelyAppProjectIdForModel(value: unknown): boolean {
  try {
    const text = safeStringForModel(value, "");

    return text.startsWith("prj_") && !text.startsWith("chk_prj_");
  } catch {
    return false;
  }
}

function isLikelyChunkProjectIdForModel(value: unknown): boolean {
  try {
    const text = safeStringForModel(value, "");

    return text.startsWith("chk_prj_") || text === DEFAULT_PROJECT_ID;
  } catch {
    return false;
  }
}

function normalizeChunkProjectIdForModel(value: unknown, fallback: string = DEFAULT_PROJECT_ID): string {
  try {
    const normalized = sanitizeIdentifierForModel(value, "");

    if (!normalized) {
      return fallback;
    }

    /**
     * Do not silently convert app project ids into usable chunk ids.
     * The caller can inspect identityValid/identityWarnings.
     */
    if (isLikelyAppProjectIdForModel(normalized)) {
      return normalized;
    }

    return normalized;
  } catch {
    return fallback;
  }
}

function routeProjectIdForModel(value: unknown): string {
  try {
    const normalized = normalizeChunkProjectIdForModel(value, DEFAULT_PROJECT_ID);

    if (!normalized || isLikelyAppProjectIdForModel(normalized)) {
      return DEFAULT_PROJECT_ID;
    }

    return normalized;
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}

function normalizeWorldIdForModel(value: unknown, fallback: string = DEFAULT_WORLD_ID): string {
  try {
    const normalized = sanitizeIdentifierForModel(value, fallback);

    if (normalized === "flat") {
      return fallback;
    }

    return normalized;
  } catch {
    return fallback;
  }
}

function normalizeChunkIdentityStatusForModel(value: unknown, fallback: EditorChunkIdentityStatus): EditorChunkIdentityStatus {
  try {
    const normalized = safeStringForModel(value, "").trim().toLowerCase().replace(/[-\s]+/g, "_");

    if (!normalized) {
      return fallback;
    }

    if (["ready", "ok", "active", "linked", "created", "provisioned", "available"].includes(normalized)) {
      return "ready";
    }

    if (["pending", "waiting", "queued", "initializing", "unknown"].includes(normalized)) {
      return "pending";
    }

    if (["error", "failed", "failure", "unavailable"].includes(normalized)) {
      return "error";
    }

    if (["disabled", "off"].includes(normalized)) {
      return "disabled";
    }

    if (["invalid", "bad", "rejected"].includes(normalized)) {
      return "invalid";
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function normalizeBaseUrlForModel(value: string): string {
  try {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return DEFAULT_CHUNK_PROXY_BASE_URL;
    }

    if (trimmed === "/") {
      return "";
    }

    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  } catch {
    return DEFAULT_CHUNK_PROXY_BASE_URL;
  }
}

export function normalizeRouteForModel(value: unknown, fallback: string): string {
  try {
    const raw = safeStringForModel(value, fallback).trim();

    if (!raw) {
      return fallback;
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
  } catch {
    return fallback;
  }
}

export function joinBootstrapRoute(baseUrl: string, path: string): string {
  try {
    const normalizedBase = normalizeBaseUrlForModel(baseUrl);
    const normalizedPath = path.trim();

    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }

    if (normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    if (normalizedBase.length === 0) {
      return `/${normalizedPath.replace(/^\/+/, "")}`;
    }

    return `${normalizedBase}/${normalizedPath.replace(/^\/+/, "")}`;
  } catch {
    return path;
  }
}

export function buildDefaultChunkRouteHints(
  baseUrl: string,
  projectId: string,
  worldId: string,
): EditorChunkServiceRouteHints {
  try {
    const normalizedBase = normalizeBaseUrlForModel(baseUrl);
    const safeProjectId = routeProjectIdForModel(projectId);
    const safeWorldId = normalizeWorldIdForModel(worldId, DEFAULT_WORLD_ID);
    const encodedProjectId = encodeURIComponent(safeProjectId);
    const encodedWorldId = encodeURIComponent(safeWorldId);
    const projectBase = joinBootstrapRoute(normalizedBase, `projects/${encodedProjectId}`);
    const worldBase = joinBootstrapRoute(projectBase, `worlds/${encodedWorldId}`);
    const chunk = joinBootstrapRoute(worldBase, "chunks");

    return {
      status: joinBootstrapRoute(normalizedBase, "_status"),
      connectionTest: joinBootstrapRoute(normalizedBase, "_test/connection"),
      projects: joinBootstrapRoute(normalizedBase, "projects"),
      project: projectBase,
      projectBootstrap: joinBootstrapRoute(projectBase, "bootstrap"),
      worlds: joinBootstrapRoute(projectBase, "worlds"),
      world: worldBase,

      blocks: joinBootstrapRoute(worldBase, "blocks"),
      placeableBlocks: joinBootstrapRoute(normalizedBase, "placeable-blocks"),

      editorInventory: DEFAULT_EDITOR_INVENTORY_API_URL,
      editorInventoryHealth: DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
      editorInventoryMetadata: DEFAULT_EDITOR_INVENTORY_METADATA_URL,

      creativeLibrary: DEFAULT_CREATIVE_LIBRARY_API_URL,
      creativeLibraryHealth: DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
      creativeLibraryMetadata: DEFAULT_CREATIVE_LIBRARY_METADATA_URL,

      chunk,
      chunks: chunk,
      chunksBatch: joinBootstrapRoute(worldBase, "chunks/batch"),
      commands: joinBootstrapRoute(worldBase, "commands"),
    };
  } catch {
    const projectBase = `${DEFAULT_CHUNK_PROXY_BASE_URL}/projects/${DEFAULT_PROJECT_ID}`;
    const worldBase = `${projectBase}/worlds/${DEFAULT_WORLD_ID}`;
    const chunk = `${worldBase}/chunks`;

    return {
      status: `${DEFAULT_CHUNK_PROXY_BASE_URL}/_status`,
      connectionTest: `${DEFAULT_CHUNK_PROXY_BASE_URL}/_test/connection`,
      projects: `${DEFAULT_CHUNK_PROXY_BASE_URL}/projects`,
      project: projectBase,
      projectBootstrap: `${projectBase}/bootstrap`,
      worlds: `${projectBase}/worlds`,
      world: worldBase,
      blocks: `${worldBase}/blocks`,
      placeableBlocks: `${DEFAULT_CHUNK_PROXY_BASE_URL}/placeable-blocks`,
      editorInventory: DEFAULT_EDITOR_INVENTORY_API_URL,
      editorInventoryHealth: DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
      editorInventoryMetadata: DEFAULT_EDITOR_INVENTORY_METADATA_URL,
      creativeLibrary: DEFAULT_CREATIVE_LIBRARY_API_URL,
      creativeLibraryHealth: DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
      creativeLibraryMetadata: DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
      chunk,
      chunks: chunk,
      chunksBatch: `${worldBase}/chunks/batch`,
      commands: `${worldBase}/commands`,
    };
  }
}

export function buildDefaultChunkServiceConfig(
  input?: Partial<EditorChunkServiceConfig>,
): EditorChunkServiceConfig {
  try {
    const apiBaseUrl = normalizeBaseUrlForModel(input?.apiBaseUrl ?? DEFAULT_CHUNK_PROXY_BASE_URL);
    const browserBaseUrl = normalizeBaseUrlForModel(input?.browserBaseUrl ?? apiBaseUrl);

    const projectId = normalizeChunkProjectIdForModel(
      input?.chunkProjectId ?? input?.projectId,
      DEFAULT_PROJECT_ID,
    );
    const worldId = normalizeWorldIdForModel(
      input?.chunkWorldId ?? input?.worldId,
      DEFAULT_WORLD_ID,
    );
    const chunkProjectId = normalizeChunkProjectIdForModel(
      input?.chunkProjectId ?? projectId,
      projectId,
    );
    const chunkWorldId = normalizeWorldIdForModel(
      input?.chunkWorldId ?? worldId,
      worldId,
    );
    const chunkUniverseId = safeStringForModel(input?.chunkUniverseId ?? input?.universeId, "") || null;
    const appProjectPublicId = safeStringForModel(input?.appProjectPublicId ?? input?.projectPublicId, "") || null;
    const identityValid = Boolean(
      isLikelyChunkProjectIdForModel(chunkProjectId)
      && !isLikelyAppProjectIdForModel(chunkProjectId)
      && chunkWorldId
      && chunkWorldId !== "flat",
    );
    const requestedStatus = normalizeChunkIdentityStatusForModel(
      input?.chunkStatus ?? input?.status,
      identityValid ? "ready" : "invalid",
    );
    const ready = Boolean(
      identityValid
      && requestedStatus !== "error"
      && requestedStatus !== "disabled"
      && requestedStatus !== "invalid",
    );
    const routeHints = input?.routeHints ?? buildDefaultChunkRouteHints(apiBaseUrl, chunkProjectId, chunkWorldId);
    const identityWarnings = [
      ...(input?.identityWarnings ?? []),
      ...(isLikelyAppProjectIdForModel(chunkProjectId)
        ? [`App project id '${chunkProjectId}' must not be used as chunk project id.`]
        : []),
      ...(!identityValid
        ? ["Chunk service identity is not valid. Runtime should fail closed before chunk HTTP requests are sent."]
        : []),
    ];

    const identityDiagnostics: EditorChunkIdentityDiagnostics = {
      kind: "vectoplan-editor-chunk-identity-contract.v1",
      status: identityValid ? "valid" : "invalid",
      projectId,
      chunkProjectId,
      appProjectPublicId,
      projectPublicId: appProjectPublicId,
      universeId: chunkUniverseId,
      chunkUniverseId,
      worldId,
      chunkWorldId,
      chunkReady: ready,
      ready,
      chunkStatus: ready ? "ready" : requestedStatus,
      valid: identityValid,
      degraded: identityWarnings.length > 0,
      issues: identityWarnings.map((warning) => ({
        code: "bootstrap_model_identity_warning",
        severity: identityValid ? "warning" : "error",
        message: warning,
      })),
    };

    return {
      enabled: true,
      mode: DEFAULT_CHUNK_SERVICE_MODE,
      sourceKind: DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
      connectionState: ready ? "ready" : identityValid ? "unknown" : "failed",
      apiBaseUrl,
      browserBaseUrl,
      projectId,
      worldId,
      chunkProjectId,
      chunkUniverseId,
      universeId: chunkUniverseId,
      chunkWorldId,
      appProjectPublicId,
      projectPublicId: appProjectPublicId,
      chunkReady: ready,
      ready,
      chunkStatus: ready ? "ready" : requestedStatus,
      status: ready ? "ready" : requestedStatus,
      identityValid,
      identityDegraded: identityWarnings.length > 0,
      valid: identityValid,
      degraded: identityWarnings.length > 0,
      identityWarnings,
      chunkIdentityWarnings: identityWarnings,
      identityDiagnostics: input?.identityDiagnostics ?? identityDiagnostics,
      contractIdentity: input?.contractIdentity ?? input?.identityDiagnostics ?? identityDiagnostics,
      proxyDiagnostics: input?.proxyDiagnostics ?? null,
      preferBatchLoad: input?.preferBatchLoad ?? true,
      reloadDirtyChunksAfterCommand: input?.reloadDirtyChunksAfterCommand ?? true,
      maxBatchChunks: input?.maxBatchChunks ?? DEFAULT_CHUNK_SERVICE_MAX_BATCH_CHUNKS,
      maxLoadedChunks: input?.maxLoadedChunks ?? DEFAULT_CHUNK_SERVICE_MAX_LOADED_CHUNKS,
      routeHints,
      timeouts: input?.timeouts ?? DEFAULT_CHUNK_SERVICE_TIMEOUTS,
    };
  } catch {
    const routeHints = buildDefaultChunkRouteHints(DEFAULT_CHUNK_PROXY_BASE_URL, DEFAULT_PROJECT_ID, DEFAULT_WORLD_ID);
    const identityDiagnostics: EditorChunkIdentityDiagnostics = {
      kind: "vectoplan-editor-chunk-identity-contract.v1",
      status: "degraded",
      projectId: DEFAULT_PROJECT_ID,
      chunkProjectId: DEFAULT_PROJECT_ID,
      appProjectPublicId: null,
      projectPublicId: null,
      universeId: DEFAULT_UNIVERSE_ID,
      chunkUniverseId: DEFAULT_UNIVERSE_ID,
      worldId: DEFAULT_WORLD_ID,
      chunkWorldId: DEFAULT_WORLD_ID,
      chunkReady: true,
      ready: true,
      chunkStatus: "ready",
      valid: true,
      degraded: true,
      issues: [
        {
          code: "bootstrap_model_chunk_service_fallback",
          severity: "warning",
          message: "Default chunk service fallback was used.",
        },
      ],
    };

    return {
      enabled: true,
      mode: DEFAULT_CHUNK_SERVICE_MODE,
      sourceKind: DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
      connectionState: "ready",
      apiBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      browserBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      projectId: DEFAULT_PROJECT_ID,
      worldId: DEFAULT_WORLD_ID,
      chunkProjectId: DEFAULT_PROJECT_ID,
      chunkUniverseId: DEFAULT_UNIVERSE_ID,
      universeId: DEFAULT_UNIVERSE_ID,
      chunkWorldId: DEFAULT_WORLD_ID,
      appProjectPublicId: null,
      projectPublicId: null,
      chunkReady: true,
      ready: true,
      chunkStatus: "ready",
      status: "ready",
      identityValid: true,
      identityDegraded: true,
      valid: true,
      degraded: true,
      identityWarnings: ["Default chunk service fallback was used."],
      chunkIdentityWarnings: ["Default chunk service fallback was used."],
      identityDiagnostics,
      contractIdentity: identityDiagnostics,
      proxyDiagnostics: null,
      preferBatchLoad: true,
      reloadDirtyChunksAfterCommand: true,
      maxBatchChunks: DEFAULT_CHUNK_SERVICE_MAX_BATCH_CHUNKS,
      maxLoadedChunks: DEFAULT_CHUNK_SERVICE_MAX_LOADED_CHUNKS,
      routeHints,
      timeouts: DEFAULT_CHUNK_SERVICE_TIMEOUTS,
    };
  }
}

export function buildDefaultRuntimeInventoryConfig(input?: Partial<EditorRuntimeInventoryConfig>): EditorRuntimeInventoryConfig {
  const hotbarSize = safeIntegerForModel(
    input?.hotbarSize ?? input?.slotCount,
    DEFAULT_INVENTORY_SLOT_COUNT,
    1,
    64,
  );
  const selectedSlot = safeIntegerForModel(
    input?.selectedSlot ?? input?.defaultSelectedSlot,
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );
  const apiUrl = normalizeRouteForModel(
    input?.apiUrl ?? input?.inventoryUrl ?? input?.route,
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  return {
    enabled: safeBooleanForModel(input?.enabled, true),
    source: normalizeInventorySourceForModel(input?.source),
    kind: normalizeInventoryItemKindForModel(input?.kind),
    apiUrl,
    inventoryUrl: normalizeRouteForModel(input?.inventoryUrl ?? apiUrl, apiUrl),
    route: normalizeRouteForModel(input?.route ?? apiUrl, apiUrl),
    healthUrl: normalizeRouteForModel(input?.healthUrl, DEFAULT_EDITOR_INVENTORY_HEALTH_URL),
    metadataUrl: normalizeRouteForModel(input?.metadataUrl, DEFAULT_EDITOR_INVENTORY_METADATA_URL),
    hotbarSize,
    slotCount: hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    forceRefreshOnBoot: safeBooleanForModel(input?.forceRefreshOnBoot, DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT),
    includeEmptySlots: safeBooleanForModel(input?.includeEmptySlots, DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS),
    allowEmptyFallback: safeBooleanForModel(input?.allowEmptyFallback, DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK),
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: safeIntegerForModel(input?.requestTimeoutMs, DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS, 100, 300_000),
    cacheTtlMs: safeIntegerForModel(input?.cacheTtlMs, DEFAULT_INVENTORY_CACHE_TTL_MS, 0, 3_600_000),
    staleCacheTtlMs: safeIntegerForModel(input?.staleCacheTtlMs, DEFAULT_INVENTORY_STALE_CACHE_TTL_MS, 0, 86_400_000),
  };
}

export function buildDefaultRuntimeLibraryConfig(input?: Partial<EditorRuntimeLibraryConfig>): EditorRuntimeLibraryConfig {
  return {
    enabled: safeBooleanForModel(input?.enabled, true),
    source: "vectoplan-library",
    apiUrl: normalizeRouteForModel(input?.apiUrl, DEFAULT_CREATIVE_LIBRARY_API_URL),
    browserApiUrl: normalizeRouteForModel(input?.browserApiUrl ?? input?.apiUrl, DEFAULT_CREATIVE_LIBRARY_API_URL),
    inventoryRoute: normalizeRouteForModel(input?.inventoryRoute, DEFAULT_EDITOR_INVENTORY_API_URL),
    creativeLibraryRoute: normalizeRouteForModel(input?.creativeLibraryRoute, DEFAULT_CREATIVE_LIBRARY_API_URL),
    healthRoute: normalizeRouteForModel(input?.healthRoute, DEFAULT_CREATIVE_LIBRARY_HEALTH_URL),
    metadataRoute: normalizeRouteForModel(input?.metadataRoute, DEFAULT_CREATIVE_LIBRARY_METADATA_URL),
    browserCallsLibraryDirectly: false,
  };
}

export function buildDefaultPhysicsBootstrap(input?: Partial<EditorPhysicsBootstrap>): EditorPhysicsBootstrap {
  try {
    const timing = input?.timing;
    const movement = input?.movement;
    const inputConfig = input?.input;
    const collider = input?.collider;
    const missingChunks = input?.missingChunks;
    const debug = input?.debug;

    const playerHeight = safeNumberForModel(collider?.height, DEFAULT_PHYSICS_PLAYER_HEIGHT, 0.4, 4);
    const playerEyeHeight = Math.min(
      playerHeight - 0.05,
      safeNumberForModel(collider?.eyeHeight, DEFAULT_PHYSICS_PLAYER_EYE_HEIGHT, 0.1, 4),
    );

    const fixedTimeStepSeconds = safeNumberForModel(
      timing?.fixedTimeStepSeconds,
      DEFAULT_PHYSICS_FIXED_TIME_STEP_SECONDS,
      1 / 240,
      1 / 20,
    );

    const maxFrameDeltaSeconds = safeNumberForModel(
      timing?.maxFrameDeltaSeconds,
      DEFAULT_PHYSICS_MAX_FRAME_DELTA_SECONDS,
      fixedTimeStepSeconds,
      2,
    );

    const walkSpeed = safeNumberForModel(movement?.walkSpeed, DEFAULT_PHYSICS_WALK_SPEED, 0, 80);
    const sprintSpeed = safeNumberForModel(movement?.sprintSpeed, DEFAULT_PHYSICS_SPRINT_SPEED, walkSpeed, 80);
    const flySpeed = safeNumberForModel(movement?.flySpeed, DEFAULT_PHYSICS_FLY_SPEED, 0, 80);
    const flySprintSpeed = safeNumberForModel(movement?.flySprintSpeed, DEFAULT_PHYSICS_FLY_SPRINT_SPEED, flySpeed, 80);

    return {
      enabled: safeBooleanForModel(input?.enabled, DEFAULT_PHYSICS_ENABLED),
      mode: normalizePhysicsModeForModel(input?.mode),
      timing: {
        fixedTimeStepSeconds,
        maxFrameDeltaSeconds,
        maxSubSteps: safeIntegerForModel(timing?.maxSubSteps, DEFAULT_PHYSICS_MAX_SUB_STEPS, 1, 60),
      },
      movement: {
        walkSpeed,
        sprintSpeed,
        airControlSpeed: safeNumberForModel(movement?.airControlSpeed, DEFAULT_PHYSICS_AIR_CONTROL_SPEED, 0, 80),
        flySpeed,
        flySprintSpeed,
        jumpVelocity: safeNumberForModel(movement?.jumpVelocity, DEFAULT_PHYSICS_JUMP_VELOCITY, 0, 80),
        gravity: safeNumberForModel(movement?.gravity, DEFAULT_PHYSICS_GRAVITY, -200, 0),
        maxFallSpeed: safeNumberForModel(movement?.maxFallSpeed, DEFAULT_PHYSICS_MAX_FALL_SPEED, -300, -1),
        groundSnapDistance: safeNumberForModel(movement?.groundSnapDistance, DEFAULT_PHYSICS_GROUND_SNAP_DISTANCE, 0, 0.5),
      },
      input: {
        doubleTapWindowMs: safeIntegerForModel(inputConfig?.doubleTapWindowMs, DEFAULT_PHYSICS_DOUBLE_TAP_WINDOW_MS, 80, 800),
        allowJumpBeforeFlightToggle: safeBooleanForModel(
          inputConfig?.allowJumpBeforeFlightToggle,
          DEFAULT_PHYSICS_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE,
        ),
      },
      collider: {
        kind: DEFAULT_PHYSICS_COLLIDER_KIND,
        width: safeNumberForModel(collider?.width, DEFAULT_PHYSICS_PLAYER_WIDTH, 0.1, 1.5),
        height: playerHeight,
        eyeHeight: playerEyeHeight,
        skinWidth: safeNumberForModel(collider?.skinWidth, DEFAULT_PHYSICS_PLAYER_SKIN_WIDTH, 0.00001, 0.05),
      },
      missingChunks: {
        policy: normalizePhysicsMissingChunkPolicyForModel(missingChunks?.policy),
        blockHorizontalMovement: safeBooleanForModel(
          missingChunks?.blockHorizontalMovement,
          DEFAULT_PHYSICS_BLOCK_HORIZONTAL_MOVEMENT_ON_MISSING_CHUNK,
        ),
        blockVerticalMovement: safeBooleanForModel(
          missingChunks?.blockVerticalMovement,
          DEFAULT_PHYSICS_BLOCK_VERTICAL_MOVEMENT_ON_MISSING_CHUNK,
        ),
      },
      debug: {
        enabled: safeBooleanForModel(debug?.enabled, DEFAULT_DEBUG_OVERLAY_ENABLED),
        exposeToStore: safeBooleanForModel(debug?.exposeToStore, DEFAULT_PHYSICS_DEBUG_EXPOSE_TO_STORE),
        includeCollisionCells: safeBooleanForModel(
          debug?.includeCollisionCells,
          DEFAULT_PHYSICS_DEBUG_INCLUDE_COLLISION_CELLS,
        ),
      },
    };
  } catch {
    return {
      enabled: DEFAULT_PHYSICS_ENABLED,
      mode: DEFAULT_PHYSICS_MODE,
      timing: {
        fixedTimeStepSeconds: DEFAULT_PHYSICS_FIXED_TIME_STEP_SECONDS,
        maxFrameDeltaSeconds: DEFAULT_PHYSICS_MAX_FRAME_DELTA_SECONDS,
        maxSubSteps: DEFAULT_PHYSICS_MAX_SUB_STEPS,
      },
      movement: {
        walkSpeed: DEFAULT_PHYSICS_WALK_SPEED,
        sprintSpeed: DEFAULT_PHYSICS_SPRINT_SPEED,
        airControlSpeed: DEFAULT_PHYSICS_AIR_CONTROL_SPEED,
        flySpeed: DEFAULT_PHYSICS_FLY_SPEED,
        flySprintSpeed: DEFAULT_PHYSICS_FLY_SPRINT_SPEED,
        jumpVelocity: DEFAULT_PHYSICS_JUMP_VELOCITY,
        gravity: DEFAULT_PHYSICS_GRAVITY,
        maxFallSpeed: DEFAULT_PHYSICS_MAX_FALL_SPEED,
        groundSnapDistance: DEFAULT_PHYSICS_GROUND_SNAP_DISTANCE,
      },
      input: {
        doubleTapWindowMs: DEFAULT_PHYSICS_DOUBLE_TAP_WINDOW_MS,
        allowJumpBeforeFlightToggle: DEFAULT_PHYSICS_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE,
      },
      collider: {
        kind: DEFAULT_PHYSICS_COLLIDER_KIND,
        width: DEFAULT_PHYSICS_PLAYER_WIDTH,
        height: DEFAULT_PHYSICS_PLAYER_HEIGHT,
        eyeHeight: DEFAULT_PHYSICS_PLAYER_EYE_HEIGHT,
        skinWidth: DEFAULT_PHYSICS_PLAYER_SKIN_WIDTH,
      },
      missingChunks: {
        policy: DEFAULT_PHYSICS_MISSING_CHUNK_POLICY,
        blockHorizontalMovement: DEFAULT_PHYSICS_BLOCK_HORIZONTAL_MOVEMENT_ON_MISSING_CHUNK,
        blockVerticalMovement: DEFAULT_PHYSICS_BLOCK_VERTICAL_MOVEMENT_ON_MISSING_CHUNK,
      },
      debug: {
        enabled: DEFAULT_DEBUG_OVERLAY_ENABLED,
        exposeToStore: DEFAULT_PHYSICS_DEBUG_EXPOSE_TO_STORE,
        includeCollisionCells: DEFAULT_PHYSICS_DEBUG_INCLUDE_COLLISION_CELLS,
      },
    };
  }
}

export function buildDefaultRuntimeConfig(
  chunk?: Partial<EditorChunkServiceConfig>,
  physics?: Partial<EditorPhysicsBootstrap>,
  inventory?: Partial<EditorRuntimeInventoryConfig>,
  library?: Partial<EditorRuntimeLibraryConfig>,
): EditorRuntimeConfig {
  return {
    mode: DEFAULT_EDITOR_RUNTIME_MODE,
    worldMode: DEFAULT_EDITOR_WORLD_MODE,
    sourceMode: DEFAULT_EDITOR_WORLD_SOURCE_MODE,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,
    chunk: buildDefaultChunkServiceConfig(chunk),
    physics: buildDefaultPhysicsBootstrap(physics),
    inventory: buildDefaultRuntimeInventoryConfig(inventory),
    library: buildDefaultRuntimeLibraryConfig(library),
  };
}

export function buildDefaultFeatureFlags(input?: Partial<EditorFeatureFlags>): EditorFeatureFlags {
  return {
    chunkServiceEnabled: true,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,

    chunkServiceInventoryEnabled: input?.chunkServiceInventoryEnabled ?? false,
    chunkPaletteInventoryFallbackEnabled: input?.chunkPaletteInventoryFallbackEnabled ?? false,
    placeableBlocksPlaceholderRouteEnabled: input?.placeableBlocksPlaceholderRouteEnabled ?? false,
    legacyChunkInventoryEnabled: input?.legacyChunkInventoryEnabled ?? false,

    editorInventoryApiEnabled: input?.editorInventoryApiEnabled ?? true,
    libraryInventoryEnabled: input?.libraryInventoryEnabled ?? true,
    onlyLibraryItemsPlaceable: input?.onlyLibraryItemsPlaceable ?? true,
    debugGrassDirtAllowed: false,

    remoteCommandsEnabled: input?.remoteCommandsEnabled ?? true,
    dirtyChunkReloadEnabled: input?.dirtyChunkReloadEnabled ?? true,

    pointerLockEnabled: input?.pointerLockEnabled ?? DEFAULT_POINTER_LOCK_ENABLED,
    firstPersonEnabled: input?.firstPersonEnabled ?? DEFAULT_FIRST_PERSON_ENABLED,
    physicsEnabled: input?.physicsEnabled ?? DEFAULT_PHYSICS_ENABLED,
    playerCollisionEnabled: input?.playerCollisionEnabled ?? DEFAULT_PLAYER_COLLISION_ENABLED,
    flightModeEnabled: input?.flightModeEnabled ?? DEFAULT_FLIGHT_MODE_ENABLED,
    crosshairEnabled: input?.crosshairEnabled ?? DEFAULT_CROSSHAIR_ENABLED,
    hotbarEnabled: input?.hotbarEnabled ?? DEFAULT_HOTBAR_ENABLED,
    statusBarEnabled: input?.statusBarEnabled ?? DEFAULT_STATUS_BAR_ENABLED,
    loadingOverlayEnabled: input?.loadingOverlayEnabled ?? DEFAULT_LOADING_OVERLAY_ENABLED,
    errorPanelEnabled: input?.errorPanelEnabled ?? DEFAULT_ERROR_PANEL_ENABLED,
    debugOverlayEnabled: input?.debugOverlayEnabled ?? DEFAULT_DEBUG_OVERLAY_ENABLED,

    creativeLibraryEnabled: input?.creativeLibraryEnabled ?? DEFAULT_CREATIVE_LIBRARY_ENABLED,
  };
}

export function buildDefaultUiBootstrap(input?: Partial<EditorUiBootstrap>): EditorUiBootstrap {
  return {
    language: input?.language === "en" ? "en" : "de",
    title: safeStringForModel(input?.title, "VECTOPLAN Editor"),
    subtitle: safeStringForModel(input?.subtitle, "Remote Chunk Runtime · Library Inventory"),
    showLeftPanel: safeBooleanForModel(input?.showLeftPanel, false),
    showRightPanel: safeBooleanForModel(input?.showRightPanel, false),
    showDebugOverlay: safeBooleanForModel(input?.showDebugOverlay, false),
    showHotbar: safeBooleanForModel(input?.showHotbar, true),
    showCrosshair: safeBooleanForModel(input?.showCrosshair, true),
    showStatusBar: safeBooleanForModel(input?.showStatusBar, true),
    showLoadingOverlay: safeBooleanForModel(input?.showLoadingOverlay, true),
  };
}

export function buildDefaultInputBootstrap(input?: Partial<EditorInputBootstrap>): EditorInputBootstrap {
  return {
    pointerLockEnabled: safeBooleanForModel(input?.pointerLockEnabled, true),
    keyboardEnabled: safeBooleanForModel(input?.keyboardEnabled, true),
    mouseEnabled: safeBooleanForModel(input?.mouseEnabled, true),
    wheelEnabled: safeBooleanForModel(input?.wheelEnabled, true),
    invertY: safeBooleanForModel(input?.invertY, false),
    sensitivity: safeNumberForModel(input?.sensitivity, DEFAULT_INPUT_SENSITIVITY, 0.0001, 0.1),
  };
}

export function buildDefaultCameraBootstrap(input?: Partial<EditorCameraBootstrap>): EditorCameraBootstrap {
  const physicsFollowEnabled = safeBooleanForModel(input?.physicsFollowEnabled, DEFAULT_PHYSICS_ENABLED);

  return {
    mode: "first-person",
    fov: safeNumberForModel(input?.fov, DEFAULT_CAMERA_FOV, 1, 179),
    near: safeNumberForModel(input?.near, DEFAULT_CAMERA_NEAR, 0.0001),
    far: safeNumberForModel(input?.far, DEFAULT_CAMERA_FAR, 1),
    spawn: {
      x: safeNumberForModel(input?.spawn?.x, DEFAULT_CAMERA_SPAWN.x),
      y: safeNumberForModel(input?.spawn?.y, DEFAULT_CAMERA_SPAWN.y),
      z: safeNumberForModel(input?.spawn?.z, DEFAULT_CAMERA_SPAWN.z),
    },
    rotation: {
      pitch: safeNumberForModel(input?.rotation?.pitch, DEFAULT_CAMERA_ROTATION.pitch),
      yaw: safeNumberForModel(input?.rotation?.yaw, DEFAULT_CAMERA_ROTATION.yaw),
      roll: safeNumberForModel(input?.rotation?.roll, DEFAULT_CAMERA_ROTATION.roll),
    },
    moveSpeed: safeNumberForModel(input?.moveSpeed, DEFAULT_CAMERA_MOVE_SPEED, 0),
    sprintMultiplier: safeNumberForModel(input?.sprintMultiplier, DEFAULT_CAMERA_SPRINT_MULTIPLIER, 0),
    directMovementEnabled: safeBooleanForModel(input?.directMovementEnabled, !physicsFollowEnabled),
    physicsFollowEnabled,
  };
}

export function buildDefaultRenderBootstrap(input?: Partial<EditorRenderBootstrap>): EditorRenderBootstrap {
  return {
    antialias: safeBooleanForModel(input?.antialias, true),
    alpha: safeBooleanForModel(input?.alpha, false),
    pixelRatioMax: safeNumberForModel(input?.pixelRatioMax, 2, 0.25, 8),
    clearColor: safeStringForModel(input?.clearColor, DEFAULT_RENDER_CLEAR_COLOR),
    chunkWireframe: safeBooleanForModel(input?.chunkWireframe, false),
    showPreview: safeBooleanForModel(input?.showPreview, true),
    showTargetHighlight: safeBooleanForModel(input?.showTargetHighlight, true),
    visibleChunkRadius: safeIntegerForModel(input?.visibleChunkRadius, DEFAULT_VISIBLE_CHUNK_RADIUS, 0, 32),
    maxChunksPerRenderSync: safeIntegerForModel(input?.maxChunksPerRenderSync, DEFAULT_MAX_CHUNKS_PER_RENDER_SYNC, 1, 4096),
  };
}

export function buildDefaultInventoryBootstrap(input?: Partial<EditorInventoryBootstrap>): EditorInventoryBootstrap {
  const hotbarSize = safeIntegerForModel(
    input?.hotbarSize ?? input?.slotCount,
    DEFAULT_INVENTORY_SLOT_COUNT,
    1,
    64,
  );
  const selectedSlot = safeIntegerForModel(
    input?.selectedSlot ?? input?.defaultSelectedSlot,
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );
  const apiUrl = normalizeRouteForModel(
    input?.apiUrl ?? input?.inventoryUrl ?? input?.route,
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  return {
    enabled: safeBooleanForModel(input?.enabled, true),
    source: normalizeInventorySourceForModel(input?.source),
    kind: normalizeInventoryItemKindForModel(input?.kind),
    apiUrl,
    inventoryUrl: normalizeRouteForModel(input?.inventoryUrl ?? apiUrl, apiUrl),
    route: normalizeRouteForModel(input?.route ?? apiUrl, apiUrl),
    healthUrl: normalizeRouteForModel(input?.healthUrl, DEFAULT_EDITOR_INVENTORY_HEALTH_URL),
    metadataUrl: normalizeRouteForModel(input?.metadataUrl, DEFAULT_EDITOR_INVENTORY_METADATA_URL),
    defaultBlockTypeId: safeStringForModel(input?.defaultBlockTypeId, DEFAULT_PRIMARY_BLOCK_TYPE_ID) || null,
    defaultRuntimeBlockTypeId: safeStringForModel(input?.defaultRuntimeBlockTypeId, DEFAULT_PRIMARY_BLOCK_TYPE_ID) || null,
    fallbackBlockTypeIds: input?.fallbackBlockTypeIds?.filter(Boolean) ?? DEFAULT_FALLBACK_BLOCK_TYPE_IDS,
    slotCount: hotbarSize,
    hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    includeEmptySlots: safeBooleanForModel(input?.includeEmptySlots, DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS),
    forceRefreshOnBoot: safeBooleanForModel(input?.forceRefreshOnBoot, DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT),
    allowEmptyFallback: safeBooleanForModel(input?.allowEmptyFallback, DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK),
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: safeIntegerForModel(input?.requestTimeoutMs, DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS, 100, 300_000),
    cacheTtlMs: safeIntegerForModel(input?.cacheTtlMs, DEFAULT_INVENTORY_CACHE_TTL_MS, 0, 3_600_000),
    staleCacheTtlMs: safeIntegerForModel(input?.staleCacheTtlMs, DEFAULT_INVENTORY_STALE_CACHE_TTL_MS, 0, 86_400_000),
    inventoryRouteKind:
      input?.inventoryRouteKind === "library-inventory"
        ? "library-inventory"
        : DEFAULT_INVENTORY_ROUTE_KIND,
    creativeLibraryRouteKind:
      input?.creativeLibraryRouteKind === "blocks"
        ? "blocks"
        : DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    legacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
  };
}

export function buildDefaultCreativeLibraryBootstrap(
  input?: Partial<EditorCreativeLibraryBootstrap>,
): EditorCreativeLibraryBootstrap {
  const route = normalizeRouteForModel(input?.route ?? input?.apiUrl, DEFAULT_CREATIVE_LIBRARY_API_URL);

  return {
    enabled: safeBooleanForModel(input?.enabled, true),
    source: normalizeInventorySourceForModel(input?.source ?? "creative-library"),
    routeKind: input?.routeKind === "blocks" ? "blocks" : DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    apiUrl: normalizeRouteForModel(input?.apiUrl ?? route, route),
    route,
    healthUrl: normalizeRouteForModel(input?.healthUrl, DEFAULT_CREATIVE_LIBRARY_HEALTH_URL),
    metadataUrl: normalizeRouteForModel(input?.metadataUrl, DEFAULT_CREATIVE_LIBRARY_METADATA_URL),
    browserCallsLibraryDirectly: false,
  };
}

export function buildDefaultChunkWorldMetadata(): EditorChunkWorldMetadata {
  return {
    chunkSize: DEFAULT_CHUNK_SIZE,
    cellSize: DEFAULT_CELL_SIZE,
    coordinateSystem: DEFAULT_CHUNK_COORDINATE_SYSTEM,
    projectionType: DEFAULT_CHUNK_PROJECTION_TYPE,
    topologyType: DEFAULT_CHUNK_TOPOLOGY_TYPE,
    cellIndexOrder: DEFAULT_CELL_INDEX_ORDER,
    cellEncoding: DEFAULT_CHUNK_CELL_ENCODING,
  };
}

export function buildDefaultEditorBootstrap(
  input?: {
    readonly buildMode?: string;
    readonly buildVersion?: string;
    readonly chunkProxyBaseUrl?: string;
    readonly projectId?: string;
    readonly chunkProjectId?: string;
    readonly appProjectPublicId?: string | null;
    readonly projectPublicId?: string | null;
    readonly universeId?: string | null;
    readonly chunkUniverseId?: string | null;
    readonly worldId?: string;
    readonly chunkWorldId?: string;
    readonly serviceVersion?: string;
    readonly inventory?: Partial<EditorInventoryBootstrap>;
    readonly creativeLibrary?: Partial<EditorCreativeLibraryBootstrap>;
    readonly runtimeInventory?: Partial<EditorRuntimeInventoryConfig>;
    readonly runtimeLibrary?: Partial<EditorRuntimeLibraryConfig>;
    readonly physics?: Partial<EditorPhysicsBootstrap>;
    readonly raw?: unknown;
  },
): EditorBootstrap {
  const createdAt = nowIsoStringForModel();
  const buildMode = safeStringForModel(input?.buildMode, "development");
  const buildVersion = safeStringForModel(input?.buildVersion, "dev");
  const chunkProjectId = normalizeChunkProjectIdForModel(
    input?.chunkProjectId ?? input?.projectId,
    DEFAULT_PROJECT_ID,
  );
  const worldId = normalizeWorldIdForModel(
    input?.chunkWorldId ?? input?.worldId,
    DEFAULT_WORLD_ID,
  );
  const chunkUniverseId = safeStringForModel(input?.chunkUniverseId ?? input?.universeId, DEFAULT_UNIVERSE_ID);
  const appProjectPublicId = safeStringForModel(input?.appProjectPublicId ?? input?.projectPublicId, "") || null;
  const physics = buildDefaultPhysicsBootstrap(input?.physics);
  const chunk = buildDefaultChunkServiceConfig({
    apiBaseUrl: input?.chunkProxyBaseUrl ?? DEFAULT_CHUNK_PROXY_BASE_URL,
    projectId: chunkProjectId,
    chunkProjectId,
    universeId: chunkUniverseId,
    chunkUniverseId,
    worldId,
    chunkWorldId: worldId,
    appProjectPublicId,
    projectPublicId: appProjectPublicId,
  });
  const inventory = buildDefaultInventoryBootstrap(input?.inventory);
  const creativeLibrary = buildDefaultCreativeLibraryBootstrap(input?.creativeLibrary);
  const runtimeInventory = buildDefaultRuntimeInventoryConfig({
    ...input?.runtimeInventory,
    apiUrl: input?.runtimeInventory?.apiUrl ?? inventory.apiUrl,
    inventoryUrl: input?.runtimeInventory?.inventoryUrl ?? inventory.inventoryUrl,
    route: input?.runtimeInventory?.route ?? inventory.route,
    healthUrl: input?.runtimeInventory?.healthUrl ?? inventory.healthUrl,
    metadataUrl: input?.runtimeInventory?.metadataUrl ?? inventory.metadataUrl,
    hotbarSize: input?.runtimeInventory?.hotbarSize ?? inventory.hotbarSize,
    slotCount: input?.runtimeInventory?.slotCount ?? inventory.slotCount,
    selectedSlot: input?.runtimeInventory?.selectedSlot ?? inventory.selectedSlot,
    defaultSelectedSlot: input?.runtimeInventory?.defaultSelectedSlot ?? inventory.defaultSelectedSlot,
  });
  const runtimeLibrary = buildDefaultRuntimeLibraryConfig({
    ...input?.runtimeLibrary,
    creativeLibraryRoute: input?.runtimeLibrary?.creativeLibraryRoute ?? creativeLibrary.route,
    healthRoute: input?.runtimeLibrary?.healthRoute ?? creativeLibrary.healthUrl,
    metadataRoute: input?.runtimeLibrary?.metadataRoute ?? creativeLibrary.metadataUrl,
    inventoryRoute: input?.runtimeLibrary?.inventoryRoute ?? inventory.route,
  });

  return {
    schemaVersion: EDITOR_BOOTSTRAP_SCHEMA_VERSION,
    app: {
      name: DEFAULT_EDITOR_SERVICE_NAME,
      mode: buildMode,
      buildMode,
      buildVersion,
      templateMode: DEFAULT_EDITOR_TEMPLATE_MODE,
      runtimeMode: DEFAULT_EDITOR_RUNTIME_MODE,
      serviceVersion: safeStringForModel(input?.serviceVersion, "0.1.0"),
      frontendRoot: DEFAULT_EDITOR_FRONTEND_ROOT,
      createdAt,
    },
    project: {
      projectId: chunkProjectId,
      runtimeProjectId: chunkProjectId,
      chunkProjectId,
      appProjectPublicId,
      projectPublicId: appProjectPublicId,
      worldId,
      chunkWorldId: worldId,
      universeId: chunkUniverseId,
      chunkUniverseId,
      templateId: DEFAULT_TEMPLATE_ID,
      providerId: DEFAULT_PROVIDER_ID,
      providerWorldId: DEFAULT_PROVIDER_WORLD_ID,
    },
    runtime: buildDefaultRuntimeConfig(chunk, physics, runtimeInventory, runtimeLibrary),
    featureFlags: buildDefaultFeatureFlags({
      physicsEnabled: physics.enabled,
      playerCollisionEnabled: physics.enabled,
      flightModeEnabled: physics.enabled,
      debugOverlayEnabled: physics.debug.enabled,
      editorInventoryApiEnabled: inventory.enabled,
      libraryInventoryEnabled: inventory.enabled,
      onlyLibraryItemsPlaceable: true,
      creativeLibraryEnabled: creativeLibrary.enabled,
      legacyChunkInventoryEnabled: false,
      chunkServiceInventoryEnabled: false,
      chunkPaletteInventoryFallbackEnabled: false,
      placeableBlocksPlaceholderRouteEnabled: false,
    }),
    ui: buildDefaultUiBootstrap({
      showDebugOverlay: physics.debug.enabled,
    }),
    input: buildDefaultInputBootstrap(),
    camera: buildDefaultCameraBootstrap({
      physicsFollowEnabled: physics.enabled,
      directMovementEnabled: !physics.enabled,
    }),
    render: buildDefaultRenderBootstrap(),
    inventory,
    creativeLibrary,
    physics,
    diagnostics: {
      source: "fallback",
      warnings: [],
      normalizedAt: createdAt,
      rawAvailable: input?.raw !== undefined,
    },
    raw: input?.raw ?? null,
  };
}

export function getBootstrapModelsMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.bootstrap.bootstrap_models",
    schemaVersion: EDITOR_BOOTSTRAP_SCHEMA_VERSION,
    defaultInventoryApiUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
    defaultCreativeLibraryApiUrl: DEFAULT_CREATIVE_LIBRARY_API_URL,
    defaultInventorySourceKind: DEFAULT_INVENTORY_SOURCE_KIND,
    defaultInventoryItemKind: DEFAULT_INVENTORY_ITEM_KIND,
    defaultInventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
    defaultCreativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    defaultFallbackBlockTypeIds: [...DEFAULT_FALLBACK_BLOCK_TYPE_IDS],
    rules: {
      hotbarInventoryComesFromEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      chunkPlaceableBlocksAreLegacyDiagnosticOnly: true,
      defaultDebugGrassDirtRemoved: true,
      onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEFAULT_DEBUG_GRASS_DIRT_ALLOWED,
      allowChunkPlaceableFallback: DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK,
      datasetCreativeLibraryHealthAndMetadataUrlsSupported: true,

      runtimeProjectIdIsChunkProjectId: true,
      runtimeWorldIdIsChunkWorldId: true,
      appProjectIdNeverUsedAsChunkProjectId: true,
      appProjectPublicIdKeptAsContextOnly: true,
      chunkProjectIdExplicitFieldSupported: true,
      chunkWorldIdExplicitFieldSupported: true,
      chunkUniverseIdExplicitFieldSupported: true,
      chunkIdentityDiagnosticsSupported: true,
      proxyDiagnosticsSupported: true,
      criticalChunkRoutesUseRouteSafeProjectId: true,
    },
  };
}
