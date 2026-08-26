export interface WorldEditRulerPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface WorldEditRulerSnapResult {
  readonly point: WorldEditRulerPoint;
  readonly snappedToCorner: boolean;
}

/** Resolves the voxel immediately behind a visible surface hit. */
export function rulerSourceCellFromSurfaceHit(
  point: WorldEditRulerPoint,
  direction: WorldEditRulerPoint,
): WorldEditRulerPoint {
  const epsilon = 1e-4;
  return {
    x: Math.floor(point.x + direction.x * epsilon),
    y: Math.floor(point.y + direction.y * epsilon),
    z: Math.floor(point.z + direction.z * epsilon),
  };
}

/**
 * Snaps to the nearest corner of the hit voxel. The 0.60-block magnet stays
 * below the 0.707 distance from a face centre to its corners, so face-centre
 * measurements remain free.
 */
export function snapWorldEditRulerPoint(options: Readonly<{
  targetPoint: WorldEditRulerPoint;
  sourceCell: WorldEditRulerPoint | null;
  snapRadius?: number;
}>): WorldEditRulerSnapResult {
  const point = {
    x: Number(options.targetPoint.x),
    y: Number(options.targetPoint.y),
    z: Number(options.targetPoint.z),
  };
  const sourceCell = options.sourceCell;
  if (!sourceCell || ![point.x, point.y, point.z].every(Number.isFinite)) {
    return { point, snappedToCorner: false };
  }

  let nearest: WorldEditRulerPoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const xOffset of [0, 1]) {
    for (const yOffset of [0, 1]) {
      for (const zOffset of [0, 1]) {
        const corner = {
          x: sourceCell.x + xOffset,
          y: sourceCell.y + yOffset,
          z: sourceCell.z + zOffset,
        };
        const distance = Math.hypot(
          point.x - corner.x,
          point.y - corner.y,
          point.z - corner.z,
        );
        if (distance < nearestDistance) {
          nearest = corner;
          nearestDistance = distance;
        }
      }
    }
  }
  const snapRadius = Math.max(0, Number(options.snapRadius ?? 0.60));
  return nearest && nearestDistance <= snapRadius
    ? { point: nearest, snappedToCorner: true }
    : { point, snappedToCorner: false };
}
