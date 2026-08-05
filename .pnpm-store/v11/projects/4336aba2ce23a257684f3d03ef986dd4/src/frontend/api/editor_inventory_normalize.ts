// services/vectoplan-editor/src/frontend/api/editor_inventory_normalize.ts
/**
 * Defensive Normalisierung für die Editor-Inventory-API.
 *
 * Zweck:
 * - normalisiert GET /editor/api/inventory in stabile Frontend-Strukturen
 * - toleriert künftige Änderungen an vectoplan-library-Payloads
 * - erhält unbekannte Felder in metadata/raw/extra
 * - füllt Hotbar-Slots defensiv auf
 * - verhindert debug_grass/debug_dirt als fachliche Inventory-Wahrheit
 * - erlaubt placebare Slots nur, wenn sie eine Library-/VPLIB-Identität tragen
 *
 * Diese Datei enthält bewusst:
 * - keine fetch-Aufrufe
 * - keine DOM-Logik
 * - keine Three.js-/Scene-Logik
 * - kein Rendering
 * - keine Mutation des globalen Editor-State
 */

import {
  DEFAULT_EDITOR_EMPTY_ITEM_KIND,
  DEFAULT_EDITOR_INVENTORY_API_URL,
  DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
  DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
  DEFAULT_EDITOR_INVENTORY_KIND,
  DEFAULT_EDITOR_INVENTORY_SCHEMA_VERSION,
  DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
  DEFAULT_EDITOR_INVENTORY_SOURCE,
  EDITOR_INVENTORY_MODELS_MODULE_VERSION,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  asArray,
  asBoolean,
  asInteger,
  asOptionalString,
  asRecord,
  asString,
  getBlockTypeId,
  getFamilyId,
  getItemId,
  getLibraryRef,
  getPackageId,
  getPlaceableInventorySlots,
  getPlacementCommand,
  getRevisionHash,
  getRuntimeBlockTypeId,
  getVariantId,
  getVplibUid,
  inventoryPayloadContainsForbiddenDebugBlockIds,
  isEditorInventoryPayload,
  isForbiddenDebugBlockTypeId,
  isPlaceableLibrarySlot,
  isRecord,
  readAny,
  type EditorInventoryAssetRefs,
  type EditorInventoryCapabilities,
  type EditorInventoryClassification,
  type EditorInventoryDiagnostics,
  type EditorInventoryErrorPayload,
  type EditorInventoryFallback,
  type EditorInventoryIcon,
  type EditorInventoryItem,
  type EditorInventoryItemKind,
  type EditorInventoryLibraryRef,
  type EditorInventoryLoadFailure,
  type EditorInventoryLoadResult,
  type EditorInventoryLoadSuccess,
  type EditorInventoryPayload,
  type EditorInventoryPlacementCommand,
  type EditorInventoryRuntimeSelection,
  type EditorInventorySlot,
  type EditorInventorySource,
  type EditorInventorySourceDetail,
  type EditorInventoryState,
  type UnknownRecord,
} from "./editor_inventory_models";

export const EDITOR_INVENTORY_NORMALIZE_MODULE_NAME = "frontend.api.editor_inventory_normalize";
export const EDITOR_INVENTORY_NORMALIZE_MODULE_VERSION = "0.1.1";

export interface NormalizeEditorInventoryOptions {
  hotbarSize?: number;
  selectedSlot?: number;
  includeEmptySlots?: boolean;
  iconOnly?: boolean;
  allowEmptyFallback?: boolean;
  allowBreakAction?: boolean;
  allowPlaceAction?: boolean;
  source?: EditorInventorySource;
  sourceDetail?: EditorInventorySourceDetail;
  route?: string;
  generatedAtUtc?: string;
  preserveRaw?: boolean;
  rejectForbiddenDebugItems?: boolean;
}

export interface NormalizeEditorInventoryStateOptions extends NormalizeEditorInventoryOptions {
  payloadOk?: boolean;
}

export interface NormalizeEditorInventorySlotOptions extends NormalizeEditorInventoryOptions {
  slotIndex?: number;
  selectedSlot?: number;
}

export interface NormalizeEditorInventoryItemOptions extends NormalizeEditorInventoryOptions {
  fallbackItemId?: string;
}

export interface InventoryPayloadShapeDetection {
  kind:
    | "editor-inventory"
    | "inventory-state"
    | "inventory-wrapper"
    | "slots"
    | "items"
    | "unknown"
    | "empty";
  hasInventory: boolean;
  hasSlots: boolean;
  hasItems: boolean;
  slotCount: number;
  itemCount: number;
}

const DEFAULT_NORMALIZE_OPTIONS: Required<Pick<
  NormalizeEditorInventoryOptions,
  | "hotbarSize"
  | "selectedSlot"
  | "includeEmptySlots"
  | "iconOnly"
  | "allowEmptyFallback"
  | "allowBreakAction"
  | "allowPlaceAction"
  | "source"
  | "sourceDetail"
  | "route"
  | "preserveRaw"
  | "rejectForbiddenDebugItems"
>> = {
  hotbarSize: DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
  selectedSlot: DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
  includeEmptySlots: true,
  iconOnly: false,
  allowEmptyFallback: true,
  allowBreakAction: true,
  allowPlaceAction: true,
  source: DEFAULT_EDITOR_INVENTORY_SOURCE,
  sourceDetail: "normalized",
  route: DEFAULT_EDITOR_INVENTORY_API_URL,
  preserveRaw: true,
  rejectForbiddenDebugItems: true,
};

