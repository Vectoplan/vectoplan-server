// services/vectoplan-editor/src/frontend/api/chunk_api_models.ts
import type {
  EditorChunkServiceConfig,
  EditorChunkServiceRouteHints,
  EditorChunkServiceTimeouts,
} from "@bootstrap/bootstrap_models";

export type ChunkApiHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export type ChunkApiRequestKind =
  | "status"
  | "connection-test"
  | "projects"
  | "project"
  | "project-bootstrap"
  | "worlds"
  | "world"
  | "editor-inventory"
  | "editor-inventory-health"
  | "editor-inventory-metadata"
  | "placeable-blocks"
  | "blocks"
  | "creative-library"
  | "creative-library-health"
  | "creative-library-metadata"
  | "creative-library-blocks"
  | "chunk"
  | "chunks-batch"
  | "set-block"
  | "remove-block"
  | "replace-block"
  | "command";

export type ChunkApiResponseSource =
  | "editor-proxy"
  | "editor-placeholder"
  | "vectoplan-chunk"
  | "chunk-palette-fallback"
  | "client-fallback"
  | "unknown";

export type ChunkApiBlockSource =
  | "editor-placeholder-route"
  | "chunk-service-blocks-route"
  | "chunk-service-placeable-blocks-route"
  | "chunk-service-creative-library-route"
  | "chunk-palette"
  | "static-client-fallback";

export type ChunkApiBlockCollectionKind =
  | "inventory"
  | "creative-library"
  | "combined"
  | "fallback";

export type ChunkApiInventoryRouteKind =
  | "editor-inventory"
  | "library-inventory"
  | "placeable-blocks";

export type ChunkApiCreativeLibraryRouteKind =
  | "creative-library"
  | "blocks";

export type ChunkApiCommandType =
  | "SetBlock"
  | "RemoveBlock"
  | "ReplaceBlock"
  | "WorldEdit"
  | "PlaceObject"
  | "RemoveObject"
  | "ObjectBatch";

export type ChunkApiCommandStatus =
  | "pending"
  | "applied"
  | "noop"
  | "rejected"
  | "failed"
  | "unknown";

export type ChunkApiCellIndexOrder =
  | "x-fastest-y-then-z";

export type ChunkApiCellEncodingVersion =
  | "cell-encoding.palette-index-plus-one.v1";

export type ChunkApiErrorCode =
  | "chunk_api_unknown_error"
  | "chunk_api_destroyed"
  | "chunk_api_invalid_config"
  | "chunk_api_invalid_url"
  | "chunk_api_invalid_response"
  | "chunk_api_invalid_payload"
  | "chunk_api_response_parse_failed"
  | "chunk_api_request_aborted"
  | "chunk_api_request_timeout"
  | "chunk_api_network_error"
  | "chunk_api_http_error"
  | "chunk_api_status_not_ok"
  | "chunk_api_connection_failed"
  | "chunk_api_route_unavailable"
  | "chunk_api_project_unavailable"
  | "chunk_api_blocks_unavailable"
  | "chunk_api_no_placeable_blocks"
  | "chunk_api_chunk_unavailable"
  | "chunk_api_batch_unavailable"
  | "chunk_api_command_failed"
  | "chunk_api_unknown_block_type"
  | "chunk_api_palette_fallback_failed";

export interface ChunkApiJsonObject {
  readonly [key: string]: ChunkApiJsonValue;
}

export type ChunkApiJsonArray = readonly ChunkApiJsonValue[];

export type ChunkApiJsonPrimitive = string | number | boolean | null;

export type ChunkApiJsonValue =
  | ChunkApiJsonPrimitive
  | ChunkApiJsonObject
  | ChunkApiJsonArray;

export type ChunkApiUnknownRecord = Record<string, unknown>;

export interface ChunkApiVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ChunkApiChunkCoordinates {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
}

export interface ChunkApiWorldPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ChunkApiLocalCellPosition {
  readonly localX: number;
  readonly localY: number;
  readonly localZ: number;
}

export interface ChunkApiCellEncoding {
  readonly version: ChunkApiCellEncodingVersion;
  readonly airCellValue: 0;
  readonly blockCellValueRule: "paletteIndex + 1";
}

export interface ChunkApiRouteHints extends EditorChunkServiceRouteHints {
  readonly status: string;
  readonly connectionTest: string;
  readonly projects: string;
  readonly project: string;
  readonly projectBootstrap: string;
  readonly worlds: string;
  readonly world: string;

  /**
   * Legacy/diagnostic complete chunk block catalog.
   *
   * Productive Editor inventory must not be derived from this route.
   */
  readonly blocks: string;

  /**
   * Legacy/diagnostic placeable chunk block catalog.
   *
   * Productive Editor inventory must use /editor/api/inventory.
   */
  readonly placeableBlocks: string;

  /**
   * Productive Browser inventory endpoint.
   */
  readonly editorInventory: string;
  readonly editorInventoryHealth: string;
  readonly editorInventoryMetadata: string;

  /**
   * Server-side creative/library proxy endpoint.
   *
   * Browser hotbar still uses editorInventory.
   */
  readonly creativeLibrary: string;
  readonly creativeLibraryHealth: string;
  readonly creativeLibraryMetadata: string;

  readonly chunk: string;
  readonly chunksBatch: string;
  readonly commands: string;
}

export interface ChunkApiClientConfig {
  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly sourceKind: "vectoplan-chunk" | string;
  readonly mode: "editor-proxy" | string;
  readonly preferBatchLoad: boolean;
  readonly reloadDirtyChunksAfterCommand: boolean;
  readonly maxBatchChunks: number;
  readonly routeHints: ChunkApiRouteHints;
  readonly timeouts: EditorChunkServiceTimeouts;
}

export interface CreateChunkApiClientOptions {
  readonly config: EditorChunkServiceConfig;
  readonly logger?: ChunkApiLogger;
  readonly signal?: AbortSignal;
}

export interface ChunkApiLogger {
  readonly debug?: (message: string, details?: Record<string, unknown>) => void;
  readonly info?: (message: string, details?: Record<string, unknown>) => void;
  readonly warn?: (message: string, details?: Record<string, unknown>) => void;
  readonly error?: (message: string, details?: Record<string, unknown>) => void;
}

