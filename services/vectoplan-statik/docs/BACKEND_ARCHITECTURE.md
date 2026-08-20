# VECTOPLAN Statik - Rechenkern 0.2

Die fachliche Zuordnung neuer Literatur, Rechenmodule und Referenztests ist in `docs/LITERATURE_TRACEABILITY.md` und maschinenlesbar in `src/knowledge/catalog.json` dokumentiert.

## Ziel und Sicherheitsgrenze

Der Rechenkern ist eine deterministische, nachvollziehbare Plattform für
statische Berechnungen. Jede Antwort enthält:

- Eingaberevision und reproduzierbaren Fingerprint,
- ausgewähltes Normprofil und konkrete Regelwerksreferenzen,
- Lastkombinationen mit jedem verwendeten Faktor,
- Solver, Theorie und Anwendungsgrenzen,
- Nachweise mit Einwirkung, Widerstand, Einheit und Ausnutzung,
- Entscheidungen mit Begründung und verworfenen Alternativen,
- Rechenschritte mit Formel, Einsetzungen und Ergebnis,
- die Kennzeichnung `certified: false` und die Pflicht zur Fachprüfung.

Das ist absichtlich keine Behauptung einer zertifizierten, allgemeingültigen
FEM- oder Normnachweissoftware. Ein Modul gilt nur für die Anwendungsgrenzen,
die sein Ergebnis selbst nennt.

## Schichten

```text
API / Referenzfälle / UI
        |
CalculationPipeline
        +-- StandardsRegistry        Normprofil und Entscheidungslogik
        +-- FormulaRegistry          stabile Formeln und Variablenverträge
        +-- CalculationPathRegistry  fachliche Rechenwegmuster
        +-- StructuralPipelineRegistry Bauteil-/Systemabläufe und Freigabegates
        +-- CombinationEngine        GZT/GZG-Kombinationen
        +-- Solver                   Schnittgrößen und Verformungsfelder
        +-- Design modules           Werkstoff- und Bauteilnachweise
        +-- StructuralReportRenderer HTML/PDF-Rechenprotokoll
        +-- Exchange adapters        VECTOPLAN JSON / SAF 2.2
```

Die drei Wissensregister sind persistente JSON-Kataloge. Python wertet ihre
Auswahlregeln und Gates aus, enthält aber keine duplizierten fachlichen
Formeldefinitionen. Der Rohindex der Eurocode-Fundstellen bleibt als
Quellenregister vorgeschaltet und wird nicht direkt ausgeführt.

## Implementierter Rechenumfang

| Bereich | Implementiert | Explizit noch nicht abgedeckt |
|---|---|---|
| Balken/Stäbe | Euler-Bernoulli, linear-elastisch, Ein-, Zwei- und Mehrfeld, Kragarm, Gleichlast | Punktlasten, innere Gelenke, Timoshenko, Theorie II/III, nichtlinear, Dynamik |
| Flächen | Rechteckige, isotrope, vierseitig gelenkige Kirchhoff-Love-Platte als Navier-Reihe; Raster für `w`, `mx`, `my` | Beliebige Geometrie, Öffnungen, Punkt-/Linienlager, Mindlin/Schale, Rissbildung, Kontakt, Orthotropie |
| Stahlbeton | Rechteckquerschnitt: Biegebewehrung, Mindestbewehrung, Querkraft-Betontraganteil, Druckzonenindikation | Vollständige Detailregeln, Durchstanzen, Ermüdung, Brand, Rissbreite, Vorspannung im Gesamtquerschnitt |
| Stahl | Biegung, Querkraft, N-M-Konzeptinteraktion | Querschnittsklasse, Knicken, Biegedrillknicken, Plattenbeulen, Anschlüsse, Ermüdung |
| Holz | Biegung, Schub, Verformung mit explizitem `kmod` | Stabilität, Verbindungen, Brand, Schwingung, Systemeffekte |
| Mauerwerk | Vertikaldruck mit offengelegter Schlankheits-/Exzentrizitätsreduktion | Nichtlineare Scheiben, Knoten, Aussteifung, komplexe Lastverteilung |
| Spannglied | Spannkraft und unmittelbare Verluste aus Reibung, Welligkeit, Schlupf, Relaxation | Kriechen/Schwinden im Gesamtquerschnitt, Umlenkkräfte, Verankerungszonen, Gesamttragwerk |
| Fundament | Sohldruck auf wirksamer Fläche gegen expliziten Baugrundwiderstand | Ermittlung des Baugrundwiderstands, Setzung, Gleiten, Grundbruchmodell, Pfähle |

## Erweiterungspunkte

Neue Solver implementieren dieselbe Ergebnisform: `analysis_type`, `theory`,
`applicability`, `envelope`, `decisions`, `calculation_steps`. Vorgesehene
nächste Adapter sind:

1. 2D-Rahmen und 3D-Stabwerk mit Theorie II. Ordnung,
2. Mindlin-Platten-/Schalen-FEM mit Netzkonvergenz,
3. Stabilität/Eigenformen,
4. Bauzustände und zeitabhängige Betonmodelle,
5. Brücken-Verkehrslastgenerator und Einflusslinien,
6. Ermüdung, Dynamik, Erdbeben und Brand,
7. verifizierte Library-Material- und Querschnittskataloge.

## Eigenständige Viewer-Plugins

`static/statik/plugins/cad-analysis-plugin.js` stellt das flächige Ergebnisraster
dar. `editor-selection-plugin.js` erzeugt eine feste isometrische 3D-Prüfansicht
mit Bauteilauswahl. Beide Plugins werden ausschließlich von
`vectoplan-statik` geladen. Es gibt weiterhin keine Laufzeitverbindung zu CAD,
Editor, Core oder Library.
