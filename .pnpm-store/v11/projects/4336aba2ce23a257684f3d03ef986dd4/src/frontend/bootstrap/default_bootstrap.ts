// services/vectoplan-editor/src/frontend/bootstrap/default_bootstrap.ts
import {
  buildDefaultChunkRouteHints,
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
  DEFAULT_PHYSICS_ENABLED,
  DEFAULT_PLAYER_COLLISION_ENABLED,
  DEFAULT_POINTER_LOCK_ENABLED,
  DEFAULT_PRIMARY_BLOCK_TYPE_ID,
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
  type EditorBootstrapDefaults,
  type EditorCameraBootstrap,
  type EditorChunkIdentityDiagnostics,
  type EditorChunkServiceConfig,
  type EditorCreativeLibraryBootstrap,
  type EditorFeatureFlags,
  type EditorInputBootstrap,
  type EditorInventoryBootstrap,
  type EditorPhysicsBootstrap,
  type EditorProjectBootstrap,
  type EditorRenderBootstrap,
  type EditorRuntimeConfig,
  type EditorRuntimeInventoryConfig,
  type EditorRuntimeLibraryConfig,
  type EditorUiBootstrap,
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

interface DefaultChunkIdentity {
  readonly apiBaseUrl: string;
  readonly browserBaseUrl: string;
  readonly projectId: string;
  readonly chunkProjectId: string;
  readonly universeId: string | null;
  readonly chunkUniverseId: string | null;
  readonly worldId: string;
  readonly chunkWorldId: string;
  readonly appProjectPublicId: string | null;
  readonly projectPublicId: string | null;
  readonly ready: boolean;
  readonly chunkReady: boolean;
  readonly status: "ready" | "pending" | "error" | "disabled" | "invalid" | string;
  readonly chunkStatus: "ready" | "pending" | "error" | "disabled" | "invalid" | string;
  readonly valid: boolean;
  readonly degraded: boolean;
  readonly identityWarnings: readonly string[];
  readonly identityDiagnostics: EditorChunkIdentityDiagnostics | UnknownRecord;
  readonly proxyDiagnostics: UnknownRecord;
}

type ChunkDefaultInput =
  Partial<EditorBootstrapDefaults>
  & Partial<EditorChunkServiceConfig>
  & {
    readonly chunkProjectId?: string | null;
    readonly chunkWorldId?: string | null;
    readonly chunkUniverseId?: string | null;
    readonly appProjectPublicId?: string | null;
    readonly projectPublicId?: string | null;
  };

function safeString(value: unknown, fallback: string): string {
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

function safeNullableString(value: unknown): string | null {
  try {
    const normalized = safeString(value, "");
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
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

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function asRecord(value: unknown): UnknownRecord {
  try {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as UnknownRecord
      : {};
  } catch {
    return {};
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

function sanitizeIdentifier(value: unknown, fallback: string): string {
  try {
    const raw = safeString(value, fallback);
    const normalized = raw.replace(/[^a-zA-Z0-9_.:-]/g, "").trim();

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function normalizeChunkStatus(value: unknown, fallback: "ready" | "pending" | "error" | "disabled" | "invalid" | string): string {
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

function selectChunkProjectId(...values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const candidate = sanitizeIdentifier(value, "");

      if (!candidate) {
        continue;
      }

      if (isValidRuntimeChunkProjectId(candidate)) {
        return candidate;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function selectChunkWorldId(...values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const candidate = sanitizeIdentifier(value, "");

      if (!candidate) {
        continue;
      }

      if (isValidRuntimeChunkWorldId(candidate)) {
        return candidate;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function selectAppProjectPublicId(...values: readonly unknown[]): string | null {
  try {
    for (const value of values) {
      const candidate = sanitizeIdentifier(value, "");

      if (!candidate) {
        continue;
      }

      if (isLikelyAppProjectId(candidate)) {
        return candidate;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeFallbackBlockTypeIds(value: unknown): readonly string[] {
  try {
    if (!Array.isArray(value)) {
      return DEFAULT_FALLBACK_BLOCK_TYPE_IDS;
    }

    const blocked = new Set(["debug_grass", "debug_dirt"]);

    const result = value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
      .filter((item) => !blocked.has(item));

    return result.length > 0 ? result : DEFAULT_FALLBACK_BLOCK_TYPE_IDS;
  } catch {
    return DEFAULT_FALLBACK_BLOCK_TYPE_IDS;
  }
}

function normalizeEditorChunkProxyBaseUrlForDefault(value: unknown): {
  readonly baseUrl: string;
  readonly diagnostics: UnknownRecord;
  readonly warnings: readonly string[];
} {
  try {
    const result = resolveEditorChunkProxyBaseUrl(value, {
      defaultBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      editorChunkProxyPath: DEFAULT_CHUNK_PROXY_BASE_URL,
      forceRelativeEditorProxy: true,
      allowDirectChunkServiceUrl: false,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
    });

    return {
      baseUrl: result.baseUrl,
      diagnostics: editorChunkProxyUrlResultToRecord(result),
      warnings: editorChunkProxyUrlIssuesToWarnings(result.issues),
    };
  } catch (error) {
    return {
      baseUrl: normalizeEditorChunkProxyBaseUrl(DEFAULT_CHUNK_PROXY_BASE_URL),
      diagnostics: {
        error: error instanceof Error ? error.message : String(error),
      },
      warnings: ["default_bootstrap_proxy_normalization_failed"],
    };
  }
}

function resolveDefaultChunkIdentity(defaults?: ChunkDefaultInput): DefaultChunkIdentity {
  const proxy = normalizeEditorChunkProxyBaseUrlForDefault(
    firstNonEmpty(defaults?.apiBaseUrl, defaults?.chunkProxyBaseUrl, DEFAULT_CHUNK_PROXY_BASE_URL),
  );
  const browserProxy = normalizeEditorChunkProxyBaseUrlForDefault(
    firstNonEmpty(defaults?.browserBaseUrl, proxy.baseUrl),
  );

  const rawProjectId = firstNonEmpty(defaults?.chunkProjectId, defaults?.projectId);
  const rawAppProjectId = firstNonEmpty(
    defaults?.appProjectPublicId,
    defaults?.projectPublicId,
    isLikelyAppProjectId(rawProjectId) ? rawProjectId : undefined,
  );
  const explicitChunkProjectId = selectChunkProjectId(rawProjectId);
  const explicitWorldId = selectChunkWorldId(defaults?.chunkWorldId, defaults?.worldId);
  const explicitUniverseId = safeNullableString(firstNonEmpty(defaults?.chunkUniverseId, defaults?.universeId));

  const identity = resolveChunkIdentity(
    {
      chunkProjectId: explicitChunkProjectId || undefined,
      projectId: explicitChunkProjectId || undefined,
      defaultProjectId: explicitChunkProjectId ? undefined : DEFAULT_PROJECT_ID,
      appProjectPublicId: rawAppProjectId,
      projectPublicId: rawAppProjectId,
      chunkUniverseId: explicitUniverseId,
      universeId: explicitUniverseId,
      chunkWorldId: explicitWorldId || undefined,
      worldId: explicitWorldId || undefined,
      defaultWorldId: DEFAULT_WORLD_ID,
      chunkReady: firstNonEmpty(defaults?.chunkReady, defaults?.ready),
      chunkStatus: firstNonEmpty(defaults?.chunkStatus, defaults?.status),
      source: "default_bootstrap.resolveDefaultChunkIdentity",
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

  const projectId = sanitizeIdentifier(identity.chunkProjectId, DEFAULT_PROJECT_ID);
  const worldId = sanitizeIdentifier(identity.chunkWorldId, DEFAULT_WORLD_ID);
  const universeId = safeNullableString(identity.chunkUniverseId) ?? explicitUniverseId ?? DEFAULT_UNIVERSE_ID;
  const requestedStatus = normalizeChunkStatus(
    firstNonEmpty(defaults?.chunkStatus, defaults?.status, identity.chunkStatus),
    identity.valid ? "ready" : "invalid",
  );
  const ready = Boolean(
    identity.valid
    && projectId
    && worldId
    && requestedStatus !== "error"
    && requestedStatus !== "disabled"
    && requestedStatus !== "invalid"
  );
  const identityWarnings = [
    ...chunkIdentityIssuesToWarnings(identity.issues),
    ...proxy.warnings,
    ...browserProxy.warnings,
  ];

  return {
    apiBaseUrl: proxy.baseUrl,
    browserBaseUrl: browserProxy.baseUrl,
    projectId,
    chunkProjectId: projectId,
    universeId,
    chunkUniverseId: universeId,
    worldId,
    chunkWorldId: worldId,
    appProjectPublicId: identity.appProjectPublicId ?? selectAppProjectPublicId(rawAppProjectId),
    projectPublicId: identity.projectPublicId ?? identity.appProjectPublicId ?? selectAppProjectPublicId(rawAppProjectId),
    ready,
    chunkReady: ready,
    status: ready ? "ready" : requestedStatus,
    chunkStatus: ready ? "ready" : requestedStatus,
    valid: identity.valid,
    degraded: identity.degraded || identityWarnings.length > 0,
    identityWarnings,
    identityDiagnostics: canonicalChunkIdentityToRecord(identity),
    proxyDiagnostics: {
      apiBaseUrl: proxy.diagnostics,
      browserBaseUrl: browserProxy.diagnostics,
    },
  };
}

function normalizeDefaults(defaults?: Partial<EditorBootstrapDefaults>): EditorBootstrapDefaults {
  const identity = resolveDefaultChunkIdentity(defaults as ChunkDefaultInput);

  return {
    buildMode: safeString(defaults?.buildMode, "development"),
    buildVersion: safeString(defaults?.buildVersion, "0.1.0"),
    chunkProxyBaseUrl: identity.apiBaseUrl,
    projectId: identity.chunkProjectId,
    worldId: identity.chunkWorldId,
    localWorldFallbackEnabled: false,
    appProjectPublicId: identity.appProjectPublicId,
    projectPublicId: identity.projectPublicId,
  };
}

function mergePhysicsBootstrap(
  base: EditorPhysicsBootstrap,
  patch?: Partial<EditorPhysicsBootstrap> | null,
): EditorPhysicsBootstrap {
  try {
    if (!patch) {
      return buildDefaultPhysicsBootstrap(base);
    }

    return buildDefaultPhysicsBootstrap({
      ...base,
      ...patch,
      timing: {
        ...base.timing,
        ...(patch.timing ?? {}),
      },
      movement: {
        ...base.movement,
        ...(patch.movement ?? {}),
      },
      input: {
        ...base.input,
        ...(patch.input ?? {}),
      },
      collider: {
        ...base.collider,
        ...(patch.collider ?? {}),
      },
      missingChunks: {
        ...base.missingChunks,
        ...(patch.missingChunks ?? {}),
      },
      debug: {
        ...base.debug,
        ...(patch.debug ?? {}),
      },
    });
  } catch {
    return buildDefaultPhysicsBootstrap(base);
  }
}

function sanitizeRuntimeInventoryConfig(
  input?: Partial<EditorRuntimeInventoryConfig>,
): EditorRuntimeInventoryConfig {
  const hotbarSize = safeInteger(
    input?.hotbarSize ?? input?.slotCount,
    DEFAULT_INVENTORY_SLOT_COUNT,
    1,
    64,
  );
  const selectedSlot = safeInteger(
    input?.selectedSlot ?? input?.defaultSelectedSlot,
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );
  const apiUrl = normalizeRouteForModel(
    input?.apiUrl ?? input?.inventoryUrl ?? input?.route,
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  const normalized = buildDefaultRuntimeInventoryConfig({
    ...input,
    enabled: input?.enabled ?? true,
    source: DEFAULT_INVENTORY_SOURCE_KIND,
    kind: DEFAULT_INVENTORY_ITEM_KIND,
    apiUrl,
    inventoryUrl: input?.inventoryUrl ?? apiUrl,
    route: input?.route ?? apiUrl,
    healthUrl: input?.healthUrl ?? DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
    metadataUrl: input?.metadataUrl ?? DEFAULT_EDITOR_INVENTORY_METADATA_URL,
    hotbarSize,
    slotCount: hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    forceRefreshOnBoot: input?.forceRefreshOnBoot ?? DEFAULT_INVENTORY_FORCE_REFRESH_ON_BOOT,
    includeEmptySlots: input?.includeEmptySlots ?? DEFAULT_INVENTORY_INCLUDE_EMPTY_SLOTS,
    allowEmptyFallback: input?.allowEmptyFallback ?? DEFAULT_ALLOW_EMPTY_INVENTORY_FALLBACK,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: input?.requestTimeoutMs ?? DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
    cacheTtlMs: input?.cacheTtlMs ?? DEFAULT_INVENTORY_CACHE_TTL_MS,
    staleCacheTtlMs: input?.staleCacheTtlMs ?? DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
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

function sanitizeRuntimeLibraryConfig(
  input?: Partial<EditorRuntimeLibraryConfig>,
): EditorRuntimeLibraryConfig {
  const normalized = buildDefaultRuntimeLibraryConfig({
    ...input,
    enabled: input?.enabled ?? true,
    source: "vectoplan-library",
    apiUrl: input?.apiUrl ?? DEFAULT_CREATIVE_LIBRARY_API_URL,
    browserApiUrl: input?.browserApiUrl ?? input?.apiUrl ?? DEFAULT_CREATIVE_LIBRARY_API_URL,
    inventoryRoute: input?.inventoryRoute ?? DEFAULT_EDITOR_INVENTORY_API_URL,
    creativeLibraryRoute: input?.creativeLibraryRoute ?? DEFAULT_CREATIVE_LIBRARY_API_URL,
    healthRoute: input?.healthRoute ?? DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
    metadataRoute: input?.metadataRoute ?? DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
    browserCallsLibraryDirectly: false,
  });

  return {
    ...normalized,
    source: "vectoplan-library",
    browserCallsLibraryDirectly: false,
  };
}

export function createDefaultAppBootstrap(
  defaults?: Partial<EditorBootstrapDefaults>,
): EditorAppBootstrap {
  const resolved = normalizeDefaults(defaults);

  return {
    name: DEFAULT_EDITOR_SERVICE_NAME,
    mode: resolved.buildMode,
    buildMode: resolved.buildMode,
    buildVersion: resolved.buildVersion,
    templateMode: DEFAULT_EDITOR_TEMPLATE_MODE,
    runtimeMode: DEFAULT_EDITOR_RUNTIME_MODE,
    serviceVersion: resolved.buildVersion,
    frontendRoot: DEFAULT_EDITOR_FRONTEND_ROOT,
    createdAt: nowIsoStringSafe(),
  };
}

export function createDefaultProjectBootstrap(
  defaults?: Partial<EditorBootstrapDefaults>,
): EditorProjectBootstrap {
  const resolved = normalizeDefaults(defaults);
  const identity = resolveDefaultChunkIdentity(resolved as ChunkDefaultInput);

  return {
    projectId: identity.chunkProjectId,
    runtimeProjectId: identity.chunkProjectId,
    chunkProjectId: identity.chunkProjectId,
    appProjectPublicId: identity.appProjectPublicId,
    projectPublicId: identity.projectPublicId,
    worldId: identity.chunkWorldId,
    chunkWorldId: identity.chunkWorldId,
    universeId: identity.chunkUniverseId,
    chunkUniverseId: identity.chunkUniverseId,
    templateId: DEFAULT_TEMPLATE_ID,
    providerId: DEFAULT_PROVIDER_ID,
    providerWorldId: identity.chunkWorldId || DEFAULT_PROVIDER_WORLD_ID,
  };
}

export function createDefaultChunkServiceConfig(
  defaults?: ChunkDefaultInput,
): EditorChunkServiceConfig {
  const resolved = normalizeDefaults(defaults);
  const identity = resolveDefaultChunkIdentity({
    ...defaults,
    ...resolved,
    chunkProjectId: defaults?.chunkProjectId ?? resolved.projectId,
    chunkWorldId: defaults?.chunkWorldId ?? resolved.worldId,
  });
  const routeHints = buildDefaultChunkRouteHints(
    identity.apiBaseUrl,
    identity.chunkProjectId,
    identity.chunkWorldId,
  );

  try {
    const baseConfig = buildDefaultChunkServiceConfig({
      ...defaults,
      apiBaseUrl: identity.apiBaseUrl,
      browserBaseUrl: identity.browserBaseUrl,
      projectId: identity.chunkProjectId,
      chunkProjectId: identity.chunkProjectId,
      worldId: identity.chunkWorldId,
      chunkWorldId: identity.chunkWorldId,
      universeId: identity.chunkUniverseId,
      chunkUniverseId: identity.chunkUniverseId,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      chunkReady: identity.chunkReady,
      ready: identity.ready,
      chunkStatus: identity.chunkStatus,
      status: identity.status,
      identityValid: identity.valid,
      identityDegraded: identity.degraded,
      identityWarnings: identity.identityWarnings,
      chunkIdentityWarnings: identity.identityWarnings,
      identityDiagnostics: identity.identityDiagnostics,
      contractIdentity: identity.identityDiagnostics,
      proxyDiagnostics: identity.proxyDiagnostics,
      preferBatchLoad: defaults?.preferBatchLoad ?? true,
      reloadDirtyChunksAfterCommand: defaults?.reloadDirtyChunksAfterCommand ?? true,
      maxBatchChunks: defaults?.maxBatchChunks ?? DEFAULT_CHUNK_SERVICE_MAX_BATCH_CHUNKS,
      routeHints,
      timeouts: defaults?.timeouts ?? DEFAULT_CHUNK_SERVICE_TIMEOUTS,
    });

    return {
      ...baseConfig,
      enabled: true,
      mode: DEFAULT_CHUNK_SERVICE_MODE,
      sourceKind: DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
      connectionState: identity.ready ? "ready" : identity.valid ? "unknown" : "failed",
      apiBaseUrl: identity.apiBaseUrl,
      browserBaseUrl: identity.browserBaseUrl,
      projectId: identity.chunkProjectId,
      chunkProjectId: identity.chunkProjectId,
      worldId: identity.chunkWorldId,
      chunkWorldId: identity.chunkWorldId,
      universeId: identity.chunkUniverseId,
      chunkUniverseId: identity.chunkUniverseId,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      chunkReady: identity.chunkReady,
      ready: identity.ready,
      chunkStatus: identity.chunkStatus,
      status: identity.status,
      identityValid: identity.valid,
      identityDegraded: identity.degraded,
      valid: identity.valid,
      degraded: identity.degraded,
      identityWarnings: identity.identityWarnings,
      chunkIdentityWarnings: identity.identityWarnings,
      identityDiagnostics: identity.identityDiagnostics,
      contractIdentity: identity.identityDiagnostics,
      proxyDiagnostics: identity.proxyDiagnostics,
      preferBatchLoad: defaults?.preferBatchLoad ?? true,
      reloadDirtyChunksAfterCommand: defaults?.reloadDirtyChunksAfterCommand ?? true,
      maxBatchChunks: defaults?.maxBatchChunks ?? DEFAULT_CHUNK_SERVICE_MAX_BATCH_CHUNKS,
      routeHints,
      timeouts: defaults?.timeouts ?? DEFAULT_CHUNK_SERVICE_TIMEOUTS,
    };
  } catch {
    return buildDefaultChunkServiceConfig({
      apiBaseUrl: identity.apiBaseUrl,
      browserBaseUrl: identity.browserBaseUrl,
      projectId: identity.chunkProjectId,
      chunkProjectId: identity.chunkProjectId,
      worldId: identity.chunkWorldId,
      chunkWorldId: identity.chunkWorldId,
      universeId: identity.chunkUniverseId,
      chunkUniverseId: identity.chunkUniverseId,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      chunkReady: identity.chunkReady,
      ready: identity.ready,
      chunkStatus: identity.chunkStatus,
      status: identity.status,
      identityValid: identity.valid,
      identityDegraded: identity.degraded,
      identityWarnings: identity.identityWarnings,
      identityDiagnostics: identity.identityDiagnostics,
      contractIdentity: identity.identityDiagnostics,
      proxyDiagnostics: identity.proxyDiagnostics,
      routeHints,
      timeouts: DEFAULT_CHUNK_SERVICE_TIMEOUTS,
    });
  }
}

export function createDefaultPhysicsBootstrap(
  input?: Partial<EditorPhysicsBootstrap>,
): EditorPhysicsBootstrap {
  try {
    return buildDefaultPhysicsBootstrap(input);
  } catch {
    return buildDefaultPhysicsBootstrap({
      enabled: DEFAULT_PHYSICS_ENABLED,
    });
  }
}

export function createDefaultRuntimeInventoryConfig(
  input?: Partial<EditorRuntimeInventoryConfig>,
): EditorRuntimeInventoryConfig {
  return sanitizeRuntimeInventoryConfig(input);
}

export function createDefaultRuntimeLibraryConfig(
  input?: Partial<EditorRuntimeLibraryConfig>,
): EditorRuntimeLibraryConfig {
  return sanitizeRuntimeLibraryConfig(input);
}

export function createDefaultRuntimeConfig(
  defaults?: ChunkDefaultInput,
  physicsInput?: Partial<EditorPhysicsBootstrap>,
  inventoryInput?: Partial<EditorRuntimeInventoryConfig>,
  libraryInput?: Partial<EditorRuntimeLibraryConfig>,
): EditorRuntimeConfig {
  const physics = createDefaultPhysicsBootstrap(physicsInput);

  return {
    mode: DEFAULT_EDITOR_RUNTIME_MODE,
    worldMode: DEFAULT_EDITOR_WORLD_MODE,
    sourceMode: DEFAULT_EDITOR_WORLD_SOURCE_MODE,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,
    chunk: createDefaultChunkServiceConfig(defaults),
    physics,
    inventory: createDefaultRuntimeInventoryConfig(inventoryInput),
    library: createDefaultRuntimeLibraryConfig(libraryInput),
  };
}

export function createDefaultFeatureFlags(
  defaults?: Partial<EditorBootstrapDefaults>,
  physicsInput?: Partial<EditorPhysicsBootstrap>,
  overrides?: Partial<EditorFeatureFlags>,
): EditorFeatureFlags {
  const resolved = normalizeDefaults(defaults);
  const buildMode = safeString(resolved.buildMode, "development");
  const debugOverlayEnabled = buildMode !== "production";
  const physics = createDefaultPhysicsBootstrap(physicsInput);

  return {
    chunkServiceEnabled: true,
    localWorldFallbackEnabled: false,
    legacyFrontendEnabled: false,

    chunkServiceInventoryEnabled: false,
    chunkPaletteInventoryFallbackEnabled: false,
    placeableBlocksPlaceholderRouteEnabled: false,
    legacyChunkInventoryEnabled: false,

    editorInventoryApiEnabled: overrides?.editorInventoryApiEnabled ?? true,
    libraryInventoryEnabled: overrides?.libraryInventoryEnabled ?? true,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,

    remoteCommandsEnabled: overrides?.remoteCommandsEnabled ?? true,
    dirtyChunkReloadEnabled: overrides?.dirtyChunkReloadEnabled ?? true,

    pointerLockEnabled: overrides?.pointerLockEnabled ?? DEFAULT_POINTER_LOCK_ENABLED,
    firstPersonEnabled: overrides?.firstPersonEnabled ?? DEFAULT_FIRST_PERSON_ENABLED,
    physicsEnabled: overrides?.physicsEnabled ?? safeBoolean(physics.enabled, DEFAULT_PHYSICS_ENABLED),
    playerCollisionEnabled: overrides?.playerCollisionEnabled ?? safeBoolean(physics.enabled, DEFAULT_PLAYER_COLLISION_ENABLED),
    flightModeEnabled: overrides?.flightModeEnabled ?? safeBoolean(physics.enabled, DEFAULT_FLIGHT_MODE_ENABLED),
    crosshairEnabled: overrides?.crosshairEnabled ?? DEFAULT_CROSSHAIR_ENABLED,
    hotbarEnabled: overrides?.hotbarEnabled ?? DEFAULT_HOTBAR_ENABLED,
    statusBarEnabled: overrides?.statusBarEnabled ?? DEFAULT_STATUS_BAR_ENABLED,
    loadingOverlayEnabled: overrides?.loadingOverlayEnabled ?? DEFAULT_LOADING_OVERLAY_ENABLED,
    errorPanelEnabled: overrides?.errorPanelEnabled ?? DEFAULT_ERROR_PANEL_ENABLED,
    debugOverlayEnabled: overrides?.debugOverlayEnabled ?? (debugOverlayEnabled && safeBoolean(physics.debug.enabled, DEFAULT_DEBUG_OVERLAY_ENABLED)),

    creativeLibraryEnabled: overrides?.creativeLibraryEnabled ?? DEFAULT_CREATIVE_LIBRARY_ENABLED,
  };
}

export function createDefaultUiBootstrap(
  defaults?: Partial<EditorBootstrapDefaults>,
  physicsInput?: Partial<EditorPhysicsBootstrap>,
  overrides?: Partial<EditorUiBootstrap>,
): EditorUiBootstrap {
  const resolved = normalizeDefaults(defaults);
  const buildMode = safeString(resolved.buildMode, "development");
  const physics = createDefaultPhysicsBootstrap(physicsInput);

  return {
    language: overrides?.language === "en" ? "en" : "de",
    title: safeString(overrides?.title, "VECTOPLAN Editor"),
    subtitle: safeString(overrides?.subtitle, "Remote Chunk Runtime · Library Inventory"),
    showLeftPanel: safeBoolean(overrides?.showLeftPanel, false),
    showRightPanel: safeBoolean(overrides?.showRightPanel, false),
    showDebugOverlay: safeBoolean(
      overrides?.showDebugOverlay,
      buildMode !== "production" && safeBoolean(physics.debug.enabled, DEFAULT_DEBUG_OVERLAY_ENABLED),
    ),
    showHotbar: safeBoolean(overrides?.showHotbar, DEFAULT_HOTBAR_ENABLED),
    showCrosshair: safeBoolean(overrides?.showCrosshair, DEFAULT_CROSSHAIR_ENABLED),
    showStatusBar: safeBoolean(overrides?.showStatusBar, DEFAULT_STATUS_BAR_ENABLED),
    showLoadingOverlay: safeBoolean(overrides?.showLoadingOverlay, DEFAULT_LOADING_OVERLAY_ENABLED),
  };
}

export function createDefaultInputBootstrap(
  input?: Partial<EditorInputBootstrap>,
): EditorInputBootstrap {
  return {
    pointerLockEnabled: safeBoolean(input?.pointerLockEnabled, DEFAULT_POINTER_LOCK_ENABLED),
    keyboardEnabled: safeBoolean(input?.keyboardEnabled, true),
    mouseEnabled: safeBoolean(input?.mouseEnabled, true),
    wheelEnabled: safeBoolean(input?.wheelEnabled, true),
    invertY: safeBoolean(input?.invertY, false),
    sensitivity: safeNumber(input?.sensitivity, DEFAULT_INPUT_SENSITIVITY, 0.00001, 0.1),
  };
}

export function createDefaultCameraBootstrap(
  input?: Partial<EditorCameraBootstrap>,
  physicsInput?: Partial<EditorPhysicsBootstrap>,
): EditorCameraBootstrap {
  const physics = createDefaultPhysicsBootstrap(physicsInput);
  const physicsFollowEnabled = safeBoolean(input?.physicsFollowEnabled, physics.enabled);

  return {
    mode: "first-person",
    fov: safeNumber(input?.fov, DEFAULT_CAMERA_FOV, 10, 140),
    near: safeNumber(input?.near, DEFAULT_CAMERA_NEAR, 0.001, 10),
    far: safeNumber(input?.far, DEFAULT_CAMERA_FAR, 10, 1_000_000),
    spawn: {
      x: safeNumber(input?.spawn?.x, DEFAULT_CAMERA_SPAWN.x, -1_000_000, 1_000_000),
      y: safeNumber(input?.spawn?.y, DEFAULT_CAMERA_SPAWN.y, -1_000_000, 1_000_000),
      z: safeNumber(input?.spawn?.z, DEFAULT_CAMERA_SPAWN.z, -1_000_000, 1_000_000),
    },
    rotation: {
      pitch: safeNumber(input?.rotation?.pitch, DEFAULT_CAMERA_ROTATION.pitch, -Math.PI / 2, Math.PI / 2),
      yaw: safeNumber(input?.rotation?.yaw, DEFAULT_CAMERA_ROTATION.yaw, -Math.PI * 4, Math.PI * 4),
      roll: safeNumber(input?.rotation?.roll, DEFAULT_CAMERA_ROTATION.roll, -Math.PI * 2, Math.PI * 2),
    },
    moveSpeed: safeNumber(input?.moveSpeed, DEFAULT_CAMERA_MOVE_SPEED, 0.01, 1_000),
    sprintMultiplier: safeNumber(input?.sprintMultiplier, DEFAULT_CAMERA_SPRINT_MULTIPLIER, 1, 100),
    directMovementEnabled: safeBoolean(input?.directMovementEnabled, !physicsFollowEnabled),
    physicsFollowEnabled,
  };
}

export function createDefaultRenderBootstrap(
  input?: Partial<EditorRenderBootstrap>,
): EditorRenderBootstrap {
  return {
    antialias: safeBoolean(input?.antialias, true),
    alpha: safeBoolean(input?.alpha, false),
    pixelRatioMax: safeNumber(input?.pixelRatioMax, 2, 0.25, 4),
    clearColor: safeString(input?.clearColor, DEFAULT_RENDER_CLEAR_COLOR),
    chunkWireframe: safeBoolean(input?.chunkWireframe, false),
    showPreview: safeBoolean(input?.showPreview, true),
    showTargetHighlight: safeBoolean(input?.showTargetHighlight, true),
    visibleChunkRadius: safeInteger(input?.visibleChunkRadius, DEFAULT_VISIBLE_CHUNK_RADIUS, 0, 16),
    maxChunksPerRenderSync: safeInteger(
      input?.maxChunksPerRenderSync,
      DEFAULT_MAX_CHUNKS_PER_RENDER_SYNC,
      1,
      2048,
    ),
  };
}

export function createDefaultInventoryBootstrap(
  input?: Partial<EditorInventoryBootstrap>,
): EditorInventoryBootstrap {
  const fallbackBlockTypeIds = normalizeFallbackBlockTypeIds(input?.fallbackBlockTypeIds);
  const hotbarSize = safeInteger(
    input?.hotbarSize ?? input?.slotCount,
    DEFAULT_INVENTORY_SLOT_COUNT,
    1,
    64,
  );
  const selectedSlot = safeInteger(
    input?.selectedSlot ?? input?.defaultSelectedSlot,
    0,
    0,
    Math.max(0, hotbarSize - 1),
  );
  const apiUrl = normalizeRouteForModel(
    input?.apiUrl ?? input?.inventoryUrl ?? input?.route,
    DEFAULT_EDITOR_INVENTORY_API_URL,
  );

  const base = buildDefaultInventoryBootstrap({
    ...input,
    enabled: input?.enabled ?? true,
    source: DEFAULT_INVENTORY_SOURCE_KIND,
    kind: DEFAULT_INVENTORY_ITEM_KIND,
    apiUrl,
    inventoryUrl: input?.inventoryUrl ?? apiUrl,
    route: input?.route ?? apiUrl,
    healthUrl: input?.healthUrl ?? DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
    metadataUrl: input?.metadataUrl ?? DEFAULT_EDITOR_INVENTORY_METADATA_URL,
    defaultBlockTypeId: null,
    defaultRuntimeBlockTypeId: null,
    fallbackBlockTypeIds,
    slotCount: hotbarSize,
    hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    includeEmptySlots: input?.includeEmptySlots ?? true,
    forceRefreshOnBoot: input?.forceRefreshOnBoot ?? false,
    allowEmptyFallback: input?.allowEmptyFallback ?? true,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    requestTimeoutMs: input?.requestTimeoutMs ?? DEFAULT_INVENTORY_REQUEST_TIMEOUT_MS,
    cacheTtlMs: input?.cacheTtlMs ?? DEFAULT_INVENTORY_CACHE_TTL_MS,
    staleCacheTtlMs: input?.staleCacheTtlMs ?? DEFAULT_INVENTORY_STALE_CACHE_TTL_MS,
    inventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
    creativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    legacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
  });

  return {
    ...base,
    source: DEFAULT_INVENTORY_SOURCE_KIND,
    kind: DEFAULT_INVENTORY_ITEM_KIND,
    apiUrl,
    inventoryUrl: apiUrl,
    route: apiUrl,
    defaultBlockTypeId: safeNullableString(DEFAULT_PRIMARY_BLOCK_TYPE_ID),
    defaultRuntimeBlockTypeId: safeNullableString(DEFAULT_PRIMARY_BLOCK_TYPE_ID),
    fallbackBlockTypeIds,
    slotCount: hotbarSize,
    hotbarSize,
    selectedSlot,
    defaultSelectedSlot: selectedSlot,
    onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
    debugGrassDirtAllowed: DEFAULT_DEBUG_GRASS_DIRT_ALLOWED,
    allowChunkPlaceableFallback: DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK,
    inventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
    creativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    legacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
  };
}

export function createDefaultCreativeLibraryBootstrap(
  input?: Partial<EditorCreativeLibraryBootstrap>,
): EditorCreativeLibraryBootstrap {
  const route = normalizeRouteForModel(input?.route ?? input?.apiUrl, DEFAULT_CREATIVE_LIBRARY_API_URL);
  const base = buildDefaultCreativeLibraryBootstrap({
    ...input,
    enabled: input?.enabled ?? DEFAULT_CREATIVE_LIBRARY_ENABLED,
    source: input?.source ?? "creative-library",
    routeKind: input?.routeKind === "blocks" ? "blocks" : DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    apiUrl: input?.apiUrl ?? route,
    route,
    healthUrl: input?.healthUrl ?? DEFAULT_CREATIVE_LIBRARY_HEALTH_URL,
    metadataUrl: input?.metadataUrl ?? DEFAULT_CREATIVE_LIBRARY_METADATA_URL,
    browserCallsLibraryDirectly: false,
  });

  return {
    ...base,
    source: base.source === "chunk-service" ? "creative-library" : base.source,
    routeKind: base.routeKind === "blocks" ? "blocks" : DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    apiUrl: route,
    route,
    browserCallsLibraryDirectly: false,
  };
}

export function createDefaultEditorBootstrap(
  defaults?: Partial<EditorBootstrapDefaults>,
  physicsInput?: Partial<EditorPhysicsBootstrap>,
): EditorBootstrap {
  const resolvedDefaults = normalizeDefaults(defaults);
  const identity = resolveDefaultChunkIdentity(resolvedDefaults as ChunkDefaultInput);
  const app = createDefaultAppBootstrap(resolvedDefaults);
  const project = createDefaultProjectBootstrap(resolvedDefaults);
  const physics = createDefaultPhysicsBootstrap(physicsInput);
  const inventory = createDefaultInventoryBootstrap();
  const creativeLibrary = createDefaultCreativeLibraryBootstrap();
  const runtime = createDefaultRuntimeConfig(
    {
      ...resolvedDefaults,
      projectId: identity.chunkProjectId,
      chunkProjectId: identity.chunkProjectId,
      worldId: identity.chunkWorldId,
      chunkWorldId: identity.chunkWorldId,
      universeId: identity.chunkUniverseId,
      chunkUniverseId: identity.chunkUniverseId,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      apiBaseUrl: identity.apiBaseUrl,
      browserBaseUrl: identity.browserBaseUrl,
    },
    physics,
    {
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
    },
    {
      creativeLibraryRoute: creativeLibrary.route,
      healthRoute: creativeLibrary.healthUrl,
      metadataRoute: creativeLibrary.metadataUrl,
      inventoryRoute: inventory.route,
    },
  );

  return {
    schemaVersion: EDITOR_BOOTSTRAP_SCHEMA_VERSION,
    app,
    project,
    runtime,
    featureFlags: createDefaultFeatureFlags(resolvedDefaults, physics, {
      editorInventoryApiEnabled: inventory.enabled,
      libraryInventoryEnabled: inventory.enabled,
      creativeLibraryEnabled: creativeLibrary.enabled,
    }),
    ui: createDefaultUiBootstrap(resolvedDefaults, physics),
    input: createDefaultInputBootstrap(),
    camera: createDefaultCameraBootstrap(
      {
        physicsFollowEnabled: physics.enabled,
        directMovementEnabled: !physics.enabled,
      },
      physics,
    ),
    render: createDefaultRenderBootstrap(),
    inventory,
    creativeLibrary,
    physics,

    diagnostics: {
      source: "fallback",
      warnings: identity.identityWarnings,
      normalizedAt: nowIsoStringSafe(),
      rawAvailable: false,
    },

    raw: null,
  };
}

export function createSafeFallbackEditorBootstrap(
  reason: string,
  defaults?: Partial<EditorBootstrapDefaults>,
): EditorBootstrap {
  const bootstrap = createDefaultEditorBootstrap(defaults);
  const warning = safeString(reason, "Fallback bootstrap was created.");

  return {
    ...bootstrap,
    diagnostics: {
      ...bootstrap.diagnostics,
      source: "fallback",
      warnings: [
        ...bootstrap.diagnostics.warnings,
        warning,
      ],
      normalizedAt: nowIsoStringSafe(),
      rawAvailable: false,
    },
  };
}

export function createEditorBootstrapWithOverrides(
  defaults?: Partial<EditorBootstrapDefaults>,
  overrides?: Partial<EditorBootstrap>,
): EditorBootstrap {
  const base = createDefaultEditorBootstrap(defaults);

  if (!overrides) {
    return base;
  }

  try {
    const overrideChunk = overrides.runtime?.chunk as Partial<EditorChunkServiceConfig> | undefined;
    const physics = mergePhysicsBootstrap(
      base.physics,
      overrides.physics ?? overrides.runtime?.physics ?? null,
    );

    const inventory = createDefaultInventoryBootstrap({
      ...base.inventory,
      ...(overrides.inventory ?? {}),
      source: DEFAULT_INVENTORY_SOURCE_KIND,
      kind: DEFAULT_INVENTORY_ITEM_KIND,
      defaultBlockTypeId: null,
      defaultRuntimeBlockTypeId: null,
      fallbackBlockTypeIds: normalizeFallbackBlockTypeIds(overrides.inventory?.fallbackBlockTypeIds),
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      allowChunkPlaceableFallback: false,
    });

    const creativeLibrary = createDefaultCreativeLibraryBootstrap({
      ...base.creativeLibrary,
      ...(overrides.creativeLibrary ?? {}),
      browserCallsLibraryDirectly: false,
    });

    const chunk = createDefaultChunkServiceConfig({
      ...base.runtime.chunk,
      ...(overrideChunk ?? {}),
      projectId: firstNonEmpty(
        overrideChunk?.chunkProjectId,
        overrideChunk?.projectId,
        base.runtime.chunk.chunkProjectId,
        base.runtime.chunk.projectId,
      ) as string,
      chunkProjectId: firstNonEmpty(
        overrideChunk?.chunkProjectId,
        overrideChunk?.projectId,
        base.runtime.chunk.chunkProjectId,
        base.runtime.chunk.projectId,
      ) as string,
      worldId: firstNonEmpty(
        overrideChunk?.chunkWorldId,
        overrideChunk?.worldId,
        base.runtime.chunk.chunkWorldId,
        base.runtime.chunk.worldId,
      ) as string,
      chunkWorldId: firstNonEmpty(
        overrideChunk?.chunkWorldId,
        overrideChunk?.worldId,
        base.runtime.chunk.chunkWorldId,
        base.runtime.chunk.worldId,
      ) as string,
      appProjectPublicId: firstNonEmpty(
        overrideChunk?.appProjectPublicId,
        overrideChunk?.projectPublicId,
        base.runtime.chunk.appProjectPublicId,
        base.runtime.chunk.projectPublicId,
      ) as string | null,
      projectPublicId: firstNonEmpty(
        overrideChunk?.projectPublicId,
        overrideChunk?.appProjectPublicId,
        base.runtime.chunk.projectPublicId,
        base.runtime.chunk.appProjectPublicId,
      ) as string | null,
    });

    const runtimeInventory = createDefaultRuntimeInventoryConfig({
      ...base.runtime.inventory,
      ...(overrides.runtime?.inventory ?? {}),
      apiUrl: overrides.runtime?.inventory?.apiUrl ?? inventory.apiUrl,
      inventoryUrl: overrides.runtime?.inventory?.inventoryUrl ?? inventory.inventoryUrl,
      route: overrides.runtime?.inventory?.route ?? inventory.route,
      healthUrl: overrides.runtime?.inventory?.healthUrl ?? inventory.healthUrl,
      metadataUrl: overrides.runtime?.inventory?.metadataUrl ?? inventory.metadataUrl,
      hotbarSize: overrides.runtime?.inventory?.hotbarSize ?? inventory.hotbarSize,
      slotCount: overrides.runtime?.inventory?.slotCount ?? inventory.slotCount,
      selectedSlot: overrides.runtime?.inventory?.selectedSlot ?? inventory.selectedSlot,
      defaultSelectedSlot: overrides.runtime?.inventory?.defaultSelectedSlot ?? inventory.defaultSelectedSlot,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      allowChunkPlaceableFallback: false,
    });

    const runtimeLibrary = createDefaultRuntimeLibraryConfig({
      ...base.runtime.library,
      ...(overrides.runtime?.library ?? {}),
      inventoryRoute: overrides.runtime?.library?.inventoryRoute ?? inventory.route,
      creativeLibraryRoute: overrides.runtime?.library?.creativeLibraryRoute ?? creativeLibrary.route,
      healthRoute: overrides.runtime?.library?.healthRoute ?? creativeLibrary.healthUrl,
      metadataRoute: overrides.runtime?.library?.metadataRoute ?? creativeLibrary.metadataUrl,
      browserCallsLibraryDirectly: false,
    });

    const project: EditorProjectBootstrap = {
      ...base.project,
      ...(overrides.project ?? {}),
      projectId: chunk.chunkProjectId ?? chunk.projectId,
      runtimeProjectId: chunk.chunkProjectId ?? chunk.projectId,
      chunkProjectId: chunk.chunkProjectId ?? chunk.projectId,
      appProjectPublicId: chunk.appProjectPublicId ?? chunk.projectPublicId ?? null,
      projectPublicId: chunk.projectPublicId ?? chunk.appProjectPublicId ?? null,
      worldId: chunk.chunkWorldId ?? chunk.worldId,
      chunkWorldId: chunk.chunkWorldId ?? chunk.worldId,
      universeId: chunk.chunkUniverseId ?? chunk.universeId ?? base.project.universeId,
      chunkUniverseId: chunk.chunkUniverseId ?? chunk.universeId ?? base.project.universeId,
      templateId: overrides.project?.templateId ?? base.project.templateId,
      providerId: overrides.project?.providerId ?? base.project.providerId,
      providerWorldId: overrides.project?.providerWorldId ?? chunk.worldId,
    };

    return {
      ...base,
      ...overrides,
      app: {
        ...base.app,
        ...(overrides.app ?? {}),
        name: "vectoplan-editor",
        frontendRoot: DEFAULT_EDITOR_FRONTEND_ROOT,
      },
      project,
      runtime: {
        ...base.runtime,
        ...(overrides.runtime ?? {}),
        mode: DEFAULT_EDITOR_RUNTIME_MODE,
        worldMode: DEFAULT_EDITOR_WORLD_MODE,
        sourceMode: DEFAULT_EDITOR_WORLD_SOURCE_MODE,
        localWorldFallbackEnabled: false,
        legacyFrontendEnabled: false,
        chunk,
        physics,
        inventory: runtimeInventory,
        library: runtimeLibrary,
      },
      featureFlags: {
        ...base.featureFlags,
        ...(overrides.featureFlags ?? {}),
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

        pointerLockEnabled: overrides.featureFlags?.pointerLockEnabled ?? base.featureFlags.pointerLockEnabled,
        firstPersonEnabled: overrides.featureFlags?.firstPersonEnabled ?? base.featureFlags.firstPersonEnabled,
        physicsEnabled: overrides.featureFlags?.physicsEnabled ?? physics.enabled,
        playerCollisionEnabled: overrides.featureFlags?.playerCollisionEnabled ?? physics.enabled,
        flightModeEnabled: overrides.featureFlags?.flightModeEnabled ?? physics.enabled,
        crosshairEnabled: overrides.featureFlags?.crosshairEnabled ?? base.featureFlags.crosshairEnabled,
        hotbarEnabled: overrides.featureFlags?.hotbarEnabled ?? base.featureFlags.hotbarEnabled,
        statusBarEnabled: overrides.featureFlags?.statusBarEnabled ?? base.featureFlags.statusBarEnabled,
        loadingOverlayEnabled: overrides.featureFlags?.loadingOverlayEnabled ?? base.featureFlags.loadingOverlayEnabled,
        errorPanelEnabled: overrides.featureFlags?.errorPanelEnabled ?? base.featureFlags.errorPanelEnabled,
        debugOverlayEnabled: overrides.featureFlags?.debugOverlayEnabled ?? physics.debug.enabled,
        creativeLibraryEnabled: overrides.featureFlags?.creativeLibraryEnabled ?? creativeLibrary.enabled,
      },
      ui: {
        ...base.ui,
        ...(overrides.ui ?? {}),
        subtitle: safeString(overrides.ui?.subtitle, base.ui.subtitle),
        showDebugOverlay: overrides.ui?.showDebugOverlay ?? physics.debug.enabled,
      },
      input: {
        ...base.input,
        ...(overrides.input ?? {}),
      },
      camera: {
        ...base.camera,
        ...(overrides.camera ?? {}),
        spawn: {
          ...base.camera.spawn,
          ...(overrides.camera?.spawn ?? {}),
        },
        rotation: {
          ...base.camera.rotation,
          ...(overrides.camera?.rotation ?? {}),
        },
        directMovementEnabled: overrides.camera?.directMovementEnabled ?? !physics.enabled,
        physicsFollowEnabled: overrides.camera?.physicsFollowEnabled ?? physics.enabled,
      },
      render: {
        ...base.render,
        ...(overrides.render ?? {}),
      },
      inventory,
      creativeLibrary,
      physics,
      diagnostics: {
        ...base.diagnostics,
        ...(overrides.diagnostics ?? {}),
        warnings: [
          ...base.diagnostics.warnings,
          ...(overrides.diagnostics?.warnings ?? []),
          ...(chunk.identityWarnings ?? []),
        ],
        normalizedAt: nowIsoStringSafe(),
      },
      raw: overrides.raw ?? base.raw,
    };
  } catch {
    return base;
  }
}

export function getDefaultBootstrapMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.bootstrap.default_bootstrap",
    defaultInventoryApiUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
    defaultCreativeLibraryApiUrl: DEFAULT_CREATIVE_LIBRARY_API_URL,
    defaultInventorySource: DEFAULT_INVENTORY_SOURCE_KIND,
    defaultInventoryKind: DEFAULT_INVENTORY_ITEM_KIND,
    defaultInventoryRouteKind: DEFAULT_INVENTORY_ROUTE_KIND,
    defaultCreativeLibraryRouteKind: DEFAULT_CREATIVE_LIBRARY_ROUTE_KIND,
    defaultLegacyChunkInventoryRouteKind: DEFAULT_LEGACY_CHUNK_INVENTORY_ROUTE_KIND,
    defaultFallbackBlockTypeIds: [...DEFAULT_FALLBACK_BLOCK_TYPE_IDS],
    rules: {
      defaultInventoryIsLibraryVplib: true,
      debugGrassDirtDefaultsRemoved: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      chunkPlaceableBlocksAreDiagnosticOnly: true,
      onlyLibraryItemsPlaceable: DEFAULT_ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEFAULT_DEBUG_GRASS_DIRT_ALLOWED,
      allowChunkPlaceableFallback: DEFAULT_ALLOW_CHUNK_PLACEABLE_FALLBACK,

      runtimeProjectIdIsChunkProjectId: true,
      runtimeWorldIdIsChunkWorldId: true,
      appProjectIdNeverUsedAsChunkProjectId: true,
      appProjectPublicIdKeptAsContextOnly: true,
      defaultProjectIdCannotBecomeAppProjectIdRoute: true,
      editorChunkProxyUrlNormalizedThroughContract: true,
      appOriginEditorProxyRejected: true,
      directChunkServiceUrlRejectedByDefault: true,
    },
  };
}
