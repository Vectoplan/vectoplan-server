// Pure geometry shared by selection-style tools; no controller state belongs here.
export type WorldEditSelectionAxis = "x" | "y" | "z";

export interface WorldEditSelectionPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface WorldEditSelectionBounds {
  readonly minimum: WorldEditSelectionPoint;
  readonly maximum: WorldEditSelectionPoint;
  readonly size: WorldEditSelectionPoint;
  readonly center: WorldEditSelectionPoint;
}

export interface WorldEditRulerPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface WorldEditRulerSnapResult {
  readonly point: WorldEditRulerPoint;
  readonly snappedToCorner: boolean;
}

export function resolveWorldEditSelectionBounds(
  first: WorldEditSelectionPoint,
  second: WorldEditSelectionPoint,
): WorldEditSelectionBounds {
  const minimum = {
    x: Math.min(first.x, second.x),
    y: Math.min(first.y, second.y),
    z: Math.min(first.z, second.z),
  };
  const maximum = {
    x: Math.max(first.x, second.x),
    y: Math.max(first.y, second.y),
    z: Math.max(first.z, second.z),
  };
  const size = {
    x: maximum.x - minimum.x + 1,
    y: maximum.y - minimum.y + 1,
    z: maximum.z - minimum.z + 1,
  };
  return {
    minimum,
    maximum,
    size,
    center: {
      x: minimum.x + size.x / 2,
      y: minimum.y + size.y / 2,
      z: minimum.z + size.z / 2,
    },
  };
}

export function snapWorldEditSelectionHandle(options: Readonly<{
  initialBounds: WorldEditSelectionBounds;
  axis: WorldEditSelectionAxis;
  sign: -1 | 1;
  initialPointerCoordinate: number;
  pointerCoordinate: number;
}>): Pick<WorldEditSelectionBounds, "minimum" | "maximum"> {
  const minimum = { ...options.initialBounds.minimum };
  const maximum = { ...options.initialBounds.maximum };
  const delta = Math.round(options.pointerCoordinate - options.initialPointerCoordinate);
  if (options.sign < 0) {
    minimum[options.axis] = Math.min(
      maximum[options.axis],
      options.initialBounds.minimum[options.axis] + delta,
    );
  } else {
    maximum[options.axis] = Math.max(
      minimum[options.axis],
      options.initialBounds.maximum[options.axis] + delta,
    );
  }
  return { minimum, maximum };
}

/**
 * Builds a block-sized grid for the upper face of a WorldEdit selection.
 * The resulting flat array can be passed directly to a Three.js line-segment
 * buffer. Very large selections are sampled so the preview remains bounded.
 */
export function worldEditSelectionTopGridSegments(
  bounds: WorldEditSelectionBounds,
  maximumLinesPerAxis = 4_096,
): readonly number[] {
  const positions: number[] = [];
  const minimumX = bounds.minimum.x;
  const maximumX = bounds.maximum.x + 1;
  const minimumZ = bounds.minimum.z;
  const maximumZ = bounds.maximum.z + 1;
  const topY = bounds.maximum.y + 1 + 0.008;
  const xStep = Math.max(1, Math.ceil(bounds.size.x / Math.max(1, maximumLinesPerAxis)));
  const zStep = Math.max(1, Math.ceil(bounds.size.z / Math.max(1, maximumLinesPerAxis)));

  for (let offset = 0; offset <= bounds.size.x; offset += xStep) {
    const x = Math.min(maximumX, minimumX + offset);
    positions.push(x, topY, minimumZ, x, topY, maximumZ);
  }
  if ((bounds.size.x % xStep) !== 0) {
    positions.push(maximumX, topY, minimumZ, maximumX, topY, maximumZ);
  }
  for (let offset = 0; offset <= bounds.size.z; offset += zStep) {
    const z = Math.min(maximumZ, minimumZ + offset);
    positions.push(minimumX, topY, z, maximumX, topY, z);
  }
  if ((bounds.size.z % zStep) !== 0) {
    positions.push(minimumX, topY, maximumZ, maximumX, topY, maximumZ);
  }
  return positions;
}

/**
 * Snaps a measured surface point to the nearest corner of the hit voxel.
 * The radius is deliberately smaller than half a block so aiming near the
 * middle of a face continues to produce a free measurement point.
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
  const snapRadius = Math.max(0, Number(options.snapRadius ?? 0.42));
  return nearest && nearestDistance <= snapRadius
    ? { point: nearest, snappedToCorner: true }
    : { point, snappedToCorner: false };
}
