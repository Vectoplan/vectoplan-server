import assert from "node:assert/strict";
import test from "node:test";

import {
  LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS,
  LineBrushBuildingGeometryError,
  buildLineBrushBuildingGeometry,
  type LineBrushBuildingBlockCell,
} from "../src/frontend/world_edit/systems/room/line_brush_building_geometry";
import {
  createPathBrushDraft,
  type PathBrushDraft,
} from "../src/frontend/world_edit/systems/shared/path_brush_geometry";

function buildingDraft(
  points: readonly Readonly<{ x: number; y: number; z: number }>[],
  width: number,
): PathBrushDraft {
  const draft = createPathBrushDraft(points, { kind: "building", width });
  assert.ok(draft);
  return draft;
}

function cellKey(cell: Readonly<{ x: number; y?: number; z: number }>): string {
  return `${cell.x}:${cell.y ?? ""}:${cell.z}`;
}

function assertUniqueCells(cells: readonly LineBrushBuildingBlockCell[]): void {
  assert.equal(new Set(cells.map(cellKey)).size, cells.length);
  assert.ok(cells.every((cell) => [cell.x, cell.y, cell.z].every(Number.isInteger)));
}

test("whole-footprint geometry creates complete slabs and 4-neighbour exterior walls", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ], 4);
  const geometry = buildLineBrushBuildingGeometry({ draft, baseY: 0, storeyCount: 1 });

  assert.deepEqual(geometry.segmentScope, { kind: "all" });
  assert.equal(geometry.footprintCells.length, 16);
  assert.equal(geometry.exteriorFootprintCells.length, 12);
  assert.equal(geometry.storeys.length, 1);
  assert.equal(geometry.storeys[0]!.slabCells.length, 16, "the plate covers every centre-selected cell");
  assert.equal(geometry.storeys[0]!.wallCells.length, 24, "the slab owns the first layer and walls own the two layers above");
  assert.equal(geometry.storeys[0]!.occupiedCells.length, 40, "the wall/slab intersection is deduplicated");

  const wallKeys = new Set(geometry.storeys[0]!.wallCells.map(cellKey));
  assert.ok(
    geometry.storeys[0]!.slabCells.every((cell) => !wallKeys.has(cellKey(cell))),
    "wall and floor-slab placements never overlap",
  );

  const footprint = new Set(geometry.footprintCells.map(cellKey));
  const exterior = new Set(geometry.exteriorFootprintCells.map(cellKey));
  for (const cell of geometry.footprintCells) {
    const hasOutsideNeighbour = [
      [cell.x - 1, cell.z],
      [cell.x + 1, cell.z],
      [cell.x, cell.z - 1],
      [cell.x, cell.z + 1],
    ].some(([x, z]) => !footprint.has(`${x}::${z}`));
    assert.equal(exterior.has(cellKey(cell)), hasOutsideNeighbour);
  }
  assert.deepEqual(
    geometry.storeys[0]!.slabCells.map(({ x, z }) => ({ x, z })),
    geometry.footprintCells,
  );
  assertUniqueCells(geometry.storeys[0]!.occupiedCells);
  assertUniqueCells(geometry.occupiedCells);
});

test("semantic 2.645 m storeys use contiguous deterministic whole-block ranges", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  ], 3);
  const first = buildLineBrushBuildingGeometry({ draft, baseY: 10, storeyCount: 3 });
  const second = buildLineBrushBuildingGeometry({ draft, baseY: 10, storeyCount: 3 });

  assert.deepEqual(first, second);
  assert.equal(first.storeyHeightMeters, 2.645);
  assert.equal(first.storeyHeightMillimeters, 2645);
  assert.equal(first.totalHeightMeters, 7.935);
  assert.equal(first.totalHeightMillimeters, 7935);
  assert.deepEqual(first.storeys.map((storey) => [
    storey.minimumCellY,
    storey.maximumCellYExclusive,
  ]), [[10, 13], [13, 15], [15, 18]]);
  assert.deepEqual(first.storeys.map((storey) => storey.semanticHeightMillimeters), [2645, 2645, 2645]);
  assert.equal(first.storeys[1]!.semanticBaseY, 12.645);
  assert.equal(first.storeys[2]!.semanticTopY, 17.935);
  assertUniqueCells(first.wallCells);
  assertUniqueCells(first.slabCells);
  assertUniqueCells(first.occupiedCells);
});

