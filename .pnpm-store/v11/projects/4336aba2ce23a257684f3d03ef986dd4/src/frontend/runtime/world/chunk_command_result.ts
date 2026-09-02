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
  // `changed` is mandatory on every normalized Chunk command result.  Do not
  // accept an arbitrary successful response merely because it has a
  // `commandType`-looking field: callers must be able to consume `changed`
  // without guessing which transport envelope they received.
  return typeof record.changed === "boolean";
}

function envelopeKeys(value: unknown): string {
  const record = recordOf(value);
  const keys = Object.keys(record).sort();
  return keys.length > 0 ? keys.join(", ") : "keine";
}

export class ChunkCommandResultContractError extends Error {
  readonly code = "chunk_command_result_contract_invalid";

  constructor(context: string, value: unknown) {
    super(
      `${context}: Der Chunk-Dienst hat kein g\u00fcltiges Command-Ergebnis geliefert `
      + `(erwartet: direktes Ergebnis oder Wrapper mit booleschem \u201echanged\u201c; `
      + `empfangene Felder: ${envelopeKeys(value)}).`,
    );
    this.name = "ChunkCommandResultContractError";
  }
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
  const wrapped = candidates.find(isNormalizedCommandResult);
  if (wrapped) return wrapped as unknown as ChunkApiCommandResult;

  if (isNormalizedCommandResult(record)) {
    return record as unknown as ChunkApiCommandResult;
  }
  return null;
}

/**
 * Resolve productive direct results and legacy wrappers, but fail loudly when
 * a source violates the command-result contract.  This keeps transport
 * compatibility without turning malformed successful responses into silent
 * no-op edits.
 */
export function requireCommandResultFromUnknown(
  value: unknown,
  context = "Chunk-Command",
): ChunkApiCommandResult {
  const result = commandResultFromUnknown(value);
  if (result) return result;
  throw new ChunkCommandResultContractError(context, value);
}
