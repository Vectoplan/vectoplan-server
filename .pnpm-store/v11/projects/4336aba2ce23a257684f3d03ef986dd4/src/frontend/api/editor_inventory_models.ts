// services/vectoplan-editor/src/frontend/api/editor_inventory_models.ts
/**
 * Typen und kleine Modell-Helfer für die Editor-Inventory-API.
 *
 * Zweck:
 * - beschreibt die Response von GET /editor/api/inventory
 * - beschreibt VPLIB-/Library-basierte Hotbar-Slots
 * - hält Frontend-Typen stabil, auch wenn vectoplan-library neue Felder liefert
 * - trennt fachliche Library-Identität von temporärer Runtime-/Chunk-ID
 *
 * Architekturregel:
 * - Der Browser ruft Inventory über /editor/api/inventory ab.
 * - Der Browser ruft vectoplan-library nicht direkt auf.
 * - Placebare Items müssen aus der Library kommen.
 * - debug_grass / debug_dirt dürfen nicht als Inventory-Wahrheit gelten.
 *
 * Diese Datei enthält bewusst:
 * - keine fetch-Aufrufe
 * - keine DOM-Logik
 * - keine Three.js-/Scene-Logik
 * - keine Hotbar-Rendering-Logik
 * - keine Mutation des Editor-State
 */

export const EDITOR_INVENTORY_MODELS_MODULE_NAME = "frontend.api.editor_inventory_models";
export const EDITOR_INVENTORY_MODELS_MODULE_VERSION = "0.1.1";

export const DEFAULT_EDITOR_INVENTORY_API_URL = "/editor/api/inventory";
export const DEFAULT_EDITOR_INVENTORY_METADATA_URL = "/editor/api/inventory/_metadata";
export const DEFAULT_EDITOR_INVENTORY_HEALTH_URL = "/editor/api/inventory/_health";

export const DEFAULT_EDITOR_INVENTORY_KIND = "editor-inventory";
export const DEFAULT_EDITOR_INVENTORY_SCHEMA_VERSION = "editor-inventory.v1";

export const DEFAULT_EDITOR_INVENTORY_SOURCE = "library";
export const DEFAULT_EDITOR_INVENTORY_ITEM_KIND = "vplib";
export const DEFAULT_EDITOR_EMPTY_ITEM_KIND = "empty";

export const DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE = 9;
export const DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT = 0;

export const FORBIDDEN_DEBUG_BLOCK_TYPE_IDS: readonly string[] = Object.freeze([
  "debug_grass",
  "debug_dirt",
]);

export const EDITOR_INVENTORY_LOCAL_STORAGE_KEY = "vectoplan.editor.inventory";
export const EDITOR_INVENTORY_SELECTED_SLOT_STORAGE_KEY = "vectoplan.editor.inventory.selectedSlot";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type UnknownRecord = Record<string, unknown>;

export type EditorInventorySource =
  | "library"
  | "fallback"
  | "empty"
  | "error"
  | "chunk-debug"
  | "server-placeholder"
  | string;

export type EditorInventorySourceDetail =
  | "library-inventory"
  | "library-published-blocks"
  | "empty-no-library-items"
  | "route-error"
  | string;

export type EditorInventoryItemKind =
  | "vplib"
  | "empty"
  | "block"
  | "library-item"
  | string;

export type EditorInventoryIconKind =
  | "library-item"
  | "empty"
  | "placeholder"
  | "css-placeholder"
  | string;

export type EditorInventoryPlacementCommandKind =
  | "PlaceLibraryItem"
  | "SetBlock"
  | string;

export type EditorInventoryLoadState =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "fallback"
  | "error";

export interface EditorInventoryClassification {
  domain?: string | null;
  category?: string | null;
  subcategory?: string | null;
  path?: string | null;
  label?: string | null;
  raw?: UnknownRecord;
  extra?: UnknownRecord;
}

export interface EditorInventoryAssetRefs {
  iconUrl?: string | null;
  icon_url?: string | null;
  previewUrl?: string | null;
  preview_url?: string | null;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  modelUrl?: string | null;
  model_url?: string | null;
  modelKind?: string | null;
  model_kind?: string | null;
  items?: UnknownRecord[];
  raw?: UnknownRecord;
  extra?: UnknownRecord;
  [key: string]: unknown;
}

