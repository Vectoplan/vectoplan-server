import { STANDARD_STOREY_HEIGHT_METERS } from "../line_brush/building_programs";

export type StoreyTargetScope = "all" | `segment:${number}`;

export interface StoreyQuickSettingsState {
  readonly buildingLabel: string;
  readonly storeyCount: number;
  readonly segmentCount: number;
  readonly scope: StoreyTargetScope;
  readonly busy?: boolean;
}

export interface StoreyQuickSettingsHandle {
  readonly element: HTMLElement;
  readonly open: (state: StoreyQuickSettingsState) => void;
  readonly close: (restoreInput?: boolean) => void;
  readonly sync: (state: StoreyQuickSettingsState) => void;
  readonly getScope: () => StoreyTargetScope;
  readonly isOpen: () => boolean;
  readonly destroy: () => void;
}

export interface StoreyQuickSettingsOptions {
  readonly root: HTMLElement;
  readonly onAdd: (scope: StoreyTargetScope) => void;
  readonly onRemove: (scope: StoreyTargetScope) => void;
  readonly onClose?: (restoreInput: boolean) => void;
  readonly onScopeChange?: (scope: StoreyTargetScope) => void;
}

function normalizedState(state: StoreyQuickSettingsState): StoreyQuickSettingsState {
  const segmentCount = Math.max(0, Math.trunc(Number(state.segmentCount) || 0));
  const requestedIndex = state.scope.startsWith("segment:")
    ? Number(state.scope.slice("segment:".length))
    : -1;
  return {
    buildingLabel: String(state.buildingLabel || "Linien-Brush-Baukörper").slice(0, 80),
    storeyCount: Math.max(0, Math.trunc(Number(state.storeyCount) || 0)),
    segmentCount,
    scope: Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < segmentCount
      ? `segment:${requestedIndex}`
      : "all",
    busy: state.busy === true,
  };
}

export function createStoreyQuickSettings(options: StoreyQuickSettingsOptions): StoreyQuickSettingsHandle {
  const element = document.createElement("section");
  element.className = "editor-storey-quick-settings";
  element.dataset.editorStoreyQuickSettings = "true";
  element.dataset.editorUiInteractive = "true";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "false");
  element.setAttribute("aria-label", "Geschosse hinzufügen oder entfernen");
  element.hidden = true;
  element.innerHTML = `
    <header class="editor-storey-quick-settings__header">
      <div><span>WorldEdit</span><strong>Geschosse bearbeiten</strong></div>
      <button type="button" data-storey-close aria-label="Geschosseinstellungen schließen">×</button>
    </header>
    <div class="editor-storey-quick-settings__body">
      <div class="editor-storey-quick-settings__building">
        <span>Baukörper</span><strong data-storey-building>Linien-Brush-Baukörper</strong>
      </div>
      <label class="editor-storey-quick-settings__field">
        <span>Bereich</span>
        <select data-storey-scope><option value="all">Gesamter Baukörper</option></select>
      </label>
      <div class="editor-storey-quick-settings__metric">
        <span>Geschosshöhe</span><output>${STANDARD_STOREY_HEIGHT_METERS.toFixed(3).replace(".", ",")} m</output>
        <small>Semantisch exakt; zwischen den Geschossen wird eine editierbare Deckenplatte erzeugt.</small>
      </div>
      <div class="editor-storey-quick-settings__counter">
        <button type="button" data-storey-remove aria-label="Geschoss entfernen">−</button>
        <div><output data-storey-count>1</output><span>Geschosse</span></div>
        <button type="button" data-storey-add aria-label="Geschoss hinzufügen">+</button>
      </div>
    </div>
  `;
  options.root.append(element);

  const closeButton = element.querySelector<HTMLButtonElement>("[data-storey-close]");
  const scopeSelect = element.querySelector<HTMLSelectElement>("[data-storey-scope]");
  const addButton = element.querySelector<HTMLButtonElement>("[data-storey-add]");
  const removeButton = element.querySelector<HTMLButtonElement>("[data-storey-remove]");
  const buildingOutput = element.querySelector<HTMLElement>("[data-storey-building]");
  const countOutput = element.querySelector<HTMLOutputElement>("[data-storey-count]");
  let state = normalizedState({ buildingLabel: "Linien-Brush-Baukörper", storeyCount: 1, segmentCount: 0, scope: "all" });

  function scope(): StoreyTargetScope {
    const value = scopeSelect?.value ?? "all";
    return /^segment:\d+$/.test(value) ? value as StoreyTargetScope : "all";
  }

  function render(next: StoreyQuickSettingsState): void {
    state = normalizedState(next);
    if (buildingOutput) buildingOutput.textContent = state.buildingLabel;
    if (countOutput) countOutput.textContent = String(state.storeyCount);
    if (scopeSelect) {
      const previous = state.scope;
      scopeSelect.replaceChildren(new Option("Gesamter Baukörper", "all"));
      for (let index = 0; index < state.segmentCount; index += 1) {
        scopeSelect.add(new Option(`Liniensegment ${index + 1}`, `segment:${index}`));
      }
      scopeSelect.value = previous;
      if (!scopeSelect.value) scopeSelect.value = "all";
      scopeSelect.disabled = state.busy === true;
    }
    if (addButton) addButton.disabled = state.busy === true;
    if (removeButton) removeButton.disabled = state.busy === true || state.storeyCount <= 1;
    element.dataset.busy = String(state.busy === true);
  }

  closeButton?.addEventListener("click", () => {
    element.hidden = true;
    options.onClose?.(true);
  });
  scopeSelect?.addEventListener("change", () => options.onScopeChange?.(scope()));
  addButton?.addEventListener("click", () => options.onAdd(scope()));
  removeButton?.addEventListener("click", () => options.onRemove(scope()));

  return {
    element,
    open(next): void {
      render(next);
      element.hidden = false;
    },
    close(restoreInput = false): void {
      if (element.hidden) return;
      element.hidden = true;
      options.onClose?.(restoreInput);
    },
    sync: render,
    getScope: scope,
    isOpen: () => !element.hidden,
    destroy(): void {
      element.remove();
    },
  };
}
