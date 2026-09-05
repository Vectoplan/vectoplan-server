import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createLineBrushBuildingEditVisuals } from "../src/frontend/world_edit/systems/line_brush/building_edit_visuals";

function parent(scene: THREE.Scene, id: string, x = 0): THREE.Object3D {
  const marker = new THREE.Object3D();
  marker.userData.semanticObjectRef = { objectTypeId: "planning_build_area", objectInstanceId: id,
    anchor: { x, y: 0, z: 0 }, footprint: { type: "Polygon", coordinates: [[[x, 0], [x + 1, 0], [x, 1], [x, 0]]] },
    metadata: { schemaVersion: "vectoplan-planning-build-area.v1", storeyCount: 2, storeyHeightMeters: 2.645 } };
  scene.add(marker);
  return marker;
}
function generatedMesh(scene: THREE.Scene | THREE.Group, id: string, material: THREE.Material | THREE.Material[], y = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), material);
  mesh.position.y = y;
  mesh.userData.semanticObjectRef = { metadata: { generatedFromAreaId: id } };
  scene.add(mesh);
  return mesh;
}
function gears(scene: THREE.Scene): THREE.Sprite[] {
  const found: THREE.Sprite[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Sprite && object.userData.worldEditLineBrushSettings === true) found.push(object);
  });
  return found;
}

test("all persisted wall/slab/roof materials become opaque blue and restore exact originals without disposing resources", () => {
  const scene = new THREE.Scene();
  parent(scene, "building-a");
  const texture = new THREE.Texture();
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x996633, map: texture, transparent: true, opacity: 0.4 });
  const roofMaterials = [new THREE.MeshStandardMaterial({ color: 0x992200 }), new THREE.MeshBasicMaterial({ color: 0xffaaaa })];
  let originalDisposals = 0;
  for (const material of [wallMaterial, ...roofMaterials]) material.addEventListener("dispose", () => originalDisposals += 1);
  texture.addEventListener("dispose", () => originalDisposals += 1);
  const wall = generatedMesh(scene, "building-a", wallMaterial, 1);
  const slab = generatedMesh(scene, "building-a", wallMaterial, 2);
  const roof = generatedMesh(scene, "building-a", roofMaterials, 5);
  const unrelated = new THREE.Mesh(new THREE.BoxGeometry(), wallMaterial);
  scene.add(unrelated);
  const geometry = wall.geometry;
  const helper = createLineBrushBuildingEditVisuals();
  helper.update(scene, true);
  const firstWallEditing = wall.material;
  assert.notEqual(firstWallEditing, wallMaterial);
  assert.notEqual(slab.material, wallMaterial);
  assert.equal(unrelated.material, wallMaterial);
  assert.equal(wall.geometry, geometry);
  for (const mesh of [wall, slab, roof]) {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      assert.equal(material.transparent, false);
      assert.equal(material.opacity, 1);
      assert.equal(material.depthWrite, true);
      assert.equal((material as THREE.MeshStandardMaterial).color.getHex(), 0x3ba7e8);
    }
  }
  assert.equal((wall.material as THREE.MeshStandardMaterial).map, null);
  assert.equal(wallMaterial.map, texture);
  assert.equal(wallMaterial.opacity, 0.4);
  assert.equal(gears(scene).length, 1);
  assert.equal(gears(scene)[0]!.position.y, 6.22, "gear clears the actual highest roof face");
  helper.update(scene, true);
  assert.equal(wall.material, firstWallEditing, "no material allocation every frame");
  helper.update(scene, false);
  assert.equal(wall.material, wallMaterial);
  assert.equal(slab.material, wallMaterial);
  assert.equal(roof.material, roofMaterials, "restore the original array identity as well as materials");
  assert.equal(gears(scene).length, 0);
  helper.dispose();
  assert.equal(originalDisposals, 0);
});

test("duplicate parent refs across chunks produce one gear per building, inherited roof refs work, and picking returns the compatible parent", () => {
  const scene = new THREE.Scene();
  parent(scene, "building-a");
  parent(scene, "building-a");
  parent(scene, "building-b", 20);
  generatedMesh(scene, "building-a", new THREE.MeshStandardMaterial());
  const roofGroup = new THREE.Group();
  roofGroup.userData.semanticObjectRef = { metadata: { generatedFromAreaId: "building-b" } };
  roofGroup.position.x = 20;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), new THREE.MeshStandardMaterial());
  roofGroup.add(roof);
  scene.add(roofGroup);
  const originalRoof = roof.material;
  const helper = createLineBrushBuildingEditVisuals();
  helper.update(scene, true);
  assert.equal(gears(scene).length, 2);
  assert.notEqual(roof.material, originalRoof);
  const target = gears(scene).find((gear) => gear.userData.worldEditPlanningBuildAreaId === "building-b")!;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.copy(target.position).add(new THREE.Vector3(0, 0, 30));
  camera.lookAt(target.position);
  camera.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const picked = helper.pick(raycaster);
  assert.equal(picked?.objectInstanceId, "building-b");
  assert.deepEqual(picked?.anchor, { x: 20, y: 0, z: 0 });
  assert.equal(picked?.metadata.schemaVersion, "vectoplan-planning-build-area.v1");
  helper.update(scene, true, "building-b");
  assert.equal(roof.material, originalRoof);
  assert.equal(gears(scene).length, 1, "the controller owns the selected building's draft and settings target");
  assert.equal(helper.pick(raycaster), null);
  helper.update(scene, false);
  assert.equal(helper.pick(raycaster), null);
  helper.dispose();
});

test("streamed removal and material replacement clean up clones without overwriting new renderer materials", () => {
  const scene = new THREE.Scene();
  parent(scene, "building-a");
  const original = new THREE.MeshStandardMaterial();
  const mesh = generatedMesh(scene, "building-a", original);
  const helper = createLineBrushBuildingEditVisuals();
  helper.update(scene, true);
  let cloneDisposals = 0;
  (mesh.material as THREE.Material).addEventListener("dispose", () => cloneDisposals += 1);
  const replacement = new THREE.MeshStandardMaterial({ color: 0x222222 });
  mesh.material = replacement;
  helper.update(scene, true);
  assert.notEqual(mesh.material, replacement);
  assert.equal(cloneDisposals, 1);
  scene.remove(mesh);
  helper.update(scene, true);
  assert.equal(mesh.material, replacement);
  helper.dispose();
  helper.dispose();
  assert.equal(mesh.material, replacement);
});

test("hidden streamed buildings do not expose through-world gears and switching scenes restores old meshes", () => {
  const first = new THREE.Scene();
  const other = new THREE.Scene();
  const marker = parent(first, "building-a");
  const original = new THREE.MeshStandardMaterial();
  const mesh = generatedMesh(first, "building-a", original);
  const helper = createLineBrushBuildingEditVisuals();
  helper.update(first, true);
  assert.equal(gears(first).length, 1);
  marker.visible = false;
  helper.update(first, true);
  assert.equal(gears(first).length, 0);
  assert.equal(mesh.material, original);
  marker.visible = true;
  helper.update(first, true);
  helper.update(other, true);
  assert.equal(gears(first).length, 0);
  assert.equal(mesh.material, original);
  helper.dispose();
});
