// services/vectoplan-editor/src/frontend/api/chunk_api_errors.ts
import {
  CHUNK_API_EDITOR_INVENTORY_ROUTE,
  CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  type ChunkApiErrorCode,
  type ChunkApiErrorDetails,
  type ChunkApiFailedResult,
  type ChunkApiHttpMethod,
  type ChunkApiRequestKind,
  type ChunkApiRequestMeta,
  type ChunkApiResponseSource,
  type ChunkApiUnknownRecord,
} from "./chunk_api_models";

export interface CreateChunkApiErrorInput {
  readonly code?: ChunkApiErrorCode | string;
  readonly message?: string;
  readonly retryable?: boolean;
  readonly statusCode?: number | null;
  readonly requestId?: string | null;
  readonly requestKind?: ChunkApiRequestKind | null;
  readonly url?: string | null;
  readonly method?: ChunkApiHttpMethod | null;
  readonly exceptionType?: string | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}

export interface CreateChunkApiFailedResultInput extends CreateChunkApiErrorInput {
  readonly request?: ChunkApiRequestMeta | null;
  readonly source?: ChunkApiResponseSource;
  readonly raw?: unknown;
}

export class ChunkApiError extends Error {
  public readonly name = "ChunkApiError";
  public readonly code: ChunkApiErrorCode | string;
  public readonly retryable: boolean;
  public readonly statusCode: number | null;
  public readonly requestId: string | null;
  public readonly requestKind: ChunkApiRequestKind | null;
  public readonly url: string | null;
  public readonly method: ChunkApiHttpMethod | null;
  public readonly exceptionType: string | null;
  public readonly details: ChunkApiUnknownRecord | null;
  public readonly causeValue: unknown;

  public constructor(input: CreateChunkApiErrorInput) {
    const code = normalizeErrorCode(input.code);
    const message = normalizeErrorMessage(input.message, code);

    super(message);

    this.code = code;
    this.retryable = input.retryable ?? isRetryableErrorCode(code);
    this.statusCode = normalizeNullableNumber(input.statusCode);
    this.requestId = normalizeNullableString(input.requestId);
    this.requestKind = normalizeRequestKind(input.requestKind);
    this.url = normalizeNullableString(input.url);
    this.method = normalizeHttpMethod(input.method);
    this.exceptionType = normalizeNullableString(input.exceptionType) ?? getExceptionType(input.cause);
    this.details = enrichDetailsWithInventoryContext(
      sanitizeDetails(input.details) ?? getCauseDetails(input.cause),
      code,
    );
    this.causeValue = input.cause ?? null;

    try {
      Object.setPrototypeOf(this, ChunkApiError.prototype);
    } catch {
      // Prototype repair is best-effort for older runtimes.
    }

    try {
      (this as Error & { cause?: unknown }).cause = input.cause;
    } catch {
      // Error.cause is optional.
    }
  }

  public toDetails(): ChunkApiErrorDetails {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      statusCode: this.statusCode,
      requestId: this.requestId,
      requestKind: this.requestKind,
      url: this.url,
      method: this.method,
      exceptionType: this.exceptionType,
      details: this.details,
    };
  }
}

export function createChunkApiError(input: CreateChunkApiErrorInput): ChunkApiError {
  return new ChunkApiError(input);
}

export function chunkApiErrorToDetails(error: unknown): ChunkApiErrorDetails {
  try {
    if (error instanceof ChunkApiError) {
      return error.toDetails();
    }

    if (isChunkApiErrorDetailsLike(error)) {
      const code = normalizeErrorCode(error.code);

      return {
        code,
        message: normalizeErrorMessage(error.message, code),
        retryable: typeof error.retryable === "boolean" ? error.retryable : isRetryableErrorCode(code),
        statusCode: normalizeNullableNumber(error.statusCode),
        requestId: normalizeNullableString(error.requestId),
        requestKind: normalizeRequestKind(error.requestKind),
        url: normalizeNullableString(error.url),
        method: normalizeHttpMethod(error.method),
        exceptionType: normalizeNullableString(error.exceptionType),
        details: enrichDetailsWithInventoryContext(sanitizeDetails(error.details), code),
      };
    }

    return new ChunkApiError({
      code: inferErrorCode(error),
      message: getUnknownErrorMessage(error),
      retryable: isRetryableUnknownError(error),
      exceptionType: getExceptionType(error),
      details: getCauseDetails(error),
      cause: error,
    }).toDetails();
  } catch {
    return {
      code: "chunk_api_unknown_error",
      message: "Unknown chunk API error.",
      retryable: true,
      statusCode: null,
      requestId: null,
      requestKind: null,
      url: null,
      method: null,
      exceptionType: null,
      details: {
        productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
        browserUsesEditorInventoryApi: true,
        legacyChunkBlocksAreDiagnosticOnly: true,
      },
    };
  }
}

