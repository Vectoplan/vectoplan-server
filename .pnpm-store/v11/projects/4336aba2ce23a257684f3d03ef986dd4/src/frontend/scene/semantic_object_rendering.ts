export interface SemanticObjectRenderDescriptor {
  readonly objectTypeId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface VplibParametricObjectDescriptor {
  readonly objectKind: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Only legacy parcel blocks belong to the automatic grid migration. Roofs
 * and imported/CAD geometry have an independent footprint and must survive a
 * remesh without being rewritten as a one-cell parcel prism.
 */
export function shouldAdaptSemanticObjectToParcelGrid(
  ref: SemanticObjectRenderDescriptor & { readonly objectKind: string; readonly footprint?: Readonly<Record<string,unknown>> },
): boolean {
  return ref.objectKind === "semantic_footprint" && ref.objectTypeId === "parcel_grid_body"
    && ref.footprint?.gridAlignment !== 'world-cell';
}

export function shouldAdaptBlockToParcelGrid(blockTypeId: string): boolean {
  return !/^(air|generator_|biome_|water|bedrock|lod2_)/.test(blockTypeId.trim().toLowerCase());
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
