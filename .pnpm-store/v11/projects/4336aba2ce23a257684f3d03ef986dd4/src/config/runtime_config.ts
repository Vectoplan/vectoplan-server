// services/vectoplan-editor/src/frontend/config/runtime_config.ts
import type {
  EditorBootstrap,
  EditorBootstrapDefaults,
  EditorCameraBootstrap,
  EditorChunkServiceConfig,
  EditorFeatureFlags,
  EditorInputBootstrap,
  EditorPhysicsBootstrap,
  EditorRenderBootstrap,
  EditorRuntimeConfig,
} from "@bootstrap/bootstrap_models";
import {
  buildDefaultCameraBootstrap,
  buildDefaultChunkServiceConfig,
  buildDefaultFeatureFlags,
  buildDefaultInputBootstrap,
  buildDefaultPhysicsBootstrap,
  buildDefaultRenderBootstrap,
  buildDefaultRuntimeConfig,
  buildDefaultRuntimeInventoryConfig,
  buildDefaultRuntimeLibraryConfig,
  DEFAULT_CHUNK_PROXY_BASE_URL,
  DEFAULT_CREATIVE_LIBRARY_API_URL,
  DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
  DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
  DEFAULT_EDITOR_INVENTORY_API_URL,
  DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
  DEFAULT_EDITOR_INVENTORY_METADATA_URL,
  DEFAULT_PROJECT_ID,
  DEFAULT_WORLD_ID,
} from "@bootstrap/bootstrap_models";
import type {
  PhysicsConfigPatch,
} from "../runtime/physics/physics_defaults";
import {
  createDefaultPhysicsConfig,
} from "../runtime/physics/physics_defaults";
import type {
  PhysicsRuntimeConfigPatch,
} from "../runtime/physics/physics_runtime";
import type {
  PlayerPhysicsControllerConfigPatch,
} from "../runtime/physics/player_physics_controller";
import {
  canonicalChunkIdentityToRecord,
  chunkIdentityIssuesToWarnings,
  isLikelyAppProjectId,
  resolveChunkIdentity,
  type CanonicalChunkIdentity,
} from "../utils/chunk_identity_contract";
import {
  editorChunkProxyUrlIssuesToWarnings,
  editorChunkProxyUrlResultToRecord,
  normalizeEditorChunkProxyBaseUrl,
  resolveEditorChunkProxyBaseUrl,
} from "../utils/editor_chunk_proxy_url";

export type RuntimeConfigSource =
  | "bootstrap"
  | "defaults"
  | "override"
  | "cache"
  | "dataset"
  | "window"
  | "merged"
  | "unknown";

export type RuntimeConfigStatus =
  | "created"
  | "ready"
  | "degraded"
  | "failed";

export type RuntimeEnvironment =
  | "development"
  | "production"
  | "test"
  | string;

export interface RuntimeConfigWarning {
  readonly code: string;
  readonly message: string;
  readonly source: RuntimeConfigSource;
}

export interface RuntimeConfigError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly recoverable: boolean;
}

export interface RuntimeChunkConfig {
  readonly enabled: boolean;
  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;

  /**
   * Runtime projectId is the vectoplan-chunk project id, not the app project id.
   * Example: chk_prj_prj_...
   */
  readonly projectId: string;

  /**
   * Runtime worldId is the concrete chunk world id.
   * Example: world_spawn
   */
  readonly worldId: string;

  readonly chunkProjectId: string;
  readonly chunkUniverseId: string | null;
  readonly chunkWorldId: string;
  readonly chunkReady: boolean;
  readonly chunkStatus: "ready" | "pending" | "error" | "disabled" | "invalid" | string;

  /**
   * App/project shell ids are diagnostics/context only.
   * They must never be used for /projects/<id>/worlds/... chunk routes.
   */
  readonly appProjectPublicId: string | null;
  readonly projectPublicId: string | null;

  readonly valid: boolean;
  readonly degraded: boolean;
  readonly identityWarnings: readonly string[];
  readonly identityDiagnostics: Record<string, unknown>;
  readonly proxyDiagnostics: Record<string, unknown>;

  readonly preferBatchLoad: boolean;
  readonly reloadDirtyChunksAfterCommand: boolean;
  readonly maxBatchChunks: number;
  readonly visibleChunkRadius: number;
  readonly maxChunksPerRenderSync: number;
  readonly service: EditorChunkServiceConfig;
}

export interface RuntimeInputConfig {
  readonly pointerLockEnabled: boolean;
  readonly keyboardEnabled: boolean;
  readonly mouseEnabled: boolean;
  readonly wheelEnabled: boolean;
  readonly invertY: boolean;
  readonly sensitivity: number;
  readonly doubleTapWindowMs: number;
}

export interface RuntimeCameraConfig {
  readonly mode: "first-person";
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly spawn: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly rotation: {
    readonly pitch: number;
    readonly yaw: number;
    readonly roll: number;
  };
  readonly moveSpeed: number;
  readonly sprintMultiplier: number;
  readonly directMovementEnabled: boolean;
  readonly physicsFollowEnabled: boolean;
}

export interface RuntimeRenderConfig {
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

export interface RuntimePhysicsConfig {
  readonly enabled: boolean;
  readonly bootstrap: EditorPhysicsBootstrap;
  readonly physicsConfigPatch: PhysicsConfigPatch;
  readonly runtimeConfigPatch: PhysicsRuntimeConfigPatch;
  readonly controllerConfigPatch: PlayerPhysicsControllerConfigPatch;
}

export interface RuntimeFeatureConfig {
  readonly pointerLockEnabled: boolean;
  readonly firstPersonEnabled: boolean;
  readonly physicsEnabled: boolean;
  readonly playerCollisionEnabled: boolean;
  readonly flightModeEnabled: boolean;
  readonly crosshairEnabled: boolean;
  readonly hotbarEnabled: boolean;
  readonly statusBarEnabled: boolean;
  readonly debugOverlayEnabled: boolean;
  readonly creativeLibraryEnabled: boolean;
}

export interface RuntimeConfigFeatureFlags extends RuntimeFeatureConfig {
  readonly chunkServiceEnabled: true;
  readonly localWorldFallbackEnabled: false;
  readonly legacyFrontendEnabled: false;
  readonly chunkServiceInventoryEnabled: false;
  readonly chunkPaletteInventoryFallbackEnabled: false;
  readonly placeableBlocksPlaceholderRouteEnabled: false;
  readonly legacyChunkInventoryEnabled: false;
  readonly editorInventoryApiEnabled: boolean;
  readonly libraryInventoryEnabled: boolean;
  readonly onlyLibraryItemsPlaceable: true;
  readonly debugGrassDirtAllowed: false;
  readonly remoteCommandsEnabled: boolean;
  readonly dirtyChunkReloadEnabled: boolean;
  readonly loadingOverlayEnabled: boolean;
  readonly errorPanelEnabled: boolean;
}

export interface RuntimeInventoryConfig {
  readonly enabled: boolean;
  readonly source: string;
  readonly kind: string;
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
  readonly onlyLibraryItemsPlaceable: true;
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

export interface RuntimeConfig {
  readonly kind: "vectoplan-editor-runtime-config.v1";
  readonly schemaVersion: "vectoplan-editor-runtime-config.v1";
  readonly status: RuntimeConfigStatus;
  readonly source: RuntimeConfigSource;
  readonly environment: RuntimeEnvironment;
  readonly buildMode: string;
  readonly buildVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly runtime: EditorRuntimeConfig;
  readonly chunk: RuntimeChunkConfig;
  readonly inventory: RuntimeInventoryConfig;
  readonly library: RuntimeLibraryConfig;
  readonly input: RuntimeInputConfig;
  readonly camera: RuntimeCameraConfig;
  readonly render: RuntimeRenderConfig;
  readonly physics: RuntimePhysicsConfig;
  readonly features: RuntimeFeatureConfig;
  readonly featureFlags: RuntimeConfigFeatureFlags;
  readonly warnings: readonly string[];
  readonly warningDetails: readonly RuntimeConfigWarning[];
  readonly lastError: RuntimeConfigError | null;
}

export interface ResolvedEditorRuntimeConfig {
  readonly kind: "vectoplan-editor-runtime-config.v1";
  readonly status: RuntimeConfigStatus;
  readonly source: RuntimeConfigSource;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: "vectoplan-editor-runtime-config.v1";

  readonly runtime: EditorRuntimeConfig;
  readonly chunk: RuntimeChunkConfig;
  readonly input: RuntimeInputConfig;
  readonly camera: RuntimeCameraConfig;
  readonly render: RuntimeRenderConfig;
  readonly physics: RuntimePhysicsConfig;
  readonly features: RuntimeFeatureConfig;

  readonly warnings: readonly RuntimeConfigWarning[];
  readonly lastError: RuntimeConfigError | null;
}

export interface RuntimeConfigOverrides {
  readonly source?: RuntimeConfigSource;
  readonly chunk?: Partial<RuntimeChunkConfig>;
  readonly input?: Partial<RuntimeInputConfig>;
  readonly camera?: Partial<RuntimeCameraConfig>;
  readonly render?: Partial<RuntimeRenderConfig>;
  readonly physics?: Partial<EditorPhysicsBootstrap>;
  readonly features?: Partial<RuntimeFeatureConfig>;
}

export interface ReadRuntimeConfigOptions {
  readonly rootElement?: HTMLElement | null;
  readonly defaults?: Partial<EditorBootstrapDefaults>;
  readonly overrides?: RuntimeConfigOverrides | null;
}

export interface RuntimeConfigCache {
  readonly kind: "vectoplan-editor-runtime-config-cache.v1";

