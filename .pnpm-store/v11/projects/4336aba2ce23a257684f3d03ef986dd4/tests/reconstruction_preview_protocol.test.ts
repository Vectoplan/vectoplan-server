import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  DEFAULT_PLAN_REVIEW_SPAN_METRES,
  dimensionAssociationReviewCopy,
  easeReconstructionCamera,
  floorPlanOpeningReviewFeature,
  isReconstructionMessageType,
  isPrimaryReconstructionCameraKind,
  isRoomOpeningReviewOverlay,
  isRoomLikeReviewKind,
  isRoomTopologyReviewOverlay,
  isReviewCampusCameraKind,
  isReviewCampusFitReady,
  isSafeSourcePreviewDataUrl,
  MAX_REVIEW_OVERLAYS,
  MAX_SOURCE_PREVIEW_DATA_URL_CHARS,
  MAX_SOURCE_PREVIEW_PIXELS,
  MODEL_CAMERA_UP,
  MODEL_CAMERA_FLIGHT_MS,
  MODEL_CAMERA_DIRECTION,
  OVERLAY_REVEAL_INTERVAL_MS,
  overlayRevealBatchSize,
  PLAN_REVIEW_OVERLAY_DEPTH_TEST,
  PLAN_REVIEW_OVERLAY_PLANE_Y,
  PLAN_REVIEW_PDF_PLANE_Y,
  PLAN_REVIEW_MAX_STROKE_WIDTH,
  PLAN_REVIEW_MIN_STROKE_WIDTH,
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
  projectNormalizedReviewPoint,
  REVIEW_CAMPUS_CAMERA_FLIGHT_MS,
  REVIEW_CAMPUS_CAMERA_DIRECTION,
  REVIEW_OVERLAY_PRIORITY,
  RECONSTRUCTION_MESSAGE_TYPES,
  reconstructionCameraFlightUp,
  reconstructionCameraStageForPhase,
  reconstructionCameraUpForStage,
  reconstructionModelCameraDistance,
  reconstructionPresentationMode,
  reconstructionReviewMode,
  reconstructionPlanCameraPose,
  reconstructionReviewCampusCameraDistance,
  reviewOverlayPriority,
  reviewOverlayLineMode,
  reviewFeatureCategory,
  reviewOpeningRole,
  roomReviewColor,
  ROOM_REVIEW_COLORS,
  selectReviewOverlayEvictionCandidate,
  semanticColorClass,
  SEMANTIC_COLORS,
  shouldApplySequencedMessage,
  shouldAppendReviewOverlay,
  shouldAcceptReviewOverlayPage,
  shouldAnimateReconstructionPresentation,
  shouldDeferViewerAppliedAcknowledgement,
  shouldUseSourcePlanForModelCamera,
  shouldPreserveReviewPlaybackOnSceneReset,
  shouldRevealPlanOverlayImmediately,
  shouldRenderOverlayInPlanReview,
  shouldRenderSceneObjectInReviewMode,
  sourcePreviewDigest,
  sourceTextureDimensions,
  type ReviewOverlayEvictionCandidate,
} from "../src/frontend/reconstruction_preview/reconstruction_preview_protocol";
import {
  disposePreviewObject,
  isSharedSourcePreviewTexture,
  markSharedSourcePreviewTexture,
} from "../src/frontend/reconstruction_preview/reconstruction_preview_resources";

test("progressive reconstruction message protocol keeps legacy scene events", () => {
  assert.equal(isReconstructionMessageType("scene.reset"), true);
  assert.equal(isReconstructionMessageType("scene.delta"), true);
  assert.equal(isReconstructionMessageType("scene.completed"), true);
  assert.equal(isReconstructionMessageType("review.source"), true);
  assert.equal(isReconstructionMessageType("review.overlay"), true);
  assert.equal(isReconstructionMessageType("review.phase"), true);
  assert.equal(isReconstructionMessageType("review.availability"), true);
  assert.equal(isReconstructionMessageType("chunk.materialize"), false);
  assert.equal(new Set(RECONSTRUCTION_MESSAGE_TYPES).size, RECONSTRUCTION_MESSAGE_TYPES.length);
});

test("sequenced replay rejects stale resets but permits a deliberately late source image", () => {
  assert.equal(shouldApplySequencedMessage("scene.reset", 4, 8, false), false);
  assert.equal(shouldApplySequencedMessage("scene.delta", 8, 8, false), false);
  assert.equal(shouldApplySequencedMessage("scene.delta", 9, 8, false), true);
  assert.equal(shouldApplySequencedMessage("review.source", 2, 8, true), true);
  assert.equal(shouldApplySequencedMessage("review.source", 2, 8, false), false);
  assert.equal(shouldApplySequencedMessage("scene.reset", 0, 8, false), true);
});

test("suppressed polygon overlays accept only bounded normalized point loops", () => {
  assert.deepEqual(
    parseNormalizedOverlayPoints([[0.1, 0.2], [0.8, 0.2], [0.4, 0.9]]),
    [[0.1, 0.2], [0.8, 0.2], [0.4, 0.9]],
  );
  assert.equal(parseNormalizedOverlayPoints([[0, 0], [1, 0]]), null);
  assert.equal(parseNormalizedOverlayPoints([[0, 0], [1, 0], [2, 1]]), null);
  assert.equal(
    parseNormalizedOverlayPoints(Array.from({ length: 513 }, () => [0.5, 0.5])),
    null,
  );
});

test("dimension chains accept bounded normalized lines without weakening polygon validation", () => {
  assert.deepEqual(parseNormalizedOverlayLinePoints([[0.1, 0.2], [0.8, 0.2]]), [[0.1, 0.2], [0.8, 0.2]]);
  assert.equal(parseNormalizedOverlayPoints([[0.1, 0.2], [0.8, 0.2]]), null);
  assert.equal(parseNormalizedOverlayLinePoints([[0.1, 0.2], [1.1, 0.2]]), null);
  assert.equal(parseNormalizedOverlayLinePoints(Array.from({ length: 513 }, () => [0.5, 0.5])), null);
});

