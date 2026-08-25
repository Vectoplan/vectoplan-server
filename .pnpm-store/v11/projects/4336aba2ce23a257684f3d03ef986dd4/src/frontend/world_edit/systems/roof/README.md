# Parametrisches Dach

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

Das Modell trennt die Tragwerksebene von der äußeren Dachfläche. Sparren liegen
vollständig unter Schalung und Unterdeckung, Pfetten erhalten an jedem Auflager
eine 30-mm-Kerve. Standardwerte sind 650 mm Sparrenraster, 200 mm Sparrenhöhe
(zulässig 180–240 mm) und Pfetten 140 × 200 mm. Eine Mittelpfette wird erst
oberhalb der konfigurierten Spannweite erzeugt.

`roof_build_up` beschreibt Dämmung, Schalung, Unterdeckbahn, Konterlattung,
Traglattung und Dachziegel. `insulation_mode` unterstützt `between` (Standard),
`below` und `above`; CAD und WorldEdit übergeben diese Werte an dieselbe
Berechnung.
