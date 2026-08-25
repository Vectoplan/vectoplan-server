import type { RoofToolParameters, RoofType } from "./contracts";

export interface RoofTypeOption {
  readonly type: RoofType;
  readonly label: string;
  readonly icon: string;
}

export const ROOF_TYPE_OPTIONS: readonly RoofTypeOption[] = Object.freeze([
  { type: "flat", label: "Flachdach", icon: '<path d="M3 16h18M5 12h14v4H5z"/>' },
  { type: "gable", label: "Satteldach", icon: '<path d="m3 16 9-9 9 9M5 16h14"/>' },
  { type: "hipped", label: "Walmdach", icon: '<path d="m3 16 5-8h8l5 8M3 16h18M8 8l4 8 4-8"/>' },
  { type: "half_hipped", label: "Krüppelwalm", icon: '<path d="m3 16 5-7h8l5 7M3 16h18M8 9l2 3h4l2-3"/>' },
  { type: "pent", label: "Pultdach", icon: '<path d="M4 16 20 8v8H4z"/>' },
  { type: "mansard", label: "Mansarddach", icon: '<path d="m3 16 4-6 3-3h4l3 3 4 6M3 16h18"/>' },
  { type: "trapezoid", label: "Trapezdach", icon: '<path d="m4 16 4-8h8l4 8H4z"/>' },
  { type: "butterfly", label: "Schmetterling", icon: '<path d="m3 8 9 8 9-8M5 16h14"/>' },
  { type: "pyramid", label: "Zeltdach", icon: '<path d="m3 16 9-9 9 9H3zM12 7v9"/>' },
  { type: "barrel", label: "Tonnendach", icon: '<path d="M4 16C4 5 20 5 20 16M4 16h16"/>' },
  { type: "sawtooth", label: "Sheddach", icon: '<path d="M3 16V9l5 4V7l5 6V7l8 9H3z"/>' },
]);

export function normalizeQuickRoofPitch(value: number): number {
  if (!Number.isFinite(value)) return 35;
  return Math.round(Math.max(0, Math.min(80, value)));
}

export function roofPitchFromWheel(current: number, deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return normalizeQuickRoofPitch(current);
  return normalizeQuickRoofPitch(current + (deltaY < 0 ? 1 : -1));
}

export function normalizeQuickRoofOverhangMm(value: number): number {
  if (!Number.isFinite(value)) return 500;
  return Math.round(Math.max(0, Math.min(5000, value)) / 50) * 50;
}

export function roofOverhangFromWheel(current: number, deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return normalizeQuickRoofOverhangMm(current);
  return normalizeQuickRoofOverhangMm(current + (deltaY < 0 ? 50 : -50));
}

export type RoofQuickParameters = Pick<RoofToolParameters, "roofType" | "pitchDeg" | "overhangMm">;

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function supportedRoofType(value: unknown): RoofType | null {
  const normalized = String(value ?? "").trim().toLowerCase() as RoofType;
  return ROOF_TYPE_OPTIONS.some(({ type }) => type === normalized) ? normalized : null;
}

/**
 * Read one roof zone's persisted settings.
 *
 * `roofParameters` is the user's authoritative saved state. Request/calculation
 * values remain compatibility fallbacks for older roof objects which did not
 * persist the complete parameter object yet.
 */
export function persistedRoofQuickSettings(
  metadata: Readonly<Record<string, unknown>>,
  fallback: RoofQuickParameters,
): RoofQuickParameters {
  const storedParameters = record(metadata.roofParameters);
  const request = record(metadata.roofRequest);
  const requestParameters = record(request.parameters);
  const calculation = record(metadata.roofCalculation);
  const normalizedRequest = record(calculation.normalized_request);
  const normalizedRequestParameters = record(normalizedRequest.parameters);
  const requestOverhang = record(requestParameters.overhang_mm ?? requestParameters.overhangMm);
  const normalizedOverhang = record(normalizedRequestParameters.overhang_mm ?? normalizedRequestParameters.overhangMm);
  const storedOverhang = record(storedParameters.overhang_mm ?? storedParameters.overhangMm);
  const roofType = [
    storedParameters.roofType,
    storedParameters.roof_type,
    metadata.roofType,
    metadata.variantRef,
    request.roof_type,
    normalizedRequest.roof_type,
    calculation.roof_type,
  ].map(supportedRoofType).find((value): value is RoofType => value !== null) ?? fallback.roofType;
  const pitchCandidate = [
    storedParameters.pitchDeg,
    storedParameters.pitch_deg,
    requestParameters.pitch_deg,
    requestParameters.pitchDeg,
    normalizedRequestParameters.pitch_deg,
    normalizedRequestParameters.pitchDeg,
  ].map(Number).find(Number.isFinite);
  const overhangCandidate = [
    storedParameters.overhangMm,
    storedOverhang.default_mm,
    storedOverhang.defaultMm,
    requestOverhang.default_mm,
    requestOverhang.defaultMm,
    normalizedOverhang.default_mm,
    normalizedOverhang.defaultMm,
  ].map(Number).find(Number.isFinite);
  return {
    roofType,
    pitchDeg: normalizeQuickRoofPitch(pitchCandidate ?? fallback.pitchDeg),
    overhangMm: normalizeQuickRoofOverhangMm(overhangCandidate ?? fallback.overhangMm),
  };
}

export interface RoofQuickSettingsHandle {
  readonly element: HTMLElement;
  readonly isOpen: () => boolean;
  readonly open: (parameters: RoofToolParameters) => void;
  readonly close: (restorePointerLock?: boolean) => void;
  readonly sync: (parameters: RoofToolParameters) => void;
  readonly destroy: () => void;
}

