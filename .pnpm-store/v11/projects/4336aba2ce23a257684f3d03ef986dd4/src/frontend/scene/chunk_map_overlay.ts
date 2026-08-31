import type { WorldRuntimeHandle } from "@runtime/world/world_runtime";
import { localCoordinatesFromCellIndex } from "@runtime/world/chunk_coordinates";
import type { RuntimeChunkContent } from "@runtime/world/chunk_content";
import { forEachNonAirCellSpan } from "@api/chunk_cell_storage";
import { earthGridLonLatToWorld } from "@utils/earth_grid_coordinates";
import {
  centeredChunkMapOffset,
  chunkMapCenterForZoomAnchor,
  chunkContainsMapRoof,
  chunkMapScaleForDenominator,
  chunkMapRoofSignature,
  chunkMapWorldMetric,
  collectChunkMapRoofs,
  mergeChunkMapRoofs,
  parseChunkMapStructureRoofs,
  type ChunkMapRoof,
  type ChunkMapRoofPoint,
} from "./chunk_map_geometry";

export interface ChunkMapPlayer {
  readonly sessionId: string;
  readonly displayName: string;
  readonly avatarColor: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly local?: boolean;
}

export interface ChunkMapOverlayOptions {
  readonly root: HTMLElement;
  readonly worldRuntime: WorldRuntimeHandle;
  readonly projectId: string;
  readonly worldId: string;
  readonly terrainRegionUrl?: string;
  readonly mapStructuresUrl?: string;
  readonly getEarthGridFrame?: () => unknown;
  readonly onOpen?: () => void | Promise<void>;
  readonly onClose?: () => void | Promise<void>;
}

export interface ChunkMapOverlayUpdate {
  readonly localPlayer: ChunkMapPlayer | null;
  readonly remotePlayers: readonly ChunkMapPlayer[];
  readonly connectionStatus: string;
}

export interface ChunkMapOverlayHandle {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  update(input: ChunkMapOverlayUpdate, nowMs: number): void;
  destroy(): void;
}

interface SurfaceCell {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
  readonly blockTypeId: string;
}

interface TerrainRegionPreview {
  readonly status: string;
  readonly releaseKey: string;
  readonly axisWorldX: readonly number[];
  readonly axisWorldZ: readonly number[];
  readonly heights: readonly number[];
  readonly sampleStepChunks: number;
}

