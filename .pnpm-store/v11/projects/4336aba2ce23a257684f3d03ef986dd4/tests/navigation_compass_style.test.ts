import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const stylesheet = readFileSync(
  resolve("src/frontend/styles/realtime_environment.css"),
  "utf8",
);

const compassStart = stylesheet.indexOf(".editor-navigation-compass {");
const compassEnd = stylesheet.indexOf(".editor-chunk-map[hidden]", compassStart);
const compassStyles = stylesheet.slice(compassStart, compassEnd);

test("navigation compass uses the protected light visual language", () => {
  assert(compassStart >= 0 && compassEnd > compassStart, "compass CSS section exists");
  assert.match(compassStyles, /--editor-compass-surface:\s*rgb\(255 255 255 \/ 92%\)/);
  assert.match(compassStyles, /--editor-compass-ink:\s*#183b56/);
  assert.match(compassStyles, /--editor-compass-accent:\s*#168bd2/);
  assert.match(compassStyles, /backdrop-filter:\s*blur\(10px\)/);
  assert.doesNotMatch(compassStyles, /rgb\(5 12 22/);
  assert.doesNotMatch(compassStyles, /color:\s*#f8fafc/);
});

test("navigation compass presentation keeps its positioning contract", () => {
  const rootRule = compassStyles.slice(
    compassStyles.indexOf(".editor-navigation-compass {"),
    compassStyles.indexOf(".editor-navigation-compass[hidden]"),
  );
  assert.match(rootRule, /top:\s*12px/);
  assert.match(rootRule, /left:\s*50%/);
  assert.match(rootRule, /transform:\s*translateX\(-50%\)/);
  assert.match(rootRule, /pointer-events:\s*none/);
});
