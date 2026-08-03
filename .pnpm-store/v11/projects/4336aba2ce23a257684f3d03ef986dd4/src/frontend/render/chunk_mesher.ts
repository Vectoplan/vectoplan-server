// services/vectoplan-editor/src/frontend/render/chunk_mesher.ts
import * as THREE from "three";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeBoolean, safeInteger, safeNumber, safeString } from "@utils/safe";
import { nowIsoString } from "@utils/time";
import {
  CHUNK_API_AIR_CELL_VALUE,
  collectNonAirCellIndices,
  getPaletteEntryByCellValue,
  sampleCellAtIndex,
  type RuntimeCellSample,
  type RuntimeChunkContent,
  type RuntimeChunkPaletteEntry,
} from "@runtime/world/chunk_content";
import {
  localCoordinatesFromCellIndex,
  normalizeChunkSize,
  type LocalCellCoordinates,
} from "@runtime/world/chunk_coordinates";

export type ChunkMesherStatus =
  | "created"
  | "ready"
  | "meshing"
  | "failed"
  | "disposed";

export type ChunkMeshMode =
  | "instanced-boxes"
  | "individual-boxes";

export interface ChunkMesherOptions {
  readonly logger?: EditorLogger;
  readonly mode?: ChunkMeshMode;
  readonly cellScale?: number;
  readonly maxCellsPerChunk?: number;
  readonly wireframe?: boolean;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly enableFaceCullingLater?: boolean;
  readonly materialOpacity?: number;
}

export interface ChunkMeshBuildOptions {
  readonly forceWireframe?: boolean;
  readonly visible?: boolean;
  readonly namePrefix?: string;
  readonly includeDebugUserData?: boolean;
}

export interface ChunkMeshBlockStats {
  readonly blockTypeId: string;
  readonly cellValue: number;
  readonly paletteIndex: number;
  readonly count: number;
  readonly color: string | null;
}

export interface ChunkMeshBuildStats {
  readonly chunkKey: string;
  readonly mode: ChunkMeshMode;
  readonly cellCount: number;
  readonly nonAirCellCount: number;
  readonly emittedCellCount: number;
  readonly skippedCellCount: number;
  readonly meshCount: number;
  readonly materialCount: number;
  readonly blockStats: readonly ChunkMeshBlockStats[];
  readonly elapsedMs: number;
  readonly createdAt: string;
}

export interface ChunkMeshResult {
  readonly kind: "chunk-mesh-result.v1";
  readonly chunkKey: string;
  readonly chunk: RuntimeChunkContent;
  readonly group: THREE.Group;
  readonly meshes: readonly THREE.Object3D[];
  readonly stats: ChunkMeshBuildStats;
  readonly dispose: () => void;
}

export interface ChunkMesherSnapshot {
  readonly kind: "chunk-mesher-snapshot.v1";
  readonly status: ChunkMesherStatus;
  readonly mode: ChunkMeshMode;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disposedAt: string | null;
  readonly builtChunkCount: number;
  readonly failedBuildCount: number;
  readonly cachedMaterialCount: number;
  readonly lastChunkKey: string | null;
  readonly lastError: Record<string, unknown> | null;
}

export interface ChunkMesherHandle {
  readonly kind: "vectoplan-editor-chunk-mesher.v1";

  buildChunkMesh(chunk: RuntimeChunkContent, options?: ChunkMeshBuildOptions): ChunkMeshResult;
  rebuildChunkMesh(previous: ChunkMeshResult | null, chunk: RuntimeChunkContent, options?: ChunkMeshBuildOptions): ChunkMeshResult;
  disposeChunkMesh(result: ChunkMeshResult | null | undefined): void;

  getStatus(): ChunkMesherStatus;
  getSnapshot(): ChunkMesherSnapshot;
  dispose(reason?: string): void;
}

interface CellGroup {
  readonly cellValue: number;
  readonly paletteEntry: RuntimeChunkPaletteEntry;
  readonly samples: RuntimeCellSample[];
}