export interface RoofQuickSettingsOptions {
  readonly root: HTMLElement;
  readonly onChange: (parameters: RoofQuickParameters) => void;
  readonly onClose?: (restorePointerLock: boolean) => void;
}

export function createRoofQuickSettings(
  options: RoofQuickSettingsOptions,
): RoofQuickSettingsHandle {
  const element = document.createElement("section");
  element.className = "editor-roof-quick-settings";
  element.dataset.editorRoofQuickSettings = "true";
  element.dataset.editorUiInteractive = "true";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "false");
  element.setAttribute("aria-label", "Dachform und Dachneigung einstellen");
  element.hidden = true;
  element.innerHTML = `
    <header class="editor-roof-quick-settings__header">
      <div><span>Dachzone</span><strong>Dachform einstellen</strong></div>
      <button type="button" data-roof-quick-close aria-label="Dacheinstellungen schließen">×</button>
    </header>
    <div class="editor-roof-quick-settings__types" role="listbox" aria-label="Dachform">
      ${ROOF_TYPE_OPTIONS.map(({ type, label, icon }) => `
        <button type="button" data-roof-quick-type="${type}" role="option" aria-label="${label}" aria-selected="false">
          <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span>
        </button>
      `).join("")}
    </div>
    <div class="editor-roof-quick-settings__pitch" data-roof-quick-pitch tabindex="0" role="spinbutton" aria-label="Dachneigung mit dem Mausrad einstellen" aria-valuemin="0" aria-valuemax="80">
      <span>Dachneigung</span><output data-roof-quick-pitch-output>35°</output>
      <small>Mausrad: nach oben steiler · nach unten flacher</small>
    </div>
    <div class="editor-roof-quick-settings__pitch editor-roof-quick-settings__overhang" data-roof-quick-overhang tabindex="0" role="spinbutton" aria-label="Dachüberstand mit dem Mausrad einstellen" aria-valuemin="0" aria-valuemax="500">
      <span>Dachüberstand</span><output data-roof-quick-overhang-output>50 cm</output>
      <small>Mausrad: in 5-cm-Schritten vergrößern oder verkleinern</small>
    </div>
    <button type="button" class="editor-roof-quick-settings__done" data-roof-quick-done>Fertig</button>
  `;
  options.root.append(element);

  let roofType: RoofType = "gable";
  let pitchDeg = 35;
  let overhangMm = 500;
  const pitch = element.querySelector<HTMLElement>("[data-roof-quick-pitch]");
  const pitchOutput = element.querySelector<HTMLOutputElement>("[data-roof-quick-pitch-output]");
  const overhang = element.querySelector<HTMLElement>("[data-roof-quick-overhang]");
  const overhangOutput = element.querySelector<HTMLOutputElement>("[data-roof-quick-overhang-output]");
  const typeButtons = [...element.querySelectorAll<HTMLButtonElement>("[data-roof-quick-type]")];

  const render = (): void => {
    typeButtons.forEach((button) => {
      const selected = button.dataset.roofQuickType === roofType;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    if (pitchOutput) pitchOutput.value = `${pitchDeg.toFixed(0)}°`;
    pitch?.setAttribute("aria-valuenow", String(pitchDeg));
    pitch?.setAttribute("aria-valuetext", `${pitchDeg} Grad`);
    if (overhangOutput) overhangOutput.value = `${(overhangMm / 10).toFixed(0)} cm`;
    overhang?.setAttribute("aria-valuenow", String(overhangMm / 10));
    overhang?.setAttribute("aria-valuetext", `${overhangMm / 10} Zentimeter`);
  };
  const publish = (): void => {
    render();
    options.onChange({ roofType, pitchDeg, overhangMm });
  };
  const close = (restorePointerLock = true): void => {
    if (element.hidden) return;
    element.hidden = true;
    delete options.root.dataset.editorRoofSettingsOpen;
    options.onClose?.(restorePointerLock);
  };

  typeButtons.forEach((button) => button.addEventListener("click", () => {
    const value = button.dataset.roofQuickType as RoofType;
    if (!ROOF_TYPE_OPTIONS.some((option) => option.type === value)) return;
    roofType = value;
    publish();
  }));
  pitch?.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    pitchDeg = roofPitchFromWheel(pitchDeg, event.deltaY);
    publish();
  }, { passive: false });
  pitch?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    pitchDeg = normalizeQuickRoofPitch(pitchDeg + (event.key === "ArrowUp" ? 1 : -1));
    publish();
  });
  overhang?.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    overhangMm = roofOverhangFromWheel(overhangMm, event.deltaY);
    publish();
  }, { passive: false });
  overhang?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    overhangMm = normalizeQuickRoofOverhangMm(overhangMm + (event.key === "ArrowUp" ? 50 : -50));
    publish();
  });
  element.querySelector("[data-roof-quick-close]")?.addEventListener("click", () => close());
  element.querySelector("[data-roof-quick-done]")?.addEventListener("click", () => close());

  return {
    element,
    isOpen: () => !element.hidden,
    open(parameters): void {
      roofType = parameters.roofType;
      pitchDeg = normalizeQuickRoofPitch(parameters.pitchDeg);
      overhangMm = normalizeQuickRoofOverhangMm(parameters.overhangMm);
      render();
      element.hidden = false;
      options.root.dataset.editorRoofSettingsOpen = "true";
    },
    close,
    sync(parameters): void {
      roofType = parameters.roofType;
      pitchDeg = normalizeQuickRoofPitch(parameters.pitchDeg);
      overhangMm = normalizeQuickRoofOverhangMm(parameters.overhangMm);
      render();
    },
    destroy(): void {
      element.remove();
    },
  };
}
