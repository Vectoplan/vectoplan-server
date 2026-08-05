// services/vectoplan-editor/src/frontend/utils/safe.ts

export type SafeRecord = Record<string, unknown>;

export type SafeJsonPrimitive = string | number | boolean | null;

export type SafeJsonValue =
  | SafeJsonPrimitive
  | SafeJsonObject
  | SafeJsonArray;

export interface SafeJsonObject {
  readonly [key: string]: SafeJsonValue;
}

export type SafeJsonArray = readonly SafeJsonValue[];

export interface NormalizedUnknownError extends SafeRecord {
  readonly name: string;
  readonly message: string;
  readonly stack: string | null;
  readonly code: string | null;
  readonly type: string | null;
  readonly cause: unknown;
  readonly details: SafeRecord | null;
}

const MAX_SAFE_JSON_DEPTH = 8;

export function isRecord(value: unknown): value is SafeRecord {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

export function isNonEmptyString(value: unknown): value is string {
  try {
    return typeof value === "string" && value.trim().length > 0;
  } catch {
    return false;
  }
}

export function safeString(value: unknown, fallback = ""): string {
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

export function safeNullableString(value: unknown, fallback: string | null = null): string | null {
  try {
    if (value === null || value === undefined) {
      return fallback;
    }

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

export function safeNumber(
  value: unknown,
  fallback = 0,
  options?: {
    readonly min?: number;
    readonly max?: number;
  },
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

    const min = options?.min ?? Number.NEGATIVE_INFINITY;
    const max = options?.max ?? Number.POSITIVE_INFINITY;

    return Math.min(max, Math.max(min, numeric));
  } catch {
    return fallback;
  }
}

export function safeInteger(
  value: unknown,
  fallback = 0,
  options?: {
    readonly min?: number;
    readonly max?: number;
  },
): number {
  try {
    return Math.trunc(safeNumber(value, fallback, options));
  } catch {
    return fallback;
  }
}

export function safeBoolean(value: unknown, fallback = false): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "t", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "f", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function safeArray<T = unknown>(value: unknown): readonly T[] {
  try {
    return Array.isArray(value) ? (value as readonly T[]) : [];
  } catch {
    return [];
  }
}

export function safeMutableArray<T = unknown>(value: unknown): T[] {
  try {
    return Array.isArray(value) ? [...(value as readonly T[])] : [];
  } catch {
    return [];
  }
}

export function safeRecord(value: unknown): SafeRecord {
  try {
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

export function readPath<T = unknown>(
  root: unknown,
  path: readonly (string | number)[],
  fallback?: T,
): T | undefined {
  try {
    let current = root;

    for (const segment of path) {
      if (current === null || current === undefined) {
        return fallback;
      }

      if (typeof segment === "number") {
        if (!Array.isArray(current)) {
          return fallback;
        }

        current = current[segment];
        continue;
      }

      if (!isRecord(current)) {
        return fallback;
      }

      current = current[segment];
    }

    return current as T;
  } catch {
    return fallback;
  }
}

export function readFirstDefined<T = unknown>(
  values: readonly unknown[],
  fallback?: T,
): T | undefined {
  try {
    for (const value of values) {
      if (value !== undefined && value !== null) {
        return value as T;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function uniqueStrings(values: readonly unknown[]): readonly string[] {
  try {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }

      const normalized = value.trim();

      if (normalized.length === 0 || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(normalized);
    }

    return result;
  } catch {
    return [];
  }
}

export function clamp(value: unknown, min: number, max: number, fallback = min): number {
  try {
    const numeric = safeNumber(value, fallback);
    return Math.min(max, Math.max(min, numeric));
  } catch {
    return fallback;
  }
}

export function clampInteger(value: unknown, min: number, max: number, fallback = min): number {
  try {
    return Math.trunc(clamp(value, min, max, fallback));
  } catch {
    return fallback;
  }
}

function sanitizeJsonRecord(value: unknown): SafeRecord | null {
  try {
    if (!isRecord(value)) {
      return null;
    }

    const result: SafeRecord = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (!key) {
        continue;
      }

      result[key] = toSafeJsonValue(nestedValue);
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

function readErrorStringField(error: Error, key: string): string | null {
  try {
    const record = error as unknown as SafeRecord;
    return safeNullableString(record[key], null);
  } catch {
    return null;
  }
}

function readErrorCause(error: Error): unknown {
  try {
    const record = error as unknown as SafeRecord;
    return record.cause ?? null;
  } catch {
    return null;
  }
}

function readErrorDetails(error: Error): SafeRecord | null {
  try {
    const record = error as unknown as SafeRecord;
    return sanitizeJsonRecord(record.details);
  } catch {
    return null;
  }
}

function normalizeErrorRecord(error: SafeRecord): NormalizedUnknownError {
  return {
    name: safeString(error.name, "UnknownError"),
    message: safeString(error.message, "Unknown error."),
    stack: safeNullableString(error.stack, null),
    code: safeNullableString(error.code, null),
    type: safeNullableString(error.type, null),
    cause: error.cause ?? null,
    details: sanitizeJsonRecord(error.details ?? error),
  };
}

export function normalizeUnknownError(error: unknown): NormalizedUnknownError {
  try {
    if (error instanceof Error) {
      return {
        name: safeString(error.name, "Error"),
        message: safeString(error.message, "Unknown error."),
        stack: safeNullableString(error.stack, null),
        code: readErrorStringField(error, "code"),
        type: readErrorStringField(error, "type"),
        cause: readErrorCause(error),
        details: readErrorDetails(error),
      };
    }

    if (isRecord(error)) {
      return normalizeErrorRecord(error);
    }

    if (typeof error === "string") {
      return {
        name: "Error",
        message: safeString(error, "Unknown error."),
        stack: null,
        code: null,
        type: null,
        cause: null,
        details: null,
      };
    }

    return {
      name: "UnknownError",
      message: "Unknown error.",
      stack: null,
      code: null,
      type: null,
      cause: error,
      details: null,
    };
  } catch {
    return {
      name: "UnknownError",
      message: "Unknown error.",
      stack: null,
      code: null,
      type: null,
      cause: null,
      details: null,
    };
  }
}

export function getErrorMessage(error: unknown, fallback = "Unknown error."): string {
  try {
    if (error instanceof Error && isNonEmptyString(error.message)) {
      return error.message.trim();
    }

    if (typeof error === "string" && error.trim().length > 0) {
      return error.trim();
    }

    if (isRecord(error) && isNonEmptyString(error.message)) {
      return error.message.trim();
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function getErrorName(error: unknown, fallback = "Error"): string {
  try {
    if (error instanceof Error && isNonEmptyString(error.name)) {
      return error.name.trim();
    }

    if (isRecord(error) && isNonEmptyString(error.name)) {
      return error.name.trim();
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function getErrorCode(error: unknown, fallback: string | null = null): string | null {
  try {
    if (isRecord(error) && isNonEmptyString(error.code)) {
      return error.code.trim();
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function toSafeJsonValue(value: unknown, depth = 0): SafeJsonValue {
  try {
    if (depth > MAX_SAFE_JSON_DEPTH) {
      return "[max-depth]";
    }

    if (value === null) {
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

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      const result: SafeJsonValue[] = [];

      for (const item of value) {
        result.push(toSafeJsonValue(item, depth + 1));
      }

      return result as SafeJsonArray;
    }

    if (isRecord(value)) {
      const result: Record<string, SafeJsonValue> = {};

      for (const [key, nestedValue] of Object.entries(value)) {
        result[key] = toSafeJsonValue(nestedValue, depth + 1);
      }

      return result as SafeJsonObject;
    }

    if (value === undefined) {
      return null;
    }

    return String(value);
  } catch {
    return null;
  }
}

export function stringifySafe(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "string") {
      return value;
    }

    const serialized = JSON.stringify(toSafeJsonValue(value));
    return typeof serialized === "string" ? serialized : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonSafe<T = unknown>(value: unknown, fallback: T): T {
  try {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return fallback;
    }

    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

export function previewValue(value: unknown, maxLength = 500): SafeJsonValue | string {
  try {
    if (
      value === null
      || value === undefined
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean"
    ) {
      if (typeof value === "string" && value.length > maxLength) {
        return `${value.slice(0, maxLength)}…`;
      }

      return toSafeJsonValue(value);
    }

    const serialized = JSON.stringify(toSafeJsonValue(value));

    if (serialized.length <= maxLength) {
      return parseJsonSafe<SafeJsonValue>(serialized, null);
    }

    return `${serialized.slice(0, maxLength)}…`;
  } catch {
    return "[unserializable]";
  }
}

export function assertNever(value: never, message = "Unexpected value."): never {
  throw new Error(`${message} ${String(value)}`);
}

export function safeCall<T>(
  callback: () => T,
  fallback: T,
): T {
  try {
    return callback();
  } catch {
    return fallback;
  }
}

export async function safeCallAsync<T>(
  callback: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await callback();
  } catch {
    return fallback;
  }
}

export function freezeSafe<T>(value: T): T {
  try {
    if (value && typeof value === "object") {
      return Object.freeze(value);
    }

    return value;
  } catch {
    return value;
  }
}

export function cloneJsonSafe<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(toSafeJsonValue(value))) as T;
  } catch {
    return value;
  }
}

export function errorToRecord(error: unknown): SafeRecord {
  return normalizeUnknownError(error);
}

export function errorToDetails(error: unknown): SafeRecord {
  return normalizeUnknownError(error);
}