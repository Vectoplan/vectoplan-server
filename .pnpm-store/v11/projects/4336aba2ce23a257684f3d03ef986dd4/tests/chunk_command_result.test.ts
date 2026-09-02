import assert from "node:assert/strict";
import test from "node:test";

import {
  ChunkCommandResultContractError,
  commandResultFromUnknown,
  requireCommandResultFromUnknown,
} from "../src/frontend/runtime/world/chunk_command_result";
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

test("recognizes the atomic ObjectBatch result used by building regeneration", () => {
  const result = requireCommandResultFromUnknown({
    ok: true,
    commandType: "ObjectBatch",
    commandStatus: "applied",
    changed: true,
    changedChunks: ["1:0:2", "2:0:2"],
    dirtyChunks: ["1:0:2", "2:0:2"],
  }, "atomare Baukörper-Regeneration");

  assert.equal(result.commandType, "ObjectBatch");
  assert.deepEqual(result.changedChunks, ["1:0:2", "2:0:2"]);
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

test("requires a normal productive direct command result", () => {
  const result = requireCommandResultFromUnknown({
    ok: true,
    commandType: "WorldEdit",
    changed: true,
    changedChunks: ["3:0:7"],
  }, "WorldEdit Tentacle Stra\u00dfe");

  assert.equal(result.changed, true);
  assert.deepEqual(result.changedChunks, ["3:0:7"]);
});

test("skips a malformed legacy envelope and accepts the valid raw result envelope", () => {
  const result = requireCommandResultFromUnknown({
    result: { ok: true, commandType: "WorldEdit", changed: "yes" },
    raw: {
      result: {
        ok: true,
        commandType: "WorldEdit",
        changed: false,
        changedChunks: [],
      },
    },
  });

  assert.equal(result.changed, false);
});

test("rejects a missing command-result envelope with a diagnostic contract error", () => {
  assert.throws(
    () => requireCommandResultFromUnknown({ ok: true, status: "ready" }, "WorldEdit Tentacle Stra\u00dfe"),
    (error: unknown) => {
      assert.ok(error instanceof ChunkCommandResultContractError);
      assert.equal(error.code, "chunk_command_result_contract_invalid");
      assert.match(error.message, /WorldEdit Tentacle Stra\u00dfe/);
      assert.match(error.message, /empfangene Felder: ok, status/);
      return true;
    },
  );
});

test("rejects a divergent wrapper instead of treating it as an unchanged command", () => {
  assert.throws(
    () => requireCommandResultFromUnknown({
      result: {
        ok: true,
        commandType: "WorldEdit",
        changed: "false",
      },
    }),
    ChunkCommandResultContractError,
  );
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
