import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  attachLineBrushRoofWallCells,
  buildLineBrushRoofWallCells,
  type LineBrushRoofWallCell,
  type LineBrushRoofWallZone,
} from "../src/frontend/world_edit/systems/line_brush/roof_walls";
import type { LineBrushBuildingBlockCell, LineBrushBuildingStoreyGeometry } from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import {
  constructionCellForIntersection,
  constructionCellMaterialGroups,
  createConstructionCellMesh,
  survivingConstructionCells,
} from "../src/frontend/scene/construction_cell_rendering";

type Point = readonly [number, number];
const close = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) < 2e-5, `${label}: expected ${expected}, received ${actual}`);

function roofZone(options: {
  type?: "gable" | "pent";
  left?: number;
  right?: number;
  eavesY?: number;
  angle?: number;
  interiorEdges?: readonly number[];
  scope?: string;
} = {}) {
  const { type = "gable", left = 0, right = 12, eavesY = 3.25, angle = 0 } = options;
  const toWorld = ([x, z]: Point): Point => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
  const toLocal = ([x, z]: Point): Point => [x * Math.cos(angle) + z * Math.sin(angle), -x * Math.sin(angle) + z * Math.cos(angle)];
  const roofHeight = (z: number) => eavesY + 0.4 + 0.5 * (type === "gable" ? Math.min(z, 6 - z) : z);
  const facets: Point[][] = type === "gable"
    ? [[[left, 0], [right, 0], [right, 3], [left, 3]], [[left, 3], [right, 3], [right, 6], [left, 6]]]
    : [[[left, 0], [right, 0], [right, 6], [left, 6]]];
  const faces = facets.map(ring => ({ polygon_3d_mm: ring.map(([x, z]) => {
    const world = toWorld([x, z]);
    return [world[0] * 1000, world[1] * 1000, roofHeight(z) * 1000];
  }) }));
  const zone: LineBrushRoofWallZone = {
    scope: options.scope ?? "all", eavesY,
    polygon: [[[left, 0], [right, 0], [right, 6], [left, 6]].map(toWorld)],
    interiorEdges: options.interiorEdges ?? [],
    calculation: {
      geometry: { faces },
      // This deliberately different tile skin must not become the wall top.
      roof_build_up: { top_faces: faces.map(face => ({ polygon_3d_mm: face.polygon_3d_mm.map(([x, z, y]) => [x + 150, z + 100, y + 1000]) })) },
    },
  };
  return { zone, toWorld, toLocal, roofHeight };
}

function verticalHit(mesh: THREE.Mesh, point: Point, upward = false) {
  return new THREE.Raycaster(new THREE.Vector3(point[0], upward ? -10 : 30, point[1]),
    new THREE.Vector3(0, upward ? 1 : -1, 0)).intersectObject(mesh)[0];
}

for (const type of ["gable", "pent"] as const) for (const angle of [0, 0.37]) {
  test(`${type} wall infill meets the structural roof at every cut, rotation ${angle}`, () => {
    const { zone, toWorld, toLocal, roofHeight } = roofZone({ type, angle });
    const cells = buildLineBrushRoofWallCells([zone]);
    assert.ok(cells.length > 0);
    assert.equal(new Set(cells.map(cell => `${cell.logicalCellId}:${cell.y}`)).size, cells.length,
      "separate facets sharing an edit address keep separate shape identities");
    for (const cell of cells) for (const [polygonIndex, polygon] of cell.footprintPolygons!.entries()) {
      for (const [i, point] of polygon.entries()) {
        const bottom = cell.minimumHeights![polygonIndex]![i]!;
        const top = cell.maximumHeights![polygonIndex]![i]!;
        assert.ok(bottom >= zone.eavesY - 1e-7 && bottom >= cell.y - 1e-7);
        assert.ok(top <= cell.y + 1 + 1e-7 && top >= bottom - 1e-7);
        assert.ok(top <= roofHeight(toLocal(point)[1]) + 1e-6, "infill cannot protrude through the structural roof");
      }
    }
    const material = new THREE.MeshBasicMaterial();
    const mesh = createConstructionCellMesh(cells, material)!;
    try {
      for (const z of [0.35, 1.4, 2.7, 3, 3.3, 4.6, 5.65]) {
        const point = toWorld([0.2, z]);
        const top = verticalHit(mesh, point), bottom = verticalHit(mesh, point, true);
        assert.ok(top && bottom, `gable-end infill covers z=${z}`);
        close(top.point.y, roofHeight(z), "roof underside contact");
        close(bottom.point.y, zone.eavesY, "wall-to-infill contact");
        const cell = constructionCellForIntersection(top);
        assert.ok(cell && cells.includes(cell as LineBrushRoofWallCell));
      }
    } finally { mesh.geometry.dispose(); material.dispose(); }
  });
}

