// services/vectoplan-editor/src/frontend/bootstrap/normalize_bootstrap.ts
import {
  buildDefaultChunkRouteHints,
  buildDefaultChunkWorldMetadata,
  buildDefaultChunkServiceConfig,
  buildDefaultCreativeLibraryBootstrap,
  buildDefaultInventoryBootstrap,
  buildDefaultPhysicsBootstrap,
  buildDefaultRuntimeInventoryConfig,
  buildDefaultRuntimeLibraryConfig,
  DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK,
  DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
  DEFAULT_CAMERA_FAR,
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_MOVE_SPEED,
  DEFAULT_CAMERA_NEAR,
  DEFAULT_CAMERA_ROTATION,
  DEFAULT_CAMERA_SPAWN,
  DEFAULT_CAMERA_SPRINT_MULTIPLIER,
  DEFAULT_CHUNK_PROXY_BASE_URL,
  DEFAULT_CHUNK_SERVICE_MAX_BATCH_CHUNKS,
  DEFAULT_CHUNK_SERVICE_MODE,
  DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
  DEFAULT_CHUNK_SERVICE_TIMEOUTS,
  DEFAULT_CROSSHAIR_ENABLED,
  DEFAULT_CREATIVE_LIBRARY_API_URL,
  DEFAULT_CREATIVE_LIBRARY_ENABLED,
  DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
  DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
  DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
  DEFAULT_DEBUG_GRASS_DIRT_ALLOWED,
  DEFAULT_DEBUG_OVERLAY_ENABLED,
  DEFAULT_EDITOR_FRONTEND_ROOT,
  DEFAULT_EDITOR_INVENTORY_API_URL,
  DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
  DEFAULT_EDITOR_INVENTORY_METADATA_URL,
  DEFAULT_EDITOR_RUNTIME_MODE,
  DEFAULT_EDITOR_SERVICE_NAME,
  DEFAULT_EDITOR_TEMPLATE_MODE,
  DEFAULT_EDITOR_WORLD_MODE,
  DEFAULT_EDITOR_WORLD_SOURCE_MODE,
  DEFAULT_ERROR_PANEL_ENABLED,
  DEFAULT_FALLBACK_BLOCK_TYPE_IDS,
  DEFAULT_FIRST_PERSON_ENABLED,
  DEFAULT_FLIGHT_MODE_ENABLED,
  DEFAULT_HOTBAR_ENABLED,
  DEFAULT_INPUT_SENSITIVITY,
  DEFAULT_INVENTORY_CACHE_TTL_MS,
  DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
  DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
  DEFAULT_INVENTORY_ITEM_KIND,
  DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
  DEFAULT_INVENTORY_ROUTE_KIND,
  DEFAULT_INVENTORY_SLOT_COUNT,
  DEFAULT_INVENTORY_SOURCE_KIND,
  DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
  DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
  DEFAULT_LOADING_OVERLAY_ENABLED,
  DEFAULT_MAX_CHUNKS_PER_RENDER_SYNC,
  DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
  DEFAULT_PHYSICS_AIR_CONTROL_SPEED,
  DEFAULT_PHYSICS_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE,
  DEFAULT_PHYSICS_BLOCK_HORIZONTAL_MOVEMENT_ON_MISSING_CHUNK,
  DEFAULT_PHYSICS_BLOCK_VERTICAL_MOVEMENT_ON_MISSING_CHUNK,
  DEFAULT_PHYSICS_DEBUG_EXPOSE_TO_STORE,
  DEFAULT_PHYSICS_DEBUG_INCLUDE_COLLISION_CELLS,
  DEFAULT_PHYSICS_DOUBLE_TAP_WINDOW_MS,
  DEFAULT_PHYSICS_ENABLED,
  DEFAULT_PHYSICS_FIXED_TIME_STEP_SECONDS,
  DEFAULT_PHYSICS_FLY_SPEED,
  DEFAULT_PHYSICS_FLY_SPRINT_SPEED,
  DEFAULT_PHYSICS_GRAVITY,
  DEFAULT_PHYSICS_GROUND_SNAP_DISTANCE,
  DEFAULT_PHYSICS_JUMP_VELOCITY,
  DEFAULT_PHYSICS_MAX_FALL_SPEED,
  DEFAULT_PHYSICS_MAX_FRAME_DELTA_SECONDS,
  DEFAULT_PHYSICS_MAX_SUB_STEPS,
  DEFAULT_PHYSICS_MISSING_CHUNK_POLICY,
  DEFAULT_PHYSICS_MODE,
  DEFAULT_PHYSICS_PLAYER_EYE_HEIGHT,
  DEFAULT_PHYSICS_PLAYER_HEIGHT,
  DEFAULT_PHYSICS_PLAYER_SKIN_WIDTH,
  DEFAULT_PHYSICS_PLAYER_WIDTH,
  DEFAULT_PHYSICS_SPRINT_SPEED,
  DEFAULT_PHYSICS_WALK_SPEED,
  DEFAULT_PLAYER_COLLISION_ENABLED,
  DEFAULT_POINTER_LOCK_ENABLED,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROVIDER_ID,
  DEFAULT_PROVIDER_WORLD_ID,
  DEFAULT_RENDER_CLEAR_COLOR,
  DEFAULT_STATUS_BAR_ENABLED,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_UNIVERSE_ID,
  DEFAULT_VISIBLE_CHUNK_RADIUS,
  DEFAULT_WORLD_ID,
  EDITOR_BOOTSTRAP_SCHEMA_VERSION,
  normalizeRouteForModel,
  type EditorAppBootstrap,
  type EditorBootstrap,
  type EditorBootstrapDiagnostics,
  type EditorBootstrapLogger,
  type EditorBootstrapNormalizeOptions,
  type EditorCameraBootstrap,
  type EditorChunkServiceConfig,
  type EditorChunkServiceConnectionState,
  type EditorChunkServiceRouteHints,
  type EditorChunkServiceTimeouts,
  type EditorChunkWorldMetadata,
  type EditorCreativeLibraryBootstrap,
  type EditorFeatureFlags,
  type EditorInputBootstrap,
  type EditorInventoryBootstrap,
  type EditorInventoryItemKind,
  type EditorInventorySourceKind,
  type EditorJsonArray,
  type EditorJsonObject,
  type EditorJsonPrimitive,
  type EditorJsonValue,
  type EditorPhysicsBootstrap,
  type EditorPhysicsMissingChunkPolicy,
  type EditorProjectBootstrap,
  type EditorRawBootstrapSources,
  type EditorRenderBootstrap,
  type EditorRuntimeConfig,
  type EditorRuntimeInventoryConfig,
  type EditorRuntimeLibraryConfig,
  type EditorUiBootstrap,
  type UnknownRecord,
} from "./bootstrap_models";
import { createDefaultEditorBootstrap } from "./default_bootstrap";
import {
  canonicalChunkIdentityToRecord,
  chunkIdentityIssuesToWarnings,
  isLikelyAppProjectId,
  isValidChunkProjectId,
  isValidConcreteChunkWorldId,
  resolveChunkIdentity,
  type CanonicalChunkIdentity,
} from "../utils/chunk_identity_contract";
import {
  editorChunkProxyUrlIssuesToWarnings,
  editorChunkProxyUrlResultToRecord,
  normalizeEditorChunkProxyBaseUrl,
  resolveEditorChunkProxyBaseUrl,
} from "../utils/editor_chunk_proxy_url";

interface NormalizeContext {
  readonly logger?: EditorBootstrapLogger;
  readonly warnings: string[];
}

interface NormalizedSourceBundle {
  readonly sourceKind: EditorBootstrapDiagnostics["source"];
  readonly raw: unknown;
  readonly windowBootstrap: UnknownRecord | null;
  readonly fallbackBootstrap: UnknownRecord | null;
  readonly windowChunkGlobals: UnknownRecord;
  readonly windowInventoryGlobals: UnknownRecord;
  readonly windowLibraryGlobals: UnknownRecord;
  readonly windowPhysicsGlobals: UnknownRecord;
  readonly datasetChunkGlobals: UnknownRecord;
  readonly datasetInventoryGlobals: UnknownRecord;
  readonly datasetPhysicsGlobals: UnknownRecord;
  readonly datasetRaw: DOMStringMap;
}

export type EditorChunkWorldMetadataWithProject = EditorChunkWorldMetadata & {
  readonly projectId: string;
  readonly worldId: string;
};

type NormalizedChunkIdentity = {
  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;

  /**
   * Runtime project id for chunk requests. Must be chk_prj_... or an allowed
   * dev chunk project id. It must never be app prj_...
   */
  readonly projectId: string;
  readonly chunkProjectId: string;

  readonly appProjectPublicId: string | null;
  readonly projectPublicId: string | null;

  readonly universeId: string | null;
  readonly chunkUniverseId: string | null;

  /**
   * Runtime concrete chunk world id. Normally world_spawn.
   */
  readonly worldId: string;
  readonly chunkWorldId: string;

  readonly status: "ready" | "pending" | "error" | "disabled" | "invalid" | string;
  readonly ready: boolean;
  readonly valid: boolean;
  readonly degraded: boolean;

  readonly identityWarnings: readonly string[];
  readonly identityDiagnostics: Record<string, unknown>;
  readonly proxyDiagnostics: Record<string, unknown>;
  readonly contractIdentity: CanonicalChunkIdentity;
};

const MAX_DEBUG_JSON_DEPTH = 8;
const FORBIDDEN_DEBUG_BLOCK_TYPE_IDS = new Set<string>(["debug_grass", "debug_dirt"]);

const CRITICAL_CHUNK_ROUTE_HINT_KEYS = new Set<string>([
  "project",
  "projectBootstrap",
  "worlds",
  "world",
  "blocks",
  "chunk",
  "chunks",
  "chunksBatch",
  "commands",
]);

function logDebug(
  context: NormalizeContext,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    context.logger?.debug?.(message, details);
  } catch {
    // Logging must never break bootstrap normalization.
  }
}

function logWarn(
  context: NormalizeContext,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    context.warnings.push(message);
  } catch {
    // Ignore.
  }

  try {
    context.logger?.warn?.(message, details);
  } catch {
    // Logging must never break bootstrap normalization.
  }
}

function logError(
  context: NormalizeContext,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    context.warnings.push(message);
  } catch {
    // Ignore.
  }

  try {
    context.logger?.error?.(message, details);
  } catch {
    // Logging must never break bootstrap normalization.
  }
}

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function isRawBootstrapSources(value: unknown): value is EditorRawBootstrapSources {
  try {
    if (!isRecord(value)) {
      return false;
    }

    return (
      "windowBootstrap" in value
      || "windowChunkGlobals" in value
      || "windowInventoryGlobals" in value
      || "windowLibraryGlobals" in value
      || "windowPhysicsGlobals" in value
      || "datasetChunkGlobals" in value
      || "datasetInventoryGlobals" in value
      || "datasetPhysicsGlobals" in value
      || "datasetRaw" in value
      || "fallback" in value
    );
  } catch {
    return false;
  }
}

