# Statik-Pipeline-Katalog 0.1

Der Pipeline-Katalog ist die oberste dauerhafte Wissensschicht vor einem
konkreten Rechenlauf. Der Kern wird aus
`src/knowledge/structural_pipelines.json`, die versionierten Fach- und
Typologieergänzungen werden aus
`src/knowledge/structural_pipeline_extensions.json` geladen. Beide enthalten
keine kopierten Formeln. Die verbindliche Kette lautet:

```text
Eurocode-Regel-ID -> fachlich bestätigte Normzuordnung -> Rechenmethode -> Rechenweg-ID -> Pipeline-ID -> Berechnungstemplate -> Laufzeitprotokoll
```

## Warum Eurocode-Regeln und Rechenmethoden getrennt bleiben

Das Eurocode-Register enthält automatisch erkannte Quellenkandidaten aus EC1
bis EC9. Ein Treffer kann ohne fachliche Sichtung unvollständig, aus einem
Nationalen Anhang, einer Berichtigung, einem informativen Anhang oder nur ein
Teil einer mehrstufigen Regel sein. Er darf deshalb nicht unmittelbar rechnen.

Der normative Formelkatalog ist das Eurocode-Register selbst. Eine
Eurocode-Regel wird darin manuell um folgende kuratierte Angaben ergänzt:

- eine stabile `formula_id`,
- eindeutige Variablen-IDs und Einheiten,
- Quelle, Normfamilie und bestätigten Ausgabestand,
- Mindest-, Höchst- und Ausschlussgrenzen,
- verständliche Verarbeitungsschritte und Beispielwerte,
- Implementierungs- und Teststatus.

Die bisherigen 154 Einträge bleiben separat als Rechenmethoden erhalten. Sie
sind technische Umsetzungen und didaktische Herleitungen, aber keine zweite
Normquelle. Ohne diese Trennung könnten Quellenupdates stillschweigend
Pipelineeingaben oder Rechenergebnisse verändern oder eine Lehrbuchformel als
Normtext erscheinen lassen.

## Pipelineaufbau

Jede Pipeline besitzt:

- eine stabile ID und Ebene (`component`, `subsystem`, `structure`, `scenario`
  oder `governance`),
- deklarative Auswahlregeln aus Projektfakten,
- Anwendungsbereiche für Baukörper, Material und Bauteil,
- geordnete Phasen,
- Pflicht- und bedingte Rechenwege je Phase,
- ein explizites Gate je Phase,
- abgeleitete Variablen, Normbezüge, Ausgaben und Prüfschritte.

Pflichtpfade müssen für den Projektfall gewählt und ausführbar sein. Bedingte
Pfade werden nur aktiv, wenn ihre eigenen Rechenwegregeln zutreffen. Ein
gewählter Rechenweg mit Status `incomplete` erzeugt einen sichtbaren Blocker.

## Abdeckung

`StructuralPipelineRegistry.coverage()` prüft, dass jeder Rechenweg mindestens
einen festen Platz in einer Pipeline besitzt. Der Katalog umfasst derzeit
Bauteile, Geschosse, Hallendächer, vollständige Wohn-/Bürogebäude,
Industriehallen, Brücken, Sondertragwerke sowie Erdbeben-, Brand-,
Lebensdauer- und Freigabeabläufe.

Die Abdeckung bedeutet, dass kein Rechenweg organisatorisch verloren geht. Sie
bedeutet ausdrücklich nicht, dass jeder reservierte Rechenweg bereits
ausführbar oder normativ freigegeben ist.

Die 14 Pipeline-Basismuster und das erste Fach-Erweiterungspaket ergeben
derzeit 54 Pipeline-Templates und 978 konkrete Varianten für die deklarativ
hinterlegten Kombinationen aus Bauwerk, Material und Umfang. Das Paket enthält:

- Stand-, Hänge-, Trag-/Schalungsgerüste und Gerüstverankerungen,
- ein gesperrtes Lückenregister für noch nicht ausmodellierte Sondergerüste,
- Brückenüberbau, Widerlager, Pfeiler, Lager, Endquerträger, Kammerwand,
  Übergangskonstruktion, Unterbau/Gründung, Bauzustände und Rückhaltesysteme,
- zehn Brückentypologien sowie 13 Hochbau-Typologien,
- gesperrte Auffangregister für unklassifizierte Brückenbauteile und
  Hochbau-Sondernutzungen.

Eine Variante ist kein neuer unabhängiger Solver und kein geprüfter Nachweis.
Sie erbt alle Blocker aus ihren Rechenwegen und aus dem Normprogramm. Ergänzende
Gerüst-, Lager-, Produkt-, Betreiber- oder Ausführungsnormen bleiben dabei
bewusst getrennt vom Eurocode und bis zur manuellen Zuordnung gesperrt.

## Laufzeit und API

Jedes Analyseergebnis enthält neben `calculation_plan` nun `workflow_plan` mit
den ausgewählten Pipelines, Phasen, aktiven Rechenwegen und Blockern.

```text
GET  /statik/katalog?bereich=pipelines
GET  /api/v1/statik/pipelines
GET  /api/v1/statik/pipelines/coverage
GET  /api/v1/statik/pipeline-variants
GET  /api/v1/statik/pipelines/<pipeline_id>
POST /api/v1/statik/pipelines/plan
```

Der POST-Endpunkt akzeptiert einen Analyseauftrag oder explizite `facts`. Damit
kann die spätere CAD-/Editor-Integration zunächst Projektfakten erzeugen und
vor jeder numerischen Berechnung sichtbar prüfen, welche Pipeline und welche
Rechenwege aktiviert oder blockiert würden.

## Berechnungstemplates

`src/report_templates/pipeline_bindings.json` ordnet jedem der 28
Berechnungstemplates konkrete Pipeline-IDs zu. Die Beziehung wird in beide
Richtungen ausgeliefert: Ein Template zeigt seine Pipelines, und eine Pipeline
verweist auf alle verwendenden Templates. Offene Rechenweg- oder Norm-Gates
bleiben dabei offen; eine HTML-Ausgabe kann keine fachliche Freigabe erzeugen.

Jedes Template liefert außerdem einen deklarativen Visualisierungsplan für
System, Lastpfad, Einwirkungen und Ergebnisse. Die Vorschau rendert daraus
automatisch Inline-SVG-Grafiken und zeigt sechs fortlaufende Blätter ohne
manuelle Zoom- oder Seitenumschaltung. Persistente Vorschaufälle für ein
Wohngebäude, ein Hochhaus, eine Straßenbrücke und eine Industriehalle liegen
in `src/report_templates/test_cases.json`.

```text
GET /statik/katalog?bereich=berechnungstemplates
GET /statik/ausgabevorlagen
GET /api/v1/statik/report-template-test-cases
GET /api/v1/statik/report-template-test-cases/<case_id>
```
