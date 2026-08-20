# WorldEdit-Systeme

Jedes Werkzeug besitzt einen eigenen Ordner und exportiert genau ein
`WorldEditSystem`. Der zentrale `world_edit_controller.ts` ist nur noch der
Composition Root: Er stellt gemeinsame Szene-, Status- und Command-Dienste als
Hooks bereit und dispatcht Eingaben über `registry.ts`.

## Systemvertrag

Jeder Ordner enthält mindestens `system.ts` und `README.md`. `system.ts` besitzt
die Aliase, Texte, erlaubten Operationen, Reichweite, sichtbaren UI-Felder,
Darstellungs-/Drag-Fähigkeiten, Intent-Verarbeitung, Ausführbarkeit, Reset und
Lifecycle des Werkzeugs. Reine, umfangreiche Geometrie gehört als `geometry.ts`
in denselben Ordner. Der Controller darf nur Infrastruktur über typisierte Hooks
anbieten; er entscheidet nicht anhand eines Toolnamens, wie ein Werkzeug arbeitet.

## Stabilitätsregeln

1. Werkzeugabhängige Maus-/Release-Logik gehört ausschließlich in den Ordner
   des Werkzeugs.
2. Titel, Reichweite, sichtbare Felder, Operationen und Reset-Verhalten werden
   durch die jeweilige `ui`-Definition festgelegt.
3. Direkte Abfragen wie `activeTool === "..."` dürfen im zentralen Dispatcher
   nicht neu eingeführt werden.
4. Gemeinsame zustandslose Helfer liegen unter `shared/`; veränderlicher
   Werkzeugzustand bleibt hinter typisierten Hooks.
5. Neue Werkzeuge müssen in `registry.ts` vollständig registriert sein. Die
   Registry schlägt beim Start fehl, wenn ein System fehlt oder doppelt ist.
6. Jede Änderung an einem System benötigt Tests für dessen Intent- und
   Lifecycle-Vertrag.

## Checkliste für Änderungen

1. Nur den Ordner des betroffenen Werkzeugs und ausdrücklich gemeinsame
   Verträge anfassen.
2. Einen neuen Hook nur ergänzen, wenn das System die Funktion nicht über einen
   bestehenden Vertrag anfordern kann.
3. Keine Zustände eines Nachbarsystems im Hook verändern.
4. `npm run test:world-edit-systems`, die betroffene Geometriesuite sowie
   Typecheck und Produktionsbuild ausführen.
5. Im laufenden Editor prüfen, dass Aktivierung, Reset und ein Wechsel zu einem
   Nachbarwerkzeug dessen Darstellung und Zustand unverändert lassen.

## Ordner

| System | Aufgabe |
| --- | --- |
| `selection/` | Quader aufziehen und über sechs Flächen verändern |
| `room/` | persistente semantische Räume erstellen/ändern/löschen |
| `paint/` | Materialpinsel |
| `sculpt/` | Volumen-/Geländepinsel |
| `parcel/` | Flurstücke auswählen und entfernen |
| `parcel_grid/` | Grundstücksraster und Grenzgriffe |
| `ruler/` | Messlinie mit Blockecken-Fang |
| `clipboard/` | Copy, Cut und Paste |
| `shared/` | bewusst geteilte, zustandslose Bausteine |
