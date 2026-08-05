// services/vectoplan-editor/src/frontend/utils/editor_chunk_proxy_url.ts

/**
 * Central URL contract for the editor-side chunk proxy.
 *
 * Hard invariant:
 *
 *   Browser inside vectoplan-editor iframe
 *   → uses editor proxy base:
 *     /editor/api/chunk
 *
 * It must not accidentally call:
 *
 *   http://localhost:5103/editor/api/chunk
 *   http://127.0.0.1:5103//editor/api/chunk
 *
 * because 5103 is vectoplan-app in local development. The app is allowed to
 * provide context, but the browser chunk proxy must be the editor service.
 */

export const EDITOR_CHUNK_PROXY_URL_KIND = "vectoplan-editor-chunk-proxy-url.v1" as const;
export const EDITOR_CHUNK_PROXY_URL_VERSION = "1.0.0" as const;

export const DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL = "/editor/api/chunk" as const;
export const DEFAULT_EDITOR_CHUNK_PROXY_PATH = "/editor/api/chunk" as const;

export const DEFAULT_EDITOR_PUBLIC_PORTS = ["5100"] as const;
export const DEFAULT_APP_PUBLIC_PORTS = ["5103"] as const;
export const DEFAULT_DIRECT_CHUNK_SERVICE_PORTS = ["5102", "5002"] as const;

export const DEFAULT_MAX_EDITOR_CHUNK_PROXY_URL_CACHE_ENTRIES = 512;

export type EditorChunkProxyUrlStatus =
  | "valid"
  | "normalized"
  | "degraded"
  | "invalid";

export type EditorChunkProxyUrlIssueSeverity =
  | "info"
  | "warning"
  | "error";

export type EditorChunkProxyUrlIssueCode =
  | "empty_value"
  | "fallback_used"
  | "invalid_url"
  | "query_or_hash_removed"
  | "double_slash_normalized"
  | "trailing_slash_removed"
  | "missing_leading_slash_added"
  | "relative_editor_proxy_accepted"
  | "relative_editor_proxy_normalized"
  | "absolute_current_origin_editor_proxy_accepted"
  | "absolute_current_origin_editor_proxy_normalized_to_relative"
  | "absolute_editor_proxy_accepted"
  | "absolute_foreign_editor_proxy_rejected"
  | "app_origin_editor_proxy_rejected"
  | "known_app_port_editor_proxy_rejected"
  | "direct_chunk_service_url_accepted"
  | "direct_chunk_service_url_rejected"
  | "absolute_non_editor_proxy_url_rejected"
  | "relative_non_editor_proxy_url_rejected"
  | "unsafe_protocol_rejected"
  | "unexpected_error";

export type EditorChunkProxyUrlKind =
  | "relative_editor_proxy"
  | "absolute_editor_proxy"
  | "direct_chunk_service"
  | "foreign_editor_proxy"
  | "app_origin_editor_proxy"
  | "non_editor_proxy"
  | "empty"
  | "invalid";

export type UnknownRecord = Record<string, unknown>;

export interface EditorChunkProxyUrlOptions {
  /**
   * Safe fallback. Normally always /editor/api/chunk.
   */
  readonly defaultBaseUrl?: string;

  /**
   * Canonical editor proxy path. Normally always /editor/api/chunk.
   */
  readonly editorChunkProxyPath?: string;

  /**
   * Explicit current editor origin. If omitted, window.location.origin is used
   * when available.
   */
  readonly currentOrigin?: string | null;

  /**
   * Known editor origins. Absolute editor proxy URLs are accepted only when they
   * are same-origin or explicitly allowed.
   */
  readonly editorPublicOrigins?: readonly string[];

  /**
   * Known app origins. If an absolute /editor/api/chunk URL points to one of
   * these origins, it is rejected and normalized to the relative editor proxy.
   */
  readonly appPublicOrigins?: readonly string[];

  readonly editorPublicPorts?: readonly (string | number)[];
  readonly appPublicPorts?: readonly (string | number)[];
  readonly directChunkServicePorts?: readonly (string | number)[];

  /**
   * Default true. Even a same-origin absolute editor proxy URL becomes:
   * /editor/api/chunk
   */
  readonly forceRelativeEditorProxy?: boolean;

  /**
   * Default true. Same-origin absolute editor proxy URLs are allowed, but usually
   * normalized to relative.
   */
  readonly allowAbsoluteEditorProxyOnCurrentOrigin?: boolean;

  /**
   * Default false. Foreign-origin /editor/api/chunk URLs are dangerous because
   * the app origin can accidentally be used.
   */
  readonly allowAbsoluteEditorProxyOnForeignOrigin?: boolean;

  /**
   * Default false. Direct chunk-service calls from the browser are not the
   * product path. The editor should use its own proxy.
   */
  readonly allowDirectChunkServiceUrl?: boolean;

  /**
   * If true, output objects are shallow-frozen.
   */
  readonly freezeResults?: boolean;

  /**
   * Enables internal memoization.
   */
  readonly useCache?: boolean;

  readonly maxCacheEntries?: number;
}

export interface EditorChunkProxyUrlIssue {
  readonly code: EditorChunkProxyUrlIssueCode;
  readonly severity: EditorChunkProxyUrlIssueSeverity;
  readonly message: string;
  readonly value: string | null;
  readonly details: UnknownRecord | null;
}

export interface EditorChunkProxyUrlResult {
  readonly kind: typeof EDITOR_CHUNK_PROXY_URL_KIND;
  readonly version: typeof EDITOR_CHUNK_PROXY_URL_VERSION;

  readonly status: EditorChunkProxyUrlStatus;
  readonly urlKind: EditorChunkProxyUrlKind;

  readonly raw: string;
  readonly normalized: string;
  readonly baseUrl: string;