export function createChunkApiFailedResult(input: CreateChunkApiFailedResultInput): ChunkApiFailedResult {
  const error = createChunkApiError({
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    statusCode: input.statusCode ?? input.request?.statusCode ?? null,
    requestId: input.requestId ?? input.request?.requestId ?? null,
    requestKind: input.requestKind ?? input.request?.kind ?? null,
    url: input.url ?? input.request?.url ?? null,
    method: input.method ?? input.request?.method ?? null,
    exceptionType: input.exceptionType,
    details: input.details,
    cause: input.cause,
  });

  return {
    ok: false,
    request: input.request ?? null,
    source: input.source ?? input.request?.source ?? "client-fallback",
    raw: input.raw ?? input.cause ?? null,
    error: error.toDetails(),
  };
}

export function createFailedRequestError(input: {
  readonly request: ChunkApiRequestMeta | null;
  readonly code: ChunkApiErrorCode | string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly statusCode?: number | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return new ChunkApiError({
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    statusCode: input.statusCode ?? input.request?.statusCode ?? null,
    requestId: input.request?.requestId ?? null,
    requestKind: input.request?.kind ?? null,
    url: input.request?.url ?? null,
    method: input.request?.method ?? null,
    details: input.details ?? null,
    cause: input.cause,
  });
}

export function createInvalidConfigError(input?: {
  readonly message?: string;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return new ChunkApiError({
    code: "chunk_api_invalid_config",
    message: input?.message ?? "Chunk API client configuration is invalid.",
    retryable: false,
    details: input?.details ?? null,
    cause: input?.cause,
  });
}

export function createInvalidUrlError(input: {
  readonly url?: string | null;
  readonly request?: ChunkApiRequestMeta | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_invalid_url",
    message: `Chunk API URL is invalid${input.url ? `: ${input.url}` : ""}.`,
    retryable: false,
    details: {
      url: input.url ?? input.request?.url ?? null,
    },
    cause: input.cause,
  });
}

export function createInvalidPayloadError(input: {
  readonly message?: string;
  readonly request?: ChunkApiRequestMeta | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_invalid_payload",
    message: input.message ?? "Chunk API response payload was invalid.",
    retryable: false,
    details: input.details ?? null,
    cause: input.cause,
  });
}

export function createInvalidResponseError(input: {
  readonly message?: string;
  readonly request?: ChunkApiRequestMeta | null;
  readonly responsePreview?: unknown;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_invalid_response",
    message: input.message ?? "Chunk API response was invalid.",
    retryable: true,
    details: {
      ...(input.details ?? {}),
      responsePreview: previewUnknown(input.responsePreview),
    },
    cause: input.cause,
  });
}

export function createResponseParseError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly bodyText?: string | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_response_parse_failed",
    message: "Chunk API response could not be parsed as JSON.",
    retryable: true,
    details: {
      bodyPreview: previewUnknown(input.bodyText ?? null),
    },
    cause: input.cause,
  });
}

export function createTimeoutError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly timeoutMs?: number | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_request_timeout",
    message: `Chunk API request timed out${typeof input.timeoutMs === "number" ? ` after ${input.timeoutMs}ms` : ""}.`,
    retryable: true,
    details: {
      timeoutMs: input.timeoutMs ?? null,
    },
    cause: input.cause,
  });
}

export function createAbortedError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_request_aborted",
    message: "Chunk API request was aborted.",
    retryable: true,
    cause: input.cause,
  });
}