function safeJsonParse(value: unknown): unknown {
  try {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  try {
    const parsed = safeJsonParse(value);

    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asDomStringMap(value: unknown): DOMStringMap {
  try {
    if (!isRecord(value)) {
      return {} as DOMStringMap;
    }

    const output: Record<string, string> = {};

    for (const [key, rawValue] of Object.entries(value)) {
      if (typeof rawValue === "string") {
        output[key] = rawValue;
      }
    }

    return output as DOMStringMap;
  } catch {
    return {} as DOMStringMap;
  }
}

function readPath(root: unknown, path: readonly (string | number)[]): unknown {
  try {
    let current = root;

    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof segment === "number") {
        if (!Array.isArray(current)) {
          return undefined;
        }

        current = current[segment];
        continue;
      }

      if (!isRecord(current)) {
        return undefined;
      }

      current = current[segment];
    }

    return current;
  } catch {
    return undefined;
  }
}

function readFirst(values: readonly unknown[]): unknown {
  try {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function readString(value: unknown, fallback: string): string {
  try {
    if (typeof value !== "string") {
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
      }

      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function readNullableString(value: unknown, fallback: string | null): string | null {
  try {
    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        const converted = String(value).trim();
        return converted.length > 0 ? converted : fallback;
      }

      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value === 1) return true;
      if (value === 0) return false;
      return Boolean(value);
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

function readNumber(
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

function readInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value.trim(), 10)
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.trunc(numeric)));
  } catch {
    return fallback;
  }
}

function readTimeoutMs(value: unknown, fallback: number): number {
  try {
    const numeric = readNumber(value, Number.NaN, 0, 120_000);

    if (!Number.isFinite(numeric) || numeric <= 0) {
      return fallback;
    }

    if (numeric <= 300) {
      return Math.round(numeric * 1_000);
    }

    return Math.round(numeric);
  } catch {
    return fallback;
  }
}

function readStringArray(value: unknown, fallback: readonly string[]): readonly string[] {
  try {
    const parsed = safeJsonParse(value);

    if (Array.isArray(parsed)) {
      const result = parsed
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .filter((item) => !FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.has(item));

      return result.length > 0 ? result : fallback;
    }

    if (typeof value === "string" && value.includes(",")) {
      const result = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .filter((item) => !FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.has(item));

      return result.length > 0 ? result : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function sanitizeEditorChunkProxyBaseUrl(
  value: unknown,
  fallback: string,
  context?: NormalizeContext,
): string {
  try {
    const result = resolveEditorChunkProxyBaseUrl(value, {
      defaultBaseUrl: fallback,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
    });

    if (context) {
      for (const warning of editorChunkProxyUrlIssuesToWarnings(result.issues)) {
        logWarn(context, "Editor chunk proxy URL was normalized.", {
          warning,
          raw: result.raw,
          normalized: result.baseUrl,
        });
      }
    }

    return result.baseUrl;
  } catch (error) {
    if (context) {
      logWarn(context, "Editor chunk proxy URL could not be normalized. Default editor proxy was used.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return normalizeEditorChunkProxyBaseUrl(fallback, {
      defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
    });
  }
}

function sanitizeRoute(value: unknown, fallback: string): string {
  try {
    return normalizeRouteForModel(value, fallback);
  } catch {
    return fallback;
  }
}

function sanitizeIdentifier(value: unknown, fallback: string): string {
  try {
    const raw = readString(value, fallback);
    const normalized = raw.replace(/[^a-zA-Z0-9_.:-]/g, "").trim();

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeProjectOrWorldId(value: unknown, fallback: string): string {
  return sanitizeIdentifier(value, fallback);
}

function isValidRuntimeChunkProjectId(value: unknown): boolean {
  try {
    return isValidChunkProjectId(value, {
      allowDevProjectId: true,
      devChunkProjectIds: [DEFAULT_PROJECT_ID],
      allowUnprefixedChunkProjectId: false,
    });
  } catch {
    return false;
  }
}

function isValidRuntimeChunkWorldId(value: unknown): boolean {
  try {
    return isValidConcreteChunkWorldId(value, {
      defaultWorldId: DEFAULT_WORLD_ID,
      failOnProviderLikeWorldId: false,
    });
  } catch {
    return false;
  }
}

function selectChunkProjectIdCandidate(values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const text = readString(value, "");

      if (!text) {
        continue;
      }

      if (isValidRuntimeChunkProjectId(text)) {
        return text;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function selectChunkWorldIdCandidate(values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const text = readString(value, "");

      if (!text) {
        continue;
      }

      if (isValidRuntimeChunkWorldId(text)) {
        return text;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function selectAppProjectPublicIdCandidate(values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const text = readString(value, "");

      if (text && isLikelyAppProjectId(text)) {
        return text;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function normalizeConnectionState(value: unknown): EditorChunkServiceConnectionState {
  const normalized = readString(value, "unknown");

  if (
    normalized === "unknown"
    || normalized === "disabled"
    || normalized === "connecting"
    || normalized === "ready"
    || normalized === "degraded"
    || normalized === "failed"
  ) {
    return normalized;
  }

  return "unknown";
}

function normalizeChunkStatus(value: unknown, fallback = "pending"): "ready" | "pending" | "error" | "disabled" | "invalid" | string {
  try {
    const normalized = readString(value, "").toLowerCase().replace(/[-\s]+/g, "_");

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

function normalizeInventorySourceKind(value: unknown, fallback: EditorInventorySourceKind): EditorInventorySourceKind {
  const normalized = readString(value, fallback);

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

  return fallback;
}

function normalizeInventoryItemKind(value: unknown, fallback: EditorInventoryItemKind): EditorInventoryItemKind {
  const normalized = readString(value, fallback);

  if (
    normalized === "vplib"
    || normalized === "library-item"
    || normalized === "block"
    || normalized === "asset"
    || normalized === "empty"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizePhysicsMissingChunkPolicy(value: unknown): EditorPhysicsMissingChunkPolicy {
  const normalized = readString(value, DEFAULT_PHYSICS_MISSING_CHUNK_POLICY);

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

function mergeRecordValues(...values: readonly unknown[]): UnknownRecord {
  const output: Record<string, unknown> = {};

  try {
    for (const value of values) {
      const record = asRecord(value);

      if (!record) {
        continue;
      }

      for (const [key, nestedValue] of Object.entries(record)) {
        if (nestedValue !== undefined && nestedValue !== null) {
          output[key] = nestedValue;
        }
      }
    }
  } catch {
    return output;
  }

  return output;
}

function mergeNestedRecordValues(...values: readonly unknown[]): UnknownRecord {
  let output: Record<string, unknown> = {};

  try {
    for (const value of values) {
      const record = asRecord(value);

      if (!record) {
        continue;
      }

      output = mergeNestedRecords(output, record);
    }
  } catch {
    return output;
  }

  return output;
}

function mergeNestedRecords(base: UnknownRecord, patch: UnknownRecord): Record<string, unknown> {
  const output: Record<string, unknown> = {
    ...base,
  };

  try {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null) {
        continue;
      }

      const previous = output[key];

      if (isRecord(previous) && isRecord(value)) {
        output[key] = mergeNestedRecords(previous, value);
      } else {
        output[key] = value;
      }
    }
  } catch {
    return output;
  }

  return output;
}

function routeHintContainsAppProjectId(value: unknown): boolean {
  try {
    const text = readString(value, "");

    return /\/projects\/prj_[^/]+/i.test(text) && !/\/projects\/chk_prj_/i.test(text);
  } catch {
    return false;
  }
}

function sanitizeCriticalRouteHints(
  value: unknown,
  context: NormalizeContext,
  source: string,
): UnknownRecord {
  const raw = asRecord(value) ?? {};
  const output: Record<string, unknown> = {};

  try {
    for (const [key, routeValue] of Object.entries(raw)) {
      if (CRITICAL_CHUNK_ROUTE_HINT_KEYS.has(key) && routeHintContainsAppProjectId(routeValue)) {
        logWarn(context, "Critical chunk route hint with app project id was ignored.", {
          source,
          key,
          routeValue,
          expectedProjectIdPrefix: "chk_prj_",
        });
        continue;
      }

      output[key] = routeValue;
    }

    return output;
  } catch {
    return raw;
  }
}

function normalizeOptions(options: EditorBootstrapNormalizeOptions): EditorBootstrapNormalizeOptions {
  const chunkProxyBaseUrl = sanitizeEditorChunkProxyBaseUrl(
    options.chunkProxyBaseUrl,
    DEFAULT_CHUNK_PROXY_BASE_URL,
  );
  const projectId = selectChunkProjectIdCandidate([options.projectId]) || DEFAULT_PROJECT_ID;
  const worldId = selectChunkWorldIdCandidate([options.worldId]) || DEFAULT_WORLD_ID;

  const normalized: EditorBootstrapNormalizeOptions = {
    buildMode: readString(options.buildMode, "development"),
    buildVersion: readString(options.buildVersion, "0.1.0"),
    chunkProxyBaseUrl,
    projectId,
    worldId,
    localWorldFallbackEnabled: false,
  };

  if (options.logger !== undefined) {
    return {
      ...normalized,
      logger: options.logger,
    };
  }

  return normalized;
}

function buildFallbackBundle(
  rawInput: unknown,
  options: EditorBootstrapNormalizeOptions,
): NormalizedSourceBundle {
  const fallbackBootstrap = createDefaultEditorBootstrap({
    buildMode: options.buildMode,
    buildVersion: options.buildVersion,
    chunkProxyBaseUrl: options.chunkProxyBaseUrl,
    projectId: options.projectId,
    worldId: options.worldId,
    localWorldFallbackEnabled: false,
  });

  return {
    sourceKind: isRecord(rawInput) ? "window" : "fallback",
    raw: rawInput,
    windowBootstrap: asRecord(rawInput),
    fallbackBootstrap: asRecord(fallbackBootstrap),
    windowChunkGlobals: {},
    windowInventoryGlobals: {},
    windowLibraryGlobals: {},
    windowPhysicsGlobals: {},
    datasetChunkGlobals: {},
    datasetInventoryGlobals: {},
    datasetPhysicsGlobals: {},
    datasetRaw: {} as DOMStringMap,
  };
}

function buildSourceBundle(
  rawInput: unknown,
  options: EditorBootstrapNormalizeOptions,
): NormalizedSourceBundle {
  try {
    if (!isRawBootstrapSources(rawInput)) {
      return buildFallbackBundle(rawInput, options);
    }

    const windowBootstrap = asRecord(rawInput.windowBootstrap);
    const fallbackBootstrap = asRecord(rawInput.fallback);

    return {
      sourceKind: windowBootstrap ? "merged" : "fallback",
      raw: rawInput,
      windowBootstrap,
      fallbackBootstrap,
      windowChunkGlobals: asRecord(rawInput.windowChunkGlobals) ?? {},
      windowInventoryGlobals: asRecord(rawInput.windowInventoryGlobals) ?? {},
      windowLibraryGlobals: asRecord(rawInput.windowLibraryGlobals) ?? {},
      windowPhysicsGlobals: asRecord(rawInput.windowPhysicsGlobals) ?? {},
      datasetChunkGlobals: asRecord(rawInput.datasetChunkGlobals) ?? {},
      datasetInventoryGlobals: asRecord(rawInput.datasetInventoryGlobals) ?? {},
      datasetPhysicsGlobals: asRecord(rawInput.datasetPhysicsGlobals) ?? {},
      datasetRaw: asDomStringMap(rawInput.datasetRaw),
    };
  } catch {
    return buildFallbackBundle(rawInput, options);
  }
}

function shouldSuppressChunkProjectFallback(input: {
  readonly chunkProjectId?: unknown;
  readonly projectId?: unknown;
  readonly appProjectPublicId?: unknown;
  readonly projectPublicId?: unknown;
  readonly optionProjectId?: unknown;
}): boolean {
  try {
    const explicitChunkProjectId = selectChunkProjectIdCandidate([
      input.chunkProjectId,
      input.projectId,
    ]);

    if (explicitChunkProjectId) {
      return false;
    }

    return Boolean(
      isLikelyAppProjectId(input.projectId)
      || isLikelyAppProjectId(input.optionProjectId)
      || selectAppProjectPublicIdCandidate([
        input.appProjectPublicId,
        input.projectPublicId,
      ]),
    );
  } catch {
    return false;
  }
}

function normalizeChunkIdentity(
  bundle: NormalizedSourceBundle,
  options: EditorBootstrapNormalizeOptions,
  rawServiceConfig: UnknownRecord,
  fallback: EditorChunkServiceConfig,
  context: NormalizeContext,
): NormalizedChunkIdentity {
  const apiProxyResult = resolveEditorChunkProxyBaseUrl(
    readFirst([
      readPath(bundle.datasetChunkGlobals, ["apiBaseUrl"]),
      readPath(bundle.datasetRaw, ["chunkServiceApiBaseUrl"]),
      readPath(bundle.datasetRaw, ["chunkApiBaseUrl"]),
      readPath(bundle.datasetRaw, ["chunkProxyBaseUrl"]),
      readPath(bundle.windowChunkGlobals, ["apiBaseUrl"]),
      rawServiceConfig.apiBaseUrl,
      rawServiceConfig.browserBaseUrl,
      options.chunkProxyBaseUrl,
      fallback.apiBaseUrl,
      DEFAULT_CHUNK_PROXY_BASE_URL,
    ]),
    {
      defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
    },
  );

  for (const warning of editorChunkProxyUrlIssuesToWarnings(apiProxyResult.issues)) {
    logWarn(context, "Chunk apiBaseUrl was normalized.", {
      warning,
      raw: apiProxyResult.raw,
      normalized: apiProxyResult.baseUrl,
    });
  }

  const apiBaseUrl = apiProxyResult.baseUrl;

  const browserProxyResult = resolveEditorChunkProxyBaseUrl(
    readFirst([
      readPath(bundle.datasetChunkGlobals, ["browserBaseUrl"]),
      readPath(bundle.datasetRaw, ["chunkServiceBrowserBaseUrl"]),
      readPath(bundle.datasetRaw, ["chunkBrowserBaseUrl"]),
      readPath(bundle.windowChunkGlobals, ["browserBaseUrl"]),
      rawServiceConfig.browserBaseUrl,
      rawServiceConfig.apiBaseUrl,
      apiBaseUrl,
    ]),
    {
      defaultBaseUrl: apiBaseUrl,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
    },
  );

  for (const warning of editorChunkProxyUrlIssuesToWarnings(browserProxyResult.issues)) {
    logWarn(context, "Chunk browserBaseUrl was normalized.", {
      warning,
      raw: browserProxyResult.raw,
      normalized: browserProxyResult.baseUrl,
    });
  }

  const browserBaseUrl = browserProxyResult.baseUrl;

  const chunkProjectCandidate = readFirst([
    readPath(bundle.datasetChunkGlobals, ["chunkProjectId"]),
    readPath(bundle.datasetRaw, ["chunkProjectId"]),
    readPath(bundle.datasetRaw, ["chunkServiceProjectId"]),
    readPath(bundle.windowChunkGlobals, ["chunkProjectId"]),
    rawServiceConfig.chunkProjectId,
    readPath(bundle.windowBootstrap, ["runtime", "chunk", "chunkProjectId"]),
    readPath(bundle.windowBootstrap, ["chunk", "chunkProjectId"]),
    readPath(bundle.windowBootstrap, ["project", "chunkProjectId"]),
  ]);

  const genericProjectCandidate = readFirst([
    readPath(bundle.datasetChunkGlobals, ["projectId"]),
    readPath(bundle.datasetRaw, ["projectId"]),
    readPath(bundle.datasetRaw, ["runtimeProjectId"]),
    readPath(bundle.windowChunkGlobals, ["projectId"]),
    rawServiceConfig.projectId,
    readPath(bundle.windowBootstrap, ["runtime", "chunk", "projectId"]),
    readPath(bundle.windowBootstrap, ["chunk", "projectId"]),
    readPath(bundle.windowBootstrap, ["project", "projectId"]),
  ]);

  const appProjectCandidate = readFirst([
    readPath(bundle.datasetChunkGlobals, ["appProjectPublicId"]),
    readPath(bundle.datasetChunkGlobals, ["projectPublicId"]),
    readPath(bundle.datasetChunkGlobals, ["rejectedProjectId"]),
    readPath(bundle.datasetRaw, ["appProjectPublicId"]),
    readPath(bundle.datasetRaw, ["projectPublicId"]),
    readPath(bundle.datasetRaw, ["appProjectId"]),
    readPath(bundle.datasetRaw, ["publicId"]),
    readPath(bundle.windowChunkGlobals, ["appProjectPublicId"]),
    readPath(bundle.windowChunkGlobals, ["projectPublicId"]),
    readPath(bundle.windowChunkGlobals, ["rejectedProjectId"]),
    rawServiceConfig.appProjectPublicId,
    rawServiceConfig.projectPublicId,
    rawServiceConfig.rejectedProjectId,
    readPath(bundle.windowBootstrap, ["app", "appProjectPublicId"]),
    readPath(bundle.windowBootstrap, ["app", "projectPublicId"]),
    readPath(bundle.windowBootstrap, ["project", "appProjectPublicId"]),
    readPath(bundle.windowBootstrap, ["project", "projectPublicId"]),
    isLikelyAppProjectId(genericProjectCandidate) ? genericProjectCandidate : undefined,
  ]);

  const suppressFallback = shouldSuppressChunkProjectFallback({
    chunkProjectId: chunkProjectCandidate,
    projectId: genericProjectCandidate,
    appProjectPublicId: appProjectCandidate,
    projectPublicId: appProjectCandidate,
    optionProjectId: options.projectId,
  });

  const chunkWorldCandidate = readFirst([
    readPath(bundle.datasetChunkGlobals, ["chunkWorldId"]),
    readPath(bundle.datasetRaw, ["chunkWorldId"]),
    readPath(bundle.datasetRaw, ["chunkServiceWorldId"]),
    readPath(bundle.windowChunkGlobals, ["chunkWorldId"]),
    rawServiceConfig.chunkWorldId,
    readPath(bundle.windowBootstrap, ["runtime", "chunk", "chunkWorldId"]),
    readPath(bundle.windowBootstrap, ["chunk", "chunkWorldId"]),
    readPath(bundle.windowBootstrap, ["project", "chunkWorldId"]),
  ]);

  const genericWorldCandidate = readFirst([
    readPath(bundle.datasetChunkGlobals, ["worldId"]),
    readPath(bundle.datasetRaw, ["worldId"]),
    readPath(bundle.datasetRaw, ["runtimeWorldId"]),
    readPath(bundle.windowChunkGlobals, ["worldId"]),
    rawServiceConfig.worldId,
    readPath(bundle.windowBootstrap, ["runtime", "chunk", "worldId"]),
    readPath(bundle.windowBootstrap, ["chunk", "worldId"]),
    readPath(bundle.windowBootstrap, ["project", "worldId"]),
    options.worldId,
  ]);

  const requestedStatus = normalizeChunkStatus(
    readFirst([
      readPath(bundle.datasetChunkGlobals, ["chunkStatus"]),
      readPath(bundle.datasetChunkGlobals, ["status"]),
      readPath(bundle.datasetRaw, ["chunkStatus"]),
      readPath(bundle.datasetRaw, ["chunkServiceStatus"]),
      readPath(bundle.datasetRaw, ["chunkContextStatus"]),
      readPath(bundle.windowChunkGlobals, ["chunkStatus"]),
      readPath(bundle.windowChunkGlobals, ["status"]),
      rawServiceConfig.chunkStatus,
      rawServiceConfig.status,
      rawServiceConfig.connectionState,
    ]),
    "pending",
  );

  const identity = resolveChunkIdentity(
    {
      chunkProjectId: chunkProjectCandidate,
      projectId: genericProjectCandidate,
      defaultProjectId: suppressFallback ? undefined : options.projectId,
      appProjectPublicId: appProjectCandidate,
      projectPublicId: appProjectCandidate,
      chunkUniverseId: readFirst([
        readPath(bundle.datasetChunkGlobals, ["chunkUniverseId"]),
        readPath(bundle.datasetRaw, ["chunkUniverseId"]),
        readPath(bundle.datasetRaw, ["chunkServiceUniverseId"]),
        readPath(bundle.windowChunkGlobals, ["chunkUniverseId"]),
        rawServiceConfig.chunkUniverseId,
        readPath(bundle.windowBootstrap, ["runtime", "chunk", "chunkUniverseId"]),
        readPath(bundle.windowBootstrap, ["project", "chunkUniverseId"]),
      ]),
      universeId: readFirst([
        readPath(bundle.datasetChunkGlobals, ["universeId"]),
        readPath(bundle.datasetRaw, ["universeId"]),
        readPath(bundle.windowChunkGlobals, ["universeId"]),
        rawServiceConfig.universeId,
        readPath(bundle.windowBootstrap, ["runtime", "chunk", "universeId"]),
        readPath(bundle.windowBootstrap, ["project", "universeId"]),
      ]),
      chunkWorldId: chunkWorldCandidate,
      worldId: genericWorldCandidate,
      defaultWorldId: options.worldId,
      chunkReady: readFirst([
        readPath(bundle.datasetChunkGlobals, ["chunkReady"]),
        readPath(bundle.datasetChunkGlobals, ["ready"]),
        readPath(bundle.datasetRaw, ["chunkReady"]),
        readPath(bundle.datasetRaw, ["chunkServiceReady"]),
        readPath(bundle.datasetRaw, ["chunkContextReady"]),
        readPath(bundle.windowChunkGlobals, ["chunkReady"]),
        readPath(bundle.windowChunkGlobals, ["ready"]),
        rawServiceConfig.chunkReady,
        rawServiceConfig.ready,
      ]),
      chunkStatus: requestedStatus,
      source: "normalize_bootstrap.normalizeChunkIdentity",
    },
    {
      allowDevProjectId: true,
      devChunkProjectIds: [DEFAULT_PROJECT_ID],
      allowUnprefixedChunkProjectId: false,
      defaultWorldId: DEFAULT_WORLD_ID,
      failOnAppProjectIdAsChunkProjectId: true,
      failOnProviderLikeWorldId: false,
      freezeResults: false,
      useCache: true,
    },
  );

  for (const warning of chunkIdentityIssuesToWarnings(identity.issues)) {
    logWarn(context, "Chunk identity warning.", {
      warning,
      projectId: identity.chunkProjectId,
      appProjectPublicId: identity.appProjectPublicId,
      worldId: identity.chunkWorldId,
    });
  }

  const projectId = readString(identity.chunkProjectId, "");
  const universeId = readNullableString(identity.chunkUniverseId, null);
  const worldId = readString(identity.chunkWorldId, "");
  const valid = Boolean(identity.valid && projectId && worldId);
  const ready = Boolean(valid && requestedStatus !== "error" && requestedStatus !== "disabled" && requestedStatus !== "invalid");
  const status = ready ? "ready" : valid ? requestedStatus : "invalid";

  return {
    apiBaseUrl,
    browserBaseUrl,
    projectId,
    chunkProjectId: projectId,
    appProjectPublicId: identity.appProjectPublicId,
    projectPublicId: identity.projectPublicId,
    universeId,
    chunkUniverseId: universeId,
    worldId,
    chunkWorldId: worldId,
    status,
    ready,
    valid,
    degraded: identity.degraded || !ready,
    identityWarnings: chunkIdentityIssuesToWarnings(identity.issues),
    identityDiagnostics: canonicalChunkIdentityToRecord(identity),
    proxyDiagnostics: {
      apiBaseUrl: editorChunkProxyUrlResultToRecord(apiProxyResult),
      browserBaseUrl: editorChunkProxyUrlResultToRecord(browserProxyResult),
    },
    contractIdentity: identity,
  };
}

function normalizeRouteHints(
  bundle: NormalizedSourceBundle,
  apiBaseUrl: string,
  projectId: string,
  worldId: string,
  context: NormalizeContext,
): EditorChunkServiceRouteHints {
  const defaultHints = buildDefaultChunkRouteHints(apiBaseUrl, projectId, worldId);

  try {
    const datasetHints = sanitizeCriticalRouteHints(
      readPath(bundle.datasetChunkGlobals, ["routeHintsJson"]),
      context,
      "datasetChunkGlobals.routeHintsJson",
    );
    const windowHints = sanitizeCriticalRouteHints(
      readPath(bundle.windowChunkGlobals, ["routeHints"]),
      context,
      "windowChunkGlobals.routeHints",
    );
    const chunkConfigHints = sanitizeCriticalRouteHints(
      readFirst([
        readPath(bundle.datasetChunkGlobals, ["serviceConfigJson", "routeHints"]),
        readPath(bundle.datasetChunkGlobals, ["serviceConfig", "routeHints"]),
        readPath(bundle.windowChunkGlobals, ["serviceConfig", "routeHints"]),
        readPath(bundle.windowBootstrap, ["runtime", "chunk", "routeHints"]),
        readPath(bundle.fallbackBootstrap, ["runtime", "chunk", "routeHints"]),
      ]),
      context,
      "chunkConfig.routeHints",
    );

    const merged = mergeRecordValues(defaultHints, chunkConfigHints, windowHints, datasetHints);

    const editorInventory = sanitizeRoute(
      readFirst([
        merged.editorInventory,
        merged.inventory,
        readPath(bundle.datasetInventoryGlobals, ["inventoryApiUrl"]),
        readPath(bundle.datasetInventoryGlobals, ["inventoryUrl"]),
        readPath(bundle.datasetInventoryGlobals, ["inventoryRoute"]),
        readPath(bundle.datasetRaw, ["inventoryApiUrl"]),
        readPath(bundle.datasetRaw, ["inventoryRoute"]),
        readPath(bundle.windowInventoryGlobals, ["apiUrl"]),
        readPath(bundle.windowInventoryGlobals, ["inventoryUrl"]),
        readPath(bundle.windowInventoryGlobals, ["route"]),
        readPath(bundle.windowBootstrap, ["inventory", "apiUrl"]),
        readPath(bundle.windowBootstrap, ["runtime", "inventory", "apiUrl"]),
      ]),
      defaultHints.editorInventory,
    );

    const creativeLibrary = sanitizeRoute(
      readFirst([
        merged.creativeLibrary,
        merged.library,
        readPath(bundle.datasetInventoryGlobals, ["creativeLibraryRoute"]),
        readPath(bundle.datasetInventoryGlobals, ["libraryApiUrl"]),
        readPath(bundle.datasetRaw, ["creativeLibraryRoute"]),
        readPath(bundle.datasetRaw, ["libraryApiUrl"]),
        readPath(bundle.windowLibraryGlobals, ["creativeLibraryRoute"]),
        readPath(bundle.windowLibraryGlobals, ["apiUrl"]),
        readPath(bundle.windowBootstrap, ["creativeLibrary", "apiUrl"]),
        readPath(bundle.windowBootstrap, ["runtime", "library", "creativeLibraryRoute"]),
      ]),
      defaultHints.creativeLibrary,
    );

    return {
      status: readString(merged.status, defaultHints.status),
      connectionTest: readString(merged.connectionTest, defaultHints.connectionTest),
      projects: readString(merged.projects, defaultHints.projects),

      /**
       * Critical chunk routes are always rebuilt from validated canonical
       * chunk identity. We never reuse /projects/prj_... hints.
       */
      project: defaultHints.project,
      projectBootstrap: defaultHints.projectBootstrap,
      worlds: defaultHints.worlds,
      world: defaultHints.world,
      blocks: defaultHints.blocks,
      chunk: defaultHints.chunk,
      chunksBatch: defaultHints.chunksBatch,
      commands: defaultHints.commands,

      placeableBlocks: readString(merged.placeableBlocks, defaultHints.placeableBlocks),

      editorInventory,
      editorInventoryHealth: sanitizeRoute(
        readFirst([merged.editorInventoryHealth, readPath(bundle.datasetInventoryGlobals, ["inventoryHealthUrl"])]),
        DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
      ),
      editorInventoryMetadata: sanitizeRoute(
        readFirst([merged.editorInventoryMetadata, readPath(bundle.datasetInventoryGlobals, ["inventoryMetadataUrl"])]),
        DEFAULT_EDITOR_INVENTORY_METADATA_URL,
      ),

      creativeLibrary,
      creativeLibraryHealth: sanitizeRoute(
        readFirst([merged.creativeLibraryHealth, readPath(bundle.datasetInventoryGlobals, ["creativeLibraryHealthUrl"])]),
        DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
      ),
      creativeLibraryMetadata: sanitizeRoute(
        readFirst([merged.creativeLibraryMetadata, readPath(bundle.datasetInventoryGlobals, ["creativeLibraryMetadataUrl"])]),
        DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
      ),
    };
  } catch {
    return defaultHints;
  }
}

function normalizeTimeouts(bundle: NormalizedSourceBundle): EditorChunkServiceTimeouts {
  try {
    const rawTimeouts = mergeRecordValues(
      readPath(bundle.fallbackBootstrap, ["runtime", "chunk", "timeouts"]),
      readPath(bundle.windowBootstrap, ["runtime", "chunk", "timeouts"]),
      readPath(bundle.windowChunkGlobals, ["serviceConfig", "timeouts"]),
      readPath(bundle.datasetChunkGlobals, ["serviceConfig", "timeouts"]),
      readPath(bundle.datasetChunkGlobals, ["serviceConfigJson", "timeouts"]),
    );

    return {
      statusMs: readTimeoutMs(
        readFirst([rawTimeouts.statusMs, rawTimeouts.statusSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.statusMs,
      ),
      requestMs: readTimeoutMs(
        readFirst([rawTimeouts.requestMs, rawTimeouts.requestSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.requestMs,
      ),
      blocksMs: readTimeoutMs(
        readFirst([rawTimeouts.blocksMs, rawTimeouts.blocksSeconds, rawTimeouts.requestMs, rawTimeouts.requestSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.blocksMs,
      ),
      inventoryMs: readTimeoutMs(
        readFirst([rawTimeouts.inventoryMs, rawTimeouts.inventorySeconds, rawTimeouts.requestMs, rawTimeouts.requestSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.inventoryMs,
      ),
      libraryMs: readTimeoutMs(
        readFirst([rawTimeouts.libraryMs, rawTimeouts.librarySeconds, rawTimeouts.requestMs, rawTimeouts.requestSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.libraryMs,
      ),
      chunkMs: readTimeoutMs(
        readFirst([rawTimeouts.chunkMs, rawTimeouts.chunkSeconds, rawTimeouts.requestMs, rawTimeouts.requestSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.chunkMs,
      ),
      batchMs: readTimeoutMs(
        readFirst([rawTimeouts.batchMs, rawTimeouts.batchSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.batchMs,
      ),
      commandMs: readTimeoutMs(
        readFirst([rawTimeouts.commandMs, rawTimeouts.commandSeconds]),
        DEFAULT_CHUNK_SERVICE_TIMEOUTS.commandMs,
      ),
    };
  } catch {
    return DEFAULT_CHUNK_SERVICE_TIMEOUTS;
  }
}

function normalizeChunkServiceConfig(
  bundle: NormalizedSourceBundle,
  options: EditorBootstrapNormalizeOptions,
  context: NormalizeContext,
): EditorChunkServiceConfig {
  const fallback = buildDefaultChunkServiceConfig({
    apiBaseUrl: options.chunkProxyBaseUrl,
    browserBaseUrl: options.chunkProxyBaseUrl,
    projectId: options.projectId,
    worldId: options.worldId,
  });

  try {
    const rawServiceConfig = mergeRecordValues(
      readPath(bundle.fallbackBootstrap, ["runtime", "chunk"]),
      readPath(bundle.windowBootstrap, ["runtime", "chunk"]),
      readPath(bundle.windowBootstrap, ["chunk"]),
      readPath(bundle.windowChunkGlobals, ["serviceConfig"]),
      readPath(bundle.datasetChunkGlobals, ["serviceConfigJson"]),
      readPath(bundle.datasetChunkGlobals, ["serviceConfig"]),
    );

    const identity = normalizeChunkIdentity(bundle, options, rawServiceConfig, fallback, context);

    const enabled = readBoolean(
      readFirst([
        readPath(bundle.datasetChunkGlobals, ["enabled"]),
        rawServiceConfig.enabled,
      ]),
      true,
    );

    if (!enabled) {
      logWarn(context, "Chunk-Service was disabled in bootstrap but is required by the new editor frontend. It was forced on.", {
        apiBaseUrl: identity.apiBaseUrl,
        projectId: identity.projectId,
        worldId: identity.worldId,
      });
    }

    const requestedSourceKind = readString(rawServiceConfig.sourceKind, DEFAULT_CHUNK_SERVICE_SOURCE_KIND);
    const requestedMode = readString(rawServiceConfig.mode, DEFAULT_CHUNK_SERVICE_MODE);

    if (requestedSourceKind !== DEFAULT_CHUNK_SERVICE_SOURCE_KIND) {
      logWarn(context, "Chunk-Service sourceKind was overridden to vectoplan-chunk.", {
        requestedSourceKind,
      });
    }

    if (requestedMode !== DEFAULT_CHUNK_SERVICE_MODE) {
      logWarn(context, "Chunk-Service mode was overridden to editor-proxy.", {
        requestedMode,
      });
    }

    if (!identity.valid) {
      logWarn(context, "Chunk-Service identity is invalid. Runtime will fail closed before chunk HTTP requests are sent.", {
        identity: identity.identityDiagnostics,
      });
    }

    const connectionState = identity.ready
      ? "ready"
      : identity.valid
        ? normalizeConnectionState(rawServiceConfig.connectionState)
        : "failed";

    return {
      enabled: true,
      mode: DEFAULT_CHUNK_SERVICE_MODE,
      sourceKind: DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
      connectionState,
      apiBaseUrl: identity.apiBaseUrl,
      browserBaseUrl: identity.browserBaseUrl,

      // Editor runtime project/world are intentionally chunk project/world.
      projectId: identity.projectId,
      worldId: identity.worldId,

      // Extra compatibility fields are retained for downstream modules that read them dynamically.
      chunkProjectId: identity.chunkProjectId,
      chunkUniverseId: identity.chunkUniverseId,
      chunkWorldId: identity.chunkWorldId,
      universeId: identity.universeId,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      chunkReady: identity.ready,
      ready: identity.ready,
      chunkStatus: identity.status,
      status: identity.status,
      identityValid: identity.valid,
      identityDegraded: identity.degraded,
      identityWarnings: identity.identityWarnings,
      identityDiagnostics: identity.identityDiagnostics,
      proxyDiagnostics: identity.proxyDiagnostics,
      contractIdentity: identity.identityDiagnostics,

      preferBatchLoad: readBoolean(
        readFirst([
          readPath(bundle.datasetChunkGlobals, ["preferBatchLoad"]),
          rawServiceConfig.preferBatchLoad,
        ]),
        true,
      ),
      reloadDirtyChunksAfterCommand: readBoolean(
        readFirst([
          readPath(bundle.datasetChunkGlobals, ["reloadDirtyChunksAfterCommand"]),
          rawServiceConfig.reloadDirtyChunksAfterCommand,
        ]),
        true,
      ),
      maxBatchChunks: readInteger(
        readFirst([
          readPath(bundle.datasetChunkGlobals, ["maxBatchChunks"]),
          rawServiceConfig.maxBatchChunks,
        ]),
        DEFAULT_CHUNK_SERVICE_MAX_BATCH_CHUNKS,
        1,
        2048,
      ),
      maxLoadedChunks: readInteger(
        readFirst([
          readPath(bundle.datasetChunkGlobals, ["maxLoadedChunks"]),
          rawServiceConfig.maxLoadedChunks,
        ]),
        2048,
        512,
        8192,
      ),
      routeHints: normalizeRouteHints(bundle, identity.apiBaseUrl, identity.projectId, identity.worldId, context),
      timeouts: normalizeTimeouts(bundle),
    } as unknown as EditorChunkServiceConfig;
  } catch (error) {
    logError(context, "Chunk-Service bootstrap normalization failed. Defaults were used.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return fallback;
  }
}

function normalizeAppBootstrap(
  bundle: NormalizedSourceBundle,
  options: EditorBootstrapNormalizeOptions,
): EditorAppBootstrap {
  const rawApp = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["app"]),
    readPath(bundle.windowBootstrap, ["app"]),
  );

  const buildMode = readString(
    readFirst([rawApp.buildMode, rawApp.mode, readPath(bundle.datasetRaw, ["buildMode"]), options.buildMode]),
    "development",
  );

  const buildVersion = readString(
    readFirst([rawApp.buildVersion, rawApp.serviceVersion, readPath(bundle.datasetRaw, ["buildVersion"]), options.buildVersion]),
    "0.1.0",
  );

  return {
    name: DEFAULT_EDITOR_SERVICE_NAME,
    mode: buildMode,
    buildMode,
    buildVersion,
    templateMode: readString(rawApp.templateMode, DEFAULT_EDITOR_TEMPLATE_MODE),
    runtimeMode: DEFAULT_EDITOR_RUNTIME_MODE,
    serviceVersion: readString(
      readFirst([rawApp.serviceVersion, readPath(bundle.datasetRaw, ["serviceVersion"]), buildVersion]),
      buildVersion,
    ),
    frontendRoot: DEFAULT_EDITOR_FRONTEND_ROOT,
    createdAt: readString(rawApp.createdAt, nowIsoStringSafe()),
  };
}

function normalizeProjectBootstrap(
  bundle: NormalizedSourceBundle,
  chunk: EditorChunkServiceConfig,
): EditorProjectBootstrap {
  const rawProject = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["project"]),
    readPath(bundle.windowBootstrap, ["project"]),
  );

  const chunkAsRecord = chunk as unknown as UnknownRecord;
  const runtimeProjectId = sanitizeProjectOrWorldId(
    readFirst([chunkAsRecord.chunkProjectId, chunk.projectId]),
    DEFAULT_PROJECT_ID,
  );
  const appProjectPublicId = readNullableString(
    readFirst([
      chunkAsRecord.appProjectPublicId,
      chunkAsRecord.projectPublicId,
      rawProject.appProjectPublicId,
      rawProject.projectPublicId,
      isLikelyAppProjectId(rawProject.projectId) ? rawProject.projectId : undefined,
    ]),
    null,
  );
  const worldId = sanitizeProjectOrWorldId(
    readFirst([chunkAsRecord.chunkWorldId, chunk.worldId, rawProject.chunkWorldId, rawProject.worldId]),
    DEFAULT_WORLD_ID,
  );

  return {
    projectId: runtimeProjectId,
    worldId,
    universeId: readNullableString(
      readFirst([chunkAsRecord.chunkUniverseId, chunkAsRecord.universeId, rawProject.chunkUniverseId, rawProject.universeId]),
      DEFAULT_UNIVERSE_ID,
    ),
    templateId: readNullableString(rawProject.templateId, DEFAULT_TEMPLATE_ID),
    providerId: readNullableString(rawProject.providerId, DEFAULT_PROVIDER_ID),
    providerWorldId: readNullableString(
      readFirst([rawProject.providerWorldId, worldId]),
      DEFAULT_PROVIDER_WORLD_ID,
    ),
    appProjectPublicId,
    projectPublicId: appProjectPublicId,
    runtimeProjectId,
    chunkProjectId: runtimeProjectId,
    chunkWorldId: worldId,
  } as unknown as EditorProjectBootstrap;
}

function normalizePhysicsBootstrap(
  bundle: NormalizedSourceBundle,
  context: NormalizeContext,
): EditorPhysicsBootstrap {
  try {
    const defaultPhysics = buildDefaultPhysicsBootstrap(
      mergeNestedRecordValues(
        readPath(bundle.fallbackBootstrap, ["runtime", "physics"]),
        readPath(bundle.fallbackBootstrap, ["physics"]),
      ) as Partial<EditorPhysicsBootstrap>,
    );

    const datasetPhysicsConfigJson = asRecord(readPath(bundle.datasetPhysicsGlobals, ["physicsConfigJson"]));

    const datasetPhysics = mergeNestedRecordValues(
      datasetPhysicsConfigJson,
      {
        enabled: readFirst([
          readPath(bundle.datasetPhysicsGlobals, ["physicsEnabled"]),
          readPath(bundle.datasetRaw, ["physicsEnabled"]),
        ]),
        mode: readFirst([
          readPath(bundle.datasetPhysicsGlobals, ["physicsMode"]),
          readPath(bundle.datasetRaw, ["physicsMode"]),
        ]),
        timing: {
          fixedTimeStepSeconds: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsFixedTimeStepSeconds"]),
            readPath(bundle.datasetRaw, ["physicsFixedTimeStepSeconds"]),
          ]),
          maxFrameDeltaSeconds: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsMaxFrameDeltaSeconds"]),
            readPath(bundle.datasetRaw, ["physicsMaxFrameDeltaSeconds"]),
          ]),
          maxSubSteps: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsMaxSubSteps"]),
            readPath(bundle.datasetRaw, ["physicsMaxSubSteps"]),
          ]),
        },
        movement: {
          walkSpeed: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsWalkSpeed"]),
            readPath(bundle.datasetRaw, ["physicsWalkSpeed"]),
          ]),
          sprintSpeed: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsSprintSpeed"]),
            readPath(bundle.datasetRaw, ["physicsSprintSpeed"]),
          ]),
          airControlSpeed: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsAirControlSpeed"]),
            readPath(bundle.datasetRaw, ["physicsAirControlSpeed"]),
          ]),
          flySpeed: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsFlySpeed"]),
            readPath(bundle.datasetRaw, ["physicsFlySpeed"]),
          ]),
          flySprintSpeed: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsFlySprintSpeed"]),
            readPath(bundle.datasetRaw, ["physicsFlySprintSpeed"]),
          ]),
          jumpVelocity: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsJumpVelocity"]),
            readPath(bundle.datasetRaw, ["physicsJumpVelocity"]),
          ]),
          gravity: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsGravity"]),
            readPath(bundle.datasetRaw, ["physicsGravity"]),
          ]),
          maxFallSpeed: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsMaxFallSpeed"]),
            readPath(bundle.datasetRaw, ["physicsMaxFallSpeed"]),
          ]),
          groundSnapDistance: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsGroundSnapDistance"]),
            readPath(bundle.datasetRaw, ["physicsGroundSnapDistance"]),
          ]),
        },
        input: {
          doubleTapWindowMs: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsDoubleTapWindowMs"]),
            readPath(bundle.datasetRaw, ["physicsDoubleTapWindowMs"]),
          ]),
          allowJumpBeforeFlightToggle: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsAllowJumpBeforeFlightToggle"]),
            readPath(bundle.datasetRaw, ["physicsAllowJumpBeforeFlightToggle"]),
          ]),
        },
        collider: {
          width: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsPlayerWidth"]),
            readPath(bundle.datasetRaw, ["physicsPlayerWidth"]),
          ]),
          height: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsPlayerHeight"]),
            readPath(bundle.datasetRaw, ["physicsPlayerHeight"]),
          ]),
          eyeHeight: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsPlayerEyeHeight"]),
            readPath(bundle.datasetRaw, ["physicsPlayerEyeHeight"]),
          ]),
          skinWidth: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsPlayerSkinWidth"]),
            readPath(bundle.datasetRaw, ["physicsPlayerSkinWidth"]),
          ]),
        },
        missingChunks: {
          policy: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsMissingChunkPolicy"]),
            readPath(bundle.datasetRaw, ["physicsMissingChunkPolicy"]),
          ]),
          blockHorizontalMovement: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsBlockHorizontalMovementOnMissingChunk"]),
            readPath(bundle.datasetRaw, ["physicsBlockHorizontalMovementOnMissingChunk"]),
          ]),
          blockVerticalMovement: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsBlockVerticalMovementOnMissingChunk"]),
            readPath(bundle.datasetRaw, ["physicsBlockVerticalMovementOnMissingChunk"]),
          ]),
        },
        debug: {
          enabled: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsDebugEnabled"]),
            readPath(bundle.datasetRaw, ["physicsDebugEnabled"]),
            readPath(bundle.datasetRaw, ["debugOverlayEnabled"]),
          ]),
          exposeToStore: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsDebugExposeToStore"]),
            readPath(bundle.datasetRaw, ["physicsDebugExposeToStore"]),
          ]),
          includeCollisionCells: readFirst([
            readPath(bundle.datasetPhysicsGlobals, ["physicsDebugIncludeCollisionCells"]),
            readPath(bundle.datasetRaw, ["physicsDebugIncludeCollisionCells"]),
          ]),
        },
      },
    );

    const rawPhysics = mergeNestedRecordValues(
      defaultPhysics,
      readPath(bundle.windowBootstrap, ["runtime", "physics"]),
      readPath(bundle.windowBootstrap, ["physics"]),
      bundle.windowPhysicsGlobals,
      datasetPhysics,
    );

    const height = readNumber(
      readPath(rawPhysics, ["collider", "height"]),
      DEFAULT_PHYSICS_PLAYER_HEIGHT,
      0.4,
      4,
    );

    const eyeHeight = Math.min(
      height - 0.05,
      readNumber(
        readPath(rawPhysics, ["collider", "eyeHeight"]),
        DEFAULT_PHYSICS_PLAYER_EYE_HEIGHT,
        0.1,
        4,
      ),
    );

    const fixedTimeStepSeconds = readNumber(
      readPath(rawPhysics, ["timing", "fixedTimeStepSeconds"]),
      DEFAULT_PHYSICS_FIXED_TIME_STEP_SECONDS,
      1 / 240,
      1 / 20,
    );

    const maxFrameDeltaSeconds = readNumber(
      readPath(rawPhysics, ["timing", "maxFrameDeltaSeconds"]),
      DEFAULT_PHYSICS_MAX_FRAME_DELTA_SECONDS,
      fixedTimeStepSeconds,
      2,
    );

    const walkSpeed = readNumber(
      readPath(rawPhysics, ["movement", "walkSpeed"]),
      DEFAULT_PHYSICS_WALK_SPEED,
      0,
      80,
    );

    const sprintSpeed = readNumber(
      readPath(rawPhysics, ["movement", "sprintSpeed"]),
      DEFAULT_PHYSICS_SPRINT_SPEED,
      walkSpeed,
      80,
    );

    const flySpeed = readNumber(
      readPath(rawPhysics, ["movement", "flySpeed"]),
      DEFAULT_PHYSICS_FLY_SPEED,
      0,
      80,
    );

    const flySprintSpeed = readNumber(
      readPath(rawPhysics, ["movement", "flySprintSpeed"]),
      DEFAULT_PHYSICS_FLY_SPRINT_SPEED,
      flySpeed,
      80,
    );

    const missingChunkPolicy = normalizePhysicsMissingChunkPolicy(
      readPath(rawPhysics, ["missingChunks", "policy"]),
    );

    if (missingChunkPolicy === "treat_as_air") {
      logWarn(context, "Physics missing-chunk policy is treat_as_air. This can allow falling through unloaded terrain.");
    }

    return buildDefaultPhysicsBootstrap({
      enabled: readBoolean(readPath(rawPhysics, ["enabled"]), DEFAULT_PHYSICS_ENABLED),
      mode: DEFAULT_PHYSICS_MODE,
      timing: {
        fixedTimeStepSeconds,
        maxFrameDeltaSeconds,
        maxSubSteps: readInteger(
          readPath(rawPhysics, ["timing", "maxSubSteps"]),
          DEFAULT_PHYSICS_MAX_SUB_STEPS,
          1,
          60,
        ),
      },
      movement: {
        walkSpeed,
        sprintSpeed,
        airControlSpeed: readNumber(
          readPath(rawPhysics, ["movement", "airControlSpeed"]),
          DEFAULT_PHYSICS_AIR_CONTROL_SPEED,
          0,
          80,
        ),
        flySpeed,
        flySprintSpeed,
        jumpVelocity: readNumber(
          readPath(rawPhysics, ["movement", "jumpVelocity"]),
          DEFAULT_PHYSICS_JUMP_VELOCITY,
          0,
          80,
        ),
        gravity: readNumber(
          readPath(rawPhysics, ["movement", "gravity"]),
          DEFAULT_PHYSICS_GRAVITY,
          -200,
          0,
        ),
        maxFallSpeed: readNumber(
          readPath(rawPhysics, ["movement", "maxFallSpeed"]),
          DEFAULT_PHYSICS_MAX_FALL_SPEED,
          -300,
          -1,
        ),
        groundSnapDistance: readNumber(
          readPath(rawPhysics, ["movement", "groundSnapDistance"]),
          DEFAULT_PHYSICS_GROUND_SNAP_DISTANCE,
          0,
          0.5,
        ),
      },
      input: {
        doubleTapWindowMs: readInteger(
          readPath(rawPhysics, ["input", "doubleTapWindowMs"]),
          DEFAULT_PHYSICS_DOUBLE_TAP_WINDOW_MS,
          80,
          800,
        ),
        allowJumpBeforeFlightToggle: readBoolean(
          readPath(rawPhysics, ["input", "allowJumpBeforeFlightToggle"]),
          DEFAULT_PHYSICS_ALLOW_JUMP_BEFORE_FLIGHT_TOGGLE,
        ),
      },
      collider: {
        kind: "aabb",
        width: readNumber(
          readPath(rawPhysics, ["collider", "width"]),
          DEFAULT_PHYSICS_PLAYER_WIDTH,
          0.1,
          1.5,
        ),
        height,
        eyeHeight,
        skinWidth: readNumber(
          readPath(rawPhysics, ["collider", "skinWidth"]),
          DEFAULT_PHYSICS_PLAYER_SKIN_WIDTH,
          0.00001,
          0.05,
        ),
      },
      missingChunks: {
        policy: missingChunkPolicy,
        blockHorizontalMovement: readBoolean(
          readPath(rawPhysics, ["missingChunks", "blockHorizontalMovement"]),
          DEFAULT_PHYSICS_BLOCK_HORIZONTAL_MOVEMENT_ON_MISSING_CHUNK,
        ),
        blockVerticalMovement: readBoolean(
          readPath(rawPhysics, ["missingChunks", "blockVerticalMovement"]),
          DEFAULT_PHYSICS_BLOCK_VERTICAL_MOVEMENT_ON_MISSING_CHUNK,
        ),
      },
      debug: {
        enabled: readBoolean(
          readPath(rawPhysics, ["debug", "enabled"]),
          DEFAULT_DEBUG_OVERLAY_ENABLED,
        ),
        exposeToStore: readBoolean(
          readPath(rawPhysics, ["debug", "exposeToStore"]),
          DEFAULT_PHYSICS_DEBUG_EXPOSE_TO_STORE,
        ),
        includeCollisionCells: readBoolean(
          readPath(rawPhysics, ["debug", "includeCollisionCells"]),
          DEFAULT_PHYSICS_DEBUG_INCLUDE_COLLISION_CELLS,
        ),
      },
    });
  } catch (error) {
    logError(context, "Physics bootstrap normalization failed. Defaults were used.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return buildDefaultPhysicsBootstrap();
  }
}