interface MapTransform {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly scaleX: number;
  readonly scaleZ: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface MapParcelFeature {
  readonly parcelId: string;
  readonly geometry: Readonly<Record<string, unknown>>;
  readonly selected: boolean;
  readonly adjacent: boolean;
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

interface MapParcelOverlayState {
  readonly features: readonly MapParcelFeature[];
  readonly projectCoordinate: { readonly longitude: number; readonly latitude: number } | null;
  readonly revision: number;
}

interface MapBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const MAP_UPDATE_INTERVAL_MS = 100;
const MAP_STRUCTURES_REFRESH_MS = 30_000;
const MAP_SCALE_DENOMINATOR = 1_500;
const MAP_MIN_ZOOM = 0.5;
const MAP_MAX_ZOOM = 5;
const MAP_ZOOM_STEP = 1.18;
const SHOW_CHUNK_LOADING_BOUNDS = false;
const FALLBACK_BLOCK_COLOR = "#7b8798";

const PARCEL_OVERLAY_SYNC = "vectoplan-editor:parcel-overlay-sync";
const PARCEL_SELECTION_SYNC = "vectoplan-app:parcel-selection-sync";
const MAP_PARCEL_CHANGED = "vectoplan-map:parcel-selection-changed";
const EDITOR_PARCEL_CHANGED = "vectoplan-editor:parcel-selection-changed";
const EARTH_GRID_READY = "vectoplan-editor:earth-grid-frame-ready";

function clean(value: unknown, fallback = ""): string {
  try {
    const normalized = String(value ?? "").trim();
    return normalized || fallback;
  } catch {
    return fallback;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function centered(value: number, width: number): number {
  return ((value + width / 2) % width + width) % width - width / 2;
}

function normalizeLongitude(value: number): number {
  return centered(value, 360);
}

function normalizeEarthGrid(value: unknown): EarthGridFrameContract | null {
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
    clean(record.schemaVersion) !== "vectoplan-earth-grid-frame.v1"
    || clean(record.horizontalMapping) !== "vectoplan-periodic-equirectangular"
    || clean(record.mappingVersion) !== "1"
    || clean(record.axisConvention) !== "x-east-y-up-z-north"
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
  coordinate: MapParcelOverlayState["projectCoordinate"],
): EarthGridFrameContract | null {
  if (!coordinate) return null;
  const worldWidthCells = 40_000_000;
  const worldHeightCells = 20_000_000;
  const chunkSize = 16;
  const gridX = normalizeLongitude(coordinate.longitude) / 360 * worldWidthCells;
  const gridZ = coordinate.latitude / 180 * worldHeightCells;
  return {
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
}

function lonLatToWorld(
  longitude: number,
  latitude: number,
  frame: EarthGridFrameContract | null,
): readonly [number, number] | null {
  if (!frame) return null;
  return earthGridLonLatToWorld(longitude, latitude, frame);
}

function parcelFeatures(value: unknown): MapParcelOverlayState {
  const root = asRecord(value);
  const selection = asRecord(root.selection ?? root.parcelSelection ?? root.last_map_selection ?? root);
  const selectedValues = asArray(selection.parcels ?? selection.features);
  const selectedIds = new Set(selectedValues.map((item) => clean(asRecord(item).parcelId ?? asRecord(item).parcel_id ?? asRecord(item).id)));
  const adjacentValues = asArray(selection.adjacentParcels ?? selection.adjacent_parcels);
  const adjacentIds = new Set(adjacentValues.map((item) => clean(asRecord(item).parcelId ?? asRecord(item).parcel_id ?? asRecord(item).id)));
  const byId = new Map<string, MapParcelFeature>();
  for (const item of [...asArray(selection.availableParcels ?? selection.available_parcels), ...adjacentValues, ...selectedValues]) {
    const record = asRecord(item);
    const parcelId = clean(record.parcelId ?? record.parcel_id ?? record.featureId ?? record.id);
    const geometry = asRecord(record.geometry);
    if (!parcelId || !clean(geometry.type)) continue;
    byId.set(parcelId, {
      parcelId,
      geometry,
      selected: selectedIds.has(parcelId),
      adjacent: adjacentIds.has(parcelId),
    });
  }
  const coordinate = asRecord(selection.projectCoordinate ?? selection.project_coordinate);
  const longitude = Number(coordinate.longitude ?? coordinate.lon ?? coordinate.lng);
  const latitude = Number(coordinate.latitude ?? coordinate.lat);
  return {
    features: [...byId.values()].slice(0, 768),
    projectCoordinate: Number.isFinite(longitude) && Number.isFinite(latitude)
      ? { longitude, latitude }
      : null,
    revision: Number.isFinite(Number(selection.revision)) ? Number(selection.revision) : 0,
  };
}

function geometryPolygons(geometry: Readonly<Record<string, unknown>>): readonly unknown[] {
  const coordinates = asArray(geometry.coordinates);
  return clean(geometry.type) === "Polygon" ? [coordinates] : coordinates;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function hashHue(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return Math.abs(hash) % 360;
}

function fallbackColor(blockTypeId: string): string {
  const id = blockTypeId.toLowerCase();
  if (/water|wasser|river|lake|ocean/.test(id)) return "#3b82b8";
  if (/grass|vegetation|tree|forest|leaf/.test(id)) return "#5f8f49";
  if (/terrain|earth|soil|dirt|ground/.test(id)) return "#8a7450";
  if (/sand/.test(id)) return "#c7b277";
  if (/stone|rock|concrete|beton/.test(id)) return "#8b9298";
  if (/wood|timber|holz/.test(id)) return "#9a754c";
  if (/road|asphalt|straße|strasse/.test(id)) return "#545b63";
  return `hsl(${hashHue(id)} 24% 52%)`;
}

function normalizedColor(value: unknown, blockTypeId: string): string {
  const color = clean(value);
  if (/^#[0-9a-f]{3,8}$/i.test(color) || /^rgba?\(/i.test(color) || /^hsla?\(/i.test(color)) {
    return color;
  }
  return fallbackColor(blockTypeId) || FALLBACK_BLOCK_COLOR;
}

function shadeColor(context: CanvasRenderingContext2D, color: string, shade: number): string {
  context.fillStyle = color;
  const normalized = context.fillStyle;
  const match = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return color;
  const value = Number.parseInt(match[1]!, 16);
  const factor = clamp(shade, 0.62, 1.28);
  const red = clamp(Math.round(((value >> 16) & 255) * factor), 0, 255);
  const green = clamp(Math.round(((value >> 8) & 255) * factor), 0, 255);
  const blue = clamp(Math.round((value & 255) * factor), 0, 255);
  return `rgb(${red}, ${green}, ${blue})`;
}

function isWhiteMapSurface(blockTypeId: string): boolean {
  return blockTypeId === "system_terrain_region"
    || /terrain|earth|soil|dirt|ground|grass|vegetation|forest|leaf/i.test(blockTypeId);
}

function chunkSignature(chunks: readonly RuntimeChunkContent[]): string {
  return chunks
    .map((chunk) => `${chunk.chunkKey}:${chunk.chunkRevision ?? chunk.chunkVersion ?? chunk.loadedAt}:${chunk.stats.nonAirCellCount}`)
    .sort()
    .join("|");
}

function collectSurfaceCells(chunks: readonly RuntimeChunkContent[]): readonly SurfaceCell[] {
  const columns = new Map<string, SurfaceCell>();
  for (const chunk of chunks) {
    const size = chunk.chunkSize;
    const cellSize = Math.max(0.0001, chunk.cellSize || 1);
    forEachNonAirCellSpan(chunk.cells, (start, end, cellValue) => {
      for (let index = start; index < end; index += 1) {
      const local = localCoordinatesFromCellIndex(index, size);
      const x = (chunk.chunkX * size + local.localX) * cellSize;
      const y = (chunk.chunkY * size + local.localY) * cellSize;
      const z = (chunk.chunkZ * size + local.localZ) * cellSize;
      const key = `${x}:${z}`;
      const previous = columns.get(key);
      if (previous && previous.y >= y) continue;
      const palette = chunk.paletteByCellValue.get(cellValue) ?? null;
      const blockTypeId = palette?.blockTypeId ?? `cell-${cellValue}`;
      columns.set(key, {
        x,
        y,
        z,
        size: cellSize,
        color: normalizedColor(palette?.color, blockTypeId),
        blockTypeId,
      });
      }
    });
  }
  return [...columns.values()];
}

function collectTerrainRegionCells(region: TerrainRegionPreview | null): readonly SurfaceCell[] {
  if (!region) return [];
  const axisX = region.axisWorldX;
  const axisZ = region.axisWorldZ;
  if (axisX.length === 0 || axisZ.length === 0 || region.heights.length !== axisX.length * axisZ.length) {
    return [];
  }
  const stepX = axisX.length > 1 ? Math.abs((axisX[1] ?? 0) - (axisX[0] ?? 0)) : 32;
  const stepZ = axisZ.length > 1 ? Math.abs((axisZ[1] ?? 0) - (axisZ[0] ?? 0)) : 32;
  const size = Math.max(1, Math.min(stepX || 32, stepZ || 32));
  const cells: SurfaceCell[] = [];
  for (let indexZ = 0; indexZ < axisZ.length; indexZ += 1) {
    for (let indexX = 0; indexX < axisX.length; indexX += 1) {
      const height = region.heights[indexX + axisX.length * indexZ];
      if (!Number.isFinite(height)) continue;
      cells.push({
        x: (axisX[indexX] ?? 0) - size * 0.5,
        z: (axisZ[indexZ] ?? 0) - size * 0.5,
        y: height ?? 0,
        size,
        color: "#8a7450",
        blockTypeId: "system_terrain_region",
      });
    }
  }
  return cells;
}

export function createChunkMapOverlay(options: ChunkMapOverlayOptions): ChunkMapOverlayHandle {
  const overlay = document.createElement("section");
  overlay.className = "editor-chunk-map";
  overlay.dataset.editorChunkMap = "true";
  overlay.dataset.editorUiInteractive = "true";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Projektkarte");
  overlay.hidden = true;

  const body = document.createElement("div");
  body.className = "editor-chunk-map__body";
  const playersPanel = document.createElement("aside");
  playersPanel.className = "editor-chunk-map__players";
  const playersTitle = document.createElement("h3");
  playersTitle.textContent = "Projektteilnehmer";
  const connection = document.createElement("span");
  connection.className = "editor-chunk-map__connection";
  connection.textContent = "Multiplayer verbindet";
  const playerList = document.createElement("ul");
  playerList.setAttribute("aria-label", "Spieler auf dem Projekt");
  playersPanel.append(playersTitle, connection, playerList);

  const stage = document.createElement("div");
  stage.className = "editor-chunk-map__stage";
  const canvas = document.createElement("canvas");
  canvas.className = "editor-chunk-map__canvas";
  canvas.setAttribute("aria-label", "Projektkarte mit Grundmaßstab 1 zu 1500, geladenen Chunks und Dächern");
  canvas.tabIndex = -1;
  const empty = document.createElement("div");
  empty.className = "editor-chunk-map__empty";
  empty.textContent = "Geladene Chunkdaten werden für die Karte aufbereitet …";
  const compass = document.createElement("div");
  compass.className = "editor-chunk-map__compass";
  compass.innerHTML = '<span>N</span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 22 18 16 15 10 18z"></path><path d="M16 30V15"></path></svg>';
  stage.append(canvas, empty, compass);
  body.append(playersPanel, stage);

  const footer = document.createElement("footer");
  footer.className = "editor-chunk-map__footer";
  footer.textContent = "Die Karte folgt deiner Position und rendert Gelände, Blöcke und Dachformen aus den geladenen Chunks.";
  overlay.append(body, footer);
  options.root.append(overlay);

  const context = canvas.getContext("2d", { alpha: false });
  const backgroundCanvas = document.createElement("canvas");
  const backgroundContext = backgroundCanvas.getContext("2d", { alpha: false });
  let destroyed = false;
  let lastUpdateAt = 0;
  let lastChunkSignature = "";
  let terrainRegion: TerrainRegionPreview | null = null;
  let terrainRegionStatus = options.terrainRegionUrl ? "preparing" : "unavailable";
  let terrainRegionPoll: number | null = null;
  let terrainRegionLoading = false;
  let mapStructuresPoll: number | null = null;
  let mapStructuresLoading = false;
  let mapStructuresRevision = "";
  let projectedRoofs: readonly ChunkMapRoof[] = [];
  let cachedSurfaceSignature = "";
  let cachedSurfaceCells: readonly SurfaceCell[] = [];
  let cachedRoofSignature = "";
  let cachedRoofs: readonly ChunkMapRoof[] = [];
  let mapDataPrewarmScheduled = false;
  let transform: MapTransform | null = null;
  let backgroundTransform: MapTransform | null = null;
  let zoom = 1;
  let viewCenterX: number | null = null;
  let viewCenterZ: number | null = null;
  let trackedPlayerX: number | null = null;
  let trackedPlayerZ: number | null = null;
  let earthGridFrame: EarthGridFrameContract | null = normalizeEarthGrid(options.getEarthGridFrame?.());
  let parcels: MapParcelOverlayState = {
    features: [],
    projectCoordinate: null,
    revision: 0,
  };
  let lastInput: ChunkMapOverlayUpdate = {
    localPlayer: null,
    remotePlayers: [],
    connectionStatus: "idle",
  };

  function currentChunks(): readonly RuntimeChunkContent[] {
    try {
      return options.worldRuntime.getRegistry().getSnapshot().entries
        .filter(
          (entry) => entry.visible
            && (entry.status === "loaded" || entry.status === "dirty"),
        )
        .map((entry) => entry.chunk);
    } catch {
      return [];
    }
  }

  function currentRoofChunks(): readonly RuntimeChunkContent[] {
    try {
      return options.worldRuntime.getRegistry().getSnapshot().entries
        .filter((entry) => (
          entry.status === "loaded" || entry.status === "dirty"
        ) && chunkContainsMapRoof(entry.chunk))
        .map((entry) => entry.chunk);
    } catch {
      return [];
    }
  }

  function surfaceCellsFor(chunks: readonly RuntimeChunkContent[]): readonly SurfaceCell[] {
    const signature = chunkSignature(chunks);
    if (signature !== cachedSurfaceSignature) {
      cachedSurfaceSignature = signature;
      cachedSurfaceCells = collectSurfaceCells(chunks);
    }
    return cachedSurfaceCells;
  }

  function roofsFor(chunks: readonly RuntimeChunkContent[]): readonly ChunkMapRoof[] {
    const signature = chunkMapRoofSignature(chunks);
    if (signature !== cachedRoofSignature) {
      cachedRoofSignature = signature;
      cachedRoofs = collectChunkMapRoofs(chunks);
    }
    return cachedRoofs;
  }

  function scheduleMapDataPrewarm(): void {
    if (destroyed || !overlay.hidden || mapDataPrewarmScheduled) return;
    const chunks = currentChunks();
    const roofChunks = currentRoofChunks();
    if (
      chunkSignature(chunks) === cachedSurfaceSignature
      && chunkMapRoofSignature(roofChunks) === cachedRoofSignature
    ) return;
    mapDataPrewarmScheduled = true;
    const prewarm = (): void => {
      mapDataPrewarmScheduled = false;
      if (destroyed) return;
      surfaceCellsFor(chunks);
      roofsFor(roofChunks);
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(prewarm, { timeout: 750 });
    } else {
      window.setTimeout(prewarm, 40);
    }
  }

  function resizeCanvas(): boolean {
    const bounds = stage.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    backgroundCanvas.width = width;
    backgroundCanvas.height = height;
    return true;
  }

  function syncViewCenterToLocalPlayer(input: ChunkMapOverlayUpdate): void {
    const localPosition = input.localPlayer?.position;
    if (!localPosition || !Number.isFinite(localPosition.x) || !Number.isFinite(localPosition.z)) {
      trackedPlayerX = null;
      trackedPlayerZ = null;
      return;
    }
    if (viewCenterX === null || viewCenterZ === null) {
      viewCenterX = localPosition.x;
      viewCenterZ = localPosition.z;
    } else if (trackedPlayerX !== null && trackedPlayerZ !== null) {
      viewCenterX += localPosition.x - trackedPlayerX;
      viewCenterZ += localPosition.z - trackedPlayerZ;
    }
    trackedPlayerX = localPosition.x;
    trackedPlayerZ = localPosition.z;
  }

  function mapScales(): Readonly<{ x: number; z: number }> {
    earthGridFrame = normalizeEarthGrid(options.getEarthGridFrame?.()) ?? earthGridFrame;
    const frame = earthGridFrame ?? fallbackEarthGrid(parcels.projectCoordinate);
    const pixelScale = chunkMapScaleForDenominator(
      MAP_SCALE_DENOMINATOR,
      clamp(window.devicePixelRatio || 1, 1, 2),
    ) * zoom;
    if (!frame) return { x: pixelScale, z: pixelScale };
    const latitude = parcels.projectCoordinate?.latitude
      ?? ((frame.storageOrigin.z + (viewCenterZ ?? 0)) / frame.worldHeightCells * 180);
    const metric = chunkMapWorldMetric(
      frame.worldWidthCells,
      frame.worldHeightCells,
      latitude,
    );
    return {
      x: pixelScale * metric.x,
      z: pixelScale * metric.z,
    };
  }

  function parcelWorldBounds(): MapBounds | null {
    if (parcels.features.length === 0) return null;
    earthGridFrame = normalizeEarthGrid(options.getEarthGridFrame?.()) ?? earthGridFrame;
    const frame = earthGridFrame ?? fallbackEarthGrid(parcels.projectCoordinate);
    if (!frame) return null;
    const points: (readonly [number, number])[] = [];
    for (const feature of parcels.features) {
      for (const polygon of geometryPolygons(feature.geometry)) {
        for (const ringValue of asArray(polygon)) {
          for (const coordinate of asArray(ringValue)) {
            const raw = asArray(coordinate);
            const point = lonLatToWorld(Number(raw[0]), Number(raw[1]), frame);
            if (point) points.push(point);
          }
        }
      }
    }
    if (points.length === 0) return null;
    return {
      minX: Math.min(...points.map((point) => point[0])),
      maxX: Math.max(...points.map((point) => point[0])),
      minZ: Math.min(...points.map((point) => point[1])),
      maxZ: Math.max(...points.map((point) => point[1])),
    };
  }

  function updateTransformForViewCenter(): void {
    if (!transform) return;
    const midpointX = (transform.minX + transform.maxX) * 0.5;
    const midpointZ = (transform.minZ + transform.maxZ) * 0.5;
    const worldWidth = Math.max(1, transform.maxX - transform.minX);
    const worldHeight = Math.max(1, transform.maxZ - transform.minZ);
    const halfViewWidth = backgroundCanvas.width / (transform.scaleX * 2);
    const halfViewHeight = backgroundCanvas.height / (transform.scaleZ * 2);
    const requestedX = viewCenterX ?? midpointX;
    const requestedZ = viewCenterZ ?? midpointZ;
    viewCenterX = worldWidth <= halfViewWidth * 2
      ? midpointX
      : clamp(requestedX, transform.minX + halfViewWidth, transform.maxX - halfViewWidth);
    viewCenterZ = worldHeight <= halfViewHeight * 2
      ? midpointZ
      : clamp(requestedZ, transform.minZ + halfViewHeight, transform.maxZ - halfViewHeight);
    const offsets = centeredChunkMapOffset(
      viewCenterX,
      viewCenterZ,
      transform.minX,
      transform.minZ,
      transform.scaleX,
      backgroundCanvas.width,
      backgroundCanvas.height,
      transform.scaleZ,
    );
    transform = { ...transform, ...offsets };
  }

  function roofFaceShade(points: readonly ChunkMapRoofPoint[]): number {
    if (points.length < 3) return 1;
    const first = points[0]!;
    const second = points[1]!;
    const third = points[2]!;
    const ax = second.x - first.x;
    const ay = second.y - first.y;
    const az = second.z - first.z;
    const bx = third.x - first.x;
    const by = third.y - first.y;
    const bz = third.z - first.z;
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const length = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(length) || length < 1e-8) return 1;
    nx /= length;
    ny /= length;
    nz /= length;
    if (ny < 0) { nx *= -1; ny *= -1; nz *= -1; }
    return clamp(0.88 + ny * 0.16 + (-nx * 0.55 - nz * 0.34) * 0.09, 0.78, 1.16);
  }

  function traceRoofRing(
    target: CanvasRenderingContext2D,
    points: readonly ChunkMapRoofPoint[],
    beginPath = true,
  ): boolean {
    if (!transform || points.length < 3) return false;
    if (beginPath) target.beginPath();
    points.forEach((point, index) => {
      const x = transform!.offsetX + (point.x - transform!.minX) * transform!.scaleX;
      const y = transform!.offsetY + (point.z - transform!.minZ) * transform!.scaleZ;
      if (index === 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    });
    target.closePath();
    return true;
  }

  function drawRoofs(roofs: readonly ChunkMapRoof[]): void {
    if (!backgroundContext || !transform || roofs.length === 0) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    for (const roof of roofs) {
      if (roof.outlines.length === 0) continue;
      backgroundContext.beginPath();
      let traced = false;
      for (const ring of roof.outlines) {
        traced = traceRoofRing(backgroundContext, ring, false) || traced;
      }
      if (traced) {
        backgroundContext.fillStyle = "#b85c38";
        backgroundContext.fill("evenodd");
      }
    }
    const faces = roofs.flatMap((roof) => roof.faces.map((face) => ({ roof, face })))
      .sort((left, right) => (
        left.face.points.reduce((sum, point) => sum + point.y, 0) / left.face.points.length
        - right.face.points.reduce((sum, point) => sum + point.y, 0) / right.face.points.length
      ));
    for (const { face } of faces) {
      if (!traceRoofRing(backgroundContext, face.points)) continue;
      backgroundContext.fillStyle = shadeColor(backgroundContext, "#b85c38", roofFaceShade(face.points));
      backgroundContext.fill();
    }
    for (const roof of roofs) {
      for (const ring of roof.outlines) {
        if (!traceRoofRing(backgroundContext, ring)) continue;
        backgroundContext.strokeStyle = "rgba(64, 34, 26, 0.94)";
        backgroundContext.lineWidth = 1.45 * dpr;
        backgroundContext.stroke();
      }
    }
  }

  function renderBackground(
    chunks: readonly RuntimeChunkContent[],
    roofChunks: readonly RuntimeChunkContent[],
  ): void {
    if (!backgroundContext) return;
    const regionCells = collectTerrainRegionCells(terrainRegion);
    const cells = [...regionCells, ...surfaceCellsFor(chunks)];
    const roofs = mergeChunkMapRoofs(projectedRoofs, roofsFor(roofChunks));
    const parcelBounds = parcelWorldBounds();
    const width = backgroundCanvas.width;
    const height = backgroundCanvas.height;
    backgroundContext.fillStyle = "#ffffff";
    backgroundContext.fillRect(0, 0, width, height);

    if (cells.length === 0 && roofs.length === 0 && !parcelBounds) {
      transform = null;
      backgroundTransform = null;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    const cellMinX = cells.length > 0 ? Math.min(...cells.map((cell) => cell.x)) : null;
    const cellMaxX = cells.length > 0 ? Math.max(...cells.map((cell) => cell.x + cell.size)) : null;
    const cellMinZ = cells.length > 0 ? Math.min(...cells.map((cell) => cell.z)) : null;
    const cellMaxZ = cells.length > 0 ? Math.max(...cells.map((cell) => cell.z + cell.size)) : null;
    const roofPoints = roofs.flatMap((roof) => [
      ...roof.faces.flatMap((face) => face.points),
      ...roof.outlines.flat(),
    ]);
    const roofMinX = roofPoints.length > 0 ? Math.min(...roofPoints.map((point) => point.x)) : null;
    const roofMaxX = roofPoints.length > 0 ? Math.max(...roofPoints.map((point) => point.x)) : null;
    const roofMinZ = roofPoints.length > 0 ? Math.min(...roofPoints.map((point) => point.z)) : null;
    const roofMaxZ = roofPoints.length > 0 ? Math.max(...roofPoints.map((point) => point.z)) : null;
    const minX = Math.min(
      cellMinX ?? Number.POSITIVE_INFINITY,
      roofMinX ?? Number.POSITIVE_INFINITY,
      parcelBounds?.minX ?? Number.POSITIVE_INFINITY,
    );
    const maxX = Math.max(
      cellMaxX ?? Number.NEGATIVE_INFINITY,
      roofMaxX ?? Number.NEGATIVE_INFINITY,
      parcelBounds?.maxX ?? Number.NEGATIVE_INFINITY,
    );
    const minZ = Math.min(
      cellMinZ ?? Number.POSITIVE_INFINITY,
      roofMinZ ?? Number.POSITIVE_INFINITY,
      parcelBounds?.minZ ?? Number.POSITIVE_INFINITY,
    );
    const maxZ = Math.max(
      cellMaxZ ?? Number.NEGATIVE_INFINITY,
      roofMaxZ ?? Number.NEGATIVE_INFINITY,
      parcelBounds?.maxZ ?? Number.NEGATIVE_INFINITY,
    );
    const heightValues = [...cells.map((cell) => cell.y), ...roofPoints.map((point) => point.y)];
    const minY = heightValues.length > 0 ? Math.min(...heightValues) : 0;
    const maxY = heightValues.length > 0 ? Math.max(...heightValues) : minY;
    if (viewCenterX === null || viewCenterZ === null) {
      const midpointX = (minX + maxX) * 0.5;
      const midpointZ = (minZ + maxZ) * 0.5;
      const localPosition = lastInput.localPlayer?.position;
      viewCenterX = localPosition && Number.isFinite(localPosition.x)
        ? localPosition.x
        : midpointX;
      viewCenterZ = localPosition && Number.isFinite(localPosition.z)
        ? localPosition.z
        : midpointZ;
    }

    const scales = mapScales();
    transform = {
      minX,
      maxX,
      minZ,
      maxZ,
      scaleX: scales.x,
      scaleZ: scales.z,
      offsetX: 0,
      offsetY: 0,
    };
    updateTransformForViewCenter();
    const offsetX = transform?.offsetX ?? 0;
    const offsetY = transform?.offsetY ?? 0;

    for (const cell of cells) {
      const heightRatio = maxY <= minY ? 0.5 : (cell.y - minY) / (maxY - minY);
      const whiteSurface = isWhiteMapSurface(cell.blockTypeId);
      backgroundContext.fillStyle = whiteSurface
        ? "#ffffff"
        : shadeColor(backgroundContext, cell.color, 0.82 + heightRatio * 0.34);
      const x = offsetX + (cell.x - minX) * scales.x;
      const y = offsetY + (cell.z - minZ) * scales.z;
      const cellPixelsX = Math.max(1, cell.size * scales.x + 0.65);
      const cellPixelsZ = Math.max(1, cell.size * scales.z + 0.65);
      backgroundContext.fillRect(x, y, cellPixelsX, cellPixelsZ);
    }

    if (SHOW_CHUNK_LOADING_BOUNDS) {
      backgroundContext.strokeStyle = "rgba(148, 163, 184, 0.2)";
      backgroundContext.lineWidth = Math.max(1, window.devicePixelRatio || 1);
      chunks.forEach((chunk) => {
        const x = offsetX + (chunk.chunkX * chunk.chunkSize * chunk.cellSize - minX) * scales.x;
        const y = offsetY + (chunk.chunkZ * chunk.chunkSize * chunk.cellSize - minZ) * scales.z;
        const sizeX = chunk.chunkSize * chunk.cellSize * scales.x;
        const sizeZ = chunk.chunkSize * chunk.cellSize * scales.z;
        backgroundContext.strokeRect(x, y, sizeX, sizeZ);
      });
    }

    drawRoofs(roofs);

    backgroundTransform = transform ? { ...transform } : null;
  }

  function drawParcelBoundaries(): void {
    if (!context || !transform || parcels.features.length === 0) return;
    earthGridFrame = normalizeEarthGrid(options.getEarthGridFrame?.()) ?? earthGridFrame;
    const frame = earthGridFrame ?? fallbackEarthGrid(parcels.projectCoordinate);
    if (!frame) return;
    const features = [...parcels.features].sort((first, second) => Number(first.selected) - Number(second.selected));
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    for (const feature of features) {
      for (const polygonValue of geometryPolygons(feature.geometry)) {
        const rings = asArray(polygonValue);
        context.beginPath();
        let traced = false;
        for (const ringValue of rings) {
          const ring = asArray(ringValue)
            .map((coordinate) => {
              const point = asArray(coordinate);
              return lonLatToWorld(Number(point[0]), Number(point[1]), frame);
            })
            .filter((point): point is readonly [number, number] => point !== null);
          if (ring.length < 3) continue;
          ring.forEach(([worldX, worldZ], index) => {
            const x = transform!.offsetX + (worldX - transform!.minX) * transform!.scaleX;
            const y = transform!.offsetY + (worldZ - transform!.minZ) * transform!.scaleZ;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
          traced = true;
        }
        if (!traced) continue;
        if (feature.selected) {
          context.fillStyle = "rgba(37, 99, 235, 0.1)";
          context.fill("evenodd");
        }
        context.strokeStyle = feature.selected
          ? "rgba(29, 78, 216, 1)"
          : feature.adjacent
            ? "rgba(37, 99, 235, 0.8)"
            : "rgba(37, 99, 235, 0.58)";
        context.lineWidth = (feature.selected ? 4 : feature.adjacent ? 2.2 : 1.5) * dpr;
        context.setLineDash([]);
        context.stroke();
      }
    }
    context.setLineDash([]);
  }

  function scheduleMapStructuresRefresh(delayMs: number): void {
    if (destroyed || !options.mapStructuresUrl || mapStructuresPoll !== null) return;
    mapStructuresPoll = window.setTimeout(() => {
      mapStructuresPoll = null;
      void refreshMapStructures();
    }, Math.max(250, delayMs));
  }

  async function refreshMapStructures(): Promise<void> {
    if (destroyed || !options.mapStructuresUrl || mapStructuresLoading) return;
    mapStructuresLoading = true;
    try {
      const response = await fetch(options.mapStructuresUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as {
        readonly mapStructures?: Readonly<Record<string, unknown>>;
      };
      const preview = asRecord(payload?.mapStructures);
      if (response.ok && clean(preview.schemaVersion) === "vectoplan-map-structures.v1") {
        const revision = clean(preview.revision, "empty");
        if (revision !== mapStructuresRevision) {
          mapStructuresRevision = revision;
          projectedRoofs = parseChunkMapStructureRoofs(preview);
          lastChunkSignature = "";
          if (!overlay.hidden) render(lastInput);
        }
      }
    } catch {
      // Registry-backed roofs remain available while the lightweight preview retries.
    } finally {
      mapStructuresLoading = false;
      scheduleMapStructuresRefresh(MAP_STRUCTURES_REFRESH_MS);
    }
  }

  function scheduleTerrainRegionRefresh(delayMs: number): void {
    if (destroyed || !options.terrainRegionUrl || terrainRegionPoll !== null) return;

    terrainRegionPoll = window.setTimeout(() => {
      terrainRegionPoll = null;
      void refreshTerrainRegion();
    }, Math.max(250, delayMs));
  }

  async function refreshTerrainRegion(): Promise<void> {
    if (
      destroyed
      || !options.terrainRegionUrl
      || terrainRegion?.status === "ready"
      || terrainRegionLoading
    ) return;
    terrainRegionLoading = true;
    try {
      const response = await fetch(options.terrainRegionUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as {
        readonly terrainRegion?: Partial<TerrainRegionPreview> & {
          readonly ready?: boolean;
        };
      };
      const region = payload?.terrainRegion;
      if (
        response.ok
        && region?.ready === true
        && Array.isArray(region.axisWorldX)
        && Array.isArray(region.axisWorldZ)
        && Array.isArray(region.heights)
      ) {
        terrainRegion = {
          status: "ready",
          releaseKey: clean(region.releaseKey),
          axisWorldX: region.axisWorldX.map(Number),
          axisWorldZ: region.axisWorldZ.map(Number),
          heights: region.heights.map(Number),
          sampleStepChunks: Number(region.sampleStepChunks) || 2,
        };
        terrainRegionStatus = "ready";
        footer.textContent = "Vollstaendige Projektregion vorbereitet; in 3D wird weiterhin nur die Sichtweite gerendert.";
        lastChunkSignature = "";
        if (!overlay.hidden) render(lastInput);
        return;
      }
      terrainRegionStatus = clean(region?.status, response.ok ? "preparing" : "error");
      footer.textContent = terrainRegionStatus === "preparing"
        ? "Projektregion wird im Hintergrund aus dem vorbereiteten DGM aufgebaut."
        : "Projektregion ist noch nicht verfuegbar; geladene Chunks bleiben sichtbar.";
    } catch {
      terrainRegionStatus = "error";
      footer.textContent = "Projektregion konnte noch nicht geladen werden; erneuter Versuch laeuft.";
    } finally {
      terrainRegionLoading = false;
    }
    scheduleTerrainRegionRefresh(2_000);
  }

  function mapPoint(position: ChunkMapPlayer["position"]): { x: number; y: number } | null {
    if (!transform) return null;
    return {
      x: transform.offsetX + (position.x - transform.minX) * transform.scaleX,
      y: transform.offsetY + (position.z - transform.minZ) * transform.scaleZ,
    };
  }

  function drawPlayer(player: ChunkMapPlayer): void {
    if (!context) return;
    const point = mapPoint(player.position);
    if (!point) return;
    const radius = player.local ? 10 : 8;
    context.save();
    context.translate(point.x, point.y);
    context.rotate(-player.yaw);
    context.beginPath();
    context.moveTo(0, -radius * 1.45);
    context.lineTo(radius, radius);
    context.lineTo(0, radius * 0.55);
    context.lineTo(-radius, radius);
    context.closePath();
    context.fillStyle = player.local ? "#38bdf8" : clean(player.avatarColor, "#f8fafc");
    context.shadowColor = "rgba(15, 23, 42, 0.28)";
    context.shadowBlur = 8;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#ffffff";
    context.stroke();
    context.restore();

    context.font = `${player.local ? 700 : 600} 12px Inter, Segoe UI, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.lineWidth = 4;
    context.strokeStyle = "rgba(255, 255, 255, 0.96)";
    context.strokeText(player.displayName, point.x, point.y + radius + 6);
    context.fillStyle = "#172033";
    context.fillText(player.displayName, point.x, point.y + radius + 6);
  }

  function renderPlayersList(input: ChunkMapOverlayUpdate): void {
    while (playerList.firstChild) playerList.firstChild.remove();
    const players = [input.localPlayer, ...input.remotePlayers].filter((player): player is ChunkMapPlayer => Boolean(player));
    for (const player of players) {
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.style.background = player.local ? "#38bdf8" : clean(player.avatarColor, "#94a3b8");
      const label = document.createElement("span");
      label.textContent = player.displayName || "Gast";
      const suffix = document.createElement("small");
      suffix.textContent = player.local ? "Du" : `${Math.round(player.position.x)}, ${Math.round(player.position.z)}`;
      item.append(dot, label, suffix);
      playerList.append(item);
    }
    connection.dataset.status = input.connectionStatus;
    connection.textContent = input.connectionStatus === "connected"
      ? `${players.length} online`
      : input.connectionStatus === "reconnecting"
        ? "Verbindung wird erneuert"
        : "Multiplayer verbindet";
  }

  function render(input: ChunkMapOverlayUpdate): void {
    if (!context) return;
    const resized = resizeCanvas();
    const chunks = currentChunks();
    const roofChunks = currentRoofChunks();
    syncViewCenterToLocalPlayer(input);
    updateTransformForViewCenter();
    const signature = terrainRegionStatus + ":" + (terrainRegion?.releaseKey ?? "")
      + "|" + chunkSignature(chunks) + "|roofs:" + chunkMapRoofSignature(roofChunks)
      + "|map-structures:" + mapStructuresRevision;
    const backgroundShiftX = transform && backgroundTransform
      ? transform.offsetX - backgroundTransform.offsetX
      : 0;
    const backgroundShiftY = transform && backgroundTransform
      ? transform.offsetY - backgroundTransform.offsetY
      : 0;
    const shiftRequiresRefresh = Math.abs(backgroundShiftX) > canvas.width * 0.12
      || Math.abs(backgroundShiftY) > canvas.height * 0.12;
    if (resized || signature !== lastChunkSignature || shiftRequiresRefresh) {
      lastChunkSignature = signature;
      renderBackground(chunks, roofChunks);
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const drawOffsetX = transform && backgroundTransform
      ? transform.offsetX - backgroundTransform.offsetX
      : 0;
    const drawOffsetY = transform && backgroundTransform
      ? transform.offsetY - backgroundTransform.offsetY
      : 0;
    context.drawImage(backgroundCanvas, drawOffsetX, drawOffsetY);
    drawParcelBoundaries();
    input.remotePlayers.forEach(drawPlayer);
    if (input.localPlayer) drawPlayer(input.localPlayer);
    renderPlayersList(input);
  }

  function setZoom(
    nextZoom: number,
    anchor?: { readonly x: number; readonly y: number },
  ): void {
    const normalized = clamp(nextZoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
    if (Math.abs(normalized - zoom) < 0.001) return;
    if (anchor && transform) {
      const anchorWorldX = transform.minX + (anchor.x - transform.offsetX) / transform.scaleX;
      const anchorWorldZ = transform.minZ + (anchor.y - transform.offsetY) / transform.scaleZ;
      const nextScaleX = transform.scaleX * (normalized / zoom);
      const nextScaleZ = transform.scaleZ * (normalized / zoom);
      const center = chunkMapCenterForZoomAnchor(
        anchor.x,
        anchor.y,
        anchorWorldX,
        anchorWorldZ,
        nextScaleX,
        canvas.width,
        canvas.height,
        nextScaleZ,
      );
      viewCenterX = center.centerX;
      viewCenterZ = center.centerZ;
    }
    zoom = normalized;
    lastChunkSignature = "";
    render(lastInput);
  }

  function handleMapWheel(event: WheelEvent): void {
    if (destroyed || overlay.hidden) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, bounds.width);
    const scaleY = canvas.height / Math.max(1, bounds.height);
    setZoom(
      zoom * (event.deltaY < 0 ? MAP_ZOOM_STEP : 1 / MAP_ZOOM_STEP),
      {
        x: (event.clientX - bounds.left) * scaleX,
        y: (event.clientY - bounds.top) * scaleY,
      },
    );
  }

  function open(): void {
    if (destroyed || !overlay.hidden) return;
    overlay.hidden = false;
    options.root.dataset.chunkMapOpen = "true";
    lastChunkSignature = "";
    lastUpdateAt = 0;
    zoom = 1;
    viewCenterX = null;
    viewCenterZ = null;
    trackedPlayerX = null;
    trackedPlayerZ = null;
    void options.onOpen?.();
    void refreshTerrainRegion();
    void refreshMapStructures();
    canvas.focus({ preventScroll: true });
    render(lastInput);
  }

  function close(): void {
    if (destroyed || overlay.hidden) return;
    overlay.hidden = true;
    options.root.dataset.chunkMapOpen = "false";
    void options.onClose?.();
  }

  function handleMapShortcut(event: KeyboardEvent): void {
    if (destroyed || overlay.hidden || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = String(event.code || event.key || "").toLowerCase();
    if (key !== "escape" && key !== "esc" && key !== "keym" && key !== "m") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }

  function applyParcelOverlay(value: unknown): void {
    const next = parcelFeatures(value);
    parcels = next;
    earthGridFrame = normalizeEarthGrid(options.getEarthGridFrame?.()) ?? earthGridFrame;
    lastChunkSignature = "";
    if (!overlay.hidden) render(lastInput);
  }

  function handleParcelMessage(event: MessageEvent): void {
    const message = asRecord(event.data);
    const type = clean(message.type ?? message.kind);
    if (![PARCEL_SELECTION_SYNC, MAP_PARCEL_CHANGED, EDITOR_PARCEL_CHANGED].includes(type)) return;
    applyParcelOverlay(message.detail ?? message.selection ?? message);
  }

  function handleParcelOverlayEvent(event: Event): void {
    applyParcelOverlay((event as CustomEvent).detail);
  }

  function handleEarthGridReady(event: Event): void {
    earthGridFrame = normalizeEarthGrid((event as CustomEvent).detail) ?? earthGridFrame;
    if (!overlay.hidden) render(lastInput);
  }

  const handle: ChunkMapOverlayHandle = {
    element: overlay,
    open,
    close,
    toggle(): void { overlay.hidden ? open() : close(); },
    isOpen(): boolean { return !overlay.hidden; },
    update(input, nowMs): void {
      lastInput = input;
      if (overlay.hidden) {
        scheduleMapDataPrewarm();
        return;
      }
      if (nowMs - lastUpdateAt < MAP_UPDATE_INTERVAL_MS) return;
      lastUpdateAt = nowMs;
      render(input);
    },
    destroy(): void {
      if (destroyed) return;
      close();
      destroyed = true;
      if (terrainRegionPoll !== null) window.clearTimeout(terrainRegionPoll);
      if (mapStructuresPoll !== null) window.clearTimeout(mapStructuresPoll);
      stage.removeEventListener("wheel", handleMapWheel);
      document.removeEventListener("keydown", handleMapShortcut, true);
      window.removeEventListener("message", handleParcelMessage);
      window.removeEventListener(PARCEL_OVERLAY_SYNC, handleParcelOverlayEvent);
      window.removeEventListener(EARTH_GRID_READY, handleEarthGridReady);
      overlay.remove();
      delete options.root.dataset.chunkMapOpen;
    },
  };

  stage.addEventListener("wheel", handleMapWheel, { passive: false });
  document.addEventListener("keydown", handleMapShortcut, true);
  window.addEventListener("message", handleParcelMessage);
  window.addEventListener(PARCEL_OVERLAY_SYNC, handleParcelOverlayEvent);
  window.addEventListener(EARTH_GRID_READY, handleEarthGridReady);
  void refreshTerrainRegion();
  void refreshMapStructures();
  return handle;
}