  get(): ResolvedEditorRuntimeConfig;
  set(config: ResolvedEditorRuntimeConfig): ResolvedEditorRuntimeConfig;
  updateFromBootstrap(
    bootstrap: EditorBootstrap | null | undefined,
    overrides?: RuntimeConfigOverrides | null,
  ): ResolvedEditorRuntimeConfig;
  clear(): void;
  getRevision(): number;
}

export const RUNTIME_CONFIG_KIND = "vectoplan-editor-runtime-config.v1" as const;
export const RUNTIME_CONFIG_CACHE_KIND = "vectoplan-editor-runtime-config-cache.v1" as const;

const WINDOW_KEYS = {
  runtimeConfig: "__VECTOPLAN_EDITOR_RUNTIME_CONFIG__",
  buildMode: "__VECTOPLAN_EDITOR_BUILD_MODE__",
  buildVersion: "__VECTOPLAN_EDITOR_BUILD_VERSION__",

  chunkApiBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_API_BASE_URL__",
  chunkBrowserBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL__",
  chunkProxyBaseUrl: "__VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__",

  /**
   * Legacy/default keys. These are only accepted as chunk ids when they already
   * contain a valid chunk project id. A prj_... value is app context only.
   */
  defaultProjectId: "__VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__",
  defaultWorldId: "__VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__",

  /**
   * Current app/editor embed keys.
   */
  chunkProjectId: "__VECTOPLAN_EDITOR_CHUNK_PROJECT_ID__",
  chunkUniverseId: "__VECTOPLAN_EDITOR_CHUNK_UNIVERSE_ID__",
  chunkWorldId: "__VECTOPLAN_EDITOR_CHUNK_WORLD_ID__",
  chunkReady: "__VECTOPLAN_EDITOR_CHUNK_READY__",
  chunkStatus: "__VECTOPLAN_EDITOR_CHUNK_STATUS__",

  appProjectPublicId: "__VECTOPLAN_EDITOR_APP_PROJECT_PUBLIC_ID__",
  projectPublicId: "__VECTOPLAN_EDITOR_PROJECT_PUBLIC_ID__",

  inventoryApiUrl: "__VECTOPLAN_EDITOR_INVENTORY_API_URL__",
  inventoryUrl: "__VECTOPLAN_EDITOR_INVENTORY_URL__",
  inventoryRoute: "__VECTOPLAN_EDITOR_INVENTORY_ROUTE__",
  inventoryHealthUrl: "__VECTOPLAN_EDITOR_INVENTORY_HEALTH_URL__",
  inventoryMetadataUrl: "__VECTOPLAN_EDITOR_INVENTORY_METADATA_URL__",
  inventoryHotbarSize: "__VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE__",
  inventorySelectedSlot: "__VECTOPLAN_EDITOR_INVENTORY_SELECTED_SLOT__",
  inventoryForceRefresh: "__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH__",
  inventoryForceRefreshOnBoot: "__VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT__",

  creativeLibraryRoute: "__VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__",
  libraryApiUrl: "__VECTOPLAN_EDITOR_LIBRARY_API_URL__",
  libraryBrowserApiUrl: "__VECTOPLAN_EDITOR_LIBRARY_BROWSER_API_URL__",
  libraryInventoryRoute: "__VECTOPLAN_EDITOR_LIBRARY_INVENTORY_ROUTE__",
  libraryHealthRoute: "__VECTOPLAN_EDITOR_LIBRARY_HEALTH_ROUTE__",
  libraryMetadataRoute: "__VECTOPLAN_EDITOR_LIBRARY_METADATA_ROUTE__",

  localWorldFallbackEnabled: "__VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__",
  legacyFrontendEnabled: "__VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED__",
} as const;

const DATASET_CHUNK_API_BASE_KEYS = [
  "chunkServiceApiBaseUrl",
  "chunkApiBaseUrl",
  "chunkProxyBaseUrl",
] as const;

const DATASET_CHUNK_BROWSER_BASE_KEYS = [
  "chunkServiceBrowserBaseUrl",
  "chunkBrowserBaseUrl",
] as const;

const DATASET_CHUNK_PROJECT_KEYS = [
  "chunkServiceProjectId",
  "chunkProjectId",
] as const;

const DATASET_APP_PROJECT_KEYS = [
  "appProjectPublicId",
  "projectPublicId",
  "projectId",
  "publicId",
  "appProjectId",
] as const;

const DATASET_CHUNK_UNIVERSE_KEYS = [
  "chunkServiceUniverseId",
  "chunkUniverseId",
  "universeId",
] as const;

const DATASET_CHUNK_WORLD_KEYS = [
  "chunkServiceWorldId",
  "chunkWorldId",
  "worldId",
  "runtimeWorldId",
  "defaultWorldId",
] as const;

const DATASET_CHUNK_READY_KEYS = [
  "chunkServiceReady",
  "chunkReady",
  "chunkContextReady",
] as const;

const DATASET_CHUNK_STATUS_KEYS = [
  "chunkServiceStatus",
  "chunkStatus",
  "chunkContextStatus",
] as const;

type UnknownRecord = Record<string, unknown>;

interface NormalizedChunkIdentity {
  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;
  readonly projectId: string;
  readonly chunkProjectId: string;
  readonly universeId: string | null;
  readonly chunkUniverseId: string | null;
  readonly worldId: string;
  readonly chunkWorldId: string;
  readonly chunkReady: boolean;
  readonly chunkStatus: "ready" | "pending" | "error" | "disabled" | "invalid" | string;

