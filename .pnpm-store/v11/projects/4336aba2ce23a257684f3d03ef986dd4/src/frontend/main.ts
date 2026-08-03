// services/vectoplan-editor/src/frontend/main.ts
import { createChunkApiClient } from "@api/chunk_api_client";
import "./styles/realtime_environment.css";
import type { ChunkApiClient } from "@api/chunk_api_models";
import type { EditorBootstrap, EditorBootstrapDefaults } from "@bootstrap/bootstrap_models";
import { normalizeEditorBootstrap } from "@bootstrap/normalize_bootstrap";
import { readEditorBootstrap } from "@bootstrap/read_bootstrap";
import {
  installRuntimeConfigWindowGlobals,
  readRuntimeConfig,
  runtimeConfigToBootstrapDefaults,
  type RuntimeConfig,
} from "@config/runtime_config";
import {
  bindEditorDomRefs,
  clearDomFatalError,
  hideDomLoadingOverlay,
  setDomBootMessage,
  setDomLiveMessage,
  setDomSourceStatus,
  showDomFatalError,
  type EditorDomRefs,
} from "@dom/dom_refs";
import { mountCreativeInventoryPanel } from "@inventory/creative_inventory_panel";
import { createSceneRuntime, type SceneRuntimeHandle } from "@scene/scene_runtime";
import { createInitialEditorState, type EditorState } from "@state/editor_state";
import { createEditorStore, type EditorStore } from "@state/editor_store";
import { createWorldRuntime, type WorldRuntimeHandle } from "@runtime/world/world_runtime";
import { createLogger, type EditorLogger } from "@utils/logger";
import { getErrorMessage, normalizeUnknownError } from "@utils/safe";
import { nowIsoString } from "@utils/time";

declare const __VECTOPLAN_EDITOR_BUILD_MODE__: string;
declare const __VECTOPLAN_EDITOR_BUILD_VERSION__: string;
declare const __VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__: string;
declare const __VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__: string;
declare const __VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__: string;
declare const __VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__: boolean;

type RuntimeLifecycleStatus =
  | "created"
  | "initializing"
  | "ready"
  | "failed"
  | "destroying"
  | "destroyed";

interface RuntimeDestroyOptions {
  readonly reason?: string;
  readonly source?: string;
  readonly waitForAsyncCleanup?: boolean;
}

interface RuntimeReloadOptions {
  readonly reason?: string;
  readonly force?: boolean;
}

export interface VectoplanEditorRuntimeHandle {
  readonly kind: "vectoplan-editor-runtime-handle.v1";
  readonly bootId: string;
  readonly buildMode: string;
  readonly buildVersion: string;
  readonly createdAt: string;

  getLifecycleStatus(): RuntimeLifecycleStatus;
  getRuntimeConfig(): RuntimeConfig;
  getBootstrap(): EditorBootstrap;
  getStore(): EditorStore;
  getState(): EditorState;
  getChunkApiClient(): ChunkApiClient;
  getWorldRuntime(): WorldRuntimeHandle;
  getSceneRuntime(): SceneRuntimeHandle;
  getSource(): unknown;

  requestFullRefresh(options?: RuntimeReloadOptions): Promise<void>;
  reloadDirtyChunks(options?: RuntimeReloadOptions): Promise<void>;
  destroy(options?: RuntimeDestroyOptions): Promise<void>;
}

const ROOT_SELECTOR = "[data-editor-root], [data-vectoplan-editor-root], #vectoplan-editor-root";
const RUNTIME_EVENT_READY = "vectoplan-editor:ready";
const RUNTIME_EVENT_FAILED = "vectoplan-editor:failed";
const RUNTIME_EVENT_DESTROYED = "vectoplan-editor:destroyed";
const FRONTEND_ROOT = "services/vectoplan-editor/src/frontend" as const;
const PRODUCTIVE_INVENTORY_ROUTE = "/editor/api/inventory" as const;
const CREATIVE_LIBRARY_ROUTE = "/editor/api/library" as const;

function readBuildString(value: unknown, fallback: string): string {
  try {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
  } catch {
    return fallback;
  }
}

function readBuildBoolean(value: unknown, fallback: boolean): boolean {
  try {
    return typeof value === "boolean" ? value : fallback;
  } catch {
    return fallback;
  }
}

const BUILD_MODE = readBuildString(
  typeof __VECTOPLAN_EDITOR_BUILD_MODE__ === "undefined"
    ? undefined
    : __VECTOPLAN_EDITOR_BUILD_MODE__,
  "development",
);

const BUILD_VERSION = readBuildString(
  typeof __VECTOPLAN_EDITOR_BUILD_VERSION__ === "undefined"
    ? undefined
    : __VECTOPLAN_EDITOR_BUILD_VERSION__,
  "0.1.0",
);

const DEFAULT_CHUNK_PROXY_BASE_URL = readBuildString(
  typeof __VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__ === "undefined"
    ? undefined
    : __VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__,
  "/editor/api/chunk",
);

const DEFAULT_PROJECT_ID = readBuildString(
  typeof __VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__ === "undefined"
    ? undefined
    : __VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__,
  "dev-project",
);

const DEFAULT_WORLD_ID = readBuildString(
  typeof __VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__ === "undefined"
    ? undefined
    : __VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__,
  "world_spawn",
);

const LOCAL_WORLD_FALLBACK_ENABLED = readBuildBoolean(
  typeof __VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__ === "undefined"
    ? undefined
    : __VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__,
  false,
);

function now(): string {
  try {
    return nowIsoString();
  } catch {
    try {
      return new Date().toISOString();
    } catch {
      return "1970-01-01T00:00:00.000Z";
    }
  }
}

