# VECTOPLAN CAD

`vectoplan-cad` ist die browserbasierte 2D-/CAD-Arbeitsfläche von VECTOPLAN.

Der Service ist **kein eigenständiger Projekt- oder Modelldatenspeicher**. Er lädt einen von `vectoplan-core` bereitgestellten Projektionszustand, stellt daraus Planblätter und CAD-Ansichten dar, nimmt Benutzeraktionen entgegen und gibt diese als deklarative Commands beziehungsweise Exportaufträge zurück.

Der erste Entwicklungsstand ist bewusst ein **lauffähiges, zustandsloses Flask-/Python-Grundgerüst** mit Vollbild-Template, Platzhalterwerkzeugen, Testinput und einer einfachen SVG-Projektion.

---

## 1. Zielbild

VECTOPLAN soll Bauen in 3D und Arbeiten in 2D miteinander verbinden:

```text
vectoplan-editor / vectoplan-chunk
  grobe räumliche Gebäude- und Infrastrukturstruktur

vectoplan-library
  Families, Varianten, reale Maße, Materialien und technische Profile

vectoplan-core
  kanonisches Projektmodell, Revisionen, Auflösung, Transformation und Orchestrierung

vectoplan-cad
  Planblätter, Ansichten, CAD-Werkzeuge, Annotationen und Exporte

vectoplan-converter
  BIM-/Austauschformate und weitere Konvertierungen
```

`vectoplan-core` ist die verbindliche Schnittstelle zwischen Chunk und CAD; Library- und Converter-Auflösung werden dort schrittweise ergänzt. `vectoplan-cad` kommuniziert nicht direkt mit den fachlichen Datenbanken dieser Services.

---

## 2. Wichtigster Leitsatz

> `vectoplan-cad` projiziert und bearbeitet einen vom Core gelieferten CAD-Arbeitszustand, besitzt aber nicht die fachliche Wahrheit des Projekts.

Daraus folgen vier Regeln:

1. Der Browserzustand ist kein kanonisches Projektmodell.
2. Gerenderte SVG-Linien sind keine Datenquelle.
3. Benutzeraktionen werden als semantische Commands beschrieben.
4. Persistenz, Revisionsbildung und serviceübergreifende Auflösung gehören in `vectoplan-core`.

---

## 3. Was der Service können soll

### 3.1 Planblätter und Teilansichten

Der zentrale Arbeitsbereich zeigt immer ein vollständiges Planblatt mit:

- Blattformat und Orientierung
- Plankopf
- Blattnummer und Planstatus
- einem oder mehreren Viewports
- Grundrissen, Schnitten, Ansichten, Details, Lageplänen oder Profilen
- Legenden, Hinweisen, Maßketten und Symbolen

Teilbilder sind keine separaten Anwendungen, sondern **Viewports auf einem gemeinsamen Blatt**. Ein Blatt kann beispielsweise einen großen Grundriss, einen Schnitt und ein Detail enthalten.

> **Aktueller UI-Zwischenschritt:** Die Arbeitsoberfläche konzentriert sich vorerst ausschließlich auf den Grundriss des Erdgeschosses in einer unbegrenzten Modellfläche. Blattlayout, Schnitt und Legende bleiben im Scene-Graph-Vertrag erhalten, werden aber erst in einem späteren Präsentations-/Planblattmodus wieder eingeblendet. Dadurch kann künftig eine Grundstücks- oder Kartenebene unter demselben Erdgeschoss-Modell liegen.

### 3.2 Planprofile

Das System muss unterschiedliche fachliche Kontexte abbilden können:

```text
domain
  hochbau | tiefbau | ingenieurbau

asset_kind
  wohngebaeude | industriehalle | bruecke | tunnel | rohrleitung | strasse | ...

phase
  entwurf | genehmigung | ausfuehrung

discipline
  architektur | tragwerk | entwässerung | leitungsbau | verkehrsanlage | ...

plan_kind
  grundriss | schnitt | ansicht | lageplan | detail | laengsschnitt | querprofil | ...
```

Planprofile werden deklarativ beschrieben. Neue Kombinationen dürfen nicht zu großen `if/elif`-Blöcken in Routen oder Renderern führen.

### 3.3 Semantische Bauteilbearbeitung

Bauteile werden nicht nur als Linien behandelt. Ein Element besitzt Referenzen auf:

- Core-Element-ID
- Library-Family
- Library-Variant
- reale Parameter
- Klassifikation
- Darstellungsprofil
- Herkunft und Revision

