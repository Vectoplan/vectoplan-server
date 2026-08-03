// services/vectoplan-editor/src/frontend/targeting/raycast.ts
import type { RuntimeCellSample } from "@runtime/world/chunk_content";
import {
  createChunkCellAddress,
  type ChunkCellAddress,
  type ChunkWorldPosition,
} from "@runtime/world/chunk_coordinates";
import type { ChunkRegistryHandle } from "@runtime/world/chunk_registry";
import { normalizeUnknownError, safeBoolean, safeInteger, safeNumber } from "@utils/safe";
import {
  createDefaultRaycastOptions,
  createEmptyRaycastHit,
  createRaycastHit,
  createTargetRay,
  normalToTargetFace,
  targetFaceToNormal,
  type TargetFace,
  type TargetRay,
  type TargetRaycastHit,
  type TargetRaycastOptions,
  type TargetSource,
  type TargetVector3,
} from "./target_models";

export interface RaycastSamplerResult extends RuntimeCellSample {
  readonly chunkLoaded?: boolean;
}

export type RaycastCellSampler = (
  position: ChunkWorldPosition,
  address: ChunkCellAddress,
) => RaycastSamplerResult | RuntimeCellSample | null;

export interface VoxelRaycastInput {
  readonly ray: TargetRay;
  readonly sampler: RaycastCellSampler;
  readonly options?: Partial<TargetRaycastOptions>;
  readonly chunkSize?: number;
}

export interface CreateRayInput {
  readonly origin: TargetVector3;
  readonly direction: TargetVector3;
  readonly maxDistance?: number;
}

export interface RayStepState {
  readonly cellX: number;
  readonly cellY: number;
  readonly cellZ: number;
  readonly distance: number;
  readonly normal: TargetVector3;
  readonly face: TargetFace;
}

export interface RaycastDebugStep {
  readonly stepIndex: number;
  readonly cellX: number;
  readonly cellY: number;
  readonly cellZ: number;
  readonly distance: number;
  readonly chunkKey: string;
  readonly hit: boolean;
  readonly cellValue: number | null;
  readonly blockTypeId: string | null;
  readonly reason: string | null;
}

export interface DebugVoxelRaycastResult {
  readonly hit: TargetRaycastHit;
  readonly steps: readonly RaycastDebugStep[];
  readonly error: Record<string, unknown> | null;
}

const EPSILON = 0.000001;
const INFINITY = Number.POSITIVE_INFINITY;
const DEFAULT_CHUNK_SIZE = 16;

function normalizeChunkSize(value: unknown): number {
  return safeInteger(value, DEFAULT_CHUNK_SIZE, {
    min: 1,
    max: 512,
  });
}

function normalizeMaxSteps(value: unknown): number {
  return safeInteger(value, 256, {
    min: 1,
    max: 20_000,
  });
}

function normalizeStepSize(value: unknown): number {
  return safeNumber(value, 0.08, {
    min: 0.001,
    max: 10,
  });
}

function normalizeMaxDistance(value: unknown): number {
  return safeNumber(value, 8, {
    min: 0.01,
    max: 512,
  });
}

function normalizeVector3(value: unknown, fallback: TargetVector3): TargetVector3 {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return fallback;
    }

    const record = value as Record<string, unknown>;

    return {
      x: safeNumber(record.x, fallback.x),
      y: safeNumber(record.y, fallback.y),
      z: safeNumber(record.z, fallback.z),
    };
  } catch {
    return fallback;
  }
}

function vectorLength(value: TargetVector3): number {
  try {
    return Math.hypot(value.x, value.y, value.z);
  } catch {
    return 0;
  }
}

function normalizeDirection(direction: TargetVector3): TargetVector3 {
  try {
    const length = vectorLength(direction);

    if (!Number.isFinite(length) || length <= EPSILON) {
      return {
        x: 0,
        y: 0,
        z: -1,
      };
    }

    return {
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length,
    };
  } catch {
    return {
      x: 0,
      y: 0,
      z: -1,
    };
  }
}

function pointAtDistance(ray: TargetRay, distance: number): TargetVector3 {
  try {
    return {
      x: ray.origin.x + (ray.direction.x * distance),
      y: ray.origin.y + (ray.direction.y * distance),
      z: ray.origin.z + (ray.direction.z * distance),
    };
  } catch {
    return ray.origin;
  }
}

function floorCell(value: unknown): number {
  try {
    return Math.floor(safeNumber(value, 0));
  } catch {
    return 0;
  }
}

function sign(value: number): number {
  if (value > EPSILON) return 1;
  if (value < -EPSILON) return -1;
  return 0;
}

