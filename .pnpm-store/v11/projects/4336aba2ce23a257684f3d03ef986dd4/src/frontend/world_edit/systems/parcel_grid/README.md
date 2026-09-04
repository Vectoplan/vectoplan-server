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

Für bebaute Flurstücke konsumiert `building_reference.ts` bevorzugt den vom
Chunk-Service validierten Vertrag `vectoplan-lod2-construction-grid.v1`. Die
Außenkante der Bestandsfassade besitzt die Vollzellen; der verbleibende Bereich
wird von derselben Referenzachse aus partitioniert. Der Legacy-Fallback darf nur
bei fehlendem Vertrag greifen und muss dieselben deterministischen Owner-Regeln
einhalten.

## Schutzregeln

Ein Aktivieren/Deaktivieren darf nur die Rasterdarstellung neu aufbauen. Ein
Reset löscht Guide/Bauachse, niemals die Flurstückauswahl. Geometrieänderungen
benötigen die vollständige Parcel-Grid-Testsuite. Dach-, Linien-Brush- und
Geschosswerkzeuge dürfen keine eigene konkurrierende Rasterausrichtung erzeugen.

Pflichtprüfungen: `npm run test:parcel-grid`,
`npm run test:berlin-parcel-grid` und `npm run typecheck`.
