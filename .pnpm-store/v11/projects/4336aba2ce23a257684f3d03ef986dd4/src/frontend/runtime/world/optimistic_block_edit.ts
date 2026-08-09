import type { ChunkApiPaletteEntry } from "@api/chunk_api_models";
import {
  CHUNK_API_AIR_CELL_VALUE,
  cloneCellsWithMutation,
  cloneRuntimeChunkContent,
  type RuntimeChunkContent,
  type RuntimeChunkPaletteEntry,
} from "./chunk_content";
import {
  createChunkCellAddress,
  type ChunkCellAddress,
  type ChunkWorldPosition,
} from "./chunk_coordinates";
import type { ChunkRegistryHandle } from "./chunk_registry";

export interface OptimisticBlockEditResult {
  readonly changed: boolean;
  readonly address: ChunkCellAddress;
  readonly cellKey: string;
  readonly chunkKey: string;
  readonly previousCellValue: number;
  readonly nextCellValue: number;
  readonly previousBlockTypeId: string | null;
  readonly nextBlockTypeId: string | null;
  readonly affectedMeshChunkKeys: readonly string[];
}

export interface ApplyOptimisticBlockEditOptions {
  readonly registry: ChunkRegistryHandle;
  readonly position: ChunkWorldPosition;
  readonly blockTypeId: string | null;
  readonly revision: number;
  readonly label?: string | null;
  readonly color?: string | null;
}

export interface ApplyOptimisticCellValueOptions {
  readonly registry: ChunkRegistryHandle;
  readonly position: ChunkWorldPosition;
  readonly cellValue: number;
  readonly revision: number;
}

