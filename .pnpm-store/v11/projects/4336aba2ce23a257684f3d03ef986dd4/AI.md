
# AI.md – VECTOPLAN Editor

<!-- services/vectoplan-editor/AI.md -->

## Status dieser Fassung

Diese Fassung beschreibt den **beabsichtigten Zielstand** des `vectoplan-editor` innerhalb der VECTOPLAN-Plattform.

Wichtig:

Diese Datei ist **kein Code-Audit** und **keine reine Bestandsaufnahme**, sondern ein **Architektur-, Verantwortungs- und Produktdokument** für den Editor.

Sie beschreibt:

- was der Editor fachlich leisten soll
- welche Rolle er in der Gesamtplattform hat
- was er bewusst **nicht** tun soll
- wie er grob aufgebaut sein soll
- welche internen Schichten und Subsysteme vorgesehen sind
- wie der Datenfluss zwischen Browser, Core, Bibliothek und späteren Zusatzservices aussieht
- welche Invarianten für den Editor dauerhaft gelten sollen

Diese Datei ergänzt eine separate **IST-Analyse** des aktuellen Umsetzungsstands.  
Die IST-Analyse erklärt, **was heute konkret vorhanden ist**.  
Diese Datei erklärt, **wofür der Editor gebaut wird und wie er im Zielbild strukturiert sein soll**.

---

## 1. Zweck des `vectoplan-editor`

Der `vectoplan-editor` ist die **primäre räumliche Arbeitsoberfläche** von VECTOPLAN.

Er ist der Ort, an dem Nutzer Gebäude, Bauteile, Objekte und Projektbereiche **direkt im 3D-Raum erstellen, verändern, prüfen und bearbeiten**.

Der Editor ist damit nicht bloß ein Viewer und nicht bloß eine Weboberfläche für Formulare, sondern ein **eigenständiges Authoring-Programm innerhalb der VECTOPLAN-Plattform**.

Sein Zweck ist:

- Projekte räumlich zugänglich zu machen
- Builder-zentrierte Eingabe zu ermöglichen
- Objekte und Bauteile direkt im Raum platzierbar und bearbeitbar zu machen
- projektbezogene Änderungen als Commands an den Core zu übergeben
- Bibliotheksobjekte in einer benutzbaren räumlichen Form verfügbar zu machen
- die spätere Ableitung von 2D, Mengen, Kosten und Austauschformaten indirekt vorzubereiten, indem strukturierte Eingaben sauber erzeugt werden

Der Editor ist damit die **operative Authoring-Oberfläche**, aber **nicht** die fachliche Primärwahrheit.

---

## 2. Executive Summary

Der `vectoplan-editor` ist am treffendsten so zu verstehen:

**Eine webbasierte 3D-Authoring-Anwendung mit spielähnlicher Builder-Bedienlogik, die Projektzustände aus dem Core lädt, Bibliotheksdaten sichtbar macht, Runtime-Artefakte rendert und bestätigte Änderungen über Commands zurück an den Core sendet.**

Die wichtigsten Architekturgrundsätze lauten:

1. Der Editor ist **Frontend und Interaktionsschicht**, nicht Daten-Owner.
2. Der Editor arbeitet **builder-zentriert**, aber nicht fachlich flach.
3. Der Editor trennt **lokale Runtime-Zustände**, **geladene Projektdaten** und **bestätigte Kernzustände**.
4. Der Editor rendert für Performance primär **Runtime-Artefakte**, nicht das rohe Gesamtmodell.
5. Der Editor darf intern **nicht** zur Projektwahrheit werden.
6. Der Editor ist so aufgebaut, dass er von einer kleinen Shell bis zu einer komplexen Echtzeit-Authoring-Anwendung wachsen kann, ohne Architekturbruch.

---

## 3. Der wichtigste Leitsatz

Der wichtigste Merksatz für den Editor lautet:

**Der Editor ist die räumliche Eingabe- und Arbeitsoberfläche von VECTOPLAN, aber nicht der Owner der Modellwahrheit.**

Noch präziser:

- Der Editor **zeigt**, **erfasst**, **orchestriert** und **visualisiert**.
- Der Core **validiert**, **versioniert** und **persistiert**.
- Die Bibliothek **liefert Typen, Varianten, Assets und Objektinformationen**.
- Der Converter **liefert oder erzeugt Runtime-Artefakte und Exportpfade**.
- Spätere Realtime-, Drawing- und Quantity-/Cost-Funktionalität kommen aus eigenen Schichten oder Services.

---

## 4. Was der Editor architektonisch ist – und was nicht

## 4.1 Was der Editor klar ist

1. Eine webbasierte 3D-Authoring-Anwendung
2. Eine Builder-zentrierte räumliche Eingabeoberfläche
3. Eine Laufzeitumgebung für Navigation, Selektion, Platzierung und Bearbeitung
4. Eine Integrationsschicht zwischen Projektmodell, Bibliothek und Runtime-Artefakten
5. Eine UI für projektbezogene Commands
6. Eine Runtime mit klar getrennten Zuständen für Input, Kamera, Selektion, Targeting, Inventory, Chunks, Presence und Rendering
7. Eine Anwendung, die bewusst in Richtung Minecraft-/Hytale-artiger Bedienlogik denkt, ohne zum reinen Blockspiel zu werden

