# Parametrische Dächer und Polygonbereiche in CAD und WorldEdit

Stand: 23. August 2026

## 1. Dachberechnung in `vectoplan-cad`

Der zustandslose Rechenkern liegt unter
`services/vectoplan-cad/src/automation/roof/`:

| Datei | Verantwortung |
| --- | --- |
| `calculator.py` | Validierung, Polygonaufbereitung, Dachprofile, Dachhaut, Sparren, Pfetten und Ergebnisstatistik |
| `request.schema.json` | öffentlicher Eingabevertrag `cad-roof-calculation-request/0.1` |
| `result.schema.json` | öffentlicher Ergebnisvertrag `cad-roof-calculation-result/0.1` |
| `example_request.json` | vollständiges Beispiel |
| `README.md` | unterstützte Dacharten und Geometrieverfahren |

Der HTTP-Einstieg ist `POST /api/v1/cad/automation/roof/calculate` in
`services/vectoplan-cad/routes/cad.py`. `calculate_roof(request)` liefert immer
ein vollständiges neues Ergebnis mit Eingabe-Fingerprint. Das Ergebnis enthält
die Ausgangs- und Überstandskontur, Dachflächen, First, Dachhaut, Sparren,
Pfetten, Mengen und Maximalhöhe.

Unterstützte Werte für `roof_type`:

| Schlüssel | Dachart |
| --- | --- |
| `flat` | Flachdach |
| `gable` | Satteldach |
| `hipped` | Walmdach |
| `half_hipped` | Krüppelwalmdach |
| `pent` | Pultdach |
| `mansard` | Mansarddach |
| `trapezoid` | Trapezdach mit Plateau |
| `butterfly` | Schmetterlingsdach |
| `pyramid` | Zelt-/Pyramidendach |
| `barrel` | segmentiertes Tonnendach |
| `sawtooth` | Shed-/Sägezahndach |

Rechtecke verwenden weiterhin das kompatible, exakt parametrische Verfahren
`parametric-envelope-v1`. Beliebige einfache gerade und auch konkave Polygone
verwenden `polygon-clipped-v2`: Dachflächen sowie tragende Bauteile werden an
der tatsächlichen Kontur geschnitten. Selbstüberschneidungen werden abgewiesen.
Wenn ein Überstands-Offset geometrisch mehrdeutig ist, bleibt die
Ausgangskontur erhalten und das Ergebnis enthält eine Warnung.

### Variablen

Dieselben Schlüssel werden in 2D und 3D verwendet. Die CAD-Eingaben stehen in
`services/vectoplan-cad/templates/cad/index.html`, die 3D-Eingaben in
`services/vectoplan-library/templates/inventar/creative-inventar.html`. Der
Editor übersetzt sie in
`services/vectoplan-editor/src/frontend/world_edit/systems/roof/contracts.ts`.

| Bedeutung | Request-Schlüssel | Editor-Eigenschaft | Vorgabe |
| --- | --- | --- | ---: |
| Dachart | `roof_type` | `roofType` | `gable` |
| Dachneigung | `pitch_deg` | `pitchDeg` | 35° |
| Traufhöhe | `eaves_height_mm` | `eavesHeightMm` | 6000 mm |
| Firstrichtung | `ridge_direction` | `ridgeDirection` | `auto` |
| Standardüberstand | `overhang_mm.default_mm` | `overhangMm` | 500 mm |
| Überstand Nord/Ost/Süd/West | `overhang_mm.*_mm` | `overhangNorthMm` usw. | je 500 mm |
| Überstand je Polygonkante | `overhang_mm.edges_mm[]` | `edgeOverhangsMm` | leer |
| Dachhautdicke | `roof_skin_thickness_mm` | `roofSkinThicknessMm` | 180 mm |
| Dachhautmaterial | `roof_skin_material` | `roofSkinMaterial` | `generic-roof-build-up` |
| Sparrenbreite/-höhe | `structure.rafter.width_mm/height_mm` | `rafterWidthMm/rafterHeightMm` | 80/200 mm |
| Sparrenabstand | `structure.rafter.spacing_mm` | `rafterSpacingMm` | 700 mm |
| Pfettenbreite/-höhe | `structure.purlin.width_mm/height_mm` | `purlinWidthMm/purlinHeightMm` | 160/240 mm |
| maximaler Pfettenabstand | `structure.purlin.maximum_spacing_mm` | `purlinMaximumSpacingMm` | 2500 mm |
| Trapez-Plateau | `plateau_width_ratio` | `plateauWidthRatio` | 0,25 |
| Mansardknick | `mansard_break_ratio` | `mansardBreakRatio` | 0,38 |
| Mansardneigung unten/oben | `mansard_lower_pitch_deg/mansard_upper_pitch_deg` | `mansardLowerPitchDeg/mansardUpperPitchDeg` | 70°/28° |
| Krüppelwalmanteil | `hip_end_ratio` | `hipEndRatio` | 0,5 |
| Tonnenanstich | `barrel_rise_mm` | `barrelRiseMm` | 3000 mm |
| Tonnensegmente | `barrel_segment_count` | `barrelSegmentCount` | 12 |
| Shedfelder | `sawtooth_count` | `sawtoothCount` | 3 |
| Shedneigung | `sawtooth_pitch_deg` | `sawtoothPitchDeg` | 35° |

