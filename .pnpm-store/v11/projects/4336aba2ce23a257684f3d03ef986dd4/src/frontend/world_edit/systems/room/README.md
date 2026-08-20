# Räume

## Zweck

Erstellt persistente semantische Raum-Footprints. Das Aufziehen entspricht dem
Selection Tool, beim Loslassen wird der Raum automatisch gespeichert.

## Eingaben

- Linksklick halten/loslassen: neuen Raum aufziehen und speichern.
- Linksklick auf bestehenden Raum: Raum zur Bearbeitung laden.
- Rechtsklick auf bestehenden Raum: ausschließlich diesen Raum löschen.
- Rechtsklick ins Leere: nur die aktuelle Raumauswahl zurücksetzen.

## Persistenz

Räume verwenden `PlaceObject` mit `objectTypeId: space_room`, einem Polygon im
Koordinatenraum `world-cell-xz` und stabiler `objectInstanceId`. Löschen nutzt
`RemoveObject`. Andere WorldEdit-Systeme dürfen diese IDs nicht verändern.

## Abhängigkeiten

Gemeinsam mit Selection werden nur Quaderdarstellung und Flächengriffe genutzt.
Command-Ausführung und Raum-Metadaten bleiben im Room-Adapter.
