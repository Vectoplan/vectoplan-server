# Linienbrush, Gelände und Sichtweite – 5. September 2026

## Befunde aus dem Berliner Projekt

Projekt: `prj_da09805bc6e54b29816c8cd6`, Welt `world_spawn`.
Die Prüfung verwendet exportierte Antworten des echten Chunk-Ladepfads,
einschließlich vorhandener Snapshots, Normalisierung, Oberflächenschalen,
Produktionsmesher und DDA-Picking. Die Browser-Prüfseiten sind separate lokale
Testharnesses; sie ersetzen keinen Test einer angemeldeten Benutzersitzung.

* Die alte OSM-Überlagerung wechselte Atlasgrenzen und Auflösung mit der Kamera.
  Außerdem gingen bei der Umrechnung großer Weltkoordinaten im Shader Details
  durch Float32-Rundung verloren. Nach einem Remesh wurde die Überlagerung erst
  beim nächsten verzögerten Update ergänzt.
* Der Oberflächen-Generator benutzte das 32-m-Projektübersichtsmodell, obwohl
  bereits DGM1 vorhanden war. Die 289 Eckwerte eines Chunks waren dadurch nur
  aus groben Stützpunkten interpoliert. Die echte 1-m-Abfrage eines 16-m-Chunks
  dauerte in zwei Messungen 65 bzw. 106 ms. Ein exportierter Bereich von
  208 × 208 Weltzellen umfasst Höhen von −3,42 bis +2,21 m relativ zum Projektdatum.
* Innere Flügelanschlüsse wurden als äußere Walmkanten berechnet. Korrekte
  Tragflächen allein reichten nicht: Auch die parallel versetzte Dachhaut muss
  an den Anschlusslinien und Knicken geschlossen sein.
* Der persistierte Baukörper und die Ersatzdarstellung hatten unterschiedliche
  Materialpfade. Die Ersatzdarstellung blieb deshalb beim Werkzeugwechsel blau.
  Ein erfülltes Reload-Promise garantiert außerdem noch keine fertigen Meshes.
* Die Sichtweite wurde zusätzlich durch einen Radius-8-Standard und die
  Verwechslung von Sichtbudget und HTTP-Paketgröße begrenzt.

## Umsetzung

`terrain_osm_overlay.ts` verwendet feste Zoom-19-Kacheln und berechnet lokale UVs
mit CPU-Double-Präzision. Bereits geladene Kacheln bleiben beim Bewegen erhalten;
neue Meshes erhalten sie vor der nächsten Darstellung. Nur sichtbares Gelände
löst Kartenanfragen aus, höchstens vier gleichzeitig. Attribution ist sichtbar.
Die Texturen haben Mipmaps und anisotrope Filterung; der begrenzte Cache hält bis
zu 192 Kacheln. Jede Kachel besitzt ihre eigene Textur, sodass das Laden eines
Nachbarbereichs keine bereits sichtbare Karte leert. Der normale beleuchtete
Materialpfad berücksichtigt Geländeneigung, Schatten und Nebel.

Die Chunk-Oberfläche fragt das DGM im 1-m-Raster ab und cached die Spalten.
Das Übersichtsmodell bleibt für Übersichtsaufgaben erhalten. Snapshot-Upgrades
dürfen gespeicherte Benutzeränderungen und Objektbesitz nicht überschreiben.

Sieben ältere Berliner Snapshots wurden zunächst von der Verfeinerung
ausgeschlossen, weil ihre Revision größer als die Zahl der Zellbefehle war.
Der konkrete zusätzliche Writer ist `apply_facade_metadata_repairs()` in
`src/geodata/lod2_import.py`: Er ergänzt Dachreferenzmetadaten und erhöht die
Revision, ohne Zellen oder deren Inhaltshash zu verändern. Der Upgradepfad
akzeptiert solche Lücken nur, wenn die gespeicherten Inhaltshashes vor und nach
der Lücke identisch sind. Bei einer Lücke am Ende muss der letzte Eventhash mit
dem aktuellen Snapshothash übereinstimmen. Vollständige Zelllisten und
Objektbelegungen bleiben zusätzlich Voraussetzung bzw. geschützt; eine pauschale
Toleranz für fehlende Befehle gibt es nicht. Das Lesen schreibt weiterhin keine
Snapshots in die Datenbank.

Die echte Meterauflösung machte einen Fehler an steilen Geländezellen sichtbar:
Ein unterhalb der Zellunterkante liegender Endpunkt erzeugte eine überkreuzte
Seitenfläche und damit stehende Dreiecksflossen. Die Höhenkante wird jetzt vor
dem Aufbau der Seitenfläche an der Zellunterkante zugeschnitten. Darstellung,
Kollision und DDA verwenden weiterhin dieselbe geschlossene Geometrie. Straßen
und Grundstückslinien folgen ebenfalls der tatsächlichen angeschnittenen Höhe.
Eine vorübergehend fehlgeschlagene Detailabfrage erhält das bekannte
Übersichtsrelief und kann anschließend wieder auf die Meterdaten wechseln.