## 4.2 Was der Editor klar nicht ist

1. Kein Owner des kanonischen Projektmodells
2. Kein direkter Datenbankschreiber
3. Kein BIM-Kern
4. Kein IFC-Interpretationszentrum
5. Kein Exportservice
6. Kein Ort für Kosten- oder Ausschreibungslogik
7. Kein reiner Viewer
8. Kein reines Mesh-Frontend ohne Semantikbezug
9. Kein Monolith, der Bibliothek, Core, Realtime und Converter fachlich verschluckt

---

## 5. Die Rolle des Editors in der Gesamtplattform

Im Zielbild arbeiten die Kernbausteine so zusammen:

- `vectoplan-core-service` besitzt das kanonische Projektmodell
- `vectoplan-library-service` besitzt Typen, Varianten, Herstellerdaten, Assets und kaufmännische Objektinformationen
- `vectoplan-converter-service` erzeugt oder transformiert Runtime- und Austausch-Artefakte
- `vectoplan-editor` stellt die interaktive Bearbeitungsschicht bereit

Der Editor sitzt also **zwischen Nutzer und Plattformlogik**.

Typischerweise tut er Folgendes:

1. Projektkontext laden
2. Bibliotheksdaten laden
3. Runtime-Artefakte oder Prototypen laden
4. räumliche Interaktion ermöglichen
5. lokale Vorschau- und Hilfszustände halten
6. Commands an den Core senden
7. bestätigte Patches/Snapshots wieder anzeigen
8. optional Presence-/Realtime-Daten anzeigen
9. Nutzerzustände, Selektion, Zielobjekte und laufende Werkzeuge verwalten

---

## 6. Der Editor ist builder-zentriert, aber nicht fachlich flach

VECTOPLAN ist kein klassisches CAD-first-System.  
Der Editor soll sich deshalb **deutlich direkter, räumlicher und zugänglicher** anfühlen als traditionelle Bau- oder BIM-Werkzeuge.

Das bedeutet ausdrücklich:

- freie Bewegung im Raum
- direkte Platzierung
- schnelles Drehen, Ersetzen, Spiegeln und Kopieren
- Inventar- und Kataloglogik
- Hotbar-/Schnellzugriff
- sichtbare Preview vor Platzierung
- WorldEdit-ähnliche oder Bereichswerkzeuge
- sofort verständliche räumliche Bedienung

Gleichzeitig darf der Editor intern **nicht** so modelliert werden, als sei alles nur ein gleichförmiger Block.

Er muss ein **hybrides Modell** unterstützen:

- Grid- und Builder-Logik für schnelle Interaktion
- semantische Bauteile für konstruktive Elemente
- Bibliotheksobjekte und Prefabs für wiederverwendbare Objektdefinitionen
- Anchors, Sockets und Ports für definierte Bindungen
- Constraints und Regeln für gültige Platzierung

Kurz:

**Die Bedienung darf spielnah sein, das Datenmodell dahinter nicht.**

---

## 7. Was der Editor fachlich können soll

Die fachlichen Fähigkeiten des Editors lassen sich in mehrere Hauptbereiche gliedern.

## 7.1 Projekt räumlich laden und darstellen

Der Editor muss Projekte im Browser als bearbeitbare räumliche Szene darstellen können.

Dazu gehört:

- Laden eines Projektkontexts
- Laden von Runtime- oder Vorschauartefakten
- Sichtbarmachen von Ebenen, Teilbereichen, Instanzen und Arbeitskontexten
- Umschalten zwischen sinnvollen Sichtkontexten
- Anzeigen von Projektdaten, die für räumliche Bearbeitung relevant sind

Wichtig:

Der Editor rendert bevorzugt **browseroptimierte Darstellungen**, nicht zwingend das gesamte rohe Authoring-Modell.

## 7.2 Navigation im Raum

Der Editor muss räumliche Bewegung sehr direkt ermöglichen.

Dazu gehören typischerweise:

- First-Person- oder nah verwandte freie Navigation
- Mauslook / Blicksteuerung
- WASD-/Tastaturbewegung
- Sprint, Zoom oder andere kontextabhängige Bewegungshilfen
- klarer Pointer-Lock-Flow
- definierter Spawn- oder Einstiegspunkt
- gute Orientierung im Raum

Navigation ist kein Nebenfeature, sondern Kern des Nutzungskonzepts.

## 7.3 Selektion und Fokus

Der Editor muss Instanzen, Bereiche, Anker, Flächen oder Platzierungsziele selektieren können.

Dazu gehören:

- einfache Einzel-Selektion
- Hover-/Targeting-Zustände
- sichtbare Hervorhebung
- Kontextanzeige im Inspector
- Wechsel zwischen Zielobjekt und aktiver Auswahl
- spätere Mehrfachselektion und Bereichsauswahl

## 7.4 Platzierung

Der Editor muss Typen, Objekte oder Bauteile räumlich platzieren können.

Dazu gehören:

- Platzierung aus Inventar / Katalog / Hotbar
- Ghost-/Preview-Darstellung vor Bestätigung
- Platzierung auf Raster, Flächen, Ankern oder Sockets
- Platzierung mit Rotation und lokaler Ausrichtung
- Platzierung größerer Objekte, die mehrere Rasterbereiche belegen
- spätere Serienplatzierung, Copy/Paste, Replace und Bereichswerkzeuge

## 7.5 Bearbeitung bestehender Instanzen

Der Editor muss bestehende Objekte verändern können.

Dazu gehören:

- Verschieben
- Drehen
- Löschen
- Variantentausch
- Property-Änderung
- Bindung an Anchor / Socket / Port
- spätere semantische Operationen wie Split, Join, Öffnung setzen oder Profil ändern

## 7.6 Inspector- und Kontextbearbeitung

Der Editor muss einen räumlichen und einen fachlichen Blick kombinieren.

Dazu gehören:

- Anzeige der aktuell selektierten Instanz
- Sichtbarkeit der zugehörigen Typ- und Variantendaten
- Anzeige platzierungsrelevanter Eigenschaften
- Anzeige von Constraints, Konflikten und Gültigkeitsstatus
- Bearbeitung freigegebener Eigenschaften
- Kontextinformationen zu Projekt, Ebene, Bereich und Typ

## 7.7 Inventory- und Bibliotheksnutzung

Der Editor muss Bibliotheksobjekte für Builder nutzbar machen.

Dazu gehören:

- Kategorien
- Suche
- Filter
- Favoriten oder Schnellzugriff
- Hotbar
- Vorschau
- Variantenwechsel
- Anzeige von relevanten Objektinfos für die Platzierung

Wichtig:

Die Bibliotheksdaten kommen aus dem `vectoplan-library-service`.  
Der Editor darf sie **lesen, cachen und visualisieren**, aber nicht fachlich besitzen.

## 7.8 Regel- und Platzierungsfeedback

Der Editor soll dem Nutzer vor und während einer Aktion zeigen, ob eine Platzierung oder Bearbeitung sinnvoll und gültig ist.

Dazu gehören:

- Kollisionsfeedback
- Snap-Hinweise
- Zielanker
- erlaubte / nicht erlaubte Positionen
- Mindestabstände
- lokale Offsets
- Konflikthinweise
- Vorschau von Bindungen

Die endgültige fachliche Validierung bleibt beim Core.  
Der Editor darf aber **frühes Nutzungsfeedback** liefern.

## 7.9 Undo/Redo-orientiertes Arbeiten

Der Editor muss mit einem Revisions- und Command-Modell kompatibel sein.

Das bedeutet:

- Aktionen werden als Commands aufgebaut
- der Editor kann lokale Undo-/Redo-Hilfszustände halten
- die bestätigte Wahrheit kommt aus Core-Reaktionen
- der Editor darf lokale Eingaben oder Previews puffern
- der Editor darf aber nicht den Revisions-Owner spielen

## 7.10 Realtime- und Presence-Fähigkeit

Später soll der Editor mehrbenutzerfähig werden.

Dazu gehören perspektivisch:

- Presence
- andere Nutzer im Raum
- Cursor / Blickrichtung / aktiver Bereich
- Kollisions- und Konflikthinweise
- Live-Patches
- Sperren oder weiche Konfliktmodelle

Diese Funktionalität gehört später typischerweise an oder hinter einen `vectoplan-realtime-service`.  
Der Editor zeigt und integriert sie, besitzt sie aber nicht dauerhaft.

---

## 8. Was der Editor explizit nicht leisten soll

Der Editor darf nicht mit Aufgaben überladen werden, die in andere Services oder Schichten gehören.

Er soll **nicht** dauerhaft besitzen oder leisten:

- Projektpersistenz als Primärquelle
- direkte DB-Schreibvorgänge
- Bibliothekswahrheit
- Exportlogik
- IFC-Logik als Kernmodell
- Kostenlogik
- Ausschreibungslogik
- finale Mengenberechnung
- 2D-Planableitung als fachlicher Kern
- alleinige Versionierungshoheit
- direkte Fremd-DB-Zugriffe

Der Editor ist damit ein **mächtiges Frontend**, aber **kein fachlicher Monolith**.

---

## 9. Der wichtigste Daten- und Verantwortungsgrundsatz

Für den Editor gilt dauerhaft diese Invariante:

**Lokale Interaktion ist nicht gleich fachliche Wahrheit.**

Der Editor hat mehrere Arten von Zustand:

### 9.1 Ephemerer UI- und Runtime-Zustand

Zum Beispiel:

- Mausstatus
- Pointer-Lock-Zustand
- aktive Tools
- Hover/Targeting
- lokale Previews
- Ghost-Objekte
- offene Panels
- lokale Selektion
- Debug-Overlays

Diese Zustände sind rein editorseitig.

### 9.2 Gecachte Integrationszustände

Zum Beispiel:

- geladene Bibliothekskategorien
- geladene Typ- oder Variantendaten
- geladene Runtime-Chunks
- Presence-Daten
- geladene Vorschau-Assets

Diese Daten stammen aus anderen Systemen und werden editorseitig nur gehalten oder gespiegelt.

### 9.3 Bestätigte projektbezogene Zustände

Zum Beispiel:

- bestätigte Instanzänderungen
- bestätigte Platzierungen
- bestätigte Property-Änderungen
- bestätigte Bindungen