test("room topology overlays require bounded non-degenerate normalized polygons", () => {
  const item = {
    kind: "floorplan.room_topology_candidate",
    classification: "room/stair",
    points: [[0.1, 0.1], [0.6, 0.1], [0.6, 0.7], [0.1, 0.7], [0.1, 0.1]],
  };
  assert.equal(isRoomTopologyReviewOverlay(item), true);
  assert.deepEqual(parseRoomTopologyReviewPoints(item), item.points);
  assert.equal(isRoomOpeningReviewOverlay(item), false);
  assert.equal(reviewOverlayLineMode(item), null);
  assert.equal(
    parseRoomTopologyReviewPoints({ ...item, points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]] }),
    null,
  );
  assert.equal(
    parseRoomTopologyReviewPoints({ ...item, points: [[0.1, 0.1], [1.1, 0.1], [0.1, 0.7]] }),
    null,
  );
  assert.equal(
    parseRoomTopologyReviewPoints({ ...item, points: Array.from({ length: 513 }, () => [0.5, 0.5]) }),
    null,
  );
});

test("room opening overlays accept exactly one bounded non-degenerate segment", () => {
  const item = {
    kind: "floorplan.room_opening_candidate",
    classification: "room_opening",
    openingRole: "inter_room",
    points: [[0.3, 0.15], [0.3, 0.25]],
  };
  assert.equal(isRoomOpeningReviewOverlay(item), true);
  assert.deepEqual(parseRoomOpeningReviewPoints(item), item.points);
  assert.equal(reviewOverlayLineMode(item), "line");
  assert.equal(parseRoomOpeningReviewPoints({ ...item, points: [[0.3, 0.15], [0.3, 0.15]] }), null);
  assert.equal(
    parseRoomOpeningReviewPoints({ ...item, points: [[0.3, 0.15], [0.3, 0.25], [0.4, 0.25]] }),
    null,
  );
  assert.equal(parseRoomOpeningReviewPoints({ ...item, points: [[-0.1, 0.1], [0.3, 0.2]] }), null);
});

test("plan review is the fail-closed default and never promotes scene deltas", () => {
  assert.equal(reconstructionReviewMode(undefined), "plan2d");
  assert.equal(reconstructionReviewMode("unknown"), "plan2d");
  assert.equal(reconstructionReviewMode("spatial"), "spatial");
  assert.equal(
    shouldRenderSceneObjectInReviewMode({ kind: "wall" }, reconstructionReviewMode(undefined)),
    false,
  );
  assert.equal(
    shouldRenderSceneObjectInReviewMode({ kind: "review_panel_elevation" }, "plan2d"),
    false,
  );
  assert.equal(shouldRenderSceneObjectInReviewMode({ kind: "wall" }, "spatial"), true);
});

test("plan review keeps PDF evidence and filters view panels, traces, and correspondence", () => {
  const visible = [
    { kind: "floor_plan", classification: "view_region" },
    { kind: "floorplan.room_topology_candidate", classification: "room/kitchen" },
    { kind: "floorplan.room_opening_candidate", classification: "room_opening" },
    { kind: "floorplan.door_candidate", classification: "floorplan_door" },
    { kind: "pdf.vector.line.wall_candidate", classification: "interior_wall" },
    { kind: "dimension.chain_candidate", classification: "dimension_chain" },
  ];
  visible.forEach((item) => assert.equal(shouldRenderOverlayInPlanReview(item), true));

  const hidden = [
    { kind: "elevation", classification: "view_region", presentation: "panel" },
    { kind: "section", classification: "view_region" },
    { kind: "view.elevation.window_outline.eg_candidate", classification: "view_opening_candidate" },
    { kind: "review_trace_window" },
    { kind: "correspondence_line" },
    { kind: "cross_view.opening_alignment_candidate", classification: "cross_view_correspondence" },
  ];
  hidden.forEach((item) => assert.equal(shouldRenderOverlayInPlanReview(item), false));
  assert.equal(shouldRenderOverlayInPlanReview(null), false);
});

test("floor-plan openings use bounded deterministic PDF projection", () => {
  const segment = {
    kind: "floorplan.door_candidate",
    classification: "floorplan_door",
    points: [[0.25, 0.2], [0.5, 0.2]],
    closed: false,
  };
  const outline = {
    kind: "floorplan.window_candidate",
    classification: "floorplan_window",
    points: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.2], [0.1, 0.1]],
    closed: true,
  };
  assert.equal(floorPlanOpeningReviewFeature(segment), "door");
  assert.equal(floorPlanOpeningReviewFeature(outline), "window");
  assert.deepEqual(parseFloorPlanOpeningReviewPoints(segment), segment.points);
  assert.deepEqual(parseFloorPlanOpeningReviewPoints(outline), outline.points);
  assert.equal(
    parseFloorPlanOpeningReviewPoints({ ...segment, points: [[0.2, 0.2], [0.2, 0.2]] }),
    null,
  );
  assert.equal(
    parseFloorPlanOpeningReviewPoints({ ...outline, points: [[0.1, 0.1], [1.1, 0.1], [0.1, 0.1]] }),
    null,
  );
  assert.deepEqual(projectNormalizedReviewPoint([0, 0], 40, 20), [-20, -10]);
  assert.deepEqual(projectNormalizedReviewPoint([0.5, 0.5], 40, 20), [0, 0]);
  assert.deepEqual(projectNormalizedReviewPoint([1, 1], 40, 20), [20, 10]);
  assert.deepEqual(projectNormalizedReviewPoint([0.25, 0.2], 40, 20), [-10, -6]);
  assert.equal(projectNormalizedReviewPoint([1.01, 0.5], 40, 20), null);
  assert.equal(projectNormalizedReviewPoint([0.5, 0.5], 20_000, 20), null);
});

