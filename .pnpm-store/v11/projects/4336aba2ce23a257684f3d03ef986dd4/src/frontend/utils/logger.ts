// services/vectoplan-editor/src/frontend/utils/logger.ts
import { normalizeUnknownError, previewValue } from "./safe";
import { nowIsoString } from "./time";

export type EditorLogLevel =
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "silent";

export interface EditorLoggerOptions {
  readonly namespace: string;
  readonly buildMode?: string;
  readonly buildVersion?: string;
  readonly bootId?: string;
  readonly minLevel?: EditorLogLevel;
  readonly enabled?: boolean;
  readonly includeTimestamp?: boolean;
  readonly includeContext?: boolean;
  readonly sink?: EditorLogSink;
}

export interface EditorLogEntry {
  readonly level: Exclude<EditorLogLevel, "silent">;
  readonly namespace: string;
  readonly message: string;
  readonly timestamp: string;
  readonly buildMode: string | null;
  readonly buildVersion: string | null;
  readonly bootId: string | null;
  readonly details: Record<string, unknown> | null;
}

export type EditorLogSink = (entry: EditorLogEntry) => void;

export interface EditorLogger {
  readonly namespace: string;
  readonly debug: (message: string, details?: Record<string, unknown>) => void;
  readonly info: (message: string, details?: Record<string, unknown>) => void;
  readonly warn: (message: string, details?: Record<string, unknown>) => void;
  readonly error: (message: string, details?: Record<string, unknown>) => void;
  readonly child: (namespaceSuffix: string, extraContext?: Record<string, unknown>) => EditorLogger;
  readonly withContext: (extraContext: Record<string, unknown>) => EditorLogger;
  readonly setMinLevel: (level: EditorLogLevel) => void;
  readonly getMinLevel: () => EditorLogLevel;
  readonly setEnabled: (enabled: boolean) => void;
  readonly isEnabled: () => boolean;
}

const LOG_LEVEL_ORDER: Record<EditorLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 999,
};

function normalizeLogLevel(value: unknown, fallback: EditorLogLevel): EditorLogLevel {
  try {
    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error" || normalized === "silent") {
      return normalized;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function shouldLog(level: Exclude<EditorLogLevel, "silent">, minLevel: EditorLogLevel, enabled: boolean): boolean {
  try {
    if (!enabled || minLevel === "silent") {
      return false;
    }

    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];
  } catch {
    return false;
  }
}

function sanitizeNamespace(value: unknown): string {
  try {
    if (typeof value !== "string") {
      return "vectoplan-editor";
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : "vectoplan-editor";
  } catch {
    return "vectoplan-editor";
  }
}

function sanitizeDetails(details: unknown): Record<string, unknown> | null {
  try {
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      return null;
    }

    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      if (value instanceof Error) {
        output[key] = normalizeUnknownError(value);
      } else {
        output[key] = previewValue(value, 1200);
      }
    }

    return Object.keys(output).length > 0 ? output : null;
  } catch {
    return {
      detailsSanitizationFailed: true,
    };
  }
}

function mergeDetails(
  base: Record<string, unknown> | null,
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  try {
    const output: Record<string, unknown> = {};

    if (base) {
      Object.assign(output, base);
    }

    if (extra) {
      const sanitizedExtra = sanitizeDetails(extra);
      if (sanitizedExtra) {
        Object.assign(output, sanitizedExtra);
      }
    }

    return Object.keys(output).length > 0 ? output : null;
  } catch {
    return base;
  }
}

function createDefaultConsoleSink(): EditorLogSink {
  return (entry: EditorLogEntry): void => {
    try {
      const prefix = `[${entry.namespace}] ${entry.level.toUpperCase()} ${entry.timestamp}`;
      const details = entry.details ?? undefined;

      switch (entry.level) {
        case "debug":
          console.debug(prefix, entry.message, details ?? "");
          return;

        case "info":
          console.info(prefix, entry.message, details ?? "");
          return;

        case "warn":
          console.warn(prefix, entry.message, details ?? "");
          return;

        case "error":
          console.error(prefix, entry.message, details ?? "");
          return;

        default:
          console.log(prefix, entry.message, details ?? "");
      }
    } catch {
      // Console logging must never throw into runtime.
    }
  };
}

function createLogEntry(input: {
  readonly level: Exclude<EditorLogLevel, "silent">;
  readonly namespace: string;
  readonly message: string;
  readonly buildMode: string | null;
  readonly buildVersion: string | null;
  readonly bootId: string | null;
  readonly details: Record<string, unknown> | null;
  readonly includeTimestamp: boolean;
  readonly includeContext: boolean;
  readonly baseContext: Record<string, unknown> | null;
}): EditorLogEntry {
  const timestamp = input.includeTimestamp ? nowIsoString() : "";

  const contextDetails = input.includeContext
    ? mergeDetails(input.baseContext, input.details ?? undefined)
    : input.details;

  return {
    level: input.level,
    namespace: input.namespace,
    message: input.message,
    timestamp,
    buildMode: input.buildMode,
    buildVersion: input.buildVersion,
    bootId: input.bootId,
    details: contextDetails,
  };
}

