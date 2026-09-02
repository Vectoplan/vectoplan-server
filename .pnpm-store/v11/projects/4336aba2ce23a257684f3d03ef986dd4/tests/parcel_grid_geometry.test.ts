import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  buildParcelGridPartition,
  intersectConvexParcelGridPolygons,
  mergeParcelGridCoverage,
  parcelGridGuideIdentity,
  parcelGridPolygonArea,
  parcelGridPolygonSignedArea,
  resolveParcelGridGuidePreview,
  resolveParcelGridHandleScale,
  resolveParcelGridMaximumDepth,
  resolveParcelGridRenderBounds,
  snapParcelGridDragDepth,
  type ParcelGridBoundarySegmentInput,
  type ParcelGridPoint,
  type ParcelGridPartitionCell,
} from "../src/frontend/world_edit/systems/parcel_grid/geometry";
import {
  deriveLod2BuildingGridReference,
  lod2BuildingFacadeBands,
  lod2BuildingGridReferencesFromChunks,
} from "../src/frontend/world_edit/systems/parcel_grid/building_reference";
import { auditParcelGrid } from "../src/frontend/world_edit/systems/parcel_grid/audit";
import {
  resolveWorldEditSelectionBounds,
  snapWorldEditSelectionHandle,
  worldEditSelectionTopGridSegments,
} from "../src/frontend/world_edit/systems/selection/geometry";
import {
  rulerSourceCellFromSurfaceHit,
  snapWorldEditRulerPoint,
} from "../src/frontend/world_edit/systems/ruler/geometry";
import {
  clipboardBoundsAt,
  clipboardSelectionSize,
} from "../src/frontend/world_edit/systems/clipboard/geometry";
import {
  sampleTentacleCurve,
  voxelizeTentacleCurve,
} from "../src/frontend/world_edit/systems/tentacle/geometry";
import {
  createPathBrushDraft,
  movePathBrushDraft,
  pathBrushDraftFromUnknown,
  resolvePathBrushHeightConflicts,
  samplePathBrushCenterline,
  updatePathBrushPoint,
} from "../src/frontend/world_edit/systems/shared/path_brush_geometry";

type TestRingPoint = readonly [number, number];

function testRingArea(ring: readonly TestRingPoint[]): number {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index]!;
    const next = ring[index + 1]!;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area * 0.5);
}

function assertSimpleClosedRing(ring: readonly TestRingPoint[]): void {
  assert.ok(ring.length >= 4);
  assert.deepEqual(ring[0], ring.at(-1));
  const orientation = (first: TestRingPoint, second: TestRingPoint, third: TestRingPoint): number => (
    (second[0] - first[0]) * (third[1] - first[1])
    - (second[1] - first[1]) * (third[0] - first[0])
  );
  const properIntersection = (
    firstStart: TestRingPoint,
    firstEnd: TestRingPoint,
    secondStart: TestRingPoint,
    secondEnd: TestRingPoint,
  ): boolean => {
    const firstSide = orientation(firstStart, firstEnd, secondStart);
    const secondSide = orientation(firstStart, firstEnd, secondEnd);
    const thirdSide = orientation(secondStart, secondEnd, firstStart);
    const fourthSide = orientation(secondStart, secondEnd, firstEnd);
    return firstSide * secondSide < -1e-10 && thirdSide * fourthSide < -1e-10;
  };
  const edgeCount = ring.length - 1;
  for (let firstIndex = 0; firstIndex < edgeCount; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edgeCount; secondIndex += 1) {
      if (secondIndex === firstIndex + 1 || (firstIndex === 0 && secondIndex === edgeCount - 1)) continue;
      assert.equal(properIntersection(
        ring[firstIndex]!,
        ring[firstIndex + 1]!,
        ring[secondIndex]!,
        ring[secondIndex + 1]!,
      ), false, `footprint edges ${firstIndex} and ${secondIndex} must not cross`);
    }
  }
}

test("clipboard preserves its dimensions while moving in all three axes", () => {
  const size = clipboardSelectionSize({ x: 8, y: 3, z: -2 }, { x: 10, y: 6, z: 2 });
  assert.deepEqual(size, { x: 3, y: 4, z: 5 });
  assert.deepEqual(clipboardBoundsAt({ x: -7, y: 14, z: 21 }, size), {
    first: { x: -7, y: 14, z: 21 },
    second: { x: -5, y: 17, z: 25 },
  });
});

test("tentacle is straight with two points and curved/deduplicated from three", () => {
  const straight = sampleTentacleCurve([{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }]);
  assert.ok(straight.every((point) => Math.abs(point.z) < 1e-9));

  const curved = sampleTentacleCurve([
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 6, y: 1, z: 4 },
  ]);
  assert.ok(curved.some((point) => point.z > 0 && point.z < 4));
  const voxels = voxelizeTentacleCurve(curved);
  assert.equal(voxels.length, new Set(voxels.map((point) => `${point.x}:${point.y}:${point.z}`)).size);
});

test("planning line brush creates one clean editable L-shaped corridor", () => {
  const draft = createPathBrushDraft([
    { x: 0, y: 5, z: 0 },
    { x: 10, y: 5, z: 0 },
    { x: 10, y: 5, z: 10 },
  ], { kind: "building", width: 4, interpolation: "linear" });

  assert.ok(draft);
  assert.equal(draft.schemaVersion, "vectoplan-path-brush-draft.v1");
  assert.equal(draft.segments.length, 2);
  assert.equal(draft.polygons.length, 1, "overlapping rectangles and the corner join are unioned");
  assert.equal(draft.polygons[0]!.holes.length, 0);
  assert.equal(draft.footprint.type, "MultiPolygon");
  assert.equal(draft.footprint.coordinates.length, draft.polygons.length);
  assert.deepEqual(draft.bounds, {
    minimum: { x: 0, y: 5, z: -2 },
    maximum: { x: 12, y: 5, z: 10 },
  });
  assertSimpleClosedRing(draft.polygons[0]!.coordinates);
  assert.equal(testRingArea(draft.polygons[0]!.coordinates), 80);
  assert.equal(draft.estimatedAreaM2, 80);

  const moved = movePathBrushDraft(draft, { x: 7, z: -3 });
  assert.deepEqual(moved.points[0], { x: 7, y: 5, z: -3 });
  assert.equal(moved.bounds.minimum.x, draft.bounds.minimum.x + 7);
  assert.equal(moved.bounds.minimum.z, draft.bounds.minimum.z - 3);

  const adjusted = updatePathBrushPoint(draft, 1, { x: 12, y: 5, z: 1 });
  assert.deepEqual(adjusted.points[1], { x: 12, y: 5, z: 1 });
  assert.deepEqual(adjusted.points[0], draft.points[0]);
  assert.deepEqual(adjusted.points[2], draft.points[2]);
  assert.deepEqual(pathBrushDraftFromUnknown(JSON.parse(JSON.stringify(adjusted)))?.points, adjusted.points);
});

