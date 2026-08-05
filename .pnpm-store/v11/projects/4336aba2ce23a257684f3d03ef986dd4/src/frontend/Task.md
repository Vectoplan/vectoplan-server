# Task.md – `services/vectoplan-editor/src/frontend`

## Ziel dieses Dokuments

Diese Datei beschreibt die offenen Aufgaben für den Umbau des aktuellen `src/frontend` in Richtung **Library-/VPLIB-basierter Editor-Inventory- und Placement-Flow**.

Der Fokus liegt auf:

- welche Dateien geändert werden müssen,
- welche Dateien ersetzt oder später gelöscht werden können,
- warum diese Änderungen notwendig sind,
- welche Reihenfolge sinnvoll ist,
- welche technischen Akzeptanzkriterien gelten.

Dieses Dokument ergänzt die `IST-Zustand.md`. Die `IST-Zustand.md` beschreibt den aktuellen Zustand. Diese Datei beschreibt die daraus abgeleiteten nächsten Aufgaben.

---

## Architekturziel

Der Editor soll Library-/VPLIB-Items als fachliche Quelle für Hotbar, Inventory und Placement verwenden.

Die Zieltrennung lautet:

```text
Library / VPLIB
→ fachliche Objektidentität
→ familyId, packageId, vplibUid, variantId, revisionHash, placementCommand

Editor Frontend
→ Auswahl, Hotbar, Preview, Targeting, Input, UI, lokale Diagnose

Chunk Runtime
→ technische Runtime-Welt
→ runtimeBlockTypeId, cellValue, palette, dirty chunks, reload

Chunk Service
→ aktueller technischer Persistenz-/Runtime-Adapter
→ SetBlock(runtimeBlockTypeId), RemoveBlock

später Core
→ kanonische Projekt-/Command-Wahrheit
```

Wichtig:

```text
Nicht alles aus dem Chunk-System löschen.
Chunk bleibt für World, Rendering, Collision, Dirty Reload und temporären Runtime-Adapter.
Nur Hotbar, Inventory und fachliches Placement dürfen nicht mehr vom Chunk-Block-Katalog abhängen.
```

---

## Harte Regeln für den Umbau

1. **Aktive Runtime-Datei beachten**

   Die aktive Runtime liegt unter:

   ```text
   services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
   ```

   Nicht primär aktiv ist:

   ```text
   services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
   ```

2. **Library-Inventory läuft über Editor-Backend-Proxy**

   Der Browser ruft nicht direkt `vectoplan-library` auf.

   Zielroute:

   ```text
   GET /editor/api/inventory
   ```

3. **Hotbar-Wahrheit ist Library-/VPLIB-Inventory**

   Nicht mehr:

   ```text
   /editor/api/chunk/placeable-blocks
   ChunkApiClient.loadPlaceableBlocks()
   ChunkApiClient.loadBlocks()
   debug_grass / debug_dirt fallback
   ```

4. **Placement braucht Library-Kontext**

   Platzierung darf nicht mehr nur heißen:

   ```text
   SetBlock(blockTypeId)
   ```

   sondern mindestens:

   ```text
   PlaceLibraryItem
   runtimeBlockTypeId
   libraryRef
   placementCommand
   familyId
   vplibUid
   variantId
   ```

5. **`runtimeBlockTypeId` ist aktuell technischer Adapter**

   Solange der Chunk-Service nur blockbasierte Commands versteht:

   ```text
   PlaceLibraryItem
   → intern SetBlock(runtimeBlockTypeId)
   ```

   Die fachliche Identität muss trotzdem erhalten bleiben.

---

# Prioritäten

## P0 – Muss zuerst erledigt werden

Diese Punkte blockieren den durchgängigen Library-Pfad.

---

## P0.1 Aktive SceneRuntime auf Library-Placement umstellen

### Datei

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

### Aktueller Zustand

Die aktive Runtime platziert aktuell blockzentriert:

```text
placeBlock(position, blockTypeId)
→ worldRuntime.getSource().setBlock(position, blockTypeId, ...)
```

### Aufgabe

`placeBlock(...)` oder die entsprechende Place-Funktion muss Library-aware werden.

Sie soll aus dem Store lesen:

```text
selectedRuntimeBlockTypeId
selectedLibraryRef
selectedPlacementCommand
selectedFamilyId
selectedPackageId
selectedVplibUid
selectedVariantId
selectedRevisionHash
selectedSlotIndex
```

und dann aufrufen:

```text
worldRuntime.getSource().placeLibraryItem(position, placement, options)
```

### Warum

Die unteren Schichten können Library-Placement bereits abbilden. Die aktive SceneRuntime nutzt diesen Pfad aber noch nicht. Dadurch gehen `libraryRef` und `placementCommand` beim Klick verloren.

### Akzeptanzkriterien

- Linksklick auf gültiges Ziel ruft `placeLibraryItem(...)` auf, wenn ein Library-/VPLIB-Slot aktiv ist.
- `runtimeBlockTypeId` wird als technischer Chunk-Adapter verwendet.
- `libraryRef` und `placementCommand` werden an `ChunkSourceCommandOptions` oder PlacementInput weitergereicht.
- Ohne gültiges Library-/VPLIB-Item wird nicht platziert.
- Kein Fallback auf `debug_grass` oder `debug_dirt`.
- Remove bleibt weiterhin über `removeBlock(...)` funktionsfähig.

### Betroffene Imports

Voraussichtlich ergänzen:

```ts
selectActiveRuntimeBlockTypeId
selectActiveLibraryRef
selectActivePlacementCommand
selectSelectedFamilyId
selectSelectedPackageId
selectSelectedVplibUid
selectSelectedVariantId
selectSelectedRevisionHash
selectSelectedSlotIndex
selectSelectedInventoryItem
```

### Umsetzungshinweis

Zielstruktur:

```ts
function getActiveLibraryPlacement() {
  const state = store.peekState();
  return {
    runtimeBlockTypeId: selectActiveRuntimeBlockTypeId(state),
    libraryRef: selectActiveLibraryRef(state),
    placementCommand: selectActivePlacementCommand(state),
    familyId: selectSelectedFamilyId(state),
    packageId: selectSelectedPackageId(state),
    vplibUid: selectSelectedVplibUid(state),
    variantId: selectSelectedVariantId(state),
    revisionHash: selectSelectedRevisionHash(state),
    inventorySlotIndex: selectSelectedSlotIndex(state),
  };
}
```

Dann:

```ts
await worldRuntime.getSource().placeLibraryItem(
  position,
  placement,
  {
    reason: trigger,
    reloadDirtyChunks: true,
    requireLibraryIdentity: true,
  },
);
```

---

## P0.2 `world_runtime.ts` darf Hotbar nicht mehr aus Chunk-Blocks initialisieren

### Datei

```text
services/vectoplan-editor/src/frontend/runtime/world/world_runtime.ts
```

### Aktueller Zustand

`world_runtime.ts` lädt initial noch:

```text
source.loadPlaceableBlocks(...)
inventoryLoadedAction(...)
```

### Aufgabe

Diesen Pfad aus der normalen Hotbar-/Inventory-Initialisierung entfernen oder klar auf Diagnose/Legacy begrenzen.

### Warum

`WorldRuntime` soll Chunks, Collision und Dirty Reload besitzen. Sie soll nicht bestimmen, was in der Hotbar liegt. Das führt sonst zu Konkurrenz zwischen Chunk-Inventory und Library-Inventory.

### Akzeptanzkriterien

- `world_runtime.ts` lädt keine Hotbar-Wahrheit mehr über `loadPlaceableBlocks()`.
- Falls der Call für Diagnose bleibt, darf er nicht `inventoryLoadedAction(...)` als produktive Hotbar-Quelle dispatchen.
- Inventory wird über `inventory/editor-load-result`, `inventory/editor-state-loaded` oder `inventory/catalog-loaded` gesetzt.