Beispiel:

```text
Family: ziegelwand
Variant: 24cm_tragend
reale Dicke: 240 mm
Darstellung: Mauerwerksschraffur, Schnittlinie stark
```

### 3.4 CAD-Werkzeuge

Langfristig soll `vectoplan-cad` auch klassische CAD-Werkzeuge anbieten, damit professionelle Nutzer effizient einsteigen und Details ergänzen können.

Geplante Werkzeuggruppen:

- Wand ziehen
- Linie, Polylinie und Bogen
- Rechteck und Polygon
- verschieben, drehen, spiegeln und trimmen
- Fangpunkte, Raster und Achsen
- Maßketten und Höhenkoten
- Texte, Symbole und Beschriftungen
- Schnitte und Ansichten anlegen
- Viewports platzieren und zuschneiden
- Layer und Sichtbarkeiten steuern

Diese Werkzeuge bearbeiten keine isolierte Zeichnung. Sie erzeugen deklarative `CadCommand`-Objekte. Der spätere Core entscheidet, ob daraus nur eine 2D-Annotation, ein semantisches Bauteil oder eine Änderung der Chunk-Welt entsteht.

Beispiel:

```json
{
  "command": "create_wall",
  "document_ref": "cad_demo_001",
  "sheet_ref": "sheet_01",
  "viewport_ref": "vp_ground_floor",
  "geometry": {
    "start_mm": [1000, 2000],
    "end_mm": [6800, 2000]
  },
  "family_ref": "hochbau.waende.ziegelwand",
  "variant_ref": "24cm_tragend"
}
```

### 3.5 Bidirektionale Arbeit

Das Ziel ist kein einseitiger Viewer.

```text
Chunk-/3D-Änderung
  -> Core normalisiert und revisioniert
  -> CAD erhält neue Projektion

CAD-Command
  -> Core validiert und interpretiert
  -> optional Änderung am kanonischen Modell
  -> optional neue Chunk-Repräsentation
  -> neue CAD-Projektion
```

Konflikte, Validierung und Revisionsbildung gehören dabei in den Core, nicht in die Browseroberfläche.

### 3.6 Export

Geplante Exportziele:

- PDF für druckbare Planunterlagen
- DXF für offenen CAD-Austausch
- DWG für professionelle CAD-Workflows
- später SVG, Bildformate und weitere Austauschprofile

Exporte werden als eigene Adapter beziehungsweise Jobs behandelt. Das UI startet einen Exportauftrag und zeigt dessen Ergebnis an. Exportlogik soll nicht unkontrolliert in Browserkomponenten oder HTTP-Routen verteilt werden.

---

## 4. Was der Service bewusst nicht können soll

`vectoplan-cad` ist nicht:

- nicht der Owner von Projekten oder Benutzern
- nicht die kanonische Projekt- oder Modellwahrheit
- nicht die Chunk-Datenbank
- nicht die Library-Datenbank
- nicht der BIM-Konverter
- nicht die zentrale Revisions- und Konfliktlogik
- nicht der Ort für direkte serviceübergreifende Datenbankzugriffe
- nicht ein Renderer, der aus SVG wieder Fachobjekte rekonstruiert
- nicht ein dauerhafter Speicher für CAD-Dokumente
- nicht ein Platz für beliebige ausführbare Library-Skripte

Im ersten Entwicklungsstand speichert der Service **keine Projektdaten**. Testdaten werden aus einer JSON-Datei geladen und nur im Speicher des Browser-Tabs verwendet.

---

## 5. Verantwortungsgrenzen

### `vectoplan-core`

Besitzt in der ersten Ausbaustufe:

- kanonische Projektinstanzen
- serviceübergreifende IDs und Revisionen
- Auflösung von Chunk-Elementen zu Library-Families und Varianten
- Umrechnung von Editorabstraktion zu realen Maßen
- Validierung und Konfliktbehandlung
- gecachte Chunk→2D-Projektionen mit Fingerprint, Revision und ETag
- trockene 2D→Chunk-Mutationspläne ohne Ausführung
- persistente DXF-/DWG-Quellen und normalisierte CAD-Overlays

CAD-Command-Ausführung sowie Converter- und Export-Orchestrierung folgen nach der
separaten Spezifikation der Bearbeitungswerkzeuge.

### `vectoplan-cad`

Soll besitzen:

- CAD-Workspace und Bedienzustand
- Planblatt- und Viewportdarstellung
- Auswahl und Bearbeitung sichtbarer Elemente
- temporäre Werkzeugzustände
- Scene-Graph-Rendering
- Erstellung deklarativer Commands
- Exportdialoge und Exportauftragserzeugung

### `vectoplan-library`

Soll besitzen:

- Families und Varianten
- reale Maße und technische Profile
- CAD-Darstellungsprofile und Symbole
- Materialien, Schraffuren und zulässige Parameter

### `vectoplan-chunk`

Soll besitzen:

- räumliche Chunk-/Zellstruktur
- editierbare Runtime-Welt
- grobe räumliche Instanzen

### `vectoplan-converter`

Soll besitzen:

- BIM-/Austauschkonvertierung
- externe Formatmodelle
- Import-/Export-nahe Transformationslogik außerhalb der CAD-Oberfläche

---

## 6. Datenfluss

### 6.1 Lesen

```text
Browser
  -> POST /api/v1/cad/core/projects/<core_project_id>/projection
  -> vectoplan-cad Adapter
  -> vectoplan-core
  -> vectoplan-chunk Batch-Read
  -> CadProjectionInput
  -> lokaler Scene Graph
  -> SVG/WebGL Renderer
```

### 6.2 Schreiben

```text
Benutzeraktion
  -> CadCommand
  -> POST /api/v1/cad/commands
  -> derzeit nur validierter lokaler Entwurf
  -> spätere Core-Command-Spezifikation
```

### 6.3 Export

```text
Benutzer wählt PDF/DXF/DWG
  -> ExportRequest
  -> später Core oder Export-Worker
  -> ExportArtifact
  -> Download-Referenz
```

---

## 7. Zentrale Verträge

### `CadProjectionInput`

Beschreibt einen vollständigen, darstellbaren CAD-Zustand:

- Contract-Version
- Projekt- und Revisionsreferenzen
- Planprofil
- Blätter
- Viewports
- Elemente
- Styles
- Warnungen
- erlaubte Commands

### `CadCommand`

Beschreibt eine Benutzerabsicht:

- Command-Typ
- Zielreferenzen
- Ausgangsrevision
- Parameter
- Geometrie
- Benutzerkontext
- Client-Command-ID

### `ExportRequest`

Beschreibt einen Export:

- Format
- Dokument- oder Blattreferenz
- Revision
- Layoutprofil
- Layerauswahl
- Ausgabeoptionen

---

## 8. Rendering-Modell

Die Fachlogik erzeugt keinen direkten SVG-String. Dazwischen liegt ein neutraler Scene Graph:

```text
CadProjectionInput
  -> Projection Resolver
  -> CadScene
  -> SVG Renderer
  -> später PDF/DXF/DWG Adapter
```

Ein `CadScene` besteht beispielsweise aus:

```text
line
polyline
polygon
arc
text
hatch
symbol
dimension
marker
viewport
```

Die erste Ausbaustufe nutzt SVG, weil technische Linien, Texte, Auswahl, Zoom und Druck damit nachvollziehbar umgesetzt werden können.

---

## 9. Koordinaten und Einheiten

Die Transformation muss explizit bleiben:

```text
World Space
  -> Project Space
  -> View Space
  -> Sheet Space in mm
  -> Screen Space in px
```

Grundregeln:

- reale Maße werden eindeutig mit Einheit übertragen
- Blattgeometrie wird in Millimetern beschrieben
- Browserpixel sind nur Renderausgabe
- Papiermaßstab verändert nicht das Modell
- Viewport-Zoom verändert nicht das Modell
- Modellparameter werden über Commands verändert

---

## 10. Benutzeroberfläche

Das Grundlayout ist immer vollflächig:

```text
Topbar
  Dokument, Planprofil, Phase, Undo/Redo, Werkzeuggruppen, Export

Linkes Panel
  Blätter, Ansichten, Ebenen, Layer, Elemente

Zentrum
  vollständiges Planblatt mit einem oder mehreren Viewports

Rechtes Panel
  Auswahl, Family, Variant, Parameter, Regeln, Warnungen

Statusbar
  Zoom, Maßstab, Koordinate, Modus, Validierungsstatus
```

Panels dürfen eingeklappt werden. Das Planblatt bleibt der zentrale Arbeitsgegenstand.

---

## 11. Aktueller Entwicklungsstand

### Version 0.3 – Core-Projektion und Grundstückskontext

