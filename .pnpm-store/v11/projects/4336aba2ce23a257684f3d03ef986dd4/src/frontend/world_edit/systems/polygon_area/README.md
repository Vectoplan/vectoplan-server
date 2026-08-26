# Gemeinsame Polygonbereiche

Dieser Ordner enthält ausschließlich zustandslose Geometrie für gerade,
geschlossene WorldEdit-Polygone. Dach- und Raumwerkzeug verwenden dieselben
Validierungs-, Flächen-, Footprint- und Bounds-Funktionen, besitzen aber getrennte
Interaction-States und getrennte Persistenzpfade.

Ein Polygon ist gültig, wenn es mindestens drei verschiedene Punkte, eine
Fläche größer null und keine Selbstüberschneidung besitzt. Der letzte Punkt wird
im Arbeitszustand nicht dupliziert; erst der Footprint-Export schließt den Ring.
