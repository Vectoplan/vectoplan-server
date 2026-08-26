import type { EditorInputWorldEditIntent } from "@input/input_controller";
import type { WorldEditPosition, WorldEditSystem } from "../contracts";

export interface CopyPasteSystemHooks {
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

export function createCopyPasteSystem(hooks: CopyPasteSystemHooks): WorldEditSystem {
  let secondaryHandledOnDown = false;

  async function executeSecondaryAction(): Promise<void> {
    secondaryHandledOnDown = true;
    await hooks.captureOrPaste();
  }

  return {
    tool: "copy-paste",
    aliases: ["copy", "copy-transform"],
    ui: {
      title: "Copy / Paste",
      hint: "Bereich mit Linksklick markieren, Rechtsklick kopiert ihn. Danach die rote X-, grüne Y- oder blaue Z-Achse anvisieren und mit gehaltenem Linksklick blockweise verschieben. Rechtsklick fügt ein.",
      activationMessage: "Copy/Paste: Markieren, Rechtsklick kopieren, am X/Y/Z-Gizmo blockweise verschieben und mit Rechtsklick einfügen.",
      maxDistance: 40,
      inventoryToolId: "copy-transform",
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
      resetMessage: "Copy/Paste-Auswahl zurückgesetzt.",
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
          // Pointer lock can occasionally lose the matching button-down event.
          // The release remains a safe confirmation fallback. The latch above
          // prevents an ordinary down/up pair from executing twice.
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
      if (previousTool !== "copy-paste") hooks.reset();
      else hooks.rebuild();
    },
    onDeactivate(): void {
      secondaryHandledOnDown = false;
      hooks.stopDrag();
    },
  };
}
