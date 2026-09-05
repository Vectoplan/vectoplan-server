import * as THREE from "three";

export interface LineBrushBuildingEditRef {
  readonly objectInstanceId: string;
  readonly anchor: { readonly x: number; readonly y: number; readonly z: number };
  readonly footprint: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface LineBrushBuildingEditVisuals {
  update(scene: THREE.Scene, active: boolean, selectedId?: string | null): void;
  pick(raycaster: THREE.Raycaster): LineBrushBuildingEditRef | null;
  dispose(): void;
}

type Drawable = THREE.Mesh | THREE.Line;
type Materials = THREE.Material | THREE.Material[];
interface MaterialBinding { readonly original: Materials; readonly editing: Materials }
interface BuildingRecord { ref: LineBrushBuildingEditRef; readonly bounds: THREE.Box3 }
interface GearRecord { readonly sprite: THREE.Sprite; ref: LineBrushBuildingEditRef }

const EDIT_COLOR = 0x3ba7e8;
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function parentRef(object: THREE.Object3D): LineBrushBuildingEditRef | null {
  const ref = record(object.userData.semanticObjectRef);
  if (ref.objectTypeId !== "planning_build_area" || typeof ref.objectInstanceId !== "string") return null;
  const metadata = record(ref.metadata);
  if (metadata.schemaVersion !== "vectoplan-planning-build-area.v1") return null;
  const anchor = record(ref.anchor);
  if (![anchor.x, anchor.y, anchor.z].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  return { objectInstanceId: ref.objectInstanceId, anchor: anchor as LineBrushBuildingEditRef["anchor"],
    footprint: record(ref.footprint), metadata };
}
function generatedAreaId(object: THREE.Object3D): string | null {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    const metadata = record(record(current.userData.semanticObjectRef).metadata);
    if (typeof metadata.generatedFromAreaId === "string") return metadata.generatedFromAreaId;
  }
  return null;
}
function editingMaterial(original: THREE.Material): THREE.Material {
  const material = original.clone();
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.depthTest = true;
  material.alphaTest = 0;
  const surface = material as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null; alphaMap?: THREE.Texture | null };
  surface.color?.set(EDIT_COLOR);
  // Keep relief/normal maps and lighting, but material color/alpha textures
  // must not turn a blue editing surface brown or make it see-through.
  if ("map" in surface) surface.map = null;
  if ("alphaMap" in surface) surface.alphaMap = null;
  material.needsUpdate = true;
  return material;
}
function materialList(value: Materials): THREE.Material[] { return Array.isArray(value) ? value : [value]; }

/** Rasterize the same round white-cog affordance as the roof tool without font/platform dependencies. */
function settingsTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const blue = [37, 99, 235];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - size / 2; const dy = y + 0.5 - size / 2;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const tooth = Math.cos(angle * 8) > 0.15;
      const cog = radius >= 12 && radius <= (tooth ? 36 : 28);
      const border = radius >= 49 && radius <= 53;
      const offset = (y * size + x) * 4;
      const white = cog || border;
      pixels[offset] = white ? 255 : blue[0]!;
      pixels[offset + 1] = white ? 255 : blue[1]!;
      pixels[offset + 2] = white ? 255 : blue[2]!;
      pixels[offset + 3] = Math.round(Math.max(0, Math.min(1, 54 - radius)) * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Reversible scene decoration only: never mutate or dispose persisted materials/textures. */
export function createLineBrushBuildingEditVisuals(): LineBrushBuildingEditVisuals {
  const bindings = new Map<Drawable, MaterialBinding>();
  const gears = new Map<string, GearRecord>();
  const group = new THREE.Group();
  group.name = "vectoplan_world_edit_line_brush_building_settings";
  let texture: THREE.Texture | null = null;
  let disposed = false;

  function restore(object: Drawable, binding: MaterialBinding): void {
    // Respect an independent mesh/material replacement that happened during streaming.
    if (object.material === binding.editing) object.material = binding.original;
    materialList(binding.editing).forEach((material) => material.dispose());
    bindings.delete(object);
  }
  function removeGear(id: string, gear: GearRecord): void {
    group.remove(gear.sprite);
    gear.sprite.material.dispose();
    gears.delete(id);
  }
  function clear(): void {
    for (const [object, binding] of bindings) restore(object, binding);
    for (const [id, gear] of gears) removeGear(id, gear);
    group.removeFromParent();
  }

  return {
    update(scene, active, selectedId) {
      if (disposed) return;
      if (!active) { clear(); return; }
      const buildings = new Map<string, BuildingRecord>();
      scene.traverseVisible((object) => {
        const ref = parentRef(object);
        if (ref && ref.objectInstanceId !== selectedId && !buildings.has(ref.objectInstanceId)) {
          buildings.set(ref.objectInstanceId, { ref, bounds: new THREE.Box3() });
        }
      });
      const wanted = new Set<Drawable>();
      scene.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
        const areaId = generatedAreaId(object);
        const building = areaId ? buildings.get(areaId) : undefined;
        if (!building) return;
        wanted.add(object);
        object.updateWorldMatrix(true, false);
        building.bounds.union(new THREE.Box3().setFromObject(object));
        let binding = bindings.get(object);
        if (binding && object.material !== binding.editing) { restore(object, binding); binding = undefined; }
        if (!binding) {
          const original = object.material;
          const editing = Array.isArray(original) ? original.map(editingMaterial) : editingMaterial(original);
          bindings.set(object, { original, editing });
          object.material = editing;
        }
      });
      for (const [object, binding] of bindings) if (!wanted.has(object)) restore(object, binding);
      for (const [id, gear] of gears) if (!buildings.has(id)) removeGear(id, gear);
      for (const [id, building] of buildings) {
        let gear = gears.get(id);
        if (!gear) {
          texture ??= settingsTexture();
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true,
            depthTest: false, depthWrite: false, toneMapped: false }));
          sprite.name = `vectoplan_world_edit_line_brush_settings:${id}`;
          sprite.userData = { worldEditLineBrushSettings: true, worldEditPlanningBuildAreaId: id };
          sprite.scale.set(1.65, 1.65, 1);
          sprite.renderOrder = 101;
          gear = { sprite, ref: building.ref };
          gears.set(id, gear);
          group.add(sprite);
        }
        gear.ref = building.ref;
        if (!building.bounds.isEmpty()) {
          building.bounds.getCenter(gear.sprite.position);
          gear.sprite.position.y = building.bounds.max.y + 0.72;
        } else {
          const height = Math.max(0, Number(building.ref.metadata.storeyCount) || 0)
            * Math.max(0, Number(building.ref.metadata.storeyHeightMeters) || 2.645);
          gear.sprite.position.set(building.ref.anchor.x, building.ref.anchor.y + height + 0.72, building.ref.anchor.z);
        }
      }
      if (gears.size > 0) {
        if (group.parent !== scene) { group.removeFromParent(); scene.add(group); }
        group.updateMatrixWorld(true);
      } else group.removeFromParent();
    },
    pick(raycaster) {
      if (disposed || !group.parent || !raycaster.camera) return null;
      const hit = raycaster.intersectObjects([...gears.values()].map((gear) => gear.sprite), false)[0];
      if (!hit) return null;
      const id = hit.object.userData.worldEditPlanningBuildAreaId;
      return typeof id === "string" ? gears.get(id)?.ref ?? null : null;
    },
    dispose() {
      if (disposed) return;
      clear();
      texture?.dispose();
      texture = null;
      disposed = true;
    },
  };
}
