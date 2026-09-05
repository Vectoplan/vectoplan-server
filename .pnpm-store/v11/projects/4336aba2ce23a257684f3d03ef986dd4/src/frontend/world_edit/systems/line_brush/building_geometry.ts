import type { PathBrushDraft } from "../shared/path_brush_geometry";
import { buildConstructionPlanCells, type ConstructionPlanPoint } from "./construction_grid";
import {
  STANDARD_STOREY_HEIGHT_METERS,
  STANDARD_STOREY_HEIGHT_MILLIMETERS,
} from "./building_programs";
import {
  lineBrushLayoutFootprintForSegment,
  type LineBrushBuildingLayout,
} from "./building_layout";

/**
 * Pure voxel geometry for a building created from the planning line brush.
 *
 * The semantic building height remains millimetre-exact. Only persistence
 * cells are quantised to whole world blocks. This module intentionally owns no
 * scene, DOM, camera, mode or command state, so Ego and planning can consume
 * exactly the same result.
 */

export const LINE_BRUSH_BUILDING_GEOMETRY_SCHEMA_VERSION =
  "vectoplan.line-brush-building-geometry.v1" as const;
export const LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS = 65_536 as const;

const PLAN_EPSILON = 1e-8;
const FOUR_NEIGHBOURS = Object.freeze([
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const);

export interface LineBrushBuildingPlanCell {
  readonly x: number;
  readonly z: number;
  readonly logicalCellId?: string;
  readonly footprintPolygons?: readonly (readonly ConstructionPlanPoint[])[];
  readonly exterior?: boolean;
}

export interface LineBrushBuildingBlockCell extends LineBrushBuildingPlanCell {
  readonly y: number;
  readonly minimumY?: number;
  readonly maximumY?: number;
  /** Per-polygon corner heights for roof-cut wall blocks. */
  readonly minimumHeights?: readonly (readonly number[])[];
  readonly maximumHeights?: readonly (readonly number[])[];
  /** A shared integer owner may contain a wall fragment beside a floor slab. */
  readonly materialBlockTypeId?: string;
}

export type LineBrushBuildingSegmentScope =
  | "all"
  | number
  | Readonly<{ kind: "all" }>
  | Readonly<{ kind: "segment"; segmentIndex: number }>;

export interface LineBrushBuildingGeometryInput {
  readonly draft: PathBrushDraft;
  readonly baseY: number;
  readonly storeyCount: number;
  /** Optional program layout; absent keeps the proven continuous footprint. */
  readonly layout?: LineBrushBuildingLayout;
  /** Exact facade rows from the shared existing-building grid partition. */
  readonly alignToBuildingGrid?: boolean;
  /** Defaults to the complete, already-unioned line-brush footprint. */
  readonly segmentScope?: LineBrushBuildingSegmentScope;
}

export interface LineBrushBuildingStoreyGeometry {
  readonly storeyIndex: number;
  readonly semanticBaseY: number;
  readonly semanticTopY: number;
  readonly semanticHeightMeters: typeof STANDARD_STOREY_HEIGHT_METERS;
  readonly semanticHeightMillimeters: typeof STANDARD_STOREY_HEIGHT_MILLIMETERS;
  /** Inclusive whole-block lower boundary. */
  readonly minimumCellY: number;
  /** Exclusive whole-block upper boundary. */
  readonly maximumCellYExclusive: number;
  /** Complete footprint plate at the quantised base of this storey. */
  readonly slabY: number;
  /**
   * Exterior envelope blocks, including walls around courtyard holes. The
   * slab layer is deliberately excluded so wall and slab can use distinct
   * Library blocks without one placement overwriting the other.
   */
  readonly wallCells: readonly LineBrushBuildingBlockCell[];
  /** Every footprint cell at slabY, not only the envelope. */
  readonly slabCells: readonly LineBrushBuildingBlockCell[];
  /** Stable union of wallCells and slabCells. */
  readonly occupiedCells: readonly LineBrushBuildingBlockCell[];
}

export interface LineBrushBuildingGeometry {
  readonly schemaVersion: typeof LINE_BRUSH_BUILDING_GEOMETRY_SCHEMA_VERSION;
  readonly segmentScope: Readonly<
    { kind: "all" }
    | { kind: "segment"; segmentIndex: number }
  >;
  readonly baseY: number;
  readonly storeyCount: number;
  readonly storeyHeightMeters: typeof STANDARD_STOREY_HEIGHT_METERS;
  readonly storeyHeightMillimeters: typeof STANDARD_STOREY_HEIGHT_MILLIMETERS;
  readonly totalHeightMeters: number;
  readonly totalHeightMillimeters: number;
  /** Cells selected by their centre point in the scoped footprint. */
  readonly footprintCells: readonly LineBrushBuildingPlanCell[];
  /** Footprint cells with at least one outside 4-neighbour. */
  readonly exteriorFootprintCells: readonly LineBrushBuildingPlanCell[];
  readonly storeys: readonly LineBrushBuildingStoreyGeometry[];
  readonly wallCells: readonly LineBrushBuildingBlockCell[];
  readonly slabCells: readonly LineBrushBuildingBlockCell[];
  readonly occupiedCells: readonly LineBrushBuildingBlockCell[];
}

export type LineBrushBuildingGeometryErrorCode =
  | "invalid-draft"
  | "invalid-base-y"
  | "invalid-storey-count"
  | "invalid-segment-scope"
  | "empty-footprint"
  | "cell-limit-exceeded";

export class LineBrushBuildingGeometryError extends Error {
  readonly code: LineBrushBuildingGeometryErrorCode;
  readonly cellLimit: number;
  readonly requestedCells: number | null;

  constructor(
    code: LineBrushBuildingGeometryErrorCode,
    message: string,
    requestedCells: number | null = null,
  ) {
    super(message);
    this.name = "LineBrushBuildingGeometryError";
    this.code = code;
    this.cellLimit = LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS;
    this.requestedCells = requestedCells;
  }
}

type PlanPoint = readonly [number, number];

interface RasterPolygon {
  readonly outer: readonly PlanPoint[];
  readonly holes: readonly (readonly PlanPoint[])[];
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumZ: number;
  readonly maximumZ: number;
}

type CanonicalSegmentScope = LineBrushBuildingGeometry["segmentScope"];

function invalid(
  code: Exclude<LineBrushBuildingGeometryErrorCode, "cell-limit-exceeded">,
  message: string,
): never {
  throw new LineBrushBuildingGeometryError(code, message);
}

function limitExceeded(requestedCells: number): never {
  throw new LineBrushBuildingGeometryError(
    "cell-limit-exceeded",
    `Line-brush building geometry exceeds the ${LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS.toLocaleString("en-US")}-cell limit.`,
    requestedCells,
  );
}

/**
 * Reserve cells against the shared line-brush transaction budget.
 *
 * A generated building is split into one geometry per storey/scope. Each
 * geometry enforces its own limit, but the complete live preview/ObjectBatch
 * must obey the same limit as one deterministic operation as well.
 */
export function reserveLineBrushBuildingCellBudget(
  occupiedCells: number,
  additionalCells: number,
): number {
  const current = Number.isSafeInteger(occupiedCells) && occupiedCells >= 0
    ? occupiedCells
    : LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS + 1;
  const additional = Number.isSafeInteger(additionalCells) && additionalCells >= 0
    ? additionalCells
    : LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS + 1;
  const requested = current + additional;
  if (!Number.isSafeInteger(requested) || requested > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS) {
    limitExceeded(Number.isSafeInteger(requested) ? requested : Number.MAX_SAFE_INTEGER);
  }
  return requested;
}

function samePoint(first: PlanPoint, second: PlanPoint): boolean {
  return Math.abs(first[0] - second[0]) <= PLAN_EPSILON
    && Math.abs(first[1] - second[1]) <= PLAN_EPSILON;
}

function signedArea(ring: readonly PlanPoint[]): number {
  let twiceArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index]!;
    const next = ring[(index + 1) % ring.length]!;
    twiceArea += point[0] * next[1] - next[0] * point[1];
  }
  return twiceArea * 0.5;
}

