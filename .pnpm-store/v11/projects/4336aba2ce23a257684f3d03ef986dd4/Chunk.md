````markdown
<!-- services/vectoplan-editor/Chunk.md -->

# VECTOPLAN Editor – Chunk-System und Übergang zu `vectoplan-chunk`

## 0. Datei

```text
Ordner: services/vectoplan-editor
Datei: Chunk.md
Pfad: services/vectoplan-editor/Chunk.md
````

Dieses Dokument beschreibt den aktuellen Chunk-Stand im `vectoplan-editor` und dient als erster technischer Bauplan für den neuen Microservice:

```text
services/vectoplan-chunk
```

> Aktueller Produktionsstand: Der Übergang ist für die Earth-DGM-Pipeline umgesetzt. Der verbindliche, serviceübergreifende Laufzeitvertrag steht in [`../vectoplan-chunk/docs/EARTH_DGM_PIPELINE.md`](../vectoplan-chunk/docs/EARTH_DGM_PIPELINE.md). Dort sind Release- und Cache-Identität, Regionsvorbereitung, Batch-Umschläge, RLE, Spawn/Kollision, Meshing und Request-Deduplizierung beschrieben. Die folgenden Abschnitte bleiben als Architektur- und Migrationshistorie erhalten.

Der neue Service soll Chunks generieren, vorbereiten und dem Editor liefern. Er wird damit das Bindeglied zwischen:

```text
vectoplan-core-service
→ kanonische Projekt-/Gebäudedaten

vectoplan-chunk
→ runtimefähige Chunk-Daten / Chunk-Artefakte

