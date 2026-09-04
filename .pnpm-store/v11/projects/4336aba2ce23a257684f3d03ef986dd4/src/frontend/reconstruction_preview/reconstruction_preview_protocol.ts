export const RECONSTRUCTION_PREVIEW_CONTRACT = "cadbridge-reconstruction-preview.v1" as const;
export const RECONSTRUCTION_SCENE_CONTRACT = "cadbridge-reconstruction-scene/0.1" as const;
export const PROGRESSIVE_REVIEW_CONTRACT = "cadbridge-progressive-review/0.1" as const;
export const MAX_REVIEW_OVERLAYS = 2_500;
export const MAX_REVIEW_OVERLAY_POINTS = 512;
export const DEFAULT_RECONSTRUCTION_REVIEW_MODE = "plan2d" as const;

// In plan-first review the raster and every normalized review primitive occupy
// the exact same geometric sheet. Draw order plus depth-disabled overlay
// materials provide the visual stacking; artificial Y offsets would introduce
// perspective parallax and make otherwise correct PDF coordinates drift.
export const PLAN_REVIEW_PDF_PLANE_Y = 0.004;
export const PLAN_REVIEW_OVERLAY_PLANE_Y = PLAN_REVIEW_PDF_PLANE_Y;
export const PLAN_REVIEW_OVERLAY_DEPTH_TEST = false;
export const PLAN_REVIEW_MIN_STROKE_WIDTH = 0.08;
export const PLAN_REVIEW_MAX_STROKE_WIDTH = 0.22;

export type ReconstructionReviewMode = "plan2d" | "spatial";

export interface ViewerAppliedPresentationState {
  readonly pendingOverlayCount: unknown;
  readonly animationCount: unknown;
  readonly cameraFlightActive: unknown;
  readonly overlayPlaybackHeld: unknown;
  readonly sourcePlanExpected: unknown;
  readonly sourcePlanLoadPending: unknown;
  readonly sourcePlanVisible: unknown;
}

/**
 * A terminal scene acknowledgement means the local presentation is complete,
 * not merely that the message handler accepted scene.completed.
 */
export function shouldDeferViewerAppliedAcknowledgement(
  messageTypeValue: unknown,
  stateValue: unknown,
): boolean {
  if (String(messageTypeValue ?? "").trim().toLowerCase() !== "scene.completed") return false;
  if (stateValue === null || typeof stateValue !== "object" || Array.isArray(stateValue)) return true;
  const state = stateValue as Record<string, unknown>;
  const pendingOverlayCount = state.pendingOverlayCount;
  const animationCount = state.animationCount;
  if (
    typeof pendingOverlayCount !== "number"
    || !Number.isSafeInteger(pendingOverlayCount)
    || pendingOverlayCount < 0
    || typeof animationCount !== "number"
    || !Number.isSafeInteger(animationCount)
    || animationCount < 0
    || typeof state.cameraFlightActive !== "boolean"
    || typeof state.overlayPlaybackHeld !== "boolean"
    || typeof state.sourcePlanExpected !== "boolean"
    || typeof state.sourcePlanLoadPending !== "boolean"
    || typeof state.sourcePlanVisible !== "boolean"
  ) return true;
  return pendingOverlayCount > 0
    || animationCount > 0
    || state.cameraFlightActive === true
    || state.overlayPlaybackHeld === true
    || (
      state.sourcePlanExpected === true
      && (state.sourcePlanLoadPending === true || state.sourcePlanVisible !== true)
    );
}

/**
 * The reconstruction preview is deliberately plan-first. Spatial rendering is
 * an explicit opt-in so a missing/unknown DOM value can never promote review
 * candidates into a misleading 3D scene.
 */
export function reconstructionReviewMode(value: unknown): ReconstructionReviewMode {
  return String(value ?? "").trim().toLowerCase() === "spatial" ? "spatial" : "plan2d";
}

/** Scene deltas have metric/world coordinates and therefore stay out of 2D review. */
export function shouldRenderSceneObjectInReviewMode(
  _value: unknown,
  modeValue: unknown,
): boolean {
  return reconstructionReviewMode(modeValue) === "spatial";
}

/**
 * Keep source-sheet evidence, but exclude elevation/section helpers and every
 * cross-view relation from the plan-only layer. This function intentionally
 * fails closed for malformed values.
 */
export function shouldRenderOverlayInPlanReview(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const kind = String(record.kind ?? "").trim().toLowerCase().slice(0, 160);
  const classification = String(record.classification ?? "").trim().toLowerCase().slice(0, 160);
  const presentation = String(record.presentation ?? "").trim().toLowerCase().slice(0, 32);
  if (presentation === "panel") return false;
  if (
    kind === "elevation"
    || kind === "section"
    || kind.startsWith("view.")
    || kind.startsWith("cross_view.")
    || kind.startsWith("review_trace_")
    || kind === "correspondence_line"
  ) return false;
  if (
    classification.startsWith("cross_view_")
    || [
      "view_structural_line_candidate",
      "view_silhouette_candidate",
      "view_opening_candidate",
      "view_level_band_candidate",
    ].includes(classification)
  ) return false;
  return true;
}

export const REVIEW_OVERLAY_PRIORITY = Object.freeze({
  discardable: 0,
  standard: 1,
  semantic: 2,
  architectural: 3,
} as const);

export type ReviewOverlayPriority = typeof REVIEW_OVERLAY_PRIORITY[keyof typeof REVIEW_OVERLAY_PRIORITY];