  readonly isValid: boolean;
  readonly isRelative: boolean;
  readonly isAbsolute: boolean;
  readonly isEditorProxy: boolean;
  readonly isDirectChunkServiceUrl: boolean;
  readonly isForeignOrigin: boolean;
  readonly isKnownAppOrigin: boolean;
  readonly isKnownEditorOrigin: boolean;

  readonly origin: string | null;
  readonly currentOrigin: string | null;
  readonly pathname: string;
  readonly usedFallback: boolean;
  readonly rejected: boolean;

  readonly issues: readonly EditorChunkProxyUrlIssue[];
}

export interface EditorChunkProxyUrlDebugSummary {
  readonly kind: typeof EDITOR_CHUNK_PROXY_URL_KIND;
  readonly version: typeof EDITOR_CHUNK_PROXY_URL_VERSION;
  readonly defaultEditorChunkProxyBaseUrl: typeof DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL;
  readonly rules: {
    readonly browserUsesEditorProxy: true;
    readonly appOriginEditorProxyRejected: true;
    readonly foreignEditorProxyRejectedByDefault: true;
    readonly directChunkServiceRejectedByDefault: true;
    readonly relativeEditorProxyPreferred: true;
    readonly doubleSlashNormalized: true;
  };
}

interface NormalizedOptions {
  readonly defaultBaseUrl: string;
  readonly editorChunkProxyPath: string;
  readonly currentOrigin: string | null;
  readonly editorPublicOrigins: readonly string[];
  readonly appPublicOrigins: readonly string[];
  readonly editorPublicPorts: readonly string[];
  readonly appPublicPorts: readonly string[];
  readonly directChunkServicePorts: readonly string[];
  readonly forceRelativeEditorProxy: boolean;
  readonly allowAbsoluteEditorProxyOnCurrentOrigin: boolean;
  readonly allowAbsoluteEditorProxyOnForeignOrigin: boolean;
  readonly allowDirectChunkServiceUrl: boolean;
  readonly freezeResults: boolean;
  readonly useCache: boolean;
  readonly maxCacheEntries: number;
}

