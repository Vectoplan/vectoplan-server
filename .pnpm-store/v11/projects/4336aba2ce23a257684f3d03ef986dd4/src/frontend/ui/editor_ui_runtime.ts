// services/vectoplan-editor/src/frontend/ui/editor_ui_runtime.ts
import type { EditorDomRefs } from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import type { EditorState } from "@state/editor_state";
import { applyEditorAction } from "@state/state_actions";
import {
  createCrosshairView,
  type CrosshairViewHandle,
  type CrosshairVariant,
} from "./crosshair_view";
import {
  createDebugOverlay,
  type DebugOverlayHandle,
} from "./debug_overlay";
import {
  createErrorPanel,
  type ErrorPanelHandle,
} from "./error_panel";
import {
  createHotbarView,
  type HotbarViewHandle,
} from "./hotbar_view";
import {
  createLoadingOverlay,
  type LoadingOverlayHandle,
} from "./loading_overlay";
import {
  createStatusBar,
  type StatusBarHandle,
} from "./status_bar";

export type EditorUiRuntimeStatus =
  | "created"
  | "mounting"
  | "ready"
  | "visible"
  | "hidden"
  | "failed"
  | "disposing"
  | "disposed";

export interface EditorUiRuntimeOptions {
  readonly refs: EditorDomRefs;
  readonly store: EditorStore;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly enabled?: boolean;
  readonly autoMount?: boolean;
  readonly autoRender?: boolean;

  readonly statusBarEnabled?: boolean;
  readonly crosshairEnabled?: boolean;
  readonly hotbarEnabled?: boolean;
  readonly loadingOverlayEnabled?: boolean;
  readonly errorPanelEnabled?: boolean;
  readonly debugOverlayEnabled?: boolean;

  readonly statusBarVisible?: boolean;
  readonly crosshairVisible?: boolean;
  readonly crosshairOnlyWhenPointerLocked?: boolean;
  readonly hotbarVisible?: boolean;
  readonly loadingOverlayVisible?: boolean;
  readonly debugOverlayVisible?: boolean;

  readonly updateLiveRegions?: boolean;
  readonly compactStatusBar?: boolean;
  readonly renderEmptyHotbarSlots?: boolean;
}

export interface EditorUiRuntimeSnapshot {
  readonly kind: "editor-ui-runtime-snapshot.v1";
  readonly status: EditorUiRuntimeStatus;
  readonly enabled: boolean;
  readonly mounted: boolean;
  readonly visible: boolean;
  readonly disposed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mountedAt: string | null;
  readonly disposedAt: string | null;
  readonly renderCount: number;
  readonly showCount: number;
  readonly hideCount: number;
  readonly lastRenderAt: string | null;
  readonly lastReason: string | null;
  readonly lastError: Record<string, unknown> | null;
  readonly statusBar: ReturnType<StatusBarHandle["getSnapshot"]> | null;
  readonly crosshair: ReturnType<CrosshairViewHandle["getSnapshot"]> | null;
  readonly hotbar: ReturnType<HotbarViewHandle["getSnapshot"]> | null;
  readonly loadingOverlay: ReturnType<LoadingOverlayHandle["getSnapshot"]> | null;
  readonly errorPanel: ReturnType<ErrorPanelHandle["getSnapshot"]> | null;
  readonly debugOverlay: ReturnType<DebugOverlayHandle["getSnapshot"]> | null;
}

export interface EditorUiRuntimeHandle {
  readonly kind: "vectoplan-editor-ui-runtime.v1";

  mount(reason?: string): void;
  render(state?: EditorState, reason?: string): void;

  show(reason?: string): void;
  hide(reason?: string): void;
  setEnabled(enabled: boolean, reason?: string): void;

  showLoading(message?: string | null, reason?: string): void;
  hideLoading(reason?: string): void;

  showError(input: {
    readonly title?: string;
    readonly message: string;
    readonly error?: unknown;
    readonly reason?: string;
  }): void;
  clearError(reason?: string): void;

  showCrosshair(reason?: string): void;
  hideCrosshair(reason?: string): void;
  setCrosshairVariant(variant: CrosshairVariant, reason?: string): void;

  showHotbar(reason?: string): void;
  hideHotbar(reason?: string): void;

