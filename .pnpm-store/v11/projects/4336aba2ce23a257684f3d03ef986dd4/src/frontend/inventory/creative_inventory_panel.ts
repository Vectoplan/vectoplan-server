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
const CREATIVE_POINTER_DRAG_START = "vectoplan:creative-pointer-drag-start";
const CREATIVE_POINTER_DRAG_MOVE = "vectoplan:creative-pointer-drag-move";
const CREATIVE_POINTER_DRAG_END = "vectoplan:creative-pointer-drag-end";

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
  let destroyed = false;
  let pointerDragGhost: HTMLDivElement | null = null;

  function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  function userInventoryFrame(): HTMLIFrameElement | null {
    return options.root.querySelector<HTMLIFrameElement>("[data-user-inventory-frame]");
  }

  function removePointerDragGhost(): void {
    pointerDragGhost?.remove();
    pointerDragGhost = null;
  }

  function updatePointerDragGhost(itemValue: unknown, x: number, y: number): void {
    const item = asRecord(itemValue);
    if (!pointerDragGhost) {
      const ghost = document.createElement("div");
      ghost.dataset.editorCreativeDragGhost = "true";
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "58px",
        height: "58px",
        border: "2px solid rgba(43, 89, 255, 0.9)",
        borderRadius: "12px",
        backgroundColor: "#eef3ff",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        boxShadow: "0 14px 32px rgba(18, 42, 95, 0.32)",
        color: "#163a98",
        display: "grid",
        placeItems: "center",
        font: "800 13px/1 system-ui, sans-serif",
        pointerEvents: "none",
        zIndex: "2147483000",
        transform: "translate(-50%, -50%) scale(0.92)",
        willChange: "transform, left, top",
      });
      const preview = asRecord(item.preview);
      const appearance = asRecord(item.appearance);
      const textureUrl = [preview.url, preview.src, appearance.textureUrl, appearance.texture_url]
        .find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof textureUrl === "string") {
        try { ghost.style.backgroundImage = `url("${new URL(textureUrl, window.location.href).href}")`; } catch { /* text fallback */ }
      }
      if (!ghost.style.backgroundImage) {
        const label = String(item.label ?? item.title ?? item.object_kind ?? "IT").trim();
        ghost.textContent = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "IT";
      }
      document.body.append(ghost);
      pointerDragGhost = ghost;
    }
    pointerDragGhost.style.left = `${x}px`;
    pointerDragGhost.style.top = `${y}px`;
  }

  function relayPointerDrag(messageType: string, messageValue: unknown): void {
    const message = asRecord(messageValue);
    const detail = asRecord(message.detail);
    const pointer = asRecord(detail.pointer);
    const localX = Number(pointer.clientX);
    const localY = Number(pointer.clientY);
    if (!frame || !Number.isFinite(localX) || !Number.isFinite(localY)) return;

    const creativeRect = frame.getBoundingClientRect();
    const parentX = creativeRect.left + localX;
    const parentY = creativeRect.top + localY;
    updatePointerDragGhost(detail.item, parentX, parentY);

    const targetFrame = userInventoryFrame();
    const targetRect = targetFrame?.getBoundingClientRect();
    const inside = Boolean(
      targetRect
      && parentX >= targetRect.left
      && parentX <= targetRect.right
      && parentY >= targetRect.top
      && parentY <= targetRect.bottom
    );
    targetFrame?.contentWindow?.postMessage({
      ...message,
      source: "vectoplan-editor",
      detail: {
        ...detail,
        pointer: {
          ...pointer,
          clientX: targetRect ? parentX - targetRect.left : -1,
          clientY: targetRect ? parentY - targetRect.top : -1,
          parentClientX: parentX,
          parentClientY: parentY,
          inside,
        },
      },
    }, "*");

    if (messageType === CREATIVE_POINTER_DRAG_END) removePointerDragGhost();
  }

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
    const currentUserInventoryFrame = userInventoryFrame();
    const fromCreativeFrame = Boolean(frame && event.source === frame.contentWindow);
    const fromHotbarFrame = Boolean(currentUserInventoryFrame && event.source === currentUserInventoryFrame.contentWindow);
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
      && (
        messageType === CREATIVE_POINTER_DRAG_START
        || messageType === CREATIVE_POINTER_DRAG_MOVE
        || messageType === CREATIVE_POINTER_DRAG_END
      )
    ) {
      relayPointerDrag(messageType, event.data);
    } else if (
      fromCreativeFrame
      && (messageType === CREATIVE_DRAG_MESSAGE_START || messageType === CREATIVE_DRAG_MESSAGE_END)
    ) {
      currentUserInventoryFrame?.contentWindow?.postMessage(
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
      removePointerDragGhost();
      panel.remove();
      delete options.root.dataset.creativeInventoryOpen;
    },
  };

  options.signal?.addEventListener("abort", () => handle.destroy(), { once: true });
  return handle;
}
