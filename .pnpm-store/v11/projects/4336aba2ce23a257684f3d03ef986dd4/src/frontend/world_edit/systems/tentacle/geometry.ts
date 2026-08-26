import type { WorldEditPosition } from "../contracts";

export interface TentaclePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function distance(first: TentaclePoint, second: TentaclePoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y, second.z - first.z);
}

export const TENTACLE_HOLD_DEBOUNCE_MS = 180;

export function shouldAppendTentacleSample(
  elapsedMs: number,
  distanceFromLastPoint: number,
): boolean {
  return Number.isFinite(elapsedMs)
    && elapsedMs >= TENTACLE_HOLD_DEBOUNCE_MS
    && Number.isFinite(distanceFromLastPoint)
    && distanceFromLastPoint >= 0.75;
}

function catmullRom(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

export function sampleTentacleCurve(points: readonly TentaclePoint[], samplesPerBlock = 4): readonly TentaclePoint[] {
  if (points.length < 2) return [...points];
  const result: TentaclePoint[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;
    const steps = Math.max(2, Math.ceil(distance(p1, p2) * Math.max(1, samplesPerBlock)));
    for (let step = index === 0 ? 0 : 1; step <= steps; step += 1) {
      const t = step / steps;
      if (points.length === 2) {
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

export function voxelizeTentacleCurve(points: readonly TentaclePoint[]): readonly WorldEditPosition[] {
  const result: WorldEditPosition[] = [];
  const seen = new Set<string>();
  for (const point of sampleTentacleCurve(points)) {
    const position = { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
    const key = `${position.x}:${position.y}:${position.z}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(position);
    }
  }
  return result;
}