function normalizeRing(value: unknown, label: string): readonly PlanPoint[] {
  if (!Array.isArray(value)) invalid("invalid-draft", `${label} must be an array of x/z coordinates.`);
  const result: PlanPoint[] = [];
  for (const rawPoint of value) {
    if (!Array.isArray(rawPoint)) invalid("invalid-draft", `${label} contains a non-coordinate value.`);
    const x = Number(rawPoint[0]);
    const z = Number(rawPoint[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      invalid("invalid-draft", `${label} contains a non-finite coordinate.`);
    }
    if (!Number.isSafeInteger(Math.floor(x)) || !Number.isSafeInteger(Math.floor(z))) {
      invalid("invalid-draft", `${label} lies outside the safe whole-cell coordinate range.`);
    }
    const point: PlanPoint = [x, z];
    if (!result.at(-1) || !samePoint(result.at(-1)!, point)) result.push(point);
  }
  if (result.length > 1 && samePoint(result[0]!, result.at(-1)!)) result.pop();
  if (result.length < 3 || Math.abs(signedArea(result)) <= PLAN_EPSILON) {
    invalid("invalid-draft", `${label} must contain a non-degenerate polygon ring.`);
  }
  return result;
}

function rasterPolygon(value: unknown, label: string): RasterPolygon {
  if (!Array.isArray(value) || value.length === 0) {
    invalid("invalid-draft", `${label} must contain an exterior ring.`);
  }
  const outer = normalizeRing(value[0], `${label} exterior ring`);
  const holes = value.slice(1).map((ring, index) => normalizeRing(
    ring,
    `${label} hole ${index}`,
  ));
  const xs = outer.map((point) => point[0]);
  const zs = outer.map((point) => point[1]);
  return {
    outer,
    holes,
    minimumX: Math.min(...xs),
    maximumX: Math.max(...xs),
    minimumZ: Math.min(...zs),
    maximumZ: Math.max(...zs),
  };
}

function canonicalScope(
  draft: PathBrushDraft,
  value: LineBrushBuildingSegmentScope | undefined,
): CanonicalSegmentScope {
  if (value === undefined || value === "all" || (typeof value === "object" && value?.kind === "all")) {
    return Object.freeze({ kind: "all" });
  }
  const segmentIndex = typeof value === "number"
    ? value
    : typeof value === "object" && value?.kind === "segment"
      ? value.segmentIndex
      : Number.NaN;
  if (!Number.isSafeInteger(segmentIndex) || !draft.segments.some((segment) => segment.index === segmentIndex)) {
    invalid("invalid-segment-scope", `Line-brush segment ${String(segmentIndex)} does not exist.`);
  }
  return Object.freeze({ kind: "segment", segmentIndex });
}

function polygonsForScope(
  draft: PathBrushDraft,
  scope: CanonicalSegmentScope,
  layout?: LineBrushBuildingLayout,
): readonly RasterPolygon[] {
  if (scope.kind === "segment") {
    if (layout) {
      const footprint = lineBrushLayoutFootprintForSegment(layout, scope.segmentIndex);
      return footprint.coordinates.map((polygon, index) => rasterPolygon(
        polygon,
        `segment ${scope.segmentIndex} module ${index}`,
      ));
    }
    const segment = draft.segments.find((candidate) => candidate.index === scope.segmentIndex)!;
    return [rasterPolygon([segment.rectangle], `segment ${scope.segmentIndex}`)];
  }
  const footprint = (layout?.footprint ?? draft.footprint) as PathBrushDraft["footprint"] | undefined;
  if (footprint?.type !== "MultiPolygon" || footprint.coordinateSpace !== "world-cell-xz"
    || !Array.isArray(footprint.coordinates) || footprint.coordinates.length === 0) {
    invalid("invalid-draft", "The line-brush draft has no world-cell MultiPolygon footprint.");
  }
  return footprint.coordinates.map((polygon, index) => rasterPolygon(polygon, `footprint polygon ${index}`));
}

function orientation(first: PlanPoint, second: PlanPoint, point: PlanPoint): number {
  return (second[0] - first[0]) * (point[1] - first[1])
    - (second[1] - first[1]) * (point[0] - first[0]);
}

function pointOnRing(point: PlanPoint, ring: readonly PlanPoint[]): boolean {
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index]!;
    const end = ring[(index + 1) % ring.length]!;
    const edgeLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (Math.abs(orientation(start, end, point)) > PLAN_EPSILON * Math.max(1, edgeLength)) continue;
    if (point[0] >= Math.min(start[0], end[0]) - PLAN_EPSILON
      && point[0] <= Math.max(start[0], end[0]) + PLAN_EPSILON
      && point[1] >= Math.min(start[1], end[1]) - PLAN_EPSILON
      && point[1] <= Math.max(start[1], end[1]) + PLAN_EPSILON) return true;
  }
  return false;
}

