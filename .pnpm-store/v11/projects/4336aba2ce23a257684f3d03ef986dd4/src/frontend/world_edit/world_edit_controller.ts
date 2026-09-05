import * as THREE from "three";
import {
  isChunkApiFailedResult,
  type ChunkApiObjectBatchCommandPayload,
  type ChunkApiPlaceObjectCommandPayload,
  type ChunkApiRemoveObjectCommandPayload,
  type ChunkApiWorldEditCommandPayload,
  type ChunkApiWorldPosition,
} from "@api/chunk_api_models";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";
import type { EditorInputWorldEditIntent } from "@input/input_controller";
import type {
  ActiveLibraryPlacement,
  SceneRuntimeHandle,
} from "@scene/scene_runtime";
import type { WorldRuntimeHandle } from "@runtime/world/world_runtime";
import { requireCommandResultFromUnknown } from "@runtime/world/chunk_command_result";
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeString } from "@utils/safe";
import {
  earthGridLonLatToWorld,
  earthGridWorldPointToLonLat,
} from "@utils/earth_grid_coordinates";
import {
  WORLD_EDIT_COMMAND_SOURCE,
  type WorldEditOperation,
  type WorldEditSystemRegistry,
  type WorldEditTool,
} from "./systems/contracts";
import { createWorldEditSystemRegistry } from "./systems/registry";
import { createSelectionSystem } from "./systems/selection/system";
import { createRoomSystem } from "./systems/room/system";
import { createLineBrushBuildingEditVisuals } from "./systems/line_brush/building_edit_visuals";
import { createStairSystem } from "./systems/stair/system";
import { createPaintSystem } from "./systems/paint/system";
import { createSculptSystem } from "./systems/sculpt/system";
import { createParcelSystem } from "./systems/parcel/system";
import { createParcelGridSystem } from "./systems/parcel_grid/system";
import { createRulerSystem } from "./systems/ruler/system";
import { createCopyPasteSystem } from "./systems/copy_paste/system";
import { createCutPasteSystem } from "./systems/cut_paste/system";
import { createTentacleSystem } from "./systems/tentacle/system";
import { createRoofSystem } from "./systems/roof/system";
import { createStoreySystem } from "./systems/storey/system";
import { createStoreyDragHandle } from "./systems/storey/drag";
import { buildLineBrushRoofZones } from "./systems/line_brush/building_roofs";
import { coalesceLineBrushStoreys } from "./systems/line_brush/storey_ownership";
import { buildLineBrushRoofWallCells, attachLineBrushRoofWallCells, type LineBrushRoofWallCell, type LineBrushRoofWallZone } from "./systems/line_brush/roof_walls";
import { importedRoofSource } from "./systems/roof/imported";
import { restoreImportedRoofOriginal } from "./systems/roof/restoration";
import { createFlatRoofCalculation } from "./systems/roof/courtyard";
import {
  createStairQuickSettings,
  DEFAULT_STAIR_TOOL_PARAMETERS,
  type StairQuickSettingsHandle,
  type StairToolParameters,
} from "./systems/stair/quick_settings";
import {
  buildRoofCalculationRequest,
  DEFAULT_ROOF_TOOL_PARAMETERS,
  roofCalculationRequestKey,
  normalizeRoofContinuationEdges,
  requestRoofCalculation,
  type RoofCalculationRequest,
  type RoofCalculationResult,
  type RoofInsulationMode,
  type RoofToolParameters,
  type RoofType,
} from "./systems/roof/contracts";
import {
  normalizePolygonAreaPoints,
  polygonAreaBounds,
  polygonAreaClosedCoordinates,
  polygonAreaClosedRingCoordinates,
  polygonAreaPlanCentroid,
  polygonAreaPlanArea,
  polygonAreaPointsFromFootprint,
  polygonAreaRingsFromFootprint,
  validPolygonArea,
  type PolygonAreaPoint,
} from "./systems/polygon_area/geometry";
import { createRoofCalculationMeshes } from "@scene/roof_calculation_rendering";
import { buildSolarLayout, createSolarMesh, normalizeSolarSettings, solarMetricScale } from "./systems/solar/layout";
import { createSolarToolPanel } from "./systems/solar/panel";
import { createRoofSurfaceHighlight, roofSurfaceTriangles, roofSurfaceMarker, heightOnRoof } from "@scene/roof_surface_geometry";
import {
  createRoofQuickSettings,
  persistedRoofQuickSettings,
  type RoofQuickParameters,
  type RoofQuickSettingsHandle,
} from "./systems/roof/quick_settings";
import {
  createStoreyQuickSettings,
  type StoreyQuickSettingsHandle,
  type StoreyTargetScope,
} from "./systems/storey/quick_settings";
import {
  STANDARD_FLOOR_SLAB_LIBRARY_CONTEXT,
  STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
  STANDARD_STOREY_HEIGHT_METERS,
  STANDARD_STOREY_HEIGHT_MILLIMETERS,
  buildBuildingProgramExecutionMetadata,
  createDefaultBuildingProgramTemplateSelection,
  getBuildingProgramType,
  type BuildingProgramTemplateSelection,
} from "./systems/line_brush/building_programs";
import {
  createLineBrushQuickSettings,
  type LineBrushQuickSettingsHandle,
} from "./systems/line_brush/quick_settings";
import type { LineBrushBuildingGenerationRequest } from "./systems/line_brush/quick_settings_state";
import {
  buildLineBrushBuildingGeometry,
  reserveLineBrushBuildingCellBudget,
  type LineBrushBuildingGeometry,
  type LineBrushBuildingStoreyGeometry,
} from "./systems/line_brush/building_geometry";
import {
  buildLineBrushBuildingLayout,
  lineBrushLayoutFootprintForSegment,
  type LineBrushBuildingLayout,
} from "./systems/line_brush/building_layout";
import {
  lineBrushBuildingPreset,
  lineBrushRoofDefaults,
  normalizeLineBrushRoofType,
  type LineBrushBuildingPreset,
} from "./systems/line_brush/building_presets";
import {
  appendLineBrushBuildingRoofPreview,
  createLineBrushBuildingStructurePreview,
} from "./systems/line_brush/building_preview";
import {
  inactiveRoofZones,
  roofCalculationHasZoneTopPurlinAlignment,
  roofCalculationVersionSnapshot,
  roofCalculationVersionsMatch,
  roofPreviewStateAfterInvalidation,
  shouldCommitRoofSettingsClose,
  uniqueRoofZones,
} from "./systems/roof/zones";
import {
  clearOptimisticRoofCalculation,
  pendingRoofCalculationStatus,
  registerOptimisticRoofCalculation,
} from "./systems/roof/optimistic_calculations";
import {
  clipboardAnchorAlongAxis,
  clipboardBoundsAt,
  clipboardEntryColor,
  clipboardParcelMaskEnabled,
  clipboardSelectionSize,
  type ClipboardSize,
} from "./systems/clipboard/geometry";
import {
  clipboardCommandResult,
  clipboardEntriesFromCommandResult,
} from "./systems/clipboard/response";
import {
  sampleTentacleCurve,
  shouldAppendTentacleSample,
  voxelizeTentacleCurve,
  type TentaclePoint,
} from "./systems/tentacle/geometry";
import {
  createPathBrushDraft,
  pathBrushDraftFromUnknown,
  resolvePathBrushHeightConflicts,
  type PathBrushDraft,
  type PathBrushElevatedResolution,
  type PathBrushHeightConflict,
} from "./systems/shared/path_brush_geometry";
import {
  buildParcelGridPartition,
  intersectConvexParcelGridPolygons,
  mergeParcelGridCoverage,
  normalizeParcelGridPolygon,
  parcelGridGuideIdentity,
  parcelGridPolygonArea,
  resolveParcelGridGuidePreview,
  resolveParcelGridHandleScale,
  resolveParcelGridMaximumDepth,
  resolveParcelGridRenderBounds,
  snapParcelGridDragDepth,
  type ParcelGridPoint,
} from "./systems/parcel_grid/geometry";
import {
  lod2BuildingFacadeBands,
  lod2BuildingGridReferencesFromChunks,
  type Lod2BuildingGridReference,
} from "./systems/parcel_grid/building_reference";
import { auditParcelGrid } from "./systems/parcel_grid/audit";
import {
  resolveWorldEditSelectionBounds,
  snapWorldEditSelectionHandle,
  worldEditSelectionTopGridSegments,
  type WorldEditSelectionAxis,
  type WorldEditSelectionBounds,
} from "./systems/selection/geometry";
import {
  rulerSourceCellFromSurfaceHit,
  snapWorldEditRulerPoint,
} from "./systems/ruler/geometry";
import {
  validatePlanningMassing,
  type PlanningMassingDraft,
  type PlanningMassingSelectionBounds,
} from "../planning_massing/planning_massing_model";
import {
  workspacePointerNdc,
  worldEditToolShowsParcelGuides,
} from "../modes/editor_workspace_mode";

const ACTIVATE_EVENT = "vectoplan-editor:worldedit-tool-activate";
const SETTINGS_EVENT = "vectoplan-editor:worldedit-settings-change";
const INVENTORY_ACTION_EVENT = "vectoplan-editor:worldedit-action";
const INVENTORY_STATE_EVENT = "vectoplan-editor:worldedit-state";
const INVENTORY_STATE_REQUEST_EVENT = "vectoplan-editor:worldedit-state-request";
const INVENTORY_SYNC_REQUEST = "vectoplan-editor:worldedit-inventory-sync-request";
const PARCEL_REQUEST = "vectoplan-editor:parcel-selection-request";
const PARCEL_SYNC = "vectoplan-app:parcel-selection-sync";
const PARCEL_CHANGED = "vectoplan-editor:parcel-selection-changed";
const MAP_PARCEL_CHANGED = "vectoplan-map:parcel-selection-changed";
const MAP_PARCEL_CATALOG_CHANGED = "vectoplan-map:parcel-catalog-changed";
const PARCEL_OVERLAY_SYNC = "vectoplan-editor:parcel-overlay-sync";
const LOCAL_PARCEL_SYNC = "vectoplan-editor:parcel-selection-sync";
const CREATIVE_INVENTORY_OPENED_EVENT = "vectoplan-editor:creative-inventory-opened";
const CREATIVE_INVENTORY_CLOSED_EVENT = "vectoplan-editor:creative-inventory-closed";
const EARTH_GRID_READY_EVENT = "vectoplan-editor:earth-grid-frame-ready";
const PARCEL_GRID_FULL_RENDER_CELL_LIMIT = 100_000;
const PARCEL_GRID_VISIBLE_MARGIN_CELLS = 64;
const PARCEL_GRID_MIN_DRAG_DEPTH_CELLS = 64;
const PARCEL_GRID_MAX_DRAG_DEPTH_CELLS = 512;
const PARCEL_GRID_DRAG_DEPTH_PADDING_CELLS = 8;

export interface ParcelSelectionItem {
  readonly parcelId: string;
  readonly datasetId: string;
  readonly geometry: Readonly<Record<string, unknown>>;
  readonly properties?: Readonly<Record<string, unknown>>;
}

interface ParcelSelection {
  projectPublicId: string;
  revision: number;
  projectCoordinate: { longitude: number; latitude: number } | null;
  projectCoordinateManualOverride: boolean;
  gridRotationDegrees: number;
  parcels: ParcelSelectionItem[];
  adjacentParcels: ParcelSelectionItem[];
  availableParcels: ParcelSelectionItem[];
  parcelGridState: PersistedParcelGridState | null;
}

interface SelectionBounds {
  first: ChunkApiWorldPosition | null;
  second: ChunkApiWorldPosition | null;
}

interface ExistingRoomRef {
  readonly objectInstanceId: string;
  readonly anchor: ChunkApiWorldPosition;
  readonly footprint: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

interface ExistingRoofRef {
  readonly objectInstanceId: string;
  readonly anchor: ChunkApiWorldPosition;
  readonly footprint: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

interface RoofZoneSettingsTarget {
  readonly target: THREE.Object3D;
  readonly roof: ExistingRoofRef;
}

interface HiddenRoofObject {
  readonly object: THREE.Object3D;
  readonly visible: boolean;
}

type PolygonAreaTool = "room" | "stair" | "roof";

interface PolygonAreaRuntime {
  points: PolygonAreaPoint[];
  closed: boolean;
  editingIndex: number | null;
  hoveredIndex: number | null;
  interactionFrame: number;
  hoverFrame: number;
  group: THREE.Group | null;
  pointTargets: THREE.Mesh[];
  moveTarget: THREE.Mesh | null;
  settingsTarget: THREE.Object3D | null;
  calculation: RoofCalculationResult | null;
  request: RoofCalculationRequest | null;
}

interface EarthGridFrameContract {
  readonly schemaVersion: "vectoplan-earth-grid-frame.v1";
  readonly horizontalMapping: "vectoplan-periodic-equirectangular";
  readonly mappingVersion: "1";
  readonly axisConvention: "x-east-y-up-z-north";
  readonly worldWidthCells: number;
  readonly worldHeightCells: number;
  readonly metersPerCell: number;
  readonly centralMeridianDegrees: number;
  readonly storageOrigin: Readonly<{ x: number; y: number; z: number }>;
}

interface HandleDescriptor {
  readonly axis: WorldEditSelectionAxis;
  readonly sign: -1 | 1;
  readonly mesh: THREE.Mesh;
}

interface ClipboardHandleDescriptor {
  readonly axis: WorldEditSelectionAxis;
  readonly root: THREE.Group;
  readonly targets: readonly THREE.Mesh[];
  readonly material: THREE.MeshBasicMaterial;
  readonly color: number;
}

interface SelectionBoxRuntime {
  readonly fill: THREE.Mesh;
  readonly edges: THREE.LineSegments;
  readonly topGrid: THREE.LineSegments;
}

interface SelectionHandleDragState {
  readonly axis: WorldEditSelectionAxis;
  readonly sign: -1 | 1;
  readonly initialBounds: WorldEditSelectionBounds;
  readonly initialPointerCoordinate: number;
  readonly dragPlaneNormal: readonly [number, number, number];
  readonly dragPlanePoint: readonly [number, number, number];
}

interface ParcelGridGuide {
  readonly guideKey: string;
  readonly parcelId: string;
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly inward: readonly [number, number];
  readonly depthMeters: number;
}

interface ParcelGridDragState {
  readonly guideKey: string;
  readonly initialDepthMeters: number;
  readonly initialPointerDepthMeters: number;
  readonly maximumDepthMeters: number;
}

interface ParcelGridHandleRuntime {
  readonly guideKey: string;
  readonly parcelId: string;
  readonly group: THREE.Group;
  readonly linePositions: THREE.BufferAttribute;
  readonly lineVertexOffset: number;
  readonly start: readonly [number, number];
  readonly end: readonly [number, number];
  readonly inward: readonly [number, number];
  readonly along: number;
  readonly planeY: number;
  readonly maximumDepthMeters: number;
  currentDepthMeters: number;
}

interface PersistedParcelGridGuide {
  readonly parcelId: string;
  readonly startLonLat: readonly [number, number];
  readonly endLonLat: readonly [number, number];
  readonly depthMeters: number;
}

interface PersistedParcelGridState {
  readonly schemaVersion: "vectoplan-parcel-grid-state.v1";
  readonly mode: "boundary" | "setback";
  readonly setbackMeters: number;
  readonly influenceMeters: number;
  readonly activeParcelId: string | null;
  readonly activeGuideKey?: string | null;
  readonly guides: readonly PersistedParcelGridGuide[];
}

type ParcelGridZone = `slanted-${number}-${number}` | "transition-triangle" | "straight" | "straight-clipped";

interface ParcelGridZoneCell {
  readonly parcelId: string;
  readonly zone: ParcelGridZone;
  readonly polygon: readonly (readonly [number, number])[];
  readonly sourceCell?: Readonly<{ x: number; z: number }>;
  readonly logicalCellId?: string;
  readonly boundarySegmentId?: string;
  readonly boundaryRow?: number;
  readonly boundaryColumn?: number;
  readonly boundaryKind?: "parcel" | "building-facade";
  readonly wallAxisDegrees?: number;
  readonly gridAlignment?: "world" | "boundary" | "lod2-building";
}

type ParcelGridSemanticPlacement = Readonly<{
  kind: "parcel-grid-prism.v1";
  footprint: Readonly<Record<string, unknown>>;
  occupiedCells: readonly ChunkApiWorldPosition[];
  mergeKey: string;
  anchorPosition?: ChunkApiWorldPosition;
}>;

type ParcelGridPlacementResolver = (
  position: ChunkApiWorldPosition,
  options?: Readonly<{
    targetPoint?: readonly [number, number] | null;
    preferredLogicalCellId?: string | null;
  }>,
) => ParcelGridSemanticPlacement | null;

function convexHull(points: readonly (readonly [number, number])[]): readonly (readonly [number, number])[] {
  const unique = [...new Map(points.map((point) => [`${point[0].toFixed(6)}:${point[1].toFixed(6)}`, point])).values()]
    .sort((first, second) => first[0] - second[0] || first[1] - second[1]);
  if (unique.length <= 3) return unique;
  const cross = (origin: readonly [number, number], first: readonly [number, number], second: readonly [number, number]): number => (
    (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0])
  );
  const lower: Array<readonly [number, number]> = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 1e-8) lower.pop();
    lower.push(point);
  }
  const upper: Array<readonly [number, number]> = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 1e-8) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function polygonArea(points: readonly (readonly [number, number])[]): number {
  if (points.length < 3) return 0;
  let doubledArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    doubledArea += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(doubledArea) * 0.5;
}

function clipPolygonToCell(
  polygon: readonly (readonly [number, number])[],
  x: number,
  z: number,
): readonly (readonly [number, number])[] {
  type Point = readonly [number, number];
  let output: readonly Point[] = [...polygon];
  const boundaries: readonly Readonly<{
    inside(point: Point): boolean;
    intersect(start: Point, end: Point): Point;
  }>[] = [
    {
      inside: (point) => point[0] >= x - 1e-7,
      intersect: (start, end) => {
        const factor = (x - start[0]) / (end[0] - start[0]);
        return [x, start[1] + (end[1] - start[1]) * factor];
      },
    },
    {
      inside: (point) => point[0] <= x + 1 + 1e-7,
      intersect: (start, end) => {
        const boundary = x + 1;
        const factor = (boundary - start[0]) / (end[0] - start[0]);
        return [boundary, start[1] + (end[1] - start[1]) * factor];
      },
    },
    {
      inside: (point) => point[1] >= z - 1e-7,
      intersect: (start, end) => {
        const factor = (z - start[1]) / (end[1] - start[1]);
        return [start[0] + (end[0] - start[0]) * factor, z];
      },
    },
    {
      inside: (point) => point[1] <= z + 1 + 1e-7,
      intersect: (start, end) => {
        const boundary = z + 1;
        const factor = (boundary - start[1]) / (end[1] - start[1]);
        return [start[0] + (end[0] - start[0]) * factor, boundary];
      },
    },
  ];
  for (const boundary of boundaries) {
    if (output.length === 0) break;
    const input = output;
    const clipped: Point[] = [];
    for (let index = 0; index < input.length; index += 1) {
      const start = input[index]!;
      const end = input[(index + 1) % input.length]!;
      const startInside = boundary.inside(start);
      const endInside = boundary.inside(end);
      if (startInside && endInside) clipped.push(end);
      else if (startInside) clipped.push(boundary.intersect(start, end));
      else if (endInside) clipped.push(boundary.intersect(start, end), end);
    }
    output = clipped;
  }
  return output;
}

function polygonCellOverlapArea(
  polygon: readonly (readonly [number, number])[],
  x: number,
  z: number,
): number {
  return polygonArea(clipPolygonToCell(polygon, x, z));
}

export interface WorldEditControllerOptions {
  readonly root: HTMLElement;
  readonly bootstrap: EditorBootstrap;
  readonly sceneRuntime: SceneRuntimeHandle;
  readonly worldRuntime: WorldRuntimeHandle;
  readonly logger?: EditorLogger;
  readonly signal?: AbortSignal;
}

export interface WorldEditControllerHandle {
  readonly element: HTMLElement;
  activate(tool: WorldEditTool, operation?: WorldEditOperation): void;
  deactivate(reason?: string): void;
  beginPlanningMassingSelection(): void;
  getPlanningMassingSnapshot(): PlanningMassingWorldEditSnapshot;
  executePlanningMassing(heightBlocks: number): Promise<PlanningMassingWorldEditResult>;
  preparePlanningMassingRoof(): Promise<PlanningMassingWorldEditResult>;
  destroy(): void;
}

interface PlanningGeneratedObjectRef {
  readonly objectInstanceId: string;
  readonly anchor: ChunkApiWorldPosition;
  readonly role: "storey" | "slab" | "roof";
  readonly scope: StoreyTargetScope;
  readonly storeyIndex?: number;
}

interface PlanningGeneratedObjectPlacement {
  readonly payload: ChunkApiPlaceObjectCommandPayload;
  readonly ref: PlanningGeneratedObjectRef;
}

interface PlanningBuildingStoreyProfile {
  readonly baseCount: number;
  /** Signed delta from baseCount; negative values lower one line segment. */
  readonly segmentAdjustments: Readonly<Record<string, number>>;
}

interface PlanningStoreyBuildSpec {
  readonly scope: StoreyTargetScope;
  readonly storeyIndex: number;
  readonly geometry: LineBrushBuildingGeometry;
  readonly storey: LineBrushBuildingStoreyGeometry;
  readonly footprint: Readonly<Record<string, unknown>>;
}

interface PlanningRoofBuildSpec extends LineBrushRoofWallZone {
  readonly scope: StoreyTargetScope;
  readonly roofIndex: number;
  /** Exterior ring first, followed by any courtyard holes. */
  readonly rings: readonly (readonly PolygonAreaPoint[])[];
  readonly points: readonly PolygonAreaPoint[];
  readonly parameters: RoofToolParameters;
  readonly request: RoofCalculationRequest;
  readonly calculation: RoofCalculationResult;
  readonly wallCells?: readonly LineBrushRoofWallCell[];
}

export interface PlanningMassingWorldEditSnapshot {
  readonly selection: PlanningMassingSelectionBounds | null;
  readonly materialId: string | null;
  readonly materialLabel: string;
  readonly parcelCount: number;
  readonly parcelMaskEnabled: boolean;
  readonly busy: boolean;
  readonly lastDraft: PlanningMassingDraft | null;
}

export interface PlanningMassingWorldEditResult {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly draft: PlanningMassingDraft | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function worldPosition(value: unknown): ChunkApiWorldPosition | null {
  const record = asRecord(value);
  const x = Number(record.x ?? record.worldX);
  const y = Number(record.y ?? record.worldY);
  const z = Number(record.z ?? record.worldZ);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }
    : null;
}

export function normalizedParcelItems(value: unknown, maximum: number): ParcelSelectionItem[] {
  const byId = new Map<string, ParcelSelectionItem>();
  for (const item of asArray(value)) {
    const record = asRecord(item);
    const parcelId = safeString(
      record.parcelId ?? record.parcel_id ?? record.featureId ?? record.id,
      "",
    );
    const geometry = asRecord(record.geometry);
    const geometryType = safeString(geometry.type, "");
    const rawPolygons = geometryType === "Polygon"
      ? [asArray(geometry.coordinates)]
      : geometryType === "MultiPolygon"
        ? [...asArray(geometry.coordinates)]
        : [];
    if (!parcelId || rawPolygons.length === 0) continue;

    const polygons: unknown[] = [];
    for (const polygon of rawPolygons) {
      const rings = asArray(polygon);
      const exterior = asArray(rings[0]);
      if (exterior.length < 3) continue;
      polygons.push(rings);
    }
    if (polygons.length === 0) continue;

    const existing = byId.get(parcelId);
    // WFS entries already carry the complete Polygon/MultiPolygon. When the
    // same parcel is synchronized again, replace the older snapshot instead
    // of concatenating both geometries. Concatenation turned revisions or
    // viewport copies into one oversized/fragmented MultiPolygon.
    byId.set(parcelId, {
      parcelId,
      datasetId: safeString(record.datasetId ?? record.dataset_id, existing?.datasetId ?? "flurstuecke"),
      geometry: geometryType === "Polygon"
        ? { type: "Polygon", coordinates: polygons[0] }
        : { type: "MultiPolygon", coordinates: polygons },
      properties: { ...asRecord(existing?.properties), ...asRecord(record.properties) },
    });
  }

  return [...byId.values()]
    .slice(0, Math.max(1, maximum));
}

export function normalizedParcelSelection(value: unknown): ParcelSelection {
  const root = asRecord(value);
  const selection = asRecord(root.selection ?? root.parcelSelection ?? root.last_map_selection ?? root);
  const selectedValues = asArray(selection.parcels ?? selection.features);
  const availableValues = asArray(selection.availableParcels ?? selection.available_parcels);
  const adjacentValues = asArray(selection.adjacentParcels ?? selection.adjacent_parcels);
  const selectedIds = new Set(normalizedParcelItems(selectedValues, 64).map((item) => item.parcelId));
  // The live catalogue is the authoritative geometry source. It comes last so
  // a selected snapshot cannot override a newer complete WFS feature.
  const mergedCatalog = normalizedParcelItems(
    [...selectedValues, ...adjacentValues, ...availableValues],
    768,
  );
  const parcels = mergedCatalog.filter((item) => selectedIds.has(item.parcelId)).slice(0, 64);
  const normalizedSelectedIds = new Set(parcels.map((parcel) => parcel.parcelId));
  const availableParcels = normalizedParcelItems(availableValues, 512);
  const adjacentParcels = normalizedParcelItems(adjacentValues, 128);
  const coordinate = asRecord(selection.projectCoordinate ?? selection.project_coordinate);
  const longitude = Number(coordinate.longitude ?? coordinate.lon ?? coordinate.lng);
  const latitude = Number(coordinate.latitude ?? coordinate.lat);
  const requestedRotation = Number(selection.gridRotationDegrees ?? selection.grid_rotation_degrees);
  const rawGridState = asRecord(selection.parcelGridState ?? selection.parcel_grid_state);
  const rawGridGuides = asArray(rawGridState.guides);
  const requestedActiveParcelId = safeString(rawGridState.activeParcelId ?? rawGridState.active_parcel_id, "") || null;
  const activeParcelId = requestedActiveParcelId && normalizedSelectedIds.has(requestedActiveParcelId)
    ? requestedActiveParcelId
    : null;
  const parcelGridState = safeString(rawGridState.schemaVersion ?? rawGridState.schema_version, "")
    === "vectoplan-parcel-grid-state.v1"
    ? {
        schemaVersion: "vectoplan-parcel-grid-state.v1" as const,
        mode: safeString(rawGridState.mode, "boundary") === "setback" ? "setback" as const : "boundary" as const,
        setbackMeters: Math.max(0, Math.min(20, Number(rawGridState.setbackMeters ?? rawGridState.setback_meters) || 0)),
        influenceMeters: Math.max(1, Math.min(PARCEL_GRID_MAX_DRAG_DEPTH_CELLS, Math.round(Number(rawGridState.influenceMeters ?? rawGridState.influence_meters) || 3))),
        activeParcelId,
        activeGuideKey: activeParcelId
          ? safeString(rawGridState.activeGuideKey ?? rawGridState.active_guide_key, "") || null
          : null,
        guides: rawGridGuides.map((value): PersistedParcelGridGuide | null => {
          const guide = asRecord(value);
          const start = asArray(guide.startLonLat ?? guide.start_lon_lat);
          const end = asArray(guide.endLonLat ?? guide.end_lon_lat);
          const parcelId = safeString(guide.parcelId ?? guide.parcel_id, "");
          const startLon = Number(start[0]);
          const startLat = Number(start[1]);
          const endLon = Number(end[0]);
          const endLat = Number(end[1]);
          if (!parcelId || !normalizedSelectedIds.has(parcelId)
            || ![startLon, startLat, endLon, endLat].every(Number.isFinite)) return null;
          return {
            parcelId,
            startLonLat: [startLon, startLat],
            endLonLat: [endLon, endLat],
            depthMeters: Math.max(0, Math.min(
              PARCEL_GRID_MAX_DRAG_DEPTH_CELLS,
              Math.round(Number.isFinite(Number(guide.depthMeters ?? guide.depth_meters))
                ? Number(guide.depthMeters ?? guide.depth_meters)
                : 3),
            )),
          };
        }).filter((guide): guide is PersistedParcelGridGuide => guide !== null).slice(0, 256),
      }
    : null;
  return {
    projectPublicId: safeString(
      selection.projectPublicId ?? selection.project_public_id,
      "",
    ),
    revision: Number.isFinite(Number(selection.revision)) ? Number(selection.revision) : 0,
    projectCoordinate: Number.isFinite(longitude) && Number.isFinite(latitude)
      ? { longitude, latitude }
      : null,
    projectCoordinateManualOverride: (
      selection.projectCoordinateManualOverride
      ?? selection.project_coordinate_manual_override
    ) === true,
    gridRotationDegrees: Number.isFinite(requestedRotation)
      ? normalizeGridRotation(requestedRotation)
      : dominantGridRotationDegrees(parcels, Number.isFinite(latitude) ? latitude : 0),
    parcels,
    adjacentParcels,
    availableParcels,
    parcelGridState,
  };
}

function retainParcelCatalog(
  current: ParcelSelection,
  incoming: ParcelSelection,
): ParcelSelection {
  const sameProject = !current.projectPublicId
    || !incoming.projectPublicId
    || current.projectPublicId === incoming.projectPublicId;
  if (!sameProject) return incoming;

  // Selection messages intentionally contain only the selected IDs in some
  // bridge paths. Keep the last complete map catalogue locally so an item that
  // was just deselected remains available for the very next click.
  const availableParcels = normalizedParcelItems(
    [
      ...current.parcels,
      ...incoming.parcels,
      ...current.availableParcels,
      ...incoming.availableParcels,
    ],
    512,
  );
  const adjacentParcels = normalizedParcelItems(
    [...current.adjacentParcels, ...incoming.adjacentParcels],
    128,
  );
  const selectedIds = new Set(incoming.parcels.map((parcel) => parcel.parcelId));
  const parcels = normalizedParcelItems([
    ...incoming.parcels,
    ...adjacentParcels.filter((parcel) => selectedIds.has(parcel.parcelId)),
    ...availableParcels.filter((parcel) => selectedIds.has(parcel.parcelId)),
  ], 64);
  return { ...incoming, parcels, adjacentParcels, availableParcels };
}

function operationNeedsMaterial(operation: WorldEditOperation): boolean {
  return !["clear", "copy", "cut", "paste"].includes(operation);
}

function positionLabel(value: ChunkApiWorldPosition | null): string {
  const coordinate = (entry: number): string => (
    Number.isInteger(entry) ? String(entry) : entry.toFixed(2).replace(/\.00$/, "")
  );
  return value ? `${coordinate(value.x)} / ${coordinate(value.y)} / ${coordinate(value.z)}` : "–";
}

function commandErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return safeString(value.message, "WorldEdit konnte nicht ausgef\u00fchrt werden.");
  }
  const record = asRecord(value);
  const error = asRecord(record.error);
  return safeString(error.message ?? record.message, "WorldEdit konnte nicht ausgeführt werden.");
}

function cellPosition(value: unknown): ChunkApiWorldPosition | null {
  return worldPosition(value);
}

function measurementMetres(bounds: SelectionBounds): number | null {
  if (!bounds.first || !bounds.second) return null;
  return Math.hypot(
    bounds.second.x - bounds.first.x,
    bounds.second.y - bounds.first.y,
    bounds.second.z - bounds.first.z,
  );
}

function createRulerDistanceLabel(
  first: THREE.Vector3,
  second: THREE.Vector3,
  camera: THREE.Camera | null,
): THREE.Sprite | null {
  if (typeof document === "undefined") return null;
  const distance = first.distanceTo(second);
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 176;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(8, 32, 58, .9)";
  context.strokeStyle = "rgba(125, 211, 252, .98)";
  context.lineWidth = 7;
  context.beginPath();
  context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 30);
  context.fill();
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "700 70px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`${distance.toFixed(2)} m`, canvas.width / 2, canvas.height / 2 - 16);
  context.fillStyle = "#bae6fd";
  context.font = "600 30px system-ui, sans-serif";
  context.fillText(
    `ΔX ${Math.abs(second.x - first.x).toFixed(2)} · ΔY ${Math.abs(second.y - first.y).toFixed(2)} · ΔZ ${Math.abs(second.z - first.z).toFixed(2)}`,
    canvas.width / 2,
    canvas.height - 39,
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  const midpoint = first.clone().add(second).multiplyScalar(0.5);
  midpoint.y += 0.32;
  sprite.position.copy(midpoint);
  const cameraDistance = camera ? camera.position.distanceTo(midpoint) : 18;
  const width = Math.max(2.7, Math.min(7.5, cameraDistance * 0.085));
  sprite.scale.set(width, width * canvas.height / canvas.width, 1);
  sprite.renderOrder = 94;
  sprite.userData.worldEditRulerLabel = true;
  return sprite;
}

function pointOnSegment(
  point: readonly [number, number],
  first: readonly [number, number],
  second: readonly [number, number],
): boolean {
  const cross = ((point[0] - first[0]) * (second[1] - first[1]))
    - ((point[1] - first[1]) * (second[0] - first[0]));
  if (Math.abs(cross) > 1e-10) return false;
  return point[0] >= Math.min(first[0], second[0]) - 1e-10
    && point[0] <= Math.max(first[0], second[0]) + 1e-10
    && point[1] >= Math.min(first[1], second[1]) - 1e-10
    && point[1] <= Math.max(first[1], second[1]) + 1e-10;
}

function pointInRing(point: readonly [number, number], ringValue: unknown): boolean {
  const ring = asArray(ringValue)
    .map((entry) => asArray(entry))
    .filter((entry) => Number.isFinite(Number(entry[0])) && Number.isFinite(Number(entry[1])))
    .map((entry): [number, number] => [Number(entry[0]), Number(entry[1])]);
  if (ring.length < 3) return false;
  let inside = false;
  let previous = ring[ring.length - 1];
  for (const current of ring) {
    if (pointOnSegment(point, previous, current)) return true;
    if ((current[1] > point[1]) !== (previous[1] > point[1])) {
      const crossing = ((previous[0] - current[0]) * (point[1] - current[1])
        / (previous[1] - current[1])) + current[0];
      if (point[0] < crossing) inside = !inside;
    }
    previous = current;
  }
  return inside;
}

function pointInPolygon(point: readonly [number, number], ringsValue: unknown): boolean {
  const rings = asArray(ringsValue);
  return rings.length > 0
    && pointInRing(point, rings[0])
    && !rings.slice(1).some((ring) => pointInRing(point, ring));
}

function parcelContainsLonLat(parcel: ParcelSelectionItem, point: readonly [number, number]): boolean {
  const geometry = asRecord(parcel.geometry);
  const coordinates = asArray(geometry.coordinates);
  const type = safeString(geometry.type, "");
  if (type === "Polygon") return pointInPolygon(point, coordinates);
  if (type === "MultiPolygon") return coordinates.some((polygon) => pointInPolygon(point, polygon));
  return false;
}

function parcelApproximateArea(parcel: ParcelSelectionItem, latitude: number): number {
  const metresPerDegree = wgs84MetresPerDegree(latitude);
  let area = 0;
  for (const polygonValue of parcelPolygons(parcel)) {
    const rings = asArray(polygonValue);
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      const ring = asArray(rings[ringIndex]);
      let signedArea = 0;
      for (let index = 0; index < ring.length; index += 1) {
        const current = asArray(ring[index]);
        const next = asArray(ring[(index + 1) % ring.length]);
        signedArea += Number(current[0]) * Number(next[1]) - Number(next[0]) * Number(current[1]);
      }
      const metricArea = Math.abs(signedArea) * 0.5 * metresPerDegree.longitude * metresPerDegree.latitude;
      area += ringIndex === 0 ? metricArea : -metricArea;
    }
  }
  return Math.max(0, area);
}

function parcelBoundaryDistanceMetres(
  parcel: ParcelSelectionItem,
  point: readonly [number, number],
): number {
  const metresPerDegree = wgs84MetresPerDegree(point[1]);
  let best = Number.POSITIVE_INFINITY;
  for (const polygonValue of parcelPolygons(parcel)) {
    for (const ringValue of asArray(polygonValue)) {
      const ring = asArray(ringValue);
      for (let index = 0; index < ring.length; index += 1) {
        const first = asArray(ring[index]);
        const second = asArray(ring[(index + 1) % ring.length]);
        const ax = (Number(first[0]) - point[0]) * metresPerDegree.longitude;
        const az = (Number(first[1]) - point[1]) * metresPerDegree.latitude;
        const bx = (Number(second[0]) - point[0]) * metresPerDegree.longitude;
        const bz = (Number(second[1]) - point[1]) * metresPerDegree.latitude;
        if (![ax, az, bx, bz].every(Number.isFinite)) continue;
        const dx = bx - ax;
        const dz = bz - az;
        const lengthSquared = dx * dx + dz * dz;
        const factor = lengthSquared <= 1e-12
          ? 0
          : Math.max(0, Math.min(1, -(ax * dx + az * dz) / lengthSquared));
        best = Math.min(best, Math.hypot(ax + dx * factor, az + dz * factor));
      }
    }
  }
  return best;
}

function bestParcelHit(
  parcels: readonly ParcelSelectionItem[],
  point: readonly [number, number],
  boundaryToleranceMetres = 0,
): ParcelSelectionItem | null {
  const unique = new Map(parcels.map((parcel) => [parcel.parcelId, parcel]));
  const candidates = [...unique.values()].filter((parcel) => (
    parcelContainsLonLat(parcel, point)
    || (boundaryToleranceMetres > 0
      && parcelBoundaryDistanceMetres(parcel, point) <= boundaryToleranceMetres)
  ));
  candidates.sort((first, second) => (
    parcelApproximateArea(first, point[1]) - parcelApproximateArea(second, point[1])
    || first.parcelId.localeCompare(second.parcelId)
  ));
  return candidates[0] ?? null;
}

function normalizeGridRotation(value: number): number {
  let result = Number.isFinite(value) ? value : 0;
  while (result >= 90) result -= 180;
  while (result < -90) result += 180;
  return Math.abs(result) < 1e-8 ? 0 : result;
}

function parcelPolygons(parcel: ParcelSelectionItem): readonly unknown[] {
  const geometry = asRecord(parcel.geometry);
  const coordinates = asArray(geometry.coordinates);
  return safeString(geometry.type, "") === "Polygon" ? [coordinates] : coordinates;
}

function dominantGridRotationDegrees(
  parcels: readonly ParcelSelectionItem[],
  referenceLatitude: number,
): number {
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLon = Math.max(
    1,
    metresPerDegreeLat * Math.cos(referenceLatitude * Math.PI / 180),
  );
  let longestSquared = 0;
  let angle = 0;
  for (const parcel of parcels) {
    for (const polygonValue of parcelPolygons(parcel)) {
      const exterior = asArray(asArray(polygonValue)[0]);
      for (let index = 1; index < exterior.length; index += 1) {
        const first = asArray(exterior[index - 1]);
        const second = asArray(exterior[index]);
        const east = (Number(second[0]) - Number(first[0])) * metresPerDegreeLon;
        const north = (Number(second[1]) - Number(first[1])) * metresPerDegreeLat;
        const lengthSquared = (east * east) + (north * north);
        if (!Number.isFinite(lengthSquared) || lengthSquared <= longestSquared) continue;
        longestSquared = lengthSquared;
        angle = Math.atan2(north, east) * 180 / Math.PI;
      }
    }
  }
  return normalizeGridRotation(angle);
}

function centered(value: number, width: number): number {
  return ((value + (width / 2)) % width + width) % width - (width / 2);
}

function normalizeLongitude(value: number): number {
  return centered(value, 360);
}

function wgs84MetresPerDegree(latitude: number): Readonly<{ latitude: number; longitude: number }> {
  const radians = latitude * Math.PI / 180;
  const semiMajorAxis = 6_378_137;
  const eccentricitySquared = 6.69437999014e-3;
  const sinLatitude = Math.sin(radians);
  const denominator = Math.sqrt(1 - eccentricitySquared * sinLatitude * sinLatitude);
  const primeVerticalRadius = semiMajorAxis / denominator;
  const meridionalRadius = semiMajorAxis * (1 - eccentricitySquared) / denominator ** 3;
  return {
    latitude: Math.PI / 180 * meridionalRadius,
    longitude: Math.max(1, Math.PI / 180 * primeVerticalRadius * Math.cos(radians)),
  };
}

function normalizedEarthGrid(value: unknown): EarthGridFrameContract | null {
  const record = asRecord(value);
  const storageOrigin = asRecord(record.storageOrigin);
  const worldWidthCells = Number(record.worldWidthCells);
  const worldHeightCells = Number(record.worldHeightCells);
  const metersPerCell = Number(record.metersPerCell);
  const centralMeridianDegrees = Number(record.centralMeridianDegrees);
  const originX = Number(storageOrigin.x);
  const originY = Number(storageOrigin.y);
  const originZ = Number(storageOrigin.z);
  if (
    safeString(record.schemaVersion, "") !== "vectoplan-earth-grid-frame.v1"
    || safeString(record.horizontalMapping, "") !== "vectoplan-periodic-equirectangular"
    || safeString(record.mappingVersion, "") !== "1"
    || safeString(record.axisConvention, "") !== "x-east-y-up-z-north"
    || !Number.isFinite(worldWidthCells) || worldWidthCells <= 0
    || !Number.isFinite(worldHeightCells) || worldHeightCells <= 0
    || !Number.isFinite(metersPerCell) || metersPerCell <= 0
    || !Number.isFinite(centralMeridianDegrees)
    || !Number.isFinite(originX) || !Number.isFinite(originY) || !Number.isFinite(originZ)
  ) return null;
  return {
    schemaVersion: "vectoplan-earth-grid-frame.v1",
    horizontalMapping: "vectoplan-periodic-equirectangular",
    mappingVersion: "1",
    axisConvention: "x-east-y-up-z-north",
    worldWidthCells,
    worldHeightCells,
    metersPerCell,
    centralMeridianDegrees,
    storageOrigin: { x: originX, y: originY, z: originZ },
  };
}

function fallbackEarthGrid(
  origin: { longitude: number; latitude: number } | null,
): EarthGridFrameContract | null {
  if (!origin) return null;
  const worldWidthCells = 40_000_000;
  const worldHeightCells = 20_000_000;
  const chunkSize = 16;
  const gridX = normalizeLongitude(origin.longitude) / 360 * worldWidthCells;
  const gridZ = origin.latitude / 180 * worldHeightCells;
  const frame: EarthGridFrameContract = {
    schemaVersion: "vectoplan-earth-grid-frame.v1",
    horizontalMapping: "vectoplan-periodic-equirectangular",
    mappingVersion: "1",
    axisConvention: "x-east-y-up-z-north",
    worldWidthCells,
    worldHeightCells,
    metersPerCell: 1,
    centralMeridianDegrees: 0,
    storageOrigin: {
      x: Math.floor(gridX / chunkSize) * chunkSize,
      y: 0,
      z: Math.floor(gridZ / chunkSize) * chunkSize,
    },
  };
  return frame;
}

function worldToLonLat(
  position: ChunkApiWorldPosition,
  earthGrid: EarthGridFrameContract | null,
): [number, number] | null {
  return worldPointToLonLat(position.x + 0.5, position.z + 0.5, earthGrid);
}

function worldPointToLonLat(
  worldX: number,
  worldZ: number,
  earthGrid: EarthGridFrameContract | null,
): [number, number] | null {
  if (!earthGrid) return null;
  return [...earthGridWorldPointToLonLat(worldX, worldZ, earthGrid)];
}

function lonLatToWorld(
  longitude: number,
  latitude: number,
  earthGrid: EarthGridFrameContract | null,
): [number, number] | null {
  if (!earthGrid || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const world = earthGridLonLatToWorld(longitude, latitude, earthGrid);
  return world ? [...world] : null;
}

function parcelGridGuideKey(
  parcelId: string,
  startLonLat: readonly [number, number],
  endLonLat: readonly [number, number],
): string {
  return parcelGridGuideIdentity(parcelId, startLonLat, endLonLat);
}

function parcelGridWorldGuideKey(
  parcelId: string,
  start: readonly [number, number],
  end: readonly [number, number],
  frame: EarthGridFrameContract | null,
): string {
  const startLonLat = worldPointToLonLat(start[0], start[1], frame);
  const endLonLat = worldPointToLonLat(end[0], end[1], frame);
  if (startLonLat && endLonLat) return parcelGridGuideKey(parcelId, startLonLat, endLonLat);
  return parcelGridGuideIdentity(`${parcelId}:world`, start, end, 5);
}

function parcelWorldGridPoints(
  parcel: ParcelSelectionItem,
  frame: EarthGridFrameContract,
): readonly [number, number][] {
  const points: Array<[number, number]> = [];
  for (const polygonValue of parcelPolygons(parcel)) {
    for (const ringValue of asArray(polygonValue)) {
      for (const coordinate of asArray(ringValue)) {
        const point = asArray(coordinate);
        const world = lonLatToWorld(Number(point[0]), Number(point[1]), frame);
        if (world) points.push(world);
      }
    }
  }
  return points;
}

export function createWorldEditController(
  options: WorldEditControllerOptions,
): WorldEditControllerHandle {
  let destroyed = false;
  let activeTool: WorldEditTool | null = null;
  let systemRegistry: WorldEditSystemRegistry | null = null;
  let operation: WorldEditOperation = "set";

  function restoreWorkspaceInput(reason: string, requestPointerLock = false): void {
    const inputController = options.sceneRuntime.getInputController();
    inputController?.clear(reason);
    inputController?.enable(reason);
    options.sceneRuntime.setWorkspaceMode(options.sceneRuntime.getWorkspaceMode(), reason);
    if (requestPointerLock && options.sceneRuntime.getWorkspaceMode() === "first-person") {
      try { void inputController?.requestPointerLock(reason); } catch { /* best effort */ }
    }
  }

  let roomType = "wohnen";
  let roomLabel = "Raum";
  let roomHeight = 3;
  let stairParameters: StairToolParameters = { ...DEFAULT_STAIR_TOOL_PARAMETERS };
  let stairQuickSettings: StairQuickSettingsHandle | null = null;
  let editingRoomInstanceId: string | null = null;
  let editingRoomAnchor: ChunkApiWorldPosition | null = null;
  let editingPlanningBuildAreaInstanceId: string | null = null;
  let editingPlanningBuildAreaAnchor: ChunkApiWorldPosition | null = null;
  let editingPlanningBuildAreaMetadata: Record<string, unknown> = {};
  let selectedStoreyBuildArea: ExistingRoomRef | null = null;
  let selectedStoreyScope: StoreyTargetScope = "all";
  let planningBuildingStoreyProfile: PlanningBuildingStoreyProfile = {
    baseCount: lineBrushBuildingPreset("standard").defaultStoreyCount,
    segmentAdjustments: {},
  };
  let planningBuildingProgramSelection: BuildingProgramTemplateSelection =
    createDefaultBuildingProgramTemplateSelection();
  let planningBuildingGenerationRequest: LineBrushBuildingGenerationRequest | null = null;
  let planningBuildingDraftDirty = false;
  let planningBuildingSceneRefreshPending: string | null = null;
  let planningBuildingSceneRefreshTimer = 0;
  let planningBuildingSceneMonitorFrame = 0;
  let planningBuildingSceneReadyCheckAt = 0;
  let planningBuildingSceneExpectedObjects = new Map<string, Set<string>>();
  let planningBuildingRoofPreviewCache: { key: string; specs: readonly PlanningRoofBuildSpec[] } | null = null;
  const planningBuildingEditVisuals = createLineBrushBuildingEditVisuals();
  let planningBuildingVisualRefreshAt = 0;
  const hiddenPlanningBuildingObjects = new Map<THREE.Object3D, boolean>();
  let lineBrushQuickSettings: LineBrushQuickSettingsHandle | null = null;
  let storeyQuickSettings: StoreyQuickSettingsHandle | null = null;
  let storeyDragHandle: ReturnType<typeof createStoreyDragHandle> | null = null;
  let storeyDragPreviousProfile: PlanningBuildingStoreyProfile | null = null;
  let storeyDragPreviousDirty = false;
  let planningBuildingPreviewSequence = 0;
  let planningBuildingRoofPreviewTimer = 0;
  let planningBuildingRoofPreviewAbortController: AbortController | null = null;
  let roomAreaWorkspaceProfile: "first-person" | "planning" | null = null;
  let planningBuildAreaWidth = 8;
  let planningBuildAreaMoving = false;
  let planningBuildAreaMoveOrigin: PolygonAreaPoint | null = null;
  let planningBuildAreaMovePoints: PolygonAreaPoint[] = [];
  let planningRoadConflictChoice: PathBrushElevatedResolution = "fill";
  let planningRoadConflicts: readonly PathBrushHeightConflict[] = [];
  let editingRoofInstanceId: string | null = null;
  let editingRoofAnchor: ChunkApiWorldPosition | null = null;
  let editingRoofMetadata: Record<string, unknown> = {};
  let editingRoofHoleRings: readonly (readonly PolygonAreaPoint[])[] = [];
  let roofSolarSettings = normalizeSolarSettings(null);
  let solarPanel: ReturnType<typeof createSolarToolPanel> | null = null;
  let roofParameters: RoofToolParameters = { ...DEFAULT_ROOF_TOOL_PARAMETERS };
  let roofCalculationSequence = 0;
  let roofCalculationAbortController: AbortController | null = null;
  let roofPreviewTimer = 0;
  let roofSettingsTexture: THREE.CanvasTexture | null = null;
  let roofQuickSettings: RoofQuickSettingsHandle | null = null;
  let roofZoneGroup: THREE.Group | null = null;
  let roofZoneSettingsTargets: RoofZoneSettingsTarget[] = [];
  let roofZoneSignature = "";
  let roofZoneRefreshAt = 0;
  let hiddenEditingRoofObjects: HiddenRoofObject[] = [];
  const pendingRoofQuickSettings = new Map<string, Readonly<{
    parameters: Pick<
      RoofToolParameters,
      | "roofType"
      | "pitchDeg"
      | "overhangMm"
      | "overhangNorthMm"
      | "overhangEastMm"
      | "overhangSouthMm"
      | "overhangWestMm"
      | "edgeOverhangsMm"
    >;
    calculationVersion: Readonly<Record<string, unknown>>;
  }>>();
  let selection: SelectionBounds = { first: null, second: null };
  let lastPlanningMassingDraft: PlanningMassingDraft | null = null;
  let selectionDragging = false;
  let selectionDragFrame = 0;
  let selectionHandleDrag: SelectionHandleDragState | null = null;
  let selectionDragPlaneY: number | null = null;
  let selectionDragSignature = "";
  let selectionBoxRuntime: SelectionBoxRuntime | null = null;
  let brushTarget: ChunkApiWorldPosition | null = null;
  let parcelSelection: ParcelSelection = {
    projectPublicId: "",
    revision: 0,
    projectCoordinate: null,
    projectCoordinateManualOverride: false,
    gridRotationDegrees: 0,
    parcels: [],
    adjacentParcels: [],
    availableParcels: [],
    parcelGridState: null,
  };
  let earthGrid: EarthGridFrameContract | null = null;
  let clipboard: readonly Record<string, unknown>[] = [];
  let clipboardPhase: "select" | "move" = "select";
  let clipboardSize: ClipboardSize | null = null;
  let clipboardAnchor: ChunkApiWorldPosition | null = null;
  let clipboardMoveDragging = false;
  let clipboardMoveFrame = 0;
  let clipboardMoveAxis: WorldEditSelectionAxis | null = null;
  let clipboardMoveStartAnchor: ChunkApiWorldPosition | null = null;
  let clipboardMovePlane: THREE.Plane | null = null;
  let clipboardMoveStartCoordinate = 0;
  let clipboardHoveredAxis: WorldEditSelectionAxis | null = null;
  let clipboardHoverFrame = 0;
  let clipboardHandles: ClipboardHandleDescriptor[] = [];
  let clipboardGizmoOrigin: THREE.Mesh | null = null;
  let clipboardPreviewRoot: THREE.Group | null = null;
  let tentaclePoints: TentaclePoint[] = [];
  let tentacleDrawing = false;
  let tentacleFinished = false;
  let tentacleEditingIndex: number | null = null;
  let tentacleHoveredIndex: number | null = null;
  let tentacleDrawStartedAt = 0;
  let tentacleDrawFrame = 0;
  let tentacleHoverFrame = 0;
  let tentacleGroup: THREE.Group | null = null;
  let tentaclePointTargets: THREE.Mesh[] = [];
  let tentacleWorkspaceProfile: "first-person" | "planning" | null = null;
  const createPolygonAreaRuntime = (): PolygonAreaRuntime => ({
    points: [],
    closed: false,
    editingIndex: null,
    hoveredIndex: null,
    interactionFrame: 0,
    hoverFrame: 0,
    group: null,
    pointTargets: [],
    moveTarget: null,
    settingsTarget: null,
    calculation: null,
    request: null,
  });
  const polygonAreas: Record<PolygonAreaTool, PolygonAreaRuntime> = {
    room: createPolygonAreaRuntime(),
    stair: createPolygonAreaRuntime(),
    roof: createPolygonAreaRuntime(),
  };
  let busy = false;
  let selectionGroup: THREE.Group | null = null;
  let parcelGroup: THREE.Group | null = null;
  let parcelGridGroup: THREE.Group | null = null;
  let parcelGridGuide: ParcelGridGuide | null = null;
  let parcelGridMode: "boundary" | "setback" = "boundary";
  let parcelGridSetback = 0;
  let parcelGridInfluence = 3;
  let parcelGridBuildingReference: Lod2BuildingGridReference | null = null;
  let activeParcelGridParcelId: string | null = null;
  let activeParcelGridGuideKey: string | null = null;
  const persistedParcelGridGuides = new Map<string, PersistedParcelGridGuide>();
  let parcelGridZoneCells: readonly ParcelGridZoneCell[] = [];
  let parcelGridZoneCellIndex = new Map<string, readonly ParcelGridZoneCell[]>();
  let parcelGridPlacementResolver: ParcelGridPlacementResolver | null = null;
  let parcelGridPlaneY: number | null = null;
  let parcelGridGeometrySignature = "";
  let parcelGridHandleAlong = 0.5;
  let parcelGridHandleTargets: THREE.Object3D[] = [];
  const parcelGridHandleRuntimes = new Map<string, ParcelGridHandleRuntime>();
  let parcelGridDragging = false;
  let parcelGridDragFrame = 0;
  let parcelGridDragState: ParcelGridDragState | null = null;
  let selectionHandles: HandleDescriptor[] = [];

  function currentWorkspacePointerNdc(): THREE.Vector2 {
    const pointer = workspacePointerNdc(
      options.sceneRuntime.getWorkspaceMode(),
      options.root.dataset.editorPlanningCursorX,
      options.root.dataset.editorPlanningCursorY,
    );
    return new THREE.Vector2(pointer.x, pointer.y);
  }

  function setWorkspacePointerRay(
    raycaster: THREE.Raycaster,
    camera: THREE.Camera,
    maximumDistance: number,
  ): void {
    raycaster.far = maximumDistance;
    raycaster.setFromCamera(currentWorkspacePointerNdc(), camera);
  }

  function syncParcelGuideVisibility(reason: string): void {
    const visible = worldEditToolShowsParcelGuides(activeTool);
    if (parcelGroup) parcelGroup.visible = visible;
    if (parcelGridGroup) parcelGridGroup.visible = visible;
    options.root.dataset.parcelGuideVisible = String(visible);
    options.root.dataset.parcelGuideVisibilityReason = reason;
    options.sceneRuntime.renderOnce(reason);
  }

  function cameraPointAtPlaneY(planeY: number, maximumDistance = 180): THREE.Vector3 | null {
    const camera = options.sceneRuntime.getCamera();
    if (!camera || !Number.isFinite(planeY)) return null;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, maximumDistance);
    const direction = raycaster.ray.direction;
    if (Math.abs(direction.y) < 1e-5) return null;
    const distance = (planeY - raycaster.ray.origin.y) / direction.y;
    if (!Number.isFinite(distance) || distance <= 0 || distance > maximumDistance) return null;
    return raycaster.ray.origin.clone().addScaledVector(direction, distance);
  }

  function worldPositionAtCameraPlane(
    planeY: number,
    fallback: ChunkApiWorldPosition | null = null,
    maximumDistance = 180,
  ): ChunkApiWorldPosition | null {
    const point = cameraPointAtPlaneY(planeY, maximumDistance);
    if (!point) return fallback;
    return {
      x: Math.floor(point.x),
      y: Math.floor(planeY),
      z: Math.floor(point.z),
    };
  }

  function rulerPointFromTarget(
    targetPoint: Readonly<{ x: number; y: number; z: number }> | null | undefined,
    sourceCellValue: unknown,
    fallback: ChunkApiWorldPosition | null = null,
  ): ChunkApiWorldPosition | null {
    if (!targetPoint) {
      options.root.dataset.rulerSnap = "free";
      return fallback;
    }
    const sourceCell = asRecord(sourceCellValue);
    const sourceX = sourceCell.worldX ?? sourceCell.x;
    const sourceY = sourceCell.worldY ?? sourceCell.y;
    const sourceZ = sourceCell.worldZ ?? sourceCell.z;
    const sourcePoint = [sourceX, sourceY, sourceZ]
      .every((value) => Number.isFinite(Number(value)))
      ? {
          x: Number(sourceX),
          y: Number(sourceY),
          z: Number(sourceZ),
        }
      : null;
    const snapped = snapWorldEditRulerPoint({ targetPoint, sourceCell: sourcePoint });
    options.root.dataset.rulerSnap = snapped.snappedToCorner ? "corner" : "free";
    return {
      x: Number(snapped.point.x.toFixed(2)),
      y: Number(snapped.point.y.toFixed(2)),
      z: Number(snapped.point.z.toFixed(2)),
    };
  }

  function isRulerSolidMesh(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (
        typeof current.userData.chunkKey === "string"
        || current.userData.vplibParametric === true
        || current.name.startsWith("optimistic-block:")
      ) return true;
      current = current.parent;
    }
    return false;
  }

  function visibleRulerSurfaceTarget(maximumDistance = 60): ChunkApiWorldPosition | null {
    const scene = options.sceneRuntime.getScene();
    const camera = options.sceneRuntime.getCamera();
    if (!scene || !camera) return null;
    const targets: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible && isRulerSolidMesh(object)) targets.push(object);
    });
    if (targets.length === 0) return null;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, maximumDistance);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    const sourceCell = rulerSourceCellFromSurfaceHit(hit.point, raycaster.ray.direction);
    return rulerPointFromTarget(hit.point, sourceCell);
  }

  function currentRulerTarget(): ChunkApiWorldPosition | null {
    const visibleTarget = visibleRulerSurfaceTarget();
    if (visibleTarget) return visibleTarget;
    const targetCells = options.sceneRuntime.getTargetCells();
    const exact = rulerPointFromTarget(
      targetCells.targetPoint,
      targetCells.sourceCell,
    );
    if (exact) return exact;
    if (!selection.first) return null;
    const projected = cameraPointAtPlaneY(selection.first.y, 1_200);
    return projected
      ? {
          x: Number(projected.x.toFixed(2)),
          y: Number(projected.y.toFixed(2)),
          z: Number(projected.z.toFixed(2)),
        }
      : selection.second;
  }

  function currentTentacleTarget(fallback?: ChunkApiWorldPosition | null): ChunkApiWorldPosition | null {
    const targetCells = options.sceneRuntime.getTargetCells();
    const point = targetCells.targetPoint;
    if (point) return { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
    const cell = cellPosition(targetCells.placementCell) ?? cellPosition(targetCells.sourceCell);
    if (cell) return cell;
    const planeY = Math.floor(tentaclePoints.at(-1)?.y ?? fallback?.y ?? Number.NaN);
    const fallbackCell = fallback
      ? { x: Math.floor(fallback.x), y: Math.floor(fallback.y), z: Math.floor(fallback.z) }
      : null;
    return Number.isFinite(planeY)
      ? worldPositionAtCameraPlane(Number(planeY) + 0.5, fallbackCell, 1_200)
      : fallbackCell;
  }

  function isPlanningWorkspace(): boolean {
    return options.sceneRuntime.getWorkspaceMode() === "planning";
  }

  function synchronizeRoomAreaWorkspaceProfile(): void {
    // A camera change must never reinterpret or discard a building draft.
    roomAreaWorkspaceProfile ??= "planning";
  }

  function isBuildingLineBrush(): boolean {
    return roomAreaWorkspaceProfile !== "first-person";
  }

  function planningRoadWidth(): number {
    return Math.max(2, Math.min(25, (Number(brushRadius?.value ?? 2) * 2) + 1));
  }

  function visibleTerrainSurface(): ReadonlyMap<string, number> | null {
    const scene = options.sceneRuntime.getScene();
    const overlay = scene?.getObjectByName("vectoplan_geodata_overlay_scene_group");
    return overlay?.userData.surfaceCellY instanceof Map
      ? overlay.userData.surfaceCellY as ReadonlyMap<string, number>
      : null;
  }

  function currentPlanningRoadDraft(): PathBrushDraft | null {
    return createPathBrushDraft(tentaclePoints, {
      kind: "road",
      width: planningRoadWidth(),
      interpolation: "catmull-rom",
    });
  }

  function persistedPathBrush(draft: PathBrushDraft): Readonly<Record<string, unknown>> {
    return {
      schemaVersion: draft.schemaVersion,
      kind: draft.kind,
      interpolation: draft.interpolation,
      width: draft.width,
      points: draft.points,
    };
  }

  function updatePlanningRoadConflicts(draft: PathBrushDraft | null): readonly PathBrushHeightConflict[] {
    const surface = visibleTerrainSurface();
    planningRoadConflicts = draft && surface
      ? resolvePathBrushHeightConflicts(
          draft,
          (x, z) => surface.get(`${Math.floor(x)}:${Math.floor(z)}`),
          { threshold: 3, elevatedResolution: planningRoadConflictChoice },
        )
      : [];
    options.root.dataset.planningRoadConflictCount = String(planningRoadConflicts.length);
    options.root.dataset.planningRoadConflictChoice = planningRoadConflictChoice;
    options.root.dataset.planningRoadTunnelCount = String(
      planningRoadConflicts.filter((conflict) => conflict.resolution === "tunnel").length,
    );
    return planningRoadConflicts;
  }

  function pathBrushAreaMesh(
    ring: readonly (readonly [number, number])[],
    y: number,
    color: number,
    opacity: number,
    name: string,
    holes: readonly (readonly (readonly [number, number])[])[] = [],
  ): THREE.Mesh | null {
    if (ring.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(ring[0]![0], -ring[0]![1]);
    for (const point of ring.slice(1)) shape.lineTo(point[0], -point[1]);
    shape.closePath();
    for (const holeRing of holes) {
      if (holeRing.length < 3) continue;
      const hole = new THREE.Path();
      hole.moveTo(holeRing[0]![0], -holeRing[0]![1]);
      for (const point of holeRing.slice(1)) hole.lineTo(point[0], -point[1]);
      hole.closePath();
      shape.holes.push(hole);
    }
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }));
    mesh.name = name;
    mesh.renderOrder = 88;
    return mesh;
  }

  function centeredTentaclePoint(point: TentaclePoint): TentaclePoint {
    return { x: Math.floor(point.x) + 0.5, y: Math.floor(point.y) + 0.5, z: Math.floor(point.z) + 0.5 };
  }

  function addTentaclePoint(point: TentaclePoint): boolean {
    const previous = tentaclePoints.at(-1);
    const centered = centeredTentaclePoint(point);
    if (previous && Math.hypot(centered.x - previous.x, centered.y - previous.y, centered.z - previous.z) < 0.75) return false;
    if (tentaclePoints.length >= 128) return false;
    tentaclePoints.push(centered);
    rebuildTentacleScene();
    refreshHud();
    return true;
  }

  function tentaclePointColor(index: number): number {
    if (index === tentacleEditingIndex || index === tentacleHoveredIndex) return 0xfacc15;
    return index === tentaclePoints.length - 1 ? 0xffffff : 0x2563eb;
  }

  function rebuildTentacleScene(): void {
    disposeTentacleGroup();
    if (tentaclePoints.length === 0) return;
    const scene = options.sceneRuntime.getScene();
    if (!scene) return;
    const group = new THREE.Group();
    group.name = "vectoplan_world_edit_tentacle";
    const planningDraft = currentPlanningRoadDraft();
    if (planningDraft) {
      const previewY = planningDraft.points[0]!.y + 0.025;
      for (const [index, polygon] of planningDraft.polygons.entries()) {
        const preview = pathBrushAreaMesh(
          polygon.coordinates,
          previewY,
          0x0ea5e9,
          polygon.role === "segment" ? 0.2 : 0.12,
          `vectoplan_world_edit_planning_road:${index}`,
          polygon.holes,
        );
        if (preview) group.add(preview);
      }
      for (const conflict of updatePlanningRoadConflicts(planningDraft)) {
        const color = conflict.resolution === "tunnel"
          ? 0x7c3aed
          : conflict.resolution === "bridge" ? 0xf97316 : 0xeab308;
        const placeholder = pathBrushAreaMesh(
          conflict.placeholder,
          previewY + 0.035,
          color,
          0.42,
          `vectoplan_world_edit_road_conflict:${conflict.id}`,
        );
        if (placeholder) {
          placeholder.userData = {
            planningRoadConflict: true,
            conflictId: conflict.id,
            conflictKind: conflict.kind,
            resolution: conflict.resolution,
          };
          group.add(placeholder);
        }
      }
    } else {
      updatePlanningRoadConflicts(null);
    }
    const sampled = sampleTentacleCurve(tentaclePoints);
    if (sampled.length >= 2) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(sampled.map((point) => new THREE.Vector3(point.x, point.y, point.z))),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 0.96 }),
      );
      line.renderOrder = 98;
      group.add(line);
    }
    for (const [index, point] of tentaclePoints.entries()) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(index === 0 || index === tentaclePoints.length - 1 ? 0.32 : 0.26, 14, 10),
        new THREE.MeshBasicMaterial({
          color: tentaclePointColor(index),
          depthTest: false,
        }),
      );
      marker.position.set(point.x, point.y, point.z);
      marker.renderOrder = 99;
      marker.userData = { worldEditTentaclePoint: true, tentaclePointIndex: index };
      group.add(marker);
      tentaclePointTargets.push(marker);
    }
    scene.add(group);
    tentacleGroup = group;
    options.sceneRuntime.renderOnce("world-edit.tentacle-preview");
  }

  function tentaclePointUnderCrosshair(): number | null {
    const camera = options.sceneRuntime.getCamera();
    if (!camera || tentaclePointTargets.length === 0) return null;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.5;
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const hit = raycaster.intersectObjects(tentaclePointTargets, false)[0];
    const index = Number(hit?.object.userData.tentaclePointIndex);
    return Number.isInteger(index) && index >= 0 && index < tentaclePoints.length ? index : null;
  }

  function updateTentacleMarkerColors(): void {
    tentaclePointTargets.forEach((marker, index) => {
      const material = marker.material;
      if (material instanceof THREE.MeshBasicMaterial) material.color.setHex(tentaclePointColor(index));
    });
    options.sceneRuntime.renderOnce("world-edit.tentacle-hover");
  }

  function trackTentacleHover(): void {
    if (activeTool !== "tentacle") {
      tentacleHoverFrame = 0;
      return;
    }
    const next = tentaclePointUnderCrosshair();
    if (next !== tentacleHoveredIndex) {
      tentacleHoveredIndex = next;
      updateTentacleMarkerColors();
    }
    tentacleHoverFrame = requestAnimationFrame(trackTentacleHover);
  }

  function startTentacleHover(): void {
    if (tentacleHoverFrame) cancelAnimationFrame(tentacleHoverFrame);
    tentacleHoverFrame = requestAnimationFrame(trackTentacleHover);
  }

  function stopTentacleHover(): void {
    if (tentacleHoverFrame) cancelAnimationFrame(tentacleHoverFrame);
    tentacleHoverFrame = 0;
    tentacleHoveredIndex = null;
    updateTentacleMarkerColors();
  }

  function removeTentaclePointUnderCrosshair(): boolean {
    const index = tentaclePointUnderCrosshair();
    if (index === null) return false;
    stopTentacleDrawing();
    tentaclePoints.splice(index, 1);
    tentacleHoveredIndex = null;
    if (tentaclePoints.length < 2) tentacleFinished = false;
    rebuildTentacleScene();
    refreshHud();
    setStatus(`Stützpunkt ${index + 1} gelöscht. ${tentaclePoints.length} Stützpunkte verbleiben.`, "ready");
    return true;
  }

  function trackTentacleInteraction(): void {
    if (!tentacleDrawing && tentacleEditingIndex === null) return;
    const target = currentTentacleTarget(
      tentacleEditingIndex === null ? null : tentaclePoints[tentacleEditingIndex] ?? null,
    );
    if (target && tentacleEditingIndex !== null) {
      const centered = centeredTentaclePoint(target);
      const previous = tentaclePoints[tentacleEditingIndex];
      if (previous && (previous.x !== centered.x || previous.y !== centered.y || previous.z !== centered.z)) {
        tentaclePoints[tentacleEditingIndex] = centered;
        rebuildTentacleScene();
        refreshHud();
      }
    } else if (target && tentacleDrawing) {
      const centered = centeredTentaclePoint(target);
      const previous = tentaclePoints.at(-1);
      const sampleDistance = previous
        ? Math.hypot(centered.x - previous.x, centered.y - previous.y, centered.z - previous.z)
        : Number.POSITIVE_INFINITY;
      if (shouldAppendTentacleSample(performance.now() - tentacleDrawStartedAt, sampleDistance)) {
        addTentaclePoint(target);
      }
    }
    tentacleDrawFrame = requestAnimationFrame(trackTentacleInteraction);
  }

  function startTentacleDrawing(target: ChunkApiWorldPosition): void {
    if (tentacleDrawing || tentacleEditingIndex !== null) return;
    const existingPointIndex = tentaclePointUnderCrosshair();
    if (existingPointIndex !== null) {
      tentacleEditingIndex = existingPointIndex;
      rebuildTentacleScene();
      tentacleDrawFrame = requestAnimationFrame(trackTentacleInteraction);
      setStatus(`Stützpunkt ${existingPointIndex + 1} wird verschoben. Linksklick loslassen, um ihn zu fixieren.`, "ready");
      return;
    }
    if (tentacleFinished) {
      setStatus("Der Pfad ist mit ESC abgeschlossen. Vorhandene Punkte können noch verschoben werden; für einen neuen Pfad bitte zurücksetzen.", "warning");
      return;
    }
    tentacleDrawing = true;
    tentacleDrawStartedAt = performance.now();
    addTentaclePoint(target);
    tentacleDrawFrame = requestAnimationFrame(trackTentacleInteraction);
    setStatus("Stützpunkt gesetzt. Linksklick halten zeichnet nach kurzer Haltezeit weiter; ESC schließt den Pfad ab.", "ready");
  }

  function stopTentacleDrawing(): void {
    tentacleDrawing = false;
    tentacleEditingIndex = null;
    if (tentacleDrawFrame) cancelAnimationFrame(tentacleDrawFrame);
    tentacleDrawFrame = 0;
    rebuildTentacleScene();
  }

  function finishTentaclePath(): void {
    stopTentacleDrawing();
    if (tentaclePoints.length < 2) {
      setStatus("Für einen fertigen Tentacle-Pfad werden mindestens zwei Punkte benötigt.", "warning");
      return;
    }
    tentacleFinished = true;
    rebuildTentacleScene();
    const tunnels = planningRoadConflicts.filter((conflict) => conflict.resolution === "tunnel").length;
    const elevated = planningRoadConflicts.length - tunnels;
    setStatus(
      `Straßenkorridor mit ${tentaclePoints.length} Stützpunkten abgeschlossen. ${elevated} Höhenlücken (${planningRoadConflictChoice === "bridge" ? "Brücke" : "Auffüllung"}), ${tunnels} Bergdurchstöße (Tunnel).`,
      "ready",
    );
  }

  function synchronizeTentacleWorkspaceProfile(): void {
    // Road geometry and conflict resolution belong to the tool, not the camera.
    tentacleWorkspaceProfile = "planning";
  }

  async function executeTentaclePath(): Promise<void> {
    if (busy) return;
    if (!tentacleFinished) {
      setStatus("Bitte den Pfad zuerst mit ESC abschließen.", "warning");
      return;
    }
    const path = voxelizeTentacleCurve(tentaclePoints).slice(0, 2_048);
    if (path.length < 2) {
      setStatus("Bitte mindestens zwei verschiedene Pfadpunkte zeichnen.", "warning");
      return;
    }
    const effectiveOperation = ["set", "wall", "fill", "replace", "clear"].includes(operation) ? operation : "set";
    const planningRoadDraft = currentPlanningRoadDraft();
    const conflicts = updatePlanningRoadConflicts(planningRoadDraft);
    const placement = selectedPlacement();
    const replaceBlockTypeId = options.sceneRuntime.getTargetCells().sourceCell?.blockTypeId ?? null;
    if (operationNeedsMaterial(effectiveOperation) && (!placement.valid || !placement.runtimeBlockTypeId)) {
      setStatus("Für Straße/Volumen bitte zuerst einen platzierbaren Block in der Hotbar auswählen; für Tunnel Leeren wählen.", "warning");
      return;
    }
    if (effectiveOperation === "replace" && !replaceBlockTypeId) {
      setStatus("Für Ersetzen bitte beim Ausführen auf den zu ersetzenden Quellblock zielen.", "warning");
      return;
    }
    if (parcelMaskInput?.checked && parcelSelection.parcels.length === 0) {
      setStatus("Bitte zuerst mindestens ein Flurstück auswählen oder die Grundstücksmaske deaktivieren.", "warning");
      return;
    }
    busy = true;
    if (executeButton) executeButton.disabled = true;
    setStatus(isPlanningWorkspace()
      ? "Straßenkorridor wird über dieselbe Tentacle-/Chunk-Pipeline gespeichert …"
      : "Tentacle-Pfad wird transaktional angewendet …", "busy");
    try {
      const payload: ChunkApiWorldEditCommandPayload = {
        type: "WorldEdit",
        userId: "editor_user",
        sessionId: `world_edit_tentacle_${Date.now()}`,
        position: path[0]!,
        path,
        tool: "tentacle",
        operation: effectiveOperation,
        ...(placement.runtimeBlockTypeId ? { blockTypeId: placement.runtimeBlockTypeId } : {}),
        ...(effectiveOperation === "replace" && replaceBlockTypeId ? { replaceBlockTypeId } : {}),
        brush: {
          shape: brushShape?.value ?? "sphere",
          radius: Number(brushRadius?.value ?? 2),
          density: Number(brushDensity?.value ?? 100),
          wallThickness: Number(brushWall?.value ?? 0),
        },
        parcelMask: parcelMaskPayload(),
        commandSource: WORLD_EDIT_COMMAND_SOURCE,
        commandMetadata: {
          source: "world-edit-controller",
          projectPublicId: parcelSelection.projectPublicId,
          ...(planningRoadDraft ? {
            schemaVersion: "vectoplan-planning-road-path.v1",
            planningMode: true,
            semanticRole: "road-centerline",
            pathBrush: persistedPathBrush(planningRoadDraft),
            conflictPolicy: "placeholder-only",
            elevatedConflictChoice: planningRoadConflictChoice,
            heightConflicts: conflicts,
          } : {}),
        },
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: `world-edit:tentacle:${effectiveOperation}`,
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      const commandResult = requireCommandResultFromUnknown(result, "WorldEdit Tentacle Stra\u00dfe");
      if (commandResult.changed) await options.sceneRuntime.reloadDirtyChunks("world-edit-tentacle");
      setStatus(planningRoadDraft
        ? `Straßenkorridor mit ${path.length} Mittellinien-Zellen gespeichert; ${conflicts.length} Höhenkonflikte bleiben als Planungsplatzhalter erhalten.`
        : `Tentacle-Pfad mit ${path.length} Mittellinien-Zellen angewendet.`, "ready");
    } catch (error) {
      options.logger?.warn?.("WorldEdit tentacle command failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  function polygonAreaRuntime(tool: PolygonAreaTool): PolygonAreaRuntime {
    return polygonAreas[tool];
  }

  function activePolygonAreaTool(): PolygonAreaTool | null {
    return activeTool === "room" || activeTool === "stair" || activeTool === "roof" ? activeTool : null;
  }

  function snappedPolygonAreaPoint(
    tool: PolygonAreaTool,
    point: Readonly<{ x: number; y: number; z: number }>,
  ): PolygonAreaPoint {
    const runtime = polygonAreaRuntime(tool);
    return {
      x: Math.round(point.x),
      y: runtime.points[0]?.y ?? Math.round(point.y),
      z: Math.round(point.z),
    };
  }

  function resolvePolygonAreaTarget(
    tool: PolygonAreaTool,
    intent: EditorInputWorldEditIntent,
  ): ChunkApiWorldPosition | null {
    const runtime = polygonAreaRuntime(tool);
    const exact = intent.targetPoint;
    if (exact) return snappedPolygonAreaPoint(tool, exact);
    const fallback = intent.position
      ?? cellPosition(intent.placementCell)
      ?? cellPosition(intent.sourceCell);
    if (fallback) return snappedPolygonAreaPoint(tool, fallback);
    if (runtime.points.length === 0) return null;
    const projected = cameraPointAtPlaneY(runtime.points[0]!.y, 1_200);
    return projected ? snappedPolygonAreaPoint(tool, projected) : null;
  }

  function currentPolygonAreaTarget(
    tool: PolygonAreaTool,
    fallback?: PolygonAreaPoint | null,
  ): PolygonAreaPoint | null {
    const runtime = polygonAreaRuntime(tool);
    const targetCells = options.sceneRuntime.getTargetCells();
    const exact = targetCells.targetPoint;
    if (exact) return snappedPolygonAreaPoint(tool, exact);
    const cell = cellPosition(targetCells.placementCell) ?? cellPosition(targetCells.sourceCell);
    if (cell) return snappedPolygonAreaPoint(tool, cell);
    const planeY = runtime.points[0]?.y ?? fallback?.y;
    if (!Number.isFinite(planeY)) return fallback ?? null;
    const projected = cameraPointAtPlaneY(Number(planeY), 1_200);
    return projected ? snappedPolygonAreaPoint(tool, projected) : fallback ?? null;
  }

  function disposePolygonAreaGroup(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    if (tool === "room") {
      for (const [object, visible] of hiddenPlanningBuildingObjects) object.visible = visible;
      hiddenPlanningBuildingObjects.clear();
      planningBuildingPreviewSequence += 1;
      if (planningBuildingRoofPreviewTimer) {
        window.clearTimeout(planningBuildingRoofPreviewTimer);
        planningBuildingRoofPreviewTimer = 0;
      }
      planningBuildingRoofPreviewAbortController?.abort();
      planningBuildingRoofPreviewAbortController = null;
    }
    runtime.pointTargets = [];
    runtime.moveTarget = null;
    runtime.settingsTarget = null;
    if (!runtime.group) return;
    runtime.group.traverse((object) => {
      const drawable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      drawable.geometry?.dispose();
      if (Array.isArray(drawable.material)) drawable.material.forEach((material) => material.dispose());
      else drawable.material?.dispose();
    });
    runtime.group.parent?.remove(runtime.group);
    runtime.group = null;
  }

  function currentRoofSettingsTexture(): THREE.CanvasTexture {
    if (roofSettingsTexture) return roofSettingsTexture;
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    if (context) {
      context.shadowColor = "rgba(15, 23, 42, .48)";
      context.shadowBlur = 16;
      context.fillStyle = "#f97316";
      context.beginPath();
      context.arc(96, 96, 70, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.lineWidth = 8;
      context.strokeStyle = "#ffffff";
      context.stroke();
      context.fillStyle = "#ffffff";
      context.font = "bold 92px 'Segoe UI Symbol', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("⚙", 96, 101);
    }
    roofSettingsTexture = new THREE.CanvasTexture(canvas);
    roofSettingsTexture.colorSpace = THREE.SRGBColorSpace;
    roofSettingsTexture.minFilter = THREE.LinearFilter;
    roofSettingsTexture.magFilter = THREE.LinearFilter;
    roofSettingsTexture.needsUpdate = true;
    return roofSettingsTexture;
  }

  function disposeRoofZoneGroup(): void {
    roofZoneSettingsTargets = [];
    if (!roofZoneGroup) return;
    roofZoneGroup.traverse((object) => {
      const drawable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      drawable.geometry?.dispose();
      if (Array.isArray(drawable.material)) drawable.material.forEach((material) => material.dispose());
      else drawable.material?.dispose();
    });
    roofZoneGroup.parent?.remove(roofZoneGroup);
    roofZoneGroup = null;
  }

  function rebuildRoofZoneScene(force = false): void {
    const roofs = inactiveRoofZones(existingRoofsInScene(), editingRoofInstanceId);
    const signature = JSON.stringify(roofs.map((roof) => [
      roof.objectInstanceId,
      roof.anchor.y,
      roof.footprint.type,
      roof.footprint.baseY,
      roof.footprint.coordinates,
      asRecord(roof.metadata.roofCalculation).input_fingerprint,
    ]));
    if (!force && signature === roofZoneSignature && (roofZoneGroup || roofs.length === 0)) return;
    roofZoneSignature = signature;
    disposeRoofZoneGroup();
    if (activeTool !== "roof" || roofs.length === 0) return;
    const scene = options.sceneRuntime.getScene();
    if (!scene) return;

    const group = new THREE.Group();
    group.name = "vectoplan_world_edit_persisted_roof_zones";
    for (const roof of roofs) {
      const points = polygonAreaPointsFromFootprint(roof.footprint, roof.anchor.y);
      if (!validPolygonArea(points)) continue;
      const highlight = createRoofSurfaceHighlight(roof.metadata.roofCalculation);
      if (!highlight) continue;
      highlight.name = `vectoplan_world_edit_roof_zone_surface:${roof.objectInstanceId}`;
      group.add(highlight);
      const centroid = roofSurfaceMarker(roofSurfaceTriangles(roof.metadata.roofCalculation));
      if (!centroid) continue;
      const settings = new THREE.Sprite(new THREE.SpriteMaterial({
        map: currentRoofSettingsTexture(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }));
      settings.name = `vectoplan_world_edit_roof_settings:${roof.objectInstanceId}`;
      settings.position.set(centroid.x, centroid.y + 0.72, centroid.z);
      settings.scale.set(1.5, 1.5, 1);
      settings.renderOrder = 101;
      settings.userData = {
        worldEditRoofSettings: true,
        worldEditRoofInstanceId: roof.objectInstanceId,
      };
      roofZoneSettingsTargets.push({ target: settings, roof });
      group.add(settings);
    }
    if (group.children.length === 0) return;
    scene.add(group);
    roofZoneGroup = group;
    options.sceneRuntime.renderOnce("world-edit.persisted-roof-zones");
  }

  function polygonAreaPointColor(tool: PolygonAreaTool, index: number): number {
    const runtime = polygonAreaRuntime(tool);
    if (index === runtime.editingIndex || index === runtime.hoveredIndex) return 0xfacc15;
    if (index === 0) return 0xffffff;
    return tool === "roof" ? 0xf97316 : tool === "stair" ? 0xa855f7 : 0x22c55e;
  }

  function currentPlanningBuildAreaDraft(): PathBrushDraft | null {
    return createPathBrushDraft(polygonAreaRuntime("room").points, {
      kind: "building",
      width: planningBuildAreaWidth,
      interpolation: "linear",
    });
  }

  function rebuildPlanningBuildAreaScene(scene: THREE.Scene, runtime: PolygonAreaRuntime): void {
    const draft = currentPlanningBuildAreaDraft();
    if (!draft) {
      if (runtime.points.length === 1) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.34, 14, 10),
          new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
        );
        marker.position.set(runtime.points[0]!.x, runtime.points[0]!.y + 0.035, runtime.points[0]!.z);
        marker.renderOrder = 99;
        marker.userData = { worldEditPolygonAreaPoint: true, polygonAreaTool: "room", polygonAreaPointIndex: 0 };
        const group = new THREE.Group();
        group.name = "vectoplan_world_edit_planning_build_area";
        group.add(marker);
        runtime.pointTargets.push(marker);
        scene.add(group);
        runtime.group = group;
      }
      return;
    }
    const group = new THREE.Group();
    group.name = "vectoplan_world_edit_planning_build_area";
    const editable = activeTool === "room";
    group.userData.lineBrushEditable = editable;
    const previewBaseY = editingPlanningBuildAreaAnchor?.y
      ?? Math.floor(draft.points[0]!.y + 1);
    let buildingPreviewWithinCellBudget = false;
    try {
      const storeys = planningStoreyBuildSpecs(draft, previewBaseY).map((spec) => ({
        scope: spec.scope,
        storey: spec.storey,
      }));
      group.add(createLineBrushBuildingStructurePreview({
        storeys,
        selectedScope: selectedStoreyScope,
        editable,
        wallBlockTypeId: planningBuildingBlockTypeId(),
      }));
      buildingPreviewWithinCellBudget = true;
    } catch (error) {
      // A one-cell or just-started stroke can be too small to voxelise. Keep
      // its 2D controls usable and let the next pointer update retry.
      options.logger?.debug?.("Line-brush structure preview is not ready yet.", {
        error: normalizeUnknownError(error),
      });
    }
    const previewY = draft.points[0]!.y + 0.035;
    for (const [index, polygon] of draft.polygons.entries()) {
      const fill = pathBrushAreaMesh(
        polygon.coordinates,
        previewY,
        runtime.closed ? 0x0f766e : 0x14b8a6,
        polygon.role === "segment" ? 0.24 : 0.14,
        `vectoplan_world_edit_planning_build_area_segment:${index}`,
        polygon.holes,
      );
      if (fill) group.add(fill);
      if (fill) fill.visible = editable;
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        draft.points.map((point) => new THREE.Vector3(point.x, previewY + 0.02, point.z)),
      ),
      new THREE.LineBasicMaterial({ color: 0x0f766e, depthTest: false, transparent: true, opacity: 1 }),
    );
    line.name = "vectoplan_world_edit_planning_build_area_centerline";
    line.visible = editable;
    line.renderOrder = 97;
    group.add(line);
    for (const [index, point] of runtime.points.entries()) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(index === 0 ? 0.34 : 0.27, 14, 10),
        new THREE.MeshBasicMaterial({ color: polygonAreaPointColor("room", index), depthTest: false }),
      );
      marker.position.set(point.x, previewY + 0.025, point.z);
      marker.renderOrder = 99;
      marker.userData = { worldEditPolygonAreaPoint: true, polygonAreaTool: "room", polygonAreaPointIndex: index };
      runtime.pointTargets.push(marker);
      group.add(marker);
    }
    if (runtime.closed) {
      const moveHandle = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.46, 0),
        new THREE.MeshBasicMaterial({ color: planningBuildAreaMoving ? 0xfacc15 : 0x0f766e, depthTest: false }),
      );
      moveHandle.name = "vectoplan_world_edit_planning_build_area_move";
      moveHandle.position.set(
        (draft.bounds.minimum.x + draft.bounds.maximum.x) * 0.5,
        previewY + 0.55,
        (draft.bounds.minimum.z + draft.bounds.maximum.z) * 0.5,
      );
      moveHandle.renderOrder = 100;
      moveHandle.userData = { planningBuildAreaMoveHandle: true };
      runtime.moveTarget = moveHandle;
      group.add(moveHandle);
    }
    if (editable) {
      const settings = new THREE.Sprite(new THREE.SpriteMaterial({
        map: currentRoofSettingsTexture(), transparent: true, depthTest: false,
        depthWrite: false, toneMapped: false,
      }));
      settings.name = "vectoplan_world_edit_building_settings";
      settings.position.set((draft.bounds.minimum.x + draft.bounds.maximum.x) * 0.5,
        previewBaseY + Math.max(...draft.segments.map((_, index) => planningStoreyCountForScope(`segment:${index}`)))
          * STANDARD_STOREY_HEIGHT_METERS + 2,
        (draft.bounds.minimum.z + draft.bounds.maximum.z) * 0.5);
      settings.scale.set(1.65, 1.65, 1);
      settings.renderOrder = 101;
      settings.userData.worldEditBuildingSettings = true;
      runtime.settingsTarget = settings;
      group.add(settings);
    }
    scene.add(group);
    runtime.group = group;
    hidePlanningBuildingSourceMeshes();
    startPlanningBuildingSceneMonitor();
    if (buildingPreviewWithinCellBudget) {
      schedulePlanningBuildingRoofPreview(group, draft, previewBaseY);
    }
    syncLineBrushStoreyEditing();
    options.root.dataset.planningBuildAreaWidth = draft.width.toFixed(2);
    options.root.dataset.planningBuildAreaSegments = String(draft.segments.length);
    options.root.dataset.planningBuildAreaEditable = String(runtime.closed);
    options.sceneRuntime.renderOnce("world-edit.planning-build-area-preview");
  }

  function rebuildPolygonAreaScene(tool: PolygonAreaTool): void {
    disposePolygonAreaGroup(tool);
    if (tool === "room") refreshPlanningBuildingEditVisuals();
    const runtime = polygonAreaRuntime(tool);
    const retainedBuilding = tool === "room" && isBuildingLineBrush()
      && (activeTool === "storey" || !editingPlanningBuildAreaInstanceId
        || planningBuildingDraftDirty || planningBuildingSceneRefreshPending !== null);
    if (runtime.points.length === 0 || (activeTool !== tool && !retainedBuilding)) return;
    const scene = options.sceneRuntime.getScene();
    if (!scene) return;
    if (tool === "room" && isBuildingLineBrush()) {
      rebuildPlanningBuildAreaScene(scene, runtime);
      if (activeTool !== "room") {
        runtime.pointTargets.forEach((target) => { target.visible = false; });
        if (runtime.moveTarget) runtime.moveTarget.visible = false;
      }
      return;
    }
    const group = new THREE.Group();
    group.name = `vectoplan_world_edit_${tool}_polygon`;
    const planeOffset = 0.035;
    const roofTriangles = tool === "roof" ? roofSurfaceTriangles(runtime.calculation) : [];
    const surfaceHighlight = tool === "roof" ? createRoofSurfaceHighlight(runtime.calculation, 0xfb923c) : null;
    if (surfaceHighlight) group.add(surfaceHighlight);
    const visiblePoints = runtime.points.map((point) => new THREE.Vector3(point.x,
      (heightOnRoof(roofTriangles, point.x, point.z, point.y) ?? point.y) + planeOffset, point.z));
    const linePoints = runtime.closed && visiblePoints.length >= 3
      ? [...visiblePoints, visiblePoints[0]!]
      : visiblePoints;
    if (linePoints.length >= 2 && !surfaceHighlight) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(linePoints),
        new THREE.LineBasicMaterial({
          color: tool === "roof" ? 0xfb923c : tool === "stair" ? 0xc084fc : 0x4ade80,
          depthTest: false,
          transparent: true,
          opacity: 0.98,
        }),
      );
      line.renderOrder = 97;
      group.add(line);
    }
    if (runtime.closed && validPolygonArea(runtime.points) && !surfaceHighlight) {
      const shape = new THREE.Shape();
      shape.moveTo(runtime.points[0]!.x, -runtime.points[0]!.z);
      runtime.points.slice(1).forEach((point) => shape.lineTo(point.x, -point.z));
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, runtime.points[0]!.y + planeOffset * 0.5, 0);
      const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: tool === "roof" ? 0xf97316 : tool === "stair" ? 0xa855f7 : 0x22c55e,
        transparent: true,
        opacity: tool === "roof" ? 0.18 : tool === "stair" ? 0.16 : 0.2,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }));
      fill.name = `vectoplan_world_edit_${tool}_area_fill`;
      fill.renderOrder = 85;
      group.add(fill);
    }
    for (const [index, point] of runtime.points.entries()) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(index === 0 ? 0.34 : 0.27, 14, 10),
        new THREE.MeshBasicMaterial({ color: polygonAreaPointColor(tool, index), depthTest: false }),
      );
      marker.position.copy(visiblePoints[index]!);
      marker.renderOrder = 99;
      marker.userData = { worldEditPolygonAreaPoint: true, polygonAreaTool: tool, polygonAreaPointIndex: index };
      runtime.pointTargets.push(marker);
      group.add(marker);
    }
    if ((tool === "roof" || tool === "stair") && runtime.closed && validPolygonArea(runtime.points)) {
      const centroid = roofSurfaceMarker(roofTriangles) ?? polygonAreaPlanCentroid(runtime.points);
      if (centroid) {
        const settings = new THREE.Sprite(new THREE.SpriteMaterial({
          map: currentRoofSettingsTexture(),
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }));
        settings.name = `vectoplan_world_edit_${tool}_settings`;
        settings.position.set(centroid.x, centroid.y + 0.7, centroid.z);
        settings.scale.set(1.65, 1.65, 1);
        settings.renderOrder = 101;
        settings.userData = tool === "roof" ? { worldEditRoofSettings: true } : { worldEditStairSettings: true };
        runtime.settingsTarget = settings;
        group.add(settings);
      }
    }
    if (tool === "roof" && runtime.closed && runtime.calculation) {
      const rendered = createRoofCalculationMeshes(runtime.calculation, { preview: true });
      rendered.meshes.forEach((mesh) => group.add(mesh));
      const solar = createSolarMesh(buildSolarLayout(runtime.calculation, roofSolarSettings), roofSolarSettings.module);
      if (solar) group.add(solar);
    }
    scene.add(group);
    runtime.group = group;
    if (tool === "roof") solarPanel?.refresh();
    options.root.dataset.polygonAreaTool = tool;
    options.root.dataset.polygonAreaPoints = String(runtime.points.length);
    options.root.dataset.polygonAreaClosed = String(runtime.closed);
    options.sceneRuntime.renderOnce(`world-edit.${tool}-polygon-preview`);
  }

  function polygonAreaPointUnderCrosshair(tool: PolygonAreaTool): number | null {
    const runtime = polygonAreaRuntime(tool);
    const camera = options.sceneRuntime.getCamera();
    if (!camera || runtime.pointTargets.length === 0) return null;
    runtime.group?.updateWorldMatrix(true, true);
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const hit = raycaster.intersectObjects(runtime.pointTargets, false)[0];
    const index = Number(hit?.object.userData.polygonAreaPointIndex);
    return Number.isInteger(index) && index >= 0 && index < runtime.points.length ? index : null;
  }

  function planningBuildAreaMoveHandleUnderCrosshair(): boolean {
    const runtime = polygonAreaRuntime("room");
    const camera = options.sceneRuntime.getCamera();
    if (!camera || !runtime.moveTarget || !isBuildingLineBrush()) return false;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    return Boolean(raycaster.intersectObject(runtime.moveTarget, false)[0]);
  }

  function roofSettingsUnderCrosshair(): ExistingRoofRef | null | undefined {
    const runtime = polygonAreaRuntime("roof");
    const camera = options.sceneRuntime.getCamera();
    if (!camera) return undefined;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const targets = [
      ...(runtime.settingsTarget && runtime.closed ? [runtime.settingsTarget] : []),
      ...roofZoneSettingsTargets.map(({ target }) => target),
    ];
    const hit = raycaster.intersectObjects(targets, false)[0]?.object;
    if (!hit) return undefined;
    if (hit === runtime.settingsTarget) return null;
    return roofZoneSettingsTargets.find(({ target }) => target === hit)?.roof;
  }

  function openPlanningBuildingSettingsUnderCrosshair(): boolean {
    if (!isBuildingLineBrush() || !lineBrushQuickSettings) return false;
    const camera = options.sceneRuntime.getCamera();
    if (!camera) return false;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const target = polygonAreaRuntime("room").settingsTarget;
    target?.updateWorldMatrix(true, false);
    const currentHit = target && raycaster.intersectObject(target, false).length > 0;
    const existing = planningBuildingEditVisuals.pick(raycaster);
    if (!currentHit && !existing) return false;
    if (busy) {
      setStatus("Das Gebäude wird gerade gespeichert. Bitte einen Moment warten.", "info");
      return true;
    }
    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const input = options.sceneRuntime.getInputController();
    input?.clear("world-edit-building-settings-open");
    input?.disable("world-edit-building-settings-open");
    const open = (): void => {
      stopPolygonAreaInteraction("room");
      lineBrushQuickSettings?.open();
      syncLineBrushStoreyEditing();
    };
    if (!currentHit && existing) void selectPlanningBuildingPreservingDraft(existing).then(selected => {
      if (selected) open();
      else restoreWorkspaceInput("world-edit-building-selection-deferred");
    });
    else open();
    if (input) void input.exitPointerLock("world-edit-building-settings").finally(() => {
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      camera.updateMatrixWorld(true);
      options.sceneRuntime.renderOnce("world-edit.building-settings-camera-preserved");
    });
    return true;
  }

  function openRoofQuickSettingsUnderCrosshair(): boolean {
    const roof = roofSettingsUnderCrosshair();
    if (roof === undefined || !roofQuickSettings) return false;
    if (busy) {
      setStatus("Das aktuelle Dach wird noch gespeichert. Bitte einen Moment warten.", "warning");
      return true;
    }
    const camera = options.sceneRuntime.getCamera();
    const cameraPosition = camera?.position.clone() ?? null;
    const cameraQuaternion = camera?.quaternion.clone() ?? null;
    const inputController = options.sceneRuntime.getInputController();
    inputController?.clear("world-edit-roof-settings-open");
    inputController?.disable("world-edit-roof-settings-open");
    if (roof) selectExistingRoof(roof);
    stopPolygonAreaInteraction("roof");
    roofQuickSettings.open(roofParameters);
    if (inputController) {
      void inputController.exitPointerLock("world-edit-roof-settings").finally(() => {
        if (camera && cameraPosition && cameraQuaternion) {
          camera.position.copy(cameraPosition);
          camera.quaternion.copy(cameraQuaternion);
          camera.updateMatrixWorld(true);
          options.sceneRuntime.renderOnce("world-edit.roof-settings-camera-preserved");
        }
      });
    }
    setStatus("Dacheinstellungen geöffnet · Dachform, Neigung und Dachüberstand mit dem Mausrad ändern.", "ready");
    return true;
  }

  function openStairQuickSettingsUnderCrosshair(): boolean {
    const runtime = polygonAreaRuntime("stair");
    const camera = options.sceneRuntime.getCamera();
    if (!camera || !runtime.settingsTarget || !runtime.closed || !stairQuickSettings) return false;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    if (!raycaster.intersectObject(runtime.settingsTarget, false)[0]) return false;
    const inputController = options.sceneRuntime.getInputController();
    inputController?.clear("world-edit-stair-settings-open");
    inputController?.disable("world-edit-stair-settings-open");
    stopPolygonAreaInteraction("stair");
    stairQuickSettings.open(stairParameters);
    if (inputController) void inputController.exitPointerLock("world-edit-stair-settings");
    setStatus("Treppeneinstellungen geöffnet · Laufbreite und Auftritte lassen sich mit dem Mausrad ändern.", "ready");
    return true;
  }

  function updatePolygonAreaMarkerColors(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    runtime.pointTargets.forEach((marker, index) => {
      if (marker.material instanceof THREE.MeshBasicMaterial) {
        marker.material.color.setHex(polygonAreaPointColor(tool, index));
      }
    });
    options.sceneRuntime.renderOnce(`world-edit.${tool}-polygon-hover`);
  }

  function refreshPlanningBuildingEditVisuals(): void {
    const scene = options.sceneRuntime.getScene();
    if (scene) planningBuildingEditVisuals.update(scene, activeTool === "room" && isBuildingLineBrush(), editingPlanningBuildAreaInstanceId);
  }

  function hidePlanningBuildingSourceMeshes(): void {
    if (!editingPlanningBuildAreaInstanceId || !polygonAreaRuntime("room").group) return;
    if (activeTool !== "room" && activeTool !== "storey" && !planningBuildingDraftDirty && !planningBuildingSceneRefreshPending) return;
    const generatedIds = new Set(generatedPlanningObjects(editingPlanningBuildAreaMetadata).map(ref => ref.objectInstanceId));
    options.sceneRuntime.getScene()?.traverse((object) => {
      const ref = asRecord(object.userData.semanticObjectRef);
      if (asRecord(ref.metadata).generatedFromAreaId !== editingPlanningBuildAreaInstanceId
        && !generatedIds.has(safeString(ref.objectInstanceId, ""))) return;
      if (!hiddenPlanningBuildingObjects.has(object)) hiddenPlanningBuildingObjects.set(object, object.visible);
      object.visible = false;
    });
  }

  function startPlanningBuildingSceneMonitor(): void {
    if (destroyed || planningBuildingSceneMonitorFrame) return;
    planningBuildingSceneMonitorFrame = requestAnimationFrame(() => {
      planningBuildingSceneMonitorFrame = 0;
      if (destroyed) return;
      hidePlanningBuildingSourceMeshes();
      if (planningBuildingSceneRefreshPending && performance.now() >= planningBuildingSceneReadyCheckAt) {
        planningBuildingSceneReadyCheckAt = performance.now() + 100;
        completePlanningBuildingSceneRefreshIfReady();
      }
      if (planningBuildingSceneRefreshPending
        || (editingPlanningBuildAreaInstanceId && polygonAreaRuntime("room").group)) startPlanningBuildingSceneMonitor();
    });
  }

  function trackPolygonAreaHover(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    if (activeTool !== tool) {
      runtime.hoverFrame = 0;
      return;
    }
    if (tool === "roof" && performance.now() >= roofZoneRefreshAt) {
      roofZoneRefreshAt = performance.now() + 500;
      rebuildRoofZoneScene();
    }
    if (tool === "room" && performance.now() >= planningBuildingVisualRefreshAt) {
      planningBuildingVisualRefreshAt = performance.now() + 500;
      refreshPlanningBuildingEditVisuals();
    }
    const next = polygonAreaPointUnderCrosshair(tool);
    if (next !== runtime.hoveredIndex) {
      runtime.hoveredIndex = next;
      updatePolygonAreaMarkerColors(tool);
    }
    runtime.hoverFrame = requestAnimationFrame(() => trackPolygonAreaHover(tool));
  }

  function startPolygonAreaHover(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    if (runtime.hoverFrame) cancelAnimationFrame(runtime.hoverFrame);
    runtime.hoverFrame = requestAnimationFrame(() => trackPolygonAreaHover(tool));
  }

  function stopPolygonAreaHover(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    if (runtime.hoverFrame) cancelAnimationFrame(runtime.hoverFrame);
    runtime.hoverFrame = 0;
    runtime.hoveredIndex = null;
    updatePolygonAreaMarkerColors(tool);
  }

  function afterPolygonAreaChanged(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    if (tool === "room" && isBuildingLineBrush()) planningBuildingDraftDirty = true;
    if (!runtime.closed) return;
    if (tool === "roof") scheduleRoofPreview();
    else if (tool === "room" && isBuildingLineBrush() && editingPlanningBuildAreaInstanceId) {
      void executePlanningBuildArea();
    } else if (tool === "room" && editingRoomInstanceId) void executeRoom();
  }

  function stopPolygonAreaInteraction(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    const changed = runtime.editingIndex !== null || (tool === "room" && planningBuildAreaMoving);
    runtime.editingIndex = null;
    if (tool === "room") {
      planningBuildAreaMoving = false;
      planningBuildAreaMoveOrigin = null;
      planningBuildAreaMovePoints = [];
    }
    if (runtime.interactionFrame) cancelAnimationFrame(runtime.interactionFrame);
    runtime.interactionFrame = 0;
    rebuildPolygonAreaScene(tool);
    if (changed) afterPolygonAreaChanged(tool);
  }

  function trackPolygonAreaInteraction(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    if (tool === "room" && planningBuildAreaMoving) {
      const target = currentPolygonAreaTarget("room", planningBuildAreaMoveOrigin);
      if (target && planningBuildAreaMoveOrigin && planningBuildAreaMovePoints.length === runtime.points.length) {
        const deltaX = target.x - planningBuildAreaMoveOrigin.x;
        const deltaZ = target.z - planningBuildAreaMoveOrigin.z;
        runtime.points = planningBuildAreaMovePoints.map((point) => ({
          x: point.x + deltaX,
          y: point.y,
          z: point.z + deltaZ,
        }));
        rebuildPolygonAreaScene("room");
        refreshHud();
      }
      runtime.interactionFrame = requestAnimationFrame(() => trackPolygonAreaInteraction(tool));
      return;
    }
    if (runtime.editingIndex === null) return;
    const previous = runtime.points[runtime.editingIndex];
    const target = currentPolygonAreaTarget(tool, previous);
    if (previous && target && (previous.x !== target.x || previous.z !== target.z)) {
      runtime.points[runtime.editingIndex] = target;
      if (tool === "roof") invalidateRoofCalculation();
      else {
        runtime.calculation = null;
        runtime.request = null;
      }
      rebuildPolygonAreaScene(tool);
      refreshHud();
    }
    runtime.interactionFrame = requestAnimationFrame(() => trackPolygonAreaInteraction(tool));
  }

  function finishPolygonArea(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    stopPolygonAreaInteraction(tool);
    if (tool === "room" && isBuildingLineBrush()) {
      const draft = currentPlanningBuildAreaDraft();
      if (!draft) {
        runtime.closed = false;
        rebuildPolygonAreaScene(tool);
        setStatus("Der Gebäude-Linien-Brush benötigt mindestens zwei verschiedene Stützpunkte.", "warning");
        return;
      }
      runtime.points = draft.points.map((point) => ({ ...point }));
      runtime.closed = true;
      rebuildPolygonAreaScene(tool);
      refreshHud();
      setStatus(`Baufläche aus ${draft.segments.length} geraden Segmenten wird gespeichert …`, "busy");
      void executePlanningBuildArea();
      return;
    }
    runtime.points = [...normalizePolygonAreaPoints(runtime.points)];
    if (!validPolygonArea(runtime.points)) {
      runtime.closed = false;
      rebuildPolygonAreaScene(tool);
      setStatus("Die Fläche benötigt mindestens drei verschiedene Punkte, eine Fläche größer null und darf sich nicht selbst schneiden.", "warning");
      return;
    }
    runtime.closed = true;
    rebuildPolygonAreaScene(tool);
    refreshHud();
    if (tool === "roof") {
      setStatus(`Dachfläche mit ${runtime.points.length} Punkten geschlossen. CAD-Dach wird neu berechnet …`, "busy");
      void calculateRoofPreview();
    } else if (tool === "stair") {
      setStatus(`Treppenfläche mit ${runtime.points.length} Punkten geschlossen. Zahnrad wählen und Laufparameter einstellen.`, "ready");
    } else {
      setStatus(`Raumfläche mit ${runtime.points.length} Punkten geschlossen und wird gespeichert …`, "busy");
      void executeRoom();
    }
  }

  function beginPolygonAreaInteraction(tool: PolygonAreaTool, target: ChunkApiWorldPosition): void {
    const runtime = polygonAreaRuntime(tool);
    if (tool === "roof" && runtime.closed && roofParameters.roofType === "imported") {
      setStatus("LoD2-Original: Neigung im Zahnrad ändern. Für neue Eckpunkte zuerst eine parametrische Dachform wählen.", "warning");
      return;
    }
    if (runtime.editingIndex !== null) return;
    if (tool === "room" && isBuildingLineBrush() && runtime.closed && planningBuildAreaMoveHandleUnderCrosshair()) {
      planningBuildAreaMoving = true;
      planningBuildAreaMoveOrigin = snappedPolygonAreaPoint("room", target);
      planningBuildAreaMovePoints = runtime.points.map((point) => ({ ...point }));
      rebuildPolygonAreaScene("room");
      runtime.interactionFrame = requestAnimationFrame(() => trackPolygonAreaInteraction("room"));
      setStatus("Die gesamte Gebäude-Baufläche wird verschoben. Linksklick loslassen fixiert die neue Lage.", "ready");
      return;
    }
    const existingIndex = polygonAreaPointUnderCrosshair(tool);
    const minimumClosingPoints = tool === "room" && isBuildingLineBrush() ? 2 : 3;
    if (existingIndex === 0 && !runtime.closed && runtime.points.length >= minimumClosingPoints) {
      finishPolygonArea(tool);
      return;
    }
    if (existingIndex !== null) {
      runtime.editingIndex = existingIndex;
      rebuildPolygonAreaScene(tool);
      runtime.interactionFrame = requestAnimationFrame(() => trackPolygonAreaInteraction(tool));
      setStatus(`Eckpunkt ${existingIndex + 1} wird verschoben. Linksklick loslassen fixiert ihn.`, "ready");
      return;
    }
    if (runtime.closed) {
      setStatus(tool === "room" && isBuildingLineBrush()
        ? "Die Baufläche ist abgeschlossen. Stützpunkte oder die Raute zum Verschieben der ganzen Fläche wählen."
        : "Die Fläche ist geschlossen. Vorhandene gelbe Eckpunkte können verschoben oder mit Rechtsklick gelöscht werden.", "warning");
      return;
    }
    const point = snappedPolygonAreaPoint(tool, target);
    const previous = runtime.points.at(-1);
    if (previous && previous.x === point.x && previous.z === point.z) {
      setStatus("Der nächste Eckpunkt muss vom vorherigen Punkt abweichen.", "warning");
      return;
    }
    if (runtime.points.length >= 128) {
      setStatus("Eine Polygonfläche kann höchstens 128 Eckpunkte enthalten.", "warning");
      return;
    }
    runtime.points.push(point);
    runtime.calculation = null;
    runtime.request = null;
    rebuildPolygonAreaScene(tool);
    refreshHud();
    setStatus(tool === "room" && isBuildingLineBrush()
      ? `${runtime.points.length}. Linienpunkt gesetzt. Weitere gerade Segmente anklicken; ESC/Enter erzeugt die Gebäude-Baufläche.`
      : `${runtime.points.length}. Eckpunkt gesetzt. Weitere Punkte anklicken; erster Punkt oder ESC schließt die Fläche.`, "ready");
  }

  function removePolygonAreaPointUnderCrosshair(tool: PolygonAreaTool): boolean {
    if (tool === "roof" && roofParameters.roofType === "imported") return false;
    const runtime = polygonAreaRuntime(tool);
    const index = polygonAreaPointUnderCrosshair(tool);
    if (index === null) return false;
    if (tool === "room" && isBuildingLineBrush() && runtime.closed && runtime.points.length <= 2) {
      setStatus("Ein Gebäude-Linienzug benötigt mindestens zwei Stützpunkte.", "warning");
      return true;
    }
    stopPolygonAreaInteraction(tool);
    runtime.points.splice(index, 1);
    runtime.hoveredIndex = null;
    runtime.closed = runtime.closed && (tool === "room" && isBuildingLineBrush()
      ? Boolean(createPathBrushDraft(runtime.points, { kind: "building", width: planningBuildAreaWidth }))
      : validPolygonArea(runtime.points));
    if (tool === "roof") invalidateRoofCalculation();
    else {
      runtime.calculation = null;
      runtime.request = null;
    }
    rebuildPolygonAreaScene(tool);
    refreshHud();
    setStatus(`Eckpunkt ${index + 1} gelöscht. ${runtime.points.length} Punkte verbleiben.`, "ready");
    afterPolygonAreaChanged(tool);
    return true;
  }

  function resetPolygonArea(tool: PolygonAreaTool): void {
    const runtime = polygonAreaRuntime(tool);
    stopPolygonAreaInteraction(tool);
    runtime.points = [];
    runtime.closed = false;
    runtime.calculation = null;
    runtime.request = null;
    runtime.hoveredIndex = null;
    if (tool === "room") {
      editingRoomInstanceId = null;
      editingRoomAnchor = null;
      editingPlanningBuildAreaInstanceId = null;
      editingPlanningBuildAreaAnchor = null;
      planningBuildAreaMoving = false;
      planningBuildAreaMoveOrigin = null;
      planningBuildAreaMovePoints = [];
      roomAreaWorkspaceProfile = null;
      planningBuildingDraftDirty = false;
      planningBuildingSceneRefreshPending = null;
    } else if (tool === "roof") {
      restoreEditingRoofObjects();
      roofParameters = { ...roofParameters, continuationEdgesMm: [], continuationEdgeIndices: undefined };
      editingRoofInstanceId = null;
      editingRoofAnchor = null;
      editingRoofMetadata = {};
      editingRoofHoleRings = [];
      roofSolarSettings = normalizeSolarSettings(null);
      solarPanel?.close(false);
      invalidateRoofCalculation();
      roofQuickSettings?.close(false);
      if (roofParameters.importedSource) roofParameters = { ...DEFAULT_ROOF_TOOL_PARAMETERS };
    } else {
      stairQuickSettings?.close();
    }
    disposePolygonAreaGroup(tool);
    if (tool === "roof") rebuildRoofZoneScene(true);
    refreshHud();
  }

  function scheduleRoofPreview(delayMilliseconds = 120): void {
    if (roofPreviewTimer) window.clearTimeout(roofPreviewTimer);
    roofPreviewTimer = window.setTimeout(() => {
      roofPreviewTimer = 0;
      void calculateRoofPreview();
    }, Math.max(0, delayMilliseconds));
  }

  function invalidateRoofCalculation(retainLastSuccessfulPreview = false): void {
    roofCalculationSequence += 1;
    roofCalculationAbortController?.abort();
    roofCalculationAbortController = null;
    if (roofPreviewTimer) window.clearTimeout(roofPreviewTimer);
    roofPreviewTimer = 0;
    const runtime = polygonAreaRuntime("roof");
    const preview = roofPreviewStateAfterInvalidation(runtime, retainLastSuccessfulPreview);
    runtime.calculation = preview.calculation;
    runtime.request = preview.request;
  }

  async function calculateRoofPreview(
    requestedCalculation?: RoofCalculationRequest,
  ): Promise<RoofCalculationResult | null> {
    if (roofPreviewTimer) window.clearTimeout(roofPreviewTimer);
    roofPreviewTimer = 0;
    const runtime = polygonAreaRuntime("roof");
    if (!runtime.closed || !validPolygonArea(runtime.points)) return null;
    roofCalculationAbortController?.abort();
    const abortController = new AbortController();
    roofCalculationAbortController = abortController;
    const sequence = ++roofCalculationSequence;
    const request = requestedCalculation ?? buildRoofCalculationRequest(runtime.points, roofParameters);
    const requestKey = roofCalculationRequestKey(request);
    try {
      if (editingRoofHoleRings.length > 0
        && roofParameters.roofType !== "flat"
        && roofParameters.roofType !== "imported") {
        throw new Error("Dieses Dach enthält einen Innenhof. Der Innenhof bleibt im Flachdach erhalten; für geneigte Dächer werden getrennte Dachzonen benötigt.");
      }
      const calculation = roofParameters.roofType === "flat" && editingRoofHoleRings.length > 0
        ? createFlatRoofCalculation(
            runtime.points,
            roofParameters.eavesHeightMm,
            editingRoofHoleRings,
            roofParameters.roofSkinThicknessMm,
          )
        : await requestRoofCalculation(request, abortController.signal);
      if (sequence !== roofCalculationSequence) return null;
      const currentRequest = buildRoofCalculationRequest(runtime.points, roofParameters);
      if (requestKey !== roofCalculationRequestKey(currentRequest)) return null;
      runtime.calculation = calculation;
      runtime.request = request;
      rebuildPolygonAreaScene("roof");
      refreshHud();
      const summary = asRecord(calculation.summary);
      setStatus(`3D-Dach bereit: ${Number(summary.face_count ?? 0)} Dachflächen, ${Number(summary.rafter_count ?? 0)} Sparren, ${Number(summary.purlin_count ?? 0)} Pfetten.`, "ready");
      return calculation;
    } catch (error) {
      if (sequence !== roofCalculationSequence) return null;
      if (error instanceof DOMException && error.name === "AbortError") return null;
      rebuildPolygonAreaScene("roof");
      options.logger?.warn?.("CAD roof calculation failed.", { error: normalizeUnknownError(error) });
      setStatus(`Dachberechnung fehlgeschlagen: ${commandErrorMessage(error)}`, "error");
      return null;
    } finally {
      if (roofCalculationAbortController === abortController) roofCalculationAbortController = null;
    }
  }

  async function executeRoof(): Promise<void> {
    if (busy) return;
    const runtime = polygonAreaRuntime("roof");
    if (!runtime.closed || !validPolygonArea(runtime.points)) {
      setStatus("Bitte zuerst eine gültige Dachfläche schließen.", "warning");
      return;
    }
    busy = true;
    if (executeButton) executeButton.disabled = true;
    setStatus(editingRoofInstanceId ? "Dach wird aktualisiert …" : "Dach wird im gemeinsamen 3D-Modell gespeichert …", "busy");
    let optimisticRoofId: string | null = null;
    let optimisticCalculation: RoofCalculationResult | null = null;
    try {
      const expectedRequest = buildRoofCalculationRequest(runtime.points, roofParameters);
      const requestIsCurrent = runtime.request
        && roofCalculationRequestKey(runtime.request) === roofCalculationRequestKey(expectedRequest);
      if (!requestIsCurrent) {
        invalidateRoofCalculation();
      }
      const calculation = runtime.calculation ?? await calculateRoofPreview(expectedRequest);
      const request = runtime.request;
      if (!calculation || !request
        || roofCalculationRequestKey(request) !== roofCalculationRequestKey(expectedRequest)) return;
      const bounds = polygonAreaBounds(runtime.points);
      if (!bounds) return;
      const eavesY = roofParameters.eavesHeightMm / 1000;
      const summary = asRecord(calculation.summary);
      const maximumHeight = Number(summary.maximum_height_mm ?? roofParameters.eavesHeightMm) / 1000;
      const anchor = editingRoofAnchor ?? {
        x: Math.floor(bounds.minimum.x),
        y: Math.floor(eavesY),
        z: Math.floor(bounds.minimum.z),
      };
      const roofId = editingRoofInstanceId
        ?? `roof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const targetCells = options.sceneRuntime.getTargetCells();
      const blockTypeId = targetCells.sourceCell?.blockTypeId || "system_terrain";
      const payload: ChunkApiPlaceObjectCommandPayload = {
        type: "PlaceObject",
        userId: "editor_user",
        sessionId: `world_edit_roof_${Date.now()}`,
        position: anchor,
        blockTypeId,
        objectTypeId: "building_roof",
        objectKind: "semantic_footprint",
        objectInstanceId: roofId,
        dimensions: {
          x: Math.max(1, Math.min(256, Math.ceil(bounds.size.x))),
          y: Math.max(1, Math.min(256, Math.ceil(Math.max(1, maximumHeight - eavesY)))),
          z: Math.max(1, Math.min(256, Math.ceil(bounds.size.z))),
        },
        footprint: {
          type: "Polygon",
          coordinateSpace: "world-cell-xz",
          coordinates: roofParameters.roofType === "imported" && roofParameters.importedSource
            ? roofParameters.importedSource.footprint
            : polygonAreaClosedRingCoordinates(runtime.points, editingRoofHoleRings),
          baseY: eavesY,
          height: Math.max(0.1, maximumHeight - eavesY),
          schemaVersion: "vectoplan-building-roof-footprint.v1",
        },
        occupiedCells: [anchor],
        metadata: {
          ...editingRoofMetadata,
          schemaVersion: "vectoplan-building-roof.v1",
          ...(roofParameters.importedSource ? { voxelOccupancy: "none", lod2BuildingId: roofParameters.importedSource.buildingId } : {}),
          source: "vectoplan-editor.world-edit.roof",
          familyRef: "world-edit.roof",
          variantRef: roofParameters.roofType,
          roofType: roofParameters.roofType,
          roofParameters: { ...roofParameters },
          roofRequest: request,
          roofCalculation: calculation,
          solar: roofSolarSettings,
          mergeKey: roofId,
          libraryPlacementContext: {
            libraryItemId: "world-edit-roof",
            familyId: "world-edit.roof",
            packageId: "world-edit.roof",
            variantId: roofParameters.roofType,
            objectKind: "semantic_footprint",
            libraryRef: {
              libraryItemId: "world-edit-roof",
              familyId: "world-edit.roof",
              packageId: "world-edit.roof",
              variantId: roofParameters.roofType,
              objectKind: "semantic_footprint",
            },
            placementCommand: {
              kind: "PlaceObject",
              runtimeBlockTypeId: blockTypeId,
              blockTypeId,
            },
            semanticProfile: {
              role: "roof",
              variables: {
                "semantic.role": "roof",
                "dimensions.width_mm": bounds.size.x * 1000,
                "dimensions.height_mm": Math.max(100, maximumHeight * 1000 - roofParameters.eavesHeightMm),
                "dimensions.depth_mm": bounds.size.z * 1000,
                "roof.type": roofParameters.roofType,
                "roof.request": request,
                "roof.calculation": calculation,
              },
            },
          },
        },
      };
      registerOptimisticRoofCalculation(roofId, calculation);
      optimisticRoofId = roofId;
      optimisticCalculation = calculation;
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: editingRoofInstanceId ? "world-edit:roof:update" : "world-edit:roof:create",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        clearOptimisticRoofCalculation(roofId, calculation);
        optimisticRoofId = null;
        optimisticCalculation = null;
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      pendingRoofQuickSettings.set(roofId, {
        parameters: {
          roofType: roofParameters.roofType,
          pitchDeg: Math.round(roofParameters.pitchDeg),
          overhangMm: roofParameters.overhangMm,
          overhangNorthMm: roofParameters.overhangNorthMm,
          overhangEastMm: roofParameters.overhangEastMm,
          overhangSouthMm: roofParameters.overhangSouthMm,
          overhangWestMm: roofParameters.overhangWestMm,
          edgeOverhangsMm: [...roofParameters.edgeOverhangsMm],
        },
        calculationVersion: roofCalculationVersionSnapshot(calculation),
      });
      await options.sceneRuntime.reloadDirtyChunks("world-edit-roof");
      const persistedVersionVisible = await waitForPersistedRoofCalculation(roofId, calculation);
      if (persistedVersionVisible) {
        // The matching chunk now owns the visualization. Obsolete meshes that
        // were hidden during editing must never be made visible again.
        hiddenEditingRoofObjects = [];
        if (activeTool === "roof") resetPolygonArea("roof");
        setStatus(`Dach ${roofId} mit Dachhaut, Sparren und Pfetten gespeichert. Das Werkzeug ist bereit für die nächste Dachzone.`, "ready");
      } else {
        // Keep the exact successful preview visible. Removing it here would
        // expose a stale chunk for a few frames while realtime catches up.
        setStatus(`Dach ${roofId} ist gespeichert; die neue Darstellung wird noch synchronisiert.`, "busy");
      }
    } catch (error) {
      if (optimisticRoofId && optimisticCalculation) {
        clearOptimisticRoofCalculation(optimisticRoofId, optimisticCalculation);
      }
      options.logger?.warn?.("Roof placement failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  function serializedParcelGridState(): PersistedParcelGridState {
    return {
      schemaVersion: "vectoplan-parcel-grid-state.v1",
      mode: parcelGridMode,
      setbackMeters: parcelGridSetback,
      influenceMeters: parcelGridInfluence,
      activeParcelId: activeParcelGridParcelId,
      activeGuideKey: activeParcelGridGuideKey,
      guides: [...persistedParcelGridGuides.values()]
        .sort((first, second) => (
          parcelGridGuideKey(first.parcelId, first.startLonLat, first.endLonLat)
            .localeCompare(parcelGridGuideKey(second.parcelId, second.startLonLat, second.endLonLat))
        ))
        .slice(0, 256),
    };
  }

  function applyPersistedParcelGridState(state: PersistedParcelGridState | null): void {
    if (!state) return;
    parcelGridMode = state.mode;
    parcelGridSetback = state.setbackMeters;
    parcelGridInfluence = state.influenceMeters;
    activeParcelGridParcelId = state.activeParcelId;
    activeParcelGridGuideKey = state.activeGuideKey ?? null;
    persistedParcelGridGuides.clear();
    for (const guide of state.guides) {
      persistedParcelGridGuides.set(
        parcelGridGuideKey(guide.parcelId, guide.startLonLat, guide.endLonLat),
        guide,
      );
    }
  }

  function rememberParcelGridGuide(frameValue?: EarthGridFrameContract | null): void {
    if (!parcelGridGuide) return;
    const frame = frameValue ?? earthGrid ?? fallbackEarthGrid(parcelSelection.projectCoordinate);
    const startLonLat = worldPointToLonLat(parcelGridGuide.start[0], parcelGridGuide.start[1], frame);
    const endLonLat = worldPointToLonLat(parcelGridGuide.end[0], parcelGridGuide.end[1], frame);
    if (!startLonLat || !endLonLat) return;
    activeParcelGridParcelId = parcelGridGuide.parcelId;
    const guideKey = parcelGridGuideKey(parcelGridGuide.parcelId, startLonLat, endLonLat);
    activeParcelGridGuideKey = guideKey;
    persistedParcelGridGuides.set(guideKey, {
      parcelId: parcelGridGuide.parcelId,
      startLonLat,
      endLonLat,
      depthMeters: parcelGridGuide.depthMeters,
    });
  }

  function restoreParcelGridGuide(frame: EarthGridFrameContract): void {
    if (parcelGridGuide || parcelSelection.parcels.length === 0 || persistedParcelGridGuides.size === 0) return;
    const orderedSavedGuides = [...persistedParcelGridGuides.entries()].sort(([firstKey, first], [secondKey, second]) => {
      const firstRank = firstKey === activeParcelGridGuideKey
        ? 0
        : first.parcelId === activeParcelGridParcelId ? 1 : 2;
      const secondRank = secondKey === activeParcelGridGuideKey
        ? 0
        : second.parcelId === activeParcelGridParcelId ? 1 : 2;
      return firstRank - secondRank || firstKey.localeCompare(secondKey);
    });
    for (const [savedGuideKey, saved] of orderedSavedGuides) {
      const parcelId = saved.parcelId;
      const parcel = parcelSelection.parcels.find((candidate) => candidate.parcelId === parcelId);
      if (!parcel || !saved) continue;
      const desiredStart = lonLatToWorld(saved.startLonLat[0], saved.startLonLat[1], frame);
      const desiredEnd = lonLatToWorld(saved.endLonLat[0], saved.endLonLat[1], frame);
      if (!desiredStart || !desiredEnd) continue;
      let best: Readonly<{ start: [number, number]; end: [number, number]; score: number }> | null = null;
      for (const polygonValue of parcelPolygons(parcel)) {
        for (const ringValue of asArray(polygonValue)) {
          const ring = asArray(ringValue)
            .map((coordinate) => {
              const point = asArray(coordinate);
              return lonLatToWorld(Number(point[0]), Number(point[1]), frame);
            })
            .filter((point): point is [number, number] => point !== null);
          for (let index = 1; index < ring.length; index += 1) {
            const start = ring[index - 1]!;
            const end = ring[index]!;
            const direct = Math.hypot(start[0] - desiredStart[0], start[1] - desiredStart[1])
              + Math.hypot(end[0] - desiredEnd[0], end[1] - desiredEnd[1]);
            const reversed = Math.hypot(start[0] - desiredEnd[0], start[1] - desiredEnd[1])
              + Math.hypot(end[0] - desiredStart[0], end[1] - desiredStart[1]);
            const score = Math.min(direct, reversed);
            if (!best || score < best.score) best = { start, end, score };
          }
        }
      }
      if (!best || best.score > 0.75) continue;
      const dx = best.end[0] - best.start[0];
      const dz = best.end[1] - best.start[1];
      const length = Math.hypot(dx, dz);
      if (length <= 1e-8) continue;
      let inward: [number, number] = [-dz / length, dx / length];
      const midpoint: [number, number] = [
        (best.start[0] + best.end[0]) * 0.5,
        (best.start[1] + best.end[1]) * 0.5,
      ];
      const probe = worldPointToLonLat(midpoint[0] + inward[0] * 0.2, midpoint[1] + inward[1] * 0.2, frame);
      if (!probe || !parcelContainsLonLat(parcel, probe)) inward = [-inward[0], -inward[1]];
      const maximumDepth = resolveParcelGridMaximumDepth({
        points: parcelWorldGridPoints(parcel, frame),
        start: best.start,
        inward,
        minimumDepth: PARCEL_GRID_MIN_DRAG_DEPTH_CELLS,
        maximumDepth: PARCEL_GRID_MAX_DRAG_DEPTH_CELLS,
        paddingCells: PARCEL_GRID_DRAG_DEPTH_PADDING_CELLS,
      });
      parcelGridGuide = {
        guideKey: savedGuideKey,
        parcelId,
        start: best.start,
        end: best.end,
        inward,
        depthMeters: Math.max(0, Math.min(maximumDepth, saved.depthMeters)),
      };
      activeParcelGridParcelId = parcelId;
      activeParcelGridGuideKey = savedGuideKey;
      return;
    }
  }

  const panel = document.createElement("section");
  panel.className = "editor-world-edit";
  panel.dataset.editorWorldEdit = "true";
  panel.dataset.editorUiInteractive = "true";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="editor-world-edit__header">
      <div><span>WorldEdit</span><strong data-world-edit-title>Auswahlwerkzeug</strong></div>
      <button type="button" data-world-edit-close aria-label="WorldEdit schließen">×</button>
    </header>
    <div class="editor-world-edit__body">
      <div class="editor-world-edit__status" data-world-edit-status>Werkzeug auswählen</div>
      <label class="editor-world-edit__field" data-selection-operation>
        <span>Operation</span>
        <select data-world-edit-operation>
          <option value="set">Setzen</option><option value="wall">Wände</option>
          <option value="fill">Nur Luft füllen</option><option value="replace">Ersetzen</option>
          <option value="clear">Leeren</option>
        </select>
      </label>
      <div class="editor-world-edit__coordinates" data-selection-coordinates>
        <span>Punkt A <output data-selection-first>–</output></span>
        <span>Punkt B <output data-selection-second>–</output></span>
      </div>
      <div class="editor-world-edit__coordinates" data-ruler-result hidden>
        <span>Distanz <output data-ruler-distance>–</output></span>
        <span>Einheit <output>Meter</output></span>
      </div>
      <div class="editor-world-edit__brush" data-brush-settings hidden>
        <label><span>Form</span><select data-brush-shape><option value="sphere">Kugel</option><option value="box">Quader</option><option value="cylinder">Zylinder</option></select></label>
        <label><span>Radius</span><input data-brush-radius type="range" min="1" max="12" value="2"><output data-brush-radius-output>2</output></label>
        <label><span>Dichte</span><input data-brush-density type="range" min="10" max="100" value="100"><output data-brush-density-output>100%</output></label>
        <label><span>Wandstärke</span><input data-brush-wall type="range" min="0" max="6" value="0"><output data-brush-wall-output>0</output></label>
      </div>
      <div class="editor-world-edit__material"><span>Material</span><strong data-world-edit-material>Hotbar auswählen</strong></div>
      <label class="editor-world-edit__mask"><input type="checkbox" data-parcel-mask checked><span>Auf ausgewählte Grundstücke begrenzen</span></label>
      <div class="editor-world-edit__parcels"><span data-parcel-count>0 Grundstücke</span><small>Vollzellen-Regel · gemeinsame Maske</small></div>
      <div class="editor-world-edit__parcels" data-clipboard-status hidden><span data-clipboard-count>0 Zellen</span><small>Projektlokale Zwischenablage</small></div>
      <div class="editor-world-edit__hint" data-world-edit-hint></div>
      <div class="editor-world-edit__actions">
        <button type="button" data-world-edit-reset>Auswahl löschen</button>
        <button type="button" class="is-primary" data-world-edit-execute>Ausführen</button>
      </div>
    </div>
  `;
  options.root.append(panel);
  lineBrushQuickSettings = createLineBrushQuickSettings({
    root: options.root,
    onChange: (snapshot) => {
      planningBuildingDraftDirty = true;
      const programChanged = planningBuildingProgramSelection.typeId !== snapshot.typeId;
      planningBuildingProgramSelection = snapshot.selection;
      planningBuildingStoreyProfile = {
        ...(programChanged
          ? { segmentAdjustments: {} }
          : planningBuildingStoreyProfile),
        baseCount: snapshot.storeyCount,
      };
      if (programChanged) selectedStoreyScope = "all";
      planningBuildingGenerationRequest = null;
      syncLineBrushStoreyEditing();
      if (activeTool === "room" && isBuildingLineBrush()) rebuildPolygonAreaScene("room");
    },
    onTemplateSelect: (snapshot) => {
      planningBuildingProgramSelection = snapshot.selection;
    },
    onGenerate: async (request) => {
      planningBuildingGenerationRequest = request;
      planningBuildingProgramSelection = request.templateSelection;
      planningBuildingStoreyProfile = {
        ...planningBuildingStoreyProfile,
        baseCount: request.storeyCount,
      };
      await executePlanningBuildArea(request);
    },
    onStoreyAdjust: (delta, scope) => {
      selectedStoreyScope = scope;
      return adjustPlanningBuildingStoreys(delta, scope, { allowDraft: true });
    },
    onStoreyScopeChange: (scope) => {
      selectedStoreyScope = scope;
      syncLineBrushStoreyEditing();
      if (activeTool === "room" && isBuildingLineBrush()) rebuildPolygonAreaScene("room");
    },
    onError: (error, stage) => {
      options.logger?.warn?.("Line-brush quick settings failed.", {
        stage,
        error: normalizeUnknownError(error),
      });
      setStatus(
        stage === "catalog"
          ? "Gebäudebibliothek konnte nicht vollständig geladen werden; Standard bleibt verfügbar."
          : commandErrorMessage(error),
        stage === "catalog" ? "warning" : "error",
      );
    },
    onClose: (restoreInput) => {
      restoreWorkspaceInput(
        "world-edit-line-brush-settings-close",
        restoreInput && activeTool === "room",
      );
    },
  });
  storeyQuickSettings = createStoreyQuickSettings({
    root: options.root,
    onAdd: (scope) => {
      selectedStoreyScope = scope;
      void adjustPlanningBuildingStoreys(1, scope);
    },
    onRemove: (scope) => {
      selectedStoreyScope = scope;
      void adjustPlanningBuildingStoreys(-1, scope);
    },
    onScopeChange: (scope) => {
      selectedStoreyScope = scope;
      syncStoreyQuickSettings();
    },
    onClose: (restoreInput) => {
      restoreWorkspaceInput(
        "world-edit-storey-settings-close",
        restoreInput && activeTool === "storey",
      );
    },
  });
  storeyDragHandle = createStoreyDragHandle({
    root: options.root,
    snapshot: () => {
      const draft = currentPlanningBuildAreaDraft();
      const camera = options.sceneRuntime.getCamera();
      if (!draft || !camera || activeTool !== "storey") return null;
      const bounds = polygonAreaBounds(polygonAreaPointsFromFootprint(
        planningFootprintForScope(draft, selectedStoreyScope), draft.points[0]!.y,
      )) ?? draft.bounds;
      const count = planningStoreyCountForScope(selectedStoreyScope);
      const height = count * STANDARD_STOREY_HEIGHT_METERS;
      const baseY = editingPlanningBuildAreaAnchor?.y ?? Math.floor(draft.points[0]!.y + 1);
      const top = new THREE.Vector3((bounds.minimum.x + bounds.maximum.x) / 2,
        baseY + height, (bounds.minimum.z + bounds.maximum.z) / 2);
      const below = top.clone().add(new THREE.Vector3(0, -STANDARD_STOREY_HEIGHT_METERS, 0));
      top.project(camera);
      below.project(camera);
      if (top.z < -1 || top.z > 1) return null;
      const canvas = options.root.querySelector("canvas");
      const viewport = canvas?.getBoundingClientRect() ?? options.root.getBoundingClientRect();
      const rootRect = options.root.getBoundingClientRect();
      return {
        count, height, busy,
        x: viewport.left - rootRect.left + (top.x + 1) * viewport.width / 2,
        y: viewport.top - rootRect.top + (1 - top.y) * viewport.height / 2,
        pixelsPerStorey: Math.max(12, Math.abs(top.y - below.y) * viewport.height / 2),
      };
    },
    begin: () => {
      storeyDragPreviousDirty = planningBuildingDraftDirty;
      storeyDragPreviousProfile = {
        baseCount: planningBuildingStoreyProfile.baseCount,
        segmentAdjustments: { ...planningBuildingStoreyProfile.segmentAdjustments },
      };
    },
    preview: (count) => {
      if (!storeyDragPreviousProfile || busy) return;
      planningBuildingDraftDirty = true;
      if (selectedStoreyScope === "all") {
        planningBuildingStoreyProfile = { ...storeyDragPreviousProfile, baseCount: count };
      } else {
        const key = String(planningScopeSegmentIndex(selectedStoreyScope));
        planningBuildingStoreyProfile = { ...storeyDragPreviousProfile,
          segmentAdjustments: { ...storeyDragPreviousProfile.segmentAdjustments,
            [key]: count - storeyDragPreviousProfile.baseCount } };
      }
      lineBrushQuickSettings?.sync({ storeyCount: planningBuildingStoreyProfile.baseCount });
      syncLineBrushStoreyEditing();
      syncStoreyQuickSettings();
      rebuildPolygonAreaScene("room");
    },
    commit: async () => {
      const previous = storeyDragPreviousProfile;
      const previousDirty = storeyDragPreviousDirty;
      storeyDragPreviousProfile = null;
      if (!previous) return;
      polygonAreaRuntime("room").closed = true;
      if (!await executePlanningBuildArea()) {
        planningBuildingStoreyProfile = previous;
        planningBuildingDraftDirty = previousDirty;
        lineBrushQuickSettings?.sync({ storeyCount: previous.baseCount });
        syncLineBrushStoreyEditing();
        syncStoreyQuickSettings();
        rebuildPolygonAreaScene("room");
      }
    },
    cancel: () => {
      if (!storeyDragPreviousProfile) return;
      planningBuildingStoreyProfile = storeyDragPreviousProfile;
      planningBuildingDraftDirty = storeyDragPreviousDirty;
      storeyDragPreviousProfile = null;
      lineBrushQuickSettings?.sync({ storeyCount: planningBuildingStoreyProfile.baseCount });
      syncLineBrushStoreyEditing();
      syncStoreyQuickSettings();
      rebuildPolygonAreaScene("room");
    },
  });
  const applyRoofQuickSettings = (
    { roofType, pitchDeg, overhangMm }: RoofQuickParameters,
    explicitImportedRestore = false,
  ): void => {
    // The quick setting is uniform.  Reset individual edge overrides so the
    // visible 5-cm change affects every side of the generated roof.
    const overhangChanged = roofParameters.overhangMm !== overhangMm;
    const roofTypeChanged = roofParameters.roofType !== roofType;
    const nextParameters: RoofToolParameters = {
      ...roofParameters,
      roofType,
      pitchDeg,
      overhangMm,
      ...(overhangChanged ? {
        overhangNorthMm: overhangMm,
        overhangEastMm: overhangMm,
        overhangSouthMm: overhangMm,
        overhangWestMm: overhangMm,
        edgeOverhangsMm: [],
      } : {}),
    };
    const runtime = polygonAreaRuntime("roof");
    // Treat every explicit LoD2-Original action as a restore command.  This
    // also repairs older persisted states that already claim `imported` but
    // still carry pitch/overhang values from a parametric edit; the user can
    // therefore click the already-selected tile to recover the survey roof.
    const restoreImportedSource = explicitImportedRestore
      && roofType === "imported"
      && Boolean(nextParameters.importedSource);
    roofParameters = restoreImportedSource
      ? restoreImportedRoofOriginal(nextParameters)
      : nextParameters;
    if (restoreImportedSource && roofParameters.importedSource) {
      const sourceRings = polygonAreaRingsFromFootprint({
        type: "Polygon",
        coordinateSpace: "world-cell-xz",
        coordinates: roofParameters.importedSource.footprint,
        baseY: roofParameters.importedSource.baseY,
      }, roofParameters.importedSource.baseY);
      if (validPolygonArea(sourceRings[0] ?? [])) {
        runtime.points = [...sourceRings[0]!];
        editingRoofHoleRings = sourceRings.slice(1).map((ring) => [...ring]);
      }
      // The controls emitted the previous variant's pitch/overhang together
      // with the type click; immediately show the actual restored values.
      roofQuickSettings?.sync(roofParameters);
    }
    if (runtime.closed && validPolygonArea(runtime.points)) {
      // Never display the previous parametric roof after switching back to
      // the LoD2 source. Same-type tweaks may retain their last preview
      // while the replacement calculation is running.
      invalidateRoofCalculation(!(roofTypeChanged || restoreImportedSource));
      scheduleRoofPreview();
    }
    refreshHud();
  };
  roofQuickSettings = createRoofQuickSettings({
    root: options.root,
    onSolar: () => {
      const marker = roofSurfaceMarker(roofSurfaceTriangles(polygonAreaRuntime("roof").calculation));
      const point = marker && worldPointToLonLat(marker.x, marker.z, earthGrid);
      const metricScale = earthGrid && point && solarMetricScale(earthGrid, point[1]);
      if (metricScale && roofSolarSettings.selectedFaces.length === 0) roofSolarSettings = { ...roofSolarSettings, metricScale };
      roofQuickSettings?.close(false);
      const input = options.sceneRuntime.getInputController();
      input?.clear("world-edit-solar-open");
      input?.disable("world-edit-solar-open");
      void input?.exitPointerLock("world-edit-solar-open");
      void solarPanel?.open(roofSolarSettings);
    },
    onChange: (parameters) => applyRoofQuickSettings(parameters),
    onRestoreImported: (parameters) => applyRoofQuickSettings(parameters, true),
    onClose: (restorePointerLock) => {
      restoreWorkspaceInput("world-edit-roof-settings-close", restorePointerLock && activeTool === "roof");
      if (!restorePointerLock || activeTool !== "roof") return;
      const runtime = polygonAreaRuntime("roof");
      if (shouldCommitRoofSettingsClose({
        restorePointerLock,
        roofToolActive: activeTool === "roof",
        busy,
        closed: runtime.closed,
        valid: validPolygonArea(runtime.points),
      })) {
        void executeRoof();
      }
    },
  });
  solarPanel = createSolarToolPanel({
    root: options.root,
    getCalculation: () => polygonAreaRuntime("roof").calculation,
    getLocation: () => {
      const marker = roofSurfaceMarker(roofSurfaceTriangles(polygonAreaRuntime("roof").calculation));
      const point = marker && worldPointToLonLat(marker.x, marker.z, earthGrid);
      return point ? { longitude: point[0], latitude: point[1] } : null;
    },
    onChange: (settings) => {
      roofSolarSettings = settings;
      rebuildPolygonAreaScene("roof");
    },
    onClose: () => {
      if (activeTool === "roof") roofQuickSettings?.open(roofParameters);
      else restoreWorkspaceInput("world-edit-solar-close", true);
    },
    onSave: async () => {
      await executeRoof();
      if (!solarPanel?.isOpen()) {
        restoreWorkspaceInput("world-edit-solar-saved", true);
      }
    },
  });
  stairQuickSettings = createStairQuickSettings({
    root: options.root,
    onChange: (parameters) => {
      stairParameters = {...parameters};
      rebuildPolygonAreaScene("stair");
      refreshHud();
    },
    onClose: () => {
      restoreWorkspaceInput("world-edit-stair-settings-close", activeTool === "stair");
      if (activeTool !== "stair") return;
      const runtime = polygonAreaRuntime("stair");
      if (!busy && runtime.closed && validPolygonArea(runtime.points)) void executeStair();
    },
  });

  function syncPanelVisibility(): void {
    // The Creative Library owns the one visible settings panel.  This legacy
    // element remains as a headless controller for command state only.
    panel.hidden = true;
  }

  function constrainManualPlacement(
    position: ChunkApiWorldPosition,
    purpose: "new-placement" | "existing-block" = "new-placement",
    context?: Readonly<{
      targetPoint?: Readonly<{ x: number; y: number; z: number }> | null;
      currentFootprint?: Readonly<Record<string, unknown>> | null;
      worldCellGrid?: boolean;
    }>,
  ): {
    allowed: boolean;
    message?: string;
    code?: string;
    semanticPlacement?: ParcelGridSemanticPlacement;
  } {
    if (parcelSelection.parcels.length === 0) return { allowed: true };
    // Keep generated ground voxels untouched. The threshold comes from the
    // fixed parcel plane, not from the current top-most terrain surface, so a
    // user-placed terrain block above the plane still follows the slanted grid.
    if (purpose === "existing-block" && parcelGridPlaneY !== null) {
      const baseTerrainY = Math.floor(parcelGridPlaneY - 0.038 + 1e-6);
      if (position.y < baseTerrainY) return { allowed: true };
    }
    const frame = earthGrid ?? fallbackEarthGrid(parcelSelection.projectCoordinate);
    if (!frame) return { allowed: true };
    // The boundary resolver is also the renderer's authoritative grid model.
    // Resolve it before polygon containment and transition diagnostics so the
    // per-frame targeting path stays O(boundary segments), not O(all cells).
    // Existing LoD2 facades and new annex blocks use the same building-owned
    // geometry as the visible grid. A world-aligned fallback creates a cut
    // cell at rotated corners and can protrude beyond the building envelope.
    const resolvedPlacement = parcelGridPlacementResolver?.(position, {
      targetPoint: context?.targetPoint ? [context.targetPoint.x, context.targetPoint.z] : null,
      preferredLogicalCellId: safeString(context?.currentFootprint?.logicalGridCellId, "") || null,
    }) ?? null;
    if (resolvedPlacement) {
      return {
        allowed: true,
        code: "parcel-grid-semantic-footprint",
        semanticPlacement: resolvedPlacement,
      };
    }
    const corners = [
      [position.x, position.z],
      [position.x + 1, position.z],
      [position.x + 1, position.z + 1],
      [position.x, position.z + 1],
    ] as const;
    const centre = worldPointToLonLat(position.x + 0.5, position.z + 0.5, frame);
    if (!centre) return { allowed: true };
    const centreInside = parcelSelection.parcels.some((parcel) => parcelContainsLonLat(parcel, centre));
    const cornerInside = corners.map(([x, z]) => {
      const point = worldPointToLonLat(x, z, frame);
      return Boolean(point && parcelSelection.parcels.some((parcel) => parcelContainsLonLat(parcel, point)));
    });
    const zoneOverlaps = (parcelGridZoneCellIndex.get(`${position.x}:${position.z}`) ?? [])
      .map((cell) => ({ cell, area: polygonCellOverlapArea(cell.polygon, position.x, position.z) }))
      .filter((entry) => entry.area > 1e-7)
      .sort((first, second) => second.area - first.area);
    const slantedOverlaps = zoneOverlaps.filter(({ cell }) => cell.zone.startsWith("slanted-"));
    const fullStraightCell = zoneOverlaps.some(({ cell, area }) => (
      cell.zone === "straight"
      && cell.sourceCell?.x === position.x
      && cell.sourceCell?.z === position.z
      && area >= 0.999
    ));
    const contained = fullStraightCell || cornerInside.every(Boolean);
    // The rendered partition is authoritative and also catches narrow or
    // concave parcel intersections that a centre/corner sample can miss.
    const intersectsSelectedParcel = zoneOverlaps.length > 0 || centreInside || cornerInside.some(Boolean);
    const blockedCell = zoneOverlaps.find(({ cell }) => (
      cell.zone === "straight-clipped"
      && (cell.sourceCell?.x === position.x && cell.sourceCell?.z === position.z)
    ));
    if (blockedCell && slantedOverlaps.length === 0) {
      return {
        allowed: false,
        code: "parcel-grid-cut-cell-not-buildable",
        message: "Block nicht gesetzt: Diese rot markierte Rasterzelle wird am Übergang abgeschnitten und ist nicht bebaubar.",
      };
    }

    // A cell may never straddle the selected parcel union, independent of the
    // direction from which it was placed.  This is the same full-cell rule
    // used by transactional WorldEdit commands and by the CAD projection.
    if (intersectsSelectedParcel && !contained) {
      return {
        allowed: false,
        code: "selected-parcel-full-cell-required",
        message: "Block nicht gesetzt: Er würde über die Grenze des ausgewählten Grundstücks ragen. Nutze das Grundstücksraster für die Grenzausrichtung.",
      };
    }

    if (parcelGridGuide) {
      const dx = parcelGridGuide.end[0] - parcelGridGuide.start[0];
      const dz = parcelGridGuide.end[1] - parcelGridGuide.start[1];
      const lengthSquared = dx * dx + dz * dz;
      if (lengthSquared > 1e-8) {
        const centreX = position.x + 0.5;
        const centreZ = position.z + 0.5;
        const along = ((centreX - parcelGridGuide.start[0]) * dx
          + (centreZ - parcelGridGuide.start[1]) * dz) / lengthSquared;
        if (along >= -0.02 && along <= 1.02) {
          const signedDistances = corners.map(([x, z]) => (
            (x - parcelGridGuide!.start[0]) * parcelGridGuide!.inward[0]
            + (z - parcelGridGuide!.start[1]) * parcelGridGuide!.inward[1]
          ));
          const minimumDistance = Math.min(...signedDistances);
          const maximumDistance = Math.max(...signedDistances);
          const buildOffset = parcelGridMode === "setback" ? parcelGridSetback : 0;
          const insideActiveStrip = maximumDistance > -parcelGridInfluence
            && minimumDistance < buildOffset;
          if (insideActiveStrip) {
            return {
              allowed: false,
              code: "parcel-grid-build-axis-required",
              message: parcelGridMode === "setback"
                ? `Block nicht gesetzt: Die aktive Bauachse hält ${parcelGridSetback.toFixed(1)} m Abstand zur Grundstücksgrenze.`
                : "Block nicht gesetzt: Die aktive schräge Grundstücksgrenze darf nicht überbaut werden.",
            };
          }
        }
      }
    }

    if (!centreInside) {
      // Building on non-selected land remains possible, but it is deliberately
      // outside the protected/authoritative construction mask.  An active
      // parcel-grid guide narrows this exception in its configured strip.
      return { allowed: true };
    }
    return contained
      ? { allowed: true }
      : {
          allowed: false,
          code: "selected-parcel-full-cell-required",
          message: "Block nicht gesetzt: Er würde über die Grenze des ausgewählten Grundstücks ragen. Nutze das Grundstücksraster für die Grenzausrichtung.",
        };
  }

  const closeButton = panel.querySelector<HTMLButtonElement>("[data-world-edit-close]");
  const executeButton = panel.querySelector<HTMLButtonElement>("[data-world-edit-execute]");
  const resetButton = panel.querySelector<HTMLButtonElement>("[data-world-edit-reset]");
  const operationSelect = panel.querySelector<HTMLSelectElement>("[data-world-edit-operation]");
  const parcelMaskInput = panel.querySelector<HTMLInputElement>("[data-parcel-mask]");
  const brushRadius = panel.querySelector<HTMLInputElement>("[data-brush-radius]");
  const brushDensity = panel.querySelector<HTMLInputElement>("[data-brush-density]");
  const brushWall = panel.querySelector<HTMLInputElement>("[data-brush-wall]");
  const brushShape = panel.querySelector<HTMLSelectElement>("[data-brush-shape]");

  function setStatus(message: string, kind = "info"): void {
    const status = panel.querySelector<HTMLElement>("[data-world-edit-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
    publishInventoryState();
  }

  function selectedPlacement(): ActiveLibraryPlacement {
    return options.sceneRuntime.getSelectedLibraryPlacement();
  }

  function activeSystem() {
    return activeTool && systemRegistry ? systemRegistry.get(activeTool) : null;
  }

  function inventoryToolId(): string {
    return activeSystem()?.ui.inventoryToolId ?? "";
  }

  function publishInventoryState(): void {
    const status = panel.querySelector<HTMLElement>("[data-world-edit-status]");
    const canExecute = activeSystem()?.canExecute() ?? false;
    const polygonTool = activePolygonAreaTool();
    const polygonRuntime = polygonTool ? polygonAreaRuntime(polygonTool) : null;
    const roofSummary = asRecord(polygonAreaRuntime("roof").calculation?.summary);
    window.dispatchEvent(new CustomEvent(INVENTORY_STATE_EVENT, {
      detail: {
        active: Boolean(activeTool),
        toolId: inventoryToolId(),
        operation,
        first: positionLabel(selection.first),
        second: positionLabel(selection.second),
        status: status?.textContent ?? "",
        statusKind: status?.dataset.kind ?? "info",
        parcelCount: parcelSelection.parcels.length,
        parcelGridInfluence: parcelGridGuide?.depthMeters ?? parcelGridInfluence,
        parcelGridReferenceMode: parcelGridBuildingReference ? "lod2-building" : "empty-parcel",
        parcelGridBuildingId: parcelGridBuildingReference?.buildingId ?? null,
        parcelGridBuildingRotationDegrees: parcelGridBuildingReference?.rotationDegrees ?? null,
        polygonPointCount: polygonRuntime?.points.length ?? 0,
        polygonClosed: polygonRuntime?.closed ?? false,
        roomType,
        roomLabel,
        roomHeight,
        planningMode: activeTool === "room" ? isBuildingLineBrush() : activeTool === "tentacle" || isPlanningWorkspace(),
        planningBuildAreaWidth,
        planningBuildAreaSegmentCount: currentPlanningBuildAreaDraft()?.segments.length ?? 0,
        planningRoadWidth: planningRoadWidth(),
        planningRoadConflictChoice,
        planningRoadConflictChoices: ["fill", "bridge"],
        planningRoadConflictCount: planningRoadConflicts.length,
        planningRoadTunnelCount: planningRoadConflicts.filter((conflict) => conflict.resolution === "tunnel").length,
        roofParameters: { ...roofParameters },
        roofType: roofParameters.roofType,
        pitchDeg: roofParameters.pitchDeg,
        eavesHeightMm: roofParameters.eavesHeightMm,
        overhangMm: roofParameters.overhangMm,
        roofSkinThicknessMm: roofParameters.roofSkinThicknessMm,
        roofFaceCount: Number(roofSummary.face_count ?? 0),
        roofRafterCount: Number(roofSummary.rafter_count ?? 0),
        roofPurlinCount: Number(roofSummary.purlin_count ?? 0),
        busy,
        canExecute,
      },
    }));
  }

  function disposeSelectionGroup(): void {
    selectionBoxRuntime = null;
    selectionHandles = [];
    clipboardHandles = [];
    clipboardGizmoOrigin = null;
    clipboardHoveredAxis = null;
    clipboardPreviewRoot = null;
    delete options.root.dataset.selectionLiveBounds;
    delete options.root.dataset.selectionPreviewMode;
    if (!selectionGroup) return;
    const disposeMaterial = (material: THREE.Material): void => {
      const texture = (material as THREE.Material & { map?: THREE.Texture | null }).map;
      texture?.dispose();
      material.dispose();
    };
    selectionGroup.traverse((object) => {
      const drawable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      drawable.geometry?.dispose();
      if (Array.isArray(drawable.material)) drawable.material.forEach(disposeMaterial);
      else if (drawable.material) disposeMaterial(drawable.material);
    });
    selectionGroup.parent?.remove(selectionGroup);
    selectionGroup = null;
  }

  function disposeTentacleGroup(): void {
    tentaclePointTargets = [];
    if (!tentacleGroup) return;
    tentacleGroup.traverse((object) => {
      const drawable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      drawable.geometry?.dispose();
      if (Array.isArray(drawable.material)) drawable.material.forEach((material) => material.dispose());
      else drawable.material?.dispose();
    });
    tentacleGroup.parent?.remove(tentacleGroup);
    tentacleGroup = null;
  }

  function disposeParcelGroup(): void {
    if (!parcelGroup) return;
    parcelGroup.traverse((object) => {
      const drawable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      drawable.geometry?.dispose();
      if (Array.isArray(drawable.material)) drawable.material.forEach((material) => material.dispose());
      else drawable.material?.dispose();
    });
    parcelGroup.parent?.remove(parcelGroup);
    parcelGroup = null;
  }

  function disposeParcelGridGroup(): void {
    delete options.root.dataset.parcelGridZoneCells;
    delete options.root.dataset.parcelGridSlantedCells;
    delete options.root.dataset.parcelGridTransitionTriangles;
    delete options.root.dataset.parcelGridBlockedCells;
    delete options.root.dataset.parcelGridCoveredArea;
    delete options.root.dataset.parcelGridSlantedArea;
    delete options.root.dataset.parcelGridStraightArea;
    delete options.root.dataset.parcelGridBlockedArea;
    delete options.root.dataset.parcelGridRequestedCells;
    delete options.root.dataset.parcelGridRenderedWindowCells;
    delete options.root.dataset.parcelGridHandleCount;
    delete options.root.dataset.parcelGridLiveDepth;
    delete options.root.dataset.parcelGridReferenceMode;
    delete options.root.dataset.parcelGridBuildingId;
    delete options.root.dataset.parcelGridBuildingDimensions;
    parcelGridZoneCells = [];
    parcelGridZoneCellIndex = new Map();
    parcelGridPlacementResolver = null;
    parcelGridHandleTargets = [];
    parcelGridHandleRuntimes.clear();
    if (!parcelGridGroup) return;
    parcelGridGroup.traverse((object) => {
      const drawable = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      drawable.geometry?.dispose();
      if (Array.isArray(drawable.material)) drawable.material.forEach((material) => material.dispose());
      else drawable.material?.dispose();
    });
    parcelGridGroup.parent?.remove(parcelGridGroup);
    parcelGridGroup = null;
  }

  function resolveParcelGridPlaneY(surface: ReadonlyMap<string, number> | null): number {
    if (parcelGridPlaneY !== null) return parcelGridPlaneY;
    const counts = new Map<number, number>();
    for (const rawValue of surface?.values() ?? []) {
      if (!Number.isFinite(rawValue)) continue;
      const level = Math.round(rawValue);
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    const dominantLevel = [...counts.entries()]
      .sort((first, second) => second[1] - first[1] || first[0] - second[0])[0]?.[0] ?? 0;
    parcelGridPlaneY = dominantLevel + 0.038;
    options.root.dataset.parcelGridPlaneY = parcelGridPlaneY.toFixed(3);
    return parcelGridPlaneY;
  }

  function commitParcelGridGeometrySignature(nextSignature: string, reason: string): void {
    if (nextSignature === parcelGridGeometrySignature) return;
    parcelGridGeometrySignature = nextSignature;
    options.sceneRuntime.refreshPlacementGeometry(reason);
  }

  function rebuildParcelGridScene(): void {
    disposeParcelGridGroup();
    const refreshClearedPlacementGeometry = (): void => {
      commitParcelGridGeometrySignature("", "world-edit.parcel-grid-cleared");
    };
    const scene = options.sceneRuntime.getScene();
    if (!scene) {
      refreshClearedPlacementGeometry();
      return;
    }
    const overlay = scene.getObjectByName("vectoplan_geodata_overlay_scene_group");
    const surface = overlay?.userData.surfaceCellY instanceof Map
      ? overlay.userData.surfaceCellY as ReadonlyMap<string, number>
      : null;
    const frame = earthGrid
      ?? normalizedEarthGrid(overlay?.userData.earthGrid)
      ?? fallbackEarthGrid(parcelSelection.projectCoordinate);
    if (!frame || parcelSelection.parcels.length === 0) {
      refreshClearedPlacementGeometry();
      return;
    }
    earthGrid = frame;
    const fixedPlaneY = resolveParcelGridPlaneY(surface);
    const sampleY = (_x: number, _z: number): number => fixedPlaneY;
    type GridPoint = readonly [number, number];
    type GridSegment = readonly [GridPoint, GridPoint];
    interface WorldParcel {
      readonly parcelId: string;
      readonly rings: readonly (readonly GridPoint[])[];
    }
    interface BoundarySegment {
      readonly guideKey: string;
      readonly parcelId: string;
      readonly start: GridPoint;
      readonly end: GridPoint;
      readonly inward: GridPoint;
      readonly length: number;
      readonly maximumDepth: number;
      readonly divisions?: number;
      readonly clampToDepth?: boolean;
    }

    const worldParcels: WorldParcel[] = [];
    for (const parcel of parcelSelection.parcels) {
      for (const polygonValue of parcelPolygons(parcel)) {
        const rings = asArray(polygonValue)
          .map((ringValue) => asArray(ringValue)
            .map((coordinate) => {
              const point = asArray(coordinate);
              return lonLatToWorld(Number(point[0]), Number(point[1]), frame);
            })
            .filter((point): point is [number, number] => point !== null))
          .filter((ring) => ring.length >= 3);
        if (rings.length > 0) worldParcels.push({ parcelId: parcel.parcelId, rings });
      }
    }
    if (worldParcels.length === 0) {
      refreshClearedPlacementGeometry();
      return;
    }

    // Earcut (via Three.js ShapeUtils) turns arbitrary parcel polygons,
    // including concave exteriors and holes, into convex coverage triangles.
    // Every visible grid cell is clipped to this coverage below; no midpoint
    // approximation is allowed to create geometry outside the parcel union.
    const parcelCoverageTriangles: Array<readonly GridPoint[]> = [];
    for (const parcel of worldParcels) {
      const normalizedRings = parcel.rings
        .map((ring) => normalizeParcelGridPolygon(ring))
        .filter((ring) => ring.length >= 3);
      const exterior = normalizedRings[0];
      if (!exterior) continue;
      const contour = exterior.map((point) => new THREE.Vector2(point[0], point[1]));
      const holes = normalizedRings.slice(1).map((ring) => (
        ring.map((point) => new THREE.Vector2(point[0], point[1]))
      ));
      const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
      const vertices = [...contour, ...holes.flat()];
      for (const face of faces) {
        const triangle = face.map((index): GridPoint => {
          const point = vertices[index]!;
          return [point.x, point.y];
        });
        if (parcelGridPolygonArea(triangle) > 1e-8) parcelCoverageTriangles.push(triangle);
      }
    }
    if (parcelCoverageTriangles.length === 0) {
      refreshClearedPlacementGeometry();
      return;
    }

    const pointInsideParcel = (parcel: WorldParcel, point: GridPoint): boolean => pointInPolygon(point, parcel.rings);
    const pointInsideUnion = (point: GridPoint): boolean => worldParcels.some((parcel) => pointInsideParcel(parcel, point));
    const loadedBuildingReferences = lod2BuildingGridReferencesFromChunks(
      options.worldRuntime.getRegistry().getSnapshot().entries.map((entry) => entry.chunk),
    );
    const triangulateSimplePolygon = (polygonValue: readonly GridPoint[]): Array<readonly GridPoint[]> => {
      const polygon = normalizeParcelGridPolygon(polygonValue);
      if (polygon.length < 3) return [];
      const contour = polygon.map((point) => new THREE.Vector2(point[0], point[1]));
      const vertices = [...contour];
      return THREE.ShapeUtils.triangulateShape(contour, []).map((face) => (
        face.map((index): GridPoint => [vertices[index]!.x, vertices[index]!.y])
      )).filter((triangle) => parcelGridPolygonArea(triangle) > 1e-8);
    };
    const triangulateBuildingFootprint = (footprint: Lod2BuildingGridReference["footprints"][number]): Array<readonly GridPoint[]> => {
      const contour = normalizeParcelGridPolygon(footprint.outer).map((point) => new THREE.Vector2(point[0], point[1]));
      if (contour.length < 3) return [];
      const holes = footprint.holes.map((hole) => normalizeParcelGridPolygon(hole)
        .map((point) => new THREE.Vector2(point[0], point[1]))).filter((hole) => hole.length >= 3);
      const vertices = [...contour, ...holes.flat()];
      return THREE.ShapeUtils.triangulateShape(contour, holes).map((face) => (
        face.map((index): GridPoint => [vertices[index]!.x, vertices[index]!.y])
      )).filter((triangle) => parcelGridPolygonArea(triangle) > 1e-8);
    };
    const buildingCandidates = loadedBuildingReferences.map((reference) => {
      const triangles = reference.footprints.flatMap(triangulateBuildingFootprint);
      const overlapFragments: Array<readonly GridPoint[]> = [];
      for (const buildingTriangle of triangles) {
        for (const parcelTriangle of parcelCoverageTriangles) {
          const intersection = intersectConvexParcelGridPolygons(buildingTriangle, parcelTriangle);
          if (parcelGridPolygonArea(intersection) > 1e-6) overlapFragments.push(intersection);
        }
      }
      const overlapArea = mergeParcelGridCoverage(overlapFragments)
        .reduce((sum, polygon) => sum + parcelGridPolygonArea(polygon), 0);
      return { reference, triangles, overlapArea };
    }).filter((candidate) => candidate.overlapArea > 0.05 || pointInsideUnion(candidate.reference.centroid));
    buildingCandidates.sort((first, second) => (
      second.overlapArea - first.overlapArea
      || second.reference.areaM2 - first.reference.areaM2
      || first.reference.buildingId.localeCompare(second.reference.buildingId)
    ));
    parcelGridBuildingReference = buildingCandidates[0]?.reference ?? null;
    // Every intersecting existing building is an obstacle. Only the building
    // with the greatest real parcel overlap owns the common red reference
    // frame; neighbouring buildings must still never be rastered through.
    const buildingExclusionTriangles = buildingCandidates.flatMap((candidate) => candidate.triangles);
    options.root.dataset.parcelGridIntersectingBuildings = String(buildingCandidates.length);
    options.root.dataset.parcelGridBuildingOverlapArea = buildingCandidates[0]?.overlapArea.toFixed(3) ?? "0.000";
    if (parcelGridBuildingReference) {
      options.root.dataset.parcelGridReferenceMode = "lod2-building";
      options.root.dataset.parcelGridBuildingId = parcelGridBuildingReference.buildingId;
      options.root.dataset.parcelGridBuildingDimensions = `${parcelGridBuildingReference.widthM.toFixed(2)}x${parcelGridBuildingReference.depthM.toFixed(2)}`;
    } else {
      options.root.dataset.parcelGridReferenceMode = "empty-parcel";
    }
    const rawSegments: Array<Omit<BoundarySegment, "guideKey" | "inward" | "maximumDepth"> & { readonly parcel: WorldParcel }> = [];
    for (const parcel of worldParcels) {
      for (const ring of parcel.rings) {
        for (let index = 0; index < ring.length; index += 1) {
          const start = ring[index]!;
          const end = ring[(index + 1) % ring.length]!;
          const dx = end[0] - start[0];
          const dz = end[1] - start[1];
          const length = Math.hypot(dx, dz);
          if (length < 0.05) continue;
          rawSegments.push({ parcelId: parcel.parcelId, parcel, start, end, length });
        }
      }
    }
    const boundarySegments: BoundarySegment[] = [];
    for (const segment of rawSegments) {
      const dx = segment.end[0] - segment.start[0];
      const dz = segment.end[1] - segment.start[1];
      const midpoint: GridPoint = [
        (segment.start[0] + segment.end[0]) * 0.5,
        (segment.start[1] + segment.end[1]) * 0.5,
      ];
      let inward: GridPoint = [-dz / segment.length, dx / segment.length];
      if (!pointInsideParcel(segment.parcel, [midpoint[0] + inward[0] * 0.2, midpoint[1] + inward[1] * 0.2])) {
        inward = [-inward[0], -inward[1]];
      }
      // A shared edge between two selected parcels belongs to the common
      // build mask and must not create an artificial 3 m strip.
      const outwardProbe: GridPoint = [midpoint[0] - inward[0] * 0.2, midpoint[1] - inward[1] * 0.2];
      const sharedInside = worldParcels.some((parcel) => parcel !== segment.parcel && pointInsideParcel(parcel, outwardProbe));
      if (!sharedInside) boundarySegments.push({
        guideKey: parcelGridWorldGuideKey(segment.parcelId, segment.start, segment.end, frame),
        parcelId: segment.parcelId,
        start: segment.start,
        end: segment.end,
        inward,
        length: segment.length,
        maximumDepth: resolveParcelGridMaximumDepth({
          points: segment.parcel.rings.flatMap((ring) => [...ring]),
          start: segment.start,
          inward,
          minimumDepth: PARCEL_GRID_MIN_DRAG_DEPTH_CELLS,
          maximumDepth: PARCEL_GRID_MAX_DRAG_DEPTH_CELLS,
          paddingCells: PARCEL_GRID_DRAG_DEPTH_PADDING_CELLS,
        }),
      });
    }
    if (boundarySegments.length === 0) {
      refreshClearedPlacementGeometry();
      return;
    }
    // Two-zone contract: the green outer band always belongs to the parcel
    // boundary. A building supplies only the coherent red inner frame and an
    // exclusion footprint; individual facade fragments never become local,
    // competing boundary bands.
    const buildingBoundarySegments: BoundarySegment[] = [];
    const rasterBoundarySegments = boundarySegments;
    options.root.dataset.parcelGridFacadeSegments = String(parcelGridBuildingReference?.facades.length ?? 0);

    const distanceToSegment = (point: GridPoint, segment: BoundarySegment): number => {
      const dx = segment.end[0] - segment.start[0];
      const dz = segment.end[1] - segment.start[1];
      const squared = dx * dx + dz * dz;
      const factor = squared <= 1e-9 ? 0 : Math.max(0, Math.min(1,
        ((point[0] - segment.start[0]) * dx + (point[1] - segment.start[1]) * dz) / squared,
      ));
      return Math.hypot(
        point[0] - (segment.start[0] + dx * factor),
        point[1] - (segment.start[1] + dz * factor),
      );
    };
    const segmentMatchesGuide = (segment: BoundarySegment): boolean => {
      return Boolean(parcelGridGuide && parcelGridGuide.guideKey === segment.guideKey);
    };
    const defaultSlantedDepth = Math.max(1, Math.min(PARCEL_GRID_MAX_DRAG_DEPTH_CELLS, Math.round(parcelGridInfluence)));
    const depthForSegment = (segment: BoundarySegment): number => {
      const savedDepth = persistedParcelGridGuides.get(segment.guideKey)?.depthMeters;
      const depth = segmentMatchesGuide(segment) ? parcelGridGuide!.depthMeters : savedDepth;
      return Math.max(0, Math.min(segment.maximumDepth, Math.round(depth ?? defaultSlantedDepth)));
    };
    const maximumSlantedDepth = Math.max(defaultSlantedDepth, ...rasterBoundarySegments.map(depthForSegment));

    // Placement and drawing must use the very same world-space boundary
    // model.  Resolving directly from the nearest selected boundary avoids
    // the old failure where a visibly slanted cell was looked up through an
    // unrelated axis-aligned overlap and silently fell back to SetBlock.
    const boundaryPlacementResolver = (position: ChunkApiWorldPosition): ParcelGridSemanticPlacement | null => {
      const centre: GridPoint = [position.x + 0.5, position.z + 0.5];
      const sourceCorners: readonly GridPoint[] = [
        [position.x, position.z],
        [position.x + 1, position.z],
        [position.x + 1, position.z + 1],
        [position.x, position.z + 1],
      ];
      if (!pointInsideUnion(centre) && !sourceCorners.some(pointInsideUnion)) return null;

      let best: Readonly<{
        segment: BoundarySegment;
        segmentIndex: number;
        along: number;
        signedDepth: number;
        score: number;
      }> | null = null;
      for (let segmentIndex = 0; segmentIndex < rasterBoundarySegments.length; segmentIndex += 1) {
        const segment = rasterBoundarySegments[segmentIndex]!;
        const tangentX = (segment.end[0] - segment.start[0]) / segment.length;
        const tangentZ = (segment.end[1] - segment.start[1]) / segment.length;
        const deltaX = centre[0] - segment.start[0];
        const deltaZ = centre[1] - segment.start[1];
        const along = deltaX * tangentX + deltaZ * tangentZ;
        const signedDepth = deltaX * segment.inward[0] + deltaZ * segment.inward[1];
        const depth = depthForSegment(segment);
        if (along < -0.55 || along > segment.length + 0.55) continue;
        if (signedDepth < -0.55 || signedDepth >= depth - 1e-6) continue;
        const endpointPenalty = along < 0 ? -along : along > segment.length ? along - segment.length : 0;
        const score = Math.max(0, signedDepth) + endpointPenalty * 1.5;
        if (!best || score < best.score - 1e-7) {
          best = { segment, segmentIndex, along, signedDepth, score };
        }
      }
      if (!best) return null;

      const segment = best.segment;
      const tangentX = (segment.end[0] - segment.start[0]) / segment.length;
      const tangentZ = (segment.end[1] - segment.start[1]) / segment.length;
      const divisions = Math.max(1, segment.divisions ?? Math.ceil(segment.length));
      const columnWidth = segment.length / divisions;
      const column = Math.max(0, Math.min(divisions - 1, Math.floor(
        Math.max(0, Math.min(segment.length - 1e-7, best.along)) / columnWidth,
      )));
      const depthLimit = depthForSegment(segment);
      const row = Math.max(0, Math.min(depthLimit - 1, Math.floor(Math.max(0, best.signedDepth))));
      const alongStart = column * columnWidth;
      const alongEnd = Math.min(segment.length, (column + 1) * columnWidth);
      const depthStart = row;
      const depthEnd = Math.min(depthLimit, row + 1);
      const at = (along: number, depth: number): GridPoint => [
        segment.start[0] + tangentX * along + segment.inward[0] * depth,
        segment.start[1] + tangentZ * along + segment.inward[1] * depth,
      ];
      const footprint: readonly GridPoint[] = [
        at(alongStart, depthStart),
        at(alongEnd, depthStart),
        at(alongEnd, depthEnd),
        at(alongStart, depthEnd),
      ];
      if (!pointInsideUnion(centroid(footprint))) return null;
      const wallAxisDegrees = ((Math.atan2(tangentZ, tangentX) * 180 / Math.PI) + 180) % 180;
      const edgeKey = [segment.start, segment.end]
        .map((point) => `${point[0].toFixed(3)}:${point[1].toFixed(3)}`)
        .sort()
        .join("|");
      return {
        kind: "parcel-grid-prism.v1",
        footprint: {
          type: "Polygon",
          coordinateSpace: "world-cell-xz",
          coordinates: [[...footprint, footprint[0]!]],
          baseY: position.y,
          height: 1,
          gridSchemaVersion: "vectoplan-parcel-grid-guide.v8",
          sourceCell: { x: position.x, z: position.z },
          boundaryEdge: edgeKey,
          boundaryRow: row,
          boundaryColumn: column,
        },
        occupiedCells: [position],
        mergeKey: `parcel-grid:${segment.parcelId}:${position.y}:${edgeKey}:${row}:${wallAxisDegrees.toFixed(2)}`,
      };
    };
    const centroid = (polygon: readonly GridPoint[]): GridPoint => [
      polygon.reduce((sum, point) => sum + point[0], 0) / Math.max(1, polygon.length),
      polygon.reduce((sum, point) => sum + point[1], 0) / Math.max(1, polygon.length),
    ];
    const signedDepthToSegment = (point: GridPoint, segment: BoundarySegment): number => (
      (point[0] - segment.start[0]) * segment.inward[0]
      + (point[1] - segment.start[1]) * segment.inward[1]
    );
    const alongSegment = (point: GridPoint, segment: BoundarySegment): number => (
      (point[0] - segment.start[0]) * ((segment.end[0] - segment.start[0]) / segment.length)
      + (point[1] - segment.start[1]) * ((segment.end[1] - segment.start[1]) / segment.length)
    );
    const clipToStraightSide = (
      input: readonly GridPoint[],
      segment: BoundarySegment,
      minimumDepth: number,
    ): GridPoint[] => {
      if (input.length < 3) return [];
      const output: GridPoint[] = [];
      for (let index = 0; index < input.length; index += 1) {
        const current = input[index]!;
        const next = input[(index + 1) % input.length]!;
        const currentDistance = signedDepthToSegment(current, segment) - minimumDepth;
        const nextDistance = signedDepthToSegment(next, segment) - minimumDepth;
        const currentInside = currentDistance >= -1e-7;
        const nextInside = nextDistance >= -1e-7;
        if (currentInside) output.push(current);
        if (currentInside === nextInside) continue;
        const denominator = currentDistance - nextDistance;
        if (Math.abs(denominator) < 1e-9) continue;
        const factor = Math.max(0, Math.min(1, currentDistance / denominator));
        output.push([
          current[0] + (next[0] - current[0]) * factor,
          current[1] + (next[1] - current[1]) * factor,
        ]);
      }
      return [...new Map(output.map((point) => [
        `${point[0].toFixed(6)}:${point[1].toFixed(6)}`,
        point,
      ])).values()];
    };

    const group = new THREE.Group();
    group.name = "vectoplan_parcel_grid_guide";
    const blueSegments: GridSegment[] = [];
    const slantedSegments: GridSegment[] = [];
    const straightSegments: GridSegment[] = [];
    const transitionSegments: GridSegment[] = [];
    const activeAxisSegments: GridSegment[] = [];
    const innerAxisSegments: GridSegment[] = [];
    const innerAxisGuideKeys: string[] = [];
    const zoneCells: ParcelGridZoneCell[] = [];
    const transitionTriangles: ParcelGridZoneCell[] = [];
    const slantedFill: number[] = [];
    const transitionFill: number[] = [];
    const blockedFill: number[] = [];
    const seenByBucket = new Map<GridSegment[], Set<string>>();
    const addSegment = (bucket: GridSegment[], start: GridPoint, end: GridPoint): void => {
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 1e-5) return;
      const first = `${start[0].toFixed(4)}:${start[1].toFixed(4)}`;
      const second = `${end[0].toFixed(4)}:${end[1].toFixed(4)}`;
      const key = first < second ? `${first}|${second}` : `${second}|${first}`;
      const seen = seenByBucket.get(bucket) ?? new Set<string>();
      if (seen.has(key)) return;
      seen.add(key);
      seenByBucket.set(bucket, seen);
      bucket.push([start, end]);
    };
    const addFillPolygon = (positions: number[], polygon: readonly GridPoint[]): void => {
      if (polygon.length < 3) return;
      for (let index = 1; index < polygon.length - 1; index += 1) {
        for (const point of [polygon[0]!, polygon[index]!, polygon[index + 1]!]) {
          positions.push(point[0], sampleY(point[0], point[1]) + 0.003, point[1]);
        }
      }
    };

    const allPoints = worldParcels.flatMap((parcel) => parcel.rings.flatMap((ring) => [...ring]));
    const renderBounds = resolveParcelGridRenderBounds({
      points: allPoints,
      visibleSurfacePoints: surface
        ? [...surface.keys()].map((key) => key.split(":").map(Number))
          .filter((value): value is [number, number] => value.length === 2 && value.every(Number.isFinite))
        : [],
      fullRenderCellLimit: PARCEL_GRID_FULL_RENDER_CELL_LIMIT,
      visibleMarginCells: PARCEL_GRID_VISIBLE_MARGIN_CELLS,
    });
    if (!renderBounds) {
      refreshClearedPlacementGeometry();
      return;
    }
    const { minimumX, maximumX, minimumZ, maximumZ } = renderBounds;
    options.root.dataset.parcelGridRequestedCells = String(renderBounds.requestedCells);
    options.root.dataset.parcelGridRenderedWindowCells = String(renderBounds.renderedCells);
    const parcelBoundaryInputs = rasterBoundarySegments.map((segment) => {
        const segmentId = [segment.start, segment.end]
          .map((point) => `${point[0].toFixed(6)}:${point[1].toFixed(6)}`)
          .sort()
          .join("|");
        return {
          id: segmentId,
          parcelId: segment.parcelId,
          start: segment.start,
          end: segment.end,
          inward: segment.inward,
          length: segment.length,
          depth: depthForSegment(segment),
          divisions: segment.divisions,
          clampToDepth: segment.clampToDepth,
          boundaryKind: "parcel" as const,
        };
      });
    const buildingFacadeInputs = buildingCandidates.flatMap((candidate) => (
      lod2BuildingFacadeBands(candidate.reference, 1)
    ));
    const partition = buildParcelGridPartition({
      boundarySegments: [...parcelBoundaryInputs, ...buildingFacadeInputs],
      coverageTriangles: parcelCoverageTriangles,
      excludedTriangles: buildingExclusionTriangles,
      bounds: { minimumX, maximumX, minimumZ, maximumZ },
      regularGrid: parcelGridBuildingReference ? {
        id: parcelGridBuildingReference.buildingId,
        origin: parcelGridBuildingReference.origin,
        axisU: parcelGridBuildingReference.axisU,
        axisV: parcelGridBuildingReference.axisV,
        stepU: parcelGridBuildingReference.stepU,
        stepV: parcelGridBuildingReference.stepV,
        uAnchors: parcelGridBuildingReference.uAnchors,
        vAnchors: parcelGridBuildingReference.vAnchors,
      } : null,
      minimumArea: 1e-6,
    });
    const parcelGridAudit = parcelGridBuildingReference
      ? auditParcelGrid({
          reference: parcelGridBuildingReference,
          partition,
          coverageTriangles: parcelCoverageTriangles,
          excludedTriangles: buildingExclusionTriangles,
        })
      : null;
    if (parcelGridAudit) {
      options.root.dataset.parcelGridAuditStatus = parcelGridAudit.status;
      options.root.dataset.parcelGridAuditAxisError = parcelGridAudit.weightedFacadeAxisErrorDegrees.toFixed(3);
      options.root.dataset.parcelGridAuditAnchorOffset = parcelGridAudit.p95FacadeAnchorOffsetM.toFixed(3);
      options.root.dataset.parcelGridAuditBuildingOverlap = parcelGridAudit.buildingOverlapAreaM2.toFixed(6);
      options.root.dataset.parcelGridAuditFacadeCoverage = parcelGridAudit.minimumFacadeCoverageRatio.toFixed(6);
      options.root.dataset.parcelGridAuditFacadeGap = parcelGridAudit.maximumFacadeLineGapM.toFixed(3);
      options.root.dataset.parcelGridAuditPartialFacadeCells = String(parcelGridAudit.partialFacadeCellCount);
      options.root.dataset.parcelGridAuditCoverageGap = parcelGridAudit.uncoveredBuildableAreaM2.toFixed(6);
      options.root.dataset.parcelGridAuditIssues = parcelGridAudit.issues.map((issue) => issue.code).join(",");
    } else {
      delete options.root.dataset.parcelGridAuditStatus;
      delete options.root.dataset.parcelGridAuditAxisError;
      delete options.root.dataset.parcelGridAuditAnchorOffset;
      delete options.root.dataset.parcelGridAuditBuildingOverlap;
      delete options.root.dataset.parcelGridAuditFacadeCoverage;
      delete options.root.dataset.parcelGridAuditFacadeGap;
      delete options.root.dataset.parcelGridAuditPartialFacadeCells;
      delete options.root.dataset.parcelGridAuditCoverageGap;
      delete options.root.dataset.parcelGridAuditIssues;
    }
    for (const segment of rasterBoundarySegments) addSegment(blueSegments, segment.start, segment.end);
    const logicalZoneCells = new Map<string, ParcelGridZoneCell[]>();
    for (const partitionCell of partition.cells) {
      const cell: ParcelGridZoneCell = { ...partitionCell };
      zoneCells.push(cell);
      if (cell.logicalCellId) {
        const fragments = logicalZoneCells.get(cell.logicalCellId) ?? [];
        fragments.push(cell);
        logicalZoneCells.set(cell.logicalCellId, fragments);
      }
      const polygon = cell.polygon;
      const lineBucket = cell.zone === "straight"
          ? straightSegments
          : transitionSegments;
      if (cell.zone.startsWith("slanted-")) {
        addFillPolygon(slantedFill, polygon);
      } else {
        for (let edge = 0; edge < polygon.length; edge += 1) {
          addSegment(lineBucket, polygon[edge]!, polygon[(edge + 1) % polygon.length]!);
        }
      }
      if (cell.zone === "straight-clipped") {
        addFillPolygon(blockedFill, polygon);
        if (polygon.length === 3) {
          transitionTriangles.push({ ...cell, zone: "transition-triangle" });
          addFillPolygon(transitionFill, polygon);
        }
      }
    }
    for (const cells of logicalZoneCells.values()) {
      if (!cells.some((cell) => cell.zone.startsWith("slanted-"))) continue;
      for (const polygon of mergeParcelGridCoverage(cells.map((cell) => cell.polygon))) {
        for (let edge = 0; edge < polygon.length; edge += 1) {
          addSegment(slantedSegments, polygon[edge]!, polygon[(edge + 1) % polygon.length]!);
        }
      }
    }
    // Empty plots retain their adjustable parcel-edge guide. For an existing
    // building the equivalent band is anchored automatically at each facade;
    // it is deliberately not draggable away from the wall.
    for (const segment of rasterBoundarySegments) {
      const depth = depthForSegment(segment);
      innerAxisSegments.push([
        [segment.start[0] + segment.inward[0] * depth, segment.start[1] + segment.inward[1] * depth],
        [segment.end[0] + segment.inward[0] * depth, segment.end[1] + segment.inward[1] * depth],
      ]);
      innerAxisGuideKeys.push(segment.guideKey);
    }
    options.root.dataset.parcelGridCoveredArea = partition.coveredArea.toFixed(3);
    options.root.dataset.parcelGridSlantedArea = partition.slantedArea.toFixed(3);
    options.root.dataset.parcelGridStraightArea = partition.straightArea.toFixed(3);
    options.root.dataset.parcelGridBlockedArea = partition.blockedArea.toFixed(3);

    if (parcelGridGuide) {
      addSegment(activeAxisSegments, parcelGridGuide.start, parcelGridGuide.end);
      if (parcelGridMode === "setback" && parcelGridSetback > 0) {
        addSegment(activeAxisSegments,
          [parcelGridGuide.start[0] + parcelGridGuide.inward[0] * parcelGridSetback, parcelGridGuide.start[1] + parcelGridGuide.inward[1] * parcelGridSetback],
          [parcelGridGuide.end[0] + parcelGridGuide.inward[0] * parcelGridSetback, parcelGridGuide.end[1] + parcelGridGuide.inward[1] * parcelGridSetback],
        );
      }
    }

    const addLineBatch = (
      name: string,
      segments: readonly GridSegment[],
      color: number,
      opacity: number,
      order: number,
    ): THREE.LineSegments | null => {
      if (segments.length === 0) return null;
      const positions: number[] = [];
      for (const [start, end] of segments) {
        positions.push(start[0], sampleY(start[0], start[1]), start[1]);
        positions.push(end[0], sampleY(end[0], end[1]), end[1]);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      }));
      lines.name = name;
      lines.renderOrder = order;
      group.add(lines);
      return lines;
    };
    const addFillBatch = (name: string, positions: readonly number[], color: number, opacity: number, order: number): void => {
      if (positions.length === 0) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }));
      mesh.name = name;
      mesh.renderOrder = order;
      group.add(mesh);
    };
    addFillBatch("parcel_grid_slanted_zone_fill", slantedFill, 0x3b82f6, 0.045, 111);
    addFillBatch("parcel_grid_transition_fill", transitionFill, 0x60a5fa, 0.035, 112);
    addFillBatch("parcel_grid_blocked_cut_cells", blockedFill, 0x1d4ed8, 0.16, 115);
    addLineBatch("parcel_grid_straight_cells", straightSegments, 0x3b82f6, 0.58, 116);
    addLineBatch("parcel_grid_slanted_cells", slantedSegments, 0x1687ff, 0.92, 118);
    addLineBatch("parcel_grid_transition_triangles", transitionSegments, 0x60a5fa, 0.94, 119);
    addLineBatch("parcel_grid_boundary", blueSegments, 0x1265e5, 1, 120);
    addLineBatch("parcel_grid_active_axis", activeAxisSegments, 0x60a5fa, 1, 121);
    const innerAxisLines = addLineBatch("parcel_grid_inner_axis", innerAxisSegments, 0x00d9ff, 1, 122);

    if (innerAxisLines && activeSystem()?.behavior.showParcelGridHandles && buildingBoundarySegments.length === 0) {
      innerAxisLines.frustumCulled = false;
      const linePositions = innerAxisLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      linePositions.setUsage(THREE.DynamicDrawUsage);
      const camera = options.sceneRuntime.getCamera();
      const renderer = options.sceneRuntime.getRenderer();
      for (let index = 0; index < rasterBoundarySegments.length; index += 1) {
        const segment = rasterBoundarySegments[index]!;
        const guideKey = innerAxisGuideKeys[index]!;
        const depthMeters = depthForSegment(segment);
        const along = segmentMatchesGuide(segment)
          ? Math.max(0.04, Math.min(0.96, parcelGridHandleAlong))
          : 0.5;
        const axisX = segment.start[0]
          + (segment.end[0] - segment.start[0]) * along
          + segment.inward[0] * depthMeters;
        const axisZ = segment.start[1]
          + (segment.end[1] - segment.start[1]) * along
          + segment.inward[1] * depthMeters;
        const origin = new THREE.Vector3(axisX, sampleY(axisX, axisZ) + 0.22, axisZ);
        const inward = new THREE.Vector3(segment.inward[0], 0, segment.inward[1]).normalize();
        const handleGroup = new THREE.Group();
        handleGroup.name = "parcel_grid_inner_axis_drag_handle";
        handleGroup.position.copy(origin);
        handleGroup.renderOrder = 132;

        for (const direction of [inward, inward.clone().multiplyScalar(-1)]) {
          const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(), 1.15, 0xffffff, 0.34, 0.24);
          arrow.name = "parcel_grid_inner_axis_drag_arrow";
          arrow.renderOrder = 132;
          arrow.line.renderOrder = 132;
          arrow.cone.renderOrder = 133;
          arrow.line.material.depthTest = false;
          arrow.line.material.depthWrite = false;
          arrow.line.material.transparent = true;
          arrow.line.material.opacity = 1;
          arrow.cone.material.depthTest = false;
          arrow.cone.material.depthWrite = false;
          arrow.cone.material.transparent = true;
          arrow.cone.material.opacity = 1;
          handleGroup.add(arrow);
        }

        const grip = new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 16, 10),
          new THREE.MeshBasicMaterial({
            color: segmentMatchesGuide(segment) ? 0x7dd3fc : 0x00d9ff,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        grip.name = "parcel_grid_inner_axis_drag_grip";
        grip.renderOrder = 134;
        handleGroup.add(grip);

        // A transparent, screen-size-stable pick sphere makes every handle
        // reliably clickable even when the parcel is far away.
        const pickTarget = new THREE.Mesh(
          new THREE.SphereGeometry(0.72, 10, 8),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.001,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        pickTarget.name = "parcel_grid_inner_axis_drag_pick_target";
        pickTarget.renderOrder = 131;
        pickTarget.userData = { parcelGridDragHandle: true, parcelGridGuideKey: guideKey };
        handleGroup.add(pickTarget);
        parcelGridHandleTargets.push(pickTarget);

        grip.onBeforeRender = () => {
          if (!camera) return;
          const viewportHeight = Math.max(1, renderer?.domElement.clientHeight ?? window.innerHeight ?? 1);
          const distance = camera.position.distanceTo(handleGroup.position);
          const scale = resolveParcelGridHandleScale({
            distance,
            verticalFieldOfViewDegrees: camera.fov,
            viewportHeightPixels: viewportHeight,
          });
          handleGroup.scale.setScalar(scale);
        };

        parcelGridHandleRuntimes.set(guideKey, {
          guideKey,
          parcelId: segment.parcelId,
          group: handleGroup,
          linePositions,
          lineVertexOffset: index * 2,
          start: segment.start,
          end: segment.end,
          inward: segment.inward,
          along,
          planeY: fixedPlaneY,
          maximumDepthMeters: segment.maximumDepth,
          currentDepthMeters: depthMeters,
        });
        group.add(handleGroup);
      }
    }
    options.root.dataset.parcelGridHandleCount = String(parcelGridHandleRuntimes.size);

    group.userData = {
      kind: "parcel-grid-guide",
      schemaVersion: "vectoplan-parcel-grid-guide.v8",
      referenceMode: parcelGridBuildingReference ? "lod2-building" : "empty-parcel",
      buildingReference: parcelGridBuildingReference ? {
        buildingId: parcelGridBuildingReference.buildingId,
        rotationDegrees: parcelGridBuildingReference.rotationDegrees,
        dimensionsM: [parcelGridBuildingReference.widthM, parcelGridBuildingReference.depthM],
        cellSizeM: [parcelGridBuildingReference.stepU, parcelGridBuildingReference.stepV],
      } : null,
      audit: parcelGridAudit,
      mode: parcelGridMode,
      setbackMeters: parcelGridSetback,
      legalBandsMeters: Array.from({ length: maximumSlantedDepth + 2 }, (_, index) => index),
      slantedBandMeters: defaultSlantedDepth,
      selectedEdgeSlantedBandMeters: parcelGridGuide?.depthMeters ?? null,
      transitionBandMeters: [defaultSlantedDepth, defaultSlantedDepth + 1],
      transitionShape: "right-triangle-with-straight-grid",
      zoneCells,
      transitionTriangles,
      blockedCells: zoneCells.filter((cell) => cell.zone === "straight-clipped"),
    };
    parcelGridZoneCells = zoneCells;
    const zoneCellIndex = new Map<string, ParcelGridZoneCell[]>();
    for (const cell of zoneCells) {
      const minimumCellX = Math.floor(Math.min(...cell.polygon.map((point) => point[0])) + 1e-7);
      const maximumCellX = Math.ceil(Math.max(...cell.polygon.map((point) => point[0])) - 1e-7);
      const minimumCellZ = Math.floor(Math.min(...cell.polygon.map((point) => point[1])) + 1e-7);
      const maximumCellZ = Math.ceil(Math.max(...cell.polygon.map((point) => point[1])) - 1e-7);
      for (let x = minimumCellX; x < maximumCellX; x += 1) {
        for (let z = minimumCellZ; z < maximumCellZ; z += 1) {
          const key = `${x}:${z}`;
          const entries = zoneCellIndex.get(key) ?? [];
          entries.push(cell);
          zoneCellIndex.set(key, entries);
        }
      }
    }
    parcelGridZoneCellIndex = zoneCellIndex;
    parcelGridPlacementResolver = (position, resolverOptions): ParcelGridSemanticPlacement | null => {
      // One authoritative logical grid cell wins the source voxel. Combining
      // comparable cells from two corner edges with a convex hull used to
      // bridge the parcel corner and produced the oversized bodies in the
      // screenshots. Fragments only share an id when they came from the same
      // already-clipped one-metre boundary cell.
      const groups = new Map<string, { cells: ParcelGridZoneCell[]; area: number }>();
      const targetCell = resolverOptions?.targetPoint
        ? { x: Math.floor(resolverOptions.targetPoint[0]), z: Math.floor(resolverOptions.targetPoint[1]) }
        : null;
      const lookupCells = [
        { x: position.x, z: position.z },
        targetCell,
      ].filter((value, index, values): value is { x: number; z: number } => Boolean(value)
        && values.findIndex((candidate) => candidate?.x === value?.x && candidate?.z === value?.z) === index);
      const indexedCells = new Set<ParcelGridZoneCell>();
      for (const lookup of lookupCells) {
        for (const cell of zoneCellIndex.get(`${lookup.x}:${lookup.z}`) ?? []) indexedCells.add(cell);
      }
      for (const cell of indexedCells) {
        if (!cell.zone.startsWith("slanted-") && cell.gridAlignment !== "lod2-building") continue;
        const overlap = Math.max(...lookupCells.map((lookup) => (
          polygonCellOverlapArea(cell.polygon, lookup.x, lookup.z)
        )));
        if (overlap <= 1e-7) continue;
        const key = cell.logicalCellId ?? `${cell.parcelId}:${cell.zone}:${cell.boundarySegmentId ?? "edge"}`;
        const group = groups.get(key) ?? { cells: [], area: 0 };
        group.cells.push(cell);
        group.area += overlap;
        groups.set(key, group);
      }
      const preferredGroup = resolverOptions?.preferredLogicalCellId
        ? groups.get(resolverOptions.preferredLogicalCellId)
        : null;
      const pointedGroup = resolverOptions?.targetPoint
        ? [...groups.entries()]
            .filter(([, group]) => group.cells.some((cell) => pointInRing(resolverOptions.targetPoint!, cell.polygon)))
            .sort((first, second) => second[1].area - first[1].area || first[0].localeCompare(second[0]))[0]
        : null;
      const selectedGroup = preferredGroup && resolverOptions?.preferredLogicalCellId
        ? [resolverOptions.preferredLogicalCellId, preferredGroup] as const
        : pointedGroup
          ?? [...groups.entries()]
            .sort((first, second) => second[1].area - first[1].area || first[0].localeCompare(second[0]))[0];
      if (!selectedGroup) return null;
      // Triangulation and corner subtraction may split one logical grid cell
      // into several convex fragments. Reassemble all fragments of the chosen
      // cell before persisting it; never mix fragments from another edge.
      const cells = logicalZoneCells.get(selectedGroup[0]) ?? selectedGroup[1].cells;
      const originalOverlap = cells.reduce((sum, cell) => (
        sum + polygonCellOverlapArea(cell.polygon, position.x, position.z)
      ), 0);
      const targetOverlap = targetCell ? cells.reduce((sum, cell) => (
        sum + polygonCellOverlapArea(cell.polygon, targetCell.x, targetCell.z)
      ), 0) : 0;
      const anchorPosition: ChunkApiWorldPosition = originalOverlap > 1e-7 || !targetCell || targetOverlap <= 1e-7
        ? position
        : { x: targetCell.x, y: position.y, z: targetCell.z };
      const merged = mergeParcelGridCoverage(cells.map((cell) => cell.polygon));
      const footprints = [...merged]
        .filter((polygon) => polygon.length >= 3 && polygonArea(polygon) >= 1e-7)
        .sort((first, second) => (
          polygonCellOverlapArea(second, anchorPosition.x, anchorPosition.z)
          - polygonCellOverlapArea(first, anchorPosition.x, anchorPosition.z)
        ));
      if (footprints.length === 0) return null;
      const closedFootprints = footprints.map((polygon) => [...polygon, polygon[0]!]);
      const primary = [...cells].sort((first, second) => (
        polygonCellOverlapArea(second.polygon, anchorPosition.x, anchorPosition.z)
        - polygonCellOverlapArea(first.polygon, anchorPosition.x, anchorPosition.z)
      ))[0]!;
      let longestEdge: readonly [GridPoint, GridPoint] = [primary.polygon[0]!, primary.polygon[1]!];
      for (let index = 0; index < primary.polygon.length; index += 1) {
        const candidate: readonly [GridPoint, GridPoint] = [
          primary.polygon[index]!,
          primary.polygon[(index + 1) % primary.polygon.length]!,
        ];
        if (Math.hypot(
          candidate[1][0] - candidate[0][0],
          candidate[1][1] - candidate[0][1],
        ) > Math.hypot(
          longestEdge[1][0] - longestEdge[0][0],
          longestEdge[1][1] - longestEdge[0][1],
        )) longestEdge = candidate;
      }
      const wallAxisDegrees = primary.wallAxisDegrees ?? ((Math.atan2(
        longestEdge[1][1] - longestEdge[0][1],
        longestEdge[1][0] - longestEdge[0][0],
      ) * 180 / Math.PI) + 180) % 180;
      const parcelIds = [...new Set(cells.map((cell) => cell.parcelId))].sort();
      const boundarySegmentId = primary.boundarySegmentId
        ?? (primary.gridAlignment === "lod2-building" && parcelGridBuildingReference
          ? `building:${parcelGridBuildingReference.buildingId}`
          : "clipped-edge");
      const boundaryRow = primary.boundaryRow ?? 0;
      return {
        kind: "parcel-grid-prism.v1",
        footprint: {
          type: closedFootprints.length === 1 ? "Polygon" : "MultiPolygon",
          coordinateSpace: "world-cell-xz",
          coordinates: closedFootprints.length === 1
            ? [closedFootprints[0]]
            : closedFootprints.map((ring) => [ring]),
          baseY: anchorPosition.y,
          height: 1,
          gridSchemaVersion: "vectoplan-parcel-grid-guide.v8",
          sourceCell: { x: anchorPosition.x, z: anchorPosition.z },
          logicalGridCellId: selectedGroup[0],
          boundarySegmentId,
          boundaryRow,
          boundaryColumn: primary.boundaryColumn ?? null,
          resolvedFrom: "clipped-grid-partition",
          gridAlignment: primary.gridAlignment ?? "boundary",
          ...(primary.gridAlignment === "lod2-building" && parcelGridBuildingReference ? {
            gridReferenceMode: "lod2-building",
            lod2BuildingId: parcelGridBuildingReference.buildingId,
            buildingGridRotationDegrees: parcelGridBuildingReference.rotationDegrees,
            buildingGridStepM: [parcelGridBuildingReference.stepU, parcelGridBuildingReference.stepV],
          } : {}),
        },
        occupiedCells: [anchorPosition],
        mergeKey: `parcel-grid:${parcelIds.join("+")}:${anchorPosition.y}:${boundarySegmentId}:${boundaryRow}:${wallAxisDegrees.toFixed(2)}`,
        anchorPosition,
      };
    };
    options.root.dataset.parcelGridTransitionMeters = (maximumSlantedDepth + 1).toFixed(3);
    options.root.dataset.parcelGridZoneCells = String(zoneCells.length);
    options.root.dataset.parcelGridSlantedCells = String(zoneCells.filter((cell) => cell.zone.startsWith("slanted-")).length);
    options.root.dataset.parcelGridTransitionTriangles = String(transitionTriangles.length);
    options.root.dataset.parcelGridBlockedCells = String(zoneCells.filter((cell) => cell.zone === "straight-clipped").length);
    group.visible = worldEditToolShowsParcelGuides(activeTool);
    scene.add(group);
    parcelGridGroup = group;
    const guideSignature = parcelGridGuide
      ? `${parcelGridGuide.parcelId}:${parcelGridGuide.start.join(":")}:${parcelGridGuide.end.join(":")}:${parcelGridGuide.depthMeters}`
      : "default";
    const geometrySignature = [
      parcelSelection.parcels.map((parcel) => parcel.parcelId).sort().join("|"),
      frame.storageOrigin.x,
      frame.storageOrigin.z,
      fixedPlaneY.toFixed(3),
      parcelGridInfluence,
      parcelGridMode,
      parcelGridSetback,
      guideSignature,
      parcelGridBuildingReference?.signature ?? "empty-parcel",
      minimumX,
      maximumX,
      minimumZ,
      maximumZ,
    ].join(";");
    commitParcelGridGeometrySignature(geometrySignature, "world-edit.parcel-grid-rebuilt");
  }

  function rebuildParcelScene(): void {
    disposeParcelGroup();
    publishParcelOverlay();
    if (parcelGridGuide && !parcelSelection.parcels.some((parcel) => parcel.parcelId === parcelGridGuide?.parcelId)) {
      parcelGridGuide = null;
    }
    const scene = options.sceneRuntime.getScene();
    if (!scene) return;

    const geodataOverlay = scene.getObjectByName("vectoplan_geodata_overlay_scene_group");
    const surfaceCellY = geodataOverlay?.userData.surfaceCellY instanceof Map
      ? geodataOverlay.userData.surfaceCellY as ReadonlyMap<string, number>
      : null;
    const fixedPlaneY = resolveParcelGridPlaneY(surfaceCellY);
    const surfaceY = (_x: number, _z: number): number => fixedPlaneY - 0.018;
    const drapedRingPoints = (ring: readonly [number, number][]): THREE.Vector3[] => {
      const result = ring.map(([x, z]) => new THREE.Vector3(x, fixedPlaneY, z));
      if (result.length > 0) result.push(result[0].clone());
      return result;
    };
    earthGrid = normalizedEarthGrid(geodataOverlay?.userData.earthGrid)
      ?? earthGrid
      ?? fallbackEarthGrid(parcelSelection.projectCoordinate);
    options.root.dataset.parcelGridRotationDegrees = parcelSelection.gridRotationDegrees.toFixed(6);
    if (!earthGrid || parcelSelection.parcels.length === 0) {
      disposeParcelGridGroup();
      commitParcelGridGeometrySignature("", "world-edit.parcel-grid-no-selection");
      return;
    }
    restoreParcelGridGuide(earthGrid);

    const group = new THREE.Group();
    group.name = "vectoplan_selected_parcel_surfaces";
    group.userData = {
      kind: "selected-parcel-surfaces",
      affectsVoxelState: false,
      affectsCollision: false,
      earthGridSchemaVersion: earthGrid.schemaVersion,
    };
    for (const parcel of parcelSelection.parcels) {
      for (const polygonValue of parcelPolygons(parcel)) {
        const rings = asArray(polygonValue);
        const localRings = rings.map((ringValue) => asArray(ringValue)
          .map((coordinate) => {
            const point = asArray(coordinate);
            return lonLatToWorld(
              Number(point[0]),
              Number(point[1]),
              earthGrid,
            );
          })
          .filter((point): point is [number, number] => point !== null));
        const exterior = localRings[0] ?? [];
        if (exterior.length < 3) continue;

        const shape = new THREE.Shape();
        exterior.forEach((point, index) => {
          if (index === 0) shape.moveTo(point[0], -point[1]);
          else shape.lineTo(point[0], -point[1]);
        });
        for (const hole of localRings.slice(1)) {
          if (hole.length < 3) continue;
          const path = new THREE.Path();
          hole.forEach((point, index) => {
            if (index === 0) path.moveTo(point[0], -point[1]);
            else path.lineTo(point[0], -point[1]);
          });
          shape.holes.push(path);
        }
        const fillGeometry = new THREE.ShapeGeometry(shape);
        const fillPositions = fillGeometry.getAttribute("position") as THREE.BufferAttribute;
        for (let vertex = 0; vertex < fillPositions.count; vertex += 1) {
          const x = fillPositions.getX(vertex);
          const worldZ = -fillPositions.getY(vertex);
          fillPositions.setZ(vertex, surfaceY(x, worldZ) + 0.012);
        }
        fillPositions.needsUpdate = true;
        fillGeometry.computeBoundingBox();
        fillGeometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(
          fillGeometry,
          new THREE.MeshBasicMaterial({
            color: 0x1687ff,
            transparent: true,
            opacity: 0.2,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 46;
        mesh.userData = { kind: "selected-parcel-fill", parcelId: parcel.parcelId };
        group.add(mesh);

        for (const ring of localRings) {
          if (ring.length < 2) continue;
          const points = drapedRingPoints(ring);
          if (points.length < 2) continue;
          const outline = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({
              color: 0x1265e5,
              transparent: true,
              opacity: 0.96,
              depthTest: true,
              depthWrite: false,
              toneMapped: false,
            }),
          );
          outline.renderOrder = 47;
          outline.userData = { kind: "selected-parcel-outline", parcelId: parcel.parcelId };
          group.add(outline);
        }
      }
    }
    if (group.children.length > 0) {
      group.visible = worldEditToolShowsParcelGuides(activeTool);
      scene.add(group);
      parcelGroup = group;
    }
    rebuildParcelGridScene();
    syncParcelGuideVisibility("world-edit.parcel-guides-rebuilt");
  }

  function rebuildSelectionScene(): void {
    disposeSelectionGroup();
    if (!selection.first || !selection.second) return;
    const scene = options.sceneRuntime.getScene();
    if (!scene) return;
    const selectionVisualization = activeSystem()?.behavior.selectionVisualization ?? "none";
    if (selectionVisualization === "none") return;
    if (selectionVisualization === "ruler") {
      const first = new THREE.Vector3(selection.first.x, selection.first.y, selection.first.z);
      const second = new THREE.Vector3(selection.second.x, selection.second.y, selection.second.z);
      const group = new THREE.Group();
      group.name = "vectoplan_world_edit_ruler";
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([first, second]),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, depthTest: false }),
      );
      line.renderOrder = 91;
      group.add(line);
      for (const point of [first, second]) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xf8fafc, depthTest: false }),
        );
        marker.position.copy(point);
        marker.renderOrder = 92;
        group.add(marker);
      }
      const label = createRulerDistanceLabel(first, second, options.sceneRuntime.getCamera());
      if (label) group.add(label);
      scene.add(group);
      selectionGroup = group;
      return;
    }
    const group = new THREE.Group();
    group.name = "vectoplan_world_edit_selection";
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const fill = new THREE.Mesh(boxGeometry, new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    fill.renderOrder = 70;
    group.add(fill);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeometry),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.95 }),
    );
    edges.renderOrder = 71;
    group.add(edges);
    const topGrid = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    topGrid.name = "vectoplan_world_edit_selection_top_grid";
    topGrid.renderOrder = 73;
    group.add(topGrid);

    if (selectionVisualization === "clipboard" && clipboardPhase === "move") {
      const previewRoot = new THREE.Group();
      previewRoot.name = "vectoplan_world_edit_clipboard_preview";
      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const entry of clipboard.slice(0, 8_192)) {
        const blockTypeId = safeString(entry.blockTypeId ?? entry.block_type_id, "");
        if (!blockTypeId) continue;
        const entries = grouped.get(blockTypeId) ?? [];
        entries.push(entry);
        grouped.set(blockTypeId, entries);
      }
      for (const [blockTypeId, entries] of grouped) {
        const instances = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.92, 0.92, 0.92),
          new THREE.MeshBasicMaterial({
            color: clipboardEntryColor(blockTypeId),
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
          entries.length,
        );
        const matrix = new THREE.Matrix4();
        entries.forEach((entry, index) => {
          matrix.makeTranslation(
            Number(entry.dx ?? 0) + 0.5,
            Number(entry.dy ?? 0) + 0.5,
            Number(entry.dz ?? 0) + 0.5,
          );
          instances.setMatrixAt(index, matrix);
        });
        instances.instanceMatrix.needsUpdate = true;
        instances.renderOrder = 75;
        previewRoot.add(instances);
      }
      group.add(previewRoot);
      clipboardPreviewRoot = previewRoot;
      const gizmoOrigin = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 14, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, toneMapped: false }),
      );
      gizmoOrigin.name = "vectoplan_world_edit_clipboard_gizmo_origin";
      gizmoOrigin.renderOrder = 96;
      group.add(gizmoOrigin);
      clipboardGizmoOrigin = gizmoOrigin;
      const axes: readonly Readonly<{ axis: WorldEditSelectionAxis; color: number; direction: THREE.Vector3 }>[] = [
        { axis: "x", color: 0xef4444, direction: new THREE.Vector3(1, 0, 0) },
        { axis: "y", color: 0x22c55e, direction: new THREE.Vector3(0, 1, 0) },
        { axis: "z", color: 0x3b82f6, direction: new THREE.Vector3(0, 0, 1) },
      ];
      for (const descriptor of axes) {
        const root = new THREE.Group();
        root.name = `vectoplan_world_edit_clipboard_gizmo_${descriptor.axis}`;
        const orientation = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          descriptor.direction,
        );
        const material = new THREE.MeshBasicMaterial({
          color: descriptor.color,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2, 10), material);
        shaft.position.copy(descriptor.direction).multiplyScalar(1.2);
        shaft.quaternion.copy(orientation);
        shaft.renderOrder = 96;
        const end = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), material);
        end.position.copy(descriptor.direction).multiplyScalar(2.35);
        end.renderOrder = 97;
        const hitArea = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 2.5, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
        );
        hitArea.position.copy(descriptor.direction).multiplyScalar(1.35);
        hitArea.quaternion.copy(orientation);
        hitArea.userData = { worldEditClipboardAxis: descriptor.axis };
        shaft.userData = { worldEditClipboardAxis: descriptor.axis };
        end.userData = { worldEditClipboardAxis: descriptor.axis };
        root.add(shaft, end, hitArea);
        group.add(root);
        clipboardHandles.push({
          axis: descriptor.axis,
          root,
          targets: [shaft, end, hitArea],
          material,
          color: descriptor.color,
        });
      }
    } else {
      const descriptors: Array<{ axis: WorldEditSelectionAxis; sign: -1 | 1 }> = [
        { axis: "x", sign: -1 }, { axis: "x", sign: 1 },
        { axis: "y", sign: -1 }, { axis: "y", sign: 1 },
        { axis: "z", sign: -1 }, { axis: "z", sign: 1 },
      ];
      for (const descriptor of descriptors) {
      const handleGeometry = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(
        handleGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x2563eb,
          transparent: true,
          opacity: 0.78,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      mesh.renderOrder = 90;
      mesh.userData = { worldEditHandle: true, axis: descriptor.axis, sign: descriptor.sign };
      const handleEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(handleGeometry),
        new THREE.LineBasicMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.96,
          depthTest: false,
          depthWrite: false,
        }),
      );
      handleEdges.renderOrder = 91;
      mesh.add(handleEdges);
      group.add(mesh);
      selectionHandles.push({ axis: descriptor.axis, sign: descriptor.sign, mesh });
      }
    }
    scene.add(group);
    selectionGroup = group;
    selectionBoxRuntime = { fill, edges, topGrid };
    updateSelectionScenePreview();
  }

  function updateSelectionScenePreview(): boolean {
    if (
      !selection.first
      || !selection.second
      || !selectionBoxRuntime
      || !["box", "clipboard"].includes(activeSystem()?.behavior.selectionVisualization ?? "none")
    ) return false;
    const bounds = resolveWorldEditSelectionBounds(selection.first, selection.second);
    const size = new THREE.Vector3(bounds.size.x, bounds.size.y, bounds.size.z);
    const center = new THREE.Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    selectionBoxRuntime.fill.position.copy(center);
    selectionBoxRuntime.fill.scale.copy(size);
    selectionBoxRuntime.edges.position.copy(center);
    selectionBoxRuntime.edges.scale.copy(size);

    const panelSize = (value: number): number => Math.min(3.2, Math.max(0.9, value * 0.55));
    for (const handle of selectionHandles) {
      const dimensions = handle.axis === "x"
        ? new THREE.Vector3(0.1, panelSize(size.y), panelSize(size.z))
        : handle.axis === "y"
          ? new THREE.Vector3(panelSize(size.x), 0.1, panelSize(size.z))
          : new THREE.Vector3(panelSize(size.x), panelSize(size.y), 0.1);
      handle.mesh.scale.copy(dimensions);
      handle.mesh.position.copy(center);
      // The resize panel belongs on the face itself. Keeping its centre on the
      // boundary avoids the detached blue plates visible on small selections.
      handle.mesh.position[handle.axis] += handle.sign * (size[handle.axis] / 2);
      handle.mesh.updateMatrixWorld();
    }
    if (clipboardPreviewRoot) clipboardPreviewRoot.position.set(
      bounds.minimum.x,
      bounds.minimum.y,
      bounds.minimum.z,
    );
    const gizmoScale = Math.max(0.85, Math.min(1.8, Math.max(size.x, size.y, size.z) / 10));
    if (clipboardGizmoOrigin) {
      clipboardGizmoOrigin.position.copy(center);
      clipboardGizmoOrigin.scale.setScalar(gizmoScale);
      clipboardGizmoOrigin.updateMatrixWorld(true);
    }
    for (const handle of clipboardHandles) {
      handle.root.position.copy(center);
      handle.root.scale.setScalar(gizmoScale);
      handle.root.updateMatrixWorld(true);
    }
    selectionBoxRuntime.topGrid.geometry.dispose();
    selectionBoxRuntime.topGrid.geometry = new THREE.BufferGeometry();
    selectionBoxRuntime.topGrid.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(worldEditSelectionTopGridSegments(bounds), 3),
    );
    selectionBoxRuntime.topGrid.geometry.computeBoundingSphere();
    options.root.dataset.selectionPreviewMode = "transform-only";
    options.root.dataset.selectionLiveBounds = [
      bounds.minimum.x, bounds.minimum.y, bounds.minimum.z,
      bounds.maximum.x, bounds.maximum.y, bounds.maximum.z,
    ].join(":");
    options.sceneRuntime.renderOnce("world-edit.selection-drag-preview");
    return true;
  }

  function refreshHud(): void {
    const title = panel.querySelector<HTMLElement>("[data-world-edit-title]");
    const first = panel.querySelector<HTMLOutputElement>("[data-selection-first]");
    const second = panel.querySelector<HTMLOutputElement>("[data-selection-second]");
    const material = panel.querySelector<HTMLElement>("[data-world-edit-material]");
    const parcelCount = panel.querySelector<HTMLElement>("[data-parcel-count]");
    const brushSettings = panel.querySelector<HTMLElement>("[data-brush-settings]");
    const coordinates = panel.querySelector<HTMLElement>("[data-selection-coordinates]");
    const rulerResult = panel.querySelector<HTMLElement>("[data-ruler-result]");
    const rulerDistance = panel.querySelector<HTMLOutputElement>("[data-ruler-distance]");
    const operationField = panel.querySelector<HTMLElement>("[data-selection-operation]");
    const materialField = panel.querySelector<HTMLElement>(".editor-world-edit__material");
    const maskField = panel.querySelector<HTMLElement>(".editor-world-edit__mask");
    const clipboardStatus = panel.querySelector<HTMLElement>("[data-clipboard-status]");
    const clipboardCount = panel.querySelector<HTMLElement>("[data-clipboard-count]");
    const hint = panel.querySelector<HTMLElement>("[data-world-edit-hint]");
    const placement = selectedPlacement();
    const system = activeSystem();
    const ui = system?.ui;
    const planningRoom = isBuildingLineBrush() && activeTool === "room";
    const planningRoad = activeTool === "tentacle";
    if (title) title.textContent = planningRoom
      ? "Linien-Brush Gebäude"
      : planningRoad ? "Tentacle Straße" : ui?.title ?? "WorldEdit";
    if (first) first.textContent = positionLabel(selection.first);
    if (second) second.textContent = positionLabel(selection.second);
    if (material) material.textContent = operation === "clear" ? "Luft / entfernen" : placement.label ?? placement.runtimeBlockTypeId ?? "Hotbar auswählen";
    if (parcelCount) parcelCount.textContent = `${parcelSelection.parcels.length} Grundstück${parcelSelection.parcels.length === 1 ? "" : "e"}`;
    options.root.dataset.parcelCatalogCount = String(parcelSelection.availableParcels.length);
    options.root.dataset.parcelSelectionCount = String(parcelSelection.parcels.length);
    if (brushSettings) brushSettings.hidden = !(ui?.showBrushSettings ?? false);
    if (coordinates) coordinates.hidden = !(ui?.showCoordinates ?? false);
    if (rulerResult) rulerResult.hidden = !(ui?.showRulerResult ?? false);
    const distance = measurementMetres(selection);
    if (rulerDistance) rulerDistance.textContent = distance === null ? "–" : `${distance.toFixed(2)} m`;
    if (operationField) operationField.hidden = !(ui?.showOperation ?? false);
    if (materialField) materialField.hidden = !(ui?.showMaterial ?? false);
    if (maskField) maskField.hidden = !(ui?.showMask ?? false);
    if (executeButton) executeButton.hidden = !(ui?.showExecute ?? false);
    if (resetButton) resetButton.textContent = planningRoom
      ? "Baufläche löschen"
      : planningRoad ? "Straßenpfad löschen" : ui?.resetLabel ?? "Ziel löschen";
    if (clipboardStatus) clipboardStatus.hidden = !(ui?.showClipboardStatus ?? false);
    if (clipboardCount) clipboardCount.textContent = `${clipboard.length} Zelle${clipboard.length === 1 ? "" : "n"}`;
    if (operationSelect) operationSelect.value = operation;
    if (hint) hint.textContent = planningRoom
      ? "Gerade Segmente anklicken; ESC/Enter erzeugt einen breiten, editierbaren Gebäude-Korridor. Punkte passen die Kontur an, die Raute verschiebt alles."
      : planningRoad
        ? `Tentacle-Kernlogik als Straßenkorridor. [A] Auffüllung / [B] Brücke, aktuell: ${planningRoadConflictChoice === "bridge" ? "Brücke" : "Auffüllung"}; Bergdurchstöße werden automatisch als Tunnel markiert.`
        : ui?.hint ?? "WorldEdit-Werkzeug auswählen.";
    const radiusOutput = panel.querySelector<HTMLOutputElement>("[data-brush-radius-output]");
    const densityOutput = panel.querySelector<HTMLOutputElement>("[data-brush-density-output]");
    const wallOutput = panel.querySelector<HTMLOutputElement>("[data-brush-wall-output]");
    if (radiusOutput && brushRadius) radiusOutput.textContent = brushRadius.value;
    if (densityOutput && brushDensity) densityOutput.textContent = `${brushDensity.value}%`;
    if (wallOutput && brushWall) wallOutput.textContent = brushWall.value;
    panel.dataset.tool = activeTool ?? "none";
    publishInventoryState();
  }

  function selectionHandlePointerCoordinate(state: SelectionHandleDragState): number | null {
    const camera = options.sceneRuntime.getCamera();
    if (!camera) return null;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const normal = new THREE.Vector3(...state.dragPlaneNormal);
    const planePoint = new THREE.Vector3(...state.dragPlanePoint);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planePoint);
    const hitPoint = new THREE.Ray(camera.position.clone(), direction).intersectPlane(plane, new THREE.Vector3());
    const coordinate = hitPoint?.[state.axis];
    return Number.isFinite(coordinate) ? coordinate! : null;
  }

  function adjustSelectionHandle(action: "primary" | "secondary"): boolean {
    if (!selection.first || !selection.second || selectionHandles.length === 0) return false;
    const camera = options.sceneRuntime.getCamera();
    if (!camera) return false;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const hit = raycaster.intersectObjects(selectionHandles.map((item) => item.mesh), false)[0];
    if (!hit) return false;
    const handle = selectionHandles.find((item) => item.mesh === hit.object);
    if (!handle) return false;
    if (action === "primary") {
      stopSelectionDrag();
      const bounds = resolveWorldEditSelectionBounds(selection.first, selection.second);
      const axisVector = new THREE.Vector3(
        handle.axis === "x" ? 1 : 0,
        handle.axis === "y" ? 1 : 0,
        handle.axis === "z" ? 1 : 0,
      );
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const dragPlaneNormal = camera.position.clone().sub(hit.point)
        .addScaledVector(axisVector, -camera.position.clone().sub(hit.point).dot(axisVector));
      if (dragPlaneNormal.lengthSq() <= 1e-8) {
        dragPlaneNormal.copy(direction).addScaledVector(axisVector, -direction.dot(axisVector));
      }
      if (dragPlaneNormal.lengthSq() <= 1e-8) {
        dragPlaneNormal.set(handle.axis === "x" ? 0 : 1, handle.axis === "y" ? 0 : 1, 0);
      }
      dragPlaneNormal.normalize();
      selectionHandleDrag = {
        axis: handle.axis,
        sign: handle.sign,
        initialBounds: bounds,
        initialPointerCoordinate: hit.point[handle.axis],
        dragPlaneNormal: [dragPlaneNormal.x, dragPlaneNormal.y, dragPlaneNormal.z],
        dragPlanePoint: [hit.point.x, hit.point.y, hit.point.z],
      };
      selectionDragging = true;
      selectionDragPlaneY = bounds.center.y;
      selectionDragSignature = "";
      selectionDragFrame = requestAnimationFrame(trackSelectionDrag);
      setStatus(`Die ${handle.axis.toUpperCase()}-Fläche folgt dem Fadenkreuz jetzt blockweise und live. Linksklick zum Abschließen loslassen.`, "ready");
      return true;
    }
    const bounds = resolveWorldEditSelectionBounds(selection.first, selection.second);
    const min = { ...bounds.minimum };
    const max = { ...bounds.maximum };
    const delta = -handle.sign;
    if (handle.sign < 0) min[handle.axis] = Math.min(max[handle.axis], min[handle.axis] + delta);
    else max[handle.axis] = Math.max(min[handle.axis], max[handle.axis] + delta);
    selection = { first: min, second: max };
    rebuildSelectionScene();
    refreshHud();
    setStatus("Auswahl über Flächenpunkt angepasst.", "ready");
    return true;
  }

  function configureOperationSelect(tool: WorldEditTool): void {
    if (!operationSelect) return;
    const operations = systemRegistry?.get(tool).ui.operations ?? [];
    const clipboardMode = operations.includes("copy");
    const desiredMode = clipboardMode ? "clipboard" : "world";
    if (operationSelect.dataset.mode !== desiredMode) {
      operationSelect.innerHTML = clipboardMode
        ? '<option value="copy">Kopieren</option><option value="cut">Ausschneiden</option><option value="paste">Einfügen</option>'
        : '<option value="set">Setzen</option><option value="wall">Wände</option><option value="fill">Nur Luft füllen</option><option value="replace">Ersetzen</option><option value="clear">Leeren</option>';
      operationSelect.dataset.mode = desiredMode;
    }
    if (clipboardMode && !["copy", "cut", "paste"].includes(operation)) operation = "copy";
    if (!clipboardMode && !["set", "wall", "fill", "replace", "clear"].includes(operation)) operation = "set";
    operationSelect.value = operation;
  }

  function stopSelectionDrag(): void {
    selectionDragging = false;
    selectionHandleDrag = null;
    selectionDragPlaneY = null;
    selectionDragSignature = "";
    if (selectionDragFrame) cancelAnimationFrame(selectionDragFrame);
    selectionDragFrame = 0;
  }

  function applySelectionHandlePointer(): boolean {
    if (!selectionHandleDrag) return false;
    const pointerCoordinate = selectionHandlePointerCoordinate(selectionHandleDrag);
    if (pointerCoordinate === null) return false;
    const next = snapWorldEditSelectionHandle({
      initialBounds: selectionHandleDrag.initialBounds,
      axis: selectionHandleDrag.axis,
      sign: selectionHandleDrag.sign,
      initialPointerCoordinate: selectionHandleDrag.initialPointerCoordinate,
      pointerCoordinate,
    });
    selection = { first: next.minimum, second: next.maximum };
    return true;
  }

  function currentSelectionDragTarget(): ChunkApiWorldPosition | null {
    if (!selection.first) return null;
    const latest = cellPosition(options.sceneRuntime.getTargetCells().placementCell);
    const planeY = selectionDragPlaneY ?? selection.first.y + 0.5;
    const projected = worldPositionAtCameraPlane(planeY, latest, 1_200);
    if (!projected) return latest ?? selection.second;
    return {
      x: projected.x,
      y: latest?.y ?? selection.second?.y ?? selection.first.y,
      z: projected.z,
    };
  }

  function updateSelectionDrag(): void {
    if (!selectionDragging || !selection.first) return;
    if (selectionHandleDrag) {
      if (!applySelectionHandlePointer()) return;
    } else if (activeSystem()?.behavior.selectionDragMode === "ruler") {
      const latest = currentRulerTarget();
      if (!latest) return;
      selection = { first: selection.first, second: latest };
    } else if (activeSystem()?.behavior.selectionDragMode === "box") {
      const latest = currentSelectionDragTarget();
      if (!latest) return;
      selection = { first: selection.first, second: latest };
    } else {
      return;
    }
    const signature = selection.first && selection.second
      ? `${selection.first.x}:${selection.first.y}:${selection.first.z}:${selection.second.x}:${selection.second.y}:${selection.second.z}`
      : "";
    if (signature === selectionDragSignature) return;
    selectionDragSignature = signature;
    if (!updateSelectionScenePreview()) rebuildSelectionScene();
    refreshHud();
  }

  function trackSelectionDrag(): void {
    if (!selectionDragging) return;
    updateSelectionDrag();
    selectionDragFrame = requestAnimationFrame(trackSelectionDrag);
  }

  function startSelectionDrag(position: ChunkApiWorldPosition): void {
    stopSelectionDrag();
    selection = { first: position, second: position };
    selectionDragging = true;
    selectionDragPlaneY = position.y + 0.5;
    selectionDragSignature = "";
    rebuildSelectionScene();
    refreshHud();
    selectionDragFrame = requestAnimationFrame(trackSelectionDrag);
  }

  function clipboardAxisVector(axis: WorldEditSelectionAxis): THREE.Vector3 {
    return axis === "x"
      ? new THREE.Vector3(1, 0, 0)
      : axis === "y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  }

  function clipboardHandleUnderCrosshair(): ClipboardHandleDescriptor | null {
    const camera = options.sceneRuntime.getCamera();
    if (!camera || clipboardHandles.length === 0) return null;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const targets = clipboardHandles.flatMap((handle) => handle.targets);
    const hit = raycaster.intersectObjects(targets, false)[0];
    const axis = hit?.object.userData.worldEditClipboardAxis;
    return clipboardHandles.find((handle) => handle.axis === axis) ?? null;
  }

  function setClipboardHoveredAxis(axis: WorldEditSelectionAxis | null): void {
    if (clipboardHoveredAxis === axis) return;
    clipboardHoveredAxis = axis;
    for (const handle of clipboardHandles) {
      handle.material.color.setHex(handle.axis === axis ? 0xfacc15 : handle.color);
    }
    options.sceneRuntime.renderOnce("world-edit.clipboard-gizmo-hover");
  }

  function trackClipboardGizmoHover(): void {
    if (clipboardPhase !== "move" || !["copy-paste", "cut-paste"].includes(activeTool ?? "")) {
      clipboardHoverFrame = 0;
      return;
    }
    setClipboardHoveredAxis(clipboardMoveAxis ?? clipboardHandleUnderCrosshair()?.axis ?? null);
    clipboardHoverFrame = requestAnimationFrame(trackClipboardGizmoHover);
  }

  function startClipboardGizmoHover(): void {
    if (clipboardHoverFrame) cancelAnimationFrame(clipboardHoverFrame);
    clipboardHoverFrame = requestAnimationFrame(trackClipboardGizmoHover);
  }

  function stopClipboardGizmoHover(): void {
    if (clipboardHoverFrame) cancelAnimationFrame(clipboardHoverFrame);
    clipboardHoverFrame = 0;
    setClipboardHoveredAxis(null);
  }

  function clipboardDragCoordinate(
    camera: THREE.Camera,
    plane: THREE.Plane,
    axis: WorldEditSelectionAxis,
  ): number | null {
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    return hit ? hit.dot(clipboardAxisVector(axis)) : null;
  }

  function createClipboardDragPlane(
    camera: THREE.Camera,
    axis: WorldEditSelectionAxis,
    origin: THREE.Vector3,
  ): THREE.Plane | null {
    const axisVector = clipboardAxisVector(axis);
    const viewDirection = new THREE.Vector3();
    camera.getWorldDirection(viewDirection);
    const normal = viewDirection.clone().sub(axisVector.clone().multiplyScalar(viewDirection.dot(axisVector)));
    if (normal.lengthSq() < 1e-6) {
      const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      normal.copy(cameraUp.sub(axisVector.clone().multiplyScalar(cameraUp.dot(axisVector))));
    }
    if (normal.lengthSq() < 1e-6) return null;
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), origin);
  }

  function updateClipboardMoveDrag(): void {
    if (
      !clipboardMoveDragging
      || !clipboardSize
      || !clipboardMoveAxis
      || !clipboardMoveStartAnchor
      || !clipboardMovePlane
    ) return;
    const camera = options.sceneRuntime.getCamera();
    if (!camera) return;
    const coordinate = clipboardDragCoordinate(camera, clipboardMovePlane, clipboardMoveAxis);
    if (coordinate === null) return;
    const delta = Math.round(coordinate - clipboardMoveStartCoordinate);
    const anchor = clipboardAnchorAlongAxis(clipboardMoveStartAnchor, clipboardMoveAxis, delta);
    if (clipboardAnchor && anchor.x === clipboardAnchor.x && anchor.y === clipboardAnchor.y && anchor.z === clipboardAnchor.z) return;
    clipboardAnchor = anchor;
    selection = clipboardBoundsAt(anchor, clipboardSize);
    if (!updateSelectionScenePreview()) rebuildSelectionScene();
    refreshHud();
    setStatus(`${clipboardMoveAxis.toUpperCase()}-Achse: ${delta >= 0 ? "+" : ""}${delta} Block${Math.abs(delta) === 1 ? "" : "e"}. Linksklick loslassen fixiert die Vorschau.`, "ready");
  }

  function trackClipboardMove(): void {
    if (!clipboardMoveDragging) return;
    updateClipboardMoveDrag();
    clipboardMoveFrame = requestAnimationFrame(trackClipboardMove);
  }

  function stopClipboardMove(): void {
    clipboardMoveDragging = false;
    if (clipboardMoveFrame) cancelAnimationFrame(clipboardMoveFrame);
    clipboardMoveFrame = 0;
    clipboardMoveAxis = null;
    clipboardMoveStartAnchor = null;
    clipboardMovePlane = null;
    clipboardMoveStartCoordinate = 0;
  }

  function startClipboardMove(): boolean {
    if (clipboardPhase !== "move" || !clipboardAnchor || clipboardHandles.length === 0) return false;
    const camera = options.sceneRuntime.getCamera();
    const handle = clipboardHandleUnderCrosshair();
    if (!camera || !handle) {
      setStatus("Bitte die rote X-, grüne Y- oder blaue Z-Achse des Verschiebegizmos anvisieren und Linksklick halten.", "warning");
      return false;
    }
    const bounds = selection.first && selection.second
      ? resolveWorldEditSelectionBounds(selection.first, selection.second)
      : null;
    if (!bounds) return false;
    const origin = new THREE.Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    const plane = createClipboardDragPlane(camera, handle.axis, origin);
    const coordinate = plane ? clipboardDragCoordinate(camera, plane, handle.axis) : null;
    if (!plane || coordinate === null) {
      setStatus("Die gewählte Achse liegt nahezu in Blickrichtung. Kamera leicht seitlich drehen und erneut ziehen.", "warning");
      return false;
    }
    stopClipboardMove();
    clipboardMoveAxis = handle.axis;
    clipboardMoveStartAnchor = { ...clipboardAnchor };
    clipboardMovePlane = plane;
    clipboardMoveStartCoordinate = coordinate;
    clipboardMoveDragging = true;
    setClipboardHoveredAxis(handle.axis);
    clipboardMoveFrame = requestAnimationFrame(trackClipboardMove);
    setStatus(`${handle.axis.toUpperCase()}-Achse aktiv: Linksklick halten und mit der Kamera blockweise verschieben.`, "ready");
    return true;
  }

  function beginClipboardPreview(): void {
    if (!selection.first || !selection.second || clipboard.length === 0) return;
    const bounds = resolveWorldEditSelectionBounds(selection.first, selection.second);
    clipboardSize = clipboardSelectionSize(bounds.minimum, bounds.maximum);
    clipboardAnchor = { ...bounds.minimum };
    clipboardPhase = "move";
    options.root.dataset.worldEditClipboardPhase = clipboardPhase;
    options.root.dataset.worldEditClipboardCells = String(clipboard.length);
    selection = clipboardBoundsAt(clipboardAnchor, clipboardSize);
    rebuildSelectionScene();
    options.root.dataset.worldEditClipboardGizmoHandles = String(clipboardHandles.length);
    startClipboardGizmoHover();
    refreshHud();
  }

  function resetClipboardPreview(): void {
    stopSelectionDrag();
    stopClipboardMove();
    stopClipboardGizmoHover();
    clipboardPhase = "select";
    options.root.dataset.worldEditClipboardPhase = clipboardPhase;
    options.root.dataset.worldEditClipboardCells = "0";
    options.root.dataset.worldEditClipboardGizmoHandles = "0";
    clipboardSize = null;
    clipboardAnchor = null;
    clipboard = [];
    selection = { first: null, second: null };
    rebuildSelectionScene();
    refreshHud();
  }

  function parcelMaskPayload(): Record<string, unknown> {
    return {
      enabled: parcelMaskInput?.checked === true,
      coordinateSpace: "wgs84",
      coveragePolicy: "cell-contained",
      projectPublicId: parcelSelection.projectPublicId,
      projectCoordinate: parcelSelection.projectCoordinate,
      gridRotationDegrees: parcelSelection.gridRotationDegrees,
      parcels: parcelSelection.parcels,
    };
  }

  function clipboardParcelMaskPayload(): Record<string, unknown> {
    return {
      ...parcelMaskPayload(),
      enabled: clipboardParcelMaskEnabled(
        parcelMaskInput?.checked,
        parcelSelection.parcels.length,
      ),
      parcels: [],
    };
  }

  function broadcastParcelSelection(): void {
    parcelSelection.parcelGridState = serializedParcelGridState();
    try {
      window.parent?.postMessage({
        type: PARCEL_CHANGED,
        kind: PARCEL_CHANGED,
        source: "vectoplan-editor",
        detail: {
          projectPublicId: parcelSelection.projectPublicId,
          coordinateSpace: "wgs84",
          coveragePolicy: "cell-contained",
          revision: parcelSelection.revision,
          projectCoordinate: parcelSelection.projectCoordinate,
          projectCoordinateManualOverride: parcelSelection.projectCoordinateManualOverride,
          gridRotationDegrees: parcelSelection.gridRotationDegrees,
          parcels: parcelSelection.parcels,
          parcelGridState: parcelSelection.parcelGridState,
        },
      }, "*");
    } catch { /* bridge is best effort */ }
  }

  function postParcelSelection(): void {
    parcelSelection.revision += 1;
    parcelSelection.gridRotationDegrees = dominantGridRotationDegrees(
      parcelSelection.parcels,
      parcelSelection.projectCoordinate?.latitude ?? 0,
    );
    rebuildParcelScene();
    broadcastParcelSelection();
  }

  function persistParcelGridState(): void {
    parcelSelection.revision += 1;
    broadcastParcelSelection();
  }

  function publishParcelOverlay(): void {
    try {
      window.dispatchEvent(new CustomEvent(PARCEL_OVERLAY_SYNC, {
        detail: {
          projectPublicId: parcelSelection.projectPublicId,
          revision: parcelSelection.revision,
          projectCoordinate: parcelSelection.projectCoordinate,
          projectCoordinateManualOverride: parcelSelection.projectCoordinateManualOverride,
          gridRotationDegrees: parcelSelection.gridRotationDegrees,
          parcels: parcelSelection.parcels,
          adjacentParcels: parcelSelection.adjacentParcels,
          availableParcels: parcelSelection.availableParcels,
          parcelGridState: parcelSelection.parcelGridState,
        },
      }));
    } catch { /* internal map overlay remains optional */ }
  }

  function setParcelAt(
    position: ChunkApiWorldPosition,
    targetPoint?: Readonly<{ x: number; z: number }> | null,
    action: "select" | "remove" = "select",
  ): boolean {
    const frame = earthGrid ?? fallbackEarthGrid(parcelSelection.projectCoordinate);
    const lonLat = targetPoint
      ? worldPointToLonLat(targetPoint.x, targetPoint.z, frame)
      : worldToLonLat(position, frame);
    if (!lonLat) {
      setStatus("Die Projektkoordinate ist noch nicht mit dem Editor synchronisiert.", "warning");
      return false;
    }
    // Exact containment is authoritative. A narrow boundary tolerance is only
    // a fallback for clicks directly on the cadastral line; keeping it small
    // prevents the neighbouring parcel from being selected accidentally.
    const selectedHit = bestParcelHit(parcelSelection.parcels, lonLat)
      ?? bestParcelHit(parcelSelection.parcels, lonLat, 0.2);
    const catalogHit = bestParcelHit(
      [...parcelSelection.availableParcels, ...parcelSelection.adjacentParcels],
      lonLat,
    ) ?? bestParcelHit(
      [...parcelSelection.availableParcels, ...parcelSelection.adjacentParcels],
      lonLat,
      0.2,
    );
    const hit = action === "remove" ? selectedHit : catalogHit ?? selectedHit;
    if (hit) {
      const selected = parcelSelection.parcels.some((parcel) => parcel.parcelId === hit.parcelId);
      if (action === "select" && selected) {
        setStatus("Flurstück ist bereits ausgewählt.", "ready");
        return true;
      }
      // Never discard the only geometry copy when deselecting. The Map frame
      // may still be loading (or may just have been replaced after CAD), so the
      // editor must be able to select the same parcel again on the next click.
      parcelSelection.availableParcels = normalizedParcelItems([
        hit,
        ...parcelSelection.availableParcels,
      ], 512);
      parcelSelection.parcels = action === "remove"
        ? parcelSelection.parcels.filter((parcel) => parcel.parcelId !== hit.parcelId)
        : normalizedParcelItems([...parcelSelection.parcels, hit], 64);
      postParcelSelection();
      refreshHud();
      setStatus(action === "remove" ? "Flurstück abgewählt." : "Flurstück ausgewählt.", "ready");
      return true;
    }
    setStatus(
      action === "remove"
        ? "An diesem Ziel ist kein ausgewähltes Flurstück."
        : "An diesem Ziel ist noch kein synchronisiertes Flurstück verfügbar. Bitte zuerst in Map auswählen.",
      "warning",
    );
    return false;
  }

  function selectParcelGridAt(
    position: ChunkApiWorldPosition,
    exactTarget?: Readonly<{ x: number; y: number; z: number }> | null,
  ): boolean {
    const frame = earthGrid ?? fallbackEarthGrid(parcelSelection.projectCoordinate);
    if (!frame || parcelSelection.parcels.length === 0) {
      setStatus("Bitte zuerst mindestens ein Grundstück auswählen.", "warning");
      return false;
    }
    const target: readonly [number, number] = exactTarget
      ? [exactTarget.x, exactTarget.z]
      : [position.x + 0.5, position.z + 0.5];
    let best: {
      parcel: ParcelSelectionItem;
      start: [number, number];
      end: [number, number];
      distance: number;
      factor: number;
    } | null = null;
    for (const parcel of parcelSelection.parcels) {
      for (const polygonValue of parcelPolygons(parcel)) {
        for (const ringValue of asArray(polygonValue)) {
          const ring = asArray(ringValue)
            .map((coordinate) => {
              const point = asArray(coordinate);
              return lonLatToWorld(Number(point[0]), Number(point[1]), frame);
            })
            .filter((point): point is [number, number] => point !== null);
          for (let index = 1; index < ring.length; index += 1) {
            const start = ring[index - 1];
            const end = ring[index];
            const dx = end[0] - start[0];
            const dz = end[1] - start[1];
            const lengthSquared = dx * dx + dz * dz;
            if (lengthSquared < 1e-8) continue;
            const factor = Math.max(0, Math.min(1,
              ((target[0] - start[0]) * dx + (target[1] - start[1]) * dz) / lengthSquared,
            ));
            const nearestX = start[0] + dx * factor;
            const nearestZ = start[1] + dz * factor;
            const distance = Math.hypot(target[0] - nearestX, target[1] - nearestZ);
            if (!best || distance < best.distance) best = { parcel, start, end, distance, factor };
          }
        }
      }
    }
    if (!best) {
      setStatus("Keine verwertbare Grundstückskante gefunden.", "warning");
      return false;
    }
    const dx = best.end[0] - best.start[0];
    const dz = best.end[1] - best.start[1];
    const length = Math.hypot(dx, dz);
    let inward: [number, number] = [-dz / length, dx / length];
    const midpoint: [number, number] = [
      (best.start[0] + best.end[0]) / 2,
      (best.start[1] + best.end[1]) / 2,
    ];
    const probe = worldPointToLonLat(midpoint[0] + inward[0] * 0.2, midpoint[1] + inward[1] * 0.2, frame);
    if (!probe || !parcelContainsLonLat(best.parcel, probe)) inward = [-inward[0], -inward[1]];
    const guideKey = parcelGridWorldGuideKey(best.parcel.parcelId, best.start, best.end, frame);
    const sameSelectedEdge = parcelGridGuide?.guideKey === guideKey;
    const maximumDepth = resolveParcelGridMaximumDepth({
      points: parcelWorldGridPoints(best.parcel, frame),
      start: best.start,
      inward,
      minimumDepth: PARCEL_GRID_MIN_DRAG_DEPTH_CELLS,
      maximumDepth: PARCEL_GRID_MAX_DRAG_DEPTH_CELLS,
      paddingCells: PARCEL_GRID_DRAG_DEPTH_PADDING_CELLS,
    });
    const requestedDepth = sameSelectedEdge
      ? parcelGridGuide!.depthMeters
      : persistedParcelGridGuides.get(guideKey)?.depthMeters
        ?? Math.max(1, Math.min(PARCEL_GRID_MAX_DRAG_DEPTH_CELLS, Math.round(parcelGridInfluence)));
    const depthMeters = Math.max(0, Math.min(maximumDepth, requestedDepth));
    parcelGridHandleAlong = Math.max(0.04, Math.min(0.96, best.factor));
    parcelGridGuide = {
      guideKey,
      parcelId: best.parcel.parcelId,
      start: best.start,
      end: best.end,
      inward,
      depthMeters,
    };
    activeParcelGridGuideKey = guideKey;
    rememberParcelGridGuide(frame);
    rebuildParcelGridScene();
    persistParcelGridState();
    const angle = normalizeGridRotation(Math.atan2(dz, dx) * 180 / Math.PI);
    setStatus(
      parcelGridBuildingReference
        ? `Bestandsraster: LoD2-Gebäude ${parcelGridBuildingReference.widthM.toFixed(1)} × ${parcelGridBuildingReference.depthM.toFixed(1)} m · Gebäudeachse ${parcelGridBuildingReference.rotationDegrees.toFixed(1)}°. Grundstücksrand ${angle.toFixed(1)}° gewählt.`
        : `Leeres Grundstück: Bauachse ${angle.toFixed(1)}° · Schrägzone ${depthMeters} Blöcke tief. Den Doppelpfeil anvisieren, Linksklick halten und ziehen.`,
      "ready",
    );
    return true;
  }

  function parcelGridPointerDepth(): number | null {
    if (!parcelGridGuide) return null;
    const point = cameraPointAtPlaneY(resolveParcelGridPlaneY(null), 1_200);
    if (!point) return null;
    return (point.x - parcelGridGuide.start[0]) * parcelGridGuide.inward[0]
      + (point.z - parcelGridGuide.start[1]) * parcelGridGuide.inward[1];
  }

  function updateParcelGridDragPreview(guide: ParcelGridGuide): void {
    const runtime = parcelGridHandleRuntimes.get(guide.guideKey);
    if (!runtime) return;
    const depth = guide.depthMeters;
    const preview = resolveParcelGridGuidePreview({
      start: runtime.start,
      end: runtime.end,
      inward: runtime.inward,
      depth,
      handleAlong: runtime.along,
    });
    runtime.linePositions.setXYZ(
      runtime.lineVertexOffset,
      preview.lineStart[0],
      runtime.planeY,
      preview.lineStart[1],
    );
    runtime.linePositions.setXYZ(
      runtime.lineVertexOffset + 1,
      preview.lineEnd[0],
      runtime.planeY,
      preview.lineEnd[1],
    );
    runtime.linePositions.clearUpdateRanges();
    runtime.linePositions.addUpdateRange(runtime.lineVertexOffset * 3, 6);
    runtime.linePositions.needsUpdate = true;
    runtime.group.position.set(preview.handle[0], runtime.planeY + 0.22, preview.handle[1]);
    runtime.currentDepthMeters = depth;
    options.root.dataset.parcelGridLiveDepth = String(depth);
    options.sceneRuntime.renderOnce("world-edit.parcel-grid-drag-preview");
  }

  function stopParcelGridDrag(commit: boolean): void {
    if (!parcelGridDragging) return;
    const dragState = parcelGridDragState;
    parcelGridDragging = false;
    parcelGridDragState = null;
    if (parcelGridDragFrame) cancelAnimationFrame(parcelGridDragFrame);
    parcelGridDragFrame = 0;
    delete options.root.dataset.parcelGridLiveDepth;
    if (commit && parcelGridGuide) {
      rememberParcelGridGuide();
      persistParcelGridState();
      rebuildParcelGridScene();
      refreshHud();
      setStatus(`Innere Schräglinie auf ${parcelGridGuide.depthMeters} Blockschritte gesetzt.`, "ready");
    } else if (dragState && parcelGridGuide) {
      parcelGridGuide = { ...parcelGridGuide, depthMeters: dragState.initialDepthMeters };
      updateParcelGridDragPreview(parcelGridGuide);
      delete options.root.dataset.parcelGridLiveDepth;
    }
  }

  function updateParcelGridDrag(): void {
    if (!parcelGridDragging || !parcelGridGuide || !parcelGridDragState) return;
    const pointerDepth = parcelGridPointerDepth();
    if (pointerDepth !== null) {
      const nextDepth = snapParcelGridDragDepth({
        initialDepth: parcelGridDragState.initialDepthMeters,
        initialPointerDepth: parcelGridDragState.initialPointerDepthMeters,
        pointerDepth,
        minimumDepth: 0,
        maximumDepth: parcelGridDragState.maximumDepthMeters,
      });
      if (nextDepth !== parcelGridGuide.depthMeters) {
        parcelGridGuide = { ...parcelGridGuide, depthMeters: nextDepth };
        updateParcelGridDragPreview(parcelGridGuide);
        setStatus(`Schrägzone: ${nextDepth} Blöcke · beim Ziehen live aktualisiert`, "ready");
      }
    }
    parcelGridDragFrame = requestAnimationFrame(updateParcelGridDrag);
  }

  function startParcelGridDrag(): boolean {
    if (parcelGridHandleTargets.length === 0) return false;
    const camera = options.sceneRuntime.getCamera();
    if (!camera) return false;
    const raycaster = new THREE.Raycaster();
    setWorkspacePointerRay(raycaster, camera, 1_200);
    const hit = raycaster.intersectObjects(parcelGridHandleTargets, false)[0];
    if (!hit) return false;
    const guideKey = safeString(hit.object.userData.parcelGridGuideKey, "");
    const runtime = parcelGridHandleRuntimes.get(guideKey);
    if (!runtime) return false;
    parcelGridHandleAlong = runtime.along;
    parcelGridGuide = {
      guideKey,
      parcelId: runtime.parcelId,
      start: runtime.start,
      end: runtime.end,
      inward: runtime.inward,
      depthMeters: runtime.currentDepthMeters,
    };
    activeParcelGridParcelId = runtime.parcelId;
    activeParcelGridGuideKey = guideKey;
    const pointerDepth = parcelGridPointerDepth();
    if (pointerDepth === null) return false;
    stopParcelGridDrag(false);
    parcelGridDragState = {
      guideKey,
      initialDepthMeters: parcelGridGuide.depthMeters,
      initialPointerDepthMeters: pointerDepth,
      maximumDepthMeters: runtime.maximumDepthMeters,
    };
    parcelGridDragging = true;
    parcelGridDragFrame = requestAnimationFrame(updateParcelGridDrag);
    setStatus(`Doppelpfeil gegriffen. Blockweise ziehen; für diese Kante sind bis zu ${runtime.maximumDepthMeters} Blöcke möglich.`, "ready");
    return true;
  }

  function moveParcelGridInnerLineOutward(): boolean {
    if (!parcelGridGuide) {
      setStatus("Bitte zuerst mit Linksklick eine Grundstückskante auswählen.", "warning");
      return false;
    }
    const depthMeters = Math.max(0, Math.round(parcelGridGuide.depthMeters) - 1);
    parcelGridGuide = { ...parcelGridGuide, depthMeters };
    rememberParcelGridGuide();
    rebuildParcelGridScene();
    persistParcelGridState();
    refreshHud();
    setStatus(`Innere Schräglinie auf ${depthMeters} m nach außen verschoben.`, "ready");
    return true;
  }

  async function executeAt(
    target?: ChunkApiWorldPosition | null,
    forcedOperation?: WorldEditOperation,
    overrides?: Readonly<{
      commandTool?: "selection" | "paint" | "sculpt";
      blockTypeId?: string | null;
      brush?: Readonly<Record<string, unknown>>;
      commandMetadata?: Readonly<Record<string, unknown>>;
      onComplete?: (succeeded: boolean) => void;
    }>,
  ): Promise<void> {
    let completionReported = false;
    const reportCompletion = (succeeded: boolean): void => {
      if (completionReported) return;
      completionReported = true;
      try { overrides?.onComplete?.(succeeded); } catch { /* observer only */ }
    };
    if (busy) return;
    const behavior = activeSystem()?.behavior;
    const commandTool = overrides?.commandTool ?? behavior?.commandTool;
    if (!behavior || !commandTool) return;
    const effectiveOperation = forcedOperation ?? operation;
    const placement = selectedPlacement();
    const effectiveBlockTypeId = overrides?.blockTypeId ?? placement.runtimeBlockTypeId;
    const targetCells = options.sceneRuntime.getTargetCells();
    const replaceBlockTypeId = targetCells.sourceCell?.blockTypeId ?? null;
    if (parcelMaskInput?.checked && parcelSelection.parcels.length === 0) {
      setStatus("Bitte zuerst in der Karte mindestens ein Grundstück auswählen.", "warning");
      return;
    }
    if (operationNeedsMaterial(effectiveOperation) && !effectiveBlockTypeId) {
      setStatus("Bitte zuerst einen platzierbaren Block in der Hotbar auswählen.", "warning");
      return;
    }
    if (effectiveOperation === "replace" && !replaceBlockTypeId) {
      setStatus("Fuer Ersetzen bitte mit dem Fadenkreuz auf den Quellblock zielen.", "warning");
      return;
    }
    const anchor = target ?? selection.first;
    if (!anchor) {
      setStatus("Es fehlt ein Ziel oder eine vollständige Auswahl.", "warning");
      return;
    }
    const selectionBounds = selection.first && selection.second
      ? { min: selection.first, max: selection.second }
      : null;
    if (behavior.requiresCompleteSelection && !selectionBounds) {
      setStatus("Bitte Punkt A und Punkt B setzen.", "warning");
      return;
    }

    busy = true;
    if (executeButton) executeButton.disabled = true;
    setStatus("WorldEdit wird transaktional ausgeführt …", "busy");
    try {
      const payload: ChunkApiWorldEditCommandPayload = {
        type: "WorldEdit",
        userId: "editor_user",
        sessionId: `world_edit_${Date.now()}`,
        position: anchor,
        tool: commandTool,
        operation: effectiveOperation,
        ...(effectiveBlockTypeId ? { blockTypeId: effectiveBlockTypeId } : {}),
        ...(effectiveOperation === "replace" && replaceBlockTypeId ? { replaceBlockTypeId } : {}),
        ...(behavior.requiresCompleteSelection && selectionBounds ? {
          bounds: selectionBounds,
        } : {
          brush: overrides?.brush ?? {
            shape: brushShape?.value ?? "sphere",
            radius: Number(brushRadius?.value ?? 2),
            density: Number(brushDensity?.value ?? 100),
            wallThickness: Number(brushWall?.value ?? 0),
          },
        }),
        parcelMask: parcelMaskPayload(),
        commandSource: WORLD_EDIT_COMMAND_SOURCE,
        libraryItemId: placement.libraryItemId,
        inventoryItemId: placement.inventoryItemId,
        inventorySlotIndex: placement.inventorySlotIndex,
        familyId: placement.familyId,
        packageId: placement.packageId,
        vplibUid: placement.vplibUid,
        variantId: placement.variantId,
        revisionHash: placement.revisionHash,
        objectKind: placement.objectKind,
        libraryRef: placement.libraryRef,
        placementCommand: placement.placementCommand,
        commandMetadata: {
          ...placement.commandMetadata,
          source: "world-edit-controller",
          projectPublicId: parcelSelection.projectPublicId,
          ...overrides?.commandMetadata,
        },
        metadata: {
          ...placement.commandMetadata,
          source: "world-edit-controller",
          projectPublicId: parcelSelection.projectPublicId,
          ...overrides?.commandMetadata,
        },
        libraryContext: {
          libraryItemId: placement.libraryItemId,
          familyId: placement.familyId,
          packageId: placement.packageId,
          vplibUid: placement.vplibUid,
          variantId: placement.variantId,
          revisionHash: placement.revisionHash,
          objectKind: placement.objectKind,
          inventorySlotIndex: placement.inventorySlotIndex,
          libraryRef: placement.libraryRef,
          placementCommand: placement.placementCommand,
        },
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: `world-edit:${activeTool}:${effectiveOperation}`,
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        reportCompletion(false);
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      await options.sceneRuntime.reloadDirtyChunks("world-edit-command");
      reportCompletion(true);
      setStatus(result.result.changed ? "WorldEdit abgeschlossen." : "Keine Zellen mussten geändert werden.", "ready");
    } catch (error) {
      reportCompletion(false);
      options.logger?.warn?.("WorldEdit command failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  function planningMassingSelectionBounds(): PlanningMassingSelectionBounds | null {
    if (!selection.first || !selection.second) return null;
    const bounds = resolveWorldEditSelectionBounds(selection.first, selection.second);
    return {
      minimum: { ...bounds.minimum },
      maximum: { ...bounds.maximum },
    };
  }

  function getPlanningMassingSnapshot(): PlanningMassingWorldEditSnapshot {
    const placement = selectedPlacement();
    return {
      selection: planningMassingSelectionBounds(),
      materialId: placement.runtimeBlockTypeId || null,
      materialLabel: placement.label ?? placement.runtimeBlockTypeId ?? "Kein Hotbar-Material gewählt",
      parcelCount: parcelSelection.parcels.length,
      parcelMaskEnabled: Boolean(parcelMaskInput?.checked),
      busy,
      lastDraft: lastPlanningMassingDraft,
    };
  }

  function beginPlanningMassingSelection(): void {
    if (destroyed || busy) return;
    options.sceneRuntime.setWorkspaceMode("planning", "planning-massing:selection");
    activate("selection", "fill");
    stopSelectionDrag();
    selection = { first: null, second: null };
    if (parcelMaskInput) parcelMaskInput.checked = parcelSelection.parcels.length > 0;
    rebuildSelectionScene();
    refreshHud();
    setStatus(
      parcelSelection.parcels.length > 0
        ? "Baufeld mit Linksklick auf dem Grundstück blockweise aufziehen. Die Grundstücksmaske ist aktiv."
        : "Baufeld mit Linksklick blockweise aufziehen. Für harte Grundstücksgrenzen zuerst ein Flurstück auswählen.",
      "ready",
    );
  }

  async function executePlanningMassing(heightBlocks: number): Promise<PlanningMassingWorldEditResult> {
    const validation = validatePlanningMassing(planningMassingSelectionBounds(), heightBlocks);
    if (!validation.ok || !validation.draft) {
      setStatus(validation.message, "warning");
      return validation;
    }
    if (busy) {
      return {
        ok: false,
        code: "massing_command_busy",
        message: "Eine andere Weltmutation läuft noch.",
        draft: validation.draft,
      };
    }
    const placement = selectedPlacement();
    if (!placement.runtimeBlockTypeId) {
      const message = "Bitte zuerst das gewünschte Baukörper-Material in der Hotbar auswählen.";
      setStatus(message, "warning");
      return { ok: false, code: "massing_material_missing", message, draft: validation.draft };
    }

    const draft = validation.draft;
    options.sceneRuntime.setWorkspaceMode("planning", "planning-massing:execute");
    activate("selection", "fill");
    selection = {
      first: { ...draft.bodyBounds.minimum },
      second: { ...draft.bodyBounds.maximum },
    };
    rebuildSelectionScene();
    refreshHud();

    let succeeded = false;
    await executeAt(undefined, "fill", {
      commandTool: "selection",
      commandMetadata: {
        schemaVersion: draft.schemaVersion,
        subsystem: "planning-massing",
        planningMode: true,
        widthBlocks: draft.widthBlocks,
        depthBlocks: draft.depthBlocks,
        heightBlocks: draft.heightBlocks,
        footprintAreaM2: draft.footprintAreaM2,
        volumeM3: draft.volumeM3,
      },
      onComplete: (value) => { succeeded = value; },
    });
    if (!succeeded) {
      return {
        ok: false,
        code: "massing_command_failed",
        message: "Der Baukörper konnte nicht vollständig gespeichert werden.",
        draft,
      };
    }

    lastPlanningMassingDraft = draft;
    const message = `Baukörper ${draft.widthBlocks} × ${draft.depthBlocks} × ${draft.heightBlocks} wurde über WorldEdit gespeichert.`;
    setStatus(message, "ready");
    return { ok: true, code: "massing_created", message, draft };
  }

  async function preparePlanningMassingRoof(): Promise<PlanningMassingWorldEditResult> {
    const draft = lastPlanningMassingDraft;
    if (!draft) {
      const message = "Zuerst einen Baukörper aus dem Baufeld erstellen.";
      setStatus(message, "warning");
      return { ok: false, code: "massing_body_missing", message, draft: null };
    }
    if (busy) {
      return {
        ok: false,
        code: "massing_command_busy",
        message: "Eine andere Weltmutation läuft noch.",
        draft,
      };
    }

    options.sceneRuntime.setWorkspaceMode("planning", "planning-massing:roof");
    activate("roof");
    resetPolygonArea("roof");
    const runtime = polygonAreaRuntime("roof");
    runtime.points = draft.roofPoints.map((point) => ({ ...point }));
    runtime.closed = true;
    runtime.calculation = null;
    runtime.request = null;
    const { importedSource: _importedSource, ...currentRoofParameters } = roofParameters;
    roofParameters = {
      ...currentRoofParameters,
      roofType: roofParameters.roofType === "imported" ? "gable" : roofParameters.roofType,
      eavesHeightMm: Math.max(0, Math.round(draft.roofEavesY * 1_000)),
    };
    rebuildPolygonAreaScene("roof");
    refreshHud();
    setStatus("Dachfläche aus dem Baukörper übernommen. Parametrisches Dach wird berechnet …", "busy");
    const calculation = await calculateRoofPreview();
    if (!calculation) {
      return {
        ok: false,
        code: "massing_roof_preview_failed",
        message: "Das vorhandene Dachwerkzeug konnte keine Vorschau berechnen.",
        draft,
      };
    }
    const message = "Dachwerkzeug ist auf dem Baukörper vorbereitet. Dachform prüfen und mit „Ausführen“ speichern.";
    setStatus(message, "ready");
    return { ok: true, code: "massing_roof_ready", message, draft };
  }

  async function executeSculptLayer(
    target: Readonly<{ position: ChunkApiWorldPosition; blockTypeId: string | null }>,
    mode: "raise" | "lower",
  ): Promise<void> {
    brushTarget = { ...target.position };
    const radius = Math.max(1, Math.round(Number(brushRadius?.value ?? 5)));
    const anchor = mode === "raise"
      ? { x: target.position.x, y: target.position.y + 1, z: target.position.z }
      : target.position;
    if (mode === "raise" && !target.blockTypeId) {
      setStatus("Zum Anheben bitte direkt auf einen vorhandenen Block zielen.", "warning");
      return;
    }
    await executeAt(anchor, mode === "raise" ? "set" : "clear", {
      commandTool: "sculpt",
      blockTypeId: target.blockTypeId,
      brush: {
        shape: brushShape?.value ?? "box",
        radius,
        radiusX: radius,
        radiusY: 0,
        radiusZ: radius,
        density: Number(brushDensity?.value ?? 100),
        wallThickness: 0,
      },
    });
  }

  function existingRoomAt(position: ChunkApiWorldPosition): ExistingRoomRef | null {
    const scene = options.sceneRuntime.getScene();
    if (!scene) return null;
    let found: ExistingRoomRef | null = null;
    scene.traverse((object) => {
      if (found || object.userData.semanticRoom !== true) return;
      const ref = asRecord(object.userData.semanticObjectRef);
      const metadata = asRecord(ref.metadata);
      if (safeString(metadata.schemaVersion, "") === "vectoplan-planning-build-area.v1") return;
      const footprint = asRecord(ref.footprint);
      const coordinates = asArray(footprint.coordinates);
      const point: readonly [number, number] = [position.x + 0.5, position.z + 0.5];
      const contains = safeString(footprint.type, "Polygon") === "MultiPolygon"
        ? coordinates.some((polygon) => pointInPolygon(point, polygon))
        : pointInPolygon(point, coordinates);
      const objectInstanceId = safeString(ref.objectInstanceId, "");
      if (!contains || !objectInstanceId) return;
      const anchor = worldPosition(ref.anchor);
      if (!anchor) return;
      found = {
        objectInstanceId,
        anchor,
        footprint,
        metadata,
      };
    });
    return found;
  }

  function normalizedStoreyCount(value: unknown, fallback = 1): number {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Math.max(1, Math.min(80, Math.trunc(numeric)))
      : fallback;
  }

  function planningStoreyProfileFromMetadata(
    metadata: Readonly<Record<string, unknown>>,
  ): PlanningBuildingStoreyProfile {
    const stored = asRecord(metadata.storeyProfile);
    const baseCount = normalizedStoreyCount(
      stored.baseCount ?? metadata.storeyCount,
      1,
    );
    const adjustments: Record<string, number> = {};
    const rawAdjustments = asRecord(stored.segmentAdjustments ?? stored.segmentExtraCounts);
    for (const [key, value] of Object.entries(rawAdjustments)) {
      const index = Number(key);
      const count = Number(value);
      if (!Number.isInteger(index) || index < 0 || !Number.isFinite(count)) continue;
      const adjustment = Math.max(-79, Math.min(79, Math.trunc(count)));
      if (adjustment !== 0) adjustments[String(index)] = adjustment;
    }
    return { baseCount, segmentAdjustments: adjustments };
  }

  function planningStoreyCountForScope(scope: StoreyTargetScope): number {
    if (scope === "all") return planningBuildingStoreyProfile.baseCount;
    const index = Number(scope.slice("segment:".length));
    const adjustment = Number(planningBuildingStoreyProfile.segmentAdjustments[String(index)] ?? 0);
    return Math.max(1, Math.min(80,
      planningBuildingStoreyProfile.baseCount + Math.trunc(adjustment),
    ));
  }

  function generatedPlanningObjects(
    metadata: Readonly<Record<string, unknown>>,
    key: "generatedObjects" | "retiredGeneratedObjects" = "generatedObjects",
  ): PlanningGeneratedObjectRef[] {
    const result: PlanningGeneratedObjectRef[] = [];
    for (const value of asArray(metadata[key])) {
      const record = asRecord(value);
      const objectInstanceId = safeString(record.objectInstanceId, "");
      const anchor = worldPosition(record.anchor);
      const rawRole = safeString(record.role, "");
      const role: PlanningGeneratedObjectRef["role"] = rawRole === "roof"
        ? "roof"
        : rawRole === "slab"
          ? "slab"
          : "storey";
      const rawScope = safeString(record.scope, "all");
      const scope: StoreyTargetScope = /^segment:\d+$/.test(rawScope)
        ? rawScope as StoreyTargetScope
        : "all";
      if (!objectInstanceId || !anchor) continue;
      result.push({
        objectInstanceId,
        anchor,
        role,
        scope,
        ...(Number.isFinite(Number(record.storeyIndex))
          ? { storeyIndex: Math.max(0, Math.trunc(Number(record.storeyIndex))) }
          : {}),
      });
    }
    return result;
  }

  function uniquePlanningGeneratedObjects(
    refs: readonly PlanningGeneratedObjectRef[],
  ): PlanningGeneratedObjectRef[] {
    const seen = new Set<string>();
    return refs.filter((ref) => {
      if (seen.has(ref.objectInstanceId)) return false;
      seen.add(ref.objectInstanceId);
      return true;
    });
  }

  function serializedPlanningGeneratedObjects(
    refs: readonly PlanningGeneratedObjectRef[],
  ): readonly Readonly<Record<string, unknown>>[] {
    return refs.map((ref) => ({
      objectInstanceId: ref.objectInstanceId,
      anchor: ref.anchor,
      role: ref.role,
      scope: ref.scope,
      ...(ref.storeyIndex !== undefined ? { storeyIndex: ref.storeyIndex } : {}),
    }));
  }

  function syncLineBrushStoreyEditing(): void {
    if (!lineBrushQuickSettings) return;
    const segmentCount = currentPlanningBuildAreaDraft()?.segments.length ?? 0;
    const requestedIndex = planningScopeSegmentIndex(selectedStoreyScope);
    if (requestedIndex !== null && requestedIndex >= segmentCount) selectedStoreyScope = "all";
    lineBrushQuickSettings.syncStoreyEditing({
      segmentCount,
      scope: selectedStoreyScope,
      scopeStoreyCount: planningStoreyCountForScope(selectedStoreyScope),
      busy,
    });
  }

  function syncStoreyQuickSettings(open = false): void {
    if (!storeyQuickSettings || !currentPlanningBuildAreaDraft()) return;
    const draft = currentPlanningBuildAreaDraft();
    const state = {
      buildingLabel: safeString(
        selectedStoreyBuildArea?.metadata.label,
        "Linien-Brush-Baukörper",
      ),
      storeyCount: planningStoreyCountForScope(selectedStoreyScope),
      segmentCount: draft?.segments.length ?? 0,
      scope: selectedStoreyScope,
      busy,
    };
    if (!open) {
      storeyQuickSettings.sync(state);
      return;
    }
    const camera = options.sceneRuntime.getCamera();
    const cameraPosition = camera?.position.clone() ?? null;
    const cameraQuaternion = camera?.quaternion.clone() ?? null;
    const inputController = options.sceneRuntime.getInputController();
    inputController?.clear("world-edit-storey-settings-open");
    inputController?.disable("world-edit-storey-settings-open");
    storeyQuickSettings.open(state);
    if (inputController) {
      void inputController.exitPointerLock("world-edit-storey-settings").finally(() => {
        if (camera && cameraPosition && cameraQuaternion) {
          camera.position.copy(cameraPosition);
          camera.quaternion.copy(cameraQuaternion);
          camera.updateMatrixWorld(true);
          options.sceneRuntime.renderOnce("world-edit.storey-settings-camera-preserved");
        }
      });
    }
  }

  function existingPlanningBuildAreaAt(position: ChunkApiWorldPosition): ExistingRoomRef | null {
    const scene = options.sceneRuntime.getScene();
    if (!scene) return null;
    let found: ExistingRoomRef | null = null;
    scene.traverse((object) => {
      if (found || object.userData.semanticPlanningBuildArea !== true) return;
      const ref = asRecord(object.userData.semanticObjectRef);
      const metadata = asRecord(ref.metadata);
      if (safeString(ref.objectTypeId, "") !== "planning_build_area"
        || safeString(metadata.schemaVersion, "") !== "vectoplan-planning-build-area.v1") return;
      const footprint = asRecord(ref.footprint);
      const coordinates = asArray(footprint.coordinates);
      const point: readonly [number, number] = [position.x + 0.5, position.z + 0.5];
      const contains = safeString(footprint.type, "Polygon") === "MultiPolygon"
        ? coordinates.some((polygon) => pointInPolygon(point, polygon))
        : pointInPolygon(point, coordinates);
      const objectInstanceId = safeString(ref.objectInstanceId, "");
      const anchor = worldPosition(ref.anchor);
      if (!contains || !objectInstanceId || !anchor) return;
      found = { objectInstanceId, anchor, footprint, metadata };
    });
    return found;
  }

  function existingRoofsInScene(): readonly ExistingRoofRef[] {
    const scene = options.sceneRuntime.getScene();
    if (!scene) return [];
    const found: ExistingRoofRef[] = [];
    scene.traverseVisible((object) => {
      if (object.userData.semanticRoof !== true) return;
      const ref = asRecord(object.userData.semanticObjectRef);
      const footprint = asRecord(ref.footprint);
      const objectInstanceId = safeString(ref.objectInstanceId, "");
      const anchor = worldPosition(ref.anchor);
      if (!objectInstanceId || !anchor) return;
      found.push({
        objectInstanceId,
        anchor,
        footprint,
        metadata: asRecord(ref.metadata),
      });
    });
    return uniqueRoofZones(found);
  }

  function existingRoofAt(position: ChunkApiWorldPosition): ExistingRoofRef | null {
    const point: readonly [number, number] = [position.x, position.z];
    let nearest: ExistingRoofRef | null = null;
    let distance = Infinity;
    for (const roof of existingRoofsInScene()) {
      const coordinates = asArray(roof.footprint.coordinates);
      const contains = safeString(roof.footprint.type, "Polygon") === "MultiPolygon"
        ? coordinates.some((polygon) => pointInPolygon(point, polygon))
        : pointInPolygon(point, coordinates);
      if (contains) {
        const height = heightOnRoof(roofSurfaceTriangles(roof.metadata.roofCalculation), position.x, position.z, position.y);
        if (height !== null && Math.abs(height-position.y) < distance) {
          distance = Math.abs(height-position.y);
          nearest = roof;
        }
      }
    }
    return nearest;
  }

  function restoreEditingRoofObjects(): void {
    if (hiddenEditingRoofObjects.length === 0) return;
    hiddenEditingRoofObjects.forEach(({ object, visible }) => {
      object.visible = visible;
    });
    hiddenEditingRoofObjects = [];
    options.sceneRuntime.renderOnce("world-edit.roof-edit-source-restore");
  }

  function hideEditingRoofObjects(objectInstanceId: string): void {
    restoreEditingRoofObjects();
    const scene = options.sceneRuntime.getScene();
    if (!scene || !objectInstanceId) return;
    scene.traverse((object) => {
      if (object.userData.semanticRoof !== true) return;
      const ref = asRecord(object.userData.semanticObjectRef);
      if (safeString(ref.objectInstanceId, "") !== objectInstanceId) return;
      hiddenEditingRoofObjects.push({ object, visible: object.visible });
      object.visible = false;
    });
    if (hiddenEditingRoofObjects.length > 0) {
      options.sceneRuntime.renderOnce("world-edit.roof-edit-source-hide");
    }
  }

  function sceneContainsRoofCalculation(
    objectInstanceId: string,
    expectedCalculation: RoofCalculationResult,
  ): boolean {
    const scene = options.sceneRuntime.getScene();
    if (!scene) return false;
    let matches = false;
    let hidStaleObject = false;
    scene.traverse((object) => {
      if (object.userData.semanticRoof !== true) return;
      const ref = asRecord(object.userData.semanticObjectRef);
      const renderedObjectInstanceId = safeString(
        object.userData.objectInstanceId ?? ref.objectInstanceId,
        "",
      );
      if (renderedObjectInstanceId !== objectInstanceId) return;
      if (roofCalculationVersionsMatch(
        expectedCalculation,
        object.userData.roofCalculationVersion,
      ) && JSON.stringify(normalizeSolarSettings(asRecord(ref.metadata).solar)) === JSON.stringify(roofSolarSettings)) {
        matches = true;
        return;
      }
      if (!object.visible) return;
      if (!hiddenEditingRoofObjects.some(({ object: hidden }) => hidden === object)) {
        hiddenEditingRoofObjects.push({ object, visible: object.visible });
      }
      object.visible = false;
      hidStaleObject = true;
    });
    if (hidStaleObject) options.sceneRuntime.renderOnce("world-edit.roof-save-stale-source-hide");
    return matches;
  }

  async function waitForPersistedRoofCalculation(
    objectInstanceId: string,
    expectedCalculation: RoofCalculationResult,
    timeoutMilliseconds = 8_000,
  ): Promise<boolean> {
    const deadline = Date.now() + Math.max(0, timeoutMilliseconds);
    while (!destroyed) {
      if (sceneContainsRoofCalculation(objectInstanceId, expectedCalculation)) return true;
      if (Date.now() >= deadline) return false;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 32));
    }
    return false;
  }

  function selectExistingRoof(ref: ExistingRoofRef): void {
    const runtime = polygonAreaRuntime("roof");
    const rings = polygonAreaRingsFromFootprint(ref.footprint, ref.anchor.y);
    const points = rings[0] ?? [];
    if (!validPolygonArea(points)) return;
    invalidateRoofCalculation();
    runtime.points = [...points];
    runtime.closed = true;
    const storedParameters = asRecord(ref.metadata.roofParameters);
    const normalizedStoredParameters = normalizeRoofToolParameters(
      storedParameters,
      DEFAULT_ROOF_TOOL_PARAMETERS,
    );
    const persistedQuickSettings = persistedRoofQuickSettings(ref.metadata, normalizedStoredParameters);
    const storedCalculation = asRecord(ref.metadata.roofCalculation);
    let pendingRoofEdit = pendingRoofQuickSettings.get(ref.objectInstanceId);
    const pendingStatus = pendingRoofEdit
      ? pendingRoofCalculationStatus(
        ref.objectInstanceId,
        pendingRoofEdit.calculationVersion,
        storedCalculation,
      )
      : null;
    if (pendingStatus === "persisted" || pendingStatus === "superseded") {
      pendingRoofQuickSettings.delete(ref.objectInstanceId);
      pendingRoofEdit = undefined;
    }
    roofParameters = {
      ...normalizedStoredParameters,
      ...persistedQuickSettings,
      ...(pendingStatus === "protected" ? pendingRoofEdit?.parameters ?? {} : {}),
    };
    roofQuickSettings?.sync(roofParameters);
    const storedRequest = asRecord(ref.metadata.roofRequest);
    const expectedRequest = buildRoofCalculationRequest(runtime.points, roofParameters);
    const requestMatches = storedRequest.contract_version === "cad-roof-calculation-request/0.1"
      && roofCalculationRequestKey(storedRequest) === roofCalculationRequestKey(expectedRequest);
    const isImported = roofParameters.roofType === "imported" && Boolean(roofParameters.importedSource)
      && storedCalculation.source === "lod2-original-surfaces";
    const purlinAlignmentIsCurrent = isImported || roofCalculationHasZoneTopPurlinAlignment(storedCalculation);
    // Render the persisted calculation immediately even when an older request
    // schema/default set no longer matches exactly, but never reuse a legacy
    // calculation whose lowest purlin still sits below the roof-zone datum.
    runtime.calculation = storedCalculation.ok === true && purlinAlignmentIsCurrent
      ? storedCalculation as RoofCalculationResult
      : null;
    runtime.request = storedCalculation.ok === true && purlinAlignmentIsCurrent
      && storedRequest.contract_version === "cad-roof-calculation-request/0.1"
      ? storedRequest as unknown as RoofCalculationRequest
      : null;
    if (isImported) runtime.request = expectedRequest;
    editingRoofInstanceId = ref.objectInstanceId;
    editingRoofAnchor = { ...ref.anchor };
    editingRoofMetadata = { ...ref.metadata };
    editingRoofHoleRings = rings.slice(1).map((ring) => [...ring]);
    roofSolarSettings = normalizeSolarSettings(ref.metadata.solar);
    hideEditingRoofObjects(ref.objectInstanceId);
    rebuildPolygonAreaScene("roof");
    rebuildRoofZoneScene(true);
    refreshHud();
    if ((!requestMatches || !purlinAlignmentIsCurrent) && !isImported) scheduleRoofPreview(0);
    setStatus(`Dach ${ref.objectInstanceId} ausgewählt. Eckpunkte und alle Dachparameter bleiben editierbar.`, "ready");
  }

  async function removeExistingRoof(ref: ExistingRoofRef): Promise<void> {
    if (busy) return;
    busy = true;
    if (executeButton) executeButton.disabled = true;
    try {
      const payload: ChunkApiRemoveObjectCommandPayload = {
        type: "RemoveObject",
        userId: "editor_user",
        sessionId: `world_edit_roof_remove_${Date.now()}`,
        position: ref.anchor,
        objectInstanceId: ref.objectInstanceId,
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: "world-edit:roof:remove",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      pendingRoofQuickSettings.delete(ref.objectInstanceId);
      clearOptimisticRoofCalculation(ref.objectInstanceId);
      resetPolygonArea("roof");
      await options.sceneRuntime.reloadDirtyChunks("world-edit-roof-remove");
      rebuildRoofZoneScene(true);
      setStatus("Dach gelöscht.", "ready");
    } catch (error) {
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  function selectExistingRoom(ref: ExistingRoomRef): void {
    roomAreaWorkspaceProfile = "first-person";
    const runtime = polygonAreaRuntime("room");
    const points = polygonAreaPointsFromFootprint(ref.footprint, ref.anchor.y);
    if (!validPolygonArea(points)) return;
    runtime.points = [...points];
    runtime.closed = true;
    roomHeight = Math.max(0.1, Number(ref.footprint.height ?? ref.metadata.height ?? 3));
    editingRoomInstanceId = ref.objectInstanceId;
    editingRoomAnchor = { ...ref.anchor };
    roomType = safeString(ref.metadata.roomType, roomType);
    roomLabel = safeString(ref.metadata.label, roomLabel).slice(0, 80);
    rebuildPolygonAreaScene("room");
    refreshHud();
    setStatus(`${roomLabel} ausgewählt. Gelbe Eckpunkte verschieben oder Eigenschaften ändern; die Fläche bleibt exakt erhalten.`, "ready");
  }

  async function selectPlanningBuildingPreservingDraft(ref: ExistingRoomRef): Promise<boolean> {
    if (busy) return false;
    if (ref.objectInstanceId !== editingPlanningBuildAreaInstanceId
      && currentPlanningBuildAreaDraft()
      && (!editingPlanningBuildAreaInstanceId || planningBuildingDraftDirty)) {
      if (!await executePlanningBuildArea(planningBuildingGenerationRequest ?? undefined)) return false;
    }
    return selectExistingPlanningBuildArea(ref);
  }

  function selectExistingPlanningBuildArea(ref: ExistingRoomRef): boolean {
    // The stored parent can still describe the previous generation while its
    // replacement is loading. Re-selecting it must not overwrite the live draft.
    if (ref.objectInstanceId === editingPlanningBuildAreaInstanceId
      && (planningBuildingSceneRefreshPending || planningBuildingDraftDirty)
      && currentPlanningBuildAreaDraft()) return true;
    if (ref.objectInstanceId !== editingPlanningBuildAreaInstanceId && planningBuildingSceneRefreshPending
      && !completePlanningBuildingSceneRefreshIfReady()) {
      schedulePlanningBuildingSceneRefresh();
      setStatus("Das aktuelle Gebäude ist gespeichert und wird noch angezeigt, bis seine neuen Blöcke geladen sind. Danach kann das andere Gebäude ausgewählt werden.", "info");
      return false;
    }
    const draft = pathBrushDraftFromUnknown(ref.metadata.pathBrush);
    if (!draft || draft.kind !== "building") {
      setStatus("Diese ältere Baufläche enthält noch keinen editierbaren Linien-Brush-Vertrag.", "warning");
      return false;
    }
    const runtime = polygonAreaRuntime("room");
    roomAreaWorkspaceProfile = "planning";
    runtime.points = draft.points.map((point) => ({ ...point }));
    runtime.closed = true;
    planningBuildAreaWidth = draft.width;
    editingPlanningBuildAreaInstanceId = ref.objectInstanceId;
    editingPlanningBuildAreaAnchor = { ...ref.anchor };
    editingPlanningBuildAreaMetadata = { ...ref.metadata };
    planningBuildingDraftDirty = false;
    planningBuildingSceneRefreshPending = null;
    planningBuildingGenerationRequest = null;
    planningBuildingStoreyProfile = planningStoreyProfileFromMetadata(ref.metadata);
    const buildingProgram = asRecord(ref.metadata.buildingProgram);
    const storedRoof = asRecord(buildingProgram.roof);
    lineBrushQuickSettings?.sync({
      typeId: getBuildingProgramType(safeString(buildingProgram.typeId, "standard")).id,
      templateId: safeString(
        buildingProgram.requestedTemplateId ?? buildingProgram.executedTemplateId,
        "builtin:standard",
      ),
      storeyCount: planningBuildingStoreyProfile.baseCount,
      roofType: normalizeLineBrushRoofType(storedRoof.type),
    });
    planningBuildingProgramSelection = lineBrushQuickSettings?.getSnapshot().selection
      ?? planningBuildingProgramSelection;
    editingRoomInstanceId = null;
    editingRoomAnchor = null;
    selectedStoreyScope = "all";
    syncLineBrushStoreyEditing();
    rebuildPolygonAreaScene("room");
    refreshHud();
    setStatus("Gebäude-Baufläche ausgewählt. Stützpunkte anpassen oder die mittlere Raute ziehen, um alles zu verschieben.", "ready");
    return true;
  }

  function selectPlanningBuildingForStoreys(ref: ExistingRoomRef): void {
    if (!selectExistingPlanningBuildArea(ref)) return;
    selectedStoreyBuildArea = ref;
    selectedStoreyScope = "all";
    storeyDragHandle?.setEnabled(activeTool === "storey");
    syncStoreyQuickSettings(true);
    setStatus("Blauen Höhengriff nach oben oder unten ziehen. Der gewählte Bereich rastet in ganzen Geschossen ein.", "ready");
  }

  async function removeExistingRoom(ref: ExistingRoomRef): Promise<void> {
    if (busy) return;
    busy = true;
    if (executeButton) executeButton.disabled = true;
    try {
      const payload: ChunkApiRemoveObjectCommandPayload = {
        type: "RemoveObject",
        userId: "editor_user",
        sessionId: `world_edit_room_remove_${Date.now()}`,
        position: ref.anchor,
        objectInstanceId: ref.objectInstanceId,
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: "world-edit:room:remove",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      editingRoomInstanceId = null;
      editingRoomAnchor = null;
      resetPolygonArea("room");
      await options.sceneRuntime.reloadDirtyChunks("world-edit-room-remove");
      rebuildPolygonAreaScene("room");
      setStatus("Raum gelöscht.", "ready");
    } catch (error) {
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  async function removeExistingPlanningBuildArea(ref: ExistingRoomRef): Promise<void> {
    if (busy) return;
    busy = true;
    if (executeButton) executeButton.disabled = true;
    try {
      await removePlanningGeneratedObjectRefs(uniquePlanningGeneratedObjects([
        ...generatedPlanningObjects(ref.metadata),
        ...generatedPlanningObjects(ref.metadata, "retiredGeneratedObjects"),
      ]));
      const payload: ChunkApiRemoveObjectCommandPayload = {
        type: "RemoveObject",
        userId: "editor_user",
        sessionId: `world_edit_planning_build_area_remove_${Date.now()}`,
        position: ref.anchor,
        objectInstanceId: ref.objectInstanceId,
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: "world-edit:planning-build-area:remove",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      resetPolygonArea("room");
      selectedStoreyBuildArea = null;
      editingPlanningBuildAreaMetadata = {};
      storeyQuickSettings?.close(false);
      await options.sceneRuntime.reloadDirtyChunks("world-edit-planning-build-area-remove");
      setStatus("Gebäude-Baufläche gelöscht.", "ready");
    } catch (error) {
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  function planningScopeSegmentIndex(scope: StoreyTargetScope): number | null {
    if (scope === "all") return null;
    const index = Number(scope.slice("segment:".length));
    return Number.isInteger(index) && index >= 0 ? index : null;
  }

  function planningScopeIdentity(scope: StoreyTargetScope): string {
    return scope === "all" ? "all" : `segment_${planningScopeSegmentIndex(scope) ?? 0}`;
  }

  function currentPlanningBuildingPreset(
    request?: LineBrushBuildingGenerationRequest,
  ): LineBrushBuildingPreset {
    return request?.preset
      ?? lineBrushQuickSettings?.getSnapshot().preset
      ?? lineBrushBuildingPreset("standard");
  }

  function currentPlanningBuildingLayout(
    draft: PathBrushDraft,
    request?: LineBrushBuildingGenerationRequest,
  ): LineBrushBuildingLayout {
    return buildLineBrushBuildingLayout(draft, currentPlanningBuildingPreset(request));
  }

  function planningFootprintForScope(
    draft: PathBrushDraft,
    scope: StoreyTargetScope,
    layout: LineBrushBuildingLayout = currentPlanningBuildingLayout(draft),
  ): Readonly<Record<string, unknown>> {
    const segmentIndex = planningScopeSegmentIndex(scope);
    if (segmentIndex === null) return layout.footprint;
    const segment = draft.segments.find((candidate) => candidate.index === segmentIndex);
    if (!segment) throw new Error(`Liniensegment ${segmentIndex + 1} ist nicht mehr vorhanden.`);
    return lineBrushLayoutFootprintForSegment(layout, segmentIndex);
  }

  function planningRoofPolygonsForScope(
    draft: PathBrushDraft,
    scope: StoreyTargetScope,
    layout: LineBrushBuildingLayout = currentPlanningBuildingLayout(draft),
  ): readonly (readonly (readonly (readonly [number, number])[])[])[] {
    const segmentIndex = planningScopeSegmentIndex(scope);
    if (segmentIndex !== null) {
      return lineBrushLayoutFootprintForSegment(layout, segmentIndex).coordinates;
    }
    return layout.footprint.coordinates
      .filter((polygon) => (polygon[0]?.length ?? 0) >= 3);
  }

  function planningProgramMetadata(
    request?: LineBrushBuildingGenerationRequest,
  ): Readonly<Record<string, unknown>> {
    const snapshot = lineBrushQuickSettings?.getSnapshot();
    const base = request
      ? request.buildingProgram as unknown as Readonly<Record<string, unknown>>
      : (() => {
          const persisted = asRecord(editingPlanningBuildAreaMetadata.buildingProgram);
          if (Object.keys(persisted).length > 0) return persisted;
          return buildBuildingProgramExecutionMetadata(
            planningBuildingProgramSelection,
          ) as unknown as Readonly<Record<string, unknown>>;
        })();
    const preset = request?.preset ?? snapshot?.preset ?? currentPlanningBuildingPreset();
    const roof = lineBrushRoofDefaults(
      preset.typeId,
      request?.roofType ?? snapshot?.roofType,
    );
    return {
      ...base,
      layoutPreset: preset,
      roof: {
        type: roof.type,
        pitchDegrees: request?.roofPitchDegrees ?? roof.pitchDegrees,
        overhangMillimeters: request?.roofOverhangMillimeters ?? roof.overhangMillimeters,
        generator: "world-edit.roof",
      },
    };
  }

  function planningBuildingBlockTypeId(): string {
    const persisted = safeString(editingPlanningBuildAreaMetadata.wallBlockTypeId, "");
    if (persisted) return persisted;
    const placement = selectedPlacement();
    if (placement.valid
      && placement.runtimeBlockTypeId
      && placement.objectKind !== "world_edit_tool") return placement.runtimeBlockTypeId;
    return "lod2_exterior_wall";
  }

  function planningStoreyBuildSpecs(
    draft: PathBrushDraft,
    baseY: number,
    request?: LineBrushBuildingGenerationRequest,
  ): readonly PlanningStoreyBuildSpec[] {
    const layout = currentPlanningBuildingLayout(draft, request);
    const result: PlanningStoreyBuildSpec[] = [];
    let occupiedCellCount = 0;
    const append = (scope: StoreyTargetScope, storeyIndex: number): void => {
      const segmentIndex = planningScopeSegmentIndex(scope);
      const geometry = buildLineBrushBuildingGeometry({
        draft,
        layout,
        alignToBuildingGrid: true,
        baseY: baseY + storeyIndex * STANDARD_STOREY_HEIGHT_METERS,
        storeyCount: 1,
        segmentScope: segmentIndex === null
          ? "all"
          : { kind: "segment", segmentIndex },
      });
      occupiedCellCount = reserveLineBrushBuildingCellBudget(
        occupiedCellCount,
        geometry.occupiedCells.length,
      );
      result.push({
        scope,
        storeyIndex,
        geometry,
        storey: geometry.storeys[0]!,
        footprint: planningFootprintForScope(draft, scope, layout),
      });
    };
    const hasSegmentAdjustments = Object.values(planningBuildingStoreyProfile.segmentAdjustments)
      .some((value) => Number(value) !== 0);
    if (!hasSegmentAdjustments) {
      for (let storeyIndex = 0; storeyIndex < planningBuildingStoreyProfile.baseCount; storeyIndex += 1) {
        append("all", storeyIndex);
      }
    } else {
      // Once one segment differs, persist every rectangle separately. This is
      // what allows an individual wing to be moved below as well as above the
      // global storey count without cutting holes into an already-unioned body.
      for (const segment of draft.segments) {
        const scope = `segment:${segment.index}` as StoreyTargetScope;
        const count = planningStoreyCountForScope(scope);
        for (let storeyIndex = 0; storeyIndex < count; storeyIndex += 1) {
          append(scope, storeyIndex);
        }
      }
    }
    return result;
  }

  function planningBlockDimensions(
    cells: readonly ChunkApiWorldPosition[],
  ): Readonly<{ x: number; y: number; z: number }> {
    const xs = cells.map((cell) => cell.x);
    const ys = cells.map((cell) => cell.y);
    const zs = cells.map((cell) => cell.z);
    return {
      x: Math.max(1, Math.min(256, Math.max(...xs) - Math.min(...xs) + 1)),
      y: Math.max(1, Math.min(256, Math.max(...ys) - Math.min(...ys) + 1)),
      z: Math.max(1, Math.min(256, Math.max(...zs) - Math.min(...zs) + 1)),
    };
  }

  function semanticRoutingCells(
    bounds: Readonly<{
      minimum: Readonly<{ x: number; z: number }>;
      maximum: Readonly<{ x: number; z: number }>;
    }>,
    y: number,
  ): readonly ChunkApiWorldPosition[] {
    // Chunk size is fixed to 16 in the current world contract. One harmless
    // metadata-only routing cell per intersected X/Z chunk keeps large roofs
    // and planning areas visible/selectable even when their anchor chunk is
    // outside the streamed camera radius.
    const chunkSize = 16;
    const minimumChunkX = Math.floor(bounds.minimum.x / chunkSize);
    const maximumChunkX = Math.floor((bounds.maximum.x - 1e-7) / chunkSize);
    const minimumChunkZ = Math.floor(bounds.minimum.z / chunkSize);
    const maximumChunkZ = Math.floor((bounds.maximum.z - 1e-7) / chunkSize);
    const result: ChunkApiWorldPosition[] = [];
    for (let chunkZ = minimumChunkZ; chunkZ <= maximumChunkZ; chunkZ += 1) {
      for (let chunkX = minimumChunkX; chunkX <= maximumChunkX; chunkX += 1) {
        result.push({
          x: chunkX * chunkSize,
          y: Math.floor(y),
          z: chunkZ * chunkSize,
        });
      }
    }
    return result.length > 0 ? result : [{
      x: Math.floor(bounds.minimum.x),
      y: Math.floor(y),
      z: Math.floor(bounds.minimum.z),
    }];
  }

  async function planningRoofBuildSpecs(
    draft: PathBrushDraft,
    baseY: number,
    generationRequest?: LineBrushBuildingGenerationRequest,
    signal?: AbortSignal,
  ): Promise<readonly PlanningRoofBuildSpec[]> {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const snapshot = lineBrushQuickSettings?.getSnapshot();
    const preset = currentPlanningBuildingPreset(generationRequest);
    const roofDefaults = lineBrushRoofDefaults(
      preset.typeId,
      generationRequest?.roofType ?? snapshot?.roofType,
    );
    const pitchDegrees = generationRequest?.roofPitchDegrees ?? roofDefaults.pitchDegrees;
    const overhangMillimeters = generationRequest?.roofOverhangMillimeters
      ?? roofDefaults.overhangMillimeters;
    const layout = currentPlanningBuildingLayout(draft, generationRequest);
    const hasSegmentAdjustments = Object.values(planningBuildingStoreyProfile.segmentAdjustments)
      .some((value) => Number(value) !== 0);
    const result: PlanningRoofBuildSpec[] = [];
    let roofIndex = 0;
    for (const zone of buildLineBrushRoofZones(draft, layout, roofDefaults.type, hasSegmentAdjustments)) {
      const scope = zone.scope;
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const eavesY = baseY + planningStoreyCountForScope(scope) * STANDARD_STOREY_HEIGHT_METERS;
      const parameters: RoofToolParameters = {
        ...DEFAULT_ROOF_TOOL_PARAMETERS,
        roofType: roofDefaults.type,
        pitchDeg: pitchDegrees,
        eavesHeightMm: Math.round(eavesY * 1_000),
        ridgeDirection: zone.ridgeDirection,
        continuationEdgesMm: zone.continuationEdgesMm,
        continuationEdgeIndices: zone.continuationEdgeIndices,
        overhangMm: overhangMillimeters,
        overhangNorthMm: overhangMillimeters,
        overhangEastMm: overhangMillimeters,
        overhangSouthMm: overhangMillimeters,
        overhangWestMm: overhangMillimeters,
        edgeOverhangsMm: zone.polygon[0].map((_, index) => zone.interiorEdges.includes(index) ? 0 : overhangMillimeters),
      };
      for (const polygon of [zone.polygon]) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const rings = polygon
          .map((ring) => ring.map(([x, z]) => ({ x, y: eavesY, z })))
          .filter((ring) => validPolygonArea(ring));
        const points = rings[0] ?? [];
        if (!validPolygonArea(points)) continue;
        const request = buildRoofCalculationRequest(points, parameters);
        let calculation: RoofCalculationResult;
        if (parameters.roofType === "flat") {
          // The current CAD endpoint accepts one outer ring. Flat line-brush
          // roofs with courtyards are triangulated locally so their holes stay
          // open instead of being silently covered.
          calculation = createFlatRoofCalculation(
            points,
            parameters.eavesHeightMm,
            rings.slice(1),
            parameters.roofSkinThicknessMm,
          );
        } else {
          if (rings.length > 1) {
            throw new Error(`Die Dachform ${parameters.roofType} kann eine Innenhofkontur noch nicht verlustfrei abbilden.`);
          }
          try {
            calculation = await requestRoofCalculation(request, signal);
          } catch (error) {
            if (signal?.aborted) throw error;
            options.logger?.warn?.("CAD roof calculation unavailable for the line-brush building.", {
              error: normalizeUnknownError(error),
              scope,
            });
            throw error;
          }
        }
        result.push({ scope, roofIndex: roofIndex++, rings, points, parameters, request, calculation,
          polygon: zone.polygon, interiorEdges: zone.interiorEdges, eavesY });
      }
    }
    if (result.length === 0) throw new Error("Für die Gebäude-Baufläche konnte keine Dachkontur erzeugt werden.");
    const wallCells = buildLineBrushRoofWallCells(result);
    return result.map((spec, index) => ({ ...spec,
      wallCells: wallCells.filter(cell => cell.roofZoneIndex === index) }));
  }

  function schedulePlanningBuildingRoofPreview(
    group: THREE.Group,
    draft: PathBrushDraft,
    baseY: number,
  ): void {
    const sequence = ++planningBuildingPreviewSequence;
    if (planningBuildingRoofPreviewTimer) {
      window.clearTimeout(planningBuildingRoofPreviewTimer);
    }
    planningBuildingRoofPreviewAbortController?.abort();
    const cacheKey = JSON.stringify([draft.points, draft.width, baseY,
      planningBuildingStoreyProfile, currentPlanningBuildingPreset(), planningProgramMetadata()]);
    const append = (specs: readonly PlanningRoofBuildSpec[]): void => {
      appendLineBrushBuildingRoofPreview(group,
        specs.map(spec => ({ scope: spec.scope, calculation: spec.calculation, wallCells: spec.wallCells })),
        selectedStoreyScope,
        { editable: group.userData.lineBrushEditable === true, wallBlockTypeId: planningBuildingBlockTypeId() });
      options.sceneRuntime.renderOnce("world-edit.line-brush-roof-live-preview");
    };
    if (planningBuildingRoofPreviewCache?.key === cacheKey) {
      append(planningBuildingRoofPreviewCache.specs);
      return;
    }
    const abortController = new AbortController();
    planningBuildingRoofPreviewAbortController = abortController;
    planningBuildingRoofPreviewTimer = window.setTimeout(() => {
      planningBuildingRoofPreviewTimer = 0;
      void planningRoofBuildSpecs(draft, baseY, undefined, abortController.signal).then((specs) => {
        if (sequence !== planningBuildingPreviewSequence
          || abortController.signal.aborted
          || polygonAreaRuntime("room").group !== group
          || !group.parent) return;
        planningBuildingRoofPreviewCache = { key: cacheKey, specs };
        append(specs);
      }).catch((error) => {
        if (sequence !== planningBuildingPreviewSequence || abortController.signal.aborted) return;
        options.logger?.debug?.("Line-brush roof live preview is not available yet.", {
          error: normalizeUnknownError(error),
        });
      }).finally(() => {
        if (planningBuildingRoofPreviewAbortController === abortController) {
          planningBuildingRoofPreviewAbortController = null;
        }
      });
    }, 120);
  }

  async function removePlanningGeneratedObjectRefs(
    refs: readonly PlanningGeneratedObjectRef[],
    bestEffort = false,
  ): Promise<PlanningGeneratedObjectRef[]> {
    const removed = new Set<string>();
    const failed: PlanningGeneratedObjectRef[] = [];
    for (const ref of refs) {
      if (removed.has(ref.objectInstanceId)) continue;
      removed.add(ref.objectInstanceId);
      const result = await options.worldRuntime.getSource().sendCommand({
        type: "RemoveObject",
        userId: "editor_user",
        sessionId: `world_edit_planning_generated_remove_${Date.now()}`,
        position: ref.anchor,
        objectInstanceId: ref.objectInstanceId,
      } as ChunkApiRemoveObjectCommandPayload, {
        reason: "world-edit:planning-building:remove-generated",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        const missing = result.error?.statusCode === 404
          || /(?:not found|nicht gefunden)/i.test(commandErrorMessage(result));
        if (missing) continue;
        if (bestEffort) {
          failed.push(ref);
          options.logger?.warn?.("A retired planning object could not be removed and remains queued for cleanup.", {
            objectInstanceId: ref.objectInstanceId,
            error: commandErrorMessage(result),
          });
          continue;
        }
        throw new Error(commandErrorMessage(result));
      }
    }
    return failed;
  }

  function planningStoreyObjectPlacement(
    areaId: string,
    generationId: string,
    spec: PlanningStoreyBuildSpec,
    wallBlockTypeId: string,
    buildingProgram: Readonly<Record<string, unknown>>,
    assembly: "wall" | "slab",
  ): PlanningGeneratedObjectPlacement {
    const isSlab = assembly === "slab";
    const constructionCells = isSlab ? spec.storey.slabCells : spec.storey.wallCells;
    const occupiedCells = [...new Map(constructionCells.map(({ x, y, z }) =>
      [`${x}:${y}:${z}`, { x, y, z }] as const)).values()];
    if (occupiedCells.length === 0) {
      throw new Error(isSlab
        ? "Die Geschossdecke enthält keine vollständigen Rasterblöcke."
        : "Die Außenwand enthält keine vollständigen Rasterblöcke.");
    }
    const anchor = { ...occupiedCells[0]! };
    const blockTypeId = isSlab
      ? STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID
      : wallBlockTypeId;
    const objectRole = isSlab ? "slab" : "storey";
    const objectInstanceId = [
      areaId,
      isSlab ? "floor_slab" : "storey_walls",
      generationId,
      planningScopeIdentity(spec.scope),
      String(spec.storeyIndex),
    ].join("_");
    const payload: ChunkApiPlaceObjectCommandPayload = {
      type: "PlaceObject",
      userId: "editor_user",
      sessionId: `world_edit_planning_storey_${Date.now()}`,
      position: anchor,
      blockTypeId,
      ...(isSlab ? {
        runtimeBlockTypeId: STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
        libraryContext: STANDARD_FLOOR_SLAB_LIBRARY_CONTEXT,
      } : {}),
      objectTypeId: isSlab
        ? "planning_building_floor_slab"
        : "planning_building_storey_walls",
      objectKind: "block_composite",
      objectInstanceId,
      dimensions: planningBlockDimensions(occupiedCells),
      footprint: {
        ...spec.footprint,
        baseY: spec.storey.semanticBaseY,
        height: STANDARD_STOREY_HEIGHT_METERS,
        schemaVersion: isSlab
          ? "vectoplan-line-brush-floor-slab-footprint.v1"
          : "vectoplan-line-brush-storey-wall-footprint.v1",
      },
      occupiedCells,
      metadata: {
        schemaVersion: isSlab
          ? "vectoplan-line-brush-floor-slab.v1"
          : "vectoplan-line-brush-storey-walls.v1",
        source: "vectoplan-editor.world-edit.line-brush-building",
        semanticRole: isSlab ? "building.floor-slab" : "building.exterior-wall",
        familyRef: isSlab
          ? STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID
          : "world-edit.storey-walls",
        variantRef: safeString(buildingProgram.typeId, "standard"),
        generatedFromAreaId: areaId,
        generatedScope: spec.scope,
        storeyIndex: spec.storeyIndex,
        storeyHeightMeters: STANDARD_STOREY_HEIGHT_METERS,
        storeyHeightMillimeters: STANDARD_STOREY_HEIGHT_MILLIMETERS,
        semanticBaseY: spec.storey.semanticBaseY,
        semanticTopY: spec.storey.semanticTopY,
        minimumCellY: spec.storey.minimumCellY,
        maximumCellYExclusive: spec.storey.maximumCellYExclusive,
        assemblyRole: isSlab ? "floor-slab" : "exterior-wall",
        wallCellCount: isSlab ? 0 : occupiedCells.length,
        slabCellCount: isSlab ? occupiedCells.length : 0,
        ...(isSlab ? {
          slabThicknessMeters: 0.25,
          libraryPlacementContext: STANDARD_FLOOR_SLAB_LIBRARY_CONTEXT,
        } : {}),
        buildingProgram,
        editable: true,
        breakable: true,
        individuallyEditableBlocks: true,
        renderProfile: "construction-grid",
        constructionCells,
        // Integer routing cells retain chunk ownership; constructionCells
        // preserve the facade-aligned shapes and exact storey/slab heights.
        voxelOccupancy: "blocks",
        mergeKey: objectInstanceId,
      },
    };
    return {
      payload,
      ref: {
        objectInstanceId,
        anchor,
        role: objectRole,
        scope: spec.scope,
        storeyIndex: spec.storeyIndex,
      },
    };
  }

  function planningRoofObjectPlacement(
    areaId: string,
    generationId: string,
    spec: PlanningRoofBuildSpec,
    blockTypeId: string,
    buildingProgram: Readonly<Record<string, unknown>>,
  ): PlanningGeneratedObjectPlacement {
    const bounds = polygonAreaBounds(spec.points);
    if (!bounds) throw new Error("Dachkontur besitzt keine gültigen Abmessungen.");
    const summary = asRecord(spec.calculation.summary);
    const eavesY = spec.parameters.eavesHeightMm / 1_000;
    const maximumY = Number(summary.maximum_height_mm ?? spec.parameters.eavesHeightMm) / 1_000;
    const anchor = {
      x: Math.floor(bounds.minimum.x),
      y: Math.floor(eavesY),
      z: Math.floor(bounds.minimum.z),
    };
    const objectInstanceId = [
      areaId,
      "roof",
      generationId,
      planningScopeIdentity(spec.scope),
      String(spec.roofIndex),
    ].join("_");
    const payload: ChunkApiPlaceObjectCommandPayload = {
      type: "PlaceObject",
      userId: "editor_user",
      sessionId: `world_edit_planning_roof_${Date.now()}`,
      position: anchor,
      blockTypeId,
      objectTypeId: "building_roof",
      objectKind: "semantic_footprint",
      objectInstanceId,
      dimensions: {
        x: Math.max(1, Math.min(256, Math.ceil(bounds.size.x))),
        y: Math.max(1, Math.min(256, Math.ceil(Math.max(0.1, maximumY - eavesY)))),
        z: Math.max(1, Math.min(256, Math.ceil(bounds.size.z))),
      },
      footprint: {
        type: "Polygon",
        coordinateSpace: "world-cell-xz",
        coordinates: spec.rings.map((ring) => polygonAreaClosedCoordinates(ring)),
        baseY: eavesY,
        height: Math.max(0.1, maximumY - eavesY),
        schemaVersion: "vectoplan-building-roof-footprint.v1",
      },
      occupiedCells: semanticRoutingCells(bounds, eavesY),
      metadata: {
        schemaVersion: "vectoplan-building-roof.v1",
        source: "vectoplan-editor.world-edit.line-brush-building",
        familyRef: "world-edit.roof",
        variantRef: spec.parameters.roofType,
        semanticRole: "building.roof",
        generatedFromAreaId: areaId,
        generatedScope: spec.scope,
        generatedBy: "world-edit.line-brush",
        buildingProgram,
        roofType: spec.parameters.roofType,
        roofParameters: { ...spec.parameters },
        roofRequest: spec.request,
        roofCalculation: spec.calculation,
        solar: normalizeSolarSettings(null),
        editable: true,
        voxelOccupancy: "none",
        mergeKey: objectInstanceId,
      },
    };
    return {
      payload,
      ref: { objectInstanceId, anchor, role: "roof", scope: spec.scope },
    };
  }

  async function executePlanningBuildArea(
    request?: LineBrushBuildingGenerationRequest,
  ): Promise<boolean> {
    if (busy) return false;
    const runtime = polygonAreaRuntime("room");
    const draft = currentPlanningBuildAreaDraft();
    if (!runtime.closed || !draft) {
      setStatus("Bitte mindestens zwei verschiedene Linienpunkte setzen und den Pfad mit ESC/Enter abschließen.", "warning");
      return false;
    }
    const anchor = editingPlanningBuildAreaAnchor ?? {
      x: Math.floor(draft.bounds.minimum.x),
      y: Math.floor(draft.points[0]!.y + 1),
      z: Math.floor(draft.bounds.minimum.z),
    };
    const blockTypeId = planningBuildingBlockTypeId();
    const areaId = editingPlanningBuildAreaInstanceId
      ?? `planning_build_area_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const generationId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const buildingProgram = planningProgramMetadata(request);
    const previousGeneratedObjects = uniquePlanningGeneratedObjects([
      ...generatedPlanningObjects(editingPlanningBuildAreaMetadata),
      ...generatedPlanningObjects(editingPlanningBuildAreaMetadata, "retiredGeneratedObjects"),
    ]);
    busy = true;
    if (executeButton) executeButton.disabled = true;
    syncLineBrushStoreyEditing();
    syncStoreyQuickSettings();
    setStatus(editingPlanningBuildAreaInstanceId
      ? "Baukörper, Geschosse und Dach werden aktualisiert …"
      : "Baukörper wird aus Blockgeschossen und WorldEdit-Dach erzeugt …", "busy");
    try {
      const storeySpecs = planningStoreyBuildSpecs(draft, anchor.y, request);
      const roofSpecs = await planningRoofBuildSpecs(draft, anchor.y, request);
      const roofWallCells = roofSpecs.flatMap(spec => spec.wallCells ?? []);
      reserveLineBrushBuildingCellBudget(storeySpecs.reduce((count, spec) => count + spec.storey.occupiedCells.length, 0), roofWallCells.length);
      const completeStoreys = attachLineBrushRoofWallCells(coalesceLineBrushStoreys(storeySpecs), roofWallCells, blockTypeId);
      const placements: PlanningGeneratedObjectPlacement[] = [];
      // Build the complete generation locally first. The Chunk service receives
      // all child objects and the parent in one ObjectBatch transaction, so
      // overlapping replacement cells are rolled back together on any error.
      for (const spec of completeStoreys) {
        placements.push(planningStoreyObjectPlacement(
          areaId,
          generationId,
          spec,
          blockTypeId,
          buildingProgram,
          "wall",
        ));
        placements.push(planningStoreyObjectPlacement(
          areaId,
          generationId,
          spec,
          blockTypeId,
          buildingProgram,
          "slab",
        ));
      }
      for (const spec of roofSpecs) {
        placements.push(planningRoofObjectPlacement(
          areaId,
          generationId,
          spec,
          blockTypeId,
          buildingProgram,
        ));
      }
      const placedObjects = placements.map((placement) => placement.ref);
      const metadata: Record<string, unknown> = {
        ...editingPlanningBuildAreaMetadata,
        wallBlockTypeId: blockTypeId,
        schemaVersion: "vectoplan-planning-build-area.v1",
        source: "vectoplan-editor.world-edit.planning-line-brush",
        semanticRole: "planning_build_area",
        storageProfile: "semantic-planning-footprint",
        editable: true,
        voxelOccupancy: "none",
        label: "Linien-Brush-Baukörper",
        areaM2: draft.estimatedAreaM2,
        segmentCount: draft.segments.length,
        widthM: draft.width,
        pathBrush: persistedPathBrush(draft),
        buildingLayout: currentPlanningBuildingLayout(draft, request),
        buildingProgram,
        storeyCount: planningBuildingStoreyProfile.baseCount,
        storeyHeightMeters: STANDARD_STOREY_HEIGHT_METERS,
        storeyHeightMillimeters: STANDARD_STOREY_HEIGHT_MILLIMETERS,
        storeyProfile: {
          baseCount: planningBuildingStoreyProfile.baseCount,
          segmentAdjustments: { ...planningBuildingStoreyProfile.segmentAdjustments },
          // Keep the legacy key readable by older clients. Values are signed
          // since v2, despite the historical "Extra" name.
          segmentExtraCounts: { ...planningBuildingStoreyProfile.segmentAdjustments },
        },
        generatedObjects: serializedPlanningGeneratedObjects(placedObjects),
        retiredGeneratedObjects: serializedPlanningGeneratedObjects(previousGeneratedObjects),
        generationId,
        mergeKey: areaId,
      };
      const payload: ChunkApiPlaceObjectCommandPayload = {
        type: "PlaceObject",
        userId: "editor_user",
        sessionId: `world_edit_planning_build_area_${Date.now()}`,
        position: anchor,
        blockTypeId,
        objectTypeId: "planning_build_area",
        objectKind: "semantic_footprint",
        objectInstanceId: areaId,
        dimensions: {
          x: Math.max(1, Math.min(256, Math.ceil(draft.bounds.maximum.x - draft.bounds.minimum.x))),
          y: 1,
          z: Math.max(1, Math.min(256, Math.ceil(draft.bounds.maximum.z - draft.bounds.minimum.z))),
        },
        footprint: {
          ...draft.footprint,
          baseY: draft.points[0]!.y,
          height: 0.08,
          schemaVersion: "vectoplan-planning-build-area.v1",
        },
        occupiedCells: semanticRoutingCells({
          minimum: { x: draft.bounds.minimum.x, z: draft.bounds.minimum.z },
          maximum: { x: draft.bounds.maximum.x, z: draft.bounds.maximum.z },
        }, anchor.y),
        metadata,
      };
      const atomicPayload: ChunkApiObjectBatchCommandPayload = {
        type: "ObjectBatch",
        userId: "editor_user",
        sessionId: `world_edit_planning_generation_${Date.now()}`,
        position: anchor,
        commands: [...placements.map((placement) => placement.payload), payload],
      };
      const result = await options.worldRuntime.getSource().sendCommand(atomicPayload, {
        reason: editingPlanningBuildAreaInstanceId
          ? "world-edit:planning-building:atomic-update"
          : "world-edit:planning-building:atomic-create",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        throw new Error(commandErrorMessage(result));
      }
      // Now that the parent references the complete new generation, retire
      // old refs. The Chunk service preserves cells owned by the new
      // generation and cells replaced manually by a user.
      const failedRetirements = await removePlanningGeneratedObjectRefs(
        previousGeneratedObjects,
        true,
      );
      metadata.retiredGeneratedObjects = serializedPlanningGeneratedObjects(failedRetirements);
      let cleanupMetadataPersisted = failedRetirements.length === previousGeneratedObjects.length;
      if (!cleanupMetadataPersisted) {
        const cleanupMetadataResult = await options.worldRuntime.getSource().sendCommand({
          ...payload,
          sessionId: `world_edit_planning_build_area_cleanup_${Date.now()}`,
          metadata,
        }, {
          reason: "world-edit:planning-build-area:record-retirement-cleanup",
          reloadDirtyChunks: false,
        });
        cleanupMetadataPersisted = !isChunkApiFailedResult(cleanupMetadataResult);
        if (!cleanupMetadataPersisted) {
          options.logger?.warn?.("Planning object retirement state could not be compacted; the safe parent generation remains active.", {
            error: commandErrorMessage(cleanupMetadataResult),
            failedRetirementCount: failedRetirements.length,
          });
        }
      }
      let sceneRefreshPending = false;
      try {
        await options.sceneRuntime.reloadDirtyChunks("world-edit-planning-build-area");
      } catch (reloadError) {
        sceneRefreshPending = true;
        options.logger?.warn?.("Planning building was saved, but the local scene reload must be retried.", {
          error: normalizeUnknownError(reloadError),
        });
      }
      editingPlanningBuildAreaInstanceId = areaId;
      editingPlanningBuildAreaAnchor = { ...anchor };
      editingPlanningBuildAreaMetadata = metadata;
      planningBuildingDraftDirty = false;
      planningBuildingSceneExpectedObjects = planningBuildingExpectedObjectChunks(placements);
      // reloadDirtyChunks resolves after registry updates even for a degraded
      // request, and mesh building runs later. Only installed meshes can retire
      // the fallback; a fulfilled network promise is not a scene-ready signal.
      planningBuildingSceneRefreshPending = generationId;
      sceneRefreshPending = !planningBuildingSceneGenerationReady(generationId);
      if (!sceneRefreshPending) planningBuildingSceneRefreshPending = null;
      else { schedulePlanningBuildingSceneRefresh(); startPlanningBuildingSceneMonitor(); }
      planningBuildingGenerationRequest = request ?? planningBuildingGenerationRequest;
      if (selectedStoreyBuildArea || activeTool === "storey") {
        selectedStoreyBuildArea = {
          objectInstanceId: areaId,
          anchor: { ...anchor },
          footprint: payload.footprint,
          metadata,
        };
      }
      rebuildPolygonAreaScene("room");
      const cleanupPending = failedRetirements.length > 0 || !cleanupMetadataPersisted;
      setStatus(
        sceneRefreshPending
          ? "Baukörper gespeichert. Die Vorschau bleibt sichtbar, bis die Szene erfolgreich nachgeladen wurde."
          : cleanupPending
          ? `Baukörper sicher gespeichert; ${failedRetirements.length} ältere Objekt-Refs werden beim nächsten Speichern erneut bereinigt.`
          : `Baukörper gespeichert: ${planningBuildingStoreyProfile.baseCount} Grundgeschosse, ${placedObjects.filter((ref) => ref.role === "storey").length} Außenwandkörper, ${placedObjects.filter((ref) => ref.role === "slab").length} Stahlbetondecken und ${placedObjects.filter((ref) => ref.role === "roof").length} WorldEdit-Dachzonen.`,
        cleanupPending || sceneRefreshPending ? "warning" : "ready",
      );
      return true;
    } catch (error) {
      options.logger?.warn?.("Planning build-area placement failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
      return false;
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      syncLineBrushStoreyEditing();
      syncStoreyQuickSettings();
      refreshHud();
    }
  }

  function planningBuildingExpectedObjectChunks(placements: readonly PlanningGeneratedObjectPlacement[]): Map<string, Set<string>> {
    const chunks = new Map<string, Set<string>>();
    for (const placement of placements) {
      // Construction cells render in their owning chunk. Semantic roofs are
      // complete meshes rendered only in the primary/anchor chunk.
      const cells = asRecord(placement.payload.metadata).renderProfile === "construction-grid"
        ? placement.payload.occupiedCells ?? [] : [placement.ref.anchor];
      for (const cell of cells) {
        const key = `${Math.floor(cell.x / 16)}:${Math.floor(cell.y / 16)}:${Math.floor(cell.z / 16)}`;
        let ids = chunks.get(key);
        if (!ids) { ids = new Set(); chunks.set(key, ids); }
        ids.add(placement.ref.objectInstanceId);
      }
    }
    return chunks;
  }

  function planningBuildingSceneGenerationReady(generationId: string): boolean {
    const scene = options.sceneRuntime.getScene();
    if (!scene || !editingPlanningBuildAreaInstanceId) return false;
    const rendered = new Map<string, Set<string>>();
    const unpartitioned = new Set<string>();
    const visibleChunkKeys = new Set<string>();
    let parentGenerationPresent = false;
    scene.traverse((object) => {
      // Selected source meshes are intentionally hidden below their chunk
      // group. Test loaded chunk visibility, not those temporary editing flags.
      let chunkKey: string | null = null;
      let branchVisible = true;
      let ref = asRecord(object.userData.semanticObjectRef);
      for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
        const key = ancestor.userData.chunkKey;
        if (typeof key === "string") chunkKey = key;
        if (ref.objectInstanceId === undefined) ref = asRecord(ancestor.userData.semanticObjectRef);
        if (!ancestor.visible && !hiddenPlanningBuildingObjects.has(ancestor)) branchVisible = false;
      }
      if (!branchVisible) return;
      if (chunkKey) visibleChunkKeys.add(chunkKey);
      if (ref.objectInstanceId === editingPlanningBuildAreaInstanceId
        && asRecord(ref.metadata).generationId === generationId) parentGenerationPresent = true;
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      const id = safeString(ref.objectInstanceId, "");
      if (!id) return;
      if (!chunkKey) { unpartitioned.add(id); return; }
      let ids = rendered.get(chunkKey);
      if (!ids) { ids = new Set(); rendered.set(chunkKey, ids); }
      ids.add(id);
    });
    const registry = options.worldRuntime.getRegistry();
    // The visibility contract includes requested chunks whose replacement
    // meshes are still queued. It deliberately excludes unloaded remote parts.
    for (const key of registry.getVisibleChunkKeys?.() ?? []) visibleChunkKeys.add(key);
    const anchor = editingPlanningBuildAreaAnchor;
    const parentKey = anchor ? `${Math.floor(anchor.x / 16)}:${Math.floor(anchor.y / 16)}:${Math.floor(anchor.z / 16)}` : null;
    if ((!visibleChunkKeys.size || (parentKey && visibleChunkKeys.has(parentKey))) && !parentGenerationPresent) return false;
    let checked = 0;
    if (visibleChunkKeys.size > 0) {
      for (const [key, expected] of planningBuildingSceneExpectedObjects) {
        if (!visibleChunkKeys.has(key)) continue;
        for (const id of expected) {
          if (!rendered.get(key)?.has(id)) return false;
          checked += 1;
        }
      }
    } else {
      // Unpartitioned scene adapters expose the same semantic IDs on complete
      // meshes rather than one mesh per chunk.
      for (const expected of planningBuildingSceneExpectedObjects.values()) {
        for (const id of expected) {
          if (!unpartitioned.has(id)) return false;
          checked += 1;
        }
      }
    }
    // No currently visible portion means there is no drawn fallback to replace;
    // normal streaming owns the building when the user returns to that area.
    return checked > 0 || visibleChunkKeys.size > 0;
  }

  function completePlanningBuildingSceneRefreshIfReady(): boolean {
    const generationId = planningBuildingSceneRefreshPending;
    if (!generationId) return true;
    if (!planningBuildingSceneGenerationReady(generationId)) return false;
    planningBuildingSceneRefreshPending = null;
    if (planningBuildingSceneRefreshTimer) window.clearTimeout(planningBuildingSceneRefreshTimer);
    planningBuildingSceneRefreshTimer = 0;
    rebuildPolygonAreaScene("room");
    setStatus("Baukörper gespeichert und Szene nachgeladen.", "ready");
    return true;
  }

  function schedulePlanningBuildingSceneRefresh(delay = 1000): void {
    if (destroyed || !planningBuildingSceneRefreshPending) return;
    if (planningBuildingSceneRefreshTimer) window.clearTimeout(planningBuildingSceneRefreshTimer);
    const generationId = planningBuildingSceneRefreshPending;
    planningBuildingSceneRefreshTimer = window.setTimeout(async () => {
      planningBuildingSceneRefreshTimer = 0;
      if (destroyed || planningBuildingSceneRefreshPending !== generationId) return;
      if (busy) { schedulePlanningBuildingSceneRefresh(delay); return; }
      if (completePlanningBuildingSceneRefreshIfReady()) return;
      try {
        await options.sceneRuntime.reloadDirtyChunks("world-edit-planning-build-area-retry");
        if (destroyed || planningBuildingSceneRefreshPending !== generationId) return;
        if (completePlanningBuildingSceneRefreshIfReady()) return;
      } catch { /* Keep the normal-material fallback and retry independently of editing. */ }
      if (planningBuildingSceneRefreshPending === generationId) schedulePlanningBuildingSceneRefresh(Math.min(30_000, delay * 2));
    }, delay);
  }

  async function adjustPlanningBuildingStoreys(
    delta: number,
    scope: StoreyTargetScope,
    behavior: Readonly<{ allowDraft?: boolean }> = {},
  ): Promise<void> {
    if (busy) return;
    const draft = currentPlanningBuildAreaDraft();
    const editingDraft = isBuildingLineBrush()
      && (activeTool === "storey" || (behavior.allowDraft === true && activeTool === "room"));
    if ((!selectedStoreyBuildArea || !editingPlanningBuildAreaInstanceId) && !editingDraft) {
      setStatus("Bitte zuerst einen Linien-Brush-Baukörper auswählen.", "warning");
      return;
    }
    if (!draft) {
      setStatus("Bitte zuerst mindestens ein vollständiges Liniensegment zeichnen.", "warning");
      return;
    }
    const direction = delta < 0 ? -1 : 1;
    const previous = planningBuildingStoreyProfile;
    const previousDirty = planningBuildingDraftDirty;
    if (scope === "all") {
      const nextCount = Math.max(1, Math.min(80, previous.baseCount + direction));
      if (nextCount === previous.baseCount) {
        setStatus("Ein Baukörper benötigt mindestens ein Geschoss.", "warning");
        return;
      }
      planningBuildingStoreyProfile = { ...previous, baseCount: nextCount };
      lineBrushQuickSettings?.sync({ storeyCount: nextCount });
    } else {
      const segmentIndex = planningScopeSegmentIndex(scope);
      if (segmentIndex === null) return;
      const key = String(segmentIndex);
      const currentAdjustment = Math.trunc(Number(previous.segmentAdjustments[key]) || 0);
      const minimumAdjustment = 1 - previous.baseCount;
      const maximumAdjustment = 80 - previous.baseCount;
      const nextAdjustment = Math.max(
        minimumAdjustment,
        Math.min(maximumAdjustment, currentAdjustment + direction),
      );
      if (nextAdjustment === currentAdjustment) {
        setStatus(
          direction < 0
            ? "Dieses Segment benötigt mindestens ein Geschoss."
            : "Für dieses Segment ist die maximale Geschosszahl erreicht.",
          "warning",
        );
        return;
      }
      const segmentAdjustments = { ...previous.segmentAdjustments };
      if (nextAdjustment === 0) delete segmentAdjustments[key];
      else segmentAdjustments[key] = nextAdjustment;
      planningBuildingStoreyProfile = {
        ...previous,
        segmentAdjustments,
      };
    }
    planningBuildingDraftDirty = true;
    selectedStoreyScope = scope;
    syncLineBrushStoreyEditing();
    syncStoreyQuickSettings();
    if (activeTool === "room" && isBuildingLineBrush()) rebuildPolygonAreaScene("room");
    if (!editingPlanningBuildAreaInstanceId) {
      setStatus(
        scope === "all"
          ? `Live-Vorschau auf ${planningBuildingStoreyProfile.baseCount} Geschosse eingestellt.`
          : `Liniensegment ${(planningScopeSegmentIndex(scope) ?? 0) + 1} wird mit ${planningStoreyCountForScope(scope)} Geschossen dargestellt.`,
        "ready",
      );
      return;
    }
    const saved = await executePlanningBuildArea(planningBuildingGenerationRequest ?? undefined);
    if (!saved) {
      planningBuildingStoreyProfile = previous;
      planningBuildingDraftDirty = previousDirty;
      lineBrushQuickSettings?.sync({ storeyCount: previous.baseCount });
      syncLineBrushStoreyEditing();
      syncStoreyQuickSettings();
      if (activeTool === "room" && isBuildingLineBrush()) rebuildPolygonAreaScene("room");
      return;
    }
    syncLineBrushStoreyEditing();
    syncStoreyQuickSettings(true);
  }

  async function executeRoom(): Promise<void> {
    if (busy) return;
    const runtime = polygonAreaRuntime("room");
    if (!runtime.closed || !validPolygonArea(runtime.points)) {
      setStatus("Bitte zuerst eine gültige Raumkontur mit mindestens drei Punkten schließen.", "warning");
      return;
    }
    const bounds = polygonAreaBounds(runtime.points);
    if (!bounds) return;
    // Chunk-service geometry updates are idempotent only while occupiedCells
    // stay constant. Retain the original room anchor when resizing an existing
    // room, including when its minimum X/Y/Z face is dragged outward.
    const anchor = editingRoomAnchor ?? {
      x: Math.floor(bounds.minimum.x),
      y: Math.floor(runtime.points[0]!.y + 1),
      z: Math.floor(bounds.minimum.z),
    };
    const targetCells = options.sceneRuntime.getTargetCells();
    const blockTypeId = targetCells.sourceCell?.blockTypeId || "system_terrain";
    const areaM2 = polygonAreaPlanArea(runtime.points);
    const roomId = editingRoomInstanceId
      ?? `room_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    busy = true;
    if (executeButton) executeButton.disabled = true;
    setStatus(editingRoomInstanceId ? "Raum wird aktualisiert …" : "Raum und Energiezone werden angelegt …", "busy");
    try {
      const payload: ChunkApiPlaceObjectCommandPayload = {
        type: "PlaceObject",
        userId: "editor_user",
        sessionId: `world_edit_room_${Date.now()}`,
        position: anchor,
        blockTypeId,
        objectTypeId: "space_room",
        objectKind: "semantic_footprint",
        objectInstanceId: roomId,
        dimensions: {
          x: Math.max(1, Math.min(256, Math.ceil(bounds.size.x))),
          y: Math.max(1, Math.min(256, Math.ceil(roomHeight))),
          z: Math.max(1, Math.min(256, Math.ceil(bounds.size.z))),
        },
        footprint: {
          type: "Polygon",
          coordinateSpace: "world-cell-xz",
          coordinates: [polygonAreaClosedCoordinates(runtime.points)],
          baseY: runtime.points[0]!.y,
          height: roomHeight,
          schemaVersion: "vectoplan-space-room.v1",
        },
        occupiedCells: [anchor],
        metadata: {
          schemaVersion: "vectoplan-space-room.v1",
          source: "vectoplan-editor.world-edit.room",
          familyRef: "world-edit.room",
          variantRef: "default",
          roomType,
          label: roomLabel,
          areaM2,
          volumeM3: areaM2 * roomHeight,
          energyZone: true,
          invisibleVolume: true,
          mergeKey: roomId,
          libraryPlacementContext: {
            libraryItemId: "world-edit-room",
            familyId: "world-edit.room",
            packageId: "world-edit.room",
            variantId: "default",
            objectKind: "semantic_footprint",
            libraryRef: {
              libraryItemId: "world-edit-room",
              familyId: "world-edit.room",
              packageId: "world-edit.room",
              variantId: "default",
              objectKind: "semantic_footprint",
            },
            placementCommand: {
              kind: "PlaceObject",
              runtimeBlockTypeId: blockTypeId,
              blockTypeId,
            },
            semanticProfile: {
              role: "room",
              variables: {
                "semantic.role": "room",
                "dimensions.width_mm": bounds.size.x * 1000,
                "dimensions.height_mm": roomHeight * 1000,
                "dimensions.depth_mm": bounds.size.z * 1000,
                "room.type": roomType,
                "room.label": roomLabel,
                "room.area_m2": areaM2,
                "room.volume_m3": areaM2 * roomHeight,
                "energy.zone": true,
              },
            },
          },
        },
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: editingRoomInstanceId ? "world-edit:room:update" : "world-edit:room:create",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      await options.sceneRuntime.reloadDirtyChunks("world-edit-room");
      editingRoomInstanceId = roomId;
      editingRoomAnchor = { ...anchor };
      rebuildPolygonAreaScene("room");
      setStatus(`${roomLabel} · ${areaM2.toFixed(2)} m² wurde als Raum gespeichert.`, "ready");
    } catch (error) {
      options.logger?.warn?.("Room placement failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  async function executeStair(): Promise<void> {
    if (busy) return;
    const runtime = polygonAreaRuntime("stair");
    if (!runtime.closed || !validPolygonArea(runtime.points)) {
      setStatus("Bitte zuerst einen gültigen Treppenbereich mit mindestens drei Punkten schließen.", "warning");
      return;
    }
    const bounds = polygonAreaBounds(runtime.points);
    if (!bounds) return;
    const anchor = {
      x: Math.floor(bounds.minimum.x),
      y: Math.floor(runtime.points[0]!.y + 1),
      z: Math.floor(bounds.minimum.z),
    };
    const targetCells = options.sceneRuntime.getTargetCells();
    const blockTypeId = targetCells.sourceCell?.blockTypeId || "system_terrain";
    const stairId = `stair_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    busy = true;
    if (executeButton) executeButton.disabled = true;
    setStatus("Parametrische Treppe wird angelegt …", "busy");
    try {
      const payload: ChunkApiPlaceObjectCommandPayload = {
        type: "PlaceObject",
        userId: "editor_user",
        sessionId: `world_edit_stair_${Date.now()}`,
        position: anchor,
        blockTypeId,
        objectTypeId: "building_stair",
        objectKind: "semantic_footprint",
        objectInstanceId: stairId,
        dimensions: {
          x: Math.max(1, Math.min(256, Math.ceil(bounds.size.x))),
          y: 3,
          z: Math.max(1, Math.min(256, Math.ceil(bounds.size.z))),
        },
        footprint: {
          type: "Polygon",
          coordinateSpace: "world-cell-xz",
          coordinates: [polygonAreaClosedCoordinates(runtime.points)],
          baseY: runtime.points[0]!.y,
          height: 3,
          schemaVersion: "vectoplan-building-stair.v1",
        },
        occupiedCells: [anchor],
        metadata: {
          schemaVersion: "vectoplan-building-stair.v1",
          source: "vectoplan-editor.world-edit.stair",
          familyRef: "world-edit.stair",
          variantRef: stairParameters.stairType,
          semanticRole: "stair",
          label: "Treppe",
          stairParameters: {...stairParameters},
          libraryPlacementContext: {
            libraryItemId: "world-edit-stair",
            familyId: "world-edit.stair",
            packageId: "world-edit.stair",
            variantId: stairParameters.stairType,
            objectKind: "semantic_footprint",
            placementCommand: {kind: "PlaceObject", runtimeBlockTypeId: blockTypeId, blockTypeId},
            semanticProfile: {
              role: "stair",
              variables: {
                "semantic.role": "stair",
                "stair.type": stairParameters.stairType,
                "stair.width_mm": stairParameters.widthMm,
                "stair.tread_count": stairParameters.treadCount,
                "stair.start_side": stairParameters.startSide,
                "stair.end_side": stairParameters.endSide,
                "stair.direction": stairParameters.direction,
              },
            },
          },
        },
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: "world-edit:stair:create",
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      await options.sceneRuntime.reloadDirtyChunks("world-edit-stair");
      rebuildPolygonAreaScene("stair");
      setStatus(`Treppe · ${stairParameters.widthMm} mm · ${stairParameters.treadCount} Auftritte gespeichert.`, "ready");
    } catch (error) {
      options.logger?.warn?.("Stair placement failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  async function executeClipboard(
    requestedOperation?: WorldEditOperation,
    target?: ChunkApiWorldPosition | null,
  ): Promise<boolean> {
    if (busy) return false;
    const requested = requestedOperation ?? operation;
    const clipboardOperation = ["copy", "cut", "paste"].includes(requested) ? requested : "copy";
    if (clipboardOperation !== "paste" && (!selection.first || !selection.second)) {
      setStatus("Bitte zuerst mit dem Selection Tool einen Bereich markieren.", "warning");
      return false;
    }
    if (clipboardOperation === "paste" && clipboard.length === 0) {
      setStatus("Die Zwischenablage ist leer. Bitte zuerst Copy oder Cut ausführen.", "warning");
      return false;
    }
    const anchor = clipboardOperation === "paste"
      ? target ?? cellPosition(options.sceneRuntime.getTargetCells().placementCell)
      : selection.first;
    if (!anchor) {
      setStatus("Kein gültiges Einfügeziel unter dem Fadenkreuz.", "warning");
      return false;
    }
    busy = true;
    if (executeButton) executeButton.disabled = true;
    setStatus(`${clipboardOperation === "copy" ? "Kopieren" : clipboardOperation === "cut" ? "Ausschneiden" : "Einfügen"} wird ausgeführt …`, "busy");
    try {
      const payload: ChunkApiWorldEditCommandPayload = {
        type: "WorldEdit",
        userId: "editor_user",
        sessionId: `world_edit_clipboard_${Date.now()}`,
        position: anchor,
        tool: "clipboard",
        operation: clipboardOperation,
        ...(clipboardOperation !== "paste" ? { bounds: { min: selection.first, max: selection.second } } : {}),
        ...(clipboardOperation === "paste" ? { clipboard } : {}),
        parcelMask: clipboardParcelMaskPayload(),
        commandSource: WORLD_EDIT_COMMAND_SOURCE,
        commandMetadata: {
          source: "world-edit-controller",
          projectPublicId: parcelSelection.projectPublicId,
        },
      };
      const result = await options.worldRuntime.getSource().sendCommand(payload, {
        reason: `world-edit:clipboard:${clipboardOperation}`,
        reloadDirtyChunks: false,
      });
      if (isChunkApiFailedResult(result)) {
        setStatus(commandErrorMessage(result), "error");
        return false;
      }
      const commandResult = clipboardCommandResult(result);
      if (!commandResult) {
        setStatus("Die Serverantwort konnte nicht als WorldEdit-Ergebnis gelesen werden. Die Auswahl bleibt erhalten.", "error");
        return false;
      }
      const rawClipboard = clipboardEntriesFromCommandResult(result);
      if (clipboardOperation === "copy" || clipboardOperation === "cut") {
        clipboard = rawClipboard;
        if (clipboard.length === 0) {
          setStatus("Der Server hat keine Zwischenablage zurückgegeben. Die Auswahl bleibt erhalten; bitte Rechtsklick erneut versuchen.", "error");
          return false;
        }
      }
      if (commandResult.changed) await options.sceneRuntime.reloadDirtyChunks(`world-edit-${clipboardOperation}`);
      setStatus(
        clipboardOperation === "copy"
          ? `${clipboard.length} Zellen kopiert.`
          : clipboardOperation === "cut"
            ? `${clipboard.length} Zellen ausgeschnitten.`
            : "Zwischenablage eingefügt.",
        "ready",
      );
      return true;
    } catch (error) {
      options.logger?.warn?.("WorldEdit clipboard command failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
      return false;
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  async function executeClipboardCurrent(captureOperation: "copy" | "cut"): Promise<void> {
    if (clipboardPhase === "move") {
      const pasted = await executeClipboard("paste", clipboardAnchor);
      if (pasted) {
        // A confirmed paste is one complete transaction. Returning to select
        // removes the preview/gizmo only after the server accepted the paste.
        resetClipboardPreview();
      } else {
        // Network/validation failures must never discard the live preview.
        clipboardPhase = "move";
        options.root.dataset.worldEditClipboardPhase = clipboardPhase;
        options.root.dataset.worldEditClipboardCells = String(clipboard.length);
        rebuildSelectionScene();
        options.root.dataset.worldEditClipboardGizmoHandles = String(clipboardHandles.length);
        startClipboardGizmoHover();
        refreshHud();
      }
      return;
    }
    if (await executeClipboard(captureOperation)) beginClipboardPreview();
  }

  async function handleWorldEditIntent(intent: EditorInputWorldEditIntent): Promise<boolean> {
    if (busy && intent.action !== "primary-release" && intent.action !== "secondary-release") return true;
    return activeSystem()?.handleIntent(intent) ?? false;
  }

  function handleWorldEditKeyDown(event: KeyboardEvent): void {
    if (lineBrushQuickSettings?.isLibraryOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        lineBrushQuickSettings.closeLibrary();
      }
      return;
    }
    if (storeyQuickSettings?.isOpen() && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      storeyQuickSettings.close(true);
      return;
    }
    if (solarPanel?.isOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        solarPanel.close();
      }
      return;
    }
    if (roofQuickSettings?.isOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        roofQuickSettings.close();
      }
      return;
    }
    if (stairQuickSettings?.isOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        stairQuickSettings.close();
      }
      return;
    }
    if (options.root.dataset.creativeInventoryOpen === "true") return;
    if (activeTool === "tentacle" && (event.key.toLowerCase() === "a" || event.key.toLowerCase() === "b")) {
      event.preventDefault();
      event.stopPropagation();
      planningRoadConflictChoice = event.key.toLowerCase() === "b" ? "bridge" : "fill";
      rebuildTentacleScene();
      refreshHud();
      setStatus(
        planningRoadConflictChoice === "bridge"
          ? "Höhenlücken werden als Brücken-Platzhalter markiert. Bergdurchstöße bleiben automatisch Tunnel."
          : "Höhenlücken werden als Auffüllungs-Platzhalter markiert. Bergdurchstöße bleiben automatisch Tunnel.",
        "ready",
      );
      return;
    }
    if (!activeSystem()?.handleKeyDown?.(event)) return;
    refreshHud();
  }

  function retainPlanningBuildingOnToolExit(): void {
    const runtime = polygonAreaRuntime("room");
    if (!isBuildingLineBrush() || !currentPlanningBuildAreaDraft()) return;
    // Closing the tool finishes the current building. On failure its draft
    // remains in the scene, so switching tools never discards the user's work.
    runtime.closed = true;
    if (!busy && (!editingPlanningBuildAreaInstanceId || planningBuildingDraftDirty)) {
      void executePlanningBuildArea(planningBuildingGenerationRequest ?? undefined);
    }
  }

  function activate(tool: WorldEditTool, nextOperation: WorldEditOperation = "set"): void {
    if (destroyed) return;
    const previousTool = activeTool;
    const previousSystem = previousTool ? systemRegistry?.get(previousTool) : null;
    storeyDragHandle?.setEnabled(false);
    if (previousTool === "room" && tool !== "room") retainPlanningBuildingOnToolExit();
    stopSelectionDrag();
    stopParcelGridDrag(false);
    stopClipboardMove();
    stopTentacleDrawing();
    stopPolygonAreaInteraction("room");
    stopPolygonAreaInteraction("stair");
    stopPolygonAreaInteraction("roof");
    lineBrushQuickSettings?.close(false);
    storeyQuickSettings?.close(false);
    roofQuickSettings?.close(false);
    stairQuickSettings?.close();
    solarPanel?.close(false);
    restoreWorkspaceInput("world-edit-activate");
    activeTool = tool;
    refreshPlanningBuildingEditVisuals();
    const system = systemRegistry?.get(tool);
    if (!system) throw new Error(`WorldEdit-System nicht initialisiert: ${tool}`);
    if (previousTool !== tool) previousSystem?.onDeactivate?.(tool);
    if (previousTool && (previousTool === "room" || previousTool === "stair" || previousTool === "roof") && previousTool !== tool) {
      if (previousTool === "roof") {
        resetPolygonArea("roof");
        disposeRoofZoneGroup();
        roofZoneSignature = "";
      } else if (previousTool !== "room") disposePolygonAreaGroup(previousTool);
    }
    operation = nextOperation;
    configureOperationSelect(tool);
    syncPanelVisibility();
    options.root.dataset.worldEditActive = "true";
    options.root.dataset.worldEditTool = tool;
    options.sceneRuntime.setWorldEditIntentHandler(handleWorldEditIntent, { maxDistance: system.ui.maxDistance });
    system.onActivate?.(previousTool);
    if (tool === "storey" || previousTool === "room" || previousTool === "storey") rebuildPolygonAreaScene("room");
    storeyDragHandle?.setEnabled(tool === "storey");
    if (tool === "room" && isBuildingLineBrush()) {
      lineBrushQuickSettings?.open({
        storeyCount: planningBuildingStoreyProfile.baseCount,
      });
      syncLineBrushStoreyEditing();
    }
    syncParcelGuideVisibility(`world-edit.parcel-guides-tool:${tool}`);
    rebuildSelectionScene();
    setStatus(isBuildingLineBrush() && tool === "room"
      ? "Gebäude-Linien-Brush: Gerade Segmente setzen; ESC/Enter erzeugt die editierbare Baufläche."
      : isPlanningWorkspace() && tool === "tentacle"
        ? "Tentacle-Straßenwerkzeug: Pfad zeichnen; Höhenkonflikte werden als Auffüllung/Brücke oder automatisch als Tunnel markiert."
        : system.ui.activationMessage, "ready");
    refreshHud();
    if (options.sceneRuntime.getWorkspaceMode() === "first-person" && !storeyQuickSettings?.isOpen()) {
      try { void options.sceneRuntime.getInputController()?.requestPointerLock("world-edit-activate"); } catch { /* best effort */ }
    }
  }

  function deactivate(reason = "deactivate"): void {
    if (destroyed) return;
    const previousTool = activeTool;
    const previousSystem = previousTool ? systemRegistry?.get(previousTool) : null;
    storeyDragHandle?.setEnabled(false);
    if (previousTool === "room" && reason !== "destroy") retainPlanningBuildingOnToolExit();
    activeTool = null;
    refreshPlanningBuildingEditVisuals();
    stopSelectionDrag();
    stopParcelGridDrag(false);
    stopClipboardMove();
    stopTentacleDrawing();
    stopPolygonAreaInteraction("room");
    stopPolygonAreaInteraction("stair");
    stopPolygonAreaInteraction("roof");
    lineBrushQuickSettings?.close(false);
    storeyQuickSettings?.close(false);
    roofQuickSettings?.close(false);
    stairQuickSettings?.close();
    solarPanel?.close(false);
    restoreWorkspaceInput("world-edit-deactivate");
    panel.hidden = true;
    selection = { first: null, second: null };
    editingRoomInstanceId = null;
    editingRoomAnchor = null;
    selectedStoreyBuildArea = null;
    restoreEditingRoofObjects();
    editingRoofInstanceId = null;
    editingRoofAnchor = null;
    editingRoofMetadata = {};
    editingRoofHoleRings = [];
    brushTarget = null;
    disposeSelectionGroup();
    disposeTentacleGroup();
    if (reason === "destroy") disposePolygonAreaGroup("room");
    else rebuildPolygonAreaScene("room");
    disposePolygonAreaGroup("stair");
    disposePolygonAreaGroup("roof");
    disposeRoofZoneGroup();
    roofZoneSignature = "";
    options.sceneRuntime.setWorldEditIntentHandler(null);
    previousSystem?.onDeactivate?.(null);
    delete options.root.dataset.worldEditActive;
    delete options.root.dataset.worldEditTool;
    delete options.root.dataset.rulerSnap;
    delete options.root.dataset.polygonAreaTool;
    delete options.root.dataset.polygonAreaPoints;
    delete options.root.dataset.polygonAreaClosed;
    syncParcelGuideVisibility(`world-edit.parcel-guides-${reason}`);
    options.logger?.debug?.("WorldEdit controller deactivated.", { reason });
  }

  function toolFromValue(value: unknown): WorldEditTool {
    return systemRegistry?.match(value) ?? "selection";
  }

  function handleActivateEvent(event: Event): void {
    const detail = asRecord((event as CustomEvent).detail);
    if (detail.active === false) {
      deactivate("user-inventory-selection");
      return;
    }
    const tool = toolFromValue(detail.tool ?? detail.toolId);
    const requestedOperation = safeString(detail.operation, "").toLowerCase();
    const nextOperation: WorldEditOperation = ["set", "wall", "fill", "replace", "clear", "copy", "cut", "paste"].includes(requestedOperation)
      ? requestedOperation as WorldEditOperation
      : operation;
    activate(tool, nextOperation);
  }

  function setNumericInput(input: HTMLInputElement | null, value: unknown): void {
    if (!input) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    const minimum = Number(input.min || Number.NEGATIVE_INFINITY);
    const maximum = Number(input.max || Number.POSITIVE_INFINITY);
    input.value = String(Math.min(maximum, Math.max(minimum, Math.round(numericValue))));
  }

  const supportedRoofTypes = new Set<RoofType>([
    "flat", "gable", "hipped", "half_hipped", "pent", "mansard", "trapezoid",
    "butterfly", "pyramid", "barrel", "sawtooth", "imported",
  ]);

  function roofNumber(
    source: Readonly<Record<string, unknown>>,
    keys: readonly string[],
    fallback: number,
    minimum: number,
    maximum: number,
    integer = false,
  ): number {
    const raw = keys.map((key) => source[key]).find((value) => Number.isFinite(Number(value)));
    const resolved = Math.min(maximum, Math.max(minimum, Number(raw ?? fallback)));
    return integer ? Math.round(resolved) : resolved;
  }

  function normalizeRoofToolParameters(
    source: Readonly<Record<string, unknown>>,
    fallback: RoofToolParameters,
  ): RoofToolParameters {
    const roofTypeValue = safeString(source.roofType ?? source.roof_type, fallback.roofType).toLowerCase() as RoofType;
    const structure = asRecord(source.structure);
    const rafter = { ...asRecord(structure.rafter), ...asRecord(source.rafter) };
    const purlin = { ...asRecord(structure.purlin), ...asRecord(source.purlin) };
    const buildUp = { ...asRecord(source.roof_build_up), ...asRecord(source.roofBuildUp) };
    const counterBatten = { ...asRecord(buildUp.counter_batten), ...asRecord(buildUp.counterBatten) };
    const tileBatten = { ...asRecord(buildUp.tile_batten), ...asRecord(buildUp.tileBatten) };
    const insulationModeValue = safeString(
      source.insulationMode ?? buildUp.insulation_mode,
      fallback.insulationMode,
    ).toLowerCase() as RoofInsulationMode;
    const insulationMode = new Set<RoofInsulationMode>(["between", "below", "above"]).has(insulationModeValue)
      ? insulationModeValue
      : fallback.insulationMode;
    const legacyTimberDefaults = source.birdsmouthDepthMm === undefined
      && rafter.birdsmouth_depth_mm === undefined
      && source.purlinMiddleSpanThresholdMm === undefined
      && purlin.middle_span_threshold_mm === undefined
      && Number(rafter.spacing_mm ?? source.rafterSpacingMm ?? 700) === 700
      && Number(purlin.width_mm ?? source.purlinWidthMm ?? 160) === 160
      && Number(purlin.height_mm ?? source.purlinHeightMm ?? 240) === 240
      && Number(purlin.maximum_spacing_mm ?? source.purlinMaximumSpacingMm ?? 2500) === 2500;
    const overhang = asRecord(source.overhangMm ?? source.overhang_mm);
    const edgeOverhangSource = source.edgeOverhangsMm ?? source.edges_mm ?? overhang.edges_mm;
    const edgeOverhangsMm = (Array.isArray(edgeOverhangSource)
      ? edgeOverhangSource
      : safeString(edgeOverhangSource, "").split(/[;,\s]+/))
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 5000);
    const ridgeRaw = source.ridgeDirection ?? source.ridge_direction ?? fallback.ridgeDirection;
    const ridgeText = safeString(ridgeRaw, "").toLowerCase();
    const ridgeDirection = ["auto", "x", "y"].includes(ridgeText)
      ? ridgeText as "auto" | "x" | "y"
      : Number.isFinite(Number(ridgeRaw)) ? Number(ridgeRaw) : fallback.ridgeDirection;
    return {
      roofType: supportedRoofTypes.has(roofTypeValue) ? roofTypeValue : fallback.roofType,
      importedSource: importedRoofSource(source.importedSource ?? fallback.importedSource),
      pitchDeg: roofNumber(source, ["pitchDeg", "pitch_deg", "roofPitchDeg"], fallback.pitchDeg, 0, 80, true),
      eavesHeightMm: roofNumber(source, ["eavesHeightMm", "eaves_height_mm"], fallback.eavesHeightMm, -100_000, 100_000),
      ridgeDirection,
      continuationEdgesMm: normalizeRoofContinuationEdges(source.continuationEdgesMm ?? source.continuation_edges_mm ?? fallback.continuationEdgesMm),
      continuationEdgeIndices: Array.isArray(source.continuationEdgeIndices)
        ? source.continuationEdgeIndices.map(Number).filter(index => Number.isInteger(index) && index >= 0)
        : fallback.continuationEdgeIndices,
      overhangMm: roofNumber({ ...source, ...overhang }, ["overhangMm", "default_mm"], fallback.overhangMm, 0, 5000),
      overhangNorthMm: roofNumber({ ...source, ...overhang }, ["overhangNorthMm", "north_mm"], fallback.overhangNorthMm, 0, 5000),
      overhangEastMm: roofNumber({ ...source, ...overhang }, ["overhangEastMm", "east_mm"], fallback.overhangEastMm, 0, 5000),
      overhangSouthMm: roofNumber({ ...source, ...overhang }, ["overhangSouthMm", "south_mm"], fallback.overhangSouthMm, 0, 5000),
      overhangWestMm: roofNumber({ ...source, ...overhang }, ["overhangWestMm", "west_mm"], fallback.overhangWestMm, 0, 5000),
      edgeOverhangsMm,
      roofSkinThicknessMm: roofNumber(source, ["roofSkinThicknessMm", "roof_skin_thickness_mm"], fallback.roofSkinThicknessMm, 1, 2000),
      roofSkinMaterial: safeString(source.roofSkinMaterial ?? source.roof_skin_material, fallback.roofSkinMaterial),
      insulationMode,
      insulationThicknessMm: roofNumber({ ...source, ...buildUp }, ["insulationThicknessMm", "insulation_thickness_mm"], fallback.insulationThicknessMm, 20, 500),
      sheathingThicknessMm: roofNumber({ ...source, ...buildUp }, ["sheathingThicknessMm", "sheathing_thickness_mm"], fallback.sheathingThicknessMm, 8, 80),
      underlayThicknessMm: roofNumber({ ...source, ...buildUp }, ["underlayThicknessMm", "underlay_thickness_mm"], fallback.underlayThicknessMm, 1, 20),
      counterBattenWidthMm: roofNumber({ ...source, ...counterBatten }, ["counterBattenWidthMm", "width_mm"], fallback.counterBattenWidthMm, 20, 120),
      counterBattenHeightMm: roofNumber({ ...source, ...counterBatten }, ["counterBattenHeightMm", "height_mm"], fallback.counterBattenHeightMm, 20, 100),
      tileBattenWidthMm: roofNumber({ ...source, ...tileBatten }, ["tileBattenWidthMm", "width_mm"], fallback.tileBattenWidthMm, 20, 100),
      tileBattenHeightMm: roofNumber({ ...source, ...tileBatten }, ["tileBattenHeightMm", "height_mm"], fallback.tileBattenHeightMm, 20, 80),
      tileBattenSpacingMm: roofNumber({ ...source, ...tileBatten }, ["tileBattenSpacingMm", "spacing_mm"], fallback.tileBattenSpacingMm, 200, 500),
      roofTileThicknessMm: roofNumber({ ...source, ...buildUp }, ["roofTileThicknessMm", "tile_thickness_mm"], fallback.roofTileThicknessMm, 8, 80),
      roofTileMaterial: safeString(source.roofTileMaterial ?? buildUp.tile_material_ref, fallback.roofTileMaterial),
      rafterWidthMm: roofNumber({ ...source, ...rafter }, ["rafterWidthMm", "width_mm"], fallback.rafterWidthMm, 20, 1000),
      rafterHeightMm: roofNumber({ ...source, ...rafter }, ["rafterHeightMm", "height_mm"], fallback.rafterHeightMm, 180, 240),
      rafterSpacingMm: legacyTimberDefaults ? 650 : roofNumber({ ...source, ...rafter }, ["rafterSpacingMm", "spacing_mm"], fallback.rafterSpacingMm, 100, 3000),
      birdsmouthDepthMm: roofNumber({ ...source, ...rafter }, ["birdsmouthDepthMm", "birdsmouth_depth_mm"], fallback.birdsmouthDepthMm, 20, 50),
      purlinWidthMm: legacyTimberDefaults ? 140 : roofNumber({ ...source, ...purlin }, ["purlinWidthMm", "width_mm"], fallback.purlinWidthMm, 20, 1500),
      purlinHeightMm: legacyTimberDefaults ? 200 : roofNumber({ ...source, ...purlin }, ["purlinHeightMm", "height_mm"], fallback.purlinHeightMm, 20, 2000),
      purlinMaximumSpacingMm: legacyTimberDefaults ? 4500 : roofNumber({ ...source, ...purlin }, ["purlinMaximumSpacingMm", "maximum_spacing_mm"], fallback.purlinMaximumSpacingMm, 250, 10_000),
      purlinMiddleSpanThresholdMm: roofNumber({ ...source, ...purlin }, ["purlinMiddleSpanThresholdMm", "middle_span_threshold_mm"], fallback.purlinMiddleSpanThresholdMm, 1000, 15_000),
      plateauWidthRatio: roofNumber(source, ["plateauWidthRatio", "plateau_width_ratio"], fallback.plateauWidthRatio, 0.05, 0.8),
      mansardBreakRatio: roofNumber(source, ["mansardBreakRatio", "mansard_break_ratio"], fallback.mansardBreakRatio, 0.1, 0.8),
      mansardLowerPitchDeg: roofNumber(source, ["mansardLowerPitchDeg", "mansard_lower_pitch_deg"], fallback.mansardLowerPitchDeg, 10, 85),
      mansardUpperPitchDeg: roofNumber(source, ["mansardUpperPitchDeg", "mansard_upper_pitch_deg"], fallback.mansardUpperPitchDeg, 1, 70),
      hipEndRatio: roofNumber(source, ["hipEndRatio", "hip_end_ratio"], fallback.hipEndRatio, 0.1, 1),
      barrelRiseMm: roofNumber(source, ["barrelRiseMm", "barrel_rise_mm"], fallback.barrelRiseMm, 100, 30_000),
      barrelSegmentCount: roofNumber(source, ["barrelSegmentCount", "barrel_segment_count"], fallback.barrelSegmentCount, 4, 64, true),
      sawtoothCount: roofNumber(source, ["sawtoothCount", "sawtooth_count"], fallback.sawtoothCount, 1, 20, true),
      sawtoothPitchDeg: roofNumber(source, ["sawtoothPitchDeg", "sawtooth_pitch_deg"], fallback.sawtoothPitchDeg, 5, 80),
    };
  }

  function handleSettingsEvent(event: Event): void {
    const detail = asRecord((event as CustomEvent).detail);
    const requestedTool = safeString(detail.toolId ?? detail.tool, "");
    if (requestedTool && activeTool && toolFromValue(requestedTool) !== activeTool) return;

    const requestedOperation = safeString(detail.operation, "").toLowerCase();
    if (["set", "wall", "fill", "replace", "clear", "copy", "cut", "paste"].includes(requestedOperation)) {
      operation = requestedOperation as WorldEditOperation;
    }
    const requestedConflictChoice = safeString(
      detail.roadConflictChoice ?? detail.planningRoadConflictChoice,
      "",
    ).toLowerCase();
    if (requestedConflictChoice === "fill" || requestedConflictChoice === "bridge") {
      planningRoadConflictChoice = requestedConflictChoice;
      if (activeTool === "tentacle") rebuildTentacleScene();
    }
    const requestedPlanningWidth = Number(detail.planningWidth ?? detail.planningBuildAreaWidth);
    if (Number.isFinite(requestedPlanningWidth) && activeTool === "room" && isBuildingLineBrush()) {
      planningBuildAreaWidth = Math.max(1, Math.min(100, requestedPlanningWidth));
      rebuildPolygonAreaScene("room");
      if (editingPlanningBuildAreaInstanceId && polygonAreaRuntime("room").closed) void executePlanningBuildArea();
    }
    const requestedShape = safeString(detail.shape, "").toLowerCase();
    if (brushShape && ["sphere", "box", "cylinder"].includes(requestedShape)) {
      brushShape.value = requestedShape;
    }
    setNumericInput(brushRadius, detail.radius);
    setNumericInput(brushDensity, detail.density);
    setNumericInput(brushWall, detail.wallThickness ?? detail.wall);
    if (safeString(detail.roomType, "")) roomType = safeString(detail.roomType, "wohnen");
    if (safeString(detail.roomLabel, "")) roomLabel = safeString(detail.roomLabel, "Raum").slice(0, 80);
    const requestedRoomHeight = Number(detail.roomHeight ?? detail.roomHeightM ?? detail.room_height_m);
    if (Number.isFinite(requestedRoomHeight)) roomHeight = Math.max(0.1, Math.min(256, requestedRoomHeight));
    const roofSettings = {
      ...asRecord(detail.roof),
      ...asRecord(detail.roofParameters),
      ...detail,
    };
    const previousRoofParameters = JSON.stringify(roofParameters);
    roofParameters = normalizeRoofToolParameters(roofSettings, roofParameters);
    roofQuickSettings?.sync(roofParameters);
    if (activeTool === "roof"
      && previousRoofParameters !== JSON.stringify(roofParameters)
      && polygonAreaRuntime("roof").closed) {
      invalidateRoofCalculation(true);
      scheduleRoofPreview();
    }
    if (parcelMaskInput && typeof detail.parcelMask === "boolean") {
      parcelMaskInput.checked = detail.parcelMask;
    }
    let gridGeometryChanged = false;
    const requestedGridMode = safeString(detail.parcelGridMode, "").toLowerCase();
    if (requestedGridMode === "boundary" || requestedGridMode === "setback") {
      if (parcelGridMode !== requestedGridMode) {
        parcelGridMode = requestedGridMode;
        gridGeometryChanged = true;
      }
    }
    const requestedSetback = Number(detail.parcelGridSetback);
    if (Number.isFinite(requestedSetback)) {
      const nextSetback = Math.max(0, Math.min(20, requestedSetback));
      if (nextSetback !== parcelGridSetback) {
        parcelGridSetback = nextSetback;
        gridGeometryChanged = true;
      }
    }
    const requestedInfluence = Number(detail.parcelGridInfluence);
    if (Number.isFinite(requestedInfluence)) {
      const nextInfluence = Math.max(1, Math.min(PARCEL_GRID_MAX_DRAG_DEPTH_CELLS, Math.round(requestedInfluence)));
      if (nextInfluence !== parcelGridInfluence) {
        parcelGridInfluence = nextInfluence;
        if (parcelGridGuide) parcelGridGuide = { ...parcelGridGuide, depthMeters: parcelGridInfluence };
        gridGeometryChanged = true;
      }
    }
    if (gridGeometryChanged) {
      rememberParcelGridGuide();
      rebuildParcelGridScene();
      persistParcelGridState();
    }
    refreshHud();
  }

  function handleParentMessage(event: MessageEvent): void {
    const data = asRecord(event.data);
    const type = safeString(data.type ?? data.kind, "");
    if (type === "vectoplan-cad:worldedit-measurement") {
      const detail = asRecord(data.detail ?? data);
      const start = asArray(detail.start_mm);
      const end = asArray(detail.end_mm);
      if (start.length < 2 || end.length < 2) return;
      const values = [start[0], start[1], end[0], end[1]].map(Number);
      if (!values.every(Number.isFinite)) return;
      const baseY = Number.isFinite(Number(detail.base_y)) ? Number(detail.base_y) + 0.5 : 1.5;
      activate("ruler");
      selection = {
        first: { x: values[0] / 1000, y: baseY, z: values[1] / 1000 },
        second: { x: values[2] / 1000, y: baseY, z: values[3] / 1000 },
      };
      selectionDragging = false;
      rebuildSelectionScene();
      refreshHud();
      const distance = measurementMetres(selection);
      setStatus(distance === null ? "CAD-Messung konnte nicht geladen werden." : `CAD-Messung: ${distance.toFixed(3)} Meter`, distance === null ? "warning" : "ready");
      return;
    }
    if (type === MAP_PARCEL_CATALOG_CHANGED) {
      const detail = asRecord(data.detail ?? data);
      const incomingAvailable = asArray(detail.availableParcels ?? detail.available_parcels);
      const incomingAdjacent = asArray(detail.adjacentParcels ?? detail.adjacent_parcels);
      const catalog = normalizedParcelSelection({
        ...detail,
        parcels: parcelSelection.parcels,
        availableParcels: [...parcelSelection.availableParcels, ...incomingAvailable],
        adjacentParcels: [...parcelSelection.adjacentParcels, ...incomingAdjacent],
      });
      // Re-hydrate selected parcels from the catalog as well. Otherwise a
      // selection made while the map was still streaming kept its first
      // polygon fragment forever even after the complete geometry arrived.
      parcelSelection.parcels = catalog.parcels;
      parcelSelection.availableParcels = catalog.availableParcels;
      parcelSelection.adjacentParcels = catalog.adjacentParcels;
      rebuildParcelScene();
      refreshHud();
      return;
    }
    if (type !== PARCEL_SYNC && type !== MAP_PARCEL_CHANGED) return;
    parcelGridPlaneY = null;
    parcelGridGeometrySignature = "";
    const nextSelection = retainParcelCatalog(
      parcelSelection,
      normalizedParcelSelection(data.detail ?? data.selection ?? data),
    );
    applyPersistedParcelGridState(nextSelection.parcelGridState);
    parcelSelection = nextSelection;
    rebuildParcelScene();
    refreshHud();
    setStatus(
      parcelSelection.parcels.length
        ? `${parcelSelection.parcels.length} Grundstück(e) als gemeinsame Baumaske geladen.`
        : "Noch kein Grundstück ausgewählt.",
      parcelSelection.parcels.length ? "ready" : "warning",
    );
    if (type === MAP_PARCEL_CHANGED) postParcelSelection();
  }

  function handleLocalParcelSync(event: Event): void {
    parcelGridPlaneY = null;
    parcelGridGeometrySignature = "";
    const nextSelection = retainParcelCatalog(
      parcelSelection,
      normalizedParcelSelection((event as CustomEvent).detail),
    );
    applyPersistedParcelGridState(nextSelection.parcelGridState);
    parcelSelection = nextSelection;
    rebuildParcelScene();
    refreshHud();
  }

  function handleCreativeInventoryOpened(): void {
    syncPanelVisibility();
  }

  function handleCreativeInventoryClosed(): void {
    syncPanelVisibility();
  }

  function handleEarthGridReady(event: Event): void {
    const next = normalizedEarthGrid((event as CustomEvent).detail);
    if (!next) return;
    earthGrid = next;
    rebuildParcelScene();
  }

  function resetActiveTool(): void {
    if (busy) return;
    const system = activeSystem();
    system?.reset();
    setStatus(system?.ui.resetMessage ?? "WorldEdit zurückgesetzt.", "info");
  }

  function handleInventoryAction(event: Event): void {
    const detail = asRecord((event as CustomEvent).detail);
    const requestedTool = safeString(detail.toolId ?? detail.tool, "");
    if (requestedTool && requestedTool !== inventoryToolId()) return;
    const action = safeString(detail.action, "").toLowerCase();
    if (action === "reset") resetActiveTool();
    else if (action === "execute") void activeSystem()?.execute();
  }

  function requestParcelSelection(): void {
    try {
      window.parent?.postMessage({
        type: PARCEL_REQUEST,
        kind: PARCEL_REQUEST,
        source: "vectoplan-editor",
        detail: {
          projectId: options.bootstrap.runtime.chunk.projectId,
          worldId: options.bootstrap.runtime.chunk.worldId,
        },
      }, "*");
    } catch { /* bridge is best effort */ }
  }

  systemRegistry = createWorldEditSystemRegistry([
    createSelectionSystem({
      isDragging: () => selectionDragging,
      updateDrag: updateSelectionDrag,
      stopDrag: stopSelectionDrag,
      updateScenePreview: updateSelectionScenePreview,
      rebuildScene: rebuildSelectionScene,
      refreshHud,
      adjustHandle: adjustSelectionHandle,
      clearLastPoint: () => {
        selection = selection.second
          ? { first: selection.first, second: null }
          : { first: null, second: null };
      },
      resolveTarget: (intent) => intent.position
        ?? worldPositionAtCameraPlane(resolveParcelGridPlaneY(null), null, 1_200),
      startDrag: startSelectionDrag,
      hasCompleteSelection: () => Boolean(selection.first && selection.second),
      execute: () => executeAt(),
      reset: () => {
        stopSelectionDrag();
        selection = { first: null, second: null };
        rebuildSelectionScene();
        refreshHud();
      },
      setStatus,
    }),
    createRoomSystem({
      stopInteraction: () => stopPolygonAreaInteraction("room"),
      startHover: () => {
        synchronizeRoomAreaWorkspaceProfile();
        startPolygonAreaHover("room");
      },
      stopHover: () => stopPolygonAreaHover("room"),
      removePointUnderCrosshair: () => removePolygonAreaPointUnderCrosshair("room"),
      pointDeletionOnly: isBuildingLineBrush,
      openSettingsUnderCrosshair: openPlanningBuildingSettingsUnderCrosshair,
      shouldSelectExisting: (room) => {
        const ref = room as ExistingRoomRef;
        if (asRecord(ref.metadata.pathBrush).kind !== "building") return !polygonAreaRuntime("room").closed;
        return ref.objectInstanceId !== editingPlanningBuildAreaInstanceId
          && polygonAreaPointUnderCrosshair("room") === null && !planningBuildAreaMoveHandleUnderCrosshair();
      },
      resolveTarget: (intent) => resolvePolygonAreaTarget("room", intent),
      existingRoomAt: (target) => existingPlanningBuildAreaAt(target) ?? existingRoomAt(target),
      removeExistingRoom: (room) => {
        if (asRecord((room as ExistingRoomRef).metadata.pathBrush).kind === "building") void removeExistingPlanningBuildArea(room as ExistingRoomRef);
        else void removeExistingRoom(room as ExistingRoomRef);
      },
      selectExistingRoom: (room) => {
        if (asRecord((room as ExistingRoomRef).metadata.pathBrush).kind === "building") void selectPlanningBuildingPreservingDraft(room as ExistingRoomRef);
        else selectExistingRoom(room as ExistingRoomRef);
      },
      beginPointInteraction: (target) => {
        synchronizeRoomAreaWorkspaceProfile();
        if (polygonAreaRuntime("room").points.length === 0) {
          editingRoomInstanceId = null;
          editingRoomAnchor = null;
          editingPlanningBuildAreaInstanceId = null;
          editingPlanningBuildAreaAnchor = null;
        }
        beginPolygonAreaInteraction("room", target);
      },
      finishArea: () => finishPolygonArea("room"),
      clearRoomSelection: () => {
        resetPolygonArea("room");
      },
      hasCompleteSelection: () => polygonAreaRuntime("room").closed
        && (isBuildingLineBrush()
          ? Boolean(currentPlanningBuildAreaDraft())
          : validPolygonArea(polygonAreaRuntime("room").points)),
      executeRoom: async () => {
        if (isBuildingLineBrush()) await executePlanningBuildArea();
        else await executeRoom();
      },
      rebuild: () => rebuildPolygonAreaScene("room"),
      reset: () => resetPolygonArea("room"),
      setStatus,
    }),
    createStoreySystem({
      resolveTarget: (intent) => resolvePolygonAreaTarget("room", intent),
      selectBuildingAt: (target) => {
        const area = existingPlanningBuildAreaAt(target);
        if (!area) return Boolean(isBuildingLineBrush() && currentPlanningBuildAreaDraft());
        selectPlanningBuildingForStoreys(area);
        return true;
      },
      hasSelection: () => Boolean(isBuildingLineBrush() && currentPlanningBuildAreaDraft()),
      openSettings: () => syncStoreyQuickSettings(true),
      closeSettings: () => storeyQuickSettings?.close(false),
      addStorey: () => adjustPlanningBuildingStoreys(1, selectedStoreyScope),
      removeStorey: () => adjustPlanningBuildingStoreys(-1, selectedStoreyScope),
      reset: () => {
        storeyDragHandle?.setEnabled(false);
        selectedStoreyBuildArea = null;
        selectedStoreyScope = "all";
        storeyQuickSettings?.close(false);
        setStatus("Geschossauswahl zurückgesetzt.", "info");
      },
      setStatus,
    }),
    createStairSystem({
      stopInteraction: () => stopPolygonAreaInteraction("stair"),
      startHover: () => startPolygonAreaHover("stair"),
      stopHover: () => stopPolygonAreaHover("stair"),
      openSettingsUnderCrosshair: openStairQuickSettingsUnderCrosshair,
      removePointUnderCrosshair: () => removePolygonAreaPointUnderCrosshair("stair"),
      resolveTarget: (intent) => resolvePolygonAreaTarget("stair", intent),
      beginPointInteraction: (target) => beginPolygonAreaInteraction("stair", target),
      finishArea: () => {
        finishPolygonArea("stair");
        const runtime = polygonAreaRuntime("stair");
        if (runtime.closed && validPolygonArea(runtime.points)) {
          stairQuickSettings?.open(stairParameters);
          const inputController = options.sceneRuntime.getInputController();
          inputController?.clear("world-edit-stair-settings-open");
          inputController?.disable("world-edit-stair-settings-open");
          if (inputController) void inputController.exitPointerLock("world-edit-stair-settings");
        }
      },
      isComplete: () => polygonAreaRuntime("stair").closed && validPolygonArea(polygonAreaRuntime("stair").points),
      executeStair,
      rebuild: () => rebuildPolygonAreaScene("stair"),
      reset: () => resetPolygonArea("stair"),
      setStatus,
    }),
    createPaintSystem({
      getOperation: () => operation,
      setTarget: (target) => { brushTarget = target; },
      refreshHud,
      executeAt: (target, forcedOperation) => executeAt(target, forcedOperation),
      setStatus,
      reset: () => {
        brushTarget = null;
        refreshHud();
      },
    }),
    createSculptSystem({
      resolveTarget: (intent) => {
        const position = cellPosition(intent.sourceCell) ?? intent.position;
        return position ? {
          position,
          blockTypeId: safeString(asRecord(intent.sourceCell).blockTypeId, "") || null,
        } : null;
      },
      executeLayer: executeSculptLayer,
      applyDefaults: () => {
        if (brushShape) brushShape.value = "box";
        if (brushRadius) brushRadius.value = "5";
        if (brushDensity) brushDensity.value = "100";
        if (brushWall) brushWall.value = "0";
        refreshHud();
      },
      setStatus,
      reset: () => {
        brushTarget = null;
        refreshHud();
      },
    }),
    createParcelGridSystem({
      isDragging: () => parcelGridDragging,
      updateDrag: updateParcelGridDrag,
      stopDrag: stopParcelGridDrag,
      refreshHud,
      moveInnerLineOutward: moveParcelGridInnerLineOutward,
      startDrag: startParcelGridDrag,
      cameraTarget: () => cameraPointAtPlaneY(resolveParcelGridPlaneY(null)),
      selectAt: selectParcelGridAt,
      rebuild: rebuildParcelGridScene,
      reset: () => {
        stopParcelGridDrag(false);
        if (parcelGridGuide) persistedParcelGridGuides.delete(parcelGridGuide.guideKey);
        activeParcelGridParcelId = null;
        activeParcelGridGuideKey = null;
        parcelGridGuide = null;
        rebuildParcelGridScene();
        persistParcelGridState();
        refreshHud();
      },
      setStatus,
    }),
    createParcelSystem({
      cameraTarget: () => cameraPointAtPlaneY(resolveParcelGridPlaneY(null)),
      planeY: () => resolveParcelGridPlaneY(null),
      setParcelAt,
      reset: () => {
        parcelSelection.parcels = [];
        postParcelSelection();
        refreshHud();
      },
      setStatus,
    }),
    createRulerSystem({
      isDragging: () => selectionDragging,
      updateDrag: updateSelectionDrag,
      stopDrag: stopSelectionDrag,
      rebuildScene: rebuildSelectionScene,
      refreshHud,
      clearMeasurement: () => {
        selection = { first: null, second: null };
        delete options.root.dataset.rulerSnap;
      },
      resolveTarget: (intent) => {
        const visibleTarget = visibleRulerSurfaceTarget();
        if (visibleTarget) return visibleTarget;
        const fallbackPlanePoint = cameraPointAtPlaneY(resolveParcelGridPlaneY(null));
        return rulerPointFromTarget(
          intent.targetPoint,
          intent.sourceCell,
          intent.position
            ? { x: intent.position.x + 0.5, y: intent.position.y + 0.5, z: intent.position.z + 0.5 }
            : fallbackPlanePoint
              ? {
                  x: Number(fallbackPlanePoint.x.toFixed(2)),
                  y: Number(fallbackPlanePoint.y.toFixed(2)),
                  z: Number(fallbackPlanePoint.z.toFixed(2)),
                }
              : null,
        );
      },
      startDrag: startSelectionDrag,
      measurementMetres: () => measurementMetres(selection),
      reset: () => {
        stopSelectionDrag();
        selection = { first: null, second: null };
        delete options.root.dataset.rulerSnap;
        rebuildSelectionScene();
        refreshHud();
      },
      setStatus,
    }),
    createCopyPasteSystem({
      getPhase: () => clipboardPhase,
      stopDrag: () => clipboardPhase === "move" ? stopClipboardMove() : stopSelectionDrag(),
      adjustSelectionHandle: () => clipboardPhase === "select" && adjustSelectionHandle("primary"),
      resolveTarget: (intent) => intent.position
        ?? worldPositionAtCameraPlane(resolveParcelGridPlaneY(null), null, 1_200),
      startSelection: startSelectionDrag,
      startMove: startClipboardMove,
      captureOrPaste: () => executeClipboardCurrent("copy"),
      canExecute: () => clipboardPhase === "move"
        ? Boolean(clipboard.length && clipboardAnchor)
        : Boolean(selection.first && selection.second),
      reset: resetClipboardPreview,
      rebuild: rebuildSelectionScene,
      refreshHud,
    }),
    createCutPasteSystem({
      getPhase: () => clipboardPhase,
      stopDrag: () => clipboardPhase === "move" ? stopClipboardMove() : stopSelectionDrag(),
      adjustSelectionHandle: () => clipboardPhase === "select" && adjustSelectionHandle("primary"),
      resolveTarget: (intent) => intent.position
        ?? worldPositionAtCameraPlane(resolveParcelGridPlaneY(null), null, 1_200),
      startSelection: startSelectionDrag,
      startMove: startClipboardMove,
      captureOrPaste: () => executeClipboardCurrent("cut"),
      canExecute: () => clipboardPhase === "move"
        ? Boolean(clipboard.length && clipboardAnchor)
        : Boolean(selection.first && selection.second),
      reset: resetClipboardPreview,
      rebuild: rebuildSelectionScene,
      refreshHud,
    }),
    createTentacleSystem({
      stopDrawing: stopTentacleDrawing,
      startHover: () => {
        synchronizeTentacleWorkspaceProfile();
        startTentacleHover();
      },
      stopHover: stopTentacleHover,
      finishPath: finishTentaclePath,
      removePointUnderCrosshair: removeTentaclePointUnderCrosshair,
      resolveTarget: (intent) => {
        const resolved = intent.targetPoint ? {
          x: Math.floor(intent.targetPoint.x),
          y: Math.floor(intent.targetPoint.y),
          z: Math.floor(intent.targetPoint.z),
        } : intent.position ?? currentTentacleTarget();
        if (!resolved || tentaclePoints.length === 0) return resolved;
        return { ...resolved, y: Math.floor(tentaclePoints[0]!.y) };
      },
      startDrawing: startTentacleDrawing,
      executePath: executeTentaclePath,
      pointCount: () => tentaclePoints.length,
      rebuild: rebuildTentacleScene,
      reset: () => {
        stopTentacleDrawing();
        tentaclePoints = [];
        tentacleFinished = false;
        tentacleHoveredIndex = null;
        planningRoadConflicts = [];
        disposeTentacleGroup();
        refreshHud();
      },
      setStatus,
    }),
    createRoofSystem({
      stopInteraction: () => stopPolygonAreaInteraction("roof"),
      startHover: () => startPolygonAreaHover("roof"),
      stopHover: () => stopPolygonAreaHover("roof"),
      openSettingsUnderCrosshair: openRoofQuickSettingsUnderCrosshair,
      removePointUnderCrosshair: () => removePolygonAreaPointUnderCrosshair("roof"),
      resolveTarget: (intent) => resolvePolygonAreaTarget("roof", intent),
      beginPointInteraction: (target) => {
        const runtime = polygonAreaRuntime("roof");
        if (runtime.points.length === 0) {
          const existing = existingRoofAt(target);
          if (existing) {
            selectExistingRoof(existing);
            return;
          }
          editingRoofInstanceId = null;
          editingRoofAnchor = null;
          editingRoofMetadata = {};
          editingRoofHoleRings = [];
          roofParameters = { ...roofParameters, continuationEdgesMm: [], continuationEdgeIndices: undefined };
        }
        beginPolygonAreaInteraction("roof", target);
      },
      finishArea: () => finishPolygonArea("roof"),
      executeRoof,
      isComplete: () => polygonAreaRuntime("roof").closed
        && validPolygonArea(polygonAreaRuntime("roof").points)
        && Boolean(polygonAreaRuntime("roof").calculation),
      rebuild: () => {
        rebuildPolygonAreaScene("roof");
        rebuildRoofZoneScene(true);
      },
      reset: () => resetPolygonArea("roof"),
      setStatus,
    }),
  ]);

  closeButton?.addEventListener("click", () => deactivate("close-button"));
  executeButton?.addEventListener("click", () => {
    void activeSystem()?.execute();
  });
  resetButton?.addEventListener("click", resetActiveTool);
  operationSelect?.addEventListener("change", () => {
    operation = operationSelect.value as WorldEditOperation;
    refreshHud();
  });
  [brushRadius, brushDensity, brushWall].forEach((input) => input?.addEventListener("input", () => {
    if (activeTool === "tentacle") rebuildTentacleScene();
    refreshHud();
  }));
  window.addEventListener(ACTIVATE_EVENT, handleActivateEvent);
  window.addEventListener(SETTINGS_EVENT, handleSettingsEvent);
  window.addEventListener(INVENTORY_ACTION_EVENT, handleInventoryAction);
  window.addEventListener(INVENTORY_STATE_REQUEST_EVENT, publishInventoryState);
  window.addEventListener(CREATIVE_INVENTORY_OPENED_EVENT, handleCreativeInventoryOpened);
  window.addEventListener(CREATIVE_INVENTORY_CLOSED_EVENT, handleCreativeInventoryClosed);
  window.addEventListener(EARTH_GRID_READY_EVENT, handleEarthGridReady);
  window.addEventListener(LOCAL_PARCEL_SYNC, handleLocalParcelSync);
  window.addEventListener("message", handleParentMessage);
  window.addEventListener("keydown", handleWorldEditKeyDown, true);
  options.sceneRuntime.setPlacementConstraintHandler((position, context) => (
    constrainManualPlacement(position, "new-placement", context)
  ));
  options.sceneRuntime.setPlacementGeometryHandler((position, context) => (
    constrainManualPlacement(position, "existing-block", context).semanticPlacement ?? null
  ));
  window.dispatchEvent(new CustomEvent(INVENTORY_SYNC_REQUEST));
  requestParcelSelection();
  refreshHud();

  const handle: WorldEditControllerHandle = {
    element: panel,
    activate,
    deactivate,
    beginPlanningMassingSelection,
    getPlanningMassingSnapshot,
    executePlanningMassing,
    preparePlanningMassingRoof,
    destroy(): void {
      if (destroyed) return;
      deactivate("destroy");
      destroyed = true;
      if (planningBuildingSceneRefreshTimer) window.clearTimeout(planningBuildingSceneRefreshTimer);
      if (planningBuildingSceneMonitorFrame) cancelAnimationFrame(planningBuildingSceneMonitorFrame);
      window.removeEventListener(ACTIVATE_EVENT, handleActivateEvent);
      window.removeEventListener(SETTINGS_EVENT, handleSettingsEvent);
      window.removeEventListener(INVENTORY_ACTION_EVENT, handleInventoryAction);
      window.removeEventListener(INVENTORY_STATE_REQUEST_EVENT, publishInventoryState);
      window.removeEventListener(CREATIVE_INVENTORY_OPENED_EVENT, handleCreativeInventoryOpened);
      window.removeEventListener(CREATIVE_INVENTORY_CLOSED_EVENT, handleCreativeInventoryClosed);
      window.removeEventListener(EARTH_GRID_READY_EVENT, handleEarthGridReady);
      window.removeEventListener(LOCAL_PARCEL_SYNC, handleLocalParcelSync);
      window.removeEventListener("message", handleParentMessage);
      window.removeEventListener("keydown", handleWorldEditKeyDown, true);
      disposeParcelGroup();
      disposeParcelGridGroup();
      if (roofPreviewTimer) window.clearTimeout(roofPreviewTimer);
      planningBuildingRoofPreviewAbortController?.abort();
      planningBuildingRoofPreviewAbortController = null;
      if (planningBuildingRoofPreviewTimer) window.clearTimeout(planningBuildingRoofPreviewTimer);
      planningBuildingRoofPreviewTimer = 0;
      lineBrushQuickSettings?.destroy();
      planningBuildingEditVisuals.dispose();
      lineBrushQuickSettings = null;
      storeyQuickSettings?.destroy();
      storeyQuickSettings = null;
      storeyDragHandle?.destroy();
      storeyDragHandle = null;
      roofQuickSettings?.destroy();
      roofQuickSettings = null;
      solarPanel?.destroy();
      solarPanel = null;
      stairQuickSettings?.destroy();
      stairQuickSettings = null;
      roofSettingsTexture?.dispose();
      roofSettingsTexture = null;
      options.sceneRuntime.setPlacementConstraintHandler(null);
      options.sceneRuntime.setPlacementGeometryHandler(null);
      delete options.root.dataset.parcelGridRotationDegrees;
      delete options.root.dataset.parcelGridTransitionMeters;
      delete options.root.dataset.parcelGridPlaneY;
      delete options.root.dataset.parcelGuideVisible;
      delete options.root.dataset.parcelGuideVisibilityReason;
      panel.remove();
    },
  };
  options.signal?.addEventListener("abort", () => handle.destroy(), { once: true });
  return handle;
}
