import * as THREE from 'three';
import fixture from '../fixtures/berlin_terrain_cut_cells.json';
import { trimTerrainSurfaceCells } from '../../src/frontend/scene/terrain_surface_geometry';
import { createTerrainOsmOverlay } from '../../src/frontend/scene/terrain_osm_overlay';
import { raycastFromOriginDirection } from '../../src/frontend/targeting/raycast';
import { sampleCellAtLocalCoordinates } from '../../src/frontend/runtime/world/chunk_content';

document.body.style.cssText='margin:0;font:14px system-ui;background:#e9eef3';
document.body.innerHTML='<div id="host" style="position:relative;height:100vh"><div style="position:absolute;left:18px;top:18px;background:white;padding:15px;border-radius:10px;z-index:20"><strong>Berlin · reale DGM1-Daten</strong><p>16 × 16 m · 1,33 m Höhenunterschied</p><button id="mine">Oberflächenzelle abbauen</button><p id="status">Geländeoberfläche angeschnitten · darunter volle Blöcke</p></div></div>';
const host=document.querySelector<HTMLElement>('#host')!;
const status=document.querySelector<HTMLElement>('#status')!;
const raw=structuredClone(fixture.chunk);
const palette=raw.palette.map((blockTypeId,index)=>({blockTypeId,cellValue:index+1,solid:true,breakable:true,placeable:true,metadata:{}}));
const chunk={...raw,raw,palette,paletteByCellValue:new Map(palette.map(e=>[e.cellValue,e])),paletteByBlockTypeId:new Map(palette.map(e=>[e.blockTypeId,e]))} as any;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eef3');
scene.add(new THREE.HemisphereLight(0xffffff,0x73614f,2.5));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(170,45,180);scene.add(light);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,1000);camera.position.set(189,19,193);camera.lookAt(168,0.5,168);camera.updateMatrixWorld();
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);host.prepend(renderer.domElement);
let group=new THREE.Group(),meshes:THREE.Mesh[]=[];scene.add(group);
function rebuild(){
  scene.remove(group);group.traverse(o=>{const m=o as THREE.Mesh;if(!m.userData.terrainOsmOverlay)m.geometry?.dispose();});group=new THREE.Group();scene.add(group);meshes=[];
  const cut=trimTerrainSurfaceCells(chunk);
  for(const surface of cut.surfaces){const mesh=new THREE.Mesh(surface.geometry,new THREE.MeshStandardMaterial({color:0xa6b788,roughness:1}));group.add(mesh);meshes.push(mesh);}
  const matrix=new THREE.Matrix4(); const cells:number[][]=[];const size=chunk.chunkSize;
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(cut.chunk.cells[x+size*(y+size*z)])cells.push([chunk.chunkX*size+x+.5,chunk.chunkY*size+y+.5,chunk.chunkZ*size+z+.5]);
  const blocks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x998365}),cells.length);cells.forEach((c,i)=>{matrix.makeTranslation(c[0],c[1],c[2]);blocks.setMatrixAt(i,matrix);});group.add(blocks);
  const base=new THREE.Mesh(new THREE.BoxGeometry(16,2,16),new THREE.MeshStandardMaterial({color:0x706556}));base.position.set(168,-1,168);group.add(base);
}
const osm=createTerrainOsmOverlay({host,getFrame:()=>fixture.earthGrid,getCamera:()=>camera,getMeshes:()=>meshes});
document.querySelector('#mine')!.addEventListener('click',()=>{
  const origin={x:164.5,y:10,z:164.5};
  const hit=raycastFromOriginDirection({origin,direction:{x:0,y:-1,z:0},chunkSize:chunk.chunkSize,
    sampler:(_,address)=>sampleCellAtLocalCoordinates(chunk,address),options:{maxDistance:20,maxSteps:128,stepSize:.1}});
  if(!hit.hit||!hit.sourceCell){status.textContent='Keine Oberfläche getroffen';return;}
  const size=chunk.chunkSize,y=hit.sourceCell.worldY;
  chunk.cells[4+size*(y+size*4)]=0;status.textContent=`Zelle (164, ${y}, 164) abgebaut; Oberfläche hat eine echte Öffnung.`;rebuild();
});
rebuild();renderer.setAnimationLoop(()=>{osm.update();renderer.render(scene,camera);});
