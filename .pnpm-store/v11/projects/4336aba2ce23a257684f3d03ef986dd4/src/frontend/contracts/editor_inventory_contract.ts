// services/vectoplan-editor/src/frontend/contracts/editor_inventory_contract.ts
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";

/**
 * Zentraler Frontend-Vertrag für Editor-Inventory, Library-/VPLIB-Placement,
 * Hotbar-Source-Capabilities und RuntimeBlockTypeId-Adapter.
 *
 * Zweck:
 * - eine gemeinsame Grenze zwischen Config, Bootstrap, Inventory,
 *   HotbarController, InputController, SceneRuntime, Store und ChunkSource
 * - keine DOM-Logik
 * - keine Fetch-/API-Client-Logik
 * - keine Three.js-/Scene-Logik
 * - keine Store-Mutation
 * - keine Chunk-Command-Ausführung
 *
 * Architekturregeln:
 * - Browser nutzt /editor/api/inventory als produktive Hotbar-Quelle.
 * - Browser ruft vectoplan-library nicht direkt auf.
 * - Chunk-Blocklisten sind Legacy/Diagnose.
 * - debug_grass/debug_dirt sind keine fachlichen Inventory-Items.
 * - runtimeBlockTypeId ist technischer Adapter für den Chunk-Service.
 * - LibraryRef / PlacementCommand / familyId / vplibUid sind fachliche Identität.
 */

export const EDITOR_INVENTORY_CONTRACT_MODULE_NAME =
  "frontend.contracts.editor_inventory_contract" as const;
export const EDITOR_INVENTORY_CONTRACT_MODULE_VERSION = "0.1.2" as const;

export const PRODUCTIVE_EDITOR_INVENTORY_ROUTE = "/editor/api/inventory" as const;
export const PRODUCTIVE_EDITOR_INVENTORY_HEALTH_ROUTE =
  "/editor/api/inventory/_health" as const;
export const PRODUCTIVE_EDITOR_INVENTORY_METADATA_ROUTE =
  "/editor/api/inventory/_metadata" as const;

export const DEFAULT_EDITOR_CREATIVE_LIBRARY_ROUTE = "/editor/api/library" as const;
export const DEFAULT_EDITOR_CREATIVE_LIBRARY_HEALTH_ROUTE =
  "/editor/api/library/_health" as const;
export const DEFAULT_EDITOR_CREATIVE_LIBRARY_METADATA_ROUTE =
  "/editor/api/library/_metadata" as const;

export const BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY = false as const;
export const ONLY_LIBRARY_ITEMS_PLACEABLE = true as const;
export const DEBUG_GRASS_DIRT_ALLOWED = false as const;
export const ALLOW_CHUNK_PLACEABLE_FALLBACK = false as const;
export const LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY = true as const;
export const EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS = false as const;

export const DEFAULT_EDITOR_INVENTORY_SLOT_COUNT: number = 9;
export const DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT: number = 0;
export const DEFAULT_EDITOR_INVENTORY_SOURCE_KIND = "library" as const;
export const DEFAULT_EDITOR_INVENTORY_ITEM_KIND = "vplib" as const;

export const FORBIDDEN_DEBUG_BLOCK_TYPE_IDS = [
  "debug_grass",
  "debug_dirt",
] as const;

export type ForbiddenDebugBlockTypeId =
  (typeof FORBIDDEN_DEBUG_BLOCK_TYPE_IDS)[number];

const FORBIDDEN_DEBUG_BLOCK_TYPE_ID_SET: ReadonlySet<string> = new Set<string>(
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
);

export type EditorInventoryContractSourceKind =
  | "library"
  | "vectoplan-library"
  | "editor-inventory"
  | "vplib"
  | "library-service"
  | "creative-library"
  | "chunk-service"
  | "editor-placeholder"
  | "chunk-palette"
  | "static-fallback"
  | "runtime-generated"
  | "empty-fallback"
  | "fallback"
  | "error"
  | "unknown";

export type EditorInventoryContractItemKind =
  | "vplib"
  | "library-item"
  | "block"
  | "asset"
  | "empty";

export type EditorInventoryContractLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "degraded"
  | "failed"
  | "empty"
  | "fallback"
  | "error"
  | "destroyed";

export type EditorInventoryContractPlacementSource =
  | "library"
  | "vplib"
  | "editor-inventory"
  | "legacy-block"
  | "asset"
  | "remove"
  | "empty"
  | "unknown";

export type EditorInventoryContractRecord = Record<string, unknown>;
export type EditorInventoryContractMaybePromise<T> = T | Promise<T>;

const LIBRARY_SOURCE_KINDS: readonly EditorInventoryContractSourceKind[] = [
  "library",
  "vectoplan-library",
  "editor-inventory",
  "vplib",
  "library-service",
  "creative-library",
];

const LEGACY_SOURCE_KINDS: readonly EditorInventoryContractSourceKind[] = [
  "chunk-service",
  "editor-placeholder",
  "chunk-palette",
  "static-fallback",
  "runtime-generated",
];

const FALLBACK_SOURCE_KINDS: readonly EditorInventoryContractSourceKind[] = [
  "empty-fallback",
  "fallback",
  "error",
  "unknown",
];

const VALID_SOURCE_KINDS: readonly EditorInventoryContractSourceKind[] = [
  ...LIBRARY_SOURCE_KINDS,
  ...LEGACY_SOURCE_KINDS,
  ...FALLBACK_SOURCE_KINDS,
];

const VALID_ITEM_KINDS: readonly EditorInventoryContractItemKind[] = [
  "vplib",
  "library-item",
  "block",
  "asset",
  "empty",
];

const MAX_CONTRACT_CACHE_ENTRIES = 512;

