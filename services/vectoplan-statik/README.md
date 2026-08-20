# VECTOPLAN Statik 0.2

`vectoplan-statik` ist ein eigenständiger Flask-Microservice für nachvollziehbare
Tragwerksberechnungen. Die Oberfläche kombiniert eine 2D-Systemansicht, eine
flächige Ergebnisdarstellung und eine feste 3D-Auswahlansicht. Der Dienst hat
weiterhin keine Laufzeitverbindung zu `vectoplan-core`, `vectoplan-cad`,
`vectoplan-editor`, `vectoplan-library` oder `vectoplan-energie`.

Lokaler Einstieg:

```text
http://localhost:5111/statik
```

## Sicherheitsgrenze

Der Rechenkern liefert reproduzierbare Vorbemessungen mit Normprofil,
Entscheidungsprotokoll, Formeln, Einsetzungen, Einheiten und Anwendungsgrenzen.
Jedes neue Ergebnis bleibt mit `certified: false` und `verified: false`
gekennzeichnet. Es ersetzt weder die fachliche Prüfung noch einen prüffähigen
Standsicherheitsnachweis.

## Implementierter Umfang

- Euler-Bernoulli-Balken für Ein-, Zwei- und Mehrfeldsysteme sowie Kragarme
  unter Gleichlast,
- rechteckige, isotrope und vierseitig gelenkig gelagerte Platten nach der
  Navier-Reihe mit Ergebnisraster für Verformung und Momente,
- orthogonales Plattenrost für Öffnungen, Linien- und Punktlager,
  richtungsabhängige Biegesteifigkeit, vertikale Federn, Druckkontakt und
  rissbedingte Sekanteniteration,
- ebene Fachwerke mit Knotenlasten, Stabkräften, Verformungen und
  Auflagerreaktionen,
- Lastkombinationen für GZT und GZG mit offengelegten Faktoren,
- nachvollziehbare Eigenlast-, Schneelast- und Winddruckketten mit expliziten
  Projektbeiwerten, Formeln, Einsetzungen und Anwendungsgrenzen,
- erste Nachweismodule für Stahlbeton, Stahl, Holz, Mauerwerk, Spannglieder und
  Einzelfundamente,
- abgegrenzte Sondernachweise für elastische Stabstabilität, konstante
  Ermüdungsschwingbreite, explizit reduzierten Brandwiderstand und sequenzielle
  Bauzustandswirkungen,
- versionierte Normprofile und begründete Auswahl der Eurocode-Familien,
- projektweite Rechenpipeline mit Lastpfad, Fähigkeitsmatrix,
  Literatur-/Formelkatalog sowie editierbarer HTML-Rechenakte und gegliedertem
  PDF-Gesamtbericht,
- neutrales VECTOPLAN-Austauschformat und SAF-2.2-Excel-Export,
- acht ausführbare Referenzfälle und analytische Regressionstests,
- eigenständiges 2D-Ergebnis-Plugin und 3D-Auswahl-Plugin ausschließlich für
  diesen Service.

