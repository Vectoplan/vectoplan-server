# Tentacle Brush

Der Tentacle Brush besitzt absichtlich einen eigenen Eingabe-, Vorschau- und Ausführungspfad. Er verändert keine Selection-, Raum-, Flurstück- oder Clipboard-Zustände.

## Bedienung

- Ein kurzer Linksklick setzt exakt einen Stützpunkt; erst nach 180 ms Haltezeit werden weitere Punkte gesammelt.
- Zwei Punkte ergeben eine gerade Strecke.
- Ab drei Punkten wird eine Catmull-Rom-Kurve berechnet.
- `ESC`: Pfad abschließen.
- Ein anvisierter Stützpunkt leuchtet gelb auf.
- Einen vorhandenen Stützpunkt anvisieren und mit Linksklick ziehen: Kurve live ändern.
- Einen vorhandenen Stützpunkt anvisieren und mit Rechtsklick anklicken: Punkt löschen.
- Rechtsklick außerhalb eines Stützpunkts oder **Ausführen**: abgeschlossene Kurve mit der aktuellen Brush-Form und dem Radius anwenden.
- `set`, `fill`, `replace`, `wall` bauen entlang des Pfads; `clear` schneidet einen Tunnel.

## Erweiterungspunkte

`geometry.ts` ist rein und enthält Kurvensampling/Voxelisierung. Form und Radius werden als Command-Variablen übertragen. Spätere Profile, Querschnitte, Banking, Straßenregeln oder Tunnel-Auskleidungen können deshalb ergänzt werden, ohne andere WorldEdit-Systeme zu ändern.
