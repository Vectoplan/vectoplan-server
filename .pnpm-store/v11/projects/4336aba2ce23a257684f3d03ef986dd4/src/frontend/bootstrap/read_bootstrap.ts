// services/vectoplan-editor/src/frontend/bootstrap/read_bootstrap.ts
import { createDefaultEditorBootstrap } from "./default_bootstrap";
import {
  DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK,
  DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
  DEFAULT_CHUNK_PROXY_BASE_URL,
  DEFAULT_CREATIVE_LIBRARY_API_URL,
  DEFAULT_CREATIVE_LIBRARY_ENABLED,
  DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
  DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
  DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
  DEFAULT_DEBUG_GRASS_DIRT_ALLOWED,
  DEFAULT_EDITOR_FRONTEND_ROOT,
  DEFAULT_EDITOR_INVENTORY_API_URL,
  DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
  DEFAULT_EDITOR_INVENTORY_METADATA_URL,
  DEFAULT_EDITOR_RUNTIME_MODE,
  DEFAULT_EDITOR_WORLD_MODE,
  DEFAULT_EDITOR_WORLD_SOURCE_MODE,
  DEFAULT_FALLBACK_BLOCK_TYPE_IDS,
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
  DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
  DEFAULT_PROJECT_ID,
  DEFAULT_WORLD_ID,
  type EditorBootstrapDefaults,
  type EditorBootstrapLogger,
  type EditorBootstrapReadOptions,
  type EditorDatasetChunkGlobals,
  type EditorDatasetInventoryGlobals,
  type EditorDatasetPhysicsGlobals,
  type EditorRawBootstrapSources,
  type EditorWindowChunkGlobals,
  type EditorWindowInventoryGlobals,
  type EditorWindowLibraryGlobals,
  type EditorWindowPhysicsGlobals,
  type UnknownRecord,
} from "./bootstrap_models";
import {
  canonicalChunkIdentityToRecord,
  chunkIdentityIssuesToWarnings,
  isLikelyAppProjectId,
  isValidChunkProjectId,
  isValidConcreteChunkWorldId,
  resolveChunkIdentity,
} from "../utils/chunk_identity_contract";
import {
  editorChunkProxyUrlIssuesToWarnings,
  editorChunkProxyUrlResultToRecord,
  normalizeEditorChunkProxyBaseUrl,
  resolveEditorChunkProxyBaseUrl,
} from "../utils/editor_chunk_proxy_url";

const WINDOW_BOOTSTRAP_KEY = "__VECTOPLAN_EDITOR_BOOTSTRAP__";

const WINDOW_CHUNK_API_BASE_URL_KEY = "__VECTOPLAN_EDITOR_CHUNK_API_BASE_URL__";
const WINDOW_CHUNK_BROWSER_BASE_URL_KEY = "__VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL__";
const WINDOW_CHUNK_PROJECT_ID_KEY = "__VECTOPLAN_EDITOR_CHUNK_PROJECT_ID__";
const WINDOW_CHUNK_WORLD_ID_KEY = "__VECTOPLAN_EDITOR_CHUNK_WORLD_ID__";
const WINDOW_CHUNK_ROUTE_HINTS_KEY = "__VECTOPLAN_EDITOR_CHUNK_ROUTE_HINTS__";
const WINDOW_CHUNK_SERVICE_CONFIG_KEY = "__VECTOPLAN_EDITOR_CHUNK_SERVICE_CONFIG__";

const WINDOW_APP_PROJECT_PUBLIC_ID_KEY = "__VECTOPLAN_EDITOR_APP_PROJECT_PUBLIC_ID__";
const WINDOW_PROJECT_PUBLIC_ID_KEY = "__VECTOPLAN_EDITOR_PROJECT_PUBLIC_ID__";
const WINDOW_LEGACY_PROJECT_ID_KEY = "__VECTOPLAN_EDITOR_PROJECT_ID__";
const WINDOW_DEFAULT_PROJECT_ID_KEY = "__VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__";
const WINDOW_DEFAULT_WORLD_ID_KEY = "__VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__";

const WINDOW_INVENTORY_CONFIG_KEY = "__VECTOPLAN_EDITOR_INVENTORY_CONFIG__";
const WINDOW_INVENTORY_ENABLED_KEY = "__VECTOPLAN_EDITOR_INVENTORY_ENABLED__";
const WINDOW_INVENTORY_SOURCE_KEY = "__VECTOPLAN_EDITOR_INVENTORY_SOURCE__";
const WINDOW_INVENTORY_KIND_KEY = "__VECTOPLAN_EDITOR_INVENTORY_KIND__";
const WINDOW_INVENTORY_API_URL_KEY = "__VECTOPLAN_EDITOR_INVENTORY_API_URL__";
const WINDOW_INVENTORY_URL_KEY = "__VECTOPLAN_EDITOR_INVENTORY_URL__";
const WINDOW_INVENTORY_ROUTE_KEY = "__VECTOPLAN_EDITOR_INVENTORY_ROUTE__";
const WINDOW_INVENTORY_HEALTH_URL_KEY = "__VECTOPLAN_EDITOR_INVENTORY_HEALTH_URL__";
const WINDOW_INVENTORY_METADATA_URL_KEY = "__VECTOPLAN_EDITOR_INVENTORY_METADATA_URL__";
const WINDOW_INVENTORY_HOTBAR_SIZE_KEY = "__VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE__";
const WINDOW_INVENTORY_SELECTED_SLOT_KEY = "__VECTOPLAN_EDITOR_INVENTORY_SELECTED_SLOT__";
const WINDOW_INVENTORY_FORCE_REFRESH_KEY = "__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT__";

const WINDOW_LIBRARY_CONFIG_KEY = "__VECTOPLAN_EDITOR_LIBRARY_CONFIG__";
const WINDOW_LIBRARY_ENABLED_KEY = "__VECTOPLAN_EDITOR_LIBRARY_ENABLED__";
const WINDOW_LIBRARY_API_URL_KEY = "__VECTOPLAN_EDITOR_LIBRARY_API_URL__";
const WINDOW_LIBRARY_BROWSER_API_URL_KEY = "__VECTOPLAN_EDITOR_LIBRARY_BROWSER_API_URL__";
const WINDOW_LIBRARY_INVENTORY_ROUTE_KEY = "__VECTOPLAN_EDITOR_LIBRARY_INVENTORY_ROUTE__";
const WINDOW_LIBRARY_CREATIVE_ROUTE_KEY = "__VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__";
const WINDOW_LIBRARY_HEALTH_ROUTE_KEY = "__VECTOPLAN_EDITOR_LIBRARY_HEALTH_ROUTE__";
const WINDOW_LIBRARY_METADATA_ROUTE_KEY = "__VECTOPLAN_EDITOR_LIBRARY_METADATA_ROUTE__";

const WINDOW_PHYSICS_CONFIG_KEY = "__VECTOPLAN_EDITOR_PHYSICS_CONFIG__";
const WINDOW_PHYSICS_ENABLED_KEY = "__VECTOPLAN_EDITOR_PHYSICS_ENABLED__";
const WINDOW_PHYSICS_MODE_KEY = "__VECTOPLAN_EDITOR_PHYSICS_MODE__";
const WINDOW_PHYSICS_TIMING_KEY = "__VECTOPLAN_EDITOR_PHYSICS_TIMING__";
const WINDOW_PHYSICS_MOVEMENT_KEY = "__VECTOPLAN_EDITOR_PHYSICS_MOVEMENT__";
const WINDOW_PHYSICS_INPUT_KEY = "__VECTOPLAN_EDITOR_PHYSICS_INPUT__";
const WINDOW_PHYSICS_COLLIDER_KEY = "__VECTOPLAN_EDITOR_PHYSICS_COLLIDER__";
const WINDOW_PHYSICS_MISSING_CHUNKS_KEY = "__VECTOPLAN_EDITOR_PHYSICS_MISSING_CHUNKS__";
const WINDOW_PHYSICS_DEBUG_KEY = "__VECTOPLAN_EDITOR_PHYSICS_DEBUG__";

const ROOT_SELECTOR = "[data-editor-root], [data-vectoplan-editor-root], #vectoplan-editor-root";

const FORBIDDEN_DEBUG_BLOCK_TYPE_IDS = new Set<string>([
  "debug_grass",
  "debug_dirt",
]);

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

type WindowRecord = Record<string, unknown>;

interface SafeReadContext {
  readonly logger?: EditorBootstrapLogger;
  readonly source: string;
}

function logDebug(context: SafeReadContext, message: string, details?: Record<string, unknown>): void {
  try {
    context.logger?.debug?.(message, {
      source: context.source,
      ...(details ?? {}),
    });
  } catch {
    // Bootstrap logging must never break reading.
  }
}

function logWarn(context: SafeReadContext, message: string, details?: Record<string, unknown>): void {
  try {
    context.logger?.warn?.(message, {
      source: context.source,
      ...(details ?? {}),
    });
  } catch {
    // Bootstrap logging must never break reading.
  }
}

function logError(context: SafeReadContext, message: string, details?: Record<string, unknown>): void {
  try {
    context.logger?.error?.(message, {
      source: context.source,
      ...(details ?? {}),
    });
  } catch {
    // Bootstrap logging must never break reading.
  }
}

function getWindowRecord(): WindowRecord | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    return window as unknown as WindowRecord;
  } catch {
    return null;
  }
}

function getDocumentRootElement(): HTMLElement | null {
  try {
    if (typeof document === "undefined") {
      return null;
    }

    return document.querySelector<HTMLElement>(ROOT_SELECTOR);
  } catch {
    return null;
  }
}

function getWindowValue(key: string): unknown {
  try {
    return getWindowRecord()?.[key];
  } catch {
    return undefined;
  }
}

