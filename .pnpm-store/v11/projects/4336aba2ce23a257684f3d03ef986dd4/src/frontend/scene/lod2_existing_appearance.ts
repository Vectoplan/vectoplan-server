export const LOD2_EXISTING_WALL_COLOR = "#f1f3f5";
// Untouched survey buildings read as one quiet, neutral-white context model.
// Designed/edited roofs keep their deliberate material colour in the roof
// renderer, while PV modules remain an independent overlay.
export const LOD2_EXISTING_ROOF_COLOR = LOD2_EXISTING_WALL_COLOR;
export const LOD2_EXISTING_ROOF_SEAM_COLOR = "#dce1e5";

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

function samePoint(first: unknown, second: unknown): boolean {
  return Array.isArray(first)
    && Array.isArray(second)
    && first.length === second.length
    && first.every((coordinate, coordinateIndex) => sameCoordinate(
      coordinate,
      second[coordinateIndex],
    ));
}

function openPolygon(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  return value.length > 3 && samePoint(value[0], value.at(-1))
    ? value.slice(0, -1)
    : value;
}

/** Polygon identity must not depend on which vertex an importer emitted first. */
function samePolygon(first: unknown, second: unknown): boolean {
  const left = openPolygon(first);
  const right = openPolygon(second);
  if (!left || !right || left.length !== right.length) return false;
  for (let offset = 0; offset < right.length; offset += 1) {
    if (!samePoint(left[0], right[offset])) continue;
    const forward = left.every((point, index) => samePoint(
      point,
      right[(offset + index) % right.length],
    ));
    if (forward) return true;
    const reverse = left.every((point, index) => samePoint(
      point,
      right[(offset - index + right.length) % right.length],
    ));
    if (reverse) return true;
  }
  return false;
}

const FACE_SPATIAL_BUCKET_WIDTH_MM = FACE_COORDINATE_TOLERANCE_MM * 2;

interface PolygonSpatialBucket {
  readonly pointCount: number;
  readonly cells: readonly [number, number, number];
}

/**
 * A polygon's centroid changes by at most the per-coordinate tolerance when
 * every corresponding vertex does. Two-tolerance-wide cells plus the 3x3x3
 * neighbourhood therefore cannot lose a valid match at a bucket boundary.
 */
function polygonSpatialBucket(value: unknown): PolygonSpatialBucket | null {
  const polygon = openPolygon(value);
  if (!polygon) return null;
  const sums = [0, 0, 0];
  for (const pointValue of polygon) {
    if (!Array.isArray(pointValue) || pointValue.length !== 3) return null;
    for (let coordinateIndex = 0; coordinateIndex < 3; coordinateIndex += 1) {
      const coordinate = Number(pointValue[coordinateIndex]);
      if (!Number.isFinite(coordinate)) return null;
      sums[coordinateIndex]! += coordinate;
    }
  }
  const cells = sums.map((sum) => Math.floor(
    (sum / polygon.length) / FACE_SPATIAL_BUCKET_WIDTH_MM,
  )) as [number, number, number];
  return { pointCount: polygon.length, cells };
}

function polygonSpatialBucketKey(
  pointCount: number,
  cells: readonly [number, number, number],
): string {
  return `${pointCount}:${cells[0]}:${cells[1]}:${cells[2]}`;
}

function neighboringPolygonBucketKeys(bucket: PolygonSpatialBucket): readonly string[] {
  const result: string[] = [];
  for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      for (let zOffset = -1; zOffset <= 1; zOffset += 1) {
        result.push(polygonSpatialBucketKey(bucket.pointCount, [
          bucket.cells[0] + xOffset,
          bucket.cells[1] + yOffset,
          bucket.cells[2] + zOffset,
        ]));
      }
    }
  }
  return result;
}

interface SourceFaceEntry {
  readonly face: Record<string, unknown>;
  readonly faceKey: string;
  readonly spatialBucket: PolygonSpatialBucket | null;
  used: boolean;
}

