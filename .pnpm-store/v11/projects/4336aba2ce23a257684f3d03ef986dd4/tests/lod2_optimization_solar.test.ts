import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { automaticFlatSolarAzimuth, buildSolarLayout, solarFaces, compassAzimuth, solarRectangleCovered, createSolarMesh, normalizeSolarSettings, solarMetricScale, solarDailyEconomics, normalizeSolarTargetArea, solarTargetAreaFromWheel } from '../src/frontend/world_edit/systems/solar/layout';
import { solarAzimuthName, solarInquiryUrl } from '../src/frontend/world_edit/systems/solar/panel';
import { createRoofCalculationMeshes } from '../src/frontend/scene/roof_calculation_rendering';
import { createChunkRegistry } from '../src/frontend/runtime/world/chunk_registry';
import { normalizeChunkApiBatchResult } from '../src/frontend/api/chunk_api_normalize';
import { createRuntimeChunkContent } from '../src/frontend/runtime/world/chunk_content';
import { createLod2RoofIndex } from '../src/frontend/scene/lod2_roof_index';
import { pickBlockInventoryItem, postPickedBlockToInventory } from '../src/frontend/inventory/pick_block';
import { touchesLod2Wall } from '../src/frontend/scene/lod2_block_grid';
import { lod2BuildingBoundaryGrid, segmentIntersectsLod2Cell } from '../src/frontend/scene/lod2_wall_caps';

const module={packageId:'test-module',revision:'1',label:'Test',widthM:1,lengthM:2,thicknessM:.04,powerWp:450};
function roof(points:number[][],fingerprint='test') {return {ok:true,roof_type:'imported',input_fingerprint:fingerprint,
  geometry:{faces:[{polygon_3d_mm:points.map(([x,y,z])=>[x!*1000,z!*1000,y!*1000])}]}};}
const flat=roof([[0,10,0],[10,10,0],[10,10,10],[0,10,10]]);
function selected(calc:any,overrides:any={}) {return {...normalizeSolarSettings(null),module,selectedFaces:solarFaces(calc).map(f=>f.id),...overrides};}

