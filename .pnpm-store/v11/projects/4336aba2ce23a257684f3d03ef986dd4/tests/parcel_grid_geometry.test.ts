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