function normalizeBlockTypeId(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function resolveChunkSize(registry: ChunkRegistryHandle): number {
  for (const chunkKey of registry.getChunkKeys()) {
    const chunk = registry.getChunk(chunkKey);
    if (chunk && Number.isInteger(chunk.chunkSize) && chunk.chunkSize > 0) {
      return chunk.chunkSize;
    }
  }
  return 16;
}

function chunkKey(chunkX: number, chunkY: number, chunkZ: number): string {
  return `${chunkX}:${chunkY}:${chunkZ}`;
}

function affectedMeshChunkKeys(address: ChunkCellAddress, chunkSize: number): readonly string[] {
  const keys = new Set<string>([address.chunkKey]);
  if (address.localX === 0) keys.add(chunkKey(address.chunkX - 1, address.chunkY, address.chunkZ));
  if (address.localX === chunkSize - 1) keys.add(chunkKey(address.chunkX + 1, address.chunkY, address.chunkZ));
  if (address.localY === 0) keys.add(chunkKey(address.chunkX, address.chunkY - 1, address.chunkZ));
  if (address.localY === chunkSize - 1) keys.add(chunkKey(address.chunkX, address.chunkY + 1, address.chunkZ));
  if (address.localZ === 0) keys.add(chunkKey(address.chunkX, address.chunkY, address.chunkZ - 1));
  if (address.localZ === chunkSize - 1) keys.add(chunkKey(address.chunkX, address.chunkY, address.chunkZ + 1));
  return [...keys];
}

function findPaletteEntry(
  registry: ChunkRegistryHandle,
  blockTypeId: string,
): RuntimeChunkPaletteEntry | null {
  for (const chunkKeyValue of registry.getChunkKeys()) {
    const entry = registry.getChunk(chunkKeyValue)?.paletteByBlockTypeId.get(blockTypeId);
    if (entry) return entry;
  }
  return null;
}

function createPaletteEntry(
  chunk: RuntimeChunkContent,
  blockTypeId: string,
  borrowed: RuntimeChunkPaletteEntry | null,
  label?: string | null,
  color?: string | null,
): ChunkApiPaletteEntry {
  if (borrowed) return borrowed.raw;
  const first = chunk.palette[0] ?? null;
  return {
    blockTypeId,
    label: normalizeBlockTypeId(label) ?? blockTypeId,
    registryId: first?.registryId ?? "vectoplan-library",
    registryVersion: first?.registryVersion ?? "1",
    solid: true,
    placeable: true,
    breakable: true,
    metadata: color ? { color, debugColor: color } : {},
  };
}

function editLoadedChunk(
  registry: ChunkRegistryHandle,
  address: ChunkCellAddress,
  chunk: RuntimeChunkContent,
  nextCellValue: number,
  revision: number,
  palette?: readonly ChunkApiPaletteEntry[],
): RuntimeChunkContent {
  const entry = registry.getEntry(chunk.chunkKey);
  const nextChunk = cloneRuntimeChunkContent(chunk, {
    cells: cloneCellsWithMutation(chunk, address, nextCellValue),
    palette: palette ?? chunk.raw.palette,
    // The mesh revision token must change even when several clicks land in the
    // same millisecond.
    loadedAt: `${new Date().toISOString()}#optimistic-${revision}`,
  });
  registry.setChunk(nextChunk, {
    visible: entry?.visible ?? true,
    dirty: entry?.dirty ?? false,
    reason: "optimistic-block-edit",
  });
  return nextChunk;
}

function emptyResult(
  address: ChunkCellAddress,
  cellValue: number,
): OptimisticBlockEditResult {
  return {
    changed: false,
    address,
    cellKey: `${address.chunkKey}:${address.cellIndex}`,
    chunkKey: address.chunkKey,
    previousCellValue: cellValue,
    nextCellValue: cellValue,
    previousBlockTypeId: null,
    nextBlockTypeId: null,
    affectedMeshChunkKeys: [address.chunkKey],
  };
}

export function applyOptimisticBlockEdit(
  options: ApplyOptimisticBlockEditOptions,
): OptimisticBlockEditResult {
  const blockTypeId = normalizeBlockTypeId(options.blockTypeId);
  const chunkSize = resolveChunkSize(options.registry);
  const address = createChunkCellAddress({
    worldX: options.position.x,
    worldY: options.position.y,
    worldZ: options.position.z,
    chunkSize,
  });
  const chunk = options.registry.getChunk(address.chunkKey);
  if (!chunk) return emptyResult(address, CHUNK_API_AIR_CELL_VALUE);

  const previousCellValue = Number(chunk.cells[address.cellIndex] ?? CHUNK_API_AIR_CELL_VALUE);
  const previousBlockTypeId = chunk.paletteByCellValue.get(previousCellValue)?.blockTypeId ?? null;
  let nextCellValue: number = CHUNK_API_AIR_CELL_VALUE;
  let palette = chunk.raw.palette;

  if (blockTypeId) {
    const localEntry = chunk.paletteByBlockTypeId.get(blockTypeId) ?? null;
    if (localEntry) {
      nextCellValue = localEntry.cellValue;
    } else {
      const borrowed = findPaletteEntry(options.registry, blockTypeId);
      palette = [
        ...chunk.raw.palette,
        createPaletteEntry(chunk, blockTypeId, borrowed, options.label, options.color),
      ];
      nextCellValue = palette.length;
    }
  }

  if (previousCellValue === nextCellValue) {
    return {
      ...emptyResult(address, previousCellValue),
      previousBlockTypeId,
      nextBlockTypeId: blockTypeId,
    };
  }

  editLoadedChunk(
    options.registry,
    address,
    chunk,
    nextCellValue,
    options.revision,
    palette,
  );
  return {
    changed: true,
    address,
    cellKey: `${address.chunkKey}:${address.cellIndex}`,
    chunkKey: address.chunkKey,
    previousCellValue,
    nextCellValue,
    previousBlockTypeId,
    nextBlockTypeId: blockTypeId,
    affectedMeshChunkKeys: affectedMeshChunkKeys(address, chunk.chunkSize),
  };
}

export function applyOptimisticCellValue(
  options: ApplyOptimisticCellValueOptions,
): OptimisticBlockEditResult {
  const chunkSize = resolveChunkSize(options.registry);
  const address = createChunkCellAddress({
    worldX: options.position.x,
    worldY: options.position.y,
    worldZ: options.position.z,
    chunkSize,
  });
  const chunk = options.registry.getChunk(address.chunkKey);
  if (!chunk) return emptyResult(address, CHUNK_API_AIR_CELL_VALUE);
  const previousCellValue = Number(chunk.cells[address.cellIndex] ?? CHUNK_API_AIR_CELL_VALUE);
  const nextCellValue = Math.max(CHUNK_API_AIR_CELL_VALUE, Math.trunc(options.cellValue));
  if (previousCellValue === nextCellValue) return emptyResult(address, previousCellValue);
  editLoadedChunk(options.registry, address, chunk, nextCellValue, options.revision);
  return {
    changed: true,
    address,
    cellKey: `${address.chunkKey}:${address.cellIndex}`,
    chunkKey: address.chunkKey,
    previousCellValue,
    nextCellValue,
    previousBlockTypeId: chunk.paletteByCellValue.get(previousCellValue)?.blockTypeId ?? null,
    nextBlockTypeId: chunk.paletteByCellValue.get(nextCellValue)?.blockTypeId ?? null,
    affectedMeshChunkKeys: affectedMeshChunkKeys(address, chunk.chunkSize),
  };
}
