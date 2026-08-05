// services/vectoplan-editor/src/frontend/ui/loading_overlay.ts
import {
  hideDomLoadingOverlay,
  setDomBootMessage,
  setDomLiveMessage,
  showDomLoadingOverlay,
  type EditorDomRefs,
} from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeInteger, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore, EditorStoreUnsubscribe } from "@state/editor_store";
import type { EditorState } from "@state/editor_state";
import {
  selectCreativeLibrarySummary,
  selectInventorySummary,
  selectLifecycleStatus,
  selectLoadingMessage,
  selectRuntimeReadiness,
  selectSelectedRuntimeBlockTypeId,
  selectShouldShowErrorOverlay,
  selectShouldShowLoadingOverlay,
  selectWorldConnectionStatus,
} from "@state/state_selectors";

export type LoadingOverlayStatus =
  | "created"
  | "mounted"
  | "visible"
  | "hidden"
  | "failed"
  | "disposed";

export type LoadingOverlayPhase =
  | "boot"
  | "bootstrap"
  | "api"
  | "world"
  | "scene"
  | "render"
  | "inventory"
  | "library"
  | "ready"
  | "error"
  | "unknown";

export interface LoadingOverlayViewModel {
  readonly visible: boolean;
  readonly phase: LoadingOverlayPhase;
  readonly message: string;
  readonly lifecycleStatus: string;
  readonly worldStatus: string;
  readonly inventoryStatus: string;
  readonly inventorySource: string;
  readonly inventoryItemCount: number;
  readonly libraryItemCount: number;
  readonly creativeLibraryStatus: string;
  readonly creativeLibraryItemCount: number;
  readonly selectedRuntimeBlockTypeId: string | null;
  readonly ready: boolean;
  readonly blockingReason: string | null;
  readonly progress: number | null;
  readonly updatedAt: string;
}

export interface LoadingOverlayOptions {
  readonly refs: EditorDomRefs;
  readonly store: EditorStore;
  readonly logger?: EditorLogger;
  readonly enabled?: boolean;
  readonly visible?: boolean;
  readonly autoMount?: boolean;
  readonly autoRender?: boolean;
  readonly updateLiveRegion?: boolean;
  readonly hideWhenErrorVisible?: boolean;
  readonly defaultMessage?: string;
  readonly minVisibleMs?: number;
  readonly maxMessageLength?: number;
}

export interface LoadingOverlayShowInput {
  readonly message?: string | null;
  readonly phase?: LoadingOverlayPhase;
  readonly progress?: number | null;
  readonly updateLiveRegion?: boolean;
}

export interface LoadingOverlaySnapshot {
  readonly kind: "loading-overlay-snapshot.v1";
  readonly status: LoadingOverlayStatus;
  readonly enabled: boolean;
  readonly visible: boolean;
  readonly mounted: boolean;
  readonly disposed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly firstShownAt: string | null;
  readonly lastShownAt: string | null;
  readonly lastHiddenAt: string | null;
  readonly renderCount: number;
  readonly skippedRenderCount: number;
  readonly showCount: number;
  readonly hideCount: number;
  readonly messageUpdateCount: number;
  readonly lastReason: string | null;
  readonly lastViewModel: LoadingOverlayViewModel | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface LoadingOverlayHandle {
  readonly kind: "vectoplan-editor-loading-overlay.v1";

  mount(): void;
  render(state?: EditorState, reason?: string): void;

  show(input?: LoadingOverlayShowInput): void;
  hide(reason?: string): void;
  setMessage(message: string, phase?: LoadingOverlayPhase): void;
  setProgress(progress: number | null): void;
  setEnabled(enabled: boolean, reason?: string): void;

  getStatus(): LoadingOverlayStatus;
  getSnapshot(): LoadingOverlaySnapshot;

  dispose(reason?: string): void;
}

const LOADING_OVERLAY_KIND = "vectoplan-editor-loading-overlay.v1" as const;
const LOADING_OVERLAY_SNAPSHOT_KIND = "loading-overlay-snapshot.v1" as const;

const DEFAULT_LOADING_MESSAGE = "Editor wird gestartet.";
const DEFAULT_MIN_VISIBLE_MS = 180;
const DEFAULT_MAX_MESSAGE_LENGTH = 220;
const INVENTORY_TRUTH_ROUTE = "/editor/api/inventory";

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

function elapsedMsSince(value: number | null): number {
  try {
    if (value === null || !Number.isFinite(value)) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, nowMs() - value);
  } catch {
    return Number.POSITIVE_INFINITY;
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
    // Loading overlay logging must never break UI rendering.
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
    // Loading overlay logging must never break UI rendering.
  }
}