export interface ReviewOverlayEvictionCandidate {
  readonly id: string;
  readonly priority: ReviewOverlayPriority;
  readonly admissionOrder: number;
}
// One source page is decoded at most once and shared by the horizontal plan
// and every vertical review panel. 24 MP is a deliberate 96 MB / 91.6 MiB
// RGBA GPU ceiling with mipmaps disabled; transport has its own byte bound.
export const MAX_SOURCE_PREVIEW_DATA_URL_CHARS = 11_200_000;
export const MAX_SOURCE_PREVIEW_PIXELS = 24_000_000;
export const MAX_SOURCE_PREVIEW_LONG_EDGE = 6_144;
export const DEFAULT_PLAN_REVIEW_SPAN_METRES = 36;
export const MAX_PLAN_REVIEW_SPAN_METRES = 10_000;
export const OVERLAY_REVEAL_INTERVAL_MS = 1_000;
export const PLAN_CAMERA_HOLD_MS = 420;
export const PLAN_CAMERA_FLIGHT_MS = 1_280;
export const MODEL_CAMERA_FLIGHT_MS = 1_050;
export const REVIEW_CAMPUS_CAMERA_FLIGHT_MS = 1_150;
export const REVIEW_CAMPUS_CAMERA_PADDING = 1.18;
// The source sheet lies in the XZ plane. A Y-up camera looking straight down
// its Y axis has no defined roll. Using -Z as screen-up makes the plan's top
// edge deterministic while keeping the camera exactly above its target.
export const PLAN_CAMERA_UP: readonly [number, number, number] = Object.freeze([0, 0, -1]);
export const MODEL_CAMERA_UP: readonly [number, number, number] = Object.freeze([0, 1, 0]);
const MODEL_CAMERA_DIRECTION_LENGTH = Math.hypot(0.72, 0.64, 1);
export const MODEL_CAMERA_DIRECTION: readonly [number, number, number] = Object.freeze([
  0.72 / MODEL_CAMERA_DIRECTION_LENGTH,
  0.64 / MODEL_CAMERA_DIRECTION_LENGTH,
  1 / MODEL_CAMERA_DIRECTION_LENGTH,
]);
// The review campus extends east/west while the source sheet stays west of it.
// Looking mostly along Z keeps that separation visible on screen instead of
// projecting the large source sheet directly behind the reconstructed model.
const REVIEW_CAMPUS_CAMERA_DIRECTION_LENGTH = Math.hypot(0.2, 0.64, 1);
export const REVIEW_CAMPUS_CAMERA_DIRECTION: readonly [number, number, number] = Object.freeze([
  0.2 / REVIEW_CAMPUS_CAMERA_DIRECTION_LENGTH,
  0.64 / REVIEW_CAMPUS_CAMERA_DIRECTION_LENGTH,
  1 / REVIEW_CAMPUS_CAMERA_DIRECTION_LENGTH,
]);

export type ReconstructionCameraStage = "plan" | "model" | "campus";

export interface ReconstructionPlanCameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up: readonly [number, number, number];
}

export function reconstructionCameraUpForStage(
  stage: ReconstructionCameraStage,
): readonly [number, number, number] {
  return stage === "plan" ? PLAN_CAMERA_UP : MODEL_CAMERA_UP;
}

export function reconstructionPlanCameraPose(
  targetValue: unknown,
  distanceValue: unknown,
): ReconstructionPlanCameraPose {
  const input = Array.isArray(targetValue) ? targetValue.slice(0, 3).map(Number) : [];
  const target: [number, number, number] = input.length === 3 && input.every(Number.isFinite)
    ? [
        Math.min(MAX_PLAN_REVIEW_SPAN_METRES, Math.max(-MAX_PLAN_REVIEW_SPAN_METRES, input[0])),
        Math.min(MAX_PLAN_REVIEW_SPAN_METRES, Math.max(-MAX_PLAN_REVIEW_SPAN_METRES, input[1])),
        Math.min(MAX_PLAN_REVIEW_SPAN_METRES, Math.max(-MAX_PLAN_REVIEW_SPAN_METRES, input[2])),
      ]
    : [0, 0, 0];
  const numericDistance = Number(distanceValue);
  const distance = Math.min(
    MAX_PLAN_REVIEW_SPAN_METRES * 2,
    Math.max(3, Number.isFinite(numericDistance) ? numericDistance : 3),
  );
  return {
    target,
    position: [target[0], target[1] + distance, target[2]],
    up: PLAN_CAMERA_UP,
  };
}

export function reconstructionCameraFlightUp(
  fromValue: unknown,
  stage: ReconstructionCameraStage,
  progressValue: unknown,
): readonly [number, number, number] {
  const target = reconstructionCameraUpForStage(stage);
  const input = Array.isArray(fromValue) ? fromValue.slice(0, 3).map(Number) : [];
  const inputLength = input.length === 3 && input.every(Number.isFinite)
    ? Math.hypot(input[0], input[1], input[2])
    : 0;
  const from = inputLength > 1e-9
    ? [input[0] / inputLength, input[1] / inputLength, input[2] / inputLength]
    : [...target];
  const numericProgress = Number(progressValue);
  const progress = Math.min(1, Math.max(0, Number.isFinite(numericProgress) ? numericProgress : 0));
  if (progress === 1) return target;
  const interpolated: [number, number, number] = [
    from[0] + ((target[0] - from[0]) * progress),
    from[1] + ((target[1] - from[1]) * progress),
    from[2] + ((target[2] - from[2]) * progress),
  ];
  const length = Math.hypot(...interpolated);
  if (length <= 1e-9) return target;
  return [interpolated[0] / length, interpolated[1] / length, interpolated[2] / length];
}

