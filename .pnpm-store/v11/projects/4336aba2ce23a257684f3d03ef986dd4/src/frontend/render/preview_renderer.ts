// services/vectoplan-editor/src/frontend/render/preview_renderer.ts
import * as THREE from "three";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import type { RuntimeChunkPaletteEntry } from "@runtime/world/chunk_content";
import type { ChunkCellAddress } from "@runtime/world/chunk_coordinates";
import type { ThreeContextHandle } from "./three_context";

export type PreviewRendererStatus =
  | "created"
  | "ready"
  | "updating"
  | "hidden"
  | "failed"
  | "disposed";

export type PreviewTargetKind =
  | "none"
  | "place"
  | "remove"
  | "inspect";

export interface PreviewCellTarget {
  readonly kind: PreviewTargetKind;
  readonly address: ChunkCellAddress | null;
  readonly normal?: THREE.Vector3Like | null;
  readonly blockTypeId?: string | null;
  readonly cellValue?: number | null;
  readonly valid?: boolean;
  readonly reason?: string | null;
}

export interface PreviewRenderOptions {
  readonly three: ThreeContextHandle;
  readonly logger?: EditorLogger;
  readonly showPlacementPreview?: boolean;
  readonly showRemovalHighlight?: boolean;
  readonly showTargetOutline?: boolean;
  readonly placementOpacity?: number;
  readonly removalOpacity?: number;
  readonly outlineOpacity?: number;
  readonly defaultPlacementColor?: string;
  readonly defaultRemovalColor?: string;
  readonly defaultOutlineColor?: string;
}

export interface PreviewUpdateOptions {
  readonly target: PreviewCellTarget | null;
  readonly paletteEntry?: RuntimeChunkPaletteEntry | null;
  readonly chunkSize?: number;
  readonly cellSize?: number;
  readonly visible?: boolean;
  readonly reason?: string;
}

export interface PreviewRendererSnapshot {
  readonly kind: "preview-renderer-snapshot.v1";
  readonly status: PreviewRendererStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly visible: boolean;
  readonly targetKind: PreviewTargetKind;
  readonly targetChunkKey: string | null;
  readonly targetWorldPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly blockTypeId: string | null;
  readonly objectCount: number;
  readonly updateCount: number;
  readonly lastReason: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface PreviewRendererHandle {
  readonly kind: "vectoplan-editor-preview-renderer.v1";

  update(options: PreviewUpdateOptions): void;
  show(): void;
  hide(reason?: string): void;
  clear(reason?: string): void;

  setPlacementColor(color: string): void;
  setRemovalColor(color: string): void;
  setOutlineColor(color: string): void;

  getStatus(): PreviewRendererStatus;
  getGroup(): THREE.Group;
  getSnapshot(): PreviewRendererSnapshot;

  dispose(reason?: string): void;
}

const PREVIEW_RENDERER_KIND = "vectoplan-editor-preview-renderer.v1" as const;
const PREVIEW_RENDERER_SNAPSHOT_KIND = "preview-renderer-snapshot.v1" as const;

const DEFAULT_PLACEMENT_COLOR = "#38bdf8";
const DEFAULT_REMOVAL_COLOR = "#f87171";
const DEFAULT_OUTLINE_COLOR = "#facc15";

function logDebug(
  logger: EditorLogger | undefined,
  message: string,
  details?: Record<string, unknown>,
): void {
  try {
    logger?.debug?.(message, details);
  } catch {
    // Preview logging must never break rendering.
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
    // Preview logging must never break rendering.
  }
}

function normalizeOpacity(value: unknown, fallback: number): number {
  return safeNumber(value, fallback, {
    min: 0,
    max: 1,
  });
}

function normalizeColor(value: unknown, fallback: string): string {
  try {
    const raw = safeString(value, fallback);
    const color = new THREE.Color(raw);
    return `#${color.getHexString()}`;
  } catch {
    return fallback;
  }
}

function normalizeCellSize(value: unknown): number {
  return safeNumber(value, 1, {
    min: 0.000001,
    max: 1_000_000,
  });
}

function createPreviewMaterial(input: {
  readonly color: string;
  readonly opacity: number;
  readonly wireframe?: boolean;
  readonly depthWrite?: boolean;
}): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(input.color),
    transparent: input.opacity < 1,
    opacity: input.opacity,
    wireframe: input.wireframe ?? false,
    depthWrite: input.depthWrite ?? false,
    depthTest: true,
  });

  material.name = `preview_material_${input.color.replace("#", "")}`;
  return material;
}