const CHUNK_MESHER_KIND = "vectoplan-editor-chunk-mesher.v1" as const;
const CHUNK_MESH_RESULT_KIND = "chunk-mesh-result.v1" as const;
const CHUNK_MESHER_SNAPSHOT_KIND = "chunk-mesher-snapshot.v1" as const;

const DEFAULT_CELL_SCALE = 1;
const DEFAULT_MAX_CELLS_PER_CHUNK = 4096;
const DEFAULT_MATERIAL_COLOR = "#94a3b8";
const FALLBACK_COLORS: readonly string[] = [
  "#4caf50",
  "#795548",
  "#94a3b8",
  "#38bdf8",
  "#facc15",
  "#f97316",
  "#a78bfa",
  "#f472b6",
];

function nowMs(): number {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  } catch {
    return Date.now();
  }
}

function elapsedMs(startedAt: number): number {
  try {
    return Math.max(0, Math.round(nowMs() - startedAt));
  } catch {
    return 0;
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
    // Mesher logging must never break rendering.
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
    // Mesher logging must never break rendering.
  }
}

function normalizeMode(value: unknown): ChunkMeshMode {
  try {
    return value === "individual-boxes" ? "individual-boxes" : "instanced-boxes";
  } catch {
    return "instanced-boxes";
  }
}

function normalizeCellScale(value: unknown): number {
  return safeNumber(value, DEFAULT_CELL_SCALE, {
    min: 0.01,
    max: 100,
  });
}

function normalizeMaxCells(value: unknown): number {
  return safeInteger(value, DEFAULT_MAX_CELLS_PER_CHUNK, {
    min: 1,
    max: 1_000_000,
  });
}

function normalizeOpacity(value: unknown): number {
  return safeNumber(value, 1, {
    min: 0.05,
    max: 1,
  });
}

function normalizeMesherChunkSize(value: unknown): number {
  try {
    return Number(normalizeChunkSize(value));
  } catch {
    return 16;
  }
}

function safeColor(value: unknown, fallback: string): string {
  try {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return fallback;
    }

    const color = new THREE.Color(trimmed);

    return `#${color.getHexString()}`;
  } catch {
    return fallback;
  }
}

function fallbackColorForPaletteIndex(index: number): string {
  try {
    return FALLBACK_COLORS[Math.abs(index) % FALLBACK_COLORS.length] ?? DEFAULT_MATERIAL_COLOR;
  } catch {
    return DEFAULT_MATERIAL_COLOR;
  }
}

function colorForPaletteEntry(entry: RuntimeChunkPaletteEntry): string {
  try {
    return safeColor(entry.color, fallbackColorForPaletteIndex(entry.paletteIndex));
  } catch {
    return DEFAULT_MATERIAL_COLOR;
  }
}

function materialKeyForEntry(
  entry: RuntimeChunkPaletteEntry,
  options: {
    readonly wireframe: boolean;
    readonly opacity: number;
  },
): string {
  try {
    return [
      entry.registryId,
      entry.registryVersion,
      entry.blockTypeId,
      colorForPaletteEntry(entry),
      options.wireframe ? "wire" : "solid",
      options.opacity < 1 ? `alpha_${options.opacity.toFixed(3)}` : "opaque",
    ].join("|");
  } catch {
    return `fallback|${entry.blockTypeId}|${options.wireframe ? "wire" : "solid"}`;
  }
}

function createMaterial(
  entry: RuntimeChunkPaletteEntry,
  options: {
    readonly wireframe: boolean;
    readonly opacity: number;
  },
): THREE.MeshStandardMaterial {
  const color = new THREE.Color(colorForPaletteEntry(entry));
  const transparent = options.opacity < 1;

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.02,
    wireframe: options.wireframe,
    transparent,
    opacity: options.opacity,
  });

  material.name = `mat_${entry.blockTypeId}`;
  return material;
}

