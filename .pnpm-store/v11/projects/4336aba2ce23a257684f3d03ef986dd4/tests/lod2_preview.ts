// Standalone QA only: real exported project geometry, no login/session bypass.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createLod2BuildingScene } from "../src/frontend/render/lod2_building_scene";

async function main() {
  const { chunks, report } = await (await fetch("./data.json")).json();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dce5e9");
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 3000);
  camera.position.set(200, 190, -220);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 8, 0);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x707d65, 2));
  const sunlight = new THREE.DirectionalLight(0xffffff, 2.8);
  sunlight.position.set(-120, 300, -100);
  scene.add(sunlight);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ color: "#a8b498", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 1;
  scene.add(ground);
  const parent = new THREE.Group();
  scene.add(parent);
  const buildings = createLod2BuildingScene(parent);
  const registry = { getVisibleChunkKeys: () => chunks.map((_: unknown, i: number) => String(i)),
    getChunk: (key: string) => ({ raw: chunks[Number(key)] }) } as any;
  const stats = buildings.sync(registry);
  const positions: number[] = [];
  for (const chunk of chunks) for (const item of chunk.metadata.geodataOverlays.items) {
    if (item.renderMode !== "surface-lines") continue;
    for (const line of item.geometry.coordinates) for (let i = 1; i < line.length; i++)
      positions.push(line[i - 1][0], 1.08, line[i - 1][1], line[i][0], 1.08, line[i][1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#087be7" })));
  document.getElementById("status")!.textContent = `${stats.buildingCount} Gebäude · ${stats.triangleCount.toLocaleString("de-DE")} Dreiecke · ${report.parcelSegmentCount} Grenzsegmente · ${stats.invalidBuildingCount} ungültige Modelle`;
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
}
main().catch((error) => { document.getElementById("status")!.textContent = `Fehler: ${error.message}`; throw error; });