---

## P0.3 LibraryInventorySource als Standardquelle sicherstellen

### Dateien

```text
services/vectoplan-editor/src/frontend/inventory/library_inventory_source.ts
services/vectoplan-editor/src/frontend/inventory/hotbar_controller.ts
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

### Aktueller Zustand

Es existiert bereits:

```text
library_inventory_source.ts
```

Der alte Pfad existiert parallel:

```text
chunk_inventory_source.ts
```

### Aufgabe

Sicherstellen, dass die aktive Runtime und/oder UI nicht mehr `createChunkInventorySource(...)` als Standard verwendet.

### Warum

`chunk_inventory_source.ts` lädt über `ChunkApiClient.loadBlocks()` und kann Legacy-/Chunk-Blockdaten in die Hotbar bringen. Das widerspricht dem Ziel “nur Library als Inventory-Wahrheit”.

### Akzeptanzkriterien

- Standard-Inventory-Quelle ist `/editor/api/inventory`.
- `chunk_inventory_source.ts` wird nicht mehr im normalen Boot-Pfad genutzt.
- Legacy-Chunk-Inventory ist nur mit explizitem Debug-/Legacy-Flag möglich.

---

## P0.4 `hotbar_controller.ts` syntaktisch und fachlich bereinigen

### Datei

```text
services/vectoplan-editor/src/frontend/inventory/hotbar_controller.ts
```

### Aktueller Zustand

Die analysierte Fassung enthielt beschädigte Import-/Textfragmente und wirkte nicht kompilierbar.

### Aufgabe

Datei bereinigen:

- defekte Textfragmente entfernen,
- doppelte Imports entfernen,
- Typimporte ordnen,
- nur eine Inventory-Quelle als Standard verwenden,
- `LibraryInventorySource` priorisieren.

### Warum

Ohne stabilen HotbarController ist die Brücke zwischen LibraryInventorySource, Store und UI fehleranfällig.

### Akzeptanzkriterien

- TypeScript kompiliert.
- HotbarController initialisiert Library-Inventory erfolgreich.
- Store erhält `inventory/catalog-loaded` oder `inventory/editor-load-result`.
- Debug-IDs `debug_grass` und `debug_dirt` werden blockiert.

---

## P0.5 Store-Auswahl als einzige Placement-Wahrheit verwenden

### Dateien

```text
services/vectoplan-editor/src/frontend/state/state_selectors.ts
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
services/vectoplan-editor/src/frontend/input/input_controller.ts
```

### Aktueller Zustand

Die Store-Selectors sind bereits Library-ready. Einige Runtime-Stellen lesen aber weiterhin `blockTypeId` oder `selectedBlockTypeId`.

### Aufgabe

Für Placement nur noch diese Werte als Auswahl-Wahrheit verwenden:

```text
selectActiveRuntimeBlockTypeId
selectActiveLibraryRef
selectActivePlacementCommand
selectSelectedPlacementRef
```

### Warum

`selectedBlockTypeId` ist zu ungenau. Für Library-Placement braucht der Editor die fachliche Identität.

### Akzeptanzkriterien

- Placement funktioniert über `runtimeBlockTypeId` + Library-Kontext.
- Kein Placement allein aufgrund eines Legacy-`blockTypeId`.
- Debug-Fallbacks bleiben verboten.

---

# P1 – Wichtige Folgearbeiten

Diese Punkte sind nicht der erste Blocker, sollten aber direkt nach P0 erledigt werden.

---

## P1.1 Bootstrap-Inventory von Chunk-Service auf Library-Inventory umstellen

### Dateien

```text
services/vectoplan-editor/src/frontend/bootstrap/bootstrap_models.ts
services/vectoplan-editor/src/frontend/bootstrap/default_bootstrap.ts
services/vectoplan-editor/src/frontend/bootstrap/normalize_bootstrap.ts
services/vectoplan-editor/src/frontend/bootstrap/read_bootstrap.ts
```

### Aktueller Zustand

Bootstrap enthält noch alte Defaults wie:

```text
inventory.source = chunk-service
inventoryRouteKind = placeable-blocks
creativeLibraryRouteKind = blocks
defaultBlockTypeId = debug_grass
fallbackBlockTypeIds = debug_grass/debug_dirt
```

### Aufgabe

Inventory-Bootstrap auf Library-/Editor-Inventory umstellen.

Zielwerte:

```text
inventory.source = editor-inventory oder library-service
inventory.apiUrl = /editor/api/inventory
onlyLibraryItemsPlaceable = true
debugGrassDirtAllowed = false
allowChunkPlaceableFallback = false
fallbackBlockTypeIds = []
defaultBlockTypeId = null oder leer
```

### Warum

Solange Bootstrap alte Chunk-Defaults setzt, können spätere Runtime-Teile wieder in die falsche Richtung gezogen werden.

### Akzeptanzkriterien

- Kein Bootstrap-Default auf `debug_grass` oder `debug_dirt`.
- Keine automatische Chunk-Inventory-Quelle im Default-Bootstrap.
- `/editor/api/inventory` ist als Standard-Inventory-Route abbildbar.

---

## P1.2 `config/runtime_config.ts` mittelfristig ablösen oder eingrenzen

### Datei

```text
services/vectoplan-editor/src/frontend/config/runtime_config.ts
```

### Aktueller Zustand

`runtime_config.ts` existiert parallel zum Bootstrap-System. `main.ts` nutzt beide Pfade:

```text
readRuntimeConfig(...)
readEditorBootstrap(...)
normalizeEditorBootstrap(...)
```

### Aufgabe

Prüfen, welche Felder wirklich noch benötigt werden. Dann entscheiden:

- behalten als dünne DOM-/Dataset-Leseschicht,
- oder in Bootstrap integrieren,
- oder Legacy markieren.

### Warum

Zwei Konfigurationswahrheiten erschweren Library-Flags und Debug-Fallbacks.

### Akzeptanzkriterien

- Klar dokumentiert, welche Config-Schicht führend ist.
- Inventory-/Library-Flags sind nicht doppelt widersprüchlich definiert.

---

## P1.3 `input_controller.ts` PlacementIntent erweitern

### Datei

```text
services/vectoplan-editor/src/frontend/input/input_controller.ts
```

### Aktueller Zustand

Input erzeugt noch einen blockzentrierten Intent:

```text
position
blockTypeId
sourceCell
placementCell
```

### Aufgabe

Placement-Intent erweitern:

```text
runtimeBlockTypeId
libraryRef
placementCommand
familyId
packageId
vplibUid
variantId
revisionHash
inventorySlotIndex
```

### Warum

Input sollte nicht fachliche Library-Daten wegwerfen. Auch wenn die SceneRuntime die finale Ausführung macht, muss der Intent korrekt sein.

### Akzeptanzkriterien

- `onPlaceBlock` wird entweder durch `onPlaceItem`/`onPlaceLibraryItem` ergänzt oder intern mit Library-Kontext aufgerufen.
- Legacy-`blockTypeId` bleibt nur Alias für `runtimeBlockTypeId`.

---

## P1.4 Doppelte Pointer-/Mouse-Place-Events verhindern

### Dateien

```text
services/vectoplan-editor/src/frontend/input/input_controller.ts
services/vectoplan-editor/src/frontend/input/mouse_input.ts
```

### Aktueller Zustand

Es gibt mehrere mögliche Eventquellen für dieselbe Aktion:

```text
onPrimaryDown
onPrimaryClick
direct pointer fallback
mousedown fallback
```

### Aufgabe

Nur eine echte Place-/Remove-Quelle pro Klick zulassen.

### Warum

Doppelte Events können doppelte Commands erzeugen. Bei Library-Placement wäre das besonders problematisch, weil mehrere identische VPLIB-Platzierungen ausgelöst werden könnten.

### Akzeptanzkriterien

- Ein Linksklick erzeugt maximal ein Placement-Command.
- Ein Rechtsklick erzeugt maximal ein Remove-Command.
- PointerLock-Aktivierung erzeugt kein zusätzliches Placement.

---

## P1.5 `targeting` von `blockTypeId` auf `runtimeBlockTypeId` erweitern

### Dateien

```text
services/vectoplan-editor/src/frontend/targeting/target_models.ts
services/vectoplan-editor/src/frontend/targeting/chunk_targeting.ts
```

### Aktueller Zustand

Targeting hält `activeBlockTypeId` und `PlacementTarget.blockTypeId`.

### Aufgabe

Kurzfristig dokumentieren:

```text
activeBlockTypeId = runtimeBlockTypeId
```

Mittelfristig Typen erweitern:

```text
activeRuntimeBlockTypeId
runtimeBlockTypeId
libraryRef
placementCommand
```

### Warum

Targeting muss nicht die ganze Library kennen, aber die Benennung soll nicht länger fachlich falsch sein.

### Akzeptanzkriterien

- Targeting validiert Placement gegen `runtimeBlockTypeId`.
- UI/Preview kann später Library-Diagnose anzeigen.

---

## P1.6 Hotbar-DOM offiziell Library-aware machen

### Dateien

```text
services/vectoplan-editor/src/frontend/dom/dom_refs.ts
services/vectoplan-editor/src/frontend/ui/hotbar_view.ts
```

### Aktueller Zustand

`hotbar_view.ts` gibt bereits Library-Felder an `renderDomHotbarSlots()` weiter, aber `HotbarSlotRenderInput` war ursprünglich blockzentriert.

### Aufgabe

`HotbarSlotRenderInput` erweitern:

```text
runtimeBlockTypeId
libraryItemId
familyId
packageId
vplibUid
variantId
revisionHash
sourceKind
itemKind
enabled
libraryRef optional
placementCommand optional
```

### Warum

Die DOM-Schicht soll den IST-Zustand korrekt abbilden und nicht nur `blockTypeId` kennen.

### Akzeptanzkriterien

- DOM-Datasets zeigen Library-/VPLIB-Identität pro Slot.
- Hotbar-ARIA/Title beschreibt Library-Item statt Debug-Block.
- Keine Debug-Block-ID wird gerendert.

---

## P1.7 UI-Texte von Block auf Library/VPLIB ändern

### Dateien

```text
services/vectoplan-editor/src/frontend/ui/status_bar.ts
services/vectoplan-editor/src/frontend/ui/loading_overlay.ts
services/vectoplan-editor/src/frontend/ui/debug_overlay.ts
services/vectoplan-editor/src/frontend/dom/dom_refs.ts
```

### Aktueller Zustand

Mehrere UI-Texte sprechen noch von:

```text
Block
Blocktyp
kein Block
Blocktypen werden geladen
```

### Aufgabe

Auf Library-/VPLIB-Begriffe umstellen:

```text
Library-/VPLIB-Item
Runtime-Blocktyp
kein Library-/VPLIB-Item
Library-Inventar wird geladen
```

### Warum

Die UI soll das fachliche Zielmodell widerspiegeln und nicht den alten Debug-Block-Editor.

### Akzeptanzkriterien

- Hotbar, Loading Overlay, Status Bar und Debug Overlay verwenden Library-Begriffe.
- `runtimeBlockTypeId` darf als technischer Begriff sichtbar sein, aber nicht als fachliche Wahrheit verkauft werden.

---

## P1.8 Debug Overlay um Library-Diagnose erweitern

### Datei

```text
services/vectoplan-editor/src/frontend/ui/debug_overlay.ts
```

### Aktueller Zustand

Debug Overlay zeigt Runtime, World, Command, Target, Camera und Inventory-Count, aber wenig Library-Details.

### Aufgabe

Zusätzliche Zeilen ergänzen:

```text
Inventory source
Selected runtimeBlockTypeId
Selected familyId
Selected packageId
Selected vplibUid
Selected variantId
Selected placementCommand.kind
Library item count
```

### Warum

Während der Migration muss sichtbar sein, ob wirklich Library-Inventory aktiv ist.

### Akzeptanzkriterien

- Debug Overlay zeigt aktive Library-Auswahl.
- Debug Overlay zeigt, wenn kein gültiges Library-Item ausgewählt ist.

---

# P2 – Aufräumen, Konsolidieren, Löschen

Diese Punkte können nach erfolgreicher Library-Integration erledigt werden.

---

## P2.1 `chunk_inventory_source.ts` umbenennen oder aus Standardpfad entfernen

### Datei

```text
services/vectoplan-editor/src/frontend/inventory/chunk_inventory_source.ts
```

### Aktueller Zustand

Alter Inventory-Source-Pfad über ChunkApiClient.

### Aufgabe

Eine der folgenden Optionen wählen:

```text
A) umbenennen in legacy_chunk_inventory_source.ts
B) behalten, aber nur mit explizitem Debug-/Legacy-Flag nutzbar machen
C) löschen, sobald keine Imports mehr existieren
```

### Warum

Der Name suggeriert aktuell eine normale Inventory-Quelle. Für das Ziel ist sie Legacy.

### Akzeptanzkriterien

- Kein produktiver Import im Standard-Boot.
- Keine automatische Hotbar aus Chunk-Blocks.
- Klare Dokumentation als Legacy/Debug.

---

## P2.2 `chunk_api_client.loadBlocks()` und `loadPlaceableBlocks()` fachlich zurückstufen

### Dateien

```text
services/vectoplan-editor/src/frontend/api/chunk_api_client.ts
services/vectoplan-editor/src/frontend/api/chunk_api_models.ts
services/vectoplan-editor/src/frontend/api/chunk_api_normalize.ts
```

### Aktueller Zustand

Diese APIs werden historisch für Creative Library / Inventory / Hotbar genutzt.

### Aufgabe

In Code und Kommentaren klarstellen:

```text
loadBlocks = Legacy/Diagnose/Chunk-Palette
loadPlaceableBlocks = Legacy/Debug-Fallback
nicht fachliche Library-/Hotbar-Wahrheit
```

### Warum

Chunk API bleibt für World und Commands wichtig, aber nicht für Inventory-Fachlichkeit.

### Akzeptanzkriterien

- Keine neuen produktiven Hotbar-Imports aus diesen Methoden.
- Debug-Fallback nur explizit.

---

## P2.3 `CHUNK_API_DEFAULT_PLACEABLE_BLOCKS` entfernen oder debug-only machen

### Datei

```text
services/vectoplan-editor/src/frontend/api/chunk_api_models.ts
```

### Aktueller Zustand

Enthält Debug-Fallbacks wie:

```text
debug_grass
debug_dirt
```

### Aufgabe

Entweder entfernen oder in eine explizite Debug-Testdatei verschieben.

### Warum

Diese IDs dürfen nicht mehr als normale Editor-Hotbar auftauchen.

### Akzeptanzkriterien

- Produktive Inventory-Normalisierung kann diese Werte nicht mehr als Auswahl setzen.
- Tests können Debug-Blöcke nur explizit importieren.

---

## P2.4 Alte `runtime/scene/scene_runtime.ts` prüfen

### Datei

```text
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

