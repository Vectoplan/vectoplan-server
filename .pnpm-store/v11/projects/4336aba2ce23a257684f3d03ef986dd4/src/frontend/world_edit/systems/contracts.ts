import type { EditorInputWorldEditIntent } from "@input/input_controller";

export type WorldEditTool =
  | "selection"
  | "room"
  | "stair"
  | "paint"
  | "sculpt"
  | "parcel"
  | "parcel-grid"
  | "ruler"
  | "copy-paste"
  | "cut-paste"
  | "tentacle"
  | "roof";

export type WorldEditOperation =
  | "set"
  | "wall"
  | "fill"
  | "replace"
  | "clear"
  | "copy"
  | "cut"
  | "paste";

export interface WorldEditPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface WorldEditSystemUi {
  readonly title: string;
  readonly hint: string;
  readonly activationMessage: string;
  readonly maxDistance: number;
  readonly inventoryToolId: string;
  readonly operations: readonly WorldEditOperation[];
  readonly showBrushSettings: boolean;
  readonly showCoordinates: boolean;
  readonly showRulerResult: boolean;
  readonly showOperation: boolean;
  readonly showMaterial: boolean;
  readonly showMask: boolean;
  readonly showExecute: boolean;
  readonly showClipboardStatus: boolean;
  readonly resetLabel: string;
  readonly resetMessage: string;
}

export interface WorldEditSystemBehavior {
  readonly selectionVisualization: "none" | "box" | "ruler" | "clipboard";
  readonly selectionDragMode: "none" | "box" | "ruler";
  readonly commandTool: Extract<WorldEditTool, "selection" | "paint" | "sculpt"> | null;
  readonly requiresCompleteSelection: boolean;
  readonly showParcelGridHandles: boolean;
}

export interface WorldEditSystem {
  readonly tool: WorldEditTool;
  readonly aliases: readonly string[];
  readonly ui: WorldEditSystemUi;
  readonly behavior: WorldEditSystemBehavior;
  handleIntent(intent: EditorInputWorldEditIntent): Promise<boolean>;
  canExecute(): boolean;
  execute(): void | Promise<void>;
  reset(): void;
  handleKeyDown?(event: KeyboardEvent): boolean;
  onActivate?(previousTool: WorldEditTool | null): void;
  onDeactivate?(nextTool: WorldEditTool | null): void;
}

export interface WorldEditSystemRegistry {
  readonly systems: readonly WorldEditSystem[];
  get(tool: WorldEditTool): WorldEditSystem;
  match(value: unknown): WorldEditTool;
}

export type WorldEditStatusSetter = (message: string, kind?: string) => void;

// The Chunk service accepts a closed command-source vocabulary. Detailed
// subsystem information belongs in commandMetadata, not commandSource.
export const WORLD_EDIT_COMMAND_SOURCE = "editor" as const;

export const WORLD_OPERATIONS = ["set", "wall", "fill", "replace", "clear"] as const;
export const CLIPBOARD_OPERATIONS = ["copy", "cut", "paste"] as const;

export function passiveSystemMethod(): void {
  // Explicit no-op used by systems which do not expose execute/reset effects.
}