function pointInRing(point: PlanPoint, ring: readonly PlanPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const current = ring[index]!;
    const prior = ring[previous]!;
    if (((current[1] > point[1]) !== (prior[1] > point[1]))
      && point[0] < (prior[0] - current[0]) * (point[1] - current[1])
        / (prior[1] - current[1]) + current[0]) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: PlanPoint, polygon: RasterPolygon): boolean {
  if (pointOnRing(point, polygon.outer)) {
    return !polygon.holes.some((hole) => pointOnRing(point, hole) || pointInRing(point, hole));
  }
  if (!pointInRing(point, polygon.outer)) return false;
  return !polygon.holes.some((hole) => pointOnRing(point, hole) || pointInRing(point, hole));
}

function scanlineIntersections(ring: readonly PlanPoint[], z: number): number[] {
  const result: number[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index]!;
    const end = ring[(index + 1) % ring.length]!;
    if ((start[1] > z) === (end[1] > z)) continue;
    result.push(start[0] + (z - start[1]) * (end[0] - start[0]) / (end[1] - start[1]));
  }
  return result;
}

function horizontalBoundaryIntervals(ring: readonly PlanPoint[], z: number): Array<readonly [number, number]> {
  const result: Array<readonly [number, number]> = [];
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index]!;
    const end = ring[(index + 1) % ring.length]!;
    if (Math.abs(start[1] - end[1]) <= PLAN_EPSILON && Math.abs(start[1] - z) <= PLAN_EPSILON) {
      result.push([Math.min(start[0], end[0]), Math.max(start[0], end[0])]);
    }
  }
  return result;
}

