// src/frontend/runtime/world/chunk_coordinates.ts
import { chunkKeyFromCoordinates, parseChunkKey } from "@utils/ids";
import { clampInteger, safeInteger, safeNumber } from "@utils/safe";

export interface ChunkWorldPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ChunkCoordinates {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
}

export interface LocalCellCoordinates {
  readonly localX: number;
  readonly localY: number;
  readonly localZ: number;
}

export interface ChunkCellAddress extends ChunkCoordinates, LocalCellCoordinates {
  readonly chunkKey: string;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  readonly cellIndex: number;
}

export interface ChunkCellAddressInput {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  readonly chunkSize?: number;
}

export interface ChunkBounds {
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly size: number;
}

export interface ChunkNeighborKeys {
  readonly center: string;
  readonly xMinus: string;
  readonly xPlus: string;
  readonly yMinus: string;
  readonly yPlus: string;
  readonly zMinus: string;
  readonly zPlus: string;
}

export interface DirtyNeighborOptions {
  readonly includeEdges?: boolean;
  readonly includeCorners?: boolean;
}

export interface VisibleChunkOptions {
  readonly radius?: number;
  readonly includeCenter?: boolean;
  readonly maxRadius?: number;
  readonly radial?: boolean;
  readonly verticalRadius?: number;
}

export interface WorldCellCoordinates {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
}

