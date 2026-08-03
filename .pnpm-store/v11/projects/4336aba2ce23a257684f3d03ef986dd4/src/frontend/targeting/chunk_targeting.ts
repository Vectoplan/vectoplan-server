// services/vectoplan-editor/src/frontend/targeting/chunk_targeting.ts
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import type { ChunkRegistryHandle } from "@runtime/world/chunk_registry";
import type {
  ChunkCellAddress,
  ChunkWorldPosition,
} from "@runtime/world/chunk_coordinates";
import type { RuntimeCellSample } from "@runtime/world/chunk_content";
import {
  createAirCellDescriptor,
  createCellDescriptorFromSample,
  createEmptyTargetingState,
  createInspectTarget,
  createPlacementTarget,
  createRemoveTarget,
  createTargetRay,
  targetCellToWorldPosition,
  targetingStateToDebugSummary,
  updateTargetingState,
  validateTargetingState,
  type InspectTarget,
  type PlacementTarget,
  type RemoveTarget,
  type TargetAction,
  type TargetCellDescriptor,
  type TargetRay,
  type TargetRaycastHit,
  type TargetRaycastOptions,
  type TargetSource,
  type TargetingState,
  type TargetVector3,
} from "./target_models";
import {
  createRegistryRaycastSampler,
  raycastVoxels,
} from "./raycast";

export type ChunkTargetingStatus =
  | "created"
  | "ready"
  | "updating"
  | "valid"
  | "invalid"
  | "missing-chunk"
  | "failed"
  | "destroyed";

export interface ChunkTargetingOptions {
  readonly registry: ChunkRegistryHandle;
  readonly store?: EditorStore;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly activeBlockTypeId?: string | null;
  readonly maxDistance?: number;
  readonly stepSize?: number;
  readonly maxSteps?: number;
  readonly includeAir?: boolean;
  readonly source?: TargetSource;
  readonly dispatchToStore?: boolean;
}

export interface ChunkTargetingUpdateOptions {
  readonly action?: TargetAction;
  readonly activeBlockTypeId?: string | null;
  readonly reason?: string;
  readonly dispatchToStore?: boolean;
}

export interface ChunkTargetingRayInput extends ChunkTargetingUpdateOptions {
  readonly origin: TargetVector3;
  readonly direction: TargetVector3;
  readonly maxDistance?: number;
}

export interface ChunkTargetingCameraInput extends ChunkTargetingUpdateOptions {
  readonly position: TargetVector3;
  readonly forward: TargetVector3;
  readonly maxDistance?: number;
}

export interface ChunkTargetingSnapshot {
  readonly kind: "chunk-targeting-snapshot.v1";
  readonly status: ChunkTargetingStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly updateCount: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly missingChunkCount: number;
  readonly activeBlockTypeId: string | null;
  readonly state: TargetingState;
  readonly debug: ReturnType<typeof targetingStateToDebugSummary>;
  readonly lastValidation: ReturnType<typeof validateTargetingState>;
  readonly lastError: Record<string, unknown> | null;
}

export interface ChunkTargetingCommandTargets {
  readonly action: TargetAction;
  readonly placementTarget: PlacementTarget | null;
  readonly removeTarget: RemoveTarget | null;
  readonly inspectTarget: InspectTarget | null;
  readonly placePosition: ChunkWorldPosition | null;
  readonly removePosition: ChunkWorldPosition | null;
  readonly blockTypeId: string | null;
}

export interface ChunkTargetingHandle {
  readonly kind: "vectoplan-editor-chunk-targeting.v1";

  updateFromRay(input: ChunkTargetingRayInput): TargetingState;
  updateFromCamera(input: ChunkTargetingCameraInput): TargetingState;
  updateFromHit(hit: TargetRaycastHit, options?: ChunkTargetingUpdateOptions): TargetingState;

  setActiveBlockTypeId(blockTypeId: string | null, reason?: string): TargetingState;
  setAction(action: TargetAction, reason?: string): TargetingState;

