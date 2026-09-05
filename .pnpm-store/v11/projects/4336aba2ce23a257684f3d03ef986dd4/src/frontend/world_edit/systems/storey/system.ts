import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

export interface StoreySystemHooks {
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly selectBuildingAt: (target: WorldEditPosition) => boolean;
  readonly hasSelection: () => boolean;
  readonly openSettings: () => void;
  readonly closeSettings: () => void;
  readonly addStorey: () => Promise<void>;
  readonly removeStorey: () => Promise<void>;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

/**
 * Storeys are an operation on the shared chunk model, not a camera mode.
 * Consequently the exact same system is used in Ego and planning view.
 */
export function createStoreySystem(hooks: StoreySystemHooks): WorldEditSystem {
  return {
    tool: "storey",
    aliases: ["storeys", "storey-tool", "floor", "floors", "geschoss", "geschosse", "etage", "etagen"],
    ui: {
      title: "Geschoss",
      hint: "Gebäude anklicken und den blauen Höhengriff nach oben oder unten ziehen. Im Einstellungsfenster den gesamten Baukörper oder ein einzelnes Segment wählen.",
      activationMessage: "Gebäude anklicken. Am blauen Griff ziehen, um ganze Geschosse hinzuzufügen oder zu entfernen; Loslassen speichert.",
      maxDistance: 220,
      inventoryToolId: "storey",
      operations: [],
      showBrushSettings: false,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: true,
      showClipboardStatus: false,
      resetLabel: "Gebäude abwählen",
      resetMessage: "Geschossauswahl zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "none",
      selectionDragMode: "none",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action === "primary-release" || intent.action === "secondary-release") return true;
      if (intent.action === "secondary") {
        if (!hooks.hasSelection()) {
          const target = hooks.resolveTarget(intent);
          if (!target || !hooks.selectBuildingAt(target)) {
            hooks.setStatus("Kein editierbarer Linien-Brush-Baukörper an dieser Position.", "warning");
            return true;
          }
        }
        await hooks.removeStorey();
        return true;
      }
      const target = hooks.resolveTarget(intent);
      if (!target || !hooks.selectBuildingAt(target)) {
        hooks.setStatus("Kein editierbarer Linien-Brush-Baukörper an dieser Position.", "warning");
        return true;
      }
      hooks.openSettings();
      return true;
    },
    canExecute: hooks.hasSelection,
    execute: hooks.addStorey,
    reset: hooks.reset,
    handleKeyDown(event): boolean {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        event.stopPropagation();
        void hooks.addStorey();
        return true;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        event.stopPropagation();
        void hooks.removeStorey();
        return true;
      }
      return false;
    },
    onActivate(): void {
      if (hooks.hasSelection()) hooks.openSettings();
    },
    onDeactivate(): void {
      hooks.closeSettings();
    },
  };
}
