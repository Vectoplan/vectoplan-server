import {
  createPathBrushDraft,
  type PathBrushDraft,
  type PathBrushPoint,
  type PathBrushSegment,
} from "../shared/path_brush_geometry";
import type { LineBrushBuildingPreset } from "./building_presets";

export const LINE_BRUSH_BUILDING_LAYOUT_SCHEMA_VERSION =
  "vectoplan.line-brush-building-layout.v1" as const;

type Ring = readonly (readonly [number, number])[];
type MultiPolygonCoordinates = readonly (readonly Ring[])[];

export interface LineBrushBuildingLayout {
  readonly schemaVersion: typeof LINE_BRUSH_BUILDING_LAYOUT_SCHEMA_VERSION;
  readonly typeId: LineBrushBuildingPreset["typeId"];
  readonly footprint: Readonly<{
    type: "MultiPolygon";
    coordinateSpace: "world-cell-xz";
    coordinates: MultiPolygonCoordinates;
  }>;
  readonly bySegment: Readonly<Record<string, MultiPolygonCoordinates>>;
  readonly moduleCount: number;
  readonly effectiveDepthMeters: number;
  readonly clearGapMeters: number;
}

function segmentPlanLength(segment: PathBrushSegment): number {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z);
}

function segmentPointAtDistance(
  segment: PathBrushSegment,
  distance: number,
): PathBrushPoint {
  const length = Math.max(1e-9, segmentPlanLength(segment));
  const factor = Math.max(0, Math.min(1, distance / length));
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * factor,
    y: segment.start.y + (segment.end.y - segment.start.y) * factor,
    z: segment.start.z + (segment.end.z - segment.start.z) * factor,
  };
}

function moduleRectangle(
  segment: PathBrushSegment,
  startDistance: number,
  endDistance: number,
  depth: number,
): Ring | null {
  // Reuse the shared path-brush rectangle/union implementation instead of
  // maintaining another subtly different polygon builder in this tool.
  const module = createPathBrushDraft([
    segmentPointAtDistance(segment, startDistance),
    segmentPointAtDistance(segment, endDistance),
  ], { kind: "building", width: depth });
  return module?.footprint.coordinates[0]?.[0] ?? null;
}

function effectiveDepth(
  draftWidth: number,
  preset: LineBrushBuildingPreset,
): number {
  return Math.max(
    1,
    preset.arrangement.maximumDepthMeters === null
      ? draftWidth
      : Math.min(draftWidth, preset.arrangement.maximumDepthMeters),
  );
}

interface SegmentSetbacks {
  readonly start: number;
  readonly end: number;
}

function separatedModuleSetbacks(
  segments: readonly PathBrushSegment[],
  depth: number,
  clearGap: number,
  defaultSetback: number,
): Readonly<Record<string, SegmentSetbacks>> {
  const result: Record<string, { start: number; end: number }> = Object.fromEntries(
    segments.map((segment) => [String(segment.index), {
      start: defaultSetback,
      end: defaultSetback,
    }]),
  );
  const halfDepth = depth * 0.5;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const previous = segments[index]!;
    const next = segments[index + 1]!;
    const previousLength = segmentPlanLength(previous);
    const nextLength = segmentPlanLength(next);
    if (previousLength <= 1e-9 || nextLength <= 1e-9) continue;

    // The two rays point away from their common joint.  For a straight path
    // their angle is PI; for a right-angle bend it is PI/2.  The trim below is
    // the exact symmetric distance at which the two depth-wide rectangles
    // retain `clearGap` between their nearest corners:
    //   trim = halfDepth*cot(angle/2) + gap/(2*sin(angle/2)).
    // Very tight reversals deliberately consume the short segment rather than
    // creating two buildings in the same footprint.
    const previousAwayX = (previous.start.x - previous.end.x) / previousLength;
    const previousAwayZ = (previous.start.z - previous.end.z) / previousLength;
    const nextAwayX = (next.end.x - next.start.x) / nextLength;
    const nextAwayZ = (next.end.z - next.start.z) / nextLength;
    const cosine = Math.max(-1, Math.min(1,
      previousAwayX * nextAwayX + previousAwayZ * nextAwayZ,
    ));
    const halfAngle = Math.acos(cosine) * 0.5;
    const sine = Math.sin(halfAngle);
    const required = sine <= 1e-9
      ? Number.POSITIVE_INFINITY
      : halfDepth * (Math.cos(halfAngle) / sine) + clearGap / (2 * sine);
    const safeRequired = Number.isFinite(required)
      ? required
      : Math.max(previousLength, nextLength);
    const previousSetbacks = result[String(previous.index)]!;
    const nextSetbacks = result[String(next.index)]!;
    previousSetbacks.end = Math.max(previousSetbacks.end, safeRequired);
    nextSetbacks.start = Math.max(nextSetbacks.start, safeRequired);
  }
  return result;
}

