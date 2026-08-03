// services/vectoplan-editor/src/frontend/inventory/inventory_models.ts
import type {
  ChunkApiBlockDefinition,
  ChunkApiBlockMetadata,
  ChunkApiBlocksResult,
  ChunkApiPlaceableBlockDefinition,
} from "@api/chunk_api_models";
import {
  CHUNK_API_DEFAULT_REGISTRY_ID,
  CHUNK_API_DEFAULT_REGISTRY_VERSION,
} from "@api/chunk_api_models";

import type {
  EditorInventoryItem,
  EditorInventoryLibraryRef,
  EditorInventoryPayload,
  EditorInventoryPlacementCommand,
  EditorInventorySlot,
  EditorInventoryState,
} from "@api/editor_inventory_models";

import {
  ALLOW_CHUNK_PLACEABLE_FALLBACK,
  DEBUG_GRASS_DIRT_ALLOWED,
  DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
  DEFAULT_EDITOR_INVENTORY_SLOT_COUNT,
  EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
  ONLY_LIBRARY_ITEMS_PLACEABLE,
  PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
  asEditorInventoryContractRecord,
  containsForbiddenDebugBlockTypeId,
  editorInventoryContractRules,
  getEditorInventoryContractMetadata,
  isForbiddenDebugBlockTypeId as contractIsForbiddenDebugBlockTypeId,
  isLibraryInventorySourceKind,
  isLegacyInventorySourceKind,
  normalizeEditorInventoryLibraryRef,
  normalizeEditorInventoryPlacementCommand,
  normalizeInventoryItemKind,
  normalizeInventorySourceKind,
  normalizeOptionalContractText,
  normalizeRuntimeBlockTypeId,
  type EditorInventoryContractItemKind,
  type EditorInventoryContractLoadStatus,
  type EditorInventoryContractSourceKind,
} from "../contracts/editor_inventory_contract";

export type InventorySourceKind = EditorInventoryContractSourceKind;

export type InventoryLoadStatus = EditorInventoryContractLoadStatus;

export type InventoryItemKind = EditorInventoryContractItemKind;

export type InventorySlotStatus =
  | "empty"
  | "available"
  | "selected"
  | "disabled";

export type InventoryPlacementRefKind =
  | "vplib"
  | "library-item"
  | "block"
  | "asset"
  | "empty"
  | "unknown";

export interface InventoryColor {
  readonly css: string;
  readonly source: "metadata" | "role" | "fallback" | "generated" | "library";
}

export interface InventoryIcon {
  readonly kind: "text" | "color" | "asset-url" | "library" | "none";
  readonly value: string | null;
}

export interface InventoryPlacementRef {
  readonly kind: InventoryPlacementRefKind;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly assetTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
}

export interface InventoryLibraryItem {
  readonly kind: "library-item";
  readonly slot: number;
  readonly id: string;
  readonly itemKind: "vplib";
  readonly blockTypeId: string;
  readonly runtimeBlockTypeId: string;
  readonly assetTypeId: null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly label: string;
  readonly shortLabel: string;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
  readonly category: string | null;
  readonly role: string | null;
  readonly color: InventoryColor | null;
  readonly icon: InventoryIcon;
  readonly placementRef: InventoryPlacementRef;
  readonly sourceKind: InventorySourceKind;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly rawSlot: EditorInventorySlot;
  readonly rawItem: EditorInventoryItem | null;
}

export interface InventoryBlockItem {
  readonly kind: "block";
  readonly slot: number;
  readonly id: string;
  readonly blockTypeId: string;
  readonly runtimeBlockTypeId: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly cellValue: number;
  readonly paletteIndex: number | null;
  readonly solid: boolean;
  readonly placeable: boolean;
  readonly breakable: boolean;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
  readonly category: string | null;
  readonly role: string | null;
  readonly color: InventoryColor | null;
  readonly icon: InventoryIcon;
  readonly placementRef: InventoryPlacementRef;
  readonly sourceKind: InventorySourceKind;
  readonly rawBlock: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition;
}

export interface InventoryAssetItem {
  readonly kind: "asset";
  readonly slot: number;
  readonly id: string;
  readonly blockTypeId: null;
  readonly runtimeBlockTypeId: string | null;
  readonly assetTypeId: string;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly label: string;
  readonly shortLabel: string;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
  readonly category: string | null;
  readonly role: string | null;
  readonly color: InventoryColor | null;
  readonly icon: InventoryIcon;
  readonly placementRef: InventoryPlacementRef;
  readonly sourceKind: InventorySourceKind;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
  readonly rawItem: unknown;
}

export interface InventoryEmptyItem {
  readonly kind: "empty";
  readonly slot: number;
  readonly id: string;
  readonly blockTypeId: null;
  readonly runtimeBlockTypeId: null;
  readonly label: string;
  readonly shortLabel: string;
  readonly enabled: false;
  readonly disabledReason: string;
  readonly color: null;
  readonly icon: InventoryIcon;
  readonly placementRef: InventoryPlacementRef;
}

export type InventoryItem =
  | InventoryLibraryItem
  | InventoryBlockItem
  | InventoryAssetItem
  | InventoryEmptyItem;

export interface HotbarSlot {
  readonly slot: number;
  readonly index: number;
  readonly status: InventorySlotStatus;
  readonly selected: boolean;
  readonly item: InventoryItem;
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly assetTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly color: string | null;
  readonly icon: InventoryIcon;
  readonly keyBinding: string;
  readonly enabled: boolean;
  readonly sourceKind: InventorySourceKind;
  readonly placementRef: InventoryPlacementRef | null;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly placementCommand: EditorInventoryPlacementCommand | null;
}

export interface InventorySelection {
  readonly selectedSlot: number;
  readonly selectedSlotIndex: number;
  readonly selectedItem: InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem | null;
  readonly selectedLibraryItem: InventoryLibraryItem | null;
  readonly selectedBlockItem: InventoryBlockItem | null;
  readonly selectedAssetItem: InventoryAssetItem | null;
  readonly selectedBlockTypeId: string | null;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedCellValue: number | null;
  readonly selectedPlacementRef: InventoryPlacementRef | null;
  readonly selectedLibraryRef: EditorInventoryLibraryRef | null;
  readonly selectedPlacementCommand: EditorInventoryPlacementCommand | null;
}

export interface InventoryCatalog {
  readonly sourceKind: InventorySourceKind;
  readonly status: InventoryLoadStatus;
  readonly projectId: string;
  readonly worldId: string;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly slotCount: number;
  readonly items: readonly InventoryItem[];
  readonly libraryItems: readonly InventoryLibraryItem[];
  readonly blockItems: readonly InventoryBlockItem[];
  readonly assetItems: readonly InventoryAssetItem[];
  readonly placeableItems: readonly (InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem)[];
  readonly hotbarSlots: readonly HotbarSlot[];
  readonly selection: InventorySelection;
  readonly blockTypeIds: readonly string[];
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly usedPaletteFallback: boolean;
  readonly loadedAt: string | null;
  readonly errorMessage: string | null;
  readonly rawResult: ChunkApiBlocksResult | EditorInventoryPayload | EditorInventoryState | null;
}

export interface CreateInventoryCatalogOptions {
  readonly result: ChunkApiBlocksResult;
  readonly slotCount?: number;
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
  readonly defaultBlockTypeId?: string | null;
  readonly allowDisabledBlocks?: boolean;
  readonly allowChunkBlocks?: boolean;
}

export interface CreateLibraryInventoryCatalogOptions {
  readonly payload?: EditorInventoryPayload | null;
  readonly state?: EditorInventoryState | null;
  readonly projectId?: string;
  readonly worldId?: string;
  readonly slotCount?: number;
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
  readonly allowEmptyFallback?: boolean;
  readonly reason?: string | null;
}

export interface CreateFallbackInventoryCatalogOptions {
  readonly projectId?: string;
  readonly worldId?: string;
  readonly slotCount?: number;
  readonly selectedSlot?: number;
  readonly selectedSlotIndex?: number;
  readonly reason?: string | null;
}

