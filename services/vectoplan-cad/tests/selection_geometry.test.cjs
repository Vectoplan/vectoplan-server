const assert = require("node:assert/strict");
const path = require("node:path");

const {
  contains,
  intersects,
  normalizeRect,
  refsInMarquee,
} = require(path.join(__dirname, "../static/cad/js/selection_geometry.js"));

assert.deepEqual(
  normalizeRect({left: 80, right: 10, top: 60, bottom: 20}),
  {left: 10, right: 80, top: 20, bottom: 60, width: 70, height: 40},
);
assert.equal(contains(
  {left: 0, right: 100, top: 0, bottom: 100},
  {left: 20, right: 80, top: 20, bottom: 80},
), true);
assert.equal(intersects(
  {left: 0, right: 50, top: 0, bottom: 50},
  {left: 40, right: 80, top: 40, bottom: 80},
), true);

const entries = [
  {ref: "inside", rect: {left: 20, right: 40, top: 20, bottom: 40}},
  {ref: "crossing", rect: {left: 90, right: 120, top: 20, bottom: 40}},
  {ref: "outside", rect: {left: 140, right: 160, top: 20, bottom: 40}},
];
const marquee = {left: 0, right: 100, top: 0, bottom: 100};

assert.deepEqual(refsInMarquee(entries, marquee, false), ["inside"]);
assert.deepEqual(refsInMarquee(entries, marquee, true), ["inside", "crossing"]);

console.log("selection geometry tests passed");
