export interface ChunkMeshBoundaryMasks {
  readonly negativeX: Uint8Array;
  readonly positiveX: Uint8Array;
  readonly negativeY: Uint8Array;
  readonly positiveY: Uint8Array;
  readonly negativeZ: Uint8Array;
  readonly positiveZ: Uint8Array;
}

export interface ChunkMeshWorkerChunk {
  readonly chunkKey: string;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly chunkSize: number;
  readonly cellSize: number;
  readonly cells: Int32Array;
  readonly boundaries: ChunkMeshBoundaryMasks;
}

export interface ChunkMeshWorkerBuffer {
  readonly cellValue: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly quadCount: number;
}

export interface ChunkMeshWorkerResult {
  readonly chunkKey: string;
  readonly buffers: readonly ChunkMeshWorkerBuffer[];
  readonly quadCount: number;
  readonly triangleCount: number;
  readonly buildMs: number;
}

export interface ChunkMeshWorkerRequest {
  readonly id: number;
  readonly chunk: ChunkMeshWorkerChunk;
}

export interface ChunkMeshWorkerResponse {
  readonly id: number;
  readonly ok: boolean;
  readonly result?: ChunkMeshWorkerResult;
  readonly error?: string;
}