### Aktueller Zustand

Es gibt eine zweite größere SceneRuntime neben der aktiven:

```text
src/frontend/scene/scene_runtime.ts
```

### Aufgabe

Imports prüfen:

```bash
rg -n "runtime/scene/scene_runtime|@runtime/scene/scene_runtime|createSceneRuntime" services/vectoplan-editor/src/frontend
```

Dann entscheiden:

```text
A) löschen, wenn ungenutzt
B) als experimentelle Runtime dokumentieren
C) später konsolidieren
```

### Warum

Doppelte Runtime-Dateien erhöhen die Gefahr, Änderungen in der falschen Datei zu machen.

### Akzeptanzkriterien

- Eindeutige aktive Runtime dokumentiert.
- Keine tote oder irreführende Parallelruntime im Standardpfad.

---

## P2.5 `camera/first_person_camera.ts` prüfen

### Datei

```text
services/vectoplan-editor/src/frontend/camera/first_person_camera.ts
```

### Aktueller Zustand

Überschneidet sich wahrscheinlich mit:

```text
camera/first_person_camera_controller.ts
```

### Aufgabe

Imports prüfen:

```bash
rg -n "createFirstPersonCamera|FirstPersonCameraHandle|first_person_camera" services/vectoplan-editor/src/frontend
```

