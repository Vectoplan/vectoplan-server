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

API: `POST /api/v1/cad/automation/roof/calculate`

Rechteckige Konturen behalten aus Kompatibilitätsgründen `geometry_method: parametric-envelope-v1`. Beliebige einfache, auch konkave Konturen werden als `polygon-clipped-v2` trianguliert, an den Profilknicken der gewählten Dachart geschnitten und dort mit passenden Höhen versehen. Sparren und Pfetten werden ebenfalls gegen die tatsächliche Kontur geschnitten. Selbstüberschneidende Konturen werden abgewiesen; ein geometrisch mehrdeutiger Überstands-Offset fällt mit einer Warnung auf die unveränderte Ausgangskontur zurück.
