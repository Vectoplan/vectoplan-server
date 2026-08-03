// services/vectoplan-editor/src/frontend/ui/debug_overlay.ts
import type { ChunkApiErrorDetails } from "@api/chunk_api_models";
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
  type EditorInventoryLibraryRef,
  type EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import type { EditorDomRefs } from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, previewValue, safeBoolean, safeInteger, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore, EditorStoreUnsubscribe } from "@state/editor_store";
import type { EditorState } from "@state/editor_state";
import {
  selectAllErrors,
  selectCamera,
  selectCommandSummary,
  selectCreativeLibrarySummary,
  selectDebugSummary,
  selectDirtyChunkKeys,
  selectInventoryHotbarSlots,
  selectInventoryItems,
  selectInventorySummary,
  selectRuntimeReadiness,
  selectSelectedFamilyId,
  selectSelectedInventoryItem,
  selectSelectedLibraryItemId,
  selectSelectedLibraryRef,
  selectSelectedPackageId,
  selectSelectedPlacementCommand,
  selectSelectedRevisionHash,
  selectSelectedRuntimeBlockTypeId,
  selectSelectedSlotIndex,
  selectSelectedVariantId,
  selectSelectedVplibUid,
  selectStatusLine,
  selectTargetSummary,
  selectWorldSourceSummary,
} from "@state/state_selectors";

export type DebugOverlayStatus =
  | "created"
  | "mounted"
  | "visible"
  | "hidden"
  | "failed"
  | "disposed";

export interface DebugOverlayOptions {
  readonly refs: EditorDomRefs;
  readonly store: EditorStore;
  readonly logger?: EditorLogger;
  readonly enabled?: boolean;
  readonly visible?: boolean;
  readonly autoMount?: boolean;
  readonly autoRender?: boolean;
  readonly maxErrors?: number;
  readonly maxWarnings?: number;
  readonly maxLines?: number;
  readonly renderIntervalMs?: number;
}

export interface DebugOverlayInventoryViewModel {
  readonly status: string;
  readonly source: string;
  readonly itemCount: number;
  readonly libraryItemCount: number;
  readonly hotbarSlotCount: number;
  readonly selectedSlotIndex: number;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedPackageId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedVariantId: string | null;
  readonly selectedRevisionHash: string | null;
  readonly selectedLabel: string | null;
  readonly selectedItemKind: string | null;
  readonly selectedSourceKind: string | null;
  readonly selectedLibraryRef: EditorInventoryLibraryRef | null;
  readonly selectedPlacementCommand: EditorInventoryPlacementCommand | null;
  readonly selectedPlacementCommandKind: string | null;
  readonly selectedPlacementCommandSource: string | null;
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;
  readonly hasForbiddenDebugBlockIds: boolean;
}

export interface DebugOverlayCreativeLibraryViewModel {
  readonly status: string;
  readonly source: string;
  readonly itemCount: number;
  readonly totalCount: number;
  readonly runtimeBlockTypeIds: readonly string[];
  readonly libraryItemIds: readonly string[];
  readonly familyIds: readonly string[];
  readonly vplibUids: readonly string[];
  readonly categoryIds: readonly string[];
  readonly lastLoadedAt: string | null;
  readonly lastErrorMessage: string | null;
}

export interface DebugOverlayViewModel {
  readonly visible: boolean;
  readonly statusLine: string;
  readonly lifecycleStatus: string;
  readonly worldStatus: string;
  readonly commandStatus: string;
  readonly targetStatus: string;
  readonly ready: boolean;
  readonly blockingReason: string | null;
  readonly loadedChunkCount: number;
  readonly visibleChunkCount: number;
  readonly dirtyChunkCount: number;
  readonly inventoryItemCount: number;
  readonly inventory: DebugOverlayInventoryViewModel;
  readonly creativeLibrary: DebugOverlayCreativeLibraryViewModel;
  readonly camera: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly pitch: number;
    readonly yaw: number;
    readonly roll: number;
  };
  readonly warnings: readonly string[];
  readonly errors: readonly ChunkApiErrorDetails[];
  readonly lastAction: string | null;
  readonly lines: readonly string[];
  readonly updatedAt: string;
}

