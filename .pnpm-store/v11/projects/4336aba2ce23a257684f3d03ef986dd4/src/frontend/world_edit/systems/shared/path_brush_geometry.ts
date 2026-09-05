export interface PathBrushPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type PathBrushKind = "building" | "road";
export type PathBrushInterpolation = "linear" | "catmull-rom";
export type PathBrushConflictKind = "elevation_gap" | "mountain_penetration";
export type PathBrushConflictResolution = "choice_required" | "fill" | "bridge" | "tunnel";
export type PathBrushElevatedResolution = Extract<PathBrushConflictResolution, "fill" | "bridge">;

export interface PathBrushPolygon {
  readonly role: "segment" | "joint";
  readonly segmentIndex: number | null;
  readonly coordinates: readonly (readonly [number, number])[];
  readonly holes: readonly (readonly (readonly [number, number])[])[];
}

export interface PathBrushSegment {
  readonly index: number;
  readonly start: PathBrushPoint;
  readonly end: PathBrushPoint;
  readonly length: number;
  readonly rectangle: readonly (readonly [number, number])[];
}

export interface PathBrushDraft {
  readonly schemaVersion: "vectoplan-path-brush-draft.v1";
  readonly kind: PathBrushKind;
  readonly interpolation: PathBrushInterpolation;
  readonly width: number;
  readonly points: readonly PathBrushPoint[];
  readonly centerline: readonly PathBrushPoint[];
  readonly segments: readonly PathBrushSegment[];
  readonly polygons: readonly PathBrushPolygon[];
  readonly footprint: Readonly<{
    type: "MultiPolygon";
    coordinateSpace: "world-cell-xz";
    coordinates: readonly (readonly (readonly (readonly [number, number])[])[])[];
  }>;
  readonly bounds: Readonly<{
    minimum: Readonly<{ x: number; y: number; z: number }>;
    maximum: Readonly<{ x: number; y: number; z: number }>;
  }>;
  readonly estimatedAreaM2: number;
}

export interface PathBrushHeightConflict {
  readonly id: string;
  readonly segmentIndex: number;
  readonly kind: PathBrushConflictKind;
  readonly resolution: PathBrushConflictResolution;
  readonly maximumDelta: number;
  readonly placeholder: readonly (readonly [number, number])[];
}

export interface PathBrushConflictOptions {
  readonly threshold?: number;
  readonly elevatedResolution?: PathBrushElevatedResolution | null;
  readonly segmentChoices?: Readonly<Record<string, PathBrushElevatedResolution>>;
  readonly samplesPerBlock?: number;
}

const EPSILON = 1e-8;
const UNION_EPSILON = 1e-7;
const MITER_LIMIT = 4;

type RingPoint = readonly [number, number];

interface PolygonEdge {
  readonly start: RingPoint;
  readonly end: RingPoint;
}

function finitePoint(value: PathBrushPoint): PathBrushPoint | null {
  return [value.x, value.y, value.z].every(Number.isFinite)
    ? { x: Number(value.x), y: Number(value.y), z: Number(value.z) }
    : null;
}

function pointDistance(first: PathBrushPoint, second: PathBrushPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y, second.z - first.z);
}

function normalizePoints(points: readonly PathBrushPoint[]): PathBrushPoint[] {
  const result: PathBrushPoint[] = [];
  for (const value of points) {
    const point = finitePoint(value);
    if (!point) continue;
    const previous = result.at(-1);
    if (!previous || pointDistance(previous, point) > EPSILON) result.push(point);
  }
  return result;
}

function catmullRom(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2
    + (-a + 3 * b - 3 * c + d) * t3);
}

export function samplePathBrushCenterline(
  input: readonly PathBrushPoint[],
  interpolation: PathBrushInterpolation = "linear",
  samplesPerBlock = 4,
): readonly PathBrushPoint[] {
  const points = normalizePoints(input);
  if (points.length < 2) return points;
  const result: PathBrushPoint[] = [];
  const density = Math.max(1, Number.isFinite(samplesPerBlock) ? samplesPerBlock : 4);
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;
    const steps = Math.max(2, Math.ceil(pointDistance(p1, p2) * density));
    for (let step = index === 0 ? 0 : 1; step <= steps; step += 1) {
      const t = step / steps;
      if (interpolation === "linear" || points.length === 2) {
        result.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
          z: p1.z + (p2.z - p1.z) * t,
        });
      } else {
        result.push({
          x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
          y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
          z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
        });
      }
    }
  }
  return result;
}

