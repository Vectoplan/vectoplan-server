# Geschoss

## Zweck und Grenze

Das Geschosswerkzeug verändert einen bereits erzeugten Linien-Brush-Baukörper
vollständig oder segmentweise. `system.ts` besitzt Tool-Lifecycle und Auswahl,
`quick_settings.ts` besitzt ausschließlich die UI für Scope und Delta.

Das System schreibt keine Blöcke, Dächer oder Raster direkt. Es übergibt den
gewählten Scope (`all` oder `segment:<index>`) und die Änderung über den Hook
`adjustStoreys`; der WorldEdit-Controller regeneriert daraus denselben
`planning_build_area`-Vertrag atomar. Dadurch bleiben Außenwände, Decken und Dach
als zusammengehöriger Baukörper konsistent.

## Schutzregeln

- Keine eigene Dach- oder Grundstücksrasterberechnung in diesem Ordner.
- Keine Änderung fremder LoD2-/CAD-Objekte ohne einen expliziten semantischen
  Geschossvertrag.
- Keine Einzelplatzierung von Kindobjekten; Regeneration bleibt ein
  `ObjectBatch`.
- Das Werkzeug ist in Ego und Planung verfügbar und darf beim Aktivieren die
  Kameraansicht nicht wechseln.
- Die semantische Geschosshöhe kommt aus dem Linien-Brush-Programmvertrag und
  darf nicht als gerundete Blockhöhe überschrieben werden.

Pflichtprüfungen: `npm run test:storey-system`,
`npm run test:building-geometry`, `npm run test:workspace-modes`,
`npm run test:chunk-command-result` und `npm run typecheck`.
