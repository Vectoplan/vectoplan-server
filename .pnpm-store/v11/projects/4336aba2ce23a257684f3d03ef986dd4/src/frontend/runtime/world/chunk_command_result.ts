import type { ChunkApiCommandResult } from "../../api/chunk_api_models";

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nestedRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  let current: unknown = value;
  for (const key of keys) current = recordOf(current)[key];
  return recordOf(current);
}

function isNormalizedCommandResult(record: Record<string, unknown>): boolean {
  if (record.ok !== true) return false;
  return typeof record.commandType === "string"
    || typeof record.changed === "boolean"
    || Array.isArray(record.changedChunks)
    || Array.isArray(record.dirtyChunks);
}

/**
 * Accept both the ChunkSource wrapper and the normalized Chunk API result.
 * Library placement currently returns the normalized result directly, while
 * older callers and a few test sources still wrap it in `result`.
 */
export function commandResultFromUnknown(value: unknown): ChunkApiCommandResult | null {
  const record = recordOf(value);
  const candidates = [
    recordOf(record.result),
    nestedRecord(record, ["raw", "result"]),
    nestedRecord(record, ["payload", "result"]),
  ];
  const wrapped = candidates.find((candidate) => Object.keys(candidate).length > 0);
  if (wrapped) return wrapped as unknown as ChunkApiCommandResult;

  if (isNormalizedCommandResult(record)) {
    return record as unknown as ChunkApiCommandResult;
  }
  return null;
}