export interface InventorySelectionOptions {
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

export interface InventoryDebugSummary {
  readonly status: InventoryLoadStatus;
  readonly sourceKind: InventorySourceKind;
  readonly projectId: string;
  readonly worldId: string;
  readonly registryId: string;
  readonly registryVersion: string;
  readonly slotCount: number;
  readonly itemCount: number;
  readonly libraryItemCount: number;
  readonly blockItemCount: number;
  readonly assetItemCount: number;
  readonly placeableItemCount: number;
  readonly selectedSlot: number;
  readonly selectedSlotIndex: number;
  readonly selectedBlockTypeId: string | null;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedPlacementKind: InventoryPlacementRef["kind"] | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedPackageId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedVariantId: string | null;
  readonly selectedRevisionHash: string | null;
  readonly selectedObjectKind: string | null;
  readonly blockTypeIds: readonly string[];
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly usedPaletteFallback: boolean;
  readonly loadedAt: string | null;
  readonly errorMessage: string | null;
}

export const DEFAULT_HOTBAR_SLOT_COUNT: number = DEFAULT_EDITOR_INVENTORY_SLOT_COUNT;

export const DEFAULT_PLACEABLE_BLOCK_TYPE_ID = "" as const;

export const FALLBACK_BLOCK_COLORS: Readonly<Record<string, string>> = {};

export const ROLE_BLOCK_COLORS: Readonly<Record<string, string>> = {
  surface: "#4caf50",
  subsurface: "#795548",
  structure: "#94a3b8",
  marker: "#38bdf8",
  terrain: "#84cc16",
  object: "#38bdf8",
  warning: "#f97316",
  library: "#a78bfa",
  vplib: "#a78bfa",
};

export const LIBRARY_ITEM_COLOR: InventoryColor = {
  css: "#a78bfa",
  source: "library",
};

const MAX_INVENTORY_MODEL_CACHE_ENTRIES = 512;

const TEXT_CACHE = new Map<string, string>();
const NULLABLE_TEXT_CACHE = new Map<string, string | null>();
const IDENTIFIER_CACHE = new Map<string, string>();
const CSS_COLOR_CACHE = new Map<string, string | null>();
const SHORT_LABEL_CACHE = new Map<string, string>();
const GENERATED_COLOR_CACHE = new Map<string, string>();

function setCachedValue<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
): V {
  try {
    if (cache.size > MAX_INVENTORY_MODEL_CACHE_ENTRIES) {
      cache.clear();
    }

    cache.set(key, value);
  } catch {
    // Cache is best-effort.
  }

  return value;
}

export function clearInventoryModelCaches(): void {
  try {
    TEXT_CACHE.clear();
    NULLABLE_TEXT_CACHE.clear();
    IDENTIFIER_CACHE.clear();
    CSS_COLOR_CACHE.clear();
    SHORT_LABEL_CACHE.clear();
    GENERATED_COLOR_CACHE.clear();
  } catch {
    // Cache clearing must never break runtime.
  }
}

