import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILDING_PROGRAM_TYPES,
  DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
  STANDARD_FLOOR_SLAB_LIBRARY_CONTEXT,
  STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
  STANDARD_LINE_BRUSH_BUILDING_PROGRAM_CONTRACT,
  STANDARD_STOREY_HEIGHT_METERS,
  STANDARD_STOREY_HEIGHT_MILLIMETERS,
  buildBuildingProgramExecutionMetadata,
  buildBuildingProgramMarketplaceApiUrl,
  buildBuildingProgramMarketplacePageUrl,
  createBuildingProgramTemplateCatalog,
  createDefaultBuildingProgramTemplateSelection,
  loadBuildingProgramTemplateCatalog,
  normalizeLibraryBuildingProgramTemplates,
  normalizeMarketplaceBuildingProgramTemplates,
  selectBuildingProgramTemplate,
  type BuildingProgramFetch,
} from "../src/frontend/world_edit/systems/line_brush/building_programs";

test("building program taxonomy has Standard plus the required architecture types", () => {
  assert.equal(BUILDING_PROGRAM_TYPES[0]?.id, "standard");
  assert.equal(BUILDING_PROGRAM_TYPES[0]?.label, "Standard");
  assert.ok(BUILDING_PROGRAM_TYPES.some((type) => type.id === "houses"));
  assert.ok(BUILDING_PROGRAM_TYPES.some((type) => type.id === "multi-family-housing"));
  assert.ok(BUILDING_PROGRAM_TYPES.some((type) => type.id === "industrial-logistics"));
  assert.ok(BUILDING_PROGRAM_TYPES.some((type) => type.id === "office-commercial"));
  assert.ok(BUILDING_PROGRAM_TYPES.some((type) => type.id === "mixed-use"));
  assert.ok(BUILDING_PROGRAM_TYPES.some((type) => type.id === "public-building"));
});

test("Standard contract keeps exact 2.645 m storey height and semantic assemblies", () => {
  const contract = STANDARD_LINE_BRUSH_BUILDING_PROGRAM_CONTRACT;
  assert.equal(STANDARD_STOREY_HEIGHT_METERS, 2.645);
  assert.equal(STANDARD_STOREY_HEIGHT_MILLIMETERS, 2645);
  assert.equal(contract.storey.heightMeters, 2.645);
  assert.equal(contract.storey.heightMillimeters, 2645);
  assert.equal(contract.generator.footprintRule, "constant-width-polyline-union");

  assert.deepEqual(
    Object.keys(contract.assemblies).sort(),
    ["exteriorWall", "floorSlab", "roof"],
  );
  assert.equal(contract.assemblies.exteriorWall.objectKind, "block-wall");
  assert.equal(contract.assemblies.exteriorWall.chunkPersistence, "whole-blocks");
  assert.equal(contract.assemblies.exteriorWall.metadata.blockPolicy, "whole-block-at-envelope-edge");
  assert.equal(contract.assemblies.roof.generationTool, "roof");
  assert.equal(contract.assemblies.roof.metadata.generatedBy, "world-edit.roof");
  assert.equal(contract.assemblies.floorSlab.semanticRole, "building.floor-slab");
  assert.equal(contract.assemblies.floorSlab.defaultThicknessMeters, 0.25);
  assert.equal(
    contract.assemblies.floorSlab.metadata.runtimeBlockTypeId,
    STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
  );
  assert.equal(
    STANDARD_FLOOR_SLAB_LIBRARY_CONTEXT.placementCommand.runtimeBlockTypeId,
    STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID,
  );
  assert.equal(STANDARD_FLOOR_SLAB_LIBRARY_CONTEXT.variantId, "dicke_250_mm");
  assert.equal(contract.persistence.mode, "chunks-with-semantic-object-refs");
});

test("marketplace links use localhost:5200 and the public building-template filters", () => {
  const page = new URL(buildBuildingProgramMarketplacePageUrl("industrial-logistics"));
  assert.equal(page.origin, "http://localhost:5200");
  assert.equal(page.pathname, "/marketplace");
  assert.equal(page.searchParams.get("category"), "building-templates");
  assert.equal(page.searchParams.get("q"), "Halle");

  const api = new URL(buildBuildingProgramMarketplaceApiUrl("multi-family-housing", {
    limit: 12,
    sort: "popular",
  }));
  assert.equal(api.pathname, "/market/products/_list");
  assert.equal(api.searchParams.get("category"), "building-templates");
  assert.equal(api.searchParams.get("q"), "Mehrfamilienhaus");
  assert.equal(api.searchParams.get("limit"), "12");
  assert.equal(api.searchParams.get("sort"), "popular");
  assert.equal(api.searchParams.get("include_total"), "1");
});