  readonly appProjectPublicId: string | null;
  readonly projectPublicId: string | null;
  readonly valid: boolean;
  readonly degraded: boolean;
  readonly identityWarnings: readonly string[];
  readonly identityDiagnostics: Record<string, unknown>;
  readonly proxyDiagnostics: Record<string, unknown>;
  readonly contractIdentity: CanonicalChunkIdentity;
}

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function safeString(value: unknown, fallback: string): string {
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

function safeNullableString(value: unknown, fallback: string | null = null): string | null {
  try {
    const normalized = safeString(value, "");

    return normalized.length > 0 ? normalized : fallback;
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

function firstNonEmpty(...values: readonly unknown[]): unknown {
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
    return safeString(firstNonEmpty(...values), "");
  } catch {
    return "";
  }
}

function createWarning(
  code: string,
  message: string,
  source: RuntimeConfigSource,
): RuntimeConfigWarning {
  return {
    code: safeString(code, "runtime_config_warning"),
    message: safeString(message, "Runtime config warning."),
    source,
  };
}

function createError(
  code: string,
  message: string,
  cause?: unknown,
  recoverable = true,
): RuntimeConfigError {
  return {
    code: safeString(code, "runtime_config_error"),
    message: safeString(message, "Runtime config error."),
    cause,
    recoverable,
  };
}

function normalizeSource(value: unknown): RuntimeConfigSource {
  try {
    if (
      value === "bootstrap" ||
      value === "defaults" ||
      value === "override" ||
      value === "cache" ||
      value === "dataset" ||
      value === "window" ||
      value === "merged" ||
      value === "unknown"
    ) {
      return value;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeChunkStatus(
  value: unknown,
  fallback: "ready" | "pending" | "error" | "disabled" | "invalid" | string = "pending",
): string {
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

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function windowRecord(): UnknownRecord {
  try {
    return typeof window !== "undefined"
      ? window as unknown as UnknownRecord
      : {};
  } catch {
    return {};
  }
}

function readWindowValue(key: string): unknown {
  try {
    return windowRecord()[key];
  } catch {
    return undefined;
  }
}

function readDatasetValue(root: HTMLElement | null | undefined, keys: readonly string[], fallback: unknown = undefined): unknown {
  try {
    if (!root) {
      return fallback;
    }

    for (const key of keys) {
      const value = root.dataset[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function readUnknownPath(root: unknown, path: readonly string[]): unknown {
  try {
    let current = root;

    for (const segment of path) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }

      current = (current as UnknownRecord)[segment];
    }

    return current;
  } catch {
    return undefined;
  }
}

function runtimeEnvironmentFromBuildMode(buildMode: string): RuntimeEnvironment {
  const normalized = buildMode.trim().toLowerCase();

  if (normalized === "production" || normalized === "test" || normalized === "development") {
    return normalized;
  }

  return normalized || "development";
}

function routeUrl(value: unknown, fallback: string): string {
  const raw = safeString(value, fallback);

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeEditorProxyUrl(value: unknown, fallback: string): {
  readonly value: string;
  readonly diagnostics: Record<string, unknown>;
  readonly warnings: readonly string[];
} {
  try {
    const result = resolveEditorChunkProxyBaseUrl(value, {
      defaultBaseUrl: fallback,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
    });

    return {
      value: result.baseUrl,
      diagnostics: editorChunkProxyUrlResultToRecord(result),
      warnings: editorChunkProxyUrlIssuesToWarnings(result.issues),
    };
  } catch (error) {
    return {
      value: normalizeEditorChunkProxyBaseUrl(fallback, {
        defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
        editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      }),
      diagnostics: {
        error: error instanceof Error ? error.message : String(error),
      },
      warnings: ["editor_chunk_proxy_url_resolution_failed"],
    };
  }
}

function shouldSuppressProjectFallback(input: {
  readonly chunkProjectId?: unknown;
  readonly projectId?: unknown;
  readonly appProjectPublicId?: unknown;
  readonly projectPublicId?: unknown;
  readonly fallbackProjectId?: unknown;
}): boolean {
  try {
    const hasExplicitChunkProjectId = firstNonEmptyString(input.chunkProjectId).length > 0;

    if (hasExplicitChunkProjectId) {
      return false;
    }

    return Boolean(
      isLikelyAppProjectId(input.projectId)
      || isLikelyAppProjectId(input.fallbackProjectId)
      || firstNonEmptyString(input.appProjectPublicId, input.projectPublicId).length > 0,
    );
  } catch {
    return false;
  }
}

function normalizeChunkIdentity(input: {
  readonly apiBaseUrl?: unknown;
  readonly browserBaseUrl?: unknown;
  readonly projectId?: unknown;
  readonly chunkProjectId?: unknown;
  readonly appProjectPublicId?: unknown;
  readonly projectPublicId?: unknown;
  readonly universeId?: unknown;
  readonly chunkUniverseId?: unknown;
  readonly worldId?: unknown;
  readonly chunkWorldId?: unknown;
  readonly ready?: unknown;
  readonly chunkReady?: unknown;
  readonly status?: unknown;
  readonly chunkStatus?: unknown;
  readonly fallbackProjectId?: unknown;
  readonly fallbackWorldId?: unknown;
  readonly fallbackApiBaseUrl?: unknown;
  readonly source?: string;
}): NormalizedChunkIdentity {
  const proxy = normalizeEditorProxyUrl(
    firstNonEmpty(input.apiBaseUrl, input.fallbackApiBaseUrl),
    DEFAULT_CHUNK_PROXY_BASE_URL,
  );
  const browserProxy = normalizeEditorProxyUrl(
    firstNonEmpty(input.browserBaseUrl, input.apiBaseUrl, proxy.value),
    proxy.value,
  );

  const suppressFallback = shouldSuppressProjectFallback({
    chunkProjectId: input.chunkProjectId,
    projectId: input.projectId,
    appProjectPublicId: input.appProjectPublicId,
    projectPublicId: input.projectPublicId,
    fallbackProjectId: input.fallbackProjectId,
  });

  const contract = resolveChunkIdentity(
    {
      chunkProjectId: input.chunkProjectId,
      projectId: input.projectId,
      defaultProjectId: suppressFallback ? undefined : input.fallbackProjectId,
      appProjectPublicId: input.appProjectPublicId,
      projectPublicId: input.projectPublicId,
      chunkUniverseId: input.chunkUniverseId,
      universeId: input.universeId,
      chunkWorldId: input.chunkWorldId,
      worldId: input.worldId,
      defaultWorldId: input.fallbackWorldId,
      chunkReady: firstNonEmpty(input.chunkReady, input.ready),
      chunkStatus: firstNonEmpty(input.chunkStatus, input.status),
      source: input.source ?? "runtime_config.normalizeChunkIdentity",
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

  const projectId = safeString(contract.chunkProjectId, "");
  const universeId = safeNullableString(contract.chunkUniverseId, null);
  const worldId = safeString(contract.chunkWorldId, "");
  const rawStatus = normalizeChunkStatus(contract.chunkStatus, contract.valid ? "ready" : "invalid");
  const explicitReady = safeBoolean(firstNonEmpty(input.chunkReady, input.ready), contract.valid);
  const chunkReady = Boolean(contract.valid && projectId && worldId && explicitReady && rawStatus !== "error" && rawStatus !== "disabled" && rawStatus !== "invalid");
  const chunkStatus = chunkReady ? "ready" : rawStatus;

  const identityWarnings = [
    ...chunkIdentityIssuesToWarnings(contract.issues),
    ...proxy.warnings,
    ...browserProxy.warnings,
  ];

  return {
    apiBaseUrl: proxy.value,
    browserBaseUrl: browserProxy.value,
    projectId,
    chunkProjectId: projectId,
    universeId,
    chunkUniverseId: universeId,
    worldId,
    chunkWorldId: worldId,
    chunkReady,
    chunkStatus,
    appProjectPublicId: contract.appProjectPublicId,
    projectPublicId: contract.projectPublicId,
    valid: contract.valid,
    degraded: contract.degraded || identityWarnings.length > 0,
    identityWarnings,
    identityDiagnostics: canonicalChunkIdentityToRecord(contract),
    proxyDiagnostics: {
      apiBaseUrl: proxy.diagnostics,
      browserBaseUrl: browserProxy.diagnostics,
    },
    contractIdentity: contract,
  };
}

function normalizeChunkIdentityFromRuntime(
  runtime: EditorRuntimeConfig,
  overrides?: Partial<RuntimeChunkConfig> | null,
): NormalizedChunkIdentity {
  const chunk = asRecord(runtime.chunk);
  const override = asRecord(overrides);

  return normalizeChunkIdentity({
    apiBaseUrl: firstNonEmpty(override.apiBaseUrl, chunk.apiBaseUrl),
    browserBaseUrl: firstNonEmpty(override.browserBaseUrl, chunk.browserBaseUrl),
    projectId: firstNonEmpty(override.projectId, chunk.projectId),
    chunkProjectId: firstNonEmpty(override.chunkProjectId, chunk.chunkProjectId),
    appProjectPublicId: firstNonEmpty(
      override.appProjectPublicId,
      chunk.appProjectPublicId,
      chunk.app_project_public_id,
    ),
    projectPublicId: firstNonEmpty(
      override.projectPublicId,
      chunk.projectPublicId,
      chunk.project_public_id,
    ),
    universeId: firstNonEmpty(override.chunkUniverseId, chunk.chunkUniverseId, chunk.universeId),
    chunkUniverseId: firstNonEmpty(override.chunkUniverseId, chunk.chunkUniverseId),
    worldId: firstNonEmpty(override.worldId, chunk.worldId),
    chunkWorldId: firstNonEmpty(override.chunkWorldId, chunk.chunkWorldId),
    ready: firstNonEmpty(override.chunkReady, chunk.ready),
    chunkReady: firstNonEmpty(override.chunkReady, chunk.chunkReady),
    status: firstNonEmpty(override.chunkStatus, chunk.status),
    chunkStatus: firstNonEmpty(override.chunkStatus, chunk.chunkStatus),
    fallbackProjectId: DEFAULT_PROJECT_ID,
    fallbackWorldId: DEFAULT_WORLD_ID,
    fallbackApiBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
    source: "runtime_config.normalizeChunkIdentityFromRuntime",
  });
}

function normalizeChunkIdentityFromDocument(
  rootElement: HTMLElement | null,
  defaults?: Partial<EditorBootstrapDefaults>,
  overrides?: Partial<RuntimeChunkConfig> | null,
): NormalizedChunkIdentity {
  const runtimeConfig = asRecord(readWindowValue(WINDOW_KEYS.runtimeConfig));
  const runtimeConfigChunk = asRecord(runtimeConfig.chunk);
  const runtimeConfigService = asRecord(runtimeConfigChunk.service);

  const override = asRecord(overrides);

  const appProjectPublicId = firstNonEmpty(
    override.appProjectPublicId,
    readWindowValue(WINDOW_KEYS.appProjectPublicId),
    readWindowValue(WINDOW_KEYS.projectPublicId),
    readWindowValue("__VECTOPLAN_EDITOR_APP_PROJECT_ID__"),
    readWindowValue("__VECTOPLAN_EDITOR_PROJECT_ID__"),
    readDatasetValue(rootElement, DATASET_APP_PROJECT_KEYS),
    runtimeConfigChunk.appProjectPublicId,
    runtimeConfigChunk.projectPublicId,
    runtimeConfigChunk.app_project_public_id,
    runtimeConfigChunk.project_public_id,
    runtimeConfigService.appProjectPublicId,
    runtimeConfigService.projectPublicId,
  );

  const genericProjectId = firstNonEmpty(
    override.projectId,
    runtimeConfigChunk.projectId,
    runtimeConfigService.projectId,
    readWindowValue(WINDOW_KEYS.defaultProjectId),
    readWindowValue("__VECTOPLAN_EDITOR_PROJECT_ID__"),
    readDatasetValue(rootElement, ["runtimeProjectId"]),
  );

  return normalizeChunkIdentity({
    apiBaseUrl: firstNonEmpty(
      override.apiBaseUrl,
      readWindowValue(WINDOW_KEYS.chunkApiBaseUrl),
      readWindowValue(WINDOW_KEYS.chunkProxyBaseUrl),
      readDatasetValue(rootElement, DATASET_CHUNK_API_BASE_KEYS),
      runtimeConfigChunk.apiBaseUrl,
      runtimeConfigService.apiBaseUrl,
    ),
    browserBaseUrl: firstNonEmpty(
      override.browserBaseUrl,
      readWindowValue(WINDOW_KEYS.chunkBrowserBaseUrl),
      readDatasetValue(rootElement, DATASET_CHUNK_BROWSER_BASE_KEYS),
      runtimeConfigChunk.browserBaseUrl,
      runtimeConfigService.browserBaseUrl,
    ),
    projectId: genericProjectId,
    chunkProjectId: firstNonEmpty(
      override.chunkProjectId,
      readWindowValue(WINDOW_KEYS.chunkProjectId),
      readDatasetValue(rootElement, DATASET_CHUNK_PROJECT_KEYS),
      runtimeConfigChunk.chunkProjectId,
      runtimeConfigService.chunkProjectId,
    ),
    appProjectPublicId,
    projectPublicId: firstNonEmpty(
      override.projectPublicId,
      readWindowValue(WINDOW_KEYS.projectPublicId),
      appProjectPublicId,
    ),
    universeId: firstNonEmpty(
      override.chunkUniverseId,
      readWindowValue(WINDOW_KEYS.chunkUniverseId),
      readDatasetValue(rootElement, DATASET_CHUNK_UNIVERSE_KEYS),
      runtimeConfigChunk.chunkUniverseId,
      runtimeConfigService.chunkUniverseId,
      runtimeConfigChunk.universeId,
      runtimeConfigService.universeId,
    ),
    chunkUniverseId: firstNonEmpty(
      override.chunkUniverseId,
      readWindowValue(WINDOW_KEYS.chunkUniverseId),
      readDatasetValue(rootElement, ["chunkUniverseId", "chunkServiceUniverseId", "universeId"]),
      runtimeConfigChunk.chunkUniverseId,
      runtimeConfigService.chunkUniverseId,
    ),
    worldId: firstNonEmpty(
      override.worldId,
      readWindowValue(WINDOW_KEYS.chunkWorldId),
      readWindowValue(WINDOW_KEYS.defaultWorldId),
      readDatasetValue(rootElement, DATASET_CHUNK_WORLD_KEYS),
      runtimeConfigChunk.chunkWorldId,
      runtimeConfigChunk.worldId,
      runtimeConfigService.chunkWorldId,
      runtimeConfigService.worldId,
    ),
    chunkWorldId: firstNonEmpty(
      override.chunkWorldId,
      readWindowValue(WINDOW_KEYS.chunkWorldId),
      readDatasetValue(rootElement, ["chunkWorldId", "chunkServiceWorldId", "worldId"]),
      runtimeConfigChunk.chunkWorldId,
      runtimeConfigService.chunkWorldId,
    ),
    ready: firstNonEmpty(
      override.chunkReady,
      readWindowValue(WINDOW_KEYS.chunkReady),
      readDatasetValue(rootElement, DATASET_CHUNK_READY_KEYS),
      runtimeConfigChunk.ready,
      runtimeConfigService.ready,
    ),
    chunkReady: firstNonEmpty(
      override.chunkReady,
      readWindowValue(WINDOW_KEYS.chunkReady),
      readDatasetValue(rootElement, ["chunkReady", "chunkServiceReady", "chunkContextReady"]),
      runtimeConfigChunk.chunkReady,
      runtimeConfigService.chunkReady,
    ),
    status: firstNonEmpty(
      override.chunkStatus,
      readWindowValue(WINDOW_KEYS.chunkStatus),
      readDatasetValue(rootElement, DATASET_CHUNK_STATUS_KEYS),
      runtimeConfigChunk.status,
      runtimeConfigService.status,
    ),
    chunkStatus: firstNonEmpty(
      override.chunkStatus,
      readWindowValue(WINDOW_KEYS.chunkStatus),
      readDatasetValue(rootElement, ["chunkStatus", "chunkServiceStatus", "chunkContextStatus"]),
      runtimeConfigChunk.chunkStatus,
      runtimeConfigService.chunkStatus,
    ),
    fallbackProjectId: firstNonEmpty(defaults?.projectId, DEFAULT_PROJECT_ID),
    fallbackWorldId: firstNonEmpty(defaults?.worldId, DEFAULT_WORLD_ID),
    fallbackApiBaseUrl: firstNonEmpty(defaults?.chunkProxyBaseUrl, DEFAULT_CHUNK_PROXY_BASE_URL),
    source: "runtime_config.normalizeChunkIdentityFromDocument",
  });
}

function createChunkServiceConfig(
  identity: NormalizedChunkIdentity,
  existing?: EditorChunkServiceConfig | UnknownRecord | null,
): EditorChunkServiceConfig {
  const base = asRecord(existing);
  const defaultService = buildDefaultChunkServiceConfig({
    apiBaseUrl: identity.apiBaseUrl,
    browserBaseUrl: identity.browserBaseUrl,
    projectId: identity.projectId,
    worldId: identity.worldId,
  });

  return {
    ...defaultService,
    ...base,
    enabled: true,
    apiBaseUrl: identity.apiBaseUrl,
    browserBaseUrl: identity.browserBaseUrl,
    projectId: identity.projectId,
    worldId: identity.worldId,
    chunkProjectId: identity.chunkProjectId,
    chunkUniverseId: identity.chunkUniverseId,
    chunkWorldId: identity.chunkWorldId,
    chunkReady: identity.chunkReady,
    chunkStatus: identity.chunkStatus,
    ready: identity.chunkReady,
    status: identity.chunkStatus,
    appProjectPublicId: identity.appProjectPublicId,
    projectPublicId: identity.projectPublicId,
    valid: identity.valid,
    degraded: identity.degraded,
    identityWarnings: identity.identityWarnings,
    identityDiagnostics: identity.identityDiagnostics,
    proxyDiagnostics: identity.proxyDiagnostics,
    contractIdentity: identity.identityDiagnostics,
  } as unknown as EditorChunkServiceConfig;
}

function getBootstrapRuntime(
  bootstrap: EditorBootstrap | null | undefined,
): EditorRuntimeConfig {
  try {
    if (bootstrap?.runtime) {
      const runtime = bootstrap.runtime;
      const identity = normalizeChunkIdentityFromRuntime(runtime);

      return {
        ...runtime,
        chunk: createChunkServiceConfig(identity, runtime.chunk),
      };
    }

    const identity = normalizeChunkIdentity({
      fallbackProjectId: DEFAULT_PROJECT_ID,
      fallbackWorldId: DEFAULT_WORLD_ID,
      fallbackApiBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      source: "runtime_config.getBootstrapRuntime.default",
    });

    return buildDefaultRuntimeConfig(
      createChunkServiceConfig(identity),
      buildDefaultPhysicsBootstrap(),
      buildDefaultRuntimeInventoryConfig(),
      buildDefaultRuntimeLibraryConfig(),
    );
  } catch {
    const identity = normalizeChunkIdentity({
      fallbackProjectId: DEFAULT_PROJECT_ID,
      fallbackWorldId: DEFAULT_WORLD_ID,
      fallbackApiBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      source: "runtime_config.getBootstrapRuntime.catch",
    });

    return buildDefaultRuntimeConfig(
      createChunkServiceConfig(identity),
      buildDefaultPhysicsBootstrap(),
      buildDefaultRuntimeInventoryConfig(),
      buildDefaultRuntimeLibraryConfig(),
    );
  }
}

function getBootstrapPhysics(
  bootstrap: EditorBootstrap | null | undefined,
): EditorPhysicsBootstrap {
  try {
    return buildDefaultPhysicsBootstrap(
      bootstrap?.runtime?.physics ?? bootstrap?.physics ?? undefined,
    );
  } catch {
    return buildDefaultPhysicsBootstrap();
  }
}

function getBootstrapFeatures(
  bootstrap: EditorBootstrap | null | undefined,
  physics: EditorPhysicsBootstrap,
): EditorFeatureFlags {
  try {
    return buildDefaultFeatureFlags({
      ...(bootstrap?.featureFlags ?? {}),
      physicsEnabled: bootstrap?.featureFlags?.physicsEnabled ?? physics.enabled,
      playerCollisionEnabled: bootstrap?.featureFlags?.playerCollisionEnabled ?? physics.enabled,
      flightModeEnabled: bootstrap?.featureFlags?.flightModeEnabled ?? physics.enabled,
      debugOverlayEnabled: bootstrap?.featureFlags?.debugOverlayEnabled ?? physics.debug.enabled,
      chunkServiceInventoryEnabled: false,
      chunkPaletteInventoryFallbackEnabled: false,
      placeableBlocksPlaceholderRouteEnabled: false,
      legacyChunkInventoryEnabled: false,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    });
  } catch {
    return buildDefaultFeatureFlags({
      physicsEnabled: physics.enabled,
      playerCollisionEnabled: physics.enabled,
      flightModeEnabled: physics.enabled,
      debugOverlayEnabled: physics.debug.enabled,
      chunkServiceInventoryEnabled: false,
      chunkPaletteInventoryFallbackEnabled: false,
      placeableBlocksPlaceholderRouteEnabled: false,
      legacyChunkInventoryEnabled: false,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    });
  }
}

function getBootstrapInput(
  bootstrap: EditorBootstrap | null | undefined,
): EditorInputBootstrap {
  try {
    return buildDefaultInputBootstrap(bootstrap?.input);
  } catch {
    return buildDefaultInputBootstrap();
  }
}

function getBootstrapCamera(
  bootstrap: EditorBootstrap | null | undefined,
  physics: EditorPhysicsBootstrap,
): EditorCameraBootstrap {
  try {
    return buildDefaultCameraBootstrap({
      ...(bootstrap?.camera ?? {}),
      physicsFollowEnabled: bootstrap?.camera?.physicsFollowEnabled ?? physics.enabled,
      directMovementEnabled: bootstrap?.camera?.directMovementEnabled ?? !physics.enabled,
    });
  } catch {
    return buildDefaultCameraBootstrap({
      physicsFollowEnabled: physics.enabled,
      directMovementEnabled: !physics.enabled,
    });
  }
}

function getBootstrapRender(
  bootstrap: EditorBootstrap | null | undefined,
): EditorRenderBootstrap {
  try {
    return buildDefaultRenderBootstrap(bootstrap?.render);
  } catch {
    return buildDefaultRenderBootstrap();
  }
}

export function editorPhysicsBootstrapToPhysicsConfigPatch(
  physics: EditorPhysicsBootstrap | null | undefined,
): PhysicsConfigPatch {
  try {
    const safePhysics = buildDefaultPhysicsBootstrap(physics ?? undefined);

    return {
      enabled: safePhysics.enabled,
      timing: {
        fixedTimeStepSeconds: safePhysics.timing.fixedTimeStepSeconds,
        maxFrameDeltaSeconds: safePhysics.timing.maxFrameDeltaSeconds,
        maxSubSteps: safePhysics.timing.maxSubSteps,
      },
      movement: {
        walkSpeed: safePhysics.movement.walkSpeed,
        sprintSpeed: safePhysics.movement.sprintSpeed,
        airControlSpeed: safePhysics.movement.airControlSpeed,
        flySpeed: safePhysics.movement.flySpeed,
        flySprintSpeed: safePhysics.movement.flySprintSpeed,
        jumpVelocity: safePhysics.movement.jumpVelocity,
        gravity: safePhysics.movement.gravity,
        maxFallSpeed: safePhysics.movement.maxFallSpeed,
        groundSnapDistance: safePhysics.movement.groundSnapDistance,
      },
      input: {
        doubleTapWindowMs: safePhysics.input.doubleTapWindowMs,
        allowJumpBeforeFlightToggle: safePhysics.input.allowJumpBeforeFlightToggle,
      },
      collider: {
        kind: safePhysics.collider.kind,
        width: safePhysics.collider.width,
        height: safePhysics.collider.height,
        eyeHeight: safePhysics.collider.eyeHeight,
        skinWidth: safePhysics.collider.skinWidth,
      },
      missingChunks: {
        policy: safePhysics.missingChunks.policy,
        blockHorizontalMovement: safePhysics.missingChunks.blockHorizontalMovement,
        blockVerticalMovement: safePhysics.missingChunks.blockVerticalMovement,
      },
      debug: {
        enabled: safePhysics.debug.enabled,
        exposeToStore: safePhysics.debug.exposeToStore,
        includeCollisionCells: safePhysics.debug.includeCollisionCells,
      },
    };
  } catch {
    return createDefaultPhysicsConfig();
  }
}

export function editorPhysicsBootstrapToControllerConfigPatch(
  physics: EditorPhysicsBootstrap | null | undefined,
): PlayerPhysicsControllerConfigPatch {
  try {
    const safePhysics = buildDefaultPhysicsBootstrap(physics ?? undefined);
    const physicsConfig = editorPhysicsBootstrapToPhysicsConfigPatch(safePhysics);

    return {
      physics: physicsConfig,
      collision: {
        enabled: safePhysics.enabled,
        epsilon: 0.000001,
        skinWidth: safePhysics.collider.skinWidth,
        includeTraceCells: safePhysics.debug.includeCollisionCells,
        groundProbeDistance: Math.max(0.01, safePhysics.movement.groundSnapDistance),
        ceilingProbeDistance: Math.max(0.01, safePhysics.collider.skinWidth * 4),
        maxCellsPerQuery: 262_144,
      },
      yawForwardSign: 1,
      preserveHorizontalVelocityWhenNoInput: false,
      horizontalDampingPerSecond: 24,
      airborneHorizontalDampingPerSecond: 8,
      flyingDampingPerSecond: 18,
    };
  } catch {
    return {
      physics: createDefaultPhysicsConfig(),
      collision: {
        enabled: true,
      },
    };
  }
}

export function editorPhysicsBootstrapToRuntimeConfigPatch(
  physics: EditorPhysicsBootstrap | null | undefined,
): PhysicsRuntimeConfigPatch {
  try {
    const safePhysics = buildDefaultPhysicsBootstrap(physics ?? undefined);
    const physicsConfig = editorPhysicsBootstrapToPhysicsConfigPatch(safePhysics);
    const controller = editorPhysicsBootstrapToControllerConfigPatch(safePhysics);

    return {
      enabled: safePhysics.enabled,
      physics: physicsConfig,
      controller,
      fixedTimeStepSeconds: safePhysics.timing.fixedTimeStepSeconds,
      maxFrameDeltaSeconds: safePhysics.timing.maxFrameDeltaSeconds,
      maxSubSteps: safePhysics.timing.maxSubSteps,
      exposeWarnings: true,
      failClosedWithoutQuery: true,
    };
  } catch {
    return {
      enabled: true,
      physics: createDefaultPhysicsConfig(),
      controller: {
        physics: createDefaultPhysicsConfig(),
      },
      fixedTimeStepSeconds: 1 / 60,
      maxFrameDeltaSeconds: 0.25,
      maxSubSteps: 8,
      exposeWarnings: true,
      failClosedWithoutQuery: true,
    };
  }
}

export function createRuntimeChunkConfig(
  runtime: EditorRuntimeConfig,
  render: EditorRenderBootstrap,
  overrides?: Partial<RuntimeChunkConfig> | null,
): RuntimeChunkConfig {
  try {
    const identity = normalizeChunkIdentityFromRuntime(runtime, overrides);
    const chunk = createChunkServiceConfig(identity, runtime.chunk);

    return {
      enabled: true,
      apiBaseUrl: identity.apiBaseUrl,
      browserBaseUrl: identity.browserBaseUrl,
      projectId: identity.projectId,
      worldId: identity.worldId,
      chunkProjectId: identity.chunkProjectId,
      chunkUniverseId: identity.chunkUniverseId,
      chunkWorldId: identity.chunkWorldId,
      chunkReady: identity.chunkReady,
      chunkStatus: identity.chunkStatus,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      valid: identity.valid,
      degraded: identity.degraded,
      identityWarnings: identity.identityWarnings,
      identityDiagnostics: identity.identityDiagnostics,
      proxyDiagnostics: identity.proxyDiagnostics,
      preferBatchLoad: safeBoolean(overrides?.preferBatchLoad, asRecord(chunk).preferBatchLoad),
      reloadDirtyChunksAfterCommand: safeBoolean(
        overrides?.reloadDirtyChunksAfterCommand,
        asRecord(chunk).reloadDirtyChunksAfterCommand,
      ),
      maxBatchChunks: safeInteger(overrides?.maxBatchChunks, asRecord(chunk).maxBatchChunks, 1, 4096),
      visibleChunkRadius: safeInteger(overrides?.visibleChunkRadius, render.visibleChunkRadius, 0, 32),
      maxChunksPerRenderSync: safeInteger(
        overrides?.maxChunksPerRenderSync,
        render.maxChunksPerRenderSync,
        1,
        4096,
      ),
      service: {
        ...chunk,
        apiBaseUrl: identity.apiBaseUrl,
        browserBaseUrl: identity.browserBaseUrl,
        projectId: identity.projectId,
        worldId: identity.worldId,
        chunkProjectId: identity.chunkProjectId,
        chunkUniverseId: identity.chunkUniverseId,
        chunkWorldId: identity.chunkWorldId,
        chunkReady: identity.chunkReady,
        chunkStatus: identity.chunkStatus,
        ready: identity.chunkReady,
        status: identity.chunkStatus,
        appProjectPublicId: identity.appProjectPublicId,
        projectPublicId: identity.projectPublicId,
        valid: identity.valid,
        degraded: identity.degraded,
        identityWarnings: identity.identityWarnings,
        identityDiagnostics: identity.identityDiagnostics,
        proxyDiagnostics: identity.proxyDiagnostics,
        contractIdentity: identity.identityDiagnostics,
        preferBatchLoad: safeBoolean(overrides?.preferBatchLoad, asRecord(chunk).preferBatchLoad),
        reloadDirtyChunksAfterCommand: safeBoolean(
          overrides?.reloadDirtyChunksAfterCommand,
          asRecord(chunk).reloadDirtyChunksAfterCommand,
        ),
        maxBatchChunks: safeInteger(overrides?.maxBatchChunks, asRecord(chunk).maxBatchChunks, 1, 4096),
      } as unknown as EditorChunkServiceConfig,
    };
  } catch {
    const fallbackIdentity = normalizeChunkIdentity({
      fallbackProjectId: DEFAULT_PROJECT_ID,
      fallbackWorldId: DEFAULT_WORLD_ID,
      fallbackApiBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      source: "runtime_config.createRuntimeChunkConfig.catch",
    });
    const fallback = createChunkServiceConfig(fallbackIdentity);

    return {
      enabled: true,
      apiBaseUrl: fallbackIdentity.apiBaseUrl,
      browserBaseUrl: fallbackIdentity.browserBaseUrl,
      projectId: fallbackIdentity.projectId,
      worldId: fallbackIdentity.worldId,
      chunkProjectId: fallbackIdentity.chunkProjectId,
      chunkUniverseId: fallbackIdentity.chunkUniverseId,
      chunkWorldId: fallbackIdentity.chunkWorldId,
      chunkReady: fallbackIdentity.chunkReady,
      chunkStatus: fallbackIdentity.chunkStatus,
      appProjectPublicId: fallbackIdentity.appProjectPublicId,
      projectPublicId: fallbackIdentity.projectPublicId,
      valid: fallbackIdentity.valid,
      degraded: true,
      identityWarnings: [
        ...fallbackIdentity.identityWarnings,
        "runtime_chunk_config_fallback_used",
      ],
      identityDiagnostics: fallbackIdentity.identityDiagnostics,
      proxyDiagnostics: fallbackIdentity.proxyDiagnostics,
      preferBatchLoad: safeBoolean(asRecord(fallback).preferBatchLoad, true),
      reloadDirtyChunksAfterCommand: safeBoolean(asRecord(fallback).reloadDirtyChunksAfterCommand, true),
      maxBatchChunks: safeInteger(asRecord(fallback).maxBatchChunks, 256, 1, 4096),
      visibleChunkRadius: 7,
      maxChunksPerRenderSync: 256,
      service: fallback,
    };
  }
}

export function createRuntimeInputConfig(
  input: EditorInputBootstrap,
  physics: EditorPhysicsBootstrap,
  overrides?: Partial<RuntimeInputConfig> | null,
): RuntimeInputConfig {
  try {
    return {
      pointerLockEnabled: safeBoolean(overrides?.pointerLockEnabled, input.pointerLockEnabled),
      keyboardEnabled: safeBoolean(overrides?.keyboardEnabled, input.keyboardEnabled),
      mouseEnabled: safeBoolean(overrides?.mouseEnabled, input.mouseEnabled),
      wheelEnabled: safeBoolean(overrides?.wheelEnabled, input.wheelEnabled),
      invertY: safeBoolean(overrides?.invertY, input.invertY),
      sensitivity: safeNumber(overrides?.sensitivity, input.sensitivity, 0.00001, 0.1),
      doubleTapWindowMs: safeInteger(
        overrides?.doubleTapWindowMs,
        physics.input.doubleTapWindowMs,
        80,
        800,
      ),
    };
  } catch {
    const fallback = buildDefaultInputBootstrap();

    return {
      pointerLockEnabled: fallback.pointerLockEnabled,
      keyboardEnabled: fallback.keyboardEnabled,
      mouseEnabled: fallback.mouseEnabled,
      wheelEnabled: fallback.wheelEnabled,
      invertY: fallback.invertY,
      sensitivity: fallback.sensitivity,
      doubleTapWindowMs: 280,
    };
  }
}

export function createRuntimeCameraConfig(
  camera: EditorCameraBootstrap,
  physics: EditorPhysicsBootstrap,
  overrides?: Partial<RuntimeCameraConfig> | null,
): RuntimeCameraConfig {
  try {
    const physicsFollowEnabled = safeBoolean(
      overrides?.physicsFollowEnabled,
      camera.physicsFollowEnabled ?? physics.enabled,
    );

    return {
      mode: "first-person",
      fov: safeNumber(overrides?.fov, camera.fov, 10, 140),
      near: safeNumber(overrides?.near, camera.near, 0.001, 10_000),
      far: safeNumber(overrides?.far, camera.far, 1, 1_000_000),
      spawn: {
        x: safeNumber(overrides?.spawn?.x, camera.spawn.x),
        y: safeNumber(overrides?.spawn?.y, camera.spawn.y),
        z: safeNumber(overrides?.spawn?.z, camera.spawn.z),
      },
      rotation: {
        pitch: safeNumber(overrides?.rotation?.pitch, camera.rotation.pitch, -Math.PI / 2, Math.PI / 2),
        yaw: safeNumber(overrides?.rotation?.yaw, camera.rotation.yaw, -Math.PI * 4, Math.PI * 4),
        roll: safeNumber(overrides?.rotation?.roll, camera.rotation.roll, -Math.PI * 2, Math.PI * 2),
      },
      moveSpeed: safeNumber(overrides?.moveSpeed, camera.moveSpeed, 0, 1000),
      sprintMultiplier: safeNumber(overrides?.sprintMultiplier, camera.sprintMultiplier, 1, 100),
      directMovementEnabled: safeBoolean(
        overrides?.directMovementEnabled,
        camera.directMovementEnabled ?? !physicsFollowEnabled,
      ),
      physicsFollowEnabled,
    };
  } catch {
    const fallback = buildDefaultCameraBootstrap();

    return {
      mode: "first-person",
      fov: fallback.fov,
      near: fallback.near,
      far: fallback.far,
      spawn: fallback.spawn,
      rotation: fallback.rotation,
      moveSpeed: fallback.moveSpeed,
      sprintMultiplier: fallback.sprintMultiplier,
      directMovementEnabled: !physics.enabled,
      physicsFollowEnabled: physics.enabled,
    };
  }
}

export function createRuntimeRenderConfig(
  render: EditorRenderBootstrap,
  overrides?: Partial<RuntimeRenderConfig> | null,
): RuntimeRenderConfig {
  try {
    return {
      antialias: safeBoolean(overrides?.antialias, render.antialias),
      alpha: safeBoolean(overrides?.alpha, render.alpha),
      pixelRatioMax: safeNumber(overrides?.pixelRatioMax, render.pixelRatioMax, 0.25, 8),
      clearColor: safeString(overrides?.clearColor, render.clearColor),
      chunkWireframe: safeBoolean(overrides?.chunkWireframe, render.chunkWireframe),
      showPreview: safeBoolean(overrides?.showPreview, render.showPreview),
      showTargetHighlight: safeBoolean(overrides?.showTargetHighlight, render.showTargetHighlight),
      visibleChunkRadius: safeInteger(overrides?.visibleChunkRadius, render.visibleChunkRadius, 0, 32),
      maxChunksPerRenderSync: safeInteger(
        overrides?.maxChunksPerRenderSync,
        render.maxChunksPerRenderSync,
        1,
        4096,
      ),
    };
  } catch {
    const fallback = buildDefaultRenderBootstrap();

    return {
      antialias: fallback.antialias,
      alpha: fallback.alpha,
      pixelRatioMax: fallback.pixelRatioMax,
      clearColor: fallback.clearColor,
      chunkWireframe: fallback.chunkWireframe,
      showPreview: fallback.showPreview,
      showTargetHighlight: fallback.showTargetHighlight,
      visibleChunkRadius: fallback.visibleChunkRadius,
      maxChunksPerRenderSync: fallback.maxChunksPerRenderSync,
    };
  }
}

export function createRuntimeFeatureConfig(
  features: EditorFeatureFlags,
  physics: EditorPhysicsBootstrap,
  overrides?: Partial<RuntimeFeatureConfig> | null,
): RuntimeFeatureConfig {
  try {
    return {
      pointerLockEnabled: safeBoolean(overrides?.pointerLockEnabled, features.pointerLockEnabled),
      firstPersonEnabled: safeBoolean(overrides?.firstPersonEnabled, features.firstPersonEnabled),
      physicsEnabled: safeBoolean(overrides?.physicsEnabled, features.physicsEnabled ?? physics.enabled),
      playerCollisionEnabled: safeBoolean(
        overrides?.playerCollisionEnabled,
        features.playerCollisionEnabled ?? physics.enabled,
      ),
      flightModeEnabled: safeBoolean(overrides?.flightModeEnabled, features.flightModeEnabled ?? physics.enabled),
      crosshairEnabled: safeBoolean(overrides?.crosshairEnabled, features.crosshairEnabled),
      hotbarEnabled: safeBoolean(overrides?.hotbarEnabled, features.hotbarEnabled),
      statusBarEnabled: safeBoolean(overrides?.statusBarEnabled, features.statusBarEnabled),
      debugOverlayEnabled: safeBoolean(overrides?.debugOverlayEnabled, features.debugOverlayEnabled),
      creativeLibraryEnabled: safeBoolean(overrides?.creativeLibraryEnabled, features.creativeLibraryEnabled),
    };
  } catch {
    return {
      pointerLockEnabled: true,
      firstPersonEnabled: true,
      physicsEnabled: physics.enabled,
      playerCollisionEnabled: physics.enabled,
      flightModeEnabled: physics.enabled,
      crosshairEnabled: true,
      hotbarEnabled: true,
      statusBarEnabled: true,
      debugOverlayEnabled: physics.debug.enabled,
      creativeLibraryEnabled: true,
    };
  }
}

export function createRuntimePhysicsConfig(
  physicsInput: EditorPhysicsBootstrap,
  overrides?: Partial<EditorPhysicsBootstrap> | null,
): RuntimePhysicsConfig {
  try {
    const bootstrap = buildDefaultPhysicsBootstrap({
      ...physicsInput,
      ...(overrides ?? {}),
      timing: {
        ...physicsInput.timing,
        ...(overrides?.timing ?? {}),
      },
      movement: {
        ...physicsInput.movement,
        ...(overrides?.movement ?? {}),
      },
      input: {
        ...physicsInput.input,
        ...(overrides?.input ?? {}),
      },
      collider: {
        ...physicsInput.collider,
        ...(overrides?.collider ?? {}),
      },
      missingChunks: {
        ...physicsInput.missingChunks,
        ...(overrides?.missingChunks ?? {}),
      },
      debug: {
        ...physicsInput.debug,
        ...(overrides?.debug ?? {}),
      },
    });

    const physicsConfigPatch = editorPhysicsBootstrapToPhysicsConfigPatch(bootstrap);
    const controllerConfigPatch = editorPhysicsBootstrapToControllerConfigPatch(bootstrap);
    const runtimeConfigPatch = editorPhysicsBootstrapToRuntimeConfigPatch(bootstrap);

    return {
      enabled: bootstrap.enabled,
      bootstrap,
      physicsConfigPatch,
      runtimeConfigPatch,
      controllerConfigPatch,
    };
  } catch {
    const bootstrap = buildDefaultPhysicsBootstrap();
    const physicsConfigPatch = editorPhysicsBootstrapToPhysicsConfigPatch(bootstrap);

    return {
      enabled: bootstrap.enabled,
      bootstrap,
      physicsConfigPatch,
      runtimeConfigPatch: editorPhysicsBootstrapToRuntimeConfigPatch(bootstrap),
      controllerConfigPatch: editorPhysicsBootstrapToControllerConfigPatch(bootstrap),
    };
  }
}

function appendIdentityWarnings(
  target: RuntimeConfigWarning[],
  identity: RuntimeChunkConfig,
  source: RuntimeConfigSource,
): void {
  try {
    for (const warning of identity.identityWarnings) {
      target.push(createWarning(
        "chunk_identity_contract",
        warning,
        source,
      ));
    }

    if (!identity.valid) {
      target.push(createWarning(
        "chunk_identity_invalid",
        "Chunk runtime identity is invalid. Chunk requests are expected to fail closed before HTTP is sent.",
        source,
      ));
    }
  } catch {
    target.push(createWarning(
      "chunk_identity_warning_append_failed",
      "Chunk identity warning collection failed.",
      source,
    ));
  }
}

export function createResolvedRuntimeConfig(
  bootstrap: EditorBootstrap | null | undefined,
  overrides?: RuntimeConfigOverrides | null,
): ResolvedEditorRuntimeConfig {
  const createdAt = nowIsoStringSafe();
  const warnings: RuntimeConfigWarning[] = [];
  let lastError: RuntimeConfigError | null = null;

  try {
    const source = normalizeSource(overrides?.source ?? (bootstrap ? "bootstrap" : "defaults"));
    const baseRuntime = getBootstrapRuntime(bootstrap);
    const basePhysics = getBootstrapPhysics(bootstrap);
    const physics = createRuntimePhysicsConfig(basePhysics, overrides?.physics);
    const features = createRuntimeFeatureConfig(
      getBootstrapFeatures(bootstrap, physics.bootstrap),
      physics.bootstrap,
      overrides?.features,
    );
    const input = createRuntimeInputConfig(
      getBootstrapInput(bootstrap),
      physics.bootstrap,
      overrides?.input,
    );
    const camera = createRuntimeCameraConfig(
      getBootstrapCamera(bootstrap, physics.bootstrap),
      physics.bootstrap,
      overrides?.camera,
    );
    const render = createRuntimeRenderConfig(
      getBootstrapRender(bootstrap),
      overrides?.render,
    );
    const chunk = createRuntimeChunkConfig(
      {
        ...baseRuntime,
        physics: physics.bootstrap,
      },
      render,
      overrides?.chunk,
    );

    appendIdentityWarnings(warnings, chunk, source);

    if (!features.physicsEnabled || !physics.enabled) {
      warnings.push(createWarning(
        "physics_disabled",
        "Physics runtime is disabled. Camera direct movement may be used if enabled.",
        source,
      ));
    }

    if (camera.physicsFollowEnabled && !features.physicsEnabled) {
      warnings.push(createWarning(
        "camera_follow_without_physics",
        "Camera physics follow is enabled but physics is disabled.",
        source,
      ));
    }

    if (camera.directMovementEnabled && physics.enabled) {
      warnings.push(createWarning(
        "direct_camera_movement_with_physics",
        "Direct camera movement is enabled while physics is enabled. SceneRuntime should avoid applying both movement systems.",
        source,
      ));
    }

    if (physics.bootstrap.missingChunks.policy === "treat_as_air") {
      warnings.push(createWarning(
        "missing_chunks_treated_as_air",
        "Physics missing chunk policy is treat_as_air. The player can fall through unloaded terrain.",
        source,
      ));
    }

    if (!chunk.chunkReady) {
      warnings.push(createWarning(
        "chunk_context_not_ready",
        "Chunk runtime context is not ready. Movement can be blocked by missing chunk collision.",
        source,
      ));
    }

    if (!chunk.valid) {
      lastError = createError(
        "invalid_chunk_identity",
        "Runtime chunk identity is invalid. A valid chk_prj_... chunk project id is required.",
        chunk.identityDiagnostics,
        true,
      );
    }

    return {
      kind: RUNTIME_CONFIG_KIND,
      status: lastError ? "degraded" : warnings.length > 0 ? "degraded" : "ready",
      source,
      createdAt,
      updatedAt: createdAt,
      schemaVersion: RUNTIME_CONFIG_KIND,
      runtime: {
        ...baseRuntime,
        chunk: chunk.service,
        physics: physics.bootstrap,
      },
      chunk,
      input,
      camera,
      render,
      physics,
      features,
      warnings,
      lastError,
    };
  } catch (cause) {
    const physicsBootstrap = buildDefaultPhysicsBootstrap();
    const render = buildDefaultRenderBootstrap();
    const identity = normalizeChunkIdentity({
      fallbackProjectId: DEFAULT_PROJECT_ID,
      fallbackWorldId: DEFAULT_WORLD_ID,
      fallbackApiBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      source: "runtime_config.createResolvedRuntimeConfig.catch",
    });
    const chunkService = createChunkServiceConfig(identity);
    const fallbackRuntime = buildDefaultRuntimeConfig(
      chunkService,
      physicsBootstrap,
      buildDefaultRuntimeInventoryConfig(),
      buildDefaultRuntimeLibraryConfig(),
    );

    lastError = createError(
      "runtime_config_create_failed",
      "Failed to create resolved runtime config. Defaults were used.",
      cause,
      true,
    );

    const physics = createRuntimePhysicsConfig(physicsBootstrap);

    return {
      kind: RUNTIME_CONFIG_KIND,
      status: "failed",
      source: "defaults",
      createdAt,
      updatedAt: createdAt,
      schemaVersion: RUNTIME_CONFIG_KIND,
      runtime: fallbackRuntime,
      chunk: createRuntimeChunkConfig(fallbackRuntime, render),
      input: createRuntimeInputConfig(buildDefaultInputBootstrap(), physicsBootstrap),
      camera: createRuntimeCameraConfig(buildDefaultCameraBootstrap(), physicsBootstrap),
      render: createRuntimeRenderConfig(render),
      physics,
      features: createRuntimeFeatureConfig(buildDefaultFeatureFlags(), physicsBootstrap),
      warnings: [
        createWarning(
          "runtime_config_defaults_used",
          "Runtime config fallback defaults were used.",
          "defaults",
        ),
      ],
      lastError,
    };
  }
}

function createRuntimeInventoryConfig(input: {
  readonly rootElement?: HTMLElement | null;
  readonly defaults?: Partial<EditorBootstrapDefaults>;
}): RuntimeInventoryConfig {
  const rootElement = input.rootElement ?? null;
  const hotbarSize = safeInteger(
    readWindowValue(WINDOW_KEYS.inventoryHotbarSize)
      ?? readDatasetValue(rootElement, ["inventoryHotbarSize", "inventorySlotCount"]),
    9,
    1,
    64,
  );
  const selectedSlot = safeInteger(
    readWindowValue(WINDOW_KEYS.inventorySelectedSlot)
      ?? readDatasetValue(rootElement, ["inventorySelectedSlot", "inventoryDefaultSelectedSlot"]),
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );
  const apiUrl = routeUrl(
    readWindowValue(WINDOW_KEYS.inventoryApiUrl)
      ?? readWindowValue(WINDOW_KEYS.inventoryRoute)
      ?? readDatasetValue(rootElement, ["inventoryApiUrl", "inventoryRoute", "libraryInventoryRoute"]),
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  return {
    enabled: true,
    source: "library",
    kind: "vplib",
    apiUrl,
    inventoryUrl: routeUrl(readWindowValue(WINDOW_KEYS.inventoryUrl) ?? readDatasetValue(rootElement, ["inventoryUrl"]), apiUrl),
    route: routeUrl(readWindowValue(WINDOW_KEYS.inventoryRoute) ?? readDatasetValue(rootElement, ["inventoryRoute"]), apiUrl),
    healthUrl: routeUrl(
      readWindowValue(WINDOW_KEYS.inventoryHealthUrl) ?? readDatasetValue(rootElement, ["inventoryHealthUrl"]),
      DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
    ),
    metadataUrl: routeUrl(
      readWindowValue(WINDOW_KEYS.inventoryMetadataUrl) ?? readDatasetValue(rootElement, ["inventoryMetadataUrl"]),
      DEFAULT_EDITOR_INVENTORY_METADATA_URL,
    ),
    hotbarSize,
    slotCount: hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    forceRefreshOnBoot: safeBoolean(
      readWindowValue(WINDOW_KEYS.inventoryForceRefreshOnBoot)
        ?? readWindowValue(WINDOW_KEYS.inventoryForceRefresh)
        ?? readDatasetValue(rootElement, ["inventoryForceRefreshOnBoot", "inventoryForceRefresh"]),
      false,
    ),
    includeEmptySlots: true,
    allowEmptyFallback: true,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: 10_000,
    cacheTtlMs: 5_000,
    staleCacheTtlMs: 60_000,
  };
}

function createRuntimeLibraryConfig(rootElement?: HTMLElement | null): RuntimeLibraryConfig {
  const apiUrl = routeUrl(
    readWindowValue(WINDOW_KEYS.libraryApiUrl)
      ?? readDatasetValue(rootElement, ["libraryApiUrl", "creativeLibraryApiUrl", "creativeLibraryRoute"]),
    DEFAULT_CREATIVE_LIBRARY_API_URL,
  );

  return {
    enabled: true,
    source: "vectoplan-library",
    apiUrl,
    browserApiUrl: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryBrowserApiUrl)
        ?? readDatasetValue(rootElement, ["libraryBrowserApiUrl", "creativeLibraryBrowserApiUrl"]),
      apiUrl,
    ),
    inventoryRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryInventoryRoute)
        ?? readDatasetValue(rootElement, ["libraryInventoryRoute", "inventoryRoute"]),
      DEFAULT_EDITOR_INVENTORY_API_URL,
    ),
    creativeLibraryRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.creativeLibraryRoute)
        ?? readDatasetValue(rootElement, ["creativeLibraryRoute"]),
      DEFAULT_CREATIVE_LIBRARY_API_URL,
    ),
    healthRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryHealthRoute)
        ?? readDatasetValue(rootElement, ["libraryHealthUrl", "creativeLibraryHealthUrl"]),
      DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
    ),
    metadataRoute: routeUrl(
      readWindowValue(WINDOW_KEYS.libraryMetadataRoute)
        ?? readDatasetValue(rootElement, ["libraryMetadataUrl", "creativeLibraryMetadataUrl"]),
      DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
    ),
    browserCallsLibraryDirectly: false,
  };
}

function createRuntimeConfigFeatureFlags(
  features: RuntimeFeatureConfig,
  inventory: RuntimeInventoryConfig,
  library: RuntimeLibraryConfig,
): RuntimeConfigFeatureFlags {
  return {
    chunkServiceEnabled: true,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,
    chunkServiceInventoryEnabled: false,
    chunkPaletteInventoryFallbackEnabled: false,
    placeableBlocksPlaceholderRouteEnabled: false,
    legacyChunkInventoryEnabled: false,
    editorInventoryApiEnabled: inventory.enabled,
    libraryInventoryEnabled: inventory.enabled,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    remoteCommandsEnabled: true,
    dirtyChunkReloadEnabled: true,
    pointerLockEnabled: features.pointerLockEnabled,
    firstPersonEnabled: features.firstPersonEnabled,
    physicsEnabled: features.physicsEnabled,
    playerCollisionEnabled: features.playerCollisionEnabled,
    flightModeEnabled: features.flightModeEnabled,
    crosshairEnabled: features.crosshairEnabled,
    hotbarEnabled: features.hotbarEnabled,
    statusBarEnabled: features.statusBarEnabled,
    loadingOverlayEnabled: true,
    errorPanelEnabled: true,
    debugOverlayEnabled: features.debugOverlayEnabled,
    creativeLibraryEnabled: features.creativeLibraryEnabled && library.enabled,
  };
}

export function readRuntimeConfig(options?: ReadRuntimeConfigOptions): RuntimeConfig {
  const createdAt = nowIsoStringSafe();
  const rootElement = options?.rootElement ?? null;
  const buildMode = safeString(
    readWindowValue(WINDOW_KEYS.buildMode)
      ?? readDatasetValue(rootElement, ["editorBuildMode", "buildMode"]),
    options?.defaults?.buildMode ?? "development",
  );
  const buildVersion = safeString(
    readWindowValue(WINDOW_KEYS.buildVersion)
      ?? readDatasetValue(rootElement, ["editorBuildVersion", "buildVersion"]),
    options?.defaults?.buildVersion ?? "dev",
  );

  const identity = normalizeChunkIdentityFromDocument(
    rootElement,
    options?.defaults,
    options?.overrides?.chunk ?? null,
  );

  const physicsBootstrap = buildDefaultPhysicsBootstrap();
  const renderBootstrap = buildDefaultRenderBootstrap();
  const chunkService = createChunkServiceConfig(identity);
  const runtimeBase = buildDefaultRuntimeConfig(
    chunkService,
    physicsBootstrap,
    buildDefaultRuntimeInventoryConfig(),
    buildDefaultRuntimeLibraryConfig(),
  );

  const resolved = createResolvedRuntimeConfig(
    {
      runtime: runtimeBase,
      physics: physicsBootstrap,
      featureFlags: buildDefaultFeatureFlags(),
      input: buildDefaultInputBootstrap(),
      camera: buildDefaultCameraBootstrap(),
      render: renderBootstrap,
    } as EditorBootstrap,
    {
      ...(options?.overrides ?? {}),
      chunk: {
        ...(options?.overrides?.chunk ?? {}),
        apiBaseUrl: identity.apiBaseUrl,
        browserBaseUrl: identity.browserBaseUrl,
        projectId: identity.projectId,
        chunkProjectId: identity.chunkProjectId,
        chunkUniverseId: identity.chunkUniverseId,
        worldId: identity.worldId,
        chunkWorldId: identity.chunkWorldId,
        chunkReady: identity.chunkReady,
        chunkStatus: identity.chunkStatus,
        appProjectPublicId: identity.appProjectPublicId,
        projectPublicId: identity.projectPublicId,
      },
    },
  );

  const inventory = createRuntimeInventoryConfig({
    rootElement,
    defaults: options?.defaults,
  });
  const library = createRuntimeLibraryConfig(rootElement);
  const features = resolved.features;
  const featureFlags = createRuntimeConfigFeatureFlags(features, inventory, library);
  const runtimeChunk = createRuntimeChunkConfig(
    {
      ...resolved.runtime,
      chunk: createChunkServiceConfig(identity, resolved.runtime.chunk),
    },
    resolved.render,
    {
      ...(options?.overrides?.chunk ?? {}),
      apiBaseUrl: identity.apiBaseUrl,
      browserBaseUrl: identity.browserBaseUrl,
      projectId: identity.projectId,
      chunkProjectId: identity.chunkProjectId,
      chunkUniverseId: identity.chunkUniverseId,
      worldId: identity.worldId,
      chunkWorldId: identity.chunkWorldId,
      chunkReady: identity.chunkReady,
      chunkStatus: identity.chunkStatus,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
    },
  );

  const localWarningDetails: RuntimeConfigWarning[] = [];

  if (safeBoolean(readWindowValue(WINDOW_KEYS.localWorldFallbackEnabled), false)) {
    localWarningDetails.push(createWarning(
      "local_world_fallback_disabled",
      "Local world fallback is disabled in the current editor runtime.",
      "merged",
    ));
  }

  if (safeBoolean(readWindowValue(WINDOW_KEYS.legacyFrontendEnabled), false)) {
    localWarningDetails.push(createWarning(
      "legacy_frontend_disabled",
      "Legacy frontend is disabled in the current editor runtime.",
      "merged",
    ));
  }

  if (!runtimeChunk.chunkReady) {
    localWarningDetails.push(createWarning(
      "chunk_runtime_context_not_ready",
      "Chunk runtime context is not ready. Movement can be blocked by missing chunk collision.",
      "merged",
    ));
  }

  if (!runtimeChunk.valid) {
    localWarningDetails.push(createWarning(
      "runtime_chunk_identity_invalid",
      "Runtime chunk identity is invalid. Expected chunkProjectId with chk_prj_ prefix.",
      "merged",
    ));
  }

  for (const warning of runtimeChunk.identityWarnings) {
    localWarningDetails.push(createWarning(
      "runtime_chunk_identity_contract",
      warning,
      "merged",
    ));
  }

  const warningDetails = [
    ...resolved.warnings,
    ...localWarningDetails,
  ];

  const lastError = resolved.lastError ?? (!runtimeChunk.valid
    ? createError(
        "runtime_chunk_identity_invalid",
        "Runtime chunk identity is invalid. Expected chunkProjectId with chk_prj_ prefix.",
        runtimeChunk.identityDiagnostics,
        true,
      )
    : null);

  return {
    kind: RUNTIME_CONFIG_KIND,
    schemaVersion: RUNTIME_CONFIG_KIND,
    status: lastError ? "degraded" : warningDetails.length > 0 ? "degraded" : "ready",
    source: "merged",
    environment: runtimeEnvironmentFromBuildMode(buildMode),
    buildMode,
    buildVersion,
    createdAt,
    updatedAt: createdAt,
    runtime: {
      ...resolved.runtime,
      chunk: runtimeChunk.service,
      inventory: buildDefaultRuntimeInventoryConfig({
        apiUrl: inventory.apiUrl,
        inventoryUrl: inventory.inventoryUrl,
        route: inventory.route,
        healthUrl: inventory.healthUrl,
        metadataUrl: inventory.metadataUrl,
        hotbarSize: inventory.hotbarSize,
        slotCount: inventory.slotCount,
        selectedSlot: inventory.selectedSlot,
        defaultSelectedSlot: inventory.defaultSelectedSlot,
        forceRefreshOnBoot: inventory.forceRefreshOnBoot,
        includeEmptySlots: inventory.includeEmptySlots,
        allowEmptyFallback: inventory.allowEmptyFallback,
        requestTimeoutMs: inventory.requestTimeoutMs,
        cacheTtlMs: inventory.cacheTtlMs,
        staleCacheTtlMs: inventory.staleCacheTtlMs,
      }),
      library: buildDefaultRuntimeLibraryConfig(library),
    },
    chunk: runtimeChunk,
    inventory,
    library,
    input: resolved.input,
    camera: resolved.camera,
    render: resolved.render,
    physics: resolved.physics,
    features,
    featureFlags,
    warnings: warningDetails.map((warning) => warning.message),
    warningDetails,
    lastError,
  };
}

export function runtimeConfigToBootstrapDefaults(config: RuntimeConfig): EditorBootstrapDefaults {
  return {
    buildMode: config.buildMode,
    buildVersion: config.buildVersion,
    chunkProxyBaseUrl: config.chunk.apiBaseUrl,
    projectId: config.chunk.projectId,
    worldId: config.chunk.worldId,
    localWorldFallbackEnabled: false,
  };
}

export function installRuntimeConfigWindowGlobals(config: RuntimeConfig): void {
  try {
    const target = windowRecord();

    target[WINDOW_KEYS.runtimeConfig] = config;
    target[WINDOW_KEYS.buildMode] = config.buildMode;
    target[WINDOW_KEYS.buildVersion] = config.buildVersion;

    target[WINDOW_KEYS.chunkApiBaseUrl] = config.chunk.apiBaseUrl;
    target[WINDOW_KEYS.chunkBrowserBaseUrl] = config.chunk.browserBaseUrl;
    target[WINDOW_KEYS.chunkProxyBaseUrl] = config.chunk.apiBaseUrl;

    target[WINDOW_KEYS.defaultProjectId] = config.chunk.chunkProjectId;
    target[WINDOW_KEYS.defaultWorldId] = config.chunk.chunkWorldId;

    target[WINDOW_KEYS.chunkProjectId] = config.chunk.chunkProjectId;
    target[WINDOW_KEYS.chunkUniverseId] = config.chunk.chunkUniverseId ?? "";
    target[WINDOW_KEYS.chunkWorldId] = config.chunk.chunkWorldId;
    target[WINDOW_KEYS.chunkReady] = config.chunk.chunkReady;
    target[WINDOW_KEYS.chunkStatus] = config.chunk.chunkStatus;

    target[WINDOW_KEYS.appProjectPublicId] = config.chunk.appProjectPublicId ?? "";
    target[WINDOW_KEYS.projectPublicId] = config.chunk.projectPublicId ?? "";

    target[WINDOW_KEYS.inventoryApiUrl] = config.inventory.apiUrl;
    target[WINDOW_KEYS.inventoryUrl] = config.inventory.inventoryUrl;
    target[WINDOW_KEYS.inventoryRoute] = config.inventory.route;
    target[WINDOW_KEYS.inventoryHealthUrl] = config.inventory.healthUrl;
    target[WINDOW_KEYS.inventoryMetadataUrl] = config.inventory.metadataUrl;
    target[WINDOW_KEYS.inventoryHotbarSize] = config.inventory.hotbarSize;
    target[WINDOW_KEYS.inventorySelectedSlot] = config.inventory.selectedSlot;
    target[WINDOW_KEYS.inventoryForceRefresh] = config.inventory.forceRefreshOnBoot;
    target[WINDOW_KEYS.inventoryForceRefreshOnBoot] = config.inventory.forceRefreshOnBoot;

    target[WINDOW_KEYS.libraryApiUrl] = config.library.apiUrl;
    target[WINDOW_KEYS.libraryBrowserApiUrl] = config.library.browserApiUrl;
    target[WINDOW_KEYS.libraryInventoryRoute] = config.library.inventoryRoute;
    target[WINDOW_KEYS.creativeLibraryRoute] = config.library.creativeLibraryRoute;
    target[WINDOW_KEYS.libraryHealthRoute] = config.library.healthRoute;
    target[WINDOW_KEYS.libraryMetadataRoute] = config.library.metadataRoute;

    target[WINDOW_KEYS.localWorldFallbackEnabled] = false;
    target[WINDOW_KEYS.legacyFrontendEnabled] = false;
  } catch {
    // Window globals are diagnostic only.
  }
}

export function shouldUsePhysicsRuntime(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      config.physics.enabled &&
        config.features.physicsEnabled &&
        config.features.playerCollisionEnabled,
    );
  } catch {
    return false;
  }
}

export function shouldUseFlightMode(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      shouldUsePhysicsRuntime(config) &&
        config.features.flightModeEnabled,
    );
  } catch {
    return false;
  }
}

export function shouldUseDirectCameraMovement(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      config.camera.directMovementEnabled &&
        !shouldUsePhysicsRuntime(config),
    );
  } catch {
    return false;
  }
}