Der Service enthält weiterhin das zustandslose Fundament aus Stufe 1 und zusätzlich eine erste zusammenhängende Ausbaustufe für professionelles CAD-Arbeiten:

- neutraler serverseitiger `CadScene` mit dem Vertrag `cad-scene/0.1`
- Auflösung semantischer Elemente in `polygon`, `rect`, `line`, `text` und `dimension`
- tiefere Validierung von Dokumenten, Blättern, Viewports, Elementen und Geometrien
- dynamische Layer und Darstellungsstile aus dem Scene Graph
- echte Zwei-Punkt-Werkzeuge für Wand, Linie, Maß und Schnittmarke
- explizite Modellkoordinaten und konfigurierbares Fangraster
- validierte `CadCommand`-Entwürfe über `POST /api/v1/cad/commands`
- lokale, nur im Browser-Tab vorhandene Vorschau neuer Elemente
- lokales Undo/Redo für diese Command-Entwürfe
- fokussierter Erdgeschoss-Modellbereich; weitere Viewports bleiben im Datenvertrag für spätere Modi erhalten
- auswählbare Scene-Primitives mit semantischem Inspector
- validierte Exportaufträge für PDF, DXF, DWG und SVG
- responsive Vollbild-Arbeitsfläche mit Zoom um die Mausposition – auch während die Umschalttaste für das 45°-Raster gehalten wird –, horizontalem Trackpad-Scrollen, mittlerer Maustasten-Navigation und Layersteuerung
- weiße, rasterfreie Modellfläche mit bildschirmfüllendem CAD-Fadenkreuz
- fortlaufende Wandketten: jeder gesetzte Endpunkt wird sofort zum nächsten Startpunkt, die Persistierung läuft geordnet im Hintergrund und `ESC` beendet die Kette
- einklappbares Gebäudefenster mit Gebäudetyp, Dachart, aktivem Geschoss und Rohhöhen in Metern; Punkt und Komma werden als Dezimaltrennzeichen akzeptiert, Ober-, Dach- und Kellergeschosse können lokal hinzugefügt oder entfernt werden
- lokale, rückgängig machbare 2D-Bearbeitung für Kopieren, Drehen, Ausschneiden/Einfügen, Verzerren und Spiegeln
- lesender Core-Adapter für die Chunk-zu-2D-Projektion
- synchronisierter Flurstückszustand aus dem Projekt-Workspace
- kräftige Darstellung ausgewählter und gestrichelte Darstellung angrenzender
  Flurstücke
- nordenorientierte Darstellung von Projektions- und Grundstücksgeometrie
- Begrenzung der darauf basierenden Grundrissauswertung auf die ausgewählte
  Grundstücksvereinigung

Wichtig: `accepted: false` in Command- und Exportantworten bedeutet weiterhin, dass ohne Core beziehungsweise Export-Worker nichts persistiert und kein Exportartefakt erzeugt wurde. `processable: true` zeigt an, dass der Auftrag fachlich gültig und für die spätere Weiterleitung vorbereitet ist.

Die klassischen Bearbeitungswerkzeuge sind in dieser Stufe absichtlich eine
lokale 2D-CAD-Schicht. Sie arbeiten nicht direkt auf Chunk-Zellen. Kopien und
Transformationen werden als lokale Edit-Operationen im Undo/Redo-Verlauf
geführt. Der nächste Integrationsschritt ist ein semantischer
Transformationsvertrag in `vectoplan-core`; erst Core darf daraus atomare
Chunk-Mutationen erzeugen. Gebäudestrukturänderungen werden als
`vectoplan-building-draft/0.1` im Projektbrowser gespeichert und über das Event
`vectoplan-cad:building-structure` an den Projekt-Host publiziert. Neue
Bauteil-Commands tragen Geschoss, Rohhöhe, Gebäudetyp und Dachart bereits in
ihren Parametern.

Der Service besitzt jetzt eine lesende Verbindung zu Core über
`POST /api/v1/cad/core/projects/<core_project_id>/projection` und kann eine
Importprojektion laden. Er kommuniziert weiterhin nicht direkt mit Chunk,
Library oder Converter und speichert selbst keine Projektdaten. Ist Core nicht
erreichbar, liefert die Route `projection_unavailable`; die UI darf diesen
Zustand nicht als leere, erfolgreiche Projektion behandeln.

Der gemeinsame Grundstücks- und Polygonvertrag ist in
[`../vectoplan-editor/docs/PARCEL_GRID_AND_WORLDEDIT.md`](../vectoplan-editor/docs/PARCEL_GRID_AND_WORLDEDIT.md)
beschrieben.