test("planning line brush keeps a straight segment a single exact rectangle", () => {
  const draft = createPathBrushDraft([
    { x: 0, y: 2, z: 0 },
    { x: 12, y: 2, z: 0 },
  ], { kind: "building", width: 6, interpolation: "linear" });

  assert.ok(draft);
  assert.equal(draft.polygons.length, 1);
  assert.equal(draft.polygons[0]!.holes.length, 0);
  assert.deepEqual(draft.bounds, {
    minimum: { x: 0, y: 2, z: -3 },
    maximum: { x: 12, y: 2, z: 3 },
  });
  assertSimpleClosedRing(draft.polygons[0]!.coordinates);
  assert.equal(testRingArea(draft.polygons[0]!.coordinates), 72);
  assert.equal(draft.estimatedAreaM2, 72);
});

test("planning line brush unions a Z bend without transparent overlap triangles", () => {
  const draft = createPathBrushDraft([
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 0, z: 10 },
    { x: 20, y: 0, z: 10 },
  ], { kind: "building", width: 4, interpolation: "linear" });

  assert.ok(draft);
  assert.equal(draft.polygons.length, 1);
  assert.equal(draft.polygons[0]!.holes.length, 0);
  assertSimpleClosedRing(draft.polygons[0]!.coordinates);
  assert.equal(testRingArea(draft.polygons[0]!.coordinates), 120);
  assert.equal(draft.estimatedAreaM2, 120);
});

test("planning line brush collapses retraced and self-overlapping segments into one outline", () => {
  const retraced = createPathBrushDraft([
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
  ], { kind: "building", width: 4, interpolation: "linear" });
  assert.ok(retraced);
  assert.equal(retraced.polygons.length, 1);
  assertSimpleClosedRing(retraced.polygons[0]!.coordinates);
  assert.equal(testRingArea(retraced.polygons[0]!.coordinates), 40);

  const crossing = createPathBrushDraft([
    { x: -10, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 0, y: 0, z: -10 },
    { x: 0, y: 0, z: 10 },
  ], { kind: "building", width: 4, interpolation: "linear" });
  assert.ok(crossing);
  assert.equal(crossing.polygons.length, 1);
  assertSimpleClosedRing(crossing.polygons[0]!.coordinates);
  assert.equal(crossing.polygons[0]!.holes.length, 1, "a real enclosed pocket is one Shape hole, not a second overlapping fill mesh");
  assertSimpleClosedRing(crossing.polygons[0]!.holes[0]!);
  assert.ok(crossing.estimatedAreaM2 > 0);
  assert.ok(crossing.estimatedAreaM2 < crossing.segments.reduce((sum, segment) => sum + segment.length * 4, 0));
});

test("planning road conflicts distinguish fill/bridge choice and automatic tunnels", () => {
  const road = createPathBrushDraft([
    { x: 0, y: 10, z: 0 },
    { x: 10, y: 10, z: 0 },
  ], { kind: "road", width: 5, interpolation: "catmull-rom" });
  assert.ok(road);

  const unresolved = resolvePathBrushHeightConflicts(road, () => 0, { threshold: 3 });
  assert.deepEqual(unresolved.map(({ kind, resolution }) => ({ kind, resolution })), [{
    kind: "elevation_gap",
    resolution: "choice_required",
  }]);
  const bridge = resolvePathBrushHeightConflicts(road, () => 0, {
    threshold: 3,
    elevatedResolution: "bridge",
  });
  assert.equal(bridge[0]?.resolution, "bridge");
  assert.deepEqual(bridge[0]?.placeholder, road.segments[0]?.rectangle);

  const tunnel = resolvePathBrushHeightConflicts(road, () => 18, { threshold: 3 });
  assert.deepEqual(tunnel.map(({ kind, resolution }) => ({ kind, resolution })), [{
    kind: "mountain_penetration",
    resolution: "tunnel",
  }]);
});

test("tentacle delegates curve sampling to the shared path brush core", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 1, z: 0 },
    { x: 8, y: 1, z: 5 },
  ] as const;
  assert.deepEqual(sampleTentacleCurve(points), samplePathBrushCenterline(points, "catmull-rom"));
});

test("a normal 16k-cell parcel is no longer cut to the loaded terrain window", () => {
  const bounds = resolveParcelGridRenderBounds({
    points: [[-70, -45], [90, -45], [90, 55], [-70, 55]],
    visibleSurfacePoints: [[20, -20], [75, 35]],
    fullRenderCellLimit: 100_000,
    visibleMarginCells: 64,
  });

  assert.deepEqual(bounds, {
    minimumX: -70,
    maximumX: 90,
    minimumZ: -45,
    maximumZ: 55,
    requestedCells: 16_000,
    renderedCells: 16_000,
    streamed: false,
  });
});

