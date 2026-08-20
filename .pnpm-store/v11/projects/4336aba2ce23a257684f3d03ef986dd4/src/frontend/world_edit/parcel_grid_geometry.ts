export type ParcelGridPoint = readonly [number, number];

export interface ParcelGridRenderBounds {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumZ: number;
  readonly maximumZ: number;
  readonly requestedCells: number;
  readonly renderedCells: number;
  readonly streamed: boolean;
}

export function resolveParcelGridRenderBounds(options: Readonly<{
  points: readonly ParcelGridPoint[];
  visibleSurfacePoints?: readonly ParcelGridPoint[];
  fullRenderCellLimit: number;
  visibleMarginCells: number;
}>): ParcelGridRenderBounds | null {
  if (options.points.length === 0) return null;
  let minimumX = Math.floor(Math.min(...options.points.map((point) => point[0])));
  let maximumX = Math.ceil(Math.max(...options.points.map((point) => point[0])));
  let minimumZ = Math.floor(Math.min(...options.points.map((point) => point[1])));
  let maximumZ = Math.ceil(Math.max(...options.points.map((point) => point[1])));
  const requestedCells = Math.max(0, maximumX - minimumX) * Math.max(0, maximumZ - minimumZ);
  let streamed = false;
  const visible = options.visibleSurfacePoints ?? [];
  if (requestedCells > options.fullRenderCellLimit && visible.length > 0) {
    const margin = Math.max(0, Math.floor(options.visibleMarginCells));
    minimumX = Math.max(minimumX, Math.floor(Math.min(...visible.map((point) => point[0]))) - margin);
    maximumX = Math.min(maximumX, Math.ceil(Math.max(...visible.map((point) => point[0]))) + margin);
    minimumZ = Math.max(minimumZ, Math.floor(Math.min(...visible.map((point) => point[1]))) - margin);
    maximumZ = Math.min(maximumZ, Math.ceil(Math.max(...visible.map((point) => point[1]))) + margin);
    streamed = true;
  }
  return {
    minimumX,
    maximumX,
    minimumZ,
    maximumZ,
    requestedCells,
    renderedCells: Math.max(0, maximumX - minimumX) * Math.max(0, maximumZ - minimumZ),
    streamed,
  };
}

export function snapParcelGridDragDepth(options: Readonly<{
  initialDepth: number;
  initialPointerDepth: number;
  pointerDepth: number;
  minimumDepth: number;
  maximumDepth: number;
}>): number {
  const minimum = Math.ceil(Math.min(options.minimumDepth, options.maximumDepth));
  const maximum = Math.floor(Math.max(options.minimumDepth, options.maximumDepth));
  const candidate = Math.round(
    options.initialDepth + options.pointerDepth - options.initialPointerDepth,
  );
  return Math.max(minimum, Math.min(maximum, candidate));
}

export function resolveParcelGridMaximumDepth(options: Readonly<{
  points: readonly ParcelGridPoint[];
  start: ParcelGridPoint;
  inward: ParcelGridPoint;
  minimumDepth?: number;
  maximumDepth?: number;
  paddingCells?: number;
}>): number {
  const minimum = Math.max(1, Math.floor(options.minimumDepth ?? 64));
  const maximum = Math.max(minimum, Math.floor(options.maximumDepth ?? 512));
  const padding = Math.max(0, Math.floor(options.paddingCells ?? 8));
  const inwardExtent = options.points.reduce((largest, point) => Math.max(
    largest,
    (point[0] - options.start[0]) * options.inward[0]
      + (point[1] - options.start[1]) * options.inward[1],
  ), 0);
  return Math.max(minimum, Math.min(maximum, Math.ceil(inwardExtent) + padding));
}

export interface ParcelGridGuidePreview {
  readonly lineStart: ParcelGridPoint;
  readonly lineEnd: ParcelGridPoint;
  readonly handle: ParcelGridPoint;
}

export function resolveParcelGridGuidePreview(options: Readonly<{
  start: ParcelGridPoint;
  end: ParcelGridPoint;
  inward: ParcelGridPoint;
  depth: number;
  handleAlong: number;
}>): ParcelGridGuidePreview {
  const along = Math.max(0, Math.min(1, options.handleAlong));
  const offsetX = options.inward[0] * options.depth;
  const offsetZ = options.inward[1] * options.depth;
  return {
    lineStart: [options.start[0] + offsetX, options.start[1] + offsetZ],
    lineEnd: [options.end[0] + offsetX, options.end[1] + offsetZ],
    handle: [
      options.start[0] + (options.end[0] - options.start[0]) * along + offsetX,
      options.start[1] + (options.end[1] - options.start[1]) * along + offsetZ,
    ],
  };
}

export function parcelGridGuideIdentity(
  parcelId: string,
  start: ParcelGridPoint,
  end: ParcelGridPoint,
  precision = 8,
): string {
  const digits = Math.max(0, Math.min(12, Math.floor(precision)));
  const endpoint = (point: ParcelGridPoint): string => (
    `${point[0].toFixed(digits)}:${point[1].toFixed(digits)}`
  );
  const endpoints = [endpoint(start), endpoint(end)].sort();
  return `${parcelId}:${endpoints[0]}|${endpoints[1]}`;
}