## 2. Aufbau der WorldEdit-Befehle

Die Werkzeuge liegen in
`services/vectoplan-editor/src/frontend/world_edit/systems/`. Jeder
Werkzeugordner besitzt ein eigenes `system.ts` und eine `README.md`. Größere,
zustandslose Berechnungen liegen daneben in `geometry.ts` oder `contracts.ts`.

| Pfad | Aufgabe |
| --- | --- |
| `systems/contracts.ts` | gemeinsamer Werkzeug- und Hook-Vertrag |
| `systems/registry.ts` | vollständige Registrierung und Aliasauflösung |
| `world_edit_controller.ts` | Composition Root für Szene, Eingaben und Chunk-Commands |
| `systems/polygon_area/` | gemeinsame Polygonvalidierung, Fläche, Grenzen und Selbstschnittprüfung |
| `systems/roof/` | Dachinteraktion und Übersetzung zum CAD-Dachvertrag |
| `systems/room/` | Rauminteraktion und persistente Raumobjekte |
| `scene/roof_calculation_rendering.ts` | 3D-Meshes für Dachhaut, Sparren und Pfetten |
| `scene/scene_runtime.ts` | Laden persistierter `building_roof`-Objekte |

Die sichtbaren Werkzeugkarten und Einstellfelder sind absichtlich Teil des
eingebetteten Creative Inventory in `services/vectoplan-library`, insbesondere
`static/js/inventar/creative-library.js` und
`templates/inventar/creative-inventar.html`. Einstellungen werden als
`vectoplan:creative-world-edit-settings` an den Editor übertragen.

## 3. Dachwerkzeug

1. Linksklick setzt Block-Eckpunkte; die Kanten bleiben gerade.
2. Klick auf den ersten Punkt, `Escape` oder `Enter` schließt die Kontur.
3. Nur eine gültige Fläche mit mindestens drei Punkten wird farbig gefüllt.
4. Ein Punkt unter dem Fadenkreuz wird gelb und kann mit gedrückter linker
   Maustaste blockweise verschoben werden.
5. Rechtsklick auf einen Punkt entfernt ihn.
6. Jede Kontur- oder Parameteränderung ruft die CAD-Dachberechnung neu auf und
   ersetzt die 3D-Vorschau.
7. Rechtsklick außerhalb eines Punktes oder **Ausführen** persistiert das Dach.

Persistiert wird ein `PlaceObject` mit `objectTypeId: building_roof`, stabiler
`objectInstanceId`, exaktem Polygon-Footprint sowie `roofParameters`,
`roofRequest` und `roofCalculation`. Das Chunk-Update ersetzt bei derselben ID
die Geometrie und Metadaten, solange die semantische Ankerzelle gleich bleibt.

Ein in CAD erzeugtes Dach verwendet den Command `create_roof`. Punkt- und
Parameteränderungen eines persistenten Dachs verwenden `update_roof` mit der
stabilen `objectInstanceId` und ursprünglichen Ankerzelle. Der Weg ist:

`CAD → Core cad_to_chunk → Chunk building_roof → Construction Recognition → Core construction_to_2d → CAD`

Damit stammen 2D und 3D aus demselben gespeicherten Objekt. Die 3D-Szene baut
aus der gespeicherten Berechnung erneut Dachhaut, Sparren und Pfetten auf.

## 4. Raumwerkzeug

Das Raumwerkzeug benutzt dieselbe gerade Polygoninteraktion wie das Dach, aber
keinen Dachrechner. Nach dem Schließen wird ein `PlaceObject` mit
`objectTypeId: space_room`, stabiler ID, Raumtyp, Bezeichnung, Höhe und exaktem
Polygon gespeichert. Bestehende Räume können ausgewählt, an ihren Eckpunkten
verschoben und mit Rechtsklick gelöscht werden. In CAD wird die tatsächliche
Polygonfläche statt der Fläche des umschließenden Rechtecks berechnet; der
Flächenschwerpunkt dient als Beschriftungspunkt.

## 5. Prüfungen

- CAD: `python -m pytest -q`
- Editor-Systeme: `npm run test:world-edit-systems`
- Editor-Typen: `npm run typecheck`
- Editor-Bundle: `npm run build` mit Node.js 20.19+ oder 22.12+