vectoplan-editor
→ Streaming, Rendering, Targeting, Place/Break-Interaktion
```

---

# 1. Kurzfazit

Der Editor besitzt aktuell bereits ein lokales Chunk-System.

Aktuell werden Chunks im Editor selbst verwaltet und teilweise lokal generiert:

```text
Editor Runtime
→ ChunkStreaming
→ ChunkLoader
→ ChunkSource
→ lokale Test-/Flat-Block-World-Quelle
→ ChunkRegistry
→ ChunkMesher
→ ChunkSceneController
→ Three.js Scene
```

Der neue Microservice `vectoplan-chunk` soll diese lokale Chunk-Erzeugung langfristig ersetzen oder ergänzen.

Zielbild:

```text
Core besitzt die fachliche Wahrheit.
Chunk-Service erzeugt runtimefähige Chunks.
Editor lädt Chunks, mesht oder rendert sie und bleibt interaktive Oberfläche.
```

Wichtig:

```text
vectoplan-chunk ist nicht der Core.
vectoplan-chunk ist nicht der Editor.
vectoplan-chunk ist eine Runtime-/Artifact-/Chunk-Generierungsschicht.
```

---

# 2. Rolle von Chunks im Editor

Chunks sind im Editor die technische Ladeeinheit für sichtbare Weltbereiche.

Sie dienen aktuell für:

* sichtbare Weltabschnitte
* Streaming um den Spieler / die Kamera
* begrenzte Ladebereiche
* Performance
* Targeting / Sampling
* Meshing
* Dirty-Tracking
* spätere Teilupdates

Ein Chunk ist nicht die fachliche Projektwahrheit.

Ein Chunk ist eine runtimefreundliche Darstellung von Weltinhalt.

---

# 3. Aktueller Chunk-Datenfluss im Editor

Aktuell ist der relevante Ablauf ungefähr:

```text
SceneRuntime
→ WorldRuntime.update(...)
→ ChunkStreaming entscheidet benötigte Chunks
→ ChunkLoader lädt Chunks aus ChunkSource
→ ChunkRegistry speichert geladene Chunks
→ ChunkMesher baut Meshdaten
→ ChunkSceneController hängt Meshes in Three.js Scene
→ Renderer rendert Frame
```

Etwas detaillierter:

```text
Kamera / Player-Position
→ chunk_streaming.ts
→ Liste benötigter Chunk-Koordinaten
→ chunk_loader.ts
→ chunk_source.ts / block_world_source.ts / test_world_source.ts
→ chunk_registry.ts
→ chunk_mesher.ts
→ chunk_scene_controller.ts
→ scene_renderer.ts / Three.js
```

---

# 4. Aktuelle zentrale Editor-Dateien für Chunks

## 4.1 World-/Chunk-Runtime

```text
frontend/src/runtime/world/world_runtime.ts
```

Zuständigkeit:

* orchestriert World-/Chunk-Updates
* ruft Streaming-Logik auf
* startet Chunk-Ladevorgänge
* verwaltet Lifecycle und Fehler
* publiziert World-State in Richtung Runtime-State
* ist aktuell vom Fehler `normalizeWorldRuntimePublishedState is not defined` betroffen

---

```text
frontend/src/runtime/world/world_models.ts
```

Zuständigkeit:

* Typen und Normalisierung für World-Runtime-State
* erwarteter Ort für `normalizeWorldRuntimePublishedState`
* wichtig für stabilen Published-State zwischen WorldRuntime und SceneRuntime

---

```text
frontend/src/runtime/world/world_projection.ts
```

Zuständigkeit:

* übersetzt WorldRuntime-interne Daten in State-/Render-nahe Strukturen
* kann später relevant werden, wenn Remote-Chunks zusätzliche Metadaten liefern

---

## 4.2 Chunk-Koordinaten

```text
frontend/src/runtime/world/chunk_coordinates.ts
```

Zuständigkeit:

* Weltkoordinate zu Chunk-Koordinate
* Weltkoordinate zu lokaler Zellkoordinate
* Chunk-Koordinate zu Chunk-Key
* Cell-Key / Column-Key
* stabile Chunk-ID-Erzeugung

Diese Datei ist extrem wichtig für den neuen Service.

Der neue `vectoplan-chunk` muss dieselbe Koordinatenlogik verstehen oder exakt kompatible IDs liefern.

Beispielhafte Konzepte:

```text
worldX, worldY, worldZ
→ chunkX, chunkY, chunkZ
→ localX, localY, localZ
→ chunkKey
```

Wenn Editor und Chunk-Service hier unterschiedliche Regeln haben, entstehen Fehler wie:

```text
Chunk wird geladen, aber an falscher Stelle gerendert.
Targeting trifft falsche Zelle.
Place/Break verändert falschen Bereich.
Dirty-Updates remeshen falschen Chunk.
```

---

## 4.3 ChunkSource-Abstraktion

```text
frontend/src/runtime/world/chunk_source.ts
```

Zuständigkeit:

* definiert, wie Chunks geladen werden
* abstrahiert lokale, generierte, remote und hybride Quellen
* enthält Request-/Response-Modelle
* enthält Capabilities
* enthält Batch-Load-Logik
* ist der zentrale Erweiterungspunkt für `vectoplan-chunk`

Aktuell bekannte `ChunkSourceKind`:

```text
test
generated
local
remote
hybrid
flat-block-world
unknown
```

Für `vectoplan-chunk` ist wichtig:

```text
remote
hybrid
```

Der neue Service sollte im Editor nicht direkt überall eingebaut werden. Besser ist:

```text
neue RemoteChunkSource
→ implementiert vorhandenes ChunkSource-Interface
→ WorldRuntime bleibt weitgehend unverändert
```

---

## 4.4 ChunkLoader

```text
frontend/src/runtime/world/chunk_loader.ts
```

Zuständigkeit:

* nimmt ChunkLoadRequests entgegen
* ruft ChunkSource auf
* verarbeitet Response
* behandelt Fehler / Abort / Timing
* gibt geladene Chunks an Registry weiter

Für den neuen Service:

```text
chunk_loader.ts sollte möglichst weiterverwendet werden.
Nur die Source dahinter wird ersetzt.
```

---

## 4.5 ChunkStreaming

```text
frontend/src/runtime/world/chunk_streaming.ts
```

Zuständigkeit:

* entscheidet anhand Kamera-/Player-Position, welche Chunks gebraucht werden
* nutzt ViewDistance, PreloadRadius, UnloadDistance
* erzeugt Load-/Unload-Entscheidungen

Für den neuen Service:

```text
Streaming bleibt im Editor.
Der Chunk-Service entscheidet nicht, was der Editor gerade braucht.
Der Editor fragt gezielt die Chunks an, die im View-Kontext gebraucht werden.
```

---

## 4.6 ChunkRegistry

```text
frontend/src/runtime/world/chunk_registry.ts
```

Zustigkeit:

* hält geladene Chunks
* hält Ladezustände
* kennt verfügbare, fehlende, fehlerhafte oder dirty Chunks
* dient als Zwischenschicht zwischen ChunkLoader und Renderer

Für den neuen Service:

```text
ChunkRegistry bleibt im Editor.
Remote-Chunks werden dort genauso registriert wie lokale Chunks.
```

---

## 4.7 ChunkContent-Modelle

```text
frontend/src/runtime/world/chunk_content_models.ts
```

Zuständigkeit:

* beschreibt die tatsächlichen Chunk-Inhalte
* definiert Zellen, Palette, Zellwerte, Empty-/Filled-Status
* wichtig für Meshing und Sampling

Für `vectoplan-chunk` ist das der wichtigste Datenvertrag.

Der neue Service muss Payloads liefern, die in diese Modelle normalisiert werden können.

---

## 4.8 ChunkSampling

```text
frontend/src/runtime/world/chunk_sampling.ts
```

Zuständigkeit:

* liest einzelne Zellen / Blöcke aus ChunkContent
* wird für Targeting, Break und Kollisionslogik relevant
* entscheidet, ob eine Zelle Air oder Solid ist

Für den neuen Service:

```text
Remote-Chunks müssen so strukturiert sein, dass Sampling weiter funktioniert.
```

---

## 4.9 BlockWorldSource und BlockWorldStore

```text
frontend/src/runtime/world/block_world_source.ts
frontend/src/runtime/world/block_world_store.ts
```

Aktueller Zweck:

* lokale Flat-Block-World
* lokale Mutationen
* Overlay-Speicher
* Dirty-Tracking
* `setBlock`
* `removeBlock`
* ChunkContent-Erzeugung

Diese Dateien sind aktuell ein lokaler Prototyp.

Langfristig gibt es zwei mögliche Rollen:

### Rolle A: Lokale Dev-/Fallback-Source

```text
Wenn vectoplan-chunk nicht erreichbar ist:
→ lokale Flat-Block-World bleibt als Fallback aktiv
```

### Rolle B: Lokale Edit-Overlay-Schicht

```text
Remote-Chunks kommen vom Chunk-Service.
Lokale unbestätigte Änderungen werden im Editor als Overlay gehalten.
```

Das ist später wichtig, wenn der Editor schnell auf Eingaben reagieren soll, bevor der Core bestätigt.

---

# 5. Aktueller Renderpfad

## 5.1 Three.js Renderer

```text
frontend/src/render/scene_renderer.ts
```

Zuständigkeit:

* Three.js Scene
* Camera
* WebGLRenderer
* Canvas
* Resize
* Frame rendern
* Dispose

Der Chunk-Service liefert keine Three.js-Objekte.

Er liefert Daten oder Artefakte.

Three.js bleibt im Editor.

---

## 5.2 ChunkMesher

```text
frontend/src/render/chunks/chunk_mesher.ts
```

Zuständigkeit:

* ChunkContent zu Meshdaten übersetzen
* sichtbare Flächen bestimmen
* Vertices / Normals / UVs erzeugen
* Materialgruppen erzeugen

Aktuell wird wahrscheinlich clientseitig gemesht.

Für `vectoplan-chunk` gibt es zwei Optionen:

## Option 1: Service liefert Zell-/Blockdaten, Editor mesht

```text
vectoplan-chunk
→ RuntimeChunkContent
→ Editor ChunkMesher
→ Three.js Mesh
```

Vorteile:

* Editor behält Kontrolle über Darstellung
* Targeting/Sampling funktionieren direkt auf Zellinhalt
* einfacher für Place/Break/Dirty-Updates
* gut für den aktuellen BlockWorld-Stand

Nachteile:

* Meshing kostet im Browser CPU
* große Welten können später schwerer werden

## Option 2: Service liefert fertige Mesh-/Artefaktdaten

```text
vectoplan-chunk
→ mesh payload / GLB / binary artifact
→ Editor lädt direkt Geometry
→ Three.js Scene
```

Vorteile:

* weniger Browser-CPU
* gut für große oder komplexe Projekte
* später besser für semantische Bauteile / Instancing / GLB-Prototypen

Nachteile:

* Targeting braucht zusätzlich Picking-/Cell-/Semantic-Daten
* Place/Break wird komplexer
* Dirty-Updates müssen stärker versioniert werden

Empfehlung für die erste Version:

```text
Phase 1:
vectoplan-chunk liefert weiterhin zellbasierte RuntimeChunkContent-Daten.

