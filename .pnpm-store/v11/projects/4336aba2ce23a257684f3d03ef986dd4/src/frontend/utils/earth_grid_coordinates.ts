export interface HorizontalEarthGridFrame {
  readonly worldWidthCells: number;
  readonly worldHeightCells: number;
  readonly centralMeridianDegrees: number;
  readonly storageOrigin: Readonly<{ x: number; z: number }>;
}

function centered(value: number, width: number): number {
  return ((value + width / 2) % width + width) % width - width / 2;
}

function normalizeLongitude(value: number): number {
  return centered(value, 360);
}

/**
 * Convert through the canonical periodic equirectangular Earth grid used by
 * the chunk service. Keeping this exact inverse pair is essential: geodata
 * overlay lines already arrive in these world coordinates.
 */
export function earthGridWorldPointToLonLat(
  worldX: number,
  worldZ: number,
  frame: HorizontalEarthGridFrame,
): readonly [number, number] {
  const gridX = frame.storageOrigin.x + worldX;
  const gridZ = frame.storageOrigin.z + worldZ;
  return [
    normalizeLongitude(
      frame.centralMeridianDegrees + (gridX / frame.worldWidthCells * 360),
    ),
    gridZ / frame.worldHeightCells * 180,
  ];
}

export function earthGridLonLatToWorld(
  longitude: number,
  latitude: number,
  frame: HorizontalEarthGridFrame,
): readonly [number, number] | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const longitudeDelta = centered(
    normalizeLongitude(longitude) - frame.centralMeridianDegrees,
    360,
  );
  const gridX = longitudeDelta / 360 * frame.worldWidthCells;
  const gridZ = latitude / 180 * frame.worldHeightCells;
  return [
    centered(gridX - frame.storageOrigin.x, frame.worldWidthCells),
    gridZ - frame.storageOrigin.z,
  ];
}
