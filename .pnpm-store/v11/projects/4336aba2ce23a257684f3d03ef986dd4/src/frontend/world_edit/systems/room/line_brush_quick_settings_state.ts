import {
  DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
  DEFAULT_BUILDING_PROGRAM_TYPE_ID,
  STANDARD_STOREY_HEIGHT_METERS,
  STANDARD_STOREY_HEIGHT_MILLIMETERS,
  buildBuildingProgramExecutionMetadata,
  createBuildingProgramTemplateCatalog,
  getBuildingProgramType,
  selectBuildingProgramTemplate,
  type BuildingProgramExecutionMetadata,
  type BuildingProgramTemplateCatalog,
  type BuildingProgramTemplateSelection,
  type BuildingProgramTypeDefinition,
  type BuildingProgramTypeId,
  type LineBrushBuildingProgramTemplate,
} from "./line_brush_building_programs";

export const LINE_BRUSH_QUICK_SETTINGS_STATE_SCHEMA_VERSION =
  "vectoplan.line-brush-quick-settings-state.v1" as const;
export const LINE_BRUSH_BUILDING_GENERATION_REQUEST_SCHEMA_VERSION =
  "vectoplan.line-brush-building-generation-request.v1" as const;

export const MINIMUM_LINE_BRUSH_STOREY_COUNT = 1;
export const MAXIMUM_LINE_BRUSH_STOREY_COUNT = 80;
export const DEFAULT_LINE_BRUSH_STOREY_COUNT = 1;

export interface LineBrushQuickSettingsState {
  readonly schemaVersion: typeof LINE_BRUSH_QUICK_SETTINGS_STATE_SCHEMA_VERSION;
  readonly typeId: BuildingProgramTypeId;
  readonly storeyCount: number;
  readonly templateId: string;
}

export interface LineBrushQuickSettingsSnapshot extends LineBrushQuickSettingsState {
  readonly type: BuildingProgramTypeDefinition;
  readonly selection: BuildingProgramTemplateSelection;
  readonly storeyHeightMeters: typeof STANDARD_STOREY_HEIGHT_METERS;
  readonly storeyHeightMillimeters: typeof STANDARD_STOREY_HEIGHT_MILLIMETERS;
  readonly totalHeightMeters: number;
  readonly totalHeightMillimeters: number;
  readonly storeyHeightLabel: string;
  readonly totalHeightLabel: string;
  readonly canGenerate: boolean;
}

export interface LineBrushBuildingGenerationRequest {
  readonly schemaVersion: typeof LINE_BRUSH_BUILDING_GENERATION_REQUEST_SCHEMA_VERSION;
  readonly typeId: BuildingProgramTypeId;
  readonly storeyCount: number;
  readonly storeyHeightMeters: typeof STANDARD_STOREY_HEIGHT_METERS;
  readonly storeyHeightMillimeters: typeof STANDARD_STOREY_HEIGHT_MILLIMETERS;
  readonly totalHeightMeters: number;
  readonly totalHeightMillimeters: number;
  readonly templateSelection: BuildingProgramTemplateSelection;
  readonly buildingProgram: BuildingProgramExecutionMetadata;
}

export type LineBrushQuickSettingsAction =
  | Readonly<{ type: "set-building-type"; typeId: BuildingProgramTypeId | string | null }>
  | Readonly<{ type: "set-storey-count"; storeyCount: number }>
  | Readonly<{ type: "increment-storey-count"; delta: number }>
  | Readonly<{ type: "select-template"; templateId: string | null }>;

export const DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE: LineBrushQuickSettingsState = Object.freeze({
  schemaVersion: LINE_BRUSH_QUICK_SETTINGS_STATE_SCHEMA_VERSION,
  typeId: DEFAULT_BUILDING_PROGRAM_TYPE_ID,
  storeyCount: DEFAULT_LINE_BRUSH_STOREY_COUNT,
  templateId: DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
});

function safeRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

export function normalizeLineBrushStoreyCount(value: unknown): number {
  const candidate = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(candidate)) return DEFAULT_LINE_BRUSH_STOREY_COUNT;
  return Math.max(
    MINIMUM_LINE_BRUSH_STOREY_COUNT,
    Math.min(MAXIMUM_LINE_BRUSH_STOREY_COUNT, Math.round(candidate)),
  );
}

export function formatLineBrushHeightMeters(value: number): string {
  const finite = Number.isFinite(value) ? value : 0;
  return `${finite.toFixed(3).replace(".", ",")} m`;
}

function compatibleTemplate(
  catalog: BuildingProgramTemplateCatalog,
  typeId: BuildingProgramTypeId,
  templateId: unknown,
): LineBrushBuildingProgramTemplate | null {
  const id = String(templateId ?? "").trim();
  if (!id) return null;
  const template = catalog.templates.find((candidate) => candidate.id === id) ?? null;
  if (!template) return null;
  return template.source === "builtin" || template.typeId === typeId ? template : null;
}

