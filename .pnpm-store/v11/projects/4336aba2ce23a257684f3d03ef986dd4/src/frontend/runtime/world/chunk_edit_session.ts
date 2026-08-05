// services/vectoplan-editor/src/frontend/runtime/world/chunk_edit_session.ts
import type {
  ChunkApiCommandPayload,
  ChunkApiCommandResult,
  ChunkApiFailedResult,
  ChunkApiWorldPosition,
} from "@api/chunk_api_models";
import {
  CHUNK_API_DEFAULT_SESSION_ID_PREFIX,
  CHUNK_API_DEFAULT_USER_ID,
  normalizeChunkApiWorldPosition,
} from "@api/chunk_api_models";
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
} from "@api/editor_inventory_models";
import type { EditorLogger } from "@utils/logger";
import { commandCorrelationId, createSessionId } from "@utils/ids";
import { normalizeUnknownError, safeBoolean, safeInteger, safeString, uniqueStrings } from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type ChunkEditSessionStatus =
  | "created"
  | "active"
  | "command-pending"
  | "idle"
  | "failed"
  | "destroyed";

export interface ChunkEditSessionIdentity {
  readonly userId: string;
  readonly sessionId: string;
  readonly createdAt: string;
}

export interface ChunkEditPlacementContext {
  readonly kind: "chunk-edit-placement-context.v1";
  readonly source: "library" | "legacy-block" | "remove" | "unknown";
  readonly runtimeBlockTypeId: string | null;
  readonly blockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly inventoryItemId: string | null;
  readonly inventorySlotIndex: number | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly commandMetadata: Record<string, unknown>;
  readonly valid: boolean;
  readonly invalidReason: string | null;
  readonly includeLibraryMetadataInCommand: boolean;
  readonly requireLibraryIdentity: boolean;
  readonly createdAt: string;
}

export interface ChunkEditCommandHistoryEntry {
  readonly correlationId: string;
  readonly command: ChunkApiCommandPayload;
  readonly placementContext: ChunkEditPlacementContext | null;
  readonly submittedAt: string;
  readonly completedAt: string | null;
  readonly result: ChunkApiCommandResult | null;
  readonly error: ChunkApiFailedResult | null;
}

export interface ChunkEditSessionSnapshot {
  readonly kind: "chunk-edit-session-snapshot.v1";
  readonly identity: ChunkEditSessionIdentity;
  readonly status: ChunkEditSessionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly pendingCommand: ChunkApiCommandPayload | null;
  readonly pendingPlacementContext: ChunkEditPlacementContext | null;
  readonly lastCommand: ChunkApiCommandPayload | null;
  readonly lastPlacementContext: ChunkEditPlacementContext | null;
  readonly lastResult: ChunkApiCommandResult | null;
  readonly lastError: ChunkApiFailedResult | null;
  readonly lastDirtyChunkKeys: readonly string[];
  readonly commandCount: number;
  readonly pendingCommandCount: number;
  readonly failedCommandCount: number;
  readonly successfulCommandCount: number;
  readonly invalidContextCount: number;
  readonly libraryCommandCount: number;
  readonly legacyBlockCommandCount: number;
  readonly removeCommandCount: number;
  readonly history: readonly ChunkEditCommandHistoryEntry[];
}

export interface CreateChunkEditSessionOptions {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly logger?: EditorLogger;
  readonly maxHistoryEntries?: number;
}

export interface PrepareChunkCommandOptions {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly correlationId?: string;

  /**
   * Library-/VPLIB-aware placement context.
   *
   * Wichtig:
   * - `runtimeBlockTypeId` ist aktuell der technische Adapter zum Chunk-Service.
   * - `libraryRef` / `placementCommand` bleiben die fachliche Wahrheit.
   * - Standardmäßig wird zusätzliche Library-Metadata NICHT in den HTTP-Command
   *   geschrieben, damit ein strikt validierender Chunk-Service nicht bricht.
   * - Die Session merkt sich den Kontext lokal in History/Snapshot.
   */
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;

  /**
   * Nur aktivieren, wenn der Backend-/Chunk-Service unbekannte Metadata-Felder
   * toleriert oder explizit unterstützt.
   */
  readonly includeLibraryMetadataInCommand?: boolean;

  /**
   * Standard: false für `prepareSetBlockCommand`, true für
   * `preparePlaceLibraryItemCommand`.
   */
  readonly requireLibraryIdentity?: boolean;
}

export interface PrepareLibraryPlacementCommandOptions extends PrepareChunkCommandOptions {
  readonly requireLibraryIdentity?: boolean;
}

export interface ChunkEditLibraryPlacementInput {
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
}

export interface ChunkEditSessionHandle {
  readonly kind: "vectoplan-editor-chunk-edit-session.v1";

  getIdentity(): ChunkEditSessionIdentity;
  getStatus(): ChunkEditSessionStatus;
  getSnapshot(): ChunkEditSessionSnapshot;

  /**
   * Legacy-kompatibler SetBlock-Pfad.
   *
   * Für Library/VPLIB sollte der Aufrufer `runtimeBlockTypeId` als blockTypeId
   * übergeben und zusätzlich `libraryRef` / `placementCommand` in options
   * setzen.
   */
  prepareSetBlockCommand(
    position: ChunkApiWorldPosition,
    blockTypeId: string,
    options?: PrepareChunkCommandOptions,
  ): ChunkApiCommandPayload;

