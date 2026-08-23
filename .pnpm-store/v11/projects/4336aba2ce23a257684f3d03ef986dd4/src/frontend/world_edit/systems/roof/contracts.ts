import {
  normalizePolygonAreaPoints,
  type PolygonAreaPoint,
} from "../polygon_area/geometry";

export const ROOF_REQUEST_CONTRACT = "cad-roof-calculation-request/0.1" as const;
export const ROOF_RESULT_CONTRACT = "cad-roof-calculation-result/0.1" as const;

export type RoofType =
  | "flat"
  | "gable"
  | "hipped"
  | "half_hipped"
  | "pent"
  | "mansard"
  | "trapezoid"
  | "butterfly"
  | "pyramid"
  | "barrel"
  | "sawtooth";

export interface RoofToolParameters {
  roofType: RoofType;
  pitchDeg: number;
  eavesHeightMm: number;
  ridgeDirection: "auto" | "x" | "y" | number;
  overhangMm: number;
  overhangNorthMm: number;
  overhangEastMm: number;
  overhangSouthMm: number;
  overhangWestMm: number;
  edgeOverhangsMm: readonly number[];
  roofSkinThicknessMm: number;
  roofSkinMaterial: string;
  rafterWidthMm: number;
  rafterHeightMm: number;
  rafterSpacingMm: number;
  purlinWidthMm: number;
  purlinHeightMm: number;
  purlinMaximumSpacingMm: number;
  plateauWidthRatio: number;
  mansardBreakRatio: number;
  mansardLowerPitchDeg: number;
  mansardUpperPitchDeg: number;
  hipEndRatio: number;
  barrelRiseMm: number;
  barrelSegmentCount: number;
  sawtoothCount: number;
  sawtoothPitchDeg: number;
}

export const DEFAULT_ROOF_TOOL_PARAMETERS: RoofToolParameters = Object.freeze({
  roofType: "gable",
  pitchDeg: 35,
  eavesHeightMm: 6000,
  ridgeDirection: "auto",
  overhangMm: 500,
  overhangNorthMm: 500,
  overhangEastMm: 500,
  overhangSouthMm: 500,
  overhangWestMm: 500,
  edgeOverhangsMm: [],
  roofSkinThicknessMm: 180,
  roofSkinMaterial: "generic-roof-build-up",
  rafterWidthMm: 80,
  rafterHeightMm: 200,
  rafterSpacingMm: 700,
  purlinWidthMm: 160,
  purlinHeightMm: 240,
  purlinMaximumSpacingMm: 2500,
  plateauWidthRatio: 0.25,
  mansardBreakRatio: 0.38,
  mansardLowerPitchDeg: 70,
  mansardUpperPitchDeg: 28,
  hipEndRatio: 0.5,
  barrelRiseMm: 3000,
  barrelSegmentCount: 12,
  sawtoothCount: 3,
  sawtoothPitchDeg: 35,
});

export interface RoofCalculationRequest {
  readonly contract_version: typeof ROOF_REQUEST_CONTRACT;
  readonly roof_type: RoofType;
  readonly footprint: Readonly<{ outer_ring_mm: readonly (readonly [number, number])[] }>;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export type RoofCalculationResult = Readonly<Record<string, unknown>> & {
  readonly ok: true;
  readonly contract_version: typeof ROOF_RESULT_CONTRACT;
  readonly roof_type: RoofType;
};

export function buildRoofCalculationRequest(
  points: readonly PolygonAreaPoint[],
  parameters: RoofToolParameters,
): RoofCalculationRequest {
  const ring = normalizePolygonAreaPoints(points);
  return {
    contract_version: ROOF_REQUEST_CONTRACT,
    roof_type: parameters.roofType,
    footprint: {
      outer_ring_mm: ring.map(({ x, z }) => [x * 1000, z * 1000] as const),
    },
    parameters: {
      pitch_deg: parameters.pitchDeg,
      eaves_height_mm: parameters.eavesHeightMm,
      ridge_direction: parameters.ridgeDirection,
      overhang_mm: {
        default_mm: parameters.overhangMm,
        north_mm: parameters.overhangNorthMm,
        east_mm: parameters.overhangEastMm,
        south_mm: parameters.overhangSouthMm,
        west_mm: parameters.overhangWestMm,
        ...(parameters.edgeOverhangsMm.length > 0 ? { edges_mm: [...parameters.edgeOverhangsMm] } : {}),
      },
      roof_skin_thickness_mm: parameters.roofSkinThicknessMm,
      roof_skin_material: parameters.roofSkinMaterial,
      plateau_width_ratio: parameters.plateauWidthRatio,
      mansard_break_ratio: parameters.mansardBreakRatio,
      mansard_lower_pitch_deg: parameters.mansardLowerPitchDeg,
      mansard_upper_pitch_deg: parameters.mansardUpperPitchDeg,
      hip_end_ratio: parameters.hipEndRatio,
      barrel_rise_mm: parameters.barrelRiseMm,
      barrel_segment_count: parameters.barrelSegmentCount,
      sawtooth_count: parameters.sawtoothCount,
      sawtooth_pitch_deg: parameters.sawtoothPitchDeg,
      structure: {
        rafter: {
          width_mm: parameters.rafterWidthMm,
          height_mm: parameters.rafterHeightMm,
          spacing_mm: parameters.rafterSpacingMm,
        },
        purlin: {
          width_mm: parameters.purlinWidthMm,
          height_mm: parameters.purlinHeightMm,
          maximum_spacing_mm: parameters.purlinMaximumSpacingMm,
        },
      },
    },
  };
}

export async function requestRoofCalculation(
  request: RoofCalculationRequest,
  signal?: AbortSignal,
): Promise<RoofCalculationResult> {
  const response = await fetch("/editor/api/cad/automation/roof/calculate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const payload: unknown = await response.json().catch(() => ({}));
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  if (!response.ok || record.ok !== true || record.contract_version !== ROOF_RESULT_CONTRACT) {
    const errors = Array.isArray(record.errors) ? record.errors.join("; ") : "Ungültige Antwort der CAD-Dachberechnung.";
    throw new Error(String(record.message ?? errors));
  }
  return record as RoofCalculationResult;
}