test("equal-height adjoining wings leave their internal roof seam open", () => {
  const left = roofZone({ left: 0, right: 12, interiorEdges: [1], scope: "segment:0" });
  const right = roofZone({ left: 12, right: 24, interiorEdges: [3], scope: "segment:1" });
  const cells = buildLineBrushRoofWallCells([left.zone, right.zone]);
  const material = new THREE.MeshBasicMaterial();
  const mesh = createConstructionCellMesh(cells, material)!;
  try {
    for (const x of [11.2, 11.75, 12.25, 12.8]) for (const z of [1.4, 2.4, 3.6, 4.6]) {
      assert.equal(verticalHit(mesh, [x, z]), undefined, "shared seam must not gain an internal roof-end wall");
    }
    assert.ok(verticalHit(mesh, [0.2, 2.4]), "the true outside end still has its wall infill");
    assert.ok(verticalHit(mesh, [23.8, 2.4]));
  } finally { mesh.geometry.dispose(); material.dispose(); }
});

test("a stepped wing fills only the exposed seam above the adjoining roof profile", () => {
  const left = roofZone({ left: 0, right: 12, eavesY: 3.25, interiorEdges: [1], scope: "segment:0" });
  const right = roofZone({ left: 12, right: 24, eavesY: 3.75, interiorEdges: [3], scope: "segment:1" });
  const cells = buildLineBrushRoofWallCells([left.zone, right.zone]);
  const material = new THREE.MeshBasicMaterial();
  const mesh = createConstructionCellMesh(cells, material)!;
  try {
    for (const z of [1.4, 2.4, 3, 3.6, 4.6]) {
      assert.equal(verticalHit(mesh, [11.75, z]), undefined, "the covered lower wing does not gain an internal cap");
      const upper = verticalHit(mesh, [12.25, z]), lower = verticalHit(mesh, [12.25, z], true);
      assert.ok(upper && lower);
      close(upper.point.y, right.roofHeight(z), "higher roof contact");
      close(lower.point.y, Math.max(right.zone.eavesY, left.roofHeight(z)), "exposed seam starts at the adjoining roof");
    }
  } finally { mesh.geometry.dispose(); material.dispose(); }
});

function plainCell(x: number, y: number, z: number, id: string): LineBrushBuildingBlockCell {
  return { x, y, z, logicalCellId: id,
    footprintPolygons: [[[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]]] };
}

function storey(index: number, wallCells: LineBrushBuildingBlockCell[], slabCells: LineBrushBuildingBlockCell[]): LineBrushBuildingStoreyGeometry {
  return { storeyIndex: index, semanticBaseY: index * 2.645, semanticTopY: (index + 1) * 2.645,
    semanticHeightMeters: 2.645, semanticHeightMillimeters: 2645, minimumCellY: Math.round(index * 2.645),
    maximumCellYExclusive: Math.round((index + 1) * 2.645), slabY: Math.round(index * 2.645),
    wallCells, slabCells, occupiedCells: [...wallCells, ...slabCells] };
}

