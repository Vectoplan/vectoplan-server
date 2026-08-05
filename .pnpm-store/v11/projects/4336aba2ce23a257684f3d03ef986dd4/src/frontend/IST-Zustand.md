# IST-Zustand `services/vectoplan-editor/src/frontend`

Stand: 2026-06-07  
Scope: aktueller Frontend-Code des `vectoplan-editor` unter `services/vectoplan-editor/src/frontend`

Dieses Dokument beschreibt den aktuellen Aufbau, die Ordner- und Dateistruktur, die Aufgaben der einzelnen Dateien und die wichtigsten Zusammenhänge der Runtime. Der Fokus liegt bewusst auf dem **IST-Zustand**: Was ist vorhanden, welche Datei übernimmt welche Rolle, welche Pfade sind aktiv, welche Schichten greifen ineinander und welche Teile funktionieren bereits zusammen.

---

## Aktualisierung 2026-07-28: Realtime-Avatare und Environment-System

Die aktive Runtime `scene/scene_runtime.ts` integriert jetzt zusätzlich:

- `scene/realtime_client.ts`: reconnectender WebSocket-Client, Heartbeat, Präsenz und Welt-Invalidierungen
- `scene/remote_avatar_scene.ts`: prozedurale Remote-Avatare, Namensschilder, Interpolation und Laufanimation
- `render/environment_system.ts`: Three.js `Sky`, astronomischer Sonnenstand, dynamisches Licht/Schatten und Tageszeit-UI

Die Realtime-Schicht ersetzt weder `WorldRuntime` noch `vectoplan-chunk`. Nach fremden Änderungen werden nur Chunk-Keys als schmutzig markiert und anschließend wieder aus der kanonischen Quelle geladen.

## Aktualisierung 2026-07-28: Generator-Preview-Runtime

`main.ts` wählt anhand von `[data-editor-generator-preview]` zwischen zwei Laufzeiten:

```text
regulärer Editor -> bootVectoplanEditor()
Generator-Route  -> generator_preview/generator_preview_runtime.ts
```

Die Generator-Laufzeit:

- erstellt eine eigenständige Three.js-Szene mit First-Person-Kamera
- verwendet `render/environment_system.ts` für Himmel, Sonne und Schatten
- rendert Primitive oder hochgeladene GLB/GLTF/OBJ/STL/FBX-Modelle
- übernimmt Live-Daten und `File`-Objekte per `postMessage`
- importiert absichtlich keine Chunk-, Inventory- oder Realtime-Runtime

Der Nachrichtenvertrag heißt `vectoplan-generator-preview.v1`.

## 0. Aktualisierung: aktueller Arbeitsstand der Library-/VPLIB-Migration

Dieses Dokument wurde erweitert, um nicht nur den strukturellen IST-Zustand des Frontends zu beschreiben, sondern auch den **aktuellen Arbeitsstand der laufenden Umstellung**:

```text
alte Chunk-/Block-Hotbar
→ neue Editor-Inventory-Route /editor/api/inventory
→ Library-/VPLIB-only Hotbar
→ Placement über Library-/VPLIB-Kontext
→ technischer Adapter weiterhin runtimeBlockTypeId / SetBlock
```

Der aktuelle Schwerpunkt ist nicht mehr das grundsätzliche Verstehen des Systems, sondern die **kompilierbare Integration** der neuen Library-/VPLIB-Schicht in den Editor. Der Docker-Build bricht aktuell weiterhin im Frontend-Typecheck ab, aber die Fehlerliste wurde bereits stark reduziert. Viele der früheren Drift-Probleme sind behoben oder vorbereitet.

### 0.1 Was wir gerade konkret machen

Wir reparieren Datei für Datei den TypeScript-Vertrag, der durch die Library-/VPLIB-Migration entstanden ist. Die fachliche Richtung ist festgelegt:

```text
1. Creative Library / VPLIB ist die einzige fachliche Quelle für platzierbare Items.
2. Der Browser ruft nicht direkt vectoplan-library auf.
3. Der Browser nutzt /editor/api/inventory für Hotbar-/Inventory-Daten.
4. Chunk-Blocklisten sind nur noch Legacy/Diagnose.
5. Placement braucht:
   - runtimeBlockTypeId als technischen Chunk-Service-Adapter
   - Library-Identität als fachliche Wahrheit
   - optional PlacementCommand / LibraryRef
6. debug_grass und debug_dirt dürfen nicht als platzierbare Items auftauchen.
```

Das Ziel ist ein Build, bei dem TypeScript wieder grün ist und die Runtime danach stabil bootet.

### 0.2 Aktueller Build-Status

Der aktuelle Docker-Build erreicht weiterhin den Schritt:

```text
vectoplan-editor frontend-builder 11/11
→ npm run typecheck
→ tsc --noEmit --project tsconfig.json
```

Der Editor-Container scheitert also weiterhin **vor dem eigentlichen Runtime-Start**. Es ist kein Browser-Runtime-Fehler, sondern ein TypeScript-Compile-Fehler.

Die Fehlerliste ist inzwischen deutlich kleiner. Bereits adressierte Fehlerbereiche:

```text
✓ routeHints im ChunkApiClient erweitert
✓ placeable:true Literal-Typen im ChunkApiClient stabilisiert
✓ EditorInventoryLoadResult robuster diskriminierbar gemacht
✓ editor_inventory_api_client.ts Fehlerzugriffe/console-Zugriffe repariert
✓ editor_inventory_normalize.ts Import-/unknown-Probleme repariert
✓ inventory_slot_factory.ts LoadResult-Union vorbereitet
✓ library_inventory_source.ts LoadResult-/HotbarSource-kompatibel repariert
✓ bootstrap_models.ts Creative-Library-Dataset-Felder ergänzt
✓ editor_inventory_models.ts doppelte Window-Global-Deklaration repariert
✓ chunk_inventory_source.ts domSlots/objectKind repariert
✓ hotbar_controller.ts RuntimePlaceable-Pflichtfelder repariert
✓ chunk_service_source.ts optionales libraryContext über unknown-Cast vorbereitet
```

Aktuell verbliebene bzw. zuletzt sichtbare Problemgruppen:

```text
1. config/runtime_config.ts
   - inventoryForceRefresh-Key fehlt noch in einem aktuellen Stand
   - DEFAULT_CHUNK_PROXY_BASE_URL Literal-Typ ist an einer Stelle zu eng

2. inventory/hotbar_controller.ts
   - in älteren Build-Logs war selectSlot auf Union-Source nicht sauber eingegrenzt
   - in der zuletzt generierten Datei wurde das über Funktionschecks abgefangen

3. inventory/inventory_slot_factory.ts
   - objectKind auf HotbarSlot muss defensiv über Record-Zugriff gelesen werden

4. runtime/world/chunk_service_source.ts
   - libraryContext ist nicht Teil der strikten ChunkApiCommandPayload-Union
   - Lösung: expliziter unknown-Cast nur im optionalen Metadata-Pfad

5. scene/scene_runtime.ts
   - LibraryInventorySource ist lokal zu schwach typisiert
   - sie muss als HotbarInventorySourceHandle/LibraryInventorySourceHandle nutzbar bleiben

6. state/editor_store.ts
   - viele Record-Zugriffe werden von TypeScript als {} gesehen
   - Lösung: lokale Records klar als Record<string, unknown> typisieren
```

### 0.3 Wichtigste Architekturentscheidung der laufenden Arbeit

Die neue Editor-Hotbar darf nicht mehr aus Chunk-Blocklisten entstehen. Der verbindliche Datenfluss ist:

```text
vectoplan-library
→ serverseitiger Editor-Proxy
→ /editor/api/inventory
→ editor_inventory_api_client.ts
→ editor_inventory_normalize.ts
→ library_inventory_source.ts
→ inventory_slot_factory.ts
→ hotbar_controller.ts
→ EditorState.inventory
→ Input/Scene/Placement
```

Chunk-Blocks bleiben vorhanden, aber nur noch so:

```text
/editor/api/chunk/blocks
/editor/api/chunk/placeable-blocks
→ legacy diagnostic only
→ nicht produktive Hotbar-Wahrheit
```

### 0.4 Aktuelle technische Übergangsrealität

Der Chunk-Service versteht aktuell technisch weiterhin Block-/Runtime-Blocktypen. Deshalb bleibt `runtimeBlockTypeId` als Adapter erhalten:

```text
fachlich:
LibraryRef / PlacementCommand / familyId / vplibUid / variantId

technisch:
runtimeBlockTypeId

Chunk-Service-Command:
SetBlock(position, blockTypeId = runtimeBlockTypeId)
```

Das bedeutet: Der Editor platziert fachlich ein VPLIB-/Library-Item, sendet aber an den Chunk-Service weiterhin einen kompatiblen `SetBlock`-Command. Der zusätzliche Library-Kontext bleibt in Source/Event/EditSession/Snapshots erhalten und wird standardmäßig nicht ungeprüft in den HTTP-Command geschrieben.

### 0.5 Was beim weiteren Arbeiten wichtig bleibt

Bei jeder Datei gilt:

```text
- nicht zurück auf debug_grass/debug_dirt
- keine Browser-Direktcalls zu vectoplan-library
- /editor/api/inventory bleibt produktiver Hotbar-Pfad
- Chunk-Inventory bleibt Legacy/Diagnose
- runtimeBlockTypeId ist technischer Adapter, nicht fachliche Identität
- LibraryRef / PlacementCommand bleiben fachliche Identität
- Fehler lieber fail-closed / fallback-empty als falsche platzierbare Items
```

---

## 1. Gesamtverständnis des Frontends

Das Frontend ist aktuell eine browserbasierte 3D-Editor-Runtime. Es ist keine reine UI-Shell, sondern enthält eine vollständige Laufzeitumgebung für:

- Bootstrap und Runtime-Konfiguration
- Remote-Chunk-Service-Anbindung
- World-/Chunk-Laden und Registry
- Three.js-Rendering
- First-Person-Kamera
- Player-Physics und Collision
- Input-Verarbeitung
- Targeting/Raycasting
- Hotbar und Inventory
- Store/State-Verwaltung
- UI-Komponenten wie Statusbar, Loading, Error, Crosshair, Hotbar und Debug Overlay

Die fachliche Richtung ist bereits an mehreren Stellen Library-/VPLIB-ready. Gleichzeitig gibt es noch funktionierende Legacy-/Chunk-Inventory-Pfade. Der aktuelle produktive World-/Placement-Adapter läuft weiterhin über Runtime-Blocktypen und Chunk-Commands.

Der wichtigste aktuelle Architekturpunkt:

```text
main.ts
→ Bootstrap lesen und normalisieren
→ EditorStore erzeugen
→ ChunkApiClient erzeugen
→ WorldRuntime erzeugen
→ aktive SceneRuntime erzeugen
→ SceneRuntime.initialize()
→ Browser-Runtime läuft
```

---

## 2. Aktive Runtime-Datei

Die aktive Scene-Runtime liegt aktuell hier:

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

Das wird durch `main.ts` bestätigt, weil dort importiert wird:

```ts
import { createSceneRuntime } from "@scene/scene_runtime";
```

Damit ist diese Datei aktuell der produktive Einstieg für die Browser-Szene.

Daneben existiert zusätzlich ein modularerer Runtime-Scene-Ordner:

```text
services/vectoplan-editor/src/frontend/runtime/scene/
```

