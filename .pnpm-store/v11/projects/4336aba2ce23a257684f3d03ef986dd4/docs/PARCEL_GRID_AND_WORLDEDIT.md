# Grundstücksauswahl, Grundstücksraster und WorldEdit

Stand: 2026-08-10

Aktiver Rastervertrag: `vectoplan-parcel-grid-guide.v7`

Dieses Dokument beschreibt den produktiven Daten- und Bedienpfad zwischen
`vectoplan-openLayer`, `vectoplan-app`, `vectoplan-editor`, `vectoplan-chunk`,
`vectoplan-core` und `vectoplan-cad`. Es ersetzt keine Kataster- oder
baurechtliche Prüfung. Die Zonen sind ein Authoring- und Fangsystem.

## Zuständigkeiten

| Komponente | Verantwortung |
| --- | --- |
| `vectoplan-openLayer` | Flurstücksdaten laden, Projektkoordinate anzeigen/verschieben und Flurstücke auf der Karte auswählen |
| `vectoplan-app` | Projektweiten Auswahlzustand mit Revision halten und an Map, 3D und 2D weiterreichen |
| `vectoplan-editor` | Auswahl in Weltkoordinaten transformieren, Grundstücksflächen und Raster rendern sowie Platzierungen auflösen |
| `vectoplan-chunk` | `SetBlock`, transaktionale WorldEdit-Commands und semantische `PlaceObject`-Objekte dauerhaft speichern |
| `vectoplan-core` | Gespeicherte Chunk-Zellen und semantische Objekt-Footprints in das kanonische Modell bzw. die 2D-Projektion überführen |
| `vectoplan-cad` | Ausgewählte und angrenzende Flurstücke nordenorientiert darstellen und die Core-Projektion darauf beziehen |

Die Earth-/Chunk-Achsen bleiben unverändert. Eine Darstellung oder ein lokales
Bauraster darf das globale Earth-Raster nicht drehen. WGS84-Flurstücke werden
über den kanonischen Earth-Frame in lokale Weltkoordinaten transformiert.

## Synchronisierte Flurstücksauswahl

1. Die Karte bevorzugt den Datensatz `flurstuecke`, wenn er verfügbar ist.
2. Nach dem Laden wird das Polygon an der Projektkoordinate automatisch
   ausgewählt. Falls der Punkt numerisch knapp neben einer Grenze liegt, wird
   die nächstgelegene Geometrie innerhalb der vorgesehenen Toleranz verwendet.
3. Ein Klick auf ein Flurstück schaltet dessen Auswahl ein oder aus.
4. Der Projektmarker ist im bearbeitbaren Projektmodus verschiebbar. Nach dem
   Verschieben werden Koordinate, Datenausschnitt und automatische Auswahl
   aktualisiert.
5. Die Map veröffentlicht Katalog und Auswahl über die Verträge
   `vectoplan-map:parcel-catalog-changed`,
   `vectoplan-map:parcel-selection-changed` und
   `vectoplan-map:project-coordinate-changed`.
6. Editor und CAD erhalten denselben, revisionsgebundenen Auswahlzustand. Eine
   ältere Revision darf eine neuere Auswahl nicht überschreiben.
7. Bauachse, Schrägzonen-Tiefe, Modus und Abstand werden als
   `vectoplan-parcel-grid-state.v1` pro Flurstück im Projektzustand gespeichert.
   Ab- und erneutes Anwählen stellt daher dasselbe Raster wieder her.

Die Vereinigung aller ausgewählten Flurstücke ist die geschützte Baumaskierung.
Gemeinsame Grenzen zwischen zwei ausgewählten Flurstücken werden deshalb nicht
wie eine fremde Grundstücksgrenze behandelt.

## Darstellung in Map, 3D und 2D