const MODEL_REVIEW_PHASES = new Set([
  "walls",
  "windows",
  "doors",
  "room_openings",
  "rooms",
  "roofs",
  "other_geometry",
]);

const REVIEW_CAMPUS_PHASES = new Set([
  "view_panels",
  "correspondence",
]);

export function reconstructionCameraStageForPhase(value: unknown): ReconstructionCameraStage | null {
  const phase = String(value ?? "").trim().toLowerCase();
  if (["pages", "regions", "observations"].includes(phase)) return "plan";
  if (REVIEW_CAMPUS_PHASES.has(phase)) return "campus";
  if (MODEL_REVIEW_PHASES.has(phase)) return "model";
  return null;
}

export function isReviewCampusFitReady(phaseValue: unknown, stateValue: unknown): boolean {
  const phase = String(phaseValue ?? "").trim().toLowerCase();
  const state = String(stateValue ?? "").trim().toLowerCase();
  return phase === "correspondence"
    && (state === "completed" || state === "skipped" || state === "review_only");
}

export function isDenseTextOverlay(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const classification = String(record.classification ?? "").trim().toLowerCase();
  const kind = String(record.kind ?? "").trim().toLowerCase();
  return classification.includes("text")
    || classification.includes("ocr")
    || kind.includes("text")
    || kind.startsWith("ocr.");
}

const SEMANTIC_REVIEW_OVERLAY_CLASSIFICATIONS = new Set([
  "ocr_text",
  "dimension_chain",
  "dimension_text_candidate",
  "dimension_zone",
  "scale_text_candidate",
  "view_region",
  "exterior_wall",
  "interior_wall",
  "ambiguous_wall",
  "view_opening_candidate",
  "view_level_band_candidate",
  "view_silhouette_candidate",
  "cross_view_correspondence",
]);

const DISCARDABLE_REVIEW_OVERLAY_CLASSIFICATIONS = new Set([
  "wall_vector_candidate",
  "native_text",
  "other_observation",
  "suppressed_polygon",
]);

/**
 * Rank review information by the value it adds to architectural inspection.
 *
 * The rank is intentionally based only on bounded protocol strings. It must
 * remain deterministic because it decides which GPU/scene resident is removed
 * when the hard overlay ceiling is reached. Raw PDF candidates may be
 * discarded; derived dimensions, OCR and cross-view semantics must survive
 * when they arrive after those candidates.
 */
export function reviewOverlayPriority(value: unknown): ReviewOverlayPriority {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return REVIEW_OVERLAY_PRIORITY.standard;
  }
  const record = value as Record<string, unknown>;
  const classification = String(record.classification ?? "").trim().toLowerCase();
  const kind = String(record.kind ?? "").trim().toLowerCase();

  // These are the actual plan objects the reviewer must be able to inspect.
  // Keep them above dense OCR/dimension evidence so a large sheet cannot fill
  // the bounded overlay cache before rooms and openings arrive.
  if (
    isRoomTopologyReviewOverlay(record)
    || isRoomOpeningReviewOverlay(record)
    || floorPlanOpeningReviewFeature(record) !== null
    || ["exterior_wall", "interior_wall", "ambiguous_wall"].includes(classification)
    || kind.startsWith("wall.") && kind.endsWith("_candidate")
  ) {
    return REVIEW_OVERLAY_PRIORITY.architectural;
  }

  if (
    SEMANTIC_REVIEW_OVERLAY_CLASSIFICATIONS.has(classification)
    || kind.startsWith("ocr.")
    || kind === "dimension.chain_candidate"
    || kind.startsWith("dimension.zone.")
    || kind.startsWith("dimension.text")
    || kind.startsWith("scale.")
    || kind.startsWith("cross_view.")
    || kind.includes(".window_outline.")
    || kind.includes(".door_outline.")
    || kind.includes(".level_band.")
    || kind.endsWith(".building_silhouette_candidate")
  ) {
    return REVIEW_OVERLAY_PRIORITY.semantic;
  }

  if (
    DISCARDABLE_REVIEW_OVERLAY_CLASSIFICATIONS.has(classification)
    || kind === "native.text"
    || kind === "other_observation"
    || kind.startsWith("pdf.vector.") && kind.endsWith(".wall_candidate")
  ) {
    return REVIEW_OVERLAY_PRIORITY.discardable;
  }
  return REVIEW_OVERLAY_PRIORITY.standard;
}

/**
 * Architectural evidence must not wait behind the deliberately paced OCR and
 * dimension replay. It is the actual plan-review result and is therefore made
 * resident as soon as it is validated for the active source page.
 */
export function shouldRevealPlanOverlayImmediately(
  value: unknown,
  modeValue: unknown,
): boolean {
  return reconstructionReviewMode(modeValue) === "plan2d"
    && reviewOverlayPriority(value) === REVIEW_OVERLAY_PRIORITY.architectural;
}

/** World-space width for plan markers; unlike WebGL lines this remains more
 * than one device pixel at a whole-sheet camera fit while staying bounded. */
export function planReviewStrokeWidth(spanXValue: unknown, spanZValue: unknown): number {
  const spanX = Number(spanXValue);
  const spanZ = Number(spanZValue);
  if (!Number.isFinite(spanX) || !Number.isFinite(spanZ) || spanX <= 0 || spanZ <= 0) {
    return PLAN_REVIEW_MIN_STROKE_WIDTH;
  }
  return Math.min(
    PLAN_REVIEW_MAX_STROKE_WIDTH,
    Math.max(PLAN_REVIEW_MIN_STROKE_WIDTH, Math.min(spanX, spanZ) * 0.003),
  );
}