Phase 2:
zusätzlich optionale Mesh-Artefakte oder Instancing-Artefakte.

Phase 3:
hybride Chunks aus Zellen, Instanzen, Semantik und vorbereiteten Render-Artefakten.
```

---

## 5.3 ChunkSceneController

```text
frontend/src/render/chunks/chunk_scene_controller.ts
```

Zuständigkeit:

* Chunk-Meshes in Three.js Scene hinzufügen
* Chunk-Meshes ersetzen
* Chunks entfernen
* Dirty-Chunks aktualisieren
* Geometrien entsorgen

Für den neuen Service:

```text
ChunkSceneController bleibt im Editor.
Er bekommt Meshdaten aus dem Mesher oder später fertige Geometrien aus einem Artifact-Loader.
```

---

# 6. Aktueller lokaler Chunk-Pfad

Der aktuelle lokale Pfad sieht grob so aus:

```text
WorldRuntime
→ ChunkStreaming
→ ChunkLoader
→ ChunkSource
→ block_world_source.ts oder test_world_source.ts
→ BlockWorldStore erzeugt RuntimeChunkContent
→ ChunkRegistry speichert
→ ChunkMesher erzeugt Mesh
→ ChunkSceneController zeigt Mesh
```

Die lokale Flat-Block-World erzeugt ihre Daten selbst.

Das ist für Entwicklung gut, aber nicht das Zielbild für VECTOPLAN.

Aktuelle lokale Quelle:

```text
flat-block-world
```

Diese ist nützlich für:

* Dev-Welt
* Targeting-Test
* Place-/Break-Test
* Dirty-Chunk-Test
* Meshing-Test
* Renderer-Test

Sie ist nicht die finale Quelle für Projektdaten.

---

# 7. Zielbild mit `vectoplan-chunk`

Der neue Service soll den Editor von lokaler Chunk-Erzeugung entkoppeln.

Zielbild:

```text
vectoplan-core-service
→ liefert kanonisches Projektmodell / Core-Dateien / Revisionen

vectoplan-chunk
→ liest oder erhält Projekt-/Core-Daten
→ erzeugt runtimefähige Chunk-Daten
→ versioniert Chunk-Artefakte
→ liefert Chunks an den Editor

