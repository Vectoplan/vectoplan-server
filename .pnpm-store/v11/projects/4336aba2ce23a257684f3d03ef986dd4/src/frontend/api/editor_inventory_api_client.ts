// services/vectoplan-editor/src/frontend/api/editor_inventory_api_client.ts
/**
 * HTTP-Client für die Editor-Inventory-API.
 *
 * Zweck:
 * - lädt das serverseitige Editor-Inventar über GET /editor/api/inventory
 * - normalisiert die Response in stabile Frontend-Strukturen
 * - verhindert, dass debug_grass/debug_dirt als fachliche Inventory-Wahrheit
 *   in die Runtime gelangen
 * - kapselt Fetch, Timeout, AbortController, Cache, Request-Deduplizierung
 *   und Browser-/Dataset-Konfiguration
 *
 * Architekturregel:
 * - Der Browser ruft NICHT direkt vectoplan-library auf.
 * - Der Browser ruft ausschließlich /editor/api/inventory auf.
 * - Nur Library-/VPLIB-Items dürfen placeable sein.
 * - /editor/api/chunk/placeable-blocks ist nur noch Debug-/Legacy-Fallback
 *   und wird von diesem Client nicht verwendet.
 *
 * Diese Datei enthält bewusst:
 * - keine DOM-Rendering-Logik
 * - keine Hotbar-View-Logik
 * - keine Three.js-/Scene-Logik
 * - keine direkte Chunk-Command-Logik
 * - keinen direkten Aufruf zu vectoplan-library
 */

import {
  DEFAULT_EDITOR_INVENTORY_API_URL,
  DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
  DEFAULT_EDITOR_INVENTORY_METADATA_URL,
  DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
  DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  asBoolean,
  asInteger,
  asRecord,
  asString,
  createEditorInventoryError,
  getEditorInventoryLoadError,
  getPlaceableInventorySlots,
  getSelectedInventorySlot,
  getSelectedInventoryItem,
  inventoryPayloadContainsForbiddenDebugBlockIds,
  isRecord,
  type EditorInventoryApiClientOptions,
  type EditorInventoryLoadFailure,
  type EditorInventoryLoadResult,
  type EditorInventoryLoadSuccess,
  type EditorInventoryPayload,
  type EditorInventoryState,
  type UnknownRecord,
} from "./editor_inventory_models";

import {
  buildEmptyInventoryPayload,
  normalizeEditorInventoryLoadFailure,
  normalizeEditorInventoryPayload,
} from "./editor_inventory_normalize";

export const EDITOR_INVENTORY_API_CLIENT_MODULE_NAME = "frontend.api.editor_inventory_api_client";
export const EDITOR_INVENTORY_API_CLIENT_MODULE_VERSION = "0.1.1";

export const DEFAULT_EDITOR_INVENTORY_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_EDITOR_INVENTORY_CACHE_TTL_MS = 5_000;
export const DEFAULT_EDITOR_INVENTORY_STALE_CACHE_TTL_MS = 60_000;
export const DEFAULT_EDITOR_INVENTORY_MAX_RETRIES = 1;

export type EditorInventoryHttpMethod = "GET";

export type EditorInventoryCachePolicy =
  | "default"
  | "no-cache"
  | "reload"
  | "force-cache"
  | "only-if-cached";

export interface EditorInventoryApiClientConfig {
  apiUrl: string;
  metadataUrl: string;
  healthUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  staleCacheTtlMs: number;
  maxRetries: number;
  includeEmptySlots: boolean;
  forceRefresh: boolean;
  hotbarSize: number;
  selectedSlot: number;
  onlyLibraryItemsPlaceable: boolean;
  debugGrassDirtAllowed: boolean;
  allowChunkPlaceableFallback: boolean;
  credentials?: RequestCredentials;
  cachePolicy?: EditorInventoryCachePolicy;
  headers?: Record<string, string>;
}

export interface EditorInventoryApiRequest {
  url: string;
  method: EditorInventoryHttpMethod;
  timeoutMs: number;
  headers: Record<string, string>;
  forceRefresh: boolean;
  includeEmptySlots: boolean;
  requestId: string;
  signal?: AbortSignal;
}