test("elevation and cross-view semantics render only as explicit bounded paths", () => {
  assert.equal(reviewOverlayLineMode({ classification: "view_outline_candidate" }), "loop");
  assert.equal(reviewOverlayLineMode({ kind: "view_opening_candidate" }), "loop");
  assert.equal(reviewOverlayLineMode({ classification: "view_level_band_candidate" }), "line");
  assert.equal(reviewOverlayLineMode({ kind: "cross_view_correspondence" }), "line");
  assert.equal(reviewOverlayLineMode({ classification: "exterior_wall" }), "line");
  assert.equal(reviewOverlayLineMode({ classification: "interior_wall" }), "line");
  assert.equal(reviewOverlayLineMode({ classification: "ambiguous_wall" }), "line");
  assert.equal(
    reviewOverlayLineMode({ kind: "wall.exterior_outline_consensus_candidate", closed: false }),
    "line",
  );
  assert.equal(reviewOverlayLineMode({ kind: "view_outline_candidate", closed: false }), "line");
  assert.equal(reviewOverlayLineMode({ kind: "cross_view_correspondence", closed: true }), "loop");
  assert.equal(reviewOverlayLineMode({ kind: "arbitrary_points" }), null);
});

test("review panel source crops require a finite non-empty normalized rectangle", () => {
  assert.deepEqual(parseNormalizedSourceCrop([0.1, 0.2, 0.8, 0.9]), [0.1, 0.2, 0.8, 0.9]);
  assert.equal(parseNormalizedSourceCrop([0.8, 0.2, 0.1, 0.9]), null);
  assert.equal(parseNormalizedSourceCrop([0.1, -0.1, 0.8, 0.9]), null);
  assert.equal(parseNormalizedSourceCrop([0.1, 0.2, Number.NaN, 0.9]), null);
  assert.equal(parseNormalizedSourceCrop([0.1, 0.2, 0.8]), null);
});

test("camera stages and overlay pacing are deterministic and bounded", () => {
  assert.equal(reconstructionCameraStageForPhase("pages"), "plan");
  assert.equal(reconstructionCameraStageForPhase("observations"), "plan");
  assert.equal(reconstructionCameraStageForPhase("walls"), "model");
  assert.equal(reconstructionCameraStageForPhase("doors"), "model");
  assert.equal(reconstructionCameraStageForPhase("room_openings"), "model");
  assert.equal(reconstructionCameraStageForPhase("view_panels"), "campus");
  assert.equal(reconstructionCameraStageForPhase("correspondence"), "campus");
  assert.equal(reconstructionCameraStageForPhase("fusion"), null);
  assert.equal(isReviewCampusFitReady("view_panels", "completed"), false);
  assert.equal(isReviewCampusFitReady("correspondence", "running"), false);
  assert.equal(isReviewCampusFitReady("correspondence", "completed"), true);
  assert.equal(isReviewCampusFitReady("CORRESPONDENCE", "SKIPPED"), true);
  assert.equal(isReviewCampusFitReady("correspondence", "review_only"), true);
  assert.equal(OVERLAY_REVEAL_INTERVAL_MS, 1_000);
  assert.equal(PLAN_CAMERA_FLIGHT_MS > MODEL_CAMERA_FLIGHT_MS, true);
  assert.equal(REVIEW_CAMPUS_CAMERA_FLIGHT_MS > MODEL_CAMERA_FLIGHT_MS, true);
  assert.equal(overlayRevealBatchSize({ kind: "floor_plan" }, 2_000), 1);
  assert.equal(overlayRevealBatchSize({ classification: "ocr_text" }, 59), 3);
  assert.equal(overlayRevealBatchSize({ classification: "ocr_text" }, 60), 5);
  assert.equal(overlayRevealBatchSize({ classification: "dimension_text_candidate" }, 400), 12);
  assert.equal(MAX_REVIEW_OVERLAYS, 2_500);
  assert.equal(easeReconstructionCamera(-1), 0);
  assert.equal(easeReconstructionCamera(0.5), 0.5);
  assert.equal(easeReconstructionCamera(2), 1);
  assert.equal(easeReconstructionCamera(Number.NaN), 0);
});

test("architectural review semantics outrank disposable PDF candidates", () => {
  const semanticItems = [
    { classification: "ocr_text" },
    { classification: "dimension_chain" },
    { classification: "dimension_text_candidate" },
    { classification: "dimension_zone" },
    { classification: "scale_text_candidate" },
    { classification: "view_region" },
    { classification: "view_opening_candidate" },
    { classification: "view_level_band_candidate" },
    { classification: "view_silhouette_candidate" },
    { classification: "cross_view_correspondence" },
    { kind: "dimension.zone.exterior_top_candidate" },
    { kind: "view.elevation.window_outline.eg_candidate" },
    { kind: "view.section.door_outline.kg_candidate" },
    { kind: "view.elevation.level_band.ridge_candidate" },
    { kind: "view.elevation.building_silhouette_candidate" },
    { kind: "cross_view.opening_alignment_candidate" },
  ];
  for (const item of semanticItems) {
    assert.equal(reviewOverlayPriority(item), REVIEW_OVERLAY_PRIORITY.semantic);
  }

  for (const item of [
    { classification: "room/stair", kind: "floorplan.room_topology_candidate" },
    { classification: "room_opening", kind: "floorplan.room_opening_candidate" },
    { classification: "floorplan_door", kind: "floorplan.door_candidate" },
    { classification: "floorplan_window", kind: "floorplan.window_candidate" },
    { classification: "exterior_wall", kind: "wall.exterior_candidate" },
    { classification: "interior_wall", kind: "wall.interior_candidate" },
    { classification: "ambiguous_wall", kind: "wall.ambiguous_candidate" },
  ]) {
    assert.equal(reviewOverlayPriority(item), REVIEW_OVERLAY_PRIORITY.architectural);
  }

  for (const item of [
    { classification: "wall_vector_candidate" },
    { classification: "native_text" },
    { classification: "other_observation" },
    { classification: "suppressed_polygon" },
    { kind: "native.text" },
    { kind: "pdf.vector.line.wall_candidate" },
    { kind: "pdf.vector.curve.wall_candidate" },
  ]) {
    assert.equal(reviewOverlayPriority(item), REVIEW_OVERLAY_PRIORITY.discardable);
  }

  assert.equal(reviewOverlayPriority({ classification: "view_structural_line_candidate" }), REVIEW_OVERLAY_PRIORITY.standard);
  assert.equal(reviewOverlayPriority({ kind: "unknown_candidate" }), REVIEW_OVERLAY_PRIORITY.standard);
  assert.equal(reviewOverlayPriority(null), REVIEW_OVERLAY_PRIORITY.standard);
});

