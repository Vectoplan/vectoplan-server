import type { LineBrushBuildingStoreyGeometry } from "./building_geometry";

/** The chunk service has one owner per integer cell. Adjacent facade prisms
 * can share that address, so each physical floor must be placed as one owner. */
export function coalesceLineBrushStoreys<T extends {
  readonly storeyIndex: number;
  readonly scope: string;
  readonly storey: LineBrushBuildingStoreyGeometry;
  readonly footprint: Readonly<Record<string, unknown>>;
}>(specs: readonly T[]): T[] {
  const groups = new Map<number, T[]>();
  for (const spec of specs) {
    const group = groups.get(spec.storeyIndex) ?? [];
    group.push(spec);
    groups.set(spec.storeyIndex, group);
  }
  return [...groups.values()].map((group) => {
    const first = group[0]!;
    if (group.length === 1) return first;
    const wallCells = group.flatMap((spec) => spec.storey.wallCells);
    const slabCells = group.flatMap((spec) => spec.storey.slabCells);
    return {
      ...first,
      scope: "all",
      footprint: { ...first.footprint, type: "MultiPolygon", coordinates: group.flatMap((spec) =>
        spec.footprint.type === "MultiPolygon"
          ? spec.footprint.coordinates as unknown[]
          : [spec.footprint.coordinates]) },
      storey: { ...first.storey, wallCells, slabCells, occupiedCells: [...wallCells, ...slabCells] },
    };
  });
}
