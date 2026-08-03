// services/vectoplan-editor/src/frontend/ui/error_panel.ts
import type { ChunkApiErrorDetails } from "@api/chunk_api_models";
import { chunkApiErrorToDetails } from "@api/chunk_api_errors";
import {
  clearDomFatalError,
  setDomLiveMessage,
  showDomFatalError,
  type EditorDomRefs,
} from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, previewValue, safeBoolean, safeInteger, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore, EditorStoreUnsubscribe } from "@state/editor_store";
import type { EditorState } from "@state/editor_state";
import { applyEditorAction } from "@state/state_actions";
import {
  selectAllErrors,
  selectErrorMessage,
  selectLifecycleStatus,
  selectShouldShowErrorOverlay,
} from "@state/state_selectors";

export type ErrorPanelStatus =
  | "created"
  | "mounted"
  | "visible"
  | "hidden"
  | "failed"
  | "disposed";

export type ErrorPanelSeverity =
  | "info"
  | "warning"
  | "error"
  | "fatal";

export interface ErrorPanelErrorItem {
  readonly id: string;
  readonly severity: ErrorPanelSeverity;
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly exceptionType: string | null;
  readonly requestId: string | null;
  readonly requestKind: ChunkApiErrorDetails["requestKind"];
  readonly method: ChunkApiErrorDetails["method"];
  readonly statusCode: number | null;
  readonly url: string | null;
  readonly details: Record<string, unknown> | null;
  readonly createdAt: string;
}

export interface ErrorPanelViewModel {
  readonly visible: boolean;
  readonly severity: ErrorPanelSeverity;
  readonly title: string;
  readonly message: string;
  readonly lifecycleStatus: string;
  readonly errorCount: number;
  readonly primaryError: ErrorPanelErrorItem | null;
  readonly errors: readonly ErrorPanelErrorItem[];
  readonly updatedAt: string;
}

export interface ErrorPanelOptions {
  readonly refs: EditorDomRefs;
  readonly store: EditorStore;
  readonly logger?: EditorLogger;
  readonly enabled?: boolean;
  readonly visible?: boolean;
  readonly autoMount?: boolean;
  readonly autoRender?: boolean;
  readonly clearWhenNoError?: boolean;
  readonly updateLiveRegion?: boolean;
  readonly maxErrors?: number;
  readonly showDetailsInDom?: boolean;
  readonly onRetry?: () => void | Promise<void>;
  readonly onDismiss?: () => void;
}

export interface ErrorPanelSnapshot {
  readonly kind: "error-panel-snapshot.v1";
  readonly status: ErrorPanelStatus;
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
  readonly retryCount: number;
  readonly dismissCount: number;
  readonly lastRenderAt: string | null;
  readonly lastReason: string | null;
  readonly lastViewModel: ErrorPanelViewModel | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface ErrorPanelHandle {
  readonly kind: "vectoplan-editor-error-panel.v1";

  mount(): void;
  render(state?: EditorState, reason?: string): void;

  show(input: {
    readonly title?: string;
    readonly message: string;
    readonly severity?: ErrorPanelSeverity;
    readonly error?: unknown;
  }): void;

  hide(reason?: string): void;
  clear(reason?: string): void;
  retry(reason?: string): Promise<void>;
  dismiss(reason?: string): void;
  setEnabled(enabled: boolean, reason?: string): void;

  getStatus(): ErrorPanelStatus;
  getSnapshot(): ErrorPanelSnapshot;

  dispose(reason?: string): void;
}

const ERROR_PANEL_KIND = "vectoplan-editor-error-panel.v1" as const;
const ERROR_PANEL_SNAPSHOT_KIND = "error-panel-snapshot.v1" as const;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
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
    // UI logging must never break error rendering.
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
    // UI logging must never break error rendering.
  }
}

function normalizeMaxErrors(value: unknown): number {
  return safeInteger(value, 8, {
    min: 1,
    max: 50,
  });
}

function normalizeSeverity(value: unknown, fallback: ErrorPanelSeverity = "error"): ErrorPanelSeverity {
  const normalized = safeString(value, fallback);

  if (
    normalized === "info"
    || normalized === "warning"
    || normalized === "error"
    || normalized === "fatal"
  ) {
    return normalized;
  }

  return fallback;
}