export interface ChunkApiRequestOptions {
  readonly kind: ChunkApiRequestKind;
  readonly method?: ChunkApiHttpMethod;
  readonly url: string;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly headers?: Record<string, string>;
  readonly allowNonOk?: boolean;
}

export interface ChunkApiCommandRequestOptions extends Partial<ChunkApiRequestOptions> {
  readonly userId?: string;
  readonly sessionId?: string;

  /**
   * Default: false.
   *
   * For Library/VPLIB placement the selected `runtimeBlockTypeId` may not be in
   * the legacy chunk block catalog. Validation against loadBlocks() must
   * therefore be opt-in only.
   */
  readonly validateBlockTypeId?: boolean;

  /**
   * Default: false.
   *
   * Debug block ids are blocked by default.
   */
  readonly allowForbiddenDebugBlockTypeId?: boolean;

  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly libraryRef?: unknown;
  readonly placementCommand?: unknown;
  readonly commandMetadata?: Record<string, unknown> | null;
}

export interface ChunkApiRequestMeta {
  readonly requestId: string;
  readonly kind: ChunkApiRequestKind;
  readonly method: ChunkApiHttpMethod;
  readonly url: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly elapsedMs: number | null;
  readonly statusCode: number | null;
  readonly ok: boolean;
  readonly aborted: boolean;
  readonly timedOut: boolean;
  readonly source: ChunkApiResponseSource;
}

export interface ChunkApiErrorDetails {
  readonly code: ChunkApiErrorCode | string;
  readonly message: string;
  readonly retryable: boolean;
  readonly statusCode?: number | null;
  readonly requestId?: string | null;
  readonly requestKind?: ChunkApiRequestKind | null;
  readonly url?: string | null;
  readonly method?: ChunkApiHttpMethod | null;
  readonly exceptionType?: string | null;
  readonly details?: ChunkApiUnknownRecord | null;
}

export interface ChunkApiResultBase {
  readonly ok: boolean;
  readonly request: ChunkApiRequestMeta | null;
  readonly source: ChunkApiResponseSource;
  readonly raw: unknown;
  readonly error: ChunkApiErrorDetails | null;
}

export interface ChunkApiStatusResult extends ChunkApiResultBase {
  readonly ok: true;
  readonly service: "vectoplan-editor" | "vectoplan-chunk" | string;
  readonly route: string | null;
  readonly moduleVersion: string | null;
  readonly proxyReachable: boolean;
  readonly upstreamReachable: boolean;
}

export interface ChunkApiConnectionTestResult extends ChunkApiResultBase {
  readonly ok: true;
  readonly editorProxyReachable: boolean;
  readonly chunkServiceReachable: boolean;
  readonly projectId: string;
  readonly worldId: string;
  readonly diagnostics: ChunkApiUnknownRecord;
}

export interface ChunkApiProjectBootstrapResult extends ChunkApiResultBase {
  readonly ok: true;
  readonly projectId: string;
  readonly universeId: string | null;
  readonly worldId: string;
  readonly defaultWorldId: string | null;
  readonly spawnWorldId: string | null;
  readonly routeHints: Partial<ChunkApiRouteHints>;
}

export interface ChunkApiBlockMetadata {
  readonly role?: string;
  readonly category?: string;
  readonly debugColor?: string;
  readonly color?: string;
  readonly editorHint?: string;
  readonly icon?: string;
  readonly iconUrl?: string;
  readonly [key: string]: unknown;
}

export interface ChunkApiPaletteEntry {
  readonly blockTypeId: string;
  readonly label: string;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly solid: boolean;
  readonly placeable: boolean;
  readonly breakable: boolean;
  readonly metadata: ChunkApiBlockMetadata;
}

export interface ChunkApiBlockDefinition {
  readonly blockTypeId: string;
  readonly label: string;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly cellValue: number;
  readonly paletteIndex: number | null;
  readonly solid: boolean;
  readonly placeable: boolean;
  readonly breakable: boolean;
  readonly source: ChunkApiBlockSource;
  readonly metadata: ChunkApiBlockMetadata;
}

export interface ChunkApiPlaceableBlockDefinition extends ChunkApiBlockDefinition {
  readonly placeable: true;
}

export interface ChunkApiBlocksResult extends ChunkApiResultBase {
  readonly ok: true;
  readonly projectId: string;
  readonly worldId: string;
  readonly registryId: string;
  readonly registryVersion: string;

  /**
   * Legacy/diagnostic complete chunk block catalog.
   *
   * Productive Editor inventory uses /editor/api/inventory.
   */
  readonly blocks: readonly ChunkApiBlockDefinition[];

  /**
   * Legacy/diagnostic placeable chunk block catalog.
   *
   * Productive Editor inventory uses /editor/api/inventory.
   */
  readonly placeableBlocks: readonly ChunkApiPlaceableBlockDefinition[];

  readonly sourceKind: ChunkApiBlockSource;
  readonly usedPaletteFallback: boolean;

  readonly collectionKind?: ChunkApiBlockCollectionKind;
  readonly inventoryRouteKind?: ChunkApiInventoryRouteKind;
  readonly creativeLibraryRouteKind?: ChunkApiCreativeLibraryRouteKind;
  readonly inventoryBlockCount?: number;
  readonly creativeLibraryBlockCount?: number;
}

export interface ChunkApiPlaceableBlocksResult extends ChunkApiBlocksResult {
  readonly ok: true;
}

export interface ChunkApiChunkStats {
  readonly cellCount: number;
  readonly airCellCount: number;
  readonly nonAirCellCount: number;
  readonly minimumSurfaceY?: number;
  readonly maximumSurfaceY?: number;
}