function takeMatchingSourceIndex(
  candidateIndexes: number[] | undefined,
  sourceEntries: readonly SourceFaceEntry[],
  polygon: unknown,
): number {
  if (!candidateIndexes) return -1;
  for (let position = candidateIndexes.length - 1; position >= 0; position -= 1) {
    const sourceIndex = candidateIndexes[position]!;
    const candidate = sourceEntries[sourceIndex]!;
    if (candidate.used) {
      candidateIndexes[position] = candidateIndexes.at(-1)!;
      candidateIndexes.pop();
      continue;
    }
    if (!samePolygon(polygon, candidate.face.polygon_3d_mm)) continue;
    candidateIndexes[position] = candidateIndexes.at(-1)!;
    candidateIndexes.pop();
    candidate.used = true;
    return sourceIndex;
  }
  return -1;
}

function sameFaces(first: unknown, second: unknown): boolean {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length === 0 || first.length !== second.length) {
    return false;
  }
  const sourceEntries: SourceFaceEntry[] = second.map((faceValue, index) => {
    const face = asRecord(faceValue);
    return {
      face,
      faceKey: faceKey(faceValue, index),
      spatialBucket: polygonSpatialBucket(face.polygon_3d_mm),
      used: false,
    };
  });
  const sourceBySpatialBucket = new Map<string, number[]>();
  const sourceByFaceKey = new Map<string, number[]>();
  sourceEntries.forEach((entry, index) => {
    if (entry.spatialBucket) {
      const bucketKey = polygonSpatialBucketKey(
        entry.spatialBucket.pointCount,
        entry.spatialBucket.cells,
      );
      const indexes = sourceBySpatialBucket.get(bucketKey) ?? [];
      indexes.push(index);
      sourceBySpatialBucket.set(bucketKey, indexes);
    }
    const faceIndexes = sourceByFaceKey.get(entry.faceKey) ?? [];
    faceIndexes.push(index);
    sourceByFaceKey.set(entry.faceKey, faceIndexes);
  });

  for (const [index, faceValue] of first.entries()) {
    const face = asRecord(faceValue);
    let sourceIndex = takeMatchingSourceIndex(
      sourceByFaceKey.get(faceKey(faceValue, index)),
      sourceEntries,
      face.polygon_3d_mm,
    );
    if (sourceIndex < 0) {
      const spatialBucket = polygonSpatialBucket(face.polygon_3d_mm);
      if (spatialBucket) {
        for (const bucketKey of neighboringPolygonBucketKeys(spatialBucket)) {
          sourceIndex = takeMatchingSourceIndex(
            sourceBySpatialBucket.get(bucketKey),
            sourceEntries,
            face.polygon_3d_mm,
          );
          if (sourceIndex >= 0) break;
        }
      }
    }
    if (sourceIndex < 0) return false;
  }
  return true;
}

function importedSourceFromCalculationOrMetadata(
  calculation: Record<string, unknown>,
  semanticObjectRefValue: unknown,
): Record<string, unknown> {
  const semanticObjectRef = asRecord(semanticObjectRefValue);
  const metadata = asRecord(semanticObjectRef.metadata ?? semanticObjectRef);
  const roofParameters = asRecord(metadata.roofParameters);
  const metadataRequest = asRecord(metadata.roofRequest);
  const normalizedRequest = asRecord(calculation.normalized_request);
  return asRecord(
    roofParameters.importedSource
      ?? roofParameters.imported_source
      ?? asRecord(metadataRequest.parameters).imported_source
      ?? asRecord(normalizedRequest.parameters).imported_source,
  );
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

  const importedSource = importedSourceFromCalculationOrMetadata(
    calculation,
    semanticObjectRefValue,
  );
  const calculatedFaces = asRecord(calculation.geometry).faces;

  return sameFaces(calculatedFaces, importedSource.faces);
}