function isObjectLike(value: unknown): value is UnknownRecord {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function asRecord(value: unknown): UnknownRecord {
  try {
    return isObjectLike(value) ? value : {};
  } catch {
    return {};
  }
}

function safeString(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
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

function setOptionalUnknown(target: Record<string, unknown>, key: string, value: unknown): void {
  try {
    if (value !== undefined && value !== null) {
      target[key] = value;
    }
  } catch {
    // Ignore individual field failure.
  }
}

function setOptionalString(target: Record<string, string>, key: string, value: unknown): void {
  try {
    const normalized = safeString(value, "");

    if (normalized.length > 0) {
      target[key] = normalized;
    }
  } catch {
    // Ignore individual field failure.
  }
}

function firstNonEmptyUnknown(...values: readonly unknown[]): unknown {
  try {
    for (const value of values) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();

        if (trimmed.length > 0) {
          return trimmed;
        }

        continue;
      }

      return value;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function firstNonEmptyString(...values: readonly unknown[]): string {
  try {
    const value = firstNonEmptyUnknown(...values);
    return safeString(value, "");
  } catch {
    return "";
  }
}

function normalizeChunkStatus(value: unknown, fallback = "pending"): string {
  try {
    const normalized = safeString(value, "").trim().toLowerCase().replace(/[-\s]+/g, "_");

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

function selectChunkProjectIdCandidate(...values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const normalized = safeString(value, "");

      if (!normalized) {
        continue;
      }

      if (isValidRuntimeChunkProjectId(normalized)) {
        return normalized;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function selectChunkWorldIdCandidate(...values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const normalized = safeString(value, "");

      if (!normalized) {
        continue;
      }

      if (isValidRuntimeChunkWorldId(normalized)) {
        return normalized;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function selectAppProjectPublicIdCandidate(...values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const normalized = safeString(value, "");

      if (normalized && isLikelyAppProjectId(normalized)) {
        return normalized;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function normalizeEditorProxyBaseUrlForBootstrap(value: unknown, context: SafeReadContext): string {
  try {
    const result = resolveEditorChunkProxyBaseUrl(value, {
      defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
    });

    for (const warning of editorChunkProxyUrlIssuesToWarnings(result.issues)) {
      logWarn(context, "Editor chunk proxy URL was normalized.", {
        warning,
        raw: result.raw,
        normalized: result.baseUrl,
      });
    }

    return result.baseUrl;
  } catch (error) {
    logWarn(context, "Editor chunk proxy URL could not be normalized. Falling back to default proxy.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return normalizeEditorChunkProxyBaseUrl(DEFAULT_CHUNK_PROXY_BASE_URL);
  }
}

function routeHintContainsAppProjectId(value: unknown): boolean {
  try {
    const text = safeString(value, "");

    return /\/projects\/prj_[^/]+/i.test(text) && !/\/projects\/chk_prj_/i.test(text);
  } catch {
    return false;
  }
}

function sanitizeRouteHintsObject(
  routeHints: UnknownRecord | undefined,
  context: SafeReadContext,
): UnknownRecord | undefined {
  try {
    if (!routeHints) {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(routeHints)) {
      if (CRITICAL_CHUNK_ROUTE_HINT_KEYS.has(key) && routeHintContainsAppProjectId(value)) {
        logWarn(context, "Critical chunk route hint with app project id was ignored.", {
          key,
          value,
          expectedProjectIdPrefix: "chk_prj_",
        });
        continue;
      }

      sanitized[key] = value;
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  } catch {
    return routeHints;
  }
}

function normalizeRouteHintsFromValue(value: unknown, context: SafeReadContext): UnknownRecord | undefined {
  return sanitizeRouteHintsObject(normalizeJsonObjectFromValue(value, context), context);
}

function normalizeServiceConfigFromValue(value: unknown, context: SafeReadContext): UnknownRecord | undefined {
  return normalizeJsonObjectFromValue(value, context);
}

function normalizeInventoryConfigFromValue(value: unknown, context: SafeReadContext): UnknownRecord | undefined {
  return normalizeJsonObjectFromValue(value, context);
}

function normalizeLibraryConfigFromValue(value: unknown, context: SafeReadContext): UnknownRecord | undefined {
  return normalizeJsonObjectFromValue(value, context);
}

function normalizePhysicsConfigFromValue(value: unknown, context: SafeReadContext): UnknownRecord | undefined {
  return normalizeJsonObjectFromValue(value, context);
}

function cloneDataset(dataset: DOMStringMap | undefined | null): DOMStringMap {
  const clone: Record<string, string> = {};

  try {
    if (!dataset) {
      return clone as DOMStringMap;
    }

    for (const key of Object.keys(dataset)) {
      const value = dataset[key];

      if (typeof value === "string") {
        clone[key] = value;
      }
    }

    return clone as DOMStringMap;
  } catch {
    return clone as DOMStringMap;
  }
}

function parseJsonSafely(value: unknown, context: SafeReadContext): unknown {
  try {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return undefined;
    }

    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    logWarn(context, "JSON bootstrap value could not be parsed.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return undefined;
  }
}

function parseJsonObjectSafely(value: unknown, context: SafeReadContext): UnknownRecord | undefined {
  try {
    const parsed = parseJsonSafely(value, context);

    if (isObjectLike(parsed)) {
      return parsed;
    }

    return undefined;
  } catch (error) {
    logWarn(context, "JSON object bootstrap value could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return undefined;
  }
}

function readRecordPath(root: unknown, path: readonly string[]): UnknownRecord | undefined {
  try {
    let current = root;

    for (const segment of path) {
      if (!isObjectLike(current)) {
        return undefined;
      }

      current = current[segment];
    }

    return isObjectLike(current) ? current : undefined;
  } catch {
    return undefined;
  }
}

function readUnknownPath(root: unknown, path: readonly string[]): unknown {
  try {
    let current = root;

    for (const segment of path) {
      if (!isObjectLike(current)) {
        return undefined;
      }

      current = current[segment];
    }

    return current;
  } catch {
    return undefined;
  }
}

function mergeRecords(...records: readonly (UnknownRecord | undefined)[]): UnknownRecord {
  const merged: Record<string, unknown> = {};

  try {
    for (const record of records) {
      if (!record) {
        continue;
      }

      Object.assign(merged, record);
    }
  } catch {
    // Return partial merge.
  }

  return merged;
}

function mergeNestedRecords(
  base: UnknownRecord | undefined,
  patch: UnknownRecord | undefined,
): UnknownRecord | undefined {
  try {
    if (!base && !patch) {
      return undefined;
    }

    if (!base) {
      return patch;
    }

    if (!patch) {
      return base;
    }

    const result: Record<string, unknown> = {
      ...base,
      ...patch,
    };

    for (const key of Object.keys(patch)) {
      const baseValue = base[key];
      const patchValue = patch[key];

      if (isObjectLike(baseValue) && isObjectLike(patchValue)) {
        result[key] = mergeNestedRecords(baseValue, patchValue);
      }
    }

    return result;
  } catch {
    return patch ?? base;
  }
}

function normalizeJsonObjectFromValue(value: unknown, context: SafeReadContext): UnknownRecord | undefined {
  try {
    if (isObjectLike(value)) {
      return value;
    }

    return parseJsonObjectSafely(value, context);
  } catch {
    return undefined;
  }
}

function sanitizeInventorySource(value: unknown): string {
  const normalized = safeString(value, DEFAULT_INVENTORY_SOURCE_KIND);

  if (
    normalized === "library"
    || normalized === "vectoplan-library"
    || normalized === "vectoplan-user-inventory"
    || normalized === "editor-inventory"
    || normalized === "vplib"
    || normalized === "library-service"
    || normalized === "creative-library"
  ) {
    return normalized;
  }

  return DEFAULT_INVENTORY_SOURCE_KIND;
}

function sanitizeInventoryKind(value: unknown): string {
  const normalized = safeString(value, DEFAULT_INVENTORY_ITEM_KIND);

  if (normalized === "vplib" || normalized === "library-item" || normalized === "asset") {
    return normalized;
  }

  return DEFAULT_INVENTORY_ITEM_KIND;
}

function sanitizeMaybeBlockTypeId(value: unknown): string | null {
  const normalized = safeString(value, "").trim();

  if (!normalized || FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.has(normalized)) {
    return null;
  }

  return normalized;
}

function sanitizeFallbackBlockTypeIds(value: unknown): readonly string[] {
  try {
    if (!Array.isArray(value)) {
      return DEFAULT_FALLBACK_BLOCK_TYPE_IDS;
    }

    const sanitized = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && !FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.has(item));

    return sanitized.length > 0 ? sanitized : DEFAULT_FALLBACK_BLOCK_TYPE_IDS;
  } catch {
    return DEFAULT_FALLBACK_BLOCK_TYPE_IDS;
  }
}

function readWindowBootstrap(context: SafeReadContext): unknown {
  try {
    const value = getWindowValue(WINDOW_BOOTSTRAP_KEY);

    if (value === undefined || value === null) {
      logDebug(context, "Window bootstrap was not present.");
      return undefined;
    }

    const parsed = typeof value === "string"
      ? parseJsonSafely(value, {
          ...context,
          source: `${context.source}.json`,
        })
      : value;

    logDebug(context, "Window bootstrap was found.", {
      valueType: typeof value,
      parsedType: typeof parsed,
      objectLike: isObjectLike(parsed),
    });

    return parsed ?? value;
  } catch (error) {
    logWarn(context, "Window bootstrap could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return undefined;
  }
}

function readWindowChunkGlobals(context: SafeReadContext): EditorWindowChunkGlobals {
  const result: Record<string, unknown> = {};

  try {
    const explicitChunkProjectId = firstNonEmptyUnknown(
      getWindowValue(WINDOW_CHUNK_PROJECT_ID_KEY),
      getWindowValue("__VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID__"),
    );
    const legacyProjectId = firstNonEmptyUnknown(
      getWindowValue(WINDOW_LEGACY_PROJECT_ID_KEY),
      getWindowValue(WINDOW_DEFAULT_PROJECT_ID_KEY),
    );
    const windowChunkProjectId = selectChunkProjectIdCandidate(
      explicitChunkProjectId,
      legacyProjectId,
    );
    const windowAppProjectId = selectAppProjectPublicIdCandidate(
      getWindowValue(WINDOW_APP_PROJECT_PUBLIC_ID_KEY),
      getWindowValue(WINDOW_PROJECT_PUBLIC_ID_KEY),
      legacyProjectId,
    );
    const windowUniverseId = firstNonEmptyUnknown(
      getWindowValue("__VECTOPLAN_EDITOR_CHUNK_UNIVERSE_ID__"),
      getWindowValue("__VECTOPLAN_EDITOR_UNIVERSE_ID__"),
    );
    const windowWorldId = selectChunkWorldIdCandidate(
      getWindowValue(WINDOW_CHUNK_WORLD_ID_KEY),
      getWindowValue("__VECTOPLAN_EDITOR_WORLD_ID__"),
      getWindowValue(WINDOW_DEFAULT_WORLD_ID_KEY),
    );
    const windowReady = firstNonEmptyUnknown(
      getWindowValue("__VECTOPLAN_EDITOR_CHUNK_READY__"),
      getWindowValue("__VECTOPLAN_EDITOR_CHUNK_CONTEXT_READY__"),
    );
    const windowStatus = firstNonEmptyUnknown(
      getWindowValue("__VECTOPLAN_EDITOR_CHUNK_STATUS__"),
      getWindowValue("__VECTOPLAN_EDITOR_CHUNK_CONTEXT_STATUS__"),
    );

    const apiBaseUrl = normalizeEditorProxyBaseUrlForBootstrap(
      firstNonEmptyUnknown(
        getWindowValue(WINDOW_CHUNK_API_BASE_URL_KEY),
        getWindowValue("__VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__"),
      ),
      {
        ...context,
        source: `${context.source}.apiBaseUrl`,
      },
    );

    setOptionalUnknown(result, "apiBaseUrl", apiBaseUrl);
    setOptionalUnknown(result, "browserBaseUrl", normalizeEditorProxyBaseUrlForBootstrap(
      firstNonEmptyUnknown(getWindowValue(WINDOW_CHUNK_BROWSER_BASE_URL_KEY), apiBaseUrl),
      {
        ...context,
        source: `${context.source}.browserBaseUrl`,
      },
    ));

    setOptionalUnknown(result, "projectId", windowChunkProjectId);
    setOptionalUnknown(result, "chunkProjectId", windowChunkProjectId);
    setOptionalUnknown(result, "appProjectPublicId", windowAppProjectId);
    setOptionalUnknown(result, "projectPublicId", windowAppProjectId);

    setOptionalUnknown(result, "universeId", windowUniverseId);
    setOptionalUnknown(result, "chunkUniverseId", windowUniverseId);
    setOptionalUnknown(result, "worldId", windowWorldId);
    setOptionalUnknown(result, "chunkWorldId", windowWorldId);
    setOptionalUnknown(result, "chunkReady", windowReady);
    setOptionalUnknown(result, "ready", windowReady);
    setOptionalUnknown(result, "chunkStatus", windowStatus);
    setOptionalUnknown(result, "status", windowStatus);

    if (!windowChunkProjectId && isLikelyAppProjectId(legacyProjectId)) {
      setOptionalUnknown(result, "rejectedProjectId", safeString(legacyProjectId, ""));
      logWarn(context, "Window project id was rejected as chunk project id.", {
        rejectedProjectId: legacyProjectId,
        expectedChunkProjectPrefix: "chk_prj_",
      });
    }

    const routeHints = getWindowValue(WINDOW_CHUNK_ROUTE_HINTS_KEY);
    const serviceConfig = getWindowValue(WINDOW_CHUNK_SERVICE_CONFIG_KEY);

    setOptionalUnknown(
      result,
      "routeHints",
      typeof routeHints === "string"
        ? normalizeRouteHintsFromValue(routeHints, {
            ...context,
            source: `${context.source}.routeHints`,
          }) ?? routeHints
        : sanitizeRouteHintsObject(asRecord(routeHints), {
            ...context,
            source: `${context.source}.routeHints`,
          }),
    );

    setOptionalUnknown(
      result,
      "serviceConfig",
      typeof serviceConfig === "string"
        ? normalizeServiceConfigFromValue(serviceConfig, {
            ...context,
            source: `${context.source}.serviceConfig`,
          }) ?? serviceConfig
        : serviceConfig,
    );

    logDebug(context, "Window chunk globals were read.", {
      keys: Object.keys(result),
      chunkProjectId: result.chunkProjectId ?? null,
      appProjectPublicId: result.appProjectPublicId ?? null,
      rejectedProjectId: result.rejectedProjectId ?? null,
    });

    return result as EditorWindowChunkGlobals;
  } catch (error) {
    logWarn(context, "Window chunk globals could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {};
  }
}

function readWindowInventoryGlobals(context: SafeReadContext): EditorWindowInventoryGlobals {
  const result: Record<string, unknown> = {};

  try {
    const fullConfig = getWindowValue(WINDOW_INVENTORY_CONFIG_KEY);

    if (fullConfig !== undefined) {
      const config = normalizeInventoryConfigFromValue(fullConfig, {
        ...context,
        source: `${context.source}.config`,
      });

      if (config) {
        Object.assign(result, config);
      }
    }

    setOptionalUnknown(result, "enabled", getWindowValue(WINDOW_INVENTORY_ENABLED_KEY));
    setOptionalUnknown(result, "source", sanitizeInventorySource(getWindowValue(WINDOW_INVENTORY_SOURCE_KEY)));
    setOptionalUnknown(result, "kind", sanitizeInventoryKind(getWindowValue(WINDOW_INVENTORY_KIND_KEY)));
    setOptionalUnknown(result, "apiUrl", getWindowValue(WINDOW_INVENTORY_API_URL_KEY));
    setOptionalUnknown(result, "inventoryUrl", getWindowValue(WINDOW_INVENTORY_URL_KEY));
    setOptionalUnknown(result, "route", getWindowValue(WINDOW_INVENTORY_ROUTE_KEY));
    setOptionalUnknown(result, "healthUrl", getWindowValue(WINDOW_INVENTORY_HEALTH_URL_KEY));
    setOptionalUnknown(result, "metadataUrl", getWindowValue(WINDOW_INVENTORY_METADATA_URL_KEY));
    setOptionalUnknown(result, "hotbarSize", getWindowValue(WINDOW_INVENTORY_HOTBAR_SIZE_KEY));
    setOptionalUnknown(result, "slotCount", getWindowValue(WINDOW_INVENTORY_HOTBAR_SIZE_KEY));
    setOptionalUnknown(result, "selectedSlot", getWindowValue(WINDOW_INVENTORY_SELECTED_SLOT_KEY));
    setOptionalUnknown(result, "defaultSelectedSlot", getWindowValue(WINDOW_INVENTORY_SELECTED_SLOT_KEY));
    setOptionalUnknown(result, "forceRefreshOnBoot", getWindowValue(WINDOW_INVENTORY_FORCE_REFRESH_KEY));
    setOptionalUnknown(result, "includeEmptySlots", DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS);
    setOptionalUnknown(result, "allowEmptyFallback", DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK);
    setOptionalUnknown(result, "onlyLibraryItemsPlaceable", true);
    setOptionalUnknown(result, "debugGrassDirtAllowed", false);
    setOptionalUnknown(result, "allowChunkPlaceableFallback", false);

    logDebug(context, "Window inventory globals were read.", {
      keys: Object.keys(result),
      source: result.source,
      kind: result.kind,
      apiUrl: result.apiUrl,
    });

    return result as EditorWindowInventoryGlobals;
  } catch (error) {
    logWarn(context, "Window inventory globals could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {};
  }
}

function readWindowLibraryGlobals(context: SafeReadContext): EditorWindowLibraryGlobals {
  const result: Record<string, unknown> = {};

  try {
    const fullConfig = getWindowValue(WINDOW_LIBRARY_CONFIG_KEY);

    if (fullConfig !== undefined) {
      const config = normalizeLibraryConfigFromValue(fullConfig, {
        ...context,
        source: `${context.source}.config`,
      });

      if (config) {
        Object.assign(result, config);
      }
    }

    setOptionalUnknown(result, "enabled", getWindowValue(WINDOW_LIBRARY_ENABLED_KEY));
    setOptionalUnknown(result, "apiUrl", getWindowValue(WINDOW_LIBRARY_API_URL_KEY));
    setOptionalUnknown(result, "browserApiUrl", getWindowValue(WINDOW_LIBRARY_BROWSER_API_URL_KEY));
    setOptionalUnknown(result, "inventoryRoute", getWindowValue(WINDOW_LIBRARY_INVENTORY_ROUTE_KEY));
    setOptionalUnknown(result, "creativeLibraryRoute", getWindowValue(WINDOW_LIBRARY_CREATIVE_ROUTE_KEY));
    setOptionalUnknown(result, "healthRoute", getWindowValue(WINDOW_LIBRARY_HEALTH_ROUTE_KEY));
    setOptionalUnknown(result, "metadataRoute", getWindowValue(WINDOW_LIBRARY_METADATA_ROUTE_KEY));
    setOptionalUnknown(result, "browserCallsLibraryDirectly", false);

    logDebug(context, "Window library globals were read.", {
      keys: Object.keys(result),
      apiUrl: result.apiUrl,
      inventoryRoute: result.inventoryRoute,
      creativeLibraryRoute: result.creativeLibraryRoute,
    });

    return result as EditorWindowLibraryGlobals;
  } catch (error) {
    logWarn(context, "Window library globals could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {};
  }
}

function readWindowPhysicsGlobals(context: SafeReadContext): EditorWindowPhysicsGlobals {
  const result: Record<string, unknown> = {};

  try {
    const fullConfig = getWindowValue(WINDOW_PHYSICS_CONFIG_KEY);

    if (fullConfig !== undefined) {
      const normalizedFullConfig = normalizePhysicsConfigFromValue(fullConfig, {
        ...context,
        source: `${context.source}.config`,
      });

      if (normalizedFullConfig) {
        Object.assign(result, normalizedFullConfig);
      }
    }

    setOptionalUnknown(result, "enabled", getWindowValue(WINDOW_PHYSICS_ENABLED_KEY));
    setOptionalUnknown(result, "mode", getWindowValue(WINDOW_PHYSICS_MODE_KEY));

    const timing = normalizePhysicsConfigFromValue(getWindowValue(WINDOW_PHYSICS_TIMING_KEY), {
      ...context,
      source: `${context.source}.timing`,
    });
    const movement = normalizePhysicsConfigFromValue(getWindowValue(WINDOW_PHYSICS_MOVEMENT_KEY), {
      ...context,
      source: `${context.source}.movement`,
    });
    const input = normalizePhysicsConfigFromValue(getWindowValue(WINDOW_PHYSICS_INPUT_KEY), {
      ...context,
      source: `${context.source}.input`,
    });
    const collider = normalizePhysicsConfigFromValue(getWindowValue(WINDOW_PHYSICS_COLLIDER_KEY), {
      ...context,
      source: `${context.source}.collider`,
    });
    const missingChunks = normalizePhysicsConfigFromValue(getWindowValue(WINDOW_PHYSICS_MISSING_CHUNKS_KEY), {
      ...context,
      source: `${context.source}.missingChunks`,
    });
    const debug = normalizePhysicsConfigFromValue(getWindowValue(WINDOW_PHYSICS_DEBUG_KEY), {
      ...context,
      source: `${context.source}.debug`,
    });

    setOptionalUnknown(result, "timing", timing);
    setOptionalUnknown(result, "movement", movement);
    setOptionalUnknown(result, "input", input);
    setOptionalUnknown(result, "collider", collider);
    setOptionalUnknown(result, "missingChunks", missingChunks);
    setOptionalUnknown(result, "debug", debug);

    logDebug(context, "Window physics globals were read.", {
      keys: Object.keys(result),
    });

    return result as EditorWindowPhysicsGlobals;
  } catch (error) {
    logWarn(context, "Window physics globals could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {};
  }
}

function readDatasetChunkGlobals(
  dataset: DOMStringMap,
  context: SafeReadContext,
): EditorDatasetChunkGlobals {
  const result: Record<string, string> = {};

  try {
    const datasetChunkProjectId = selectChunkProjectIdCandidate(
      dataset.chunkServiceProjectId,
      dataset.chunkProjectId,
      dataset.runtimeProjectId,
      dataset.projectId,
      dataset.defaultProjectId,
    );
    const datasetAppProjectId = selectAppProjectPublicIdCandidate(
      dataset.appProjectPublicId,
      dataset.projectPublicId,
      dataset.appProjectId,
      dataset.publicId,
      dataset.projectId,
      dataset.defaultProjectId,
    );
    const datasetUniverseId = firstNonEmptyString(
      dataset.chunkServiceUniverseId,
      dataset.chunkUniverseId,
      dataset.universeId,
    );
    const datasetWorldId = selectChunkWorldIdCandidate(
      dataset.chunkServiceWorldId,
      dataset.chunkWorldId,
      dataset.worldId,
      dataset.runtimeWorldId,
      dataset.defaultWorldId,
    );
    const datasetApiBaseUrl = normalizeEditorProxyBaseUrlForBootstrap(
      firstNonEmptyString(
        dataset.chunkServiceApiBaseUrl,
        dataset.chunkApiBaseUrl,
        dataset.chunkProxyBaseUrl,
      ),
      {
        ...context,
        source: `${context.source}.apiBaseUrl`,
      },
    );
    const datasetBrowserBaseUrl = normalizeEditorProxyBaseUrlForBootstrap(
      firstNonEmptyString(
        dataset.chunkServiceBrowserBaseUrl,
        dataset.chunkBrowserBaseUrl,
        datasetApiBaseUrl,
      ),
      {
        ...context,
        source: `${context.source}.browserBaseUrl`,
      },
    );
    const datasetReady = firstNonEmptyString(
      dataset.chunkServiceReady,
      dataset.chunkReady,
      dataset.chunkContextReady,
    );
    const datasetStatus = firstNonEmptyString(
      dataset.chunkServiceStatus,
      dataset.chunkStatus,
      dataset.chunkContextStatus,
    );

    setOptionalString(result, "enabled", dataset.chunkServiceEnabled);
    setOptionalString(result, "mode", dataset.chunkServiceMode);
    setOptionalString(result, "sourceKind", dataset.chunkServiceSourceKind);
    setOptionalString(result, "apiBaseUrl", datasetApiBaseUrl);
    setOptionalString(result, "browserBaseUrl", datasetBrowserBaseUrl);

    setOptionalString(result, "projectId", datasetChunkProjectId);
    setOptionalString(result, "chunkProjectId", datasetChunkProjectId);
    setOptionalString(result, "appProjectPublicId", datasetAppProjectId);
    setOptionalString(result, "projectPublicId", datasetAppProjectId);

    if (!datasetChunkProjectId && isLikelyAppProjectId(dataset.projectId)) {
      setOptionalString(result, "rejectedProjectId", dataset.projectId);
      logWarn(context, "Dataset projectId was rejected as chunkProjectId.", {
        rejectedProjectId: dataset.projectId,
        expectedChunkProjectPrefix: "chk_prj_",
      });
    }

    setOptionalString(result, "universeId", datasetUniverseId);
    setOptionalString(result, "chunkUniverseId", datasetUniverseId);
    setOptionalString(result, "worldId", datasetWorldId);
    setOptionalString(result, "chunkWorldId", datasetWorldId);
    setOptionalString(result, "ready", datasetReady);
    setOptionalString(result, "chunkReady", datasetReady);
    setOptionalString(result, "status", datasetStatus);
    setOptionalString(result, "chunkStatus", datasetStatus);
    setOptionalString(result, "preferBatchLoad", dataset.chunkServicePreferBatchLoad);
    setOptionalString(result, "reloadDirtyChunksAfterCommand", dataset.chunkServiceReloadDirtyChunksAfterCommand);
    setOptionalString(result, "maxBatchChunks", dataset.chunkServiceMaxBatchChunks);
    setOptionalString(result, "visibleChunkRadius", dataset.chunksViewDistance);
    setOptionalString(result, "viewDistance", dataset.chunksViewDistance);
    setOptionalString(result, "preloadRadius", dataset.chunksPreloadRadius);
    setOptionalString(result, "unloadDistance", dataset.chunksUnloadDistance);
    setOptionalString(result, "maxLoadedChunks", dataset.chunksMaxLoadedChunks);
    setOptionalString(
      result,
      "routeHintsJson",
      firstNonEmptyString(dataset.chunkRouteHintsJson, dataset.chunkRouteHints, dataset.routeHintsJson),
    );
    setOptionalString(
      result,
      "serviceConfigJson",
      firstNonEmptyString(dataset.chunkServiceConfigJson, dataset.chunkServiceConfig, dataset.chunkConfigJson, dataset.chunkConfig),
    );
    setOptionalString(result, "cameraDirectMovementEnabled", dataset.cameraDirectMovementEnabled);
    setOptionalString(result, "cameraPhysicsFollowEnabled", dataset.cameraPhysicsFollowEnabled);

    logDebug(context, "Dataset chunk globals were read.", {
      keys: Object.keys(result),
      chunkProjectId: result.chunkProjectId ?? null,
      appProjectPublicId: result.appProjectPublicId ?? null,
      rejectedProjectId: result.rejectedProjectId ?? null,
    });

    return result as EditorDatasetChunkGlobals;
  } catch (error) {
    logWarn(context, "Dataset chunk globals could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {};
  }
}

function readDatasetInventoryGlobals(
  dataset: DOMStringMap,
  context: SafeReadContext,
): EditorDatasetInventoryGlobals {
  const result: Record<string, string> = {};

  try {
    setOptionalString(result, "inventoryEnabled", dataset.inventoryEnabled);
    setOptionalString(result, "inventorySource", sanitizeInventorySource(dataset.inventorySource));
    setOptionalString(result, "inventoryKind", sanitizeInventoryKind(dataset.inventoryKind));
    setOptionalString(result, "inventoryApiUrl", dataset.inventoryApiUrl);
    setOptionalString(result, "inventoryUrl", dataset.inventoryUrl);
    setOptionalString(result, "inventoryRoute", dataset.inventoryRoute);
    setOptionalString(result, "inventoryHealthUrl", dataset.inventoryHealthUrl);
    setOptionalString(result, "inventoryMetadataUrl", dataset.inventoryMetadataUrl);
    setOptionalString(result, "inventoryHotbarSize", dataset.inventoryHotbarSize);
    setOptionalString(result, "inventorySlotCount", dataset.inventorySlotCount);
    setOptionalString(result, "inventorySelectedSlot", dataset.inventorySelectedSlot);
    setOptionalString(result, "inventoryDefaultSelectedSlot", dataset.inventoryDefaultSelectedSlot);
    setOptionalString(result, "inventoryForceRefreshOnBoot", dataset.inventoryForceRefreshOnBoot);
    setOptionalString(result, "inventoryIncludeEmptySlots", dataset.inventoryIncludeEmptySlots);
    setOptionalString(result, "inventoryAllowEmptyFallback", dataset.inventoryAllowEmptyFallback);
    setOptionalString(result, "inventoryOnlyLibraryItemsPlaceable", dataset.inventoryOnlyLibraryItemsPlaceable);
    setOptionalString(result, "inventoryDebugGrassDirtAllowed", "false");
    setOptionalString(result, "inventoryAllowChunkPlaceableFallback", "false");
    setOptionalString(result, "libraryApiUrl", dataset.libraryApiUrl);
    setOptionalString(result, "libraryInventoryRoute", dataset.libraryInventoryRoute);
    setOptionalString(result, "creativeLibraryRoute", dataset.creativeLibraryRoute);
    setOptionalString(result, "creativeLibraryHealthUrl", dataset.creativeLibraryHealthUrl);
    setOptionalString(result, "creativeLibraryMetadataUrl", dataset.creativeLibraryMetadataUrl);
    setOptionalString(result, "inventoryConfigJson", dataset.inventoryConfigJson);

    logDebug(context, "Dataset inventory globals were read.", {
      keys: Object.keys(result),
      inventoryApiUrl: result.inventoryApiUrl,
      creativeLibraryRoute: result.creativeLibraryRoute,
    });

    return result as EditorDatasetInventoryGlobals;
  } catch (error) {
    logWarn(context, "Dataset inventory globals could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {};
  }
}

function readDatasetPhysicsGlobals(
  dataset: DOMStringMap,
  context: SafeReadContext,
): EditorDatasetPhysicsGlobals {
  const result: Record<string, string> = {};

  try {
    setOptionalString(result, "physicsEnabled", dataset.physicsEnabled);
    setOptionalString(result, "physicsMode", dataset.physicsMode);
    setOptionalString(result, "physicsFixedTimeStepSeconds", dataset.physicsFixedTimeStepSeconds);
    setOptionalString(result, "physicsMaxFrameDeltaSeconds", dataset.physicsMaxFrameDeltaSeconds);
    setOptionalString(result, "physicsMaxSubSteps", dataset.physicsMaxSubSteps);
    setOptionalString(result, "physicsWalkSpeed", dataset.physicsWalkSpeed);
    setOptionalString(result, "physicsSprintSpeed", dataset.physicsSprintSpeed);
    setOptionalString(result, "physicsAirControlSpeed", dataset.physicsAirControlSpeed);
    setOptionalString(result, "physicsFlySpeed", dataset.physicsFlySpeed);
    setOptionalString(result, "physicsFlySprintSpeed", dataset.physicsFlySprintSpeed);
    setOptionalString(result, "physicsJumpVelocity", dataset.physicsJumpVelocity);
    setOptionalString(result, "physicsGravity", dataset.physicsGravity);
    setOptionalString(result, "physicsMaxFallSpeed", dataset.physicsMaxFallSpeed);
    setOptionalString(result, "physicsGroundSnapDistance", dataset.physicsGroundSnapDistance);
    setOptionalString(result, "physicsDoubleTapWindowMs", dataset.physicsDoubleTapWindowMs);
    setOptionalString(result, "physicsAllowJumpBeforeFlightToggle", dataset.physicsAllowJumpBeforeFlightToggle);
    setOptionalString(result, "physicsPlayerWidth", dataset.physicsPlayerWidth);
    setOptionalString(result, "physicsPlayerHeight", dataset.physicsPlayerHeight);
    setOptionalString(result, "physicsPlayerEyeHeight", dataset.physicsPlayerEyeHeight);
    setOptionalString(result, "physicsPlayerSkinWidth", dataset.physicsPlayerSkinWidth);
    setOptionalString(result, "physicsMissingChunkPolicy", dataset.physicsMissingChunkPolicy);
    setOptionalString(
      result,
      "physicsBlockHorizontalMovementOnMissingChunk",
      dataset.physicsBlockHorizontalMovementOnMissingChunk,
    );
    setOptionalString(
      result,
      "physicsBlockVerticalMovementOnMissingChunk",
      dataset.physicsBlockVerticalMovementOnMissingChunk,
    );
    setOptionalString(result, "physicsDebugEnabled", dataset.physicsDebugEnabled);
    setOptionalString(result, "physicsDebugExposeToStore", dataset.physicsDebugExposeToStore);
    setOptionalString(result, "physicsDebugIncludeCollisionCells", dataset.physicsDebugIncludeCollisionCells);
    setOptionalString(result, "physicsConfigJson", dataset.physicsConfigJson);

    logDebug(context, "Dataset physics globals were read.", {
      keys: Object.keys(result),
    });

    return result as EditorDatasetPhysicsGlobals;
  } catch (error) {
    logWarn(context, "Dataset physics globals could not be read.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {};
  }
}

function buildSafeDefaults(defaults: Partial<EditorBootstrapDefaults> | undefined): EditorBootstrapDefaults {
  const projectId = selectChunkProjectIdCandidate(defaults?.projectId) || DEFAULT_PROJECT_ID;
  const worldId = selectChunkWorldIdCandidate(defaults?.worldId) || DEFAULT_WORLD_ID;
  const chunkProxyBaseUrl = normalizeEditorChunkProxyBaseUrl(
    defaults?.chunkProxyBaseUrl,
    {
      defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
    },
  );

  return {
    buildMode: safeString(defaults?.buildMode, "development"),
    buildVersion: safeString(defaults?.buildVersion, "0.1.0"),
    chunkProxyBaseUrl,
    projectId,
    worldId,
    localWorldFallbackEnabled: false,
  };
}

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function createMinimalPhysicsFallback(debugOverlayEnabled: boolean): UnknownRecord {
  return {
    enabled: true,
    mode: "local-player-physics-v1",
    timing: {
      fixedTimeStepSeconds: 1 / 60,
      maxFrameDeltaSeconds: 0.25,
      maxSubSteps: 8,
    },
    movement: {
      walkSpeed: 4.25,
      sprintSpeed: 9.5,
      airControlSpeed: 2.35,
      flySpeed: 6.5,
      flySprintSpeed: 15,
      jumpVelocity: 6.25,
      gravity: -18,
      maxFallSpeed: -32,
      groundSnapDistance: 0.08,
    },
    input: {
      doubleTapWindowMs: 280,
      allowJumpBeforeFlightToggle: true,
    },
    collider: {
      kind: "aabb",
      width: 0.6,
      height: 1.8,
      eyeHeight: 1.62,
      skinWidth: 0.001,
    },
    missingChunks: {
      policy: "block",
      blockHorizontalMovement: true,
      blockVerticalMovement: true,
    },
    debug: {
      enabled: debugOverlayEnabled,
      exposeToStore: true,
      includeCollisionCells: false,
    },
  };
}

function createMinimalFallbackBootstrap(defaults: EditorBootstrapDefaults): UnknownRecord {
  const apiBaseUrl = normalizeEditorChunkProxyBaseUrl(defaults.chunkProxyBaseUrl || DEFAULT_CHUNK_PROXY_BASE_URL, {
    defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
    editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
    forceRelativeEditorProxy: true,
    allowDirectChunkServiceUrl: false,
  });
  const projectId = selectChunkProjectIdCandidate(defaults.projectId) || DEFAULT_PROJECT_ID;
  const worldId = selectChunkWorldIdCandidate(defaults.worldId) || DEFAULT_WORLD_ID;
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedWorldId = encodeURIComponent(worldId);
  const projectBase = `${apiBaseUrl}/projects/${encodedProjectId}`;
  const worldBase = `${projectBase}/worlds/${encodedWorldId}`;
  const debugOverlayEnabled = defaults.buildMode !== "production";
  const physics = createMinimalPhysicsFallback(debugOverlayEnabled);

  return {
    schemaVersion: "vectoplan-editor-bootstrap.v1",
    app: {
      name: "vectoplan-editor",
      mode: defaults.buildMode,
      buildMode: defaults.buildMode,
      buildVersion: defaults.buildVersion,
      templateMode: "fallback",
      runtimeMode: DEFAULT_EDITOR_RUNTIME_MODE,
      serviceVersion: defaults.buildVersion,
      frontendRoot: DEFAULT_EDITOR_FRONTEND_ROOT,
      createdAt: nowIsoStringSafe(),
    },
    project: {
      projectId,
      worldId,
      universeId: "dev-universe",
      templateId: "dev-template",
      providerId: "vectoplan-chunk",
      providerWorldId: worldId,
    },
    runtime: {
      mode: DEFAULT_EDITOR_RUNTIME_MODE,
      worldMode: DEFAULT_EDITOR_WORLD_MODE,
      sourceMode: DEFAULT_EDITOR_WORLD_SOURCE_MODE,
      localWorldFallbackEnabled: false,
      legacyFrontendEnabled: false,
      chunk: {
        enabled: true,
        mode: "editor-proxy",
        sourceKind: "vectoplan-chunk",
        connectionState: "unknown",
        apiBaseUrl,
        browserBaseUrl: apiBaseUrl,
        projectId,
        chunkProjectId: projectId,
        worldId,
        chunkWorldId: worldId,
        preferBatchLoad: true,
        reloadDirtyChunksAfterCommand: true,
        maxBatchChunks: 256,
        routeHints: {
        maxLoadedChunks: 384,
          status: `${apiBaseUrl}/_status`,
          connectionTest: `${apiBaseUrl}/_test/connection`,
          projects: `${apiBaseUrl}/projects`,
          project: projectBase,
          projectBootstrap: `${projectBase}/bootstrap`,
          worlds: `${projectBase}/worlds`,
          world: worldBase,
          blocks: `${worldBase}/blocks`,
          placeableBlocks: `${apiBaseUrl}/placeable-blocks`,
          editorInventory: DEFAULT_EDITOR_INVENTORY_API_URL,
          editorInventoryHealth: DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
          editorInventoryMetadata: DEFAULT_EDITOR_INVENTORY_METADATA_URL,
          creativeLibrary: DEFAULT_CREATIVE_LIBRARY_API_URL,
          creativeLibraryHealth: DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
          creativeLibraryMetadata: DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
          chunk: `${worldBase}/chunks`,
          chunksBatch: `${worldBase}/chunks/batch`,
          commands: `${worldBase}/commands`,
        },
        timeouts: {
          statusMs: 5_000,
          requestMs: 10_000,
          blocksMs: 10_000,
          inventoryMs: 10_000,
          libraryMs: 10_000,
          chunkMs: 15_000,
          batchMs: 20_000,
          commandMs: 15_000,
        },
      },
      inventory: {
        enabled: true,
        source: DEFAULT_INVENTORY_SOURCE_KIND,
        kind: DEFAULT_INVENTORY_ITEM_KIND,
        apiUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
        inventoryUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
        route: DEFAULT_EDITOR_INVENTORY_API_URL,
        healthUrl: DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
        metadataUrl: DEFAULT_EDITOR_INVENTORY_METADATA_URL,
        hotbarSize: DEFAULT_INVENTORY_SLOT_COUNT,
        slotCount: DEFAULT_INVENTORY_SLOT_COUNT,
        selectedSlot: 0,
        defaultSelectedSlot: 0,
        forceRefreshOnBoot: DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
        includeEmptySlots: DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
        allowEmptyFallback: DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
        onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
        debugGrassDirtAllowed: DEFAULT_DEBUG_GRASS_DIRT_ALLOWED,
        allowChunkPlaceableFallback: DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK,
        requestTimeoutMs: DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
        cacheTtlMs: DEFAULT_INVENTORY_CACHE_TTL_MS,
        staleCacheTtlMs: DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
      },
      library: {
        enabled: true,
        source: "vectoplan-library",
        apiUrl: DEFAULT_CREATIVE_LIBRARY_API_URL,
        browserApiUrl: DEFAULT_CREATIVE_LIBRARY_API_URL,
        inventoryRoute: DEFAULT_EDITOR_INVENTORY_API_URL,
        creativeLibraryRoute: DEFAULT_CREATIVE_LIBRARY_API_URL,
        healthRoute: DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
        metadataRoute: DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
        browserCallsLibraryDirectly: false,
      },
      physics,
    },
    featureFlags: {
      chunkServiceEnabled: true,
      localWorldFallbackEnabled: false,
      legacyFrontendEnabled: false,

      chunkServiceInventoryEnabled: false,
      chunkPaletteInventoryFallbackEnabled: false,
      placeableBlocksPlaceholderRouteEnabled: false,
      legacyChunkInventoryEnabled: false,

      editorInventoryApiEnabled: true,
      libraryInventoryEnabled: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,

      remoteCommandsEnabled: true,
      dirtyChunkReloadEnabled: true,

      pointerLockEnabled: true,
      firstPersonEnabled: true,
      physicsEnabled: true,
      playerCollisionEnabled: true,
      flightModeEnabled: true,
      crosshairEnabled: true,
      hotbarEnabled: true,
      statusBarEnabled: true,
      loadingOverlayEnabled: true,
      errorPanelEnabled: true,
      debugOverlayEnabled,

      creativeLibraryEnabled: true,
    },
    ui: {
      language: "de",
      title: "VECTOPLAN Editor",
      subtitle: "Remote Chunk Runtime · Library Inventory",
      showLeftPanel: false,
      showRightPanel: false,
      showDebugOverlay: debugOverlayEnabled,
      showHotbar: true,
      showCrosshair: true,
      showStatusBar: true,
      showLoadingOverlay: true,
    },
    input: {
      pointerLockEnabled: true,
      keyboardEnabled: true,
      mouseEnabled: true,
      wheelEnabled: true,
      invertY: false,
      sensitivity: 0.0022,
    },
    camera: {
      mode: "first-person",
      fov: 65,
      near: 0.05,
      far: 1_000,
      spawn: {
        x: 8,
        y: 4,
        z: 18,
      },
      rotation: {
        pitch: 0,
        yaw: 0,
        roll: 0,
      },
      moveSpeed: 5.5,
      sprintMultiplier: 2.4,
      directMovementEnabled: false,
      physicsFollowEnabled: true,
    },
    render: {
      antialias: true,
      alpha: false,
      pixelRatioMax: 2,
      clearColor: "#020617",
      chunkWireframe: false,
      showPreview: true,
      showTargetHighlight: true,
      visibleChunkRadius: 7,
      maxChunksPerRenderSync: 256,
    },
    inventory: {
      enabled: true,
      source: DEFAULT_INVENTORY_SOURCE_KIND,
      kind: DEFAULT_INVENTORY_ITEM_KIND,
      apiUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
      inventoryUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
      route: DEFAULT_EDITOR_INVENTORY_API_URL,
      healthUrl: DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
      metadataUrl: DEFAULT_EDITOR_INVENTORY_METADATA_URL,
      defaultBlockTypeId: null,
      defaultRuntimeBlockTypeId: null,
      fallbackBlockTypeIds: DEFAULT_FALLBACK_BLOCK_TYPE_IDS,
      slotCount: DEFAULT_INVENTORY_SLOT_COUNT,
      hotbarSize: DEFAULT_INVENTORY_SLOT_COUNT,
      selectedSlot: 0,
      defaultSelectedSlot: 0,
      includeEmptySlots: DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
      forceRefreshOnBoot: DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
      allowEmptyFallback: DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
      onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEFAULT_DEBUG_GRASS_DIRT_ALLOWED,
      allowChunkPlaceableFallback: DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK,
      requestTimeoutMs: DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
      cacheTtlMs: DEFAULT_INVENTORY_CACHE_TTL_MS,
      staleCacheTtlMs: DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
      inventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
      creativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
      legacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
    },
    creativeLibrary: {
      enabled: DEFAULT_CREATIVE_LIBRARY_ENABLED,
      source: "creative-library",
      routeKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
      apiUrl: DEFAULT_CREATIVE_LIBRARY_API_URL,
      route: DEFAULT_CREATIVE_LIBRARY_API_URL,
      healthUrl: DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
      metadataUrl: DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
      browserCallsLibraryDirectly: false,
    },
    physics,
    diagnostics: {
      source: "fallback",
      warnings: ["Default bootstrap fallback was used."],
      normalizedAt: nowIsoStringSafe(),
      rawAvailable: false,
    },
    raw: null,
  };
}

function readFallbackBootstrap(defaults: EditorBootstrapDefaults, context: SafeReadContext): unknown {
  try {
    return createDefaultEditorBootstrap(defaults);
  } catch (error) {
    logError(context, "Default editor bootstrap could not be created. Using minimal Library-first fallback.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return createMinimalFallbackBootstrap(defaults);
  }
}

export function readEditorBootstrap(options: EditorBootstrapReadOptions): EditorRawBootstrapSources {
  const context: SafeReadContext = {
    logger: options.logger,
    source: "readEditorBootstrap",
  };

  try {
    const defaults = buildSafeDefaults(options.defaults);
    const rootElement = options.rootElement ?? getDocumentRootElement();

    if (!rootElement) {
      logWarn(context, "Editor root element was not available while reading bootstrap.");
    }

    const datasetRaw = cloneDataset(rootElement?.dataset);
    const windowBootstrap = readWindowBootstrap({
      ...context,
      source: "readEditorBootstrap.windowBootstrap",
    });
    const windowChunkGlobals = readWindowChunkGlobals({
      ...context,
      source: "readEditorBootstrap.windowChunkGlobals",
    });
    const windowInventoryGlobals = readWindowInventoryGlobals({
      ...context,
      source: "readEditorBootstrap.windowInventoryGlobals",
    });
    const windowLibraryGlobals = readWindowLibraryGlobals({
      ...context,
      source: "readEditorBootstrap.windowLibraryGlobals",
    });
    const windowPhysicsGlobals = readWindowPhysicsGlobals({
      ...context,
      source: "readEditorBootstrap.windowPhysicsGlobals",
    });
    const datasetChunkGlobals = readDatasetChunkGlobals(datasetRaw, {
      ...context,
      source: "readEditorBootstrap.datasetChunkGlobals",
    });
    const datasetInventoryGlobals = readDatasetInventoryGlobals(datasetRaw, {
      ...context,
      source: "readEditorBootstrap.datasetInventoryGlobals",
    });
    const datasetPhysicsGlobals = readDatasetPhysicsGlobals(datasetRaw, {
      ...context,
      source: "readEditorBootstrap.datasetPhysicsGlobals",
    });
    const fallback = readFallbackBootstrap(defaults, {
      ...context,
      source: "readEditorBootstrap.fallback",
    });

    const sources: EditorRawBootstrapSources = {
      windowBootstrap,
      windowChunkGlobals,
      windowInventoryGlobals,
      windowLibraryGlobals,
      windowPhysicsGlobals,
      datasetChunkGlobals,
      datasetInventoryGlobals,
      datasetPhysicsGlobals,
      datasetRaw,
      fallback,
    };

    logDebug(context, "Editor bootstrap sources were read.", {
      hasWindowBootstrap: windowBootstrap !== undefined && windowBootstrap !== null,
      windowChunkGlobalKeys: Object.keys(windowChunkGlobals as Record<string, unknown>),
      windowInventoryGlobalKeys: Object.keys(windowInventoryGlobals as Record<string, unknown>),
      windowLibraryGlobalKeys: Object.keys(windowLibraryGlobals as Record<string, unknown>),
      windowPhysicsGlobalKeys: Object.keys(windowPhysicsGlobals as Record<string, unknown>),
      datasetChunkGlobalKeys: Object.keys(datasetChunkGlobals as Record<string, unknown>),
      datasetInventoryGlobalKeys: Object.keys(datasetInventoryGlobals as Record<string, unknown>),
      datasetPhysicsGlobalKeys: Object.keys(datasetPhysicsGlobals as Record<string, unknown>),
      datasetKeys: Object.keys(datasetRaw),
      chunkProjectId: readUnknownPath(datasetChunkGlobals, ["chunkProjectId"]) ?? readUnknownPath(windowChunkGlobals, ["chunkProjectId"]) ?? null,
      appProjectPublicId: readUnknownPath(datasetChunkGlobals, ["appProjectPublicId"]) ?? readUnknownPath(windowChunkGlobals, ["appProjectPublicId"]) ?? null,
      rejectedProjectId: readUnknownPath(datasetChunkGlobals, ["rejectedProjectId"]) ?? readUnknownPath(windowChunkGlobals, ["rejectedProjectId"]) ?? null,
      inventoryApiUrl: datasetRaw.inventoryApiUrl ?? datasetRaw.inventoryRoute ?? null,
      inventorySource: datasetRaw.inventorySource ?? null,
      libraryApiUrl: datasetRaw.libraryApiUrl ?? datasetRaw.creativeLibraryRoute ?? null,
      pointerLockEnabled: datasetRaw.pointerLockEnabled ?? null,
      physicsEnabled: datasetRaw.physicsEnabled ?? null,
      playerCollisionEnabled: datasetRaw.playerCollisionEnabled ?? null,
      flightModeEnabled: datasetRaw.flightModeEnabled ?? null,
      crosshairEnabled: datasetRaw.crosshairEnabled ?? null,
      hotbarEnabled: datasetRaw.hotbarEnabled ?? null,
      creativeLibraryEnabled: datasetRaw.creativeLibraryEnabled ?? null,
    });

    return sources;
  } catch (error) {
    logError(context, "Editor bootstrap reading failed. Falling back to defaults.", {
      error: error instanceof Error ? error.message : String(error),
    });

    const defaults = buildSafeDefaults(options.defaults);
    const fallback = readFallbackBootstrap(defaults, {
      ...context,
      source: "readEditorBootstrap.fatalFallback",
    });

    return {
      windowBootstrap: undefined,
      windowChunkGlobals: {},
      windowInventoryGlobals: {},
      windowLibraryGlobals: {},
      windowPhysicsGlobals: {},
      datasetChunkGlobals: {},
      datasetInventoryGlobals: {},
      datasetPhysicsGlobals: {},
      datasetRaw: {} as DOMStringMap,
      fallback,
    };
  }
}

export function readEditorBootstrapFromDocument(
  defaults: Partial<EditorBootstrapDefaults>,
  logger?: EditorBootstrapLogger,
): EditorRawBootstrapSources {
  const rootElement = getDocumentRootElement();
  const safeDefaults = buildSafeDefaults(defaults);

  if (!rootElement) {
    return {
      windowBootstrap: readWindowBootstrap({
        logger,
        source: "readEditorBootstrapFromDocument.windowBootstrap",
      }),
      windowChunkGlobals: readWindowChunkGlobals({
        logger,
        source: "readEditorBootstrapFromDocument.windowChunkGlobals",
      }),
      windowInventoryGlobals: readWindowInventoryGlobals({
        logger,
        source: "readEditorBootstrapFromDocument.windowInventoryGlobals",
      }),
      windowLibraryGlobals: readWindowLibraryGlobals({
        logger,
        source: "readEditorBootstrapFromDocument.windowLibraryGlobals",
      }),
      windowPhysicsGlobals: readWindowPhysicsGlobals({
        logger,
        source: "readEditorBootstrapFromDocument.windowPhysicsGlobals",
      }),
      datasetChunkGlobals: {},
      datasetInventoryGlobals: {},
      datasetPhysicsGlobals: {},
      datasetRaw: {} as DOMStringMap,
      fallback: readFallbackBootstrap(safeDefaults, {
        logger,
        source: "readEditorBootstrapFromDocument.fallback",
      }),
    };
  }

  return readEditorBootstrap({
    rootElement,
    defaults: safeDefaults,
    logger,
  });
}

export function readChunkServiceRouteHintsFromSources(
  sources: EditorRawBootstrapSources,
): UnknownRecord | undefined {
  try {
    const fromWindowGlobals = normalizeRouteHintsFromValue(sources.windowChunkGlobals.routeHints, {
      source: "readChunkServiceRouteHintsFromSources.windowGlobals",
    });

    if (fromWindowGlobals) {
      return fromWindowGlobals;
    }

    const fromDataset = normalizeRouteHintsFromValue(sources.datasetChunkGlobals.routeHintsJson, {
      source: "readChunkServiceRouteHintsFromSources.dataset",
    });

    if (fromDataset) {
      return fromDataset;
    }

    const fromWindowServiceConfig = sanitizeRouteHintsObject(
      readRecordPath(sources.windowChunkGlobals.serviceConfig, ["routeHints"]),
      {
        source: "readChunkServiceRouteHintsFromSources.windowServiceConfig",
      },
    );

    if (fromWindowServiceConfig) {
      return fromWindowServiceConfig;
    }

    const fromWindowBootstrap = sanitizeRouteHintsObject(
      readRecordPath(sources.windowBootstrap, ["runtime", "chunk", "routeHints"]),
      {
        source: "readChunkServiceRouteHintsFromSources.windowBootstrap",
      },
    );

    if (fromWindowBootstrap) {
      return fromWindowBootstrap;
    }

    const fromFallback = sanitizeRouteHintsObject(
      readRecordPath(sources.fallback, ["runtime", "chunk", "routeHints"]),
      {
        source: "readChunkServiceRouteHintsFromSources.fallback",
      },
    );

    if (fromFallback) {
      return fromFallback;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function resolveChunkIdentityForMergedConfig(merged: UnknownRecord): ReturnType<typeof resolveChunkIdentity> {
  return resolveChunkIdentity(
    {
      chunkProjectId: firstNonEmptyUnknown(
        merged.chunkProjectId,
        merged.chunk_project_id,
      ),
      projectId: firstNonEmptyUnknown(
        merged.projectId,
        merged.project_id,
      ),
      defaultProjectId: firstNonEmptyUnknown(
        merged.defaultProjectId,
        merged.default_project_id,
      ),
      appProjectPublicId: firstNonEmptyUnknown(
        merged.appProjectPublicId,
        merged.app_project_public_id,
        merged.projectPublicId,
        merged.project_public_id,
        merged.publicId,
        merged.public_id,
        merged.rejectedProjectId,
      ),
      projectPublicId: firstNonEmptyUnknown(
        merged.projectPublicId,
        merged.project_public_id,
        merged.appProjectPublicId,
        merged.app_project_public_id,
      ),
      chunkUniverseId: firstNonEmptyUnknown(
        merged.chunkUniverseId,
        merged.chunk_universe_id,
      ),
      universeId: firstNonEmptyUnknown(
        merged.universeId,
        merged.universe_id,
      ),
      chunkWorldId: firstNonEmptyUnknown(
        merged.chunkWorldId,
        merged.chunk_world_id,
      ),
      worldId: firstNonEmptyUnknown(
        merged.worldId,
        merged.world_id,
      ),
      defaultWorldId: DEFAULT_WORLD_ID,
      chunkReady: firstNonEmptyUnknown(
        merged.chunkReady,
        merged.chunk_ready,
        merged.ready,
      ),
      chunkStatus: firstNonEmptyUnknown(
        merged.chunkStatus,
        merged.chunk_status,
        merged.status,
        merged.connectionState,
      ),
      source: "read_bootstrap.resolveChunkIdentityForMergedConfig",
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
}

export function readChunkServiceConfigFromSources(
  sources: EditorRawBootstrapSources,
): UnknownRecord | undefined {
  try {
    const fallbackChunk = readRecordPath(sources.fallback, ["runtime", "chunk"]);
    const bootstrapChunk = readRecordPath(sources.windowBootstrap, ["runtime", "chunk"]);
    const datasetServiceConfig = normalizeServiceConfigFromValue(sources.datasetChunkGlobals.serviceConfigJson, {
      source: "readChunkServiceConfigFromSources.datasetServiceConfig",
    });
    const windowServiceConfig = normalizeServiceConfigFromValue(sources.windowChunkGlobals.serviceConfig, {
      source: "readChunkServiceConfigFromSources.windowServiceConfig",
    });

    const datasetIndividual: Record<string, unknown> = {};
    setOptionalUnknown(datasetIndividual, "enabled", sources.datasetChunkGlobals.enabled);
    setOptionalUnknown(datasetIndividual, "mode", sources.datasetChunkGlobals.mode);
    setOptionalUnknown(datasetIndividual, "sourceKind", sources.datasetChunkGlobals.sourceKind);
    setOptionalUnknown(datasetIndividual, "apiBaseUrl", sources.datasetChunkGlobals.apiBaseUrl);
    setOptionalUnknown(datasetIndividual, "browserBaseUrl", sources.datasetChunkGlobals.browserBaseUrl);
    setOptionalUnknown(datasetIndividual, "projectId", sources.datasetChunkGlobals.chunkProjectId);
    setOptionalUnknown(datasetIndividual, "chunkProjectId", readUnknownPath(sources.datasetChunkGlobals, ["chunkProjectId"]));
    setOptionalUnknown(datasetIndividual, "appProjectPublicId", readUnknownPath(sources.datasetChunkGlobals, ["appProjectPublicId"]));
    setOptionalUnknown(datasetIndividual, "projectPublicId", readUnknownPath(sources.datasetChunkGlobals, ["projectPublicId"]));
    setOptionalUnknown(datasetIndividual, "rejectedProjectId", readUnknownPath(sources.datasetChunkGlobals, ["rejectedProjectId"]));
    setOptionalUnknown(datasetIndividual, "universeId", readUnknownPath(sources.datasetChunkGlobals, ["universeId"]));
    setOptionalUnknown(datasetIndividual, "chunkUniverseId", readUnknownPath(sources.datasetChunkGlobals, ["chunkUniverseId"]));
    setOptionalUnknown(datasetIndividual, "worldId", sources.datasetChunkGlobals.worldId);
    setOptionalUnknown(datasetIndividual, "chunkWorldId", readUnknownPath(sources.datasetChunkGlobals, ["chunkWorldId"]));
    setOptionalUnknown(datasetIndividual, "ready", readUnknownPath(sources.datasetChunkGlobals, ["ready"]));
    setOptionalUnknown(datasetIndividual, "chunkReady", readUnknownPath(sources.datasetChunkGlobals, ["chunkReady"]));
    setOptionalUnknown(datasetIndividual, "status", readUnknownPath(sources.datasetChunkGlobals, ["status"]));
    setOptionalUnknown(datasetIndividual, "chunkStatus", readUnknownPath(sources.datasetChunkGlobals, ["chunkStatus"]));
    setOptionalUnknown(datasetIndividual, "preferBatchLoad", sources.datasetChunkGlobals.preferBatchLoad);
    setOptionalUnknown(datasetIndividual, "reloadDirtyChunksAfterCommand", sources.datasetChunkGlobals.reloadDirtyChunksAfterCommand);
    setOptionalUnknown(datasetIndividual, "maxBatchChunks", sources.datasetChunkGlobals.maxBatchChunks);
    setOptionalUnknown(datasetIndividual, "maxLoadedChunks", sources.datasetChunkGlobals.maxLoadedChunks);

    const windowIndividual: Record<string, unknown> = {};
    setOptionalUnknown(windowIndividual, "apiBaseUrl", sources.windowChunkGlobals.apiBaseUrl);
    setOptionalUnknown(windowIndividual, "browserBaseUrl", sources.windowChunkGlobals.browserBaseUrl);
    setOptionalUnknown(windowIndividual, "projectId", sources.windowChunkGlobals.chunkProjectId);
    setOptionalUnknown(windowIndividual, "chunkProjectId", readUnknownPath(sources.windowChunkGlobals, ["chunkProjectId"]));
    setOptionalUnknown(windowIndividual, "appProjectPublicId", readUnknownPath(sources.windowChunkGlobals, ["appProjectPublicId"]));
    setOptionalUnknown(windowIndividual, "projectPublicId", readUnknownPath(sources.windowChunkGlobals, ["projectPublicId"]));
    setOptionalUnknown(windowIndividual, "rejectedProjectId", readUnknownPath(sources.windowChunkGlobals, ["rejectedProjectId"]));
    setOptionalUnknown(windowIndividual, "universeId", readUnknownPath(sources.windowChunkGlobals, ["universeId"]));
    setOptionalUnknown(windowIndividual, "chunkUniverseId", readUnknownPath(sources.windowChunkGlobals, ["chunkUniverseId"]));
    setOptionalUnknown(windowIndividual, "worldId", sources.windowChunkGlobals.worldId);
    setOptionalUnknown(windowIndividual, "chunkWorldId", readUnknownPath(sources.windowChunkGlobals, ["chunkWorldId"]));
    setOptionalUnknown(windowIndividual, "ready", readUnknownPath(sources.windowChunkGlobals, ["ready"]));
    setOptionalUnknown(windowIndividual, "chunkReady", readUnknownPath(sources.windowChunkGlobals, ["chunkReady"]));
    setOptionalUnknown(windowIndividual, "status", readUnknownPath(sources.windowChunkGlobals, ["status"]));
    setOptionalUnknown(windowIndividual, "chunkStatus", readUnknownPath(sources.windowChunkGlobals, ["chunkStatus"]));

    const routeHints = readChunkServiceRouteHintsFromSources(sources);

    const merged = mergeRecords(
      fallbackChunk,
      bootstrapChunk,
      datasetServiceConfig,
      datasetIndividual,
      windowServiceConfig,
      windowIndividual,
      routeHints ? { routeHints } : undefined,
    );

    if (Object.keys(merged).length <= 0) {
      return undefined;
    }

    const identity = resolveChunkIdentityForMergedConfig(merged);
    const projectId = identity.chunkProjectId ?? "";
    const worldId = identity.chunkWorldId ?? "";
    const status = identity.valid
      ? "ready"
      : normalizeChunkStatus(firstNonEmptyUnknown(merged.chunkStatus, merged.status, merged.connectionState), "invalid");
    const ready = Boolean(identity.valid && projectId && worldId && status !== "error" && status !== "disabled" && status !== "invalid");

    return {
      ...merged,
      apiBaseUrl: normalizeEditorProxyBaseUrlForBootstrap(
        firstNonEmptyUnknown(merged.apiBaseUrl, DEFAULT_CHUNK_PROXY_BASE_URL),
        {
          source: "readChunkServiceConfigFromSources.apiBaseUrl",
        },
      ),
      browserBaseUrl: normalizeEditorProxyBaseUrlForBootstrap(
        firstNonEmptyUnknown(merged.browserBaseUrl, merged.apiBaseUrl, DEFAULT_CHUNK_PROXY_BASE_URL),
        {
          source: "readChunkServiceConfigFromSources.browserBaseUrl",
        },
      ),
      projectId,
      chunkProjectId: projectId,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      universeId: identity.chunkUniverseId,
      chunkUniverseId: identity.chunkUniverseId,
      worldId,
      chunkWorldId: worldId,
      status: ready ? "ready" : status,
      chunkStatus: ready ? "ready" : status,
      ready,
      chunkReady: ready,
      identityValid: identity.valid,
      identityWarnings: chunkIdentityIssuesToWarnings(identity.issues),
      identityDiagnostics: canonicalChunkIdentityToRecord(identity),
    };
  } catch {
    return undefined;
  }
}

export function readEditorInventoryConfigFromSources(
  sources: EditorRawBootstrapSources,
): UnknownRecord | undefined {
  try {
    const fallbackRuntimeInventory = readRecordPath(sources.fallback, ["runtime", "inventory"]);
    const fallbackInventory = readRecordPath(sources.fallback, ["inventory"]);
    const bootstrapRuntimeInventory = readRecordPath(sources.windowBootstrap, ["runtime", "inventory"]);
    const bootstrapInventory = readRecordPath(sources.windowBootstrap, ["inventory"]);
    const datasetConfig = normalizeInventoryConfigFromValue(sources.datasetInventoryGlobals?.inventoryConfigJson, {
      source: "readEditorInventoryConfigFromSources.datasetConfig",
    });
    const windowConfig = isObjectLike(sources.windowInventoryGlobals)
      ? sources.windowInventoryGlobals
      : undefined;

    const datasetIndividual: Record<string, unknown> = {};
    setOptionalUnknown(datasetIndividual, "enabled", sources.datasetInventoryGlobals?.inventoryEnabled);
    setOptionalUnknown(datasetIndividual, "source", sanitizeInventorySource(sources.datasetInventoryGlobals?.inventorySource));
    setOptionalUnknown(datasetIndividual, "kind", sanitizeInventoryKind(sources.datasetInventoryGlobals?.inventoryKind));
    setOptionalUnknown(datasetIndividual, "apiUrl", sources.datasetInventoryGlobals?.inventoryApiUrl);
    setOptionalUnknown(datasetIndividual, "inventoryUrl", sources.datasetInventoryGlobals?.inventoryUrl);
    setOptionalUnknown(datasetIndividual, "route", sources.datasetInventoryGlobals?.inventoryRoute);
    setOptionalUnknown(datasetIndividual, "healthUrl", sources.datasetInventoryGlobals?.inventoryHealthUrl);
    setOptionalUnknown(datasetIndividual, "metadataUrl", sources.datasetInventoryGlobals?.inventoryMetadataUrl);
    setOptionalUnknown(datasetIndividual, "hotbarSize", sources.datasetInventoryGlobals?.inventoryHotbarSize);
    setOptionalUnknown(datasetIndividual, "slotCount", sources.datasetInventoryGlobals?.inventorySlotCount);
    setOptionalUnknown(datasetIndividual, "selectedSlot", sources.datasetInventoryGlobals?.inventorySelectedSlot);
    setOptionalUnknown(datasetIndividual, "defaultSelectedSlot", sources.datasetInventoryGlobals?.inventoryDefaultSelectedSlot);
    setOptionalUnknown(datasetIndividual, "forceRefreshOnBoot", sources.datasetInventoryGlobals?.inventoryForceRefreshOnBoot);
    setOptionalUnknown(datasetIndividual, "includeEmptySlots", sources.datasetInventoryGlobals?.inventoryIncludeEmptySlots);
    setOptionalUnknown(datasetIndividual, "allowEmptyFallback", sources.datasetInventoryGlobals?.inventoryAllowEmptyFallback);
    setOptionalUnknown(datasetIndividual, "onlyLibraryItemsPlaceable", true);
    setOptionalUnknown(datasetIndividual, "debugGrassDirtAllowed", false);
    setOptionalUnknown(datasetIndividual, "allowChunkPlaceableFallback", false);

    const merged = [
      fallbackRuntimeInventory,
      fallbackInventory,
      bootstrapRuntimeInventory,
      bootstrapInventory,
      datasetConfig,
      datasetIndividual,
      windowConfig,
      {
        source: DEFAULT_INVENTORY_SOURCE_KIND,
        kind: DEFAULT_INVENTORY_ITEM_KIND,
        onlyLibraryItemsPlaceable: true,
        debugGrassDirtAllowed: false,
        allowChunkPlaceableFallback: false,
      },
    ].reduce<UnknownRecord | undefined>((current, next) => mergeNestedRecords(current, next), undefined);

    if (!merged) {
      return undefined;
    }

    return {
      ...merged,
      source: DEFAULT_INVENTORY_SOURCE_KIND,
      kind: DEFAULT_INVENTORY_ITEM_KIND,
      defaultBlockTypeId: sanitizeMaybeBlockTypeId(merged.defaultBlockTypeId),
      defaultRuntimeBlockTypeId: sanitizeMaybeBlockTypeId(merged.defaultRuntimeBlockTypeId),
      fallbackBlockTypeIds: sanitizeFallbackBlockTypeIds(merged.fallbackBlockTypeIds),
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      allowChunkPlaceableFallback: false,
    };
  } catch {
    return undefined;
  }
}

export function readEditorInventoryApiUrlFromSources(
  sources: EditorRawBootstrapSources,
): string {
  try {
    const config = readEditorInventoryConfigFromSources(sources);

    const candidates = [
      config?.apiUrl,
      config?.inventoryUrl,
      config?.route,
      sources.datasetInventoryGlobals?.inventoryApiUrl,
      sources.datasetInventoryGlobals?.inventoryUrl,
      sources.datasetInventoryGlobals?.inventoryRoute,
      sources.windowInventoryGlobals?.apiUrl,
      sources.windowInventoryGlobals?.inventoryUrl,
      sources.windowInventoryGlobals?.route,
      readUnknownPath(sources.windowBootstrap, ["runtime", "inventory", "apiUrl"]),
      readUnknownPath(sources.windowBootstrap, ["inventory", "apiUrl"]),
    ];

    for (const candidate of candidates) {
      const normalized = safeString(candidate, "");

      if (normalized) {
        return normalized;
      }
    }

    return DEFAULT_EDITOR_INVENTORY_API_URL;
  } catch {
    return DEFAULT_EDITOR_INVENTORY_API_URL;
  }
}

export function readRuntimeLibraryConfigFromSources(
  sources: EditorRawBootstrapSources,
): UnknownRecord | undefined {
  try {
    const fallbackRuntimeLibrary = readRecordPath(sources.fallback, ["runtime", "library"]);
    const bootstrapRuntimeLibrary = readRecordPath(sources.windowBootstrap, ["runtime", "library"]);
    const bootstrapLibrary = readRecordPath(sources.windowBootstrap, ["library"]);
    const windowConfig = isObjectLike(sources.windowLibraryGlobals)
      ? sources.windowLibraryGlobals
      : undefined;

    const datasetIndividual: Record<string, unknown> = {};
    setOptionalUnknown(datasetIndividual, "enabled", sources.datasetInventoryGlobals?.inventoryEnabled);
    setOptionalUnknown(datasetIndividual, "apiUrl", sources.datasetInventoryGlobals?.libraryApiUrl);
    setOptionalUnknown(datasetIndividual, "browserApiUrl", sources.datasetInventoryGlobals?.libraryApiUrl);
    setOptionalUnknown(datasetIndividual, "inventoryRoute", sources.datasetInventoryGlobals?.libraryInventoryRoute);
    setOptionalUnknown(datasetIndividual, "creativeLibraryRoute", sources.datasetInventoryGlobals?.creativeLibraryRoute);
    setOptionalUnknown(datasetIndividual, "healthRoute", sources.datasetInventoryGlobals?.creativeLibraryHealthUrl);
    setOptionalUnknown(datasetIndividual, "metadataRoute", sources.datasetInventoryGlobals?.creativeLibraryMetadataUrl);

    const merged = [
      fallbackRuntimeLibrary,
      bootstrapRuntimeLibrary,
      bootstrapLibrary,
      datasetIndividual,
      windowConfig,
      {
        source: "vectoplan-library",
        browserCallsLibraryDirectly: false,
      },
    ].reduce<UnknownRecord | undefined>((current, next) => mergeNestedRecords(current, next), undefined);

    return merged && Object.keys(merged).length > 0
      ? {
          ...merged,
          source: "vectoplan-library",
          browserCallsLibraryDirectly: false,
        }
      : undefined;
  } catch {
    return undefined;
  }
}

export function readCreativeLibraryRouteFromSources(
  sources: EditorRawBootstrapSources,
): string {
  try {
    const config = readRuntimeLibraryConfigFromSources(sources);

    const candidates = [
      config?.creativeLibraryRoute,
      config?.apiUrl,
      sources.datasetInventoryGlobals?.creativeLibraryRoute,
      sources.datasetInventoryGlobals?.libraryApiUrl,
      sources.windowLibraryGlobals?.creativeLibraryRoute,
      sources.windowLibraryGlobals?.apiUrl,
      readUnknownPath(sources.windowBootstrap, ["runtime", "library", "creativeLibraryRoute"]),
      readUnknownPath(sources.windowBootstrap, ["creativeLibrary", "route"]),
      readUnknownPath(sources.windowBootstrap, ["creativeLibrary", "apiUrl"]),
    ];

    for (const candidate of candidates) {
      const normalized = safeString(candidate, "");

      if (normalized) {
        return normalized;
      }
    }

    return DEFAULT_CREATIVE_LIBRARY_API_URL;
  } catch {
    return DEFAULT_CREATIVE_LIBRARY_API_URL;
  }
}

function createDatasetPhysicsIndividualConfig(
  sources: EditorRawBootstrapSources,
): UnknownRecord | undefined {
  try {
    const dataset = sources.datasetPhysicsGlobals ?? {};
    const result: Record<string, unknown> = {};
    const timing: Record<string, unknown> = {};
    const movement: Record<string, unknown> = {};
    const input: Record<string, unknown> = {};
    const collider: Record<string, unknown> = {};
    const missingChunks: Record<string, unknown> = {};
    const debug: Record<string, unknown> = {};

    setOptionalUnknown(result, "enabled", dataset.physicsEnabled);
    setOptionalUnknown(result, "mode", dataset.physicsMode);

    setOptionalUnknown(timing, "fixedTimeStepSeconds", dataset.physicsFixedTimeStepSeconds);
    setOptionalUnknown(timing, "maxFrameDeltaSeconds", dataset.physicsMaxFrameDeltaSeconds);
    setOptionalUnknown(timing, "maxSubSteps", dataset.physicsMaxSubSteps);

    setOptionalUnknown(movement, "walkSpeed", dataset.physicsWalkSpeed);
    setOptionalUnknown(movement, "sprintSpeed", dataset.physicsSprintSpeed);
    setOptionalUnknown(movement, "airControlSpeed", dataset.physicsAirControlSpeed);
    setOptionalUnknown(movement, "flySpeed", dataset.physicsFlySpeed);
    setOptionalUnknown(movement, "flySprintSpeed", dataset.physicsFlySprintSpeed);
    setOptionalUnknown(movement, "jumpVelocity", dataset.physicsJumpVelocity);
    setOptionalUnknown(movement, "gravity", dataset.physicsGravity);
    setOptionalUnknown(movement, "maxFallSpeed", dataset.physicsMaxFallSpeed);
    setOptionalUnknown(movement, "groundSnapDistance", dataset.physicsGroundSnapDistance);

    setOptionalUnknown(input, "doubleTapWindowMs", dataset.physicsDoubleTapWindowMs);
    setOptionalUnknown(input, "allowJumpBeforeFlightToggle", dataset.physicsAllowJumpBeforeFlightToggle);

    setOptionalUnknown(collider, "width", dataset.physicsPlayerWidth);
    setOptionalUnknown(collider, "height", dataset.physicsPlayerHeight);
    setOptionalUnknown(collider, "eyeHeight", dataset.physicsPlayerEyeHeight);
    setOptionalUnknown(collider, "skinWidth", dataset.physicsPlayerSkinWidth);

    setOptionalUnknown(missingChunks, "policy", dataset.physicsMissingChunkPolicy);
    setOptionalUnknown(missingChunks, "blockHorizontalMovement", dataset.physicsBlockHorizontalMovementOnMissingChunk);
    setOptionalUnknown(missingChunks, "blockVerticalMovement", dataset.physicsBlockVerticalMovementOnMissingChunk);

    setOptionalUnknown(debug, "enabled", dataset.physicsDebugEnabled);
    setOptionalUnknown(debug, "exposeToStore", dataset.physicsDebugExposeToStore);
    setOptionalUnknown(debug, "includeCollisionCells", dataset.physicsDebugIncludeCollisionCells);

    if (Object.keys(timing).length > 0) {
      result.timing = timing;
    }

    if (Object.keys(movement).length > 0) {
      result.movement = movement;
    }

    if (Object.keys(input).length > 0) {
      result.input = input;
    }

    if (Object.keys(collider).length > 0) {
      result.collider = collider;
    }

    if (Object.keys(missingChunks).length > 0) {
      result.missingChunks = missingChunks;
    }

    if (Object.keys(debug).length > 0) {
      result.debug = debug;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

export function readPhysicsConfigFromSources(
  sources: EditorRawBootstrapSources,
): UnknownRecord | undefined {
  try {
    const fallbackRuntimePhysics = readRecordPath(sources.fallback, ["runtime", "physics"]);
    const fallbackTopLevelPhysics = readRecordPath(sources.fallback, ["physics"]);

    const windowBootstrapRuntimePhysics = readRecordPath(sources.windowBootstrap, ["runtime", "physics"]);
    const windowBootstrapTopLevelPhysics = readRecordPath(sources.windowBootstrap, ["physics"]);

    const datasetPhysicsConfig = normalizePhysicsConfigFromValue(sources.datasetPhysicsGlobals?.physicsConfigJson, {
      source: "readPhysicsConfigFromSources.datasetPhysicsConfig",
    });

    const datasetIndividual = createDatasetPhysicsIndividualConfig(sources);

    const windowPhysicsGlobals = isObjectLike(sources.windowPhysicsGlobals)
      ? sources.windowPhysicsGlobals
      : undefined;

    const merged = [
      fallbackRuntimePhysics,
      fallbackTopLevelPhysics,
      windowBootstrapRuntimePhysics,
      windowBootstrapTopLevelPhysics,
      datasetPhysicsConfig,
      datasetIndividual,
      windowPhysicsGlobals,
    ].reduce<UnknownRecord | undefined>((current, next) => mergeNestedRecords(current, next), undefined);

    return merged && Object.keys(merged).length > 0 ? merged : undefined;
  } catch {
    return undefined;
  }
}

export function readPhysicsEnabledFromSources(
  sources: EditorRawBootstrapSources,
): boolean {
  try {
    const config = readPhysicsConfigFromSources(sources);

    if (config && config.enabled !== undefined) {
      return safeBoolean(config.enabled, true);
    }

    const datasetValue = sources.datasetPhysicsGlobals?.physicsEnabled;

    if (datasetValue !== undefined) {
      return safeBoolean(datasetValue, true);
    }

    const featureFlagValue = readUnknownPath(sources.windowBootstrap, ["featureFlags", "physicsEnabled"]);

    if (featureFlagValue !== undefined) {
      return safeBoolean(featureFlagValue, true);
    }

    return true;
  } catch {
    return true;
  }
}

export function readCameraPhysicsFollowEnabledFromSources(
  sources: EditorRawBootstrapSources,
): boolean | undefined {
  try {
    const datasetValue = sources.datasetChunkGlobals.cameraPhysicsFollowEnabled;

    if (datasetValue !== undefined) {
      return safeBoolean(datasetValue, true);
    }

    const bootstrapValue = readUnknownPath(sources.windowBootstrap, ["camera", "physicsFollowEnabled"]);

    if (bootstrapValue !== undefined) {
      return safeBoolean(bootstrapValue, true);
    }

    const physicsEnabled = readPhysicsEnabledFromSources(sources);

    return physicsEnabled;
  } catch {
    return undefined;
  }
}

export function readCameraDirectMovementEnabledFromSources(
  sources: EditorRawBootstrapSources,
): boolean | undefined {
  try {
    const datasetValue = sources.datasetChunkGlobals.cameraDirectMovementEnabled;

    if (datasetValue !== undefined) {
      return safeBoolean(datasetValue, false);
    }

    const bootstrapValue = readUnknownPath(sources.windowBootstrap, ["camera", "directMovementEnabled"]);

    if (bootstrapValue !== undefined) {
      return safeBoolean(bootstrapValue, false);
    }

    const physicsEnabled = readPhysicsEnabledFromSources(sources);

    return !physicsEnabled;
  } catch {
    return undefined;
  }
}

export function readChunkServiceApiBaseUrlFromSources(
  sources: EditorRawBootstrapSources,
): string | undefined {
  try {
    const windowValue = sources.windowChunkGlobals.apiBaseUrl;

    if (typeof windowValue === "string" && windowValue.trim().length > 0) {
      return normalizeEditorChunkProxyBaseUrl(windowValue, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
        forceRelativeEditorProxy: true,
        allowDirectChunkServiceUrl: false,
      });
    }

    const datasetValue = sources.datasetChunkGlobals.apiBaseUrl;

    if (typeof datasetValue === "string" && datasetValue.trim().length > 0) {
      return normalizeEditorChunkProxyBaseUrl(datasetValue, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
        forceRelativeEditorProxy: true,
        allowDirectChunkServiceUrl: false,
      });
    }

    const config = readChunkServiceConfigFromSources(sources);

    if (config && typeof config.apiBaseUrl === "string" && config.apiBaseUrl.trim().length > 0) {
      return normalizeEditorChunkProxyBaseUrl(config.apiBaseUrl, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
        forceRelativeEditorProxy: true,
        allowDirectChunkServiceUrl: false,
      });
    }

    return DEFAULT_CHUNK_PROXY_BASE_URL;
  } catch {
    return DEFAULT_CHUNK_PROXY_BASE_URL;
  }
}

export function readChunkServiceBrowserBaseUrlFromSources(
  sources: EditorRawBootstrapSources,
): string | undefined {
  try {
    const windowValue = sources.windowChunkGlobals.browserBaseUrl;

    if (typeof windowValue === "string" && windowValue.trim().length > 0) {
      return normalizeEditorChunkProxyBaseUrl(windowValue, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
        forceRelativeEditorProxy: true,
        allowDirectChunkServiceUrl: false,
      });
    }

    const datasetValue = sources.datasetChunkGlobals.browserBaseUrl;

    if (typeof datasetValue === "string" && datasetValue.trim().length > 0) {
      return normalizeEditorChunkProxyBaseUrl(datasetValue, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
        forceRelativeEditorProxy: true,
        allowDirectChunkServiceUrl: false,
      });
    }

    const config = readChunkServiceConfigFromSources(sources);

    if (config && typeof config.browserBaseUrl === "string" && config.browserBaseUrl.trim().length > 0) {
      return normalizeEditorChunkProxyBaseUrl(config.browserBaseUrl, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
        forceRelativeEditorProxy: true,
        allowDirectChunkServiceUrl: false,
      });
    }

    if (config && typeof config.apiBaseUrl === "string" && config.apiBaseUrl.trim().length > 0) {
      return normalizeEditorChunkProxyBaseUrl(config.apiBaseUrl, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
        forceRelativeEditorProxy: true,
        allowDirectChunkServiceUrl: false,
      });
    }

    return DEFAULT_CHUNK_PROXY_BASE_URL;
  } catch {
    return DEFAULT_CHUNK_PROXY_BASE_URL;
  }
}

export function readChunkServiceProjectIdFromSources(
  sources: EditorRawBootstrapSources,
): string | undefined {
  try {
    const windowValue = selectChunkProjectIdCandidate(
      readUnknownPath(sources.windowChunkGlobals, ["chunkProjectId"]),
      sources.windowChunkGlobals.projectId,
      readUnknownPath(sources.windowBootstrap, ["runtime", "chunk", "chunkProjectId"]),
      readUnknownPath(sources.windowBootstrap, ["chunk", "chunkProjectId"]),
      readUnknownPath(sources.windowBootstrap, ["runtime", "chunk", "projectId"]),
    );

    if (windowValue.trim().length > 0) {
      return windowValue.trim();
    }

    const datasetValue = selectChunkProjectIdCandidate(
      readUnknownPath(sources.datasetChunkGlobals, ["chunkProjectId"]),
      sources.datasetChunkGlobals.projectId,
    );

    if (datasetValue.trim().length > 0) {
      return datasetValue.trim();
    }

    const config = readChunkServiceConfigFromSources(sources);

    const configValue = selectChunkProjectIdCandidate(config?.chunkProjectId, config?.projectId);

    if (configValue.trim().length > 0) {
      return configValue.trim();
    }

    return DEFAULT_PROJECT_ID;
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}

export function readChunkServiceWorldIdFromSources(
  sources: EditorRawBootstrapSources,
): string | undefined {
  try {
    const windowValue = selectChunkWorldIdCandidate(
      readUnknownPath(sources.windowChunkGlobals, ["chunkWorldId"]),
      sources.windowChunkGlobals.worldId,
      readUnknownPath(sources.windowBootstrap, ["runtime", "chunk", "chunkWorldId"]),
      readUnknownPath(sources.windowBootstrap, ["chunk", "chunkWorldId"]),
      readUnknownPath(sources.windowBootstrap, ["runtime", "chunk", "worldId"]),
    );

    if (windowValue.trim().length > 0) {
      return windowValue.trim();
    }

    const datasetValue = selectChunkWorldIdCandidate(
      readUnknownPath(sources.datasetChunkGlobals, ["chunkWorldId"]),
      sources.datasetChunkGlobals.worldId,
    );

    if (datasetValue.trim().length > 0) {
      return datasetValue.trim();
    }

    const config = readChunkServiceConfigFromSources(sources);

    const configValue = selectChunkWorldIdCandidate(config?.chunkWorldId, config?.worldId);

    if (configValue.trim().length > 0) {
      return configValue.trim();
    }

    return DEFAULT_WORLD_ID;
  } catch {
    return DEFAULT_WORLD_ID;
  }
}

export function isChunkServiceEnabledInSources(sources: EditorRawBootstrapSources): boolean {
  try {
    const config = readChunkServiceConfigFromSources(sources);

    if (config && config.enabled !== undefined) {
      return safeBoolean(config.enabled, true);
    }

    const datasetValue = sources.datasetChunkGlobals.enabled;

    if (datasetValue !== undefined) {
      return safeBoolean(datasetValue, true);
    }

    return true;
  } catch {
    return true;
  }
}

export function isEditorInventoryEnabledInSources(sources: EditorRawBootstrapSources): boolean {
  try {
    const config = readEditorInventoryConfigFromSources(sources);

    if (config && config.enabled !== undefined) {
      return safeBoolean(config.enabled, true);
    }

    const datasetValue = sources.datasetInventoryGlobals?.inventoryEnabled;

    if (datasetValue !== undefined) {
      return safeBoolean(datasetValue, true);
    }

    return true;
  } catch {
    return true;
  }
}

export function getReadBootstrapMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.bootstrap.read_bootstrap",
    supportsWindowBootstrap: true,
    supportsDatasetBootstrap: true,
    supportsInventoryGlobals: true,
    supportsLibraryGlobals: true,
    primaryInventoryRoute: DEFAULT_EDITOR_INVENTORY_API_URL,
    primaryCreativeLibraryRoute: DEFAULT_CREATIVE_LIBRARY_API_URL,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      minimalFallbackIsLibraryFirst: true,
      debugGrassDirtFallbackRemoved: true,
      chunkPlaceableBlocksAreLegacyDiagnosticOnly: true,
      readsChunkProjectIdAliases: true,
      readsChunkWorldIdAliases: true,
      chunkProjectIdIsRuntimeProjectId: true,
      chunkWorldIdIsRuntimeWorldId: true,
      inventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
      creativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
      legacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,

      appProjectIdNeverUsedAsChunkProjectId: true,
      datasetProjectIdSeparatedFromChunkProjectId: true,
      windowProjectIdSeparatedFromChunkProjectId: true,
      invalidRouteHintsWithAppProjectIdAreIgnored: true,
      editorChunkProxyUrlNormalizedThroughContract: true,
      appOriginEditorProxyRejected: true,
    },
  };
}