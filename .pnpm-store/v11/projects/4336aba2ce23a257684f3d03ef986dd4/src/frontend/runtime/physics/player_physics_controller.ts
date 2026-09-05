// services/vectoplan-editor/src/frontend/runtime/physics/player_physics_controller.ts

import type {
  CollisionFlags,
  PhysicsAabb,
  PhysicsCameraBinding,
  PhysicsConfig,
  PhysicsDeltaSeconds,
  PhysicsEulerAngles,
  PhysicsStepInput,
  PhysicsStepPhase,
  PhysicsStepResult,
  PhysicsTimestampMs,
  PhysicsVector3,
  PlayerMovementIntent,
  PlayerMovementMode,
  PlayerPhysicsState,
} from "./physics_models";

import {
  clonePhysicsVector3,
  createPhysicsCameraBinding,
  createPhysicsError,
  createPlayerAabbFromPosition,
  EMPTY_PLAYER_MOVEMENT_INTENT,
  normalizeMovementIntent,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  scalePhysicsVector3,
  ZERO_PHYSICS_ANGLES,
  ZERO_PHYSICS_VECTOR,
} from "./physics_models";

import {
  DEFAULT_PHYSICS_CONFIG,
  createDefaultPhysicsConfig,
  mergePhysicsConfig,
  type PhysicsConfigPatch,
} from "./physics_defaults";

import {
  createInitialPlayerPhysicsState,
  markPlayerAirborne,
  markPlayerGrounded,
  patchAndNormalizePlayerPhysicsState,
  setPlayerFlying,
} from "./player_physics_state";

import type {
  VoxelCollisionMoveResult,
  VoxelCollisionQueryLike,
  VoxelCollisionSolverConfigPatch,
} from "./voxel_collision_solver";

import {
  createVoxelCollisionSolver,
  getAabbBasePositionFromResolvedAabb,
  type VoxelCollisionSolver,
} from "./voxel_collision_solver";

/**
 * Player physics controller.
 *
 * Owns:
 * - gravity
 * - walking
 * - sprinting
 * - jumping
 * - flying
 * - flight toggle
 * - velocity integration
 * - collision solver invocation
 *
 * Does not own:
 * - DOM input events
 * - keyboard repeat handling
 * - double-tap detection internals
 * - camera object mutation
 * - chunk loading
 * - rendering
 * - store mutation
 *
 * The controller receives already-normalized movement intent and returns a new
 * PlayerPhysicsState plus camera binding data.
 *
 * Runtime rule:
 * Every movement mode uses the configured VoxelCollisionSolver. Flight disables
 * gravity, but it does not bypass solid voxel collision.
 */

export interface PlayerPhysicsControllerConfig {
  readonly physics: PhysicsConfig;
  readonly collision: VoxelCollisionSolverConfigPatch;
  readonly yawForwardSign: 1 | -1;
  readonly autoClimbEnabled: boolean;
  readonly autoClimbMaxHeight: number;
  readonly preserveHorizontalVelocityWhenNoInput: boolean;
  readonly horizontalDampingPerSecond: number;
  readonly airborneHorizontalDampingPerSecond: number;
  readonly flyingDampingPerSecond: number;
}

export interface PlayerPhysicsControllerConfigPatch {
  readonly physics?: PhysicsConfigPatch | null;
  readonly collision?: VoxelCollisionSolverConfigPatch | null;
  readonly yawForwardSign?: unknown;
  readonly autoClimbEnabled?: unknown;
  readonly autoClimbMaxHeight?: unknown;
  readonly preserveHorizontalVelocityWhenNoInput?: unknown;
  readonly horizontalDampingPerSecond?: unknown;
  readonly airborneHorizontalDampingPerSecond?: unknown;
  readonly flyingDampingPerSecond?: unknown;
}

export interface PlayerPhysicsControllerStepInput {
  readonly nowMs: PhysicsTimestampMs;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly movementIntent?: Partial<PlayerMovementIntent> | null;
  readonly lookAngles?: Partial<PhysicsEulerAngles> | null;
  readonly query: VoxelCollisionQueryLike;
}

export interface PlayerPhysicsControllerStepResult extends PhysicsStepResult {
  readonly collisionResult: VoxelCollisionMoveResult | null;
  readonly modeBefore: PlayerMovementMode;
  readonly modeAfter: PlayerMovementMode;
}

export interface PlayerPhysicsControllerSnapshot {
  readonly controllerVersion: string;
  readonly contractVersion: string;
  readonly player: PlayerPhysicsState;
  readonly config: PlayerPhysicsControllerConfig;
  readonly lastStep: PlayerPhysicsControllerStepResult | null;
  readonly collisionSolver: ReturnType<VoxelCollisionSolver["snapshot"]>;
  readonly revision: number;
}

export const DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG: PlayerPhysicsControllerConfig = Object.freeze({
  physics: DEFAULT_PHYSICS_CONFIG,
  collision: Object.freeze({
    enabled: true,
    includeTraceCells: false,
  }),
  yawForwardSign: 1,
  autoClimbEnabled: true,
  autoClimbMaxHeight: 2.05,
  preserveHorizontalVelocityWhenNoInput: false,
  horizontalDampingPerSecond: 24,
  airborneHorizontalDampingPerSecond: 8,
  flyingDampingPerSecond: 18,
});

const PLAYER_PHYSICS_PROBE_LABEL = "[vectoplan-editor:physics.probe]" as const;

/**
 * Controller contract.
 *
 * All player movement modes are resolved by the voxel collision solver:
 * - walking and airborne movement use gravity and full X/Y/Z collision
 * - jumping uses the same solver and cannot be re-grounded by a shallow probe
 * - flying disables gravity but still collides with loaded solid voxels
 *
 * There is intentionally no no-clip or axis-bypass fallback in this file.
 * Missing or failed collision queries remain fail-closed in the solver/query
 * layers so a broken world reader cannot silently allow falling through terrain.
 */
export const PLAYER_PHYSICS_CONTROLLER_VERSION = "0.3.0";
export const PLAYER_PHYSICS_CONTROLLER_CONTRACT_VERSION =
  "vectoplan-player-physics-controller.v3";

let lastPlayerPhysicsProbeSignature = "";
let lastPlayerPhysicsProbeIntentActive = false;

function createWarning(message: string): string {
  try {
    return String(message || "Unknown player-physics warning");
  } catch {
    return "Unknown player-physics warning";
  }
}