export interface EditorInventoryHttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  payload: unknown;
  elapsedMs: number;
  requestId: string;
}

export interface EditorInventoryCacheEntry {
  key: string;
  payload: EditorInventoryPayload;
  result: EditorInventoryLoadResult;
  createdAt: number;
  expiresAt: number;
  staleUntil: number;
}

export interface EditorInventoryClientDiagnostics {
  moduleName: string;
  moduleVersion: string;
  config: EditorInventoryApiClientConfig;
  cache: {
    total: number;
    fresh: number;
    stale: number;
    expired: number;
    cacheTtlMs: number;
    staleCacheTtlMs: number;
  };
  inFlight: number;
  rules: {
    browserUsesEditorInventoryApi: boolean;
    browserDoesNotCallVectoplanLibraryDirectly: boolean;
    onlyLibraryItemsPlaceable: boolean;
    debugGrassDirtAllowed: boolean;
    forbiddenDebugBlockTypeIds: readonly string[];
  };
}

type SafeConsole = {
  readonly warn?: (message?: unknown, ...optionalParams: unknown[]) => void;
  readonly error?: (message?: unknown, ...optionalParams: unknown[]) => void;
};

function now(): number {
  try {
    return Date.now();
  } catch {
    return new Date().getTime();
  }
}

function monotonicNow(): number {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
  } catch {
    // Ignore.
  }

  return now();
}

function createRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Ignore.
  }

  return `inventory-${now()}-${Math.random().toString(16).slice(2)}`;
}

function getWindow(): Window | null {
  try {
    return typeof window !== "undefined" ? window : null;
  } catch {
    return null;
  }
}

function getDocument(): Document | null {
  try {
    return typeof document !== "undefined" ? document : null;
  } catch {
    return null;
  }
}

function getSafeConsole(): SafeConsole | null {
  try {
    const candidate = (globalThis as unknown as { readonly console?: SafeConsole }).console;
    return candidate && typeof candidate === "object" ? candidate : null;
  } catch {
    return null;
  }
}

function getRootElement(): HTMLElement | null {
  const doc = getDocument();

  if (!doc) {
    return null;
  }

  try {
    return (
      doc.getElementById("vectoplan-editor-root") ||
      doc.querySelector<HTMLElement>("[data-vectoplan-editor-root]") ||
      doc.querySelector<HTMLElement>("[data-editor-root]") ||
      doc.querySelector<HTMLElement>("[data-editor-app]") ||
      doc.getElementById("editor-app")
    );
  } catch {
    return null;
  }
}

function readDatasetValue(root: HTMLElement | null, names: string[], fallback = ""): string {
  if (!root) {
    return fallback;
  }

  for (const name of names) {
    try {
      const value = root.getAttribute(name);
      const normalized = asString(value, "");

      if (normalized) {
        return normalized;
      }
    } catch {
      // Ignore.
    }
  }

  return fallback;
}

function readWindowValue<T = unknown>(key: string): T | undefined {
  const win = getWindow();

  if (!win) {
    return undefined;
  }

  try {
    return (win as unknown as Record<string, T | undefined>)[key];
  } catch {
    return undefined;
  }
}

function safeConsoleWarn(message: string, ...args: unknown[]): void {
  try {
    const consoleObject = getSafeConsole();
    consoleObject?.warn?.(message, ...args);
  } catch {
    // Ignore.
  }
}

function safeConsoleError(message: string, ...args: unknown[]): void {
  try {
    const consoleObject = getSafeConsole();
    consoleObject?.error?.(message, ...args);
  } catch {
    // Ignore.
  }
}

