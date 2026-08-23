export interface SemanticObjectRenderDescriptor {
  readonly objectTypeId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface VplibParametricObjectDescriptor {
  readonly objectKind: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

function normalizedText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isVplibParametricObjectRef(
  ref: VplibParametricObjectDescriptor,
): boolean {
  return normalizedText(ref.objectKind) === "vplib_parametric"
    || (
      normalizedText(ref.objectKind) === "library_object"
      && normalizedText(ref.metadata.schemaVersion) === "vectoplan-vplib-parametric.v1"
    );
}

/**
 * CAD keeps its exact millimetre footprint as semantic metadata for the 2D
 * projection. Structural CAD objects are nevertheless voxel objects in the
 * Editor: rendering the footprint as a second, thin extrusion would hide the
 * persisted block cells and make the terrain underneath look cut away.
 */
export function shouldRenderSemanticFootprint(
  ref: SemanticObjectRenderDescriptor,
): boolean {
  if (ref.objectTypeId === "space_room") return true;
  if (ref.objectTypeId === "building_roof") return true;
  return normalizedText(ref.metadata.source) !== "vectoplan-cad";
}
