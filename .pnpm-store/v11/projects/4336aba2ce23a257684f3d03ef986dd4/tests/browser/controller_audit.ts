import * as THREE from 'three';
import { createWorldEditController } from '../../src/frontend/world_edit/world_edit_controller';
import { createConstructionCellMesh } from '../../src/frontend/scene/construction_cell_rendering';
import { createBlockMaterial } from '../../src/frontend/render/block_material';
import { createRoofCalculationMeshes } from '../../src/frontend/scene/roof_calculation_rendering';

document.body.innerHTML='<div id="root" style="position:relative;width:1200px;height:800px"><button id="run">Controller-Regression starten</button><pre id="result">Bereit</pre></div>';
const root=document.querySelector<HTMLElement>('#root')!;
const result=document.querySelector<HTMLElement>('#result')!;
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(50,1.5,.1,1000);camera.position.set(40,45,55);camera.lookAt(10,5,5);camera.updateMatrixWorld();
let mode='planning',handler:any=null,failNext=false,reloadFailures=1,pointerLockRequests=0;
const commands:any[]=[];
const saved = new THREE.Group(); saved.name='persisted-buildings'; scene.add(saved);
function loadCommittedGeometry() {
  saved.clear();
  const batch=commands.filter(c=>c.type==='ObjectBatch').at(-1); if(!batch)return;
  for(const c of batch.commands) {
    if(c.type!=='PlaceObject')continue;
    const object=new THREE.Group();
    object.userData={semanticPlanningBuildArea:c.objectTypeId==='planning_build_area',semanticObjectRef:{...c,anchor:c.position}};
    if(c.metadata?.constructionCells) {
      const mesh=createConstructionCellMesh(c.metadata.constructionCells,createBlockMaterial({blockTypeId:c.runtimeBlockTypeId??c.blockTypeId}));
      if(mesh)object.add(mesh);
    }
    if(c.metadata?.roofCalculation) createRoofCalculationMeshes(c.metadata.roofCalculation).meshes.forEach(m=>object.add(m));
    saved.add(object);
  }
  scene.updateMatrixWorld(true);
}
const emptyTarget={sourceCell:null,placementCell:null,targetPoint:null};
const input=new Proxy({}, {get:(_,key)=>()=>{if(key==='requestPointerLock')pointerLockRequests++;return Promise.resolve();}});
const runtime=new Proxy({
  getScene:()=>scene,getCamera:()=>camera,getRenderer:()=>null,
  getWorkspaceMode:()=>mode,setWorkspaceMode:(next:string)=>{mode=next;},
  getSelectedLibraryPlacement:()=>({valid:false,runtimeBlockTypeId:null,objectKind:null}),
  getInputController:()=>input,getTargetCells:()=>emptyTarget,
  setWorldEditIntentHandler:(next:any)=>{handler=next;},
  // Production can resolve even when its loader is degraded; meshes arrive
  // later through the render queue. A resolved promise is deliberately no proof.
  reloadDirtyChunks:async()=>{if(reloadFailures>0){reloadFailures--;return;}setTimeout(loadCommittedGeometry,200);},
}, {get:(target,key)=>key in target?(target as any)[key]:()=>null});
const controller=createWorldEditController({root,bootstrap:{runtime:{chunk:{projectId:'controller-test',worldId:'controller-test'}}},sceneRuntime:runtime,
  worldRuntime:{getRegistry:()=>({getSnapshot:()=>({entries:[]})}),getSource:()=>({sendCommand:async(payload:any)=>{
    commands.push(payload); if(failNext){failNext=false;return {ok:false,error:{message:'Absichtlich fehlgeschlagener Test'}};}
    return {ok:true,changed:true};
  }})},
} as any);
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const wait=async()=>{await new Promise(r=>setTimeout(r,0));for(let i=0;i<100;i++){if(root.querySelector('[data-world-edit-status]')?.getAttribute('data-kind')!=='busy')return;await new Promise(r=>setTimeout(r,20));}throw new Error('Save timeout');};
const waitFor=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,40));}throw new Error('Darstellung timeout');};
const buildingPreview=()=>scene.getObjectByName('vectoplan_world_edit_planning_build_area');
function assertOpaque(object:THREE.Object3D|undefined, editable:boolean){
  assert(object,'Baukörper vorhanden');let count=0;
  object!.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;
    if(object===buildingPreview()&&!o.userData.lineBrushBuildingPreview)return;
    for(const m of (Array.isArray(o.material)?o.material:[o.material])) {
      assert(!m.transparent&&m.opacity===1&&m.depthWrite,'Wände/Dächer müssen deckend sein');
      if(o.userData.lineBrushBuildingPreview)assert(o.userData.lineBrushEditable===editable,'Darstellung muss Werkzeug folgen');count++;
    }
  });assert(count>0,'Tatsächliche Gebäudemeshes sichtbar');
}
async function point(x:number,z:number){await handler({action:'primary',position:{x,y:0,z},targetPoint:{x,y:0,z},sourceCell:null,placementCell:null,trigger:'test',createdAt:new Date().toISOString()});await handler({action:'primary-release',position:null,targetPoint:null,sourceCell:null,placementCell:null,trigger:'test',createdAt:new Date().toISOString()});}
document.querySelector('#run')!.addEventListener('click',async()=>{
  try{
    controller.activate('room');await point(0,0);await point(20,8);await point(23,24);
    assert(root.dataset.planningBuildAreaSegments==='2','Zwei Liniensegmente müssen sichtbar sein');
    assertOpaque(buildingPreview(),true);
    assert(scene.getObjectByName('vectoplan_world_edit_building_settings'),'Draft braucht Zahnrad');
    controller.activate('selection');await wait();
    const batch=commands.find(c=>c.type==='ObjectBatch');assert(batch,'Werkzeugwechsel muss Gebäudebatch speichern');
    const parent=batch.commands.find((c:any)=>c.objectTypeId==='planning_build_area');assert(parent?.metadata.pathBrush.points.length===3,'Gespeicherter Pfad muss erhalten bleiben');
    assert(batch.commands.some((c:any)=>c.metadata?.renderProfile==='construction-grid'),'Formzellen müssen persistiert sein');
    assert(buildingPreview(),'Bei Nachladefehler muss das gespeicherte Gebäude als Vorschau sichtbar bleiben');
    assertOpaque(buildingPreview(),false);
    await waitFor(()=>!buildingPreview());
    assert(!buildingPreview(),'Nach erfolgreichem Nachladen muss die Ersatzvorschau verschwinden');
    assertOpaque(saved,false);
    assert(commands.filter(c=>c.type==='ObjectBatch').length===1,'Wiederholtes Nachladen darf nicht erneut speichern');
    controller.deactivate();mode='first-person';controller.activate('room');
    assert(root.dataset.planningBuildAreaSegments==='2','Ego-Wechsel darf Pfad nicht löschen');
    assert(root.dataset.planningBuildAreaEditable==='true','Pfad muss nach Wiederauswahl bearbeitbar sein');
    assertOpaque(buildingPreview(),true);
    loadCommittedGeometry();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    let visibleSavedMeshes=0;saved.traverseVisible(o=>{if(o instanceof THREE.Mesh)visibleSavedMeshes++;});
    assert(visibleSavedMeshes===0,'Spät nachgeladene Originalmeshes müssen unter blauem Draft verborgen bleiben');
    const gear=scene.getObjectByName('vectoplan_world_edit_building_settings')!;
    const cameraBefore=camera.position.clone();camera.lookAt(gear.position);camera.updateMatrixWorld(true);
    await handler({action:'primary',position:null,trigger:'test',createdAt:'test'});
    await wait();assert(camera.position.equals(cameraBefore),'Zahnrad darf Kamera nicht verschieben');
    assert(root.querySelector<HTMLElement>('.editor-line-brush-quick-settings')?.hidden===false,'Zahnrad öffnet Gebäudeeinstellungen');
    const pointsBefore=root.dataset.planningBuildAreaSegments;
    camera.lookAt(1000,1000,1000);camera.updateMatrixWorld(true);
    await handler({action:'secondary',position:{x:0,y:0,z:0},trigger:'test',createdAt:'test'});
    assert(root.dataset.planningBuildAreaSegments===pointsBefore,'Rechtsklick daneben muss Pfad behalten');
    assert(!commands.some(c=>c.type==='RemoveObject'&&c.objectInstanceId===parent.objectInstanceId),'Rechtsklick daneben darf kein Gebäude löschen');
    const pointMarker=buildingPreview()!.children.find(o=>o.userData.polygonAreaPointIndex===2)!;
    camera.lookAt(pointMarker.position);camera.updateMatrixWorld(true);
    await handler({action:'secondary',position:{x:23,y:0,z:24},trigger:'test',createdAt:'test'});await wait();
    assert(root.dataset.planningBuildAreaSegments==='1','Rechtsklick muss den wirklich anvisierten Punkt löschen');
    await new Promise(r=>setTimeout(r,350));
    camera.lookAt(10,5,5);camera.updateMatrixWorld(true);
    const locksBeforeStorey=pointerLockRequests;
    controller.activate('storey');await new Promise(r=>requestAnimationFrame(r));
    assert(pointerLockRequests===locksBeforeStorey,'Offene Geschosseinstellungen müssen in Ego die freie Maus behalten');
    const handle=root.querySelector<HTMLButtonElement>('[data-storey-drag-handle]')!;
    assert(!handle.hidden,'Geschossgriff muss in Ego sichtbar sein');
    const before=commands.filter(c=>c.type==='ObjectBatch').length;
    handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));await wait();
    await new Promise(r=>setTimeout(r,350));
    assert(commands.filter(c=>c.type==='ObjectBatch').length===before+1,'Geschossgriff muss genau einmal speichern');
    const parents=commands.filter(c=>c.type==='ObjectBatch').map(c=>c.commands.find((p:any)=>p.objectTypeId==='planning_build_area'));
    assert(parents.at(-1).metadata.storeyCount===parent.metadata.storeyCount+1,'Geschosszahl muss um eins steigen');
    failNext=true;handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await wait();
    await new Promise(r=>requestAnimationFrame(r));
    assert(handle.textContent?.includes(`${parent.metadata.storeyCount+1} Geschosse`),'Fehlgeschlagener Save muss Geschosse zurückrollen');
    controller.activate('selection');
    assert(!buildingPreview(),'Fehlerrollback darf keine zusätzliche Vorschau hinterlassen');
    controller.activate('storey');await new Promise(r=>requestAnimationFrame(r));
    // Synthetic pointer ids have no browser capture; actual capture/drag is
    // additionally exercised manually on the line-brush visual fixture.
    handle.setPointerCapture=()=>{};handle.releasePointerCapture=()=>{};handle.hasPointerCapture=()=>false;
    handle.dispatchEvent(new PointerEvent('pointerdown',{pointerId:23,button:0,clientY:300,bubbles:true}));
    handle.dispatchEvent(new PointerEvent('pointermove',{pointerId:23,clientY:200,bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    controller.activate('selection');
    assert(!buildingPreview(),'Escape muss Profil und ursprünglichen Änderungszustand wiederherstellen');
    result.textContent='PASS: Werkzeugwechsel speichert; Ego-Wechsel erhält Pfad; Formzellen persistieren; Geschossgriff speichert einmal; Fehler und Escape rollen zurück; Nachladefehler erhält Vorschau bis zum erfolgreichen erneuten Laden.';
  }catch(error){result.textContent='FAIL: '+String(error);}
});