function normalizeRuntimeInventoryConfig(
  bundle: NormalizedSourceBundle,
  context: NormalizeContext,
): EditorRuntimeInventoryConfig {
  const rawInventory = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["runtime", "inventory"]),
    readPath(bundle.fallbackBootstrap, ["inventory"]),
    readPath(bundle.windowBootstrap, ["runtime", "inventory"]),
    readPath(bundle.windowBootstrap, ["inventory"]),
    bundle.windowInventoryGlobals,
    readPath(bundle.datasetInventoryGlobals, ["inventoryConfigJson"]),
  );

  const hotbarSize = readInteger(
    readFirst([
      readPath(bundle.datasetInventoryGlobals, ["inventoryHotbarSize"]),
      readPath(bundle.datasetInventoryGlobals, ["inventorySlotCount"]),
      readPath(bundle.datasetRaw, ["inventoryHotbarSize"]),
      readPath(bundle.datasetRaw, ["inventorySlotCount"]),
      rawInventory.hotbarSize,
      rawInventory.slotCount,
    ]),
    DEFAULT_INVENTORY_SLOT_COUNT,
    1,
    64,
  );

  const selectedSlot = readInteger(
    readFirst([
      readPath(bundle.datasetInventoryGlobals, ["inventorySelectedSlot"]),
      readPath(bundle.datasetInventoryGlobals, ["inventoryDefaultSelectedSlot"]),
      readPath(bundle.datasetRaw, ["inventorySelectedSlot"]),
      readPath(bundle.datasetRaw, ["inventoryDefaultSelectedSlot"]),
      rawInventory.selectedSlot,
      rawInventory.defaultSelectedSlot,
    ]),
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );

  const apiUrl = sanitizeRoute(
    readFirst([
      readPath(bundle.datasetInventoryGlobals, ["inventoryApiUrl"]),
      readPath(bundle.datasetInventoryGlobals, ["inventoryUrl"]),
      readPath(bundle.datasetInventoryGlobals, ["inventoryRoute"]),
      readPath(bundle.datasetRaw, ["inventoryApiUrl"]),
      readPath(bundle.datasetRaw, ["inventoryRoute"]),
      rawInventory.apiUrl,
      rawInventory.inventoryUrl,
      rawInventory.route,
    ]),
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  const requestedChunkFallback = readBoolean(
    readFirst([
      rawInventory.allowChunkPlaceableFallback,
      readPath(bundle.datasetInventoryGlobals, ["inventoryAllowChunkPlaceableFallback"]),
      readPath(bundle.datasetRaw, ["inventoryAllowChunkPlaceableFallback"]),
    ]),
    false,
  );

  if (requestedChunkFallback) {
    logWarn(context, "Chunk placeable fallback was requested but is disabled for Library/VPLIB inventory.");
  }

  const requestedDebugAllowed = readBoolean(
    readFirst([
      rawInventory.debugGrassDirtAllowed,
      readPath(bundle.datasetInventoryGlobals, ["inventoryDebugGrassDirtAllowed"]),
      readPath(bundle.datasetRaw, ["inventoryDebugGrassDirtAllowed"]),
    ]),
    false,
  );

  if (requestedDebugAllowed) {
    logWarn(context, "debug_grass/debug_dirt were requested for inventory but are disabled.");
  }

  const normalized = buildDefaultRuntimeInventoryConfig({
    enabled: readBoolean(
      readFirst([
        rawInventory.enabled,
        readPath(bundle.datasetInventoryGlobals, ["inventoryEnabled"]),
        readPath(bundle.datasetRaw, ["inventoryEnabled"]),
      ]),
      true,
    ),
    source: DEFAULT_INVENTORY_SOURCE_KIND,
    kind: DEFAULT_INVENTORY_ITEM_KIND,
    apiUrl,
    inventoryUrl: apiUrl,
    route: apiUrl,
    healthUrl: sanitizeRoute(
      readFirst([
        readPath(bundle.datasetInventoryGlobals, ["inventoryHealthUrl"]),
        readPath(bundle.datasetRaw, ["inventoryHealthUrl"]),
        rawInventory.healthUrl,
      ]),
      DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
    ),
    metadataUrl: sanitizeRoute(
      readFirst([
        readPath(bundle.datasetInventoryGlobals, ["inventoryMetadataUrl"]),
        readPath(bundle.datasetRaw, ["inventoryMetadataUrl"]),
        rawInventory.metadataUrl,
      ]),
      DEFAULT_EDITOR_INVENTORY_METADATA_URL,
    ),
    hotbarSize,
    slotCount: hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    forceRefreshOnBoot: readBoolean(
      readFirst([
        rawInventory.forceRefreshOnBoot,
        readPath(bundle.datasetInventoryGlobals, ["inventoryForceRefreshOnBoot"]),
        readPath(bundle.datasetRaw, ["inventoryForceRefreshOnBoot"]),
      ]),
      DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
    ),
    includeEmptySlots: readBoolean(
      readFirst([
        rawInventory.includeEmptySlots,
        readPath(bundle.datasetInventoryGlobals, ["inventoryIncludeEmptySlots"]),
        readPath(bundle.datasetRaw, ["inventoryIncludeEmptySlots"]),
      ]),
      DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
    ),
    allowEmptyFallback: readBoolean(
      readFirst([
        rawInventory.allowEmptyFallback,
        readPath(bundle.datasetInventoryGlobals, ["inventoryAllowEmptyFallback"]),
        readPath(bundle.datasetRaw, ["inventoryAllowEmptyFallback"]),
      ]),
      DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
    ),
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: readTimeoutMs(rawInventory.requestTimeoutMs, DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS),
    cacheTtlMs: readInteger(rawInventory.cacheTtlMs, DEFAULT_INVENTORY_CACHE_TTL_MS, 0, 3_600_000),
    staleCacheTtlMs: readInteger(rawInventory.staleCacheTtlMs, DEFAULT_INVENTORY_STALE_CACHE_TTL_MS, 0, 86_400_000),
  });

  return {
    ...normalized,
    source: DEFAULT_INVENTORY_SOURCE_KIND,
    kind: DEFAULT_INVENTORY_ITEM_KIND,
    apiUrl,
    inventoryUrl: apiUrl,
    route: apiUrl,
    hotbarSize,
    slotCount: hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
  };
}