test("plan architectural results bypass the paced evidence replay", () => {
  for (const item of [
    { classification: "room/kitchen", kind: "floorplan.room_topology_candidate" },
    { classification: "room_opening", kind: "floorplan.room_opening_candidate" },
    { classification: "floorplan_door", kind: "floorplan.door_candidate" },
    { classification: "floorplan_window", kind: "floorplan.window_candidate" },
    { classification: "interior_wall", kind: "wall.interior_candidate" },
  ]) {
    assert.equal(shouldRevealPlanOverlayImmediately(item, "plan2d"), true);
    assert.equal(shouldRevealPlanOverlayImmediately(item, "spatial"), false);
  }
  assert.equal(
    shouldRevealPlanOverlayImmediately({ classification: "ocr_text" }, "plan2d"),
    false,
  );
  assert.equal(
    shouldRevealPlanOverlayImmediately({ classification: "dimension_chain" }, "plan2d"),
    false,
  );
  assert.equal(shouldRevealPlanOverlayImmediately(null, "plan2d"), false);
});

test("normalized overlays are exactly coplanar with the rotated PDF sheet", () => {
  assert.equal(PLAN_REVIEW_OVERLAY_PLANE_Y, PLAN_REVIEW_PDF_PLANE_Y);
  assert.equal(PLAN_REVIEW_OVERLAY_DEPTH_TEST, false);
  const frame = parsePlanReviewFrame({
    spanX: 60.0000588,
    spanZ: 36,
    origin: [-53.3778934, 0, 0],
    sourcePageId: "page_one",
  });
  const normalizedPoint: readonly [number, number] = [0.06008089, 0.84296462];
  const projected = projectNormalizedReviewPoint(normalizedPoint, frame.spanX, frame.spanZ);
  assert.notEqual(projected, null);
  const [x, z] = projected!;

  // PlaneGeometry is authored in XY and rotated -90° about X. A PDF-down Y
  // therefore uses the negated local PlaneGeometry Y to land at positive Z.
  const sourcePoint = new THREE.Vector3(x, -z, 0)
    .applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    .add(new THREE.Vector3(frame.origin[0], PLAN_REVIEW_PDF_PLANE_Y, frame.origin[2]));
  const overlayPoint = new THREE.Vector3(
    frame.origin[0] + x,
    PLAN_REVIEW_OVERLAY_PLANE_Y,
    frame.origin[2] + z,
  );
  assert.equal(sourcePoint.distanceTo(overlayPoint) < 1e-10, true);

  const pose = reconstructionPlanCameraPose(frame.origin, 72);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.02, 2_880);
  camera.position.fromArray([...pose.position]);
  camera.up.fromArray([...pose.up]);
  camera.lookAt(...pose.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const sourceNdc = sourcePoint.clone().project(camera);
  const overlayNdc = overlayPoint.clone().project(camera);
  assert.equal(sourceNdc.distanceTo(overlayNdc) < 1e-10, true);
  assert.equal(Math.abs(overlayNdc.x) <= 1 && Math.abs(overlayNdc.y) <= 1, true);
});

test("whole-sheet opening bands have a deterministic bounded world width", () => {
  assert.equal(planReviewStrokeWidth(60.0000588, 36), 0.108);
  assert.equal(planReviewStrokeWidth(4, 3), PLAN_REVIEW_MIN_STROKE_WIDTH);
  assert.equal(planReviewStrokeWidth(1_000, 900), PLAN_REVIEW_MAX_STROKE_WIDTH);
  assert.equal(planReviewStrokeWidth(Number.NaN, 36), PLAN_REVIEW_MIN_STROKE_WIDTH);
  assert.equal(planReviewStrokeWidth(60, -1), PLAN_REVIEW_MIN_STROKE_WIDTH);
});

test("overlay eviction is stable, strictly lower-priority and oldest-first", () => {
  const candidates: ReviewOverlayEvictionCandidate[] = [
    { id: "standard-old", priority: REVIEW_OVERLAY_PRIORITY.standard, admissionOrder: 1 },
    { id: "raw-new", priority: REVIEW_OVERLAY_PRIORITY.discardable, admissionOrder: 9 },
    { id: "raw-old-z", priority: REVIEW_OVERLAY_PRIORITY.discardable, admissionOrder: 3 },
    { id: "raw-old-a", priority: REVIEW_OVERLAY_PRIORITY.discardable, admissionOrder: 3 },
  ];
  assert.equal(
    selectReviewOverlayEvictionCandidate(REVIEW_OVERLAY_PRIORITY.semantic, candidates),
    "raw-old-a",
  );
  assert.equal(
    selectReviewOverlayEvictionCandidate(REVIEW_OVERLAY_PRIORITY.standard, candidates),
    "raw-old-a",
  );
  assert.equal(
    selectReviewOverlayEvictionCandidate(REVIEW_OVERLAY_PRIORITY.discardable, candidates),
    null,
  );
  assert.equal(
    selectReviewOverlayEvictionCandidate(REVIEW_OVERLAY_PRIORITY.semantic, [
      { id: "semantic", priority: REVIEW_OVERLAY_PRIORITY.semantic, admissionOrder: 1 },
    ]),
    null,
  );
});

