# Parametrisches Dach

## Schutzvertrag

Dieser Ordner besitzt die komplette Dach-Fachlogik. `contracts.ts` definiert
Parameter und Request, `imported.ts` rekonstruiert die originale LoD2-Form,
`restoration.ts` stellt die gespeicherte Importquelle verlustfrei wieder her,
`courtyard.ts` hält Innenhöfe offen, `zones.ts` steuert Fingerprint und
Vorschau-Lebenszyklus, `quick_settings.ts` bildet nur die Bedienoberfläche ab.

- Ein importiertes Dach muss über `roofType: "imported"` und die unveränderte
  `lod2-roof-source.v1`-Quelle exakt auf LoD2 zurückstellbar bleiben.
- `restoreImportedRoofOriginal()` übernimmt Referenzneigung und Basishöhe aus
  der Importquelle, setzt die Ausrichtung auf `auto` und entfernt alle
  Überstände. Aufbauparameter und `importedSource` bleiben erhalten.
- Footprints enthalten den Außenring an Position 0 und danach sämtliche
  Innenhofringe. Kein Adapter darf nur `coordinates[0]` persistieren.
- Die Scene darf eine optimistische Berechnung erst entfernen, wenn der Chunk
  denselben Berechnungs-Fingerprint bestätigt.
- Dieser Ordner berechnet kein Grundstücksraster und schaltet keine Kameraansicht.

Änderungen benötigen mindestens `npm run test:lod2-buildings`, insbesondere
`lod2_roof_editing.test.ts` und `lod2_roof_details.test.ts`, sowie
`npm run typecheck`.

## Bedienung

- Linksklick setzt gerade verbundene Block-Eckpunkte.
- Erneuter Klick auf den ersten Punkt, `ESC` oder `Enter` schließt das Polygon.
- Erst ein gültiger, nicht selbst schneidender Ring erhält eine farbige Fläche.
- Anvisierte Punkte leuchten gelb und können mit gehaltenem Linksklick verschoben werden.
- Rechtsklick auf einen Punkt löscht ihn; Rechtsklick außerhalb oder **Ausführen** persistiert das berechnete Dach.
- Nach dem Schließen erscheint im Flächenzentrum ein Zahnrad. Linksklick öffnet die visuelle Dachformwahl; die Dachneigung wird dort ohne Texteingabe mit dem Mausrad in ganzen Grad geändert. Beim erneuten Öffnen werden Dachform und Neigung aus der tatsächlich gespeicherten 3D-Berechnungsanfrage geladen. Beim Schließen mit **Fertig** oder **×** wird die Vorschau atomar gespeichert, das vorherige Tragwerk ersetzt und die Kontur für die nächste Dachzone freigegeben.
- Nach erfolgreichem Speichern wird die aktive Kontur freigegeben, sodass unmittelbar weitere unabhängige Dachzonen gezeichnet werden können. Alle gespeicherten Dachzonen behalten eine sichtbare Hintergrundfläche und ein eigenes Zahnrad; über Fläche oder Zahnrad wird genau dieses Dach wieder zur Bearbeitung geladen.

## Berechnung und Persistenz

`contracts.ts` übersetzt World-Zellen in den Vertrag
`cad-roof-calculation-request/0.1` und ruft
`POST /editor/api/cad/automation/roof/calculate` auf. Das Resultat enthält Dachhaut,
Sparren und Pfetten und wird sowohl für die Live-Vorschau als auch als Metadatum
eines `PlaceObject` mit `objectTypeId: building_roof` verwendet. Dadurch kann die
Scene dieselbe berechnete Geometrie nach einem Chunk-Reload reproduzieren.
Beim Speichern bleibt diese erfolgreiche Vorschau sichtbar, bis die Scene exakt
denselben Berechnungs-Fingerprint aus dem aktualisierten Chunk geladen hat. Eine
kurzzeitig noch gelieferte Altversion wird dabei verborgen.

Das Modell trennt die Tragwerksebene von der äußeren Dachfläche. Sparren liegen
vollständig unter Schalung und Unterdeckung, Pfetten erhalten an jedem Auflager
eine 30-mm-Kerve. Standardwerte sind 650 mm Sparrenraster, 200 mm Sparrenhöhe
(zulässig 180–240 mm) und Pfetten 140 × 200 mm. Eine Mittelpfette wird erst
oberhalb der konfigurierten Spannweite erzeugt.
Die Unterkante der niedrigsten Pfette liegt immer exakt auf der Oberkante der
Dachzone. Ältere Berechnungen ohne diese Höhenreferenz werden beim Öffnen der
Dacheinstellungen automatisch neu berechnet.

`roof_build_up` beschreibt Dämmung, Schalung, Unterdeckbahn, Konterlattung,
Traglattung und Dachziegel. `insulation_mode` unterstützt `between` (Standard),
`below` und `above`; CAD und WorldEdit übergeben diese Werte an dieselbe
Berechnung.
