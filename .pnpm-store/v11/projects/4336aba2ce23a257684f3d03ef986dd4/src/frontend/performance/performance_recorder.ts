export interface PerformancePhaseSample {
  readonly cameraPhysicsMs: number;
  readonly targetingMs: number;
  readonly environmentMs: number;
  readonly avatarsHudMs: number;
  readonly renderSubmitMs: number;
  readonly storeStreamMs: number;
  readonly cpuTotalMs: number;
}

export interface PerformanceFrameSample {
  readonly atMs: number;
  readonly frameMs: number;
  readonly phases: PerformancePhaseSample;
  readonly input: {
    readonly lookDeltaX: number;
    readonly lookDeltaY: number;
    readonly lookDeltaMagnitude: number;
    readonly pointerLocked: boolean;
    readonly movementActive: boolean;
    readonly sprinting: boolean;
    readonly inputReadMs: number;
    readonly physicsSimulationMs: number;
    readonly physicsStoreMs: number;
    readonly cameraFinalizeMs: number;
    readonly cameraStoreMs: number;
    readonly physicsSubSteps: number;
  };
  readonly camera: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
    readonly pitch: number;
  };
  readonly renderer: {
    readonly drawCalls: number;
    readonly triangles: number;
    readonly geometries: number;
    readonly textures: number;
    readonly pixelRatio: number;
    readonly drawingBufferWidth: number;
    readonly drawingBufferHeight: number;
  };
  readonly world: {
    readonly loadedChunks: number;
    readonly renderedChunks: number;
    readonly meshes: number;
    readonly pendingChunkMeshes: number;
    readonly shadowCasters: number;
  };
  readonly edits: {
    readonly placeIntents: number;
    readonly removeIntents: number;
    readonly pendingCommands: number;
    readonly pendingOverlays: number;
    readonly pendingMeshBatchChunks: number;
  };
  readonly shadows: {
    readonly environmentRefreshCount: number;
    readonly environmentRefreshReason: string;
    readonly terrainScanCount: number;
    readonly terrainChangeCount: number;
  };
}