function createBlockStats(
  groups: readonly CellGroup[],
): readonly ChunkMeshBlockStats[] {
  try {
    return groups.map((group) => ({
      blockTypeId: group.paletteEntry.blockTypeId,
      cellValue: group.cellValue,
      paletteIndex: group.paletteEntry.paletteIndex,
      count: group.samples.length,
      color: group.paletteEntry.color ?? colorForPaletteEntry(group.paletteEntry),
    }));
  } catch {
    return [];
  }
}

function collectCellGroups(
  chunk: RuntimeChunkContent,
  maxCells: number,
): {
  readonly groups: readonly CellGroup[];
  readonly skippedCellCount: number;
} {
  const byCellValue = new Map<number, RuntimeCellSample[]>();
  let skippedCellCount = 0;

  try {
    const nonAirIndices = collectNonAirCellIndices(chunk, maxCells);

    skippedCellCount = Math.max(0, chunk.stats.nonAirCellCount - nonAirIndices.length);

    for (const cellIndex of nonAirIndices) {
      const cellValue = chunk.cells[cellIndex] ?? CHUNK_API_AIR_CELL_VALUE;

      if (cellValue === CHUNK_API_AIR_CELL_VALUE) {
        continue;
      }

      const paletteEntry = getPaletteEntryByCellValue(chunk, cellValue);

      if (!paletteEntry) {
        skippedCellCount += 1;
        continue;
      }

      const sample = sampleCellAtIndex(chunk, cellIndex);

      if (!sample.exists || sample.air) {
        skippedCellCount += 1;
        continue;
      }

      const current = byCellValue.get(cellValue) ?? [];
      current.push(sample);
      byCellValue.set(cellValue, current);
    }

    const groups: CellGroup[] = [];

    for (const [cellValue, samples] of byCellValue.entries()) {
      const paletteEntry = getPaletteEntryByCellValue(chunk, cellValue);

      if (!paletteEntry) {
        continue;
      }

      groups.push({
        cellValue,
        paletteEntry,
        samples,
      });
    }

    groups.sort((left, right) => left.cellValue - right.cellValue);

    return {
      groups,
      skippedCellCount,
    };
  } catch {
    return {
      groups: [],
      skippedCellCount: chunk.stats.nonAirCellCount,
    };
  }
}

function matrixForSample(
  sample: RuntimeCellSample,
  chunk: RuntimeChunkContent,
  cellScale: number,
  target: THREE.Matrix4,
): THREE.Matrix4 {
  try {
    const cellSize = chunk.cellSize * cellScale;
    const x = (sample.address.localX + 0.5) * chunk.cellSize;
    const y = (sample.address.localY + 0.5) * chunk.cellSize;
    const z = (sample.address.localZ + 0.5) * chunk.cellSize;

    const position = new THREE.Vector3(x, y, z);
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(cellSize, cellSize, cellSize);

    return target.compose(position, quaternion, scale);
  } catch {
    return target.identity();
  }
}

function positionForLocal(
  local: LocalCellCoordinates,
  chunk: RuntimeChunkContent,
): THREE.Vector3 {
  return new THREE.Vector3(
    (local.localX + 0.5) * chunk.cellSize,
    (local.localY + 0.5) * chunk.cellSize,
    (local.localZ + 0.5) * chunk.cellSize,
  );
}

function setChunkGroupTransform(
  group: THREE.Group,
  chunk: RuntimeChunkContent,
): void {
  try {
    const chunkSize = normalizeMesherChunkSize(chunk.chunkSize);

    group.position.set(
      chunk.chunkX * chunkSize * chunk.cellSize,
      chunk.chunkY * chunkSize * chunk.cellSize,
      chunk.chunkZ * chunkSize * chunk.cellSize,
    );
  } catch {
    group.position.set(0, 0, 0);
  }
}

