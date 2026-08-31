import type { RuntimeChunkContent } from "@runtime/world/chunk_content";


export interface ChunkMapRoofPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ChunkMapRoofFace {
  readonly faceRef: string;
  readonly points: readonly ChunkMapRoofPoint[];
}

export interface ChunkMapRoof {
  readonly objectInstanceId: string;
  readonly primaryChunkKey: string;
  readonly faces: readonly ChunkMapRoofFace[];
  readonly outlines: readonly (readonly ChunkMapRoofPoint[])[];
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly minimumY: number;
  readonly maximumY: number;
}

export interface ChunkMapCenteredOffset {
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface ChunkMapZoomCenter {
  readonly centerX: number;
  readonly centerZ: number;
}

const CSS_REFERENCE_PIXELS_PER_METER = 96 / 0.0254;

interface RoofCandidate {
  readonly chunk: RuntimeChunkContent;
  readonly ref: Record<string, unknown>;
  readonly primary: boolean;
}

const MAX_MAP_ROOFS = 4_096;
const MAX_MAP_ROOF_FACES = 16_384;
const MAX_MAP_ROOF_POINTS = 2_048;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clean(value: unknown, fallback = ""): string {
  try {
    const normalized = String(value ?? "").trim();
    return normalized || fallback;
  } catch {
    return fallback;
  }
}

function finite(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function samePoint(first: ChunkMapRoofPoint, second: ChunkMapRoofPoint): boolean {
  return Math.abs(first.x - second.x) < 1e-7
    && Math.abs(first.y - second.y) < 1e-7
    && Math.abs(first.z - second.z) < 1e-7;
}

function openRing(points: readonly ChunkMapRoofPoint[]): readonly ChunkMapRoofPoint[] {
  if (points.length > 1 && samePoint(points[0]!, points[points.length - 1]!)) {
    return points.slice(0, -1);
  }
  return points;
}

function roofRefs(chunk: RuntimeChunkContent): readonly Record<string, unknown>[] {
  const normalized = Array.isArray(chunk.raw.objectRefs) ? chunk.raw.objectRefs : [];
  const rawChunk = asRecord(chunk.raw.raw);
  const content = asRecord(rawChunk.content);
  const values = normalized.length > 0
    ? normalized
    : Array.isArray(rawChunk.objectRefs)
      ? rawChunk.objectRefs
      : Array.isArray(content.objectRefs)
        ? content.objectRefs
        : [];
  return values.map(asRecord).filter((ref) => clean(ref.objectTypeId) === "building_roof");
}

function roofFacePoint(value: unknown, scale: number): ChunkMapRoofPoint | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const x = finite(value[0]);
  const z = finite(value[1]);
  const y = finite(value[2]);
  if (x === null || y === null || z === null) return null;
  return {
    x: x / 1_000 * scale,
    y: y / 1_000 * scale,
    z: z / 1_000 * scale,
  };
}

function calculationFaces(ref: Record<string, unknown>, scale: number): readonly ChunkMapRoofFace[] {
  const metadata = asRecord(ref.metadata);
  const calculation = asRecord(metadata.roofCalculation);
  const buildUp = asRecord(calculation.roof_build_up);
  const geometry = asRecord(calculation.geometry);
  const topFaces = Array.isArray(buildUp.top_faces) && buildUp.top_faces.length > 0
    ? buildUp.top_faces
    : Array.isArray(geometry.faces)
      ? geometry.faces
      : [];
  const result: ChunkMapRoofFace[] = [];
  for (let index = 0; index < Math.min(topFaces.length, MAX_MAP_ROOF_FACES); index += 1) {
    const face = asRecord(topFaces[index]);
    const rawPoints = Array.isArray(face.polygon_3d_mm) ? face.polygon_3d_mm : [];
    const points = openRing(rawPoints
      .slice(0, MAX_MAP_ROOF_POINTS)
      .map((point) => roofFacePoint(point, scale))
      .filter((point): point is ChunkMapRoofPoint => point !== null));
    if (points.length < 3) continue;
    result.push({
      faceRef: clean(face.face_ref, String(index + 1)),
      points,
    });
  }
  return result;
}

function footprintRings(ref: Record<string, unknown>, scale: number): readonly (readonly ChunkMapRoofPoint[])[] {
  const footprint = asRecord(ref.footprint);
  const coordinates = Array.isArray(footprint.coordinates) ? footprint.coordinates : [];
  const polygons = clean(footprint.type, "Polygon") === "MultiPolygon"
    ? coordinates
    : [coordinates];
  const baseY = (finite(footprint.baseY) ?? 0) * scale;
  const height = Math.max(0, finite(footprint.height) ?? 0) * scale;
  const result: ChunkMapRoofPoint[][] = [];
  for (const polygonValue of polygons.slice(0, MAX_MAP_ROOFS)) {
    const polygon = Array.isArray(polygonValue) ? polygonValue : [];
    for (const ringValue of polygon.slice(0, 128)) {
      const ring = Array.isArray(ringValue) ? ringValue : [];
      const points = openRing(ring.slice(0, MAX_MAP_ROOF_POINTS).map((value): ChunkMapRoofPoint | null => {
        if (!Array.isArray(value) || value.length < 2) return null;
        const x = finite(value[0]);
        const z = finite(value[1]);
        if (x === null || z === null) return null;
        return { x: x * scale, y: baseY + height, z: z * scale };
      }).filter((point): point is ChunkMapRoofPoint => point !== null));
      if (points.length >= 3) result.push([...points]);
    }
  }
  return result;
}

function candidateRoof(candidate: RoofCandidate): ChunkMapRoof | null {
  const { chunk, ref } = candidate;
  const scale = Number.isFinite(chunk.cellSize) && chunk.cellSize > 0 ? chunk.cellSize : 1;
  const objectInstanceId = clean(ref.objectInstanceId, `roof:${chunk.chunkKey}`);
  const primaryChunkKey = clean(ref.primaryChunkKey, chunk.chunkKey);
  const outlines = footprintRings(ref, scale);
  const faces = calculationFaces(ref, scale);
  const points = [...faces.flatMap((face) => face.points), ...outlines.flat()];
  if (points.length < 3) return null;
  return {
    objectInstanceId,
    primaryChunkKey,
    faces,
    outlines,
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxZ: Math.max(...points.map((point) => point.z)),
    minimumY: Math.min(...points.map((point) => point.y)),
    maximumY: Math.max(...points.map((point) => point.y)),
  };
}

function previewPoint(value: unknown): ChunkMapRoofPoint | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const x = finite(value[0]);
  const y = finite(value[1]);
  const z = finite(value[2]);
  return x === null || y === null || z === null ? null : { x, y, z };
}