test('solar orientation uses compass N/E/S/W without a Berlin assumption',()=>{
  assert.deepEqual([[0,1],[1,0],[0,-1],[-1,0]].map(([x,z])=>compassAzimuth(x!,z!)),[0,90,180,270]);
  const east=roof([[0,10,0],[10,0,0],[10,0,10],[0,10,10]]);
  assert.equal(solarFaces(east).length,1);
  const f=solarFaces(east)[0]!;assert(Math.abs(f.azimuthDeg-90)<1e-6);assert(Math.abs(f.tiltDeg-45)<1e-6);
  const layout=buildSolarLayout(east,selected(east));assert(layout.panels.length>0);
  layout.panels.forEach(p=>{assert(Math.abs(p.normal.dot(f.normal)-1)<1e-6);assert(p.center.x+p.center.y>10);});
});
test('no available module or no selected roof face means no panels',()=>{
  assert.equal(buildSolarLayout(flat,null).panels.length,0);
  assert.equal(buildSolarLayout(flat,{module}).panels.length,0);
  assert.equal(buildSolarLayout(null,selected(flat)).panels.length,0);
  assert.equal(normalizeSolarSettings({module:{...module,powerWp:NaN}}).module,null);
});
test('automatic PV assumptions expose occupied square metres and understandable daily economics',()=>{
  const settings=selected(flat),layout=buildSolarLayout(flat,settings);
  assert.equal(layout.occupiedAreaM2,layout.panels.length*module.widthM*module.lengthM);
  assert.equal(layout.selectedAreaM2,100);
  assert.deepEqual(solarDailyEconomics(3650,.4,30,10),{dailyKwh:10,selfConsumedKwh:3,exportedKwh:7,
    dailyEnergyValueEur:4,dailySavingsEur:1.2,feedInRateEurPerKwh:.077,dailyFeedInRevenueEur:.539,
    dailyBenefitEur:1.739,compensationModel:'feed_in_tariff'});
  const limited=buildSolarLayout(flat,selected(flat,{targetAreaM2:10}));
  assert.equal(limited.panels.length,5);assert.equal(limited.occupiedAreaM2,10);
  assert.equal(limited.availablePanelCount,layout.panels.length);assert.equal(limited.availableAreaM2,layout.occupiedAreaM2);
  const normalized=normalizeSolarSettings(null);
  assert.equal(normalized.targetAreaM2,null);
  assert.equal(normalized.edgeMarginM,.3);assert.equal(normalized.gapM,.02);
  assert.equal(normalized.systemLossPercent,14);assert.equal(normalized.selfConsumptionPercent,30);
});
test('PV area wheel, inquiry link and azimuth-driven module direction remain automatic and bounded',()=>{
  assert.equal(solarTargetAreaFromWheel(100, -120, 101),101);
  assert.equal(solarTargetAreaFromWheel(100, 120, 101),99);
  assert.equal(solarTargetAreaFromWheel(0,120,500),0);assert.equal(normalizeSolarTargetArea(10.26,20),10.3);
  assert.equal(solarAzimuthName(264),'West');
  assert.equal(solarInquiryUrl('https://editor.example/editor?app_project_public_id=prj-1'),
    'https://editor.example/contact?topic=solaranlage&source=3d-editor&project=prj-1');
  assert.equal(automaticFlatSolarAzimuth(52),180);assert.equal(automaticFlatSolarAzimuth(-33),0);
  const narrow=roof([[0,10,0],[2.9,10,0],[2.9,12,8],[0,12,8]]),face=solarFaces(narrow)[0]!;
  const automatic=buildSolarLayout(narrow,selected(narrow));
  const stalePortrait=buildSolarLayout(narrow,selected(narrow,{faceLayouts:{[face.id]:'portrait'},faceAzimuthDeg:{[face.id]:45}}));
  const staleLandscape=buildSolarLayout(narrow,selected(narrow,{faceLayouts:{[face.id]:'landscape'},faceAzimuthDeg:{[face.id]:315}}));
  assert(automatic.panels.length>0);
  assert.deepEqual(stalePortrait.panels.map(panel=>panel.layout),automatic.panels.map(panel=>panel.layout));
  assert.deepEqual(staleLandscape.panels.map(panel=>panel.layout),automatic.panels.map(panel=>panel.layout));
  assert(automatic.panels.every(panel=>panel.widthM===(panel.layout==='portrait'?module.widthM:module.lengthM)));
});
test('geodetic metric corrects high-latitude module size, area and roof azimuth',()=>{
  const scale=solarMetricScale({worldWidthCells:40_000_000,worldHeightCells:20_000_000,metersPerCell:1},60)!;
  assert(scale.x>.50 && scale.x<.505);assert(scale.z>.99 && scale.z<1.01);
  const f=solarFaces(flat,scale)[0]!;assert(f.areaM2>50 && f.areaM2<51);
  const slope=roof([[0,20,0],[10,10,0],[10,0,10],[0,10,10]]);
  const face=solarFaces(slope,scale)[0]!;
  assert(face.azimuthDeg>63 && face.azimuthDeg<64); // not the distorted grid's 45°
  const layout=buildSolarLayout(flat,{...selected(flat),metricScale:scale,selectedFaces:[f.id]});
  assert(layout.panels.length>0);
  const p=layout.panels[0]!;
  assert(Math.abs(Math.hypot(p.u.x*scale.x,p.u.y*scale.y,p.u.z*scale.z)-1)<1e-6);
  assert.equal(solarMetricScale({worldWidthCells:0,worldHeightCells:0,metersPerCell:1},52),null);
});
test('flat roof tilt/azimuth are applied geometrically and all panel corners stay above the roof',()=>{
  for(const az of [0,90,180,270]) {
    const layout=buildSolarLayout(flat,selected(flat,{flatAzimuthDeg:az,flatTiltDeg:30}));
    assert(layout.panels.length>0);assert.equal(layout.powerKwp,layout.panels.length*.45);
    for(const p of layout.panels) {
      assert(Math.abs(compassAzimuth(p.normal.x,p.normal.z)-az)<1e-6);
      assert(Math.abs(p.normal.y-Math.cos(Math.PI/6))<1e-6);
      assert(p.center.y-Math.abs(p.v.y)*module.lengthM/2-module.thicknessM/2>10);
      assert(Math.abs(new THREE.Matrix4().makeBasis(p.u,p.normal,p.v).determinant()-1)<1e-6);
    }
    const mesh=createSolarMesh(layout,module)!;assert(mesh.isInstancedMesh);assert.equal(mesh.count,layout.panels.length);
    mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();mesh.dispose();
  }
});
test('panel coverage rejects a courtyard inside the panel even if all four corners are covered',()=>{
  const triangles:any=[[[0,0],[5,0],[5,1]],[[0,0],[5,1],[0,1]],[[0,4],[5,4],[5,5]],[[0,4],[5,5],[0,5]],
    [[0,1],[1,1],[1,4]],[[0,1],[1,4],[0,4]],[[4,1],[5,1],[5,4]],[[4,1],[5,4],[4,4]]];
  assert.equal(solarRectangleCovered(triangles,0,0,5,5,0),false);
  assert.equal(solarRectangleCovered(triangles,.1,.1,.8,.8,0),true);
});
test('solar follows changed roof heights and preserves a serializable placement contract',()=>{
  const settings=selected(flat);const before=buildSolarLayout(flat,settings);
  const raised=roof([[0,30,0],[10,30,0],[10,30,10],[0,30,10]],'raised');
  const after=buildSolarLayout(raised,JSON.parse(JSON.stringify(settings)));
  assert.equal(before.panels.length,after.panels.length);
  after.panels.forEach((p,i)=>assert(Math.abs(p.center.y-before.panels[i]!.center.y-20)<1e-6));
  assert.equal(buildSolarLayout(raised,{...settings,selectedFaces:['missing-face']}).panels.length,0);
});
test('imported roof facets merge into one draw without losing triangles or height',()=>{
  const a=roof([[0,10,0],[10,10,0],[10,15,10]]);
  a.geometry.faces.push(roof([[0,10,0],[10,15,10],[0,15,10]]).geometry.faces[0]!);
  const result=createRoofCalculationMeshes(a);assert.equal(result.meshes.length,1);assert.equal(result.geometries.length,1);
  const baseline=createRoofCalculationMeshes(a,{mergeParts:false});
  const g=result.geometries[0]!;assert.equal(g.index!.count,baseline.geometries.reduce((n,g)=>n+g.index!.count,0));assert(g.boundingBox!.max.y>=15);
  baseline.geometries.forEach(g=>g.dispose());baseline.materials.forEach(m=>m.dispose());
  result.geometries.forEach(g=>g.dispose());result.materials.forEach(m=>m.dispose());
});