/**
 * Select exactly one lower-value resident for replacement. Equal-priority
 * entries are retained, so a flood within one class cannot turn the bounded
 * cache into a newest-wins source of visual flicker.
 */
export function selectReviewOverlayEvictionCandidate(
  incomingPriority: ReviewOverlayPriority,
  candidates: Iterable<ReviewOverlayEvictionCandidate>,
): string | null {
  let selected: ReviewOverlayEvictionCandidate | null = null;
  for (const candidate of candidates) {
    if (!candidate.id || candidate.priority >= incomingPriority) continue;
    if (
      selected === null
      || candidate.priority < selected.priority
      || (
        candidate.priority === selected.priority
        && (
          candidate.admissionOrder < selected.admissionOrder
          || (
            candidate.admissionOrder === selected.admissionOrder
            && candidate.id < selected.id
          )
        )
      )
    ) {
      selected = candidate;
    }
  }
  return selected?.id ?? null;
}

export function overlayRevealBatchSize(value: unknown, pendingCount: number): number {
  if (!isDenseTextOverlay(value)) return 1;
  if (pendingCount >= 400) return 12;
  if (pendingCount >= 160) return 8;
  if (pendingCount >= 60) return 5;
  return 3;
}

export function easeReconstructionCamera(progress: number): number {
  const bounded = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return bounded * bounded * (3 - (2 * bounded));
}

function reconstructionCameraDistanceForDirection(
  sizeValue: readonly [number, number, number],
  verticalFovRadians: number,
  aspectValue: number,
  paddingValue: number,
  direction: readonly [number, number, number],
): number {
  const size = sizeValue.map((value) => (
    Number.isFinite(value) ? Math.min(MAX_PLAN_REVIEW_SPAN_METRES * 2, Math.max(0, value)) : 0
  ));
  const verticalFov = Math.min(Math.PI * 0.94, Math.max(Math.PI / 180, verticalFovRadians));
  const aspect = Math.min(4, Math.max(0.25, Number.isFinite(aspectValue) ? aspectValue : 1));
  const padding = Math.min(2, Math.max(1, Number.isFinite(paddingValue) ? paddingValue : 1.12));
  const rightLength = Math.hypot(direction[2], direction[0]);
  const right: readonly [number, number, number] = [
    direction[2] / rightLength,
    0,
    -direction[0] / rightLength,
  ];
  const viewUp: readonly [number, number, number] = [
    right[1] * -direction[2] - right[2] * -direction[1],
    right[2] * -direction[0] - right[0] * -direction[2],
    right[0] * -direction[1] - right[1] * -direction[0],
  ];
  const tangentVertical = Math.tan(verticalFov * 0.5);
  const tangentHorizontal = Math.tan(2 * Math.atan(tangentVertical * aspect) * 0.5);
  const dot = (left: readonly number[], rightValue: readonly number[]): number => (
    left[0] * rightValue[0] + left[1] * rightValue[1] + left[2] * rightValue[2]
  );
  let distance = 3;
  const halfSize = size.map((value) => value * 0.5);
  for (const x of [-halfSize[0], halfSize[0]]) {
    for (const y of [-halfSize[1], halfSize[1]]) {
      for (const z of [-halfSize[2], halfSize[2]]) {
        const offset = [x, y, z];
        const fitDistance = Math.max(
          Math.abs(dot(offset, right)) / tangentHorizontal,
          Math.abs(dot(offset, viewUp)) / tangentVertical,
        );
        distance = Math.max(distance, dot(offset, direction) + (fitDistance * padding));
      }
    }
  }
  return distance;
}

export function reconstructionModelCameraDistance(
  sizeValue: readonly [number, number, number],
  verticalFovRadians: number,
  aspectValue: number,
  paddingValue = 1.12,
): number {
  return reconstructionCameraDistanceForDirection(
    sizeValue,
    verticalFovRadians,
    aspectValue,
    paddingValue,
    MODEL_CAMERA_DIRECTION,
  );
}

export function reconstructionReviewCampusCameraDistance(
  sizeValue: readonly [number, number, number],
  verticalFovRadians: number,
  aspectValue: number,
): number {
  return reconstructionCameraDistanceForDirection(
    sizeValue,
    verticalFovRadians,
    aspectValue,
    REVIEW_CAMPUS_CAMERA_PADDING,
    REVIEW_CAMPUS_CAMERA_DIRECTION,
  );
}

export const RECONSTRUCTION_MESSAGE_TYPES = [
  "scene.reset",
  "scene.delta",
  "scene.completed",
  "scene.failed",
  "review.source",
  "review.overlay",
  "review.phase",
  "review.availability",
] as const;

export type ReconstructionMessageType = typeof RECONSTRUCTION_MESSAGE_TYPES[number];

/**
 * Presentation intent is deliberately separate from the persisted scene-event
 * type. A live stream is paced for people watching the conversion, while a
 * completed workflow restored after navigation must be materialised as an
 * atomic snapshot rather than replaying minutes of local animation.
 */
export type ReconstructionPresentationMode = "live" | "snapshot";

export function reconstructionPresentationMode(value: unknown): ReconstructionPresentationMode {
  return value === "snapshot" ? "snapshot" : "live";
}

