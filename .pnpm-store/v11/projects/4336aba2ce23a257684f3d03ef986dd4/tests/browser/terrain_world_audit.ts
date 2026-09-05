import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import frameFixture from '../fixtures/berlin_terrain_cut_cells.json';
import { normalizeChunkApiChunkResult } from '../../src/frontend/api/chunk_api_normalize';
import { createRuntimeChunkContent, sampleCellAtLocalCoordinates, type RuntimeChunkContent } from '../../src/frontend/runtime/world/chunk_content';
import { trimTerrainSurfaceCells } from '../../src/frontend/scene/terrain_surface_geometry';
import { createTerrainOsmOverlay } from '../../src/frontend/scene/terrain_osm_overlay';
import { raycastFromOriginDirection } from '../../src/frontend/targeting/raycast';
import type { ChunkMeshWorkerResult } from '../../src/frontend/render/chunk_mesh_worker_models';

document.body.style.cssText='margin:0;font:14px system-ui;background:#e9eef3';
document.body.innerHTML='<div id="host" style="position:relative;height:100vh"><div style="position:absolute;left:18px;top:18px;background:white;padding:15px;border-radius:10px;z-index:20"><strong>Berlin · tatsächliche Weltchunks</strong><p id="status">Terrain wird geladen …</p><button id="overview">Projektübersicht</button> <button id="detail">Geländesenke</button> <button id="mine">Oberflächenzelle abbauen</button><p id="result"></p></div></div>';
const host=document.querySelector<HTMLElement>('#host')!;
const status=document.querySelector<HTMLElement>('#status')!;
const result=document.querySelector<HTMLElement>('#result')!;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eef3');
scene.add(new THREE.HemisphereLight(0xffffff,0x73614f,2.5));
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(70,150,190);scene.add(light);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,3000);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(2,devicePixelRatio));host.prepend(renderer.domElement);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const controls=new OrbitControls(camera,renderer.domElement);controls.maxPolarAngle=Math.PI*.48;
const overview=()=>{camera.position.set(247,125,278);controls.target.set(72,0,72);controls.update();};overview();
document.querySelector('#overview')!.addEventListener('click',overview);
document.querySelector('#detail')!.addEventListener('click',()=>{camera.position.set(184,13,191);controls.target.set(167,-.5,168);controls.update();});
const chunks=new Map<string,RuntimeChunkContent>();
const groups=new Map<string,{group:THREE.Group;meshes:THREE.Mesh[]}>();
const worker=new Worker('./terrain-mesher.js',{type:'module'});
let workerId=0;
const pending=new Map<number,(result:ChunkMeshWorkerResult)=>void>();
worker.onmessage=event=>{const message=event.data;pending.get(message.id)?.(message.result);pending.delete(message.id);};
const osm=createTerrainOsmOverlay({host,getFrame:()=>frameFixture.earthGrid,getCamera:()=>camera,getMeshes:()=>[...groups.values()].flatMap(group=>group.meshes)});
const material=new THREE.MeshStandardMaterial({color:0xb5c59a,roughness:1});

async function rebuild(chunk:RuntimeChunkContent):Promise<void>{
  const cut=trimTerrainSurfaceCells(chunk),size=chunk.chunkSize;
  const id=++workerId;
  const buffers=await new Promise<ChunkMeshWorkerResult>(resolve=>{
    pending.set(id,resolve);
    worker.postMessage({id,chunk:{chunkKey:chunk.chunkKey,chunkX:chunk.chunkX,chunkY:chunk.chunkY,chunkZ:chunk.chunkZ,
      chunkSize:size,cellSize:1,cells:Int32Array.from(cut.chunk.cells),boundaries:{negativeX:new Uint8Array(size*size),positiveX:new Uint8Array(size*size),negativeY:new Uint8Array(size*size),positiveY:new Uint8Array(size*size),negativeZ:new Uint8Array(size*size),positiveZ:new Uint8Array(size*size)}}});
  });
  const group=new THREE.Group(),meshes:THREE.Mesh[]=[];
  const add=(geometry:THREE.BufferGeometry)=>{const mesh=new THREE.Mesh(geometry,material);meshes.push(mesh);group.add(mesh);};
  for(const surface of cut.surfaces)add(surface.geometry);
  for(const buffer of buffers.buffers){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(buffer.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(buffer.normals,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(buffer.uvs,2));geometry.setIndex(new THREE.BufferAttribute(buffer.indices,1));add(geometry);
  }
  const old=groups.get(chunk.chunkKey);
  const before=old?.meshes.flatMap(mesh=>mesh.children).length??0;
  if(old){scene.remove(old.group);for(const mesh of old.meshes)mesh.geometry.dispose();}
  scene.add(group);groups.set(chunk.chunkKey,{group,meshes});osm.update();
  if(old){const after=meshes.flatMap(mesh=>mesh.children).length;host.dataset.remeshMapPreserved=String(before>0&&after>0);}
}

document.querySelector('#mine')!.addEventListener('click',async()=>{
  const hit=raycastFromOriginDirection({origin:{x:164.5,y:15,z:164.5},direction:{x:0,y:-1,z:0},chunkSize:16,
    sampler:(_,address)=>{const chunk=chunks.get(address.chunkKey);return chunk?sampleCellAtLocalCoordinates(chunk,address):null;},
    options:{maxDistance:32,maxSteps:64,stepSize:.1}});
  if(!hit.hit||!hit.sourceCell){result.textContent='Keine Oberfläche getroffen';return;}
  const address=hit.sourceCell,chunk=chunks.get(address.chunkKey)!;
  const index=address.localX+16*(address.localY+16*address.localZ);
  const updated={...chunk,cells:chunk.cells.map((value,i)=>i===index?0:value)};
  chunks.set(chunk.chunkKey,updated);
  await rebuild(updated);
  result.textContent=`Zelle (${address.worldX}, ${address.worldY}, ${address.worldZ}) abgebaut · Karte beim Remesh erhalten: ${host.dataset.remeshMapPreserved}`;
});

async function load(){
  const raw=await(await fetch('./terrain-world-route.json')).json();
  let minimum=Infinity,maximum=-Infinity;
  for(const body of raw){
    const normalized=normalizeChunkApiChunkResult({ok:true,chunk:body});
    if(!normalized.ok)throw new Error(JSON.stringify(normalized));
    const chunk=createRuntimeChunkContent(normalized.chunk);chunks.set(chunk.chunkKey,chunk);
    const heights=(chunk.raw.metadata.terrainSurface as any)?.cornerHeights??[];
    for(const height of heights){minimum=Math.min(minimum,height);maximum=Math.max(maximum,height);}
  }
  for(const chunk of chunks.values())await rebuild(chunk);
  host.dataset.chunkCount=String(chunks.size);host.dataset.minimumHeight=String(minimum);host.dataset.maximumHeight=String(maximum);
  status.textContent=`${chunks.size} Weltchunks · 208 × 208 m · Höhen ${minimum.toFixed(2)} bis ${maximum.toFixed(2)} m · Maßstab 1:1`;
}
void load().catch(error=>{status.textContent=String(error);});
renderer.setAnimationLoop(()=>{controls.update();osm.update();renderer.render(scene,camera);});