function planKey(cell: LineBrushBuildingPlanCell): string {
  return `${cell.x}:${cell.z}`;
}

function worldKey(cell: LineBrushBuildingBlockCell): string {
  return cell.logicalCellId ? `${cell.logicalCellId}:${cell.y}` : `${cell.x}:${cell.y}:${cell.z}`;
}

function comparePlanCells(first: LineBrushBuildingPlanCell, second: LineBrushBuildingPlanCell): number {
  return first.z - second.z || first.x - second.x;
}

function compareBlockCells(first: LineBrushBuildingBlockCell, second: LineBrushBuildingBlockCell): number {
  return first.y - second.y || first.z - second.z || first.x - second.x;
}

function safeRequestedCells(value: bigint): number {
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
}

function rasterizeFootprint(polygons: readonly RasterPolygon[]): LineBrushBuildingPlanCell[] {
  const cells = new Map<string, LineBrushBuildingPlanCell>();
  for (const polygon of polygons) {
    const minimumCellX = Math.ceil(polygon.minimumX - 0.5 - PLAN_EPSILON);
    const maximumCellX = Math.floor(polygon.maximumX - 0.5 + PLAN_EPSILON);
    const minimumCellZ = Math.ceil(polygon.minimumZ - 0.5 - PLAN_EPSILON);
    const maximumCellZ = Math.floor(polygon.maximumZ - 0.5 + PLAN_EPSILON);
    // A footprint with an axis extent beyond the output budget cannot form a
    // useful editable whole-block building. Reject it before an unbounded scan.
    if (maximumCellX - minimumCellX + 1 > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS
      || maximumCellZ - minimumCellZ + 1 > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS) {
      limitExceeded(LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS + 1);
    }
    for (let z = minimumCellZ; z <= maximumCellZ; z += 1) {
      const centerZ = z + 0.5;
      const intersections = [polygon.outer, ...polygon.holes]
        .flatMap((ring) => scanlineIntersections(ring, centerZ))
        .sort((first, second) => first - second);
      const intervals: Array<readonly [number, number]> = [];
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        intervals.push([intersections[index]!, intersections[index + 1]!]);
      }
      // Inclusive exterior-boundary semantics matter when a cell centre lies
      // exactly on a horizontal envelope edge. Hole boundaries remain empty.
      intervals.push(...horizontalBoundaryIntervals(polygon.outer, centerZ));
      for (const [minimumX, maximumX] of intervals) {
        const firstX = Math.max(
          minimumCellX,
          Math.ceil(minimumX - 0.5 - PLAN_EPSILON),
        );
        const lastX = Math.min(
          maximumCellX,
          Math.floor(maximumX - 0.5 + PLAN_EPSILON),
        );
        for (let x = firstX; x <= lastX; x += 1) {
          const cell = { x, z };
          const key = planKey(cell);
          if (cells.has(key) || !pointInPolygon([x + 0.5, centerZ], polygon)) continue;
          cells.set(key, cell);
          if (cells.size > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS) {
            limitExceeded(cells.size);
          }
        }
      }
    }
  }
  return [...cells.values()].sort(comparePlanCells);
}

