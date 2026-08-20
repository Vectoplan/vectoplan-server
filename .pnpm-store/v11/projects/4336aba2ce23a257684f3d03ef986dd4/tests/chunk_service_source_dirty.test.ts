import assert from "node:assert/strict";
import test from "node:test";

import type { ChunkApiClient } from "../src/frontend/api/chunk_api_models";
import { createChunkServiceSource } from "../src/frontend/runtime/world/chunk_service_source";

test("external invalidations are recorded in the source dirty set", () => {
  const source = createChunkServiceSource({
    client: {} as ChunkApiClient,
    projectId: "project-live-update",
    worldId: "world_spawn",
  });

  source.markChunksDirty(
    ["12:0:-4", "13:0:-4", "12:0:-4"],
    "realtime-invalidation",
  );

  assert.deepEqual(
    new Set(source.getDirtyChunkKeys()),
    new Set(["12:0:-4", "13:0:-4"]),
  );

  assert.deepEqual(source.clearDirtyChunks(["12:0:-4"]), ["12:0:-4"]);
  assert.deepEqual(source.getDirtyChunkKeys(), ["13:0:-4"]);
});

