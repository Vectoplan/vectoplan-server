// services/vectoplan-editor/src/frontend/runtime/physics/voxel_collision_solver.ts

import type {
  CollisionFlags,
  CollisionTrace,
  PhysicsAabb,
  PhysicsAxis,
  PhysicsVector3,
} from "./physics_models";

import {
  createCollisionFlags,
  createPhysicsAabb,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  sanitizePhysicsString,
  ZERO_PHYSICS_VECTOR,
} from "./physics_models";

import type {
  AabbAxisMotionLimit,
  AabbCellRef,
} from "./aabb";

import {
  AABB_DEFAULT_EPSILON,
  AABB_DEFAULT_SKIN_WIDTH,
  cloneAabb,
  computeNearestAllowedAxisDelta,
  createCeilingProbeAabb,
  createGroundProbeAabb,
  getAabbAxisMax,
  getAabbAxisMin,
  getAabbCellRange,
  getAabbDebugString,
  isAabbValid,
  overlapsOnOtherAxes,
  translateAabb,
  translateAabbAxis,
  unionAabb,
} from "./aabb";

import type {
  BlockCollisionAabbResult,
  BlockCollisionCellsResult,
  BlockCollisionQuery,
  BlockCollisionQueryCellResult,
} from "./block_collision_query";

/**
 * Voxel collision solver for player/body movement.
 *
 * Version 2 focuses on deterministic axis resolution and on separating real
 * penetration from harmless voxel-face contact.
 *
 * Responsibilities:
 * - resolve movement independently per axis
 * - use a swept query volume so fast movement cannot tunnel through voxels
 * - apply collider skin only on axes perpendicular to the current movement
 * - ignore blockers that are behind the player or are being moved away from
 * - keep floor contact out of X/Z wall resolution
 * - derive grounded/ceiling/wall flags from real probes and blocked movement
 * - fail closed when the collision reader or query contract is unavailable
 *
 * This file does not:
 * - read input devices
 * - apply gravity
 * - toggle flight
 * - mutate camera state
 * - load chunks
 * - perform HTTP calls
 * - cache world collision results
 *
 * Collision results are intentionally not cached because loaded chunks and
 * edited cells can change between consecutive physics steps.
 */

export interface VoxelCollisionQueryLike {
  readonly getBlockingBlockAabbsForAabb: (
    aabb: PhysicsAabb,
    options?: {
      readonly maxCells?: number;
      readonly includeTraceCells?: boolean;
    },
  ) => BlockCollisionAabbResult;

  readonly getCollisionCellsForAabb?: (
    aabb: PhysicsAabb,
    options?: {
      readonly includeAirCells?: boolean;
      readonly stopAtFirstSolid?: boolean;
      readonly includeTraceCells?: boolean;
      readonly maxCells?: number;
    },
  ) => {
    readonly ok?: boolean;
    readonly checkedCellCount: number;
    readonly solidCellCount: number;
    readonly missingCellCount: number;
    readonly cells: readonly BlockCollisionQueryCellResult[];
    readonly solidCells: readonly BlockCollisionQueryCellResult[];
    readonly trace: CollisionTrace;
    readonly warnings: readonly string[];
  };

  readonly hasSolidCollision?: (aabb: PhysicsAabb) => boolean;
}

export interface VoxelCollisionSolverConfig {
  readonly enabled: boolean;
  readonly epsilon: number;
  readonly skinWidth: number;
  readonly maxCellsPerQuery: number;
  readonly includeTraceCells: boolean;
  readonly groundProbeDistance: number;
  readonly ceilingProbeDistance: number;
  readonly axisOrder: readonly PhysicsAxis[];
}

export interface VoxelCollisionSolverConfigPatch {
  readonly enabled?: unknown;
  readonly epsilon?: unknown;
  readonly skinWidth?: unknown;
  readonly maxCellsPerQuery?: unknown;
  readonly includeTraceCells?: unknown;
  readonly groundProbeDistance?: unknown;
  readonly ceilingProbeDistance?: unknown;
  readonly axisOrder?: readonly PhysicsAxis[] | null;
}

export interface VoxelCollisionMoveInput {
  readonly aabb: PhysicsAabb;
  readonly delta: Partial<PhysicsVector3>;
  readonly query: VoxelCollisionQueryLike | BlockCollisionQuery;
  readonly config?: VoxelCollisionSolverConfigPatch | null;
}

export interface VoxelCollisionAxisResult {
  readonly axis: PhysicsAxis;
  readonly requestedDelta: number;
  readonly appliedDelta: number;
  readonly blocked: boolean;
  readonly beforeAabb: PhysicsAabb;
  readonly resolutionAabb: PhysicsAabb;
  readonly queryAabb: PhysicsAabb;
  readonly afterAabb: PhysicsAabb;
  readonly collisionResult: BlockCollisionAabbResult;
  readonly motionLimit: AabbAxisMotionLimit;
  readonly candidateBlockingAabbCount: number;
  readonly relevantBlockingAabbCount: number;
  readonly ignoredBlockingAabbCount: number;
  readonly queryFailed: boolean;
  readonly warnings: readonly string[];
}

export interface VoxelCollisionMoveResult {
  readonly ok: boolean;
  readonly originalAabb: PhysicsAabb;
  readonly finalAabb: PhysicsAabb;
  readonly requestedDelta: PhysicsVector3;
  readonly appliedDelta: PhysicsVector3;
  readonly remainingDelta: PhysicsVector3;
  readonly blockedAxes: readonly PhysicsAxis[];
  readonly axisResults: readonly VoxelCollisionAxisResult[];
  readonly collisionFlags: CollisionFlags;
  readonly groundCheck: VoxelCollisionProbeResult;
  readonly ceilingCheck: VoxelCollisionProbeResult;
  readonly trace: CollisionTrace;
  readonly warnings: readonly string[];
}

