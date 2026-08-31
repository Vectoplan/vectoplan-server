import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src", "frontend", "main.ts"), "utf8");

assert.match(source, /vectoplan-app:workspace-visibility/);
assert.match(source, /sceneRuntime\.pause\(reason\)/);
assert.match(source, /sceneRuntime\.start\(reason\)/);
assert.match(source, /syncEmbeddedWorkspaceVisibility\("editor\.initialize\.visibility-sync"\)/);
assert.match(source, /new window\.IntersectionObserver/);
assert.match(source, /editorRootIntersecting/);

console.log("embedded visibility contract tests passed");
