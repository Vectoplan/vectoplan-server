# Parametrisches Dach

## Bedienung

- Linksklick setzt gerade verbundene Block-Eckpunkte.
- Erneuter Klick auf den ersten Punkt, `ESC` oder `Enter` schließt das Polygon.
- Erst ein gültiger, nicht selbst schneidender Ring erhält eine farbige Fläche.
- Anvisierte Punkte leuchten gelb und können mit gehaltenem Linksklick verschoben werden.
- Rechtsklick auf einen Punkt löscht ihn; Rechtsklick außerhalb oder **Ausführen** persistiert das berechnete Dach.

## Berechnung und Persistenz

`contracts.ts` übersetzt World-Zellen in den Vertrag
`cad-roof-calculation-request/0.1` und ruft
`POST /api/v1/cad/automation/roof/calculate` auf. Das Resultat enthält Dachhaut,
Sparren und Pfetten und wird sowohl für die Live-Vorschau als auch als Metadatum
eines `PlaceObject` mit `objectTypeId: building_roof` verwendet. Dadurch kann die
Scene dieselbe berechnete Geometrie nach einem Chunk-Reload reproduzieren.