vectoplan-editor
→ fragt Chunks nach Bedarf ab
→ streamt Chunks
→ rendert Chunks mit Three.js
→ hält lokale Preview-/Edit-Overlays
→ sendet bestätigende Commands weiter an Core
```

Wichtig:

```text
Der Editor fragt nicht direkt den Core nach Rohmodell-Daten für jeden Frame.
Der Editor fragt runtimefähige Chunks.
```

---

# 8. Rolle von `vectoplan-chunk`

Der neue Service soll zuständig sein für:

* Chunk-Generierung
* Chunk-Normalisierung
* Chunk-Koordinatensystem
* Chunk-Paletten
* Mapping von Core-/Projektdateien in RuntimeChunkContent
* später Caching
* später Artifact-Erzeugung
* später Mesh-/Instancing-Artefakte
* später Delta-/Patch-Chunks
* später Picking- und Semantic-Indizes

Nicht zuständig:

* kein Owner der Projektwahrheit
* keine finale Persistenzhoheit
* keine Editor-Input-Logik
* keine Three.js-Szene
* keine Hotbar
* keine Pointer-Lock-Logik
* keine UI
* keine finale Validierung von Commands

---

# 9. Erste Zielstruktur für `services/vectoplan-chunk`

Der Service sollte ähnlich wie `vectoplan-editor` aufgebaut werden:

```text
services/
└── vectoplan-chunk/
    ├── AI.md
    ├── Chunk.md
    ├── README.md
    ├── Dockerfile
    ├── entrypoint.sh
    ├── requirements.txt
    ├── wsgi.py
    ├── app.py
    ├── config.py
    ├── extensions.py
    │
    ├── bootstrap/
    │   ├── __init__.py
    │   ├── startup.py
    │   └── health.py
    │
    ├── routes/
    │   ├── __init__.py
    │   ├── health.py
    │   ├── chunks.py
    │   └── metadata.py
    │
    ├── src/
    │   ├── chunking/
    │   │   ├── __init__.py
    │   │   ├── coordinates.py
    │   │   ├── models.py
    │   │   ├── palette.py
    │   │   ├── content.py
    │   │   ├── generator.py
    │   │   ├── normalize.py
    │   │   └── serializer.py
    │   │
    │   ├── sources/
    │   │   ├── __init__.py
    │   │   ├── core_file_source.py
    │   │   ├── debug_flat_source.py
    │   │   └── generated_source.py
    │   │
    │   ├── artifacts/
    │   │   ├── __init__.py
    │   │   ├── cache.py
    │   │   ├── manifest.py
    │   │   └── storage.py
    │   │
    │   └── clients/
    │       ├── __init__.py
    │       └── core_client.py
    │
    └── tests/
        ├── unit/
        ├── integration/
        └── e2e/
```

Für den ersten Schritt reichen wahrscheinlich:

```text
routes/health.py
routes/chunks.py
src/chunking/models.py
src/chunking/coordinates.py
src/chunking/generator.py
src/chunking/serializer.py
src/sources/debug_flat_source.py
```

---

# 10. Erste API-Idee für `vectoplan-chunk`

## 10.1 Health

```text
GET /health
```

Antwort:

```json
{
  "ok": true,
  "service": "vectoplan-chunk",
  "version": "0.1.0"
}
```

---

## 10.2 Chunk-Metadaten

```text
GET /chunks/metadata
```

Query:

```text
projectId
revisionId
worldId
```

Antwort:

```json
{
  "ok": true,
  "chunkSize": 16,
  "cellSize": 1,
  "coordinateSystem": "vectoplan-world-v1",
  "defaultSource": "debug-flat",
  "supportsBatch": true,
  "supportsAbort": true,
  "supportsPalette": true,
  "supportsDirty": false
}
```

---

## 10.3 Einzelnen Chunk laden

```text
GET /chunks/{chunkKey}
```

Oder expliziter:

```text
GET /chunks
  ?projectId=...
  &revisionId=...
  &chunkX=0
  &chunkY=0
  &chunkZ=0
```

Antwort:

```json
{
  "ok": true,
  "chunk": {
    "id": "0:0:0",
    "chunkX": 0,
    "chunkY": 0,
    "chunkZ": 0,
    "chunkSize": 16,
    "content": {
      "format": "runtime-cells-v1",
      "palette": [
        { "index": 0, "blockTypeId": "debug_grass" },
        { "index": 1, "blockTypeId": "debug_dirt" }
      ],
      "cells": "..."
    }
  }
}
```

---

## 10.4 Mehrere Chunks laden

```text
POST /chunks/batch
```

Request:

```json
{
  "projectId": "local-dev",
  "revisionId": "dev",
  "worldId": "main",
  "chunks": [
    { "chunkX": 0, "chunkY": 0, "chunkZ": 0 },
    { "chunkX": 1, "chunkY": 0, "chunkZ": 0 }
  ]
}
```

Antwort:

```json
{
  "ok": true,
  "chunks": [
    {
      "id": "0:0:0",
      "chunkX": 0,
      "chunkY": 0,
      "chunkZ": 0,
      "content": {}
    },
    {
      "id": "1:0:0",
      "chunkX": 1,
      "chunkY": 0,
      "chunkZ": 0,
      "content": {}
    }
  ],
  "errors": []
}
```

Empfehlung:

```text
Der Editor sollte langfristig Batch-Loads bevorzugen.
Einzel-Loads sind nützlich für Debugging.
```

---

# 11. Datenvertrag zwischen Editor und Chunk-Service

Der wichtigste Vertrag ist nicht HTTP, sondern die Form des Chunk-Inhalts.

Der Editor braucht für die aktuelle Block-/Chunk-Logik:

```text
Chunk-ID
Chunk-Koordinaten
Chunk-Größe
Palette
Zellinhalt
Empty-/Filled-Status
Version / Revision
optional Bounds
optional Source-Metadaten
```

Minimaler Vertrag:

```text
RuntimeChunkContent
```

Der neue Service sollte sich an den existierenden Editor-Modellen orientieren:

```text
frontend/src/runtime/world/chunk_content_models.ts
frontend/src/runtime/world/chunk_coordinates.ts
frontend/src/runtime/world/chunk_source.ts
```

Wichtig:

```text
Nicht zuerst ein komplett neues Chunk-Format erfinden.
Zuerst das Format liefern, das der Editor bereits normalisieren und meshen kann.
```

---

# 12. Koordinatensystem

Das Koordinatensystem muss zwischen Editor und `vectoplan-chunk` identisch sein.

Zu definieren:

```text
chunkSize
cellSize
world origin
Achsenrichtung
Y-up oder Z-up
Chunk-ID-Format
lokale Zellkoordinaten
negative Koordinaten
Rundung / floor-Verhalten
```

Empfehlung für den aktuellen Editor:

```text
Three.js arbeitet Y-up.
Editor-Kamera und Welt wirken wahrscheinlich Y-up.
Blockpositionen sollten deshalb worldX, worldY, worldZ behalten.
Chunk-Koordinaten sollten daraus konsistent per floor division entstehen.
```

Kritisch bei negativen Koordinaten:

```text
Math.floor(-1 / 16) = -1
nicht 0
```

Wenn Python und TypeScript unterschiedlich runden, entstehen Chunk-Fehler.

Python muss für Chunk-Koordinaten dieselbe Logik verwenden wie TypeScript.

---

# 13. Palette und Zellwerte

Aktuell gilt laut Editor-IST:

```text
Encoded Cell Value 0 = Air
PaletteIndex 0 wird als Cell Value 1 gespeichert
```

Das bedeutet:

```text
cellValue = 0
→ Air