function normalizeRuntimeLibraryConfig(bundle: NormalizedSourceBundle): EditorRuntimeLibraryConfig {
  const rawLibrary = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["runtime", "library"]),
    readPath(bundle.windowBootstrap, ["runtime", "library"]),
    readPath(bundle.windowBootstrap, ["library"]),
    bundle.windowLibraryGlobals,
  );

  const creativeLibraryRoute = sanitizeRoute(
    readFirst([
      readPath(bundle.datasetInventoryGlobals, ["creativeLibraryRoute"]),
      readPath(bundle.datasetInventoryGlobals, ["libraryApiUrl"]),
      readPath(bundle.datasetRaw, ["creativeLibraryRoute"]),
      readPath(bundle.datasetRaw, ["libraryApiUrl"]),
      rawLibrary.creativeLibraryRoute,
      rawLibrary.apiUrl,
    ]),
    DEFAULT_CREATIVE_LIBRARY_API_URL,
  );

  return buildDefaultRuntimeLibraryConfig({
    enabled: readBoolean(rawLibrary.enabled, true),
    source: "vectoplan-library",
    apiUrl: creativeLibraryRoute,
    browserApiUrl: creativeLibraryRoute,
    inventoryRoute: sanitizeRoute(rawLibrary.inventoryRoute, DEFAULT_EDITOR_INVENTORY_API_URL),
    creativeLibraryRoute,
    healthRoute: sanitizeRoute(rawLibrary.healthRoute, DEFAULT_CREATIVE_LIBRARY_HEALTH_URL),
    metadataRoute: sanitizeRoute(rawLibrary.metadataRoute, DEFAULT_CREATIVE_LIBRARY_METADATA_URL),
    browserCallsLibraryDirectly: false,
  });
}