function boundaryCells(
  footprintCells: readonly LineBrushBuildingPlanCell[],
): LineBrushBuildingPlanCell[] {
  const occupied = new Set(footprintCells.map(planKey));
  return footprintCells.filter((cell) => FOUR_NEIGHBOURS.some(([dx, dz]) => (
    !occupied.has(`${cell.x + dx}:${cell.z + dz}`)
  )));
}

function quantizedBoundaryY(baseY: number, storeyBoundaryIndex: number): number {
  const result = Math.round(
    baseY + (storeyBoundaryIndex * STANDARD_STOREY_HEIGHT_MILLIMETERS) / 1_000,
  );
  return Object.is(result, -0) ? 0 : result;
}

function uniqueBlockCells(
  values: readonly LineBrushBuildingBlockCell[],
): LineBrushBuildingBlockCell[] {
  return [...new Map(values.map((cell) => [worldKey(cell), cell])).values()].sort(compareBlockCells);
}

export function buildLineBrushBuildingGeometry(
  input: LineBrushBuildingGeometryInput,
): LineBrushBuildingGeometry {
  const { draft, baseY, storeyCount } = input;
  if (!draft || draft.schemaVersion !== "vectoplan-path-brush-draft.v1" || draft.kind !== "building") {
    invalid("invalid-draft", "Line-brush building geometry requires a building PathBrushDraft.");
  }
  if (!Number.isFinite(baseY) || !Number.isSafeInteger(Math.floor(baseY))) {
    invalid("invalid-base-y", "baseY must be finite and inside the safe whole-cell coordinate range.");
  }
  if (!Number.isSafeInteger(storeyCount) || storeyCount < 1) {
    invalid("invalid-storey-count", "storeyCount must be a positive safe integer.");
  }
  const scope = canonicalScope(draft, input.segmentScope);
  const polygons = polygonsForScope(draft, scope, input.layout);
  if (input.alignToBuildingGrid) {
    const area = polygons.reduce((sum, polygon) => sum + Math.abs(signedArea(polygon.outer))
      - polygon.holes.reduce((total, hole) => total + Math.abs(signedArea(hole)), 0), 0);
    if (area * storeyCount > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS) limitExceeded(Math.ceil(area * storeyCount));
    if (polygons.some((polygon) => polygon.maximumX - polygon.minimumX > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS
      || polygon.maximumZ - polygon.minimumZ > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS)) limitExceeded(LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS + 1);
  }
  const footprintCells = input.alignToBuildingGrid
    ? buildConstructionPlanCells(polygons.map(({ outer, holes }) => [outer, ...holes])).map((cell) => ({
      ...cell, logicalCellId: `${scope.kind === "all" ? "all" : `segment:${scope.segmentIndex}`}:${cell.logicalCellId}`,
    }))
    : rasterizeFootprint(polygons);
  if (footprintCells.length === 0) {
    invalid("empty-footprint", "The scoped footprint contains no whole block selected by cell centre.");
  }
  const exteriorFootprintCells = input.alignToBuildingGrid
    ? footprintCells.filter((cell) => cell.exterior)
    : boundaryCells(footprintCells);

  // Every storey has at least one complete footprint plate. This bound avoids
  // calculating enormous semantic heights for an already impossible request.
  const minimumOccupied = BigInt(footprintCells.length) * BigInt(storeyCount);
  if (minimumOccupied > BigInt(LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS)) {
    limitExceeded(safeRequestedCells(minimumOccupied));
  }
  const firstCellY = quantizedBoundaryY(baseY, 0);
  const finalCellY = quantizedBoundaryY(baseY, storeyCount);
  if (!Number.isSafeInteger(firstCellY) || !Number.isSafeInteger(finalCellY)) {
    invalid("invalid-base-y", "The quantised building height lies outside the safe whole-cell range.");
  }
  const totalVerticalLayers = finalCellY - firstCellY;
  const additionalWallLayers = Math.max(0, totalVerticalLayers - storeyCount);
  const exactOccupied = minimumOccupied
    + BigInt(exteriorFootprintCells.length) * BigInt(additionalWallLayers);
  if (exactOccupied > BigInt(LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS)) {
    limitExceeded(safeRequestedCells(exactOccupied));
  }

  const storeys: LineBrushBuildingStoreyGeometry[] = [];
  const allWallCells: LineBrushBuildingBlockCell[] = [];
  const allSlabCells: LineBrushBuildingBlockCell[] = [];
  const allOccupiedCells: LineBrushBuildingBlockCell[] = [];
  for (let storeyIndex = 0; storeyIndex < storeyCount; storeyIndex += 1) {
    const minimumCellY = quantizedBoundaryY(baseY, storeyIndex);
    const maximumCellYExclusive = quantizedBoundaryY(baseY, storeyIndex + 1);
    const semanticBaseY = baseY + (storeyIndex * STANDARD_STOREY_HEIGHT_MILLIMETERS) / 1_000;
    const semanticTopY = baseY + ((storeyIndex + 1) * STANDARD_STOREY_HEIGHT_MILLIMETERS) / 1_000;
    const slabCells = footprintCells.map((cell) => ({ ...cell, y: minimumCellY,
      ...(input.alignToBuildingGrid ? { minimumY: semanticBaseY, maximumY: semanticBaseY + 0.25 } : {}),
    }));
    const wallCells: LineBrushBuildingBlockCell[] = [];
    for (let y = minimumCellY + 1; y < maximumCellYExclusive; y += 1) {
      for (const cell of exteriorFootprintCells) wallCells.push({ ...cell, y,
        ...(input.alignToBuildingGrid ? {
          minimumY: semanticBaseY + 0.25 + (y - minimumCellY - 1)
            * (STANDARD_STOREY_HEIGHT_METERS - 0.25) / (maximumCellYExclusive - minimumCellY - 1),
          maximumY: semanticBaseY + 0.25 + (y - minimumCellY)
            * (STANDARD_STOREY_HEIGHT_METERS - 0.25) / (maximumCellYExclusive - minimumCellY - 1),
        } : {}),
      });
    }
    wallCells.sort(compareBlockCells);
    const occupiedCells = uniqueBlockCells([...slabCells, ...wallCells]);
    allWallCells.push(...wallCells);
    allSlabCells.push(...slabCells);
    allOccupiedCells.push(...occupiedCells);
    storeys.push({
      storeyIndex,
      semanticBaseY: baseY + (storeyIndex * STANDARD_STOREY_HEIGHT_MILLIMETERS) / 1_000,
      semanticTopY: baseY + ((storeyIndex + 1) * STANDARD_STOREY_HEIGHT_MILLIMETERS) / 1_000,
      semanticHeightMeters: STANDARD_STOREY_HEIGHT_METERS,
      semanticHeightMillimeters: STANDARD_STOREY_HEIGHT_MILLIMETERS,
      minimumCellY,
      maximumCellYExclusive,
      slabY: minimumCellY,
      wallCells,
      slabCells,
      occupiedCells,
    });
  }

  const wallCells = uniqueBlockCells(allWallCells);
  const slabCells = uniqueBlockCells(allSlabCells);
  const occupiedCells = uniqueBlockCells(allOccupiedCells);
  // This is an invariant check, not a truncation fallback. A programming
  // regression must stay observable to callers and tests.
  if (occupiedCells.length > LINE_BRUSH_BUILDING_MAX_OCCUPIED_CELLS) {
    limitExceeded(occupiedCells.length);
  }
  return {
    schemaVersion: LINE_BRUSH_BUILDING_GEOMETRY_SCHEMA_VERSION,
    segmentScope: scope,
    baseY,
    storeyCount,
    storeyHeightMeters: STANDARD_STOREY_HEIGHT_METERS,
    storeyHeightMillimeters: STANDARD_STOREY_HEIGHT_MILLIMETERS,
    totalHeightMeters: (storeyCount * STANDARD_STOREY_HEIGHT_MILLIMETERS) / 1_000,
    totalHeightMillimeters: storeyCount * STANDARD_STOREY_HEIGHT_MILLIMETERS,
    footprintCells,
    exteriorFootprintCells,
    storeys,
    wallCells,
    slabCells,
    occupiedCells,
  };
}