test("late semantic overlays displace raw residents without exceeding the hard ceiling", () => {
  const residents = new Map<string, ReviewOverlayEvictionCandidate>();
  for (let index = 0; index < MAX_REVIEW_OVERLAYS; index += 1) {
    const id = `raw-${String(index).padStart(4, "0")}`;
    residents.set(id, {
      id,
      priority: REVIEW_OVERLAY_PRIORITY.discardable,
      admissionOrder: index + 1,
    });
  }
  const semanticClassifications = [
    "ocr_text",
    "dimension_chain",
    "dimension_text_candidate",
    "dimension_zone",
    "scale_text_candidate",
    "view_region",
    "view_opening_candidate",
    "view_level_band_candidate",
    "view_silhouette_candidate",
    "cross_view_correspondence",
  ];
  semanticClassifications.forEach((classification, index) => {
    const priority = reviewOverlayPriority({ classification });
    const evictedId = selectReviewOverlayEvictionCandidate(priority, residents.values());
    assert.equal(evictedId, `raw-${String(index).padStart(4, "0")}`);
    assert.equal(residents.delete(evictedId ?? ""), true);
    const id = `semantic-${classification}`;
    residents.set(id, {
      id,
      priority,
      admissionOrder: MAX_REVIEW_OVERLAYS + index + 1,
    });
    assert.equal(residents.size, MAX_REVIEW_OVERLAYS);
  });
  assert.equal(
    [...residents.values()].filter((entry) => entry.priority === REVIEW_OVERLAY_PRIORITY.semantic).length,
    semanticClassifications.length,
  );
  assert.equal(residents.has("raw-0000"), false);
  assert.equal(residents.has(`raw-${String(semanticClassifications.length).padStart(4, "0")}`), true);
});

test("late architectural plan objects displace a saturated semantic cache", () => {
  const residents = new Map<string, ReviewOverlayEvictionCandidate>();
  for (let index = 0; index < MAX_REVIEW_OVERLAYS; index += 1) {
    const id = `semantic-${String(index).padStart(4, "0")}`;
    residents.set(id, {
      id,
      priority: REVIEW_OVERLAY_PRIORITY.semantic,
      admissionOrder: index + 1,
    });
  }
  const architecturalItems = [
    { classification: "room/kitchen", kind: "floorplan.room_topology_candidate" },
    { classification: "floorplan_door", kind: "floorplan.door_candidate" },
    { classification: "floorplan_window", kind: "floorplan.window_candidate" },
    { classification: "room_opening", kind: "floorplan.room_opening_candidate" },
    { classification: "exterior_wall", kind: "wall.exterior_candidate" },
  ];
  architecturalItems.forEach((item, index) => {
    const priority = reviewOverlayPriority(item);
    const evictedId = selectReviewOverlayEvictionCandidate(priority, residents.values());
    assert.equal(evictedId, `semantic-${String(index).padStart(4, "0")}`);
    assert.equal(residents.delete(evictedId ?? ""), true);
    residents.set(`architectural-${index}`, {
      id: `architectural-${index}`,
      priority,
      admissionOrder: MAX_REVIEW_OVERLAYS + index + 1,
    });
  });
  assert.equal(residents.size, MAX_REVIEW_OVERLAYS);
  assert.equal(
    [...residents.values()].filter((entry) => entry.priority === REVIEW_OVERLAY_PRIORITY.architectural).length,
    architecturalItems.length,
  );
});

test("plan camera pose is an exact, roll-stable orthogonal top view", () => {
  const pose = reconstructionPlanCameraPose([4.5, 0, -7.25], 42);
  assert.deepEqual(pose, {
    position: [4.5, 42, -7.25],
    target: [4.5, 0, -7.25],
    up: PLAN_CAMERA_UP,
  });
  assert.deepEqual(reconstructionCameraUpForStage("plan"), PLAN_CAMERA_UP);
  assert.deepEqual(reconstructionCameraUpForStage("model"), MODEL_CAMERA_UP);
  assert.deepEqual(reconstructionCameraUpForStage("campus"), MODEL_CAMERA_UP);

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1_000);
  camera.position.fromArray([...pose.position]);
  camera.up.fromArray([...pose.up]);
  camera.lookAt(new THREE.Vector3(...pose.target));
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  assert.equal(forward.distanceTo(new THREE.Vector3(0, -1, 0)) < 1e-12, true);
  assert.equal(screenUp.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-12, true);
  assert.equal(screenRight.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-12, true);
});

test("camera flight uses unit up vectors and restores model Y-up exactly", () => {
  const planMid = reconstructionCameraFlightUp(MODEL_CAMERA_UP, "plan", 0.5);
  const modelMid = reconstructionCameraFlightUp(PLAN_CAMERA_UP, "model", 0.5);
  const campusMid = reconstructionCameraFlightUp(PLAN_CAMERA_UP, "campus", 0.5);
  assert.equal(Math.abs(Math.hypot(...planMid) - 1) < 1e-12, true);
  assert.equal(Math.abs(Math.hypot(...modelMid) - 1) < 1e-12, true);
  assert.equal(Math.abs(Math.hypot(...campusMid) - 1) < 1e-12, true);
  assert.deepEqual(reconstructionCameraFlightUp(MODEL_CAMERA_UP, "plan", 1), PLAN_CAMERA_UP);
  assert.deepEqual(reconstructionCameraFlightUp(PLAN_CAMERA_UP, "model", 1), MODEL_CAMERA_UP);
  assert.deepEqual(reconstructionCameraFlightUp(PLAN_CAMERA_UP, "campus", 1), MODEL_CAMERA_UP);
  assert.deepEqual(reconstructionCameraFlightUp([0, 0, 0], "model", Number.NaN), MODEL_CAMERA_UP);
});

test("scene reset disposer releases geometry, material and generated label textures", () => {
  const geometry = new THREE.BufferGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const group = new THREE.Group();
  group.add(sprite, mesh);
  let geometryDisposed = false;
  let textureDisposed = false;
  let spriteMaterialDisposed = false;
  let meshMaterialDisposed = false;
  geometry.addEventListener("dispose", () => { geometryDisposed = true; });
  texture.addEventListener("dispose", () => { textureDisposed = true; });
  material.addEventListener("dispose", () => { spriteMaterialDisposed = true; });
  (mesh.material as THREE.Material).addEventListener("dispose", () => { meshMaterialDisposed = true; });

  disposePreviewObject(group);

  assert.equal(geometryDisposed, true);
  assert.equal(textureDisposed, true);
  assert.equal(spriteMaterialDisposed, true);
  assert.equal(meshMaterialDisposed, true);
});

