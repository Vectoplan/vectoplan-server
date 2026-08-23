import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  CLIPBOARD_OPERATIONS,
  type WorldEditOperation,
  type WorldEditPosition,
  type WorldEditSystem,
} from "../contracts";

export interface ClipboardSystemHooks {
  readonly getOperation: () => WorldEditOperation;
  readonly getPhase: () => "select" | "move";
  readonly isDragging: () => boolean;
  readonly updateDrag: () => void;
  readonly stopDrag: () => void;
  readonly adjustSelectionHandle: () => boolean;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly startSelection: (target: WorldEditPosition) => void;
  readonly startMove: () => boolean;
  readonly executeCurrent: () => Promise<void>;
  readonly canExecute: () => boolean;
  readonly reset: () => void;
  readonly rebuild: () => void;
  readonly refreshHud: () => void;
}

export function createClipboardSystem(hooks: ClipboardSystemHooks): WorldEditSystem {
  return {
    tool: "copy-paste",
    aliases: ["legacy-clipboard-adapter"],
    ui: {
      title: "Copy / Cut / Paste",
      hint: "Bereich markieren, mit Rechtsklick kopieren/ausschneiden, dann einen Eckgriff mit Linksklick halten und die Live-Vorschau bewegen. Rechtsklick fügt ein.",
      activationMessage: "Bereich mit Linksklick markieren; Rechtsklick übernimmt ihn in die bewegliche Vorschau.",
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
      selectionVisualization: "clipboard",
      selectionDragMode: "box",
      commandTool: null,
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    async handleIntent(intent): Promise<boolean> {
      if (intent.action === "primary-release") {
        hooks.stopDrag();
        hooks.rebuild();
        hooks.refreshHud();
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (hooks.getPhase() === "move") {
        if (intent.action === "primary") hooks.startMove();
        else await hooks.executeCurrent();
        return true;
      }
      if (intent.action === "secondary") {
        await hooks.executeCurrent();
        return true;
      }
      if (hooks.adjustSelectionHandle()) return true;
      const target = hooks.resolveTarget(intent);
      if (target) hooks.startSelection(target);
      return true;
    },
    canExecute: hooks.canExecute,
    execute: hooks.executeCurrent,
    reset: hooks.reset,
    onActivate: hooks.rebuild,
    onDeactivate: () => hooks.stopDrag(),
  };
}
