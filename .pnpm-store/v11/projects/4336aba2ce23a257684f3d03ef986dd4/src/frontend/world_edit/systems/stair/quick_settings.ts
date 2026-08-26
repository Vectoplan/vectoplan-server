export type StairType = "straight" | "quarter_turn" | "half_turn" | "u_shaped" | "spiral";
export type StairSide = "bottom" | "top" | "left" | "right";

export interface StairToolParameters {
  readonly stairType: StairType;
  readonly widthMm: number;
  readonly treadCount: number;
  readonly startSide: StairSide;
  readonly endSide: StairSide;
  readonly direction: "up" | "down";
}

export const DEFAULT_STAIR_TOOL_PARAMETERS: StairToolParameters = Object.freeze({
  stairType: "straight", widthMm: 1000, treadCount: 15,
  startSide: "bottom", endSide: "top", direction: "up",
});

export interface StairQuickSettingsHandle {
  readonly element: HTMLElement;
  readonly isOpen: () => boolean;
  readonly open: (parameters: StairToolParameters) => void;
  readonly close: () => void;
  readonly sync: (parameters: StairToolParameters) => void;
  readonly destroy: () => void;
}

export function createStairQuickSettings(options: Readonly<{
  root: HTMLElement;
  onChange: (parameters: StairToolParameters) => void;
  onClose?: () => void;
}>): StairQuickSettingsHandle {
  const element = document.createElement("section");
  element.className = "editor-roof-quick-settings editor-stair-quick-settings";
  element.dataset.editorStairQuickSettings = "true";
  element.dataset.editorUiInteractive = "true";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-label", "Treppenlauf einstellen");
  element.hidden = true;
  element.innerHTML = `
    <header class="editor-roof-quick-settings__header"><div><span>Treppenzone</span><strong>Treppenlauf einstellen</strong></div><button type="button" data-stair-close aria-label="Treppeneinstellungen schließen">×</button></header>
    <div class="editor-stair-quick-settings__grid">
      <label>Treppentyp<select data-stair-type><option value="straight">Gerade Treppe</option><option value="quarter_turn">1/4 gewendelt</option><option value="half_turn">1/2 gewendelt</option><option value="u_shaped">U-Treppe</option><option value="spiral">Spindeltreppe</option></select></label>
      <label>Antritt<select data-stair-start><option value="bottom">Unten</option><option value="top">Oben</option><option value="left">Links</option><option value="right">Rechts</option></select></label>
      <label>Austritt<select data-stair-end><option value="top">Oben</option><option value="bottom">Unten</option><option value="right">Rechts</option><option value="left">Links</option></select></label>
      <label>Begehung<select data-stair-direction><option value="up">Nach oben</option><option value="down">Nach unten</option></select></label>
    </div>
    <div class="editor-roof-quick-settings__pitch" data-stair-width tabindex="0"><span>Laufbreite</span><output data-stair-width-output>1000 mm</output><small>Mausrad: in 50-mm-Schritten</small></div>
    <div class="editor-roof-quick-settings__pitch" data-stair-treads tabindex="0"><span>Auftritte</span><output data-stair-treads-output>15</output><small>Mausrad: Anzahl erhöhen oder verringern</small></div>
    <button type="button" class="editor-roof-quick-settings__done" data-stair-done>Fertig</button>`;
  options.root.append(element);
  let parameters: StairToolParameters = {...DEFAULT_STAIR_TOOL_PARAMETERS};
  const type = element.querySelector<HTMLSelectElement>("[data-stair-type]")!;
  const start = element.querySelector<HTMLSelectElement>("[data-stair-start]")!;
  const end = element.querySelector<HTMLSelectElement>("[data-stair-end]")!;
  const direction = element.querySelector<HTMLSelectElement>("[data-stair-direction]")!;
  const widthOutput = element.querySelector<HTMLOutputElement>("[data-stair-width-output]")!;
  const treadOutput = element.querySelector<HTMLOutputElement>("[data-stair-treads-output]")!;
  const emit = (): void => options.onChange({...parameters});
  const sync = (next: StairToolParameters): void => {
    parameters = {...next};
    type.value = parameters.stairType;
    start.value = parameters.startSide;
    end.value = parameters.endSide;
    direction.value = parameters.direction;
    widthOutput.value = `${Math.round(parameters.widthMm)} mm`;
    treadOutput.value = String(Math.round(parameters.treadCount));
  };
  [type, start, end, direction].forEach((control) => control.addEventListener("change", () => {
    parameters = {...parameters, stairType: type.value as StairType, startSide: start.value as StairSide, endSide: end.value as StairSide, direction: direction.value as "up" | "down"};
    emit();
  }));
  element.querySelector("[data-stair-width]")?.addEventListener("wheel", (event) => {
    event.preventDefault();
    parameters = {...parameters, widthMm: Math.max(600, Math.min(4000, parameters.widthMm + (event.deltaY < 0 ? 50 : -50)))};
    sync(parameters); emit();
  }, {passive: false});
  element.querySelector("[data-stair-treads]")?.addEventListener("wheel", (event) => {
    event.preventDefault();
    parameters = {...parameters, treadCount: Math.max(3, Math.min(40, parameters.treadCount + (event.deltaY < 0 ? 1 : -1)))};
    sync(parameters); emit();
  }, {passive: false});
  const close = (): void => { element.hidden = true; options.onClose?.(); };
  element.querySelector("[data-stair-close]")?.addEventListener("click", close);
  element.querySelector("[data-stair-done]")?.addEventListener("click", close);
  sync(parameters);
  return {
    element,
    isOpen: () => !element.hidden,
    open(next): void { sync(next); element.hidden = false; },
    close,
    sync,
    destroy(): void { element.remove(); },
  };
}
