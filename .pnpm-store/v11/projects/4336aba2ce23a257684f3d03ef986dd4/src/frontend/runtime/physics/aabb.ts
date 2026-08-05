// src/frontend/runtime/physics/aabb.ts

import type {
  PhysicsAabb,
  PhysicsAxis,
  PhysicsScalar,
  PhysicsSign,
  PhysicsVector3,
  PlayerAabbCollider,
} from "./physics_models";

import {
  clonePhysicsVector3,
  createPhysicsAabb,
  createPlayerAabbFromPosition,
  sanitizePhysicsNumber,
  ZERO_PHYSICS_VECTOR,
} from "./physics_models";

/**
 * Axis-aligned bounding box helpers for the VECTOPLAN editor physics runtime.
 *
 * Coordinate convention:
 * - 1 world unit = 1 voxel/block edge length
 * - block at cell (x, y, z) occupies:
 *   [x, x + 1] × [y, y + 1] × [z, z + 1]
 * - player position is the body/base/feet position
 * - player AABB is derived from base position + collider dimensions
 *
 * This module is intentionally independent from:
 * - Three.js
 * - DOM
 * - Store
 * - Chunk registry
 * - Render meshes
 */

export const AABB_DEFAULT_EPSILON = 0.000001;
export const AABB_DEFAULT_SKIN_WIDTH = 0.001;
export const AABB_MAX_CELL_RANGE_SIZE = 128;
export const AABB_MAX_ITERATED_CELLS = 262_144;

export interface AabbSize {
  readonly width: PhysicsScalar;
  readonly height: PhysicsScalar;
  readonly depth: PhysicsScalar;
}