test("roof fragments share existing wall and slab owners without losing material or deletion semantics", () => {
  const wall = plainCell(5, 3, 5, "wall"), slab = plainCell(16, 5, 2, "slab");
  const cap = (cell: LineBrushBuildingBlockCell, id: string): LineBrushRoofWallCell => ({
    ...cell, logicalCellId: id, roofScope: "segment:0", roofZoneIndex: 0,
    minimumHeights: [[cell.y + 0.2, cell.y + 0.2, cell.y + 0.2, cell.y + 0.2]],
    maximumHeights: [[cell.y + 0.6, cell.y + 0.8, cell.y + 0.8, cell.y + 0.6]],
  });
  const wallCap = cap(wall, "wall-cap"), slabCap = cap(slab, "slab-cap"), secondSlabCap = cap(slab, "slab-cap-second-facet");
  const newCap = cap(plainCell(8, 7, 5, "new"), "new-cap");
  const specs = [
    { scope: "segment:0", storeyIndex: 0, storey: storey(0, [wall], []) },
    { scope: "segment:1", storeyIndex: 1, storey: storey(1, [], [slab]) },
  ];
  const attached = attachLineBrushRoofWallCells(specs, [wallCap, slabCap, secondSlabCap, newCap], "wall-material");
  assert.equal(specs[0]!.storey.wallCells.length, 1, "the source generation stays immutable");
  assert.equal(specs[1]!.storey.slabCells.length, 1);
  assert.deepEqual(attached[0]!.storey.wallCells.map(cell => cell.logicalCellId), ["wall", "wall-cap", "new-cap"]);
  assert.deepEqual(attached[1]!.storey.slabCells.map(cell => cell.logicalCellId), ["slab", "slab-cap", "slab-cap-second-facet"]);
  const owners = new Map<string, number>();
  for (const spec of attached) for (const assembly of [spec.storey.wallCells, spec.storey.slabCells]) {
    for (const key of new Set(assembly.map(cell => `${cell.x}:${cell.y}:${cell.z}`))) owners.set(key, (owners.get(key) ?? 0) + 1);
  }
  assert.ok([...owners.values()].every(count => count === 1), "one PlaceObject owner remains per integer edit address");
  const mixed = attached[1]!.storey.slabCells;
  const groups = constructionCellMaterialGroups(mixed, "slab-material");
  assert.deepEqual(groups.get("slab-material")!.map(cell => cell.logicalCellId), ["slab"]);
  assert.deepEqual(groups.get("wall-material")!.map(cell => cell.logicalCellId), ["slab-cap", "slab-cap-second-facet"]);
  const stored = JSON.parse(JSON.stringify(mixed));
  assert.equal(survivingConstructionCells(stored, [slab]).length, 3, "all shape fragments survive persistence under one address");
  assert.equal(survivingConstructionCells(stored, []).length, 0, "deleting the owner removes the slab and both cap fragments");
  assert.equal(survivingConstructionCells([{ ...slabCap, maximumHeights: [[NaN, 6, 6, 6]] }], [slab]).length, 0);
  assert.equal(survivingConstructionCells([{ ...slabCap, minimumHeights: [[5.2]] }], [slab]).length, 0);
});

test("variable-height construction cells preserve winding, both slopes and their edit address", () => {
  // A clockwise, closed ring exercises height reordering alongside winding normalization.
  const cell: LineBrushBuildingBlockCell = {
    x: 7, y: 3, z: 9, logicalCellId: "sloping-cap",
    footprintPolygons: [[[7, 9], [7, 10], [8, 10], [8, 9], [7, 9]]],
    minimumHeights: [[3.1, 3.3, 3.3, 3.1, 3.1]],
    maximumHeights: [[4, 4, 4.6, 4.6, 4]],
  };
  const material = new THREE.MeshBasicMaterial();
  const mesh = createConstructionCellMesh([cell], material)!;
  try {
    for (const [x, z] of [[7.2, 9.3], [7.8, 9.7]]) {
      const top = verticalHit(mesh, [x, z]), bottom = verticalHit(mesh, [x, z], true);
      assert.ok(top && bottom);
      close(top.point.y, 4 + (x - 7) * 0.6, "sloping top");
      close(bottom.point.y, 3.1 + (z - 9) * 0.2, "sloping bottom");
      assert.equal(constructionCellForIntersection(top), cell);
      assert.equal(constructionCellForIntersection(bottom), cell);
      assert.ok(top.face!.normal.y > 0 && bottom.face!.normal.y < 0);
    }
    for (const [origin, direction] of [
      [[5, 3.7, 9.5], [1, 0, 0]], [[10, 3.7, 9.5], [-1, 0, 0]],
      [[7.5, 3.7, 7], [0, 0, 1]], [[7.5, 3.7, 12], [0, 0, -1]],
    ]) {
      const hit = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction)).intersectObject(mesh)[0];
      assert.ok(hit, "every outside face is visible with front-sided material");
      assert.equal(constructionCellForIntersection(hit), cell);
      assert.ok(hit.face!.normal.dot(new THREE.Vector3(...direction)) < 0);
    }
  } finally { mesh.geometry.dispose(); material.dispose(); }
});
