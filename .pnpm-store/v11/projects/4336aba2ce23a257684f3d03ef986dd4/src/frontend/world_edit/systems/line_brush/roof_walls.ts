import { roofSurfaceTriangles, type RoofTriangle } from "../../../scene/roof_surface_geometry";
import { buildConstructionPlanCells, type ConstructionPlanPoint } from "./construction_grid";
import { reserveLineBrushBuildingCellBudget, type LineBrushBuildingBlockCell, type LineBrushBuildingStoreyGeometry } from "./building_geometry";

type Point = ConstructionPlanPoint;
type Height = (point: Point) => number;
const EPSILON = 1e-7;

export interface LineBrushRoofWallZone {
  readonly scope: string;
  readonly polygon: readonly (readonly Point[])[];
  readonly interiorEdges: readonly number[];
  readonly eavesY: number;
  readonly calculation: unknown;
}

export interface LineBrushRoofWallCell extends LineBrushBuildingBlockCell {
  readonly roofScope: string;
  readonly roofZoneIndex: number;
}

function openRing(ring: readonly Point[]): Point[] {
  const result = [...ring];
  if (result.length > 1 && distance(result[0]!, result.at(-1)!) < EPSILON) result.pop();
  return result;
}

function distance(a: Point, b: Point): number { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function area(ring: readonly Point[]): number {
  return Math.abs(ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]!; return sum + a[0] * b[1] - a[1] * b[0]; }, 0)) / 2;
}

/** Convex clipping preserves every roof ridge, height-layer boundary and seam. */
function clip(ring: readonly Point[], inside: Height): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!, av = inside(a), bv = inside(b);
    if (av >= -EPSILON) result.push(a);
    if ((av > EPSILON && bv < -EPSILON) || (av < -EPSILON && bv > EPSILON)) {
      const t = av / (av - bv);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result.filter((p, i) => distance(p, result[(i + result.length - 1) % result.length]!) > EPSILON);
}

