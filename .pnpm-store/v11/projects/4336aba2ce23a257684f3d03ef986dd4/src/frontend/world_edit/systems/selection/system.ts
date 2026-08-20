import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  WORLD_OPERATIONS,
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

export interface SelectionSystemHooks {
  readonly isDragging: () => boolean;
  readonly updateDrag: () => void;
  readonly stopDrag: () => void;
  readonly updateScenePreview: () => boolean;
  readonly rebuildScene: () => void;
  readonly refreshHud: () => void;
  readonly adjustHandle: (action: "primary" | "secondary") => boolean;
  readonly clearLastPoint: () => void;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly startDrag: (target: WorldEditPosition) => void;
  readonly hasCompleteSelection: () => boolean;
  readonly execute: () => void | Promise<void>;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createSelectionSystem(hooks: SelectionSystemHooks): WorldEditSystem {
  return {
    tool: "selection",
    aliases: ["select", "selection-tool", "auswahl"],
    ui: {
      title: "Selection Tool",
      hint: "Linksklick halten und den Auswahlquader blockweise live aufziehen. Danach eine der sechs blauen Flächen greifen und X/Y/Z mit demselben Live-Ziehen anpassen.",
      activationMessage: "Linksklick halten und den Auswahlbereich blockweise live aufziehen; die sechs Flächengriffe funktionieren genauso.",
      maxDistance: 60,
      inventoryToolId: "selection",
      operations: WORLD_OPERATIONS,
      showBrushSettings: false,
      showCoordinates: true,
      showRulerResult: false,
      showOperation: true,
      showMaterial: true,
      showMask: true,
      showExecute: true,
      showClipboardStatus: false,
      resetLabel: "Auswahl löschen",
      resetMessage: "Auswahl zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "box",
      selectionDragMode: "box",
      commandTool: "selection",
      requiresCompleteSelection: true,
      showParcelGridHandles: false,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action === "primary-release") {
        if (hooks.isDragging()) {
          hooks.updateDrag();
          hooks.stopDrag();
          if (!hooks.updateScenePreview()) hooks.rebuildScene();
          hooks.refreshHud();
          hooks.setStatus("Auswahl bereit. Die sechs Flächengriffe passen X/Y/Z blockweise und live an.", "ready");
        }
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (hooks.adjustHandle(intent.action)) return true;
      if (intent.action === "secondary") {
        hooks.stopDrag();
        hooks.clearLastPoint();
        hooks.rebuildScene();
        hooks.refreshHud();
        hooks.setStatus("Letzten Auswahlpunkt entfernt.", "info");
        return true;
      }
      const target = hooks.resolveTarget(intent);
      if (!target) {
        hooks.setStatus("Kein gültiges Rasterziel unter dem Fadenkreuz.", "warning");
        return true;
      }
      hooks.startDrag(target);
      hooks.setStatus("Linksklick halten und den Bereich blockweise live aufziehen.", "ready");
      return true;
    },
    canExecute: hooks.hasCompleteSelection,
    execute: hooks.execute,
    reset: hooks.reset,
  };
}