export function createHttpError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly statusCode: number;
  readonly statusText?: string | null;
  readonly body?: unknown;
  readonly cause?: unknown;
}): ChunkApiError {
  const statusCode = normalizeStatusCode(input.statusCode);
  const retryable = isRetryableStatusCode(statusCode);

  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_http_error",
    message: `Chunk API HTTP request failed with status ${statusCode}${input.statusText ? ` ${input.statusText}` : ""}.`,
    retryable,
    statusCode,
    details: {
      statusText: input.statusText ?? null,
      bodyPreview: previewUnknown(input.body),
    },
    cause: input.cause,
  });
}

export function createNetworkError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_network_error",
    message: "Chunk API network request failed.",
    retryable: true,
    details: getCauseDetails(input.cause),
    cause: input.cause,
  });
}

export function createStatusNotOkError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly body?: unknown;
  readonly message?: string;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_status_not_ok",
    message: input.message ?? "Chunk API status response did not report ok=true.",
    retryable: true,
    details: {
      bodyPreview: previewUnknown(input.body),
    },
  });
}

export function createConnectionFailedError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly diagnostics?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_connection_failed",
    message: "Chunk API connection test failed.",
    retryable: true,
    details: input.diagnostics ?? getCauseDetails(input.cause),
    cause: input.cause,
  });
}

export function createRouteUnavailableError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly routeName?: string | null;
  readonly routeUrl?: string | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_route_unavailable",
    message: `Chunk API route is unavailable${input.routeName ? `: ${input.routeName}` : ""}.`,
    retryable: true,
    details: {
      routeName: input.routeName ?? null,
      routeUrl: input.routeUrl ?? input.request?.url ?? null,
    },
    cause: input.cause,
  });
}

export function createEditorInventoryUnavailableError(input?: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly routeUrl?: string | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input?.request ?? null,
    code: "chunk_api_editor_inventory_unavailable",
    message: "Editor inventory route is unavailable. Productive hotbar inventory must be loaded from /editor/api/inventory.",
    retryable: true,
    details: {
      ...(input?.details ?? {}),
      routeName: "editor-inventory",
      routeUrl: input?.routeUrl ?? CHUNK_API_EDITOR_INVENTORY_ROUTE,
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
      legacyChunkBlocksAreDiagnosticOnly: true,
    },
    cause: input?.cause,
  });
}

export function createProjectUnavailableError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly projectId?: string | null;
  readonly worldId?: string | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_project_unavailable",
    message: "Chunk project/bootstrap data is unavailable.",
    retryable: true,
    details: {
      projectId: input.projectId ?? null,
      worldId: input.worldId ?? null,
    },
    cause: input.cause,
  });
}

export function createBlocksUnavailableError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_blocks_unavailable",
    message: "Legacy chunk block definitions are unavailable. Productive hotbar inventory uses /editor/api/inventory.",
    retryable: true,
    details: {
      ...(input.details ?? getCauseDetails(input.cause) ?? {}),
      legacyChunkBlocksAreDiagnosticOnly: true,
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    },
    cause: input.cause,
  });
}

export function createNoPlaceableBlocksError(input?: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly details?: ChunkApiUnknownRecord | null;
}): ChunkApiError {
  return createFailedRequestError({
    request: input?.request ?? null,
    code: "chunk_api_no_placeable_blocks",
    message: "No legacy placeable chunk blocks were available. Productive hotbar inventory uses /editor/api/inventory.",
    retryable: true,
    details: {
      ...(input?.details ?? {}),
      legacyChunkBlocksAreDiagnosticOnly: true,
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
      emptyLegacyPlaceableBlocksAllowed: true,
    },
  });
}

export function createForbiddenDebugBlockTypeError(input: {
  readonly blockTypeId: string;
  readonly request?: ChunkApiRequestMeta | null;
  readonly details?: ChunkApiUnknownRecord | null;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_forbidden_debug_block_type",
    message: `Forbidden debug block type '${input.blockTypeId}' cannot be placed from the editor.`,
    retryable: false,
    details: {
      ...(input.details ?? {}),
      blockTypeId: input.blockTypeId,
      forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
      onlyLibraryItemsPlaceable: true,
    },
  });
}

