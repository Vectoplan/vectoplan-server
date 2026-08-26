import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

export interface RoomSystemHooks {
  readonly stopInteraction: () => void;
  readonly startHover: () => void;
  readonly stopHover: () => void;
  readonly removePointUnderCrosshair: () => boolean;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly existingRoomAt: (target: WorldEditPosition) => unknown | null;
  readonly removeExistingRoom: (room: unknown) => void;
  readonly selectExistingRoom: (room: unknown) => void;
  readonly beginPointInteraction: (target: WorldEditPosition) => void;
  readonly finishArea: () => void;
  readonly clearRoomSelection: () => void;
  readonly hasCompleteSelection: () => boolean;
  readonly executeRoom: () => Promise<void>;
  readonly rebuild: () => void;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createRoomSystem(hooks: RoomSystemHooks): WorldEditSystem {
  return {
    tool: "room",
    aliases: ["rooms", "raum", "räume", "raeume"],
    ui: {
      title: "Räume",
      hint: "Raumkontur Punkt für Punkt zeichnen. Ersten Punkt erneut anklicken oder ESC drücken schließt und speichert die Fläche. Gelbe Eckpunkte lassen sich ziehen; Rechtsklick auf einen Raum löscht ihn.",
      activationMessage: "Raumfläche mit geraden Linien über Blockecken zeichnen; der geschlossene Bereich wird farbig gespeichert.",
      maxDistance: 120,
      inventoryToolId: "room",
      operations: [],
      showBrushSettings: false,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: true,
      showClipboardStatus: false,
      resetLabel: "Raumfläche löschen",
      resetMessage: "Raumfläche zurückgesetzt.",
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
      const target = hooks.resolveTarget(intent);
      if (intent.action === "secondary") {
        if (hooks.removePointUnderCrosshair()) return true;
        const room = target ? hooks.existingRoomAt(target) : null;
        if (room) hooks.removeExistingRoom(room);
        else {
          hooks.stopInteraction();
          hooks.clearRoomSelection();
          hooks.rebuild();
          hooks.setStatus("Raumfläche zurückgesetzt. Rechtsklick auf einen bestehenden Raum löscht nur diesen Raum.", "info");
        }
        return true;
      }
      if (!target) {
        hooks.setStatus("Keine Blockecke oder horizontale Raumebene unter dem Fadenkreuz.", "warning");
        return true;
      }
      const existing = hooks.existingRoomAt(target);
      if (existing && !hooks.hasCompleteSelection()) hooks.selectExistingRoom(existing);
      else hooks.beginPointInteraction(target);
      return true;
    },
    canExecute: hooks.hasCompleteSelection,
    execute: hooks.executeRoom,
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
