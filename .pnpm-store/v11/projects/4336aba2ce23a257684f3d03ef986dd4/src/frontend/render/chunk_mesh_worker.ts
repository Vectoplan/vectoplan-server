/// <reference lib="webworker" />

import type {
  ChunkMeshWorkerBuffer,
  ChunkMeshWorkerRequest,
  ChunkMeshWorkerResponse,
  ChunkMeshWorkerResult,
} from "./chunk_mesh_worker_models";

interface Direction {
  readonly axis: 0 | 1 | 2;
  readonly sign: -1 | 1;
  readonly uAxis: 0 | 1 | 2;
  readonly vAxis: 0 | 1 | 2;
  readonly normal: readonly [number, number, number];
}

interface MutableBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  quadCount: number;
}

const DIRECTIONS: readonly Direction[] = [
  { axis: 0, sign: 1, uAxis: 1, vAxis: 2, normal: [1, 0, 0] },
  { axis: 0, sign: -1, uAxis: 2, vAxis: 1, normal: [-1, 0, 0] },
  { axis: 1, sign: 1, uAxis: 2, vAxis: 0, normal: [0, 1, 0] },
  { axis: 1, sign: -1, uAxis: 0, vAxis: 2, normal: [0, -1, 0] },
  { axis: 2, sign: 1, uAxis: 0, vAxis: 1, normal: [0, 0, 1] },
  { axis: 2, sign: -1, uAxis: 1, vAxis: 0, normal: [0, 0, -1] },
];

function localIndex(x: number, y: number, z: number, size: number): number {
  return x + size * (y + size * z);
}

function createBuffers(): MutableBuffers {
  return { positions: [], normals: [], uvs: [], indices: [], quadCount: 0 };
}