Wenn ungenutzt: löschen.

### Warum

Doppelte Kamera-Controller erschweren Runtime-Verständnis.

### Akzeptanzkriterien

- Nur eine produktive First-Person-Camera-Architektur bleibt.

---

## P2.6 `config/runtime_config.ts` und Bootstrap konsolidieren

### Datei

```text
services/vectoplan-editor/src/frontend/config/runtime_config.ts
```

### Aufgabe

Nach P0/P1 entscheiden, ob diese Datei weiter existieren soll.

Mögliche Zielzustände:

```text
A) bleibt als dünner Dataset/Window-Reader
B) wird vollständig durch bootstrap/* ersetzt
C) wird als Legacy markiert und nicht erweitert
```

### Warum

Zwei parallele Konfigurationssysteme sind langfristig fehleranfällig.

---

# Test- und Validierungsaufgaben

## T1 TypeScript Build

### Ziel

Alle betroffenen Dateien müssen kompilieren.

### Prüfen

```bash
pnpm typecheck
# oder projektinternes Äquivalent
```

### Akzeptanzkriterien

- Keine TypeScript-Fehler.
- Besonders prüfen:
  - `hotbar_controller.ts`
  - `scene/scene_runtime.ts`
  - `chunk_service_source.ts`
  - `chunk_edit_session.ts`