export interface WorldCellRange {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export interface WorldCellRangeSize {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly cellCount: number;
}

export interface WorldAabbLike {
  readonly min: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly max: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

export interface WorldCellRangeIterationResult {
  readonly completed: boolean;
  readonly visited: number;
  readonly aborted: boolean;
}

export interface ChunkRange {
  readonly minChunkX: number;
  readonly minChunkY: number;
  readonly minChunkZ: number;
  readonly maxChunkX: number;
  readonly maxChunkY: number;
  readonly maxChunkZ: number;
}

export const DEFAULT_CHUNK_SIZE: number = 16;

export const CHUNK_CELL_INDEX_ORDER = "x-fastest-y-then-z" as const;

export const DEFAULT_WORLD_AABB_EPSILON = 0.000001;

export const DEFAULT_MAX_WORLD_CELL_RANGE_CELLS = 262_144;

export function normalizeChunkSize(value: unknown, fallback: number = DEFAULT_CHUNK_SIZE): number {
  try {
    return clampInteger(value, 1, 512, fallback);
  } catch {
    return fallback;
  }
}

export function normalizeWorldCoordinate(value: unknown): number {
  try {
    return Math.floor(safeNumber(value, 0));
  } catch {
    return 0;
  }
}

export function normalizeWorldFloatCoordinate(value: unknown): number {
  try {
    const normalized = safeNumber(value, 0);

    return Number.isFinite(normalized) ? normalized : 0;
  } catch {
    return 0;
  }
}

export function normalizeWorldCellCoordinate(value: unknown): number {
  return normalizeWorldCoordinate(value);
}

export function floorDiv(value: unknown, divisor: unknown): number {
  try {
    const numericValue = safeNumber(value, 0);
    const numericDivisor = safeNumber(divisor, DEFAULT_CHUNK_SIZE);

    if (!Number.isFinite(numericDivisor) || numericDivisor === 0) {
      return 0;
    }

    return Math.floor(numericValue / numericDivisor);
  } catch {
    return 0;
  }
}

export function positiveModulo(value: unknown, divisor: unknown): number {
  try {
    const numericValue = safeInteger(value, 0);
    const numericDivisor = Math.abs(safeInteger(divisor, DEFAULT_CHUNK_SIZE));

    if (!Number.isFinite(numericDivisor) || numericDivisor <= 0) {
      return 0;
    }

    return ((numericValue % numericDivisor) + numericDivisor) % numericDivisor;
  } catch {
    return 0;
  }
}

export function worldToChunkCoordinate(
  worldCoordinate: unknown,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): number {
  try {
    const normalizedChunkSize = normalizeChunkSize(chunkSize);
    const normalizedWorldCoordinate = normalizeWorldCoordinate(worldCoordinate);

    return floorDiv(normalizedWorldCoordinate, normalizedChunkSize);
  } catch {
    return 0;
  }
}

export function worldToLocalCellCoordinate(
  worldCoordinate: unknown,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): number {
  try {
    const normalizedChunkSize = normalizeChunkSize(chunkSize);
    const normalizedWorldCoordinate = normalizeWorldCoordinate(worldCoordinate);

    return positiveModulo(normalizedWorldCoordinate, normalizedChunkSize);
  } catch {
    return 0;
  }
}

export function worldToChunkCoordinates(
  position: ChunkWorldPosition,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkCoordinates {
  const normalizedChunkSize = normalizeChunkSize(chunkSize);

  return {
    chunkX: worldToChunkCoordinate(position.x, normalizedChunkSize),
    chunkY: worldToChunkCoordinate(position.y, normalizedChunkSize),
    chunkZ: worldToChunkCoordinate(position.z, normalizedChunkSize),
  };
}

export function worldToLocalCellCoordinates(
  position: ChunkWorldPosition,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): LocalCellCoordinates {
  const normalizedChunkSize = normalizeChunkSize(chunkSize);

  return {
    localX: worldToLocalCellCoordinate(position.x, normalizedChunkSize),
    localY: worldToLocalCellCoordinate(position.y, normalizedChunkSize),
    localZ: worldToLocalCellCoordinate(position.z, normalizedChunkSize),
  };
}

export function worldPositionToCellCoordinates(
  position: Partial<ChunkWorldPosition> | null | undefined,
): WorldCellCoordinates {
  try {
    return {
      worldX: normalizeWorldCellCoordinate(position?.x),
      worldY: normalizeWorldCellCoordinate(position?.y),
      worldZ: normalizeWorldCellCoordinate(position?.z),
    };
  } catch {
    return {
      worldX: 0,
      worldY: 0,
      worldZ: 0,
    };
  }
}

export function localCellToWorldCoordinate(
  chunkCoordinate: unknown,
  localCoordinate: unknown,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): number {
  try {
    const normalizedChunkSize = normalizeChunkSize(chunkSize);
    const normalizedChunkCoordinate = safeInteger(chunkCoordinate, 0);
    const normalizedLocalCoordinate = clampInteger(localCoordinate, 0, normalizedChunkSize - 1, 0);

    return (normalizedChunkCoordinate * normalizedChunkSize) + normalizedLocalCoordinate;
  } catch {
    return 0;
  }
}

export function localCellToWorldPosition(
  coordinates: ChunkCoordinates & LocalCellCoordinates,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkWorldPosition {
  const normalizedChunkSize = normalizeChunkSize(chunkSize);

  return {
    x: localCellToWorldCoordinate(coordinates.chunkX, coordinates.localX, normalizedChunkSize),
    y: localCellToWorldCoordinate(coordinates.chunkY, coordinates.localY, normalizedChunkSize),
    z: localCellToWorldCoordinate(coordinates.chunkZ, coordinates.localZ, normalizedChunkSize),
  };
}

export function cellIndexFromLocalCoordinates(
  local: LocalCellCoordinates,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): number {
  try {
    const normalizedChunkSize = normalizeChunkSize(chunkSize);
    const localX = clampInteger(local.localX, 0, normalizedChunkSize - 1, 0);
    const localY = clampInteger(local.localY, 0, normalizedChunkSize - 1, 0);
    const localZ = clampInteger(local.localZ, 0, normalizedChunkSize - 1, 0);

    return localX + (normalizedChunkSize * (localY + (normalizedChunkSize * localZ)));
  } catch {
    return 0;
  }
}

export function localCoordinatesFromCellIndex(
  cellIndex: unknown,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): LocalCellCoordinates {
  try {
    const normalizedChunkSize = normalizeChunkSize(chunkSize);
    const maxIndex = (normalizedChunkSize * normalizedChunkSize * normalizedChunkSize) - 1;
    const index = clampInteger(cellIndex, 0, maxIndex, 0);

    const localX = index % normalizedChunkSize;
    const yAndZ = Math.floor(index / normalizedChunkSize);
    const localY = yAndZ % normalizedChunkSize;
    const localZ = Math.floor(yAndZ / normalizedChunkSize);

    return {
      localX,
      localY,
      localZ,
    };
  } catch {
    return {
      localX: 0,
      localY: 0,
      localZ: 0,
    };
  }
}

export function createChunkCellAddress(
  input: ChunkCellAddressInput,
): ChunkCellAddress {
  const chunkSize = normalizeChunkSize(input.chunkSize);
  const worldX = normalizeWorldCoordinate(input.worldX);
  const worldY = normalizeWorldCoordinate(input.worldY);
  const worldZ = normalizeWorldCoordinate(input.worldZ);

  const chunkCoordinates = worldToChunkCoordinates(
    {
      x: worldX,
      y: worldY,
      z: worldZ,
    },
    chunkSize,
  );

  const localCoordinates = worldToLocalCellCoordinates(
    {
      x: worldX,
      y: worldY,
      z: worldZ,
    },
    chunkSize,
  );

  const chunkKey = chunkKeyFromCoordinates(
    chunkCoordinates.chunkX,
    chunkCoordinates.chunkY,
    chunkCoordinates.chunkZ,
  );

  return {
    ...chunkCoordinates,
    ...localCoordinates,
    chunkKey,
    worldX,
    worldY,
    worldZ,
    cellIndex: cellIndexFromLocalCoordinates(localCoordinates, chunkSize),
  };
}

export function createChunkCellAddressFromChunkAndLocal(
  input: ChunkCoordinates & LocalCellCoordinates & { readonly chunkSize?: number },
): ChunkCellAddress {
  const chunkSize = normalizeChunkSize(input.chunkSize);
  const chunkX = safeInteger(input.chunkX, 0);
  const chunkY = safeInteger(input.chunkY, 0);
  const chunkZ = safeInteger(input.chunkZ, 0);
  const localX = clampInteger(input.localX, 0, chunkSize - 1, 0);
  const localY = clampInteger(input.localY, 0, chunkSize - 1, 0);
  const localZ = clampInteger(input.localZ, 0, chunkSize - 1, 0);

  const worldPosition = localCellToWorldPosition(
    {
      chunkX,
      chunkY,
      chunkZ,
      localX,
      localY,
      localZ,
    },
    chunkSize,
  );

  return {
    chunkX,
    chunkY,
    chunkZ,
    localX,
    localY,
    localZ,
    chunkKey: chunkKeyFromCoordinates(chunkX, chunkY, chunkZ),
    worldX: worldPosition.x,
    worldY: worldPosition.y,
    worldZ: worldPosition.z,
    cellIndex: cellIndexFromLocalCoordinates({ localX, localY, localZ }, chunkSize),
  };
}

export function chunkCoordinatesFromKey(value: unknown): ChunkCoordinates {
  try {
    const parsed = parseChunkKey(value);

    if (!parsed.valid) {
      return {
        chunkX: 0,
        chunkY: 0,
        chunkZ: 0,
      };
    }

    return {
      chunkX: parsed.chunkX,
      chunkY: parsed.chunkY,
      chunkZ: parsed.chunkZ,
    };
  } catch {
    return {
      chunkX: 0,
      chunkY: 0,
      chunkZ: 0,
    };
  }
}

export function chunkBoundsFromCoordinates(
  coordinates: ChunkCoordinates,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkBounds {
  const normalizedChunkSize = normalizeChunkSize(chunkSize);
  const chunkX = safeInteger(coordinates.chunkX, 0);
  const chunkY = safeInteger(coordinates.chunkY, 0);
  const chunkZ = safeInteger(coordinates.chunkZ, 0);

  const minX = chunkX * normalizedChunkSize;
  const minY = chunkY * normalizedChunkSize;
  const minZ = chunkZ * normalizedChunkSize;
  const maxX = minX + normalizedChunkSize;
  const maxY = minY + normalizedChunkSize;
  const maxZ = minZ + normalizedChunkSize;

  return {
    chunkKey: chunkKeyFromCoordinates(chunkX, chunkY, chunkZ),
    chunkX,
    chunkY,
    chunkZ,
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
    centerX: minX + (normalizedChunkSize / 2),
    centerY: minY + (normalizedChunkSize / 2),
    centerZ: minZ + (normalizedChunkSize / 2),
    size: normalizedChunkSize,
  };
}

export function chunkBoundsFromKey(
  value: unknown,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkBounds {
  return chunkBoundsFromCoordinates(chunkCoordinatesFromKey(value), chunkSize);
}

export function isWorldPositionInsideChunkBounds(
  position: ChunkWorldPosition,
  bounds: ChunkBounds,
): boolean {
  try {
    const x = safeNumber(position.x, 0);
    const y = safeNumber(position.y, 0);
    const z = safeNumber(position.z, 0);

    return (
      x >= bounds.minX
      && x < bounds.maxX
      && y >= bounds.minY
      && y < bounds.maxY
      && z >= bounds.minZ
      && z < bounds.maxZ
    );
  } catch {
    return false;
  }
}

export function isLocalCellAtChunkBoundary(
  local: LocalCellCoordinates,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): boolean {
  try {
    const normalizedChunkSize = normalizeChunkSize(chunkSize);

    return (
      local.localX <= 0
      || local.localY <= 0
      || local.localZ <= 0
      || local.localX >= normalizedChunkSize - 1
      || local.localY >= normalizedChunkSize - 1
      || local.localZ >= normalizedChunkSize - 1
    );
  } catch {
    return false;
  }
}

export function normalizeWorldCellRange(range: Partial<WorldCellRange> | null | undefined): WorldCellRange {
  try {
    const minX = normalizeWorldCellCoordinate(Math.min(
      safeNumber(range?.minX, 0),
      safeNumber(range?.maxX, 0),
    ));
    const minY = normalizeWorldCellCoordinate(Math.min(
      safeNumber(range?.minY, 0),
      safeNumber(range?.maxY, 0),
    ));
    const minZ = normalizeWorldCellCoordinate(Math.min(
      safeNumber(range?.minZ, 0),
      safeNumber(range?.maxZ, 0),
    ));
    const maxX = normalizeWorldCellCoordinate(Math.max(
      safeNumber(range?.minX, 0),
      safeNumber(range?.maxX, 0),
    ));
    const maxY = normalizeWorldCellCoordinate(Math.max(
      safeNumber(range?.minY, 0),
      safeNumber(range?.maxY, 0),
    ));
    const maxZ = normalizeWorldCellCoordinate(Math.max(
      safeNumber(range?.minZ, 0),
      safeNumber(range?.maxZ, 0),
    ));

    return {
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
    };
  } catch {
    return {
      minX: 0,
      minY: 0,
      minZ: 0,
      maxX: 0,
      maxY: 0,
      maxZ: 0,
    };
  }
}

export function worldCellRangeFromAabb(
  aabb: WorldAabbLike,
  epsilon: number = DEFAULT_WORLD_AABB_EPSILON,
): WorldCellRange {
  try {
    const safeEpsilon = Math.max(0, safeNumber(epsilon, DEFAULT_WORLD_AABB_EPSILON));

    /**
     * max uses (max - epsilon), so an AABB ending exactly at x=2.0 does not
     * include cell 2. This prevents face-touching from becoming penetration.
     */
    return normalizeWorldCellRange({
      minX: Math.floor(normalizeWorldFloatCoordinate(aabb.min.x)),
      minY: Math.floor(normalizeWorldFloatCoordinate(aabb.min.y)),
      minZ: Math.floor(normalizeWorldFloatCoordinate(aabb.min.z)),
      maxX: Math.floor(normalizeWorldFloatCoordinate(aabb.max.x) - safeEpsilon),
      maxY: Math.floor(normalizeWorldFloatCoordinate(aabb.max.y) - safeEpsilon),
      maxZ: Math.floor(normalizeWorldFloatCoordinate(aabb.max.z) - safeEpsilon),
    });
  } catch {
    return normalizeWorldCellRange(null);
  }
}

export function expandWorldCellRange(
  range: WorldCellRange,
  amount: unknown,
): WorldCellRange {
  try {
    const safeAmount = Math.max(0, safeInteger(amount, 0));

    return normalizeWorldCellRange({
      minX: range.minX - safeAmount,
      minY: range.minY - safeAmount,
      minZ: range.minZ - safeAmount,
      maxX: range.maxX + safeAmount,
      maxY: range.maxY + safeAmount,
      maxZ: range.maxZ + safeAmount,
    });
  } catch {
    return normalizeWorldCellRange(range);
  }
}

export function worldCellRangeSize(range: WorldCellRange): WorldCellRangeSize {
  try {
    const normalized = normalizeWorldCellRange(range);
    const sizeX = Math.max(0, normalized.maxX - normalized.minX + 1);
    const sizeY = Math.max(0, normalized.maxY - normalized.minY + 1);
    const sizeZ = Math.max(0, normalized.maxZ - normalized.minZ + 1);

    return {
      sizeX,
      sizeY,
      sizeZ,
      cellCount: sizeX * sizeY * sizeZ,
    };
  } catch {
    return {
      sizeX: 0,
      sizeY: 0,
      sizeZ: 0,
      cellCount: 0,
    };
  }
}

export function isWorldCellRangeReasonable(
  range: WorldCellRange,
  maxCells: number = DEFAULT_MAX_WORLD_CELL_RANGE_CELLS,
): boolean {
  try {
    const size = worldCellRangeSize(range);
    const safeMaxCells = Math.max(1, safeInteger(maxCells, DEFAULT_MAX_WORLD_CELL_RANGE_CELLS));

    return size.cellCount <= safeMaxCells;
  } catch {
    return false;
  }
}

export function forEachWorldCellInRange(
  range: WorldCellRange,
  callback: (cell: WorldCellCoordinates) => boolean | void,
  maxCells: number = DEFAULT_MAX_WORLD_CELL_RANGE_CELLS,
): WorldCellRangeIterationResult {
  try {
    const normalized = normalizeWorldCellRange(range);
    const safeMaxCells = Math.max(1, safeInteger(maxCells, DEFAULT_MAX_WORLD_CELL_RANGE_CELLS));
    let visited = 0;

    for (let y = normalized.minY; y <= normalized.maxY; y += 1) {
      for (let z = normalized.minZ; z <= normalized.maxZ; z += 1) {
        for (let x = normalized.minX; x <= normalized.maxX; x += 1) {
          visited += 1;

          if (visited > safeMaxCells) {
            return {
              completed: false,
              visited,
              aborted: true,
            };
          }

          const shouldContinue = callback({
            worldX: x,
            worldY: y,
            worldZ: z,
          });

          if (shouldContinue === false) {
            return {
              completed: false,
              visited,
              aborted: true,
            };
          }
        }
      }
    }

    return {
      completed: true,
      visited,
      aborted: false,
    };
  } catch {
    return {
      completed: false,
      visited: 0,
      aborted: true,
    };
  }
}

export function collectWorldCellsInRange(
  range: WorldCellRange,
  maxCells: number = DEFAULT_MAX_WORLD_CELL_RANGE_CELLS,
): readonly WorldCellCoordinates[] {
  try {
    const cells: WorldCellCoordinates[] = [];

    forEachWorldCellInRange(
      range,
      (cell) => {
        cells.push(cell);
        return true;
      },
      maxCells,
    );

    return cells;
  } catch {
    return [];
  }
}

export function chunkRangeFromWorldCellRange(
  range: WorldCellRange,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): ChunkRange {
  try {
    const normalized = normalizeWorldCellRange(range);
    const size = normalizeChunkSize(chunkSize);

    return {
      minChunkX: worldToChunkCoordinate(normalized.minX, size),
      minChunkY: worldToChunkCoordinate(normalized.minY, size),
      minChunkZ: worldToChunkCoordinate(normalized.minZ, size),
      maxChunkX: worldToChunkCoordinate(normalized.maxX, size),
      maxChunkY: worldToChunkCoordinate(normalized.maxY, size),
      maxChunkZ: worldToChunkCoordinate(normalized.maxZ, size),
    };
  } catch {
    return {
      minChunkX: 0,
      minChunkY: 0,
      minChunkZ: 0,
      maxChunkX: 0,
      maxChunkY: 0,
      maxChunkZ: 0,
    };
  }
}

export function chunkCoordinatesForWorldCellRange(
  range: WorldCellRange,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): readonly ChunkCoordinates[] {
  try {
    const chunkRange = chunkRangeFromWorldCellRange(range, chunkSize);
    const coordinates: ChunkCoordinates[] = [];

    for (let y = chunkRange.minChunkY; y <= chunkRange.maxChunkY; y += 1) {
      for (let z = chunkRange.minChunkZ; z <= chunkRange.maxChunkZ; z += 1) {
        for (let x = chunkRange.minChunkX; x <= chunkRange.maxChunkX; x += 1) {
          coordinates.push({
            chunkX: x,
            chunkY: y,
            chunkZ: z,
          });
        }
      }
    }

    return coordinates.sort(compareChunkCoordinates);
  } catch {
    return [
      {
        chunkX: 0,
        chunkY: 0,
        chunkZ: 0,
      },
    ];
  }
}

export function chunkKeysForWorldCellRange(
  range: WorldCellRange,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): readonly string[] {
  try {
    return sortChunkKeys(
      chunkCoordinatesForWorldCellRange(range, chunkSize).map((coordinates) =>
        chunkKeyFromCoordinates(coordinates.chunkX, coordinates.chunkY, coordinates.chunkZ),
      ),
    );
  } catch {
    return [chunkKeyFromCoordinates(0, 0, 0)];
  }
}

export function chunkKeysForWorldAabb(
  aabb: WorldAabbLike,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  epsilon: number = DEFAULT_WORLD_AABB_EPSILON,
): readonly string[] {
  try {
    return chunkKeysForWorldCellRange(
      worldCellRangeFromAabb(aabb, epsilon),
      chunkSize,
    );
  } catch {
    return [chunkKeyFromCoordinates(0, 0, 0)];
  }
}

export function neighborChunkKeys(
  coordinates: ChunkCoordinates,
): ChunkNeighborKeys {
  const chunkX = safeInteger(coordinates.chunkX, 0);
  const chunkY = safeInteger(coordinates.chunkY, 0);
  const chunkZ = safeInteger(coordinates.chunkZ, 0);

  return {
    center: chunkKeyFromCoordinates(chunkX, chunkY, chunkZ),
    xMinus: chunkKeyFromCoordinates(chunkX - 1, chunkY, chunkZ),
    xPlus: chunkKeyFromCoordinates(chunkX + 1, chunkY, chunkZ),
    yMinus: chunkKeyFromCoordinates(chunkX, chunkY - 1, chunkZ),
    yPlus: chunkKeyFromCoordinates(chunkX, chunkY + 1, chunkZ),
    zMinus: chunkKeyFromCoordinates(chunkX, chunkY, chunkZ - 1),
    zPlus: chunkKeyFromCoordinates(chunkX, chunkY, chunkZ + 1),
  };
}

export function dirtyNeighborChunkKeysForCell(
  address: Pick<ChunkCellAddress, "chunkX" | "chunkY" | "chunkZ" | "localX" | "localY" | "localZ">,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  options?: DirtyNeighborOptions,
): readonly string[] {
  try {
    const normalizedChunkSize = normalizeChunkSize(chunkSize);
    const includeEdges = options?.includeEdges ?? true;
    const includeCorners = options?.includeCorners ?? false;
    const chunkX = safeInteger(address.chunkX, 0);
    const chunkY = safeInteger(address.chunkY, 0);
    const chunkZ = safeInteger(address.chunkZ, 0);
    const localX = clampInteger(address.localX, 0, normalizedChunkSize - 1, 0);
    const localY = clampInteger(address.localY, 0, normalizedChunkSize - 1, 0);
    const localZ = clampInteger(address.localZ, 0, normalizedChunkSize - 1, 0);

    const keys = new Set<string>();
    keys.add(chunkKeyFromCoordinates(chunkX, chunkY, chunkZ));

    const offsets: Array<[number, number, number]> = [];

    if (localX === 0) offsets.push([-1, 0, 0]);
    if (localX === normalizedChunkSize - 1) offsets.push([1, 0, 0]);
    if (localY === 0) offsets.push([0, -1, 0]);
    if (localY === normalizedChunkSize - 1) offsets.push([0, 1, 0]);
    if (localZ === 0) offsets.push([0, 0, -1]);
    if (localZ === normalizedChunkSize - 1) offsets.push([0, 0, 1]);

    if (includeEdges || includeCorners) {
      const xOffsets = [
        localX === 0 ? -1 : null,
        localX === normalizedChunkSize - 1 ? 1 : null,
      ].filter((value): value is number => value !== null);
      const yOffsets = [
        localY === 0 ? -1 : null,
        localY === normalizedChunkSize - 1 ? 1 : null,
      ].filter((value): value is number => value !== null);
      const zOffsets = [
        localZ === 0 ? -1 : null,
        localZ === normalizedChunkSize - 1 ? 1 : null,
      ].filter((value): value is number => value !== null);

      if (includeEdges) {
        for (const dx of xOffsets) {
          for (const dy of yOffsets) {
            offsets.push([dx, dy, 0]);
          }

          for (const dz of zOffsets) {
            offsets.push([dx, 0, dz]);
          }
        }

        for (const dy of yOffsets) {
          for (const dz of zOffsets) {
            offsets.push([0, dy, dz]);
          }
        }
      }

      if (includeCorners) {
        for (const dx of xOffsets) {
          for (const dy of yOffsets) {
            for (const dz of zOffsets) {
              offsets.push([dx, dy, dz]);
            }
          }
        }
      }
    }

    for (const [dx, dy, dz] of offsets) {
      keys.add(chunkKeyFromCoordinates(chunkX + dx, chunkY + dy, chunkZ + dz));
    }

    return sortChunkKeys([...keys]);
  } catch {
    return [chunkKeyFromCoordinates(0, 0, 0)];
  }
}

export function compareChunkCoordinates(
  left: ChunkCoordinates,
  right: ChunkCoordinates,
): number {
  try {
    if (left.chunkY !== right.chunkY) return left.chunkY - right.chunkY;
    if (left.chunkZ !== right.chunkZ) return left.chunkZ - right.chunkZ;
    return left.chunkX - right.chunkX;
  } catch {
    return 0;
  }
}

export function sortChunkKeys(keys: readonly string[]): readonly string[] {
  try {
    return [...keys].sort((left, right) => (
      compareChunkCoordinates(chunkCoordinatesFromKey(left), chunkCoordinatesFromKey(right))
    ));
  } catch {
    return [...keys];
  }
}

export function uniqueChunkKeys(keys: readonly unknown[]): readonly string[] {
  try {
    const seen = new Set<string>();

    for (const key of keys) {
      if (typeof key !== "string") {
        continue;
      }

      const parsed = parseChunkKey(key);

      if (!parsed.valid) {
        continue;
      }

      seen.add(chunkKeyFromCoordinates(parsed.chunkX, parsed.chunkY, parsed.chunkZ));
    }

    return sortChunkKeys([...seen]);
  } catch {
    return [];
  }
}

export function chunkKeyDistanceSquared(
  leftKey: string,
  rightKey: string,
): number {
  try {
    const left = chunkCoordinatesFromKey(leftKey);
    const right = chunkCoordinatesFromKey(rightKey);
    const dx = left.chunkX - right.chunkX;
    const dy = left.chunkY - right.chunkY;
    const dz = left.chunkZ - right.chunkZ;

    return (dx * dx) + (dy * dy) + (dz * dz);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function visibleChunkKeysAround(
  center: ChunkCoordinates,
  radius: number = 1,
  options?: VisibleChunkOptions,
): readonly string[] {
  try {
    const maxRadius = clampInteger(options?.maxRadius, 0, 16, 16);
    const safeRadius = clampInteger(options?.radius ?? radius, 0, maxRadius, 1);
    const includeCenter = options?.includeCenter ?? true;
    const radial = options?.radial ?? false;
    const verticalRadius = clampInteger(
      options?.verticalRadius,
      0,
      safeRadius,
      safeRadius,
    );
    const keys: string[] = [];

    for (let y = center.chunkY - verticalRadius; y <= center.chunkY + verticalRadius; y += 1) {
      for (let z = center.chunkZ - safeRadius; z <= center.chunkZ + safeRadius; z += 1) {
        for (let x = center.chunkX - safeRadius; x <= center.chunkX + safeRadius; x += 1) {
          const offsetX = x - center.chunkX;
          const offsetZ = z - center.chunkZ;

          if (radial && offsetX * offsetX + offsetZ * offsetZ > safeRadius * safeRadius) {
            continue;
          }

          if (!includeCenter && x === center.chunkX && y === center.chunkY && z === center.chunkZ) {
            continue;
          }

          keys.push(chunkKeyFromCoordinates(x, y, z));
        }
      }
    }

    return sortChunkKeys(keys);
  } catch {
    return [chunkKeyFromCoordinates(0, 0, 0)];
  }
}

export function visibleChunkCoordinatesAround(
  center: ChunkCoordinates,
  radius: number = 1,
  options?: VisibleChunkOptions,
): readonly ChunkCoordinates[] {
  return visibleChunkKeysAround(center, radius, options).map((key) => chunkCoordinatesFromKey(key));
}

export function chunkCoordinatesAroundWorldPosition(
  position: ChunkWorldPosition,
  radius: number = 1,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): readonly ChunkCoordinates[] {
  try {
    return visibleChunkCoordinatesAround(worldToChunkCoordinates(position, chunkSize), radius);
  } catch {
    return [
      {
        chunkX: 0,
        chunkY: 0,
        chunkZ: 0,
      },
    ];
  }
}

export function chunkKeysAroundWorldPosition(
  position: ChunkWorldPosition,
  radius: number = 1,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): readonly string[] {
  try {
    return visibleChunkKeysAround(worldToChunkCoordinates(position, chunkSize), radius);
  } catch {
    return [chunkKeyFromCoordinates(0, 0, 0)];
  }
}