export function resolveParcelGridHandleScale(options: Readonly<{
  distance: number;
  verticalFieldOfViewDegrees: number;
  viewportHeightPixels: number;
  targetPixels?: number;
  minimumScale?: number;
  maximumScale?: number;
}>): number {
  const minimum = Math.max(0.01, options.minimumScale ?? 0.65);
  const maximum = Math.max(minimum, options.maximumScale ?? 14);
  const distance = Math.max(0, Number(options.distance) || 0);
  const viewportHeight = Math.max(1, Number(options.viewportHeightPixels) || 1);
  const fieldOfView = Math.max(1, Math.min(179, Number(options.verticalFieldOfViewDegrees) || 50));
  const targetPixels = Math.max(1, Number(options.targetPixels) || 36);
  const worldPerPixel = 2 * distance * Math.tan(fieldOfView * Math.PI / 360) / viewportHeight;
  return Math.max(minimum, Math.min(maximum, worldPerPixel * targetPixels));
}

export interface ParcelGridBoundarySegmentInput {
  readonly id: string;
  readonly parcelId: string;
  readonly start: ParcelGridPoint;
  readonly end: ParcelGridPoint;
  readonly inward: ParcelGridPoint;
  readonly length: number;
  readonly depth: number;
}

export interface ParcelGridPartitionCell {
  readonly parcelId: string;
  readonly zone: `slanted-${number}-${number}` | "straight" | "straight-clipped";
  readonly polygon: readonly ParcelGridPoint[];
  readonly sourceCell?: Readonly<{ x: number; z: number }>;
  readonly logicalCellId?: string;
  readonly boundarySegmentId?: string;
  readonly boundaryRow?: number;
  readonly boundaryColumn?: number;
  readonly wallAxisDegrees?: number;
}

export interface ParcelGridPartitionInput {
  readonly boundarySegments: readonly ParcelGridBoundarySegmentInput[];
  readonly coverageTriangles: readonly (readonly ParcelGridPoint[])[];
  readonly bounds: Readonly<{
    minimumX: number;
    maximumX: number;
    minimumZ: number;
    maximumZ: number;
  }>;
  readonly minimumArea?: number;
}

export interface ParcelGridPartitionResult {
  readonly cells: readonly ParcelGridPartitionCell[];
  readonly slantedCells: readonly ParcelGridPartitionCell[];
  readonly straightCells: readonly ParcelGridPartitionCell[];
  readonly blockedCells: readonly ParcelGridPartitionCell[];
  readonly coveredArea: number;
  readonly slantedArea: number;
  readonly straightArea: number;
  readonly blockedArea: number;
}

const GEOMETRY_EPSILON = 1e-8;

export function parcelGridPolygonSignedArea(points: readonly ParcelGridPoint[]): number {
  if (points.length < 3) return 0;
  let doubledArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    doubledArea += current[0] * next[1] - next[0] * current[1];
  }
  return doubledArea * 0.5;
}

export function parcelGridPolygonArea(points: readonly ParcelGridPoint[]): number {
  return Math.abs(parcelGridPolygonSignedArea(points));
}

export function normalizeParcelGridPolygon(
  points: readonly ParcelGridPoint[],
): readonly ParcelGridPoint[] {
  const result: ParcelGridPoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const previous = result[result.length - 1];
    if (previous && Math.hypot(point[0] - previous[0], point[1] - previous[1]) <= GEOMETRY_EPSILON) continue;
    result.push([point[0], point[1]]);
  }
  if (result.length > 1) {
    const first = result[0]!;
    const last = result[result.length - 1]!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= GEOMETRY_EPSILON) result.pop();
  }
  if (result.length < 3) return [];

  let changed = true;
  while (changed && result.length >= 3) {
    changed = false;
    for (let index = 0; index < result.length; index += 1) {
      const previous = result[(index + result.length - 1) % result.length]!;
      const current = result[index]!;
      const next = result[(index + 1) % result.length]!;
      const cross = (current[0] - previous[0]) * (next[1] - current[1])
        - (current[1] - previous[1]) * (next[0] - current[0]);
      if (Math.abs(cross) > GEOMETRY_EPSILON) continue;
      result.splice(index, 1);
      changed = true;
      break;
    }
  }
  return result.length >= 3 ? result : [];
}

function crossToEdge(
  edgeStart: ParcelGridPoint,
  edgeEnd: ParcelGridPoint,
  point: ParcelGridPoint,
): number {
  return (edgeEnd[0] - edgeStart[0]) * (point[1] - edgeStart[1])
    - (edgeEnd[1] - edgeStart[1]) * (point[0] - edgeStart[0]);
}

function clipToHalfPlane(
  polygon: readonly ParcelGridPoint[],
  edgeStart: ParcelGridPoint,
  edgeEnd: ParcelGridPoint,
  orientation: 1 | -1,
  keepInside: boolean,
): readonly ParcelGridPoint[] {
  if (polygon.length < 3) return [];
  const result: ParcelGridPoint[] = [];
  const signedDistance = (point: ParcelGridPoint): number => (
    crossToEdge(edgeStart, edgeEnd, point) * orientation
  );
  const accepted = (distance: number): boolean => keepInside
    ? distance >= -GEOMETRY_EPSILON
    : distance <= GEOMETRY_EPSILON;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const currentDistance = signedDistance(current);
    const nextDistance = signedDistance(next);
    const currentInside = accepted(currentDistance);
    const nextInside = accepted(nextDistance);

    if (currentInside) result.push(current);
    if (currentInside === nextInside) continue;
    const denominator = currentDistance - nextDistance;
    if (Math.abs(denominator) <= GEOMETRY_EPSILON) continue;
    const factor = Math.max(0, Math.min(1, currentDistance / denominator));
    result.push([
      current[0] + (next[0] - current[0]) * factor,
      current[1] + (next[1] - current[1]) * factor,
    ]);
  }
  return normalizeParcelGridPolygon(result);
}

