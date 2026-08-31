import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { normalizeChunkApiBatchResult } from '../src/frontend/api/chunk_api_normalize';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';
import {
  lod2BuildingBoundaryGrid,
  lod2FacadeVerticalIntervals,
  trimLod2WallCaps,
  type BuildingBoundaryEdge,
} from '../src/frontend/scene/lod2_wall_caps';
import { createRoofCalculationMeshes } from '../src/frontend/scene/roof_calculation_rendering';
import { createRoofSurfaceHighlight, roofSurfaceMarker, roofSurfaceTriangles, heightOnRoof } from '../src/frontend/scene/roof_surface_geometry';

function roof(points:number[][]) {return {ok:true,geometry:{faces:[{polygon_3d_mm:points.map(([x,y,z])=>[x!*1000,z!*1000,y!*1000])}]}};}
function facade(calculation:unknown,start:[number,number],end:[number,number],minimumY:number,maximumY:number) {
  const length=Math.hypot(end[0]-start[0],end[1]-start[1]);
  return {buildingId:`facade-${start.join('-')}-${end.join('-')}`,calculation,facadeSegments:[{
    start,end,minimumY,maximumY,topProfile:[[0,maximumY],[length,maximumY]],
    bottomProfile:[[0,minimumY],[length,minimumY]],
  }]};
}
function wall(cells:number[]) {
  const result=normalizeChunkApiBatchResult({ok:true,chunks:[{chunk:{projectId:'test',worldId:'test',chunkX:0,chunkY:0,chunkZ:0,
    chunkKey:'0:0:0',chunkSize:16,cellSize:1,cells,palette:[{blockTypeId:'lod2_exterior_wall',solid:true,breakable:true,placeable:true}],objectRefs:[]}}]},null,{projectId:'test',worldId:'test'});
  assert(result.ok);return createRuntimeChunkContent(result.chunks[0]!);
}