cellValue = paletteIndex + 1
→ Block mit PaletteIndex
```

Beispiel:

```text
debug_grass hat PaletteIndex 0
gespeicherter Cell Value = 1
```

Das muss `vectoplan-chunk` exakt beachten.

Wenn der Service `0` als erstes Blockmaterial interpretiert, sieht der Editor Air statt Block oder umgekehrt.

---

# 14. Ersetzungsstrategie im Editor

## 14.1 Nicht alles ersetzen

Nicht ersetzen:

```text
chunk_streaming.ts
chunk_loader.ts
chunk_registry.ts
chunk_mesher.ts
chunk_scene_controller.ts
scene_renderer.ts
```

Diese bleiben wertvoll.

Zuerst ersetzen oder ergänzen:

```text
ChunkSource
```

Konkret:

```text
Neue Remote-/Service-Source:
frontend/src/runtime/world/chunk_service_source.ts
```

oder:

```text
frontend/src/runtime/world/sources/chunk_service_source.ts
```

Diese neue Source implementiert das vorhandene `ChunkSource`-Interface und ruft `vectoplan-chunk` per HTTP auf.

---

## 14.2 Aktueller lokaler Pfad

```text
WorldRuntime
→ ChunkLoader
→ BlockWorldSource/TestWorldSource
→ RuntimeChunkContent
```

## 14.3 Neuer Remote-Pfad

```text
WorldRuntime
→ ChunkLoader
→ ChunkServiceSource
→ fetch("/chunk-api/chunks/batch")
→ normalize remote payload
→ RuntimeChunkContent
```

## 14.4 Hybrid-Pfad

Für Entwicklung und Ausfallsicherheit:

```text
WorldRuntime
→ ChunkLoader
→ HybridChunkSource
   → zuerst ChunkServiceSource
   → bei Fehler LocalBlockWorldSource oder TestWorldSource
```

Empfehlung:

```text
Phase 1: local bleibt Default.
Phase 2: remote kann per Bootstrap aktiviert werden.
Phase 3: remote wird Default, local bleibt Fallback.
```

---

# 15. Bootstrap-Konfiguration im Editor

Der Editor muss vom Backend erfahren, welche Chunk-Quelle aktiv ist.

Bootstrap sollte später enthalten:

```json
{
  "runtime": {
    "chunks": {
      "enabled": true,
      "source": "remote",
      "serviceBaseUrl": "http://localhost:XXXX",
      "apiUrl": "/chunks/batch",
      "chunkSize": 16,
      "viewDistance": 7,
      "preloadRadius": 1,
      "unloadDistance": 9,
      "maxLoadedChunks": 384,
      "loadAroundPlayer": true,
      "fallbackSource": "flat-block-world"
    }
  }
}
```

Aktuelle Streaming-Strategie:

- Der horizontale Sichtbereich ist ein Kreis mit Radius `7`, kein Quadrat.
- Die aktuelle `chunkY`-Ebene wird bis Radius `7` geladen.
- Für Kollisionen, Sprünge und Erdschichten lädt der Nahbereich bis Radius `2` zusätzlich `chunkY - 1` und `chunkY + 1`.
- Radius `8` wird als gerichteter Prefetch-Ring nachgeladen.
- Erst danach werden alte, nicht sichtbare und nicht geänderte Chunks aus dem Cache verdrängt.

So umfasst der primäre Sichtbereich 175 statt 447 Chunks. Die Horizontweite bleibt bei Radius `7`, während Initialantwort, Mesh-Aufbau und Browser-Speicher kontrollierbar bleiben.

`maxLoadedChunks` wird vom Bootstrap bis in die Registry weitergegeben und begrenzt den Cache tatsächlich.

Wichtig:

```text
Editor-TS darf Service-URL nicht hart codieren.
Die URL kommt aus Bootstrap oder Dataset.
```

---

## 15.1 Bewegungs-Streaming ohne sichtbare Chunk-Kanten

- Sichtbare Daten werden in Paketen von höchstens `24` Chunks übertragen und nach jedem Paket gerendert.
- Der erste Aufbau wird von innen nach außen priorisiert.
- Bei Bewegung werden nur fehlende Chunks des neu eintretenden Kreisrandes geladen; die Flugrichtung erhält Vorrang.
- Ändert sich die Kamera während eines Requests, endet der veraltete Auftrag nach dem laufenden Paket und die neueste Position übernimmt.
- Der Radius-8-Prefetch nutzt Pakete von höchstens `12` Chunks und markiert die Registry nicht als sichtbar.
- Der bisher sichtbare Satz bleibt bestehen, bis der neue Radius-7-Zielsatz vollständig verfügbar ist.

Teil-Chunks werden bewusst nicht eingeführt: Sie würden ein neues API-, Cache-, Versions- und Meshing-Protokoll sowie zusätzliche Nahtbehandlung benötigen. Kleine Delta-Pakete vollständiger Chunks erzielen denselben sichtbaren Streaming-Effekt mit deutlich geringerem Fehler- und Komplexitätsrisiko.
# 16. Same-Origin, Proxy oder CORS

Es gibt drei mögliche Wege, wie der Editor Chunks laden kann.

## Option A: Browser ruft `vectoplan-chunk` direkt auf

```text
Browser
→ http://localhost:chunk-port/chunks/batch
```

Vorteile:

* direkt
* weniger Last auf Editor-Service
* einfach für Microservice-Kommunikation

Nachteile:

* CORS muss sauber konfiguriert werden
* Service-URL muss im Frontend bekannt sein
* Auth später komplexer

## Option B: Editor-Service proxyt Chunk-Anfragen

```text
Browser
→ /editor/api/chunks/batch
→ vectoplan-editor backend
→ vectoplan-chunk
```

Vorteile:

* Same-Origin für Browser
* weniger CORS-Probleme
* Auth kann später zentral über Editor/Core-Kontext laufen

Nachteile:

* Editor-Service wird Gateway
* mehr Backend-Code im Editor

## Option C: Gateway / Reverse Proxy

```text
Browser
→ /chunk-api/...
→ Reverse Proxy
→ vectoplan-chunk
```

Vorteile:

* sauber für Produktion
* Services bleiben getrennt
* Browser sieht gleiche Origin

Nachteile:

* Infrastruktur nötig

Empfehlung:

```text
Entwicklung:
Option B oder C, damit der Browser keine CORS-Probleme bekommt.