function attachChunkUserData(
  object: THREE.Object3D,
  chunk: RuntimeChunkContent,
  extra?: Record<string, unknown>,
): void {
  try {
    object.userData = {
      ...(object.userData ?? {}),
      vectoplan: {
        kind: "chunk-mesh-object",
        chunkKey: chunk.chunkKey,
        chunkX: chunk.chunkX,
        chunkY: chunk.chunkY,
        chunkZ: chunk.chunkZ,
        projectId: chunk.projectId,
        worldId: chunk.worldId,
        ...extra,
      },
    };
  } catch {
    // User data is debug-only.
  }
}

function disposeObject3D(object: THREE.Object3D, disposeMaterials = false): void {
  try {
    object.traverse((child: THREE.Object3D) => {
      const maybeMesh = child as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };

      try {
        maybeMesh.geometry?.dispose?.();
      } catch {
        // Ignore geometry disposal failure.
      }

      if (!disposeMaterials) {
        return;
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
        // Ignore material disposal failure.
      }
    });
  } catch {
    // Ignore object disposal failure.
  }
}

function disposeMeshResult(result: ChunkMeshResult | null | undefined): void {
  try {
    if (!result) {
      return;
    }

    result.group.parent?.remove(result.group);

    for (const mesh of result.meshes) {
      mesh.parent?.remove(mesh);
      disposeObject3D(mesh, false);
    }

    result.group.clear();
  } catch {
    // Mesh disposal must be best-effort.
  }
}

