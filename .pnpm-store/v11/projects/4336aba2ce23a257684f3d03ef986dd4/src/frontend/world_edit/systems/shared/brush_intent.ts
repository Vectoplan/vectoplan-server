import type { EditorInputWorldEditIntent } from "@input/input_controller";
import {
  type WorldEditOperation,
  type WorldEditPosition,
  type WorldEditStatusSetter,
} from "../contracts";

export interface BrushSystemHooks {
  readonly getOperation: () => WorldEditOperation;
  readonly setTarget: (target: WorldEditPosition | null) => void;
  readonly refreshHud: () => void;
  readonly executeAt: (target: WorldEditPosition, operation: WorldEditOperation) => Promise<void>;
  readonly setStatus: WorldEditStatusSetter;
  readonly reset: () => void;
}

export function createBrushIntentHandler(
  hooks: BrushSystemHooks,
): WorldEditSystemIntentHandler {
  return async (intent: EditorInputWorldEditIntent): Promise<boolean> => {
    if (intent.action.includes("release")) return true;
    const target = intent.position;
    if (!target) {
      hooks.setStatus("Kein gültiges Pinselziel unter dem Fadenkreuz.", "warning");
      return true;
    }
    hooks.setTarget(target);
    hooks.refreshHud();
    await hooks.executeAt(target, intent.action === "secondary" ? "clear" : hooks.getOperation());
    return true;
  };
}

export type WorldEditSystemIntentHandler = (
  intent: EditorInputWorldEditIntent,
) => Promise<boolean>;
