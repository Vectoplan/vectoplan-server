import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildLineBrushRoofZones } from "../../src/frontend/world_edit/systems/line_brush/building_roofs";
import { buildLineBrushBuildingLayout } from "../../src/frontend/world_edit/systems/line_brush/building_layout";
import { buildLineBrushBuildingGeometry } from "../../src/frontend/world_edit/systems/line_brush/building_geometry";
import { lineBrushBuildingPreset } from "../../src/frontend/world_edit/systems/line_brush/building_presets";
import { createPathBrushDraft } from "../../src/frontend/world_edit/systems/shared/path_brush_geometry";
import { buildRoofCalculationRequest, DEFAULT_ROOF_TOOL_PARAMETERS, requestRoofCalculation, type RoofType } from "../../src/frontend/world_edit/systems/roof/contracts";
import { createRoofCalculationMeshes } from "../../src/frontend/scene/roof_calculation_rendering";
import { createConstructionCellMesh } from "../../src/frontend/scene/construction_cell_rendering";
import { buildLineBrushRoofWallCells, type LineBrushRoofWallZone } from "../../src/frontend/world_edit/systems/line_brush/roof_walls";
import { MULTI_WING_ROOF_PATHS, MULTI_WING_STOREYS } from "../fixtures/multi_wing_roofs";

document.body.style.cssText = "margin:0;font:14px system-ui;background:#e9eef3";
document.body.innerHTML = `<main style="position:relative;height:100vh"><section style="position:absolute;z-index:2;left:18px;top:16px;background:white;padding:14px;border-radius:8px"><strong>Mehrflügelige Dächer</strong><p>
<select aria-label="Gebäudeform"><option value="u_four">U · vier Flügel</option><option value="oblique_u">Schiefes U</option><option value="zigzag">Zickzack</option><option value="short_connector">Kurzer Verbinder</option></select>
<select aria-label="Dachform"><option value="hipped">Walmdach</option><option value="half_hipped">Krüppelwalmdach</option><option value="pyramid">Zeltdach</option></select>
<label><input type="checkbox" aria-label="Unterschiedliche Geschosse"> 7 / 6 / 8 / 5 Geschosse</label></p>
<output>Lädt …</output><p style="margin-bottom:0;color:#526779">Ziehen: drehen · Mausrad: zoomen</p></section></main>`;
const host = document.querySelector("main")!, status = document.querySelector("output")!;
const pathSelect = document.querySelector<HTMLSelectElement>('[aria-label="Gebäudeform"]')!;
const roofSelect = document.querySelector<HTMLSelectElement>('[aria-label="Dachform"]')!;
const steppedInput = document.querySelector<HTMLInputElement>("input")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(devicePixelRatio); host.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#e9eef3");
scene.add(new THREE.HemisphereLight(0xffffff, 0x607080, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(10, 70, 50); scene.add(sun);
scene.add(new THREE.GridHelper(200, 100, 0xbdc7d4, 0xd5dce4));
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
let content = new THREE.Group(), revision = 0; scene.add(content);
function framePath(): void {
  const path = MULTI_WING_ROOF_PATHS[pathSelect.value as keyof typeof MULTI_WING_ROOF_PATHS];
  const centre = new THREE.Vector3((Math.min(...path.map(p => p[0])) + Math.max(...path.map(p => p[0]))) / 2, 12,
    (Math.min(...path.map(p => p[1])) + Math.max(...path.map(p => p[1]))) / 2);
  controls.target.copy(centre); camera.position.copy(centre).add(new THREE.Vector3(70, 58, 85)); controls.update();
}
async function draw(): Promise<void> {
  const version = ++revision, next = new THREE.Group();
  const path = MULTI_WING_ROOF_PATHS[pathSelect.value as keyof typeof MULTI_WING_ROOF_PATHS];
  const roofType = roofSelect.value as RoofType;
  const draft = createPathBrushDraft(path.map(([x, z]) => ({ x, y: 0, z })), { kind: "building", width: 8 })!;
  const layout = buildLineBrushBuildingLayout(draft, lineBrushBuildingPreset("standard"));
  const counts = path.slice(1).map((_, index) => steppedInput.checked ? MULTI_WING_STOREYS[index]! : 6);
  status.textContent = "Gemeinsame CAD-Dachberechnung …";
  for (const [index, storeyCount] of counts.entries()) {
    const geometry = buildLineBrushBuildingGeometry({ draft, layout, baseY: 0, storeyCount, segmentScope: index, alignToBuildingGrid: true });
    const walls = createConstructionCellMesh(geometry.wallCells, new THREE.MeshStandardMaterial({ color: 0xe2d8c9, roughness: 0.9 }));
    const slabs = createConstructionCellMesh(geometry.slabCells, new THREE.MeshStandardMaterial({ color: 0xc0c8d2, roughness: 0.9 }));
    if (walls) next.add(walls); if (slabs) next.add(slabs);
  }
  scene.remove(content); content.traverse(object => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose();
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose()); });
  content = next; scene.add(content);
  try {
    const wallZones: LineBrushRoofWallZone[] = [];
    for (const zone of buildLineBrushRoofZones(draft, layout, roofType, true)) {
      const y = counts[zone.segmentIndex!]! * 2.645;
      const parameters = { ...DEFAULT_ROOF_TOOL_PARAMETERS, roofType, eavesHeightMm: Math.round(y * 1000),
        ridgeDirection: zone.ridgeDirection, continuationEdgesMm: zone.continuationEdgesMm, continuationEdgeIndices: zone.continuationEdgeIndices,
        edgeOverhangsMm: zone.polygon[0]!.map((_, i) => zone.interiorEdges.includes(i) ? 0 : 250) };
      const calculation = await requestRoofCalculation(buildRoofCalculationRequest(zone.polygon[0]!.map(([x, z]) => ({ x, y, z })), parameters));
      if (version !== revision) return;
      createRoofCalculationMeshes(calculation).meshes.forEach(mesh => next.add(mesh));
      wallZones.push({ ...zone, eavesY: y, calculation });
    }
    const walls = createConstructionCellMesh(buildLineBrushRoofWallCells(wallZones), new THREE.MeshStandardMaterial({ color: 0xe2d8c9, roughness: 0.9 }));
    if (walls) next.add(walls);
    status.textContent = `${counts.length} Flügel · ${counts.join(" / ")} Geschosse · CAD erfolgreich`;
  } catch (error) { if (version === revision) status.textContent = String(error); }
}
pathSelect.addEventListener("change", () => { framePath(); void draw(); });
roofSelect.addEventListener("change", () => void draw()); steppedInput.addEventListener("change", () => void draw());
function render(): void { controls.update(); renderer.render(scene, camera); requestAnimationFrame(render); }
framePath(); void draw(); render();
