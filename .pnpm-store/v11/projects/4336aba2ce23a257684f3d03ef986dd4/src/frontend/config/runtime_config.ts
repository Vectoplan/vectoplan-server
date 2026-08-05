// services/vectoplan-editor/src/frontend/config/runtime_config.ts
import {
  DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
  DEFAULT_CHUNK_PROXY_BASE_URL,
  DEFAULT_CREATIVE_LIBRARY_API_URL,
  DEFAULT_CREATIVE_LIBRARY_ENABLED,
  DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
  DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
  DEFAULT_EDITOR_INVENTORY_API_URL,
  DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
  DEFAULT_EDITOR_INVENTORY_METADATA_URL,
  DEFAULT_FALLBACK_BLOCK_TYPE_IDS,
  DEFAULT_INVENTORY_CACHE_TTL_MS,
  DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
  DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
  DEFAULT_INVENTORY_ITEM_KIND,
  DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
  DEFAULT_INVENTORY_SLOT_COUNT,
  DEFAULT_INVENTORY_SOURCE_KIND,
  DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
  DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
  DEFAULT_PROJECT_ID,
  DEFAULT_WORLD_ID,
  type EditorBootstrapDefaults,
  type EditorInventoryItemKind,
  type EditorInventorySourceKind,
} from "@bootstrap/bootstrap_models";

export type RuntimeEnvironment =
  | "development"
  | "production"
  | "test"
  | "local"
  | "unknown";

export type RuntimeConfigSource =
  | "build"
  | "window"
  | "dataset"
  | "query"
  | "fallback"
  | "merged";

export interface RuntimeChunkConfig {
  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly preferBatchLoad: boolean;
  readonly reloadDirtyChunksAfterCommand: boolean;
  readonly maxBatchChunks: number;
}

export interface RuntimeInventoryConfig {
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

export interface RuntimeLibraryConfig {
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

export interface RuntimeFeatureFlags {
  readonly chunkServiceEnabled: true;
  readonly localWorldFallbackEnabled: false;
  readonly legacyFrontendEnabled: false;

  /**
   * Legacy chunk inventory flags.
   *
   * These remain in the config shape for backwards compatibility, but are
   * always forced to false for the productive editor runtime.
   */
  readonly chunkServiceInventoryEnabled: false;
  readonly chunkPaletteInventoryFallbackEnabled: false;
  readonly placeableBlocksPlaceholderRouteEnabled: false;
  readonly legacyChunkInventoryEnabled: false;

  /**
   * Productive Library/VPLIB inventory flags.
   */
  readonly editorInventoryApiEnabled: boolean;
  readonly libraryInventoryEnabled: boolean;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;