test("borrowed high-resolution source textures survive review-panel disposal", () => {
  const shared = markSharedSourcePreviewTexture(new THREE.Texture());
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ map: shared }),
  );
  let disposed = false;
  shared.addEventListener("dispose", () => { disposed = true; });

  assert.equal(isSharedSourcePreviewTexture(shared), true);
  disposePreviewObject(panel);
  assert.equal(disposed, false, "a borrowing panel must not dispose the source-page texture");

  shared.dispose();
  assert.equal(disposed, true, "the source-plane owner can still release the texture");
});

test("plan review frame shares the 36 metre scene span and bounds its origin", () => {
  const fallback = parsePlanReviewFrame({}, 2);
  assert.equal(fallback.spanX, DEFAULT_PLAN_REVIEW_SPAN_METRES * 2);
  assert.equal(fallback.spanZ, DEFAULT_PLAN_REVIEW_SPAN_METRES);
  assert.deepEqual(fallback.origin, [0, 0, 0]);

  const shifted = parsePlanReviewFrame({
    spanX: 54,
    spanZ: 36,
    origin: [4.5, 0, -7.25],
    sourcePageId: "page_one",
  });
  assert.deepEqual(shifted, {
    spanX: 54,
    spanZ: 36,
    origin: [4.5, 0, -7.25],
    sourcePageId: "page_one",
  });

  const rejected = parsePlanReviewFrame({ spanX: Infinity, spanZ: -1, origin: [1e12, 0, 0] });
  assert.equal(rejected.spanX, DEFAULT_PLAN_REVIEW_SPAN_METRES);
  assert.equal(rejected.spanZ, DEFAULT_PLAN_REVIEW_SPAN_METRES);
  assert.deepEqual(rejected.origin, [0, 0, 0]);
});

test("a changed final review frame recenters the exact top-down plan pose", () => {
  const initial = parsePlanReviewFrame({
    spanX: 60,
    spanZ: 36,
    origin: [0, 0, 0],
    sourcePageId: "page_one",
  });
  const final = parsePlanReviewFrame({
    spanX: 60,
    spanZ: 36,
    origin: [-53.3778934, 0, 0],
    sourcePageId: "page_one",
  });
  assert.equal(planReviewFrameChanged(initial, initial), false);
  assert.equal(planReviewFrameChanged(initial, final), true);
  const pose = reconstructionPlanCameraPose(final.origin, 72);
  assert.deepEqual(pose.target, final.origin);
  assert.deepEqual(pose.position, [-53.3778934, 72, 0]);
  assert.deepEqual(pose.up, PLAN_CAMERA_UP);
});

test("plan overlays fail closed until they identify the active source page", () => {
  assert.equal(shouldAcceptReviewOverlayPage(null, "page_one", "plan2d"), false);
  assert.equal(shouldAcceptReviewOverlayPage("page_one", null, "plan2d"), false);
  assert.equal(shouldAcceptReviewOverlayPage("page_one", "page_two", "plan2d"), false);
  assert.equal(shouldAcceptReviewOverlayPage("page_one", "page_one", "plan2d"), true);
  assert.equal(shouldAcceptReviewOverlayPage("page_one", null, "spatial"), true);
  assert.equal(shouldAcceptReviewOverlayPage("page_one", "page_two", "spatial"), false);
});

test("source preview transport accepts only bounded PNG data URLs", () => {
  assert.equal(isSafeSourcePreviewDataUrl("data:image/png;base64,iVBORw0KGgo="), true);
  assert.equal(isSafeSourcePreviewDataUrl("data:image/jpeg;base64,AAAA"), false);
  assert.equal(isSafeSourcePreviewDataUrl("http://127.0.0.1:56000/source.png"), false);
  assert.equal(
    isSafeSourcePreviewDataUrl(`data:image/png;base64,${"A".repeat(MAX_SOURCE_PREVIEW_DATA_URL_CHARS)}`),
    false,
  );
});

test("source preview dimensions preserve 6K detail with a bounded device fallback", () => {
  assert.equal(MAX_SOURCE_PREVIEW_PIXELS * 4, 96_000_000);
  assert.deepEqual(sourceTextureDimensions(6144, 3686, 16384), {
    width: 6144,
    height: 3686,
    downscaledForDevice: false,
  });
  assert.deepEqual(sourceTextureDimensions(6144, 3686, 4096), {
    width: 4096,
    height: 2457,
    downscaledForDevice: true,
  });
  assert.equal(sourceTextureDimensions(6145, 3686, 16384), null);
  assert.equal(sourceTextureDimensions(6144, 4000, 16384), null);
  assert.equal(sourceTextureDimensions(0, 3686, 16384), null);
  assert.equal(sourceTextureDimensions(6144, 3686, 0), null);
});

test("source preview identity accepts only a complete SHA-256 digest", () => {
  const digest = "a".repeat(64);
  assert.equal(sourcePreviewDigest({ sha256: digest.toUpperCase() }), digest);
  assert.equal(sourcePreviewDigest({ sha256: "a".repeat(63) }), null);
  assert.equal(sourcePreviewDigest({ sha256: `${"a".repeat(63)}z` }), null);
  assert.equal(sourcePreviewDigest(null), null);
});