export function shouldAnimateReconstructionPresentation(value: unknown): boolean {
  return reconstructionPresentationMode(value) === "live";
}

export function shouldUseSourcePlanForModelCamera(primaryObjectCountValue: unknown): boolean {
  const count = Number(primaryObjectCountValue);
  return !Number.isSafeInteger(count) || count <= 0;
}

const RECONSTRUCTION_MESSAGE_TYPE_SET = new Set<string>(RECONSTRUCTION_MESSAGE_TYPES);

export function isReconstructionMessageType(value: unknown): value is ReconstructionMessageType {
  return typeof value === "string" && RECONSTRUCTION_MESSAGE_TYPE_SET.has(value);
}

export function shouldApplySequencedMessage(
  type: ReconstructionMessageType,
  sequence: number,
  lastSequence: number,
  allowLateSource: boolean,
): boolean {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) return true;
  return (type === "review.source" && allowLateSource) || sequence > lastSequence;
}

export function isSafeSourcePreviewDataUrl(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= MAX_SOURCE_PREVIEW_DATA_URL_CHARS
    && value.startsWith("data:image/png;base64,");
}

export interface SourceTextureDimensions {
  readonly width: number;
  readonly height: number;
  readonly downscaledForDevice: boolean;
}

/**
 * Validate the decoded source before GPU upload and, only when required,
 * calculate a device-safe fallback size without changing its aspect ratio.
 */
export function sourceTextureDimensions(
  widthValue: unknown,
  heightValue: unknown,
  deviceMaximumLongEdgeValue: unknown,
): SourceTextureDimensions | null {
  const width = Number(widthValue);
  const height = Number(heightValue);
  const deviceMaximumLongEdge = Number(deviceMaximumLongEdgeValue);
  if (
    !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width <= 0
    || height <= 0
    || width * height > MAX_SOURCE_PREVIEW_PIXELS
    || Math.max(width, height) > MAX_SOURCE_PREVIEW_LONG_EDGE
    || !Number.isSafeInteger(deviceMaximumLongEdge)
    || deviceMaximumLongEdge <= 0
  ) {
    return null;
  }
  const usableLongEdge = Math.min(MAX_SOURCE_PREVIEW_LONG_EDGE, deviceMaximumLongEdge);
  const scale = Math.min(1, usableLongEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    downscaledForDevice: scale < 1,
  };
}

