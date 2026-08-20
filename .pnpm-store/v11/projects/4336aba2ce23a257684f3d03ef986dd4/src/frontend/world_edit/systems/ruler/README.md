# Messwerkzeug

## Zweck

Misst die 3D-Distanz und die Achsanteile ΔX/ΔY/ΔZ zwischen zwei Punkten.

## Eingaben

- Linksklick halten: ersten Punkt setzen und zweiten Punkt live ziehen.
- Loslassen: Messung abschließen.
- Rechtsklick: ausschließlich die Messung löschen.

## Fangfunktion

Treffer nahe einer Blockecke rasten auf exakte Voxel-Ecken. Auf der Flächenmitte
bleibt die Messung frei. Das System führt keine Chunk-Commands aus und darf keine
anderen WorldEdit-Zustände persistieren.