function facet(triangle: RoofTriangle): { ring: Point[]; height: Height } | null {
  const [a, b, c] = triangle;
  const determinant = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
  if (Math.abs(determinant) < EPSILON) return null;
  const x = ((b[1] - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (b[2] - a[2])) / determinant;
  const z = ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / determinant;
  const ring: Point[] = triangle.map(p => [p[0], p[2]]);
  if (determinant < 0) ring.reverse();
  return { ring, height: p => a[1] + x * (p[0] - a[0]) + z * (p[1] - a[2]) };
}

function insideFacet(ring: readonly Point[], boundary: readonly Point[]): Point[] {
  let result = [...ring];
  boundary.forEach((a, i) => {
    const b = boundary[(i + 1) % boundary.length]!;
    result = clip(result, p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  });
  return result;
}

function touchesEdge(ring: readonly Point[], a: Point, b: Point): boolean {
  const length = distance(a, b), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  const onLine = (p: Point) => Math.abs(dx * (p[1] - a[1]) - dz * (p[0] - a[0])) < 1e-5;
  const along = (p: Point) => dx * (p[0] - a[0]) + dz * (p[1] - a[1]);
  return ring.some((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    return onLine(p) && onLine(q) && Math.min(length, Math.max(along(p), along(q)))
      - Math.max(0, Math.min(along(p), along(q))) > EPSILON;
  });
}

/** Gable and pent infill uses the CAD structural plane, immediately below
 * its continuous roof build-up. Exterior tile offsets would shift the facade.
 * Each fragment remains a breakable construction-grid block with exact cuts. */
export function buildLineBrushRoofWallCells(zones: readonly LineBrushRoofWallZone[]): readonly LineBrushRoofWallCell[] {
  const result: LineBrushRoofWallCell[] = [];
  const facets = zones.map(zone => roofSurfaceTriangles(zone.calculation).map(facet).filter(item => item !== null));
  let fragmentIndex = 0;
  for (const [zoneIndex, zone] of zones.entries()) {
    const ring = openRing(zone.polygon[0] ?? []);
    if (ring.length < 3 || !facets[zoneIndex]!.length) continue;
    const plan = buildConstructionPlanCells([zone.polygon]).filter(cell => cell.exterior);
    for (const cell of plan) for (const raw of cell.footprintPolygons) {
      const polygon = openRing(raw);
      const edges = ring.flatMap((a, index) => touchesEdge(polygon, a, ring[(index + 1) % ring.length]!) ? [index] : []);
      const external = edges.some(edge => !zone.interiorEdges.includes(edge));
      const lowers: { region: readonly Point[]; height: Height }[] = [];
      if (external) lowers.push({ region: polygon, height: () => zone.eavesY });
      else for (const edge of edges) {
        if (!zone.interiorEdges.includes(edge)) continue;
        const a = ring[edge]!, b = ring[(edge + 1) % ring.length]!, length = distance(a, b);
        const direction: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
        const along = (p: Point) => direction[0] * (p[0] - a[0]) + direction[1] * (p[1] - a[1]);
        const projected = (p: Point): Point => [a[0] + direction[0] * along(p), a[1] + direction[1] * along(p)];
        for (const [otherIndex, other] of zones.entries()) {
          if (otherIndex === zoneIndex || Math.abs(other.eavesY - zone.eavesY) < EPSILON) continue;
          const otherRing = openRing(other.polygon[0] ?? []);
          if (!otherRing.some((p, i) => {
            const q = otherRing[(i + 1) % otherRing.length]!;
            return (distance(a, p) < 1e-5 && distance(b, q) < 1e-5)
              || (distance(a, q) < 1e-5 && distance(b, p) < 1e-5);
          })) continue;
          for (const lower of facets[otherIndex]!) {
            // Extend only the adjoining roof's edge profile across wall depth.
            // Restrict its domain along the seam, preserving ridges/breaks.
            let region = polygon;
            lower.ring.forEach((p, i) => {
              const q = lower.ring[(i + 1) % lower.ring.length]!;
              region = clip(region, value => { const v = projected(value); return (q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]); });
            });
            if (area(region) < EPSILON) continue;
            const height: Height = p => lower.height(projected(p));
            const aboveEaves = clip(region, p => height(p) - zone.eavesY);
            const belowEaves = clip(region, p => zone.eavesY - height(p));
            if (area(aboveEaves) > EPSILON) lowers.push({ region: aboveEaves, height });
            if (area(belowEaves) > EPSILON) lowers.push({ region: belowEaves, height: () => zone.eavesY });
          }
        }
      }
      for (const upper of facets[zoneIndex]!) for (const lower of lowers) {
        let footprint = insideFacet(lower.region, upper.ring);
        footprint = clip(footprint, p => upper.height(p) - lower.height(p));
        if (area(footprint) < EPSILON) continue;
        const minimum = Math.min(...footprint.map(lower.height)), maximum = Math.max(...footprint.map(upper.height));
        if (maximum - minimum < EPSILON || maximum > minimum + 256) continue;
        for (let y = Math.floor(minimum); y < Math.ceil(maximum); y += 1) {
          let layer = clip(clip(footprint, p => upper.height(p) - y), p => y + 1 - lower.height(p));
          if (area(layer) < EPSILON) continue;
          for (const topIsCut of [false, true]) for (const bottomIsCut of [false, true]) {
            if (topIsCut && layer.every(p => Math.abs(upper.height(p) - y - 1) < EPSILON)) continue;
            let piece = clip(layer, p => topIsCut ? y + 1 - upper.height(p) : upper.height(p) - y - 1);
            if (bottomIsCut && piece.every(p => Math.abs(lower.height(p) - y) < EPSILON)) continue;
            piece = clip(piece, p => bottomIsCut ? lower.height(p) - y : y - lower.height(p));
            if (area(piece) < EPSILON) continue;
            const bottoms = piece.map(p => bottomIsCut ? lower.height(p) : y);
            const tops = piece.map(p => topIsCut ? upper.height(p) : y + 1);
            if (tops.every((height, i) => height - bottoms[i]! < EPSILON)) continue;
            reserveLineBrushBuildingCellBudget(result.length, 1);
            result.push({ x: cell.x, y, z: cell.z, exterior: true, roofScope: zone.scope, roofZoneIndex: zoneIndex,
              logicalCellId: `roof-wall:${zoneIndex}:${fragmentIndex++}`,
              footprintPolygons: [piece], minimumHeights: [bottoms], maximumHeights: [tops],
              minimumY: Math.min(...bottoms), maximumY: Math.max(...tops) });
          }
        }
      }
    }
  }
  return result;
}

/** A wall fragment can share an integer address with a neighbouring slab.
 * Keep that single owner, and carry the wall material on the fragment. */
export function attachLineBrushRoofWallCells<T extends {
  readonly scope: string; readonly storeyIndex: number; readonly storey: LineBrushBuildingStoreyGeometry;
}>(specs: readonly T[], cells: readonly LineBrushRoofWallCell[], wallBlockTypeId: string): T[] {
  const result = specs.map(spec => ({ ...spec, storey: { ...spec.storey,
    wallCells: [...spec.storey.wallCells], slabCells: [...spec.storey.slabCells] } }));
  const key = (cell: LineBrushBuildingBlockCell) => `${cell.x}:${cell.y}:${cell.z}`;
  const owners = new Map<string, LineBrushBuildingBlockCell[]>();
  result.forEach(spec => [spec.storey.wallCells, spec.storey.slabCells].forEach(assembly => assembly.forEach(cell => owners.set(key(cell), assembly))));
  for (const cell of cells) {
    let owner = owners.get(key(cell));
    if (!owner) {
      const candidates = result.filter(spec => spec.scope === cell.roofScope);
      const target = (candidates.length ? candidates : result).reduce<typeof result[number] | null>((best, spec) => !best || spec.storeyIndex > best.storeyIndex ? spec : best, null);
      if (!target) continue;
      owner = target.storey.wallCells;
      owners.set(key(cell), owner);
    }
    owner.push({ ...cell, materialBlockTypeId: wallBlockTypeId });
  }
  return result.map(spec => ({ ...spec, storey: { ...spec.storey,
    occupiedCells: [...spec.storey.wallCells, ...spec.storey.slabCells] } }));
}
