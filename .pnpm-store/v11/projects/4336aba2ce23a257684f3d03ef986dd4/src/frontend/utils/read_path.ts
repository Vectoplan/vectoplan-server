// services/vectoplan-editor/src/frontend/utils/read_path.ts
import {
  isRecord,
  safeArray,
  safeBoolean,
  safeInteger,
  safeNullableString,
  safeNumber,
  safeRecord,
  safeString,
} from "./safe";

export type ReadPathSegment = string | number;

export type ReadPath = readonly ReadPathSegment[];

export interface ReadPathResult<T = unknown> {
  readonly found: boolean;
  readonly value: T | undefined;
  readonly failedAt: number | null;
  readonly failedSegment: ReadPathSegment | null;
}

export interface ReadPathOptions<T = unknown> {
  readonly fallback?: T;
  readonly allowArrayIndexString?: boolean;
}

export function readPath<T = unknown>(
  root: unknown,
  path: ReadPath,
  fallback?: T,
): T | undefined {
  try {
    return readPathDetailed<T>(root, path, {
      fallback,
      allowArrayIndexString: true,
    }).value;
  } catch {
    return fallback;
  }
}

export function readPathDetailed<T = unknown>(
  root: unknown,
  path: ReadPath,
  options?: ReadPathOptions<T>,
): ReadPathResult<T> {
  try {
    if (!Array.isArray(path) || path.length === 0) {
      return {
        found: root !== undefined,
        value: (root === undefined ? options?.fallback : root) as T | undefined,
        failedAt: root === undefined ? 0 : null,
        failedSegment: null,
      };
    }

    let current = root;

    for (let index = 0; index < path.length; index += 1) {
      const segment = path[index];

      if (current === null || current === undefined || segment === undefined) {
        return {
          found: false,
          value: options?.fallback,
          failedAt: index,
          failedSegment: segment ?? null,
        };
      }

      if (typeof segment === "number") {
        if (!Array.isArray(current)) {
          return {
            found: false,
            value: options?.fallback,
            failedAt: index,
            failedSegment: segment,
          };
        }

        const normalizedIndex = Math.trunc(segment);

        if (normalizedIndex < 0 || normalizedIndex >= current.length) {
          return {
            found: false,
            value: options?.fallback,
            failedAt: index,
            failedSegment: segment,
          };
        }

        current = current[normalizedIndex];
        continue;
      }

      if (Array.isArray(current)) {
        const allowArrayIndexString = options?.allowArrayIndexString ?? true;

        if (!allowArrayIndexString) {
          return {
            found: false,
            value: options?.fallback,
            failedAt: index,
            failedSegment: segment,
          };
        }

        const parsedIndex = Number.parseInt(segment, 10);

        if (!Number.isFinite(parsedIndex) || String(parsedIndex) !== segment.trim()) {
          return {
            found: false,
            value: options?.fallback,
            failedAt: index,
            failedSegment: segment,
          };
        }

        if (parsedIndex < 0 || parsedIndex >= current.length) {
          return {
            found: false,
            value: options?.fallback,
            failedAt: index,
            failedSegment: segment,
          };
        }

        current = current[parsedIndex];
        continue;
      }

      if (!isRecord(current)) {
        return {
          found: false,
          value: options?.fallback,
          failedAt: index,
          failedSegment: segment,
        };
      }

      if (!(segment in current)) {
        return {
          found: false,
          value: options?.fallback,
          failedAt: index,
          failedSegment: segment,
        };
      }

      current = current[segment];
    }

    if (current === undefined) {
      return {
        found: false,
        value: options?.fallback,
        failedAt: path.length - 1,
        failedSegment: path[path.length - 1] ?? null,
      };
    }

    return {
      found: true,
      value: current as T,
      failedAt: null,
      failedSegment: null,
    };
  } catch {
    return {
      found: false,
      value: options?.fallback,
      failedAt: null,
      failedSegment: null,
    };
  }
}

export function hasPath(root: unknown, path: ReadPath): boolean {
  try {
    return readPathDetailed(root, path).found;
  } catch {
    return false;
  }
}