| Farbe/Darstellung | Bedeutung |
| --- | --- |
| kräftige blaue Fläche in der Map | ausgewähltes Flurstück |
| transparente blaue Fläche in 3D | ausgewählte Grundstücksvereinigung |
| blaue Linie in 3D | verbindliche Grenze des ausgewählten Grundstücksrasters |
| rote Linien und schwach rote Flächen | Bauraster, Schrägzonen und Übergänge |
| orange Linie | mit dem Grundstücksraster-Werkzeug aktiv gewählte Bauachse |
| gelbe Linien | allgemeines, aus GeoServer geladenes Geodaten-Overlay; nicht die Rasterwahrheit |
| gestrichelte Linie in 2D | angrenzendes Flurstück |
| kräftige blaue Linie/Fläche in 2D | ausgewähltes Flurstück |

Das Grundstücksraster liegt auf einer festen horizontalen Ebene. Beim ersten
Aufbau wird aus der dominanten Geländehöhe eine Ebene ermittelt und danach für
diesen Rasterzustand beibehalten. Bereits gesetzte Terrain-Blöcke verändern die
Y-Höhe der roten Rasterlinien nicht. Das allgemeine gelbe Geodaten-Overlay darf
dagegen weiterhin die sichtbare Terrainoberfläche abtasten; beide Darstellungen
haben unterschiedliche Aufgaben.

Die 2D-Ansicht ist immer nordenorientiert. Präsentationsrotationen ändern weder
die Grundstücksmaske noch die Earth-/Chunk-Koordinaten.

## Rasterzonen v7

Das Raster wird aus den echten Kanten der ausgewählten Polygonvereinigung
berechnet. Ein Kästchen entspricht einer Weltzelle bzw. einem Block.

```text
Grundstücksgrenze
  0–1 m   schräge Zone, parallel zur lokalen Grenzkante
  1–2 m   schräge Zone
  2–3 m   schräge Zone
  3–4 m   lückenlos geteilter Übergang zum geraden Innenraster
  ab 4 m  normales, achsparalleles Raster
```

Die Standardtiefe der Schrägzone beträgt 3 m. Das Grundstücksraster-Werkzeug
kann für eine ausgewählte Kante den Wirkbereich zwischen 1 und 6 m verschieben
oder eine Bauachse mit Abstand zur Grenze setzen. Die gespeicherten Metadaten
führen die zulässigen Meterbänder explizit. Baurechtlich relevante Werte wie
0 m, 1 m, 2 m und 3–4 m bleiben dadurch sichtbar und reproduzierbar.

Die Grundstücksflächen werden einschließlich konkaver Außenringe und Löcher in
konvexe Dreiecke zerlegt. Jede schräge Kandidatenzelle wird an dieser echten
Flächenabdeckung geschnitten. Bereits angenommene schräge Flächen werden von
nachfolgenden Randsegmenten abgezogen; dadurch bleiben auch Eckbereiche eine
disjunkte Partition ohne Doppelbelegung oder Ausdehnung über die Grundstücks-
grenze. Das gerade Raster wird anschließend nur aus der verbleibenden Fläche
gebildet. Angeschnittene Zwischenflächen werden anhand der Mittelsenkrechten
zwischen den berührenden logischen Schrägzellen geteilt. Jede Teilfläche wird
dem linken/rechten Nachbarblock zugeschlagen. An Ecken gilt dieselbe
deterministische Nächste-Zelle-Regel als Voronoi-Partition. Dadurch bleibt die
Fläche lückenlos, disjunkt und bebaubar. `straight-clipped` bleibt nur als
Fail-closed-Diagnose für unvollständige oder fehlerhafte Eingabegeometrie.

Bei sehr großen Grundstücken werden Rand- und Innenzellen nur für das sichtbare
bzw. geladene Arbeitsfenster materialisiert. Die logischen Spaltennummern
bleiben dabei auf der vollständigen Grundstückskante verankert, sodass Formen
beim Nachladen stabil bleiben.

## Platzierungsregeln

