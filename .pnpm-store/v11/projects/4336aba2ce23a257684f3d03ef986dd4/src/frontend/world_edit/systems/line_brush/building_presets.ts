import type { RoofType } from "../roof/contracts";
import type { BuildingProgramTypeId } from "./building_programs";

/**
 * Architectural defaults for the built-in line-brush programs.
 *
 * These values describe design intent only.  Voxelisation remains owned by
 * building_geometry and roof construction remains owned by the
 * shared Roof WorldEdit contract.  Keeping the table data-only prevents a UI
 * change from silently changing the wall/grid algorithms.
 */

export const LINE_BRUSH_BUILDING_PRESET_SCHEMA_VERSION =
  "vectoplan.line-brush-building-preset.v1" as const;

export type LineBrushRoofType = Exclude<RoofType, "imported">;
export type LineBrushArrangement = "continuous" | "separated-modules";

export interface LineBrushBuildingPreset {
  readonly schemaVersion: typeof LINE_BRUSH_BUILDING_PRESET_SCHEMA_VERSION;
  readonly typeId: BuildingProgramTypeId;
  readonly label: string;
  readonly defaultStoreyCount: number;
  readonly arrangement: Readonly<{
    readonly kind: LineBrushArrangement;
    /** Desired length of one building along a centerline segment. */
    readonly moduleLengthMeters: number | null;
    /** Clear distance between independently editable building modules. */
    readonly gapMeters: number;
    /** Clear distance at both ends of a centerline segment. */
    readonly endSetbackMeters: number;
    /** Maximum building depth, while a narrower user brush stays narrower. */
    readonly maximumDepthMeters: number | null;
  }>;
  readonly roof: Readonly<{
    readonly type: LineBrushRoofType;
    readonly pitchDegrees: number;
    readonly overhangMillimeters: number;
  }>;
}

function preset(
  typeId: BuildingProgramTypeId,
  label: string,
  defaultStoreyCount: number,
  arrangement: LineBrushBuildingPreset["arrangement"],
  roof: LineBrushBuildingPreset["roof"],
): LineBrushBuildingPreset {
  return Object.freeze({
    schemaVersion: LINE_BRUSH_BUILDING_PRESET_SCHEMA_VERSION,
    typeId,
    label,
    defaultStoreyCount,
    arrangement: Object.freeze({ ...arrangement }),
    roof: Object.freeze({ ...roof }),
  });
}

export const LINE_BRUSH_BUILDING_PRESETS: Readonly<
  Record<BuildingProgramTypeId, LineBrushBuildingPreset>
> = Object.freeze({
  standard: preset("standard", "Neutraler Baukörper", 1, {
    kind: "continuous",
    moduleLengthMeters: null,
    gapMeters: 0,
    endSetbackMeters: 0,
    maximumDepthMeters: null,
  }, { type: "flat", pitchDegrees: 0, overhangMillimeters: 0 }),
  houses: preset("houses", "Freistehende Häuser", 2, {
    kind: "separated-modules",
    moduleLengthMeters: 11,
    gapMeters: 4,
    endSetbackMeters: 2,
    maximumDepthMeters: 12,
  }, { type: "gable", pitchDegrees: 35, overhangMillimeters: 350 }),
  "multi-family-housing": preset("multi-family-housing", "Mehrfamilienhäuser", 4, {
    kind: "separated-modules",
    moduleLengthMeters: 28,
    gapMeters: 8,
    endSetbackMeters: 4,
    maximumDepthMeters: 18,
  }, { type: "flat", pitchDegrees: 0, overhangMillimeters: 0 }),
  "industrial-logistics": preset("industrial-logistics", "Hallen und Logistik", 1, {
    kind: "separated-modules",
    moduleLengthMeters: 48,
    gapMeters: 12,
    endSetbackMeters: 5,
    maximumDepthMeters: 32,
  }, { type: "gable", pitchDegrees: 15, overhangMillimeters: 500 }),
  "office-commercial": preset("office-commercial", "Büro und Gewerbe", 5, {
    kind: "separated-modules",
    moduleLengthMeters: 34,
    gapMeters: 8,
    endSetbackMeters: 4,
    maximumDepthMeters: 20,
  }, { type: "flat", pitchDegrees: 0, overhangMillimeters: 0 }),
  "mixed-use": preset("mixed-use", "Mischnutzung", 5, {
    kind: "separated-modules",
    moduleLengthMeters: 36,
    gapMeters: 6,
    endSetbackMeters: 3,
    maximumDepthMeters: 22,
  }, { type: "flat", pitchDegrees: 0, overhangMillimeters: 0 }),
  "public-building": preset("public-building", "Öffentlicher Bau", 3, {
    kind: "separated-modules",
    moduleLengthMeters: 42,
    gapMeters: 10,
    endSetbackMeters: 5,
    maximumDepthMeters: 26,
  }, { type: "hipped", pitchDegrees: 25, overhangMillimeters: 450 }),
  hospitality: preset("hospitality", "Hotel und Beherbergung", 4, {
    kind: "separated-modules",
    moduleLengthMeters: 30,
    gapMeters: 8,
    endSetbackMeters: 4,
    maximumDepthMeters: 20,
  }, { type: "hipped", pitchDegrees: 30, overhangMillimeters: 400 }),
});

export const LINE_BRUSH_ROOF_OPTIONS: readonly Readonly<{
  value: LineBrushRoofType;
  label: string;
}>[] = Object.freeze([
  { value: "flat", label: "Flachdach" },
  { value: "gable", label: "Satteldach" },
  { value: "hipped", label: "Walmdach" },
  { value: "half_hipped", label: "Krüppelwalmdach" },
  { value: "pent", label: "Pultdach" },
  { value: "mansard", label: "Mansarddach" },
  { value: "trapezoid", label: "Trapezdach" },
  { value: "butterfly", label: "Schmetterlingsdach" },
  { value: "pyramid", label: "Zeltdach" },
  { value: "barrel", label: "Tonnendach" },
  { value: "sawtooth", label: "Sheddach" },
]);

const supportedRoofTypes = new Set<LineBrushRoofType>(
  LINE_BRUSH_ROOF_OPTIONS.map((option) => option.value),
);

export function lineBrushBuildingPreset(
  typeId: BuildingProgramTypeId,
): LineBrushBuildingPreset {
  return LINE_BRUSH_BUILDING_PRESETS[typeId] ?? LINE_BRUSH_BUILDING_PRESETS.standard;
}

export function normalizeLineBrushRoofType(
  value: unknown,
  fallback: LineBrushRoofType = LINE_BRUSH_BUILDING_PRESETS.standard.roof.type,
): LineBrushRoofType {
  const normalized = String(value ?? "").trim().toLowerCase() as LineBrushRoofType;
  return supportedRoofTypes.has(normalized) ? normalized : fallback;
}

export function lineBrushRoofDefaults(
  typeId: BuildingProgramTypeId,
  roofType?: LineBrushRoofType | string | null,
): Readonly<{ type: LineBrushRoofType; pitchDegrees: number; overhangMillimeters: number }> {
  const presetValue = lineBrushBuildingPreset(typeId).roof;
  const type = normalizeLineBrushRoofType(roofType, presetValue.type);
  return Object.freeze({
    type,
    pitchDegrees: type === "flat" ? 0 : presetValue.pitchDegrees || 35,
    overhangMillimeters: presetValue.overhangMillimeters,
  });
}