test('parametric roof batching retains every triangle, normal, UV, bound and part reference',()=>{
  const members=Array.from({length:1000},(_,i)=>({member_ref:`member-${i}`,start_3d_mm:[i*50,0,9000],
    end_3d_mm:[i*50,10000,10000],section_mm:{width:80,height:200},height_axis_3d:[0,0,1]}));
  const calculation={...flat,roof_type:'pent',structure:{rafters:members,purlins:members.slice(0,3)},
    roof_build_up:{counter_battens:members,tile_battens:members,exterior_offset_mm:100}};
  const ref={id:'semantic-roof'};
  const baseline=createRoofCalculationMeshes(calculation,{mergeParts:false,semanticObjectRef:ref,objectInstanceId:'roof-1'});
  const result=createRoofCalculationMeshes(calculation,{semanticObjectRef:ref,objectInstanceId:'roof-1'});
  assert(baseline.meshes.length>5000);assert(result.meshes.length<10);
  const originalParts=new Map(baseline.meshes.map(m=>[m.userData.roofPart,m]));
  let triangleCount=0;
  for(const mesh of result.meshes){
    assert.equal(mesh.userData.semanticObjectRef,ref);assert.equal(mesh.userData.objectInstanceId,'roof-1');
    const parts=mesh.userData.roofParts??[{part:mesh.userData.roofPart,indexOffset:0,indexCount:mesh.geometry.index!.count}];
    const bounds=new THREE.Box3();
    for(const part of parts){
      const original=originalParts.get(part.part)!;assert(original);
      bounds.union(original.geometry.boundingBox!);
      assert.equal(part.indexCount,original.geometry.index!.count);
      for(let i=0;i<part.indexCount;i++){
        const a=original.geometry.index!.getX(i),b=mesh.geometry.index!.getX(part.indexOffset+i);
        for(const name of Object.keys(original.geometry.attributes)){
          const source=original.geometry.getAttribute(name),target=mesh.geometry.getAttribute(name);
          for(let component=0;component<source.itemSize;component++)
            assert.equal(target.array[b*target.itemSize+component],source.array[a*source.itemSize+component]);
        }
      }
      triangleCount+=part.indexCount/3;
      originalParts.delete(part.part);
    }
    assert(mesh.geometry.boundingBox!.equals(bounds));
  }
  assert.equal(originalParts.size,0);
  assert.equal(triangleCount,baseline.geometries.reduce((sum,g)=>sum+g.index!.count/3,0));
  for(const rendered of [baseline,result]){rendered.geometries.forEach(g=>g.dispose());rendered.materials.forEach(m=>m.dispose());}
});
function chunk(x=0,refs:any[]=[]) {
  const result=normalizeChunkApiBatchResult({ok:true,chunks:[{chunk:{projectId:'test',worldId:'test',chunkX:x,chunkY:0,chunkZ:0,
    chunkKey:`${x}:0:0`,chunkSize:16,cellSize:1,cells:Array(4096).fill(0),palette:[{blockTypeId:'lod2_exterior_wall'}],objectRefs:refs}}]},null,{projectId:'test',worldId:'test'});
  assert(result.ok);return createRuntimeChunkContent(result.chunks[0]!);
}
test('roof index rebuilds on actual content changes, not camera reads or visibility updates',()=>{
  const registry=createChunkRegistry({maxChunks:10});
  const ref:any={objectTypeId:'building_roof',objectInstanceId:'r',metadata:{lod2BuildingId:'b'},anchor:{x:0,y:20,z:0},dimensions:{x:32,y:4,z:16}};
  const c=chunk(0,[ref]);registry.setChunk(c);
  const index=createLod2RoofIndex(c=>c.raw.objectRefs as any);
  for(let i=0;i<100;i++){registry.getChunk(c.chunkKey);registry.setVisibleChunkKeys([c.chunkKey]);assert.equal(index.query(registry,c).length,1);}
  assert.equal(index.getBuildCount(),1);
  registry.setChunk(chunk(1));assert.equal(index.query(registry,c).length,1);assert.equal(index.getBuildCount(),2);
  registry.deleteChunk(c.chunkKey);assert.equal(index.query(registry,c).length,0);assert.equal(index.getBuildCount(),3);
  registry.clear();index.query(registry,c);assert.equal(index.getBuildCount(),4);
});
test('middle click copies the aimed material/variant, including terrain and full-size LoD2 wall',()=>{
  const item:any=pickBlockInventoryItem('lod2_exterior_wall','Wall',{});
  assert.equal(item.placement.runtimeBlockTypeId,'lod2_exterior_wall');assert.deepEqual(item.metadata.dimensionsMm,[1000,1000,1000]);
  const variant:any=pickBlockInventoryItem('custom','Material',{library:{familyId:'family',variantId:'v2',packageId:'pkg'}});
  assert.equal(variant.variant_id,'v2');assert.equal(variant.placement.runtimeBlockTypeId,'custom');
  assert(pickBlockInventoryItem('system_terrain','Terrain',{}));
  assert.equal(pickBlockInventoryItem('system_air','Air',{}),null);assert.equal(pickBlockInventoryItem('unknown','?',{}),null);
});
test('roof index prefers the authoritative owner and indexes edited footprint bounds',()=>{
  const registry=createChunkRegistry();
  const ref:any={objectTypeId:'building_roof',objectInstanceId:'r',metadata:{lod2BuildingId:'b'},primaryChunkKey:'1:0:0',
    anchor:{x:16,y:20,z:0},dimensions:{x:10,y:4,z:10},footprint:{coordinates:[[[-16,0],[26,0],[26,10],[-16,0]]]}};
  registry.setChunk(chunk(-1,[{...ref,metadata:{...ref.metadata,stale:true}}]));registry.setChunk(chunk(1,[ref]));
  const index=createLod2RoofIndex(c=>c.raw.objectRefs as any);
  const found=index.query(registry,chunk(-1));assert.equal(found.length,1);assert.equal(found[0]!.ref.metadata.stale,undefined);
});
test('pick-block posts only to the inventory origin and maps the active zero-based slot to 1–9',()=>{
  const previous=(globalThis as any).window;const sent:any[]=[];
  (globalThis as any).window={location:{href:'http://localhost:5100/editor'}};
  const root:any={querySelector:()=>({src:'http://localhost:5113/user-inventar',contentWindow:{postMessage:(...p:any[])=>sent.push(p)}})};
  try {assert(postPickedBlockToInventory(root,{family_id:'wall'},8));assert.equal(sent[0][0].detail.slotIndex,9);assert.equal(sent[0][1],'http://localhost:5113');
    assert.equal(postPickedBlockToInventory(root,{},9),false);assert.equal(sent.length,1);
  }finally{(globalThis as any).window=previous;}
});
test('wall repair detects only cells crossed by the finite LoD2 facade edge',()=>{
  const p={x:-1,y:12,z:4};
  assert(touchesLod2Wall(p,q=>q.x===0?'lod2_exterior_wall':null));
  assert.equal(touchesLod2Wall(p,q=>q.x===2?'lod2_exterior_wall':null),false);
  assert(segmentIntersectsLod2Cell([0,0],[4,4],1,1));
  assert(segmentIntersectsLod2Cell([0,0],[1,0],0,0));
  assert.equal(segmentIntersectsLod2Cell([0,0],[1,0],1,1),false);
  assert.equal(segmentIntersectsLod2Cell([0,0],[1,0],2,0),false);
});
test('exact LoD2 wall reference wins over a roof overhang and retains its vertical span',()=>{
  const edges:any[]=lod2BuildingBoundaryGrid([{buildingId:'annex',calculation:flat,facadeSegments:[
    {start:[1,1],end:[9,1],minimumY:2,maximumY:7},
  ]}]);
  assert.equal(edges.length,1);
  assert.deepEqual(edges[0].start,[1,1]);assert.deepEqual(edges[0].end,[9,1]);
  assert.equal(edges[0].minimumY,2);assert.equal(edges[0].maximumY,7);
  assert.equal(edges[0].columnWidth,1);
});
