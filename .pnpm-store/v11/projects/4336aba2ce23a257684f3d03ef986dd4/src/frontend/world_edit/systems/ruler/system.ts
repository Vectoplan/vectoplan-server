import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

export interface RulerSystemHooks {
  readonly isDragging: () => boolean;
  readonly updateDrag: () => void;
  readonly stopDrag: () => void;
  readonly rebuildScene: () => void;
  readonly refreshHud: () => void;
  readonly clearMeasurement: () => void;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly startDrag: (target: WorldEditPosition) => void;
  readonly measurementMetres: () => number | null;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createRulerSystem(hooks: RulerSystemHooks): WorldEditSystem {
  return {
    tool: "ruler",
    aliases: ["measure", "measurement", "mess", "ruler-laser"],
    ui: {
      title: "Messwerkzeug",
      hint: "Linksklick halten und bis zum zweiten Messpunkt ziehen. In Blocknähe rasten beide Punkte an den Ecken ein; Distanz und Achsmaße stehen mittig an der Linie.",
      activationMessage: "Ersten Messpunkt setzen; nahe Blockecken rastet das Messwerkzeug automatisch ein.",
      maxDistance: 60,
      inventoryToolId: "ruler-laser",
      operations: [],
      showBrushSettings: false,
      showCoordinates: true,
      showRulerResult: true,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: false,
      showClipboardStatus: false,
      resetLabel: "Messung löschen",
      resetMessage: "Messung zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "ruler",
      selectionDragMode: "ruler",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action === "primary-release") {
        if (hooks.isDragging()) {
          hooks.updateDrag();
          hooks.stopDrag();
          hooks.rebuildScene();
          hooks.refreshHud();
          const distance = hooks.measurementMetres();
          hooks.setStatus(
            distance === null ? "Messung unvollständig." : `Distanz: ${distance.toFixed(2)} Meter`,
            distance === null ? "warning" : "ready",
          );
        }
        return true;
      }
      if (intent.action === "secondary" || intent.action === "secondary-release") {
        if (intent.action === "secondary") {
          hooks.stopDrag();
          hooks.clearMeasurement();
          hooks.rebuildScene();
          hooks.refreshHud();
        }
        return true;
      }
      const target = hooks.resolveTarget(intent);
      if (!target) {
        hooks.setStatus("Kein gültiger Messpunkt unter dem Fadenkreuz.", "warning");
        return true;
      }
      hooks.startDrag(target);
      hooks.setStatus("Bis zum zweiten Messpunkt ziehen und Linksklick loslassen.", "ready");
      return true;
    },
    canExecute: () => false,
    execute: () => undefined,
    reset: hooks.reset,
  };
}