export function shouldCameraFollowPhysics(config: ResolvedEditorRuntimeConfig | RuntimeConfig): boolean {
  try {
    return Boolean(
      config.camera.physicsFollowEnabled &&
        shouldUsePhysicsRuntime(config),
    );
  } catch {
    return false;
  }
}

export function getRuntimeVisibleChunkRadius(config: ResolvedEditorRuntimeConfig | RuntimeConfig): number {
  try {
    return safeInteger(
      config.chunk.visibleChunkRadius,
      config.render.visibleChunkRadius,
      0,
      32,
    );
  } catch {
    return 1;
  }
}

export function runtimeConfigToPhysicsConfigPatch(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): PhysicsConfigPatch {
  try {
    return config.physics.physicsConfigPatch;
  } catch {
    return createDefaultPhysicsConfig();
  }
}

export function runtimeConfigToPhysicsRuntimeConfigPatch(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): PhysicsRuntimeConfigPatch {
  try {
    return config.physics.runtimeConfigPatch;
  } catch {
    return editorPhysicsBootstrapToRuntimeConfigPatch(buildDefaultPhysicsBootstrap());
  }
}

export function runtimeConfigToPlayerControllerConfigPatch(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): PlayerPhysicsControllerConfigPatch {
  try {
    return config.physics.controllerConfigPatch;
  } catch {
    return editorPhysicsBootstrapToControllerConfigPatch(buildDefaultPhysicsBootstrap());
  }
}