function normalizeRuntimeConfig(
  bundle: NormalizedSourceBundle,
  chunk: EditorChunkServiceConfig,
  physics: EditorPhysicsBootstrap,
  context: NormalizeContext,
): EditorRuntimeConfig {
  const rawRuntime = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["runtime"]),
    readPath(bundle.windowBootstrap, ["runtime"]),
  );

  const attemptedLocalFallback = readBoolean(
    readFirst([
      rawRuntime.localWorldFallbackEnabled,
      rawRuntime.legacyFrontendEnabled,
      readPath(bundle.windowBootstrap, ["featureFlags", "localWorldFallbackEnabled"]),
      readPath(bundle.windowBootstrap, ["featureFlags", "legacyFrontendEnabled"]),
      readPath(bundle.datasetRaw, ["localWorldFallbackEnabled"]),
      readPath(bundle.datasetRaw, ["legacyFrontendEnabled"]),
    ]),
    false,
  );

  if (attemptedLocalFallback) {
    logWarn(context, "Local or legacy world fallback was requested by bootstrap but is disabled in the new editor frontend.");
  }

  return {
    mode: DEFAULT_EDITOR_RUNTIME_MODE,
    worldMode: DEFAULT_EDITOR_WORLD_MODE,
    sourceMode: DEFAULT_EDITOR_WORLD_SOURCE_MODE,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,
    chunk,
    physics,
    inventory: normalizeRuntimeInventoryConfig(bundle, context),
    library: normalizeRuntimeLibraryConfig(bundle),
  };
}