test("only exceptionally huge parcels use a padded streaming window", () => {
  const bounds = resolveParcelGridRenderBounds({
    points: [[-500, -500], [500, -500], [500, 500], [-500, 500]],
    visibleSurfacePoints: [[10, 20], [42, 68]],
    fullRenderCellLimit: 100_000,
    visibleMarginCells: 64,
  });

  assert.equal(bounds?.streamed, true);
  assert.deepEqual(bounds && {
    minimumX: bounds.minimumX,
    maximumX: bounds.maximumX,
    minimumZ: bounds.minimumZ,
    maximumZ: bounds.maximumZ,
  }, { minimumX: -54, maximumX: 106, minimumZ: -44, maximumZ: 132 });
});

test("grid guide dragging snaps and clamps to whole block steps", () => {
  assert.equal(snapParcelGridDragDepth({
    initialDepth: 3,
    initialPointerDepth: 2.2,
    pointerDepth: 3.69,
    minimumDepth: 1,
    maximumDepth: 6,
  }), 4);
  assert.equal(snapParcelGridDragDepth({
    initialDepth: 3,
    initialPointerDepth: 2,
    pointerDepth: -20,
    minimumDepth: 1,
    maximumDepth: 6,
  }), 1);
  assert.equal(snapParcelGridDragDepth({
    initialDepth: 3,
    initialPointerDepth: 2,
    pointerDepth: 20,
    minimumDepth: 1,
    maximumDepth: 6,
  }), 6);
  assert.equal(snapParcelGridDragDepth({
    initialDepth: 3,
    initialPointerDepth: 2,
    pointerDepth: 44.4,
    minimumDepth: 1,
    maximumDepth: 128,
  }), 45, "dragging is no longer capped at six blocks");
  assert.equal(snapParcelGridDragDepth({
    initialDepth: 1,
    initialPointerDepth: 2,
    pointerDepth: 0.4,
    minimumDepth: 0,
    maximumDepth: 128,
  }), 0, "the inner grid line can coincide exactly with the parcel boundary");
});

test("parcel grid depth grows with the parcel while retaining a generous minimum", () => {
  assert.equal(resolveParcelGridMaximumDepth({
    points: [[0, 0], [12, 0], [12, 18], [0, 18]],
    start: [0, 0],
    inward: [0, 1],
  }), 64);
  assert.equal(resolveParcelGridMaximumDepth({
    points: [[0, 0], [180, 0], [180, 120], [0, 120]],
    start: [0, 0],
    inward: [0, 1],
  }), 128);
});

test("each snapped drag step moves the full guide and its handle by exactly one block", () => {
  const atThree = resolveParcelGridGuidePreview({
    start: [2, 4],
    end: [10, 4],
    inward: [0, 1],
    depth: 3,
    handleAlong: 0.25,
  });
  const atFour = resolveParcelGridGuidePreview({
    start: [2, 4],
    end: [10, 4],
    inward: [0, 1],
    depth: 4,
    handleAlong: 0.25,
  });

  assert.deepEqual(atThree, {
    lineStart: [2, 7],
    lineEnd: [10, 7],
    handle: [4, 7],
  });
  assert.deepEqual(atFour, {
    lineStart: [2, 8],
    lineEnd: [10, 8],
    handle: [4, 8],
  });
});

test("every parcel edge keeps a stable, direction-independent guide identity", () => {
  const first = parcelGridGuideIdentity("parcel-a", [13.4, 52.5], [13.5, 52.6]);
  const reversed = parcelGridGuideIdentity("parcel-a", [13.5, 52.6], [13.4, 52.5]);
  const neighbouringEdge = parcelGridGuideIdentity("parcel-a", [13.5, 52.6], [13.6, 52.7]);

  assert.equal(first, reversed);
  assert.notEqual(first, neighbouringEdge);
});

test("parcel grid handles retain a useful screen size over long distances", () => {
  const nearScale = resolveParcelGridHandleScale({
    distance: 10,
    verticalFieldOfViewDegrees: 50,
    viewportHeightPixels: 1080,
  });
  const farScale = resolveParcelGridHandleScale({
    distance: 180,
    verticalFieldOfViewDegrees: 50,
    viewportHeightPixels: 1080,
  });

  assert.equal(nearScale, 0.65, "near handles should not shrink below the readable minimum");
  assert.ok(farScale > nearScale * 5, "far handles should grow in world space to remain clickable");
  assert.ok(farScale <= 14);
});