export function createChunkMesher(options?: ChunkMesherOptions): ChunkMesherHandle {
  const logger = options?.logger;
  const mode = normalizeMode(options?.mode);
  const cellScale = normalizeCellScale(options?.cellScale);
  const maxCellsPerChunk = normalizeMaxCells(options?.maxCellsPerChunk);
  const defaultWireframe = safeBoolean(options?.wireframe, false);
  const castShadow = safeBoolean(options?.castShadow, true);
  const receiveShadow = safeBoolean(options?.receiveShadow, true);
  const materialOpacity = normalizeOpacity(options?.materialOpacity);

  const createdAt = nowIsoString();
  let updatedAt = createdAt;
  let disposedAt: string | null = null;
  let status: ChunkMesherStatus = "created";
  let disposed = false;
  let builtChunkCount = 0;
  let failedBuildCount = 0;
  let lastChunkKey: string | null = null;
  let lastError: Record<string, unknown> | null = null;

  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

  function setStatus(nextStatus: ChunkMesherStatus): void {
    status = nextStatus;
    updatedAt = nowIsoString();
  }

  function assertAlive(action: string): void {
    if (disposed || status === "disposed") {
      throw new Error(`ChunkMesher is disposed. Action '${action}' is not allowed.`);
    }
  }

  function getMaterial(
    entry: RuntimeChunkPaletteEntry,
    wireframe: boolean,
  ): THREE.MeshStandardMaterial {
    const key = materialKeyForEntry(entry, {
      wireframe,
      opacity: materialOpacity,
    });

    const cached = materialCache.get(key);

    if (cached) {
      return cached;
    }

    const material = createMaterial(entry, {
      wireframe,
      opacity: materialOpacity,
    });

    materialCache.set(key, material);
    return material;
  }

  function buildInstancedGroup(
    chunk: RuntimeChunkContent,
    groups: readonly CellGroup[],
    wireframe: boolean,
    includeDebugUserData: boolean,
  ): readonly THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    const matrix = new THREE.Matrix4();

    for (const group of groups) {
      const material = getMaterial(group.paletteEntry, wireframe);
      const mesh = new THREE.InstancedMesh(sharedBoxGeometry, material, group.samples.length);
      mesh.name = `chunk_${chunk.chunkKey}_block_${group.paletteEntry.blockTypeId}`;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.frustumCulled = true;

      for (let index = 0; index < group.samples.length; index += 1) {
        const sample = group.samples[index];

        if (!sample) {
          continue;
        }

        matrixForSample(sample, chunk, cellScale, matrix);
        mesh.setMatrixAt(index, matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;

      if (includeDebugUserData) {
        attachChunkUserData(mesh, chunk, {
          blockTypeId: group.paletteEntry.blockTypeId,
          cellValue: group.cellValue,
          instanceCount: group.samples.length,
        });
      }

      meshes.push(mesh);
    }

    return meshes;
  }

  function buildIndividualGroup(
    chunk: RuntimeChunkContent,
    groups: readonly CellGroup[],
    wireframe: boolean,
    includeDebugUserData: boolean,
  ): readonly THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];

    for (const group of groups) {
      const material = getMaterial(group.paletteEntry, wireframe);
      const chunkSize = normalizeMesherChunkSize(chunk.chunkSize);

      for (const sample of group.samples) {
        const mesh = new THREE.Mesh(sharedBoxGeometry, material);
        const local = localCoordinatesFromCellIndex(sample.address.cellIndex, chunkSize);
        const position = positionForLocal(local, chunk);

        mesh.name = `chunk_${chunk.chunkKey}_cell_${sample.address.cellIndex}`;
        mesh.position.copy(position);
        mesh.scale.setScalar(chunk.cellSize * cellScale);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;

        if (includeDebugUserData) {
          attachChunkUserData(mesh, chunk, {
            blockTypeId: group.paletteEntry.blockTypeId,
            cellValue: group.cellValue,
            cellIndex: sample.address.cellIndex,
            localX: local.localX,
            localY: local.localY,
            localZ: local.localZ,
          });
        }

        meshes.push(mesh);
      }
    }

    return meshes;
  }

  function buildChunkMesh(
    chunk: RuntimeChunkContent,
    buildOptions?: ChunkMeshBuildOptions,
  ): ChunkMeshResult {
    assertAlive("buildChunkMesh");

    const startedAt = nowMs();
    const wireframe = buildOptions?.forceWireframe ?? defaultWireframe;
    const includeDebugUserData = buildOptions?.includeDebugUserData ?? true;
    const meshMode = mode;

    try {
      setStatus("meshing");
      lastChunkKey = chunk.chunkKey;

      const { groups, skippedCellCount } = collectCellGroups(chunk, maxCellsPerChunk);
      const group = new THREE.Group();
      group.name = `${safeString(buildOptions?.namePrefix, "chunk")}_${chunk.chunkKey}`;
      group.visible = buildOptions?.visible ?? true;

      setChunkGroupTransform(group, chunk);
      attachChunkUserData(group, chunk, {
        meshMode,
        group: true,
      });

      const meshes = meshMode === "individual-boxes"
        ? buildIndividualGroup(chunk, groups, wireframe, includeDebugUserData)
        : buildInstancedGroup(chunk, groups, wireframe, includeDebugUserData);

      for (const mesh of meshes) {
        group.add(mesh);
      }

      const emittedCellCount = groups.reduce((sum, item) => sum + item.samples.length, 0);
      const stats: ChunkMeshBuildStats = {
        chunkKey: chunk.chunkKey,
        mode: meshMode,
        cellCount: chunk.stats.cellCount,
        nonAirCellCount: chunk.stats.nonAirCellCount,
        emittedCellCount,
        skippedCellCount,
        meshCount: meshes.length,
        materialCount: materialCache.size,
        blockStats: createBlockStats(groups),
        elapsedMs: elapsedMs(startedAt),
        createdAt: nowIsoString(),
      };

      const result: ChunkMeshResult = {
        kind: CHUNK_MESH_RESULT_KIND,
        chunkKey: chunk.chunkKey,
        chunk,
        group,
        meshes,
        stats,
        dispose: () => disposeMeshResult(result),
      };

      builtChunkCount += 1;
      setStatus("ready");

      logDebug(logger, "Chunk mesh built.", {
        chunkKey: chunk.chunkKey,
        meshCount: stats.meshCount,
        emittedCellCount: stats.emittedCellCount,
        skippedCellCount: stats.skippedCellCount,
        elapsedMs: stats.elapsedMs,
      });

      return result;
    } catch (error) {
      failedBuildCount += 1;
      lastError = normalizeUnknownError(error);
      setStatus("failed");

      logWarn(logger, "Chunk mesh build failed.", {
        chunkKey: chunk.chunkKey,
        error: lastError,
      });

      const emptyGroup = new THREE.Group();
      emptyGroup.name = `chunk_${chunk.chunkKey}_mesh_failed`;
      setChunkGroupTransform(emptyGroup, chunk);

      const stats: ChunkMeshBuildStats = {
        chunkKey: chunk.chunkKey,
        mode: meshMode,
        cellCount: chunk.stats.cellCount,
        nonAirCellCount: chunk.stats.nonAirCellCount,
        emittedCellCount: 0,
        skippedCellCount: chunk.stats.nonAirCellCount,
        meshCount: 0,
        materialCount: materialCache.size,
        blockStats: [],
        elapsedMs: elapsedMs(startedAt),
        createdAt: nowIsoString(),
      };

      const result: ChunkMeshResult = {
        kind: CHUNK_MESH_RESULT_KIND,
        chunkKey: chunk.chunkKey,
        chunk,
        group: emptyGroup,
        meshes: [],
        stats,
        dispose: () => disposeMeshResult(result),
      };

      return result;
    }
  }

  const handle: ChunkMesherHandle = {
    kind: CHUNK_MESHER_KIND,

    buildChunkMesh,

    rebuildChunkMesh(
      previous: ChunkMeshResult | null,
      chunk: RuntimeChunkContent,
      buildOptions?: ChunkMeshBuildOptions,
    ): ChunkMeshResult {
      handle.disposeChunkMesh(previous);
      return buildChunkMesh(chunk, buildOptions);
    },

    disposeChunkMesh(result: ChunkMeshResult | null | undefined): void {
      disposeMeshResult(result);
    },

    getStatus(): ChunkMesherStatus {
      return status;
    },

    getSnapshot(): ChunkMesherSnapshot {
      return {
        kind: CHUNK_MESHER_SNAPSHOT_KIND,
        status,
        mode,
        createdAt,
        updatedAt,
        disposedAt,
        builtChunkCount,
        failedBuildCount,
        cachedMaterialCount: materialCache.size,
        lastChunkKey,
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
        sharedBoxGeometry.dispose();
      } catch {
        // Ignore.
      }

      for (const material of materialCache.values()) {
        try {
          material.dispose();
        } catch {
          // Ignore.
        }
      }

      materialCache.clear();
      setStatus("disposed");

      logDebug(logger, "Chunk mesher disposed.", {
        reason: reason ?? null,
        builtChunkCount,
        failedBuildCount,
      });
    },
  };

  setStatus("ready");

  logDebug(logger, "Chunk mesher created.", {
    mode,
    cellScale,
    maxCellsPerChunk,
    wireframe: defaultWireframe,
    castShadow,
    receiveShadow,
  });

  return handle;
}

export function isChunkMeshResult(value: unknown): value is ChunkMeshResult {
  try {
    return Boolean(value)
      && typeof value === "object"
      && (value as { kind?: unknown }).kind === CHUNK_MESH_RESULT_KIND;
  } catch {
    return false;
  }
}

export function chunkMeshResultToDebugSummary(result: ChunkMeshResult): Record<string, unknown> {
  try {
    return {
      kind: result.kind,
      chunkKey: result.chunkKey,
      meshCount: result.meshes.length,
      groupName: result.group.name,
      stats: result.stats,
      chunk: {
        source: result.chunk.source,
        revision: result.chunk.chunkRevision,
        version: result.chunk.chunkVersion,
        loadedAt: result.chunk.loadedAt,
      },
    };
  } catch (error) {
    return {
      kind: CHUNK_MESH_RESULT_KIND,
      debugSummaryFailed: true,
      error: normalizeUnknownError(error),
    };
  }
}