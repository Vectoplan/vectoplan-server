import * as THREE from 'three';
import { buildLineBrushBuildingGeometry } from '../../src/frontend/world_edit/systems/line_brush/building_geometry';
import { buildLineBrushBuildingLayout } from '../../src/frontend/world_edit/systems/line_brush/building_layout';
import { lineBrushBuildingPreset } from '../../src/frontend/world_edit/systems/line_brush/building_presets';
import { buildLineBrushRoofZones } from '../../src/frontend/world_edit/systems/line_brush/building_roofs';
import { createPathBrushDraft } from '../../src/frontend/world_edit/systems/shared/path_brush_geometry';
import { createConstructionCellMesh } from '../../src/frontend/scene/construction_cell_rendering';
import { createRoofCalculationMeshes } from '../../src/frontend/scene/roof_calculation_rendering';
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS, requestRoofCalculation, type RoofType } from '../../src/frontend/world_edit/systems/roof/contracts';
import { createFlatRoofCalculation } from '../../src/frontend/world_edit/systems/roof/courtyard';
import { createStoreyDragHandle } from '../../src/frontend/world_edit/systems/storey/drag';
import { buildLineBrushRoofWallCells, type LineBrushRoofWallZone } from '../../src/frontend/world_edit/systems/line_brush/roof_walls';

document.body.style.cssText='margin:0;font:14px system-ui;background:#e9eef3';
document.body.innerHTML='<div id="host" style="position:relative;height:100vh"><div style="position:absolute;z-index:40;left:18px;top:16px;background:white;padding:12px;border-radius:8px"><strong>Linien-Brush · Geometrieprüfung</strong><p><select aria-label="Dachform"><option value="gable">Satteldach</option><option value="pent">Pultdach</option><option value="hipped">Walmdach</option><option value="flat">Flachdach</option></select> <button id="step">Ersten Flügel erhöhen</button> <button id="view">Ansicht wechseln</button></p><output id="status">Lädt …</output></div></div>';
const host=document.querySelector<HTMLElement>('#host')!;
const status=document.querySelector<HTMLOutputElement>('#status')!;
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(devicePixelRatio); host.prepend(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color('#e9eef3');
scene.add(new THREE.HemisphereLight(0xffffff,0x607080,2.4)); const sun=new THREE.DirectionalLight(0xffffff,2.6);sun.position.set(10,70,50);scene.add(sun);
const grid=new THREE.GridHelper(100,100,0xbdc7d4,0xd5dce4);scene.add(grid);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,1000); camera.position.set(65,55,78);camera.lookAt(16,9,15);camera.updateMatrixWorld();
const draft=createPathBrushDraft([{x:0,y:0,z:0},{x:32,y:0,z:12},{x:22,y:0,z:39}],{kind:'building',width:8,interpolation:'linear'})!;
const layout=buildLineBrushBuildingLayout(draft,lineBrushBuildingPreset('standard'));
let count=6, extra=0, previous=6, mode=false, sequence=0, content=new THREE.Group();scene.add(content);
let roofType:RoofType='gable';
async function draw(){
  const revision=++sequence; const next=new THREE.Group();
  for(const index of [0,1]){
    const geom=buildLineBrushBuildingGeometry({draft,layout,baseY:0,storeyCount:count+(index===0?extra:0),segmentScope:index,alignToBuildingGrid:true});
    const wall=createConstructionCellMesh(geom.wallCells,new THREE.MeshStandardMaterial({color:0xe2d8c9,roughness:.9}));
    const slab=createConstructionCellMesh(geom.slabCells,new THREE.MeshStandardMaterial({color:0xc0c8d2,roughness:.9}));
    if(wall)next.add(wall);if(slab)next.add(slab);
  }
  scene.remove(content);content.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose());});content=next;scene.add(next);render();
  try{
    const zones=buildLineBrushRoofZones(draft,layout,roofType,true);
    const wallZones:LineBrushRoofWallZone[]=[];
    for(const zone of zones){
      const y=(count+(zone.segmentIndex===0?extra:0))*2.645;
      const rings=zone.polygon.map(r=>r.map(([x,z])=>({x,y,z})));
      const params={...DEFAULT_ROOF_TOOL_PARAMETERS,roofType,pitchDeg:35,eavesHeightMm:Math.round(y*1000),ridgeDirection:zone.ridgeDirection,
        continuationEdgesMm:zone.continuationEdgesMm,continuationEdgeIndices:zone.continuationEdgeIndices,
        overhangMm:250,edgeOverhangsMm:zone.polygon[0].map((_,i)=>zone.interiorEdges.includes(i)?0:250)};
      const calc=roofType==='flat'?createFlatRoofCalculation(rings[0]!,params.eavesHeightMm,rings.slice(1),params.roofSkinThicknessMm):await requestRoofCalculation(buildRoofCalculationRequest(rings[0]!,params));
      if(revision!==sequence)return;
      const result=createRoofCalculationMeshes(calc); result.meshes.forEach(m=>next.add(m));
      wallZones.push({...zone,eavesY:y,calculation:calc});
    }
    const caps=createConstructionCellMesh(buildLineBrushRoofWallCells(wallZones),new THREE.MeshStandardMaterial({color:0xe2d8c9,roughness:.9}));
    if(caps)next.add(caps);
    status.textContent=`${count} Geschosse · erster Flügel ${count+extra} · ${zones.length} Dachzonen · CAD erfolgreich`;
  }catch(e){status.textContent=String(e);}
  render();
}
function render(){renderer.render(scene,camera);}
document.querySelector('select')!.addEventListener('change',e=>{roofType=(e.target as HTMLSelectElement).value as RoofType;void draw();});
document.querySelector('#step')!.addEventListener('click',()=>{extra=extra===0?1:0;void draw();});
document.querySelector('#view')!.addEventListener('click',()=>{mode=!mode;camera.position.set(...(mode?[55,6,66]:[65,55,78]) as [number,number,number]);camera.lookAt(16,9,15);camera.updateMatrixWorld();render();});
const drag=createStoreyDragHandle({root:host,snapshot:()=>{const p=new THREE.Vector3(27,(count+extra)*2.645,8).project(camera);const q=new THREE.Vector3(27,(count+extra-1)*2.645,8).project(camera);return{count,height:count*2.645,x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,pixelsPerStorey:Math.abs(p.y-q.y)*innerHeight/2,busy:false};},begin:()=>{previous=count;},preview:n=>{count=n;void draw();},commit:async()=>{status.textContent=`${count} Geschosse übernommen`;},cancel:()=>{count=previous;void draw();}});
drag.setEnabled(true);void draw();