Die im Editor gerenderten Rasterpolygone sind die autoritative
Platzierungsgeometrie. Der Resolver entscheidet über die tatsächliche
Polygonüberlappung mit der anvisierten Weltzelle und den exakten X/Z-Trefferpunkt,
nicht nur über deren Mittelpunkt. Dadurch lassen sich auch zwei gedrehte
Rasterzellen auswählen, die dieselbe achsparallele Voxelzelle schneiden. Genau
eine logische, bereits zugeschnittene Schrägzelle gewinnt.
Nur Triangulierungsfragmente derselben logischen Zelle dürfen wieder
zusammengeführt werden. Zellen verschiedener Randsegmente werden nie durch eine
Konvexhülle über eine Grundstücksecke hinweg verbunden.

- Normale, vollständig gültige Zellen werden als `SetBlock` gespeichert.
- Eine gültige schräge Rasterzelle wird als `PlaceObject` mit
  `objectKind: semantic_footprint` und `objectTypeId: parcel_grid_body`
  gespeichert.
- Die Editor-Platzierungsgeometrie besitzt `kind: parcel-grid-prism.v1`. Ihr
  Polygon- oder MultiPolygon-Footprint verwendet den Koordinatenraum
  `world-cell-xz`, `baseY` und `height`; dazu kommen `occupiedCells` und ein
  stabiler `mergeKey`. Mehrteilige Footprints bilden einen logischen Block und
  werden in 3D gemeinsam extrudiert sowie in 2D vollständig projiziert.
- Eine Zelle, die ein ausgewähltes Grundstück schneidet, muss vollständig in
  der ausgewählten Polygonvereinigung liegen oder durch einen gültigen
  Schräg-Footprint ersetzt werden.
- Übergangsreste sind Teil der angrenzenden Rasterblöcke und bebaubar.
- Außerhalb der ausgewählten Grundstücke bleibt freies Bauen möglich. Diese
  Bauwerke gehören jedoch nicht zur geschützten Grundstücksmaske und werden bei
  darauf begrenzten WorldEdit-/CAD-Auswertungen nicht berücksichtigt.
- Vom Generator erzeugter Untergrund bleibt unverändert. Ein vom Nutzer oberhalb
  der festen Rasterebene gesetzter Terrain-Block wird wie jedes andere
  platzierbare Bauteil an das Grundstücksraster angepasst.

Beispiel für den semantischen Command:

```json
{
  "type": "PlaceObject",
  "position": {"x": 12, "y": 4, "z": 8},
  "blockTypeId": "system_terrain",
  "objectTypeId": "parcel_grid_body",
  "objectKind": "semantic_footprint",
  "dimensions": {"x": 1, "y": 1, "z": 1},
  "footprint": {
    "type": "Polygon",
    "coordinateSpace": "world-cell-xz",
    "coordinates": [[[12.0, 8.0], [12.8, 8.2], [12.6, 9.0], [12.0, 8.0]]],
    "baseY": 4,
    "height": 1,
    "gridSchemaVersion": "vectoplan-parcel-grid-guide.v7"
  },
  "occupiedCells": [{"x": 12, "y": 4, "z": 8}]
}
```

`vectoplan-chunk` speichert dazu eine `WorldObjectInstance`, Chunk-Referenzen,
den Polygon-Footprint, belegte Zellen, Snapshot-`objectRefs`, Events und Dirty-
Chunks. Dadurch bleibt die schräge Form nach einem Reload erhalten.

## Migration bestehender Blöcke

Alte Benutzerblöcke können noch als reine `SetBlock`-Zellen vorliegen. Beim
Meshing prüft die aktive SceneRuntime solche Zellen gegen das aktuelle Raster:

1. Die Zelle wird sofort mit einem transienten semantischen Footprint gerendert.
2. Nach Abschluss von Chunk-Streaming, Meshing und laufenden Block-Commands wird
   eine Hintergrundmigration eingeplant.
3. Pro Lauf werden höchstens 24 Einträge nacheinander als `PlaceObject`
   persistiert.
4. Erfolgreiche Commands invalidieren die betroffenen Chunks; nach dem Reload
   stammt die Form aus den gespeicherten `objectRefs`.