function buildMesh(request: ChunkMeshWorkerRequest): ChunkMeshWorkerResult {
  const startedAt = performance.now();
  const chunk = request.chunk;
  const size = chunk.chunkSize;
  const byCellValue = new Map<number, MutableBuffers>();

  function valueAt(x: number, y: number, z: number): number {
    if (x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size) {
      return chunk.cells[localIndex(x, y, z, size)] ?? 0;
    }
    if (x < 0) return chunk.boundaries.negativeX[y + z * size] ? 1 : 0;
    if (x >= size) return chunk.boundaries.positiveX[y + z * size] ? 1 : 0;
    if (y < 0) return chunk.boundaries.negativeY[x + z * size] ? 1 : 0;
    if (y >= size) return chunk.boundaries.positiveY[x + z * size] ? 1 : 0;
    if (z < 0) return chunk.boundaries.negativeZ[x + y * size] ? 1 : 0;
    if (z >= size) return chunk.boundaries.positiveZ[x + y * size] ? 1 : 0;
    return 0;
  }

  function appendQuad(
    buffers: MutableBuffers,
    direction: Direction,
    slice: number,
    u: number,
    v: number,
    width: number,
    height: number,
  ): void {
    const origin = [0, 0, 0];
    const du = [0, 0, 0];
    const dv = [0, 0, 0];
    origin[direction.axis] = slice + (direction.sign > 0 ? 1 : 0);
    origin[direction.uAxis] = u;
    origin[direction.vAxis] = v;
    du[direction.uAxis] = width;
    dv[direction.vAxis] = height;
    const offset = [chunk.chunkX * size, chunk.chunkY * size, chunk.chunkZ * size];
    const vertexOffset = buffers.positions.length / 3;
    for (let cornerIndex = 0; cornerIndex < 4; cornerIndex += 1) {
      const addU = cornerIndex === 1 || cornerIndex === 2;
      const addV = cornerIndex >= 2;
      for (let axis = 0; axis < 3; axis += 1) {
        const coordinate = origin[axis]
          + (addU ? du[axis] : 0)
          + (addV ? dv[axis] : 0);
        buffers.positions.push((offset[axis] + coordinate) * chunk.cellSize);
        buffers.normals.push(direction.normal[axis]);
      }
    }
    buffers.uvs.push(0, 0, width, 0, width, height, 0, height);
    buffers.indices.push(
      vertexOffset,
      vertexOffset + 1,
      vertexOffset + 2,
      vertexOffset,
      vertexOffset + 2,
      vertexOffset + 3,
    );
    buffers.quadCount += 1;
  }

  const mask = new Int32Array(size * size);
  for (const direction of DIRECTIONS) {
    for (let slice = 0; slice < size; slice += 1) {
      mask.fill(0);
      for (let v = 0; v < size; v += 1) {
        for (let u = 0; u < size; u += 1) {
          let x = 0;
          let y = 0;
          let z = 0;
          if (direction.axis === 0) x = slice;
          else if (direction.axis === 1) y = slice;
          else z = slice;
          if (direction.uAxis === 0) x = u;
          else if (direction.uAxis === 1) y = u;
          else z = u;
          if (direction.vAxis === 0) x = v;
          else if (direction.vAxis === 1) y = v;
          else z = v;

          const cellValue = valueAt(x, y, z);
          if (cellValue <= 0) continue;
          const neighborX = x + (direction.axis === 0 ? direction.sign : 0);
          const neighborY = y + (direction.axis === 1 ? direction.sign : 0);
          const neighborZ = z + (direction.axis === 2 ? direction.sign : 0);
          if (valueAt(neighborX, neighborY, neighborZ) > 0) continue;
          mask[u + v * size] = cellValue;
        }
      }

      for (let v = 0; v < size; v += 1) {
        for (let u = 0; u < size;) {
          const cellValue = mask[u + v * size];
          if (cellValue <= 0) {
            u += 1;
            continue;
          }
          let width = 1;
          while (u + width < size && mask[u + width + v * size] === cellValue) width += 1;
          let height = 1;
          heightLoop: while (v + height < size) {
            for (let offset = 0; offset < width; offset += 1) {
              if (mask[u + offset + (v + height) * size] !== cellValue) break heightLoop;
            }
            height += 1;
          }
          let buffers = byCellValue.get(cellValue);
          if (!buffers) {
            buffers = createBuffers();
            byCellValue.set(cellValue, buffers);
          }
          appendQuad(buffers, direction, slice, u, v, width, height);
          for (let clearV = 0; clearV < height; clearV += 1) {
            for (let clearU = 0; clearU < width; clearU += 1) {
              mask[u + clearU + (v + clearV) * size] = 0;
            }
          }
          u += width;
        }
      }
    }
  }

  let quadCount = 0;
  const buffers: ChunkMeshWorkerBuffer[] = [];
  for (const [cellValue, mutable] of byCellValue.entries()) {
    quadCount += mutable.quadCount;
    buffers.push({
      cellValue,
      positions: new Float32Array(mutable.positions),
      normals: new Float32Array(mutable.normals),
      uvs: new Float32Array(mutable.uvs),
      indices: new Uint32Array(mutable.indices),
      quadCount: mutable.quadCount,
    });
  }
  return {
    chunkKey: chunk.chunkKey,
    buffers,
    quadCount,
    triangleCount: quadCount * 2,
    buildMs: performance.now() - startedAt,
  };
}

self.onmessage = (event: MessageEvent<ChunkMeshWorkerRequest>): void => {
  const request = event.data;
  try {
    const result = buildMesh(request);
    const response: ChunkMeshWorkerResponse = { id: request.id, ok: true, result };
    const transfers: Transferable[] = [];
    for (const buffer of result.buffers) {
      transfers.push(
        buffer.positions.buffer,
        buffer.normals.buffer,
        buffer.uvs.buffer,
        buffer.indices.buffer,
      );
    }
    self.postMessage(response, { transfer: transfers });
  } catch (error) {
    const response: ChunkMeshWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
