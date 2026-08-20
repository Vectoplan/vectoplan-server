# Paint Brush

## Zweck

Wendet Material blockweise mit Form, Radius, Dichte und Wandstärke an.

## Eingaben

- Linksklick: aktive Operation mit dem gewählten Material anwenden.
- Rechtsklick: denselben Pinsel als `clear` ausführen.

## Operationen

`set`, `wall`, `fill`, `replace`, `clear`.

## Isolation

Paint besitzt nur ein transientes Pinselziel. Es liest die gemeinsame Hotbar-
Platzierung, darf aber weder Selection-Punkte noch Räume oder Flurstücke ändern.
Die gemeinsame Brush-Intent-Basis ist zustandslos und liegt unter `shared/`.