test("LoD2 bestandsraster uses the rotated building envelope while an empty parcel keeps the world grid", () => {
  const angle = 31 * Math.PI / 180;
  const u: ParcelGridPoint = [Math.cos(angle), Math.sin(angle)];
  const v: ParcelGridPoint = [-u[1], u[0]];
  const at = (x: number, z: number): ParcelGridPoint => [20 + u[0] * x + v[0] * z, -4 + u[1] * x + v[1] * z];
  const ring = [at(0, 0), at(12.4, 0), at(12.4, 7.6), at(0, 7.6)];
  const reference = deriveLod2BuildingGridReference("building-1", [ring])!;
  assert.equal(reference.columns, 12); assert.equal(reference.rows, 8);
  assert.equal(reference.facades.length, 4);
  assert(Math.abs(reference.stepU * reference.columns - 12.4) < 1e-8);
  assert(Math.abs(reference.stepV * reference.rows - 7.6) < 1e-8);
  assert(Math.abs(reference.rotationDegrees - 31) < 1e-8);
  const bounds = {
    minimumX: Math.floor(Math.min(...ring.map((point) => point[0]))),
    maximumX: Math.ceil(Math.max(...ring.map((point) => point[0]))),
    minimumZ: Math.floor(Math.min(...ring.map((point) => point[1]))),
    maximumZ: Math.ceil(Math.max(...ring.map((point) => point[1]))),
  };
  const building = buildParcelGridPartition({boundarySegments:[],coverageTriangles:triangulateRing(ring),bounds,
    regularGrid:{id:reference.buildingId,origin:reference.origin,axisU:reference.axisU,axisV:reference.axisV,stepU:reference.stepU,stepV:reference.stepV}});
  assert.equal(building.straightCells.length,reference.columns*reference.rows);
  assert(building.straightCells.every((cell) => cell.gridAlignment === "lod2-building" && cell.logicalCellId?.startsWith("lod2-building:")));
  assert(Math.abs(building.coveredArea - 12.4 * 7.6) < 1e-5);

  const emptyDefault = buildParcelGridPartition({boundarySegments:[],coverageTriangles:triangulateRing(ring),bounds});
  const emptyExplicit = buildParcelGridPartition({boundarySegments:[],coverageTriangles:triangulateRing(ring),bounds,regularGrid:null});
  assert.deepEqual(emptyExplicit,emptyDefault,"the established empty-parcel raster must not change");
  assert(emptyDefault.straightCells.every((cell) => cell.gridAlignment === "world"));

  const extracted=lod2BuildingGridReferencesFromChunks([{raw:{objectRefs:[{objectTypeId:'building_roof',objectInstanceId:'roof-1',
    metadata:{lod2BuildingId:'building-1'},footprint:{type:'Polygon',coordinateSpace:'world-cell-xz',coordinates:[[...ring,ring[0]]]}}]}}]);
  assert.equal(extracted.length,1);assert.equal(extracted[0]!.buildingId,'building-1');
  assert.equal(extracted[0]!.facades.length,4);

  const facade=reference.facades.find((candidate)=>Math.abs(candidate.length-12.4)<1e-8)!;
  const outside:ParcelGridPoint=[-facade.inward[0],-facade.inward[1]];
  const parcelRing=[at(-3,-3),at(15.4,-3),at(15.4,10.6),at(-3,10.6)];
  const parcelBounds={
    minimumX:Math.floor(Math.min(...parcelRing.map(point=>point[0]))),
    maximumX:Math.ceil(Math.max(...parcelRing.map(point=>point[0]))),
    minimumZ:Math.floor(Math.min(...parcelRing.map(point=>point[1]))),
    maximumZ:Math.ceil(Math.max(...parcelRing.map(point=>point[1]))),
  };
  const attached=buildParcelGridPartition({
    boundarySegments:[{id:`building:${facade.id}`,parcelId:'building-1',start:facade.start,end:facade.end,
      inward:outside,length:facade.length,depth:1,divisions:facade.columns,clampToDepth:true}],
    coverageTriangles:triangulateRing(parcelRing),bounds:parcelBounds,
    regularGrid:{id:reference.buildingId,origin:reference.origin,axisU:reference.axisU,axisV:reference.axisV,
      stepU:reference.stepU,stepV:reference.stepV},
  });
  const firstBand=attached.slantedCells.filter(cell=>cell.boundaryRow===0);
  assert.equal(new Set(firstBand.map(cell=>cell.logicalCellId)).size,facade.columns,
    'the first annex band has exactly the same columns as the existing facade');
  for(const cell of firstBand)for(const point of cell.polygon){
    const depth=(point[0]-facade.start[0])*outside[0]+(point[1]-facade.start[1])*outside[1];
    assert(depth>=-1e-6&&depth<=1+1e-6,
      `the attachable block starts at the wall and grows only outward (depth ${depth})`);
  }
});

test("the two-zone grid keeps parcel boundary bands, follows facade anchors and excludes the existing building", () => {
  const parcel: readonly ParcelGridPoint[] = [[0, 0], [20, 0], [20, 20], [0, 20]];
  const building: readonly ParcelGridPoint[] = [[7.4, 8.2], [12.6, 8.2], [12.6, 12.8], [7.4, 12.8]];
  const reference = deriveLod2BuildingGridReference("existing", [building])!;
  const boundaries: readonly ParcelGridBoundarySegmentInput[] = [
    { id: "south", parcelId: "parcel", start: [0, 0], end: [20, 0], inward: [0, 1], length: 20, depth: 2 },
    { id: "east", parcelId: "parcel", start: [20, 0], end: [20, 20], inward: [-1, 0], length: 20, depth: 2 },
    { id: "north", parcelId: "parcel", start: [20, 20], end: [0, 20], inward: [0, -1], length: 20, depth: 2 },
    { id: "west", parcelId: "parcel", start: [0, 20], end: [0, 0], inward: [1, 0], length: 20, depth: 2 },
  ];
  const result = buildParcelGridPartition({
    boundarySegments: boundaries,
    coverageTriangles: triangulateRing(parcel),
    excludedTriangles: triangulateRing(building),
    bounds: { minimumX: 0, maximumX: 20, minimumZ: 0, maximumZ: 20 },
    regularGrid: {
      id: reference.buildingId,
      origin: reference.origin,
      axisU: reference.axisU,
      axisV: reference.axisV,
      stepU: reference.stepU,
      stepV: reference.stepV,
      uAnchors: reference.uAnchors,
      vAnchors: reference.vAnchors,
    },
  });

  assert(result.slantedCells.length > 0, "the green parcel-boundary transition remains present");
  assert(result.straightCells.length > 0, "the red building-oriented interior remains present");
  assert(Math.abs(result.coveredArea - (400 - 5.2 * 4.6)) < 1e-4,
    "the complete building footprint is removed from the available raster");
  assert(result.cells.every((cell) => {
    const centre = cell.polygon.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]] as [number, number], [0, 0]);
    centre[0] /= cell.polygon.length; centre[1] /= cell.polygon.length;
    return !(centre[0] > 7.4 + 1e-6 && centre[0] < 12.6 - 1e-6
      && centre[1] > 8.2 + 1e-6 && centre[1] < 12.8 - 1e-6);
  }), "no visible or placeable cell may run through the existing building");
  assert(reference.uAnchors.some((value) => Math.abs(value - 7.4) < 1e-6));
  assert(reference.uAnchors.some((value) => Math.abs(value - 12.6) < 1e-6));
  assert(reference.vAnchors.some((value) => Math.abs(value - 8.2) < 1e-6));
  assert(reference.vAnchors.some((value) => Math.abs(value - 12.8) < 1e-6));
});

