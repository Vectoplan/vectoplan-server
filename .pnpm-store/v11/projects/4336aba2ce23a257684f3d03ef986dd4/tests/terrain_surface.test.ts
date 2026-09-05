import assert from 'node:assert/strict';
import test from 'node:test';
import type { RuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';
import { sampleCellAtLocalCoordinates } from '../src/frontend/runtime/world/chunk_content';
import { terrainCellShape, terrainCellTriangles, terrainHeightAt, terrainBlockingBounds, intersectTerrainCell, type TerrainCellShape } from '../src/frontend/runtime/world/terrain_surface';
import { trimTerrainSurfaceCells } from '../src/frontend/scene/terrain_surface_geometry';
import { raycastFromOriginDirection } from '../src/frontend/targeting/raycast';
import { createTerrainOsmOverlay, osmGeometryUvs, osmTilePoint, osmWorldTilePoint, TERRAIN_OSM_ZOOM } from '../src/frontend/scene/terrain_osm_overlay';
import * as THREE from 'three';
import berlin from './fixtures/berlin_terrain_cut_cells.json';
import { createBlockCollisionQuery } from '../src/frontend/runtime/physics/block_collision_query';

function chunkFixture(): RuntimeChunkContent {
  const size=4,cells=Array(size**3).fill(0);
  for(let z=0;z<size;z++)for(let y=0;y<3;y++)for(let x=0;x<size;x++)cells[x+size*(y+size*z)]=1;
  const entry={blockTypeId:'system_terrain_humus',cellValue:1,solid:true,breakable:true,placeable:true,paletteIndex:0,metadata:{}};
  return {chunkKey:'0:0:0',chunkX:0,chunkY:0,chunkZ:0,chunkSize:size,cellSize:1,cells,palette:[entry],
    paletteByCellValue:new Map([[1,entry]]),raw:{metadata:{terrainSurface:{schemaVersion:'terrain-cut-cells.v1',cornerHeights:Array.from({length:25},(_,i)=>2.2+(i%5)*.1)}}}} as unknown as RuntimeChunkContent;
}
const shape:TerrainCellShape={x:0,y:0,z:0,heights:[.2,.8,.8,.2]};

test('cut terrain closes a wedge with the exact continuous volume',()=>{
  let volume=0;
  for(const {points:[a,b,c]} of terrainCellTriangles(shape)) {
    for(const p of [a,b,c])assert.ok(p.y>=0&&p.y<=1);
    volume+=(a.x*(b.y*c.z-b.z*c.y)+a.y*(b.z*c.x-b.x*c.z)+a.z*(b.x*c.y-b.y*c.x))/6;
  }
  assert.ok(Math.abs(volume-.5)<1e-6);
});

test('surface crossing a block boundary is clipped at the true slope, without a staircase',()=>{
  const crossing:TerrainCellShape={...shape,heights:[.5,1.5,1.5,.5]};
  const triangles=terrainCellTriangles(crossing);
  assert.ok(triangles.some(t=>t.points.some(p=>p.x===.5&&p.y===1)));
  assert.ok(triangles.every(t=>t.points.every(p=>p.y<=1)));
  const low=intersectTerrainCell(crossing,{x:.25,y:3,z:.5},{x:0,y:-1,z:0},0,10);
  assert.ok(low);assert.ok(Math.abs(low.distance-2.25)<1e-6);
});

test('steep terrain crossing several cell floors has no self-intersecting side fins',()=>{
  for(const heights of [[-3,2,2,-3],[2,-3,-3,2],[-3,-3,2,2],[2,2,-3,-3]] as [number,number,number,number][]){
    for(let y=-3;y<2;y++){
      const steep={x:0,y,z:0,heights};
      for(const triangle of terrainCellTriangles(steep)){
        for(const weights of [[1/3,1/3,1/3],[.1,.8,.1],[.8,.1,.1],[.1,.1,.8]]){
          const point=triangle.points.reduce((p,v,i)=>({x:p.x+v.x*weights[i],y:p.y+v.y*weights[i],z:p.z+v.z*weights[i]}),{x:0,y:0,z:0});
          assert.ok(point.y<=terrainHeightAt(steep,point.x,point.z)+1e-6,JSON.stringify({steep,point,triangle}));
          assert.ok(point.y>=y-1e-6&&point.y<=y+1+1e-6);
        }
      }
    }
  }
});

test('picking hits the visible slope and skips the empty part of the routing cube',()=>{
  const hit=intersectTerrainCell(shape,{x:.5,y:2,z:.5},{x:0,y:-1,z:0},0,10);
  assert.ok(hit);assert.ok(Math.abs(hit.distance-1.5)<1e-6);assert.ok(hit.normal.y>0);
  assert.equal(intersectTerrainCell(shape,{x:-1,y:.9,z:.5},{x:1,y:0,z:0},0,10),null);
});

test('physics contact follows the player footprint instead of the entire cube height',()=>{
  const bounds=terrainBlockingBounds(shape,{min:{x:.1,y:0,z:.1},max:{x:.3,y:2,z:.6}});
  assert.ok(bounds);assert.ok(Math.abs(bounds.max.y-.38)<1e-6);
});

test('shared collision query permits the empty portion above a cut cell',()=>{
  const query=createBlockCollisionQuery({
    getCollisionCell:cell=>({kind:cell.x===0&&cell.y===0&&cell.z===0?'solid':'air',loaded:true,solid:cell.x===0&&cell.y===0&&cell.z===0}),
    getBlockingBounds:(_,bounds)=>terrainBlockingBounds(shape,bounds),
  });
  assert.equal(query.getBlockingBlockAabbsForAabb({min:{x:.1,y:.5,z:.1},max:{x:.3,y:1.8,z:.6}}).collides,false);
  const contact=query.getBlockingBlockAabbsForAabb({min:{x:.1,y:.2,z:.1},max:{x:.3,y:1.8,z:.6}});
  assert.equal(contact.collides,true);assert.ok(Math.abs(contact.blockingAabbs[0].max.y-.38)<1e-6);
});

test('only the terrain surface is cut; mining removes it and reveals regular blocks',()=>{
  const chunk=chunkFixture();
  assert.equal(terrainCellShape(chunk,0,1,0),null);
  assert.ok(terrainCellShape(chunk,0,2,0));
  const built=trimTerrainSurfaceCells(chunk);
  assert.equal(built.chunk.cells[8],0);assert.equal(built.chunk.cells[4],1);
  assert.ok(built.surfaces.length>0);
  const removed={...chunk,cells:chunk.cells.map((v,i)=>i===8?0:v)};
  assert.equal(terrainCellShape(removed,0,2,0),null);
  assert.equal(terrainCellShape(removed,0,1,0),null);
  for(const part of built.surfaces)part.geometry.dispose();
});

test('DDA uses exact cut geometry for both workspace camera rays',()=>{
  const chunk=chunkFixture();
  const hit=raycastFromOriginDirection({origin:{x:.5,y:3.5,z:.5},direction:{x:0,y:-1,z:0},chunkSize:4,
    sampler:(_,address)=>sampleCellAtLocalCoordinates(chunk,address),options:{maxDistance:4,maxSteps:32,stepSize:.1}});
  assert.ok(hit.hit);assert.equal(hit.sourceCell?.worldY,2);
  assert.ok(Math.abs(hit.position!.y-2.25)<1e-6);
});

test('explicitly placed terrain blocks stay full cubes after snapshot reload',()=>{
  const chunk=chunkFixture();
  const updated={...chunk,source:'snapshot',raw:{...chunk.raw,metadata:{terrainSurface:{...chunk.raw.metadata.terrainSurface as object,fullCellIndices:[8]}}}} as RuntimeChunkContent;
  assert.equal(terrainCellShape(updated,0,2,0),null);
  assert.ok(terrainCellShape(updated,1,2,0));
});

test('OSM raster coordinates preserve north/south and east/west orientation',()=>{
  assert.deepEqual(osmTilePoint(0,0,0),[.5,.5]);
  const berlin=osmTilePoint(13.4,52.52,16),east=osmTilePoint(13.41,52.52,16),north=osmTilePoint(13.4,52.53,16);
  assert.ok(east[0]>berlin[0]);assert.ok(north[1]<berlin[1]);
});

test('OSM UVs retain centimetre detail at Berlin latitude and agree at chunk seams',()=>{
  const frame=berlin.earthGrid;
  const point=osmWorldTilePoint(0,0,frame);
  const origin:[number,number]=[Math.floor(point[0]),Math.floor(point[1])];
  const a=new THREE.BufferGeometry();
  a.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.01,0,.01,16,0,16],3));
  const uv=osmGeometryUvs(a,new THREE.Matrix4(),frame,origin);
  assert.ok(uv[2]>uv[0]);assert.ok(uv[3]<uv[1]);
  const exact=osmWorldTilePoint(.01,.01,frame);
  assert.ok(Math.abs((uv[2]-(exact[0]-origin[0]))*256)<.0001);
  assert.ok(Math.abs((uv[3]-(exact[1]-origin[1]))*256)<.0001);
  const neighbour=new THREE.BufferGeometry();
  neighbour.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3));
  const adjacent=osmGeometryUvs(neighbour,new THREE.Matrix4().makeTranslation(16,0,16),frame,origin);
  assert.deepEqual(Array.from(adjacent),Array.from(uv.slice(4)));
  assert.equal(TERRAIN_OSM_ZOOM,19);
  a.dispose();neighbour.dispose();
});