test("same-workflow final snapshots preserve review playback only for the exact source", () => {
  const digest = "b".repeat(64);
  const source = { sha256: digest.toUpperCase() };
  assert.equal(
    shouldPreserveReviewPlaybackOnSceneReset("workflow-1", "workflow-1", digest, null, source),
    true,
  );
  assert.equal(
    shouldPreserveReviewPlaybackOnSceneReset("workflow-1", "workflow-1", null, digest, source),
    true,
  );
  assert.equal(
    shouldPreserveReviewPlaybackOnSceneReset("workflow-1", "workflow-2", digest, null, source),
    false,
  );
  assert.equal(
    shouldPreserveReviewPlaybackOnSceneReset("workflow-1", "workflow-1", "a".repeat(64), null, source),
    false,
  );
  assert.equal(
    shouldPreserveReviewPlaybackOnSceneReset("workflow-1", "workflow-1", digest, null, {}),
    true,
  );
  assert.equal(
    shouldPreserveReviewPlaybackOnSceneReset("workflow-1", "workflow-1", null, null, {}),
    false,
  );
});

test("same-plan replay keeps revealed and queued ids while accepting final-only overlays", () => {
  assert.equal(shouldAppendReviewOverlay(true, true, false), false);
  assert.equal(shouldAppendReviewOverlay(true, false, true), false);
  assert.equal(shouldAppendReviewOverlay(true, false, false), true);
  assert.equal(shouldAppendReviewOverlay(false, true, false), true);
});

test("terminal restore presentation is explicit and fail-closed to live pacing", () => {
  assert.equal(reconstructionPresentationMode("snapshot"), "snapshot");
  assert.equal(reconstructionPresentationMode("live"), "live");
  assert.equal(reconstructionPresentationMode("instant"), "live");
  assert.equal(reconstructionPresentationMode({ mode: "snapshot" }), "live");
  assert.equal(shouldAnimateReconstructionPresentation("snapshot"), false);
  assert.equal(shouldAnimateReconstructionPresentation(undefined), true);
});

test("terminal viewer acknowledgement waits for local presentation settlement", () => {
  const settled = {
    pendingOverlayCount: 0,
    animationCount: 0,
    cameraFlightActive: false,
    overlayPlaybackHeld: false,
    sourcePlanExpected: false,
    sourcePlanLoadPending: false,
    sourcePlanVisible: false,
  };
  assert.equal(shouldDeferViewerAppliedAcknowledgement("review.overlay", {
    ...settled,
    pendingOverlayCount: 2_308,
  }), false);
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", settled), false);
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {
    ...settled,
    pendingOverlayCount: 2_308,
  }), true);
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {
    ...settled,
    animationCount: 1,
  }), true);
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {
    ...settled,
    cameraFlightActive: true,
  }), true);
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {
    ...settled,
    overlayPlaybackHeld: true,
  }), true);
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {}), true);
});

test("terminal viewer acknowledgement waits for a slow source-plan decode", () => {
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {
    pendingOverlayCount: 0,
    animationCount: 0,
    cameraFlightActive: false,
    overlayPlaybackHeld: true,
    sourcePlanExpected: true,
    sourcePlanLoadPending: true,
    sourcePlanVisible: false,
  }), true);
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {
    pendingOverlayCount: 0,
    animationCount: 0,
    cameraFlightActive: false,
    overlayPlaybackHeld: false,
    sourcePlanExpected: true,
    sourcePlanLoadPending: false,
    sourcePlanVisible: true,
  }), false);
});

test("terminal viewer acknowledgement stays blocked after an expected source-plan decode failure", () => {
  assert.equal(shouldDeferViewerAppliedAcknowledgement("scene.completed", {
    pendingOverlayCount: 0,
    animationCount: 0,
    cameraFlightActive: false,
    overlayPlaybackHeld: false,
    sourcePlanExpected: true,
    sourcePlanLoadPending: false,
    sourcePlanVisible: false,
  }), true);
});

test("model camera uses the source sheet only when primary geometry is absent", () => {
  assert.equal(shouldUseSourcePlanForModelCamera(0), true);
  assert.equal(shouldUseSourcePlanForModelCamera(1), false);
  assert.equal(shouldUseSourcePlanForModelCamera(190), false);
  assert.equal(shouldUseSourcePlanForModelCamera(-1), true);
  assert.equal(shouldUseSourcePlanForModelCamera("invalid"), true);
});

test("model camera fit includes building semantics and excludes remote review helpers", () => {
  for (const kind of ["wall", "IfcWindow", "door_candidate", "space", "roof_candidate"]) {
    assert.equal(isPrimaryReconstructionCameraKind(kind), true);
  }
  for (const kind of [
    "review_panel_section",
    "review_panel_elevation",
    "review_trace_door",
    "review_trace_window",
    "review_trace_level_band",
    "review_trace_view_outline",
    "correspondence_line",
    "guide_line",
  ]) {
    assert.equal(isPrimaryReconstructionCameraKind(kind), false);
  }
  const buildingFit = reconstructionModelCameraDistance([54, 6, 36], Math.PI / 4, 16 / 9);
  const narrowViewportFit = reconstructionModelCameraDistance([54, 6, 36], Math.PI / 4, 0.5);
  const helperPollutedFit = reconstructionModelCameraDistance([300, 80, 300], Math.PI / 4, 16 / 9);
  assert.equal(Math.abs(Math.hypot(...MODEL_CAMERA_DIRECTION) - 1) < 1e-12, true);
  assert.equal(Number.isFinite(buildingFit) && buildingFit > 3, true);
  assert.equal(narrowViewportFit > buildingFit, true);
  assert.equal(helperPollutedFit > buildingFit * 3, true);
});

