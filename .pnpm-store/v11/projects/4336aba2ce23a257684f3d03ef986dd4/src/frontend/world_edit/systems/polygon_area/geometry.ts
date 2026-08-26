export interface PolygonAreaPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PolygonAreaBounds {
  readonly minimum: PolygonAreaPoint;
  readonly maximum: PolygonAreaPoint;
  readonly size: PolygonAreaPoint;
}

const EPSILON = 1e-7;

function samePlanPoint(first: PolygonAreaPoint, second: PolygonAreaPoint): boolean {
  return Math.hypot(first.x - second.x, first.z - second.z) <= EPSILON;
}

export function normalizePolygonAreaPoints(
  values: readonly PolygonAreaPoint[],
): readonly PolygonAreaPoint[] {
  const result: PolygonAreaPoint[] = [];
  for (const value of values) {
    if (![value.x, value.y, value.z].every(Number.isFinite)) continue;
    const point = { x: Number(value.x), y: Number(value.y), z: Number(value.z) };
    if (!result.at(-1) || !samePlanPoint(result.at(-1)!, point)) result.push(point);
  }
  if (result.length > 1 && samePlanPoint(result[0]!, result.at(-1)!)) result.pop();
  return result;
}

export function polygonAreaSignedPlanArea(points: readonly PolygonAreaPoint[]): number {
  const ring = normalizePolygonAreaPoints(points);
  if (ring.length < 3) return 0;
  return ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]!;
    return sum + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

export function polygonAreaPlanArea(points: readonly PolygonAreaPoint[]): number {
  return Math.abs(polygonAreaSignedPlanArea(points));
}

export function polygonAreaPlanCentroid(
  points: readonly PolygonAreaPoint[],
): PolygonAreaPoint | null {
  const ring = normalizePolygonAreaPoints(points);
  if (ring.length < 3) return null;
  let twiceArea = 0;
  let weightedX = 0;
  let weightedZ = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index]!;
    const next = ring[(index + 1) % ring.length]!;
    const cross = point.x * next.z - next.x * point.z;
    twiceArea += cross;
    weightedX += (point.x + next.x) * cross;
    weightedZ += (point.z + next.z) * cross;
  }
  if (Math.abs(twiceArea) <= EPSILON) return null;
  return {
    x: weightedX / (3 * twiceArea),
    y: ring.reduce((sum, point) => sum + point.y, 0) / ring.length,
    z: weightedZ / (3 * twiceArea),
  };
}

function orientation(
  first: PolygonAreaPoint,
  second: PolygonAreaPoint,
  third: PolygonAreaPoint,
): number {
  return (second.x - first.x) * (third.z - first.z)
    - (second.z - first.z) * (third.x - first.x);
}

function onSegment(
  first: PolygonAreaPoint,
  second: PolygonAreaPoint,
  point: PolygonAreaPoint,
): boolean {
  return Math.abs(orientation(first, second, point)) <= EPSILON
    && point.x >= Math.min(first.x, second.x) - EPSILON
    && point.x <= Math.max(first.x, second.x) + EPSILON
    && point.z >= Math.min(first.z, second.z) - EPSILON
    && point.z <= Math.max(first.z, second.z) + EPSILON;
}

function segmentsIntersect(
  firstStart: PolygonAreaPoint,
  firstEnd: PolygonAreaPoint,
  secondStart: PolygonAreaPoint,
  secondEnd: PolygonAreaPoint,
): boolean {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  if (((firstA > EPSILON && firstB < -EPSILON) || (firstA < -EPSILON && firstB > EPSILON))
    && ((secondA > EPSILON && secondB < -EPSILON) || (secondA < -EPSILON && secondB > EPSILON))) return true;
  return (Math.abs(firstA) <= EPSILON && onSegment(firstStart, firstEnd, secondStart))
    || (Math.abs(firstB) <= EPSILON && onSegment(firstStart, firstEnd, secondEnd))
    || (Math.abs(secondA) <= EPSILON && onSegment(secondStart, secondEnd, firstStart))
    || (Math.abs(secondB) <= EPSILON && onSegment(secondStart, secondEnd, firstEnd));
}

export function polygonAreaSelfIntersects(points: readonly PolygonAreaPoint[]): boolean {
  const ring = normalizePolygonAreaPoints(points);
  if (ring.length < 4) return false;
  for (let first = 0; first < ring.length; first += 1) {
    const firstEnd = (first + 1) % ring.length;
    for (let second = first + 1; second < ring.length; second += 1) {
      const secondEnd = (second + 1) % ring.length;
      if (first === second || firstEnd === second || secondEnd === first) continue;
      if (first === 0 && secondEnd === 0) continue;
      if (segmentsIntersect(ring[first]!, ring[firstEnd]!, ring[second]!, ring[secondEnd]!)) return true;
    }
  }
  return false;
}

export function validPolygonArea(points: readonly PolygonAreaPoint[]): boolean {
  const ring = normalizePolygonAreaPoints(points);
  return ring.length >= 3
    && polygonAreaPlanArea(ring) > EPSILON
    && !polygonAreaSelfIntersects(ring);
}

export function polygonAreaBounds(points: readonly PolygonAreaPoint[]): PolygonAreaBounds | null {
  const ring = normalizePolygonAreaPoints(points);
  if (ring.length === 0) return null;
  const minimum = {
    x: Math.min(...ring.map(({ x }) => x)),
    y: Math.min(...ring.map(({ y }) => y)),
    z: Math.min(...ring.map(({ z }) => z)),
  };
  const maximum = {
    x: Math.max(...ring.map(({ x }) => x)),
    y: Math.max(...ring.map(({ y }) => y)),
    z: Math.max(...ring.map(({ z }) => z)),
  };
  return {
    minimum,
    maximum,
    size: {
      x: Math.max(EPSILON, maximum.x - minimum.x),
      y: Math.max(EPSILON, maximum.y - minimum.y),
      z: Math.max(EPSILON, maximum.z - minimum.z),
    },
  };
}

export function polygonAreaClosedCoordinates(
  points: readonly PolygonAreaPoint[],
): readonly (readonly [number, number])[] {
  const ring = normalizePolygonAreaPoints(points);
  if (ring.length === 0) return [];
  const coordinates: Array<readonly [number, number]> = ring.map(({ x, z }) => [x, z]);
  coordinates.push([ring[0]!.x, ring[0]!.z]);
  return coordinates;
}

export function polygonAreaPointsFromFootprint(
  footprint: Readonly<Record<string, unknown>>,
  fallbackY: number,
): readonly PolygonAreaPoint[] {
  const coordinates = Array.isArray(footprint.coordinates) ? footprint.coordinates : [];
  const polygon = String(footprint.type ?? "Polygon") === "MultiPolygon"
    ? (Array.isArray(coordinates[0]) ? coordinates[0] : [])
    : coordinates;
  const ring = Array.isArray(polygon[0]) ? polygon[0] : [];
  const y = Number.isFinite(Number(footprint.baseY)) ? Number(footprint.baseY) : fallbackY;
  return normalizePolygonAreaPoints(ring.map((value): PolygonAreaPoint => {
    const point = Array.isArray(value) ? value : [];
    return { x: Number(point[0]), y, z: Number(point[1]) };
  }));
}