export function createChunkUnavailableError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly chunkKey?: string | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_chunk_unavailable",
    message: `Chunk is unavailable${input.chunkKey ? `: ${input.chunkKey}` : ""}.`,
    retryable: true,
    details: {
      ...(input.details ?? {}),
      chunkKey: input.chunkKey ?? null,
    },
    cause: input.cause,
  });
}

export function createBatchUnavailableError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly chunkCount?: number | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_batch_unavailable",
    message: "Chunk batch request failed.",
    retryable: true,
    details: {
      ...(input.details ?? {}),
      chunkCount: input.chunkCount ?? null,
    },
    cause: input.cause,
  });
}

export function createCommandFailedError(input: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly commandType?: string | null;
  readonly commandStatus?: string | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_command_failed",
    message: `Chunk command failed${input.commandType ? `: ${input.commandType}` : ""}.`,
    retryable: true,
    details: {
      ...(input.details ?? {}),
      commandType: input.commandType ?? null,
      commandStatus: input.commandStatus ?? null,
    },
    cause: input.cause,
  });
}

export function createUnknownBlockTypeError(input: {
  readonly blockTypeId: string;
  readonly knownBlockTypeIds?: readonly string[];
  readonly request?: ChunkApiRequestMeta | null;
  readonly runtimeBlockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
}): ChunkApiError {
  return createFailedRequestError({
    request: input.request ?? null,
    code: "chunk_api_unknown_block_type",
    message: `Unknown runtime block type '${input.runtimeBlockTypeId ?? input.blockTypeId}'.`,
    retryable: false,
    details: {
      blockTypeId: input.blockTypeId,
      runtimeBlockTypeId: input.runtimeBlockTypeId ?? input.blockTypeId,
      knownBlockTypeIds: [...(input.knownBlockTypeIds ?? [])],
      libraryItemId: input.libraryItemId ?? null,
      familyId: input.familyId ?? null,
      packageId: input.packageId ?? null,
      vplibUid: input.vplibUid ?? null,
      variantId: input.variantId ?? null,
      note: "For Library/VPLIB placement, legacy block-catalog validation should remain disabled unless explicitly required.",
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    },
  });
}

export function createPaletteFallbackFailedError(input?: {
  readonly request?: ChunkApiRequestMeta | null;
  readonly details?: ChunkApiUnknownRecord | null;
  readonly cause?: unknown;
}): ChunkApiError {
  return createFailedRequestError({
    request: input?.request ?? null,
    code: "chunk_api_palette_fallback_failed",
    message: "Chunk palette diagnostic fallback failed.",
    retryable: true,
    details: {
      ...(input?.details ?? getCauseDetails(input?.cause) ?? {}),
      legacyChunkBlocksAreDiagnosticOnly: true,
      productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    },
    cause: input?.cause,
  });
}

export function isRetryableErrorCode(code: unknown): boolean {
  try {
    const normalized = normalizeErrorCode(code);

    return [
      "chunk_api_unknown_error",
      "chunk_api_destroyed",
      "chunk_api_response_parse_failed",
      "chunk_api_request_aborted",
      "chunk_api_request_timeout",
      "chunk_api_network_error",
      "chunk_api_http_error",
      "chunk_api_status_not_ok",
      "chunk_api_connection_failed",
      "chunk_api_route_unavailable",
      "chunk_api_editor_inventory_unavailable",
      "chunk_api_project_unavailable",
      "chunk_api_blocks_unavailable",
      "chunk_api_no_placeable_blocks",
      "chunk_api_chunk_unavailable",
      "chunk_api_batch_unavailable",
      "chunk_api_command_failed",
      "chunk_api_palette_fallback_failed",
    ].includes(normalized);
  } catch {
    return true;
  }
}

export function isAbortError(error: unknown): boolean {
  try {
    if (!error) {
      return false;
    }

    if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
      return true;
    }

    if (error instanceof Error && error.name === "AbortError") {
      return true;
    }

    if (typeof error === "object") {
      const record = error as Record<string, unknown>;
      return record.name === "AbortError" || record.code === "ABORT_ERR";
    }

    return false;
  } catch {
    return false;
  }
}