---

## T2 Boot-Smoke-Test

### Ziel

Editor startet weiterhin.

### Prüfen

```text
/editor lädt
Canvas sichtbar
Chunk-Service verbunden
Initial chunks sichtbar
Hotbar sichtbar
keine Fatal Error UI
```

---

## T3 Library-Inventory-Smoke-Test

### Ziel

Hotbar kommt aus `/editor/api/inventory`.

### Prüfen

```text
GET /editor/api/inventory erfolgreich
Store inventory.source = library/editor-inventory
Hotbar zeigt VPLIB-Item
debug_grass/debug_dirt nicht sichtbar
selectedRuntimeBlockTypeId gesetzt
selectedLibraryRef gesetzt
selectedPlacementCommand gesetzt
```

---

## T4 Library-Placement-Smoke-Test

### Ziel

Ein Library-/VPLIB-Item kann platziert werden.

### Prüfen

```text
gültiges Target
Linksklick
placeLibraryItem(...) wird aufgerufen
intern SetBlock(runtimeBlockTypeId) möglich
Command result applied/noop
Dirty chunks werden geladen
Scene rendert aktualisierten Chunk
Reload zeigt platziertes Item weiterhin
```

---

## T5 Kein Legacy-Fallback-Smoke-Test

### Ziel

Ohne Library-Inventory gibt es keine automatische Debug-Hotbar.