test("the editor prefers Chunk's validated LoD2 construction-grid contract and falls back for legacy roofs", () => {
  const footprint = [[[0, 0], [10, 0], [10, 6], [0, 6], [0, 0]]];
  const fingerprint = "a".repeat(64);
  const constructionGrid = {
    schemaVersion: "vectoplan-lod2-construction-grid.v1",
    algorithmVersion: "lod2-facade-grid.v4",
    referenceMode: "lod2-existing-building",
    buildingId: "contract-building",
    coordinateSpace: "world-cell-xz",
    origin: [0, 0],
    axisU: [1, 0],
    axisV: [0, 1],
    rotationDegrees: 0,
    widthM: 10,
    depthM: 6,
    columns: 10,
    rows: 6,
    stepU: 1,
    stepV: 1,
    uAnchors: [0, 10],
    vAnchors: [0, 6],
    facades: [
      { id: "south-from-contract", start: [0, 0], end: [10, 0], inward: [0, 1], lengthM: 10, columnCount: 10, columnWidthM: 1 },
      { id: "east-from-contract", start: [10, 0], end: [10, 6], inward: [-1, 0], lengthM: 6, columnCount: 6, columnWidthM: 1 },
      { id: "north-from-contract", start: [0, 6], end: [10, 6], inward: [0, -1], lengthM: 10, columnCount: 10, columnWidthM: 1 },
      { id: "west-from-contract", start: [0, 0], end: [0, 6], inward: [1, 0], lengthM: 6, columnCount: 6, columnWidthM: 1 },
    ],
    fingerprint,
  };
  const roofRef = (buildingId: string, grid?: unknown) => ({
    objectTypeId: "building_roof",
    objectInstanceId: `roof-${buildingId}`,
    metadata: {
      lod2BuildingId: buildingId,
      roofParameters: { importedSource: {
        groundFootprints: [footprint],
        ...(grid ? { constructionGrid: grid } : {}),
      } },
    },
    footprint: { type: "Polygon", coordinateSpace: "world-cell-xz", coordinates: footprint },
  });
  const persisted = lod2BuildingGridReferencesFromChunks([{ raw: { objectRefs: [roofRef("contract-building", constructionGrid)] } }])[0]!;
  assert.equal(persisted.referenceSource, "persisted-construction-grid");
  assert.equal(persisted.constructionGridFingerprint, fingerprint);
  assert.equal(persisted.signature, `contract-building:construction-grid:${fingerprint}`);
  assert(persisted.facades.some((facade) => facade.id === "south-from-contract"));

  const legacy = lod2BuildingGridReferencesFromChunks([{ raw: { objectRefs: [roofRef("legacy-building")] } }])[0]!;
  assert.equal(legacy.referenceSource, "derived-geometry");
  assert.equal(legacy.constructionGridFingerprint, undefined);
});

test("the audit rejects a forced right-angle average and accepts both measured facade axes", () => {
  const axisUAngle = 3.51 * Math.PI / 180;
  const axisVAngle = 99.32 * Math.PI / 180;
  const axisU: ParcelGridPoint = [Math.cos(axisUAngle), Math.sin(axisUAngle)];
  const axisV: ParcelGridPoint = [Math.cos(axisVAngle), Math.sin(axisVAngle)];
  const at = (u: number, v: number): ParcelGridPoint => [
    10 + axisU[0] * u + axisV[0] * v,
    10 + axisU[1] * u + axisV[1] * v,
  ];
  const building: readonly ParcelGridPoint[] = [at(0, 0), at(14, 0), at(14, 8), at(0, 8)];
  const reference = deriveLod2BuildingGridReference("skew-existing-building", [building])!;
  const basisAngle = Math.acos(
    reference.axisU[0] * reference.axisV[0] + reference.axisU[1] * reference.axisV[1],
  ) * 180 / Math.PI;
  assert(Math.abs(basisAngle - 95.81) < 0.05, `real facade angle must survive, received ${basisAngle}`);

  const parcel: readonly ParcelGridPoint[] = [[0, 0], [40, 0], [40, 40], [0, 40]];
  const exclusions = triangulateRing(building);
  const partition = buildParcelGridPartition({
    boundarySegments: lod2BuildingFacadeBands(reference),
    coverageTriangles: triangulateRing(parcel),
    excludedTriangles: exclusions,
    bounds: { minimumX: 0, maximumX: 40, minimumZ: 0, maximumZ: 40 },
    regularGrid: {
      id: reference.buildingId,
      origin: reference.origin,
      axisU: reference.axisU,
      axisV: reference.axisV,
      stepU: reference.stepU,
      stepV: reference.stepV,
      uAnchors: reference.uAnchors,
      vAnchors: reference.vAnchors,
    },
  });
  const audit = auditParcelGrid({ reference, partition, coverageTriangles: triangulateRing(parcel), excludedTriangles: exclusions });
  assert.equal(audit.status, "pass");
  assert(audit.weightedFacadeAxisErrorDegrees < 0.01);
  assert(audit.p95FacadeAnchorOffsetM < 0.001);
  assert(audit.maximumFacadeAnchorOffsetM < 0.001);
  assert(audit.buildingOverlapAreaM2 < 1e-5);
  assert(audit.minimumFacadeCoverageRatio > .999999);
  assert(audit.maximumFacadeLineGapM < 1e-5);
  assert.equal(audit.partialFacadeCellCount, 0);

  const forcedRightAngle = {
    ...reference,
    axisV: [-reference.axisU[1], reference.axisU[0]] as ParcelGridPoint,
  };
  const failingAudit = auditParcelGrid({ reference: forcedRightAngle });
  assert.equal(failingAudit.status, "error");
  assert(failingAudit.issues.some((issue) => issue.code === "facade-axis-drift"));
});

