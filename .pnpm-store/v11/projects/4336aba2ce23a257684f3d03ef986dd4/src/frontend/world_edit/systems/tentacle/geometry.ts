import type { WorldEditPosition } from "../contracts";
import {
  samplePathBrushCenterline,
  voxelizePathBrushCenterline,
  type PathBrushPoint,
} from "../shared/path_brush_geometry";

export interface TentaclePoint extends PathBrushPoint {}

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

export function sampleTentacleCurve(points: readonly TentaclePoint[], samplesPerBlock = 4): readonly TentaclePoint[] {
  return samplePathBrushCenterline(points, "catmull-rom", samplesPerBlock);
}

export function voxelizeTentacleCurve(points: readonly TentaclePoint[]): readonly WorldEditPosition[] {
  return voxelizePathBrushCenterline(points, "catmull-rom") as readonly WorldEditPosition[];
}