export interface PerformanceActionSample {
  readonly atMs: number;
  readonly type: string;
  readonly phase: string;
  readonly durationMs: number;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface PerformanceRecorderOptions {
  readonly root: HTMLElement;
  readonly host: HTMLElement;
  readonly projectId: string;
  readonly worldId: string;
  readonly durationMs?: number;
  readonly endpoint?: string;
}

export interface PerformanceRecorderHandle {
  readonly toggle: (reason?: string) => void;
  readonly start: (reason?: string) => void;
  readonly stop: (reason?: string) => Promise<void>;
  readonly recordFrame: (sample: PerformanceFrameSample) => void;
  readonly recordEvent: (
    type: string,
    phase?: string,
    durationMs?: number,
    detail?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly isRecording: () => boolean;
  readonly destroy: () => void;
}

const DEFAULT_CAPTURE_DURATION_MS = 15_000;
const DEFAULT_CAPTURE_ENDPOINT = "/editor/api/performance-captures";
const MAX_CAPTURED_FRAMES = 1_800;
const MAX_CAPTURED_EVENTS = 1_200;
const BADGE_UPDATE_INTERVAL_MS = 200;

function rounded(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? 0;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function buildSummary(
  samples: readonly PerformanceFrameSample[],
  events: readonly PerformanceActionSample[],
): Record<string, unknown> {
  const frameTimes = samples.map((sample) => sample.frameMs).filter((value) => value > 0);
  const phaseNames: (keyof PerformancePhaseSample)[] = [
    "cameraPhysicsMs",
    "targetingMs",
    "environmentMs",
    "avatarsHudMs",
    "renderSubmitMs",
    "storeStreamMs",
    "cpuTotalMs",
  ];
  const phaseAverages = Object.fromEntries(
    phaseNames.map((name) => [
      name,
      rounded(average(samples.map((sample) => sample.phases[name]))),
    ]),
  );
  const inputFrames = samples.filter((sample) => sample.input.lookDeltaMagnitude > 0);
  const longTasks = events.filter((event) => event.type === "browser-long-task");
  const actionTypes = [...new Set(events.map((event) => event.type))];
  const actionPhases = [...new Set(events.map((event) => `${event.type}:${event.phase}`))];
  const eventSummary = Object.fromEntries(actionTypes.map((type) => {
    const matching = events.filter((event) => event.type === type);
    const durations = matching.map((event) => event.durationMs).filter((value) => value > 0);
    return [type, {
      count: matching.length,
      averageDurationMs: rounded(average(durations)),
      maxDurationMs: rounded(Math.max(0, ...durations)),
      totalDurationMs: rounded(durations.reduce((total, value) => total + value, 0)),
    }];
  }));
  const eventPhaseSummary = Object.fromEntries(actionPhases.map((typeAndPhase) => {
    const matching = events.filter(
      (event) => `${event.type}:${event.phase}` === typeAndPhase,
    );
    const durations = matching.map((event) => event.durationMs).filter((value) => value > 0);
    return [typeAndPhase, {
      count: matching.length,
      averageDurationMs: rounded(average(durations)),
      p95DurationMs: rounded(percentile(durations, 0.95)),
      maxDurationMs: rounded(Math.max(0, ...durations)),
      totalDurationMs: rounded(durations.reduce((total, value) => total + value, 0)),
    }];
  }));
  const movementFrames = samples.filter((sample) => sample.input.movementActive);
  const editingFrames = samples.filter((sample) => (
    sample.edits.pendingCommands > 0
    || sample.edits.pendingOverlays > 0
    || sample.edits.pendingMeshBatchChunks > 0
  ));
  const worstFrames = [...samples]
    .sort((left, right) => right.frameMs - left.frameMs)
    .slice(0, 12)
    .map((sample) => ({
      atMs: rounded(sample.atMs),
      frameMs: rounded(sample.frameMs),
      cpuTotalMs: rounded(sample.phases.cpuTotalMs),
      renderSubmitMs: rounded(sample.phases.renderSubmitMs),
      movementActive: sample.input.movementActive,
      lookDeltaMagnitude: rounded(sample.input.lookDeltaMagnitude),
      camera: sample.camera,
      renderer: sample.renderer,
      world: sample.world,
      edits: sample.edits,
    }));

  return {
    sampleCount: samples.length,
    averageFps: rounded(1_000 / Math.max(average(frameTimes), 0.001), 2),
    averageFrameMs: rounded(average(frameTimes)),
    p50FrameMs: rounded(percentile(frameTimes, 0.5)),
    p95FrameMs: rounded(percentile(frameTimes, 0.95)),
    p99FrameMs: rounded(percentile(frameTimes, 0.99)),
    maxFrameMs: rounded(Math.max(0, ...frameTimes)),
    onePercentLowFps: rounded(1_000 / Math.max(percentile(frameTimes, 0.99), 0.001), 2),
    estimatedDroppedFramesAt60Hz: frameTimes.reduce(
      (total, value) => total + Math.max(0, Math.round(value / (1_000 / 60)) - 1),
      0,
    ),
    hitchesOver25Ms: frameTimes.filter((value) => value > 25).length,
    hitchesOver50Ms: frameTimes.filter((value) => value > 50).length,
    cameraInputFrames: inputFrames.length,
    averageInputMagnitude: rounded(average(
      inputFrames.map((sample) => sample.input.lookDeltaMagnitude),
    )),
    inputPhaseAverageMs: {
      inputReadMs: rounded(average(samples.map((sample) => sample.input.inputReadMs))),
      physicsSimulationMs: rounded(average(
        samples.map((sample) => sample.input.physicsSimulationMs),
      )),
      physicsStoreMs: rounded(average(samples.map((sample) => sample.input.physicsStoreMs))),
      cameraFinalizeMs: rounded(average(
        samples.map((sample) => sample.input.cameraFinalizeMs),
      )),
      cameraStoreMs: rounded(average(samples.map((sample) => sample.input.cameraStoreMs))),
      averagePhysicsSubSteps: rounded(average(
        samples.map((sample) => sample.input.physicsSubSteps),
      )),
    },
    phaseAverageMs: phaseAverages,
    movementAverageFrameMs: rounded(average(movementFrames.map((sample) => sample.frameMs))),
    editingAverageFrameMs: rounded(average(editingFrames.map((sample) => sample.frameMs))),
    worstFrames,
    eventCount: events.length,
    eventSummary,
    eventPhaseSummary,
    longTaskCount: longTasks.length,
    longTaskTotalMs: rounded(
      longTasks.reduce((total, event) => total + event.durationMs, 0),
    ),
    longTaskMaxMs: rounded(Math.max(0, ...longTasks.map((event) => event.durationMs))),
  };
}

function createBadge(host: HTMLElement): HTMLDivElement {
  const badge = document.createElement("div");
  badge.className = "editor-performance-recorder";
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-live", "polite");
  badge.hidden = true;
  host.append(badge);
  return badge;
}

export function createPerformanceRecorder(
  options: PerformanceRecorderOptions,
): PerformanceRecorderHandle {
  const durationMs = Math.max(3_000, options.durationMs ?? DEFAULT_CAPTURE_DURATION_MS);
  const endpoint = options.endpoint ?? DEFAULT_CAPTURE_ENDPOINT;
  const badge = createBadge(options.host);
  let recording = false;
  let destroyed = false;
  let startedAtMs = 0;
  let startedAtIso = "";
  let startedReason = "manual";
  let lastBadgeUpdateElapsedMs = 0;
  let samples: PerformanceFrameSample[] = [];
  let events: PerformanceActionSample[] = [];
  let completionTimer: number | null = null;
  let longTaskObserver: PerformanceObserver | null = null;
  let longAnimationFrameObserver: PerformanceObserver | null = null;
  let eventTimingObserver: PerformanceObserver | null = null;
  let layoutShiftObserver: PerformanceObserver | null = null;

  function recordEvent(
    type: string,
    phase = "instant",
    eventDurationMs = 0,
    detail: Readonly<Record<string, unknown>> = {},
  ): void {
    if (!recording || destroyed || events.length >= MAX_CAPTURED_EVENTS) return;
    events.push({
      atMs: rounded(performance.now()),
      type: String(type || "unknown").slice(0, 96),
      phase: String(phase || "instant").slice(0, 96),
      durationMs: rounded(Math.max(0, Number(eventDurationMs) || 0)),
      detail,
    });
  }

  function startLongTaskObserver(): void {
    if (longTaskObserver || typeof PerformanceObserver === "undefined") return;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          recordEvent("browser-long-task", entry.name || "longtask", entry.duration, {
            startTimeMs: rounded(entry.startTime),
            entryType: entry.entryType,
          });
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: false });
    } catch {
      longTaskObserver = null;
    }
  }

