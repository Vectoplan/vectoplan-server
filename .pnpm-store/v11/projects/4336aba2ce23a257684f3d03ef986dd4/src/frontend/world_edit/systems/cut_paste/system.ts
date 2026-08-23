import type { EditorInputWorldEditIntent } from "@input/input_controller";
import type { WorldEditPosition, WorldEditSystem } from "../contracts";

export interface CutPasteSystemHooks {
  readonly getPhase: () => "select" | "move";
  readonly stopDrag: () => void;
  readonly adjustSelectionHandle: () => boolean;
  readonly resolveTarget: (intent: EditorInputWorldEditIntent) => WorldEditPosition | null;
  readonly startSelection: (target: WorldEditPosition) => void;
  readonly startMove: () => boolean;
  readonly captureOrPaste: () => Promise<void>;
  readonly canExecute: () => boolean;
  readonly reset: () => void;
  readonly rebuild: () => void;
  readonly refreshHud: () => void;
}

export function createCutPasteSystem(hooks: CutPasteSystemHooks): WorldEditSystem {
  let secondaryHandledOnDown = false;

  async function executeSecondaryAction(): Promise<void> {
    secondaryHandledOnDown = true;
    await hooks.captureOrPaste();
  }

  return {
    tool: "cut-paste",
    aliases: ["cut", "cut-transform"],
    ui: {
      title: "Cut / Paste",
      hint: "Bereich mit Linksklick markieren, Rechtsklick schneidet ihn aus. Danach die rote X-, grüne Y- oder blaue Z-Achse anvisieren und mit gehaltenem Linksklick blockweise verschieben. Rechtsklick fügt ein.",
      activationMessage: "Cut/Paste: Markieren, Rechtsklick ausschneiden, am X/Y/Z-Gizmo blockweise verschieben und mit Rechtsklick einfügen.",
      maxDistance: 40,
      inventoryToolId: "cut-transform",
      operations: [],
      showBrushSettings: false,
      showCoordinates: true,
      showRulerResult: false,
      showOperation: false,
      showMaterial: false,
      showMask: false,
      showExecute: true,
      showClipboardStatus: true,
      resetLabel: "Auswahl löschen",
      resetMessage: "Cut/Paste-Auswahl zurückgesetzt.",
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
      if (intent.action === "secondary-release") {
        if (secondaryHandledOnDown) {
          secondaryHandledOnDown = false;
        } else {
          await hooks.captureOrPaste();
        }
        return true;
      }
      if (hooks.getPhase() === "move") {
        if (intent.action === "primary") hooks.startMove();
        else await executeSecondaryAction();
        return true;
      }
      if (intent.action === "secondary") {
        await executeSecondaryAction();
        return true;
      }
      if (hooks.adjustSelectionHandle()) return true;
      const target = hooks.resolveTarget(intent);
      if (target) hooks.startSelection(target);
      return true;
    },
    canExecute: hooks.canExecute,
    execute: hooks.captureOrPaste,
    reset: hooks.reset,
    onActivate(previousTool): void {
      secondaryHandledOnDown = false;
      if (previousTool !== "cut-paste") hooks.reset();
      else hooks.rebuild();
    },
    onDeactivate(): void {
      secondaryHandledOnDown = false;
      hooks.stopDrag();
    },
  };
}