/** Validate the read-only map projection returned by vectoplan-chunk. */
export function parseChunkMapStructureRoofs(value: unknown): readonly ChunkMapRoof[] {
  const root = asRecord(value);
  if (clean(root.schemaVersion) !== "vectoplan-map-structures.v1") return [];
  const rawRoofs = Array.isArray(root.roofs) ? root.roofs : [];
  const roofs: ChunkMapRoof[] = [];
  for (const rawRoof of rawRoofs.slice(0, MAX_MAP_ROOFS)) {
    const roof = asRecord(rawRoof);
    const faces: ChunkMapRoofFace[] = [];
    const rawFaces = Array.isArray(roof.faces) ? roof.faces : [];
    for (let index = 0; index < Math.min(rawFaces.length, MAX_MAP_ROOF_FACES); index += 1) {
      const face = asRecord(rawFaces[index]);
      const points = openRing((Array.isArray(face.points) ? face.points : [])
        .slice(0, MAX_MAP_ROOF_POINTS)
        .map(previewPoint)
        .filter((point): point is ChunkMapRoofPoint => point !== null));
      if (points.length >= 3) {
        faces.push({ faceRef: clean(face.faceRef, String(index + 1)), points });
      }
    }
    const outlines = (Array.isArray(roof.outlines) ? roof.outlines : [])
      .slice(0, 128)
      .map((ring) => openRing((Array.isArray(ring) ? ring : [])
        .slice(0, MAX_MAP_ROOF_POINTS)
        .map(previewPoint)
        .filter((point): point is ChunkMapRoofPoint => point !== null)))
      .filter((ring) => ring.length >= 3);
    const points = [...faces.flatMap((face) => face.points), ...outlines.flat()];
    if (points.length < 3) continue;
    roofs.push({
      objectInstanceId: clean(roof.objectInstanceId, `map-roof:${roofs.length}`),
      primaryChunkKey: clean(roof.primaryChunkKey),
      faces,
      outlines,
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minZ: Math.min(...points.map((point) => point.z)),
      maxZ: Math.max(...points.map((point) => point.z)),
      minimumY: Math.min(...points.map((point) => point.y)),
      maximumY: Math.max(...points.map((point) => point.y)),
    });
  }
  return roofs;
}

export function mergeChunkMapRoofs(
  projected: readonly ChunkMapRoof[],
  loaded: readonly ChunkMapRoof[],
): readonly ChunkMapRoof[] {
  const roofs = new Map(projected.map((roof) => [roof.objectInstanceId, roof]));
  for (const roof of loaded) roofs.set(roof.objectInstanceId, roof);
  return [...roofs.values()];
}

