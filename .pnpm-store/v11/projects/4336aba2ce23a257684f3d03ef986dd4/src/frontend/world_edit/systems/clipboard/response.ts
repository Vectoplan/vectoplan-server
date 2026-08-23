import type { ChunkApiCommandResult } from "@api/chunk_api_models";
import { commandResultFromUnknown } from "@runtime/world/chunk_command_result";

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The productive Chunk client returns the normalized command result directly,
 * while legacy/test sources may wrap it in `{ result }`. Keep that transport
 * detail out of the clipboard state machine.
 */
export function clipboardCommandResult(value: unknown): ChunkApiCommandResult | null {
  return commandResultFromUnknown(value);
}

/** Read the copied cells from the unmodified Chunk response body. */
export function clipboardEntriesFromCommandResult(value: unknown): readonly Record<string, unknown>[] {
  const commandResult = clipboardCommandResult(value);
  if (!commandResult) return [];

  const raw = recordOf(commandResult.raw);
  const candidates = [
    raw.clipboard,
    recordOf(raw.worldEdit).clipboard,
    recordOf(raw.result).clipboard,
    recordOf(raw.data).clipboard,
    recordOf(recordOf(raw.data).worldEdit).clipboard,
  ];
  const entries = candidates.map(arrayOf).find((candidate) => candidate.length > 0) ?? [];
  return entries.map(recordOf);
}
