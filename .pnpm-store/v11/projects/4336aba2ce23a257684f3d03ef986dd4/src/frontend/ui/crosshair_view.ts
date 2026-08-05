// services/vectoplan-editor/src/frontend/ui/crosshair_view.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type CrosshairStatus =
  | "created"
  | "attached"
  | "visible"
  | "hidden"
  | "detached"
  | "disabled"
  | "failed"
  | "destroyed";

export type CrosshairVariant =
  | "neutral"
  | "target"
  | "place"
  | "remove"
  | "blocked"
  | "error";

export interface CrosshairViewUpdate {
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly variant?: CrosshairVariant;
  readonly pointerLocked?: boolean;
  readonly targetActive?: boolean;
  readonly canPlace?: boolean;
  readonly canRemove?: boolean;
  readonly blocked?: boolean;
  readonly label?: string | null;
  readonly source?: string;
}

export interface CrosshairViewOptions {
  readonly root: HTMLElement;
  readonly existingElement?: HTMLElement | null;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly enabled?: boolean;
  readonly visible?: boolean;
  readonly showOnlyWhenPointerLocked?: boolean;
  readonly createIfMissing?: boolean;
  readonly attachToRoot?: boolean;
  readonly autoAttach?: boolean;
  readonly variant?: CrosshairVariant;
  readonly label?: string | null;
  readonly className?: string;
  readonly zIndex?: number;
}

export interface CrosshairViewSnapshot {
  readonly kind: "crosshair-view-snapshot.v1";
  readonly status: CrosshairStatus;
  readonly enabled: boolean;
  readonly visible: boolean;
  readonly attached: boolean;
  readonly destroyed: boolean;
  readonly pointerLocked: boolean;
  readonly showOnlyWhenPointerLocked: boolean;
  readonly variant: CrosshairVariant;
  readonly label: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly attachedAt: string | null;
  readonly detachedAt: string | null;
  readonly destroyedAt: string | null;
  readonly updateCount: number;
  readonly showCount: number;
  readonly hideCount: number;
  readonly errorCount: number;
  readonly lastSource: string | null;
  readonly lastErrorAt: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface CrosshairViewHandle {
  readonly kind: "vectoplan-editor-crosshair-view.v1";

  attach(): void;
  detach(reason?: string): void;

  enable(reason?: string): void;
  disable(reason?: string): void;

  show(reason?: string): void;
  hide(reason?: string): void;

  setVariant(variant: CrosshairVariant, reason?: string): void;
  setPointerLocked(pointerLocked: boolean, reason?: string): void;
  update(input: CrosshairViewUpdate): void;

  getElement(): HTMLElement | null;
  getStatus(): CrosshairStatus;
  getSnapshot(): CrosshairViewSnapshot;

  destroy(reason?: string): void;
}

const CROSSHAIR_VIEW_KIND = "vectoplan-editor-crosshair-view.v1" as const;
const CROSSHAIR_VIEW_SNAPSHOT_KIND = "crosshair-view-snapshot.v1" as const;

const DEFAULT_CLASS_NAME = "vectoplan-editor-crosshair";
const DEFAULT_Z_INDEX = 70;

type CrosshairPartKey =
  | "center"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "label";

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
        message: "Unknown crosshair view error.",
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
    // Crosshair logging must never break UI runtime.
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
    // Crosshair logging must never break UI runtime.
  }
}