function createOutlineMaterial(input: {
  readonly color: string;
  readonly opacity: number;
}): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(input.color),
    transparent: input.opacity < 1,
    opacity: input.opacity,
    depthTest: true,
    depthWrite: false,
  });

  material.name = `preview_outline_material_${input.color.replace("#", "")}`;
  return material;
}

function setObjectUserData(
  object: THREE.Object3D,
  input: Record<string, unknown>,
): void {
  try {
    object.userData = {
      ...(object.userData ?? {}),
      vectoplan: {
        kind: "preview-object",
        ...input,
      },
    };
  } catch {
    // Debug metadata is optional.
  }
}

function clearGroup(group: THREE.Group, dispose = true): void {
  try {
    const children = [...group.children];

    for (const child of children) {
      group.remove(child);

      if (!dispose) {
        continue;
      }

      disposeObject(child);
    }
  } catch {
    // Clearing preview must be best-effort.
  }
}

function disposeObject(object: THREE.Object3D): void {
  try {
    object.traverse((child) => {
      const maybeMesh = child as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };

      try {
        maybeMesh.geometry?.dispose?.();
      } catch {
        // Ignore.
      }

      try {
        const material = maybeMesh.material;

        if (Array.isArray(material)) {
          for (const item of material) {
            item.dispose();
          }
        } else {
          material?.dispose?.();
        }
      } catch {
        // Ignore.
      }
    });
  } catch {
    // Ignore.
  }
}

function makeBoxGeometry(cellSize: number, scale = 1): THREE.BoxGeometry {
  const size = cellSize * scale;
  return new THREE.BoxGeometry(size, size, size);
}

function makeEdgesGeometry(cellSize: number, scale = 1.012): THREE.EdgesGeometry {
  const box = makeBoxGeometry(cellSize, scale);

  try {
    return new THREE.EdgesGeometry(box);
  } finally {
    try {
      box.dispose();
    } catch {
      // Ignore.
    }
  }
}

function worldPositionFromAddress(
  address: ChunkCellAddress,
  cellSize: number,
): THREE.Vector3 {
  return new THREE.Vector3(
    (address.worldX + 0.5) * cellSize,
    (address.worldY + 0.5) * cellSize,
    (address.worldZ + 0.5) * cellSize,
  );
}