function normalizeRouteUrl(value: unknown, fallback: string): string {
  const raw = asString(value, fallback);

  if (!raw) {
    return fallback;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (!raw.startsWith("/")) {
    return `/${raw}`;
  }

  return raw;
}

function appendQueryParams(
  url: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);

  if (!entries.length) {
    return url;
  }

  let parsedUrl: URL | null = null;

  try {
    parsedUrl = new URL(url, getWindow()?.location?.origin ?? "http://localhost");
  } catch {
    parsedUrl = null;
  }

  if (parsedUrl) {
    for (const [key, value] of entries) {
      parsedUrl.searchParams.set(key, String(value));
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      return parsedUrl.toString();
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  }

  const separator = url.indexOf("?") >= 0 ? "&" : "?";
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return `${url}${separator}${query}`;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { name?: unknown; code?: unknown };
  return record.name === "AbortError" || record.code === 20;
}

function buildError(value: unknown, fallbackMessage: string): Error {
  return createEditorInventoryError(value, fallbackMessage);
}

function clonePayload(payload: EditorInventoryPayload): EditorInventoryPayload {
  try {
    return JSON.parse(JSON.stringify(payload)) as EditorInventoryPayload;
  } catch {
    return payload;
  }
}

function getFetch(): typeof fetch | null {
  try {
    return typeof fetch === "function" ? fetch : null;
  } catch {
    return null;
  }
}

function normalizeResponseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  try {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } catch {
    // Ignore.
  }

  return result;
}

function buildDefaultHeaders(requestId: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-VECTOPLAN-Editor-Inventory-Client": EDITOR_INVENTORY_API_CLIENT_MODULE_NAME,
    "X-VECTOPLAN-Editor-Inventory-Client-Version": EDITOR_INVENTORY_API_CLIENT_MODULE_VERSION,
    "X-VECTOPLAN-Editor-Inventory-Truth": DEFAULT_EDITOR_INVENTORY_API_URL,
    "X-VECTOPLAN-Editor-Only-Library-Items-Placeable": "true",
    "X-VECTOPLAN-Editor-Debug-Grass-Dirt-Allowed": "false",
    "X-Request-ID": requestId,
    ...(extra ?? {}),
  };
}

function normalizeCachePolicy(value: unknown): EditorInventoryCachePolicy {
  const normalized = asString(value, "no-cache") as EditorInventoryCachePolicy;

  if (
    normalized === "default" ||
    normalized === "no-cache" ||
    normalized === "reload" ||
    normalized === "force-cache" ||
    normalized === "only-if-cached"
  ) {
    return normalized;
  }

  return "no-cache";
}

function readConfigFromBootstrap(): Partial<EditorInventoryApiClientConfig> {
  const bootstrap = readWindowValue<UnknownRecord>("__VECTOPLAN_EDITOR_BOOTSTRAP__");
  const runtime = asRecord(bootstrap?.runtime);
  const bootstrapInventory = asRecord(bootstrap?.inventory);
  const runtimeInventory = asRecord(runtime.inventory);
  const inventory = { ...runtimeInventory, ...bootstrapInventory };

  return {
    apiUrl: asString(
      inventory.apiUrl ??
        inventory.inventoryUrl ??
        inventory.route ??
        readWindowValue("__VECTOPLAN_EDITOR_INVENTORY_API_URL__") ??
        readWindowValue("__VECTOPLAN_EDITOR_INVENTORY_ROUTE__"),
      "",
    ),
    metadataUrl: asString(
      inventory.metadataUrl ??
        inventory.inventoryMetadataUrl ??
        readWindowValue("__VECTOPLAN_EDITOR_INVENTORY_METADATA_URL__"),
      "",
    ),
    healthUrl: asString(
      inventory.healthUrl ??
        inventory.inventoryHealthUrl ??
        readWindowValue("__VECTOPLAN_EDITOR_INVENTORY_HEALTH_URL__"),
      "",
    ),
    includeEmptySlots: asBoolean(inventory.includeEmptySlots, true),
    forceRefresh: asBoolean(inventory.forceRefreshOnBoot ?? inventory.forceRefresh, false),
    hotbarSize: asInteger(inventory.hotbarSize, DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE, 1, 64),
    selectedSlot: asInteger(inventory.selectedSlot ?? inventory.defaultSelectedSlot, DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT, 0, 63),
    onlyLibraryItemsPlaceable: asBoolean(inventory.onlyLibraryItemsPlaceable, true),
    debugGrassDirtAllowed: asBoolean(inventory.debugGrassDirtAllowed, false),
    allowChunkPlaceableFallback: asBoolean(inventory.allowChunkPlaceableFallback, false),
  };
}