export interface ChunkApiRuntimeChunkContent {
  readonly projectId: string;
  readonly universeId: string | null;
  readonly worldId: string;
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly chunkSize: number;
  readonly cellSize: number;
  readonly cells: readonly number[];
  readonly palette: readonly ChunkApiPaletteEntry[];
  readonly stats: ChunkApiChunkStats;
  readonly source: "snapshot" | "generated" | "unknown";
  readonly snapshotId: string | null;
  readonly chunkRevision: number | null;
  readonly chunkVersion: string | null;
  readonly schemaVersion: string | null;
  readonly runtimeContentVersion: string | null;
  readonly cellEncoding: ChunkApiCellEncoding;
  readonly cellIndexOrder: ChunkApiCellIndexOrder;
  /**
   * Persisted objects whose geometry belongs to this chunk. This is normalized
   * explicitly because semantic parcel-grid bodies are rendered from these
   * references instead of from the voxel cell array.
   */
  readonly objectRefs: readonly unknown[];
  readonly metadata: ChunkApiUnknownRecord;
  readonly raw: unknown;
}

export interface ChunkApiChunkFlags {
  readonly snapshotBacked: boolean;
  readonly providerGenerated: boolean;
  readonly materialized: boolean;
  readonly createdSnapshot: boolean;
}

export interface ChunkApiChunkResult extends ChunkApiResultBase {
  readonly ok: true;
  readonly projectId: string;
  readonly universeId: string | null;
  readonly worldId: string;
  readonly chunkKey: string;
  readonly chunk: ChunkApiRuntimeChunkContent;
  readonly flags: ChunkApiChunkFlags;
  readonly routeHints: Partial<ChunkApiRouteHints>;
}

export interface ChunkApiBatchChunkRequest {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
}

export interface ChunkApiBatchRequestBody {
  readonly chunks: readonly ChunkApiBatchChunkRequest[];
}

export interface ChunkApiBatchResult extends ChunkApiResultBase {
  readonly ok: true;
  readonly projectId: string;
  readonly worldId: string;
  readonly chunks: readonly ChunkApiRuntimeChunkContent[];
  readonly failedChunks: readonly ChunkApiChunkCoordinates[];
}

export interface ChunkApiAffectedCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly localX: number | null;
  readonly localY: number | null;
  readonly localZ: number | null;
  readonly chunkKey: string | null;
  readonly beforeCellValue: number | null;
  readonly afterCellValue: number | null;
  readonly beforeBlockTypeId: string | null;
  readonly afterBlockTypeId: string | null;
}

export interface ChunkApiCommandFlags {
  readonly dbBacked: boolean;
  readonly projectScoped: boolean;
  readonly snapshotWritten: boolean;
  readonly eventsWritten: boolean;
  readonly objectCommand: boolean;
}

export interface ChunkApiCommandPayloadBase {
  readonly type: ChunkApiCommandType;
  readonly userId: string;
  readonly sessionId: string;
  readonly position: ChunkApiWorldPosition;
}

export interface ChunkApiSetBlockCommandPayload extends ChunkApiCommandPayloadBase {
  readonly type: "SetBlock";

  /**
   * Technical runtime block type id.
   *
   * For Library/VPLIB placement this is not the semantic Library identity.
   */
  readonly blockTypeId: string;
}

export interface ChunkApiRemoveBlockCommandPayload extends ChunkApiCommandPayloadBase {
  readonly type: "RemoveBlock";
}

export interface ChunkApiReplaceBlockCommandPayload extends ChunkApiCommandPayloadBase {
  readonly type: "ReplaceBlock";

  /**
   * Technical runtime block type id.
   */
  readonly blockTypeId: string;
}