  clear(reason?: string): TargetingState;

  getStatus(): ChunkTargetingStatus;
  getState(): TargetingState;
  getSnapshot(): ChunkTargetingSnapshot;
  getCommandTargets(action?: TargetAction): ChunkTargetingCommandTargets;

  destroy(reason?: string): void;
}

const CHUNK_TARGETING_KIND = "vectoplan-editor-chunk-targeting.v1" as const;
const CHUNK_TARGETING_SNAPSHOT_KIND = "chunk-targeting-snapshot.v1" as const;

const DEFAULT_MAX_DISTANCE = 8;
const DEFAULT_STEP_SIZE = 0.08;
const DEFAULT_MAX_STEPS = 256;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    return new Date().toISOString();
  }
}

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Targeting logging must never break runtime.
  }
}

function logWarn(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.warn?.(message, details);
  } catch {
    // Targeting logging must never break runtime.
  }
}

function normalizeAction(value: unknown): TargetAction {
  const normalized = safeString(value, "inspect");

  if (normalized === "place" || normalized === "remove" || normalized === "inspect" || normalized === "none") {
    return normalized;
  }

  return "inspect";
}

function normalizeBlockTypeId(value: unknown): string | null {
  try {
    const normalized = safeString(value, "");

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeMaxDistance(value: unknown): number {
  return safeNumber(value, DEFAULT_MAX_DISTANCE, {
    min: 0.1,
    max: 512,
  });
}

function normalizeStepSize(value: unknown): number {
  return safeNumber(value, DEFAULT_STEP_SIZE, {
    min: 0.005,
    max: 1,
  });
}

function normalizeMaxSteps(value: unknown): number {
  return Math.max(1, Math.trunc(safeNumber(value, DEFAULT_MAX_STEPS, {
    min: 1,
    max: 20_000,
  })));
}

function createRaycastOptions(input: {
  readonly maxDistance?: number;
  readonly stepSize?: number;
  readonly maxSteps?: number;
  readonly includeAir?: boolean;
  readonly source?: TargetSource;
}): Partial<TargetRaycastOptions> {
  return {
    maxDistance: normalizeMaxDistance(input.maxDistance),
    stepSize: normalizeStepSize(input.stepSize),
    maxSteps: normalizeMaxSteps(input.maxSteps),
    includeAir: safeBoolean(input.includeAir, false),
    source: input.source ?? "raycast",
  };
}

function createRayFromInput(input: ChunkTargetingRayInput): TargetRay {
  return createTargetRay({
    origin: input.origin,
    direction: input.direction,
    maxDistance: normalizeMaxDistance(input.maxDistance),
  });
}

function sampleAddress(
  registry: ChunkRegistryHandle,
  address: ChunkCellAddress | null,
): RuntimeCellSample | null {
  try {
    if (!address) {
      return null;
    }

    return registry.sampleCellByAddress(address);
  } catch {
    return null;
  }
}

function descriptorFromSampleOrAddress(
  registry: ChunkRegistryHandle,
  address: ChunkCellAddress | null,
  options?: {
    readonly requireLoaded?: boolean;
    readonly allowAirFallback?: boolean;
  },
): TargetCellDescriptor | null {
  try {
    if (!address) {
      return null;
    }

    const sample = sampleAddress(registry, address);

    if (sample?.exists === true) {
      return createCellDescriptorFromSample(sample);
    }

    if (options?.requireLoaded === true && sample && "chunkLoaded" in sample && sample.chunkLoaded === false) {
      return null;
    }

    if (options?.allowAirFallback !== false) {
      return createAirCellDescriptor(address);
    }

    return null;
  } catch {
    return null;
  }
}

function placementCellAddressFromHit(hit: TargetRaycastHit): ChunkCellAddress | null {
  try {
    return hit.previousCell ?? null;
  } catch {
    return null;
  }
}

function sourceCellDescriptorFromHit(
  registry: ChunkRegistryHandle,
  hit: TargetRaycastHit,
): TargetCellDescriptor | null {
  try {
    if (hit.sample?.exists === true) {
      return createCellDescriptorFromSample(hit.sample);
    }

    return descriptorFromSampleOrAddress(registry, hit.sourceCell, {
      requireLoaded: true,
      allowAirFallback: false,
    });
  } catch {
    return null;
  }
}

function createTargetsFromHit(input: {
  readonly registry: ChunkRegistryHandle;
  readonly hit: TargetRaycastHit;
  readonly action: TargetAction;
  readonly activeBlockTypeId: string | null;
}): {
  readonly hoverTarget: InspectTarget | null;
  readonly placementTarget: PlacementTarget | null;
  readonly removeTarget: RemoveTarget | null;
} {
  const hit = input.hit;

  if (!hit.hit) {
    return {
      hoverTarget: null,
      placementTarget: null,
      removeTarget: null,
    };
  }

  const sourceCell = sourceCellDescriptorFromHit(input.registry, hit);
  const placementAddress = placementCellAddressFromHit(hit);
  const placementCell = descriptorFromSampleOrAddress(input.registry, placementAddress, {
    requireLoaded: false,
    allowAirFallback: true,
  });

  const hoverTarget = createInspectTarget({
    sourceCell,
    face: hit.face,
    normal: hit.normal,
    distance: hit.distance,
    status: sourceCell ? "valid" : "missing-chunk",
    reason: sourceCell ? null : "Source cell is not loaded.",
  });

  const placementTarget = createPlacementTarget({
    sourceCell,
    placementCell,
    blockTypeId: input.activeBlockTypeId,
    face: hit.face,
    normal: hit.normal,
    distance: hit.distance,
  });

  const removeTarget = createRemoveTarget({
    sourceCell,
    face: hit.face,
    normal: hit.normal,
    distance: hit.distance,
  });

  return {
    hoverTarget,
    placementTarget,
    removeTarget,
  };
}

function statusFromState(state: TargetingState): ChunkTargetingStatus {
  try {
    if (state.lastError) {
      return "failed";
    }

    if (state.status === "valid") {
      return "valid";
    }

    if (state.status === "missing-chunk") {
      return "missing-chunk";
    }

    if (state.status === "none") {
      return "ready";
    }

    if (state.status === "invalid" || state.status === "blocked" || state.status === "out-of-range") {
      return "invalid";
    }

    return "ready";
  } catch {
    return "failed";
  }
}

function activeTargetKeyForAction(state: TargetingState, action: TargetAction): string | null {
  try {
    if (action === "place") {
      return state.placementTarget?.key ?? null;
    }

    if (action === "remove") {
      return state.removeTarget?.key ?? null;
    }

    if (action === "inspect") {
      return state.hoverTarget?.key ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

function activeChunkKeyForAction(state: TargetingState, action: TargetAction): string | null {
  try {
    if (action === "place") {
      return state.placementTarget?.placementCell?.chunkKey
        ?? state.placementTarget?.sourceCell?.chunkKey
        ?? null;
    }

    if (action === "remove") {
      return state.removeTarget?.sourceCell?.chunkKey ?? null;
    }

    if (action === "inspect") {
      return state.hoverTarget?.sourceCell?.chunkKey ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

function dispatchToStore(
  store: EditorStore | undefined,
  state: TargetingState,
  action: TargetAction,
  source: string,
): void {
  try {
    if (!store) {
      return;
    }

    const placementCell = state.placementTarget?.placementCell ?? null;
    const sourceCell = state.removeTarget?.sourceCell ?? state.hoverTarget?.sourceCell ?? state.placementTarget?.sourceCell ?? null;
    const activeTarget =
      action === "place"
        ? state.placementTarget
        : action === "remove"
          ? state.removeTarget
          : state.hoverTarget;

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "targeting/update",
        targetKind:
          action === "place"
            ? "block-face"
            : action === "remove"
              ? "block"
              : "chunk-cell",
        status: activeTarget?.status ?? state.status,
        reason: activeTarget?.reason ?? state.reason,
        distance: activeTarget?.distance ?? state.hit?.distance ?? null,
        chunkKey: activeChunkKeyForAction(state, action),
        sourceCell: sourceCell
          ? {
              chunkKey: sourceCell.chunkKey,
              chunkX: sourceCell.address.chunkX,
              chunkY: sourceCell.address.chunkY,
              chunkZ: sourceCell.address.chunkZ,
              localX: sourceCell.address.localX,
              localY: sourceCell.address.localY,
              localZ: sourceCell.address.localZ,
              worldX: sourceCell.address.worldX,
              worldY: sourceCell.address.worldY,
              worldZ: sourceCell.address.worldZ,
              cellValue: sourceCell.cellValue,
              blockTypeId: sourceCell.blockTypeId,
            }
          : null,
        placementCell: placementCell
          ? {
              chunkKey: placementCell.chunkKey,
              chunkX: placementCell.address.chunkX,
              chunkY: placementCell.address.chunkY,
              chunkZ: placementCell.address.chunkZ,
              localX: placementCell.address.localX,
              localY: placementCell.address.localY,
              localZ: placementCell.address.localZ,
              worldX: placementCell.address.worldX,
              worldY: placementCell.address.worldY,
              worldZ: placementCell.address.worldZ,
              cellValue: placementCell.cellValue,
              blockTypeId: placementCell.blockTypeId,
            }
          : null,
        normal: activeTarget?.normal ?? state.hit?.normal ?? null,
        createdAt: new Date().toISOString(),
        source,
      }),
      {
        action: source,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break targeting.
  }
}

function countByStatus(status: ChunkTargetingStatus, counters: {
  validCount: number;
  invalidCount: number;
  missingChunkCount: number;
}): void {
  if (status === "valid") {
    counters.validCount += 1;
  }

  if (status === "invalid") {
    counters.invalidCount += 1;
  }

  if (status === "missing-chunk") {
    counters.missingChunkCount += 1;
  }
}

export function createChunkTargeting(options: ChunkTargetingOptions): ChunkTargetingHandle {
  const registry = options.registry;
  const store = options.store;
  const logger = options.logger;

  const createdAt = now();

  let status: ChunkTargetingStatus = "created";
  let state = createEmptyTargetingState("Targeting created.");
  let activeBlockTypeId = normalizeBlockTypeId(options.activeBlockTypeId);
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;
  let destroyed = false;
  let updateCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  let missingChunkCount = 0;
  let lastError: Record<string, unknown> | null = null;

  const defaultRaycastOptions = createRaycastOptions({
    maxDistance: options.maxDistance,
    stepSize: options.stepSize,
    maxSteps: options.maxSteps,
    includeAir: options.includeAir,
    source: options.source ?? "raycast",
  });

  const sampler = createRegistryRaycastSampler(registry);

  function setStatus(nextStatus: ChunkTargetingStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function assertAlive(action: string): boolean {
    if (destroyed || status === "destroyed") {
      logWarn(logger, "Chunk targeting action ignored because handle is destroyed.", {
        action,
      });
      return false;
    }

    return true;
  }

  function commitState(
    nextState: TargetingState,
    action: TargetAction,
    source: string,
    shouldDispatch: boolean,
  ): TargetingState {
    state = nextState;
    updateCount += 1;

    const nextStatus = statusFromState(nextState);
    setStatus(nextStatus);
    countByStatus(nextStatus, {
      get validCount() { return validCount; },
      set validCount(value: number) { validCount = value; },
      get invalidCount() { return invalidCount; },
      set invalidCount(value: number) { invalidCount = value; },
      get missingChunkCount() { return missingChunkCount; },
      set missingChunkCount(value: number) { missingChunkCount = value; },
    });

    if (shouldDispatch) {
      dispatchToStore(store, nextState, action, source);
    }

    return nextState;
  }

  function updateFromHit(hit: TargetRaycastHit, updateOptions?: ChunkTargetingUpdateOptions): TargetingState {
    if (!assertAlive("updateFromHit")) {
      return state;
    }

    try {
      setStatus("updating");

      const action = normalizeAction(updateOptions?.action ?? state.action ?? "inspect");
      const blockTypeId = normalizeBlockTypeId(updateOptions?.activeBlockTypeId ?? activeBlockTypeId);
      const targets = createTargetsFromHit({
        registry,
        hit,
        action,
        activeBlockTypeId: blockTypeId,
      });

      activeBlockTypeId = blockTypeId;

      const nextState = updateTargetingState(state, {
        action,
        source: options.source ?? "raycast",
        hit,
        hoverTarget: targets.hoverTarget,
        placementTarget: targets.placementTarget,
        removeTarget: targets.removeTarget,
        activeBlockTypeId: blockTypeId,
        reason: updateOptions?.reason ?? hit.reason,
      });

      const validation = validateTargetingState(nextState);

      const committed = commitState(
        validation.ok
          ? nextState
          : {
              ...nextState,
              status: validation.status,
              reason: validation.reason,
            },
        action,
        "chunk-targeting.updateFromHit",
        updateOptions?.dispatchToStore ?? options.dispatchToStore ?? true,
      );

      logDebug(logger, "Chunk targeting updated from hit.", {
        action,
        status: committed.status,
        activeTargetKey: committed.activeTargetKey,
        activeBlockTypeId: committed.activeBlockTypeId,
        reason: committed.reason,
      });

      return committed;
    } catch (error) {
      lastError = normalizeUnknownError(error);
      setStatus("failed");

      state = {
        ...state,
        status: "invalid",
        updatedAt: now(),
        reason: "Targeting update from hit failed.",
        lastError,
      };

      logWarn(logger, "Chunk targeting updateFromHit failed.", {
        error: lastError,
      });

      return state;
    }
  }

  function updateFromRay(input: ChunkTargetingRayInput): TargetingState {
    if (!assertAlive("updateFromRay")) {
      return state;
    }

    try {
      const action = normalizeAction(input.action ?? state.action ?? "inspect");
      const blockTypeId = normalizeBlockTypeId(input.activeBlockTypeId ?? activeBlockTypeId);
      const ray = createRayFromInput(input);
      const hit = raycastVoxels({
        ray,
        sampler,
        options: {
          ...defaultRaycastOptions,
          maxDistance: input.maxDistance ?? defaultRaycastOptions.maxDistance,
        },
      });

      activeBlockTypeId = blockTypeId;

      return updateFromHit(hit, {
        action,
        activeBlockTypeId: blockTypeId,
        reason: input.reason ?? "update-from-ray",
        dispatchToStore: input.dispatchToStore,
      });
    } catch (error) {
      lastError = normalizeUnknownError(error);
      setStatus("failed");

      return state;
    }
  }

  function updateFromCamera(input: ChunkTargetingCameraInput): TargetingState {
    return updateFromRay({
      origin: input.position,
      direction: input.forward,
      maxDistance: input.maxDistance,
      action: input.action,
      activeBlockTypeId: input.activeBlockTypeId,
      reason: input.reason ?? "update-from-camera",
      dispatchToStore: input.dispatchToStore,
    });
  }

  const handle: ChunkTargetingHandle = {
    kind: CHUNK_TARGETING_KIND,

    updateFromRay,
    updateFromCamera,
    updateFromHit,

    setActiveBlockTypeId(blockTypeId: string | null, reason?: string): TargetingState {
      if (!assertAlive("setActiveBlockTypeId")) {
        return state;
      }

      activeBlockTypeId = normalizeBlockTypeId(blockTypeId);

      state = updateTargetingState(state, {
        activeBlockTypeId,
        reason: reason ?? "active-block-type-changed",
      });

      setStatus(statusFromState(state));

      return state;
    },

    setAction(action: TargetAction, reason?: string): TargetingState {
      if (!assertAlive("setAction")) {
        return state;
      }

      const normalizedAction = normalizeAction(action);

      state = {
        ...updateTargetingState(state, {
          action: normalizedAction,
          reason: reason ?? "target-action-changed",
        }),
        activeTargetKey: activeTargetKeyForAction(state, normalizedAction),
        activeChunkKey: activeChunkKeyForAction(state, normalizedAction),
      };

      setStatus(statusFromState(state));

      return state;
    },

    clear(reason?: string): TargetingState {
      if (!assertAlive("clear")) {
        return state;
      }

      state = createEmptyTargetingState(reason ?? "Targeting cleared.");
      state = {
        ...state,
        activeBlockTypeId,
      };
      setStatus("ready");

      if (options.dispatchToStore ?? true) {
        try {
          store?.setState(
            (previous) => applyEditorAction(previous, {
              kind: "targeting/clear",
              reason: reason ?? "targeting-cleared",
              createdAt: now(),
              source: "chunk-targeting.clear",
            }),
            {
              action: "chunk-targeting.clear",
              notify: true,
              captureHistory: false,
            },
          );
        } catch {
          // Ignore.
        }
      }

      return state;
    },

    getStatus(): ChunkTargetingStatus {
      return status;
    },

    getState(): TargetingState {
      return state;
    },

    getSnapshot(): ChunkTargetingSnapshot {
      return {
        kind: "chunk-targeting-snapshot.v1",
        status,
        createdAt,
        updatedAt,
        destroyedAt,
        updateCount,
        validCount,
        invalidCount,
        missingChunkCount,
        activeBlockTypeId,
        state,
        debug: targetingStateToDebugSummary(state),
        lastValidation: validateTargetingState(state),
        lastError,
      };
    },

    getCommandTargets(action?: TargetAction): ChunkTargetingCommandTargets {
      const resolvedAction = normalizeAction(action ?? state.action);
      const placementTarget = state.placementTarget;
      const removeTarget = state.removeTarget;
      const inspectTarget = state.hoverTarget;

      return {
        action: resolvedAction,
        placementTarget,
        removeTarget,
        inspectTarget,
        placePosition: placementTarget?.status === "valid"
          ? targetCellToWorldPosition(placementTarget.placementCell)
          : null,
        removePosition: removeTarget?.status === "valid"
          ? targetCellToWorldPosition(removeTarget.sourceCell)
          : null,
        blockTypeId: placementTarget?.blockTypeId ?? activeBlockTypeId,
      };
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      destroyedAt = now();
      setStatus("destroyed");

      logDebug(logger, "Chunk targeting destroyed.", {
        reason: reason ?? null,
        updateCount,
        validCount,
        invalidCount,
        missingChunkCount,
      });
    },
  };

  if (options.signal) {
    try {
      if (options.signal.aborted) {
        handle.destroy("abort-signal-already-aborted");
      } else {
        options.signal.addEventListener(
          "abort",
          () => handle.destroy("abort-signal"),
          {
            once: true,
          },
        );
      }
    } catch {
      // Abort wiring is best-effort.
    }
  }

  setStatus("ready");

  logDebug(logger, "Chunk targeting created.", {
    activeBlockTypeId,
    maxDistance: defaultRaycastOptions.maxDistance,
    stepSize: defaultRaycastOptions.stepSize,
    maxSteps: defaultRaycastOptions.maxSteps,
  });

  return handle;
}

export function isChunkTargetingHandle(value: unknown): value is ChunkTargetingHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<ChunkTargetingHandle>;

    return (
      record.kind === CHUNK_TARGETING_KIND
      && typeof record.updateFromRay === "function"
      && typeof record.updateFromCamera === "function"
      && typeof record.getCommandTargets === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}