const NORMALIZED_TEXT_CACHE = new Map<string, string | null>();
const RUNTIME_BLOCK_TYPE_ID_CACHE = new Map<string, string | null>();
const SOURCE_KIND_CACHE = new Map<string, EditorInventoryContractSourceKind>();
const ITEM_KIND_CACHE = new Map<string, EditorInventoryContractItemKind>();

function setCachedValue<K, V>(cache: Map<K, V>, key: K, value: V): V {
  try {
    if (cache.size > MAX_CONTRACT_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Best-effort cache. Contract helpers must never fail because of cache issues.
  }

  return value;
}

export function clearEditorInventoryContractCaches(): void {
  try {
    NORMALIZED_TEXT_CACHE.clear();
    RUNTIME_BLOCK_TYPE_ID_CACHE.clear();
    SOURCE_KIND_CACHE.clear();
    ITEM_KIND_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

export function isEditorInventoryContractRecord(
  value: unknown,
): value is EditorInventoryContractRecord {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

export function asEditorInventoryContractRecord(
  value: unknown,
): EditorInventoryContractRecord {
  try {
    return isEditorInventoryContractRecord(value) ? value : {};
  } catch {
    return {};
  }
}

export function asEditorInventoryContractArray<T = unknown>(
  value: unknown,
): readonly T[] {
  try {
    return Array.isArray(value) ? (value as readonly T[]) : [];
  } catch {
    return [];
  }
}

export function normalizeContractText(value: unknown, fallback = ""): string {
  try {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const converted = String(value).trim();
      return converted.length > 0 ? converted : fallback;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const cached = NORMALIZED_TEXT_CACHE.get(value);
    if (cached !== undefined) {
      return cached ?? fallback;
    }

    const normalized = value.trim();
    const result = normalized.length > 0 ? normalized : fallback;

    setCachedValue(NORMALIZED_TEXT_CACHE, value, result.length > 0 ? result : null);
    return result;
  } catch {
    return fallback;
  }
}

export function normalizeOptionalContractText(value: unknown): string | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      const cached = NORMALIZED_TEXT_CACHE.get(value);
      if (cached !== undefined) {
        return cached;
      }

      const normalized = value.trim();
      return setCachedValue(
        NORMALIZED_TEXT_CACHE,
        value,
        normalized.length > 0 ? normalized : null,
      );
    }

    const normalized = normalizeContractText(value, "");
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export function normalizeContractInteger(
  value: unknown,
  fallback: number,
  minimum = Number.MIN_SAFE_INTEGER,
  maximum = Number.MAX_SAFE_INTEGER,
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

    return Math.min(maximum, Math.max(minimum, Math.trunc(numeric)));
  } catch {
    return fallback;
  }
}

export function normalizeOptionalContractInteger(value: unknown): number | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value.trim(), 10)
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return null;
    }

    return Math.trunc(numeric);
  } catch {
    return null;
  }
}