function readConfigFromDataset(): Partial<EditorInventoryApiClientConfig> {
  const root = getRootElement();

  return {
    apiUrl: readDatasetValue(
      root,
      ["data-inventory-api-url", "data-inventory-url", "data-inventory-route", "data-library-inventory-route"],
      "",
    ),
    metadataUrl: readDatasetValue(
      root,
      ["data-inventory-metadata-url", "data-inventory-metadata-route"],
      "",
    ),
    healthUrl: readDatasetValue(
      root,
      ["data-inventory-health-url", "data-inventory-health-route"],
      "",
    ),
    includeEmptySlots: true,
    forceRefresh: asBoolean(readDatasetValue(root, ["data-inventory-force-refresh-on-boot", "data-inventory-force-refresh"], "false"), false),
    hotbarSize: asInteger(
      readDatasetValue(root, ["data-inventory-hotbar-size"], String(DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE)),
      DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
      1,
      64,
    ),
    selectedSlot: asInteger(
      readDatasetValue(root, ["data-inventory-selected-slot", "data-inventory-default-selected-slot"], String(DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT)),
      DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
      0,
      63,
    ),
    onlyLibraryItemsPlaceable: asBoolean(
      readDatasetValue(root, ["data-inventory-only-library-items-placeable"], "true"),
      true,
    ),
    debugGrassDirtAllowed: asBoolean(
      readDatasetValue(root, ["data-inventory-debug-grass-dirt-allowed"], "false"),
      false,
    ),
    allowChunkPlaceableFallback: asBoolean(
      readDatasetValue(root, ["data-inventory-allow-chunk-placeable-fallback"], "false"),
      false,
    ),
  };
}

export function buildEditorInventoryApiClientConfig(
  overrides?: Partial<EditorInventoryApiClientConfig>,
): EditorInventoryApiClientConfig {
  const bootstrapConfig = readConfigFromBootstrap();
  const datasetConfig = readConfigFromDataset();

  const merged: Partial<EditorInventoryApiClientConfig> = {
    ...bootstrapConfig,
    ...datasetConfig,
    ...(overrides ?? {}),
  };

  const hotbarSize = asInteger(
    merged.hotbarSize,
    DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
    1,
    64,
  );

  return {
    apiUrl: normalizeRouteUrl(merged.apiUrl, DEFAULT_EDITOR_INVENTORY_API_URL),
    metadataUrl: normalizeRouteUrl(merged.metadataUrl, DEFAULT_EDITOR_INVENTORY_METADATA_URL),
    healthUrl: normalizeRouteUrl(merged.healthUrl, DEFAULT_EDITOR_INVENTORY_HEALTH_URL),
    timeoutMs: asInteger(
      merged.timeoutMs,
      DEFAULT_EDITOR_INVENTORY_REQUEST_TIMEOUT_MS,
      100,
      300_000,
    ),
    cacheTtlMs: asInteger(
      merged.cacheTtlMs,
      DEFAULT_EDITOR_INVENTORY_CACHE_TTL_MS,
      0,
      3_600_000,
    ),
    staleCacheTtlMs: asInteger(
      merged.staleCacheTtlMs,
      DEFAULT_EDITOR_INVENTORY_STALE_CACHE_TTL_MS,
      0,
      86_400_000,
    ),
    maxRetries: asInteger(
      merged.maxRetries,
      DEFAULT_EDITOR_INVENTORY_MAX_RETRIES,
      0,
      5,
    ),
    includeEmptySlots: asBoolean(merged.includeEmptySlots, true),
    forceRefresh: asBoolean(merged.forceRefresh, false),
    hotbarSize,
    selectedSlot: asInteger(
      merged.selectedSlot,
      DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
      0,
      Math.max(0, hotbarSize - 1),
    ),
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    credentials: merged.credentials ?? "same-origin",
    cachePolicy: normalizeCachePolicy(merged.cachePolicy),
    headers: { ...(merged.headers ?? {}) },
  };
}

export class EditorInventoryApiClient {
  private readonly config: EditorInventoryApiClientConfig;
  private readonly cache = new Map<string, EditorInventoryCacheEntry>();
  private readonly inFlight = new Map<string, Promise<EditorInventoryLoadResult>>();

