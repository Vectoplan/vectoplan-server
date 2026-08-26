import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

export interface RoofSystemHooks {
  readonly stopInteraction: () => void;
  readonly startHover: () => void;
  readonly stopHover: () => void;
  readonly openSettingsUnderCrosshair: () => boolean;
  readonly removePointUnderCrosshair: () => boolean;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly beginPointInteraction: (target: WorldEditPosition) => void;
  readonly finishArea: () => void;
  readonly executeRoof: () => Promise<void>;
  readonly isComplete: () => boolean;
  readonly rebuild: () => void;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createRoofSystem(hooks: RoofSystemHooks): WorldEditSystem {
  return {
    tool: "roof",
    aliases: ["roof-tool", "dach", "dachwerkzeug"],
    ui: {
      title: "Parametrisches Dach",
      hint: "Blockecken anklicken und am ersten Punkt schließen. Das Zahnrad in der Flächenmitte öffnet Dachform und Mausrad-Neigung. Gelbe Punkte lassen sich ziehen; Ausführen speichert und startet die nächste Dachzone.",
      activationMessage: "Dachfläche mit geraden Linien zeichnen; nach dem Schließen Dachform und Neigung über das Zahnrad einstellen.",
      maxDistance: 160,
      inventoryToolId: "roof",
      operations: [],
      showBrushSettings: false,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: true,
      showClipboardStatus: false,
      resetLabel: "Dachfläche löschen",
      resetMessage: "Dachfläche und Vorschau zurückgesetzt.",
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
        await hooks.executeRoof();
        return true;
      }
      if (hooks.openSettingsUnderCrosshair()) return true;
      const target = hooks.resolveTarget(intent);
      if (!target) {
        hooks.setStatus("Keine Blockecke oder horizontale Dacharbeitsebene unter dem Fadenkreuz.", "warning");
        return true;
      }
      hooks.beginPointInteraction(target);
      return true;
    },
    canExecute: hooks.isComplete,
    execute: hooks.executeRoof,
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
