import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS,
  LineBrushBuildingGeometryError,
  buildLineBrushBuildingGeometry,
  reserveLineBrushBuildingCellBudget,
  type LineBrushBuildingBlockCell,
} from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import { buildLineBrushBuildingLayout } from "../src/frontend/world_edit/systems/line_brush/building_layout";
import { lineBrushBuildingPreset } from "../src/frontend/world_edit/systems/line_brush/building_presets";
import { createLineBrushBuildingStructurePreview } from "../src/frontend/world_edit/systems/line_brush/building_preview";
import { buildLineBrushRoofZones } from "../src/frontend/world_edit/systems/line_brush/building_roofs";
import { parcelGridPolygonArea, intersectConvexParcelGridPolygons } from "../src/frontend/world_edit/systems/parcel_grid/geometry";
import { createConstructionCellMesh, constructionCellForIntersection, survivingConstructionCells } from "../src/frontend/scene/construction_cell_rendering";
import * as THREE from "three";
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

test("house preset keeps an exact four-metre clear gap and clamps building depth", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 40, y: 0, z: 0 },
  ], 20);
  const preset = lineBrushBuildingPreset("houses");
  const layout = buildLineBrushBuildingLayout(draft, preset);
  const geometry = buildLineBrushBuildingGeometry({
    draft,
    layout,
    baseY: 0,
    storeyCount: preset.defaultStoreyCount,
  });
  const occupied = new Set(geometry.footprintCells.map(cellKey));

  assert.equal(preset.arrangement.gapMeters, 4);
  assert.equal(layout.moduleCount, 2);
  assert.equal(layout.clearGapMeters, 4);
  assert.equal(layout.effectiveDepthMeters, 12, "a wider brush does not widen a house beyond its preset");
  assert.equal(layout.bySegment["0"]?.length, 2);
  assert.equal(occupied.has("17::0"), true, "the first house reaches the edge before the gap");
  for (const x of [18, 19, 20, 21]) {
    assert.equal(occupied.has(`${x}::0`), false, `x=${x} stays clear between houses`);
  }
  assert.equal(occupied.has("22::0"), true, "the next house starts after four clear metres");
  assert.ok(geometry.footprintCells.every((cell) => cell.z >= -6 && cell.z < 6));

  const secondStorey = buildLineBrushBuildingGeometry({
    draft,
    layout,
    baseY: 0,
    storeyCount: 1,
    segmentScope: { kind: "segment", segmentIndex: 0 },
  });
  assert.deepEqual(secondStorey.footprintCells, geometry.footprintCells);
});

test("house modules keep their clear gap and never double-occupy cells at a two-segment bend", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 40, y: 0, z: 0 },
    { x: 40, y: 0, z: 40 },
  ], 20);
  const preset = lineBrushBuildingPreset("houses");
  const layout = buildLineBrushBuildingLayout(draft, preset);
  const firstModules = layout.bySegment["0"] ?? [];
  const secondModules = layout.bySegment["1"] ?? [];
  assert.equal(firstModules.length, 2);
  assert.equal(secondModules.length, 2);

  const firstCornerModule = firstModules.at(-1)?.[0] ?? [];
  const secondCornerModule = secondModules[0]?.[0] ?? [];
  const firstMaximumX = Math.max(...firstCornerModule.map(([x]) => x));
  const firstMaximumZ = Math.max(...firstCornerModule.map(([, z]) => z));
  const secondMinimumX = Math.min(...secondCornerModule.map(([x]) => x));
  const secondMinimumZ = Math.min(...secondCornerModule.map(([, z]) => z));
  assert.ok(Math.abs(Math.hypot(
    secondMinimumX - firstMaximumX,
    secondMinimumZ - firstMaximumZ,
  ) - preset.arrangement.gapMeters) < 1e-7, "the nearest module corners retain the exact four-metre gap");

  const firstGeometry = buildLineBrushBuildingGeometry({
    draft,
    layout,
    baseY: 0,
    storeyCount: 1,
    segmentScope: { kind: "segment", segmentIndex: 0 },
  });
  const secondGeometry = buildLineBrushBuildingGeometry({
    draft,
    layout,
    baseY: 0,
    storeyCount: 1,
    segmentScope: { kind: "segment", segmentIndex: 1 },
  });
  const firstCells = new Set(firstGeometry.footprintCells.map(cellKey));
  assert.ok(
    secondGeometry.footprintCells.every((cell) => !firstCells.has(cellKey(cell))),
    "adjacent wings never assign the same whole block to two segment modules",
  );
});

