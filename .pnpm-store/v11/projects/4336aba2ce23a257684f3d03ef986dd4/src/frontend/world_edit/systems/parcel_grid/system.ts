import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

export interface ParcelGridSystemHooks {
  readonly isDragging: () => boolean;
  readonly updateDrag: () => void;
  readonly stopDrag: (commit: boolean) => void;
  readonly refreshHud: () => void;
  readonly moveInnerLineOutward: () => boolean;
  readonly startDrag: () => boolean;
  readonly cameraTarget: () => WorldEditPosition | null;
  readonly selectAt: (target: WorldEditPosition, exactTarget: WorldEditPosition | null) => boolean;
  readonly rebuild: () => void;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createParcelGridSystem(hooks: ParcelGridSystemHooks): WorldEditSystem {
  return {
    tool: "parcel-grid",
    aliases: ["grundst", "grundstücksraster", "grundstuecksraster"],
    ui: {
      title: "Grundstücksraster",
      hint: "Eine Grenze anklicken, dann den Doppelpfeil an der cyanfarbenen Linie greifen und bei gehaltenem Linksklick blockweise ziehen.",
      activationMessage: "Jede innere Rasterlinie hat einen Griff: Punkt oder Doppelpfeil anvisieren, Linksklick halten und blockweise ziehen.",
      maxDistance: 60,
      inventoryToolId: "parcel-grid",
      operations: [],
      showBrushSettings: false,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: false,
      showClipboardStatus: false,
      resetLabel: "Ziel löschen",
      resetMessage: "Rasterziel zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "none",
      selectionDragMode: "none",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: true,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action === "primary-release") {
        if (hooks.isDragging()) {
          hooks.updateDrag();
          hooks.stopDrag(true);
          hooks.refreshHud();
        }
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (intent.action === "secondary") hooks.moveInnerLineOutward();
      else if (intent.action === "primary") {
        if (hooks.startDrag()) return true;
        const cameraTarget = hooks.cameraTarget();
        const exactTarget = cameraTarget ?? intent.targetPoint;
        const gridTarget = exactTarget ? {
          x: Math.floor(exactTarget.x),
          y: Math.floor(exactTarget.y),
          z: Math.floor(exactTarget.z),
        } : intent.position;
        if (gridTarget) hooks.selectAt(gridTarget, exactTarget);
        else hooks.setStatus("Kein gültiges Ziel für das Grundstücksraster.", "warning");
      }
      return true;
    },
    canExecute: () => false,
    execute: () => undefined,
    reset: hooks.reset,
    onActivate: hooks.rebuild,
    onDeactivate: hooks.rebuild,
  };
}
