import assert from "node:assert/strict";
import test from "node:test";

import type { RuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import {
  centeredChunkMapOffset,
  chunkMapCenterForZoomAnchor,
  chunkMapScaleForDenominator,
  chunkMapWorldMetric,
  chunkContainsMapRoof,
  chunkMapRoofSignature,
  collectChunkMapRoofs,
  mergeChunkMapRoofs,
  parseChunkMapStructureRoofs,
} from "../src/frontend/scene/chunk_map_geometry";


function chunk(
  chunkKey: string,
  objectRefs: readonly unknown[],
  options: Readonly<{ cellSize?: number; revision?: number }> = {},
): RuntimeChunkContent {
  return {
    chunkKey,
    cellSize: options.cellSize ?? 1,
    chunkRevision: options.revision ?? 1,
    chunkVersion: String(options.revision ?? 1),
    loadedAt: "2026-08-29T00:00:00.000Z",
    raw: { objectRefs, raw: {} },
  } as RuntimeChunkContent;
}

function roofRef(
  primaryChunkKey: string,
  fingerprint: string,
  faceOffsetMm: number,
): Readonly<Record<string, unknown>> {
  return {
    objectInstanceId: "roof-1",
    objectTypeId: "building_roof",
    primaryChunkKey,
    footprint: {
      type: "Polygon",
      coordinateSpace: "world-cell-xz",
      baseY: 4,
      height: 3,
      coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]],
    },
    metadata: {
      roofCalculation: {
        ok: true,
        input_fingerprint: fingerprint,
        geometry: {
          faces: [{
            face_ref: "structural",
            polygon_3d_mm: [
              [0, 0, 4_000], [4_000, 0, 4_000], [4_000, 4_000, 7_000],
            ],
          }],
        },
        roof_build_up: {
          top_faces: [{
            face_ref: "tiles",
            polygon_3d_mm: [
              [faceOffsetMm, 0, 4_200],
              [faceOffsetMm + 4_000, 0, 4_200],
              [faceOffsetMm + 4_000, 4_000, 7_200],
            ],
          }],
        },
      },
    },
  };
}

test("map scale 1:1500 uses the browser reference pixel density", () => {
  assert.ok(Math.abs(chunkMapScaleForDenominator(1_500, 1) - 2.519685039) < 1e-8);
  assert.ok(Math.abs(chunkMapScaleForDenominator(1_500, 2) - 5.039370079) < 1e-8);
});

test("map corrects the periodic Earth grid to a physical aspect ratio", () => {
  const metric = chunkMapWorldMetric(40_000_000, 20_000_000, 52.517389);
  assert.ok(Math.abs(metric.x - 0.6109509342) < 1e-9);
  assert.ok(Math.abs(metric.z - 1.0014944569) < 1e-9);
  assert.ok(metric.x < metric.z);
});

test("map zoom keeps the world point under the mouse at the same screen pixel", () => {
  const anchor = { pixelX: 70, pixelY: 20, worldX: 20, worldZ: 5 };
  const nextScale = 4;
  const center = chunkMapCenterForZoomAnchor(
    anchor.pixelX, anchor.pixelY, anchor.worldX, anchor.worldZ, nextScale, 100, 80,
  );
  const transform = centeredChunkMapOffset(center.centerX, center.centerZ, 0, 0, nextScale, 100, 80);
  assert.equal(transform.offsetX + anchor.worldX * nextScale, anchor.pixelX);
  assert.equal(transform.offsetY + anchor.worldZ * nextScale, anchor.pixelY);
});

test("map zoom anchor remains exact with independent east and north scales", () => {
  const anchor = { pixelX: 70, pixelY: 20, worldX: 20, worldZ: 5 };
  const center = chunkMapCenterForZoomAnchor(
    anchor.pixelX, anchor.pixelY, anchor.worldX, anchor.worldZ, 2.5, 100, 80, 4,
  );
  const transform = centeredChunkMapOffset(
    center.centerX, center.centerZ, 0, 0, 2.5, 100, 80, 4,
  );
  assert.equal(transform.offsetX + anchor.worldX * 2.5, anchor.pixelX);
  assert.equal(transform.offsetY + anchor.worldZ * 4, anchor.pixelY);
});