export function isTimeoutError(error: unknown): boolean {
  try {
    if (!error) {
      return false;
    }

    if (error instanceof ChunkApiError) {
      return error.code === "chunk_api_request_timeout";
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes("timeout") || message.includes("timed out");
    }

    if (typeof error === "object") {
      const record = error as Record<string, unknown>;
      const code = String(record.code ?? "").toLowerCase();
      const message = String(record.message ?? "").toLowerCase();
      return code.includes("timeout") || message.includes("timeout") || message.includes("timed out");
    }

    return false;
  } catch {
    return false;
  }
}

export function inferErrorCode(error: unknown): ChunkApiErrorCode {
  try {
    if (error instanceof ChunkApiError) {
      return normalizeErrorCode(error.code) as ChunkApiErrorCode;
    }

    if (isChunkApiErrorDetailsLike(error)) {
      return normalizeErrorCode(error.code) as ChunkApiErrorCode;
    }

    if (isAbortError(error)) {
      return "chunk_api_request_aborted";
    }

    if (isTimeoutError(error)) {
      return "chunk_api_request_timeout";
    }

    if (error instanceof TypeError) {
      return "chunk_api_network_error";
    }

    return "chunk_api_unknown_error";
  } catch {
    return "chunk_api_unknown_error";
  }
}

function isRetryableUnknownError(error: unknown): boolean {
  try {
    return isRetryableErrorCode(inferErrorCode(error));
  } catch {
    return true;
  }
}

function normalizeErrorCode(code: unknown): string {
  try {
    if (typeof code !== "string") {
      return "chunk_api_unknown_error";
    }

    const trimmed = code.trim();

    return trimmed.length > 0 ? trimmed : "chunk_api_unknown_error";
  } catch {
    return "chunk_api_unknown_error";
  }
}

function normalizeErrorMessage(message: unknown, fallbackCode: unknown): string {
  try {
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }

    if (typeof fallbackCode === "string" && fallbackCode.trim().length > 0) {
      return fallbackCode.trim().replace(/_/g, " ");
    }

    return "Unknown chunk API error.";
  } catch {
    return "Unknown chunk API error.";
  }
}

function normalizeNullableString(value: unknown): string | null {
  try {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function normalizeNullableNumber(value: unknown): number | null {
  try {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function normalizeStatusCode(value: unknown): number {
  try {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }

    return Math.trunc(value);
  } catch {
    return 0;
  }
}

function normalizeRequestKind(value: unknown): ChunkApiRequestKind | null {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  if (
    normalized === "status"
    || normalized === "connection-test"
    || normalized === "projects"
    || normalized === "project"
    || normalized === "project-bootstrap"
    || normalized === "worlds"
    || normalized === "world"
    || normalized === "editor-inventory"
    || normalized === "editor-inventory-health"
    || normalized === "editor-inventory-metadata"
    || normalized === "placeable-blocks"
    || normalized === "blocks"
    || normalized === "creative-library"
    || normalized === "creative-library-health"
    || normalized === "creative-library-metadata"
    || normalized === "creative-library-blocks"
    || normalized === "chunk"
    || normalized === "chunks-batch"
    || normalized === "set-block"
    || normalized === "remove-block"
    || normalized === "replace-block"
    || normalized === "command"
  ) {
    return normalized;
  }

  return null;
}

function normalizeHttpMethod(value: unknown): ChunkApiHttpMethod | null {
  const normalized = normalizeNullableString(value)?.toUpperCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === "GET"
    || normalized === "POST"
    || normalized === "PUT"
    || normalized === "PATCH"
    || normalized === "DELETE"
  ) {
    return normalized;
  }

  return null;
}

function isRetryableStatusCode(statusCode: number): boolean {
  return statusCode === 408
    || statusCode === 409
    || statusCode === 425
    || statusCode === 429
    || statusCode >= 500;
}

function getUnknownErrorMessage(error: unknown): string {
  try {
    if (error instanceof Error && typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message.trim();
    }

    if (typeof error === "string" && error.trim().length > 0) {
      return error.trim();
    }

    if (typeof error === "object" && error !== null) {
      const record = error as Record<string, unknown>;

      if (typeof record.message === "string" && record.message.trim().length > 0) {
        return record.message.trim();
      }

      if (typeof record.error === "string" && record.error.trim().length > 0) {
        return record.error.trim();
      }
    }

    return "Unknown chunk API error.";
  } catch {
    return "Unknown chunk API error.";
  }
}

function getExceptionType(error: unknown): string | null {
  try {
    if (!error) {
      return null;
    }

    if (error instanceof Error) {
      return error.name || error.constructor.name || "Error";
    }

    if (typeof error === "object") {
      const record = error as Record<string, unknown>;

      if (typeof record.name === "string" && record.name.trim().length > 0) {
        return record.name.trim();
      }

      if (typeof record.type === "string" && record.type.trim().length > 0) {
        return record.type.trim();
      }

      if (typeof record.exceptionType === "string" && record.exceptionType.trim().length > 0) {
        return record.exceptionType.trim();
      }
    }

    return typeof error;
  } catch {
    return null;
  }
}

function getCauseDetails(cause: unknown): ChunkApiUnknownRecord | null {
  try {
    if (!cause || typeof cause !== "object") {
      return null;
    }

    const record = cause as Record<string, unknown>;
    const details: Record<string, unknown> = {};

    for (const key of ["name", "message", "code", "type", "status", "statusCode"]) {
      const value = record[key];

      if (
        typeof value === "string"
        || typeof value === "number"
        || typeof value === "boolean"
        || value === null
      ) {
        details[key] = value;
      }
    }

    return Object.keys(details).length > 0 ? details : null;
  } catch {
    return null;
  }
}

function sanitizeDetails(details: unknown): ChunkApiUnknownRecord | null {
  try {
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      return null;
    }

    const input = details as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      output[key] = previewUnknown(value);
    }

    return Object.keys(output).length > 0 ? output : null;
  } catch {
    return null;
  }
}

