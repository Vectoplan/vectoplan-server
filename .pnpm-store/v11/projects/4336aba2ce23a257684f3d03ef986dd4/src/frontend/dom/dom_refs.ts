// services/vectoplan-editor/src/frontend/dom/dom_refs.ts
import { createDomId } from "@utils/ids";
import { normalizeUnknownError, previewValue } from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type EditorSourceStatusKind =
  | "unknown"
  | "connecting"
  | "ready"
  | "degraded"
  | "failed"
  | "offline";

export type EditorCrosshairVariant =
  | "neutral"
  | "target"
  | "place"
  | "remove"
  | "blocked"
  | "error";

export interface EditorSourceStatusInput {
  readonly status: EditorSourceStatusKind;
  readonly label: string;
  readonly details?: Record<string, unknown>;
}

export interface EditorFatalErrorInput {
  readonly title?: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface EditorCrosshairDomInput {
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly variant?: EditorCrosshairVariant;
  readonly pointerLocked?: boolean;
  readonly label?: string | null;
  readonly source?: string;
}

export interface EditorDomRefs {
  readonly root: HTMLElement;
  readonly shell: HTMLElement | null;
  readonly topbar: HTMLElement | null;
  readonly main: HTMLElement | null;
  readonly canvasHost: HTMLElement;
  readonly canvas: HTMLCanvasElement | null;
  readonly viewportOverlay: HTMLElement | null;
  readonly crosshair: HTMLElement | null;
  readonly loadingOverlay: HTMLElement | null;
  readonly loadingText: HTMLElement | null;
  readonly errorOverlay: HTMLElement | null;
  readonly errorTitle: HTMLElement | null;
  readonly errorText: HTMLElement | null;
  readonly sourceStatus: HTMLElement | null;
  readonly sourceStatusDot: HTMLElement | null;
  readonly sourceStatusLabel: HTMLElement | null;
  readonly projectLabel: HTMLElement | null;
  readonly hotbar: HTMLElement | null;
  readonly hotbarSlots: HTMLElement | null;
  readonly liveRegion: HTMLElement | null;
  readonly leftPanel: HTMLElement | null;
  readonly rightPanel: HTMLElement | null;
  readonly inventoryPanel: HTMLElement | null;
  readonly inspectorPanel: HTMLElement | null;
}

export interface BindEditorDomRefsOptions {
  readonly createCanvasIfMissing?: boolean;
  readonly createViewportOverlayIfMissing?: boolean;
  readonly createCrosshairIfMissing?: boolean;
  readonly createHotbarIfMissing?: boolean;
}

export interface HotbarSlotRenderInput {
  readonly slot: number;
  readonly label: string;
  readonly shortLabel?: string | null;
  readonly title?: string | null;

  /**
   * Legacy alias.
   * For Library/VPLIB placement this should be the technical runtimeBlockTypeId.
   */
  readonly blockTypeId?: string | null;

  readonly runtimeBlockTypeId?: string | null;
  readonly libraryItemId?: string | null;
  readonly familyId?: string | null;
  readonly packageId?: string | null;
  readonly vplibUid?: string | null;
  readonly variantId?: string | null;
  readonly revisionHash?: string | null;
  readonly objectKind?: string | null;

  readonly sourceKind?: string | null;
  readonly itemKind?: string | null;
  readonly color?: string | null;
  readonly iconValue?: string | null;
  readonly iconKind?: string | null;
  readonly selected?: boolean;
  readonly enabled?: boolean;
  readonly empty?: boolean;
  readonly placeable?: boolean;
  readonly disabledReason?: string | null;
}

export interface NormalizedHotbarSlotRenderInput {
  readonly slot: number;
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
  readonly blockTypeId: string | null;
  readonly runtimeBlockTypeId: string | null;
  readonly libraryItemId: string | null;
  readonly familyId: string | null;
  readonly packageId: string | null;
  readonly vplibUid: string | null;
  readonly variantId: string | null;
  readonly revisionHash: string | null;
  readonly objectKind: string | null;
  readonly sourceKind: string | null;
  readonly itemKind: string | null;
  readonly color: string | null;
  readonly iconValue: string | null;
  readonly iconKind: string | null;
  readonly selected: boolean;
  readonly enabled: boolean;
  readonly empty: boolean;
  readonly placeable: boolean;
  readonly disabledReason: string | null;
}

export interface EditorDomSnapshot {
  readonly kind: "editor-dom-snapshot.v1";
  readonly bound: boolean;
  readonly rootId: string | null;
  readonly hasCanvasHost: boolean;
  readonly hasCanvas: boolean;
  readonly hasViewportOverlay: boolean;
  readonly hasCrosshair: boolean;
  readonly hasLoadingOverlay: boolean;
  readonly hasErrorOverlay: boolean;
  readonly hasHotbar: boolean;
  readonly sourceStatus: EditorSourceStatusKind;
  readonly loading: boolean;
  readonly fatalError: boolean;
  readonly hotbarVisible: boolean;
  readonly hotbarSlotCount: number;
  readonly hotbarSelectedSlot: number | null;
  readonly hotbarSelectedRuntimeBlockTypeId: string | null;
  readonly hotbarSelectedFamilyId: string | null;
  readonly hotbarSelectedVplibUid: string | null;
  readonly crosshairVisible: boolean;
  readonly projectId: string | null;
  readonly worldId: string | null;
  readonly inventoryRoute: string | null;
  readonly createdAt: string;
}

const DEFAULT_CANVAS_LABEL = "VECTOPLAN 3D Editor Viewport";
const DOM_SNAPSHOT_KIND = "editor-dom-snapshot.v1" as const;
const DEFAULT_INVENTORY_ROUTE = "/editor/api/inventory";

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

function queryOptional<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T | null {
  try {
    return root.querySelector<T>(selector);
  } catch {
    return null;
  }
}

function queryRequired<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
  message: string,
): T {
  try {
    const element = root.querySelector<T>(selector);

    if (!element) {
      throw new Error(message);
    }

    return element;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(message);
  }
}

function setText(element: HTMLElement | null, text: unknown): void {
  try {
    if (!element) {
      return;
    }

    element.textContent = typeof text === "string" ? text : String(text ?? "");
  } catch {
    // DOM updates must not throw.
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
    // DOM updates must not throw.
  }
}

function setDatasetValue(element: HTMLElement | null, key: string, value: unknown): void {
  try {
    if (!element) {
      return;
    }

    if (value === undefined || value === null || value === "") {
      delete element.dataset[key];
      return;
    }

    element.dataset[key] = String(value);
  } catch {
    // Dataset is diagnostic-only.
  }
}

function setClassFlag(element: HTMLElement | null, className: string, enabled: boolean): void {
  try {
    if (!element) {
      return;
    }

    element.classList.toggle(className, enabled);
  } catch {
    // Class flags are visual diagnostics only.
  }
}

