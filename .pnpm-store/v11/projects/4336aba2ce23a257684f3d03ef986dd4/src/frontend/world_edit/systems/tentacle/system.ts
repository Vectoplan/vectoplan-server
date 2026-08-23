import type { EditorInputWorldEditIntent } from "@input/input_controller";
import { WORLD_OPERATIONS, type WorldEditPosition, type WorldEditStatusSetter, type WorldEditSystem } from "../contracts";

export interface TentacleSystemHooks {
  readonly stopDrawing: () => void;
  readonly startHover: () => void;
  readonly stopHover: () => void;
  readonly finishPath: () => void;
  readonly removePointUnderCrosshair: () => boolean;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly startDrawing: (target: WorldEditPosition) => void;
  readonly executePath: () => Promise<void>;
  readonly pointCount: () => number;
  readonly rebuild: () => void;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createTentacleSystem(hooks: TentacleSystemHooks): WorldEditSystem {
  return {
    tool: "tentacle",
    aliases: ["tentacle-brush", "path-brush"],
    ui: {
      title: "Tentacle Brush",
      hint: "Linksklick setzt Punkte; halten zeichnet weiter. ESC beendet den Pfad. Anvisierte Punkte leuchten gelb: Linksklick verschiebt, Rechtsklick löscht. Rechtsklick außerhalb eines Punkts führt den Pfad aus.",
      activationMessage: "Tentacle: Gelb markierte Stützpunkte mit Linksklick verschieben oder mit Rechtsklick löschen.",
      maxDistance: 120,
      inventoryToolId: "tentacle",
      operations: WORLD_OPERATIONS,
      showBrushSettings: true,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: true,
      showMaterial: true,
      showMask: true,
      showExecute: true,
      showClipboardStatus: false,
      resetLabel: "Pfad löschen",
      resetMessage: "Tentacle-Pfad zurückgesetzt.",
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
        hooks.stopDrawing();
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (intent.action === "secondary") {
        if (hooks.removePointUnderCrosshair()) return true;
        await hooks.executePath();
        return true;
      }
      const target = hooks.resolveTarget(intent);
      if (!target) {
        hooks.setStatus("Kein gültiger Pfadpunkt unter dem Fadenkreuz.", "warning");
        return true;
      }
      hooks.startDrawing(target);
      return true;
    },
    canExecute: () => hooks.pointCount() >= 2,
    execute: hooks.executePath,
    reset: hooks.reset,
    handleKeyDown(event): boolean {
      if (event.key !== "Escape") return false;
      event.preventDefault();
      event.stopPropagation();
      hooks.finishPath();
      return true;
    },
    onActivate(): void {
      hooks.rebuild();
      hooks.startHover();
    },
    onDeactivate(): void {
      hooks.stopDrawing();
      hooks.stopHover();
    },
  };
}