test("roof-level LoD2 wall fragments cannot rotate the ground-based building raster", () => {
  const extracted = lod2BuildingGridReferencesFromChunks([{ raw: { objectRefs: [{
    objectTypeId: "building_roof",
    objectInstanceId: "roof-ground-filter",
    metadata: {
      lod2BuildingId: "building-ground-filter",
      roofParameters: { importedSource: { facadeSegments: [
        { start: [0, 0], end: [10, 0], minimumY: 1, maximumY: 7 },
        { start: [10, 0], end: [10, 6], minimumY: 1, maximumY: 7 },
        { start: [10, 6], end: [0, 6], minimumY: 1, maximumY: 7 },
        { start: [0, 6], end: [0, 0], minimumY: 1, maximumY: 7 },
        { start: [-4, -3], end: [18, 13], minimumY: 6, maximumY: 9 },
      ] } },
    },
    footprint: {
      type: "Polygon",
      coordinateSpace: "world-cell-xz",
      coordinates: [[[0, 0], [10, 0], [10, 6], [0, 6], [0, 0]]],
    },
  }] } }]);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0]!.facades.length, 4);
  assert(Math.abs(extracted[0]!.rotationDegrees) < 1e-8);
});

test("selection handles snap every axis to whole blocks from their drag origin", () => {
  const initialBounds = resolveWorldEditSelectionBounds(
    { x: 2, y: 4, z: 8 },
    { x: 7, y: 9, z: 12 },
  );
  assert.deepEqual(initialBounds.size, { x: 6, y: 6, z: 5 });
  assert.deepEqual(initialBounds.center, { x: 5, y: 7, z: 10.5 });
  const expanded = snapWorldEditSelectionHandle({
    initialBounds,
    axis: "x",
    sign: 1,
    initialPointerCoordinate: 10.2,
    pointerCoordinate: 15.7,
  });
  const lowered = snapWorldEditSelectionHandle({
    initialBounds,
    axis: "y",
    sign: -1,
    initialPointerCoordinate: 5,
    pointerCoordinate: 2.2,
  });

  assert.equal(expanded.maximum.x, 13);
  assert.deepEqual(expanded.minimum, initialBounds.minimum);
  assert.equal(lowered.minimum.y, 1);
  assert.deepEqual(lowered.maximum, initialBounds.maximum);
});

test("selection top grid outlines every selected block without leaving the box", () => {
  const bounds = resolveWorldEditSelectionBounds(
    { x: 2, y: 4, z: 8 },
    { x: 4, y: 5, z: 9 },
  );
  const positions = worldEditSelectionTopGridSegments(bounds);

  assert.equal(positions.length, ((bounds.size.x + 1) + (bounds.size.z + 1)) * 6);
  assert.deepEqual(positions.slice(0, 6), [2, 6.008, 8, 2, 6.008, 10]);
  assert.deepEqual(positions.slice(-6), [2, 6.008, 10, 5, 6.008, 10]);
});

test("ruler points snap near voxel corners and remain free at the face centre", () => {
  const snapped = snapWorldEditRulerPoint({
    targetPoint: { x: 10.06, y: 4, z: -1.08 },
    sourceCell: { x: 10, y: 3, z: -2 },
  });
  const free = snapWorldEditRulerPoint({
    targetPoint: { x: 10.5, y: 4, z: -1.5 },
    sourceCell: { x: 10, y: 3, z: -2 },
  });

  assert.equal(snapped.snappedToCorner, true);
  assert.deepEqual(snapped.point, { x: 10, y: 4, z: -1 });
  assert.equal(free.snappedToCorner, false);
  assert.deepEqual(free.point, { x: 10.5, y: 4, z: -1.5 });
});

test("ruler corner magnet catches wider near-corner hits without capturing the face centre", () => {
  const magnetic = snapWorldEditRulerPoint({
    targetPoint: { x: 10.40, y: 4, z: -1.60 },
    sourceCell: { x: 10, y: 3, z: -2 },
  });

  assert.equal(magnetic.snappedToCorner, true);
  assert.deepEqual(magnetic.point, { x: 10, y: 4, z: -2 });
});

test("ruler surface hits resolve the visible block instead of the block behind it", () => {
  assert.deepEqual(
    rulerSourceCellFromSurfaceHit(
      { x: 12, y: 8.4, z: -3.2 },
      { x: 0.8, y: -0.1, z: 0.2 },
    ),
    { x: 12, y: 8, z: -4 },
  );
});

test("logical fragments merge into one exact outline without their internal diagonal", () => {
  const fragments: readonly (readonly ParcelGridPoint[])[] = [
    [[0, 0], [2, 0], [2, 1], [0, 1]],
    [[0, 1], [2, 1], [1.5, 2], [0, 2]],
  ];
  const merged = mergeParcelGridCoverage(fragments);

  assert.equal(merged.length, 1);
  assert.ok(Math.abs(parcelGridPolygonArea(merged[0]!) - 3.75) <= 1e-8);
  assert.equal(
    merged[0]!.some((point) => Math.abs(point[1] - 1) <= 1e-8 && point[0] > 0 && point[0] < 2),
    false,
    "the shared fragment edge must not remain in the merged block outline",
  );
});

function boundarySegments(ring: readonly ParcelGridPoint[], depth = 3): ParcelGridBoundarySegmentInput[] {
  const orientation = parcelGridPolygonSignedArea(ring) >= 0 ? 1 : -1;
  return ring.map((start, index) => {
    const end = ring[(index + 1) % ring.length]!;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    return {
      id: `edge-${index}`,
      parcelId: "parcel-test",
      start,
      end,
      inward: [-dz / length * orientation, dx / length * orientation],
      length,
      depth,
    };
  });
}

function triangulateRing(ring: readonly ParcelGridPoint[]): readonly (readonly ParcelGridPoint[])[] {
  const points = ring.map((point) => new THREE.Vector2(point[0], point[1]));
  return THREE.ShapeUtils.triangulateShape(points, []).map((face) => [
    ring[face[0]]!,
    ring[face[1]]!,
    ring[face[2]]!,
  ]);
}

function ringPerimeter(ring: readonly ParcelGridPoint[]): number {
  return ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]!;
    return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
  }, 0);
}