export interface ChunkApiWorldEditCommandPayload extends ChunkApiCommandPayloadBase {
  readonly type: "WorldEdit";
  readonly tool: "selection" | "paint" | "sculpt" | "clipboard" | "tentacle";
  readonly operation: "set" | "wall" | "fill" | "replace" | "clear" | "copy" | "cut" | "paste";
  readonly blockTypeId?: string;
  readonly replaceBlockTypeId?: string;
  readonly bounds?: Readonly<Record<string, unknown>>;
  readonly brush?: Readonly<Record<string, unknown>>;
  readonly path?: readonly Readonly<{ x: number; y: number; z: number }>[];
  readonly parcelMask?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export interface ChunkApiPlaceObjectCommandPayload extends ChunkApiCommandPayloadBase {
  readonly type: "PlaceObject";
  readonly blockTypeId: string;
  /** Explicit runtime id and VPLIB provenance used for authenticated first registration. */
  readonly runtimeBlockTypeId?: string;
  readonly libraryContext?: Readonly<Record<string, unknown>>;
  readonly objectTypeId: string;
  readonly objectKind: string;
  readonly objectInstanceId?: string;
  readonly dimensions: Readonly<{ x: number; y: number; z: number }>;
  readonly footprint: Readonly<Record<string, unknown>>;
  readonly occupiedCells: readonly ChunkApiWorldPosition[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChunkApiRemoveObjectCommandPayload extends ChunkApiCommandPayloadBase {
  readonly type: "RemoveObject";
  readonly objectInstanceId: string;
}

/**
 * A bounded set of object mutations committed by the Chunk service in one
 * database transaction.  It is intentionally object-only: mixing arbitrary
 * block/WorldEdit commands here would make ownership and rollback ambiguous.
 */
export interface ChunkApiObjectBatchCommandPayload extends ChunkApiCommandPayloadBase {
  readonly type: "ObjectBatch";
  readonly commands: readonly (
    | ChunkApiPlaceObjectCommandPayload
    | ChunkApiRemoveObjectCommandPayload
  )[];
}

export type ChunkApiCommandPayload =
  | ChunkApiSetBlockCommandPayload
  | ChunkApiRemoveBlockCommandPayload
  | ChunkApiReplaceBlockCommandPayload
  | ChunkApiWorldEditCommandPayload
  | ChunkApiPlaceObjectCommandPayload
  | ChunkApiRemoveObjectCommandPayload
  | ChunkApiObjectBatchCommandPayload;

export interface ChunkApiCommandResult extends ChunkApiResultBase {
  readonly ok: true;
  readonly projectId: string;
  readonly worldId: string;
  readonly commandType: ChunkApiCommandType;
  readonly commandStatus: ChunkApiCommandStatus;
  readonly changed: boolean;
  readonly eventIds: readonly string[];
  readonly snapshotIds: readonly string[];
  readonly changedChunks: readonly string[];
  readonly dirtyChunks: readonly string[];
  readonly affectedCells: readonly ChunkApiAffectedCell[];
  readonly chunkVersions: Readonly<Record<string, string>>;
  readonly flags: ChunkApiCommandFlags;
}

export interface ChunkApiFailedResult extends ChunkApiResultBase {
  readonly ok: false;
  readonly error: ChunkApiErrorDetails;
}

export type ChunkApiAnySuccessResult =
  | ChunkApiStatusResult
  | ChunkApiConnectionTestResult
  | ChunkApiProjectBootstrapResult
  | ChunkApiBlocksResult
  | ChunkApiPlaceableBlocksResult
  | ChunkApiChunkResult
  | ChunkApiBatchResult
  | ChunkApiCommandResult;

export type ChunkApiAnyResult =
  | ChunkApiAnySuccessResult
  | ChunkApiFailedResult;

export interface ChunkApiClient {
  readonly kind: "vectoplan-editor-chunk-api-client.v1";
  readonly config: ChunkApiClientConfig;

  getConfig(): ChunkApiClientConfig;

  loadStatus(options?: Partial<ChunkApiRequestOptions>): Promise<ChunkApiStatusResult | ChunkApiFailedResult>;
  testConnection(options?: Partial<ChunkApiRequestOptions>): Promise<ChunkApiConnectionTestResult | ChunkApiFailedResult>;
  loadProjectBootstrap(options?: Partial<ChunkApiRequestOptions>): Promise<ChunkApiProjectBootstrapResult | ChunkApiFailedResult>;

  /**
   * Legacy/diagnostic only.
   *
   * Productive hotbar inventory must use /editor/api/inventory.
   */
  loadPlaceableBlocks(options?: Partial<ChunkApiRequestOptions>): Promise<ChunkApiPlaceableBlocksResult | ChunkApiFailedResult>;

  /**
   * Legacy/diagnostic only.
   *
   * Productive hotbar inventory must use /editor/api/inventory.
   */
  loadBlocks(options?: Partial<ChunkApiRequestOptions>): Promise<ChunkApiBlocksResult | ChunkApiFailedResult>;

  loadChunk(
    coordinates: ChunkApiChunkCoordinates,
    options?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiChunkResult | ChunkApiFailedResult>;

  loadChunksBatch(
    chunks: readonly ChunkApiBatchChunkRequest[],
    options?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiBatchResult | ChunkApiFailedResult>;

  sendCommand(
    command: ChunkApiCommandPayload,
    options?: Partial<ChunkApiRequestOptions>,
  ): Promise<ChunkApiCommandResult | ChunkApiFailedResult>;

  sendSetBlock(
    position: ChunkApiWorldPosition,
    blockTypeId: string,
    options?: ChunkApiCommandRequestOptions,
  ): Promise<ChunkApiCommandResult | ChunkApiFailedResult>;

  sendRemoveBlock(
    position: ChunkApiWorldPosition,
    options?: ChunkApiCommandRequestOptions,
  ): Promise<ChunkApiCommandResult | ChunkApiFailedResult>;

  destroy(reason?: string): void;
}

export interface ChunkApiPlaceableBlocksPlaceholderResponse {
  readonly ok: true;
  readonly responseVersion: "vectoplan-editor-placeable-blocks.v1";
  readonly source: "editor-placeholder";
  readonly projectId: string;
  readonly worldId: string;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly blocks: readonly ChunkApiPlaceableBlockDefinition[];
  readonly metadata: {
    readonly routeSource: "vectoplan-editor";
    readonly note: string;
    readonly legacyDiagnosticOnly: true;
    readonly productiveInventoryRoute: "/editor/api/inventory";
  };
}

export const CHUNK_API_CLIENT_KIND = "vectoplan-editor-chunk-api-client.v1" as const;

export const CHUNK_API_PLACEABLE_BLOCKS_RESPONSE_VERSION = "vectoplan-editor-placeable-blocks.v1" as const;

export const CHUNK_API_DEFAULT_USER_ID = "editor_user" as const;

export const CHUNK_API_DEFAULT_SESSION_ID_PREFIX = "editor_session" as const;

export const CHUNK_API_DEFAULT_PROJECT_ID = "dev-project" as const;

export const CHUNK_API_DEFAULT_WORLD_ID = "world_spawn" as const;

export const CHUNK_API_DEFAULT_CHUNK_SIZE = 16 as const;

export const CHUNK_API_DEFAULT_CELL_SIZE = 1 as const;

export const CHUNK_API_AIR_CELL_VALUE = 0 as const;

export const CHUNK_API_IMPLICIT_SOLID_CELL_VALUE = -1 as const;

export const CHUNK_API_CELL_INDEX_ORDER = "x-fastest-y-then-z" as const;

export const CHUNK_API_CELL_ENCODING: ChunkApiCellEncoding = {
  version: "cell-encoding.palette-index-plus-one.v1",
  airCellValue: CHUNK_API_AIR_CELL_VALUE,
  blockCellValueRule: "paletteIndex + 1",
};

export const CHUNK_API_DEFAULT_REGISTRY_ID = "legacy-chunk-blocks" as const;

export const CHUNK_API_DEFAULT_REGISTRY_VERSION = "1" as const;

export const CHUNK_API_PLACEABLE_BLOCKS_ROUTE_SUFFIX = "/placeable-blocks" as const;

export const CHUNK_API_EDITOR_INVENTORY_ROUTE = "/editor/api/inventory" as const;

export const CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE = "/editor/api/inventory/_health" as const;

export const CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE = "/editor/api/inventory/_metadata" as const;

export const CHUNK_API_CREATIVE_LIBRARY_ROUTE = "/editor/api/library" as const;

export const CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE = "/editor/api/library/_health" as const;

export const CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE = "/editor/api/library/_metadata" as const;

export const CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS: readonly string[] = [
  "debug_grass",
  "debug_dirt",
];

export const CHUNK_API_DEFAULT_TIMEOUTS: EditorChunkServiceTimeouts = {
  statusMs: 5_000,
  requestMs: 10_000,
  blocksMs: 10_000,
  inventoryMs: 10_000,
  libraryMs: 10_000,
  chunkMs: 15_000,
  batchMs: 20_000,
  commandMs: 15_000,
};

/**
 * Empty by design.
 *
 * The productive hotbar inventory is served by /editor/api/inventory.
 * Client-side debug_grass/debug_dirt defaults are no longer allowed.
 */
export const CHUNK_API_DEFAULT_PLACEABLE_BLOCKS: readonly ChunkApiPlaceableBlockDefinition[] = [];

function safeString(value: unknown, fallback = ""): string {
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
      const converted = String(value).trim();
      return converted.length > 0 ? converted : fallback;
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

function safeNumber(value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
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

function safeInteger(value: unknown, fallback: number, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
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

function asRecord(value: unknown): ChunkApiUnknownRecord | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as ChunkApiUnknownRecord;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: unknown, fallback = "/editor/api/chunk"): string {
  try {
    const raw = safeString(value, fallback);

    if (raw === "/") {
      return "";
    }

    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  } catch {
    return fallback;
  }
}

function normalizeId(value: unknown, fallback: string): string {
  try {
    const normalized = safeString(value, fallback)
      .replace(/[^a-zA-Z0-9_.:-]/g, "")
      .trim();

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "").trim();
  return CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

function normalizeBlockTypeId(value: unknown): string {
  const normalized = safeString(value, "").trim();

  if (!normalized || isForbiddenDebugBlockTypeId(normalized)) {
    return "";
  }

  return normalized;
}

function normalizeBlockSource(value: unknown, fallback: ChunkApiBlockSource): ChunkApiBlockSource {
  const normalized = safeString(value, fallback);

  if (
    normalized === "editor-placeholder-route"
    || normalized === "chunk-service-blocks-route"
    || normalized === "chunk-service-placeable-blocks-route"
    || normalized === "chunk-service-creative-library-route"
    || normalized === "chunk-palette"
    || normalized === "static-client-fallback"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeMetadata(value: unknown): ChunkApiBlockMetadata {
  try {
    const record = asRecord(value);

    if (!record) {
      return {};
    }

    return record as ChunkApiBlockMetadata;
  } catch {
    return {};
  }
}

function blockDefinitionFromUnknown(
  value: unknown,
  fallback: {
    readonly index: number;
    readonly registryId: string;
    readonly registryVersion: string;
    readonly source: ChunkApiBlockSource;
  },
): ChunkApiBlockDefinition | null {
  try {
    const record = asRecord(value);

    if (!record) {
      return null;
    }

    const blockTypeId = normalizeBlockTypeId(record.blockTypeId ?? record.id ?? record.type);

    if (!blockTypeId) {
      return null;
    }

    const label = safeString(record.label ?? record.name, blockTypeId);
    const paletteIndexValue = record.paletteIndex;
    const paletteIndex = typeof paletteIndexValue === "number" && Number.isFinite(paletteIndexValue)
      ? Math.trunc(paletteIndexValue)
      : fallback.index;

    return {
      blockTypeId,
      label,
      registryId: safeString(record.registryId, fallback.registryId),
      registryVersion: safeString(record.registryVersion, fallback.registryVersion),
      cellValue: safeInteger(record.cellValue, paletteIndex + 1, 1),
      paletteIndex,
      solid: safeBoolean(record.solid, true),
      placeable: safeBoolean(record.placeable, true),
      breakable: safeBoolean(record.breakable, true),
      source: normalizeBlockSource(record.source, fallback.source),
      metadata: normalizeMetadata(record.metadata),
    };
  } catch {
    return null;
  }
}

function toPlaceableBlock(block: ChunkApiBlockDefinition): ChunkApiPlaceableBlockDefinition | null {
  try {
    if (!block.placeable || isForbiddenDebugBlockTypeId(block.blockTypeId)) {
      return null;
    }

    return {
      ...block,
      placeable: true,
    };
  } catch {
    return null;
  }
}

function normalizeBlockDefinitions(
  values: unknown,
  fallback: {
    readonly registryId: string;
    readonly registryVersion: string;
    readonly source: ChunkApiBlockSource;
  },
): readonly ChunkApiBlockDefinition[] {
  try {
    if (!Array.isArray(values)) {
      return [];
    }

    const result: ChunkApiBlockDefinition[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < values.length; index += 1) {
      const block = blockDefinitionFromUnknown(values[index], {
        index,
        registryId: fallback.registryId,
        registryVersion: fallback.registryVersion,
        source: fallback.source,
      });

      if (!block || seen.has(block.blockTypeId)) {
        continue;
      }

      seen.add(block.blockTypeId);
      result.push(block);
    }

    return result;
  } catch {
    return [];
  }
}

function normalizePlaceableBlockDefinitions(
  values: unknown,
  fallback: {
    readonly registryId: string;
    readonly registryVersion: string;
    readonly source: ChunkApiBlockSource;
  },
): readonly ChunkApiPlaceableBlockDefinition[] {
  try {
    return normalizeBlockDefinitions(values, fallback)
      .map((block) => toPlaceableBlock(block))
      .filter((block): block is ChunkApiPlaceableBlockDefinition => block !== null);
  } catch {
    return [];
  }
}

function inferResponseSource(value: unknown, fallback: ChunkApiResponseSource): ChunkApiResponseSource {
  const normalized = safeString(value, fallback);

  if (
    normalized === "editor-proxy"
    || normalized === "editor-placeholder"
    || normalized === "vectoplan-chunk"
    || normalized === "chunk-palette-fallback"
    || normalized === "client-fallback"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return fallback;
}

function uniqueBlockDefinitions(
  blocks: readonly ChunkApiBlockDefinition[],
): readonly ChunkApiBlockDefinition[] {
  try {
    const seen = new Set<string>();
    const result: ChunkApiBlockDefinition[] = [];

    for (const block of blocks) {
      const blockTypeId = normalizeBlockTypeId(block.blockTypeId);

      if (!blockTypeId || seen.has(blockTypeId)) {
        continue;
      }

      seen.add(blockTypeId);
      result.push({
        ...block,
        blockTypeId,
      });
    }

    return result;
  } catch {
    return [];
  }
}

function placeableBlocksFromBlocks(
  blocks: readonly ChunkApiBlockDefinition[],
): readonly ChunkApiPlaceableBlockDefinition[] {
  try {
    return blocks
      .map((block) => toPlaceableBlock(block))
      .filter((block): block is ChunkApiPlaceableBlockDefinition => block !== null);
  } catch {
    return [];
  }
}

export function isChunkApiFailedResult(value: unknown): value is ChunkApiFailedResult {
  try {
    return Boolean(value)
      && typeof value === "object"
      && (value as { ok?: unknown }).ok === false
      && "error" in value;
  } catch {
    return false;
  }
}

export function isChunkApiSuccessResult(value: unknown): value is ChunkApiAnySuccessResult {
  try {
    return Boolean(value)
      && typeof value === "object"
      && (value as { ok?: unknown }).ok === true
      && !isChunkApiFailedResult(value);
  } catch {
    return false;
  }
}

export function isChunkApiBlocksResult(value: unknown): value is ChunkApiBlocksResult {
  try {
    const record = asRecord(value);

    return Boolean(
      record
      && record.ok === true
      && Array.isArray(record.blocks)
      && Array.isArray(record.placeableBlocks),
    );
  } catch {
    return false;
  }
}

export function chunkApiChunkKeyFromCoordinates(coordinates: ChunkApiChunkCoordinates): string {
  try {
    return `${safeInteger(coordinates.chunkX, 0)}:${safeInteger(coordinates.chunkY, 0)}:${safeInteger(coordinates.chunkZ, 0)}`;
  } catch {
    return "0:0:0";
  }
}

export function normalizeChunkApiWorldPosition(position: Partial<ChunkApiWorldPosition> | null | undefined): ChunkApiWorldPosition {
  return {
    x: safeNumber(position?.x, 0),
    y: safeNumber(position?.y, 0),
    z: safeNumber(position?.z, 0),
  };
}

export function normalizeChunkApiCoordinates(coordinates: Partial<ChunkApiChunkCoordinates> | null | undefined): ChunkApiChunkCoordinates {
  return {
    chunkX: safeInteger(coordinates?.chunkX, 0),
    chunkY: safeInteger(coordinates?.chunkY, 0),
    chunkZ: safeInteger(coordinates?.chunkZ, 0),
  };
}

export function buildChunkApiPlaceableBlocksRoute(apiBaseUrl: string): string {
  try {
    const normalizedBase = normalizeBaseUrl(apiBaseUrl, "");

    if (normalizedBase.length === 0) {
      return CHUNK_API_PLACEABLE_BLOCKS_ROUTE_SUFFIX;
    }

    return `${normalizedBase}${CHUNK_API_PLACEABLE_BLOCKS_ROUTE_SUFFIX}`;
  } catch {
    return CHUNK_API_PLACEABLE_BLOCKS_ROUTE_SUFFIX;
  }
}

export function extendChunkApiRouteHints(
  hints: EditorChunkServiceRouteHints,
  apiBaseUrl: string,
): ChunkApiRouteHints {
  return {
    status: hints.status,
    connectionTest: hints.connectionTest,
    projects: hints.projects,
    project: hints.project,
    projectBootstrap: hints.projectBootstrap,
    worlds: hints.worlds,
    world: hints.world,

    blocks: hints.blocks,
    placeableBlocks: safeString(
      (hints as Partial<ChunkApiRouteHints>).placeableBlocks,
      buildChunkApiPlaceableBlocksRoute(apiBaseUrl),
    ),

    editorInventory: safeString(
      (hints as Partial<ChunkApiRouteHints>).editorInventory,
      CHUNK_API_EDITOR_INVENTORY_ROUTE,
    ),
    editorInventoryHealth: safeString(
      (hints as Partial<ChunkApiRouteHints>).editorInventoryHealth,
      CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE,
    ),
    editorInventoryMetadata: safeString(
      (hints as Partial<ChunkApiRouteHints>).editorInventoryMetadata,
      CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE,
    ),

    creativeLibrary: safeString(
      (hints as Partial<ChunkApiRouteHints>).creativeLibrary,
      CHUNK_API_CREATIVE_LIBRARY_ROUTE,
    ),
    creativeLibraryHealth: safeString(
      (hints as Partial<ChunkApiRouteHints>).creativeLibraryHealth,
      CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE,
    ),
    creativeLibraryMetadata: safeString(
      (hints as Partial<ChunkApiRouteHints>).creativeLibraryMetadata,
      CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE,
    ),

    chunk: hints.chunk,
    chunksBatch: hints.chunksBatch,
    commands: hints.commands,
  };
}

export function normalizeChunkApiRouteHints(
  input: {
    readonly routeHints: Partial<ChunkApiRouteHints> | EditorChunkServiceRouteHints;
    readonly apiBaseUrl: string;
    readonly projectId: string;
    readonly worldId: string;
  },
): ChunkApiRouteHints {
  const apiBaseUrl = normalizeBaseUrl(input.apiBaseUrl);
  const projectId = encodeURIComponent(normalizeId(input.projectId, CHUNK_API_DEFAULT_PROJECT_ID));
  const worldId = encodeURIComponent(normalizeId(input.worldId, CHUNK_API_DEFAULT_WORLD_ID));
  const projectBase = `${apiBaseUrl}/projects/${projectId}`;
  const worldBase = `${projectBase}/worlds/${worldId}`;
  const hints = input.routeHints as Partial<ChunkApiRouteHints>;

  return {
    status: safeString(hints.status, `${apiBaseUrl}/_status`),
    connectionTest: safeString(hints.connectionTest, `${apiBaseUrl}/_test/connection`),
    projects: safeString(hints.projects, `${apiBaseUrl}/projects`),
    project: safeString(hints.project, projectBase),
    projectBootstrap: safeString(hints.projectBootstrap, `${projectBase}/bootstrap`),
    worlds: safeString(hints.worlds, `${projectBase}/worlds`),
    world: safeString(hints.world, worldBase),

    blocks: safeString(hints.blocks, `${worldBase}/blocks`),
    placeableBlocks: safeString(hints.placeableBlocks, buildChunkApiPlaceableBlocksRoute(apiBaseUrl)),

    editorInventory: safeString(hints.editorInventory, CHUNK_API_EDITOR_INVENTORY_ROUTE),
    editorInventoryHealth: safeString(hints.editorInventoryHealth, CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE),
    editorInventoryMetadata: safeString(hints.editorInventoryMetadata, CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE),

    creativeLibrary: safeString(hints.creativeLibrary, CHUNK_API_CREATIVE_LIBRARY_ROUTE),
    creativeLibraryHealth: safeString(hints.creativeLibraryHealth, CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE),
    creativeLibraryMetadata: safeString(hints.creativeLibraryMetadata, CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE),

    chunk: safeString(hints.chunk, `${worldBase}/chunks`),
    chunksBatch: safeString(hints.chunksBatch, `${worldBase}/chunks/batch`),
    commands: safeString(hints.commands, `${worldBase}/commands`),
  };
}

export function normalizeChunkApiClientConfig(config: EditorChunkServiceConfig): ChunkApiClientConfig {
  const apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl);
  const browserBaseUrl = normalizeBaseUrl(config.browserBaseUrl || apiBaseUrl, apiBaseUrl);
  const projectId = normalizeId(config.projectId, CHUNK_API_DEFAULT_PROJECT_ID);
  const worldId = normalizeId(config.worldId, CHUNK_API_DEFAULT_WORLD_ID);

  return {
    apiBaseUrl,
    browserBaseUrl,
    projectId,
    worldId,
    sourceKind: safeString(config.sourceKind, "vectoplan-chunk"),
    mode: safeString(config.mode, "editor-proxy"),
    preferBatchLoad: safeBoolean(config.preferBatchLoad, true),
    reloadDirtyChunksAfterCommand: safeBoolean(config.reloadDirtyChunksAfterCommand, true),
    maxBatchChunks: safeInteger(config.maxBatchChunks, 256, 1, 2048),
    routeHints: normalizeChunkApiRouteHints({
      routeHints: config.routeHints,
      apiBaseUrl,
      projectId,
      worldId,
    }),
    timeouts: {
      statusMs: safeInteger(config.timeouts?.statusMs, CHUNK_API_DEFAULT_TIMEOUTS.statusMs, 250, 120_000),
      requestMs: safeInteger(config.timeouts?.requestMs, CHUNK_API_DEFAULT_TIMEOUTS.requestMs, 250, 120_000),
      blocksMs: safeInteger(config.timeouts?.blocksMs, CHUNK_API_DEFAULT_TIMEOUTS.blocksMs, 250, 120_000),
      inventoryMs: safeInteger(config.timeouts?.inventoryMs, CHUNK_API_DEFAULT_TIMEOUTS.inventoryMs, 250, 120_000),
      libraryMs: safeInteger(config.timeouts?.libraryMs, CHUNK_API_DEFAULT_TIMEOUTS.libraryMs, 250, 120_000),
      chunkMs: safeInteger(config.timeouts?.chunkMs, CHUNK_API_DEFAULT_TIMEOUTS.chunkMs, 250, 120_000),
      batchMs: safeInteger(config.timeouts?.batchMs, CHUNK_API_DEFAULT_TIMEOUTS.batchMs, 250, 120_000),
      commandMs: safeInteger(config.timeouts?.commandMs, CHUNK_API_DEFAULT_TIMEOUTS.commandMs, 250, 120_000),
    },
  };
}

export function buildChunkApiChunkRoute(
  config: Pick<ChunkApiClientConfig, "routeHints">,
  coordinates: ChunkApiChunkCoordinates,
): string {
  try {
    const normalized = normalizeChunkApiCoordinates(coordinates);
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost";
    const url = new URL(config.routeHints.chunk, origin);

    url.searchParams.set("chunkX", String(normalized.chunkX));
    url.searchParams.set("chunkY", String(normalized.chunkY));
    url.searchParams.set("chunkZ", String(normalized.chunkZ));

    return url.pathname + url.search;
  } catch {
    const normalized = normalizeChunkApiCoordinates(coordinates);
    return `${config.routeHints.chunk}?chunkX=${normalized.chunkX}&chunkY=${normalized.chunkY}&chunkZ=${normalized.chunkZ}`;
  }
}

export function buildPlaceableBlocksPlaceholderResponse(input: {
  readonly projectId: string;
  readonly worldId: string;
  readonly blocks?: readonly ChunkApiPlaceableBlockDefinition[];
}): ChunkApiPlaceableBlocksPlaceholderResponse {
  const blocks = (input.blocks ?? CHUNK_API_DEFAULT_PLACEABLE_BLOCKS)
    .filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId));

  return {
    ok: true,
    responseVersion: CHUNK_API_PLACEABLE_BLOCKS_RESPONSE_VERSION,
    source: "editor-placeholder",
    projectId: normalizeId(input.projectId, CHUNK_API_DEFAULT_PROJECT_ID),
    worldId: normalizeId(input.worldId, CHUNK_API_DEFAULT_WORLD_ID),
    registryId: CHUNK_API_DEFAULT_REGISTRY_ID,
    registryVersion: CHUNK_API_DEFAULT_REGISTRY_VERSION,
    blocks,
    metadata: {
      routeSource: "vectoplan-editor",
      note: "Legacy diagnostic placeholder. Productive inventory is served by /editor/api/inventory.",
      legacyDiagnosticOnly: true,
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    },
  };
}

export function selectChunkApiInventoryBlocks(
  result: ChunkApiBlocksResult,
): readonly ChunkApiPlaceableBlockDefinition[] {
  try {
    if (result.placeableBlocks.length > 0) {
      return result.placeableBlocks.filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId));
    }

    return result.blocks
      .map((block) => toPlaceableBlock(block))
      .filter((block): block is ChunkApiPlaceableBlockDefinition => block !== null);
  } catch {
    return [];
  }
}

export function selectChunkApiCreativeLibraryBlocks(
  result: ChunkApiBlocksResult,
): readonly ChunkApiBlockDefinition[] {
  try {
    if (result.blocks.length > 0) {
      return result.blocks.filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId));
    }

    return result.placeableBlocks.filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId));
  } catch {
    return [];
  }
}

export function normalizeChunkApiBlocksResult(input: {
  readonly raw: unknown;
  readonly request?: ChunkApiRequestMeta | null;
  readonly source?: ChunkApiResponseSource;
  readonly projectId: string;
  readonly worldId: string;
  readonly fallbackBlocks?: readonly ChunkApiBlockDefinition[];
  readonly fallbackPlaceableBlocks?: readonly ChunkApiPlaceableBlockDefinition[];
  readonly sourceKind?: ChunkApiBlockSource;
  readonly usedPaletteFallback?: boolean;
}): ChunkApiBlocksResult {
  const rawRecord = asRecord(input.raw);
  const projectId = normalizeId(rawRecord?.projectId ?? input.projectId, CHUNK_API_DEFAULT_PROJECT_ID);
  const worldId = normalizeId(rawRecord?.worldId ?? input.worldId, CHUNK_API_DEFAULT_WORLD_ID);
  const registryId = safeString(rawRecord?.registryId, CHUNK_API_DEFAULT_REGISTRY_ID);
  const registryVersion = safeString(rawRecord?.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION);
  const sourceKind = normalizeBlockSource(rawRecord?.sourceKind ?? input.sourceKind, "chunk-service-blocks-route");

  const rawBlocks = rawRecord?.blocks;
  const rawPlaceableBlocks = rawRecord?.placeableBlocks ?? rawRecord?.inventoryBlocks ?? rawRecord?.inventory;

  const blocks = normalizeBlockDefinitions(rawBlocks, {
    registryId,
    registryVersion,
    source: "chunk-service-creative-library-route",
  });
  const placeableBlocks = normalizePlaceableBlockDefinitions(rawPlaceableBlocks, {
    registryId,
    registryVersion,
    source: "chunk-service-placeable-blocks-route",
  });

  const fallbackBlocks = uniqueBlockDefinitions(input.fallbackBlocks ?? []);
  const fallbackPlaceableBlocks = (input.fallbackPlaceableBlocks ?? CHUNK_API_DEFAULT_PLACEABLE_BLOCKS)
    .filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId));

