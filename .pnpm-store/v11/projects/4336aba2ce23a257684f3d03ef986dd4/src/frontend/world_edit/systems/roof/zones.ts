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
