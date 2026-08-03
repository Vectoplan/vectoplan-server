// services/vectoplan-editor/src/frontend/ui/status_bar.ts
import type {
  EditorInventoryLibraryRef,
  EditorInventoryPlacementCommand,
} from "@api/editor_inventory_models";
import {
  FORBIDDEN_DEBUG_BLOCK_TYPE_IDS,
} from "@api/editor_inventory_models";
import {
  setDomLiveMessage,
  setDomProjectLabel,
  setDomSourceStatus,
  type EditorDomRefs,
  type EditorSourceStatusKind,
} from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeInteger, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore, EditorStoreUnsubscribe } from "@state/editor_store";
import type { EditorState } from "@state/editor_state";
import {
  selectActiveBlockLabel,
  selectActiveRuntimeBlockTypeId,
  selectCommandSummary,
  selectCreativeLibrarySummary,
  selectInventorySummary,
  selectRuntimeReadiness,
  selectSelectedFamilyId,
  selectSelectedInventoryItem,
  selectSelectedLibraryItemId,
  selectSelectedLibraryRef,
  selectSelectedPackageId,
  selectSelectedPlacementCommand,
  selectSelectedRevisionHash,
  selectSelectedSlot,
  selectSelectedVariantId,
  selectSelectedVplibUid,
  selectStatusLine,
  selectTargetSummary,
  selectWorldSourceSummary,
} from "@state/state_selectors";

export type StatusBarStatus =
  | "created"
  | "mounted"
  | "visible"
  | "hidden"
  | "failed"
  | "disposed";

export interface StatusBarOptions {
  readonly refs: EditorDomRefs;
  readonly store: EditorStore;
  readonly logger?: EditorLogger;
  readonly enabled?: boolean;
  readonly visible?: boolean;
  readonly autoMount?: boolean;
  readonly updateProjectLabel?: boolean;
  readonly updateSourceStatus?: boolean;
  readonly updateLiveRegion?: boolean;
  readonly compact?: boolean;
  readonly maxLabelLength?: number;
}

export interface StatusBarInventoryViewModel {
  readonly status: string;
  readonly source: string;
  readonly itemCount: number;
  readonly libraryItemCount: number;
  readonly creativeLibraryItemCount: number;
  readonly selectedSlot: number | null;
  readonly activeRuntimeBlockTypeId: string | null;
  readonly activeItemLabel: string | null;
  readonly selectedLibraryItemId: string | null;
  readonly selectedFamilyId: string | null;
  readonly selectedPackageId: string | null;
  readonly selectedVplibUid: string | null;
  readonly selectedVariantId: string | null;
  readonly selectedRevisionHash: string | null;
  readonly selectedItemKind: string | null;
  readonly selectedSourceKind: string | null;
  readonly selectedLibraryRef: EditorInventoryLibraryRef | null;
  readonly selectedPlacementCommand: EditorInventoryPlacementCommand | null;
  readonly selectedPlacementCommandKind: string | null;
  readonly onlyLibraryItemsPlaceable: boolean;
  readonly debugGrassDirtAllowed: false;
  readonly hasForbiddenDebugBlockIds: boolean;
}

export interface StatusBarViewModel {
  readonly projectId: string;
  readonly worldId: string;
  readonly sourceStatus: EditorSourceStatusKind;
  readonly sourceLabel: string;
  readonly statusLine: string;
  readonly selectedSlot: number | null;

  /**
   * Legacy alias for older DOM integrations.
   * For Library/VPLIB inventory this is the selected runtimeBlockTypeId.
   */
  readonly activeBlockTypeId: string | null;

  readonly activeRuntimeBlockTypeId: string | null;
  readonly activeBlockLabel: string | null;
  readonly activeItemLabel: string | null;
  readonly inventory: StatusBarInventoryViewModel;
  readonly targetStatus: string;
  readonly commandStatus: string;
  readonly dirtyChunkCount: number;
  readonly ready: boolean;
  readonly blockingReason: string | null;
  readonly updatedAt: string;
}