function normalizedSha256(value: unknown): string | null {
  const digest = String(value ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(digest) ? digest : null;
}

export function sourcePreviewDigest(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return normalizedSha256((value as Record<string, unknown>).sha256);
}

export function shouldPreserveReviewPlaybackOnSceneReset(
  currentWorkflowId: unknown,
  nextWorkflowId: unknown,
  currentSourceDigest: unknown,
  loadingSourceDigest: unknown,
  incomingSourcePreview: unknown,
): boolean {
  const currentId = String(currentWorkflowId ?? "").trim();
  const nextId = String(nextWorkflowId ?? "").trim();
  if (!currentId || !nextId || currentId !== nextId) return false;
  const incomingDigest = sourcePreviewDigest(incomingSourcePreview);
  // A final same-workflow snapshot may omit the already loaded image (for
  // example after a bounded parent fetch retry). Keeping the verified current
  // source avoids a white flash and does not cross a workflow trust boundary.
  if (!incomingDigest) {
    return normalizedSha256(currentSourceDigest) !== null
      || normalizedSha256(loadingSourceDigest) !== null;
  }
  return incomingDigest === normalizedSha256(currentSourceDigest)
    || incomingDigest === normalizedSha256(loadingSourceDigest);
}

export function shouldAppendReviewOverlay(
  preserveExistingIds: boolean,
  alreadyVisible: boolean,
  alreadyPending: boolean,
): boolean {
  return !preserveExistingIds || (!alreadyVisible && !alreadyPending);
}

export interface PlanReviewFrame {
  readonly spanX: number;
  readonly spanZ: number;
  readonly origin: readonly [number, number, number];
  readonly sourcePageId: string | null;
}

/**
 * Detect a material page-frame change before moving the source and overlay
 * roots. In plan review this is also the signal to rebuild the exact top-down
 * camera pose around the new source-page origin.
 */
export function planReviewFrameChanged(
  current: PlanReviewFrame,
  next: PlanReviewFrame,
): boolean {
  const epsilon = 1e-9;
  return Math.abs(current.spanX - next.spanX) > epsilon
    || Math.abs(current.spanZ - next.spanZ) > epsilon
    || current.origin.some((value, index) => Math.abs(value - next.origin[index]) > epsilon)
    || current.sourcePageId !== next.sourcePageId;
}

/**
 * A 2D overlay is meaningful only when it names the exact source sheet that
 * is currently projected. Before that sheet is known, fail closed so an early
 * or malformed multi-page candidate cannot remain on the wrong PDF page.
 */
export function shouldAcceptReviewOverlayPage(
  sourcePageIdValue: unknown,
  overlayPageIdValue: unknown,
  modeValue: unknown,
): boolean {
  const sourcePageId = String(sourcePageIdValue ?? "").trim().slice(0, 96);
  const overlayPageId = String(overlayPageIdValue ?? "").trim().slice(0, 96);
  if (reconstructionReviewMode(modeValue) === "plan2d") {
    return Boolean(sourcePageId && overlayPageId && sourcePageId === overlayPageId);
  }
  return !(sourcePageId && overlayPageId && sourcePageId !== overlayPageId);
}

export function parsePlanReviewFrame(value: unknown, fallbackAspect = 1): PlanReviewFrame {
  const record = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const bounded = (candidate: unknown, fallback: number, minimum: number, maximum: number): number => {
    const numeric = Number(candidate);
    return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : fallback;
  };
  const aspect = bounded(fallbackAspect, 1, 0.25, 4);
  const spanZ = bounded(
    record.spanZ,
    DEFAULT_PLAN_REVIEW_SPAN_METRES,
    0.25,
    MAX_PLAN_REVIEW_SPAN_METRES,
  );
  const spanX = bounded(
    record.spanX,
    DEFAULT_PLAN_REVIEW_SPAN_METRES * aspect,
    0.25,
    MAX_PLAN_REVIEW_SPAN_METRES,
  );
  const rawOrigin = Array.isArray(record.origin) ? record.origin : [];
  const origin: [number, number, number] = [
    bounded(rawOrigin[0], 0, -MAX_PLAN_REVIEW_SPAN_METRES, MAX_PLAN_REVIEW_SPAN_METRES),
    bounded(rawOrigin[1], 0, -MAX_PLAN_REVIEW_SPAN_METRES, MAX_PLAN_REVIEW_SPAN_METRES),
    bounded(rawOrigin[2], 0, -MAX_PLAN_REVIEW_SPAN_METRES, MAX_PLAN_REVIEW_SPAN_METRES),
  ];
  const pageId = typeof record.sourcePageId === "string"
    ? record.sourcePageId.trim().slice(0, 96)
    : "";
  return { spanX, spanZ, origin, sourcePageId: pageId || null };
}

export function parseNormalizedOverlayPoints(value: unknown): readonly (readonly [number, number])[] | null {
  return parseBoundedNormalizedPoints(value, 3);
}

export function parseNormalizedOverlayLinePoints(value: unknown): readonly (readonly [number, number])[] | null {
  return parseBoundedNormalizedPoints(value, 2);
}

/** Project one normalized PDF point into the editor's horizontal X/Z sheet. */
export function projectNormalizedReviewPoint(
  value: unknown,
  pageWidthValue: unknown,
  pageHeightValue: unknown,
): readonly [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  const pageWidth = Number(pageWidthValue);
  const pageHeight = Number(pageHeightValue);
  if (
    !Number.isFinite(x)
    || !Number.isFinite(y)
    || x < 0
    || x > 1
    || y < 0
    || y > 1
    || !Number.isFinite(pageWidth)
    || !Number.isFinite(pageHeight)
    || pageWidth <= 0
    || pageHeight <= 0
    || pageWidth > MAX_PLAN_REVIEW_SPAN_METRES
    || pageHeight > MAX_PLAN_REVIEW_SPAN_METRES
  ) return null;
  return [(x - 0.5) * pageWidth, (y - 0.5) * pageHeight];
}

export type FloorPlanOpeningReviewFeature = "door" | "window";

export function floorPlanOpeningReviewFeature(
  value: unknown,
): FloorPlanOpeningReviewFeature | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = String(record.kind ?? "").trim().toLowerCase();
  const classification = String(record.classification ?? "").trim().toLowerCase();
  if (kind === "floorplan.door_candidate" || classification === "floorplan_door") return "door";
  if (kind === "floorplan.window_candidate" || classification === "floorplan_window") return "window";
  return null;
}

/**
 * Floor-plan openings are either a centre segment or a small closed detector
 * outline. Both forms are normalized, bounded and non-degenerate.
 */
export function parseFloorPlanOpeningReviewPoints(
  value: unknown,
): readonly (readonly [number, number])[] | null {
  if (!floorPlanOpeningReviewFeature(value)) return null;
  const record = value as Record<string, unknown>;
  const points = parseBoundedNormalizedPoints(record.points, 2);
  if (!points) return null;
  if (points.length === 2) {
    return Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) > 1e-9
      ? points
      : null;
  }
  if (
    points.length < 4
    || points.length > 32
    || record.closed !== true
    || points[0][0] !== points[points.length - 1][0]
    || points[0][1] !== points[points.length - 1][1]
  ) return null;
  let twiceArea = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    twiceArea += (points[index][0] * points[index + 1][1])
      - (points[index + 1][0] * points[index][1]);
  }
  return Math.abs(twiceArea) > 1e-10 ? points : null;
}

export function isRoomTopologyReviewOverlay(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const kind = String(record.kind ?? "").trim().toLowerCase();
  const classification = String(record.classification ?? "").trim().toLowerCase();
  return kind === "floorplan.room_topology_candidate"
    || classification === "room_topology"
    || classification.startsWith("room/");
}

export function isRoomOpeningReviewOverlay(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const kind = String(record.kind ?? "").trim().toLowerCase();
  const classification = String(record.classification ?? "").trim().toLowerCase();
  const openingRole = String(record.openingRole ?? "").trim().toLowerCase();
  return kind === "floorplan.room_opening_candidate"
    || classification === "room_opening"
    || ["inter_room", "between_rooms", "wallless"].includes(openingRole);
}

export function parseRoomTopologyReviewPoints(
  value: unknown,
): readonly (readonly [number, number])[] | null {
  if (!isRoomTopologyReviewOverlay(value)) return null;
  const points = parseNormalizedOverlayPoints((value as Record<string, unknown>).points);
  if (!points) return null;
  const distinct = points.length > 3
    && points[0][0] === points[points.length - 1][0]
    && points[0][1] === points[points.length - 1][1]
    ? points.slice(0, -1)
    : points;
  if (distinct.length < 3) return null;
  if (new Set(distinct.map(([x, y]) => `${x}:${y}`)).size < 3) return null;
  let twiceArea = 0;
  for (let index = 0; index < distinct.length; index += 1) {
    const current = distinct[index];
    const next = distinct[(index + 1) % distinct.length];
    twiceArea += (current[0] * next[1]) - (next[0] * current[1]);
  }
  return Math.abs(twiceArea) > 1e-10 ? points : null;
}

