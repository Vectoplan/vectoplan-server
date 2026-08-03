// services/vectoplan-editor/src/frontend/utils/ids.ts

export type EditorIdPrefix =
  | "editor"
  | "runtime"
  | "scene"
  | "world"
  | "chunk"
  | "command"
  | "request"
  | "session"
  | "target"
  | "mesh"
  | "tool"
  | "event"
  | "debug";

export interface CreateEditorIdOptions {
  readonly prefix?: EditorIdPrefix | string;
  readonly includeTimestamp?: boolean;
  readonly includeRandom?: boolean;
  readonly entropyLength?: number;
}

export interface ParsedChunkKey {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly valid: boolean;
}

export interface RuntimeSessionIdentity {
  readonly userId: string;
  readonly sessionId: string;
  readonly createdAt: string;
}

const DEFAULT_ENTROPY_LENGTH = 12;
const DEFAULT_USER_ID = "editor_user";

function nowMs(): number {
  try {
    const value = Date.now();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function nowIsoString(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function sanitizePrefix(value: unknown, fallback = "editor"): string {
  try {
    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeIdPart(value: unknown, fallback = "id"): string {
  try {
    if (typeof value !== "string" && typeof value !== "number") {
      return fallback;
    }

    const normalized = String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized.length > 0 ? normalized : fallback;
  } catch {
    return fallback;
  }
}

function randomBase36(length: number): string {
  const safeLength = Math.max(4, Math.min(64, Math.trunc(length)));

  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(Math.ceil((safeLength * 5) / 8) + 4);
      crypto.getRandomValues(bytes);

      let output = "";

      for (const byte of bytes) {
        output += (byte % 36).toString(36);

        if (output.length >= safeLength) {
          break;
        }
      }

      return output.padEnd(safeLength, "0");
    }
  } catch {
    // Fall back to Math.random below.
  }

  try {
    let output = "";

    while (output.length < safeLength) {
      output += Math.random().toString(36).slice(2);
    }

    return output.slice(0, safeLength);
  } catch {
    return "0".repeat(safeLength);
  }
}

export function createEditorId(options?: CreateEditorIdOptions): string {
  try {
    const prefix = sanitizePrefix(options?.prefix, "editor");
    const includeTimestamp = options?.includeTimestamp ?? true;
    const includeRandom = options?.includeRandom ?? true;
    const entropyLength = options?.entropyLength ?? DEFAULT_ENTROPY_LENGTH;

    const parts: string[] = [prefix];

    if (includeTimestamp) {
      parts.push(String(nowMs()));
    }

    if (includeRandom) {
      parts.push(randomBase36(entropyLength));
    }

    return parts.join("_");
  } catch {
    return `editor_${nowMs()}_${randomBase36(DEFAULT_ENTROPY_LENGTH)}`;
  }
}

export function createRuntimeId(): string {
  return createEditorId({
    prefix: "runtime",
  });
}

export function createSceneId(): string {
  return createEditorId({
    prefix: "scene",
  });
}

export function createWorldId(): string {
  return createEditorId({
    prefix: "world",
  });
}

export function createCommandId(): string {
  return createEditorId({
    prefix: "command",
  });
}

export function createRequestId(kind?: string): string {
  const suffix = sanitizeIdPart(kind, "request");

  return createEditorId({
    prefix: `request_${suffix}`,
  });
}

export function createEventId(kind?: string): string {
  const suffix = sanitizeIdPart(kind, "event");

  return createEditorId({
    prefix: `event_${suffix}`,
  });
}

export function createSessionId(userId?: string): string {
  const normalizedUserId = sanitizeIdPart(userId, DEFAULT_USER_ID);

  return createEditorId({
    prefix: `session_${normalizedUserId}`,
    entropyLength: 16,
  });
}

export function createRuntimeSessionIdentity(userId?: string): RuntimeSessionIdentity {
  const normalizedUserId = sanitizeIdPart(userId, DEFAULT_USER_ID);

  return {
    userId: normalizedUserId,
    sessionId: createSessionId(normalizedUserId),
    createdAt: nowIsoString(),
  };
}

export function createDomId(prefix: string, suffix?: string): string {
  const normalizedPrefix = sanitizePrefix(prefix, "editor_dom");
  const normalizedSuffix = suffix ? sanitizeIdPart(suffix, "") : "";

  if (normalizedSuffix.length > 0) {
    return `${normalizedPrefix}_${normalizedSuffix}_${randomBase36(8)}`;
  }

  return `${normalizedPrefix}_${randomBase36(8)}`;
}

export function chunkKeyFromCoordinates(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
): string {
  try {
    const x = Number.isFinite(chunkX) ? Math.trunc(chunkX) : 0;
    const y = Number.isFinite(chunkY) ? Math.trunc(chunkY) : 0;
    const z = Number.isFinite(chunkZ) ? Math.trunc(chunkZ) : 0;

    return `${x}:${y}:${z}`;
  } catch {
    return "0:0:0";
  }
}

export function parseChunkKey(value: unknown): ParsedChunkKey {
  try {
    if (typeof value !== "string") {
      return {
        chunkX: 0,
        chunkY: 0,
        chunkZ: 0,
        valid: false,
      };
    }

    const parts = value.trim().split(":");

    if (parts.length !== 3) {
      return {
        chunkX: 0,
        chunkY: 0,
        chunkZ: 0,
        valid: false,
      };
    }

    const chunkX = Number.parseInt(parts[0] ?? "", 10);
    const chunkY = Number.parseInt(parts[1] ?? "", 10);
    const chunkZ = Number.parseInt(parts[2] ?? "", 10);

    if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY) || !Number.isFinite(chunkZ)) {
      return {
        chunkX: 0,
        chunkY: 0,
        chunkZ: 0,
        valid: false,
      };
    }

    return {
      chunkX,
      chunkY,
      chunkZ,
      valid: true,
    };
  } catch {
    return {
      chunkX: 0,
      chunkY: 0,
      chunkZ: 0,
      valid: false,
    };
  }
}

export function cellKeyFromWorldPosition(
  x: number,
  y: number,
  z: number,
): string {
  try {
    const worldX = Number.isFinite(x) ? Math.trunc(x) : 0;
    const worldY = Number.isFinite(y) ? Math.trunc(y) : 0;
    const worldZ = Number.isFinite(z) ? Math.trunc(z) : 0;

    return `${worldX}:${worldY}:${worldZ}`;
  } catch {
    return "0:0:0";
  }
}

export function targetKeyFromParts(input: {
  readonly chunkKey?: string | null;
  readonly worldX?: number | null;
  readonly worldY?: number | null;
  readonly worldZ?: number | null;
  readonly face?: string | null;
}): string {
  try {
    const chunkKey = sanitizeIdPart(input.chunkKey ?? "chunk");
    const cellKey = cellKeyFromWorldPosition(
      input.worldX ?? 0,
      input.worldY ?? 0,
      input.worldZ ?? 0,
    );
    const face = sanitizeIdPart(input.face ?? "none");

    return `target_${chunkKey}_${cellKey.replace(/:/g, "_")}_${face}`;
  } catch {
    return createEditorId({
      prefix: "target",
    });
  }
}

export function meshKeyFromChunkKey(chunkKey: string): string {
  try {
    const normalized = sanitizeIdPart(chunkKey.replace(/:/g, "_"), "0_0_0");

    return `mesh_chunk_${normalized}`;
  } catch {
    return "mesh_chunk_0_0_0";
  }
}

export function commandCorrelationId(input?: {
  readonly commandType?: string | null;
  readonly blockTypeId?: string | null;
  readonly chunkKey?: string | null;
}): string {
  try {
    const commandType = sanitizeIdPart(input?.commandType ?? "command");
    const blockTypeId = sanitizeIdPart(input?.blockTypeId ?? "block");
    const chunkKey = sanitizeIdPart((input?.chunkKey ?? "chunk").replace(/:/g, "_"));

    return createEditorId({
      prefix: `command_${commandType}_${blockTypeId}_${chunkKey}`,
      entropyLength: 10,
    });
  } catch {
    return createCommandId();
  }
}

export function stableHash(input: unknown): string {
  try {
    const serialized = typeof input === "string" ? input : JSON.stringify(input);
    let hash = 2166136261;

    for (let index = 0; index < serialized.length; index += 1) {
      hash ^= serialized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
  } catch {
    return randomBase36(8);
  }
}

export function stableId(prefix: string, input: unknown): string {
  try {
    return `${sanitizePrefix(prefix)}_${stableHash(input)}`;
  } catch {
    return createEditorId({
      prefix,
      entropyLength: 8,
    });
  }
}

export function ensureUniqueId(
  candidate: string,
  usedIds: ReadonlySet<string>,
  fallbackPrefix = "editor",
): string {
  try {
    const normalized = sanitizeIdPart(candidate, "");

    if (normalized.length > 0 && !usedIds.has(normalized)) {
      return normalized;
    }

    for (let index = 0; index < 1000; index += 1) {
      const next = `${sanitizePrefix(fallbackPrefix)}_${index}_${randomBase36(6)}`;

      if (!usedIds.has(next)) {
        return next;
      }
    }

    return createEditorId({
      prefix: fallbackPrefix,
    });
  } catch {
    return createEditorId({
      prefix: fallbackPrefix,
    });
  }
}

export function isValidChunkKey(value: unknown): value is string {
  try {
    return parseChunkKey(value).valid;
  } catch {
    return false;
  }
}

export function isLikelyEditorId(value: unknown): value is string {
  try {
    if (typeof value !== "string") {
      return false;
    }

    const trimmed = value.trim();

    return /^[a-z0-9][a-z0-9_.:-]*$/i.test(trimmed);
  } catch {
    return false;
  }
}