function severityFromError(error: ChunkApiErrorDetails | null, lifecycleStatus?: string): ErrorPanelSeverity {
  try {
    if (lifecycleStatus === "failed") {
      return "fatal";
    }

    if (!error) {
      return "error";
    }

    if (error.retryable) {
      return "warning";
    }

    return "error";
  } catch {
    return "error";
  }
}

function titleFromSeverity(severity: ErrorPanelSeverity): string {
  switch (severity) {
    case "fatal":
      return "Editor konnte nicht gestartet werden";
    case "warning":
      return "Editor läuft eingeschränkt";
    case "info":
      return "Editor-Hinweis";
    case "error":
    default:
      return "Editor-Fehler";
  }
}

function errorIdFromDetails(error: ChunkApiErrorDetails, index: number): string {
  try {
    return [
      "editor_error",
      error.code || "unknown",
      error.requestId || "no_request",
      String(error.statusCode ?? "no_status"),
      String(index),
    ]
      .join("_")
      .replace(/[^a-zA-Z0-9_.:-]/g, "_")
      .replace(/_+/g, "_");
  } catch {
    return `editor_error_${index}`;
  }
}

function detailsToPlainRecord(details: unknown): Record<string, unknown> | null {
  try {
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      return null;
    }

    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
      output[key] = previewValue(value, 600);
    }

    return Object.keys(output).length > 0 ? output : null;
  } catch {
    return null;
  }
}

function errorDetailsToItem(
  error: ChunkApiErrorDetails,
  index: number,
  severity?: ErrorPanelSeverity,
): ErrorPanelErrorItem {
  return {
    id: errorIdFromDetails(error, index),
    severity: severity ?? severityFromError(error),
    code: safeString(error.code, "editor_error"),
    message: safeString(error.message, "Unbekannter Editor-Fehler."),
    retryable: error.retryable,
    exceptionType: error.exceptionType,
    requestId: error.requestId,
    requestKind: error.requestKind,
    method: error.method,
    statusCode: error.statusCode,
    url: error.url,
    details: detailsToPlainRecord(error.details),
    createdAt: now(),
  };
}

function unknownErrorToItem(error: unknown, severity?: ErrorPanelSeverity): ErrorPanelErrorItem {
  try {
    const details = chunkApiErrorToDetails(error);
    return errorDetailsToItem(details, 0, severity);
  } catch {
    const normalized = normalizeUnknownError(error);

    return {
      id: `editor_error_unknown_${Date.now()}`,
      severity: severity ?? "error",
      code: normalized.code ?? "editor_unknown_error",
      message: safeString(normalized.message, "Unbekannter Editor-Fehler."),
      retryable: false,
      exceptionType: normalized.name,
      requestId: null,
      requestKind: null,
      method: null,
      statusCode: null,
      url: null,
      details: normalized.details,
      createdAt: now(),
    };
  }
}

function itemToDetails(item: ErrorPanelErrorItem): ChunkApiErrorDetails {
  return {
    code: item.code,
    message: item.message,
    retryable: item.retryable,
    statusCode: item.statusCode,
    requestId: item.requestId,
    requestKind: item.requestKind,
    url: item.url,
    method: item.method,
    exceptionType: item.exceptionType,
    details: item.details,
  };
}

function buildViewModelFromState(
  state: EditorState,
  options: {
    readonly maxErrors: number;
  },
): ErrorPanelViewModel {
  try {
    const shouldShow = selectShouldShowErrorOverlay(state);
    const lifecycleStatus = selectLifecycleStatus(state);
    const selectedErrorMessage = selectErrorMessage(state);
    const errors = selectAllErrors(state)
      .slice(0, options.maxErrors)
      .map((error, index) => errorDetailsToItem(error, index, severityFromError(error, lifecycleStatus)));

    const primaryError = errors[0] ?? null;
    const severity = severityFromError(primaryError ? itemToDetails(primaryError) : null, lifecycleStatus);
    const message = selectedErrorMessage
      ?? primaryError?.message
      ?? (shouldShow ? "Unbekannter Editor-Fehler." : "");

    return {
      visible: shouldShow,
      severity,
      title: titleFromSeverity(severity),
      message,
      lifecycleStatus,
      errorCount: errors.length,
      primaryError,
      errors,
      updatedAt: now(),
    };
  } catch {
    return {
      visible: false,
      severity: "error",
      title: "Editor-Fehler",
      message: "",
      lifecycleStatus: "unknown",
      errorCount: 0,
      primaryError: null,
      errors: [],
      updatedAt: now(),
    };
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
    // Dataset updates are diagnostic-only.
  }
}

