import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
  createBuildingProgramTemplateCatalog,
} from "../src/frontend/world_edit/systems/line_brush/building_programs";
import {
  DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE,
  MAXIMUM_LINE_BRUSH_STOREY_COUNT,
  buildingProgramTemplatesForType,
  createLineBrushBuildingGenerationRequest,
  createLineBrushQuickSettingsSnapshot,
  formatLineBrushHeightMeters,
  normalizeLineBrushQuickSettingsState,
  normalizeLineBrushStoreyCount,
  reduceLineBrushQuickSettingsState,
} from "../src/frontend/world_edit/systems/line_brush/quick_settings_state";
import {
  LINE_BRUSH_ROOF_OPTIONS,
  lineBrushBuildingPreset,
} from "../src/frontend/world_edit/systems/line_brush/building_presets";

function catalogFixture() {
  return createBuildingProgramTemplateCatalog({
    typeId: "houses",
    inventoryPayload: {
      inventory: {
        items: [
          {
            itemId: "house-installed",
            label: "Kompaktes Einfamilienhaus",
            objectKind: "building-template",
            category: "residential",
            familyId: "vp.building.house.compact",
            vplibUid: "vp-house-compact",
          },
          {
            itemId: "hall-installed",
            label: "Industriehalle Standard",
            objectKind: "building-template",
            category: "industrial-logistics",
            familyId: "vp.building.hall.standard",
            vplibUid: "vp-hall-standard",
          },
        ],
        slots: [],
      },
    },
    marketplacePayload: {
      items: [
        {
          id: "house-market",
          title: "Reihenhaus Muster",
          primary_category_slug: "building-templates",
          public_url: "/market/house-market",
        },
        {
          id: "hall-market",
          title: "Flexible Lagerhalle",
          primary_category_slug: "building-templates",
          public_url: "/market/hall-market",
        },
      ],
    },
  });
}

test("quick settings start with Standard, one storey and exact 2.645 m labels", () => {
  const snapshot = createLineBrushQuickSettingsSnapshot();
  assert.equal(snapshot.typeId, "standard");
  assert.equal(snapshot.templateId, DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID);
  assert.equal(snapshot.storeyCount, 1);
  assert.equal(snapshot.storeyHeightMeters, 2.645);
  assert.equal(snapshot.storeyHeightMillimeters, 2645);
  assert.equal(snapshot.storeyHeightLabel, "2,645 m");
  assert.equal(snapshot.totalHeightLabel, "2,645 m");
  assert.equal(snapshot.canGenerate, true);
  assert.equal(formatLineBrushHeightMeters(7.935), "7,935 m");
});

test("storey count normalization is integral, finite and bounded", () => {
  assert.equal(normalizeLineBrushStoreyCount(Number.NaN), 1);
  assert.equal(normalizeLineBrushStoreyCount(-20), 1);
  assert.equal(normalizeLineBrushStoreyCount(3.6), 4);
  assert.equal(normalizeLineBrushStoreyCount(500), MAXIMUM_LINE_BRUSH_STOREY_COUNT);
});

test("changing the building type resets a stale template to Standard", () => {
  const catalog = catalogFixture();
  const house = reduceLineBrushQuickSettingsState(
    DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE,
    { type: "set-building-type", typeId: "houses" },
    catalog,
  );
  const selected = reduceLineBrushQuickSettingsState(
    house,
    { type: "select-template", templateId: "library:house-installed" },
    catalog,
  );
  assert.equal(selected.templateId, "library:house-installed");

  const changed = reduceLineBrushQuickSettingsState(
    selected,
    { type: "set-building-type", typeId: "industrial-logistics" },
    catalog,
  );
  assert.equal(changed.typeId, "industrial-logistics");
  assert.equal(changed.templateId, DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID);
});