Dieser enthält Infrastruktur wie `scene_lifecycle.ts`, `scene_loop.ts`, `scene_world_bridge.ts`, `scene_chunk_tools.ts` und eine weitere `scene_runtime.ts`. Diese Dateien beschreiben eine stärkere Zerlegung der Runtime, sind aber nach aktuellem Einstiegspunkt nicht die primäre aktive SceneRuntime.

---

## 3. Grobe Ordnerstruktur

```text
src/frontend/
├── api/
├── bootstrap/
├── camera/
├── config/
├── dom/
├── input/
├── inventory/
├── render/
├── runtime/
│   ├── physics/
│   ├── scene/
│   └── world/
├── scene/
├── state/
├── targeting/
├── ui/
├── utils/
└── main.ts
```

### Kurzrolle der Hauptordner

| Ordner | Rolle im aktuellen System |
|---|---|
| `api/` | HTTP-/API-Clients für Chunk-Service und Editor-Inventory/Library-Inventory. |
| `bootstrap/` | Typen, Defaults, Lesen und Normalisierung des Editor-Bootstraps. |
| `camera/` | Kamera-Zustand, First-Person-Kamera und Bewegungsmathematik. |
| `config/` | ältere RuntimeConfig-Schicht neben dem Bootstrap-System. |
| `dom/` | DOM-Referenzen, Canvas-/Overlay-/Hotbar-Elemente und Resize-Observer. |
| `input/` | Keyboard, Mouse, Pointer Lock, Input-State und Input-Orchestrierung. |
| `inventory/` | Inventory-/Hotbar-Domain, Library- und Legacy-Inventory-Quellen. |
| `render/` | Three.js-Kontext, Chunk-Meshing, Preview und Debug-Rendering. |
| `runtime/physics/` | Player-Physics, AABB, Collision, Flight und Movement. |
| `runtime/world/` | Chunk-Content, Registry, Loader, Source, Edit-Session und WorldRuntime. |
| `runtime/scene/` | modulare Scene-Orchestrierung und Infrastruktur. |
| `scene/` | aktive SceneRuntime des Editors. |
| `state/` | globaler EditorState, Store, Actions, Selectors und Player-State. |
| `targeting/` | Raycast, Target-Modelle und ChunkTargeting. |
| `ui/` | Store-getriebene UI-Komponenten und UI-Runtime. |
| `utils/` | IDs, Logging, sichere Werte, Pfad-Lesen und Zeit-Helfer. |
| `main.ts` | Boot-Einstieg des Frontends. |

---

## 4. Hauptdatenflüsse im IST-Zustand

### 4.1 Boot-Fluss

```text
main.ts
→ resolveRootElement()
→ readRuntimeConfig()
→ installRuntimeConfigWindowGlobals()
→ bindEditorDomRefs()
→ readEditorBootstrap()
→ normalizeEditorBootstrap()
→ createInitialEditorState()
→ createEditorStore()
→ createChunkApiClient()
→ createWorldRuntime()
→ createSceneRuntime()
→ sceneRuntime.initialize()
→ RuntimeHandle wird auf window installiert
```

`main.ts` validiert, dass der Editor remote-chunk-only läuft. Lokale und Legacy-Fallback-Welten werden im aktuellen Boot-Pfad nicht akzeptiert.

### 4.2 World-/Chunk-Fluss

```text
WorldRuntime
→ ChunkServiceSource
→ ChunkApiClient
→ /editor/api/chunk
→ vectoplan-chunk
→ ChunkSnapshot / ChunkEvent / WorldCommandLog
→ RuntimeChunkContent
→ ChunkRegistry
→ SceneRuntime rendert sichtbare Chunks
```

Die lokale Browser-Wahrheit über geladene Chunks liegt in `ChunkRegistry`. Die persistente World-Wahrheit liegt nicht im Browser, sondern im Chunk-Service.

### 4.3 Aktueller Place-/Remove-Fluss

Im aktiven Runtime-Pfad läuft Platzieren aktuell noch über Block-/Runtime-Blocktypen:

```text
InputController
→ aktive scene/scene_runtime.ts
→ placeBlock(position, blockTypeId)
→ worldRuntime.getSource().setBlock(...)
→ ChunkServiceSource
→ ChunkEditSession
→ ChunkApiClient.sendCommand()
→ dirtyChunks
→ reloadDirtyChunks()
→ ChunkRegistry aktualisiert
→ Scene rendert neu
```

Remove läuft analog über `removeBlock(position)`.

### 4.4 Bereits vorhandener Library-aware Unterbau

Die unteren Schichten kennen Library-/VPLIB-Kontext bereits:

```text
Store
→ selectedRuntimeBlockTypeId
→ selectedLibraryRef
→ selectedPlacementCommand

ChunkSource
→ placeLibraryItem(...)

ChunkServiceSource
→ placeLibraryItem(...)

ChunkEditSession
→ preparePlaceLibraryItemCommand(...)
→ speichert Placement-Kontext lokal in History/Snapshot
```

Der IST-Zustand ist also zweigeteilt:

```text
UI / State / Inventory / World-Source
→ weitgehend Library-ready

aktive SceneRuntime
→ nutzt beim Platzieren aktuell noch setBlock(blockTypeId)
```

### 4.5 Inventory-/Hotbar-Fluss

Aktuell existieren zwei Generationen:

```text
Neue Zielschicht:
/editor/api/inventory
→ editor_inventory_api_client.ts
→ editor_inventory_normalize.ts
→ library_inventory_source.ts
→ inventory_slot_factory.ts
→ InventoryCatalog
→ EditorState.inventory
→ ui/hotbar_view.ts
```

```text
Legacy-/Chunk-Schicht:
/editor/api/chunk/placeable-blocks oder /blocks
→ chunk_api_client.ts
→ chunk_inventory_source.ts
→ InventoryCatalog
```

Die Store- und UI-Schicht behandeln Chunk-Blocks inzwischen überwiegend als Legacy/Diagnose. Die Hotbar-View ist standardmäßig Library-first.

### 4.6 Rendering-Fluss

Aktive SceneRuntime:

```text
ChunkRegistry
→ RuntimeChunkContent
→ createChunkMeshRecord()
→ THREE.InstancedMesh pro cellValue
→ THREE.Scene
→ WebGLRenderer.render()
```

Modulare Render-Schicht:

```text
WorldRuntime / ChunkRegistry
→ SceneWorldBridge
→ ChunkScene
→ ChunkMesher
→ ThreeContext
```

Im IST-Zustand gibt es also eine aktive, integrierte Rendering-Implementierung unter `scene/scene_runtime.ts` und eine stärker modulare Render-/Scene-Infrastruktur unter `render/` und `runtime/scene/`.

### 4.7 Physics-/Collision-Fluss

```text
InputController
→ movementIntent.physics
→ PhysicsRuntime.stepFrame()
→ PlayerPhysicsController
→ VoxelCollisionSolver
→ BlockCollisionQuery
→ ChunkRegistry collision reader
→ PhysicsCameraBinding
→ aktive SceneRuntime aktualisiert Kamera
```

Physics ist unabhängig von Library. Sie braucht nur geladene Zellen und deren Collision-Eigenschaften.

### 4.8 UI-/Store-Fluss

```text
EditorStore
→ state_actions.ts verändert EditorState
→ state_selectors.ts liest abgeleitete Zustände
→ ui/editor_ui_runtime.ts rendert UI-Teile
→ Hotbar / StatusBar / Crosshair / Loading / Error / Debug
```

Die UI-Komponenten sind überwiegend reine View-Schichten. Sie lesen Zustand aus dem Store und schreiben nur bei Interaktionen, z. B. Slot-Klicks, zurück.

---

# 5. Ordner `api/`

```text
api/
├── chunk_api_client.ts
├── chunk_api_errors.ts
├── chunk_api_models.ts
├── chunk_api_normalize.ts
├── http_client.ts
├── editor_inventory_api_client.ts
├── editor_inventory_models.ts
└── editor_inventory_normalize.ts
```

## `chunk_api_client.ts`

High-Level-Client für `/editor/api/chunk`.

Aufgaben:

- Chunk-Service-Status laden
- Connection-Test ausführen
- Bootstrap/Project-Informationen laden
- Blocks und PlaceableBlocks laden
- einzelne Chunks laden
- Batch-Chunks laden
- `SetBlock` und `RemoveBlock` senden
- Ergebnisse normalisieren
- interne Caches für Blocks/PlaceableBlocks führen

Aktueller Zusammenhang:

- Wird von `WorldRuntime`/`ChunkServiceSource` für Remote-Chunk-Zugriffe genutzt.
- Dient weiterhin als technischer World-/Chunk-Client.
- Enthält noch Legacy-Inventar-Funktionen für `loadBlocks()` und `loadPlaceableBlocks()`.

## `chunk_api_models.ts`

Typ- und Vertragsdatei für den Chunk-API-Client.

Aufgaben:

- API-Request- und Response-Modelle definieren
- Chunk-Koordinaten, World-Positionen, Blockdefinitionen und Commands typisieren
- `SetBlock`/`RemoveBlock`-Payloads definieren
- Block-/Palette-/Chunk-Resultate abbilden
- Default- und Placeholder-Strukturen für frühe/Legacy-Blocklisten bereitstellen

Aktueller Zusammenhang:

- Grundlage für `chunk_api_client.ts`, `chunk_api_normalize.ts`, `chunk_service_source.ts`, `chunk_source.ts`, `state_actions.ts` und `editor_state.ts`.
- Enthält noch Block-/Chunk-Inventory-Begriffe, die als Legacy/Adapter weiterhin existieren.

## `chunk_api_errors.ts`

Fehlernormalisierung für Chunk-API-Aufrufe.

Aufgaben:

- beliebige Fehler in `ChunkApiErrorDetails` überführen
- HTTP-, Abort-, Timeout- und Parser-Fehler strukturieren
- Fehlerdetails für Store und UI bereitstellen

Aktueller Zusammenhang:

- Wird vom Chunk-HTTP-Client, `chunk_source.ts`, `state_actions.ts` und Error-UI genutzt.

## `chunk_api_normalize.ts`

Normalisiert instabile oder unterschiedliche Chunk-API-Payloads in stabile Frontend-Modelle.

Aufgaben:

- Status-, Connection-, Bootstrap-, Blocks-, PlaceableBlocks-, Chunk-, Batch- und Command-Responses normalisieren
- defensive Payload-Suche in verschiedenen Response-Formen
- Blocklisten und Chunk-Daten in erwartete Frontend-Strukturen überführen

Aktueller Zusammenhang:

- Macht den Client robust gegen unterschiedliche Backend-/Proxy-Antwortformen.
- Enthält noch alte Inventory-/Creative-Library-Annahmen aus der Chunk-Welt.

## `http_client.ts`

HTTP-/JSON-Wrapper für API-Aufrufe.

Aufgaben:

- `fetch()` kapseln
- Timeout und Abort-Signal zusammenführen
- JSON sicher parsen
- Header und Request-Metadaten verwalten
- Fehler in Chunk-API-Fehlerform bringen

Aktueller Zusammenhang:

- Technisch generisch gebaut, aber typseitig aktuell stark an `ChunkApi*` gebunden.
- Wird im Chunk-API-Kontext genutzt.

## `editor_inventory_api_client.ts`

Client für das neue Editor-Inventory über `/editor/api/inventory`.

Aufgaben:

- Editor-Inventory vom Editor-Backend laden
- Browser ruft nicht direkt `vectoplan-library` auf
- Request-Deduplizierung, Cache und Stale-Cache verwalten
- Diagnose-/Window-Hooks bereitstellen
- Inventory-Payloads über `editor_inventory_normalize.ts` normalisieren

Aktueller Zusammenhang:

- Zielpfad für Library-/VPLIB-Inventory.
- Wird durch `library_inventory_source.ts` genutzt.

## `editor_inventory_models.ts`

Typ- und Vertragsmodell für `/editor/api/inventory`.

Aufgaben:

- `EditorInventoryState`, Slots, Items, LibraryRef und PlacementCommand definieren
- Library-Identität abbilden: `familyId`, `packageId`, `vplibUid`, `variantId`, `revisionHash`, `objectKind`
- technischen Adapter `runtimeBlockTypeId` abbilden
- verbotene Debug-Block-IDs definieren
- PlacementCommand `PlaceLibraryItem` modellieren

Aktueller Zusammenhang:

- Zentrale API-Typbasis für Library-/VPLIB-Hotbar.
- Wird von Inventory, State, ChunkSource und UI verwendet.

## `editor_inventory_normalize.ts`

Normalisierung flexibler `/editor/api/inventory`-Payloads.

Aufgaben:

- Slots, Items, LibraryRefs und PlacementCommands defensiv normalisieren
- Hotbar-Slots auffüllen
- Debug-Blöcke blockieren
- nur Library-/VPLIB-Items als placeable akzeptieren
- Rohdaten für Diagnose erhalten

Aktueller Zusammenhang:

- Brücke zwischen Backend-Payload und stabiler Frontend-Inventory-Welt.

---

# 6. Ordner `bootstrap/`

```text
bootstrap/
├── bootstrap_models.ts
├── default_bootstrap.ts
├── normalize_bootstrap.ts
└── read_bootstrap.ts
```

## `bootstrap_models.ts`

Zentrale Bootstrap-Typdefinition.

Aufgaben:

- `EditorBootstrap` und alle Unterkonfigurationen typisieren
- App, Project, Runtime, Chunk, Physics, FeatureFlags, UI, Input, Camera, Render, Inventory und CreativeLibrary abbilden
- Default-Konstanten für frühe Runtime-Werte definieren

Aktueller Zusammenhang:

- Wird von fast allen Runtime-Schichten verwendet.
- Enthält weiterhin Inventory-Felder aus der alten Chunk-Service-Hotbar-Welt sowie neue Library-relevante Konfigurationsflächen.

## `default_bootstrap.ts`

Erzeugt Default-Bootstrap-Werte.

Aufgaben:

- sichere Defaults für Runtime, Chunk, Physics, FeatureFlags, UI, Input, Camera, Render, Inventory und CreativeLibrary liefern
- Bootfähigkeit ohne vollständigen Backend-Bootstrap sichern

Aktueller Zusammenhang:

- Wird von `normalize_bootstrap.ts` und Fallback-Pfaden genutzt.
- Enthält im IST noch alte Default-Blocktypen/Chunk-Inventory-Annahmen.

## `normalize_bootstrap.ts`

Normalisiert rohe Bootstrap-Daten zu einem stabilen `EditorBootstrap`.

Aufgaben:

- Window-, Dataset- und Fallback-Werte zusammenführen
- Zahlen, Strings, Booleans und strukturierte Teilkonfigurationen bereinigen
- Runtime-Modus validieren
- FeatureFlags und Teilconfigs stabilisieren

Aktueller Zusammenhang:

- Kritische Schicht zwischen HTML/Jinja/Window-Werten und Runtime-Code.
- Liefert den Bootstrap, den `main.ts`, `WorldRuntime` und `SceneRuntime` verwenden.

## `read_bootstrap.ts`

Liest Bootstrap-Quellen aus Browser-Umgebung und DOM.

Aufgaben:

- `window.__VECTOPLAN_EDITOR_BOOTSTRAP__` lesen
- Chunk-/Physics-/Inventory-Globals lesen
- Dataset-Werte aus dem Root-Element lesen
- Minimal-Fallback-Bootstrap erzeugen

Aktueller Zusammenhang:

- Erste Bootstrap-Leseschicht vor der Normalisierung.

---

# 7. Ordner `config/`

```text
config/
└── runtime_config.ts
```

## `runtime_config.ts`

Ältere/zusätzliche Runtime-Konfigurationsschicht neben `bootstrap/`.

Aufgaben:

- Dataset, Window und Query-Parameter lesen
- RuntimeConfig erzeugen
- RuntimeConfig als Defaults für Bootstrap verwenden
- Window-Globals für Diagnose installieren

Aktueller Zusammenhang:

- Wird von `main.ts` weiterhin aktiv genutzt.
- Liefert Defaults an `readEditorBootstrap()` / `normalizeEditorBootstrap()`.
- Existiert parallel zur Bootstrap-Schicht.

---

# 8. Ordner `dom/`

```text
dom/
├── dom_refs.ts
└── resize_observer.ts
```

## `dom_refs.ts`

DOM-Bindung des Editors.

Aufgaben:

- Root-, Main-, Canvas-, Overlay-, Crosshair-, Loading-, Error-, Status- und Hotbar-Elemente finden
- fehlende Canvas-/UI-Elemente defensiv erzeugen
- DOM-Hilfen für Loading, Fatal Error, Source Status, Project Label, Crosshair, Hotbar bereitstellen
- Hotbar-Slot-Buttons rendern

Aktueller Zusammenhang:

- Wird von `main.ts`, aktiver SceneRuntime, UI-Runtime und mehreren UI-Komponenten genutzt.
- Hotbar-Rendering ist noch DOM-nah hier enthalten, obwohl `ui/hotbar_view.ts` fachlich Library-aware ist.

## `resize_observer.ts`

Viewport- und Canvas-Größenmessung.

Aufgaben:

- CanvasHost-/Canvas-Größe messen
- DevicePixelRatio und Aspect Ratio bestimmen
- Canvas-Backing-Store aktualisieren
- ResizeObserver, Window Resize, VisualViewport und VisibilityChange beobachten
- Viewport-State in den Store schreiben

Aktueller Zusammenhang:

- Wird von aktiver SceneRuntime verwendet, um Renderer und Kamera-Projektion zu aktualisieren.

---

# 9. Ordner `camera/`

```text
camera/
├── camera_movement_math.ts
├── camera_state.ts
├── first_person_camera.ts
└── first_person_camera_controller.ts
```

## `camera_movement_math.ts`

Reine Bewegungs- und Blickmathematik.

Aufgaben:

- Vektoren normalisieren
- Yaw/Pitch-Konventionen verwalten
- MovementIntent in Richtungen übersetzen
- Camera- und Physics-Intents kompatibel machen

Aktueller Zusammenhang:

- Library-unabhängige Hilfsschicht für Kamera und Bewegung.

## `camera_state.ts`

Kamera-State-Handle.

Aufgaben:

- Position, Rotation, Projection und Basisdaten verwalten
- Kamera-Snapshots liefern
- Physics-Camera-Bindings übernehmen
- Aspect/FOV/Near/Far aktualisieren

Aktueller Zusammenhang:

- Wird in modularer SceneRuntime verwendet.
- Dient als Trennung zwischen Kamera-Zustand und Three.js-Kamera.

## `first_person_camera.ts`

First-Person-Kamera-Controller-Variante mit State-Handles.

Aufgaben:

- Input lesen
- Bewegung und Rotation berechnen
- Kamera-State und Three-Kontext synchronisieren
- Store aktualisieren

Aktueller Zusammenhang:

- Überschneidet sich mit `first_person_camera_controller.ts`.
- Wirkt im IST wie ältere/alternative Kamera-Integrationsvariante.

## `first_person_camera_controller.ts`

Direkter First-Person-Kamera-Controller für ein Camera-Object-Like.

Aufgaben:

- LookDelta anwenden
- MovementIntent ausführen
- DirectMovement und PhysicsFollow trennen
- Reset/Snapshot/Sync bereitstellen
- Kamera-Objekt aktualisieren

Aktueller Zusammenhang:

- Wird in der modularen Runtime verwendet.
- Passt zum aktuellen Physics-follow-Konzept.

---

# 10. Ordner `input/`

```text
input/
├── input_controller.ts
├── input_state.ts
├── keyboard_input.ts
├── mouse_input.ts
└── pointer_lock.ts
```

## `input_state.ts`

Reine Input-State-Maschine.

Aufgaben:

- Keyboard-, Pointer- und Wheel-Zustand halten
- gedrückte Tasten und Buttons tracken
- Pointer-Lock-Status speichern
- Deltas und Frame-Edges verwalten
- MovementIntent ableiten

Aktueller Zusammenhang:

- Basis für kontinuierliche Bewegung und Aktionen.

## `keyboard_input.ts`

Native Keyboard-Event-Bindung.

Aufgaben:

- KeyDown/KeyUp an Window/Document/Element binden
- Eingaben in Formularfeldern ignorieren
- Bewegung, Hotbar 1–9, Place, Remove, Inspect, Cancel auslösen
- Store/InputState synchronisieren

Aktueller Zusammenhang:

- Liefert Tastaturaktionen an den `input_controller.ts`.

## `mouse_input.ts`

Native Pointer-/Mouse-/Wheel-Event-Bindung.

Aufgaben:

- PointerDown/Up/Move, Click, Wheel und ContextMenu normalisieren
- PointerLock-Aktivierung unterstützen
- Primary/Secondary/Middle-Aktionen auslösen
- LookDelta und WheelDelta liefern

Aktueller Zusammenhang:

- Liefert Mausaktionen an den `input_controller.ts`.

## `pointer_lock.ts`

Browser Pointer Lock-Kapselung.

Aufgaben:

- Pointer Lock anfordern/beenden
- Change/Error Events verarbeiten
- Verfügbarkeit und Lock-Status tracken
- Store und InputState synchronisieren

Aktueller Zusammenhang:

- Grundlage für First-Person-Mauslook.

## `input_controller.ts`

Orchestrator der Eingabequellen.

Aufgaben:

- InputState, KeyboardInput, MouseInput und PointerLock erzeugen
- Hotbar-Auswahl über Tasten/Wheel verarbeiten
- MovementIntent bereitstellen
- Place/Remove/Inspect/Cancel-Callbacks auslösen
- Store mit Input-Zustand synchronisieren

Aktueller Zusammenhang:

- Wird von aktiver SceneRuntime erstellt.
- Place-Intent ist im IST noch blockTypeId-orientiert, nutzt aber bereits Store-Auswahl als Quelle.

---

# 11. Ordner `inventory/`

```text
inventory/
├── chunk_inventory_source.ts
├── hotbar_controller.ts
├── inventory_models.ts
├── inventory_selection.ts
├── inventory_slot_factory.ts
└── library_inventory_source.ts
```

## `inventory_models.ts`

Zentrales Inventory-Domainmodell.

Aufgaben:

- InventoryCatalog, HotbarSlot, InventorySelection und Item-Typen definieren
- Library-, Block-, Asset- und Empty-Items modellieren
- LibraryRefs und PlacementRefs in Inventory-Struktur abbilden
- Debug-Block-IDs blockieren
- EditorInventory-Payloads in Runtime-Inventory-Strukturen überführen

Aktueller Zusammenhang:

- Adapter zwischen API-Inventory, Store und Hotbar.
- Bereits Library-first aufgebaut.

## `inventory_slot_factory.ts`

Factory für einheitliche Inventory-Slot-Ergebnisse.

Aufgaben:

- verschiedene Eingabeformen in `InventorySlotFactoryResult` überführen
- EditorInventoryState, EditorInventoryPayload, EditorInventoryLoadResult, InventoryCatalog und Legacy-Chunk-Blocks verarbeiten
- Slots auffüllen und Auswahl bestimmen
- Debug-Blöcke blockieren
- Legacy-Chunk-Blöcke nur bei expliziter Erlaubnis akzeptieren

Aktueller Zusammenhang:

- Wichtiger Kompatibilitätsadapter zwischen alten und neuen Inventory-Pfaden.

## `inventory_selection.ts`

Auswahllogik für Inventory und Hotbar.

Aufgaben:

- Slot-Navigation berechnen
- nächste/vorherige Auswahl bestimmen
- Wheel-Auswahl normalisieren
- nur placebare Library-/VPLIB-Items als Auswahl zulassen
- RuntimeBlockTypeId, LibraryItemId, FamilyId und VplibUid berücksichtigen

Aktueller Zusammenhang:

- Library-first Selektionsschicht.

## `library_inventory_source.ts`

Library-/VPLIB-Inventory-Quelle.

Aufgaben:

- `/editor/api/inventory` über `EditorInventoryApiClient` laden
- EditorInventoryState in InventoryCatalog überführen
- RuntimeSelection bereitstellen
- LibraryRefs und PlacementCommands erhalten
- Debug-Block-IDs blockieren

Aktueller Zusammenhang:

- Zielquelle für Hotbar/Inventory.

## `chunk_inventory_source.ts`

Legacy-Inventory-Quelle über Chunk-Blocks.

Aufgaben:

- `ChunkApiClient.loadBlocks()` nutzen
- Chunk-Blockdaten in InventoryCatalog überführen
- früherer Pfad für placeable blocks / Hotbar

Aktueller Zusammenhang:

- Existiert weiterhin als Legacy-/Debug-/Fallback-Pfad.
- Nicht die bevorzugte fachliche Inventory-Wahrheit.

## `hotbar_controller.ts`

Controller für Hotbar-Initialisierung, Auswahl, Rendering und Store-Sync.

Aufgaben im aktuellen Konzept:

- InventorySource laden
- InventoryCatalog in Store dispatchen
- Auswahl synchronisieren
- Hotbar-Rendering anstoßen
- Debug-Blöcke blockieren
- LibraryInventorySource unterstützen

Aktueller Zusammenhang:

- Fachlich als Hotbar-Controller vorgesehen.
- In der analysierten Fassung war die Datei syntaktisch/inhaltlich auffällig und sollte im echten Code auf Kompilierbarkeit geprüft werden. Für den IST-Zustand bleibt sie Teil des Inventory-Clusters.

---

# 12. Ordner `runtime/world/`

```text
runtime/world/
├── chunk_content.ts
├── chunk_coordinates.ts
├── chunk_edit_session.ts
├── chunk_loader.ts
├── chunk_registry.ts
├── chunk_service_source.ts
├── chunk_source.ts
└── world_runtime.ts
```

## `chunk_coordinates.ts`

Koordinaten- und Adressierungslogik.

Aufgaben:

- World-Positionen in Chunk-Koordinaten übersetzen
- lokale Zellkoordinaten berechnen
- CellIndex berechnen
- ChunkBounds und NeighborKeys erzeugen
- WorldCellRanges und ChunkRanges berechnen
- sichtbare Chunkbereiche bestimmen

Aktueller Zusammenhang:

- Fundament für ChunkLoader, ChunkRegistry, SceneRuntime, Physics und Targeting.

## `chunk_content.ts`

Runtime-Modell eines geladenen Chunks.

Aufgaben:

- Chunk-API-Daten in `RuntimeChunkContent` normalisieren
- Cells, Palette, Maps und Stats erzeugen
- PaletteByCellValue und PaletteByBlockTypeId bereitstellen
- Zell-Sampling nach Index, lokalen Koordinaten und World-Position ermöglichen
- Collision-Informationen aus Zellwerten ableiten
- unbekannte Non-Air-Zellen für Collision sicher als solid behandeln

Aktueller Zusammenhang:

- Grundlage für Rendering, Targeting und Physics.
- Library wird hier nicht direkt verwaltet; Library-Items erscheinen nach Platzierung als Runtime-Blocktypen/Palette-Einträge.

## `chunk_registry.ts`

In-Memory-Registry geladener Chunks.

Aufgaben:

- Chunks speichern, ersetzen, löschen und abfragen
- Visible-, Dirty- und Failed-Chunk-Sets verwalten
- Zell-Sampling über World-Position oder Address bereitstellen
- Collision-Reader für Physics erzeugen
- Registry-Snapshots und Stats liefern

Aktueller Zusammenhang:

- Zentrale lokale World-Cache-Schicht.
- Wird von WorldRuntime, SceneRuntime, Targeting und Physics genutzt.

## `chunk_loader.ts`

Chunk-Ladeorchestrierung.

Aufgaben:

- Initial chunks laden
- Chunks um Position oder Chunk-Koordinate laden
- bestimmte ChunkKeys oder Koordinaten laden
- Dirty Chunks reloaden
- Full Refresh ausführen
- sichtbaren Radius verwalten
- Batch-Laden bevorzugen

Aktueller Zusammenhang:

- Wird von `WorldRuntime` verwendet.

## `chunk_source.ts`

Abstrakte Source-Schnittstelle für die WorldRuntime.

Aufgaben:

- Source-Lifecycle, Metadata, Capabilities und Events definieren
- Chunk-Load-, Batch-Load-, Command-, Dirty- und Refresh-Schnittstellen definieren
- Legacy-Inventory-Methoden `loadPlaceableBlocks()` und `loadBlocks()` typisieren
- `setBlock()`, `placeLibraryItem()` und `removeBlock()` definieren
- LibraryPlacement-Kontext in CommandOptions modellieren

Aktueller Zusammenhang:

- Brücke zwischen WorldRuntime und konkreter Source-Implementierung.
- Bereits Library-/VPLIB-aware.

## `chunk_edit_session.ts`

Lokale Edit-Session und Command-History.

Aufgaben:

- User-/Session-Identität halten
- SetBlock-, PlaceLibraryItem- und RemoveBlock-Commands vorbereiten
- Library-/VPLIB-Kontext lokal an Commands hängen
- pending/result/failed Command-History verwalten
- DirtyChunkKeys aus Ergebnissen sammeln

Aktueller Zusammenhang:

- Wichtiges Bindeglied zwischen fachlichem Placement-Kontext und technischem Chunk-Command.
- Kann Library-Placement aktuell in einen kompatiblen SetBlock-Command übersetzen.

## `chunk_service_source.ts`

Konkrete Remote-Chunk-Service-Source.

Aufgaben:

- ChunkApiClient, ChunkRegistry und ChunkEditSession verbinden
- Connection-Test beim Initialisieren ausführen
- Chunks laden und in Registry speichern
- Commands senden
- Dirty Chunks markieren und reloaden
- Source-Events emitten
- `placeLibraryItem()` als semantischen Library-Pfad bereitstellen

Aktueller Zusammenhang:

- Produktiver Adapter zwischen Browser-WorldRuntime und `/editor/api/chunk`.
- Unterstützt sowohl Legacy-SetBlock als auch Library-aware Placement-Kontext.

## `world_runtime.ts`

WorldRuntime-Orchestrator.

Aufgaben:

- ChunkServiceSource erzeugen
- ChunkLoader erzeugen
- Registry und CollisionReader bereitstellen
- initiale Welt laden
- Chunks um Kamera/Position/AABB laden
- Dirty Chunks reloaden
- Full Refresh ausführen
- Store mit World-/Connection-/Chunk-Zuständen synchronisieren

Aktueller Zusammenhang:

- Wird von `main.ts` erzeugt und an die aktive SceneRuntime übergeben.
- Lädt im IST noch Legacy-PlaceableBlocks als Teil des Initialisierungspfads, während neue Inventory-Pfade separat existieren.

---

# 13. Ordner `runtime/physics/`

```text
runtime/physics/
├── aabb.ts
├── block_collision_query.ts
├── double_tap_detector.ts
├── physics_defaults.ts
├── physics_models.ts
├── physics_runtime.ts
├── player_physics_controller.ts
├── player_physics_state.ts
└── voxel_collision_solver.ts
```

## `physics_models.ts`

Zentrale Physics-Typen.

Aufgaben:

- Vektoren, AABBs, MovementIntent, CollisionFlags, PlayerPhysicsState und CameraBinding definieren
- Sanitizer und Factory-Funktionen für Physics-Werte bereitstellen

## `physics_defaults.ts`

Default-Konfigurationen für Physics.

Aufgaben:

- Movement-, Gravity-, Jump-, Fly-, Collider-, Timing-, MissingChunk- und Debug-Defaults definieren
- Config-Patches normalisieren

## `aabb.ts`

AABB-Geometrie und Collision-Helfer.

Aufgaben:

- AABB erstellen, klonen, verschieben
- Cell ranges aus AABB berechnen
- Swept/Axis-Movement-Grenzen berechnen
- Ground-/Ceiling-Probes erzeugen

## `block_collision_query.ts`

Verbindung zwischen Physics und ChunkRegistry.

Aufgaben:

- WorldCellReader abfragen
- Missing chunks und unknown cells nach Policy behandeln
- blockierende AABBs sammeln
- Collision-Zellen für Physics bereitstellen

## `voxel_collision_solver.ts`

Voxel-Collision-Auflösung.

Aufgaben:

- Bewegung achsenweise lösen
- Blocking-AABBs berücksichtigen
- appliedDelta, remainingDelta und blockedAxes berechnen
- Ground- und Ceiling-Checks durchführen
- CollisionFlags erzeugen

## `player_physics_state.ts`

Player-Physics-State-Helfer.

Aufgaben:

- initiale Player-Zustände erzeugen
- Spawn-Zustand ableiten
- Store-Patches erzeugen
- Position, Velocity, Angles und Revisionen normalisieren

## `player_physics_controller.ts`

Eigentliche Player-Simulation.

Aufgaben:

- MovementIntent anwenden
- Gravity, Jump, Flight und Damping berechnen
- CollisionSolver verwenden
- Velocity und MovementMode aktualisieren

## `physics_runtime.ts`

Runtime-Wrapper um den Physics Controller.

Aufgaben:

- Fixed timestep accumulator verwalten
- start/pause/resume/stop
- `stepFrame()` bereitstellen
- Collision query einbinden
- Snapshots und Fehler/Warnungen liefern

## `double_tap_detector.ts`

Generischer Double-Tap-Detector.

Aufgaben:

- Doppeltipp-Fenster erkennen
- aktuell für Space/FlightToggle nutzbar

Aktueller Zusammenhang der Physics-Schicht:

```text
Input movementIntent
→ PhysicsRuntime.stepFrame()
→ PlayerPhysicsController
→ VoxelCollisionSolver
→ BlockCollisionQuery
→ ChunkRegistry
→ CameraBinding zurück an SceneRuntime
```

Physics ist Library-neutral.

---

# 14. Ordner `runtime/scene/`

