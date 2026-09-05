import type { PathBrushDraft } from "../shared/path_brush_geometry";
import type { LineBrushBuildingLayout } from "./building_layout";
import type { StoreyTargetScope } from "../storey/quick_settings";
import type { RoofType, RoofToolParameters } from "../roof/contracts";

export interface LineBrushRoofZone {
  readonly scope: StoreyTargetScope;
  readonly segmentIndex: number | null;
  readonly polygon: readonly (readonly (readonly [number, number])[])[];
  readonly ridgeDirection: number | "auto";
  /** Interior wing seams must not grow an overhang into their neighbour. */
  readonly interiorEdges: readonly number[];
  readonly continuationEdgesMm?: RoofToolParameters["continuationEdgesMm"];
  readonly continuationEdgeIndices?: readonly number[];
}

/** One longitudinal roof per wing. A single bounding-box roof across a bent
 * building tilts roofs across the courtyard and changes direction when only
 * the storey count changes. Zone topology is independent of those heights. */
export function buildLineBrushRoofZones(
  draft: PathBrushDraft, layout: LineBrushBuildingLayout, roofType: RoofType,
  separateStoreyScopes: boolean,
): readonly LineBrushRoofZone[] {
  if (roofType === "flat" && !separateStoreyScopes) return layout.footprint.coordinates.map((polygon) => ({
    scope: "all", segmentIndex: null, polygon, ridgeDirection: "auto", interiorEdges: [],
  }));
  const first = draft.segments[0], last = draft.segments.at(-1);
  const closed = draft.segments.length > 2 && first && last
    && Math.hypot(first.start.x - last.end.x, first.start.z - last.end.z) < 1e-8;
  return draft.segments.flatMap((segment, index) => {
    const length = Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z);
    const connected = layout.clearGapMeters === 0 && draft.segments.length > 1;
    const angle = Math.atan2(segment.end.z - segment.start.z, segment.end.x - segment.start.x)
      + (!connected && length < layout.effectiveDepthMeters ? Math.PI / 2 : 0);
    return (layout.bySegment[String(segment.index)] ?? []).map((polygon) => {
      const interiorEdges = layout.clearGapMeters === 0
        ? [...(closed || index < draft.segments.length - 1 ? [1] : []), ...(closed || index > 0 ? [3] : [])]
        : [];
      return {
      scope: separateStoreyScopes ? `segment:${segment.index}` as StoreyTargetScope : "all" as const,
      segmentIndex: segment.index,
      polygon,
      // Keep the oriented direction: folding at 180 degrees flips the fall
      // of asymmetric pent/sawtooth roofs on the returning wing of a U path.
      ridgeDirection: ((angle * 180 / Math.PI) % 360 + 360) % 360,
      interiorEdges,
      ...(["hipped", "half_hipped", "pyramid"].includes(roofType) && interiorEdges.length ? {
        continuationEdgeIndices: interiorEdges,
        continuationEdgesMm: interiorEdges.map(edge => {
          const a = polygon[0]![edge]!, b = polygon[0]![(edge + 1) % polygon[0]!.length]!;
          return [[a[0] * 1000, a[1] * 1000], [b[0] * 1000, b[1] * 1000]] as const;
        }),
      } : {}),
    }; });
  });
}
