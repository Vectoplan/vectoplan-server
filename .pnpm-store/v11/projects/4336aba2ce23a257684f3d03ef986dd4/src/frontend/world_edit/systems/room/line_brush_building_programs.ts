import {
  DEFAULT_EDITOR_INVENTORY_API_URL,
  asArray,
  asOptionalString,
  asRecord,
  asString,
  getInventoryItems,
  getInventorySlots,
  getFamilyId,
  getItemId,
  getLibraryRef,
  getVplibUid,
  isEmptyInventorySlot,
  type EditorInventoryLibraryRef,
  type UnknownRecord,
} from "../../../api/editor_inventory_models";

/**
 * Typed catalog adapter for building programs used by the building line brush.
 *
 * Architecture rules:
 * - the built-in Standard program is always executable;
 * - installed VPLIB programs are read through /editor/api/inventory;
 * - marketplace products are discovery/acquisition results, never executable
 *   directly before they appear in the editor inventory;
 * - the module has no DOM, camera, mode or WorldEdit-controller side effects.
 */

export const LINE_BRUSH_BUILDING_PROGRAMS_MODULE_NAME =
  "frontend.world_edit.room.line_brush_building_programs";
export const LINE_BRUSH_BUILDING_PROGRAMS_MODULE_VERSION = "1.0.0";
export const LINE_BRUSH_BUILDING_PROGRAM_SCHEMA_VERSION =
  "vectoplan.line-brush-building-program.v1" as const;
export const LINE_BRUSH_BUILDING_TEMPLATE_SCHEMA_VERSION =
  "vectoplan.line-brush-building-template.v1" as const;

export const DEFAULT_BUILDING_PROGRAM_TYPE_ID = "standard" as const;
export const DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID = "builtin:standard" as const;
export const STANDARD_STOREY_HEIGHT_METERS = 2.645 as const;
export const STANDARD_STOREY_HEIGHT_MILLIMETERS = 2645 as const;

/**
 * Existing VPLIB floor-slab material used by every generated storey plate.
 * Keeping the full placement identity here makes a first placement work even
 * when the project's Chunk registry has not seen this Library item yet.
 */
export const STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID =
  "vp.hochbau.decken.massivdecken.decke_stahlbeton" as const;
export const STANDARD_FLOOR_SLAB_LIBRARY_CONTEXT = Object.freeze({
  libraryItemId: STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
  familyId: STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
  packageId: `vplib.${STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID}`,
  vplibUid: "cafedb8f-da7a-4ab5-af01-01f488ebee0a",
  variantId: "dicke_250_mm",
  objectKind: "cell_block",
  label: "Decke Stahlbeton · 25 cm",
  libraryRef: Object.freeze({
    familyId: STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
    packageId: `vplib.${STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID}`,
    vplibUid: "cafedb8f-da7a-4ab5-af01-01f488ebee0a",
    variantId: "dicke_250_mm",
    objectKind: "cell_block",
  }),
  placementCommand: Object.freeze({
    kind: "SetBlock",
    runtimeBlockTypeId: STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
    blockTypeId: STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
  }),
});

export const DEFAULT_MARKETPLACE_ORIGIN = "http://localhost:5200";
export const DEFAULT_MARKETPLACE_PAGE_PATH = "/marketplace";
export const DEFAULT_MARKETPLACE_CATALOG_PATH = "/market/products/_list";
export const MARKETPLACE_BUILDING_TEMPLATE_CATEGORY = "building-templates" as const;

export type BuildingProgramTypeId =
  | "standard"
  | "houses"
  | "multi-family-housing"
  | "industrial-logistics"
  | "office-commercial"
  | "mixed-use"
  | "public-building"
  | "hospitality";

export interface BuildingProgramTypeDefinition {
  readonly id: BuildingProgramTypeId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly marketplaceCategory: typeof MARKETPLACE_BUILDING_TEMPLATE_CATEGORY;
  readonly marketplaceChildCategory: string | null;
  readonly marketplaceQuery: string;
  readonly searchTerms: readonly string[];
}

