# Gebäude, WorldEdit und Gelände – Entwicklungsstand 04.09.2026

## Gemeinsame Arbeitsansichten

`editor_workspace_mode.ts` beschreibt Ego (First Person) und Planung (Orbitkamera). Beide greifen auf dieselbe Szene, Chunk-Welt, Inventarauswahl und WorldEdit-Systemregistrierung zu. Die Kamera bestimmt die Zielerfassung: Fadenkreuz in Ego, freier Mauszeiger in Planung. Direktes einzelnes Platzieren/Abbauen bleibt die Ego-Interaktion; die fachlichen WorldEdit-Operationen sind gemeinsam.

`world_edit_controller.ts` verbindet Auswahl, Materialpinsel, Sculpt, Kopieren/Verschieben, Tentacle-Straße, Grundstück, Baufeld, Linien-Brush, Geschosse, Treppen, Dach und Messen mit der Chunk-API. Die Systeme in `world_edit/systems` behandeln Eingabe und Lebenszyklus; Geometriemodule arbeiten ohne Kamerazustand. Die zuvor noch vorhandene Kameraabhängigkeit von Gebäude-Linien-Brush und Straßenpfad wurde entfernt. Explizit gespeicherte ältere Raumkonturen behalten ihre Raumfunktion.

## Grundstücksraster

Bei leeren Grundstücken zerlegt `buildParcelGridPartition` die bebaubare Fläche in grenzparallele Bänder, Eck-/Übergangszellen und das verbleibende reguläre Raster. Die bestehenden Regeln für Abstand, Bandtiefe, ausgewählte Grundstücksunion und unbebaubare abgeschnittene Übergangszellen bleiben bestehen.

Bestandsgebäude liefern einen validierten `vectoplan-lod2-construction-grid.v1`-Vertrag. Der Fallback `deriveLod2BuildingGridReference` verwendet tatsächliche Fassadenfamilien, angepasste Zellbreiten und feste Anker an Fassaden und Anbauten. Er erzwingt keine gemittelte rechtwinklige Gebäudeform. Fassadenbänder haben in der Partition Vorrang vor Grundstücksbändern; Bestandsgrundflächen sind von der freien Baufläche ausgeschlossen.

Neue Linien-Brush-Gebäude verwenden dieselbe Referenzableitung und Partition innerhalb ihrer eigenen Außenkontur. Nach innen gerichtete Fassadenreihen übernehmen die gezeichnete Ausrichtung. Sichtbare Zellen sind konvexe Prismen; ganzzahlige Adressen dienen weiterhin der Chunk-Zuordnung und dem Abbau. Treffen mehrere Formzellen auf dieselbe Adresse, werden sie gemeinsam abgebaut. Eine reine Welt-X/Z-Voxelvorschau würde wieder gezackte schräge Wände erzeugen und ist deshalb für diesen Pfad ersetzt.

## Gebäudevertrag und Bearbeitung

Der gespeicherte `planning_build_area`-Elternknoten enthält Pfad, Breite, Gebäudetyp, Vorlage, Dachparameter und Geschossprofil. Geschosse sind semantisch 2,645 m hoch; die Decken sind 0,25 m stark. `constructionCells` speichert die tatsächlichen horizontalen Polygone und vertikalen Grenzen. Die Chunk-Belegung bleibt erhalten, sodass entfernte Routingzellen auch nach einem Neuladen fehlen.

Wände und Decken verbundener Flügel werden jeweils pro physischem Geschoss unter einem gemeinsamen Besitzer gespeichert: Der Chunk-Dienst erlaubt nur einen Objektbesitzer je Ganzzahlzelle. Dadurch verdrängen sich angrenzende Flügel nicht gegenseitig. Gebäude und Dachzonen werden mit dem vorhandenen `ObjectBatch`-Vertrag gespeichert.

Ein Werkzeugwechsel schließt einen gültigen Linienentwurf ab und speichert ihn. Ein noch nicht erfolgreich gespeicherter Entwurf bleibt sichtbar und beim erneuten Aktivieren bearbeitbar. Nach erfolgreichem Speichern und fehlgeschlagenem Szenenladen bleibt die Vorschau bis zum erfolgreichen Wiederholungsversuch erhalten. Die Gebäude-Metadaten werden beim Deaktivieren nicht verworfen. Geschossbearbeitung nutzt einen projizierten Höhengriff: Ziehen zeigt ganze Geschosse vorab, Loslassen speichert, Escape oder Pointer-Abbruch stellt Profil und Änderungszustand wieder her. Der gewählte Bereich gilt für den gesamten Baukörper oder ein Segment. Geöffnete Geschosseinstellungen halten auch in Ego die Maus frei.

## Dachzonen

Die Konturen der Dachflügel stammen aus derselben Gehrungsaufteilung wie die Wände. Die Zonen bleiben bei Änderungen der Geschosszahl stabil. Die Firstrichtung folgt der längeren Flügelachse; innere Anschlusskanten erhalten keinen Außenüberstand. Flachdächer berücksichtigen Innenhöfe. Die konkrete Dachkonstruktion kommt weiterhin aus der gemeinsamen WorldEdit/CAD-Berechnung, nicht aus einer zweiten Brush-Dachimplementierung.

