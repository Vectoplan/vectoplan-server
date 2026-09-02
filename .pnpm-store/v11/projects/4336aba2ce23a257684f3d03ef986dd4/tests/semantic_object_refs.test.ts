import assert from "node:assert/strict";
import test from "node:test";

import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import {
  isVplibParametricObjectRef,
  shouldRenderSemanticFootprint,
} from "../src/frontend/scene/semantic_object_rendering";

const semanticRef = {
  objectInstanceId: "obj_test_semantic_grid",
  objectKind: "semantic_footprint",
  objectTypeId: "parcel_grid_body",
  primaryChunkKey: "-4:0:1",
  fillBlockTypeId: "system_terrain",
  occupiedCells: [{ x: -54, y: 1, z: 29 }],
  footprint: {
    type: "Polygon",
    coordinateSpace: "world-cell-xz",
    baseY: 1,
    height: 1,
    coordinates: [[
      [-54.5, 29],
      [-53.5, 29.5],
      [-54, 30.5],
      [-55, 30],
      [-54.5, 29],
    ]],
  },
  metadata: {
    mergeKey: "parcel-grid:test-row",
  },
};

test("keeps semantic objectRefs from the productive batch envelope in runtime chunks", () => {
  const raw = {
    ok: true,
    projectId: "project-test",
    worldId: "world_spawn",
    chunks: [{
      chunkKey: "-4:0:1",
      chunk: {
        projectId: "project-test",
        worldId: "world_spawn",
        chunkKey: "-4:0:1",
        chunkX: -4,
        chunkY: 0,
        chunkZ: 1,
        chunkSize: 16,
        cellSize: 1,
        source: "snapshot",
        cells: Array.from({ length: 16 ** 3 }, () => 0),
        palette: [{
          blockTypeId: "system_terrain",
          runtimeBlockTypeId: "system_terrain",
          cellValue: 1,
          placeable: true,
          breakable: true,
          solid: true,
        }],
        stats: {
          cellCount: 16 ** 3,
          airCellCount: 16 ** 3,
          nonAirCellCount: 0,
        },
        objectRefs: [semanticRef],
      },
    }],
  };

  const normalized = normalizeChunkApiBatchResult(raw, null, {
    projectId: "project-test",
    worldId: "world_spawn",
    requestedChunks: [{ chunkX: -4, chunkY: 0, chunkZ: 1 }],
  });

  assert.equal(normalized.ok, true);
  if (!normalized.ok) return;
  assert.equal(normalized.chunks.length, 1);
  assert.deepEqual(normalized.chunks[0]?.objectRefs, [semanticRef]);

  const runtime = createRuntimeChunkContent(normalized.chunks[0]!);
  assert.deepEqual(runtime.raw.objectRefs, [semanticRef]);
  assert.deepEqual((runtime.raw.raw as { objectRefs: unknown[] }).objectRefs, [semanticRef]);
});

test("renders CAD walls as their persisted full block cells instead of a thin extrusion", () => {
  assert.equal(shouldRenderSemanticFootprint({
    objectTypeId: "building_wall",
    metadata: { source: "vectoplan-cad", semanticRole: "wall", thicknessMm: 115 },
  }), false);
  assert.equal(shouldRenderSemanticFootprint({
    objectTypeId: "space_room",
    metadata: { source: "vectoplan-cad", semanticRole: "room" },
  }), true);
  assert.equal(shouldRenderSemanticFootprint({
    objectTypeId: "parcel_grid_body",
    metadata: { source: "vectoplan-editor" },
  }), true);
});

test("renders persisted planning build areas without voxel occupancy", () => {
  assert.equal(shouldRenderSemanticFootprint({
    objectTypeId: "planning_build_area",
    metadata: {
      source: "vectoplan-editor.world-edit.planning-line-brush",
      schemaVersion: "vectoplan-planning-build-area.v1",
      voxelOccupancy: "none",
    },
  }), true);
});

test("recognizes parametric VPLIB objects through the persisted library-object contract", () => {
  assert.equal(isVplibParametricObjectRef({
    objectKind: "library_object",
    metadata: { schemaVersion: "vectoplan-vplib-parametric.v1" },
  }), true);
  assert.equal(isVplibParametricObjectRef({
    objectKind: "library_object",
    metadata: { schemaVersion: "unrelated.v1" },
  }), false);
  assert.equal(isVplibParametricObjectRef({
    objectKind: "vplib_parametric",
    metadata: {},
  }), true);
});