function setAttributeValue(element: HTMLElement | null, attribute: string, value: unknown): void {
  try {
    if (!element) {
      return;
    }

    if (value === undefined || value === null || value === "") {
      element.removeAttribute(attribute);
      return;
    }

    element.setAttribute(attribute, String(value));
  } catch {
    // Attribute updates must not throw.
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

function safeString(value: unknown, fallback = ""): string {
  try {
    if (typeof value === "number" || typeof value === "boolean") {
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : fallback;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function safeNullableString(value: unknown): string | null {
  const normalized = safeString(value, "");
  return normalized.length > 0 ? normalized : null;
}

function safeInteger(
  value: unknown,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  try {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value.trim(), 10)
          : Number.NaN;

    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Math.trunc(numeric)));
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

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (
        normalized === "true"
        || normalized === "1"
        || normalized === "yes"
        || normalized === "on"
        || normalized === "enabled"
      ) {
        return true;
      }

      if (
        normalized === "false"
        || normalized === "0"
        || normalized === "no"
        || normalized === "off"
        || normalized === "disabled"
      ) {
        return false;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeStatus(status: unknown): EditorSourceStatusKind {
  try {
    if (typeof status !== "string") {
      return "unknown";
    }

    const normalized = status.trim().toLowerCase();

    if (
      normalized === "unknown"
      || normalized === "connecting"
      || normalized === "ready"
      || normalized === "degraded"
      || normalized === "failed"
      || normalized === "offline"
    ) {
      return normalized;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeCrosshairVariant(value: unknown): EditorCrosshairVariant {
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

    return "neutral";
  } catch {
    return "neutral";
  }
}

function statusLabelFor(status: EditorSourceStatusKind, label: string): string {
  const trimmed = label.trim();

  if (trimmed.length > 0) {
    return trimmed;
  }

  switch (status) {
    case "connecting":
      return "Chunk-Service wird verbunden";
    case "ready":
      return "Chunk-Service verbunden";
    case "degraded":
      return "Chunk-Service eingeschränkt";
    case "failed":
      return "Chunk-Service fehlgeschlagen";
    case "offline":
      return "Chunk-Service offline";
    case "unknown":
    default:
      return "Chunk-Service unbekannt";
  }
}

function safeSerializeDetails(value: unknown): string {
  try {
    const preview = previewValue(value, 1200);
    const serialized = JSON.stringify(preview);

    return typeof serialized === "string" ? serialized : "";
  } catch {
    return "";
  }
}

function normalizeErrorMessage(error: unknown): string {
  try {
    const normalized = normalizeUnknownError(error);

    if (normalized && typeof normalized === "object" && "message" in normalized) {
      const message = String((normalized as { readonly message?: unknown }).message ?? "");
      return message || "Unbekannter DOM-Fehler.";
    }

    return String(normalized);
  } catch {
    try {
      return error instanceof Error ? error.message : String(error);
    } catch {
      return "Unbekannter DOM-Fehler.";
    }
  }
}

function ensureElementId(element: HTMLElement, prefix: string): string {
  try {
    if (element.id && element.id.trim().length > 0) {
      return element.id;
    }

    element.id = createDomId(prefix);
    return element.id;
  } catch {
    return "";
  }
}

function ensureRootPositioning(root: HTMLElement): void {
  try {
    const computed = typeof window !== "undefined" ? window.getComputedStyle(root) : null;
    const position = computed?.position;

    if (!position || position === "static") {
      root.style.position = "relative";
    }
  } catch {
    // Root positioning is best-effort.
  }
}

function hardenCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  try {
    canvas.tabIndex = canvas.tabIndex >= 0 ? canvas.tabIndex : 0;
    canvas.setAttribute("aria-label", canvas.getAttribute("aria-label") || DEFAULT_CANVAS_LABEL);
    canvas.setAttribute("role", canvas.getAttribute("role") || "application");
    canvas.dataset.editorCanvas = "true";
    canvas.dataset.vectoplanCanvas = "true";
    canvas.style.touchAction = canvas.style.touchAction || "none";
    canvas.style.display = canvas.style.display || "block";
    canvas.style.width = canvas.style.width || "100%";
    canvas.style.height = canvas.style.height || "100%";
    canvas.style.outline = canvas.style.outline || "none";
  } catch {
    // Existing canvas hardening is best-effort.
  }

  return canvas;
}

function ensureCanvas(canvasHost: HTMLElement, existingCanvas: HTMLCanvasElement | null): HTMLCanvasElement {
  if (existingCanvas) {
    return hardenCanvas(existingCanvas);
  }

  const canvas = document.createElement("canvas");
  canvas.id = createDomId("vectoplan_editor_canvas");
  hardenCanvas(canvas);
  canvasHost.appendChild(canvas);

  return canvas;
}

function ensureLiveRegion(root: HTMLElement, existing: HTMLElement | null): HTMLElement {
  if (existing) {
    return existing;
  }

  const liveRegion = document.createElement("div");
  liveRegion.dataset.editorLiveRegion = "true";
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.className = "vp-visually-hidden";
  liveRegion.textContent = "VECTOPLAN Editor wird geladen.";

  root.appendChild(liveRegion);

  return liveRegion;
}

function ensureViewportOverlay(canvasHost: HTMLElement, existing: HTMLElement | null): HTMLElement {
  if (existing) {
    hardenViewportOverlay(existing);
    return existing;
  }

  const overlay = document.createElement("div");
  overlay.id = createDomId("vectoplan_editor_viewport_overlay");
  overlay.dataset.editorViewportOverlay = "true";
  overlay.dataset.editorOverlay = "viewport";

  hardenViewportOverlay(overlay);
  canvasHost.appendChild(overlay);

  return overlay;
}

function hardenViewportOverlay(overlay: HTMLElement): void {
  try {
    overlay.dataset.editorViewportOverlay = "true";
    overlay.style.position = overlay.style.position || "absolute";
    overlay.style.inset = overlay.style.inset || "0";
    overlay.style.pointerEvents = overlay.style.pointerEvents || "none";
    overlay.style.zIndex = overlay.style.zIndex || "40";
    overlay.style.overflow = overlay.style.overflow || "hidden";
  } catch {
    // Overlay hardening is best-effort.
  }
}

function createCrosshairElement(): HTMLElement {
  const crosshair = document.createElement("div");
  crosshair.id = createDomId("vectoplan_editor_crosshair");
  crosshair.dataset.editorCrosshair = "true";
  crosshair.dataset.crosshairVariant = "neutral";
  crosshair.dataset.crosshairVisible = "true";
  crosshair.setAttribute("aria-hidden", "true");

  try {
    crosshair.style.position = "absolute";
    crosshair.style.left = "50%";
    crosshair.style.top = "50%";
    crosshair.style.transform = "translate(-50%, -50%)";
    crosshair.style.width = "40px";
    crosshair.style.height = "40px";
    crosshair.style.pointerEvents = "none";
    crosshair.style.userSelect = "none";
    crosshair.style.zIndex = "70";
  } catch {
    // Crosshair inline fallback is best-effort.
  }

  return crosshair;
}

function ensureCrosshairElement(
  overlayOrHost: HTMLElement,
  existing: HTMLElement | null,
): HTMLElement {
  if (existing) {
    hardenCrosshairElement(existing);
    return existing;
  }

  const crosshair = createCrosshairElement();
  overlayOrHost.appendChild(crosshair);

  return crosshair;
}

function hardenCrosshairElement(crosshair: HTMLElement): void {
  try {
    crosshair.dataset.editorCrosshair = "true";
    crosshair.setAttribute("aria-hidden", "true");
    crosshair.style.pointerEvents = "none";
    crosshair.style.userSelect = "none";
  } catch {
    // Crosshair hardening is best-effort.
  }
}

function createHotbarElement(): {
  readonly hotbar: HTMLElement;
  readonly slots: HTMLElement;
} {
  const hotbar = document.createElement("div");
  hotbar.id = createDomId("vectoplan_editor_hotbar");
  hotbar.dataset.editorHotbar = "true";
  hotbar.dataset.hotbarVisible = "true";
  hotbar.dataset.hotbarKind = "vplib";
  hotbar.dataset.hotbarSource = "library";
  hotbar.dataset.hotbarOnlyLibraryItemsPlaceable = "true";
  hotbar.dataset.hotbarDebugGrassDirtAllowed = "false";
  hotbar.setAttribute("role", "region");
  hotbar.setAttribute("aria-label", "Library-/VPLIB-Hotbar");

  const slots = document.createElement("div");
  slots.id = createDomId("vectoplan_editor_hotbar_slots");
  slots.dataset.editorHotbarSlots = "true";
  slots.dataset.hotbarSlotsSource = "library";
  slots.setAttribute("role", "toolbar");
  slots.setAttribute("aria-label", "Library-/VPLIB-Hotbar Slots");

  try {
    hotbar.style.position = "absolute";
    hotbar.style.left = "50%";
    hotbar.style.bottom = "18px";
    hotbar.style.transform = "translateX(-50%)";
    hotbar.style.zIndex = "80";
    hotbar.style.pointerEvents = "none";

    slots.style.display = "flex";
    slots.style.alignItems = "center";
    slots.style.justifyContent = "center";
    slots.style.gap = "6px";
    slots.style.pointerEvents = "auto";
  } catch {
    // Hotbar fallback style is best-effort.
  }

  hotbar.appendChild(slots);

  return {
    hotbar,
    slots,
  };
}

function ensureHotbarSlots(hotbar: HTMLElement): HTMLElement {
  try {
    const existing = queryOptional<HTMLElement>(hotbar, "[data-editor-hotbar-slots]");
    if (existing) {
      existing.dataset.editorHotbarSlots = "true";
      existing.dataset.hotbarSlotsSource = existing.dataset.hotbarSlotsSource || "library";
      existing.setAttribute("role", existing.getAttribute("role") || "toolbar");
      existing.setAttribute("aria-label", existing.getAttribute("aria-label") || "Library-/VPLIB-Hotbar Slots");
      return existing;
    }

    const slots = document.createElement("div");
    slots.id = createDomId("vectoplan_editor_hotbar_slots");
    slots.dataset.editorHotbarSlots = "true";
    slots.dataset.hotbarSlotsSource = "library";
    slots.setAttribute("role", "toolbar");
    slots.setAttribute("aria-label", "Library-/VPLIB-Hotbar Slots");

    try {
      slots.style.display = "flex";
      slots.style.alignItems = "center";
      slots.style.justifyContent = "center";
      slots.style.gap = "6px";
      slots.style.pointerEvents = "auto";
    } catch {
      // Ignore.
    }

    hotbar.appendChild(slots);
    return slots;
  } catch {
    return hotbar;
  }
}

function hardenHotbarElement(hotbar: HTMLElement): void {
  try {
    hotbar.dataset.editorHotbar = "true";
    hotbar.dataset.hotbarKind = hotbar.dataset.hotbarKind || "vplib";
    hotbar.dataset.hotbarSource = hotbar.dataset.hotbarSource || "library";
    hotbar.dataset.hotbarOnlyLibraryItemsPlaceable = hotbar.dataset.hotbarOnlyLibraryItemsPlaceable || "true";
    hotbar.dataset.hotbarDebugGrassDirtAllowed = "false";
    hotbar.setAttribute("role", hotbar.getAttribute("role") || "region");
    hotbar.setAttribute("aria-label", hotbar.getAttribute("aria-label") || "Library-/VPLIB-Hotbar");
  } catch {
    // Hotbar hardening is best-effort.
  }
}

function ensureHotbar(
  overlayOrRoot: HTMLElement,
  existingHotbar: HTMLElement | null,
  existingSlots: HTMLElement | null,
): {
  readonly hotbar: HTMLElement | null;
  readonly slots: HTMLElement | null;
} {
  try {
    if (existingHotbar) {
      hardenHotbarElement(existingHotbar);

      if (existingSlots) {
        existingSlots.dataset.editorHotbarSlots = "true";
        existingSlots.dataset.hotbarSlotsSource = existingSlots.dataset.hotbarSlotsSource || "library";
        return {
          hotbar: existingHotbar,
          slots: existingSlots,
        };
      }

      return {
        hotbar: existingHotbar,
        slots: ensureHotbarSlots(existingHotbar),
      };
    }

    const created = createHotbarElement();
    overlayOrRoot.appendChild(created.hotbar);

    return created;
  } catch {
    return {
      hotbar: existingHotbar,
      slots: existingSlots,
    };
  }
}

function setRootBootMarkers(refs: EditorDomRefs): void {
  try {
    ensureElementId(refs.root, "vectoplan_editor_root");
    refs.root.dataset.editorDomBound = "true";
    refs.root.dataset.editorDomBoundAt = now();
    refs.root.dataset.runtimeMode = refs.root.dataset.runtimeMode || "remote_chunk_service";
    refs.root.dataset.worldMode = refs.root.dataset.worldMode || "chunk_service";
    refs.root.dataset.worldSourceKind = refs.root.dataset.worldSourceKind || "chunk-service";
    refs.root.dataset.localWorldFallbackEnabled = "false";
    refs.root.dataset.legacyFrontendEnabled = "false";
    refs.root.dataset.chunkServiceEnabled = "true";
    refs.root.dataset.inventoryRoute = refs.root.dataset.inventoryRoute || DEFAULT_INVENTORY_ROUTE;
    refs.root.dataset.inventorySource = refs.root.dataset.inventorySource || "library";
    refs.root.dataset.inventoryKind = refs.root.dataset.inventoryKind || "vplib";
    refs.root.dataset.inventoryOnlyLibraryItemsPlaceable = refs.root.dataset.inventoryOnlyLibraryItemsPlaceable || "true";
    refs.root.dataset.inventoryDebugGrassDirtAllowed = "false";
    refs.root.dataset.hotbarOnlyLibraryItemsPlaceable = refs.root.dataset.hotbarOnlyLibraryItemsPlaceable || "true";
    refs.root.dataset.hotbarDebugGrassDirtAllowed = "false";
    refs.root.dataset.viewportOverlayAvailable = refs.viewportOverlay ? "true" : "false";
    refs.root.dataset.crosshairAvailable = refs.crosshair ? "true" : "false";
    refs.root.dataset.hotbarAvailable = refs.hotbar ? "true" : "false";
  } catch {
    // Boot markers are diagnostic-only.
  }
}

function setStatusClassFlags(element: HTMLElement | null, status: EditorSourceStatusKind): void {
  setClassFlag(element, "is-unknown", status === "unknown");
  setClassFlag(element, "is-connecting", status === "connecting");
  setClassFlag(element, "is-ready", status === "ready");
  setClassFlag(element, "is-degraded", status === "degraded");
  setClassFlag(element, "is-failed", status === "failed" || status === "offline");
}

function normalizeHotbarSlot(slot: HotbarSlotRenderInput): NormalizedHotbarSlotRenderInput {
  const safeSlot = safeInteger(slot.slot, 0, 0, 99);
  const runtimeBlockTypeId = safeNullableString(slot.runtimeBlockTypeId ?? slot.blockTypeId);
  const blockTypeId = safeNullableString(slot.blockTypeId ?? slot.runtimeBlockTypeId);
  const libraryItemId = safeNullableString(slot.libraryItemId);
  const familyId = safeNullableString(slot.familyId);
  const packageId = safeNullableString(slot.packageId);
  const vplibUid = safeNullableString(slot.vplibUid);
  const variantId = safeNullableString(slot.variantId);
  const revisionHash = safeNullableString(slot.revisionHash);
  const objectKind = safeNullableString(slot.objectKind);
  const sourceKind = safeNullableString(slot.sourceKind) ?? (familyId || vplibUid || libraryItemId ? "library" : null);
  const itemKind = safeNullableString(slot.itemKind) ?? (familyId || vplibUid || libraryItemId ? "vplib" : null);
  const label = safeString(slot.label, String(safeSlot + 1));
  const shortLabel = safeString(slot.shortLabel, label.length > 12 ? `${label.slice(0, 11)}…` : label);
  const empty = safeBoolean(slot.empty, !runtimeBlockTypeId && !libraryItemId && !familyId && !vplibUid);
  const enabled = safeBoolean(slot.enabled, !empty && Boolean(runtimeBlockTypeId));
  const placeable = safeBoolean(slot.placeable, enabled && Boolean(runtimeBlockTypeId));
  const title = safeString(
    slot.title,
    [
      label,
      runtimeBlockTypeId ? `Runtime: ${runtimeBlockTypeId}` : "",
      familyId ? `Family: ${familyId}` : "",
      packageId ? `Package: ${packageId}` : "",
      vplibUid ? `VPLIB: ${vplibUid}` : "",
      variantId ? `Variant: ${variantId}` : "",
    ].filter(Boolean).join(" · "),
  );

  return {
    slot: safeSlot,
    label,
    shortLabel,
    title,
    blockTypeId,
    runtimeBlockTypeId,
    libraryItemId,
    familyId,
    packageId,
    vplibUid,
    variantId,
    revisionHash,
    objectKind,
    sourceKind,
    itemKind,
    color: safeNullableString(slot.color),
    iconValue: safeNullableString(slot.iconValue),
    iconKind: safeNullableString(slot.iconKind),
    selected: safeBoolean(slot.selected, false),
    enabled,
    empty,
    placeable,
    disabledReason: safeNullableString(slot.disabledReason),
  };
}

function setHotbarSlotDataset(element: HTMLElement, slot: NormalizedHotbarSlotRenderInput): void {
  setDatasetValue(element, "hotbarSlot", slot.slot);
  setDatasetValue(element, "slot", slot.slot);
  setDatasetValue(element, "selected", slot.selected ? "true" : "false");
  setDatasetValue(element, "enabled", slot.enabled ? "true" : "false");
  setDatasetValue(element, "empty", slot.empty ? "true" : "false");
  setDatasetValue(element, "placeable", slot.placeable ? "true" : "false");
  setDatasetValue(element, "blockTypeId", slot.blockTypeId);
  setDatasetValue(element, "runtimeBlockTypeId", slot.runtimeBlockTypeId);
  setDatasetValue(element, "libraryItemId", slot.libraryItemId);
  setDatasetValue(element, "familyId", slot.familyId);
  setDatasetValue(element, "packageId", slot.packageId);
  setDatasetValue(element, "vplibUid", slot.vplibUid);
  setDatasetValue(element, "variantId", slot.variantId);
  setDatasetValue(element, "revisionHash", slot.revisionHash);
  setDatasetValue(element, "objectKind", slot.objectKind);
  setDatasetValue(element, "sourceKind", slot.sourceKind);
  setDatasetValue(element, "itemKind", slot.itemKind);
  setDatasetValue(element, "color", slot.color);
  setDatasetValue(element, "iconKind", slot.iconKind);
  setDatasetValue(element, "iconValue", slot.iconValue);
  setDatasetValue(element, "disabledReason", slot.disabledReason);
}

function fallbackHotbarTextureUrl(slot: NormalizedHotbarSlotRenderInput): string | null {
  const identity = [slot.familyId, slot.runtimeBlockTypeId, slot.blockTypeId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const filename = identity.includes("brettsperrholz") || identity.includes("_holz")
    ? "timber.webp"
    : identity.includes("stahlbeton") || identity.includes("kalksandstein") || identity.includes("porenbeton")
      ? "concrete.webp"
      : identity.includes("stahlverbund") || identity.includes("wand_stahl")
        ? "steel.webp"
        : identity.includes("mauerwerk")
          ? "masonry.webp"
          : null;
  if (!filename) return null;
  try {
    const root = document.querySelector<HTMLElement>(
      "[data-editor-root], [data-vectoplan-editor-root], #vectoplan-editor-root",
    );
    const baseUrl = root?.dataset.creativeInventoryUrl ?? root?.dataset.userInventoryUrl;
    return baseUrl ? new URL(`/static/textures/materials/${filename}`, baseUrl).href : null;
  } catch {
    return null;
  }
}

function createHotbarSlotButton(slot: NormalizedHotbarSlotRenderInput): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "vp-hotbar-slot";
  setHotbarSlotDataset(element, slot);

  element.setAttribute("aria-pressed", slot.selected ? "true" : "false");
  element.setAttribute("title", slot.title || slot.label);
  element.setAttribute(
    "aria-label",
    slot.empty
      ? `Hotbar-Slot ${slot.slot + 1}: leer`
      : `Hotbar-Slot ${slot.slot + 1}: ${slot.label}`,
  );

  if (slot.selected) {
    element.setAttribute("aria-current", "true");
  } else {
    element.removeAttribute("aria-current");
  }

  if (!slot.enabled || slot.empty || !slot.placeable) {
    element.disabled = true;
    element.setAttribute("aria-disabled", "true");
  } else {
    element.disabled = false;
    element.setAttribute("aria-disabled", "false");
  }

  setClassFlag(element, "is-selected", slot.selected);
  setClassFlag(element, "is-empty", slot.empty);
  setClassFlag(element, "is-disabled", !slot.enabled);
  setClassFlag(element, "is-library", slot.sourceKind === "library" || slot.itemKind === "vplib" || slot.itemKind === "library-item");
  setClassFlag(element, "is-vplib", slot.itemKind === "vplib" || Boolean(slot.vplibUid || slot.familyId));
  setClassFlag(element, "is-placeable", slot.placeable);

  try {
    element.style.width = "56px";
    element.style.height = "56px";
    element.style.border = "1px solid rgba(255,255,255,0.28)";
    element.style.borderRadius = "12px";
    element.style.background = slot.selected
      ? "rgba(255,255,255,0.20)"
      : slot.empty
        ? "rgba(8, 12, 18, 0.36)"
        : "rgba(8, 12, 18, 0.72)";
    element.style.color = slot.enabled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.42)";
    element.style.backdropFilter = "blur(10px)";
    element.style.cursor = slot.enabled ? "pointer" : "default";
    element.style.display = "grid";
    element.style.placeItems = "center";
    element.style.padding = "4px";
    element.style.opacity = slot.enabled ? "1" : "0.58";
    element.style.position = "relative";
    element.style.overflow = "hidden";
  } catch {
    // Slot fallback style is best-effort.
  }

  if (slot.color) {
    element.style.borderColor = slot.selected ? slot.color : "";
    element.style.boxShadow = slot.selected ? `0 0 0 2px ${slot.color}55` : "";
  }

  if (slot.selected) {
    try {
      element.style.transform = "translateY(-4px) scale(1.05)";
      element.style.boxShadow = element.style.boxShadow || "0 0 0 2px rgba(255,255,255,0.35), 0 10px 28px rgba(0,0,0,0.32)";
    } catch {
      // Decorative style is best-effort.
    }
  }

  const numberElement = document.createElement("span");
  numberElement.textContent = String(slot.slot + 1);
  numberElement.style.fontSize = "10px";
  numberElement.style.opacity = "0.72";

  const labelElement = document.createElement("span");
  labelElement.textContent = slot.empty ? "Leer" : slot.shortLabel;
  labelElement.style.display = "block";
  labelElement.style.maxWidth = "48px";
  labelElement.style.overflow = "hidden";
  labelElement.style.textOverflow = "ellipsis";
  labelElement.style.whiteSpace = "nowrap";
  labelElement.style.fontSize = "11px";

  const metaElement = document.createElement("span");
  metaElement.textContent = slot.vplibUid ? "VPLIB" : slot.familyId ? "LIB" : "";
  metaElement.style.fontSize = "8px";
  metaElement.style.letterSpacing = "0.04em";
  metaElement.style.opacity = slot.vplibUid || slot.familyId ? "0.72" : "0";

  const wrapper = document.createElement("span");
  wrapper.style.display = "grid";
  wrapper.style.placeItems = "center";
  wrapper.style.gap = "2px";
  wrapper.style.position = "relative";
  wrapper.style.zIndex = "1";
  wrapper.appendChild(numberElement);
  wrapper.appendChild(labelElement);
  wrapper.appendChild(metaElement);

  const renderedTextureUrl = slot.iconValue ?? fallbackHotbarTextureUrl(slot);
  if (renderedTextureUrl) {
    try {
      const textureUrl = new URL(renderedTextureUrl, window.location.href);
      setDatasetValue(element, "iconKind", "asset-url");
      setDatasetValue(element, "iconValue", textureUrl.href);
      if (textureUrl.protocol === "http:" || textureUrl.protocol === "https:") {
        const image = document.createElement("img");
        image.src = textureUrl.href;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.decoding = "async";
        image.loading = "lazy";
        image.style.position = "absolute";
        image.style.inset = "3px";
        image.style.width = "calc(100% - 6px)";
        image.style.height = "calc(100% - 6px)";
        image.style.objectFit = "cover";
        image.style.borderRadius = "8px";
        image.style.pointerEvents = "none";
        element.appendChild(image);
        labelElement.style.visibility = "hidden";
        metaElement.style.visibility = "hidden";
        numberElement.style.padding = "1px 4px";
        numberElement.style.borderRadius = "999px";
        numberElement.style.background = "rgba(5, 10, 16, 0.62)";
        numberElement.style.color = "#fff";
        numberElement.style.textShadow = "0 1px 2px rgba(0,0,0,0.9)";
      }
    } catch {
      // The text fallback remains visible for invalid asset URLs.
    }
  }

  element.appendChild(wrapper);

  return element;
}

function selectedSlotFromSlots(slots: readonly NormalizedHotbarSlotRenderInput[]): NormalizedHotbarSlotRenderInput | null {
  try {
    return slots.find((slot) => slot.selected) ?? null;
  } catch {
    return null;
  }
}

function updateHotbarRootDataset(refs: EditorDomRefs, slots: readonly NormalizedHotbarSlotRenderInput[]): void {
  const selected = selectedSlotFromSlots(slots);
  const librarySlotCount = slots.filter((slot) => slot.sourceKind === "library" || slot.itemKind === "vplib" || slot.itemKind === "library-item").length;
  const placeableSlotCount = slots.filter((slot) => slot.placeable).length;

  setDatasetValue(refs.root, "hotbarSlotCount", slots.length);
  setDatasetValue(refs.root, "hotbarLibrarySlotCount", librarySlotCount);
  setDatasetValue(refs.root, "hotbarPlaceableSlotCount", placeableSlotCount);
  setDatasetValue(refs.root, "hotbarSelectedSlot", selected?.slot ?? null);
  setDatasetValue(refs.root, "hotbarSelectedBlockTypeId", selected?.blockTypeId ?? null);
  setDatasetValue(refs.root, "hotbarSelectedRuntimeBlockTypeId", selected?.runtimeBlockTypeId ?? null);
  setDatasetValue(refs.root, "hotbarSelectedLibraryItemId", selected?.libraryItemId ?? null);
  setDatasetValue(refs.root, "hotbarSelectedFamilyId", selected?.familyId ?? null);
  setDatasetValue(refs.root, "hotbarSelectedPackageId", selected?.packageId ?? null);
  setDatasetValue(refs.root, "hotbarSelectedVplibUid", selected?.vplibUid ?? null);
  setDatasetValue(refs.root, "hotbarSelectedVariantId", selected?.variantId ?? null);
  setDatasetValue(refs.root, "hotbarSelectedRevisionHash", selected?.revisionHash ?? null);
  setDatasetValue(refs.root, "hotbarSelectedLabel", selected?.label ?? null);
  setDatasetValue(refs.root, "hotbarSource", "library");
  setDatasetValue(refs.root, "hotbarKind", "vplib");
  setDatasetValue(refs.root, "hotbarOnlyLibraryItemsPlaceable", "true");
  setDatasetValue(refs.root, "hotbarDebugGrassDirtAllowed", "false");
  setDatasetValue(refs.root, "hotbarRenderedAt", now());

  if (refs.hotbar) {
    setDatasetValue(refs.hotbar, "hotbarSlotCount", slots.length);
    setDatasetValue(refs.hotbar, "hotbarLibrarySlotCount", librarySlotCount);
    setDatasetValue(refs.hotbar, "hotbarPlaceableSlotCount", placeableSlotCount);
    setDatasetValue(refs.hotbar, "selectedSlot", selected?.slot ?? null);
    setDatasetValue(refs.hotbar, "selectedRuntimeBlockTypeId", selected?.runtimeBlockTypeId ?? null);
    setDatasetValue(refs.hotbar, "selectedFamilyId", selected?.familyId ?? null);
    setDatasetValue(refs.hotbar, "selectedPackageId", selected?.packageId ?? null);
    setDatasetValue(refs.hotbar, "selectedVplibUid", selected?.vplibUid ?? null);
    setDatasetValue(refs.hotbar, "selectedVariantId", selected?.variantId ?? null);
    setDatasetValue(refs.hotbar, "hotbarKind", "vplib");
    setDatasetValue(refs.hotbar, "hotbarSource", "library");
    setDatasetValue(refs.hotbar, "hotbarOnlyLibraryItemsPlaceable", "true");
    setDatasetValue(refs.hotbar, "hotbarDebugGrassDirtAllowed", "false");
  }

  if (refs.hotbarSlots) {
    setDatasetValue(refs.hotbarSlots, "hotbarSlotCount", slots.length);
    setDatasetValue(refs.hotbarSlots, "selectedSlot", selected?.slot ?? null);
    setDatasetValue(refs.hotbarSlots, "selectedRuntimeBlockTypeId", selected?.runtimeBlockTypeId ?? null);
    setDatasetValue(refs.hotbarSlots, "selectedFamilyId", selected?.familyId ?? null);
    setDatasetValue(refs.hotbarSlots, "selectedVplibUid", selected?.vplibUid ?? null);
    setDatasetValue(refs.hotbarSlots, "hotbarSlotsSource", "library");
  }
}

export function bindEditorDomRefs(
  root: HTMLElement,
  options?: BindEditorDomRefsOptions,
): EditorDomRefs {
  if (!root) {
    throw new Error("bindEditorDomRefs expected an editor root element.");
  }

  const canvasHost = queryRequired<HTMLElement>(
    root,
    "[data-editor-canvas-host], [data-canvas-host]",
    "Editor canvas host element was not found.",
  );

  ensureRootPositioning(root);
  ensureRootPositioning(canvasHost);

  const existingCanvas = queryOptional<HTMLCanvasElement>(canvasHost, "canvas");
  const canvas =
    options?.createCanvasIfMissing === false
      ? existingCanvas
      : ensureCanvas(canvasHost, existingCanvas);

  const viewportOverlay = options?.createViewportOverlayIfMissing === false
    ? queryOptional<HTMLElement>(root, "[data-editor-viewport-overlay], [data-editor-overlay='viewport']")
    : ensureViewportOverlay(
        canvasHost,
        queryOptional<HTMLElement>(root, "[data-editor-viewport-overlay], [data-editor-overlay='viewport']"),
      );

  const crosshair = options?.createCrosshairIfMissing === false
    ? queryOptional<HTMLElement>(root, "[data-editor-crosshair]")
    : ensureCrosshairElement(
        viewportOverlay ?? canvasHost,
        queryOptional<HTMLElement>(root, "[data-editor-crosshair]"),
      );

  const existingHotbar = queryOptional<HTMLElement>(root, "[data-editor-hotbar]");
  const existingHotbarSlots = queryOptional<HTMLElement>(root, "[data-editor-hotbar-slots]");
  const hotbarRefs = options?.createHotbarIfMissing === false
    ? {
        hotbar: existingHotbar,
        slots: existingHotbarSlots,
      }
    : ensureHotbar(viewportOverlay ?? root, existingHotbar, existingHotbarSlots);

  const liveRegion = ensureLiveRegion(
    root,
    queryOptional(root, "[data-editor-live-region]"),
  );

  const refs: EditorDomRefs = {
    root,
    shell: queryOptional(root, "[data-editor-shell]"),
    topbar: queryOptional(root, "[data-editor-topbar]"),
    main: queryOptional(root, "[data-editor-main]"),
    canvasHost,
    canvas,
    viewportOverlay,
    crosshair,
    loadingOverlay: queryOptional(root, "[data-editor-loading-overlay]"),
    loadingText: queryOptional(root, "[data-editor-loading-text]"),
    errorOverlay: queryOptional(root, "[data-editor-error-overlay]"),
    errorTitle: queryOptional(root, "[data-editor-error-title], .vp-error-title"),
    errorText: queryOptional(root, "[data-editor-error-text]"),
    sourceStatus: queryOptional(root, "[data-editor-source-status]"),
    sourceStatusDot: queryOptional(root, "[data-editor-source-status-dot]"),
    sourceStatusLabel: queryOptional(root, "[data-editor-source-status-label]"),
    projectLabel: queryOptional(root, "[data-editor-project-label]"),
    hotbar: hotbarRefs.hotbar,
    hotbarSlots: hotbarRefs.slots,
    liveRegion,
    leftPanel: queryOptional(root, "[data-editor-left-panel]"),
    rightPanel: queryOptional(root, "[data-editor-right-panel]"),
    inventoryPanel: queryOptional(root, "[data-editor-inventory-panel]"),
    inspectorPanel: queryOptional(root, "[data-editor-inspector-panel]"),
  };

  setRootBootMarkers(refs);
  setDomCrosshair(refs, {
    visible: true,
    enabled: true,
    variant: "neutral",
    source: "dom.bind",
  });
  setDomHotbarVisibility(refs, Boolean(refs.hotbar));

  return refs;
}

export function getEditorCanvas(refs: EditorDomRefs): HTMLCanvasElement {
  if (!refs.canvas) {
    throw new Error("Editor canvas is not available.");
  }

  return refs.canvas;
}

export function getEditorCanvasHost(refs: EditorDomRefs): HTMLElement {
  return refs.canvasHost;
}

export function getEditorViewportOverlay(refs: EditorDomRefs): HTMLElement | null {
  return refs.viewportOverlay;
}

export function getEditorCrosshair(refs: EditorDomRefs): HTMLElement | null {
  return refs.crosshair;
}

export function setDomBootMessage(refs: EditorDomRefs, message: string): void {
  const normalized = safeString(message, "");
  setText(refs.loadingText, normalized);
  setText(refs.liveRegion, normalized);
  setDatasetValue(refs.root, "bootMessage", normalized);
  setDatasetValue(refs.root, "bootMessageAt", now());
}

export function setDomLiveMessage(refs: EditorDomRefs, message: string | null): void {
  const normalized = message ?? "";
  setText(refs.liveRegion, normalized);
  setDatasetValue(refs.root, "liveMessage", normalized);
  setDatasetValue(refs.root, "liveMessageAt", normalized.length > 0 ? now() : null);
}

export function hideDomLoadingOverlay(refs: EditorDomRefs): void {
  if (refs.root.dataset.editorBootGate !== "released") {
    setHidden(refs.loadingOverlay, false);
    setDatasetValue(refs.root, "loading", "true");
    setDatasetValue(refs.root, "loadingHideDeferred", "true");
    return;
  }

  setHidden(refs.loadingOverlay, true);
  setDatasetValue(refs.root, "loading", "false");
  setDatasetValue(refs.root, "loadingHideDeferred", null);
  setDatasetValue(refs.root, "loadingHiddenAt", now());
}

export function showDomLoadingOverlay(refs: EditorDomRefs, message?: string | null): void {
  setHidden(refs.loadingOverlay, false);
  setDatasetValue(refs.root, "loading", "true");
  setDatasetValue(refs.root, "loadingShownAt", now());

  if (message !== undefined) {
    setDomBootMessage(refs, message ?? "");
  }
}

export function showDomFatalError(refs: EditorDomRefs, input: EditorFatalErrorInput): void {
  const title = safeString(input.title, "Editor konnte nicht gestartet werden");
  const message = safeString(input.message, "Unbekannter Editor-Fehler.");

  setHidden(refs.loadingOverlay, true);
  setHidden(refs.errorOverlay, false);
  setText(refs.errorTitle, title);
  setText(refs.errorText, message);
  setText(refs.liveRegion, message);

  setDatasetValue(refs.root, "loading", "false");
  setDatasetValue(refs.root, "fatalError", "true");
  setDatasetValue(refs.root, "fatalErrorAt", now());
  setDatasetValue(refs.root, "fatalErrorTitle", title);
  setDatasetValue(refs.root, "fatalErrorMessage", message);

  const details = safeSerializeDetails(input.details);

  if (details.length > 0) {
    setDatasetValue(refs.root, "fatalErrorDetails", details);
  } else {
    setDatasetValue(refs.root, "fatalErrorDetails", null);
  }

  try {
    refs.errorOverlay?.focus?.();
  } catch {
    // Error focus is best-effort.
  }
}

export function clearDomFatalError(refs: EditorDomRefs): void {
  setHidden(refs.errorOverlay, true);
  setText(refs.errorTitle, "Editor konnte nicht gestartet werden");
  setText(refs.errorText, "");
  setDatasetValue(refs.root, "fatalError", "false");
  setDatasetValue(refs.root, "fatalErrorTitle", null);
  setDatasetValue(refs.root, "fatalErrorMessage", null);
  setDatasetValue(refs.root, "fatalErrorDetails", null);
}

export function setDomSourceStatus(refs: EditorDomRefs, input: EditorSourceStatusInput): void {
  const status = normalizeStatus(input.status);
  const label = statusLabelFor(status, input.label);

  setText(refs.sourceStatusLabel, label);
  setDatasetValue(refs.root, "sourceStatus", status);
  setDatasetValue(refs.root, "sourceStatusLabel", label);
  setDatasetValue(refs.root, "sourceStatusAt", now());
  setDatasetValue(refs.sourceStatus, "sourceStatus", status);
  setDatasetValue(refs.sourceStatusDot, "sourceStatus", status);

  setAttributeValue(refs.sourceStatus, "aria-label", label);
  setStatusClassFlags(refs.sourceStatus, status);
  setStatusClassFlags(refs.sourceStatusDot, status);

  if (input.details) {
    setDatasetValue(refs.sourceStatus, "sourceStatusDetails", safeSerializeDetails(input.details));
  } else {
    setDatasetValue(refs.sourceStatus, "sourceStatusDetails", null);
  }

  setDomLiveMessage(refs, label);
}

export function setDomProjectLabel(refs: EditorDomRefs, projectId: string, worldId: string): void {
  const safeProjectId = safeString(projectId, "dev-project");
  const safeWorldId = safeString(worldId, "world_spawn");
  const label = `${safeProjectId} / ${safeWorldId}`;

  setText(refs.projectLabel, label);
  setDatasetValue(refs.root, "projectId", safeProjectId);
  setDatasetValue(refs.root, "worldId", safeWorldId);
  setDatasetValue(refs.root, "projectLabel", label);
}

export function setDomPanelVisibility(
  refs: EditorDomRefs,
  options: {
    readonly left?: boolean;
    readonly right?: boolean;
  },
): void {
  if (typeof options.left === "boolean") {
    setHidden(refs.leftPanel, !options.left);
    setDatasetValue(refs.root, "leftPanelVisible", options.left);
  }

  if (typeof options.right === "boolean") {
    setHidden(refs.rightPanel, !options.right);
    setDatasetValue(refs.root, "rightPanelVisible", options.right);
  }
}

export function setDomCrosshair(refs: EditorDomRefs, input: EditorCrosshairDomInput): void {
  try {
    const crosshair = refs.crosshair;

    if (!crosshair) {
      setDatasetValue(refs.root, "crosshairAvailable", "false");
      return;
    }

    const enabled = safeBoolean(input.enabled, refs.root.dataset.crosshairEnabled !== "false");
    const visible = safeBoolean(input.visible, refs.root.dataset.crosshairVisible !== "false");
    const pointerLocked = safeBoolean(input.pointerLocked, refs.root.dataset.crosshairPointerLocked === "true");
    const variant = normalizeCrosshairVariant(input.variant ?? refs.root.dataset.crosshairVariant);
    const label = safeString(input.label, "");

    setDatasetValue(refs.root, "crosshairAvailable", "true");
    setDatasetValue(refs.root, "crosshairEnabled", enabled);
    setDatasetValue(refs.root, "crosshairVisible", visible);
    setDatasetValue(refs.root, "crosshairPointerLocked", pointerLocked);
    setDatasetValue(refs.root, "crosshairVariant", variant);
    setDatasetValue(refs.root, "crosshairUpdatedAt", now());
    setDatasetValue(refs.root, "crosshairSource", safeString(input.source, "dom.crosshair"));

    setDatasetValue(crosshair, "crosshairEnabled", enabled);
    setDatasetValue(crosshair, "crosshairVisible", visible);
    setDatasetValue(crosshair, "crosshairPointerLocked", pointerLocked);
    setDatasetValue(crosshair, "crosshairVariant", variant);
    setDatasetValue(crosshair, "crosshairLabel", label || null);

    if (refs.viewportOverlay) {
      refs.viewportOverlay.hidden = false;
      refs.viewportOverlay.removeAttribute("hidden");
      refs.viewportOverlay.style.visibility = "visible";
    }

    crosshair.hidden = !(enabled && visible);
    crosshair.style.visibility = enabled && visible ? "visible" : "hidden";
    crosshair.style.opacity = enabled && visible ? "1" : "0";
  } catch (error) {
    setDatasetValue(refs.root, "crosshairError", normalizeErrorMessage(error));
    setDatasetValue(refs.root, "crosshairErrorAt", now());
  }
}

export function setDomCrosshairVisibility(refs: EditorDomRefs, visible: boolean): void {
  setDomCrosshair(refs, {
    visible,
    source: "dom.crosshair-visibility",
  });
}

export function setDomHotbarVisibility(refs: EditorDomRefs, visible: boolean): void {
  setHidden(refs.hotbar, !visible);
  setDatasetValue(refs.root, "hotbarVisible", visible);

  try {
    if (refs.hotbar) {
      refs.hotbar.dataset.hotbarVisible = visible ? "true" : "false";
      refs.hotbar.dataset.hotbarKind = refs.hotbar.dataset.hotbarKind || "vplib";
      refs.hotbar.dataset.hotbarSource = refs.hotbar.dataset.hotbarSource || "library";
      refs.hotbar.dataset.hotbarOnlyLibraryItemsPlaceable = refs.hotbar.dataset.hotbarOnlyLibraryItemsPlaceable || "true";
      refs.hotbar.dataset.hotbarDebugGrassDirtAllowed = "false";
      refs.hotbar.style.visibility = visible ? "visible" : "hidden";
      refs.hotbar.style.opacity = visible ? "1" : "0";
    }
  } catch {
    // Hotbar visibility is best-effort.
  }
}

export function renderDomHotbarSlots(
  refs: EditorDomRefs,
  slots: readonly HotbarSlotRenderInput[],
): void {
  try {
    if (!refs.hotbarSlots) {
      return;
    }

    clearElement(refs.hotbarSlots);

    const safeSlots = slots
      .map(normalizeHotbarSlot)
      .sort((left, right) => left.slot - right.slot);

    for (const slot of safeSlots) {
      refs.hotbarSlots.appendChild(createHotbarSlotButton(slot));
    }

    refs.hotbarSlots.setAttribute("role", "toolbar");
    refs.hotbarSlots.setAttribute("aria-label", "Library-/VPLIB-Hotbar");
    refs.hotbarSlots.dataset.hotbarSlotsSource = "library";
    refs.hotbarSlots.dataset.hotbarKind = "vplib";
    refs.hotbarSlots.dataset.hotbarOnlyLibraryItemsPlaceable = "true";
    refs.hotbarSlots.dataset.hotbarDebugGrassDirtAllowed = "false";

    updateHotbarRootDataset(refs, safeSlots);
  } catch (error) {
    try {
      setDatasetValue(refs.root, "hotbarRenderError", normalizeErrorMessage(error));
      setDatasetValue(refs.root, "hotbarRenderErrorAt", now());
    } catch {
      // Ignore.
    }
  }
}

export function setDomInventoryPanelText(refs: EditorDomRefs, text: string): void {
  setText(refs.inventoryPanel, text);
  setDatasetValue(refs.root, "inventoryPanelUpdatedAt", now());
}

export function setDomInspectorPanelText(refs: EditorDomRefs, text: string): void {
  setText(refs.inspectorPanel, text);
  setDatasetValue(refs.root, "inspectorPanelUpdatedAt", now());
}

export function setDomCanvasAriaActive(refs: EditorDomRefs, active: boolean): void {
  try {
    const canvas = refs.canvas;

    if (!canvas) {
      return;
    }

    canvas.setAttribute("aria-busy", active ? "true" : "false");
    canvas.dataset.active = active ? "true" : "false";
  } catch {
    // Ignore.
  }
}

export function focusEditorCanvas(refs: EditorDomRefs): void {
  try {
    refs.canvas?.focus({
      preventScroll: true,
    });
  } catch {
    try {
      refs.canvas?.focus();
    } catch {
      // Ignore.
    }
  }
}

export function getCanvasHostSize(refs: EditorDomRefs): {
  readonly width: number;
  readonly height: number;
} {
  try {
    const rect = refs.canvasHost.getBoundingClientRect();

    return {
      width: Math.max(0, Math.round(rect.width)),
      height: Math.max(0, Math.round(rect.height)),
    };
  } catch {
    return {
      width: 0,
      height: 0,
    };
  }
}

export function getCanvasSize(refs: EditorDomRefs): {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
} {
  try {
    const hostSize = getCanvasHostSize(refs);
    const devicePixelRatio = Math.max(0.25, Math.min(8, window.devicePixelRatio || 1));

    return {
      width: hostSize.width,
      height: hostSize.height,
      devicePixelRatio,
    };
  } catch {
    return {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
    };
  }
}

export function getEditorDomSnapshot(refs: EditorDomRefs): EditorDomSnapshot {
  return {
    kind: DOM_SNAPSHOT_KIND,
    bound: refs.root.dataset.editorDomBound === "true",
    rootId: refs.root.id || null,
    hasCanvasHost: Boolean(refs.canvasHost),
    hasCanvas: Boolean(refs.canvas),
    hasViewportOverlay: Boolean(refs.viewportOverlay),
    hasCrosshair: Boolean(refs.crosshair),
    hasLoadingOverlay: Boolean(refs.loadingOverlay),
    hasErrorOverlay: Boolean(refs.errorOverlay),
    hasHotbar: Boolean(refs.hotbar),
    sourceStatus: normalizeStatus(refs.root.dataset.sourceStatus),
    loading: refs.root.dataset.loading === "true",
    fatalError: refs.root.dataset.fatalError === "true",
    hotbarVisible: refs.root.dataset.hotbarVisible === "true",
    hotbarSlotCount: safeInteger(refs.root.dataset.hotbarSlotCount, 0, 0, 99),
    hotbarSelectedSlot:
      refs.root.dataset.hotbarSelectedSlot === undefined
        ? null
        : safeInteger(refs.root.dataset.hotbarSelectedSlot, 0, 0, 99),
    hotbarSelectedRuntimeBlockTypeId: refs.root.dataset.hotbarSelectedRuntimeBlockTypeId ?? null,
    hotbarSelectedFamilyId: refs.root.dataset.hotbarSelectedFamilyId ?? null,
    hotbarSelectedVplibUid: refs.root.dataset.hotbarSelectedVplibUid ?? null,
    crosshairVisible: refs.root.dataset.crosshairVisible !== "false",
    projectId: refs.root.dataset.projectId ?? null,
    worldId: refs.root.dataset.worldId ?? null,
    inventoryRoute: refs.root.dataset.inventoryRoute ?? refs.root.dataset.inventoryApiUrl ?? DEFAULT_INVENTORY_ROUTE,
    createdAt: now(),
  };
}

export function disposeEditorDomRefs(refs: EditorDomRefs): void {
  try {
    setDatasetValue(refs.root, "domDisposedAt", now());
    setDatasetValue(refs.root, "loading", "false");
    setDomCanvasAriaActive(refs, false);
    setDomCrosshairVisibility(refs, false);
  } catch {
    // Ignore.
  }
}

export function getDomRefsMetadata(): Record<string, unknown> {
  return {
    moduleName: "frontend.dom.dom_refs",
    snapshotKind: DOM_SNAPSHOT_KIND,
    supportsLibraryHotbar: true,
    supportsRuntimeBlockTypeId: true,
    supportsVplibIdentity: true,
    defaultInventoryRoute: DEFAULT_INVENTORY_ROUTE,
    rules: {
      hotbarRendersLibraryVplibFields: true,
      blockTypeIdIsLegacyRuntimeBlockTypeAlias: true,
      debugGrassDirtAllowed: false,
      browserUsesEditorInventoryApi: true,
    },
  };
}