export function runtimeConfigToDebugSummary(
  config: ResolvedEditorRuntimeConfig | RuntimeConfig,
): Record<string, unknown> {
  try {
    return {
      kind: config.kind,
      status: config.status,
      source: config.source,
      chunk: {
        apiBaseUrl: config.chunk.apiBaseUrl,
        browserBaseUrl: config.chunk.browserBaseUrl,
        projectId: config.chunk.projectId,
        worldId: config.chunk.worldId,
        chunkProjectId: config.chunk.chunkProjectId,
        chunkUniverseId: config.chunk.chunkUniverseId,
        chunkWorldId: config.chunk.chunkWorldId,
        chunkReady: config.chunk.chunkReady,
        chunkStatus: config.chunk.chunkStatus,
        appProjectPublicId: config.chunk.appProjectPublicId,
        projectPublicId: config.chunk.projectPublicId,
        valid: config.chunk.valid,
        degraded: config.chunk.degraded,
        identityWarnings: config.chunk.identityWarnings,
        identityDiagnostics: config.chunk.identityDiagnostics,
        proxyDiagnostics: config.chunk.proxyDiagnostics,
        visibleChunkRadius: config.chunk.visibleChunkRadius,
        maxBatchChunks: config.chunk.maxBatchChunks,
      },
      inventory: "inventory" in config
        ? {
            apiUrl: config.inventory.apiUrl,
            route: config.inventory.route,
            hotbarSize: config.inventory.hotbarSize,
            selectedSlot: config.inventory.selectedSlot,
            onlyLibraryItemsPlaceable: config.inventory.onlyLibraryItemsPlaceable,
            debugGrassDirtAllowed: config.inventory.debugGrassDirtAllowed,
          }
        : null,
      physics: {
        enabled: config.physics.enabled,
        mode: config.physics.bootstrap.mode,
        fixedTimeStepSeconds: config.physics.bootstrap.timing.fixedTimeStepSeconds,
        maxSubSteps: config.physics.bootstrap.timing.maxSubSteps,
        walkSpeed: config.physics.bootstrap.movement.walkSpeed,
        sprintSpeed: config.physics.bootstrap.movement.sprintSpeed,
        flySpeed: config.physics.bootstrap.movement.flySpeed,
        missingChunkPolicy: config.physics.bootstrap.missingChunks.policy,
      },
      camera: {
        physicsFollowEnabled: config.camera.physicsFollowEnabled,
        directMovementEnabled: config.camera.directMovementEnabled,
        spawn: config.camera.spawn,
      },
      features: config.features,
      warnings: config.warnings,
      lastError: config.lastError,
    };
  } catch {
    return {
      kind: RUNTIME_CONFIG_KIND,
      status: "failed",
      error: "runtime_config_debug_summary_failed",
    };
  }
}

