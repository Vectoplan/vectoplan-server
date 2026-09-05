import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createThreeContext, type ThreeContextHandle } from "@render/three_context";
import {
  dimensionAssociationReviewCopy,
  easeReconstructionCamera,
  floorPlanOpeningReviewFeature,
  isReconstructionMessageType,
  isDenseTextOverlay,
  isPrimaryReconstructionCameraKind,
  isRoomOpeningReviewOverlay,
  isRoomLikeReviewKind,
  isRoomTopologyReviewOverlay,
  isReviewCampusFitReady,
  isReviewCampusCameraKind,
  isSafeSourcePreviewDataUrl,
  DEFAULT_PLAN_REVIEW_SPAN_METRES,
  MAX_REVIEW_OVERLAYS,
  MAX_SOURCE_PREVIEW_LONG_EDGE,
  MAX_SOURCE_PREVIEW_PIXELS,
  MODEL_CAMERA_UP,
  MODEL_CAMERA_DIRECTION,
  MODEL_CAMERA_FLIGHT_MS,
  OVERLAY_REVEAL_INTERVAL_MS,
  overlayRevealBatchSize,
  PLAN_REVIEW_OVERLAY_DEPTH_TEST,
  PLAN_REVIEW_OVERLAY_PLANE_Y,
  PLAN_REVIEW_PDF_PLANE_Y,
  planReviewStrokeWidth,
  parseNormalizedOverlayLinePoints,
  parseNormalizedOverlayPoints,
  parseNormalizedSourceCrop,
  parseFloorPlanOpeningReviewPoints,
  parsePlanReviewFrame,
  parseRoomOpeningReviewPoints,
  parseRoomTopologyReviewPoints,
  planReviewFrameChanged,
  PLAN_CAMERA_UP,
  PLAN_CAMERA_FLIGHT_MS,
  PLAN_CAMERA_HOLD_MS,
  projectNormalizedReviewPoint,
  REVIEW_CAMPUS_CAMERA_DIRECTION,
  REVIEW_CAMPUS_CAMERA_FLIGHT_MS,
  RECONSTRUCTION_PREVIEW_CONTRACT,
  RECONSTRUCTION_SCENE_CONTRACT,
  reconstructionCameraFlightUp,
  reconstructionReviewMode,
  reconstructionPresentationMode,
  reconstructionCameraStageForPhase,
  reconstructionModelCameraDistance,
  reconstructionPlanCameraPose,
  reconstructionReviewCampusCameraDistance,
  reviewOverlayPriority,
  reviewOverlayLineMode,
  reviewFeatureCategory,
  reviewOpeningRole,
  roomReviewColor,
  selectReviewOverlayEvictionCandidate,
  semanticColorClass,
  SEMANTIC_COLORS,
  shouldApplySequencedMessage,
  shouldAppendReviewOverlay,
  shouldAcceptReviewOverlayPage,
  shouldDeferViewerAppliedAcknowledgement,
  shouldRenderOverlayInPlanReview,
  shouldRenderSceneObjectInReviewMode,
  shouldPreserveReviewPlaybackOnSceneReset,
  shouldRevealPlanOverlayImmediately,
  shouldUseSourcePlanForModelCamera,
  sourcePreviewDigest,
  sourceTextureDimensions,
  type ReconstructionMessageType,
  type ReconstructionCameraStage,
  type ReconstructionPresentationMode,
  type ReviewFeatureCategory,
  type ReviewOverlayEvictionCandidate,
  type ReviewOverlayPriority,
} from "./reconstruction_preview_protocol";
import {
  disposePreviewObject as disposeObject,
  isSharedSourcePreviewTexture,
  markSharedSourcePreviewTexture,
} from "./reconstruction_preview_resources";
import "../styles/reconstruction_preview.css";

const CONTRACT = RECONSTRUCTION_PREVIEW_CONTRACT;
const SCENE_CONTRACT = RECONSTRUCTION_SCENE_CONTRACT;
const ROOT_SELECTOR = "[data-editor-reconstruction-preview]";
const MAX_OBJECTS = 1_200;
const MAX_VERTICES = 300_000;
const MAX_COORDINATE = 1_000_000;
const MAX_OVERLAYS = MAX_REVIEW_OVERLAYS;
const MAX_SOURCE_PIXELS = MAX_SOURCE_PREVIEW_PIXELS;
const MAX_SOURCE_LONG_EDGE = MAX_SOURCE_PREVIEW_LONG_EDGE;
const MAX_DIMENSION_ASSOCIATION_LABELS = 320;

const REVIEW_FEATURE_LABELS: readonly (readonly [ReviewFeatureCategory, string])[] = Object.freeze([
  ["room", "Räume"],
  ["stair", "Treppen"],
  ["door", "Türen"],
  ["window", "Fenster"],
  ["wallless_opening", "Wandlose Öffnungen"],
  ["wall", "Wände"],
]);

type SceneMessageType = ReconstructionMessageType;

interface ReconstructionMessage {
  readonly contract: typeof CONTRACT;
  readonly type: SceneMessageType;
  readonly workflowId?: string | null;
  readonly sequence?: number;
  readonly presentationMode?: ReconstructionPresentationMode;
  readonly payload?: unknown;
}

interface AnimationEntry {
  readonly node: THREE.Object3D;
  readonly materials: THREE.Material[];
  startedAt: number;
  readonly duration: number;
  readonly grow: boolean;
  readonly overlay: boolean;
  readonly order: number;
  held: boolean;
}

interface PendingOverlayEntry {
  readonly id: string;
  readonly item: Record<string, unknown>;
  readonly node: THREE.Object3D;
  readonly kind: string;
  readonly denseText: boolean;
  readonly priority: ReviewOverlayPriority;
  readonly admissionOrder: number;
  cancelled: boolean;
}

interface CameraFlight {
  readonly stage: ReconstructionCameraStage;
  readonly generation: number;
  readonly startedAt: number;
  readonly duration: number;
  readonly fromPosition: THREE.Vector3;
  readonly fromTarget: THREE.Vector3;
  readonly fromUp: THREE.Vector3;
  readonly toPosition: THREE.Vector3;
  readonly toTarget: THREE.Vector3;
  readonly toUp: THREE.Vector3;
  readonly onComplete: () => void;
}

interface DeferredViewerAppliedAcknowledgement {
  readonly workflowId: string | null;
  readonly sequence: number;
  readonly sceneEventType: SceneMessageType;
}

export interface ReconstructionPreviewRuntimeHandle {
  readonly kind: "vectoplan-editor-reconstruction-preview-runtime.v1";
  applyMessage(message: ReconstructionMessage): void;
  resetCamera(): void;
  getSnapshot(): Record<string, unknown>;
  destroy(): void;
}

declare global {
  interface Window {
    __VECTOPLAN_RECONSTRUCTION_PREVIEW__?: ReconstructionPreviewRuntimeHandle;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "", maximum = 180): string {
  const normalized = String(value ?? "").trim();
  return (normalized || fallback).slice(0, maximum);
}

function finite(value: unknown, fallback = 0, minimum = -MAX_COORDINATE, maximum = MAX_COORDINATE): number {
  const result = Number(value);
  return Number.isFinite(result) ? THREE.MathUtils.clamp(result, minimum, maximum) : fallback;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= 0 ? result : fallback;
}

function vector3(value: unknown): THREE.Vector3 | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const coordinates = value.slice(0, 3).map(Number);
  if (!coordinates.every(Number.isFinite)) return null;
  if (coordinates.some((item) => Math.abs(item) > MAX_COORDINATE)) return null;
  return new THREE.Vector3(coordinates[0], coordinates[1], coordinates[2]);
}

function parseBootstrap(root: HTMLElement): Record<string, unknown> {
  try {
    const node = root.querySelector<HTMLScriptElement>("[data-reconstruction-preview-bootstrap]");
    return asRecord(JSON.parse(node?.textContent ?? "{}"));
  } catch {
    return {};
  }
}

function materialList(object: THREE.Object3D): THREE.Material[] {
  const result: THREE.Material[] = [];
  object.traverse((child) => {
    const candidate = child as THREE.Mesh | THREE.Line;
    if (!("material" in candidate)) return;
    const materials = Array.isArray(candidate.material) ? candidate.material : [candidate.material];
    for (const material of materials) {
      if (material instanceof THREE.Material && !result.includes(material)) result.push(material);
    }
  });
  return result;
}

function overlayRenderDiagnostics(entries: Iterable<PendingOverlayEntry>): Record<string, unknown> {
  const subtypeCounts = new Map<string, number>();
  const primitiveCounts = new Map<string, number>();
  let drawableCount = 0;
  let materialCount = 0;
  let zeroOpacityMaterialCount = 0;
  let depthTestEnabledMaterialCount = 0;
  for (const entry of entries) {
    const subtype = text(entry.node.userData.reviewRenderSubtype, "unspecified", 64);
    subtypeCounts.set(subtype, (subtypeCounts.get(subtype) ?? 0) + 1);
    entry.node.traverse((child) => {
      let primitive: string | null = null;
      if (child instanceof THREE.LineSegments) primitive = "line_segments";
      else if (child instanceof THREE.LineLoop) primitive = "line_loop";
      else if (child instanceof THREE.Line) primitive = "line";
      else if (child instanceof THREE.Sprite) primitive = "sprite";
      else if (child instanceof THREE.Mesh) primitive = "mesh";
      if (!primitive) return;
      drawableCount += 1;
      primitiveCounts.set(primitive, (primitiveCounts.get(primitive) ?? 0) + 1);
    });
    for (const material of materialList(entry.node)) {
      materialCount += 1;
      if ("opacity" in material && material.opacity <= 0) zeroOpacityMaterialCount += 1;
      if (material.depthTest) depthTestEnabledMaterialCount += 1;
    }
  }
  const sortedCounts = (counts: Map<string, number>): Record<string, number> => Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
  return {
    entryCount: [...subtypeCounts.values()].reduce((total, count) => total + count, 0),
    subtypeCounts: sortedCounts(subtypeCounts),
    primitiveCounts: sortedCounts(primitiveCounts),
    drawableCount,
    materialCount,
    zeroOpacityMaterialCount,
    depthTestEnabledMaterialCount,
  };
}

function palette(item: Record<string, unknown>): { color: number; opacity: number } {
  const kind = text(item.kind, "geometry", 64).toLowerCase();
  const candidate = text(item.reviewState, "normalized", 32) === "candidate";
  if (kind === "review_panel_section") return { color: 0xff758f, opacity: 0.3 };
  if (kind === "review_panel_elevation") return { color: 0xb884f5, opacity: 0.3 };
  if (kind === "correspondence_line") {
    const role = text(asRecord(item.correspondence).role, "", 48).toLowerCase();
    return { color: role === "ceiling" ? 0xffd166 : 0x00e5ff, opacity: 0.96 };
  }
  const feature = reviewFeatureCategory(item);
  if (feature === "room" || feature === "stair") {
    const identity = item.sourceRef ?? item.id ?? item.name ?? item.label ?? kind;
    return { color: roomReviewColor(`${feature}:${String(identity)}`), opacity: feature === "stair" ? 0.34 : 0.28 };
  }
  if (feature === "wallless_opening") return { color: SEMANTIC_COLORS.wallless_opening, opacity: 1 };
  const colorClass = semanticColorClass(kind);
  const color = colorClass === "other" && !candidate ? 0x69d4d0 : SEMANTIC_COLORS[colorClass];
  if (colorClass === "window") return { color, opacity: candidate ? 0.7 : 0.9 };
  if (colorClass === "door") return { color, opacity: candidate ? 0.82 : 0.94 };
  if (colorClass === "room") return { color, opacity: 0.3 };
  if (colorClass === "roof") return { color, opacity: candidate ? 0.78 : 0.9 };
  if (colorClass === "wall") return { color, opacity: 1 };
  return { color, opacity: candidate ? 0.72 : 0.86 };
}

function meshMaterial(item: Record<string, unknown>, surface = false): THREE.MeshStandardMaterial {
  const appearance = palette(item);
  const material = new THREE.MeshStandardMaterial({
    color: appearance.color,
    roughness: 0.72,
    metalness: 0.03,
    transparent: appearance.opacity < 1,
    opacity: appearance.opacity,
    side: surface ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: appearance.opacity >= 0.5,
  });
  material.userData.previewTargetOpacity = appearance.opacity;
  return material;
}

function lineMaterial(
  item: Record<string, unknown>,
  planOverlay = false,
): THREE.LineBasicMaterial {
  const appearance = palette(item);
  const material = new THREE.LineBasicMaterial({
    color: appearance.color,
    transparent: true,
    opacity: Math.max(appearance.opacity, 0.7),
    depthWrite: false,
    depthTest: planOverlay ? PLAN_REVIEW_OVERLAY_DEPTH_TEST : true,
    toneMapped: !planOverlay,
  });
  material.userData.previewTargetOpacity = Math.max(appearance.opacity, 0.7);
  return material;
}

function addEdges(parent: THREE.Object3D, geometry: THREE.BufferGeometry, item: Record<string, unknown>): void {
  const appearance = palette(item);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(appearance.color).offsetHSL(0, 0.04, 0.18),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  material.userData.previewTargetOpacity = 0.42;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), material);
  edges.renderOrder = 8;
  parent.add(edges);
}

function overlayAppearance(item: Record<string, unknown>): { color: number; opacity: number } {
  const classification = text(item.classification, "", 64).toLowerCase();
  const kind = text(item.kind, "", 64).toLowerCase();
  if (classification.includes("exterior_wall") || kind.includes("exterior_wall")) {
    return { color: 0x2de2e6, opacity: 1 };
  }
  if (classification.includes("interior_wall") || kind.includes("interior_wall")) {
    return { color: 0x69d391, opacity: 0.98 };
  }
  if (classification.includes("ambiguous_wall") || kind.includes("ambiguous_wall")) {
    return { color: 0xff6b35, opacity: 1 };
  }
  if (kind.startsWith("dimension.zone.")) return { color: 0xffd166, opacity: 0.96 };
  if (classification === "ocr_text") return { color: 0x5da9ff, opacity: 0.62 };
  if (classification === "dimension_text_candidate") return { color: 0xffd166, opacity: 0.9 };
  if (classification === "dimension_chain") return { color: 0x00e5ff, opacity: 0.98 };
  if (classification === "scale_text_candidate") return { color: 0x4de0c1, opacity: 0.9 };
  if (classification === "view_outline_candidate" || kind === "view_outline_candidate") {
    return { color: 0x42f5c8, opacity: 0.98 };
  }
  if (classification === "view_opening_candidate" || kind === "view_opening_candidate") {
    return { color: 0x43c8ef, opacity: 0.98 };
  }
  if (classification === "view_level_band_candidate" || kind === "view_level_band_candidate") {
    return { color: 0xffd166, opacity: 0.98 };
  }
  if (classification === "cross_view_correspondence" || kind === "cross_view_correspondence") {
    return { color: 0xb884f5, opacity: 0.92 };
  }
  if (kind === "title_block" || kind === "titleblock") return { color: 0xffa62b, opacity: 0.98 };
  if (kind === "floor_plan") return { color: 0x74d99f, opacity: 0.94 };
  if (kind === "elevation") return { color: 0xb884f5, opacity: 0.94 };
  if (kind === "section") return { color: 0xff758f, opacity: 0.94 };
  if (kind === "site_plan") return { color: 0xf9c74f, opacity: 0.94 };
  return { color: 0x96a5b2, opacity: 0.72 };
}

function normalizedBounds(value: unknown): { xMin: number; yMin: number; xMax: number; yMax: number } | null {
  const bounds = asRecord(value);
  if (bounds.space !== "normalized") return null;
  const xMin = finite(bounds.xMin, -1, 0, 1);
  const yMin = finite(bounds.yMin, -1, 0, 1);
  const xMax = finite(bounds.xMax, -1, 0, 1);
  const yMax = finite(bounds.yMax, -1, 0, 1);
  if (xMin < 0 || yMin < 0 || xMax < xMin || yMax < yMin) return null;
  return { xMin, yMin, xMax, yMax };
}

