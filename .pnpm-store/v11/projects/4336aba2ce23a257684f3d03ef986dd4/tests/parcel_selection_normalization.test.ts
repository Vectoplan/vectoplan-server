import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizedParcelItems,
} from "../src/frontend/world_edit/world_edit_controller";
import { parcelSelectionActionForIntent } from "../src/frontend/world_edit/systems/parcel/system";
import {
  earthGridLonLatToWorld,
  earthGridWorldPointToLonLat,
} from "../src/frontend/utils/earth_grid_coordinates";

function polygon(maximum: number): Readonly<Record<string, unknown>> {
  return {
    type: "Polygon",
    coordinates: [[
      [0, 0],
      [maximum, 0],
      [maximum, maximum],
      [0, maximum],
      [0, 0],
    ]],
  };
}

test("a newer parcel snapshot replaces an older geometry instead of being appended", () => {
  const normalized = normalizedParcelItems([
    { parcelId: "parcel-1", datasetId: "flurstuecke", geometry: polygon(1) },
    { parcelId: "parcel-1", datasetId: "flurstuecke", geometry: polygon(4) },
  ], 64);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.geometry.type, "Polygon");
  assert.deepEqual(normalized[0]?.geometry, polygon(4));
});

test("left click selects and right click removes a parcel", () => {
  assert.equal(parcelSelectionActionForIntent("primary"), "select");
  assert.equal(parcelSelectionActionForIntent("secondary"), "remove");
  assert.equal(parcelSelectionActionForIntent("primary-release"), null);
  assert.equal(parcelSelectionActionForIntent("secondary-release"), null);
});

test("parcel coordinates use the same canonical Earth grid as visible chunk overlays", () => {
  const frame = {
    worldWidthCells: 40_000_000,
    worldHeightCells: 20_000_000,
    centralMeridianDegrees: 0,
    storageOrigin: { x: 1_489_440, z: 5_835_552 },
  };
  const berlin: readonly [number, number] = [13.405, 52.52];
  const east = earthGridLonLatToWorld(berlin[0] + 0.001, berlin[1], frame);
  const world = earthGridLonLatToWorld(berlin[0], berlin[1], frame);

  assert.ok(world);
  assert.ok(east);
  assert.ok(Math.abs((east[0] - world[0]) - (0.001 / 360 * frame.worldWidthCells)) < 1e-8);
  const roundTrip = earthGridWorldPointToLonLat(world[0], world[1], frame);
  assert.ok(Math.abs(roundTrip[0] - berlin[0]) < 1e-10);
  assert.ok(Math.abs(roundTrip[1] - berlin[1]) < 1e-10);
});

test("a real MultiPolygon keeps all of its parts", () => {
  const first = polygon(1).coordinates as unknown[];
  const second = {
    type: "Polygon",
    coordinates: [[[3, 3], [4, 3], [4, 4], [3, 4], [3, 3]]],
  }.coordinates;
  const normalized = normalizedParcelItems([{
    parcelId: "parcel-2",
    datasetId: "flurstuecke",
    geometry: { type: "MultiPolygon", coordinates: [first, second] },
  }], 64);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]?.geometry.type, "MultiPolygon");
  assert.equal((normalized[0]?.geometry.coordinates as unknown[]).length, 2);
});
