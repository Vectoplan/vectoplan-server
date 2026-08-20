import assert from "node:assert/strict";
import test from "node:test";

import { resolveEditorInventoryPayloadSelectedSlot } from "../src/frontend/api/editor_inventory_api_client";
import { isSilentHotbarReloadReason } from "../src/frontend/inventory/hotbar_controller";

test("restores the server-side inventory selection instead of the bootstrap default", () => {
  assert.equal(
    resolveEditorInventoryPayloadSelectedSlot(
      { inventory: { selectedSlot: 5 } },
      0,
      9,
    ),
    5,
  );
  assert.equal(
    resolveEditorInventoryPayloadSelectedSlot(
      { inventory: { selected_slot: 7 } },
      0,
      9,
    ),
    7,
  );
});

test("uses the bootstrap selection only when the response has no selection", () => {
  assert.equal(
    resolveEditorInventoryPayloadSelectedSlot({ inventory: {} }, 3, 9),
    3,
  );
});

test("keeps iframe slot synchronization in the background", () => {
  assert.equal(isSilentHotbarReloadReason("library-user-inventory-frame-sync"), true);
  assert.equal(isSilentHotbarReloadReason("library-user-inventory-frame-sync-ready"), true);
});

test("keeps normal inventory loads visible", () => {
  assert.equal(isSilentHotbarReloadReason("hotbar-reload"), false);
  assert.equal(isSilentHotbarReloadReason(undefined), false);
});
