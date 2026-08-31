import assert from "node:assert/strict";
import test from "node:test";
import { Box3, Vector3 } from "three";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { additionalSurfaceChunkCoordinates } from "../src/frontend/scene/structure_streaming";
import { appendSemanticObjectMeshes, createChunkMeshRecord, semanticObjectRefs } from "../src/frontend/scene/scene_runtime";
import { shouldAdaptBlockToParcelGrid, shouldAdaptSemanticObjectToParcelGrid } from "../src/frontend/scene/semantic_object_rendering";

const roof = {
  objectInstanceId: "lod2_roof_streaming_fixture", objectTypeId: "building_roof", objectKind: "semantic_footprint",
  primaryChunkKey: "-8:1:1", anchor: {x:-128,y:27,z:28}, occupiedCells: [{x:-128,y:27,z:28}],
  dimensions:{x:113,y:8,z:100}, fillBlockTypeId:"lod2_exterior_wall",
  footprint:{type:"Polygon",coordinateSpace:"world-cell-xz",baseY:27,height:8,
    coordinates:[[[-128,28],[-15,28],[-15,128],[-128,28]]]},
  metadata:{voxelOccupancy:"none",source:"vectoplan-chunk.lod2-import",roofCalculation:{ok:true,
    geometry:{faces:[{face_ref:"fixture",polygon_3d_mm:[[-128000,28000,27000],[-15000,28000,27000],[-15000,128000,35000]]}]},
    structure:{rafters:[],purlins:[]}}},
};
function chunk(x:number,y:number,z:number,metadata:Record<string,unknown>={},objectRefs:unknown[]=[]) {
  const normalized = normalizeChunkApiBatchResult({ok:true,chunks:[{chunk:{
    projectId:"streaming-test",worldId:"earth",chunkKey:`${x}:${y}:${z}`,chunkX:x,chunkY:y,chunkZ:z,
    chunkSize:16,cellSize:1,cells:Array(4096).fill(0),palette:[],source:"snapshot",
    stats:{cellCount:4096,nonAirCellCount:0,airCellCount:4096,minimumSurfaceY:0,maximumSurfaceY:0},
    metadata,objectRefs,
  }}]}, null, {projectId:"streaming-test",worldId:"earth",requestedChunks:[{chunkX:x,chunkY:y,chunkZ:z}]});
  assert(normalized.ok);
  return createRuntimeChunkContent(normalized.chunks[0]!);
}
const hint = {structureStreaming:{schemaVersion:"structure-streaming.v1",chunkCoordinates:[
  {chunkX:-8,chunkY:1,chunkZ:1}, {chunkX:-2,chunkY:2,chunkZ:4},
]}};

test("production batch normalizer/streaming retains upper walls and remote roof anchor across chunk changes", () => {
  const center={chunkX:0,chunkY:0,chunkZ:0};
  // The anchor is outside a seven-chunk circle, but the roof intersects -2:0:4.
  const first=additionalSurfaceChunkCoordinates([chunk(-2,0,4,hint)],center);
  assert.deepEqual(first, hint.structureStreaming.chunkCoordinates);
  const moved=additionalSurfaceChunkCoordinates([chunk(-3,0,5,hint),chunk(-2,0,4,hint)],{...center,chunkX:1});
  assert.deepEqual(moved,first); // one instance per anchor, even across many columns
  assert.deepEqual(additionalSurfaceChunkCoordinates([chunk(30,0,30)],{...center,chunkX:30}),[]);
  assert.deepEqual(additionalSurfaceChunkCoordinates([chunk(-2,0,4,hint)],center),first); // return after eviction
});

test("actual scene chunk builder renders an all-air roof anchor at original world height exactly once", () => {
  const anchor=chunk(-8,1,1,{},[roof]);
  const record=appendSemanticObjectMeshes(createChunkMeshRecord(anchor),anchor,semanticObjectRefs(anchor));
  assert.equal(record.meshes.filter(mesh=>mesh.userData.semanticRoof).length,1);
  const bounds=new Box3().setFromObject(record.group);
  assert(bounds.min.y>26.9 && bounds.max.y>=35 && bounds.max.y<35.1);
  assert(bounds.min.x>=-128.1 && bounds.max.x<=-14.9);
  assert.deepEqual(record.group.position,new Vector3(0,0,0)); // no double chunk translation
  const neighbor=chunk(-2,0,4,{},[roof]);
  const other=appendSemanticObjectMeshes(createChunkMeshRecord(neighbor),neighbor,semanticObjectRefs(neighbor));
  assert.equal(other.meshes.length,0); // only primary chunk owns render geometry
  record.geometries.forEach(g=>g.dispose()); record.materials.forEach(m=>m.dispose());
});

test("imported roofs and wall blocks are never automatically migrated into parcel-grid prisms", () => {
  assert.equal(shouldAdaptSemanticObjectToParcelGrid(roof),false);
  assert.equal(shouldAdaptSemanticObjectToParcelGrid({...roof,objectTypeId:"building_wall"}),false);
  assert.equal(shouldAdaptSemanticObjectToParcelGrid({...roof,objectTypeId:"parcel_grid_body"}),true);
  assert.equal(shouldAdaptBlockToParcelGrid("lod2_exterior_wall"),false);
  assert.equal(shouldAdaptBlockToParcelGrid("system_terrain"),true);
});

test("structure hints survive missing DGM stats; invalid coordinates do not enter the load queue", () => {
  const value=chunk(0,0,0,{structureStreaming:{schemaVersion:"structure-streaming.v1",chunkCoordinates:[
    {chunkX:1,chunkY:20,chunkZ:3},{chunkX:1.2,chunkY:0,chunkZ:0},null,{chunkX:"1",chunkY:0,chunkZ:0},
  ]}});
  const withoutStats={...value,stats:{...value.stats,minimumSurfaceY:undefined,maximumSurfaceY:undefined}};
  assert.deepEqual(additionalSurfaceChunkCoordinates([withoutStats],{chunkX:0,chunkY:0,chunkZ:0}),[{chunkX:1,chunkY:20,chunkZ:3}]);
});
