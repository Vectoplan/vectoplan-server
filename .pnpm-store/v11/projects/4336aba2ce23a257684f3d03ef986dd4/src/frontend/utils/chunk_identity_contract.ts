// services/vectoplan-editor/src/frontend/utils/chunk_identity_contract.ts

/**
 * Central contract for separating VECTOPLAN app project identities from
 * vectoplan-chunk runtime identities.
 *
 * Hard invariant:
 *
 *   appProjectPublicId / projectPublicId = prj_...
 *   chunkProjectId / runtime.chunk.projectId = chk_prj_...
 *   chunkWorldId / runtime.chunk.worldId = concrete world id, usually world_spawn
 *
 * A prj_... value must never be used to build:
 *
 *   /projects/<id>/worlds/<world>/chunks
 *   /projects/<id>/worlds/<world>/chunks/batch
 *   /projects/<id>/worlds/<world>/commands
 */

export const CHUNK_IDENTITY_CONTRACT_KIND = "vectoplan-editor-chunk-identity-contract.v1" as const;
export const CHUNK_IDENTITY_CONTRACT_VERSION = "1.0.0" as const;

export const DEFAULT_CHUNK_PROJECT_PREFIX = "chk_prj_" as const;
export const DEFAULT_APP_PROJECT_PREFIX = "prj_" as const;
export const DEFAULT_DEV_CHUNK_PROJECT_ID = "dev-project" as const;
export const DEFAULT_CHUNK_WORLD_ID = "world_spawn" as const;
export const DEFAULT_CHUNK_UNIVERSE_ID = "dev-universe" as const;

export const DEFAULT_PROVIDER_LIKE_WORLD_IDS = [
  "flat",
  "template",
  "provider",
  "provider_world",
  "default-provider",
] as const;

export const DEFAULT_MAX_CONTRACT_CACHE_ENTRIES = 512;

export type ChunkIdentityIssueSeverity =
  | "info"
  | "warning"
  | "error";

export type ChunkIdentityIssueCode =
  | "empty_value"
  | "invalid_value"
  | "invalid_characters_removed"
  | "app_project_id_detected"
  | "app_project_id_used_as_chunk_project_id"
  | "chunk_project_id_missing"
  | "chunk_project_id_invalid"
  | "chunk_project_id_from_project_alias"
  | "chunk_project_id_dev_default"
  | "chunk_project_id_unprefixed"
  | "chunk_world_id_missing"
  | "chunk_world_id_invalid"
  | "chunk_world_id_provider_like"
  | "chunk_world_id_defaulted"
  | "chunk_universe_id_missing"
  | "candidate_rejected"
  | "candidate_selected"
  | "identity_valid"
  | "identity_invalid"
  | "identity_degraded"
  | "unexpected_error";

export type ChunkProjectIdKind =
  | "chunk_project"
  | "dev_chunk_project"
  | "app_project_public"
  | "unprefixed_possible_chunk_project"
  | "empty"
  | "invalid";

export type ChunkWorldIdKind =
  | "concrete_world"
  | "provider_like_world"
  | "empty"
  | "invalid";

export type ChunkIdentityCandidateRole =
  | "chunkProjectId"
  | "projectId"
  | "defaultProjectId"
  | "appProjectPublicId"
  | "projectPublicId"
  | "chunkUniverseId"
  | "universeId"
  | "chunkWorldId"
  | "worldId"
  | "defaultWorldId"
  | "routeHint"
  | "unknown";

export type ChunkIdentityResolutionStatus =
  | "valid"
  | "degraded"
  | "invalid";

export type UnknownRecord = Record<string, unknown>;

export interface ChunkIdentityContractOptions {
  readonly chunkProjectPrefix?: string;
  readonly appProjectPrefix?: string;

  /**
   * Allows direct standalone/dev editor usage against dev-project.
   * This must not hide app-project confusion: if prj_... is present and no valid
   * chunk project id exists, resolution remains invalid.
   */
  readonly allowDevProjectId?: boolean;

  readonly devChunkProjectIds?: readonly string[];

  /**
   * Allows project ids that do not start with chk_prj_ as chunk ids.
   * Default false. Keep false for app-integrated editor runtime.
   */
  readonly allowUnprefixedChunkProjectId?: boolean;

  /**
   * Default concrete world id used when no explicit valid world is provided.
   */
  readonly defaultWorldId?: string;

  /**
   * Concrete world ids may be custom in future worlds.
   * `flat` and other provider-like ids are still rejected.
   */
  readonly allowCustomConcreteWorldIds?: boolean;

  readonly providerLikeWorldIds?: readonly string[];

  /**
   * If true, explicit provider-like world ids make the world resolution invalid.
   * If false, provider-like world ids are rejected and replaced by defaultWorldId.
   */
  readonly failOnProviderLikeWorldId?: boolean;

  /**
   * If true, a prj_... value in a chunk project candidate makes the project
   * resolution invalid. This should stay true for the editor runtime.
   */
  readonly failOnAppProjectIdAsChunkProjectId?: boolean;

  /**
   * If true, the result object is shallow-frozen.
   */
  readonly freezeResults?: boolean;

  /**
   * Enables internal memoization for classification and normalization helpers.
   */
  readonly useCache?: boolean;

  /**
   * Max entries per internal cache. The cache is defensive and bounded.
   */
  readonly maxCacheEntries?: number;
}

export interface ChunkIdentityIssue {
  readonly code: ChunkIdentityIssueCode;
  readonly severity: ChunkIdentityIssueSeverity;
  readonly message: string;
  readonly source: string | null;
  readonly role: ChunkIdentityCandidateRole | null;
  readonly value: string | null;
  readonly details: UnknownRecord | null;
}

export interface ChunkIdentityCandidate {
  readonly value: unknown;
  readonly source?: string | null;
  readonly role?: ChunkIdentityCandidateRole | string | null;
  readonly trusted?: boolean;
}

export interface ClassifiedProjectId {
  readonly kind: ChunkProjectIdKind;
  readonly raw: string;
  readonly normalized: string;
  readonly validAsChunkProjectId: boolean;
  readonly validAsAppProjectPublicId: boolean;
  readonly isLikelyAppProjectId: boolean;
  readonly isLikelyChunkProjectId: boolean;
  readonly isDevChunkProjectId: boolean;
  readonly issue: ChunkIdentityIssue | null;
}

export interface ClassifiedWorldId {
  readonly kind: ChunkWorldIdKind;
  readonly raw: string;
  readonly normalized: string;
  readonly validAsConcreteWorldId: boolean;
  readonly isProviderLikeWorldId: boolean;
  readonly issue: ChunkIdentityIssue | null;
}

export interface RejectedChunkIdentityCandidate {
  readonly candidate: ChunkIdentityCandidate;
  readonly normalizedValue: string;
  readonly reason: ChunkIdentityIssueCode;
  readonly message: string;
}

export interface ChunkProjectIdResolution {
  readonly ok: boolean;
  readonly status: ChunkIdentityResolutionStatus;
  readonly value: string | null;
  readonly chunkProjectId: string | null;
  readonly appProjectPublicId: string | null;
  readonly selectedSource: string | null;
  readonly selectedRole: ChunkIdentityCandidateRole | null;
  readonly selectedKind: ChunkProjectIdKind | null;
  readonly rejectedCandidates: readonly RejectedChunkIdentityCandidate[];
  readonly issues: readonly ChunkIdentityIssue[];
}