  public constructor(config?: Partial<EditorInventoryApiClientConfig>) {
    this.config = buildEditorInventoryApiClientConfig(config);
  }

  public getConfig(): EditorInventoryApiClientConfig {
    return { ...this.config, headers: { ...(this.config.headers ?? {}) } };
  }

  public clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  public getDiagnostics(): EditorInventoryClientDiagnostics {
    const current = now();
    let fresh = 0;
    let stale = 0;
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (current <= entry.expiresAt) {
        fresh += 1;
      } else if (current <= entry.staleUntil) {
        stale += 1;
      } else {
        expired += 1;
      }
    }

    return {
      moduleName: EDITOR_INVENTORY_API_CLIENT_MODULE_NAME,
      moduleVersion: EDITOR_INVENTORY_API_CLIENT_MODULE_VERSION,
      config: this.getConfig(),
      cache: {
        total: this.cache.size,
        fresh,
        stale,
        expired,
        cacheTtlMs: this.config.cacheTtlMs,
        staleCacheTtlMs: this.config.staleCacheTtlMs,
      },
      inFlight: this.inFlight.size,
      rules: {
        browserUsesEditorInventoryApi: true,
        browserDoesNotCallVectoplanLibraryDirectly: true,
        onlyLibraryItemsPlaceable: true,
        debugGrassDirtAllowed: false,
        forbiddenDebugBlockTypeIds: FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
      },
    };
  }

  public async loadInventory(options?: EditorInventoryApiClientOptions): Promise<EditorInventoryLoadResult> {
    const request = this.buildRequest(options);
    const cacheKey = this.getCacheKey(request);

    if (!request.forceRefresh) {
      const cached = this.getCachedResult(cacheKey, false);
      if (cached) {
        return cached;
      }

      const active = this.inFlight.get(cacheKey);
      if (active) {
        return active;
      }
    }

    const promise = this.loadInventoryUncached(request, cacheKey);
    this.inFlight.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  public async loadInventoryPayload(options?: EditorInventoryApiClientOptions): Promise<EditorInventoryPayload> {
    const result = await this.loadInventory(options);

    if (!result.ok) {
      throw getEditorInventoryLoadError(result) ?? new Error("Editor inventory payload could not be loaded.");
    }

    return result.payload;
  }

  public async loadInventoryState(options?: EditorInventoryApiClientOptions): Promise<EditorInventoryState> {
    const result = await this.loadInventory(options);

    if (!result.ok) {
      throw getEditorInventoryLoadError(result) ?? new Error("Editor inventory state could not be loaded.");
    }

    return result.state;
  }

  public async loadMetadata(options?: EditorInventoryApiClientOptions): Promise<UnknownRecord> {
    return this.loadJsonEndpoint(this.config.metadataUrl, options);
  }

  public async loadHealth(options?: EditorInventoryApiClientOptions): Promise<UnknownRecord> {
    return this.loadJsonEndpoint(this.config.healthUrl, options);
  }

  private buildRequest(options?: EditorInventoryApiClientOptions): EditorInventoryApiRequest {
    const requestId = asString(options?.requestId, createRequestId());
    const forceRefresh = asBoolean(options?.forceRefresh, this.config.forceRefresh);
    const includeEmptySlots = asBoolean(options?.includeEmptySlots, this.config.includeEmptySlots);

    const url = appendQueryParams(
      normalizeRouteUrl(options?.url, this.config.apiUrl),
      {
        forceRefresh: forceRefresh ? "true" : undefined,
        includeEmptySlots: includeEmptySlots ? "true" : undefined,
      },
    );

    const request: EditorInventoryApiRequest = {
      url,
      method: "GET",
      timeoutMs: asInteger(options?.timeoutMs, this.config.timeoutMs, 100, 300_000),
      forceRefresh,
      includeEmptySlots,
      requestId,
      headers: buildDefaultHeaders(requestId, {
        ...(this.config.headers ?? {}),
        ...(options?.headers ?? {}),
      }),
    };

    if (options?.signal) {
      return {
        ...request,
        signal: options.signal,
      };
    }

    return request;
  }

  private getCacheKey(request: EditorInventoryApiRequest): string {
    return `${request.method} ${request.url}`;
  }

  private getCachedResult(cacheKey: string, allowStale: boolean): EditorInventoryLoadResult | null {
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    const current = now();

    if (current <= entry.expiresAt) {
      return {
        ...entry.result,
        fetchedAt: entry.result.fetchedAt,
        fromCache: true,
      } as EditorInventoryLoadResult;
    }

    if (allowStale && current <= entry.staleUntil) {
      return {
        ...entry.result,
        fetchedAt: entry.result.fetchedAt,
        fromCache: true,
      } as EditorInventoryLoadResult;
    }

    this.cache.delete(cacheKey);
    return null;
  }

  private setCachedResult(cacheKey: string, payload: EditorInventoryPayload, result: EditorInventoryLoadResult): void {
    if (!result.ok || this.config.cacheTtlMs <= 0) {
      return;
    }

    const createdAt = now();

    this.cache.set(cacheKey, {
      key: cacheKey,
      payload: clonePayload(payload),
      result,
      createdAt,
      expiresAt: createdAt + this.config.cacheTtlMs,
      staleUntil: createdAt + this.config.cacheTtlMs + this.config.staleCacheTtlMs,
    });
  }

  private async loadInventoryUncached(
    request: EditorInventoryApiRequest,
    cacheKey: string,
  ): Promise<EditorInventoryLoadResult> {
    let lastError: Error | null = null;
    const attempts = Math.max(1, this.config.maxRetries + 1);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetchJson(request);
        const payload = this.normalizePayload(response.payload);

        if (inventoryPayloadContainsForbiddenDebugBlockIds(payload)) {
          throw new Error("Inventory-Payload enthält verbotene Debug-Block-IDs.");
        }

        const state = payload.inventory;
        const placeableSlots = getPlaceableInventorySlots(state);
        const selectedSlot = getSelectedInventorySlot(state);
        const selectedItem = getSelectedInventoryItem(state);

        const success: EditorInventoryLoadSuccess = {
          ok: true,
          state,
          payload,
          selectedSlot,
          selectedItem,
          placeableSlots,
          fetchedAt: now(),
          fromCache: false,
          error: null,
          reason: null,
        };

        this.setCachedResult(cacheKey, payload, success);
        this.exportWindowGlobals(success);

        return success;
      } catch (error) {
        lastError = buildError(error, "Inventory konnte nicht geladen werden.");

        if (isAbortError(error)) {
          break;
        }
      }
    }

    const stale = this.getCachedResult(cacheKey, true);
    if (stale) {
      safeConsoleWarn("VECTOPLAN Editor: Inventory konnte nicht frisch geladen werden; stale cache wird verwendet.", lastError);
      return stale;
    }

    const failure = this.buildFailure(lastError ?? new Error("Inventory konnte nicht geladen werden."));
    this.exportWindowGlobals(failure);
    return failure;
  }

  private normalizePayload(payload: unknown): EditorInventoryPayload {
    const normalized = normalizeEditorInventoryPayload(payload, {
      hotbarSize: this.config.hotbarSize,
      selectedSlot: this.config.selectedSlot,
      includeEmptySlots: this.config.includeEmptySlots,
      route: this.config.apiUrl,
      rejectForbiddenDebugItems: true,
      allowBreakAction: true,
      allowPlaceAction: true,
      allowEmptyFallback: true,
      source: "library",
    });

    if (!normalized.ok) {
      const reason = asString(
        normalized.fallback?.reason ??
          normalized.error?.message ??
          normalized.error?.reason,
        "Inventory-Payload ist nicht erfolgreich.",
      );
      throw new Error(reason);
    }

    if (!getPlaceableInventorySlots(normalized.inventory).length) {
      throw new Error("Inventory enthält keine placebaren Library-/VPLIB-Slots.");
    }

    if (inventoryPayloadContainsForbiddenDebugBlockIds(normalized)) {
      throw new Error("Inventory enthält verbotene Debug-Block-IDs.");
    }

    return normalized;
  }

  private buildFailure(error: Error): EditorInventoryLoadFailure {
    const emptyPayload = buildEmptyInventoryPayload({
      hotbarSize: this.config.hotbarSize,
      selectedSlot: this.config.selectedSlot,
      route: this.config.apiUrl,
      sourceDetail: error.message || "inventory-load-error",
    });

    return normalizeEditorInventoryLoadFailure(error, emptyPayload, {
      hotbarSize: this.config.hotbarSize,
      selectedSlot: this.config.selectedSlot,
      route: this.config.apiUrl,
    });
  }

  private async loadJsonEndpoint(url: string, options?: EditorInventoryApiClientOptions): Promise<UnknownRecord> {
    const requestId = asString(options?.requestId, createRequestId());

    const request: EditorInventoryApiRequest = {
      url: appendQueryParams(
        normalizeRouteUrl(options?.url ?? url, url),
        {
          forceRefresh: options?.forceRefresh ? "true" : undefined,
        },
      ),
      method: "GET",
      timeoutMs: asInteger(options?.timeoutMs, this.config.timeoutMs, 100, 300_000),
      forceRefresh: asBoolean(options?.forceRefresh, false),
      includeEmptySlots: true,
      requestId,
      headers: buildDefaultHeaders(requestId, {
        ...(this.config.headers ?? {}),
        ...(options?.headers ?? {}),
      }),
    };

    const requestWithSignal = options?.signal
      ? {
          ...request,
          signal: options.signal,
        }
      : request;

    const response = await this.fetchJson(requestWithSignal);
    return asRecord(response.payload);
  }

  private async fetchJson(request: EditorInventoryApiRequest): Promise<EditorInventoryHttpResponse> {
    const fetchFn = getFetch();

    if (!fetchFn) {
      throw new Error("Fetch API ist nicht verfügbar.");
    }

    const startedAt = monotonicNow();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // Ignore.
      }
    }, request.timeoutMs);

    const onAbort = (): void => {
      try {
        controller.abort();
      } catch {
        // Ignore.
      }
    };

    try {
      if (request.signal) {
        if (request.signal.aborted) {
          controller.abort();
        } else {
          request.signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      const response = await fetchFn(request.url, {
        method: request.method,
        headers: request.headers,
        signal: controller.signal,
        credentials: this.config.credentials,
        cache: request.forceRefresh ? "no-store" : this.config.cachePolicy,
      });

      const headers = normalizeResponseHeaders(response.headers);
      const contentType = asString(response.headers.get("content-type"), "");
      const text = await response.text();
      let payload: unknown = null;

      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(`Inventory-API lieferte kein gültiges JSON. Content-Type: ${contentType}`);
        }
      }

      const elapsedMs = monotonicNow() - startedAt;

      if (!response.ok) {
        const payloadRecord = asRecord(payload);
        const payloadErrorRecord = asRecord(payloadRecord.error);
        const message = isRecord(payload)
          ? asString(
              payloadErrorRecord.message ??
                payloadRecord.message ??
                payloadErrorRecord.detail ??
                payloadRecord.detail,
              `Inventory-API HTTP ${response.status}`,
            )
          : `Inventory-API HTTP ${response.status}`;

        throw new Error(message);
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url || request.url,
        headers,
        payload,
        elapsedMs,
        requestId: request.requestId,
      };
    } finally {
      clearTimeout(timeoutId);

      if (request.signal) {
        try {
          request.signal.removeEventListener("abort", onAbort);
        } catch {
          // Ignore.
        }
      }
    }
  }

  private exportWindowGlobals(result: EditorInventoryLoadResult): void {
    const win = getWindow();

    if (!win) {
      return;
    }

    try {
      win.__VECTOPLAN_EDITOR_INVENTORY_API_URL__ = this.config.apiUrl;
      win.__VECTOPLAN_EDITOR_INVENTORY_ROUTE__ = this.config.apiUrl;
      win.__VECTOPLAN_EDITOR_PRODUCTIVE_INVENTORY_ROUTE__ = DEFAULT_EDITOR_INVENTORY_API_URL;
      win.__VECTOPLAN_EDITOR_ONLY_LIBRARY_ITEMS_PLACEABLE__ = true;
      win.__VECTOPLAN_EDITOR_DEBUG_BLOCKS_ALLOWED_IN_INVENTORY__ = false;
      win.__VECTOPLAN_EDITOR_DEBUG_GRASS_DIRT_ALLOWED__ = false;
      win.__VECTOPLAN_EDITOR_LEGACY_CHUNK_INVENTORY_ENABLED__ = false;
      win.__VECTOPLAN_EDITOR_CHUNK_SERVICE_INVENTORY_ENABLED__ = false;
      win.__VECTOPLAN_EDITOR_CHUNK_PALETTE_INVENTORY_FALLBACK_ENABLED__ = false;
      win.__VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_PLACEHOLDER_ROUTE_ENABLED__ = false;
      win.__VECTOPLAN_EDITOR_BROWSER_CALLS_LIBRARY_DIRECTLY__ = false;

      if (result.ok) {
        win.__VECTOPLAN_EDITOR_INVENTORY__ = result.state;
        win.__VECTOPLAN_EDITOR_INVENTORY_CONFIG__ = result.state;
        win.__VECTOPLAN_EDITOR_INVENTORY_SOURCE__ = result.state.source;
      }
    } catch (error) {
      safeConsoleWarn("VECTOPLAN Editor: Inventory-Window-Globals konnten nicht gesetzt werden.", error);
    }
  }
}

