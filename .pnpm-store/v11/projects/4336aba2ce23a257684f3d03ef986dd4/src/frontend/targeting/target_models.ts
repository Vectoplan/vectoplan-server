// services/vectoplan-editor/src/frontend/targeting/target_models.ts
import type {
  ChunkCellAddress,
  ChunkWorldPosition,
} from "@runtime/world/chunk_coordinates";
import type {
  RuntimeCellSample,
  RuntimeChunkPaletteEntry,
} from "@runtime/world/chunk_content";
import { targetKeyFromParts } from "@utils/ids";
import {
  normalizeUnknownError,
  safeBoolean,
  safeNumber,
  safeString,
} from "@utils/safe";
import { nowIsoString } from "@utils/time";

export type TargetKind =
  | "none"
  | "chunk-cell"
  | "block"
  | "block-face"
  | "placement-cell"
  | "remove-cell"
  | "inspect-cell"
  | "unknown";

export type TargetStatus =
  | "none"
  | "valid"
  | "blocked"
  | "invalid"
  | "missing-chunk"
  | "out-of-range"
  | "unknown";

export type TargetAction =
  | "none"
  | "place"
  | "remove"
  | "inspect";

export type TargetFace =
  | "x-minus"
  | "x-plus"
  | "y-minus"
  | "y-plus"
  | "z-minus"
  | "z-plus"
  | "unknown";

export type TargetSource =
  | "raycast"
  | "crosshair"
  | "runtime"
  | "manual"
  | "fallback";

export interface TargetVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TargetRay {
  readonly origin: TargetVector3;
  readonly direction: TargetVector3;
  readonly maxDistance: number;
}

export interface TargetRaycastOptions {
  readonly maxDistance: number;
  readonly stepSize: number;
  readonly maxSteps: number;
  readonly includeAir: boolean;
  readonly source: TargetSource;
}

export interface TargetRaycastHit {
  readonly hit: boolean;
  readonly distance: number | null;
  readonly position: TargetVector3 | null;
  readonly normal: TargetVector3 | null;
  readonly face: TargetFace;
  readonly sourceCell: ChunkCellAddress | null;
  readonly previousCell: ChunkCellAddress | null;
  readonly sample: RuntimeCellSample | null;
  readonly reason: string | null;
}

export interface TargetCellDescriptor {
  readonly key: string;
  readonly chunkKey: string;
  readonly address: ChunkCellAddress;
  readonly cellValue: number;
  readonly blockTypeId: string | null;
  readonly paletteEntry: RuntimeChunkPaletteEntry | null;
  readonly air: boolean;
  readonly solid: boolean;
  readonly placeable: boolean;
  readonly breakable: boolean;
}

export interface PlacementTarget {
  readonly kind: "placement-cell";
  readonly status: TargetStatus;
  readonly key: string;
  readonly sourceCell: TargetCellDescriptor | null;
  readonly placementCell: TargetCellDescriptor | null;
  readonly face: TargetFace;
  readonly normal: TargetVector3 | null;
  readonly blockTypeId: string | null;
  readonly distance: number | null;
  readonly reason: string | null;
}

export interface RemoveTarget {
  readonly kind: "remove-cell";
  readonly status: TargetStatus;
  readonly key: string;
  readonly sourceCell: TargetCellDescriptor | null;
  readonly face: TargetFace;
  readonly normal: TargetVector3 | null;
  readonly blockTypeId: string | null;
  readonly distance: number | null;
  readonly reason: string | null;
}

export interface InspectTarget {
  readonly kind: "inspect-cell";
  readonly status: TargetStatus;
  readonly key: string;
  readonly sourceCell: TargetCellDescriptor | null;
  readonly face: TargetFace;
  readonly normal: TargetVector3 | null;
  readonly blockTypeId: string | null;
  readonly distance: number | null;
  readonly reason: string | null;
}