export function voxelizePathBrushCenterline(
  points: readonly PathBrushPoint[],
  interpolation: PathBrushInterpolation = "linear",
): readonly Readonly<{ x: number; y: number; z: number }>[] {
  const result: Array<{ x: number; y: number; z: number }> = [];
  const seen = new Set<string>();
  for (const point of samplePathBrushCenterline(points, interpolation)) {
    const position = { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
    const key = `${position.x}:${position.y}:${position.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(position);
  }
  return result;
}

function closedRectangle(start: PathBrushPoint, end: PathBrushPoint, width: number): readonly (readonly [number, number])[] | null {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length <= EPSILON) return null;
  const half = width * 0.5;
  const offsetX = (-dz / length) * half;
  const offsetZ = (dx / length) * half;
  const first: readonly [number, number] = [start.x + offsetX, start.z + offsetZ];
  return [
    first,
    [end.x + offsetX, end.z + offsetZ],
    [end.x - offsetX, end.z - offsetZ],
    [start.x - offsetX, start.z - offsetZ],
    first,
  ];
}

function closedJointSquare(point: PathBrushPoint, width: number): readonly (readonly [number, number])[] {
  const half = width * 0.5;
  const first: readonly [number, number] = [point.x - half, point.z - half];
  return [
    first,
    [point.x + half, point.z - half],
    [point.x + half, point.z + half],
    [point.x - half, point.z + half],
    first,
  ];
}

function cross2d(firstX: number, firstZ: number, secondX: number, secondZ: number): number {
  return firstX * secondZ - firstZ * secondX;
}

function closeRing(points: readonly RingPoint[]): readonly RingPoint[] {
  if (points.length === 0) return [];
  const result = [...points];
  const first = result[0]!;
  const last = result.at(-1)!;
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) > UNION_EPSILON) result.push(first);
  return result;
}

function miterJoint(
  previous: PathBrushPoint,
  point: PathBrushPoint,
  next: PathBrushPoint,
  width: number,
): readonly RingPoint[] | null {
  const previousDx = point.x - previous.x;
  const previousDz = point.z - previous.z;
  const nextDx = next.x - point.x;
  const nextDz = next.z - point.z;
  const previousLength = Math.hypot(previousDx, previousDz);
  const nextLength = Math.hypot(nextDx, nextDz);
  if (previousLength <= EPSILON || nextLength <= EPSILON) return null;

  const previousTangent: RingPoint = [previousDx / previousLength, previousDz / previousLength];
  const nextTangent: RingPoint = [nextDx / nextLength, nextDz / nextLength];
  const turn = cross2d(previousTangent[0], previousTangent[1], nextTangent[0], nextTangent[1]);
  const directionDot = previousTangent[0] * nextTangent[0] + previousTangent[1] * nextTangent[1];
  if (Math.abs(turn) <= EPSILON) return null;

  const half = width * 0.5;
  const outsideSign = turn > 0 ? -1 : 1;
  const previousNormal: RingPoint = [-previousTangent[1] * outsideSign, previousTangent[0] * outsideSign];
  const nextNormal: RingPoint = [-nextTangent[1] * outsideSign, nextTangent[0] * outsideSign];
  const previousOutside: RingPoint = [
    point.x + previousNormal[0] * half,
    point.z + previousNormal[1] * half,
  ];
  const nextOutside: RingPoint = [
    point.x + nextNormal[0] * half,
    point.z + nextNormal[1] * half,
  ];

  const offsetDx = nextOutside[0] - previousOutside[0];
  const offsetDz = nextOutside[1] - previousOutside[1];
  const intersectionFactor = cross2d(offsetDx, offsetDz, nextTangent[0], nextTangent[1]) / turn;
  const intersection: RingPoint = [
    previousOutside[0] + previousTangent[0] * intersectionFactor,
    previousOutside[1] + previousTangent[1] * intersectionFactor,
  ];
  const miterLength = Math.hypot(intersection[0] - point.x, intersection[1] - point.z);
  const useMiter = directionDot > -0.98 && Number.isFinite(miterLength) && miterLength <= half * MITER_LIMIT;
  return closeRing(useMiter
    ? [previousOutside, intersection, nextOutside, [point.x, point.z]]
    : [previousOutside, nextOutside, [point.x, point.z]]);
}

function openRing(ring: readonly RingPoint[]): readonly RingPoint[] {
  const result: RingPoint[] = [];
  for (const point of ring) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const previous = result.at(-1);
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > UNION_EPSILON) {
      result.push([Number(point[0]), Number(point[1])]);
    }
  }
  if (result.length > 1) {
    const first = result[0]!;
    const last = result.at(-1)!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= UNION_EPSILON) result.pop();
  }
  return result;
}

function pointOnSegment(point: RingPoint, start: RingPoint, end: RingPoint, epsilon = UNION_EPSILON): boolean {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const offsetX = point[0] - start[0];
  const offsetZ = point[1] - start[1];
  if (Math.abs(cross2d(dx, dz, offsetX, offsetZ)) > epsilon * Math.max(1, Math.hypot(dx, dz))) return false;
  const projection = offsetX * dx + offsetZ * dz;
  return projection >= -epsilon && projection <= dx * dx + dz * dz + epsilon;
}

function pointInRing(point: RingPoint, ring: readonly RingPoint[]): boolean {
  const points = openRing(ring);
  if (points.length < 3) return false;
  let inside = false;
  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index, index += 1) {
    const start = points[previousIndex]!;
    const end = points[index]!;
    if (pointOnSegment(point, start, end)) return true;
    const crossesRay = (start[1] > point[1]) !== (end[1] > point[1]);
    if (crossesRay && point[0] < ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInUnion(point: RingPoint, polygons: readonly (readonly RingPoint[])[]): boolean {
  return polygons.some((polygon) => pointInRing(point, polygon));
}

function clampUnit(value: number): number {
  if (value <= UNION_EPSILON) return 0;
  if (value >= 1 - UNION_EPSILON) return 1;
  return value;
}

function addSplit(splits: number[], value: number): void {
  if (!Number.isFinite(value) || value < -UNION_EPSILON || value > 1 + UNION_EPSILON) return;
  const clamped = clampUnit(value);
  if (!splits.some((current) => Math.abs(current - clamped) <= UNION_EPSILON)) splits.push(clamped);
}

function splitEdgePair(
  first: PolygonEdge,
  second: PolygonEdge,
  firstSplits: number[],
  secondSplits: number[],
): void {
  const firstDx = first.end[0] - first.start[0];
  const firstDz = first.end[1] - first.start[1];
  const secondDx = second.end[0] - second.start[0];
  const secondDz = second.end[1] - second.start[1];
  const offsetX = second.start[0] - first.start[0];
  const offsetZ = second.start[1] - first.start[1];
  const denominator = cross2d(firstDx, firstDz, secondDx, secondDz);
  if (Math.abs(denominator) > UNION_EPSILON) {
    const firstFactor = cross2d(offsetX, offsetZ, secondDx, secondDz) / denominator;
    const secondFactor = cross2d(offsetX, offsetZ, firstDx, firstDz) / denominator;
    if (firstFactor >= -UNION_EPSILON && firstFactor <= 1 + UNION_EPSILON
      && secondFactor >= -UNION_EPSILON && secondFactor <= 1 + UNION_EPSILON) {
      addSplit(firstSplits, firstFactor);
      addSplit(secondSplits, secondFactor);
    }
    return;
  }
  if (Math.abs(cross2d(offsetX, offsetZ, firstDx, firstDz)) > UNION_EPSILON) return;

  const firstLengthSquared = firstDx * firstDx + firstDz * firstDz;
  const secondLengthSquared = secondDx * secondDx + secondDz * secondDz;
  if (firstLengthSquared <= EPSILON || secondLengthSquared <= EPSILON) return;
  addSplit(firstSplits, (offsetX * firstDx + offsetZ * firstDz) / firstLengthSquared);
  addSplit(firstSplits, ((second.end[0] - first.start[0]) * firstDx
    + (second.end[1] - first.start[1]) * firstDz) / firstLengthSquared);
  addSplit(secondSplits, ((first.start[0] - second.start[0]) * secondDx
    + (first.start[1] - second.start[1]) * secondDz) / secondLengthSquared);
  addSplit(secondSplits, ((first.end[0] - second.start[0]) * secondDx
    + (first.end[1] - second.start[1]) * secondDz) / secondLengthSquared);
}

function snappedPoint(point: RingPoint): RingPoint {
  return [
    Math.round(point[0] / UNION_EPSILON) * UNION_EPSILON,
    Math.round(point[1] / UNION_EPSILON) * UNION_EPSILON,
  ];
}

function pointKey(point: RingPoint): string {
  const snapped = snappedPoint(point);
  return `${snapped[0].toFixed(7)}:${snapped[1].toFixed(7)}`;
}

function interpolateEdge(edge: PolygonEdge, factor: number): RingPoint {
  return [
    edge.start[0] + (edge.end[0] - edge.start[0]) * factor,
    edge.start[1] + (edge.end[1] - edge.start[1]) * factor,
  ];
}

function ringSignedArea(ring: readonly RingPoint[]): number {
  const points = openRing(ring);
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area * 0.5;
}

function simplifyRing(ring: readonly RingPoint[]): readonly RingPoint[] {
  const points = [...openRing(ring)];
  if (points.length < 3) return [];
  let changed = true;
  while (changed && points.length >= 3) {
    changed = false;
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[(index + points.length - 1) % points.length]!;
      const current = points[index]!;
      const next = points[(index + 1) % points.length]!;
      const firstX = current[0] - previous[0];
      const firstZ = current[1] - previous[1];
      const secondX = next[0] - current[0];
      const secondZ = next[1] - current[1];
      if (Math.abs(cross2d(firstX, firstZ, secondX, secondZ)) <= UNION_EPSILON
        && firstX * secondX + firstZ * secondZ >= -UNION_EPSILON) {
        points.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return closeRing(points);
}

/**
 * Produces the actual outline of overlapping corridor primitives. Rendering the
 * segment rectangles independently creates dark triangles and z-fighting at
 * every bend; splitting their planar arrangement first leaves only the outer
 * boundary, including for retraced or self-intersecting paths.
 */
function unionPolygonOutlines(
  rawPolygons: readonly (readonly RingPoint[])[],
  width: number,
): readonly (readonly RingPoint[])[] {
  const polygons = rawPolygons.map(openRing).filter((ring) => ring.length >= 3);
  const edges: PolygonEdge[] = polygons.flatMap((ring) => ring.map((start, index) => ({
    start,
    end: ring[(index + 1) % ring.length]!,
  })));
  const splits = edges.map(() => [0, 1]);
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    const first = edges[firstIndex]!;
    const firstMinimumX = Math.min(first.start[0], first.end[0]);
    const firstMaximumX = Math.max(first.start[0], first.end[0]);
    const firstMinimumZ = Math.min(first.start[1], first.end[1]);
    const firstMaximumZ = Math.max(first.start[1], first.end[1]);
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const second = edges[secondIndex]!;
      if (Math.max(firstMinimumX, Math.min(second.start[0], second.end[0]))
          > Math.min(firstMaximumX, Math.max(second.start[0], second.end[0])) + UNION_EPSILON
        || Math.max(firstMinimumZ, Math.min(second.start[1], second.end[1]))
          > Math.min(firstMaximumZ, Math.max(second.start[1], second.end[1])) + UNION_EPSILON) continue;
      splitEdgePair(first, second, splits[firstIndex]!, splits[secondIndex]!);
    }
  }

  const boundary = new Map<string, PolygonEdge>();
  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    const edge = edges[edgeIndex]!;
    const factors = [...splits[edgeIndex]!].sort((first, second) => first - second);
    for (let splitIndex = 0; splitIndex < factors.length - 1; splitIndex += 1) {
      const start = snappedPoint(interpolateEdge(edge, factors[splitIndex]!));
      const end = snappedPoint(interpolateEdge(edge, factors[splitIndex + 1]!));
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const length = Math.hypot(dx, dz);
      if (length <= UNION_EPSILON) continue;
      const midpoint: RingPoint = [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5];
      const sampleDistance = Math.max(UNION_EPSILON * 16, Math.min(width * 1e-5, length * 0.05));
      const normalX = (-dz / length) * sampleDistance;
      const normalZ = (dx / length) * sampleDistance;
      const leftInside = pointInUnion([midpoint[0] + normalX, midpoint[1] + normalZ], polygons);
      const rightInside = pointInUnion([midpoint[0] - normalX, midpoint[1] - normalZ], polygons);
      if (leftInside === rightInside) continue;
      const oriented: PolygonEdge = leftInside ? { start, end } : { start: end, end: start };
      boundary.set(`${pointKey(oriented.start)}>${pointKey(oriented.end)}`, oriented);
    }
  }

  const pieces = [...boundary.values()];
  const outgoing = new Map<string, number[]>();
  for (const [index, piece] of pieces.entries()) {
    const key = pointKey(piece.start);
    const values = outgoing.get(key) ?? [];
    values.push(index);
    outgoing.set(key, values);
  }
  const used = new Set<number>();
  const rings: Array<readonly RingPoint[]> = [];
  for (let initialIndex = 0; initialIndex < pieces.length; initialIndex += 1) {
    if (used.has(initialIndex)) continue;
    const initial = pieces[initialIndex]!;
    const ring: RingPoint[] = [initial.start];
    let currentIndex = initialIndex;
    let closed = false;
    for (let guard = 0; guard <= pieces.length; guard += 1) {
      if (used.has(currentIndex)) break;
      const current = pieces[currentIndex]!;
      used.add(currentIndex);
      ring.push(current.end);
      if (pointKey(current.end) === pointKey(initial.start)) {
        closed = true;
        break;
      }
      const candidates = (outgoing.get(pointKey(current.end)) ?? []).filter((index) => !used.has(index));
      if (candidates.length === 0) break;
      if (candidates.length === 1) {
        currentIndex = candidates[0]!;
        continue;
      }
      const incomingX = current.end[0] - current.start[0];
      const incomingZ = current.end[1] - current.start[1];
      currentIndex = candidates.reduce((best, candidate) => {
        const bestEdge = pieces[best]!;
        const candidateEdge = pieces[candidate]!;
        const bestTurn = Math.atan2(
          cross2d(incomingX, incomingZ, bestEdge.end[0] - bestEdge.start[0], bestEdge.end[1] - bestEdge.start[1]),
          incomingX * (bestEdge.end[0] - bestEdge.start[0]) + incomingZ * (bestEdge.end[1] - bestEdge.start[1]),
        );
        const candidateTurn = Math.atan2(
          cross2d(incomingX, incomingZ, candidateEdge.end[0] - candidateEdge.start[0], candidateEdge.end[1] - candidateEdge.start[1]),
          incomingX * (candidateEdge.end[0] - candidateEdge.start[0])
            + incomingZ * (candidateEdge.end[1] - candidateEdge.start[1]),
        );
        return candidateTurn > bestTurn ? candidate : best;
      }, candidates[0]!);
    }
    const simplified = simplifyRing(ring);
    if (closed && simplified.length >= 4 && Math.abs(ringSignedArea(simplified)) > UNION_EPSILON) rings.push(simplified);
  }
  return rings;
}

function groupUnionOutlines(
  rings: readonly (readonly RingPoint[])[],
): readonly Readonly<{ outer: readonly RingPoint[]; holes: readonly (readonly RingPoint[])[] }>[] {
  const outerRings = rings.filter((ring) => ringSignedArea(ring) > UNION_EPSILON);
  const holeRings = rings.filter((ring) => ringSignedArea(ring) < -UNION_EPSILON);
  if (outerRings.length === 0) return [];
  const holesByOuter = outerRings.map(() => [] as Array<readonly RingPoint[]>);
  for (const hole of holeRings) {
    const probe = openRing(hole)[0];
    if (!probe) continue;
    let ownerIndex = -1;
    let ownerArea = Number.POSITIVE_INFINITY;
    for (let index = 0; index < outerRings.length; index += 1) {
      const outer = outerRings[index]!;
      const area = Math.abs(ringSignedArea(outer));
      if (area < ownerArea && pointInRing(probe, outer)) {
        ownerIndex = index;
        ownerArea = area;
      }
    }
    if (ownerIndex >= 0) holesByOuter[ownerIndex]!.push(hole);
  }
  return outerRings.map((outer, index) => ({ outer, holes: holesByOuter[index]! }));
}

export function createPathBrushDraft(
  input: readonly PathBrushPoint[],
  options: Readonly<{
    kind: PathBrushKind;
    width: number;
    interpolation?: PathBrushInterpolation;
    samplesPerBlock?: number;
  }>,
): PathBrushDraft | null {
  const points = normalizePoints(input);
  const width = Math.max(0.25, Math.min(256, Number.isFinite(options.width) ? options.width : 1));
  if (points.length < 2) return null;
  const interpolation = options.interpolation ?? "linear";
  const centerline = samplePathBrushCenterline(points, interpolation, options.samplesPerBlock);
  const segments: PathBrushSegment[] = [];
  const primitivePolygons: Array<readonly RingPoint[]> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const rectangle = closedRectangle(start, end, width);
    if (!rectangle) continue;
    segments.push({ index, start, end, length: pointDistance(start, end), rectangle });
    primitivePolygons.push(rectangle);
  }
  if (segments.length === 0) return null;
  if (options.kind === "building") {
    for (let index = 1; index < points.length - 1; index += 1) {
      const joint = miterJoint(points[index - 1]!, points[index]!, points[index + 1]!, width);
      if (joint) primitivePolygons.push(joint);
    }
    if (points.length > 3 && Math.hypot(points[0]!.x - points.at(-1)!.x, points[0]!.z - points.at(-1)!.z) <= EPSILON) {
      const joint = miterJoint(points.at(-2)!, points[0]!, points[1]!, width);
      if (joint) primitivePolygons.push(joint);
    }
  }
  const polygons: PathBrushPolygon[] = options.kind === "building"
    ? groupUnionOutlines(unionPolygonOutlines(primitivePolygons, width)).map(({ outer, holes }) => ({
        role: "segment" as const,
        segmentIndex: null,
        coordinates: outer,
        holes,
      }))
    : [
        ...segments.map((segment) => ({
          role: "segment" as const,
          segmentIndex: segment.index,
          coordinates: segment.rectangle,
          holes: [],
        })),
        ...points.map((point) => ({
          role: "joint" as const,
          segmentIndex: null,
          coordinates: closedJointSquare(point, width),
          holes: [],
        })),
      ];
  if (polygons.length === 0) return null;
  const xs = polygons.flatMap((polygon) => polygon.coordinates.map(([x]) => x));
  const zs = polygons.flatMap((polygon) => polygon.coordinates.map(([, z]) => z));
  const ys = points.map((point) => point.y);
  const estimatedAreaM2 = options.kind === "building"
    ? Math.abs(polygons.reduce(
        (area, polygon) => area + ringSignedArea(polygon.coordinates)
          + polygon.holes.reduce((holeArea, hole) => holeArea + ringSignedArea(hole), 0),
        0,
      ))
    : segments.reduce((area, segment) => area + segment.length * width, 0) + points.length * width * width;
  return {
    schemaVersion: "vectoplan-path-brush-draft.v1",
    kind: options.kind,
    interpolation,
    width,
    points,
    centerline,
    segments,
    polygons,
    footprint: {
      type: "MultiPolygon",
      coordinateSpace: "world-cell-xz",
      coordinates: polygons.map((polygon) => [polygon.coordinates, ...polygon.holes]),
    },
    bounds: {
      minimum: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) },
      maximum: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) },
    },
    estimatedAreaM2,
  };
}

export function movePathBrushDraft(
  draft: PathBrushDraft,
  offset: Readonly<{ x: number; y?: number; z: number }>,
): PathBrushDraft {
  return createPathBrushDraft(draft.points.map((point) => ({
    x: point.x + offset.x,
    y: point.y + (offset.y ?? 0),
    z: point.z + offset.z,
  })), {
    kind: draft.kind,
    width: draft.width,
    interpolation: draft.interpolation,
  })!;
}

export function updatePathBrushPoint(
  draft: PathBrushDraft,
  index: number,
  point: PathBrushPoint,
): PathBrushDraft {
  if (!Number.isInteger(index) || index < 0 || index >= draft.points.length || !finitePoint(point)) return draft;
  const points = draft.points.map((current, currentIndex) => currentIndex === index ? point : current);
  return createPathBrushDraft(points, {
    kind: draft.kind,
    width: draft.width,
    interpolation: draft.interpolation,
  }) ?? draft;
}

function segmentSamples(segment: PathBrushSegment, samplesPerBlock: number): readonly PathBrushPoint[] {
  const steps = Math.max(1, Math.ceil(segment.length * Math.max(1, samplesPerBlock)));
  return Array.from({ length: steps + 1 }, (_, step) => {
    const t = step / steps;
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * t,
      y: segment.start.y + (segment.end.y - segment.start.y) * t,
      z: segment.start.z + (segment.end.z - segment.start.z) * t,
    };
  });
}

export function resolvePathBrushHeightConflicts(
  draft: PathBrushDraft,
  terrainHeightAt: (x: number, z: number) => number | null | undefined,
  options: PathBrushConflictOptions = {},
): readonly PathBrushHeightConflict[] {
  if (draft.kind !== "road") return [];
  const threshold = Math.max(0.25, Number.isFinite(options.threshold) ? Number(options.threshold) : 3);
  const conflicts: PathBrushHeightConflict[] = [];
  for (const segment of draft.segments) {
    let maximumGap = 0;
    let maximumPenetration = 0;
    for (const point of segmentSamples(segment, options.samplesPerBlock ?? 1)) {
      const terrain = terrainHeightAt(Math.floor(point.x), Math.floor(point.z));
      if (!Number.isFinite(terrain)) continue;
      maximumGap = Math.max(maximumGap, point.y - Number(terrain));
      maximumPenetration = Math.max(maximumPenetration, Number(terrain) - point.y);
    }
    if (maximumGap >= threshold) {
      const id = `elevation_gap:${segment.index}`;
      const selected = options.segmentChoices?.[id] ?? options.elevatedResolution ?? null;
      conflicts.push({
        id,
        segmentIndex: segment.index,
        kind: "elevation_gap",
        resolution: selected ?? "choice_required",
        maximumDelta: maximumGap,
        placeholder: segment.rectangle,
      });
    }
    if (maximumPenetration >= threshold) {
      conflicts.push({
        id: `mountain_penetration:${segment.index}`,
        segmentIndex: segment.index,
        kind: "mountain_penetration",
        resolution: "tunnel",
        maximumDelta: maximumPenetration,
        placeholder: segment.rectangle,
      });
    }
  }
  return conflicts;
}

export function pathBrushDraftFromUnknown(value: unknown): PathBrushDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== "vectoplan-path-brush-draft.v1") return null;
  const rawPoints = Array.isArray(source.points) ? source.points : [];
  const points = rawPoints.map((entry) => {
    const point = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {};
    return { x: Number(point.x), y: Number(point.y), z: Number(point.z) };
  });
  const kind: PathBrushKind = source.kind === "road" ? "road" : "building";
  const interpolation: PathBrushInterpolation = source.interpolation === "catmull-rom" ? "catmull-rom" : "linear";
  return createPathBrushDraft(points, { kind, interpolation, width: Number(source.width) });
}
