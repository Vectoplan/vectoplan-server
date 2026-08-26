import type { EditorInputWorldEditIntent } from "@input/input_controller";
import type { WorldEditPosition, WorldEditStatusSetter, WorldEditSystem } from "../contracts";

export interface SculptTarget {
  readonly position: WorldEditPosition;
  readonly blockTypeId: string | null;
}

export interface SculptSystemHooks {
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => SculptTarget | null;
  readonly executeLayer: (target: SculptTarget, mode: "raise" | "lower") => Promise<void>;
  readonly applyDefaults: () => void;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createSculptSystem(hooks: SculptSystemHooks): WorldEditSystem {
  return {
    tool: "sculpt",
    aliases: ["terrain-sculpt"],
    ui: {
      title: "Sculpt Brush",
      hint: "Rechtsklick hebt eine Geländeschicht an; Linksklick senkt sie ab. Voreinstellung: Quader, Radius 5.",
      activationMessage: "Sculpt: Rechtsklick höher, Linksklick tiefer. Quader-Radius 5 ist voreingestellt.",
      maxDistance: 40,
      inventoryToolId: "sculpt",
      operations: [],
      showBrushSettings: true,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: true,
      showExecute: false,
      showClipboardStatus: false,
      resetLabel: "Ziel löschen",
      resetMessage: "Sculpt-Ziel zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "none",
      selectionDragMode: "none",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action.includes("release")) return true;
      const target = hooks.resolveTarget(intent);
      if (!target) {
        hooks.setStatus("Kein sichtbarer Gelände- oder Blocktreffer unter dem Fadenkreuz.", "warning");
        return true;
      }
      await hooks.executeLayer(target, intent.action === "secondary" ? "raise" : "lower");
      return true;
    },
    canExecute: () => false,
    execute: () => undefined,
    reset: hooks.reset,
    onActivate: hooks.applyDefaults,
  };
}
