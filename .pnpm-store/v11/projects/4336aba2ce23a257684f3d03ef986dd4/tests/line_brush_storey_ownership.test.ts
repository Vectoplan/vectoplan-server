import test from "node:test";
import assert from "node:assert/strict";
import { coalesceLineBrushStoreys } from "../src/frontend/world_edit/systems/line_brush/storey_ownership";
import { buildLineBrushBuildingGeometry } from "../src/frontend/world_edit/systems/line_brush/building_geometry";
import { buildLineBrushBuildingLayout } from "../src/frontend/world_edit/systems/line_brush/building_layout";
import { lineBrushBuildingPreset } from "../src/frontend/world_edit/systems/line_brush/building_presets";
import { createPathBrushDraft } from "../src/frontend/world_edit/systems/shared/path_brush_geometry";

test("joined wings sharing integer addresses keep every prism under one owner per floor", () => {
  const draft = createPathBrushDraft([{x:0,y:0,z:0},{x:20,y:0,z:12},{x:10,y:0,z:30}], {kind:"building",width:8,interpolation:"linear"})!;
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  const specs = [0, 1].map((index) => ({
    storeyIndex: 0, scope: `segment:${index}`,
    footprint: {type:"MultiPolygon",coordinates:layout.bySegment[String(index)]},
    storey: buildLineBrushBuildingGeometry({draft,layout,baseY:1,storeyCount:1,alignToBuildingGrid:true,segmentScope:index}).storeys[0]!,
  }));
  const merged = coalesceLineBrushStoreys(specs);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.storey.wallCells.length, specs.reduce((sum,s)=>sum+s.storey.wallCells.length,0));
  assert.equal(merged[0]!.storey.slabCells.length, specs.reduce((sum,s)=>sum+s.storey.slabCells.length,0));
  assert.equal(merged[0]!.scope, "all");
  const stepped = coalesceLineBrushStoreys([...specs,{...specs[0]!,storeyIndex:1}]);
  assert.equal(stepped.length, 2);
  assert.equal(stepped[1]!.scope, "segment:0");
});
