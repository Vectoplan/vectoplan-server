import * as THREE from "three";
import type { ChunkRegistryHandle } from "@runtime/world/chunk_registry";
import {
  resolveVisualLayer,
  visualLayerKind,
  type VisualLayerResolutionSnapshot,
} from "./visual_layer_resolver";
import {
  LOD2_EXISTING_ROOF_COLOR,
  LOD2_EXISTING_WALL_COLOR,
} from "../scene/lod2_existing_appearance";

type Point = readonly [number, number, number];
interface Polygon { surface: string; rings: Point[][] }
interface Building { id: string; polygons: Polygon[]; sourceTile: string; sourceSha256: string }
export interface Lod2Stats { buildingCount: number; triangleCount: number; invalidBuildingCount: number }

function record(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}

function parseBuilding(value: unknown): Building | null {
  const item = record(value);
  if (!item || typeof item.id !== "string" || !Array.isArray(item.polygons)) return null;
  let vertexCount = 0;
  const polygons: Polygon[] = [];
  for (const polygon of item.polygons) {
    if (!record(polygon) || !Array.isArray(polygon.rings) || polygon.rings.length === 0) return null;
    const rings: Point[][] = [];
    for (const ring of polygon.rings) {
      if (!Array.isArray(ring) || ring.length < 4) return null;
      if (ring.some((p) => !Array.isArray(p) || p.length !== 3 || p.some((v) => typeof v !== "number" || !Number.isFinite(v)))) return null;
      const first = ring[0], last = ring[ring.length - 1];
      if (first.some((v: number, i: number) => v !== last[i])) return null;
      vertexCount += ring.length;
      if (vertexCount > 200_000) return null;
      rings.push(ring.slice(0, -1));
    }
    polygons.push({ surface: String(polygon.surface ?? "Surface"), rings });
  }
  return { id: item.id, polygons, sourceTile: String(item.sourceTile ?? ""), sourceSha256: String(item.sourceSha256 ?? "") };
}

/** Project each planar 3D face onto its dominant plane before earcut.
 * X/Z-only triangulation collapses vertical walls; triangle fans fill courtyards
 * and fail on concave roof outlines. Preserve every interior ring instead.
 */
export function triangulateLod2Polygon(rings: readonly (readonly Point[])[]): Point[][] {
  if (rings.length === 0 || rings[0].length < 3) return [];
  const exterior = rings[0];
  const normal = new THREE.Vector3();
  const origin = new THREE.Vector3(...exterior[0]);
  for (let i = 0; i < exterior.length; i += 1) {
    const a = new THREE.Vector3(...exterior[i]).sub(origin);
    const b = new THREE.Vector3(...exterior[(i + 1) % exterior.length]).sub(origin);
    normal.add(a.cross(b));
  }
  if (normal.lengthSq() < 1e-16) return [];
  const drop = Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z)
    ? 0 : Math.abs(normal.y) >= Math.abs(normal.z) ? 1 : 2;
  const axes = [0, 1, 2].filter((i) => i !== drop);
  const projected = rings.map((ring) => ring.map((point) => new THREE.Vector2(
    point[axes[0]] - exterior[0][axes[0]], point[axes[1]] - exterior[0][axes[1]],
  )));
  const points = rings.flat();
  return THREE.ShapeUtils.triangulateShape(projected[0], projected.slice(1))
    .map((face) => face.map((index) => points[index]) as Point[])
    .filter((face) => new THREE.Vector3(...face[1]).sub(new THREE.Vector3(...face[0]))
      .cross(new THREE.Vector3(...face[2]).sub(new THREE.Vector3(...face[0]))).lengthSq() > 1e-16);
}