### Prüfen

```text
/editor/api/inventory leer oder fehlerhaft
Hotbar bleibt leer/degraded
kein debug_grass
kein debug_dirt
kein Place ohne Library-Item
```

---

## T6 Doppel-Click-Test

### Ziel

Ein Klick erzeugt nur ein Command.

### Prüfen

```text
1 Linksklick = 1 command-sent
1 Rechtsklick = 1 remove command
PointerLock-Aktivierung erzeugt kein Placement
```

---

# Empfohlene Reihenfolge

```text
1. hotbar_controller.ts reparieren
2. aktive scene/scene_runtime.ts auf placeLibraryItem umbauen
3. world_runtime.ts Inventory-Initialisierung aus Chunk-Blocks entfernen
4. Bootstrap-Inventory-Defaults auf /editor/api/inventory umstellen
5. input_controller.ts PlacementIntent erweitern und Doppel-Events bereinigen
6. targeting Begriffe runtimeBlockTypeId/libraryPlacement nachziehen
7. UI-Texte und Debug Overlay aktualisieren
8. Legacy-Dateien umbenennen/löschen
9. Typecheck + Smoke-Tests
10. IST-Zustand.md aktualisieren
```

---

# Dateiübersicht nach Änderungsart

## Ändern – P0/P1

```text
scene/scene_runtime.ts
runtime/world/world_runtime.ts
inventory/hotbar_controller.ts
input/input_controller.ts
bootstrap/bootstrap_models.ts
bootstrap/default_bootstrap.ts
bootstrap/normalize_bootstrap.ts
bootstrap/read_bootstrap.ts
targeting/chunk_targeting.ts
targeting/target_models.ts
ui/debug_overlay.ts
ui/status_bar.ts
ui/loading_overlay.ts
dom/dom_refs.ts
```