export function intersectConvexParcelGridPolygons(
  subjectValue: readonly ParcelGridPoint[],
  clipValue: readonly ParcelGridPoint[],
): readonly ParcelGridPoint[] {
  let subject = normalizeParcelGridPolygon(subjectValue);
  const clip = normalizeParcelGridPolygon(clipValue);
  if (subject.length < 3 || clip.length < 3) return [];
  const orientation: 1 | -1 = parcelGridPolygonSignedArea(clip) >= 0 ? 1 : -1;
  for (let index = 0; index < clip.length; index += 1) {
    subject = clipToHalfPlane(
      subject,
      clip[index]!,
      clip[(index + 1) % clip.length]!,
      orientation,
      true,
    );
    if (subject.length < 3) return [];
  }
  return subject;
}

export function subtractConvexParcelGridPolygon(
  subjectValue: readonly ParcelGridPoint[],
  cutterValue: readonly ParcelGridPoint[],
): readonly (readonly ParcelGridPoint[])[] {
  const subject = normalizeParcelGridPolygon(subjectValue);
  const cutter = normalizeParcelGridPolygon(cutterValue);
  if (subject.length < 3) return [];
  if (cutter.length < 3 || intersectConvexParcelGridPolygons(subject, cutter).length < 3) return [subject];
  const orientation: 1 | -1 = parcelGridPolygonSignedArea(cutter) >= 0 ? 1 : -1;
  let remainingInside: readonly (readonly ParcelGridPoint[])[] = [subject];
  const outside: Array<readonly ParcelGridPoint[]> = [];

  for (let edgeIndex = 0; edgeIndex < cutter.length; edgeIndex += 1) {
    const nextInside: Array<readonly ParcelGridPoint[]> = [];
    const edgeStart = cutter[edgeIndex]!;
    const edgeEnd = cutter[(edgeIndex + 1) % cutter.length]!;
    for (const polygon of remainingInside) {
      const insidePiece = clipToHalfPlane(polygon, edgeStart, edgeEnd, orientation, true);
      const outsidePiece = clipToHalfPlane(polygon, edgeStart, edgeEnd, orientation, false);
      if (parcelGridPolygonArea(outsidePiece) > GEOMETRY_EPSILON) outside.push(outsidePiece);
      if (parcelGridPolygonArea(insidePiece) > GEOMETRY_EPSILON) nextInside.push(insidePiece);
    }
    remainingInside = nextInside;
    if (remainingInside.length === 0) break;
  }
  return outside;
}

export function parcelGridConvexHull(
  points: readonly ParcelGridPoint[],
): readonly ParcelGridPoint[] {
  const unique = [...new Map(points.map((point) => [
    `${point[0].toFixed(8)}:${point[1].toFixed(8)}`,
    point,
  ])).values()].sort((first, second) => first[0] - second[0] || first[1] - second[1]);
  if (unique.length <= 3) return normalizeParcelGridPolygon(unique);
  const cross = (origin: ParcelGridPoint, first: ParcelGridPoint, second: ParcelGridPoint): number => (
    (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0])
  );
  const lower: ParcelGridPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= GEOMETRY_EPSILON) lower.pop();
    lower.push(point);
  }
  const upper: ParcelGridPoint[] = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= GEOMETRY_EPSILON) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return normalizeParcelGridPolygon([...lower, ...upper]);
}

function polygonsBounds(points: readonly ParcelGridPoint[]): Readonly<{
  minimumX: number;
  maximumX: number;
  minimumZ: number;
  maximumZ: number;
}> {
  return {
    minimumX: Math.min(...points.map((point) => point[0])),
    maximumX: Math.max(...points.map((point) => point[0])),
    minimumZ: Math.min(...points.map((point) => point[1])),
    maximumZ: Math.max(...points.map((point) => point[1])),
  };
}

function boundsOverlap(
  first: ReturnType<typeof polygonsBounds>,
  second: ReturnType<typeof polygonsBounds>,
): boolean {
  return first.minimumX <= second.maximumX + GEOMETRY_EPSILON
    && first.maximumX + GEOMETRY_EPSILON >= second.minimumX
    && first.minimumZ <= second.maximumZ + GEOMETRY_EPSILON
    && first.maximumZ + GEOMETRY_EPSILON >= second.minimumZ;
}

export function mergeConvexParcelGridCoverage(
  input: readonly (readonly ParcelGridPoint[])[],
): readonly (readonly ParcelGridPoint[])[] {
  const result = input
    .map(normalizeParcelGridPolygon)
    .filter((polygon) => parcelGridPolygonArea(polygon) > GEOMETRY_EPSILON)
    .map((polygon) => [...polygon] as readonly ParcelGridPoint[]);
  let merged = true;
  while (merged) {
    merged = false;
    for (let firstIndex = 0; firstIndex < result.length && !merged; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < result.length; secondIndex += 1) {
        const first = result[firstIndex]!;
        const second = result[secondIndex]!;
        if (!boundsOverlap(polygonsBounds(first), polygonsBounds(second))) continue;
        const hull = parcelGridConvexHull([...first, ...second]);
        const partsArea = parcelGridPolygonArea(first) + parcelGridPolygonArea(second);
        const tolerance = Math.max(1e-7, partsArea * 1e-6);
        if (parcelGridPolygonArea(hull) > partsArea + tolerance) continue;
        result[firstIndex] = hull;
        result.splice(secondIndex, 1);
        merged = true;
        break;
      }
    }
  }
  return result;
}

