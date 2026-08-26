import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

type ParcelAction = "select" | "remove";

export interface ParcelSystemHooks {
  readonly cameraTarget: () => WorldEditPosition | null;
  readonly planeY: () => number;
  readonly setParcelAt: (
    position: WorldEditPosition,
    exactTarget: Readonly<{ x: number; z: number }> | null,
    action: ParcelAction,
  ) => boolean;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function parcelSelectionActionForIntent(
  action: EditorInputWorldEditIntent["action"],
): ParcelAction | null {
  if (action === "primary") return "select";
  if (action === "secondary") return "remove";
  return null;
}

export function createParcelSystem(hooks: ParcelSystemHooks): WorldEditSystem {
  return {
    tool: "parcel",
    aliases: ["flurst", "grundstück-auswahl", "grundstueck-auswahl"],
    ui: {
      title: "Flurstück Tool",
      hint: "Linksklick wählt ein Flurstück aus; Rechtsklick entfernt es aus der Auswahl.",
      activationMessage: "Flurstück anvisieren: Linksklick wählt aus, Rechtsklick entfernt.",
      maxDistance: 60,
      inventoryToolId: "parcel",
      operations: [],
      showBrushSettings: false,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: false,
      showClipboardStatus: false,
      resetLabel: "Grundstücke leeren",
      resetMessage: "Grundstücksauswahl geleert.",
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
      const action = parcelSelectionActionForIntent(intent.action);
      const cameraTarget = hooks.cameraTarget();
      const exactTarget = intent.targetPoint
        ? { x: intent.targetPoint.x, z: intent.targetPoint.z }
        : cameraTarget
          ? { x: cameraTarget.x, z: cameraTarget.z }
          : null;
      const parcelTarget = exactTarget
        ? { x: Math.floor(exactTarget.x), y: Math.floor(hooks.planeY()), z: Math.floor(exactTarget.z) }
        : intent.position ?? (intent.sourceCell
          ? { x: intent.sourceCell.worldX, y: intent.sourceCell.worldY, z: intent.sourceCell.worldZ }
          : null);
      if (parcelTarget && action) hooks.setParcelAt(parcelTarget, exactTarget, action);
      else if (!parcelTarget) hooks.setStatus("Kein gültiges Flurstücksziel.", "warning");
      return true;
    },
    canExecute: () => false,
    execute: () => undefined,
    reset: hooks.reset,
  };
}
