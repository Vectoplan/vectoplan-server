// services/vectoplan-editor/src/frontend/runtime/scene/scene_chunk_tools.ts
import {
  isChunkApiFailedResult,
  type ChunkApiCommandPayload,
  type ChunkApiCommandResult,
  type ChunkApiFailedResult,
  type ChunkApiWorldPosition,
} from "@api/chunk_api_models";
import type { EditorLogger } from "@utils/logger";
import { createEditorId } from "@utils/ids";
import { normalizeUnknownError, safeBoolean, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { EditorStore } from "@state/editor_store";
import { applyEditorAction } from "@state/state_actions";
import {
  selectActiveBlockTypeId,
  selectSelectedBlockTypeId,
  selectSelectedInventoryItem,
  selectSelectedPlacementRef,
} from "@state/state_selectors";
import type { WorldRuntimeHandle } from "@runtime/world/world_runtime";
import type {
  ChunkSourceCommandResult,
  ChunkSourceCommandOptions,
} from "@runtime/world/chunk_source";
import type {
  ChunkTargetingCommandTargets,
  ChunkTargetingHandle,
} from "@targeting/chunk_targeting";
import type {
  PlacementTarget,
  RemoveTarget,
  TargetAction,
  TargetingState,
} from "@targeting/target_models";
import type { PreviewRendererHandle } from "@render/preview_renderer";

export type SceneChunkToolsStatus =
  | "created"
  | "ready"
  | "executing"
  | "blocked"
  | "degraded"
  | "failed"
  | "destroyed";

export type SceneChunkToolAction =
  | "place"
  | "remove"
  | "inspect"
  | "none";

export type SceneChunkToolTrigger =
  | "primary-pointer"
  | "secondary-pointer"
  | "keyboard"
  | "toolbar"
  | "script"
  | "manual";

export interface SceneChunkToolsOptions {
  readonly worldRuntime: WorldRuntimeHandle;
  readonly targeting: ChunkTargetingHandle;
  readonly store?: EditorStore;
  readonly preview?: PreviewRendererHandle | null;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;

  readonly enabled?: boolean;
  readonly remoteCommandsEnabled?: boolean;
  readonly reloadDirtyChunksAfterCommand?: boolean;
  readonly dispatchToStore?: boolean;

  readonly userId?: string;
  readonly sessionId?: string;

  /**
   * Must return the active hotbar/inventory block type id.
   * This remains frontend-only. The backend may later change the inventory source
   * from placeholder blocks to a creative/library source without changing this tool.
   */
  readonly getActiveBlockTypeId?: () => string | null;

  readonly onCommandApplied?: (result: ChunkSourceCommandResult) => void;
  readonly onCommandFailed?: (result: ChunkApiFailedResult) => void;
}

export interface SceneChunkToolExecutionOptions {
  readonly trigger?: SceneChunkToolTrigger;
  readonly reason?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly reloadDirtyChunksAfterCommand?: boolean;
  readonly signal?: AbortSignal;
  readonly dispatchToStore?: boolean;
}

export interface SceneChunkToolExecutionResult {
  readonly ok: boolean;
  readonly action: SceneChunkToolAction;
  readonly trigger: SceneChunkToolTrigger;
  readonly command: ChunkApiCommandPayload | null;
  readonly commandResult: ChunkApiCommandResult | null;
  readonly sourceResult: ChunkSourceCommandResult | null;
  readonly failure: ChunkApiFailedResult | null;
  readonly targetKey: string | null;
  readonly chunkKey: string | null;
  readonly blockTypeId: string | null;
  readonly position: ChunkApiWorldPosition | null;
  readonly dirtyChunks: readonly string[];
  readonly changedChunks: readonly string[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly elapsedMs: number;
}

export interface SceneChunkToolsSnapshot {
  readonly kind: "scene-chunk-tools-snapshot.v1";
  readonly id: string;
  readonly status: SceneChunkToolsStatus;
  readonly enabled: boolean;
  readonly remoteCommandsEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly destroyedAt: string | null;
  readonly executionCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly blockedCount: number;
  readonly lastAction: SceneChunkToolAction;
  readonly lastTrigger: SceneChunkToolTrigger | null;
  readonly lastBlockTypeId: string | null;
  readonly lastTargetKey: string | null;
  readonly lastChunkKey: string | null;
  readonly lastDirtyChunks: readonly string[];
  readonly lastChangedChunks: readonly string[];
  readonly lastResult: SceneChunkToolExecutionResult | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface SceneChunkToolsHandle {
  readonly kind: "vectoplan-editor-scene-chunk-tools.v1";

  initialize(): void;

  executePrimary(options?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult>;
  executeSecondary(options?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult>;

  placeBlock(options?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult>;
  removeBlock(options?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult>;

  previewCurrentTarget(reason?: string): void;
  clearPreview(reason?: string): void;

  setEnabled(enabled: boolean, reason?: string): void;
  setRemoteCommandsEnabled(enabled: boolean, reason?: string): void;

  getStatus(): SceneChunkToolsStatus;
  getSnapshot(): SceneChunkToolsSnapshot;

  destroy(reason?: string): void;
}

const SCENE_CHUNK_TOOLS_KIND = "vectoplan-editor-scene-chunk-tools.v1" as const;
const SCENE_CHUNK_TOOLS_SNAPSHOT_KIND = "scene-chunk-tools-snapshot.v1" as const;

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "unknown-time";
    }
  }
}

function nowMs(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
  }
}

function elapsedMs(startedAtMs: number): number {
  try {
    return Math.max(0, Math.round(nowMs() - startedAtMs));
  } catch {
    return 0;
  }
}

function normalizeErrorRecord(error: unknown): Record<string, unknown> {
  try {
    const normalized = normalizeUnknownError(error);

    if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
      return normalized as Record<string, unknown>;
    }

    return {
      name: "UnknownError",
      message: String(normalized),
    };
  } catch {
    try {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
        };
      }

      return {
        name: "UnknownError",
        message: String(error),
      };
    } catch {
      return {
        name: "UnknownError",
        message: "Unknown scene chunk tools error.",
      };
    }
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
    // Tool logging must never break editor interaction.
  }
}