  const finalBlocks = uniqueBlockDefinitions(
    blocks.length > 0
      ? blocks
      : placeableBlocks.length > 0
        ? placeableBlocks
        : fallbackBlocks.length > 0
          ? fallbackBlocks
          : fallbackPlaceableBlocks,
  );

  const finalPlaceableBlocks = placeableBlocks.length > 0
    ? placeableBlocks
    : finalBlocks
        .map((block) => toPlaceableBlock(block))
        .filter((block): block is ChunkApiPlaceableBlockDefinition => block !== null);

  return {
    ok: true,
    request: input.request ?? null,
    source: inferResponseSource(input.source, "editor-proxy"),
    raw: {
      originalRaw: input.raw,
      legacyDiagnosticOnly: true,
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
      forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    },
    error: null,
    projectId,
    worldId,
    registryId,
    registryVersion,
    blocks: finalBlocks,
    placeableBlocks: finalPlaceableBlocks,
    sourceKind,
    usedPaletteFallback: safeBoolean(rawRecord?.usedPaletteFallback, input.usedPaletteFallback ?? false),
    collectionKind: "combined",
    inventoryRouteKind: "placeable-blocks",
    creativeLibraryRouteKind: "blocks",
    inventoryBlockCount: finalPlaceableBlocks.length,
    creativeLibraryBlockCount: finalBlocks.length,
  };
}