  function supportsEntryType(type: string): boolean {
    return typeof PerformanceObserver !== "undefined"
      && (PerformanceObserver.supportedEntryTypes?.includes(type) ?? false);
  }

  function startLongAnimationFrameObserver(): void {
    if (longAnimationFrameObserver || !supportsEntryType("long-animation-frame")) return;
    try {
      longAnimationFrameObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const loaf = entry as PerformanceEntry & {
            readonly blockingDuration?: number;
            readonly renderStart?: number;
            readonly styleAndLayoutStart?: number;
            readonly firstUIEventTimestamp?: number;
            readonly scripts?: readonly {
              readonly duration?: number;
              readonly sourceURL?: string;
              readonly sourceFunctionName?: string;
              readonly invokerType?: string;
              readonly invoker?: string;
            }[];
          };
          const scripts = [...(loaf.scripts ?? [])]
            .sort((left, right) => (right.duration ?? 0) - (left.duration ?? 0));
          recordEvent("browser-long-animation-frame", "loaf", entry.duration, {
            startTimeMs: rounded(entry.startTime),
            blockingDurationMs: rounded(loaf.blockingDuration ?? 0),
            renderDurationMs: rounded(
              loaf.renderStart ? Math.max(0, entry.startTime + entry.duration - loaf.renderStart) : 0,
            ),
            styleAndLayoutDurationMs: rounded(
              loaf.styleAndLayoutStart
                ? Math.max(0, entry.startTime + entry.duration - loaf.styleAndLayoutStart)
                : 0,
            ),
            inputDelayMs: rounded(
              loaf.firstUIEventTimestamp
                ? Math.max(0, loaf.firstUIEventTimestamp - entry.startTime)
                : 0,
            ),
            scriptCount: scripts.length,
            topScripts: scripts.slice(0, 5).map((script) => ({
              durationMs: rounded(script.duration ?? 0),
              sourceUrl: script.sourceURL ?? "",
              functionName: script.sourceFunctionName ?? "",
              invokerType: script.invokerType ?? "",
              invoker: script.invoker ?? "",
            })),
          });
        }
      });
      longAnimationFrameObserver.observe({ type: "long-animation-frame", buffered: false });
    } catch {
      longAnimationFrameObserver = null;
    }
  }

  function startEventTimingObserver(): void {
    if (eventTimingObserver || !supportsEntryType("event")) return;
    try {
      eventTimingObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const timing = entry as PerformanceEntry & {
            readonly processingStart?: number;
            readonly processingEnd?: number;
            readonly interactionId?: number;
          };
          recordEvent("browser-input-event", entry.name || "event", entry.duration, {
            startTimeMs: rounded(entry.startTime),
            inputDelayMs: rounded(Math.max(
              0,
              (timing.processingStart ?? entry.startTime) - entry.startTime,
            )),
            handlerDurationMs: rounded(Math.max(
              0,
              (timing.processingEnd ?? timing.processingStart ?? entry.startTime)
                - (timing.processingStart ?? entry.startTime),
            )),
            presentationDelayMs: rounded(Math.max(
              0,
              entry.startTime + entry.duration
                - (timing.processingEnd ?? timing.processingStart ?? entry.startTime),
            )),
            interactionId: timing.interactionId ?? 0,
          });
        }
      });
      eventTimingObserver.observe({
        type: "event",
        buffered: false,
        durationThreshold: 8,
      } as PerformanceObserverInit);
    } catch {
      eventTimingObserver = null;
    }
  }

  function startLayoutShiftObserver(): void {
    if (layoutShiftObserver || !supportsEntryType("layout-shift")) return;
    try {
      layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            readonly value?: number;
            readonly hadRecentInput?: boolean;
          };
          recordEvent(
            "browser-layout-shift",
            shift.hadRecentInput ? "after-input" : "unexpected",
            0,
            {
              startTimeMs: rounded(entry.startTime),
              value: rounded(shift.value ?? 0, 6),
            },
          );
        }
      });
      layoutShiftObserver.observe({ type: "layout-shift", buffered: false });
    } catch {
      layoutShiftObserver = null;
    }
  }

  function stopObserver(observer: PerformanceObserver | null): void {
    try {
      observer?.disconnect();
    } catch {
      // Diagnostics must never affect the editor.
    }
  }

  function stopLongTaskObserver(): void {
    try {
      longTaskObserver?.takeRecords().forEach((entry) => {
        recordEvent("browser-long-task", entry.name || "longtask", entry.duration, {
          startTimeMs: rounded(entry.startTime),
          entryType: entry.entryType,
        });
      });
      longTaskObserver?.disconnect();
    } catch {
      // Diagnostics must never affect the editor.
    }
    longTaskObserver = null;
  }

  function recordRuntimeSnapshot(phase: "start" | "stop"): void {
    const memory = (performance as Performance & {
      readonly memory?: {
        readonly usedJSHeapSize?: number;
        readonly totalJSHeapSize?: number;
        readonly jsHeapSizeLimit?: number;
      };
    }).memory;
    const connection = (navigator as Navigator & {
      readonly connection?: {
        readonly effectiveType?: string;
        readonly downlink?: number;
        readonly rtt?: number;
        readonly saveData?: boolean;
      };
    }).connection;
    recordEvent("capture-context", phase, 0, {
      visibilityState: document.visibilityState,
      focused: document.hasFocus(),
      usedJsHeapBytes: memory?.usedJSHeapSize ?? null,
      totalJsHeapBytes: memory?.totalJSHeapSize ?? null,
      jsHeapLimitBytes: memory?.jsHeapSizeLimit ?? null,
      connectionEffectiveType: connection?.effectiveType ?? null,
      connectionDownlinkMbps: connection?.downlink ?? null,
      connectionRttMs: connection?.rtt ?? null,
      connectionSaveData: connection?.saveData ?? null,
    });
  }

  function recordResourceSummary(): void {
    const resources = performance.getEntriesByType("resource")
      .filter((entry) => entry.startTime >= startedAtMs)
      .map((entry) => entry as PerformanceResourceTiming);
    const relevant = resources.filter((entry) => (
      entry.initiatorType === "fetch"
      || entry.initiatorType === "xmlhttprequest"
      || entry.initiatorType === "worker"
      || entry.initiatorType === "img"
    ));
    recordEvent("capture-resources", "summary", 0, {
      count: relevant.length,
      totalDurationMs: rounded(relevant.reduce((total, entry) => total + entry.duration, 0)),
      totalTransferBytes: relevant.reduce((total, entry) => total + (entry.transferSize || 0), 0),
      slowest: [...relevant]
        .sort((left, right) => right.duration - left.duration)
        .slice(0, 12)
        .map((entry) => ({
          name: entry.name.slice(0, 512),
          initiatorType: entry.initiatorType,
          durationMs: rounded(entry.duration),
          responseStartMs: rounded(entry.responseStart - entry.startTime),
          transferBytes: entry.transferSize || 0,
        })),
    });
  }

  function setDataset(status: string, captureId = ""): void {
    options.root.dataset.performanceCaptureStatus = status;
    options.root.dataset.performanceCaptureId = captureId;
    options.root.dataset.performanceCaptureFrameCount = String(samples.length);
  }

  function showBadge(text: string, state: string): void {
    badge.hidden = false;
    badge.dataset.state = state;
    badge.textContent = text;
  }

  function clearCompletionTimer(): void {
    if (completionTimer !== null) {
      window.clearTimeout(completionTimer);
      completionTimer = null;
    }
  }

  function start(reason = "manual"): void {
    if (destroyed || recording) return;
    clearCompletionTimer();
    samples = [];
    events = [];
    recording = true;
    startedAtMs = performance.now();
    startedAtIso = new Date().toISOString();
    startedReason = reason;
    lastBadgeUpdateElapsedMs = 0;
    setDataset("recording");
    startLongTaskObserver();
    startLongAnimationFrameObserver();
    startEventTimingObserver();
    startLayoutShiftObserver();
    recordRuntimeSnapshot("start");
    showBadge("F8-Diagnose läuft · F8 beendet", "recording");
  }

  async function stop(reason = "manual"): Promise<void> {
    if (destroyed || !recording) return;
    const stoppedAtMs = performance.now();
    stopLongTaskObserver();
    stopObserver(longAnimationFrameObserver);
    stopObserver(eventTimingObserver);
    stopObserver(layoutShiftObserver);
    longAnimationFrameObserver = null;
    eventTimingObserver = null;
    layoutShiftObserver = null;
    recordResourceSummary();
    recordRuntimeSnapshot("stop");
    recording = false;
    const capturedSamples = samples;
    const capturedEvents = events;
    const summary = buildSummary(capturedSamples, capturedEvents);
    setDataset("saving");
    showBadge("F8-Diagnose wird gespeichert …", "saving");

    const payload = {
      contract: "vectoplan-editor-performance-capture.v1",
      startedAt: startedAtIso,
      stoppedAt: new Date().toISOString(),
      durationMs: rounded(stoppedAtMs - startedAtMs),
      startReason: startedReason,
      stopReason: reason,
      projectId: options.projectId,
      worldId: options.worldId,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        devicePixelRatio: window.devicePixelRatio,
      },
      summary,
      frames: capturedSamples,
      events: capturedEvents,
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json() as { captureId?: string };
      const captureId = result.captureId ?? "unbekannt";
      setDataset("saved", captureId);
      showBadge(`F8-Diagnose gespeichert · ${captureId}`, "saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.root.dataset.performanceCaptureError = message;
      setDataset("failed");
      showBadge("F8-Diagnose konnte nicht gespeichert werden", "failed");
    }

    completionTimer = window.setTimeout(() => {
      badge.hidden = true;
      completionTimer = null;
    }, 6_000);
  }

  function toggle(reason = "manual"): void {
    if (recording) void stop(reason);
    else start(reason);
  }

  function recordFrame(sample: PerformanceFrameSample): void {
    if (!recording || destroyed) return;
    if (samples.length < MAX_CAPTURED_FRAMES) {
      samples.push(sample);
    }
    const elapsedMs = performance.now() - startedAtMs;
    options.root.dataset.performanceCaptureFrameCount = String(samples.length);
    if (elapsedMs - lastBadgeUpdateElapsedMs >= BADGE_UPDATE_INTERVAL_MS) {
      lastBadgeUpdateElapsedMs = elapsedMs;
      const remainingSeconds = Math.max(0, (durationMs - elapsedMs) / 1_000);
      showBadge(
        `F8-Diagnose ${remainingSeconds.toFixed(1)} s · F8 beendet`,
        "recording",
      );
    }
    if (elapsedMs >= durationMs || samples.length >= MAX_CAPTURED_FRAMES) {
      void stop(elapsedMs >= durationMs ? "duration-complete" : "sample-limit");
    }
  }

  setDataset("idle");

  return {
    toggle,
    start,
    stop,
    recordFrame,
    recordEvent,
    isRecording: () => recording,
    destroy(): void {
      destroyed = true;
      recording = false;
      stopLongTaskObserver();
      stopObserver(longAnimationFrameObserver);
      stopObserver(eventTimingObserver);
      stopObserver(layoutShiftObserver);
      clearCompletionTimer();
      badge.remove();
    },
  };
}
