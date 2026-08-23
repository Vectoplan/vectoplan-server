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

console.log("wall snap geometry: 2 checks passed");
