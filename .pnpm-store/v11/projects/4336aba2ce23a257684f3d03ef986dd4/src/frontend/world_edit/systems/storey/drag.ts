/** Snap a vertical mouse gesture to whole storeys, relative to pointer-down. */
export function storeyCountFromDrag(initialCount: number, deltaPixels: number, pixelsPerStorey: number): number {
  const initial = Math.max(1, Math.min(80, Math.trunc(initialCount) || 1));
  if (!Number.isFinite(deltaPixels) || !Number.isFinite(pixelsPerStorey)) return initial;
  return Math.max(1, Math.min(80, initial + Math.round(-deltaPixels / Math.max(12, Math.abs(pixelsPerStorey)))));
}

export interface StoreyDragSnapshot {
  readonly count: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly pixelsPerStorey: number;
  readonly busy: boolean;
}

/** A projected handle uses the same edit callbacks with either camera. */
export function createStoreyDragHandle(options: {
  root: HTMLElement;
  snapshot(): StoreyDragSnapshot | null;
  begin(): void;
  preview(count: number): void;
  commit(): Promise<void>;
  cancel(): void;
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.editorUiInteractive = "true";
  button.dataset.storeyDragHandle = "true";
  button.setAttribute("aria-label", "Geschosse durch Ziehen hinzufügen oder entfernen");
  button.title = "Nach oben oder unten ziehen · Escape bricht ab · Pfeiltasten ändern ein Geschoss";
  button.style.cssText = "position:absolute;z-index:35;transform:translate(-50%,-100%);padding:10px 14px;background:#2563eb;color:white;border:2px solid white;border-radius:8px;box-shadow:0 3px 14px #17255444;cursor:ns-resize;touch-action:none;white-space:pre-line;font:600 13px/1.5 system-ui;";
  button.hidden = true;
  options.root.append(button);
  let gesture: { pointerId: number; y: number; count: number; scale: number; next: number } | null = null;
  let frame = 0;
  let enabled = false;
  let committing = false;

  function render(): void {
    const state = enabled ? options.snapshot() : null;
    button.hidden = !state;
    if (state) {
      button.style.left = `${state.x}px`;
      button.style.top = `${state.y}px`;
      button.textContent = `↕ ${state.count} Geschosse\n${state.height.toFixed(2).replace(".", ",")} m`;
      button.disabled = state.busy || committing;
      button.setAttribute("aria-valuenow", String(state.count));
    }
    if (enabled) frame = requestAnimationFrame(render);
  }

  function cancel(): void {
    if (!gesture) return;
    const pointerId = gesture.pointerId;
    gesture = null;
    if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
    options.cancel();
  }

  async function commit(): Promise<void> {
    committing = true;
    try { await options.commit(); } finally { committing = false; }
  }

  button.addEventListener("pointerdown", (event) => {
    const state = options.snapshot();
    if (event.button !== 0 || !state || state.busy || committing) return;
    event.preventDefault();
    event.stopPropagation();
    options.begin();
    gesture = { pointerId: event.pointerId, y: event.clientY, count: state.count, scale: state.pixelsPerStorey, next: state.count };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const count = storeyCountFromDrag(gesture.count, event.clientY - gesture.y, gesture.scale);
    if (count === gesture.next) return;
    gesture.next = count;
    options.preview(count);
  });
  button.addEventListener("pointerup", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const changed = gesture.next !== gesture.count;
    gesture = null;
    button.releasePointerCapture(event.pointerId);
    if (changed) void commit();
    else options.cancel();
  });
  button.addEventListener("pointercancel", cancel);
  button.addEventListener("lostpointercapture", cancel);
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && gesture) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel();
    }
  };
  window.addEventListener("keydown", onKey, true);
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const state = options.snapshot();
    if (!state || state.busy || committing || gesture) return;
    event.preventDefault();
    event.stopPropagation();
    options.begin();
    options.preview(Math.max(1, Math.min(80, state.count + (event.key === "ArrowUp" ? 1 : -1))));
    void commit();
  });
  return {
    setEnabled(value: boolean): void {
      if (value === enabled) return;
      enabled = value;
      if (frame) cancelAnimationFrame(frame);
      if (!value) cancel();
      render();
    },
    destroy(): void {
      enabled = false;
      cancel();
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      button.remove();
    },
  };
}