```text
runtime/scene/
├── scene_chunk_tools.ts
├── scene_lifecycle.ts
├── scene_loop.ts
├── scene_runtime.ts
└── scene_world_bridge.ts
```

## `scene_lifecycle.ts`

Lifecycle- und Cleanup-Infrastruktur.

Aufgaben:

- Statusübergänge verwalten
- AbortSignal kapseln
- Cleanup-Callbacks, Disposables, EventListener, Timeouts und RAFs registrieren
- Lifecycle-Steps ausführen und protokollieren

## `scene_loop.ts`

Modulare RAF-Loop.

Aufgaben:

- Phasen `before-update`, `update`, `after-update`, `before-render`, `render`, `after-render`
- Callback-Registrierung
- Framezeiten messen
- Visibility-Pause unterstützen
- Render-Frames in Store dispatchen

## `scene_world_bridge.ts`

Brücke zwischen WorldRuntime und ChunkScene.

Aufgaben:

- ChunkRegistry in ChunkScene synchronisieren
- Dirty Chunks remeshen
- Source-Events behandeln
- RenderAfterSync auslösen
- RenderedChunkKeys in Store schreiben

## `scene_chunk_tools.ts`

Command-Tools für Place/Remove/Inspect in der modularen Runtime.

Aufgaben:

- Targeting-Ergebnisse lesen
- SetBlock-/RemoveBlock-Commands erstellen
- Commands an WorldRuntime Source senden
- DirtyChunks und CommandResult in Store dispatchen
- Preview aktualisieren

Aktueller Zusammenhang:

- Kennt aktuell `activeBlockTypeId` als Platzierungswert.
- Importiert bereits PlacementRef-Selectoren, nutzt aber im analysierten Stand vor allem BlockTypeId/SetBlock.

## `scene_runtime.ts`

Modularere SceneRuntime-Variante.

Aufgaben:

- ThreeContext, ResizeObserver, CameraState, FirstPersonCameraController, PhysicsRuntime, ChunkScene, SceneWorldBridge, Targeting, ChunkTools, InventorySource, HotbarController, InputController, DebugOverlay und SceneLoop verbinden

Aktueller Zusammenhang:

- Nach aktuellem `main.ts` nicht die primäre aktive Runtime.
- Zeigt aber die angestrebte stärkere Modularisierung der Scene-Schicht.

---

# 15. Ordner `render/`

```text
render/
├── chunk_mesher.ts
├── chunk_scene.ts
├── debug_overlay.ts
├── preview_renderer.ts
└── three_context.ts
```

## `three_context.ts`

Three.js-Grundkontext.

Aufgaben:

- WebGLRenderer, Scene und PerspectiveCamera erzeugen
- Root-/Chunk-/Preview-/Helper-Gruppen verwalten
- Default-Lights und Grid hinzufügen
- Resize und Render kapseln
- Dispose/Snapshot bereitstellen

## `chunk_mesher.ts`

Chunk-zu-Mesh-Konvertierung.

Aufgaben:

- RuntimeChunkContent in Three.js-Meshes wandeln
- Instanced Boxes oder Individual Boxes erzeugen
- Palette-Farben und Metadaten nutzen
- Chunk-Mesh-Diagnose liefern

## `chunk_scene.ts`

Scenegraph-Verwaltung für Chunks.

Aufgaben:

- Chunk-Meshes setzen, ersetzen, entfernen
- mehrere Chunks synchronisieren
- aus ChunkRegistry syncen
- Dirty Chunks remeshen
- Sichtbarkeit und Stats verwalten

## `preview_renderer.ts`

Platzierungs- und Entfernen-Preview.

Aufgaben:

- Placement Preview anzeigen
- Remove Highlight anzeigen
- Target Outline anzeigen
- Preview-Zustand aktualisieren/verbergen

## `debug_overlay.ts`

Render-nahes Debug Overlay.

Aufgaben:

- Debug-Visualisierung im Render-Kontext bereitstellen
- Store-/Runtime-Diagnose anzeigen

Aktueller Zusammenhang:

- Render-Ordner ist stärker modular aufgebaut als die aktive `scene/scene_runtime.ts`, die aktuell eigenes Three.js-Meshing integriert.

---

# 16. Ordner `scene/`

```text
scene/
└── scene_runtime.ts
```

## `scene/scene_runtime.ts`

Aktive Browser-SceneRuntime.

Aufgaben:

- Three.js Renderer, Scene, Camera, Lights und Grid erzeugen
- RuntimeChunkContent direkt in InstancedMeshes umwandeln
- sichtbare Chunks aus ChunkRegistry rendern
- InputController erzeugen
- PhysicsRuntime erzeugen und pro Frame updaten
- Kamera per Input oder Physics bewegen
- Targeting per Three.js-Raycaster gegen Chunk-Meshes bestimmen
- Place/Remove über WorldRuntime Source ausführen
- UI Runtime erzeugen
- Source Events abonnieren
- RAF-Loop steuern
- Runtime-Snapshots liefern

Aktueller Zusammenhang:

```text
SceneRuntime
← main.ts erstellt sie aktiv
← bekommt WorldRuntime, Store, DomRefs und ChunkApiClient
→ rendert Chunks aus WorldRuntime.Registry
→ nutzt InputController
→ nutzt PhysicsRuntime
→ nutzt EditorUiRuntime
→ ruft aktuell setBlock/removeBlock auf WorldRuntime.Source
```

Diese Datei ist aktuell der zentrale Integrationspunkt des Editors im Browser.

---

# 17. Ordner `state/`

```text
state/
├── editor_state.ts
├── editor_store.ts
├── player_state.ts
├── state_actions.ts
└── state_selectors.ts
```

## `editor_state.ts`

Globales State-Modell und State-Helfer.

Aufgaben:

- `EditorState` und alle Teilzustände definieren
- Lifecycle, Project, Viewport, Input, Camera, Player, World, Inventory, CreativeLibrary, Targeting, Tools, Command, Render, UI und Debug modellieren
- initialen EditorState erzeugen
- InventoryItems aus Block-, Library-, Asset- und Catalog-Daten erzeugen
- LibraryRef, PlacementCommand und PlacementRef abbilden
- HotbarSlots aus Items erzeugen
- Chunk-Summaries erzeugen
- State-Helfer für Updates bereitstellen

Aktueller Zusammenhang:

- Zentrale Datenstruktur des Frontends.
- Bereits Library-/VPLIB-aware.

## `editor_store.ts`

Minimaler zentraler Store.

Aufgaben:

- State halten
- `setState`, `patchState`, `subscribe`, `once` bereitstellen
- Revision und History verwalten
- Snapshots liefern
- Store zerstören

Aktueller Zusammenhang:

- Alle Runtime- und UI-Schichten schreiben/lesen über diesen Store.

## `player_state.ts`

Store-facing Player-State-Brücke.

Aufgaben:

- PhysicsRuntimeSnapshot in EditorPlayerState überführen
- Player-Debug-State erzeugen
- Player-State patchen/resetten
- Position, Velocity, EyePosition, Angles, CollisionFlags und MovementMode normalisieren

Aktueller Zusammenhang:

- Verbindet Physics mit dem globalen EditorState.

## `state_actions.ts`

Reducer-/Action-Schicht.

Aufgaben:

- alle EditorActions definieren
- `applyEditorAction()` umsetzen
- Lifecycle-, Viewport-, Input-, Camera-, Player-, World-, Inventory-, Targeting-, Tool-, Command-, Render-, UI- und Debug-Actions anwenden
- Legacy-Inventory aus Chunk-Blocks kontrolliert behandeln
- neue EditorInventory-/Catalog-Actions verarbeiten

Aktueller Zusammenhang:

- Zentrale kontrollierte Mutationsschicht des Stores.
- Library-Inventory-Actions sind bereits vorhanden.

## `state_selectors.ts`

Selector- und Derived-State-Schicht.

Aufgaben:

- Teilzustände sicher lesen
- Readiness, WorldSummary, InventorySummary, SelectedBlockSummary, TargetSummary, CommandSummary, UiSummary, DebugSummary und PlayerSummary berechnen
- aktive RuntimeBlockTypeId, LibraryRef und PlacementCommand selektieren
- placebare Library-Items filtern

Aktueller Zusammenhang:

- Wichtige Schnittstelle für UI, Runtime und Debug.
- Der Begriff `Block` ist in einigen Selector-Namen noch vorhanden, gibt aber häufig bereits `runtimeBlockTypeId` zurück.

---

# 18. Ordner `targeting/`

```text
targeting/
├── chunk_targeting.ts
├── raycast.ts
└── target_models.ts
```

## `raycast.ts`

Voxel-Raycasting.

Aufgaben:

- Ray aus Origin/Direction erzeugen
- Zellen entlang des Rays traversieren
- Zell-Sampler abfragen
- Hit, Face, Normal, SourceCell und PreviousCell bestimmen
- Debug-Raycasts mit Step-Liste erzeugen

## `target_models.ts`

Targeting-Domainmodelle.

Aufgaben:

- Ray, Hit, TargetCellDescriptor, PlacementTarget, RemoveTarget, InspectTarget und TargetingState definieren
- Placement- und Remove-Targets erzeugen
- TargetingState validieren
- DebugSummary erzeugen

Aktueller Zusammenhang:

- PlacementTarget enthält aktuell `blockTypeId`; im aktuellen Editor-Kontext entspricht dieser Wert technisch dem Runtime-Blocktyp.

## `chunk_targeting.ts`

ChunkRegistry-basiertes Targeting.

Aufgaben:

- Raycast gegen Registry-Sampler ausführen
- Hit in Inspect-, Placement- und RemoveTargets umwandeln
- TargetingState halten
- Targeting in Store dispatchen
- CommandTargets für Place/Remove/Inspect liefern

Aktueller Zusammenhang:

- Wird in der modularen Runtime verwendet.
- Die aktive `scene/scene_runtime.ts` enthält zusätzlich eigenes Three.js-Raycaster-Targeting.

---

# 19. Ordner `ui/`

```text
ui/
├── crosshair_view.ts
├── debug_overlay.ts
├── editor_ui_runtime.ts
├── error_panel.ts
├── hotbar_view.ts
├── loading_overlay.ts
└── status_bar.ts
```

## `editor_ui_runtime.ts`

UI-Orchestrator.

Aufgaben:

- StatusBar, CrosshairView, HotbarView, LoadingOverlay, ErrorPanel und DebugOverlay erstellen
- UI-Teile mounten, rendern, zeigen, verbergen und disposen
- Crosshair aus Store-Zustand aktualisieren
- Hotbar-Slot-Klicks in `inventory/select-slot` umsetzen
- Loading/Error/Debug-Operationen kapseln

Aktueller Zusammenhang:

- Wird von aktiver SceneRuntime erstellt.
- HotbarView wird mit Library-first Defaults verwendet.

## `hotbar_view.ts`

Library-first Hotbar-View.

Aufgaben:

- Store-Inventory in HotbarViewModel überführen
- Hotbar-Slots rendern
- Library-/VPLIB-Metadaten anzeigen und als Dataset setzen
- Debug-Blöcke blockieren
- Legacy-Block-Slots nur bei expliziter Erlaubnis aktivieren
- Slot-Klick und Keyboard-Aktivierung verarbeiten

Aktueller Zusammenhang:

- Wichtigste UI-Schicht für Library-/VPLIB-Inventory.
- Verwendet noch `renderDomHotbarSlots()` aus `dom_refs.ts` für DOM-Ausgabe.

