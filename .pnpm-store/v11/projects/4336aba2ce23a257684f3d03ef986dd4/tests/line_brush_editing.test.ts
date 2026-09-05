import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createRoomSystem, type RoomSystemHooks } from "../src/frontend/world_edit/systems/room/system";
import { createLineBrushBuildingStructurePreview } from "../src/frontend/world_edit/systems/line_brush/building_preview";
import { createBlockMaterial } from "../src/frontend/render/block_material";

const intent = (action: "primary" | "secondary") => ({ action, trigger: "test", position: {x:0,y:0,z:0},
  sourceCell:null, placementCell:null, targetPoint:null, createdAt:"test" });
function setup(building = true) {
  const calls:string[]=[]; let hit = false, gear = false;
  const hooks: RoomSystemHooks = {
    stopInteraction:()=>{}, startHover:()=>{}, stopHover:()=>{}, removePointUnderCrosshair:()=>{if(hit)calls.push("point");return hit;},
    pointDeletionOnly:()=>building, openSettingsUnderCrosshair:()=>{if(gear)calls.push("settings");return gear;},
    resolveTarget:()=>({x:0,y:0,z:0}),existingRoomAt:()=>({id:"other"}),removeExistingRoom:()=>{calls.push("building");},
    selectExistingRoom:()=>{calls.push("select");}, shouldSelectExisting:()=>true,beginPointInteraction:()=>{calls.push("draw");},
    finishArea:()=>{},clearRoomSelection:()=>{calls.push("clear");},hasCompleteSelection:()=>true,
    executeRoom:async()=>{},rebuild:()=>{},reset:()=>{},setStatus:()=>{},
  };
  return { system:createRoomSystem(hooks),calls,hit:()=>{hit=true;},gear:()=>{gear=true;} };
}
test("line brush right click removes an aimed point and a miss leaves the building intact", async()=>{
  const t=setup();await t.system.handleIntent!(intent("secondary"));assert.deepEqual(t.calls,[]);
  t.hit();await t.system.handleIntent!(intent("secondary"));assert.deepEqual(t.calls,["point"]);
});
test("legacy room deletion remains available",async()=>{
  const t=setup(false);await t.system.handleIntent!(intent("secondary"));assert.deepEqual(t.calls,["building"]);
});
test("settings gear takes priority over drawing and complete drafts allow building selection",async()=>{
  const t=setup();await t.system.handleIntent!(intent("primary"));assert.deepEqual(t.calls,["select"]);
  t.gear();await t.system.handleIntent!(intent("primary"));assert.deepEqual(t.calls,["select","settings"]);
});
test("editable construction is opaque and inactive fallback uses the actual block material",()=>{
  const storey={wallCells:[{x:0,y:0,z:0}],slabCells:[]} as any;
  const normal=createBlockMaterial({blockTypeId:"lod2_exterior_wall"});
  for (const editable of [true,false]) {
    const group=createLineBrushBuildingStructurePreview({storeys:[{scope:"all",storey}],selectedScope:"all",editable});
    const mesh=group.children[0] as THREE.Mesh;
    const material=mesh.material as THREE.MeshStandardMaterial;
    assert.equal(material.transparent,false);assert.equal(material.opacity,1);assert.equal(material.depthWrite,true);
    assert.equal(material.color.equals(normal.color),!editable);
    (mesh.geometry as THREE.BufferGeometry).dispose();material.dispose();
  }
  normal.dispose();
});
