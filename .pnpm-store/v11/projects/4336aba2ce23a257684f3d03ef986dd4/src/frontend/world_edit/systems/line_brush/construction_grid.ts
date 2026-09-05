import { ShapeUtils, Vector2 } from "three";
import { deriveLod2BuildingGridReference } from "../parcel_grid/building_reference";
import { buildParcelGridPartition, parcelGridPolygonArea } from "../parcel_grid/geometry";

export type ConstructionPlanPoint = readonly [number, number];
export interface ConstructionPlanCell {
  readonly x: number;
  readonly z: number;
  readonly logicalCellId: string;
  readonly footprintPolygons: readonly (readonly ConstructionPlanPoint[])[];
  readonly exterior: boolean;
}

/** Reuse the existing-building facade/anchor partition inside a new building.
 * Empty-parcel guides still govern available land. Once a facade is drawn,
 * that exact facade owns its first block row, just as a measured facade does.
 */
export function buildConstructionPlanCells(
  coordinates: readonly (readonly (readonly ConstructionPlanPoint[])[])[],
): readonly ConstructionPlanCell[] {
  const footprints = coordinates.filter((polygon) => (polygon[0]?.length ?? 0) >= 3)
    .map((polygon) => ({ outer: polygon[0]!, holes: polygon.slice(1) }));
  const reference = deriveLod2BuildingGridReference("line-brush", footprints);
  if (!reference) return [];
  const coverageTriangles = footprints.flatMap(({ outer, holes }) => {
    const open = (ring: readonly ConstructionPlanPoint[]) => {
      const result = [...ring];
      if (result.length > 1 && Math.hypot(result[0]![0] - result.at(-1)![0], result[0]![1] - result.at(-1)![1]) < 1e-8) result.pop();
      return result;
    };
    const rings = [open(outer), ...holes.map(open)];
    const vertices = rings.flat();
    return ShapeUtils.triangulateShape(
      rings[0]!.map(([x, z]) => new Vector2(x, z)),
      rings.slice(1).map((ring) => ring.map(([x, z]) => new Vector2(x, z))),
    ).map((indices) => indices.map((index) => vertices[index]!));
  });
  const points = footprints.flatMap(({ outer }) => outer);
  const partition = buildParcelGridPartition({
    coverageTriangles,
    boundarySegments: reference.facades.map((facade) => ({
      id: facade.id, parcelId: "line-brush", start: facade.start, end: facade.end,
      inward: facade.inward, length: facade.length, divisions: facade.columns,
      depth: 1, clampToDepth: true, boundaryKind: "building-facade" as const,
    })),
    regularGrid: { ...reference, id: reference.buildingId },
    bounds: {
      minimumX: Math.min(...points.map(([x]) => x)), maximumX: Math.max(...points.map(([x]) => x)),
      minimumZ: Math.min(...points.map(([, z]) => z)), maximumZ: Math.max(...points.map(([, z]) => z)),
    },
  });
  const groups = new Map<string, { polygons: ConstructionPlanPoint[][]; exterior: boolean }>();
  for (const cell of partition.cells) {
    const id = cell.logicalCellId ?? `interior:${cell.sourceCell?.x}:${cell.sourceCell?.z}`;
    const group = groups.get(id) ?? { polygons: [], exterior: false };
    group.polygons.push([...cell.polygon]);
    group.exterior ||= cell.boundaryKind === "building-facade";
    groups.set(id, group);
  }
  return [...groups.entries()].map(([logicalCellId, { polygons, exterior }]) => {
    const area = polygons.reduce((sum, ring) => sum + parcelGridPolygonArea(ring), 0);
    const center = [0, 0];
    for (const polygon of polygons) {
      const weight = parcelGridPolygonArea(polygon) / Math.max(1e-12, area);
      center[0]! += polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length * weight;
      center[1]! += polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length * weight;
    }
    return { x: Math.floor(center[0]!), z: Math.floor(center[1]!), logicalCellId,
      footprintPolygons: polygons, exterior };
  }).sort((a, b) => a.z - b.z || a.x - b.x || a.logicalCellId.localeCompare(b.logicalCellId));
}