test("map follows a moving player by translating the cached background in the opposite direction", () => {
  const before = centeredChunkMapOffset(10, 15, 0, 0, 2, 100, 80);
  const after = centeredChunkMapOffset(18, 11, 0, 0, 2, 100, 80);
  assert.deepEqual(before, { offsetX: 30, offsetY: 10 });
  assert.deepEqual(after, { offsetX: 14, offsetY: 18 });
  assert.equal(after.offsetX - before.offsetX, -16);
  assert.equal(after.offsetY - before.offsetY, 8);
});

test("map uses the authoritative roof anchor once and projects canonical top faces", () => {
  const staleNeighbor = chunk("1:0:0", [roofRef("0:0:0", "stale", 8_000)], { cellSize: 2 });
  const primary = chunk("0:0:0", [roofRef("0:0:0", "current", 1_000)], { cellSize: 2, revision: 7 });
  assert.equal(chunkContainsMapRoof(staleNeighbor), true);

  const roofs = collectChunkMapRoofs([staleNeighbor, primary]);
  assert.equal(roofs.length, 1);
  assert.equal(roofs[0]!.primaryChunkKey, "0:0:0");
  assert.equal(roofs[0]!.faces.length, 1);
  assert.equal(roofs[0]!.faces[0]!.faceRef, "tiles");
  assert.deepEqual(roofs[0]!.faces[0]!.points[0], { x: 2, y: 8.4, z: 0 });
  assert.equal(roofs[0]!.outlines[0]!.length, 4);
  assert.equal(chunkMapRoofSignature([staleNeighbor, primary]), "roof-1:current");
});

test("map falls back to the semantic roof footprint when no calculation faces exist", () => {
  const value = chunk("2:0:3", [{
    objectInstanceId: "roof-footprint",
    objectTypeId: "building_roof",
    primaryChunkKey: "2:0:3",
    footprint: {
      type: "Polygon",
      coordinateSpace: "world-cell-xz",
      baseY: 5,
      height: 2,
      coordinates: [[[32, 48], [38, 48], [35, 54], [32, 48]]],
    },
    metadata: {},
  }]);
  const roofs = collectChunkMapRoofs([value]);
  assert.equal(roofs.length, 1);
  assert.equal(roofs[0]!.faces.length, 0);
  assert.deepEqual(roofs[0]!.outlines[0]!.map(({ x, z }) => [x, z]), [
    [32, 48], [38, 48], [35, 54],
  ]);
  assert.equal(roofs[0]!.minimumY, 7);
  assert.equal(roofs[0]!.maximumY, 7);
});

test("map accepts the lightweight server roof projection and merges live chunks", () => {
  const projected = parseChunkMapStructureRoofs({
    schemaVersion: "vectoplan-map-structures.v1",
    roofs: [{
      objectInstanceId: "roof-1",
      primaryChunkKey: "2:0:3",
      faces: [{ faceRef: "west", points: [[32, 7, 48], [38, 7, 48], [35, 9, 54]] }],
      outlines: [[[32, 7, 48], [38, 7, 48], [35, 7, 54]]],
    }],
  });
  assert.equal(projected.length, 1);
  assert.deepEqual(projected[0]!.faces[0]!.points[2], { x: 35, y: 9, z: 54 });
  assert.deepEqual(
    [projected[0]!.minX, projected[0]!.maxX, projected[0]!.minZ, projected[0]!.maxZ],
    [32, 38, 48, 54],
  );

  const live = collectChunkMapRoofs([chunk("2:0:3", [roofRef("2:0:3", "live", 1_000)])]);
  const merged = mergeChunkMapRoofs(projected, live);
  assert.equal(merged.length, 1);
  assert.equal(merged[0], live[0]);
});
