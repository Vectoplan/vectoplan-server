// Read-only renderer QA of committed Chunk data, not a signed project session.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createRoofCalculationMeshes } from "../src/frontend/scene/roof_calculation_rendering";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS, requestRoofCalculation } from "../src/frontend/world_edit/systems/roof/contracts";
import { polygonAreaPointsFromFootprint } from "../src/frontend/world_edit/systems/polygon_area/geometry";
import { createRoofQuickSettings } from "../src/frontend/world_edit/systems/roof/quick_settings";

async function main() {
  const {chunks, parcels, report} = await (await fetch('./editable-data.json')).json();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dce5e9');
  const camera = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, .1, 3000);
  camera.position.set(200, 190, -220);
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0,8,0); controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff,0x707d65,2));
  const sun = new THREE.DirectionalLight(0xffffff,2.8); sun.position.set(-120,300,-100); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshStandardMaterial({color:'#a8b498'}));
  ground.rotation.x=-Math.PI/2;ground.position.y=1;scene.add(ground);
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#e2d9c7',roughness:1}),report.wallCells);
  const transform = new THREE.Matrix4(); let count = 0;
  const refs = new Map<string,any>();
  for (const chunk of chunks) {
    const size = chunk.chunkSize;
    for (const index of chunk.wallCells) {
      // Same x-fastest, then y, then z addressing as canonical Chunk storage.
      const x = index % size, y = Math.floor(index/size) % size, z = Math.floor(index/(size*size));
      transform.makeTranslation(chunk.chunkX*size+x+.5,chunk.chunkY*size+y+.5,chunk.chunkZ*size+z+.5);
      walls.setMatrixAt(count++,transform);
    }
    for (const ref of chunk.objectRefs) refs.set(ref.objectInstanceId,ref);
  }
  walls.instanceMatrix.needsUpdate=true; scene.add(walls);
  const rendered = new Map<string, ReturnType<typeof createRoofCalculationMeshes>>();
  function renderRoof(ref:any, calculation:unknown) {
    const previous = rendered.get(ref.objectInstanceId);
    previous?.meshes.forEach(m=>scene.remove(m)); previous?.geometries.forEach(g=>g.dispose()); previous?.materials.forEach(m=>m.dispose());
    const roof = createRoofCalculationMeshes(calculation,{objectInstanceId:ref.objectInstanceId,semanticObjectRef:ref});
    roof.meshes.forEach(m=>scene.add(m));rendered.set(ref.objectInstanceId,roof);
  }
  refs.forEach(ref=>renderRoof(ref,ref.metadata.roofCalculation));
  const positions:number[]=[];
  for (const line of parcels) for(let i=1;i<line.length;i++)positions.push(line[i-1][0],1.08,line[i-1][1],line[i][0],1.08,line[i][1]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  scene.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#087be7'})));
  const status=document.getElementById('status')!;
  const baseline=`${report.importedBuildings} Gebäude · ${count.toLocaleString('de-DE')} Wandblöcke · ${refs.size} WorldEdit-Dachzonen`;
  status.textContent=baseline;
  const selected=[...refs.values()].find(ref=>ref.metadata.roofParameters.importedSource.referencePitchDeg>0 && ref.footprint.coordinates.length===1) ?? [...refs.values()][0];
  let parameters={...DEFAULT_ROOF_TOOL_PARAMETERS,...selected.metadata.roofParameters};
  const settings=createRoofQuickSettings({root:document.body,onChange:async values=>{
    parameters={...parameters,...values};
    try {
      const calculation=await requestRoofCalculation(buildRoofCalculationRequest(polygonAreaPointsFromFootprint(selected.footprint,selected.anchor.y),parameters));
      renderRoof(selected,calculation);
      status.textContent=baseline+' · Dachvorschau geändert (nicht gespeichert)';
    } catch(error) { status.textContent=String(error); }
  }});
  document.getElementById('roof-settings')!.onclick=()=>settings.open(parameters);
  document.getElementById('reset')!.onclick=()=>{refs.forEach(ref=>renderRoof(ref,ref.metadata.roofCalculation));parameters={...DEFAULT_ROOF_TOOL_PARAMETERS,...selected.metadata.roofParameters};settings.close(false);status.textContent=baseline;};
  renderer.setAnimationLoop(()=>renderer.render(scene,camera));
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
main().catch(error=>{document.getElementById('status')!.textContent=String(error);throw error;});
