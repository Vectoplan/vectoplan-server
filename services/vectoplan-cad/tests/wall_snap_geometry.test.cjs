const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../static/cad/js/main.js"), "utf8");

function sourceFunction(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} is missing`);
  const firstBrace = source.indexOf("{", start);
  let depth = 0;
  let end = firstBrace;
  for (; end < source.length; end += 1) {
    if (source[end] === "{") depth += 1;
    else if (source[end] === "}") {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return Function(`return (${source.slice(start, end)})`)();
}

const wallPathBoundaryCorners = sourceFunction("wallPathBoundaryCorners");
const wallEdgeGeometry = sourceFunction("wallEdgeGeometry");
global.normalizedPolygonPoints = sourceFunction("normalizedPolygonPoints");
global.polygonAreaAndCentroid = sourceFunction("polygonAreaAndCentroid");
global.finiteSegmentIntersection = sourceFunction("finiteSegmentIntersection");
const closedFacesFromWallSegments = sourceFunction("closedFacesFromWallSegments");
const measurementLengthParts = sourceFunction("measurementLengthParts");
const alignmentTrackingCandidate = sourceFunction("alignmentTrackingCandidate");

assert.deepEqual(
  wallPathBoundaryCorners([[0, 0], [0, 1000]], 100),
  [[-50, -50], [50, -50], [-50, 1050], [50, 1050]],
  "vertical square caps must snap at the four visible corners",
);
assert.deepEqual(
  wallPathBoundaryCorners([[0, 0], [1000, 0]], 100),
  [[-50, 50], [-50, -50], [1050, 50], [1050, -50]],
  "horizontal square caps must extend by half the wall thickness",
);

assert.deepEqual(
  wallEdgeGeometry([0, 0], [1000, 0], 100),
  {
    referenceStart: [0, 0],
    referenceEnd: [1000, 0],
    centreStart: [0, 50],
    centreEnd: [1000, 50],
    bodyPoints: [[0, 0], [1000, 0], [1000, 100], [0, 100]],
    referenceRole: "outer-edge",
  },
  "the authored reference and visible wall body must end at the exact same outside corners",
);

const closedFaces = closedFacesFromWallSegments([
  {start: [-100, 0], end: [5100, 0]},
  {start: [5000, -100], end: [5000, 4100]},
  {start: [5100, 4000], end: [-100, 4000]},
  {start: [0, 4100], end: [0, -100]},
]);
assert.ok(closedFaces.some((ring) => polygonAreaAndCentroid(ring).areaMm2 === 20_000_000), "closed wall references must yield a complete measurable face");

const dividedFaces = closedFacesFromWallSegments([
  {start: [-100, 0], end: [5100, 0]},
  {start: [5000, -100], end: [5000, 4100]},
  {start: [5100, 4000], end: [-100, 4000]},
  {start: [0, 4100], end: [0, -100]},
  {start: [2500, -100], end: [2500, 4100]},
]);
assert.ok(dividedFaces.filter((ring) => polygonAreaAndCentroid(ring).areaMm2 === 10_000_000).length >= 2, "intersecting divider walls must expose both enclosed room faces");

assert.deepEqual(
  measurementLengthParts(3243),
  {roundedMillimetres: 3245, base: "3,24", raised: "5", full: "3,245 m"},
  "measurements must use German metres, 5 mm rounding and a separable final digit",
);
assert.deepEqual(
  alignmentTrackingCandidate({x: 4994, y: 2700}, [[5000, 1000]], 10),
  {point: [5000, 2700], xAnchor: [5000, 1000], yAnchor: null, kind: "alignment-x"},
  "an acquired point must align a later cursor to its exact X coordinate",
);
assert.deepEqual(
  alignmentTrackingCandidate({x: 3200, y: 1995}, [[1000, 2000]], 10),
  {point: [3200, 2000], xAnchor: null, yAnchor: [1000, 2000], kind: "alignment-y"},
  "an acquired point must align a later cursor to its exact Y coordinate",
);

console.log("wall snap geometry: 8 checks passed");
