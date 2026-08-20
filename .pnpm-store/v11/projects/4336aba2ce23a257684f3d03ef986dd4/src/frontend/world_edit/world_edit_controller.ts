import * as THREE from "three";
import {
  isChunkApiFailedResult,
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
import type { EditorLogger } from "@utils/logger";
import { normalizeUnknownError, safeString } from "@utils/safe";
import {
  earthGridLonLatToWorld,
  earthGridWorldPointToLonLat,
} from "@utils/earth_grid_coordinates";
import {
  buildParcelGridPartition,
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
} from "./parcel_grid_geometry";
import {
  resolveWorldEditSelectionBounds,
  snapWorldEditRulerPoint,
  snapWorldEditSelectionHandle,
  worldEditSelectionTopGridSegments,
  type WorldEditSelectionAxis,
  type WorldEditSelectionBounds,
} from "./selection_geometry";

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

type WorldEditTool = "selection" | "room" | "paint" | "sculpt" | "parcel" | "parcel-grid" | "ruler" | "clipboard";
type WorldEditOperation = "set" | "wall" | "fill" | "replace" | "clear" | "copy" | "cut" | "paste";

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
  readonly wallAxisDegrees?: number;
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
  destroy(): void;
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
  const x = Number(record.x);
  const y = Number(record.y);
  const z = Number(record.z);
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

export function parcelSelectionActionForIntent(
  action: EditorInputWorldEditIntent["action"],
): "select" | "remove" | null {
  if (action === "primary") return "select";
  if (action === "secondary") return "remove";
  return null;
}

function normalizedParcelSelection(value: unknown): ParcelSelection {
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
  const availableParcels = normalizedParcelItems(availableValues, 512);
  const adjacentParcels = normalizedParcelItems(adjacentValues, 128);
  const coordinate = asRecord(selection.projectCoordinate ?? selection.project_coordinate);
  const longitude = Number(coordinate.longitude ?? coordinate.lon ?? coordinate.lng);
  const latitude = Number(coordinate.latitude ?? coordinate.lat);
  const requestedRotation = Number(selection.gridRotationDegrees ?? selection.grid_rotation_degrees);
  const rawGridState = asRecord(selection.parcelGridState ?? selection.parcel_grid_state);
  const rawGridGuides = asArray(rawGridState.guides);
  const parcelGridState = safeString(rawGridState.schemaVersion ?? rawGridState.schema_version, "")
    === "vectoplan-parcel-grid-state.v1"
    ? {
        schemaVersion: "vectoplan-parcel-grid-state.v1" as const,
        mode: safeString(rawGridState.mode, "boundary") === "setback" ? "setback" as const : "boundary" as const,
        setbackMeters: Math.max(0, Math.min(20, Number(rawGridState.setbackMeters ?? rawGridState.setback_meters) || 0)),
        influenceMeters: Math.max(1, Math.min(PARCEL_GRID_MAX_DRAG_DEPTH_CELLS, Math.round(Number(rawGridState.influenceMeters ?? rawGridState.influence_meters) || 3))),
        activeParcelId: safeString(rawGridState.activeParcelId ?? rawGridState.active_parcel_id, "") || null,
        activeGuideKey: safeString(rawGridState.activeGuideKey ?? rawGridState.active_guide_key, "") || null,
        guides: rawGridGuides.map((value): PersistedParcelGridGuide | null => {
          const guide = asRecord(value);
          const start = asArray(guide.startLonLat ?? guide.start_lon_lat);
          const end = asArray(guide.endLonLat ?? guide.end_lon_lat);
          const parcelId = safeString(guide.parcelId ?? guide.parcel_id, "");
          const startLon = Number(start[0]);
          const startLat = Number(start[1]);
          const endLon = Number(end[0]);
          const endLat = Number(end[1]);
          if (!parcelId || ![startLon, startLat, endLon, endLat].every(Number.isFinite)) return null;
          return {
            parcelId,
            startLonLat: [startLon, startLat],
            endLonLat: [endLon, endLat],
            depthMeters: Math.max(1, Math.min(PARCEL_GRID_MAX_DRAG_DEPTH_CELLS, Math.round(Number(guide.depthMeters ?? guide.depth_meters) || 3))),
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
  let operation: WorldEditOperation = "set";
  let roomType = "wohnen";
  let roomLabel = "Raum";
  let editingRoomInstanceId: string | null = null;
  let editingRoomAnchor: ChunkApiWorldPosition | null = null;
  let selection: SelectionBounds = { first: null, second: null };
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
  let busy = false;
  let selectionGroup: THREE.Group | null = null;
  let parcelGroup: THREE.Group | null = null;
  let parcelGridGroup: THREE.Group | null = null;
  let parcelGridGuide: ParcelGridGuide | null = null;
  let parcelGridMode: "boundary" | "setback" = "boundary";
  let parcelGridSetback = 0;
  let parcelGridInfluence = 3;
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

  function cameraPointAtPlaneY(planeY: number, maximumDistance = 180): THREE.Vector3 | null {
    const camera = options.sceneRuntime.getCamera();
    if (!camera || !Number.isFinite(planeY)) return null;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    if (Math.abs(direction.y) < 1e-5) return null;
    const distance = (planeY - camera.position.y) / direction.y;
    if (!Number.isFinite(distance) || distance <= 0 || distance > maximumDistance) return null;
    return camera.position.clone().addScaledVector(direction, distance);
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
    const sourcePoint = [sourceCell.worldX, sourceCell.worldY, sourceCell.worldZ]
      .every((value) => Number.isFinite(Number(value)))
      ? {
          x: Number(sourceCell.worldX),
          y: Number(sourceCell.worldY),
          z: Number(sourceCell.worldZ),
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

  function currentRulerTarget(): ChunkApiWorldPosition | null {
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
        depthMeters: Math.max(1, Math.min(maximumDepth, saved.depthMeters)),
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

  function inventoryToolId(): string {
    if (activeTool === "ruler") return "ruler-laser";
    if (activeTool === "clipboard") return "copy-transform";
    if (activeTool === "parcel-grid") return "parcel-grid";
    return activeTool ?? "";
  }

  function publishInventoryState(): void {
    const status = panel.querySelector<HTMLElement>("[data-world-edit-status]");
    const canExecute = activeTool === "selection" || activeTool === "room"
      ? Boolean(selection.first && selection.second)
      : activeTool === "clipboard"
        ? operation === "paste" ? clipboard.length > 0 : Boolean(selection.first && selection.second)
        : true;
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
        busy,
        canExecute,
      },
    }));
  }

  function disposeSelectionGroup(): void {
    selectionBoxRuntime = null;
    selectionHandles = [];
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
      return Math.max(1, Math.min(segment.maximumDepth, Math.round(depth ?? defaultSlantedDepth)));
    };
    const maximumSlantedDepth = Math.max(defaultSlantedDepth, ...boundarySegments.map(depthForSegment));

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
      for (let segmentIndex = 0; segmentIndex < boundarySegments.length; segmentIndex += 1) {
        const segment = boundarySegments[segmentIndex]!;
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
      const divisions = Math.max(1, Math.ceil(segment.length));
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
          gridSchemaVersion: "vectoplan-parcel-grid-guide.v7",
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
    const partition = buildParcelGridPartition({
      boundarySegments: boundarySegments.map((segment) => {
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
        };
      }),
      coverageTriangles: parcelCoverageTriangles,
      bounds: { minimumX, maximumX, minimumZ, maximumZ },
      minimumArea: 1e-6,
    });
    for (const segment of boundarySegments) addSegment(blueSegments, segment.start, segment.end);
    const logicalSlantedCells = new Map<string, ParcelGridZoneCell[]>();
    for (const partitionCell of partition.cells) {
      const cell: ParcelGridZoneCell = { ...partitionCell };
      zoneCells.push(cell);
      const polygon = cell.polygon;
      const lineBucket = cell.zone === "straight"
          ? straightSegments
          : transitionSegments;
      if (cell.zone.startsWith("slanted-")) {
        if (cell.logicalCellId) {
          const fragments = logicalSlantedCells.get(cell.logicalCellId) ?? [];
          fragments.push(cell);
          logicalSlantedCells.set(cell.logicalCellId, fragments);
        }
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
    for (const cells of logicalSlantedCells.values()) {
      for (const polygon of mergeParcelGridCoverage(cells.map((cell) => cell.polygon))) {
        for (let edge = 0; edge < polygon.length; edge += 1) {
          addSegment(slantedSegments, polygon[edge]!, polygon[(edge + 1) % polygon.length]!);
        }
      }
    }
    // The inner limit of the slanted raster is a first-class adjustable guide,
    // not just an incidental row edge. Draw it for every parcel boundary and
    // use the selected edge's persisted custom depth where applicable.
    for (const segment of boundarySegments) {
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

    if (innerAxisLines && activeTool === "parcel-grid") {
      innerAxisLines.frustumCulled = false;
      const linePositions = innerAxisLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      linePositions.setUsage(THREE.DynamicDrawUsage);
      const camera = options.sceneRuntime.getCamera();
      const renderer = options.sceneRuntime.getRenderer();
      for (let index = 0; index < boundarySegments.length; index += 1) {
        const segment = boundarySegments[index]!;
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
      schemaVersion: "vectoplan-parcel-grid-guide.v7",
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
        if (!cell.zone.startsWith("slanted-")) continue;
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
      const cells = logicalSlantedCells.get(selectedGroup[0]) ?? selectedGroup[1].cells;
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
      const boundarySegmentId = primary.boundarySegmentId ?? "clipped-edge";
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
          gridSchemaVersion: "vectoplan-parcel-grid-guide.v7",
          sourceCell: { x: anchorPosition.x, z: anchorPosition.z },
          logicalGridCellId: selectedGroup[0],
          boundarySegmentId,
          boundaryRow,
          boundaryColumn: primary.boundaryColumn ?? null,
          resolvedFrom: "clipped-grid-partition",
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
      scene.add(group);
      parcelGroup = group;
    }
    rebuildParcelGridScene();
  }

  function rebuildSelectionScene(): void {
    disposeSelectionGroup();
    if (!selection.first || !selection.second) return;
    const scene = options.sceneRuntime.getScene();
    if (!scene) return;
    if (activeTool === "ruler") {
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
    scene.add(group);
    selectionGroup = group;
    selectionBoxRuntime = { fill, edges, topGrid };
    updateSelectionScenePreview();
  }

  function updateSelectionScenePreview(): boolean {
    if (!selection.first || !selection.second || !selectionBoxRuntime || !["selection", "room"].includes(activeTool ?? "")) return false;
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
    const titles: Record<WorldEditTool, string> = {
      selection: "Selection Tool",
      room: "Räume",
      paint: "Paint Brush",
      sculpt: "Sculpt Brush",
      parcel: "Flurstück Tool",
      "parcel-grid": "Grundstücksraster",
      ruler: "Messwerkzeug",
      clipboard: "Copy / Cut / Paste",
    };
    if (title) title.textContent = activeTool ? titles[activeTool] : "WorldEdit";
    if (first) first.textContent = positionLabel(selection.first);
    if (second) second.textContent = positionLabel(selection.second);
    if (material) material.textContent = operation === "clear" ? "Luft / entfernen" : placement.label ?? placement.runtimeBlockTypeId ?? "Hotbar auswählen";
    if (parcelCount) parcelCount.textContent = `${parcelSelection.parcels.length} Grundstück${parcelSelection.parcels.length === 1 ? "" : "e"}`;
    options.root.dataset.parcelCatalogCount = String(parcelSelection.availableParcels.length);
    options.root.dataset.parcelSelectionCount = String(parcelSelection.parcels.length);
    if (brushSettings) brushSettings.hidden = activeTool !== "paint" && activeTool !== "sculpt";
    if (coordinates) coordinates.hidden = !["selection", "room", "ruler", "clipboard"].includes(activeTool ?? "");
    if (rulerResult) rulerResult.hidden = activeTool !== "ruler";
    const distance = measurementMetres(selection);
    if (rulerDistance) rulerDistance.textContent = distance === null ? "–" : `${distance.toFixed(2)} m`;
    if (operationField) operationField.hidden = activeTool === "parcel" || activeTool === "parcel-grid" || activeTool === "ruler" || activeTool === "room";
    if (materialField) materialField.hidden = activeTool === "parcel" || activeTool === "parcel-grid" || activeTool === "ruler" || activeTool === "room" || ["copy", "cut", "paste"].includes(operation);
    if (maskField) maskField.hidden = activeTool === "parcel" || activeTool === "parcel-grid" || activeTool === "ruler" || activeTool === "room";
    if (executeButton) executeButton.hidden = activeTool !== "selection" && activeTool !== "clipboard" && activeTool !== "room";
    if (resetButton) resetButton.textContent = activeTool === "parcel"
      ? "Grundstücke leeren"
      : activeTool === "ruler"
        ? "Messung löschen"
        : activeTool === "selection" || activeTool === "clipboard" || activeTool === "room"
          ? "Auswahl löschen"
          : "Ziel löschen";
    if (clipboardStatus) clipboardStatus.hidden = activeTool !== "clipboard";
    if (clipboardCount) clipboardCount.textContent = `${clipboard.length} Zelle${clipboard.length === 1 ? "" : "n"}`;
    if (operationSelect) operationSelect.value = operation;
    if (hint) {
      hint.textContent = activeTool === "selection"
        ? "Linksklick halten und den Auswahlquader blockweise live aufziehen. Danach eine der sechs blauen Flächen greifen und X/Y/Z mit demselben Live-Ziehen anpassen."
        : activeTool === "room"
          ? "Beim Loslassen wird die Selection automatisch als Raum gespeichert. Danach kann sofort der nächste Raum gezeichnet werden; Rechtsklick auf einen Raum löscht ihn."
        : activeTool === "parcel"
          ? "Linksklick wählt ein Flurstück aus; Rechtsklick entfernt es aus der Auswahl."
          : activeTool === "parcel-grid"
            ? "Eine Grenze anklicken, dann den Doppelpfeil an der cyanfarbenen Linie greifen und bei gehaltenem Linksklick blockweise ziehen."
          : activeTool === "ruler"
            ? "Linksklick halten und bis zum zweiten Messpunkt ziehen. In Blocknähe rasten beide Punkte an den Ecken ein; Distanz und Achsmaße stehen mittig an der Linie."
            : activeTool === "clipboard"
              ? "Copy/Cut verwendet den markierten Bereich. Paste setzt die Zwischenablage am anvisierten Ziel ein."
              : "Linksklick wendet den Pinsel an; Rechtsklick entfernt mit derselben Form.";
    }
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
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
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
    const clipboardMode = tool === "clipboard";
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
    } else if (activeTool === "ruler") {
      const latest = currentRulerTarget();
      if (!latest) return;
      selection = { first: selection.first, second: latest };
    } else {
      const latest = currentSelectionDragTarget();
      if (!latest) return;
      selection = { first: selection.first, second: latest };
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
    const depthMeters = Math.max(1, Math.min(maximumDepth, requestedDepth));
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
      `Bauachse gewählt: ${angle.toFixed(1)}° · Schrägzone ${depthMeters} Blöcke tief. Den Doppelpfeil anvisieren, Linksklick halten und ziehen.`,
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
        minimumDepth: 1,
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
    raycaster.far = 1_200;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
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
    const depthMeters = Math.max(1, Math.round(parcelGridGuide.depthMeters) - 1);
    parcelGridGuide = { ...parcelGridGuide, depthMeters };
    rememberParcelGridGuide();
    rebuildParcelGridScene();
    persistParcelGridState();
    refreshHud();
    setStatus(`Innere Schräglinie auf ${depthMeters} m nach außen verschoben.`, "ready");
    return true;
  }

  async function executeAt(target?: ChunkApiWorldPosition | null, forcedOperation?: WorldEditOperation): Promise<void> {
    if (!activeTool || busy) return;
    if (!["selection", "paint", "sculpt"].includes(activeTool)) return;
    const commandTool = activeTool as "selection" | "paint" | "sculpt";
    const effectiveOperation = forcedOperation ?? operation;
    const placement = selectedPlacement();
    const targetCells = options.sceneRuntime.getTargetCells();
    const replaceBlockTypeId = targetCells.sourceCell?.blockTypeId ?? null;
    if (parcelMaskInput?.checked && parcelSelection.parcels.length === 0) {
      setStatus("Bitte zuerst in der Karte mindestens ein Grundstück auswählen.", "warning");
      return;
    }
    if (operationNeedsMaterial(effectiveOperation) && (!placement.valid || !placement.runtimeBlockTypeId)) {
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
    if (activeTool === "selection" && (!selection.first || !selection.second)) {
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
        ...(placement.runtimeBlockTypeId ? { blockTypeId: placement.runtimeBlockTypeId } : {}),
        ...(effectiveOperation === "replace" && replaceBlockTypeId ? { replaceBlockTypeId } : {}),
        ...(commandTool === "selection" ? {
          bounds: { min: selection.first, max: selection.second },
        } : {
          brush: {
            shape: brushShape?.value ?? "sphere",
            radius: Number(brushRadius?.value ?? 2),
            density: Number(brushDensity?.value ?? 100),
            wallThickness: Number(brushWall?.value ?? 0),
          },
        }),
        parcelMask: parcelMaskPayload(),
        commandSource: "vectoplan-editor.world-edit",
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
        },
        metadata: {
          ...placement.commandMetadata,
          source: "world-edit-controller",
          projectPublicId: parcelSelection.projectPublicId,
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
        setStatus(commandErrorMessage(result), "error");
        return;
      }
      await options.sceneRuntime.reloadDirtyChunks("world-edit-command");
      setStatus(result.result.changed ? "WorldEdit abgeschlossen." : "Keine Zellen mussten geändert werden.", "ready");
    } catch (error) {
      options.logger?.warn?.("WorldEdit command failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  function existingRoomAt(position: ChunkApiWorldPosition): ExistingRoomRef | null {
    const scene = options.sceneRuntime.getScene();
    if (!scene) return null;
    let found: ExistingRoomRef | null = null;
    scene.traverse((object) => {
      if (found || object.userData.semanticRoom !== true) return;
      const ref = asRecord(object.userData.semanticObjectRef);
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
        metadata: asRecord(ref.metadata),
      };
    });
    return found;
  }

  function selectExistingRoom(ref: ExistingRoomRef): void {
    const coordinates = asArray(ref.footprint.coordinates);
    const polygon = safeString(ref.footprint.type, "Polygon") === "MultiPolygon"
      ? asArray(coordinates[0])
      : coordinates;
    const ring = asArray(polygon[0]).map((point) => asArray(point));
    const xs = ring.map((point) => Number(point[0])).filter(Number.isFinite);
    const zs = ring.map((point) => Number(point[1])).filter(Number.isFinite);
    if (xs.length < 3 || zs.length < 3) return;
    const baseY = Math.floor(Number(ref.footprint.baseY ?? ref.anchor.y));
    const height = Math.max(1, Math.round(Number(ref.footprint.height ?? 1)));
    selection = {
      first: { x: Math.floor(Math.min(...xs)), y: baseY, z: Math.floor(Math.min(...zs)) },
      second: {
        x: Math.max(Math.floor(Math.min(...xs)), Math.ceil(Math.max(...xs)) - 1),
        y: baseY + height - 1,
        z: Math.max(Math.floor(Math.min(...zs)), Math.ceil(Math.max(...zs)) - 1),
      },
    };
    editingRoomInstanceId = ref.objectInstanceId;
    editingRoomAnchor = { ...ref.anchor };
    roomType = safeString(ref.metadata.roomType, roomType);
    roomLabel = safeString(ref.metadata.label, roomLabel).slice(0, 80);
    rebuildSelectionScene();
    refreshHud();
    setStatus(`${roomLabel} ausgewählt. Bereich oder Eigenschaften ändern und „Ausführen“ drücken.`, "ready");
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
      selection = { first: null, second: null };
      await options.sceneRuntime.reloadDirtyChunks("world-edit-room-remove");
      rebuildSelectionScene();
      setStatus("Raum gelöscht.", "ready");
    } catch (error) {
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  async function executeRoom(): Promise<void> {
    if (activeTool !== "room" || busy) return;
    if (!selection.first || !selection.second) {
      setStatus("Bitte zuerst mit dem Selection Tool den Raum in X/Y/Z markieren.", "warning");
      return;
    }
    const bounds = resolveWorldEditSelectionBounds(selection.first, selection.second);
    // Chunk-service geometry updates are idempotent only while occupiedCells
    // stay constant. Retain the original room anchor when resizing an existing
    // room, including when its minimum X/Y/Z face is dragged outward.
    const anchor = editingRoomAnchor ?? {
      x: bounds.minimum.x,
      y: bounds.minimum.y + Math.min(1, bounds.size.y - 1),
      z: bounds.minimum.z,
    };
    const targetCells = options.sceneRuntime.getTargetCells();
    const blockTypeId = targetCells.sourceCell?.blockTypeId || "system_terrain";
    const areaM2 = bounds.size.x * bounds.size.z;
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
        dimensions: { x: bounds.size.x, y: bounds.size.y, z: bounds.size.z },
        footprint: {
          type: "Polygon",
          coordinateSpace: "world-cell-xz",
          coordinates: [[
            [bounds.minimum.x, bounds.minimum.z],
            [bounds.maximum.x + 1, bounds.minimum.z],
            [bounds.maximum.x + 1, bounds.maximum.z + 1],
            [bounds.minimum.x, bounds.maximum.z + 1],
            [bounds.minimum.x, bounds.minimum.z],
          ]],
          baseY: bounds.minimum.y,
          height: bounds.size.y,
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
          volumeM3: areaM2 * bounds.size.y,
          energyZone: true,
          invisibleVolume: true,
          mergeKey: roomId,
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
      rebuildSelectionScene();
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

  async function executeClipboard(target?: ChunkApiWorldPosition | null): Promise<void> {
    if (activeTool !== "clipboard" || busy) return;
    const clipboardOperation = ["copy", "cut", "paste"].includes(operation) ? operation : "copy";
    if (clipboardOperation !== "paste" && (!selection.first || !selection.second)) {
      setStatus("Bitte zuerst mit dem Selection Tool einen Bereich markieren.", "warning");
      return;
    }
    if (clipboardOperation === "paste" && clipboard.length === 0) {
      setStatus("Die Zwischenablage ist leer. Bitte zuerst Copy oder Cut ausführen.", "warning");
      return;
    }
    const anchor = clipboardOperation === "paste"
      ? target ?? cellPosition(options.sceneRuntime.getTargetCells().placementCell)
      : selection.first;
    if (!anchor) {
      setStatus("Kein gültiges Einfügeziel unter dem Fadenkreuz.", "warning");
      return;
    }
    if (parcelMaskInput?.checked && parcelSelection.parcels.length === 0) {
      setStatus("Bitte zuerst mindestens ein Flurstück auswählen oder die Grundstücksmaske deaktivieren.", "warning");
      return;
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
        parcelMask: parcelMaskPayload(),
        commandSource: "vectoplan-editor.world-edit.clipboard",
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
        return;
      }
      const raw = asRecord(result.result.raw);
      const rawClipboard = asArray(raw.clipboard ?? asRecord(raw.worldEdit).clipboard);
      if (clipboardOperation === "copy" || clipboardOperation === "cut") {
        clipboard = rawClipboard.map((entry) => asRecord(entry));
      }
      if (result.result.changed) await options.sceneRuntime.reloadDirtyChunks(`world-edit-${clipboardOperation}`);
      setStatus(
        clipboardOperation === "copy"
          ? `${clipboard.length} Zellen kopiert.`
          : clipboardOperation === "cut"
            ? `${clipboard.length} Zellen ausgeschnitten.`
            : "Zwischenablage eingefügt.",
        "ready",
      );
    } catch (error) {
      options.logger?.warn?.("WorldEdit clipboard command failed.", { error: normalizeUnknownError(error) });
      setStatus(commandErrorMessage(error), "error");
    } finally {
      busy = false;
      if (executeButton) executeButton.disabled = false;
      refreshHud();
    }
  }

  async function handleWorldEditIntent(intent: EditorInputWorldEditIntent): Promise<boolean> {
    if (!activeTool) return false;
    if (activeTool === "selection") {
      if (intent.action === "primary-release") {
        if (selectionDragging) {
          updateSelectionDrag();
          stopSelectionDrag();
          if (!updateSelectionScenePreview()) rebuildSelectionScene();
          refreshHud();
          setStatus("Auswahl bereit. Die sechs Flächengriffe passen X/Y/Z blockweise und live an.", "ready");
        }
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (adjustSelectionHandle(intent.action)) return true;
      if (intent.action === "secondary") {
        stopSelectionDrag();
        if (selection.second) selection = { first: selection.first, second: null };
        else selection = { first: null, second: null };
        rebuildSelectionScene();
        refreshHud();
        setStatus("Letzten Auswahlpunkt entfernt.", "info");
        return true;
      }
      const selectionTarget = intent.position
        ?? worldPositionAtCameraPlane(resolveParcelGridPlaneY(null), null, 1_200);
      if (!selectionTarget) {
        setStatus("Kein gültiges Rasterziel unter dem Fadenkreuz.", "warning");
        return true;
      }
      startSelectionDrag(selectionTarget);
      setStatus("Linksklick halten und den Bereich blockweise live aufziehen.", "ready");
      return true;
    }
    if (activeTool === "room") {
      if (intent.action === "primary-release") {
        if (selectionDragging) {
          updateSelectionDrag();
          stopSelectionDrag();
          if (!updateSelectionScenePreview()) rebuildSelectionScene();
          refreshHud();
          await executeRoom();
        }
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (intent.action === "primary" && adjustSelectionHandle("primary")) return true;
      const roomTarget = intent.position
        ?? worldPositionAtCameraPlane(resolveParcelGridPlaneY(null), null, 1_200);
      if (intent.action === "secondary") {
        if (roomTarget) {
          const existingRoom = existingRoomAt(roomTarget);
          if (existingRoom) {
            void removeExistingRoom(existingRoom);
            return true;
          }
        }
        stopSelectionDrag();
        editingRoomInstanceId = null;
        editingRoomAnchor = null;
        selection = { first: null, second: null };
        rebuildSelectionScene();
        refreshHud();
        setStatus("Raumauswahl zurückgesetzt. Rechtsklick auf einen Raum löscht nur mit aktivem Räume-Tool.", "info");
        return true;
      }
      if (!roomTarget) {
        setStatus("Kein gültiges Rasterziel unter dem Fadenkreuz.", "warning");
        return true;
      }
      const existingRoom = existingRoomAt(roomTarget);
      if (existingRoom) {
        selectExistingRoom(existingRoom);
        return true;
      }
      editingRoomInstanceId = null;
      editingRoomAnchor = null;
      startSelectionDrag(roomTarget);
      setStatus("Linksklick halten und den Raumbereich wie mit dem Selection Tool aufziehen.", "ready");
      return true;
    }
    if (activeTool === "ruler") {
      if (intent.action === "primary-release") {
        if (selectionDragging) {
          updateSelectionDrag();
          stopSelectionDrag();
          rebuildSelectionScene();
          refreshHud();
          const distance = measurementMetres(selection);
          setStatus(distance === null ? "Messung unvollständig." : `Distanz: ${distance.toFixed(2)} Meter`, distance === null ? "warning" : "ready");
        }
        return true;
      }
      if (intent.action === "secondary" || intent.action === "secondary-release") {
        if (intent.action === "secondary") {
          stopSelectionDrag();
          selection = { first: null, second: null };
          rebuildSelectionScene();
          refreshHud();
        }
        return true;
      }
      const fallbackPlanePoint = cameraPointAtPlaneY(resolveParcelGridPlaneY(null));
      const rulerTarget = rulerPointFromTarget(
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
      if (!rulerTarget) {
        setStatus("Kein gültiger Messpunkt unter dem Fadenkreuz.", "warning");
        return true;
      }
      startSelectionDrag(rulerTarget);
      setStatus("Bis zum zweiten Messpunkt ziehen und Linksklick loslassen.", "ready");
      return true;
    }
    if (activeTool === "parcel") {
      if (intent.action.includes("release")) return true;
      const parcelAction = parcelSelectionActionForIntent(intent.action);
      const cameraTarget = cameraPointAtPlaneY(resolveParcelGridPlaneY(null));
      // The real ray hit is authoritative. Projecting the camera ray onto the
      // parcel plane first can land behind a wall or roof and therefore in the
      // neighbouring parcel, which made adding parcels appear broken while
      // removing an already highlighted surface still worked.
      const exactTarget = intent.targetPoint
        ? { x: intent.targetPoint.x, z: intent.targetPoint.z }
        : cameraTarget
          ? { x: cameraTarget.x, z: cameraTarget.z }
          : null;
      const parcelTarget = exactTarget
        ? { x: Math.floor(exactTarget.x), y: Math.floor(resolveParcelGridPlaneY(null)), z: Math.floor(exactTarget.z) }
        : intent.position ?? (intent.sourceCell
          ? { x: intent.sourceCell.worldX, y: intent.sourceCell.worldY, z: intent.sourceCell.worldZ }
          : null);
      if (parcelTarget && parcelAction) {
        setParcelAt(
          parcelTarget,
          exactTarget,
          parcelAction,
        );
      } else if (!parcelTarget) setStatus("Kein gültiges Flurstücksziel.", "warning");
      return true;
    }
    if (activeTool === "parcel-grid") {
      if (intent.action === "primary-release") {
        if (parcelGridDragging) {
          updateParcelGridDrag();
          stopParcelGridDrag(true);
          refreshHud();
        }
        return true;
      }
      if (intent.action === "secondary-release") return true;
      if (intent.action === "secondary") moveParcelGridInnerLineOutward();
      else if (intent.action === "primary") {
        if (startParcelGridDrag()) return true;
        const cameraTarget = cameraPointAtPlaneY(resolveParcelGridPlaneY(null));
        const exactTarget = cameraTarget ?? intent.targetPoint;
        const gridTarget = exactTarget ? {
          x: Math.floor(exactTarget.x),
          y: Math.floor(exactTarget.y),
          z: Math.floor(exactTarget.z),
        } : intent.position;
        if (gridTarget) selectParcelGridAt(gridTarget, exactTarget);
        else setStatus("Kein gültiges Ziel für das Grundstücksraster.", "warning");
      }
      return true;
    }
    if (activeTool === "clipboard") {
      if (intent.action.includes("release")) return true;
      if (intent.action === "primary" && operation === "paste") await executeClipboard(intent.position);
      return true;
    }
    if (intent.action.includes("release")) return true;
    const target = intent.position;
    if (!target) {
      setStatus("Kein gültiges Pinselziel unter dem Fadenkreuz.", "warning");
      return true;
    }
    brushTarget = target;
    refreshHud();
    await executeAt(target, intent.action === "secondary" ? "clear" : operation);
    return true;
  }

  function activate(tool: WorldEditTool, nextOperation: WorldEditOperation = "set"): void {
    if (destroyed) return;
    const previousTool = activeTool;
    stopSelectionDrag();
    stopParcelGridDrag(false);
    activeTool = tool;
    operation = nextOperation;
    configureOperationSelect(tool);
    syncPanelVisibility();
    options.root.dataset.worldEditActive = "true";
    options.root.dataset.worldEditTool = tool;
    const maxDistance = tool === "selection" || tool === "room" || tool === "parcel" || tool === "parcel-grid" || tool === "ruler"
      ? 60
      : tool === "clipboard"
        ? 40
        : 16;
    options.sceneRuntime.setWorldEditIntentHandler(handleWorldEditIntent, { maxDistance });
    if (previousTool === "parcel-grid" || tool === "parcel-grid") rebuildParcelGridScene();
    setStatus(
      tool === "selection"
        ? "Linksklick halten und den Auswahlbereich blockweise live aufziehen; die sechs Flächengriffe funktionieren genauso."
        : tool === "room"
          ? "Raumbereich wie beim Selection Tool aufziehen; beim Loslassen wird er automatisch gespeichert."
        : tool === "ruler"
          ? "Ersten Messpunkt setzen; nahe Blockecken rastet das Messwerkzeug automatisch ein."
          : tool === "parcel"
            ? "Flurstück anvisieren: Linksklick wählt aus, Rechtsklick entfernt."
            : tool === "parcel-grid"
              ? "Jede innere Rasterlinie hat einen Griff: Punkt oder Doppelpfeil anvisieren, Linksklick halten und blockweise ziehen."
            : tool === "clipboard"
              ? "Copy, Cut oder Paste auswählen."
              : "Pinsel mit Linksklick anwenden.",
      "ready",
    );
    refreshHud();
    try { void options.sceneRuntime.getInputController()?.requestPointerLock("world-edit-activate"); } catch { /* best effort */ }
  }

  function deactivate(reason = "deactivate"): void {
    if (destroyed) return;
    const previousTool = activeTool;
    activeTool = null;
    stopSelectionDrag();
    stopParcelGridDrag(false);
    panel.hidden = true;
    selection = { first: null, second: null };
    editingRoomInstanceId = null;
    editingRoomAnchor = null;
    brushTarget = null;
    disposeSelectionGroup();
    options.sceneRuntime.setWorldEditIntentHandler(null);
    if (previousTool === "parcel-grid") rebuildParcelGridScene();
    delete options.root.dataset.worldEditActive;
    delete options.root.dataset.worldEditTool;
    delete options.root.dataset.rulerSnap;
    options.logger?.debug?.("WorldEdit controller deactivated.", { reason });
  }

  function toolFromValue(value: unknown): WorldEditTool {
    const normalized = safeString(value, "selection").toLowerCase().replaceAll("_", "-");
    if (normalized.includes("paint")) return "paint";
    if (normalized.includes("sculpt")) return "sculpt";
    if (normalized.includes("room") || normalized.includes("raum")) return "room";
    if (normalized.includes("parcel-grid") || normalized.includes("grundst")) return "parcel-grid";
    if (normalized.includes("parcel") || normalized.includes("flurst")) return "parcel";
    if (normalized.includes("ruler") || normalized.includes("measure")) return "ruler";
    if (normalized.includes("copy") || normalized.includes("clipboard") || normalized.includes("paste")) return "clipboard";
    return "selection";
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

  function handleSettingsEvent(event: Event): void {
    const detail = asRecord((event as CustomEvent).detail);
    const requestedTool = safeString(detail.toolId ?? detail.tool, "");
    if (requestedTool && activeTool && toolFromValue(requestedTool) !== activeTool) return;

    const requestedOperation = safeString(detail.operation, "").toLowerCase();
    if (["set", "wall", "fill", "replace", "clear", "copy", "cut", "paste"].includes(requestedOperation)) {
      operation = requestedOperation as WorldEditOperation;
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
    stopSelectionDrag();
    stopParcelGridDrag(false);
    if (activeTool === "parcel") {
      parcelSelection.parcels = [];
      postParcelSelection();
    }
    if (activeTool === "parcel-grid") {
      if (parcelGridGuide) persistedParcelGridGuides.delete(parcelGridGuide.guideKey);
      activeParcelGridParcelId = null;
      activeParcelGridGuideKey = null;
      parcelGridGuide = null;
      rebuildParcelGridScene();
      persistParcelGridState();
    }
    selection = { first: null, second: null };
    editingRoomInstanceId = null;
    editingRoomAnchor = null;
    delete options.root.dataset.rulerSnap;
    brushTarget = null;
    rebuildSelectionScene();
    refreshHud();
    setStatus("Auswahl zurÃ¼ckgesetzt.", "info");
  }

  function handleInventoryAction(event: Event): void {
    const detail = asRecord((event as CustomEvent).detail);
    const requestedTool = safeString(detail.toolId ?? detail.tool, "");
    if (requestedTool && requestedTool !== inventoryToolId()) return;
    const action = safeString(detail.action, "").toLowerCase();
    if (action === "reset") resetActiveTool();
    else if (action === "execute") {
      if (activeTool === "clipboard") void executeClipboard();
      else if (activeTool === "room") void executeRoom();
      else void executeAt();
    }
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

  closeButton?.addEventListener("click", () => deactivate("close-button"));
  executeButton?.addEventListener("click", () => {
    if (activeTool === "clipboard") void executeClipboard();
    else if (activeTool === "room") void executeRoom();
    else void executeAt();
  });
  resetButton?.addEventListener("click", () => {
    stopSelectionDrag();
    stopParcelGridDrag(false);
    if (activeTool === "parcel") {
      parcelSelection.parcels = [];
      postParcelSelection();
    }
    selection = { first: null, second: null };
    editingRoomInstanceId = null;
    editingRoomAnchor = null;
    delete options.root.dataset.rulerSnap;
    brushTarget = null;
    rebuildSelectionScene();
    refreshHud();
    setStatus("Auswahl zurückgesetzt.", "info");
  });
  operationSelect?.addEventListener("change", () => {
    operation = operationSelect.value as WorldEditOperation;
    refreshHud();
  });
  [brushRadius, brushDensity, brushWall].forEach((input) => input?.addEventListener("input", refreshHud));
  window.addEventListener(ACTIVATE_EVENT, handleActivateEvent);
  window.addEventListener(SETTINGS_EVENT, handleSettingsEvent);
  window.addEventListener(INVENTORY_ACTION_EVENT, handleInventoryAction);
  window.addEventListener(INVENTORY_STATE_REQUEST_EVENT, publishInventoryState);
  window.addEventListener(CREATIVE_INVENTORY_OPENED_EVENT, handleCreativeInventoryOpened);
  window.addEventListener(CREATIVE_INVENTORY_CLOSED_EVENT, handleCreativeInventoryClosed);
  window.addEventListener(EARTH_GRID_READY_EVENT, handleEarthGridReady);
  window.addEventListener(LOCAL_PARCEL_SYNC, handleLocalParcelSync);
  window.addEventListener("message", handleParentMessage);
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
    destroy(): void {
      if (destroyed) return;
      deactivate("destroy");
      destroyed = true;
      window.removeEventListener(ACTIVATE_EVENT, handleActivateEvent);
      window.removeEventListener(SETTINGS_EVENT, handleSettingsEvent);
      window.removeEventListener(INVENTORY_ACTION_EVENT, handleInventoryAction);
      window.removeEventListener(INVENTORY_STATE_REQUEST_EVENT, publishInventoryState);
      window.removeEventListener(CREATIVE_INVENTORY_OPENED_EVENT, handleCreativeInventoryOpened);
      window.removeEventListener(CREATIVE_INVENTORY_CLOSED_EVENT, handleCreativeInventoryClosed);
      window.removeEventListener(EARTH_GRID_READY_EVENT, handleEarthGridReady);
      window.removeEventListener(LOCAL_PARCEL_SYNC, handleLocalParcelSync);
      window.removeEventListener("message", handleParentMessage);
      disposeParcelGroup();
      disposeParcelGridGroup();
      options.sceneRuntime.setPlacementConstraintHandler(null);
      options.sceneRuntime.setPlacementGeometryHandler(null);
      delete options.root.dataset.parcelGridRotationDegrees;
      delete options.root.dataset.parcelGridTransitionMeters;
      delete options.root.dataset.parcelGridPlaneY;
      panel.remove();
    },
  };
  options.signal?.addEventListener("abort", () => handle.destroy(), { once: true });
  return handle;
}