export function normalizeChunkApiPlaceableBlocksResult(input: {
  readonly raw: unknown;
  readonly request?: ChunkApiRequestMeta | null;
  readonly source?: ChunkApiResponseSource;
  readonly projectId: string;
  readonly worldId: string;
  readonly fallbackBlocks?: readonly ChunkApiPlaceableBlockDefinition[];
}): ChunkApiPlaceableBlocksResult {
  const rawRecord = asRecord(input.raw);
  const registryId = safeString(rawRecord?.registryId, CHUNK_API_DEFAULT_REGISTRY_ID);
  const registryVersion = safeString(rawRecord?.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION);
  const rawBlocks = rawRecord?.placeableBlocks ?? rawRecord?.blocks ?? rawRecord?.inventoryBlocks ?? rawRecord?.inventory;

  const placeableBlocks = normalizePlaceableBlockDefinitions(rawBlocks, {
    registryId,
    registryVersion,
    source: "chunk-service-placeable-blocks-route",
  });
  const fallbackBlocks = (input.fallbackBlocks ?? CHUNK_API_DEFAULT_PLACEABLE_BLOCKS)
    .filter((block) => !isForbiddenDebugBlockTypeId(block.blockTypeId));
  const finalPlaceableBlocks = placeableBlocks.length > 0 ? placeableBlocks : fallbackBlocks;

  return {
    ok: true,
    request: input.request ?? null,
    source: inferResponseSource(input.source, "editor-placeholder"),
    raw: {
      originalRaw: input.raw,
      legacyDiagnosticOnly: true,
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
      forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    },
    error: null,
    projectId: normalizeId(rawRecord?.projectId ?? input.projectId, CHUNK_API_DEFAULT_PROJECT_ID),
    worldId: normalizeId(rawRecord?.worldId ?? input.worldId, CHUNK_API_DEFAULT_WORLD_ID),
    registryId,
    registryVersion,
    blocks: finalPlaceableBlocks,
    placeableBlocks: finalPlaceableBlocks,
    sourceKind: "chunk-service-placeable-blocks-route",
    usedPaletteFallback: false,
    collectionKind: "inventory",
    inventoryRouteKind: "placeable-blocks",
    creativeLibraryRouteKind: "blocks",
    inventoryBlockCount: finalPlaceableBlocks.length,
    creativeLibraryBlockCount: finalPlaceableBlocks.length,
  };
}

export function getChunkApiModelsMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.api.chunk_api_models",
    clientKind: CHUNK_API_CLIENT_KIND,
    productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    editorInventoryHealthRoute: CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE,
    editorInventoryMetadataRoute: CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE,
    creativeLibraryRoute: CHUNK_API_CREATIVE_LIBRARY_ROUTE,
    defaultPlaceableBlocksCount: CHUNK_API_DEFAULT_PLACEABLE_BLOCKS.length,
    forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      defaultDebugGrassDirtRemoved: true,
      loadBlocksIsLegacyDiagnosticOnly: true,
      loadPlaceableBlocksIsLegacyDiagnosticOnly: true,
      sendSetBlockBlockTypeIdMeansRuntimeBlockTypeId: true,
      legacyCatalogValidationIsOptIn: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
    },
  };
}
