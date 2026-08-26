import { roofCalculationVersionsMatch } from "./zones";

interface OptimisticRoofCalculation {
  readonly calculation: unknown;
  confirmedSince: number | null;
  confirmedChunkRevision: number | null;
}

const STABLE_PERSISTED_VERSION_MS = 10_000;
const optimisticCalculations = new Map<string, OptimisticRoofCalculation>();

function normalizedId(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * Keep the just-saved calculation authoritative while chunk invalidations may
 * still arrive out of order. One roof owns at most one optimistic version.
 */
export function registerOptimisticRoofCalculation(
  objectInstanceId: string,
  calculation: unknown,
): void {
  const id = normalizedId(objectInstanceId);
  if (!id) return;
  optimisticCalculations.set(id, {
    calculation,
    confirmedSince: null,
    confirmedChunkRevision: null,
  });
}

export function clearOptimisticRoofCalculation(
  objectInstanceId: string,
  expectedCalculation?: unknown,
): void {
  const id = normalizedId(objectInstanceId);
  const pending = optimisticCalculations.get(id);
  if (!pending) return;
  if (expectedCalculation !== undefined
    && !roofCalculationVersionsMatch(pending.calculation, expectedCalculation)) return;
  optimisticCalculations.delete(id);
}

/**
 * Verify the immutable calculation tag carried by an already-built roof mesh.
 * This closes the race where the mesh was prepared before a save, but only
 * committed to the Three.js scene after the new optimistic version existed.
 */
export function isRenderedRoofCalculationCurrent(
  objectInstanceId: string,
  renderedCalculationVersion: unknown,
): boolean {
  const pending = optimisticCalculations.get(normalizedId(objectInstanceId));
  return !pending
    || roofCalculationVersionsMatch(pending.calculation, renderedCalculationVersion);
}

/**
 * Resolve the geometry used by the scene. A stale response is replaced with
 * the successful local result, even if it arrives after a correct response.
 * Versioned chunks keep the guard until a strictly newer collaborator revision
 * arrives. Unversioned transports release it only after a stable grace window.
 */
export function roofCalculationForScene(
  objectInstanceId: string,
  persistedCalculation: unknown,
  chunkRevision: number | null = null,
  now = Date.now(),
): unknown {
  const id = normalizedId(objectInstanceId);
  const pending = optimisticCalculations.get(id);
  if (!pending) return persistedCalculation;
  if (!roofCalculationVersionsMatch(pending.calculation, persistedCalculation)) {
    if (pending.confirmedChunkRevision !== null
      && chunkRevision !== null
      && chunkRevision > pending.confirmedChunkRevision) {
      // A strictly newer chunk is a real subsequent edit, for example from a
      // collaborator, and must supersede our optimistic save.
      optimisticCalculations.delete(id);
      return persistedCalculation;
    }
    pending.confirmedSince = null;
    return pending.calculation;
  }
  if (chunkRevision !== null) {
    pending.confirmedChunkRevision = Math.max(
      pending.confirmedChunkRevision ?? chunkRevision,
      chunkRevision,
    );
  }
  if (pending.confirmedSince === null) {
    pending.confirmedSince = now;
  } else if (pending.confirmedChunkRevision === null
    && now - pending.confirmedSince >= STABLE_PERSISTED_VERSION_MS) {
    optimisticCalculations.delete(id);
  }
  return persistedCalculation;
}