export function normalizeContractBoolean(
  value: unknown,
  fallback: boolean,
): boolean {
  try {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function normalizeContractSlotIndex(
  value: unknown,
  slotCount: number = DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
  fallback: number = DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
): number {
  try {
    const safeSlotCount = normalizeContractInteger(
      slotCount,
      DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
      1,
      64,
    );

    return normalizeContractInteger(
      value,
      fallback,
      0,
      Math.max(0, safeSlotCount - 1),
    );
  } catch {
    return DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT;
  }
}

export function readContractField(value: unknown, key: string): unknown {
  try {
    const record = asEditorInventoryContractRecord(value);

    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function readFirstContractField(
  value: unknown,
  keys: readonly string[],
): unknown {
  try {
    const record = asEditorInventoryContractRecord(value);

    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        continue;
      }

      const candidate = record[key];

      if (candidate !== undefined && candidate !== null && candidate !== "") {
        return candidate;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function readFirstContractText(
  value: unknown,
  keys: readonly string[],
): string | null {
  try {
    return normalizeOptionalContractText(readFirstContractField(value, keys));
  } catch {
    return null;
  }
}

export function readContractStringField(
  value: unknown,
  key: string,
): string | null {
  try {
    return normalizeOptionalContractText(readContractField(value, key));
  } catch {
    return null;
  }
}

export function mergeContractMetadata(
  ...values: readonly unknown[]
): EditorInventoryContractRecord {
  const output: EditorInventoryContractRecord = {};

  try {
    for (const value of values) {
      const record = asEditorInventoryContractRecord(value);

      for (const [key, item] of Object.entries(record)) {
        if (item !== undefined) {
          output[key] = item;
        }
      }
    }
  } catch {
    return output;
  }

  return output;
}

export function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  try {
    const normalized = normalizeContractText(value, "");
    return FORBIDDEN_DEBUG_BLOCK_TYPE_ID_SET.has(normalized);
  } catch {
    return false;
  }
}

export function containsForbiddenDebugBlockTypeId(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string") {
      return false;
    }

    return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.some((blockTypeId) =>
      serialized.includes(blockTypeId),
    );
  } catch {
    return false;
  }
}

export function normalizeRuntimeBlockTypeId(value: unknown): string | null {
  try {
    const raw =
      typeof value === "string"
        ? value
        : value === null || value === undefined
          ? ""
          : String(value);

    const cached = RUNTIME_BLOCK_TYPE_ID_CACHE.get(raw);
    if (cached !== undefined) {
      return cached;
    }

    const normalized = normalizeOptionalContractText(value);

    if (!normalized || isForbiddenDebugBlockTypeId(normalized)) {
      return setCachedValue(RUNTIME_BLOCK_TYPE_ID_CACHE, raw, null);
    }

    return setCachedValue(RUNTIME_BLOCK_TYPE_ID_CACHE, raw, normalized);
  } catch {
    return null;
  }
}

export function normalizeBlockTypeIdAlias(value: unknown): string | null {
  try {
    return normalizeRuntimeBlockTypeId(value);
  } catch {
    return null;
  }
}

export function normalizeInventorySourceKind(
  value: unknown,
  fallback: EditorInventoryContractSourceKind = DEFAULT_EDITOR_INVENTORY_SOURCE_KIND,
): EditorInventoryContractSourceKind {
  try {
    const raw = normalizeContractText(value, fallback);
    const cached = SOURCE_KIND_CACHE.get(raw);

    if (cached) {
      return cached;
    }

    const normalized = raw as EditorInventoryContractSourceKind;
    const result = VALID_SOURCE_KINDS.includes(normalized)
      ? normalized
      : fallback;

    return setCachedValue(SOURCE_KIND_CACHE, raw, result);
  } catch {
    return fallback;
  }
}

export function normalizeInventoryItemKind(
  value: unknown,
  fallback: EditorInventoryContractItemKind = DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
): EditorInventoryContractItemKind {
  try {
    const raw = normalizeContractText(value, fallback);
    const cached = ITEM_KIND_CACHE.get(raw);

    if (cached) {
      return cached;
    }

    const normalized = raw as EditorInventoryContractItemKind;
    const result = VALID_ITEM_KINDS.includes(normalized) ? normalized : fallback;

    return setCachedValue(ITEM_KIND_CACHE, raw, result);
  } catch {
    return fallback;
  }
}

export function isLibraryInventorySourceKind(value: unknown): boolean {
  try {
    return LIBRARY_SOURCE_KINDS.includes(normalizeInventorySourceKind(value));
  } catch {
    return false;
  }
}

export function isLegacyInventorySourceKind(value: unknown): boolean {
  try {
    return LEGACY_SOURCE_KINDS.includes(normalizeInventorySourceKind(value));
  } catch {
    return false;
  }
}

export function isFallbackInventorySourceKind(value: unknown): boolean {
  try {
    return FALLBACK_SOURCE_KINDS.includes(normalizeInventorySourceKind(value));
  } catch {
    return false;
  }
}

export function isLibraryInventoryItemKind(value: unknown): boolean {
  try {
    const kind = normalizeInventoryItemKind(value, "empty");
    return kind === "vplib" || kind === "library-item";
  } catch {
    return false;
  }
}

export interface EditorLibraryIdentityLike {
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly label?: string | null;
}

export interface EditorLibraryIdentity {
  readonly libraryItemId: string | null;
  readonly inventoryItemId: string | null;
  readonly inventorySlotIndex: number | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly label: string | null;
}

export function createEditorLibraryIdentity(
  input?: EditorLibraryIdentityLike | null,
): EditorLibraryIdentity {
  try {
    return {
      libraryItemId: normalizeOptionalContractText(input?.libraryItemId),
      inventoryItemId: normalizeOptionalContractText(input?.inventoryItemId),
      inventorySlotIndex: normalizeOptionalContractInteger(input?.inventorySlotIndex),
      familyId: normalizeOptionalContractText(input?.familyId),
      packageId: normalizeOptionalContractText(input?.packageId),
      vplibUid: normalizeOptionalContractText(input?.vplibUid),
      variantId: normalizeOptionalContractText(input?.variantId) ?? "default",
      revisionHash: normalizeOptionalContractText(input?.revisionHash),
      objectKind: normalizeOptionalContractText(input?.objectKind),
      label: normalizeOptionalContractText(input?.label),
    };
  } catch {
    return {
      libraryItemId: null,
      inventoryItemId: null,
      inventorySlotIndex: null,
      familyId: null,
      packageId: null,
      vplibUid: null,
      variantId: "default",
      revisionHash: null,
      objectKind: null,
      label: null,
    };
  }
}

export function identityHasLibraryIdentity(
  input?: Partial<EditorLibraryIdentityLike> | null,
): boolean {
  try {
    return Boolean(
      normalizeOptionalContractText(input?.libraryItemId) ||
        normalizeOptionalContractText(input?.familyId) ||
        normalizeOptionalContractText(input?.vplibUid),
    );
  } catch {
    return false;
  }
}

export interface EditorLibraryReferenceInput extends EditorLibraryIdentityLike {
  readonly source?: string | null;
  readonly kind?: string | null;
  readonly domain?: string | null;
  readonly category?: string | null;
  readonly subcategory?: string | null;
  readonly stableKey?: string | null;
  readonly valid?: boolean | null;
  readonly raw?: unknown;
}

function readLibraryRefIdentity(
  value: unknown,
): EditorLibraryIdentity & {
  readonly domain: string | null;
  readonly category: string | null;
  readonly subcategory: string | null;
  readonly stableKey: string | null;
} {
  try {
    const record = asEditorInventoryContractRecord(value);

    const libraryItemId = readFirstContractText(record, [
      "libraryItemId",
      "library_item_id",
      "itemId",
      "item_id",
    ]);
    const familyId = readFirstContractText(record, ["familyId", "family_id"]);
    const packageId = readFirstContractText(record, ["packageId", "package_id"]);
    const vplibUid = readFirstContractText(record, ["vplibUid", "vplib_uid"]);
    const variantId =
      readFirstContractText(record, ["variantId", "variant_id"]) ?? "default";
    const revisionHash = readFirstContractText(record, [
      "revisionHash",
      "revision_hash",
    ]);
    const objectKind = readFirstContractText(record, ["objectKind", "object_kind"]);
    const label = readFirstContractText(record, ["label", "name", "title"]);
    const domain = readFirstContractText(record, ["domain"]);
    const category = readFirstContractText(record, ["category"]);
    const subcategory = readFirstContractText(record, ["subcategory"]);

    const stableKey =
      readFirstContractText(record, ["stableKey", "stable_key"]) ??
      (vplibUid
        ? `vplib:${vplibUid}:${variantId}`
        : familyId
          ? `family:${familyId}:${variantId}`
          : libraryItemId
            ? `item:${libraryItemId}:${variantId}`
            : null);

    return {
      libraryItemId,
      inventoryItemId: null,
      inventorySlotIndex: null,
      familyId,
      packageId,
      vplibUid,
      variantId,
      revisionHash,
      objectKind,
      label,
      domain,
      category,
      subcategory,
      stableKey,
    };
  } catch {
    return {
      libraryItemId: null,
      inventoryItemId: null,
      inventorySlotIndex: null,
      familyId: null,
      packageId: null,
      vplibUid: null,
      variantId: "default",
      revisionHash: null,
      objectKind: null,
      label: null,
      domain: null,
      category: null,
      subcategory: null,
      stableKey: null,
    };
  }
}

export function normalizeEditorInventoryLibraryRef(
  value: unknown,
): EditorInventoryLibraryRef | null {
  try {
    const record = asEditorInventoryContractRecord(value);

    if (Object.keys(record).length === 0) {
      return null;
    }

    const identity = readLibraryRefIdentity(record);

    if (!identity.libraryItemId && !identity.familyId && !identity.vplibUid) {
      return null;
    }

    return {
      ...record,
      source: normalizeContractText(record.source, "vectoplan-library"),
      kind: normalizeContractText(record.kind, "vplib"),
      libraryItemId: identity.libraryItemId,
      familyId: identity.familyId,
      packageId: identity.packageId,
      vplibUid: identity.vplibUid,
      variantId: identity.variantId,
      revisionHash: identity.revisionHash,
      objectKind: identity.objectKind,
      domain: identity.domain,
      category: identity.category,
      subcategory: identity.subcategory,
      stableKey: identity.stableKey,
      valid: Boolean(identity.familyId || identity.vplibUid || identity.libraryItemId),
    } as unknown as EditorInventoryLibraryRef;
  } catch {
    return null;
  }
}

export function normalizeEditorInventoryPlacementCommand(
  value: unknown,
): EditorInventoryPlacementCommand | null {
  try {
    const record = asEditorInventoryContractRecord(value);

    if (Object.keys(record).length === 0) {
      return null;
    }

    const directLibraryRef = normalizeEditorInventoryLibraryRef(
      readFirstContractField(record, ["libraryRef", "library_ref"]),
    );

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      readFirstContractField(record, [
        "runtimeBlockTypeId",
        "runtime_block_type_id",
        "blockTypeId",
        "block_type_id",
      ]),
    );

    const blockTypeId =
      normalizeRuntimeBlockTypeId(
        readFirstContractField(record, [
          "blockTypeId",
          "block_type_id",
          "runtimeBlockTypeId",
          "runtime_block_type_id",
        ]),
      ) ?? runtimeBlockTypeId;

    if (!runtimeBlockTypeId && !directLibraryRef) {
      return null;
    }

    return {
      ...record,
      kind: normalizeContractText(record.kind, "PlaceLibraryItem"),
      source: normalizeContractText(record.source, "vectoplan-library"),
      runtimeBlockTypeId,
      blockTypeId,
      libraryRef: directLibraryRef,
      placeable: true,
    } as unknown as EditorInventoryPlacementCommand;
  } catch {
    return null;
  }
}

export function runtimeBlockTypeIdFromPlacementCommand(
  command: EditorInventoryPlacementCommand | null | undefined,
): string | null {
  try {
    return normalizeRuntimeBlockTypeId(
      readFirstContractField(command, [
        "runtimeBlockTypeId",
        "runtime_block_type_id",
        "blockTypeId",
        "block_type_id",
      ]),
    );
  } catch {
    return null;
  }
}

export function libraryRefFromPlacementCommand(
  command: EditorInventoryPlacementCommand | null | undefined,
): EditorInventoryLibraryRef | null {
  try {
    return normalizeEditorInventoryLibraryRef(
      readFirstContractField(command, ["libraryRef", "library_ref"]),
    );
  } catch {
    return null;
  }
}

export interface EditorLibraryPlacementInput extends EditorLibraryIdentityLike {
  readonly source?: EditorInventoryContractPlacementSource | string | null;
  readonly runtimeBlockTypeId?: string | null;
  readonly blockTypeId?: string | null;
  readonly libraryRef?: EditorInventoryLibraryRef | null;
  readonly placementCommand?: EditorInventoryPlacementCommand | null;
  readonly commandMetadata?: Record<string, unknown> | null;
  readonly requireLibraryIdentity?: boolean;
  readonly invalidReason?: string | null;
  readonly blockedReason?: string | null;
}

export interface EditorLibraryPlacementContext extends EditorLibraryIdentity {
  readonly kind: "editor-library-placement-context.v1";
  readonly source: EditorInventoryContractPlacementSource;
  readonly runtimeBlockTypeId: string | null;

  /**
   * Legacy alias. Für Library-/VPLIB-Placement ist dies immer der technische
   * runtimeBlockTypeId, nicht die semantische Objektidentität.
   */
  readonly blockTypeId: string | null;

  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly commandMetadata: EditorInventoryContractRecord;
  readonly valid: boolean;
  readonly invalidReason: string | null;
  readonly blockedReason: string | null;
  readonly requireLibraryIdentity: boolean;
}

export const EDITOR_LIBRARY_PLACEMENT_CONTEXT_KIND =
  "editor-library-placement-context.v1" as const;

export function hasLibraryIdentity(
  input?: {
    readonly libraryRef?: EditorInventoryLibraryRef | null;
    readonly placementCommand?: EditorInventoryPlacementCommand | null;
    readonly libraryItemId?: string | null;
    readonly familyId?: string | null;
    readonly vplibUid?: string | null;
  } | null,
): boolean {
  try {
    const placementCommand = normalizeEditorInventoryPlacementCommand(
      input?.placementCommand,
    );
    const libraryRef =
      normalizeEditorInventoryLibraryRef(input?.libraryRef) ??
      libraryRefFromPlacementCommand(placementCommand);

    return Boolean(
      libraryRef ||
        normalizeOptionalContractText(input?.libraryItemId) ||
        normalizeOptionalContractText(input?.familyId) ||
        normalizeOptionalContractText(input?.vplibUid),
    );
  } catch {
    return false;
  }
}

export function normalizePlacementSource(
  value: unknown,
): EditorInventoryContractPlacementSource {
  try {
    const normalized = normalizeContractText(value, "unknown");

    if (
      normalized === "library" ||
      normalized === "vplib" ||
      normalized === "editor-inventory" ||
      normalized === "legacy-block" ||
      normalized === "asset" ||
      normalized === "remove" ||
      normalized === "empty" ||
      normalized === "unknown"
    ) {
      return normalized;
    }

    if (isLibraryInventorySourceKind(normalized)) {
      return "library";
    }

    if (isLegacyInventorySourceKind(normalized)) {
      return "legacy-block";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function deriveRequireLibraryIdentity(
  explicitValue: boolean | undefined,
  source: EditorInventoryContractPlacementSource,
): boolean {
  try {
    return (
      explicitValue ??
      (source === "library" ||
        source === "vplib" ||
        source === "editor-inventory")
    );
  } catch {
    return true;
  }
}

export function createEditorLibraryPlacementContext(
  input?: EditorLibraryPlacementInput | null,
): EditorLibraryPlacementContext {
  try {
    const placementCommand = normalizeEditorInventoryPlacementCommand(
      input?.placementCommand,
    );
    const libraryRef =
      normalizeEditorInventoryLibraryRef(input?.libraryRef) ??
      libraryRefFromPlacementCommand(placementCommand);

    const libraryRefRecord = asEditorInventoryContractRecord(libraryRef);
    const commandRuntimeBlockTypeId =
      runtimeBlockTypeIdFromPlacementCommand(placementCommand);

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      input?.runtimeBlockTypeId ?? input?.blockTypeId ?? commandRuntimeBlockTypeId,
    );

    const blockTypeId = normalizeRuntimeBlockTypeId(
      input?.blockTypeId ?? runtimeBlockTypeId,
    );

    const identity = createEditorLibraryIdentity({
      libraryItemId:
        input?.libraryItemId ??
        normalizeOptionalContractText(libraryRefRecord.libraryItemId),
      inventoryItemId: input?.inventoryItemId ?? null,
      inventorySlotIndex: input?.inventorySlotIndex ?? null,
      familyId:
        input?.familyId ?? normalizeOptionalContractText(libraryRefRecord.familyId),
      packageId:
        input?.packageId ?? normalizeOptionalContractText(libraryRefRecord.packageId),
      vplibUid:
        input?.vplibUid ?? normalizeOptionalContractText(libraryRefRecord.vplibUid),
      variantId:
        input?.variantId ??
        normalizeOptionalContractText(libraryRefRecord.variantId) ??
        "default",
      revisionHash:
        input?.revisionHash ??
        normalizeOptionalContractText(libraryRefRecord.revisionHash),
      objectKind:
        input?.objectKind ??
        normalizeOptionalContractText(libraryRefRecord.objectKind),
      label: input?.label ?? normalizeOptionalContractText(libraryRefRecord.label),
    });

    const source = normalizePlacementSource(input?.source ?? "unknown");
    const requireLibraryIdentity = deriveRequireLibraryIdentity(
      input?.requireLibraryIdentity,
      source,
    );

    const libraryIdentityValid = hasLibraryIdentity({
      libraryRef,
      placementCommand,
      libraryItemId: identity.libraryItemId,
      familyId: identity.familyId,
      vplibUid: identity.vplibUid,
    });

    let invalidReason = normalizeOptionalContractText(
      input?.invalidReason ?? input?.blockedReason,
    );

    if (!invalidReason && !runtimeBlockTypeId && source !== "remove") {
      invalidReason = "missing-runtime-block-type-id";
    } else if (
      !invalidReason &&
      runtimeBlockTypeId &&
      isForbiddenDebugBlockTypeId(runtimeBlockTypeId)
    ) {
      invalidReason = "forbidden-debug-runtime-block-type-id";
    } else if (!invalidReason && requireLibraryIdentity && !libraryIdentityValid) {
      invalidReason = "missing-library-identity";
    }

    return {
      kind: EDITOR_LIBRARY_PLACEMENT_CONTEXT_KIND,
      source,
      runtimeBlockTypeId,
      blockTypeId: blockTypeId ?? runtimeBlockTypeId,
      ...identity,
      libraryRef,
      placementCommand,
      commandMetadata: mergeContractMetadata(input?.commandMetadata),
      valid: invalidReason === null,
      invalidReason,
      blockedReason: invalidReason,
      requireLibraryIdentity,
    };
  } catch {
    return {
      kind: EDITOR_LIBRARY_PLACEMENT_CONTEXT_KIND,
      source: "unknown",
      runtimeBlockTypeId: null,
      blockTypeId: null,
      ...createEditorLibraryIdentity(null),
      libraryRef: null,
      placementCommand: null,
      commandMetadata: {},
      valid: false,
      invalidReason: "placement-context-normalization-error",
      blockedReason: "placement-context-normalization-error",
      requireLibraryIdentity: true,
    };
  }
}

export function isEditorLibraryPlacementContext(
  value: unknown,
): value is EditorLibraryPlacementContext {
  try {
    const record = asEditorInventoryContractRecord(value);

    return (
      record.kind === EDITOR_LIBRARY_PLACEMENT_CONTEXT_KIND &&
      "runtimeBlockTypeId" in record &&
      "valid" in record
    );
  } catch {
    return false;
  }
}

export function isValidEditorLibraryPlacementContext(
  value: unknown,
): value is EditorLibraryPlacementContext {
  try {
    if (!isEditorLibraryPlacementContext(value)) {
      return false;
    }

    return (
      value.valid &&
      Boolean(value.runtimeBlockTypeId) &&
      !isForbiddenDebugBlockTypeId(value.runtimeBlockTypeId) &&
      (!value.requireLibraryIdentity || hasLibraryIdentity(value))
    );
  } catch {
    return false;
  }
}

function getPlacementContextInvalidReason(value: unknown): string {
  try {
    const record = asEditorInventoryContractRecord(value);

    return (
      normalizeOptionalContractText(record.invalidReason) ??
      normalizeOptionalContractText(record.blockedReason) ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

export function assertValidEditorLibraryPlacementContext(
  context: EditorLibraryPlacementContext,
): void {
  const valid = isValidEditorLibraryPlacementContext(context as unknown);

  if (!valid) {
    throw new Error(
      `Invalid Library/VPLIB placement context: ${getPlacementContextInvalidReason(context)}.`,
    );
  }
}

export interface EditorInventoryRuntimePlaceable extends EditorLibraryIdentity {
  readonly kind: "editor-inventory-runtime-placeable.v1";
  readonly slotIndex: number;
  readonly itemId: string | null;
  readonly itemKind: string;
  readonly source: string;
  readonly runtimeBlockTypeId: string;
  readonly blockTypeId: string;
  readonly libraryRef: EditorInventoryLibraryRef;
  readonly placementCommand: EditorInventoryPlacementCommand;
  readonly rawSlot: unknown;
  readonly rawItem: unknown;
}

export const EDITOR_INVENTORY_RUNTIME_PLACEABLE_KIND =
  "editor-inventory-runtime-placeable.v1" as const;

export interface EditorInventoryRuntimePlaceableInput
  extends EditorLibraryPlacementInput {
  readonly slotIndex?: number | null;
  readonly itemId?: string | null;
  readonly itemKind?: string | null;
  readonly sourceKind?: string | null;
  readonly rawSlot?: unknown;
  readonly rawItem?: unknown;
}

export function createEditorInventoryRuntimePlaceable(
  input?: EditorInventoryRuntimePlaceableInput | null,
): EditorInventoryRuntimePlaceable | null {
  try {
    const context = createEditorLibraryPlacementContext({
      ...asEditorInventoryContractRecord(input),
      source: input?.source ?? input?.sourceKind ?? "library",
      requireLibraryIdentity: true,
      runtimeBlockTypeId: input?.runtimeBlockTypeId ?? input?.blockTypeId ?? null,
      blockTypeId: input?.blockTypeId ?? input?.runtimeBlockTypeId ?? null,
      libraryRef: input?.libraryRef ?? null,
      placementCommand: input?.placementCommand ?? null,
      commandMetadata: input?.commandMetadata ?? null,
      libraryItemId: input?.libraryItemId ?? input?.itemId ?? null,
      inventoryItemId: input?.inventoryItemId ?? null,
      inventorySlotIndex: input?.inventorySlotIndex ?? input?.slotIndex ?? null,
      familyId: input?.familyId ?? null,
      packageId: input?.packageId ?? null,
      vplibUid: input?.vplibUid ?? null,
      variantId: input?.variantId ?? null,
      revisionHash: input?.revisionHash ?? null,
      objectKind: input?.objectKind ?? null,
      label: input?.label ?? null,
    });

    if (
      !isValidEditorLibraryPlacementContext(context) ||
      !context.runtimeBlockTypeId ||
      !context.libraryRef ||
      !context.placementCommand
    ) {
      return null;
    }

    const slotIndex = normalizeContractInteger(
      input?.slotIndex ?? input?.inventorySlotIndex,
      DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
      0,
      999,
    );

    return {
      kind: EDITOR_INVENTORY_RUNTIME_PLACEABLE_KIND,
      slotIndex,
      itemId: normalizeOptionalContractText(input?.itemId ?? input?.libraryItemId),
      itemKind: normalizeContractText(
        input?.itemKind,
        DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
      ),
      source: normalizeContractText(input?.sourceKind ?? input?.source, "library"),
      runtimeBlockTypeId: context.runtimeBlockTypeId,
      blockTypeId: context.blockTypeId ?? context.runtimeBlockTypeId,
      libraryItemId: context.libraryItemId,
      inventoryItemId: context.inventoryItemId,
      inventorySlotIndex: context.inventorySlotIndex ?? slotIndex,
      familyId: context.familyId,
      packageId: context.packageId,
      vplibUid: context.vplibUid,
      variantId: context.variantId,
      revisionHash: context.revisionHash,
      objectKind: context.objectKind,
      label:
        context.label ??
        context.familyId ??
        context.vplibUid ??
        context.libraryItemId ??
        context.runtimeBlockTypeId,
      libraryRef: context.libraryRef,
      placementCommand: context.placementCommand,
      rawSlot: input?.rawSlot ?? null,
      rawItem: input?.rawItem ?? null,
    };
  } catch {
    return null;
  }
}

export function isEditorInventoryRuntimePlaceable(
  value: unknown,
): value is EditorInventoryRuntimePlaceable {
  try {
    const record = asEditorInventoryContractRecord(value);

    return (
      record.kind === EDITOR_INVENTORY_RUNTIME_PLACEABLE_KIND &&
      typeof record.runtimeBlockTypeId === "string" &&
      !isForbiddenDebugBlockTypeId(record.runtimeBlockTypeId) &&
      Boolean(record.libraryRef) &&
      Boolean(record.placementCommand)
    );
  } catch {
    return false;
  }
}

export interface EditorInventorySelectionOptions {
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
  readonly blockTypeId?: string | null;
  readonly runtimeBlockTypeId?: string | null;
  readonly assetTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly inventoryItemId?: string | null;
  readonly inventorySlotIndex?: number | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;
  readonly preferEnabled?: boolean;
}

export interface EditorInventorySourceLoadOptions
  extends EditorInventorySelectionOptions {
  readonly force?: boolean;
  readonly forceRefresh?: boolean;
  readonly signal?: AbortSignal;
  readonly allowStaticFallback?: boolean;
  readonly allowLegacyChunkInventory?: boolean;
  readonly reason?: string;
}

export interface EditorInventorySourceRefreshOptions {
  readonly signal?: AbortSignal;
  readonly forceRefresh?: boolean;
  readonly reason?: string;
}

export interface EditorInventorySourceHandleBase {
  readonly kind?: string;

  load(options?: EditorInventorySourceLoadOptions): Promise<unknown>;

  reload?(options?: EditorInventorySourceLoadOptions): Promise<unknown>;
  refresh?(options?: EditorInventorySourceRefreshOptions): Promise<unknown>;

  select?(selection: EditorInventorySelectionOptions): unknown;
  selectSlot?(slotIndex: number, reason?: string): unknown;
  selectNext?(reason?: string): unknown;
  selectPrevious?(reason?: string): unknown;

  getSnapshot?(): unknown;
  getCatalog?(): unknown;
  getSelectedRuntimePlaceable?(): EditorInventoryRuntimePlaceable | null;
  getRuntimePlaceableForSlot?(slotIndex: number): EditorInventoryRuntimePlaceable | null;

  clearCache?(): void;
  destroy?(reason?: string): void;
}

export type EditorHotbarInventorySourceHandle = EditorInventorySourceHandleBase;

export function isEditorInventorySourceHandle(
  value: unknown,
): value is EditorHotbarInventorySourceHandle {
  try {
    const record = asEditorInventoryContractRecord(value);
    return typeof record.load === "function";
  } catch {
    return false;
  }
}

export function hasInventorySelect(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  select(selection: EditorInventorySelectionOptions): unknown;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).select === "function"
    );
  } catch {
    return false;
  }
}

export function hasInventorySelectSlot(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  selectSlot(slotIndex: number, reason?: string): unknown;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).selectSlot === "function"
    );
  } catch {
    return false;
  }
}

export function hasInventorySelectNext(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  selectNext(reason?: string): unknown;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).selectNext === "function"
    );
  } catch {
    return false;
  }
}

