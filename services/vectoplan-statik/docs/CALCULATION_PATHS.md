# Rechenweg-Katalog 0.1

Der Rechenweg-Katalog ist die verbindende Wissensschicht zwischen atomarem
Formelkatalog und ausführender Pipeline. Er wird dauerhaft aus
`src/knowledge/calculation_paths.json` geladen und bleibt damit über Neustarts
identisch und versionierbar.

## Fünf getrennte Ebenen

1. **Eurocode-Formelkatalog**: Normfundstellen aus EC1 bis EC9 mit stabiler
   `rule_id`, die zugleich `formula_id` ist. Maschinelle Treffer bleiben bis zur
   fachlichen Kuratierung gesperrt.
2. **Rechenmethoden und Implementierungen**: nichtnormative Mechanik-, Solver-,
   Umrechnungs- und Nachweisbausteine mit Beispiel und Testbezug.
3. **Rechenweg-Katalog**: geordnete Muster mit Auswahlregeln, Normbasis,
   Methodenschritten, Ein-/Ausgaben und Verfahrensvarianten.
4. **Pipeline-Katalog**: ordnet Rechenwege zu Bauteil-, Teilsystem-,
   Gesamttragwerks- und Sonderabläufen mit Phasen und Freigabegates.
5. **Pipeline-Lauf**: wertet Projektfakten aus, wählt passende Pipelines und
   Rechenwege und bindet die tatsächlich erzeugten Laufzeitschritte an die
   Katalogschritte.

## Auswahlregeln statt fachlichem Python-`if/else`

Jeder Rechenweg besitzt deklarative Regeln über Fakten wie:

- `analysis_kind`,
- `design_types`,
- `load_case_categories` und `load_case_action_types`,
- `environmental_action_types`,
- `structure_type`, `material_kind` und `standards_profile`,
- angeforderte Sonderfähigkeiten.

Die Pipeline wertet Operatoren wie `equals`, `contains`, `contains_any`,
`exists`, `greater_than` und `at_least` einheitlich aus. Neue fachliche Pfade
werden dadurch als Daten ergänzt und müssen nicht als unübersichtliche
Sonderverzweigungen in mehreren Modulen dupliziert werden.

## Alte und neue Verfahren

Ein aktueller Pfad kann historische oder zukünftige Alternativen enthalten.
Jede Alternative besitzt eigenen Status, Aktivierungsbedingung, Formelmenge und
Hinweis. `historical_reference` wird niemals automatisch für ein aktuelles
Projekt aktiviert. `incomplete` bleibt auch dann gesperrt, wenn die Formel
bereits als Wissenseintrag vorliegt.

## Harte Abdeckungsregel

`CalculationPathRegistry.coverage()` klassifiziert jede interne Rechenmethode
aus Kompatibilitätsgründen noch unter dem Feldnamen `formula_id` als:

- `executable_path`,
- `documented_reference`,
- `historical_reference`,
- `blocked_incomplete`,
- `reserved` oder
- `unassigned`.

Das organisatorische Gate ist nur erfüllt, wenn
`unassigned_formula_count == 0`. So verschwindet keine interne Rechenmethode
unbemerkt aus der Pipeline. Davon getrennt ist das normative Gate: Es bleibt
gesperrt, solange dem Pfad keine fachlich bestätigten Eurocode-Regel-IDs samt
NA-Overlay und Gültigkeitsgrenzen zugeordnet sind.

Aus den 12.089 Regelstellen werden derzeit 2.747 nach Dokument, Abschnitt und
Thema gruppierte Rechenweg-Kandidaten erzeugt. Sie sind Such- und
Kurationsaufgaben, keine fertigen Rechenwege. Die 69 kuratierten Basismuster
erzeugen 32.946 deterministische Anwendungsvarianten nach Bauwerk, Material,
Bauteil und Berechnungsumfang. Auch diese Varianten erben den normativen
Sperrstatus ihres Basismusters.

## Laufzeitprotokoll

Jedes Ergebnis unter `calculation_plan` enthält:

- die für den konkreten Fall abgeleiteten Fakten,
- ausgewählte und abgelehnte Pfadanzahl,
- die ausgewerteten Auswahlbedingungen,
- pro Schritt Formel, Einsetzung, Ergebnis, Normbezug und Annahmen,
- den Zustand `executed`, `planned` oder `blocked`,
- die Katalogabdeckung zum Zeitpunkt des Laufs.

Damit können HTML-Vorschau, PDF-Bericht und Austauschformat denselben
unveränderten Rechenweg verwenden.

## Routen

```text
GET  /statik/rechenwege
GET  /statik/katalog?bereich=rechenwege
GET  /api/v1/statik/calculation-paths
GET  /api/v1/statik/calculation-paths/coverage
GET  /api/v1/statik/calculation-path-variants
GET  /api/v1/statik/calculation-paths/<path_id>
GET  /api/v1/statik/eurocodes/calculation-path-candidates
POST /api/v1/statik/calculation-paths/plan
```

Der POST-Endpunkt akzeptiert entweder einen vollständigen Analyseauftrag oder
ein Objekt mit `facts` und optionalen `runtime_steps`. Er ist damit auch für
die spätere 2D-/3D-Modellableitung nutzbar.

Die übergeordnete Pipelineebene ist in `docs/PIPELINES.md` beschrieben.