function normalizeFeatureFlags(
  bundle: NormalizedSourceBundle,
  physics: EditorPhysicsBootstrap,
  context: NormalizeContext,
): EditorFeatureFlags {
  const rawFlags = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["featureFlags"]),
    readPath(bundle.windowBootstrap, ["featureFlags"]),
  );

  const attemptedLocalFallback = readBoolean(
    readFirst([
      rawFlags.localWorldFallbackEnabled,
      rawFlags.legacyFrontendEnabled,
      readPath(bundle.datasetRaw, ["localWorldFallbackEnabled"]),
      readPath(bundle.datasetRaw, ["legacyFrontendEnabled"]),
    ]),
    false,
  );

  if (attemptedLocalFallback) {
    logWarn(context, "Legacy/local frontend flags were ignored because the new editor frontend is chunk-service only.");
  }

  const requestedLegacyChunkInventory = readBoolean(
    readFirst([
      rawFlags.legacyChunkInventoryEnabled,
      rawFlags.chunkServiceInventoryEnabled,
      rawFlags.chunkPaletteInventoryFallbackEnabled,
      rawFlags.placeableBlocksPlaceholderRouteEnabled,
    ]),
    false,
  );

  if (requestedLegacyChunkInventory) {
    logWarn(context, "Legacy chunk inventory flags were requested but ignored. Productive hotbar inventory uses /editor/api/inventory.");
  }

  return {
    chunkServiceEnabled: true,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,

    chunkServiceInventoryEnabled: false,
    chunkPaletteInventoryFallbackEnabled: false,
    placeableBlocksPlaceholderRouteEnabled: false,
    legacyChunkInventoryEnabled: false,

    editorInventoryApiEnabled: readBoolean(rawFlags.editorInventoryApiEnabled, true),
    libraryInventoryEnabled: readBoolean(rawFlags.libraryInventoryEnabled, true),
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,

    remoteCommandsEnabled: readBoolean(rawFlags.remoteCommandsEnabled, true),
    dirtyChunkReloadEnabled: readBoolean(rawFlags.dirtyChunkReloadEnabled, true),

    pointerLockEnabled: readBoolean(
      readFirst([rawFlags.pointerLockEnabled, readPath(bundle.datasetRaw, ["pointerLockEnabled"])]),
      DEFAULT_POINTER_LOCK_ENABLED,
    ),
    firstPersonEnabled: readBoolean(
      readFirst([rawFlags.firstPersonEnabled, readPath(bundle.datasetRaw, ["firstPersonEnabled"])]),
      DEFAULT_FIRST_PERSON_ENABLED,
    ),
    physicsEnabled: readBoolean(
      readFirst([rawFlags.physicsEnabled, readPath(bundle.datasetRaw, ["physicsEnabled"]), physics.enabled]),
      DEFAULT_PHYSICS_ENABLED,
    ),
    playerCollisionEnabled: readBoolean(
      readFirst([rawFlags.playerCollisionEnabled, readPath(bundle.datasetRaw, ["playerCollisionEnabled"]), physics.enabled]),
      DEFAULT_PLAYER_COLLISION_ENABLED,
    ),
    flightModeEnabled: readBoolean(
      readFirst([rawFlags.flightModeEnabled, readPath(bundle.datasetRaw, ["flightModeEnabled"]), physics.enabled]),
      DEFAULT_FLIGHT_MODE_ENABLED,
    ),
    crosshairEnabled: readBoolean(
      readFirst([rawFlags.crosshairEnabled, readPath(bundle.datasetRaw, ["crosshairEnabled"])]),
      DEFAULT_CROSSHAIR_ENABLED,
    ),
    hotbarEnabled: readBoolean(
      readFirst([rawFlags.hotbarEnabled, readPath(bundle.datasetRaw, ["hotbarEnabled"])]),
      DEFAULT_HOTBAR_ENABLED,
    ),
    statusBarEnabled: readBoolean(
      readFirst([rawFlags.statusBarEnabled, readPath(bundle.datasetRaw, ["statusBarEnabled"])]),
      DEFAULT_STATUS_BAR_ENABLED,
    ),
    loadingOverlayEnabled: readBoolean(
      readFirst([rawFlags.loadingOverlayEnabled, readPath(bundle.datasetRaw, ["loadingOverlayEnabled"])]),
      DEFAULT_LOADING_OVERLAY_ENABLED,
    ),
    errorPanelEnabled: readBoolean(
      readFirst([rawFlags.errorPanelEnabled, readPath(bundle.datasetRaw, ["errorPanelEnabled"])]),
      DEFAULT_ERROR_PANEL_ENABLED,
    ),
    debugOverlayEnabled: readBoolean(
      readFirst([rawFlags.debugOverlayEnabled, readPath(bundle.datasetRaw, ["debugOverlayEnabled"]), physics.debug.enabled]),
      DEFAULT_DEBUG_OVERLAY_ENABLED,
    ),
    creativeLibraryEnabled: readBoolean(
      readFirst([rawFlags.creativeLibraryEnabled, readPath(bundle.datasetRaw, ["creativeLibraryEnabled"])]),
      DEFAULT_CREATIVE_LIBRARY_ENABLED,
    ),
  };
}

