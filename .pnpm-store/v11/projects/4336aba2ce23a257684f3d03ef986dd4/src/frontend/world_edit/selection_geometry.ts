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