Diese Zustände kommen aus Antworten, Snapshots oder Patches des Core.

---

## 10. Die zentrale Editor-Idee: Authoring im Raum

Der Editor soll nicht primär formulargesteuert sein, sondern **räumlich gesteuert**.

Das bedeutet:

- Aktionen beginnen meist im Viewport
- UI-Panels unterstützen die Aktion, ersetzen sie aber nicht
- Platzierung, Rotation, Snap und Vorschau passieren direkt im Raum
- Eigenschaften und Details erscheinen kontextabhängig
- der Raum ist die primäre Arbeitsfläche, nicht die Seitenleiste

Deshalb ist der Editor nicht einfach „ein Webformular mit 3D-Fenster“, sondern eine **3D-Anwendung mit flankierenden UI-Schichten**.

---

## 11. Grober End-to-End-Ablauf

Ein typischer Ablauf im Zielbild sieht so aus:

1. Browser ruft `/editor` auf
2. Flask liefert Editor-Shell, Bootstrap-Daten und Asset-Referenzen
3. Frontend bootet
4. Bootstrap wird gelesen und normalisiert
5. Scene-Runtime, State-Store und UI-Controller werden initialisiert
6. Projektkontext, Bibliotheksdaten und Runtime-Artefakte werden geladen
7. Nutzer navigiert und selektiert
8. Nutzer wählt Tool oder Objekt
9. Editor erzeugt Preview und Platzierungslogik
10. Nutzer bestätigt Aktion
11. Editor baut Command
12. Command geht an `vectoplan-core-service`
13. Core validiert, persistiert und schreibt Revision
14. Core liefert bestätigten Patch / Snapshot / Fehler zurück
15. Editor aktualisiert seine Runtime-Zustände und Darstellung
16. optional werden Runtime-Artefakte oder Presence-Zustände nachgeführt

---

## 12. Architektur-Leitbild des Editors

Der Editor soll intern in klar getrennte Schichten aufgeteilt sein.

## 12.1 Serverseitige Shell-Schicht

Diese Schicht gehört zum Flask-Service und ist zuständig für:

- Route `/editor`
- Rendern der HTML-Shell
- Auslieferung von Bootstrap-Daten
- Auslieferung oder Verlinkung von Assets
- Fallback-Verhalten
- minimale serverseitige Konfiguration für den Browserstart

Wichtig:

Die Serverseite des Editors ist **nicht** der Ort für die komplexe Editor-Fachlogik.  
Sie ist primär **Liefer- und Bootstrap-Schicht**.

## 12.2 Template-/HTML-Shell-Schicht

Diese Schicht liefert die Grundstruktur des Editors.

Typische Bestandteile:

- Root-Container
- Viewport
- Hotbar
- Overlays
- Pointer-Lock-Hinweise
- Statusanzeige
- Panels
- Bootstrap-Script-Tag
- Root-Dataset

Sie soll robust und fehlertolerant sein.

## 12.3 Browser-Bootstrap-Schicht

Diese Schicht liest und normalisiert die initialen Datenquellen.

Typische Quellen:

- eingebettetes Bootstrap-JSON
- Window-Export
- Dataset-Werte
- Browser-Defaults

Ziel ist:

- stabile initiale Runtime-Konfiguration
- klar typisierte Strukturen
- definierte Merge-Reihenfolge
- kontrollierter Startpunkt für die Scene-Runtime

## 12.4 Runtime-Orchestrierung

Diese Schicht ist der zentrale Laufzeit-Orchestrator des Editors.

Sie verkabelt:

- Runtime-State-Store
- DOM-/Shell-Bindings
- Input-Controller
- Pointer-Lock-Controller
- Kamera- bzw. First-Person-Controller
- Tool-Controller
- Inventory-/Hotbar-Controller
- Renderer
- Loop
- World-/Chunk-Schicht
- Presence-/Realtime-Anbindung
- API- und Client-Anbindungen

Sie enthält möglichst **keine tiefe Fachlogik einzelner Teilbereiche**, sondern deren Verkabelung.

## 12.5 State-Schicht

Der Editor braucht eine zentrale Runtime-State-Schicht.

Diese hält typischerweise:

- Bootstrap
- Shell-/UI-Zustände
- Viewport-Größe
- Pointer Lock
- Input
- Kamera
- Player/Navigation
- Selektion
- Targeting
- Tools
- Inventory
- Chunks / sichtbarer Weltkontext
- Presence
- Render-Metriken
- World-Metriken
- Fehler- und Lifecycle-Zustände
- Pending Commands / lokale Previews

Die State-Schicht ist die **gemeinsame Laufzeitwahrheit des Editors**, aber nicht die fachliche Wahrheit des Projekts.

## 12.6 World-/Chunk-Schicht

Da der Editor browserbasiert performant bleiben muss, braucht er eine klar getrennte Schicht für Welt- und Darstellungslogik.

Sie ist zuständig für:

- Chunk-Verwaltung
- Sichtbereichslogik
- Laden/Entladen
- Instancing
- LOD-nahe Entscheidungen
- Zuordnung geladener Artefakte zum sichtbaren Raum
- lokale Welt-Hilfsrepräsentationen
- Zielerfassung und Platzierungskontext

