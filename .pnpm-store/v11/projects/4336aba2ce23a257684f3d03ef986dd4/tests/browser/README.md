# Geometrie- und Controllerprüfung im Browser

Die drei Browser-Fixtures verwenden die Produktionsmodule in einer isolierten Szene:

- `line_brush_audit.ts`: gedrehtes Gebäude, Dachwahl, unterschiedliche Geschosszahlen und Mausgriff; echte CAD-Berechnung über den Editor-Proxy.
- `controller_audit.ts`: echter WorldEdit-Controller mit lokaler, künstlicher Befehlsquelle. Speichert nichts in Benutzerprojekten. Prüft Werkzeug-/Ego-Wechsel, Abbruch, Speicherfehler und erneutes Laden.
- `terrain_audit.ts`: tatsächlich erzeugter Berliner DGM-Chunk. OSM ist optional; der Abbau verändert nur die geladene Fixture-Kopie.

Vom Editor-Verzeichnis mit dem unterstützten Node-Runtime aus bündeln:

```powershell
npx esbuild tests/browser/line_brush_audit.ts --bundle --format=esm --outfile=static/qa/line-brush-audit.js
npx esbuild tests/browser/controller_audit.ts --bundle --format=esm --outfile=static/qa/controller-audit.js
npx esbuild tests/browser/terrain_audit.ts --bundle --format=esm --outfile=static/qa/terrain-audit.js
```

Je Bundle eine gleichnamige HTML-Datei in `static/qa` anlegen. Beispiel für den Controller:

```html
<!doctype html><html lang="de"><meta charset="utf-8">
<title>Controller-Regression</title>
<link rel="stylesheet" href="./controller-audit.css">
<body><script type="module" src="./controller-audit.js"></script></body></html>
```

Der Editor liefert die Dateien unter `/static/qa/`. Bei einem Editor im Container ohne Quellmount zuerst den erzeugten Ordner in dessen `static`-Verzeichnis kopieren. Die generierten Dateien sind temporäre lokale Prüfartefakte und gehören nicht ins Produktionsimage.

`roof_seam_audit.ts` ist ein Node-Integrationstest für zehn Dachformen. Als ESM mit `--platform=node` bündeln und bei laufendem Editor/CAD-Proxy ausführen. Er prüft die tatsächliche gemeinsame Berechnung an 21 Punkten pro Flügelnaht.

`roof_wall_audit.ts` prüft mit derselben echten CAD-Berechnung die Dachwandfüllung bei Sattel- und Pultdächern mit 6/6 und 7/6 Geschossen. Je Variante müssen 54 Strahlen die Außenwand bis zur strukturellen Dachunterseite treffen; bei einem Höhensprung werden zusätzlich neun Punkte der exponierten Flügelnaht geprüft. Gleich hohe Innenfugen erhalten keine Abschlusswand. Die Füllungen verwenden geschnittene Rasterzellen, dieselbe Geometrie in Vorschau und Speicherung sowie die vorhandene Wand-/Deckenzell-Eigentümerschaft; Wandmaterial und einzelne Abbauadressen bleiben dabei erhalten.

`multi_wing_roof_audit.ts` prüft 24 Varianten für Walm-, Krüppelwalm- und Zeltdächer: vierflügeliges U, schiefes U, Zickzack und einen kurzen Verbinder, jeweils mit gleichen und unterschiedlichen Geschosszahlen. Jede Innenfuge wird an 21 Stellen auf vollständige Abdeckung und konsistente Höhe geprüft; die Firsthöhe muss über der Fuge erhalten bleiben. Der CAD-Vertrag `parameters.continuation_edges_mm` kennzeichnet solche Anschlüsse als fortlaufende Dachflächen. Nur äußere Enden werden abgewalmt. `continuationEdgeIndices` hält beim manuellen Verschieben eines gespeicherten Dachs die Zuordnung zur bearbeiteten Kontur; neue unabhängige Dächer erhalten diese objektbezogene Topologie nicht.

`multi_wing_roof_view.ts` ist die zugehörige Browseransicht mit Dachwahl, vier Grundrissen, wechselnden Geschosszahlen und frei drehbarer Kamera. Sie lässt sich wie die übrigen Sichtfixtures als Browser-ESM bündeln.
