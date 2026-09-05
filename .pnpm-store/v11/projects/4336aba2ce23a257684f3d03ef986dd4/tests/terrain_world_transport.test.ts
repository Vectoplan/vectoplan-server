// Explicit live integration check: bundle for Node and pass the route export path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeChunkApiChunkResult } from '../src/frontend/api/chunk_api_normalize';
import { createRuntimeChunkContent, sampleCellAtLocalCoordinates } from '../src/frontend/runtime/world/chunk_content';
import { trimTerrainSurfaceCells } from '../src/frontend/scene/terrain_surface_geometry';
import { raycastFromOriginDirection } from '../src/frontend/targeting/raycast';
const raw=JSON.parse(readFileSync(process.argv[2],'utf8')) as any[];
const chunks=raw.map(chunk=>{
  const normalized=normalizeChunkApiChunkResult({ok:true,chunk});
  assert.equal(normalized.ok,true);
  if(!normalized.ok)throw new Error(JSON.stringify(normalized));
  return createRuntimeChunkContent(normalized.chunk);
});
const byKey=new Map(chunks.map(chunk=>[chunk.chunkKey,chunk]));

test('actual Berlin World route survives HTTP normalization and builds measured fractional terrain',()=>{
  assert.ok(chunks.length>=169,'expected the real contiguous project area, including lower chunks');
  let lowest=Infinity,highest=-Infinity,cutCount=0;
  for(const chunk of chunks){
    const surface=chunk.raw.metadata.terrainSurface as any;
    assert.equal(surface?.sampleStepM,1,chunk.chunkKey);
    assert.equal(surface.cornerHeights.length,289);
    const result=trimTerrainSurfaceCells(chunk);
    for(const part of result.surfaces){
      cutCount++;const position=part.geometry.getAttribute('position');
      for(let i=0;i<position.count;i++){
        const y=position.getY(i);
        assert.ok(y>=chunk.chunkY*16-1e-5&&y<=(chunk.chunkY+1)*16+1e-5);
        if(Math.abs(y-Math.round(y))>1e-4){lowest=Math.min(lowest,y);highest=Math.max(highest,y);}
      }
      part.geometry.dispose();
    }
  }
  assert.ok(cutCount>100);
  assert.ok(lowest<-3,'1-m DGM depression must survive route and renderer');
  assert.ok(highest>2,'actual DGM rise must survive route and renderer');
  console.log(JSON.stringify({chunks:chunks.length,cutMeshes:cutCount,lowest,highest}));
});

test('both camera modes can target the actual negative-height terrain layer',()=>{
  let foundBelowZero=false;
  for(let z=160;z<176&&!foundBelowZero;z++)for(let x=160;x<176&&!foundBelowZero;x++){
    const hit=raycastFromOriginDirection({origin:{x:x+.5,y:15,z:z+.5},direction:{x:0,y:-1,z:0},chunkSize:16,
      sampler:(_,address)=>{
        const chunk=byKey.get(address.chunkKey);
        return chunk?sampleCellAtLocalCoordinates(chunk,address):null;
      },options:{maxDistance:32,maxSteps:64,stepSize:.1}});
    if(hit.hit&&hit.position!.y<0){assert.ok(hit.sourceCell!.worldY<0);foundBelowZero=true;}
  }
  assert.ok(foundBelowZero,'surface chunk y=-1 must be present and pickable');
});

test('real DGM chunks share exactly the same height samples on every horizontal seam',()=>{
  let checked=0;
  for(const chunk of chunks){
    if(chunk.chunkY!==0)continue;
    const current=(chunk.raw.metadata.terrainSurface as any)?.cornerHeights;
    assert.ok(current,chunk.chunkKey);
    for(const [dx,dz] of [[1,0],[0,1]]){
      const neighbour=byKey.get(`${chunk.chunkX+dx}:0:${chunk.chunkZ+dz}`);
      if(!neighbour)continue;
      const next=(neighbour.raw.metadata.terrainSurface as any)?.cornerHeights;
      assert.ok(next,neighbour.chunkKey);
      for(let i=0;i<=16;i++)assert.equal(current[dx?16+17*i:i+17*16],next[dx?17*i:i],`${chunk.chunkKey} -> ${neighbour.chunkKey}, corner ${i}`);
      checked++;
    }
  }
  assert.ok(checked>250);
});
