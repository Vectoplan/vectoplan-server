export interface RoofZoneIdentity {
  readonly objectInstanceId: string;
}

/**
 * A persisted roof is represented by many meshes (skin, rafters and purlins).
 * Reduce those mesh-level references to one visual/edit target per roof zone.
 */
export function uniqueRoofZones<T extends RoofZoneIdentity>(
  values: readonly T[],
): readonly T[] {
  const unique = new Map<string, T>();
  for (const value of values) {
    const id = String(value.objectInstanceId ?? "").trim();
    if (id && !unique.has(id)) unique.set(id, value);
  }
  return [...unique.values()].sort((first, second) => (
    first.objectInstanceId.localeCompare(second.objectInstanceId)
  ));
}

export function inactiveRoofZones<T extends RoofZoneIdentity>(
  values: readonly T[],
  activeObjectInstanceId: string | null,
): readonly T[] {
  return uniqueRoofZones(values).filter(({ objectInstanceId }) => (
    objectInstanceId !== activeObjectInstanceId
  ));
}

export function shouldCommitRoofSettingsClose(state: Readonly<{
  restorePointerLock: boolean;
  roofToolActive: boolean;
  busy: boolean;
  closed: boolean;
  valid: boolean;
}>): boolean {
  return state.restorePointerLock
    && state.roofToolActive
    && !state.busy
    && state.closed
    && state.valid;
}

export interface RoofPreviewState<TRequest, TCalculation> {
  readonly request: TRequest | null;
  readonly calculation: TCalculation | null;
}

/**
 * Invalidate an outstanding calculation without blanking a valid roof while
 * the replacement request is running. A preview is retained only as a complete
 * request/result pair, so it can never be persisted for different settings.
 */
export function roofPreviewStateAfterInvalidation<TRequest, TCalculation>(
  state: RoofPreviewState<TRequest, TCalculation>,
  retainLastSuccessfulPreview: boolean,
): RoofPreviewState<TRequest, TCalculation> {
  if (retainLastSuccessfulPreview && state.request !== null && state.calculation !== null) {
    return state;
  }
  return { request: null, calculation: null };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Capture the immutable part of a calculation that identifies the geometry
 * which was actually used to build a roof mesh. Semantic metadata can be
 * updated while an asynchronous mesh build is still in flight, so retaining
 * the mutable metadata object itself would make an old mesh look current.
 */
export function roofCalculationVersionSnapshot(value: unknown): Readonly<Record<string, unknown>> {
  const calculation = record(value);
  const structure = record(calculation.structure);
  const bearingModel = record(structure.bearing_model);
  return Object.freeze({
    calculation_id: String(calculation.calculation_id ?? "").trim(),
    input_fingerprint: String(calculation.input_fingerprint ?? "").trim(),
    structure: Object.freeze({
      bearing_model: Object.freeze({
        purlin_vertical_reference: String(bearingModel.purlin_vertical_reference ?? "").trim(),
        roof_zone_top_mm: Number(bearingModel.roof_zone_top_mm),
        lowest_purlin_bottom_mm: Number(bearingModel.lowest_purlin_bottom_mm),
      }),
    }),
  });
}

/** New calculations explicitly state that the lowest purlin underside uses the roof-zone top as datum. */
export function roofCalculationHasZoneTopPurlinAlignment(value: unknown): boolean {
  const calculation = record(value);
  const structure = record(calculation.structure);
  const bearingModel = record(structure.bearing_model);
  const zoneTop = Number(bearingModel.roof_zone_top_mm);
  const purlinBottom = Number(bearingModel.lowest_purlin_bottom_mm);
  return bearingModel.purlin_vertical_reference === "roof_zone_top"
    && Number.isFinite(zoneTop)
    && Number.isFinite(purlinBottom)
    && Math.abs(zoneTop - purlinBottom) <= 0.001;
}

/** Identify the exact calculated version that has reached the persisted scene. */
export function roofCalculationVersionsMatch(expectedValue: unknown, persistedValue: unknown): boolean {
  const expected = record(expectedValue);
  const persisted = record(persistedValue);
  if (roofCalculationHasZoneTopPurlinAlignment(expected)
    && !roofCalculationHasZoneTopPurlinAlignment(persisted)) return false;
  const expectedFingerprint = String(expected.input_fingerprint ?? "").trim();
  const persistedFingerprint = String(persisted.input_fingerprint ?? "").trim();
  if (expectedFingerprint && persistedFingerprint) return expectedFingerprint === persistedFingerprint;
  const expectedId = String(expected.calculation_id ?? "").trim();
  const persistedId = String(persisted.calculation_id ?? "").trim();
  return Boolean(expectedId && persistedId && expectedId === persistedId);
}