---

## 12. Routen

### UI

```text
GET /
  Redirect auf /cad

GET /cad
  Vollbild-CAD-Arbeitsfläche
```

### Health

```text
GET /health/live
GET /health/ready
```

### API

```text
GET  /api/v1/cad/status
GET  /api/v1/cad/bootstrap
GET  /api/v1/cad/plan-profiles
GET  /api/v1/cad/test-input
POST /api/v1/cad/preview
POST /api/v1/cad/core/projects/<core_project_id>/projection
GET  /api/v1/cad/core/projects/<core_project_id>/imports/<document_id>/projection
POST /api/v1/cad/commands
POST /api/v1/cad/exports
```

Die beiden `core/projects`-Routen sind lesende Adapter zu `vectoplan-core`.
`commands` und `exports` validieren ihre Verträge und liefern zustandslose
Receipts. Sie speichern nichts und dispatchen ohne Core beziehungsweise
Export-Worker keine Aufträge.

---

## 13. Ordnerstruktur

```text
vectoplan-cad/
├── app.py
├── wsgi.py
├── config.py
├── extensions.py
├── requirements.txt
├── Dockerfile
├── entrypoint.sh
├── .dockerignore
├── .env.example
│
├── routes/
│   ├── __init__.py
│   ├── health.py
│   └── cad.py
│
├── src/
│   ├── bootstrap/
│   │   └── startup.py
│   ├── commands/
│   │   └── service.py
│   ├── contracts/
│   │   ├── cad_projection_input.schema.json
│   │   ├── cad_command.schema.json
│   │   └── export_request.schema.json
│   ├── exports/
│   │   └── service.py
│   ├── profiles/
│   │   └── catalog.json
│   ├── projection/
│   │   └── service.py
│   └── scene/
│       └── service.py
│
├── templates/cad/index.html
├── static/cad/
│   ├── css/main.css
│   ├── js/main.js
│   └── examples/test_input.json
│
└── tests/
    ├── test_app.py
    └── test_projection.py
```

---
## 14. Lokaler Start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python wsgi.py
```

Unter Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python wsgi.py
```

Danach:

```text
http://localhost:5000/cad
```

Tests:

```bash
pytest
```

---

## 15. Docker

```bash
docker build -t vectoplan-cad .
docker run --rm -p 5000:5000 vectoplan-cad
```

Im vollständigen Server-Stack kann nur der CAD-Service gebaut und gestartet werden:

```powershell
cd services/vectoplan-server
docker compose -f docker-compose.yml up -d --build vectoplan-cad
```

Danach ist die Arbeitsfläche erreichbar unter:

```text
http://localhost:5104/cad
http://localhost:5104/health/live
http://localhost:5104/health/ready
```

Logs und Stop:

```powershell
docker compose -f docker-compose.yml logs -f vectoplan-cad
docker compose -f docker-compose.yml stop vectoplan-cad
```

---

## 16. Environment-Variablen

```text
VECTOPLAN_CAD_CONFIG=development
VECTOPLAN_CAD_HOST=0.0.0.0
VECTOPLAN_CAD_PORT=5000
VECTOPLAN_CAD_ROUTE_PREFIX=/api/v1/cad
VECTOPLAN_CAD_MOCK_MODE=true
VECTOPLAN_CAD_STRICT_STARTUP=false
VECTOPLAN_CAD_CORE_INTERNAL_URL=http://vectoplan-core:5000
VECTOPLAN_CAD_CORE_PUBLIC_URL=http://localhost:5106
VECTOPLAN_CAD_CORE_SERVICE_API_KEY=
VECTOPLAN_CAD_CORE_TIMEOUT_SECONDS=45
```

---

## 17. Automatisierte CAD-Berechnungen

Zwei zustandslose, versionierte JSON-Berechnungen bilden die Grundlage für die nächsten CAD-Ausbaustufen:

- `POST /api/v1/cad/automation/dimensions/calculate` erzeugt Außen- und Innenbemaßungsketten einschließlich Tür-/Fensterbreiten.
- `POST /api/v1/cad/automation/roof/calculate` berechnet Dachgeometrie, individuelle Dachüberstände, Dachhaut, Sparren und Pfetten für Flach-, Sattel-, Walm-, Krüppelwalm-, Pult-, Mansard-, Trapez-, Schmetterlings-, Zelt-/Pyramiden-, Tonnen- und Sheddächer.