function nowIsoString(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function mergeRecords<T extends UnknownRecord = UnknownRecord>(base: unknown, override: unknown): T {
  const result: UnknownRecord = {};
  const baseRecord = asRecord(base);
  const overrideRecord = asRecord(override);

  for (const [key, value] of Object.entries(baseRecord)) {
    result[key] = value;
  }

  for (const [key, value] of Object.entries(overrideRecord)) {
    const previous = result[key];

    if (isRecord(previous) && isRecord(value)) {
      result[key] = mergeRecords(previous, value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

function compactRecord(record: UnknownRecord): UnknownRecord {
  const result: UnknownRecord = {};

  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function normalizeOptions(options?: NormalizeEditorInventoryOptions): Required<NormalizeEditorInventoryOptions> {
  const hotbarSize = asInteger(
    options?.hotbarSize,
    DEFAULT_NORMALIZE_OPTIONS.hotbarSize,
    1,
    64,
  );

  return {
    hotbarSize,
    selectedSlot: asInteger(
      options?.selectedSlot,
      DEFAULT_NORMALIZE_OPTIONS.selectedSlot,
      0,
      Math.max(0, hotbarSize - 1),
    ),
    includeEmptySlots: asBoolean(
      options?.includeEmptySlots,
      DEFAULT_NORMALIZE_OPTIONS.includeEmptySlots,
    ),
    iconOnly: asBoolean(options?.iconOnly, DEFAULT_NORMALIZE_OPTIONS.iconOnly),
    allowEmptyFallback: asBoolean(
      options?.allowEmptyFallback,
      DEFAULT_NORMALIZE_OPTIONS.allowEmptyFallback,
    ),
    allowBreakAction: asBoolean(
      options?.allowBreakAction,
      DEFAULT_NORMALIZE_OPTIONS.allowBreakAction,
    ),
    allowPlaceAction: asBoolean(
      options?.allowPlaceAction,
      DEFAULT_NORMALIZE_OPTIONS.allowPlaceAction,
    ),
    source: asString(options?.source, DEFAULT_NORMALIZE_OPTIONS.source),
    sourceDetail: asString(options?.sourceDetail, DEFAULT_NORMALIZE_OPTIONS.sourceDetail),
    route: asString(options?.route, DEFAULT_NORMALIZE_OPTIONS.route),
    generatedAtUtc: asString(options?.generatedAtUtc, nowIsoString()),
    preserveRaw: asBoolean(options?.preserveRaw, DEFAULT_NORMALIZE_OPTIONS.preserveRaw),
    rejectForbiddenDebugItems: asBoolean(
      options?.rejectForbiddenDebugItems,
      DEFAULT_NORMALIZE_OPTIONS.rejectForbiddenDebugItems,
    ),
  };
}

function readClassification(source: unknown): EditorInventoryClassification {
  const record = asRecord(source);
  const classification = asRecord(record.classification);

  const domain = asOptionalString(
    classification.domain ??
      record.domain ??
      readAny(record, ["domainId", "domain_id"]),
  );
  const category = asOptionalString(
    classification.category ??
      record.category ??
      readAny(record, ["categoryId", "category_id"]),
  );
  const subcategory = asOptionalString(
    classification.subcategory ??
      record.subcategory ??
      record.subCategory ??
      readAny(record, ["subcategoryId", "subcategory_id", "sub_category"]),
  );

  const parts = [domain, category, subcategory].filter(Boolean);

  return compactRecord({
    domain,
    category,
    subcategory,
    path: asOptionalString(classification.path) ?? (parts.length ? parts.join("/") : null),
    label: asOptionalString(classification.label ?? classification.name),
    raw: classification,
  }) as EditorInventoryClassification;
}

function readAssets(source: unknown): EditorInventoryAssetRefs {
  const record = asRecord(source);
  const assets = mergeRecords(
    record.assets,
    record.assetRefs ?? record.asset_refs,
  );

  const icon = asRecord(record.icon);
  const preview = asRecord(record.preview);
  const thumbnail = asRecord(record.thumbnail);

  return compactRecord({
    iconUrl: asOptionalString(
      record.iconUrl ??
        record.icon_url ??
        assets.iconUrl ??
        assets.icon_url ??
        icon.url ??
        icon.path,
    ),
    previewUrl: asOptionalString(
      record.previewUrl ??
        record.preview_url ??
        assets.previewUrl ??
        assets.preview_url ??
        preview.url ??
        preview.path,
    ),
    thumbnailUrl: asOptionalString(
      record.thumbnailUrl ??
        record.thumbnail_url ??
        assets.thumbnailUrl ??
        assets.thumbnail_url ??
        thumbnail.url ??
        thumbnail.path,
    ),
    modelUrl: asOptionalString(
      record.modelUrl ??
        record.model_url ??
        assets.modelUrl ??
        assets.model_url,
    ),
    modelKind: asOptionalString(
      record.modelKind ??
        record.model_kind ??
        assets.modelKind ??
        assets.model_kind,
    ),
    items: asArray<UnknownRecord>(assets.items ?? assets.assets),
    raw: assets,
  }) as EditorInventoryAssetRefs;
}

function makeIconKey(value: unknown): string {
  const raw = asString(value, "library-item").toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9._:/ -]+/g, "")
    .replace(/[._:/ ]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized ? `vplib-${normalized}` : "vplib-library-item";
}

function readUnknownArrayLength(value: unknown): number {
  try {
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

function errorFromUnknown(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }

  if (isRecord(value)) {
    return new Error(asString(value.message ?? value.reason ?? value.detail, fallbackMessage));
  }

  return new Error(asString(value, fallbackMessage));
}

export function detectInventoryPayloadShape(input: unknown): InventoryPayloadShapeDetection {
  if (!input) {
    return {
      kind: "empty",
      hasInventory: false,
      hasSlots: false,
      hasItems: false,
      slotCount: 0,
      itemCount: 0,
    };
  }

  if (Array.isArray(input)) {
    const slots = input.filter((item) => isRecord(item) && ("slotIndex" in item || "slot_index" in item || "empty" in item));
    const items = input.filter((item) => isRecord(item) && (getFamilyId(item) || getVplibUid(item) || getItemId(item)));

    return {
      kind: slots.length ? "slots" : items.length ? "items" : "unknown",
      hasInventory: false,
      hasSlots: slots.length > 0,
      hasItems: items.length > 0,
      slotCount: slots.length,
      itemCount: items.length,
    };
  }

  const record = asRecord(input);
  const inventory = asRecord(record.inventory);
  const source = Object.keys(inventory).length ? inventory : record;
  const slots = asArray(source.slots);
  const items = asArray(source.items ?? source.blocks);

  let kind: InventoryPayloadShapeDetection["kind"] = "unknown";
  if (asString(record.kind, "") === DEFAULT_EDITOR_INVENTORY_KIND || isEditorInventoryPayload(record)) {
    kind = "editor-inventory";
  } else if (Object.keys(inventory).length > 0) {
    kind = "inventory-wrapper";
  } else if (slots.length > 0) {
    kind = "slots";
  } else if (items.length > 0) {
    kind = "items";
  }

  return {
    kind,
    hasInventory: Object.keys(inventory).length > 0,
    hasSlots: slots.length > 0,
    hasItems: items.length > 0,
    slotCount: readUnknownArrayLength(slots),
    itemCount: readUnknownArrayLength(items),
  };
}

export function normalizeInventoryIcon(
  input: unknown,
  fallbackKey?: string | null,
): EditorInventoryIcon {
  const record = asRecord(input);
  const key = asString(
    record.key ??
      record.iconKey ??
      record.icon_key ??
      fallbackKey,
    fallbackKey || "vplib-library-item",
  );
  const url = asOptionalString(record.url ?? record.uri ?? record.path);

  return compactRecord({
    key,
    kind: asString(record.kind ?? record.iconKind ?? record.icon_kind, "library-item"),
    url,
    placeholder: asBoolean(record.placeholder, !url),
    cssClass: asString(record.cssClass ?? record.css_class, `editor-hotbar-slot-icon--${key}`),
    ariaHidden: asBoolean(record.ariaHidden ?? record.aria_hidden, false),
    raw: record,
  }) as EditorInventoryIcon;
}

export function normalizeLibraryRef(input: unknown): EditorInventoryLibraryRef | null {
  const record = asRecord(input);

  const existing = record.libraryRef ?? record.library_ref;
  if (isRecord(existing)) {
    return normalizeLibraryRef(existing);
  }

  const familyId = getFamilyId(record);
  const vplibUid = getVplibUid(record);
  const libraryItemId = getItemId(record);
  const variantId = getVariantId(record);

  if (!familyId && !vplibUid && !libraryItemId) {
    return null;
  }

  const ref: EditorInventoryLibraryRef = compactRecord({
    source: asString(record.source, "vectoplan-library") === "library"
      ? "vectoplan-library"
      : asString(record.source, "vectoplan-library"),
    kind: "vplib",
    libraryItemId,
    familyId,
    packageId: getPackageId(record),
    vplibUid,
    variantId,
    revisionHash: getRevisionHash(record),
    objectKind: asOptionalString(record.objectKind ?? record.object_kind ?? record.type),
    domain: asOptionalString(record.domain),
    category: asOptionalString(record.category),
    subcategory: asOptionalString(record.subcategory ?? record.subCategory),
    sourcePath: asOptionalString(record.sourcePath ?? record.source_path),
    stableKey: vplibUid
      ? `vplib:${vplibUid}:${variantId}`
      : familyId
        ? `family:${familyId}:${variantId}`
        : libraryItemId
          ? `item:${libraryItemId}:${variantId}`
          : null,
    valid: Boolean(familyId || vplibUid || libraryItemId),
    raw: record,
  }) as EditorInventoryLibraryRef;

  return ref;
}

export function normalizePlacementCommand(input: unknown): EditorInventoryPlacementCommand | null {
  const record = asRecord(input);

  const existing = record.placementCommand ?? record.placement_command;
  if (isRecord(existing)) {
    const nestedRuntimeBlockTypeId = getRuntimeBlockTypeId(existing);
    const nestedLibraryRef = normalizeLibraryRef(existing.libraryRef ?? existing.library_ref ?? record);

    if (!nestedRuntimeBlockTypeId || isForbiddenDebugBlockTypeId(nestedRuntimeBlockTypeId)) {
      return null;
    }

    if (!nestedLibraryRef?.valid) {
      return null;
    }

    return compactRecord({
      ...existing,
      kind: asString(existing.kind, "PlaceLibraryItem"),
      source: asString(existing.source, "vectoplan-library"),
      runtimeBlockTypeId: nestedRuntimeBlockTypeId,
      blockTypeId: getBlockTypeId(existing) ?? nestedRuntimeBlockTypeId,
      libraryRef: nestedLibraryRef,
      placeable: true,
    }) as EditorInventoryPlacementCommand;
  }

  const runtimeBlockTypeId = getRuntimeBlockTypeId(record);
  const libraryRef = normalizeLibraryRef(record);

  if (!runtimeBlockTypeId || isForbiddenDebugBlockTypeId(runtimeBlockTypeId)) {
    return null;
  }

  if (!libraryRef?.valid) {
    return null;
  }

  return {
    kind: "PlaceLibraryItem",
    source: "vectoplan-library",
    runtimeBlockTypeId,
    blockTypeId: runtimeBlockTypeId,
    libraryRef,
    payload: compactRecord({
      familyId: libraryRef.familyId,
      packageId: libraryRef.packageId,
      vplibUid: libraryRef.vplibUid,
      variantId: libraryRef.variantId,
      revisionHash: libraryRef.revisionHash,
      objectKind: libraryRef.objectKind,
    }),
    placeable: true,
  };
}

export function normalizeEditorInventoryItem(
  input: unknown,
  options?: NormalizeEditorInventoryItemOptions,
): EditorInventoryItem | null {
  const record = asRecord(input);
  if (!Object.keys(record).length) {
    return null;
  }

  const libraryRef = normalizeLibraryRef(record);
  const runtimeBlockTypeId = getRuntimeBlockTypeId(record);
  const itemKind = asString(
    record.itemKind ?? record.item_kind ?? record.kind,
    libraryRef ? DEFAULT_EDITOR_INVENTORY_ITEM_KIND : DEFAULT_EDITOR_EMPTY_ITEM_KIND,
  ) as EditorInventoryItemKind;

  if (!libraryRef && itemKind !== DEFAULT_EDITOR_EMPTY_ITEM_KIND) {
    return null;
  }

  if (runtimeBlockTypeId && isForbiddenDebugBlockTypeId(runtimeBlockTypeId)) {
    return null;
  }

  const classification = readClassification(record);
  const assets = readAssets(record);
  const label = asString(record.label ?? record.name ?? record.title ?? libraryRef?.familyId ?? libraryRef?.vplibUid, "VPLIB Item");
  const iconKey = asString(record.iconKey ?? record.icon_key, makeIconKey(libraryRef?.familyId ?? libraryRef?.vplibUid ?? label));
  const iconUrl = asOptionalString(record.iconUrl ?? record.icon_url ?? assets.iconUrl ?? assets.previewUrl ?? assets.thumbnailUrl);
  const icon = normalizeInventoryIcon(record.icon, iconKey);

  const item: EditorInventoryItem = compactRecord({
    itemId: getItemId(record) ?? options?.fallbackItemId ?? libraryRef?.libraryItemId ?? libraryRef?.familyId ?? libraryRef?.vplibUid,
    itemKind,
    kind: itemKind,
    type: asOptionalString(record.type ?? record.objectKind ?? record.object_kind),
    source: asString(record.source, libraryRef ? "library" : "empty"),
    label,
    displayLabel: asString(record.displayLabel ?? record.display_label, label),
    visibleLabel: asBoolean(record.visibleLabel ?? record.visible_label, !options?.iconOnly),
    description: asOptionalString(record.description),
    blockTypeId: runtimeBlockTypeId,
    runtimeBlockTypeId,
    familyId: libraryRef?.familyId ?? null,
    packageId: libraryRef?.packageId ?? null,
    vplibUid: libraryRef?.vplibUid ?? null,
    variantId: libraryRef?.variantId ?? "default",
    revisionHash: libraryRef?.revisionHash ?? null,
    objectKind: libraryRef?.objectKind ?? asOptionalString(record.objectKind ?? record.object_kind),
    domain: libraryRef?.domain ?? classification.domain ?? null,
    category: libraryRef?.category ?? classification.category ?? null,
    subcategory: libraryRef?.subcategory ?? classification.subcategory ?? null,
    classification,
    iconKey,
    iconKind: icon.kind,
    iconUrl,
    icon: {
      ...icon,
      url: icon.url ?? iconUrl,
      placeholder: asBoolean(icon.placeholder, !iconUrl),
    },
    placeable: Boolean(runtimeBlockTypeId && libraryRef?.valid),
    breakable: asBoolean(record.breakable, false),
    libraryRef,
    placementCommand: normalizePlacementCommand(record),
    assets,
    metadata: asRecord(record.metadata),
    raw: options?.preserveRaw === false ? undefined : record,
    extra: asRecord(record.extra),
    stableKey: libraryRef?.stableKey,
  }) as EditorInventoryItem;

  if (!item.placeable && itemKind !== DEFAULT_EDITOR_EMPTY_ITEM_KIND) {
    return null;
  }

  return item;
}

export function buildEmptyInventorySlot(
  slotIndex: number,
  selectedSlot = DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
): EditorInventorySlot {
  const safeIndex = asInteger(slotIndex, 0, 0, 63);

  return {
    slotIndex: safeIndex,
    slotKey: `hotbar-${safeIndex}`,
    empty: true,
    enabled: true,
    selected: safeIndex === selectedSlot,
    source: "empty",
    sourceKind: "empty",
    itemId: null,
    itemKind: "empty",
    kind: "empty",
    type: "empty",
    blockTypeId: null,
    runtimeBlockTypeId: null,
    placeable: false,
    breakable: false,
    iconKey: null,
    iconKind: "empty",
    iconUrl: null,
    icon: null,
    label: "",
    displayLabel: "",
    visibleLabel: false,
    ariaLabel: `Inventar-Slot ${safeIndex + 1}: leer`,
    title: "",
    stackSize: 0,
    maxStackSize: 0,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    domain: null,
    category: null,
    subcategory: null,
    libraryRef: null,
    placementCommand: null,
    metadata: {},
  };
}

export function normalizeEditorInventorySlot(
  input: unknown,
  options?: NormalizeEditorInventorySlotOptions,
): EditorInventorySlot {
  const normalizedOptions = normalizeOptions(options);
  const record = asRecord(input);
  const slotIndex = asInteger(
    options?.slotIndex ?? readAny(record, ["slotIndex", "slot_index", "index", "slot"]),
    0,
    0,
    Math.max(0, normalizedOptions.hotbarSize - 1),
  );

  if (!Object.keys(record).length || asBoolean(record.empty, false)) {
    return buildEmptyInventorySlot(slotIndex, normalizedOptions.selectedSlot);
  }

  const item = normalizeEditorInventoryItem(record, {
    ...normalizedOptions,
    fallbackItemId: `slot-${slotIndex}`,
  });

  if (!item || !item.placeable || !isPlaceableLibrarySlot({ ...record, ...item })) {
    return buildEmptyInventorySlot(slotIndex, normalizedOptions.selectedSlot);
  }

  const runtimeBlockTypeId = getRuntimeBlockTypeId(item);
  const libraryRef = item.libraryRef ?? normalizeLibraryRef(item);
  const placementCommand = item.placementCommand ?? normalizePlacementCommand(item);
  const label = asString(record.label ?? item.label, "VPLIB Item");
  const visibleLabel = asBoolean(
    record.visibleLabel ?? record.visible_label,
    !normalizedOptions.iconOnly,
  );

  return compactRecord({
    ...record,
    slotIndex,
    slotKey: asString(record.slotKey ?? record.slot_key, `hotbar-${slotIndex}`),
    empty: false,
    enabled: asBoolean(record.enabled, true),
    selected: slotIndex === normalizedOptions.selectedSlot,
    source: "library",
    sourceKind: "vplib",
    itemId: item.itemId,
    itemKind: "vplib",
    kind: "vplib",
    type: item.objectKind ?? item.type ?? "library_item",
    blockTypeId: runtimeBlockTypeId,
    runtimeBlockTypeId,
    placeable: Boolean(runtimeBlockTypeId && libraryRef?.valid),
    breakable: asBoolean(record.breakable, false),
    iconKey: item.iconKey,
    iconKind: item.iconKind,
    iconUrl: item.iconUrl,
    icon: item.icon,
    label,
    displayLabel: visibleLabel ? label : "",
    visibleLabel,
    ariaLabel: asString(record.ariaLabel ?? record.aria_label, `Inventar-Slot ${slotIndex + 1}: ${label}`),
    title: asString(record.title, label),
    description: item.description,
    stackSize: asInteger(record.stackSize ?? record.stack_size, 1, 0),
    maxStackSize: asInteger(record.maxStackSize ?? record.max_stack_size, 1, 0),
    familyId: item.familyId,
    packageId: item.packageId,
    vplibUid: item.vplibUid,
    variantId: item.variantId,
    revisionHash: item.revisionHash,
    objectKind: item.objectKind,
    domain: item.domain,
    category: item.category,
    subcategory: item.subcategory,
    libraryRef,
    placementCommand,
    assets: item.assets,
    metadata: mergeRecords(record.metadata, {
      source: "vectoplan-library",
      vplib: true,
      runtimeBlockTypeId,
    }),
    raw: normalizedOptions.preserveRaw ? record : undefined,
    extra: asRecord(record.extra),
  }) as EditorInventorySlot;
}

function normalizeSlotList(
  slotsInput: unknown,
  itemsInput: unknown,
  options: Required<NormalizeEditorInventoryOptions>,
): EditorInventorySlot[] {
  const sourceSlots = asArray(slotsInput);
  const sourceItems = asArray(itemsInput);
  const byIndex = new Map<number, EditorInventorySlot>();

  if (sourceSlots.length > 0) {
    sourceSlots.forEach((slot, fallbackIndex) => {
      const rawIndex = readAny(slot, ["slotIndex", "slot_index", "index", "slot"], fallbackIndex);
      const slotIndex = asInteger(rawIndex, fallbackIndex, 0, Math.max(0, options.hotbarSize - 1));
      const normalizedSlot = normalizeEditorInventorySlot(slot, {
        ...options,
        slotIndex,
      });

      byIndex.set(slotIndex, normalizedSlot);
    });
  } else if (sourceItems.length > 0) {
    sourceItems.slice(0, options.hotbarSize).forEach((item, index) => {
      const normalizedSlot = normalizeEditorInventorySlot(item, {
        ...options,
        slotIndex: index,
      });

      byIndex.set(index, normalizedSlot);
    });
  }

  const slots: EditorInventorySlot[] = [];

  for (let index = 0; index < options.hotbarSize; index += 1) {
    slots.push(byIndex.get(index) ?? buildEmptyInventorySlot(index, options.selectedSlot));
  }

  return options.includeEmptySlots ? slots : slots.filter((slot) => !slot.empty);
}

function buildItemsFromSlots(slots: EditorInventorySlot[]): EditorInventoryItem[] {
  const items: EditorInventoryItem[] = [];
  const seen = new Set<string>();

  for (const slot of slots) {
    if (slot.empty || !slot.placeable) {
      continue;
    }

    const item = normalizeEditorInventoryItem(slot, {
      preserveRaw: false,
    });

    if (!item?.itemId || seen.has(item.itemId)) {
      continue;
    }

    seen.add(item.itemId);
    items.push(item);
  }

  return items;
}

export function normalizeEditorInventoryState(
  input: unknown,
  options?: NormalizeEditorInventoryStateOptions,
): EditorInventoryState {
  const shape = detectInventoryPayloadShape(input);
  const record = asRecord(input);
  const inventoryRecord = asRecord(record.inventory);
  const sourceRecord = Object.keys(inventoryRecord).length ? inventoryRecord : record;

  const baseOptions = normalizeOptions({
    ...options,
    hotbarSize: options?.hotbarSize ?? asInteger(readAny(sourceRecord, ["hotbarSize", "hotbar_size"], DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE), DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE, 1, 64),
    selectedSlot:
      options?.selectedSlot ??
      asInteger(
        readAny(
          sourceRecord,
          ["selectedSlot", "selected_slot", "defaultSelectedSlot", "default_selected_slot"],
          DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
        ),
        DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
        0,
        63,
      ),
    source: options?.source ?? asString(sourceRecord.source, DEFAULT_EDITOR_INVENTORY_SOURCE),
    sourceDetail:
      options?.sourceDetail ??
      asString(sourceRecord.sourceDetail ?? sourceRecord.source_detail, shape.kind),
    iconOnly: options?.iconOnly ?? asBoolean(sourceRecord.iconOnly ?? sourceRecord.icon_only, false),
  });

  const rawSlots = asArray(sourceRecord.slots);
  const rawItems = asArray(sourceRecord.items ?? sourceRecord.blocks);
  const slots = normalizeSlotList(rawSlots, rawItems, baseOptions);
  const allSlots = baseOptions.includeEmptySlots ? slots : normalizeSlotList(rawSlots, rawItems, {
    ...baseOptions,
    includeEmptySlots: true,
  });

  const items = buildItemsFromSlots(allSlots);
  const placeableSlots = allSlots.filter(isPlaceableLibrarySlot);
  const selectedSlot = allSlots.find((slot) => slot.slotIndex === baseOptions.selectedSlot) ?? null;
  const selectedItem = selectedSlot ? normalizeEditorInventoryItem(selectedSlot, { preserveRaw: false }) : null;
  const hasPlaceableItems = placeableSlots.length > 0;

  return compactRecord({
    ...sourceRecord,
    enabled: asBoolean(sourceRecord.enabled, true),
    source: asString(sourceRecord.source, baseOptions.source),
    sourceDetail: asString(sourceRecord.sourceDetail ?? sourceRecord.source_detail, baseOptions.sourceDetail ?? "normalized"),
    hotbarSize: baseOptions.hotbarSize,
    defaultSelectedSlot: baseOptions.selectedSlot,
    selectedSlot: baseOptions.selectedSlot,
    scrollWrap: asBoolean(sourceRecord.scrollWrap ?? sourceRecord.scroll_wrap, true),
    allowPlaceAction:
      asBoolean(sourceRecord.allowPlaceAction ?? sourceRecord.allow_place_action, baseOptions.allowPlaceAction) &&
      hasPlaceableItems,
    allowBreakAction: asBoolean(sourceRecord.allowBreakAction ?? sourceRecord.allow_break_action, baseOptions.allowBreakAction),
    iconOnly: baseOptions.iconOnly,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    allowEmptyFallback: baseOptions.allowEmptyFallback,
    items,
    slots,
    emptySlotCount: allSlots.filter((slot) => slot.empty).length,
    filledSlotCount: allSlots.filter((slot) => !slot.empty).length,
    placeableSlotCount: placeableSlots.length,
    hasPlaceableItems,
    selectedItem,
    metadata: mergeRecords(sourceRecord.metadata, {
      normalizedBy: EDITOR_INVENTORY_NORMALIZE_MODULE_NAME,
      normalizedAt: nowIsoString(),
    }),
    raw: baseOptions.preserveRaw ? sourceRecord : undefined,
    extra: asRecord(sourceRecord.extra),
  }) as EditorInventoryState;
}

export function buildEmptyInventoryState(options?: NormalizeEditorInventoryOptions): EditorInventoryState {
  const normalizedOptions = normalizeOptions(options);
  const slots = normalizeSlotList([], [], normalizedOptions);

  return {
    enabled: true,
    source: "fallback",
    sourceDetail: "empty-no-library-items",
    hotbarSize: normalizedOptions.hotbarSize,
    defaultSelectedSlot: normalizedOptions.selectedSlot,
    selectedSlot: normalizedOptions.selectedSlot,
    scrollWrap: true,
    allowPlaceAction: false,
    allowBreakAction: normalizedOptions.allowBreakAction,
    iconOnly: normalizedOptions.iconOnly,
    onlyLibraryItemsPlaceable: true,
    debugGrassDirtAllowed: false,
    allowChunkPlaceableFallback: false,
    allowEmptyFallback: true,
    items: [],
    slots,
    emptySlotCount: slots.length,
    filledSlotCount: 0,
    placeableSlotCount: 0,
    hasPlaceableItems: false,
    selectedItem: null,
    metadata: {
      normalizedBy: EDITOR_INVENTORY_NORMALIZE_MODULE_NAME,
      normalizedAt: nowIsoString(),
    },
  };
}

export function normalizeEditorInventoryCapabilities(input: unknown): EditorInventoryCapabilities {
  const record = asRecord(input);

  return {
    ...record,
    serverDriven: asBoolean(record.serverDriven, true),
    source: asString(record.source, "vectoplan-library"),
    supportsEmptySlots: asBoolean(record.supportsEmptySlots, true),
    supportsLibraryItems: asBoolean(record.supportsLibraryItems, true),
    supportsVplib: asBoolean(record.supportsVplib, true),
    supportsFamilyId: asBoolean(record.supportsFamilyId, true),
    supportsVplibUid: asBoolean(record.supportsVplibUid, true),
    supportsVariantId: asBoolean(record.supportsVariantId, true),
    supportsRuntimeBlockTypeId: asBoolean(record.supportsRuntimeBlockTypeId, true),
    supportsPlacementCommand: asBoolean(record.supportsPlacementCommand, true),
    supportsRemoteAssets: asBoolean(record.supportsRemoteAssets, true),
    supportsChunkDebugFallback: false,
    allowsDebugGrassDirt: false,
  };
}

export function normalizeEditorInventoryFallback(input: unknown, activeFallback = false): EditorInventoryFallback {
  const record = asRecord(input);

  return {
    ...record,
    active: asBoolean(record.active, activeFallback),
    reason: asOptionalString(record.reason),
    sourceError: record.sourceError ?? record.source_error ?? null,
  };
}

export function normalizeEditorInventoryDiagnostics(input: unknown): EditorInventoryDiagnostics {
  const record = asRecord(input);

  return {
    ...record,
    requestMethod: asOptionalString(record.requestMethod ?? record.request_method),
    requestPath: asOptionalString(record.requestPath ?? record.request_path),
    requestId: asOptionalString(record.requestId ?? record.request_id),
    requestArgs: asRecord(record.requestArgs ?? record.request_args),
  };
}

export function normalizeEditorInventoryPayload(
  input: unknown,
  options?: NormalizeEditorInventoryOptions,
): EditorInventoryPayload {
  const normalizedOptions = normalizeOptions(options);
  const record = asRecord(input);

  if (!record || Object.keys(record).length === 0) {
    return buildEmptyInventoryPayload({
      ...normalizedOptions,
      sourceDetail: "empty-input",
    });
  }

  if (
    normalizedOptions.rejectForbiddenDebugItems &&
    inventoryPayloadContainsForbiddenDebugBlockIds(record)
  ) {
    return buildEmptyInventoryPayload({
      ...normalizedOptions,
      sourceDetail: "forbidden-debug-items-detected",
      generatedAtUtc: normalizedOptions.generatedAtUtc,
    });
  }

  const state = normalizeEditorInventoryState(record, normalizedOptions);
  const placeableSlots = getPlaceableInventorySlots(state);
  const ok = asBoolean(record.ok, placeableSlots.length > 0) && placeableSlots.length > 0;

  return compactRecord({
    ...record,
    ok,
    kind: asString(record.kind, DEFAULT_EDITOR_INVENTORY_KIND),
    schemaVersion: asString(
      record.schemaVersion ?? record.schema_version,
      DEFAULT_EDITOR_INVENTORY_SCHEMA_VERSION,
    ),
    source: asString(record.source, state.source),
    sourceDetail: asString(record.sourceDetail ?? record.source_detail, state.sourceDetail ?? normalizedOptions.sourceDetail),
    generatedAtUtc: asString(record.generatedAtUtc ?? record.generated_at_utc, normalizedOptions.generatedAtUtc),
    route: asString(record.route, normalizedOptions.route),
    inventory: state,
    capabilities: normalizeEditorInventoryCapabilities(record.capabilities),
    fallback: normalizeEditorInventoryFallback(record.fallback, !ok),
    diagnostics: normalizeEditorInventoryDiagnostics(record.diagnostics),
    error: isRecord(record.error) ? (record.error as EditorInventoryErrorPayload) : undefined,
    metadata: mergeRecords(record.metadata, {
      normalizedBy: EDITOR_INVENTORY_NORMALIZE_MODULE_NAME,
      normalizedAt: nowIsoString(),
    }),
    raw: normalizedOptions.preserveRaw ? record : undefined,
    extra: asRecord(record.extra),
  }) as EditorInventoryPayload;
}

export function buildEmptyInventoryPayload(options?: NormalizeEditorInventoryOptions): EditorInventoryPayload {
  const normalizedOptions = normalizeOptions(options);
  const inventory = buildEmptyInventoryState(normalizedOptions);

  return {
    ok: false,
    kind: DEFAULT_EDITOR_INVENTORY_KIND,
    schemaVersion: DEFAULT_EDITOR_INVENTORY_SCHEMA_VERSION,
    source: "fallback",
    sourceDetail: normalizedOptions.sourceDetail || "empty-no-library-items",
    generatedAtUtc: normalizedOptions.generatedAtUtc,
    route: normalizedOptions.route,
    inventory,
    capabilities: normalizeEditorInventoryCapabilities({
      source: "fallback",
      supportsLibraryItems: false,
      supportsVplib: false,
    }),
    fallback: {
      active: true,
      reason: normalizedOptions.sourceDetail || "empty-no-library-items",
    },
    diagnostics: {
      normalizer: {
        moduleName: EDITOR_INVENTORY_NORMALIZE_MODULE_NAME,
        moduleVersion: EDITOR_INVENTORY_NORMALIZE_MODULE_VERSION,
      },
    },
    metadata: {
      normalizedBy: EDITOR_INVENTORY_NORMALIZE_MODULE_NAME,
      normalizedAt: nowIsoString(),
    },
  };
}

export function normalizeEditorInventoryLoadSuccess(
  input: unknown,
  options?: NormalizeEditorInventoryOptions,
): EditorInventoryLoadSuccess {
  const payload = normalizeEditorInventoryPayload(input, options);
  const state = payload.inventory;
  const selectedSlot = getSelectedInventorySlotFromState(state);
  const selectedItem = selectedSlot ? normalizeEditorInventoryItem(selectedSlot, { preserveRaw: false }) : null;
  const placeableSlots = getPlaceableInventorySlots(state);

  return {
    ok: true,
    state,
    payload,
    selectedSlot,
    selectedItem,
    placeableSlots,
    fetchedAt: Date.now(),
    fromCache: false,
    error: null,
    reason: null,
  };
}

export function normalizeEditorInventoryLoadFailure(
  error: unknown,
  payload?: unknown,
  options?: NormalizeEditorInventoryOptions,
): EditorInventoryLoadFailure {
  const normalizedError = errorFromUnknown(error, "Inventory konnte nicht geladen werden.");
  const normalizedPayload = payload ? normalizeEditorInventoryPayload(payload, options) : null;

  return {
    ok: false,
    state: normalizedPayload?.inventory ?? buildEmptyInventoryState(options),
    payload: normalizedPayload,
    error: normalizedError,
    reason: normalizedError.message || "inventory-load-error",
    fetchedAt: Date.now(),
    fromCache: false,
    selectedSlot: null,
    selectedItem: null,
    placeableSlots: [],
  };
}

export function normalizeEditorInventoryLoadResult(
  input: unknown,
  error?: unknown,
  options?: NormalizeEditorInventoryOptions,
): EditorInventoryLoadResult {
  if (error) {
    return normalizeEditorInventoryLoadFailure(error, input, options);
  }

  const payload = normalizeEditorInventoryPayload(input, options);

  if (!payload.ok) {
    return normalizeEditorInventoryLoadFailure(
      asString(payload.fallback?.reason ?? payload.error?.message ?? payload.error?.reason, "inventory-not-ok"),
      payload,
      options,
    );
  }

  return normalizeEditorInventoryLoadSuccess(payload, options);
}

export function getSelectedInventorySlotFromState(state: EditorInventoryState): EditorInventorySlot | null {
  const selectedIndex = asInteger(
    state.selectedSlot ?? state.defaultSelectedSlot,
    DEFAULT_EDITOR_INVENTORY_SELECTED_SLOT,
    0,
    Math.max(0, state.hotbarSize - 1),
  );

  return state.slots.find((slot) => slot.slotIndex === selectedIndex) ?? null;
}

export function getRuntimeSelectionFromInventoryState(state: EditorInventoryState): EditorInventoryRuntimeSelection {
  const slot = getSelectedInventorySlotFromState(state);
  const item = slot ? normalizeEditorInventoryItem(slot, { preserveRaw: false }) : null;
  const libraryRef = slot ? getLibraryRef(slot) : null;
  const placementCommand = slot ? getPlacementCommand(slot) : null;
  const runtimeBlockTypeId = slot ? getRuntimeBlockTypeId(slot) : null;
  const blockTypeId = slot ? getBlockTypeId(slot) : null;

  return {
    slotIndex: state.selectedSlot,
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

export function sanitizeEditorInventoryPayload(input: unknown): EditorInventoryPayload {
  const payload = normalizeEditorInventoryPayload(input, {
    rejectForbiddenDebugItems: true,
  });

  if (inventoryPayloadContainsForbiddenDebugBlockIds(payload)) {
    return buildEmptyInventoryPayload({
      sourceDetail: "forbidden-debug-items-detected-after-normalize",
    });
  }

  return payload;
}

export function assertEditorInventoryPayload(input: unknown): EditorInventoryPayload {
  const payload = normalizeEditorInventoryPayload(input);

  if (!payload.ok) {
    throw new Error(asString(payload.fallback?.reason ?? payload.error?.message ?? payload.error?.reason, "Inventory-Payload ist nicht erfolgreich."));
  }

  if (inventoryPayloadContainsForbiddenDebugBlockIds(payload)) {
    throw new Error("Inventory-Payload enthält verbotene Debug-Block-IDs.");
  }

  return payload;
}

export function getEditorInventoryNormalizeMetadata(): UnknownRecord {
  return {
    moduleName: EDITOR_INVENTORY_NORMALIZE_MODULE_NAME,
    moduleVersion: EDITOR_INVENTORY_NORMALIZE_MODULE_VERSION,
    modelsModuleVersion: EDITOR_INVENTORY_MODELS_MODULE_VERSION,
    defaultInventoryApiUrl: DEFAULT_EDITOR_INVENTORY_API_URL,
    defaultInventoryKind: DEFAULT_EDITOR_INVENTORY_KIND,
    defaultSchemaVersion: DEFAULT_EDITOR_INVENTORY_SCHEMA_VERSION,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      browserUsesEditorInventoryApi: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      emptyFallbackAllowsPlace: false,
      runtimeBlockTypeIdIsTemporaryAdapter: true,
      getPlaceableInventorySlotsImported: true,
      unknownValuesNormalizedBeforeNumberAssignment: true,
      loadResultHasCommonErrorAndReasonFields: true,
    },
  };
}