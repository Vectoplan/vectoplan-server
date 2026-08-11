import assert from "node:assert/strict";
import test from "node:test";

import { commandResultFromUnknown } from "../src/frontend/runtime/world/chunk_command_result";

test("recognizes the direct normalized PlaceObject result returned by library placement", () => {
  const result = commandResultFromUnknown({
    ok: true,
    commandType: "PlaceObject",
    commandStatus: "applied",
    changed: true,
    changedChunks: ["-4:0:10"],
    dirtyChunks: ["-4:0:10"],
  });

  assert.ok(result);
  assert.equal(result.commandType, "PlaceObject");
  assert.deepEqual(result.changedChunks, ["-4:0:10"]);
});

test("keeps accepting the legacy ChunkSource result wrapper", () => {
  const result = commandResultFromUnknown({
    result: {
      ok: true,
      commandType: "SetBlock",
      changed: true,
      changedChunks: ["1:0:2"],
    },
  });

  assert.ok(result);
  assert.equal(result.commandType, "SetBlock");
  assert.deepEqual(result.changedChunks, ["1:0:2"]);
});

test("does not misclassify an unrelated successful response", () => {
  assert.equal(commandResultFromUnknown({ ok: true, status: "ready" }), null);
});
