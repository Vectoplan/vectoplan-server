// services/vectoplan-editor/src/frontend/render/debug_overlay.ts
import type { EditorDomRefs } from "@dom/dom_refs";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, previewValue, safeBoolean, safeInteger, safeString } from "@utils/safe";
import { formatDurationMs, nowIsoString } from "@utils/time";
import type { EditorStore, EditorStoreUnsubscribe } from "@state/editor_store";
import type { EditorState } from "@state/editor_state";
import {
  selectCommandSummary,
  selectDebugSummary,
  selectRender,
  selectRuntimeReadiness,
  selectSelectedBlockSummary,
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
  readonly updateIntervalMs?: number;
  readonly maxErrorCount?: number;
  readonly attachTo?: HTMLElement | null;
}

export interface DebugOverlaySnapshot {
  readonly kind: "debug-overlay-snapshot.v1";
  readonly status: DebugOverlayStatus;
  readonly enabled: boolean;
  readonly visible: boolean;
  readonly mounted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly renderCount: number;
  readonly lastRenderAt: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface DebugOverlayHandle {
  readonly kind: "vectoplan-editor-debug-overlay.v1";

  mount(): void;
  render(state?: EditorState): void;
  show(reason?: string): void;
  hide(reason?: string): void;
  toggle(reason?: string): boolean;
  setEnabled(enabled: boolean, reason?: string): void;

  getStatus(): DebugOverlayStatus;
  getElement(): HTMLElement | null;
  getSnapshot(): DebugOverlaySnapshot;

  dispose(reason?: string): void;
}

const DEBUG_OVERLAY_KIND = "vectoplan-editor-debug-overlay.v1" as const;
const DEBUG_OVERLAY_SNAPSHOT_KIND = "debug-overlay-snapshot.v1" as const;
const DEFAULT_UPDATE_INTERVAL_MS = 250;
const DEFAULT_MAX_ERROR_COUNT = 5;

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Debug overlay logging must never throw.
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
    // Debug overlay logging must never throw.
  }
}

function normalizeInterval(value: unknown): number {
  return safeInteger(value, DEFAULT_UPDATE_INTERVAL_MS, {
    min: 50,
    max: 5_000,
  });
}

function normalizeMaxErrorCount(value: unknown): number {
  return safeInteger(value, DEFAULT_MAX_ERROR_COUNT, {
    min: 0,
    max: 50,
  });
}

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function createOverlayElement(): HTMLElement {
  const element = document.createElement("aside");
  element.className = "vp-debug-overlay";
  element.dataset.editorDebugOverlay = "true";
  element.setAttribute("aria-label", "VECTOPLAN Editor Debug Overlay");

  element.style.position = "absolute";
  element.style.left = "12px";
  element.style.bottom = "84px";
  element.style.zIndex = "32";
  element.style.width = "min(420px, calc(100vw - 24px))";
  element.style.maxHeight = "min(52vh, 520px)";
  element.style.overflow = "auto";
  element.style.padding = "10px";
  element.style.border = "1px solid rgba(148, 163, 184, 0.24)";
  element.style.borderRadius = "14px";
  element.style.background = "rgba(15, 23, 42, 0.78)";
  element.style.color = "#e5e7eb";
  element.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  element.style.fontSize = "11px";
  element.style.lineHeight = "1.42";
  element.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.35)";
  element.style.backdropFilter = "blur(14px)";
  element.style.pointerEvents = "none";
  element.style.whiteSpace = "normal";

  return element;
}

function clearElement(element: HTMLElement): void {
  try {
    element.textContent = "";
  } catch {
    // Ignore.
  }
}

function createSection(title: string): HTMLElement {
  const section = document.createElement("section");
  section.style.margin = "0 0 8px";

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.margin = "0 0 4px";
  heading.style.color = "#93c5fd";
  heading.style.fontWeight = "700";
  heading.style.letterSpacing = "0.04em";
  heading.style.textTransform = "uppercase";

  section.appendChild(heading);
  return section;
}

function createLine(label: string, value: unknown): HTMLElement {
  const line = document.createElement("div");
  line.style.display = "grid";
  line.style.gridTemplateColumns = "130px minmax(0, 1fr)";
  line.style.gap = "8px";
  line.style.alignItems = "start";
  line.style.margin = "1px 0";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  labelElement.style.color = "#94a3b8";

  const valueElement = document.createElement("span");
  valueElement.textContent = stringifyDebugValue(value);
  valueElement.style.color = "#e5e7eb";
  valueElement.style.overflowWrap = "anywhere";

  line.appendChild(labelElement);
  line.appendChild(valueElement);

  return line;
}