function asProbeRecord(value: unknown): Record<string, unknown> {
  try {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asProbeArray(value: unknown): readonly unknown[] {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function sanitizeProbeNumber(value: unknown, fallback = 0): number {
  try {
    return sanitizePhysicsNumber(value, fallback, {
      min: -Number.MAX_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER,
    });
  } catch {
    return fallback;
  }
}

function sanitizeProbeBoolean(value: unknown, fallback = false): boolean {
  try {
    return sanitizePhysicsBoolean(value, fallback);
  } catch {
    return fallback;
  }
}

function roundProbeNumber(value: unknown, digits = 4): number {
  try {
    const numeric = sanitizeProbeNumber(value, 0);
    const factor = 10 ** Math.max(0, Math.min(8, Math.floor(digits)));

    return Math.round(numeric * factor) / factor;
  } catch {
    return 0;
  }
}

function vectorProbe(value: unknown): Record<string, number> {
  try {
    const record = asProbeRecord(value);

    return {
      x: roundProbeNumber(record.x),
      y: roundProbeNumber(record.y),
      z: roundProbeNumber(record.z),
    };
  } catch {
    return { x: 0, y: 0, z: 0 };
  }
}

function vectorHasHorizontalMagnitude(value: unknown, epsilon = 0.00001): boolean {
  try {
    const record = asProbeRecord(value);
    const x = sanitizeProbeNumber(record.x, 0);
    const z = sanitizeProbeNumber(record.z, 0);

    return Math.abs(x) > epsilon || Math.abs(z) > epsilon;
  } catch {
    return false;
  }
}

function intentProbe(intent: PlayerMovementIntent): Record<string, unknown> {
  try {
    return {
      forward: roundProbeNumber(intent.forward),
      right: roundProbeNumber(intent.right),
      jumpPressed: Boolean(intent.jumpPressed),
      sprintHeld: Boolean(intent.sprintHeld),
      ascendHeld: Boolean(intent.ascendHeld),
      descendHeld: Boolean(intent.descendHeld),
      toggleFlightRequested: Boolean(intent.toggleFlightRequested),
    };
  } catch {
    return {
      forward: 0,
      right: 0,
      jumpPressed: false,
      sprintHeld: false,
      ascendHeld: false,
      descendHeld: false,
      toggleFlightRequested: false,
    };
  }
}

function isPlayerMovementIntentActive(intent: PlayerMovementIntent): boolean {
  try {
    return (
      Math.abs(sanitizeProbeNumber(intent.forward, 0)) > 0.00001 ||
      Math.abs(sanitizeProbeNumber(intent.right, 0)) > 0.00001 ||
      Boolean(intent.jumpPressed) ||
      Boolean(intent.ascendHeld) ||
      Boolean(intent.descendHeld) ||
      Boolean(intent.toggleFlightRequested)
    );
  } catch {
    return false;
  }
}

function blockedAxesProbe(value: unknown): readonly string[] {
  try {
    return asProbeArray(value)
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function hasHorizontalBlockedAxis(value: unknown): boolean {
  try {
    const axes = blockedAxesProbe(value);

    return axes.includes("x") || axes.includes("z");
  } catch {
    return false;
  }
}

function collisionFlagsProbe(flags: unknown): Record<string, unknown> {
  try {
    const record = asProbeRecord(flags);

    return {
      grounded: sanitizeProbeBoolean(record.grounded),
      hitCeiling: sanitizeProbeBoolean(record.hitCeiling),
      hitWall: sanitizeProbeBoolean(record.hitWall),
      touchingWall: sanitizeProbeBoolean(record.touchingWall),
      raw: { ...record },
    };
  } catch {
    return {};
  }
}

function getTraceCells(trace: unknown): readonly Record<string, unknown>[] {
  try {
    const traceRecord = asProbeRecord(trace);
    return asProbeArray(traceRecord.cells).map((cell) => asProbeRecord(cell));
  } catch {
    return [];
  }
}

function firstTraceCellByPredicate(
  trace: unknown,
  predicate: (cell: Record<string, unknown>) => boolean,
): Record<string, unknown> | null {
  try {
    for (const cell of getTraceCells(trace)) {
      if (predicate(cell)) {
        return cell;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function collisionTraceProbe(trace: unknown): Record<string, unknown> {
  try {
    const record = asProbeRecord(trace);
    const cells = getTraceCells(trace);
    const firstMissingCell = firstTraceCellByPredicate(trace, (cell) => (
      cell.chunkLoaded === false ||
      cell.loaded === false ||
      Boolean(cell.missingReason)
    ));
    const firstSolidCell = firstTraceCellByPredicate(trace, (cell) => (
      cell.kind === "solid" ||
      cell.solid === true
    ));

    return {
      checkedCellCount: sanitizeProbeNumber(record.checkedCellCount, cells.length),
      solidCellCount: sanitizeProbeNumber(record.solidCellCount, 0),
      missingCellCount: sanitizeProbeNumber(record.missingCellCount, 0),
      traceCellCount: cells.length,
      firstMissingCell,
      firstSolidCell,
      firstMissingReason: asProbeRecord(firstMissingCell).missingReason ?? null,
      firstSolidKind: asProbeRecord(firstSolidCell).kind ?? null,
      firstSolidBlockTypeId: asProbeRecord(firstSolidCell).blockTypeId ?? null,
    };
  } catch {
    return {
      checkedCellCount: 0,
      solidCellCount: 0,
      missingCellCount: 0,
      traceCellCount: 0,
      firstMissingCell: null,
      firstSolidCell: null,
      firstMissingReason: null,
      firstSolidKind: null,
      firstSolidBlockTypeId: null,
    };
  }
}

function collisionResultProbe(collisionResult: VoxelCollisionMoveResult): Record<string, unknown> {
  try {
    const record = asProbeRecord(collisionResult);
    const trace = collisionTraceProbe(collisionResult.trace);

    return {
      ok: Boolean(collisionResult.ok),
      appliedDelta: vectorProbe(collisionResult.appliedDelta),
      requestedDelta: vectorProbe(record.requestedDelta),
      remainingDelta: vectorProbe(record.remainingDelta),
      blockedAxes: blockedAxesProbe(collisionResult.blockedAxes),
      collisionFlags: collisionFlagsProbe(collisionResult.collisionFlags),
      warnings: collisionResult.warnings ?? [],
      trace,
    };
  } catch {
    return {
      ok: false,
      appliedDelta: { x: 0, y: 0, z: 0 },
      blockedAxes: [],
      collisionFlags: {},
      warnings: [],
      trace: collisionTraceProbe(null),
    };
  }
}

function classifyPhysicsProbe(input: {
  readonly intent: PlayerMovementIntent;
  readonly velocityBeforeCollision: PhysicsVector3;
  readonly delta: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly correctedVelocity: PhysicsVector3;
  readonly previousState: PlayerPhysicsState;
  readonly nextState: PlayerPhysicsState;
  readonly warnings: readonly string[];
}): string {
  try {
    const intentActive = isPlayerMovementIntentActive(input.intent);
    const horizontalVelocity = vectorHasHorizontalMagnitude(
      input.velocityBeforeCollision,
    );
    const horizontalRequestedDelta = vectorHasHorizontalMagnitude(
      input.delta,
    );
    const horizontalAppliedDelta = vectorHasHorizontalMagnitude(
      input.collisionResult.appliedDelta,
    );
    const horizontalCorrectedVelocity = vectorHasHorizontalMagnitude(
      input.correctedVelocity,
    );
    const horizontalBlocked = hasHorizontalBlockedAxis(
      input.collisionResult.blockedAxes,
    );
    const verticalAppliedDelta = sanitizeProbeNumber(
      input.collisionResult.appliedDelta.y,
      0,
    );
    const collisionFlags = asProbeRecord(
      input.collisionResult.collisionFlags,
    );
    const trace = collisionTraceProbe(input.collisionResult.trace);
    const solidCells = sanitizeProbeNumber(trace.solidCellCount, 0);
    const missingCells = sanitizeProbeNumber(trace.missingCellCount, 0);

    const landed =
      !input.previousState.grounded &&
      input.nextState.grounded &&
      !input.nextState.flying;
    const leftGround =
      input.previousState.grounded &&
      !input.nextState.grounded &&
      !input.nextState.flying;
    const flightEnabled =
      !input.previousState.flying &&
      input.nextState.flying;
    const flightDisabled =
      input.previousState.flying &&
      !input.nextState.flying;
    const rising =
      !input.nextState.flying &&
      !input.nextState.grounded &&
      verticalAppliedDelta > 0.00001;
    const falling =
      !input.nextState.flying &&
      !input.nextState.grounded &&
      verticalAppliedDelta < -0.00001;
    const hitCeiling = sanitizeProbeBoolean(
      collisionFlags.hitCeiling,
      false,
    );
    const blockedByMissingChunk = sanitizeProbeBoolean(
      collisionFlags.blockedByMissingChunk,
      false,
    );

    if (!input.collisionResult.ok) {
      return blockedByMissingChunk
        ? "collision_failed_missing_world_data"
        : "collision_failed";
    }

    if (flightEnabled) {
      return "flight_enabled";
    }

    if (flightDisabled) {
      return falling
        ? "flight_disabled_and_falling"
        : "flight_disabled";
    }

    if (landed) {
      return "player_landed";
    }

    if (hitCeiling && verticalAppliedDelta <= 0.00001) {
      return "player_hit_ceiling";
    }

    if (leftGround && rising) {
      return "player_jumped";
    }

    if (rising && intentActive && horizontalAppliedDelta) {
      return "player_moves_and_rises";
    }

    if (falling && intentActive && horizontalAppliedDelta) {
      return "player_moves_and_falls";
    }

    if (rising) {
      return "player_rising";
    }

    if (falling) {
      return "player_falling";
    }

    if (intentActive && horizontalBlocked) {
      return blockedByMissingChunk
        ? "input_blocked_by_missing_world_data"
        : "input_blocked_by_wall";
    }

    if (
      intentActive &&
      horizontalRequestedDelta &&
      !horizontalAppliedDelta
    ) {
      return "input_blocked_no_applied_delta";
    }

    if (intentActive && !horizontalVelocity) {
      return "input_reached_physics_but_velocity_zero";
    }

    if (intentActive && horizontalAppliedDelta) {
      return "input_moves_player";
    }

    if (!intentActive && lastPlayerPhysicsProbeIntentActive) {
      return "input_released";
    }

    if (!intentActive && horizontalCorrectedVelocity) {
      return "horizontal_residual_velocity";
    }

    if (
      !intentActive &&
      Math.abs(verticalAppliedDelta) > 0.00001 &&
      (solidCells > 0 || missingCells > 0)
    ) {
      return "vertical_collision_context";
    }

    if (input.warnings.length > 0) {
      return "warning";
    }

    return input.nextState.grounded
      ? "grounded_idle"
      : input.nextState.flying
        ? "flying_idle"
        : "airborne_idle";
  } catch {
    return "probe_failed";
  }
}

function createProbeSignature(input: {
  readonly eventType: string;
  readonly intent: PlayerMovementIntent;
  readonly previousState: PlayerPhysicsState;
  readonly nextState: PlayerPhysicsState;
  readonly velocityBeforeCollision: PhysicsVector3;
  readonly correctedVelocity: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
}): string {
  try {
    const trace = collisionTraceProbe(input.collisionResult.trace);

    return JSON.stringify({
      eventType: input.eventType,
      intent: intentProbe(input.intent),
      hasVelocityXz: vectorHasHorizontalMagnitude(input.velocityBeforeCollision),
      hasCorrectedVelocityXz: vectorHasHorizontalMagnitude(input.correctedVelocity),
      hasAppliedDeltaXz: vectorHasHorizontalMagnitude(input.collisionResult.appliedDelta),
      blockedAxes: blockedAxesProbe(input.collisionResult.blockedAxes),
      groundedBefore: Boolean(input.previousState.grounded),
      groundedAfter: Boolean(input.nextState.grounded),
      flyingBefore: Boolean(input.previousState.flying),
      flyingAfter: Boolean(input.nextState.flying),
      modeBefore: input.previousState.movementMode,
      modeAfter: input.nextState.movementMode,
      solidCellCount: sanitizeProbeNumber(trace.solidCellCount, 0),
      missingCellCount: sanitizeProbeNumber(trace.missingCellCount, 0),
      firstMissingReason: trace.firstMissingReason ?? null,
      firstSolidKind: trace.firstSolidKind ?? null,
      ok: Boolean(input.collisionResult.ok),
    });
  } catch {
    return String(Date.now());
  }
}

function shouldEmitPhysicsProbe(input: {
  readonly eventType: string;
  readonly intent: PlayerMovementIntent;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly warnings: readonly string[];
}): boolean {
  try {
    if (input.eventType === "idle") {
      return false;
    }

    if (!input.collisionResult.ok || input.warnings.length > 0) {
      return true;
    }

    if (isPlayerMovementIntentActive(input.intent) || lastPlayerPhysicsProbeIntentActive) {
      return true;
    }

    return (
      input.eventType === "input_released" ||
      input.eventType === "collision_failed" ||
      input.eventType === "probe_failed"
    );
  } catch {
    return true;
  }
}

function probeFlatRow(input: {
  readonly eventType: string;
  readonly nowMs: PhysicsTimestampMs;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly intent: PlayerMovementIntent;
  readonly previousState: PlayerPhysicsState;
  readonly stateBeforeCollision: PlayerPhysicsState;
  readonly velocityBeforeCollision: PhysicsVector3;
  readonly delta: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly correctedVelocity: PhysicsVector3;
  readonly nextState: PlayerPhysicsState;
  readonly modeBefore: PlayerMovementMode;
  readonly modeAfter: PlayerMovementMode;
  readonly warnings: readonly string[];
}): Record<string, unknown> {
  try {
    const collision = collisionResultProbe(input.collisionResult);
    const trace = asProbeRecord(collision.trace);
    const firstMissingCell = asProbeRecord(trace.firstMissingCell);
    const firstSolidCell = asProbeRecord(trace.firstSolidCell);
    const intent = intentProbe(input.intent);

    return {
      event: input.eventType,
      intentForward: intent.forward,
      intentRight: intent.right,
      intentActive: isPlayerMovementIntentActive(input.intent),
      jump: intent.jumpPressed,
      sprint: intent.sprintHeld,
      flyToggle: intent.toggleFlightRequested,
      modeBefore: input.modeBefore,
      modeAfter: input.modeAfter,
      groundedBefore: Boolean(input.previousState.grounded),
      groundedAfter: Boolean(input.nextState.grounded),
      flyingBefore: Boolean(input.previousState.flying),
      flyingAfter: Boolean(input.nextState.flying),

      previousX: roundProbeNumber(input.previousState.position.x),
      previousY: roundProbeNumber(input.previousState.position.y),
      previousZ: roundProbeNumber(input.previousState.position.z),
      nextX: roundProbeNumber(input.nextState.position.x),
      nextY: roundProbeNumber(input.nextState.position.y),
      nextZ: roundProbeNumber(input.nextState.position.z),
      changedX: roundProbeNumber(input.nextState.position.x - input.previousState.position.x),
      changedY: roundProbeNumber(input.nextState.position.y - input.previousState.position.y),
      changedZ: roundProbeNumber(input.nextState.position.z - input.previousState.position.z),

      velocityX: roundProbeNumber(input.velocityBeforeCollision.x),
      velocityY: roundProbeNumber(input.velocityBeforeCollision.y),
      velocityZ: roundProbeNumber(input.velocityBeforeCollision.z),
      requestedDeltaX: roundProbeNumber(input.delta.x),
      requestedDeltaY: roundProbeNumber(input.delta.y),
      requestedDeltaZ: roundProbeNumber(input.delta.z),
      appliedDeltaX: roundProbeNumber(asProbeRecord(collision.appliedDelta).x),
      appliedDeltaY: roundProbeNumber(asProbeRecord(collision.appliedDelta).y),
      appliedDeltaZ: roundProbeNumber(asProbeRecord(collision.appliedDelta).z),
      correctedVelocityX: roundProbeNumber(input.correctedVelocity.x),
      correctedVelocityY: roundProbeNumber(input.correctedVelocity.y),
      correctedVelocityZ: roundProbeNumber(input.correctedVelocity.z),

      collisionOk: collision.ok,
      blockedAxes: blockedAxesProbe(collision.blockedAxes).join(","),
      solidCells: trace.solidCellCount,
      missingCells: trace.missingCellCount,
      checkedCells: trace.checkedCellCount,
      traceCells: trace.traceCellCount,
      firstMissingReason: trace.firstMissingReason ?? firstMissingCell.missingReason ?? null,
      firstMissingKind: firstMissingCell.kind ?? null,
      firstMissingLoaded: firstMissingCell.loaded ?? firstMissingCell.chunkLoaded ?? null,
      firstSolidKind: trace.firstSolidKind ?? firstSolidCell.kind ?? null,
      firstSolidBlock: trace.firstSolidBlockTypeId ?? firstSolidCell.blockTypeId ?? null,
      warningCount: input.warnings.length,
    };
  } catch {
    return {
      event: "probe_row_failed",
    };
  }
}

function createProbePayload(input: {
  readonly eventType: string;
  readonly nowMs: PhysicsTimestampMs;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly previousState: PlayerPhysicsState;
  readonly stateBeforeCollision: PlayerPhysicsState;
  readonly velocityBeforeCollision: PhysicsVector3;
  readonly delta: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly correctedVelocity: PhysicsVector3;
  readonly nextState: PlayerPhysicsState;
  readonly modeBefore: PlayerMovementMode;
  readonly modeAfter: PlayerMovementMode;
  readonly warnings: readonly string[];
}): Record<string, unknown> {
  const flat = probeFlatRow(input);

  return {
    kind: "vectoplan-player-physics-probe.v2",
    event: input.eventType,
    createdAt: new Date().toISOString(),
    summary: flat,
    details: {
      nowMs: roundProbeNumber(input.nowMs),
      deltaSeconds: roundProbeNumber(input.deltaSeconds, 6),
      intent: intentProbe(input.intent),
      intentActive: isPlayerMovementIntentActive(input.intent),
      angles: {
        yaw: roundProbeNumber(input.angles.yaw),
        pitch: roundProbeNumber(input.angles.pitch),
        roll: roundProbeNumber(input.angles.roll),
      },
      modeBefore: input.modeBefore,
      modeAfter: input.modeAfter,
      previousPosition: vectorProbe(input.previousState.position),
      stateBeforeCollisionPosition: vectorProbe(input.stateBeforeCollision.position),
      nextPosition: vectorProbe(input.nextState.position),
      previousVelocity: vectorProbe(input.previousState.velocity),
      velocityBeforeCollision: vectorProbe(input.velocityBeforeCollision),
      correctedVelocity: vectorProbe(input.correctedVelocity),
      requestedDelta: vectorProbe(input.delta),
      appliedDelta: vectorProbe(input.collisionResult.appliedDelta),
      positionChanged: {
        x: roundProbeNumber(input.nextState.position.x - input.previousState.position.x),
        y: roundProbeNumber(input.nextState.position.y - input.previousState.position.y),
        z: roundProbeNumber(input.nextState.position.z - input.previousState.position.z),
      },
      groundedBefore: Boolean(input.previousState.grounded),
      groundedAfter: Boolean(input.nextState.grounded),
      flyingBefore: Boolean(input.previousState.flying),
      flyingAfter: Boolean(input.nextState.flying),
      collision: collisionResultProbe(input.collisionResult),
      warnings: input.warnings,
    },
  };
}

function writeDiagnosticGlobal(name: string, value: unknown): void {
  try {
    (globalThis as unknown as Record<string, unknown>)[name] = value;
  } catch {
    // Global diagnostics are best-effort.
  }

  try {
    const maybeWindow = (globalThis as unknown as { window?: unknown }).window;

    if (maybeWindow && typeof maybeWindow === "object") {
      (maybeWindow as Record<string, unknown>)[name] = value;
    }
  } catch {
    // Global diagnostics are best-effort.
  }
}

function publishPhysicsProbe(payload: Record<string, unknown>): void {
  try {
    writeDiagnosticGlobal("__VECTOPLAN_LAST_PHYSICS_PROBE__", payload);

    const globalRecord = globalThis as unknown as Record<string, unknown>;
    const existing = Array.isArray(globalRecord.__VECTOPLAN_PHYSICS_PROBES__)
      ? globalRecord.__VECTOPLAN_PHYSICS_PROBES__ as unknown[]
      : [];

    existing.push(payload);

    if (existing.length > 50) {
      existing.splice(0, existing.length - 50);
    }

    writeDiagnosticGlobal("__VECTOPLAN_PHYSICS_PROBES__", existing);
  } catch {
    // Global diagnostics are best-effort.
  }

  try {
    const consoleLike = (globalThis as unknown as { console?: Console }).console;
    const event = String(payload.event ?? "unknown");
    const summary = asProbeRecord(payload.summary);

    if (consoleLike && typeof consoleLike.info === "function") {
      consoleLike.info(`${PLAYER_PHYSICS_PROBE_LABEL} ${event}`, summary, payload);
    }

    if (consoleLike && typeof consoleLike.table === "function") {
      consoleLike.table([summary]);
    }
  } catch {
    // Probe logging must never break physics.
  }
}

function logPhysicsProbe(input: {
  readonly nowMs: PhysicsTimestampMs;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly previousState: PlayerPhysicsState;
  readonly stateBeforeCollision: PlayerPhysicsState;
  readonly velocityBeforeCollision: PhysicsVector3;
  readonly delta: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly correctedVelocity: PhysicsVector3;
  readonly nextState: PlayerPhysicsState;
  readonly modeBefore: PlayerMovementMode;
  readonly modeAfter: PlayerMovementMode;
  readonly warnings: readonly string[];
}): void {
  try {
    const eventType = classifyPhysicsProbe(input);

    if (!shouldEmitPhysicsProbe({
      eventType,
      intent: input.intent,
      collisionResult: input.collisionResult,
      warnings: input.warnings,
    })) {
      lastPlayerPhysicsProbeIntentActive = isPlayerMovementIntentActive(input.intent);
      return;
    }

    const signature = createProbeSignature({
      eventType,
      intent: input.intent,
      previousState: input.previousState,
      nextState: input.nextState,
      velocityBeforeCollision: input.velocityBeforeCollision,
      correctedVelocity: input.correctedVelocity,
      collisionResult: input.collisionResult,
    });

    if (signature === lastPlayerPhysicsProbeSignature) {
      lastPlayerPhysicsProbeIntentActive = isPlayerMovementIntentActive(input.intent);
      return;
    }

    lastPlayerPhysicsProbeSignature = signature;
    lastPlayerPhysicsProbeIntentActive = isPlayerMovementIntentActive(input.intent);

    publishPhysicsProbe(createProbePayload({
      ...input,
      eventType,
    }));
  } catch {
    // Diagnostics must never break physics.
  }
}

function normalizeDeltaSeconds(value: unknown): PhysicsDeltaSeconds {
  try {
    return sanitizePhysicsNumber(value, 0, {
      min: 0,
      max: 1,
    });
  } catch {
    return 0;
  }
}

function normalizeTimestampMs(value: unknown): PhysicsTimestampMs {
  try {
    return sanitizePhysicsNumber(value, 0, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
  } catch {
    return 0;
  }
}

function normalizeAngles(value: Partial<PhysicsEulerAngles> | null | undefined): PhysicsEulerAngles {
  try {
    return {
      yaw: sanitizePhysicsNumber(value?.yaw, ZERO_PHYSICS_ANGLES.yaw),
      pitch: sanitizePhysicsNumber(value?.pitch, ZERO_PHYSICS_ANGLES.pitch),
      roll: sanitizePhysicsNumber(value?.roll, ZERO_PHYSICS_ANGLES.roll ?? 0),
    };
  } catch {
    return { ...ZERO_PHYSICS_ANGLES };
  }
}

function normalizeYawForwardSign(value: unknown): 1 | -1 {
  try {
    const numeric = sanitizePhysicsNumber(value, DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.yawForwardSign);
    return numeric < 0 ? -1 : 1;
  } catch {
    return DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.yawForwardSign;
  }
}

function normalizeAutoClimbHeight(value: unknown, fallback: number): number {
  try {
    return sanitizePhysicsNumber(value, fallback, {
      min: 0.05,
      max: 2.25,
    });
  } catch {
    return fallback;
  }
}

function normalizeDamping(value: unknown, fallback: number): number {
  try {
    return sanitizePhysicsNumber(value, fallback, {
      min: 0,
      max: 120,
    });
  } catch {
    return fallback;
  }
}

function clampVelocityComponent(value: unknown, min: number, max: number): number {
  try {
    return sanitizePhysicsNumber(value, 0, {
      min,
      max,
    });
  } catch {
    return 0;
  }
}

function applyExponentialDamping(value: number, dampingPerSecond: number, deltaSeconds: number): number {
  try {
    const safeDamping = Math.max(0, sanitizePhysicsNumber(dampingPerSecond, 0));
    const safeDelta = normalizeDeltaSeconds(deltaSeconds);

    if (safeDamping <= 0 || safeDelta <= 0) {
      return value;
    }

    const factor = Math.exp(-safeDamping * safeDelta);
    const damped = value * factor;

    return Math.abs(damped) < 0.00001 ? 0 : damped;
  } catch {
    return 0;
  }
}

function normalizeHorizontalInput(intent: PlayerMovementIntent): {
  readonly forward: number;
  readonly right: number;
  readonly hasInput: boolean;
} {
  try {
    const forward = sanitizePhysicsNumber(intent.forward, 0, {
      min: -1,
      max: 1,
    });
    const right = sanitizePhysicsNumber(intent.right, 0, {
      min: -1,
      max: 1,
    });

    const length = Math.sqrt(forward * forward + right * right);

    if (!Number.isFinite(length) || length <= 0) {
      return {
        forward: 0,
        right: 0,
        hasInput: false,
      };
    }

    const factor = length > 1 ? 1 / length : 1;

    return {
      forward: forward * factor,
      right: right * factor,
      hasInput: true,
    };
  } catch {
    return {
      forward: 0,
      right: 0,
      hasInput: false,
    };
  }
}

/**
 * Three.js-like FPS basis:
 * - yaw = 0 looks toward -Z
 * - positive X is right
 *
 * MovementIntent convention from physics_models:
 * - forward = -1 means forward
 * - forward =  1 means backward
 * - right   = -1 means left
 * - right   =  1 means right
 */
export function createYawMovementVector(
  intent: PlayerMovementIntent,
  angles: PhysicsEulerAngles,
  options: {
    readonly yawForwardSign?: 1 | -1;
  } = {},
): PhysicsVector3 {
  try {
    const normalized = normalizeHorizontalInput(intent);

    if (!normalized.hasInput) {
      return { ...ZERO_PHYSICS_VECTOR };
    }

    const yaw = sanitizePhysicsNumber(angles.yaw, 0);
    const yawForwardSign = normalizeYawForwardSign(options.yawForwardSign);

    const forwardAmount = -normalized.forward * yawForwardSign;
    const rightAmount = normalized.right;

    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    const forwardVector = {
      x: -sinYaw,
      y: 0,
      z: -cosYaw,
    };

    const rightVector = {
      x: cosYaw,
      y: 0,
      z: -sinYaw,
    };

    const x = forwardVector.x * forwardAmount + rightVector.x * rightAmount;
    const z = forwardVector.z * forwardAmount + rightVector.z * rightAmount;
    const length = Math.sqrt(x * x + z * z);

    if (!Number.isFinite(length) || length <= 0) {
      return { ...ZERO_PHYSICS_VECTOR };
    }

    const factor = length > 1 ? 1 / length : 1;

    return {
      x: x * factor,
      y: 0,
      z: z * factor,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function createPlayerPhysicsControllerConfig(
  patch: PlayerPhysicsControllerConfigPatch | null | undefined = undefined,
): PlayerPhysicsControllerConfig {
  try {
    return {
      physics: mergePhysicsConfig(DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.physics, patch?.physics),
      collision: {
        ...DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.collision,
        ...(patch?.collision ?? {}),
      },
      yawForwardSign: normalizeYawForwardSign(patch?.yawForwardSign),
      autoClimbEnabled: sanitizePhysicsBoolean(
        patch?.autoClimbEnabled,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.autoClimbEnabled,
      ),
      autoClimbMaxHeight: normalizeAutoClimbHeight(
        patch?.autoClimbMaxHeight,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.autoClimbMaxHeight,
      ),
      preserveHorizontalVelocityWhenNoInput: sanitizePhysicsBoolean(
        patch?.preserveHorizontalVelocityWhenNoInput,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.preserveHorizontalVelocityWhenNoInput,
      ),
      horizontalDampingPerSecond: normalizeDamping(
        patch?.horizontalDampingPerSecond,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.horizontalDampingPerSecond,
      ),
      airborneHorizontalDampingPerSecond: normalizeDamping(
        patch?.airborneHorizontalDampingPerSecond,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.airborneHorizontalDampingPerSecond,
      ),
      flyingDampingPerSecond: normalizeDamping(
        patch?.flyingDampingPerSecond,
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.flyingDampingPerSecond,
      ),
    };
  } catch {
    return {
      physics: createDefaultPhysicsConfig(),
      collision: { ...DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.collision },
      yawForwardSign: DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.yawForwardSign,
      autoClimbEnabled: DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.autoClimbEnabled,
      autoClimbMaxHeight: DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.autoClimbMaxHeight,
      preserveHorizontalVelocityWhenNoInput:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.preserveHorizontalVelocityWhenNoInput,
      horizontalDampingPerSecond:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.horizontalDampingPerSecond,
      airborneHorizontalDampingPerSecond:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.airborneHorizontalDampingPerSecond,
      flyingDampingPerSecond:
        DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG.flyingDampingPerSecond,
    };
  }
}

export function mergePlayerPhysicsControllerConfig(
  base: PlayerPhysicsControllerConfig | null | undefined,
  patch: PlayerPhysicsControllerConfigPatch | null | undefined,
): PlayerPhysicsControllerConfig {
  try {
    const safeBase = base ?? DEFAULT_PLAYER_PHYSICS_CONTROLLER_CONFIG;

    return createPlayerPhysicsControllerConfig({
      physics: patch?.physics
        ? mergePhysicsConfig(safeBase.physics, patch.physics)
        : safeBase.physics,
      collision: {
        ...safeBase.collision,
        ...(patch?.collision ?? {}),
      },
      yawForwardSign: patch?.yawForwardSign ?? safeBase.yawForwardSign,
      autoClimbEnabled: patch?.autoClimbEnabled ?? safeBase.autoClimbEnabled,
      autoClimbMaxHeight: patch?.autoClimbMaxHeight ?? safeBase.autoClimbMaxHeight,
      preserveHorizontalVelocityWhenNoInput:
        patch?.preserveHorizontalVelocityWhenNoInput ??
        safeBase.preserveHorizontalVelocityWhenNoInput,
      horizontalDampingPerSecond:
        patch?.horizontalDampingPerSecond ?? safeBase.horizontalDampingPerSecond,
      airborneHorizontalDampingPerSecond:
        patch?.airborneHorizontalDampingPerSecond ?? safeBase.airborneHorizontalDampingPerSecond,
      flyingDampingPerSecond:
        patch?.flyingDampingPerSecond ?? safeBase.flyingDampingPerSecond,
    });
  } catch {
    return createPlayerPhysicsControllerConfig(patch);
  }
}

export function resolvePlayerMovementMode(
  state: PlayerPhysicsState,
  collisionFlags: CollisionFlags,
): PlayerMovementMode {
  try {
    if (state.flying) {
      return "flying";
    }

    if (collisionFlags.grounded) {
      return "grounded";
    }

    return "airborne";
  } catch {
    return "airborne";
  }
}

export function computeGroundVelocity(params: {
  readonly currentVelocity: PhysicsVector3;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const movement = createYawMovementVector(params.intent, params.angles, {
      yawForwardSign: params.config.yawForwardSign,
    });

    const hasInput = Math.abs(movement.x) > 0 || Math.abs(movement.z) > 0;
    const speed = params.intent.sprintHeld
      ? params.config.physics.movement.sprintSpeed
      : params.config.physics.movement.walkSpeed;

    if (hasInput) {
      return {
        x: movement.x * speed,
        y: params.currentVelocity.y,
        z: movement.z * speed,
      };
    }

    if (params.config.preserveHorizontalVelocityWhenNoInput) {
      return {
        x: applyExponentialDamping(
          params.currentVelocity.x,
          params.config.horizontalDampingPerSecond,
          params.deltaSeconds,
        ),
        y: params.currentVelocity.y,
        z: applyExponentialDamping(
          params.currentVelocity.z,
          params.config.horizontalDampingPerSecond,
          params.deltaSeconds,
        ),
      };
    }

    return {
      x: 0,
      y: params.currentVelocity.y,
      z: 0,
    };
  } catch {
    return {
      x: 0,
      y: params.currentVelocity.y,
      z: 0,
    };
  }
}

export function computeAirborneVelocity(params: {
  readonly currentVelocity: PhysicsVector3;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const movement = createYawMovementVector(params.intent, params.angles, {
      yawForwardSign: params.config.yawForwardSign,
    });

    const hasInput = Math.abs(movement.x) > 0 || Math.abs(movement.z) > 0;
    const currentHorizontalSpeed = Math.hypot(
      params.currentVelocity.x,
      params.currentVelocity.z,
    );
    const targetSpeed = params.intent.sprintHeld
      ? params.config.physics.movement.sprintSpeed
      : Math.max(
          params.config.physics.movement.airControlSpeed,
          currentHorizontalSpeed,
        );

    if (!hasInput) {
      return {
        x: applyExponentialDamping(
          params.currentVelocity.x,
          params.config.airborneHorizontalDampingPerSecond,
          params.deltaSeconds,
        ),
        y: params.currentVelocity.y,
        z: applyExponentialDamping(
          params.currentVelocity.z,
          params.config.airborneHorizontalDampingPerSecond,
          params.deltaSeconds,
        ),
      };
    }

    /**
     * Lightweight air control:
     * move horizontal velocity toward intent direction without instantly
     * replacing momentum as strongly as grounded movement.
     */
    const blend = Math.min(1, params.deltaSeconds * 8);

    return {
      x: params.currentVelocity.x * (1 - blend) + movement.x * targetSpeed * blend,
      y: params.currentVelocity.y,
      z: params.currentVelocity.z * (1 - blend) + movement.z * targetSpeed * blend,
    };
  } catch {
    return clonePhysicsVector3(params.currentVelocity);
  }
}

export function computeFlyingVelocity(params: {
  readonly currentVelocity: PhysicsVector3;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const movement = createYawMovementVector(params.intent, params.angles, {
      yawForwardSign: params.config.yawForwardSign,
    });

    const speed = params.intent.sprintHeld
      ? params.config.physics.movement.flySprintSpeed
      : params.config.physics.movement.flySpeed;

    let vertical = 0;

    if (params.intent.ascendHeld) {
      vertical += 1;
    }

    if (params.intent.descendHeld) {
      vertical -= 1;
    }

    const hasInput = Math.abs(movement.x) > 0 || Math.abs(movement.z) > 0 || vertical !== 0;

    if (!hasInput) {
      return {
        x: applyExponentialDamping(
          params.currentVelocity.x,
          params.config.flyingDampingPerSecond,
          params.deltaSeconds,
        ),
        y: applyExponentialDamping(
          params.currentVelocity.y,
          params.config.flyingDampingPerSecond,
          params.deltaSeconds,
        ),
        z: applyExponentialDamping(
          params.currentVelocity.z,
          params.config.flyingDampingPerSecond,
          params.deltaSeconds,
        ),
      };
    }

    return {
      x: movement.x * speed,
      y: vertical * speed,
      z: movement.z * speed,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function applyGravityToVelocity(
  velocity: PhysicsVector3,
  config: PhysicsConfig,
  deltaSeconds: PhysicsDeltaSeconds,
): PhysicsVector3 {
  try {
    const gravity = sanitizePhysicsNumber(config.movement.gravity, DEFAULT_PHYSICS_CONFIG.movement.gravity);
    const maxFallSpeed = sanitizePhysicsNumber(
      config.movement.maxFallSpeed,
      DEFAULT_PHYSICS_CONFIG.movement.maxFallSpeed,
    );

    const nextY = Math.max(
      maxFallSpeed,
      sanitizePhysicsNumber(velocity.y, 0) + gravity * normalizeDeltaSeconds(deltaSeconds),
    );

    return {
      x: velocity.x,
      y: nextY,
      z: velocity.z,
    };
  } catch {
    return clonePhysicsVector3(velocity);
  }
}

export function applyJumpToVelocity(
  velocity: PhysicsVector3,
  config: PhysicsConfig,
): PhysicsVector3 {
  try {
    return {
      x: velocity.x,
      y: sanitizePhysicsNumber(config.movement.jumpVelocity, DEFAULT_PHYSICS_CONFIG.movement.jumpVelocity, {
        min: 0,
        max: 100,
      }),
      z: velocity.z,
    };
  } catch {
    return clonePhysicsVector3(velocity);
  }
}

export function computeNextVelocity(params: {
  readonly state: PlayerPhysicsState;
  readonly intent: PlayerMovementIntent;
  readonly angles: PhysicsEulerAngles;
  readonly config: PlayerPhysicsControllerConfig;
  readonly deltaSeconds: PhysicsDeltaSeconds;
  readonly nowMs: PhysicsTimestampMs;
}): {
  readonly state: PlayerPhysicsState;
  readonly velocity: PhysicsVector3;
  readonly warnings: readonly string[];
} {
  try {
    const warnings: string[] = [];
    let state = params.state;
    let velocity = clonePhysicsVector3(state.velocity);

    if (params.intent.toggleFlightRequested) {
      state = setPlayerFlying(state, !state.flying, params.nowMs);
      velocity = clonePhysicsVector3(state.velocity);
    }

    if (state.flying) {
      velocity = computeFlyingVelocity({
        currentVelocity: velocity,
        intent: params.intent,
        angles: params.angles,
        config: params.config,
        deltaSeconds: params.deltaSeconds,
      });

      return {
        state,
        velocity,
        warnings,
      };
    }

    if (state.grounded) {
      velocity = computeGroundVelocity({
        currentVelocity: {
          ...velocity,
          y: 0,
        },
        intent: params.intent,
        angles: params.angles,
        config: params.config,
        deltaSeconds: params.deltaSeconds,
      });

      if (params.intent.jumpPressed) {
        velocity = applyJumpToVelocity(velocity, params.config.physics);
        state = markPlayerAirborne(state, {
          preserveVerticalVelocity: true,
        });

        state = patchAndNormalizePlayerPhysicsState(state, {
          lastJumpAtMs: params.nowMs,
          velocity,
        });
      }
    } else {
      velocity = computeAirborneVelocity({
        currentVelocity: velocity,
        intent: params.intent,
        angles: params.angles,
        config: params.config,
        deltaSeconds: params.deltaSeconds,
      });
    }

    velocity = applyGravityToVelocity(velocity, params.config.physics, params.deltaSeconds);

    velocity = {
      x: clampVelocityComponent(
        velocity.x,
        -params.config.physics.movement.sprintSpeed * 4,
        params.config.physics.movement.sprintSpeed * 4,
      ),
      y: clampVelocityComponent(
        velocity.y,
        params.config.physics.movement.maxFallSpeed,
        Math.max(params.config.physics.movement.jumpVelocity * 2, 1),
      ),
      z: clampVelocityComponent(
        velocity.z,
        -params.config.physics.movement.sprintSpeed * 4,
        params.config.physics.movement.sprintSpeed * 4,
      ),
    };

    return {
      state,
      velocity,
      warnings,
    };
  } catch (error) {
    return {
      state: params.state,
      velocity: clonePhysicsVector3(params.state.velocity),
      warnings: [
        createWarning(
          error instanceof Error
            ? error.message
            : "Failed to compute next player velocity.",
        ),
      ],
    };
  }
}

export function createDeltaFromVelocity(
  velocity: PhysicsVector3,
  deltaSeconds: PhysicsDeltaSeconds,
): PhysicsVector3 {
  try {
    return scalePhysicsVector3(velocity, normalizeDeltaSeconds(deltaSeconds));
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function reconcileVelocityAfterCollision(params: {
  readonly requestedVelocity: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly deltaSeconds: PhysicsDeltaSeconds;
}): PhysicsVector3 {
  try {
    const requested = clonePhysicsVector3(params.requestedVelocity);
    const result = params.collisionResult;
    const dt = normalizeDeltaSeconds(params.deltaSeconds);

    if (dt <= 0) {
      return { ...ZERO_PHYSICS_VECTOR };
    }

    const velocityFromAppliedDelta = scalePhysicsVector3(result.appliedDelta, 1 / dt);

    return {
      x: result.blockedAxes.includes("x") ? 0 : velocityFromAppliedDelta.x,
      y:
        result.blockedAxes.includes("y") ||
        result.collisionFlags.grounded ||
        result.collisionFlags.hitCeiling
          ? 0
          : velocityFromAppliedDelta.y,
      z: result.blockedAxes.includes("z") ? 0 : velocityFromAppliedDelta.z,
    };
  } catch {
    return { ...ZERO_PHYSICS_VECTOR };
  }
}

export function reconcileStateAfterCollision(params: {
  readonly state: PlayerPhysicsState;
  readonly velocity: PhysicsVector3;
  readonly collisionResult: VoxelCollisionMoveResult;
  readonly nowMs: PhysicsTimestampMs;
}): PlayerPhysicsState {
  try {
    const result = params.collisionResult;
    const position = getAabbBasePositionFromResolvedAabb(result.finalAabb);
    const velocity = reconcileVelocityAfterCollision({
      requestedVelocity: params.velocity,
      collisionResult: result,
      deltaSeconds: 1,
    });

    const nextMode = params.state.flying
      ? "flying"
      : result.collisionFlags.grounded
        ? "grounded"
        : "airborne";

    let next = patchAndNormalizePlayerPhysicsState(params.state, {
      position,
      velocity,
      movementMode: nextMode,
      grounded: nextMode === "grounded",
      flying: nextMode === "flying",
      collisionFlags: result.collisionFlags,
    });

    if (nextMode === "grounded") {
      next = markPlayerGrounded(next, params.nowMs);
    }

    return next;
  } catch {
    return params.state;
  }
}

export function createFailedPhysicsStepResult(params: {
  readonly phase: PhysicsStepPhase;
  readonly previousState: PlayerPhysicsState;
  readonly angles: PhysicsEulerAngles;
  readonly message: string;
  readonly cause?: unknown;
}): PlayerPhysicsControllerStepResult {
  try {
    const camera = createPhysicsCameraBinding(params.previousState, params.angles);

    return {
      ok: false,
      phase: params.phase,
      previousState: params.previousState,
      nextState: params.previousState,
      camera,
      collisionTrace: undefined,
      error: createPhysicsError("PLAYER_PHYSICS_STEP_FAILED", params.message, {
        cause: params.cause,
        recoverable: true,
      }),
      warnings: [createWarning(params.message)],
      collisionResult: null,
      modeBefore: params.previousState.movementMode,
      modeAfter: params.previousState.movementMode,
    };
  } catch {
    return {
      ok: false,
      phase: "failed",
      previousState: params.previousState,
      nextState: params.previousState,
      camera: {
        bodyPosition: params.previousState.position,
        eyePosition: params.previousState.position,
        angles: params.angles,
      },
      error: createPhysicsError("PLAYER_PHYSICS_STEP_FAILED", "Player physics step failed.", {
        recoverable: true,
      }),
      warnings: ["Player physics step failed."],
      collisionResult: null,
      modeBefore: params.previousState.movementMode,
      modeAfter: params.previousState.movementMode,
    };
  }
}

export class PlayerPhysicsController {
  public static readonly version =
    PLAYER_PHYSICS_CONTROLLER_VERSION;
  public static readonly contractVersion =
    PLAYER_PHYSICS_CONTROLLER_CONTRACT_VERSION;
  private state: PlayerPhysicsState;
  private config: PlayerPhysicsControllerConfig;
  private readonly collisionSolver: VoxelCollisionSolver;
  private lastStep: PlayerPhysicsControllerStepResult | null;
  private revision: number;
  private lastGroundedCollisionCheckAtMs: number;

  public constructor(options: {
    readonly initialState?: PlayerPhysicsState | null;
    readonly config?: PlayerPhysicsControllerConfigPatch | null;
  } = {}) {
    this.config = createPlayerPhysicsControllerConfig(options.config);
    this.state =
      options.initialState ??
      createInitialPlayerPhysicsState(
        {
          position: { x: 0, y: 8, z: 0 },
          movementMode: "airborne",
        },
        this.config.physics,
      );

    this.collisionSolver = createVoxelCollisionSolver(this.config.collision);
    this.lastStep = null;
    this.revision = 0;
    this.lastGroundedCollisionCheckAtMs = -Infinity;
  }

  public getState(): PlayerPhysicsState {
    try {
      return this.state;
    } catch {
      return createInitialPlayerPhysicsState(null, this.config.physics);
    }
  }

  public setState(state: PlayerPhysicsState): PlayerPhysicsState {
    try {
      this.state = state;
      this.lastGroundedCollisionCheckAtMs = -Infinity;
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  public patchState(patch: Parameters<typeof patchAndNormalizePlayerPhysicsState>[1]): PlayerPhysicsState {
    try {
      this.state = patchAndNormalizePlayerPhysicsState(this.state, patch);
      this.lastGroundedCollisionCheckAtMs = -Infinity;
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  public updateConfig(config: PlayerPhysicsControllerConfigPatch | null | undefined): PlayerPhysicsControllerConfig {
    try {
      this.config = mergePlayerPhysicsControllerConfig(this.config, config);
      this.collisionSolver.updateConfig(this.config.collision);
      this.revision += 1;
      return this.config;
    } catch {
      this.config = createPlayerPhysicsControllerConfig(config);
      this.collisionSolver.updateConfig(this.config.collision);
      this.revision += 1;
      return this.config;
    }
  }

  public getConfig(): PlayerPhysicsControllerConfig {
    try {
      return {
        ...this.config,
        physics: createDefaultPhysicsConfig(this.config.physics),
        collision: {
          ...this.config.collision,
        },
      };
    } catch {
      return createPlayerPhysicsControllerConfig();
    }
  }

  public setFlying(flying: boolean, nowMs: PhysicsTimestampMs | null = null): PlayerPhysicsState {
    try {
      this.state = setPlayerFlying(this.state, flying, nowMs);
      this.lastGroundedCollisionCheckAtMs = -Infinity;
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  public reset(state: PlayerPhysicsState): PlayerPhysicsState {
    try {
      this.state = state;
      this.lastStep = null;
      this.lastGroundedCollisionCheckAtMs = -Infinity;
      this.collisionSolver.reset();
      this.revision += 1;
      return this.state;
    } catch {
      return this.state;
    }
  }

  private resolveAutoClimb(params: {
    readonly state: PlayerPhysicsState;
    readonly intent: PlayerMovementIntent;
    readonly currentAabb: PhysicsAabb;
    readonly delta: PhysicsVector3;
    readonly query: VoxelCollisionQueryLike;
    readonly collisionConfig: VoxelCollisionSolverConfigPatch;
    readonly primaryResult: VoxelCollisionMoveResult;
  }): VoxelCollisionMoveResult {
    const primary = params.primaryResult;
    try {
      const horizontalRequested = Math.hypot(params.delta.x, params.delta.z);
      const horizontalApplied = Math.hypot(
        primary.appliedDelta.x,
        primary.appliedDelta.z,
      );
      const blockedHorizontally =
        primary.blockedAxes.includes("x") ||
        primary.blockedAxes.includes("z");

      if (
        !this.config.autoClimbEnabled ||
        params.state.flying ||
        !params.state.grounded ||
        params.intent.jumpPressed ||
        params.delta.y > 0.001 ||
        horizontalRequested <= 0.0001 ||
        !blockedHorizontally ||
        primary.collisionFlags.blockedByMissingChunk
      ) {
        return primary;
      }

      const climbHeight = this.config.autoClimbMaxHeight;
      const clearance =
        Math.max(0.015, params.state.collider.skinWidth) + 0.015;
      const liftResult = this.collisionSolver.move({
        aabb: params.currentAabb,
        delta: { x: 0, y: climbHeight + clearance, z: 0 },
        query: params.query,
        config: params.collisionConfig,
      });
      if (
        !liftResult.ok ||
        liftResult.blockedAxes.includes("y") ||
        liftResult.collisionFlags.hitCeiling ||
        liftResult.collisionFlags.blockedByMissingChunk
      ) {
        return primary;
      }

      const horizontalResult = this.collisionSolver.move({
        aabb: liftResult.finalAabb,
        delta: { x: params.delta.x, y: 0, z: params.delta.z },
        query: params.query,
        config: params.collisionConfig,
      });
      const candidateHorizontalApplied = Math.hypot(
        horizontalResult.appliedDelta.x,
        horizontalResult.appliedDelta.z,
      );
      if (
        !horizontalResult.ok ||
        horizontalResult.blockedAxes.includes("x") ||
        horizontalResult.blockedAxes.includes("z") ||
        horizontalResult.collisionFlags.blockedByMissingChunk ||
        candidateHorizontalApplied < horizontalRequested * 0.85 ||
        candidateHorizontalApplied <= horizontalApplied + 0.0001
      ) {
        return primary;
      }

      const dropResult = this.collisionSolver.move({
        aabb: horizontalResult.finalAabb,
        delta: {
          x: 0,
          y: -(climbHeight + clearance + 0.08),
          z: 0,
        },
        query: params.query,
        config: params.collisionConfig,
      });
      const heightGain =
        dropResult.finalAabb.min.y - params.currentAabb.min.y;
      if (
        !dropResult.ok ||
        !dropResult.collisionFlags.grounded ||
        dropResult.collisionFlags.blockedByMissingChunk ||
        // Continuous terrain can rise by millimetres in one physics step.
        // A 4 cm minimum would turn gentle slopes into invisible walls.
        heightGain <= 0.0001 ||
        heightGain > climbHeight + clearance
      ) {
        return primary;
      }

      const appliedDelta: PhysicsVector3 = {
        x: dropResult.finalAabb.min.x - params.currentAabb.min.x,
        y: heightGain,
        z: dropResult.finalAabb.min.z - params.currentAabb.min.z,
      };
      const remainingDelta: PhysicsVector3 = {
        x: params.delta.x - appliedDelta.x,
        y: params.delta.y - appliedDelta.y,
        z: params.delta.z - appliedDelta.z,
      };
      const blockedAxes = dropResult.blockedAxes.includes("y")
        ? (["y"] as const)
        : ([] as const);

      return {
        ...dropResult,
        originalAabb: params.currentAabb,
        requestedDelta: params.delta,
        appliedDelta,
        remainingDelta,
        blockedAxes,
        axisResults: [
          ...liftResult.axisResults,
          ...horizontalResult.axisResults,
          ...dropResult.axisResults,
        ],
        collisionFlags: {
          ...dropResult.collisionFlags,
          hitWallX: false,
          hitWallZ: false,
          hitHorizontalWall: false,
          touchedSolid: true,
        },
        warnings: Array.from(
          new Set([
            ...primary.warnings,
            ...liftResult.warnings,
            ...horizontalResult.warnings,
            ...dropResult.warnings,
          ]),
        ),
      };
    } catch {
      return primary;
    }
  }

  public step(input: PlayerPhysicsControllerStepInput): PlayerPhysicsControllerStepResult {
    const previousState = this.state;
    const modeBefore = previousState.movementMode;
    const nowMs = normalizeTimestampMs(input.nowMs);
    const deltaSeconds = normalizeDeltaSeconds(input.deltaSeconds);
    const intent = normalizeMovementIntent(input.movementIntent ?? EMPTY_PLAYER_MOVEMENT_INTENT);
    const angles = normalizeAngles(input.lookAngles);

    try {
      if (!this.config.physics.enabled) {
        const camera = createPhysicsCameraBinding(previousState, angles);

        const result: PlayerPhysicsControllerStepResult = {
          ok: true,
          phase: "idle",
          previousState,
          nextState: previousState,
          camera,
          collisionResult: null,
          modeBefore,
          modeAfter: previousState.movementMode,
          warnings: [createWarning("Player physics controller is disabled.")],
        };

        this.lastStep = result;
        return result;
      }

      if (deltaSeconds <= 0) {
        const camera = createPhysicsCameraBinding(previousState, angles);

        const result: PlayerPhysicsControllerStepResult = {
          ok: true,
          phase: "idle",
          previousState,
          nextState: previousState,
          camera,
          collisionResult: null,
          modeBefore,
          modeAfter: previousState.movementMode,
          warnings: [],
        };

        this.lastStep = result;
        return result;
      }

      const velocityResult = computeNextVelocity({
        state: previousState,
        intent,
        angles,
        config: this.config,
        deltaSeconds,
        nowMs,
      });

      const stateBeforeCollision = patchAndNormalizePlayerPhysicsState(velocityResult.state, {
        velocity: velocityResult.velocity,
      });

      const currentAabb = createPlayerAabbFromPosition(
        stateBeforeCollision.position,
        stateBeforeCollision.collider,
      );

      const delta = createDeltaFromVelocity(velocityResult.velocity, deltaSeconds);
      const intentActive = isPlayerMovementIntentActive(intent);

      const canReuseGroundedState = (
        previousState.grounded
        && stateBeforeCollision.grounded
        && !stateBeforeCollision.flying
        && !intentActive
        && Math.abs(velocityResult.velocity.x) < 0.0001
        && Math.abs(velocityResult.velocity.z) < 0.0001
        && velocityResult.velocity.y <= 0
        && nowMs - this.lastGroundedCollisionCheckAtMs < 100
      );
      if (canReuseGroundedState) {
        const nextState = patchAndNormalizePlayerPhysicsState(stateBeforeCollision, {
          velocity: { x: 0, y: 0, z: 0 },
          movementMode: "grounded",
          grounded: true,
          flying: false,
          collisionFlags: previousState.collisionFlags,
        });
        this.state = nextState;
        this.revision += 1;
        const camera = createPhysicsCameraBinding(nextState, angles);
        const result: PlayerPhysicsControllerStepResult = {
          ok: true,
          phase: "idle",
          previousState,
          nextState,
          camera,
          collisionResult: null,
          modeBefore,
          modeAfter: nextState.movementMode,
          warnings: velocityResult.warnings,
        };
        this.lastStep = result;
        return result;
      }

      this.lastGroundedCollisionCheckAtMs = nowMs;

      const collisionConfig: VoxelCollisionSolverConfigPatch = {
        ...this.config.collision,
        skinWidth: stateBeforeCollision.collider.skinWidth,
        includeTraceCells:
          intentActive ||
          Boolean(this.config.collision.includeTraceCells) ||
          this.config.physics.debug.includeCollisionCells,
      };
      const primaryCollisionResult = this.collisionSolver.move({
        aabb: currentAabb,
        delta,
        query: input.query,
        config: collisionConfig,
      });
      const collisionResult = this.resolveAutoClimb({
        state: stateBeforeCollision,
        intent,
        currentAabb,
        delta,
        query: input.query,
        collisionConfig,
        primaryResult: primaryCollisionResult,
      });

      let nextState = reconcileStateAfterCollision({
        state: stateBeforeCollision,
        velocity: velocityResult.velocity,
        collisionResult,
        nowMs,
      });

      /**
       * reconcileVelocityAfterCollision above uses a normalized dt=1 when called
       * through reconcileStateAfterCollision for safe shape preservation. Correct
       * the actual velocity here using the real frame dt.
       */
      const correctedVelocity = reconcileVelocityAfterCollision({
        requestedVelocity: velocityResult.velocity,
        collisionResult,
        deltaSeconds,
      });

      nextState = patchAndNormalizePlayerPhysicsState(nextState, {
        velocity: correctedVelocity,
        movementMode: resolvePlayerMovementMode(nextState, collisionResult.collisionFlags),
        grounded: collisionResult.collisionFlags.grounded && !nextState.flying,
        flying: nextState.flying,
        collisionFlags: collisionResult.collisionFlags,
      });

      if (!nextState.flying && collisionResult.collisionFlags.grounded) {
        nextState = markPlayerGrounded(nextState, nowMs);
      }

      this.state = nextState;
      this.revision += 1;

      const camera = createPhysicsCameraBinding(nextState, angles);
      const warnings = [
        ...velocityResult.warnings,
        ...collisionResult.warnings,
      ];

      logPhysicsProbe({
        nowMs,
        deltaSeconds,
        intent,
        angles,
        previousState,
        stateBeforeCollision,
        velocityBeforeCollision: velocityResult.velocity,
        delta,
        collisionResult,
        correctedVelocity,
        nextState,
        modeBefore,
        modeAfter: nextState.movementMode,
        warnings,
      });

      const result: PlayerPhysicsControllerStepResult = {
        ok: collisionResult.ok,
        phase: collisionResult.ok ? "commit" : "failed",
        previousState,
        nextState,
        camera,
        collisionTrace: collisionResult.trace,
        error: collisionResult.ok
          ? undefined
          : createPhysicsError("PLAYER_COLLISION_FAILED", "Player collision resolution failed.", {
              recoverable: true,
            }),
        warnings,
        collisionResult,
        modeBefore,
        modeAfter: nextState.movementMode,
      };

      this.lastStep = result;
      return result;
    } catch (error) {
      const result = createFailedPhysicsStepResult({
        phase: "failed",
        previousState,
        angles,
        message:
          error instanceof Error
            ? error.message
            : "Player physics controller step failed.",
        cause: error,
      });

      this.lastStep = result;
      return result;
    }
  }

  public stepFromPhysicsInput(
    input: PhysicsStepInput & {
      readonly query: VoxelCollisionQueryLike;
    },
  ): PlayerPhysicsControllerStepResult {
    try {
      this.updateConfig({
        physics: input.config,
      });

      return this.step({
        nowMs: input.nowMs,
        deltaSeconds: input.deltaSeconds,
        movementIntent: input.movementIntent,
        lookAngles: input.lookAngles,
        query: input.query,
      });
    } catch (error) {
      return createFailedPhysicsStepResult({
        phase: "failed",
        previousState: this.state,
        angles: input.lookAngles,
        message:
          error instanceof Error
            ? error.message
            : "Failed to step player physics from PhysicsStepInput.",
        cause: error,
      });
    }
  }

  public getCameraBinding(angles: PhysicsEulerAngles = ZERO_PHYSICS_ANGLES): PhysicsCameraBinding {
    try {
      return createPhysicsCameraBinding(this.state, angles);
    } catch {
      return createPhysicsCameraBinding(this.state, ZERO_PHYSICS_ANGLES);
    }
  }

  public getStatus(): Record<string, unknown> {
    try {
      const solverSnapshot = this.collisionSolver.snapshot();

      return {
        controllerVersion: PLAYER_PHYSICS_CONTROLLER_VERSION,
        contractVersion:
          PLAYER_PHYSICS_CONTROLLER_CONTRACT_VERSION,
        physicsEnabled: Boolean(this.config.physics.enabled),
        collisionEnabled: Boolean(
          this.config.collision.enabled ?? true,
        ),
        autoClimbEnabled: this.config.autoClimbEnabled,
        autoClimbMaxHeight: this.config.autoClimbMaxHeight,
        noClipEnabled: false,
        movementMode: this.state.movementMode,
        grounded: this.state.grounded,
        flying: this.state.flying,
        revision: this.revision,
        solver: {
          version:
            (solverSnapshot as unknown as Record<string, unknown>)
              .version ?? null,
          contractVersion:
            (solverSnapshot as unknown as Record<string, unknown>)
              .contractVersion ?? null,
          revision:
            (solverSnapshot as unknown as Record<string, unknown>)
              .revision ?? null,
        },
      };
    } catch {
      return {
        controllerVersion: PLAYER_PHYSICS_CONTROLLER_VERSION,
        contractVersion:
          PLAYER_PHYSICS_CONTROLLER_CONTRACT_VERSION,
        physicsEnabled: false,
        collisionEnabled: false,
        noClipEnabled: false,
        movementMode: "airborne",
        grounded: false,
        flying: false,
        revision: this.revision,
      };
    }
  }

  public getLastStep(): PlayerPhysicsControllerStepResult | null {
    try {
      return this.lastStep;
    } catch {
      return null;
    }
  }

  public snapshot(): PlayerPhysicsControllerSnapshot {
    try {
      return {
        controllerVersion: PLAYER_PHYSICS_CONTROLLER_VERSION,
        contractVersion:
          PLAYER_PHYSICS_CONTROLLER_CONTRACT_VERSION,
        player: this.state,
        config: this.getConfig(),
        lastStep: this.lastStep,
        collisionSolver: this.collisionSolver.snapshot(),
        revision: this.revision,
      };
    } catch {
      return {
        controllerVersion: PLAYER_PHYSICS_CONTROLLER_VERSION,
        contractVersion:
          PLAYER_PHYSICS_CONTROLLER_CONTRACT_VERSION,
        player: createInitialPlayerPhysicsState(
          null,
          this.config.physics,
        ),
        config: createPlayerPhysicsControllerConfig(),
        lastStep: null,
        collisionSolver: this.collisionSolver.snapshot(),
        revision: 0,
      };
    }
  }
}

export function createPlayerPhysicsController(options: {
  readonly initialState?: PlayerPhysicsState | null;
  readonly config?: PlayerPhysicsControllerConfigPatch | null;
} = {}): PlayerPhysicsController {
  try {
    return new PlayerPhysicsController(options);
  } catch {
    return new PlayerPhysicsController();
  }
}