export function createRuntimeConfigCache(
  initialConfig?: ResolvedEditorRuntimeConfig | null,
): RuntimeConfigCache {
  let revision = 0;
  let current = initialConfig ?? createResolvedRuntimeConfig(null, {
    source: "defaults",
  });

  return {
    kind: RUNTIME_CONFIG_CACHE_KIND,

    get(): ResolvedEditorRuntimeConfig {
      try {
        return current;
      } catch {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        return current;
      }
    },

    set(config: ResolvedEditorRuntimeConfig): ResolvedEditorRuntimeConfig {
      try {
        current = {
          ...config,
          source: config.source === "unknown" ? "cache" : config.source,
          updatedAt: nowIsoStringSafe(),
        };
        revision += 1;
        return current;
      } catch {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        revision += 1;
        return current;
      }
    },

    updateFromBootstrap(
      bootstrap: EditorBootstrap | null | undefined,
      overrides?: RuntimeConfigOverrides | null,
    ): ResolvedEditorRuntimeConfig {
      try {
        current = createResolvedRuntimeConfig(bootstrap, {
          ...(overrides ?? {}),
          source: overrides?.source ?? "bootstrap",
        });
        revision += 1;
        return current;
      } catch {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        revision += 1;
        return current;
      }
    },

    clear(): void {
      try {
        current = createResolvedRuntimeConfig(null, {
          source: "defaults",
        });
        revision += 1;
      } catch {
        revision += 1;
      }
    },

    getRevision(): number {
      return revision;
    },
  };
}

