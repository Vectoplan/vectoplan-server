import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditPosition,
  type WorldEditStatusSetter,
  type WorldEditSystem,
} from "../contracts";

export interface RoomSystemHooks {
  readonly isDragging: () => boolean;
  readonly updateDrag: () => void;
  readonly stopDrag: () => void;
  readonly updateScenePreview: () => boolean;
  readonly rebuildScene: () => void;
  readonly refreshHud: () => void;
  readonly adjustHandle: () => boolean;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly existingRoomAt: (target: WorldEditPosition) => unknown | null;
  readonly removeExistingRoom: (room: unknown) => void;
  readonly selectExistingRoom: (room: unknown) => void;
  readonly beginNewRoom: (target: WorldEditPosition) => void;
  readonly clearRoomSelection: () => void;
  readonly hasCompleteSelection: () => boolean;
  readonly executeRoom: () => Promise<void>;
  readonly reset: () => void;
  readonly setStatus: WorldEditStatusSetter;
}

export function createRoomSystem(hooks: RoomSystemHooks): WorldEditSystem {
  return {
    tool: "room",
    aliases: ["rooms", "raum", "räume", "raeume"],
    ui: {
      title: "Räume",
      hint: "Beim Loslassen wird die Selection automatisch als Raum gespeichert. Danach kann sofort der nächste Raum gezeichnet werden; Rechtsklick auf einen Raum löscht ihn.",
      activationMessage: "Raumbereich wie beim Selection Tool aufziehen; beim Loslassen wird er automatisch gespeichert.",
      maxDistance: 60,
      inventoryToolId: "room",
      operations: [],
      showBrushSettings: false,
      showCoordinates: true,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: true,
      showClipboardStatus: false,
      resetLabel: "Auswahl löschen",
      resetMessage: "Raumauswahl zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "box",
      selectionDragMode: "box",
      commandTool: null,
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
          await hooks.executeRoom();
        }
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (intent.action === "primary" && hooks.adjustHandle()) return true;
      const target = hooks.resolveTarget(intent);
      if (intent.action === "secondary") {
        const room = target ? hooks.existingRoomAt(target) : null;
        if (room) hooks.removeExistingRoom(room);
        else {
          hooks.stopDrag();
          hooks.clearRoomSelection();
          hooks.rebuildScene();
          hooks.refreshHud();
          hooks.setStatus("Raumauswahl zurückgesetzt. Rechtsklick auf einen Raum löscht nur mit aktivem Räume-Tool.", "info");
        }
        return true;
      }
      if (!target) {
        hooks.setStatus("Kein gültiges Rasterziel unter dem Fadenkreuz.", "warning");
        return true;
      }
      const room = hooks.existingRoomAt(target);
      if (room) hooks.selectExistingRoom(room);
      else {
        hooks.beginNewRoom(target);
        hooks.setStatus("Linksklick halten und den Raumbereich wie mit dem Selection Tool aufziehen.", "ready");
      }
      return true;
    },
    canExecute: hooks.hasCompleteSelection,
    execute: hooks.executeRoom,
    reset: hooks.reset,
  };
}
