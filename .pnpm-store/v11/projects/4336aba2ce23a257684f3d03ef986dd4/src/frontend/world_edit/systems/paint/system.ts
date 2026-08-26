import { createBrushIntentHandler, type BrushSystemHooks } from "../shared/brush_intent";
import { WORLD_OPERATIONS, type WorldEditSystem } from "../contracts";

export function createPaintSystem(hooks: BrushSystemHooks): WorldEditSystem {
  return {
    tool: "paint",
    aliases: ["brush"],
    ui: {
      title: "Paint Brush",
      hint: "Linksklick trägt Material mit dem Paint Brush auf; Rechtsklick entfernt mit derselben Form.",
      activationMessage: "Paint Brush mit Linksklick anwenden; Rechtsklick entfernt.",
      maxDistance: 16,
      inventoryToolId: "paint",
      operations: WORLD_OPERATIONS,
      showBrushSettings: true,
      showCoordinates: false,
      showRulerResult: false,
      showOperation: true,
      showMaterial: true,
      showMask: true,
      showExecute: false,
      showClipboardStatus: false,
      resetLabel: "Ziel löschen",
      resetMessage: "Paint-Ziel zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "none",
      selectionDragMode: "none",
      commandTool: "paint",
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    handleIntent: createBrushIntentHandler(hooks),
    canExecute: () => true,
    execute: () => undefined,
    reset: hooks.reset,
  };
}