let defaultClient: EditorInventoryApiClient | null = null;

export function getDefaultEditorInventoryApiClient(
  config?: Partial<EditorInventoryApiClientConfig>,
): EditorInventoryApiClient {
  if (!defaultClient || config) {
    defaultClient = new EditorInventoryApiClient(config);
  }

  return defaultClient;
}

export function clearEditorInventoryApiClientCaches(): void {
  try {
    defaultClient?.clearCache();
  } catch {
    // Ignore.
  }

  defaultClient = null;
}

export async function loadEditorInventory(
  options?: EditorInventoryApiClientOptions,
): Promise<EditorInventoryLoadResult> {
  return getDefaultEditorInventoryApiClient().loadInventory(options);
}

export async function loadEditorInventoryPayload(
  options?: EditorInventoryApiClientOptions,
): Promise<EditorInventoryPayload> {
  return getDefaultEditorInventoryApiClient().loadInventoryPayload(options);
}

export async function loadEditorInventoryState(
  options?: EditorInventoryApiClientOptions,
): Promise<EditorInventoryState> {
  return getDefaultEditorInventoryApiClient().loadInventoryState(options);
}

export async function loadEditorInventoryMetadata(
  options?: EditorInventoryApiClientOptions,
): Promise<UnknownRecord> {
  return getDefaultEditorInventoryApiClient().loadMetadata(options);
}