function logInfo(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.info?.(message, details);
  } catch {
    // Tool logging must never break editor interaction.
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
    // Tool logging must never break editor interaction.
  }
}

function normalizeTrigger(value: unknown, fallback: SceneChunkToolTrigger): SceneChunkToolTrigger {
  const normalized = safeString(value, fallback);

  if (
    normalized === "primary-pointer"
    || normalized === "secondary-pointer"
    || normalized === "keyboard"
    || normalized === "toolbar"
    || normalized === "script"
    || normalized === "manual"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizeBlockTypeId(value: unknown): string | null {
  try {
    const normalized = safeString(value, "");

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function positionFromPlacementTarget(target: PlacementTarget | null): ChunkApiWorldPosition | null {
  try {
    const cell = target?.placementCell;

    if (!cell || target.status !== "valid") {
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

function positionFromRemoveTarget(target: RemoveTarget | null): ChunkApiWorldPosition | null {
  try {
    const cell = target?.sourceCell;

    if (!cell || target.status !== "valid") {
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

function createFailedResult(input: {
  readonly code: string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown> | null;
  readonly raw?: unknown;
}): ChunkApiFailedResult {
  return {
    ok: false,
    request: null,
    source: "client-fallback",
    raw: input.raw ?? null,
    error: {
      code: input.code,
      message: input.message,
      retryable: input.retryable ?? false,
      statusCode: null,
      requestId: null,
      requestKind: null,
      url: null,
      method: null,
      exceptionType: null,
      details: input.details ?? null,
    },
  };
}

function failedFromUnknown(error: unknown, message: string): ChunkApiFailedResult {
  const normalized = normalizeErrorRecord(error);

  return {
    ok: false,
    request: null,
    source: "client-fallback",
    raw: error,
    error: {
      code: safeString(normalized.code, "scene_chunk_tools_error"),
      message: safeString(normalized.message, message),
      retryable: true,
      statusCode: null,
      requestId: null,
      requestKind: null,
      url: null,
      method: null,
      exceptionType: safeString(normalized.name, null as unknown as string),
      details: normalized.details as Record<string, unknown> | null ?? null,
    },
  };
}

function commandPayloadFromAction(input: {
  readonly action: SceneChunkToolAction;
  readonly position: ChunkApiWorldPosition | null;
  readonly blockTypeId: string | null;
  readonly userId: string;
  readonly sessionId: string;
}): ChunkApiCommandPayload | null {
  try {
    if (!input.position) {
      return null;
    }

    if (input.action === "place") {
      if (!input.blockTypeId) {
        return null;
      }

      return {
        type: "SetBlock",
        userId: input.userId,
        sessionId: input.sessionId,
        position: input.position,
        blockTypeId: input.blockTypeId,
      };
    }

    if (input.action === "remove") {
      return {
        type: "RemoveBlock",
        userId: input.userId,
        sessionId: input.sessionId,
        position: input.position,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function dispatchCommandPending(
  store: EditorStore | undefined,
  command: ChunkApiCommandPayload | null,
): void {
  try {
    if (!store || !command) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "command/pending",
        command,
        createdAt: now(),
        source: "scene-chunk-tools.command-pending",
      }),
      {
        action: "scene-chunk-tools.command-pending",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break tool execution.
  }
}

function dispatchCommandResult(
  store: EditorStore | undefined,
  result: ChunkApiCommandResult | null,
): void {
  try {
    if (!store || !result) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "command/result",
        result,
        createdAt: now(),
        source: "scene-chunk-tools.command-result",
      }),
      {
        action: "scene-chunk-tools.command-result",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break tool execution.
  }
}

function dispatchCommandFailure(
  store: EditorStore | undefined,
  failure: ChunkApiFailedResult | null,
): void {
  try {
    if (!store || !failure) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "command/failed",
        error: failure,
        createdAt: now(),
        source: "scene-chunk-tools.command-failed",
      }),
      {
        action: "scene-chunk-tools.command-failed",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break tool execution.
  }
}

function dispatchDirtyChunks(
  store: EditorStore | undefined,
  dirtyChunks: readonly string[],
): void {
  try {
    if (!store || dirtyChunks.length === 0) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "world/dirty-chunks",
        dirtyChunkKeys: dirtyChunks,
        createdAt: now(),
        source: "scene-chunk-tools.dirty-chunks",
      }),
      {
        action: "scene-chunk-tools.dirty-chunks",
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store dispatch must not break tool execution.
  }
}

function dispatchDebugWarning(
  store: EditorStore | undefined,
  warning: string,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "debug/warning",
        warning,
        createdAt: now(),
        source: "scene-chunk-tools",
      }),
      {
        action: "scene-chunk-tools.warning",
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Ignore.
  }
}

function dispatchDebugError(
  store: EditorStore | undefined,
  error: unknown,
): void {
  try {
    if (!store) {
      return;
    }

    store.setState(
      (previous) => applyEditorAction(previous, {
        kind: "debug/error",
        error,
        createdAt: now(),
        source: "scene-chunk-tools",
      }),
      {
        action: "scene-chunk-tools.error",
        notify: false,
        captureHistory: false,
      },
    );
  } catch {
    // Ignore.
  }
}

function createExecutionResult(input: {
  readonly ok: boolean;
  readonly action: SceneChunkToolAction;
  readonly trigger: SceneChunkToolTrigger;
  readonly command: ChunkApiCommandPayload | null;
  readonly commandResult: ChunkApiCommandResult | null;
  readonly sourceResult: ChunkSourceCommandResult | null;
  readonly failure: ChunkApiFailedResult | null;
  readonly targetKey: string | null;
  readonly chunkKey: string | null;
  readonly blockTypeId: string | null;
  readonly position: ChunkApiWorldPosition | null;
  readonly dirtyChunks: readonly string[];
  readonly changedChunks: readonly string[];
  readonly startedAt: string;
  readonly startedAtMs: number;
}): SceneChunkToolExecutionResult {
  return {
    ok: input.ok,
    action: input.action,
    trigger: input.trigger,
    command: input.command,
    commandResult: input.commandResult,
    sourceResult: input.sourceResult,
    failure: input.failure,
    targetKey: input.targetKey,
    chunkKey: input.chunkKey,
    blockTypeId: input.blockTypeId,
    position: input.position,
    dirtyChunks: input.dirtyChunks,
    changedChunks: input.changedChunks,
    startedAt: input.startedAt,
    completedAt: now(),
    elapsedMs: elapsedMs(input.startedAtMs),
  };
}

function userIdFromOptions(defaultUserId: string | undefined, options?: SceneChunkToolExecutionOptions): string {
  return safeString(options?.userId ?? defaultUserId, "editor_user");
}

function sessionIdFromOptions(defaultSessionId: string | undefined, options?: SceneChunkToolExecutionOptions): string {
  return safeString(options?.sessionId ?? defaultSessionId, `editor_session_${Date.now()}`);
}

function targetForAction(
  targeting: ChunkTargetingHandle,
  action: TargetAction,
): ChunkTargetingCommandTargets {
  return targeting.getCommandTargets(action);
}

function callOptionalMethod(
  value: unknown,
  methodName: string,
  args: readonly unknown[],
): boolean {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const method = (value as Record<string, unknown>)[methodName];

    if (typeof method !== "function") {
      return false;
    }

    method.call(value, ...args);
    return true;
  } catch {
    return false;
  }
}

function syncTargetingActiveBlockTypeId(
  targeting: ChunkTargetingHandle,
  blockTypeId: string | null,
  reason: string,
): void {
  try {
    if (!blockTypeId) {
      return;
    }

    callOptionalMethod(targeting, "setActiveBlockTypeId", [blockTypeId, reason]);
  } catch {
    // Targeting sync must not break placement.
  }
}

function previewFromTarget(
  preview: PreviewRendererHandle | null | undefined,
  targets: ChunkTargetingCommandTargets,
  action: SceneChunkToolAction,
  activeBlockTypeId?: string | null,
): void {
  try {
    if (!preview) {
      return;
    }

    const blockTypeId = activeBlockTypeId ?? targets.blockTypeId ?? null;

    if (action === "place" && targets.placementTarget) {
      preview.update({
        target: {
          kind: "place",
          address: targets.placementTarget.placementCell?.address ?? null,
          normal: targets.placementTarget.normal,
          blockTypeId,
          valid: targets.placementTarget.status === "valid",
          reason: targets.placementTarget.reason,
        },
        paletteEntry: targets.placementTarget.placementCell?.paletteEntry ?? null,
        visible: targets.placementTarget.status === "valid",
        reason: "scene-chunk-tools.preview-place",
      });
      return;
    }

    if (action === "remove" && targets.removeTarget) {
      preview.update({
        target: {
          kind: "remove",
          address: targets.removeTarget.sourceCell?.address ?? null,
          normal: targets.removeTarget.normal,
          blockTypeId: targets.removeTarget.blockTypeId,
          cellValue: targets.removeTarget.sourceCell?.cellValue ?? null,
          valid: targets.removeTarget.status === "valid",
          reason: targets.removeTarget.reason,
        },
        paletteEntry: targets.removeTarget.sourceCell?.paletteEntry ?? null,
        visible: targets.removeTarget.status === "valid",
        reason: "scene-chunk-tools.preview-remove",
      });
      return;
    }

    preview.hide("scene-chunk-tools.no-target");
  } catch {
    // Preview must not break command tools.
  }
}

export function createSceneChunkTools(options: SceneChunkToolsOptions): SceneChunkToolsHandle {
  const id = createEditorId({
    prefix: "scene_chunk_tools",
  });
  const worldRuntime = options.worldRuntime;
  const targeting = options.targeting;
  const store = options.store;
  const preview = options.preview ?? null;
  const logger = options.logger;

  const createdAt = now();

  let status: SceneChunkToolsStatus = "created";
  let enabled = safeBoolean(options.enabled, true);
  let remoteCommandsEnabled = safeBoolean(options.remoteCommandsEnabled, true);
  let destroyed = false;
  let updatedAt = createdAt;
  let destroyedAt: string | null = null;

  let executionCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let blockedCount = 0;

  let lastAction: SceneChunkToolAction = "none";
  let lastTrigger: SceneChunkToolTrigger | null = null;
  let lastBlockTypeId: string | null = null;
  let lastTargetKey: string | null = null;
  let lastChunkKey: string | null = null;
  let lastDirtyChunks: readonly string[] = [];
  let lastChangedChunks: readonly string[] = [];
  let lastResult: SceneChunkToolExecutionResult | null = null;
  let lastError: Record<string, unknown> | null = null;

  function setStatus(nextStatus: SceneChunkToolsStatus): void {
    status = nextStatus;
    updatedAt = now();
  }

  function assertAlive(action: string): ChunkApiFailedResult | null {
    if (destroyed || status === "destroyed") {
      return createFailedResult({
        code: "scene_chunk_tools_destroyed",
        message: `SceneChunkTools is destroyed. Action '${action}' is not allowed.`,
        retryable: false,
      });
    }

    return null;
  }

  function resolveActiveBlockTypeId(): string | null {
    try {
      const fromCallback = options.getActiveBlockTypeId?.();
      const normalizedCallbackValue = normalizeBlockTypeId(fromCallback);

      if (normalizedCallbackValue) {
        return normalizedCallbackValue;
      }

      if (store) {
        const state = store.peekState();

        return (
          normalizeBlockTypeId(selectSelectedBlockTypeId(state))
          ?? normalizeBlockTypeId(selectSelectedInventoryItem(state)?.blockTypeId)
          ?? normalizeBlockTypeId(selectActiveBlockTypeId(state))
        );
      }

      return null;
    } catch {
      return null;
    }
  }

  function resolveSelectedInventoryDebug(): Record<string, unknown> | null {
    try {
      if (!store) {
        return null;
      }

      const state = store.peekState();
      const selectedItem = selectSelectedInventoryItem(state);
      const placementRef = selectSelectedPlacementRef(state);

      return {
        selectedSlot: state.inventory.selectedSlotIndex ?? state.inventory.selectedSlot,
        selectedBlockTypeId: state.inventory.selectedBlockTypeId,
        selectedItemBlockTypeId: selectedItem?.blockTypeId ?? null,
        selectedItemEnabled: selectedItem?.enabled ?? null,
        selectedItemPlaceable: selectedItem?.placeable ?? null,
        placementRef,
      };
    } catch {
      return null;
    }
  }

  function markExecution(result: SceneChunkToolExecutionResult): SceneChunkToolExecutionResult {
    executionCount += 1;
    lastResult = result;
    lastAction = result.action;
    lastTrigger = result.trigger;
    lastBlockTypeId = result.blockTypeId;
    lastTargetKey = result.targetKey;
    lastChunkKey = result.chunkKey;
    lastDirtyChunks = result.dirtyChunks;
    lastChangedChunks = result.changedChunks;

    if (result.ok) {
      successCount += 1;
      lastError = null;
      setStatus("ready");
    } else {
      failureCount += 1;
      lastError = result.failure ? normalizeErrorRecord(result.failure.error) : null;
      setStatus("failed");
    }

    return result;
  }

  function markBlocked(result: SceneChunkToolExecutionResult): SceneChunkToolExecutionResult {
    blockedCount += 1;
    lastResult = result;
    lastAction = result.action;
    lastTrigger = result.trigger;
    lastBlockTypeId = result.blockTypeId;
    lastTargetKey = result.targetKey;
    lastChunkKey = result.chunkKey;
    lastDirtyChunks = result.dirtyChunks;
    lastChangedChunks = result.changedChunks;
    setStatus("blocked");
    return result;
  }

  function makeBlockedResult(input: {
    readonly action: SceneChunkToolAction;
    readonly trigger: SceneChunkToolTrigger;
    readonly message: string;
    readonly targetKey?: string | null;
    readonly chunkKey?: string | null;
    readonly blockTypeId?: string | null;
    readonly position?: ChunkApiWorldPosition | null;
    readonly startedAt: string;
    readonly startedAtMs: number;
    readonly details?: Record<string, unknown>;
  }): SceneChunkToolExecutionResult {
    const failure = createFailedResult({
      code: "scene_chunk_tool_blocked",
      message: input.message,
      retryable: false,
      details: input.details ?? null,
    });

    dispatchDebugWarning(store, input.message);

    return markBlocked(
      createExecutionResult({
        ok: false,
        action: input.action,
        trigger: input.trigger,
        command: null,
        commandResult: null,
        sourceResult: null,
        failure,
        targetKey: input.targetKey ?? null,
        chunkKey: input.chunkKey ?? null,
        blockTypeId: input.blockTypeId ?? null,
        position: input.position ?? null,
        dirtyChunks: [],
        changedChunks: [],
        startedAt: input.startedAt,
        startedAtMs: input.startedAtMs,
      }),
    );
  }

  async function executeAction(
    action: SceneChunkToolAction,
    executionOptions?: SceneChunkToolExecutionOptions,
  ): Promise<SceneChunkToolExecutionResult> {
    const startedAt = now();
    const startedAtMs = nowMs();
    const trigger = normalizeTrigger(
      executionOptions?.trigger,
      action === "place" ? "primary-pointer" : action === "remove" ? "secondary-pointer" : "manual",
    );

    const aliveFailure = assertAlive(`execute:${action}`);

    if (aliveFailure) {
      return markExecution(
        createExecutionResult({
          ok: false,
          action,
          trigger,
          command: null,
          commandResult: null,
          sourceResult: null,
          failure: aliveFailure,
          targetKey: null,
          chunkKey: null,
          blockTypeId: null,
          position: null,
          dirtyChunks: [],
          changedChunks: [],
          startedAt,
          startedAtMs,
        }),
      );
    }

    if (!enabled) {
      return makeBlockedResult({
        action,
        trigger,
        message: "Chunk tools are disabled.",
        startedAt,
        startedAtMs,
      });
    }

    if (!remoteCommandsEnabled) {
      return makeBlockedResult({
        action,
        trigger,
        message: "Remote chunk commands are disabled.",
        startedAt,
        startedAtMs,
      });
    }

    setStatus("executing");

    try {
      const activeBlockTypeId = action === "place" ? resolveActiveBlockTypeId() : null;

      if (action === "place") {
        syncTargetingActiveBlockTypeId(targeting, activeBlockTypeId, "scene-chunk-tools.execute-place");
      }

      const targets = targetForAction(
        targeting,
        action === "place" ? "place" : action === "remove" ? "remove" : "inspect",
      );

      previewFromTarget(preview, targets, action, activeBlockTypeId);

      if (action === "place" && !activeBlockTypeId) {
        return makeBlockedResult({
          action,
          trigger,
          message: "No active block type is selected.",
          targetKey: targets.placementTarget?.key ?? null,
          chunkKey: targets.placementTarget?.placementCell?.chunkKey ?? null,
          blockTypeId: null,
          position: null,
          startedAt,
          startedAtMs,
          details: {
            selectedInventory: resolveSelectedInventoryDebug(),
          },
        });
      }

      const position = action === "place"
        ? positionFromPlacementTarget(targets.placementTarget)
        : action === "remove"
          ? positionFromRemoveTarget(targets.removeTarget)
          : null;

      const targetKey = action === "place"
        ? targets.placementTarget?.key ?? null
        : action === "remove"
          ? targets.removeTarget?.key ?? null
          : null;

      const chunkKey = action === "place"
        ? targets.placementTarget?.placementCell?.chunkKey ?? null
        : action === "remove"
          ? targets.removeTarget?.sourceCell?.chunkKey ?? null
          : null;

      if (!position) {
        return makeBlockedResult({
          action,
          trigger,
          message: action === "place"
            ? targets.placementTarget?.reason ?? "No valid placement target."
            : targets.removeTarget?.reason ?? "No valid remove target.",
          targetKey,
          chunkKey,
          blockTypeId: activeBlockTypeId,
          position: null,
          startedAt,
          startedAtMs,
          details: {
            placementStatus: targets.placementTarget?.status ?? null,
            removeStatus: targets.removeTarget?.status ?? null,
            selectedInventory: resolveSelectedInventoryDebug(),
          },
        });
      }

      const userId = userIdFromOptions(options.userId, executionOptions);
      const sessionId = sessionIdFromOptions(options.sessionId, executionOptions);
      const command = commandPayloadFromAction({
        action,
        position,
        blockTypeId: activeBlockTypeId,
        userId,
        sessionId,
      });

      const dispatch = executionOptions?.dispatchToStore ?? options.dispatchToStore ?? true;

      if (dispatch) {
        dispatchCommandPending(store, command);
      }

      if (!command) {
        return makeBlockedResult({
          action,
          trigger,
          message: action === "place"
            ? "SetBlock command could not be created."
            : "RemoveBlock command could not be created.",
          targetKey,
          chunkKey,
          blockTypeId: activeBlockTypeId,
          position,
          startedAt,
          startedAtMs,
          details: {
            selectedInventory: resolveSelectedInventoryDebug(),
          },
        });
      }

      const commandOptions: ChunkSourceCommandOptions = {
        userId,
        sessionId,
        reloadDirtyChunks:
          executionOptions?.reloadDirtyChunksAfterCommand
          ?? options.reloadDirtyChunksAfterCommand
          ?? true,
        reason: executionOptions?.reason ?? `scene-chunk-tools:${action}`,
      };

      if (executionOptions?.signal) {
        Object.assign(commandOptions, {
          signal: executionOptions.signal,
        });
      }

      const sourceResult = action === "place"
        ? await worldRuntime.getSource().setBlock(position, activeBlockTypeId ?? "", commandOptions)
        : await worldRuntime.getSource().removeBlock(position, commandOptions);

      if (isChunkApiFailedResult(sourceResult)) {
        if (dispatch) {
          dispatchCommandFailure(store, sourceResult);
        }

        options.onCommandFailed?.(sourceResult);
        dispatchDebugError(store, sourceResult);

        return markExecution(
          createExecutionResult({
            ok: false,
            action,
            trigger,
            command,
            commandResult: null,
            sourceResult: null,
            failure: sourceResult,
            targetKey,
            chunkKey,
            blockTypeId: activeBlockTypeId,
            position,
            dirtyChunks: [],
            changedChunks: [],
            startedAt,
            startedAtMs,
          }),
        );
      }

      const commandResult = sourceResult.result;
      const dirtyChunks = sourceResult.dirtyChunks;
      const changedChunks = sourceResult.changedChunks;

      if (dispatch) {
        dispatchCommandResult(store, commandResult);
        dispatchDirtyChunks(store, dirtyChunks);
      }

      options.onCommandApplied?.(sourceResult);

      return markExecution(
        createExecutionResult({
          ok: true,
          action,
          trigger,
          command,
          commandResult,
          sourceResult,
          failure: null,
          targetKey,
          chunkKey,
          blockTypeId: activeBlockTypeId,
          position,
          dirtyChunks,
          changedChunks,
          startedAt,
          startedAtMs,
        }),
      );
    } catch (error) {
      const failure = failedFromUnknown(error, `Scene chunk tool action '${action}' failed.`);

      if (executionOptions?.dispatchToStore ?? options.dispatchToStore ?? true) {
        dispatchCommandFailure(store, failure);
      }

      dispatchDebugError(store, error);

      logWarn(logger, "Scene chunk tool execution failed.", {
        action,
        trigger,
        error: normalizeErrorRecord(error),
      });

      return markExecution(
        createExecutionResult({
          ok: false,
          action,
          trigger,
          command: null,
          commandResult: null,
          sourceResult: null,
          failure,
          targetKey: null,
          chunkKey: null,
          blockTypeId: action === "place" ? resolveActiveBlockTypeId() : null,
          position: null,
          dirtyChunks: [],
          changedChunks: [],
          startedAt,
          startedAtMs,
        }),
      );
    }
  }

  function previewCurrentTarget(reason?: string): void {
    try {
      const currentState: TargetingState = targeting.getState();
      const action: SceneChunkToolAction =
        currentState.action === "place"
          ? "place"
          : currentState.action === "remove"
            ? "remove"
            : "inspect";

      const activeBlockTypeId = action === "place" ? resolveActiveBlockTypeId() : null;

      if (action === "place") {
        syncTargetingActiveBlockTypeId(targeting, activeBlockTypeId, reason ?? "scene-chunk-tools.preview");
      }

      const targets = targeting.getCommandTargets(currentState.action);
      previewFromTarget(preview, targets, action, activeBlockTypeId);

      logDebug(logger, "Scene chunk tool preview updated.", {
        reason: reason ?? null,
        action,
        targetKey: currentState.activeTargetKey,
        activeBlockTypeId,
      });
    } catch (error) {
      logWarn(logger, "Scene chunk tool preview failed.", {
        reason: reason ?? null,
        error: normalizeErrorRecord(error),
      });
    }
  }

  function clearPreview(reason?: string): void {
    try {
      preview?.hide(reason ?? "scene-chunk-tools.clear-preview");
    } catch {
      // Ignore.
    }
  }

  const handle: SceneChunkToolsHandle = {
    kind: SCENE_CHUNK_TOOLS_KIND,

    initialize(): void {
      const aliveFailure = assertAlive("initialize");

      if (aliveFailure) {
        setStatus("destroyed");
        return;
      }

      setStatus(enabled ? "ready" : "blocked");

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

      logInfo(logger, "Scene chunk tools initialized.", {
        id,
        enabled,
        remoteCommandsEnabled,
      });
    },

    executePrimary(executionOptions?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult> {
      return executeAction("place", {
        ...executionOptions,
        trigger: executionOptions?.trigger ?? "primary-pointer",
      });
    },

    executeSecondary(executionOptions?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult> {
      return executeAction("remove", {
        ...executionOptions,
        trigger: executionOptions?.trigger ?? "secondary-pointer",
      });
    },

    placeBlock(executionOptions?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult> {
      return executeAction("place", executionOptions);
    },

    removeBlock(executionOptions?: SceneChunkToolExecutionOptions): Promise<SceneChunkToolExecutionResult> {
      return executeAction("remove", executionOptions);
    },

    previewCurrentTarget,
    clearPreview,

    setEnabled(nextEnabled: boolean, reason?: string): void {
      if (destroyed) {
        return;
      }

      enabled = safeBoolean(nextEnabled, enabled);
      setStatus(enabled ? "ready" : "blocked");

      logDebug(logger, "Scene chunk tools enabled state changed.", {
        enabled,
        reason: reason ?? null,
      });
    },

    setRemoteCommandsEnabled(nextEnabled: boolean, reason?: string): void {
      if (destroyed) {
        return;
      }

      remoteCommandsEnabled = safeBoolean(nextEnabled, remoteCommandsEnabled);
      setStatus(remoteCommandsEnabled && enabled ? "ready" : "blocked");

      logDebug(logger, "Scene chunk tools remote command state changed.", {
        remoteCommandsEnabled,
        reason: reason ?? null,
      });
    },

    getStatus(): SceneChunkToolsStatus {
      return status;
    },

    getSnapshot(): SceneChunkToolsSnapshot {
      return {
        kind: SCENE_CHUNK_TOOLS_SNAPSHOT_KIND,
        id,
        status,
        enabled,
        remoteCommandsEnabled,
        createdAt,
        updatedAt,
        destroyedAt,
        executionCount,
        successCount,
        failureCount,
        blockedCount,
        lastAction,
        lastTrigger,
        lastBlockTypeId,
        lastTargetKey,
        lastChunkKey,
        lastDirtyChunks,
        lastChangedChunks,
        lastResult,
        lastError,
      };
    },

    destroy(reason?: string): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      destroyedAt = now();

      clearPreview(reason ?? "scene-chunk-tools.destroy");
      setStatus("destroyed");

      logInfo(logger, "Scene chunk tools destroyed.", {
        id,
        reason: reason ?? null,
        executionCount,
        successCount,
        failureCount,
        blockedCount,
      });
    },
  };

  logDebug(logger, "Scene chunk tools created.", {
    id,
    enabled,
    remoteCommandsEnabled,
  });

  return handle;
}

export function isSceneChunkToolsHandle(value: unknown): value is SceneChunkToolsHandle {
  try {
    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Partial<SceneChunkToolsHandle>;

    return (
      record.kind === SCENE_CHUNK_TOOLS_KIND
      && typeof record.initialize === "function"
      && typeof record.executePrimary === "function"
      && typeof record.executeSecondary === "function"
      && typeof record.destroy === "function"
    );
  } catch {
    return false;
  }
}