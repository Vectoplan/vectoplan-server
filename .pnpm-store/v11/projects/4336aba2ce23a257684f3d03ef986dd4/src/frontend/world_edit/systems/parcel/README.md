# Flurstückauswahl

## Zweck

Wählt WFS-Flurstücke anhand des 3D-Fadenkreuzes projektweit aus oder entfernt
sie aus der Auswahl.

## Eingaben

- Linksklick: genau das getroffene Flurstück hinzufügen.
- Rechtsklick: genau das getroffene, bereits ausgewählte Flurstück entfernen.
- Release-Ereignisse verändern keinen Zustand.

## Geometrie und Projektion

WFS-Polygone bleiben als Polygon/MultiPolygon erhalten. Treffer und Darstellung
verwenden die kanonische periodische Earth-Grid-Transformation aus
`utils/earth_grid_coordinates.ts`; eine lokale Meter-pro-Längengrad-Skalierung
ist verboten, weil sie nicht zu den vom Chunk-Service gerenderten Grenzen passt.

## Seiteneffekte

Nur `parcels` und der lokale Katalog-Cache dürfen geändert werden. Das
Grundstücksraster wird über den gemeinsamen Auswahlvertrag anschließend neu
aufgebaut; Raum- und Selection-Zustand bleiben unangetastet.