test("segment scope can build one editable rectangle without changing the complete draft", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 4 },
  ], 2);
  const complete = buildLineBrushBuildingGeometry({ draft, baseY: 2, storeyCount: 1 });
  const shorthand = buildLineBrushBuildingGeometry({
    draft,
    baseY: 2,
    storeyCount: 1,
    segmentScope: 0,
  });
  const explicit = buildLineBrushBuildingGeometry({
    draft,
    baseY: 2,
    storeyCount: 1,
    segmentScope: { kind: "segment", segmentIndex: 0 },
  });

  assert.deepEqual(shorthand, explicit);
  assert.deepEqual(shorthand.segmentScope, { kind: "segment", segmentIndex: 0 });
  assert.equal(shorthand.footprintCells.length, 8);
  assert.ok(shorthand.footprintCells.every((cell) => cell.x >= 0 && cell.x < 4 && cell.z >= -1 && cell.z < 1));
  assert.ok(complete.footprintCells.length > shorthand.footprintCells.length);
  assert.equal(draft.footprint.coordinates.length, 1, "the source draft remains untouched");
});

test("MultiPolygon parts and courtyard holes are rasterised and deduplicated", () => {
  const source = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
  ], 5);
  const draft: PathBrushDraft = {
    ...source,
    footprint: {
      type: "MultiPolygon",
      coordinateSpace: "world-cell-xz",
      coordinates: [
        [
          [[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]],
          [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]],
        ],
        [
          [[10, 0], [12, 0], [12, 2], [10, 2], [10, 0]],
        ],
        // This overlapping part deliberately exercises cross-polygon dedupe.
        [
          [[10, 0], [12, 0], [12, 2], [10, 2], [10, 0]],
        ],
      ],
    },
  };
  const geometry = buildLineBrushBuildingGeometry({ draft, baseY: 0, storeyCount: 1 });
  const footprint = new Set(geometry.footprintCells.map(cellKey));
  const exterior = new Set(geometry.exteriorFootprintCells.map(cellKey));

  assert.equal(geometry.footprintCells.length, 28);
  assert.equal(footprint.has("2::2"), false, "the courtyard remains empty");
  assert.equal(footprint.has("10::0"), true, "the second MultiPolygon part is retained");
  assert.equal(exterior.size, 24);
  for (const key of ["1::2", "3::2", "2::1", "2::3"]) {
    assert.equal(exterior.has(key), true, `${key} is an editable courtyard exterior wall`);
  }
  assert.equal(geometry.occupiedCells.length, 76);
  assertUniqueCells(geometry.occupiedCells);
});

test("the 65,536-cell contract rejects oversized output instead of truncating it", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 30, y: 0, z: 0 },
  ], 30);
  assert.throws(
    () => buildLineBrushBuildingGeometry({ draft, baseY: 0, storeyCount: 80 }),
    (error: unknown) => {
      assert.ok(error instanceof LineBrushBuildingGeometryError);
      assert.equal(error.code, "cell-limit-exceeded");
      assert.equal(error.cellLimit, LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS);
      assert.equal(error.requestedCells, 72_000);
      return true;
    },
  );
});

test("invalid drafts and segment scopes fail visibly", () => {
  const building = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ], 2);
  assert.throws(
    () => buildLineBrushBuildingGeometry({
      draft: building,
      baseY: 0,
      storeyCount: 1,
      segmentScope: { kind: "segment", segmentIndex: 99 },
    }),
    (error: unknown) => error instanceof LineBrushBuildingGeometryError
      && error.code === "invalid-segment-scope",
  );

  const road = createPathBrushDraft([
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ], { kind: "road", width: 2 });
  assert.ok(road);
  assert.throws(
    () => buildLineBrushBuildingGeometry({ draft: road, baseY: 0, storeyCount: 1 }),
    (error: unknown) => error instanceof LineBrushBuildingGeometryError
      && error.code === "invalid-draft",
  );
});
