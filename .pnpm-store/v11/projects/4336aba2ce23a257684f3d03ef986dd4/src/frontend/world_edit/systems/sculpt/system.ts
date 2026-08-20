import { createBrushIntentHandler, type BrushSystemHooks } from "../shared/brush_intent";
import { WORLD_OPERATIONS, type WorldEditSystem } from "../contracts";

export function createSculptSystem(hooks: BrushSystemHooks): WorldEditSystem {
  return {
    tool: "sculpt",
    aliases: ["terrain-sculpt"],
    ui: {
      title: "Sculpt Brush",
      hint: "Linksklick formt Volumen mit dem Sculpt Brush; Rechtsklick entfernt mit derselben Form.",
      activationMessage: "Sculpt Brush mit Linksklick anwenden; Rechtsklick entfernt.",
      maxDistance: 16,
      inventoryToolId: "sculpt",
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
      resetMessage: "Sculpt-Ziel zurückgesetzt.",
    },
    behavior: {
      selectionVisualization: "none",
      selectionDragMode: "none",
      commandTool: "sculpt",
      requiresCompleteSelection: false,
      showParcelGridHandles: false,
    },
    handleIntent: createBrushIntentHandler(hooks),
    canExecute: () => true,
    execute: () => undefined,
    reset: hooks.reset,
  };
}