function normalizeUiBootstrap(bundle: NormalizedSourceBundle, physics: EditorPhysicsBootstrap): EditorUiBootstrap {
  const rawUi = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["ui"]),
    readPath(bundle.windowBootstrap, ["ui"]),
  );

  const language = readString(rawUi.language, "de");

  return {
    language: language === "en" ? "en" : "de",
    title: readString(rawUi.title, "VECTOPLAN Editor"),
    subtitle: readString(rawUi.subtitle, "Remote Chunk Runtime · Library Inventory"),
    showLeftPanel: readBoolean(rawUi.showLeftPanel, false),
    showRightPanel: readBoolean(rawUi.showRightPanel, false),
    showDebugOverlay: readBoolean(
      readFirst([rawUi.showDebugOverlay, readPath(bundle.datasetRaw, ["debugOverlayEnabled"]), physics.debug.enabled]),
      DEFAULT_DEBUG_OVERLAY_ENABLED,
    ),
    showHotbar: readBoolean(
      readFirst([rawUi.showHotbar, readPath(bundle.datasetRaw, ["hotbarEnabled"])]),
      DEFAULT_HOTBAR_ENABLED,
    ),
    showCrosshair: readBoolean(
      readFirst([rawUi.showCrosshair, readPath(bundle.datasetRaw, ["crosshairEnabled"])]),
      DEFAULT_CROSSHAIR_ENABLED,
    ),
    showStatusBar: readBoolean(
      readFirst([rawUi.showStatusBar, readPath(bundle.datasetRaw, ["statusBarEnabled"])]),
      DEFAULT_STATUS_BAR_ENABLED,
    ),
    showLoadingOverlay: readBoolean(
      readFirst([rawUi.showLoadingOverlay, readPath(bundle.datasetRaw, ["loadingOverlayEnabled"])]),
      DEFAULT_LOADING_OVERLAY_ENABLED,
    ),
  };
}

function normalizeInputBootstrap(bundle: NormalizedSourceBundle): EditorInputBootstrap {
  const rawInput = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["input"]),
    readPath(bundle.windowBootstrap, ["input"]),
  );

  return {
    pointerLockEnabled: readBoolean(
      readFirst([rawInput.pointerLockEnabled, readPath(bundle.datasetRaw, ["pointerLockEnabled"])]),
      DEFAULT_POINTER_LOCK_ENABLED,
    ),
    keyboardEnabled: readBoolean(rawInput.keyboardEnabled, true),
    mouseEnabled: readBoolean(rawInput.mouseEnabled, true),
    wheelEnabled: readBoolean(rawInput.wheelEnabled, true),
    invertY: readBoolean(rawInput.invertY, false),
    sensitivity: readNumber(
      readFirst([rawInput.sensitivity, readPath(bundle.datasetRaw, ["cameraLookSensitivity"])]),
      DEFAULT_INPUT_SENSITIVITY,
      0.00001,
      0.1,
    ),
  };
}

function normalizeVector3(value: unknown, fallback: typeof DEFAULT_CAMERA_SPAWN): typeof DEFAULT_CAMERA_SPAWN {
  const record = asRecord(value);

  if (!record) {
    return fallback;
  }

  return {
    x: readNumber(record.x, fallback.x, -1_000_000, 1_000_000),
    y: readNumber(record.y, fallback.y, -1_000_000, 1_000_000),
    z: readNumber(record.z, fallback.z, -1_000_000, 1_000_000),
  };
}

function normalizeEuler3(value: unknown, fallback: typeof DEFAULT_CAMERA_ROTATION): typeof DEFAULT_CAMERA_ROTATION {
  const record = asRecord(value);

  if (!record) {
    return fallback;
  }

  return {
    pitch: readNumber(record.pitch, fallback.pitch, -Math.PI / 2, Math.PI / 2),
    yaw: readNumber(record.yaw, fallback.yaw, -Math.PI * 4, Math.PI * 4),
    roll: readNumber(record.roll, fallback.roll, -Math.PI * 2, Math.PI * 2),
  };
}

function normalizeCameraBootstrap(
  bundle: NormalizedSourceBundle,
  physics: EditorPhysicsBootstrap,
): EditorCameraBootstrap {
  const rawCamera = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["camera"]),
    readPath(bundle.windowBootstrap, ["camera"]),
  );

  const spawn = normalizeVector3(rawCamera.spawn, DEFAULT_CAMERA_SPAWN);
  const rotation = normalizeEuler3(rawCamera.rotation, DEFAULT_CAMERA_ROTATION);
  const physicsFollowEnabled = readBoolean(
    readFirst([
      readPath(bundle.datasetRaw, ["cameraPhysicsFollowEnabled"]),
      rawCamera.physicsFollowEnabled,
      physics.enabled,
    ]),
    physics.enabled,
  );

  return {
    mode: "first-person",
    fov: readNumber(rawCamera.fov, DEFAULT_CAMERA_FOV, 10, 140),
    near: readNumber(rawCamera.near, DEFAULT_CAMERA_NEAR, 0.001, 10),
    far: readNumber(rawCamera.far, DEFAULT_CAMERA_FAR, 10, 1_000_000),
    spawn: {
      x: readNumber(readPath(bundle.datasetRaw, ["cameraSpawnX"]), spawn.x, -1_000_000, 1_000_000),
      y: readNumber(readPath(bundle.datasetRaw, ["cameraSpawnY"]), spawn.y, -1_000_000, 1_000_000),
      z: readNumber(readPath(bundle.datasetRaw, ["cameraSpawnZ"]), spawn.z, -1_000_000, 1_000_000),
    },
    rotation: {
      pitch: readNumber(readPath(bundle.datasetRaw, ["cameraPitch"]), rotation.pitch, -Math.PI / 2, Math.PI / 2),
      yaw: readNumber(readPath(bundle.datasetRaw, ["cameraYaw"]), rotation.yaw, -Math.PI * 4, Math.PI * 4),
      roll: rotation.roll,
    },
    moveSpeed: readNumber(
      readFirst([readPath(bundle.datasetRaw, ["cameraMoveSpeed"]), rawCamera.moveSpeed]),
      DEFAULT_CAMERA_MOVE_SPEED,
      0.01,
      1_000,
    ),
    sprintMultiplier: readNumber(
      readFirst([readPath(bundle.datasetRaw, ["cameraSprintMultiplier"]), rawCamera.sprintMultiplier]),
      DEFAULT_CAMERA_SPRINT_MULTIPLIER,
      1,
      100,
    ),
    directMovementEnabled: readBoolean(
      readFirst([
        readPath(bundle.datasetRaw, ["cameraDirectMovementEnabled"]),
        rawCamera.directMovementEnabled,
        !physicsFollowEnabled,
      ]),
      !physicsFollowEnabled,
    ),
    physicsFollowEnabled,
  };
}

function normalizeRenderBootstrap(bundle: NormalizedSourceBundle): EditorRenderBootstrap {
  const rawRender = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["render"]),
    readPath(bundle.windowBootstrap, ["render"]),
  );

  return {
    antialias: readBoolean(rawRender.antialias, true),
    alpha: readBoolean(rawRender.alpha, false),
    pixelRatioMax: readNumber(rawRender.pixelRatioMax, 2, 0.25, 4),
    clearColor: readString(rawRender.clearColor, DEFAULT_RENDER_CLEAR_COLOR),
    chunkWireframe: readBoolean(rawRender.chunkWireframe, false),
    showPreview: readBoolean(rawRender.showPreview, true),
    showTargetHighlight: readBoolean(rawRender.showTargetHighlight, true),
    visibleChunkRadius: readInteger(
      readFirst([
        readPath(bundle.datasetChunkGlobals, ["visibleChunkRadius"]),
        readPath(bundle.datasetChunkGlobals, ["viewDistance"]),
        readPath(bundle.datasetRaw, ["chunksViewDistance"]),
        rawRender.visibleChunkRadius,
      ]),
      DEFAULT_VISIBLE_CHUNK_RADIUS,
      0,
      16,
    ),
    maxChunksPerRenderSync: readInteger(rawRender.maxChunksPerRenderSync, DEFAULT_MAX_CHUNKS_PER_RENDER_SYNC, 1, 2048),
  };
}

function normalizeInventoryBootstrap(
  bundle: NormalizedSourceBundle,
  runtimeInventory: EditorRuntimeInventoryConfig,
  context: NormalizeContext,
): EditorInventoryBootstrap {
  const rawInventory = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["inventory"]),
    readPath(bundle.windowBootstrap, ["inventory"]),
    bundle.windowInventoryGlobals,
    readPath(bundle.datasetInventoryGlobals, ["inventoryConfigJson"]),
  );

  const fallbackBlockTypeIds = readStringArray(rawInventory.fallbackBlockTypeIds, DEFAULT_FALLBACK_BLOCK_TYPE_IDS);
  const requestedDefaultBlockTypeId = readString(
    readFirst([readPath(bundle.datasetRaw, ["inventoryDefaultBlockTypeId"]), rawInventory.defaultBlockTypeId]),
    "",
  );

  if (requestedDefaultBlockTypeId && FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.has(requestedDefaultBlockTypeId)) {
    logWarn(context, "Forbidden debug inventory default block type was ignored.", {
      requestedDefaultBlockTypeId,
    });
  }

  const base = buildDefaultInventoryBootstrap({
    enabled: runtimeInventory.enabled,
    source: runtimeInventory.source,
    kind: runtimeInventory.kind,
    apiUrl: runtimeInventory.apiUrl,
    inventoryUrl: runtimeInventory.inventoryUrl,
    route: runtimeInventory.route,
    healthUrl: runtimeInventory.healthUrl,
    metadataUrl: runtimeInventory.metadataUrl,
    defaultBlockTypeId: null,
    defaultRuntimeBlockTypeId: null,
    fallbackBlockTypeIds,
    slotCount: runtimeInventory.slotCount,
    hotbarSize: runtimeInventory.hotbarSize,
    selectedSlot: runtimeInventory.selectedSlot,
    defaultSelectedSlot: runtimeInventory.defaultSelectedSlot,
    includeEmptySlots: runtimeInventory.includeEmptySlots,
    forceRefreshOnBoot: runtimeInventory.forceRefreshOnBoot,
    allowEmptyFallback: runtimeInventory.allowEmptyFallback,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: runtimeInventory.requestTimeoutMs,
    cacheTtlMs: runtimeInventory.cacheTtlMs,
    staleCacheTtlMs: runtimeInventory.staleCacheTtlMs,
    inventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
    creativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    legacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
  });

  return {
    ...base,
    source: DEFAULT_INVENTORY_SOURCE_KIND,
    kind: DEFAULT_INVENTORY_ITEM_KIND,
    defaultBlockTypeId: null,
    defaultRuntimeBlockTypeId: null,
    fallbackBlockTypeIds,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    inventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
    creativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    legacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
  };
}

function normalizeCreativeLibraryBootstrap(
  bundle: NormalizedSourceBundle,
  featureFlags: EditorFeatureFlags,
  runtimeLibrary: EditorRuntimeLibraryConfig,
): EditorCreativeLibraryBootstrap {
  const rawCreativeLibrary = mergeRecordValues(
    readPath(bundle.fallbackBootstrap, ["creativeLibrary"]),
    readPath(bundle.windowBootstrap, ["creativeLibrary"]),
    bundle.windowLibraryGlobals,
  );

  const base = buildDefaultCreativeLibraryBootstrap({
    enabled: readBoolean(
      readFirst([
        rawCreativeLibrary.enabled,
        featureFlags.creativeLibraryEnabled,
        readPath(bundle.datasetRaw, ["creativeLibraryEnabled"]),
      ]),
      DEFAULT_CREATIVE_LIBRARY_ENABLED,
    ),
    source: normalizeInventorySourceKind(
      readFirst([rawCreativeLibrary.source, readPath(bundle.datasetRaw, ["creativeLibrarySource"])]),
      "creative-library",
    ),
    routeKind: rawCreativeLibrary.routeKind === "blocks" ? "blocks" : DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    apiUrl: runtimeLibrary.creativeLibraryRoute,
    route: runtimeLibrary.creativeLibraryRoute,
    healthUrl: runtimeLibrary.healthRoute,
    metadataUrl: runtimeLibrary.metadataRoute,
    browserCallsLibraryDirectly: false,
  });

  return {
    ...base,
    source: base.source === "chunk-service" ? "creative-library" : base.source,
    browserCallsLibraryDirectly: false,
  };
}

function normalizeDiagnostics(
  bundle: NormalizedSourceBundle,
  context: NormalizeContext,
): EditorBootstrapDiagnostics {
  return {
    source: bundle.sourceKind,
    warnings: [...context.warnings],
    normalizedAt: nowIsoStringSafe(),
    rawAvailable: bundle.raw !== undefined && bundle.raw !== null,
  };
}

function freezeShallow<T>(value: T): T {
  try {
    if (value && typeof value === "object") {
      return Object.freeze(value);
    }

    return value;
  } catch {
    return value;
  }
}

function freezePhysicsBootstrap(physics: EditorPhysicsBootstrap): EditorPhysicsBootstrap {
  return freezeShallow({
    ...physics,
    timing: freezeShallow({ ...physics.timing }),
    movement: freezeShallow({ ...physics.movement }),
    input: freezeShallow({ ...physics.input }),
    collider: freezeShallow({ ...physics.collider }),
    missingChunks: freezeShallow({ ...physics.missingChunks }),
    debug: freezeShallow({ ...physics.debug }),
  });
}