export function parseRoomOpeningReviewPoints(
  value: unknown,
): readonly [readonly [number, number], readonly [number, number]] | null {
  if (!isRoomOpeningReviewOverlay(value)) return null;
  const points = parseNormalizedOverlayLinePoints((value as Record<string, unknown>).points);
  if (!points || points.length !== 2) return null;
  const [start, end] = points;
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) <= 1e-9) return null;
  return [start, end];
}

export type ReviewOverlayLineMode = "line" | "loop";

/** Identify bounded point-based review semantics without accepting arbitrary payload kinds. */
export function reviewOverlayLineMode(value: unknown): ReviewOverlayLineMode | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const classification = String(record.classification ?? "").trim().toLowerCase();
  const kind = String(record.kind ?? "").trim().toLowerCase();
  if (isRoomOpeningReviewOverlay(record)) return "line";
  if (floorPlanOpeningReviewFeature(record)) return record.closed === true ? "loop" : "line";
  const dimension = classification === "dimension_chain" || kind === "dimension.chain_candidate";
  const semanticKinds = [
    "view_outline_candidate",
    "view_opening_candidate",
    "view_level_band_candidate",
    "cross_view_correspondence",
    "exterior_wall",
    "interior_wall",
    "ambiguous_wall",
  ];
  const semantic = semanticKinds.find((candidate) => (
    classification === candidate || kind === candidate
  ));
  const wallEvidence = kind.startsWith("wall.") && kind.endsWith("_candidate");
  if (!dimension && !semantic && !wallEvidence) return null;
  if (record.closed === true) return "loop";
  if (record.closed === false) return "line";
  return semantic === "view_outline_candidate" || semantic === "view_opening_candidate"
    ? "loop"
    : "line";
}

export function parseNormalizedSourceCrop(value: unknown): readonly [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const crop = value.map(Number);
  if (!crop.every((coordinate) => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1)) {
    return null;
  }
  if (crop[2] <= crop[0] || crop[3] <= crop[1]) return null;
  return [crop[0], crop[1], crop[2], crop[3]];
}

function parseBoundedNormalizedPoints(
  value: unknown,
  minimumPoints: number,
): readonly (readonly [number, number])[] | null {
  if (!Array.isArray(value) || value.length < minimumPoints || value.length > MAX_REVIEW_OVERLAY_POINTS) {
    return null;
  }
  const result: [number, number][] = [];
  for (const candidate of value) {
    if (!Array.isArray(candidate) || candidate.length < 2) return null;
    const x = Number(candidate[0]);
    const y = Number(candidate[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
      return null;
    }
    result.push([x, y]);
  }
  return result;
}

export interface DimensionAssociationReviewCopy {
  readonly compactLabel: string;
  readonly tooltip: string;
  readonly status: string;
  readonly scorePercent: number | null;
  readonly calibrated: boolean;
}

/**
 * Turn review-only dimension association evidence into honest UI copy. The
 * backend posterior is intentionally called a score unless it is explicitly
 * marked calibrated; absence of that flag fails closed to "unkalibriert".
 */
export function dimensionAssociationReviewCopy(itemValue: unknown): DimensionAssociationReviewCopy | null {
  if (itemValue === null || typeof itemValue !== "object" || Array.isArray(itemValue)) return null;
  const item = itemValue as Record<string, unknown>;
  if (
    item.dimensionAssociation === null
    || typeof item.dimensionAssociation !== "object"
    || Array.isArray(item.dimensionAssociation)
  ) return null;
  const association = item.dimensionAssociation as Record<string, unknown>;
  const status = String(association.status ?? "not_evaluated").trim().toLowerCase().slice(0, 48);
  const rawScore = typeof association.bestPosterior === "number"
    || (typeof association.bestPosterior === "string" && association.bestPosterior.trim() !== "")
    ? Number(association.bestPosterior)
    : Number.NaN;
  const scorePercent = Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 1
    ? Math.round(rawScore * 100)
    : null;
  const calibrated = association.calibrated === true;
  const relation = status === "selected_for_review"
    ? "Maßbezug"
    : status === "ambiguous_for_review"
      ? "Maßbezug mehrdeutig"
      : status === "unmatched"
        ? "Maßbezug offen"
        : "Maßbezug ungeprüft";
  const scoreCopy = scorePercent === null
    ? ""
    : calibrated
      ? ` · ${scorePercent} %`
      : ` · Score ${scorePercent} %`;
  const calibrationCopy = calibrated ? "" : " · unkalibriert";
  const selectedChainRef = String(association.selectedChainRef ?? "").trim().slice(0, 128);
  const compactLabel = `${relation}${scoreCopy}${calibrationCopy}`;
  const referenceCopy = selectedChainRef ? ` · Kette ${selectedChainRef}` : "";
  return {
    compactLabel,
    tooltip: `${compactLabel}${referenceCopy} · Review-only`,
    status,
    scorePercent,
    calibrated,
  };
}

export type SemanticColorClass =
  | "wall"
  | "window"
  | "door"
  | "room"
  | "stair"
  | "wallless_opening"
  | "roof"
  | "other";

export type ReviewOpeningRole = "hosted" | "wallless";

export type ReviewFeatureCategory =
  | "wall"
  | "window"
  | "door"
  | "room"
  | "stair"
  | "wallless_opening"
  | "roof"
  | "other";

export const ROOM_REVIEW_COLORS: readonly number[] = Object.freeze([
  0x4fc3f7,
  0x81c784,
  0xffb74d,
  0xba68c8,
  0x4db6ac,
  0xff8a65,
  0x7986cb,
  0xdce775,
  0xf06292,
  0xa1887f,
  0x64b5f6,
  0xaed581,
]);

function normalizedReviewKind(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, 160);
}