export function hasInventorySelectPrevious(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  selectPrevious(reason?: string): unknown;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).selectPrevious === "function"
    );
  } catch {
    return false;
  }
}

export function hasInventoryRefresh(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  refresh(options?: EditorInventorySourceRefreshOptions): Promise<unknown>;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).refresh === "function"
    );
  } catch {
    return false;
  }
}

export function hasInventoryReload(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  reload(options?: EditorInventorySourceLoadOptions): Promise<unknown>;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).reload === "function"
    );
  } catch {
    return false;
  }
}

export function hasInventoryClearCache(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  clearCache(): void;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).clearCache === "function"
    );
  } catch {
    return false;
  }
}

export function hasSelectedRuntimePlaceable(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  getSelectedRuntimePlaceable(): EditorInventoryRuntimePlaceable | null;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).getSelectedRuntimePlaceable ===
        "function"
    );
  } catch {
    return false;
  }
}

export function hasRuntimePlaceableForSlot(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  getRuntimePlaceableForSlot(slotIndex: number): EditorInventoryRuntimePlaceable | null;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).getRuntimePlaceableForSlot ===
        "function"
    );
  } catch {
    return false;
  }
}

export function hasInventoryDestroy(
  source: unknown,
): source is EditorHotbarInventorySourceHandle & {
  destroy(reason?: string): void;
} {
  try {
    return (
      isEditorInventorySourceHandle(source) &&
      typeof asEditorInventoryContractRecord(source).destroy === "function"
    );
  } catch {
    return false;
  }
}