export const BUILDING_PROGRAM_TYPES: readonly BuildingProgramTypeDefinition[] = Object.freeze([
  {
    id: "standard",
    label: "Standard",
    shortLabel: "Standard",
    description: "Neutraler, vollständig editierbarer Baukörper mit VECTOPLAN-Standardaufbau.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: null,
    marketplaceQuery: "",
    searchTerms: ["standard", "basis", "neutral"],
  },
  {
    id: "houses",
    label: "Häuser",
    shortLabel: "Haus",
    description: "Ein-, Doppel- und Reihenhäuser.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: "residential",
    marketplaceQuery: "Haus",
    searchTerms: ["haus", "häuser", "einfamilienhaus", "doppelhaus", "reihenhaus", "villa"],
  },
  {
    id: "multi-family-housing",
    label: "Wohnungen / Mehrfamilienhäuser",
    shortLabel: "Wohnungen / MFH",
    description: "Mehrfamilienhäuser, Wohnblöcke und Apartmentgebäude.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: "residential",
    marketplaceQuery: "Mehrfamilienhaus",
    searchTerms: ["mehrfamilienhaus", "mehrfamilienhäuser", "wohnung", "wohnblock", "apartment"],
  },
  {
    id: "industrial-logistics",
    label: "Halle / Lager / Industrie",
    shortLabel: "Halle / Industrie",
    description: "Produktionshallen, Lager, Werkstätten und Logistikgebäude.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: "industrial-logistics",
    marketplaceQuery: "Halle",
    searchTerms: ["halle", "lager", "industrie", "logistik", "produktion", "werkstatt", "warehouse"],
  },
  {
    id: "office-commercial",
    label: "Büro / Gewerbe",
    shortLabel: "Büro / Gewerbe",
    description: "Büro-, Handels- und sonstige Gewerbegebäude.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: "office-commercial",
    marketplaceQuery: "Büro",
    searchTerms: ["büro", "buero", "office", "gewerbe", "handel", "geschäft"],
  },
  {
    id: "mixed-use",
    label: "Mischnutzung",
    shortLabel: "Mischnutzung",
    description: "Kombinierte Wohn-, Büro- und Gewerbenutzungen.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: "office-commercial",
    marketplaceQuery: "Mischnutzung",
    searchTerms: ["mischnutzung", "mixed use", "mixed-use", "wohnen und gewerbe"],
  },
  {
    id: "public-building",
    label: "Öffentliche Gebäude",
    shortLabel: "Öffentlich",
    description: "Schulen, Kitas, Verwaltungs-, Kultur- und Gesundheitsbauten.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: "public-buildings",
    marketplaceQuery: "Öffentlich",
    searchTerms: ["öffentlich", "oeffentlich", "schule", "kita", "verwaltung", "kultur", "klinik"],
  },
  {
    id: "hospitality",
    label: "Hotel / Beherbergung",
    shortLabel: "Hotel",
    description: "Hotels, Hostels und weitere Beherbergungsgebäude.",
    marketplaceCategory: MARKETPLACE_BUILDING_TEMPLATE_CATEGORY,
    marketplaceChildCategory: "office-commercial",
    marketplaceQuery: "Hotel",
    searchTerms: ["hotel", "hostel", "beherbergung", "pension"],
  },
]);

export type BuildingProgramAssemblyRole = "exterior-wall" | "roof" | "floor-slab";
export type BuildingProgramWorldEditTool = "room" | "roof" | "selection" | "paint";

