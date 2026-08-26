# Selection Tool

## Zweck

Erzeugt einen blockgenauen 3D-Auswahlquader. Nach dem Aufziehen verändern sechs
Flächengriffe Minimum bzw. Maximum der X/Y/Z-Achsen.

## Eingaben

- Linksklick halten: Auswahl beginnen und live aufziehen.
- Linksklick loslassen: Auswahl abschließen.
- Linksklick auf Flächengriff: entsprechende Achse verändern.
- Rechtsklick: letzten Auswahlpunkt entfernen.

## Zustand und Seiteneffekte

Das System besitzt nur `first`, `second` und den transienten Drag-Zustand. Eine
Änderung schreibt erst bei „Ausführen“ über den gemeinsamen WorldEdit-Command.
Es darf weder Raum-, Flurstück- noch Rasterzustand verändern.

## Unterstützte Operationen

`set`, `wall`, `fill`, `replace`, `clear`.

## Regressionen

Geometrie-, Griff- und Top-Grid-Tests für `geometry.ts` liegen in
`tests/parcel_grid_geometry.test.ts`; Systemisolation wird durch
`tests/world_edit_system_registry.test.ts` geprüft.