function safeMessage(value: unknown): string {
  try {
    if (typeof value !== "string") {
      return String(value);
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : "(empty log message)";
  } catch {
    return "(unreadable log message)";
  }
}

export function createLogger(options: EditorLoggerOptions): EditorLogger {
  const namespace = sanitizeNamespace(options.namespace);
  const sink = options.sink ?? createDefaultConsoleSink();

  let minLevel = normalizeLogLevel(
    options.minLevel ?? (options.buildMode === "production" ? "info" : "debug"),
    options.buildMode === "production" ? "info" : "debug",
  );

  let enabled = options.enabled ?? true;

  const buildMode = typeof options.buildMode === "string" ? options.buildMode : null;
  const buildVersion = typeof options.buildVersion === "string" ? options.buildVersion : null;
  const bootId = typeof options.bootId === "string" ? options.bootId : null;
  const includeTimestamp = options.includeTimestamp ?? true;
  const includeContext = options.includeContext ?? true;

  const baseContext = sanitizeDetails({
    buildMode,
    buildVersion,
    bootId,
  });

  const emit = (
    level: Exclude<EditorLogLevel, "silent">,
    message: string,
    details?: Record<string, unknown>,
    contextOverride?: Record<string, unknown> | null,
    namespaceOverride?: string,
  ): void => {
    try {
      if (!shouldLog(level, minLevel, enabled)) {
        return;
      }

      const entry = createLogEntry({
        level,
        namespace: namespaceOverride ?? namespace,
        message: safeMessage(message),
        buildMode,
        buildVersion,
        bootId,
        details: sanitizeDetails(details),
        includeTimestamp,
        includeContext,
        baseContext: contextOverride ?? baseContext,
      });

      sink(entry);
    } catch {
      // Logging must never fail app execution.
    }
  };

  const makeLogger = (
    loggerNamespace: string,
    contextOverride?: Record<string, unknown>,
  ): EditorLogger => {
    const sanitizedNamespace = sanitizeNamespace(loggerNamespace);
    const sanitizedContext = mergeDetails(baseContext, contextOverride);

    return {
      namespace: sanitizedNamespace,

      debug(message: string, details?: Record<string, unknown>): void {
        emit("debug", message, details, sanitizedContext, sanitizedNamespace);
      },

      info(message: string, details?: Record<string, unknown>): void {
        emit("info", message, details, sanitizedContext, sanitizedNamespace);
      },

      warn(message: string, details?: Record<string, unknown>): void {
        emit("warn", message, details, sanitizedContext, sanitizedNamespace);
      },

      error(message: string, details?: Record<string, unknown>): void {
        emit("error", message, details, sanitizedContext, sanitizedNamespace);
      },

      child(namespaceSuffix: string, extraContext?: Record<string, unknown>): EditorLogger {
        const suffix = sanitizeNamespace(namespaceSuffix);
        const childNamespace = suffix.startsWith(sanitizedNamespace)
          ? suffix
          : `${sanitizedNamespace}.${suffix.replace(/^\.+/, "")}`;

        return makeLogger(childNamespace, {
          ...(sanitizedContext ?? {}),
          ...(extraContext ?? {}),
        });
      },

      withContext(extraContext: Record<string, unknown>): EditorLogger {
        return makeLogger(sanitizedNamespace, {
          ...(sanitizedContext ?? {}),
          ...extraContext,
        });
      },

      setMinLevel(level: EditorLogLevel): void {
        minLevel = normalizeLogLevel(level, minLevel);
      },

      getMinLevel(): EditorLogLevel {
        return minLevel;
      },

      setEnabled(nextEnabled: boolean): void {
        enabled = nextEnabled;
      },

      isEnabled(): boolean {
        return enabled;
      },
    };
  };

  return makeLogger(namespace);
}

export function createSilentLogger(namespace = "vectoplan-editor:silent"): EditorLogger {
  return createLogger({
    namespace,
    minLevel: "silent",
    enabled: false,
    sink: () => undefined,
  });
}

export function createBufferedLogSink(maxEntries = 250): {
  readonly sink: EditorLogSink;
  readonly getEntries: () => readonly EditorLogEntry[];
  readonly clear: () => void;
} {
  const entries: EditorLogEntry[] = [];
  const safeMaxEntries = Math.max(1, Math.min(5000, Math.trunc(maxEntries)));

  return {
    sink(entry: EditorLogEntry): void {
      try {
        entries.push(entry);

        while (entries.length > safeMaxEntries) {
          entries.shift();
        }
      } catch {
        // Ignore buffer failures.
      }
    },

    getEntries(): readonly EditorLogEntry[] {
      try {
        return [...entries];
      } catch {
        return [];
      }
    },

    clear(): void {
      try {
        entries.length = 0;
      } catch {
        // Ignore.
      }
    },
  };
}

export function createMultiplexLogSink(sinks: readonly EditorLogSink[]): EditorLogSink {
  return (entry: EditorLogEntry): void => {
    for (const sink of sinks) {
      try {
        sink(entry);
      } catch {
        // One sink must not break other sinks.
      }
    }
  };
}

export function logUnhandledError(
  logger: EditorLogger,
  message: string,
  error: unknown,
  details?: Record<string, unknown>,
): void {
  try {
    logger.error(message, {
      error: normalizeUnknownError(error),
      ...(details ?? {}),
    });
  } catch {
    // Ignore.
  }
}