export interface StatusBarSnapshot {
  readonly kind: "status-bar-snapshot.v1";
  readonly status: StatusBarStatus;
  readonly enabled: boolean;
  readonly visible: boolean;
  readonly mounted: boolean;
  readonly disposed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly renderCount: number;
  readonly skippedRenderCount: number;
  readonly showCount: number;
  readonly hideCount: number;
  readonly lastRenderAt: string | null;
  readonly lastReason: string | null;
  readonly lastViewModel: StatusBarViewModel | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface StatusBarHandle {
  readonly kind: "vectoplan-editor-status-bar.v1";

  mount(): void;
  render(state?: EditorState, reason?: string): void;
  show(reason?: string): void;
  hide(reason?: string): void;
  setEnabled(enabled: boolean, reason?: string): void;

  getStatus(): StatusBarStatus;
  getSnapshot(): StatusBarSnapshot;

  dispose(reason?: string): void;
}

const STATUS_BAR_KIND = "vectoplan-editor-status-bar.v1" as const;
const STATUS_BAR_SNAPSHOT_KIND = "status-bar-snapshot.v1" as const;

const DEFAULT_MAX_LABEL_LENGTH = 112;

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
    // Status-bar logging must never break UI rendering.
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
    // Status-bar logging must never break UI rendering.
  }
}