export interface ChunkWorldIdResolution {
  readonly ok: boolean;
  readonly status: ChunkIdentityResolutionStatus;
  readonly value: string | null;
  readonly chunkWorldId: string | null;
  readonly selectedSource: string | null;
  readonly selectedRole: ChunkIdentityCandidateRole | null;
  readonly selectedKind: ChunkWorldIdKind | null;
  readonly rejectedCandidates: readonly RejectedChunkIdentityCandidate[];
  readonly issues: readonly ChunkIdentityIssue[];
}

export interface ChunkUniverseIdResolution {
  readonly ok: boolean;
  readonly status: ChunkIdentityResolutionStatus;
  readonly value: string | null;
  readonly chunkUniverseId: string | null;
  readonly selectedSource: string | null;
  readonly selectedRole: ChunkIdentityCandidateRole | null;
  readonly issues: readonly ChunkIdentityIssue[];
}

export interface ResolveChunkProjectIdInput {
  readonly chunkProjectIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly projectIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly appProjectIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly fallbackCandidates?: readonly ChunkIdentityCandidate[];
}

export interface ResolveChunkWorldIdInput {
  readonly chunkWorldIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly worldIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly fallbackCandidates?: readonly ChunkIdentityCandidate[];
}

export interface ResolveChunkUniverseIdInput {
  readonly chunkUniverseIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly universeIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly fallbackCandidates?: readonly ChunkIdentityCandidate[];
}

export interface ResolveChunkIdentityInput {
  readonly chunkProjectId?: unknown;
  readonly chunkServiceProjectId?: unknown;
  readonly projectId?: unknown;
  readonly defaultProjectId?: unknown;
  readonly appProjectPublicId?: unknown;
  readonly projectPublicId?: unknown;

  readonly chunkUniverseId?: unknown;
  readonly chunkServiceUniverseId?: unknown;
  readonly universeId?: unknown;
  readonly defaultUniverseId?: unknown;

  readonly chunkWorldId?: unknown;
  readonly chunkServiceWorldId?: unknown;
  readonly worldId?: unknown;
  readonly defaultWorldId?: unknown;

  readonly chunkReady?: unknown;
  readonly ready?: unknown;
  readonly chunkStatus?: unknown;
  readonly status?: unknown;

  readonly source?: string | null;

  readonly chunkProjectIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly projectIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly appProjectIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly chunkUniverseIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly universeIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly chunkWorldIdCandidates?: readonly ChunkIdentityCandidate[];
  readonly worldIdCandidates?: readonly ChunkIdentityCandidate[];
}

export interface CanonicalChunkIdentity {
  readonly kind: typeof CHUNK_IDENTITY_CONTRACT_KIND;
  readonly status: ChunkIdentityResolutionStatus;

  /**
   * Runtime project id for chunk requests.
   * Must be a chunk project id, never an app project public id.
   */
  readonly projectId: string | null;
  readonly chunkProjectId: string | null;

  /**
   * App/project shell ids are kept separately for diagnostics and context.
   */
  readonly appProjectPublicId: string | null;
  readonly projectPublicId: string | null;

  readonly universeId: string | null;
  readonly chunkUniverseId: string | null;

  /**
   * Runtime concrete world id for chunk requests.
   */
  readonly worldId: string | null;
  readonly chunkWorldId: string | null;

  readonly chunkReady: boolean;
  readonly ready: boolean;
  readonly chunkStatus: "ready" | "pending" | "error" | "disabled" | "invalid" | string;

  readonly valid: boolean;
  readonly degraded: boolean;

  readonly project: ChunkProjectIdResolution;
  readonly universe: ChunkUniverseIdResolution;
  readonly world: ChunkWorldIdResolution;

  readonly issues: readonly ChunkIdentityIssue[];
  readonly rejectedCandidates: readonly RejectedChunkIdentityCandidate[];
}

export interface ChunkIdentityDebugSummary {
  readonly kind: typeof CHUNK_IDENTITY_CONTRACT_KIND;
  readonly version: typeof CHUNK_IDENTITY_CONTRACT_VERSION;
  readonly rules: {
    readonly appProjectPrefix: string;
    readonly chunkProjectPrefix: string;
    readonly appProjectIdNeverUsedAsChunkProjectId: true;
    readonly runtimeProjectIdIsChunkProjectId: true;
    readonly runtimeWorldIdIsConcreteChunkWorldId: true;
    readonly providerLikeWorldIdsRejected: true;
    readonly prjPrefixIsAppProjectOnly: true;
    readonly chkPrjPrefixIsChunkProject: true;
  };
}

interface NormalizedOptions {
  readonly chunkProjectPrefix: string;
  readonly appProjectPrefix: string;
  readonly allowDevProjectId: boolean;
  readonly devChunkProjectIds: readonly string[];
  readonly allowUnprefixedChunkProjectId: boolean;
  readonly defaultWorldId: string;
  readonly allowCustomConcreteWorldIds: boolean;
  readonly providerLikeWorldIds: readonly string[];
  readonly failOnProviderLikeWorldId: boolean;
  readonly failOnAppProjectIdAsChunkProjectId: boolean;
  readonly freezeResults: boolean;
  readonly useCache: boolean;
  readonly maxCacheEntries: number;
}

const STRING_CACHE = new Map<string, string>();
const IDENTIFIER_CACHE = new Map<string, string>();
const PROJECT_CLASSIFICATION_CACHE = new Map<string, ClassifiedProjectId>();
const WORLD_CLASSIFICATION_CACHE = new Map<string, ClassifiedWorldId>();

function normalizeOptions(options?: ChunkIdentityContractOptions | null): NormalizedOptions {
  try {
    const maxCacheEntries = safeInteger(
      options?.maxCacheEntries,
      DEFAULT_MAX_CONTRACT_CACHE_ENTRIES,
      32,
      10_000,
    );

    return {
      chunkProjectPrefix: safeString(options?.chunkProjectPrefix, DEFAULT_CHUNK_PROJECT_PREFIX),
      appProjectPrefix: safeString(options?.appProjectPrefix, DEFAULT_APP_PROJECT_PREFIX),
      allowDevProjectId: safeBoolean(options?.allowDevProjectId, true),
      devChunkProjectIds: normalizeStringArray(
        options?.devChunkProjectIds,
        [DEFAULT_DEV_CHUNK_PROJECT_ID],
      ),
      allowUnprefixedChunkProjectId: safeBoolean(options?.allowUnprefixedChunkProjectId, false),
      defaultWorldId: sanitizeIdentifier(options?.defaultWorldId, DEFAULT_CHUNK_WORLD_ID, {
        useCache: options?.useCache ?? true,
        maxCacheEntries,
      }),
      allowCustomConcreteWorldIds: safeBoolean(options?.allowCustomConcreteWorldIds, true),
      providerLikeWorldIds: normalizeStringArray(
        options?.providerLikeWorldIds,
        DEFAULT_PROVIDER_LIKE_WORLD_IDS,
      ),
      failOnProviderLikeWorldId: safeBoolean(options?.failOnProviderLikeWorldId, false),
      failOnAppProjectIdAsChunkProjectId: safeBoolean(options?.failOnAppProjectIdAsChunkProjectId, true),
      freezeResults: safeBoolean(options?.freezeResults, true),
      useCache: safeBoolean(options?.useCache, true),
      maxCacheEntries,
    };
  } catch {
    return {
      chunkProjectPrefix: DEFAULT_CHUNK_PROJECT_PREFIX,
      appProjectPrefix: DEFAULT_APP_PROJECT_PREFIX,
      allowDevProjectId: true,
      devChunkProjectIds: [DEFAULT_DEV_CHUNK_PROJECT_ID],
      allowUnprefixedChunkProjectId: false,
      defaultWorldId: DEFAULT_CHUNK_WORLD_ID,
      allowCustomConcreteWorldIds: true,
      providerLikeWorldIds: [...DEFAULT_PROVIDER_LIKE_WORLD_IDS],
      failOnProviderLikeWorldId: false,
      failOnAppProjectIdAsChunkProjectId: true,
      freezeResults: true,
      useCache: true,
      maxCacheEntries: DEFAULT_MAX_CONTRACT_CACHE_ENTRIES,
    };
  }
}

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

    if (["1", "true", "yes", "y", "on", "enabled", "ready", "ok"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off", "disabled", "pending", "error", "failed"].includes(normalized)) {
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
      const text = safeString(item, "");

      if (text.length > 0 && !result.includes(text)) {
        result.push(text);
      }
    }

    return result.length > 0 ? result : [...fallback];
  } catch {
    return [...fallback];
  }
}