export function chunkContainsMapRoof(chunk: RuntimeChunkContent): boolean {
  return roofRefs(chunk).length > 0;
}

export function collectChunkMapRoofs(chunks: readonly RuntimeChunkContent[]): readonly ChunkMapRoof[] {
  const candidates = new Map<string, RoofCandidate>();
  for (const chunk of chunks) {
    for (const ref of roofRefs(chunk)) {
      const objectInstanceId = clean(ref.objectInstanceId, `roof:${chunk.chunkKey}`);
      const primaryChunkKey = clean(ref.primaryChunkKey, chunk.chunkKey);
      const candidate: RoofCandidate = {
        chunk,
        ref,
        primary: primaryChunkKey === chunk.chunkKey,
      };
      const previous = candidates.get(objectInstanceId);
      if (!previous || (!previous.primary && candidate.primary)) candidates.set(objectInstanceId, candidate);
      if (candidates.size >= MAX_MAP_ROOFS) break;
    }
    if (candidates.size >= MAX_MAP_ROOFS) break;
  }
  return [...candidates.values()]
    .map(candidateRoof)
    .filter((roof): roof is ChunkMapRoof => roof !== null);
}

export function chunkMapRoofSignature(chunks: readonly RuntimeChunkContent[]): string {
  const values = new Map<string, string>();
  for (const chunk of chunks) {
    for (const ref of roofRefs(chunk)) {
      const id = clean(ref.objectInstanceId, `roof:${chunk.chunkKey}`);
      const calculation = asRecord(asRecord(ref.metadata).roofCalculation);
      const version = clean(
        calculation.input_fingerprint
          ?? calculation.calculation_id
          ?? chunk.chunkRevision
          ?? chunk.chunkVersion
          ?? chunk.loadedAt,
        "unknown",
      );
      if (!values.has(id) || clean(ref.primaryChunkKey, chunk.chunkKey) === chunk.chunkKey) {
        values.set(id, version);
      }
    }
  }
  return [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, version]) => `${id}:${version}`)
    .join("|");
}

export function centeredChunkMapOffset(
  centerX: number,
  centerZ: number,
  minX: number,
  minZ: number,
  scale: number,
  width: number,
  height: number,
  scaleZ = scale,
): ChunkMapCenteredOffset {
  return {
    offsetX: width * 0.5 - (centerX - minX) * scale,
    offsetY: height * 0.5 - (centerZ - minZ) * scaleZ,
  };
}

export function chunkMapScaleForDenominator(
  denominator: number,
  devicePixelRatio = 1,
): number {
  const normalizedDenominator = Number.isFinite(denominator) && denominator > 0
    ? denominator
    : 1_000;
  const normalizedPixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  return CSS_REFERENCE_PIXELS_PER_METER / normalizedDenominator * normalizedPixelRatio;
}

/** Physical metres represented by one periodic Earth-grid cell at latitude. */
export function chunkMapWorldMetric(
  worldWidthCells: number,
  worldHeightCells: number,
  latitudeDegrees: number,
): Readonly<{ x: number; z: number }> {
  const latitude = Math.max(-89.999999, Math.min(89.999999, latitudeDegrees)) * Math.PI / 180;
  const semiMajorAxis = 6_378_137;
  const eccentricitySquared = 6.6943799901413165e-3;
  const sine = Math.sin(latitude);
  const denominator = 1 - eccentricitySquared * sine * sine;
  const normalizedWidth = Number.isFinite(worldWidthCells) && worldWidthCells > 0
    ? worldWidthCells
    : 40_000_000;
  const normalizedHeight = Number.isFinite(worldHeightCells) && worldHeightCells > 0
    ? worldHeightCells
    : 20_000_000;
  return {
    x: 2 * Math.PI * semiMajorAxis * Math.cos(latitude)
      / Math.sqrt(denominator) / normalizedWidth,
    z: Math.PI * semiMajorAxis * (1 - eccentricitySquared)
      / denominator ** 1.5 / normalizedHeight,
  };
}

export function chunkMapCenterForZoomAnchor(
  anchorPixelX: number,
  anchorPixelY: number,
  anchorWorldX: number,
  anchorWorldZ: number,
  nextScale: number,
  canvasWidth: number,
  canvasHeight: number,
  nextScaleZ = nextScale,
): ChunkMapZoomCenter {
  const normalizedScale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1;
  const normalizedScaleZ = Number.isFinite(nextScaleZ) && nextScaleZ > 0 ? nextScaleZ : normalizedScale;
  return {
    centerX: anchorWorldX - (anchorPixelX - canvasWidth * 0.5) / normalizedScale,
    centerZ: anchorWorldZ - (anchorPixelY - canvasHeight * 0.5) / normalizedScaleZ,
  };
}