interface ParcelGridBoundaryEdge {
  readonly start: ParcelGridPoint;
  readonly end: ParcelGridPoint;
  readonly startKey: string;
  readonly endKey: string;
}

function parcelGridPointKey(point: ParcelGridPoint): string {
  return `${point[0].toFixed(7)}:${point[1].toFixed(7)}`;
}

function pointParameterOnSegment(
  point: ParcelGridPoint,
  start: ParcelGridPoint,
  end: ParcelGridPoint,
): number | null {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) return null;
  const factor = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared;
  if (factor <= GEOMETRY_EPSILON || factor >= 1 - GEOMETRY_EPSILON) return null;
  const projectedX = start[0] + dx * factor;
  const projectedZ = start[1] + dz * factor;
  return Math.hypot(point[0] - projectedX, point[1] - projectedZ) <= 1e-7
    ? factor
    : null;
}

/**
 * Reassemble a non-overlapping clipped coverage into its exact connected
 * outlines. Unlike a convex hull, this preserves recesses. Every edge is
 * first split at neighbouring fragment vertices, then shared internal edges
 * cancel pairwise. The remaining directed edges are the real union boundary.
 */
export function mergeParcelGridCoverage(
  input: readonly (readonly ParcelGridPoint[])[],
): readonly (readonly ParcelGridPoint[])[] {
  const polygons = input
    .map(normalizeParcelGridPolygon)
    .filter((polygon) => parcelGridPolygonArea(polygon) > GEOMETRY_EPSILON)
    .map((polygon) => (
      parcelGridPolygonSignedArea(polygon) >= 0 ? polygon : [...polygon].reverse()
    ));
  if (polygons.length <= 1) return polygons;

  const vertices = [...new Map(polygons.flat().map((point) => [parcelGridPointKey(point), point])).values()];
  const edgeBuckets = new Map<string, ParcelGridBoundaryEdge[]>();
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]!;
      const end = polygon[(index + 1) % polygon.length]!;
      const factors = [0, 1];
      for (const vertex of vertices) {
        const factor = pointParameterOnSegment(vertex, start, end);
        if (factor !== null) factors.push(factor);
      }
      factors.sort((first, second) => first - second);
      for (let factorIndex = 1; factorIndex < factors.length; factorIndex += 1) {
        const first = factors[factorIndex - 1]!;
        const second = factors[factorIndex]!;
        if (second - first <= GEOMETRY_EPSILON) continue;
        const subStart: ParcelGridPoint = [
          start[0] + (end[0] - start[0]) * first,
          start[1] + (end[1] - start[1]) * first,
        ];
        const subEnd: ParcelGridPoint = [
          start[0] + (end[0] - start[0]) * second,
          start[1] + (end[1] - start[1]) * second,
        ];
        const startKey = parcelGridPointKey(subStart);
        const endKey = parcelGridPointKey(subEnd);
        if (startKey === endKey) continue;
        const bucketKey = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
        const bucket = edgeBuckets.get(bucketKey) ?? [];
        bucket.push({ start: subStart, end: subEnd, startKey, endKey });
        edgeBuckets.set(bucketKey, bucket);
      }
    }
  }

  const boundaryEdges: ParcelGridBoundaryEdge[] = [];
  for (const bucket of edgeBuckets.values()) {
    // Valid partition fragments meet along two oppositely directed copies.
    // An odd remainder is therefore an exterior edge of the exact union.
    if (bucket.length % 2 === 1) boundaryEdges.push(bucket[0]!);
  }
  if (boundaryEdges.length === 0) return [];

  const outgoing = new Map<string, number[]>();
  boundaryEdges.forEach((edge, index) => {
    const entries = outgoing.get(edge.startKey) ?? [];
    entries.push(index);
    outgoing.set(edge.startKey, entries);
  });
  const unused = new Set(boundaryEdges.map((_, index) => index));
  const rings: Array<readonly ParcelGridPoint[]> = [];
  while (unused.size > 0) {
    const firstIndex = unused.values().next().value as number;
    const firstEdge = boundaryEdges[firstIndex]!;
    const ring: ParcelGridPoint[] = [firstEdge.start];
    let edgeIndex = firstIndex;
    let closed = false;
    for (let guard = 0; guard <= boundaryEdges.length; guard += 1) {
      if (!unused.delete(edgeIndex)) break;
      const edge = boundaryEdges[edgeIndex]!;
      ring.push(edge.end);
      if (edge.endKey === firstEdge.startKey) {
        closed = true;
        break;
      }
      const next = (outgoing.get(edge.endKey) ?? []).find((candidate) => unused.has(candidate));
      if (next === undefined) break;
      edgeIndex = next;
    }
    if (!closed) continue;
    const normalized = normalizeParcelGridPolygon(ring);
    if (parcelGridPolygonArea(normalized) > GEOMETRY_EPSILON) rings.push(normalized);
  }

  const inputArea = polygons.reduce((sum, polygon) => sum + parcelGridPolygonArea(polygon), 0);
  const outputArea = rings.reduce((sum, polygon) => sum + parcelGridPolygonArea(polygon), 0);
  const tolerance = Math.max(1e-6, inputArea * 1e-6);
  return Math.abs(inputArea - outputArea) <= tolerance
    ? rings
    : mergeConvexParcelGridCoverage(polygons);
}