## `crosshair_view.ts`

Crosshair-Komponente.

Aufgaben:

- Crosshair-Element erzeugen/finden
- Varianten `neutral`, `target`, `place`, `remove`, `blocked`, `error` anzeigen
- PointerLock und Sichtbarkeit berücksichtigen
- Label bei Blocked/Error anzeigen

Aktueller Zusammenhang:

- Library-neutral.
- Zeigt nur Target-/Place-/Remove-Zustand.

## `status_bar.ts`

Statusbar-Komponente.

Aufgaben:

- Projekt-/World-Label aktualisieren
- SourceStatus aktualisieren
- StatusLine aus Store ableiten
- selected slot, active block/runtime-block, target status, command status und dirty chunks anzeigen

Aktueller Zusammenhang:

- Nutzt noch blockbezogene Begriffe, liest technisch aber über Selector bereits RuntimeBlockTypeId.

## `loading_overlay.ts`

Loading Overlay.

Aufgaben:

- Loading-Zustand aus Store ableiten
- Boot-/Bootstrap-/API-/World-/Scene-/Render-/Inventory-Phasen anzeigen
- DOM Loading Overlay und Live Region aktualisieren
- Mindestanzeigedauer verwalten

Aktueller Zusammenhang:

- Generische UI-Komponente.
- Inventory-Phase existiert bereits.

## `error_panel.ts`

Error Panel / Fatal Error UI.

Aufgaben:

- Fehler aus Store lesen
- Fatal/Error/Warning/Info-ViewModel erzeugen
- DOM Fatal Error anzeigen oder löschen
- Details anzeigen
- Retry/Dismiss zählen und callbacks aufrufen

Aktueller Zusammenhang:

- Generisch und Library-neutral.

## `debug_overlay.ts`

Debug Overlay.

Aufgaben:

- Runtime-, World-, Command-, Target-, Camera-, Inventory- und Fehlerdaten anzeigen
- Store abonnieren
- Debug-Zeilen rendern
- Sichtbarkeit und Renderintervalle verwalten

Aktueller Zusammenhang:

- Hilft beim Runtime-Debugging.
- Zeigt im IST Inventory-Anzahl, aber nur begrenzt Library-spezifische Details.

---

# 20. Ordner `utils/`

```text
utils/
├── ids.ts
├── logger.ts
├── read_path.ts
├── safe.ts
└── time.ts
```

## `ids.ts`

ID- und Key-Helfer.

Aufgaben:

- Editor-, Runtime-, Scene-, World-, Command-, Request-, Event-, Session-, DOM-, Target- und Mesh-IDs erzeugen
- ChunkKeys erzeugen und parsen
- CellKeys und TargetKeys erzeugen
- stabile Hashes und IDs bilden

## `logger.ts`

Logger-Infrastruktur.

Aufgaben:

- Namespaced Logger erzeugen
- Log-Level filtern
- Child-Logger und Context-Logger erzeugen
- Details sicher serialisieren
- Console-, Buffered- und Multiplex-Sinks bereitstellen

## `read_path.ts`

Sicheres Pfadlesen/-schreiben.

Aufgaben:

- verschachtelte Werte über Pfade lesen
- erste vorhandene Pfade/Werte lesen
- typisierte Pfadleser für String, Number, Boolean, Array, Record bereitstellen
- Pfade setzen/löschen
- Dot-Paths parsen

## `safe.ts`

Defensive Parsing- und Fehler-Helfer.

Aufgaben:

- Strings, Numbers, Integers, Booleans, Arrays und Records sicher normalisieren
- Unknown Errors normalisieren
- JSON-sichere Werte erzeugen
- Debug-Previews erzeugen
- safeCall/safeCallAsync bereitstellen

## `time.ts`

Zeit-, Timeout- und RAF-Helfer.

Aufgaben:

- aktuelle Zeit als epoch, monotonic und ISO liefern
- Dauer berechnen und formatieren
- Sleep und TimeoutSignal erzeugen
- Debounced Tasks und RAF-Loops kapseln

Aktueller Zusammenhang:

- Utils sind generisch und werden in nahezu allen Schichten verwendet.

---

# 21. Datei `main.ts`

## Rolle

`main.ts` ist der Einstiegspunkt des Frontends.

Aufgaben:

- Build-Konstanten lesen
- Editor-Root finden
- vorhandene Runtime bei Reboot/HMR zerstören
- RuntimeConfig lesen
- RuntimeConfig-Globals installieren
- DOM-Refs binden
- Bootstrap lesen und normalisieren
- Remote-Chunk-only validieren
- InitialState und Store erzeugen
- ChunkApiClient erzeugen
- WorldRuntime erzeugen
- aktive SceneRuntime erzeugen
- RuntimeHandle installieren
- Runtime Events `ready`, `failed`, `destroyed` dispatchen
- HMR-Cleanup unterstützen

Aktueller Boot-Zusammenhang:

```text
bootWhenDocumentIsReady("auto")
→ bootVectoplanEditor("auto")
→ createRuntimeHandle(...)
→ initializeRuntime(runtime)
→ sceneRuntime.initialize()
```

`main.ts` ist außerdem die Stelle, die bestätigt, dass die aktive Runtime über `@scene/scene_runtime` geladen wird.

---

# 22. Aktuell funktionierende Kernfähigkeiten

Aus der analysierten Struktur ergibt sich folgender funktionierender IST-Zustand:

```text
Editor bootet über main.ts.
DOM wird gebunden oder defensiv ergänzt.
Bootstrap und RuntimeConfig werden gelesen und normalisiert.
ChunkApiClient wird erzeugt.
WorldRuntime verbindet den Remote-Chunk-Service.
Chunks werden geladen und in ChunkRegistry gespeichert.
Aktive SceneRuntime rendert Chunks mit Three.js.
InputController verarbeitet Keyboard, Mouse und PointerLock.
PhysicsRuntime kann Player-Bewegung und Collision ausführen.
Targeting kann Zellen und Platzierungspositionen bestimmen.
Place/Remove wird über Chunk-Commands ausgeführt.
Dirty Chunks werden nach Commands neu geladen.
UI Runtime rendert Statusbar, Crosshair, Hotbar, Loading, Error und Debug.
State/Actions/Selectors bilden Library-/VPLIB-Inventory bereits ab.
HotbarView ist Library-first und blockiert Debug-Block-IDs.
ChunkSource und ChunkEditSession kennen bereits semantisches Library-Placement.
```

---

# 23. Aktuelle Zusammenhänge zwischen Library und Editor

Die Library-Integration ist im IST-Zustand an mehreren Stellen bereits vorhanden:

| Schicht | Aktueller Library-Bezug |
|---|---|
| `api/editor_inventory_*` | Lädt und normalisiert `/editor/api/inventory`. |
| `inventory/library_inventory_source.ts` | Zielquelle für Library-/VPLIB-Hotbar. |
| `inventory/inventory_models.ts` | Modelliert LibraryItems, PlacementRefs und Catalogs. |
| `state/editor_state.ts` | Speichert RuntimeBlockTypeId, LibraryRef, PlacementCommand, Family/VPLIB-Daten. |
| `state/state_actions.ts` | Verarbeitet EditorInventoryPayload/State/LoadResult und Catalogs. |
| `state/state_selectors.ts` | Selektiert activeRuntimeBlockTypeId, activeLibraryRef, activePlacementCommand. |
| `ui/hotbar_view.ts` | Rendert und aktiviert standardmäßig nur Library-/VPLIB-Slots. |
| `runtime/world/chunk_source.ts` | Definiert `placeLibraryItem()`. |
| `runtime/world/chunk_service_source.ts` | Implementiert `placeLibraryItem()`. |
| `runtime/world/chunk_edit_session.ts` | Speichert Library-Placement-Kontext und erzeugt kompatible Commands. |

Der aktuelle aktive Platzierungspfad der `scene/scene_runtime.ts` verwendet jedoch noch den klassischen `setBlock(blockTypeId)`-Aufruf. Das ist ein IST-Befund, kein Zielzustand.

---

# 24. Aktuelle Parallel- und Legacy-Bereiche

Im aktuellen Frontend existieren mehrere parallele Schichten:

## 24.1 Bootstrap und RuntimeConfig

```text
config/runtime_config.ts
bootstrap/read_bootstrap.ts
bootstrap/normalize_bootstrap.ts
```

`main.ts` verwendet beide: zuerst RuntimeConfig, dann Bootstrap.

## 24.2 Aktive SceneRuntime und modulare RuntimeScene

```text
Aktiv:
scene/scene_runtime.ts

Modular/parallel:
runtime/scene/scene_runtime.ts
runtime/scene/scene_lifecycle.ts
runtime/scene/scene_loop.ts
runtime/scene/scene_world_bridge.ts
runtime/scene/scene_chunk_tools.ts
```

## 24.3 Aktives integriertes Rendering und modularer Render-Ordner

```text
Aktiv integriert:
scene/scene_runtime.ts rendert Chunks selbst

Modular vorhanden:
render/three_context.ts
render/chunk_mesher.ts
render/chunk_scene.ts
render/preview_renderer.ts
```

## 24.4 Library-Inventory und Chunk-Inventory

```text
Library-first:
api/editor_inventory_*
inventory/library_inventory_source.ts
ui/hotbar_view.ts
state/editor_inventory actions/selectors

Legacy:
api/chunk_api_client.loadBlocks/loadPlaceableBlocks
inventory/chunk_inventory_source.ts
world_runtime.ts initial source.loadPlaceableBlocks
```

Diese Parallelität ist Teil des aktuellen IST-Zustands.

---

# 25. Kompakter Architekturüberblick

```text
main.ts
│
├─ config/runtime_config.ts
├─ bootstrap/*
├─ dom/dom_refs.ts
├─ state/editor_state.ts
├─ state/editor_store.ts
│
├─ api/chunk_api_client.ts
│  └─ runtime/world/world_runtime.ts
│     ├─ chunk_service_source.ts
│     ├─ chunk_source.ts
│     ├─ chunk_edit_session.ts
│     ├─ chunk_loader.ts
│     └─ chunk_registry.ts
│
├─ scene/scene_runtime.ts   ← aktive SceneRuntime
│  ├─ Three.js direkt
│  ├─ input/input_controller.ts
│  ├─ runtime/physics/physics_runtime.ts
│  ├─ ui/editor_ui_runtime.ts
│  └─ WorldRuntime Source Commands
│
├─ inventory/*
│  ├─ library_inventory_source.ts
│  ├─ inventory_models.ts
│  ├─ inventory_slot_factory.ts
│  └─ inventory_selection.ts
│
├─ ui/*
│  ├─ hotbar_view.ts
│  ├─ crosshair_view.ts
│  ├─ status_bar.ts
│  ├─ loading_overlay.ts
│  ├─ error_panel.ts
│  └─ debug_overlay.ts
│
└─ state/state_actions.ts + state/state_selectors.ts
   └─ verbinden Runtime, Inventory und UI über EditorState
```

---

# 26. Zusammenfassung

Der aktuelle `src/frontend`-Stand ist eine umfangreiche, funktionsfähige Browser-Runtime für den VECTOPLAN Editor. Der Kern besteht aus:

```text
Boot/Main
→ Bootstrap/Config
→ Store/State
→ Chunk API
→ WorldRuntime
→ aktive SceneRuntime
→ Input
→ Physics
→ Rendering
→ Targeting
→ UI
→ Inventory/Hotbar
```

