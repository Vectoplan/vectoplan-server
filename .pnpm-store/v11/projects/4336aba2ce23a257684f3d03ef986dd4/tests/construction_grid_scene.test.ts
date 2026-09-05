import assert from "node:assert/strict";
import test from "node:test";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { appendSemanticObjectMeshes, createChunkMeshRecord, semanticObjectRefs } from "../src/frontend/scene/scene_runtime";
import { coalesceLineBrushStoreys } from "../src/frontend/world_edit/systems/line_brush/storey_ownership";
import { createPathBrushDraft } from "../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildLineBrushBuildingLayout } from "../src/frontend/world_edit/systems/line_brush/building_layout";
import { buildLineBrushBuildingGeometry } from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import { lineBrushBuildingPreset } from "../src/frontend/world_edit/systems/line_brush/building_presets";

test("construction cells render only from their owner chunk, including after a remote block removal", () => {
  const shape = (x: number) => ({ x, y: 2, z: 1, logicalCellId: `cell-${x}`,
    footprintPolygons: [[[x, 1], [x + 1, 1], [x + 1, 2], [x, 2]]] });
  const left = shape(15), right = shape(16);
  const render = (chunkX: number, removed: boolean) => {
    const occupiedCells = removed ? [left] : [left, right];
    const ref = { objectInstanceId: "storey", objectKind: "block_composite", objectTypeId: "planning_building_storey_walls",
      primaryChunkKey: "0:0:0", fillBlockTypeId: "lod2_exterior_wall", occupiedCells,
      footprint: { type: "MultiPolygon", coordinateSpace: "world-cell-xz", coordinates: [] },
      metadata: { renderProfile: "construction-grid", voxelOccupancy: "blocks", constructionCells: [left, right] } };
    const result = normalizeChunkApiBatchResult({ ok: true, chunks: [{ chunk: {
      projectId: "test", worldId: "test", chunkX, chunkY: 0, chunkZ: 0, chunkKey: `${chunkX}:0:0`,
      chunkSize: 16, cellSize: 1, cells: Array(4096).fill(0),
      palette: [{ blockTypeId: "lod2_exterior_wall", solid: true, breakable: true }], objectRefs: [ref],
    } }] }, null, { projectId: "test", worldId: "test" });
    assert.ok(result.ok);
    const chunk = createRuntimeChunkContent(result.chunks[0]!);
    return appendSemanticObjectMeshes(createChunkMeshRecord(chunk), chunk, semanticObjectRefs(chunk));
  };
  const primary = render(0, false), secondary = render(1, false), removed = render(1, true);
  assert.equal(primary.meshes[0]?.userData.constructionCellCount, 1);
  assert.equal(secondary.meshes[0]?.userData.constructionCellCount, 1);
  assert.equal(removed.meshes.length, 0, "stale metadata cannot recreate the removed cell");
  for (const record of [primary, secondary, removed]) {
    record.geometries.forEach((geometry) => geometry.dispose());
    record.materials.forEach((material) => material.dispose());
  }
});

test("stepped rotated wings consolidate all shared integer addresses into one owner per assembly", () => {
  const transform = (x: number, z: number) => {
    const angle = 0.37;
    return { x: 0.2 + x * Math.cos(angle) - z * Math.sin(angle), y: 0,
      z: 0.3 + x * Math.sin(angle) + z * Math.cos(angle) };
  };
  const draft = createPathBrushDraft([transform(0, 0), transform(23, 0), transform(23, 18)], { kind: "building", width: 6 })!;
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  const specs = draft.segments.flatMap((segment) => Array.from({ length: segment.index + 1 }, (_, storeyIndex) => {
    const geometry = buildLineBrushBuildingGeometry({ draft, layout, segmentScope: segment.index,
      baseY: storeyIndex * 2.645, storeyCount: 1, alignToBuildingGrid: true });
    return { scope: `segment:${segment.index}`, storeyIndex, storey: geometry.storeys[0]!,
      footprint: { type: "MultiPolygon", coordinates: layout.bySegment[String(segment.index)] } };
  }));
  const groups = coalesceLineBrushStoreys(specs);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.storey.occupiedCells.length,
    specs.filter((spec) => spec.storeyIndex === 0).reduce((sum, spec) => sum + spec.storey.occupiedCells.length, 0));
  const owners = new Set<string>();
  for (const group of groups) for (const assembly of [group.storey.wallCells, group.storey.slabCells]) {
    const addresses = new Set(assembly.map((cell) => `${cell.x}:${cell.y}:${cell.z}`));
    for (const key of addresses) {
      assert.ok(!owners.has(key), `address ${key} must have only one PlaceObject owner`);
      owners.add(key);
    }
  }
});
