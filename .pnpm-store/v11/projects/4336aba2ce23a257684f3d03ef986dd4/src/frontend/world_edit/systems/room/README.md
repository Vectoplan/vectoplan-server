# Räume

## Zweck

Erstellt persistente semantische Raum-Footprints aus beliebigen geraden,
nicht selbst schneidenden Polygonen.

## Eingaben

- Linksklick: Block-Eckpunkte der Raumkontur setzen.
- Ersten Punkt erneut anklicken, `ESC` oder `Enter`: Kontur schließen und speichern.
- Linksklick auf einen gelben Punkt halten: Punkt blockweise verschieben.
- Linksklick auf bestehenden Raum: dessen exaktes Polygon zur Bearbeitung laden.
- Rechtsklick auf bestehenden Raum: ausschließlich diesen Raum löschen.
- Rechtsklick ins Leere: nur die aktuelle Raumauswahl zurücksetzen.

## Persistenz

Räume verwenden `PlaceObject` mit `objectTypeId: space_room`, einem Polygon im
Koordinatenraum `world-cell-xz` und stabiler `objectInstanceId`. Löschen nutzt
`RemoveObject`. Andere WorldEdit-Systeme dürfen diese IDs nicht verändern.

## Abhängigkeiten

Gemeinsam mit dem Dachwerkzeug wird nur die zustandslose Polygongeometrie aus
`../polygon_area/` genutzt. Interaction-State, Command-Ausführung und
Raum-Metadaten bleiben im Room-Adapter.