test("building presets provide architectural storeys, spacing and roof defaults", () => {
  const house = reduceLineBrushQuickSettingsState(
    DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE,
    { type: "set-building-type", typeId: "houses" },
  );
  assert.equal(house.storeyCount, 2);
  assert.equal(house.roofType, "gable");
  assert.equal(lineBrushBuildingPreset("houses").arrangement.gapMeters, 4);
  assert.equal(lineBrushBuildingPreset("houses").arrangement.endSetbackMeters, 2);

  const hall = reduceLineBrushQuickSettingsState(
    house,
    { type: "set-building-type", typeId: "industrial-logistics" },
  );
  assert.equal(hall.storeyCount, 1);
  assert.equal(hall.roofType, "gable");
  assert.equal(lineBrushBuildingPreset("industrial-logistics").arrangement.gapMeters, 12);
  assert.equal(lineBrushBuildingPreset("industrial-logistics").arrangement.maximumDepthMeters, 32);
});

test("roof dropdown options drive the canonical roof state and generation request", () => {
  assert.equal(new Set(LINE_BRUSH_ROOF_OPTIONS.map(({ value }) => value)).size, LINE_BRUSH_ROOF_OPTIONS.length);
  assert.deepEqual(
    LINE_BRUSH_ROOF_OPTIONS.map(({ value }) => value),
    [
      "flat",
      "gable",
      "hipped",
      "half_hipped",
      "pent",
      "mansard",
      "trapezoid",
      "butterfly",
      "pyramid",
      "barrel",
      "sawtooth",
    ],
  );
  const state = reduceLineBrushQuickSettingsState(
    DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE,
    { type: "set-roof-type", roofType: "butterfly" },
  );
  const request = createLineBrushBuildingGenerationRequest(state);
  assert.equal(state.roofType, "butterfly");
  assert.equal(request.roofType, "butterfly");
  assert.equal(request.roofPitchDegrees, 35);
  assert.equal(request.preset.typeId, "standard");
});

test("library window helpers expose only Standard and templates matching the active filter", () => {
  const catalog = catalogFixture();
  const houses = buildingProgramTemplatesForType(catalog, "houses");
  assert.deepEqual(
    houses.map((template) => template.id).sort(),
    ["builtin:standard", "library:house-installed", "marketplace:house-market"].sort(),
  );
  const halls = buildingProgramTemplatesForType(catalog, "industrial-logistics");
  assert.deepEqual(
    halls.map((template) => template.id).sort(),
    ["builtin:standard", "library:hall-installed", "marketplace:hall-market"].sort(),
  );
});

test("generation request carries storey count, exact height and selected Library template", () => {
  const catalog = catalogFixture();
  const state = normalizeLineBrushQuickSettingsState({
    typeId: "houses",
    storeyCount: 3,
    templateId: "library:house-installed",
  }, catalog);
  const request = createLineBrushBuildingGenerationRequest(state, catalog);
  assert.equal(request.storeyCount, 3);
  assert.equal(request.storeyHeightMeters, 2.645);
  assert.equal(request.totalHeightMeters, 7.935);
  assert.equal(request.totalHeightMillimeters, 7935);
  assert.equal(request.templateSelection.executionTemplate.id, "library:house-installed");
  assert.equal(request.buildingProgram.executedTemplateId, "library:house-installed");
  assert.equal(request.buildingProgram.assemblies.roof.generationTool, "roof");
  assert.equal(request.roofType, "gable");
  assert.equal(request.preset.arrangement.gapMeters, 4);
});

test("Marketplace-only template cannot be sent to Generate before installation", () => {
  const catalog = catalogFixture();
  const state = normalizeLineBrushQuickSettingsState({
    typeId: "houses",
    storeyCount: 2,
    templateId: "marketplace:house-market",
  }, catalog);
  const snapshot = createLineBrushQuickSettingsSnapshot(state, catalog);
  assert.equal(snapshot.canGenerate, false);
  assert.equal(snapshot.selection.action, "open-marketplace");
  assert.throws(
    () => createLineBrushBuildingGenerationRequest(state, catalog),
    /must be installed/i,
  );
});
