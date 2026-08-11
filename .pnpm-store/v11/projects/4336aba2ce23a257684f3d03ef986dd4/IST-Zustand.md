<!-- services/vectoplan-editor/IST-Zustand.md -->

# VECTOPLAN Editor – IST-Zustand

## 0. Datei

```text
Ordner: services/vectoplan-editor
Datei: IST-Zustand.md
Pfad: services/vectoplan-editor/IST-Zustand.md
Stand: 2026-08-10
Status: Remote-Chunk-Service-Editor mit synchronisierter Flurstücksauswahl, WorldEdit, festem Grundstücksraster v7, semantischen Polygon-/MultiPolygon-Footprints und persistenter PlaceObject-Migration. Ältere Diagnoseabschnitte bleiben als Reparaturhistorie erhalten; bei Widersprüchen gilt die Aktualisierung 0.0 und die verlinkte Fachdokumentation.
```

Dieses Dokument beschreibt den aktuellen technischen IST-Zustand des Services:

```text
services/vectoplan-editor
```

Die produktive Frontend-Wahrheit liegt weiterhin unter:

```text
services/vectoplan-editor/src/frontend
```

Wichtig:

```text
Aktive Browser-SceneRuntime:
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts

Nicht als aktive Browser-Runtime behandeln:
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

Die Datei unter `src/frontend/runtime/scene/scene_runtime.ts` kann noch existieren, ist aber nicht die aktuell im Browser genutzte Runtime. Die aktive Runtime mit Renderer, Kamera, UI, WorldRuntime und Physics-Anbindung liegt unter `src/frontend/scene/scene_runtime.ts`.


## 0.0 Aktualisierung 2026-08-10: Grundstücksraster v7 und persistente Geometrie

Die verbindliche Detaildokumentation liegt unter
[`docs/PARCEL_GRID_AND_WORLDEDIT.md`](docs/PARCEL_GRID_AND_WORLDEDIT.md).

Aktueller produktiver Platzierungspfad:

```text
normale Rasterzelle
  -> SetBlock

gültige schräge Grundstücksrasterzelle
  -> Polygonüberlappung und exakter Trefferpunkt gegen die gerenderten v7-Zellen
  -> PlaceObject(objectKind=semantic_footprint)
  -> WorldObjectInstance + WorldObjectChunkRef
  -> ChunkSnapshot.objectRefs + ChunkEvent
  -> Form bleibt nach Reload erhalten
```

Der alte Befund „Library-Placement wird immer als SetBlock adaptiert“ ist damit
nur noch für normale Voxel und Legacy-Pfade gültig. Bereits gespeicherte
SetBlock-Benutzerzellen im Grundstücksraster werden in der aktiven
`src/frontend/scene/scene_runtime.ts` sofort semantisch gerendert und im
Leerlauf in Batches von maximal 24 Einträgen zu `PlaceObject` migriert.

Das rote Raster und die ausgewählten Grundstücksflächen verwenden eine feste
horizontale Ebene. Terrain- oder Benutzerblöcke verändern diese Ebene nicht.
Der Standard besteht aus 0–3 m Schrägzone, einem lückenlos auf die benachbarten
logischen Blöcke verteilten Übergang und geradem Innenraster. Zusammengesetzte
Blöcke werden als MultiPolygon gespeichert. Rasterkonfigurationen bleiben über
Abwahl, erneute Auswahl und Reload pro Flurstück erhalten.

Die Abschnitte ab Kapitel 1 dokumentieren zusätzlich historische Debug- und
Reparaturstände. Aussagen zu offenem Reload-Nachweis, ausschließlich
rechteckigem SetBlock-Placement oder fehlenden WorldEdit-Werkzeugen sind durch
diese Aktualisierung überholt.


## 0.1 Aktualisierung 2026-07-28: Multiplayer und realistisches Umgebungslicht

Neu im aktiven IST-Zustand:

```text
/editor/realtime
- WebSocket-Raum je projectId:worldId
- Remote-Avatare mit Namen, Interpolation und Bewegungsanimation
- lokale Commands veröffentlichen Chunk-Invalidierungen
- andere Clients laden betroffene Chunks erneut aus vectoplan-chunk

render/environment_system.ts
- physikalischer Himmel
- Sonne aus Datum, lokaler Uhrzeit und optionaler Georeferenz
- laufender Sonnenstand, ACES-Tonemapping und PCF-Schatten
- Tageszeitsteuerung direkt im Viewport
```

`vectoplan-chunk` bleibt die einzige Weltwahrheit. Der Realtime-Hub speichert keine Welt, sondern ausschließlich flüchtige Teilnehmerzustände und Invalidierungshinweise. Der Hub ist derzeit prozesslokal; das Docker-Standardprofil verwendet deshalb einen Gunicorn-Worker. Scale-out benötigt einen externen Broker.

## 0.2 Aktualisierung 2026-07-28: Editor-Vorschau für den Library-Generator

Neu ist eine zweite, ausdrücklich isolierte Editor-Laufzeit:

```text
/editor/test-generator
/editor/generator-preview
```

Sie verwendet das gebaute Editor-Frontend, `ThreeContext` und `EnvironmentSystem`, aber keinen normalen Editor-Bootstrap. Deshalb werden weder `vectoplan-chunk` noch Inventory oder Realtime initialisiert.

Der Browser-Nachweis lautet: HTTP 200, Runtime-Mode `generator-preview`, Chunk/Inventory/Realtime `disabled`, iframe unter `http://127.0.0.1:5101/create`, sichtbarer Block mit Himmel, Sonne und Schatten sowie live übernommene Formularänderungen.

Unterstützte Geometriequellen sind Primitive sowie GLB, GLTF, OBJ, STL und FBX. Die Kommunikation mit `vectoplan-library` läuft ausschließlich browserseitig über `postMessage` und den Vertrag `vectoplan-generator-preview.v1`.

## 1. Aktueller Hauptbefund

Der `vectoplan-editor` läuft aktuell als Remote-Chunk-Service-Editor mit funktionierendem App-/Chunk-Kontext, Editor-Proxy, Browser-Runtime, Mouse-Look, WASD-Input und temporärer NoClip-Bewegung.

Der wichtigste neue Befund aus der letzten Debug-Runde:

```text
WASD/Input ist korrekt.
PhysicsRuntime läuft.
Camera folgt Physics.
Der normale Collision-Solver blockiert aktuell jede horizontale Player-Bewegung.
Temporär ist Player-NoClip im player_physics_controller.ts aktiviert, damit der Builder sich wieder bewegen kann.
```

Aktueller Browser-Stand:

```text
http://localhost:5100/editor
→ Editor lädt
→ Fullscreen-Canvas startet
→ WorldRuntime und SceneRuntime starten
→ Chunk-Service wird über /editor/api/chunk angesprochen
→ Browser verwendet nicht mehr direkt vectoplan-chunk oder den App-Port für Chunk-Routen
→ app_project_id und chunk_project_id sind getrennt
→ Chunk-Routen nutzen chunk_project_id
→ World-Routen nutzen world_spawn
→ POST /projects/<chunk_project_id>/worlds/world_spawn/chunks/batch liefert HTTP 200
→ ChunkServiceSource initialisiert mit korrektem Projekt/world-Kontext
→ ChunkServiceSource speichert geladene Batch-Chunks nun sichtbar in der ChunkRegistry
→ Pointer Lock / Mouse-Look funktioniert
→ W/A/S/D kommt korrekt im Physics-MovementIntent an
→ normale Player-Collision erzeugt input_blocked_by_axis und hält Position fest
→ temporärer NoClip erlaubt Bewegung durch Blöcke
```

Aktuell nicht als final abgeschlossen betrachten:

```text
- Normale Player-Collision ist fachlich noch defekt.
- voxel_collision_solver.ts / BlockCollisionQuery / Player-AABB müssen als nächstes repariert werden.
- Temporärer NoClip ist kein Zielzustand, sondern nur eine Entwicklungsüberbrückung.
- Hotbar/Library/Place/Remove nach der NoClip-Änderung erneut manuell prüfen.
- Historischer Prüfpunkt: Reload-Persistenz war für SetBlock/RemoveBlock offen;
  normale Voxel und semantische Grundstücksraster-`PlaceObject`-Footprints sind
  im aktuellen Stand persistent. Ein vollständiger manueller Nachweis der
  automatischen Legacy-Migration benötigt weiterhin ein angemeldetes Projekt.
- Chunk-Mesh-/Renderer-Pfad muss nach endgültiger Collision-Reparatur erneut validiert werden.
```

Im Docker-/Compose-Gesamtsystem ist die Public-Browser-URL:

```text
VECTOPLAN_EDITOR_PUBLIC_URL=http://localhost:5100
```

Die interne Docker-URL bleibt serverseitig:

```text
VECTOPLAN_EDITOR_INTERNAL_URL=http://vectoplan-editor:5000
```

Wichtig:

```text
Der Browser darf nicht direkt http://vectoplan-editor:5000 verwenden.
Der Browser nutzt http://localhost:5100/editor oder den App-Embed-Pfad.
```

Der aktuelle produktive Datenpfad ist:

```text
Browser Runtime
→ /editor/api/chunk/...
→ vectoplan-editor Backend-Proxy
→ services/vectoplan-editor/src/clients/chunk_client.py
→ vectoplan-chunk
→ PostgreSQL ChunkSnapshot / ChunkEvent / WorldCommandLog
→ Batch-/Command-Antworten zurück an Editor
→ ChunkServiceSource
→ ChunkRegistry
→ Renderer/Physics/Targeting
```

Der aktuelle App-Embed-Pfad ist:

```text
vectoplan-app
→ /ui/project/<app_project_public_id>/editor
→ vectoplan-editor Public URL
→ /editor?embed=1&...
→ Editor-Bootstrap enthält App-/Chunk-Kontext
→ Editor lädt Chunks über Chunk-Projekt-ID und world_spawn
```

Bestätigter Chunk-Pfad aus Editor-Kontext:

```text
POST /projects/<chunk_project_id>/worlds/world_spawn/chunks/batch
→ HTTP 200
```

Beispiele aus der aktuellen Debug-Runde:

```text
App-Projekt-ID:   prj_...
Chunk-Projekt-ID: chk_prj_prj_..._<suffix>
Chunk-World-ID:   world_spawn
```

Der aktuelle Verantwortungszuschnitt lautet:

```text
Editor:
- rendert/verwaltet die Browser-Runtime
- targetet mit Crosshair
- steuert Kamera/Player
- liest Hotbar/Inventory/Library-Kontext
- sendet SetBlock/RemoveBlock Commands
- nutzt App-/Chunk-Kontext aus Bootstrap/URL
- spricht im Browser nur mit /editor/api/chunk
- besitzt temporären Player-NoClip, bis normale Collision repariert ist

Chunk-Service:
- lädt Chunks
- speichert Snapshots
- schreibt Events
- schreibt CommandLogs
- stellt world_spawn als konkrete editierbare Welt bereit
- meldet Dirty-Chunks zurück

App-Service:
- besitzt App-Projekt
- erzeugt/verwaltet Projekt-Shell
- sorgt über Chunk-Provisioning für Chunk-Projektgraph
- speichert chunk_project_id, chunk_universe_id, chunk_world_id
- embeded den Editor über /ui/project/<project>/editor
```

## 2. Bestätigter Browser- und Runtime-Stand

### 2.1 Backend/Build

```text
- vectoplan-editor Container baut erfolgreich.
- Gunicorn startet.
- /editor liefert die Editor-Seite aus.
- /editor/api/chunk ist als Browser-Pfad angebunden.
- Browser spricht nur mit /editor/api/chunk, nicht direkt mit vectoplan-chunk.
- Chunk-Service-Verbindung wird im Browser als verbunden angezeigt.
- /editor/api/chunk/placeable-blocks liefert die aktuelle Inventory-/Hotbar-Liste.
- /editor/api/chunk/projects/<project>/worlds/<world>/blocks bleibt der Pfad für den vollständigen Blockkatalog / spätere Creative Library.
- Editor kann Chunks für app-provisioned Chunk-Projekte laden.
- Editor kann world_spawn als konkrete Chunk-World nutzen.
```

### 2.2 Frontend

