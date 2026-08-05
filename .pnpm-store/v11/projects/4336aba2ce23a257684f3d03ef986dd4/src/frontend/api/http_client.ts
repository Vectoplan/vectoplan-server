// services/vectoplan-editor/src/frontend/api/http_client.ts
import {
  ChunkApiError,
  chunkApiErrorToDetails,
  createAbortedError,
  createHttpError,
  createInvalidPayloadError,
  createNetworkError,
  createTimeoutError,
} from "./chunk_api_errors";
import {
  CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE,
  CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE,
  CHUNK_API_CREATIVE_LIBRARY_ROUTE,
  CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE,
  CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE,
  CHUNK_API_EDITOR_INVENTORY_ROUTE,
  CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  type ChunkApiErrorDetails,
  type ChunkApiFailedResult,
  type ChunkApiHttpMethod,
  type ChunkApiJsonValue,
  type ChunkApiRequestKind,
  type ChunkApiRequestMeta,
  type ChunkApiRequestOptions,
  type ChunkApiResponseSource,
  type ChunkApiUnknownRecord,
} from "./chunk_api_models";

export interface HttpJsonClientOptions {
  readonly defaultHeaders?: Record<string, string>;
  readonly logger?: HttpJsonClientLogger;
  readonly signal?: AbortSignal;
}

export interface HttpJsonClientLogger {
  readonly debug?: (message: string, details?: Record<string, unknown>) => void;
  readonly info?: (message: string, details?: Record<string, unknown>) => void;
  readonly warn?: (message: string, details?: Record<string, unknown>) => void;
  readonly error?: (message: string, details?: Record<string, unknown>) => void;
}

export interface HttpJsonRequestResult<T = unknown> {
  readonly ok: true;
  readonly request: ChunkApiRequestMeta;
  readonly data: T;
  readonly rawText: string;
  readonly headers: Headers;
}

export interface HttpJsonRequestFailure {
  readonly ok: false;
  readonly request: ChunkApiRequestMeta | null;
  readonly error: ChunkApiErrorDetails;
  readonly rawText: string | null;
  readonly headers: Headers | null;
}

export type HttpJsonResult<T = unknown> =
  | HttpJsonRequestResult<T>
  | HttpJsonRequestFailure;

export interface HttpJsonClient {
  readonly kind: "vectoplan-editor-http-json-client.v1";

  requestJson<T = unknown>(options: ChunkApiRequestOptions): Promise<HttpJsonResult<T>>;

  buildFailureResult(input: {
    readonly error: unknown;
    readonly request?: ChunkApiRequestMeta | null;
    readonly rawText?: string | null;
    readonly headers?: Headers | null;
  }): HttpJsonRequestFailure;

  destroy(reason?: string): void;
}

const HTTP_JSON_CLIENT_KIND = "vectoplan-editor-http-json-client.v1" as const;
const MAX_JSON_NORMALIZE_DEPTH = 8;
const DEFAULT_TIMEOUT_MS = 10_000;

type SafeJsonObject = Record<string, ChunkApiJsonValue>;

function nowIsoString(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function nowMs(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
  }
}