function assignDefined(
  target: EditorInventoryContractRecord,
  key: string,
  value: unknown,
): EditorInventoryContractRecord {
  try {
    if (value !== undefined && value !== null) {
      target[key] = value;
    }
  } catch {
    // Assignment helper must remain no-op safe.
  }

  return target;
}

export function normalizeInventorySourceLoadOptions(
  options?: EditorInventorySourceLoadOptions | null,
): EditorInventorySourceLoadOptions {
  try {
    const selectedSlot = normalizeOptionalContractInteger(
      options?.selectedSlotIndex ?? options?.selectedSlot,
    );

    const normalized: EditorInventoryContractRecord = {
      force: options?.force === true,
      forceRefresh: options?.forceRefresh === true || options?.force === true,
      preferEnabled: options?.preferEnabled !== false,
      allowLegacyChunkInventory: options?.allowLegacyChunkInventory === true,
    };

    assignDefined(normalized, "selectedSlot", selectedSlot);
    assignDefined(normalized, "selectedSlotIndex", selectedSlot);

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      options?.runtimeBlockTypeId ?? options?.blockTypeId,
    );
    const blockTypeId = normalizeRuntimeBlockTypeId(
      options?.blockTypeId ?? options?.runtimeBlockTypeId,
    );

    assignDefined(normalized, "blockTypeId", blockTypeId);
    assignDefined(normalized, "runtimeBlockTypeId", runtimeBlockTypeId);
    assignDefined(normalized, "assetTypeId", normalizeOptionalContractText(options?.assetTypeId));
    assignDefined(
      normalized,
      "libraryItemId",
      normalizeOptionalContractText(options?.libraryItemId),
    );
    assignDefined(
      normalized,
      "inventoryItemId",
      normalizeOptionalContractText(options?.inventoryItemId),
    );
    assignDefined(
      normalized,
      "inventorySlotIndex",
      normalizeOptionalContractInteger(options?.inventorySlotIndex),
    );
    assignDefined(normalized, "familyId", normalizeOptionalContractText(options?.familyId));
    assignDefined(normalized, "packageId", normalizeOptionalContractText(options?.packageId));
    assignDefined(normalized, "vplibUid", normalizeOptionalContractText(options?.vplibUid));
    assignDefined(normalized, "variantId", normalizeOptionalContractText(options?.variantId));
    assignDefined(
      normalized,
      "revisionHash",
      normalizeOptionalContractText(options?.revisionHash),
    );
    assignDefined(normalized, "objectKind", normalizeOptionalContractText(options?.objectKind));
    assignDefined(normalized, "signal", options?.signal);
    assignDefined(normalized, "allowStaticFallback", options?.allowStaticFallback);
    assignDefined(normalized, "reason", normalizeOptionalContractText(options?.reason));

    return normalized as EditorInventorySourceLoadOptions;
  } catch {
    return {};
  }
}