function segmentModules(
  segment: PathBrushSegment,
  draftWidth: number,
  preset: LineBrushBuildingPreset,
  setbacks: SegmentSetbacks,
): MultiPolygonCoordinates {
  const arrangement = preset.arrangement;
  const depth = effectiveDepth(draftWidth, preset);
  const length = segmentPlanLength(segment);
  if (arrangement.kind === "continuous" || !arrangement.moduleLengthMeters) {
    const rectangle = moduleRectangle(segment, 0, length, depth);
    return rectangle ? [[rectangle]] : [];
  }

  const startSetback = Math.max(0, setbacks.start);
  const endSetback = Math.max(0, setbacks.end);
  const available = Math.max(0, length - startSetback - endSetback);
  if (available <= 0.5) return [];
  const desiredLength = Math.max(1, arrangement.moduleLengthMeters);
  const gap = Math.max(0, arrangement.gapMeters);
  const count = Math.max(1, Math.floor((available + gap) / (desiredLength + gap)));
  // Never create an unusably small final fragment: distribute the available
  // length evenly while retaining the architectural clear gap.
  const actualLength = Math.max(1, (available - gap * (count - 1)) / count);
  const result: Array<readonly Ring[]> = [];
  for (let index = 0; index < count; index += 1) {
    const start = startSetback + index * (actualLength + gap);
    const rectangle = moduleRectangle(segment, start, start + actualLength, depth);
    if (rectangle) result.push([rectangle]);
  }
  return result;
}

/** Both adjacent wings use the same angle-bisector joint. Rectangles overlap
 * on the inside and omit the outside miter, which used to corrupt stepped
 * storeys and roofs as soon as one segment acquired a different height. */
export function continuousLineBrushWingRing(draft: PathBrushDraft, segmentIndex: number): Ring {
  const index = draft.segments.findIndex((segment) => segment.index === segmentIndex);
  const segment = draft.segments[index]!;
  const direction = (value: PathBrushSegment): readonly [number, number] => {
    const length = segmentPlanLength(value);
    return [(value.end.x - value.start.x) / length, (value.end.z - value.start.z) / length];
  };
  const tangent = direction(segment);
  const normal: readonly [number, number] = [-tangent[1], tangent[0]];
  const first = draft.segments[0]!, last = draft.segments.at(-1)!;
  const closed = draft.segments.length > 2 && Math.hypot(first.start.x - last.end.x, first.start.z - last.end.z) < 1e-8;
  const joint = (atStart: boolean, side: number): readonly [number, number] => {
    const point = atStart ? segment.start : segment.end;
    const adjacentIndex = index + (atStart ? -1 : 1);
    const adjacent = draft.segments[closed
      ? (adjacentIndex + draft.segments.length) % draft.segments.length
      : adjacentIndex];
    let nx = normal[0], nz = normal[1];
    if (adjacent) {
      const other = direction(adjacent);
      const denominator = 1 + tangent[0] * other[0] + tangent[1] * other[1];
      if (denominator > 0.125) {
        nx = (normal[0] - other[1]) / denominator;
        nz = (normal[1] + other[0]) / denominator;
      }
    }
    return [point.x + nx * draft.width * 0.5 * side, point.z + nz * draft.width * 0.5 * side];
  };
  return [joint(true, -1), joint(false, -1), joint(false, 1), joint(true, 1)];
}

export function buildLineBrushBuildingLayout(
  draft: PathBrushDraft,
  preset: LineBrushBuildingPreset,
): LineBrushBuildingLayout {
  const bySegment: Record<string, MultiPolygonCoordinates> = {};
  const all: Array<readonly Ring[]> = [];
  const depth = effectiveDepth(draft.width, preset);
  const setbacks = preset.arrangement.kind === "separated-modules"
    ? separatedModuleSetbacks(
        draft.segments,
        depth,
        Math.max(0, preset.arrangement.gapMeters),
        Math.max(0, preset.arrangement.endSetbackMeters),
      )
    : Object.fromEntries(draft.segments.map((segment) => [String(segment.index), { start: 0, end: 0 }]));
  for (const segment of draft.segments) {
    const modules = preset.arrangement.kind === "continuous"
      ? [[continuousLineBrushWingRing(draft, segment.index)]]
      : segmentModules(
      segment,
      draft.width,
      preset,
      setbacks[String(segment.index)] ?? { start: 0, end: 0 },
    );
    bySegment[String(segment.index)] = modules;
    all.push(...modules);
  }

  // Preserve the proven unioned footprint for the neutral program, including
  // courtyard holes and mitered joints.  Program-specific separated layouts
  // deliberately use independent module polygons.
  const coordinates = preset.arrangement.kind === "continuous"
    ? draft.footprint.coordinates
    : all;
  return Object.freeze({
    schemaVersion: LINE_BRUSH_BUILDING_LAYOUT_SCHEMA_VERSION,
    typeId: preset.typeId,
    footprint: Object.freeze({
      type: "MultiPolygon" as const,
      coordinateSpace: "world-cell-xz" as const,
      coordinates,
    }),
    bySegment: Object.freeze(bySegment),
    moduleCount: preset.arrangement.kind === "continuous" ? 1 : all.length,
    effectiveDepthMeters: depth,
    clearGapMeters: preset.arrangement.gapMeters,
  });
}

export function lineBrushLayoutFootprintForSegment(
  layout: LineBrushBuildingLayout,
  segmentIndex: number,
): LineBrushBuildingLayout["footprint"] {
  return Object.freeze({
    type: "MultiPolygon" as const,
    coordinateSpace: "world-cell-xz" as const,
    coordinates: layout.bySegment[String(segmentIndex)] ?? [],
  });
}
