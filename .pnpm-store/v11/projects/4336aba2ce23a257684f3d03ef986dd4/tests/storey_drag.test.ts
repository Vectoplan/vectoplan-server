import assert from "node:assert/strict";
import test from "node:test";
import { storeyCountFromDrag } from "../src/frontend/world_edit/systems/storey/drag";

test("vertical dragging adds and removes whole floors at the projected camera scale", () => {
  assert.equal(storeyCountFromDrag(6, -60, 30), 8);
  assert.equal(storeyCountFromDrag(6, 60, 30), 4);
  assert.equal(storeyCountFromDrag(6, -120, 60), 8);
  assert.equal(storeyCountFromDrag(6, 10, 30), 6);
});
test("top view, invalid values and storey limits remain stable", () => {
  assert.equal(storeyCountFromDrag(6, -24, 0), 8);
  assert.equal(storeyCountFromDrag(1, 1000, 30), 1);
  assert.equal(storeyCountFromDrag(79, -1000, 30), 80);
  assert.equal(storeyCountFromDrag(6, NaN, 30), 6);
  assert.equal(storeyCountFromDrag(6, 30, Infinity), 6);
});