Langfristig:
Gateway/Reverse Proxy.
```

---

# 17. Was `vectoplan-chunk` aus Core braucht

Der Chunk-Service soll Bindeglied zwischen Core-Dateien und Editor sein.

Er braucht später Zugriff auf:

```text
Projekt-ID
Revision-ID
World-/Level-ID
Grids / Geschosse
Instanzen
Bauteile
Block-/Voxel-Prototypen
Objekt-Geometrien
Material-/Palette-Informationen
Bounds
Semantik für Picking / Targeting
```

Aber in Phase 1 reicht:

```text
debug project
debug revision
flat generated world
known block palette
```

Danach:

```text
Core Snapshot
→ Chunk Generator
→ RuntimeChunkContent
```

---

# 18. Verhältnis zu Core

Core bleibt Owner:

```text
Projektmodell
Revisionen
Commands
Validierung
Persistenz
```

Chunk-Service darf:

```text
Core-Daten lesen
Core-Snapshots in Runtime-Chunks transformieren
Chunk-Manifeste erzeugen
Chunk-Artefakte cachen
```

Chunk-Service darf nicht:

```text
Projektwahrheit eigenständig verändern
Commands final validieren
Revisionen besitzen
Core-Datenbank direkt umgehen
```

---

# 19. Verhältnis zum Editor

Editor bleibt Owner von:

```text
Input
Kamera
Pointer Lock
Targeting
Hotbar
lokalem Runtime-State
Preview
lokalem Edit-Overlay
Three.js Scene
```

Editor darf:

```text
Chunks anfordern
Chunks cachen
Chunks meshen
Chunks rendern
lokale unbestätigte Änderungen overlayen
```

Editor darf nicht:

```text
Chunk-Service als Projektwahrheit behandeln
Core überspringen
remote Chunk-Daten direkt als persistierte Wahrheit betrachten
```

---

# 20. Three.js im Zielbild

Three.js bleibt im Editor.

Der Chunk-Service soll keine Three.js-spezifischen Objekte liefern.

Nicht liefern:

```text
THREE.Mesh
THREE.BufferGeometry
THREE.Material
THREE.Scene
```

Stattdessen liefern:

```text
zellbasierte Chunk-Daten
oder generische Mesh-Artefakte
oder GLB-/binary-Artefakte
oder Instancing-Daten
```

Der Editor übersetzt diese Daten in Three.js.

Aktueller Pfad:

```text
RuntimeChunkContent
→ chunk_mesher.ts
→ BufferGeometry / Mesh
→ chunk_scene_controller.ts
→ THREE.Scene
```

Später möglich:

```text
ChunkArtifact
→ GLTFLoader / custom loader
→ THREE.Object3D
→ chunk_scene_controller.ts
```

---

# 21. Targeting und Picking

Ein wichtiger Punkt:

Rendering allein reicht nicht.

Der Editor braucht weiterhin Daten für:

```text
Raycast
TargetCell
TargetFace
canPlace
canBreak
selectionCellKey
placementCellKey
```

Wenn der Chunk-Service nur fertige Meshes liefert, fehlen diese Informationen.

Deshalb sollte Phase 1 zellbasierte Chunks liefern.

Später können Mesh-Artefakte ergänzt werden, aber zusätzlich braucht der Editor:

```text
Picking Index
Cell Map
Semantic Map
Instance Map
Anchor/Socket Map
```

---

# 22. Dirty-Chunks und lokale Änderungen

Aktuell gibt es lokale Mutationen:

```text
setBlock
removeBlock
dirtyChunkIds
requestWorldRefresh
remesh
```

Mit `vectoplan-chunk` gibt es zwei Arten von Änderungen:

## 22.1 Lokale Preview-Änderung

```text
Nutzer klickt
→ Editor setzt lokal Preview/Overlay
→ sichtbar sofort
→ Command geht an Core
```

## 22.2 Bestätigte Änderung

```text
Core bestätigt Command
→ Chunk-Service erzeugt neue Chunk-Version oder Patch
→ Editor lädt betroffene Chunks neu
```

Für Phase 1 kann man weiterhin lokal mutieren.

Langfristig:

```text
Remote Chunk
+ Local Overlay
= sichtbarer Editor-Zustand
```

Das bedeutet:

```text
block_world_store.ts kann später als Overlay-Schicht weiterleben.
```

---

# 23. Versionierung

Remote-Chunks brauchen Versionierung.

Mindestens:

```text
projectId
revisionId
worldId
chunkKey
chunkVersion
contentHash
generatedAt
sourceRevision
```

Warum?

* Editor muss wissen, ob Chunk veraltet ist.
* Cache braucht Vergleichswerte.
* Dirty-/Reload-Logik braucht stabile IDs.
* Core-Revisionen müssen nachvollziehbar sein.

Beispiel:

```json
{
  "projectId": "p_123",
  "revisionId": "r_42",
  "worldId": "main",
  "chunkKey": "0:0:0",
  "chunkVersion": "r_42:0:0:0",
  "contentHash": "sha256:..."
}
```

---

# 24. Caching

Phase 1:

```text
kein persistenter Cache nötig
in-memory reicht
```

Phase 2:

```text
Chunk-Service cachet generierte Chunks
Editor cachet geladene Chunks in ChunkRegistry
```

Phase 3:

```text
Object Storage für große Artefakte
ETags
If-None-Match
Manifest
Patch-/Delta-Updates
```

HTTP-Header später:

```text
ETag
Cache-Control
Last-Modified
X-VECTOPLAN-Chunk-Version
X-VECTOPLAN-Project-Revision
```

---

# 25. Fehlerbehandlung

Der Editor muss mit folgenden Fehlern umgehen:

```text
Chunk-Service nicht erreichbar
Chunk fehlt
Chunk-Format ungültig
Chunk-Version veraltet
Chunk-Koordinaten ungültig
Batch teilweise erfolgreich
Timeout
Abort
CORS
JSON parse error
```

ChunkLoader sollte solche Fehler nicht die gesamte Runtime zerstören lassen.

Besser:

```text
Chunk markiert als failed
WorldRuntime läuft weiter
DebugOverlay zeigt Fehler
optional lokale Fallback-Source
```

---

# 26. Empfohlene Implementierungsphasen

## Phase 1 – Debug Chunk Service

Ziel:

```text
vectoplan-chunk läuft als Flask-Service
liefert generierte Debug-Chunks
Editor kann RemoteChunkSource verwenden
```

Daten:

```text
flat generated world
debug_grass
debug_dirt
debug_stone
```

Keine Core-Integration.

---

## Phase 2 – Editor RemoteChunkSource

Neue Editor-Datei:

```text
frontend/src/runtime/world/sources/chunk_service_source.ts
```

Aufgabe:

```text
implementiert ChunkSource
ruft vectoplan-chunk HTTP API auf
normalisiert Response zu RuntimeChunkContent
unterstützt batch-load
unterstützt abort
```

---

## Phase 3 – Bootstrap-Umschaltung

Editor-Bootstrap erweitern:

```text
runtime.chunks.source = "remote"
runtime.chunks.serviceBaseUrl = ...
runtime.chunks.batchEndpoint = ...
runtime.chunks.fallbackSource = "flat-block-world"
```

---

## Phase 4 – Hybrid Source

Neue oder erweiterte Source:

```text
hybrid_chunk_source.ts
```

Ablauf:

```text
Remote versuchen
bei Fehler lokale Flat-Block-World
Fehler im Debug-State sichtbar machen
```

---

## Phase 5 – Core-Snapshot zu Chunk

`vectoplan-chunk` liest Core-Daten:

```text
core snapshot
→ chunk generator
→ runtime chunk content
```

---

## Phase 6 – Patch-/Revision-Update

Nach Editor-Command:

```text
Editor sendet Command an Core
Core bestätigt Revision
Chunk-Service erzeugt betroffene Chunks neu
Editor lädt betroffene Chunks neu
```

---

# 27. Konkrete Editor-Dateien, die später angepasst werden müssen

## 27.1 Neue Datei

```text
frontend/src/runtime/world/sources/chunk_service_source.ts
```

Zweck:

```text
Remote ChunkSource für vectoplan-chunk
```

---

## 27.2 Wahrscheinlich anzupassen

```text
frontend/src/runtime/world/chunk_source.ts
```

Anpassung:

```text
Capabilities remote/hybrid prüfen
mutable/dirty-tracking ergänzen
remote metadata erweitern
```

---

```text
frontend/src/runtime/world/chunk_loader.ts
```

Anpassung:

```text
Remote-Response-Normalisierung prüfen
Batch-Load sauber unterstützen
AbortSignal weiterreichen
```

---

```text
frontend/src/runtime/world/world_runtime.ts
```

Anpassung:

```text
Source-Auswahl aus Bootstrap
Remote Source initialisieren
Hybrid/Fallback konfigurieren
normalizeWorldRuntimePublishedState fixen
```

---

```text
frontend/src/runtime/world/world_models.ts
```

Anpassung:

```text
remote chunk source state
service status
last remote error
normalizeWorldRuntimePublishedState
```

---

```text
frontend/src/bootstrap/*
```

Anpassung:

```text
runtime.chunks.source
runtime.chunks.serviceBaseUrl
runtime.chunks.batchEndpoint
runtime.chunks.fallbackSource
```

---

```text
frontend/src/state/runtime_state_models.ts
frontend/src/state/runtime_state.ts
```

Anpassung:

```text
chunk service status
remote chunk metrics
failed remote loads
fallback usage
```

---

```text
frontend/src/ui/debug_overlay.ts
```

Anpassung:

```text
Chunk source anzeigen
remote/local/hybrid
loaded chunks
failed chunks
last chunk service error
batch latency
```

---

# 28. Risiken beim Übergang

## 28.1 Koordinaten-Mismatch

Größtes Risiko.

Editor und Chunk-Service müssen identisch rechnen:

```text
world -> chunk
chunk -> key
world -> local cell
```

---

## 28.2 Format-Mismatch

Der Service darf nicht ein Format liefern, das der Editor nicht meshen kann.

Deshalb:

```text
erst Editor-Modelle spiegeln
nicht sofort neues Format erfinden
```

---

## 28.3 Targeting verliert Daten

Wenn nur Meshes geliefert werden, kann Targeting brechen.

Deshalb:

```text
Phase 1 zellbasierte Chunk-Daten
```

---

## 28.4 Zu frühe Core-Kopplung

Nicht sofort Core-Dateien komplex anbinden.

Erst:

```text
debug chunks
remote source
editor streaming
render sichtbar
```

Dann Core.

---

## 28.5 Runtime-Fehler im Editor

Der bekannte Fehler muss parallel behoben werden:

```text
normalizeWorldRuntimePublishedState is not defined
```

Sonst lässt sich Remote-Chunk-Verhalten nicht stabil bewerten.

---

# 29. Erster konkreter Bauplan

## Schritt 1: `vectoplan-chunk` Grundservice

Erstellen:

```text
services/vectoplan-chunk/app.py
services/vectoplan-chunk/wsgi.py
services/vectoplan-chunk/config.py
services/vectoplan-chunk/routes/__init__.py
services/vectoplan-chunk/routes/health.py
services/vectoplan-chunk/routes/chunks.py
```

---

## Schritt 2: Debug Chunk Generator

Erstellen:

```text
services/vectoplan-chunk/src/chunking/models.py
services/vectoplan-chunk/src/chunking/coordinates.py
services/vectoplan-chunk/src/chunking/generator.py
services/vectoplan-chunk/src/chunking/serializer.py
services/vectoplan-chunk/src/sources/debug_flat_source.py
```

Ziel:

```text
GET /chunks?chunkX=0&chunkY=0&chunkZ=0
liefert zellbasierten Chunk mit debug_grass/debug_dirt/debug_stone
```

---

## Schritt 3: Batch Endpoint

```text
POST /chunks/batch
```

Ziel:

```text
Editor kann mehrere Chunks auf einmal anfordern.
```

---

## Schritt 4: Editor Remote Source

Erstellen:

```text
frontend/src/runtime/world/sources/chunk_service_source.ts
```

Ziel:

```text
ChunkSourceKind remote
Batch Load aus vectoplan-chunk
Normalize zu RuntimeChunkContent
```

---

## Schritt 5: Bootstrap-Schalter

Editor-Bootstrap:

```text
runtime.chunks.source = remote
runtime.chunks.serviceBaseUrl = ...
runtime.chunks.batchEndpoint = ...
```

---

## Schritt 6: Debug Overlay

Editor Debug Overlay zeigt:

```text
chunk source: remote
service reachable: yes/no
batch latency
loaded chunks
failed chunks
fallback active
```

---

# 30. Wichtigste Invarianten

Für das neue System gelten:

1. Core bleibt fachliche Wahrheit.
2. Chunk-Service erzeugt Runtime-Daten.
3. Editor bleibt Interaktions- und Renderoberfläche.
4. Three.js bleibt im Editor.
5. Chunk-Service liefert keine Three.js-Objekte.
6. Koordinatensystem muss exakt zwischen Python und TypeScript übereinstimmen.
7. Zellwerte und Palette müssen exakt kompatibel sein.
8. Remote-Chunks müssen für Targeting/Sampling nutzbar bleiben.
9. Lokale Overlays bleiben für Preview/Edit sinnvoll.
10. Remote-Chunk-Ausfälle dürfen nicht die gesamte Editor-Runtime zerstören.

---

# 31. Aktueller Status in einem Satz

Der Editor besitzt bereits eine lokale Chunk-/World-Runtime mit Streaming, Loading, Registry, Meshing und Three.js-Rendering; der neue Microservice `vectoplan-chunk` sollte diese lokale Chunk-Erzeugung nicht durch einen Komplettumbau ersetzen, sondern zuerst als neue remote `ChunkSource` angebunden werden, die zellbasierte, editor-kompatible RuntimeChunkContent-Daten liefert und später aus Core-Snapshots echte Projekt-Chunks generiert.

```
```