export function editorInventoryContractRules(): EditorInventoryContractRecord {
  return {
    productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    browserCallsVectoplanLibraryDirectly: BROWSER_CALLS_VECTOPLAN_LIBRARY_DIRECTLY,
    onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
    debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
    allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
    legacyChunkInventoryIsDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
    emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
  };
}

export function editorInventoryContractDiagnostics(
  value?: unknown,
): EditorInventoryContractRecord {
  try {
    const record = asEditorInventoryContractRecord(value);

    return {
      moduleName: EDITOR_INVENTORY_CONTRACT_MODULE_NAME,
      moduleVersion: EDITOR_INVENTORY_CONTRACT_MODULE_VERSION,
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
      sourceKind: normalizeInventorySourceKind(
        record.sourceKind ?? record.source ?? DEFAULT_EDITOR_INVENTORY_SOURCE_KIND,
      ),
      itemKind: normalizeInventoryItemKind(
        record.itemKind ?? record.kind ?? DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
      ),
      hasLibraryIdentity: hasLibraryIdentity(record),
      runtimeBlockTypeId: normalizeRuntimeBlockTypeId(
        record.runtimeBlockTypeId ?? record.blockTypeId,
      ),
      containsForbiddenDebugBlockTypeIds: containsForbiddenDebugBlockTypeId(value),
      rules: editorInventoryContractRules(),
    };
  } catch {
    return {
      moduleName: EDITOR_INVENTORY_CONTRACT_MODULE_NAME,
      moduleVersion: EDITOR_INVENTORY_CONTRACT_MODULE_VERSION,
      route: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
      error: "diagnostics-failed",
      rules: editorInventoryContractRules(),
    };
  }
}