function setText(element: HTMLElement | null, value: unknown): void {
  try {
    if (!element) {
      return;
    }

    element.textContent = typeof value === "string" ? value : String(value ?? "");
  } catch {
    // Text updates must not throw.
  }
}

function clearElement(element: HTMLElement | null): void {
  try {
    if (!element) {
      return;
    }

    element.textContent = "";
  } catch {
    // Ignore.
  }
}

function createDetailsElement(viewModel: ErrorPanelViewModel): HTMLElement {
  const container = document.createElement("div");
  container.dataset.errorPanelDetails = "true";
  container.style.marginTop = "12px";
  container.style.fontSize = "12px";
  container.style.lineHeight = "1.45";
  container.style.color = "var(--vp-text-muted, #94a3b8)";

  if (viewModel.errors.length === 0) {
    return container;
  }

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "8px";

  for (const error of viewModel.errors) {
    const item = document.createElement("div");
    item.dataset.errorPanelItem = error.id;
    item.style.padding = "8px";
    item.style.border = "1px solid rgba(148, 163, 184, 0.18)";
    item.style.borderRadius = "10px";
    item.style.background = "rgba(15, 23, 42, 0.35)";

    const title = document.createElement("div");
    title.textContent = `${error.code}: ${error.message}`;
    title.style.color = "var(--vp-text, #e5e7eb)";
    title.style.fontWeight = "650";

    const meta = document.createElement("div");
    meta.textContent = [
      error.retryable ? "retryable" : "not retryable",
      error.statusCode !== null ? `HTTP ${error.statusCode}` : null,
      error.requestKind,
      error.method,
      error.exceptionType,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");

    item.appendChild(title);

    if (meta.textContent && meta.textContent.length > 0) {
      item.appendChild(meta);
    }

    list.appendChild(item);
  }

  container.appendChild(list);
  return container;
}

function applyViewModelToDom(
  refs: EditorDomRefs,
  viewModel: ErrorPanelViewModel,
  options: {
    readonly updateLiveRegion: boolean;
    readonly showDetailsInDom: boolean;
  },
): void {
  try {
    if (!viewModel.visible) {
      clearDomFatalError(refs);
      setDatasetValue(refs.root, "errorPanelVisible", "false");
      return;
    }

    showDomFatalError(refs, {
      title: viewModel.title,
      message: viewModel.message,
      details: {
        severity: viewModel.severity,
        lifecycleStatus: viewModel.lifecycleStatus,
        errorCount: viewModel.errorCount,
        primaryError: viewModel.primaryError,
        errors: viewModel.errors,
      },
    });

    setDatasetValue(refs.root, "errorPanelVisible", "true");
    setDatasetValue(refs.root, "errorPanelSeverity", viewModel.severity);
    setDatasetValue(refs.root, "errorPanelErrorCount", viewModel.errorCount);
    setDatasetValue(refs.root, "errorPanelUpdatedAt", viewModel.updatedAt);
    setDatasetValue(refs.root, "errorPanelPrimaryCode", viewModel.primaryError?.code ?? null);
    setDatasetValue(refs.root, "errorPanelRetryable", viewModel.primaryError?.retryable ?? null);

    if (options.showDetailsInDom && refs.errorText) {
      clearElement(refs.errorText);

      const message = document.createElement("p");
      message.textContent = viewModel.message;
      message.style.margin = "0";

      refs.errorText.appendChild(message);
      refs.errorText.appendChild(createDetailsElement(viewModel));
    } else {
      setText(refs.errorText, viewModel.message);
    }

    if (options.updateLiveRegion) {
      setDomLiveMessage(refs, `${viewModel.title}: ${viewModel.message}`);
    }
  } catch {
    // Error UI must not throw into runtime.
  }
}

function viewModelsEqual(left: ErrorPanelViewModel | null, right: ErrorPanelViewModel): boolean {
  try {
    if (!left) {
      return false;
    }

    return (
      left.visible === right.visible
      && left.severity === right.severity
      && left.title === right.title
      && left.message === right.message
      && left.lifecycleStatus === right.lifecycleStatus
      && left.errorCount === right.errorCount
      && left.primaryError?.id === right.primaryError?.id
      && left.primaryError?.message === right.primaryError?.message
    );
  } catch {
    return false;
  }
}

function clearErrorState(store: EditorStore, reason: string): void {
  try {
    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "ui/clear-error",
        source: reason,
        createdAt: now(),
      }),
      {
        action: "error-panel.clear-error",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store clear is best-effort.
  }
}