export interface DebugOverlaySnapshot {
  readonly kind: "debug-overlay-snapshot.v1";
  readonly status: DebugOverlayStatus;
  readonly enabled: boolean;
  readonly visible: boolean;
  readonly mounted: boolean;
  readonly disposed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly renderCount: number;
  readonly showCount: number;
  readonly hideCount: number;
  readonly skippedRenderCount: number;
  readonly lastRenderAt: string | null;
  readonly lastReason: string | null;
  readonly lastViewModel: DebugOverlayViewModel | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface DebugOverlayHandle {
  readonly kind: "vectoplan-editor-debug-overlay.v1";

  mount(): void;
  render(state?: EditorState, reason?: string): void;
  show(reason?: string): void;
  hide(reason?: string): void;
  toggle(reason?: string): void;
  setEnabled(enabled: boolean, reason?: string): void;

  getStatus(): DebugOverlayStatus;
  getSnapshot(): DebugOverlaySnapshot;

  dispose(reason?: string): void;
}

const DEBUG_OVERLAY_KIND = "vectoplan-editor-debug-overlay.v1" as const;
const DEBUG_OVERLAY_SNAPSHOT_KIND = "debug-overlay-snapshot.v1" as const;
const DEBUG_OVERLAY_ELEMENT_DATASET_KEY = "editorDebugOverlay";
const DEFAULT_MAX_ERRORS = 6;
const DEFAULT_MAX_WARNINGS = 8;
const DEFAULT_MAX_LINES = 72;
const DEFAULT_RENDER_INTERVAL_MS = 120;

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

function nowMs(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
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
    // Debug overlay logging must never break UI rendering.
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
    // Debug overlay logging must never break UI rendering.
  }
}

function formatNumber(value: unknown, digits = 2): string {
  try {
    const numeric = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numeric)) {
      return "0";
    }

    return numeric.toFixed(digits);
  } catch {
    return "0";
  }
}

function stringifyError(error: ChunkApiErrorDetails): string {
  try {
    return [
      error.code,
      error.statusCode === null ? null : `HTTP ${error.statusCode}`,
      error.requestKind,
      error.message,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
  } catch {
    return "Unbekannter Fehler";
  }
}

function compactPreview(value: unknown, maxLength = 180): string {
  try {
    const preview = previewValue(value, maxLength);
    const serialized = typeof preview === "string" ? preview : JSON.stringify(preview);

    if (!serialized) {
      return "";
    }

    return serialized.length > maxLength
      ? `${serialized.slice(0, Math.max(1, maxLength - 1))}…`
      : serialized;
  } catch {
    return "";
  }
}

function createOverlayElement(refs: EditorDomRefs): HTMLElement {
  const existing = refs.root.querySelector<HTMLElement>("[data-editor-debug-overlay]");

  if (existing) {
    return existing;
  }

  const element = document.createElement("aside");
  element.dataset[DEBUG_OVERLAY_ELEMENT_DATASET_KEY] = "true";
  element.dataset.debugOverlayKind = DEBUG_OVERLAY_KIND;
  element.dataset.debugOverlayInventoryTruth = "/editor/api/inventory";
  element.dataset.debugOverlayLibraryAware = "true";
  element.dataset.debugGrassDirtAllowed = "false";
  element.setAttribute("aria-label", "Editor Debug Overlay");
  element.setAttribute("role", "status");
  element.style.position = "absolute";
  element.style.left = "16px";
  element.style.bottom = "88px";
  element.style.zIndex = "30";
  element.style.width = "min(620px, calc(100vw - 32px))";
  element.style.maxHeight = "min(62vh, 620px)";
  element.style.overflow = "auto";
  element.style.padding = "12px";
  element.style.border = "1px solid rgba(148, 163, 184, 0.24)";
  element.style.borderRadius = "14px";
  element.style.background = "rgba(2, 6, 23, 0.86)";
  element.style.backdropFilter = "blur(14px)";
  element.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.35)";
  element.style.color = "var(--vp-text, #e5e7eb)";
  element.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  element.style.fontSize = "11px";
  element.style.lineHeight = "1.45";
  element.hidden = true;

  const main = refs.main ?? refs.root;
  main.appendChild(element);

  return element;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  try {
    if (!element) {
      return;
    }

    element.hidden = hidden;

    if (hidden) {
      element.setAttribute("hidden", "");
      element.setAttribute("aria-hidden", "true");
    } else {
      element.removeAttribute("hidden");
      element.setAttribute("aria-hidden", "false");
    }
  } catch {
    // Visibility updates must not throw.
  }
}

function setDatasetValue(element: HTMLElement | null, key: string, value: unknown): void {
  try {
    if (!element) {
      return;
    }

    if (value === undefined || value === null) {
      delete element.dataset[key];
      return;
    }

    element.dataset[key] = String(value);
  } catch {
    // Dataset is diagnostic-only.
  }
}

function normalizeStringList(values: readonly unknown[], limit = 12): readonly string[] {
  try {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const normalized = safeString(value, "").trim();

      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(normalized);

      if (result.length >= limit) {
        break;
      }
    }

    return result;
  } catch {
    return [];
  }
}

function createLine(label: string, value: unknown): string {
  const normalizedLabel = safeString(label, "debug");
  const normalizedValue =
    typeof value === "string"
      ? value
      : compactPreview(value, 240);

  return `${normalizedLabel}: ${normalizedValue}`;
}