function tDelta(direction: number): number {
  try {
    const absolute = Math.abs(direction);

    if (absolute <= EPSILON) {
      return INFINITY;
    }

    return 1 / absolute;
  } catch {
    return INFINITY;
  }
}

function initialTMax(originCoordinate: number, cellCoordinate: number, direction: number, step: number): number {
  try {
    if (step === 0 || Math.abs(direction) <= EPSILON) {
      return INFINITY;
    }

    const nextBoundary = step > 0 ? cellCoordinate + 1 : cellCoordinate;
    const value = (nextBoundary - originCoordinate) / direction;

    if (!Number.isFinite(value)) {
      return INFINITY;
    }

    return Math.max(0, value);
  } catch {
    return INFINITY;
  }
}

function normalForStep(axis: "x" | "y" | "z", step: number): TargetVector3 {
  try {
    if (axis === "x") {
      return {
        x: -step,
        y: 0,
        z: 0,
      };
    }

    if (axis === "y") {
      return {
        x: 0,
        y: -step,
        z: 0,
      };
    }

    return {
      x: 0,
      y: 0,
      z: -step,
    };
  } catch {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }
}

function shouldHitSample(sample: RaycastSamplerResult | RuntimeCellSample | null, includeAir: boolean): boolean {
  try {
    if (!sample) {
      return false;
    }

    if (sample.exists !== true) {
      return false;
    }

    if (includeAir) {
      return true;
    }

    return sample.air !== true && sample.cellValue > 0;
  } catch {
    return false;
  }
}

function reasonForMiss(input: {
  readonly maxDistance: number;
  readonly maxSteps: number;
  readonly lastDistance: number;
  readonly lastStepIndex: number;
  readonly sawMissingChunk: boolean;
}): string {
  if (input.sawMissingChunk) {
    return "Ray left loaded chunk data before hitting a block.";
  }

  if (input.lastStepIndex >= input.maxSteps) {
    return `Raycast reached maxSteps=${input.maxSteps}.`;
  }

  if (input.lastDistance >= input.maxDistance) {
    return `Raycast reached maxDistance=${input.maxDistance}.`;
  }

  return "Raycast did not hit a block.";
}

function createAddressFromCell(
  cellX: number,
  cellY: number,
  cellZ: number,
  chunkSize: number,
): ChunkCellAddress {
  return createChunkCellAddress({
    worldX: cellX,
    worldY: cellY,
    worldZ: cellZ,
    chunkSize,
  });
}

function sampleSafely(
  sampler: RaycastCellSampler,
  address: ChunkCellAddress,
): RaycastSamplerResult | RuntimeCellSample | null {
  try {
    return sampler(
      {
        x: address.worldX,
        y: address.worldY,
        z: address.worldZ,
      },
      address,
    );
  } catch {
    return null;
  }
}

function buildDebugStep(input: {
  readonly stepIndex: number;
  readonly address: ChunkCellAddress;
  readonly distance: number;
  readonly sample: RaycastSamplerResult | RuntimeCellSample | null;
  readonly hit: boolean;
  readonly reason?: string | null;
}): RaycastDebugStep {
  return {
    stepIndex: input.stepIndex,
    cellX: input.address.worldX,
    cellY: input.address.worldY,
    cellZ: input.address.worldZ,
    distance: input.distance,
    chunkKey: input.address.chunkKey,
    hit: input.hit,
    cellValue: input.sample?.cellValue ?? null,
    blockTypeId: input.sample?.blockTypeId ?? null,
    reason: input.reason ?? null,
  };
}

function stepRay(input: {
  readonly state: RayStepState;
  readonly tMaxX: number;
  readonly tMaxY: number;
  readonly tMaxZ: number;
  readonly tDeltaX: number;
  readonly tDeltaY: number;
  readonly tDeltaZ: number;
  readonly stepX: number;
  readonly stepY: number;
  readonly stepZ: number;
}): {
  readonly nextState: RayStepState;
  readonly tMaxX: number;
  readonly tMaxY: number;
  readonly tMaxZ: number;
} {
  let {
    tMaxX,
    tMaxY,
    tMaxZ,
  } = input;

  let cellX = input.state.cellX;
  let cellY = input.state.cellY;
  let cellZ = input.state.cellZ;
  let distance = input.state.distance;
  let normal = input.state.normal;

  if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
    cellX += input.stepX;
    distance = tMaxX;
    tMaxX += input.tDeltaX;
    normal = normalForStep("x", input.stepX);
  } else if (tMaxY <= tMaxX && tMaxY <= tMaxZ) {
    cellY += input.stepY;
    distance = tMaxY;
    tMaxY += input.tDeltaY;
    normal = normalForStep("y", input.stepY);
  } else {
    cellZ += input.stepZ;
    distance = tMaxZ;
    tMaxZ += input.tDeltaZ;
    normal = normalForStep("z", input.stepZ);
  }

  const face = normalToTargetFace(normal);

  return {
    nextState: {
      cellX,
      cellY,
      cellZ,
      distance,
      normal,
      face,
    },
    tMaxX,
    tMaxY,
    tMaxZ,
  };
}