function freezeRuntimeConfig(runtime: EditorRuntimeConfig, physics: EditorPhysicsBootstrap): EditorRuntimeConfig {
  return freezeShallow({
    ...runtime,
    chunk: freezeShallow(runtime.chunk),
    physics,
    inventory: freezeShallow(runtime.inventory),
    library: freezeShallow(runtime.library),
  });
}

export function normalizeEditorBootstrap(
  rawInput: unknown,
  options: EditorBootstrapNormalizeOptions,
): EditorBootstrap {
  const context: NormalizeContext = {
    ...(options.logger === undefined ? {} : { logger: options.logger }),
    warnings: [],
  };

  try {
    const normalizedOptions = normalizeOptions(options);

    if (options.localWorldFallbackEnabled) {
      logWarn(context, "localWorldFallbackEnabled was provided but is disabled in the new editor frontend.");
    }

    const bundle = buildSourceBundle(rawInput, normalizedOptions);
    const chunk = normalizeChunkServiceConfig(bundle, normalizedOptions, context);
    const physics = freezePhysicsBootstrap(normalizePhysicsBootstrap(bundle, context));
    const app = normalizeAppBootstrap(bundle, normalizedOptions);
    const project = normalizeProjectBootstrap(bundle, chunk);
    const runtime = normalizeRuntimeConfig(bundle, chunk, physics, context);
    const featureFlags = normalizeFeatureFlags(bundle, physics, context);
    const ui = normalizeUiBootstrap(bundle, physics);
    const input = normalizeInputBootstrap(bundle);
    const camera = normalizeCameraBootstrap(bundle, physics);
    const render = normalizeRenderBootstrap(bundle);
    const inventory = normalizeInventoryBootstrap(bundle, runtime.inventory, context);
    const creativeLibrary = normalizeCreativeLibraryBootstrap(bundle, featureFlags, runtime.library);
    const diagnostics = normalizeDiagnostics(bundle, context);

    const chunkRecord = chunk as unknown as UnknownRecord;

    const bootstrap: EditorBootstrap = {
      schemaVersion: EDITOR_BOOTSTRAP_SCHEMA_VERSION,
      app: freezeShallow(app),
      project: freezeShallow(project),
      runtime: freezeRuntimeConfig(runtime, physics),
      featureFlags: freezeShallow(featureFlags),
      ui: freezeShallow(ui),
      input: freezeShallow(input),
      camera: freezeShallow(camera),
      render: freezeShallow(render),
      inventory: freezeShallow(inventory),
      creativeLibrary: freezeShallow(creativeLibrary),
      physics,
      diagnostics: freezeShallow(diagnostics),
      raw: rawInput,
    };

    logDebug(context, "Editor bootstrap normalized.", {
      projectId: bootstrap.runtime.chunk.projectId,
      worldId: bootstrap.runtime.chunk.worldId,
      chunkProjectId: chunkRecord.chunkProjectId ?? bootstrap.runtime.chunk.projectId,
      appProjectPublicId: chunkRecord.appProjectPublicId ?? null,
      chunkWorldId: chunkRecord.chunkWorldId ?? bootstrap.runtime.chunk.worldId,
      chunkReady: chunkRecord.chunkReady ?? chunkRecord.ready ?? null,
      chunkStatus: chunkRecord.chunkStatus ?? chunkRecord.status ?? null,
      identityValid: chunkRecord.identityValid ?? null,
      identityWarnings: chunkRecord.identityWarnings ?? null,
      apiBaseUrl: bootstrap.runtime.chunk.apiBaseUrl,
      sourceKind: bootstrap.runtime.chunk.sourceKind,
      inventoryApiUrl: bootstrap.inventory.apiUrl,
      inventorySource: bootstrap.inventory.source,
      inventoryKind: bootstrap.inventory.kind,
      inventoryOnlyLibraryItemsPlaceable: bootstrap.inventory.onlyLibraryItemsPlaceable,
      creativeLibraryRoute: bootstrap.creativeLibrary.route,
      pointerLockEnabled: bootstrap.input.pointerLockEnabled,
      physicsEnabled: bootstrap.physics.enabled,
      physicsMode: bootstrap.physics.mode,
      playerCollisionEnabled: bootstrap.featureFlags.playerCollisionEnabled,
      flightModeEnabled: bootstrap.featureFlags.flightModeEnabled,
      cameraPhysicsFollowEnabled: bootstrap.camera.physicsFollowEnabled,
      cameraDirectMovementEnabled: bootstrap.camera.directMovementEnabled,
      crosshairEnabled: bootstrap.featureFlags.crosshairEnabled,
      hotbarEnabled: bootstrap.featureFlags.hotbarEnabled,
      creativeLibraryEnabled: bootstrap.creativeLibrary.enabled,
      warnings: bootstrap.diagnostics.warnings,
    });

    return freezeShallow(bootstrap);
  } catch (error) {
    logError(context, "Editor bootstrap normalization failed. Safe fallback bootstrap was returned.", {
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackProjectId = selectChunkProjectIdCandidate([options.projectId]) || DEFAULT_PROJECT_ID;
    const fallbackWorldId = selectChunkWorldIdCandidate([options.worldId]) || DEFAULT_WORLD_ID;
    const fallback = createDefaultEditorBootstrap({
      buildMode: readString(options.buildMode, "development"),
      buildVersion: readString(options.buildVersion, "0.1.0"),
      chunkProxyBaseUrl: sanitizeEditorChunkProxyBaseUrl(options.chunkProxyBaseUrl, DEFAULT_CHUNK_PROXY_BASE_URL),
      projectId: fallbackProjectId,
      worldId: fallbackWorldId,
      localWorldFallbackEnabled: false,
    });

    return {
      ...fallback,
      diagnostics: {
        ...fallback.diagnostics,
        source: "fallback",
        warnings: [...context.warnings],
        normalizedAt: nowIsoStringSafe(),
        rawAvailable: rawInput !== undefined && rawInput !== null,
      },
      raw: rawInput,
    };
  }
}

export function getChunkWorldMetadataFromBootstrap(
  bootstrap: EditorBootstrap,
): EditorChunkWorldMetadataWithProject {
  try {
    const chunkRecord = bootstrap.runtime.chunk as unknown as UnknownRecord;
    const projectId = selectChunkProjectIdCandidate([
      chunkRecord.chunkProjectId,
      bootstrap.runtime.chunk.projectId,
    ]) || DEFAULT_PROJECT_ID;
    const worldId = selectChunkWorldIdCandidate([
      chunkRecord.chunkWorldId,
      bootstrap.runtime.chunk.worldId,
    ]) || DEFAULT_WORLD_ID;

    return {
      ...buildDefaultChunkWorldMetadata(),
      projectId,
      worldId,
    };
  } catch {
    return {
      ...buildDefaultChunkWorldMetadata(),
      projectId: DEFAULT_PROJECT_ID,
      worldId: DEFAULT_WORLD_ID,
    };
  }
}

function isEditorJsonObject(value: EditorJsonValue): value is EditorJsonObject {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function toJsonPrimitive(value: unknown): EditorJsonPrimitive | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  return null;
}

function toJsonValue(value: unknown, depth = 0): EditorJsonValue {
  try {
    if (depth > MAX_DEBUG_JSON_DEPTH) {
      return "[max-depth]";
    }

    const primitive = toJsonPrimitive(value);
    if (primitive !== null || value === null || value === undefined) {
      return primitive;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      const arrayValue: EditorJsonValue[] = value.map((item) => toJsonValue(item, depth + 1));
      return arrayValue as EditorJsonArray;
    }

    if (isRecord(value)) {
      const output: Record<string, EditorJsonValue> = {};

      for (const [key, nestedValue] of Object.entries(value)) {
        output[key] = toJsonValue(nestedValue, depth + 1);
      }

      return output as EditorJsonObject;
    }

    return String(value);
  } catch {
    return null;
  }
}

function toJsonObject(value: unknown): EditorJsonObject {
  const json = toJsonValue(value);

  if (isEditorJsonObject(json)) {
    return json;
  }

  return {} as EditorJsonObject;
}

export function serializeBootstrapForDebug(bootstrap: EditorBootstrap): EditorJsonObject {
  try {
    const chunkRecord = bootstrap.runtime.chunk as unknown as UnknownRecord;

    return {
      schemaVersion: bootstrap.schemaVersion,
      app: toJsonObject(bootstrap.app),
      project: toJsonObject(bootstrap.project),
      runtime: {
        mode: bootstrap.runtime.mode,
        worldMode: bootstrap.runtime.worldMode,
        sourceMode: bootstrap.runtime.sourceMode,
        localWorldFallbackEnabled: false,
        legacyFrontendEnabled: false,
        chunk: toJsonObject(bootstrap.runtime.chunk),
        physics: toJsonObject(bootstrap.runtime.physics),
        inventory: toJsonObject(bootstrap.runtime.inventory),
        library: toJsonObject(bootstrap.runtime.library),
      } as EditorJsonObject,
      featureFlags: toJsonObject(bootstrap.featureFlags),
      ui: toJsonObject(bootstrap.ui),
      input: toJsonObject(bootstrap.input),
      camera: toJsonObject(bootstrap.camera),
      render: toJsonObject(bootstrap.render),
      inventory: toJsonObject(bootstrap.inventory),
      creativeLibrary: toJsonObject(bootstrap.creativeLibrary),
      physics: toJsonObject(bootstrap.physics),
      diagnostics: toJsonObject(bootstrap.diagnostics),
      chunkIdentity: {
        projectId: toJsonPrimitive(bootstrap.runtime.chunk.projectId),
        chunkProjectId: toJsonPrimitive(chunkRecord.chunkProjectId),
        appProjectPublicId: toJsonPrimitive(chunkRecord.appProjectPublicId),
        projectPublicId: toJsonPrimitive(chunkRecord.projectPublicId),
        worldId: toJsonPrimitive(bootstrap.runtime.chunk.worldId),
        chunkWorldId: toJsonPrimitive(chunkRecord.chunkWorldId),
        ready: toJsonPrimitive(chunkRecord.ready),
        chunkReady: toJsonPrimitive(chunkRecord.chunkReady),
        status: toJsonPrimitive(chunkRecord.status),
        chunkStatus: toJsonPrimitive(chunkRecord.chunkStatus),
        identityValid: toJsonPrimitive(chunkRecord.identityValid),
        identityWarnings: toJsonValue(chunkRecord.identityWarnings),
        identityDiagnostics: toJsonValue(chunkRecord.identityDiagnostics),
        proxyDiagnostics: toJsonValue(chunkRecord.proxyDiagnostics),
      } as EditorJsonObject,
      rules: {
        inventoryTruth: "/editor/api/inventory",
        browserDoesNotCallVectoplanLibraryDirectly: true,
        chunkPlaceableBlocksAreDiagnosticOnly: true,
        debugGrassDirtAllowed: false,
        onlyLibraryItemsPlaceable: true,
        runtimeProjectIdIsChunkProjectId: true,
        runtimeWorldIdIsChunkWorldId: true,
        appProjectIdNeverUsedAsChunkProjectId: true,
        criticalChunkRoutesRebuiltFromValidatedChunkIdentity: true,
        chunkReadyForcedWhenValidChunkIdsExistUnlessErrorOrDisabled: true,
        editorChunkProxyUrlNormalizedThroughContract: true,
      },
    } as EditorJsonObject;
  } catch {
    return {
      schemaVersion: EDITOR_BOOTSTRAP_SCHEMA_VERSION,
      error: "bootstrap_debug_serialization_failed",
    } as EditorJsonObject;
  }
}

export function getNormalizeBootstrapMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.bootstrap.normalize_bootstrap",
    supportsLibraryInventory: true,
    supportsRuntimeInventoryConfig: true,
    supportsRuntimeLibraryConfig: true,
    supportsChunkProjectIdAliases: true,
    supportsChunkWorldIdAliases: true,
    primaryInventoryRoute: DEFAULT_EDITOR_INVENTORY_API_URL,
    primaryCreativeLibraryRoute: DEFAULT_CREATIVE_LIBRARY_API_URL,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      normalizedInventorySource: DEFAULT_INVENTORY_SOURCE_KIND,
      normalizedInventoryKind: DEFAULT_INVENTORY_ITEM_KIND,
      chunkPlaceableBlocksIgnoredAsInventoryTruth: true,
      legacyChunkInventoryFlagsForcedOff: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      runtimeProjectIdIsChunkProjectId: true,
      runtimeWorldIdIsChunkWorldId: true,

      appProjectIdNeverUsedAsChunkProjectId: true,
      appProjectIdKeptAsAppContextOnly: true,
      criticalChunkRouteHintsRebuiltFromNormalizedIds: true,
      criticalChunkRouteHintsWithAppProjectIdIgnored: true,
      editorChunkProxyUrlNormalizedThroughContract: true,
      appOriginEditorProxyRejected: true,
      directChunkServiceUrlRejectedByDefault: true,
      chunkReadyForcedWhenValidChunkIdsExistUnlessErrorOrDisabled: true,
    },
  };
}