export function createErrorPanel(options: ErrorPanelOptions): ErrorPanelHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;
  const maxErrors = normalizeMaxErrors(options.maxErrors);
  const clearWhenNoError = safeBoolean(options.clearWhenNoError, true);
  const updateLiveRegion = safeBoolean(options.updateLiveRegion, true);
  const showDetailsInDom = safeBoolean(options.showDetailsInDom, true);
  const autoRender = safeBoolean(options.autoRender, true);

  const createdAt = now();

  let status: ErrorPanelStatus = "created";
  let enabled = options.enabled ?? true;
  let visible = options.visible ?? false;
  let mounted = false;
  let disposed = false;
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let renderCount = 0;
  let showCount = 0;
  let hideCount = 0;
  let retryCount = 0;
  let dismissCount = 0;
  let lastRenderAt: string | null = null;
  let lastReason: string | null = null;
  let lastViewModel: ErrorPanelViewModel | null = null;
  let lastError: Record<string, unknown> | null = null;
  let unsubscribe: EditorStoreUnsubscribe | null = null;

  function setStatus(nextStatus: ErrorPanelStatus, reason?: string | null): void {
    status = nextStatus;
    updatedAt = now();
    lastReason = reason ?? lastReason;

    setDatasetValue(refs.root, "errorPanelStatus", nextStatus);
    setDatasetValue(refs.root, "errorPanelUpdatedAt", updatedAt);
  }

  function setError(error: unknown): void {
    const normalized = normalizeUnknownError(error);
    lastError = normalized;
    setStatus("failed", safeString(normalized.message, "Error panel failed."));

    logWarn(logger, "Error panel failed.", {
      error: lastError,
    });
  }

  function assertAlive(action: string): boolean {
    if (disposed || status === "disposed") {
      logWarn(logger, "Error panel action ignored because handle is disposed.", {
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

    if (!enabled) {
      return;
    }

    try {
      const currentState = state ?? store.peekState();
      const viewModel = buildViewModelFromState(currentState, {
        maxErrors,
      });

      if (!viewModel.visible && !clearWhenNoError) {
        return;
      }

      if (viewModelsEqual(lastViewModel, viewModel)) {
        return;
      }

      applyViewModelToDom(refs, viewModel, {
        updateLiveRegion,
        showDetailsInDom,
      });

      visible = viewModel.visible;
      lastViewModel = viewModel;
      renderCount += 1;
      lastRenderAt = now();
      setStatus(visible ? "visible" : "hidden", reason ?? "render");

      logDebug(logger, "Error panel rendered.", {
        visible,
        severity: viewModel.severity,
        errorCount: viewModel.errorCount,
        primaryCode: viewModel.primaryError?.code ?? null,
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
      setDatasetValue(refs.root, "errorPanelMounted", "true");
      setDatasetValue(refs.root, "errorPanelEnabled", enabled ? "true" : "false");
      setStatus(visible ? "visible" : "hidden", "mount");
      render(store.peekState(), "mount");

      logDebug(logger, "Error panel mounted.", {
        enabled,
        visible,
        autoRender,
      });
    } catch (error) {
      setError(error);
    }
  }

  function show(input: {
    readonly title?: string;
    readonly message: string;
    readonly severity?: ErrorPanelSeverity;
    readonly error?: unknown;
  }): void {
    if (!assertAlive("show")) {
      return;
    }

    try {
      const severity = normalizeSeverity(input.severity, "error");
      const errorItem = input.error
        ? unknownErrorToItem(input.error, severity)
        : null;
      const title = safeString(input.title, titleFromSeverity(severity));

      const viewModel: ErrorPanelViewModel = {
        visible: true,
        severity,
        title,
        message: safeString(input.message, "Unbekannter Editor-Fehler."),
        lifecycleStatus: store.peekState().lifecycle.status,
        errorCount: errorItem ? 1 : 0,
        primaryError: errorItem,
        errors: errorItem ? [errorItem] : [],
        updatedAt: now(),
      };

      applyViewModelToDom(refs, viewModel, {
        updateLiveRegion,
        showDetailsInDom,
      });

      visible = true;
      showCount += 1;
      lastViewModel = viewModel;
      setStatus("visible", "manual-show");
    } catch (error) {
      setError(error);
    }
  }

  function hide(reason?: string): void {
    if (!assertAlive("hide")) {
      return;
    }

    try {
      visible = false;
      hideCount += 1;
      clearDomFatalError(refs);
      setDatasetValue(refs.root, "errorPanelVisible", "false");
      setDatasetValue(refs.root, "errorPanelHideReason", reason ?? null);
      setStatus("hidden", reason ?? "hide");

      logDebug(logger, "Error panel hidden.", {
        reason: reason ?? null,
      });
    } catch (error) {
      setError(error);
    }
  }

  const handle: ErrorPanelHandle = {
    kind: ERROR_PANEL_KIND,

    mount,
    render,
    show,
    hide,

    clear(reason?: string): void {
      const clearReason = safeString(reason, "error-panel.clear");
      hide(clearReason);
      clearErrorState(store, clearReason);
      lastViewModel = null;
      lastError = null;
    },

    async retry(reason?: string): Promise<void> {
      if (!assertAlive("retry")) {
        return;
      }

      retryCount += 1;
      setDatasetValue(refs.root, "errorPanelLastRetryAt", now());
      setDatasetValue(refs.root, "errorPanelLastRetryReason", reason ?? null);

      try {
        await options.onRetry?.();
      } catch (error) {
        const normalized = normalizeUnknownError(error);
        setError(error);
        show({
          title: "Retry fehlgeschlagen",
          message: safeString(normalized.message, "Retry konnte nicht ausgeführt werden."),
          severity: "error",
          error,
        });
      }
    },

    dismiss(reason?: string): void {
      if (!assertAlive("dismiss")) {
        return;
      }

      dismissCount += 1;

      try {
        options.onDismiss?.();
      } catch (error) {
        logWarn(logger, "Error panel dismiss callback failed.", {
          error: normalizeUnknownError(error),
        });
      }

      hide(reason ?? "dismiss");
    },

    setEnabled(nextEnabled: boolean, reason?: string): void {
      if (!assertAlive("setEnabled")) {
        return;
      }

      enabled = safeBoolean(nextEnabled, enabled);
      setDatasetValue(refs.root, "errorPanelEnabled", enabled ? "true" : "false");

      if (!enabled) {
        hide(reason ?? "disabled");
        return;
      }

      render(store.peekState(), reason ?? "enabled");
    },

    getStatus(): ErrorPanelStatus {
      return status;
    },

    getSnapshot(): ErrorPanelSnapshot {
      return {
        kind: ERROR_PANEL_SNAPSHOT_KIND,
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
        retryCount,
        dismissCount,
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
        // Ignore.
      }

      mounted = false;
      setDatasetValue(refs.root, "errorPanelMounted", "false");
      setDatasetValue(refs.root, "errorPanelDisposeReason", disposeReason);
      setDatasetValue(refs.root, "errorPanelDisposedAt", disposedAt);
      setStatus("disposed", disposeReason);

      logDebug(logger, "Error panel disposed.", {
        reason: disposeReason,
        renderCount,
        showCount,
        hideCount,
        retryCount,
        dismissCount,
      });
    },
  };

  if (enabled && options.autoMount !== false) {
    mount();
  }

  return handle;
}

export function isErrorPanelHandle(value: unknown): value is ErrorPanelHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<ErrorPanelHandle>;

    return (
      record.kind === ERROR_PANEL_KIND
      && typeof record.mount === "function"
      && typeof record.render === "function"
      && typeof record.show === "function"
      && typeof record.dispose === "function"
    );
  } catch {
    return false;
  }
}