export function isResolvedEditorRuntimeConfig(value: unknown): value is ResolvedEditorRuntimeConfig {
  try {
    const candidate = value as ResolvedEditorRuntimeConfig | null | undefined;

    return Boolean(
      candidate &&
        candidate.kind === RUNTIME_CONFIG_KIND &&
        candidate.chunk &&
        candidate.input &&
        candidate.camera &&
        candidate.render &&
        candidate.physics &&
        candidate.features,
    );
  } catch {
    return false;
  }
}

export function getRuntimeConfigMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.config.runtime_config",
    runtimeConfigKind: RUNTIME_CONFIG_KIND,
    runtimeConfigCacheKind: RUNTIME_CONFIG_CACHE_KIND,
    supportsMainRuntimeConfigExports: true,
    productiveInventoryRoute: DEFAULT_EDITOR_INVENTORY_API_URL,
    creativeLibraryRoute: DEFAULT_CREATIVE_LIBRARY_API_URL,
    rules: {
      readRuntimeConfigExported: true,
      installRuntimeConfigWindowGlobalsExported: true,
      runtimeConfigToBootstrapDefaultsExported: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      legacyChunkInventoryDisabled: true,
      localWorldFallbackDisabled: true,
      legacyFrontendDisabled: true,
      inventoryForceRefreshWindowKeySupported: true,

      readsChunkProjectIdAliases: true,
      readsChunkWorldIdAliases: true,
      runtimeProjectIdIsChunkProjectId: true,
      runtimeWorldIdIsChunkWorldId: true,

      appProjectIdNeverUsedAsChunkProjectId: true,
      projectIdDatasetAliasNoLongerAcceptedAsChunkProjectId: true,
      defaultProjectIdNoLongerMasksAppProjectId: true,
      invalidChunkIdentityBecomesDegradedRuntimeConfig: true,
      editorChunkProxyUrlNormalizedThroughContract: true,
      appOriginEditorProxyRejected: true,
      directChunkServiceUrlRejectedByDefault: true,
      chunkReadyRequiresValidChunkIdentity: true,
    },
  };
}