function assertNoOverlaps(cells: readonly ParcelGridPartitionCell[]): void {
  for (let first = 0; first < cells.length; first += 1) {
    for (let second = first + 1; second < cells.length; second += 1) {
      const intersection = intersectConvexParcelGridPolygons(cells[first]!.polygon, cells[second]!.polygon);
      assert.ok(
        parcelGridPolygonArea(intersection) <= 1e-6,
        `cells ${first} and ${second} overlap by ${parcelGridPolygonArea(intersection)}`,
      );
    }
  }
}

test("axis-aligned parcel is partitioned completely without overlapping cells", () => {
  const ring: readonly ParcelGridPoint[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const result = buildParcelGridPartition({
    boundarySegments: boundarySegments(ring),
    coverageTriangles: [
      [[0, 0], [10, 0], [10, 10]],
      [[0, 0], [10, 10], [0, 10]],
    ],
    bounds: { minimumX: 0, maximumX: 10, minimumZ: 0, maximumZ: 10 },
  });

  assert.ok(Math.abs(result.coveredArea - 100) <= 1e-5);
  assert.ok(result.slantedCells.length > 0);
  assert.ok(result.straightCells.length > 0);
  assertNoOverlaps(result.cells);
});

test("rotated parcel clips every slanted cell to the real parcel", () => {
  const ring: readonly ParcelGridPoint[] = [[0, 5], [5, 0], [10, 5], [5, 10]];
  const result = buildParcelGridPartition({
    boundarySegments: boundarySegments(ring),
    coverageTriangles: [
      [[0, 5], [5, 0], [10, 5]],
      [[0, 5], [10, 5], [5, 10]],
    ],
    bounds: { minimumX: 0, maximumX: 10, minimumZ: 0, maximumZ: 10 },
  });

  assert.ok(Math.abs(result.coveredArea - 50) <= 1e-5);
  assert.equal(result.blockedCells.length, 0, "transition remnants must belong to neighbouring blocks");
  assertNoOverlaps(result.cells);
  for (const cell of result.slantedCells) {
    assert.ok(parcelGridPolygonArea(cell.polygon) <= 1.5 + 1e-6);
  }
  const fragmentsByLogicalCell = new Map<string, ParcelGridPartitionCell[]>();
  for (const cell of result.slantedCells) {
    if (!cell.logicalCellId) continue;
    const fragments = fragmentsByLogicalCell.get(cell.logicalCellId) ?? [];
    fragments.push(cell);
    fragmentsByLogicalCell.set(cell.logicalCellId, fragments);
  }
  assert.ok(
    [...fragmentsByLogicalCell.values()].some((fragments) => fragments.length > 1),
    "at least one boundary block should own an added transition fragment",
  );
});

test("concave parcel keeps its recess instead of bridging it with a convex hull", () => {
  const ring: readonly ParcelGridPoint[] = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]];
  const result = buildParcelGridPartition({
    boundarySegments: boundarySegments(ring, 2),
    coverageTriangles: [
      [[0, 0], [6, 0], [6, 2]],
      [[0, 0], [6, 2], [2, 2]],
      [[0, 0], [2, 2], [2, 6]],
      [[0, 0], [2, 6], [0, 6]],
    ],
    bounds: { minimumX: 0, maximumX: 6, minimumZ: 0, maximumZ: 6 },
  });

  assert.ok(Math.abs(result.coveredArea - 20) <= 1e-5);
  assertNoOverlaps(result.cells);
  for (const cell of result.cells) {
    const centre = cell.polygon.reduce(
      (sum, point) => [sum[0] + point[0] / cell.polygon.length, sum[1] + point[1] / cell.polygon.length] as [number, number],
      [0, 0] as [number, number],
    );
    assert.ok(!(centre[0] > 2 + 1e-6 && centre[1] > 2 + 1e-6), "a cell bridged the concave recess");
  }
});

test("straight remainder is assigned to touching slanted cells without overlap", () => {
  const ring: readonly ParcelGridPoint[] = [[0, 0], [4, 0], [4, 4], [0, 4]];
  const result = buildParcelGridPartition({
    boundarySegments: boundarySegments(ring, 1),
    coverageTriangles: [
      [[0, 0], [4, 0], [4, 4]],
      [[0, 0], [4, 4], [0, 4]],
    ],
    bounds: { minimumX: 0, maximumX: 4, minimumZ: 0, maximumZ: 4 },
  });

  assertNoOverlaps(result.cells);
  assert.ok(Math.abs(result.coveredArea - 16) <= 1e-5);
  assert.equal(result.blockedCells.length, 0);
});

test("large parcels only materialize the requested visible window", () => {
  const ring: readonly ParcelGridPoint[] = [[0, 0], [100_000, 0], [100_000, 20], [0, 20]];
  const result = buildParcelGridPartition({
    boundarySegments: boundarySegments(ring, 3),
    coverageTriangles: [
      [[0, 0], [100_000, 0], [100_000, 20]],
      [[0, 0], [100_000, 20], [0, 20]],
    ],
    bounds: { minimumX: 49_990, maximumX: 50_010, minimumZ: 0, maximumZ: 20 },
  });

  assert.ok(result.cells.length < 1_000, `visible window unexpectedly created ${result.cells.length} cells`);
  assertNoOverlaps(result.cells);
  for (const cell of result.cells) {
    assert.ok(cell.polygon.some((point) => point[0] >= 49_990 - 1e-6 && point[0] <= 50_010 + 1e-6));
  }
});

