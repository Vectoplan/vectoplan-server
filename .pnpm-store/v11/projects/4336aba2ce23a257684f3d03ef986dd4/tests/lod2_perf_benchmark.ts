// Read-only geometry benchmark using the normal persisted-data export.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { normalizeChunkApiBatchResult } from '../src/frontend/api/chunk_api_normalize';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';
import { semanticObjectRefs } from '../src/frontend/scene/scene_runtime';
import { trimLod2WallCaps } from '../src/frontend/scene/lod2_wall_caps';
import { createRoofCalculationMeshes } from '../src/frontend/scene/roof_calculation_rendering';

const file=process.argv[2];
if(!file)throw Error('Pass the persisted streaming-data.json export');
const wire=JSON.parse(readFileSync(file,'utf8'));
const result=normalizeChunkApiBatchResult(wire,null,{projectId:wire.projectId,worldId:wire.worldId});
if(!result.ok)throw Error('Invalid export');
const chunks=result.chunks.map(c=>createRuntimeChunkContent(c));
const roofs=[...new Map(chunks.flatMap(c=>semanticObjectRefs(c)).map(r=>[r.objectInstanceId,r])).values()].map(r=>r.metadata.roofCalculation);
const occupied=new Set<string>();
chunks.forEach(c=>c.cells.forEach((v,i)=>{if(v>0)occupied.add(`${c.chunkX*16+i%16}:${c.chunkY*16+Math.floor(i/16)%16}:${c.chunkZ*16+Math.floor(i/256)}`);}));
const rounds=[];
let roofDrawsBefore=0,roofDrawsAfter=0;
for(const roof of roofs){
  const before=createRoofCalculationMeshes(roof,{mergeParts:false}),after=createRoofCalculationMeshes(roof);
  roofDrawsBefore+=before.meshes.length;roofDrawsAfter+=after.meshes.length;
  for(const result of [before,after]){result.geometries.forEach(g=>g.dispose());result.materials.forEach(m=>m.dispose());}
}
for(let round=0;round<3;round++) {
  let cells=0,triangles=0,maxChunkMs=0;
  const start=performance.now();
  for(const chunk of chunks) {
    const at=performance.now();
    const caps=trimLod2WallCaps(chunk,roofs,(x,y,z)=>occupied.has(`${x}:${y}:${z}`));
    maxChunkMs=Math.max(maxChunkMs,performance.now()-at);
    cells+=caps.cappedCellIndices.length;
    triangles+=(caps.geometry?.getAttribute('position').count??0)/3;
    caps.geometry?.dispose();
  }
  rounds.push({totalMs:Math.round(performance.now()-start),maxChunkMs:Math.round(maxChunkMs*10)/10,cells,triangles});
}
console.log(JSON.stringify({chunks:chunks.length,roofs:roofs.length,roofDrawsBefore,roofDrawsAfter,rounds},null,2));