  readonly remoteCommandsEnabled: boolean;
  readonly dirtyChunkReloadEnabled: boolean;
  readonly debugOverlayEnabled: boolean;
  readonly creativeLibraryEnabled: boolean;
}

export interface RuntimeUiConfig {
  readonly language: "de" | "en";
  readonly title: string;
  readonly subtitle: string;
  readonly showDebugOverlay: boolean;
  readonly showHotbar: boolean;
  readonly showStatusBar: boolean;
  readonly showLoadingOverlay: boolean;
}

export interface RuntimeConfig {
  readonly schemaVersion: "vectoplan-editor-runtime-config.v1";
  readonly source: RuntimeConfigSource;
  readonly buildMode: string;
  readonly buildVersion: string;
  readonly environment: RuntimeEnvironment;
  readonly chunk: RuntimeChunkConfig;
  readonly inventory: RuntimeInventoryConfig;
  readonly library: RuntimeLibraryConfig;
  readonly featureFlags: RuntimeFeatureFlags;
  readonly ui: RuntimeUiConfig;
  readonly warnings: readonly string[];
  readonly raw: {
    readonly dataset: Record<string, string>;
    readonly window: Record<string, unknown>;
    readonly query: Record<string, string>;
  };
}

export interface ReadRuntimeConfigOptions {
  readonly rootElement: HTMLElement;
  readonly locationSearch?: string;
  readonly windowRecord?: Record<string, unknown>;
}

const RUNTIME_CONFIG_SCHEMA_VERSION = "vectoplan-editor-runtime-config.v1" as const;

const DEFAULT_BUILD_MODE = "development";
const DEFAULT_BUILD_VERSION = "0.1.0";
const DEFAULT_MAX_BATCH_CHUNKS = 256;

/**
 * Important:
 * DEFAULT_CHUNK_PROXY_BASE_URL may be exported as a literal type from bootstrap_models.
 * Runtime config helpers need a broad string, otherwise TypeScript can infer
 * a too-narrow default parameter type and reject dynamic strings.
 */
const DEFAULT_CHUNK_PROXY_BASE_URL_STRING: string = DEFAULT_CHUNK_PROXY_BASE_URL;

const FORBIDDEN_DEBUG_BLOCK_TYPE_IDS = new Set<string>([
  "debug_grass",
  "debug_dirt",
]);

const WINDOW_KEYS = {
  runtimeConfig: "__VECTOPLAN_EDITOR_RUNTIME_CONFIG__",

  chunkApiBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_API_BASE_URL__",
  chunkBrowserBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL__",
  projectId: "__VECTOPLAN_EDITOR_CHUNK_PROJECT_ID__",
  worldId: "__VECTOPLAN_EDITOR_CHUNK_WORLD_ID__",

  inventoryConfig: "__VECTOPLAN_EDITOR_INVENTORY_CONFIG__",
  inventoryEnabled: "__VECTOPLAN_EDITOR_INVENTORY_ENABLED__",
  inventorySource: "__VECTOPLAN_EDITOR_INVENTORY_SOURCE__",
  inventoryKind: "__VECTOPLAN_EDITOR_INVENTORY_KIND__",
  inventoryApiUrl: "__VECTOPLAN_EDITOR_INVENTORY_API_URL__",
  inventoryUrl: "__VECTOPLAN_EDITOR_INVENTORY_URL__",
  inventoryRoute: "__VECTOPLAN_EDITOR_INVENTORY_ROUTE__",
  inventoryHealthUrl: "__VECTOPLAN_EDITOR_INVENTORY_HEALTH_URL__",
  inventoryMetadataUrl: "__VECTOPLAN_EDITOR_INVENTORY_METADATA_URL__",
  inventoryHotbarSize: "__VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE__",
  inventorySelectedSlot: "__VECTOPLAN_EDITOR_INVENTORY_SELECTED_SLOT__",
  inventoryForceRefresh: "__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH__",
  inventoryForceRefreshOnBoot: "__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT__",

  libraryConfig: "__VECTOPLAN_EDITOR_LIBRARY_CONFIG__",
  libraryEnabled: "__VECTOPLAN_EDITOR_LIBRARY_ENABLED__",
  libraryApiUrl: "__VECTOPLAN_EDITOR_LIBRARY_API_URL__",
  libraryBrowserApiUrl: "__VECTOPLAN_EDITOR_LIBRARY_BROWSER_API_URL__",
  libraryInventoryRoute: "__VECTOPLAN_EDITOR_LIBRARY_INVENTORY_ROUTE__",
  creativeLibraryRoute: "__VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__",
  libraryHealthRoute: "__VECTOPLAN_EDITOR_LIBRARY_HEALTH_ROUTE__",
  libraryMetadataRoute: "__VECTOPLAN_EDITOR_LIBRARY_METADATA_ROUTE__",

  buildMode: "__VECTOPLAN_EDITOR_BUILD_MODE__",
  buildVersion: "__VECTOPLAN_EDITOR_BUILD_VERSION__",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function readString(value: unknown, fallback: string): string {
  try {
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

function readNullableString(value: unknown): string | null {
  try {
    if (typeof value === "number" || typeof value === "boolean") {
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : null;
    }

    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function readBoolean(value: unknown, fallback: boolean): boolean {
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

function readInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
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

function normalizeBaseUrl(
  value: unknown,
  fallback: string = DEFAULT_CHUNK_PROXY_BASE_URL_STRING,
): string {
  try {
    const raw = readString(value, fallback);

    if (raw === "/") {
      return "";
    }

    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  } catch {
    return fallback;
  }
}

function normalizeRoute(value: unknown, fallback: string): string {
  try {
    const raw = readString(value, fallback);

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

function normalizeId(value: unknown, fallback: string): string {
  try {
    const raw = readString(value, fallback)
      .replace(/[^a-zA-Z0-9_.:-]/g, "")
      .trim();

    return raw.length > 0 ? raw : fallback;
  } catch {
    return fallback;
  }
}

function normalizeEnvironment(
  value: unknown,
  buildMode: string,
): RuntimeEnvironment {
  const normalized = readString(value, buildMode).toLowerCase();

  if (
    normalized === "development" ||
    normalized === "production" ||
    normalized === "test" ||
    normalized === "local"
  ) {
    return normalized;
  }

  if (
    buildMode === "development" ||
    buildMode === "production" ||
    buildMode === "test"
  ) {
    return buildMode;
  }

  return "unknown";
}

function normalizeInventorySource(value: unknown): EditorInventorySourceKind {
  const normalized = readString(value, DEFAULT_INVENTORY_SOURCE_KIND);

  if (
    normalized === "library" ||
    normalized === "vectoplan-library" ||
    normalized === "vectoplan-user-inventory" ||
    normalized === "editor-inventory" ||
    normalized === "vplib" ||
    normalized === "library-service" ||
    normalized === "creative-library"
  ) {
    return normalized as EditorInventorySourceKind;
  }

  return DEFAULT_INVENTORY_SOURCE_KIND;
}

function normalizeInventoryKind(value: unknown): EditorInventoryItemKind {
  const normalized = readString(value, DEFAULT_INVENTORY_ITEM_KIND);

  if (
    normalized === "vplib" ||
    normalized === "library-item" ||
    normalized === "asset"
  ) {
    return normalized as EditorInventoryItemKind;
  }

  return DEFAULT_INVENTORY_ITEM_KIND;
}

function sanitizeBlockTypeId(value: unknown): string | null {
  const normalized = readNullableString(value);

  if (!normalized || FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.has(normalized)) {
    return null;
  }

  return normalized;
}

function cloneDataset(dataset: DOMStringMap | undefined): Record<string, string> {
  const output: Record<string, string> = {};

  try {
    if (!dataset) {
      return output;
    }

    for (const key of Object.keys(dataset)) {
      const value = dataset[key];

      if (typeof value === "string") {
        output[key] = value;
      }
    }
  } catch {
    return output;
  }

  return output;
}

function getWindowRecord(
  fallback?: Record<string, unknown>,
): Record<string, unknown> {
  try {
    if (fallback) {
      return fallback;
    }

    if (typeof window === "undefined") {
      return {};
    }

    return window as unknown as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseQuery(search: string | undefined): Record<string, string> {
  const output: Record<string, string> = {};

  try {
    const rawSearch =
      search !== undefined
        ? search
        : typeof window !== "undefined"
          ? window.location.search
          : "";

    const params = new URLSearchParams(rawSearch);

    for (const [key, value] of params.entries()) {
      output[key] = value;
    }
  } catch {
    return output;
  }

  return output;
}

function readWindowRuntimeConfig(
  windowRecord: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const raw = windowRecord[WINDOW_KEYS.runtimeConfig];

    if (isRecord(raw)) {
      return raw;
    }

    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = JSON.parse(raw) as unknown;
      return isRecord(parsed) ? parsed : {};
    }

    return {};
  } catch {
    return {};
  }
}

function readWindowObject(
  windowRecord: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  try {
    const raw = windowRecord[key];

    if (isRecord(raw)) {
      return raw;
    }

    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = JSON.parse(raw) as unknown;
      return isRecord(parsed) ? parsed : {};
    }

    return {};
  } catch {
    return {};
  }
}

function readNested(root: unknown, path: readonly string[]): unknown {
  try {
    let current = root;

    for (const segment of path) {
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

function firstDefined(values: readonly unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function attemptedTruthy(values: readonly unknown[]): boolean {
  try {
    return values.some((value) => readBoolean(value, false));
  } catch {
    return false;
  }
}

function collectWarnings(input: {
  readonly buildMode: string;
  readonly chunkApiBaseUrl: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly requestedLocalFallback: boolean;
  readonly requestedLegacyFrontend: boolean;
  readonly requestedLegacyChunkInventory: boolean;
  readonly requestedDebugInventory: boolean;
  readonly requestedChunkPlaceableFallback: boolean;
  readonly inventoryApiUrl: string;
  readonly creativeLibraryRoute: string;
}): readonly string[] {
  const warnings: string[] = [];

  try {
    if (input.chunkApiBaseUrl.length === 0) {
      warnings.push("Chunk API base URL resolved to root-relative empty base.");
    }

    if (input.projectId.length === 0) {
      warnings.push("Project id is empty.");
    }

    if (input.worldId.length === 0) {
      warnings.push("World id is empty.");
    }

    if (input.requestedLocalFallback) {
      warnings.push("localWorldFallbackEnabled was requested but forced to false.");
    }

    if (input.requestedLegacyFrontend) {
      warnings.push("legacyFrontendEnabled was requested but forced to false.");
    }

    if (input.requestedLegacyChunkInventory) {
      warnings.push(
        "Legacy chunk inventory was requested but forced off. Hotbar inventory uses /editor/api/inventory.",
      );
    }

    if (input.requestedChunkPlaceableFallback) {
      warnings.push("Chunk placeable fallback was requested but forced off.");
    }

    if (input.requestedDebugInventory) {
      warnings.push("debug_grass/debug_dirt inventory was requested but forced off.");
    }

    if (input.inventoryApiUrl.length === 0) {
      warnings.push("Inventory API URL resolved to an empty value.");
    }

    if (input.creativeLibraryRoute.length === 0) {
      warnings.push("Creative Library route resolved to an empty value.");
    }

    if (
      input.buildMode !== "production" &&
      input.buildMode !== "development" &&
      input.buildMode !== "test"
    ) {
      warnings.push(`Unknown build mode '${input.buildMode}'.`);
    }
  } catch {
    warnings.push("Runtime config warnings could not be fully collected.");
  }

  return warnings;
}

function readRuntimeInventoryConfig(input: {
  readonly query: Record<string, string>;
  readonly dataset: Record<string, string>;
  readonly windowRecord: Record<string, unknown>;
  readonly windowRuntimeConfig: Record<string, unknown>;
}): RuntimeInventoryConfig {
  const windowInventoryConfig = readWindowObject(
    input.windowRecord,
    WINDOW_KEYS.inventoryConfig,
  );
  const runtimeInventory = readNested(input.windowRuntimeConfig, ["inventory"]);
  const nestedInventory = isRecord(runtimeInventory) ? runtimeInventory : {};

  const hotbarSize = readInteger(
    firstDefined([
      input.query.inventoryHotbarSize,
      input.query.inventorySlotCount,
      input.dataset.inventoryHotbarSize,
      input.dataset.inventorySlotCount,
      input.windowRecord[WINDOW_KEYS.inventoryHotbarSize],
      readNested(nestedInventory, ["hotbarSize"]),
      readNested(nestedInventory, ["slotCount"]),
      windowInventoryConfig.hotbarSize,
      windowInventoryConfig.slotCount,
      DEFAULT_INVENTORY_SLOT_COUNT,
    ]),
    DEFAULT_INVENTORY_SLOT_COUNT,
    1,
    64,
  );

  const selectedSlot = readInteger(
    firstDefined([
      input.query.inventorySelectedSlot,
      input.query.inventoryDefaultSelectedSlot,
      input.dataset.inventorySelectedSlot,
      input.dataset.inventoryDefaultSelectedSlot,
      input.windowRecord[WINDOW_KEYS.inventorySelectedSlot],
      readNested(nestedInventory, ["selectedSlot"]),
      readNested(nestedInventory, ["defaultSelectedSlot"]),
      windowInventoryConfig.selectedSlot,
      windowInventoryConfig.defaultSelectedSlot,
      0,
    ]),
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );

  const apiUrl = normalizeRoute(
    firstDefined([
      input.query.inventoryApiUrl,
      input.query.inventoryUrl,
      input.query.inventoryRoute,
      input.dataset.inventoryApiUrl,
      input.dataset.inventoryUrl,
      input.dataset.inventoryRoute,
      input.windowRecord[WINDOW_KEYS.inventoryApiUrl],
      input.windowRecord[WINDOW_KEYS.inventoryUrl],
      input.windowRecord[WINDOW_KEYS.inventoryRoute],
      readNested(nestedInventory, ["apiUrl"]),
      readNested(nestedInventory, ["inventoryUrl"]),
      readNested(nestedInventory, ["route"]),
      windowInventoryConfig.apiUrl,
      windowInventoryConfig.inventoryUrl,
      windowInventoryConfig.route,
      DEFAULT_EDITOR_INVENTORY_API_URL,
    ]),
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  const forceRefreshOnBoot = readBoolean(
    firstDefined([
      input.query.inventoryForceRefresh,
      input.query.inventoryForceRefreshOnBoot,
      input.query.inventoryRefresh,
      input.dataset.inventoryForceRefresh,
      input.dataset.inventoryForceRefreshOnBoot,
      input.dataset.inventoryRefresh,
      input.windowRecord[WINDOW_KEYS.inventoryForceRefresh],
      input.windowRecord[WINDOW_KEYS.inventoryForceRefreshOnBoot],
      readNested(nestedInventory, ["forceRefresh"]),
      readNested(nestedInventory, ["forceRefreshOnBoot"]),
      windowInventoryConfig.forceRefresh,
      windowInventoryConfig.forceRefreshOnBoot,
      DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
    ]),
    DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
  );

  return {
    enabled: readBoolean(
      firstDefined([
        input.query.inventoryEnabled,
        input.dataset.inventoryEnabled,
        input.windowRecord[WINDOW_KEYS.inventoryEnabled],
        readNested(nestedInventory, ["enabled"]),
        windowInventoryConfig.enabled,
        true,
      ]),
      true,
    ),
    source: normalizeInventorySource(
      firstDefined([
        input.query.inventorySource,
        input.dataset.inventorySource,
        input.windowRecord[WINDOW_KEYS.inventorySource],
        readNested(nestedInventory, ["source"]),
        windowInventoryConfig.source,
        DEFAULT_INVENTORY_SOURCE_KIND,
      ]),
    ),
    kind: normalizeInventoryKind(
      firstDefined([
        input.query.inventoryKind,
        input.dataset.inventoryKind,
        input.windowRecord[WINDOW_KEYS.inventoryKind],
        readNested(nestedInventory, ["kind"]),
        windowInventoryConfig.kind,
        DEFAULT_INVENTORY_ITEM_KIND,
      ]),
    ),
    apiUrl,
    inventoryUrl: apiUrl,
    route: apiUrl,
    healthUrl: normalizeRoute(
      firstDefined([
        input.query.inventoryHealthUrl,
        input.dataset.inventoryHealthUrl,
        input.windowRecord[WINDOW_KEYS.inventoryHealthUrl],
        readNested(nestedInventory, ["healthUrl"]),
        windowInventoryConfig.healthUrl,
        DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
      ]),
      DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
    ),
    metadataUrl: normalizeRoute(
      firstDefined([
        input.query.inventoryMetadataUrl,
        input.dataset.inventoryMetadataUrl,
        input.windowRecord[WINDOW_KEYS.inventoryMetadataUrl],
        readNested(nestedInventory, ["metadataUrl"]),
        windowInventoryConfig.metadataUrl,
        DEFAULT_EDITOR_INVENTORY_METADATA_URL,
      ]),
      DEFAULT_EDITOR_INVENTORY_METADATA_URL,
    ),
    hotbarSize,
    slotCount: hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    forceRefreshOnBoot,
    includeEmptySlots: readBoolean(
      firstDefined([
        input.query.inventoryIncludeEmptySlots,
        input.dataset.inventoryIncludeEmptySlots,
        readNested(nestedInventory, ["includeEmptySlots"]),
        windowInventoryConfig.includeEmptySlots,
        DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
      ]),
      DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
    ),
    allowEmptyFallback: readBoolean(
      firstDefined([
        input.query.inventoryAllowEmptyFallback,
        input.dataset.inventoryAllowEmptyFallback,
        readNested(nestedInventory, ["allowEmptyFallback"]),
        windowInventoryConfig.allowEmptyFallback,
        DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
      ]),
      DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
    ),
    onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: readInteger(
      firstDefined([
        input.query.inventoryRequestTimeoutMs,
        input.dataset.inventoryRequestTimeoutMs,
        readNested(nestedInventory, ["requestTimeoutMs"]),
        windowInventoryConfig.requestTimeoutMs,
        DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
      ]),
      DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
      100,
      300_000,
    ),
    cacheTtlMs: readInteger(
      firstDefined([
        input.query.inventoryCacheTtlMs,
        input.dataset.inventoryCacheTtlMs,
        readNested(nestedInventory, ["cacheTtlMs"]),
        windowInventoryConfig.cacheTtlMs,
        DEFAULT_INVENTORY_CACHE_TTL_MS,
      ]),
      DEFAULT_INVENTORY_CACHE_TTL_MS,
      0,
      3_600_000,
    ),
    staleCacheTtlMs: readInteger(
      firstDefined([
        input.query.inventoryStaleCacheTtlMs,
        input.dataset.inventoryStaleCacheTtlMs,
        readNested(nestedInventory, ["staleCacheTtlMs"]),
        windowInventoryConfig.staleCacheTtlMs,
        DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
      ]),
      DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
      0,
      86_400_000,
    ),
  };
}

function readRuntimeLibraryConfig(input: {
  readonly query: Record<string, string>;
  readonly dataset: Record<string, string>;
  readonly windowRecord: Record<string, unknown>;
  readonly windowRuntimeConfig: Record<string, unknown>;
  readonly inventory: RuntimeInventoryConfig;
}): RuntimeLibraryConfig {
  const windowLibraryConfig = readWindowObject(
    input.windowRecord,
    WINDOW_KEYS.libraryConfig,
  );
  const runtimeLibrary = readNested(input.windowRuntimeConfig, ["library"]);
  const nestedLibrary = isRecord(runtimeLibrary) ? runtimeLibrary : {};

  const creativeLibraryRoute = normalizeRoute(
    firstDefined([
      input.query.creativeLibraryRoute,
      input.query.libraryApiUrl,
      input.dataset.creativeLibraryRoute,
      input.dataset.libraryApiUrl,
      input.windowRecord[WINDOW_KEYS.creativeLibraryRoute],
      input.windowRecord[WINDOW_KEYS.libraryApiUrl],
      readNested(nestedLibrary, ["creativeLibraryRoute"]),
      readNested(nestedLibrary, ["apiUrl"]),
      windowLibraryConfig.creativeLibraryRoute,
      windowLibraryConfig.apiUrl,
      DEFAULT_CREATIVE_LIBRARY_API_URL,
    ]),
    DEFAULT_CREATIVE_LIBRARY_API_URL,
  );

  return {
    enabled: readBoolean(
      firstDefined([
        input.query.libraryEnabled,
        input.query.creativeLibraryEnabled,
        input.dataset.libraryEnabled,
        input.dataset.creativeLibraryEnabled,
        input.windowRecord[WINDOW_KEYS.libraryEnabled],
        readNested(nestedLibrary, ["enabled"]),
        windowLibraryConfig.enabled,
        true,
      ]),
      true,
    ),
    source: "vectoplan-library",
    apiUrl: creativeLibraryRoute,
    browserApiUrl: normalizeRoute(
      firstDefined([
        input.query.libraryBrowserApiUrl,
        input.dataset.libraryBrowserApiUrl,
        input.windowRecord[WINDOW_KEYS.libraryBrowserApiUrl],
        readNested(nestedLibrary, ["browserApiUrl"]),
        windowLibraryConfig.browserApiUrl,
        creativeLibraryRoute,
      ]),
      creativeLibraryRoute,
    ),
    inventoryRoute: normalizeRoute(
      firstDefined([
        input.query.libraryInventoryRoute,
        input.query.inventoryApiUrl,
        input.dataset.libraryInventoryRoute,
        input.dataset.inventoryApiUrl,
        input.windowRecord[WINDOW_KEYS.libraryInventoryRoute],
        readNested(nestedLibrary, ["inventoryRoute"]),
        windowLibraryConfig.inventoryRoute,
        input.inventory.apiUrl,
      ]),
      input.inventory.apiUrl,
    ),
    creativeLibraryRoute,
    healthRoute: normalizeRoute(
      firstDefined([
        input.query.libraryHealthRoute,
        input.query.creativeLibraryHealthUrl,
        input.dataset.libraryHealthRoute,
        input.dataset.creativeLibraryHealthUrl,
        input.windowRecord[WINDOW_KEYS.libraryHealthRoute],
        readNested(nestedLibrary, ["healthRoute"]),
        windowLibraryConfig.healthRoute,
        DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
      ]),
      DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
    ),
    metadataRoute: normalizeRoute(
      firstDefined([
        input.query.libraryMetadataRoute,
        input.query.creativeLibraryMetadataUrl,
        input.dataset.libraryMetadataRoute,
        input.dataset.creativeLibraryMetadataUrl,
        input.windowRecord[WINDOW_KEYS.libraryMetadataRoute],
        readNested(nestedLibrary, ["metadataRoute"]),
        windowLibraryConfig.metadataRoute,
        DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
      ]),
      DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
    ),
    browserCallsLibraryDirectly: false,
  };
}

export function readRuntimeConfig(options: ReadRuntimeConfigOptions): RuntimeConfig {
  const rootElement = options.rootElement;
  const dataset = cloneDataset(rootElement.dataset);
  const windowRecord = getWindowRecord(options.windowRecord);
  const query = parseQuery(options.locationSearch);
  const windowRuntimeConfig = readWindowRuntimeConfig(windowRecord);

  const buildMode = readString(
    firstDefined([
      query.editorBuildMode,
      dataset.editorBuildMode,
      dataset.buildMode,
      windowRecord[WINDOW_KEYS.buildMode],
      readNested(windowRuntimeConfig, ["buildMode"]),
      DEFAULT_BUILD_MODE,
    ]),
    DEFAULT_BUILD_MODE,
  );

  const buildVersion = readString(
    firstDefined([
      query.editorBuildVersion,
      dataset.editorBuildVersion,
      dataset.buildVersion,
      windowRecord[WINDOW_KEYS.buildVersion],
      readNested(windowRuntimeConfig, ["buildVersion"]),
      DEFAULT_BUILD_VERSION,
    ]),
    DEFAULT_BUILD_VERSION,
  );

  const environment = normalizeEnvironment(
    firstDefined([
      query.editorEnvironment,
      dataset.editorEnvironment,
      dataset.environment,
      readNested(windowRuntimeConfig, ["environment"]),
      buildMode,
    ]),
    buildMode,
  );

  const apiBaseUrl = normalizeBaseUrl(
    firstDefined([
      query.chunkApiBaseUrl,
      query.editorChunkApiBaseUrl,
      dataset.chunkServiceApiBaseUrl,
      dataset.editorChunkApiBaseUrl,
      windowRecord[WINDOW_KEYS.chunkApiBaseUrl],
      readNested(windowRuntimeConfig, ["chunk", "apiBaseUrl"]),
      readNested(windowRuntimeConfig, ["chunkApiBaseUrl"]),
      DEFAULT_CHUNK_PROXY_BASE_URL_STRING,
    ]),
    DEFAULT_CHUNK_PROXY_BASE_URL_STRING,
  );

  const browserBaseUrl = normalizeBaseUrl(
    firstDefined([
      query.chunkBrowserBaseUrl,
      dataset.chunkServiceBrowserBaseUrl,
      dataset.editorChunkBrowserBaseUrl,
      windowRecord[WINDOW_KEYS.chunkBrowserBaseUrl],
      readNested(windowRuntimeConfig, ["chunk", "browserBaseUrl"]),
      readNested(windowRuntimeConfig, ["chunkBrowserBaseUrl"]),
      apiBaseUrl,
    ]),
    apiBaseUrl,
  );

  const projectId = normalizeId(
    firstDefined([
      query.projectId,
      query.editorProjectId,
      dataset.chunkServiceProjectId,
      dataset.editorProjectId,
      windowRecord[WINDOW_KEYS.projectId],
      readNested(windowRuntimeConfig, ["chunk", "projectId"]),
      readNested(windowRuntimeConfig, ["projectId"]),
      DEFAULT_PROJECT_ID,
    ]),
    DEFAULT_PROJECT_ID,
  );

  const worldId = normalizeId(
    firstDefined([
      query.worldId,
      query.editorWorldId,
      dataset.chunkServiceWorldId,
      dataset.editorWorldId,
      windowRecord[WINDOW_KEYS.worldId],
      readNested(windowRuntimeConfig, ["chunk", "worldId"]),
      readNested(windowRuntimeConfig, ["worldId"]),
      DEFAULT_WORLD_ID,
    ]),
    DEFAULT_WORLD_ID,
  );

  const requestedLocalFallback = readBoolean(
    firstDefined([
      query.localWorldFallbackEnabled,
      dataset.localWorldFallbackEnabled,
      dataset.editorLocalWorldFallbackEnabled,
      readNested(windowRuntimeConfig, ["featureFlags", "localWorldFallbackEnabled"]),
      readNested(windowRuntimeConfig, ["localWorldFallbackEnabled"]),
    ]),
    false,
  );

  const requestedLegacyFrontend = readBoolean(
    firstDefined([
      query.legacyFrontendEnabled,
      dataset.legacyFrontendEnabled,
      dataset.editorLegacyFrontendEnabled,
      readNested(windowRuntimeConfig, ["featureFlags", "legacyFrontendEnabled"]),
      readNested(windowRuntimeConfig, ["legacyFrontendEnabled"]),
    ]),
    false,
  );

  const requestedLegacyChunkInventory = attemptedTruthy([
    query.chunkServiceInventoryEnabled,
    query.chunkPaletteInventoryFallbackEnabled,
    query.placeableBlocksPlaceholderRouteEnabled,
    query.legacyChunkInventoryEnabled,
    dataset.chunkServiceInventoryEnabled,
    dataset.chunkPaletteInventoryFallbackEnabled,
    dataset.placeableBlocksPlaceholderRouteEnabled,
    dataset.legacyChunkInventoryEnabled,
    readNested(windowRuntimeConfig, ["featureFlags", "chunkServiceInventoryEnabled"]),
    readNested(windowRuntimeConfig, ["featureFlags", "chunkPaletteInventoryFallbackEnabled"]),
    readNested(windowRuntimeConfig, ["featureFlags", "placeableBlocksPlaceholderRouteEnabled"]),
    readNested(windowRuntimeConfig, ["featureFlags", "legacyChunkInventoryEnabled"]),
  ]);

  const requestedDebugInventory = attemptedTruthy([
    query.inventoryDebugGrassDirtAllowed,
    query.debugGrassDirtAllowed,
    dataset.inventoryDebugGrassDirtAllowed,
    dataset.debugGrassDirtAllowed,
    readNested(windowRuntimeConfig, ["inventory", "debugGrassDirtAllowed"]),
    readNested(windowRuntimeConfig, ["featureFlags", "debugGrassDirtAllowed"]),
  ]);

  const requestedChunkPlaceableFallback = attemptedTruthy([
    query.inventoryAllowChunkPlaceableFallback,
    query.allowChunkPlaceableFallback,
    dataset.inventoryAllowChunkPlaceableFallback,
    dataset.allowChunkPlaceableFallback,
    readNested(windowRuntimeConfig, ["inventory", "allowChunkPlaceableFallback"]),
  ]);

  const debugOverlayEnabled = readBoolean(
    firstDefined([
      query.debugOverlayEnabled,
      dataset.debugOverlayEnabled,
      dataset.editorDebugOverlayEnabled,
      readNested(windowRuntimeConfig, ["featureFlags", "debugOverlayEnabled"]),
    ]),
    environment !== "production",
  );

  const chunk: RuntimeChunkConfig = {
    apiBaseUrl,
    browserBaseUrl,
    projectId,
    worldId,
    preferBatchLoad: readBoolean(
      firstDefined([
        query.preferBatchLoad,
        dataset.chunkServicePreferBatchLoad,
        readNested(windowRuntimeConfig, ["chunk", "preferBatchLoad"]),
      ]),
      true,
    ),
    reloadDirtyChunksAfterCommand: readBoolean(
      firstDefined([
        query.reloadDirtyChunksAfterCommand,
        dataset.chunkServiceReloadDirtyChunksAfterCommand,
        readNested(windowRuntimeConfig, ["chunk", "reloadDirtyChunksAfterCommand"]),
      ]),
      true,
    ),
    maxBatchChunks: readInteger(
      firstDefined([
        query.maxBatchChunks,
        dataset.chunkServiceMaxBatchChunks,
        readNested(windowRuntimeConfig, ["chunk", "maxBatchChunks"]),
      ]),
      DEFAULT_MAX_BATCH_CHUNKS,
      1,
      2048,
    ),
  };

  const inventory = readRuntimeInventoryConfig({
    query,
    dataset,
    windowRecord,
    windowRuntimeConfig,
  });

  const library = readRuntimeLibraryConfig({
    query,
    dataset,
    windowRecord,
    windowRuntimeConfig,
    inventory,
  });

  const featureFlags: RuntimeFeatureFlags = {
    chunkServiceEnabled: true,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,

    chunkServiceInventoryEnabled: false,
    chunkPaletteInventoryFallbackEnabled: false,
    placeableBlocksPlaceholderRouteEnabled: false,
    legacyChunkInventoryEnabled: false,

    editorInventoryApiEnabled: readBoolean(
      firstDefined([
        query.editorInventoryApiEnabled,
        query.libraryInventoryEnabled,
        dataset.editorInventoryApiEnabled,
        dataset.libraryInventoryEnabled,
        readNested(windowRuntimeConfig, ["featureFlags", "editorInventoryApiEnabled"]),
        readNested(windowRuntimeConfig, ["featureFlags", "libraryInventoryEnabled"]),
      ]),
      true,
    ),
    libraryInventoryEnabled: readBoolean(
      firstDefined([
        query.libraryInventoryEnabled,
        dataset.libraryInventoryEnabled,
        readNested(windowRuntimeConfig, ["featureFlags", "libraryInventoryEnabled"]),
        true,
      ]),
      true,
    ),
    onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
    debugGrassDirtAllowed: false,

    remoteCommandsEnabled: readBoolean(
      firstDefined([
        query.remoteCommandsEnabled,
        dataset.remoteCommandsEnabled,
        readNested(windowRuntimeConfig, ["featureFlags", "remoteCommandsEnabled"]),
      ]),
      true,
    ),
    dirtyChunkReloadEnabled: readBoolean(
      firstDefined([
        query.dirtyChunkReloadEnabled,
        dataset.dirtyChunkReloadEnabled,
        readNested(windowRuntimeConfig, ["featureFlags", "dirtyChunkReloadEnabled"]),
      ]),
      true,
    ),
    debugOverlayEnabled,
    creativeLibraryEnabled: readBoolean(
      firstDefined([
        query.creativeLibraryEnabled,
        query.libraryEnabled,
        dataset.creativeLibraryEnabled,
        dataset.libraryEnabled,
        readNested(windowRuntimeConfig, ["featureFlags", "creativeLibraryEnabled"]),
        library.enabled,
        DEFAULT_CREATIVE_LIBRARY_ENABLED,
      ]),
      DEFAULT_CREATIVE_LIBRARY_ENABLED,
    ),
  };

  const language = readString(
    firstDefined([
      query.lang,
      query.language,
      dataset.language,
      dataset.editorLanguage,
      readNested(windowRuntimeConfig, ["ui", "language"]),
      "de",
    ]),
    "de",
  );

  const ui: RuntimeUiConfig = {
    language: language === "en" ? "en" : "de",
    title: readString(
      firstDefined([
        query.title,
        dataset.editorTitle,
        readNested(windowRuntimeConfig, ["ui", "title"]),
        "VECTOPLAN Editor",
      ]),
      "VECTOPLAN Editor",
    ),
    subtitle: readString(
      firstDefined([
        query.subtitle,
        dataset.editorSubtitle,
        readNested(windowRuntimeConfig, ["ui", "subtitle"]),
        "Remote Chunk Runtime · Library Inventory",
      ]),
      "Remote Chunk Runtime · Library Inventory",
    ),
    showDebugOverlay: debugOverlayEnabled,
    showHotbar: readBoolean(
      firstDefined([
        query.showHotbar,
        dataset.showHotbar,
        readNested(windowRuntimeConfig, ["ui", "showHotbar"]),
      ]),
      true,
    ),
    showStatusBar: readBoolean(
      firstDefined([
        query.showStatusBar,
        dataset.showStatusBar,
        readNested(windowRuntimeConfig, ["ui", "showStatusBar"]),
      ]),
      true,
    ),
    showLoadingOverlay: readBoolean(
      firstDefined([
        query.showLoadingOverlay,
        dataset.showLoadingOverlay,
        readNested(windowRuntimeConfig, ["ui", "showLoadingOverlay"]),
      ]),
      true,
    ),
  };

  const warnings = collectWarnings({
    buildMode,
    chunkApiBaseUrl: apiBaseUrl,
    projectId,
    worldId,
    requestedLocalFallback,
    requestedLegacyFrontend,
    requestedLegacyChunkInventory,
    requestedDebugInventory,
    requestedChunkPlaceableFallback,
    inventoryApiUrl: inventory.apiUrl,
    creativeLibraryRoute: library.creativeLibraryRoute,
  });

  return {
    schemaVersion: RUNTIME_CONFIG_SCHEMA_VERSION,
    source: "merged",
    buildMode,
    buildVersion,
    environment,
    chunk,
    inventory,
    library,
    featureFlags,
    ui,
    warnings,
    raw: {
      dataset,
      window: {
        runtimeConfig: windowRuntimeConfig,
        chunkApiBaseUrl: windowRecord[WINDOW_KEYS.chunkApiBaseUrl],
        chunkBrowserBaseUrl: windowRecord[WINDOW_KEYS.chunkBrowserBaseUrl],
        projectId: windowRecord[WINDOW_KEYS.projectId],
        worldId: windowRecord[WINDOW_KEYS.worldId],
        inventoryConfig: readWindowObject(windowRecord, WINDOW_KEYS.inventoryConfig),
        inventoryApiUrl: windowRecord[WINDOW_KEYS.inventoryApiUrl],
        inventoryRoute: windowRecord[WINDOW_KEYS.inventoryRoute],
        inventoryForceRefresh: windowRecord[WINDOW_KEYS.inventoryForceRefresh],
        inventoryForceRefreshOnBoot:
          windowRecord[WINDOW_KEYS.inventoryForceRefreshOnBoot],
        libraryConfig: readWindowObject(windowRecord, WINDOW_KEYS.libraryConfig),
        libraryApiUrl: windowRecord[WINDOW_KEYS.libraryApiUrl],
        creativeLibraryRoute: windowRecord[WINDOW_KEYS.creativeLibraryRoute],
      },
      query,
    },
  };
}

export function runtimeConfigToBootstrapDefaults(
  runtimeConfig: RuntimeConfig,
): EditorBootstrapDefaults {
  return {
    buildMode: runtimeConfig.buildMode,
    buildVersion: runtimeConfig.buildVersion,
    chunkProxyBaseUrl: runtimeConfig.chunk.apiBaseUrl,
    projectId: runtimeConfig.chunk.projectId,
    worldId: runtimeConfig.chunk.worldId,
    localWorldFallbackEnabled: false,
  };
}

export function installRuntimeConfigWindowGlobals(runtimeConfig: RuntimeConfig): void {
  try {
    if (typeof window === "undefined") {
      return;
    }

    const windowRecord = window as unknown as Record<string, unknown>;

    windowRecord.__VECTOPLAN_EDITOR_RUNTIME_CONFIG__ = runtimeConfig;

    windowRecord.__VECTOPLAN_EDITOR_CHUNK_API_BASE_URL__ =
      runtimeConfig.chunk.apiBaseUrl;
    windowRecord.__VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL__ =
      runtimeConfig.chunk.browserBaseUrl;
    windowRecord.__VECTOPLAN_EDITOR_CHUNK_PROJECT_ID__ =
      runtimeConfig.chunk.projectId;
    windowRecord.__VECTOPLAN_EDITOR_CHUNK_WORLD_ID__ =
      runtimeConfig.chunk.worldId;

    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_CONFIG__ = runtimeConfig.inventory;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_ENABLED__ =
      runtimeConfig.inventory.enabled;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_SOURCE__ =
      runtimeConfig.inventory.source;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_KIND__ =
      runtimeConfig.inventory.kind;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_API_URL__ =
      runtimeConfig.inventory.apiUrl;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_URL__ =
      runtimeConfig.inventory.inventoryUrl;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_ROUTE__ =
      runtimeConfig.inventory.route;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_HEALTH_URL__ =
      runtimeConfig.inventory.healthUrl;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_METADATA_URL__ =
      runtimeConfig.inventory.metadataUrl;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE__ =
      runtimeConfig.inventory.hotbarSize;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_SELECTED_SLOT__ =
      runtimeConfig.inventory.selectedSlot;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH__ =
      runtimeConfig.inventory.forceRefreshOnBoot;
    windowRecord.__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT__ =
      runtimeConfig.inventory.forceRefreshOnBoot;

    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_CONFIG__ = runtimeConfig.library;
    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_ENABLED__ =
      runtimeConfig.library.enabled;
    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_API_URL__ =
      runtimeConfig.library.apiUrl;
    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_BROWSER_API_URL__ =
      runtimeConfig.library.browserApiUrl;
    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_INVENTORY_ROUTE__ =
      runtimeConfig.library.inventoryRoute;
    windowRecord.__VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__ =
      runtimeConfig.library.creativeLibraryRoute;
    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_HEALTH_ROUTE__ =
      runtimeConfig.library.healthRoute;
    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_METADATA_ROUTE__ =
      runtimeConfig.library.metadataRoute;

    windowRecord.__VECTOPLAN_EDITOR_BUILD_MODE__ = runtimeConfig.buildMode;
    windowRecord.__VECTOPLAN_EDITOR_BUILD_VERSION__ = runtimeConfig.buildVersion;

    windowRecord.__VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__ = false;
    windowRecord.__VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED__ = false;
    windowRecord.__VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED__ = true;

    windowRecord.__VECTOPLAN_EDITOR_CHUNK_SERVICE_INVENTORY_ENABLED__ = false;
    windowRecord.__VECTOPLAN_EDITOR_CHUNK_PALETTE_INVENTORY_FALLBACK_ENABLED__ =
      false;
    windowRecord.__VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_PLACEHOLDER_ROUTE_ENABLED__ =
      false;
    windowRecord.__VECTOPLAN_EDITOR_LEGACY_CHUNK_INVENTORY_ENABLED__ = false;

    windowRecord.__VECTOPLAN_EDITOR_EDITOR_INVENTORY_API_ENABLED__ =
      runtimeConfig.featureFlags.editorInventoryApiEnabled;
    windowRecord.__VECTOPLAN_EDITOR_LIBRARY_INVENTORY_ENABLED__ =
      runtimeConfig.featureFlags.libraryInventoryEnabled;
    windowRecord.__VECTOPLAN_EDITOR_ONLY_LIBRARY_ITEMS_PLACEABLE__ =
      DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE;
    windowRecord.__VECTOPLAN_EDITOR_DEBUG_GRASS_DIRT_ALLOWED__ = false;
    windowRecord.__VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ENABLED__ =
      runtimeConfig.featureFlags.creativeLibraryEnabled;
  } catch {
    // Runtime config globals are diagnostic-only.
  }
}

export function readRuntimeConfigFromDocument(): RuntimeConfig {
  const root =
    typeof document !== "undefined"
      ? document.querySelector<HTMLElement>(
          "[data-editor-root], [data-vectoplan-editor-root], #vectoplan-editor-root",
        )
      : null;

  if (!root) {
    throw new Error("Editor root element was not found while reading runtime config.");
  }

  return readRuntimeConfig({
    rootElement: root,
  });
}

export function isRuntimeConfig(value: unknown): value is RuntimeConfig {
  try {
    return (
      isRecord(value) &&
      value.schemaVersion === RUNTIME_CONFIG_SCHEMA_VERSION &&
      isRecord(value.chunk) &&
      isRecord(value.inventory) &&
      isRecord(value.library) &&
      isRecord(value.featureFlags)
    );
  } catch {
    return false;
  }
}

export function runtimeConfigToDebugSummary(
  runtimeConfig: RuntimeConfig,
): Record<string, unknown> {
  return {
    schemaVersion: runtimeConfig.schemaVersion,
    source: runtimeConfig.source,
    buildMode: runtimeConfig.buildMode,
    buildVersion: runtimeConfig.buildVersion,
    environment: runtimeConfig.environment,
    chunk: {
      apiBaseUrl: runtimeConfig.chunk.apiBaseUrl,
      browserBaseUrl: runtimeConfig.chunk.browserBaseUrl,
      projectId: runtimeConfig.chunk.projectId,
      worldId: runtimeConfig.chunk.worldId,
      preferBatchLoad: runtimeConfig.chunk.preferBatchLoad,
      maxBatchChunks: runtimeConfig.chunk.maxBatchChunks,
    },
    inventory: {
      enabled: runtimeConfig.inventory.enabled,
      source: runtimeConfig.inventory.source,
      kind: runtimeConfig.inventory.kind,
      apiUrl: runtimeConfig.inventory.apiUrl,
      healthUrl: runtimeConfig.inventory.healthUrl,
      metadataUrl: runtimeConfig.inventory.metadataUrl,
      hotbarSize: runtimeConfig.inventory.hotbarSize,
      selectedSlot: runtimeConfig.inventory.selectedSlot,
      forceRefreshOnBoot: runtimeConfig.inventory.forceRefreshOnBoot,
      includeEmptySlots: runtimeConfig.inventory.includeEmptySlots,
      allowEmptyFallback: runtimeConfig.inventory.allowEmptyFallback,
      onlyLibraryItemsPlaceable:
        runtimeConfig.inventory.onlyLibraryItemsPlaceable,
      debugGrassDirtAllowed: runtimeConfig.inventory.debugGrassDirtAllowed,
      allowChunkPlaceableFallback:
        runtimeConfig.inventory.allowChunkPlaceableFallback,
      sanitizedDebugDefaultBlockType: sanitizeBlockTypeId(null),
    },
    library: {
      enabled: runtimeConfig.library.enabled,
      source: runtimeConfig.library.source,
      creativeLibraryRoute: runtimeConfig.library.creativeLibraryRoute,
      inventoryRoute: runtimeConfig.library.inventoryRoute,
      browserCallsLibraryDirectly:
        runtimeConfig.library.browserCallsLibraryDirectly,
    },
    featureFlags: runtimeConfig.featureFlags,
    warnings: runtimeConfig.warnings,
    rules: {
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      chunkPlaceableBlocksAreDiagnosticOnly: true,
      debugGrassDirtAllowed: false,
      onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
      fallbackBlockTypeIds: [...DEFAULT_FALLBACK_BLOCK_TYPE_IDS],
    },
  };
}

export function getRuntimeConfigMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.config.runtime_config",
    schemaVersion: RUNTIME_CONFIG_SCHEMA_VERSION,
    supportsLibraryInventory: true,
    supportsRuntimeLibraryConfig: true,
    primaryInventoryRoute: DEFAULT_EDITOR_INVENTORY_API_URL,
    primaryCreativeLibraryRoute: DEFAULT_CREATIVE_LIBRARY_API_URL,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    windowKeys: {
      inventoryForceRefresh: WINDOW_KEYS.inventoryForceRefresh,
      inventoryForceRefreshOnBoot: WINDOW_KEYS.inventoryForceRefreshOnBoot,
      chunkApiBaseUrl: WINDOW_KEYS.chunkApiBaseUrl,
      runtimeConfig: WINDOW_KEYS.runtimeConfig,
    },
    rules: {
      runtimeConfigIsLibraryFirst: true,
      chunkInventoryFlagsForcedOff: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: false,
      chunkProxyBaseUrlDefaultIsBroadString: true,
    },
  };
}