## Behalten – Kerninfrastruktur

```text
api/editor_inventory_api_client.ts
api/editor_inventory_models.ts
api/editor_inventory_normalize.ts
inventory/library_inventory_source.ts
inventory/inventory_models.ts
inventory/inventory_selection.ts
inventory/inventory_slot_factory.ts
runtime/world/chunk_source.ts
runtime/world/chunk_service_source.ts
runtime/world/chunk_edit_session.ts
runtime/world/chunk_loader.ts
runtime/world/chunk_registry.ts
runtime/world/chunk_content.ts
runtime/world/chunk_coordinates.ts
state/editor_state.ts
state/state_actions.ts
state/state_selectors.ts
state/editor_store.ts
ui/hotbar_view.ts
ui/editor_ui_runtime.ts
main.ts
```

## Legacy / später löschen oder umbenennen

```text
inventory/chunk_inventory_source.ts
runtime/scene/scene_runtime.ts
camera/first_person_camera.ts
config/runtime_config.ts   # nur nach Architekturentscheidung
```

## Nicht löschen

```text
api/chunk_api_client.ts
api/chunk_api_models.ts
api/chunk_api_errors.ts
api/chunk_api_normalize.ts
api/http_client.ts
```

Begründung:

```text
Diese Dateien werden weiter für Chunk-World, Chunk-Loading, Commands,
Dirty Reload und Runtime-Adapter gebraucht. Nur ihre Rolle als Inventory-/Hotbar-
Quelle muss zurückgebaut werden.
```

---

# Definition of Done für Library-Migration im Frontend

Die Migration gilt für `src/frontend` als abgeschlossen, wenn:

```text
1. Hotbar lädt standardmäßig über /editor/api/inventory.
2. Store enthält aktive Library-Auswahl mit runtimeBlockTypeId, libraryRef und placementCommand.
3. Linksklick verwendet placeLibraryItem(...).
4. Chunk-Service bekommt weiterhin kompatible SetBlock-Commands mit runtimeBlockTypeId.
5. Library-Kontext bleibt in EditSession/Command-History erhalten.
6. debug_grass/debug_dirt erscheinen nicht mehr in Hotbar oder produktivem Inventory.
7. WorldRuntime lädt Chunks, aber kein Hotbar-Inventory mehr aus Chunk-Blocks.
8. UI spricht von Library-/VPLIB-Items, nicht mehr von Debug-Blöcken.
9. TypeScript kompiliert.
10. Place, Remove, Reload, Dirty Chunks, Collision und Rendering funktionieren weiter.
```