export interface TargetingState {
  readonly kind: "targeting-state.v1";
  readonly status: TargetStatus;
  readonly action: TargetAction;
  readonly source: TargetSource;
  readonly updatedAt: string;
  readonly ray: TargetRay | null;
  readonly hit: TargetRaycastHit | null;
  readonly hoverTarget: InspectTarget | null;
  readonly placementTarget: PlacementTarget | null;
  readonly removeTarget: RemoveTarget | null;
  readonly activeTargetKey: string | null;
  readonly activeChunkKey: string | null;
  readonly activeBlockTypeId: string | null;
  readonly reason: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface TargetingUpdateInput {
  readonly action?: TargetAction;
  readonly source?: TargetSource;
  readonly ray?: TargetRay | null;
  readonly hit?: TargetRaycastHit | null;
  readonly hoverTarget?: InspectTarget | null;
  readonly placementTarget?: PlacementTarget | null;
  readonly removeTarget?: RemoveTarget | null;
  readonly activeBlockTypeId?: string | null;
  readonly reason?: string | null;
}

export interface TargetingValidationResult {
  readonly ok: boolean;
  readonly status: TargetStatus;
  readonly reason: string | null;
  readonly warnings: readonly string[];
}

export interface TargetingDebugSummary {
  readonly status: TargetStatus;
  readonly action: TargetAction;
  readonly source: TargetSource;
  readonly activeTargetKey: string | null;
  readonly activeChunkKey: string | null;
  readonly activeBlockTypeId: string | null;
  readonly hit: boolean;
  readonly hitDistance: number | null;
  readonly placementStatus: TargetStatus | null;
  readonly removeStatus: TargetStatus | null;
  readonly hoverStatus: TargetStatus | null;
  readonly reason: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export const TARGETING_STATE_KIND = "targeting-state.v1" as const;

export const DEFAULT_TARGET_MAX_DISTANCE = 8 as const;

export const DEFAULT_TARGET_STEP_SIZE = 0.08 as const;

export const DEFAULT_TARGET_MAX_STEPS = 256 as const;

export const TARGET_FACE_NORMALS: Readonly<Record<TargetFace, TargetVector3>> = {
  "x-minus": {
    x: -1,
    y: 0,
    z: 0,
  },
  "x-plus": {
    x: 1,
    y: 0,
    z: 0,
  },
  "y-minus": {
    x: 0,
    y: -1,
    z: 0,
  },
  "y-plus": {
    x: 0,
    y: 1,
    z: 0,
  },
  "z-minus": {
    x: 0,
    y: 0,
    z: -1,
  },
  "z-plus": {
    x: 0,
    y: 0,
    z: 1,
  },
  unknown: {
    x: 0,
    y: 0,
    z: 0,
  },
};

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
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

function normalizeDistance(value: unknown, fallback: number | null = null): number | null {
  try {
    if (value === null || value === undefined) {
      return fallback;
    }

    const numeric = safeNumber(value, Number.NaN, {
      min: 0,
      max: 1_000_000,
    });

    return Number.isFinite(numeric) ? numeric : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTargetAction(value: unknown): TargetAction {
  const normalized = safeString(value, "none");

  if (
    normalized === "none"
    || normalized === "place"
    || normalized === "remove"
    || normalized === "inspect"
  ) {
    return normalized;
  }

  return "none";
}

function normalizeTargetSource(value: unknown): TargetSource {
  const normalized = safeString(value, "fallback");

  if (
    normalized === "raycast"
    || normalized === "crosshair"
    || normalized === "runtime"
    || normalized === "manual"
    || normalized === "fallback"
  ) {
    return normalized;
  }

  return "fallback";
}

function normalizeTargetStatus(value: unknown): TargetStatus {
  const normalized = safeString(value, "unknown");

  if (
    normalized === "none"
    || normalized === "valid"
    || normalized === "blocked"
    || normalized === "invalid"
    || normalized === "missing-chunk"
    || normalized === "out-of-range"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return "unknown";
}

function normalizeTargetFace(value: unknown): TargetFace {
  const normalized = safeString(value, "unknown");

  if (
    normalized === "x-minus"
    || normalized === "x-plus"
    || normalized === "y-minus"
    || normalized === "y-plus"
    || normalized === "z-minus"
    || normalized === "z-plus"
    || normalized === "unknown"
  ) {
    return normalized;
  }

  return "unknown";
}

function normalizeBlockTypeId(value: unknown): string | null {
  try {
    const normalized = safeString(value, "");

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeReason(value: unknown): string | null {
  try {
    const normalized = safeString(value, "");

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function createTargetKey(input: {
  readonly chunkKey?: string | null;
  readonly address?: ChunkCellAddress | null;
  readonly face?: TargetFace | null;
  readonly action?: TargetAction | null;
}): string {
  try {
    return targetKeyFromParts({
      chunkKey: input.chunkKey ?? input.address?.chunkKey ?? "none",
      worldX: input.address?.worldX ?? null,
      worldY: input.address?.worldY ?? null,
      worldZ: input.address?.worldZ ?? null,
      face: input.face ?? input.action ?? "none",
    });
  } catch {
    return `target_${Date.now()}`;
  }
}

function emptyVector(): TargetVector3 {
  return {
    x: 0,
    y: 0,
    z: 0,
  };
}

export function createDefaultRaycastOptions(
  input?: Partial<TargetRaycastOptions>,
): TargetRaycastOptions {
  return {
    maxDistance: safeNumber(input?.maxDistance, DEFAULT_TARGET_MAX_DISTANCE, {
      min: 0.1,
      max: 512,
    }),
    stepSize: safeNumber(input?.stepSize, DEFAULT_TARGET_STEP_SIZE, {
      min: 0.005,
      max: 1,
    }),
    maxSteps: Math.max(1, Math.trunc(safeNumber(input?.maxSteps, DEFAULT_TARGET_MAX_STEPS, {
      min: 1,
      max: 20_000,
    }))),
    includeAir: safeBoolean(input?.includeAir, false),
    source: normalizeTargetSource(input?.source ?? "raycast"),
  };
}

export function createTargetRay(input: {
  readonly origin: unknown;
  readonly direction: unknown;
  readonly maxDistance?: number;
}): TargetRay {
  const direction = normalizeVector3(input.direction, {
    x: 0,
    y: 0,
    z: -1,
  });

  const length = Math.hypot(direction.x, direction.y, direction.z);
  const normalizedDirection = length > 0.000001
    ? {
        x: direction.x / length,
        y: direction.y / length,
        z: direction.z / length,
      }
    : {
        x: 0,
        y: 0,
        z: -1,
      };

  return {
    origin: normalizeVector3(input.origin, emptyVector()),
    direction: normalizedDirection,
    maxDistance: safeNumber(input.maxDistance, DEFAULT_TARGET_MAX_DISTANCE, {
      min: 0.1,
      max: 512,
    }),
  };
}

export function createEmptyRaycastHit(reason = "No hit."): TargetRaycastHit {
  return {
    hit: false,
    distance: null,
    position: null,
    normal: null,
    face: "unknown",
    sourceCell: null,
    previousCell: null,
    sample: null,
    reason,
  };
}

export function createRaycastHit(input: Partial<TargetRaycastHit>): TargetRaycastHit {
  const face = normalizeTargetFace(input.face);
  const normal = input.normal
    ? normalizeVector3(input.normal, TARGET_FACE_NORMALS[face])
    : TARGET_FACE_NORMALS[face];

  return {
    hit: safeBoolean(input.hit, true),
    distance: normalizeDistance(input.distance, null),
    position: input.position ? normalizeVector3(input.position, emptyVector()) : null,
    normal,
    face,
    sourceCell: input.sourceCell ?? null,
    previousCell: input.previousCell ?? null,
    sample: input.sample ?? null,
    reason: normalizeReason(input.reason),
  };
}

export function normalToTargetFace(normal: unknown): TargetFace {
  try {
    const vector = normalizeVector3(normal, emptyVector());
    const absX = Math.abs(vector.x);
    const absY = Math.abs(vector.y);
    const absZ = Math.abs(vector.z);
    const max = Math.max(absX, absY, absZ);

    if (max <= 0.000001) {
      return "unknown";
    }

    if (max === absX) {
      return vector.x < 0 ? "x-minus" : "x-plus";
    }

    if (max === absY) {
      return vector.y < 0 ? "y-minus" : "y-plus";
    }

    return vector.z < 0 ? "z-minus" : "z-plus";
  } catch {
    return "unknown";
  }
}

export function targetFaceToNormal(face: TargetFace): TargetVector3 {
  return TARGET_FACE_NORMALS[normalizeTargetFace(face)];
}

export function createCellDescriptorFromSample(
  sample: RuntimeCellSample,
): TargetCellDescriptor {
  const address = sample.address;

  return {
    key: createTargetKey({
      chunkKey: address.chunkKey,
      address,
      action: "inspect",
    }),
    chunkKey: address.chunkKey,
    address,
    cellValue: sample.cellValue,
    blockTypeId: sample.blockTypeId,
    paletteEntry: sample.paletteEntry,
    air: sample.air,
    solid: sample.solid,
    placeable: sample.placeable,
    breakable: sample.breakable,
  };
}

export function createAirCellDescriptor(
  address: ChunkCellAddress,
): TargetCellDescriptor {
  return {
    key: createTargetKey({
      chunkKey: address.chunkKey,
      address,
      action: "inspect",
    }),
    chunkKey: address.chunkKey,
    address,
    cellValue: 0,
    blockTypeId: null,
    paletteEntry: null,
    air: true,
    solid: false,
    placeable: false,
    breakable: false,
  };
}

export function createInspectTarget(input: {
  readonly sourceCell: TargetCellDescriptor | null;
  readonly face?: TargetFace;
  readonly normal?: TargetVector3 | null;
  readonly distance?: number | null;
  readonly status?: TargetStatus;
  readonly reason?: string | null;
}): InspectTarget {
  const face = normalizeTargetFace(input.face);
  const sourceCell = input.sourceCell;

  return {
    kind: "inspect-cell",
    status: normalizeTargetStatus(input.status ?? (sourceCell ? "valid" : "none")),
    key: createTargetKey({
      chunkKey: sourceCell?.chunkKey ?? null,
      address: sourceCell?.address ?? null,
      face,
      action: "inspect",
    }),
    sourceCell,
    face,
    normal: input.normal ?? targetFaceToNormal(face),
    blockTypeId: sourceCell?.blockTypeId ?? null,
    distance: normalizeDistance(input.distance, null),
    reason: normalizeReason(input.reason),
  };
}

export function createPlacementTarget(input: {
  readonly sourceCell: TargetCellDescriptor | null;
  readonly placementCell: TargetCellDescriptor | null;
  readonly blockTypeId: string | null;
  readonly face?: TargetFace;
  readonly normal?: TargetVector3 | null;
  readonly distance?: number | null;
  readonly status?: TargetStatus;
  readonly reason?: string | null;
}): PlacementTarget {
  const face = normalizeTargetFace(input.face);
  const placementCell = input.placementCell;
  const blockTypeId = normalizeBlockTypeId(input.blockTypeId);

  let status = normalizeTargetStatus(input.status ?? "unknown");
  let reason = normalizeReason(input.reason);

  if (!placementCell) {
    status = "missing-chunk";
    reason = reason ?? "No placement cell available.";
  } else if (!blockTypeId) {
    status = "invalid";
    reason = reason ?? "No active block type selected.";
  } else if (!placementCell.air) {
    status = "blocked";
    reason = reason ?? "Placement cell is not air.";
  } else {
    status = status === "unknown" ? "valid" : status;
  }

  return {
    kind: "placement-cell",
    status,
    key: createTargetKey({
      chunkKey: placementCell?.chunkKey ?? input.sourceCell?.chunkKey ?? null,
      address: placementCell?.address ?? input.sourceCell?.address ?? null,
      face,
      action: "place",
    }),
    sourceCell: input.sourceCell,
    placementCell,
    face,
    normal: input.normal ?? targetFaceToNormal(face),
    blockTypeId,
    distance: normalizeDistance(input.distance, null),
    reason,
  };
}

export function createRemoveTarget(input: {
  readonly sourceCell: TargetCellDescriptor | null;
  readonly face?: TargetFace;
  readonly normal?: TargetVector3 | null;
  readonly distance?: number | null;
  readonly status?: TargetStatus;
  readonly reason?: string | null;
}): RemoveTarget {
  const face = normalizeTargetFace(input.face);
  const sourceCell = input.sourceCell;

  let status = normalizeTargetStatus(input.status ?? "unknown");
  let reason = normalizeReason(input.reason);

  if (!sourceCell) {
    status = "missing-chunk";
    reason = reason ?? "No source cell available.";
  } else if (sourceCell.air || sourceCell.cellValue <= 0) {
    status = "invalid";
    reason = reason ?? "Source cell is air.";
  } else if (!sourceCell.breakable) {
    status = "blocked";
    reason = reason ?? "Block is not breakable.";
  } else {
    status = status === "unknown" ? "valid" : status;
  }

  return {
    kind: "remove-cell",
    status,
    key: createTargetKey({
      chunkKey: sourceCell?.chunkKey ?? null,
      address: sourceCell?.address ?? null,
      face,
      action: "remove",
    }),
    sourceCell,
    face,
    normal: input.normal ?? targetFaceToNormal(face),
    blockTypeId: sourceCell?.blockTypeId ?? null,
    distance: normalizeDistance(input.distance, null),
    reason,
  };
}

export function createEmptyTargetingState(reason = "No target."): TargetingState {
  return {
    kind: TARGETING_STATE_KIND,
    status: "none",
    action: "none",
    source: "fallback",
    updatedAt: now(),
    ray: null,
    hit: null,
    hoverTarget: null,
    placementTarget: null,
    removeTarget: null,
    activeTargetKey: null,
    activeChunkKey: null,
    activeBlockTypeId: null,
    reason,
    lastError: null,
  };
}

export function updateTargetingState(
  previous: TargetingState,
  input: TargetingUpdateInput,
): TargetingState {
  try {
    const action = normalizeTargetAction(input.action ?? previous.action);
    const source = normalizeTargetSource(input.source ?? previous.source);
    const hoverTarget = input.hoverTarget === undefined ? previous.hoverTarget : input.hoverTarget;
    const placementTarget = input.placementTarget === undefined ? previous.placementTarget : input.placementTarget;
    const removeTarget = input.removeTarget === undefined ? previous.removeTarget : input.removeTarget;
    const activeBlockTypeId = input.activeBlockTypeId === undefined
      ? previous.activeBlockTypeId
      : normalizeBlockTypeId(input.activeBlockTypeId);

    const activeTarget =
      action === "place"
        ? placementTarget
        : action === "remove"
          ? removeTarget
          : hoverTarget;

    const status = activeTarget?.status ?? "none";
    const activeChunkKey =
      placementTarget?.placementCell?.chunkKey
      ?? removeTarget?.sourceCell?.chunkKey
      ?? hoverTarget?.sourceCell?.chunkKey
      ?? null;

    return {
      ...previous,
      status,
      action,
      source,
      updatedAt: now(),
      ray: input.ray === undefined ? previous.ray : input.ray,
      hit: input.hit === undefined ? previous.hit : input.hit,
      hoverTarget,
      placementTarget,
      removeTarget,
      activeTargetKey: activeTarget?.key ?? null,
      activeChunkKey,
      activeBlockTypeId,
      reason: normalizeReason(input.reason) ?? activeTarget?.reason ?? previous.reason,
    };
  } catch (error) {
    return {
      ...previous,
      status: "invalid",
      updatedAt: now(),
      reason: "Targeting update failed.",
      lastError: normalizeUnknownError(error),
    };
  }
}

export function validateTargetingState(state: TargetingState): TargetingValidationResult {
  const warnings: string[] = [];

  try {
    if (state.kind !== TARGETING_STATE_KIND) {
      return {
        ok: false,
        status: "invalid",
        reason: "Invalid targeting state kind.",
        warnings,
      };
    }

    if (state.action === "place") {
      if (!state.placementTarget) {
        return {
          ok: false,
          status: "invalid",
          reason: "Placement action has no placement target.",
          warnings,
        };
      }

      if (state.placementTarget.status !== "valid") {
        return {
          ok: false,
          status: state.placementTarget.status,
          reason: state.placementTarget.reason,
          warnings,
        };
      }
    }

    if (state.action === "remove") {
      if (!state.removeTarget) {
        return {
          ok: false,
          status: "invalid",
          reason: "Remove action has no remove target.",
          warnings,
        };
      }

      if (state.removeTarget.status !== "valid") {
        return {
          ok: false,
          status: state.removeTarget.status,
          reason: state.removeTarget.reason,
          warnings,
        };
      }
    }

    if (state.hit?.hit === true && !state.hit.sourceCell) {
      warnings.push("Raycast hit has no source cell.");
    }

    return {
      ok: state.status === "valid" || state.status === "none",
      status: state.status,
      reason: state.reason,
      warnings,
    };
  } catch (error) {
    return {
      ok: false,
      status: "invalid",
      reason: error instanceof Error ? error.message : "Target validation failed.",
      warnings,
    };
  }
}

export function targetingStateToDebugSummary(state: TargetingState): TargetingDebugSummary {
  return {
    status: state.status,
    action: state.action,
    source: state.source,
    activeTargetKey: state.activeTargetKey,
    activeChunkKey: state.activeChunkKey,
    activeBlockTypeId: state.activeBlockTypeId,
    hit: state.hit?.hit ?? false,
    hitDistance: state.hit?.distance ?? null,
    placementStatus: state.placementTarget?.status ?? null,
    removeStatus: state.removeTarget?.status ?? null,
    hoverStatus: state.hoverTarget?.status ?? null,
    reason: state.reason,
    lastError: state.lastError,
  };
}

export function targetCellToWorldPosition(cell: TargetCellDescriptor | null): ChunkWorldPosition | null {
  try {
    if (!cell) {
      return null;
    }

    return {
      x: cell.address.worldX,
      y: cell.address.worldY,
      z: cell.address.worldZ,
    };
  } catch {
    return null;
  }
}

export function isValidPlacementTarget(value: unknown): value is PlacementTarget {
  try {
    return Boolean(value)
      && typeof value === "object"
      && (value as PlacementTarget).kind === "placement-cell"
      && (value as PlacementTarget).status === "valid"
      && (value as PlacementTarget).placementCell !== null
      && (value as PlacementTarget).blockTypeId !== null;
  } catch {
    return false;
  }
}

export function isValidRemoveTarget(value: unknown): value is RemoveTarget {
  try {
    return Boolean(value)
      && typeof value === "object"
      && (value as RemoveTarget).kind === "remove-cell"
      && (value as RemoveTarget).status === "valid"
      && (value as RemoveTarget).sourceCell !== null;
  } catch {
    return false;
  }
}