  showDebugOverlay(reason?: string): void;
  hideDebugOverlay(reason?: string): void;
  toggleDebugOverlay(reason?: string): void;

  getStatus(): EditorUiRuntimeStatus;
  getStatusBar(): StatusBarHandle | null;
  getCrosshairView(): CrosshairViewHandle | null;
  getHotbarView(): HotbarViewHandle | null;
  getLoadingOverlay(): LoadingOverlayHandle | null;
  getErrorPanel(): ErrorPanelHandle | null;
  getDebugOverlay(): DebugOverlayHandle | null;
  getSnapshot(): EditorUiRuntimeSnapshot;

  dispose(reason?: string): void;
}

const EDITOR_UI_RUNTIME_KIND = "vectoplan-editor-ui-runtime.v1" as const;
const EDITOR_UI_RUNTIME_SNAPSHOT_KIND = "editor-ui-runtime-snapshot.v1" as const;

type LoggerOption = {
  readonly logger: EditorLogger;
};

interface CrosshairStateInfo {
  readonly pointerLocked: boolean;
  readonly targetActive: boolean;
  readonly canPlace: boolean;
  readonly canRemove: boolean;
  readonly blocked: boolean;
  readonly variant: CrosshairVariant;
  readonly label: string | null;
}

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "unknown-time";
    }
  }
}

function normalizeErrorRecord(error: unknown): Record<string, unknown> {
  try {
    const normalized = normalizeUnknownError(error);

    if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
      return normalized as Record<string, unknown>;
    }

    return {
      name: "UnknownError",
      message: String(normalized),
    };
  } catch {
    try {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
        };
      }

      return {
        name: "UnknownError",
        message: String(error),
      };
    } catch {
      return {
        name: "UnknownError",
        message: "Unknown editor UI runtime error.",
      };
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
    // UI runtime logging must never break rendering.
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
    // UI runtime logging must never break rendering.
  }
}

function childLogger(logger: EditorLogger | undefined, namespace: string): EditorLogger | undefined {
  try {
    return logger?.child?.(namespace) ?? logger;
  } catch {
    return logger;
  }
}

function loggerOption(logger: EditorLogger | undefined, namespace: string): LoggerOption | Record<string, never> {
  const child = childLogger(logger, namespace);
  return child ? { logger: child } : {};
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
    // Dataset updates are diagnostic-only.
  }
}

