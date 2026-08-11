
# VECTOPLAN Editor

Der `vectoplan-editor` ist die webbasierte 3D-Authoring-Oberfläche von VECTOPLAN.

Er ist die primäre Arbeitsumgebung für Builder, Planer, Admins und technische Nutzer, die Gebäude, Bauteile und Objekte direkt im Raum bearbeiten. Der Editor ist dabei **nicht** nur eine Visualisierungsschicht, sondern die zentrale räumliche Eingabeoberfläche der Plattform.

VECTOPLAN verfolgt dabei bewusst **keinen BIM-first-Ansatz** und ist auch **kein IFC-zentriertes System**. Stattdessen entsteht eine eigene Authoring-Plattform mit einem semantischen Gebäudemodell, einem builder-zentrierten 3D-Editor, einer separaten Objektbibliothek und getrennten Import-/Export- sowie Runtime-Pfaden.

Kurz gesagt:

**Der Editor ist die räumliche Authoring-Anwendung von VECTOPLAN. Er macht strukturierte Gebäudedaten im Browser bearbeitbar, ohne selbst die fachliche Primärwahrheit zu besitzen.**

Die implementierte Earth-Geländepipeline vom Webscraper-Release bis zur begehbaren Three.js-Oberfläche ist serviceübergreifend in [`../vectoplan-chunk/docs/EARTH_DGM_PIPELINE.md`](../vectoplan-chunk/docs/EARTH_DGM_PIPELINE.md) dokumentiert. Dort stehen auch Batch-Umschlag, RLE-Dekodierung, Karten-/Sichtweitenvertrag, Spawn-Ausrichtung und die Diagnose für „Karte sichtbar, aber keine 3D-Oberfläche“.

Der aktuelle Vertrag für synchronisierte Flurstücksauswahl, das schräge
0–3-m-Grundstücksraster, Übergangs- und Sperrzellen, WorldEdit sowie die
persistente `PlaceObject`-Migration liegt in
[`docs/PARCEL_GRID_AND_WORLDEDIT.md`](docs/PARCEL_GRID_AND_WORLDEDIT.md).

---

## Aktueller Funktionsstand: Grundstücksraster und WorldEdit (2026-08-10)

- Map, 3D und 2D verwenden denselben revisionsgebundenen Flurstückszustand.
- Ausgewählte Grundstücke erhalten eine transparente Fläche und eine blaue
  Grenzlinie; das rote Raster liegt auf einer festen horizontalen Ebene.
- Die ersten drei Meter folgen in 1-m-Bändern der lokalen Grenzkante. Zwischen
  3 und 4 m führen dreieckige Übergänge in das gerade Innenraster.
- Abgeschnittene Übergangszellen werden rot markiert und sind nicht bebaubar.
- Schräge Zellen werden über ihre tatsächliche Polygonüberlappung aufgelöst und
  als `PlaceObject` mit `parcel-grid-prism.v1` persistiert.
- Bereits vorhandene Benutzerblöcke werden zunächst semantisch gerendert und im
  Leerlauf in Batches von höchstens 24 Einträgen dauerhaft migriert.
- WorldEdit enthält Selection, Paint, Sculpt, Flurstück, Grundstücksraster,
  Messwerkzeug und Copy/Cut/Paste. Die Werkzeugoptionen erscheinen nur im
  geöffneten Creative-Inventar.

Normale, nicht schräge Zellen verwenden weiterhin `SetBlock`. Der Chunk-Service
bleibt die operative Weltwahrheit; die Darstellung im Editor ist kein eigener
Persistenzspeicher.

---

## Aktueller Funktionsstand: Earth-DGM, Multiplayer und Tageslicht (2026-08-03)

Der aktive Editor unter `src/frontend/scene/scene_runtime.ts` enthält jetzt eine erste durchgängige Multiplayer- und Realistic-Rendering-Stufe:

- WebSocket-Raum pro `projectId:worldId` unter `/editor/realtime`
- Präsenz-Updates mit Position, Geschwindigkeit, Blickrichtung und Bewegungsmodus bei 12 Hz
- sichtbare prozedurale Builder-Avatare mit Namensschild, Interpolation und Lauf-/Fluganimation
- sofortige Chunk-Invalidierung bei Platzieren, Entfernen und Ersetzen; die Welt wird weiterhin ausschließlich von `vectoplan-chunk` gelesen
- physikalischer Three.js-Himmel, Sonne nach Datum/Uhrzeit und Georeferenz, ACES-Tonemapping sowie dynamische Schatten
- Editor-Regler für Tageszeit, beschleunigten Sonnenlauf und Rückkehr zur Echtzeit
- sichtbarer Multiplayer-Verbindungsstatus im Viewport