function createRequestId(kind: ChunkApiRequestKind): string {
  try {
    const randomPart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    return `chunk_api_${kind}_${Date.now()}_${randomPart}`;
  } catch {
    return `chunk_api_${kind}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function normalizeMethod(method: unknown): ChunkApiHttpMethod {
  try {
    if (typeof method !== "string") {
      return "GET";
    }

    const normalized = method.trim().toUpperCase();

    if (
      normalized === "GET"
      || normalized === "POST"
      || normalized === "PUT"
      || normalized === "PATCH"
      || normalized === "DELETE"
    ) {
      return normalized;
    }

    return "GET";
  } catch {
    return "GET";
  }
}

function normalizeTimeoutMs(value: unknown, fallback: number): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value.trim(), 10)
          : Number.NaN;

    if (!Number.isFinite(numeric) || numeric <= 0) {
      return fallback;
    }

    return Math.min(120_000, Math.max(250, Math.trunc(numeric)));
  } catch {
    return fallback;
  }
}

function normalizeUrl(url: unknown): string {
  try {
    if (typeof url !== "string") {
      throw new ChunkApiError({
        code: "chunk_api_invalid_url",
        message: "Chunk API URL was not a string.",
        retryable: false,
      });
    }

    const trimmed = url.trim();

    if (trimmed.length === 0) {
      throw new ChunkApiError({
        code: "chunk_api_invalid_url",
        message: "Chunk API URL was empty.",
        retryable: false,
      });
    }

    return trimmed;
  } catch (error) {
    if (error instanceof ChunkApiError) {
      throw error;
    }

    throw new ChunkApiError({
      code: "chunk_api_invalid_url",
      message: "Chunk API URL could not be normalized.",
      retryable: false,
      cause: error,
    });
  }
}

function isPlainObject(value: unknown): value is ChunkApiUnknownRecord {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

function canHaveBody(method: ChunkApiHttpMethod): boolean {
  return method !== "GET" && method !== "DELETE";
}

function isBodyInit(value: unknown): value is BodyInit {
  try {
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      return true;
    }

    if (typeof FormData !== "undefined" && value instanceof FormData) {
      return true;
    }

    if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
      return true;
    }

    if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function sanitizeHeaders(headers: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  try {
    if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
      return result;
    }

    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
      const normalizedKey = key.trim();

      if (normalizedKey.length === 0) {
        continue;
      }

      if (typeof value === "string") {
        result[normalizedKey] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        result[normalizedKey] = String(value);
      }
    }

    return result;
  } catch {
    return result;
  }
}

function buildHeaders(
  defaultHeaders: Record<string, string>,
  requestHeaders: unknown,
  hasBody: boolean,
): Headers {
  const headers = new Headers();

  try {
    for (const [key, value] of Object.entries(defaultHeaders)) {
      if (key.trim().length > 0 && value.trim().length > 0) {
        headers.set(key, value);
      }
    }

    const sanitizedRequestHeaders = sanitizeHeaders(requestHeaders);

    for (const [key, value] of Object.entries(sanitizedRequestHeaders)) {
      headers.set(key, value);
    }

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json, text/plain;q=0.8, */*;q=0.5");
    }

    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (!headers.has("X-Requested-With")) {
      headers.set("X-Requested-With", "vectoplan-editor");
    }

    if (!headers.has("X-Vectoplan-Editor-Inventory-Truth")) {
      headers.set("X-Vectoplan-Editor-Inventory-Truth", CHUNK_API_EDITOR_INVENTORY_ROUTE);
    }

    if (!headers.has("X-Vectoplan-Editor-Legacy-Chunk-Inventory")) {
      headers.set("X-Vectoplan-Editor-Legacy-Chunk-Inventory", "diagnostic-only");
    }

    if (!headers.has("X-Vectoplan-Editor-Debug-Grass-Dirt-Allowed")) {
      headers.set("X-Vectoplan-Editor-Debug-Grass-Dirt-Allowed", "false");
    }

    return headers;
  } catch {
    return headers;
  }
}

function serializeBody(body: unknown): BodyInit | undefined {
  try {
    if (body === undefined || body === null) {
      return undefined;
    }

    if (typeof body === "string") {
      return body;
    }

    if (isBodyInit(body)) {
      return body;
    }

    return JSON.stringify(body);
  } catch (error) {
    throw new ChunkApiError({
      code: "chunk_api_invalid_payload",
      message: "Chunk API request body could not be serialized.",
      retryable: false,
      cause: error,
    });
  }
}

function parseJsonPayload<T>(rawText: string, request: ChunkApiRequestMeta): T {
  try {
    const trimmed = rawText.trim();

    if (trimmed.length === 0) {
      return null as T;
    }

    return JSON.parse(trimmed) as T;
  } catch (error) {
    throw createInvalidPayloadError({
      message: "Chunk API response was not valid JSON.",
      request,
      details: {
        rawPreview: rawText.slice(0, 500),
        productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
      },
      cause: error,
    });
  }
}

function routePath(url: string): string {
  try {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost";
    const parsed = new URL(url, origin);

    return parsed.pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function deriveSourceFromUrl(url: string): ChunkApiResponseSource {
  try {
    const path = routePath(url);
    const normalized = url.toLowerCase();

    if (
      path.includes(CHUNK_API_EDITOR_INVENTORY_ROUTE)
      || path.includes(CHUNK_API_EDITOR_INVENTORY_HEALTH_ROUTE)
      || path.includes(CHUNK_API_EDITOR_INVENTORY_METADATA_ROUTE)
      || path.includes(CHUNK_API_CREATIVE_LIBRARY_ROUTE)
      || path.includes(CHUNK_API_CREATIVE_LIBRARY_HEALTH_ROUTE)
      || path.includes(CHUNK_API_CREATIVE_LIBRARY_METADATA_ROUTE)
    ) {
      return "editor-proxy";
    }

    if (path.includes("/editor/api/chunk")) {
      return "editor-proxy";
    }

    if (normalized.includes("vectoplan-chunk")) {
      return "vectoplan-chunk";
    }

    if (path.includes("placeable-blocks")) {
      return "editor-placeholder";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function completeRequestMeta(
  meta: ChunkApiRequestMeta,
  input: {
    readonly statusCode: number | null;
    readonly ok: boolean;
    readonly aborted?: boolean;
    readonly timedOut?: boolean;
    readonly source?: ChunkApiResponseSource;
    readonly startedAtMs: number;
  },
): ChunkApiRequestMeta {
  const completedAtMs = nowMs();

  return {
    ...meta,
    completedAt: nowIsoString(),
    elapsedMs: Math.max(0, Math.round(completedAtMs - input.startedAtMs)),
    statusCode: input.statusCode,
    ok: input.ok,
    aborted: input.aborted ?? false,
    timedOut: input.timedOut ?? false,
    source: input.source ?? deriveSourceFromUrl(meta.url),
  };
}

function buildInitialRequestMeta(input: {
  readonly kind: ChunkApiRequestKind;
  readonly method: ChunkApiHttpMethod;
  readonly url: string;
}): ChunkApiRequestMeta {
  return {
    requestId: createRequestId(input.kind),
    kind: input.kind,
    method: input.method,
    url: input.url,
    startedAt: nowIsoString(),
    completedAt: null,
    elapsedMs: null,
    statusCode: null,
    ok: false,
    aborted: false,
    timedOut: false,
    source: deriveSourceFromUrl(input.url),
  };
}

function abortControllerWithReason(controller: AbortController, reason: unknown): void {
  try {
    controller.abort(reason);
  } catch {
    try {
      controller.abort();
    } catch {
      // Ignore.
    }
  }
}

function mergeAbortSignals(
  signals: readonly (AbortSignal | undefined | null)[],
  timeoutMs: number,
): {
  readonly signal: AbortSignal;
  readonly cleanup: () => void;
  readonly isTimedOut: () => boolean;
} {
  const controller = new AbortController();
  let timedOut = false;

  const abortFrom = (source: AbortSignal): void => {
    try {
      if (controller.signal.aborted) {
        return;
      }

      abortControllerWithReason(controller, source.reason ?? "upstream-abort");
    } catch {
      abortControllerWithReason(controller, "upstream-abort");
    }
  };

  const listeners: Array<() => void> = [];

  for (const sourceSignal of signals) {
    if (!sourceSignal) {
      continue;
    }

    try {
      if (sourceSignal.aborted) {
        abortFrom(sourceSignal);
        continue;
      }

      const listener = (): void => abortFrom(sourceSignal);
      sourceSignal.addEventListener("abort", listener, { once: true });
      listeners.push(() => sourceSignal.removeEventListener("abort", listener));
    } catch {
      // Ignore invalid signals.
    }
  }

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;

    try {
      if (!controller.signal.aborted) {
        abortControllerWithReason(controller, "timeout");
      }
    } catch {
      // Ignore.
    }
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      try {
        globalThis.clearTimeout(timeoutId);
      } catch {
        // Ignore.
      }

      for (const remove of listeners) {
        try {
          remove();
        } catch {
          // Ignore.
        }
      }
    },
    isTimedOut: () => timedOut,
  };
}

function createFailureResult(input: {
  readonly error: unknown;
  readonly request?: ChunkApiRequestMeta | null;
  readonly rawText?: string | null;
  readonly headers?: Headers | null;
}): HttpJsonRequestFailure {
  const details = chunkApiErrorToDetails(input.error);

  return {
    ok: false,
    request: input.request ?? null,
    error: details,
    rawText: input.rawText ?? null,
    headers: input.headers ?? null,
  };
}

function logDebug(
  logger: HttpJsonClientLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Ignore logging failures.
  }
}

function logWarn(
  logger: HttpJsonClientLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.warn?.(message, details);
  } catch {
    // Ignore logging failures.
  }
}

function logError(
  logger: HttpJsonClientLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.error?.(message, details);
  } catch {
    // Ignore logging failures.
  }
}

function buildRequestInit(input: {
  readonly method: ChunkApiHttpMethod;
  readonly headers: Headers;
  readonly body?: BodyInit;
  readonly signal: AbortSignal;
}): RequestInit {
  const init: RequestInit = {
    method: input.method,
    headers: input.headers,
    signal: input.signal,
    credentials: "same-origin",
    cache: input.method === "GET" ? "no-cache" : "no-store",
    redirect: "follow",
  };

  if (input.body !== undefined) {
    init.body = input.body;
  }

  return init;
}

function logRequestStart(
  logger: HttpJsonClientLogger | undefined,
  input: {
    readonly request: ChunkApiRequestMeta;
    readonly timeoutMs: number;
    readonly hasBody: boolean;
  },
): void {
  logDebug(logger, "Chunk API request started.", {
    requestId: input.request.requestId,
    kind: input.request.kind,
    method: input.request.method,
    url: input.request.url,
    source: input.request.source,
    timeoutMs: input.timeoutMs,
    hasBody: input.hasBody,
    inventoryTruth: CHUNK_API_EDITOR_INVENTORY_ROUTE,
  });
}

function logRequestComplete(
  logger: HttpJsonClientLogger | undefined,
  input: {
    readonly request: ChunkApiRequestMeta;
    readonly rawTextLength: number;
  },
): void {
  logDebug(logger, "Chunk API request completed.", {
    requestId: input.request.requestId,
    kind: input.request.kind,
    source: input.request.source,
    statusCode: input.request.statusCode,
    elapsedMs: input.request.elapsedMs,
    rawTextLength: input.rawTextLength,
  });
}

export function createHttpJsonClient(options?: HttpJsonClientOptions): HttpJsonClient {
  let destroyed = false;
  const rootAbortController = new AbortController();

  const defaultHeaders = {
    Accept: "application/json",
    "X-Vectoplan-Frontend": "editor",
    "X-Vectoplan-Editor-Inventory-Truth": CHUNK_API_EDITOR_INVENTORY_ROUTE,
    "X-Vectoplan-Editor-Legacy-Chunk-Inventory": "diagnostic-only",
    "X-Vectoplan-Editor-Debug-Grass-Dirt-Allowed": "false",
    ...(options?.defaultHeaders ?? {}),
  };

  const rootSignal = options?.signal ?? null;

  if (rootSignal) {
    try {
      if (rootSignal.aborted) {
        abortControllerWithReason(rootAbortController, rootSignal.reason ?? "root-aborted");
      } else {
        rootSignal.addEventListener(
          "abort",
          () => {
            abortControllerWithReason(rootAbortController, rootSignal.reason ?? "root-aborted");
          },
          { once: true },
        );
      }
    } catch {
      // Ignore invalid root signal.
    }
  }

  const client: HttpJsonClient = {
    kind: HTTP_JSON_CLIENT_KIND,

    async requestJson<T = unknown>(requestOptions: ChunkApiRequestOptions): Promise<HttpJsonResult<T>> {
      const startedAtMs = nowMs();
      let requestMeta: ChunkApiRequestMeta | null = null;
      let rawText: string | null = null;
      let responseHeaders: Headers | null = null;

      try {
        if (destroyed) {
          throw new ChunkApiError({
            code: "chunk_api_destroyed",
            message: "HTTP JSON client has been destroyed.",
            retryable: true,
          });
        }

        if (typeof fetch !== "function") {
          throw new ChunkApiError({
            code: "chunk_api_network_error",
            message: "fetch() is not available in this runtime.",
            retryable: true,
          });
        }

        const method = normalizeMethod(requestOptions.method);
        const url = normalizeUrl(requestOptions.url);
        const timeoutMs = normalizeTimeoutMs(requestOptions.timeoutMs, DEFAULT_TIMEOUT_MS);
        const hasBody = requestOptions.body !== undefined && requestOptions.body !== null && canHaveBody(method);

        requestMeta = buildInitialRequestMeta({
          kind: requestOptions.kind,
          method,
          url,
        });

        const mergedSignal = mergeAbortSignals(
          [
            rootAbortController.signal,
            requestOptions.signal,
          ],
          timeoutMs,
        );

        const headers = buildHeaders(defaultHeaders, requestOptions.headers, hasBody);
        const body = hasBody ? serializeBody(requestOptions.body) : undefined;

        logRequestStart(options?.logger, {
          request: requestMeta,
          timeoutMs,
          hasBody,
        });

        let response: Response;

        try {
          response = await fetch(
            url,
            buildRequestInit({
              method,
              headers,
              body,
              signal: mergedSignal.signal,
            }),
          );
        } catch (error) {
          const completedMeta = completeRequestMeta(requestMeta, {
            statusCode: null,
            ok: false,
            aborted: mergedSignal.signal.aborted,
            timedOut: mergedSignal.isTimedOut(),
            startedAtMs,
          });

          requestMeta = completedMeta;

          if (mergedSignal.isTimedOut()) {
            throw createTimeoutError({
              request: completedMeta,
              timeoutMs,
              cause: error,
            });
          }

          if (mergedSignal.signal.aborted) {
            throw createAbortedError({
              request: completedMeta,
              cause: error,
            });
          }

          throw createNetworkError({
            request: completedMeta,
            cause: error,
          });
        } finally {
          mergedSignal.cleanup();
        }

        responseHeaders = response.headers;

        try {
          rawText = await response.text();
        } catch (error) {
          const completedMeta = completeRequestMeta(requestMeta, {
            statusCode: response.status,
            ok: false,
            startedAtMs,
          });

          requestMeta = completedMeta;

          throw createNetworkError({
            request: completedMeta,
            cause: error,
          });
        }

        const completedMeta = completeRequestMeta(requestMeta, {
          statusCode: response.status,
          ok: response.ok,
          startedAtMs,
        });

        requestMeta = completedMeta;

        if (!response.ok && requestOptions.allowNonOk !== true) {
          throw createHttpError({
            request: completedMeta,
            statusCode: response.status,
            statusText: response.statusText,
            body: rawText,
          });
        }

        const data = parseJsonPayload<T>(rawText, completedMeta);

        logRequestComplete(options?.logger, {
          request: completedMeta,
          rawTextLength: rawText.length,
        });

        return {
          ok: true,
          request: completedMeta,
          data,
          rawText,
          headers: responseHeaders,
        };
      } catch (error) {
        const failure = createFailureResult({
          error,
          request: requestMeta,
          rawText,
          headers: responseHeaders,
        });

        if (failure.error.retryable) {
          logWarn(options?.logger, "Chunk API request failed with retryable error.", {
            error: failure.error,
            request: requestMeta,
            inventoryTruth: CHUNK_API_EDITOR_INVENTORY_ROUTE,
          });
        } else {
          logError(options?.logger, "Chunk API request failed.", {
            error: failure.error,
            request: requestMeta,
            inventoryTruth: CHUNK_API_EDITOR_INVENTORY_ROUTE,
          });
        }

        return failure;
      }
    },

    buildFailureResult(input: {
      readonly error: unknown;
      readonly request?: ChunkApiRequestMeta | null;
      readonly rawText?: string | null;
      readonly headers?: Headers | null;
    }): HttpJsonRequestFailure {
      return createFailureResult(input);
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      abortControllerWithReason(rootAbortController, reason ?? "http-json-client-destroyed");

      logDebug(options?.logger, "HTTP JSON client destroyed.", {
        reason: reason ?? "unknown",
      });
    },
  };

  return client;
}

export function createChunkApiFailedResult(input: {
  readonly error: unknown;
  readonly request?: ChunkApiRequestMeta | null;
  readonly raw?: unknown;
  readonly source?: ChunkApiResponseSource;
}): ChunkApiFailedResult {
  const details = chunkApiErrorToDetails(input.error);

  return {
    ok: false,
    request: input.request ?? null,
    source: input.source ?? input.request?.source ?? "unknown",
    raw: input.raw ?? null,
    error: details,
  };
}

export function isHttpJsonSuccess<T>(result: HttpJsonResult<T>): result is HttpJsonRequestResult<T> {
  return result.ok === true;
}

export function isHttpJsonFailure<T>(result: HttpJsonResult<T>): result is HttpJsonRequestFailure {
  return result.ok === false;
}

export function toJsonValue(value: unknown, depth = 0): ChunkApiJsonValue {
  try {
    if (depth > MAX_JSON_NORMALIZE_DEPTH) {
      return "[max-depth]" as ChunkApiJsonValue;
    }

    if (value === null) {
      return null as ChunkApiJsonValue;
    }

    if (typeof value === "string" || typeof value === "boolean") {
      return value as ChunkApiJsonValue;
    }

    if (typeof value === "number") {
      return (Number.isFinite(value) ? value : null) as ChunkApiJsonValue;
    }

    if (typeof value === "bigint") {
      return String(value) as ChunkApiJsonValue;
    }

    if (value instanceof Date) {
      return value.toISOString() as ChunkApiJsonValue;
    }

    if (Array.isArray(value)) {
      return value.map((item) => toJsonValue(item, depth + 1)) as ChunkApiJsonValue;
    }

    if (isPlainObject(value)) {
      const output: SafeJsonObject = {};

      for (const [key, nested] of Object.entries(value)) {
        output[key] = toJsonValue(nested, depth + 1);
      }

      return output as ChunkApiJsonValue;
    }

    if (value === undefined) {
      return null as ChunkApiJsonValue;
    }

    return String(value) as ChunkApiJsonValue;
  } catch {
    return null as ChunkApiJsonValue;
  }
}

export function getHttpClientMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.api.http_client",
    clientKind: HTTP_JSON_CLIENT_KIND,
    productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    creativeLibraryRoute: CHUNK_API_CREATIVE_LIBRARY_ROUTE,
    forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      sameOriginCredentials: true,
      noCacheForGet: true,
      noStoreForMutations: true,
      abortableWithTimeout: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      legacyChunkInventoryDiagnosticOnlyHeader: true,
      debugGrassDirtAllowedHeaderFalse: true,
    },
  };
}