export function isRoomLikeReviewKind(kindValue: unknown): boolean {
  const kind = normalizedReviewKind(kindValue);
  return kind.includes("room")
    || kind.includes("space")
    || kind.includes("stair")
    || kind.includes("trepp");
}

/**
 * Classify an opening from bounded scene metadata. Hosted windows and doors
 * stay red; only explicit wallless/inter-room evidence (or a generic passage
 * without a wall host) becomes the blue review class.
 */
export function reviewOpeningRole(itemValue: unknown): ReviewOpeningRole | null {
  if (itemValue === null || typeof itemValue !== "object" || Array.isArray(itemValue)) return null;
  const item = itemValue as Record<string, unknown>;
  const placement = item.wallPlacement !== null
    && typeof item.wallPlacement === "object"
    && !Array.isArray(item.wallPlacement)
    ? item.wallPlacement as Record<string, unknown>
    : {};
  const kind = normalizedReviewKind(item.kind);
  const evidence = [
    item.openingRole,
    item.openingType,
    item.semanticClass,
    item.classification,
    placement.status,
    placement.role,
  ].map(normalizedReviewKind).join(" ");
  const walllessEvidence = /(wallless|hostless|between[ _-]?rooms?|inter[ _-]?room|passage|durchgang)/;
  if (walllessEvidence.test(`${kind} ${evidence}`)) return "wallless";

  const parentWallRef = String(item.parentWallRef ?? placement.wallRef ?? "").trim();
  if (parentWallRef || /(on[ _-]?wall|hosted|wall[ _-]?candidate)/.test(evidence)) return "hosted";
  if (`${kind} ${evidence}`.includes("window") || `${kind} ${evidence}`.includes("door")) return "hosted";
  if (`${kind} ${evidence}`.includes("opening")) return "wallless";
  return null;
}

export function reviewFeatureCategory(itemValue: unknown): ReviewFeatureCategory {
  if (itemValue === null || typeof itemValue !== "object" || Array.isArray(itemValue)) return "other";
  const item = itemValue as Record<string, unknown>;
  const openingRole = reviewOpeningRole(item);
  if (openingRole === "wallless") return "wallless_opening";
  const explicitClass = semanticColorClass(item.semanticClass ?? item.roomClass ?? item.classification);
  if (explicitClass !== "other") return explicitClass;
  const colorClass = semanticColorClass(item.kind);
  if (colorClass === "window") return "window";
  if (colorClass === "door") return "door";
  return colorClass;
}

/** Stable per-room fill color independent of streaming order. */
export function roomReviewColor(identityValue: unknown): number {
  const identity = String(identityValue ?? "room").trim().toLowerCase().slice(0, 200) || "room";
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ROOM_REVIEW_COLORS[hash % ROOM_REVIEW_COLORS.length];
}

export function semanticColorClass(kindValue: unknown): SemanticColorClass {
  const kind = normalizedReviewKind(kindValue);
  if (
    kind.includes("wallless")
    || kind.includes("hostless")
    || kind.includes("between_room")
    || kind.includes("inter_room")
    || kind.includes("passage")
    || kind.includes("durchgang")
  ) return "wallless_opening";
  if (kind.includes("window")) return "window";
  if (kind.includes("door")) return "door";
  if (kind.includes("stair") || kind.includes("trepp")) return "stair";
  if (kind.includes("room") || kind.includes("space")) return "room";
  if (kind.includes("roof")) return "roof";
  if (kind.includes("wall")) return "wall";
  return "other";
}

export function isPrimaryReconstructionCameraKind(kindValue: unknown): boolean {
  const kind = String(kindValue ?? "").trim().toLowerCase();
  if (
    kind.startsWith("review_")
    || kind.startsWith("correspondence_")
    || kind.startsWith("guide_")
  ) return false;
  return semanticColorClass(kind) !== "other";
}

/**
 * The review-campus fit deliberately includes the reconstructed building and
 * the spatial review helpers around it, while excluding the horizontal source
 * sheet and unrelated scene decoration. This keeps the full panel/guide
 * corridor visible without allowing a large A0 plan to shrink the campus.
 */
export function isReviewCampusCameraKind(kindValue: unknown): boolean {
  const kind = String(kindValue ?? "").trim().toLowerCase();
  if (isPrimaryReconstructionCameraKind(kind)) return true;
  return kind.startsWith("review_panel_")
    || kind.startsWith("review_trace_")
    || kind.startsWith("correspondence_")
    || kind.startsWith("guide_")
    || kind.startsWith("cross_view_");
}

export const SEMANTIC_COLORS: Readonly<Record<SemanticColorClass, number>> = Object.freeze({
  wall: 0xf4a340,
  window: 0xe53935,
  door: 0xef6f61,
  room: 0x69d391,
  stair: 0xffb74d,
  wallless_opening: 0x2f80ed,
  roof: 0xb884f5,
  other: 0x92a0ad,
});