export interface EditorInventoryIcon {
  key?: string | null;
  kind?: EditorInventoryIconKind;
  url?: string | null;
  placeholder?: boolean;
  cssClass?: string | null;
  css_class?: string | null;
  ariaHidden?: boolean;
  aria_hidden?: boolean;
  raw?: UnknownRecord;
  extra?: UnknownRecord;
  [key: string]: unknown;
}

export interface EditorInventoryLibraryRef {
  source?: "vectoplan-library" | string;
  kind?: "vplib" | string;
  libraryItemId?: string | null;
  library_item_id?: string | null;
  familyId?: string | null;
  family_id?: string | null;
  packageId?: string | null;
  package_id?: string | null;
  vplibUid?: string | null;
  vplib_uid?: string | null;
  variantId?: string | null;
  variant_id?: string | null;
  revisionHash?: string | null;
  revision_hash?: string | null;
  objectKind?: string | null;
  object_kind?: string | null;
  domain?: string | null;
  category?: string | null;
  subcategory?: string | null;
  sourcePath?: string | null;
  source_path?: string | null;
  stableKey?: string | null;
  valid?: boolean;
  raw?: UnknownRecord;
  extra?: UnknownRecord;
  [key: string]: unknown;
}

export interface EditorInventoryPlacementCommand {
  kind?: EditorInventoryPlacementCommandKind;
  source?: "vectoplan-library" | string;
  runtimeBlockTypeId?: string | null;
  runtime_block_type_id?: string | null;
  blockTypeId?: string | null;
  block_type_id?: string | null;
  libraryRef?: EditorInventoryLibraryRef | null;
  library_ref?: EditorInventoryLibraryRef | null;
  payload?: UnknownRecord;
  extra?: UnknownRecord;
  placeable?: boolean;
  [key: string]: unknown;
}

export interface EditorInventoryItem {
  itemId?: string | null;
  item_id?: string | null;
  itemKind?: EditorInventoryItemKind;
  item_kind?: EditorInventoryItemKind;
  kind?: EditorInventoryItemKind;
  type?: string | null;
  source?: EditorInventorySource;
  label?: string | null;
  displayLabel?: string | null;
  display_label?: string | null;
  visibleLabel?: boolean;
  visible_label?: boolean;
  description?: string | null;

  blockTypeId?: string | null;
  block_type_id?: string | null;
  runtimeBlockTypeId?: string | null;
  runtime_block_type_id?: string | null;

  familyId?: string | null;
  family_id?: string | null;
  packageId?: string | null;
  package_id?: string | null;
  vplibUid?: string | null;
  vplib_uid?: string | null;
  variantId?: string | null;
  variant_id?: string | null;
  revisionHash?: string | null;
  revision_hash?: string | null;
  objectKind?: string | null;
  object_kind?: string | null;

  domain?: string | null;
  category?: string | null;
  subcategory?: string | null;
  classification?: EditorInventoryClassification | null;

  iconKey?: string | null;
  icon_key?: string | null;
  iconKind?: EditorInventoryIconKind;
  icon_kind?: EditorInventoryIconKind;
  iconUrl?: string | null;
  icon_url?: string | null;
  icon?: EditorInventoryIcon | null;

  placeable?: boolean;
  breakable?: boolean;

  libraryRef?: EditorInventoryLibraryRef | null;
  library_ref?: EditorInventoryLibraryRef | null;
  placementCommand?: EditorInventoryPlacementCommand | null;
  placement_command?: EditorInventoryPlacementCommand | null;

  assets?: EditorInventoryAssetRefs | UnknownRecord | null;
  metadata?: UnknownRecord;
  raw?: UnknownRecord;
  extra?: UnknownRecord;
  stableKey?: string | null;

  [key: string]: unknown;
}

export interface EditorInventorySlot {
  slotIndex: number;
  slotKey?: string | null;
  empty: boolean;
  enabled?: boolean;
  selected?: boolean;

  source?: EditorInventorySource;
  sourceKind?: string | null;
  source_kind?: string | null;

  itemId?: string | null;
  item_id?: string | null;
  itemKind?: EditorInventoryItemKind;
  item_kind?: EditorInventoryItemKind;
  kind?: EditorInventoryItemKind;
  type?: string | null;

  blockTypeId?: string | null;
  block_type_id?: string | null;
  runtimeBlockTypeId?: string | null;
  runtime_block_type_id?: string | null;

  placeable?: boolean;
  breakable?: boolean;