5. Ändert sich Auswahl oder Rastergeometrie, werden veraltete Warteschlangen
   verworfen und aus dem neuen Raster neu aufgebaut.
6. Bereits semantisch gespeicherte Körper werden bei einer geänderten
   Rastergeometrie unter derselben `objectInstanceId` aktualisiert. Objekt und
   Chunk-Ref werden ersetzt, nicht dupliziert.
7. Fehlgeschlagene Schreibversuche werden begrenzt wiederholt und erst nach
   einem bestätigten Command als erledigt markiert.

Die Migration ist absichtlich idle-gesteuert, damit Fliegen, Targeting und
Werkzeugwechsel nicht durch parallele Command-Stürme ausgebremst werden.

## WorldEdit-Werkzeuge

WorldEdit-Icons werden aus der Creative Library in das User-Inventar gezogen.
Das aktuell ausgewählte Hotbar-Item aktiviert das Werkzeug. Die rechte
Werkzeugleiste erscheint nur bei geöffnetem Creative-Inventar und zeigt die
Einstellungen des aktiven Werkzeugs; ein zweites schwebendes Werkzeugfenster
ist nicht Teil des Zielzustands.

| Werkzeug | Bedienung und Wirkung |
| --- | --- |
| Selection Tool | Linksklick halten und den Quader live aufziehen; anschließend sechs blaue Flächenpunkte greifen. Operationen: Set, Wall, Fill, Replace, Clear. |
| Paint Brush | Form, Radius, Dichte und Wandstärke einstellen und den anvisierten Bereich transaktional bearbeiten. |
| Sculpt Brush | Gelände/Volumen mit denselben begrenzten Brush-Verträgen bearbeiten. |
| Flurstück Tool | Ein anvisiertes Flurstück projektweit auswählen oder abwählen; größere Reichweite als normale Blockplatzierung. |
| Grundstücksraster | Grenzkante wählen und Tiefe/Bauachse des lokalen Schrägrasters verschieben. |
| Messwerkzeug | Zwei Punkte aufziehen und die Distanz in Metern anzeigen. |
| Copy / Cut / Paste | Vorhandenen Selection-Quader kopieren oder ausschneiden und relativ zu einem Zielpunkt einfügen. |

Selection, Paint und Sculpt werden serverseitig in einen begrenzten,
deterministischen Plan übersetzt. Eine aktivierte, aber leere Grundstücksmaske
schlägt geschlossen fehl. Vor Ausführung wird außerdem das maximale Zelllimit
geprüft.

## 2D-/Core-Vertrag

Semantische `PlaceObject`-Footprints sind die bevorzugte Quelle für schräge
Bauteile. Reine `SetBlock`-Zellen bleiben für normale Voxel erhalten. Core und
CAD dürfen einen Polygon-Footprint nicht wieder auf ein achsparalleles
Einheitsrechteck reduzieren.

CAD zeigt ausgewählte sowie angrenzende Flurstücksgrenzen. Die Projektion ist
nordenorientiert und verwendet denselben Projektursprung wie die 3D-
Transformation. Nur Bauteile innerhalb der ausgewählten Grundstücksvereinigung
werden in einer darauf begrenzten Projektansicht berücksichtigt.

## Prüfung

Relevante automatische Prüfungen:

```powershell
# In services/vectoplan-chunk
python -m pytest tests/test_world_edit_commands.py tests/test_user_placements.py
VECTOPLAN_RUN_DB_INTEGRATION_TESTS=1 python -m pytest tests/test_semantic_object_persistence_integration.py

# In services/vectoplan-openLayer
python -m pytest tests/test_parcel_selection_contract.py

# In services/vectoplan-editor
npm run test:parcel-grid
npm run typecheck
npm run build
```

Für einen manuellen End-to-End-Test wird ein angemeldetes Projekt mit
ausgewählten Flurstücken benötigt. Ein anonymer Editor kann die private
Projektauswahl nicht laden und ist deshalb kein vollständiger Nachweis für die
Persistenzmigration.