Die aktive Runtime ist `scene/scene_runtime.ts`. Sie integriert aktuell viel Logik direkt: Three.js-Renderer, Chunk-Meshing, Input, Physics, Targeting, Commands und UI Runtime.

Die Store-, Inventory-, UI- und World-Source-Schichten sind bereits stark auf Library-/VPLIB-Inventory vorbereitet. Die Hotbar-View ist im IST-Zustand bereits Library-first. Die World-Source kann semantisches `placeLibraryItem()` bereits entgegennehmen und intern als kompatibles `SetBlock(runtimeBlockTypeId)` behandeln.

Gleichzeitig existieren weiterhin Legacy-/Parallelpfade für Chunk-Inventory, blockTypeId-Begriffe und eine zweite modulare SceneRuntime-Struktur unter `runtime/scene/`. Diese sind Teil des aktuellen Zustands und erklären, warum `src/frontend` groß wirkt: Mehrere Generationen der Runtime existieren gleichzeitig nebeneinander.
---

# 27. Aktueller Reparaturstand Datei für Datei

Dieser Abschnitt beschreibt zusätzlich zum allgemeinen IST-Zustand, was wir während der aktuellen Reparaturserie konkret anpassen oder bereits angepasst haben. Der Fokus liegt auf Kompilierbarkeit, stabiler Typisierung und sauberer Trennung zwischen Library-/VPLIB-Inventory und Legacy-Chunk-Inventory.

## 27.1 Bereits bearbeitete Dateien in der aktuellen Reparaturserie

### `api/chunk_api_client.ts`

Aktuelle Rolle:

- technischer HTTP-Client zum Chunk-Service
- lädt Status, Connection, Bootstrap, Chunks, Batch-Chunks und Commands
- enthält weiterhin Legacy-Blocklisten für Diagnose

Aktuelle Reparatur:

```text
- routeHints-Fallback vollständig gemacht
- editorInventory, editorInventoryHealth, editorInventoryMetadata ergänzt
- creativeLibrary, creativeLibraryHealth, creativeLibraryMetadata ergänzt
- placeable:true Literal-Typen stabilisiert
- verbotene Debug-Blocktypen im Client gefiltert
- legacy block/placeable block Pfade als diagnostic-only markiert
```

Wichtige Regel:

```text
loadBlocks() / loadPlaceableBlocks()
→ dürfen nicht mehr produktive Hotbar-Wahrheit sein
```

### `api/editor_inventory_models.ts`

Aktuelle Rolle:

- Typbasis für `/editor/api/inventory`
- beschreibt State, Slots, Items, LibraryRef, PlacementCommand und LoadResult
- stellt Helper für Slots, Items, RuntimeSelection und Debug-Block-Filter bereit

Aktuelle Reparatur:

```text
- EditorInventoryLoadResult stabilisiert
- Success und Failure haben gemeinsame optionale error/reason-Felder
- LoadResult-Guards ergänzt
- doppelte Window-Global-Deklaration für __VECTOPLAN_EDITOR_CREATIVE_LIBRARY_ROUTE__ entfernt
- __VECTOPLAN_EDITOR_RUNTIME_CONFIG__ und __VECTOPLAN_EDITOR_BOOTSTRAP__ auf unknown gesetzt
```

Wichtige Regel:

```text
EditorInventoryLoadResult.ok
→ primary discriminator

result.error / result.reason
→ darf typseitig gelesen werden, ohne Property-Existenz zu verlieren
```

### `api/editor_inventory_api_client.ts`

Aktuelle Rolle:

- lädt `/editor/api/inventory`
- verwaltet Cache, Stale-Cache und Request-Deduplizierung
- normalisiert Response über `editor_inventory_normalize.ts`
- exportiert Diagnose-Window-Globals

Aktuelle Reparatur:

```text
- Window.console-Zugriffe ersetzt
- Error-Zugriffe auf unknown robust gemacht
- LoadResult-Failure sauber über Helper gelesen
- Export von Window-Globals defensiv gehalten
- Empty-Fallback bei Fehlern stabilisiert
```

Wichtige Regel:

```text
Dieser Client ruft nicht vectoplan-library direkt auf.
Er ruft ausschließlich /editor/api/inventory auf.
```

### `api/editor_inventory_normalize.ts`

Aktuelle Rolle:

- normalisiert rohe Inventory-Payloads
- füllt Hotbar-Slots
- erzeugt stabile LibraryRef-/PlacementCommand-Strukturen
- filtert Debug-Blöcke
- macht nur echte Library-/VPLIB-Slots placeable

Aktuelle Reparatur:

```text
- fehlender getPlaceableInventorySlots-Import ergänzt
- unknown→number Normalisierung stabilisiert
- Success-/Failure-LoadResult-Felder vollständig gemacht
- nicht benötigte Imports bereinigt
- Fehler aus unknown robuster erzeugt
```

Wichtige Regel:

```text
Ein Slot ist nur placeable, wenn:
- nicht leer
- enabled
- source/kind/library identity vorhanden
- runtimeBlockTypeId vorhanden
- runtimeBlockTypeId nicht debug_grass/debug_dirt
```

### `inventory/inventory_slot_factory.ts`

Aktuelle Rolle:

- wandelt verschiedene Inventory-Quellen in ein einheitliches `InventorySlotFactoryResult`
- unterstützt LibraryState, LibraryPayload, LoadResult, Catalog und Legacy-Blocks
- erzeugt DOM-Slot-Modelle, HotbarSlots und Debug-Summaries

Aktuelle Reparatur:

```text
- LoadResult-Union sauber gelesen
- getEditorInventoryLoadError / getEditorInventoryLoadReason genutzt
- Legacy-Chunk-Blocks nur mit allowChunkBlocks akzeptiert
- Fallback-Catalog bei falscher Quelle oder Debug-IDs
```

Noch sichtbarer Restfehler im aktuellen Build:

```text
inventory_slot_factory.ts
→ Property 'objectKind' does not exist on type 'HotbarSlot'
```

Geplante Reparatur:

```text
objectKind defensiv über Record-Zugriff lesen:
unknownRecord(slot)["objectKind"]
```

### `inventory/library_inventory_source.ts`

Aktuelle Rolle:

- Hotbar-kompatible Source für `/editor/api/inventory`
- kapselt EditorInventoryApiClient
- liefert Slots, Items, RuntimeSelection und RuntimePlaceable
- unterstützt load, reload, refresh, selectSlot, selectNext, selectPrevious

Aktuelle Reparatur:

```text
- LoadResult-Union sicher behandelt
- getEditorInventoryLoadError / getEditorInventoryLoadReason genutzt
- selectSlot/reload/refresh-Kompatibilität erhalten
- RuntimePlaceable mit LibraryRef und PlacementCommand abgesichert
```

Wichtige Regel:

```text
LibraryInventorySource ist der bevorzugte Hotbar-Quellen-Typ.
```

### `bootstrap/bootstrap_models.ts`

Aktuelle Rolle:

- zentrale Typ- und Defaultbasis für Bootstrap
- beschreibt Runtime, Chunk, Inventory, Library, Physics, UI, Camera, Render

Aktuelle Reparatur:

```text
- EditorDatasetInventoryGlobals erweitert
- creativeLibraryHealthUrl ergänzt
- creativeLibraryMetadataUrl ergänzt
- Default-Routen für Inventory und Creative Library ergänzt
```

Wichtige Regel:

```text
Bootstrap beschreibt sowohl:
- produktive Inventory-Route /editor/api/inventory
- Creative-Library-Route als serverseitige Proxy-/Library-Fläche
```

### `inventory/chunk_inventory_source.ts`

Aktuelle Rolle:

- Legacy-/Diagnosequelle für Chunk-Blocklisten
- nur explizit erlaubt als Inventory-Quelle
- nicht produktiver Standard

Aktuelle Reparatur:

```text
- domSlots enthalten objectKind
- FactoryResult-WithSelection defensiver gemacht
- Legacy-Load blockiert standardmäßig
- Fallback erzeugt leere nicht-placebare Slots
```

Wichtige Regel:

```text
ChunkInventorySource ist nicht die produktive Hotbar-Quelle.
```

### `inventory/hotbar_controller.ts`

Aktuelle Rolle:

- lädt eine InventorySource
- wandelt Resultate in InventoryCatalog
- synchronisiert Store
- rendert DOM-Hotbar
- verwaltet Auswahl
- liefert SelectedRuntimePlaceable an Runtime/Scene

Aktuelle Reparatur:

```text
- getSelectedRuntimePlaceable() liefert vollständige Pflichtfelder
- libraryItemId, familyId, packageId, vplibUid, variantId, revisionHash, objectKind ergänzt
- Union-Source selectSlot wird defensiv geprüft
- Hotbar bleibt Library-first
```

Wichtige Regel:

```text
HotbarController darf:
- LibraryInventorySource produktiv nutzen
- ChunkInventorySource nur explizit als Legacy akzeptieren
```

### `runtime/world/chunk_service_source.ts`

Aktuelle Rolle:

- konkrete ChunkSource-Implementierung
- verbindet ChunkApiClient, ChunkRegistry und ChunkEditSession
- lädt Chunks
- sendet Commands
- unterstützt placeLibraryItem als semantischen Pfad

Aktuelle Reparatur:

```text
- optionales libraryContext im HTTP-Command über unknown-Cast abgesichert
- canonical ChunkApiCommandPayload bleibt strikt
- Library-Kontext bleibt standardmäßig in Events/EditSession/Snapshots
- HTTP-Command bleibt normalerweise SetBlock(runtimeBlockTypeId)
```

Wichtige Regel:

```text
includeLibraryMetadataInCommand = false
→ keine ungeprüften Library-Felder in HTTP-Command

includeLibraryMetadataInCommand = true
→ opt-in, bewusst über unknown-Cast
```

## 27.2 Noch zu reparierende Dateien aus aktuellem Build-Log

### `config/runtime_config.ts`

Aktuelle sichtbare Fehler:

```text
Property 'inventoryForceRefresh' does not exist on WINDOW_KEYS
Argument of type 'string' is not assignable to parameter of type '"/editor/api/chunk"'
```

Ursache:

```text
- WINDOW_KEYS im echten aktuellen Stand enthält inventoryForceRefresh noch nicht oder nicht an der richtigen Stelle
- eine Funktion erwartet literal DEFAULT_CHUNK_PROXY_BASE_URL statt allgemeinem string
```

Geplanter Fix:

```text
- inventoryForceRefresh Key ergänzen
- zu enge Literal-Typen durch string-kompatible Defaults entschärfen
- readRuntimeConfig / installRuntimeConfigWindowGlobals weiter stabil halten
```

### `scene/scene_runtime.ts`

Aktueller sichtbarer Fehler:

```text
Type '{ destroy?: ... }' is not assignable to HotbarInventorySourceHandle
Property 'load' is missing
```

Ursache:

```text
libraryInventorySource wurde lokal zu schwach typisiert:
{ destroy?: (...) => void }
```

Geplanter Fix:

```text
- LibraryInventorySourceHandle oder HotbarInventorySourceHandle importieren
- libraryInventorySource entsprechend typisieren
- createLibraryInventorySource nicht auf schwachen Typ casten
```

Wichtige funktionale Zielrichtung:

```text
SceneRuntime soll:
- LibraryInventorySource erzeugen
- HotbarController damit initialisieren
- Input-LibraryPlacement-Kontext verwenden
- placeLibraryItem statt blindem setBlock nutzen
```