  iconKey?: string | null;
  icon_key?: string | null;
  iconKind?: EditorInventoryIconKind;
  icon_kind?: EditorInventoryIconKind;
  iconUrl?: string | null;
  icon_url?: string | null;
  icon?: EditorInventoryIcon | null;

  label?: string | null;
  displayLabel?: string | null;
  display_label?: string | null;
  visibleLabel?: boolean;
  visible_label?: boolean;
  ariaLabel?: string | null;
  aria_label?: string | null;
  title?: string | null;
  description?: string | null;

  stackSize?: number;
  stack_size?: number;
  maxStackSize?: number;
  max_stack_size?: number;

  familyId?: string | null;
  family_id?: string | null;
  packageId?: string | null;
  package_id?: string | null;
  vplibUid?: string | null;
  vplib_uid?: string | null;
  variantId?: string | null;
  variant_id?: string | null;
  revisionHash?: string | null;
  revision_hash?: string | null;
  objectKind?: string | null;
  object_kind?: string | null;
  domain?: string | null;
  category?: string | null;
  subcategory?: string | null;

  libraryRef?: EditorInventoryLibraryRef | null;
  library_ref?: EditorInventoryLibraryRef | null;
  placementCommand?: EditorInventoryPlacementCommand | null;
  placement_command?: EditorInventoryPlacementCommand | null;

  assets?: EditorInventoryAssetRefs | UnknownRecord | null;
  metadata?: UnknownRecord;
  raw?: UnknownRecord;
  extra?: UnknownRecord;

  [key: string]: unknown;
}

export interface EditorInventoryState {
  enabled: boolean;
  source: EditorInventorySource;
  sourceDetail?: EditorInventorySourceDetail;
  source_detail?: EditorInventorySourceDetail;
  hotbarSize: number;
  hotbar_size?: number;
  defaultSelectedSlot: number;
  default_selected_slot?: number;
  selectedSlot: number;
  selected_slot?: number;
  scrollWrap?: boolean;
  scroll_wrap?: boolean;
  allowPlaceAction?: boolean;
  allow_place_action?: boolean;
  allowBreakAction?: boolean;
  allow_break_action?: boolean;
  iconOnly?: boolean;
  icon_only?: boolean;
  onlyLibraryItemsPlaceable?: boolean;
  debugGrassDirtAllowed?: boolean;
  allowChunkPlaceableFallback?: boolean;
  allowEmptyFallback?: boolean;

  items: EditorInventoryItem[];
  slots: EditorInventorySlot[];

  emptySlotCount?: number;
  empty_slot_count?: number;
  filledSlotCount?: number;
  filled_slot_count?: number;
  placeableSlotCount?: number;
  placeable_slot_count?: number;
  hasPlaceableItems?: boolean;

  selectedItem?: EditorInventoryItem | null;
  metadata?: UnknownRecord;
  raw?: UnknownRecord;
  extra?: UnknownRecord;

  [key: string]: unknown;
}

export interface EditorInventoryCapabilities {
  serverDriven?: boolean;
  source?: string;
  supportsEmptySlots?: boolean;
  supportsLibraryItems?: boolean;
  supportsVplib?: boolean;
  supportsFamilyId?: boolean;
  supportsVplibUid?: boolean;
  supportsVariantId?: boolean;
  supportsRuntimeBlockTypeId?: boolean;
  supportsPlacementCommand?: boolean;
  supportsRemoteAssets?: boolean;
  supportsChunkDebugFallback?: boolean;
  allowsDebugGrassDirt?: boolean;
  normalizationDelegatedToLibraryInventory?: boolean;
  [key: string]: unknown;
}

export interface EditorInventoryFallback {
  active: boolean;
  reason?: string | null;
  sourceError?: unknown;
  source_error?: unknown;
  [key: string]: unknown;
}

export interface EditorInventoryDiagnostics {
  requestMethod?: string | null;
  requestPath?: string | null;
  requestId?: string | null;
  requestArgs?: UnknownRecord;
  payload?: UnknownRecord;
  library?: UnknownRecord;
  adapter?: UnknownRecord;
  normalizer?: UnknownRecord;
  [key: string]: unknown;
}

export interface EditorInventoryErrorPayload {
  reason?: string | null;
  message?: string | null;
  stage?: string | null;
  detail?: string | null;
  [key: string]: unknown;
}