Der gemeinsame CAD-Dachvertrag kennt geometrische Fortführungen an Flügeln.
Die Linienbrush liefert diese Informationen auch bei unterschiedlichen
Geschosshöhen. Gespeicherte Anschlussindizes werden bei einer Bearbeitung in
aktuelle Koordinaten umgesetzt; unabhängige neue Dächer erhalten keine fremden
Anschlüsse.

`building_preview.ts` zeichnet während der Bearbeitung deckende blaue Wände
und Dächer. `block_material.ts` stellt den gemeinsamen normalen Materialpfad
für persistierte Geometrie und Ersatzdarstellung bereit.
`building_edit_visuals.ts` ergänzt pro gespeichertem Gebäude ein Zahnrad und
stellt nach der Bearbeitung die ursprünglichen Materialien wieder her.
Rechtsklick auf einen Linienpunkt löscht diesen; ein verfehlter Punkt löscht
keinen ganzen Baukörper. Der vorhandene Raum-Polygonmodus behält seine Bedienung.

Der Standardradius beträgt 14 Chunks statt 7, entsprechend 224 statt 112
Weltzellenmetern. Das ergibt 613 Oberflächenspalten. Die Registry hält bis zu
2048 Chunks; Netzwerkanfragen bleiben in 12er-Paketen. Nahbereich und vorhandene
Gebäudelayer werden priorisiert, ein gerichteter Vorlauf bereitet weitere
Meshes vor. Ein Schritt im Streamingtest lädt nur 29 neue Oberflächen-Chunks.

## Reproduzierbare Prüfungen

* `tests/terrain_surface.test.ts`: Geometrie, Kollision, Abbau, UV-Genauigkeit,
  Kartenorientierung sowie Texturretention bei Kamerawechsel und Remesh.
* `tests/terrain_world_transport.test.ts <route-export.json>`: echte Berliner
  Routenantworten durch Normalisierung, Mesher und Picking.
* `tests/browser/terrain_world_audit.ts`: reale Weltchunks mit OSM und Abbau;
  benötigt den exportierten Bereich und den gebündelten Produktionsworker.
* `tests/browser/controller_audit.ts`: echter WorldEdit-Controller mit
  kontrolliertem Speichern/Nachladen, tatsächlich aufgebauten Gebäudemeshes,
  Werkzeugwechsel, Zahnrad, Geschossgriff und Fehlerrollback.
* `tests/browser/multi_wing_roof_audit.ts`: vier Pfade × drei Dachformen × zwei
  Höhenprofile gegen den laufenden CAD-Endpunkt; Tragfläche und Dachhaut an
  jeder gemeinsamen Fuge geprüft.
* `tests/line_brush_editing.test.ts`, `line_brush_building_edit_visuals.test.ts`
  und `chunk_streaming_policy.test.ts`: Bedienung, Material-Lifecycle und
  tatsächliche Sicht-/Nachladebudgets.

Die gebündelten Browser-Prüfseiten unter `static/qa` sind durch `.dockerignore`
von regulären Images ausgeschlossen. Für die lokale Prüfung werden sie nur
vorübergehend in den Testcontainer kopiert.

Die abschließende Geländeprüfung umfasst **182 reale Weltchunks** aus dem
208 × 208 Weltzellen großen Ausschnitt einschließlich der benötigten unteren
Chunklagen. Alle drei Transporttests bestanden: durchgängige 1-m-Eckhöhen nach
Snapshot-/HTTP-Normalisierung, Picking unterhalb von Y=0 und exakt identische
Höhen an sämtlichen benachbarten Chunkkanten. Der Produktions-Geometriepfad
erzeugte 295 angeschnittene Geländemeshes; die gemessenen Höhen reichen von
−3,42 bis +2,21 m, ohne Höhenüberhöhung. Im Browser wurden lesbare, unverändert
verankerte OSM-Kacheln und geschlossene Steilhänge ohne Dreiecksflossen geprüft.
Die 14 gezielten Backendtests prüfen unter anderem Spaltencaching,
Quellenausfall/Erholung und die strenge Verifikation der Revisionslücken.

Der abschließende Browser-Abbau traf die echte Oberflächenzelle `(164, 2, 164)`;
die neu erzeugten Meshes hatten ihre Kartentextur sofort wieder
(`remeshMapPreserved=true`). Der Controller-Browsertest bestand auch mit einem
erfüllten Reload-Promise ohne neue Daten und erst später eintreffenden Meshes.
Die vollständige Frontend-Check-Kette meldete 309 erfolgreiche Testausführungen,
anschließend Typecheck und Produktionsbuild; die gesamte CAD-Suite bestand mit
160 Tests. Editor, Chunk und CAD wurden lokal aktualisiert und sind gesund.