Im CAD-Dienst bleiben Traufpfetten bei der Pultberechnung erhalten. Konvexe Walmflächen entstehen durch exakte Ebenenschnitte. Die gemeinsame Live-Berechnung wurde für zehn Dachformen an den Flügelnähten geprüft; unterschiedlich hohe Flügel behalten ihre jeweilige Traufhöhe.

Geschnittene Dachwandzellen schließen die Außenwände bis zur berechneten Dachfläche. Gleich hohe Innenfugen bleiben frei; bei Höhenversatz wird nur der exponierte Anschluss gefüllt. Die Zellen werden bestehenden Wand-/Deckenbesitzern zugeordnet und behalten das Wandmaterial. Dadurch bleiben Vorschau, persistierte Darstellung und einzelner Abbau deckungsgleich. Giebel und Pult wurden jeweils mit sechs/sechs und sieben/sechs Geschossen gegen die echte CAD-Antwort geprüft.

## Gelände und OSM

Die DGM-Pipeline erhält kontinuierliche Eckhöhen als `terrain-cut-cells.v1`. In der obersten angeschnittenen Lage beschreiben zwei Höhenebenen pro Zelle die Oberfläche. Vollständige Zellen darunter bleiben normale Blöcke. Darstellung, Strahltest und Kollision verwenden dieselbe Geometrie. Abbau und Wiederaufbau behalten die normale Chunk-Adresse; eine ausdrücklich platzierte volle Zelle wird nicht erneut auf die alte DGM-Oberfläche zugeschnitten.

Der Schalter **OSM-Geländekarte (Test)** legt die Karte auf die nach oben gerichteten Geländeoberflächen. Er lädt nur einen begrenzten aktuellen Ausschnitt (höchstens 16 Kacheln), erhält Browser-Caching und zeigt die OpenStreetMap-Quellenangabe. Er verändert keine Geländegeometrie.

Die tatsächliche Berliner Datenbeschaffung und die notwendigen Korrekturen in Dashboard/Geoserver sind in `berlin-terrain-data-2026-09-04.md` dokumentiert.

Ältere Snapshots erhalten die neue Terrainbasis nur mit vollständig nachgewiesener Befehlshistorie. Bearbeitete und objektbelegte Zellen sind geschützt. Fehlende Historie lässt das bestehende Gelände unverändert. Lesen schreibt keinen Snapshot in die Datenbank; Lese- und Mutationsadapter verwenden dieselbe Ergänzung. Am Ursprung des vorhandenen Berliner Projekts blieben 432 bearbeitete Zellen und 156 Objekte unverändert.

## Prüfung

Bestehende Tests decken unter anderem 40 reale Berliner Grundstücke und 40 LoD2-Gebäudemodelle ab. Neue Tests prüfen gedrehte Fassaden, nach außen gerichtete Flächen, Dachflügel, gemeinsame Zelleigentümer, Chunk-Neuladen nach Abbau, den Geschossgriff und zugeschnittene Geländeoberflächen. Eine temporäre Browser-Prüfseite verwendet echte CAD-Dachberechnungen und die Produktions-Geometriemodule; ihre Quelle steht in `tests/browser/line_brush_audit.ts`.

`tests/browser/controller_audit.ts` prüft den echten Controller mit isolierter Befehlsquelle: automatisches Speichern beim Werkzeugwechsel, Erhalt beim Ego-Wechsel, genau einen Speichervorgang je Geschossänderung und Rücknahme nach einem absichtlich gescheiterten Speicherversuch. `tests/browser/terrain_audit.ts` zeigt einen tatsächlichen Berliner DGM-Ausschnitt; OSM-Laden und Abbau über den Produktions-Strahltest wurden im Browser geprüft.

Die neuen Prüfungen sind als `test:storey-drag`, `test:building-ownership`, `test:roof-walls` und `test:terrain-surface` in `npm run check` aufgenommen. Editor: 280 unterschiedliche Tests; CAD: 100 Tests; Chunk-Terrain einschließlich Bestandsmigration: 32 Tests; Datenbeschaffung und Höhenindex: 26 Tests erfolgreich. TypeScript und Produktionsbuild wurden zusätzlich geprüft. Die Browser-Fixtures sind in `tests/browser/README.md` beschrieben.

Die separate Browsersitzung war nicht im Benutzerprojekt angemeldet und erhielt stattdessen eine nicht vorbereitete Demo-Welt. Visuelle Prüfung der Geometrie ist deshalb von einer vollständigen Bedienprüfung des angemeldeten Projekts zu unterscheiden.

## Lokale Bereitstellung

Editor, CAD und Chunk wurden mit ihren Änderungen neu gebaut und gestartet und melden `healthy`. Dashboard und GeoServer-Orchestrator sind ebenfalls aus den korrigierten Images gestartet. Der Editor liefert `assets/main-DxqwktqG.js` mit HTTP 200 aus; der ausgelieferte Manifest-Eintrag stimmt mit dem lokalen Produktionsbuild überein. Vorhandene Editorfenster müssen neu geladen werden. Temporäre Browser-Bundles und Prüfcaches wurden entfernt; die Quelltests bleiben erhalten.
