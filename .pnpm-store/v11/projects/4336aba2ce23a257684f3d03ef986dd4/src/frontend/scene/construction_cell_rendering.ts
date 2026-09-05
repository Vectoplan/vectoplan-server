import * as THREE from "three";
import type { LineBrushBuildingBlockCell } from "../world_edit/systems/line_brush/building_geometry";

type Cell = LineBrushBuildingBlockCell;
type Range = { firstTriangle: number; endTriangle: number; cell: Cell };
export function constructionCellKey(cell: Cell): string {
  return cell.logicalCellId ? `${cell.logicalCellId}:${cell.y}` : `${cell.x}:${cell.y}:${cell.z}`;
}

export function constructionCellMaterialGroups(cells: readonly Cell[], defaultBlockTypeId: string): ReadonlyMap<string, readonly Cell[]> {
  const groups = new Map<string, Cell[]>();
  for (const cell of cells) {
    const key = cell.materialBlockTypeId || defaultBlockTypeId;
    const group = groups.get(key) ?? [];
    group.push(cell);
    groups.set(key, group);
  }
  return groups;
}

/** Draw actual partition prisms; integer positions remain editable storage addresses. */
export function createConstructionCellMesh(
  cells: readonly Cell[], material: THREE.Material, scale = 1,
): THREE.Mesh | null {
  const unique = [...new Map(cells.map((cell) => [constructionCellKey(cell), cell])).values()];
  const positions: number[] = [];
  const uvs: number[] = [];
  const ranges: Range[] = [];
  const triangle = (a: readonly number[], b: readonly number[], c: readonly number[]) => {
    const ab = b.map((value, axis) => value - a[axis]!);
    const ac = c.map((value, axis) => value - a[axis]!);
    const normal = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
    const axes = Math.abs(normal[1]!) >= Math.max(Math.abs(normal[0]!), Math.abs(normal[2]!))
      ? [0, 2] : Math.abs(normal[0]!) > Math.abs(normal[2]!) ? [2, 1] : [0, 1];
    for (const point of [a, b, c]) {
      positions.push(point[0]! * scale, point[1]! * scale, point[2]! * scale);
      uvs.push(point[axes[0]!]! * scale, point[axes[1]!]! * scale);
    }
  };
  for (const cell of unique) {
    const firstTriangle = positions.length / 9;
    const bottom = cell.minimumY ?? cell.y;
    const top = cell.maximumY ?? cell.y + 1;
    for (const [polygonIndex, raw] of (cell.footprintPolygons ?? [[[cell.x, cell.z], [cell.x + 1, cell.z], [cell.x + 1, cell.z + 1], [cell.x, cell.z + 1]]]).entries()) {
      const ring = raw.map((point, index) => ({ point,
        bottom: cell.minimumHeights?.[polygonIndex]?.[index] ?? bottom,
        top: cell.maximumHeights?.[polygonIndex]?.[index] ?? top }));
      if (ring.length > 1 && Math.hypot(ring[0]!.point[0] - ring.at(-1)!.point[0], ring[0]!.point[1] - ring.at(-1)!.point[1]) < 1e-8) ring.pop();
      if (ring.length < 3) continue;
      const signed = ring.reduce((sum, vertex, i) => { const p = vertex.point, q = ring[(i + 1) % ring.length]!.point; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
      if (signed < 0) ring.reverse();
      const at = (i: number, side: "top" | "bottom") => [ring[i]!.point[0], ring[i]![side], ring[i]!.point[1]];
      for (let i = 1; i < ring.length - 1; i += 1) {
        triangle(at(0, "top"), at(i + 1, "top"), at(i, "top"));
        triangle(at(0, "bottom"), at(i, "bottom"), at(i + 1, "bottom"));
      }
      for (let i = 0; i < ring.length; i += 1) {
        const j = (i + 1) % ring.length;
        triangle(at(i, "bottom"), at(i, "top"), at(j, "top"));
        triangle(at(i, "bottom"), at(j, "top"), at(j, "bottom"));
      }
    }
    ranges.push({ firstTriangle, endTriangle: positions.length / 9, cell });
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.constructionCellRanges = ranges;
  mesh.userData.constructionCellCount = unique.length;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function constructionCellForIntersection(hit: THREE.Intersection): Cell | null {
  if (hit.faceIndex === undefined || hit.faceIndex === null) return null;
  const ranges = hit.object.userData.constructionCellRanges as readonly Range[] | undefined;
  return ranges?.find((range) => hit.faceIndex! >= range.firstTriangle && hit.faceIndex! < range.endTriangle)?.cell ?? null;
}

/** Drop cells removed by the chunk service; never reconstruct them from stale metadata. */
export function survivingConstructionCells(
  value: unknown, occupiedCells: readonly Readonly<{ x: number; y: number; z: number }>[],
): readonly Cell[] {
  if (!Array.isArray(value)) return [];
  const occupied = new Set(occupiedCells.map((cell) => `${cell.x}:${cell.y}:${cell.z}`));
  return value.filter((cell): cell is Cell => cell && typeof cell === "object"
    && [cell.x, cell.y, cell.z].every(Number.isSafeInteger)
    && occupied.has(`${cell.x}:${cell.y}:${cell.z}`)
    && Array.isArray(cell.footprintPolygons)
    && cell.footprintPolygons.every((ring: unknown) => Array.isArray(ring) && ring.length >= 3
      && ring.every((point: unknown) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))
    && [cell.minimumHeights, cell.maximumHeights].every((heights) => heights === undefined
      || (Array.isArray(heights) && heights.length === cell.footprintPolygons.length
        && heights.every((ring: unknown, index: number) => Array.isArray(ring)
          && ring.length === cell.footprintPolygons[index].length && ring.every(Number.isFinite)))));
}
