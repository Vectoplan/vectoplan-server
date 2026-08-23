import assert from "node:assert/strict";
import test from "node:test";

import { commandResultFromUnknown } from "../src/frontend/runtime/world/chunk_command_result";
import {
  clipboardCommandResult,
  clipboardEntriesFromCommandResult,
} from "../src/frontend/world_edit/systems/clipboard/response";

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

test("clipboard accepts the productive direct command result and reads copied cells", () => {
  const direct = {
    ok: true,
    commandType: "WorldEdit",
    changed: false,
    raw: {
      ok: true,
      commandType: "WorldEdit",
      clipboard: [
        { x: 0, y: 1, z: 2, blockTypeId: "stone" },
        { x: 1, y: 1, z: 2, blockTypeId: "glass" },
      ],
    },
  };

  assert.equal(clipboardCommandResult(direct)?.commandType, "WorldEdit");
  assert.equal(clipboardEntriesFromCommandResult(direct).length, 2);
});

test("clipboard keeps accepting the legacy ChunkSource wrapper", () => {
  const wrapped = {
    result: {
      ok: true,
      commandType: "WorldEdit",
      changed: false,
      raw: {
        ok: true,
        worldEdit: {
          clipboard: [{ x: 4, y: 5, z: 6, blockTypeId: "brick" }],
        },
      },
    },
  };

  assert.equal(clipboardEntriesFromCommandResult(wrapped).length, 1);
});