### `state/editor_store.ts`

Aktuelle sichtbare Fehler:

```text
Property 'connection' does not exist on type '{}'
Property 'runtime' does not exist on type '{}'
Property 'featureFlags' does not exist on type '{}'
Property 'items' does not exist on type '{}'
...
```

Ursache:

```text
isRecord(...) ? x : {}
→ TypeScript inferiert {}
→ danach sind Property-Zugriffe verboten
```

Geplanter Fix:

```text
- lokale Variablen explizit als Record<string, unknown> typisieren
- readRecord()/readNestedRecord()-Helper nutzen
- arrayItems und safeNullableString weiter defensiv verwenden
```

Wichtige Regel:

```text
EditorStore soll keine fachlichen Inventory-Daten mutieren.
Er soll nur Diagnose/Invariants berichten.
```

---

# 28. Aktualisierte Datei-Funktionsmatrix

Diese Matrix ergänzt die ausführlichen Kapitel oben. Sie ist als schnelle Orientierung gedacht, wenn eine Datei geändert werden muss.

## 28.1 API

| Datei | Funktion | Aktueller Migrationsstatus |
|---|---|---|
| `api/chunk_api_client.ts` | Technischer Client für `/editor/api/chunk`, Chunks und Commands. | Repariert; Blocks nur Legacy/Diagnose. |
| `api/chunk_api_models.ts` | Strikte API-Verträge für Chunk-Service. | Weiterhin Grundlage; Command-Union bleibt strikt. |
| `api/chunk_api_normalize.ts` | Normalisiert Chunk-Service-Payloads. | Stabil, aber enthält Legacy-Blockkonzepte. |
| `api/chunk_api_errors.ts` | Normalisiert API-/HTTP-/Abort-/Payload-Fehler. | Stabil. |
| `api/http_client.ts` | Fetch/JSON/Timeout/Abort-Helfer. | Stabil. |
| `api/editor_inventory_models.ts` | Typbasis für `/editor/api/inventory`. | Repariert; LoadResult und Window-Globals stabilisiert. |
| `api/editor_inventory_api_client.ts` | Lädt produktives Editor-Inventory. | Repariert; keine Direct-Library-Calls. |
| `api/editor_inventory_normalize.ts` | Normalisiert Library-/VPLIB-Inventory. | Repariert; Debug-IDs blockiert. |

## 28.2 Bootstrap/Config

| Datei | Funktion | Aktueller Migrationsstatus |
|---|---|---|
| `bootstrap/bootstrap_models.ts` | Bootstrap-Typen und Defaults. | Repariert; CreativeLibrary-Dataset-Felder ergänzt. |
| `bootstrap/default_bootstrap.ts` | erzeugt Default-Bootstrap. | Prüfen, ob Defaults noch Chunk-Inventory bevorzugen. |
| `bootstrap/normalize_bootstrap.ts` | normalisiert Bootstrap. | Prüfen, ob Inventory/Library-Felder komplett synchron sind. |
| `bootstrap/read_bootstrap.ts` | liest Window/Dataset/Fallback-Bootstrap. | Fehler durch Models-Fix adressiert. |
| `config/runtime_config.ts` | liest RuntimeConfig vor Bootstrap. | Noch Typecheck-Restfehler offen. |

## 28.3 Inventory/Hotbar

| Datei | Funktion | Aktueller Migrationsstatus |
|---|---|---|
| `inventory/inventory_models.ts` | Domainmodell für Catalog, Items, HotbarSlots. | Library-first; vermutlich stabil. |
| `inventory/inventory_selection.ts` | Slot-/Item-Auswahl und Wheel-Navigation. | Library-first; vermutlich stabil. |
| `inventory/inventory_slot_factory.ts` | vereinheitlicht Inventory-Quellen. | Noch objectKind-Typfix offen. |
| `inventory/library_inventory_source.ts` | produktive Source für `/editor/api/inventory`. | Repariert. |
| `inventory/chunk_inventory_source.ts` | Legacy-/Diagnose-Source für Chunk-Blocks. | Repariert; opt-in. |
| `inventory/hotbar_controller.ts` | lädt, selektiert, rendert Hotbar. | Repariert; ggf. nach neuem Build prüfen. |

## 28.4 Runtime/World

| Datei | Funktion | Aktueller Migrationsstatus |
|---|---|---|
| `runtime/world/chunk_source.ts` | abstrakte World-/Command-Source. | Library-aware. |
| `runtime/world/chunk_service_source.ts` | konkrete Remote-Source zum Chunk-Service. | Repariert; optionaler libraryContext-Cast. |
| `runtime/world/chunk_edit_session.ts` | erzeugt Commands und hält Placement-History. | LibraryPlacement-aware. |
| `runtime/world/chunk_loader.ts` | lädt initiale, sichtbare und dirty Chunks. | Library-neutral. |
| `runtime/world/chunk_registry.ts` | lokaler Chunk-Cache, Sampling, Collision. | Library-neutral. |
| `runtime/world/chunk_content.ts` | normalisiert Chunk-Inhalte. | Library-neutral. |
| `runtime/world/chunk_coordinates.ts` | Chunk-/Cell-Koordinaten. | Library-neutral. |
| `runtime/world/world_runtime.ts` | orchestriert Source, Loader, Registry. | Sollte kein produktives Inventory mehr dispatchen. |

## 28.5 Scene/Input/UI

| Datei | Funktion | Aktueller Migrationsstatus |
|---|---|---|
| `scene/scene_runtime.ts` | aktive Browser-SceneRuntime. | Noch Source-Typfix offen. |
| `input/input_controller.ts` | erzeugt Placement-/Remove-/Movement-Intents. | LibraryPlacement-Kontext vorbereitet. |
| `input/input_state.ts` | hält Keyboard/Pointer/Wheel-State. | Library-neutral. |
| `input/keyboard_input.ts` | Keyboard-Events. | Library-neutral, Hotbar-Tasten relevant. |
| `input/mouse_input.ts` | Pointer/Mouse/Wheel-Events. | Library-neutral, Hotbar-Wheel relevant. |
| `input/pointer_lock.ts` | PointerLock. | Library-neutral. |
| `ui/hotbar_view.ts` | UI-Hotbar. | Library-first. |
| `ui/editor_ui_runtime.ts` | UI-Orchestrator. | Nutzt HotbarView und Store. |
| `ui/status_bar.ts` | Statusanzeige. | Block-Begriffe ggf. künftig in RuntimeBlockTypeId umbenennen. |
| `ui/crosshair_view.ts` | Crosshair. | Library-neutral. |
| `ui/loading_overlay.ts` | Loading UI. | Library-neutral. |
| `ui/error_panel.ts` | Fehlerpanel. | Library-neutral. |
| `ui/debug_overlay.ts` | Debug UI. | Sollte Library-Felder stärker anzeigen. |

## 28.6 State

| Datei | Funktion | Aktueller Migrationsstatus |
|---|---|---|
| `state/editor_state.ts` | zentrales State-Modell. | Library-/VPLIB-aware. |
| `state/state_actions.ts` | Reducer/Actions. | LibraryInventory-Actions vorhanden; prüfen nach Store-Fix. |
| `state/state_selectors.ts` | abgeleitete State-Leser. | LibraryPlacement-Selectoren vorhanden. |
| `state/editor_store.ts` | Store + Diagnose. | Noch Record-Typfix offen. |
| `state/player_state.ts` | Physics→Store-Bridge. | Library-neutral. |

---

# 29. Zielzustand nach Abschluss der aktuellen Reparaturserie

Nach Abschluss der TypeScript-Reparaturen soll der Build wieder so laufen:

```text
docker compose up -d --build
→ vectoplan-editor frontend-builder
→ npm run typecheck
→ erfolgreich
→ npm run build/build:only
→ manifest.json vorhanden
→ Editor-Container startet
```

Fachlich soll danach gelten:

```text
Hotbar:
  nur Library-/VPLIB-Items

Inventory:
  /editor/api/inventory

Creative Library:
  serverseitig über Editor-/Library-Routen

Placement:
  Library-/VPLIB-Kontext aus Hotbar/Input
  → placeLibraryItem()
  → SetBlock(runtimeBlockTypeId) als technischer Adapter

Chunk-Blocks:
  Diagnose/Legacy only

Debug-Blocks:
  debug_grass/debug_dirt blockiert
```

---

# 30. Wichtige Invarianten für zukünftige Änderungen

Diese Invarianten sollten bei jeder weiteren Datei gelten.

## 30.1 Inventory-Invarianten

```text
- onlyLibraryItemsPlaceable = true
- debugGrassDirtAllowed = false
- allowChunkPlaceableFallback = false
- legacyChunkInventoryEnabled = false
- chunkServiceInventoryEnabled = false
- chunkPaletteInventoryFallbackEnabled = false
- placeableBlocksPlaceholderRouteEnabled = false
```

## 30.2 Placement-Invarianten

```text
Ein Placement braucht:
- runtimeBlockTypeId
- Library-Identität:
  - libraryRef oder
  - placementCommand oder
  - familyId oder
  - vplibUid oder
  - libraryItemId

Nicht ausreichend:
- nur blockTypeId ohne Library-Identität
```

## 30.3 Backend-Kompatibilität

```text
Der Chunk-Service erhält weiterhin:
SetBlock(position, blockTypeId = runtimeBlockTypeId)

Library-Kontext bleibt standardmäßig:
- in EditSession
- in Source Events
- in Snapshots
- in Debug-Metadata

Library-Kontext wird nicht ungeprüft in den HTTP-Command geschrieben.
```

## 30.4 UI-Invarianten

```text
- leere Slots dürfen sichtbar sein
- leere Slots dürfen nicht placeable sein
- Legacy-Block-Slots dürfen nicht aktiv sein, außer explizit allowLegacyChunkInventory
- Hotbar-Wheel soll leere/ungültige Slots überspringen
- UI soll selectedRuntimeBlockTypeId und Library-Identität diagnostisch anzeigen
```

---

# 31. Empfohlene nächste Reparaturreihenfolge

Nach dem aktuellen Stand ist die sinnvollste Reihenfolge:

```text
1. config/runtime_config.ts
   - inventoryForceRefresh Key
   - Literal-String-Problem um DEFAULT_CHUNK_PROXY_BASE_URL

2. inventory/inventory_slot_factory.ts
   - objectKind defensiv aus HotbarSlot lesen

3. scene/scene_runtime.ts
   - libraryInventorySource korrekt typisieren

4. state/editor_store.ts
   - Record-Zugriffe typisieren

5. erneuter docker compose up -d --build

6. falls neue Fehler kommen:
   - nur nach aktueller Fehlerliste weiterarbeiten
```

Der Hotbar-Controller und ChunkServiceSource wurden bereits mit passenden vollständigen Dateien vorbereitet; beim nächsten Build sollte sichtbar werden, ob dort noch neue Folgefehler entstehen.

---

# 32. Zusammenfassung der aktuellen Arbeit in einem Satz

Wir machen den Editor gerade von einer alten Chunk-Block-Hotbar zu einer Library-/VPLIB-only-Hotbar, wobei `/editor/api/inventory` die produktive Inventory-Wahrheit ist und `runtimeBlockTypeId` nur noch als technischer Adapter für den weiterhin kompatiblen Chunk-Service-Command dient.