function overlayLabel(item: Record<string, unknown>, color: number): THREE.Sprite | null {
  const kind = text(item.kind, "", 64).toLowerCase();
  const labelKind = ["floor_plan", "elevation", "section", "site_plan", "title_block", "titleblock"]
    .some((candidate) => kind.includes(candidate));
  if (!labelKind) return null;
  const fallback = kind.includes("title")
    ? "PLANKOPF"
    : kind.includes("floor_plan")
      ? "GRUNDRISS"
      : kind.includes("section")
        ? "SCHNITT"
        : kind.includes("elevation")
          ? "ANSICHT"
          : "LAGEPLAN";
  const regionLabel = text(item.rawLabel ?? item.label, fallback, 72);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "rgba(7, 12, 16, 0.9)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.lineWidth = 5;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = "#f7fafb";
  context.font = "600 30px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(regionLabel, canvas.width / 2, canvas.height / 2, canvas.width - 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  material.userData.previewTargetOpacity = 0.96;
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 24;
  sprite.userData.reviewLabel = regionLabel;
  return sprite;
}

function dimensionAssociationLabel(item: Record<string, unknown>): THREE.Sprite | null {
  const association = dimensionAssociationReviewCopy(item);
  if (!association) return null;
  const dimensionText = text(item.label ?? item.rawLabel ?? item.rawText, "Maßtext", 32);
  const label = `${dimensionText} · ${association.compactLabel}`;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 72;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "rgba(7, 12, 16, 0.9)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = association.status === "selected_for_review" ? "#ffd166" : "#ff9f43";
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.fillStyle = "#fff7db";
  context.font = "600 21px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 22);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  material.userData.previewTargetOpacity = 0.96;
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 29;
  sprite.userData.reviewLabel = label;
  sprite.userData.reviewTooltip = association.tooltip;
  sprite.userData.dimensionAssociationStatus = association.status;
  sprite.userData.dimensionAssociationCalibrated = association.calibrated;
  return sprite;
}

function reviewPanelMarker(item: Record<string, unknown>, color: number): THREE.Sprite | null {
  const kind = text(item.kind, "", 64).toLowerCase();
  if (kind !== "review_panel_section" && kind !== "review_panel_elevation") return null;
  const panel = asRecord(item.panel);
  const fallback = kind === "review_panel_section" ? "SCHNITT · REVIEW" : "ANSICHT · REVIEW";
  const label = text(item.rawLabel ?? panel.orientation ?? panel.viewKind, fallback, 48).toUpperCase();
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "rgba(7, 12, 16, 0.88)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.fillStyle = "#f7fafb";
  context.font = "600 22px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 24);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  material.userData.previewTargetOpacity = 0.94;
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 25;
  sprite.userData.reviewLabel = label;
  return sprite;
}

type PlanBandSegment = readonly [THREE.Vector3, THREE.Vector3];

function buildPlanBandSegments(
  segments: readonly PlanBandSegment[],
  color: number,
  width: number,
  opacity: number,
  renderOrder: number,
): THREE.Mesh | null {
  const halfWidth = Math.max(0.001, width * 0.5);
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [start, end] of segments) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length <= 1e-9) continue;
    const normalX = (-dz / length) * halfWidth;
    const normalZ = (dx / length) * halfWidth;
    const base = positions.length / 3;
    const y = (start.y + end.y) * 0.5;
    positions.push(
      start.x + normalX, y, start.z + normalZ,
      start.x - normalX, y, start.z - normalZ,
      end.x + normalX, y, end.z + normalZ,
      end.x - normalX, y, end.z - normalZ,
    );
    indices.push(
      base, base + 2, base + 1,
      base + 2, base + 3, base + 1,
    );
  }
  if (!indices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: PLAN_REVIEW_OVERLAY_DEPTH_TEST,
    toneMapped: false,
    fog: false,
  });
  material.userData.previewTargetOpacity = opacity;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  return mesh;
}

function buildPlanBandPath(
  points: readonly THREE.Vector3[],
  closed: boolean,
  color: number,
  width: number,
  opacity: number,
  renderOrder: number,
): THREE.Mesh | null {
  if (points.length < 2) return null;
  const segments: PlanBandSegment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    segments.push([points[index - 1], points[index]]);
  }
  if (closed && points.length > 2) segments.push([points[points.length - 1], points[0]]);
  return buildPlanBandSegments(segments, color, width, opacity, renderOrder);
}

function buildOverlay(
  item: Record<string, unknown>,
  pageWidth: number,
  pageHeight: number,
  includeDimensionAssociationLabel: boolean,
  planFirstMode = false,
): THREE.Object3D | null {
  const appearance = overlayAppearance(item);
  const classification = text(item.classification, "", 64).toLowerCase();
  const kind = text(item.kind, "", 64).toLowerCase();
  const floorPlanOpening = floorPlanOpeningReviewFeature(item);
  if (floorPlanOpening) {
    const strokeWidth = planReviewStrokeWidth(pageWidth, pageHeight);
    const normalizedPoints = parseFloorPlanOpeningReviewPoints(item);
    if (!normalizedPoints) return null;
    const points = normalizedPoints.map((point) => {
      const projected = projectNormalizedReviewPoint(point, pageWidth, pageHeight);
      return projected ? new THREE.Vector3(projected[0], PLAN_REVIEW_OVERLAY_PLANE_Y, projected[1]) : null;
    });
    if (points.some((point) => point === null)) return null;
    const projectedPoints = points as THREE.Vector3[];
    const group = new THREE.Group();
    if (projectedPoints.length === 2) {
      const marker = buildOpeningMarker(
        item,
        projectedPoints[0],
        projectedPoints[1],
        PLAN_REVIEW_OVERLAY_PLANE_Y,
        strokeWidth,
      );
      if (!marker) return null;
      group.add(marker);
    } else {
      const outlinePoints = projectedPoints.slice(0, -1);
      const outline = buildPlanBandPath(
        outlinePoints,
        true,
        palette(item).color,
        strokeWidth,
        1,
        31,
      );
      if (!outline) return null;
      group.add(outline);
    }
    group.name = text(item.id, `review-overlay-${crypto.randomUUID()}`, 200);
    group.userData.previewKind = classification || kind;
    group.userData.pageId = text(item.pageId, "", 96);
    group.userData.reviewFeatureCategory = floorPlanOpening;
    group.userData.reviewRenderSubtype = floorPlanOpening === "door"
      ? projectedPoints.length === 2 ? "floorplan_door_marker" : "floorplan_door_outline"
      : projectedPoints.length === 2 ? "floorplan_window_marker" : "floorplan_window_outline";
    group.userData.reviewLabel = text(
      item.label,
      floorPlanOpening === "door" ? "Tür im Grundriss" : "Fenster im Grundriss",
      96,
    );
    return group;
  }
  if (isRoomOpeningReviewOverlay(item)) {
    const normalizedPoints = parseRoomOpeningReviewPoints(item);
    if (!normalizedPoints) return null;
    const [normalizedStart, normalizedEnd] = normalizedPoints;
    const projectedStart = projectNormalizedReviewPoint(normalizedStart, pageWidth, pageHeight);
    const projectedEnd = projectNormalizedReviewPoint(normalizedEnd, pageWidth, pageHeight);
    if (!projectedStart || !projectedEnd) return null;
    const start = new THREE.Vector3(projectedStart[0], PLAN_REVIEW_OVERLAY_PLANE_Y, projectedStart[1]);
    const end = new THREE.Vector3(projectedEnd[0], PLAN_REVIEW_OVERLAY_PLANE_Y, projectedEnd[1]);
    const marker = buildOpeningMarker(
      item,
      start,
      end,
      PLAN_REVIEW_OVERLAY_PLANE_Y,
      planReviewStrokeWidth(pageWidth, pageHeight),
    );
    if (!marker) return null;
    const group = new THREE.Group();
    group.add(marker);
    group.name = text(item.id, `review-overlay-${crypto.randomUUID()}`, 200);
    group.userData.previewKind = classification || "room_opening";
    group.userData.pageId = text(item.pageId, "", 96);
    group.userData.reviewFeatureCategory = "wallless_opening";
    group.userData.reviewRenderSubtype = "room_opening_marker";
    group.userData.reviewLabel = text(item.label, "Offener Raumdurchgang", 96);
    return group;
  }
  if (isRoomTopologyReviewOverlay(item)) {
    const normalizedPoints = parseRoomTopologyReviewPoints(item);
    if (!normalizedPoints) return null;
    const polygon = normalizedPoints.map((point) => {
      const projected = projectNormalizedReviewPoint(point, pageWidth, pageHeight);
      return projected ? new THREE.Vector2(projected[0], projected[1]) : null;
    });
    if (polygon.some((point) => point === null)) return null;
    const projectedPolygon = polygon as THREE.Vector2[];
    if (
      projectedPolygon.length > 3
      && projectedPolygon[0].distanceToSquared(projectedPolygon[projectedPolygon.length - 1]) < 1e-12
    ) projectedPolygon.pop();
    if (projectedPolygon.length < 3) return null;
    const faces = THREE.ShapeUtils.triangulateShape(projectedPolygon, []);
    if (!faces.length) return null;
    const color = palette(item).color;
    const fillOpacity = reviewFeatureCategory(item) === "stair" ? 0.42 : 0.34;
    const positions = projectedPolygon.flatMap((point) => [
      point.x,
      PLAN_REVIEW_OVERLAY_PLANE_Y,
      point.y,
    ]);
    const indices = faces.flatMap((face) => [face[0], face[2], face[1]]);
    const surfaceGeometry = new THREE.BufferGeometry();
    surfaceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    surfaceGeometry.setIndex(indices);
    surfaceGeometry.computeVertexNormals();
    const surfaceMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: fillOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: PLAN_REVIEW_OVERLAY_DEPTH_TEST,
      toneMapped: false,
      fog: false,
    });
    surfaceMaterial.userData.previewTargetOpacity = fillOpacity;
    const group = new THREE.Group();
    const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    surface.renderOrder = 11;
    group.add(surface);
    const outlinePoints = projectedPolygon.map(
      (point) => new THREE.Vector3(point.x, PLAN_REVIEW_OVERLAY_PLANE_Y, point.y),
    );
    const outline = buildPlanBandPath(
      outlinePoints,
      true,
      color,
      planReviewStrokeWidth(pageWidth, pageHeight) * 0.62,
      0.94,
      17,
    );
    if (!outline) {
      disposeObject(surface);
      return null;
    }
    group.add(outline);
    const bounds = new THREE.Box2().setFromPoints(projectedPolygon);
    const size = bounds.getSize(new THREE.Vector2());
    const anchor = polygonReviewLabelAnchor(projectedPolygon, faces);
    placeRoomReviewLabel(
      group,
      item,
      new THREE.Vector3(anchor.x, PLAN_REVIEW_OVERLAY_PLANE_Y, anchor.y),
      size.x,
      size.y,
    );
    group.name = text(item.id, `review-overlay-${crypto.randomUUID()}`, 200);
    group.userData.previewKind = classification || "room_topology";
    group.userData.pageId = text(item.pageId, "", 96);
    group.userData.reviewFeatureCategory = reviewFeatureCategory(item);
    group.userData.reviewRenderSubtype = reviewFeatureCategory(item) === "stair"
      ? "stair_topology_polygon"
      : "room_topology_polygon";
    group.userData.reviewLabel = text(item.label, "Raumtopologie", 96);
    return group;
  }
  const lineMode = reviewOverlayLineMode(item);
  if (lineMode) {
    const normalizedPoints = parseNormalizedOverlayLinePoints(item.points);
    if (!normalizedPoints) return null;
    const points = normalizedPoints.map(
      ([x, y]) => new THREE.Vector3(
        (x - 0.5) * pageWidth,
        planFirstMode ? PLAN_REVIEW_OVERLAY_PLANE_Y : 0.072,
        (y - 0.5) * pageHeight,
      ),
    );
    const group = new THREE.Group();
    let chain: THREE.Object3D;
    if (planFirstMode && shouldRevealPlanOverlayImmediately(item, "plan2d")) {
      const band = buildPlanBandPath(
        points,
        lineMode === "loop",
        appearance.color,
        planReviewStrokeWidth(pageWidth, pageHeight) * 0.56,
        appearance.opacity,
        18,
      );
      if (!band) return null;
      chain = band;
    } else {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: appearance.color,
        transparent: true,
        opacity: appearance.opacity,
        depthWrite: false,
        depthTest: planFirstMode ? PLAN_REVIEW_OVERLAY_DEPTH_TEST : true,
        toneMapped: !planFirstMode,
      });
      material.userData.previewTargetOpacity = appearance.opacity;
      chain = lineMode === "loop"
        ? new THREE.LineLoop(geometry, material)
        : new THREE.Line(geometry, material);
      chain.renderOrder = 18;
    }
    group.add(chain);
    group.name = text(item.id, `review-overlay-${crypto.randomUUID()}`, 200);
    group.userData.previewKind = text(item.kind, text(item.classification, "dimension.chain_candidate", 64), 64);
    group.userData.pageId = text(item.pageId, "", 96);
    group.userData.reviewFeatureCategory = reviewFeatureCategory(item);
    group.userData.reviewRenderSubtype = planFirstMode ? "plan_evidence_line" : "review_line";
    return group;
  }
  if (item.classification === "suppressed_polygon") {
    const normalizedPoints = parseNormalizedOverlayPoints(item.points);
    if (!normalizedPoints) return null;
    const points = normalizedPoints.map(
      ([x, y]) => new THREE.Vector3(
        (x - 0.5) * pageWidth,
        planFirstMode ? PLAN_REVIEW_OVERLAY_PLANE_Y : 0.055,
        (y - 0.5) * pageHeight,
      ),
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: appearance.color,
      transparent: true,
      opacity: appearance.opacity,
      depthWrite: false,
      depthTest: planFirstMode ? PLAN_REVIEW_OVERLAY_DEPTH_TEST : true,
      toneMapped: !planFirstMode,
    });
    material.userData.previewTargetOpacity = appearance.opacity;
    const group = new THREE.Group();
    const outline = item.closed === false
      ? new THREE.Line(geometry, material)
      : new THREE.LineLoop(geometry, material);
    outline.renderOrder = 16;
    group.add(outline);
    group.name = text(item.id, `review-overlay-${crypto.randomUUID()}`, 200);
    group.userData.previewKind = text(item.kind, "suppressed_polygon", 64);
    group.userData.pageId = text(item.pageId, "", 96);
    return group;
  }
  const bounds = normalizedBounds(item.bounds);
  if (!bounds) return null;
  const xMin = (bounds.xMin - 0.5) * pageWidth;
  const xMax = (bounds.xMax - 0.5) * pageWidth;
  const zMin = (bounds.yMin - 0.5) * pageHeight;
  const zMax = (bounds.yMax - 0.5) * pageHeight;
  const points = [
    new THREE.Vector3(xMin, planFirstMode ? PLAN_REVIEW_OVERLAY_PLANE_Y : 0.042, zMin),
    new THREE.Vector3(xMax, planFirstMode ? PLAN_REVIEW_OVERLAY_PLANE_Y : 0.042, zMin),
    new THREE.Vector3(xMax, planFirstMode ? PLAN_REVIEW_OVERLAY_PLANE_Y : 0.042, zMax),
    new THREE.Vector3(xMin, planFirstMode ? PLAN_REVIEW_OVERLAY_PLANE_Y : 0.042, zMax),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: appearance.color,
    transparent: true,
    opacity: appearance.opacity,
    depthWrite: false,
    depthTest: planFirstMode ? PLAN_REVIEW_OVERLAY_DEPTH_TEST : true,
    toneMapped: !planFirstMode,
  });
  material.userData.previewTargetOpacity = appearance.opacity;
  const group = new THREE.Group();
  const outline = new THREE.LineLoop(geometry, material);
  outline.renderOrder = 15;
  group.add(outline);
  if (kind.startsWith("dimension.zone.")) {
    const zoneWidth = Math.max(0.01, xMax - xMin);
    const zoneHeight = Math.max(0.01, zMax - zMin);
    const zoneMaterial = new THREE.MeshBasicMaterial({
      color: appearance.color,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: planFirstMode ? PLAN_REVIEW_OVERLAY_DEPTH_TEST : true,
      toneMapped: !planFirstMode,
      fog: !planFirstMode,
    });
    zoneMaterial.userData.previewTargetOpacity = 0.1;
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(zoneWidth, zoneHeight), zoneMaterial);
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(
      (xMin + xMax) / 2,
      planFirstMode ? PLAN_REVIEW_OVERLAY_PLANE_Y : 0.036,
      (zMin + zMax) / 2,
    );
    zone.renderOrder = 14;
    group.add(zone);
  }
  // Full-width region banners obscure the rooms on a top-down source sheet.
  // Spatial review may still use them; plan review keeps the bounded region
  // outline and reserves labels for the actual room polygons above.
  const label = planFirstMode ? null : overlayLabel(item, appearance.color);
  if (label) {
    const labelWidth = THREE.MathUtils.clamp((xMax - xMin) * 0.72, 3.2, 11);
    label.position.set((xMin + xMax) / 2, 0.16, zMin + 0.3);
    label.scale.set(labelWidth, Math.max(0.72, labelWidth * 0.1875), 1);
    group.add(label);
  }
  const associationLabel = includeDimensionAssociationLabel
    ? dimensionAssociationLabel(item)
    : null;
  if (associationLabel) {
    const labelWidth = THREE.MathUtils.clamp(Math.max((xMax - xMin) * 1.5, 3.2), 3.2, 8.5);
    associationLabel.position.set((xMin + xMax) / 2, 0.14, (zMin + zMax) / 2);
    associationLabel.scale.set(labelWidth, Math.max(0.45, labelWidth * 0.14), 1);
    group.add(associationLabel);
    group.userData.hasDimensionAssociationLabel = true;
  }
  if (item.presentation === "panel") {
    const width = Math.max(0.08, xMax - xMin);
    const height = Math.max(0.08, zMax - zMin);
    const panelGeometry = new THREE.PlaneGeometry(width, height);
    const panelMaterial = new THREE.MeshBasicMaterial({
      color: appearance.color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    panelMaterial.userData.previewTargetOpacity = 0.12;
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set((xMin + xMax) / 2, height / 2, pageHeight / 2 + 1.2);
    panel.renderOrder = 4;
    group.add(panel);
  }
  group.name = text(item.id, `review-overlay-${crypto.randomUUID()}`, 200);
  group.userData.previewKind = text(item.classification, text(item.kind, "overlay", 64), 64);
  group.userData.pageId = text(item.pageId, "", 96);
  group.userData.reviewFeatureCategory = reviewFeatureCategory(item);
  return group;
}

function roomReviewLabel(item: Record<string, unknown>, color: number): THREE.Sprite | null {
  const feature = reviewFeatureCategory(item);
  if (feature !== "room" && feature !== "stair") return null;
  const fallback = feature === "stair" ? "Treppe" : "Raum";
  const label = text(item.name ?? item.label ?? item.rawLabel, fallback, 64);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "rgba(7, 12, 16, 0.88)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.fillStyle = "#ffffff";
  context.font = "650 23px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 22);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  material.userData.previewTargetOpacity = 0.96;
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 30;
  sprite.userData.reviewLabel = label;
  return sprite;
}

function placeRoomReviewLabel(
  parent: THREE.Object3D,
  item: Record<string, unknown>,
  position: THREE.Vector3,
  spanX: number,
  spanZ: number,
): void {
  const label = roomReviewLabel(item, palette(item).color);
  if (!label) return;
  const width = THREE.MathUtils.clamp(
    Math.min(Math.max(spanX, spanZ) * 0.72, Math.max(0.01, Math.min(spanX, spanZ)) * 1.8),
    0.35,
    5.2,
  );
  label.position.copy(position);
  label.scale.set(width, Math.max(0.16, width * 0.25), 1);
  parent.add(label);
}

function pointIsInsidePolygon(point: THREE.Vector2, polygon: readonly THREE.Vector2[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crossesRay = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y))
        / (previousPoint.y - currentPoint.y)
      ) + currentPoint.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function polygonReviewLabelAnchor(
  polygon: readonly THREE.Vector2[],
  faces: readonly number[][],
): THREE.Vector2 {
  let twiceArea = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = (current.x * next.y) - (next.x * current.y);
    twiceArea += cross;
    weightedX += (current.x + next.x) * cross;
    weightedY += (current.y + next.y) * cross;
  }
  if (Math.abs(twiceArea) > 1e-9) {
    const centroid = new THREE.Vector2(
      weightedX / (3 * twiceArea),
      weightedY / (3 * twiceArea),
    );
    if (pointIsInsidePolygon(centroid, polygon)) return centroid;
  }

  let bestAnchor = polygon[0].clone();
  let bestArea = -1;
  for (const face of faces) {
    const first = polygon[face[0]];
    const second = polygon[face[1]];
    const third = polygon[face[2]];
    if (!first || !second || !third) continue;
    const area = Math.abs(
      ((second.x - first.x) * (third.y - first.y))
      - ((second.y - first.y) * (third.x - first.x)),
    );
    if (area <= bestArea) continue;
    bestArea = area;
    bestAnchor = new THREE.Vector2(
      (first.x + second.x + third.x) / 3,
      (first.y + second.y + third.y) / 3,
    );
  }
  return bestAnchor;
}

