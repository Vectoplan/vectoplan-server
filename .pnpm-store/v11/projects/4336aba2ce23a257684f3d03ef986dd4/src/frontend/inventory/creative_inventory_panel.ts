export interface CreativeInventoryPanelOptions {
  readonly root: HTMLElement;
  readonly creativeInventoryUrl?: string;
  readonly signal?: AbortSignal;
  readonly onOpen?: () => void | Promise<void>;
  readonly onClose?: () => void | Promise<void>;
}

export interface CreativeInventoryPanelHandle {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  destroy(): void;
}

const DEFAULT_CREATIVE_INVENTORY_URL = "http://127.0.0.1:5101/creative-inventar";

const CREATIVE_INVENTORY_MESSAGE_CLOSE = "vectoplan:creative-inventory-close";
const CREATIVE_INVENTORY_MESSAGE_TOGGLE = "vectoplan:creative-inventory-toggle";
const CREATIVE_DRAG_MESSAGE_START = "vectoplan:creative-drag-start";
const CREATIVE_DRAG_MESSAGE_END = "vectoplan:creative-drag-end";

function resolveUrl(options: CreativeInventoryPanelOptions): string {
  const configured = options.creativeInventoryUrl
    ?? options.root.dataset.creativeInventoryUrl
    ?? options.root.dataset.libraryCreativeInventoryUrl;
  return configured?.trim() || DEFAULT_CREATIVE_INVENTORY_URL;
}

export function mountCreativeInventoryPanel(
  options: CreativeInventoryPanelOptions,
): CreativeInventoryPanelHandle {
  const existing = options.root.querySelector<HTMLElement>("[data-editor-creative-inventory-panel]");
  existing?.remove();
  options.root.querySelectorAll<HTMLElement>(".editor-inventory-launcher").forEach((element) => {
    element.remove();
  });

  const url = resolveUrl(options);

  const panel = document.createElement("section");
  panel.id = "editor-creative-inventory-panel";
  panel.className = "editor-creative-inventory-panel";
  panel.dataset.editorCreativeInventoryPanel = "true";
  panel.dataset.editorUiInteractive = "true";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Creative-Inventar");
  panel.setAttribute("aria-modal", "true");
  panel.hidden = true;
  panel.innerHTML = `
    <iframe
      class="editor-creative-inventory-panel__frame"
      data-editor-inventory-frame
      title="VECTOPLAN Creative Inventar"
      loading="eager"
      referrerpolicy="same-origin"
    ></iframe>
    <button
      class="editor-creative-inventory-panel__close"
      type="button"
      data-editor-inventory-close
      aria-label="Creative-Inventar schliessen"
    ><span aria-hidden="true">&#8649;</span><span>Schliessen</span></button>
  `;

  options.root.append(panel);
  const frame = panel.querySelector<HTMLIFrameElement>("[data-editor-inventory-frame]");
  if (frame) frame.src = url;
  const closeButton = panel.querySelector<HTMLButtonElement>("[data-editor-inventory-close]");
  const userInventoryFrame = options.root.querySelector<HTMLIFrameElement>("[data-user-inventory-frame]");
  let destroyed = false;

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }

  function open(): void {
    if (destroyed || !panel.hidden) return;
    try {
      if (document.pointerLockElement) void document.exitPointerLock();
    } catch {
      // Pointer-lock release is best effort.
    }
    panel.hidden = false;
    options.root.dataset.creativeInventoryOpen = "true";
    void options.onOpen?.();
    frame?.focus({ preventScroll: true });
  }

  function close(): void {
    if (destroyed || panel.hidden) return;
    panel.hidden = true;
    options.root.dataset.creativeInventoryOpen = "false";
    const focusTarget = options.root.querySelector<HTMLElement>(
      "[data-editor-canvas-host], canvas",
    );
    focusTarget?.focus({ preventScroll: true });
    void options.onClose?.();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (isEditableTarget(event.target)) return;

    const normalizedKey = event.key.toLowerCase();
    const togglesCreativeInventory =
      event.code === "Tab"
      || event.key === "Tab"
      || event.code === "KeyI"
      || normalizedKey === "i";

    if (togglesCreativeInventory && !event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      panel.hidden ? open() : close();
      return;
    }

    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }

  function handleMessage(event: MessageEvent): void {
    const fromCreativeFrame = Boolean(frame && event.source === frame.contentWindow);
    const fromHotbarFrame = Boolean(userInventoryFrame && event.source === userInventoryFrame.contentWindow);
    if (!fromCreativeFrame && !fromHotbarFrame) return;

    const messageType = event.data && typeof event.data === "object"
      ? String((event.data as { type?: unknown }).type ?? "")
      : "";

    if (messageType === CREATIVE_INVENTORY_MESSAGE_CLOSE && fromCreativeFrame) {
      close();
    } else if (messageType === CREATIVE_INVENTORY_MESSAGE_TOGGLE) {
      panel.hidden ? open() : close();
    } else if (
      fromCreativeFrame
      && (messageType === CREATIVE_DRAG_MESSAGE_START || messageType === CREATIVE_DRAG_MESSAGE_END)
    ) {
      userInventoryFrame?.contentWindow?.postMessage(
        {
          ...(event.data as Record<string, unknown>),
          source: "vectoplan-editor",
        },
        "*",
      );
    }
  }

  closeButton?.addEventListener("click", close);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("message", handleMessage);

  const handle: CreativeInventoryPanelHandle = {
    element: panel,
    open,
    close,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      closeButton?.removeEventListener("click", close);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("message", handleMessage);
      panel.remove();
      delete options.root.dataset.creativeInventoryOpen;
    },
  };

  options.signal?.addEventListener("abort", () => handle.destroy(), { once: true });
  return handle;
}
