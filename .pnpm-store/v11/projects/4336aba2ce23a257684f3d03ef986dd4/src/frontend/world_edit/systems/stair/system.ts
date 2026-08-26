import type { EditorInputWorldEditIntent } from "@input/input_controller";
import type { WorldEditPosition, WorldEditStatusSetter, WorldEditSystem } from "../contracts";

export interface StairSystemHooks {
  readonly stopInteraction: () => void;
  readonly startHover: () => void;
  readonly stopHover: () => void;
  readonly openSettingsUnderCrosshair: () => boolean;
  readonly removePointUnderCrosshair: () => boolean;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly beginPointInteraction: (target: WorldEditPosition) => void;
  readonly finishArea: () => void;
  readonly isComplete: () => boolean;
  readonly executeStair: () => Promise<void>;
  readonly rebuild: () => void;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createStairSystem(hooks: StairSystemHooks): WorldEditSystem {
  return {
    tool: "stair",
    aliases: ["stairs", "treppe", "treppen", "staircase"],
    ui: {
      title: "Treppenwerkzeug",
      hint: "Treppenöffnung Punkt für Punkt zeichnen, schließen und über das Zahnrad Laufart, Breite, Antritt und Austritt festlegen.",
      activationMessage: "Treppenbereich zeichnen. ESC oder Enter schließt die Fläche; das Zahnrad öffnet die Laufparameter.",
      maxDistance: 120,
      inventoryToolId: "stair",
      operations: [],
      showBrushSettings: false,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: true,
      showClipboardStatus: false,
      resetLabel: "Treppenfläche löschen",
      resetMessage: "Treppenfläche zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "none",
      selectionDragMode: "none",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action === "primary-release") {
        hooks.stopInteraction();
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (intent.action === "secondary") {
        if (hooks.removePointUnderCrosshair()) return true;
        hooks.stopInteraction();
        hooks.reset();
        return true;
      }
      if (hooks.isComplete() && hooks.openSettingsUnderCrosshair()) return true;
      const target = hooks.resolveTarget(intent);
      if (!target) {
        hooks.setStatus("Keine horizontale Treppenebene unter dem Fadenkreuz.", "warning");
        return true;
      }
      hooks.beginPointInteraction(target);
      return true;
    },
    canExecute: hooks.isComplete,
    execute: hooks.executeStair,
    reset: hooks.reset,
    handleKeyDown(event): boolean {
      if (event.key !== "Escape" && event.key !== "Enter") return false;
      event.preventDefault();
      event.stopPropagation();
      hooks.finishArea();
      return true;
    },
    onActivate(): void {
      hooks.rebuild();
      hooks.startHover();
    },
    onDeactivate(): void {
      hooks.stopInteraction();
      hooks.stopHover();
    },
  };
}