function enrichDetailsWithInventoryContext(
  details: ChunkApiUnknownRecord | null,
  code: string,
): ChunkApiUnknownRecord | null {
  try {
    const base = details ? { ...details } : {};

    if (
      code.includes("block")
      || code.includes("inventory")
      || code.includes("palette")
      || code.includes("command")
      || code === "chunk_api_unknown_block_type"
      || code === "chunk_api_no_placeable_blocks"
    ) {
      base.productiveInventoryRoute = base.productiveInventoryRoute ?? CHUNK_API_EDITOR_INVENTORY_ROUTE;
      base.browserUsesEditorInventoryApi = base.browserUsesEditorInventoryApi ?? true;
      base.legacyChunkBlocksAreDiagnosticOnly = base.legacyChunkBlocksAreDiagnosticOnly ?? true;
      base.forbiddenDebugBlockTypeIds = base.forbiddenDebugBlockTypeIds ?? [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS];
    }

    return Object.keys(base).length > 0 ? base : null;
  } catch {
    return details;
  }
}

function isChunkApiErrorDetailsLike(value: unknown): value is ChunkApiErrorDetails {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const record = value as Record<string, unknown>;

    return "code" in record || "message" in record || "retryable" in record;
  } catch {
    return false;
  }
}

function previewUnknown(value: unknown): unknown {
  try {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      return value.length > 500 ? `${value.slice(0, 500)}…` : value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.slice(0, 30).map((item) => previewUnknown(item));
    }

    if (typeof value === "object") {
      const output: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>).slice(0, 30);

      for (const [key, nestedValue] of entries) {
        output[key] = previewUnknown(nestedValue);
      }

      return output;
    }

    return String(value);
  } catch {
    return "[unserializable]";
  }
}

export function getChunkApiErrorsMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.api.chunk_api_errors",
    productiveInventoryRoute: CHUNK_API_EDITOR_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...CHUNK_API_FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    supportsEditorInventoryUnavailableError: true,
    supportsForbiddenDebugBlockTypeError: true,
    rules: {
      noPlaceableBlocksIsLegacyDiagnosticOnly: true,
      unknownBlockTypeMeansRuntimeBlockTypeId: true,
      blockErrorsMentionEditorInventoryRoute: true,
      debugGrassDirtBlocked: true,
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
    },
  };
}