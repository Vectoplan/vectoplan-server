import type { SceneRuntimeHandle } from "../scene/scene_runtime";
import type { WorldEditControllerHandle } from "../world_edit/world_edit_controller";
import type { WorldEditTool } from "../world_edit/systems/contracts";
import {
  EDITOR_WORKSPACE_MODES,
  editorWorkspaceToolDescriptor,
  planningWorkspaceTools,
  type EditorWorkspaceMode,
} from "../modes/editor_workspace_mode";

const MODE_CHANGED_EVENT = "vectoplan-editor:workspace-mode-changed";
const WORLD_EDIT_ACTIVATE_EVENT = "vectoplan-editor:worldedit-tool-activate";

export interface EditorWorkspaceModeControllerOptions {
  readonly root: HTMLElement;
  readonly sceneRuntime: SceneRuntimeHandle;
  readonly worldEditController: WorldEditControllerHandle;
  readonly signal?: AbortSignal;
}

export interface EditorWorkspaceModeControllerHandle {
  readonly kind: "vectoplan-editor-workspace-mode-controller.v1";
  readonly element: HTMLElement;
  sync(): void;
  destroy(): void;
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function worldEditTool(value: unknown): WorldEditTool | null {
  if (typeof value !== "string") return null;
  return editorWorkspaceToolDescriptor(value as WorldEditTool)?.tool ?? null;
}

export function createEditorWorkspaceModeController(
  options: EditorWorkspaceModeControllerOptions,
): EditorWorkspaceModeControllerHandle {
  const cleanup: Array<() => void> = [];
  let destroyed = false;
  let activePlanningTool: WorldEditTool | null = worldEditTool(options.root.dataset.worldEditTool);

  const shell = createElement("div", "vp-workspace-modes");
  shell.dataset.editorWorkspaceControl = "true";
  shell.dataset.editorUiInteractive = "true";

  const switcher = createElement("section", "vp-workspace-switcher");
  switcher.dataset.editorWorkspaceControl = "true";
  switcher.setAttribute("aria-label", "Editor-Ansicht wechseln");
  const switcherLabel = createElement("span", "vp-workspace-switcher__label", "Arbeitsansicht");
  const switcherButtons = createElement("div", "vp-workspace-switcher__buttons");
  switcherButtons.setAttribute("role", "group");
  const modeButtons = new Map<EditorWorkspaceMode, HTMLButtonElement>();
  for (const mode of EDITOR_WORKSPACE_MODES) {
    const button = createElement("button", "vp-workspace-switcher__button") as HTMLButtonElement;
    button.type = "button";
    button.dataset.workspaceMode = mode.id;
    button.title = mode.description;
    button.append(
      createElement("strong", "", mode.shortLabel),
      createElement("small", "", mode.camera === "orbit" ? "Gottperspektive" : "First Person"),
    );
    button.addEventListener("click", () => options.sceneRuntime.setWorkspaceMode(mode.id, `workspace-switch:${mode.id}`));
    switcherButtons.append(button);
    modeButtons.set(mode.id, button);
  }
  const shortcut = createElement("kbd", "vp-workspace-switcher__shortcut", "G");
  shortcut.title = "Mit G zwischen beiden Ansichten wechseln";
  switcher.append(switcherLabel, switcherButtons, shortcut);

  const dock = createElement("nav", "vp-planning-dock");
  dock.dataset.editorWorkspaceControl = "true";
  dock.setAttribute("aria-label", "Planungswerkzeuge");
  const toolButtons = new Map<WorldEditTool, HTMLButtonElement>();
  for (const descriptor of planningWorkspaceTools()) {
    const button = createElement("button", "vp-planning-dock__tool") as HTMLButtonElement;
    button.type = "button";
    button.dataset.worldEditTool = descriptor.tool;
    button.title = descriptor.description;
    const icon = createElement("span", "vp-planning-dock__icon", descriptor.shortLabel.slice(0, 1));
    icon.setAttribute("aria-hidden", "true");
    button.append(icon, createElement("span", "vp-planning-dock__label", descriptor.shortLabel));
    button.addEventListener("click", () => {
      delete options.root.dataset.planningMassingActive;
      activePlanningTool = descriptor.tool;
      options.worldEditController.activate(descriptor.tool);
      sync();
    });
    dock.append(button);
    toolButtons.set(descriptor.tool, button);
  }
  const dockDivider = createElement("span", "vp-planning-dock__divider");
  dockDivider.setAttribute("aria-hidden", "true");
  const resetView = createElement("button", "vp-planning-dock__view") as HTMLButtonElement;
  resetView.type = "button";
  resetView.textContent = "Zentrieren";
  resetView.title = "Planungskamera auf die aktuelle Projektposition zentrieren";
  resetView.addEventListener("click", () => options.sceneRuntime.resetPlanningView("planning-dock:center"));
  const topView = createElement("button", "vp-planning-dock__view") as HTMLButtonElement;
  topView.type = "button";
  topView.textContent = "Draufsicht";
  topView.title = "Senkrechte Draufsicht aktivieren";
  topView.addEventListener("click", () => options.sceneRuntime.setPlanningTopView("planning-dock:top"));
  dock.append(dockDivider, resetView, topView);
  shell.append(switcher, dock);
  options.root.append(shell);

  function sync(): void {
    if (destroyed) return;
    const mode = options.sceneRuntime.getWorkspaceMode();
    shell.dataset.mode = mode;
    for (const [id, button] of modeButtons) {
      const selected = id === mode;
      button.dataset.active = String(selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    const datasetTool = worldEditTool(options.root.dataset.worldEditTool);
    if (datasetTool) activePlanningTool = datasetTool;
    for (const [tool, button] of toolButtons) {
      const selected = mode === "planning" && activePlanningTool === tool;
      button.dataset.active = String(selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  function handleModeChanged(): void {
    sync();
  }

  function handleWorldEditActivation(event: Event): void {
    const detail = (event as CustomEvent).detail as Record<string, unknown> | null;
    if (detail?.active === false) {
      activePlanningTool = null;
      sync();
      return;
    }
    const tool = worldEditTool(detail?.tool ?? detail?.toolId);
    if (!tool) return;
    activePlanningTool = tool;
    sync();
  }

  window.addEventListener(MODE_CHANGED_EVENT, handleModeChanged);
  window.addEventListener(WORLD_EDIT_ACTIVATE_EVENT, handleWorldEditActivation);
  cleanup.push(() => window.removeEventListener(MODE_CHANGED_EVENT, handleModeChanged));
  cleanup.push(() => window.removeEventListener(WORLD_EDIT_ACTIVATE_EVENT, handleWorldEditActivation));

  const handle: EditorWorkspaceModeControllerHandle = {
    kind: "vectoplan-editor-workspace-mode-controller.v1",
    element: shell,
    sync,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const dispose of cleanup.splice(0)) dispose();
      shell.remove();
    },
  };
  if (options.signal) {
    if (options.signal.aborted) handle.destroy();
    else options.signal.addEventListener("abort", () => handle.destroy(), { once: true });
  }
  sync();
  return handle;
}