function nowIsoStringSafe(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function safeString(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "string") {
      const cached = TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached || fallback;
      }

      const trimmed = value.trim();
      return setCachedValue(TEXT_CACHE, value, trimmed.length > 0 ? trimmed : fallback);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const converted = String(value).trim();
      return converted.length > 0 ? converted : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function safeNullableString(value: unknown, fallback: string | null = null): string | null {
  try {
    if (value === null || value === undefined) {
      return fallback;
    }

    if (typeof value === "string") {
      const cached = NULLABLE_TEXT_CACHE.get(value);

      if (cached !== undefined) {
        return cached ?? fallback;
      }

      const trimmed = value.trim();
      return setCachedValue(NULLABLE_TEXT_CACHE, value, trimmed.length > 0 ? trimmed : fallback);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const converted = String(value).trim();
      return converted.length > 0 ? converted : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(value: unknown, fallback: number): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;

    return Number.isFinite(numeric) ? numeric : fallback;
  } catch {
    return fallback;
  }
}

function safeInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    const numeric = Math.trunc(safeNumber(value, fallback));

    return Math.min(max, Math.max(min, numeric));
  } catch {
    return fallback;
  }
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
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

function asRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeSlotCount(value: unknown): number {
  return safeInteger(value, DEFAULT_HOTBAR_SLOT_COUNT, 1, 64);
}

function normalizeSlot(value: unknown, slotCount: number): number {
  return safeInteger(value, 0, 0, Math.max(0, slotCount - 1));
}

function normalizeIdentifier(value: unknown, fallback: string): string {
  try {
    const raw = safeString(value, fallback);
    const cacheKey = `${raw}|${fallback}`;
    const cached = IDENTIFIER_CACHE.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const normalized = raw
      .replace(/[^a-zA-Z0-9_.:-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return setCachedValue(IDENTIFIER_CACHE, cacheKey, normalized.length > 0 ? normalized : fallback);
  } catch {
    return fallback;
  }
}

function normalizeBlockTypeId(value: unknown, fallback: string): string {
  const normalized = normalizeIdentifier(value, fallback);

  if (isForbiddenDebugBlockTypeId(normalized)) {
    return "";
  }

  return normalized;
}

function metadataValue(metadata: ChunkApiBlockMetadata | undefined, key: string): unknown {
  try {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    return (metadata as Record<string, unknown>)[key];
  } catch {
    return null;
  }
}

function metadataString(metadata: ChunkApiBlockMetadata | undefined, key: string): string | null {
  try {
    return safeNullableString(metadataValue(metadata, key), null);
  } catch {
    return null;
  }
}

function normalizeCssColor(value: unknown): string | null {
  try {
    if (typeof value !== "string") {
      return null;
    }

    const cached = CSS_COLOR_CACHE.get(value);

    if (cached !== undefined) {
      return cached;
    }

    const trimmed = value.trim();

    if (
      /^#[0-9a-fA-F]{3}$/.test(trimmed)
      || /^#[0-9a-fA-F]{6}$/.test(trimmed)
      || /^#[0-9a-fA-F]{8}$/.test(trimmed)
      || /^rgba?\(/i.test(trimmed)
      || /^hsla?\(/i.test(trimmed)
    ) {
      return setCachedValue(CSS_COLOR_CACHE, value, trimmed);
    }

    return setCachedValue(CSS_COLOR_CACHE, value, null);
  } catch {
    return null;
  }
}

function generatedColorFromString(value: string): string {
  try {
    const cached = GENERATED_COLOR_CACHE.get(value);

    if (cached !== undefined) {
      return cached;
    }

    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    const hue = Math.abs(hash) % 360;

    return setCachedValue(GENERATED_COLOR_CACHE, value, `hsl(${hue} 62% 54%)`);
  } catch {
    return "#94a3b8";
  }
}

function isForbiddenDebugBlockTypeId(value: unknown): boolean {
  return contractIsForbiddenDebugBlockTypeId(value);
}

function containsForbiddenDebugBlockTypeIdLocal(value: unknown): boolean {
  return containsForbiddenDebugBlockTypeId(value);
}

function colorFromBlock(block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition): InventoryColor | null {
  try {
    const metadataColor = normalizeCssColor(
      metadataValue(block.metadata, "debugColor")
        ?? metadataValue(block.metadata, "color"),
    );

    if (metadataColor) {
      return {
        css: metadataColor,
        source: "metadata",
      };
    }

    const role = metadataString(block.metadata, "role");

    if (role && ROLE_BLOCK_COLORS[role]) {
      return {
        css: ROLE_BLOCK_COLORS[role],
        source: "role",
      };
    }

    if (FALLBACK_BLOCK_COLORS[block.blockTypeId]) {
      return {
        css: FALLBACK_BLOCK_COLORS[block.blockTypeId],
        source: "fallback",
      };
    }

    return {
      css: generatedColorFromString(block.blockTypeId),
      source: "generated",
    };
  } catch {
    return null;
  }
}

function shortLabelFromLabel(label: string): string {
  try {
    const cached = SHORT_LABEL_CACHE.get(label);

    if (cached !== undefined) {
      return cached;
    }

    if (label.length <= 12) {
      return setCachedValue(SHORT_LABEL_CACHE, label, label);
    }

    const compact = label
      .replace(/^Debug\s+/i, "")
      .replace(/Block$/i, "")
      .replace(/_/g, " ")
      .trim();

    if (compact.length > 0 && compact.length <= 12) {
      return setCachedValue(SHORT_LABEL_CACHE, label, compact);
    }

    return setCachedValue(SHORT_LABEL_CACHE, label, `${label.slice(0, 10)}…`);
  } catch {
    return "Item";
  }
}

function shortLabelFromBlock(block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition): string {
  try {
    const label = safeString(block.label, block.blockTypeId);

    return shortLabelFromLabel(label);
  } catch {
    return "Block";
  }
}

function sourceKindFromBlock(block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition): InventorySourceKind {
  try {
    switch (block.source) {
      case "chunk-service-blocks-route":
      case "chunk-service-placeable-blocks-route":
      case "chunk-service-creative-library-route":
        return "chunk-service";

      case "editor-placeholder-route":
        return "editor-placeholder";

      case "chunk-palette":
        return "chunk-palette";

      case "static-client-fallback":
        return "static-fallback";

      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

function iconFromBlock(
  block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition,
  color: InventoryColor | null,
): InventoryIcon {
  try {
    const icon = metadataString(block.metadata, "icon");
    const iconUrl = metadataString(block.metadata, "iconUrl");

    if (iconUrl) {
      return {
        kind: "asset-url",
        value: iconUrl,
      };
    }

    if (icon) {
      return {
        kind: "text",
        value: icon,
      };
    }

    if (color) {
      return {
        kind: "color",
        value: color.css,
      };
    }

    return {
      kind: "text",
      value: shortLabelFromBlock(block).slice(0, 2).toUpperCase(),
    };
  } catch {
    return {
      kind: "none",
      value: null,
    };
  }
}

function iconFromLibrarySlot(slot: EditorInventorySlot): InventoryIcon {
  try {
    const icon = asRecord(slot.icon);
    const iconUrl = safeNullableString(
      slot.iconUrl
        ?? slot.icon_url
        ?? icon?.url
        ?? icon?.path,
      null,
    );

    if (iconUrl) {
      return {
        kind: "asset-url",
        value: iconUrl,
      };
    }

    const iconValue = safeNullableString(
      icon?.value
        ?? icon?.key
        ?? slot.iconKey
        ?? slot.icon_key,
      null,
    );

    if (iconValue) {
      return {
        kind: "library",
        value: iconValue,
      };
    }

    return {
      kind: "color",
      value: LIBRARY_ITEM_COLOR.css,
    };
  } catch {
    return {
      kind: "color",
      value: LIBRARY_ITEM_COLOR.css,
    };
  }
}

function emptyPlacementRef(): InventoryPlacementRef {
  return {
    kind: "empty",
    blockTypeId: null,
    runtimeBlockTypeId: null,
    assetTypeId: null,
    libraryItemId: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    libraryRef: null,
    placementCommand: null,
  };
}

function blockPlacementRef(blockTypeId: string): InventoryPlacementRef {
  return {
    kind: "block",
    blockTypeId,
    runtimeBlockTypeId: blockTypeId,
    assetTypeId: null,
    libraryItemId: null,
    familyId: null,
    packageId: null,
    vplibUid: null,
    variantId: null,
    revisionHash: null,
    objectKind: null,
    libraryRef: null,
    placementCommand: null,
  };
}

function libraryPlacementRef(
  slot: EditorInventorySlot,
  libraryRef: EditorInventoryLibraryRef | null,
  placementCommand: EditorInventoryPlacementCommand | null,
): InventoryPlacementRef {
  const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
    slot.runtimeBlockTypeId
      ?? slot.runtime_block_type_id
      ?? slot.blockTypeId
      ?? slot.block_type_id,
  );

  return {
    kind: "vplib",
    blockTypeId: runtimeBlockTypeId,
    runtimeBlockTypeId,
    assetTypeId: null,
    libraryItemId: safeNullableString(slot.itemId ?? slot.item_id ?? libraryRef?.libraryItemId, null),
    familyId: safeNullableString(slot.familyId ?? slot.family_id ?? libraryRef?.familyId, null),
    packageId: safeNullableString(slot.packageId ?? slot.package_id ?? libraryRef?.packageId, null),
    vplibUid: safeNullableString(slot.vplibUid ?? slot.vplib_uid ?? libraryRef?.vplibUid, null),
    variantId: safeNullableString(slot.variantId ?? slot.variant_id ?? libraryRef?.variantId, "default"),
    revisionHash: safeNullableString(slot.revisionHash ?? slot.revision_hash ?? libraryRef?.revisionHash, null),
    objectKind: safeNullableString(slot.objectKind ?? slot.object_kind ?? libraryRef?.objectKind, null),
    libraryRef,
    placementCommand,
  };
}

function assetPlacementRef(item: InventoryAssetItem): InventoryPlacementRef {
  return {
    kind: "asset",
    blockTypeId: null,
    runtimeBlockTypeId: item.runtimeBlockTypeId,
    assetTypeId: item.assetTypeId,
    libraryItemId: item.libraryItemId,
    familyId: item.familyId,
    packageId: item.packageId,
    vplibUid: item.vplibUid,
    variantId: item.variantId,
    revisionHash: item.revisionHash,
    objectKind: item.objectKind,
    libraryRef: item.libraryRef,
    placementCommand: item.placementCommand,
  };
}

function normalizeSourceKind(value: unknown, fallback: InventorySourceKind): InventorySourceKind {
  try {
    return normalizeInventorySourceKind(value, fallback);
  } catch {
    return fallback;
  }
}

function normalizeLoadStatus(value: unknown, fallback: InventoryLoadStatus): InventoryLoadStatus {
  try {
    if (
      value === "idle"
      || value === "loading"
      || value === "ready"
      || value === "degraded"
      || value === "failed"
      || value === "empty"
      || value === "fallback"
      || value === "error"
      || value === "destroyed"
    ) {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function getLibraryRefFromSlot(slot: EditorInventorySlot): EditorInventoryLibraryRef | null {
  try {
    const direct = normalizeEditorInventoryLibraryRef(slot.libraryRef ?? slot.library_ref);
    if (direct) {
      return direct;
    }

    const familyId = safeNullableString(slot.familyId ?? slot.family_id, null);
    const vplibUid = safeNullableString(slot.vplibUid ?? slot.vplib_uid, null);
    const libraryItemId = safeNullableString(slot.itemId ?? slot.item_id, null);

    if (!familyId && !vplibUid && !libraryItemId) {
      return null;
    }

    return normalizeEditorInventoryLibraryRef({
      source: "vectoplan-library",
      kind: "vplib",
      libraryItemId,
      familyId,
      packageId: safeNullableString(slot.packageId ?? slot.package_id, null),
      vplibUid,
      variantId: safeNullableString(slot.variantId ?? slot.variant_id, "default"),
      revisionHash: safeNullableString(slot.revisionHash ?? slot.revision_hash, null),
      objectKind: safeNullableString(slot.objectKind ?? slot.object_kind, null),
      domain: safeNullableString(slot.domain, null),
      category: safeNullableString(slot.category, null),
      subcategory: safeNullableString(slot.subcategory, null),
      valid: Boolean(familyId || vplibUid || libraryItemId),
    });
  } catch {
    return null;
  }
}

function getPlacementCommandFromSlot(slot: EditorInventorySlot): EditorInventoryPlacementCommand | null {
  try {
    const direct = normalizeEditorInventoryPlacementCommand(slot.placementCommand ?? slot.placement_command);
    if (direct) {
      return direct;
    }

    const libraryRef = getLibraryRefFromSlot(slot);
    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      slot.runtimeBlockTypeId
        ?? slot.runtime_block_type_id
        ?? slot.blockTypeId
        ?? slot.block_type_id,
    );

    if (!libraryRef || !runtimeBlockTypeId || isForbiddenDebugBlockTypeId(runtimeBlockTypeId)) {
      return null;
    }

    return normalizeEditorInventoryPlacementCommand({
      kind: "PlaceLibraryItem",
      source: "vectoplan-library",
      runtimeBlockTypeId,
      blockTypeId: runtimeBlockTypeId,
      libraryRef,
      placeable: true,
    });
  } catch {
    return null;
  }
}

function isLibrarySlotPlaceable(slot: EditorInventorySlot): boolean {
  try {
    if (slot.empty) {
      return false;
    }

    if (!safeBoolean(slot.placeable, false)) {
      return false;
    }

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
      slot.runtimeBlockTypeId
        ?? slot.runtime_block_type_id
        ?? slot.blockTypeId
        ?? slot.block_type_id,
    );

    if (!runtimeBlockTypeId) {
      return false;
    }

    const familyId = safeNullableString(slot.familyId ?? slot.family_id, null);
    const vplibUid = safeNullableString(slot.vplibUid ?? slot.vplib_uid, null);
    const libraryItemId = safeNullableString(slot.itemId ?? slot.item_id, null);
    const libraryRef = getLibraryRefFromSlot(slot);

    return Boolean(familyId || vplibUid || libraryItemId || libraryRef);
  } catch {
    return false;
  }
}

function slotIndexFromEditorSlot(slot: EditorInventorySlot, fallback: number): number {
  return safeInteger(
    (slot as unknown as Record<string, unknown>).slotIndex
      ?? (slot as unknown as Record<string, unknown>).slot_index,
    fallback,
    0,
    63,
  );
}

function selectedSlotFromState(state: EditorInventoryState, fallback = 0): number {
  const record = asEditorInventoryContractRecord(state);

  return safeInteger(
    record.selectedSlot
      ?? record.selected_slot
      ?? record.defaultSelectedSlot
      ?? record.default_selected_slot,
    fallback,
    0,
    Math.max(0, normalizeSlotCount(record.hotbarSize ?? record.hotbar_size ?? DEFAULT_HOTBAR_SLOT_COUNT) - 1),
  );
}

function hotbarSizeFromState(state: EditorInventoryState, fallback = DEFAULT_HOTBAR_SLOT_COUNT): number {
  const record = asEditorInventoryContractRecord(state);

  return normalizeSlotCount(
    record.hotbarSize
      ?? record.hotbar_size
      ?? fallback,
  );
}

function editorInventoryStateFromPayloadOrState(value: EditorInventoryPayload | EditorInventoryState): EditorInventoryState | null {
  try {
    const record = asEditorInventoryContractRecord(value);

    if (record.inventory && typeof record.inventory === "object") {
      return record.inventory as EditorInventoryState;
    }

    if (Array.isArray(record.slots)) {
      return value as EditorInventoryState;
    }

    return null;
  } catch {
    return null;
  }
}

function selectedItemFromLibrarySlot(slot: EditorInventorySlot): EditorInventoryItem | null {
  try {
    if (!isLibrarySlotPlaceable(slot)) {
      return null;
    }

    return {
      itemId: safeNullableString(slot.itemId ?? slot.item_id, null),
      itemKind: DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
      kind: DEFAULT_EDITOR_INVENTORY_ITEM_KIND,
      source: "library",
      label: safeNullableString(slot.label, "VPLIB Item"),
      displayLabel: safeNullableString(slot.displayLabel ?? slot.display_label, safeString(slot.label, "VPLIB Item")),
      visibleLabel: safeBoolean(slot.visibleLabel ?? slot.visible_label, true),
      description: safeNullableString(slot.description, null),
      blockTypeId: normalizeRuntimeBlockTypeId(slot.blockTypeId ?? slot.block_type_id ?? slot.runtimeBlockTypeId ?? slot.runtime_block_type_id),
      runtimeBlockTypeId: normalizeRuntimeBlockTypeId(slot.runtimeBlockTypeId ?? slot.runtime_block_type_id ?? slot.blockTypeId ?? slot.block_type_id),
      familyId: safeNullableString(slot.familyId ?? slot.family_id, null),
      packageId: safeNullableString(slot.packageId ?? slot.package_id, null),
      vplibUid: safeNullableString(slot.vplibUid ?? slot.vplib_uid, null),
      variantId: safeNullableString(slot.variantId ?? slot.variant_id, "default"),
      revisionHash: safeNullableString(slot.revisionHash ?? slot.revision_hash, null),
      objectKind: safeNullableString(slot.objectKind ?? slot.object_kind, null),
      domain: safeNullableString(slot.domain, null),
      category: safeNullableString(slot.category, null),
      subcategory: safeNullableString(slot.subcategory, null),
      iconKey: safeNullableString(slot.iconKey ?? slot.icon_key, null),
      iconKind: safeString(slot.iconKind ?? slot.icon_kind, "library-item"),
      iconUrl: safeNullableString(slot.iconUrl ?? slot.icon_url, null),
      icon: slot.icon ?? null,
      placeable: true,
      breakable: safeBoolean(slot.breakable, false),
      libraryRef: getLibraryRefFromSlot(slot),
      placementCommand: getPlacementCommandFromSlot(slot),
      assets: asRecord(slot.assets) ?? null,
      metadata: asRecord(slot.metadata) ?? {},
    };
  } catch {
    return null;
  }
}

export function createInventoryLibraryItemFromSlot(
  slot: EditorInventorySlot,
  fallbackSlot: number = 0,
): InventoryLibraryItem | InventoryEmptyItem {
  const slotIndex = slotIndexFromEditorSlot(slot, fallbackSlot);
  const libraryRef = getLibraryRefFromSlot(slot);
  const placementCommand = getPlacementCommandFromSlot(slot);
  const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(
    slot.runtimeBlockTypeId
      ?? slot.runtime_block_type_id
      ?? slot.blockTypeId
      ?? slot.block_type_id,
  );

  if (!isLibrarySlotPlaceable(slot) || !libraryRef || !placementCommand || !runtimeBlockTypeId) {
    return createEmptyInventoryItem(slotIndex, "Kein platzierbares Library-/VPLIB-Item zugewiesen.");
  }

  const label = safeString(slot.label, "VPLIB Item");
  const libraryItemId = safeNullableString(slot.itemId ?? slot.item_id ?? libraryRef.libraryItemId, null);
  const familyId = safeNullableString(slot.familyId ?? slot.family_id ?? libraryRef.familyId, null);
  const packageId = safeNullableString(slot.packageId ?? slot.package_id ?? libraryRef.packageId, null);
  const vplibUid = safeNullableString(slot.vplibUid ?? slot.vplib_uid ?? libraryRef.vplibUid, null);
  const variantId = safeNullableString(slot.variantId ?? slot.variant_id ?? libraryRef.variantId, "default");
  const revisionHash = safeNullableString(slot.revisionHash ?? slot.revision_hash ?? libraryRef.revisionHash, null);
  const objectKind = safeNullableString(slot.objectKind ?? slot.object_kind ?? libraryRef.objectKind, null);
  const placementRef = libraryPlacementRef(slot, libraryRef, placementCommand);

  return {
    kind: "library-item",
    slot: slotIndex,
    id: `vplib:${vplibUid || familyId || libraryItemId || runtimeBlockTypeId}:${variantId || "default"}`,
    itemKind: "vplib",
    blockTypeId: runtimeBlockTypeId,
    runtimeBlockTypeId,
    assetTypeId: null,
    libraryItemId,
    familyId,
    packageId,
    vplibUid,
    variantId,
    revisionHash,
    objectKind,
    label,
    shortLabel: shortLabelFromLabel(label),
    enabled: true,
    disabledReason: null,
    category: safeNullableString(slot.category, null),
    role: "library",
    color: LIBRARY_ITEM_COLOR,
    icon: iconFromLibrarySlot(slot),
    placementRef,
    sourceKind: "library",
    libraryRef,
    placementCommand,
    rawSlot: slot,
    rawItem: selectedItemFromLibrarySlot(slot),
  };
}

export function createInventoryBlockItem(
  block: ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition,
  slot: number,
  options?: {
    readonly allowDisabledBlocks?: boolean;
    readonly allowDebugBlocks?: boolean;
  },
): InventoryBlockItem | InventoryEmptyItem {
  const normalizedSlot = safeInteger(slot, 0, 0);
  const blockTypeId = normalizeBlockTypeId(block.blockTypeId, `block_${normalizedSlot}`);

  if (!blockTypeId || (isForbiddenDebugBlockTypeId(blockTypeId) && options?.allowDebugBlocks !== true)) {
    return createEmptyInventoryItem(
      normalizedSlot,
      `Debug-Block ist nicht als Inventory-Item erlaubt: ${block.blockTypeId}`,
    );
  }

  const placeable = safeBoolean(block.placeable, true);
  const enabled = placeable || options?.allowDisabledBlocks === true;
  const color = colorFromBlock(block);

  return {
    kind: "block",
    slot: normalizedSlot,
    id: `block:${blockTypeId}`,
    blockTypeId,
    runtimeBlockTypeId: blockTypeId,
    label: safeString(block.label, blockTypeId),
    shortLabel: shortLabelFromBlock(block),
    registryId: safeString(block.registryId, CHUNK_API_DEFAULT_REGISTRY_ID),
    registryVersion: safeString(block.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION),
    cellValue: safeInteger(block.cellValue, normalizedSlot + 1, 1),
    paletteIndex: block.paletteIndex === null ? null : safeInteger(block.paletteIndex, normalizedSlot, 0),
    solid: safeBoolean(block.solid, true),
    placeable,
    breakable: safeBoolean(block.breakable, true),
    enabled,
    disabledReason: enabled ? null : "Block is not placeable.",
    category: metadataString(block.metadata, "category"),
    role: metadataString(block.metadata, "role"),
    color,
    icon: iconFromBlock(block, color),
    placementRef: blockPlacementRef(blockTypeId),
    sourceKind: sourceKindFromBlock(block),
    rawBlock: block,
  };
}

export function createEmptyInventoryItem(
  slot: number,
  reason = "Kein Library-/VPLIB-Item zugewiesen.",
): InventoryEmptyItem {
  const normalizedSlot = safeInteger(slot, 0, 0);

  return {
    kind: "empty",
    slot: normalizedSlot,
    id: `empty:${normalizedSlot}`,
    blockTypeId: null,
    runtimeBlockTypeId: null,
    label: "Leer",
    shortLabel: "Leer",
    enabled: false,
    disabledReason: reason,
    color: null,
    icon: {
      kind: "none",
      value: null,
    },
    placementRef: emptyPlacementRef(),
  };
}

export function createInventoryItemsFromLibrarySlots(
  slots: readonly EditorInventorySlot[],
  slotCount: number = DEFAULT_HOTBAR_SLOT_COUNT,
): readonly InventoryItem[] {
  try {
    const normalizedSlotCount = normalizeSlotCount(slotCount);
    const items: InventoryItem[] = [];
    const slotsByIndex = new Map<number, EditorInventorySlot>();

    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const slotIndex = slotIndexFromEditorSlot(slot, index);

      if (slotIndex >= 0 && slotIndex < normalizedSlotCount) {
        slotsByIndex.set(slotIndex, slot);
      }
    }

    for (let slotIndex = 0; slotIndex < normalizedSlotCount; slotIndex += 1) {
      const slot = slotsByIndex.get(slotIndex);

      if (!slot) {
        items.push(createEmptyInventoryItem(slotIndex));
        continue;
      }

      items.push(createInventoryLibraryItemFromSlot(slot, slotIndex));
    }

    return items;
  } catch {
    return Array.from(
      { length: normalizeSlotCount(slotCount) },
      (_, slot) => createEmptyInventoryItem(slot, "Library inventory item creation failed."),
    );
  }
}

export function createInventoryItemsFromBlocks(
  blocks: readonly (ChunkApiBlockDefinition | ChunkApiPlaceableBlockDefinition)[],
  slotCount: number = DEFAULT_HOTBAR_SLOT_COUNT,
  options?: {
    readonly allowDisabledBlocks?: boolean;
    readonly allowDebugBlocks?: boolean;
  },
): readonly InventoryItem[] {
  try {
    const normalizedSlotCount = normalizeSlotCount(slotCount);
    const items: InventoryItem[] = [];
    const usedBlockTypeIds = new Set<string>();

    for (let slot = 0; slot < normalizedSlotCount; slot += 1) {
      const block = blocks[slot];

      if (!block) {
        items.push(createEmptyInventoryItem(slot));
        continue;
      }

      const item = createInventoryBlockItem(block, slot, options);

      if (item.kind === "empty") {
        items.push(item);
        continue;
      }

      if (usedBlockTypeIds.has(item.blockTypeId)) {
        items.push(createEmptyInventoryItem(slot, `Doppelter Blocktyp: ${item.blockTypeId}`));
        continue;
      }

      usedBlockTypeIds.add(item.blockTypeId);
      items.push(item);
    }

    return items;
  } catch {
    return Array.from(
      { length: normalizeSlotCount(slotCount) },
      (_, slot) => createEmptyInventoryItem(slot, "Inventory item creation failed."),
    );
  }
}

export function getInventoryLibraryItems(items: readonly InventoryItem[]): readonly InventoryLibraryItem[] {
  try {
    return items.filter((item): item is InventoryLibraryItem => item.kind === "library-item");
  } catch {
    return [];
  }
}

export function getInventoryBlockItems(items: readonly InventoryItem[]): readonly InventoryBlockItem[] {
  try {
    return items.filter((item): item is InventoryBlockItem => item.kind === "block");
  } catch {
    return [];
  }
}

export function getInventoryAssetItems(items: readonly InventoryItem[]): readonly InventoryAssetItem[] {
  try {
    return items.filter((item): item is InventoryAssetItem => item.kind === "asset");
  } catch {
    return [];
  }
}

export function getInventoryPlaceableItems(
  items: readonly InventoryItem[],
): readonly (InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem)[] {
  try {
    return items.filter((item): item is InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem => {
      return (
        (item.kind === "library-item" || item.kind === "block" || item.kind === "asset")
        && item.enabled
      );
    });
  } catch {
    return [];
  }
}

export function findInventoryItemBySlot(
  items: readonly InventoryItem[],
  slot: number,
): InventoryItem | null {
  try {
    const normalizedSlot = safeInteger(slot, 0, 0);

    return items.find((item) => item.slot === normalizedSlot) ?? null;
  } catch {
    return null;
  }
}

export function findInventoryBlockItemByBlockTypeId(
  items: readonly InventoryItem[],
  blockTypeId: string,
): InventoryBlockItem | null {
  try {
    const normalizedBlockTypeId = normalizeRuntimeBlockTypeId(blockTypeId);

    if (!normalizedBlockTypeId) {
      return null;
    }

    return getInventoryBlockItems(items).find((item) => item.blockTypeId === normalizedBlockTypeId) ?? null;
  } catch {
    return null;
  }
}

export function findInventoryLibraryItemByRuntimeBlockTypeId(
  items: readonly InventoryItem[],
  runtimeBlockTypeId: string,
): InventoryLibraryItem | null {
  try {
    const normalizedRuntimeBlockTypeId = normalizeRuntimeBlockTypeId(runtimeBlockTypeId);

    if (!normalizedRuntimeBlockTypeId) {
      return null;
    }

    return getInventoryLibraryItems(items).find((item) => item.runtimeBlockTypeId === normalizedRuntimeBlockTypeId) ?? null;
  } catch {
    return null;
  }
}

export function findInventoryLibraryItemByLibraryRef(
  items: readonly InventoryItem[],
  options: InventorySelectionOptions,
): InventoryLibraryItem | null {
  try {
    const libraryItems = getInventoryLibraryItems(items);

    if (options.libraryItemId) {
      const libraryItemId = normalizeIdentifier(options.libraryItemId, "");
      const item = libraryItems.find((candidate) => candidate.libraryItemId === libraryItemId);

      if (item) {
        return item;
      }
    }

    if (options.familyId) {
      const familyId = normalizeIdentifier(options.familyId, "");
      const item = libraryItems.find((candidate) => candidate.familyId === familyId);

      if (item) {
        return item;
      }
    }

    if (options.packageId) {
      const packageId = normalizeIdentifier(options.packageId, "");
      const item = libraryItems.find((candidate) => candidate.packageId === packageId);

      if (item) {
        return item;
      }
    }

    if (options.vplibUid) {
      const vplibUid = safeString(options.vplibUid, "");
      const item = libraryItems.find((candidate) => candidate.vplibUid === vplibUid);

      if (item) {
        return item;
      }
    }

    if (options.variantId) {
      const variantId = normalizeIdentifier(options.variantId, "");
      const item = libraryItems.find((candidate) => candidate.variantId === variantId);

      if (item) {
        return item;
      }
    }

    if (options.revisionHash) {
      const revisionHash = safeString(options.revisionHash, "");
      const item = libraryItems.find((candidate) => candidate.revisionHash === revisionHash);

      if (item) {
        return item;
      }
    }

    if (options.runtimeBlockTypeId) {
      return findInventoryLibraryItemByRuntimeBlockTypeId(items, options.runtimeBlockTypeId);
    }

    if (options.blockTypeId) {
      return findInventoryLibraryItemByRuntimeBlockTypeId(items, options.blockTypeId);
    }

    return null;
  } catch {
    return null;
  }
}

export function findInventoryPlaceableItemByPlacementRef(
  items: readonly InventoryItem[],
  options: InventorySelectionOptions,
): InventoryLibraryItem | InventoryBlockItem | InventoryAssetItem | null {
  try {
    const libraryItem = findInventoryLibraryItemByLibraryRef(items, options);
    if (libraryItem) {
      return libraryItem;
    }

    const runtimeBlockTypeId = normalizeRuntimeBlockTypeId(options.runtimeBlockTypeId ?? options.blockTypeId);
    if (runtimeBlockTypeId) {
      const blockItem = findInventoryBlockItemByBlockTypeId(items, runtimeBlockTypeId);

      if (blockItem) {
        return blockItem;
      }
    }

    const placeable = getInventoryPlaceableItems(items);

    if (options.assetTypeId) {
      const assetTypeId = normalizeIdentifier(options.assetTypeId, "");
      const item = placeable.find((candidate) => candidate.placementRef.assetTypeId === assetTypeId);

      if (item) {
        return item;
      }
    }

    if (options.libraryItemId) {
      const libraryItemId = normalizeIdentifier(options.libraryItemId, "");
      const item = placeable.find((candidate) => candidate.placementRef.libraryItemId === libraryItemId);

      if (item) {
        return item;
      }
    }

    if (options.familyId) {
      const familyId = normalizeIdentifier(options.familyId, "");
      const item = placeable.find((candidate) => candidate.placementRef.familyId === familyId);

      if (item) {
        return item;
      }
    }

    if (options.vplibUid) {
      const vplibUid = safeString(options.vplibUid, "");
      const item = placeable.find((candidate) => candidate.placementRef.vplibUid === vplibUid);

      if (item) {
        return item;
      }
    }

    if (options.variantId) {
      const variantId = normalizeIdentifier(options.variantId, "");
      const item = placeable.find((candidate) => candidate.placementRef.variantId === variantId);

      if (item) {
        return item;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function selectInventoryItem(
  items: readonly InventoryItem[],
  options?: InventorySelectionOptions,
): InventorySelection {
  try {
    const placeableRefItem = options
      ? findInventoryPlaceableItemByPlacementRef(items, options)
      : null;

    const slotCount = Math.max(1, items.length);
    const requestedSlot = normalizeSlot(options?.selectedSlotIndex ?? options?.selectedSlot, slotCount);
    const slotItem = findInventoryItemBySlot(items, requestedSlot);
    const preferEnabled = options?.preferEnabled ?? true;

    const selectedItem = placeableRefItem && (placeableRefItem.enabled || options?.preferEnabled === false)
      ? placeableRefItem
      : slotItem
        && (slotItem.kind === "library-item" || slotItem.kind === "block" || slotItem.kind === "asset")
        && (!preferEnabled || slotItem.enabled)
          ? slotItem
          : getInventoryPlaceableItems(items).find((item) => !preferEnabled || item.enabled) ?? null;

    const selectedLibraryItem = selectedItem?.kind === "library-item" ? selectedItem : null;
    const selectedBlockItem = selectedItem?.kind === "block" ? selectedItem : null;
    const selectedAssetItem = selectedItem?.kind === "asset" ? selectedItem : null;
    const selectedRuntimeBlockTypeId = selectedLibraryItem?.runtimeBlockTypeId
      ?? selectedBlockItem?.blockTypeId
      ?? selectedAssetItem?.runtimeBlockTypeId
      ?? null;

    return {
      selectedSlot: selectedItem?.slot ?? requestedSlot,
      selectedSlotIndex: selectedItem?.slot ?? requestedSlot,
      selectedItem,
      selectedLibraryItem,
      selectedBlockItem,
      selectedAssetItem,
      selectedBlockTypeId: selectedRuntimeBlockTypeId,
      selectedRuntimeBlockTypeId,
      selectedCellValue: selectedBlockItem?.cellValue ?? null,
      selectedPlacementRef: selectedItem?.placementRef ?? null,
      selectedLibraryRef: selectedLibraryItem?.libraryRef ?? selectedAssetItem?.libraryRef ?? null,
      selectedPlacementCommand: selectedLibraryItem?.placementCommand ?? selectedAssetItem?.placementCommand ?? null,
    };
  } catch {
    return {
      selectedSlot: 0,
      selectedSlotIndex: 0,
      selectedItem: null,
      selectedLibraryItem: null,
      selectedBlockItem: null,
      selectedAssetItem: null,
      selectedBlockTypeId: null,
      selectedRuntimeBlockTypeId: null,
      selectedCellValue: null,
      selectedPlacementRef: null,
      selectedLibraryRef: null,
      selectedPlacementCommand: null,
    };
  }
}

export function createHotbarSlots(
  items: readonly InventoryItem[],
  selection: InventorySelection,
): readonly HotbarSlot[] {
  try {
    return items.map((item) => {
      const selected = item.slot === selection.selectedSlot;
      const blockTypeId = item.kind === "block"
        ? item.blockTypeId
        : item.kind === "library-item"
          ? item.blockTypeId
          : null;
      const runtimeBlockTypeId = item.kind === "block"
        ? item.blockTypeId
        : item.kind === "library-item"
          ? item.runtimeBlockTypeId
          : item.kind === "asset"
            ? item.runtimeBlockTypeId
            : null;
      const assetTypeId = item.kind === "asset" ? item.assetTypeId : null;
      const libraryItemId = item.kind === "library-item"
        ? item.libraryItemId
        : item.kind === "asset"
          ? item.libraryItemId
          : null;
      const familyId = item.kind === "library-item"
        ? item.familyId
        : item.kind === "asset"
          ? item.familyId
          : null;
      const packageId = item.kind === "library-item"
        ? item.packageId
        : item.kind === "asset"
          ? item.packageId
          : null;
      const vplibUid = item.kind === "library-item"
        ? item.vplibUid
        : item.kind === "asset"
          ? item.vplibUid
          : null;
      const variantId = item.kind === "library-item" || item.kind === "asset" ? item.variantId : null;
      const revisionHash = item.kind === "library-item"
        ? item.revisionHash
        : item.kind === "asset"
          ? item.revisionHash
          : null;
      const objectKind = item.kind === "library-item"
        ? item.objectKind
        : item.kind === "asset"
          ? item.objectKind
          : item.placementRef.objectKind;
      const label = item.shortLabel;
      const color = item.kind === "library-item" || item.kind === "block" || item.kind === "asset"
        ? item.color?.css ?? null
        : null;
      const status: InventorySlotStatus = item.kind === "empty"
        ? "empty"
        : !item.enabled
          ? "disabled"
          : selected
            ? "selected"
            : "available";

      return {
        slot: item.slot,
        index: item.slot,
        status,
        selected,
        item,
        label,
        shortLabel: item.shortLabel,
        title: item.kind === "library-item"
          ? `${item.label} (${item.familyId || item.vplibUid || item.runtimeBlockTypeId})`
          : item.kind === "block"
            ? `${item.label} (${item.blockTypeId})`
            : item.kind === "asset"
              ? `${item.label} (${item.assetTypeId})`
              : item.disabledReason,
        blockTypeId,
        runtimeBlockTypeId,
        assetTypeId,
        libraryItemId,
        familyId,
        packageId,
        vplibUid,
        variantId,
        revisionHash,
        objectKind,
        color,
        icon: item.icon,
        keyBinding: String(item.slot + 1),
        enabled: item.enabled,
        sourceKind: item.kind === "empty" ? "empty-fallback" : item.sourceKind,
        placementRef: item.kind === "asset" ? assetPlacementRef(item) : item.placementRef,
        libraryRef: item.kind === "library-item" ? item.libraryRef : item.kind === "asset" ? item.libraryRef : null,
        placementCommand: item.kind === "library-item" ? item.placementCommand : item.kind === "asset" ? item.placementCommand : null,
      };
    });
  } catch {
    return [];
  }
}

function sourceKindFromBlocksResult(result: ChunkApiBlocksResult): InventorySourceKind {
  try {
    if (result.usedPaletteFallback) {
      return "chunk-palette";
    }

    switch (result.sourceKind) {
      case "editor-placeholder-route":
        return "editor-placeholder";

      case "static-client-fallback":
        return "static-fallback";

      case "chunk-service-blocks-route":
      case "chunk-service-placeable-blocks-route":
      case "chunk-service-creative-library-route":
        return "chunk-service";

      default:
        return normalizeSourceKind(result.sourceKind, "chunk-service");
    }
  } catch {
    return "unknown";
  }
}

function statusFromBlocksResult(result: ChunkApiBlocksResult): InventoryLoadStatus {
  try {
    if (result.sourceKind === "static-client-fallback" || result.usedPaletteFallback) {
      return "degraded";
    }

    return "ready";
  } catch {
    return "degraded";
  }
}

function createCatalogFromItems(
  items: readonly InventoryItem[],
  options: {
    readonly sourceKind: InventorySourceKind;
    readonly status: InventoryLoadStatus;
    readonly projectId?: string;
    readonly worldId?: string;
    readonly registryId?: string;
    readonly registryVersion?: string;
    readonly slotCount: number;
    readonly selectedSlot?: number;
    readonly selectedSlotIndex?: number;
    readonly defaultBlockTypeId?: string | null;
    readonly runtimeBlockTypeId?: string | null;
    readonly libraryItemId?: string | null;
    readonly familyId?: string | null;
    readonly packageId?: string | null;
    readonly vplibUid?: string | null;
    readonly variantId?: string | null;
    readonly revisionHash?: string | null;
    readonly objectKind?: string | null;
    readonly usedPaletteFallback?: boolean;
    readonly loadedAt?: string | null;
    readonly errorMessage?: string | null;
    readonly rawResult?: InventoryCatalog["rawResult"];
  },
): InventoryCatalog {
  const selection = selectInventoryItem(items, {
    selectedSlot: options.selectedSlotIndex ?? options.selectedSlot,
    selectedSlotIndex: options.selectedSlotIndex ?? options.selectedSlot,
    blockTypeId: options.defaultBlockTypeId,
    runtimeBlockTypeId: options.runtimeBlockTypeId ?? options.defaultBlockTypeId,
    libraryItemId: options.libraryItemId,
    familyId: options.familyId,
    packageId: options.packageId,
    vplibUid: options.vplibUid,
    variantId: options.variantId,
    revisionHash: options.revisionHash,
    objectKind: options.objectKind,
    preferEnabled: true,
  });
  const hotbarSlots = createHotbarSlots(items, selection);
  const libraryItems = getInventoryLibraryItems(items);
  const blockItems = getInventoryBlockItems(items);
  const assetItems = getInventoryAssetItems(items);
  const placeableItems = getInventoryPlaceableItems(items);

  return {
    sourceKind: normalizeSourceKind(options.sourceKind, "unknown"),
    status: normalizeLoadStatus(options.status, "idle"),
    projectId: safeString(options.projectId, "dev-project"),
    worldId: safeString(options.worldId, "world_spawn"),
    registryId: safeString(options.registryId, CHUNK_API_DEFAULT_REGISTRY_ID),
    registryVersion: safeString(options.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION),
    slotCount: options.slotCount,
    items,
    libraryItems,
    blockItems,
    assetItems,
    placeableItems,
    hotbarSlots,
    selection,
    blockTypeIds: blockItems
      .map((item) => item.blockTypeId)
      .filter((value) => !isForbiddenDebugBlockTypeId(value)),
    runtimeBlockTypeIds: placeableItems
      .map((item) => item.kind === "library-item" ? item.runtimeBlockTypeId : item.kind === "block" ? item.blockTypeId : item.runtimeBlockTypeId ?? "")
      .filter((value) => value.length > 0 && !isForbiddenDebugBlockTypeId(value)),
    libraryItemIds: libraryItems.map((item) => item.libraryItemId).filter((value): value is string => Boolean(value)),
    familyIds: libraryItems.map((item) => item.familyId).filter((value): value is string => Boolean(value)),
    vplibUids: libraryItems.map((item) => item.vplibUid).filter((value): value is string => Boolean(value)),
    usedPaletteFallback: safeBoolean(options.usedPaletteFallback, false),
    loadedAt: options.loadedAt ?? nowIsoStringSafe(),
    errorMessage: options.errorMessage ?? null,
    rawResult: options.rawResult ?? null,
  };
}

export function createInventoryCatalogFromLibraryInventory(
  options: CreateLibraryInventoryCatalogOptions,
): InventoryCatalog {
  try {
    const state = options.state ?? (options.payload ? editorInventoryStateFromPayloadOrState(options.payload) : null);

    if (!state || containsForbiddenDebugBlockTypeIdLocal(state)) {
      return createFallbackInventoryCatalog({
        projectId: options.projectId,
        worldId: options.worldId,
        slotCount: options.slotCount,
        selectedSlot: options.selectedSlotIndex ?? options.selectedSlot,
        reason: options.reason ?? "Library inventory state is empty or contains forbidden debug blocks.",
      });
    }

    const slotCount = normalizeSlotCount(options.slotCount ?? hotbarSizeFromState(state));
    const selectedSlot = normalizeSlot(options.selectedSlotIndex ?? options.selectedSlot ?? selectedSlotFromState(state), slotCount);
    const slots = Array.isArray(state.slots) ? state.slots : [];
    const items = createInventoryItemsFromLibrarySlots(slots, slotCount);
    const placeableItems = getInventoryPlaceableItems(items);

    if (placeableItems.length <= 0 && options.allowEmptyFallback !== false) {
      return createFallbackInventoryCatalog({
        projectId: options.projectId,
        worldId: options.worldId,
        slotCount,
        selectedSlot,
        reason: options.reason ?? "Library inventory contains no placeable VPLIB items.",
      });
    }

    return createCatalogFromItems(items, {
      sourceKind: "library",
      status: placeableItems.length > 0 ? "ready" : "empty",
      projectId: options.projectId,
      worldId: options.worldId,
      slotCount,
      selectedSlot,
      usedPaletteFallback: false,
      loadedAt: nowIsoStringSafe(),
      errorMessage: placeableItems.length > 0 ? null : options.reason ?? "Library inventory contains no placeable VPLIB items.",
      rawResult: options.payload ?? state,
    });
  } catch (error) {
    return createFallbackInventoryCatalog({
      projectId: options.projectId,
      worldId: options.worldId,
      slotCount: options.slotCount,
      selectedSlot: options.selectedSlotIndex ?? options.selectedSlot,
      reason: `Library inventory catalog creation failed: ${safeString((error as Error)?.message, "unknown error")}`,
    });
  }
}

export function createInventoryCatalogFromBlocksResult(
  options: CreateInventoryCatalogOptions,
): InventoryCatalog {
  try {
    if (options.allowChunkBlocks !== true) {
      return createFallbackInventoryCatalog({
        slotCount: options.slotCount,
        selectedSlot: options.selectedSlotIndex ?? options.selectedSlot,
        reason: `Chunk blocks are disabled as inventory truth. Use ${PRODUCTIVE_EDITOR_INVENTORY_ROUTE} instead.`,
      });
    }

    const result = options.result;
    const slotCount = normalizeSlotCount(options.slotCount ?? DEFAULT_HOTBAR_SLOT_COUNT);
    const blocks = result.placeableBlocks.length > 0
      ? result.placeableBlocks
      : result.blocks;
    const items = createInventoryItemsFromBlocks(blocks, slotCount, {
      allowDisabledBlocks: options.allowDisabledBlocks ?? false,
      allowDebugBlocks: false,
    });
    const sourceKind = sourceKindFromBlocksResult(result);

    return createCatalogFromItems(items, {
      sourceKind,
      status: statusFromBlocksResult(result),
      projectId: safeString(result.projectId, "dev-project"),
      worldId: safeString(result.worldId, "world_spawn"),
      registryId: safeString(result.registryId, CHUNK_API_DEFAULT_REGISTRY_ID),
      registryVersion: safeString(result.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION),
      slotCount,
      selectedSlot: options.selectedSlotIndex ?? options.selectedSlot,
      defaultBlockTypeId: options.defaultBlockTypeId,
      usedPaletteFallback: safeBoolean(result.usedPaletteFallback, false),
      loadedAt: nowIsoStringSafe(),
      errorMessage: null,
      rawResult: result,
    });
  } catch (error) {
    return createFallbackInventoryCatalog({
      slotCount: options.slotCount,
      selectedSlot: options.selectedSlotIndex ?? options.selectedSlot,
      reason: `Inventory catalog creation failed: ${safeString((error as Error)?.message, "unknown error")}`,
    });
  }
}

export function createFallbackInventoryCatalog(
  options?: CreateFallbackInventoryCatalogOptions,
): InventoryCatalog {
  const projectId = safeString(options?.projectId, "dev-project");
  const worldId = safeString(options?.worldId, "world_spawn");
  const slotCount = normalizeSlotCount(options?.slotCount ?? DEFAULT_HOTBAR_SLOT_COUNT);
  const selectedSlot = normalizeSlot(options?.selectedSlotIndex ?? options?.selectedSlot, slotCount);
  const items = Array.from(
    { length: slotCount },
    (_, slot) => createEmptyInventoryItem(slot, options?.reason ?? "Library inventory fallback is empty."),
  );

  return createCatalogFromItems(items, {
    sourceKind: "empty-fallback",
    status: "empty",
    projectId,
    worldId,
    registryId: CHUNK_API_DEFAULT_REGISTRY_ID,
    registryVersion: CHUNK_API_DEFAULT_REGISTRY_VERSION,
    slotCount,
    selectedSlot,
    usedPaletteFallback: false,
    loadedAt: nowIsoStringSafe(),
    errorMessage: options?.reason ?? "Empty inventory fallback was used.",
    rawResult: null,
  });
}

export function updateInventorySelection(
  catalog: InventoryCatalog,
  options: InventorySelectionOptions,
): InventoryCatalog {
  try {
    const selection = selectInventoryItem(catalog.items, options);
    const hotbarSlots = createHotbarSlots(catalog.items, selection);

    return {
      ...catalog,
      selection,
      hotbarSlots,
    };
  } catch {
    return catalog;
  }
}

export function normalizeInventoryCatalog(value: unknown, fallback?: InventoryCatalog): InventoryCatalog {
  try {
    if (isInventoryCatalog(value)) {
      const slotCount = normalizeSlotCount(value.slotCount);
      const items = value.items.length > 0
        ? value.items
        : Array.from({ length: slotCount }, (_, slot) => createEmptyInventoryItem(slot));
      const selection = selectInventoryItem(items, {
        selectedSlot: value.selection?.selectedSlot ?? 0,
        blockTypeId: value.selection?.selectedBlockTypeId ?? null,
        runtimeBlockTypeId: value.selection?.selectedRuntimeBlockTypeId ?? null,
        libraryItemId: value.selection?.selectedPlacementRef?.libraryItemId ?? null,
        familyId: value.selection?.selectedPlacementRef?.familyId ?? null,
        packageId: value.selection?.selectedPlacementRef?.packageId ?? null,
        vplibUid: value.selection?.selectedPlacementRef?.vplibUid ?? null,
        variantId: value.selection?.selectedPlacementRef?.variantId ?? null,
        revisionHash: value.selection?.selectedPlacementRef?.revisionHash ?? null,
        objectKind: value.selection?.selectedPlacementRef?.objectKind ?? null,
      });

      return createCatalogFromItems(items, {
        sourceKind: normalizeSourceKind(value.sourceKind, "unknown"),
        status: normalizeLoadStatus(value.status, "idle"),
        projectId: safeString(value.projectId, "dev-project"),
        worldId: safeString(value.worldId, "world_spawn"),
        registryId: safeString(value.registryId, CHUNK_API_DEFAULT_REGISTRY_ID),
        registryVersion: safeString(value.registryVersion, CHUNK_API_DEFAULT_REGISTRY_VERSION),
        slotCount,
        selectedSlot: selection.selectedSlot,
        runtimeBlockTypeId: selection.selectedRuntimeBlockTypeId,
        libraryItemId: selection.selectedPlacementRef?.libraryItemId,
        familyId: selection.selectedPlacementRef?.familyId,
        packageId: selection.selectedPlacementRef?.packageId,
        vplibUid: selection.selectedPlacementRef?.vplibUid,
        variantId: selection.selectedPlacementRef?.variantId,
        revisionHash: selection.selectedPlacementRef?.revisionHash,
        objectKind: selection.selectedPlacementRef?.objectKind,
        usedPaletteFallback: safeBoolean(value.usedPaletteFallback, false),
        loadedAt: safeNullableString(value.loadedAt, null),
        errorMessage: safeNullableString(value.errorMessage, null),
        rawResult: value.rawResult ?? null,
      });
    }

    const state = editorInventoryStateFromPayloadOrState(value as EditorInventoryPayload | EditorInventoryState);
    if (state) {
      return createInventoryCatalogFromLibraryInventory({
        state,
        allowEmptyFallback: true,
      });
    }

    return fallback ?? createFallbackInventoryCatalog();
  } catch {
    return fallback ?? createFallbackInventoryCatalog({
      reason: "Inventory catalog normalization failed.",
    });
  }
}

export function inventoryCatalogToDebugSummary(catalog: InventoryCatalog): InventoryDebugSummary {
  return {
    status: catalog.status,
    sourceKind: catalog.sourceKind,
    projectId: catalog.projectId,
    worldId: catalog.worldId,
    registryId: catalog.registryId,
    registryVersion: catalog.registryVersion,
    slotCount: catalog.slotCount,
    itemCount: catalog.items.length,
    libraryItemCount: catalog.libraryItems.length,
    blockItemCount: catalog.blockItems.length,
    assetItemCount: catalog.assetItems.length,
    placeableItemCount: catalog.placeableItems.length,
    selectedSlot: catalog.selection.selectedSlot,
    selectedSlotIndex: catalog.selection.selectedSlotIndex,
    selectedBlockTypeId: catalog.selection.selectedBlockTypeId,
    selectedRuntimeBlockTypeId: catalog.selection.selectedRuntimeBlockTypeId,
    selectedPlacementKind: catalog.selection.selectedPlacementRef?.kind ?? null,
    selectedLibraryItemId: catalog.selection.selectedPlacementRef?.libraryItemId ?? null,
    selectedFamilyId: catalog.selection.selectedPlacementRef?.familyId ?? null,
    selectedPackageId: catalog.selection.selectedPlacementRef?.packageId ?? null,
    selectedVplibUid: catalog.selection.selectedPlacementRef?.vplibUid ?? null,
    selectedVariantId: catalog.selection.selectedPlacementRef?.variantId ?? null,
    selectedRevisionHash: catalog.selection.selectedPlacementRef?.revisionHash ?? null,
    selectedObjectKind: catalog.selection.selectedPlacementRef?.objectKind ?? null,
    blockTypeIds: catalog.blockTypeIds,
    runtimeBlockTypeIds: catalog.runtimeBlockTypeIds,
    libraryItemIds: catalog.libraryItemIds,
    familyIds: catalog.familyIds,
    vplibUids: catalog.vplibUids,
    usedPaletteFallback: catalog.usedPaletteFallback,
    loadedAt: catalog.loadedAt,
    errorMessage: catalog.errorMessage,
  };
}

export function hotbarSlotsToDomSlots(
  slots: readonly HotbarSlot[],
): readonly {
  readonly slot: number;
  readonly label: string;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly color: string | null;
  readonly selected: boolean;
  readonly enabled: boolean;
  readonly sourceKind: InventorySourceKind;
  readonly itemKind: InventoryItem["kind"];
}[] {
  try {
    return slots.map((slot) => ({
      slot: slot.slot,
      label: slot.label,
      blockTypeId: slot.blockTypeId,
      runtimeBlockTypeId: slot.runtimeBlockTypeId,
      libraryItemId: slot.libraryItemId,
      familyId: slot.familyId,
      packageId: slot.packageId,
      vplibUid: slot.vplibUid,
      variantId: slot.variantId,
      revisionHash: slot.revisionHash,
      objectKind: slot.objectKind,
      color: slot.color,
      selected: slot.selected,
      enabled: slot.enabled,
      sourceKind: slot.sourceKind,
      itemKind: slot.item.kind,
    }));
  } catch {
    return [];
  }
}

export function isInventoryLibraryItem(value: unknown): value is InventoryLibraryItem {
  try {
    const record = asRecord(value);

    return (
      record?.kind === "library-item"
      && typeof record.runtimeBlockTypeId === "string"
      && typeof record.slot === "number"
      && !isForbiddenDebugBlockTypeId(record.runtimeBlockTypeId)
    );
  } catch {
    return false;
  }
}

export function isInventoryBlockItem(value: unknown): value is InventoryBlockItem {
  try {
    const record = asRecord(value);

    return (
      record?.kind === "block"
      && typeof record.blockTypeId === "string"
      && typeof record.slot === "number"
      && !isForbiddenDebugBlockTypeId(record.blockTypeId)
    );
  } catch {
    return false;
  }
}

export function isInventoryAssetItem(value: unknown): value is InventoryAssetItem {
  try {
    const record = asRecord(value);

    return (
      record?.kind === "asset"
      && typeof record.assetTypeId === "string"
      && typeof record.slot === "number"
    );
  } catch {
    return false;
  }
}

export function isInventoryEmptyItem(value: unknown): value is InventoryEmptyItem {
  try {
    const record = asRecord(value);

    return (
      record?.kind === "empty"
      && typeof record.slot === "number"
    );
  } catch {
    return false;
  }
}

export function isInventoryItem(value: unknown): value is InventoryItem {
  return isInventoryLibraryItem(value)
    || isInventoryBlockItem(value)
    || isInventoryAssetItem(value)
    || isInventoryEmptyItem(value);
}

export function isInventoryCatalog(value: unknown): value is InventoryCatalog {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const record = value as Partial<InventoryCatalog>;

    return (
      Array.isArray(record.items)
      && Array.isArray(record.hotbarSlots)
      && typeof record.projectId === "string"
      && typeof record.worldId === "string"
      && record.sourceKind !== undefined
    );
  } catch {
    return false;
  }
}

export function isLibraryInventoryCatalog(catalog: InventoryCatalog): boolean {
  try {
    return isLibraryInventorySourceKind(catalog.sourceKind) || catalog.libraryItems.length > 0;
  } catch {
    return false;
  }
}

export function isLegacyInventoryCatalog(catalog: InventoryCatalog): boolean {
  try {
    return isLegacyInventorySourceKind(catalog.sourceKind);
  } catch {
    return false;
  }
}

export function inventoryCatalogContainsForbiddenDebugBlocks(catalog: InventoryCatalog): boolean {
  return containsForbiddenDebugBlockTypeIdLocal(catalog);
}

export function getInventoryModelsMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.inventory.inventory_models",
    supportsLibraryInventory: true,
    supportsLegacyChunkInventory: true,
    legacyChunkInventoryRequiresExplicitAllow: true,
    defaultHotbarSlotCount: DEFAULT_HOTBAR_SLOT_COUNT,
    defaultPlaceableBlockTypeId: DEFAULT_PLACEABLE_BLOCK_TYPE_ID,
    productiveInventoryRoute: PRODUCTIVE_EDITOR_INVENTORY_ROUTE,
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    contract: getEditorInventoryContractMetadata(),
    rules: {
      ...editorInventoryContractRules(),
      onlyLibraryItemsPlaceable: ONLY_LIBRARY_ITEMS_PLACEABLE,
      debugGrassDirtAllowed: DEBUG_GRASS_DIRT_ALLOWED,
      allowChunkPlaceableFallback: ALLOW_CHUNK_PLACEABLE_FALLBACK,
      legacyChunkInventoryIsDiagnosticOnly: LEGACY_CHUNK_INVENTORY_IS_DIAGNOSTIC_ONLY,
      emptyFallbackCreatesPlaceableItems: EMPTY_FALLBACK_CREATES_PLACEABLE_ITEMS,
      staticFallbackCreatesPlaceableBlocks: false,
      browserUsesEditorApiInventory: true,
      hotbarSlotCarriesObjectKind: true,
      inventoryCatalogCarriesLibraryIdentity: true,
      inventoryItemKindDefault: normalizeInventoryItemKind(DEFAULT_EDITOR_INVENTORY_ITEM_KIND),
    },
  };
}