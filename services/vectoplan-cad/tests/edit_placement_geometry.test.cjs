const assert = require("node:assert/strict");
const path = require("node:path");

const geometry = require(path.join(__dirname, "../static/cad/js/edit_placement_geometry.js"));

const bounds = geometry.aggregateBounds([
  {bounds: {x: 0, y: 0, width: 100, height: 50}, edit: {translateX: 20, translateY: 10}},
  {bounds: {x: 200, y: 100, width: 50, height: 40}, edit: {translateX: -10, translateY: 5}},
]);
assert.deepEqual(bounds, {x: 20, y: 10, width: 220, height: 135, center: {x: 130, y: 77.5}});

assert.deepEqual(
  geometry.translationDelta({x: 100, y: 100}, {x: 200, y: 300}, 2, 10),
  {x: 120, y: 180, target: {x: 220, y: 280}},
);
const rotated = geometry.rotatePoint({x: 10, y: 0}, {x: 0, y: 0}, 90);
assert.ok(Math.abs(rotated.x) < 1e-9);
assert.ok(Math.abs(rotated.y - 10) < 1e-9);
assert.equal(geometry.rotationDelta({x: 0, y: 0}, {x: 10, y: 0}, {x: 0, y: 10}, 15), 90);
assert.equal(geometry.mirrorAxis({x: 0, y: 0}, {x: 20, y: 3}), "vertical");
assert.equal(geometry.mirrorAxis({x: 0, y: 0}, {x: 2, y: -30}), "horizontal");
assert.deepEqual(geometry.reflectPoint({x: 12, y: 8}, {x: 10, y: 10}, "vertical"), {x: 8, y: 8});

console.log("edit placement geometry tests passed");