function createBootId(): string {
  try {
    const randomValue =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    return `editor_boot_${Date.now()}_${randomValue}`;
  } catch {
    return `editor_boot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function incrementBootCount(): number {
  try {
    const previous = Number.isFinite(window.__VECTOPLAN_EDITOR_BOOT_COUNT__)
      ? Number(window.__VECTOPLAN_EDITOR_BOOT_COUNT__)
      : 0;

    const next = previous + 1;
    window.__VECTOPLAN_EDITOR_BOOT_COUNT__ = next;

    return next;
  } catch {
    return 1;
  }
}

function resolveRootElement(): HTMLElement {
  try {
    const element = document.querySelector<HTMLElement>(ROOT_SELECTOR);

    if (!element) {
      throw new Error(`Editor root element not found. Expected selector: ${ROOT_SELECTOR}`);
    }

    return element;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Editor root element could not be resolved."));
  }
}

function isProductiveInventoryRoute(value: unknown): boolean {
  try {
    if (typeof value !== "string") {
      return false;
    }

    const normalized = value.trim();

    return normalized === PRODUCTIVE_INVENTORY_ROUTE || normalized.includes(PRODUCTIVE_INVENTORY_ROUTE);
  } catch {
    return false;
  }
}

function setDatasetValue(element: HTMLElement | null, key: string, value: unknown): void {
  try {
    if (!element) {
      return;
    }

    if (value === undefined || value === null || value === "") {
      delete element.dataset[key];
      return;
    }

    element.dataset[key] = String(value);
  } catch {
    // Dataset diagnostics must not break boot.
  }
}

function syncRootDatasetWithRuntime(
  refs: EditorDomRefs,
  runtimeConfig: RuntimeConfig,
  bootstrap: EditorBootstrap,
  bootId: string,
): void {
  try {
    setDatasetValue(refs.root, "editorBootId", bootId);
    setDatasetValue(refs.root, "editorBuildMode", runtimeConfig.buildMode);
    setDatasetValue(refs.root, "editorBuildVersion", runtimeConfig.buildVersion);

    setDatasetValue(refs.root, "runtimeMode", bootstrap.runtime.mode);
    setDatasetValue(refs.root, "worldMode", bootstrap.runtime.worldMode);
    setDatasetValue(refs.root, "worldSourceKind", bootstrap.runtime.sourceMode);
    setDatasetValue(refs.root, "chunkServiceEnabled", "true");
    setDatasetValue(refs.root, "chunkServiceApiBaseUrl", bootstrap.runtime.chunk.apiBaseUrl);
    setDatasetValue(refs.root, "chunkServiceProjectId", bootstrap.runtime.chunk.projectId);
    setDatasetValue(refs.root, "chunkServiceWorldId", bootstrap.runtime.chunk.worldId);

    setDatasetValue(refs.root, "localWorldFallbackEnabled", "false");
    setDatasetValue(refs.root, "legacyFrontendEnabled", "false");

    setDatasetValue(refs.root, "inventoryEnabled", bootstrap.inventory.enabled ? "true" : "false");
    setDatasetValue(refs.root, "inventorySource", bootstrap.inventory.source);
    setDatasetValue(refs.root, "inventoryKind", bootstrap.inventory.kind);
    setDatasetValue(refs.root, "inventoryApiUrl", bootstrap.inventory.apiUrl);
    setDatasetValue(refs.root, "inventoryUrl", bootstrap.inventory.inventoryUrl);
    setDatasetValue(refs.root, "inventoryRoute", bootstrap.inventory.route);
    setDatasetValue(refs.root, "inventoryHealthUrl", bootstrap.inventory.healthUrl);
    setDatasetValue(refs.root, "inventoryMetadataUrl", bootstrap.inventory.metadataUrl);
    setDatasetValue(refs.root, "inventoryHotbarSize", bootstrap.inventory.hotbarSize);
    setDatasetValue(refs.root, "inventorySlotCount", bootstrap.inventory.slotCount);
    setDatasetValue(refs.root, "inventorySelectedSlot", bootstrap.inventory.selectedSlot);
    setDatasetValue(refs.root, "inventoryOnlyLibraryItemsPlaceable", "true");
    setDatasetValue(refs.root, "inventoryDebugGrassDirtAllowed", "false");
    setDatasetValue(refs.root, "inventoryAllowChunkPlaceableFallback", "false");

    setDatasetValue(refs.root, "libraryEnabled", bootstrap.creativeLibrary.enabled ? "true" : "false");
    setDatasetValue(refs.root, "libraryApiUrl", bootstrap.creativeLibrary.apiUrl);
    setDatasetValue(refs.root, "libraryInventoryRoute", bootstrap.runtime.library.inventoryRoute);
    setDatasetValue(refs.root, "creativeLibraryRoute", bootstrap.creativeLibrary.route);
    setDatasetValue(refs.root, "libraryBrowserCallsLibraryDirectly", "false");

    setDatasetValue(refs.root, "chunkServiceInventoryEnabled", "false");
    setDatasetValue(refs.root, "chunkPaletteInventoryFallbackEnabled", "false");
    setDatasetValue(refs.root, "placeableBlocksPlaceholderRouteEnabled", "false");
    setDatasetValue(refs.root, "legacyChunkInventoryEnabled", "false");

    setDatasetValue(refs.root, "editorInventoryTruth", PRODUCTIVE_INVENTORY_ROUTE);
    setDatasetValue(refs.root, "productiveInventoryRoute", PRODUCTIVE_INVENTORY_ROUTE);
    setDatasetValue(refs.root, "legacyChunkBlocksDiagnosticOnly", "true");
    setDatasetValue(refs.root, "browserCallsVectoplanLibraryDirectly", "false");
  } catch {
    // Dataset synchronization is diagnostic-only.
  }
}

function installRuntimeDiagnosticsWindowGlobals(
  runtimeConfig: RuntimeConfig,
  bootstrap: EditorBootstrap,
  bootId: string,
): void {
  try {
    window.__VECTOPLAN_EDITOR_BOOT_ID__ = bootId;
    window.__VECTOPLAN_EDITOR_INVENTORY_ROUTE__ = bootstrap.inventory.route;
    window.__VECTOPLAN_EDITOR_PRODUCTIVE_INVENTORY_ROUTE__ = PRODUCTIVE_INVENTORY_ROUTE;
    window.__VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__ = bootstrap.creativeLibrary.route;
    window.__VECTOPLAN_EDITOR_ONLY_LIBRARY_ITEMS_PLACEABLE__ = true;
    window.__VECTOPLAN_EDITOR_DEBUG_GRASS_DIRT_ALLOWED__ = false;
    window.__VECTOPLAN_EDITOR_LEGACY_CHUNK_INVENTORY_ENABLED__ = false;
    window.__VECTOPLAN_EDITOR_CHUNK_SERVICE_INVENTORY_ENABLED__ = false;
    window.__VECTOPLAN_EDITOR_CHUNK_PALETTE_INVENTORY_FALLBACK_ENABLED__ = false;
    window.__VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_PLACEHOLDER_ROUTE_ENABLED__ = false;
    window.__VECTOPLAN_EDITOR_BROWSER_CALLS_LIBRARY_DIRECTLY__ = false;
    window.__VECTOPLAN_EDITOR_RUNTIME_CONFIG__ = runtimeConfig;
    window.__VECTOPLAN_EDITOR_BOOTSTRAP__ = bootstrap;
  } catch {
    // Window diagnostics are optional.
  }
}

function dispatchRuntimeEvent(
  name: string,
  detail: Record<string, unknown>,
  logger?: EditorLogger,
): void {
  try {
    const eventDetail = {
      service: "vectoplan-editor",
      frontendRoot: FRONTEND_ROOT,
      timestamp: now(),
      inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
      browserCallsVectoplanLibraryDirectly: false,
      ...detail,
    };

    window.dispatchEvent(
      new CustomEvent(name, {
        detail: eventDetail,
      }),
    );

    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: name,
          kind: name,
          source: "vectoplan-editor",
          detail: eventDetail,
        },
        "*",
      );
    }
  } catch (error) {
    try {
      logger?.warn("Runtime event dispatch failed.", {
        eventName: name,
        error: normalizeUnknownError(error),
      });
    } catch {
      // Event dispatch must never break boot.
    }
  }
}

function postCurrentEditorStatusToParent(): void {
  try {
    if (window.parent === window || window.__VECTOPLAN_EDITOR_READY__ !== true) {
      return;
    }

    const runtime =
      window.__VECTOPLAN_EDITOR_RUNTIME__
      ?? window.__VECTOPLAN_RUNTIME__
      ?? window.vectoplanEditorRuntime
      ?? window.editorRuntime;
    const bootstrap = runtime?.getBootstrap();
    const eventDetail = {
      service: "vectoplan-editor",
      frontendRoot: FRONTEND_ROOT,
      timestamp: now(),
      inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
      browserCallsVectoplanLibraryDirectly: false,
      bootId: runtime?.bootId ?? window.__VECTOPLAN_EDITOR_LAST_BOOT_ID__ ?? null,
      projectId: bootstrap?.runtime.chunk.projectId ?? null,
      worldId: bootstrap?.runtime.chunk.worldId ?? null,
      replayed: true,
    };

    window.parent.postMessage(
      {
        type: RUNTIME_EVENT_READY,
        kind: RUNTIME_EVENT_READY,
        source: "vectoplan-editor",
        detail: eventDetail,
      },
      "*",
    );
  } catch {
    // Parent status replay is best-effort.
  }
}

function wireParentRuntimeStatusBridge(): void {
  try {
    window.addEventListener("message", (event: MessageEvent) => {
      const data = event?.data;
      const type = String(data?.type ?? data?.kind ?? "").toLowerCase();
      if (
        event.source !== window.parent
        || String(data?.source ?? "").toLowerCase() !== "vectoplan-app"
        || type !== "vectoplan-app:editor-status-request"
      ) {
        return;
      }

      postCurrentEditorStatusToParent();
    });
  } catch {
    // Embedded status bridge is optional.
  }
}

function assertRemoteChunkOnly(bootstrap: EditorBootstrap, runtimeConfig: RuntimeConfig): void {
  const problems: string[] = [];

  try {
    if (runtimeConfig.featureFlags.localWorldFallbackEnabled !== false) {
      problems.push("runtimeConfig.featureFlags.localWorldFallbackEnabled must be false.");
    }

    if (runtimeConfig.featureFlags.legacyFrontendEnabled !== false) {
      problems.push("runtimeConfig.featureFlags.legacyFrontendEnabled must be false.");
    }

    if (bootstrap.runtime.localWorldFallbackEnabled !== false) {
      problems.push("bootstrap.runtime.localWorldFallbackEnabled must be false.");
    }

    if (bootstrap.runtime.legacyFrontendEnabled !== false) {
      problems.push("bootstrap.runtime.legacyFrontendEnabled must be false.");
    }

    if (bootstrap.runtime.chunk.enabled !== true) {
      problems.push("bootstrap.runtime.chunk.enabled must be true.");
    }

    if (bootstrap.runtime.worldMode !== "chunk_service") {
      problems.push("bootstrap.runtime.worldMode must be chunk_service.");
    }

    if (bootstrap.runtime.sourceMode !== "chunk-service") {
      problems.push("bootstrap.runtime.sourceMode must be chunk-service.");
    }

    if (!bootstrap.runtime.chunk.apiBaseUrl || bootstrap.runtime.chunk.apiBaseUrl.trim().length === 0) {
      problems.push("bootstrap.runtime.chunk.apiBaseUrl is empty.");
    }

    if (!bootstrap.runtime.chunk.projectId || bootstrap.runtime.chunk.projectId.trim().length === 0) {
      problems.push("bootstrap.runtime.chunk.projectId is empty.");
    }

    if (!bootstrap.runtime.chunk.worldId || bootstrap.runtime.chunk.worldId.trim().length === 0) {
      problems.push("bootstrap.runtime.chunk.worldId is empty.");
    }
  } catch (error) {
    problems.push(getErrorMessage(error, "Remote chunk bootstrap validation failed."));
  }

  if (problems.length > 0) {
    throw new Error(`Invalid editor bootstrap. ${problems.join(" ")}`);
  }
}

function assertLibraryInventoryOnly(bootstrap: EditorBootstrap, runtimeConfig: RuntimeConfig): void {
  const problems: string[] = [];

  try {
    if (runtimeConfig.featureFlags.chunkServiceInventoryEnabled !== false) {
      problems.push("runtimeConfig.featureFlags.chunkServiceInventoryEnabled must be false.");
    }

    if (runtimeConfig.featureFlags.chunkPaletteInventoryFallbackEnabled !== false) {
      problems.push("runtimeConfig.featureFlags.chunkPaletteInventoryFallbackEnabled must be false.");
    }

    if (runtimeConfig.featureFlags.placeableBlocksPlaceholderRouteEnabled !== false) {
      problems.push("runtimeConfig.featureFlags.placeableBlocksPlaceholderRouteEnabled must be false.");
    }

    if (runtimeConfig.featureFlags.legacyChunkInventoryEnabled !== false) {
      problems.push("runtimeConfig.featureFlags.legacyChunkInventoryEnabled must be false.");
    }

    if (runtimeConfig.featureFlags.onlyLibraryItemsPlaceable !== true) {
      problems.push("runtimeConfig.featureFlags.onlyLibraryItemsPlaceable must be true.");
    }

    if (runtimeConfig.featureFlags.debugGrassDirtAllowed !== false) {
      problems.push("runtimeConfig.featureFlags.debugGrassDirtAllowed must be false.");
    }

    if (runtimeConfig.inventory.onlyLibraryItemsPlaceable !== true) {
      problems.push("runtimeConfig.inventory.onlyLibraryItemsPlaceable must be true.");
    }

    if (runtimeConfig.inventory.debugGrassDirtAllowed !== false) {
      problems.push("runtimeConfig.inventory.debugGrassDirtAllowed must be false.");
    }

    if (runtimeConfig.inventory.allowChunkPlaceableFallback !== false) {
      problems.push("runtimeConfig.inventory.allowChunkPlaceableFallback must be false.");
    }

    if (bootstrap.featureFlags.chunkServiceInventoryEnabled !== false) {
      problems.push("bootstrap.featureFlags.chunkServiceInventoryEnabled must be false.");
    }

    if (bootstrap.featureFlags.chunkPaletteInventoryFallbackEnabled !== false) {
      problems.push("bootstrap.featureFlags.chunkPaletteInventoryFallbackEnabled must be false.");
    }

    if (bootstrap.featureFlags.placeableBlocksPlaceholderRouteEnabled !== false) {
      problems.push("bootstrap.featureFlags.placeableBlocksPlaceholderRouteEnabled must be false.");
    }

    if (bootstrap.featureFlags.legacyChunkInventoryEnabled !== false) {
      problems.push("bootstrap.featureFlags.legacyChunkInventoryEnabled must be false.");
    }

    if (bootstrap.featureFlags.onlyLibraryItemsPlaceable !== true) {
      problems.push("bootstrap.featureFlags.onlyLibraryItemsPlaceable must be true.");
    }

    if (bootstrap.featureFlags.debugGrassDirtAllowed !== false) {
      problems.push("bootstrap.featureFlags.debugGrassDirtAllowed must be false.");
    }

    if (bootstrap.inventory.onlyLibraryItemsPlaceable !== true) {
      problems.push("bootstrap.inventory.onlyLibraryItemsPlaceable must be true.");
    }

    if (bootstrap.inventory.debugGrassDirtAllowed !== false) {
      problems.push("bootstrap.inventory.debugGrassDirtAllowed must be false.");
    }

    if (bootstrap.inventory.allowChunkPlaceableFallback !== false) {
      problems.push("bootstrap.inventory.allowChunkPlaceableFallback must be false.");
    }

    if (!isProductiveInventoryRoute(runtimeConfig.inventory.apiUrl)) {
      problems.push(`runtimeConfig.inventory.apiUrl must point to ${PRODUCTIVE_INVENTORY_ROUTE}.`);
    }

    if (!isProductiveInventoryRoute(bootstrap.inventory.apiUrl)) {
      problems.push(`bootstrap.inventory.apiUrl must point to ${PRODUCTIVE_INVENTORY_ROUTE}.`);
    }

    if (!isProductiveInventoryRoute(bootstrap.runtime.library.inventoryRoute)) {
      problems.push(`bootstrap.runtime.library.inventoryRoute must point to ${PRODUCTIVE_INVENTORY_ROUTE}.`);
    }

    if (bootstrap.runtime.library.browserCallsLibraryDirectly !== false) {
      problems.push("bootstrap.runtime.library.browserCallsLibraryDirectly must be false.");
    }

    if (runtimeConfig.library.browserCallsLibraryDirectly !== false) {
      problems.push("runtimeConfig.library.browserCallsLibraryDirectly must be false.");
    }
  } catch (error) {
    problems.push(getErrorMessage(error, "Library inventory bootstrap validation failed."));
  }

  if (problems.length > 0) {
    throw new Error(`Invalid Library/VPLIB inventory bootstrap. ${problems.join(" ")}`);
  }
}

async function safeDestroyPart(
  label: string,
  value: unknown,
  logger: EditorLogger,
  options: RuntimeDestroyOptions,
): Promise<void> {
  try {
    if (!value || typeof value !== "object") {
      return;
    }

    const maybeDestroy = (value as { destroy?: unknown }).destroy;

    if (typeof maybeDestroy !== "function") {
      return;
    }

    const reason = options.reason ?? "runtime.destroy";
    const result = maybeDestroy.call(value, reason);

    if (
      options.waitForAsyncCleanup !== false
      && result
      && typeof (result as PromiseLike<void>).then === "function"
    ) {
      await result;
    }
  } catch (error) {
    logger.warn(`${label} destroy failed.`, {
      error: normalizeUnknownError(error),
      reason: options.reason ?? "unknown",
      source: options.source ?? "unknown",
    });
  }
}

function clearWindowRuntimeIfCurrent(runtime: VectoplanEditorRuntimeHandle): void {
  try {
    if (window.__VECTOPLAN_EDITOR_RUNTIME__ === runtime) {
      window.__VECTOPLAN_EDITOR_RUNTIME__ = undefined;
    }

    if (window.__VECTOPLAN_RUNTIME__ === runtime) {
      window.__VECTOPLAN_RUNTIME__ = undefined;
    }

    if (window.vectoplanEditorRuntime === runtime) {
      window.vectoplanEditorRuntime = undefined;
    }

    if (window.editorRuntime === runtime) {
      window.editorRuntime = undefined;
    }
  } catch {
    // Window cleanup must never throw.
  }
}

async function destroyExistingRuntime(logger: EditorLogger, reason: string): Promise<void> {
  try {
    const existing =
      window.__VECTOPLAN_EDITOR_RUNTIME__ ??
      window.__VECTOPLAN_RUNTIME__ ??
      window.vectoplanEditorRuntime ??
      window.editorRuntime;

    if (!existing || typeof existing.destroy !== "function") {
      return;
    }

    await existing.destroy({
      reason,
      source: "main.destroyExistingRuntime",
      waitForAsyncCleanup: true,
    });
  } catch (error) {
    logger.warn("Existing runtime could not be destroyed before boot.", {
      error: normalizeUnknownError(error),
      reason,
    });
  }
}

function installWindowRuntime(runtime: VectoplanEditorRuntimeHandle): void {
  try {
    window.__VECTOPLAN_EDITOR_RUNTIME__ = runtime;
    window.__VECTOPLAN_RUNTIME__ = runtime;
    window.vectoplanEditorRuntime = runtime;
    window.editorRuntime = runtime;
    window.__VECTOPLAN_EDITOR_LAST_BOOT_ID__ = runtime.bootId;
  } catch {
    // Runtime can still operate without debug globals.
  }
}

function updateStoreLifecycle(
  store: EditorStore,
  status: RuntimeLifecycleStatus,
  input?: {
    readonly reason?: string | null;
    readonly bootAttemptCount?: number;
  },
): void {
  try {
    store.setState(
      (previous) => ({
        ...previous,
        lifecycle: {
          ...previous.lifecycle,
          status,
          bootAttemptCount: input?.bootAttemptCount ?? previous.lifecycle.bootAttemptCount,
          updatedAt: now(),
          readyAt: status === "ready" ? now() : previous.lifecycle.readyAt,
          failedAt: status === "failed" ? now() : previous.lifecycle.failedAt,
          destroyedAt: status === "destroyed" ? now() : previous.lifecycle.destroyedAt,
          lastReason: input?.reason ?? previous.lifecycle.lastReason,
        },
      }),
      {
        action: `main.lifecycle.${status}`,
        notify: true,
        captureHistory: false,
      },
    );
  } catch {
    // Store lifecycle sync is best-effort.
  }
}

function createRuntimeHandle(input: {
  readonly bootId: string;
  readonly runtimeConfig: RuntimeConfig;
  readonly bootstrap: EditorBootstrap;
  readonly store: EditorStore;
  readonly chunkApiClient: ChunkApiClient;
  readonly worldRuntime: WorldRuntimeHandle;
  readonly sceneRuntime: SceneRuntimeHandle;
  readonly logger: EditorLogger;
  readonly domRefs: EditorDomRefs;
  readonly abortController: AbortController;
}): VectoplanEditorRuntimeHandle {
  let lifecycleStatus: RuntimeLifecycleStatus = "created";
  let destroyPromise: Promise<void> | null = null;

  const setLifecycleStatus = (
    status: RuntimeLifecycleStatus,
    reason?: string | null,
  ): void => {
    lifecycleStatus = status;
    updateStoreLifecycle(input.store, status, {
      reason,
    });
  };

  const runtime: VectoplanEditorRuntimeHandle = {
    kind: "vectoplan-editor-runtime-handle.v1",
    bootId: input.bootId,
    buildMode: input.runtimeConfig.buildMode,
    buildVersion: input.runtimeConfig.buildVersion,
    createdAt: now(),

    getLifecycleStatus(): RuntimeLifecycleStatus {
      return lifecycleStatus;
    },

    getRuntimeConfig(): RuntimeConfig {
      return input.runtimeConfig;
    },

    getBootstrap(): EditorBootstrap {
      return input.bootstrap;
    },

    getStore(): EditorStore {
      return input.store;
    },

    getState(): EditorState {
      return input.store.getState();
    },

    getChunkApiClient(): ChunkApiClient {
      return input.chunkApiClient;
    },

    getWorldRuntime(): WorldRuntimeHandle {
      return input.worldRuntime;
    },

    getSceneRuntime(): SceneRuntimeHandle {
      return input.sceneRuntime;
    },

    getSource(): unknown {
      try {
        return input.worldRuntime.getSource();
      } catch (error) {
        input.logger.warn("Runtime source could not be read.", {
          error: normalizeUnknownError(error),
        });

        return null;
      }
    },

    async requestFullRefresh(options?: RuntimeReloadOptions): Promise<void> {
      try {
        setDomLiveMessage(
          input.domRefs,
          options?.reason ?? "Vollständige Chunk-Aktualisierung wird angefordert.",
        );

        await input.sceneRuntime.requestFullRefresh(options?.reason ?? "main.runtimeHandle.requestFullRefresh");
      } catch (sceneError) {
        input.logger.warn("Scene full refresh failed. Falling back to world runtime refresh.", {
          error: normalizeUnknownError(sceneError),
          reason: options?.reason ?? "unknown",
        });

        await input.worldRuntime.requestFullRefresh({
          reason: options?.reason ?? "main.runtimeHandle.requestFullRefresh.fallback",
          force: options?.force ?? true,
        });
      }
    },

    async reloadDirtyChunks(options?: RuntimeReloadOptions): Promise<void> {
      try {
        await input.sceneRuntime.reloadDirtyChunks(options?.reason ?? "main.runtimeHandle.reloadDirtyChunks");
      } catch (sceneError) {
        input.logger.warn("Scene dirty chunk reload failed. Falling back to world runtime reload.", {
          error: normalizeUnknownError(sceneError),
          reason: options?.reason ?? "unknown",
        });

        await input.worldRuntime.reloadDirtyChunks({
          reason: options?.reason ?? "main.runtimeHandle.reloadDirtyChunks.fallback",
          force: options?.force ?? false,
        });
      }
    },

    async destroy(options?: RuntimeDestroyOptions): Promise<void> {
      if (destroyPromise) {
        return destroyPromise;
      }

      destroyPromise = (async () => {
        if (lifecycleStatus === "destroyed" || lifecycleStatus === "destroying") {
          return;
        }

        const destroyOptions: RuntimeDestroyOptions = {
          reason: options?.reason ?? "runtime.destroy",
          source: options?.source ?? "main.runtimeHandle",
          waitForAsyncCleanup: options?.waitForAsyncCleanup ?? true,
        };

        setLifecycleStatus("destroying", destroyOptions.reason);

        input.logger.info("Destroying VECTOPLAN editor runtime.", {
          bootId: input.bootId,
          reason: destroyOptions.reason,
          source: destroyOptions.source,
          inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
        });

        try {
          input.abortController.abort(destroyOptions.reason);
        } catch {
          // Abort is best-effort.
        }

        await safeDestroyPart("SceneRuntime", input.sceneRuntime, input.logger, destroyOptions);
        await safeDestroyPart("WorldRuntime", input.worldRuntime, input.logger, destroyOptions);
        await safeDestroyPart("ChunkApiClient", input.chunkApiClient, input.logger, destroyOptions);

        setLifecycleStatus("destroyed", destroyOptions.reason);

        await safeDestroyPart("EditorStore", input.store, input.logger, destroyOptions);

        clearWindowRuntimeIfCurrent(runtime);

        try {
          window.__VECTOPLAN_EDITOR_READY__ = false;
        } catch {
          // Window globals are diagnostic only.
        }

        dispatchRuntimeEvent(
          RUNTIME_EVENT_DESTROYED,
          {
            bootId: input.bootId,
            reason: destroyOptions.reason,
            source: destroyOptions.source,
            inventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
          },
          input.logger,
        );
      })();

      return destroyPromise;
    },
  };

  return runtime;
}

async function initializeRuntime(runtime: VectoplanEditorRuntimeHandle): Promise<void> {
  const sceneRuntime = runtime.getSceneRuntime();

  if (typeof sceneRuntime.initialize !== "function") {
    throw new Error("SceneRuntime does not provide initialize().");
  }

  await sceneRuntime.initialize();
}

function bootstrapDefaultsFromRuntimeConfig(runtimeConfig: RuntimeConfig): EditorBootstrapDefaults {
  try {
    return runtimeConfigToBootstrapDefaults(runtimeConfig);
  } catch {
    return {
      buildMode: BUILD_MODE,
      buildVersion: BUILD_VERSION,
      chunkProxyBaseUrl: DEFAULT_CHUNK_PROXY_BASE_URL,
      projectId: DEFAULT_PROJECT_ID,
      worldId: DEFAULT_WORLD_ID,
      localWorldFallbackEnabled: false,
    };
  }
}

async function bootVectoplanEditor(trigger: string): Promise<VectoplanEditorRuntimeHandle | null> {
  const bootId = createBootId();
  const bootAttemptCount = incrementBootCount();
  const logger = createLogger({
    namespace: "vectoplan-editor:main",
    buildMode: BUILD_MODE,
    buildVersion: BUILD_VERSION,
    bootId,
  });

  let domRefs: EditorDomRefs | null = null;
  let runtime: VectoplanEditorRuntimeHandle | null = null;

  try {
    logger.info("Booting VECTOPLAN editor frontend.", {
      bootId,
      bootAttemptCount,
      trigger,
      buildMode: BUILD_MODE,
      buildVersion: BUILD_VERSION,
      frontendRoot: FRONTEND_ROOT,
      localWorldFallbackEnabled: LOCAL_WORLD_FALLBACK_ENABLED,
      inventoryTruth: PRODUCTIVE_INVENTORY_ROUTE,
      creativeLibraryRoute: CREATIVE_LIBRARY_ROUTE,
    });

    await destroyExistingRuntime(logger, `new-boot:${trigger}`);

    const rootElement = resolveRootElement();
    const runtimeConfig = readRuntimeConfig({
      rootElement,
    });

    installRuntimeConfigWindowGlobals(runtimeConfig);

    for (const configWarning of runtimeConfig.warnings) {
      logger.warn("Runtime config warning.", {
        warning: configWarning,
      });
    }

    domRefs = bindEditorDomRefs(rootElement, {
      createCanvasIfMissing: true,
    });

    clearDomFatalError(domRefs);
    setDomBootMessage(domRefs, "Bootstrap wird gelesen.");
    setDomSourceStatus(domRefs, {
      status: "connecting",
      label: "Chunk-Service wird verbunden",
      details: {
        apiBaseUrl: runtimeConfig.chunk.apiBaseUrl,
        projectId: runtimeConfig.chunk.projectId,
        worldId: runtimeConfig.chunk.worldId,
        inventoryRoute: runtimeConfig.inventory.apiUrl,
        creativeLibraryRoute: runtimeConfig.library.creativeLibraryRoute,
        onlyLibraryItemsPlaceable: true,
        debugGrassDirtAllowed: false,
      },
    });

    const defaults = bootstrapDefaultsFromRuntimeConfig(runtimeConfig);

    const rawBootstrap = readEditorBootstrap({
      rootElement,
      logger,
      defaults,
    });

    const bootstrap = normalizeEditorBootstrap(rawBootstrap, {
      buildMode: runtimeConfig.buildMode,
      buildVersion: runtimeConfig.buildVersion,
      chunkProxyBaseUrl: runtimeConfig.chunk.apiBaseUrl,
      projectId: runtimeConfig.chunk.projectId,
      worldId: runtimeConfig.chunk.worldId,
      localWorldFallbackEnabled: false,
      logger,
    });

    assertRemoteChunkOnly(bootstrap, runtimeConfig);
    assertLibraryInventoryOnly(bootstrap, runtimeConfig);

    syncRootDatasetWithRuntime(domRefs, runtimeConfig, bootstrap, bootId);
    installRuntimeDiagnosticsWindowGlobals(runtimeConfig, bootstrap, bootId);

    setDomBootMessage(domRefs, "Runtime-State wird vorbereitet.");

    const abortController = new AbortController();

    const initialState = createInitialEditorState({
      bootId,
      buildMode: runtimeConfig.buildMode,
      buildVersion: runtimeConfig.buildVersion,
      bootstrap,
      createdAt: now(),
    });

    const store = createEditorStore({
      initialState,
      logger,
      maxHistoryEntries: runtimeConfig.environment === "production" ? 25 : 75,
    });

    updateStoreLifecycle(store, "initializing", {
      reason: `boot:${trigger}`,
      bootAttemptCount,
    });

    setDomBootMessage(domRefs, "Chunk-API-Client wird erstellt.");

    const chunkApiClient = createChunkApiClient({
      config: bootstrap.runtime.chunk,
      logger,
      signal: abortController.signal,
    });

    setDomBootMessage(domRefs, "World-Runtime wird erstellt.");

    const worldRuntime = createWorldRuntime({
      bootstrap,
      store,
      chunkApiClient,
      logger,
      signal: abortController.signal,
    });

    setDomBootMessage(domRefs, "Scene-Runtime wird erstellt.");

    const sceneRuntime = createSceneRuntime({
      bootstrap,
      store,
      domRefs,
      worldRuntime,
      chunkApiClient,
      logger,
      signal: abortController.signal,
      onExitRequested: () => {
        dispatchRuntimeEvent(
          "vectoplan-editor:exit-requested",
          { reason: "escape" },
          logger,
        );
      },
    });

    mountCreativeInventoryPanel({
      root: rootElement,
      creativeInventoryUrl: rootElement.dataset.creativeInventoryUrl,
      signal: abortController.signal,
      onOpen: () => {
        const inputController = sceneRuntime.getInputController();
        inputController?.clear("creative-inventory-open");
        inputController?.disable("creative-inventory-open");
      },
      onClose: () => {
        const inputController = sceneRuntime.getInputController();
        inputController?.clear("creative-inventory-close");
        inputController?.enable("creative-inventory-close");
        void inputController?.requestPointerLock("creative-inventory-close");
        void sceneRuntime.getHotbarController()?.load({
          force: true,
          reason: "creative-inventory-panel-close",
          silent: true,
        });
      },
    });

    runtime = createRuntimeHandle({
      bootId,
      runtimeConfig,
      bootstrap,
      store,
      chunkApiClient,
      worldRuntime,
      sceneRuntime,
      logger,
      domRefs,
      abortController,
    });

    installWindowRuntime(runtime);

    setDomBootMessage(domRefs, "Scene-Runtime wird initialisiert. Library-/VPLIB-Inventar wird geladen.");

    await initializeRuntime(runtime);

    updateStoreLifecycle(store, "ready", {
      reason: "boot-ready",
      bootAttemptCount,
    });

    hideDomLoadingOverlay(domRefs);
    setDomSourceStatus(domRefs, {
      status: "ready",
      label: "Chunk-Service verbunden · Library-/VPLIB-Inventar aktiv",
      details: {
        apiBaseUrl: bootstrap.runtime.chunk.apiBaseUrl,
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
        inventoryRoute: bootstrap.inventory.apiUrl,
        creativeLibraryRoute: bootstrap.creativeLibrary.route,
        onlyLibraryItemsPlaceable: true,
        debugGrassDirtAllowed: false,
      },
    });
    setDomLiveMessage(domRefs, "VECTOPLAN Editor ist bereit. Library-/VPLIB-Inventar ist aktiv.");

    try {
      window.__VECTOPLAN_EDITOR_READY__ = true;
      window.__VECTOPLAN_EDITOR_LAST_BOOT_ERROR__ = undefined;
    } catch {
      // Window globals are diagnostic only.
    }

    logger.info("VECTOPLAN editor runtime is ready.", {
      bootId,
      bootAttemptCount,
      projectId: bootstrap.runtime.chunk.projectId,
      worldId: bootstrap.runtime.chunk.worldId,
      apiBaseUrl: bootstrap.runtime.chunk.apiBaseUrl,
      sourceKind: bootstrap.runtime.chunk.sourceKind,
      inventoryRoute: bootstrap.inventory.apiUrl,
      creativeLibraryRoute: bootstrap.creativeLibrary.route,
      onlyLibraryItemsPlaceable: bootstrap.inventory.onlyLibraryItemsPlaceable,
      legacyChunkInventoryEnabled: false,
    });

    dispatchRuntimeEvent(
      RUNTIME_EVENT_READY,
      {
        bootId,
        bootAttemptCount,
        projectId: bootstrap.runtime.chunk.projectId,
        worldId: bootstrap.runtime.chunk.worldId,
        apiBaseUrl: bootstrap.runtime.chunk.apiBaseUrl,
        inventoryRoute: bootstrap.inventory.apiUrl,
        creativeLibraryRoute: bootstrap.creativeLibrary.route,
        onlyLibraryItemsPlaceable: true,
      },
      logger,
    );

    return runtime;
  } catch (error) {
    const normalizedError = normalizeUnknownError(error);
    const message = getErrorMessage(error, "Editor Runtime Boot fehlgeschlagen.");

    try {
      window.__VECTOPLAN_EDITOR_READY__ = false;
      window.__VECTOPLAN_EDITOR_LAST_BOOT_ERROR__ = normalizedError;
    } catch {
      // Window globals are diagnostic only.
    }

    logger.error("Editor Runtime Boot fehlgeschlagen.", {
      bootId,
      bootAttemptCount,
      trigger,
      error: normalizedError,
      inventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
    });

    if (domRefs) {
      try {
        showDomFatalError(domRefs, {
          title: "Editor konnte nicht gestartet werden",
          message,
          details: normalizedError,
        });

        setDomSourceStatus(domRefs, {
          status: "failed",
          label: "Runtime-Start fehlgeschlagen",
          details: {
            ...normalizedError,
            inventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
            onlyLibraryItemsPlaceable: true,
            debugGrassDirtAllowed: false,
          },
        });

        setDomLiveMessage(domRefs, "Editor konnte nicht gestartet werden.");
      } catch (domError) {
        logger.warn("Fatal error UI update failed.", {
          error: normalizeUnknownError(domError),
        });
      }
    } else {
      try {
        const rootElement = document.querySelector<HTMLElement>(ROOT_SELECTOR);

        if (rootElement) {
          rootElement.textContent = `Editor konnte nicht gestartet werden: ${message}`;
        }
      } catch {
        // Fallback UI is best-effort.
      }
    }

    if (runtime) {
      try {
        await runtime.destroy({
          reason: "boot-failed",
          source: "main.bootVectoplanEditor",
          waitForAsyncCleanup: true,
        });
      } catch (destroyError) {
        logger.warn("Runtime cleanup after failed boot failed.", {
          error: normalizeUnknownError(destroyError),
        });
      }
    }

    dispatchRuntimeEvent(
      RUNTIME_EVENT_FAILED,
      {
        bootId,
        bootAttemptCount,
        trigger,
        error: normalizedError,
        inventoryRoute: PRODUCTIVE_INVENTORY_ROUTE,
      },
      logger,
    );

    return null;
  }
}

function bootWhenDocumentIsReady(trigger: string): void {
  const run = (): void => {
    void bootVectoplanEditor(trigger).catch((error) => {
      try {
        console.error("[vectoplan-editor:main] Unhandled boot failure.", error);
      } catch {
        // Console may be unavailable in embedded contexts.
      }
    });
  };

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, {
        once: true,
      });

      return;
    }

    run();
  } catch (error) {
    try {
      console.error("[vectoplan-editor:main] Boot scheduling failed.", error);
    } catch {
      // Console may be unavailable in embedded contexts.
    }
  }
}

export async function startVectoplanEditor(): Promise<VectoplanEditorRuntimeHandle | null> {
  return bootVectoplanEditor("manual");
}

export async function destroyVectoplanEditor(
  options?: RuntimeDestroyOptions,
): Promise<void> {
  const runtime =
    window.__VECTOPLAN_EDITOR_RUNTIME__ ??
    window.__VECTOPLAN_RUNTIME__ ??
    window.vectoplanEditorRuntime ??
    window.editorRuntime;

  if (!runtime) {
    return;
  }

  await runtime.destroy({
    reason: options?.reason ?? "manual-destroy",
    source: options?.source ?? "destroyVectoplanEditor",
    waitForAsyncCleanup: options?.waitForAsyncCleanup ?? true,
  });
}

const GENERATOR_PREVIEW_ROOT_SELECTOR = "[data-editor-generator-preview]";

function bootSelectedRuntime(): void {
  if (document.querySelector(GENERATOR_PREVIEW_ROOT_SELECTOR)) {
    void import("./generator_preview/generator_preview_runtime")
      .then(({ startGeneratorPreview }) => {
        startGeneratorPreview();
      })
      .catch((error) => {
        try {
          console.error("[vectoplan-editor:generator-preview] Boot failed.", error);
        } catch {
          // Console may be unavailable in embedded contexts.
        }
      });
    return;
  }

  bootWhenDocumentIsReady("auto");
}

if (import.meta.hot) {
  import.meta.hot.accept();

  import.meta.hot.dispose(() => {
    void destroyVectoplanEditor({
      reason: "vite-hot-dispose",
      source: "import.meta.hot.dispose",
      waitForAsyncCleanup: true,
    }).catch((error) => {
      try {
        console.warn("[vectoplan-editor:main] HMR cleanup failed.", error);
      } catch {
        // Console may be unavailable in embedded contexts.
      }
    });
  });
}

wireParentRuntimeStatusBridge();
bootSelectedRuntime();