function subtractCoverage(
  subjects: readonly (readonly ParcelGridPoint[])[],
  cutters: readonly (readonly ParcelGridPoint[])[],
  minimumArea: number,
): readonly (readonly ParcelGridPoint[])[] {
  let result = [...subjects];
  for (const cutter of cutters) {
    const cutterBounds = polygonsBounds(cutter);
    result = result.flatMap((subject) => (
      boundsOverlap(polygonsBounds(subject), cutterBounds)
        ? subtractConvexParcelGridPolygon(subject, cutter)
        : [subject]
    )).filter((polygon) => parcelGridPolygonArea(polygon) >= minimumArea);
    if (result.length === 0) break;
  }
  return mergeConvexParcelGridCoverage(result);
}

function clipConvexPolygonToCoverage(
  subject: readonly ParcelGridPoint[],
  coverageTriangles: readonly (readonly ParcelGridPoint[])[],
  minimumArea: number,
): readonly (readonly ParcelGridPoint[])[] {
  const subjectBounds = polygonsBounds(subject);
  const result: Array<readonly ParcelGridPoint[]> = [];
  for (const triangle of coverageTriangles) {
    if (triangle.length < 3 || !boundsOverlap(subjectBounds, polygonsBounds(triangle))) continue;
    const intersection = intersectConvexParcelGridPolygons(subject, triangle);
    if (parcelGridPolygonArea(intersection) < minimumArea) continue;
    const uniquePieces = subtractCoverage([intersection], result, minimumArea);
    result.push(...uniquePieces);
  }
  return mergeConvexParcelGridCoverage(result);
}

function cellIndexKeys(polygon: readonly ParcelGridPoint[]): readonly string[] {
  const bounds = polygonsBounds(polygon);
  const minimumX = Math.floor(bounds.minimumX + GEOMETRY_EPSILON);
  const maximumX = Math.ceil(bounds.maximumX - GEOMETRY_EPSILON);
  const minimumZ = Math.floor(bounds.minimumZ + GEOMETRY_EPSILON);
  const maximumZ = Math.ceil(bounds.maximumZ - GEOMETRY_EPSILON);
  const keys: string[] = [];
  for (let x = minimumX; x < maximumX; x += 1) {
    for (let z = minimumZ; z < maximumZ; z += 1) keys.push(`${x}:${z}`);
  }
  return keys;
}

function addToCellIndex(
  index: Map<string, Array<readonly ParcelGridPoint[]>>,
  polygon: readonly ParcelGridPoint[],
): void {
  for (const key of cellIndexKeys(polygon)) {
    const entries = index.get(key) ?? [];
    entries.push(polygon);
    index.set(key, entries);
  }
}

function relevantIndexedPolygons(
  index: ReadonlyMap<string, readonly (readonly ParcelGridPoint[])[]>,
  polygon: readonly ParcelGridPoint[],
): readonly (readonly ParcelGridPoint[])[] {
  const result = new Set<readonly ParcelGridPoint[]>();
  for (const key of cellIndexKeys(polygon)) {
    for (const candidate of index.get(key) ?? []) result.add(candidate);
  }
  return [...result];
}

function polygonCentroid(points: readonly ParcelGridPoint[]): ParcelGridPoint {
  const signedArea = parcelGridPolygonSignedArea(points);
  if (Math.abs(signedArea) <= GEOMETRY_EPSILON) {
    return [
      points.reduce((sum, point) => sum + point[0], 0) / Math.max(1, points.length),
      points.reduce((sum, point) => sum + point[1], 0) / Math.max(1, points.length),
    ];
  }
  let x = 0;
  let z = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const cross = current[0] * next[1] - next[0] * current[1];
    x += (current[0] + next[0]) * cross;
    z += (current[1] + next[1]) * cross;
  }
  return [x / (6 * signedArea), z / (6 * signedArea)];
}

function pointToSegmentDistance(
  point: ParcelGridPoint,
  start: ParcelGridPoint,
  end: ParcelGridPoint,
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const factor = lengthSquared <= GEOMETRY_EPSILON
    ? 0
    : Math.max(0, Math.min(1,
        ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared,
      ));
  return Math.hypot(
    point[0] - (start[0] + dx * factor),
    point[1] - (start[1] + dz * factor),
  );
}

function polygonsDistance(
  first: readonly ParcelGridPoint[],
  second: readonly ParcelGridPoint[],
): number {
  if (intersectConvexParcelGridPolygons(first, second).length >= 3) return 0;
  let minimum = Number.POSITIVE_INFINITY;
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstStart = first[firstIndex]!;
    const firstEnd = first[(firstIndex + 1) % first.length]!;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondStart = second[secondIndex]!;
      const secondEnd = second[(secondIndex + 1) % second.length]!;
      minimum = Math.min(
        minimum,
        pointToSegmentDistance(firstStart, secondStart, secondEnd),
        pointToSegmentDistance(firstEnd, secondStart, secondEnd),
        pointToSegmentDistance(secondStart, firstStart, firstEnd),
        pointToSegmentDistance(secondEnd, firstStart, firstEnd),
      );
    }
  }
  return minimum;
}