function cacheKey(prefix: string, value: unknown, options: NormalizedOptions): string {
  try {
    return [
      prefix,
      safeString(value, ""),
      options.chunkProjectPrefix,
      options.appProjectPrefix,
      String(options.allowDevProjectId),
      String(options.allowUnprefixedChunkProjectId),
      options.devChunkProjectIds.join(","),
      options.providerLikeWorldIds.join(","),
      options.defaultWorldId,
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

function createIssue(input: {
  readonly code: ChunkIdentityIssueCode;
  readonly severity: ChunkIdentityIssueSeverity;
  readonly message: string;
  readonly source?: string | null;
  readonly role?: ChunkIdentityCandidateRole | string | null;
  readonly value?: unknown;
  readonly details?: UnknownRecord | null;
}): ChunkIdentityIssue {
  try {
    return {
      code: input.code,
      severity: input.severity,
      message: input.message,
      source: input.source ?? null,
      role: normalizeCandidateRole(input.role),
      value: safeString(input.value, "") || null,
      details: input.details ?? null,
    };
  } catch {
    return {
      code: "unexpected_error",
      severity: "error",
      message: "Unexpected chunk identity issue creation error.",
      source: null,
      role: null,
      value: null,
      details: null,
    };
  }
}

function normalizeCandidateRole(value: unknown): ChunkIdentityCandidateRole | null {
  try {
    const role = safeString(value, "unknown");

    if (
      role === "chunkProjectId"
      || role === "projectId"
      || role === "defaultProjectId"
      || role === "appProjectPublicId"
      || role === "projectPublicId"
      || role === "chunkUniverseId"
      || role === "universeId"
      || role === "chunkWorldId"
      || role === "worldId"
      || role === "defaultWorldId"
      || role === "routeHint"
      || role === "unknown"
    ) {
      return role;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function createCandidate(
  value: unknown,
  source: string,
  role: ChunkIdentityCandidateRole,
  trusted = false,
): ChunkIdentityCandidate {
  return {
    value,
    source,
    role,
    trusted,
  };
}

function appendCandidate(
  target: ChunkIdentityCandidate[],
  value: unknown,
  source: string,
  role: ChunkIdentityCandidateRole,
  trusted = false,
): void {
  try {
    if (value === undefined || value === null) {
      return;
    }

    const text = safeString(value, "");

    if (!text) {
      return;
    }

    target.push(createCandidate(text, source, role, trusted));
  } catch {
    // Ignore individual candidate failure.
  }
}

function firstNonEmptyString(...values: readonly unknown[]): string {
  try {
    for (const value of values) {
      const normalized = safeString(value, "");

      if (normalized.length > 0) {
        return normalized;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function sanitizeIdentifier(
  value: unknown,
  fallback = "",
  options?: Pick<NormalizedOptions, "useCache" | "maxCacheEntries">,
): string {
  const normalizedOptions: NormalizedOptions = {
    chunkProjectPrefix: DEFAULT_CHUNK_PROJECT_PREFIX,
    appProjectPrefix: DEFAULT_APP_PROJECT_PREFIX,
    allowDevProjectId: true,
    devChunkProjectIds: [DEFAULT_DEV_CHUNK_PROJECT_ID],
    allowUnprefixedChunkProjectId: false,
    defaultWorldId: DEFAULT_CHUNK_WORLD_ID,
    allowCustomConcreteWorldIds: true,
    providerLikeWorldIds: [...DEFAULT_PROVIDER_LIKE_WORLD_IDS],
    failOnProviderLikeWorldId: false,
    failOnAppProjectIdAsChunkProjectId: true,
    freezeResults: false,
    useCache: options?.useCache ?? true,
    maxCacheEntries: options?.maxCacheEntries ?? DEFAULT_MAX_CONTRACT_CACHE_ENTRIES,
  };

  const key = cacheKey("identifier", `${safeString(value, "")}|${fallback}`, normalizedOptions);

  return rememberCache(IDENTIFIER_CACHE, key, normalizedOptions, () => {
    try {
      const raw = safeString(value, fallback);
      const sanitized = raw.replace(/[^a-zA-Z0-9_.:-]/g, "").trim();

      return sanitized.length > 0 ? sanitized : fallback;
    } catch {
      return fallback;
    }
  });
}

function normalizeCachedString(value: unknown, fallback: string, options: NormalizedOptions): string {
  const key = cacheKey("string", `${safeString(value, "")}|${fallback}`, options);

  return rememberCache(STRING_CACHE, key, options, () => safeString(value, fallback));
}

function lower(value: string): string {
  try {
    return value.toLowerCase();
  } catch {
    return value;
  }
}

function isOneOfNormalized(value: string, candidates: readonly string[]): boolean {
  try {
    const normalized = lower(value);

    return candidates.some((candidate) => lower(candidate) === normalized);
  } catch {
    return false;
  }
}

function createRejectedCandidate(
  candidate: ChunkIdentityCandidate,
  normalizedValue: string,
  reason: ChunkIdentityIssueCode,
  message: string,
): RejectedChunkIdentityCandidate {
  return {
    candidate,
    normalizedValue,
    reason,
    message,
  };
}

function normalizeStatus(value: unknown, fallback: string): string {
  try {
    const normalized = safeString(value, "").toLowerCase().replace(/[-\s]+/g, "_");

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

    return fallback;
  } catch {
    return fallback;
  }
}

export function clearChunkIdentityContractCaches(): void {
  try {
    STRING_CACHE.clear();
    IDENTIFIER_CACHE.clear();
    PROJECT_CLASSIFICATION_CACHE.clear();
    WORLD_CLASSIFICATION_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

export function getChunkIdentityContractCacheStats(): Record<string, number> {
  try {
    return {
      stringCacheSize: STRING_CACHE.size,
      identifierCacheSize: IDENTIFIER_CACHE.size,
      projectClassificationCacheSize: PROJECT_CLASSIFICATION_CACHE.size,
      worldClassificationCacheSize: WORLD_CLASSIFICATION_CACHE.size,
    };
  } catch {
    return {
      stringCacheSize: 0,
      identifierCacheSize: 0,
      projectClassificationCacheSize: 0,
      worldClassificationCacheSize: 0,
    };
  }
}

export function isLikelyAppProjectId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): boolean {
  try {
    return classifyProjectId(value, options).isLikelyAppProjectId;
  } catch {
    return false;
  }
}

export function isLikelyChunkProjectId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): boolean {
  try {
    return classifyProjectId(value, options).isLikelyChunkProjectId;
  } catch {
    return false;
  }
}

export function isValidChunkProjectId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): boolean {
  try {
    return classifyProjectId(value, options).validAsChunkProjectId;
  } catch {
    return false;
  }
}

export function isProviderLikeWorldId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): boolean {
  try {
    return classifyWorldId(value, options).isProviderLikeWorldId;
  } catch {
    return false;
  }
}

export function isValidConcreteChunkWorldId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): boolean {
  try {
    return classifyWorldId(value, options).validAsConcreteWorldId;
  } catch {
    return false;
  }
}

export function normalizeChunkProjectIdForContract(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): string {
  try {
    const opts = normalizeOptions(options);
    return sanitizeIdentifier(value, "", opts);
  } catch {
    return "";
  }
}

export function normalizeChunkWorldIdForContract(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): string {
  try {
    const opts = normalizeOptions(options);
    return sanitizeIdentifier(value, "", opts);
  } catch {
    return "";
  }
}

export function classifyProjectId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): ClassifiedProjectId {
  const opts = normalizeOptions(options);
  const raw = normalizeCachedString(value, "", opts);
  const normalized = sanitizeIdentifier(raw, "", opts);
  const key = cacheKey("project-class", normalized, opts);

  return rememberCache(PROJECT_CLASSIFICATION_CACHE, key, opts, () => {
    try {
      if (!normalized) {
        return freezeIfRequested({
          kind: "empty",
          raw,
          normalized,
          validAsChunkProjectId: false,
          validAsAppProjectPublicId: false,
          isLikelyAppProjectId: false,
          isLikelyChunkProjectId: false,
          isDevChunkProjectId: false,
          issue: createIssue({
            code: "empty_value",
            severity: "warning",
            message: "Project id value was empty.",
            value: raw,
          }),
        }, opts);
      }

      if (raw && normalized !== raw) {
        return freezeIfRequested({
          kind: "invalid",
          raw,
          normalized,
          validAsChunkProjectId: false,
          validAsAppProjectPublicId: false,
          isLikelyAppProjectId: false,
          isLikelyChunkProjectId: false,
          isDevChunkProjectId: false,
          issue: createIssue({
            code: "invalid_characters_removed",
            severity: "error",
            message: "Project id contained invalid characters and was rejected.",
            value: raw,
            details: {
              normalized,
            },
          }),
        }, opts);
      }

      const normalizedLower = lower(normalized);
      const chunkPrefixLower = lower(opts.chunkProjectPrefix);
      const appPrefixLower = lower(opts.appProjectPrefix);

      const isChunkProject = normalizedLower.startsWith(chunkPrefixLower);
      const isAppProject =
        normalizedLower.startsWith(appPrefixLower)
        && !normalizedLower.startsWith(chunkPrefixLower);

      const isDevChunkProject =
        opts.allowDevProjectId && isOneOfNormalized(normalized, opts.devChunkProjectIds);

      if (isChunkProject) {
        return freezeIfRequested({
          kind: "chunk_project",
          raw,
          normalized,
          validAsChunkProjectId: true,
          validAsAppProjectPublicId: false,
          isLikelyAppProjectId: false,
          isLikelyChunkProjectId: true,
          isDevChunkProjectId: false,
          issue: null,
        }, opts);
      }

      if (isAppProject) {
        return freezeIfRequested({
          kind: "app_project_public",
          raw,
          normalized,
          validAsChunkProjectId: false,
          validAsAppProjectPublicId: true,
          isLikelyAppProjectId: true,
          isLikelyChunkProjectId: false,
          isDevChunkProjectId: false,
          issue: createIssue({
            code: "app_project_id_detected",
            severity: "error",
            message: "App project public id cannot be used as chunk project id.",
            value: normalized,
            details: {
              expectedChunkProjectPrefix: opts.chunkProjectPrefix,
              appProjectPrefix: opts.appProjectPrefix,
            },
          }),
        }, opts);
      }

      if (isDevChunkProject) {
        return freezeIfRequested({
          kind: "dev_chunk_project",
          raw,
          normalized,
          validAsChunkProjectId: true,
          validAsAppProjectPublicId: false,
          isLikelyAppProjectId: false,
          isLikelyChunkProjectId: true,
          isDevChunkProjectId: true,
          issue: createIssue({
            code: "chunk_project_id_dev_default",
            severity: "info",
            message: "Dev/default chunk project id was accepted.",
            value: normalized,
          }),
        }, opts);
      }

      if (opts.allowUnprefixedChunkProjectId) {
        return freezeIfRequested({
          kind: "unprefixed_possible_chunk_project",
          raw,
          normalized,
          validAsChunkProjectId: true,
          validAsAppProjectPublicId: false,
          isLikelyAppProjectId: false,
          isLikelyChunkProjectId: true,
          isDevChunkProjectId: false,
          issue: createIssue({
            code: "chunk_project_id_unprefixed",
            severity: "warning",
            message: "Unprefixed project id was accepted as chunk project id by explicit option.",
            value: normalized,
            details: {
              expectedChunkProjectPrefix: opts.chunkProjectPrefix,
            },
          }),
        }, opts);
      }

      return freezeIfRequested({
        kind: "invalid",
        raw,
        normalized,
        validAsChunkProjectId: false,
        validAsAppProjectPublicId: false,
        isLikelyAppProjectId: false,
        isLikelyChunkProjectId: false,
        isDevChunkProjectId: false,
        issue: createIssue({
          code: "chunk_project_id_invalid",
          severity: "error",
          message: "Project id is not a valid chunk project id.",
          value: normalized,
          details: {
            expectedChunkProjectPrefix: opts.chunkProjectPrefix,
            allowedDevProjectIds: opts.allowDevProjectId ? opts.devChunkProjectIds : [],
          },
        }),
      }, opts);
    } catch (error) {
      return freezeIfRequested({
        kind: "invalid",
        raw,
        normalized,
        validAsChunkProjectId: false,
        validAsAppProjectPublicId: false,
        isLikelyAppProjectId: false,
        isLikelyChunkProjectId: false,
        isDevChunkProjectId: false,
        issue: createIssue({
          code: "unexpected_error",
          severity: "error",
          message: "Unexpected project id classification error.",
          value: raw,
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      }, opts);
    }
  });
}

export function classifyWorldId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): ClassifiedWorldId {
  const opts = normalizeOptions(options);
  const raw = normalizeCachedString(value, "", opts);
  const normalized = sanitizeIdentifier(raw, "", opts);
  const key = cacheKey("world-class", normalized, opts);

  return rememberCache(WORLD_CLASSIFICATION_CACHE, key, opts, () => {
    try {
      if (!normalized) {
        return freezeIfRequested({
          kind: "empty",
          raw,
          normalized,
          validAsConcreteWorldId: false,
          isProviderLikeWorldId: false,
          issue: createIssue({
            code: "empty_value",
            severity: "warning",
            message: "World id value was empty.",
            value: raw,
          }),
        }, opts);
      }

      if (raw && normalized !== raw) {
        return freezeIfRequested({
          kind: "invalid",
          raw,
          normalized,
          validAsConcreteWorldId: false,
          isProviderLikeWorldId: false,
          issue: createIssue({
            code: "invalid_characters_removed",
            severity: "error",
            message: "World id contained invalid characters and was rejected.",
            value: raw,
            details: {
              normalized,
            },
          }),
        }, opts);
      }

      const providerLike = isOneOfNormalized(normalized, opts.providerLikeWorldIds);

      if (providerLike) {
        return freezeIfRequested({
          kind: "provider_like_world",
          raw,
          normalized,
          validAsConcreteWorldId: false,
          isProviderLikeWorldId: true,
          issue: createIssue({
            code: "chunk_world_id_provider_like",
            severity: "error",
            message: "Provider/template world id cannot be used as concrete runtime world id.",
            value: normalized,
            details: {
              defaultConcreteWorldId: opts.defaultWorldId,
              providerLikeWorldIds: opts.providerLikeWorldIds,
            },
          }),
        }, opts);
      }

      if (normalized === opts.defaultWorldId || opts.allowCustomConcreteWorldIds) {
        return freezeIfRequested({
          kind: "concrete_world",
          raw,
          normalized,
          validAsConcreteWorldId: true,
          isProviderLikeWorldId: false,
          issue: null,
        }, opts);
      }

      return freezeIfRequested({
        kind: "invalid",
        raw,
        normalized,
        validAsConcreteWorldId: false,
        isProviderLikeWorldId: false,
        issue: createIssue({
          code: "chunk_world_id_invalid",
          severity: "error",
          message: "World id is not accepted as concrete chunk world id.",
          value: normalized,
          details: {
            expectedWorldId: opts.defaultWorldId,
          },
        }),
      }, opts);
    } catch (error) {
      return freezeIfRequested({
        kind: "invalid",
        raw,
        normalized,
        validAsConcreteWorldId: false,
        isProviderLikeWorldId: false,
        issue: createIssue({
          code: "unexpected_error",
          severity: "error",
          message: "Unexpected world id classification error.",
          value: raw,
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      }, opts);
    }
  });
}

function collectProjectCandidates(input: ResolveChunkIdentityInput): ResolveChunkProjectIdInput {
  const chunkProjectIdCandidates: ChunkIdentityCandidate[] = [];
  const projectIdCandidates: ChunkIdentityCandidate[] = [];
  const appProjectIdCandidates: ChunkIdentityCandidate[] = [];
  const fallbackCandidates: ChunkIdentityCandidate[] = [];
  const source = safeString(input.source, "resolveChunkIdentity");

  appendCandidate(chunkProjectIdCandidates, input.chunkProjectId, `${source}.chunkProjectId`, "chunkProjectId", true);
  appendCandidate(chunkProjectIdCandidates, input.chunkServiceProjectId, `${source}.chunkServiceProjectId`, "chunkProjectId", true);
  appendCandidate(projectIdCandidates, input.projectId, `${source}.projectId`, "projectId", false);
  appendCandidate(fallbackCandidates, input.defaultProjectId, `${source}.defaultProjectId`, "defaultProjectId", false);
  appendCandidate(appProjectIdCandidates, input.appProjectPublicId, `${source}.appProjectPublicId`, "appProjectPublicId", true);
  appendCandidate(appProjectIdCandidates, input.projectPublicId, `${source}.projectPublicId`, "projectPublicId", true);

  return {
    chunkProjectIdCandidates: [
      ...chunkProjectIdCandidates,
      ...(input.chunkProjectIdCandidates ?? []),
    ],
    projectIdCandidates: [
      ...projectIdCandidates,
      ...(input.projectIdCandidates ?? []),
    ],
    appProjectIdCandidates: [
      ...appProjectIdCandidates,
      ...(input.appProjectIdCandidates ?? []),
    ],
    fallbackCandidates,
  };
}

function collectUniverseCandidates(input: ResolveChunkIdentityInput): ResolveChunkUniverseIdInput {
  const chunkUniverseIdCandidates: ChunkIdentityCandidate[] = [];
  const universeIdCandidates: ChunkIdentityCandidate[] = [];
  const fallbackCandidates: ChunkIdentityCandidate[] = [];
  const source = safeString(input.source, "resolveChunkIdentity");

  appendCandidate(chunkUniverseIdCandidates, input.chunkUniverseId, `${source}.chunkUniverseId`, "chunkUniverseId", true);
  appendCandidate(chunkUniverseIdCandidates, input.chunkServiceUniverseId, `${source}.chunkServiceUniverseId`, "chunkUniverseId", true);
  appendCandidate(universeIdCandidates, input.universeId, `${source}.universeId`, "universeId", false);
  appendCandidate(fallbackCandidates, input.defaultUniverseId, `${source}.defaultUniverseId`, "universeId", false);

  return {
    chunkUniverseIdCandidates: [
      ...chunkUniverseIdCandidates,
      ...(input.chunkUniverseIdCandidates ?? []),
    ],
    universeIdCandidates: [
      ...universeIdCandidates,
      ...(input.universeIdCandidates ?? []),
    ],
    fallbackCandidates,
  };
}

function collectWorldCandidates(input: ResolveChunkIdentityInput): ResolveChunkWorldIdInput {
  const chunkWorldIdCandidates: ChunkIdentityCandidate[] = [];
  const worldIdCandidates: ChunkIdentityCandidate[] = [];
  const fallbackCandidates: ChunkIdentityCandidate[] = [];
  const source = safeString(input.source, "resolveChunkIdentity");

  appendCandidate(chunkWorldIdCandidates, input.chunkWorldId, `${source}.chunkWorldId",`, "chunkWorldId", true);
  appendCandidate(chunkWorldIdCandidates, input.chunkServiceWorldId, `${source}.chunkServiceWorldId`, "chunkWorldId", true);
  appendCandidate(worldIdCandidates, input.worldId, `${source}.worldId`, "worldId", false);
  appendCandidate(fallbackCandidates, input.defaultWorldId, `${source}.defaultWorldId`, "defaultWorldId", false);

  return {
    chunkWorldIdCandidates: [
      ...chunkWorldIdCandidates,
      ...(input.chunkWorldIdCandidates ?? []),
    ],
    worldIdCandidates: [
      ...worldIdCandidates,
      ...(input.worldIdCandidates ?? []),
    ],
    fallbackCandidates,
  };
}

export function resolveChunkProjectId(
  input: ResolveChunkProjectIdInput,
  options?: ChunkIdentityContractOptions | null,
): ChunkProjectIdResolution {
  const opts = normalizeOptions(options);
  const issues: ChunkIdentityIssue[] = [];
  const rejectedCandidates: RejectedChunkIdentityCandidate[] = [];
  let appProjectPublicId: string | null = null;

  try {
    const appCandidates = input.appProjectIdCandidates ?? [];

    for (const candidate of appCandidates) {
      const classified = classifyProjectId(candidate.value, opts);

      if (classified.validAsAppProjectPublicId) {
        appProjectPublicId = appProjectPublicId ?? classified.normalized;
        issues.push(createIssue({
          code: "app_project_id_detected",
          severity: "info",
          message: "App project public id was detected and kept separate from chunk project id.",
          source: candidate.source,
          role: candidate.role,
          value: classified.normalized,
        }));
      }
    }

    const orderedCandidateGroups: readonly (readonly ChunkIdentityCandidate[])[] = [
      input.chunkProjectIdCandidates ?? [],
      input.projectIdCandidates ?? [],
      input.fallbackCandidates ?? [],
    ];

    for (const group of orderedCandidateGroups) {
      for (const candidate of group) {
        const role = normalizeCandidateRole(candidate.role);
        const classified = classifyProjectId(candidate.value, opts);

        if (classified.validAsAppProjectPublicId) {
          const issueCode: ChunkIdentityIssueCode =
            role === "chunkProjectId" || role === "projectId" || role === "defaultProjectId"
              ? "app_project_id_used_as_chunk_project_id"
              : "app_project_id_detected";

          issues.push(createIssue({
            code: issueCode,
            severity: issueCode === "app_project_id_used_as_chunk_project_id" ? "error" : "info",
            message: "App project public id was rejected as chunk project id.",
            source: candidate.source,
            role,
            value: classified.normalized,
            details: {
              expectedChunkProjectPrefix: opts.chunkProjectPrefix,
            },
          }));

          appProjectPublicId = appProjectPublicId ?? classified.normalized;

          rejectedCandidates.push(createRejectedCandidate(
            candidate,
            classified.normalized,
            issueCode,
            "App project id cannot be used for chunk project route construction.",
          ));

          continue;
        }

        if (classified.validAsChunkProjectId) {
          if (role === "projectId" || role === "defaultProjectId") {
            issues.push(createIssue({
              code: "chunk_project_id_from_project_alias",
              severity: classified.kind === "dev_chunk_project" ? "info" : "warning",
              message: "Chunk project id was accepted from a generic project alias because it is a valid chunk id.",
              source: candidate.source,
              role,
              value: classified.normalized,
              details: {
                kind: classified.kind,
              },
            }));
          }

          if (classified.issue) {
            issues.push(classified.issue);
          }

          issues.push(createIssue({
            code: "candidate_selected",
            severity: "info",
            message: "Chunk project id candidate was selected.",
            source: candidate.source,
            role,
            value: classified.normalized,
            details: {
              kind: classified.kind,
            },
          }));

          const result: ChunkProjectIdResolution = {
            ok: true,
            status: issues.some((issue) => issue.severity === "error") ? "degraded" : "valid",
            value: classified.normalized,
            chunkProjectId: classified.normalized,
            appProjectPublicId,
            selectedSource: candidate.source ?? null,
            selectedRole: role,
            selectedKind: classified.kind,
            rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
            issues: freezeArrayIfRequested(issues, opts),
          };

          return freezeIfRequested(result, opts);
        }

        if (classified.issue) {
          issues.push({
            ...classified.issue,
            source: candidate.source ?? classified.issue.source,
            role: role ?? classified.issue.role,
          });
        }

        rejectedCandidates.push(createRejectedCandidate(
          candidate,
          classified.normalized,
          "candidate_rejected",
          "Project id candidate was not accepted as chunk project id.",
        ));
      }
    }

    const hasAppId = appProjectPublicId !== null;
    const missingCode: ChunkIdentityIssueCode = hasAppId
      ? "app_project_id_used_as_chunk_project_id"
      : "chunk_project_id_missing";

    issues.push(createIssue({
      code: missingCode,
      severity: "error",
      message: hasAppId
        ? "Only an app project id was available. A chunk project id is required."
        : "No valid chunk project id was available.",
      source: null,
      role: "chunkProjectId",
      value: appProjectPublicId,
      details: {
        expectedChunkProjectPrefix: opts.chunkProjectPrefix,
      },
    }));

    const result: ChunkProjectIdResolution = {
      ok: false,
      status: "invalid",
      value: null,
      chunkProjectId: null,
      appProjectPublicId,
      selectedSource: null,
      selectedRole: null,
      selectedKind: null,
      rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
      issues: freezeArrayIfRequested(issues, opts),
    };

    return freezeIfRequested(result, opts);
  } catch (error) {
    issues.push(createIssue({
      code: "unexpected_error",
      severity: "error",
      message: "Unexpected chunk project id resolution error.",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }));

    return freezeIfRequested({
      ok: false,
      status: "invalid",
      value: null,
      chunkProjectId: null,
      appProjectPublicId,
      selectedSource: null,
      selectedRole: null,
      selectedKind: null,
      rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
      issues: freezeArrayIfRequested(issues, opts),
    }, opts);
  }
}

export function resolveChunkWorldId(
  input: ResolveChunkWorldIdInput,
  options?: ChunkIdentityContractOptions | null,
): ChunkWorldIdResolution {
  const opts = normalizeOptions(options);
  const issues: ChunkIdentityIssue[] = [];
  const rejectedCandidates: RejectedChunkIdentityCandidate[] = [];

  try {
    const orderedCandidateGroups: readonly (readonly ChunkIdentityCandidate[])[] = [
      input.chunkWorldIdCandidates ?? [],
      input.worldIdCandidates ?? [],
      input.fallbackCandidates ?? [],
    ];

    for (const group of orderedCandidateGroups) {
      for (const candidate of group) {
        const role = normalizeCandidateRole(candidate.role);
        const classified = classifyWorldId(candidate.value, opts);

        if (classified.validAsConcreteWorldId) {
          issues.push(createIssue({
            code: "candidate_selected",
            severity: "info",
            message: "Chunk world id candidate was selected.",
            source: candidate.source,
            role,
            value: classified.normalized,
            details: {
              kind: classified.kind,
            },
          }));

          const result: ChunkWorldIdResolution = {
            ok: true,
            status: issues.some((issue) => issue.severity === "error") ? "degraded" : "valid",
            value: classified.normalized,
            chunkWorldId: classified.normalized,
            selectedSource: candidate.source ?? null,
            selectedRole: role,
            selectedKind: classified.kind,
            rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
            issues: freezeArrayIfRequested(issues, opts),
          };

          return freezeIfRequested(result, opts);
        }

        if (classified.issue) {
          issues.push({
            ...classified.issue,
            source: candidate.source ?? classified.issue.source,
            role: role ?? classified.issue.role,
          });
        }

        rejectedCandidates.push(createRejectedCandidate(
          candidate,
          classified.normalized,
          classified.isProviderLikeWorldId ? "chunk_world_id_provider_like" : "candidate_rejected",
          classified.isProviderLikeWorldId
            ? "Provider/template world id was rejected as runtime concrete world id."
            : "World id candidate was not accepted as concrete runtime world id.",
        ));
      }
    }

    const defaultWorld = classifyWorldId(opts.defaultWorldId, opts);

    if (defaultWorld.validAsConcreteWorldId && !opts.failOnProviderLikeWorldId) {
      issues.push(createIssue({
        code: "chunk_world_id_defaulted",
        severity: "warning",
        message: "Chunk world id was defaulted to the configured concrete world id.",
        source: "chunk_identity_contract.defaultWorldId",
        role: "defaultWorldId",
        value: defaultWorld.normalized,
      }));

      const result: ChunkWorldIdResolution = {
        ok: true,
        status: "degraded",
        value: defaultWorld.normalized,
        chunkWorldId: defaultWorld.normalized,
        selectedSource: "chunk_identity_contract.defaultWorldId",
        selectedRole: "defaultWorldId",
        selectedKind: defaultWorld.kind,
        rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
        issues: freezeArrayIfRequested(issues, opts),
      };

      return freezeIfRequested(result, opts);
    }

    issues.push(createIssue({
      code: "chunk_world_id_missing",
      severity: "error",
      message: "No valid concrete chunk world id was available.",
      source: null,
      role: "chunkWorldId",
      value: null,
      details: {
        defaultWorldId: opts.defaultWorldId,
      },
    }));

    const result: ChunkWorldIdResolution = {
      ok: false,
      status: "invalid",
      value: null,
      chunkWorldId: null,
      selectedSource: null,
      selectedRole: null,
      selectedKind: null,
      rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
      issues: freezeArrayIfRequested(issues, opts),
    };

    return freezeIfRequested(result, opts);
  } catch (error) {
    issues.push(createIssue({
      code: "unexpected_error",
      severity: "error",
      message: "Unexpected chunk world id resolution error.",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }));

    return freezeIfRequested({
      ok: false,
      status: "invalid",
      value: null,
      chunkWorldId: null,
      selectedSource: null,
      selectedRole: null,
      selectedKind: null,
      rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
      issues: freezeArrayIfRequested(issues, opts),
    }, opts);
  }
}

export function resolveChunkUniverseId(
  input: ResolveChunkUniverseIdInput,
  options?: ChunkIdentityContractOptions | null,
): ChunkUniverseIdResolution {
  const opts = normalizeOptions(options);
  const issues: ChunkIdentityIssue[] = [];

  try {
    const orderedCandidateGroups: readonly (readonly ChunkIdentityCandidate[])[] = [
      input.chunkUniverseIdCandidates ?? [],
      input.universeIdCandidates ?? [],
      input.fallbackCandidates ?? [],
    ];

    for (const group of orderedCandidateGroups) {
      for (const candidate of group) {
        const normalized = sanitizeIdentifier(candidate.value, "", opts);

        if (normalized.length > 0) {
          const role = normalizeCandidateRole(candidate.role);

          const result: ChunkUniverseIdResolution = {
            ok: true,
            status: "valid",
            value: normalized,
            chunkUniverseId: normalized,
            selectedSource: candidate.source ?? null,
            selectedRole: role,
            issues: freezeArrayIfRequested([
              ...issues,
              createIssue({
                code: "candidate_selected",
                severity: "info",
                message: "Chunk universe id candidate was selected.",
                source: candidate.source,
                role,
                value: normalized,
              }),
            ], opts),
          };

          return freezeIfRequested(result, opts);
        }
      }
    }

    issues.push(createIssue({
      code: "chunk_universe_id_missing",
      severity: "info",
      message: "No chunk universe id was available. This is allowed when the chunk route does not require universe id.",
      source: null,
      role: "chunkUniverseId",
      value: null,
    }));

    const result: ChunkUniverseIdResolution = {
      ok: true,
      status: "degraded",
      value: null,
      chunkUniverseId: null,
      selectedSource: null,
      selectedRole: null,
      issues: freezeArrayIfRequested(issues, opts),
    };

    return freezeIfRequested(result, opts);
  } catch (error) {
    issues.push(createIssue({
      code: "unexpected_error",
      severity: "warning",
      message: "Unexpected chunk universe id resolution error.",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }));

    return freezeIfRequested({
      ok: true,
      status: "degraded",
      value: null,
      chunkUniverseId: null,
      selectedSource: null,
      selectedRole: null,
      issues: freezeArrayIfRequested(issues, opts),
    }, opts);
  }
}

export function resolveChunkIdentity(
  input: ResolveChunkIdentityInput,
  options?: ChunkIdentityContractOptions | null,
): CanonicalChunkIdentity {
  const opts = normalizeOptions(options);

  try {
    const project = resolveChunkProjectId(collectProjectCandidates(input), opts);
    const universe = resolveChunkUniverseId(collectUniverseCandidates(input), opts);
    const world = resolveChunkWorldId(collectWorldCandidates(input), opts);

    const explicitStatus = normalizeStatus(
      firstNonEmptyString(input.chunkStatus, input.status),
      project.ok && world.ok ? "ready" : "invalid",
    );

    const explicitReady = safeBoolean(
      firstNonEmptyString(input.chunkReady, input.ready),
      project.ok && world.ok,
    );

    const hasFatalError =
      !project.ok
      || !world.ok
      || explicitStatus === "error"
      || explicitStatus === "disabled"
      || explicitStatus === "invalid";

    const ready = !hasFatalError && explicitReady && Boolean(project.chunkProjectId && world.chunkWorldId);
    const status = hasFatalError
      ? explicitStatus === "disabled" ? "disabled" : "invalid"
      : ready ? "ready" : "pending";

    const issues = [
      ...project.issues,
      ...universe.issues,
      ...world.issues,
      createIssue({
        code: hasFatalError ? "identity_invalid" : project.status === "degraded" || world.status === "degraded" || universe.status === "degraded"
          ? "identity_degraded"
          : "identity_valid",
        severity: hasFatalError ? "error" : project.status === "degraded" || world.status === "degraded" || universe.status === "degraded"
          ? "warning"
          : "info",
        message: hasFatalError
          ? "Chunk identity is invalid."
          : project.status === "degraded" || world.status === "degraded" || universe.status === "degraded"
            ? "Chunk identity is valid but degraded."
            : "Chunk identity is valid.",
        details: {
          projectId: project.chunkProjectId,
          worldId: world.chunkWorldId,
          universeId: universe.chunkUniverseId,
        },
      }),
    ];

    const rejectedCandidates = [
      ...project.rejectedCandidates,
      ...world.rejectedCandidates,
    ];

    const result: CanonicalChunkIdentity = {
      kind: CHUNK_IDENTITY_CONTRACT_KIND,
      status: hasFatalError
        ? "invalid"
        : issues.some((issue) => issue.severity === "warning" || issue.severity === "error")
          ? "degraded"
          : "valid",

      projectId: project.chunkProjectId,
      chunkProjectId: project.chunkProjectId,

      appProjectPublicId: project.appProjectPublicId,
      projectPublicId: project.appProjectPublicId,

      universeId: universe.chunkUniverseId,
      chunkUniverseId: universe.chunkUniverseId,

      worldId: world.chunkWorldId,
      chunkWorldId: world.chunkWorldId,

      chunkReady: ready,
      ready,
      chunkStatus: status,

      valid: !hasFatalError,
      degraded: !hasFatalError && issues.some((issue) => issue.severity === "warning" || issue.severity === "error"),

      project,
      universe,
      world,

      issues: freezeArrayIfRequested(issues, opts),
      rejectedCandidates: freezeArrayIfRequested(rejectedCandidates, opts),
    };

    return freezeIfRequested(result, opts);
  } catch (error) {
    const issue = createIssue({
      code: "unexpected_error",
      severity: "error",
      message: "Unexpected canonical chunk identity resolution error.",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    const emptyProject = resolveChunkProjectId({}, opts);
    const emptyUniverse = resolveChunkUniverseId({}, opts);
    const emptyWorld = resolveChunkWorldId({}, opts);

    return freezeIfRequested({
      kind: CHUNK_IDENTITY_CONTRACT_KIND,
      status: "invalid",
      projectId: null,
      chunkProjectId: null,
      appProjectPublicId: null,
      projectPublicId: null,
      universeId: null,
      chunkUniverseId: null,
      worldId: null,
      chunkWorldId: null,
      chunkReady: false,
      ready: false,
      chunkStatus: "invalid",
      valid: false,
      degraded: false,
      project: emptyProject,
      universe: emptyUniverse,
      world: emptyWorld,
      issues: freezeArrayIfRequested([issue], opts),
      rejectedCandidates: freezeArrayIfRequested([], opts),
    }, opts);
  }
}

export function resolveChunkIdentityFromRecords(
  records: readonly (UnknownRecord | null | undefined)[],
  options?: ChunkIdentityContractOptions | null,
): CanonicalChunkIdentity {
  try {
    const input: ResolveChunkIdentityInput = {};
    const merged: Record<string, unknown> = {};

    for (const record of records) {
      if (!record || typeof record !== "object") {
        continue;
      }

      Object.assign(merged, record);
    }

    return resolveChunkIdentity({
      ...input,
      chunkProjectId: firstNonEmptyString(
        merged.chunkProjectId,
        merged.chunk_project_id,
        merged.chunkServiceProjectId,
        merged.chunk_service_project_id,
      ),
      projectId: firstNonEmptyString(merged.projectId, merged.project_id),
      defaultProjectId: firstNonEmptyString(merged.defaultProjectId, merged.default_project_id),
      appProjectPublicId: firstNonEmptyString(
        merged.appProjectPublicId,
        merged.app_project_public_id,
      ),
      projectPublicId: firstNonEmptyString(
        merged.projectPublicId,
        merged.project_public_id,
        merged.public_id,
      ),
      chunkUniverseId: firstNonEmptyString(
        merged.chunkUniverseId,
        merged.chunk_universe_id,
        merged.chunkServiceUniverseId,
        merged.chunk_service_universe_id,
      ),
      universeId: firstNonEmptyString(merged.universeId, merged.universe_id),
      chunkWorldId: firstNonEmptyString(
        merged.chunkWorldId,
        merged.chunk_world_id,
        merged.chunkServiceWorldId,
        merged.chunk_service_world_id,
      ),
      worldId: firstNonEmptyString(merged.worldId, merged.world_id),
      chunkReady: firstNonEmptyString(merged.chunkReady, merged.chunk_ready),
      ready: firstNonEmptyString(merged.ready),
      chunkStatus: firstNonEmptyString(merged.chunkStatus, merged.chunk_status),
      status: firstNonEmptyString(merged.status),
      source: "resolveChunkIdentityFromRecords",
    }, options);
  } catch {
    return resolveChunkIdentity({
      source: "resolveChunkIdentityFromRecords.errorFallback",
    }, options);
  }
}

export function assertValidChunkProjectId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): string {
  const classified = classifyProjectId(value, options);

  if (classified.validAsChunkProjectId) {
    return classified.normalized;
  }

  const message = classified.validAsAppProjectPublicId
    ? `Invalid chunk project id '${classified.normalized}'. Expected '${DEFAULT_CHUNK_PROJECT_PREFIX}...', got app project id '${DEFAULT_APP_PROJECT_PREFIX}...'.`
    : `Invalid chunk project id '${classified.normalized || String(value)}'. Expected '${DEFAULT_CHUNK_PROJECT_PREFIX}...'.`;

  throw new Error(message);
}

export function assertValidConcreteChunkWorldId(
  value: unknown,
  options?: ChunkIdentityContractOptions | null,
): string {
  const classified = classifyWorldId(value, options);

  if (classified.validAsConcreteWorldId) {
    return classified.normalized;
  }

  const message = classified.isProviderLikeWorldId
    ? `Invalid concrete chunk world id '${classified.normalized}'. Provider/template worlds cannot be used as runtime worlds.`
    : `Invalid concrete chunk world id '${classified.normalized || String(value)}'.`;

  throw new Error(message);
}

export function createInvalidChunkProjectIdIssue(
  value: unknown,
  source?: string | null,
  role?: ChunkIdentityCandidateRole | string | null,
): ChunkIdentityIssue {
  const classified = classifyProjectId(value);

  if (classified.validAsAppProjectPublicId) {
    return createIssue({
      code: "app_project_id_used_as_chunk_project_id",
      severity: "error",
      message: "App project public id was used where chunk project id is required.",
      source,
      role,
      value: classified.normalized,
      details: {
        expectedChunkProjectPrefix: DEFAULT_CHUNK_PROJECT_PREFIX,
        appProjectPrefix: DEFAULT_APP_PROJECT_PREFIX,
      },
    });
  }

  return createIssue({
    code: "chunk_project_id_invalid",
    severity: "error",
    message: "Invalid chunk project id.",
    source,
    role,
    value: classified.normalized,
    details: {
      expectedChunkProjectPrefix: DEFAULT_CHUNK_PROJECT_PREFIX,
    },
  });
}

export function chunkIdentityIssuesToWarnings(
  issues: readonly ChunkIdentityIssue[],
): readonly string[] {
  try {
    return issues
      .filter((issue) => issue.severity === "warning" || issue.severity === "error")
      .map((issue) => {
        const source = issue.source ? ` [${issue.source}]` : "";
        const value = issue.value ? ` value=${issue.value}` : "";
        return `${issue.code}: ${issue.message}${source}${value}`;
      });
  } catch {
    return ["chunk_identity_issues_to_warnings_failed"];
  }
}

export function canonicalChunkIdentityToRecord(
  identity: CanonicalChunkIdentity,
): UnknownRecord {
  try {
    return {
      kind: identity.kind,
      status: identity.status,
      projectId: identity.projectId,
      chunkProjectId: identity.chunkProjectId,
      appProjectPublicId: identity.appProjectPublicId,
      projectPublicId: identity.projectPublicId,
      universeId: identity.universeId,
      chunkUniverseId: identity.chunkUniverseId,
      worldId: identity.worldId,
      chunkWorldId: identity.chunkWorldId,
      chunkReady: identity.chunkReady,
      ready: identity.ready,
      chunkStatus: identity.chunkStatus,
      valid: identity.valid,
      degraded: identity.degraded,
      issues: identity.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        source: issue.source,
        role: issue.role,
        value: issue.value,
        details: issue.details,
      })),
      rejectedCandidates: identity.rejectedCandidates.map((candidate) => ({
        source: candidate.candidate.source ?? null,
        role: candidate.candidate.role ?? null,
        value: safeString(candidate.candidate.value, ""),
        normalizedValue: candidate.normalizedValue,
        reason: candidate.reason,
        message: candidate.message,
      })),
    };
  } catch {
    return {
      kind: CHUNK_IDENTITY_CONTRACT_KIND,
      status: "invalid",
      error: "canonical_chunk_identity_to_record_failed",
    };
  }
}

export function getChunkIdentityContractMetadata(): ChunkIdentityDebugSummary {
  return {
    kind: CHUNK_IDENTITY_CONTRACT_KIND,
    version: CHUNK_IDENTITY_CONTRACT_VERSION,
    rules: {
      appProjectPrefix: DEFAULT_APP_PROJECT_PREFIX,
      chunkProjectPrefix: DEFAULT_CHUNK_PROJECT_PREFIX,
      appProjectIdNeverUsedAsChunkProjectId: true,
      runtimeProjectIdIsChunkProjectId: true,
      runtimeWorldIdIsConcreteChunkWorldId: true,
      providerLikeWorldIdsRejected: true,
      prjPrefixIsAppProjectOnly: true,
      chkPrjPrefixIsChunkProject: true,
    },
  };
}