export function normalizeLineBrushQuickSettingsState(
  value: unknown,
  catalog: BuildingProgramTemplateCatalog = createBuildingProgramTemplateCatalog(),
): LineBrushQuickSettingsState {
  const record = safeRecord(value);
  const rawTypeId = record.typeId ?? record.type_id;
  const typeId = getBuildingProgramType(
    typeof rawTypeId === "string" ? rawTypeId : null,
  ).id;
  const template = compatibleTemplate(catalog, typeId, record.templateId ?? record.template_id);
  return {
    schemaVersion: LINE_BRUSH_QUICK_SETTINGS_STATE_SCHEMA_VERSION,
    typeId,
    storeyCount: normalizeLineBrushStoreyCount(record.storeyCount ?? record.storey_count),
    templateId: template?.id ?? DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
  };
}

export function buildingProgramTemplatesForType(
  catalog: BuildingProgramTemplateCatalog,
  typeId: BuildingProgramTypeId | string | null | undefined,
): LineBrushBuildingProgramTemplate[] {
  const normalizedType = getBuildingProgramType(typeId).id;
  return catalog.templates.filter(
    (template) => template.source === "builtin" || template.typeId === normalizedType,
  );
}

export function createLineBrushQuickSettingsSnapshot(
  value: unknown = DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE,
  catalog: BuildingProgramTemplateCatalog = createBuildingProgramTemplateCatalog(),
): LineBrushQuickSettingsSnapshot {
  const state = normalizeLineBrushQuickSettingsState(value, catalog);
  const totalHeightMillimeters = state.storeyCount * STANDARD_STOREY_HEIGHT_MILLIMETERS;
  const totalHeightMeters = totalHeightMillimeters / 1_000;
  const selection = selectBuildingProgramTemplate(
    catalog,
    state.templateId,
    state.typeId,
  );
  return {
    ...state,
    type: getBuildingProgramType(state.typeId),
    selection,
    storeyHeightMeters: STANDARD_STOREY_HEIGHT_METERS,
    storeyHeightMillimeters: STANDARD_STOREY_HEIGHT_MILLIMETERS,
    totalHeightMeters,
    totalHeightMillimeters,
    storeyHeightLabel: formatLineBrushHeightMeters(STANDARD_STOREY_HEIGHT_METERS),
    totalHeightLabel: formatLineBrushHeightMeters(totalHeightMeters),
    canGenerate: selection.action === "execute",
  };
}

export function reduceLineBrushQuickSettingsState(
  value: unknown,
  action: LineBrushQuickSettingsAction,
  catalog: BuildingProgramTemplateCatalog = createBuildingProgramTemplateCatalog(),
): LineBrushQuickSettingsState {
  const current = normalizeLineBrushQuickSettingsState(value, catalog);
  switch (action.type) {
    case "set-building-type": {
      const typeId = getBuildingProgramType(action.typeId).id;
      return {
        ...current,
        typeId,
        // A template belongs to one program type. Reset deterministically when
        // the filter changes instead of applying a stale program silently.
        templateId: DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
      };
    }
    case "set-storey-count":
      return { ...current, storeyCount: normalizeLineBrushStoreyCount(action.storeyCount) };
    case "increment-storey-count":
      return {
        ...current,
        storeyCount: normalizeLineBrushStoreyCount(current.storeyCount + action.delta),
      };
    case "select-template": {
      const template = compatibleTemplate(catalog, current.typeId, action.templateId);
      return { ...current, templateId: template?.id ?? DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID };
    }
  }
}

export function createLineBrushBuildingGenerationRequest(
  value: unknown,
  catalog: BuildingProgramTemplateCatalog = createBuildingProgramTemplateCatalog(),
): LineBrushBuildingGenerationRequest {
  const snapshot = createLineBrushQuickSettingsSnapshot(value, catalog);
  if (!snapshot.canGenerate) {
    throw new Error("The selected Marketplace template must be installed before generation.");
  }
  return {
    schemaVersion: LINE_BRUSH_BUILDING_GENERATION_REQUEST_SCHEMA_VERSION,
    typeId: snapshot.typeId,
    storeyCount: snapshot.storeyCount,
    storeyHeightMeters: snapshot.storeyHeightMeters,
    storeyHeightMillimeters: snapshot.storeyHeightMillimeters,
    totalHeightMeters: snapshot.totalHeightMeters,
    totalHeightMillimeters: snapshot.totalHeightMillimeters,
    templateSelection: snapshot.selection,
    buildingProgram: buildBuildingProgramExecutionMetadata(snapshot.selection),
  };
}
