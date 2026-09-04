# Linien-Brush: Gebäudeprogramme und Vorlagen

Das Modul `src/frontend/world_edit/systems/line_brush/building_programs.ts`
trennt die Gebäudeprogramm-Auswahl von Kamera, Arbeitsansicht und
`world_edit_controller.ts`. Die Auswahl eines Gebäudetyps oder einer Vorlage darf
daher niemals zwischen Ego- und Planungsperspektive wechseln.

## Quellen

- `builtin:standard` ist immer vorhanden und direkt ausführbar.
- Installierte VPLIB-Vorlagen kommen ausschließlich aus
  `GET /editor/api/inventory`. Der Browser spricht `vectoplan-library` nicht
  direkt an.
- Noch nicht installierte Vorlagen werden über
  `http://localhost:5200/market/products/_list` entdeckt. Die passende
  Benutzeransicht ist `http://localhost:5200/marketplace`.
- Marketplace-Treffer sind nicht direkt ausführbar. Die Auswahl liefert die
  Aktion `open-marketplace`; bis zur Installation bleibt der ausführbare
  Fallback `builtin:standard`.

## Controller-freie Integrations-API

```ts
const loaded = await loadBuildingProgramTemplateCatalog({
  typeId: "multi-family-housing",
});

const selection = selectBuildingProgramTemplate(
  loaded.catalog,
  selectedTemplateId,
);

if (selection.action === "open-marketplace") {
  window.open(selection.marketplaceUrl ?? buildBuildingProgramMarketplacePageUrl(selection.typeId));
  return;
}

const buildingProgram = buildBuildingProgramExecutionMetadata(selection);
```

Die UI-Integration reicht `buildingProgram` beim Linien-Brush-`Ausführen` an
die gemeinsame Generierungspipeline weiter. Diese persistiert die Baufläche,
getrennte Außenwand- und Deckenobjekte sowie die WorldEdit-Dachzonen in Chunks.
Sie erhält insbesondere:

- Vorlagen-ID und Library-Referenz,
- Gebäudetyp,
- Geschosshöhe in Metern und Millimetern,
- Außenwand-, Dach- und Deckenplattenvertrag,
- die Regel `constant-width-polyline-union`,
- Chunk- und Semantic-Object-Ref-Persistenz.

## Standardvertrag

`Standard` nutzt exakt `2,645 m` beziehungsweise `2645 mm` Geschosshöhe.
Außenwände werden als ganze, editier- und abbaubare Blöcke an der Gebäudehülle
geführt. Das Dach bleibt ein semantisches, mit dem Dach-Tool editierbares
Objekt. Deckenplatten werden je Geschossbasis als editierbare Blockstruktur
mit dem vorhandenen VPLIB-Block
`vp.hochbau.decken.massivdecken.decke_stahlbeton` in der 25-cm-Variante
geführt. Wand- und Deckenbelegung überschneiden sich nicht. Der Adapter
enthält bewusst keine unmittelbare WorldEdit-Ausführung; er liefert den
typisierten, JSON-sicheren Vertrag für die gemeinsame Ausführungspipeline.

## Quick-Settings-Handle

`src/frontend/world_edit/systems/line_brush/quick_settings.ts` stellt das weiße, rechts vertikal zentrierte
DOM-Panel bereit. Das zugehörige CSS wird vom Modul selbst importiert. Eine
minimale Verdrahtung sieht so aus:

```ts
const lineBrushSettings = createLineBrushQuickSettings({
  root: options.root,
  onChange(snapshot) {
    // Optional: Vorschau mit Gebäudetyp und Geschosszahl aktualisieren.
  },
  onTemplateSelect(snapshot) {
    // Optional: ausgewählte installierte Library-Vorlage vormerken.
  },
  async onGenerate(request) {
    // Bestehende Linien-Brush-Ausführung verwenden.
    // request.storeyCount / request.totalHeightMillimeters
    // request.buildingProgram / request.templateSelection
  },
  onClose(restoreInput) {
    // Pointer-Lock nur entsprechend der aktuellen Arbeitsansicht restaurieren.
  },
});
```

Das exportierte Handle bietet `open`, `close`, `sync`, `getState`,
`getSnapshot`, `getCatalog`, `setCatalog`, `openLibrary`, `closeLibrary`,
`reloadCatalog`, `isOpen`, `isLibraryOpen` und `destroy`. Es setzt selbst
keinen Workspace-Modus und enthält keine Kamera- oder WorldEdit-Aktivierung.