test("live structure preview deduplicates cells and marks the selected segment scope", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ], 4);
  const geometry = buildLineBrushBuildingGeometry({ draft, baseY: 0, storeyCount: 1 });
  const storey = geometry.storeys[0]!;
  const group = createLineBrushBuildingStructurePreview({
    storeys: [
      { scope: "segment:0", storey },
      { scope: "segment:0", storey },
      { scope: "segment:1", storey },
    ],
    selectedScope: "segment:0",
  });
  const selectedWalls = group.getObjectByName("line-brush-preview:selected:walls") as {
    count: number;
    material: Readonly<{ opacity: number }>;
  } | undefined;
  const ordinaryWalls = group.getObjectByName("line-brush-preview:all:walls") as {
    count: number;
    material: Readonly<{ opacity: number }>;
  } | undefined;
  const selectedSlabs = group.getObjectByName("line-brush-preview:selected:slabs") as {
    count: number;
  } | undefined;

  assert.equal(group.userData.selectedScope, "segment:0");
  assert.equal(selectedWalls?.count, storey.wallCells.length, "duplicate preview inputs produce one wall instance per cell");
  assert.equal(selectedSlabs?.count, storey.slabCells.length, "duplicate preview inputs produce one slab instance per cell");
  assert.equal(ordinaryWalls?.count, storey.wallCells.length);
  assert.equal(selectedWalls?.material.opacity, 1, "selected walls remain opaque");
  assert.equal(ordinaryWalls?.material.opacity, 1, "other wings remain opaque too");
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

test("the shared 65,536-cell budget covers all independently generated storey specs", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 },
    { x: 30, y: 0, z: 0 },
  ], 30);
  const oneStorey = buildLineBrushBuildingGeometry({
    draft,
    baseY: 0,
    storeyCount: 1,
  });
  let total = 0;
  let acceptedStoreys = 0;
  assert.throws(
    () => {
      for (let storey = 0; storey < 80; storey += 1) {
        total = reserveLineBrushBuildingCellBudget(total, oneStorey.occupiedCells.length);
        acceptedStoreys += 1;
      }
    },
    (error: unknown) => {
      assert.ok(error instanceof LineBrushBuildingGeometryError);
      assert.equal(error.code, "cell-limit-exceeded");
      assert.ok((error.requestedCells ?? 0) > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS);
      return true;
    },
  );
  assert.ok(acceptedStoreys < 80, "the aggregate budget stops the split build before millions of cells are collected");
  assert.ok(total <= LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS);

  const source = readFileSync(resolve("src/frontend/world_edit/world_edit_controller.ts"), "utf8");
  assert.match(source, /occupiedCellCount = reserveLineBrushBuildingCellBudget\(/);
  assert.match(source, /if \(buildingPreviewWithinCellBudget\) \{\s*schedulePlanningBuildingRoofPreview/);
  assert.match(source, /const storeySpecs = planningStoreyBuildSpecs[\s\S]*const roofSpecs = await planningRoofBuildSpecs/);
});