function normalizeVariant(value: unknown, fallback: CrosshairVariant): CrosshairVariant {
  try {
    if (
      value === "neutral"
      || value === "target"
      || value === "place"
      || value === "remove"
      || value === "blocked"
      || value === "error"
    ) {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeLabel(value: unknown): string | null {
  try {
    const label = safeString(value, "").trim();
    return label.length > 0 ? label : null;
  } catch {
    return null;
  }
}

function sourceLabel(value: unknown, fallback: string): string {
  try {
    const source = safeString(value, "").trim();
    return source || fallback;
  } catch {
    return fallback;
  }
}

function normalizeRootClassName(value: unknown): string {
  try {
    const normalized = safeString(value, DEFAULT_CLASS_NAME).trim();

    if (!normalized) {
      return DEFAULT_CLASS_NAME;
    }

    return normalized
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  } catch {
    return DEFAULT_CLASS_NAME;
  }
}

function baseClassNameFromRootClassName(value: string): string {
  try {
    return value.split(/\s+/).find(Boolean) ?? DEFAULT_CLASS_NAME;
  } catch {
    return DEFAULT_CLASS_NAME;
  }
}

function normalizeZIndex(value: unknown): number {
  try {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value.trim(), 10);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return DEFAULT_Z_INDEX;
  } catch {
    return DEFAULT_Z_INDEX;
  }
}

function isHTMLElement(value: unknown): value is HTMLElement {
  try {
    return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
  } catch {
    return false;
  }
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  return element;
}

function setElementText(element: HTMLElement | null, text: string): void {
  try {
    if (element) {
      element.textContent = text;
    }
  } catch {
    // Text is decorative only.
  }
}

function applyBaseRootStyle(element: HTMLElement, zIndex: number): void {
  try {
    const style = element.style;

    style.position = "absolute";
    style.left = "50%";
    style.top = "50%";
    style.width = "40px";
    style.height = "40px";
    style.transform = "translate(-50%, -50%)";
    style.pointerEvents = "none";
    style.userSelect = "none";
    style.zIndex = String(zIndex);
    style.display = "flex";
    style.alignItems = "center";
    style.justifyContent = "center";
    style.contain = "layout style paint";
  } catch {
    // Inline styling is best-effort.
  }
}

function applyPartStyle(
  element: HTMLElement,
  input: {
    readonly position: "center" | "top" | "right" | "bottom" | "left";
    readonly width: string;
    readonly height: string;
    readonly borderRadius?: string;
    readonly transform?: string;
  },
): void {
  try {
    const style = element.style;

    style.position = "absolute";
    style.width = input.width;
    style.height = input.height;
    style.borderRadius = input.borderRadius ?? "999px";
    style.left = "50%";
    style.top = "50%";
    style.transform = input.transform ?? "translate(-50%, -50%)";
    style.background = "currentColor";
    style.boxShadow = "0 0 2px rgba(0, 0, 0, 0.95), 0 0 5px rgba(0, 0, 0, 0.55)";
    style.opacity = "1";

    if (input.position === "top") {
      style.transform = "translate(-50%, -155%)";
    }

    if (input.position === "right") {
      style.transform = "translate(60%, -50%)";
    }

    if (input.position === "bottom") {
      style.transform = "translate(-50%, 60%)";
    }

    if (input.position === "left") {
      style.transform = "translate(-160%, -50%)";
    }
  } catch {
    // Decorative styling is best-effort.
  }
}

function applyLabelStyle(element: HTMLElement): void {
  try {
    const style = element.style;

    style.position = "absolute";
    style.left = "50%";
    style.top = "calc(50% + 24px)";
    style.maxWidth = "240px";
    style.overflow = "hidden";
    style.transform = "translateX(-50%)";
    style.font = "600 11px/1.2 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    style.letterSpacing = "0.02em";
    style.whiteSpace = "nowrap";
    style.textOverflow = "ellipsis";
    style.color = "currentColor";
    style.textShadow = "0 1px 3px rgba(0,0,0,0.75)";
    style.opacity = "0";
    style.pointerEvents = "none";
  } catch {
    // Label style is best-effort.
  }
}

function variantColor(variant: CrosshairVariant): string {
  switch (variant) {
    case "place":
      return "rgba(120, 255, 160, 0.95)";
    case "remove":
      return "rgba(255, 210, 95, 0.95)";
    case "blocked":
      return "rgba(255, 85, 85, 0.98)";
    case "error":
      return "rgba(255, 65, 65, 0.98)";
    case "target":
      return "rgba(255, 255, 255, 0.95)";
    case "neutral":
    default:
      return "rgba(255, 255, 255, 0.86)";
  }
}

function variantOpacity(variant: CrosshairVariant): string {
  switch (variant) {
    case "blocked":
    case "error":
      return "1";
    case "place":
    case "remove":
    case "target":
      return "0.95";
    case "neutral":
    default:
      return "0.88";
  }
}

function deriveVariantFromUpdate(
  input: CrosshairViewUpdate,
  fallback: CrosshairVariant,
): CrosshairVariant {
  try {
    if (input.variant) {
      return normalizeVariant(input.variant, fallback);
    }

    if (input.blocked) {
      return "blocked";
    }

    if (input.canRemove) {
      return "remove";
    }

    if (input.canPlace) {
      return "place";
    }

    if (input.targetActive) {
      return "target";
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function ensureRootPositioning(root: HTMLElement): void {
  try {
    const computed = typeof window !== "undefined"
      ? window.getComputedStyle(root)
      : null;
    const position = computed?.position;

    if (!position || position === "static") {
      root.style.position = "relative";
    }
  } catch {
    // Root positioning is best-effort.
  }
}

function partClassName(baseClassName: string, part: CrosshairPartKey): string {
  if (part === "center") {
    return `${baseClassName}__center`;
  }

  if (part === "label") {
    return `${baseClassName}__label`;
  }

  return `${baseClassName}__line ${baseClassName}__line--${part}`;
}

function primaryPartClassName(baseClassName: string, part: CrosshairPartKey): string {
  return partClassName(baseClassName, part).split(/\s+/)[0] ?? `${baseClassName}__${part}`;
}

function findPartByClassName(root: HTMLElement, baseClassName: string, part: CrosshairPartKey): HTMLElement | null {
  try {
    const className = primaryPartClassName(baseClassName, part);
    const matches = root.getElementsByClassName(className);
    const first = matches.item(0);

    return isHTMLElement(first) ? first : null;
  } catch {
    return null;
  }
}

function findPart(root: HTMLElement, part: CrosshairPartKey, baseClassName: string): HTMLElement | null {
  try {
    const byData = root.querySelector(`[data-crosshair-part="${part}"]`);

    if (isHTMLElement(byData)) {
      return byData;
    }

    return findPartByClassName(root, baseClassName, part);
  } catch {
    return findPartByClassName(root, baseClassName, part);
  }
}

function ensurePart(root: HTMLElement, baseClassName: string, part: CrosshairPartKey): HTMLElement {
  try {
    const existing = findPart(root, part, baseClassName);

    if (existing) {
      existing.dataset.crosshairPart = part;
      existing.setAttribute("aria-hidden", "true");
      return existing;
    }

    const element = createElement("span", partClassName(baseClassName, part));
    element.dataset.crosshairPart = part;
    element.setAttribute("aria-hidden", "true");
    root.appendChild(element);

    return element;
  } catch {
    const fallback = document.createElement("span");
    fallback.dataset.crosshairPart = part;
    root.appendChild(fallback);
    return fallback;
  }
}

function ensureCrosshairStructure(root: HTMLElement, rootClassName: string, zIndex: number): void {
  const baseClassName = baseClassNameFromRootClassName(rootClassName);

  try {
    root.classList.add(...rootClassName.split(/\s+/).filter(Boolean));
  } catch {
    root.className = rootClassName;
  }

  applyBaseRootStyle(root, zIndex);

  const center = ensurePart(root, baseClassName, "center");
  const top = ensurePart(root, baseClassName, "top");
  const right = ensurePart(root, baseClassName, "right");
  const bottom = ensurePart(root, baseClassName, "bottom");
  const left = ensurePart(root, baseClassName, "left");
  const label = ensurePart(root, baseClassName, "label");

  applyPartStyle(center, {
    position: "center",
    width: "4px",
    height: "4px",
  });

  applyPartStyle(top, {
    position: "top",
    width: "2px",
    height: "8px",
  });

  applyPartStyle(right, {
    position: "right",
    width: "8px",
    height: "2px",
  });

  applyPartStyle(bottom, {
    position: "bottom",
    width: "2px",
    height: "8px",
  });

  applyPartStyle(left, {
    position: "left",
    width: "8px",
    height: "2px",
  });

  applyLabelStyle(label);

  try {
    root.setAttribute("aria-hidden", "true");
    root.dataset.editorCrosshair = "true";
  } catch {
    // Attributes are diagnostic only.
  }
}

function createCrosshairElement(className: string, zIndex: number): HTMLElement {
  const element = createElement("div", className);

  ensureCrosshairStructure(element, className, zIndex);

  try {
    element.dataset.crosshairVariant = "neutral";
    element.dataset.crosshairVisible = "false";
  } catch {
    // Attributes are diagnostic only.
  }

  return element;
}

function applyVisibility(
  element: HTMLElement,
  visible: boolean,
  variant: CrosshairVariant,
): void {
  try {
    element.hidden = !visible;
    element.style.opacity = visible ? variantOpacity(variant) : "0";
    element.style.visibility = visible ? "visible" : "hidden";
    element.style.display = "flex";
    element.dataset.crosshairVisible = visible ? "true" : "false";
  } catch {
    // Visibility is best-effort.
  }
}

function applyVariant(
  element: HTMLElement,
  variant: CrosshairVariant,
): void {
  try {
    element.style.color = variantColor(variant);
    element.dataset.crosshairVariant = variant;
  } catch {
    // Variant is decorative only.
  }
}

function applyLabel(
  element: HTMLElement,
  baseClassName: string,
  variant: CrosshairVariant,
  label: string | null,
): void {
  try {
    const labelElement = findPart(element, "label", baseClassName);

    if (!labelElement) {
      return;
    }

    setElementText(labelElement, label ?? "");

    const shouldShowLabel = Boolean(label) && (variant === "blocked" || variant === "error");

    labelElement.style.opacity = shouldShowLabel ? "1" : "0";
    labelElement.dataset.crosshairLabelVisible = shouldShowLabel ? "true" : "false";
  } catch {
    // Label is diagnostic/decorative only.
  }
}

function initialVisibleFromOptions(options: CrosshairViewOptions): boolean {
  try {
    if (typeof options.visible === "boolean") {
      return options.visible;
    }

    const existing = options.existingElement;

    if (!existing) {
      return true;
    }

    if (existing.hidden) {
      return false;
    }

    if (existing.dataset.crosshairVisible === "false") {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

function initialEnabledFromOptions(options: CrosshairViewOptions): boolean {
  try {
    if (typeof options.enabled === "boolean") {
      return options.enabled;
    }

    const existing = options.existingElement;

    if (!existing) {
      return true;
    }

    if (existing.dataset.crosshairEnabled === "false") {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

export function createCrosshairView(options: CrosshairViewOptions): CrosshairViewHandle {
  const logger = options.logger;
  const root = options.root;
  const className = normalizeRootClassName(options.className);
  const baseClassName = baseClassNameFromRootClassName(className);
  const zIndex = normalizeZIndex(options.zIndex);

  const createdAt = now();

  let element: HTMLElement | null = options.existingElement ?? null;
  let ownsElement = false;

  let status: CrosshairStatus = "created";
  let enabled = initialEnabledFromOptions(options);
  let visible = initialVisibleFromOptions(options);
  let attached = false;
  let destroyed = false;
  let pointerLocked = safeBoolean(options.existingElement?.dataset.crosshairPointerLocked, false);
  let showOnlyWhenPointerLocked = safeBoolean(options.showOnlyWhenPointerLocked, false);
  let variant = normalizeVariant(options.variant ?? options.existingElement?.dataset.crosshairVariant, "neutral");
  let label = normalizeLabel(options.label);

  let updatedAt = createdAt;
  let attachedAt: string | null = null;
  let detachedAt: string | null = null;
  let destroyedAt: string | null = null;

  let updateCount = 0;
  let showCount = 0;
  let hideCount = 0;
  let errorCount = 0;

  let lastSource: string | null = null;
  let lastErrorAt: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  const cleanupCallbacks: Array<() => void> = [];

  function effectiveVisible(): boolean {
    try {
      if (!enabled || destroyed) {
        return false;
      }

      if (showOnlyWhenPointerLocked && !pointerLocked) {
        return false;
      }

      return visible;
    } catch {
      return false;
    }
  }

  function setStatus(nextStatus: CrosshairStatus): void {
    try {
      status = nextStatus;
      updatedAt = now();
    } catch {
      status = nextStatus;
    }
  }

  function setError(error: unknown, source?: string): void {
    try {
      lastError = normalizeErrorRecord(error);
      lastErrorAt = now();
      lastSource = sourceLabel(source, "crosshair.error");
      errorCount += 1;
      setStatus("failed");
    } catch {
      status = "failed";
    }
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed") {
      logWarn(logger, "Crosshair action ignored because view is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function ensureElement(): HTMLElement | null {
    try {
      if (element) {
        ensureCrosshairStructure(element, className, zIndex);
        return element;
      }

      if (options.createIfMissing === false) {
        return null;
      }

      element = createCrosshairElement(className, zIndex);
      ownsElement = true;

      return element;
    } catch (error) {
      setError(error, "crosshair.ensure-element");
      return null;
    }
  }

  function render(source: string): void {
    try {
      const current = ensureElement();

      if (!current) {
        return;
      }

      ensureCrosshairStructure(current, className, zIndex);
      applyVariant(current, variant);
      applyLabel(current, baseClassName, variant, label);
      applyVisibility(current, effectiveVisible(), variant);

      current.dataset.crosshairEnabled = enabled ? "true" : "false";
      current.dataset.crosshairPointerLocked = pointerLocked ? "true" : "false";
      current.dataset.crosshairShowOnlyWhenPointerLocked = showOnlyWhenPointerLocked ? "true" : "false";
      current.dataset.crosshairUpdatedAt = now();

      lastSource = source;
      updatedAt = now();

      if (effectiveVisible()) {
        setStatus("visible");
      } else {
        setStatus(enabled ? "hidden" : "disabled");
      }
    } catch (error) {
      setError(error, source);
    }
  }

  function attachAbortSignal(): void {
    try {
      const signal = options.signal;

      if (!signal) {
        return;
      }

      if (signal.aborted) {
        handle.destroy("abort-signal-already-aborted");
        return;
      }

      const onAbort = (): void => {
        handle.destroy("abort-signal");
      };

      signal.addEventListener("abort", onAbort, {
        once: true,
      });

      cleanupCallbacks.push(() => {
        try {
          signal.removeEventListener("abort", onAbort);
        } catch {
          // Ignore cleanup failure.
        }
      });
    } catch {
      // Abort wiring is best-effort.
    }
  }

  function detachCleanup(): void {
    try {
      for (const cleanup of cleanupCallbacks.splice(0)) {
        try {
          cleanup();
        } catch {
          // Continue cleanup chain.
        }
      }
    } catch {
      // Ignore cleanup chain failure.
    }
  }

  function snapshot(): CrosshairViewSnapshot {
    return {
      kind: CROSSHAIR_VIEW_SNAPSHOT_KIND,
      status,
      enabled,
      visible,
      attached,
      destroyed,
      pointerLocked,
      showOnlyWhenPointerLocked,
      variant,
      label,
      createdAt,
      updatedAt,
      attachedAt,
      detachedAt,
      destroyedAt,
      updateCount,
      showCount,
      hideCount,
      errorCount,
      lastSource,
      lastErrorAt,
      lastError,
    };
  }

  const handle: CrosshairViewHandle = {
    kind: CROSSHAIR_VIEW_KIND,

    attach(): void {
      if (!assertAlive("attach")) {
        return;
      }

      if (attached) {
        render("crosshair.attach.already-attached");
        return;
      }

      try {
        const current = ensureElement();

        if (!current) {
          setStatus("failed");
          lastError = {
            name: "CrosshairElementMissing",
            message: "Crosshair element is missing and createIfMissing is false.",
          };
          lastErrorAt = now();
          errorCount += 1;
          return;
        }

        ensureRootPositioning(root);

        if (options.attachToRoot !== false && current.parentElement !== root) {
          root.appendChild(current);
        }

        attached = true;
        attachedAt = now();

        attachAbortSignal();
        render("crosshair.attach");

        logDebug(logger, "Crosshair view attached.", {
          enabled,
          visible,
          variant,
          ownsElement,
        });
      } catch (error) {
        setError(error, "crosshair.attach");
        logWarn(logger, "Crosshair attach failed.", {
          error: normalizeErrorRecord(error),
        });
      }
    },

    detach(reason?: string): void {
      if (destroyed) {
        return;
      }

      const source = sourceLabel(reason, "crosshair.detach");

      try {
        detachCleanup();

        if (ownsElement && element?.parentElement) {
          element.parentElement.removeChild(element);
        } else if (element) {
          applyVisibility(element, false, variant);
        }

        attached = false;
        detachedAt = now();
        setStatus(enabled ? "detached" : "disabled");
        lastSource = source;

        logDebug(logger, "Crosshair view detached.", {
          reason: source,
        });
      } catch (error) {
        setError(error, source);
      }
    },

    enable(reason?: string): void {
      if (!assertAlive("enable")) {
        return;
      }

      try {
        enabled = true;
        render(sourceLabel(reason, "crosshair.enable"));
      } catch (error) {
        setError(error, "crosshair.enable");
      }
    },

    disable(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        enabled = false;
        render(sourceLabel(reason, "crosshair.disable"));
      } catch (error) {
        setError(error, "crosshair.disable");
      }
    },

    show(reason?: string): void {
      if (!assertAlive("show")) {
        return;
      }

      try {
        visible = true;
        showCount += 1;
        render(sourceLabel(reason, "crosshair.show"));
      } catch (error) {
        setError(error, "crosshair.show");
      }
    },

    hide(reason?: string): void {
      if (destroyed) {
        return;
      }

      try {
        visible = false;
        hideCount += 1;
        render(sourceLabel(reason, "crosshair.hide"));
      } catch (error) {
        setError(error, "crosshair.hide");
      }
    },

    setVariant(nextVariant: CrosshairVariant, reason?: string): void {
      if (!assertAlive("setVariant")) {
        return;
      }

      try {
        variant = normalizeVariant(nextVariant, variant);
        updateCount += 1;
        render(sourceLabel(reason, "crosshair.set-variant"));
      } catch (error) {
        setError(error, "crosshair.set-variant");
      }
    },

    setPointerLocked(nextPointerLocked: boolean, reason?: string): void {
      if (!assertAlive("setPointerLocked")) {
        return;
      }

      try {
        pointerLocked = safeBoolean(nextPointerLocked, false);
        updateCount += 1;
        render(sourceLabel(reason, "crosshair.set-pointer-locked"));
      } catch (error) {
        setError(error, "crosshair.set-pointer-locked");
      }
    },

    update(input: CrosshairViewUpdate): void {
      if (!assertAlive("update")) {
        return;
      }

      const source = sourceLabel(input.source, "crosshair.update");

      try {
        if (typeof input.enabled === "boolean") {
          enabled = input.enabled;
        }

        if (typeof input.visible === "boolean") {
          visible = input.visible;
        }

        if (typeof input.pointerLocked === "boolean") {
          pointerLocked = input.pointerLocked;
        }

        variant = deriveVariantFromUpdate(input, variant);

        if ("label" in input) {
          label = normalizeLabel(input.label);
        }

        updateCount += 1;
        render(source);
      } catch (error) {
        setError(error, source);
      }
    },

    getElement(): HTMLElement | null {
      return element;
    },

    getStatus(): CrosshairStatus {
      return status;
    },

    getSnapshot(): CrosshairViewSnapshot {
      return snapshot();
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      const source = sourceLabel(reason, "crosshair.destroy");

      try {
        detachCleanup();

        if (ownsElement && element?.parentElement) {
          element.parentElement.removeChild(element);
          element = null;
        } else if (element) {
          applyVisibility(element, false, variant);
          element.dataset.crosshairEnabled = "false";
          element.dataset.crosshairVisible = "false";
        }

        destroyed = true;
        destroyedAt = now();
        attached = false;
        enabled = false;
        visible = false;
        setStatus("destroyed");
        lastSource = source;

        logDebug(logger, "Crosshair view destroyed.", {
          reason: source,
          updateCount,
          showCount,
          hideCount,
          errorCount,
        });
      } catch (error) {
        destroyed = true;
        destroyedAt = now();
        setError(error, source);
      }
    },
  };

  if (options.autoAttach === true) {
    handle.attach();
  }

  return handle;
}

export function isCrosshairViewHandle(value: unknown): value is CrosshairViewHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<CrosshairViewHandle>;

    return (
      record.kind === CROSSHAIR_VIEW_KIND
      && typeof record.attach === "function"
      && typeof record.update === "function"
      && typeof record.getSnapshot === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}