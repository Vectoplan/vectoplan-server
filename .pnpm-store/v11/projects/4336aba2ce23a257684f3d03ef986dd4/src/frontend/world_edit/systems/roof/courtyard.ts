import * as THREE from "three";

import {
  normalizePolygonAreaPoints,
  polygonAreaPlanArea,
  type PolygonAreaPoint,
} from "../polygon_area/geometry";
import {
  DEFAULT_ROOF_TOOL_PARAMETERS,
  type RoofCalculationResult,
} from "./contracts";

function calculationFingerprint(
  outerRing: readonly PolygonAreaPoint[],
  holeRings: readonly (readonly PolygonAreaPoint[])[],
  eavesHeightMm: number,
  roofSkinThicknessMm: number,
): string {
  const encoded = JSON.stringify({
    outerRing: outerRing.map(({ x, z }) => [x, z]),
    holeRings: holeRings.map((ring) => ring.map(({ x, z }) => [x, z])),
    eavesHeightMm,
    roofSkinThicknessMm,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < encoded.length; index += 1) {
    hash ^= encoded.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `flat-courtyard-v1:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Build a deterministic flat-roof result locally. The CAD endpoint currently
 * accepts only one exterior ring, so sending a courtyard there would silently
 * cover the opening.
 */
export function createFlatRoofCalculation(
  points: readonly PolygonAreaPoint[],
  eavesHeightMm: number,
  holeRings: readonly (readonly PolygonAreaPoint[])[] = [],
  roofSkinThicknessMm = DEFAULT_ROOF_TOOL_PARAMETERS.roofSkinThicknessMm,
): RoofCalculationResult {
  const ring = normalizePolygonAreaPoints(points);
  const holes = holeRings
    .map((hole) => normalizePolygonAreaPoints(hole))
    .filter((hole) => hole.length >= 3);
  const areaM2 = Math.max(0, polygonAreaPlanArea(ring)
    - holes.reduce((sum, hole) => sum + polygonAreaPlanArea(hole), 0));
  const faces = holes.length === 0
    ? [{
        face_ref: "line_brush_flat_roof",
        role: "flat",
        polygon_3d_mm: ring.map((point) => [
          point.x * 1_000,
          point.z * 1_000,
          eavesHeightMm,
        ]),
        plan_area_m2: areaM2,
        surface_area_m2: areaM2,
      }]
    : THREE.ShapeUtils.triangulateShape(
        ring.map((point) => new THREE.Vector2(point.x, point.z)),
        holes.map((hole) => hole.map((point) => new THREE.Vector2(point.x, point.z))),
      ).map((triangle, index) => {
        const vertices = [...ring, ...holes.flat()];
        const trianglePoints = triangle.map((vertexIndex) => vertices[vertexIndex]!);
        const triangleArea = polygonAreaPlanArea(trianglePoints);
        return {
          face_ref: `line_brush_flat_roof_${index + 1}`,
          role: "flat",
          polygon_3d_mm: trianglePoints.map((point) => [
            point.x * 1_000,
            point.z * 1_000,
            eavesHeightMm,
          ]),
          plan_area_m2: triangleArea,
          surface_area_m2: triangleArea,
        };
      });
  if (faces.length === 0) {
    throw new Error("Die Dachfläche mit Innenhof konnte nicht trianguliert werden.");
  }
  const fingerprint = calculationFingerprint(
    ring,
    holes,
    eavesHeightMm,
    roofSkinThicknessMm,
  );
  return {
    ok: true,
    contract_version: "cad-roof-calculation-result/0.1",
    roof_type: "flat",
    calculation_id: fingerprint,
    input_fingerprint: fingerprint,
    geometry: {
      geometry_method: holes.length > 0
        ? "line-brush-flat-courtyard-triangulation-v1"
        : "line-brush-flat-fallback-v1",
      faces,
    },
    roof_build_up: {
      exterior_offset_mm: 0,
      layers: [{
        role: "roof_tile",
        thickness_mm: roofSkinThicknessMm,
        bottom_offset_mm: -roofSkinThicknessMm,
        top_offset_mm: 0,
      }],
      top_faces: faces,
    },
    structure: {
      rafters: [],
      purlins: [],
      bearing_model: {
        purlin_vertical_reference: "roof_zone_top",
        roof_zone_top_mm: eavesHeightMm,
        lowest_purlin_bottom_mm: eavesHeightMm,
      },
    },
    summary: {
      face_count: faces.length,
      rafter_count: 0,
      purlin_count: 0,
      maximum_height_mm: eavesHeightMm,
    },
  } as RoofCalculationResult;
}