function normalizePhase(value: unknown, fallback: LoadingOverlayPhase = "unknown"): LoadingOverlayPhase {
  const normalized = safeString(value, fallback);

  if (
    normalized === "boot"
    || normalized === "bootstrap"
    || normalized === "api"
    || normalized === "world"
    || normalized === "scene"
    || normalized === "render"
    || normalized === "inventory"
    || normalized === "library"
    || normalized === "ready"
    || normalized === "error"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeProgress(value: unknown): number | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    return safeNumber(value, 0, {
      min: 0,
      max: 1,
    });
  } catch {
    return null;
  }
}

function normalizeMessage(value: unknown, fallback: string, maxLength: number): string {
  try {
    const normalized = safeString(value, fallback);
    const safeMaxLength = safeInteger(maxLength, DEFAULT_MAX_MESSAGE_LENGTH, {
      min: 24,
      max: 2_000,
    });

    if (normalized.length <= safeMaxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(1, safeMaxLength - 1))}…`;
  } catch {
    return fallback;
  }
}

function inventoryReady(state: EditorState): boolean {
  try {
    const inventory = selectInventorySummary(state);

    return (
      inventory.status === "ready"
      && inventory.libraryItemCount > 0
      && inventory.selectedRuntimeBlockTypeId !== null
      && inventory.onlyLibraryItemsPlaceable === true
    );
  } catch {
    return false;
  }
}

function creativeLibraryReady(state: EditorState): boolean {
  try {
    const creativeLibrary = selectCreativeLibrarySummary(state);

    return creativeLibrary.status === "ready" || creativeLibrary.itemCount > 0;
  } catch {
    return false;
  }
}

function progressFromPhase(
  phase: LoadingOverlayPhase,
  lifecycleStatus: string,
  worldStatus: string,
  inventoryStatus: string,
): number | null {
  try {
    if (lifecycleStatus === "ready") {
      return 1;
    }

    if (lifecycleStatus === "failed") {
      return null;
    }

    if (inventoryStatus === "ready" && phase === "inventory") {
      return 0.9;
    }

    if (worldStatus === "ready" && phase === "scene") {
      return 0.78;
    }

    switch (phase) {
      case "boot":
        return 0.08;
      case "bootstrap":
        return 0.18;
      case "api":
        return 0.3;
      case "world":
        return 0.52;
      case "scene":
        return 0.72;
      case "render":
        return 0.82;
      case "inventory":
        return 0.88;
      case "library":
        return 0.92;
      case "ready":
        return 1;
      case "error":
      case "unknown":
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function phaseFromState(state: EditorState): LoadingOverlayPhase {
  try {
    const lifecycleStatus = selectLifecycleStatus(state);
    const worldStatus = selectWorldConnectionStatus(state);
    const readiness = selectRuntimeReadiness(state);
    const message = selectLoadingMessage(state)?.toLowerCase() ?? "";
    const inventory = selectInventorySummary(state);
    const creativeLibrary = selectCreativeLibrarySummary(state);

    if (lifecycleStatus === "failed") {
      return "error";
    }

    if (lifecycleStatus === "ready") {
      return "ready";
    }

    if (message.includes("bootstrap")) {
      return "bootstrap";
    }

    if (message.includes("api") || message.includes("client")) {
      return "api";
    }

    if (message.includes("library") || message.includes("vplib") || message.includes("creative")) {
      return "library";
    }

    if (
      message.includes("inventar")
      || message.includes("inventory")
      || message.includes("hotbar")
      || message.includes("blocktypen")
      || readiness.blockingReason?.startsWith("inventory")
      || inventory.status === "connecting"
      || (
        worldStatus === "ready"
        && inventory.libraryItemCount === 0
        && inventory.status !== "ready"
      )
    ) {
      return "inventory";
    }

    if (message.includes("world") || message.includes("welt") || worldStatus === "connecting") {
      return "world";
    }

    if (message.includes("scene")) {
      return "scene";
    }

    if (message.includes("render") || message.includes("three")) {
      return "render";
    }

    if (
      creativeLibrary.status === "connecting"
      || creativeLibrary.status === "unknown"
    ) {
      return "library";
    }

    if (
      lifecycleStatus === "created"
      || lifecycleStatus === "bootstrapping"
      || lifecycleStatus === "initializing"
      || lifecycleStatus === "loading"
    ) {
      return "boot";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function defaultMessageForPhase(phase: LoadingOverlayPhase, fallback: string): string {
  switch (phase) {
    case "bootstrap":
      return "Bootstrap wird gelesen.";
    case "api":
      return "Editor-API wird vorbereitet.";
    case "world":
      return "Chunk-Service und Welt werden geladen.";
    case "scene":
      return "Scene Runtime wird initialisiert.";
    case "render":
      return "Renderer wird vorbereitet.";
    case "inventory":
      return "Library-/VPLIB-Inventar wird geladen.";
    case "library":
      return "Creative Library wird geladen.";
    case "ready":
      return "Editor ist bereit.";
    case "error":
      return "Editor konnte nicht gestartet werden.";
    case "boot":
      return fallback;
    case "unknown":
    default:
      return fallback;
  }
}

function enrichMessageFromState(state: EditorState, phase: LoadingOverlayPhase, rawMessage: string, fallback: string): string {
  try {
    const inventory = selectInventorySummary(state);
    const creativeLibrary = selectCreativeLibrarySummary(state);
    const selectedRuntimeBlockTypeId = selectSelectedRuntimeBlockTypeId(state);

    if (
      phase === "inventory"
      && (
        !rawMessage
        || rawMessage === fallback
        || rawMessage.toLowerCase().includes("blocktypen")
      )
    ) {
      if (inventory.libraryItemCount > 0) {
        return selectedRuntimeBlockTypeId
          ? `Library-/VPLIB-Inventar bereit: ${inventory.libraryItemCount} Items · aktiv ${selectedRuntimeBlockTypeId}`
          : `Library-/VPLIB-Inventar bereit: ${inventory.libraryItemCount} Items.`;
      }

      return `Library-/VPLIB-Inventar wird über ${INVENTORY_TRUTH_ROUTE} geladen.`;
    }

    if (phase === "library" && (!rawMessage || rawMessage === fallback)) {
      if (creativeLibrary.itemCount > 0) {
        return `Creative Library bereit: ${creativeLibrary.itemCount} Items.`;
      }

      return "Creative Library wird geladen.";
    }

    return rawMessage;
  } catch {
    return rawMessage || fallback;
  }
}

function buildViewModelFromState(
  state: EditorState,
  input: {
    readonly defaultMessage: string;
    readonly maxMessageLength: number;
    readonly hideWhenErrorVisible: boolean;
  },
): LoadingOverlayViewModel {
  try {
    const lifecycleStatus = selectLifecycleStatus(state);
    const worldStatus = selectWorldConnectionStatus(state);
    const readiness = selectRuntimeReadiness(state);
    const errorVisible = selectShouldShowErrorOverlay(state);
    const shouldShowLoading = selectShouldShowLoadingOverlay(state);
    const phase = phaseFromState(state);
    const inventory = selectInventorySummary(state);
    const creativeLibrary = selectCreativeLibrarySummary(state);
    const selectedRuntimeBlockTypeId = selectSelectedRuntimeBlockTypeId(state);

    const fallbackMessage = defaultMessageForPhase(phase, input.defaultMessage);
    const rawMessage = selectLoadingMessage(state) ?? fallbackMessage;
    const enrichedMessage = enrichMessageFromState(state, phase, rawMessage, fallbackMessage);

    const visible = input.hideWhenErrorVisible && errorVisible
      ? false
      : shouldShowLoading && !readiness.canInteract;

    return {
      visible,
      phase,
      message: normalizeMessage(enrichedMessage, input.defaultMessage, input.maxMessageLength),
      lifecycleStatus,
      worldStatus,
      inventoryStatus: inventory.status,
      inventorySource: inventory.source,
      inventoryItemCount: inventory.itemCount,
      libraryItemCount: inventory.libraryItemCount,
      creativeLibraryStatus: creativeLibrary.status,
      creativeLibraryItemCount: creativeLibrary.itemCount,
      selectedRuntimeBlockTypeId,
      ready: readiness.canInteract,
      blockingReason: readiness.blockingReason,
      progress: progressFromPhase(phase, lifecycleStatus, worldStatus, inventory.status),
      updatedAt: now(),
    };
  } catch {
    return {
      visible: true,
      phase: "unknown",
      message: input.defaultMessage,
      lifecycleStatus: "unknown",
      worldStatus: "unknown",
      inventoryStatus: "unknown",
      inventorySource: "unknown",
      inventoryItemCount: 0,
      libraryItemCount: 0,
      creativeLibraryStatus: "unknown",
      creativeLibraryItemCount: 0,
      selectedRuntimeBlockTypeId: null,
      ready: false,
      blockingReason: "loading-overlay-selector-error",
      progress: null,
      updatedAt: now(),
    };
  }
}

function applyViewModelDetailsToDom(
  refs: EditorDomRefs,
  viewModel: LoadingOverlayViewModel,
  options: {
    readonly updateLiveRegion: boolean;
  },
): void {
  try {
    setDomBootMessage(refs, viewModel.message);

    if (options.updateLiveRegion) {
      setDomLiveMessage(refs, viewModel.message);
    }

    refs.root.dataset.loadingOverlayVisible = viewModel.visible ? "true" : "false";
    refs.root.dataset.loadingOverlayPhase = viewModel.phase;
    refs.root.dataset.loadingOverlayMessage = viewModel.message;
    refs.root.dataset.loadingOverlayUpdatedAt = viewModel.updatedAt;
    refs.root.dataset.loadingOverlayLifecycleStatus = viewModel.lifecycleStatus;
    refs.root.dataset.loadingOverlayWorldStatus = viewModel.worldStatus;
    refs.root.dataset.loadingOverlayInventoryStatus = viewModel.inventoryStatus;
    refs.root.dataset.loadingOverlayInventorySource = viewModel.inventorySource;
    refs.root.dataset.loadingOverlayInventoryItemCount = String(viewModel.inventoryItemCount);
    refs.root.dataset.loadingOverlayLibraryItemCount = String(viewModel.libraryItemCount);
    refs.root.dataset.loadingOverlayCreativeLibraryStatus = viewModel.creativeLibraryStatus;
    refs.root.dataset.loadingOverlayCreativeLibraryItemCount = String(viewModel.creativeLibraryItemCount);
    refs.root.dataset.loadingOverlaySelectedRuntimeBlockTypeId = viewModel.selectedRuntimeBlockTypeId ?? "";
    refs.root.dataset.loadingOverlayReady = viewModel.ready ? "true" : "false";
    refs.root.dataset.loadingOverlayInventoryTruth = INVENTORY_TRUTH_ROUTE;
    refs.root.dataset.loadingOverlayOnlyLibraryItemsPlaceable = "true";
    refs.root.dataset.loadingOverlayDebugGrassDirtAllowed = "false";

    if (viewModel.blockingReason) {
      refs.root.dataset.loadingOverlayBlockingReason = viewModel.blockingReason;
    } else {
      delete refs.root.dataset.loadingOverlayBlockingReason;
    }

    if (viewModel.progress === null) {
      delete refs.root.dataset.loadingOverlayProgress;
    } else {
      refs.root.dataset.loadingOverlayProgress = String(viewModel.progress);
    }

    if (refs.loadingOverlay) {
      refs.loadingOverlay.dataset.phase = viewModel.phase;
      refs.loadingOverlay.dataset.visible = viewModel.visible ? "true" : "false";
      refs.loadingOverlay.dataset.inventoryStatus = viewModel.inventoryStatus;
      refs.loadingOverlay.dataset.inventorySource = viewModel.inventorySource;
      refs.loadingOverlay.dataset.libraryItemCount = String(viewModel.libraryItemCount);
      refs.loadingOverlay.dataset.creativeLibraryItemCount = String(viewModel.creativeLibraryItemCount);
      refs.loadingOverlay.dataset.inventoryTruth = INVENTORY_TRUTH_ROUTE;

      if (viewModel.progress === null) {
        refs.loadingOverlay.removeAttribute("aria-valuenow");
      } else {
        refs.loadingOverlay.setAttribute("aria-valuenow", String(Math.round(viewModel.progress * 100)));
      }
    }

    if (refs.loadingText) {
      refs.loadingText.dataset.phase = viewModel.phase;
      refs.loadingText.dataset.inventoryStatus = viewModel.inventoryStatus;
      refs.loadingText.dataset.libraryItemCount = String(viewModel.libraryItemCount);
    }
  } catch {
    // Loading UI must never throw into runtime.
  }
}

function viewModelsEqual(left: LoadingOverlayViewModel | null, right: LoadingOverlayViewModel): boolean {
  try {
    if (!left) {
      return false;
    }

    return (
      left.visible === right.visible
      && left.phase === right.phase
      && left.message === right.message
      && left.lifecycleStatus === right.lifecycleStatus
      && left.worldStatus === right.worldStatus
      && left.inventoryStatus === right.inventoryStatus
      && left.inventorySource === right.inventorySource
      && left.inventoryItemCount === right.inventoryItemCount
      && left.libraryItemCount === right.libraryItemCount
      && left.creativeLibraryStatus === right.creativeLibraryStatus
      && left.creativeLibraryItemCount === right.creativeLibraryItemCount
      && left.selectedRuntimeBlockTypeId === right.selectedRuntimeBlockTypeId
      && left.ready === right.ready
      && left.blockingReason === right.blockingReason
      && left.progress === right.progress
    );
  } catch {
    return false;
  }
}

export function createLoadingOverlay(options: LoadingOverlayOptions): LoadingOverlayHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;

  const createdAt = now();
  const defaultMessage = normalizeMessage(
    options.defaultMessage,
    DEFAULT_LOADING_MESSAGE,
    DEFAULT_MAX_MESSAGE_LENGTH,
  );
  const minVisibleMs = safeInteger(options.minVisibleMs, DEFAULT_MIN_VISIBLE_MS, {
    min: 0,
    max: 10_000,
  });
  const maxMessageLength = safeInteger(options.maxMessageLength, DEFAULT_MAX_MESSAGE_LENGTH, {
    min: 24,
    max: 2_000,
  });
  const updateLiveRegion = safeBoolean(options.updateLiveRegion, true);
  const hideWhenErrorVisible = safeBoolean(options.hideWhenErrorVisible, true);
  const autoRender = safeBoolean(options.autoRender, true);

  let status: LoadingOverlayStatus = "created";
  let enabled = options.enabled ?? true;
  let visible = options.visible ?? true;
  let mounted = false;
  let disposed = false;
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let firstShownAt: string | null = visible ? createdAt : null;
  let lastShownAt: string | null = visible ? createdAt : null;
  let lastShownAtMs: number | null = visible ? nowMs() : null;
  let lastHiddenAt: string | null = null;
  let renderCount = 0;
  let skippedRenderCount = 0;
  let showCount = visible ? 1 : 0;
  let hideCount = 0;
  let messageUpdateCount = 0;
  let lastReason: string | null = null;
  let lastViewModel: LoadingOverlayViewModel | null = null;
  let lastError: Record<string, unknown> | null = null;
  let unsubscribe: EditorStoreUnsubscribe | null = null;
  let pendingHideTimerId: ReturnType<typeof setTimeout> | null = null;

  function setStatus(nextStatus: LoadingOverlayStatus, reason?: string | null): void {
    status = nextStatus;
    updatedAt = now();
    lastReason = reason ?? lastReason;

    refs.root.dataset.loadingOverlayStatus = nextStatus;
    refs.root.dataset.loadingOverlayStatusAt = updatedAt;
    refs.root.dataset.loadingOverlayInventoryTruth = INVENTORY_TRUTH_ROUTE;
    refs.root.dataset.loadingOverlayOnlyLibraryItemsPlaceable = "true";
    refs.root.dataset.loadingOverlayDebugGrassDirtAllowed = "false";
  }

  function setError(error: unknown): void {
    const normalized = normalizeUnknownError(error);
    lastError = normalized;
    setStatus("failed", safeString(normalized.message, "Loading overlay failed."));

    logWarn(logger, "Loading overlay failed.", {
      error: lastError,
    });
  }

  function clearPendingHide(): void {
    try {
      if (pendingHideTimerId !== null) {
        globalThis.clearTimeout(pendingHideTimerId);
        pendingHideTimerId = null;
      }
    } catch {
      pendingHideTimerId = null;
    }
  }

  function assertAlive(action: string): boolean {
    if (disposed || status === "disposed") {
      logWarn(logger, "Loading overlay action ignored because handle is disposed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function commitVisibleState(nextVisible: boolean, reason?: string): void {
    try {
      if (nextVisible) {
        clearPendingHide();

        visible = true;
        showCount += 1;

        const timestamp = now();
        firstShownAt = firstShownAt ?? timestamp;
        lastShownAt = timestamp;
        lastShownAtMs = nowMs();

        showDomLoadingOverlay(refs, lastViewModel?.message ?? defaultMessage);
        setStatus("visible", reason ?? "show");
        refs.root.dataset.loadingOverlayVisible = "true";

        return;
      }

      const elapsedVisibleMs = elapsedMsSince(lastShownAtMs);

      if (elapsedVisibleMs < minVisibleMs) {
        clearPendingHide();

        pendingHideTimerId = globalThis.setTimeout(() => {
          pendingHideTimerId = null;
          commitVisibleState(false, reason ?? "min-visible-delay");
        }, Math.max(0, minVisibleMs - elapsedVisibleMs));

        return;
      }

      visible = false;
      hideCount += 1;
      lastHiddenAt = now();

      hideDomLoadingOverlay(refs);
      setStatus("hidden", reason ?? "hide");
      refs.root.dataset.loadingOverlayVisible = "false";
      refs.root.dataset.loadingOverlayLastHideReason = reason ?? "";
    } catch (error) {
      setError(error);
    }
  }

  function render(state?: EditorState, reason?: string): void {
    if (!assertAlive("render")) {
      return;
    }

    if (!enabled) {
      return;
    }

    try {
      const currentState = state ?? store.peekState();
      const viewModel = buildViewModelFromState(currentState, {
        defaultMessage,
        maxMessageLength,
        hideWhenErrorVisible,
      });

      if (viewModelsEqual(lastViewModel, viewModel)) {
        skippedRenderCount += 1;
        return;
      }

      lastViewModel = viewModel;
      renderCount += 1;

      applyViewModelDetailsToDom(refs, viewModel, {
        updateLiveRegion,
      });

      if (viewModel.visible !== visible) {
        commitVisibleState(viewModel.visible, reason ?? "state-render");
      } else {
        visible = viewModel.visible;
        setStatus(visible ? "visible" : "hidden", reason ?? "render");
      }

      updatedAt = now();
      refs.root.dataset.loadingOverlayRenderCount = String(renderCount);
      refs.root.dataset.loadingOverlaySkippedRenderCount = String(skippedRenderCount);

      logDebug(logger, "Loading overlay rendered.", {
        visible: viewModel.visible,
        phase: viewModel.phase,
        message: viewModel.message,
        progress: viewModel.progress,
        inventoryStatus: viewModel.inventoryStatus,
        libraryItemCount: viewModel.libraryItemCount,
        selectedRuntimeBlockTypeId: viewModel.selectedRuntimeBlockTypeId,
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
      if (autoRender) {
        unsubscribe = store.subscribe((state) => {
          render(state, "store-update");
        });
      }

      mounted = true;
      refs.root.dataset.loadingOverlayMounted = "true";
      refs.root.dataset.loadingOverlayEnabled = enabled ? "true" : "false";
      refs.root.dataset.loadingOverlayInventoryTruth = INVENTORY_TRUTH_ROUTE;
      refs.root.dataset.loadingOverlayOnlyLibraryItemsPlaceable = "true";
      refs.root.dataset.loadingOverlayDebugGrassDirtAllowed = "false";
      setStatus(visible ? "visible" : "hidden", "mount");

      if (visible) {
        showDomLoadingOverlay(refs, defaultMessage);
      } else {
        hideDomLoadingOverlay(refs);
      }

      render(store.peekState(), "mount");

      logDebug(logger, "Loading overlay mounted.", {
        enabled,
        visible,
        autoRender,
        minVisibleMs,
        inventoryTruth: INVENTORY_TRUTH_ROUTE,
      });
    } catch (error) {
      setError(error);
    }
  }

  function show(input?: LoadingOverlayShowInput): void {
    if (!assertAlive("show")) {
      return;
    }

    try {
      const phase = normalizePhase(input?.phase, lastViewModel?.phase ?? "boot");
      const message = normalizeMessage(
        input?.message,
        defaultMessageForPhase(phase, defaultMessage),
        maxMessageLength,
      );
      const progress = normalizeProgress(input?.progress);
      const state = store.peekState();
      const inventory = selectInventorySummary(state);
      const creativeLibrary = selectCreativeLibrarySummary(state);

      const viewModel: LoadingOverlayViewModel = {
        visible: true,
        phase,
        message,
        lifecycleStatus: state.lifecycle.status,
        worldStatus: state.world.connection.status,
        inventoryStatus: inventory.status,
        inventorySource: inventory.source,
        inventoryItemCount: inventory.itemCount,
        libraryItemCount: inventory.libraryItemCount,
        creativeLibraryStatus: creativeLibrary.status,
        creativeLibraryItemCount: creativeLibrary.itemCount,
        selectedRuntimeBlockTypeId: selectSelectedRuntimeBlockTypeId(state),
        ready: false,
        blockingReason: null,
        progress,
        updatedAt: now(),
      };

      lastViewModel = viewModel;
      messageUpdateCount += 1;

      applyViewModelDetailsToDom(refs, viewModel, {
        updateLiveRegion: input?.updateLiveRegion ?? updateLiveRegion,
      });

      commitVisibleState(true, "manual-show");
    } catch (error) {
      setError(error);
    }
  }

  function hide(reason?: string): void {
    if (!assertAlive("hide")) {
      return;
    }

    commitVisibleState(false, reason ?? "manual-hide");
  }

  const handle: LoadingOverlayHandle = {
    kind: LOADING_OVERLAY_KIND,

    mount,
    render,
    show,
    hide,

    setMessage(message: string, phase?: LoadingOverlayPhase): void {
      if (!assertAlive("setMessage")) {
        return;
      }

      const nextPhase = normalizePhase(phase, lastViewModel?.phase ?? "unknown");
      const nextMessage = normalizeMessage(message, defaultMessageForPhase(nextPhase, defaultMessage), maxMessageLength);

      messageUpdateCount += 1;

      show({
        message: nextMessage,
        phase: nextPhase,
        progress: lastViewModel?.progress ?? null,
      });
    },

    setProgress(progress: number | null): void {
      if (!assertAlive("setProgress")) {
        return;
      }

      const normalizedProgress = normalizeProgress(progress);

      if (lastViewModel) {
        lastViewModel = {
          ...lastViewModel,
          progress: normalizedProgress,
          updatedAt: now(),
        };

        applyViewModelDetailsToDom(refs, lastViewModel, {
          updateLiveRegion: false,
        });
      }

      if (normalizedProgress === null) {
        delete refs.root.dataset.loadingOverlayProgress;
      } else {
        refs.root.dataset.loadingOverlayProgress = String(normalizedProgress);
      }
    },

    setEnabled(nextEnabled: boolean, reason?: string): void {
      if (!assertAlive("setEnabled")) {
        return;
      }

      enabled = safeBoolean(nextEnabled, enabled);
      refs.root.dataset.loadingOverlayEnabled = enabled ? "true" : "false";

      if (!enabled) {
        hide(reason ?? "disabled");
        return;
      }

      render(store.peekState(), reason ?? "enabled");
    },

    getStatus(): LoadingOverlayStatus {
      return status;
    },

    getSnapshot(): LoadingOverlaySnapshot {
      return {
        kind: LOADING_OVERLAY_SNAPSHOT_KIND,
        status,
        enabled,
        visible,
        mounted,
        disposed,
        createdAt,
        updatedAt,
        disposedAt,
        firstShownAt,
        lastShownAt,
        lastHiddenAt,
        renderCount,
        skippedRenderCount,
        showCount,
        hideCount,
        messageUpdateCount,
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
      clearPendingHide();

      try {
        unsubscribe?.();
        unsubscribe = null;
      } catch {
        // Ignore.
      }

      mounted = false;
      refs.root.dataset.loadingOverlayMounted = "false";
      refs.root.dataset.loadingOverlayDisposeReason = disposeReason;
      refs.root.dataset.loadingOverlayDisposedAt = disposedAt;
      setStatus("disposed", disposeReason);

      logDebug(logger, "Loading overlay disposed.", {
        reason: disposeReason,
        renderCount,
        skippedRenderCount,
        showCount,
        hideCount,
        messageUpdateCount,
      });
    },
  };

  if (enabled && options.autoMount !== false) {
    mount();
  }

  return handle;
}

export function isLoadingOverlayHandle(value: unknown): value is LoadingOverlayHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<LoadingOverlayHandle>;

    return (
      record.kind === LOADING_OVERLAY_KIND
      && typeof record.mount === "function"
      && typeof record.render === "function"
      && typeof record.show === "function"
      && typeof record.dispose === "function"
    );
  } catch {
    return false;
  }
}

export function getLoadingOverlayMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.ui.loading_overlay",
    overlayKind: LOADING_OVERLAY_KIND,
    snapshotKind: LOADING_OVERLAY_SNAPSHOT_KIND,
    supportsLibraryInventoryLoading: true,
    supportsCreativeLibraryLoading: true,
    primaryInventoryRoute: INVENTORY_TRUTH_ROUTE,
    rules: {
      inventoryMessageUsesLibraryVplib: true,
      blocktypenMessageRemoved: true,
      browserDoesNotCallVectoplanLibraryDirectly: true,
      onlyLibraryItemsPlaceable: true,
      debugGrassDirtAllowed: false,
    },
  };
}