export async function loadEditorInventoryHealth(
  options?: EditorInventoryApiClientOptions,
): Promise<UnknownRecord> {
  return getDefaultEditorInventoryApiClient().loadHealth(options);
}

export function getEditorInventoryApiClientDiagnostics(): EditorInventoryClientDiagnostics {
  return getDefaultEditorInventoryApiClient().getDiagnostics();
}

export function getEditorInventoryApiClientMetadata(): UnknownRecord {
  return {
    moduleName: EDITOR_INVENTORY_API_CLIENT_MODULE_NAME,
    moduleVersion: EDITOR_INVENTORY_API_CLIENT_MODULE_VERSION,
    defaultInventoryApiUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
    defaultMetadataUrl: DEFAULT_EDITOR_INVENTORY_METADATA_URL,
    defaultHealthUrl: DEFAULT_EDITOR_INVENTORY_HEALTH_URL,
    defaultTimeoutMs: DEFAULT_EDITOR_INVENTORY_REQUEST_TIMEOUT_MS,
    defaultCacheTtlMs: DEFAULT_EDITOR_INVENTORY_CACHE_TTL_MS,
    defaultStaleCacheTtlMs: DEFAULT_EDITOR_INVENTORY_STALE_CACHE_TTL_MS,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      chunkPlaceableFallbackUsed: false,
      windowConsoleAccessAvoided: true,
      loadResultErrorAccessGuarded: true,
    },
  };
}