export interface VoxelCollisionProbeResult {
  readonly ok: boolean;
  readonly collides: boolean;
  readonly checkedCellCount: number;
  readonly solidCellCount: number;
  readonly missingCellCount: number;
  readonly cells: readonly BlockCollisionQueryCellResult[];
  readonly trace: CollisionTrace;
  readonly warnings: readonly string[];
}

export interface VoxelCollisionSolverSnapshot {
  readonly version: string;
  readonly contractVersion: string;
  readonly config: VoxelCollisionSolverConfig;
  readonly lastResult: VoxelCollisionMoveResult | null;
  readonly lastWarnings: readonly string[];
  readonly moveCount: number;
  readonly blockedMoveCount: number;
  readonly failedMoveCount: number;
  readonly revision: number;
}

export const VOXEL_COLLISION_SOLVER_VERSION = "0.2.0" as const;
export const VOXEL_COLLISION_SOLVER_CONTRACT_VERSION =
  "voxel-collision-solver-contract.v2" as const;

export const DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG: VoxelCollisionSolverConfig = Object.freeze({
  enabled: true,
  epsilon: AABB_DEFAULT_EPSILON,
  skinWidth: AABB_DEFAULT_SKIN_WIDTH,
  maxCellsPerQuery: 262_144,
  includeTraceCells: false,
  groundProbeDistance: 0.04,
  ceilingProbeDistance: 0.04,
  /**
   * Y is resolved first so an existing floor contact is stabilized before
   * horizontal movement is evaluated. The perpendicular-axis skin still keeps
   * floor contact out of X/Z wall checks.
   */
  axisOrder: Object.freeze(["y", "x", "z"] as const),
});

export const EMPTY_VOXEL_COLLISION_TRACE: CollisionTrace = Object.freeze({
  checkedCellCount: 0,
  solidCellCount: 0,
  missingCellCount: 0,
  cells: [],
});

function createWarning(message: string): string {
  try {
    return sanitizePhysicsString(message, "Unknown voxel-collision warning");
  } catch {
    return "Unknown voxel-collision warning";
  }
}

