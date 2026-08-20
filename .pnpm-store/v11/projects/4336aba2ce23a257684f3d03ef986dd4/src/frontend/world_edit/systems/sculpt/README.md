# Sculpt Brush

## Zweck

Bearbeitet Gelände bzw. Volumen über denselben begrenzten Brush-Command wie der
Paint Brush, bleibt aber als eigenständiges Inventar- und UI-System registriert.

## Eingaben

- Linksklick: Sculpt-Operation anwenden.
- Rechtsklick: Volumen mit derselben Form entfernen.

## Isolation

Sculpt besitzt einen eigenen Systemordner und eigene Registry-Identität. Nur der
zustandslose Maus-zu-Brush-Adapter wird mit Paint geteilt. Änderungen an
Reichweite, Aliasen, UI oder Lifecycle müssen hier erfolgen und beeinflussen
Paint dadurch nicht automatisch.
