import type { SceneRuntimeHandle } from "../scene/scene_runtime";
import type { WorldEditControllerHandle } from "../world_edit/world_edit_controller";
import {
  normalizePlanningMassingHeight,
  validatePlanningMassing,
} from "./planning_massing_model";

const MODE_CHANGED_EVENT = "vectoplan-editor:workspace-mode-changed";

export interface PlanningMassingControllerOptions {
  readonly root: HTMLElement;
  readonly sceneRuntime: SceneRuntimeHandle;
  readonly worldEditController: WorldEditControllerHandle;
  readonly signal?: AbortSignal;
}

export interface PlanningMassingControllerHandle {
  readonly kind: "vectoplan-editor-planning-massing-controller.v1";
  readonly element: HTMLElement;
  sync(): void;
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, className: string): HTMLButtonElement {
  const node = element("button", className, label) as HTMLButtonElement;
  node.type = "button";
  return node;
}

export function createPlanningMassingController(
  options: PlanningMassingControllerOptions,
): PlanningMassingControllerHandle {
  let destroyed = false;
  let actionBusy = false;
  let syncTimer: number | null = null;

  const panel = element("aside", "vp-planning-massing");
  panel.dataset.editorUiInteractive = "true";
  panel.dataset.planningMassing = "true";
  panel.setAttribute("aria-label", "Schneller blockbasierter Baukörper");

  const header = element("header", "vp-planning-massing__header");
  const titleGroup = element("div", "vp-planning-massing__title-group");
  titleGroup.append(
    element("span", "vp-planning-massing__eyebrow", "Gottmodus · WorldEdit"),
    element("h2", "vp-planning-massing__title", "Schneller Baukörper"),
  );
  const badge = element("span", "vp-planning-massing__badge", "MVP");
  header.append(titleGroup, badge);

  const intro = element(
    "p",
    "vp-planning-massing__intro",
    "Baufeld aufziehen, Höhe wählen und als einen gemeinsamen WorldEdit-Befehl speichern.",
  );

  const steps = element("ol", "vp-planning-massing__steps");
  const stepField = element("li", "", "1 · Baufeld");
  const stepBody = element("li", "", "2 · Baukörper");
  const stepRoof = element("li", "", "3 · Dach");
  steps.append(stepField, stepBody, stepRoof);

  const fieldSummary = element("div", "vp-planning-massing__summary");
  const footprintOutput = element("output", "vp-planning-massing__summary-value", "—") as HTMLOutputElement;
  const areaOutput = element("span", "vp-planning-massing__summary-meta", "Noch kein Baufeld");
  fieldSummary.append(footprintOutput, areaOutput);

  const selectionButton = button("Baufeld aufziehen", "vp-planning-massing__button vp-planning-massing__button--secondary");
  selectionButton.title = "Aktiviert die vorhandene rechteckige WorldEdit-Auswahl";

  const heightField = element("label", "vp-planning-massing__field");
  heightField.append(element("span", "", "Baukörperhöhe in Blöcken"));
  const heightRow = element("div", "vp-planning-massing__height-row");
  const heightInput = element("input", "vp-planning-massing__height") as HTMLInputElement;
  heightInput.type = "number";
  heightInput.min = "1";
  heightInput.max = "128";
  heightInput.step = "1";
  heightInput.value = "6";
  heightInput.inputMode = "numeric";
  const heightPresets = element("div", "vp-planning-massing__presets");
  for (const height of [3, 6, 12]) {
    const preset = button(String(height), "vp-planning-massing__preset");
    preset.title = `${height} Blöcke Höhe`;
    preset.addEventListener("click", () => {
      heightInput.value = String(height);
      sync();
    });
    heightPresets.append(preset);
  }
  heightRow.append(heightInput, heightPresets);
  heightField.append(heightRow);

  const material = element("div", "vp-planning-massing__material");
  material.append(element("span", "", "Material"));
  const materialOutput = element("strong", "", "Hotbar auswählen");
  material.append(materialOutput);

  const createButton = button("Baukörper erstellen", "vp-planning-massing__button vp-planning-massing__button--primary");
  const roofButton = button("Dachwerkzeug öffnen", "vp-planning-massing__button vp-planning-massing__button--roof");
  const status = element("p", "vp-planning-massing__status", "Bereit für ein rechteckiges Baufeld.");
  status.setAttribute("aria-live", "polite");

  const note = element(
    "p",
    "vp-planning-massing__note",
    "Der Baukörper füllt nur Luft. Grundstücksmaske, Hotbar-Material, Chunk-Transaktion und Dach-Persistenz bleiben dieselben wie in WorldEdit.",
  );

  panel.append(
    header,
    intro,
    steps,
    fieldSummary,
    selectionButton,
    heightField,
    material,
    createButton,
    roofButton,
    status,
    note,
  );
  options.root.append(panel);

  function setStatus(message: string, tone = "info"): void {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function sync(): void {
    if (destroyed) return;
    const planning = options.sceneRuntime.getWorkspaceMode() === "planning";
    panel.hidden = !planning;
    if (!planning) return;

    const snapshot = options.worldEditController.getPlanningMassingSnapshot();
    const height = normalizePlanningMassingHeight(heightInput.value);
    if (heightInput.value !== String(height)) heightInput.value = String(height);
    const validation = validatePlanningMassing(snapshot.selection, height);
    const draft = validation.draft;

    footprintOutput.textContent = draft
      ? `${draft.widthBlocks} × ${draft.depthBlocks} × ${draft.heightBlocks}`
      : "—";
    areaOutput.textContent = draft
      ? `${draft.footprintAreaM2.toLocaleString("de-DE")} m² · ${draft.volumeM3.toLocaleString("de-DE")} m³`
      : validation.message;
    materialOutput.textContent = snapshot.materialLabel;
    material.dataset.ready = String(Boolean(snapshot.materialId));

    const busy = actionBusy || snapshot.busy;
    selectionButton.disabled = busy;
    heightInput.disabled = busy;
    createButton.disabled = busy || !validation.ok || !snapshot.materialId;
    roofButton.disabled = busy || !snapshot.lastDraft;
    stepField.dataset.complete = String(Boolean(snapshot.selection));
    stepBody.dataset.complete = String(Boolean(snapshot.lastDraft));
    stepRoof.dataset.complete = String(options.root.dataset.worldEditTool === "roof" && Boolean(snapshot.lastDraft));
    panel.dataset.phase = snapshot.lastDraft
      ? (options.root.dataset.worldEditTool === "roof" ? "roof" : "built")
      : snapshot.selection ? "ready" : "select";
  }

  selectionButton.addEventListener("click", () => {
    options.root.dataset.planningMassingActive = "true";
    options.sceneRuntime.setWorkspaceMode("planning", "planning-massing:select");
    options.worldEditController.beginPlanningMassingSelection();
    setStatus("Linksklick halten und das rechteckige Baufeld auf dem Grundstück aufziehen.", "ready");
    sync();
  });

  heightInput.addEventListener("input", sync);

  createButton.addEventListener("click", async () => {
    if (actionBusy) return;
    actionBusy = true;
    setStatus("Baukörper wird als WorldEdit-Transaktion gespeichert …", "busy");
    sync();
    try {
      const result = await options.worldEditController.executePlanningMassing(
        normalizePlanningMassingHeight(heightInput.value),
      );
      setStatus(result.message, result.ok ? "success" : "error");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Der Baukörper konnte nicht erstellt werden.", "error");
    } finally {
      actionBusy = false;
      sync();
    }
  });

  roofButton.addEventListener("click", async () => {
    if (actionBusy) return;
    actionBusy = true;
    setStatus("Rechteckige Dachfläche wird an das vorhandene Dachwerkzeug übergeben …", "busy");
    sync();
    try {
      const result = await options.worldEditController.preparePlanningMassingRoof();
      setStatus(result.message, result.ok ? "success" : "error");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Das Dachwerkzeug konnte nicht vorbereitet werden.", "error");
    } finally {
      actionBusy = false;
      sync();
    }
  });

  const handleModeChanged = (): void => {
    if (options.sceneRuntime.getWorkspaceMode() !== "planning") {
      delete options.root.dataset.planningMassingActive;
    }
    sync();
  };
  window.addEventListener(MODE_CHANGED_EVENT, handleModeChanged);
  syncTimer = window.setInterval(sync, 300);

  const handle: PlanningMassingControllerHandle = {
    kind: "vectoplan-editor-planning-massing-controller.v1",
    element: panel,
    sync,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (syncTimer !== null) window.clearInterval(syncTimer);
      syncTimer = null;
      window.removeEventListener(MODE_CHANGED_EVENT, handleModeChanged);
      delete options.root.dataset.planningMassingActive;
      panel.remove();
    },
  };
  if (options.signal) {
    if (options.signal.aborted) handle.destroy();
    else options.signal.addEventListener("abort", () => handle.destroy(), { once: true });
  }
  sync();
  return handle;
}