Die genaue Abgrenzung pro Rechenmodul steht in
[`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md). Normauswahl,
Austausch und Validierungsstrategie sind unter `docs/` dokumentiert.

## Routen

### Oberfläche und Betrieb

```text
GET /                         -> Redirect auf /statik
GET /statik                   -> Vollbild-Arbeitsfläche
GET /statik/katalog           -> Gemeinsame Oberfläche mit Eurocode-, Rechenweg-, Pipeline-, Methoden- und Berechnungstemplate-Tabs
GET /statik/katalog?bereich=berechnungstemplates -> Pipelinegebundene Berechnungstemplates
GET /statik/ausgabevorlagen   -> Direkte HTML-Bibliothek mit fortlaufender Sechs-Blatt-Vorschau
GET /statik/berichtsvorlagen  -> Alias der HTML-Bibliothek
GET /statik/formelkatalog     -> Redirect auf /statik/katalog?bereich=eurocodes
GET /statik/formelkatalog/eurocodes -> Redirect auf /statik/katalog?bereich=eurocodes
GET /statik/methoden          -> Redirect auf /statik/katalog?bereich=methoden
GET /statik/rechenwege        -> Redirect auf /statik/katalog?bereich=rechenwege
GET /statik/pipelines         -> Redirect auf /statik/katalog?bereich=pipelines
GET /health
GET /health/live
GET /ready
GET /health/ready
```

### Berechnung und Kataloge

```text
GET  /api/v1/statik/status
GET  /api/v1/statik/bootstrap
GET  /api/v1/statik/profiles
GET  /api/v1/statik/materials
GET  /api/v1/statik/standards
GET  /api/v1/statik/literature
GET  /api/v1/statik/report-templates
GET  /api/v1/statik/report-templates/schema
GET  /api/v1/statik/report-templates/outline-schema
GET  /api/v1/statik/report-section-templates
GET  /api/v1/statik/report-templates/<id>
GET  /api/v1/statik/report-templates/<id>/outline?variant=regelfall
POST /api/v1/statik/report-templates/<id>/outline
GET  /api/v1/statik/report-template-test-cases
GET  /api/v1/statik/report-template-test-cases/<case_id>
GET  /api/v1/statik/formulas
GET  /api/v1/statik/formulas/<formula_id>
GET  /api/v1/statik/formula-variables
GET  /api/v1/statik/formulas/<formula_id>/variables
GET  /api/v1/statik/implementation-methods
GET  /api/v1/statik/implementation-methods/<method_id>
GET  /api/v1/statik/implementation-variables
GET  /api/v1/statik/calculation-paths
GET  /api/v1/statik/calculation-paths/coverage
GET  /api/v1/statik/calculation-path-variants
GET  /api/v1/statik/calculation-paths/<path_id>
POST /api/v1/statik/calculation-paths/plan
GET  /api/v1/statik/pipelines
GET  /api/v1/statik/pipelines/coverage
GET  /api/v1/statik/pipeline-variants
GET  /api/v1/statik/pipelines/<pipeline_id>
POST /api/v1/statik/pipelines/plan
GET  /api/v1/statik/eurocodes
GET  /api/v1/statik/eurocodes/rules
GET  /api/v1/statik/eurocodes/calculation-path-candidates
GET  /api/v1/statik/eurocodes/rules/<rule_id>
GET  /api/v1/statik/eurocodes/documents/<document_id>
POST /api/v1/statik/analysis-jobs
```

### Referenzen, Berichte und Austausch

```text
GET  /api/v1/statik/reference-cases
GET  /api/v1/statik/reference-cases/<id>
GET  /api/v1/statik/reference-cases/<id>/run
GET  /api/v1/statik/reference-cases/<id>/report.html
GET  /api/v1/statik/reference-cases/<id>/report.pdf
GET  /api/v1/statik/reference-cases/<id>/exchange.json
GET  /api/v1/statik/reference-cases/<id>/exchange.saf
GET  /api/v1/statik/project-cases
GET  /api/v1/statik/project-cases/<id>
GET  /api/v1/statik/project-cases/<id>/run
GET  /api/v1/statik/project-cases/<id>/workspace
POST /api/v1/statik/project-cases/<id>/workspace
POST /api/v1/statik/project-cases/<id>/preview
GET  /api/v1/statik/project-cases/<id>/report.html
GET  /api/v1/statik/project-cases/<id>/report.pdf
POST /api/v1/statik/project-cases/<id>/report
POST /api/v1/statik/analysis-jobs/report
POST /api/v1/statik/analysis-jobs/exchange
```

`GET /workspace` liefert den zusammenhängenden Arbeitsstand aus Projektmodell,
Positionsergebnissen, ausgewählten Rechenwegen und Pipelines sowie der gebundenen
Berechnungsvorlage. Die beiden `POST`-Routen übernehmen ausschließlich
numerische, pfadgebundene Arbeitskopie-Overrides und rechnen vor Vorschau oder
Ausgabe erneut. Die Quelldatei des Testprojekts bleibt unverändert.

Die bisherigen Vorschau-, Command- und Report-Draft-Routen bleiben während der
Vertragsmigration erhalten. Commands werden ohne Core nicht persistiert.

## Verträge

```text
structural-analysis-job/0.2
structural-analysis-result/0.2
vectoplan-structural-exchange/0.2
structural-model/0.1
structural-command/0.1
structural-report-template/0.2
structural-report-outline/0.2
structural-project-workspace/0.1
```

Die JSON-Schemas liegen unter `src/contracts/`. Geometrie, Material,
Einwirkungen, Normprofil, Herkunft und Revision sind getrennt, damit später
keine Fachinformation aus SVG- oder Canvas-Elementen rekonstruiert werden muss.

## Struktur

```text
src/
├── capabilities/    maschinenlesbare Fähigkeits- und Solvergrenzen
├── design/          Werkstoff- und Bauteilnachweise
├── domain/          gemeinsame Ergebnis- und Entscheidungsmodelle
├── exchange/        neutrales JSON und SAF 2.2
├── knowledge/       Literaturkatalog und Rückverfolgbarkeit
├── loads/           Kombinationen
├── materials/       lokaler Materialkatalog
├── pipeline/        Orchestrierung und Ergebnisvertrag
├── project_cases/   Wohngebäude-, Hochhaus-, Brücken- und Hallen-Testfälle
├── projects/        Projektpipeline, Lastpfad und Frontend-Workspace
├── reference_cases/ versionierte Eingaben
├── report_templates/Projektprofile, Berechnungsmodule und HTML-Kapitelvorlagen
├── reports/         HTML- und PDF-Berichte
├── solvers/         Balken- und Plattenlöser
└── standards/       Normregister und Auswahlregeln
```

## Lokaler Start

```powershell
cd services/vectoplan-statik
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:VECTOPLAN_STATIK_PORT = "5111"
python wsgi.py
```

Tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Projektarbeitsplatz

`http://localhost:5111/statik` startet mit vier deterministischen Testprojekten:

- komplexes Mehrfamilienhaus,
- Hochhaus mit Aussteifungskern,
- Straßenbrücke mit Überbau, Widerlager, Pfeiler und Bauzuständen,
- Industriehalle mit Schnee, Wind, Kranbahn und Ermüdungsposition.

Der Arbeitsplatz verbindet Bauteilauswahl, 2D-/3D-Prüfansicht, positions- und
umgebungsbezogene Variablen, Rechenwege, Pipelines, Regelwerksbezüge und
Berechnungstemplate. Geänderte Werte werden als lokale Overrides geführt. Erst
`Neu berechnen` erzeugt daraus einen neuen Ergebnisstand. HTML-Arbeitsbericht,
Templatevorschau und PDF werden aus demselben Stand erzeugt. Ein fachliches
Freigabegate bleibt unabhängig vom rechnerischen Status immer geschlossen, bis
eine qualifizierte Prüfung ausdrücklich dokumentiert ist.

## Nächste fachliche Ausbaustufen

1. Allgemeine 2D-Rahmen und 3D-Stabwerke mit geometrisch und materiell
   nichtlinearer Theorie sowie Eigenwert- und Imperfektionsanalysen.
2. Mindlin-Platten-/Schalen-FEM mit Netzkonvergenz, Membranwirkung und
   nichtlinearen Materialgesetzen; das vorhandene Plattenrost bleibt der
   abgegrenzte Rechenkern für Biegetragwirkung.
3. Vollständige normative Detailnachweise einschließlich Durchstanzen,
   Rissbreite, variabler Ermüdung, temperaturfeldbasierter Brandbemessung,
   Anschlüssen und zeitabhängigen Betonmodellen.
4. Brücken-Verkehrslastgenerator, Einflusslinien, Bauzustände und Dynamik.
5. Golden-File- und Roundtrip-Validierung mit Zielprogrammen für SAF/IFC.
6. Erst danach: versionierte Adapter zu Core, CAD, Editor und Library.
