import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  CLIPBOARD_OPERATIONS,
  type WorldEditOperation,
  type WorldEditPosition,
  type WorldEditSystem,
} from "../contracts";

export interface ClipboardSystemHooks {
  readonly getOperation: () => WorldEditOperation;
  readonly execute: (target?: WorldEditPosition | null) => Promise<void>;
  readonly canExecute: () => boolean;
  readonly reset: () => void;
}

export function createClipboardSystem(hooks: ClipboardSystemHooks): WorldEditSystem {
  return {
    tool: "clipboard",
    aliases: ["copy", "cut", "paste", "copy-transform"],
    ui: {
      title: "Copy / Cut / Paste",
      hint: "Copy/Cut verwendet den markierten Bereich. Paste setzt die Zwischenablage am anvisierten Ziel ein.",
      activationMessage: "Copy, Cut oder Paste auswählen.",
      maxDistance: 40,
      inventoryToolId: "copy-transform",
      operations: CLIPBOARD_OPERATIONS,
      showBrushSettings: false,
      showCoordinates: true,
      showRulerResult: false,
      showOperation: true,
      showMaterial: false,
      showMask: true,
      showExecute: true,
      showClipboardStatus: true,
      resetLabel: "Auswahl löschen",
      resetMessage: "Zwischenablage-Auswahl zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "box",
      selectionDragMode: "box",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action.includes("release")) return true;
      if (intent.action === "primary" && hooks.getOperation() === "paste") {
        await hooks.execute(intent.position);
      }
      return true;
    },
    canExecute: hooks.canExecute,
    execute: () => hooks.execute(),
    reset: hooks.reset,
  };
}