export interface EditorInventoryPayload {
  ok: boolean;
  kind: string;
  schemaVersion?: string;
  schema_version?: string;
  source: EditorInventorySource;
  sourceDetail?: EditorInventorySourceDetail;
  source_detail?: EditorInventorySourceDetail;
  generatedAtUtc?: string;
  generated_at_utc?: string;
  route?: string;
  statusCode?: number;

  inventory: EditorInventoryState;
  capabilities?: EditorInventoryCapabilities;
  fallback?: EditorInventoryFallback;
  diagnostics?: EditorInventoryDiagnostics;
  error?: EditorInventoryErrorPayload | UnknownRecord;

  metadata?: UnknownRecord;
  raw?: UnknownRecord;
  extra?: UnknownRecord;

  [key: string]: unknown;
}

export interface EditorInventoryApiClientOptions {
  url?: string;
  timeoutMs?: number;
  forceRefresh?: boolean;
  includeEmptySlots?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  requestId?: string;
}

export interface EditorInventoryLoadSuccess {
  ok: true;
  state: EditorInventoryState;
  payload: EditorInventoryPayload;
  selectedSlot: EditorInventorySlot | null;
  selectedItem: EditorInventoryItem | null;
  placeableSlots: EditorInventorySlot[];
  fetchedAt: number;
  fromCache?: boolean;

  /**
   * Gemeinsame Union-Felder.
   *
   * Diese Felder sind absichtlich auch im Success-Zweig vorhanden, damit
   * abhängiger Code `result.error` / `result.reason` lesen kann, ohne dass
   * TypeScript die Property-Existenz im Union-Typ verliert.
   */
  error?: null;
  reason?: null;
}

export interface EditorInventoryLoadFailure {
  ok: false;
  state: EditorInventoryState;
  payload?: EditorInventoryPayload | null;
  error: Error;
  reason: string;
  fetchedAt: number;
  fromCache?: false;

  /**
   * Gemeinsame optionale Felder für Call-Sites, die unabhängig vom Ergebnis
   * auf Selection-Daten zugreifen.
   */
  selectedSlot?: null;
  selectedItem?: null;
  placeableSlots?: EditorInventorySlot[];
}

export type EditorInventoryLoadResult =
  | EditorInventoryLoadSuccess
  | EditorInventoryLoadFailure;

export interface EditorInventoryRuntimeSelection {
  slotIndex: number;
  slot: EditorInventorySlot | null;
  item: EditorInventoryItem | null;
  libraryRef: EditorInventoryLibraryRef | null;
  placementCommand: EditorInventoryPlacementCommand | null;
  runtimeBlockTypeId: string | null;
  blockTypeId: string | null;
  placeable: boolean;
  source: EditorInventorySource;
  itemKind: EditorInventoryItemKind;
}

declare global {
  interface Window {
    __VECTOPLAN_EDITOR_INVENTORY__?: EditorInventoryState | UnknownRecord;
    __VECTOPLAN_EDITOR_INVENTORY_CONFIG__?: EditorInventoryState | UnknownRecord;
    __VECTOPLAN_EDITOR_INVENTORY_API_URL__?: string;
    __VECTOPLAN_EDITOR_INVENTORY_URL__?: string;
    __VECTOPLAN_EDITOR_INVENTORY_ROUTE__?: string;
    __VECTOPLAN_EDITOR_INVENTORY_SOURCE__?: string;
    __VECTOPLAN_EDITOR_INVENTORY_KIND__?: string;
    __VECTOPLAN_EDITOR_INVENTORY_ENABLED__?: boolean;
    __VECTOPLAN_EDITOR_INVENTORY_HEALTH_URL__?: string;
    __VECTOPLAN_EDITOR_INVENTORY_METADATA_URL__?: string;
    __VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE__?: number;
    __VECTOPLAN_EDITOR_INVENTORY_SELECTED_SLOT__?: number;

    __VECTOPLAN_EDITOR_ONLY_LIBRARY_ITEMS_PLACEABLE__?: boolean;
    __VECTOPLAN_EDITOR_DEBUG_BLOCKS_ALLOWED_IN_INVENTORY__?: boolean;
    __VECTOPLAN_EDITOR_DEBUG_GRASS_DIRT_ALLOWED__?: boolean;

    __VECTOPLAN_EDITOR_LIBRARY_CONFIG__?: UnknownRecord;
    __VECTOPLAN_EDITOR_LIBRARY_ENABLED__?: boolean;
    __VECTOPLAN_EDITOR_LIBRARY_API_URL__?: string;
    __VECTOPLAN_EDITOR_LIBRARY_BROWSER_API_URL__?: string;
    __VECTOPLAN_EDITOR_LIBRARY_INVENTORY_ROUTE__?: string;
    __VECTOPLAN_EDITOR_LIBRARY_HEALTH_ROUTE__?: string;
    __VECTOPLAN_EDITOR_LIBRARY_METADATA_ROUTE__?: string;

    __VECTOPLAN_EDITOR_PRODUCTIVE_INVENTORY_ROUTE__?: string;
    __VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__?: string;
    __VECTOPLAN_EDITOR_BROWSER_CALLS_LIBRARY_DIRECTLY__?: boolean;
    __VECTOPLAN_EDITOR_LEGACY_CHUNK_INVENTORY_ENABLED__?: boolean;
    __VECTOPLAN_EDITOR_CHUNK_SERVICE_INVENTORY_ENABLED__?: boolean;
    __VECTOPLAN_EDITOR_CHUNK_PALETTE_INVENTORY_FALLBACK_ENABLED__?: boolean;
    __VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_PLACEHOLDER_ROUTE_ENABLED__?: boolean;

    __VECTOPLAN_EDITOR_RUNTIME_CONFIG__?: unknown;
    __VECTOPLAN_EDITOR_BOOTSTRAP__?: unknown;
    __VECTOPLAN_EDITOR_BOOT_ID__?: string;
  }
}

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || fallback;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  try {
    const normalized = String(value).trim();
    return normalized || fallback;
  } catch {
    return fallback;
  }
}