Wichtig:

Die World-/Chunk-Schicht ist eine **Runtime-Schicht**, nicht das kanonische Modell.

## 12.7 Tool-Schicht

Werkzeuge sollen als eigene Domäne im Frontend organisiert werden.

Dazu gehören perspektivisch:

- Place Tool
- Remove Tool
- Select Tool
- Move Tool
- Rotate Tool
- Replace Tool
- Area Tool
- Paint-/Material-/Profile-Tools
- spätere Spezialtools für Öffnungen, Installationen oder Bereichsaktionen

Die Tool-Schicht soll klar von Rendering, State und HTTP-Clients getrennt sein.

## 12.8 Render-Schicht

Die Render-Schicht ist zuständig für:

- Renderer
- Kameraanbindung
- Scene-Graph
- Lichter
- Preview-/Ghost-Darstellung
- Instancing
- Overlays im 3D-Raum
- ggf. Debug-Geometrie
- Performance-nahe Darstellung

Empfohlen ist hier eine klare Trennung zwischen:

- Render-Infrastruktur
- Welt-/Szenendaten
- UI-Overlay
- Tool-Preview

## 12.9 UI-Schicht

Die UI-Schicht enthält die editornahen Oberflächenelemente.

Typische Bereiche:

- Topbar
- Hotbar
- linke Bibliotheks-/Werkzeugspalte
- rechter Inspector
- Statusleisten
- Debug-Overlay
- Tooltips
- Modals
- Notifications

Die UI ist Hilfsschicht des räumlichen Workflows, nicht sein Ersatz.

## 12.10 Client-/Integrationsschicht

Die Kommunikation zu anderen Services muss gekapselt bleiben.

Typische Frontend- oder Service-Clients:

- Core-Client
- Library-Client
- Converter-/Artifact-Client
- Realtime-Client

Diese Schicht kapselt:

- Requests
- Response-Normalisierung
- Fehlerabbildung
- Retry- oder Timeout-Strategien
- Mapping in editorinterne Datenformen

---

## 13. Empfohlene Zielstruktur des Services

Die endgültige Struktur kann je nach Reifegrad variieren, sollte aber grob in diese Richtung gehen:

```text
services/
└── vectoplan-editor/
    ├── AI.md
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
    │   └── editor.py
    │
    ├── editor_bootstrap/
    │   ├── __init__.py
    │   ├── defaults.py
    │   ├── context.py
    │   └── payload.py
    │
    ├── templates/
    │   └── editor/
    │       ├── index.html
    │       └── fallback.html
    │
    ├── static/
    │   └── editor/
    │       └── ...
    │
    ├── clients/
    │   ├── __init__.py
    │   ├── core_client.py
    │   ├── library_client.py
    │   └── realtime_client.py
    │
    ├── frontend/
    │   └── src/
    │       ├── main.ts
    │       ├── bootstrap/
    │       ├── state/
    │       ├── runtime/
    │       │   ├── loop.ts
    │       │   ├── scene/
    │       │   ├── world/
    │       │   ├── tools/
    │       │   └── presence/
    │       ├── render/
    │       ├── input/
    │       ├── camera/
    │       ├── targeting/
    │       ├── inventory/
    │       ├── ui/
    │       ├── dom/
    │       ├── api/
    │       └── utils/
    │
    └── tests/
        ├── unit/
        ├── integration/
        └── e2e/
````

Wichtig ist nicht jeder einzelne Ordnername, sondern die Invariante:

**Shell, Bootstrap, Runtime, State, Render, Tools, UI und Integrationen bleiben getrennt.**

---

## 14. Die UI-Grundform des Editors

Der Editor sollte dauerhaft eine klare räumliche Arbeitsoberfläche besitzen.

Eine sinnvolle Grundform ist:

* **Topbar** für Projektkontext, Status, Modi, allgemeine Aktionen
* **linkes Panel** für Bibliothek, Kategorien, Werkzeuge, Suche
* **zentraler Viewport** als primäre Arbeitsfläche
* **rechtes Panel** für Inspector, Eigenschaften, Validierung, Objektinfos
* **untere Hotbar** für Schnellzugriff
* **Overlay-Schichten** für Crosshair, Tipps, Debug, Status, Notifications

Diese Form ist nicht nur UI-Design, sondern unterstützt die Arbeitslogik:

* Mitte = Raum
* links = Auswahl / Werkzeuge
* rechts = Details
* unten = Schnellzugriff
* oben = globaler Kontext

---

## 15. Kernsubsysteme des Editors

## 15.1 Shell-System

Das Shell-System bindet DOM-Elemente, Statusanzeigen und Basis-UI an die Runtime an.

## 15.2 Input-System

Das Input-System verarbeitet:

* Tastatur
* Maus
* Pointer Lock
* Scroll
* Tool-spezifische Eingaben
* Hotbar-Shortcuts
* mögliche künftige Mehrfachbelegungen und Modifizierer

## 15.3 Kamera-/Bewegungssystem

Dieses System ist zuständig für:

* Blickrichtung
* Position
* First-Person-Steuerung
* Kollisionsnahe Bewegung
* Flug- oder Debug-Modi
* Spawn/Reset
* spätere bewegungsbezogene Regeln

## 15.4 Targeting-System

Dieses System erkennt, worauf der Nutzer gerade zeigt oder woran er andocken kann.

Dazu gehören:

* Raycasts
* Zielobjekt
* Zielblock / Zielzelle / Zielanker
* Flächenbezug
* lokale Normalen und Offsets
* `canPlace` / `canAttach` / `canBreak` / `blockedBy`

## 15.5 Tool-System

Werkzeuge bilden die aktive Bearbeitungslogik.

Ein Tool kann typischerweise:

* Eingaben interpretieren
* Preview erzeugen
* Zielkontext lesen
* einen Command vorbereiten
* UI-Hinweise liefern
* lokale Vorvalidierung durchführen

## 15.6 Inventory-/Hotbar-System

Dieses System verwaltet:

* aktive Slots
* Selektionswechsel
* Schnellzugriffe
* Item-/Typ-Referenzen
* ggf. Favoriten oder zuletzt genutzte Objekte

## 15.7 World-/Chunk-System

Dieses System organisiert die sichtbare und interaktive Raumrepräsentation.

## 15.8 Render-System

Dieses System übersetzt Runtime-Daten in Szenegraph, Meshes, Instanzen und Overlays.

## 15.9 Presence-System

Dieses System verarbeitet später andere Nutzer, Sichtbarkeit und kollaborative Laufzeitinformationen.

## 15.10 API-/Sync-System

Dieses System überträgt Commands, lädt Daten und verarbeitet Bestätigungen oder Fehler.

---

## 16. Der Editor und das Command-Modell

Der Editor soll nicht „einfach Daten schreiben“, sondern **Commands formulieren**.

Beispiele:

* `PlaceInstance`
* `MoveInstance`
* `RotateInstance`
* `DeleteInstance`
* `ChangeVariant`
* `BindToSocket`
* `SetProperty`
* `CreateWall`
* `UpdateWallProfile`
* `CutOpening`
* `ReplaceInstances`

Der Ablauf ist grundsätzlich:

1. Nutzeraktion im Editor
2. lokale Ziel- und Preview-Logik
3. Command-Erzeugung
4. Übergabe an Core
5. Core-Validierung
6. Persistenz und Revision
7. bestätigter Patch oder Fehler zurück
8. Editor synchronisiert Darstellung

Damit bleibt die Revisions- und Wahrheitslogik beim Core.

---

## 17. Platzierungslogik: Grid, Anchor, Socket und Semantik

Der Editor braucht eine Platzierungslogik, die mehrere Fälle unterstützt.

## 17.1 Rasterbasierte Platzierung

Für schnelle Builder-Interaktion braucht der Editor eine klare Raster- oder Zelllogik.

Das ist besonders hilfreich für:

* erste Baukörper
* einfache Objekte
* schnelle Serieneingaben
* Bereichswerkzeuge

## 17.2 Flächen- und Kantenbezug

Viele Objekte werden an Flächen, Kanten oder konstruktive Bereiche gebunden.

## 17.3 Anchor-/Socket-/Port-basierte Platzierung

Fachliche Objekte wie Armaturen, Installationen oder definierte Bauteilanschlüsse brauchen mehr als nur ein Raster.

Hier muss der Editor unterstützen:

* kompatible Zielstellen erkennen
* Bindungsregeln visualisieren
* lokale Offsets erlauben
* ungültige Ziele abweisen oder warnen

## 17.4 Große Objekte und Mehrzellenbelegung

Objekte dürfen mehrere Zellen oder Bereiche belegen und trotzdem als eine Instanz behandelt werden.

Zum Beispiel:

* Wärmepumpe
* Küchenblock
* Bett
* Schaltschrank
* Möblierung
* technische Anlagen

Der Editor muss solche Platzierungen sichtbar, verständlich und prüfbar machen.

---

## 18. Verhältnis zur Objektbibliothek

Der Editor braucht eine enge, aber fachlich saubere Beziehung zur Bibliothek.

Der Editor soll aus der Bibliothek lesen:

* Kategorien
* Library Items
* Varianten
* Herstellerdaten
* Vorschau-Assets
* Geometrie-Prototypen
* Kostenhinweise
* Texte und Metadaten
* Regeln, soweit sie für Auswahl oder Vorschau nötig sind

Der Editor besitzt diese Daten aber nicht dauerhaft als Primärquelle.

Er speichert bei der Bearbeitung typischerweise nur die projektrelevanten Referenzen oder abgeleiteten Zustände, die der Core bestätigt.

Wichtig:

**Bibliotheksnutzung im Editor ist Konsum und Visualisierung, nicht Eigentum.**

---

## 19. Verhältnis zum Core

Die Beziehung zum Core ist für den Editor zentral.

Der Editor bekommt vom Core typischerweise:

* Projektmetadaten
* Ebenen / Geschosse / Grids
* bestätigte Instanzdaten oder Snapshots
* Patch-Antworten
* Berechtigungsinformationen
* projektbezogene Bindungen
* Fehler und Validierungsrückmeldungen

Der Editor sendet an den Core typischerweise:

* Commands
* Bearbeitungsabsichten
* Property-Änderungen
* Platzierungs- und Bindungswünsche
* ggf. Selektions- oder Lock-bezogene Koordinationsdaten in späteren Echtzeitszenarien

Wichtig:

Der Editor darf **nie** direkt die Datenbank des Core schreiben oder lesen.

---

## 20. Verhältnis zum Converter und zu Runtime-Artefakten

Der Editor braucht für gute Browser-Performance Runtime-Artefakte.

Diese können z. B. sein:

* vorberechnete Chunk-Modelle
* Instancing-Daten
* GLB-Prototypen
* Preview-Geometrien
* Picking-Indizes
* Bounding-Informationen

Diese Artefakte kommen nicht aus dem Editor als dauerhafte Wahrheit, sondern aus einem Build-/Compile-/Converter-Pfad oder aus Objekt-Storage.

Der Editor soll diese Artefakte effizient laden und darstellen.

Wichtig:

**Der Editor bearbeitet nicht das GLB als Wahrheit, sondern nutzt Runtime-Geometrie als Darstellungsgrundlage für semantisch kontrollierte Bearbeitung.**

---

## 21. Verhältnis zu Realtime und Presence

Spätere Zusammenarbeit erfordert Realtime-Funktionalität.

Im Zielbild soll der Editor damit umgehen können:

* Presence anderer Nutzer
* Raum-/Sitzungskontext
* Cursor, Blickrichtung, aktive Auswahl
* Live-Patches
* Konflikthinweise
* ggf. Bereichs- oder Objektlocks

Die Realtime-Logik soll aber nicht unkontrolliert in die restliche Editor-Architektur einsickern.

Empfohlen ist:

* dedizierte Presence-/Realtime-Schicht
* klare Trennung zwischen Realtime-Transport und normalem Runtime-State
* klare Trennung zwischen lokaler Interaktion und fremden Zuständen

---

## 22. Performance-Grundsätze

Da der Editor webbasiert sein muss, gelten strenge Performance-Regeln.

## 22.1 Runtime statt Rohmodell

Der Editor rendert bevorzugt Runtime-Artefakte, nicht ungefiltert das rohe Gesamtmodell.

## 22.2 Chunking und Streaming

Die Welt muss in sinnvolle Ladeeinheiten zerlegt werden.

## 22.3 Instancing und Wiederverwendung

Wiederkehrende Objekte und Prototypen sollen effizient dargestellt werden.

## 22.4 Teilupdates statt Full Reload

Bestätigte Änderungen sollen möglichst patch-basiert oder lokal aktualisierbar sein.

## 22.5 Klare Trennung von Render- und Fachzustand

Renderfreundliche Strukturen dürfen existieren, aber nicht die semantische Wahrheit ersetzen.

## 22.6 Debugbarkeit

Performance-Probleme müssen sichtbar gemacht werden können, etwa über Debug-Overlay, Metriken und einfache Diagnosezustände.

---

## 23. Robustheit und Fallbacks

Der Editor soll bereits früh robust aufgebaut sein.

Dazu gehören:

* fallbackfähige Templates
* robuster Bootstrap-Flow
* definierte Fehlerzustände
* No-Cache- oder sinnvolle Cache-Regeln für kritische Shell-Ressourcen
* Statusanzeigen während des Starts
* klare Darstellung bei fehlenden Assets oder fehlerhaften Payloads
* möglichst sauberes Stop-/Restart-/Destroy-Verhalten der Runtime

Ziel ist:

Auch in frühen Entwicklungsphasen soll der Editor **sichtbar und stabil startbar** sein.

---

## 24. Sicherheit und Berechtigungen

Der Editor darf keine fachliche Autorität an der Berechtigungslogik vorbei aufbauen.

Das bedeutet:

* sichtbare oder bedienbare Aktionen können vom Editor vorbereitet werden
* die endgültige Berechtigungsprüfung liegt beim Core
* UI kann Berechtigungen spiegeln oder einschränken
* der Editor selbst darf aber nicht als alleinige Permission-Quelle behandelt werden

---

## 25. Teststrategie

Der Editor braucht mehrere Testebenen.

## 25.1 Serverseitige Integrationstests

Zum Beispiel:

* `/editor` liefert erfolgreich HTML
* Bootstrap ist eingebettet
* Fallback-Template ist funktionsfähig
* Assets werden korrekt referenziert

## 25.2 Frontend-Unit-Tests

Zum Beispiel:

* Bootstrap-Normalisierung
* State-Factories
* Targeting-Helfer
* Tool-Helfer
* pure Runtime-Model-Helfer

## 25.3 Runtime-/Integrationstests

Zum Beispiel:

* Runtime startet sauber
* Pointer Lock wechselt korrekt
* Hotbar-Selektion wird korrekt synchronisiert
* Commands werden korrekt vorbereitet
* Renderer und Loop reagieren auf Resize und Lifecycle

## 25.4 E2E-Tests

Später:

* Seite öffnen
* Runtime startet
* Bewegung funktioniert
* Auswahl funktioniert
* Platzierungsvorschau erscheint
* bestätigte Änderungen werden sichtbar

---

## 26. Empfohlene Entwicklungsreihenfolge

Der Editor sollte schrittweise wachsen.

## Phase 1 – Shell und Startfähigkeit

* Flask-Route
* HTML-Shell
* Bootstrap-Mechanismus
* Frontend-Start
* minimaler Viewport

## Phase 2 – Runtime-Basis

* Renderer
* Kamera
* Input
* Pointer Lock
* Loop
* Hotbar-Grundstruktur
* zentraler State

## Phase 3 – einfache Welt- und Zielerfassung

* Targeting
* einfache Platzierung
* einfache Selektion
* lokale Previews
* erste Chunk-/Welt-Hilfsstruktur

## Phase 4 – Core- und Library-Integration

* Projekt laden
* Bibliotheksdaten laden
* Commands senden
* bestätigte Änderungen verarbeiten

## Phase 5 – echte Runtime-Welt

* Chunk-Management
* Instancing
* größere Szenen
* Performancepfade

## Phase 6 – fortgeschrittene Tools

* Bereichswerkzeuge
* Replace
* Multi-Select
* Variantenwechsel
* spezialisierte Objekt- und Bauteilaktionen

## Phase 7 – Realtime und Kollaboration

* Presence
* Live-Patches
* kollaborative Konfliktbehandlung

---

## 27. Wichtigste Invarianten des Editors

Diese Regeln sollten dauerhaft gelten:

1. Der Editor schreibt keine Projektwahrheit direkt.
2. Der Core bleibt der Owner bestätigter Modellzustände.
3. Die Bibliothek bleibt der Owner von Typen, Varianten und Objektinformationen.
4. Der Converter bleibt der Owner von Artefakt- und Exportpfaden.
5. Der Editor hält lokale Runtime-Zustände, aber keine fachliche Primärwahrheit.
6. UI, Runtime, State, Render, Tools und Clients bleiben getrennt.
7. Spielnahe Bedienlogik darf nicht zu fachlich flachen Datenstrukturen führen.
8. Runtime-Geometrie ist Darstellung, nicht Ontologie.
9. Performanceoptimierung darf das semantische Modell nicht verdrängen.
10. Jede größere Nutzeraktion soll letztlich in ein Command-Modell passen.

---

## 28. Prägnantes Gesamtbild

Der belastbare Gesamtbefund für den Editor lautet:

**Der `vectoplan-editor` ist eine webbasierte, builder-zentrierte 3D-Authoring-Anwendung, die räumliche Bearbeitung, Bibliotheksnutzung, Platzierungslogik und Runtime-Darstellung zusammenführt, ohne selbst die fachliche Projektwahrheit zu besitzen.**

Besonders wichtig ist:

* Der Editor ist die primäre Eingabeoberfläche.
* Der Editor ist nicht der Daten-Owner.
* Der Editor arbeitet räumlich und spielnah, aber auf Grundlage semantischer Modelllogik.
* Der Editor nutzt Runtime-Artefakte für Performance.
* Der Editor wächst von einer stabilen Shell zu einer komplexen Authoring-Runtime.
* Der Editor muss klar modularisiert bleiben.

---

## 29. Kurzfassung für Reviewer

* `vectoplan-editor` ist die primäre räumliche Arbeitsoberfläche von VECTOPLAN.
* Er ist kein reiner Viewer und kein Owner der Projektwahrheit.
* Er soll sich builder-zentriert und spielnah anfühlen, ohne fachlich flach zu werden.
* Er lädt Projektkontext, Bibliotheksdaten und Runtime-Artefakte.
* Er ermöglicht Navigation, Selektion, Platzierung, Bearbeitung und Kontextprüfung.
* Er sendet Commands an den Core statt selbst führend zu persistieren.
* Er unterstützt Grid-, Flächen-, Anchor- und Socket-basierte Platzierung.
* Er benötigt klar getrennte Schichten für Shell, Bootstrap, Runtime, State, Render, Tools, UI und Integrationen.
* Er ist performancekritisch und muss deshalb Chunking, Streaming, Instancing und Teilupdates unterstützen.
* Realtime, 2D und Quantity-/Cost-bezogene Folgefunktionen werden integriert, aber nicht im Editor fachlich vermischt.

---

## 30. Nächster sinnvoller Schritt

Der nächste sinnvolle Schritt nach dieser Datei ist:

1. diese SOLL-`AI.md` gegen eure vorhandene IST-Analyse zu spiegeln
2. daraus eine konkrete Zielstruktur für `frontend/src/` abzuleiten
3. die offenen Kernsubsysteme als eigene Unterdokumente zu definieren, z. B.:

   * `runtime/scene/AI.md`
   * `state/AI.md`
   * `tools/AI.md`
   * `world/AI.md`
   * `render/AI.md`
4. anschließend die wichtigsten Übergangsstellen im Code zu bereinigen:

   * `routes/editor.py` gegen `editor_bootstrap/context.py`
   * `runtime_state.ts` gegen `runtime_state_models.ts` + `runtime_state_factories.ts`
   * Placeholder-Weltlogik gegen echte World-/Chunk-Schichten

```

Zwei sinnvolle Ergänzungen wären jetzt:
1. eine **kürzere, reviewerfreundliche Version** mit etwa 1/3 der Länge
2. eine **zweite Fassung, die exakt auf eure aktuelle Ordnerstruktur gemappt ist** und konkrete Dateiverantwortungen für `frontend/src/*` festschreibt.
```