export function createRay(input: CreateRayInput): TargetRay {
  return createTargetRay({
    origin: normalizeVector3(input.origin, {
      x: 0,
      y: 0,
      z: 0,
    }),
    direction: normalizeDirection(
      normalizeVector3(input.direction, {
        x: 0,
        y: 0,
        z: -1,
      }),
    ),
    maxDistance: normalizeMaxDistance(input.maxDistance),
  });
}

export function createRayFromCameraLike(input: {
  readonly position: TargetVector3;
  readonly forward: TargetVector3;
  readonly maxDistance?: number;
}): TargetRay {
  return createRay({
    origin: input.position,
    direction: input.forward,
    maxDistance: input.maxDistance,
  });
}

export function createRegistryRaycastSampler(registry: Pick<ChunkRegistryHandle, "sampleCellByWorldPosition">): RaycastCellSampler {
  return (position: ChunkWorldPosition): RaycastSamplerResult | RuntimeCellSample | null => {
    try {
      return registry.sampleCellByWorldPosition(position);
    } catch {
      return null;
    }
  };
}

export function raycastVoxels(input: VoxelRaycastInput): TargetRaycastHit {
  return debugRaycastVoxels(input).hit;
}

export function debugRaycastVoxels(input: VoxelRaycastInput): DebugVoxelRaycastResult {
  const debugSteps: RaycastDebugStep[] = [];

  try {
    const options = createDefaultRaycastOptions(input.options);
    const ray = createRay({
      origin: input.ray.origin,
      direction: input.ray.direction,
      maxDistance: input.ray.maxDistance,
    });
    const chunkSize = normalizeChunkSize(input.chunkSize);
    const includeAir = safeBoolean(options.includeAir, false);
    const maxDistance = normalizeMaxDistance(options.maxDistance ?? ray.maxDistance);
    const maxSteps = Math.min(
      normalizeMaxSteps(options.maxSteps),
      Math.max(1, Math.ceil(maxDistance / normalizeStepSize(options.stepSize)) + 8),
    );

    const direction = normalizeDirection(ray.direction);
    const stepX = sign(direction.x);
    const stepY = sign(direction.y);
    const stepZ = sign(direction.z);

    if (stepX === 0 && stepY === 0 && stepZ === 0) {
      return {
        hit: createEmptyRaycastHit("Ray direction was zero."),
        steps: debugSteps,
        error: null,
      };
    }

    let state: RayStepState = {
      cellX: floorCell(ray.origin.x),
      cellY: floorCell(ray.origin.y),
      cellZ: floorCell(ray.origin.z),
      distance: 0,
      normal: {
        x: 0,
        y: 0,
        z: 0,
      },
      face: "unknown",
    };

    let tMaxX = initialTMax(ray.origin.x, state.cellX, direction.x, stepX);
    let tMaxY = initialTMax(ray.origin.y, state.cellY, direction.y, stepY);
    let tMaxZ = initialTMax(ray.origin.z, state.cellZ, direction.z, stepZ);

    const tDeltaX = tDelta(direction.x);
    const tDeltaY = tDelta(direction.y);
    const tDeltaZ = tDelta(direction.z);

    let previousCell: ChunkCellAddress | null = null;
    let sawMissingChunk = false;

    for (let stepIndex = 0; stepIndex < maxSteps && state.distance <= maxDistance; stepIndex += 1) {
      const address = createAddressFromCell(
        state.cellX,
        state.cellY,
        state.cellZ,
        chunkSize,
      );
      const sample = sampleSafely(input.sampler, address);
      const hit = shouldHitSample(sample, includeAir);

      if (!sample || sample.exists !== true || (sample as RaycastSamplerResult).chunkLoaded === false) {
        sawMissingChunk = true;
      }

      debugSteps.push(
        buildDebugStep({
          stepIndex,
          address,
          distance: state.distance,
          sample,
          hit,
          reason: hit ? null : sample?.air === true ? "air" : sample ? "not-hit" : "missing-sample",
        }),
      );

      if (hit && sample) {
        const hitPosition = pointAtDistance(ray, state.distance);
        const face = state.face === "unknown" ? normalToTargetFace(state.normal) : state.face;

        return {
          hit: createRaycastHit({
            hit: true,
            distance: state.distance,
            position: hitPosition,
            normal: state.normal,
            face,
            sourceCell: address,
            previousCell,
            sample,
            reason: null,
          }),
          steps: debugSteps,
          error: null,
        };
      }

      previousCell = address;

      if (tMaxX === INFINITY && tMaxY === INFINITY && tMaxZ === INFINITY) {
        break;
      }

      const stepped = stepRay({
        state,
        tMaxX,
        tMaxY,
        tMaxZ,
        tDeltaX,
        tDeltaY,
        tDeltaZ,
        stepX,
        stepY,
        stepZ,
      });

      state = stepped.nextState;
      tMaxX = stepped.tMaxX;
      tMaxY = stepped.tMaxY;
      tMaxZ = stepped.tMaxZ;
    }

    return {
      hit: createEmptyRaycastHit(
        reasonForMiss({
          maxDistance,
          maxSteps,
          lastDistance: state.distance,
          lastStepIndex: debugSteps.length,
          sawMissingChunk,
        }),
      ),
      steps: debugSteps,
      error: null,
    };
  } catch (error) {
    return {
      hit: createEmptyRaycastHit("Raycast failed."),
      steps: debugSteps,
      error: normalizeUnknownError(error),
    };
  }
}