function buildOpeningMarker(
  item: Record<string, unknown>,
  start: THREE.Vector3,
  end: THREE.Vector3,
  y: number,
  widthValue?: number,
): THREE.Mesh | null {
  const openingRole = reviewOpeningRole(item);
  if (!openingRole) return null;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.002) return null;
  const width = Number.isFinite(widthValue) && Number(widthValue) > 0
    ? THREE.MathUtils.clamp(Number(widthValue), 0.01, 2)
    : THREE.MathUtils.clamp(length * 0.075, 0.08, 0.22);
  const tickHalfLength = THREE.MathUtils.clamp(length * 0.16, width * 1.35, 0.45);
  const normalX = (-dz / length) * tickHalfLength;
  const normalZ = (dx / length) * tickHalfLength;
  const startOnSheet = new THREE.Vector3(start.x, y, start.z);
  const endOnSheet = new THREE.Vector3(end.x, y, end.z);
  const segments: readonly PlanBandSegment[] = [
    [startOnSheet, endOnSheet],
    [
      new THREE.Vector3(start.x - normalX, y, start.z - normalZ),
      new THREE.Vector3(start.x + normalX, y, start.z + normalZ),
    ],
    [
      new THREE.Vector3(end.x - normalX, y, end.z - normalZ),
      new THREE.Vector3(end.x + normalX, y, end.z + normalZ),
    ],
  ];
  const marker = buildPlanBandSegments(
    segments,
    openingRole === "wallless" ? SEMANTIC_COLORS.wallless_opening : palette(item).color,
    width,
    1,
    31,
  );
  if (!marker) return null;
  marker.userData.reviewOpeningRole = openingRole;
  return marker;
}

function buildWall(item: Record<string, unknown>, geometry: Record<string, unknown>): THREE.Object3D | null {
  const start = vector3(geometry.start);
  const end = vector3(geometry.end);
  if (!start || !end) return null;
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  if (length < 0.002) return null;
  const height = finite(geometry.height, 3, 0.01, 1_000);
  const thickness = finite(geometry.thickness, 0.14, 0.005, 100);
  const baseY = finite(geometry.baseY, Math.min(start.y, end.y));
  const box = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(box, meshMaterial(item));
  mesh.position.set((start.x + end.x) / 2, baseY + height / 2, (start.z + end.z) / 2);
  mesh.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Individual wall boxes deliberately have no full edge cage: their shared
  // T/L joints otherwise look like cracks. The backend preserves joint refs
  // for a later true miter/union operation; this viewer must not fake CSG.
  const marker = buildOpeningMarker(item, start, end, baseY + height + 0.035);
  if (!marker) return mesh;
  const group = new THREE.Group();
  group.add(mesh, marker);
  return group;
}

function buildBox(item: Record<string, unknown>, geometry: Record<string, unknown>): THREE.Object3D | null {
  const center = vector3(geometry.center);
  const size = vector3(geometry.size);
  if (!center || !size) return null;
  size.set(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z));
  if (Math.min(size.x, size.y, size.z) < 0.001) return null;
  const box = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(box, meshMaterial(item));
  mesh.position.copy(center);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addEdges(mesh, box, item);
  const feature = reviewFeatureCategory(item);
  if (feature !== "room" && feature !== "stair") return mesh;
  const group = new THREE.Group();
  group.add(mesh);
  placeRoomReviewLabel(
    group,
    item,
    new THREE.Vector3(center.x, center.y + (size.y / 2) + 0.05, center.z),
    size.x,
    size.z,
  );
  return group;
}

function buildPolygon(item: Record<string, unknown>, geometry: Record<string, unknown>): THREE.Object3D | null {
  const points = asArray(geometry.points).map(vector3).filter((point): point is THREE.Vector3 => Boolean(point));
  if (points.length > 2 && points[0].distanceToSquared(points[points.length - 1]) < 1e-12) points.pop();
  if (points.length < 3 || points.length > MAX_VERTICES) return null;
  const flat = points.map((point) => new THREE.Vector2(point.x, point.z));
  const faces = THREE.ShapeUtils.triangulateShape(flat, []);
  if (!faces.length) return null;
  const baseY = finite(geometry.baseY, points[0].y);
  const positions = points.flatMap((point) => [point.x, baseY + 0.012, point.z]);
  const indices = faces.flatMap((face) => [face[0], face[2], face[1]]);
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  buffer.setIndex(indices);
  buffer.computeVertexNormals();
  const group = new THREE.Group();
  const surface = new THREE.Mesh(buffer, meshMaterial(item, true));
  surface.receiveShadow = true;
  surface.renderOrder = 2;
  group.add(surface);
  const outlinePoints = [...points, points[0]].flatMap((point) => [point.x, baseY + 0.025, point.z]);
  const outlineGeometry = new THREE.BufferGeometry();
  outlineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(outlinePoints, 3));
  const outline = new THREE.Line(outlineGeometry, lineMaterial(item));
  outline.renderOrder = 9;
  group.add(outline);
  const feature = reviewFeatureCategory(item);
  if (feature === "room" || feature === "stair") {
    const bounds = new THREE.Box2().setFromPoints(flat);
    const size = bounds.getSize(new THREE.Vector2());
    const anchor = polygonReviewLabelAnchor(flat, faces);
    placeRoomReviewLabel(
      group,
      item,
      new THREE.Vector3(anchor.x, baseY + 0.09, anchor.y),
      size.x,
      size.y,
    );
  }
  return group;
}

function buildMesh(item: Record<string, unknown>, geometry: Record<string, unknown>): THREE.Object3D | null {
  const vertices = asArray(geometry.vertices).map(vector3).filter((point): point is THREE.Vector3 => Boolean(point));
  if (!vertices.length || vertices.length > MAX_VERTICES) return null;
  const indices: number[] = [];
  for (const candidate of asArray(geometry.triangles)) {
    if (!Array.isArray(candidate) || candidate.length < 3) continue;
    const face = candidate.slice(0, 3).map(Number);
    if (!face.every((index) => Number.isSafeInteger(index) && index >= 0 && index < vertices.length)) continue;
    indices.push(face[0], face[1], face[2]);
  }
  if (!indices.length) return null;
  const buffer = new THREE.BufferGeometry();
  buffer.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((point) => point.toArray()), 3));
  const itemKind = text(item.kind, "", 64).toLowerCase();
  const isReviewPanel = itemKind === "review_panel_section" || itemKind === "review_panel_elevation";
  if (isReviewPanel && vertices.length === 4) {
    buffer.setAttribute("uv", new THREE.Float32BufferAttribute([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ], 2));
  }
  buffer.setIndex(indices);
  buffer.computeVertexNormals();
  const mesh = new THREE.Mesh(buffer, meshMaterial(item, true));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addEdges(mesh, buffer, item);
  const feature = reviewFeatureCategory(item);
  const isRoomLike = feature === "room" || feature === "stair";
  if (isRoomLike) buffer.computeBoundingBox();
  if (isReviewPanel) {
    const panel = asRecord(item.panel);
    const crop = panel.textureStatus === "source_crop_reference"
      ? parseNormalizedSourceCrop(panel.sourceCrop)
      : null;
    if (crop) mesh.userData.reviewPanelSourceCrop = crop;
    buffer.computeBoundingBox();
    const bounds = buffer.boundingBox;
    const marker = reviewPanelMarker(item, palette(item).color);
    if (bounds && marker) {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      marker.position.set(center.x, bounds.max.y + Math.max(0.3, size.y * 0.05), center.z);
      const markerWidth = THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.5, 2.8, 8);
      marker.scale.set(markerWidth, markerWidth * 0.2, 1);
      mesh.add(marker);
    }
  }
  if (isRoomLike && buffer.boundingBox) {
    const bounds = buffer.boundingBox;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    placeRoomReviewLabel(
      mesh,
      item,
      new THREE.Vector3(center.x, bounds.max.y + 0.05, center.z),
      size.x,
      size.z,
    );
  }
  return mesh;
}

function buildLine(item: Record<string, unknown>, geometry: Record<string, unknown>): THREE.Object3D | null {
  const points = asArray(geometry.points).map(vector3).filter((point): point is THREE.Vector3 => Boolean(point));
  if (points.length < 2 || points.length > MAX_VERTICES) return null;
  const marker = buildOpeningMarker(
    item,
    points[0],
    points[points.length - 1],
    points.reduce((highest, point) => Math.max(highest, point.y), -MAX_COORDINATE) + 0.035,
  );
  if (marker) return marker;
  const buffer = new THREE.BufferGeometry().setFromPoints(points);
  const material = lineMaterial(item);
  if (geometry.segments === true) return new THREE.LineSegments(buffer, material);
  if (geometry.closed === true) return new THREE.LineLoop(buffer, material);
  return new THREE.Line(buffer, material);
}

function buildObject(item: Record<string, unknown>): THREE.Object3D | null {
  const geometry = asRecord(item.geometry);
  const kind = text(geometry.kind, "", 32).toLowerCase();
  let object: THREE.Object3D | null = null;
  if (kind === "wall") object = buildWall(item, geometry);
  else if (kind === "box") object = buildBox(item, geometry);
  else if (kind === "polygon") object = buildPolygon(item, geometry);
  else if (kind === "mesh") object = buildMesh(item, geometry);
  else if (kind === "line") object = buildLine(item, geometry);
  if (!object) return null;
  object.name = text(item.id, `preview-object-${crypto.randomUUID()}`, 200);
  object.userData.previewKind = text(item.kind, "geometry", 64);
  object.userData.reviewFeatureCategory = reviewFeatureCategory(item);
  object.userData.reviewState = text(item.reviewState, "normalized", 32);
  object.userData.metricStatus = text(item.metricStatus, "unknown", 64);
  return object;
}