function createPlacementMesh(input: {
  readonly target: PreviewCellTarget;
  readonly cellSize: number;
  readonly color: string;
  readonly opacity: number;
}): THREE.Mesh | null {
  try {
    if (!input.target.address) {
      return null;
    }

    const geometry = makeBoxGeometry(input.cellSize, 0.96);
    const material = createPreviewMaterial({
      color: input.color,
      opacity: input.opacity,
      wireframe: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.name = "placement_preview_mesh";
    mesh.position.copy(worldPositionFromAddress(input.target.address, input.cellSize));
    mesh.renderOrder = 20;

    setObjectUserData(mesh, {
      targetKind: input.target.kind,
      chunkKey: input.target.address.chunkKey,
      blockTypeId: input.target.blockTypeId ?? null,
      worldX: input.target.address.worldX,
      worldY: input.target.address.worldY,
      worldZ: input.target.address.worldZ,
    });

    return mesh;
  } catch {
    return null;
  }
}

function createRemovalMesh(input: {
  readonly target: PreviewCellTarget;
  readonly cellSize: number;
  readonly color: string;
  readonly opacity: number;
}): THREE.Mesh | null {
  try {
    if (!input.target.address) {
      return null;
    }

    const geometry = makeBoxGeometry(input.cellSize, 1.03);
    const material = createPreviewMaterial({
      color: input.color,
      opacity: input.opacity,
      wireframe: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.name = "removal_preview_mesh";
    mesh.position.copy(worldPositionFromAddress(input.target.address, input.cellSize));
    mesh.renderOrder = 22;

    setObjectUserData(mesh, {
      targetKind: input.target.kind,
      chunkKey: input.target.address.chunkKey,
      blockTypeId: input.target.blockTypeId ?? null,
      cellValue: input.target.cellValue ?? null,
      worldX: input.target.address.worldX,
      worldY: input.target.address.worldY,
      worldZ: input.target.address.worldZ,
    });

    return mesh;
  } catch {
    return null;
  }
}

function createOutlineObject(input: {
  readonly target: PreviewCellTarget;
  readonly cellSize: number;
  readonly color: string;
  readonly opacity: number;
}): THREE.LineSegments | null {
  try {
    if (!input.target.address) {
      return null;
    }

    const geometry = makeEdgesGeometry(input.cellSize);
    const material = createOutlineMaterial({
      color: input.color,
      opacity: input.opacity,
    });
    const line = new THREE.LineSegments(geometry, material);

    line.name = "target_outline_preview";
    line.position.copy(worldPositionFromAddress(input.target.address, input.cellSize));
    line.renderOrder = 30;

    setObjectUserData(line, {
      targetKind: input.target.kind,
      chunkKey: input.target.address.chunkKey,
      worldX: input.target.address.worldX,
      worldY: input.target.address.worldY,
      worldZ: input.target.address.worldZ,
    });

    return line;
  } catch {
    return null;
  }
}

function paletteColorOrFallback(
  paletteEntry: RuntimeChunkPaletteEntry | null | undefined,
  fallback: string,
): string {
  try {
    return normalizeColor(paletteEntry?.color, fallback);
  } catch {
    return fallback;
  }
}

function objectCount(root: THREE.Object3D): number {
  try {
    let count = 0;

    root.traverse(() => {
      count += 1;
    });

    return count;
  } catch {
    return 0;
  }
}

function targetWorldPositionSnapshot(target: PreviewCellTarget | null): PreviewRendererSnapshot["targetWorldPosition"] {
  try {
    if (!target?.address) {
      return null;
    }

    return {
      x: target.address.worldX,
      y: target.address.worldY,
      z: target.address.worldZ,
    };
  } catch {
    return null;
  }
}

export function createPreviewRenderer(options: PreviewRenderOptions): PreviewRendererHandle {
  const logger = options.logger;
  const three = options.three;
  const createdAt = nowIsoString();

  const group = new THREE.Group();
  group.name = "vectoplan_preview_group";
  group.visible = false;

  let status: PreviewRendererStatus = "created";
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let disposed = false;
  let visible = false;
  let updateCount = 0;
  let lastTarget: PreviewCellTarget | null = null;
  let lastReason: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  let placementColor = normalizeColor(options.defaultPlacementColor, DEFAULT_PLACEMENT_COLOR);
  let removalColor = normalizeColor(options.defaultRemovalColor, DEFAULT_REMOVAL_COLOR);
  let outlineColor = normalizeColor(options.defaultOutlineColor, DEFAULT_OUTLINE_COLOR);

  const placementOpacity = normalizeOpacity(options.placementOpacity, 0.34);
  const removalOpacity = normalizeOpacity(options.removalOpacity, 0.28);
  const outlineOpacity = normalizeOpacity(options.outlineOpacity, 0.92);

  const showPlacementPreview = safeBoolean(options.showPlacementPreview, true);
  const showRemovalHighlight = safeBoolean(options.showRemovalHighlight, true);
  const showTargetOutline = safeBoolean(options.showTargetOutline, true);

  function setStatus(nextStatus: PreviewRendererStatus): void {
    status = nextStatus;
    updatedAt = nowIsoString();
  }

  function assertAlive(action: string): void {
    if (disposed || status === "disposed") {
      throw new Error(`PreviewRenderer is disposed. Action '${action}' is not allowed.`);
    }
  }

  function setError(error: unknown): void {
    lastError = normalizeUnknownError(error);
    setStatus("failed");
  }

  function attachToThree(): void {
    try {
      const previewGroup = three.getPreviewGroup();

      if (group.parent !== previewGroup) {
        group.parent?.remove(group);
        previewGroup.add(group);
      }
    } catch (error) {
      setError(error);
      logWarn(logger, "Preview group could not be attached.", {
        error: normalizeUnknownError(error),
      });
    }
  }

  function setVisible(nextVisible: boolean): void {
    visible = nextVisible;
    group.visible = nextVisible;
    setStatus(nextVisible ? "ready" : "hidden");
  }

  function update(updateOptions: PreviewUpdateOptions): void {
    assertAlive("update");

    try {
      setStatus("updating");
      attachToThree();
      clearGroup(group, true);

      const target = updateOptions.target;
      lastTarget = target;
      lastReason = updateOptions.reason ?? null;

      if (!target || target.kind === "none" || target.valid === false || !target.address) {
        setVisible(false);
        return;
      }

      const cellSize = normalizeCellSize(updateOptions.cellSize ?? 1);
      const forcedVisible = updateOptions.visible ?? true;

      if (target.kind === "place" && showPlacementPreview) {
        const mesh = createPlacementMesh({
          target,
          cellSize,
          color: paletteColorOrFallback(updateOptions.paletteEntry, placementColor),
          opacity: placementOpacity,
        });

        if (mesh) {
          group.add(mesh);
        }
      }

      if (target.kind === "remove" && showRemovalHighlight) {
        const mesh = createRemovalMesh({
          target,
          cellSize,
          color: removalColor,
          opacity: removalOpacity,
        });

        if (mesh) {
          group.add(mesh);
        }
      }

      if (showTargetOutline) {
        const outline = createOutlineObject({
          target,
          cellSize,
          color: target.kind === "remove" ? removalColor : outlineColor,
          opacity: outlineOpacity,
        });

        if (outline) {
          group.add(outline);
        }
      }

      setVisible(forcedVisible && group.children.length > 0);
      updateCount += 1;

      logDebug(logger, "Preview renderer updated.", {
        targetKind: target.kind,
        chunkKey: target.address.chunkKey,
        blockTypeId: target.blockTypeId ?? null,
        objectCount: group.children.length,
        reason: updateOptions.reason ?? null,
      });
    } catch (error) {
      setError(error);
      logWarn(logger, "Preview renderer update failed.", {
        error: normalizeUnknownError(error),
        reason: updateOptions.reason ?? null,
      });
    }
  }

  function show(): void {
    assertAlive("show");
    setVisible(true);
  }

  function hide(reason?: string): void {
    assertAlive("hide");
    lastReason = reason ?? null;
    setVisible(false);
  }

  function clear(reason?: string): void {
    assertAlive("clear");
    clearGroup(group, true);
    lastTarget = null;
    lastReason = reason ?? null;
    setVisible(false);
  }

  const handle: PreviewRendererHandle = {
    kind: PREVIEW_RENDERER_KIND,

    update,
    show,
    hide,
    clear,

    setPlacementColor(color: string): void {
      placementColor = normalizeColor(color, placementColor);
    },

    setRemovalColor(color: string): void {
      removalColor = normalizeColor(color, removalColor);
    },

    setOutlineColor(color: string): void {
      outlineColor = normalizeColor(color, outlineColor);
    },

    getStatus(): PreviewRendererStatus {
      return status;
    },

    getGroup(): THREE.Group {
      return group;
    },

    getSnapshot(): PreviewRendererSnapshot {
      return {
        kind: PREVIEW_RENDERER_SNAPSHOT_KIND,
        status,
        createdAt,
        updatedAt,
        disposedAt,
        visible,
        targetKind: lastTarget?.kind ?? "none",
        targetChunkKey: lastTarget?.address?.chunkKey ?? null,
        targetWorldPosition: targetWorldPositionSnapshot(lastTarget),
        blockTypeId: lastTarget?.blockTypeId ?? null,
        objectCount: objectCount(group),
        updateCount,
        lastReason,
        lastError,
      };
    },

    dispose(reason?: string): void {
      if (disposed) {
        return;
      }

      disposed = true;
      disposedAt = nowIsoString();

      try {
        clearGroup(group, true);
        group.parent?.remove(group);
      } catch {
        // Ignore cleanup failure.
      }

      setStatus("disposed");

      logDebug(logger, "Preview renderer disposed.", {
        reason: reason ?? null,
        updateCount,
      });
    },
  };

  try {
    attachToThree();
    setStatus("hidden");
  } catch {
    setStatus("failed");
  }

  logDebug(logger, "Preview renderer created.", {
    showPlacementPreview,
    showRemovalHighlight,
    showTargetOutline,
    placementOpacity,
    removalOpacity,
    outlineOpacity,
  });

  return handle;
}