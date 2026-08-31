// Uses the actual wire normalizer, surface-layer selector and scene chunk
// builders. The earlier direct roof preview did not exercise these stages.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { normalizeChunkApiBatchResult } from "../src/frontend/api/chunk_api_normalize";
import { createRuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import { additionalSurfaceChunkCoordinates } from "../src/frontend/scene/structure_streaming";
import { appendSemanticObjectMeshes, appendLod2WallCaps, createChunkMeshRecord, semanticObjectRefs } from "../src/frontend/scene/scene_runtime";
import { trimLod2WallCaps } from "../src/frontend/scene/lod2_wall_caps";
import { createRoofSurfaceHighlight, roofSurfaceMarker, roofSurfaceTriangles } from "../src/frontend/scene/roof_surface_geometry";
import { createSolarToolPanel } from '../src/frontend/world_edit/systems/solar/panel';
import { buildSolarLayout, createSolarMesh, normalizeSolarSettings, solarMetricScale } from '../src/frontend/world_edit/systems/solar/layout';
import '../src/frontend/styles/world_edit.css';

async function main() {
  const wire=await (await fetch('./streaming-data.json')).json();
  const normalized=normalizeChunkApiBatchResult(wire,null,{projectId:wire.projectId,worldId:wire.worldId});
  if(!normalized.ok) throw Error(JSON.stringify(normalized.error));
  const chunks=normalized.chunks.map(c=>createRuntimeChunkContent(c));
  const originalRecords=new Map(chunks.map(chunk=>[chunk.chunkKey,
    appendSemanticObjectMeshes(createChunkMeshRecord(chunk),chunk,semanticObjectRefs(chunk))]));
  const roofRefs=[...new Map(chunks.flatMap(c=>semanticObjectRefs(c)).map(r=>[r.objectInstanceId,r])).values()];
  const calculations=roofRefs.map(r=>r.metadata.roofCalculation);
  const occupied=new Set<string>();
  chunks.forEach(c=>c.cells.forEach((v,i)=>{if(v>0)occupied.add(`${c.chunkX*16+i%16}:${c.chunkY*16+Math.floor(i/16)%16}:${c.chunkZ*16+Math.floor(i/256)}`);}));
  let capCount=0;
  const refinedRecords=new Map(chunks.map(chunk=>{
    const caps=trimLod2WallCaps(chunk,calculations,(x,y,z)=>occupied.has(`${x}:${y}:${z}`));capCount+=caps.cappedCellIndices.length;
    return [chunk.chunkKey,appendLod2WallCaps(appendSemanticObjectMeshes(createChunkMeshRecord(caps.chunk),chunk,semanticObjectRefs(chunk)),caps)];
  }));
  let capsEnabled=true,records=refinedRecords;
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#5aa7d4');
  const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,3000);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x707d65,2));
  const sun=new THREE.DirectionalLight(0xffffff,2.8);sun.position.set(-120,300,-100);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshStandardMaterial({color:'#d5d5cc'}));
  ground.rotation.x=-Math.PI/2;ground.position.y=1;scene.add(ground);
  originalRecords.forEach(r=>{r.group.visible=false;scene.add(r.group);});
  refinedRecords.forEach(r=>scene.add(r.group));
  const zones=new THREE.Group();zones.visible=false;scene.add(zones);
  for(const roof of roofRefs){const group=createRoofSurfaceHighlight(roof.metadata.roofCalculation);if(group)zones.add(group);
    const p=roofSurfaceMarker(roofSurfaceTriangles(roof.metadata.roofCalculation));if(p){
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.5),new THREE.MeshBasicMaterial({color:0xffdd00}));marker.position.copy(p);marker.position.y+=.6;zones.add(marker);}}
  let step=0;
  function show(mode:'before'|'after'|'all') {
    const center={chunkX:step%2===0 ? 0 : -4,chunkY:0,chunkZ:0};
    const probes=chunks.filter(c=>c.chunkY===0 && (c.chunkX-center.chunkX)**2+(c.chunkZ-center.chunkZ)**2<=7**2);
    const visible=new Set(probes.map(c=>c.chunkKey));
    if(mode==='all')chunks.forEach(c=>visible.add(c.chunkKey));
    if(mode==='after')additionalSurfaceChunkCoordinates(probes,center).forEach(c=>visible.add(`${c.chunkX}:${c.chunkY}:${c.chunkZ}`));
    let roofCount=0,wallCount=0;
    records.forEach((record,key)=>{record.group.visible=visible.has(key);if(record.group.visible){
      record.meshes.forEach(mesh=>mesh.visible=true);
      roofCount+=new Set(record.meshes.filter(m=>m.userData.semanticRoof).map(m=>m.userData.objectInstanceId)).size;
    }});
    chunks.filter(c=>visible.has(c.chunkKey)).forEach(c=>wallCount+=c.cells.filter(v=>v>0).length);
    camera.position.set(center.chunkX*16+120,125,-170);controls.target.set(center.chunkX*16-30,12,40);controls.update();
    document.getElementById('status')!.textContent=`${mode==='before'?'Bisher':mode==='all'?'Gesamter Prüfbestand':'Korrigiert'} · ${roofCount} / ${wire.report.roofObjects} Dächer · ${wallCount.toLocaleString('de-DE')} Wandblöcke · ${capsEnabled?capCount:0} angepasste Abschlüsse`;
  }
  document.getElementById('before')!.onclick=()=>show('before');
  document.getElementById('after')!.onclick=()=>show('after');
  document.getElementById('all')!.onclick=()=>show('all');
  document.getElementById('move')!.onclick=()=>{step++;show('after');};
  const button=(text:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=text;b.onclick=action;document.querySelector('header')!.appendChild(b);};
  button('Abschlussblöcke vergleichen',()=>{records.forEach(r=>r.group.visible=false);capsEnabled=!capsEnabled;records=capsEnabled?refinedRecords:originalRecords;show('all');camera.position.set(65,67,-3);controls.target.set(-30,18,-75);controls.update();});
  button('Dachzonen auf Originalhöhe',()=>{zones.visible=!zones.visible;show('all');camera.position.set(65,67,-3);controls.target.set(-30,18,-75);controls.update();});
  let solarRoof=roofRefs[0]!,solarMesh:THREE.InstancedMesh|null=null,solarSettings=normalizeSolarSettings(null);
  // The QA page is explicitly the saved Berlin fixture, not a live project.
  const metric=solarMetricScale({worldWidthCells:40_000_000,worldHeightCells:20_000_000,metersPerCell:1},52.517389)!;
  const solar=createSolarToolPanel({root:document.body,getCalculation:()=>solarRoof.metadata.roofCalculation,
    getLocation:()=>({latitude:52.517389,longitude:13.395131}),
    onChange:settings=>{solarSettings=settings;if(solarMesh){scene.remove(solarMesh);solarMesh.geometry.dispose();(solarMesh.material as THREE.Material).dispose();solarMesh.dispose();}
      solarMesh=createSolarMesh(buildSolarLayout(solarRoof.metadata.roofCalculation,settings),settings.module);if(solarMesh)scene.add(solarMesh);},
    onClose:()=>{},onSave:async()=>{document.getElementById('status')!.textContent='Solar-Prüfvorschau bestätigt. Keine Projektänderung.';solar.close(false);}});
  const select=document.createElement('select');select.setAttribute('aria-label','Prüfdach auswählen');
  roofRefs.forEach((roof,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`Dach ${i+1} · ${roof.objectInstanceId}`;select.append(o);});
  select.onchange=()=>{solarRoof=roofRefs[Number(select.value)]!;solarSettings=normalizeSolarSettings(null);};document.querySelector('header')!.append(select);
  button('Solarwerkzeug prüfen',()=>{show('all');const p=roofSurfaceMarker(roofSurfaceTriangles(solarRoof.metadata.roofCalculation))!;
    camera.position.copy(p).add(new THREE.Vector3(50,65,-70));controls.target.copy(p);controls.update();void solar.open({...solarSettings,metricScale:metric});});
  button('Gewähltes Dach isolieren',()=>{
    show('all');records.forEach(r=>r.meshes.forEach(m=>m.visible=m.userData.objectInstanceId===solarRoof.objectInstanceId));
    const bounds=new THREE.Box3();records.forEach(r=>r.meshes.filter(m=>m.visible).forEach(m=>bounds.expandByObject(m)));
    const p=bounds.getCenter(new THREE.Vector3()),distance=Math.max(12,bounds.getSize(new THREE.Vector3()).length()*.8);
    camera.position.copy(p).add(new THREE.Vector3(distance,distance,-distance));controls.target.copy(p);controls.update();
    document.getElementById('status')!.textContent=`Isoliertes Dach · ${solarMesh?.count??0} PV-Instanzen`;
  });
  const metrics=document.createElement('p');document.querySelector('header')!.append(metrics);
  let frames:number[]=[],last=0,started=0,measuring=false;
  button('15 s Render-Test (Prüfviewer)',()=>{show('all');frames=[];last=0;started=performance.now();measuring=true;metrics.textContent='Messung läuft …';});
  show('after');renderer.setAnimationLoop(time=>{
    if(measuring){if(last)frames.push(time-last);last=time;const elapsed=time-started;
      const angle=elapsed/15000*Math.PI*2;camera.position.set(Math.cos(angle)*180,105,Math.sin(angle)*180);controls.target.set(-25,15,20);controls.update();
      if(elapsed>=15000 && frames.length){measuring=false;const sorted=[...frames].sort((a,b)=>a-b),avg=frames.reduce((a,b)=>a+b,0)/frames.length;
        metrics.textContent=`Prüfviewer (kein Editor-F8): ${(1000/avg).toFixed(1)} FPS · p95 ${sorted[Math.floor(sorted.length*.95)]!.toFixed(1)} ms · ${renderer.info.render.calls} Draw Calls · ${renderer.info.render.triangles} Dreiecke`;}}
    renderer.render(scene,camera);
  });
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
main().catch(error=>{document.getElementById('status')!.textContent=String(error);throw error;});