interface ParsedUrlLike {
  readonly raw: string;
  readonly isAbsolute: boolean;
  readonly origin: string | null;
  readonly protocol: string | null;
  readonly hostname: string | null;
  readonly port: string | null;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

const STRING_CACHE = new Map<string, string>();
const RESULT_CACHE = new Map<string, EditorChunkProxyUrlResult>();

function safeString(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : fallback;
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function safeBoolean(value: unknown, fallback = false): boolean {
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

function safeInteger(
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

function normalizeStringArray(value: unknown, fallback: readonly string[]): readonly string[] {
  try {
    const input = Array.isArray(value) ? value : fallback;
    const result: string[] = [];

    for (const item of input) {
      const normalized = safeString(item, "");

      if (normalized.length > 0 && !result.includes(normalized)) {
        result.push(normalized);
      }
    }

    return result.length > 0 ? result : [...fallback];
  } catch {
    return [...fallback];
  }
}

function normalizePortArray(value: unknown, fallback: readonly (string | number)[]): readonly string[] {
  try {
    const input = Array.isArray(value) ? value : fallback;
    const result: string[] = [];

    for (const item of input) {
      const normalized = safeString(item, "").replace(/[^0-9]/g, "");

      if (normalized.length > 0 && !result.includes(normalized)) {
        result.push(normalized);
      }
    }

    return result.length > 0
      ? result
      : fallback.map((item) => safeString(item, "")).filter((item) => item.length > 0);
  } catch {
    return fallback.map((item) => safeString(item, "")).filter((item) => item.length > 0);
  }
}

function createIssue(input: {
  readonly code: EditorChunkProxyUrlIssueCode;
  readonly severity: EditorChunkProxyUrlIssueSeverity;
  readonly message: string;
  readonly value?: unknown;
  readonly details?: UnknownRecord | null;
}): EditorChunkProxyUrlIssue {
  try {
    return {
      code: input.code,
      severity: input.severity,
      message: input.message,
      value: safeString(input.value, "") || null,
      details: input.details ?? null,
    };
  } catch {
    return {
      code: "unexpected_error",
      severity: "error",
      message: "Unexpected editor chunk proxy URL issue creation error.",
      value: null,
      details: null,
    };
  }
}

function freezeIfRequested<T>(value: T, options: NormalizedOptions): T {
  try {
    if (!options.freezeResults) {
      return value;
    }

    if (value && typeof value === "object") {
      return Object.freeze(value);
    }

    return value;
  } catch {
    return value;
  }
}

function freezeArrayIfRequested<T>(
  value: readonly T[],
  options: NormalizedOptions,
): readonly T[] {
  try {
    const array = [...value];

    if (!options.freezeResults) {
      return array;
    }

    return Object.freeze(array);
  } catch {
    return value;
  }
}

function cacheKey(prefix: string, value: unknown, options: NormalizedOptions): string {
  try {
    return [
      prefix,
      safeString(value, ""),
      options.defaultBaseUrl,
      options.editorChunkProxyPath,
      options.currentOrigin ?? "",
      options.editorPublicOrigins.join(","),
      options.appPublicOrigins.join(","),
      options.editorPublicPorts.join(","),
      options.appPublicPorts.join(","),
      options.directChunkServicePorts.join(","),
      String(options.forceRelativeEditorProxy),
      String(options.allowAbsoluteEditorProxyOnCurrentOrigin),
      String(options.allowAbsoluteEditorProxyOnForeignOrigin),
      String(options.allowDirectChunkServiceUrl),
    ].join("|");
  } catch {
    return `${prefix}|fallback`;
  }
}

function rememberCache<T>(
  cache: Map<string, T>,
  key: string,
  options: NormalizedOptions,
  factory: () => T,
): T {
  try {
    if (!options.useCache) {
      return factory();
    }

    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = factory();

    if (cache.size >= options.maxCacheEntries) {
      const firstKey = cache.keys().next().value as string | undefined;

      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, value);
    return value;
  } catch {
    return factory();
  }
}

function normalizeCachedString(value: unknown, fallback: string, options: NormalizedOptions): string {
  const key = cacheKey("string", `${safeString(value, "")}|${fallback}`, options);

  return rememberCache(STRING_CACHE, key, options, () => safeString(value, fallback));
}

function getWindowCurrentOrigin(): string | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const origin = safeString(window.location?.origin, "");

    if (origin) {
      return normalizeOrigin(origin);
    }

    const protocol = safeString(window.location?.protocol, "");
    const host = safeString(window.location?.host, "");

    if (protocol && host) {
      return normalizeOrigin(`${protocol}//${host}`);
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeOrigin(value: unknown): string | null {
  try {
    const raw = safeString(value, "");

    if (!raw) {
      return null;
    }

    const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)
      ? raw
      : `http://${raw}`;

    const parsed = new URL(withProtocol);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeOriginArray(value: unknown): readonly string[] {
  try {
    const input = Array.isArray(value) ? value : [];
    const result: string[] = [];

    for (const item of input) {
      const origin = normalizeOrigin(item);

      if (origin && !result.includes(origin)) {
        result.push(origin);
      }
    }

    return result;
  } catch {
    return [];
  }
}

function stripQueryAndHashFromPath(value: string): {
  readonly path: string;
  readonly hadQueryOrHash: boolean;
} {
  try {
    const hashIndex = value.indexOf("#");
    const queryIndex = value.indexOf("?");

    let endIndex = value.length;

    if (hashIndex >= 0) {
      endIndex = Math.min(endIndex, hashIndex);
    }

    if (queryIndex >= 0) {
      endIndex = Math.min(endIndex, queryIndex);
    }

    return {
      path: value.slice(0, endIndex),
      hadQueryOrHash: endIndex !== value.length,
    };
  } catch {
    return {
      path: value,
      hadQueryOrHash: false,
    };
  }
}

function normalizePath(value: unknown, fallback: string = DEFAULT_EDITOR_CHUNK_PROXY_PATH): {
  readonly path: string;
  readonly changed: boolean;
  readonly hadQueryOrHash: boolean;
  readonly hadDoubleSlash: boolean;
  readonly hadTrailingSlash: boolean;
  readonly addedLeadingSlash: boolean;
} {
  try {
    const raw = safeString(value, fallback).replace(/\\/g, "/").trim();
    const stripped = stripQueryAndHashFromPath(raw);
    const withoutQuery = stripped.path;

    const hadDoubleSlash = /\/{2,}/.test(withoutQuery);
    let path = withoutQuery.replace(/\/{2,}/g, "/");

    const addedLeadingSlash = !path.startsWith("/");
    if (addedLeadingSlash) {
      path = `/${path}`;
    }

    const hadTrailingSlash = path.length > 1 && path.endsWith("/");
    while (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    if (!path || path === "/") {
      path = fallback;
    }

    return {
      path,
      changed: path !== raw || stripped.hadQueryOrHash,
      hadQueryOrHash: stripped.hadQueryOrHash,
      hadDoubleSlash,
      hadTrailingSlash,
      addedLeadingSlash,
    };
  } catch {
    return {
      path: fallback,
      changed: true,
      hadQueryOrHash: false,
      hadDoubleSlash: false,
      hadTrailingSlash: false,
      addedLeadingSlash: false,
    };
  }
}

function isAbsoluteUrl(value: string): boolean {
  try {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
  } catch {
    return false;
  }
}

function parseUrlLike(value: unknown, options: NormalizedOptions): ParsedUrlLike {
  const raw = normalizeCachedString(value, "", options);

  try {
    if (!raw) {
      return {
        raw,
        isAbsolute: false,
        origin: null,
        protocol: null,
        hostname: null,
        port: null,
        pathname: "",
        search: "",
        hash: "",
      };
    }

    if (isAbsoluteUrl(raw)) {
      const parsed = new URL(raw);
      const normalizedPath = normalizePath(parsed.pathname, options.editorChunkProxyPath);

      return {
        raw,
        isAbsolute: true,
        origin: parsed.origin,
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: normalizedPath.path,
        search: parsed.search,
        hash: parsed.hash,
      };
    }

    const normalizedPath = normalizePath(raw, options.editorChunkProxyPath);

    return {
      raw,
      isAbsolute: false,
      origin: null,
      protocol: null,
      hostname: null,
      port: null,
      pathname: normalizedPath.path,
      search: "",
      hash: "",
    };
  } catch {
    return {
      raw,
      isAbsolute: false,
      origin: null,
      protocol: null,
      hostname: null,
      port: null,
      pathname: "",
      search: "",
      hash: "",
    };
  }
}

function normalizeOptions(options?: EditorChunkProxyUrlOptions | null): NormalizedOptions {
  try {
    const maxCacheEntries = safeInteger(
      options?.maxCacheEntries,
      DEFAULT_MAX_EDITOR_CHUNK_PROXY_URL_CACHE_ENTRIES,
      32,
      10_000,
    );

    const currentOrigin = normalizeOrigin(options?.currentOrigin) ?? getWindowCurrentOrigin();

    const editorPublicOrigins = normalizeOriginArray(options?.editorPublicOrigins);
    const appPublicOrigins = normalizeOriginArray(options?.appPublicOrigins);

    return {
      defaultBaseUrl: normalizePath(options?.defaultBaseUrl, DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL).path,
      editorChunkProxyPath: normalizePath(options?.editorChunkProxyPath, DEFAULT_EDITOR_CHUNK_PROXY_PATH).path,
      currentOrigin,
      editorPublicOrigins,
      appPublicOrigins,
      editorPublicPorts: normalizePortArray(options?.editorPublicPorts, DEFAULT_EDITOR_PUBLIC_PORTS),
      appPublicPorts: normalizePortArray(options?.appPublicPorts, DEFAULT_APP_PUBLIC_PORTS),
      directChunkServicePorts: normalizePortArray(
        options?.directChunkServicePorts,
        DEFAULT_DIRECT_CHUNK_SERVICE_PORTS,
      ),
      forceRelativeEditorProxy: safeBoolean(options?.forceRelativeEditorProxy, true),
      allowAbsoluteEditorProxyOnCurrentOrigin: safeBoolean(
        options?.allowAbsoluteEditorProxyOnCurrentOrigin,
        true,
      ),
      allowAbsoluteEditorProxyOnForeignOrigin: safeBoolean(
        options?.allowAbsoluteEditorProxyOnForeignOrigin,
        false,
      ),
      allowDirectChunkServiceUrl: safeBoolean(options?.allowDirectChunkServiceUrl, false),
      freezeResults: safeBoolean(options?.freezeResults, true),
      useCache: safeBoolean(options?.useCache, true),
      maxCacheEntries,
    };
  } catch {
    return {
      defaultBaseUrl: DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL,
      editorChunkProxyPath: DEFAULT_EDITOR_CHUNK_PROXY_PATH,
      currentOrigin: getWindowCurrentOrigin(),
      editorPublicOrigins: [],
      appPublicOrigins: [],
      editorPublicPorts: [...DEFAULT_EDITOR_PUBLIC_PORTS],
      appPublicPorts: [...DEFAULT_APP_PUBLIC_PORTS],
      directChunkServicePorts: [...DEFAULT_DIRECT_CHUNK_SERVICE_PORTS],
      forceRelativeEditorProxy: true,
      allowAbsoluteEditorProxyOnCurrentOrigin: true,
      allowAbsoluteEditorProxyOnForeignOrigin: false,
      allowDirectChunkServiceUrl: false,
      freezeResults: true,
      useCache: true,
      maxCacheEntries: DEFAULT_MAX_EDITOR_CHUNK_PROXY_URL_CACHE_ENTRIES,
    };
  }
}

function sameOrigin(left: string | null, right: string | null): boolean {
  try {
    return Boolean(left && right && normalizeOrigin(left) === normalizeOrigin(right));
  } catch {
    return false;
  }
}

function portOfOrigin(origin: string | null): string {
  try {
    if (!origin) {
      return "";
    }

    return new URL(origin).port;
  } catch {
    return "";
  }
}

function pathMatchesEditorChunkProxy(pathname: string, options: NormalizedOptions): boolean {
  try {
    const normalizedPath = normalizePath(pathname, options.editorChunkProxyPath).path;
    const proxyPath = normalizePath(options.editorChunkProxyPath, DEFAULT_EDITOR_CHUNK_PROXY_PATH).path;

    return normalizedPath === proxyPath || normalizedPath.endsWith(proxyPath);
  } catch {
    return false;
  }
}

function classifyKnownOrigin(input: {
  readonly origin: string | null;
  readonly currentOrigin: string | null;
  readonly options: NormalizedOptions;
}): {
  readonly isCurrentOrigin: boolean;
  readonly isKnownAppOrigin: boolean;
  readonly isKnownEditorOrigin: boolean;
  readonly isKnownDirectChunkOrigin: boolean;
  readonly isForeignOrigin: boolean;
} {
  try {
    const origin = normalizeOrigin(input.origin);
    const currentOrigin = normalizeOrigin(input.currentOrigin);

    const port = portOfOrigin(origin);
    const isCurrentOrigin = sameOrigin(origin, currentOrigin);

    const isKnownAppOrigin =
      Boolean(origin && input.options.appPublicOrigins.some((item) => sameOrigin(item, origin)))
      || Boolean(port && input.options.appPublicPorts.includes(port));

    const isKnownEditorOrigin =
      isCurrentOrigin
      || Boolean(origin && input.options.editorPublicOrigins.some((item) => sameOrigin(item, origin)))
      || Boolean(port && input.options.editorPublicPorts.includes(port));

    const isKnownDirectChunkOrigin =
      Boolean(port && input.options.directChunkServicePorts.includes(port));

    const isForeignOrigin = Boolean(origin && currentOrigin && !sameOrigin(origin, currentOrigin));

    return {
      isCurrentOrigin,
      isKnownAppOrigin,
      isKnownEditorOrigin,
      isKnownDirectChunkOrigin,
      isForeignOrigin,
    };
  } catch {
    return {
      isCurrentOrigin: false,
      isKnownAppOrigin: false,
      isKnownEditorOrigin: false,
      isKnownDirectChunkOrigin: false,
      isForeignOrigin: false,
    };
  }
}

function looksLikeDirectChunkServicePath(pathname: string): boolean {
  try {
    const path = normalizePath(pathname, "/").path;

    return (
      path === "/"
      || path === "/projects"
      || path === "/chunks"
      || path === "/commands"
      || path === "/worlds"
      || path === "/blocks"
      || path.startsWith("/projects/")
      || path.startsWith("/chunks/")
      || path.startsWith("/commands/")
      || path.startsWith("/worlds/")
      || path.startsWith("/blocks/")
    );
  } catch {
    return false;
  }
}

function makeResult(input: {
  readonly options: NormalizedOptions;
  readonly status: EditorChunkProxyUrlStatus;
  readonly urlKind: EditorChunkProxyUrlKind;
  readonly raw: string;
  readonly normalized: string;
  readonly isRelative: boolean;
  readonly isAbsolute: boolean;
  readonly isEditorProxy: boolean;
  readonly isDirectChunkServiceUrl: boolean;
  readonly isForeignOrigin: boolean;
  readonly isKnownAppOrigin: boolean;
  readonly isKnownEditorOrigin: boolean;
  readonly origin: string | null;
  readonly pathname: string;
  readonly usedFallback: boolean;
  readonly rejected: boolean;
  readonly issues: readonly EditorChunkProxyUrlIssue[];
}): EditorChunkProxyUrlResult {
  const result: EditorChunkProxyUrlResult = {
    kind: EDITOR_CHUNK_PROXY_URL_KIND,
    version: EDITOR_CHUNK_PROXY_URL_VERSION,
    status: input.status,
    urlKind: input.urlKind,
    raw: input.raw,
    normalized: input.normalized,
    baseUrl: input.normalized,
    isValid: !input.rejected && input.status !== "invalid",
    isRelative: input.isRelative,
    isAbsolute: input.isAbsolute,
    isEditorProxy: input.isEditorProxy,
    isDirectChunkServiceUrl: input.isDirectChunkServiceUrl,
    isForeignOrigin: input.isForeignOrigin,
    isKnownAppOrigin: input.isKnownAppOrigin,
    isKnownEditorOrigin: input.isKnownEditorOrigin,
    origin: input.origin,
    currentOrigin: input.options.currentOrigin,
    pathname: input.pathname,
    usedFallback: input.usedFallback,
    rejected: input.rejected,
    issues: freezeArrayIfRequested(input.issues, input.options),
  };

  return freezeIfRequested(result, input.options);
}

function fallbackResult(input: {
  readonly options: NormalizedOptions;
  readonly raw: string;
  readonly urlKind: EditorChunkProxyUrlKind;
  readonly rejected: boolean;
  readonly issues: readonly EditorChunkProxyUrlIssue[];
  readonly origin?: string | null;
  readonly pathname?: string;
  readonly isAbsolute?: boolean;
  readonly isForeignOrigin?: boolean;
  readonly isKnownAppOrigin?: boolean;
  readonly isKnownEditorOrigin?: boolean;
}): EditorChunkProxyUrlResult {
  const fallback = input.options.defaultBaseUrl || DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL;
  const issues = [
    ...input.issues,
    createIssue({
      code: "fallback_used",
      severity: input.rejected ? "error" : "warning",
      message: "Editor chunk proxy URL fallback was used.",
      value: fallback,
    }),
  ];

  return makeResult({
    options: input.options,
    status: input.rejected ? "invalid" : "degraded",
    urlKind: input.urlKind,
    raw: input.raw,
    normalized: fallback,
    isRelative: true,
    isAbsolute: Boolean(input.isAbsolute),
    isEditorProxy: true,
    isDirectChunkServiceUrl: false,
    isForeignOrigin: Boolean(input.isForeignOrigin),
    isKnownAppOrigin: Boolean(input.isKnownAppOrigin),
    isKnownEditorOrigin: Boolean(input.isKnownEditorOrigin),
    origin: input.origin ?? null,
    pathname: input.pathname ?? fallback,
    usedFallback: true,
    rejected: input.rejected,
    issues,
  });
}

function issuesFromPathNormalization(
  raw: string,
  normalizedPath: ReturnType<typeof normalizePath>,
): EditorChunkProxyUrlIssue[] {
  const issues: EditorChunkProxyUrlIssue[] = [];

  try {
    if (normalizedPath.hadQueryOrHash) {
      issues.push(createIssue({
        code: "query_or_hash_removed",
        severity: "warning",
        message: "Query or hash was removed from editor chunk proxy base URL.",
        value: raw,
      }));
    }

    if (normalizedPath.hadDoubleSlash) {
      issues.push(createIssue({
        code: "double_slash_normalized",
        severity: "warning",
        message: "Repeated slashes were normalized in editor chunk proxy path.",
        value: raw,
        details: {
          normalizedPath: normalizedPath.path,
        },
      }));
    }

    if (normalizedPath.hadTrailingSlash) {
      issues.push(createIssue({
        code: "trailing_slash_removed",
        severity: "info",
        message: "Trailing slash was removed from editor chunk proxy path.",
        value: raw,
        details: {
          normalizedPath: normalizedPath.path,
        },
      }));
    }

    if (normalizedPath.addedLeadingSlash) {
      issues.push(createIssue({
        code: "missing_leading_slash_added",
        severity: "info",
        message: "Missing leading slash was added to editor chunk proxy path.",
        value: raw,
        details: {
          normalizedPath: normalizedPath.path,
        },
      }));
    }
  } catch {
    // Ignore path normalization diagnostics.
  }

  return issues;
}

export function resolveEditorChunkProxyBaseUrl(
  value: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): EditorChunkProxyUrlResult {
  const opts = normalizeOptions(options);
  const raw = normalizeCachedString(value, "", opts);
  const key = cacheKey("resolve", raw, opts);

  return rememberCache(RESULT_CACHE, key, opts, () => {
    const issues: EditorChunkProxyUrlIssue[] = [];

    try {
      if (!raw) {
        return fallbackResult({
          options: opts,
          raw,
          urlKind: "empty",
          rejected: false,
          issues: [
            createIssue({
              code: "empty_value",
              severity: "warning",
              message: "Editor chunk proxy URL was empty.",
              value: raw,
            }),
          ],
        });
      }

      const parsed = parseUrlLike(raw, opts);
      const currentOriginInfo = classifyKnownOrigin({
        origin: parsed.origin,
        currentOrigin: opts.currentOrigin,
        options: opts,
      });

      const pathNormalization = normalizePath(parsed.pathname || raw, opts.editorChunkProxyPath);
      issues.push(...issuesFromPathNormalization(raw, pathNormalization));

      const protocol = parsed.protocol ?? "";
      if (parsed.isAbsolute && protocol !== "http:" && protocol !== "https:") {
        return fallbackResult({
          options: opts,
          raw,
          urlKind: "invalid",
          rejected: true,
          origin: parsed.origin,
          pathname: parsed.pathname,
          isAbsolute: true,
          isForeignOrigin: currentOriginInfo.isForeignOrigin,
          isKnownAppOrigin: currentOriginInfo.isKnownAppOrigin,
          isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
          issues: [
            ...issues,
            createIssue({
              code: "unsafe_protocol_rejected",
              severity: "error",
              message: "Only http/https editor chunk proxy URLs are allowed.",
              value: raw,
              details: {
                protocol,
              },
            }),
          ],
        });
      }

      const isEditorProxy = pathMatchesEditorChunkProxy(pathNormalization.path, opts);
      const isDirectChunkService =
        !isEditorProxy
        && (
          looksLikeDirectChunkServicePath(pathNormalization.path)
          || currentOriginInfo.isKnownDirectChunkOrigin
        );

      if (!parsed.isAbsolute) {
        if (isEditorProxy) {
          const status: EditorChunkProxyUrlStatus = pathNormalization.changed ? "normalized" : "valid";
          const issueCode: EditorChunkProxyUrlIssueCode = pathNormalization.changed
            ? "relative_editor_proxy_normalized"
            : "relative_editor_proxy_accepted";

          return makeResult({
            options: opts,
            status,
            urlKind: "relative_editor_proxy",
            raw,
            normalized: opts.editorChunkProxyPath,
            isRelative: true,
            isAbsolute: false,
            isEditorProxy: true,
            isDirectChunkServiceUrl: false,
            isForeignOrigin: false,
            isKnownAppOrigin: false,
            isKnownEditorOrigin: true,
            origin: null,
            pathname: opts.editorChunkProxyPath,
            usedFallback: false,
            rejected: false,
            issues: [
              ...issues,
              createIssue({
                code: issueCode,
                severity: "info",
                message: pathNormalization.changed
                  ? "Relative editor chunk proxy URL was normalized."
                  : "Relative editor chunk proxy URL was accepted.",
                value: raw,
                details: {
                  normalized: opts.editorChunkProxyPath,
                },
              }),
            ],
          });
        }

        if (opts.allowDirectChunkServiceUrl && isDirectChunkService) {
          return makeResult({
            options: opts,
            status: "degraded",
            urlKind: "direct_chunk_service",
            raw,
            normalized: pathNormalization.path,
            isRelative: true,
            isAbsolute: false,
            isEditorProxy: false,
            isDirectChunkServiceUrl: true,
            isForeignOrigin: false,
            isKnownAppOrigin: false,
            isKnownEditorOrigin: false,
            origin: null,
            pathname: pathNormalization.path,
            usedFallback: false,
            rejected: false,
            issues: [
              ...issues,
              createIssue({
                code: "direct_chunk_service_url_accepted",
                severity: "warning",
                message: "Relative direct chunk-service-like URL was accepted by explicit option.",
                value: raw,
              }),
            ],
          });
        }

        return fallbackResult({
          options: opts,
          raw,
          urlKind: "non_editor_proxy",
          rejected: true,
          pathname: pathNormalization.path,
          issues: [
            ...issues,
            createIssue({
              code: "relative_non_editor_proxy_url_rejected",
              severity: "error",
              message: "Relative URL is not the editor chunk proxy path.",
              value: raw,
              details: {
                expectedPath: opts.editorChunkProxyPath,
                receivedPath: pathNormalization.path,
              },
            }),
          ],
        });
      }

      if (isEditorProxy) {
        if (currentOriginInfo.isKnownAppOrigin) {
          return fallbackResult({
            options: opts,
            raw,
            urlKind: "app_origin_editor_proxy",
            rejected: true,
            origin: parsed.origin,
            pathname: pathNormalization.path,
            isAbsolute: true,
            isForeignOrigin: currentOriginInfo.isForeignOrigin,
            isKnownAppOrigin: true,
            isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
            issues: [
              ...issues,
              createIssue({
                code: currentOriginInfo.isKnownAppOrigin && parsed.port && opts.appPublicPorts.includes(parsed.port)
                  ? "known_app_port_editor_proxy_rejected"
                  : "app_origin_editor_proxy_rejected",
                severity: "error",
                message: "Editor chunk proxy URL points to a known app origin. The editor must use its own proxy.",
                value: raw,
                details: {
                  origin: parsed.origin,
                  currentOrigin: opts.currentOrigin,
                  appPublicPorts: opts.appPublicPorts,
                },
              }),
            ],
          });
        }

        if (currentOriginInfo.isForeignOrigin && !opts.allowAbsoluteEditorProxyOnForeignOrigin) {
          return fallbackResult({
            options: opts,
            raw,
            urlKind: "foreign_editor_proxy",
            rejected: true,
            origin: parsed.origin,
            pathname: pathNormalization.path,
            isAbsolute: true,
            isForeignOrigin: true,
            isKnownAppOrigin: currentOriginInfo.isKnownAppOrigin,
            isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
            issues: [
              ...issues,
              createIssue({
                code: "absolute_foreign_editor_proxy_rejected",
                severity: "error",
                message: "Foreign-origin editor chunk proxy URL was rejected.",
                value: raw,
                details: {
                  origin: parsed.origin,
                  currentOrigin: opts.currentOrigin,
                },
              }),
            ],
          });
        }

        if (currentOriginInfo.isCurrentOrigin && !opts.allowAbsoluteEditorProxyOnCurrentOrigin) {
          return fallbackResult({
            options: opts,
            raw,
            urlKind: "absolute_editor_proxy",
            rejected: true,
            origin: parsed.origin,
            pathname: pathNormalization.path,
            isAbsolute: true,
            isForeignOrigin: false,
            isKnownAppOrigin: false,
            isKnownEditorOrigin: true,
            issues: [
              ...issues,
              createIssue({
                code: "absolute_non_editor_proxy_url_rejected",
                severity: "error",
                message: "Absolute editor chunk proxy URL was rejected by configuration.",
                value: raw,
              }),
            ],
          });
        }

        if (opts.forceRelativeEditorProxy || currentOriginInfo.isCurrentOrigin) {
          return makeResult({
            options: opts,
            status: "normalized",
            urlKind: "absolute_editor_proxy",
            raw,
            normalized: opts.editorChunkProxyPath,
            isRelative: true,
            isAbsolute: true,
            isEditorProxy: true,
            isDirectChunkServiceUrl: false,
            isForeignOrigin: currentOriginInfo.isForeignOrigin,
            isKnownAppOrigin: false,
            isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
            origin: parsed.origin,
            pathname: pathNormalization.path,
            usedFallback: false,
            rejected: false,
            issues: [
              ...issues,
              createIssue({
                code: currentOriginInfo.isCurrentOrigin
                  ? "absolute_current_origin_editor_proxy_normalized_to_relative"
                  : "absolute_editor_proxy_accepted",
                severity: currentOriginInfo.isCurrentOrigin ? "info" : "warning",
                message: "Absolute editor chunk proxy URL was normalized to the relative editor proxy path.",
                value: raw,
                details: {
                  normalized: opts.editorChunkProxyPath,
                },
              }),
            ],
          });
        }

        return makeResult({
          options: opts,
          status: currentOriginInfo.isForeignOrigin ? "degraded" : "valid",
          urlKind: "absolute_editor_proxy",
          raw,
          normalized: `${parsed.origin}${pathNormalization.path}`,
          isRelative: false,
          isAbsolute: true,
          isEditorProxy: true,
          isDirectChunkServiceUrl: false,
          isForeignOrigin: currentOriginInfo.isForeignOrigin,
          isKnownAppOrigin: false,
          isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
          origin: parsed.origin,
          pathname: pathNormalization.path,
          usedFallback: false,
          rejected: false,
          issues: [
            ...issues,
            createIssue({
              code: currentOriginInfo.isCurrentOrigin
                ? "absolute_current_origin_editor_proxy_accepted"
                : "absolute_editor_proxy_accepted",
              severity: currentOriginInfo.isCurrentOrigin ? "info" : "warning",
              message: "Absolute editor chunk proxy URL was accepted.",
              value: raw,
            }),
          ],
        });
      }

      if (isDirectChunkService) {
        if (opts.allowDirectChunkServiceUrl) {
          return makeResult({
            options: opts,
            status: "degraded",
            urlKind: "direct_chunk_service",
            raw,
            normalized: `${parsed.origin}${pathNormalization.path === "/" ? "" : pathNormalization.path}`,
            isRelative: false,
            isAbsolute: true,
            isEditorProxy: false,
            isDirectChunkServiceUrl: true,
            isForeignOrigin: currentOriginInfo.isForeignOrigin,
            isKnownAppOrigin: currentOriginInfo.isKnownAppOrigin,
            isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
            origin: parsed.origin,
            pathname: pathNormalization.path,
            usedFallback: false,
            rejected: false,
            issues: [
              ...issues,
              createIssue({
                code: "direct_chunk_service_url_accepted",
                severity: "warning",
                message: "Direct chunk service URL was accepted by explicit option.",
                value: raw,
                details: {
                  editorProxyPreferred: opts.editorChunkProxyPath,
                },
              }),
            ],
          });
        }

        return fallbackResult({
          options: opts,
          raw,
          urlKind: "direct_chunk_service",
          rejected: true,
          origin: parsed.origin,
          pathname: pathNormalization.path,
          isAbsolute: true,
          isForeignOrigin: currentOriginInfo.isForeignOrigin,
          isKnownAppOrigin: currentOriginInfo.isKnownAppOrigin,
          isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
          issues: [
            ...issues,
            createIssue({
              code: "direct_chunk_service_url_rejected",
              severity: "error",
              message: "Direct chunk service URL was rejected. Browser runtime must use the editor chunk proxy.",
              value: raw,
              details: {
                editorProxyPreferred: opts.editorChunkProxyPath,
              },
            }),
          ],
        });
      }

      return fallbackResult({
        options: opts,
        raw,
        urlKind: "non_editor_proxy",
        rejected: true,
        origin: parsed.origin,
        pathname: pathNormalization.path,
        isAbsolute: true,
        isForeignOrigin: currentOriginInfo.isForeignOrigin,
        isKnownAppOrigin: currentOriginInfo.isKnownAppOrigin,
        isKnownEditorOrigin: currentOriginInfo.isKnownEditorOrigin,
        issues: [
          ...issues,
          createIssue({
            code: "absolute_non_editor_proxy_url_rejected",
            severity: "error",
            message: "Absolute URL is not an editor chunk proxy URL.",
            value: raw,
            details: {
              expectedPath: opts.editorChunkProxyPath,
              receivedPath: pathNormalization.path,
              origin: parsed.origin,
            },
          }),
        ],
      });
    } catch (error) {
      return fallbackResult({
        options: opts,
        raw,
        urlKind: "invalid",
        rejected: true,
        issues: [
          ...issues,
          createIssue({
            code: "unexpected_error",
            severity: "error",
            message: "Unexpected editor chunk proxy URL resolution error.",
            value: raw,
            details: {
              error: error instanceof Error ? error.message : String(error),
            },
          }),
        ],
      });
    }
  });
}

export function normalizeEditorChunkProxyBaseUrl(
  value: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): string {
  try {
    return resolveEditorChunkProxyBaseUrl(value, options).baseUrl;
  } catch {
    return DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL;
  }
}

export function isEditorChunkProxyBaseUrl(
  value: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): boolean {
  try {
    const result = resolveEditorChunkProxyBaseUrl(value, options);

    return result.isEditorProxy && !result.rejected;
  } catch {
    return false;
  }
}

export function isAppOriginEditorChunkProxyUrl(
  value: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): boolean {
  try {
    const result = resolveEditorChunkProxyBaseUrl(value, options);

    return result.urlKind === "app_origin_editor_proxy" || result.isKnownAppOrigin;
  } catch {
    return false;
  }
}

export function shouldUseRelativeEditorChunkProxy(
  value: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): boolean {
  try {
    const result = resolveEditorChunkProxyBaseUrl(value, {
      ...(options ?? {}),
      forceRelativeEditorProxy: true,
    });

    return result.baseUrl === DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL || result.isRelative;
  } catch {
    return true;
  }
}

export function joinEditorChunkProxyPath(
  baseUrl: unknown,
  segments: readonly unknown[],
  options?: EditorChunkProxyUrlOptions | null,
): string {
  try {
    const base = normalizeEditorChunkProxyBaseUrl(baseUrl, options);
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const cleanSegments = segments
      .map((segment) => safeString(segment, ""))
      .filter((segment) => segment.length > 0)
      .map((segment) => encodeURIComponent(segment.replace(/^\/+|\/+$/g, "")));

    if (cleanSegments.length === 0) {
      return cleanBase;
    }

    return `${cleanBase}/${cleanSegments.join("/")}`;
  } catch {
    return DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL;
  }
}

export function buildEditorChunkProxyProjectRoute(
  baseUrl: unknown,
  projectId: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): string {
  return joinEditorChunkProxyPath(baseUrl, ["projects", projectId], options);
}

export function buildEditorChunkProxyWorldRoute(
  baseUrl: unknown,
  projectId: unknown,
  worldId: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): string {
  return joinEditorChunkProxyPath(baseUrl, ["projects", projectId, "worlds", worldId], options);
}

export function buildEditorChunkProxyChunksBatchRoute(
  baseUrl: unknown,
  projectId: unknown,
  worldId: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): string {
  return joinEditorChunkProxyPath(baseUrl, ["projects", projectId, "worlds", worldId, "chunks", "batch"], options);
}

export function buildEditorChunkProxyChunkRoute(
  baseUrl: unknown,
  projectId: unknown,
  worldId: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): string {
  return joinEditorChunkProxyPath(baseUrl, ["projects", projectId, "worlds", worldId, "chunks"], options);
}

export function buildEditorChunkProxyCommandsRoute(
  baseUrl: unknown,
  projectId: unknown,
  worldId: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): string {
  return joinEditorChunkProxyPath(baseUrl, ["projects", projectId, "worlds", worldId, "commands"], options);
}

export function buildEditorChunkProxyBlocksRoute(
  baseUrl: unknown,
  projectId: unknown,
  worldId: unknown,
  options?: EditorChunkProxyUrlOptions | null,
): string {
  return joinEditorChunkProxyPath(baseUrl, ["projects", projectId, "worlds", worldId, "blocks"], options);
}

export function editorChunkProxyUrlIssuesToWarnings(
  issues: readonly EditorChunkProxyUrlIssue[],
): readonly string[] {
  try {
    return issues
      .filter((issue) => issue.severity === "warning" || issue.severity === "error")
      .map((issue) => {
        const value = issue.value ? ` value=${issue.value}` : "";
        return `${issue.code}: ${issue.message}${value}`;
      });
  } catch {
    return ["editor_chunk_proxy_url_issues_to_warnings_failed"];
  }
}

export function editorChunkProxyUrlResultToRecord(
  result: EditorChunkProxyUrlResult,
): UnknownRecord {
  try {
    return {
      kind: result.kind,
      version: result.version,
      status: result.status,
      urlKind: result.urlKind,
      raw: result.raw,
      normalized: result.normalized,
      baseUrl: result.baseUrl,
      isValid: result.isValid,
      isRelative: result.isRelative,
      isAbsolute: result.isAbsolute,
      isEditorProxy: result.isEditorProxy,
      isDirectChunkServiceUrl: result.isDirectChunkServiceUrl,
      isForeignOrigin: result.isForeignOrigin,
      isKnownAppOrigin: result.isKnownAppOrigin,
      isKnownEditorOrigin: result.isKnownEditorOrigin,
      origin: result.origin,
      currentOrigin: result.currentOrigin,
      pathname: result.pathname,
      usedFallback: result.usedFallback,
      rejected: result.rejected,
      issues: result.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        value: issue.value,
        details: issue.details,
      })),
    };
  } catch {
    return {
      kind: EDITOR_CHUNK_PROXY_URL_KIND,
      status: "invalid",
      error: "editor_chunk_proxy_url_result_to_record_failed",
    };
  }
}

export function clearEditorChunkProxyUrlCaches(): void {
  try {
    STRING_CACHE.clear();
    RESULT_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

export function getEditorChunkProxyUrlCacheStats(): Record<string, number> {
  try {
    return {
      stringCacheSize: STRING_CACHE.size,
      resultCacheSize: RESULT_CACHE.size,
    };
  } catch {
    return {
      stringCacheSize: 0,
      resultCacheSize: 0,
    };
  }
}

export function getEditorChunkProxyUrlMetadata(): EditorChunkProxyUrlDebugSummary {
  return {
    kind: EDITOR_CHUNK_PROXY_URL_KIND,
    version: EDITOR_CHUNK_PROXY_URL_VERSION,
    defaultEditorChunkProxyBaseUrl: DEFAULT_EDITOR_CHUNK_PROXY_BASE_URL,
    rules: {
      browserUsesEditorProxy: true,
      appOriginEditorProxyRejected: true,
      foreignEditorProxyRejectedByDefault: true,
      directChunkServiceRejectedByDefault: true,
      relativeEditorProxyPreferred: true,
      doubleSlashNormalized: true,
    },
  };
}