test('top wall cell follows the exact clipped LoD2 roof instead of extrapolating a full-cell wedge',()=>{
  const cells=Array(4096).fill(0);cells[0]=1;
  const source=wall(cells),before=[...source.cells];
  const caps=trimLod2WallCaps(source,[roof([[.2,.7,.2],[.8,.7,.2],[.8,.7,.8],[.2,.7,.8]])]);
  assert.deepEqual(caps.cappedCellIndices,[0]);assert.equal(caps.chunk.cells[0],0);
  assert.deepEqual([...source.cells],before);
  assert(caps.geometry);const b=caps.geometry.boundingBox!;
  assert(Math.abs(b.max.y-.7)<1e-6);assert(Math.abs(b.min.x-.2)<1e-6);assert(Math.abs(b.max.x-.8)<1e-6);
  assert(Math.abs(b.min.z-.2)<1e-6);assert(Math.abs(b.max.z-.8)<1e-6);caps.geometry.dispose();
});
test('sloping cap follows the real plane and stays inside its original block',()=>{
  const cells=Array(4096).fill(0);cells[0]=1;
  const caps=trimLod2WallCaps(wall(cells),[roof([[0,.4,0],[1,.9,0],[1,.9,1],[0,.4,1]])]);
  assert(caps.geometry);const p=caps.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++)assert(p.getY(i)<=.4+.5*p.getX(i)+1e-6);
  assert(caps.geometry.boundingBox!.max.y<1);caps.geometry.dispose();
});
test('ordinary LoD2 facade cells keep full block depth but render in the building-owned grid',()=>{
  const cells=Array(4096).fill(0);cells[0]=1;cells[16]=1;cells[32]=1;
  const calculation=roof([[.2,2.7,.2],[.8,2.7,.2],[.8,2.7,.8],[.2,2.7,.8]]);
  const exactFacade=facade(calculation,[.2,.2],[.8,.2],0,2.7);
  const source=wall(cells),before=[...source.cells];
  const caps=trimLod2WallCaps(source,[exactFacade]);
  assert.deepEqual(caps.cappedCellIndices,[32]);
  assert.deepEqual(caps.alignedCellIndices,[0,16]);
  assert.equal(caps.chunk.cells[0],0);assert.equal(caps.chunk.cells[16],0);
  assert.deepEqual([...source.cells],before);
  assert(caps.geometry);
  const bounds=caps.geometry.boundingBox!;
  assert.equal(bounds.min.y,0);assert(Math.abs(bounds.max.y-2.7)<1e-6);
  caps.geometry.dispose();
  cells[16]=0;
  const broken=trimLod2WallCaps(wall(cells),[exactFacade]);
  assert.deepEqual(broken.cappedCellIndices,[32]);
  assert.deepEqual(broken.alignedCellIndices,[0]);
  assert(broken.geometry);
  const p=broken.geometry.getAttribute('position');
  for(let i=0;i<p.count;i+=3) {
    const ys=[p.getY(i),p.getY(i+1),p.getY(i+2)];
    assert(Math.max(...ys)<=1 || Math.min(...ys)>=2,'no triangle may bridge the removed middle block');
  }
  broken.geometry.dispose();
});
test('the final wall block is projected vertically from the exact eave and never protrudes outside it',()=>{
  const cells=Array(4096).fill(0);cells[0]=1;cells[16]=1;cells[32]=1;
  const calculation=roof([[.25,2.55,.2],[4.25,2.55,.2],[4.25,3.4,2.2],[.25,3.4,2.2]]);
  const source={buildingId:'facade-a',calculation,facadeSegments:[{
    start:[.25,.2],end:[4.25,.2],minimumY:0,maximumY:2.55,
  }]};
  const result=trimLod2WallCaps(wall(cells),[source]);
  assert.deepEqual(result.alignedCellIndices,[0,16]);
  assert.deepEqual(result.cappedCellIndices,[32]);
  assert(result.geometry);
  const positions=result.geometry.getAttribute('position');
  for(let index=0;index<positions.count;index++){
    assert(positions.getZ(index)>=.2-1e-6,'no wall triangle may cross the exterior eave line');
    assert(positions.getZ(index)<=1.2+1e-6,'the facade-owned wall remains exactly one full block deep');
  }
  assert(Math.abs(result.geometry.boundingBox!.min.x-.25)<1e-6);
  assert(result.geometry.boundingBox!.max.x<=1.25+1e-6,'the source world cell is replaced by one facade column');
  result.geometry.dispose();
});
test('an isolated aligned facade block is a closed solid and never exposes comb-like wall holes',()=>{
  const cells=Array(4096).fill(0);cells[0]=1;
  const calculation=roof([[0,3,0],[4,3,0],[4,3,4],[0,3,4]]);
  const caps=trimLod2WallCaps(wall(cells),[facade(calculation,[0,0],[4,0],0,3)]);
  assert.deepEqual(caps.alignedCellIndices,[0]);assert(caps.geometry);
  const positions=caps.geometry.getAttribute('position');
  assert.equal(positions.count,36,'a closed rectangular prism consists of twelve triangles');
  const edgeCounts=new Map<string,number>();
  const vertex=(index:number)=>[positions.getX(index),positions.getY(index),positions.getZ(index)]
    .map(value=>value.toFixed(6)).join(':');
  for(let index=0;index<positions.count;index+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]){
    const key=[vertex(index+a!),vertex(index+b!)].sort().join('|');
    edgeCounts.set(key,(edgeCounts.get(key)??0)+1);
  }
  assert([...edgeCounts.values()].every(count=>count===2),'every facade edge must belong to exactly two triangles');
  caps.geometry.dispose();
});
test('touching profile pieces use one deterministic wall-cell owner across a chunk border',()=>{
  const edge:BuildingBoundaryEdge={buildingId:'owner-border',edgeKey:'test',start:[14.985,-59.817],end:[16.227,-58.849],
    inward:[-.6147,.7887],length:1.5746707592382634,divisions:2,columnWidth:.7873353796191317,
    minimumY:1,maximumY:20.197536,topProfile:[[0,20.197536],[.787336,19.600919],[1.181003,19.302543],[1.574671,19.004133]],
    bottomProfile:[[0,1],[1.574671,1]],facadeRole:'exterior',exactFacade:true};
  assert.deepEqual(lod2FacadeVerticalIntervals(edge,1,10),[[.787336,1.5746707592382634]],
    'profile knots may not split one real wall strip into competing owner cells');
});
test('breaking a cap or an upper wall block never recreates its cells or extends the wall',()=>{
  const cells=Array(4096).fill(0);cells[0]=1;
  const calculation=roof([[0,1.8,0],[1,1.8,0],[1,1.8,1],[0,1.8,1]]);
  const exactFacade=facade(calculation,[0,0],[1,0],0,1.8);
  const aligned=trimLod2WallCaps(wall(cells),[exactFacade]);
  assert.deepEqual(aligned.alignedCellIndices,[0]);assert(aligned.geometry);aligned.geometry.dispose();
  cells[0]=0;assert.equal(trimLod2WallCaps(wall(cells),[exactFacade]).geometry,null);
});
test('a centimetre-high roof junction remains a finite closed cap without an artificial gap',()=>{
  const cells=Array(4096).fill(0);cells[16]=1;
  const source=wall(cells);
  const capped=trimLod2WallCaps(source,[roof([[0,1.01,0],[1,1.01,0],[1,1.01,1],[0,1.01,1]])]);
  assert.deepEqual(capped.cappedCellIndices,[16]);assert(capped.geometry);
  const bounds=capped.geometry.boundingBox!;
  assert(Number.isFinite(bounds.min.y)&&Number.isFinite(bounds.max.y));
  assert(Math.abs(bounds.min.y-1)<1e-6&&Math.abs(bounds.max.y-1.01)<1e-6);
  assert.equal(capped.chunk.cells[16],0);assert.equal(source.cells[16],1);
  capped.geometry.dispose();
});
test('roof selection uses true facet heights and keeps a courtyard empty',()=>{
  const calculation=roof([[2,20,0],[4,22,0],[4,22,4]]);
  const triangles=roofSurfaceTriangles(calculation),marker=roofSurfaceMarker(triangles)!;
  assert(marker.y>20 && marker.y<22);
  assert.equal(heightOnRoof(triangles,0,0),null);
  assert(Math.abs(heightOnRoof(triangles,marker.x,marker.z)!-marker.y)<1e-6);
  const group=createRoofSurfaceHighlight(calculation)!;
  const bounds=new THREE.Box3().setFromObject(group);
  assert(bounds.min.y>20 && bounds.max.y>22);
  assert(group.children.every(child=>(child as THREE.Mesh).material && ((child as THREE.Mesh).material as THREE.Material).depthTest));
  group.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();const material=m.material;if(material&&!Array.isArray(material))material.dispose();});
});

