const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../static/cad/js/main.js"),
  "utf8",
);

assert.match(source, /function scheduleCameraRender\(\)/);
assert.match(source, /svg\.setAttribute\("viewBox"/);
assert.match(source, /state\.activeTool === "select" && !state\.drawStart && !state\.editPlacement/);
assert.match(source, /state\.cameraSettleTimer = window\.setTimeout/);
assert.match(source, /const SHARED_MODEL_POLL_INTERVAL_MS = 8000/);
assert.match(source, /Date\.now\(\) - state\.lastInteractionAt < INTERACTION_QUIET_WINDOW_MS/);
assert.match(source, /\|\| state\.pan/);
assert.match(source, /state\.workspaceVisible = data\.visible !== false/);

console.log("CAD render performance contract tests passed");