test('OSM retains tile material and world UVs through camera changes and immediate chunk replacement',()=>{
  const elements:any[]=[],images:any[]=[];
  const original={document:globalThis.document,window:globalThis.window,Image:globalThis.Image};
  class Element {
    style:any={};dataset:any={};children:any[]=[];listeners=new Map<string,Function>();checked=false;
    constructor(readonly tag:string){elements.push(this);}
    append(...children:any[]){this.children.push(...children);}
    setAttribute(){} addEventListener(name:string,fn:Function){this.listeners.set(name,fn);} remove(){}
  }
  class FakeImage { onload:Function|null=null;onerror:Function|null=null;src='';constructor(){images.push(this);} }
  Object.assign(globalThis,{document:{createElement:(tag:string)=>new Element(tag),createTextNode:(text:string)=>text},
    window:{setTimeout,clearTimeout},Image:FakeImage});
  let overlay:ReturnType<typeof createTerrainOsmOverlay>|undefined;
  try {
    const parent=new THREE.Group();
    const make=()=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(16,1,16));mesh.position.set(8,.5,8);parent.add(mesh);return mesh;};
    let source=make(),meshes=[source];
    const camera=new THREE.PerspectiveCamera(55,1,.1,2000);camera.position.set(8,45,40);camera.lookAt(8,0,8);
    overlay=createTerrainOsmOverlay({host:new Element('host') as any,getFrame:()=>berlin.earthGrid,getCamera:()=>camera,getMeshes:()=>meshes});
    const checkbox=elements.find(e=>e.tag==='input');
    assert.equal(images.length,0); // No background/bulk requests while disabled.
    checkbox.checked=true;checkbox.listeners.get('change')();
    assert.ok(images.length>0&&images.length<=4);
    for(const image of images)image.onload?.();
    assert.ok(source.children.length>0);
    const first=source.children[0] as THREE.Mesh;
    const material=first.material;
    const uvs=Array.from(first.geometry.getAttribute('uv').array);
    const requestCount=images.length;
    camera.position.set(17,70,80);camera.lookAt(8,0,8);overlay.update();
    assert.equal((source.children[0] as THREE.Mesh).material,material);
    parent.remove(source);const previous=source;source=make();meshes=[source];
    overlay.update(); // No elapsed 250-ms/1-s timer and no network response.
    assert.equal(previous.children.length,0);
    assert.ok(source.children.length>0);
    assert.equal((source.children[0] as THREE.Mesh).material,material);
    assert.deepEqual(Array.from((source.children[0] as THREE.Mesh).geometry.getAttribute('uv').array),uvs);
    assert.equal(images.length,requestCount);
    assert.ok(images.every(image=>image.src.includes('/19/')));
    for(const image of images)image.onload?.();
  } finally {
    overlay?.destroy();for(const image of images)image.onerror?.();Object.assign(globalThis,original);
  }
});