function truncate(value: unknown, maxLength: number): string {
  try {
    const normalized = safeString(value, "");
    const safeMaxLength = safeInteger(maxLength, DEFAULT_MAX_LABEL_LENGTH, {
      min: 12,
      max: 500,
    });

    if (normalized.length <= safeMaxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(1, safeMaxLength - 1))}…`;
  } catch {
    return "";
  }
}

function nullableString(value: unknown): string | null {
  try {
    const normalized = safeString(value, "").trim();

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function mapWorldStatusToSourceStatus(status: string): EditorSourceStatusKind {
  switch (status) {
    case "ready":
      return "ready";

    case "connecting":
    case "unknown":
      return "connecting";

    case "degraded":
      return "degraded";

    case "failed":
      return "failed";

    case "offline":
      return "offline";

    default:
      return "unknown";
  }
}

function placementCommandStringField(
  command: EditorInventoryPlacementCommand | null,
  key: string,
): string | null {
  try {
    if (!command || typeof command !== "object") {
      return null;
    }

    const value = (command as unknown as Record<string, unknown>)[key];

    return nullableString(value);
  } catch {
    return null;
  }
}

function placementCommandKind(command: EditorInventoryPlacementCommand | null): string | null {
  return placementCommandStringField(command, "kind") ?? null;
}

function summarizeLibraryIdentity(input: {
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
}): string | null {
  try {
    const parts = [
      input.familyId ? `Family ${input.familyId}` : null,
      input.packageId ? `Package ${input.packageId}` : null,
      input.vplibUid ? `VPLIB ${input.vplibUid}` : null,
      input.variantId ? `Variant ${input.variantId}` : null,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    return parts.length > 0 ? parts.join(" · ") : null;
  } catch {
    return null;
  }
}

function labelForSourceStatus(input: {
  readonly sourceStatus: EditorSourceStatusKind;
  readonly ready: boolean;
  readonly blockingReason: string | null;
  readonly dirtyChunkCount: number;
  readonly inventory: StatusBarInventoryViewModel;
}): string {
  try {
    const inventoryReady = input.inventory.status === "ready" || input.inventory.libraryItemCount > 0;
    const selectedRuntime = input.inventory.activeRuntimeBlockTypeId;

    if (input.sourceStatus === "ready" && input.ready) {
      const suffix = [
        input.dirtyChunkCount > 0 ? `${input.dirtyChunkCount} dirty` : null,
        inventoryReady ? `${input.inventory.libraryItemCount} Library-Items` : "Inventory wird geladen",
        selectedRuntime ? `aktiv ${selectedRuntime}` : null,
      ].filter((value): value is string => Boolean(value));

      return suffix.length > 0
        ? `Chunk-Service verbunden · ${suffix.join(" · ")}`
        : "Chunk-Service verbunden";
    }

    if (input.sourceStatus === "ready" && !input.ready) {
      if (!inventoryReady) {
        return "Runtime wartet: Library-Inventar wird geladen";
      }

      return input.blockingReason
        ? `Runtime wartet: ${input.blockingReason}`
        : "Runtime wird vorbereitet";
    }

    if (input.sourceStatus === "connecting") {
      return "Chunk-Service wird verbunden · Library-Inventar wird vorbereitet";
    }

    if (input.sourceStatus === "degraded") {
      return inventoryReady
        ? "Chunk-Service eingeschränkt · Library-Inventar verfügbar"
        : "Chunk-Service eingeschränkt · Library-Inventar nicht bereit";
    }

    if (input.sourceStatus === "failed") {
      return "Chunk-Service fehlgeschlagen";
    }

    if (input.sourceStatus === "offline") {
      return "Chunk-Service offline";
    }

    return "Chunk-Service unbekannt";
  } catch {
    return "Status unbekannt";
  }
}

function buildStatusLine(input: {
  readonly compact: boolean;
  readonly statusLine: string;
  readonly inventory: StatusBarInventoryViewModel;
  readonly targetStatus: string;
  readonly commandStatus: string;
  readonly dirtyChunkCount: number;
}): string {
  try {
    if (!input.compact) {
      return input.statusLine;
    }

    const slot = input.inventory.selectedSlot === null ? "—" : String(input.inventory.selectedSlot + 1);
    const label =
      input.inventory.activeItemLabel
      ?? input.inventory.activeRuntimeBlockTypeId
      ?? "kein Library-/VPLIB-Item";
    const identity = summarizeLibraryIdentity({
      familyId: input.inventory.selectedFamilyId,
      packageId: input.inventory.selectedPackageId,
      vplibUid: input.inventory.selectedVplibUid,
      variantId: input.inventory.selectedVariantId,
    });

    return [
      `Slot ${slot}`,
      label,
      identity,
      input.inventory.activeRuntimeBlockTypeId ? `Runtime ${input.inventory.activeRuntimeBlockTypeId}` : null,
      `Target ${input.targetStatus}`,
      `Command ${input.commandStatus}`,
      `Dirty ${input.dirtyChunkCount}`,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
  } catch {
    return "Editor-Status nicht verfügbar";
  }
}

function hasForbiddenDebugBlockIds(state: EditorState): boolean {
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

function createInventoryViewModel(state: EditorState): StatusBarInventoryViewModel {
  try {
    const inventory = selectInventorySummary(state);
    const creativeLibrary = selectCreativeLibrarySummary(state);
    const selectedItem = selectSelectedInventoryItem(state);
    const selectedLibraryRef = selectSelectedLibraryRef(state);
    const selectedPlacementCommand = selectSelectedPlacementCommand(state);
    const activeRuntimeBlockTypeId = selectActiveRuntimeBlockTypeId(state);

    return {
      status: inventory.status,
      source: inventory.source,
      itemCount: inventory.itemCount,
      libraryItemCount: inventory.libraryItemCount,
      creativeLibraryItemCount: creativeLibrary.itemCount,
      selectedSlot: selectSelectedSlot(state),
      activeRuntimeBlockTypeId,
      activeItemLabel: selectActiveBlockLabel(state) ?? selectedItem?.label ?? null,
      selectedLibraryItemId: selectSelectedLibraryItemId(state),
      selectedFamilyId: selectSelectedFamilyId(state),
      selectedPackageId: selectSelectedPackageId(state),
      selectedVplibUid: selectSelectedVplibUid(state),
      selectedVariantId: selectSelectedVariantId(state),
      selectedRevisionHash: selectSelectedRevisionHash(state),
      selectedItemKind: selectedItem?.kind ?? null,
      selectedSourceKind: selectedItem?.sourceKind ?? null,
      selectedLibraryRef,
      selectedPlacementCommand,
      selectedPlacementCommandKind: placementCommandKind(selectedPlacementCommand),
      onlyLibraryItemsPlaceable: inventory.onlyLibraryItemsPlaceable,
      debugGrassDirtAllowed: false,
      hasForbiddenDebugBlockIds: hasForbiddenDebugBlockIds(state),
    };
  } catch {
    return {
      status: "unknown",
      source: "unknown",
      itemCount: 0,
      libraryItemCount: 0,
      creativeLibraryItemCount: 0,
      selectedSlot: null,
      activeRuntimeBlockTypeId: null,
      activeItemLabel: null,
      selectedLibraryItemId: null,
      selectedFamilyId: null,
      selectedPackageId: null,
      selectedVplibUid: null,
      selectedVariantId: null,
      selectedRevisionHash: null,
      selectedItemKind: null,
      selectedSourceKind: null,
      selectedLibraryRef: null,
      selectedPlacementCommand: null,
      selectedPlacementCommandKind: null,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      hasForbiddenDebugBlockIds: false,
    };
  }
}

function createViewModel(
  state: EditorState,
  options: {
    readonly compact: boolean;
    readonly maxLabelLength: number;
  },
): StatusBarViewModel {
  try {
    const world = selectWorldSourceSummary(state);
    const readiness = selectRuntimeReadiness(state);
    const command = selectCommandSummary(state);
    const target = selectTargetSummary(state);
    const inventory = createInventoryViewModel(state);
    const sourceStatus = mapWorldStatusToSourceStatus(world.status);

    const sourceLabel = labelForSourceStatus({
      sourceStatus,
      ready: readiness.canInteract,
      blockingReason: readiness.blockingReason,
      dirtyChunkCount: world.dirtyChunkCount,
      inventory,
    });

    const fullStatusLine = selectStatusLine(state);
    const statusLine = buildStatusLine({
      compact: options.compact,
      statusLine: fullStatusLine,
      inventory,
      targetStatus: target.status,
      commandStatus: command.status,
      dirtyChunkCount: world.dirtyChunkCount,
    });

    return {
      projectId: truncate(world.projectId, options.maxLabelLength),
      worldId: truncate(world.worldId, options.maxLabelLength),
      sourceStatus,
      sourceLabel: truncate(sourceLabel, options.maxLabelLength),
      statusLine: truncate(statusLine, options.maxLabelLength * 2),
      selectedSlot: inventory.selectedSlot,
      activeBlockTypeId: inventory.activeRuntimeBlockTypeId,
      activeRuntimeBlockTypeId: inventory.activeRuntimeBlockTypeId,
      activeBlockLabel: inventory.activeItemLabel,
      activeItemLabel: inventory.activeItemLabel,
      inventory,
      targetStatus: target.status,
      commandStatus: command.status,
      dirtyChunkCount: world.dirtyChunkCount,
      ready: readiness.canInteract,
      blockingReason: readiness.blockingReason,
      updatedAt: now(),
    };
  } catch {
    const fallbackInventory: StatusBarInventoryViewModel = {
      status: "unknown",
      source: "unknown",
      itemCount: 0,
      libraryItemCount: 0,
      creativeLibraryItemCount: 0,
      selectedSlot: null,
      activeRuntimeBlockTypeId: null,
      activeItemLabel: null,
      selectedLibraryItemId: null,
      selectedFamilyId: null,
      selectedPackageId: null,
      selectedVplibUid: null,
      selectedVariantId: null,
      selectedRevisionHash: null,
      selectedItemKind: null,
      selectedSourceKind: null,
      selectedLibraryRef: null,
      selectedPlacementCommand: null,
      selectedPlacementCommandKind: null,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
      hasForbiddenDebugBlockIds: false,
    };

    return {
      projectId: "dev-project",
      worldId: "world_spawn",
      sourceStatus: "unknown",
      sourceLabel: "Status unbekannt",
      statusLine: "Editor-Status nicht verfügbar",
      selectedSlot: null,
      activeBlockTypeId: null,
      activeRuntimeBlockTypeId: null,
      activeBlockLabel: null,
      activeItemLabel: null,
      inventory: fallbackInventory,
      targetStatus: "unknown",
      commandStatus: "idle",
      dirtyChunkCount: 0,
      ready: false,
      blockingReason: "status-bar-selector-error",
      updatedAt: now(),
    };
  }
}

function setText(element: HTMLElement | null, value: unknown): void {
  try {
    if (!element) {
      return;
    }

    element.textContent = typeof value === "string" ? value : String(value ?? "");
  } catch {
    // UI text updates must not throw.
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
    // UI visibility updates must not throw.
  }
}

function applyInventoryDataset(
  refs: EditorDomRefs,
  viewModel: StatusBarViewModel,
): void {
  const inventory = viewModel.inventory;

  setDatasetValue(refs.root, "activeBlockTypeId", viewModel.activeRuntimeBlockTypeId);
  setDatasetValue(refs.root, "activeRuntimeBlockTypeId", viewModel.activeRuntimeBlockTypeId);
  setDatasetValue(refs.root, "activeBlockLabel", viewModel.activeItemLabel);
  setDatasetValue(refs.root, "activeItemLabel", viewModel.activeItemLabel);
  setDatasetValue(refs.root, "selectedSlot", viewModel.selectedSlot);

  setDatasetValue(refs.root, "selectedLibraryItemId", inventory.selectedLibraryItemId);
  setDatasetValue(refs.root, "selectedFamilyId", inventory.selectedFamilyId);
  setDatasetValue(refs.root, "selectedPackageId", inventory.selectedPackageId);
  setDatasetValue(refs.root, "selectedVplibUid", inventory.selectedVplibUid);
  setDatasetValue(refs.root, "selectedVariantId", inventory.selectedVariantId);
  setDatasetValue(refs.root, "selectedRevisionHash", inventory.selectedRevisionHash);
  setDatasetValue(refs.root, "selectedItemKind", inventory.selectedItemKind);
  setDatasetValue(refs.root, "selectedSourceKind", inventory.selectedSourceKind);
  setDatasetValue(refs.root, "selectedPlacementCommandKind", inventory.selectedPlacementCommandKind);

  setDatasetValue(refs.root, "inventoryStatus", inventory.status);
  setDatasetValue(refs.root, "inventorySource", inventory.source);
  setDatasetValue(refs.root, "inventoryItemCount", inventory.itemCount);
  setDatasetValue(refs.root, "inventoryLibraryItemCount", inventory.libraryItemCount);
  setDatasetValue(refs.root, "creativeLibraryItemCount", inventory.creativeLibraryItemCount);
  setDatasetValue(refs.root, "inventoryOnlyLibraryItemsPlaceable", inventory.onlyLibraryItemsPlaceable ? "true" : "false");
  setDatasetValue(refs.root, "inventoryDebugGrassDirtAllowed", "false");
  setDatasetValue(refs.root, "inventoryHasForbiddenDebugBlockIds", inventory.hasForbiddenDebugBlockIds ? "true" : "false");

  setDatasetValue(refs.sourceStatus, "activeRuntimeBlockTypeId", viewModel.activeRuntimeBlockTypeId);
  setDatasetValue(refs.sourceStatus, "selectedFamilyId", inventory.selectedFamilyId);
  setDatasetValue(refs.sourceStatus, "selectedPackageId", inventory.selectedPackageId);
  setDatasetValue(refs.sourceStatus, "selectedVplibUid", inventory.selectedVplibUid);
  setDatasetValue(refs.sourceStatus, "selectedVariantId", inventory.selectedVariantId);
  setDatasetValue(refs.sourceStatus, "inventorySource", inventory.source);
  setDatasetValue(refs.sourceStatus, "inventoryStatus", inventory.status);
}

function applyViewModelToDom(
  refs: EditorDomRefs,
  viewModel: StatusBarViewModel,
  options: {
    readonly updateProjectLabel: boolean;
    readonly updateSourceStatus: boolean;
    readonly updateLiveRegion: boolean;
  },
): void {
  try {
    if (options.updateProjectLabel) {
      setDomProjectLabel(refs, viewModel.projectId, viewModel.worldId);
    }

    if (options.updateSourceStatus) {
      setDomSourceStatus(refs, {
        status: viewModel.sourceStatus,
        label: viewModel.sourceLabel,
        details: {
          ready: viewModel.ready,
          blockingReason: viewModel.blockingReason,
          dirtyChunkCount: viewModel.dirtyChunkCount,
          targetStatus: viewModel.targetStatus,
          commandStatus: viewModel.commandStatus,

          activeBlockTypeId: viewModel.activeRuntimeBlockTypeId,
          activeRuntimeBlockTypeId: viewModel.activeRuntimeBlockTypeId,
          activeItemLabel: viewModel.activeItemLabel,
          selectedSlot: viewModel.selectedSlot,

          inventoryStatus: viewModel.inventory.status,
          inventorySource: viewModel.inventory.source,
          inventoryItemCount: viewModel.inventory.itemCount,
          inventoryLibraryItemCount: viewModel.inventory.libraryItemCount,
          creativeLibraryItemCount: viewModel.inventory.creativeLibraryItemCount,
          selectedLibraryItemId: viewModel.inventory.selectedLibraryItemId,
          selectedFamilyId: viewModel.inventory.selectedFamilyId,
          selectedPackageId: viewModel.inventory.selectedPackageId,
          selectedVplibUid: viewModel.inventory.selectedVplibUid,
          selectedVariantId: viewModel.inventory.selectedVariantId,
          selectedRevisionHash: viewModel.inventory.selectedRevisionHash,
          selectedPlacementCommandKind: viewModel.inventory.selectedPlacementCommandKind,
          onlyLibraryItemsPlaceable: viewModel.inventory.onlyLibraryItemsPlaceable,
          debugGrassDirtAllowed: false,

          statusLine: viewModel.statusLine,
        },
      });
    }

    setText(refs.sourceStatusLabel, viewModel.sourceLabel);

    setDatasetValue(refs.sourceStatus, "statusLine", viewModel.statusLine);
    setDatasetValue(refs.sourceStatus, "targetStatus", viewModel.targetStatus);
    setDatasetValue(refs.sourceStatus, "commandStatus", viewModel.commandStatus);

    setDatasetValue(refs.root, "editorStatusLine", viewModel.statusLine);
    setDatasetValue(refs.root, "editorReady", viewModel.ready ? "true" : "false");
    setDatasetValue(refs.root, "editorBlockingReason", viewModel.blockingReason);
    setDatasetValue(refs.root, "targetStatus", viewModel.targetStatus);
    setDatasetValue(refs.root, "commandStatus", viewModel.commandStatus);
    setDatasetValue(refs.root, "dirtyChunkCount", viewModel.dirtyChunkCount);
    setDatasetValue(refs.root, "statusBarUpdatedAt", viewModel.updatedAt);
    setDatasetValue(refs.root, "statusBarLibraryAware", "true");
    setDatasetValue(refs.root, "statusBarInventoryTruth", "/editor/api/inventory");
    setDatasetValue(refs.root, "debugGrassDirtAllowed", "false");

    applyInventoryDataset(refs, viewModel);

    if (options.updateLiveRegion) {
      setDomLiveMessage(refs, viewModel.statusLine);
    }
  } catch {
    // DOM status updates must not throw.
  }
}

function viewModelsEqual(left: StatusBarViewModel | null, right: StatusBarViewModel): boolean {
  try {
    if (!left) {
      return false;
    }

    return (
      left.projectId === right.projectId
      && left.worldId === right.worldId
      && left.sourceStatus === right.sourceStatus
      && left.sourceLabel === right.sourceLabel
      && left.statusLine === right.statusLine
      && left.selectedSlot === right.selectedSlot
      && left.activeBlockTypeId === right.activeBlockTypeId
      && left.activeRuntimeBlockTypeId === right.activeRuntimeBlockTypeId
      && left.activeBlockLabel === right.activeBlockLabel
      && left.activeItemLabel === right.activeItemLabel
      && left.inventory.status === right.inventory.status
      && left.inventory.source === right.inventory.source
      && left.inventory.itemCount === right.inventory.itemCount
      && left.inventory.libraryItemCount === right.inventory.libraryItemCount
      && left.inventory.creativeLibraryItemCount === right.inventory.creativeLibraryItemCount
      && left.inventory.selectedLibraryItemId === right.inventory.selectedLibraryItemId
      && left.inventory.selectedFamilyId === right.inventory.selectedFamilyId
      && left.inventory.selectedPackageId === right.inventory.selectedPackageId
      && left.inventory.selectedVplibUid === right.inventory.selectedVplibUid
      && left.inventory.selectedVariantId === right.inventory.selectedVariantId
      && left.inventory.selectedRevisionHash === right.inventory.selectedRevisionHash
      && left.inventory.selectedPlacementCommandKind === right.inventory.selectedPlacementCommandKind
      && left.inventory.hasForbiddenDebugBlockIds === right.inventory.hasForbiddenDebugBlockIds
      && left.targetStatus === right.targetStatus
      && left.commandStatus === right.commandStatus
      && left.dirtyChunkCount === right.dirtyChunkCount
      && left.ready === right.ready
      && left.blockingReason === right.blockingReason
    );
  } catch {
    return false;
  }
}

export function createStatusBar(options: StatusBarOptions): StatusBarHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;

  const createdAt = now();

  const updateProjectLabel = safeBoolean(options.updateProjectLabel, true);
  const updateSourceStatus = safeBoolean(options.updateSourceStatus, true);
  const updateLiveRegion = safeBoolean(options.updateLiveRegion, false);
  const compact = safeBoolean(options.compact, true);
  const maxLabelLength = safeInteger(options.maxLabelLength, DEFAULT_MAX_LABEL_LENGTH, {
    min: 24,
    max: 500,
  });

  let status: StatusBarStatus = "created";
  let enabled = options.enabled ?? true;
  let visible = options.visible ?? true;
  let mounted = false;
  let disposed = false;
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let renderCount = 0;
  let skippedRenderCount = 0;
  let showCount = 0;
  let hideCount = 0;
  let lastRenderAt: string | null = null;
  let lastReason: string | null = null;
  let lastViewModel: StatusBarViewModel | null = null;
  let lastError: Record<string, unknown> | null = null;
  let unsubscribe: EditorStoreUnsubscribe | null = null;

  function setStatus(nextStatus: StatusBarStatus, reason?: string | null): void {
    status = nextStatus;
    updatedAt = now();
    lastReason = reason ?? lastReason;

    setDatasetValue(refs.root, "statusBarStatus", nextStatus);
    setDatasetValue(refs.root, "statusBarUpdatedAt", updatedAt);
    setDatasetValue(refs.root, "statusBarLibraryAware", "true");
    setDatasetValue(refs.root, "statusBarInventoryTruth", "/editor/api/inventory");
  }

  function setError(error: unknown): void {
    const normalized = normalizeUnknownError(error);
    lastError = normalized;
    setStatus("failed", safeString(normalized.message, "Status bar failed."));

    logWarn(logger, "Status bar failed.", {
      error: lastError,
    });
  }

  function assertAlive(action: string): boolean {
    if (disposed || status === "disposed") {
      logWarn(logger, "Status bar action ignored because handle is disposed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function render(state?: EditorState, reason?: string): void {
    if (!assertAlive("render")) {
      return;
    }

    if (!enabled || !visible) {
      return;
    }

    try {
      const currentState = state ?? store.peekState();
      const viewModel = createViewModel(currentState, {
        compact,
        maxLabelLength,
      });

      if (viewModelsEqual(lastViewModel, viewModel)) {
        skippedRenderCount += 1;
        return;
      }

      applyViewModelToDom(refs, viewModel, {
        updateProjectLabel,
        updateSourceStatus,
        updateLiveRegion,
      });

      lastViewModel = viewModel;
      renderCount += 1;
      lastRenderAt = now();
      setStatus("visible", reason ?? "render");

      logDebug(logger, "Status bar rendered.", {
        sourceStatus: viewModel.sourceStatus,
        ready: viewModel.ready,
        statusLine: viewModel.statusLine,
        activeRuntimeBlockTypeId: viewModel.activeRuntimeBlockTypeId,
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
      unsubscribe = store.subscribe((state) => {
        render(state, "store-update");
      });

      mounted = true;
      setStatus(visible ? "visible" : "hidden", "mount");
      setHidden(refs.topbar, !visible);
      render(store.peekState(), "mount");

      setDatasetValue(refs.root, "statusBarMounted", "true");
      setDatasetValue(refs.root, "statusBarVisible", visible ? "true" : "false");
      setDatasetValue(refs.root, "statusBarEnabled", enabled ? "true" : "false");
      setDatasetValue(refs.root, "statusBarLibraryAware", "true");
      setDatasetValue(refs.root, "statusBarInventoryTruth", "/editor/api/inventory");

      logDebug(logger, "Status bar mounted.", {
        enabled,
        visible,
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

    setHidden(refs.topbar, false);
    setStatus("visible", reason ?? "show");
    setDatasetValue(refs.root, "statusBarVisible", "true");

    render(store.peekState(), reason ?? "show");

    logDebug(logger, "Status bar shown.", {
      reason: reason ?? null,
    });
  }

  function hide(reason?: string): void {
    if (!assertAlive("hide")) {
      return;
    }

    visible = false;
    hideCount += 1;

    setHidden(refs.topbar, true);
    setStatus("hidden", reason ?? "hide");
    setDatasetValue(refs.root, "statusBarVisible", "false");

    logDebug(logger, "Status bar hidden.", {
      reason: reason ?? null,
    });
  }

  const handle: StatusBarHandle = {
    kind: STATUS_BAR_KIND,

    mount,
    render,
    show,
    hide,

    setEnabled(nextEnabled: boolean, reason?: string): void {
      if (!assertAlive("setEnabled")) {
        return;
      }

      enabled = safeBoolean(nextEnabled, enabled);
      setDatasetValue(refs.root, "statusBarEnabled", enabled ? "true" : "false");

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

    getStatus(): StatusBarStatus {
      return status;
    },

    getSnapshot(): StatusBarSnapshot {
      return {
        kind: STATUS_BAR_SNAPSHOT_KIND,
        status,
        enabled,
        visible,
        mounted,
        disposed,
        createdAt,
        updatedAt,
        disposedAt,
        renderCount,
        skippedRenderCount,
        showCount,
        hideCount,
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

      const disposeReason = safeString(reason, "dispose");

      disposed = true;
      disposedAt = now();

      try {
        unsubscribe?.();
        unsubscribe = null;
      } catch {
        // Ignore cleanup failure.
      }

      mounted = false;
      setStatus("disposed", disposeReason);

      setDatasetValue(refs.root, "statusBarMounted", "false");
      setDatasetValue(refs.root, "statusBarDisposedAt", disposedAt);

      logDebug(logger, "Status bar disposed.", {
        reason: disposeReason,
        renderCount,
        skippedRenderCount,
      });
    },
  };

  if (enabled && options.autoMount !== false) {
    mount();
  }

  return handle;
}

export function isStatusBarHandle(value: unknown): value is StatusBarHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<StatusBarHandle>;

    return (
      record.kind === STATUS_BAR_KIND
      && typeof record.mount === "function"
      && typeof record.render === "function"
      && typeof record.dispose === "function"
    );
  } catch {
    return false;
  }
}

export function getStatusBarMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.ui.status_bar",
    statusBarKind: STATUS_BAR_KIND,
    snapshotKind: STATUS_BAR_SNAPSHOT_KIND,
    supportsLibraryInventoryStatus: true,
    supportsRuntimeBlockTypeId: true,
    supportsLibraryIdentity: true,
    primaryInventoryRoute: "/editor/api/inventory",
    forbiddenDebugBlockTypeIds: [...FORBIDDEN_DEBUG_BLOCK_TYPE_IDS],
    rules: {
      activeBlockTypeIdAliasesRuntimeBlockTypeId: true,
      statusLineUsesLibraryVplibLabel: true,
      debugGrassDirtAllowed: false,
      browserDoesNotCallVectoplanLibraryDirectly: true,
    },
  };
}