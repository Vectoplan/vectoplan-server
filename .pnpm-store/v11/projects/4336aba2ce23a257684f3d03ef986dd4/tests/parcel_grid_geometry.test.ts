import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  buildParcelGridPartition,
  intersectConvexParcelGridPolygons,
  mergeParcelGridCoverage,
  parcelGridPolygonArea,
  parcelGridPolygonSignedArea,
  type ParcelGridBoundarySegmentInput,
  type ParcelGridPoint,
  type ParcelGridPartitionCell,
} from "../src/frontend/world_edit/parcel_grid_geometry";

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

test("reported Berlin project keeps red transition cells outside the buildable three-metre band", () => {
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

  assert.ok(result.blockedCells.length > 0, "the intentional red transition area must remain visible and blocked");
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
    `a red blocked cell leaked into the buildable three-metre strip (${minimumBlockedDistance.toFixed(3)} m)`,
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