test("review campus fit includes the model, panels and full guides but never the source sheet", () => {
  for (const kind of [
    "wall",
    "IfcWindow",
    "door_candidate",
    "space",
    "roof_candidate",
    "review_panel_section",
    "review_panel_elevation",
    "review_trace_door",
    "review_trace_window",
    "review_trace_level_band",
    "review_trace_view_outline",
    "correspondence_line",
    "guide_line",
    "cross_view_opening_alignment",
  ]) {
    assert.equal(isReviewCampusCameraKind(kind), true, kind);
  }
  for (const kind of [
    "review_source_plan_page_0",
    "source_plan",
    "grid",
    "ground",
    "other_geometry",
  ]) {
    assert.equal(isReviewCampusCameraKind(kind), false, kind);
  }

  const size: [number, number, number] = [190, 32, 150];
  const fov = Math.PI / 4;
  const aspect = 16 / 9;
  const distance = reconstructionReviewCampusCameraDistance(size, fov, aspect);
  assert.equal(Number.isFinite(distance) && distance > 3, true);

  const camera = new THREE.PerspectiveCamera(45, aspect, 0.01, distance * 10);
  assert.equal(Math.abs(Math.hypot(...REVIEW_CAMPUS_CAMERA_DIRECTION) - 1) < 1e-12, true);
  camera.position.fromArray(REVIEW_CAMPUS_CAMERA_DIRECTION.map((value) => value * distance));
  camera.up.fromArray([...MODEL_CAMERA_UP]);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  for (const x of [-size[0] / 2, size[0] / 2]) {
    for (const y of [-size[1] / 2, size[1] / 2]) {
      for (const z of [-size[2] / 2, size[2] / 2]) {
        const projected = new THREE.Vector3(x, y, z).project(camera);
        assert.equal(Math.abs(projected.x) <= 1, true, `campus x=${projected.x}`);
        assert.equal(Math.abs(projected.y) <= 1, true, `campus y=${projected.y}`);
        assert.equal(projected.z >= -1 && projected.z <= 1, true, `campus z=${projected.z}`);
      }
    }
  }
});

test("sequenced messages reject duplicates except a late source image", () => {
  assert.equal(shouldApplySequencedMessage("scene.reset", 4, 4, false), false);
  assert.equal(shouldApplySequencedMessage("scene.delta", 3, 4, false), false);
  assert.equal(shouldApplySequencedMessage("scene.delta", 5, 4, false), true);
  assert.equal(shouldApplySequencedMessage("review.source", 2, 4, true), true);
});

test("building classes have stable, distinct review colors", () => {
  assert.equal(semanticColorClass("wall"), "wall");
  assert.equal(semanticColorClass("IfcWindow"), "window");
  assert.equal(semanticColorClass("door_candidate"), "door");
  assert.equal(semanticColorClass("space"), "room");
  assert.equal(semanticColorClass("staircase_candidate"), "stair");
  assert.equal(semanticColorClass("wallless_opening"), "wallless_opening");
  assert.equal(semanticColorClass("roof"), "roof");
  assert.equal(semanticColorClass("polyline"), "other");
  assert.equal(new Set(Object.values(SEMANTIC_COLORS)).size, Object.keys(SEMANTIC_COLORS).length);
});

test("2D review recognizes rooms and staircases as room-like footprints", () => {
  for (const kind of ["room", "IfcSpace", "staircase_candidate", "Treppenhaus"]) {
    assert.equal(isRoomLikeReviewKind(kind), true, kind);
  }
  for (const kind of ["window", "door", "wall", "roof"]) {
    assert.equal(isRoomLikeReviewKind(kind), false, kind);
  }
  assert.equal(reviewFeatureCategory({ kind: "space" }), "room");
  assert.equal(reviewFeatureCategory({ kind: "Treppenhaus" }), "stair");
  assert.equal(reviewFeatureCategory({ kind: "room", semanticClass: "stair" }), "stair");
});

test("room review fills are deterministic and drawn from a bounded distinguishable palette", () => {
  const identities = ["Küche", "Wohnen", "Bad", "Treppe"];
  const first = identities.map(roomReviewColor);
  const second = identities.map(roomReviewColor);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length);
  assert.equal(first.every((color) => ROOM_REVIEW_COLORS.includes(color)), true);
  assert.equal(new Set(ROOM_REVIEW_COLORS).size, ROOM_REVIEW_COLORS.length);
});

test("2D review separates hosted red openings from explicit wallless passages", () => {
  assert.equal(reviewOpeningRole({ kind: "door", parentWallRef: "wall-4" }), "hosted");
  assert.equal(reviewOpeningRole({ kind: "window", wallPlacement: { status: "on_wall_candidate" } }), "hosted");
  assert.equal(
    reviewOpeningRole({ kind: "opening", wallPlacement: { status: "between_rooms_candidate" } }),
    "wallless",
  );
  assert.equal(reviewOpeningRole({ kind: "wallless_opening" }), "wallless");
  assert.equal(reviewOpeningRole({ kind: "geometry", semanticClass: "window" }), "hosted");
  assert.equal(reviewOpeningRole({ kind: "wall" }), null);
  assert.equal(reviewFeatureCategory({ kind: "window", parentWallRef: "wall-2" }), "window");
  assert.equal(
    reviewFeatureCategory({ kind: "opening", openingRole: "inter_room" }),
    "wallless_opening",
  );
});

test("dimension associations expose review scores without claiming calibrated certainty", () => {
  const selected = dimensionAssociationReviewCopy({
    kind: "dimension.text_candidate",
    dimensionAssociation: {
      status: "selected_for_review",
      selectedChainRef: "chain-17",
      bestPosterior: 0.934,
      nullPosterior: 0.021,
      reviewOnly: true,
    },
  });
  assert.deepEqual(selected, {
    compactLabel: "Maßbezug · Score 93 % · unkalibriert",
    tooltip: "Maßbezug · Score 93 % · unkalibriert · Kette chain-17 · Review-only",
    status: "selected_for_review",
    scorePercent: 93,
    calibrated: false,
  });
  assert.match(selected?.compactLabel ?? "", /Score/);
  assert.doesNotMatch(selected?.compactLabel ?? "", /sicher|Wahrscheinlichkeit/i);

  const ambiguous = dimensionAssociationReviewCopy({
    dimensionAssociation: { status: "ambiguous_for_review", bestPosterior: 0.51 },
  });
  assert.equal(ambiguous?.compactLabel, "Maßbezug mehrdeutig · Score 51 % · unkalibriert");
  assert.equal(
    dimensionAssociationReviewCopy({ dimensionAssociation: { status: "unmatched", bestPosterior: null } })
      ?.scorePercent,
    null,
  );
  assert.equal(dimensionAssociationReviewCopy({ kind: "dimension.text_candidate" }), null);
});
