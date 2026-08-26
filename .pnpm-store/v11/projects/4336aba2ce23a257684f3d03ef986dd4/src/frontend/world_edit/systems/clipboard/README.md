# Gemeinsame Clipboard-Geometrie

## Zweck

Dieser Ordner enthält die zustandslosen Geometrie- und Farbhelfer für zwei getrennt registrierte Werkzeuge:

- `../copy_paste/`: Kopieren und Einfügen
- `../cut_paste/`: Ausschneiden und Einfügen

## Bedienung

1. `select`: Bereich wie mit dem Selection Tool markieren und skalieren.
2. Rechtsklick: `copy` oder `cut` ausführen und die Blockdaten übernehmen.
3. `move`: Die rote X-, grüne Y- oder blaue Z-Achse des zentralen Gizmos mit
   Linksklick halten und die transparente Blockvorschau blockweise bewegen.
4. Rechtsklick: Vorschau an der aktuellen Position einfügen.

Der Rechtsklick wird primär beim Drücken verarbeitet. Falls Pointer Lock das
Down-Ereignis verliert, übernimmt das Release-Ereignis die Bestätigung. Eine
Down/Up-Verriegelung verhindert dabei doppelte Copy-, Cut- oder Paste-Befehle.

Copy/Paste und Cut/Paste ignorieren die gemeinsame Flurstücksmaske bewusst.
Markieren, Ausschneiden und Einfügen funktionieren deshalb auch vollständig
außerhalb eines ausgewählten Grundstücks. Erst nach einem vom Server
bestätigten Paste wird die Vorschau geschlossen; bei Fehlern bleiben Vorschau
und Gizmo für einen erneuten Versuch erhalten.

## Zustand

Die Interaction-State-Machines sind absichtlich nicht zusammengeführt. So kann
eine Änderung an Copy/Paste nicht unbemerkt das Cut-Werkzeug umschalten.
`system.ts` ist nur noch ein nicht registrierter Legacy-Adapter.

## Operationen

Die Backend-Operationen bleiben `copy`, `cut` und `paste`; die Auswahl der
Capture-Operation ist im jeweiligen Werkzeugsystem fest verdrahtet.

## Antwortverarbeitung

`response.ts` normalisiert sowohl die produktive, direkte Chunk-Antwort als
auch den älteren `{ result: ... }`-Wrapper. Erst wenn die zurückgegebenen
Clipboard-Zellen sicher gelesen wurden, wechselt das Werkzeug von `select`
nach `move` und baut das X/Y/Z-Gizmo auf. Die DOM-Diagnosefelder
`data-world-edit-clipboard-phase`, `-cells` und `-gizmo-handles` machen diesen
Übergang auch in F8-Aufzeichnungen eindeutig prüfbar.