function createDivider(): HTMLElement {
  const divider = document.createElement("div");
  divider.style.height = "1px";
  divider.style.margin = "8px 0";
  divider.style.background = "rgba(148, 163, 184, 0.18)";
  return divider;
}

function stringifyDebugValue(value: unknown): string {
  try {
    if (value === null || value === undefined) {
      return "—";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    if (Array.isArray(value)) {
      return value.length === 0 ? "[]" : value.map((item) => stringifyDebugValue(item)).join(", ");
    }

    const preview = previewValue(value, 360);

    if (typeof preview === "string") {
      return preview;
    }

    return JSON.stringify(preview);
  } catch {
    return "[unreadable]";
  }
}

function setVisible(element: HTMLElement | null, visible: boolean): void {
  try {
    if (!element) {
      return;
    }

    element.hidden = !visible;
    element.style.display = visible ? "block" : "none";
    element.dataset.visible = visible ? "true" : "false";
  } catch {
    // Ignore.
  }
}

function setRootDataset(refs: EditorDomRefs, key: string, value: unknown): void {
  try {
    if (value === undefined || value === null) {
      delete refs.root.dataset[key];
      return;
    }

    refs.root.dataset[key] = String(value);
  } catch {
    // Ignore.
  }
}

function appendRuntimeSection(element: HTMLElement, state: EditorState): void {
  const section = createSection("Runtime");
  const readiness = selectRuntimeReadiness(state);
  const world = selectWorldSourceSummary(state);
  const render = selectRender(state);

  section.appendChild(createLine("Status", state.lifecycle.status));
  section.appendChild(createLine("Ready", readiness.canInteract));
  section.appendChild(createLine("Blocker", readiness.blockingReason));
  section.appendChild(createLine("Source", world.sourceKind));
  section.appendChild(createLine("World", `${world.projectId}/${world.worldId}`));
  section.appendChild(createLine("API", world.apiBaseUrl));
  section.appendChild(createLine("Chunks", `${world.loadedChunkCount} loaded · ${world.visibleChunkCount} visible · ${world.dirtyChunkCount} dirty`));
  section.appendChild(createLine("Frames", render.frameCount));
  section.appendChild(createLine("Avg frame", render.averageFrameMs === null ? "—" : formatDurationMs(render.averageFrameMs)));
  section.appendChild(createLine("Meshes", render.meshCount));

  element.appendChild(section);
}

function appendSelectionSection(element: HTMLElement, state: EditorState): void {
  const section = createSection("Selection");
  const selected = selectSelectedBlockSummary(state);
  const target = selectTargetSummary(state);
  const command = selectCommandSummary(state);

  section.appendChild(createLine("Block", selected ? `${selected.label} (${selected.blockTypeId})` : "—"));
  section.appendChild(createLine("Cell value", selected?.cellValue ?? null));
  section.appendChild(createLine("Target", `${target.kind}/${target.status}`));
  section.appendChild(createLine("Can place", target.canPlace));
  section.appendChild(createLine("Can remove", target.canRemove));
  section.appendChild(createLine("Chunk", target.chunkKey));
  section.appendChild(createLine("Reason", target.reason));
  section.appendChild(createLine("Command", command.status));
  section.appendChild(createLine("Dirty", command.dirtyChunkKeys));

  element.appendChild(section);
}

function appendDebugSection(
  element: HTMLElement,
  state: EditorState,
  maxErrorCount: number,
): void {
  const section = createSection("Debug");
  const debug = selectDebugSummary(state);
  const statusLine = selectStatusLine(state);

  section.appendChild(createLine("Status line", statusLine));
  section.appendChild(createLine("Last action", debug.lastAction));
  section.appendChild(createLine("Warnings", debug.warnings.slice(0, 3)));

  if (maxErrorCount > 0) {
    section.appendChild(createLine("Errors", debug.errors.slice(0, maxErrorCount).map((error) => error.message)));
  }

  if (debug.bootstrapWarnings.length > 0) {
    section.appendChild(createLine("Bootstrap", debug.bootstrapWarnings.slice(0, 3)));
  }

  element.appendChild(section);
}

function renderOverlayContent(
  element: HTMLElement,
  state: EditorState,
  maxErrorCount: number,
): void {
  clearElement(element);

  const header = document.createElement("div");
  header.textContent = "VECTOPLAN DEBUG";
  header.style.margin = "0 0 8px";
  header.style.color = "#facc15";
  header.style.fontWeight = "800";
  header.style.letterSpacing = "0.08em";

  element.appendChild(header);
  appendRuntimeSection(element, state);
  element.appendChild(createDivider());
  appendSelectionSection(element, state);
  element.appendChild(createDivider());
  appendDebugSection(element, state, maxErrorCount);
}

export function createDebugOverlay(options: DebugOverlayOptions): DebugOverlayHandle {
  const refs = options.refs;
  const store = options.store;
  const logger = options.logger;
  const updateIntervalMs = normalizeInterval(options.updateIntervalMs);
  const maxErrorCount = normalizeMaxErrorCount(options.maxErrorCount);

  const createdAt = now();
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let status: DebugOverlayStatus = "created";
  let disposed = false;
  let enabled = options.enabled ?? true;
  let visible = options.visible ?? safeBoolean(store.peekState().debug.enabled, true);
  let mounted = false;
  let element: HTMLElement | null = null;
  let unsubscribe: EditorStoreUnsubscribe | null = null;
  let renderCount = 0;
  let lastRenderAt: string | null = null;
  let lastError: Record<string, unknown> | null = null;
  let lastRenderMs = 0;

  function setStatus(nextStatus: DebugOverlayStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function setError(error: unknown): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed");
  }

  function assertAlive(action: string): void {
    if (disposed || status === "disposed") {
      throw new Error(`DebugOverlay is disposed. Action '${action}' is not allowed.`);
    }
  }

  function mount(): void {
    assertAlive("mount");

    if (mounted && element) {
      return;
    }

    try {
      element = createOverlayElement();

      const attachTarget = options.attachTo ?? refs.main ?? refs.root;
      attachTarget.appendChild(element);

      mounted = true;
      setStatus(visible ? "visible" : "hidden");
      setVisible(element, enabled && visible);
      setRootDataset(refs, "debugOverlayMounted", "true");

      unsubscribe = store.subscribe((state) => {
        if (!enabled || !visible || !element) {
          return;
        }

        const nowMs = performance.now();

        if (nowMs - lastRenderMs < updateIntervalMs) {
          return;
        }

        lastRenderMs = nowMs;
        handle.render(state);
      });

      handle.render(store.peekState());

      logDebug(logger, "Debug overlay mounted.", {
        visible,
        enabled,
        updateIntervalMs,
      });
    } catch (error) {
      setError(error);
      logWarn(logger, "Debug overlay mount failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function render(state?: EditorState): void {
    assertAlive("render");

    if (!enabled || !visible) {
      return;
    }

    try {
      if (!mounted || !element) {
        mount();
      }

      if (!element) {
        return;
      }

      const currentState = state ?? store.peekState();
      renderOverlayContent(element, currentState, maxErrorCount);

      renderCount += 1;
      lastRenderAt = now();
      updatedAt = lastRenderAt;
      setVisible(element, true);
      setStatus("visible");
    } catch (error) {
      setError(error);
      logWarn(logger, "Debug overlay render failed.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function show(reason?: string): void {
    assertAlive("show");

    enabled = true;
    visible = true;

    try {
      if (!mounted) {
        mount();
      }

      setVisible(element, true);
      setStatus("visible");
      setRootDataset(refs, "debugOverlayVisible", "true");
      render(store.peekState());

      logDebug(logger, "Debug overlay shown.", {
        reason: reason ?? null,
      });
    } catch (error) {
      setError(error);
    }
  }

  function hide(reason?: string): void {
    assertAlive("hide");

    visible = false;
    setVisible(element, false);
    setStatus("hidden");
    setRootDataset(refs, "debugOverlayVisible", "false");

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

    toggle(reason?: string): boolean {
      if (visible) {
        hide(reason ?? "toggle");
        return false;
      }

      show(reason ?? "toggle");
      return true;
    },

    setEnabled(nextEnabled: boolean, reason?: string): void {
      enabled = nextEnabled;

      if (!enabled) {
        hide(reason ?? "disabled");
        return;
      }

      if (visible) {
        show(reason ?? "enabled");
      }

      setRootDataset(refs, "debugOverlayEnabled", enabled ? "true" : "false");
    },

    getStatus(): DebugOverlayStatus {
      return status;
    },

    getElement(): HTMLElement | null {
      return element;
    },

    getSnapshot(): DebugOverlaySnapshot {
      return {
        kind: DEBUG_OVERLAY_SNAPSHOT_KIND,
        status,
        enabled,
        visible,
        mounted,
        createdAt,
        updatedAt,
        disposedAt,
        renderCount,
        lastRenderAt,
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
        element?.parentNode?.removeChild(element);
        element = null;
      } catch {
        // Ignore.
      }

      mounted = false;
      visible = false;
      setStatus("disposed");
      setRootDataset(refs, "debugOverlayMounted", "false");
      setRootDataset(refs, "debugOverlayVisible", "false");

      logDebug(logger, "Debug overlay disposed.", {
        reason: reason ?? null,
        renderCount,
      });
    },
  };

  if (enabled && visible) {
    try {
      mount();
    } catch {
      // mount handles errors.
    }
  }

  return handle;
}