test("rotated and skewed parcels preserve complete coverage at every tested angle", () => {
  const rotate = (point: ParcelGridPoint, angleDegrees: number): ParcelGridPoint => {
    const angle = angleDegrees * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [
      20 + point[0] * cosine - point[1] * sine,
      20 + point[0] * sine + point[1] * cosine,
    ];
  };

  for (const angle of [1, 7, 13, 22, 31, 44, 58, 73, 89, 107, 137, 173]) {
    const ring = [
      rotate([-6, -4], angle),
      rotate([6, -3], angle),
      rotate([5, 4], angle),
      rotate([-5, 3], angle),
    ] as const;
    const expectedArea = parcelGridPolygonArea(ring);
    const result = buildParcelGridPartition({
      boundarySegments: boundarySegments(ring),
      coverageTriangles: [
        [ring[0], ring[1], ring[2]],
        [ring[0], ring[2], ring[3]],
      ],
      bounds: {
        minimumX: Math.floor(Math.min(...ring.map((point) => point[0]))),
        maximumX: Math.ceil(Math.max(...ring.map((point) => point[0]))),
        minimumZ: Math.floor(Math.min(...ring.map((point) => point[1]))),
        maximumZ: Math.ceil(Math.max(...ring.map((point) => point[1]))),
      },
    });

    assert.ok(
      Math.abs(result.coveredArea - expectedArea) <= 0.01,
      `angle ${angle} lost ${Math.abs(result.coveredArea - expectedArea)} m²`,
    );
    assertNoOverlaps(result.cells);
  }
});

test("reported Berlin project keeps blocked transition cells outside the buildable three-metre band", () => {
  const origin = { longitude: 13.395131, latitude: 52.517389 };
  const worldWidth = 40_000_000;
  const worldHeight = 20_000_000;
  const originGridX = origin.longitude / 360 * worldWidth;
  const originGridZ = origin.latitude / 180 * worldHeight;
  const storageX = Math.floor(originGridX / 16) * 16;
  const storageZ = Math.floor(originGridZ / 16) * 16;
  const lonLatRing = [
    [13.3945, 52.5192], [13.3945, 52.5191], [13.3946, 52.5191],
    [13.3948, 52.5181], [13.3949, 52.5178], [13.3949, 52.5177],
    [13.3947, 52.5177], [13.3945, 52.5176], [13.3943, 52.5176],
    [13.3938, 52.5176], [13.3937, 52.5176], [13.3932, 52.5176],
    [13.3931, 52.5176], [13.3931, 52.5175], [13.3928, 52.5175],
    [13.3927, 52.5175], [13.3926, 52.5177], [13.3927, 52.5177],
    [13.3924, 52.5191], [13.3931, 52.5191],
  ] as const;
  const ring = lonLatRing.map(([longitude, latitude]): ParcelGridPoint => [
    longitude / 360 * worldWidth - storageX,
    latitude / 180 * worldHeight - storageZ,
  ]);
  const result = buildParcelGridPartition({
    boundarySegments: boundarySegments(ring),
    coverageTriangles: triangulateRing(ring),
    bounds: {
      minimumX: Math.floor(Math.min(...ring.map((point) => point[0]))),
      maximumX: Math.ceil(Math.max(...ring.map((point) => point[0]))),
      minimumZ: Math.floor(Math.min(...ring.map((point) => point[1]))),
      maximumZ: Math.ceil(Math.max(...ring.map((point) => point[1]))),
    },
    minimumArea: 1e-6,
  });

  assert.ok(result.blockedCells.length > 0, "the intentional blue transition area must remain visible and blocked");
  assert.ok(Math.abs(result.coveredArea - parcelGridPolygonArea(ring)) <= 0.02);
  const pointToSegmentDistance = (
    point: ParcelGridPoint,
    start: ParcelGridPoint,
    end: ParcelGridPoint,
  ): number => {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const lengthSquared = dx * dx + dz * dz;
    const factor = lengthSquared <= 1e-10 ? 0 : Math.max(0, Math.min(1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared,
    ));
    return Math.hypot(
      point[0] - (start[0] + dx * factor),
      point[1] - (start[1] + dz * factor),
    );
  };
  const closestBoundaryDistance = (point: ParcelGridPoint): number => Math.min(...ring.map(
    (start, index) => pointToSegmentDistance(point, start, ring[(index + 1) % ring.length]!),
  ));
  const minimumBlockedDistance = Math.min(...result.blockedCells.map((cell) => {
    const centre: ParcelGridPoint = [
      cell.polygon.reduce((sum, point) => sum + point[0], 0) / cell.polygon.length,
      cell.polygon.reduce((sum, point) => sum + point[1], 0) / cell.polygon.length,
    ];
    return closestBoundaryDistance(centre);
  }));
  assert.ok(
    minimumBlockedDistance >= 2.85,
    `a blocked transition cell leaked into the buildable three-metre strip (${minimumBlockedDistance.toFixed(3)} m)`,
  );
  const logicalGroups = new Map<string, ParcelGridPartitionCell[]>();
  for (const cell of result.slantedCells) {
    if (!cell.logicalCellId) continue;
    const group = logicalGroups.get(cell.logicalCellId) ?? [];
    group.push(cell);
    logicalGroups.set(cell.logicalCellId, group);
  }
  const fragmentedGroups = [...logicalGroups.values()].filter((group) => group.length > 1);
  assert.ok(fragmentedGroups.length > 0, "fixture must exercise merged transition fragments");
  let groupsWithRemovedInternalCuts = 0;
  for (const group of fragmentedGroups) {
    const merged = mergeParcelGridCoverage(group.map((cell) => cell.polygon));
    const fragmentArea = group.reduce((sum, cell) => sum + parcelGridPolygonArea(cell.polygon), 0);
    const mergedArea = merged.reduce((sum, polygon) => sum + parcelGridPolygonArea(polygon), 0);
    assert.ok(Math.abs(fragmentArea - mergedArea) <= 1e-5, "merging must preserve all buildable area");
    if (merged.reduce((sum, polygon) => sum + ringPerimeter(polygon), 0)
      < group.reduce((sum, cell) => sum + ringPerimeter(cell.polygon), 0) - 1e-7) {
      groupsWithRemovedInternalCuts += 1;
    }
  }
  assert.ok(groupsWithRemovedInternalCuts > 0, "internal transition cuts must disappear from joined blocks");
});