function snapshotOrNull<T>(reader: () => T): T | null {
  try {
    return reader();
  } catch {
    return null;
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

function readPath(value: unknown, path: readonly string[]): unknown {
  try {
    let current: unknown = value;

    for (const part of path) {
      const record = asRecord(current);

      if (!record) {
        return undefined;
      }

      current = record[part];
    }

    return current;
  } catch {
    return undefined;
  }
}

function readBooleanFromPaths(
  value: unknown,
  paths: readonly (readonly string[])[],
  fallback: boolean,
): boolean {
  try {
    for (const path of paths) {
      const current = readPath(value, path);

      if (typeof current === "boolean") {
        return current;
      }

      if (typeof current === "string") {
        const normalized = current.trim().toLowerCase();

        if (normalized === "true" || normalized === "1" || normalized === "yes") {
          return true;
        }

        if (normalized === "false" || normalized === "0" || normalized === "no") {
          return false;
        }
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function readStringFromPaths(
  value: unknown,
  paths: readonly (readonly string[])[],
  fallback: string | null,
): string | null {
  try {
    for (const path of paths) {
      const current = readPath(value, path);

      if (typeof current === "string" && current.trim().length > 0) {
        return current.trim();
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function existsAtAnyPath(value: unknown, paths: readonly (readonly string[])[]): boolean {
  try {
    for (const path of paths) {
      const current = readPath(value, path);

      if (current !== undefined && current !== null) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function disposePart(
  label: string,
  value: unknown,
  logger: EditorLogger | undefined,
  reason: string,
): void {
  try {
    if (!value || typeof value !== "object") {
      return;
    }

    const maybeDispose = (value as { dispose?: unknown }).dispose;
    const maybeDestroy = (value as { destroy?: unknown }).destroy;

    if (typeof maybeDispose === "function") {
      maybeDispose.call(value, reason);
      return;
    }

    if (typeof maybeDestroy === "function") {
      maybeDestroy.call(value, reason);
    }
  } catch (error) {
    logWarn(logger, `${label} dispose failed.`, {
      reason,
      error: normalizeErrorRecord(error),
    });
  }
}

function dispatchHotbarSlotSelection(
  store: EditorStore,
  slot: number,
): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "inventory/select-slot",
        slot,
        source: "editor-ui-runtime.hotbar-slot-click",
        createdAt: now(),
      }),
      {
        action: "editor-ui-runtime.hotbar-slot-click",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Hotbar click must not break UI runtime.
  }
}

function safeErrorMessage(error: unknown, fallback = "Editor UI runtime failed."): string {
  try {
    const normalized = normalizeErrorRecord(error);
    const message = normalized.message;

    return typeof message === "string" && message.trim().length > 0
      ? message.trim()
      : fallback;
  } catch {
    return fallback;
  }
}

function readCrosshairStateInfo(state: EditorState): CrosshairStateInfo {
  try {
    const pointerLocked = readBooleanFromPaths(
      state,
      [
        ["input", "pointerLocked"],
        ["input", "pointer", "pointerLocked"],
        ["pointer", "pointerLocked"],
        ["runtime", "input", "pointerLocked"],
      ],
      false,
    );

    const targetActive = readBooleanFromPaths(
      state,
      [
        ["targeting", "active"],
        ["targeting", "targetActive"],
        ["targeting", "hasTarget"],
        ["tools", "targeting", "active"],
      ],
      existsAtAnyPath(state, [
        ["targeting", "sourceCell"],
        ["targeting", "placementCell"],
        ["targeting", "target"],
        ["targeting", "hit"],
      ]),
    );

    const canPlace = readBooleanFromPaths(
      state,
      [
        ["targeting", "canPlace"],
        ["targeting", "canPlaceBlock"],
        ["tools", "canPlace"],
        ["tools", "place", "canPlace"],
      ],
      false,
    );

    const canRemove = readBooleanFromPaths(
      state,
      [
        ["targeting", "canRemove"],
        ["targeting", "canRemoveBlock"],
        ["tools", "canRemove"],
        ["tools", "remove", "canRemove"],
      ],
      false,
    );

    const blocked = readBooleanFromPaths(
      state,
      [
        ["targeting", "blocked"],
        ["targeting", "isBlocked"],
        ["targeting", "placementBlocked"],
        ["tools", "blocked"],
      ],
      existsAtAnyPath(state, [
        ["targeting", "blockedBy"],
        ["targeting", "blockingReason"],
        ["targeting", "error"],
      ]),
    );

    const label = readStringFromPaths(
      state,
      [
        ["targeting", "blockingReason"],
        ["targeting", "blockedBy"],
        ["targeting", "label"],
        ["targeting", "message"],
      ],
      null,
    );

    let variant: CrosshairVariant = "neutral";

    if (blocked) {
      variant = "blocked";
    } else if (canRemove) {
      variant = "remove";
    } else if (canPlace) {
      variant = "place";
    } else if (targetActive) {
      variant = "target";
    }

    return {
      pointerLocked,
      targetActive,
      canPlace,
      canRemove,
      blocked,
      variant,
      label,
    };
  } catch {
    return {
      pointerLocked: false,
      targetActive: false,
      canPlace: false,
      canRemove: false,
      blocked: false,
      variant: "neutral",
      label: null,
    };
  }
}

export function createEditorUiRuntime(options: EditorUiRuntimeOptions): EditorUiRuntimeHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;

  const createdAt = now();

  let status: EditorUiRuntimeStatus = "created";
  let enabled = options.enabled ?? true;
  let visible = true;
  let mounted = false;
  let disposed = false;
  let updatedAt = createdAt;
  let mountedAt: string | null = null;
  let disposedAt: string | null = null;
  let renderCount = 0;
  let showCount = 0;
  let hideCount = 0;
  let lastRenderAt: string | null = null;
  let lastReason: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  let statusBar: StatusBarHandle | null = null;
  let crosshairView: CrosshairViewHandle | null = null;
  let hotbarView: HotbarViewHandle | null = null;
  let loadingOverlay: LoadingOverlayHandle | null = null;
  let errorPanel: ErrorPanelHandle | null = null;
  let debugOverlay: DebugOverlayHandle | null = null;

  function setStatus(nextStatus: EditorUiRuntimeStatus, reason?: string | null): void {
    status = nextStatus;
    updatedAt = now();
    lastReason = reason ?? lastReason;

    setDatasetValue(refs.root, "editorUiRuntimeStatus", nextStatus);
    setDatasetValue(refs.root, "editorUiRuntimeUpdatedAt", updatedAt);
    setDatasetValue(refs.root, "editorUiRuntimeEnabled", enabled ? "true" : "false");
    setDatasetValue(refs.root, "editorUiRuntimeVisible", visible ? "true" : "false");
  }

  function setError(error: unknown, reason?: string): void {
    const normalized = normalizeErrorRecord(error);
    lastError = normalized;
    setStatus("failed", reason ?? safeString(normalized.message, "editor-ui-runtime.failed"));

    logWarn(logger, "Editor UI runtime failed.", {
      reason: reason ?? null,
      error: lastError,
    });
  }

  function assertAlive(action: string): boolean {
    if (disposed || status === "disposed" || status === "disposing") {
      logWarn(logger, "Editor UI runtime action ignored because runtime is disposed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function createParts(): void {
    if (statusBar === null && options.statusBarEnabled !== false) {
      statusBar = createStatusBar({
        refs,
        store,
        ...loggerOption(logger, "status_bar"),
        enabled,
        visible: options.statusBarVisible ?? true,
        autoMount: false,
        compact: options.compactStatusBar ?? true,
        updateLiveRegion: false,
      });
    }

    if (crosshairView === null && options.crosshairEnabled !== false) {
      crosshairView = createCrosshairView({
        root: refs.viewportOverlay ?? refs.canvasHost,
        existingElement: refs.crosshair,
        ...loggerOption(logger, "crosshair_view"),
        enabled,
        visible: options.crosshairVisible ?? true,
        showOnlyWhenPointerLocked: options.crosshairOnlyWhenPointerLocked ?? false,
        createIfMissing: true,
        attachToRoot: true,
        variant: "neutral",
        label: null,
      });
    }

    if (hotbarView === null && options.hotbarEnabled !== false) {
      hotbarView = createHotbarView({
        refs,
        store,
        ...loggerOption(logger, "hotbar_view"),
        enabled,
        visible: options.hotbarVisible ?? true,
        autoMount: false,
        renderEmptySlots: options.renderEmptyHotbarSlots ?? true,
        updateLiveRegion: options.updateLiveRegions ?? false,
        selectSlotOnClick: false,
        onSlotClick: (slot) => dispatchHotbarSlotSelection(store, slot),
      });
    }

    if (loadingOverlay === null && options.loadingOverlayEnabled !== false) {
      loadingOverlay = createLoadingOverlay({
        refs,
        store,
        ...loggerOption(logger, "loading_overlay"),
        enabled,
        visible: options.loadingOverlayVisible ?? true,
        autoMount: false,
        autoRender: options.autoRender ?? true,
        updateLiveRegion: options.updateLiveRegions ?? true,
        hideWhenErrorVisible: true,
      });
    }

    if (errorPanel === null && options.errorPanelEnabled !== false) {
      errorPanel = createErrorPanel({
        refs,
        store,
        ...loggerOption(logger, "error_panel"),
        enabled,
        visible: false,
        autoMount: false,
        autoRender: options.autoRender ?? true,
        clearWhenNoError: true,
        updateLiveRegion: options.updateLiveRegions ?? true,
        showDetailsInDom: true,
      });
    }

    if (debugOverlay === null && options.debugOverlayEnabled === true) {
      debugOverlay = createDebugOverlay({
        refs,
        store,
        ...loggerOption(logger, "debug_overlay"),
        enabled,
        visible: options.debugOverlayVisible ?? false,
        autoMount: false,
        autoRender: options.autoRender ?? true,
      });
    }
  }

  function renderCrosshair(state: EditorState, reason?: string): void {
    try {
      if (!crosshairView) {
        return;
      }

      const info = readCrosshairStateInfo(state);

      crosshairView.update({
        visible: options.crosshairVisible ?? true,
        enabled,
        pointerLocked: info.pointerLocked,
        targetActive: info.targetActive,
        canPlace: info.canPlace,
        canRemove: info.canRemove,
        blocked: info.blocked,
        variant: info.variant,
        label: info.label,
        source: reason ?? "ui-runtime-render",
      });
    } catch (error) {
      setError(error, reason ?? "crosshair-render-failed");
    }
  }

  function mount(reason?: string): void {
    if (!assertAlive("mount")) {
      return;
    }

    if (!enabled) {
      setStatus("hidden", reason ?? "disabled");
      return;
    }

    if (mounted) {
      return;
    }

    try {
      setStatus("mounting", reason ?? "mount");
      createParts();

      statusBar?.mount();
      crosshairView?.attach();
      hotbarView?.mount();
      loadingOverlay?.mount();
      errorPanel?.mount();
      debugOverlay?.mount();

      mounted = true;
      mountedAt = now();
      visible = true;

      setDatasetValue(refs.root, "editorUiRuntimeMounted", "true");
      setDatasetValue(refs.root, "editorUiRuntimeMountedAt", mountedAt);

      setStatus("ready", reason ?? "mount");

      render(store.peekState(), "mount");

      logDebug(logger, "Editor UI runtime mounted.", {
        reason: reason ?? null,
        statusBar: Boolean(statusBar),
        crosshairView: Boolean(crosshairView),
        hotbarView: Boolean(hotbarView),
        loadingOverlay: Boolean(loadingOverlay),
        errorPanel: Boolean(errorPanel),
        debugOverlay: Boolean(debugOverlay),
      });
    } catch (error) {
      setError(error, reason ?? "mount-failed");
    }
  }

  function render(state?: EditorState, reason?: string): void {
    if (!assertAlive("render")) {
      return;
    }

    if (!enabled || !visible) {
      return;
    }

    try {
      if (!mounted) {
        mount(reason ?? "render-auto-mount");
      }

      const currentState = state ?? store.peekState();

      statusBar?.render(currentState, reason ?? "ui-runtime-render");
      renderCrosshair(currentState, reason ?? "ui-runtime-render");
      hotbarView?.render(currentState, reason ?? "ui-runtime-render");
      loadingOverlay?.render(currentState, reason ?? "ui-runtime-render");
      errorPanel?.render(currentState, reason ?? "ui-runtime-render");
      debugOverlay?.render(currentState, reason ?? "ui-runtime-render");

      renderCount += 1;
      lastRenderAt = now();

      setDatasetValue(refs.root, "editorUiRuntimeRenderCount", renderCount);
      setDatasetValue(refs.root, "editorUiRuntimeLastRenderAt", lastRenderAt);

      setStatus("visible", reason ?? "render");
    } catch (error) {
      setError(error, reason ?? "render-failed");
    }
  }

  function show(reason?: string): void {
    if (!assertAlive("show")) {
      return;
    }

    try {
      if (!mounted) {
        mount(reason ?? "show-auto-mount");
      }

      visible = true;
      showCount += 1;

      statusBar?.show(reason ?? "ui-runtime-show");
      crosshairView?.show(reason ?? "ui-runtime-show");
      hotbarView?.show(reason ?? "ui-runtime-show");

      setDatasetValue(refs.root, "editorUiRuntimeVisible", "true");
      setStatus("visible", reason ?? "show");
    } catch (error) {
      setError(error, reason ?? "show-failed");
    }
  }

  function hide(reason?: string): void {
    if (!assertAlive("hide")) {
      return;
    }

    try {
      visible = false;
      hideCount += 1;

      statusBar?.hide(reason ?? "ui-runtime-hide");
      crosshairView?.hide(reason ?? "ui-runtime-hide");
      hotbarView?.hide(reason ?? "ui-runtime-hide");
      loadingOverlay?.hide(reason ?? "ui-runtime-hide");
      errorPanel?.hide(reason ?? "ui-runtime-hide");
      debugOverlay?.hide(reason ?? "ui-runtime-hide");

      setDatasetValue(refs.root, "editorUiRuntimeVisible", "false");
      setStatus("hidden", reason ?? "hide");
    } catch (error) {
      setError(error, reason ?? "hide-failed");
    }
  }

  function dispose(reason?: string): void {
    if (disposed) {
      return;
    }

    const disposeReason = safeString(reason, "editor-ui-runtime.dispose");

    try {
      setStatus("disposing", disposeReason);

      disposePart("debug-overlay", debugOverlay, logger, disposeReason);
      disposePart("error-panel", errorPanel, logger, disposeReason);
      disposePart("loading-overlay", loadingOverlay, logger, disposeReason);
      disposePart("hotbar-view", hotbarView, logger, disposeReason);
      disposePart("crosshair-view", crosshairView, logger, disposeReason);
      disposePart("status-bar", statusBar, logger, disposeReason);

      debugOverlay = null;
      errorPanel = null;
      loadingOverlay = null;
      hotbarView = null;
      crosshairView = null;
      statusBar = null;

      mounted = false;
      visible = false;
      disposed = true;
      disposedAt = now();

      setDatasetValue(refs.root, "editorUiRuntimeMounted", "false");
      setDatasetValue(refs.root, "editorUiRuntimeVisible", "false");
      setDatasetValue(refs.root, "editorUiRuntimeDisposedAt", disposedAt);

      setStatus("disposed", disposeReason);

      logDebug(logger, "Editor UI runtime disposed.", {
        reason: disposeReason,
        renderCount,
        showCount,
        hideCount,
      });
    } catch (error) {
      disposed = true;
      disposedAt = now();
      setError(error, "dispose-failed");
    }
  }

  const handle: EditorUiRuntimeHandle = {
    kind: EDITOR_UI_RUNTIME_KIND,

    mount,
    render,
    show,
    hide,

    setEnabled(nextEnabled: boolean, reason?: string): void {
      if (!assertAlive("setEnabled")) {
        return;
      }

      enabled = safeBoolean(nextEnabled, enabled);

      statusBar?.setEnabled(enabled, reason ?? "ui-runtime-set-enabled");
      crosshairView?.[enabled ? "enable" : "disable"]?.(reason ?? "ui-runtime-set-enabled");
      hotbarView?.setEnabled(enabled, reason ?? "ui-runtime-set-enabled");
      loadingOverlay?.setEnabled(enabled, reason ?? "ui-runtime-set-enabled");
      errorPanel?.setEnabled(enabled, reason ?? "ui-runtime-set-enabled");
      debugOverlay?.setEnabled(enabled, reason ?? "ui-runtime-set-enabled");

      setDatasetValue(refs.root, "editorUiRuntimeEnabled", enabled ? "true" : "false");

      if (!enabled) {
        hide(reason ?? "disabled");
        return;
      }

      show(reason ?? "enabled");
    },

    showLoading(message?: string | null, reason?: string): void {
      if (!assertAlive("showLoading")) {
        return;
      }

      loadingOverlay?.show({
        message: message ?? "Editor wird geladen.",
        phase: "boot",
        updateLiveRegion: options.updateLiveRegions ?? true,
      });

      setStatus("visible", reason ?? "show-loading");
    },

    hideLoading(reason?: string): void {
      if (!assertAlive("hideLoading")) {
        return;
      }

      loadingOverlay?.hide(reason ?? "hide-loading");
    },

    showError(input: {
      readonly title?: string;
      readonly message: string;
      readonly error?: unknown;
      readonly reason?: string;
    }): void {
      if (!assertAlive("showError")) {
        return;
      }

      const title = safeString(input.title, "");
      const panelPayload = title.length > 0
        ? {
            title,
            message: input.message,
            severity: "fatal" as const,
            error: input.error,
          }
        : {
            message: input.message,
            severity: "fatal" as const,
            error: input.error,
          };

      errorPanel?.show(panelPayload);
      loadingOverlay?.hide(input.reason ?? "error-visible");

      crosshairView?.update({
        visible: true,
        enabled,
        variant: "error",
        label: title || input.message,
        source: input.reason ?? "ui-runtime-show-error",
      });

      setStatus("failed", input.reason ?? safeErrorMessage(input.error, "show-error"));
    },

    clearError(reason?: string): void {
      if (!assertAlive("clearError")) {
        return;
      }

      errorPanel?.clear(reason ?? "clear-error");
      crosshairView?.setVariant("neutral", reason ?? "clear-error");
      setStatus("ready", reason ?? "clear-error");
    },

    showCrosshair(reason?: string): void {
      if (!assertAlive("showCrosshair")) {
        return;
      }

      crosshairView?.show(reason ?? "show-crosshair");
    },

    hideCrosshair(reason?: string): void {
      if (!assertAlive("hideCrosshair")) {
        return;
      }

      crosshairView?.hide(reason ?? "hide-crosshair");
    },

    setCrosshairVariant(variant: CrosshairVariant, reason?: string): void {
      if (!assertAlive("setCrosshairVariant")) {
        return;
      }

      crosshairView?.setVariant(variant, reason ?? "set-crosshair-variant");
    },

    showHotbar(reason?: string): void {
      if (!assertAlive("showHotbar")) {
        return;
      }

      hotbarView?.show(reason ?? "show-hotbar");
    },

    hideHotbar(reason?: string): void {
      if (!assertAlive("hideHotbar")) {
        return;
      }

      hotbarView?.hide(reason ?? "hide-hotbar");
    },

    showDebugOverlay(reason?: string): void {
      if (!assertAlive("showDebugOverlay")) {
        return;
      }

      if (!debugOverlay) {
        debugOverlay = createDebugOverlay({
          refs,
          store,
          ...loggerOption(logger, "debug_overlay"),
          enabled,
          visible: true,
          autoMount: true,
          autoRender: options.autoRender ?? true,
        });
      }

      debugOverlay.show(reason ?? "show-debug-overlay");
    },

    hideDebugOverlay(reason?: string): void {
      if (!assertAlive("hideDebugOverlay")) {
        return;
      }

      debugOverlay?.hide(reason ?? "hide-debug-overlay");
    },

    toggleDebugOverlay(reason?: string): void {
      if (!assertAlive("toggleDebugOverlay")) {
        return;
      }

      if (!debugOverlay) {
        handle.showDebugOverlay(reason ?? "toggle-debug-overlay-create");
        return;
      }

      debugOverlay.toggle(reason ?? "toggle-debug-overlay");
    },

    getStatus(): EditorUiRuntimeStatus {
      return status;
    },

    getStatusBar(): StatusBarHandle | null {
      return statusBar;
    },

    getCrosshairView(): CrosshairViewHandle | null {
      return crosshairView;
    },

    getHotbarView(): HotbarViewHandle | null {
      return hotbarView;
    },

    getLoadingOverlay(): LoadingOverlayHandle | null {
      return loadingOverlay;
    },

    getErrorPanel(): ErrorPanelHandle | null {
      return errorPanel;
    },

    getDebugOverlay(): DebugOverlayHandle | null {
      return debugOverlay;
    },

    getSnapshot(): EditorUiRuntimeSnapshot {
      return {
        kind: EDITOR_UI_RUNTIME_SNAPSHOT_KIND,
        status,
        enabled,
        mounted,
        visible,
        disposed,
        createdAt,
        updatedAt,
        mountedAt,
        disposedAt,
        renderCount,
        showCount,
        hideCount,
        lastRenderAt,
        lastReason,
        lastError,
        statusBar: snapshotOrNull(() => statusBar?.getSnapshot() ?? null),
        crosshair: snapshotOrNull(() => crosshairView?.getSnapshot() ?? null),
        hotbar: snapshotOrNull(() => hotbarView?.getSnapshot() ?? null),
        loadingOverlay: snapshotOrNull(() => loadingOverlay?.getSnapshot() ?? null),
        errorPanel: snapshotOrNull(() => errorPanel?.getSnapshot() ?? null),
        debugOverlay: snapshotOrNull(() => debugOverlay?.getSnapshot() ?? null),
      };
    },

    dispose,
  };

  if (options.signal) {
    try {
      if (options.signal.aborted) {
        dispose("abort-signal-already-aborted");
      } else {
        options.signal.addEventListener(
          "abort",
          () => dispose("abort-signal"),
          {
            once: true,
          },
        );
      }
    } catch {
      // Abort wiring is best-effort.
    }
  }

  if (options.autoMount !== false && enabled) {
    mount("auto-mount");
  }

  return handle;
}

export function isEditorUiRuntimeHandle(value: unknown): value is EditorUiRuntimeHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<EditorUiRuntimeHandle>;

    return (
      record.kind === EDITOR_UI_RUNTIME_KIND
      && typeof record.mount === "function"
      && typeof record.render === "function"
      && typeof record.getCrosshairView === "function"
      && typeof record.dispose === "function"
    );
  } catch {
    return false;
  }
}