export function buildLod2Mesh(value: unknown): THREE.Mesh | null {
  const feature = parseBuilding(value);
  if (!feature || feature.polygons.length === 0) return null;
  const positions: number[] = [], colors: number[] = [];
  const origin = new THREE.Vector3(...feature.polygons[0].rings[0][0]);
  for (const polygon of feature.polygons) {
    const color = new THREE.Color(polygon.surface === "RoofSurface" ? LOD2_EXISTING_ROOF_COLOR
      : polygon.surface === "GroundSurface" ? "#d9dde1" : LOD2_EXISTING_WALL_COLOR);
    for (const triangle of triangulateLod2Polygon(polygon.rings)) {
      for (const point of triangle) {
        positions.push(point[0] - origin.x, point[1] - origin.y, point[2] - origin.z);
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .9, metalness: 0, side: THREE.DoubleSide, flatShading: true,
  }));
  mesh.position.copy(origin);
  mesh.name = `lod2_${feature.id}`;
  mesh.userData = { kind: "geodata-building", buildingId: feature.id, sourceTile: feature.sourceTile,
    sourceSha256: feature.sourceSha256, datasetId: "3d-gebaeudedaten", lod: 2,
    affectsVoxelState: false, affectsCollision: false, triangleCount: positions.length / 9 };
  return mesh;
}

export function createLod2BuildingScene(parent: THREE.Group) {
  const group = new THREE.Group();
  group.name = "vectoplan_lod2_buildings";
  parent.add(group);
  const meshes = new Map<string, { signature: string; mesh: THREE.Mesh }>();
  let resolutions: Readonly<Record<string, VisualLayerResolutionSnapshot>> = {};
  function remove(key: string): void {
    const entry = meshes.get(key);
    if (!entry) return;
    group.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    const materials = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
    materials.forEach((material) => material.dispose());
    meshes.delete(key);
  }
  return {
    sync(registry: ChunkRegistryHandle): Lod2Stats {
      const wanted = new Map<string, { signature: string; feature: unknown }>();
      const nextResolutions: Record<string, VisualLayerResolutionSnapshot> = {};
      for (const chunkKey of registry.getVisibleChunkKeys()) {
        const contract = record(record(registry.getChunk(chunkKey)?.raw.metadata)?.geodataOverlays);
        if (contract?.schemaVersion !== "geodata-overlays.v1" || !Array.isArray(contract.items)) continue;
        const resolution = resolveVisualLayer(contract, ["lod2"]);
        nextResolutions[chunkKey] = resolution;
        if (resolution.selectedKind !== "lod2") continue;
        const selectedItemIds = new Set(resolution.selectedItemIds);
        for (const [itemIndex, item] of contract.items.entries()) {
          const resolvedItemId = typeof item?.id === "string" && item.id.trim()
            ? item.id.trim()
            : `${typeof item?.datasetId === "string" && item.datasetId.trim() ? item.datasetId.trim() : "overlay"}:${itemIndex}`;
          if (item?.renderMode !== "building-meshes" || item.geometry?.dimensions !== "world-xyz"
            || item.geometry?.type !== "BuildingMultiSurface" || !Array.isArray(item.geometry.features)
            || visualLayerKind(item) !== "lod2" || !selectedItemIds.has(resolvedItemId)) continue;
          for (const feature of item.geometry.features) {
            if (typeof feature?.id !== "string") continue;
            // A complete building may intersect many horizontal AND vertical
            // chunks. Keep one mesh while any visible chunk still references it.
            const key = `${item.datasetId}:${feature.id}`;
            const signature = `${feature.sourceSha256}:${contract.referenceFingerprint}:${JSON.stringify(item.heightReference)}`;
            if (!wanted.has(key)) wanted.set(key, { signature, feature });
          }
        }
      }
      resolutions = nextResolutions;
      group.userData.visualLayerResolutions = resolutions;
      for (const key of meshes.keys()) if (!wanted.has(key)) remove(key);
      let invalidBuildingCount = 0;
      for (const [key, entry] of wanted) {
        if (meshes.get(key)?.signature === entry.signature) continue;
        remove(key);
        const mesh = buildLod2Mesh(entry.feature);
        if (!mesh) { invalidBuildingCount += 1; continue; }
        group.add(mesh);
        meshes.set(key, { signature: entry.signature, mesh });
      }
      const stats = { buildingCount: meshes.size, invalidBuildingCount,
        triangleCount: [...meshes.values()].reduce((sum, entry) => sum + entry.mesh.userData.triangleCount, 0) };
      group.userData.stats = stats;
      return stats;
    },
    dispose(): void {
      for (const key of meshes.keys()) remove(key);
      resolutions = {};
      delete group.userData.visualLayerResolutions;
      group.removeFromParent();
    },
    getGroup: () => group,
    getVisualLayerResolutions: () => resolutions,
  };
}