test('a concave imported roof is triangulated without filling its courtyard and remains a closed solid',()=>{
  const ring=[[0,0],[4,0],[4,4],[3,4],[3,1],[1,1],[1,4],[0,4],[0,0]];
  const calculation={ok:true,geometry:{faces:[{face_ref:'u-roof',polygon_3d_mm:ring.map(([x,z])=>[x!*1000,z!*1000,3000])}]},
    roof_build_up:{layers:[{role:'roof_tile',thickness_mm:20}]}};
  const roof=createRoofCalculationMeshes(calculation,{mergeParts:false});
  assert.equal(roof.meshes.length,1);const geometry=roof.geometries[0]!;
  const position=geometry.getAttribute('position'),indices=geometry.index!;
  assert.equal(position.count,16,'the repeated closing vertex is removed on top and bottom');
  let topArea=0;
  for(let offset=0;offset<indices.count;offset+=3){
    const triangle=[indices.getX(offset),indices.getX(offset+1),indices.getX(offset+2)];
    if(!triangle.every(index=>index<8))continue;
    const [a,b,c]=triangle.map(index=>[position.getX(index),position.getZ(index)]);
    topArea+=Math.abs((b![0]-a![0])*(c![1]-a![1])-(c![0]-a![0])*(b![1]-a![1]))/2;
    const centroid=[(a![0]+b![0]+c![0])/3,(a![1]+b![1]+c![1])/3];
    assert(!(centroid[0]>1&&centroid[0]<3&&centroid[1]>1&&centroid[1]<4),
      'no roof triangle may bridge the open courtyard');
  }
  assert(Math.abs(topArea-10)<1e-6,'the top triangles cover exactly the U-shaped roof area');
  roof.geometries.forEach(value=>value.dispose());roof.materials.forEach(value=>value.dispose());
});

test('building facade grid cancels ridges and divides rotated exterior dimensions without a residual stair step',()=>{
  const angle=27*Math.PI/180,u:[number,number]=[Math.cos(angle),Math.sin(angle)],v:[number,number]=[-u[1],u[0]];
  const at=(x:number,z:number,y=8)=>[4+u[0]*x+v[0]*z,y,7+u[1]*x+v[1]*z];
  const source={buildingId:'lod2-a',calculation:{geometry:{faces:[
    {polygon_3d_mm:[at(0,0),at(10.4,0),at(10.4,6.2)].map(([x,y,z])=>[x*1000,z*1000,y*1000])},
    {polygon_3d_mm:[at(0,0),at(10.4,6.2),at(0,6.2)].map(([x,y,z])=>[x*1000,z*1000,y*1000])},
  ]}}};
  const edges=lod2BuildingBoundaryGrid([source]);
  assert.equal(edges.length,4,'the shared roof diagonal is not a facade');
  const long=edges.sort((a,b)=>b.length-a.length)[0]!;
  assert(Math.abs(long.length-10.4)<1e-6);assert.equal(long.divisions,10);assert(Math.abs(long.columnWidth-1.04)<1e-6);
});

test('a world-grid wall cell beyond a LoD2 corner is absorbed by the finite building edge',()=>{
  const cells=Array(4096).fill(0);cells[0]=1;cells[257]=1;
  const calculation=roof([[1,3,1],[5,3,1],[5,3,5],[1,3,5]]);
  const caps=trimLod2WallCaps(wall(cells),[facade(calculation,[1,1],[5,1],0,3)]);
  assert.deepEqual(caps.alignedCellIndices,[257]);
  assert(caps.cappedCellIndices.includes(0),'the zero-area corner-touching stair voxel is removed');
  assert.equal(caps.chunk.cells[0],0);
  assert(caps.geometry);
  const bounds=caps.geometry.boundingBox!;
  assert(bounds.min.x>=1-1e-6&&bounds.min.z>=1-1e-6,'replacement facade must not protrude beyond the LoD2 corner');
  caps.geometry.dispose();
});
