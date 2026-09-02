import type { WorldEditTool } from "../world_edit/systems/contracts";

/**
 * The editor has one world, one scene and one command pipeline. Workspace modes
 * only describe how the user looks at and operates that shared runtime.
 */
export type EditorWorkspaceMode = "first-person" | "planning";

export type EditorWorkspaceToolProfile = "world" | "planning" | "shared";

export interface EditorWorkspaceModeDescriptor {
  readonly id: EditorWorkspaceMode;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly camera: "first-person" | "orbit";
  readonly toolProfiles: readonly EditorWorkspaceToolProfile[];
  readonly tools: readonly WorldEditTool[];
}

export interface EditorWorkspaceToolDescriptor {
  readonly tool: WorldEditTool;
  readonly label: string;
  readonly shortLabel: string;
  readonly profile: EditorWorkspaceToolProfile;
  readonly description: string;
}

export const EDITOR_WORKSPACE_TOOL_DESCRIPTORS: readonly EditorWorkspaceToolDescriptor[] = [
  { tool: "selection", label: "Auswahl", shortLabel: "Auswahl", profile: "shared", description: "Bereiche in derselben Welt auswählen und bearbeiten." },
  { tool: "paint", label: "Materialpinsel", shortLabel: "Pinsel", profile: "world", description: "Blöcke direkt in der Ego-Ansicht bemalen." },
  { tool: "sculpt", label: "Gelände formen", shortLabel: "Gelände", profile: "world", description: "Voxel und Gelände aus der Nähe modellieren." },
  { tool: "copy-paste", label: "Kopieren", shortLabel: "Kopieren", profile: "world", description: "Ausgewählte Weltbereiche kopieren und einsetzen." },
  { tool: "cut-paste", label: "Verschieben", shortLabel: "Verschieben", profile: "world", description: "Ausgewählte Weltbereiche verschieben." },
  { tool: "tentacle", label: "Tentacle Straße", shortLabel: "Straße", profile: "shared", description: "Straßenpfade mit derselben Tentacle-Kernlogik in Ego- und Planungsansicht zeichnen." },
  { tool: "parcel", label: "Grundstück", shortLabel: "Grundstück", profile: "planning", description: "Flurstücke und Projektgrenzen aus der Vogelperspektive bearbeiten." },
  { tool: "parcel-grid", label: "Baufeld", shortLabel: "Baufeld", profile: "planning", description: "Baufelder, Abstände und Raster auf dem Grundstück definieren." },
  { tool: "room", label: "Linien Brush", shortLabel: "Linien Brush", profile: "planning", description: "Gerade Segmente zu einer bearbeitbaren Gebäude-Baufläche verbinden." },
  { tool: "storey", label: "Geschoss", shortLabel: "Geschoss", profile: "shared", description: "Geschosse eines Linien-Brush-Baukörpers vollständig oder segmentweise hinzufügen und entfernen." },
  { tool: "stair", label: "Erschließung", shortLabel: "Treppe", profile: "planning", description: "Treppen und vertikale Erschließung planen." },
  { tool: "roof", label: "Dach", shortLabel: "Dach", profile: "shared", description: "Dachgeometrie und Solarbelegung in Ego- und Planungsansicht bearbeiten." },
  { tool: "ruler", label: "Messen", shortLabel: "Messen", profile: "shared", description: "Reale Distanzen in beiden Ansichten messen." },
] as const;

// A profile controls where a tool is promoted in the UI; it is not a camera
// capability restriction. WorldEdit always operates on the same world and an
// inventory selection must therefore never move the user's camera implicitly.
const ALL_WORLD_EDIT_TOOLS = EDITOR_WORKSPACE_TOOL_DESCRIPTORS.map((entry) => entry.tool);

export const EDITOR_WORKSPACE_MODES: readonly EditorWorkspaceModeDescriptor[] = [
  {
    id: "first-person",
    label: "Ego-Ansicht",
    shortLabel: "Ego",
    description: "Durch die Welt laufen, bauen und WorldEdit aus der Nähe verwenden.",
    camera: "first-person",
    toolProfiles: ["world", "shared"],
    tools: ALL_WORLD_EDIT_TOOLS,
  },
  {
    id: "planning",
    label: "Planungsansicht",
    shortLabel: "Planung",
    description: "Projekt, Grundstücke und Baukörper aus der Gottperspektive planen.",
    camera: "orbit",
    toolProfiles: ["planning", "shared"],
    tools: ALL_WORLD_EDIT_TOOLS,
  },
] as const;

export function normalizeEditorWorkspaceMode(
  value: unknown,
  fallback: EditorWorkspaceMode = "first-person",
): EditorWorkspaceMode {
  return value === "planning" || value === "first-person" ? value : fallback;
}

export function editorWorkspaceModeDescriptor(mode: EditorWorkspaceMode): EditorWorkspaceModeDescriptor {
  return EDITOR_WORKSPACE_MODES.find((entry) => entry.id === mode) ?? EDITOR_WORKSPACE_MODES[0]!;
}

export function editorWorkspaceToolDescriptor(tool: WorldEditTool): EditorWorkspaceToolDescriptor | null {
  return EDITOR_WORKSPACE_TOOL_DESCRIPTORS.find((entry) => entry.tool === tool) ?? null;
}

export function workspaceModeSupportsTool(mode: EditorWorkspaceMode, tool: WorldEditTool): boolean {
  return editorWorkspaceModeDescriptor(mode).tools.includes(tool);
}

/**
 * Direct one-block building/removal belongs to the first-person workspace.
 * Planning tools still mutate the same world through the WorldEdit command
 * pipeline; this policy only disables the generic input fallback.
 */
export function workspaceModeAllowsGenericBlockEditing(mode: EditorWorkspaceMode): boolean {
  return mode === "first-person";
}

export function preferredWorkspaceModeForTool(
  _tool: WorldEditTool,
  currentMode: EditorWorkspaceMode = "first-person",
): EditorWorkspaceMode {
  return currentMode;
}

/** Only cadastral tools own the blue parcel/raster presentation layer. */
export function worldEditToolShowsParcelGuides(tool: WorldEditTool | null): boolean {
  return tool === "parcel" || tool === "parcel-grid";
}

export interface WorkspacePointerNdc {
  readonly x: number;
  readonly y: number;
}

/**
 * Ego interaction is crosshair-based. Planning interaction follows the free
 * mouse cursor recorded by the orbit camera. Keeping this policy in one place
 * makes sprites, drag handles and WorldEdit points behave identically.
 */
export function workspacePointerNdc(
  mode: EditorWorkspaceMode,
  planningX: unknown,
  planningY: unknown,
): WorkspacePointerNdc {
  if (mode !== "planning") return { x: 0, y: 0 };
  const finiteCoordinate = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(-1, Math.min(1, numeric)) : 0;
  };
  return { x: finiteCoordinate(planningX), y: finiteCoordinate(planningY) };
}

export function planningWorkspaceTools(): readonly EditorWorkspaceToolDescriptor[] {
  return EDITOR_WORKSPACE_TOOL_DESCRIPTORS.filter(
    (entry) => (entry.profile === "planning" || entry.profile === "shared")
      && entry.tool !== "stair",
  );
}