function commandField(command: EditorInventoryPlacementCommand | null, key: string): string | null {
  try {
    if (!command || typeof command !== "object") {
      return null;
    }

    const value = (command as unknown as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

function libraryRefSummary(libraryRef: EditorInventoryLibraryRef | null): string {
  try {
    if (!libraryRef) {
      return "—";
    }

    return [
      libraryRef.source ?? "library",
      libraryRef.kind ?? "vplib",
      libraryRef.familyId ? `family=${libraryRef.familyId}` : null,
      libraryRef.packageId ? `package=${libraryRef.packageId}` : null,
      libraryRef.vplibUid ? `vplib=${libraryRef.vplibUid}` : null,
      libraryRef.variantId ? `variant=${libraryRef.variantId}` : null,
      libraryRef.revisionHash ? `rev=${libraryRef.revisionHash}` : null,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
  } catch {
    return "—";
  }
}

function placementCommandSummary(command: EditorInventoryPlacementCommand | null): string {
  try {
    if (!command) {
      return "—";
    }

    const kind = commandField(command, "kind") ?? "PlaceLibraryItem";
    const source = commandField(command, "source") ?? "vectoplan-library";
    const runtimeBlockTypeId =
      commandField(command, "runtimeBlockTypeId")
      ?? commandField(command, "runtime_block_type_id")
      ?? commandField(command, "blockTypeId")
      ?? commandField(command, "block_type_id");

    return [
      kind,
      source,
      runtimeBlockTypeId ? `runtime=${runtimeBlockTypeId}` : null,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
  } catch {
    return "—";
  }
}

function buildLines(
  viewModel: DebugOverlayViewModel,
  maxLines: number,
): readonly string[] {
  const inventory = viewModel.inventory;
  const creativeLibrary = viewModel.creativeLibrary;

  const lines: string[] = [
    createLine("Status", viewModel.statusLine),
    createLine("Lifecycle", viewModel.lifecycleStatus),
    createLine("World", viewModel.worldStatus),
    createLine("Command", viewModel.commandStatus),
    createLine("Target", viewModel.targetStatus),
    createLine("Ready", viewModel.ready ? "true" : `false (${viewModel.blockingReason ?? "unknown"})`),
    createLine("Chunks", `loaded=${viewModel.loadedChunkCount} visible=${viewModel.visibleChunkCount} dirty=${viewModel.dirtyChunkCount}`),
    createLine(
      "Inventory",
      `status=${inventory.status} source=${inventory.source} items=${inventory.itemCount} library=${inventory.libraryItemCount} hotbar=${inventory.hotbarSlotCount}`,
    ),
    createLine(
      "Selected",
      [
        `slot=${inventory.selectedSlotIndex}`,
        `runtime=${inventory.selectedRuntimeBlockTypeId ?? "—"}`,
        `label=${inventory.selectedLabel ?? "—"}`,
        `kind=${inventory.selectedItemKind ?? "—"}`,
        `source=${inventory.selectedSourceKind ?? "—"}`,
      ].join(" "),
    ),
    createLine(
      "Library identity",
      [
        `libraryItem=${inventory.selectedLibraryItemId ?? "—"}`,
        `family=${inventory.selectedFamilyId ?? "—"}`,
        `package=${inventory.selectedPackageId ?? "—"}`,
        `vplib=${inventory.selectedVplibUid ?? "—"}`,
        `variant=${inventory.selectedVariantId ?? "—"}`,
        `rev=${inventory.selectedRevisionHash ?? "—"}`,
      ].join(" "),
    ),
    createLine("LibraryRef", libraryRefSummary(inventory.selectedLibraryRef)),
    createLine("PlacementCommand", placementCommandSummary(inventory.selectedPlacementCommand)),
    createLine(
      "Inventory rules",
      `onlyLibrary=${inventory.onlyLibraryItemsPlaceable} debugGrassDirt=${inventory.debugGrassDirtAllowed} forbiddenDebugIds=${inventory.hasForbiddenDebugBlockIds}`,
    ),
    createLine("Runtime IDs", inventory.runtimeBlockTypeIds.length > 0 ? inventory.runtimeBlockTypeIds.join(", ") : "—"),
    createLine("Family IDs", inventory.familyIds.length > 0 ? inventory.familyIds.join(", ") : "—"),
    createLine("VPLIB UIDs", inventory.vplibUids.length > 0 ? inventory.vplibUids.join(", ") : "—"),
    createLine(
      "Creative Library",
      `status=${creativeLibrary.status} source=${creativeLibrary.source} items=${creativeLibrary.itemCount} total=${creativeLibrary.totalCount}`,
    ),
    createLine("Creative Categories", creativeLibrary.categoryIds.length > 0 ? creativeLibrary.categoryIds.join(", ") : "—"),
    createLine(
      "Camera",
      `x=${formatNumber(viewModel.camera.x)} y=${formatNumber(viewModel.camera.y)} z=${formatNumber(viewModel.camera.z)} yaw=${formatNumber(viewModel.camera.yaw)} pitch=${formatNumber(viewModel.camera.pitch)}`,
    ),
  ];

  if (viewModel.lastAction) {
    lines.push(createLine("Last action", viewModel.lastAction));
  }

  for (const warning of viewModel.warnings) {
    lines.push(createLine("Warning", warning));
  }

  for (const error of viewModel.errors) {
    lines.push(createLine("Error", stringifyError(error)));
  }

  return lines.slice(0, maxLines);
}

function hasForbiddenDebugBlocks(state: EditorState): boolean {
  try {
    const serialized = JSON.stringify({
      inventory: state.inventory,
      creativeLibrary: state.creativeLibrary,
    });

    return FORBIDDEN_DEBUG_BLOCK_TYPE_IDS.some((id) => serialized.includes(id));
  } catch {
    return false;
  }
}

function createInventoryViewModel(state: EditorState): DebugOverlayInventoryViewModel {
  try {
    const summary = selectInventorySummary(state);
    const selectedItem = selectSelectedInventoryItem(state);
    const selectedLibraryRef = selectSelectedLibraryRef(state);
    const selectedPlacementCommand = selectSelectedPlacementCommand(state);
    const hotbarSlots = selectInventoryHotbarSlots(state);

    return {
      status: summary.status,
      source: summary.source,
      itemCount: summary.itemCount,
      libraryItemCount: summary.libraryItemCount,
      hotbarSlotCount: hotbarSlots.length || summary.hotbarSlotCount,
      selectedSlotIndex: selectSelectedSlotIndex(state),
      selectedRuntimeBlockTypeId: selectSelectedRuntimeBlockTypeId(state),
      selectedLibraryItemId: selectSelectedLibraryItemId(state),
      selectedFamilyId: selectSelectedFamilyId(state),
      selectedPackageId: selectSelectedPackageId(state),
      selectedVplibUid: selectSelectedVplibUid(state),
      selectedVariantId: selectSelectedVariantId(state),
      selectedRevisionHash: selectSelectedRevisionHash(state),
      selectedLabel: selectedItem?.label ?? null,
      selectedItemKind: selectedItem?.kind ?? null,
      selectedSourceKind: selectedItem?.sourceKind ?? null,
      selectedLibraryRef,
      selectedPlacementCommand,
      selectedPlacementCommandKind: commandField(selectedPlacementCommand, "kind"),
      selectedPlacementCommandSource: commandField(selectedPlacementCommand, "source"),
      runtimeBlockTypeIds: normalizeStringList(summary.runtimeBlockTypeIds, 12),
      libraryItemIds: normalizeStringList(summary.libraryItemIds, 12),
      familyIds: normalizeStringList(summary.familyIds, 12),
      vplibUids: normalizeStringList(summary.vplibUids, 12),
      onlyLibraryItemsPlaceable: summary.onlyLibraryItemsPlaceable,
      debugGrassDirtAllowed: false,
      hasForbiddenDebugBlockIds: hasForbiddenDebugBlocks(state),
    };
  } catch {
    return {
      status: "unknown",
      source: "unknown",
      itemCount: 0,
      libraryItemCount: 0,
      hotbarSlotCount: 0,
      selectedSlotIndex: 0,
      selectedRuntimeBlockTypeId: null,
      selectedLibraryItemId: null,
      selectedFamilyId: null,
      selectedPackageId: null,
      selectedVplibUid: null,
      selectedVariantId: null,
      selectedRevisionHash: null,
      selectedLabel: null,
      selectedItemKind: null,
      selectedSourceKind: null,
      selectedLibraryRef: null,
      selectedPlacementCommand: null,
      selectedPlacementCommandKind: null,
      selectedPlacementCommandSource: null,
      runtimeBlockTypeIds: [],
      libraryItemIds: [],
      familyIds: [],
      vplibUids: [],
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      hasForbiddenDebugBlockIds: false,
    };
  }
}

function createCreativeLibraryViewModel(state: EditorState): DebugOverlayCreativeLibraryViewModel {
  try {
    const summary = selectCreativeLibrarySummary(state);

    return {
      status: summary.status,
      source: summary.source,
      itemCount: summary.itemCount,
      totalCount: summary.totalCount,
      runtimeBlockTypeIds: normalizeStringList(summary.runtimeBlockTypeIds, 12),
      libraryItemIds: normalizeStringList(summary.libraryItemIds, 12),
      familyIds: normalizeStringList(summary.familyIds, 12),
      vplibUids: normalizeStringList(summary.vplibUids, 12),
      categoryIds: normalizeStringList(summary.categoryIds, 12),
      lastLoadedAt: summary.lastLoadedAt,
      lastErrorMessage: summary.lastError?.message ?? null,
    };
  } catch {
    return {
      status: "unknown",
      source: "unknown",
      itemCount: 0,
      totalCount: 0,
      runtimeBlockTypeIds: [],
      libraryItemIds: [],
      familyIds: [],
      vplibUids: [],
      categoryIds: [],
      lastLoadedAt: null,
      lastErrorMessage: null,
    };
  }
}

function createViewModel(
  state: EditorState,
  input: {
    readonly visible: boolean;
    readonly maxErrors: number;
    readonly maxWarnings: number;
    readonly maxLines: number;
  },
): DebugOverlayViewModel {
  try {
    const world = selectWorldSourceSummary(state);
    const command = selectCommandSummary(state);
    const target = selectTargetSummary(state);
    const readiness = selectRuntimeReadiness(state);
    const debug = selectDebugSummary(state);
    const camera = selectCamera(state);
    const errors = selectAllErrors(state).slice(0, input.maxErrors);
    const warnings = debug.warnings.slice(0, input.maxWarnings);
    const dirtyChunkKeys = selectDirtyChunkKeys(state);
    const inventoryItems = selectInventoryItems(state);
    const inventory = createInventoryViewModel(state);
    const creativeLibrary = createCreativeLibraryViewModel(state);

    const base: Omit<DebugOverlayViewModel, "lines"> = {
      visible: input.visible,
      statusLine: selectStatusLine(state),
      lifecycleStatus: state.lifecycle.status,
      worldStatus: world.status,
      commandStatus: command.status,
      targetStatus: target.status,
      ready: readiness.canInteract,
      blockingReason: readiness.blockingReason,
      loadedChunkCount: world.loadedChunkCount,
      visibleChunkCount: world.visibleChunkCount,
      dirtyChunkCount: dirtyChunkKeys.length,
      inventoryItemCount: inventoryItems.length,
      inventory,
      creativeLibrary,
      camera: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        pitch: camera.rotation.pitch,
        yaw: camera.rotation.yaw,
        roll: camera.rotation.roll,
      },
      warnings,
      errors,
      lastAction: debug.lastAction,
      updatedAt: now(),
    };

    const withPlaceholderLines: DebugOverlayViewModel = {
      ...base,
      lines: [],
    };

    return {
      ...base,
      lines: buildLines(withPlaceholderLines, input.maxLines),
    };
  } catch (error) {
    const normalized = normalizeUnknownError(error);

    return {
      visible: input.visible,
      statusLine: "Debug-Status nicht verfügbar",
      lifecycleStatus: "unknown",
      worldStatus: "unknown",
      commandStatus: "unknown",
      targetStatus: "unknown",
      ready: false,
      blockingReason: "debug-overlay-selector-error",
      loadedChunkCount: 0,
      visibleChunkCount: 0,
      dirtyChunkCount: 0,
      inventoryItemCount: 0,
      inventory: {
        status: "unknown",
        source: "unknown",
        itemCount: 0,
        libraryItemCount: 0,
        hotbarSlotCount: 0,
        selectedSlotIndex: 0,
        selectedRuntimeBlockTypeId: null,
        selectedLibraryItemId: null,
        selectedFamilyId: null,
        selectedPackageId: null,
        selectedVplibUid: null,
        selectedVariantId: null,
        selectedRevisionHash: null,
        selectedLabel: null,
        selectedItemKind: null,
        selectedSourceKind: null,
        selectedLibraryRef: null,
        selectedPlacementCommand: null,
        selectedPlacementCommandKind: null,
        selectedPlacementCommandSource: null,
        runtimeBlockTypeIds: [],
        libraryItemIds: [],
        familyIds: [],
        vplibUids: [],
        onlyLibraryItemsPlaceable: true,
        debugGrassDirtAllowed: false,
        hasForbiddenDebugBlockIds: false,
      },
      creativeLibrary: {
        status: "unknown",
        source: "unknown",
        itemCount: 0,
        totalCount: 0,
        runtimeBlockTypeIds: [],
        libraryItemIds: [],
        familyIds: [],
        vplibUids: [],
        categoryIds: [],
        lastLoadedAt: null,
        lastErrorMessage: null,
      },
      camera: {
        x: 0,
        y: 0,
        z: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
      },
      warnings: [],
      errors: [],
      lastAction: null,
      lines: [`Debug overlay selector failed: ${normalized.message}`],
      updatedAt: now(),
    };
  }
}

function renderElement(element: HTMLElement, viewModel: DebugOverlayViewModel): void {
  try {
    element.textContent = "";
    element.dataset.debugOverlayUpdatedAt = viewModel.updatedAt;
    element.dataset.inventorySource = viewModel.inventory.source;
    element.dataset.inventoryStatus = viewModel.inventory.status;
    element.dataset.inventorySelectedRuntimeBlockTypeId = viewModel.inventory.selectedRuntimeBlockTypeId ?? "";
    element.dataset.inventorySelectedFamilyId = viewModel.inventory.selectedFamilyId ?? "";
    element.dataset.inventorySelectedPackageId = viewModel.inventory.selectedPackageId ?? "";
    element.dataset.inventorySelectedVplibUid = viewModel.inventory.selectedVplibUid ?? "";
    element.dataset.inventorySelectedVariantId = viewModel.inventory.selectedVariantId ?? "";
    element.dataset.inventoryLibraryItemCount = String(viewModel.inventory.libraryItemCount);
    element.dataset.creativeLibraryItemCount = String(viewModel.creativeLibrary.itemCount);
    element.dataset.debugGrassDirtAllowed = "false";

    const header = document.createElement("div");
    header.textContent = "VECTOPLAN DEBUG";
    header.style.fontWeight = "700";
    header.style.letterSpacing = "0.08em";
    header.style.marginBottom = "8px";
    header.style.color = "var(--vp-accent, #38bdf8)";
    element.appendChild(header);

    const meta = document.createElement("div");
    meta.textContent = "Inventory: /editor/api/inventory · User-Inventar/VPLIB · Abbauen immer verfügbar";
    meta.style.marginBottom = "8px";
    meta.style.color = "rgba(226, 232, 240, 0.72)";
    element.appendChild(meta);

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "3px";

    for (const line of viewModel.lines) {
      const row = document.createElement("div");
      row.textContent = line;
      row.style.whiteSpace = "pre-wrap";
      row.style.wordBreak = "break-word";

      if (line.startsWith("Error:")) {
        row.style.color = "#fecaca";
      } else if (line.startsWith("Warning:")) {
        row.style.color = "#fde68a";
      } else if (line.startsWith("Inventory:") || line.startsWith("Selected:") || line.startsWith("Library identity:")) {
        row.style.color = "#bae6fd";
      } else if (line.startsWith("PlacementCommand:") || line.startsWith("LibraryRef:")) {
        row.style.color = "#ddd6fe";
      }

      list.appendChild(row);
    }

    element.appendChild(list);
  } catch {
    // Debug render must not throw.
  }
}

function viewModelsEqual(left: DebugOverlayViewModel | null, right: DebugOverlayViewModel): boolean {
  try {
    if (!left) {
      return false;
    }

    return (
      left.visible === right.visible
      && left.statusLine === right.statusLine
      && left.lifecycleStatus === right.lifecycleStatus
      && left.worldStatus === right.worldStatus
      && left.commandStatus === right.commandStatus
      && left.targetStatus === right.targetStatus
      && left.ready === right.ready
      && left.blockingReason === right.blockingReason
      && left.loadedChunkCount === right.loadedChunkCount
      && left.visibleChunkCount === right.visibleChunkCount
      && left.dirtyChunkCount === right.dirtyChunkCount
      && left.inventoryItemCount === right.inventoryItemCount
      && left.inventory.status === right.inventory.status
      && left.inventory.source === right.inventory.source
      && left.inventory.itemCount === right.inventory.itemCount
      && left.inventory.libraryItemCount === right.inventory.libraryItemCount
      && left.inventory.hotbarSlotCount === right.inventory.hotbarSlotCount
      && left.inventory.selectedSlotIndex === right.inventory.selectedSlotIndex
      && left.inventory.selectedRuntimeBlockTypeId === right.inventory.selectedRuntimeBlockTypeId
      && left.inventory.selectedLibraryItemId === right.inventory.selectedLibraryItemId
      && left.inventory.selectedFamilyId === right.inventory.selectedFamilyId
      && left.inventory.selectedPackageId === right.inventory.selectedPackageId
      && left.inventory.selectedVplibUid === right.inventory.selectedVplibUid
      && left.inventory.selectedVariantId === right.inventory.selectedVariantId
      && left.inventory.selectedRevisionHash === right.inventory.selectedRevisionHash
      && left.inventory.selectedLabel === right.inventory.selectedLabel
      && left.creativeLibrary.status === right.creativeLibrary.status
      && left.creativeLibrary.itemCount === right.creativeLibrary.itemCount
      && left.creativeLibrary.totalCount === right.creativeLibrary.totalCount
      && left.lastAction === right.lastAction
      && left.lines.join("\n") === right.lines.join("\n")
    );
  } catch {
    return false;
  }
}

export function createDebugOverlay(options: DebugOverlayOptions): DebugOverlayHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;

  const createdAt = now();
  const maxErrors = safeInteger(options.maxErrors, DEFAULT_MAX_ERRORS, {
    min: 0,
    max: 50,
  });
  const maxWarnings = safeInteger(options.maxWarnings, DEFAULT_MAX_WARNINGS, {
    min: 0,
    max: 50,
  });
  const maxLines = safeInteger(options.maxLines, DEFAULT_MAX_LINES, {
    min: 8,
    max: 250,
  });
  const renderIntervalMs = safeInteger(options.renderIntervalMs, DEFAULT_RENDER_INTERVAL_MS, {
    min: 0,
    max: 5_000,
  });

  let status: DebugOverlayStatus = "created";
  let enabled = options.enabled ?? true;
  let visible = options.visible ?? false;
  let mounted = false;
  let disposed = false;
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let renderCount = 0;
  let showCount = 0;
  let hideCount = 0;
  let skippedRenderCount = 0;
  let lastRenderAt: string | null = null;
  let lastRenderAtMs = 0;
  let lastReason: string | null = null;
  let lastViewModel: DebugOverlayViewModel | null = null;
  let lastError: Record<string, unknown> | null = null;
  let unsubscribe: EditorStoreUnsubscribe | null = null;
  let overlayElement: HTMLElement | null = null;

  function setStatus(nextStatus: DebugOverlayStatus, reason?: string | null): void {
    status = nextStatus;
    updatedAt = now();
    lastReason = reason ?? lastReason;

    setDatasetValue(refs.root, "debugOverlayStatus", nextStatus);
    setDatasetValue(refs.root, "debugOverlayUpdatedAt", updatedAt);
    setDatasetValue(refs.root, "debugOverlayLibraryAware", "true");
    setDatasetValue(refs.root, "debugOverlayInventoryTruth", "/editor/api/inventory");
    setDatasetValue(refs.root, "debugGrassDirtAllowed", "false");
  }

  function setError(error: unknown): void {
    const normalized = normalizeUnknownError(error);
    lastError = normalized;
    setStatus("failed", safeString(normalized.message, "Debug overlay failed."));

    logWarn(logger, "Debug overlay failed.", {
      error: lastError,
    });
  }

  function assertAlive(action: string): boolean {
    if (disposed || status === "disposed") {
      logWarn(logger, "Debug overlay action ignored because handle is disposed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function shouldSkipRender(): boolean {
    if (renderIntervalMs <= 0) {
      return false;
    }

    const elapsed = nowMs() - lastRenderAtMs;
    return elapsed >= 0 && elapsed < renderIntervalMs;
  }

  function render(state?: EditorState, reason?: string): void {
    if (!assertAlive("render")) {
      return;
    }

    if (!enabled || !visible) {
      return;
    }

    if (shouldSkipRender()) {
      skippedRenderCount += 1;
      return;
    }

    try {
      overlayElement = overlayElement ?? createOverlayElement(refs);

      const currentState = state ?? store.peekState();
      const viewModel = createViewModel(currentState, {
        visible,
        maxErrors,
        maxWarnings,
        maxLines,
      });

      if (viewModelsEqual(lastViewModel, viewModel)) {
        skippedRenderCount += 1;
        return;
      }

      renderElement(overlayElement, viewModel);
      setHidden(overlayElement, false);

      lastViewModel = viewModel;
      renderCount += 1;
      lastRenderAt = now();
      lastRenderAtMs = nowMs();

      setStatus("visible", reason ?? "render");
      setDatasetValue(refs.root, "debugOverlayVisible", "true");
      setDatasetValue(refs.root, "debugOverlayRenderCount", renderCount);
      setDatasetValue(refs.root, "debugOverlaySkippedRenderCount", skippedRenderCount);
      setDatasetValue(refs.root, "debugOverlaySelectedRuntimeBlockTypeId", viewModel.inventory.selectedRuntimeBlockTypeId);
      setDatasetValue(refs.root, "debugOverlaySelectedFamilyId", viewModel.inventory.selectedFamilyId);
      setDatasetValue(refs.root, "debugOverlaySelectedVplibUid", viewModel.inventory.selectedVplibUid);
      setDatasetValue(refs.root, "debugOverlaySelectedVariantId", viewModel.inventory.selectedVariantId);

      logDebug(logger, "Debug overlay rendered.", {
        reason: reason ?? null,
        renderCount,
        lineCount: viewModel.lines.length,
        inventorySource: viewModel.inventory.source,
        selectedRuntimeBlockTypeId: viewModel.inventory.selectedRuntimeBlockTypeId,
        selectedFamilyId: viewModel.inventory.selectedFamilyId,
        selectedVplibUid: viewModel.inventory.selectedVplibUid,
      });
    } catch (error) {
      setError(error);
    }
  }

  function mount(): void {
    if (!assertAlive("mount")) {
      return;
    }

    if (mounted) {
      return;
    }

    try {
      overlayElement = createOverlayElement(refs);

      unsubscribe = store.subscribe((state) => {
        if (options.autoRender !== false) {
          render(state, "store-update");
        }
      });

      mounted = true;
      setHidden(overlayElement, !visible);
      setStatus(visible ? "visible" : "hidden", "mount");

      setDatasetValue(refs.root, "debugOverlayMounted", "true");
      setDatasetValue(refs.root, "debugOverlayEnabled", enabled ? "true" : "false");
      setDatasetValue(refs.root, "debugOverlayVisible", visible ? "true" : "false");
      setDatasetValue(refs.root, "debugOverlayLibraryAware", "true");
      setDatasetValue(refs.root, "debugOverlayInventoryTruth", "/editor/api/inventory");

      if (visible) {
        render(store.peekState(), "mount");
      }

      logDebug(logger, "Debug overlay mounted.", {
        enabled,
        visible,
        maxErrors,
        maxWarnings,
        maxLines,
        libraryAware: true,
      });
    } catch (error) {
      setError(error);
    }
  }

  function show(reason?: string): void {
    if (!assertAlive("show")) {
      return;
    }

    visible = true;
    showCount += 1;

    overlayElement = overlayElement ?? createOverlayElement(refs);
    setHidden(overlayElement, false);
    setStatus("visible", reason ?? "show");
    setDatasetValue(refs.root, "debugOverlayVisible", "true");

    render(store.peekState(), reason ?? "show");
  }

  function hide(reason?: string): void {
    if (!assertAlive("hide")) {
      return;
    }

    visible = false;
    hideCount += 1;

    setHidden(overlayElement, true);
    setStatus("hidden", reason ?? "hide");
    setDatasetValue(refs.root, "debugOverlayVisible", "false");

    logDebug(logger, "Debug overlay hidden.", {
      reason: reason ?? null,
    });
  }

  const handle: DebugOverlayHandle = {
    kind: DEBUG_OVERLAY_KIND,

    mount,
    render,
    show,
    hide,

    toggle(reason?: string): void {
      if (visible) {
        hide(reason ?? "toggle-hide");
      } else {
        show(reason ?? "toggle-show");
      }
    },

    setEnabled(nextEnabled: boolean, reason?: string): void {
      if (!assertAlive("setEnabled")) {
        return;
      }

      enabled = safeBoolean(nextEnabled, enabled);
      setDatasetValue(refs.root, "debugOverlayEnabled", enabled ? "true" : "false");

      if (!enabled) {
        hide(reason ?? "disabled");
        return;
      }

      if (visible) {
        show(reason ?? "enabled");
      } else {
        setStatus("hidden", reason ?? "enabled-hidden");
      }
    },

    getStatus(): DebugOverlayStatus {
      return status;
    },

    getSnapshot(): DebugOverlaySnapshot {
      return {
        kind: DEBUG_OVERLAY_SNAPSHOT_KIND,
        status,
        enabled,
        visible,
        mounted,
        disposed,
        createdAt,
        updatedAt,
        disposedAt,
        renderCount,
        showCount,
        hideCount,
        skippedRenderCount,
        lastRenderAt,
        lastReason,
        lastViewModel,
        lastError,
      };
    },

    dispose(reason?: string): void {
      if (disposed) {
        return;
      }

      disposed = true;
      disposedAt = now();

      try {
        unsubscribe?.();
        unsubscribe = null;
      } catch {
        // Ignore.
      }

      try {
        overlayElement?.remove();
        overlayElement = null;
      } catch {
        // Ignore.
      }

      mounted = false;
      setStatus("disposed", reason ?? "dispose");
      setDatasetValue(refs.root, "debugOverlayMounted", "false");
      setDatasetValue(refs.root, "debugOverlayDisposedAt", disposedAt);

      logDebug(logger, "Debug overlay disposed.", {
        reason: reason ?? null,
        renderCount,
        skippedRenderCount,
        showCount,
        hideCount,
      });
    },
  };

  if (enabled && options.autoMount !== false) {
    mount();
  }

  return handle;
}

export function isDebugOverlayHandle(value: unknown): value is DebugOverlayHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<DebugOverlayHandle>;

    return (
      record.kind === DEBUG_OVERLAY_KIND
      && typeof record.mount === "function"
      && typeof record.render === "function"
      && typeof record.dispose === "function"
    );
  } catch {
    return false;
  }
}

export function getDebugOverlayMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.ui.debug_overlay",
    overlayKind: DEBUG_OVERLAY_KIND,
    snapshotKind: DEBUG_OVERLAY_SNAPSHOT_KIND,
    supportsLibraryInventoryDiagnostics: true,
    supportsPlacementCommandDiagnostics: true,
    primaryInventoryRoute: "/editor/api/inventory",
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      displaysSelectedRuntimeBlockTypeId: true,
      displaysLibraryIdentity: true,
      displaysPlacementCommand: true,
      displaysCreativeLibrarySummary: true,
      debugGrassDirtAllowed: false,
      browserDoesNotCallVectoplanLibraryDirectly: true,
    },
  };
}