export interface AabbCellRange {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export interface AabbCellRef {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AabbAxisOverlap {
  readonly axis: PhysicsAxis;
  readonly overlaps: boolean;
  readonly amount: PhysicsScalar;
}

export interface AabbIntersectionInfo {
  readonly intersects: boolean;
  readonly overlapX: PhysicsScalar;
  readonly overlapY: PhysicsScalar;
  readonly overlapZ: PhysicsScalar;
}

export interface AabbSweepBounds {
  readonly from: PhysicsAabb;
  readonly to: PhysicsAabb;
  readonly swept: PhysicsAabb;
}

export interface AabbAxisMotionLimit {
  readonly axis: PhysicsAxis;
  readonly requestedDelta: PhysicsScalar;
  readonly allowedDelta: PhysicsScalar;
  readonly blocked: boolean;
  readonly blockingCell?: AabbCellRef | null;
}

function safeFloor(value: unknown, fallback = 0): number {
  try {
    const safe = sanitizePhysicsNumber(value, fallback);
    return Math.floor(safe);
  } catch {
    return fallback;
  }
}

function safeCeil(value: unknown, fallback = 0): number {
  try {
    const safe = sanitizePhysicsNumber(value, fallback);
    return Math.ceil(safe);
  } catch {
    return fallback;
  }
}

function normalizeEpsilon(value: unknown = AABB_DEFAULT_EPSILON): number {
  try {
    return sanitizePhysicsNumber(value, AABB_DEFAULT_EPSILON, {
      min: 0,
      max: 0.1,
    });
  } catch {
    return AABB_DEFAULT_EPSILON;
  }
}

function normalizeSkinWidth(value: unknown = AABB_DEFAULT_SKIN_WIDTH): number {
  try {
    return sanitizePhysicsNumber(value, AABB_DEFAULT_SKIN_WIDTH, {
      min: 0,
      max: 0.25,
    });
  } catch {
    return AABB_DEFAULT_SKIN_WIDTH;
  }
}

function axisValue(vector: PhysicsVector3, axis: PhysicsAxis): number {
  try {
    return sanitizePhysicsNumber(vector[axis], 0);
  } catch {
    return 0;
  }
}

function createVectorWithAxis(
  x: number,
  y: number,
  z: number,
  axis: PhysicsAxis,
  value: number,
): PhysicsVector3 {
  try {
    if (axis === "x") {
      return { x: value, y, z };
    }

    if (axis === "y") {
      return { x, y: value, z };
    }

    return { x, y, z: value };
  } catch {
    return { x, y, z };
  }
}

export function cloneAabb(aabb: PhysicsAabb | null | undefined): PhysicsAabb {
  try {
    if (!aabb) {
      return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
    }

    return createPhysicsAabb(
      clonePhysicsVector3(aabb.min),
      clonePhysicsVector3(aabb.max),
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function createSafeAabb(
  min: Partial<PhysicsVector3> | null | undefined,
  max: Partial<PhysicsVector3> | null | undefined,
): PhysicsAabb {
  try {
    return createPhysicsAabb(
      {
        x: sanitizePhysicsNumber(min?.x, 0),
        y: sanitizePhysicsNumber(min?.y, 0),
        z: sanitizePhysicsNumber(min?.z, 0),
      },
      {
        x: sanitizePhysicsNumber(max?.x, 0),
        y: sanitizePhysicsNumber(max?.y, 0),
        z: sanitizePhysicsNumber(max?.z, 0),
      },
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function createBlockAabb(
  x: unknown,
  y: unknown,
  z: unknown,
): PhysicsAabb {
  try {
    const cellX = safeFloor(x);
    const cellY = safeFloor(y);
    const cellZ = safeFloor(z);

    return createPhysicsAabb(
      {
        x: cellX,
        y: cellY,
        z: cellZ,
      },
      {
        x: cellX + 1,
        y: cellY + 1,
        z: cellZ + 1,
      },
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, {
      x: 1,
      y: 1,
      z: 1,
    });
  }
}

export function createPlayerAabb(
  position: PhysicsVector3,
  collider: PlayerAabbCollider,
): PhysicsAabb {
  try {
    return createPlayerAabbFromPosition(position, collider);
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function createAabbFromCenterAndSize(
  center: PhysicsVector3,
  size: Partial<AabbSize>,
): PhysicsAabb {
  try {
    const safeCenter = clonePhysicsVector3(center);
    const width = Math.max(0, sanitizePhysicsNumber(size.width, 0));
    const height = Math.max(0, sanitizePhysicsNumber(size.height, 0));
    const depth = Math.max(0, sanitizePhysicsNumber(size.depth, 0));

    return createPhysicsAabb(
      {
        x: safeCenter.x - width / 2,
        y: safeCenter.y - height / 2,
        z: safeCenter.z - depth / 2,
      },
      {
        x: safeCenter.x + width / 2,
        y: safeCenter.y + height / 2,
        z: safeCenter.z + depth / 2,
      },
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function getAabbSize(aabb: PhysicsAabb): AabbSize {
  try {
    const safe = cloneAabb(aabb);

    return {
      width: Math.max(0, safe.max.x - safe.min.x),
      height: Math.max(0, safe.max.y - safe.min.y),
      depth: Math.max(0, safe.max.z - safe.min.z),
    };
  } catch {
    return {
      width: 0,
      height: 0,
      depth: 0,
    };
  }
}

export function getAabbCenter(aabb: PhysicsAabb): PhysicsVector3 {
  try {
    const safe = cloneAabb(aabb);

    return {
      x: (safe.min.x + safe.max.x) / 2,
      y: (safe.min.y + safe.max.y) / 2,
      z: (safe.min.z + safe.max.z) / 2,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function getAabbVolume(aabb: PhysicsAabb): number {
  try {
    const size = getAabbSize(aabb);
    return size.width * size.height * size.depth;
  } catch {
    return 0;
  }
}

export function isAabbValid(aabb: PhysicsAabb | null | undefined): boolean {
  try {
    if (!aabb) {
      return false;
    }

    return (
      Number.isFinite(aabb.min.x) &&
      Number.isFinite(aabb.min.y) &&
      Number.isFinite(aabb.min.z) &&
      Number.isFinite(aabb.max.x) &&
      Number.isFinite(aabb.max.y) &&
      Number.isFinite(aabb.max.z) &&
      aabb.max.x >= aabb.min.x &&
      aabb.max.y >= aabb.min.y &&
      aabb.max.z >= aabb.min.z
    );
  } catch {
    return false;
  }
}

export function isAabbEmpty(aabb: PhysicsAabb | null | undefined, epsilon = AABB_DEFAULT_EPSILON): boolean {
  try {
    if (!aabb || !isAabbValid(aabb)) {
      return true;
    }

    const safeEpsilon = normalizeEpsilon(epsilon);
    const size = getAabbSize(aabb);

    return size.width <= safeEpsilon || size.height <= safeEpsilon || size.depth <= safeEpsilon;
  } catch {
    return true;
  }
}

export function translateAabb(
  aabb: PhysicsAabb,
  delta: Partial<PhysicsVector3>,
): PhysicsAabb {
  try {
    const safe = cloneAabb(aabb);
    const dx = sanitizePhysicsNumber(delta.x, 0);
    const dy = sanitizePhysicsNumber(delta.y, 0);
    const dz = sanitizePhysicsNumber(delta.z, 0);

    return createPhysicsAabb(
      {
        x: safe.min.x + dx,
        y: safe.min.y + dy,
        z: safe.min.z + dz,
      },
      {
        x: safe.max.x + dx,
        y: safe.max.y + dy,
        z: safe.max.z + dz,
      },
    );
  } catch {
    return cloneAabb(aabb);
  }
}

export function translateAabbAxis(
  aabb: PhysicsAabb,
  axis: PhysicsAxis,
  delta: unknown,
): PhysicsAabb {
  try {
    const safeDelta = sanitizePhysicsNumber(delta, 0);

    if (axis === "x") {
      return translateAabb(aabb, { x: safeDelta });
    }

    if (axis === "y") {
      return translateAabb(aabb, { y: safeDelta });
    }

    return translateAabb(aabb, { z: safeDelta });
  } catch {
    return cloneAabb(aabb);
  }
}

export function expandAabb(
  aabb: PhysicsAabb,
  amount: unknown,
): PhysicsAabb {
  try {
    const safe = cloneAabb(aabb);
    const expansion = Math.max(0, sanitizePhysicsNumber(amount, 0));

    return createPhysicsAabb(
      {
        x: safe.min.x - expansion,
        y: safe.min.y - expansion,
        z: safe.min.z - expansion,
      },
      {
        x: safe.max.x + expansion,
        y: safe.max.y + expansion,
        z: safe.max.z + expansion,
      },
    );
  } catch {
    return cloneAabb(aabb);
  }
}

export function expandAabbByVector(
  aabb: PhysicsAabb,
  amount: Partial<PhysicsVector3>,
): PhysicsAabb {
  try {
    const safe = cloneAabb(aabb);
    const x = Math.max(0, sanitizePhysicsNumber(amount.x, 0));
    const y = Math.max(0, sanitizePhysicsNumber(amount.y, 0));
    const z = Math.max(0, sanitizePhysicsNumber(amount.z, 0));

    return createPhysicsAabb(
      {
        x: safe.min.x - x,
        y: safe.min.y - y,
        z: safe.min.z - z,
      },
      {
        x: safe.max.x + x,
        y: safe.max.y + y,
        z: safe.max.z + z,
      },
    );
  } catch {
    return cloneAabb(aabb);
  }
}

export function shrinkAabb(
  aabb: PhysicsAabb,
  amount: unknown,
): PhysicsAabb {
  try {
    const safe = cloneAabb(aabb);
    const shrink = Math.max(0, sanitizePhysicsNumber(amount, 0));
    const center = getAabbCenter(safe);

    const min = {
      x: Math.min(center.x, safe.min.x + shrink),
      y: Math.min(center.y, safe.min.y + shrink),
      z: Math.min(center.z, safe.min.z + shrink),
    };

    const max = {
      x: Math.max(center.x, safe.max.x - shrink),
      y: Math.max(center.y, safe.max.y - shrink),
      z: Math.max(center.z, safe.max.z - shrink),
    };

    return createPhysicsAabb(min, max);
  } catch {
    return cloneAabb(aabb);
  }
}

export function applyAabbSkin(
  aabb: PhysicsAabb,
  skinWidth: unknown = AABB_DEFAULT_SKIN_WIDTH,
): PhysicsAabb {
  try {
    return shrinkAabb(aabb, normalizeSkinWidth(skinWidth));
  } catch {
    return cloneAabb(aabb);
  }
}

export function unionAabb(a: PhysicsAabb, b: PhysicsAabb): PhysicsAabb {
  try {
    const safeA = cloneAabb(a);
    const safeB = cloneAabb(b);

    return createPhysicsAabb(
      {
        x: Math.min(safeA.min.x, safeB.min.x),
        y: Math.min(safeA.min.y, safeB.min.y),
        z: Math.min(safeA.min.z, safeB.min.z),
      },
      {
        x: Math.max(safeA.max.x, safeB.max.x),
        y: Math.max(safeA.max.y, safeB.max.y),
        z: Math.max(safeA.max.z, safeB.max.z),
      },
    );
  } catch {
    return cloneAabb(a);
  }
}

export function createSweptAabb(
  aabb: PhysicsAabb,
  delta: Partial<PhysicsVector3>,
): AabbSweepBounds {
  try {
    const from = cloneAabb(aabb);
    const to = translateAabb(from, delta);
    const swept = unionAabb(from, to);

    return {
      from,
      to,
      swept,
    };
  } catch {
    const safe = cloneAabb(aabb);

    return {
      from: safe,
      to: safe,
      swept: safe,
    };
  }
}

export function aabbIntersects(
  a: PhysicsAabb,
  b: PhysicsAabb,
  epsilon = AABB_DEFAULT_EPSILON,
): boolean {
  try {
    const safeA = cloneAabb(a);
    const safeB = cloneAabb(b);
    const safeEpsilon = normalizeEpsilon(epsilon);

    return (
      safeA.min.x < safeB.max.x - safeEpsilon &&
      safeA.max.x > safeB.min.x + safeEpsilon &&
      safeA.min.y < safeB.max.y - safeEpsilon &&
      safeA.max.y > safeB.min.y + safeEpsilon &&
      safeA.min.z < safeB.max.z - safeEpsilon &&
      safeA.max.z > safeB.min.z + safeEpsilon
    );
  } catch {
    return false;
  }
}

export function aabbTouchesOrIntersects(
  a: PhysicsAabb,
  b: PhysicsAabb,
  epsilon = AABB_DEFAULT_EPSILON,
): boolean {
  try {
    const safeA = cloneAabb(a);
    const safeB = cloneAabb(b);
    const safeEpsilon = normalizeEpsilon(epsilon);

    return (
      safeA.min.x <= safeB.max.x + safeEpsilon &&
      safeA.max.x >= safeB.min.x - safeEpsilon &&
      safeA.min.y <= safeB.max.y + safeEpsilon &&
      safeA.max.y >= safeB.min.y - safeEpsilon &&
      safeA.min.z <= safeB.max.z + safeEpsilon &&
      safeA.max.z >= safeB.min.z - safeEpsilon
    );
  } catch {
    return false;
  }
}

export function getAabbIntersectionInfo(
  a: PhysicsAabb,
  b: PhysicsAabb,
  epsilon = AABB_DEFAULT_EPSILON,
): AabbIntersectionInfo {
  try {
    const safeA = cloneAabb(a);
    const safeB = cloneAabb(b);
    const safeEpsilon = normalizeEpsilon(epsilon);

    const overlapX = Math.min(safeA.max.x, safeB.max.x) - Math.max(safeA.min.x, safeB.min.x);
    const overlapY = Math.min(safeA.max.y, safeB.max.y) - Math.max(safeA.min.y, safeB.min.y);
    const overlapZ = Math.min(safeA.max.z, safeB.max.z) - Math.max(safeA.min.z, safeB.min.z);

    return {
      intersects: overlapX > safeEpsilon && overlapY > safeEpsilon && overlapZ > safeEpsilon,
      overlapX: Math.max(0, overlapX),
      overlapY: Math.max(0, overlapY),
      overlapZ: Math.max(0, overlapZ),
    };
  } catch {
    return {
      intersects: false,
      overlapX: 0,
      overlapY: 0,
      overlapZ: 0,
    };
  }
}

export function getAabbAxisOverlap(
  a: PhysicsAabb,
  b: PhysicsAabb,
  axis: PhysicsAxis,
  epsilon = AABB_DEFAULT_EPSILON,
): AabbAxisOverlap {
  try {
    const safeA = cloneAabb(a);
    const safeB = cloneAabb(b);
    const safeEpsilon = normalizeEpsilon(epsilon);

    const min = Math.max(axisValue(safeA.min, axis), axisValue(safeB.min, axis));
    const max = Math.min(axisValue(safeA.max, axis), axisValue(safeB.max, axis));
    const amount = Math.max(0, max - min);

    return {
      axis,
      overlaps: amount > safeEpsilon,
      amount,
    };
  } catch {
    return {
      axis,
      overlaps: false,
      amount: 0,
    };
  }
}

export function aabbContainsPoint(
  aabb: PhysicsAabb,
  point: PhysicsVector3,
  epsilon = AABB_DEFAULT_EPSILON,
): boolean {
  try {
    const safe = cloneAabb(aabb);
    const safePoint = clonePhysicsVector3(point);
    const safeEpsilon = normalizeEpsilon(epsilon);

    return (
      safePoint.x >= safe.min.x - safeEpsilon &&
      safePoint.x <= safe.max.x + safeEpsilon &&
      safePoint.y >= safe.min.y - safeEpsilon &&
      safePoint.y <= safe.max.y + safeEpsilon &&
      safePoint.z >= safe.min.z - safeEpsilon &&
      safePoint.z <= safe.max.z + safeEpsilon
    );
  } catch {
    return false;
  }
}

export function getAabbCellRange(
  aabb: PhysicsAabb,
  epsilon = AABB_DEFAULT_EPSILON,
): AabbCellRange {
  try {
    const safe = cloneAabb(aabb);
    const safeEpsilon = normalizeEpsilon(epsilon);

    /**
     * max uses (max - epsilon), so an AABB ending exactly at x=2.0 does not
     * include cell 2. This prevents treating face-touching as penetration.
     */
    const minX = safeFloor(safe.min.x);
    const minY = safeFloor(safe.min.y);
    const minZ = safeFloor(safe.min.z);

    const maxX = safeFloor(safe.max.x - safeEpsilon);
    const maxY = safeFloor(safe.max.y - safeEpsilon);
    const maxZ = safeFloor(safe.max.z - safeEpsilon);

    return normalizeAabbCellRange({
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
    });
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

export function getSweptAabbCellRange(
  aabb: PhysicsAabb,
  delta: Partial<PhysicsVector3>,
  epsilon = AABB_DEFAULT_EPSILON,
): AabbCellRange {
  try {
    const swept = createSweptAabb(aabb, delta);
    return getAabbCellRange(swept.swept, epsilon);
  } catch {
    return getAabbCellRange(aabb, epsilon);
  }
}

export function normalizeAabbCellRange(range: AabbCellRange): AabbCellRange {
  try {
    const minX = safeFloor(Math.min(range.minX, range.maxX));
    const minY = safeFloor(Math.min(range.minY, range.maxY));
    const minZ = safeFloor(Math.min(range.minZ, range.maxZ));
    const maxX = safeFloor(Math.max(range.minX, range.maxX));
    const maxY = safeFloor(Math.max(range.minY, range.maxY));
    const maxZ = safeFloor(Math.max(range.minZ, range.maxZ));

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

export function getAabbCellRangeSize(range: AabbCellRange): {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly cellCount: number;
} {
  try {
    const safe = normalizeAabbCellRange(range);
    const sizeX = safe.maxX - safe.minX + 1;
    const sizeY = safe.maxY - safe.minY + 1;
    const sizeZ = safe.maxZ - safe.minZ + 1;
    const cellCount = Math.max(0, sizeX * sizeY * sizeZ);

    return {
      sizeX,
      sizeY,
      sizeZ,
      cellCount,
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

export function isAabbCellRangeReasonable(
  range: AabbCellRange,
  maxCells = AABB_MAX_ITERATED_CELLS,
): boolean {
  try {
    const size = getAabbCellRangeSize(range);
    const safeMaxCells = Math.max(1, Math.floor(sanitizePhysicsNumber(maxCells, AABB_MAX_ITERATED_CELLS)));

    return (
      size.sizeX >= 0 &&
      size.sizeY >= 0 &&
      size.sizeZ >= 0 &&
      size.sizeX <= AABB_MAX_CELL_RANGE_SIZE &&
      size.sizeY <= AABB_MAX_CELL_RANGE_SIZE &&
      size.sizeZ <= AABB_MAX_CELL_RANGE_SIZE &&
      size.cellCount <= safeMaxCells
    );
  } catch {
    return false;
  }
}

export function forEachCellInAabbRange(
  range: AabbCellRange,
  callback: (cell: AabbCellRef) => boolean | void,
  maxCells = AABB_MAX_ITERATED_CELLS,
): {
  readonly completed: boolean;
  readonly visited: number;
  readonly aborted: boolean;
} {
  try {
    const safe = normalizeAabbCellRange(range);
    const safeMaxCells = Math.max(1, Math.floor(sanitizePhysicsNumber(maxCells, AABB_MAX_ITERATED_CELLS)));
    let visited = 0;

    for (let y = safe.minY; y <= safe.maxY; y += 1) {
      for (let z = safe.minZ; z <= safe.maxZ; z += 1) {
        for (let x = safe.minX; x <= safe.maxX; x += 1) {
          visited += 1;

          if (visited > safeMaxCells) {
            return {
              completed: false,
              visited,
              aborted: true,
            };
          }

          const shouldContinue = callback({ x, y, z });

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

export function collectCellsInAabbRange(
  range: AabbCellRange,
  maxCells = AABB_MAX_ITERATED_CELLS,
): readonly AabbCellRef[] {
  try {
    const cells: AabbCellRef[] = [];

    forEachCellInAabbRange(
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

export function createAabbFromCellRange(range: AabbCellRange): PhysicsAabb {
  try {
    const safe = normalizeAabbCellRange(range);

    return createPhysicsAabb(
      {
        x: safe.minX,
        y: safe.minY,
        z: safe.minZ,
      },
      {
        x: safe.maxX + 1,
        y: safe.maxY + 1,
        z: safe.maxZ + 1,
      },
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function signFromDelta(delta: unknown): PhysicsSign {
  try {
    const safe = sanitizePhysicsNumber(delta, 0);

    if (safe > 0) {
      return 1;
    }

    if (safe < 0) {
      return -1;
    }

    return 0;
  } catch {
    return 0;
  }
}

export function getAabbAxisMin(aabb: PhysicsAabb, axis: PhysicsAxis): number {
  try {
    return axisValue(cloneAabb(aabb).min, axis);
  } catch {
    return 0;
  }
}

export function getAabbAxisMax(aabb: PhysicsAabb, axis: PhysicsAxis): number {
  try {
    return axisValue(cloneAabb(aabb).max, axis);
  } catch {
    return 0;
  }
}

export function setAabbAxisMinMax(
  aabb: PhysicsAabb,
  axis: PhysicsAxis,
  min: unknown,
  max: unknown,
): PhysicsAabb {
  try {
    const safe = cloneAabb(aabb);
    const safeMin = sanitizePhysicsNumber(min, getAabbAxisMin(safe, axis));
    const safeMax = sanitizePhysicsNumber(max, getAabbAxisMax(safe, axis));

    const nextMin = createVectorWithAxis(
      safe.min.x,
      safe.min.y,
      safe.min.z,
      axis,
      Math.min(safeMin, safeMax),
    );

    const nextMax = createVectorWithAxis(
      safe.max.x,
      safe.max.y,
      safe.max.z,
      axis,
      Math.max(safeMin, safeMax),
    );

    return createPhysicsAabb(nextMin, nextMax);
  } catch {
    return cloneAabb(aabb);
  }
}

export function overlapsOnOtherAxes(
  a: PhysicsAabb,
  b: PhysicsAabb,
  axis: PhysicsAxis,
  epsilon = AABB_DEFAULT_EPSILON,
): boolean {
  try {
    const safeA = cloneAabb(a);
    const safeB = cloneAabb(b);
    const safeEpsilon = normalizeEpsilon(epsilon);

    if (axis !== "x") {
      const overlapX =
        safeA.min.x < safeB.max.x - safeEpsilon &&
        safeA.max.x > safeB.min.x + safeEpsilon;

      if (!overlapX) {
        return false;
      }
    }

    if (axis !== "y") {
      const overlapY =
        safeA.min.y < safeB.max.y - safeEpsilon &&
        safeA.max.y > safeB.min.y + safeEpsilon;

      if (!overlapY) {
        return false;
      }
    }

    if (axis !== "z") {
      const overlapZ =
        safeA.min.z < safeB.max.z - safeEpsilon &&
        safeA.max.z > safeB.min.z + safeEpsilon;

      if (!overlapZ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function computeAllowedAxisDeltaAgainstBlock(
  movingAabb: PhysicsAabb,
  blockAabb: PhysicsAabb,
  axis: PhysicsAxis,
  requestedDelta: unknown,
  epsilon = AABB_DEFAULT_EPSILON,
): PhysicsScalar {
  try {
    const delta = sanitizePhysicsNumber(requestedDelta, 0);

    if (delta === 0) {
      return 0;
    }

    const safeMoving = cloneAabb(movingAabb);
    const safeBlock = cloneAabb(blockAabb);
    const safeEpsilon = normalizeEpsilon(epsilon);

    if (!overlapsOnOtherAxes(safeMoving, safeBlock, axis, safeEpsilon)) {
      return delta;
    }

    if (delta > 0) {
      const movingMax = getAabbAxisMax(safeMoving, axis);
      const blockMin = getAabbAxisMin(safeBlock, axis);

      if (movingMax <= blockMin + safeEpsilon) {
        return Math.min(delta, Math.max(0, blockMin - movingMax));
      }

      return 0;
    }

    const movingMin = getAabbAxisMin(safeMoving, axis);
    const blockMax = getAabbAxisMax(safeBlock, axis);

    if (movingMin >= blockMax - safeEpsilon) {
      return Math.max(delta, Math.min(0, blockMax - movingMin));
    }

    return 0;
  } catch {
    return 0;
  }
}

export function computeNearestAllowedAxisDelta(
  movingAabb: PhysicsAabb,
  blockingAabbs: readonly PhysicsAabb[],
  axis: PhysicsAxis,
  requestedDelta: unknown,
  epsilon = AABB_DEFAULT_EPSILON,
): AabbAxisMotionLimit {
  try {
    const delta = sanitizePhysicsNumber(requestedDelta, 0);

    if (delta === 0) {
      return {
        axis,
        requestedDelta: 0,
        allowedDelta: 0,
        blocked: false,
        blockingCell: null,
      };
    }

    let allowedDelta = delta;
    let blocked = false;

    for (const block of blockingAabbs) {
      const candidate = computeAllowedAxisDeltaAgainstBlock(
        movingAabb,
        block,
        axis,
        allowedDelta,
        epsilon,
      );

      if (Math.abs(candidate) < Math.abs(allowedDelta)) {
        allowedDelta = candidate;
        blocked = true;
      }

      if (allowedDelta === 0) {
        break;
      }
    }

    return {
      axis,
      requestedDelta: delta,
      allowedDelta,
      blocked,
      blockingCell: null,
    };
  } catch {
    return {
      axis,
      requestedDelta: sanitizePhysicsNumber(requestedDelta, 0),
      allowedDelta: 0,
      blocked: true,
      blockingCell: null,
    };
  }
}

export function isAabbStandingOnBlock(
  playerAabb: PhysicsAabb,
  blockAabb: PhysicsAabb,
  epsilon = AABB_DEFAULT_EPSILON,
): boolean {
  try {
    const safePlayer = cloneAabb(playerAabb);
    const safeBlock = cloneAabb(blockAabb);
    const safeEpsilon = normalizeEpsilon(epsilon);

    const verticalTouch = Math.abs(safePlayer.min.y - safeBlock.max.y) <= safeEpsilon;
    const horizontalOverlap =
      safePlayer.min.x < safeBlock.max.x - safeEpsilon &&
      safePlayer.max.x > safeBlock.min.x + safeEpsilon &&
      safePlayer.min.z < safeBlock.max.z - safeEpsilon &&
      safePlayer.max.z > safeBlock.min.z + safeEpsilon;

    return verticalTouch && horizontalOverlap;
  } catch {
    return false;
  }
}

export function isAabbBlockedAboveByBlock(
  playerAabb: PhysicsAabb,
  blockAabb: PhysicsAabb,
  epsilon = AABB_DEFAULT_EPSILON,
): boolean {
  try {
    const safePlayer = cloneAabb(playerAabb);
    const safeBlock = cloneAabb(blockAabb);
    const safeEpsilon = normalizeEpsilon(epsilon);

    const verticalTouch = Math.abs(safePlayer.max.y - safeBlock.min.y) <= safeEpsilon;
    const horizontalOverlap =
      safePlayer.min.x < safeBlock.max.x - safeEpsilon &&
      safePlayer.max.x > safeBlock.min.x + safeEpsilon &&
      safePlayer.min.z < safeBlock.max.z - safeEpsilon &&
      safePlayer.max.z > safeBlock.min.z + safeEpsilon;

    return verticalTouch && horizontalOverlap;
  } catch {
    return false;
  }
}

export function createGroundProbeAabb(
  playerAabb: PhysicsAabb,
  distance = AABB_DEFAULT_SKIN_WIDTH,
): PhysicsAabb {
  try {
    const safe = cloneAabb(playerAabb);
    const probeDistance = sanitizePhysicsNumber(distance, AABB_DEFAULT_SKIN_WIDTH, {
      min: 0,
      max: 1,
    });

    return createPhysicsAabb(
      {
        x: safe.min.x,
        y: safe.min.y - probeDistance,
        z: safe.min.z,
      },
      {
        x: safe.max.x,
        y: safe.min.y,
        z: safe.max.z,
      },
    );
  } catch {
    return cloneAabb(playerAabb);
  }
}

export function createCeilingProbeAabb(
  playerAabb: PhysicsAabb,
  distance = AABB_DEFAULT_SKIN_WIDTH,
): PhysicsAabb {
  try {
    const safe = cloneAabb(playerAabb);
    const probeDistance = sanitizePhysicsNumber(distance, AABB_DEFAULT_SKIN_WIDTH, {
      min: 0,
      max: 1,
    });

    return createPhysicsAabb(
      {
        x: safe.min.x,
        y: safe.max.y,
        z: safe.min.z,
      },
      {
        x: safe.max.x,
        y: safe.max.y + probeDistance,
        z: safe.max.z,
      },
    );
  } catch {
    return cloneAabb(playerAabb);
  }
}

export function getAabbDebugString(aabb: PhysicsAabb): string {
  try {
    const safe = cloneAabb(aabb);

    return `AABB(min=${safe.min.x.toFixed(3)},${safe.min.y.toFixed(3)},${safe.min.z.toFixed(3)} max=${safe.max.x.toFixed(3)},${safe.max.y.toFixed(3)},${safe.max.z.toFixed(3)})`;
  } catch {
    return "AABB(invalid)";
  }
}