function clipToLinearHalfPlane(
  polygonValue: readonly ParcelGridPoint[],
  normalX: number,
  normalZ: number,
  maximum: number,
): readonly ParcelGridPoint[] {
  const polygon = normalizeParcelGridPolygon(polygonValue);
  if (polygon.length < 3) return [];
  const result: ParcelGridPoint[] = [];
  const distance = (point: ParcelGridPoint): number => (
    normalX * point[0] + normalZ * point[1] - maximum
  );
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const currentDistance = distance(current);
    const nextDistance = distance(next);
    const currentInside = currentDistance <= GEOMETRY_EPSILON;
    const nextInside = nextDistance <= GEOMETRY_EPSILON;
    if (currentInside) result.push(current);
    if (currentInside === nextInside) continue;
    const denominator = currentDistance - nextDistance;
    if (Math.abs(denominator) <= GEOMETRY_EPSILON) continue;
    const factor = Math.max(0, Math.min(1, currentDistance / denominator));
    result.push([
      current[0] + (next[0] - current[0]) * factor,
      current[1] + (next[1] - current[1]) * factor,
    ]);
  }
  return normalizeParcelGridPolygon(result);
}

interface TransitionOwner {
  readonly logicalCellId: string;
  readonly template: ParcelGridPartitionCell;
  readonly site: ParcelGridPoint;
  readonly innerBoundary: Readonly<{
    normalX: number;
    normalZ: number;
    maximum: number;
  }> | null;
}

/**
 * Assign one cut transition fragment to the touching slanted logical cells.
 * With two neighbours the perpendicular bisector creates the requested 50/50
 * seam. More neighbours use the same deterministic nearest-cell (Voronoi)
 * rule, so corners remain complete and non-overlapping as well.
 */
function splitTransitionAmongOwners(
  polygon: readonly ParcelGridPoint[],
  ownersValue: readonly TransitionOwner[],
  minimumArea: number,
): readonly ParcelGridPartitionCell[] {
  const owners = [...new Map(ownersValue.map((owner) => [owner.logicalCellId, owner])).values()]
    .sort((first, second) => first.logicalCellId.localeCompare(second.logicalCellId));
  if (owners.length === 0) return [];
  if (owners.length === 1) {
    const owner = owners[0]!;
    if (!owner.innerBoundary) return [];
    // Split exactly at the movable inner line: the part still inside the
    // slanted band belongs to its neighbour, the caller keeps the part beyond
    // that line as the intentional blue non-buildable transition cell.
    const buildablePiece = clipToLinearHalfPlane(
      polygon,
      owner.innerBoundary.normalX,
      owner.innerBoundary.normalZ,
      owner.innerBoundary.maximum,
    );
    return parcelGridPolygonArea(buildablePiece) >= minimumArea
      ? [{ ...owner.template, polygon: buildablePiece, logicalCellId: owner.logicalCellId }]
      : [];
  }

  const assigned: ParcelGridPartitionCell[] = [];
  for (const owner of owners) {
    let piece = polygon;
    for (const other of owners) {
      if (other === owner || piece.length < 3) continue;
      const normalX = 2 * (other.site[0] - owner.site[0]);
      const normalZ = 2 * (other.site[1] - owner.site[1]);
      if (Math.hypot(normalX, normalZ) <= GEOMETRY_EPSILON) {
        if (owner.logicalCellId > other.logicalCellId) piece = [];
        continue;
      }
      const maximum = other.site[0] * other.site[0] + other.site[1] * other.site[1]
        - owner.site[0] * owner.site[0] - owner.site[1] * owner.site[1];
      piece = clipToLinearHalfPlane(piece, normalX, normalZ, maximum);
    }
    if (parcelGridPolygonArea(piece) < minimumArea) continue;
    assigned.push({
      ...owner.template,
      polygon: piece,
      logicalCellId: owner.logicalCellId,
    });
  }

  // Numerical clipping can leave sub-millimetre slivers. Hand those to the
  // nearest owner too, preserving the exact parcel partition instead of
  // reintroducing a forbidden remainder.
  const remainder = subtractCoverage(
    [polygon],
    assigned.map((cell) => cell.polygon),
    Math.max(GEOMETRY_EPSILON, minimumArea * 0.01),
  );
  for (const leftover of remainder) {
    if (parcelGridPolygonArea(leftover) <= GEOMETRY_EPSILON) continue;
    const centre = polygonCentroid(leftover);
    const owner = [...owners].sort((first, second) => (
      Math.hypot(centre[0] - first.site[0], centre[1] - first.site[1])
      - Math.hypot(centre[0] - second.site[0], centre[1] - second.site[1])
    ) || first.logicalCellId.localeCompare(second.logicalCellId))[0]!;
    assigned.push({ ...owner.template, polygon: leftover, logicalCellId: owner.logicalCellId });
  }
  return assigned;
}