export interface BuildingProgramAssemblyMetadata {
  readonly role: BuildingProgramAssemblyRole;
  readonly semanticRole:
    | "building.exterior-wall"
    | "building.roof"
    | "building.floor-slab";
  readonly objectKind: "block-wall" | "building-roof" | "floor-slab";
  readonly generationTool: BuildingProgramWorldEditTool;
  readonly editableWith: readonly BuildingProgramWorldEditTool[];
  readonly materialSlot: "exterior-wall" | "roof" | "floor-slab";
  readonly chunkPersistence: "whole-blocks" | "semantic-object-ref";
  readonly editable: true;
  readonly breakable: boolean;
  readonly defaultThicknessMeters: number;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface LineBrushBuildingProgramContract {
  readonly schemaVersion: typeof LINE_BRUSH_BUILDING_PROGRAM_SCHEMA_VERSION;
  readonly generator: Readonly<{
    kind: "line-brush-building";
    worldEditSystem: "room";
    pathBrushKind: "building";
    footprintRule: "constant-width-polyline-union";
    editableCenterline: true;
    editableControlPoints: true;
  }>;
  readonly storey: Readonly<{
    heightMeters: number;
    heightMillimeters: number;
    defaultCount: number;
    minimumCount: number;
  }>;
  readonly assemblies: Readonly<{
    exteriorWall: BuildingProgramAssemblyMetadata;
    roof: BuildingProgramAssemblyMetadata;
    floorSlab: BuildingProgramAssemblyMetadata;
  }>;
  readonly persistence: Readonly<{
    mode: "chunks-with-semantic-object-refs";
    preservePathBrushDraft: true;
    preserveTemplateReference: true;
  }>;
}

export const STANDARD_LINE_BRUSH_BUILDING_PROGRAM_CONTRACT: LineBrushBuildingProgramContract =
  Object.freeze({
    schemaVersion: LINE_BRUSH_BUILDING_PROGRAM_SCHEMA_VERSION,
    generator: Object.freeze({
      kind: "line-brush-building",
      worldEditSystem: "room",
      pathBrushKind: "building",
      footprintRule: "constant-width-polyline-union",
      editableCenterline: true,
      editableControlPoints: true,
    }),
    storey: Object.freeze({
      heightMeters: STANDARD_STOREY_HEIGHT_METERS,
      heightMillimeters: STANDARD_STOREY_HEIGHT_MILLIMETERS,
      defaultCount: 1,
      minimumCount: 1,
    }),
    assemblies: Object.freeze({
      exteriorWall: Object.freeze({
        role: "exterior-wall",
        semanticRole: "building.exterior-wall",
        objectKind: "block-wall",
        generationTool: "room",
        editableWith: Object.freeze(["selection", "paint"] as const),
        materialSlot: "exterior-wall",
        chunkPersistence: "whole-blocks",
        editable: true,
        breakable: true,
        defaultThicknessMeters: 0.365,
        metadata: Object.freeze({
          blockPolicy: "whole-block-at-envelope-edge",
          gridAlignment: "building-envelope-first",
          layerFunction: "exterior",
        }),
      }),
      roof: Object.freeze({
        role: "roof",
        semanticRole: "building.roof",
        objectKind: "building-roof",
        generationTool: "roof",
        editableWith: Object.freeze(["roof", "selection", "paint"] as const),
        materialSlot: "roof",
        chunkPersistence: "semantic-object-ref",
        editable: true,
        breakable: false,
        defaultThicknessMeters: 0.24,
        metadata: Object.freeze({
          roofType: "flat",
          pitchDegrees: 0,
          overhangMeters: 0.5,
          generatedBy: "world-edit.roof",
        }),
      }),
      floorSlab: Object.freeze({
        role: "floor-slab",
        semanticRole: "building.floor-slab",
        objectKind: "floor-slab",
        generationTool: "room",
        editableWith: Object.freeze(["selection", "paint"] as const),
        materialSlot: "floor-slab",
        chunkPersistence: "whole-blocks",
        editable: true,
        breakable: true,
        defaultThicknessMeters: 0.25,
        metadata: Object.freeze({
          placement: "at-each-storey-base",
          includesGroundSlab: true,
          generatedBy: "world-edit.room",
          runtimeBlockTypeId: STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
          variantId: "dicke_250_mm",
        }),
      }),
    }),
    persistence: Object.freeze({
      mode: "chunks-with-semantic-object-refs",
      preservePathBrushDraft: true,
      preserveTemplateReference: true,
    }),
  });

export type BuildingProgramTemplateSource = "builtin" | "library" | "marketplace";
export type BuildingProgramTemplateAvailability = "ready" | "requires-installation";

export interface MarketplaceBuildingProgramReference {
  readonly productId: string;
  readonly slug: string | null;
  readonly productUrl: string;
  readonly previewDataUrl: string;
  readonly imageUrl: string | null;
  readonly priceAmountMinor: number | null;
  readonly currency: string | null;
}

export interface LineBrushBuildingProgramTemplate {
  readonly schemaVersion: typeof LINE_BRUSH_BUILDING_TEMPLATE_SCHEMA_VERSION;
  readonly id: string;
  readonly typeId: BuildingProgramTypeId;
  readonly source: BuildingProgramTemplateSource;
  readonly title: string;
  readonly summary: string | null;
  readonly thumbnailUrl: string | null;
  readonly availability: BuildingProgramTemplateAvailability;
  readonly executable: boolean;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly marketplace: MarketplaceBuildingProgramReference | null;
  readonly contract: LineBrushBuildingProgramContract;
}

export interface BuildingProgramTemplateCatalog {
  readonly schemaVersion: "vectoplan.line-brush-building-template-catalog.v1";
  readonly selectedTypeId: BuildingProgramTypeId;
  readonly types: readonly BuildingProgramTypeDefinition[];
  readonly templates: readonly LineBrushBuildingProgramTemplate[];
  readonly standardTemplate: LineBrushBuildingProgramTemplate;
}

export interface BuildingProgramTemplateSelection {
  readonly schemaVersion: "vectoplan.line-brush-building-template-selection.v1";
  readonly typeId: BuildingProgramTypeId;
  readonly selectedTemplateId: string;
  readonly selectedTemplate: LineBrushBuildingProgramTemplate;
  readonly executionTemplate: LineBrushBuildingProgramTemplate;
  readonly resolution: "selected" | "fallback-standard";
  readonly action: "execute" | "open-marketplace";
  readonly requiresMarketplaceAcquisition: boolean;
  readonly marketplaceUrl: string | null;
}

export interface BuildingProgramExecutionMetadata {
  readonly schemaVersion: "vectoplan.line-brush-building-execution.v1";
  readonly typeId: BuildingProgramTypeId;
  readonly requestedTemplateId: string;
  readonly executedTemplateId: string;
  readonly templateSource: "builtin" | "library";
  readonly resolution: "selected" | "fallback-standard";
  readonly storeyHeightMeters: number;
  readonly storeyHeightMillimeters: number;
  readonly libraryRef: EditorInventoryLibraryRef | null;
  readonly assemblies: LineBrushBuildingProgramContract["assemblies"];
  readonly pathBrush: LineBrushBuildingProgramContract["generator"];
  readonly persistence: LineBrushBuildingProgramContract["persistence"];
}

export interface MarketplaceUrlOptions {
  readonly origin?: string;
  readonly pagePath?: string;
  readonly catalogPath?: string;
  readonly offset?: number;
  readonly limit?: number;
  readonly includeTotal?: boolean;
  readonly sort?: "newest" | "popular" | "rating" | "price_asc";
  readonly price?: "all" | "free" | "paid";
}

export interface BuildingProgramTemplateCatalogInput {
  readonly typeId?: BuildingProgramTypeId | string | null;
  readonly marketplacePayload?: unknown;
  readonly inventoryPayload?: unknown;
  readonly marketplaceOrigin?: string;
}

export interface BuildingProgramFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type BuildingProgramFetch = (
  input: string,
  init?: Readonly<{
    method?: string;
    credentials?: "same-origin" | "include" | "omit";
    cache?: "no-store" | "default";
    headers?: Readonly<Record<string, string>>;
    signal?: AbortSignal;
  }>,
) => Promise<BuildingProgramFetchResponse>;

export interface LoadBuildingProgramTemplateCatalogOptions extends BuildingProgramTemplateCatalogInput {
  readonly fetcher?: BuildingProgramFetch;
  readonly inventoryUrl?: string;
  readonly marketplaceUrlOptions?: MarketplaceUrlOptions;
  readonly signal?: AbortSignal;
}

export interface LoadedBuildingProgramTemplateCatalog {
  readonly catalog: BuildingProgramTemplateCatalog;
  readonly diagnostics: Readonly<{
    marketplaceUrl: string;
    inventoryUrl: string;
    marketplace: "ready" | "failed";
    inventory: "ready" | "failed";
    errors: readonly string[];
  }>;
}

function normalizedSearchText(value: unknown): string {
  return asString(value, "")
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function safeAbsoluteUrl(value: unknown, origin: string): string | null {
  const path = asOptionalString(value);
  if (!path) return null;
  try {
    return new URL(path, normalizeOrigin(origin)).toString();
  } catch {
    return null;
  }
}

function normalizeOrigin(origin: string): string {
  const normalized = asString(origin, DEFAULT_MARKETPLACE_ORIGIN).replace(/\/+$/, "");
  return normalized || DEFAULT_MARKETPLACE_ORIGIN;
}

function definitionFor(value: BuildingProgramTypeId | string | null | undefined): BuildingProgramTypeDefinition {
  const normalized = asString(value, DEFAULT_BUILDING_PROGRAM_TYPE_ID) as BuildingProgramTypeId;
  return (
    BUILDING_PROGRAM_TYPES.find((candidate) => candidate.id === normalized) ??
    BUILDING_PROGRAM_TYPES[0]
  );
}

export function getBuildingProgramType(
  value: BuildingProgramTypeId | string | null | undefined,
): BuildingProgramTypeDefinition {
  return definitionFor(value);
}

export function inferBuildingProgramType(value: unknown): BuildingProgramTypeId {
  const text = normalizedSearchText(value);
  if (!text) return DEFAULT_BUILDING_PROGRAM_TYPE_ID;

  // MFH must win before the generic "Haus" match.
  const orderedTypes: readonly BuildingProgramTypeId[] = [
    "multi-family-housing",
    "industrial-logistics",
    "mixed-use",
    "office-commercial",
    "public-building",
    "hospitality",
    "houses",
  ];

  for (const typeId of orderedTypes) {
    const definition = definitionFor(typeId);
    if (definition.searchTerms.some((term) => text.includes(normalizedSearchText(term)))) {
      return typeId;
    }
  }
  return DEFAULT_BUILDING_PROGRAM_TYPE_ID;
}

function applyMarketplaceFilter(
  url: URL,
  definition: BuildingProgramTypeDefinition,
  options: MarketplaceUrlOptions,
  includePaging: boolean,
): void {
  url.searchParams.set("category", definition.marketplaceCategory);
  if (definition.marketplaceQuery) url.searchParams.set("q", definition.marketplaceQuery);
  if (!includePaging) return;

  url.searchParams.set("offset", String(Math.max(0, Math.trunc(options.offset ?? 0))));
  url.searchParams.set("limit", String(Math.min(100, Math.max(1, Math.trunc(options.limit ?? 24)))));
  url.searchParams.set("sort", options.sort ?? "newest");
  if (options.price && options.price !== "all") url.searchParams.set("price", options.price);
  url.searchParams.set("include_total", options.includeTotal === false ? "0" : "1");
}

export function buildBuildingProgramMarketplacePageUrl(
  typeId: BuildingProgramTypeId | string | null | undefined = DEFAULT_BUILDING_PROGRAM_TYPE_ID,
  options: MarketplaceUrlOptions = {},
): string {
  const origin = normalizeOrigin(options.origin ?? DEFAULT_MARKETPLACE_ORIGIN);
  const url = new URL(options.pagePath ?? DEFAULT_MARKETPLACE_PAGE_PATH, `${origin}/`);
  applyMarketplaceFilter(url, definitionFor(typeId), options, false);
  return url.toString();
}

export function buildBuildingProgramMarketplaceApiUrl(
  typeId: BuildingProgramTypeId | string | null | undefined = DEFAULT_BUILDING_PROGRAM_TYPE_ID,
  options: MarketplaceUrlOptions = {},
): string {
  const origin = normalizeOrigin(options.origin ?? DEFAULT_MARKETPLACE_ORIGIN);
  const url = new URL(options.catalogPath ?? DEFAULT_MARKETPLACE_CATALOG_PATH, `${origin}/`);
  applyMarketplaceFilter(url, definitionFor(typeId), options, true);
  return url.toString();
}

export function buildBuildingProgramInventoryUrl(
  inventoryUrl = DEFAULT_EDITOR_INVENTORY_API_URL,
  forceRefresh = false,
): string {
  const normalized = asString(inventoryUrl, DEFAULT_EDITOR_INVENTORY_API_URL);
  if (!forceRefresh) return normalized;
  const separator = normalized.includes("?") ? "&" : "?";
  return `${normalized}${separator}force_refresh=1`;
}

function builtInStandardTemplate(): LineBrushBuildingProgramTemplate {
  return {
    schemaVersion: LINE_BRUSH_BUILDING_TEMPLATE_SCHEMA_VERSION,
    id: DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
    typeId: DEFAULT_BUILDING_PROGRAM_TYPE_ID,
    source: "builtin",
    title: "Standard",
    summary: "VECTOPLAN-Standardbaukörper mit editierbaren Blockwänden, Dach und Deckenplatten.",
    thumbnailUrl: null,
    availability: "ready",
    executable: true,
    libraryRef: null,
    marketplace: null,
    contract: STANDARD_LINE_BRUSH_BUILDING_PROGRAM_CONTRACT,
  };
}

function marketplaceCategoryIsBuildingTemplate(record: UnknownRecord): boolean {
  const category = normalizedSearchText(
    record.primary_category_slug ?? record.primaryCategorySlug ?? record.category,
  );
  return !category || ["building templates", "templates", "plans", "maps"].includes(category);
}

function marketplaceTypeFor(record: UnknownRecord, requestedType: BuildingProgramTypeId): BuildingProgramTypeId {
  const inferred = inferBuildingProgramType([
    record.title,
    record.slug,
    record.summary,
  ].filter(Boolean).join(" "));
  return inferred === DEFAULT_BUILDING_PROGRAM_TYPE_ID && requestedType !== DEFAULT_BUILDING_PROGRAM_TYPE_ID
    ? requestedType
    : inferred;
}

export function normalizeMarketplaceBuildingProgramTemplates(
  payload: unknown,
  options: Readonly<{
    typeId?: BuildingProgramTypeId | string | null;
    origin?: string;
  }> = {},
): LineBrushBuildingProgramTemplate[] {
  const root = asRecord(payload);
  const origin = normalizeOrigin(options.origin ?? DEFAULT_MARKETPLACE_ORIGIN);
  const requestedType = definitionFor(options.typeId).id;
  const seen = new Set<string>();
  const result: LineBrushBuildingProgramTemplate[] = [];

  for (const rawItem of asArray(root.items)) {
    const item = asRecord(rawItem);
    if (!marketplaceCategoryIsBuildingTemplate(item)) continue;
    const productId = asOptionalString(item.id ?? item.product_id ?? item.productId);
    const title = asOptionalString(item.title ?? item.name);
    if (!productId || !title) continue;
    const id = `marketplace:${productId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const publicUrl = safeAbsoluteUrl(item.public_url ?? item.publicUrl, origin)
      ?? new URL(`/market/${encodeURIComponent(productId)}`, `${origin}/`).toString();
    result.push({
      schemaVersion: LINE_BRUSH_BUILDING_TEMPLATE_SCHEMA_VERSION,
      id,
      typeId: marketplaceTypeFor(item, requestedType),
      source: "marketplace",
      title,
      summary: asOptionalString(item.summary ?? item.description),
      thumbnailUrl: safeAbsoluteUrl(item.image_url ?? item.imageUrl, origin),
      availability: "requires-installation",
      executable: false,
      libraryRef: null,
      marketplace: {
        productId,
        slug: asOptionalString(item.slug),
        productUrl: publicUrl,
        previewDataUrl: new URL(
          `/market/products/${encodeURIComponent(productId)}/preview-data`,
          `${origin}/`,
        ).toString(),
        imageUrl: safeAbsoluteUrl(item.image_url ?? item.imageUrl, origin),
        priceAmountMinor: safeInteger(item.price_amount ?? item.priceAmount),
        currency: asOptionalString(item.currency),
      },
      contract: STANDARD_LINE_BRUSH_BUILDING_PROGRAM_CONTRACT,
    });
  }
  return result;
}

function inventoryCandidateText(record: UnknownRecord): string {
  const classification = asRecord(record.classification);
  const libraryRef = asRecord(record.libraryRef ?? record.library_ref);
  const metadata = asRecord(record.metadata);
  const program = asRecord(metadata.buildingProgram ?? metadata.building_program);
  return normalizedSearchText([
    record.label,
    record.displayLabel,
    record.display_label,
    record.description,
    record.objectKind,
    record.object_kind,
    record.domain,
    record.category,
    record.subcategory,
    classification.domain,
    classification.category,
    classification.subcategory,
    classification.path,
    libraryRef.objectKind,
    libraryRef.object_kind,
    libraryRef.domain,
    libraryRef.category,
    libraryRef.subcategory,
    program.typeId,
    program.type_id,
    metadata.templateKind,
    metadata.template_kind,
  ].filter(Boolean).join(" "));
}

function isLibraryBuildingTemplate(record: UnknownRecord): boolean {
  const text = inventoryCandidateText(record);
  if (!text) return false;
  return [
    "building template",
    "building program",
    "project template",
    "gebaudevorlage",
    "gebaude programm",
    "baukorper vorlage",
    "residential",
    "industrial logistics",
    "office commercial",
    "public buildings",
  ].some((marker) => text.includes(marker));
}

function inventoryRecords(payload: unknown): UnknownRecord[] {
  const candidates: UnknownRecord[] = [
    ...getInventoryItems(payload).map(asRecord),
    ...getInventorySlots(payload)
      .filter((slot) => !isEmptyInventorySlot(slot))
      .map(asRecord),
  ];
  const seen = new Set<string>();
  return candidates.filter((record) => {
    const key = asOptionalString(
      getItemId(record)
      ?? record.stableKey
      ?? record.stable_key
      ?? getFamilyId(record)
      ?? getVplibUid(record),
    );
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeLibraryBuildingProgramTemplates(
  payload: unknown,
): LineBrushBuildingProgramTemplate[] {
  const result: LineBrushBuildingProgramTemplate[] = [];
  for (const record of inventoryRecords(payload)) {
    if (!isLibraryBuildingTemplate(record)) continue;
    const libraryRef = getLibraryRef(record);
    if (!libraryRef) continue;
    const stableId = asOptionalString(
      getItemId(record)
      ?? getItemId(libraryRef)
      ?? getFamilyId(libraryRef)
      ?? getVplibUid(libraryRef),
    );
    if (!stableId) continue;

    const title = asString(
      record.displayLabel ?? record.display_label ?? record.label,
      asString(libraryRef.familyId ?? libraryRef.vplibUid, "Gebäudevorlage"),
    );
    const text = `${inventoryCandidateText(record)} ${title}`;
    const assets = asRecord(record.assets);
    result.push({
      schemaVersion: LINE_BRUSH_BUILDING_TEMPLATE_SCHEMA_VERSION,
      id: `library:${stableId}`,
      typeId: inferBuildingProgramType(text),
      source: "library",
      title,
      summary: asOptionalString(record.description),
      thumbnailUrl: asOptionalString(
        record.iconUrl
        ?? record.icon_url
        ?? assets.thumbnailUrl
        ?? assets.thumbnail_url
        ?? assets.previewUrl
        ?? assets.preview_url,
      ),
      availability: "ready",
      executable: true,
      libraryRef,
      marketplace: null,
      contract: STANDARD_LINE_BRUSH_BUILDING_PROGRAM_CONTRACT,
    });
  }
  return result;
}

function uniqueTemplates(
  templates: readonly LineBrushBuildingProgramTemplate[],
): LineBrushBuildingProgramTemplate[] {
  const ids = new Set<string>();
  return templates.filter((template) => {
    if (ids.has(template.id)) return false;
    ids.add(template.id);
    return true;
  });
}

export function createBuildingProgramTemplateCatalog(
  input: BuildingProgramTemplateCatalogInput = {},
): BuildingProgramTemplateCatalog {
  const selectedTypeId = definitionFor(input.typeId).id;
  const standardTemplate = builtInStandardTemplate();
  const installed = normalizeLibraryBuildingProgramTemplates(input.inventoryPayload);
  const marketplace = normalizeMarketplaceBuildingProgramTemplates(input.marketplacePayload, {
    typeId: selectedTypeId,
    origin: input.marketplaceOrigin,
  });
  const templates = uniqueTemplates([standardTemplate, ...installed, ...marketplace]);
  return {
    schemaVersion: "vectoplan.line-brush-building-template-catalog.v1",
    selectedTypeId,
    types: BUILDING_PROGRAM_TYPES,
    templates,
    standardTemplate,
  };
}

export function selectBuildingProgramTemplate(
  catalog: BuildingProgramTemplateCatalog,
  templateId?: string | null,
  typeId?: BuildingProgramTypeId | string | null,
): BuildingProgramTemplateSelection {
  const requested = catalog.templates.find((template) => template.id === templateId)
    ?? catalog.standardTemplate;
  const effectiveType = definitionFor(
    typeId
      ?? (requested.source === "builtin" ? catalog.selectedTypeId : requested.typeId),
  ).id;
  const ready = requested.executable && requested.availability === "ready";
  const executionTemplate = ready ? requested : catalog.standardTemplate;
  return {
    schemaVersion: "vectoplan.line-brush-building-template-selection.v1",
    typeId: effectiveType,
    selectedTemplateId: requested.id,
    selectedTemplate: requested,
    executionTemplate,
    resolution: ready ? "selected" : "fallback-standard",
    action: ready ? "execute" : "open-marketplace",
    requiresMarketplaceAcquisition: !ready,
    marketplaceUrl: requested.marketplace?.productUrl ?? null,
  };
}

export function createDefaultBuildingProgramTemplateSelection(
  catalog: BuildingProgramTemplateCatalog = createBuildingProgramTemplateCatalog(),
): BuildingProgramTemplateSelection {
  return selectBuildingProgramTemplate(catalog, DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID);
}

export function buildBuildingProgramExecutionMetadata(
  selection: BuildingProgramTemplateSelection,
): BuildingProgramExecutionMetadata {
  const template = selection.executionTemplate;
  if (template.source === "marketplace") {
    throw new Error("Marketplace building programs must be installed in the Library before execution.");
  }
  return {
    schemaVersion: "vectoplan.line-brush-building-execution.v1",
    typeId: selection.typeId,
    requestedTemplateId: selection.selectedTemplate.id,
    executedTemplateId: template.id,
    templateSource: template.source,
    resolution: selection.resolution,
    storeyHeightMeters: template.contract.storey.heightMeters,
    storeyHeightMillimeters: template.contract.storey.heightMillimeters,
    libraryRef: template.libraryRef,
    assemblies: template.contract.assemblies,
    pathBrush: template.contract.generator,
    persistence: template.contract.persistence,
  };
}

async function loadJson(
  fetcher: BuildingProgramFetch,
  url: string,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  const response = await fetcher(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

export async function loadBuildingProgramTemplateCatalog(
  options: LoadBuildingProgramTemplateCatalogOptions = {},
): Promise<LoadedBuildingProgramTemplateCatalog> {
  const defaultFetch = globalThis.fetch?.bind(globalThis) as BuildingProgramFetch | undefined;
  const fetcher = options.fetcher ?? defaultFetch;
  if (!fetcher) throw new Error("No fetch implementation is available for the building-program catalog.");

  const typeId = definitionFor(options.typeId).id;
  const marketplaceOrigin = options.marketplaceOrigin
    ?? options.marketplaceUrlOptions?.origin
    ?? DEFAULT_MARKETPLACE_ORIGIN;
  const marketplaceUrl = buildBuildingProgramMarketplaceApiUrl(typeId, {
    ...options.marketplaceUrlOptions,
    origin: marketplaceOrigin,
  });
  const inventoryUrl = buildBuildingProgramInventoryUrl(options.inventoryUrl);
  const errors: string[] = [];

  const [marketplaceResult, inventoryResult] = await Promise.allSettled([
    loadJson(fetcher, marketplaceUrl, options.signal),
    loadJson(fetcher, inventoryUrl, options.signal),
  ]);
  const marketplacePayload = marketplaceResult.status === "fulfilled"
    ? marketplaceResult.value
    : undefined;
  const inventoryPayload = inventoryResult.status === "fulfilled"
    ? inventoryResult.value
    : undefined;
  if (marketplaceResult.status === "rejected") {
    errors.push(`marketplace: ${asString(marketplaceResult.reason?.message, "request failed")}`);
  }
  if (inventoryResult.status === "rejected") {
    errors.push(`inventory: ${asString(inventoryResult.reason?.message, "request failed")}`);
  }

  return {
    catalog: createBuildingProgramTemplateCatalog({
      typeId,
      marketplacePayload,
      inventoryPayload,
      marketplaceOrigin,
    }),
    diagnostics: {
      marketplaceUrl,
      inventoryUrl,
      marketplace: marketplaceResult.status === "fulfilled" ? "ready" : "failed",
      inventory: inventoryResult.status === "fulfilled" ? "ready" : "failed",
      errors,
    },
  };
}
