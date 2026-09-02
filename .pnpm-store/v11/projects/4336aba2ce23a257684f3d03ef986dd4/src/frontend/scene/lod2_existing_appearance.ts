export const LOD2_EXISTING_WALL_COLOR = "#f1f3f5";
export const LOD2_EXISTING_ROOF_COLOR = "#e8ecef";
export const LOD2_EXISTING_ROOF_SEAM_COLOR = "#cfd6dc";

const FACE_COORDINATE_TOLERANCE_MM = 0.001;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function faceKey(value: unknown, index: number): string {
  const face = asRecord(value);
  return String(face.face_ref ?? face.faceRef ?? index);
}

function sameCoordinate(first: unknown, second: unknown): boolean {
  const left = Number(first);
  const right = Number(second);
  return Number.isFinite(left)
    && Number.isFinite(right)
    && Math.abs(left - right) <= FACE_COORDINATE_TOLERANCE_MM;
}

function samePolygon(first: unknown, second: unknown): boolean {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
  return first.every((point, pointIndex) => Array.isArray(point)
    && Array.isArray(second[pointIndex])
    && point.length === second[pointIndex].length
    && point.every((coordinate, coordinateIndex) => sameCoordinate(
      coordinate,
      second[pointIndex][coordinateIndex],
    )));
}

function sameFaces(first: unknown, second: unknown): boolean {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length === 0 || first.length !== second.length) {
    return false;
  }
  const sourceByKey = new Map(second.map((face, index) => [faceKey(face, index), asRecord(face)]));
  return first.every((faceValue, index) => {
    const face = asRecord(faceValue);
    const source = sourceByKey.get(faceKey(faceValue, index));
    return Boolean(source) && samePolygon(face.polygon_3d_mm, source?.polygon_3d_mm);
  });
}

/**
 * Existing status belongs to the imported roof geometry, not to unrelated
 * semantic metadata. In particular, adding/removing photovoltaic panels must
 * not recolour an otherwise untouched LoD2 roof as a newly designed roof.
 */
export function isUnmodifiedLod2RoofCalculation(
  calculationValue: unknown,
  semanticObjectRefValue: unknown,
): boolean {
  const calculation = asRecord(calculationValue);
  if (calculation.ok !== true
    || calculation.roof_type !== "imported"
    || calculation.source !== "lod2-original-surfaces") return false;

  const semanticObjectRef = asRecord(semanticObjectRefValue);
  const metadata = asRecord(semanticObjectRef.metadata ?? semanticObjectRef);
  const roofParameters = asRecord(metadata.roofParameters);
  const importedSource = asRecord(roofParameters.importedSource);
  const calculatedFaces = asRecord(calculation.geometry).faces;

  return sameFaces(calculatedFaces, importedSource.faces);
}
