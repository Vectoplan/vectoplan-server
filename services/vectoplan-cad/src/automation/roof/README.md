# Parametrische Dachberechnung

Dieses Modul bildet die JSON-Grundlage für automatisch platzierbare Dächer.

Unterstützte Dachformen:

- Flachdach
- Satteldach
- Walmdach
- Krüppelwalmdach
- Pultdach
- Mansarddach
- Trapezdach mit Plateau
- Schmetterlingsdach
- Zelt-/Pyramidendach
- Tonnendach (segmentierte Rundung)
- Sheddach/Sägezahndach

Berechnet werden Dachüberstandsfläche, Dachflächen, Dachhaut, Höhen, Sparren und Pfetten. Dachneigung, Traufhöhe, Dachhautdicke, Sparren-/Pfettenquerschnitte und jeder einzelne Dachüberstand sind Parameter. Jede Änderung führt über dieselbe zustandslose Funktion zu einem neuen JSON-Ergebnis und Fingerprint.

Die Höhenreferenz des gesamten Dachs ist die Oberkante der Dachzone: Nach der Tragwerksberechnung wird das vollständige Dach so normiert, dass die Unterkante der niedrigsten Pfette exakt auf `parameters.eaves_height_mm` liegt. Diese Regel gilt für jede Dachform sowie unabhängig von Neigung und Überstand; Sparrenauflager, Kerven und Dachaufbau werden gemeinsam verschoben und bleiben dadurch geometrisch konsistent.

API: `POST /api/v1/cad/automation/roof/calculate`

Rechteckige Konturen behalten aus Kompatibilitätsgründen `geometry_method: parametric-envelope-v1`. Beliebige einfache, auch konkave Konturen werden als `polygon-clipped-v2` trianguliert, an den Profilknicken der gewählten Dachart geschnitten und dort mit passenden Höhen versehen. Sparren und Pfetten werden ebenfalls gegen die tatsächliche Kontur geschnitten. Selbstüberschneidende Konturen werden abgewiesen; ein geometrisch mehrdeutiger Überstands-Offset fällt mit einer Warnung auf die unveränderte Ausgangskontur zurück.