export function raycastFromOriginDirection(input: {
  readonly origin: TargetVector3;
  readonly direction: TargetVector3;
  readonly sampler: RaycastCellSampler;
  readonly options?: Partial<TargetRaycastOptions>;
  readonly chunkSize?: number;
}): TargetRaycastHit {
  const ray = createRay({
    origin: input.origin,
    direction: input.direction,
    maxDistance: input.options?.maxDistance,
  });

  return raycastVoxels({
    ray,
    sampler: input.sampler,
    options: input.options,
    chunkSize: input.chunkSize,
  });
}

export function faceForHitNormal(normal: TargetVector3 | null | undefined): TargetFace {
  try {
    if (!normal) {
      return "unknown";
    }

    return normalToTargetFace(normal);
  } catch {
    return "unknown";
  }
}

export function normalForFace(face: TargetFace): TargetVector3 {
  try {
    return targetFaceToNormal(face);
  } catch {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }
}

export function offsetWorldPositionByNormal(
  position: ChunkWorldPosition,
  normal: TargetVector3 | null | undefined,
  amount = 1,
): ChunkWorldPosition {
  try {
    const safeNormal = normal ?? {
      x: 0,
      y: 0,
      z: 0,
    };

    return {
      x: position.x + (safeNormal.x * amount),
      y: position.y + (safeNormal.y * amount),
      z: position.z + (safeNormal.z * amount),
    };
  } catch {
    return position;
  }
}

export function previousCellFromHit(hit: TargetRaycastHit): ChunkCellAddress | null {
  try {
    return hit.previousCell ?? null;
  } catch {
    return null;
  }
}

export function sourceCellFromHit(hit: TargetRaycastHit): ChunkCellAddress | null {
  try {
    return hit.sourceCell ?? null;
  } catch {
    return null;
  }
}

export function isRaycastHit(value: TargetRaycastHit | null | undefined): value is TargetRaycastHit {
  try {
    return Boolean(value?.hit && value.sourceCell);
  } catch {
    return false;
  }
}

export function raycastDebugSummary(result: DebugVoxelRaycastResult): Record<string, unknown> {
  try {
    return {
      hit: result.hit.hit,
      distance: result.hit.distance,
      face: result.hit.face,
      sourceChunkKey: result.hit.sourceCell?.chunkKey ?? null,
      previousChunkKey: result.hit.previousCell?.chunkKey ?? null,
      stepCount: result.steps.length,
      firstSteps: result.steps.slice(0, 8),
      lastStep: result.steps[result.steps.length - 1] ?? null,
      error: result.error,
    };
  } catch (error) {
    return {
      hit: false,
      debugSummaryFailed: true,
      error: normalizeUnknownError(error),
    };
  }
}

export function createFallbackRaycastOptions(source: TargetSource = "fallback"): TargetRaycastOptions {
  return createDefaultRaycastOptions({
    maxDistance: DEFAULT_TARGET_MAX_DISTANCE,
    stepSize: DEFAULT_TARGET_STEP_SIZE,
    maxSteps: DEFAULT_TARGET_MAX_STEPS,
    includeAir: false,
    source,
  });
}

const DEFAULT_TARGET_MAX_DISTANCE = 8;
const DEFAULT_TARGET_STEP_SIZE = 0.08;
const DEFAULT_TARGET_MAX_STEPS = 256;