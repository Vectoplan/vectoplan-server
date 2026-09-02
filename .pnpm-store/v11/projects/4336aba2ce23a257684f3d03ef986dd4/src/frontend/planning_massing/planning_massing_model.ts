/**
 * Pure planning-massing geometry. This module owns no scene or world state;
 * the resulting bounds are executed by the existing WorldEdit controller.
 */
export interface PlanningMassingPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PlanningMassingSelectionBounds {
  readonly minimum: PlanningMassingPoint;
  readonly maximum: PlanningMassingPoint;
}

export interface PlanningMassingDraft {
  readonly schemaVersion: "vectoplan-planning-massing-draft.v1";
  readonly bodyBounds: PlanningMassingSelectionBounds;
  readonly roofPoints: readonly PlanningMassingPoint[];
  readonly widthBlocks: number;
  readonly depthBlocks: number;
  readonly heightBlocks: number;
  readonly footprintAreaM2: number;
  readonly volumeM3: number;
  readonly roofEavesY: number;
}

export interface PlanningMassingValidation {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly draft: PlanningMassingDraft | null;
}

export const PLANNING_MASSING_MIN_HEIGHT_BLOCKS = 1;
export const PLANNING_MASSING_MAX_HEIGHT_BLOCKS = 128;
export const PLANNING_MASSING_MAX_AXIS_BLOCKS = 256;
export const PLANNING_MASSING_MAX_VOLUME_BLOCKS = 2_000_000;

function integer(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.floor(numberValue) : null;
}

export function normalizePlanningMassingHeight(value: unknown, fallback = 6): number {
  const numeric = integer(value) ?? integer(fallback) ?? 6;
  return Math.min(
    PLANNING_MASSING_MAX_HEIGHT_BLOCKS,
    Math.max(PLANNING_MASSING_MIN_HEIGHT_BLOCKS, numeric),
  );
}

export function validatePlanningMassing(
  selection: PlanningMassingSelectionBounds | null | undefined,
  heightValue: unknown,
): PlanningMassingValidation {
  if (!selection) {
    return {
      ok: false,
      code: "massing_selection_missing",
      message: "Zuerst ein rechteckiges Baufeld aufziehen.",
      draft: null,
    };
  }

  const coordinates = [
    selection.minimum.x,
    selection.minimum.y,
    selection.minimum.z,
    selection.maximum.x,
    selection.maximum.y,
    selection.maximum.z,
  ].map(Number);
  if (!coordinates.every(Number.isFinite)) {
    return {
      ok: false,
      code: "massing_selection_invalid",
      message: "Das Baufeld enthält keine gültigen Rasterkoordinaten.",
      draft: null,
    };
  }

  const minimumX = Math.floor(Math.min(selection.minimum.x, selection.maximum.x));
  const maximumX = Math.floor(Math.max(selection.minimum.x, selection.maximum.x));
  const minimumZ = Math.floor(Math.min(selection.minimum.z, selection.maximum.z));
  const maximumZ = Math.floor(Math.max(selection.minimum.z, selection.maximum.z));
  const baseY = Math.floor(Math.min(selection.minimum.y, selection.maximum.y));
  const widthBlocks = maximumX - minimumX + 1;
  const depthBlocks = maximumZ - minimumZ + 1;
  const heightBlocks = normalizePlanningMassingHeight(heightValue);

  if (widthBlocks > PLANNING_MASSING_MAX_AXIS_BLOCKS || depthBlocks > PLANNING_MASSING_MAX_AXIS_BLOCKS) {
    return {
      ok: false,
      code: "massing_footprint_too_large",
      message: `Das Baufeld darf höchstens ${PLANNING_MASSING_MAX_AXIS_BLOCKS} × ${PLANNING_MASSING_MAX_AXIS_BLOCKS} Blöcke groß sein.`,
      draft: null,
    };
  }

  const footprintAreaM2 = widthBlocks * depthBlocks;
  const volumeM3 = footprintAreaM2 * heightBlocks;
  if (volumeM3 > PLANNING_MASSING_MAX_VOLUME_BLOCKS) {
    return {
      ok: false,
      code: "massing_volume_too_large",
      message: `Der Baukörper darf höchstens ${PLANNING_MASSING_MAX_VOLUME_BLOCKS.toLocaleString("de-DE")} Blöcke enthalten.`,
      draft: null,
    };
  }

  const maximumY = baseY + heightBlocks - 1;
  const roofEavesY = maximumY + 1;
  const roofPoints: readonly PlanningMassingPoint[] = [
    { x: minimumX, y: roofEavesY, z: minimumZ },
    { x: maximumX + 1, y: roofEavesY, z: minimumZ },
    { x: maximumX + 1, y: roofEavesY, z: maximumZ + 1 },
    { x: minimumX, y: roofEavesY, z: maximumZ + 1 },
  ];
  const draft: PlanningMassingDraft = {
    schemaVersion: "vectoplan-planning-massing-draft.v1",
    bodyBounds: {
      minimum: { x: minimumX, y: baseY, z: minimumZ },
      maximum: { x: maximumX, y: maximumY, z: maximumZ },
    },
    roofPoints,
    widthBlocks,
    depthBlocks,
    heightBlocks,
    footprintAreaM2,
    volumeM3,
    roofEavesY,
  };
  return {
    ok: true,
    code: "massing_ready",
    message: `${widthBlocks} × ${depthBlocks} × ${heightBlocks} Blöcke`,
    draft,
  };
}