test("marketplace catalog products remain non-executable acquisition templates", () => {
  const templates = normalizeMarketplaceBuildingProgramTemplates({
    status: "ok",
    items: [
      {
        id: "prod-hall-1",
        title: "Flexible Logistikhalle",
        slug: "flexible-logistikhalle",
        summary: "Parametrische Halle",
        primary_category_slug: "building-templates",
        public_url: "/@studio/flexible-logistikhalle",
        image_url: "/media/hall.webp",
        price_amount: 9900,
        currency: "EUR",
      },
      {
        id: "component-1",
        title: "Fenster",
        primary_category_slug: "components",
      },
    ],
  });

  assert.equal(templates.length, 1);
  const template = templates[0]!;
  assert.equal(template.id, "marketplace:prod-hall-1");
  assert.equal(template.typeId, "industrial-logistics");
  assert.equal(template.availability, "requires-installation");
  assert.equal(template.executable, false);
  assert.equal(template.marketplace?.productUrl, "http://localhost:5200/@studio/flexible-logistikhalle");
  assert.equal(
    template.marketplace?.previewDataUrl,
    "http://localhost:5200/market/products/prod-hall-1/preview-data",
  );
});

test("installed building programs are adapted only from editor inventory Library refs", () => {
  const templates = normalizeLibraryBuildingProgramTemplates({
    ok: true,
    inventory: {
      items: [
        {
          itemId: "lib-mfh-1",
          label: "MFH Hofbebauung",
          description: "Mehrfamilienhaus mit Hof",
          objectKind: "building-template",
          domain: "architecture",
          category: "residential",
          familyId: "vp.architecture.building.mfh-hof",
          vplibUid: "vplib-mfh-hof",
          variantId: "default",
          libraryRef: {
            source: "vectoplan-library",
            kind: "vplib",
            libraryItemId: "lib-mfh-1",
            familyId: "vp.architecture.building.mfh-hof",
            vplibUid: "vplib-mfh-hof",
            variantId: "default",
          },
          assets: { thumbnailUrl: "/library/mfh.png" },
        },
        {
          itemId: "lib-chair-1",
          label: "Stuhl",
          objectKind: "furniture",
          domain: "interior",
          category: "objects",
          familyId: "vp.interior.furniture.chair",
          vplibUid: "vplib-chair",
        },
      ],
      slots: [],
    },
  });

  assert.equal(templates.length, 1);
  const template = templates[0]!;
  assert.equal(template.id, "library:lib-mfh-1");
  assert.equal(template.typeId, "multi-family-housing");
  assert.equal(template.source, "library");
  assert.equal(template.executable, true);
  assert.equal(template.libraryRef?.familyId, "vp.architecture.building.mfh-hof");
});

test("selection defaults to Standard, executes installed templates and guards marketplace products", () => {
  const catalog = createBuildingProgramTemplateCatalog({
    typeId: "industrial-logistics",
    marketplacePayload: {
      items: [{
        id: "market-hall",
        title: "Industriehalle",
        primary_category_slug: "building-templates",
        public_url: "/market/market-hall",
      }],
    },
    inventoryPayload: {
      inventory: {
        items: [{
          itemId: "installed-hall",
          label: "Installierte Lagerhalle",
          objectKind: "building-template",
          category: "industrial-logistics",
          familyId: "vp.building.hall",
          vplibUid: "vp-hall",
        }],
        slots: [],
      },
    },
  });

  const defaultSelection = createDefaultBuildingProgramTemplateSelection(catalog);
  assert.equal(defaultSelection.selectedTemplateId, DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID);
  assert.equal(defaultSelection.action, "execute");

  const installed = selectBuildingProgramTemplate(catalog, "library:installed-hall");
  assert.equal(installed.resolution, "selected");
  assert.equal(installed.executionTemplate.id, "library:installed-hall");
  assert.equal(installed.requiresMarketplaceAcquisition, false);

  const market = selectBuildingProgramTemplate(catalog, "marketplace:market-hall");
  assert.equal(market.action, "open-marketplace");
  assert.equal(market.resolution, "fallback-standard");
  assert.equal(market.executionTemplate.id, DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID);
  assert.equal(market.requiresMarketplaceAcquisition, true);
});

test("execution metadata is JSON-safe and carries the complete Standard contract", () => {
  const selection = createDefaultBuildingProgramTemplateSelection();
  const metadata = buildBuildingProgramExecutionMetadata(selection);
  assert.equal(metadata.storeyHeightMeters, 2.645);
  assert.equal(metadata.storeyHeightMillimeters, 2645);
  assert.equal(metadata.pathBrush.pathBrushKind, "building");
  assert.equal(metadata.assemblies.exteriorWall.semanticRole, "building.exterior-wall");
  assert.equal(metadata.assemblies.roof.semanticRole, "building.roof");
  assert.equal(metadata.assemblies.floorSlab.semanticRole, "building.floor-slab");
  assert.doesNotThrow(() => JSON.stringify(metadata));
});

test("loader keeps Standard available when Marketplace fails and Library succeeds", async () => {
  const calls: string[] = [];
  const fetcher: BuildingProgramFetch = async (input) => {
    calls.push(input);
    if (input.includes("/market/products/_list")) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ status: "error" }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ inventory: { items: [], slots: [] } }),
    };
  };

  const loaded = await loadBuildingProgramTemplateCatalog({
    typeId: "houses",
    fetcher,
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.some((url) => url === "/editor/api/inventory"));
  assert.equal(loaded.diagnostics.marketplace, "failed");
  assert.equal(loaded.diagnostics.inventory, "ready");
  assert.equal(loaded.catalog.standardTemplate.id, DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID);
  assert.equal(loaded.catalog.templates.length, 1);
});