export function readFirstPath<T = unknown>(
  root: unknown,
  paths: readonly ReadPath[],
  fallback?: T,
): T | undefined {
  try {
    for (const path of paths) {
      const result = readPathDetailed<T>(root, path);

      if (result.found) {
        return result.value;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function readFirstValue<T = unknown>(
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

export function readStringPath(
  root: unknown,
  path: ReadPath,
  fallback = "",
): string {
  try {
    return safeString(readPath(root, path), fallback);
  } catch {
    return fallback;
  }
}

export function readNullableStringPath(
  root: unknown,
  path: ReadPath,
  fallback: string | null = null,
): string | null {
  try {
    return safeNullableString(readPath(root, path), fallback);
  } catch {
    return fallback;
  }
}

export function readNumberPath(
  root: unknown,
  path: ReadPath,
  fallback = 0,
  options?: {
    readonly min?: number;
    readonly max?: number;
  },
): number {
  try {
    return safeNumber(readPath(root, path), fallback, options);
  } catch {
    return fallback;
  }
}

export function readIntegerPath(
  root: unknown,
  path: ReadPath,
  fallback = 0,
  options?: {
    readonly min?: number;
    readonly max?: number;
  },
): number {
  try {
    return safeInteger(readPath(root, path), fallback, options);
  } catch {
    return fallback;
  }
}

export function readBooleanPath(
  root: unknown,
  path: ReadPath,
  fallback = false,
): boolean {
  try {
    return safeBoolean(readPath(root, path), fallback);
  } catch {
    return fallback;
  }
}

export function readArrayPath<T = unknown>(
  root: unknown,
  path: ReadPath,
): readonly T[] {
  try {
    return safeArray<T>(readPath(root, path));
  } catch {
    return [];
  }
}

export function readRecordPath(
  root: unknown,
  path: ReadPath,
): Record<string, unknown> {
  try {
    return safeRecord(readPath(root, path));
  } catch {
    return {};
  }
}

export function setPath<T extends Record<string, unknown>>(
  root: T,
  path: ReadPath,
  value: unknown,
): T {
  try {
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      return root;
    }

    if (!Array.isArray(path) || path.length === 0) {
      return root;
    }

    const clone = {
      ...root,
    };

    let current: Record<string, unknown> = clone;

    for (let index = 0; index < path.length - 1; index += 1) {
      const segment = path[index];

      if (typeof segment !== "string") {
        return root;
      }

      const existing = current[segment];

      if (existing && typeof existing === "object" && !Array.isArray(existing)) {
        current[segment] = {
          ...(existing as Record<string, unknown>),
        };
      } else {
        current[segment] = {};
      }

      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = path[path.length - 1];

    if (typeof lastSegment !== "string") {
      return root;
    }

    current[lastSegment] = value;

    return clone as T;
  } catch {
    return root;
  }
}

export function deletePath<T extends Record<string, unknown>>(
  root: T,
  path: ReadPath,
): T {
  try {
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      return root;
    }

    if (!Array.isArray(path) || path.length === 0) {
      return root;
    }

    const clone = {
      ...root,
    };

    let current: Record<string, unknown> = clone;

    for (let index = 0; index < path.length - 1; index += 1) {
      const segment = path[index];

      if (typeof segment !== "string") {
        return root;
      }

      const existing = current[segment];

      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        return clone as T;
      }

      current[segment] = {
        ...(existing as Record<string, unknown>),
      };

      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = path[path.length - 1];

    if (typeof lastSegment === "string") {
      delete current[lastSegment];
    }

    return clone as T;
  } catch {
    return root;
  }
}

export function pathToString(path: ReadPath): string {
  try {
    if (!Array.isArray(path) || path.length === 0) {
      return "";
    }

    return path
      .map((segment) => {
        if (typeof segment === "number") {
          return `[${segment}]`;
        }

        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(segment)) {
          return segment;
        }

        return JSON.stringify(segment);
      })
      .join(".");
  } catch {
    return "";
  }
}

export function parseDotPath(value: unknown): ReadPath {
  try {
    if (Array.isArray(value)) {
      return value.filter((segment): segment is ReadPathSegment => (
        typeof segment === "string" || typeof segment === "number"
      ));
    }

    if (typeof value !== "string") {
      return [];
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return [];
    }

    return trimmed
      .split(".")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  } catch {
    return [];
  }
}

export function readDotPath<T = unknown>(
  root: unknown,
  dotPath: string,
  fallback?: T,
): T | undefined {
  try {
    return readPath<T>(root, parseDotPath(dotPath), fallback);
  } catch {
    return fallback;
  }
}