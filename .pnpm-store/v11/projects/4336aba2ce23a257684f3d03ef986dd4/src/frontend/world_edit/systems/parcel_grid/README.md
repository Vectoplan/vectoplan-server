# Grundstücksraster

## Zweck

Erzeugt die blockgenaue Partition innerhalb ausgewählter Flurstücke und bietet
Griffe für Grenzrichtung, Schrägzonentiefe und Bauachse.

## Eingaben

- Linksklick auf Grenze: aktive Grenzkante wählen.
- Linksklick halten auf Griff: Tiefe blockweise ziehen.
- Loslassen: Zustand persistieren.
- Rechtsklick: innere Linie um einen Block nach außen bewegen.

## Abhängigkeiten

Dieses System liest ausschließlich die veröffentlichte Flurstückauswahl. Seine
Geometrie liegt in `geometry.ts`; persistierte Guides verwenden
`vectoplan-parcel-grid-state.v1`.

## Schutzregeln

Ein Aktivieren/Deaktivieren darf nur die Rasterdarstellung neu aufbauen. Ein
Reset löscht Guide/Bauachse, niemals die Flurstückauswahl. Geometrieänderungen
benötigen die vollständige Parcel-Grid-Testsuite.