function boundaryColumnRange(
  segment: ParcelGridBoundarySegmentInput,
  divisions: number,
  bounds: ParcelGridPartitionInput["bounds"],
): readonly [number, number] | null {
  const tangentX = (segment.end[0] - segment.start[0]) / segment.length;
  const tangentZ = (segment.end[1] - segment.start[1]) / segment.length;
  let minimumAlong = 0;
  let maximumAlong = segment.length;
  const constrainAxis = (
    origin: number,
    direction: number,
    inward: number,
    minimumBound: number,
    maximumBound: number,
  ): boolean => {
    const depthOffset = inward * segment.depth;
    const minimumOffset = Math.min(0, depthOffset);
    const maximumOffset = Math.max(0, depthOffset);
    const minimumOrigin = minimumBound - maximumOffset;
    const maximumOrigin = maximumBound - minimumOffset;
    if (Math.abs(direction) <= GEOMETRY_EPSILON) {
      return origin >= minimumOrigin - GEOMETRY_EPSILON
        && origin <= maximumOrigin + GEOMETRY_EPSILON;
    }
    const first = (minimumOrigin - origin) / direction;
    const second = (maximumOrigin - origin) / direction;
    minimumAlong = Math.max(minimumAlong, Math.min(first, second));
    maximumAlong = Math.min(maximumAlong, Math.max(first, second));
    return maximumAlong >= minimumAlong - GEOMETRY_EPSILON;
  };
  if (!constrainAxis(
    segment.start[0],
    tangentX,
    segment.inward[0],
    bounds.minimumX,
    bounds.maximumX,
  ) || !constrainAxis(
    segment.start[1],
    tangentZ,
    segment.inward[1],
    bounds.minimumZ,
    bounds.maximumZ,
  )) return null;

  const columnWidth = segment.length / divisions;
  const firstColumn = Math.max(0, Math.floor((minimumAlong + GEOMETRY_EPSILON) / columnWidth));
  const endColumn = Math.min(divisions, Math.ceil((maximumAlong - GEOMETRY_EPSILON) / columnWidth));
  return endColumn > firstColumn ? [firstColumn, endColumn] : null;
}

function boundaryRowRange(
  segment: ParcelGridBoundarySegmentInput,
  bounds: ParcelGridPartitionInput["bounds"],
): readonly [number, number] | null {
  const corners: readonly ParcelGridPoint[] = [
    [bounds.minimumX, bounds.minimumZ],
    [bounds.maximumX, bounds.minimumZ],
    [bounds.maximumX, bounds.maximumZ],
    [bounds.minimumX, bounds.maximumZ],
  ];
  const depths = corners.map((point) => (
    (point[0] - segment.start[0]) * segment.inward[0]
    + (point[1] - segment.start[1]) * segment.inward[1]
  ));
  const firstRow = Math.max(0, Math.floor(Math.min(...depths) + GEOMETRY_EPSILON));
  const endRow = Math.min(Math.ceil(segment.depth), Math.ceil(Math.max(...depths) - GEOMETRY_EPSILON));
  return endRow > firstRow ? [firstRow, endRow] : null;
}