export function getEditorInventoryContractMetadata(): EditorInventoryContractRecord {
  return {
    moduleName: EDITOR_INVENTORY_CONTRACT_MODULE_NAME,
    moduleVersion: EDITOR_INVENTORY_CONTRACT_MODULE_VERSION,
    primaryInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    inventoryHealthRoute: PRODUCTIVE_EDITOR_INVENTORY_HEALTH_ROUTE,
    inventoryMetadataRoute: PRODUCTIVE_EDITOR_INVENTORY_METADATA_ROUTE,
    creativeLibraryRoute: DEFAULT_EDITOR_CREATIVE_LIBRARY_ROUTE,
    creativeLibraryHealthRoute: DEFAULT_EDITOR_CREATIVE_LIBRARY_HEALTH_ROUTE,
    creativeLibraryMetadataRoute: DEFAULT_EDITOR_CREATIVE_LIBRARY_METADATA_ROUTE,
    defaultSourceKind: DEFAULT_EDITOR_INVENTORY_SOURCE_KIND,
    defaultItemKind: DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
    defaultSlotCount: DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    validSourceKinds: [...VALID_SOURCE_KINDS],
    librarySourceKinds: [...LIBRARY_SOURCE_KINDS],
    legacySourceKinds: [...LEGACY_SOURCE_KINDS],
    fallbackSourceKinds: [...FALLBACK_SOURCE_KINDS],
    validItemKinds: [...VALID_ITEM_KINDS],
    exportedContracts: {
      identity: "EditorLibraryIdentity",
      placementContext: "EditorLibraryPlacementContext",
      runtimePlaceable: "EditorInventoryRuntimePlaceable",
      inventorySourceHandle: "EditorHotbarInventorySourceHandle",
      loadOptions: "EditorInventorySourceLoadOptions",
      selectionOptions: "EditorInventorySelectionOptions",
    },
    capabilities: {
      hasInventorySelect: true,
      hasInventorySelectSlot: true,
      hasInventoryRefresh: true,
      hasInventoryReload: true,
      hasInventoryClearCache: true,
      hasSelectedRuntimePlaceable: true,
      hasRuntimePlaceableForSlot: true,
      hasInventoryDestroy: true,
    },
    rules: editorInventoryContractRules(),
  };
}