export function startReconstructionPreview(): ReconstructionPreviewRuntimeHandle {
  const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!root) throw new Error("Reconstruction preview root was not found.");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-reconstruction-preview-canvas]");
  const status = root.querySelector<HTMLElement>("[data-reconstruction-preview-status]");
  const title = root.querySelector<HTMLElement>("[data-reconstruction-preview-title]");
  const details = root.querySelector<HTMLElement>("[data-reconstruction-preview-details]");
  const counts = root.querySelector<HTMLElement>("[data-reconstruction-preview-counts]");
  const resetButton = root.querySelector<HTMLButtonElement>("[data-reconstruction-preview-reset]");
  const fullscreenButton = root.querySelector<HTMLButtonElement>("[data-reconstruction-preview-fullscreen]");
  if (!canvas || !status || !title || !details || !counts) throw new Error("Reconstruction preview DOM is incomplete.");

  const bootstrap = parseBootstrap(root);
  const parentOrigin = text(root.dataset.reconstructionPreviewParentOrigin ?? bootstrap.parentOrigin, "", 512);
  if (!/^https?:\/\/[^/]+$/i.test(parentOrigin)) throw new Error("A trusted parent origin is required.");
  const reviewMode = reconstructionReviewMode(root.dataset.reconstructionPreviewMode);
  const planFirstMode = reviewMode === "plan2d";

  const three: ThreeContextHandle = createThreeContext({
    canvas,
    canvasHost: root,
    antialias: true,
    alpha: false,
    clearColor: "#edf2f5",
    pixelRatioMax: 2,
    enableShadows: true,
    addDefaultLights: false,
    addDefaultGrid: false,
    near: 0.02,
    far: 50_000,
  });
  three.initialize();
  const scene = three.getScene();
  const camera = three.getCamera();
  const renderer = three.getRenderer();
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.FogExp2(0xedf2f5, 0.0035);

  const ambient = new THREE.HemisphereLight(0xf8fbfc, 0xb8c7cf, 1.7);
  const sun = new THREE.DirectionalLight(0xfff1d5, 2.1);
  sun.position.set(45, 70, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(ambient, sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2_000, 2_000),
    new THREE.MeshStandardMaterial({ color: 0xdfe7eb, roughness: 0.96, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.018;
  ground.receiveShadow = true;
  ground.visible = !planFirstMode;
  scene.add(ground);
  const grid = new THREE.GridHelper(2_000, 200, 0x91a8b3, 0xc5d1d7);
  grid.position.y = -0.006;
  materialList(grid).forEach((material) => {
    material.transparent = true;
    material.opacity = 0.3;
  });
  grid.visible = !planFirstMode;
  scene.add(grid);

  const sourceRoot = new THREE.Group();
  sourceRoot.name = "cadbridge_reconstruction_source_plan";
  scene.add(sourceRoot);
  const overlayRoot = new THREE.Group();
  overlayRoot.name = "cadbridge_reconstruction_analysis_overlays";
  scene.add(overlayRoot);
  const previewRoot = new THREE.Group();
  previewRoot.name = "cadbridge_reconstruction_review_world";
  previewRoot.visible = !planFirstMode;
  scene.add(previewRoot);
  function onOrbitControlsStart(): void {
    userInteracted = true;
    cancelCameraFlightForInteraction();
  }

  function createOrbitControls(): OrbitControls {
    const instance = new OrbitControls(camera, canvas);
    instance.enableDamping = true;
    instance.dampingFactor = 0.075;
    instance.screenSpacePanning = true;
    instance.enableRotate = !planFirstMode;
    instance.minDistance = 0.2;
    instance.maxDistance = 8_000;
    instance.maxPolarAngle = Math.PI * 0.495;
    instance.addEventListener("start", onOrbitControlsStart);
    return instance;
  }

  let controls = createOrbitControls();
  const controlsUp = camera.up.clone().normalize();

  function synchronizeOrbitControlsUp(
    upValue: THREE.Vector3 | readonly [number, number, number],
    targetValue: THREE.Vector3,
    update: boolean,
  ): void {
    const nextUp = upValue instanceof THREE.Vector3
      ? upValue.clone().normalize()
      : new THREE.Vector3(...upValue).normalize();
    if (controlsUp.distanceToSquared(nextUp) <= 1e-12) {
      camera.up.copy(nextUp);
      controls.target.copy(targetValue);
      if (update) controls.update();
      return;
    }
    controls.dispose();
    camera.up.copy(nextUp);
    controls = createOrbitControls();
    controls.target.copy(targetValue);
    controlsUp.copy(nextUp);
    if (update) controls.update();
  }

  const objects = new Map<string, THREE.Object3D>();
  const overlays = new Map<string, PendingOverlayEntry>();
  const pendingOverlays: PendingOverlayEntry[] = [];
  const pendingOverlayById = new Map<string, PendingOverlayEntry>();
  const animations: AnimationEntry[] = [];
  const kindCounts = new Map<string, number>();
  const featureCounts = new Map<ReviewFeatureCategory, number>();
  const overlayCounts = new Map<string, number>();
  const unavailableCapabilities = new Map<string, string>();
  let workflowId: string | null = null;
  let lastSequence = 0;
  let renderedVertices = 0;
  let rejectedObjects = 0;
  let rejectedOverlays = 0;
  let overlayAdmissionOrder = 0;
  let dimensionAssociationLabelCount = 0;
  let omittedDimensionAssociationLabelCount = 0;
  let sourcePlane: THREE.Mesh | null = null;
  let sourcePlanDigest: string | null = null;
  let sourceLoadDigest: string | null = null;
  let sourcePlanExpected = false;
  let sourcePlanLoadPending = false;
  let sourcePageId: string | null = null;
  let sourcePageWidth = DEFAULT_PLAN_REVIEW_SPAN_METRES;
  let sourcePageHeight = DEFAULT_PLAN_REVIEW_SPAN_METRES;
  const sourcePageOrigin = new THREE.Vector3();
  let sourceLoadGeneration = 0;
  let sourceTextureWidth = 0;
  let sourceTextureHeight = 0;
  let sourceTextureDownscaledForDevice = false;
  let currentPhase = "waiting";
  let destroyed = false;
  let frame = 0;
  let userInteracted = false;
  let overlayRevealTimer = 0;
  let overlayPlaybackHeld = false;
  let pendingOverlayQueueDirty = false;
  let cameraFlight: CameraFlight | null = null;
  let cameraFlightGeneration = 0;
  let automaticCameraStage: ReconstructionCameraStage | null = null;
  let modelTransitionRequested = false;
  let reviewCampusTransitionRequested = false;
  let reviewCampusReady = false;
  let campusBoundsRevision = 0;
  let fittedCampusBoundsRevision = -1;
  let preserveExistingOverlayIds = false;
  let presentationMode: ReconstructionPresentationMode = "live";
  let pipelineTerminalState: "active" | "completed" | "failed" = "active";
  let terminalSummary = { candidates: 0, normalized: 0 };
  let deferredViewerAppliedAcknowledgement: DeferredViewerAppliedAcknowledgement | null = null;
  let scanIndicator: THREE.Mesh | null = null;
  let scanPhaseId: string | null = null;
  let scanStartedAt = 0;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;

  function setStatus(message: string, state: "loading" | "building" | "ready" | "error"): void {
    status.textContent = message;
    status.dataset.status = state;
  }

  function postToParent(type: string, payload: Record<string, unknown> = {}): void {
    if (window.parent === window) return;
    window.parent.postMessage({ contract: CONTRACT, type, ...payload }, parentOrigin);
  }

  function viewerAppliedPresentationState(): Record<string, unknown> {
    return {
      pendingOverlayCount: pendingOverlayById.size,
      animationCount: animations.length,
      cameraFlightActive: cameraFlight !== null,
      overlayPlaybackHeld,
      sourcePlanExpected,
      sourcePlanLoadPending,
      sourcePlanVisible: isSourcePlanActuallyVisible(),
    };
  }

  function emitViewerAppliedAcknowledgement(
    acknowledgement: DeferredViewerAppliedAcknowledgement,
  ): void {
    postToParent("viewer.applied", {
      workflowId: acknowledgement.workflowId,
      sequence: acknowledgement.sequence,
      sceneEventType: acknowledgement.sceneEventType,
    });
  }

  function acknowledgeViewerApplied(sceneEventType: SceneMessageType): void {
    const acknowledgement: DeferredViewerAppliedAcknowledgement = {
      workflowId,
      sequence: lastSequence,
      sceneEventType,
    };
    if (sceneEventType === "scene.failed") {
      deferredViewerAppliedAcknowledgement = null;
      emitViewerAppliedAcknowledgement(acknowledgement);
      return;
    }
    const terminalBarrierActive = deferredViewerAppliedAcknowledgement?.workflowId === workflowId;
    if (
      terminalBarrierActive
      || shouldDeferViewerAppliedAcknowledgement(
        sceneEventType,
        viewerAppliedPresentationState(),
      )
    ) {
      if (
        !deferredViewerAppliedAcknowledgement
        || acknowledgement.sequence >= deferredViewerAppliedAcknowledgement.sequence
      ) deferredViewerAppliedAcknowledgement = acknowledgement;
      return;
    }
    emitViewerAppliedAcknowledgement(acknowledgement);
  }

  function flushDeferredViewerAppliedAcknowledgement(): void {
    const acknowledgement = deferredViewerAppliedAcknowledgement;
    if (!acknowledgement || acknowledgement.workflowId !== workflowId) return;
    if (
      shouldDeferViewerAppliedAcknowledgement(
        "scene.completed",
        viewerAppliedPresentationState(),
      )
    ) return;
    deferredViewerAppliedAcknowledgement = null;
    emitViewerAppliedAcknowledgement(acknowledgement);
  }

  function updateCounts(): void {
    counts.replaceChildren();
    if (sourcePlane) {
      const badge = document.createElement("span");
      badge.textContent = "Plan: 1";
      counts.appendChild(badge);
    }
    if (sourcePlane || objects.size > 0 || overlays.size > 0 || pendingOverlayById.size > 0) {
      REVIEW_FEATURE_LABELS.forEach(([feature, label]) => {
        const amount = featureCounts.get(feature) ?? 0;
        if (feature === "wall" && amount === 0) return;
        const badge = document.createElement("span");
        badge.dataset.feature = feature;
        badge.textContent = `${label}: ${amount}`;
        counts.appendChild(badge);
      });
    }
    const overlayAmount = overlays.size + pendingOverlayById.size;
    if (overlayAmount > 0) {
      const badge = document.createElement("span");
      badge.textContent = `Analysemarker: ${overlayAmount}`;
      counts.appendChild(badge);
    }
    const otherAmount = featureCounts.get("other") ?? 0;
    const roofAmount = featureCounts.get("roof") ?? 0;
    if (otherAmount + roofAmount > 0) {
      const badge = document.createElement("span");
      badge.textContent = `Weitere Geometrie: ${otherAmount + roofAmount}`;
      counts.appendChild(badge);
    }
    if (rejectedObjects) {
      const badge = document.createElement("span");
      badge.textContent = `${rejectedObjects} nicht darstellbar`;
      counts.appendChild(badge);
    }
    if (rejectedOverlays) {
      const badge = document.createElement("span");
      badge.textContent = `${rejectedOverlays} Overlays ausgelassen`;
      counts.appendChild(badge);
    }
    counts.hidden = counts.childElementCount === 0;
  }

  function setPlaybackActive(active: boolean): void {
    status.dataset.playback = active ? "true" : "false";
  }

  function ensureScanIndicator(): void {
    if (scanIndicator || !sourcePlane || reducedMotion) return;
    const thickness = THREE.MathUtils.clamp(sourcePageHeight * 0.004, 0.06, 0.18);
    const geometry = new THREE.PlaneGeometry(sourcePageWidth, thickness);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4de0c1,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const indicator = new THREE.Mesh(geometry, material);
    indicator.name = "review_source_scan_indicator";
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.set(0, 0.09, -sourcePageHeight / 2);
    indicator.renderOrder = 22;
    scanIndicator = indicator;
    sourceRoot.add(indicator);
  }

  function setScanActivity(active: boolean, phaseId: string | null = null): void {
    status.dataset.scan = active ? "true" : "false";
    if (active) {
      if (scanPhaseId !== phaseId) scanStartedAt = performance.now();
      scanPhaseId = phaseId;
      ensureScanIndicator();
      if (scanIndicator) scanIndicator.visible = !reducedMotion;
      return;
    }
    scanPhaseId = null;
    if (!scanIndicator) return;
    sourceRoot.remove(scanIndicator);
    disposeObject(scanIndicator);
    scanIndicator = null;
  }

  function updatePresentationCopy(): void {
    flushDeferredViewerAppliedAcknowledgement();
    const pendingCount = pendingOverlayById.size;
    const playbackActive = pendingCount > 0 || Boolean(cameraFlight) || animations.length > 0;
    setPlaybackActive(playbackActive);
    if (planFirstMode) {
      if (pendingCount > 0) {
        details.textContent = `${overlays.size} sichtbar · ${pendingCount} Planmarkierungen in Review-Wiedergabe`;
        setStatus(
          pipelineTerminalState === "failed"
            ? "Analyse beendet · vorhandene Planmarkierungen werden noch dargestellt"
            : pipelineTerminalState === "completed"
              ? "Analyse abgeschlossen · lokale 2D-Wiedergabe läuft"
              : "Planmerkmale werden kontrolliert sichtbar gemacht …",
          pipelineTerminalState === "failed" ? "error" : pipelineTerminalState === "completed" ? "ready" : "building",
        );
        return;
      }
      if (pipelineTerminalState === "failed") {
        details.textContent = `${overlays.size} sichtbare Planmarkierungen · diagnostisches Teilergebnis`;
        setStatus("Analyse abgebrochen · 2D-Teilergebnis bleibt sichtbar", "error");
        setPlaybackActive(false);
        return;
      }
      if (pipelineTerminalState === "completed" && !cameraFlight && !animations.length) {
        details.textContent = `${terminalSummary.normalized} normalisiert · ${terminalSummary.candidates} Kandidaten · ${overlays.size} Planmarkierungen`;
        setStatus("Analyse abgeschlossen · 2D-Prüfplan aufgebaut", "ready");
        setPlaybackActive(false);
      }
      return;
    }
    if (pendingCount > 0) {
      details.textContent = `${overlays.size} sichtbar · ${pendingCount} Klassifikationen in Review-Wiedergabe · ${objects.size} 3D-Objekte`;
      if (pipelineTerminalState === "completed") {
        setStatus("Analyse abgeschlossen · lokale Review-Wiedergabe läuft", "ready");
      } else if (pipelineTerminalState === "failed") {
        setStatus("Analyse beendet · vorhandene Review-Daten werden noch dargestellt", "error");
      } else {
        setStatus("Planmerkmale werden kontrolliert sichtbar gemacht …", "building");
      }
      return;
    }
    if (pipelineTerminalState === "completed" && playbackActive) {
      details.textContent = `${objects.size} 3D-Objekte · lokale Darstellung wird abgeschlossen`;
      setStatus("Analyse abgeschlossen · lokale 3D-Wiedergabe läuft", "ready");
      return;
    }
    if (pipelineTerminalState === "failed" && playbackActive) {
      setStatus("Analyse beendet · vorhandene Review-Daten werden noch dargestellt", "error");
      return;
    }
    if (pipelineTerminalState === "failed") {
      details.textContent = `${overlays.size} sichtbare Klassifikationen · ${objects.size} sichtbare 3D-Objekte · diagnostisches Teilergebnis`;
      setStatus("Analyse abgebrochen · Teilergebnis bleibt zur Diagnose sichtbar", "error");
      setPlaybackActive(false);
      return;
    }
    if (pipelineTerminalState === "completed" && !cameraFlight && !animations.length) {
      details.textContent = `${terminalSummary.normalized} normalisiert · ${terminalSummary.candidates} Kandidaten · ${objects.size} sichtbar`;
      setStatus(
        terminalSummary.candidates
          ? "Analyse abgeschlossen · 3D-Review aufgebaut"
          : "Analyse abgeschlossen · normalisierte CAD-Geometrie aufgebaut",
        "ready",
      );
      setPlaybackActive(false);
    }
  }

  function finishVisualTransitionsImmediately(): void {
    for (const animation of animations) {
      animation.node.scale.set(1, 1, 1);
      animation.materials.forEach((material) => {
        const target = finite(material.userData.previewTargetOpacity, 1, 0, 1);
        if ("opacity" in material) material.opacity = target;
      });
    }
    animations.length = 0;
  }

  function applySnapshotCamera(): void {
    if (!planFirstMode && objects.size > 0) {
      const campusPose = reviewCampusCameraPose();
      const pose = campusPose ?? modelCameraPose();
      camera.position.copy(pose.position);
      configureCameraRange(pose.distance);
      synchronizeOrbitControlsUp(MODEL_CAMERA_UP, pose.target, true);
      automaticCameraStage = campusPose ? "campus" : "model";
      return;
    }
    const target = sourcePageOrigin.clone();
    const pose = reconstructionPlanCameraPose(
      [target.x, target.y, target.z],
      planCameraDistance(),
    );
    camera.position.set(...pose.position);
    configureCameraRange(camera.position.distanceTo(target));
    synchronizeOrbitControlsUp(pose.up, target, true);
    automaticCameraStage = "plan";
  }

  function settleSnapshotPresentation(): void {
    if (presentationMode !== "snapshot") return;
    if (sourcePlanPresentationPending()) {
      updateCounts();
      updatePresentationCopy();
      return;
    }
    cameraFlightGeneration += 1;
    cameraFlight = null;
    window.clearTimeout(overlayRevealTimer);
    overlayRevealTimer = 0;
    overlayPlaybackHeld = false;
    while (pendingOverlayById.size > 0) revealOverlayBatch(true);
    finishVisualTransitionsImmediately();
    modelTransitionRequested = false;
    reviewCampusTransitionRequested = false;
    reviewCampusReady = false;
    setScanActivity(false);
    ensureSourcePlanPresented();
    applySnapshotCamera();
    updateCounts();
    updatePresentationCopy();
  }

  function settlePlanReviewForTerminalAcknowledgement(): void {
    if (!planFirstMode) return;
    if (sourcePlanPresentationPending()) {
      updateCounts();
      updatePresentationCopy();
      return;
    }
    window.clearTimeout(overlayRevealTimer);
    overlayRevealTimer = 0;
    overlayPlaybackHeld = false;
    if (pendingOverlayById.size > 0) revealOverlayBatch(true);
    finishVisualTransitionsImmediately();
    updateCounts();
    updatePresentationCopy();
  }

  function cancelPendingOverlays(): void {
    window.clearTimeout(overlayRevealTimer);
    overlayRevealTimer = 0;
    for (const entry of pendingOverlayById.values()) removePendingOverlay(entry);
    pendingOverlays.length = 0;
    pendingOverlayQueueDirty = false;
  }

  function cancelPresentation(): void {
    cameraFlightGeneration += 1;
    cameraFlight = null;
    cancelPendingOverlays();
    overlayPlaybackHeld = false;
    animations.length = 0;
    automaticCameraStage = null;
    modelTransitionRequested = false;
    reviewCampusTransitionRequested = false;
    reviewCampusReady = false;
    preserveExistingOverlayIds = false;
    setScanActivity(false);
    setPlaybackActive(false);
  }

  function stopPresentationAfterFailure(): void {
    cameraFlightGeneration += 1;
    cameraFlight = null;
    cancelPendingOverlays();
    overlayPlaybackHeld = false;
    // Objects which were already accepted into the scene remain useful as a
    // diagnostic partial result. Finish only their current visual transition;
    // never keep timers, held animations or an automatic camera flight alive
    // after the backend has declared the workflow terminally failed.
    finishVisualTransitionsImmediately();
    automaticCameraStage = null;
    modelTransitionRequested = false;
    reviewCampusTransitionRequested = false;
    reviewCampusReady = false;
    preserveExistingOverlayIds = false;
    setScanActivity(false);
    setPlaybackActive(false);
  }

  function clearScene(): void {
    const removedObjects = new Set(objects.values());
    for (let index = animations.length - 1; index >= 0; index -= 1) {
      if (removedObjects.has(animations[index].node)) animations.splice(index, 1);
    }
    for (const object of objects.values()) {
      previewRoot.remove(object);
      disposeObject(object);
    }
    objects.clear();
    kindCounts.clear();
    if (!planFirstMode) featureCounts.clear();
    campusBoundsRevision = 0;
    fittedCampusBoundsRevision = -1;
    renderedVertices = 0;
    rejectedObjects = 0;
    updateCounts();
  }

  function clearSourcePlane(): void {
    sourceLoadGeneration += 1;
    sourcePlanDigest = null;
    sourceLoadDigest = null;
    sourcePlanExpected = false;
    sourcePlanLoadPending = false;
    if (!sourcePlane) return;
    sourceRoot.remove(sourcePlane);
    const material = sourcePlane.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    sourcePlane.geometry.dispose();
    material.dispose();
    sourcePlane = null;
    sourceTextureWidth = 0;
    sourceTextureHeight = 0;
    sourceTextureDownscaledForDevice = false;
    updateCounts();
  }

  function ensureSourcePlanPresented(): void {
    sourceRoot.visible = true;
    if (!sourcePlane) return;
    sourcePlane.visible = true;
    const material = sourcePlane.material as THREE.MeshBasicMaterial;
    material.visible = true;
    material.opacity = 1;
  }

  function isSourcePlanActuallyVisible(): boolean {
    if (!sourceRoot.visible || !sourcePlane?.visible) return false;
    const materials = Array.isArray(sourcePlane.material)
      ? sourcePlane.material
      : [sourcePlane.material];
    return materials.length > 0 && materials.every(
      (material) => material.visible && material.opacity > 0,
    );
  }

  function sourcePlanPresentationPending(): boolean {
    return sourcePlanExpected
      && (sourcePlanLoadPending || !isSourcePlanActuallyVisible());
  }

  function removeOverlayAnimations(node: THREE.Object3D): void {
    for (let index = animations.length - 1; index >= 0; index -= 1) {
      if (animations[index].node === node) animations.splice(index, 1);
    }
  }

  function decrementOverlayKind(kind: string): void {
    const remaining = Math.max(0, (overlayCounts.get(kind) ?? 1) - 1);
    if (remaining) overlayCounts.set(kind, remaining);
    else overlayCounts.delete(kind);
  }

  function incrementPlanOverlayFeature(node: THREE.Object3D): void {
    if (!planFirstMode) return;
    const feature = node.userData.reviewFeatureCategory as ReviewFeatureCategory | undefined;
    if (!feature || !REVIEW_FEATURE_LABELS.some(([candidate]) => candidate === feature)) return;
    featureCounts.set(feature, (featureCounts.get(feature) ?? 0) + 1);
    node.userData.planFeatureCounted = true;
  }

  function decrementPlanOverlayFeature(node: THREE.Object3D): void {
    if (node.userData.planFeatureCounted !== true) return;
    const feature = node.userData.reviewFeatureCategory as ReviewFeatureCategory | undefined;
    node.userData.planFeatureCounted = false;
    if (!feature) return;
    const remaining = Math.max(0, (featureCounts.get(feature) ?? 1) - 1);
    if (remaining) featureCounts.set(feature, remaining);
    else featureCounts.delete(feature);
  }

  function removeVisibleOverlay(entry: PendingOverlayEntry): boolean {
    if (overlays.get(entry.id) !== entry) return false;
    overlays.delete(entry.id);
    removeOverlayAnimations(entry.node);
    overlayRoot.remove(entry.node);
    decrementOverlayKind(entry.kind);
    decrementPlanOverlayFeature(entry.node);
    if (entry.node.userData.hasDimensionAssociationLabel === true) {
      dimensionAssociationLabelCount = Math.max(0, dimensionAssociationLabelCount - 1);
    }
    disposeObject(entry.node);
    entry.cancelled = true;
    return true;
  }

  function removePendingOverlay(entry: PendingOverlayEntry): boolean {
    if (pendingOverlayById.get(entry.id) !== entry) return false;
    pendingOverlayById.delete(entry.id);
    pendingOverlayQueueDirty = true;
    entry.cancelled = true;
    decrementPlanOverlayFeature(entry.node);
    if (entry.node.userData.hasDimensionAssociationLabel === true) {
      dimensionAssociationLabelCount = Math.max(0, dimensionAssociationLabelCount - 1);
    }
    disposeObject(entry.node);
    return true;
  }

  function clearOverlays(): void {
    for (const overlay of overlays.values()) removeVisibleOverlay(overlay);
    overlayCounts.clear();
    rejectedOverlays = 0;
    overlayAdmissionOrder = 0;
    dimensionAssociationLabelCount = 0;
    omittedDimensionAssociationLabelCount = 0;
    updateCounts();
  }

  function clearReviewWorld(): void {
    deferredViewerAppliedAcknowledgement = null;
    cancelPresentation();
    clearScene();
    clearOverlays();
    clearSourcePlane();
    unavailableCapabilities.clear();
    sourcePageId = null;
    sourcePageWidth = DEFAULT_PLAN_REVIEW_SPAN_METRES;
    sourcePageHeight = DEFAULT_PLAN_REVIEW_SPAN_METRES;
    sourcePageOrigin.set(0, 0, 0);
    sourceRoot.position.set(0, 0, 0);
    overlayRoot.position.set(0, 0, 0);
    currentPhase = "waiting";
    pipelineTerminalState = "active";
    terminalSummary = { candidates: 0, normalized: 0 };
    presentationMode = "live";
  }

  function resetCamera(): void {
    if (planFirstMode) {
      cameraFlightGeneration += 1;
      cameraFlight = null;
      const target = sourcePageOrigin.clone();
      const pose = reconstructionPlanCameraPose(
        [target.x, target.y, target.z],
        planCameraDistance(),
      );
      camera.position.set(...pose.position);
      configureCameraRange(camera.position.distanceTo(target));
      synchronizeOrbitControlsUp(pose.up, target, true);
      automaticCameraStage = "plan";
      return;
    }
    if (
      objects.size > 0
      && (
        presentationMode === "snapshot"
        || pipelineTerminalState === "completed"
        || automaticCameraStage === "model"
        || automaticCameraStage === "campus"
      )
    ) {
      applySnapshotCamera();
      return;
    }
    synchronizeOrbitControlsUp(MODEL_CAMERA_UP, controls.target, false);
    const bounds = new THREE.Box3();
    bounds.expandByObject(sourceRoot, true);
    bounds.expandByObject(overlayRoot, true);
    bounds.expandByObject(previewRoot, true);
    if (bounds.isEmpty()) {
      controls.target.set(0, 0, 0);
      camera.position.set(15, 12, 18);
      camera.lookAt(controls.target);
      controls.update();
      return;
    }
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(1, size.length() * 0.5);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distance = Math.max(3, radius / Math.tan(verticalFov * 0.5) * 1.22);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(distance * 0.72, distance * 0.58, distance));
    camera.near = Math.max(0.02, distance / 2_000);
    camera.far = Math.max(1_000, distance * 40);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function configureCameraRange(distance: number): void {
    camera.near = Math.max(0.02, distance / 2_000);
    camera.far = Math.max(1_000, distance * 40);
    camera.updateProjectionMatrix();
  }

  function planCameraDistance(): number {
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.25, camera.aspect));
    const verticalDistance = sourcePageHeight / (2 * Math.tan(verticalFov / 2));
    const horizontalDistance = sourcePageWidth / (2 * Math.tan(horizontalFov / 2));
    return Math.max(3, verticalDistance, horizontalDistance) * 1.18;
  }

  function expandFinalPresentationBounds(bounds: THREE.Box3, object: THREE.Object3D): void {
    if (
      Math.abs(object.scale.x - 1) < 1e-9
      && Math.abs(object.scale.y - 1) < 1e-9
      && Math.abs(object.scale.z - 1) < 1e-9
    ) {
      bounds.expandByObject(object, true);
      return;
    }
    // Reconstruction objects own no semantic root scale; their temporary root
    // scale is solely the grow/fade animation. Fit against the final unit scale
    // so a panel or wall cannot leave the viewport as its animation completes.
    const animatedScale = object.scale.clone();
    object.scale.set(1, 1, 1);
    object.updateWorldMatrix(true, true);
    bounds.expandByObject(object, true);
    object.scale.copy(animatedScale);
    object.updateWorldMatrix(true, true);
  }

  function modelCameraPose(): { position: THREE.Vector3; target: THREE.Vector3; distance: number } {
    const bounds = new THREE.Box3();
    let primaryObjectCount = 0;
    for (const object of objects.values()) {
      if (isPrimaryReconstructionCameraKind(object.userData.previewKind)) {
        expandFinalPresentationBounds(bounds, object);
        primaryObjectCount += 1;
      }
    }
    // The A0 source sheet can be several times larger than the reconstructed
    // building. It remains visible and orbitable, but must not make the final
    // model look like a few pixels in the middle of the page. Only use it when
    // no primary reconstruction geometry exists at all.
    if (shouldUseSourcePlanForModelCamera(primaryObjectCount) && sourcePlane) {
      bounds.expandByObject(sourcePlane, true);
    }
    if (bounds.isEmpty()) bounds.expandByObject(previewRoot, true);
    const target = bounds.isEmpty()
      ? sourcePageOrigin.clone()
      : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty()
      ? new THREE.Vector3(sourcePageWidth, 3, sourcePageHeight)
      : bounds.getSize(new THREE.Vector3());
    const cameraDirection = new THREE.Vector3(...MODEL_CAMERA_DIRECTION);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distance = reconstructionModelCameraDistance(
      [size.x, size.y, size.z],
      verticalFov,
      camera.aspect,
    );
    return {
      target,
      position: target.clone().addScaledVector(cameraDirection, distance),
      distance,
    };
  }

  function reviewCampusCameraPose(): {
    position: THREE.Vector3;
    target: THREE.Vector3;
    distance: number;
  } | null {
    const bounds = new THREE.Box3();
    let reviewHelperCount = 0;
    for (const object of objects.values()) {
      const kind = object.userData.previewKind;
      if (!isReviewCampusCameraKind(kind)) continue;
      expandFinalPresentationBounds(bounds, object);
      if (!isPrimaryReconstructionCameraKind(kind)) reviewHelperCount += 1;
    }
    // A campus flight is useful only once a spatial panel, trace or guide is
    // actually present. The horizontal source sheet deliberately lives in a
    // different root and is never admitted into these bounds.
    if (!reviewHelperCount || bounds.isEmpty()) return null;
    const target = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const cameraDirection = new THREE.Vector3(...REVIEW_CAMPUS_CAMERA_DIRECTION);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distance = reconstructionReviewCampusCameraDistance(
      [size.x, size.y, size.z],
      verticalFov,
      camera.aspect,
    );
    return {
      target,
      position: target.clone().addScaledVector(cameraDirection, distance),
      distance,
    };
  }

  function startCameraFlight(
    stage: ReconstructionCameraStage,
    toPosition: THREE.Vector3,
    toTarget: THREE.Vector3,
    duration: number,
    delay: number,
    onComplete: () => void,
  ): void {
    cameraFlightGeneration += 1;
    const generation = cameraFlightGeneration;
    const toUpValue = stage === "plan" ? PLAN_CAMERA_UP : MODEL_CAMERA_UP;
    const toUp = new THREE.Vector3(...toUpValue);
    if (userInteracted) {
      cameraFlight = null;
      synchronizeOrbitControlsUp(toUpValue, controls.target, true);
      onComplete();
      return;
    }
    if (reducedMotion) {
      camera.position.copy(toPosition);
      controls.target.copy(toTarget);
      camera.up.copy(toUp);
      configureCameraRange(camera.position.distanceTo(controls.target));
      synchronizeOrbitControlsUp(toUpValue, toTarget, true);
      cameraFlight = null;
      onComplete();
      return;
    }
    cameraFlight = {
      stage,
      generation,
      startedAt: performance.now() + delay,
      duration,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      fromUp: camera.up.clone().normalize(),
      toPosition: toPosition.clone(),
      toTarget: toTarget.clone(),
      toUp,
      onComplete,
    };
    configureCameraRange(Math.max(
      camera.position.distanceTo(controls.target),
      toPosition.distanceTo(toTarget),
    ));
    setPlaybackActive(true);
  }

  function releaseHeldGeometryAnimations(): void {
    if (reducedMotion) {
      for (let index = animations.length - 1; index >= 0; index -= 1) {
        const animation = animations[index];
        if (!animation.held || animation.overlay) continue;
        animation.node.scale.set(1, 1, 1);
        animation.materials.forEach((material) => {
          const target = finite(material.userData.previewTargetOpacity, 1, 0, 1);
          if ("opacity" in material) material.opacity = target;
        });
        animations.splice(index, 1);
      }
      updatePresentationCopy();
      return;
    }
    const now = performance.now();
    let order = 0;
    for (const animation of animations) {
      if (!animation.held || animation.overlay) continue;
      animation.held = false;
      animation.startedAt = now + Math.min(order, 40) * 36;
      order += 1;
    }
    updatePresentationCopy();
  }

  function maybeStartModelCameraFlight(): void {
    if (
      presentationMode !== "live"
      || !modelTransitionRequested
      || destroyed
    ) return;
    if (automaticCameraStage === "model" || automaticCameraStage === "campus") {
      modelTransitionRequested = false;
      return;
    }
    if (!objects.size) return;
    if (overlayPlaybackHeld || pendingOverlayById.size > 0 || overlayRevealTimer || cameraFlight) return;
    modelTransitionRequested = false;
    automaticCameraStage = "model";
    const pose = modelCameraPose();
    startCameraFlight(
      "model",
      pose.position,
      pose.target,
      MODEL_CAMERA_FLIGHT_MS,
      0,
      () => {
        releaseHeldGeometryAnimations();
        maybeStartRequestedCameraFlight();
      },
    );
  }

  function maybeStartReviewCampusCameraFlight(): void {
    if (
      presentationMode !== "live"
      || !reviewCampusTransitionRequested
      || !reviewCampusReady
      || destroyed
    ) return;
    if (overlayPlaybackHeld || pendingOverlayById.size > 0 || overlayRevealTimer || cameraFlight) return;
    const pose = reviewCampusCameraPose();
    reviewCampusTransitionRequested = false;
    if (!pose) return;
    fittedCampusBoundsRevision = campusBoundsRevision;
    automaticCameraStage = "campus";
    startCameraFlight(
      "campus",
      pose.position,
      pose.target,
      REVIEW_CAMPUS_CAMERA_FLIGHT_MS,
      0,
      () => {
        releaseHeldGeometryAnimations();
        maybeStartRequestedCameraFlight();
      },
    );
  }

  function maybeStartRequestedCameraFlight(): void {
    if (presentationMode !== "live" || destroyed) return;
    if (planFirstMode) {
      modelTransitionRequested = false;
      reviewCampusTransitionRequested = false;
      reviewCampusReady = false;
      return;
    }
    if (
      modelTransitionRequested
      && automaticCameraStage !== "model"
      && automaticCameraStage !== "campus"
    ) {
      maybeStartModelCameraFlight();
      return;
    }
    if (automaticCameraStage === "model" || automaticCameraStage === "campus") {
      modelTransitionRequested = false;
    }
    maybeStartReviewCampusCameraFlight();
  }

  function scheduleOverlayReveal(delay = OVERLAY_REVEAL_INTERVAL_MS): void {
    if (destroyed || overlayPlaybackHeld || overlayRevealTimer || !pendingOverlayById.size) {
      if (!pendingOverlayById.size) maybeStartRequestedCameraFlight();
      return;
    }
    if (reducedMotion) {
      revealOverlayBatch(true);
      return;
    }
    overlayRevealTimer = window.setTimeout(() => {
      overlayRevealTimer = 0;
      revealOverlayBatch(false);
    }, delay);
  }

  function beginPlanCameraSequence(): void {
    if (presentationMode === "snapshot") return;
    if (destroyed) return;
    if (planFirstMode) {
      automaticCameraStage = "plan";
      overlayPlaybackHeld = false;
      applySnapshotCamera();
      scheduleOverlayReveal(180);
      return;
    }
    if (automaticCameraStage !== null) return;
    automaticCameraStage = "plan";
    overlayPlaybackHeld = true;
    const target = sourcePageOrigin.clone();
    const distance = planCameraDistance();
    const planPose = reconstructionPlanCameraPose(
      [target.x, target.y, target.z],
      distance,
    );
    synchronizeOrbitControlsUp(planPose.up, target, false);
    controls.target.copy(target);
    // Approach from the page's right edge. With -Z as screen-up this remains
    // orthogonal to the up vector throughout the flight and cannot acquire a
    // data-dependent roll before settling into the exact top view.
    camera.position.copy(target).add(new THREE.Vector3(distance * 0.62, distance * 0.3, 0));
    configureCameraRange(distance);
    controls.update();
    const overview = new THREE.Vector3(...planPose.position);
    startCameraFlight(
      "plan",
      overview,
      target,
      PLAN_CAMERA_FLIGHT_MS,
      PLAN_CAMERA_HOLD_MS,
      () => {
        overlayPlaybackHeld = false;
        scheduleOverlayReveal(180);
        maybeStartRequestedCameraFlight();
      },
    );
  }

  function cancelCameraFlightForInteraction(): void {
    const interruptedFlight = cameraFlight;
    if (!interruptedFlight) return;
    const interruptedStage = interruptedFlight.stage;
    cameraFlightGeneration += 1;
    cameraFlight = null;
    synchronizeOrbitControlsUp(interruptedFlight.toUp, controls.target, true);
    if (interruptedStage === "plan") {
      overlayPlaybackHeld = false;
      scheduleOverlayReveal(180);
      maybeStartRequestedCameraFlight();
    } else {
      releaseHeldGeometryAnimations();
      maybeStartRequestedCameraFlight();
    }
  }

  function finishCameraFlightImmediately(): void {
    const flight = cameraFlight;
    if (!flight) return;
    cameraFlightGeneration += 1;
    cameraFlight = null;
    camera.position.copy(flight.toPosition);
    controls.target.copy(flight.toTarget);
    camera.up.copy(flight.toUp);
    configureCameraRange(camera.position.distanceTo(controls.target));
    synchronizeOrbitControlsUp(flight.toUp, flight.toTarget, true);
    flight.onComplete();
  }

  function finishObjectAnimationsImmediately(): void {
    for (const animation of animations) {
      animation.node.scale.set(1, 1, 1);
      animation.materials.forEach((material) => {
        const target = finite(material.userData.previewTargetOpacity, 1, 0, 1);
        if ("opacity" in material) material.opacity = target;
      });
    }
    animations.length = 0;
  }

  function onReducedMotionChange(event: MediaQueryListEvent): void {
    reducedMotion = event.matches;
    if (!reducedMotion) {
      ensureScanIndicator();
      if (scanIndicator) scanIndicator.visible = true;
      return;
    }
    if (scanIndicator) scanIndicator.visible = false;
    finishCameraFlightImmediately();
    if (pendingOverlayById.size > 0) revealOverlayBatch(true);
    finishObjectAnimationsImmediately();
    maybeStartRequestedCameraFlight();
    updatePresentationCopy();
  }

  function applyReviewFrame(value: unknown, fallbackAspect = 1): void {
    const current = {
      spanX: sourcePageWidth,
      spanZ: sourcePageHeight,
      origin: [sourcePageOrigin.x, sourcePageOrigin.y, sourcePageOrigin.z] as const,
      sourcePageId,
    };
    const next = parsePlanReviewFrame(value, fallbackAspect);
    const frameChanged = planReviewFrameChanged(current, next);
    sourcePageWidth = next.spanX;
    sourcePageHeight = next.spanZ;
    sourcePageOrigin.set(next.origin[0], 0, next.origin[2]);
    sourcePageId = next.sourcePageId || sourcePageId;
    // Children stay in page-local coordinates. Moving both roots by the
    // compiler's sourceOriginShift keeps raster, overlays and 3D candidates
    // registered after scene centering.
    sourceRoot.position.copy(sourcePageOrigin);
    overlayRoot.position.copy(sourcePageOrigin);
    if (sourcePlane) {
      sourcePlane.geometry.dispose();
      sourcePlane.geometry = new THREE.PlaneGeometry(sourcePageWidth, sourcePageHeight);
    }
    if (scanIndicator) {
      scanIndicator.geometry.dispose();
      const thickness = THREE.MathUtils.clamp(sourcePageHeight * 0.004, 0.06, 0.18);
      scanIndicator.geometry = new THREE.PlaneGeometry(sourcePageWidth, thickness);
    }
    if (planFirstMode && frameChanged) {
      // A same-workflow replay can retain its source texture while the final
      // compiler frame introduces a large sourceOriginShift. Recenter without
      // a spatial flight so the plan cannot move outside the viewport.
      applySnapshotCamera();
    }
  }

  function applySourceCropToReviewPanel(object: THREE.Object3D): void {
    const crop = parseNormalizedSourceCrop(object.userData.reviewPanelSourceCrop);
    const sourceMaterial = sourcePlane?.material as THREE.MeshBasicMaterial | undefined;
    const sourceTexture = sourceMaterial?.map;
    if (!crop || !sourceTexture) return;
    const textureIdentity = sourcePlanDigest ?? `source-generation-${sourceLoadGeneration}`;
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!(child.material instanceof THREE.MeshStandardMaterial)) return;
      if (!child.geometry.getAttribute("uv")) return;
      if (child.material.userData.reviewPanelTextureIdentity === textureIdentity) return;
      if (child.material.map && !isSharedSourcePreviewTexture(child.material.map)) {
        child.material.map.dispose();
      }
      // Every panel has its own four-vertex geometry, so crop the UVs instead
      // of cloning the full high-resolution page texture. Texture clones would
      // allocate one ~96 MiB GPU upload per elevation/section panel.
      const uv = child.geometry.getAttribute("uv") as THREE.BufferAttribute;
      const cropKey = crop.join(":");
      if (child.geometry.userData.reviewPanelSourceCropKey !== cropKey) {
        for (let index = 0; index < uv.count; index += 1) {
          const originalU = uv.getX(index);
          const originalV = uv.getY(index);
          uv.setXY(
            index,
            crop[0] + (originalU * (crop[2] - crop[0])),
            (1 - crop[3]) + (originalV * (crop[3] - crop[1])),
          );
        }
        uv.needsUpdate = true;
        child.geometry.userData.reviewPanelSourceCropKey = cropKey;
      }
      child.material.map = sourceTexture;
      child.material.color.set(0xffffff);
      child.material.transparent = true;
      child.material.opacity = 0.58;
      child.material.depthWrite = false;
      child.material.userData.previewTargetOpacity = 0.58;
      child.material.userData.reviewPanelTextureIdentity = textureIdentity;
      child.material.needsUpdate = true;
    });
  }

  function refreshReviewPanelSourceCrops(): void {
    for (const object of objects.values()) applySourceCropToReviewPanel(object);
  }

  function startAnimation(
    object: THREE.Object3D,
    order: number,
    overlay = false,
    held = false,
  ): void {
    const materials = materialList(object);
    if (presentationMode === "snapshot" || (reducedMotion && !held)) {
      materials.forEach((material) => {
        const target = finite(material.userData.previewTargetOpacity, 1, 0, 1);
        if ("opacity" in material) material.opacity = target;
      });
      object.scale.set(1, 1, 1);
      return;
    }
    materials.forEach((material) => {
      const target = finite(material.userData.previewTargetOpacity, 1, 0, 1);
      material.userData.previewTargetOpacity = target;
      if ("opacity" in material) material.opacity = 0;
      material.transparent = true;
    });
    const kind = text(object.userData.previewKind, "geometry", 64).toLowerCase();
    const feature = object.userData.reviewFeatureCategory as ReviewFeatureCategory | undefined;
    const grow = !overlay
      && feature !== "room"
      && feature !== "stair"
      && !isRoomLikeReviewKind(kind)
      && !kind.includes("line")
      && !kind.includes("curve");
    if (overlay) object.scale.setScalar(0.92);
    else if (grow) object.scale.y = 0.015;
    animations.push({
      node: object,
      materials,
      startedAt: held ? 0 : performance.now() + Math.min(order, 40) * 28,
      duration: 460,
      grow,
      overlay,
      order,
      held,
    });
  }

  function addObjects(payload: Record<string, unknown>): void {
    const incoming = asArray(payload.objects).slice(0, MAX_OBJECTS);
    if (!shouldRenderSceneObjectInReviewMode(incoming[0], reviewMode)) {
      // Scene deltas are metric/spatial. In plan-first mode the equivalent
      // review.overlay evidence is the sole source of visible geometry.
      updateCounts();
      if (pipelineTerminalState === "active") {
        details.textContent = `${overlays.size + pendingOverlayById.size} Planmarkierungen · räumliche Vorschau ausgeblendet`;
      }
      updatePresentationCopy();
      return;
    }
    const payloadStage = reconstructionCameraStageForPhase(payload.reviewPhase);
    if (payloadStage === "model" || (!payloadStage && incoming.length > 0)) {
      modelTransitionRequested = true;
    }
    if (payloadStage === "campus" && incoming.length > 0) {
      reviewCampusTransitionRequested = true;
    }
    const modelCameraEstablished = automaticCameraStage === "model" || automaticCameraStage === "campus";
    const holdAnimations = presentationMode === "live"
      && (!modelCameraEstablished || cameraFlight?.stage === "model");
    let campusBoundsChanged = false;
    for (const raw of incoming) {
      const item = asRecord(raw);
      const id = text(item.id, "", 200);
      if (!id) {
        rejectedObjects += 1;
        continue;
      }
      const previous = objects.get(id);
      if (!previous && objects.size >= MAX_OBJECTS) {
        rejectedObjects += 1;
        continue;
      }
      const object = buildObject(item);
      if (!object) {
        rejectedObjects += 1;
        continue;
      }
      let vertexCount = 0;
      object.traverse((child) => {
        const candidate = child as THREE.Mesh | THREE.Line;
        if ("geometry" in candidate && candidate.geometry instanceof THREE.BufferGeometry) {
          vertexCount += candidate.geometry.getAttribute("position")?.count ?? 0;
        }
      });
      const previousVertexCount = previous
        ? nonNegativeInteger(previous.userData.previewVertexCount)
        : 0;
      if (renderedVertices - previousVertexCount + vertexCount > MAX_VERTICES) {
        disposeObject(object);
        rejectedObjects += 1;
        continue;
      }
      if (previous) {
        const animationIndex = animations.findIndex((entry) => entry.node === previous);
        if (animationIndex >= 0) animations.splice(animationIndex, 1);
        previewRoot.remove(previous);
        disposeObject(previous);
        const previousKind = text(previous.userData.previewKind, "geometry", 64);
        if (isReviewCampusCameraKind(previousKind)) campusBoundsChanged = true;
        const remaining = Math.max(0, (kindCounts.get(previousKind) ?? 1) - 1);
        if (remaining) kindCounts.set(previousKind, remaining);
        else kindCounts.delete(previousKind);
        const previousFeature = previous.userData.reviewFeatureCategory as ReviewFeatureCategory | undefined;
        if (previousFeature) {
          const featureRemaining = Math.max(0, (featureCounts.get(previousFeature) ?? 1) - 1);
          if (featureRemaining) featureCounts.set(previousFeature, featureRemaining);
          else featureCounts.delete(previousFeature);
        }
        renderedVertices = Math.max(0, renderedVertices - nonNegativeInteger(previous.userData.previewVertexCount));
      }
      object.userData.previewVertexCount = vertexCount;
      objects.set(id, object);
      previewRoot.add(object);
      applySourceCropToReviewPanel(object);
      renderedVertices += vertexCount;
      const kind = text(item.kind, "geometry", 64);
      if (isReviewCampusCameraKind(kind)) campusBoundsChanged = true;
      kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
      const feature = reviewFeatureCategory(item);
      featureCounts.set(feature, (featureCounts.get(feature) ?? 0) + 1);
      startAnimation(object, objects.size - 1, false, holdAnimations);
    }
    updateCounts();
    details.textContent = `${objects.size} Objekte · ${renderedVertices.toLocaleString("de-DE")} Eckpunkte · Review-only`;
    setStatus("Geometrie wird schrittweise in der Review-Welt aufgebaut …", "building");
    if (campusBoundsChanged) {
      campusBoundsRevision += 1;
      reviewCampusTransitionRequested = true;
    }
    maybeStartRequestedCameraFlight();
  }

  function loadSourcePlan(payload: Record<string, unknown>): void {
    sourcePlanExpected = payload.status === "available";
    if (payload.status !== "available") {
      sourcePlanLoadPending = false;
      overlayPlaybackHeld = false;
      setStatus("Für diese Quelle ist keine sichere Planvorschau verfügbar.", "building");
      scheduleOverlayReveal(180);
      return;
    }
    const dataUrl = payload.imageDataUrl;
    if (!isSafeSourcePreviewDataUrl(dataUrl)) {
      sourcePlanLoadPending = false;
      overlayPlaybackHeld = planFirstMode;
      setStatus("Die Planvorschau wurde aus Sicherheitsgründen nicht übernommen.", "error");
      if (!planFirstMode) scheduleOverlayReveal(180);
      return;
    }
    if (planFirstMode || automaticCameraStage === null) overlayPlaybackHeld = true;
    const digest = sourcePreviewDigest(payload);
    const framePayload = asRecord(payload.reviewFrame);
    const hasExplicitFrame = Number.isFinite(Number(framePayload.spanX))
      && Number.isFinite(Number(framePayload.spanZ));
    if (hasExplicitFrame) applyReviewFrame(framePayload);
    if (digest && (digest === sourcePlanDigest || digest === sourceLoadDigest)) {
      sourcePlanLoadPending = digest === sourceLoadDigest;
      beginPlanCameraSequence();
      return;
    }
    const generation = ++sourceLoadGeneration;
    sourceLoadDigest = digest;
    sourcePlanLoadPending = true;
    setStatus(
      planFirstMode
        ? "Planvorschau wird für die 2D-Prüfung vorbereitet …"
        : "Planvorschau wird in die Review-Welt gelegt …",
      "building",
    );
    new THREE.TextureLoader().load(
      dataUrl,
      (texture) => {
        if (destroyed || generation !== sourceLoadGeneration) {
          texture.dispose();
          return;
        }
        const image = texture.image as { width?: number; height?: number } | undefined;
        const width = nonNegativeInteger(image?.width);
        const height = nonNegativeInteger(image?.height);
        const textureDimensions = sourceTextureDimensions(
          width,
          height,
          Math.max(1, renderer.capabilities.maxTextureSize),
        );
        if (!textureDimensions) {
          texture.dispose();
          sourceLoadDigest = null;
          sourcePlanLoadPending = false;
          overlayPlaybackHeld = planFirstMode;
          setStatus("Die dekodierte Planvorschau überschreitet die Darstellungsgrenzen.", "error");
          if (!planFirstMode) scheduleOverlayReveal(180);
          return;
        }
        let presentationTexture: THREE.Texture = texture;
        if (textureDimensions.downscaledForDevice) {
          const fallback = document.createElement("canvas");
          fallback.width = textureDimensions.width;
          fallback.height = textureDimensions.height;
          const context = fallback.getContext("2d", { alpha: false });
          if (!context) {
            texture.dispose();
            sourceLoadDigest = null;
            sourcePlanLoadPending = false;
            overlayPlaybackHeld = planFirstMode;
            setStatus("Die Planvorschau konnte nicht gerätegerecht skaliert werden.", "error");
            if (!planFirstMode) scheduleOverlayReveal(180);
            return;
          }
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, fallback.width, fallback.height);
          context.drawImage(texture.image as CanvasImageSource, 0, 0, fallback.width, fallback.height);
          texture.dispose();
          presentationTexture = new THREE.CanvasTexture(fallback);
        }
        if (sourcePlane) {
          sourceRoot.remove(sourcePlane);
          const previousMaterial = sourcePlane.material as THREE.MeshBasicMaterial;
          previousMaterial.map?.dispose();
          sourcePlane.geometry.dispose();
          previousMaterial.dispose();
        }
        const aspect = THREE.MathUtils.clamp(width / height, 0.25, 4);
        if (!hasExplicitFrame) applyReviewFrame({}, aspect);
        presentationTexture.colorSpace = THREE.SRGBColorSpace;
        presentationTexture.wrapS = THREE.ClampToEdgeWrapping;
        presentationTexture.wrapT = THREE.ClampToEdgeWrapping;
        presentationTexture.magFilter = THREE.LinearFilter;
        // A 24 MP RGBA texture is already ~96 MB. Mipmaps would silently add
        // roughly one third again, so keep the memory contract exact and use
        // linear filtering plus anisotropy for the architectural linework.
        presentationTexture.minFilter = THREE.LinearFilter;
        presentationTexture.generateMipmaps = false;
        presentationTexture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
        presentationTexture.needsUpdate = true;
        markSharedSourcePreviewTexture(presentationTexture);
        const geometry = new THREE.PlaneGeometry(sourcePageWidth, sourcePageHeight);
        const material = new THREE.MeshBasicMaterial({
          map: presentationTexture,
          color: 0xffffff,
          transparent: false,
          opacity: 1,
          side: THREE.DoubleSide,
          depthWrite: true,
          toneMapped: false,
        });
        const plane = new THREE.Mesh(geometry, material);
        plane.name = "review_source_plan_page_0";
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = PLAN_REVIEW_PDF_PLANE_Y;
        plane.renderOrder = 0;
        plane.userData.reviewOnly = true;
        plane.userData.sourceTextureWidth = textureDimensions.width;
        plane.userData.sourceTextureHeight = textureDimensions.height;
        plane.userData.sourceTextureDownscaledForDevice = textureDimensions.downscaledForDevice;
        sourcePlane = plane;
        sourceTextureWidth = textureDimensions.width;
        sourceTextureHeight = textureDimensions.height;
        sourceTextureDownscaledForDevice = textureDimensions.downscaledForDevice;
        sourcePlanDigest = digest;
        sourceLoadDigest = null;
        sourcePlanLoadPending = false;
        sourceRoot.add(plane);
        ensureSourcePlanPresented();
        refreshReviewPanelSourceCrops();
        ensureScanIndicator();
        updateCounts();
        details.textContent = "Quellplan bleibt während der Review sichtbar · nicht im Modell gespeichert";
        setStatus("Planseite sichtbar · lokale Klassifikation läuft", "building");
        if (presentationMode === "snapshot") {
          settleSnapshotPresentation();
        } else {
          beginPlanCameraSequence();
        }
      },
      undefined,
      () => {
        if (generation !== sourceLoadGeneration) return;
        sourceLoadDigest = null;
        sourcePlanLoadPending = false;
        overlayPlaybackHeld = planFirstMode;
        setStatus("Die Planvorschau konnte im Editor nicht dekodiert werden.", "error");
        if (!planFirstMode) scheduleOverlayReveal(180);
        postToParent("viewer.error", { errorType: "SourcePreviewDecodeError" });
      },
    );
  }

  function nextPendingOverlay(remove: boolean): PendingOverlayEntry | null {
    while (pendingOverlays.length) {
      const entry = pendingOverlays[0];
      if (entry.cancelled || pendingOverlayById.get(entry.id) !== entry) {
        pendingOverlays.shift();
        continue;
      }
      if (!remove) return entry;
      pendingOverlays.shift();
      pendingOverlayById.delete(entry.id);
      return entry;
    }
    return null;
  }

  function revealOverlay(entry: PendingOverlayEntry): void {
    const previous = overlays.get(entry.id);
    if (previous) removeVisibleOverlay(previous);
    entry.cancelled = false;
    overlays.set(entry.id, entry);
    overlayRoot.add(entry.node);
    overlayCounts.set(entry.kind, (overlayCounts.get(entry.kind) ?? 0) + 1);
    // Legend counts describe drawables which are actually attached to the
    // scene. Counting admission here (rather than while still queued) avoids
    // claiming that a room/opening is visible while it is behind a long replay.
    incrementPlanOverlayFeature(entry.node);
    startAnimation(entry.node, 0, true, false);
  }

  function revealOverlayBatch(revealAll: boolean): void {
    if (!revealAll && overlayPlaybackHeld) return;
    const first = nextPendingOverlay(true);
    if (!first) {
      updatePresentationCopy();
      maybeStartRequestedCameraFlight();
      return;
    }
    const entries = [first];
    const batchSize = revealAll
      ? Number.POSITIVE_INFINITY
      : overlayRevealBatchSize(first.item, pendingOverlayById.size + 1);
    if (revealAll || first.denseText) {
      while (entries.length < batchSize) {
        const candidate = nextPendingOverlay(false);
        if (!candidate || (!revealAll && !candidate.denseText)) break;
        const removed = nextPendingOverlay(true);
        if (removed) entries.push(removed);
      }
    }
    entries.forEach(revealOverlay);
    updateCounts();
    updatePresentationCopy();
    if (pendingOverlayById.size > 0) scheduleOverlayReveal();
    else maybeStartRequestedCameraFlight();
  }

  function* overlayEvictionCandidates(): IterableIterator<ReviewOverlayEvictionCandidate> {
    for (const entry of overlays.values()) {
      if (!entry.cancelled) {
        yield {
          id: entry.id,
          priority: entry.priority,
          admissionOrder: entry.admissionOrder,
        };
      }
    }
    for (const entry of pendingOverlayById.values()) {
      if (!entry.cancelled) {
        yield {
          id: entry.id,
          priority: entry.priority,
          admissionOrder: entry.admissionOrder,
        };
      }
    }
  }

  function removeOverlayResidentById(id: string): boolean {
    let removed = false;
    const visible = overlays.get(id);
    if (visible) removed = removeVisibleOverlay(visible) || removed;
    const pending = pendingOverlayById.get(id);
    if (pending) removed = removePendingOverlay(pending) || removed;
    return removed;
  }

  function compactPendingOverlayQueue(): void {
    const activeEntries = pendingOverlays.filter((entry) => (
      !entry.cancelled && pendingOverlayById.get(entry.id) === entry
    ));
    pendingOverlays.splice(0, pendingOverlays.length, ...activeEntries);
    pendingOverlayQueueDirty = false;
  }

  function addOverlays(payload: Record<string, unknown>): void {
    const incoming = asArray(payload.items).slice(0, MAX_OVERLAYS);
    for (const raw of incoming) {
      const item = asRecord(raw);
      if (planFirstMode && !shouldRenderOverlayInPlanReview(item)) continue;
      const id = text(item.id, "", 200);
      const pageId = text(item.pageId, "", 96);
      if (!id || !shouldAcceptReviewOverlayPage(sourcePageId, pageId, reviewMode)) {
        rejectedOverlays += 1;
        continue;
      }
      const previousVisible = overlays.get(id);
      const previousPending = pendingOverlayById.get(id);
      if (!shouldAppendReviewOverlay(
        preserveExistingOverlayIds,
        Boolean(previousVisible),
        Boolean(previousPending),
      )) continue;
      const priority = reviewOverlayPriority(item);
      const newResident = !previousVisible && !previousPending;
      const evictionId = newResident && overlays.size + pendingOverlayById.size >= MAX_OVERLAYS
        ? selectReviewOverlayEvictionCandidate(priority, overlayEvictionCandidates())
        : null;
      if (newResident && overlays.size + pendingOverlayById.size >= MAX_OVERLAYS && !evictionId) {
        rejectedOverlays += 1;
        continue;
      }
      const hasDimensionAssociation = dimensionAssociationReviewCopy(item) !== null;
      const replacingAssociationLabel = previousVisible?.node.userData.hasDimensionAssociationLabel === true
        || previousPending?.node.userData.hasDimensionAssociationLabel === true;
      // Hundreds of dimension-score sprites can cover the actual room fills on
      // a dense source sheet. Plan review keeps the dimension geometry and its
      // score in the data/console, while visible labels are reserved for rooms.
      const includeDimensionAssociationLabel = !planFirstMode
        && hasDimensionAssociation
        && (
          dimensionAssociationLabelCount < MAX_DIMENSION_ASSOCIATION_LABELS
          || replacingAssociationLabel
        );
      const node = buildOverlay(
        item,
        sourcePageWidth,
        sourcePageHeight,
        includeDimensionAssociationLabel,
        planFirstMode,
      );
      if (!node) {
        rejectedOverlays += 1;
        continue;
      }
      if (previousVisible) removeVisibleOverlay(previousVisible);
      if (previousPending) removePendingOverlay(previousPending);
      if (evictionId) {
        if (!removeOverlayResidentById(evictionId)) {
          disposeObject(node);
          rejectedOverlays += 1;
          continue;
        }
        rejectedOverlays += 1;
      }
      overlayAdmissionOrder += 1;
      const entry: PendingOverlayEntry = {
        id,
        item,
        node,
        kind: text(node.userData.previewKind, "overlay", 64),
        denseText: isDenseTextOverlay(item),
        priority,
        admissionOrder: overlayAdmissionOrder,
        cancelled: false,
      };
      if (node.userData.hasDimensionAssociationLabel === true) {
        dimensionAssociationLabelCount += 1;
      } else if (hasDimensionAssociation) {
        omittedDimensionAssociationLabelCount += 1;
      }
      if (
        !sourcePlanPresentationPending()
        && (
          presentationMode === "snapshot"
          || shouldRevealPlanOverlayImmediately(item, reviewMode)
        )
      ) {
        revealOverlay(entry);
      } else {
        pendingOverlayById.set(id, entry);
        pendingOverlays.push(entry);
      }
    }
    if (pendingOverlayQueueDirty || pendingOverlays.length > MAX_OVERLAYS * 2) {
      compactPendingOverlayQueue();
    }
    updateCounts();
    updatePresentationCopy();
    if (presentationMode === "live") scheduleOverlayReveal(180);
  }

  function applyReviewPhase(payload: Record<string, unknown>): void {
    const phaseId = text(payload.phaseId, "analysis", 80);
    const label = text(payload.label, "Plan wird analysiert", 180);
    const state = text(payload.state, "running", 32).toLowerCase();
    currentPhase = phaseId;
    setScanActivity(presentationMode === "live" && state === "running", phaseId);
    if (!planFirstMode) {
      const cameraStage = reconstructionCameraStageForPhase(phaseId);
      if (cameraStage === "model") {
        modelTransitionRequested = true;
        maybeStartRequestedCameraFlight();
      } else if (cameraStage === "campus") {
        reviewCampusTransitionRequested = true;
        if (phaseId === "correspondence" && state === "running") reviewCampusReady = false;
        else if (isReviewCampusFitReady(phaseId, state)) reviewCampusReady = true;
        maybeStartRequestedCameraFlight();
      }
    }
    if (phaseId === "pages") {
      if (payload.reviewFrame) applyReviewFrame(payload.reviewFrame);
      const pages = asArray(payload.pages).map(asRecord);
      const visualizedIndex = nonNegativeInteger(payload.visualizedPageIndex);
      const activePage = pages.find((page) => nonNegativeInteger(page.index) === visualizedIndex);
      sourcePageId = text(activePage?.id, "", 96) || sourcePageId;
    }
    const suffix = state === "skipped"
      ? " · nicht verfügbar"
      : state === "completed"
        ? " · abgeschlossen"
        : state === "review_only"
          ? " · nur Kandidaten, Prüfung offen"
          : "";
    if (pendingOverlayById.size > 0 || overlayPlaybackHeld) {
      updatePresentationCopy();
      return;
    }
    setStatus(`${label}${suffix}`, "building");
    details.textContent = planFirstMode
      ? `${overlays.size} Planmarkierungen · ${unavailableCapabilities.size} offene Fähigkeiten · 2D-Prüfmodus`
      : `${overlays.size} Klassifikationen · ${objects.size} 3D-Objekte · ${unavailableCapabilities.size} offene Fähigkeiten`;
  }

  function applyAvailability(payload: Record<string, unknown>): void {
    const capability = text(payload.capability, "unknown", 96);
    const state = text(payload.status, "not_available", 32);
    const labels: Record<string, string> = {
      window_semantics: "Fenster",
      door_semantics: "Türen",
      dimension_lines: "Bemaßungslinien",
      storey_assignment: "Geschosszuordnung",
      view_extents: "Ansichtsflächen",
      height_registration: "Höhenregistrierung",
      cross_view_fusion: "Ansichtsfusion",
    };
    if (state === "not_available") unavailableCapabilities.set(capability, state);
    else unavailableCapabilities.delete(capability);
    const label = labels[capability] ?? capability;
    setStatus(
      state === "not_available"
        ? `${label}: im aktuellen Analyseergebnis nicht verfügbar`
        : `${label}: Kandidaten vorhanden, fachliche Prüfung erforderlich`,
      "building",
    );
    updateCounts();
  }

  function applyMessage(message: ReconstructionMessage): void {
    if (message.contract !== CONTRACT) return;
    const type = message.type;
    if (!isReconstructionMessageType(type)) return;
    const sequence = nonNegativeInteger(message.sequence);
    const incomingPresentationMode = reconstructionPresentationMode(message.presentationMode);
    const nextWorkflowId = text(message.workflowId, "", 96) || null;
    const workflowChanged = Boolean(nextWorkflowId && workflowId && workflowId !== nextWorkflowId);
    if (workflowChanged && type !== "scene.reset" && type !== "review.source") return;
    if (workflowChanged) {
      clearReviewWorld();
      workflowId = nextWorkflowId;
      lastSequence = 0;
    }
    if (!workflowId && nextWorkflowId) workflowId = nextWorkflowId;
    const lateSourceImage = type === "review.source" && nextWorkflowId === workflowId;
    if (!shouldApplySequencedMessage(type, sequence, lastSequence, lateSourceImage)) return;
    if (type === "scene.reset") {
      deferredViewerAppliedAcknowledgement = null;
      const payload = asRecord(message.payload);
      const sourcePreview = asRecord(payload.sourcePreview);
      const resetChangesWorkflow = workflowId !== nextWorkflowId;
      const preserveReviewPlayback = incomingPresentationMode !== "snapshot"
        && !resetChangesWorkflow
        && shouldPreserveReviewPlaybackOnSceneReset(
          workflowId,
          nextWorkflowId,
          sourcePlanDigest,
          sourceLoadDigest,
          sourcePreview,
        );
      if (resetChangesWorkflow) clearReviewWorld();
      else if (!preserveReviewPlayback) {
        cancelPresentation();
        sourceLoadGeneration += 1;
        sourceLoadDigest = null;
        sourcePlanExpected = false;
        sourcePlanLoadPending = false;
      }
      workflowId = nextWorkflowId;
      lastSequence = sequence;
      presentationMode = incomingPresentationMode;
      if (!preserveReviewPlayback) userInteracted = false;
      pipelineTerminalState = "active";
      terminalSummary = { candidates: 0, normalized: 0 };
      clearScene();
      if (preserveReviewPlayback) {
        preserveExistingOverlayIds = true;
        setScanActivity(false);
      } else {
        clearOverlays();
      }
      if (payload.schemaVersion && text(payload.schemaVersion, "", 96) !== SCENE_CONTRACT) {
        setStatus("Die empfangene Szenenversion wird nicht unterstützt.", "error");
        return;
      }
      if (payload.reviewFrame) applyReviewFrame(payload.reviewFrame);
      if (sourcePreview.status === "available") loadSourcePlan(sourcePreview);
      else if (!preserveReviewPlayback) resetCamera();
      const sourceFormat = text(payload.sourceFormat, "Quelle", 80);
      title.textContent = sourceFormat === "Quelle"
        ? "Warte auf CAD Bridge"
        : planFirstMode
          ? `${sourceFormat.toUpperCase()} → 2D-Prüfplan`
          : `${sourceFormat.toUpperCase()} → räumliche Review-Welt`;
      if (preserveReviewPlayback) {
        details.textContent = planFirstMode
          ? `${overlays.size} sichtbar · ${pendingOverlayById.size} Planmarkierungen in Review-Wiedergabe`
          : `${overlays.size} sichtbar · ${pendingOverlayById.size} Klassifikationen in Review-Wiedergabe · finale 3D-Struktur wird ergänzt`;
        setStatus(
          planFirstMode
            ? "Plananalyse bleibt sichtbar · 2D-Prüfdaten werden ergänzt"
            : "Plananalyse bleibt sichtbar · finale 3D-Struktur wird ergänzt",
          "building",
        );
      } else {
        details.textContent = "Nicht persistent · Kandidaten bleiben ungeprüft";
        setStatus(
          planFirstMode
            ? "2D-Prüfplan initialisiert · warte auf Planmerkmale"
            : "CAD-Bridge-Szene initialisiert · warte auf Geometrie",
          "building",
        );
      }
    } else if (type === "scene.delta") {
      if (incomingPresentationMode === "snapshot") presentationMode = "snapshot";
      lastSequence = sequence || lastSequence + 1;
      addObjects(asRecord(message.payload));
    } else if (type === "scene.completed") {
      if (incomingPresentationMode === "snapshot") presentationMode = "snapshot";
      lastSequence = sequence || lastSequence + 1;
      const summary = asRecord(asRecord(message.payload).summary);
      const candidates = nonNegativeInteger(summary.candidateObjectCount);
      const normalized = nonNegativeInteger(summary.normalizedObjectCount);
      pipelineTerminalState = "completed";
      terminalSummary = { candidates, normalized };
      setScanActivity(false);
      if (presentationMode === "snapshot") settleSnapshotPresentation();
      else if (planFirstMode) {
        modelTransitionRequested = false;
        reviewCampusTransitionRequested = false;
        reviewCampusReady = false;
        settlePlanReviewForTerminalAcknowledgement();
      } else {
        // Scene completion is the final safety net for older producers which
        // do not emit a terminal correspondence phase. At this point the
        // campus bounds are stable and may be fitted without the source page.
        reviewCampusReady = true;
        reviewCampusTransitionRequested = campusBoundsRevision > fittedCampusBoundsRevision;
        maybeStartRequestedCameraFlight();
        updatePresentationCopy();
      }
    } else if (type === "scene.failed") {
      deferredViewerAppliedAcknowledgement = null;
      lastSequence = sequence || lastSequence + 1;
      pipelineTerminalState = "failed";
      stopPresentationAfterFailure();
      updatePresentationCopy();
    } else if (type === "review.source") {
      if (incomingPresentationMode === "snapshot") presentationMode = "snapshot";
      lastSequence = Math.max(lastSequence, sequence);
      loadSourcePlan(asRecord(message.payload));
    } else if (type === "review.overlay") {
      if (incomingPresentationMode === "snapshot") presentationMode = "snapshot";
      lastSequence = sequence || lastSequence + 1;
      addOverlays(asRecord(message.payload));
    } else if (type === "review.phase") {
      if (incomingPresentationMode === "snapshot") presentationMode = "snapshot";
      lastSequence = sequence || lastSequence + 1;
      applyReviewPhase(asRecord(message.payload));
    } else if (type === "review.availability") {
      if (incomingPresentationMode === "snapshot") presentationMode = "snapshot";
      lastSequence = sequence || lastSequence + 1;
      applyAvailability(asRecord(message.payload));
    }
    // Phase changes and same-workflow scene refreshes may replace geometry,
    // but they must never hide or disable the verified source-plan layer.
    ensureSourcePlanPresented();
    acknowledgeViewerApplied(type);
  }

  function resize(): void {
    const bounds = root.getBoundingClientRect();
    three.resize({
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      updateCanvasStyle: false,
    });
  }

  function animate(now: number): void {
    if (destroyed) return;
    const activeFlight = cameraFlight;
    let cameraPoseAppliedByFlight = false;
    if (activeFlight && activeFlight.generation === cameraFlightGeneration) {
      cameraPoseAppliedByFlight = true;
      const rawProgress = (now - activeFlight.startedAt) / activeFlight.duration;
      const progress = THREE.MathUtils.clamp(rawProgress, 0, 1);
      const eased = easeReconstructionCamera(progress);
      camera.position.lerpVectors(activeFlight.fromPosition, activeFlight.toPosition, eased);
      controls.target.lerpVectors(activeFlight.fromTarget, activeFlight.toTarget, eased);
      const flightUp = reconstructionCameraFlightUp(
        [activeFlight.fromUp.x, activeFlight.fromUp.y, activeFlight.fromUp.z],
        activeFlight.stage,
        eased,
      );
      camera.up.set(...flightUp);
      camera.lookAt(controls.target);
      if (rawProgress >= 1) {
        camera.position.copy(activeFlight.toPosition);
        controls.target.copy(activeFlight.toTarget);
        camera.up.copy(activeFlight.toUp);
        camera.lookAt(activeFlight.toTarget);
        cameraFlight = null;
        synchronizeOrbitControlsUp(activeFlight.toUp, activeFlight.toTarget, false);
        activeFlight.onComplete();
      }
    }
    if (scanIndicator && scanPhaseId && !reducedMotion) {
      const scanProgress = ((now - scanStartedAt) % 2_400) / 2_400;
      scanIndicator.position.z = (scanProgress - 0.5) * sourcePageHeight;
      const material = scanIndicator.material as THREE.MeshBasicMaterial;
      material.opacity = 0.24 + (Math.sin(scanProgress * Math.PI) * 0.38);
    }
    let animationFinished = false;
    for (let index = animations.length - 1; index >= 0; index -= 1) {
      const animation = animations[index];
      if (animation.held) continue;
      const ratio = THREE.MathUtils.clamp((now - animation.startedAt) / animation.duration, 0, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      if (animation.grow) animation.node.scale.y = Math.max(0.015, eased);
      if (animation.overlay) animation.node.scale.setScalar(0.92 + (0.08 * eased));
      animation.materials.forEach((material) => {
        if (!("opacity" in material)) return;
        const target = finite(material.userData.previewTargetOpacity, 1, 0, 1);
        material.opacity = target * eased;
      });
      if (ratio >= 1) {
        animations.splice(index, 1);
        animationFinished = true;
      }
    }
    if (animationFinished && !animations.length) updatePresentationCopy();
    if (!cameraPoseAppliedByFlight) controls.update();
    three.render();
    frame = window.requestAnimationFrame(animate);
  }

  const handle: ReconstructionPreviewRuntimeHandle = {
    kind: "vectoplan-editor-reconstruction-preview-runtime.v1",
    applyMessage,
    resetCamera,
    getSnapshot: () => ({
      contract: CONTRACT,
      workflowId,
      lastSequence,
      objectCount: objects.size,
      overlayCount: overlays.size,
      pendingOverlayCount: pendingOverlayById.size,
      overlayResidentCount: overlays.size + pendingOverlayById.size,
      overlayCapacity: MAX_OVERLAYS,
      sourcePlanVisible: isSourcePlanActuallyVisible(),
      sourceTextureWidth,
      sourceTextureHeight,
      sourceTextureDownscaledForDevice,
      sourceTextureGpuBytes: sourceTextureWidth * sourceTextureHeight * 4,
      sourceTextureMipmaps: false,
      sourcePageId,
      currentPhase,
      automaticCameraStage,
      presentationMode,
      cameraFlightStage: cameraFlight?.stage ?? null,
      pipelineTerminalState,
      reducedMotion,
      scanPhaseId,
      unavailableCapabilities: [...unavailableCapabilities.keys()].sort(),
      renderedVertices,
      rejectedObjects,
      rejectedOverlays,
      dimensionAssociationLabelCount,
      dimensionAssociationLabelCapacity: MAX_DIMENSION_ASSOCIATION_LABELS,
      omittedDimensionAssociationLabelCount,
      reviewFeatureCounts: Object.fromEntries(
        [...featureCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
      ),
      visibleOverlayRender: overlayRenderDiagnostics(overlays.values()),
      pendingOverlayRender: overlayRenderDiagnostics(pendingOverlayById.values()),
      reviewFrame: {
        spanX: sourcePageWidth,
        spanZ: sourcePageHeight,
        origin: sourcePageOrigin.toArray(),
        sourceRootPosition: sourceRoot.position.toArray(),
        overlayRootPosition: overlayRoot.position.toArray(),
        pdfPlaneY: PLAN_REVIEW_PDF_PLANE_Y,
        overlayPlaneY: PLAN_REVIEW_OVERLAY_PLANE_Y,
        overlayDepthTest: PLAN_REVIEW_OVERLAY_DEPTH_TEST,
      },
      reviewOnly: true,
      persistenceEnabled: false,
      chunkServiceEnabled: false,
      camera: three.getSnapshot().camera,
    }),
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      window.cancelAnimationFrame(frame);
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      resizeObserver.disconnect();
      window.removeEventListener("message", onMessage);
      controls.dispose();
      clearReviewWorld();
      scene.remove(sourceRoot, overlayRoot, previewRoot, grid, ground, ambient, sun);
      grid.geometry.dispose();
      materialList(grid).forEach((material) => material.dispose());
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      three.dispose("reconstruction-preview-destroy");
    },
  };

  function onMessage(event: MessageEvent): void {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const value = asRecord(event.data);
    if (value.contract !== CONTRACT) return;
    try {
      handle.applyMessage(value as unknown as ReconstructionMessage);
    } catch (error) {
      setStatus("Darstellungsfehler in der Review-Welt.", "error");
      postToParent("viewer.error", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  resetButton?.addEventListener("click", () => {
    userInteracted = true;
    cancelCameraFlightForInteraction();
    userInteracted = false;
    resetCamera();
  });
  fullscreenButton?.addEventListener("click", () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen();
  });
  reducedMotionQuery.addEventListener("change", onReducedMotionChange);
  window.addEventListener("message", onMessage);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();
  resetCamera();
  setStatus("Editor bereit · warte auf Plan oder CAD-Bridge-Geometrie", "ready");
  frame = window.requestAnimationFrame(animate);
  window.__VECTOPLAN_RECONSTRUCTION_PREVIEW__ = handle;
  postToParent("viewer.ready", {
    ok: true,
    route: window.location.pathname,
    capabilities: {
      chunkFree: true,
      persistence: false,
      reviewOnly: true,
      geometry: ["wall", "box", "polygon", "mesh", "line"],
      progressiveReview: ["source-plan", "view-region", "ocr", "dimension", "phase", "availability"],
      maximumObjects: MAX_OBJECTS,
      maximumVertices: MAX_VERTICES,
      maximumOverlays: MAX_OVERLAYS,
      maximumSourcePixels: MAX_SOURCE_PIXELS,
      maximumSourceGpuBytes: MAX_SOURCE_PIXELS * 4,
      sourceTextureMipmaps: false,
    },
  });
  window.addEventListener("pagehide", () => handle.destroy(), { once: true });
  return handle;
}