Diagnose:

```text
GET /editor/api/realtime/_status
WebSocket /editor/realtime?projectId=...&worldId=...
```

Die aktuelle Realtime-Hub-Implementierung ist absichtlich prozesslokal. Deshalb startet das Docker-Image standardmäßig mit einem Gunicorn-Prozess und mehreren Threads. Für horizontale Skalierung über mehrere Editor-Instanzen muss der Hub später durch Redis, NATS oder einen vergleichbaren Broker ersetzt werden. Autorisierung und dauerhafte Konfliktauflösung gehören weiterhin an die kanonische Command-/Event-Schicht; die Realtime-Verbindung transportiert nur ephemere Präsenz und Reload-Hinweise.

### Chunk-Streaming, Earth-Terrain und früher Projekt-Preload

Beim Öffnen einer konfigurierten Projektseite startet die App den verborgenen Editor bereits im Hintergrund. Dadurch laufen Editor-Bootstrap, Verbindung zu `vectoplan-chunk`, Inventarabruf und der erste Chunk-Batch, bevor der Nutzer in der Sidebar auf `3D` klickt. Der Wechsel nach 3D aktiviert anschließend dasselbe iframe; die Runtime wird nicht neu aufgebaut.

- Standardsichtweite: radialer Radius `7`
- vorausschauender Ring: Radius `8`
- Unload-Distanz: `9`
- Cache-Ziel: `384` Chunks
- Höhen-Sicherheitsbereich: `chunkY ± 1` im inneren Radius `2`
- sichtbare Streaming-Pakete: maximal `24` Chunks pro Anfrage
- unsichtbarer Prefetch: maximal `12` Chunks pro Anfrage
- Erstaufbau: von innen nach außen
- Bewegung: fehlender Rand in Flugrichtung zuerst
- schnelle Bewegung: veraltete Zielbereiche enden nach dem laufenden Paket

Bereits sichtbare Chunks bleiben während des Streamings erhalten; der Zielkreis ersetzt sie erst, wenn er vollständig im Cache liegt. Dadurch entstehen während schneller Bewegung keine kurzzeitigen Löcher.

Chunks bleiben die atomare Netzwerk-, Cache- und Meshing-Einheit. Es werden keine angeschnittenen Teil-Chunks übertragen. Der Editor lädt nur fehlende Chunks am neu eintretenden Kreisrand, priorisiert sie in Bewegungsrichtung und rendert jedes kleine Paket sofort. Der Radius-8-Prefetch landet nur im Cache und wird erst als Teil des Radius-7-Zielbereichs sichtbar.

Für `earth` wird die vertikale Streaming-Koordinate nach Erkennen der DGM-Oberfläche fixiert. Vertikales Fliegen oder Fallen lädt daher nicht für jede Y-Stufe erneut den gesamten horizontalen Kreis. Der Editor entpackt in Batch-Antworten zuerst den Inhalt unter `chunk`, dekodiert optional `rle-value-count.v1`, mesht nur validierte Nicht-Luft-Zellen und richtet Spieler sowie Physik auf `surfaceY + 1.05` aus. Nach dem initialen Laden werden registrierte Chunk-Keys nicht erneut angefragt.

```text
Projektseite -> verstecktes Editor-iframe -> Editor-Bootstrap -> erster Chunk-Batch
3D-Klick     -> vorhandenes iframe sichtbar schalten (kein Runtime-Neustart)
```
### Isolierte Generator-Vorschau

`vectoplan-library` verwendet den Editor jetzt direkt im VPLIB-Generator:

```text
GET /editor/test-generator
GET /editor/generator-preview   # Alias
```

Diese Route rendert genau einen Generator-Baustein in einer eigenen First-Person-Szene mit Himmel, Sonne und Schatten. Sie lädt bewusst keinen Projekt-, Chunk-, Inventar- oder Multiplayer-Kontext.

Die Parent-Seite `/create` sendet über den Vertrag `vectoplan-generator-preview.v1`:

- Family-Name, Objektart und Standardvariante
- Primitive, Außenmaße, Einheit und Editor-Raster
- Materialklasse und optionalen Farbhint
- ausgewählte GLB-, GLTF-, OBJ-, STL-, FBX- und zugehörige Texturdateien

Die Route bestätigt ihre Trennung zusätzlich per HTTP-Header:

```text
X-VECTOPLAN-Editor-Runtime-Mode: generator-preview
X-VECTOPLAN-Editor-Chunk-Service: disabled
X-VECTOPLAN-Editor-Inventory: disabled
X-VECTOPLAN-Editor-Realtime: disabled
```

### Creative- und User-Inventar

Die alte Editor-Palette ist nicht mehr die produktive Inventarquelle.

- `/editor/api/inventory` adaptiert das persistente 9-Slot-User-Inventar aus `vectoplan-library`.
- Der Button `Inventar` öffnet `/creative-inventar` aus `vectoplan-library` als Editor-Overlay.
- `debug_grass` und `debug_dirt` werden nicht mehr als Startinventar erzeugt.
- Linksklick baut ab; Rechtsklick platziert.
- Abbauen bleibt auch bei leerer Hotbar aktiv.
- Eine Slot-Auswahl wird über `/editor/api/inventory/select-slot` zurück an die Library persistiert.

Wenn der Library-Endpunkt `/api/v1/vplib/inventar_user` nicht healthy ist, liefert der Editor neun leere Slots und hält die Abbauaktion aktiv. Der Library-Service muss für echte User-Items selbst healthy sein.

## Inhalt

- [Zweck dieses Repositories](#zweck-dieses-repositories)
- [Was VECTOPLAN ist](#was-vectoplan-ist)
- [Warum es den Editor gibt](#warum-es-den-editor-gibt)
- [Die Rolle des Editors in der Gesamtarchitektur](#die-rolle-des-editors-in-der-gesamtarchitektur)
- [Was der Editor können soll](#was-der-editor-können-soll)
- [Was der Editor bewusst nicht macht](#was-der-editor-bewusst-nicht-macht)
- [Architekturgrundsätze](#architekturgrundsätze)
- [Authoring, Runtime und Austausch](#authoring-runtime-und-austausch)
- [Datenfluss im Zielbild](#datenfluss-im-zielbild)
- [Interaktionsmodell des Editors](#interaktionsmodell-des-editors)
- [Wichtige Modellideen im Hintergrund](#wichtige-modellideen-im-hintergrund)
- [Beispiele aus der Praxis](#beispiele-aus-der-praxis)
- [Technologischer Zielstack](#technologischer-zielstack)
- [Aufbau des Services](#aufbau-des-services)
- [Frontend-Struktur](#frontend-struktur)
- [Server-Rolle des Services](#server-rolle-des-services)
- [Wichtige Invarianten](#wichtige-invarianten)
- [Abgrenzung zu anderen Services](#abgrenzung-zu-anderen-services)
- [Entwicklungsreihenfolge](#entwicklungsreihenfolge)
- [Lesereihenfolge für neue Entwickler](#lesereihenfolge-für-neue-entwickler)
- [Verhältnis zu `AI.md`](#verhältnis-zu-aimd)

---

## Zweck dieses Repositories

Dieses Repository enthält den Service `vectoplan-editor`.

Sein Zweck ist es, die räumliche Bearbeitung von VECTOPLAN-Projekten im Browser bereitzustellen. Dazu gehören im Zielbild vor allem:

- 3D-Darstellung
- Navigation im Raum
- Builder-Werkzeuge
- Selektion und Platzierung
- Inventar- und Katalognutzung
- Vorschau- und Snapping-Logik
- Übergabe von Änderungen als Commands an den Core
- Visualisierung bestätigter Projektzustände

Dieses Repository ist damit die Heimat der **interaktiven Editor-Anwendung**. Es ist nicht die Heimat des kanonischen Projektmodells und nicht die Heimat von Import-/Export- oder Kostenlogik.

---

## Was VECTOPLAN ist

VECTOPLAN ist eine Plattform zur strukturierten Gebäudeerstellung, Bearbeitung und späteren Auswertung.

Die Grundidee ist:

> Gebäude sollen sich so intuitiv bearbeiten lassen wie in einem spielähnlichen 3D-Editor, gleichzeitig aber so strukturiert gespeichert werden, dass daraus belastbare technische Daten, 2D-Pläne, Mengen, Kosten und Austauschformate entstehen können.

Daraus folgen mehrere Grundentscheidungen:

- VECTOPLAN ist **nicht BIM-first**
- IFC ist **nicht** das kanonische Kernformat
- das kanonische Format ist ein **eigenes semantisches Authoring-Modell**
- der Editor ist die **primäre Eingabeoberfläche**
- Import und Export sind **Adapter-Schichten**
- Runtime-Artefakte sind **Darstellungsformen**, nicht die fachliche Wahrheit

Das Produkt ist deshalb nicht einfach ein Viewer und auch nicht einfach ein Dateikonverter.

**Das eigentliche Produkt ist das Zusammenspiel aus kanonischem Modell, Editor, Bibliothek und klar getrennten Servicegrenzen.**

---

## Warum es den Editor gibt

Viele bestehende Werkzeuge im Baukontext sind entweder:

- fachlich mächtig, aber schwer zugänglich,
- geometrisch flexibel, aber datenarm,
- oder spielerisch intuitiv, aber technisch unbrauchbar.

VECTOPLAN will diese Brüche reduzieren.

Der Editor existiert, weil räumliche Arbeit im 3D-Raum für viele Aufgaben direkter und verständlicher ist als klassische formular- oder CAD-zentrierte Eingaben. Builder, Planer und andere Nutzer sollen Objekte und Bauteile dort bearbeiten, wo sie fachlich wirken: **im Raum**.

Dabei ist der Editor bewusst an Spiel- und Builder-Logik angelehnt, etwa im Gefühl von Minecraft oder Hytale, ohne selbst ein Spiel oder ein reines Blocksystem zu werden.

Das heißt konkret:

- direkte Bewegung im Raum
- intuitive Platzierung
- schnelles Drehen, Ersetzen und Wiederholen
- Inventar-/Hotbar-Logik
- klare Snap- und Kollisionsregeln
- räumliche Bearbeitung vor Formularbedienung

---

## Die Rolle des Editors in der Gesamtarchitektur

Die Zielarchitektur von VECTOPLAN besteht in der ersten Ausbaustufe aus vier Kernbausteinen:

1. `vectoplan-core-service`
2. `vectoplan-library-service`
3. `vectoplan-editor`
4. `vectoplan-converter-service`

### `vectoplan-core-service`

Der Core ist der Owner des kanonischen Projektmodells.

Er verwaltet:

- Projekte
- Ebenen / Geschosse / Grids
- Instanzen
- Bindungen
- Revisionen
- Rollen / Rechte
- Commands und deren Validierung

### `vectoplan-library-service`

Die Bibliothek verwaltet die wiederverwendbare Objektwelt.

Dazu gehören:

- Typen
- Varianten
- Kategorien
- Herstellerdaten
- Kosten
- Texte
- Vorschauen
- Geometrie-Prototypen
- Asset-Pakete

### `vectoplan-editor`

Der Editor ist die interaktive 3D-Arbeitsoberfläche.

Er ist zuständig für:

- Darstellung
- Navigation
- Auswahl
- Platzierung
- Bearbeitung
- Werkzeuglogik
- Hotbar / Inventar
- lokale Vorschauen
- Senden von Commands
- Anzeigen bestätigter Änderungen

### `vectoplan-converter-service`

Der Converter ist die Transformations- und Artefakt-Pipeline.

Er ist zuständig für:

- `.vecto` Import/Export
- IFC Import/Export
- GLB-/gltf-/SVG-/DXF-/PDF-Ausgabe
- Runtime-Artefakte
- Compile-/Build-Pfade für die Browserdarstellung

### Wichtigster Merksatz

**Der Editor ist Eingabe- und Arbeitsoberfläche. Der Core ist die Wahrheit. Die Bibliothek liefert Typen und Assets. Der Converter liefert Artefakte und Austauschpfade.**

---

## Was der Editor können soll

Der Editor soll im Zielbild eine vollständige builder-zentrierte Authoring-Oberfläche sein.

### 1. Projekte räumlich anzeigen

Der Editor muss Projektzustände im Browser sichtbar machen und bearbeitbar darstellen können.

Dazu gehören:

- Projekt laden
- Ebenen, Bereiche und Instanzen darstellen
- Runtime-Artefakte oder Prototypen laden
- Änderungen sichtbar nachführen
- größere Szenen performant behandeln

### 2. Navigation im Raum

Der Editor soll sich räumlich direkt und verständlich anfühlen.

Dazu gehören:

- First-Person- oder vergleichbare räumliche Navigation
- Blicksteuerung
- WASD-/Tastatureingabe
- Pointer Lock
- Spawn-/Startpositionen
- klare Orientierung im Raum

### 3. Auswahl und Selektion

Nutzer müssen Objekte, Bereiche, Flächen oder Zielpunkte sicher auswählen können.

Dazu gehören:

- Hover-Zustände
- aktive Auswahl
- Hervorhebung
- Inspector-Kontext
- Zielerfassung für Werkzeuge

### 4. Platzierung und Bearbeitung

Der Editor muss Objekte und Bauteile im Raum platzieren und verändern können.

Dazu gehören perspektivisch:

- Platzieren
- Verschieben
- Drehen
- Löschen
- Ersetzen
- Mehrfachplatzierung
- Bereichswerkzeuge
- Copy/Paste
- Fill/Replace
- spätere bauteilspezifische Operationen

### 5. Inventar und Bibliotheksnutzung

Der Editor muss die Objektbibliothek räumlich benutzbar machen.

Dazu gehören:

- Kategorien
- Hotbar
- Vorschauen
- Typ- und Variantenauswahl
- Suche und Filter
- Schnellzugriffe

### 6. Vorschau-, Snap- und Regel-Feedback

Bevor eine Aktion bestätigt wird, muss der Editor dem Nutzer verständliches Feedback geben.

Dazu gehören:

- Ghost-/Preview-Objekte
- Kollisionshinweise
- Rasterbezug
- Anker-/Socket-Erkennung
- `canPlace` / `canAttach` / `blocked`
- lokale Offsets und Ausrichtung

### 7. Command-basierte Bearbeitung

Der Editor darf nicht direkt schreiben, sondern muss Änderungen als Commands formulieren.

Beispiele:

- `PlaceAsset`
- `MoveInstance`
- `DeleteInstance`
- `ChangeVariant`
- `SetProperty`
- `BindToSocket`
- `CreateWall`
- `CutOpening`

### 8. Vorbereitung für spätere Realtime-Nutzung

Langfristig soll der Editor auch kollaborative Szenarien unterstützen.

Dazu gehören später:

- Presence
- andere Nutzer im Raum
- Cursor / Blickrichtung
- Live-Patches
- Konflikthinweise
- Sitzungslogik

---

## Was der Editor bewusst nicht macht

Der Editor ist wichtig, aber bewusst begrenzt.

Er besitzt **nicht** dauerhaft:

- keine Projektwahrheit
- keine Bibliothekswahrheit
- keine Kostenlogik
- keine Exportwahrheit
- keine IFC-Kernlogik
- keine endgültige Revisionshoheit
- keine direkte Persistenzhoheit

Er darf nur temporär oder lokal halten:

- Client-Cache
- geladene Bibliotheksdaten
- geladene Runtime-Artefakte
- lokale Vorschauzustände
- lokale Undo-/Redo-Hilfen
- Selektion, Hover, Input, Kamera und Tool-Zustände

Das ist zentral für die Gesamtarchitektur:

**Der Editor ist leistungsfähig, aber kein fachlicher Monolith.**

---

## Architekturgrundsätze

Für den Editor gelten dieselben Grundprinzipien wie für die Gesamtplattform.

### 1. Nicht IFC-first

IFC ist wichtig für Austausch, aber nicht die innere Wahrheit.

### 2. Nicht GLB-first

GLB ist Geometrie- und Runtime-Artefakt, nicht semantischer Kern.

### 3. Authoring vor Renderformat

Das kanonische Modell bleibt semantisch. Runtime-Artefakte werden daraus erzeugt.

### 4. Editor bleibt Client, Core bleibt Wahrheit

Die Weboberfläche darf keine führende Datenhaltung werden.

### 5. Typen und Instanzen bleiben getrennt

Bibliotheksobjekte werden nicht unkontrolliert als Projektdaten kopiert.

### 6. Authoring, Runtime und Austausch bleiben getrennt

Der Editor arbeitet primär auf der Runtime-/Interaktionsseite und greift kontrolliert auf Authoring-Zustände zu.

### 7. Gleiche Service-Denke im ganzen System

Auch der Editor folgt der gemeinsamen Plattformidee: klare Schichten, klare Verantwortlichkeiten, keine verdeckten Abkürzungen.

---

## Authoring, Runtime und Austausch

VECTOPLAN trennt drei Ebenen.

### Authoring

Die fachliche Wahrheit.

Hier leben:

- Projekte
- Typen
- Instanzen
- Anchors / Sockets / Ports
- Regeln / Constraints
- Revisionen
- Kostenbindungen
- projektbezogene Zuordnungen

### Runtime

Die browseroptimierte Darstellungsform.

Hier leben zum Beispiel:

- Chunks
- Instancing
- GLB-Prototypen
- vorberechnete Darstellungen
- Picking-Daten
- Bounding-Informationen
- LOD-Informationen

### Austausch

Externe Formate wie:

- IFC
- GLB / glTF
- OBJ
- SVG
- DXF
- PDF

Für den Editor ist vor allem wichtig:

**Er rendert primär Runtime-Artefakte, aber arbeitet nie so, als wären diese Artefakte die eigentliche Wahrheit.**

---

## Datenfluss im Zielbild

Der zentrale Bearbeitungsablauf sieht so aus:

1. Der Editor lädt Projekt-Metadaten aus dem Core.
2. Der Editor lädt Bibliotheksdaten aus dem Library-Service.
3. Der Editor lädt Runtime-Artefakte, Chunks oder Prototypen.
4. Der Nutzer navigiert, selektiert und bearbeitet im Raum.
5. Der Editor erzeugt lokale Vorschau- und Hilfszustände.
6. Der Editor baut einen Command.
7. Der Command wird an den Core gesendet.
8. Der Core validiert, persistiert und schreibt eine Revision.
9. Der Editor erhält Patch, Snapshot oder Fehlerrückmeldung.
10. Die Runtime-Darstellung wird nachgeführt.
11. Optional werden neue Runtime-Artefakte erzeugt oder nachgeladen.

Wichtig:

**Der Editor schiebt nicht direkt Dinge in die Datenbank.**

---

## Interaktionsmodell des Editors

Der Editor soll sich eher wie ein räumlicher Bau-Editor anfühlen als wie ein schweres CAD-System.

Das bedeutet:

- der Raum ist die primäre Arbeitsfläche
- Panels und Inspector unterstützen, ersetzen aber nicht die Rauminteraktion
- Platzierung, Rotation, Vorschau und Auswahl passieren direkt im Viewport
- Hotbar, Kategorien und Werkzeuge ergänzen den Workflow
- räumliche Intuition steht im Vordergrund

### Builder-orientierte Eigenschaften

Der Editor soll im Zielbild unter anderem ermöglichen:

- First-Person-Navigation
- direkte Platzierung
- Rotation und Ausrichtung
- platzieren auf Raster oder Anker
- Mehrfachplatzierung
- Bereichsbearbeitung
- Inventar- und Kataloglogik
- Copy/Paste / Fill / Replace
- WorldEdit-ähnliche Produktivwerkzeuge

### Wichtige Einschränkung

Diese Builder-Logik darf **nicht** dazu führen, dass das Datenmodell flach oder rein blockartig wird.

Der Editor muss auch mit semantischen Bauteilen und realen Objekten umgehen können.

---

## Wichtige Modellideen im Hintergrund

Auch wenn der Editor selbst nicht der Modell-Owner ist, muss er die Grundideen des Modells respektieren.

### `Type`

Ein definierter Typ, zum Beispiel:

- Wandtyp
- Deckentyp
- Wasserhahntyp
- Tischtyp
- Wärmepumpentyp

### `Instance`

Die konkrete Verwendung eines Typs im Projekt.

### `GeometryPrototype`

Eine Geometrie-Repräsentation, etwa als GLB.

### `Anchor` / `Socket` / `Port`

Definierte Anschluss- und Bindungspunkte.

### `Revision`

Nachvollziehbare Änderungshistorie.

### `CostBinding`

Verknüpfung zur Kosten- und Mengenseite.

Der Editor muss diese Konzepte nicht fachlich besitzen, aber in seiner Bedienlogik und Darstellung sinnvoll verarbeiten.

---

## Beispiele aus der Praxis

### Beispiel 1 – Wand als semantisches Bauteil

Eine Wand ist im Editor nicht nur eine sichtbare Geometrie, sondern ein technisches Bauteil mit Typ, Eigenschaften, möglicher Planrepräsentation und Kostenbezug.

Der Editor muss diese Wand im Raum platzierbar machen, ohne sie auf ein Mesh zu reduzieren.

### Beispiel 2 – Wasserhahn mit Anschlusslogik

Ein Wasserhahn darf nicht beliebig frei im Raum schweben, sondern muss an sinnvollen Zielen andocken können.

Der Editor braucht hier:

- Zielerkennung
- kompatible Anker oder Sockets
- Snap- und Vorschau-Logik
- mögliche lokale Offsets

### Beispiel 3 – Große Objekte mit Mehrzellenbelegung

Objekte wie ein Klavier, ein Bett oder eine Luftwärmepumpe können mehrere Raster- oder Arbeitsbereiche belegen.

Sie bleiben trotzdem **eine Instanz** und müssen auch so behandelt werden.

### Beispiel 4 – Hybrid aus Raster und Semantik

Der Editor soll einen sinnvollen Grundraster für Builder-Komfort erlauben, aber trotzdem mit technisch unterschiedlichen Objekten, Größen und Regeln umgehen können.

VECTOPLAN ist deshalb kein starres Blocksystem, sondern ein **hybrides Modell aus Grid-Komfort und semantischer Objektwelt**.

---

## Technologischer Zielstack

Für den Editor ist aktuell diese Richtung vorgesehen:

### Backend-/Service-Hülle

- Python
- Flask

Warum:

- einheitlicher Plattform-Stack
- gute Lesbarkeit
- klare Service-Struktur
- einfache Integration mit den anderen Services

### Frontend / Runtime

- React
- TypeScript
- Three.js

Warum:

- webbasiert
- kontrollierbarer Render-Stack
- gut geeignet für interaktive 3D-Anwendungen
- Instancing / Chunking / Runtime-Logik realistisch umsetzbar
- guter Fit für Builder-orientierte Interaktion

### Speicher- und Backend-Kontext

- PostgreSQL für die Plattformdaten
- Object Storage für Assets, GLB-Artefakte, Exporte und Runtime-Chunks

Wichtig:

Der Editor ist eine **Frontend-Anwendung im Plattformkontext**, kein datenführender Microservice.

---

## Aufbau des Services

Der Editor-Service soll sich in die gemeinsame VECTOPLAN-Struktur einfügen.

Eine grobe Zielstruktur ist:

```text
vectoplan-editor/
  AI.md
  README.md
  Dockerfile
  entrypoint.sh
  requirements.txt
  wsgi.py
  app.py
  config.py
  extensions.py

  bootstrap/
    __init__.py
    startup.py
    health.py

  routes/
    __init__.py
    health.py
    editor.py

  editor_bootstrap/
    __init__.py
    defaults.py
    context.py
    payload.py

  templates/
    editor/
      index.html
      fallback.html

  static/
    editor/
      ...

  clients/
    __init__.py
    core_client.py
    library_client.py
    realtime_client.py

  frontend/
    src/
      main.ts
      bootstrap/
      state/
      runtime/
      render/
      input/
      camera/
      targeting/
      inventory/
      ui/
      dom/
      api/
      utils/

  tests/
    unit/
    integration/
    e2e/
````

Die genaue Struktur kann sich im Detail verändern. Die grundlegende Trennung soll aber bleiben.

---

## Frontend-Struktur

Die eigentliche Editorlogik lebt im Frontend-Bereich.

Typische Schichten sind:

### `bootstrap/`

Liest und normalisiert die Initialdaten vom Server.

### `state/`

Hält die zentrale Runtime-Wahrheit des Editors, zum Beispiel:

* Bootstrap
* Lifecycle
* Viewport
* Pointer Lock
* Input
* Kamera
* Player
* Selektion
* Targeting
* Inventory
* Presence
* Chunks / sichtbare Welt
* Render- und World-Metriken

### `runtime/`

Verkabelt und orchestriert die laufende Anwendung.

### `render/`

Renderer, Szene, Preview-Meshes, Instancing und andere Darstellungslogik.

### `input/`

Tastatur, Maus, Pointer Lock, Steuerungszustände.

### `camera/`

First-Person- oder verwandte Kameralogik.

### `targeting/`

Raycast, Zielerkennung, Platzierungskontext.

### `inventory/`

Hotbar, Kategorien, Slot-Auswahl, Objektzugriff.

### `ui/`

Topbar, Panels, Inspector, Status, Overlays.

### `api/`

Kapselt Kommunikation zu Core, Library und später Realtime-/Converter-Pfaden.

Wichtig:

**State, Render, Input, Tools, UI und Integrationen sollen klar getrennt bleiben.**

---

## Server-Rolle des Services

Die Flask-Seite des Editors hat eine klare, begrenzte Aufgabe.

Sie ist zuständig für:

* Route `/editor`
* HTML-Shell
* Template-Fallbacks
* Bootstrap-Payload
* Asset-Referenzen
* Start- und Statuskontext

Sie ist **nicht** der Ort für tiefe Editor-Fachlogik.

Der komplexe Teil des Editors lebt im Browser-Frontend und dessen Runtime-Struktur.

---

## Wichtige Invarianten

Diese Regeln sollen für den Editor dauerhaft gelten:

1. Der Editor ist die räumliche Arbeitsoberfläche, nicht die Projektwahrheit.
2. Der Core bleibt Owner des kanonischen Projektmodells.
3. Die Bibliothek bleibt Owner von Typen, Varianten und Assets.
4. Der Converter bleibt Owner von Artefakt- und Exportpfaden.
5. Der Editor hält nur lokale, geladene oder bestätigte Laufzeitstände.
6. Runtime-Geometrie ist Darstellung, nicht Ontologie.
7. Commands sind der bevorzugte Weg für Änderungen.
8. Kostenlogik gehört nicht in den Editor.
9. Der Editor darf keine Fremd-DB direkt lesen oder schreiben.
10. Performance-Optimierung darf das semantische Modell nicht verdrängen.

---

## Abgrenzung zu anderen Services

### Gegenüber dem Core

Der Editor darf nicht zum heimlichen Modell-Owner werden.

### Gegenüber der Bibliothek

Der Editor darf Bibliotheksdaten lesen, visualisieren und nutzbar machen, aber nicht fachlich besitzen.

### Gegenüber dem Converter

Der Editor nutzt Runtime-Artefakte, erzeugt aber nicht selbst die langfristige Austausch- und Artefaktwahrheit.

### Gegenüber späteren Services

* Realtime bleibt eigene Domäne
* 2D-/Drawing-Logik bleibt eigene Domäne
* Quantity-/Cost-Logik bleibt eigene Domäne

---

## Entwicklungsreihenfolge

Eine sinnvolle grobe Reihenfolge für den Editor ist:

### Phase 1 – Shell und Startfähigkeit

* Route `/editor`
* HTML-Shell
* Bootstrap-Pipeline
* Frontend-Start
* sichtbare Editor-Oberfläche

### Phase 2 – Runtime-Basis

* Renderer
* Kamera
* Input
* Pointer Lock
* Loop
* Hotbar
* Runtime-State

### Phase 3 – Einfache Interaktion

* Selektion
* Targeting
* Preview
* erste Platzierung
* erste Bearbeitungszustände

### Phase 4 – Service-Integration

* Projekt laden
* Bibliothek laden
* Commands an den Core
* bestätigte Änderungen visualisieren

### Phase 5 – Performance- und Weltlogik

* Chunking
* Instancing
* Runtime-Artefakte
* größere Szenen
* Teilupdates

### Phase 6 – Fortgeschrittene Werkzeuge

* Bereichswerkzeuge
* Replace / Fill / Multi-Select
* Variantentausch
* fachlich stärkere Werkzeuge

### Phase 7 – Realtime und Kollaboration

* Presence
* Live-Patches
* kollaborative Sitzungen

---

## Lesereihenfolge für neue Entwickler

Für einen schnellen Einstieg in dieses Repository ist diese Reihenfolge sinnvoll:

1. `AI.md`
2. `README.md`
3. `config.py`
4. `app.py`
5. `wsgi.py`
6. `routes/__init__.py`
7. `routes/editor.py`
8. `editor_bootstrap/`
9. `templates/editor/`
10. `frontend/src/main.ts`
11. `frontend/src/bootstrap/`
12. `frontend/src/runtime/`
13. `frontend/src/state/`
14. danach die jeweiligen Fachbereiche wie `input/`, `camera/`, `render/`, `inventory/`, `ui/`

Der Gedanke dahinter ist:

* zuerst Produkt- und Architekturverständnis
* dann Service-Startlogik
* dann Shell und Bootstrap
* dann Runtime
* dann Detailsysteme

---

## Verhältnis zu `AI.md`

Dieses `README.md` ist die **entwicklerfreundliche Projektübersicht** des Editors.

Es erklärt vor allem:

* warum dieses Repository existiert
* welche Rolle der Editor in VECTOPLAN hat
* wie man den Editor architektonisch verstehen soll
* welche Grenzen und Ziele gelten

Die `AI.md` ist dagegen das **präzisere Architektur- und Verantwortungsdokument**.

Faustregel:

* `README.md` = Einstieg, Überblick, Orientierung
* `AI.md` = Architekturvertrag, Zielbild, detaillierte Invarianten

---

## Kurzfassung

Der `vectoplan-editor` ist die räumliche Arbeitsoberfläche von VECTOPLAN.

Er verbindet:

* builder-zentrierte 3D-Bedienung
* semantisch orientierte Gebäudebearbeitung
* Bibliotheksnutzung
* lokale Vorschau- und Werkzeuglogik
* Command-basierte Kommunikation mit dem Core
* Performance-orientierte Runtime-Darstellung im Browser

Er ist nicht der Owner des Modells, sondern die Oberfläche, in der Nutzer strukturierte Gebäudedaten erzeugen und verändern.

**Nicht der Viewer ist das Produkt, sondern das kanonische Modell plus Editor plus klar getrennte Servicearchitektur.**

```

Ein sinnvoller nächster Schritt wäre jetzt eine zweite, etwas kürzere `README.md`-Variante im Stil einer öffentlichen GitHub-Startseite mit weniger Architekturtext und mehr „Quick Start“/„Projektstatus“.
```
