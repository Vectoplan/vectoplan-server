import type { RoofToolParameters } from "./contracts";
import { importedRoofSource } from "./imported";

/**
 * Restore the immutable LoD2 survey roof instead of carrying parameters from
 * the last parametric variant back into the imported calculation.
 *
 * The source datum and source pitch are part of the import contract.  Keeping
 * an edited pitch, eaves datum, or overhang while merely changing `roofType`
 * to `imported` produces a valid but visibly modified roof and therefore is
 * not a LoD2-original restore.
 */
export function restoreImportedRoofOriginal(
  parameters: RoofToolParameters,
): RoofToolParameters {
  const source = importedRoofSource(parameters.importedSource);
  if (!source) return { ...parameters, roofType: "imported" };
  return {
    ...parameters,
    roofType: "imported",
    pitchDeg: source.referencePitchDeg,
    eavesHeightMm: source.baseY * 1_000,
    ridgeDirection: "auto",
    overhangMm: 0,
    overhangNorthMm: 0,
    overhangEastMm: 0,
    overhangSouthMm: 0,
    overhangWestMm: 0,
    edgeOverhangsMm: [],
  };
}