```text
- neue Frontend-Quelle liegt unter services/vectoplan-editor/src/frontend.
- Vite-Build erzeugt static/editor/manifest.json und hashed Assets.
- Flask/Jinja lädt Assets aus dem Manifest.
- Browser lädt das gebaute Modul.
- Runtime startet sichtbar.
- Fullscreen-Viewport funktioniert.
- Canvas füllt den Browser-Viewport.
- Crosshair liegt in der Bildschirmmitte.
- Pointer Lock / Mouse-Look funktioniert.
- W/A/S/D-Input wird korrekt als MovementIntent erkannt:
  - W = intentForward -1
  - S = intentForward 1
  - A = intentRight -1
  - D = intentRight 1
- Sichtbare Bewegung funktioniert aktuell über TEMPORARY_PLAYER_NOCLIP_ENABLED=true.
- Die normale Collision-gebundene Laufbewegung ist noch nicht repariert.
- Hotbar/Library wird initialisiert; nach aktueller NoClip-Änderung erneut gegen echte UI prüfen.
- Linksklick/Rechtsklick-Pfad bleibt vorgesehen, muss nach finalem Collision-/Chunk-Fix erneut E2E geprüft werden.
```

### 2.3 Physics/Collision

```text
- runtime.physics.enabled = true
- featureFlags.physicsEnabled = true
- camera.physicsFollowEnabled = true
- camera.directMovementEnabled = false
- PlayerPhysicsController.step() läuft.
- MovementIntent erreicht die Physics korrekt.
- Diagnose-Events zeigen input_blocked_by_axis bei normaler Collision.
- Position blieb ohne NoClip bei x=8, y=8, z=18 trotz aktivem W/A/S/D.
- Damit ist Keyboard/Input nicht der Fehler.
- Der aktuelle Fehler liegt im Collision-Solver-/AABB-/Query-Pfad.
- TEMPORARY_PLAYER_NOCLIP_ENABLED=true ist aktuell aktiv, damit der Builder sich durch Blöcke bewegen kann.
```

Aktueller Collision-Befund:

```text
Normale Player-Collision ist nicht final einsatzbereit.
Sie blockiert aktuell horizontale Bewegung fälschlich in allen getesteten Richtungen.
```

Aktueller Entwicklungsmodus:

```text
NoClip aktiv:
- Player-Collision wird für die Bewegung übersprungen.
- WASD bewegt den Player/CameraBinding wieder.
- Bewegung durch Blöcke ist temporär erlaubt.
- Das ist nur ein Debug-/Arbeitsmodus, kein Zielzustand.
```

Nächster fachlicher Fix:

```text
services/vectoplan-editor/src/frontend/runtime/physics/voxel_collision_solver.ts
services/vectoplan-editor/src/frontend/runtime/physics/block_collision_query.ts
services/vectoplan-editor/src/frontend/runtime/world/chunk_registry.ts
services/vectoplan-editor/src/frontend/runtime/world/chunk_content.ts
```

### 2.4 App-/Chunk-Kontext

Der Editor muss aktuell drei IDs sauber unterscheiden:

```text
app_project_public_id
→ App-Projekt-ID aus vectoplan-app
→ Beispiel: prj_979eb0a4d8894086a5b2a74b

chunk_project_id
→ Chunk-Projekt-ID aus vectoplan-chunk
→ Beispiel: chk_prj_prj_979eb0a4d8894086a5b2a74b_2653d3872366

chunk_world_id
→ konkrete editierbare Chunk-Welt
→ aktuell: world_spawn
```

Wichtig:

```text
Der Editor darf gegen vectoplan-chunk nicht blind die App-Projekt-ID verwenden,
wenn eine chunk_project_id vorhanden ist.

Für Chunk-Routen gilt:
project_id = chunk_project_id
world_id   = world_spawn
```

Fallback für direkten Dev-Start:

```text
project_id = dev-project
world_id   = world_spawn
```

Provider-/Template-Referenz:

```text
template_id       = flat
provider_world_id = flat
```

Nicht als konkrete Editor-/Chunk-Welt verwenden:

```text
flat
```

---

## 3. Was der Editor aktuell kann

Aktuell ist der Editor eine lauffähige Remote-Chunk-Service-Browser-Runtime mit korrektem App-/Chunk-Kontext, bestätigtem Chunk-Batch-Pfad, funktionierendem Mouse-Look, nachgewiesenem WASD-Input und temporärem Player-NoClip.

```text
Rendering / Viewport
- /editor startet als Fullscreen-Editor.
- Canvas füllt den Browser-Viewport.
- Vite-Assets werden aus static/editor/manifest.json geladen.
- SceneRuntime und WorldRuntime starten.
- Chunk-Service-Anbindung läuft über /editor/api/chunk.
- Batch-Loading gegen chunk_project_id/world_spawn ist bestätigt.
- ChunkServiceSource→ChunkRegistry wurde so repariert, dass geladene Chunks nicht mehr still verworfen werden.
- Chunk-Mesh-/Render-Sichtbarkeit weiterhin nach finalem Collision-Fix prüfen.

Kamera / First Person
- Klick in den Viewport aktiviert Pointer Lock.
- Mausbewegung steuert die Blickrichtung.
- Kamera folgt dem Physics-CameraBinding.
- W/A/S/D kommt korrekt im MovementIntent an.
- Sichtbare Bewegung funktioniert aktuell durch temporären NoClip.

Player Physics
- PhysicsRuntime läuft.
- PlayerPhysicsController läuft.
- MovementIntent erreicht Physics.
- Normale Collision blockiert aktuell jede horizontale Bewegung.
- Das Diagnose-Event lautet input_blocked_by_axis.
- Temporärer NoClip ist aktiviert, damit der Builder arbeitsfähig ist.
- Zielzustand bleibt: korrekte Collision gegen solide Blöcke ohne falsches X/Z-Blockieren.

Block-Interaktion
- SetBlock/RemoveBlock-Pfade sind weiterhin vorgesehen über ChunkServiceSource → ChunkApiClient → /editor/api/chunk.
- Nach aktueller NoClip-/Physics-Änderung müssen Place/Remove und Dirty-Reload erneut E2E geprüft werden.

Inventory / Hotbar
- Hotbar/Library-Initialisierung läuft.
- Die Debug-Warnung zu debug_grass als verbotenem Default ist bekannt.
- Aktive Placeable-/Library-Quelle muss final mit Chunk-Service-Blockkatalog konsolidiert werden.

Remote Chunk Service
- Browser spricht nur mit /editor/api/chunk.
- vectoplan-editor proxyt serverseitig zu vectoplan-chunk.
- Chunks werden per Batch geladen.
- App-provisioned chunk_project_id wird als Chunk-Routenprojekt verwendet.
- world_spawn wird als konkrete editierbare Welt verwendet.

Debug / Diagnose
- Physics-Probe ist ereignisbasiert eingebaut.
- Logs zeigen input_blocked_by_axis bei aktiver Bewegung ohne NoClip.
- NoClip-Bewegung sollte temporary_noclip_moves_player melden.
- Globale Diagnose bleibt über window.__VECTOPLAN_LAST_PHYSICS_PROBE__ verfügbar.
```

Funktionsmatrix:

| Bereich                             | Aktuell | Bestätigt | Bemerkung |
| ----------------------------------- | ------: | --------: | --------- |
| Editor-Seite `/editor`              | ja | ja | Flask/Jinja + Vite Manifest |
| App-Embed `/ui/project/<id>/editor` | ja | grundsätzlich | mehrere Projekte noch testen |
| Fullscreen-Canvas                   | ja | ja | Viewport füllend |
| Remote Chunk Loading                | ja | ja | über `/editor/api/chunk` |
| App-provisioned Chunk-Projekt       | ja | ja | `chk_prj_...` gegen Chunk-Service |
| `world_spawn` als Runtime-Welt      | ja | ja | konkrete editierbare Welt |
| Chunk Rendering                     | teilweise/offen | teilweise | nach Registry-Fix und NoClip erneut prüfen |
| Pointer Lock                        | ja | ja | Browser-Warnung `pointer-lock` ist nicht der Blocker |
| Maus-Look                           | ja | ja | Minecraft/Hytale-artig |
| WASD-Input                          | ja | ja | MovementIntent korrekt |
| Sichtbare Bewegung                  | ja | ja | aktuell durch temporären NoClip |
| Normale Player Collision            | defekt | ja, defekt bestätigt | blockiert X/Z fälschlich |
| Hotbar / Library                    | teilweise | teilweise | initialisiert; Quelle/Default final prüfen |
| SetBlock                            | vorgesehen | erneut prüfen | nach aktueller Änderung E2E testen |
| RemoveBlock                         | vorgesehen | erneut prüfen | nach aktueller Änderung E2E testen |
| Dirty Reload/Remesh                 | vorgesehen | erneut prüfen | nach Commands prüfen |
| Physics Runtime                     | ja | ja | aktiv |
| Flight Toggle                       | vorhanden | erneut prüfen | nach NoClip/Collision-Fix prüfen |
| Creative-Library-UI                 | vorbereitet | nein | blocks-Katalog vorhanden, UI fehlt |
| Persistenz nach Browser-Reload      | offen | nein | separat testen |
| E2E Tests                           | nein | offen | Playwright o. ä. später |

## 4. Harte Pfadentscheidung

Der alte Ordner:

```text
services/vectoplan-editor/frontend
```

ist nicht mehr die produktive Frontend-Wahrheit.

Neue Quelle:

```text
services/vectoplan-editor/src/frontend
```

Zusätzliche wichtige SceneRuntime-Entscheidung:

```text
Aktiv genutzt:
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts

Nicht aktiv für Browser-Runtime:
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

Der alte Ordner und verwaiste Runtime-Dateien können gelöscht oder zusammengeführt werden, sobald keine produktiven Imports, Build-Scripts, Docker-Steps, Templates oder ENV-Werte mehr darauf zeigen.

Prüfung:

```bash
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend|vectoplan-editor/frontend" services/vectoplan-editor .
rg -n "runtime/scene/scene_runtime|from .*runtime/scene|@runtime/scene" services/vectoplan-editor/src/frontend
rg -n "renderOnce|getUiRuntime" services/vectoplan-editor/src/frontend
```

PowerShell-Variante:

```powershell
Get-ChildItem ".\services\vectoplan-editor\src\frontend" -Recurse -Include *.ts,*.tsx |
  Select-String "renderOnce|getUiRuntime" |
  Format-List Path,LineNumber,Line
```

Akzeptanz:

```text
Produktive SceneRuntime ist eindeutig src/frontend/scene/scene_runtime.ts.
Keine produktiven Pfade zeigen mehr auf services/vectoplan-editor/frontend.
```

---

## 5. Service-Rolle im Gesamtsystem

### 5.1 Rolle des Editors

Der Editor ist aktuell:

```text
3D-Editor
Browser-Runtime
First-Person-/Builder-UI
Chunk-Renderer
Chunk-Command-Client
Hotbar-/Inventory-UI
lokale Player-Physics
Collision-Client gegen geladene Chunk-Zellen
```

Nicht seine Rolle:

```text
Projektverwaltung
App-Projekt-Wahrheit
Chunk-Persistenz-Wahrheit
PostgreSQL-Zugriff
Direkte DB-Kommunikation
LV-Wahrheit
2D-CAD-Wahrheit
OpenLayer-Wahrheit
```

Der Editor speichert keine Wahrheit direkt. Er sendet Commands an den Chunk-Service.

---

### 5.2 Verhältnis zu `vectoplan-app`

`vectoplan-app` ist die Portal- und Projekt-Shell.

App-Pfad:

```text
http://localhost:5103/project=<app_project_public_id>
```

App-Embed in Editor:

```text
/ui/project/<app_project_public_id>/editor
```

Die App sorgt dafür, dass für ein App-Projekt ein Chunk-Projektgraph existiert:

```text
App Project
→ Chunk Project
→ Chunk Universe
→ WorldInstance world_spawn
```

Editor-Aufgabe:

```text
vom App-/Editor-Bootstrap erhaltenen Chunk-Kontext verwenden
Chunks laden
Welt rendern
Commands senden
Dirty-Chunks neu laden
```

---

### 5.3 Verhältnis zu `vectoplan-chunk`

`vectoplan-chunk` ist die Wahrheit für:

```text
Chunk-Projekte
Universes
WorldInstances
ChunkSnapshots
ChunkEvents
WorldCommandLogs
BlockRegistry / BlockTypes
```

Editor spricht über Backend-Proxy:

```text
Browser
→ /editor/api/chunk
→ vectoplan-editor routes/chunk.py
→ src/clients/chunk_client.py
→ http://vectoplan-chunk:5000
```

Der Browser darf nicht direkt mit `vectoplan-chunk` sprechen.

---

## 6. Backend- und Service-Dateien

### 6.1 `config.py`

Datei:

```text
services/vectoplan-editor/config.py
```

Rolle:

```text
zentrale Konfiguration für Editor-Service, Public/Internal-URLs,
Chunk-Service-Proxy, Bootstrap-Defaults, Feature-Flags und Runtime-Parameter.
```

Aktuell relevante Konfigurationswerte:

```text
VECTOPLAN_EDITOR_PUBLIC_URL=http://localhost:5100
VECTOPLAN_EDITOR_INTERNAL_URL=http://vectoplan-editor:5000
VECTOPLAN_CHUNK_INTERNAL_URL=http://vectoplan-chunk:5000