Das 2D-Dachwerkzeug zeichnet beliebige einfache, gerade und auch konkave
Konturen. `create_roof` speichert ein neues gemeinsames `building_roof`-Objekt;
Punktziehen und Parameteränderungen verwenden `update_roof`, damit dieselbe
stabile Objekt-ID in CAD und Editor aktualisiert wird.

Verträge, Beispiele und Implementierung liegen getrennt unter:

- `src/automation/dimensions/`
- `src/automation/roof/`

Jede Eingabeänderung erzeugt ein vollständig neu berechnetes Ergebnis mit Fingerprint und vorgeschlagenem JSON-Dateinamen. Dadurch können CAD und VECTOPLAN Core später dieselbe Berechnung ohne UI-Abhängigkeit verwenden.

---

## 18. Geplante Ausbaustufen

### Stufe 1 – Fundament

- Service startet
- Vollbild-Template
- Testinput
- Planblatt
- Platzhalter-Tools
- stateless APIs

### Stufe 2 – Scene Graph

- streng typisierte Geometrieobjekte
- Layer
- Styles
- Schraffuren
- Maße und Texte
- Auswahl und Hover

### Stufe 3 – Core-Anbindung (lesender Adapter umgesetzt)

- Projection Adapter
- Revisionen
- Commands (Dry-Run-Übersetzung vorhanden, Ausführung bewusst ausstehend)
- Fehler- und Konfliktantworten
- Reconnect und Reload

### Stufe 4 – professionelle CAD-Werkzeuge

- Wand-, Linien- und Bearbeitungstools
- Fang- und Rasterlogik
- Achsen
- Maßketten
- Schnitte und Viewports
- Undo/Redo über Commands

### Stufe 5 – Exporte

- PDF
- DXF
- DWG
- Exportprofile
- asynchrone Exportjobs

### Stufe 6 – große Projekte und Zusammenarbeit

- Worker-basierte Berechnung
- räumliche Indizes
- inkrementelles Rendering
- Presence und Kollaboration
- Konfliktauflösung im Core

---

## 19. Akzeptanzkriterien des Fundaments

Das Fundament gilt als nutzbar, wenn:

1. `create_app()` funktioniert.
2. Gunicorn über `wsgi:app` startet.
3. `/health/live` und `/health/ready` HTTP 200 liefern.
4. `/cad` eine Vollbildoberfläche rendert.
5. Ein vollständiges Planblatt mit Plankopf sichtbar ist.
6. Mindestens zwei Viewports dargestellt werden.
7. Der Testinput über die API geladen wird.
8. Wände und Öffnungen aus dem Testinput sichtbar sind.
9. Ein Element ausgewählt und im Inspector angezeigt werden kann.
10. Wand-, Linien-, Maß- und Schnittwerkzeuge validierte lokale `CadCommand`-Entwürfe erzeugen.
11. Der Service keine Projektpersistenz besitzt.
12. POST-Routen keine Daten dauerhaft speichern.
13. Core-, Library- und Chunk-Abhängigkeiten über Adaptergrenzen vorbereitet sind.
14. Tests für Start, Health, Template und Testinput bestehen.

---

## 20. Offene Architekturentscheidungen

Vor der produktiven Core-Anbindung müssen insbesondere entschieden werden:

- genaue Ownership von CAD-Dokument, Blatt und Viewport
- Command-Versionierung
- Revisions- und Konfliktprotokoll
- Library-CAD-Profilformat
- 2D-only Annotationen gegenüber modellverändernden Commands
- Export-Worker und Artefaktspeicher
- Authentifizierung und Berechtigungen
- Kollaborationsmodell
- maximale Projektgröße und Renderingstrategie
- verbindliche Einheiten und Koordinatensysteme

---

## 21. Merksätze

- `vectoplan-cad` ist eine Arbeitsfläche, keine Projektdatenbank.
- `vectoplan-core` ist die kanonische Integrations- und Revisionsschicht.
- Teilbilder sind Viewports auf einem vollständigen Planblatt.
- CAD-Werkzeuge erzeugen Commands, nicht unkontrollierte Linienzustände.
- SVG ist die erste Darstellung, nicht die fachliche Wahrheit.
- PDF, DXF und DWG sind Exportadapter, keine verstreuten UI-Funktionen.
- Der erste Schritt ist ein startfähiges, testbares Fundament mit stabilen Verträgen.