  /**
   * Neuer semantischer Library-/VPLIB-Pfad.
   *
   * Intern wird weiterhin ein SetBlock-Command erzeugt, solange der Chunk-Service
   * nur Runtime-Blocktypen versteht.
   */
  preparePlaceLibraryItemCommand(
    position: ChunkApiWorldPosition,
    placement: ChunkEditLibraryPlacementInput,
    options?: PrepareLibraryPlacementCommandOptions,
  ): ChunkApiCommandPayload;

  prepareRemoveBlockCommand(
    position: ChunkApiWorldPosition,
    options?: PrepareChunkCommandOptions,
  ): ChunkApiCommandPayload;

  markCommandPending(command: ChunkApiCommandPayload, correlationId?: string): ChunkEditCommandHistoryEntry;
  markCommandResult(result: ChunkApiCommandResult): ChunkEditCommandHistoryEntry | null;
  markCommandFailed(error: ChunkApiFailedResult): ChunkEditCommandHistoryEntry | null;

  getLastDirtyChunkKeys(): readonly string[];
  clearLastDirtyChunkKeys(): void;

  reset(reason?: string): void;
  destroy(reason?: string): void;
}

const SESSION_KIND = "vectoplan-editor-chunk-edit-session.v1" as const;
const SNAPSHOT_KIND = "chunk-edit-session-snapshot.v1" as const;
const PLACEMENT_CONTEXT_KIND = "chunk-edit-placement-context.v1" as const;
const DEFAULT_MAX_HISTORY_ENTRIES = 100;
const PRODUCTIVE_INVENTORY_ROUTE = "/editor/api/inventory" as const;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "1970-01-01T00:00:00.000Z";
    }
  }
}

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Edit-session logging must never break command flow.
  }
}

function logWarn(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.warn?.(message, details);
  } catch {
    // Edit-session logging must never break command flow.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readAny(value: unknown, keys: readonly string[]): unknown {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const candidate = value[key];

      if (candidate !== undefined && candidate !== null) {
        return candidate;
      }
    }
  }

  return null;
}