export function asOptionalString(value: unknown): string | null {
  const normalized = asString(value, "");
  return normalized || null;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Boolean(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "t", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "f", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

export function asInteger(
  value: unknown,
  fallback: number,
  minimum?: number,
  maximum?: number,
): number {
  let parsed = fallback;

  if (typeof value === "number" && Number.isFinite(value)) {
    parsed = Math.floor(value);
  } else if (typeof value === "string" && value.trim()) {
    const candidate = Number(value.trim());
    if (Number.isFinite(candidate)) {
      parsed = Math.floor(candidate);
    }
  }

  if (!Number.isFinite(parsed)) {
    parsed = fallback;
  }

  if (typeof minimum === "number" && parsed < minimum) {
    parsed = minimum;
  }

  if (typeof maximum === "number" && parsed > maximum) {
    parsed = maximum;
  }

  return parsed;
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function readAny(record: unknown, keys: string[], fallback: unknown = undefined): unknown {
  if (!isRecord(record)) {
    return fallback;
  }

  for (const key of keys) {
    if (hasOwn(record, key)) {
      const value = record[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return fallback;
}

export function createEditorInventoryError(
  value: unknown,
  fallbackMessage = "Editor inventory request failed.",
): Error {
  try {
    if (value instanceof Error) {
      return value;
    }

    if (isRecord(value)) {
      const message = asString(
        value.message ??
          value.detail ??
          value.reason ??
          value.error,
        fallbackMessage,
      );

      const error = new Error(message);
      error.name = asString(value.name ?? value.code ?? value.type, "EditorInventoryError");
      return error;
    }

    if (typeof value === "string" && value.trim()) {
      return new Error(value.trim());
    }

    return new Error(fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}

export function isEditorInventoryLoadSuccess(value: unknown): value is EditorInventoryLoadSuccess {
  return isRecord(value) && value.ok === true && isRecord(value.state);
}

export function isEditorInventoryLoadFailure(value: unknown): value is EditorInventoryLoadFailure {
  return isRecord(value) && value.ok === false;
}

export function isEditorInventoryLoadResult(value: unknown): value is EditorInventoryLoadResult {
  return isEditorInventoryLoadSuccess(value) || isEditorInventoryLoadFailure(value);
}

export function getEditorInventoryLoadError(result: unknown): Error | null {
  if (!isRecord(result)) {
    return null;
  }

  if (result.ok === false) {
    return createEditorInventoryError(result.error, asString(result.reason, "Editor inventory load failed."));
  }

  const error = result.error;

  if (error === null || error === undefined) {
    return null;
  }

  return createEditorInventoryError(error);
}

export function getEditorInventoryLoadReason(result: unknown, fallback = "unknown"): string {
  if (!isRecord(result)) {
    return fallback;
  }

  const reason = asOptionalString(result.reason);

  if (reason) {
    return reason;
  }

  const error = getEditorInventoryLoadError(result);

  return error?.message ?? fallback;
}

export function getSlotIndex(slot: Partial<EditorInventorySlot> | unknown, fallback = 0): number {
  return asInteger(
    readAny(slot, ["slotIndex", "slot_index", "index", "slot"], fallback),
    fallback,
    0,
    63,
  );
}

export function getItemId(value: Partial<EditorInventorySlot | EditorInventoryItem> | unknown): string | null {
  return asOptionalString(readAny(value, ["itemId", "item_id", "libraryItemId", "library_item_id"]));
}

export function getFamilyId(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryLibraryRef> | unknown): string | null {
  return asOptionalString(readAny(value, ["familyId", "family_id"]));
}

export function getPackageId(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryLibraryRef> | unknown): string | null {
  return asOptionalString(readAny(value, ["packageId", "package_id"]));
}

export function getVplibUid(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryLibraryRef> | unknown): string | null {
  return asOptionalString(readAny(value, ["vplibUid", "vplib_uid"]));
}

export function getVariantId(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryLibraryRef> | unknown): string {
  return asString(readAny(value, ["variantId", "variant_id"], "default"), "default");
}

export function getRevisionHash(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryLibraryRef> | unknown): string | null {
  return asOptionalString(readAny(value, ["revisionHash", "revision_hash"]));
}

export function getRuntimeBlockTypeId(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryPlacementCommand> | unknown): string | null {
  return asOptionalString(
    readAny(value, [
      "runtimeBlockTypeId",
      "runtime_block_type_id",
      "blockTypeId",
      "block_type_id",
    ]),
  );
}

export function getBlockTypeId(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryPlacementCommand> | unknown): string | null {
  return asOptionalString(
    readAny(value, [
      "blockTypeId",
      "block_type_id",
      "runtimeBlockTypeId",
      "runtime_block_type_id",
    ]),
  );
}

export function getLibraryRef(value: Partial<EditorInventorySlot | EditorInventoryItem | EditorInventoryPlacementCommand> | unknown): EditorInventoryLibraryRef | null {
  const record = asRecord(value);
  const direct = record.libraryRef ?? record.library_ref;

  if (isRecord(direct)) {
    return direct as EditorInventoryLibraryRef;
  }

  const nestedCommand = record.placementCommand ?? record.placement_command;
  if (isRecord(nestedCommand)) {
    const nestedRef = nestedCommand.libraryRef ?? nestedCommand.library_ref;
    if (isRecord(nestedRef)) {
      return nestedRef as EditorInventoryLibraryRef;
    }
  }

  const familyId = getFamilyId(record);
  const vplibUid = getVplibUid(record);

  if (!familyId && !vplibUid) {
    return null;
  }

  return {
    source: "vectoplan-library",
    kind: "vplib",
    libraryItemId: getItemId(record),
    familyId,
    packageId: getPackageId(record),
    vplibUid,
    variantId: getVariantId(record),
    revisionHash: getRevisionHash(record),
    objectKind: asOptionalString(readAny(record, ["objectKind", "object_kind"])),
    domain: asOptionalString(record.domain),
    category: asOptionalString(record.category),
    subcategory: asOptionalString(record.subcategory),
    valid: Boolean(familyId || vplibUid || getItemId(record)),
  };
}

export function getPlacementCommand(value: Partial<EditorInventorySlot | EditorInventoryItem> | unknown): EditorInventoryPlacementCommand | null {
  const record = asRecord(value);
  const direct = record.placementCommand ?? record.placement_command;

  if (isRecord(direct)) {
    return direct as EditorInventoryPlacementCommand;
  }

  const runtimeBlockTypeId = getRuntimeBlockTypeId(record);
  const libraryRef = getLibraryRef(record);

  if (!runtimeBlockTypeId || !libraryRef) {
    return null;
  }

  return {
    kind: "PlaceLibraryItem",
    source: "vectoplan-library",
    runtimeBlockTypeId,
    blockTypeId: runtimeBlockTypeId,
    libraryRef,
    placeable: true,
  };
}

export function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  const normalized = asString(value, "");
  return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.includes(normalized);
}

export function isEditorInventorySlot(value: unknown): value is EditorInventorySlot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.slotIndex === "number" ||
    typeof value.slot_index === "number" ||
    typeof value.empty === "boolean"
  );
}

export function isEditorInventoryItem(value: unknown): value is EditorInventoryItem {
  if (!isRecord(value)) {
    return false;
  }

  return Boolean(
    value.itemId ||
      value.item_id ||
      value.familyId ||
      value.family_id ||
      value.vplibUid ||
      value.vplib_uid,
  );
}

export function isEditorInventoryPayload(value: unknown): value is EditorInventoryPayload {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.inventory) && Array.isArray(value.inventory.slots);
}

export function isEmptyInventorySlot(slot: Partial<EditorInventorySlot> | unknown): boolean {
  const record = asRecord(slot);
  return asBoolean(record.empty, true);
}

export function isLibraryInventorySlot(slot: Partial<EditorInventorySlot> | unknown): boolean {
  const record = asRecord(slot);
  const source = asString(record.source, "");
  const itemKind = asString(record.itemKind ?? record.item_kind ?? record.kind, "");

  return (
    source === "library" ||
    itemKind === "vplib" ||
    itemKind === "library-item" ||
    Boolean(getFamilyId(record) || getVplibUid(record) || getLibraryRef(record))
  );
}

export function isPlaceableLibrarySlot(slot: Partial<EditorInventorySlot> | unknown): boolean {
  const record = asRecord(slot);

  if (isEmptyInventorySlot(record)) {
    return false;
  }

  if (!isLibraryInventorySlot(record)) {
    return false;
  }

  if (!asBoolean(record.enabled, true)) {
    return false;
  }

  if (!asBoolean(record.placeable, false)) {
    return false;
  }

  const runtimeBlockTypeId = getRuntimeBlockTypeId(record);

  if (!runtimeBlockTypeId || isForbiddenDebugBlockTypeId(runtimeBlockTypeId)) {
    return false;
  }

  return Boolean(getFamilyId(record) || getVplibUid(record) || getLibraryRef(record));
}

export function inventoryPayloadContainsForbiddenDebugBlockIds(payload: unknown): boolean {
  try {
    const serialized = JSON.stringify(payload);
    return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.some((id) => serialized.includes(id));
  } catch {
    return false;
  }
}

export function getInventoryState(payload: unknown): EditorInventoryState | null {
  if (!isRecord(payload)) {
    return null;
  }

  const inventory = payload.inventory;
  if (!isRecord(inventory)) {
    return null;
  }

  return inventory as unknown as EditorInventoryState;
}

export function getInventorySlots(payloadOrState: unknown): EditorInventorySlot[] {
  const state = getInventoryState(payloadOrState) ?? (isRecord(payloadOrState) ? payloadOrState : null);

  if (!state) {
    return [];
  }

  return asArray<EditorInventorySlot>((state as UnknownRecord).slots)
    .filter(isEditorInventorySlot)
    .sort((left, right) => getSlotIndex(left) - getSlotIndex(right));
}

export function getInventoryItems(payloadOrState: unknown): EditorInventoryItem[] {
  const state = getInventoryState(payloadOrState) ?? (isRecord(payloadOrState) ? payloadOrState : null);

  if (!state) {
    return [];
  }

  return asArray<EditorInventoryItem>((state as UnknownRecord).items).filter(isEditorInventoryItem);
}

export function getPlaceableInventorySlots(payloadOrState: unknown): EditorInventorySlot[] {
  return getInventorySlots(payloadOrState).filter(isPlaceableLibrarySlot);
}

export function getSelectedSlotIndex(payloadOrState: unknown): number {
  const state = getInventoryState(payloadOrState) ?? (isRecord(payloadOrState) ? payloadOrState : null);

  if (!state) {
    return DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT;
  }

  const hotbarSize = asInteger(
    (state as UnknownRecord).hotbarSize ?? (state as UnknownRecord).hotbar_size,
    DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
    1,
    64,
  );

  return asInteger(
    (state as UnknownRecord).selectedSlot ??
      (state as UnknownRecord).selected_slot ??
      (state as UnknownRecord).defaultSelectedSlot ??
      (state as UnknownRecord).default_selected_slot,
    DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
    0,
    Math.max(0, hotbarSize - 1),
  );
}

export function getSelectedInventorySlot(payloadOrState: unknown): EditorInventorySlot | null {
  const selectedIndex = getSelectedSlotIndex(payloadOrState);
  const slots = getInventorySlots(payloadOrState);

  return slots.find((slot) => getSlotIndex(slot) === selectedIndex) ?? null;
}

export function getSelectedInventoryItem(payloadOrState: unknown): EditorInventoryItem | null {
  const selectedSlot = getSelectedInventorySlot(payloadOrState);

  if (!selectedSlot || selectedSlot.empty) {
    return null;
  }

  const record = asRecord(selectedSlot);

  return {
    itemId: getItemId(record),
    itemKind: asString(record.itemKind ?? record.item_kind ?? record.kind, "vplib"),
    kind: asString(record.kind ?? record.itemKind ?? record.item_kind, "vplib"),
    source: asString(record.source, "library"),
    label: asOptionalString(record.label),
    displayLabel: asOptionalString(record.displayLabel ?? record.display_label),
    visibleLabel: asBoolean(record.visibleLabel ?? record.visible_label, true),
    description: asOptionalString(record.description),
    blockTypeId: getBlockTypeId(record),
    runtimeBlockTypeId: getRuntimeBlockTypeId(record),
    familyId: getFamilyId(record),
    packageId: getPackageId(record),
    vplibUid: getVplibUid(record),
    variantId: getVariantId(record),
    revisionHash: getRevisionHash(record),
    objectKind: asOptionalString(record.objectKind ?? record.object_kind),
    domain: asOptionalString(record.domain),
    category: asOptionalString(record.category),
    subcategory: asOptionalString(record.subcategory),
    iconKey: asOptionalString(record.iconKey ?? record.icon_key),
    iconKind: asString(record.iconKind ?? record.icon_kind, "library-item"),
    iconUrl: asOptionalString(record.iconUrl ?? record.icon_url),
    icon: isRecord(record.icon) ? (record.icon as EditorInventoryIcon) : null,
    placeable: isPlaceableLibrarySlot(record),
    breakable: asBoolean(record.breakable, false),
    libraryRef: getLibraryRef(record),
    placementCommand: getPlacementCommand(record),
    assets: isRecord(record.assets) ? record.assets : null,
    metadata: asRecord(record.metadata),
  };
}

export function getRuntimeSelection(payloadOrState: unknown): EditorInventoryRuntimeSelection {
  const selectedSlotIndex = getSelectedSlotIndex(payloadOrState);
  const slot = getSelectedInventorySlot(payloadOrState);
  const item = getSelectedInventoryItem(payloadOrState);
  const libraryRef = slot ? getLibraryRef(slot) : null;
  const placementCommand = slot ? getPlacementCommand(slot) : null;
  const runtimeBlockTypeId = slot ? getRuntimeBlockTypeId(slot) : null;
  const blockTypeId = slot ? getBlockTypeId(slot) : null;

  return {
    slotIndex: selectedSlotIndex,
    slot,
    item,
    libraryRef,
    placementCommand,
    runtimeBlockTypeId,
    blockTypeId,
    placeable: Boolean(slot && isPlaceableLibrarySlot(slot)),
    source: asString(slot?.source, "empty"),
    itemKind: asString(slot?.itemKind ?? slot?.item_kind ?? slot?.kind, "empty"),
  };
}

export function isInventoryPayloadOk(payload: unknown): boolean {
  if (!isEditorInventoryPayload(payload)) {
    return false;
  }

  if (!asBoolean(payload.ok, false)) {
    return false;
  }

  if (inventoryPayloadContainsForbiddenDebugBlockIds(payload)) {
    return false;
  }

  return getPlaceableInventorySlots(payload).length > 0;
}

export function getEditorInventoryModelsMetadata(): UnknownRecord {
  return {
    moduleName: EDITOR_INVENTORY_MODELS_MODULE_NAME,
    moduleVersion: EDITOR_INVENTORY_MODELS_MODULE_VERSION,
    defaultInventoryApiUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
    defaultInventoryKind: DEFAULT_EDITOR_INVENTORY_KIND,
    defaultSchemaVersion: DEFAULT_EDITOR_INVENTORY_SCHEMA_VERSION,
    defaultSource: DEFAULT_EDITOR_INVENTORY_SOURCE,
    defaultItemKind: DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
    defaultHotbarSize: DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      runtimeBlockTypeIdIsTemporaryAdapter: true,
      loadResultHasCommonErrorAndReasonFields: true,
      hasLoadResultTypeGuards: true,
      duplicateCreativeLibraryRouteWindowGlobalRemoved: true,
      runtimeConfigWindowGlobalAcceptsStructuredType: true,
      bootstrapWindowGlobalAcceptsStructuredType: true,
    },
  };
}