function normalizeAxis(value: unknown): PhysicsAxis | null {
  try {
    if (value === "x" || value === "y" || value === "z") {
      return value;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeAxisOrder(value: readonly PhysicsAxis[] | null | undefined): readonly PhysicsAxis[] {
  try {
    const result: PhysicsAxis[] = [];

    for (const item of value ?? []) {
      const axis = normalizeAxis(item);

      if (axis && !result.includes(axis)) {
        result.push(axis);
      }
    }

    for (const fallbackAxis of DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.axisOrder) {
      if (!result.includes(fallbackAxis)) {
        result.push(fallbackAxis);
      }
    }

    return Object.freeze(result);
  } catch {
    return DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.axisOrder;
  }
}

function getDeltaForAxis(delta: PhysicsVector3, axis: PhysicsAxis): number {
  try {
    return sanitizePhysicsNumber(delta[axis], 0);
  } catch {
    return 0;
  }
}

function setDeltaForAxis(delta: PhysicsVector3, axis: PhysicsAxis, value: number): PhysicsVector3 {
  try {
    if (axis === "x") {
      return {
        x: value,
        y: delta.y,
        z: delta.z,
      };
    }

    if (axis === "y") {
      return {
        x: delta.x,
        y: value,
        z: delta.z,
      };
    }

    return {
      x: delta.x,
      y: delta.y,
      z: value,
    };
  } catch {
    return delta;
  }
}

function addDeltaForAxis(delta: PhysicsVector3, axis: PhysicsAxis, value: number): PhysicsVector3 {
  try {
    return setDeltaForAxis(
      delta,
      axis,
      getDeltaForAxis(delta, axis) + sanitizePhysicsNumber(value, 0),
    );
  } catch {
    return delta;
  }
}

function normalizeMoveDelta(value: Partial<PhysicsVector3> | null | undefined): PhysicsVector3 {
  try {
    return {
      x: sanitizePhysicsNumber(value?.x, 0),
      y: sanitizePhysicsNumber(value?.y, 0),
      z: sanitizePhysicsNumber(value?.z, 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

function normalizeWarningList(
  value: readonly unknown[] | null | undefined,
): readonly string[] {
  try {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const item of value ?? []) {
      const warning = createWarning(String(item ?? "")).trim();

      if (!warning || seen.has(warning)) {
        continue;
      }

      seen.add(warning);
      result.push(warning);
    }

    return result;
  } catch {
    return [];
  }
}

function mergeWarningLists(
  ...values: readonly (readonly unknown[] | null | undefined)[]
): readonly string[] {
  try {
    return normalizeWarningList(
      values.flatMap((value) => Array.from(value ?? [])),
    );
  } catch {
    return [];
  }
}

function createEmptyTrace(): CollisionTrace {
  return {
    checkedCellCount: 0,
    solidCellCount: 0,
    missingCellCount: 0,
    cells: [],
  };
}

function createEmptyCollisionCellsResult(
  aabb: PhysicsAabb,
  warnings: readonly string[] = [],
): BlockCollisionCellsResult {
  try {
    return {
      ok: true,
      range: getAabbCellRange(aabb),
      checkedCellCount: 0,
      solidCellCount: 0,
      missingCellCount: 0,
      cells: [],
      solidCells: [],
      trace: createEmptyTrace(),
      warnings: normalizeWarningList(warnings),
    };
  } catch {
    return {
      ok: true,
      range: {
        minX: 0,
        minY: 0,
        minZ: 0,
        maxX: 0,
        maxY: 0,
        maxZ: 0,
      },
      checkedCellCount: 0,
      solidCellCount: 0,
      missingCellCount: 0,
      cells: [],
      solidCells: [],
      trace: createEmptyTrace(),
      warnings: normalizeWarningList(warnings),
    };
  }
}

function createEmptyCollisionAabbResult(
  aabb: PhysicsAabb,
  warnings: readonly string[] = [],
): BlockCollisionAabbResult {
  return {
    collides: false,
    blockingAabbs: [],
    cellsResult: createEmptyCollisionCellsResult(aabb, warnings),
    candidateSolidCellCount: 0,
    contactOnlyCellCount: 0,
  };
}

function createEmptyProbeResult(
  warnings: readonly string[] = [],
): VoxelCollisionProbeResult {
  try {
    return {
      ok: true,
      collides: false,
      checkedCellCount: 0,
      solidCellCount: 0,
      missingCellCount: 0,
      cells: [],
      trace: createEmptyTrace(),
      warnings: normalizeWarningList(warnings),
    };
  } catch {
    return {
      ok: true,
      collides: false,
      checkedCellCount: 0,
      solidCellCount: 0,
      missingCellCount: 0,
      cells: [],
      trace: createEmptyTrace(),
      warnings: [],
    };
  }
}

function createFailedProbeResult(
  warning: string,
): VoxelCollisionProbeResult {
  const warnings = [createWarning(warning)];

  return {
    ok: false,
    collides: true,
    checkedCellCount: 0,
    solidCellCount: 1,
    missingCellCount: 1,
    cells: [],
    trace: {
      checkedCellCount: 0,
      solidCellCount: 1,
      missingCellCount: 1,
      cells: [],
    },
    warnings,
  };
}

function combineTraces(
  traces: readonly (CollisionTrace | null | undefined)[],
  includeCells: boolean,
): CollisionTrace {
  try {
    let checkedCellCount = 0;
    let solidCellCount = 0;
    let missingCellCount = 0;
    const cells: Array<NonNullable<CollisionTrace["cells"]>[number]> = [];
    const cellKeys = new Set<string>();

    for (const trace of traces) {
      if (!trace) {
        continue;
      }

      checkedCellCount += Math.max(
        0,
        Math.floor(sanitizePhysicsNumber(trace.checkedCellCount, 0)),
      );
      solidCellCount += Math.max(
        0,
        Math.floor(sanitizePhysicsNumber(trace.solidCellCount, 0)),
      );
      missingCellCount += Math.max(
        0,
        Math.floor(sanitizePhysicsNumber(trace.missingCellCount, 0)),
      );

      if (!includeCells || !Array.isArray(trace.cells)) {
        continue;
      }

      for (const cell of trace.cells) {
        const record = cell as unknown as Record<string, unknown>;
        const key = [
          record.worldX ?? record.x ?? "?",
          record.worldY ?? record.y ?? "?",
          record.worldZ ?? record.z ?? "?",
          record.kind ?? "?",
          record.chunkLoaded ?? record.loaded ?? "?",
        ].join(":");

        if (cellKeys.has(key)) {
          continue;
        }

        cellKeys.add(key);
        cells.push(cell);
      }
    }

    return {
      checkedCellCount,
      solidCellCount,
      missingCellCount,
      cells: includeCells ? cells : undefined,
    };
  } catch {
    return {
      ...EMPTY_VOXEL_COLLISION_TRACE,
    };
  }
}

function createFallbackCollisionAabbResult(
  aabb: PhysicsAabb,
  warning: string,
): BlockCollisionAabbResult {
  const safeAabb = cloneAabb(aabb);
  const warnings = [createWarning(warning)];

  return {
    collides: true,
    blockingAabbs: [safeAabb],
    cellsResult: {
      ...createEmptyCollisionCellsResult(safeAabb, warnings),
      ok: false,
      solidCellCount: 1,
      missingCellCount: 1,
      trace: {
        checkedCellCount: 0,
        solidCellCount: 1,
        missingCellCount: 1,
        cells: [],
      },
    },
    candidateSolidCellCount: 1,
    contactOnlyCellCount: 0,
  };
}

function normalizeBlockingAabbResult(
  raw: BlockCollisionAabbResult | null | undefined,
  queryAabb: PhysicsAabb,
): BlockCollisionAabbResult {
  try {
    if (!raw || !raw.cellsResult) {
      return createFallbackCollisionAabbResult(
        queryAabb,
        "Collision query returned no AABB result.",
      );
    }

    const validBlockingAabbs = Array.isArray(raw.blockingAabbs)
      ? raw.blockingAabbs
          .filter((item): item is PhysicsAabb => isAabbValid(item))
          .map((item) => cloneAabb(item))
      : [];

    const cellsResult = raw.cellsResult;
    const warnings = normalizeWarningList(cellsResult.warnings);
    const cells = Array.isArray(cellsResult.cells)
      ? cellsResult.cells
      : [];
    const solidCells = Array.isArray(cellsResult.solidCells)
      ? cellsResult.solidCells
      : [];
    const ok = cellsResult.ok !== false;

    if (!ok) {
      return createFallbackCollisionAabbResult(
        queryAabb,
        warnings[0] ?? "Collision query reported a failed cell scan.",
      );
    }

    if (raw.collides === true && validBlockingAabbs.length === 0) {
      return createFallbackCollisionAabbResult(
        queryAabb,
        warnings[0] ??
          "Collision query reported a collision without blocking AABBs.",
      );
    }

    return {
      ...raw,
      collides: validBlockingAabbs.length > 0,
      blockingAabbs: validBlockingAabbs,
      cellsResult: {
        ...cellsResult,
        ok: true,
        range: cellsResult.range ?? getAabbCellRange(queryAabb),
        checkedCellCount: Math.max(
          0,
          Math.floor(
            sanitizePhysicsNumber(
              cellsResult.checkedCellCount,
              cells.length,
            ),
          ),
        ),
        solidCellCount: Math.max(
          0,
          Math.floor(
            sanitizePhysicsNumber(
              cellsResult.solidCellCount,
              solidCells.length,
            ),
          ),
        ),
        missingCellCount: Math.max(
          0,
          Math.floor(
            sanitizePhysicsNumber(cellsResult.missingCellCount, 0),
          ),
        ),
        cells,
        solidCells,
        trace: cellsResult.trace ?? createEmptyTrace(),
        warnings,
      },
      candidateSolidCellCount:
        sanitizePhysicsNumber(
          raw.candidateSolidCellCount,
          validBlockingAabbs.length,
          { min: 0, max: Number.MAX_SAFE_INTEGER },
        ),
      contactOnlyCellCount:
        sanitizePhysicsNumber(raw.contactOnlyCellCount, 0, {
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
        }),
    };
  } catch (error) {
    return createFallbackCollisionAabbResult(
      queryAabb,
      error instanceof Error
        ? error.message
        : "Collision query result normalization failed.",
    );
  }
}

function safeGetBlockingAabbs(
  query: VoxelCollisionQueryLike,
  aabb: PhysicsAabb,
  config: VoxelCollisionSolverConfig,
): BlockCollisionAabbResult {
  try {
    if (
      !query ||
      typeof query.getBlockingBlockAabbsForAabb !== "function"
    ) {
      return createFallbackCollisionAabbResult(
        aabb,
        "Collision query was unavailable.",
      );
    }

    return normalizeBlockingAabbResult(
      query.getBlockingBlockAabbsForAabb(aabb, {
        maxCells: config.maxCellsPerQuery,
        includeTraceCells: config.includeTraceCells,
      }),
      aabb,
    );
  } catch (error) {
    return createFallbackCollisionAabbResult(
      aabb,
      error instanceof Error
        ? error.message
        : "Collision query failed while collecting blocking AABBs.",
    );
  }
}

function safeProbe(
  query: VoxelCollisionQueryLike,
  probeAabb: PhysicsAabb,
  config: VoxelCollisionSolverConfig,
): VoxelCollisionProbeResult {
  try {
    if (typeof query.getCollisionCellsForAabb === "function") {
      const result = query.getCollisionCellsForAabb(probeAabb, {
        includeAirCells: false,
        stopAtFirstSolid: false,
        includeTraceCells: config.includeTraceCells,
        maxCells: config.maxCellsPerQuery,
      });

      if (!result || result.ok === false) {
        return createFailedProbeResult(
          normalizeWarningList(result?.warnings)[0] ??
            "Collision probe query reported failure.",
        );
      }

      const cells = Array.isArray(result.solidCells)
        ? result.solidCells
        : [];
      const warnings = normalizeWarningList(result.warnings);

      return {
        ok: true,
        collides: cells.length > 0,
        checkedCellCount: Math.max(
          0,
          Math.floor(
            sanitizePhysicsNumber(result.checkedCellCount, 0),
          ),
        ),
        solidCellCount: Math.max(
          0,
          Math.floor(
            sanitizePhysicsNumber(result.solidCellCount, cells.length),
          ),
        ),
        missingCellCount: Math.max(
          0,
          Math.floor(
            sanitizePhysicsNumber(result.missingCellCount, 0),
          ),
        ),
        cells,
        trace: result.trace ?? createEmptyTrace(),
        warnings,
      };
    }

    const blocking = safeGetBlockingAabbs(
      query,
      probeAabb,
      config,
    );

    if (blocking.cellsResult.ok === false) {
      return createFailedProbeResult(
        blocking.cellsResult.warnings[0] ??
          "Collision probe AABB query failed.",
      );
    }

    return {
      ok: true,
      collides: blocking.collides,
      checkedCellCount:
        blocking.cellsResult.checkedCellCount,
      solidCellCount:
        blocking.cellsResult.solidCellCount,
      missingCellCount:
        blocking.cellsResult.missingCellCount,
      cells: blocking.cellsResult.solidCells,
      trace: blocking.cellsResult.trace,
      warnings: normalizeWarningList(
        blocking.cellsResult.warnings,
      ),
    };
  } catch (error) {
    return createFailedProbeResult(
      error instanceof Error
        ? error.message
        : "Collision probe failed.",
    );
  }
}

function axisValue(
  vector: PhysicsVector3,
  axis: PhysicsAxis,
): number {
  return sanitizePhysicsNumber(vector[axis], 0);
}

function createPerpendicularSkinAabb(
  aabb: PhysicsAabb,
  movementAxis: PhysicsAxis,
  skinWidth: unknown,
  epsilon: unknown,
): PhysicsAabb {
  try {
    const safe = cloneAabb(aabb);
    const safeEpsilon = Math.max(
      AABB_DEFAULT_EPSILON,
      sanitizePhysicsNumber(epsilon, AABB_DEFAULT_EPSILON, {
        min: 0,
        max: 0.1,
      }),
    );
    const requestedSkin = Math.max(
      0,
      sanitizePhysicsNumber(
        skinWidth,
        AABB_DEFAULT_SKIN_WIDTH,
        {
          min: 0,
          max: 0.25,
        },
      ),
    );

    const min = { ...safe.min };
    const max = { ...safe.max };

    for (const axis of ["x", "y", "z"] as const) {
      if (axis === movementAxis) {
        continue;
      }

      const size = Math.max(
        0,
        axisValue(max, axis) - axisValue(min, axis),
      );
      const maximumSkin = Math.max(
        0,
        (size - safeEpsilon) / 2,
      );
      const appliedSkin = Math.min(
        requestedSkin,
        maximumSkin,
      );

      min[axis] += appliedSkin;
      max[axis] -= appliedSkin;
    }

    return createPhysicsAabb(min, max);
  } catch {
    return cloneAabb(aabb);
  }
}

function createAxisSweptQueryAabb(
  resolutionAabb: PhysicsAabb,
  axis: PhysicsAxis,
  delta: number,
): PhysicsAabb {
  try {
    return unionAabb(
      resolutionAabb,
      translateAabbAxis(resolutionAabb, axis, delta),
    );
  } catch {
    return cloneAabb(resolutionAabb);
  }
}

function doesBlockOpposeAxisMovement(
  movingAabb: PhysicsAabb,
  blockAabb: PhysicsAabb,
  axis: PhysicsAxis,
  delta: number,
  epsilon: number,
): boolean {
  try {
    if (
      !overlapsOnOtherAxes(
        movingAabb,
        blockAabb,
        axis,
        epsilon,
      )
    ) {
      return false;
    }

    const movingMin = getAabbAxisMin(movingAabb, axis);
    const movingMax = getAabbAxisMax(movingAabb, axis);
    const blockMin = getAabbAxisMin(blockAabb, axis);
    const blockMax = getAabbAxisMax(blockAabb, axis);
    const movingCenter = (movingMin + movingMax) / 2;
    const blockCenter = (blockMin + blockMax) / 2;

    if (delta > 0) {
      if (blockMax <= movingMin + epsilon) {
        return false;
      }

      if (blockMin >= movingMax - epsilon) {
        return true;
      }

      return blockCenter >= movingCenter - epsilon;
    }

    if (delta < 0) {
      if (blockMin >= movingMax - epsilon) {
        return false;
      }

      if (blockMax <= movingMin + epsilon) {
        return true;
      }

      return blockCenter <= movingCenter + epsilon;
    }

    return false;
  } catch {
    return true;
  }
}

function filterRelevantBlockingAabbs(
  movingAabb: PhysicsAabb,
  blockingAabbs: readonly PhysicsAabb[],
  axis: PhysicsAxis,
  delta: number,
  epsilon: number,
): readonly PhysicsAabb[] {
  try {
    return blockingAabbs.filter((blockAabb) =>
      doesBlockOpposeAxisMovement(
        movingAabb,
        blockAabb,
        axis,
        delta,
        epsilon,
      ),
    );
  } catch {
    return [...blockingAabbs];
  }
}


export function createVoxelCollisionSolverConfig(
  patch: VoxelCollisionSolverConfigPatch | null | undefined = undefined,
): VoxelCollisionSolverConfig {
  try {
    return {
      enabled: sanitizePhysicsBoolean(patch?.enabled, DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.enabled),
      epsilon: sanitizePhysicsNumber(patch?.epsilon, DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.epsilon, {
        min: 0,
        max: 0.1,
      }),
      skinWidth: sanitizePhysicsNumber(
        patch?.skinWidth,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.skinWidth,
        {
          min: 0,
          max: 0.25,
        },
      ),
      maxCellsPerQuery: Math.max(
        1,
        Math.floor(
          sanitizePhysicsNumber(
            patch?.maxCellsPerQuery,
            DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.maxCellsPerQuery,
            {
              min: 1,
              max: 262_144,
            },
          ),
        ),
      ),
      includeTraceCells: sanitizePhysicsBoolean(
        patch?.includeTraceCells,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.includeTraceCells,
      ),
      groundProbeDistance: sanitizePhysicsNumber(
        patch?.groundProbeDistance,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.groundProbeDistance,
        {
          min: 0,
          max: 0.5,
        },
      ),
      ceilingProbeDistance: sanitizePhysicsNumber(
        patch?.ceilingProbeDistance,
        DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG.ceilingProbeDistance,
        {
          min: 0,
          max: 0.5,
        },
      ),
      axisOrder: normalizeAxisOrder(patch?.axisOrder),
    };
  } catch {
    return { ...DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG };
  }
}

export function mergeVoxelCollisionSolverConfig(
  base: VoxelCollisionSolverConfig | null | undefined,
  patch: VoxelCollisionSolverConfigPatch | null | undefined,
): VoxelCollisionSolverConfig {
  try {
    return createVoxelCollisionSolverConfig({
      ...(base ?? DEFAULT_VOXEL_COLLISION_SOLVER_CONFIG),
      ...(patch ?? {}),
    });
  } catch {
    return createVoxelCollisionSolverConfig(patch);
  }
}

export function resolveAabbMovementAxis(
  aabb: PhysicsAabb,
  axis: PhysicsAxis,
  requestedDelta: unknown,
  query: VoxelCollisionQueryLike,
  config: VoxelCollisionSolverConfig,
): VoxelCollisionAxisResult {
  const safeAabb = cloneAabb(aabb);
  const delta = sanitizePhysicsNumber(requestedDelta, 0);
  const safeEpsilon = Math.max(
    AABB_DEFAULT_EPSILON,
    sanitizePhysicsNumber(
      config.epsilon,
      AABB_DEFAULT_EPSILON,
      { min: 0, max: 0.1 },
    ),
  );
  const warnings: string[] = [];

  try {
    if (!config.enabled) {
      const afterAabb = translateAabbAxis(
        safeAabb,
        axis,
        delta,
      );
      const collisionResult =
        createEmptyCollisionAabbResult(afterAabb);
      const motionLimit: AabbAxisMotionLimit = {
        axis,
        requestedDelta: delta,
        allowedDelta: delta,
        blocked: false,
        blockingCell: null,
      };

      return {
        axis,
        requestedDelta: delta,
        appliedDelta: delta,
        blocked: false,
        beforeAabb: safeAabb,
        resolutionAabb: safeAabb,
        queryAabb: afterAabb,
        afterAabb,
        collisionResult,
        motionLimit,
        candidateBlockingAabbCount: 0,
        relevantBlockingAabbCount: 0,
        ignoredBlockingAabbCount: 0,
        queryFailed: false,
        warnings,
      };
    }

    if (Math.abs(delta) <= safeEpsilon) {
      const collisionResult =
        createEmptyCollisionAabbResult(safeAabb);
      const motionLimit: AabbAxisMotionLimit = {
        axis,
        requestedDelta: delta,
        allowedDelta: 0,
        blocked: false,
        blockingCell: null,
      };

      return {
        axis,
        requestedDelta: delta,
        appliedDelta: 0,
        blocked: false,
        beforeAabb: safeAabb,
        resolutionAabb: safeAabb,
        queryAabb: safeAabb,
        afterAabb: safeAabb,
        collisionResult,
        motionLimit,
        candidateBlockingAabbCount: 0,
        relevantBlockingAabbCount: 0,
        ignoredBlockingAabbCount: 0,
        queryFailed: false,
        warnings,
      };
    }

    /**
     * Skin is applied only on axes perpendicular to the current movement.
     *
     * Example for X movement:
     * - X extent stays exact so wall distance is resolved correctly.
     * - Y/Z shrink slightly so touching the floor or a neighboring face does
     *   not become an X wall through floating-point drift.
     */
    const resolutionAabb = createPerpendicularSkinAabb(
      safeAabb,
      axis,
      config.skinWidth,
      safeEpsilon,
    );
    const queryAabb = createAxisSweptQueryAabb(
      resolutionAabb,
      axis,
      delta,
    );
    const rawCollisionResult = safeGetBlockingAabbs(
      query,
      queryAabb,
      config,
    );

    warnings.push(
      ...normalizeWarningList(
        rawCollisionResult.cellsResult.warnings,
      ),
    );

    const candidateBlockingAabbs =
      rawCollisionResult.blockingAabbs;
    const relevantBlockingAabbs =
      filterRelevantBlockingAabbs(
        resolutionAabb,
        candidateBlockingAabbs,
        axis,
        delta,
        safeEpsilon,
      );
    const ignoredBlockingAabbCount = Math.max(
      0,
      candidateBlockingAabbs.length -
        relevantBlockingAabbs.length,
    );

    const collisionResult: BlockCollisionAabbResult = {
      ...rawCollisionResult,
      collides: relevantBlockingAabbs.length > 0,
      blockingAabbs: relevantBlockingAabbs,
    };

    const motionLimit = computeNearestAllowedAxisDelta(
      resolutionAabb,
      relevantBlockingAabbs,
      axis,
      delta,
      safeEpsilon,
    );

    const rawAppliedDelta = sanitizePhysicsNumber(
      motionLimit.allowedDelta,
      0,
    );
    const appliedDelta =
      Math.abs(rawAppliedDelta) <= safeEpsilon
        ? 0
        : rawAppliedDelta;
    const shortened =
      Math.abs(appliedDelta - delta) > safeEpsilon;
    const blocked = shortened;
    const afterAabb = translateAabbAxis(
      safeAabb,
      axis,
      appliedDelta,
    );
    const queryFailed =
      rawCollisionResult.cellsResult.ok === false;

    return {
      axis,
      requestedDelta: delta,
      appliedDelta,
      blocked,
      beforeAabb: safeAabb,
      resolutionAabb,
      queryAabb,
      afterAabb,
      collisionResult,
      motionLimit: {
        ...motionLimit,
        allowedDelta: appliedDelta,
        blocked,
      },
      candidateBlockingAabbCount:
        candidateBlockingAabbs.length,
      relevantBlockingAabbCount:
        relevantBlockingAabbs.length,
      ignoredBlockingAabbCount,
      queryFailed,
      warnings: normalizeWarningList(warnings),
    };
  } catch (error) {
    const collisionResult =
      createFallbackCollisionAabbResult(
        safeAabb,
        error instanceof Error
          ? error.message
          : `Collision resolution failed on ${axis}-axis.`,
      );

    return {
      axis,
      requestedDelta: delta,
      appliedDelta: 0,
      blocked: true,
      beforeAabb: safeAabb,
      resolutionAabb: safeAabb,
      queryAabb: safeAabb,
      afterAabb: safeAabb,
      collisionResult,
      motionLimit: {
        axis,
        requestedDelta: delta,
        allowedDelta: 0,
        blocked: true,
        blockingCell: null,
      },
      candidateBlockingAabbCount:
        collisionResult.blockingAabbs.length,
      relevantBlockingAabbCount:
        collisionResult.blockingAabbs.length,
      ignoredBlockingAabbCount: 0,
      queryFailed: true,
      warnings: normalizeWarningList(
        collisionResult.cellsResult.warnings,
      ),
    };
  }
}

export function resolveAabbMovement(
  input: VoxelCollisionMoveInput,
): VoxelCollisionMoveResult {
  try {
    const config = createVoxelCollisionSolverConfig(
      input.config,
    );
    const originalAabb = cloneAabb(input.aabb);
    const requestedDelta = normalizeMoveDelta(input.delta);
    const warnings: string[] = [];

    if (!config.enabled) {
      const finalAabb = translateAabb(
        originalAabb,
        requestedDelta,
      );
      const groundCheck = createEmptyProbeResult();
      const ceilingCheck = createEmptyProbeResult();

      return {
        ok: true,
        originalAabb,
        finalAabb,
        requestedDelta,
        appliedDelta: requestedDelta,
        remainingDelta: { ...ZERO_PHYSICS_VECTOR },
        blockedAxes: [],
        axisResults: [],
        collisionFlags: createCollisionFlags(),
        groundCheck,
        ceilingCheck,
        trace: createEmptyTrace(),
        warnings: [
          createWarning(
            "Voxel collision solver is disabled.",
          ),
        ],
      };
    }

    let currentAabb = originalAabb;
    let appliedDelta = { ...ZERO_PHYSICS_VECTOR };
    const axisResults: VoxelCollisionAxisResult[] = [];
    const blockedAxes: PhysicsAxis[] = [];

    for (const axis of config.axisOrder) {
      const deltaForAxis = getDeltaForAxis(
        requestedDelta,
        axis,
      );
      const axisResult = resolveAabbMovementAxis(
        currentAabb,
        axis,
        deltaForAxis,
        input.query,
        config,
      );

      axisResults.push(axisResult);
      warnings.push(...axisResult.warnings);

      currentAabb = axisResult.afterAabb;
      appliedDelta = addDeltaForAxis(
        appliedDelta,
        axis,
        axisResult.appliedDelta,
      );

      if (
        axisResult.blocked &&
        !blockedAxes.includes(axis)
      ) {
        blockedAxes.push(axis);
      }
    }

    const groundCheck = safeProbe(
      input.query,
      createGroundProbeAabb(
        currentAabb,
        config.groundProbeDistance,
      ),
      config,
    );
    const ceilingCheck = safeProbe(
      input.query,
      createCeilingProbeAabb(
        currentAabb,
        config.ceilingProbeDistance,
      ),
      config,
    );

    warnings.push(
      ...groundCheck.warnings,
      ...ceilingCheck.warnings,
    );

    const movingUp =
      requestedDelta.y > config.epsilon;
    const movingDown =
      requestedDelta.y < -config.epsilon;
    const hitWallX = blockedAxes.includes("x");
    const hitWallZ = blockedAxes.includes("z");
    const hitCeilingFromMovement =
      blockedAxes.includes("y") && movingUp;
    const hitGroundFromMovement =
      blockedAxes.includes("y") && movingDown;

    /**
     * A ground probe only establishes grounded state while the player is not
     * moving upward. This prevents a shallow probe from cancelling the first
     * frame of a jump.
     */
    const grounded =
      hitGroundFromMovement ||
      (!movingUp && groundCheck.collides);
    const hitCeiling =
      hitCeilingFromMovement ||
      (movingUp && ceilingCheck.collides);
    const queryFailed =
      axisResults.some((result) => result.queryFailed) ||
      !groundCheck.ok ||
      !ceilingCheck.ok;
    const blockedByMissingChunk =
      queryFailed ||
      groundCheck.missingCellCount > 0 ||
      ceilingCheck.missingCellCount > 0 ||
      axisResults.some(
        (result) =>
          result.collisionResult.cellsResult
            .missingCellCount > 0,
      );
    const touchedSolid =
      grounded ||
      hitCeiling ||
      hitWallX ||
      hitWallZ ||
      axisResults.some(
        (result) =>
          result.blocked &&
          result.relevantBlockingAabbCount > 0,
      );

    const collisionFlags = createCollisionFlags({
      grounded,
      hitCeiling,
      hitWallX,
      hitWallZ,
      hitHorizontalWall: hitWallX || hitWallZ,
      touchedSolid,
      blockedByMissingChunk,
    });

    const remainingDelta = {
      x:
        Math.abs(requestedDelta.x - appliedDelta.x) <=
        config.epsilon
          ? 0
          : requestedDelta.x - appliedDelta.x,
      y:
        Math.abs(requestedDelta.y - appliedDelta.y) <=
        config.epsilon
          ? 0
          : requestedDelta.y - appliedDelta.y,
      z:
        Math.abs(requestedDelta.z - appliedDelta.z) <=
        config.epsilon
          ? 0
          : requestedDelta.z - appliedDelta.z,
    };

    const trace = combineTraces(
      [
        ...axisResults.map(
          (result) =>
            result.collisionResult.cellsResult.trace,
        ),
        groundCheck.trace,
        ceilingCheck.trace,
      ],
      config.includeTraceCells,
    );

    const normalizedWarnings =
      normalizeWarningList(warnings);

    return {
      ok: !queryFailed,
      originalAabb,
      finalAabb: currentAabb,
      requestedDelta,
      appliedDelta,
      remainingDelta,
      blockedAxes,
      axisResults,
      collisionFlags,
      groundCheck,
      ceilingCheck,
      trace,
      warnings: normalizedWarnings,
    };
  } catch (error) {
    const originalAabb = cloneAabb(input?.aabb);
    const warning = createWarning(
      error instanceof Error
        ? error.message
        : "Voxel collision movement resolution failed.",
    );
    const warnings = [warning];

    return {
      ok: false,
      originalAabb,
      finalAabb: originalAabb,
      requestedDelta: normalizeMoveDelta(input?.delta),
      appliedDelta: { ...ZERO_PHYSICS_VECTOR },
      remainingDelta: normalizeMoveDelta(input?.delta),
      blockedAxes: ["x", "y", "z"],
      axisResults: [],
      collisionFlags: createCollisionFlags({
        grounded: false,
        hitCeiling: true,
        hitWallX: true,
        hitWallZ: true,
        hitHorizontalWall: true,
        touchedSolid: true,
        blockedByMissingChunk: true,
      }),
      groundCheck: createFailedProbeResult(warning),
      ceilingCheck: createFailedProbeResult(warning),
      trace: createEmptyTrace(),
      warnings,
    };
  }
}

export function getAabbBasePositionFromResolvedAabb(
  aabb: PhysicsAabb,
): PhysicsVector3 {
  try {
    const safe = cloneAabb(aabb);

    return {
      x: (safe.min.x + safe.max.x) / 2,
      y: safe.min.y,
      z: (safe.min.z + safe.max.z) / 2,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function createResolvedAabbFromBasePosition(
  basePosition: PhysicsVector3,
  width: unknown,
  height: unknown,
): PhysicsAabb {
  try {
    const safeWidth = Math.max(0.01, sanitizePhysicsNumber(width, 0.6));
    const safeHeight = Math.max(0.01, sanitizePhysicsNumber(height, 1.8));
    const halfWidth = safeWidth / 2;

    return createPhysicsAabb(
      {
        x: sanitizePhysicsNumber(basePosition.x, 0) - halfWidth,
        y: sanitizePhysicsNumber(basePosition.y, 0),
        z: sanitizePhysicsNumber(basePosition.z, 0) - halfWidth,
      },
      {
        x: sanitizePhysicsNumber(basePosition.x, 0) + halfWidth,
        y: sanitizePhysicsNumber(basePosition.y, 0) + safeHeight,
        z: sanitizePhysicsNumber(basePosition.z, 0) + halfWidth,
      },
    );
  } catch {
    return createPhysicsAabb(ZERO_PHYSICS_VECTOR, ZERO_PHYSICS_VECTOR);
  }
}

export function isMovementResultBlocked(
  result: VoxelCollisionMoveResult | null | undefined,
): boolean {
  try {
    return Boolean(result && result.blockedAxes.length > 0);
  } catch {
    return true;
  }
}

export function isMovementResultGrounded(
  result: VoxelCollisionMoveResult | null | undefined,
): boolean {
  try {
    return Boolean(result?.collisionFlags.grounded);
  } catch {
    return false;
  }
}

export function getMovementResultDebugString(
  result: VoxelCollisionMoveResult | null | undefined,
): string {
  try {
    if (!result) {
      return "VoxelCollisionMoveResult(null)";
    }

    return [
      `ok=${result.ok}`,
      `requested=(${result.requestedDelta.x.toFixed(3)},${result.requestedDelta.y.toFixed(3)},${result.requestedDelta.z.toFixed(3)})`,
      `applied=(${result.appliedDelta.x.toFixed(3)},${result.appliedDelta.y.toFixed(3)},${result.appliedDelta.z.toFixed(3)})`,
      `remaining=(${result.remainingDelta.x.toFixed(3)},${result.remainingDelta.y.toFixed(3)},${result.remainingDelta.z.toFixed(3)})`,
      `blocked=${result.blockedAxes.join(",") || "none"}`,
      `grounded=${result.collisionFlags.grounded}`,
      `ceiling=${result.collisionFlags.hitCeiling}`,
      `wall=${Boolean(result.collisionFlags.hitHorizontalWall)}`,
      `missing=${Boolean(result.collisionFlags.blockedByMissingChunk)}`,
      `warnings=${result.warnings.length}`,
      `final=${getAabbDebugString(result.finalAabb)}`,
    ].join(" ");
  } catch {
    return "VoxelCollisionMoveResult(invalid)";
  }
}

export class VoxelCollisionSolver {
  private config: VoxelCollisionSolverConfig;
  private lastResult: VoxelCollisionMoveResult | null;
  private lastWarnings: string[];
  private moveCount: number;
  private blockedMoveCount: number;
  private failedMoveCount: number;
  private revision: number;

  public constructor(
    config:
      | VoxelCollisionSolverConfigPatch
      | null
      | undefined = undefined,
  ) {
    this.config = createVoxelCollisionSolverConfig(config);
    this.lastResult = null;
    this.lastWarnings = [];
    this.moveCount = 0;
    this.blockedMoveCount = 0;
    this.failedMoveCount = 0;
    this.revision = 0;
  }

  public updateConfig(
    config:
      | VoxelCollisionSolverConfigPatch
      | null
      | undefined,
  ): VoxelCollisionSolverConfig {
    try {
      this.config = mergeVoxelCollisionSolverConfig(
        this.config,
        config,
      );
      this.revision += 1;
      return this.config;
    } catch {
      this.config =
        createVoxelCollisionSolverConfig(config);
      this.revision += 1;
      return this.config;
    }
  }

  public getConfig(): VoxelCollisionSolverConfig {
    try {
      return {
        ...this.config,
        axisOrder: [...this.config.axisOrder],
      };
    } catch {
      return createVoxelCollisionSolverConfig();
    }
  }

  public move(
    input: Omit<VoxelCollisionMoveInput, "config"> & {
      readonly config?:
        | VoxelCollisionSolverConfigPatch
        | null;
    },
  ): VoxelCollisionMoveResult {
    let result: VoxelCollisionMoveResult;

    try {
      result = resolveAabbMovement({
        ...input,
        config: mergeVoxelCollisionSolverConfig(
          this.config,
          input.config,
        ),
      });
    } catch {
      result = resolveAabbMovement({
        ...input,
        config: this.config,
      });
    }

    this.lastResult = result;
    this.lastWarnings = [
      ...normalizeWarningList(result.warnings),
    ];
    this.moveCount += 1;

    if (result.blockedAxes.length > 0) {
      this.blockedMoveCount += 1;
    }

    if (!result.ok) {
      this.failedMoveCount += 1;
    }

    this.revision += 1;
    return result;
  }

  public probeGround(
    aabb: PhysicsAabb,
    query: VoxelCollisionQueryLike,
  ): VoxelCollisionProbeResult {
    try {
      return safeProbe(
        query,
        createGroundProbeAabb(
          aabb,
          this.config.groundProbeDistance,
        ),
        this.config,
      );
    } catch {
      return createFailedProbeResult(
        "Ground probe failed.",
      );
    }
  }

  public probeCeiling(
    aabb: PhysicsAabb,
    query: VoxelCollisionQueryLike,
  ): VoxelCollisionProbeResult {
    try {
      return safeProbe(
        query,
        createCeilingProbeAabb(
          aabb,
          this.config.ceilingProbeDistance,
        ),
        this.config,
      );
    } catch {
      return createFailedProbeResult(
        "Ceiling probe failed.",
      );
    }
  }

  public getLastResult():
    | VoxelCollisionMoveResult
    | null {
    try {
      return this.lastResult;
    } catch {
      return null;
    }
  }

  public reset(): void {
    try {
      this.lastResult = null;
      this.lastWarnings = [];
      this.moveCount = 0;
      this.blockedMoveCount = 0;
      this.failedMoveCount = 0;
      this.revision += 1;
    } catch {
      this.lastResult = null;
      this.lastWarnings = [];
      this.moveCount = 0;
      this.blockedMoveCount = 0;
      this.failedMoveCount = 0;
      this.revision = 0;
    }
  }

  public snapshot(): VoxelCollisionSolverSnapshot {
    try {
      return {
        version: VOXEL_COLLISION_SOLVER_VERSION,
        contractVersion:
          VOXEL_COLLISION_SOLVER_CONTRACT_VERSION,
        config: this.getConfig(),
        lastResult: this.lastResult,
        lastWarnings: [...this.lastWarnings],
        moveCount: this.moveCount,
        blockedMoveCount: this.blockedMoveCount,
        failedMoveCount: this.failedMoveCount,
        revision: this.revision,
      };
    } catch {
      return {
        version: VOXEL_COLLISION_SOLVER_VERSION,
        contractVersion:
          VOXEL_COLLISION_SOLVER_CONTRACT_VERSION,
        config: createVoxelCollisionSolverConfig(),
        lastResult: null,
        lastWarnings: [],
        moveCount: 0,
        blockedMoveCount: 0,
        failedMoveCount: 0,
        revision: 0,
      };
    }
  }
}

export function createVoxelCollisionSolver(
  config: VoxelCollisionSolverConfigPatch | null | undefined = undefined,
): VoxelCollisionSolver {
  try {
    return new VoxelCollisionSolver(config);
  } catch {
    return new VoxelCollisionSolver();
  }
}