export function buildParcelGridPartition(input: ParcelGridPartitionInput): ParcelGridPartitionResult {
  const minimumArea = Math.max(1e-8, input.minimumArea ?? 0.0005);
  const coverageTriangles = input.coverageTriangles
    .map(normalizeParcelGridPolygon)
    .filter((triangle) => parcelGridPolygonArea(triangle) >= minimumArea);
  const slantedCells: ParcelGridPartitionCell[] = [];
  const straightCells: ParcelGridPartitionCell[] = [];
  const blockedCells: ParcelGridPartitionCell[] = [];
  const acceptedSlantedIndex = new Map<string, Array<readonly ParcelGridPoint[]>>();
  const slantedCellByPolygon = new Map<readonly ParcelGridPoint[], ParcelGridPartitionCell>();
  const boundarySegmentById = new Map(input.boundarySegments.map((segment) => [segment.id, segment]));

  for (const segment of input.boundarySegments) {
    if (segment.length <= GEOMETRY_EPSILON || segment.depth <= 0) continue;
    const tangentX = (segment.end[0] - segment.start[0]) / segment.length;
    const tangentZ = (segment.end[1] - segment.start[1]) / segment.length;
    const divisions = Math.max(1, Math.ceil(segment.length));
    const columnWidth = segment.length / divisions;
    const columnRange = boundaryColumnRange(segment, divisions, input.bounds);
    const rowRange = boundaryRowRange(segment, input.bounds);
    if (!columnRange || !rowRange) continue;
    const wallAxisDegrees = ((Math.atan2(tangentZ, tangentX) * 180 / Math.PI) + 180) % 180;
    const at = (along: number, depth: number): ParcelGridPoint => [
      segment.start[0] + tangentX * along + segment.inward[0] * depth,
      segment.start[1] + tangentZ * along + segment.inward[1] * depth,
    ];

    for (let row = rowRange[0]; row < rowRange[1]; row += 1) {
      for (let column = columnRange[0]; column < columnRange[1]; column += 1) {
        const alongStart = column * columnWidth;
        const alongEnd = Math.min(segment.length, (column + 1) * columnWidth);
        const candidate: readonly ParcelGridPoint[] = [
          at(alongStart, row),
          at(alongEnd, row),
          at(alongEnd, row + 1),
          at(alongStart, row + 1),
        ];
        const clippedToParcel = clipConvexPolygonToCoverage(candidate, coverageTriangles, minimumArea);
        const priorCoverage = relevantIndexedPolygons(acceptedSlantedIndex, candidate);
        const accepted = subtractCoverage(clippedToParcel, priorCoverage, minimumArea);
        const logicalCellId = `${segment.id}:${row}:${column}`;
        for (const polygon of accepted) {
          const cell: ParcelGridPartitionCell = {
            parcelId: segment.parcelId,
            zone: `slanted-${row}-${row + 1}`,
            polygon,
            logicalCellId,
            boundarySegmentId: segment.id,
            boundaryRow: row,
            boundaryColumn: column,
            wallAxisDegrees,
          };
          slantedCells.push(cell);
          slantedCellByPolygon.set(polygon, cell);
          addToCellIndex(acceptedSlantedIndex, polygon);
        }
      }
    }
  }

  for (let x = Math.floor(input.bounds.minimumX); x < Math.ceil(input.bounds.maximumX); x += 1) {
    for (let z = Math.floor(input.bounds.minimumZ); z < Math.ceil(input.bounds.maximumZ); z += 1) {
      const sourceCell = { x, z };
      const square: readonly ParcelGridPoint[] = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]];
      const parcelCoverage = clipConvexPolygonToCoverage(square, coverageTriangles, minimumArea);
      if (parcelCoverage.length === 0) continue;
      const parcelArea = parcelCoverage.reduce((sum, polygon) => sum + parcelGridPolygonArea(polygon), 0);
      const slantedCutters = relevantIndexedPolygons(acceptedSlantedIndex, square);
      const remaining = subtractCoverage(parcelCoverage, slantedCutters, minimumArea);
      const remainingArea = remaining.reduce((sum, polygon) => sum + parcelGridPolygonArea(polygon), 0);
      if (remainingArea < minimumArea) continue;
      const fullyStraight = parcelArea >= 1 - 1e-6 && (parcelArea - remainingArea) <= 1e-6;
      if (fullyStraight) {
        straightCells.push({
          parcelId: "selected-union",
          zone: "straight",
          polygon: square,
          sourceCell,
        });
        continue;
      }
      for (const polygon of remaining) {
        const touchingByLogicalCell = new Map<string, ParcelGridPartitionCell[]>();
        for (const cutter of slantedCutters) {
          const cell = slantedCellByPolygon.get(cutter);
          if (!cell?.logicalCellId || polygonsDistance(polygon, cutter) > 2e-5) continue;
          const entries = touchingByLogicalCell.get(cell.logicalCellId) ?? [];
          entries.push(cell);
          touchingByLogicalCell.set(cell.logicalCellId, entries);
        }
        const owners: TransitionOwner[] = [...touchingByLogicalCell.entries()].map(([logicalCellId, cells]) => {
          const weightedArea = cells.reduce((sum, cell) => sum + parcelGridPolygonArea(cell.polygon), 0);
          const site: ParcelGridPoint = weightedArea > GEOMETRY_EPSILON
            ? [
                cells.reduce((sum, cell) => sum + polygonCentroid(cell.polygon)[0] * parcelGridPolygonArea(cell.polygon), 0) / weightedArea,
                cells.reduce((sum, cell) => sum + polygonCentroid(cell.polygon)[1] * parcelGridPolygonArea(cell.polygon), 0) / weightedArea,
              ]
            : polygonCentroid(cells[0]!.polygon);
          const template = cells[0]!;
          const boundary = template.boundarySegmentId
            ? boundarySegmentById.get(template.boundarySegmentId)
            : null;
          return {
            logicalCellId,
            template,
            site,
            innerBoundary: boundary ? {
              normalX: boundary.inward[0],
              normalZ: boundary.inward[1],
              maximum: boundary.inward[0] * boundary.start[0]
                + boundary.inward[1] * boundary.start[1]
                + boundary.depth,
            } : null,
          };
        });
        const assigned = splitTransitionAmongOwners(polygon, owners, minimumArea);
        for (const cell of assigned) {
          slantedCells.push(cell);
          slantedCellByPolygon.set(cell.polygon, cell);
          addToCellIndex(acceptedSlantedIndex, cell.polygon);
        }
        const singleInnerBoundary = owners.length === 1 ? owners[0]!.innerBoundary : null;
        const unassigned = singleInnerBoundary
          ? [clipToLinearHalfPlane(
              polygon,
              -singleInnerBoundary.normalX,
              -singleInnerBoundary.normalZ,
              -singleInnerBoundary.maximum,
            )].filter((piece) => parcelGridPolygonArea(piece) >= minimumArea)
          : owners.length === 0
            ? [polygon]
            : [];
        for (const leftover of unassigned) {
          // This is the deliberate blue transition area beyond the movable
          // inner line (or a fail-closed malformed boundary remainder).
          blockedCells.push({
            parcelId: "selected-union",
            zone: "straight-clipped",
            polygon: leftover,
            sourceCell,
          });
        }
      }
    }
  }

  const sumArea = (cells: readonly ParcelGridPartitionCell[]): number => cells.reduce(
    (sum, cell) => sum + parcelGridPolygonArea(cell.polygon),
    0,
  );
  const slantedArea = sumArea(slantedCells);
  const straightArea = sumArea(straightCells);
  const blockedArea = sumArea(blockedCells);
  return {
    cells: [...slantedCells, ...straightCells, ...blockedCells],
    slantedCells,
    straightCells,
    blockedCells,
    coveredArea: slantedArea + straightArea + blockedArea,
    slantedArea,
    straightArea,
    blockedArea,
  };
}