test("rapid line-brush edits abort the stale CAD roof request chain", () => {
  const source = readFileSync(resolve("src/frontend/world_edit/world_edit_controller.ts"), "utf8");
  assert.match(source, /planningBuildingRoofPreviewAbortController\?\.abort\(\)/);
  assert.match(source, /planningRoofBuildSpecs\(draft, baseY, undefined, abortController\.signal\)/);
  assert.match(source, /requestRoofCalculation\(request, signal\)/);
  assert.match(source, /abortController\.signal\.aborted/);
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

test("rotated construction grid preserves exact straight facades and storey roof contact", () => {
  const angle = 31 * Math.PI / 180;
  const point = (u: number, v: number) => ({ x: 17.3 + u * Math.cos(angle) - v * Math.sin(angle),
    y: 4, z: 8.7 + u * Math.sin(angle) + v * Math.cos(angle) });
  const draft = buildingDraft([point(0, 0), point(24.6, 0)], 7.4);
  const geometry = buildLineBrushBuildingGeometry({ draft, baseY: 4, storeyCount: 3, alignToBuildingGrid: true });
  const area = geometry.footprintCells.reduce((sum, cell) => sum
    + (cell.footprintPolygons ?? []).reduce((total, polygon) => total + parcelGridPolygonArea(polygon), 0), 0);
  assert.ok(Math.abs(area - 24.6 * 7.4) < 1e-5, `exact footprint coverage, got ${area}`);
  assert.ok(geometry.wallCells.every((cell) => cell.footprintPolygons?.length && cell.exterior));
  for (const storey of geometry.storeys) {
    assert.equal(Math.max(...storey.wallCells.map((cell) => cell.maximumY!)), storey.semanticTopY);
    assert.equal(Math.min(...storey.wallCells.map((cell) => cell.minimumY!)), storey.semanticBaseY + 0.25);
  }
  const inverse = ([x, z]: readonly [number, number]) => [
    (x - 17.3) * Math.cos(angle) + (z - 8.7) * Math.sin(angle),
    -(x - 17.3) * Math.sin(angle) + (z - 8.7) * Math.cos(angle),
  ];
  for (const cell of geometry.footprintCells) for (const polygon of cell.footprintPolygons ?? []) {
    assert.ok(polygon.map(inverse).every(([u, v]) => u! >= -1e-6 && u! <= 24.6 + 1e-6 && Math.abs(v!) <= 3.7 + 1e-6));
  }
});

test("stepped wings have a shared miter seam and no duplicated interior footprint", () => {
  const draft = buildingDraft([{ x: 0, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }, { x: 24, y: 0, z: 18 }], 6);
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  const first = layout.bySegment["0"]![0]![0]!;
  const second = layout.bySegment["1"]![0]![0]!;
  assert.deepEqual(first[1], second[0]);
  assert.deepEqual(first[2], second[3]);
  assert.ok(parcelGridPolygonArea(intersectConvexParcelGridPolygons(first, second)) < 1e-7);
  const roofTypes = ["gable", "hipped", "half_hipped", "pent", "mansard", "trapezoid", "butterfly", "pyramid", "barrel", "sawtooth"] as const;
  for (const type of roofTypes) {
    const ordinary = buildLineBrushRoofZones(draft, layout, type, false);
    const stepped = buildLineBrushRoofZones(draft, layout, type, true);
    assert.equal(ordinary.length, 2, type);
    assert.deepEqual(ordinary.map((zone) => zone.ridgeDirection), [0, 90], type);
    assert.deepEqual(ordinary.map((zone) => zone.polygon), stepped.map((zone) => zone.polygon), type);
    assert.deepEqual(ordinary.map((zone) => zone.interiorEdges), [[1], [3]], type);
  }
});

test("construction mesh raycast resolves its integer edit address and removed blocks stay removed", () => {
  const cell = { x: 7, y: 3, z: 9, logicalCellId: "wall-a", minimumY: 3.25, maximumY: 4.6,
    footprintPolygons: [[[7.2, 9.1], [8.1, 9.4], [7.8, 10.3], [6.9, 10]]] as const };
  const material = new THREE.MeshBasicMaterial();
  const mesh = createConstructionCellMesh([cell], material)!;
  const hit = new THREE.Raycaster(new THREE.Vector3(7.5, 8, 9.7), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0];
  assert.ok(hit);
  assert.ok(Math.abs(hit.point.y - 4.6) < 1e-5);
  assert.equal(constructionCellForIntersection(hit), cell);
  const center = new THREE.Vector3(7.5, 3.9, 9.7);
  for (const polygon of cell.footprintPolygons) for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!, end = polygon[(index + 1) % polygon.length]!;
    const outward = new THREE.Vector3(end[1] - start[1], 0, start[0] - end[0]).normalize();
    const midpoint = new THREE.Vector3((start[0] + end[0]) / 2, center.y, (start[1] + end[1]) / 2);
    const sideHit = new THREE.Raycaster(midpoint.clone().addScaledVector(outward, 3), outward.clone().negate()).intersectObject(mesh)[0];
    assert.ok(sideHit, `side ${index} must be visible and targetable from outside`);
    assert.ok(sideHit.face!.normal.dot(outward) > 0.999);
    assert.ok(sideHit.point.distanceTo(midpoint) < 1e-5);
  }
  assert.equal(survivingConstructionCells([cell], [cell]).length, 1);
  assert.equal(survivingConstructionCells([cell], []).length, 0);
  mesh.geometry.dispose(); material.dispose();
});

test("closed courtyard roofs share the final seam and preserve the courtyard", () => {
  const draft = buildingDraft([
    { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 20 },
    { x: 0, y: 0, z: 20 }, { x: 0, y: 0, z: 0 },
  ], 6);
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  const zones = buildLineBrushRoofZones(draft, layout, "gable", false);
  assert.equal(zones.length, 4);
  assert.ok(zones.every((zone) => zone.interiorEdges.length === 2));
  assert.deepEqual(zones[0]!.polygon[0]![0], zones[3]!.polygon[0]![1]);
  assert.deepEqual(zones[0]!.polygon[0]![3], zones[3]!.polygon[0]![2]);
  assert.ok(Math.abs(zones.reduce((sum, zone) => sum + parcelGridPolygonArea(zone.polygon[0]!), 0)
    - draft.estimatedAreaM2) < 1e-6);
});