Default project fallback = dev-project
Default world fallback   = world_spawn
Default template         = flat
Provider world           = flat
```

Wichtige Regel:

```text
config.py darf keine Browser-URLs mit Docker-internen Hostnamen mischen.
```

Browser/Public:

```text
http://localhost:5100
```

Server/Internal:

```text
http://vectoplan-chunk:5000
```

---

### 6.2 `routes/editor.py`

Datei:

```text
services/vectoplan-editor/routes/editor.py
```

Rolle:

```text
liefert die Editor-Seite /editor aus
baut den Bootstrap-Kontext
liest Vite manifest.json
übergibt Assets an Jinja
setzt App-/Chunk-/World-Kontext in Bootstrap/Dataset
```

Aufgaben:

```text
- /editor rendern
- query params normalisieren
- embed=1 unterstützen
- App-Projekt-Kontext übernehmen
- Chunk-Projekt-Kontext übernehmen
- world_spawn als Default-Welt setzen
- Vite-Manifest laden
- hashed Assets aus static/editor/assets einbinden
- FeatureFlags/RuntimeConfig in Bootstrap ausgeben
```

Wichtig:

```text
routes/editor.py ist kein Chunk-Persistenzpfad.
Es liefert nur HTML/Bootstrap/Assets.
```

---

### 6.3 `routes/chunk.py`

Datei:

```text
services/vectoplan-editor/routes/chunk.py
```

Rolle:

```text
Browser-sicherer Proxy von /editor/api/chunk nach vectoplan-chunk.
```

Aufgaben:

```text
- Chunk-Service-Status abfragen
- Connection-Test abfragen
- Project-Bootstrap proxien
- placeable-blocks proxien
- block catalog proxien
- chunk GET proxien
- chunk batch POST proxien
- command POST proxien
- Fehler normalisieren
```

Browser-Pfad:

```text
/editor/api/chunk
```

Interner Zielservice:

```text
http://vectoplan-chunk:5000
```

Wichtig:

```text
Der Browser sieht vectoplan-chunk:5000 nie direkt.
```

---

### 6.4 `src/clients/chunk_client.py`

Datei:

```text
services/vectoplan-editor/src/clients/chunk_client.py
```

Rolle:

```text
serverseitiger HTTP-Client des Editors zum Chunk-Service.
```

Aufgaben:

```text
- HTTP-Requests an vectoplan-chunk ausführen
- Timeouts setzen
- JSON normalisieren
- Fehler strukturiert zurückgeben
- App-/Chunk-Projekt-ID in Routen einsetzen
- world_spawn als konkrete Welt verwenden
```

Wichtige Zielrouten:

```text
GET  /projects/_status
GET  /chunks/_status
GET  /projects/<chunk_project_id>/worlds/<world_id>/blocks
GET  /projects/<chunk_project_id>/worlds/<world_id>/chunks
POST /projects/<chunk_project_id>/worlds/<world_id>/chunks/batch
POST /projects/<chunk_project_id>/worlds/<world_id>/commands
```

---

### 6.5 `src/bootstrap/__init__.py`

Datei:

```text
services/vectoplan-editor/src/bootstrap/__init__.py
```

Rolle:

```text
serverseitige Bootstrap-Helfer und Kompatibilitätsfläche für Editor-Initialisierung.
```

Aktuelle Aufgabe:

```text
zentrale Bootstrap-Imports stabilisieren
Editor-Bootstrap modular vorbereiten
ältere Imports kompatibel halten
```

Wichtig:

```text
Diese Datei ist nicht die Frontend-Bootstrap-Quelle.
Frontend-Bootstrap liegt unter src/frontend/bootstrap/*.
```

---

## 7. Umfangreiche Ordner- und File-Struktur unter `src/frontend`

Die produktive Frontend-Wahrheit liegt unter:

```text
services/vectoplan-editor/src/frontend
```

Die aktuell aktive Browser-SceneRuntime liegt unter:

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

Nicht verwechseln mit:

```text
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

Diese zweite Datei kann noch im Baum liegen, ist aber aktuell nicht die Runtime, die im Browser die Methoden `renderOnce`, `getRenderer`, `getScene`, `getCamera` und `getUiRuntime` bereitstellt.

---

### 7.1 Gesamtstruktur

```text
services/vectoplan-editor/
├── Dockerfile
├── entrypoint.sh
├── config.py
├── routes/
│   ├── editor.py
│   └── chunk.py
├── src/
│   ├── bootstrap/
│   │   └── __init__.py
│   ├── clients/
│   │   └── chunk_client.py
│   └── frontend/
│       ├── api/
│       │   ├── chunk_api_client.ts
│       │   ├── chunk_api_errors.ts
│       │   ├── chunk_api_models.ts
│       │   ├── chunk_api_normalize.ts
│       │   └── http_client.ts
│       ├── bootstrap/
│       │   ├── bootstrap_models.ts
│       │   ├── default_bootstrap.ts
│       │   ├── normalize_bootstrap.ts
│       │   └── read_bootstrap.ts
│       ├── camera/
│       │   ├── camera_movement_math.ts
│       │   ├── camera_state.ts
│       │   └── first_person_camera_controller.ts
│       ├── config/
│       │   └── runtime_config.ts
│       ├── dom/
│       │   ├── dom_refs.ts
│       │   └── resize_observer.ts
│       ├── input/
│       │   ├── input_controller.ts
│       │   ├── input_state.ts
│       │   ├── keyboard_input.ts
│       │   ├── mouse_input.ts
│       │   └── pointer_lock.ts
│       ├── inventory/
│       │   ├── chunk_inventory_source.ts
│       │   ├── hotbar_controller.ts
│       │   ├── inventory_models.ts
│       │   ├── inventory_selection.ts
│       │   └── inventory_slot_factory.ts
│       ├── render/
│       │   ├── chunk_mesher.ts
│       │   ├── chunk_scene.ts
│       │   ├── debug_overlay.ts
│       │   ├── preview_renderer.ts
│       │   └── three_context.ts
│       ├── runtime/
│       │   ├── physics/
│       │   │   ├── block_collision_query.ts
│       │   │   ├── double_tap_detector.ts
│       │   │   ├── physics_defaults.ts
│       │   │   ├── physics_models.ts
│       │   │   ├── physics_runtime.ts
│       │   │   ├── player_physics_controller.ts
│       │   │   └── voxel_collision_solver.ts
│       │   ├── scene/
│       │   │   ├── scene_chunk_tools.ts
│       │   │   ├── scene_lifecycle.ts
│       │   │   ├── scene_loop.ts
│       │   │   ├── scene_runtime.ts
│       │   │   └── scene_world_bridge.ts
│       │   └── world/
│       │       ├── chunk_content.ts
│       │       ├── chunk_coordinates.ts
│       │       ├── chunk_edit_session.ts
│       │       ├── chunk_loader.ts
│       │       ├── chunk_registry.ts
│       │       ├── chunk_service_source.ts
│       │       ├── chunk_source.ts
│       │       └── world_runtime.ts
│       ├── scene/
│       │   └── scene_runtime.ts
│       ├── state/
│       │   ├── editor_state.ts
│       │   ├── editor_store.ts
│       │   ├── player_state.ts
│       │   ├── state_actions.ts
│       │   └── state_selectors.ts
│       ├── targeting/
│       │   └── chunk_targeting.ts
│       ├── ui/
│       │   ├── crosshair_view.ts
│       │   ├── debug_overlay.ts
│       │   ├── editor_ui_runtime.ts
│       │   ├── error_panel.ts
│       │   ├── hotbar_view.ts
│       │   ├── loading_overlay.ts
│       │   └── status_bar.ts
│       ├── utils/
│       │   ├── ids.ts
│       │   ├── logger.ts
│       │   ├── safe.ts
│       │   └── time.ts
│       ├── main.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── scripts/
├── static/
│   └── editor/
│       ├── manifest.json
│       └── assets/
└── templates/
    └── editor/
        ├── index.html
        └── partials/
            ├── bootstrap_scripts.html
            └── head.html
```

---

### 7.2 Aktive Laufzeitpfade

```text
Browser Entry
→ src/frontend/main.ts
→ Bootstrap lesen/normalisieren
→ EditorRuntime erstellen
→ WorldRuntime erstellen
→ aktive SceneRuntime aus src/frontend/scene/scene_runtime.ts starten
→ InputController + UI + Three.js Renderer + WorldRegistry + PhysicsRuntime verbinden
```

Aktiver Scene-Pfad:

```text
src/frontend/scene/scene_runtime.ts
```

Aufgaben dieser aktiven Datei:

```text
- Three.js WebGLRenderer erzeugen
- Three.js Scene erzeugen
- PerspectiveCamera erzeugen
- Chunks als InstancedMesh rendern
- ResizeObserver anbinden
- EditorUiRuntime starten
- InputController starten
- WorldRuntime initialisieren
- ChunkSource abonnieren
- Targeting über Raycaster aktualisieren
- Place/Remove an WorldRuntime/ChunkSource weiterreichen
- Player Physics erzeugen und pro Frame updaten
- Kamera an Physics-Eye-Position binden
- Store mit Camera/Render/Player/Input/UI-Zustand synchronisieren
```

Aktiver World-/Data-Pfad:

```text
scene/scene_runtime.ts
→ worldRuntime.initialize()
→ runtime/world/world_runtime.ts
→ runtime/world/chunk_service_source.ts
→ api/chunk_api_client.ts
→ /editor/api/chunk
→ routes/chunk.py
→ src/clients/chunk_client.py
→ vectoplan-chunk
```

Aktiver Physics-Pfad:

```text
input/input_controller.ts
→ movementIntent.physics
→ scene/scene_runtime.ts
→ runtime/physics/physics_runtime.ts
→ runtime/physics/player_physics_controller.ts
→ runtime/physics/voxel_collision_solver.ts
→ runtime/physics/block_collision_query.ts
→ worldRuntime.getBlockCollisionQuery()
→ chunk_registry.ts / chunk_content.ts
```

---

## 8. Datei-für-Datei-Beschreibung

### 8.1 Entry und Build

| Datei            | Rolle                              | Kann aktuell                                                     |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `main.ts`        | Frontend-Einstieg für Vite/Browser | Bootstrap lesen, Runtime starten, globale Runtime-Handles setzen |
| `package.json`   | NPM-Scripts und Abhängigkeiten     | typecheck/build/dev/verify, Three.js als Runtime-Abhängigkeit    |
| `tsconfig.json`  | TypeScript-Konfiguration           | Aliase/Strictness für Frontend-Build                             |
| `vite.config.ts` | Vite-Build-Konfiguration           | Manifest erzeugen, Assets nach `static/editor` bauen             |
| `scripts/*`      | Hilfsscripts                       | Build-/Verify-Hilfen je nach vorhandenem Script                  |

---

### 8.2 API-Schicht

| Datei                        | Rolle                                           | Kann aktuell                                                                           |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `api/chunk_api_models.ts`    | Vertragsmodelle Browser ↔ Proxy ↔ Chunk-Service | Status, Blocks, PlaceableBlocks, Chunks, Commands, Errors modellieren                  |
| `api/chunk_api_errors.ts`    | Einheitliche API-Fehler                         | Netzwerk-/HTTP-/Payload-/Timeout-/Command-Fehler normalisieren                         |
| `api/http_client.ts`         | Fetch-Wrapper                                   | JSON laden, Timeout/Abort, strukturierte Fehler liefern                                |
| `api/chunk_api_normalize.ts` | Payload-Normalisierung                          | Blocks/PlaceableBlocks/Chunk/Batch/Command robust normalisieren                        |
| `api/chunk_api_client.ts`    | Browser-Chunk-Client                            | Status, Connection-Test, Blocks, PlaceableBlocks, Chunks, Batch, SetBlock, RemoveBlock |

Wichtig:

```text
api/chunk_api_client.ts spricht nur mit /editor/api/chunk.
```

---

### 8.3 Bootstrap und Runtime-Config

| Datei                              | Rolle                             | Kann aktuell                                                                             |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `bootstrap/bootstrap_models.ts`    | zentrale Bootstrap-Typen/Defaults | Chunk, Input, Camera, Render, Inventory, Physics und FeatureFlags modellieren            |
| `bootstrap/default_bootstrap.ts`   | Fallback-Bootstrap                | sicheren Remote-Chunk-Service-Bootstrap erzeugen                                         |
| `bootstrap/read_bootstrap.ts`      | Rohdaten lesen                    | Window-Globals, Dataset und Fallback lesen                                               |
| `bootstrap/normalize_bootstrap.ts` | Normalisierung                    | alte Payloads auf `vectoplan-editor-bootstrap.v1` bringen, Legacy-Fallbacks deaktivieren |
| `config/runtime_config.ts`         | Runtime-Adapter                   | Bootstrap zu Runtime-Config normalisieren; weiterhin Konfigurationsschicht               |

Aktuelle Kontext-Regeln:

```text
- App-Projekt-ID darf als Kontext vorhanden sein.
- Chunk-Projekt-ID ist für Chunk-Routen maßgeblich.
- world_spawn ist konkrete World.
- flat ist nur Template/Provider.
```

---

### 8.4 DOM-Schicht

| Datei                    | Rolle                    | Kann aktuell                                                          |
| ------------------------ | ------------------------ | --------------------------------------------------------------------- |
| `dom/dom_refs.ts`        | DOM-Hooks zentralisieren | Root, Canvas, Crosshair, Hotbar, LiveRegion, Loading/Error ansprechen |
| `dom/resize_observer.ts` | Viewport-/Canvas-Resize  | Canvas-Größe, DPR, Aspect und Store-Sync aktualisieren                |

---

### 8.5 Input-Schicht

| Datei                                    | Rolle                         | Kann aktuell                                                                                |
| ---------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `input/input_state.ts`                   | zentraler Input-Snapshot      | Keys, ActionKeys, Pointer, Wheel, Deltas und Reset verwalten                                |
| `input/keyboard_input.ts`                | Keyboard-Adapter              | WASD, Space, Shift, Q, Zahlen 1–9, Cancel/Inspect mappen                                    |
| `input/mouse_input.ts`                   | Pointer-/Mouse-/Wheel-Adapter | Pointer Lock, LookDelta, Clicks, Wheel, ContextMenu erfassen                                |
| `input/pointer_lock.ts`                  | Pointer-Lock-Kapsel           | request/exit, pointerlockchange/error, Retry, Store-Sync                                    |
| `input/input_controller.ts`              | Input-Orchestrator            | MovementIntent, BlockIntent, Hotbar-Auswahl, Double-Space-One-Shot, Direct Pointer Fallback |
| `runtime/physics/double_tap_detector.ts` | Double-Tap-Erkennung          | Space-Doppeltipp robust als Toggle-Event erkennen                                           |

---

### 8.6 Kamera-Schicht

| Datei                                      | Rolle                   | Kann aktuell                                                                   |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------ |
| `camera/camera_movement_math.ts`           | Mathe für FPS-Kamera    | Yaw/Pitch, Forward/Right/Up, MouseDelta, Legacy-Movement berechnen             |
| `camera/camera_state.ts`                   | Kamera-State-Modell     | Projection, Position, Rotation, Physics-Follow-Binding verwalten               |
| `camera/first_person_camera_controller.ts` | Three-Camera-Controller | Look anwenden, direkte Bewegung optional, Physics-Binding auf Kamera schreiben |

---

### 8.7 Inventory/Hotbar

| Datei                                 | Rolle                 | Kann aktuell                                                                                          |
| ------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `inventory/inventory_models.ts`       | Inventory-Typen       | Items, Slots, Kataloge, Selection modellieren                                                         |
| `inventory/inventory_selection.ts`    | Auswahlregeln         | Slot-/Blockauswahl normalisieren                                                                      |
| `inventory/inventory_slot_factory.ts` | Slot-Erzeugung        | Backend-Blockdaten zu Hotbar-Slots machen, leere Slots auffüllen                                      |
| `inventory/chunk_inventory_source.ts` | Inventory-Quelle      | PlaceableBlocks laden, Fallbacks erzeugen, Catalog/Snapshot bereitstellen                             |
| `inventory/hotbar_controller.ts`      | Hotbar-Orchestrierung | Slots rendern, Auswahl, Store-Sync, LiveMessages; Keyboard/Wheel aktuell zentral über InputController |

Aktuelle aktive Blocktypen:

```text
debug_grass
debug_dirt
```

---

### 8.8 World-/Chunk-Runtime

| Datei                                   | Rolle                | Kann aktuell                                                                          |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `runtime/world/chunk_coordinates.ts`    | Koordinatenlogik     | World ↔ Chunk ↔ Local ↔ CellIndex, AABB/Range-Helfer, negative Koordinaten robust     |
| `runtime/world/chunk_content.ts`        | Chunk-Normalisierung | Cells/Palette/Stats/Solid-Infos erzeugen, Unknown Non-Air fail-closed solid behandeln |
| `runtime/world/chunk_registry.ts`       | Client-Registry      | Chunks, sichtbare/dirty/failed Keys, Cell-Sampling, Collision-Reader bereitstellen    |
| `runtime/world/chunk_source.ts`         | Source-Vertrag       | Source Events, Capabilities, Dirty-Tracking, Stats definieren                         |
| `runtime/world/chunk_service_source.ts` | Remote-Source        | ChunkApiClient anbinden, Chunks/Blocks/Commands/Dirty-Reload ausführen                |
| `runtime/world/chunk_loader.ts`         | Ladestrategie        | Initial, AroundPosition, AroundChunk, Dirty-Reload laden                              |
| `runtime/world/world_runtime.ts`        | World-Orchestrator   | Source, Loader, Registry, Store und CollisionQuery zusammenführen                     |
| `runtime/world/chunk_edit_session.ts`   | Edit-Session-Helfer  | lokale/remote Edit-Kontexte und Dirty-Zusammenhänge vorbereiten                       |

---

### 8.9 Physics-Runtime

| Datei                                          | Rolle                   | Aktueller Stand |
| ---------------------------------------------- | ----------------------- | --------------- |
| `runtime/physics/physics_models.ts`            | Physics-Typen           | Vectors, AABB, PlayerState, MovementIntent, CameraBinding, Snapshots definieren |
| `runtime/physics/physics_defaults.ts`          | Defaults/Normalisierung | Movement, Gravity, Collider, MissingChunkPolicy, Debug Defaults erzeugen |
| `runtime/physics/physics_runtime.ts`           | Frame-Orchestrator      | Fixed/Frame-Step, PlayerController, Query, Snapshot, CameraBinding koordinieren |
| `runtime/physics/player_physics_controller.ts` | Player-Bewegung         | Movement/CameraBinding läuft; TEMPORARY_PLAYER_NOCLIP_ENABLED ist aktuell aktiv |
| `runtime/physics/block_collision_query.ts`     | Collision-Abfrage       | AABB gegen WorldCells abfragen; missing/unknown Policy muss im Solver-Kontext geprüft werden |
| `runtime/physics/voxel_collision_solver.ts`    | Voxel-Solver            | aktueller Hauptverdacht: blockiert horizontale Bewegung fälschlich |
| `runtime/physics/double_tap_detector.ts`       | Input-Event-Filter      | Space-Doppeltipp als stabilen Toggle erkennen |

Aktuell bestätigte Physics-Fähigkeiten:

```text
- Player/Builder besitzt Physics-State und Collider-Konfiguration.
- MovementIntent erreicht PlayerPhysicsController.
- W/A/S/D wird korrekt erkannt.
- Kamera folgt dem Physics-CameraBinding.
- Normale Collision blockiert aktuell X/Z fälschlich.
- Temporärer NoClip ist aktiv, damit Bewegung möglich ist.
- Ziel: Solver reparieren und NoClip wieder deaktivieren.
```

### 8.10 Aktive SceneRuntime

| Datei                    | Rolle                  | Kann aktuell                                                                                   |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `scene/scene_runtime.ts` | aktive Browser-Runtime | Three.js Renderer, Scene, Camera, Chunks, UI, Input, Physics, Targeting und Commands verbinden |

Diese Datei ist aktuell der wichtigste Integrationspunkt. Sie enthält:

```text
- renderer / scene / camera
- chunksRoot und chunkMeshes
- inputController
- uiRuntime
- physicsRuntime
- Raycaster-Targeting
- renderFrame Loop über requestAnimationFrame
- updateCameraFromInput inklusive Physics-Step
- Place/Remove Command-Anbindung
- Chunk-Rendering aus Registry
- Runtime-Snapshot mit physics
```

---

### 8.11 Runtime/Scene-Helfer unter `runtime/scene`

| Datei                                 | Rolle                    | Status                                                      |
| ------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `runtime/scene/scene_lifecycle.ts`    | Lifecycle/Cleanup-Helfer | vorhanden, für modularere Runtime nutzbar                   |
| `runtime/scene/scene_loop.ts`         | Loop-Abstraktion         | vorhanden, aktuell nicht Hauptloop der aktiven SceneRuntime |
| `runtime/scene/scene_world_bridge.ts` | World↔Render-Bridge      | vorhanden, alternative/modulare Scene-Architektur           |
| `runtime/scene/scene_chunk_tools.ts`  | Chunk-Command-Tools      | vorhanden, in modularer Runtime nutzbar                     |
| `runtime/scene/scene_runtime.ts`      | alternative SceneRuntime | aktuell nicht Browser-aktiv                                 |

Hinweis:

```text
Diese Dateien sind nicht automatisch falsch, aber die aktuelle Browser-Signatur zeigt,
dass src/frontend/scene/scene_runtime.ts aktiv ist. Später kann entschieden werden,
ob runtime/scene/* konsolidiert, gelöscht oder als neue modulare Architektur reaktiviert wird.
```

---

### 8.12 Render-Schicht

| Datei                        | Rolle                  | Kann aktuell                                                     |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `render/three_context.ts`    | Renderer-Kontext       | alternative/modulare Three-Abstraktion mit Renderer/Scene/Camera |
| `render/chunk_mesher.ts`     | Meshing                | RuntimeChunks zu Meshdaten/Instanzen machen                      |
| `render/chunk_scene.ts`      | Chunk-Scene-Verwaltung | Chunk-Meshes an Three-Gruppen hängen                             |
| `render/preview_renderer.ts` | Vorschau/Highlight     | Placement Preview und Target Highlight rendern                   |
| `render/debug_overlay.ts`    | Render-Debug           | Debug-Informationen anzeigen                                     |

Aktive `scene/scene_runtime.ts` rendert derzeit eigene InstancedMeshes direkt. Die Render-Module bleiben relevant für die modulare Zielarchitektur und Teile der bestehenden UI/Debug-Struktur.

---

### 8.13 Targeting

| Datei                          | Rolle                     | Kann aktuell                                                  |
| ------------------------------ | ------------------------- | ------------------------------------------------------------- |
| `targeting/chunk_targeting.ts` | Chunk-/Block-Raytargeting | Zielzellen, Placement-Zellen, Status und Store-Sync berechnen |

In der aktiven `scene/scene_runtime.ts` wird aktuell zusätzlich ein eigener Three.js-Raycaster auf die InstancedMeshes genutzt, um Zielblöcke im Crosshair zu bestimmen.

---

### 8.14 State-Schicht

| Datei                      | Rolle           | Kann aktuell                                                                                                           |
| -------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `state/editor_state.ts`    | Gesamtzustand   | Bootstrap, Lifecycle, Project, Viewport, Input, Camera, World, Inventory, Targeting, Command, Render, UI, Debug halten |
| `state/player_state.ts`    | Player-Zustand  | Physics-Player-State, MovementMode, Grounded/Flying, Position, Velocity, CollisionFlags halten                         |
| `state/state_actions.ts`   | Reducer/Actions | Camera/Input/World/Inventory/Targeting/Command/Render/UI/Player aktualisieren                                          |
| `state/editor_store.ts`    | Store           | get/peek/set/patch/subscribe, History/Notify steuern                                                                   |
| `state/state_selectors.ts` | Selector-API    | UI, Runtime, Inventory, Targeting, Player, Debug, World und Status ableiten                                            |

Aktuell wichtig:

```text
player/update wird von der aktiven SceneRuntime nach jedem Physics-Step geschrieben.
physicsRevision steigt bei laufender Physics.
state.player.flying / movementMode spiegeln Doppel-Leertaste-Flugmodus.
```

---

### 8.15 UI-Schicht

| Datei                     | Rolle           | Kann aktuell                                                 |
| ------------------------- | --------------- | ------------------------------------------------------------ |
| `ui/editor_ui_runtime.ts` | UI-Orchestrator | Statusbar, Hotbar, Loading, Error, LiveRegions aktualisieren |
| `ui/status_bar.ts`        | Statusbar       | Runtime-/World-/Player-/Command-Status anzeigen              |
| `ui/hotbar_view.ts`       | Hotbar-DOM      | Slots rendern, Selection anzeigen                            |
| `ui/crosshair_view.ts`    | Crosshair       | Ziel-/Place-/Remove-/Blocked-Zustand visualisieren           |
| `ui/loading_overlay.ts`   | Loading         | Start-/Verbindungszustand anzeigen                           |
| `ui/error_panel.ts`       | Fehlerpanel     | Fatal/Runtime-Fehler anzeigen                                |
| `ui/debug_overlay.ts`     | Debug UI        | optionale Debugdaten anzeigen                                |

---

### 8.16 Utils

| Datei             | Rolle                  | Kann aktuell                                                       |
| ----------------- | ---------------------- | ------------------------------------------------------------------ |
| `utils/safe.ts`   | sichere Normalisierung | unknown → string/number/boolean/array/record, Error-Normalisierung |
| `utils/logger.ts` | Logger                 | child logger, debug/info/warn/error                                |
| `utils/ids.ts`    | IDs/Keys               | Editor-IDs, ChunkKeys, Parse/Normalize                             |
| `utils/time.ts`   | Zeit                   | ISO-Zeitstempel und Time-Helfer                                    |

---

## 9. Build-/Docker-/Runtime-Status

### 9.1 Dockerfile

Der Dockerfile nutzt den neuen Frontend-Build.

Aktueller Build-Pfad:

```text
services/vectoplan-editor/src/frontend
```

Aktuelles Build-Ziel:

```text
services/vectoplan-editor/static/editor
```

Pflicht-Artefakt:

```text
services/vectoplan-editor/static/editor/manifest.json
```

Nicht mehr Pflicht:

```text
services/vectoplan-editor/static/editor/js/main.js
services/vectoplan-editor/static/editor/css/editor.css
```

Wichtig:

```text
Vite erzeugt hashed Assets unter static/editor/assets/.
Das Backend darf deshalb keine festen JS-/CSS-Dateinamen erwarten.
```

---

### 9.2 Vite/TypeScript

Akzeptanz:

```bash
cd services/vectoplan-editor/src/frontend
npm run typecheck
npm run build
```

Erwartung:

```text
typecheck erfolgreich
static/editor/manifest.json vorhanden
static/editor/assets/*.js vorhanden
```

---

### 9.3 Runtime-Start

Direkt im Compose-Public-Port:

```text
http://localhost:5100/editor
```

Aus App-Shell heraus:

```text
http://localhost:5103/project=<app_project_public_id>
→ Klick auf 3D
→ /ui/project/<app_project_public_id>/editor
→ Editor wird eingebettet
```

---

## 10. Backend-Auslieferung

### 10.1 Editor-Route

Die Editor-Route liefert `/editor` aus.

Aktueller Browser-Stand:

```text
http://localhost:5100/editor
→ lädt erfolgreich
→ Canvas sichtbar
→ Chunk-Service verbunden
→ Welt gerendert
→ Crosshair sichtbar
→ Hotbar sichtbar
→ Pointer Lock aktivierbar
→ Blöcke können gesetzt/entfernt werden
→ Physics/Collision aktiv
→ Flugmodus per Doppel-Leertaste aktivierbar/deaktivierbar
```

Relevante Datei:

```text
services/vectoplan-editor/routes/editor.py
```

Aufgaben dieser Route:

```text
Bootstrap-Payload erzeugen
Editor-Template rendern
Vite-Assets aus static/editor/manifest.json an Jinja übergeben
Chunk-Service-Route-Hints in Window-Globals und Dataset schreiben
App-/Chunk-Projektkontext durchreichen
world_spawn als konkrete Welt setzen
Physics-/Camera-/Input-/Feature-Flags in Bootstrap/Dataset durchreichen
```

---

### 10.2 Template `templates/editor/index.html`

Das Template stellt Fullscreen-Editor, Crosshair, Hotbar und Bootstrap-Dataset bereit.

Wichtige DOM-Hooks:

```text
data-editor-root
data-editor-canvas-host
data-editor-crosshair
data-editor-hotbar
data-editor-hotbar-slots
data-editor-live-region
data-pointer-lock-enabled
data-crosshair-enabled
data-hotbar-enabled
data-inventory-hotbar-size
data-inventory-default-block-type-id
data-camera-look-sensitivity
data-physics-enabled
data-player-collision-enabled
data-flight-mode-enabled
data-camera-physics-follow-enabled
data-camera-direct-movement-enabled
data-project-id
data-app-project-id
data-chunk-project-id
data-world-id
data-chunk-world-id
```

Wichtig:

```text
Diese Datei ist die produktive Flask-/Jinja-Seite für /editor.
src/frontend/index.html ist nur für Vite-/Dev-Kontext relevant.
```

---

## 11. API-Schicht im Frontend

### 11.1 Backend-Block-Vertrag

Die Blocklisten sind klar getrennt:

```text
placeableBlocks
→ aktive Inventory-/Hotbar-Liste
→ aktuell für auswählbare Slots genutzt
→ kurzfristige Quelle für debug_grass/debug_dirt

blocks
→ vollständiger Blockkatalog
→ später Creative Library / Block-Browser
→ nicht direkt als aktive Hotbar-Wahrheit verwenden
```

### 11.2 `api/chunk_api_client.ts`

Browser-Client für:

```text
/editor/api/chunk
```

Kann:

```text
loadStatus()
testConnection()
loadProjectBootstrap()
loadPlaceableBlocks()
loadBlocks()
loadChunk()
loadChunksBatch()
sendCommand()
sendSetBlock()
sendRemoveBlock()
```

Wichtig:

```text
Der Browser spricht nicht direkt mit http://vectoplan-chunk:5000.
Der Browser spricht nur mit /editor/api/chunk.
```

### 11.3 Chunk-ID-Regel im API-Client

Für Chunk-Routen gilt:

```text
projectId = chunkProjectId, wenn vorhanden
worldId   = chunkWorldId oder world_spawn
```

Fallback:

```text
projectId = dev-project
worldId   = world_spawn
```

Nicht verwenden:

```text
worldId = flat
```

---

## 12. Bootstrap- und Runtime-Config-Schicht

### 12.1 `bootstrap/bootstrap_models.ts`

Zentrale Bootstrap-Modelle und Defaults für:

```text
runtime.chunk
runtime.physics
Kamera
Render
Input
Inventory
Creative Library
FeatureFlags
UI Flags
```

Aktuelle Flags/Defaults:

```text
pointerLockEnabled = true
firstPersonEnabled = true
physicsEnabled = true
playerCollisionEnabled = true
flightModeEnabled = true
crosshairEnabled = true
hotbarEnabled = true
creativeLibraryEnabled = true
camera.physicsFollowEnabled = true
camera.directMovementEnabled = false
inventory.inventoryRouteKind = placeable-blocks
inventory.creativeLibraryRouteKind = blocks
```

### 12.2 `config/runtime_config.ts`

Diese Datei existiert als Adapter-Schicht für normalisierte Runtime-Werte. In der aktuell aktiven Browser-SceneRuntime wurde die Physics-Konfiguration zusätzlich lokal aus `bootstrap.runtime.physics` aufgebaut, weil die aktive Runtime-Datei unter `src/frontend/scene/scene_runtime.ts` liegt und nicht die zuvor bearbeitete Datei unter `src/frontend/runtime/scene/scene_runtime.ts` war.

Aktueller Befund:

```text
Runtime-Config im globalen Runtime-Handle kann eine andere Shape haben als unsere Adapter-Typen.
Die aktive SceneRuntime liest für Physics zuverlässig aus bootstrap.runtime.physics / bootstrap.physics.
```

Wichtig:

```text
Langfristig sollte config/runtime_config.ts mit dem tatsächlich global sichtbaren RuntimeConfig-Shape konsolidiert werden.
Kurzfristig funktioniert die aktive SceneRuntime robust über bootstrap.runtime.physics.
```

### 12.3 Bootstrap-Kontext für App-Embed

Im App-Embed-Fall muss der Bootstrap mindestens unterscheiden können:

```text
appProjectId
chunkProjectId
chunkUniverseId
chunkWorldId
worldId
embed
```

Aktuelle sinnvolle Normalisierung:

```text
appProjectId   = App-Projekt-ID
projectId      = Chunk-Projekt-ID für Chunk-Routen, wenn vorhanden
chunkProjectId = explizite Chunk-Projekt-ID
worldId        = world_spawn
chunkWorldId   = world_spawn
```

---

## 13. World-Runtime- und Collision-Schicht

### 13.1 `runtime/world/chunk_content.ts`

Normalisiert `ChunkApiRuntimeChunkContent` zu `RuntimeChunkContent`.

Aktuelle Collision-relevante Regeln:

```text
cellValue = 0 → Air
cellValue > 0 → Block
paletteByCellValue und paletteByBlockTypeId werden aufgebaut
solid wird aus Palette gelesen
unbekannte Non-Air-Zellen werden fail-closed als solid behandelt
```

### 13.2 `runtime/world/chunk_registry.ts`

Clientseitige Registry für:

```text
geladene Chunks
sichtbare Chunks
dirty Chunks
failed Chunks
RuntimeChunkContent
Collision-Zellen
BlockCollisionWorldReader
```

Wichtige Methoden:

```text
sampleCellByWorldPosition(position)
getCollisionCell({ x, y, z })
isCellLoaded({ x, y, z })
createBlockCollisionWorldReader(sourceName)
```

Bestätigte Browser-Probe:

```text
worldRuntime.getCollisionCell({ x: 8, y: 7, z: 18 })
→ loaded: true
→ solid: true
→ kind: solid
→ blockTypeId: debug_grass
```

### 13.3 `runtime/world/world_runtime.ts`

Orchestriert:

```text
ChunkServiceSource
ChunkLoader
ChunkRegistry
Store-Updates
CollisionWorldReader
BlockCollisionQuery
```

Wichtige Collision-Schnittstellen:

```text
getCollisionWorldReader()
getBlockCollisionQuery()
getCollisionCell(cell)
isCollisionCellLoaded(cell)
getCollisionSnapshot()
```

---

## 14. Physics-Schicht

Lokale Physics-Schicht:

```text
src/frontend/runtime/physics/physics_models.ts
src/frontend/runtime/physics/physics_defaults.ts
src/frontend/runtime/physics/physics_runtime.ts
src/frontend/runtime/physics/player_physics_controller.ts
src/frontend/runtime/physics/block_collision_query.ts
src/frontend/runtime/physics/voxel_collision_solver.ts
src/frontend/runtime/physics/double_tap_detector.ts
```

### 14.1 Rolle

```text
physics_models.ts
→ zentrale Typen für Vektoren, AABB, PlayerState, MovementIntent, CameraBinding

physics_defaults.ts
→ robuste Defaults für Timing, Movement, Collider, Missing-Chunk-Policy

physics_runtime.ts
→ Frame-Integrator und Orchestrator zwischen Input, PlayerController und CollisionQuery

player_physics_controller.ts
→ Movement, Gravity, Jump/Fly, Grounding, Flying, Damping

block_collision_query.ts
→ Query gegen WorldRuntime/ChunkRegistry, fehlende Chunks fail-closed

voxel_collision_solver.ts
→ AABB-vs-Block-Auflösung pro Achse

double_tap_detector.ts
→ Space-Double-Tap-Erkennung für Flugmodus
```

### 14.2 Aktueller bestätigter Funktionsstand

```text
- Spieler/Builder besitzt Collider-/Physics-State.
- Bewegung läuft bei aktivem Physics nicht mehr direkt über Kamera-Position.
- MovementIntent kommt korrekt in der Physics an.
- Diagnose bestätigt: Input ist nicht der Fehler.
- Normale Collision-Auflösung ist aktuell defekt und meldet input_blocked_by_axis.
- Ohne NoClip bleibt die Position trotz W/A/S/D unverändert.
- Temporärer NoClip im player_physics_controller.ts ist aktiv.
- Dadurch kann der Builder vorerst durch Blöcke laufen/fliegen.
- Nach Reparatur von voxel_collision_solver.ts / BlockCollisionQuery muss NoClip wieder entfernt oder deaktiviert werden.
```

### 14.3 Config-Werte

Aktuelle Defaults/Bootstrap-Werte:

```text
fixedTimeStepSeconds = 1 / 60
maxFrameDeltaSeconds = 0.25
maxSubSteps = 8
walkSpeed ≈ 4.25
sprintSpeed ≈ 5.65
airControlSpeed ≈ 2.35
flySpeed ≈ 6.5
flySprintSpeed ≈ 10.5
jumpVelocity ≈ 6.25
gravity ≈ -18
maxFallSpeed ≈ -32
groundSnapDistance ≈ 0.08
playerWidth ≈ 0.6
playerHeight ≈ 1.8
eyeHeight ≈ 1.62
missingChunkPolicy = block
```

---


## 15. Aktive Scene-/Render-Schicht

### 15.1 Aktive Datei

Produktiv aktiv:

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

Nicht produktiv aktiv für den Browser-Stand:

```text
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

Diese Unterscheidung ist wichtig, weil die letzte Physics-/Flight-/Collision-Reparatur erst wirksam wurde, nachdem die tatsächlich aktive Datei angepasst wurde.

---

### 15.2 Aufgaben der aktiven SceneRuntime

Die aktive SceneRuntime besitzt aktuell eine direkte Three.js-Implementierung:

```text
THREE.WebGLRenderer
THREE.Scene
THREE.PerspectiveCamera
THREE.Group für Chunks
THREE.InstancedMesh für Blöcke
Raycaster für Crosshair-/Block-Targeting
ResizeObserver
InputController
EditorUiRuntime
PhysicsRuntime
WorldRuntime
ChunkServiceSource
```

Sie verbindet:

```text
Bootstrap
→ RuntimeConfig
→ WorldRuntime
→ ChunkApiClient
→ Renderer
→ Input
→ UI
→ Targeting
→ Physics
→ Store
```

---

### 15.3 Aktueller Frame-Loop

Aktueller Zielablauf pro Frame:

```text
requestAnimationFrame(renderFrame)
→ InputSnapshot lesen
→ Mouse lookDelta auf Kamera-Yaw/Pitch anwenden
→ MovementIntent vom InputController lesen
→ bei Physics aktiv:
   physicsRuntime.stepFrame({
     nowMs,
     deltaSeconds,
     movementIntent: movementIntent.physics,
     lookAngles,
     query: worldRuntime.getBlockCollisionQuery()
   })
→ Player-State in Store schreiben
→ Kamera an physicsFrame.camera binden
→ Input-Deltas resetten
→ Targeting aktualisieren
→ Chunks um Kamera/Player nachladen
→ Renderer rendert Scene
```

Wichtig:

```text
Bei aktiver Physics wird die Kamera nicht direkt frei bewegt.
Die Kamera folgt dem Player-/Physics-CameraBinding.
```

---

### 15.4 Warum die letzte Reparatur nötig war

Während der Diagnose wurde festgestellt:

```text
- Input Double-Space wurde korrekt erkannt.
- Collision-Reader erkannte solide Blöcke korrekt.
- Bootstrap hatte physicsEnabled/playerCollisionEnabled/flightModeEnabled aktiv.
- Store-Player physicsRevision blieb 0.
- Scene-Snapshot hatte hasPhysicsSnapshot = false.
```

Ursache:

```text
Die falsche SceneRuntime-Datei wurde bearbeitet.

Bearbeitet war:
src/frontend/runtime/scene/scene_runtime.ts

Aktiv war aber:
src/frontend/scene/scene_runtime.ts
```

Behebung:

```text
PhysicsRuntime wurde in die aktive src/frontend/scene/scene_runtime.ts integriert.
```

Ergebnis:

```text
Player-Physics läuft.
Collision läuft.
Doppel-Leertaste toggelt Flugmodus.
Nach Flugmodus-Aus wirkt Gravity.
```

---

## 16. Input- und Kamera-Schicht

### 16.1 Aktueller Bedienstand

Bestätigt:

```text
Maus:
- Klick in Viewport aktiviert Pointer Lock
- Mausbewegung dreht Kamera ohne gedrückte Taste
- Mitte/Crosshair bleibt zentral
- ESC löst Pointer Lock
- Linksklick/Rechtsklick-Pfad ist vorhanden, muss nach aktueller NoClip-/Physics-Änderung erneut E2E geprüft werden

Tastatur:
- W = intentForward -1
- S = intentForward 1
- A = intentRight -1
- D = intentRight 1
- Shift = Sprint-Intent
- Space/Q/Fly-Intent je nach Modus vorhanden
- Zahlen 1–9 sollen Hotbar-Slots wählen

Bewegung:
- WASD-Input kommt korrekt in Physics an
- sichtbare Bewegung funktioniert aktuell über temporären NoClip
- normale Collision-Bewegung ohne NoClip ist noch defekt

Hotbar/Library:
- UI/Initialisierung ist vorhanden
- Quelle/Default-Blocktyp und Placeable-Liste nach aktuellem Stand erneut prüfen
```

### 16.2 `input/input_controller.ts`

Zentrale Input-Orchestrierung.

Aktuelle wichtige Korrekturen:

```text
1. Harte Place/Remove-Vorprüfungen wurden aus dem InputController entfernt.
   Scene/Targeting validieren final.

2. Direkter Pointer-Fallback auf Canvas/CanvasHost wurde ergänzt.
   Dadurch kommen Linksklick/Rechtsklick zuverlässig bei executePlace/executeRemove an.

3. Pointer-Actions werden dedupliziert.
   Dadurch feuert pointerdown/mousedown/click nicht mehrfach denselben Command.

4. W/S wurden im MovementIntent korrigiert.
   A/D bleiben unverändert.

5. Space-Double-Tap erzeugt toggleFlightRequested als One-Shot.
   Der Toggle wird nicht dauerhaft gehalten, sondern einmalig von getMovementIntent() konsumiert.
```

Aktuelle Movement-Achse:

```text
forward = movementAxis(snapshot, "move-backward", "move-forward")
right   = movementAxis(snapshot, "move-right", "move-left")
up      = ascendHeld - descendHeld
```

Damit gilt im bestätigten Browser-Stand:

```text
W → vorwärts
S → rückwärts
A → links
D → rechts
```

---

### 16.3 `input/input_state.ts`

Verantwortlich für:

```text
KeyboardSnapshot
PointerSnapshot
WheelSnapshot
pressedKeys
pressedActionKeys
pointerLocked
lookDelta
accumulatedLookDelta
wheelDelta
resetDeltas
```

Space-Events wurden in der Browser-Console bestätigt:

```text
keydown Space repeat:false
keyup Space
keydown Space repeat:false
keyup Space
```

Folgerung:

```text
Double-Space-Erkennung funktioniert.
```

---

### 16.4 Kamera-Follow

Bei aktivem Physics-System:

```text
camera.physicsFollowEnabled = true
camera.directMovementEnabled = false
```

Bedeutung:

```text
Die Kamera ist nicht mehr die eigentliche Spielfigur.
Die Spielfigur ist der Physics-Player.
Die Kamera folgt dem Eye-Point des Players.
```

Dadurch kann Collision funktionieren:

```text
Input
→ MovementIntent
→ PhysicsRuntime
→ Collision Solver
→ Player Position
→ Camera Eye Position
```

Nicht mehr:

```text
Input
→ Kamera direkt durch Blöcke bewegen
```

---

## 17. Inventory-/Hotbar-Schicht

Aktuelle Wahrheit:

```text
placeableBlocks = aktive Inventory-/Hotbar-Liste
blocks          = vollständiger Katalog für spätere Creative Library
```

Aktueller Stand nach der letzten Runtime-/Physics-Runde:

```text
- Hotbar/Library-Initialisierung läuft.
- Browser-Logs zeigten zuletzt auch empty-fallback / Library itemCount.
- debug_grass als Default-Blocktyp wird aktuell als verbotener Debug-Default gewarnt.
- Placeable-/Library-Quelle muss final mit Chunk-Service-Blockkatalog konsolidiert werden.
- Slot-Auswahl/Mausrad/Place/Remove nach der NoClip-Änderung erneut E2E prüfen.
```

Kurzfristig bekannte Chunk-Service-Debug-Blocktypen:

```text
debug_grass
debug_dirt
```

Nicht blind als aktive Remote-Place-IDs verwenden, solange der Chunk-Service sie nicht kennt:

```text
grass
dirt
stone
wood
planks
glass
light
metal
marker
```

Begründung:

```text
Die Hotbar darf langfristig nicht aus einer lokalen Demo-Liste kommen.
Sie muss aus placeableBlocks / Library-Kontext des Editor-/Chunk-Service-Pfades gespeist werden.
```

## 18. State-Schicht

Wichtige Dateien:

```text
state/editor_state.ts
state/player_state.ts
state/state_actions.ts
state/editor_store.ts
state/state_selectors.ts
```

Aktuelle Korrekturen:

```text
- Pointer Lock State wird über input/pointer-lock gespiegelt.
- Inventory/Catalog wird aus Hotbar/InventorySource in Store geschrieben.
- Targeting wird aus Camera Position/Forward im SceneLoop aktualisiert.
- Crosshair-Varianten leiten sich aus Targeting und CanPlace/CanRemove ab.
- Player-State wird über player/update aus PhysicsRuntime synchronisiert.
- Player-Selectors liefern movementMode, grounded, flying, velocity, collisionFlags.
```

Relevante Store-Felder:

```text
state.player.position
state.player.velocity
state.player.eyePosition
state.player.angles
state.player.movementMode
state.player.grounded
state.player.flying
state.player.collisionFlags
state.player.physicsRevision
state.player.lastFlightToggleAtMs
```

Erwartung bei laufender Physics:

```text
state.player.physicsRevision > 0
```

Erwartung bei Flugmodus:

```text
state.player.flying = true
state.player.movementMode = flying
```

Nach erneutem Doppel-Space:

```text
state.player.flying = false
state.player.movementMode = walking/airborne
Gravity wirkt wieder
```

---

## 19. Aktueller Place-/Break-Zielpfad

### 19.1 Place

Zielpfad:

```text
User Linksklick
→ input_controller.ts / mouse_input.ts
→ executePlace()
→ aktive scene_runtime.ts onPlaceBlock
→ worldRuntime.getSource().setBlock(position, blockTypeId)
→ chunk_service_source.ts
→ chunk_api_client.ts sendSetBlock()
→ POST /editor/api/chunk/projects/<chunk_project_id>/worlds/world_spawn/commands
→ routes/chunk.py
→ src/clients/chunk_client.py
→ vectoplan-chunk
→ ChunkSnapshot / ChunkEvent / WorldCommandLog
→ dirtyChunks
→ reloadDirtyChunks()
→ remesh/render
→ Block sichtbar
```

Aktueller Status:

```text
Der Pfad ist architektonisch weiterhin korrekt.
Nach der aktuellen NoClip-/Physics-Änderung muss Place erneut manuell/E2E geprüft werden.
```

Für direkten Dev-Start:

```text
chunk_project_id fallback = dev-project
world_id fallback = world_spawn
```

Für App-Embed:

```text
chunk_project_id = aus App-Provisioning, z. B. chk_prj_...
world_id = world_spawn
```

---

### 19.2 Remove

Zielpfad:

```text
User Rechtsklick
→ input_controller.ts / mouse_input.ts
→ executeRemove()
→ aktive scene_runtime.ts onRemoveBlock
→ worldRuntime.getSource().removeBlock(position)
→ chunk_service_source.ts
→ chunk_api_client.ts sendRemoveBlock()
→ POST /editor/api/chunk/projects/<chunk_project_id>/worlds/world_spawn/commands
→ routes/chunk.py
→ src/clients/chunk_client.py
→ vectoplan-chunk
→ ChunkSnapshot / ChunkEvent / WorldCommandLog
→ dirtyChunks
→ reloadDirtyChunks()
→ remesh/render
→ Block entfernt sichtbar
```

Aktueller Status:

```text
Der Pfad ist architektonisch weiterhin korrekt.
Nach der aktuellen NoClip-/Physics-Änderung muss Remove erneut manuell/E2E geprüft werden.
```

Noch separat absichern:

```text
Browser Reload zeigt bestätigten Zustand nach SetBlock/RemoveBlock.
```

---

### 19.3 Wichtigste ID-Regel

Der Editor darf im Remote-Pfad nicht die falsche Projekt-ID verwenden.

Richtig:

```text
Chunk-Route project_id = chunk_project_id
Chunk-Route world_id   = world_spawn
```

Nicht richtig, wenn App-Projekt eingebettet ist:

```text
Chunk-Route project_id = app_project_public_id
Chunk-Route world_id   = flat
```

Beispiel richtig:

```text
POST /editor/api/chunk/projects/<chunk_project_id>/worlds/world_spawn/commands
```

## 20. Diagnose-Ergebnisse aus der letzten Reparaturrunde

### 20.1 Chunk-Proxy, App-/Chunk-ID und Batch-Laden

Bestätigt:

```text
- Browser nutzt /editor/api/chunk.
- Editor-Backend proxyt zu vectoplan-chunk.
- app_project_id und chunk_project_id werden getrennt.
- Für Chunk-Routen wird chunk_project_id verwendet.
- Für Chunk-Welt wird world_spawn verwendet.
- POST /projects/<chunk_project_id>/worlds/world_spawn/chunks/batch liefert HTTP 200.
```

Folgerung:

```text
Der alte Fehler mit App-Origin/App-Projekt-ID als Chunk-Projekt-ID ist behoben.
```

---

### 20.2 ChunkServiceSource → ChunkRegistry

Vorheriger Befund:

```text
ChunkServiceSource speicherte Batch-Ergebnisse nicht zuverlässig als sichtbare RuntimeChunks in der Registry.
```

Korrektur:

```text
- Batch-Wrapper werden auf echte Chunk-Inhalte entpackt.
- setApiChunk/setChunk werden mit visible:true genutzt.
- sichtbare ChunkKeys werden gesetzt.
- fehlgeschlagene Registry-Speicherung wird diagnostiziert.
```

Folgerung:

```text
Der Datenpfad Chunk-Service → ChunkServiceSource → ChunkRegistry ist deutlich weiter.
```

---

### 20.3 Input war nicht die Ursache

Bestätigt durch Physics-Probe:

```text
W  → intentForward = -1
D  → intentRight   = 1
A  → intentRight   = -1
intentActive = true
```

Folgerung:

```text
Keyboard/InputController/MovementIntent funktionieren.
```

---

### 20.4 Physics läuft, aber normale Collision blockiert horizontal

Bestätigt durch ereignisbasierte Physics-Probe:

```text
Event: input_blocked_by_axis
modeBefore = grounded
modeAfter  = grounded
groundedBefore = true
groundedAfter  = true
previousPosition = { x: 8, y: 8, z: 18 }
nextPosition     = { x: 8, y: 8, z: 18 }
changedX = 0
changedZ = 0
```

Das wurde für mehrere Richtungen beobachtet:

```text
W: intentForward = -1
D: intentRight = 1
A: intentRight = -1
```

Folgerung:

```text
Der Fehler liegt im normalen Collision-/AABB-/Solver-Pfad, nicht im Input.
```

---

### 20.5 Temporärer NoClip als Arbeitsmodus

Aktuelle Maßnahme:

```text
services/vectoplan-editor/src/frontend/runtime/physics/player_physics_controller.ts
→ TEMPORARY_PLAYER_NOCLIP_ENABLED = true
```

Wirkung:

```text
- Der Collision-Solver wird für Player-Movement temporär übersprungen.
- WASD bewegt den Player/CameraBinding wieder.
- Der Builder kann vorerst durch Blöcke gehen.
- Die restliche Physics-/Input-/Camera-Pipeline bleibt aktiv.
```

Wichtig:

```text
NoClip ist kein Zielzustand.
Er ist nur eine Entwicklungsüberbrückung, bis voxel_collision_solver.ts / block_collision_query.ts / Player-AABB korrekt arbeiten.
```

---

### 20.6 Aktueller Hauptverdacht

Nächster technischer Fix liegt hier:

```text
services/vectoplan-editor/src/frontend/runtime/physics/voxel_collision_solver.ts
```

Zusätzlich relevant:

```text
services/vectoplan-editor/src/frontend/runtime/physics/block_collision_query.ts
services/vectoplan-editor/src/frontend/runtime/world/chunk_registry.ts
services/vectoplan-editor/src/frontend/runtime/world/chunk_content.ts
```

Zu prüfen:

```text
- Warum blockiert der Solver X/Z, obwohl MovementIntent und Velocity aktiv sind?
- Wird Ground-/Boden-Kollision fälschlich als horizontale Blockade gewertet?
- Ist die Player-AABB beim Spawn in einer solid Cell?
- Sind SkinWidth/GroundSnap/Axis-Resolution falsch kombiniert?
- Werden missing/solid Cells im AABB-Bereich zu aggressiv blockierend behandelt?
```

## 21. Alte Dateien und Ordner

### 21.1 Sofortiger Aufräumkandidat

```text
services/vectoplan-editor/frontend
```

Begründung:

```text
Ersetzt durch services/vectoplan-editor/src/frontend.
```

Vorher/Nachher prüfen:

```bash
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend" .
```

PowerShell:

```powershell
Get-ChildItem . -Recurse -Include *.py,*.ts,*.tsx,*.js,*.json,*.yml,*.yaml,*.md |
  Select-String "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend" |
  Format-List Path,LineNumber,Line
```

---

### 21.2 SceneRuntime-Konsolidierung

Aktuell prüfen:

```bash
rg -n "createSceneRuntime|renderOnce|getUiRuntime|getThreeContext|getWorldBridge" services/vectoplan-editor/src/frontend
```

Ziel:

```text
Nur eine produktive SceneRuntime behalten oder eindeutig dokumentieren.
Aktive Datei: src/frontend/scene/scene_runtime.ts
```

Optionen:

```text
1. runtime/scene/scene_runtime.ts entfernen, wenn ungenutzt.
2. runtime/scene/* als modulare Zielarchitektur behalten, aber nicht aktiv verwenden.
3. aktive scene/scene_runtime.ts später in runtime/scene/* überführen.
```

Nicht sofort löschen, solange Imports nicht geprüft sind.

---

### 21.3 Alter Python-Client

Nur löschen, wenn keine Imports mehr existieren:

```text
services/vectoplan-editor/clients/chunk_client.py
```

Ersetzt durch:

```text
services/vectoplan-editor/src/clients/chunk_client.py
```

Prüfung:

```bash
rg -n "from clients.chunk_client|import clients.chunk_client|clients/chunk_client" services/vectoplan-editor
```

---

## 22. Diagnosebefehle

### 22.1 Typecheck/Build

```bash
cd services/vectoplan-editor/src/frontend
npm run typecheck
npm run build
```

Erwartung:

```text
Typecheck erfolgreich.
Build erfolgreich.
static/editor/manifest.json wird erzeugt.
```

---

### 22.2 Docker

```bash
docker compose up -d --build vectoplan-editor
docker compose logs -f vectoplan-editor
```

Erwartung:

```text
Gunicorn startet.
Editor-Service lauscht intern auf 5000.
Public-Port ist über Compose auf localhost:5100 erreichbar.
```

---

### 22.3 Manifest

```bash
ls -la services/vectoplan-editor/static/editor
cat services/vectoplan-editor/static/editor/manifest.json
```

Erwartung:

```text
manifest.json vorhanden
assets/*.js vorhanden
assets/*.css optional/vorhanden je nach Build
```

---

### 22.4 Aktive SceneRuntime finden

PowerShell:

```powershell
Get-ChildItem ".\services\vectoplan-editor\src\frontend" -Recurse -Include *.ts,*.tsx |
  Select-String "renderOnce|getUiRuntime" |
  Format-List Path,LineNumber,Line
```

Erwartung aktuell:

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

---

### 22.5 Proxy direkt testen

Direkt gegen Editor Public-Port:

```bash
curl -sS http://127.0.0.1:5100/editor/api/chunk/_status
curl -sS http://127.0.0.1:5100/editor/api/chunk/_test/connection
curl -sS http://127.0.0.1:5100/editor/api/chunk/placeable-blocks
```

Erwartung:

```text
_status → ok
_test/connection → ok
placeable-blocks → debug_grass/debug_dirt vorhanden
```

Falls lokal direkt im Container-Port getestet wird:

```text
http://127.0.0.1:5000/editor/api/chunk/...
```

nur verwenden, wenn der Editor-Service tatsächlich direkt auf 5000 gemappt ist. Im aktuellen Gesamtsystem ist browserseitig `5100` relevant.

---

### 22.6 App-Embed testen

```text
http://localhost:5103/project=<app_project_public_id>
→ 3D klicken
```

Erwartung:

```text
Editor iframe lädt.
Canvas erscheint.
Chunk-Service verbunden.
world_spawn wird geladen.
Chunks erscheinen.
```

Im Network-Tab erwarten:

```text
/editor/api/chunk/...
```

Keine direkten Browser-Aufrufe zu:

```text
http://vectoplan-chunk:5000
http://vectoplan-editor:5000
```

---

### 22.7 Browser-Konsole – Runtime/Store

```js
const rt =
  window.vectoplanEditorRuntime ||
  window.editorRuntime ||
  window.__VECTOPLAN_RUNTIME__;

rt.getBootstrap();
rt.getRuntimeConfig();
rt.getState();
rt.getSceneRuntime().getSnapshot();
rt.getWorldRuntime().getCollisionCell({ x: 8, y: 7, z: 18 });
```

---

### 22.8 Browser-Konsole – Projekt-/Chunk-Kontext

```js
(() => {
  const rt =
    window.vectoplanEditorRuntime ||
    window.editorRuntime ||
    window.__VECTOPLAN_RUNTIME__;

  const boot = rt?.getBootstrap?.();
  const cfg = rt?.getRuntimeConfig?.();

  console.table({
    bootstrapProjectId: boot?.projectId,
    bootstrapAppProjectId: boot?.appProjectId,
    bootstrapChunkProjectId: boot?.chunkProjectId,
    bootstrapWorldId: boot?.worldId,
    bootstrapChunkWorldId: boot?.chunkWorldId,
    configProjectId: cfg?.projectId,
    configWorldId: cfg?.worldId,
  });
})();
```

Erwartung im App-Embed-Fall:

```text
appProjectId = prj_...
chunkProjectId = chk_prj_...
worldId/chunkWorldId = world_spawn
```

---

### 22.9 Browser-Konsole – Physics/Player

```js
(() => {
  const rt =
    window.vectoplanEditorRuntime ||
    window.editorRuntime ||
    window.__VECTOPLAN_RUNTIME__;

  const state = rt?.getState?.();
  const scene = rt?.getSceneRuntime?.();

  console.table({
    storeMovementMode: state?.player?.movementMode,
    storeFlying: state?.player?.flying,
    storeGrounded: state?.player?.grounded,
    storePhysicsRevision: state?.player?.physicsRevision,
    sceneHasPhysics: !!scene?.getSnapshot?.()?.physics,
    sceneFlying: scene?.getSnapshot?.()?.physics?.player?.flying,
    sceneGrounded: scene?.getSnapshot?.()?.physics?.player?.grounded,
  });
})();
```

Erwartung:

```text
storePhysicsRevision > 0
sceneHasPhysics = true
```

Nach Doppel-Leertaste:

```text
storeFlying = true
sceneFlying = true
```

Nach erneutem Doppel-Leertaste:

```text
storeFlying = false
sceneFlying = false
Gravity wirkt wieder
```

---

### 22.10 Browser-Konsole – Collision

```js
(() => {
  const rt =
    window.vectoplanEditorRuntime ||
    window.editorRuntime ||
    window.__VECTOPLAN_RUNTIME__;

  const world = rt?.getWorldRuntime?.();
  console.log(world?.getCollisionCell?.({ x: 8, y: 7, z: 18 }));
})();
```

Erwartung bei bekannter solider Zelle:

```text
loaded: true
solid: true
kind: solid
blockTypeId: debug_grass
```

---

## 23. Akzeptanzkriterien

Bereits erreicht:

```text
1. src/frontend ist produktive Frontend-Quelle.
2. Vite-Build erzeugt static/editor/manifest.json.
3. /editor lädt im Browser.
4. /editor ist über localhost:5100 erreichbar.
5. App-Embed über /ui/project/<id>/editor funktioniert grundsätzlich.
6. Fullscreen-Canvas startet.
7. Chunk-Service wird über /editor/api/chunk angesprochen.
8. Browser ruft vectoplan-chunk nicht direkt auf.
9. app_project_id und chunk_project_id sind getrennt.
10. Chunk-Routen verwenden chunk_project_id.
11. world_spawn wird als Runtime-World verwendet.
12. POST chunks/batch gegen /projects/<chunk_project_id>/worlds/world_spawn funktioniert.
13. ChunkServiceSource initialisiert mit korrektem Kontext.
14. ChunkServiceSource→ChunkRegistry wurde robuster gemacht.
15. Pointer Lock / Mouse-Look funktioniert.
16. W/A/S/D-Input erreicht Physics korrekt.
17. PhysicsRuntime läuft.
18. CameraBinding/PlayerPhysicsController laufen.
19. Normale Collision-Blockade wurde eindeutig diagnostiziert.
20. Temporärer NoClip stellt Bewegung wieder her.
```

Aktuell offen:

```text
1. TEMPORARY_PLAYER_NOCLIP_ENABLED wieder deaktivieren, sobald Collision repariert ist.
2. voxel_collision_solver.ts reparieren: Ground-/AABB-/Axis-Resolution darf X/Z nicht fälschlich blockieren.
3. block_collision_query.ts und chunk_registry.ts im Kontext des Player-AABB prüfen.
4. Spawn-Position und Player-AABB gegen bekannte solide Zellen prüfen.
5. Chunk-Mesh-/Renderer-Sichtbarkeit nach finalem Collision-Fix validieren.
6. Hotbar/Library nach aktuellem Stand final prüfen.
7. Place/Remove nach NoClip/Collision-Fix erneut E2E testen.
8. Browser Reload zeigt bestätigten SetBlock/RemoveBlock-Zustand noch offen.
9. App-Embed mit mehreren Projekten testen.
10. services/vectoplan-editor/frontend löschen, wenn keine produktiven Referenzen mehr existieren.
11. Aktive und inaktive SceneRuntime-Dateien konsolidieren oder eindeutig aufräumen.
12. /editor/api/chunk/_status dauerhaft als Smoke-Test absichern.
13. /editor/api/chunk/_test/connection dauerhaft als Smoke-Test absichern.
14. Automatisierte E2E-/Smoke-Tests ergänzen.
15. Creative-Library-UI an blocks-Katalog anschließen.
```

## 24. Konkrete nächste Schritte

### Schritt 1 – temporären NoClip bewusst halten

Aktive Datei:

```text
services/vectoplan-editor/src/frontend/runtime/physics/player_physics_controller.ts
```

Aktueller Arbeitsmodus:

```text
TEMPORARY_PLAYER_NOCLIP_ENABLED = true
```

Regel:

```text
NoClip bleibt nur so lange aktiv, bis die normale Collision-Bewegung repariert ist.
```

---

### Schritt 2 – Collision-Solver reparieren

Primäre Datei:

```text
services/vectoplan-editor/src/frontend/runtime/physics/voxel_collision_solver.ts
```

Ziel:

```text
- horizontale Bewegung bei grounded Player darf nicht pauschal blockieren
- Boden-Kollision darf nicht als X/Z-Wand-Kollision zählen
- appliedDelta.x/z muss bei freiem Raum ungleich 0 werden
- blockedAxes darf X/Z nur bei echter seitlicher Blockkollision enthalten
```

Dazu prüfen:

```text
- Axis-Reihenfolge und Sweep-Logik
- SkinWidth
- GroundSnap
- Step-/Floor-Kontakt
- AABB-Zellbereich
- SolidCells vs MissingCells
```

---

### Schritt 3 – Collision-Query und Registry prüfen

Relevante Dateien:

```text
services/vectoplan-editor/src/frontend/runtime/physics/block_collision_query.ts
services/vectoplan-editor/src/frontend/runtime/world/chunk_registry.ts
services/vectoplan-editor/src/frontend/runtime/world/chunk_content.ts
```

Ziel:

```text
- geladene sparse/air cells dürfen nicht als blocking solid zählen
- missing chunks/cells müssen diagnostisch klar sichtbar sein
- bekannte solid cells sollen weiterhin solid bleiben
- Player-AABB darf beim Spawn nicht komplett in solid hängen
```

---

### Schritt 4 – NoClip wieder deaktivieren und testen

Nach Solver-Fix:

```text
TEMPORARY_PLAYER_NOCLIP_ENABLED = false
```

Dann manuell prüfen:

```text
1. /editor öffnen.
2. W läuft vorwärts.
3. S läuft rückwärts.
4. A läuft links.
5. D läuft rechts.
6. Kein input_blocked_by_axis im freien Raum.
7. appliedDelta.x/z ist bei Bewegung ungleich 0.
8. Gegen echten Block laufen → blockiert.
9. Auf Boden stehen → grounded true.
10. Kamera folgt Player.
```

---

### Schritt 5 – Chunk-/Render-/Interaction-Matrix erneut testen

```text
1. Chunk-Welt sichtbar?
2. Chunks/batch weiterhin 200?
3. Registry visible chunk count plausibel?
4. Hotbar/Library sichtbar?
5. Slot-Auswahl funktioniert?
6. Linksklick SetBlock funktioniert?
7. Rechtsklick RemoveBlock funktioniert?
8. Dirty-Reload/Remesh funktioniert?
9. Browser Reload persistiert Zustand?
10. App-Embed funktioniert mit echtem Projekt?
```

---

### Schritt 6 – Typecheck/Build ausführen

```bash
cd services/vectoplan-editor/src/frontend
npm run typecheck
npm run build
```

Danach:

```bash
docker compose up -d --build vectoplan-editor
```

---

### Schritt 7 – Proxy direkt testen

```bash
curl -sS http://127.0.0.1:5100/editor/api/chunk/_status
curl -sS http://127.0.0.1:5100/editor/api/chunk/_test/connection
curl -sS http://127.0.0.1:5100/editor/api/chunk/placeable-blocks
```

Erwartung:

```text
Status ok.
Connection ok.
Placeable/Library-Daten plausibel.
```

---

### Schritt 8 – Legacy-Frontend und SceneRuntime-Duplikate später aufräumen

Nur nach erfolgreichem Runtime-/Collision-Fix:

```bash
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend" .
rg -n "createSceneRuntime|renderOnce|getUiRuntime|requestRender|getThreeContext" services/vectoplan-editor/src/frontend
```

Ziel:

```text
- services/vectoplan-editor/frontend entfernen, wenn ungenutzt
- aktive SceneRuntime eindeutig halten
- runtime/scene/* entweder löschen, dokumentieren oder gezielt reaktivieren
```

## 25. Aktueller Gesamtbefund

Der aktuelle Gesamtbefund lautet:

```text
Der VECTOPLAN Editor startet im Browser, lädt die neue src/frontend-basierte
Runtime, nutzt den Editor-Chunk-Proxy korrekt und trennt App-Projekt-ID von
Chunk-Projekt-ID.

Der alte Kernfehler mit falscher Chunk-URL/falscher Projekt-ID ist behoben.
Der Browser läuft über /editor/api/chunk, und chunks/batch gegen
chunk_project_id/world_spawn antwortet erfolgreich.

Die Frontend-Runtime startet mit WorldRuntime, SceneRuntime und PhysicsRuntime.
Pointer Lock / Mouse-Look funktionieren. W/A/S/D-Input erreicht die Physics
korrekt. Die Diagnose hat eindeutig gezeigt, dass Keyboard/Input nicht der
Blocker ist.

Der aktuelle echte technische Blocker liegt im normalen Collision-Solver-Pfad:
Bei aktiver Player-Collision meldet die Probe input_blocked_by_axis, und die
Position bleibt trotz W/A/S/D unverändert.

Damit die Arbeit am Editor weitergehen kann, wurde im
player_physics_controller.ts temporär NoClip aktiviert. Dadurch kann sich der
Builder wieder bewegen, auch durch Blöcke. Dieser Zustand ist ausdrücklich
nicht final.
```

Kurzform:

```text
Build/Runtime/Proxy/App-Chunk-Kontext/WASD-Input/Physics-Pipeline sind weiter.
Normale Player-Collision ist defekt.
Temporärer NoClip ist aktiv und funktioniert.
Nächster Fix: voxel_collision_solver.ts / BlockCollisionQuery / Player-AABB.
```

Nächster Fokus:

```text
- Collision-Solver reparieren
- NoClip danach deaktivieren
- normale Bewegung + echte Block-Kollision prüfen
- Hotbar/Place/Remove/Dirty-Reload erneut E2E testen
- Persistenz nach Reload prüfen
- App-Embed mit mehreren Projekten testen
- Legacy-Frontend und SceneRuntime-Duplikate aufräumen
```

## 26. Wichtigste aktuelle Arbeitsregeln

```text
1. Browser nutzt Public URLs.
2. Browser spricht nur mit /editor/api/chunk.
3. Editor-Backend spricht intern mit vectoplan-chunk.
4. App-Projekt-ID ist nicht automatisch Chunk-Projekt-ID.
5. Für Chunk-Routen ist chunk_project_id maßgeblich.
6. Für Chunk-World ist world_spawn maßgeblich.
7. flat ist nur Template/Provider, nicht editierbare World.
8. Aktive SceneRuntime ist src/frontend/scene/scene_runtime.ts.
9. services/vectoplan-editor/frontend ist Legacy.
10. Vite manifest.json ist Pflicht-Artefakt.
11. Physics muss über aktive SceneRuntime laufen.
12. Store player.physicsRevision muss steigen.
13. Place/Remove müssen Dirty-Chunks reloaden.
14. Hotbar muss placeableBlocks verwenden.
15. Creative Library darf später blocks verwenden.
16. TEMPORARY_PLAYER_NOCLIP_ENABLED ist nur Übergang.
17. Normale Player-Collision muss im voxel_collision_solver.ts repariert werden.
```

---

## 27. Abschlussstand

Aktueller Status:

```text
vectoplan-editor startet.
Editor-Frontend baut grundsätzlich weiter auf src/frontend.
Vite-Manifest wird geladen.
Fullscreen-Canvas startet.
Chunk-Service-Proxy funktioniert.
App-Embed funktioniert grundsätzlich.
Chunk-Batch gegen app-provisioned chunk_project_id/world_spawn funktioniert.
Pointer Lock / Mouse-Look funktioniert.
WASD-Input funktioniert und erreicht Physics.
PhysicsRuntime läuft.
Normale Collision blockiert aktuell horizontale Bewegung fälschlich.
TEMPORARY_PLAYER_NOCLIP_ENABLED ist aktiv.
NoClip-Bewegung funktioniert.
```

Aktuell noch nicht final:

```text
Normale Player-Collision ohne NoClip
voxel_collision_solver.ts / BlockCollisionQuery / Player-AABB
Chunk-Rendering nach finalem Collision-Fix
Hotbar/Place/Remove nach aktueller Änderung erneut prüfen
Reload-Persistenz als expliziter Test
SceneRuntime-Konsolidierung
Legacy-Frontend-Löschung
Creative Library UI
E2E-/Smoke-Test-Automation
Mehrprojekt-App-Embed-Test
```

Empfohlener nächster Schritt:

```text
voxel_collision_solver.ts analysieren und so reparieren, dass horizontale
Bewegung im freien Raum nicht mehr als input_blocked_by_axis endet.
```

Danach:

```text
NoClip deaktivieren, Browser-Matrix erneut testen, dann Persistenz und
App-Embed mit mehreren Projekten prüfen.
```