function normalizeText(value: unknown): string | null {
  const normalized = safeString(value, "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalIdentifier(value: unknown): string | null {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeUserId(value: unknown): string {
  try {
    const normalized = safeString(value, CHUNK_API_DEFAULT_USER_ID)
      .replace(/[^a-zA-Z0-9_.:-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized.length > 0 ? normalized : CHUNK_API_DEFAULT_USER_ID;
  } catch {
    return CHUNK_API_DEFAULT_USER_ID;
  }
}

function normalizeSessionId(value: unknown, userId: string): string {
  try {
    const normalized = safeString(value, "")
      .replace(/[^a-zA-Z0-9_.:-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (normalized.length > 0) {
      return normalized;
    }

    return createSessionId(userId || CHUNK_API_DEFAULT_SESSION_ID_PREFIX);
  } catch {
    return `${CHUNK_API_DEFAULT_SESSION_ID_PREFIX}_${Date.now()}`;
  }
}

function normalizeWorldPosition(position: ChunkApiWorldPosition): ChunkApiWorldPosition {
  try {
    return normalizeChunkApiWorldPosition(position);
  } catch {
    const numberOrZero = (value: unknown): number => {
      const numeric =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number.parseFloat(value.trim())
            : Number.NaN;

      return Number.isFinite(numeric) ? numeric : 0;
    };

    return {
      x: numberOrZero(position.x),
      y: numberOrZero(position.y),
      z: numberOrZero(position.z),
    };
  }
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = safeString(value, "").trim();
  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

function normalizeBlockTypeId(value: unknown): string {
  const normalized = safeString(value, "").trim();

  if (isForbiddenDebugBlockTypeId(normalized)) {
    return "";
  }

  return normalized;
}

function normalizeRuntimeBlockTypeId(value: unknown): string | null {
  const normalized = normalizeBlockTypeId(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeMaxHistoryEntries(value: unknown): number {
  return safeInteger(value, DEFAULT_MAX_HISTORY_ENTRIES, {
    min: 1,
    max: 1_000,
  });
}

function normalizeInventorySlotIndex(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const slot = safeInteger(value, -1, {
    min: -1,
    max: 10_000,
  });

  return slot >= 0 ? slot : null;
}

function normalizeLibraryRef(value: unknown): EditorInventoryLibraryRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const libraryItemId = normalizeOptionalIdentifier(readAny(value, ["libraryItemId", "library_item_id", "itemId", "item_id"]));
  const familyId = normalizeOptionalIdentifier(readAny(value, ["familyId", "family_id"]));
  const packageId = normalizeOptionalIdentifier(readAny(value, ["packageId", "package_id"]));
  const vplibUid = normalizeOptionalIdentifier(readAny(value, ["vplibUid", "vplib_uid"]));
  const variantId = normalizeOptionalIdentifier(readAny(value, ["variantId", "variant_id"])) ?? "default";
  const revisionHash = normalizeOptionalIdentifier(readAny(value, ["revisionHash", "revision_hash"]));
  const objectKind = normalizeOptionalIdentifier(readAny(value, ["objectKind", "object_kind"]));

  if (!libraryItemId && !familyId && !vplibUid) {
    return null;
  }

  return {
    ...value,
    source: safeString(value.source, "vectoplan-library"),
    kind: "vplib",
    libraryItemId,
    familyId,
    packageId,
    vplibUid,
    variantId,
    revisionHash,
    objectKind,
    stableKey: vplibUid ? `vplib:${vplibUid}` : familyId ? `family:${familyId}` : libraryItemId,
    valid: Boolean(familyId || vplibUid || libraryItemId),
  } as EditorInventoryLibraryRef;
}

function normalizePlacementCommand(value: unknown): EditorInventoryPlacementCommand | null {
  if (!isRecord(value)) {
    return null;
  }

  const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
    readAny(value, [
      "runtimeBlockTypeId",
      "runtime_block_type_id",
      "blockTypeId",
      "block_type_id",
    ]),
  );
  const libraryRef = normalizeLibraryRef(readAny(value, ["libraryRef", "library_ref"]));

  if (!runtimeBlockTypeId && !libraryRef) {
    return null;
  }

  return {
    ...value,
    kind: safeString(value.kind, "PlaceLibraryItem"),
    source: safeString(value.source, "vectoplan-library"),
    runtimeBlockTypeId,
    blockTypeId: normalizeRuntimeBlockTypeId(readAny(value, ["blockTypeId", "block_type_id"])) ?? runtimeBlockTypeId,
    libraryRef,
    placeable: true,
  } as EditorInventoryPlacementCommand;
}

function readRuntimeBlockTypeIdFromPlacementCommand(command: EditorInventoryPlacementCommand | null): string | null {
  return normalizeRuntimeBlockTypeId(
    readAny(command, [
      "runtimeBlockTypeId",
      "runtime_block_type_id",
      "blockTypeId",
      "block_type_id",
    ]),
  );
}

function readLibraryRefFromPlacementCommand(command: EditorInventoryPlacementCommand | null): EditorInventoryLibraryRef | null {
  return normalizeLibraryRef(readAny(command, ["libraryRef", "library_ref"]));
}

function readMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

function mergeMetadata(
  left: unknown,
  right: unknown,
): Record<string, unknown> {
  return {
    ...readMetadata(left),
    ...readMetadata(right),
  };
}

function toCommandMetadata(context: ChunkEditPlacementContext): Record<string, unknown> {
  return {
    kind: context.kind,
    source: context.source,
    runtimeBlockTypeId: context.runtimeBlockTypeId,
    blockTypeId: context.blockTypeId,
    libraryItemId: context.libraryItemId,
    inventoryItemId: context.inventoryItemId,
    inventorySlotIndex: context.inventorySlotIndex,
    familyId: context.familyId,
    packageId: context.packageId,
    vplibUid: context.vplibUid,
    variantId: context.variantId,
    revisionHash: context.revisionHash,
    objectKind: context.objectKind,
    libraryRef: context.libraryRef,
    placementCommand: context.placementCommand,
    commandMetadata: context.commandMetadata,
    valid: context.valid,
    invalidReason: context.invalidReason,
    createdAt: context.createdAt,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
  };
}

function createCommandCorrelationId(
  command: ChunkApiCommandPayload,
  explicitCorrelationId?: string,
): string {
  try {
    const normalized = safeString(explicitCorrelationId, "");

    if (normalized.length > 0) {
      return normalized;
    }

    return commandCorrelationId({
      commandType: command.type,
      blockTypeId: "blockTypeId" in command ? command.blockTypeId : null,
    });
  } catch {
    return `command_${command.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function createHistoryEntry(
  command: ChunkApiCommandPayload,
  placementContext: ChunkEditPlacementContext | null,
  correlationId?: string,
): ChunkEditCommandHistoryEntry {
  return {
    correlationId: createCommandCorrelationId(command, correlationId),
    command,
    placementContext,
    submittedAt: now(),
    completedAt: null,
    result: null,
    error: null,
  };
}

function completeHistoryEntryWithResult(
  entry: ChunkEditCommandHistoryEntry,
  result: ChunkApiCommandResult,
): ChunkEditCommandHistoryEntry {
  return {
    ...entry,
    completedAt: now(),
    result,
    error: null,
  };
}

function completeHistoryEntryWithError(
  entry: ChunkEditCommandHistoryEntry,
  error: ChunkApiFailedResult,
): ChunkEditCommandHistoryEntry {
  return {
    ...entry,
    completedAt: now(),
    result: null,
    error,
  };
}

function failedResultMessage(error: ChunkApiFailedResult | null): string | null {
  try {
    return error?.error?.message ?? null;
  } catch {
    return null;
  }
}

function collectDirtyChunkKeysFromResult(result: ChunkApiCommandResult): readonly string[] {
  try {
    return uniqueStrings([
      ...(result.dirtyChunks ?? []),
      ...(result.changedChunks ?? []),
    ]);
  } catch {
    return [];
  }
}

function isSuccessfulCommandStatus(status: string): boolean {
  return status === "applied" || status === "noop";
}

function countHistory(
  history: readonly ChunkEditCommandHistoryEntry[],
  predicate: (entry: ChunkEditCommandHistoryEntry) => boolean,
): number {
  try {
    return history.filter(predicate).length;
  } catch {
    return 0;
  }
}

function hasLibraryIdentity(context: ChunkEditPlacementContext): boolean {
  return Boolean(
    context.libraryRef
      || context.familyId
      || context.vplibUid
      || context.libraryItemId,
  );
}

function contextInvalidReason(input: {
  readonly source: ChunkEditPlacementContext["source"];
  readonly runtimeBlockTypeId: string | null;
  readonly requireLibraryIdentity: boolean;
  readonly libraryIdentity: boolean;
}): string | null {
  if (input.source === "remove") {
    return null;
  }

  if (!input.runtimeBlockTypeId) {
    return "missing-runtime-block-type-id";
  }

  if (isForbiddenDebugBlockTypeId(input.runtimeBlockTypeId)) {
    return "forbidden-debug-runtime-block-type-id";
  }

  if (input.requireLibraryIdentity && !input.libraryIdentity) {
    return "missing-library-identity";
  }

  return null;
}

function createPlacementContext(
  input: ChunkEditLibraryPlacementInput | null | undefined,
  options: PrepareChunkCommandOptions | null | undefined,
  fallbackRuntimeBlockTypeId: string | null,
  source: ChunkEditPlacementContext["source"],
): ChunkEditPlacementContext {
  const rawPlacementCommand = normalizePlacementCommand(
    options?.placementCommand
      ?? input?.placementCommand
      ?? null,
  );
  const rawLibraryRef = normalizeLibraryRef(
    options?.libraryRef
      ?? input?.libraryRef
      ?? readLibraryRefFromPlacementCommand(rawPlacementCommand)
      ?? null,
  );

  const runtimeBlockTypeId =
    normalizeRuntimeBlockTypeId(options?.runtimeBlockTypeId)
    ?? normalizeRuntimeBlockTypeId(input?.runtimeBlockTypeId)
    ?? readRuntimeBlockTypeIdFromPlacementCommand(rawPlacementCommand)
    ?? normalizeRuntimeBlockTypeId(options?.blockTypeId)
    ?? normalizeRuntimeBlockTypeId(input?.blockTypeId)
    ?? fallbackRuntimeBlockTypeId;

  const blockTypeId =
    normalizeRuntimeBlockTypeId(options?.blockTypeId)
    ?? normalizeRuntimeBlockTypeId(input?.blockTypeId)
    ?? runtimeBlockTypeId;

  const libraryItemId =
    normalizeOptionalIdentifier(options?.libraryItemId)
    ?? normalizeOptionalIdentifier(input?.libraryItemId)
    ?? normalizeOptionalIdentifier(readAny(rawLibraryRef, ["libraryItemId", "library_item_id"]));

  const familyId =
    normalizeOptionalIdentifier(options?.familyId)
    ?? normalizeOptionalIdentifier(input?.familyId)
    ?? normalizeOptionalIdentifier(readAny(rawLibraryRef, ["familyId", "family_id"]));

  const packageId =
    normalizeOptionalIdentifier(options?.packageId)
    ?? normalizeOptionalIdentifier(input?.packageId)
    ?? normalizeOptionalIdentifier(readAny(rawLibraryRef, ["packageId", "package_id"]));

  const vplibUid =
    normalizeOptionalIdentifier(options?.vplibUid)
    ?? normalizeOptionalIdentifier(input?.vplibUid)
    ?? normalizeOptionalIdentifier(readAny(rawLibraryRef, ["vplibUid", "vplib_uid"]));

  const variantId =
    normalizeOptionalIdentifier(options?.variantId)
    ?? normalizeOptionalIdentifier(input?.variantId)
    ?? normalizeOptionalIdentifier(readAny(rawLibraryRef, ["variantId", "variant_id"]))
    ?? "default";

  const revisionHash =
    normalizeOptionalIdentifier(options?.revisionHash)
    ?? normalizeOptionalIdentifier(input?.revisionHash)
    ?? normalizeOptionalIdentifier(readAny(rawLibraryRef, ["revisionHash", "revision_hash"]));

  const objectKind =
    normalizeOptionalIdentifier(options?.objectKind)
    ?? normalizeOptionalIdentifier(input?.objectKind)
    ?? normalizeOptionalIdentifier(readAny(rawLibraryRef, ["objectKind", "object_kind"]));

  const inventoryItemId =
    normalizeOptionalIdentifier(options?.inventoryItemId)
    ?? normalizeOptionalIdentifier(input?.inventoryItemId);

  const inventorySlotIndex =
    normalizeInventorySlotIndex(options?.inventorySlotIndex)
    ?? normalizeInventorySlotIndex(input?.inventorySlotIndex);

  const commandMetadata = mergeMetadata(input?.commandMetadata, options?.commandMetadata);
  const requireLibraryIdentity = source === "library"
    ? options?.requireLibraryIdentity ?? true
    : safeBoolean(options?.requireLibraryIdentity, false);
  const includeLibraryMetadataInCommand = safeBoolean(options?.includeLibraryMetadataInCommand, false);

  const libraryRef: EditorInventoryLibraryRef | null = rawLibraryRef
    ? {
        ...rawLibraryRef,
        libraryItemId: rawLibraryRef.libraryItemId ?? libraryItemId,
        familyId: rawLibraryRef.familyId ?? familyId,
        packageId: rawLibraryRef.packageId ?? packageId,
        vplibUid: rawLibraryRef.vplibUid ?? vplibUid,
        variantId: rawLibraryRef.variantId ?? variantId,
        revisionHash: rawLibraryRef.revisionHash ?? revisionHash,
        objectKind: rawLibraryRef.objectKind ?? objectKind,
        valid: rawLibraryRef.valid ?? Boolean(familyId || vplibUid || libraryItemId),
      }
    : familyId || vplibUid || libraryItemId
      ? {
          source: "vectoplan-library",
          kind: "vplib",
          libraryItemId,
          familyId,
          packageId,
          vplibUid,
          variantId,
          revisionHash,
          objectKind,
          stableKey: vplibUid ? `vplib:${vplibUid}` : familyId ? `family:${familyId}` : libraryItemId,
          valid: Boolean(familyId || vplibUid || libraryItemId),
        } as EditorInventoryLibraryRef
      : null;

  const placementCommand: EditorInventoryPlacementCommand | null = rawPlacementCommand
    ? {
        ...rawPlacementCommand,
        runtimeBlockTypeId: rawPlacementCommand.runtimeBlockTypeId ?? runtimeBlockTypeId,
        blockTypeId: rawPlacementCommand.blockTypeId ?? runtimeBlockTypeId,
        libraryRef: rawPlacementCommand.libraryRef ?? libraryRef,
      }
    : runtimeBlockTypeId && (familyId || vplibUid || libraryRef)
      ? {
          kind: "PlaceLibraryItem",
          source: "vectoplan-library",
          runtimeBlockTypeId,
          blockTypeId: runtimeBlockTypeId,
          libraryRef,
          placeable: true,
        } as EditorInventoryPlacementCommand
      : null;

  const libraryIdentity = Boolean(libraryRef || placementCommand || familyId || vplibUid || libraryItemId);
  const invalidReason = contextInvalidReason({
    source,
    runtimeBlockTypeId,
    requireLibraryIdentity,
    libraryIdentity,
  });

  return {
    kind: PLACEMENT_CONTEXT_KIND,
    source,
    runtimeBlockTypeId,
    blockTypeId,
    libraryItemId,
    inventoryItemId,
    inventorySlotIndex,
    familyId,
    packageId,
    vplibUid,
    variantId,
    revisionHash,
    objectKind,
    libraryRef,
    placementCommand,
    commandMetadata,
    valid: invalidReason === null,
    invalidReason,
    includeLibraryMetadataInCommand,
    requireLibraryIdentity,
    createdAt: now(),
  };
}

function assertValidPlacementContext(context: ChunkEditPlacementContext): void {
  if (!context.valid) {
    throw new Error(`Invalid placement context: ${context.invalidReason ?? "unknown"}.`);
  }

  if (context.source === "library" && !hasLibraryIdentity(context)) {
    throw new Error("Library placement requires Library/VPLIB identity.");
  }

  if (context.source !== "remove" && !context.runtimeBlockTypeId) {
    throw new Error("Placement requires runtimeBlockTypeId.");
  }
}

function enrichCommandWithMetadataIfRequested(
  command: ChunkApiCommandPayload,
  context: ChunkEditPlacementContext,
): ChunkApiCommandPayload {
  if (!context.includeLibraryMetadataInCommand) {
    return command;
  }

  const enriched = {
    ...command,
    editorPlacement: toCommandMetadata(context),
  } as ChunkApiCommandPayload & Record<string, unknown>;

  return enriched as ChunkApiCommandPayload;
}

export function createChunkEditSession(
  options?: CreateChunkEditSessionOptions,
): ChunkEditSessionHandle {
  const logger = options?.logger;
  const maxHistoryEntries = normalizeMaxHistoryEntries(options?.maxHistoryEntries);
  const userId = normalizeUserId(options?.userId);
  const sessionId = normalizeSessionId(options?.sessionId, userId);
  const createdAt = now();

  let status: ChunkEditSessionStatus = "created";
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;

  let pendingCommand: ChunkApiCommandPayload | null = null;
  let pendingPlacementContext: ChunkEditPlacementContext | null = null;
  let lastCommand: ChunkApiCommandPayload | null = null;
  let lastPlacementContext: ChunkEditPlacementContext | null = null;
  let lastResult: ChunkApiCommandResult | null = null;
  let lastError: ChunkApiFailedResult | null = null;
  let lastDirtyChunkKeys: readonly string[] = [];

  const history: ChunkEditCommandHistoryEntry[] = [];
  const commandPlacementContext = new WeakMap<object, ChunkEditPlacementContext>();

  const identity: ChunkEditSessionIdentity = {
    userId,
    sessionId,
    createdAt,
  };

  function assertAlive(action: string): void {
    if (status === "destroyed") {
      throw new Error(`ChunkEditSession is destroyed. Action '${action}' is not allowed.`);
    }
  }

  function setStatus(nextStatus: ChunkEditSessionStatus): void {
    status = nextStatus;
    updatedAt = now();

    if (nextStatus === "destroyed") {
      destroyedAt = updatedAt;
    }
  }

  function pushHistory(entry: ChunkEditCommandHistoryEntry): ChunkEditCommandHistoryEntry {
    history.push(entry);

    while (history.length > maxHistoryEntries) {
      history.shift();
    }

    updatedAt = now();

    return entry;
  }

  function latestPendingHistoryIndex(): number {
    try {
      for (let index = history.length - 1; index >= 0; index -= 1) {
        const entry = history[index];

        if (entry && entry.completedAt === null && entry.result === null && entry.error === null) {
          return index;
        }
      }

      return history.length - 1;
    } catch {
      return -1;
    }
  }

  function updateLatestHistoryEntry(
    updater: (entry: ChunkEditCommandHistoryEntry) => ChunkEditCommandHistoryEntry,
  ): ChunkEditCommandHistoryEntry | null {
    const index = latestPendingHistoryIndex();

    if (index < 0) {
      return null;
    }

    const current = history[index];

    if (!current) {
      return null;
    }

    const next = updater(current);
    history[index] = next;
    updatedAt = now();

    return next;
  }

  function resolveUserId(value: unknown): string {
    return normalizeUserId(value ?? identity.userId);
  }

  function resolveSessionId(value: unknown): string {
    return normalizeSessionId(value ?? identity.sessionId, identity.userId);
  }

  function rememberPlacementContext(
    command: ChunkApiCommandPayload,
    context: ChunkEditPlacementContext,
  ): void {
    try {
      commandPlacementContext.set(command as unknown as object, context);
    } catch {
      // Context is diagnostic/future metadata. Losing it must not break command flow.
    }
  }

  function getPlacementContextForCommand(command: ChunkApiCommandPayload): ChunkEditPlacementContext | null {
    try {
      return commandPlacementContext.get(command as unknown as object) ?? null;
    } catch {
      return null;
    }
  }

  function buildSetBlockCommand(
    position: ChunkApiWorldPosition,
    runtimeBlockTypeId: string,
    prepareOptions?: PrepareChunkCommandOptions,
    placementInput?: ChunkEditLibraryPlacementInput | null,
    source: ChunkEditPlacementContext["source"] = "legacy-block",
  ): ChunkApiCommandPayload {
    const normalizedRuntimeBlockTypeId = normalizeRuntimeBlockTypeId(runtimeBlockTypeId);

    if (!normalizedRuntimeBlockTypeId) {
      throw new Error("Cannot prepare SetBlock command without runtimeBlockTypeId/blockTypeId.");
    }

    const context = createPlacementContext(
      placementInput ?? null,
      prepareOptions ?? null,
      normalizedRuntimeBlockTypeId,
      source,
    );

    if (prepareOptions?.requireLibraryIdentity === true || source === "library") {
      assertValidPlacementContext(context);
    }

    if (isForbiddenDebugBlockTypeId(context.runtimeBlockTypeId)) {
      throw new Error(`Forbidden debug block type '${context.runtimeBlockTypeId}' cannot be used.`);
    }

    const baseCommand: ChunkApiCommandPayload = {
      type: "SetBlock",
      userId: resolveUserId(prepareOptions?.userId),
      sessionId: resolveSessionId(prepareOptions?.sessionId),
      position: normalizeWorldPosition(position),
      blockTypeId: context.runtimeBlockTypeId ?? normalizedRuntimeBlockTypeId,
    };

    const command = enrichCommandWithMetadataIfRequested(baseCommand, context);

    rememberPlacementContext(command, context);

    return command;
  }

  const session: ChunkEditSessionHandle = {
    kind: SESSION_KIND,

    getIdentity(): ChunkEditSessionIdentity {
      return identity;
    },

    getStatus(): ChunkEditSessionStatus {
      return status;
    },

    getSnapshot(): ChunkEditSessionSnapshot {
      return {
        kind: SNAPSHOT_KIND,
        identity,
        status,
        createdAt,
        updatedAt,
        destroyedAt,
        pendingCommand,
        pendingPlacementContext,
        lastCommand,
        lastPlacementContext,
        lastResult,
        lastError,
        lastDirtyChunkKeys,
        commandCount: history.length,
        pendingCommandCount: countHistory(history, (entry) => entry.completedAt === null),
        failedCommandCount: countHistory(history, (entry) => entry.error !== null),
        successfulCommandCount: countHistory(history, (entry) => entry.result !== null && isSuccessfulCommandStatus(entry.result.commandStatus)),
        invalidContextCount: countHistory(history, (entry) => entry.placementContext?.valid === false),
        libraryCommandCount: countHistory(history, (entry) => entry.placementContext?.source === "library"),
        legacyBlockCommandCount: countHistory(history, (entry) => entry.placementContext?.source === "legacy-block"),
        removeCommandCount: countHistory(history, (entry) => entry.placementContext?.source === "remove"),
        history: [...history],
      };
    },

    prepareSetBlockCommand(
      position: ChunkApiWorldPosition,
      blockTypeId: string,
      prepareOptions?: PrepareChunkCommandOptions,
    ): ChunkApiCommandPayload {
      assertAlive("prepareSetBlockCommand");

      const runtimeBlockTypeId =
        normalizeRuntimeBlockTypeId(prepareOptions?.runtimeBlockTypeId)
        ?? normalizeRuntimeBlockTypeId(prepareOptions?.blockTypeId)
        ?? normalizeRuntimeBlockTypeId(blockTypeId);

      if (!runtimeBlockTypeId) {
        throw new Error("Cannot prepare SetBlock command without blockTypeId.");
      }

      const hasLibraryData = Boolean(
        prepareOptions?.libraryRef
          || prepareOptions?.placementCommand
          || prepareOptions?.familyId
          || prepareOptions?.vplibUid
          || prepareOptions?.libraryItemId,
      );

      return buildSetBlockCommand(
        position,
        runtimeBlockTypeId,
        {
          ...prepareOptions,
          runtimeBlockTypeId,
          requireLibraryIdentity: prepareOptions?.requireLibraryIdentity ?? false,
        },
        null,
        hasLibraryData ? "library" : "legacy-block",
      );
    },

    preparePlaceLibraryItemCommand(
      position: ChunkApiWorldPosition,
      placement: ChunkEditLibraryPlacementInput,
      prepareOptions?: PrepareLibraryPlacementCommandOptions,
    ): ChunkApiCommandPayload {
      assertAlive("preparePlaceLibraryItemCommand");

      const normalizedPlacementCommand = normalizePlacementCommand(placement.placementCommand);
      const runtimeBlockTypeId =
        normalizeRuntimeBlockTypeId(prepareOptions?.runtimeBlockTypeId)
        ?? normalizeRuntimeBlockTypeId(placement.runtimeBlockTypeId)
        ?? readRuntimeBlockTypeIdFromPlacementCommand(normalizedPlacementCommand)
        ?? normalizeRuntimeBlockTypeId(prepareOptions?.blockTypeId)
        ?? normalizeRuntimeBlockTypeId(placement.blockTypeId);

      if (!runtimeBlockTypeId) {
        throw new Error("Cannot prepare Library placement command without runtimeBlockTypeId.");
      }

      return buildSetBlockCommand(
        position,
        runtimeBlockTypeId,
        {
          ...prepareOptions,
          runtimeBlockTypeId,
          requireLibraryIdentity: prepareOptions?.requireLibraryIdentity ?? true,
        },
        {
          ...placement,
          runtimeBlockTypeId,
          placementCommand: normalizedPlacementCommand ?? placement.placementCommand ?? null,
        },
        "library",
      );
    },

    prepareRemoveBlockCommand(
      position: ChunkApiWorldPosition,
      prepareOptions?: PrepareChunkCommandOptions,
    ): ChunkApiCommandPayload {
      assertAlive("prepareRemoveBlockCommand");

      const command: ChunkApiCommandPayload = {
        type: "RemoveBlock",
        userId: resolveUserId(prepareOptions?.userId),
        sessionId: resolveSessionId(prepareOptions?.sessionId),
        position: normalizeWorldPosition(position),
      };

      const context = createPlacementContext(
        null,
        prepareOptions ?? null,
        null,
        "remove",
      );

      rememberPlacementContext(command, context);

      return command;
    },

    markCommandPending(
      command: ChunkApiCommandPayload,
      correlationId?: string,
    ): ChunkEditCommandHistoryEntry {
      assertAlive("markCommandPending");

      const placementContext = getPlacementContextForCommand(command);

      pendingCommand = command;
      pendingPlacementContext = placementContext;
      lastCommand = command;
      lastPlacementContext = placementContext;
      lastResult = null;
      lastError = null;
      setStatus("command-pending");

      const entry = pushHistory(createHistoryEntry(command, placementContext, correlationId));

      logDebug(logger, "Chunk command marked pending.", {
        commandType: command.type,
        correlationId: entry.correlationId,
        runtimeBlockTypeId: placementContext?.runtimeBlockTypeId ?? ("blockTypeId" in command ? command.blockTypeId : null),
        familyId: placementContext?.familyId ?? null,
        vplibUid: placementContext?.vplibUid ?? null,
        source: placementContext?.source ?? null,
        valid: placementContext?.valid ?? null,
        invalidReason: placementContext?.invalidReason ?? null,
      });

      return entry;
    },

    markCommandResult(result: ChunkApiCommandResult): ChunkEditCommandHistoryEntry | null {
      assertAlive("markCommandResult");

      pendingCommand = null;
      pendingPlacementContext = null;
      lastResult = result;
      lastError = null;
      lastDirtyChunkKeys = collectDirtyChunkKeysFromResult(result);
      setStatus(isSuccessfulCommandStatus(result.commandStatus) ? "idle" : "failed");

      const entry = updateLatestHistoryEntry((current) => completeHistoryEntryWithResult(current, result));

      logDebug(logger, "Chunk command result recorded.", {
        commandType: result.commandType,
        commandStatus: result.commandStatus,
        changed: result.changed,
        dirtyChunks: result.dirtyChunks,
        changedChunks: result.changedChunks,
        eventIds: result.eventIds,
        runtimeBlockTypeId: entry?.placementContext?.runtimeBlockTypeId ?? null,
        familyId: entry?.placementContext?.familyId ?? null,
        vplibUid: entry?.placementContext?.vplibUid ?? null,
      });

      return entry;
    },

    markCommandFailed(error: ChunkApiFailedResult): ChunkEditCommandHistoryEntry | null {
      assertAlive("markCommandFailed");

      pendingCommand = null;
      pendingPlacementContext = null;
      lastError = error;
      setStatus("failed");

      const entry = updateLatestHistoryEntry((current) => completeHistoryEntryWithError(current, error));

      logWarn(logger, "Chunk command failed.", {
        message: failedResultMessage(error),
        error: error.error,
        runtimeBlockTypeId: entry?.placementContext?.runtimeBlockTypeId ?? null,
        familyId: entry?.placementContext?.familyId ?? null,
        vplibUid: entry?.placementContext?.vplibUid ?? null,
      });

      return entry;
    },

    getLastDirtyChunkKeys(): readonly string[] {
      return [...lastDirtyChunkKeys];
    },

    clearLastDirtyChunkKeys(): void {
      assertAlive("clearLastDirtyChunkKeys");

      lastDirtyChunkKeys = [];
      updatedAt = now();
    },

    reset(reason?: string): void {
      assertAlive("reset");

      pendingCommand = null;
      pendingPlacementContext = null;
      lastCommand = null;
      lastPlacementContext = null;
      lastResult = null;
      lastError = null;
      lastDirtyChunkKeys = [];
      history.length = 0;
      setStatus("active");

      logDebug(logger, "Chunk edit session reset.", {
        reason: reason ?? null,
      });
    },

    destroy(reason?: string): void {
      if (status === "destroyed") {
        return;
      }

      pendingCommand = null;
      pendingPlacementContext = null;
      setStatus("destroyed");

      logDebug(logger, "Chunk edit session destroyed.", {
        reason: reason ?? null,
        commandCount: history.length,
      });
    },
  };

  setStatus("active");

  logDebug(logger, "Chunk edit session created.", {
    userId: identity.userId,
    sessionId: identity.sessionId,
    productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    sendsLibraryMetadataByDefault: false,
  });

  return session;
}

export function isChunkEditSession(value: unknown): value is ChunkEditSessionHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<ChunkEditSessionHandle>;

    return (
      record.kind === SESSION_KIND
      && typeof record.prepareSetBlockCommand === "function"
      && typeof record.preparePlaceLibraryItemCommand === "function"
      && typeof record.prepareRemoveBlockCommand === "function"
      && typeof record.markCommandPending === "function"
      && typeof record.getSnapshot === "function"
    );
  } catch {
    return false;
  }
}

export function chunkEditSessionSnapshotToDebug(
  snapshot: ChunkEditSessionSnapshot,
): Record<string, unknown> {
  try {
    return {
      kind: snapshot.kind,
      userId: snapshot.identity.userId,
      sessionId: snapshot.identity.sessionId,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      destroyedAt: snapshot.destroyedAt,
      pendingCommandType: snapshot.pendingCommand?.type ?? null,
      pendingRuntimeBlockTypeId: snapshot.pendingPlacementContext?.runtimeBlockTypeId ?? null,
      pendingFamilyId: snapshot.pendingPlacementContext?.familyId ?? null,
      pendingVplibUid: snapshot.pendingPlacementContext?.vplibUid ?? null,
      pendingContextValid: snapshot.pendingPlacementContext?.valid ?? null,
      pendingContextInvalidReason: snapshot.pendingPlacementContext?.invalidReason ?? null,
      lastCommandType: snapshot.lastCommand?.type ?? null,
      lastRuntimeBlockTypeId: snapshot.lastPlacementContext?.runtimeBlockTypeId ?? null,
      lastFamilyId: snapshot.lastPlacementContext?.familyId ?? null,
      lastVplibUid: snapshot.lastPlacementContext?.vplibUid ?? null,
      lastContextValid: snapshot.lastPlacementContext?.valid ?? null,
      lastContextInvalidReason: snapshot.lastPlacementContext?.invalidReason ?? null,
      lastResultStatus: snapshot.lastResult?.commandStatus ?? null,
      lastError: snapshot.lastError?.error?.message ?? null,
      lastDirtyChunkKeys: snapshot.lastDirtyChunkKeys,
      commandCount: snapshot.commandCount,
      pendingCommandCount: snapshot.pendingCommandCount,
      failedCommandCount: snapshot.failedCommandCount,
      successfulCommandCount: snapshot.successfulCommandCount,
      invalidContextCount: snapshot.invalidContextCount,
      libraryCommandCount: snapshot.libraryCommandCount,
      legacyBlockCommandCount: snapshot.legacyBlockCommandCount,
      removeCommandCount: snapshot.removeCommandCount,
      productiveInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      rules: {
        setBlockStillUsesRuntimeBlockTypeId: true,
        libraryIdentityTrackedInSessionContext: true,
        libraryMetadataSentOnlyWhenExplicitlyEnabled: true,
        debugGrassDirtBlocked: true,
        forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
      },
    };
  } catch (error) {
    return {
      kind: SNAPSHOT_KIND,
      debugFailed: true,
      error: normalizeUnknownError(error),
    };
  }
}

export function getChunkEditSessionMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.runtime.world.chunk_edit_session",
    sessionKind: SESSION_KIND,
    snapshotKind: SNAPSHOT_KIND,
    placementContextKind: PLACEMENT_CONTEXT_KIND,
    supportsLibraryPlacementContext: true,
    supportsPreparePlaceLibraryItemCommand: true,
    preservesLegacySetBlockCommand: true,
    sendsLibraryMetadataByDefault: false,
    primaryInventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      runtimeBlockTypeIdIsSetBlockBlockTypeId: true,
      libraryRefIsSemanticPlacementIdentity: true,
      invalidPlacementContextIsRejectedBeforeCommandCreation: true,
      debugGrassDirtBlocked: true,
      removeBlockDoesNotRequireInventoryItem: true,
    },
  };
}